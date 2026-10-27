import { InBodyDevice, InBodyDeviceState } from '../entities/InBodyDevice.entity';

import { InBodyResult } from '../entities/DeviceResponse.entity';
import { StartMeasurementRequest,  DeviceRequest } from '../entities/DeviceRequest.entity';

export interface DeviceTransition {
  nextState: InBodyDeviceState;
  nextCommand?: { action: string; context?: any };
  delayMs?: number;
}

export interface IDeviceTransitionEvaluator {
  evaluate(
    currentState: InBodyDeviceState,
    parsedResult: InBodyResult,
    params: StartMeasurementRequest
  ): DeviceTransition;
}

/**
 * 协议解析器语义契约 (Semantic Parser)
 * 职责：作为 CommunicationRunner 与 物理 Protocol 之间的桥梁。
 */
export interface IDeviceDataTranslator {
  /**
   * 核心：将原始流转化为标准 InBodyResult 领域实体。
   */
  parseIncomingData(deviceType: InBodyDevice['type'], raw: ArrayBuffer): InBodyResult;

  /**
   * 构建发送指令包。
   */
  buildOutgoingCommand(deviceType: InBodyDevice['type'], action: string, context?: DeviceRequest): ArrayBuffer;

  /**
   * 逻辑决策：根据当前状态和解析结果，决定下一个状态和指令。
   */
  evaluateTransition(
    currentState: InBodyDeviceState,
    parsedResult: InBodyResult,
    params: StartMeasurementRequest
  ): DeviceTransition;

  /**
   * 预设响应过滤器。
   */
  getExpectedResponseCmds(actionCode: string): string[];
}

/** 
 * --- Capability Traits (能力特征接口) ---
 * 用于解决不是所有设备都支持实时反馈的问题。
 */

/** 体重提取能力 */
export interface IWeightTrait {
  extractWeight(res: InBodyResult): number | undefined;
}

/** 进度提取能力 */
export interface IProgressTrait {
  extractProgress(res: InBodyResult): number | undefined;
}

/** 姿势/状态引导能力 */
export interface IPostureTrait {
  extractPosture(res: InBodyResult): number | undefined;
}
