import { StartMeasurementRequest } from '../../../domain/entities/DeviceRequest.entity';
import { InBodyResult } from '../../../domain/entities/DeviceResponse.entity';
import { InBodyDeviceState } from '../../../domain/entities/InBodyDevice.entity';
import { DeviceTransition, IDeviceTransitionEvaluator } from '../../../domain/ports/IDeviceDataTranslator';

export class H20TransitionEvaluator implements IDeviceTransitionEvaluator {
  public evaluate(
    currentState: InBodyDeviceState,
    res: InBodyResult,
    _params: StartMeasurementRequest
  ): DeviceTransition {
    const cmd = res.cmd as string | undefined;

    if (cmd === 'HA') {
      return { nextState: InBodyDeviceState.CANCELLED };
    }

    if (res.isCompleted) {
      return { nextState: InBodyDeviceState.COMPLETED };
    }

    if (currentState === InBodyDeviceState.INITIAL && (cmd === 'HC' || cmd === 'HR')) {
      return { nextState: InBodyDeviceState.MEASUREMENT_STARTED };
    }

    return { nextState: currentState };
  }
}
