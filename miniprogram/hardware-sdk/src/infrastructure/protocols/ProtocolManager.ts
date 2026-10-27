import { IDeviceDataTranslator } from '../../domain/ports/IDeviceDataTranslator';
import { InBodyDevice, InBodyDeviceState } from '../../domain/entities/InBodyDevice.entity';

import { InBodyResult } from '../../domain/entities/DeviceResponse.entity';
import { StartMeasurementRequest,  DeviceRequest } from '../../domain/entities/DeviceRequest.entity';

/**
 * 基础设施层：协议管理者 (ProtocolManager)
 * 职责：分发协议适配器。
 */
export class ProtocolManager {
  constructor(
    private readonly inbody120Parser: IDeviceDataTranslator,
    private readonly inbodyH20Parser: IDeviceDataTranslator,
    private readonly inbodyH30Parser: IDeviceDataTranslator
  ) {}

  public getParser(deviceType: InBodyDevice['type']): IDeviceDataTranslator {
    switch (deviceType) {
      case '120':
        return this.inbody120Parser;
      case 'H20':
        return this.inbodyH20Parser;
      case 'H30':
      case 'H40':
        return this.inbodyH30Parser;
      default:
        return this.inbodyH30Parser;
    }
  }

  /**
   * 门发入口：将原始字节转为全量业务实体
   */
  public parseIn(device: InBodyDevice, payload: ArrayBuffer): InBodyResult {
    return this.getParser(device.type).parseIncomingData(device.type, payload);
  }

  public buildOut(device: InBodyDevice, action: string, context?: DeviceRequest): ArrayBuffer {
    return this.getParser(device.type).buildOutgoingCommand(device.type, action, context);
  }

  public getExpectedResponseCmds(device: InBodyDevice, action: string): string[] {
    return this.getParser(device.type).getExpectedResponseCmds(action);
  }

  public evaluateTransition(device: InBodyDevice, currentState: InBodyDeviceState, parsedResult: InBodyResult, params: StartMeasurementRequest): any {
    return this.getParser(device.type).evaluateTransition(currentState, parsedResult, params);
  }
}
