import { InBodyDevice } from '../entities/InBodyDevice.entity';

/**
 * 蓝牙物理层管理服务 —— 专注底层的“链路”生命周期。
 */
export interface IBluetoothService {
  /** 启动扫描 */
  startScan(onDeviceFound?: (device: InBodyDevice) => void, timeoutMs?: number): Promise<InBodyDevice[]>;
  
  /** 停止扫描 */
  stopScan(): Promise<void>;

  /** 
   * 物理级连接建立。成功后，链路即刻处于“已准备好交换字节数据”的状态。
   */
  connect(target: string | InBodyDevice): Promise<void>;

  /** 物理级连接断开 */
  disconnect(): Promise<void>;

  /** 当前链路是否已连接 */
  isConnected(): boolean;

  /** 获取当前已连接或尝试连接的设备 ID */
  getCurrentDeviceId(): string;

  /** 监听手机蓝牙适配器的物理状态变化 (开启/关闭) */
  onAdapterStateChange(cb: (available: boolean, discovering: boolean) => void): () => void;

  /** 监听链路连接状态变化 */
  onConnectionStatusChange(cb: (deviceId: string, connected: boolean) => void): () => void;

  /** 销毁服务，清理所有底层监听器 */
  destroy(): void;
}
