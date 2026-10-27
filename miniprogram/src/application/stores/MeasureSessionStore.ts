import { InBodyDeviceState, InBodyDeviceType } from '../../../hardware-sdk/src/domain/entities/InBodyDevice.entity';
import { InBodyResult } from '../../../hardware-sdk/src/domain/entities/DeviceResponse.entity';
import { ObservableStore } from './ObservableStore';

export interface MeasureSessionState {
  readonly active: boolean;
  readonly deviceType: InBodyDeviceType;
  readonly deviceState: InBodyDeviceState;
  readonly connected: boolean;
  readonly realtimeWeight: number | null;
  readonly progress: number;
  readonly postureCode: number | null;
  readonly completedResult: InBodyResult | null;
  readonly errorMessage: string | null;
  readonly uploadStatus: 'idle' | 'uploading' | 'saved' | 'failed';
}

const INITIAL_MEASURE_STATE: MeasureSessionState = {
  active: false,
  deviceType: 'UNKNOWN',
  deviceState: InBodyDeviceState.INITIAL,
  connected: false,
  realtimeWeight: null,
  progress: 0,
  postureCode: null,
  completedResult: null,
  errorMessage: null,
  uploadStatus: 'idle',
};

export class MeasureSessionStore extends ObservableStore<MeasureSessionState> {
  constructor() {
    super(INITIAL_MEASURE_STATE);
  }

  startSession(deviceType: InBodyDeviceType): void {
    this.setState({
      ...INITIAL_MEASURE_STATE,
      active: true,
      deviceType,
      deviceState: InBodyDeviceState.CONNECTING,
    });
  }

  closeSession(): void {
    this.setState({
      ...INITIAL_MEASURE_STATE,
      active: false,
    });
  }
}
