import { InBodyDeviceState } from '../../../hardware-sdk/src/domain/entities/InBodyDevice.entity';

export interface IAudioPlayer {
  playByMeasureState(state: InBodyDeviceState): void;
  playFile(src: string): void;
  stop(): void;
  destroy(): void;
}
