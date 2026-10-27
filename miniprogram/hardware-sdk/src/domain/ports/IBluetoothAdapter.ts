import { InBodyDevice, BleCharacteristic, InBodyDeviceType } from '../entities/InBodyDevice.entity';

export interface IBluetoothAdapter {
  /**
   * 初始化蓝牙适配器
   */
  initAdapter(): Promise<void>;

  /**
   * 设置目标设备型号，用于扫描过滤
   */
  setTargetType(type: InBodyDeviceType): void;

  /**
   * 停止扫描
   */
  stopScan(): Promise<void>;

  /**
   * 扫描附近的设备并过滤
   * @param onDeviceFound 找到设备时的回调
   */
  scanForDevices(onDeviceFound: (device: InBodyDevice) => void): Promise<void>;

  /**
   * 连接到指定设备
   */
  connectDevice(deviceId: string): Promise<void>;

  /**
   * 断开设备连接
   */
  disconnectDevice(deviceId: string): Promise<void>;

  /**
   * 获取设备服务列表
   */
  getServices(deviceId: string): Promise<string[]>;

  /**
   * 获取设备特征值
   */
  getCharacteristics(deviceId: string, serviceId: string): Promise<BleCharacteristic[]>;

  /**
   * 写入数据到设备
   */
  writeData(deviceId: string, serviceId: string, characteristicId: string, payload: ArrayBuffer, writeNoResponse?: boolean): Promise<void>;

  /**
   * 监听设备的通知/指示数据
   * @returns 取消订阅函数，调用后移除该监听器
   */
  onDataReceived(callback: (deviceId: string, characteristicId: string, payload: ArrayBuffer) => void): () => void;

  /**
   * 监听设备连接状态变化
   * @returns 取消订阅函数，调用后移除该监听器
   */
  onConnectionStateChange(callback: (deviceId: string, connected: boolean) => void): () => void;

  /**
   * 获取当前所有已连接的设备
   */
  getConnectedDevices(): Promise<string[]>;

  /**
   * 开启/关闭特征值通知 (notify/indicate)
   */
  notifyCharacteristic(deviceId: string, serviceId: string, characteristicId: string, enabled: boolean): Promise<void>;

  /**
   * 监听手机蓝牙适配器状态变化
   * @returns 取消订阅函数
   */
  onAdapterStateChange(callback: (available: boolean, discovering: boolean) => void): () => void;
}
