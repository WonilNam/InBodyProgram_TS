import { IBluetoothService } from '../../domain/ports/IBluetoothService';
import { InBodyDevice, InBodyDeviceType } from '../../domain/entities/InBodyDevice.entity';
import { IBluetoothAdapter } from '../../domain/ports/IBluetoothAdapter';

/**
 * 蓝牙管理服务 —— 物理链路的终极管家。
 */
export class BluetoothService implements IBluetoothService {
  private _isConnected: boolean = false;
  private currentDeviceId: string = '';
  private _actualServiceId: string = '';
  private _actualWriteCharId: string = '';
  private _actualWriteNoResponse: boolean = false;
  private unsubs: Array<() => void> = [];
  private _scanTimer: ReturnType<typeof setTimeout> | null = null;
  private _scanResolve: ((val: InBodyDevice[]) => void) | null = null;
  private scanVersion = 0;
  private _discoveredDevices: Map<string, InBodyDevice> = new Map();

  constructor(
    private readonly repo: IBluetoothAdapter,
    private readonly targetType: InBodyDeviceType
  ) {
    const unsub = this.repo.onConnectionStateChange((id, connected) => {
      if (id === this.currentDeviceId) {
        this._isConnected = connected;
      }
    });
    this.unsubs.push(unsub);

    // 在初始化服务时就将目标型号同步给适配器，确保后续扫描自动过滤
    this.repo.setTargetType(this.targetType);
  }

  public async startScan(onDeviceFound?: (device: InBodyDevice) => void, timeoutMs: number = 10000): Promise<InBodyDevice[]> {
    // 1. 停止正在运行的扫描（如果有的话）
    await this.stopScan();
    const version = this.scanVersion;
    this._discoveredDevices.clear();
    await this.repo.initAdapter();
    if (version !== this.scanVersion) return [];
    const result = new Promise<InBodyDevice[]>((resolve) => { this._scanResolve = resolve; });
    try {
      await this.repo.scanForDevices((device) => {
        if (version !== this.scanVersion) return;
        // a. 内部悄悄收集，用于最终聚合返回
        this._discoveredDevices.set(device.deviceId, device);
        // b. 如果调用方传入了单次迭代回调，实时透传给调用方（用于UI动态展示）
        if (onDeviceFound) {
          onDeviceFound(device);
        }
      });
      if (timeoutMs > 0 && version === this.scanVersion) {
        this._scanTimer = setTimeout(() => {
          void this.stopScan().catch(error => console.warn('[BLE] 停止扫描失败', error));
        }, timeoutMs);
      }
      return await result;
    } catch (error) {
      if (version === this.scanVersion) await this.stopScan().catch(() => {});
      throw error;
    }
  }

  public async stopScan(): Promise<void> {
    this.scanVersion++;
    if (this._scanTimer !== null) {
      clearTimeout(this._scanTimer);
      this._scanTimer = null;
    }
    const resolvePtr = this._scanResolve;
    this._scanResolve = null;
    const final = Array.from(this._discoveredDevices.values());
    try {
      await this.repo.stopScan();
    } finally {
      if (resolvePtr) {
        resolvePtr(final);
      }
    }
  }

  /**
   * 核心逻辑：物理连接 + 服务查找 + 开启 Notify。
   * 替代了原先的 ConnectDeviceUseCase。
   */
  public async connect(target: string | any): Promise<void> {
    const deviceId = typeof target === 'string' ? target : (target.deviceId || target.deviceid);
    const type     = typeof target !== 'string' ? target.type   : this.targetType;
    
    this.currentDeviceId = deviceId;
    
    // 0. 连接前防死锁处理：强制停止扫描并清理可能存在的幽灵句柄
    await this.stopScan().catch(() => {});
    await this.repo.disconnectDevice(deviceId).catch(() => {});

    // 1. 物理连接（附带 133 错误和 10001/10000 适配器错误的自愈重试）
    const MAX_RETRIES = 2;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.repo.connectDevice(deviceId);
        break;
      } catch (err: any) {
        const errMsg = String(err?.message ?? err);
        const errCode = err?.errCode ?? err?.code;
        
        // 应对死锁情况 2: 适配器失效 (用户在通知栏开关了蓝牙)
        const isAdapterError = errMsg.includes('10001') || errMsg.includes('10000') || errCode === 10001 || errCode === 10000;
        if (isAdapterError && attempt < MAX_RETRIES) {
          console.warn(`[BLE] 检测到蓝牙适配器可能失效(10001/10000)，尝试重新唤醒适配器...`);
          await this.repo.initAdapter().catch(() => {});
          await new Promise(r => setTimeout(r, 1500)); // 给系统充足时间重启蓝牙上下文
          continue;
        }

        // 应对死锁情况 1: Android GATT 133 偶发报错
        const is133 = errMsg.includes('133') || errCode === 133;
        if (is133 && attempt < MAX_RETRIES) {
          console.warn(`[BLE] createBLEConnection status 133，${attempt}/${MAX_RETRIES - 1} 次重试中...`);
          await this.repo.disconnectDevice(deviceId).catch(() => {});
          await new Promise(r => setTimeout(r, 1000 * attempt));
          continue;
        }
        
        throw err;
      }
    }

    // 2. 服务发现 (微信小程序/安卓系统必经之路)
    await new Promise(r => setTimeout(r, 600)); // 给硬件一点稳定物理链路的时间
    const serviceIds = await this.repo.getServices(deviceId);
    console.log('[BLE] 设备服务列表:', serviceIds.join(', '));

    // 3. 遍历所有服务，找到同时具有 write + notify 特征的那个
    //    跳过只读标准服务（如 Device Information 0x180A），定位真正的通信服务
    await new Promise(r => setTimeout(r, 400));
    let actualServiceId = '';
    let notifyChar: import('../../domain/entities/InBodyDevice.entity').BleCharacteristic | undefined;
    let writeChar:  import('../../domain/entities/InBodyDevice.entity').BleCharacteristic | undefined;

    for (const serviceId of serviceIds) {
      let chars: import('../../domain/entities/InBodyDevice.entity').BleCharacteristic[];
      try {
        chars = await this.repo.getCharacteristics(deviceId, serviceId);
      } catch (_) {
        console.warn(`[BLE] 服务 ${serviceId} 特征值获取失败，跳过`);
        continue;
      }
      console.log(`[BLE] 服务 ${serviceId} 特征值:`, chars.map(
        c => `${c.uuid}(read:${c.properties.read},write:${c.properties.write},writeNR:${c.properties.writeNoResponse},notify:${c.properties.notify},indicate:${c.properties.indicate})`
      ).join(' | '));

      // 优先找同时具备 write + notify 的同一个特征（双向通信通道）
      // 否则分别找，避免在多特征服务中选错通道
      const bidir = chars.find(
        c => (c.properties.write || c.properties.writeNoResponse) &&
             (c.properties.notify || c.properties.indicate)
      );
      const n = bidir ?? chars.find(c => c.properties.notify || c.properties.indicate);
      const w = bidir ?? chars.find(c => c.properties.write || c.properties.writeNoResponse);
      if (n && w) {
        actualServiceId = serviceId;
        notifyChar = n;
        writeChar  = w;
        console.log(`[BLE] 命中通信服务: ${serviceId}，写特征: ${w.uuid}(writeNR:${w.properties.writeNoResponse})，通知特征: ${n.uuid}`);
        break;
      }
    }

    if (!actualServiceId || !notifyChar || !writeChar) {
      throw new Error(`[BLE] 未在任何服务中找到同时具有 write + notify 的特征值，服务列表: ${serviceIds.join(', ')}`);
    }

    // 4. 保存实际 UUID，供 sendRaw 使用
    this._actualServiceId        = actualServiceId;
    this._actualWriteCharId      = writeChar.uuid;
    this._actualWriteNoResponse  = writeChar.properties.writeNoResponse && !writeChar.properties.write;

    // 5. 开启 Notify 监听
    await this.repo.notifyCharacteristic(
      deviceId,
      actualServiceId,
      notifyChar.uuid,
      true
    );

    this._isConnected = true;
  }

  public async disconnect(): Promise<void> {
    if (!this.currentDeviceId) return;
    await this.repo.disconnectDevice(this.currentDeviceId);
    this._isConnected = false;
  }

  public isConnected(): boolean {
    return this._isConnected;
  }

  public getCurrentDeviceId(): string {
    return this.currentDeviceId;
  }

  /** 连接成功后设备实际使用的服务/写特征 UUID（供 CommunicationRunner.sendRaw 使用） */
  public getActualServiceId(): string        { return this._actualServiceId; }
  public getActualWriteCharId(): string      { return this._actualWriteCharId; }
  public getActualWriteNoResponse(): boolean { return this._actualWriteNoResponse; }
  public getDeviceType(): string             { return this.targetType; }

  public onAdapterStateChange(cb: (available: boolean, discovering: boolean) => void): () => void {
    const unsub = this.repo.onAdapterStateChange(cb);
    this.unsubs.push(unsub);
    return unsub;
  }

  public onConnectionStatusChange(cb: (deviceId: string, connected: boolean) => void): () => void {
    const unsub = this.repo.onConnectionStateChange(cb);
    this.unsubs.push(unsub);
    return unsub;
  }

  public destroy(): void {
    console.log('[BluetoothService] 正在销毁实例，清理资源...');

    // 0. 停止扫描（含清除定时器）
    this.stopScan().catch(() => {});

    // 1. 如果还在连接中，尝试静默断开（防止幽灵连接）
    if (this._isConnected && this.currentDeviceId) {
        this.repo.disconnectDevice(this.currentDeviceId).catch(() => {});
    }

    // 2. 清理所有订阅
    this.unsubs.forEach(unsub => unsub());
    this.unsubs = [];
    this._isConnected = false;
  }
}
