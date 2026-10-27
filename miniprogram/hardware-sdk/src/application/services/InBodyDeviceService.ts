import { IDeviceService, IWifiDeviceService, IBaseDeviceEvents } from '../../domain/ports/IDeviceService';
import { InBodyDevice, InBodyDeviceType, InBodyDeviceState } from '../../domain/entities/InBodyDevice.entity';
import { DeviceRequest, StartMeasurementRequest } from '../../domain/entities/DeviceRequest.entity';;
import { InBodyResult } from '../../domain/entities/DeviceResponse.entity';
import { CommunicationRunner } from '../../infrastructure/engine/CommunicationRunner';
import { ParsedDataBroadcaster } from '../../infrastructure/engine/ParsedDataBroadcaster';
import { IBluetoothService } from '../../domain/ports/IBluetoothService';
import { InBodyError, InBodyErrorCode } from '../../domain/value-objects/InBodyError';

/**
 * 应用层：型号适配型业务调度实现 (InBodyDeviceService)
 * 泛型 T 保证了我们在 subscribe 调用时的类型提示一致性。
 */
export class InBodyDeviceService<T extends IBaseDeviceEvents = IBaseDeviceEvents> implements IDeviceService<T>, IWifiDeviceService {
  
  constructor(
    private readonly deviceType: InBodyDeviceType,
    private readonly bluetoothService: IBluetoothService,
    protected readonly runner: CommunicationRunner,
    protected readonly broadcaster: ParsedDataBroadcaster
  ) {}

  /** 
   * 实现说明：
   * 虽然 T 被限制了某些型号不能有 Progress，但作为统一实现，
   * 内部依然可以安全地、多态地进行全量订阅。
   */
  public subscribe(handlers: T): () => void {
    const unsubs: Array<() => void> = [];

    // 1. 基础流程钩子
    if (handlers.onStateChange) unsubs.push(this.broadcaster.onStateChange(handlers.onStateChange));
    if (handlers.onError) unsubs.push(this.broadcaster.onError(handlers.onError));
    if (handlers.onCompleted) unsubs.push(this.broadcaster.onCompleted(handlers.onCompleted));

    // 2. 特征钩子 (只有接口定义里声明了才会被编译器补全，但在此处可以安全判断)
    const h = handlers as any;
    if (h.onWeight)   unsubs.push(this.broadcaster.onWeight(h.onWeight));
    if (h.onProgress) unsubs.push(this.broadcaster.onProgress(h.onProgress));
    if (h.onPosture)  unsubs.push(this.broadcaster.onPosture(h.onPosture));

    return () => unsubs.forEach(u => u());
  }

  public async call(action: string, data?: DeviceRequest | Record<string, unknown>, maxRetries: number = 3): Promise<InBodyResult> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const device = await this.ensureConnection();
        this.runner.setActiveDevice(device);
        return await this.runner.executeSingle(device, action, data);
      } catch (err) {
        const isTimeout = err instanceof InBodyError && err.code === InBodyErrorCode.TIMEOUT;
        if (!isTimeout || attempt === maxRetries) throw err;
        console.warn(`[DeviceService] ${action} 指令超时，重试 (${attempt}/${maxRetries})`);
        await new Promise(r => setTimeout(r, 1_000));
      }
    }
    // 不可达，仅满足 TS 类型检查
    throw new InBodyError(InBodyErrorCode.TRYAGAIN, '[DeviceService] call 重试耗尽');
  }

  public async startAutoMeasurement(params: StartMeasurementRequest): Promise<void> {
    const device = await this.ensureConnection();
    this.runner.setActiveDevice(device);

    try {
      return await this.runner.runAutoMeasurement(
        device,
        params,
        (s) => this.broadcaster._onInternalStateChange(s),
        (m) => this.broadcaster._onInternalCompleted(m)
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.broadcaster._onInternalError(error);
      throw error;
    }
  }

  private async ensureConnection(): Promise<InBodyDevice> {
    const deviceId = this.bluetoothService.getCurrentDeviceId();
    if (!deviceId) throw new InBodyError(InBodyErrorCode.NODEVICE, '[AppService] 尚未绑定任何设备，无法进行通信');

    if (!this.bluetoothService.isConnected()) {
      console.log(`[DeviceService] 检测到当前处于断开状态，尝试自动重连 [${deviceId}]...`);
      try {
        await this.bluetoothService.connect(deviceId);
        // 给底层留出开启 Notify 的时间窗口
        await new Promise(r => setTimeout(r, 800));
      } catch (err) {
        console.error('[DeviceService] 自动重连失败:', err);
        throw new InBodyError(InBodyErrorCode.NODEVICE, '[AppService] 自动重连失败，设备可能不在附近');
      }
    }

    return {
      deviceId,
      type: this.deviceType,
      name: `InBody ${this.deviceType}`
    };
  }

  public async wifiScan(): Promise<any[]> {
    const device = await this.ensureConnection();
    this.runner.setActiveDevice(device);

    try {
      return await this.runner.executeWifiScan(device);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.broadcaster._onInternalError(error);
      throw error;
    }
  }

  public destroy(): void {
    console.log(`[InBodyDeviceService] 服务自动清理 (${this.deviceType})`);
    this.runner.destroy();
  }
}
