import { IBluetoothAdapter } from '../../domain/ports/IBluetoothAdapter';
import { InBodyDevice, BleCharacteristic, InBodyDeviceType } from '../../domain/entities/InBodyDevice.entity';
import { InBodyError } from '../../domain/value-objects/InBodyError';
import { fromWxBle } from '../errors/WxBleError';

// 声明微信小程序原生全局对象
declare const wx: any;

export class WxBluetoothAdapter implements IBluetoothAdapter {
  /**
   * Symbol-keyed Map 确保每次 onDataReceived / onConnectionStateChange 注册的监听器
   * 都有唯一的 key，且可通过返回的 unsubscribe 函数精确删除，防止回调累积泄漏。
   */
  private readonly dataCallbacks: Map<symbol, (deviceId: string, characteristicId: string, payload: ArrayBuffer) => void> = new Map();
  private readonly connCallbacks: Map<symbol, (deviceId: string, connected: boolean) => void> = new Map();
  private readonly adapterCallbacks: Map<symbol, (available: boolean, discovering: boolean) => void> = new Map();
  private readonly foundCallbacks: Map<symbol, (device: InBodyDevice) => void> = new Map();
  private targetType: InBodyDeviceType = 'UNKNOWN';

  public setTargetType(type: InBodyDeviceType): void {
    this.targetType = type;
  }

  constructor() {
    // 强制清理可能存在的旧监听器，防止重复注册导致的内存泄漏
    try {
      wx.offBLECharacteristicValueChange();
      wx.offBLEConnectionStateChange();
      wx.offBluetoothAdapterStateChange();
      wx.offBluetoothDeviceFound();
    } catch (e) {
      // 忽略部分低版本微信不支持 off 接口的情况
    }

    // 统一注册一次底层监听，分发给所有订阅者
    wx.onBLECharacteristicValueChange((res: any) => {
      console.log(`[BLE-Repo] <<< 收到数据包: ${res.deviceId}, 长度: ${res.value.byteLength}`);
      this.dataCallbacks.forEach(cb => cb(res.deviceId, res.characteristicId, res.value));
    });

    wx.onBLEConnectionStateChange((res: any) => {
      console.log(`[BLE-Repo] 连接状态变化: [${res.deviceId}] connected=${res.connected}`);
      this.connCallbacks.forEach(cb => cb(res.deviceId, res.connected));
    });

    wx.onBluetoothAdapterStateChange((res: any) => {
      this.adapterCallbacks.forEach(cb => cb(res.available, res.discovering));
    });

    wx.onBluetoothDeviceFound((res: any) => {
      res.devices.forEach((device: any) => {
        const name = device.name || '';
        // 1. 基础过滤：必须包含 INBODY，且如果指定了型号则必须包含该型号
        if (!name.toUpperCase().includes('INBODY')) return;
        if (this.targetType !== 'UNKNOWN' && !name.includes(this.targetType)) return;

        // 2. 识别型号：优先使用预设的目标型号，全扫模式下才执行详细匹配
        const type: InBodyDeviceType = (this.targetType !== 'UNKNOWN')
          ? this.targetType
          : (['120', 'H20', 'H30', 'H40'].find(t => name.includes(t)) as InBodyDeviceType || 'UNKNOWN');

        const inBodyDevice: InBodyDevice = {
          ...device,
          deviceId: device.deviceId,
          name: name || device.localName || 'Unknown Device',
          type
        };

        this.foundCallbacks.forEach(cb => cb(inBodyDevice));
      });
    });
  }

  private _buf2hex(buffer: ArrayBuffer): string {
    return Array.prototype.map.call(new Uint8Array(buffer), (x: any) => ('00' + x.toString(16)).slice(-2).toUpperCase()).join(' ');
  }

  /** 将 wx BLE API 错误统一转换为 InBodyError */
  private _wxErr(err: any): InBodyError {
    return fromWxBle(err);
  }

  public async initAdapter(): Promise<void> {
    // 先关闭适配器以清除上一次遗留的扫描/连接状态，忽略关闭失败（如从未初始化过）
    await new Promise<void>(resolve => {
      wx.closeBluetoothAdapter({ success: () => resolve(), fail: () => resolve() });
    });

    return new Promise((resolve, reject) => {
      wx.openBluetoothAdapter({
        success: () => resolve(),
        fail: (err: any) => reject(this._wxErr(err))
      });
    });
  }

  public async stopScan(): Promise<void> {
    return new Promise((resolve, reject) => {
      wx.stopBluetoothDevicesDiscovery({
        success: () => {
          this.foundCallbacks.clear();
          resolve();
        },
        fail: (err: any) => {
          // 如果本身就没初始化过(10000)，说明物理层面本来就是停止状态，直接放行！
          if (err && err.errCode === 10000) {
            console.log('[BLE-Repo] 适配器未初始化，跳过停止扫描步骤。');
            return resolve();
          }
          reject(this._wxErr(err));
        }
      });
    });
  }

  public async scanForDevices(onDeviceFound: (device: InBodyDevice) => void): Promise<void> {
    const key = Symbol();
    
    return new Promise((resolve, reject) => {
      // 1. 强制彻底停止前一次扫描并清空回调池
      this.stopScan().catch(() => {}).then(async () => {
        // 2. 物理冷却期：给系统蓝牙总线一点重置时间 (300ms 经验值)
        await new Promise(r => setTimeout(r, 300));
        
        // 3. 注册本次扫描的回调
        this.foundCallbacks.set(key, onDeviceFound);
        
        wx.startBluetoothDevicesDiscovery({
          allowDuplicatesKey: false, // 设为 true 可能会导致重复上报，但在某些设备上更灵敏
          powerLevel: 'high',
          success: () => {
            console.log('[BLE-Repo] >>> 扫描引擎重置成功，开始搜寻...');
            resolve();
          },
          fail: (err: any) => {
            console.error('[BLE-Repo] 扫描开启失败:', err);
            this.foundCallbacks.delete(key);
            reject(this._wxErr(err));
          }
        });
      });
    });
  }

  public async connectDevice(deviceId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[BLE-Repo] 尝试连接设备: ${deviceId}`);
      wx.createBLEConnection({
        deviceId,
        timeout: 10000,
        success: (res: any) => {
          console.log(`[BLE-Repo] 连接成功: ${deviceId}`);
          resolve();
        },
        fail: (err: any) => {
          console.error(`[BLE-Repo] 连接失败: ${JSON.stringify(err)}`);
          // 如果报错 10002 且其实已经连接了，有些手机会报 10002，这里可以做进一步容错
          reject(this._wxErr(err));
        }
      });
    });
  }

  public async getServices(deviceId: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      wx.getBLEDeviceServices({
        deviceId,
        success: (res: any) => {
          const serviceIds = res.services.map((s: any) => s.uuid);
          console.log(`[BLE-Repo] 发现服务列表: ${serviceIds.join(', ')}`);
          resolve(serviceIds);
        },
        fail: (err: any) => reject(this._wxErr(err))
      });
    });
  }

  public async disconnectDevice(deviceId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`[BLE-Repo] 正在请求主动断开: ${deviceId}`);
      wx.closeBLEConnection({
        deviceId,
        success: () => {
          console.log(`[BLE-Repo] 物理链路已断开: ${deviceId}`);
          resolve();
        },
        fail: (err: any) => {
          // 如果本身已经断开了，报错 10001/10002 也是可以接受的
          console.warn(`[BLE-Repo] 主动断开失败(可能已失效): ${JSON.stringify(err)}`);
          resolve(); 
        }
      });
    });
  }

  public async getCharacteristics(deviceId: string, serviceId: string): Promise<BleCharacteristic[]> {
    return new Promise((resolve, reject) => {
      wx.getBLEDeviceCharacteristics({
        deviceId,
        serviceId,
        success: (res: any) => {
          const charList = res.characteristics.map((c: any) => ({
            uuid: c.uuid,
            properties: {
              read: c.properties.read,
              write: c.properties.write,
              writeNoResponse: c.properties.writeNoResponse,
              notify: c.properties.notify,
              indicate: c.properties.indicate
            }
          }));
          resolve(charList);
        },
        fail: (err: any) => reject(this._wxErr(err))
      });
    });
  }

  public async writeData(deviceId: string, serviceId: string, characteristicId: string, payload: ArrayBuffer, writeNoResponse: boolean = false): Promise<void> {
    return new Promise((resolve, reject) => {
      wx.writeBLECharacteristicValue({
        deviceId,
        serviceId,
        characteristicId,
        value: payload,
        // Only set when asked: omitting it keeps the platform default used by every normal command.
        ...(writeNoResponse ? { writeType: 'writeNoResponse' } : {}),
        success: () => {
          console.log(`[BLE-Repo] >>> 写入成功 charId=${characteristicId} len=${payload.byteLength}`);
          resolve();
        },
        fail: (err: any) => {
          console.error(`[BLE-Repo] >>> 写入失败 charId=${characteristicId}`, err);
          reject(this._wxErr(err));
        }
      });
    });
  }

  public async notifyCharacteristic(deviceId: string, serviceId: string, characteristicId: string, enabled: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      wx.notifyBLECharacteristicValueChange({
        deviceId,
        serviceId,
        characteristicId,
        state: enabled,
        success: resolve,
        fail: (err: any) => reject(this._wxErr(err))
      });
    });
  }

  /**
   * 订阅设备通知数据。
   * @returns 取消订阅函数 — 调用后该监听器立即从分发树中移除。
   */
  public onDataReceived(callback: (deviceId: string, characteristicId: string, payload: ArrayBuffer) => void): () => void {
    const key = Symbol();
    this.dataCallbacks.set(key, callback);
    return () => { this.dataCallbacks.delete(key); };
  }

  /**
   * 订阅设备连接状态变化。
   * @returns 取消订阅函数。
   */
  public onConnectionStateChange(callback: (deviceId: string, connected: boolean) => void): () => void {
    const key = Symbol();
    this.connCallbacks.set(key, callback);
    return () => { this.connCallbacks.delete(key); };
  }

  public async getConnectedDevices(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      wx.getConnectedBluetoothDevices({
        success: (res: any) => {
          resolve(res.devices.map((d: any) => d.deviceId));
        },
        fail: (err: any) => reject(this._wxErr(err))
      });
    });
  }

  public onAdapterStateChange(callback: (available: boolean, discovering: boolean) => void): () => void {
    const key = Symbol();
    this.adapterCallbacks.set(key, callback);
    return () => { this.adapterCallbacks.delete(key); };
  }
}
