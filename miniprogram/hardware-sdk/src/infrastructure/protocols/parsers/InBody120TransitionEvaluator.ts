import { StartMeasurementRequest } from '../../../domain/entities/DeviceRequest.entity';
import { InBodyResult } from '../../../domain/entities/DeviceResponse.entity';
import { InBodyDeviceState } from '../../../domain/entities/InBodyDevice.entity';
import { DeviceTransition, IDeviceTransitionEvaluator } from '../../../domain/ports/IDeviceDataTranslator';

export class InBody120TransitionEvaluator implements IDeviceTransitionEvaluator {
  public evaluate(
    currentState: InBodyDeviceState,
    res: InBodyResult,
    params: StartMeasurementRequest
  ): DeviceTransition {
    const cmd = res.cmd as string | undefined;

    if (cmd === 'e') {
      return { nextState: InBodyDeviceState.FAILED };
    }

    if (currentState === InBodyDeviceState.INITIAL && cmd === 't') {
      return {
        nextState: InBodyDeviceState.USER_CONFIGURING,
        nextCommand: { action: 'u', context: params },
      };
    }

    if (res.isCompleted) {
      return { nextState: InBodyDeviceState.COMPLETED };
    }

    if (currentState === InBodyDeviceState.USER_CONFIGURING && cmd === 'u') {
      return { nextState: InBodyDeviceState.MEASUREMENT_STARTED };
    }

    if (cmd === 'w') {
      return { nextState: InBodyDeviceState.WEIGHT_CONFIRMED };
    }

    if (cmd === 'P' || cmd === 'p') {
      return { nextState: InBodyDeviceState.ANALYZING };
    }

    return { nextState: currentState };
  }
}
