import { InBodyDeviceState } from '../../../hardware-sdk/src/domain/entities/InBodyDevice.entity';
import { IAudioPlayer } from '../../domain/ports/IAudioPlayer';

const STATE_AUDIO_MAP: Partial<Record<InBodyDeviceState, string>> = {
  [InBodyDeviceState.WEIGHT_CONFIRMED]: '/images/_last.mp3',
  [InBodyDeviceState.COMPLETED]: '/images/_done.mp3',
};

export class WxAudioPlayer implements IAudioPlayer {
  private audioCtx: any = null;

  private ensureContext(): any {
    if (!this.audioCtx && typeof wx !== 'undefined' && typeof wx.createInnerAudioContext === 'function') {
      this.audioCtx = wx.createInnerAudioContext();
    }
    return this.audioCtx;
  }

  playByMeasureState(state: InBodyDeviceState): void {
    const src = STATE_AUDIO_MAP[state];
    if (src) {
      this.playFile(src);
    }
  }

  playFile(src: string): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      ctx.stop();
      ctx.src = src;
      ctx.play();
    } catch {
      // Ignore audio playback errors on unsupported simulators
    }
  }

  stop(): void {
    if (!this.audioCtx) return;
    try {
      this.audioCtx.stop();
    } catch {
      // Ignore
    }
  }

  destroy(): void {
    if (!this.audioCtx) return;
    try {
      this.audioCtx.destroy();
    } catch {
      // Ignore
    }
    this.audioCtx = null;
  }
}
