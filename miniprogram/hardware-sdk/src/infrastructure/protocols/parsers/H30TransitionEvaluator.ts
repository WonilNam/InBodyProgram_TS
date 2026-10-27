import { StartMeasurementRequest } from '../../../domain/entities/DeviceRequest.entity';
import { InBodyResult } from '../../../domain/entities/DeviceResponse.entity';
import { InBodyDeviceState } from '../../../domain/entities/InBodyDevice.entity';
import { DeviceTransition, IDeviceTransitionEvaluator } from '../../../domain/ports/IDeviceDataTranslator';

/**
 * H30/H40 measurement state machine.
 *
 * Parser files translate bytes into results; this class decides what the
 * measurement flow should do next once a parsed result is available.
 */
export class H30TransitionEvaluator implements IDeviceTransitionEvaluator {
  public evaluate(
    currentState: InBodyDeviceState,
    res: InBodyResult,
    params: StartMeasurementRequest
  ): DeviceTransition {
    // Strict registration pipeline: AK -> UL -> HO -> AK -> HI.
    if (currentState === InBodyDeviceState.INITIAL && res.cmd === 'AK') {
      console.log('[H30StateMachine] 初始握手成功，进入 REGISTERING，请求 UL');
      return {
        nextState: InBodyDeviceState.REGISTERING,
        nextCommand: { action: 'UL' },
      };
    }

    if (currentState === InBodyDeviceState.REGISTERING && res.cmd === 'UL') {
      console.log('[H30StateMachine] 用户列表已同步，进入 USER_CONFIGURING，请求 HO');
      return {
        nextState: InBodyDeviceState.USER_CONFIGURING,
        nextCommand: { action: 'HO', context: params },
      };
    }

    if (currentState === InBodyDeviceState.USER_CONFIGURING && res.cmd === 'HO') {
      console.log('[H30StateMachine] 环境配置成功，进入 USER_CONFIG_DONE，请求二次 AK 确认');
      return {
        nextState: InBodyDeviceState.USER_CONFIG_DONE,
        nextCommand: { action: 'AK', context: { syncTime: true } },
      };
    }

    if (currentState === InBodyDeviceState.USER_CONFIG_DONE && res.cmd === 'AK') {
      console.log('[H30StateMachine] 二次确认完成，进入 MEASUREMENT_STARTED，下发 HI 个人信息');
      return {
        nextState: InBodyDeviceState.MEASUREMENT_STARTED,
        nextCommand: { action: 'HI', context: params },
      };
    }

    if (res.cmd === 'HI') {
      return {
        nextState: InBodyDeviceState.WAITING_FOR_STEP_ON,
        nextCommand: { action: 'HW' },
        delayMs: 800,
      };
    }

    if (res.cmd === 'HW') {
      if (res.weight === 0) {
        return {
          nextState: InBodyDeviceState.WAITING_FOR_STEP_ON,
          nextCommand: { action: 'HW' },
          delayMs: 1000,
        };
      }

      return {
        nextState: InBodyDeviceState.MEASURING_WEIGHT,
        nextCommand: { action: 'HW' },
        delayMs: 1000,
      };
    }

    if (res.cmd === 'HS') {
      return {
        nextState: InBodyDeviceState.WEIGHT_CONFIRMED,
        nextCommand: { action: 'HP' },
        delayMs: 200,
      };
    }

    if (res.cmd === 'HP') {
      const posture = (res as any).statu;
      switch (posture) {
        case 0x31:
          return { nextState: InBodyDeviceState.ANALYZING, nextCommand: { action: 'HM' }, delayMs: 200 };
        case 0x32:
          return { nextState: InBodyDeviceState.WAITING_FOR_STEP_ON, nextCommand: { action: 'HW' }, delayMs: 400 };
        default:
          return { nextState: InBodyDeviceState.POSTURE_CHECKING, nextCommand: { action: 'HP' }, delayMs: 800 };
      }
    }

    if (res.cmd === 'HM') {
      const progress = (res as any).progress ?? 0;
      if (progress < 100) {
        return { nextState: InBodyDeviceState.ANALYZING, nextCommand: { action: 'HM' }, delayMs: 800 };
      }
      return { nextState: InBodyDeviceState.ANALYZING, nextCommand: { action: 'HR' }, delayMs: 800 };
    }

    if (res.isCompleted) {
      return { nextState: InBodyDeviceState.COMPLETED };
    }

    if (res.cmd === 'HE') {
      console.warn(`[H30StateMachine] 收到测试中断 HE(${res.code})，重新进入姿势检测`);
      return {
        nextState: InBodyDeviceState.POSTURE_CHECKING,
        nextCommand: { action: 'HP' },
        delayMs: 6000,
      };
    }

    if (res.cmd === 'SR') {
      const status = (res as any).statu;
      console.log(`[H30StateMachine] 收到状态同步信号(SR): ${status}`);
      if (status === 2) return { nextState: InBodyDeviceState.WAITING_FOR_STEP_ON, nextCommand: { action: 'HW' }, delayMs: 400 };
      if (status === 4) return { nextState: InBodyDeviceState.POSTURE_CHECKING, nextCommand: { action: 'HP' }, delayMs: 400 };
      if (status === 6) return { nextState: InBodyDeviceState.ANALYZING, nextCommand: { action: 'HM' }, delayMs: 400 };
      if (status === 8) return { nextState: InBodyDeviceState.ANALYZING, nextCommand: { action: 'HR' } };
    }

    return { nextState: currentState };
  }
}
