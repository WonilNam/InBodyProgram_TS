import { DeviceTransition, IDeviceDataTranslator, IDeviceTransitionEvaluator } from '../../../domain/ports/IDeviceDataTranslator';
import { IProtocol } from '../framers/IProtocol';
import { InBodyDevice, InBodyDeviceState } from '../../../domain/entities/InBodyDevice.entity';

import { InBodyResult } from '../../../domain/entities/DeviceResponse.entity';
import { StartMeasurementRequest,  DeviceRequest } from '../../../domain/entities/DeviceRequest.entity';

/**
 * 抽象基类：协议语义化解析基石 (BaseProtocolParser)
 * 它封装了：字节缓冲 (Buffering) 和 物理分帧 (Framing)。
 */
export abstract class BaseProtocolParser implements IDeviceDataTranslator {
  
  protected abstract _protocol: IProtocol;
  protected abstract _transitionEvaluator: IDeviceTransitionEvaluator;
  protected _streamingBuffer: Uint8Array = new Uint8Array(0);

  /**
   * 核心：所有 Parser 通用的流式解析主逻辑 (L881 - L1018 的直接调用者)
   */
  public parseIncomingData(_deviceType: InBodyDevice['type'], raw: ArrayBuffer): InBodyResult {
    // 积攒缓冲区
    const combined = new Uint8Array(this._streamingBuffer.length + raw.byteLength);
    combined.set(this._streamingBuffer);
    combined.set(new Uint8Array(raw), this._streamingBuffer.length);
    this._streamingBuffer = combined;

    // 交给物理层执行分帧与校验
    const decodeResult = this._protocol.decode(this._streamingBuffer);
    
    // 如果还没凑成一帧，检查缓冲池大小防 OOM，然后返回一个临时标记对象
    if (!decodeResult) {
      if (this._streamingBuffer.length > 4096) {
         // 保留最后部分，丢弃前面的死水数据
         this._streamingBuffer = this._streamingBuffer.slice(this._streamingBuffer.length - 4096);
      }
      return { deviceId: '', isCompleted: false, cmd: 'BUFFERING' };
    }

    // 成功分帧则消费缓冲区
    this._streamingBuffer = this._streamingBuffer.slice(decodeResult.consumed);

    // 调用子类实现的语义解析逻辑，将 RawFrame 转为 InBodyResult
    return this.mapFrameToResult(decodeResult.frame);
  }

  /**
   * 语义映射：子类在此实现具体的位偏移赋值逻辑
   */
  protected abstract mapFrameToResult(frame: { cmd: string, payload: Uint8Array }): InBodyResult;

  public buildOutgoingCommand(
    _deviceType: InBodyDevice['type'], 
    action: string, 
    context?: DeviceRequest
  ): ArrayBuffer {
    return this._protocol.encode(action, context);
  }

  public evaluateTransition(
    currentState: InBodyDeviceState,
    parsedResult: InBodyResult,
    params: StartMeasurementRequest
  ): DeviceTransition {
    return this._transitionEvaluator.evaluate(currentState, parsedResult, params);
  }

   /**
   * 获取执行某个动作后，预期可能收到的设备响应指令列表。
   * 由具体型号实现，因为不同型号的指令流（如实时重量、姿势校验）差异巨大。
   */
  public abstract getExpectedResponseCmds(actionCode: string): string[];

  // --- 二进制解析辅助工具 (工具集下沉) ---

  /** 读取 16 位大端整数 */
  protected _readWord(dv: DataView, offset: number): number {
    if (offset + 1 >= dv.byteLength) return 0;
    return ((dv.getUint8(offset) << 8) & 0xff00) + (dv.getUint8(offset + 1) & 0x00ff);
  }

  /** 读取 6 字节日期字符串 (YYMMDDHHMMSS) */
  protected _readDateString(dv: DataView, offset: number): string {
    let s = "";
    for (let i = 0; i < 6; i++) {
        const v = dv.getUint8(offset + i);
        s += v < 10 ? "0" + v : v.toString();
    }
    return s;
  }

  /** 读取指定长度的字符串 (处理 0xFF 和 0x00 填充) */
  protected _readString(dv: DataView, start: number, len: number): string {
    if (start + len > dv.byteLength) return "";
    const codes = [];
    for (let i = start; i < start + len; i++) {
        const c = dv.getUint8(i);
        if (c !== 0xff && c !== 0x00) codes.push(c);
    }
    return String.fromCharCode(...codes).trim();
  }
}
