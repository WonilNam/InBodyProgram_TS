import { IDeviceService, IBaseDeviceEvents, IH30Handlers } from '../domain/ports/IDeviceService';
import { IBluetoothService } from '../domain/ports/IBluetoothService';
import { IBluetoothAdapter } from '../domain/ports/IBluetoothAdapter';
import { ProtocolManager } from '../infrastructure/protocols/ProtocolManager';
import { CommunicationRunner } from '../infrastructure/engine/CommunicationRunner';
import { ParsedDataBroadcaster } from '../infrastructure/engine/ParsedDataBroadcaster';
import { InBodyDeviceType } from '../domain/entities/InBodyDevice.entity';
import { InBodyDeviceService } from './services/InBodyDeviceService';

/**
 * 设备服务工厂 —— 生产瘦身后的 Services。
 */
export class DeviceServiceFactory {
  constructor(
    private readonly bluetoothService: IBluetoothService,
    private readonly bluetoothRepo:    IBluetoothAdapter,
    private readonly protocolManager:  ProtocolManager,
    private readonly broadcaster:      ParsedDataBroadcaster
  ) {}

  /**
   * 根据型号创建对应的业务服务。
   * 这里利用 TS 的重载或类型转换，确保 H30 返回 IH30DeviceEvents。
   */
  public createService(type: InBodyDeviceType): IDeviceService<any> {
    // 将 BluetoothService 连接后缓存的真实 UUID 注入 Runner，避免 "no service" 错误
    const bs = this.bluetoothService as any;
    const runner = new CommunicationRunner(
      this.bluetoothRepo,
      this.protocolManager,
      this.broadcaster,
      () => {
        const deviceId        = bs.getCurrentDeviceId?.()        as string  | undefined;
        const deviceType      = bs.getDeviceType?.()             as string  | undefined;
        const serviceId       = bs.getActualServiceId?.()        as string  | undefined;
        const writeCharId     = bs.getActualWriteCharId?.()      as string  | undefined;
        const writeNoResponse = bs.getActualWriteNoResponse?.()  as boolean | undefined;
        return serviceId && writeCharId && deviceId
          ? { deviceId, deviceType: deviceType ?? 'H30', serviceId, writeCharId, writeNoResponse: writeNoResponse ?? false }
          : null;
      }
    );
    
    // 如果是 H30 或 H40，它们支持更丰富的事件回调
    if (type === 'H30' || type === 'H40') {
        return new InBodyDeviceService<IH30Handlers>(
            type,
            this.bluetoothService,
            runner,
            this.broadcaster
        );
    }

    // 默认返回基础版服务
    return new InBodyDeviceService<IBaseDeviceEvents>(
        type,
        this.bluetoothService,
        runner,
        this.broadcaster
    );
  }
}
