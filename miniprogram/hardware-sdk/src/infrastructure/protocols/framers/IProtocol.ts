import { DeviceRequest } from '../../../domain/entities/DeviceRequest.entity';

/**
 * 物理层原始帧 (Physical Data Frame)
 */
export interface RawFrame {
  cmd: string;         // 指令码 (e.g. 'HW', 'HR', 'AK')
  payload: Uint8Array; // 物理负载内容 (不含包头包尾校验位)
}

/**
 * 物理层协议接口 (Physical & Data Protocol)
 * 职责：负责特定设备的数据分帧、封包构建、CRC 校验、及其物理二进制协议实现。
 * 它是“纯技术”的，不感知复杂的业务指标（如 BMI、肌肉量等）。
 */
export interface IProtocol {
  /** 
   * 封装指令：依据具体动作（如 'HO', 'WI', 'WD'）加载对应的参数上下文。
   */
  encode(action: string, params?: DeviceRequest): ArrayBuffer;

  /** 
   * 解码/分帧：从字节流中解析出原始数据帧。
   */
  decode(data: Uint8Array): { frame: RawFrame; consumed: number } | null;
}
