import { ParsedDataBroadcaster } from '../infrastructure/engine/ParsedDataBroadcaster';
import { InBodyDeviceState } from '../domain/entities/InBodyDevice.entity';
import { InBodyResult } from '../domain/entities/DeviceResponse.entity';
import { IDeviceDataTranslator, IWeightTrait, IProgressTrait, IPostureTrait } from '../domain/ports/IDeviceDataTranslator';

// 模拟同时实现 Weight / Progress / Posture 三个 Trait 的解析器
const mockParser = {
  parseIncomingData: jest.fn(),
  buildOutgoingCommand: jest.fn(),
  getExpectedResponseCmds: jest.fn(),
  evaluateTransition: jest.fn(),
  extractWeight: jest.fn((res: any) => (res.cmd === 'HW' ? res.weight : undefined)),
  extractProgress: jest.fn((res: any) => (res.cmd === 'HM' ? res.progress : undefined)),
  extractPosture: jest.fn((res: any) => (res.cmd === 'HP' ? res.statu : undefined)),
} as unknown as IDeviceDataTranslator & IWeightTrait & IProgressTrait & IPostureTrait;

describe('ParsedDataBroadcaster', () => {
  let broadcaster: ParsedDataBroadcaster;

  beforeEach(() => {
    broadcaster = new ParsedDataBroadcaster();
  });

  // ────────────────────────────────────────
  // onStateChange
  // ────────────────────────────────────────

  describe('onStateChange / _onInternalStateChange', () => {
    it('注册的回调收到状态变更', () => {
      const cb = jest.fn();
      broadcaster.onStateChange(cb);
      broadcaster._onInternalStateChange(InBodyDeviceState.MEASUREMENT_STARTED);
      expect(cb).toHaveBeenCalledWith(InBodyDeviceState.MEASUREMENT_STARTED);
    });

    it('多个订阅者都收到通知', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      broadcaster.onStateChange(cb1);
      broadcaster.onStateChange(cb2);
      broadcaster._onInternalStateChange(InBodyDeviceState.COMPLETED);
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });

    it('取消订阅后不再收到通知', () => {
      const cb = jest.fn();
      const unsub = broadcaster.onStateChange(cb);
      unsub();
      broadcaster._onInternalStateChange(InBodyDeviceState.MEASUREMENT_STARTED);
      expect(cb).not.toHaveBeenCalled();
    });

    it('取消一个订阅者不影响其他订阅者', () => {
      const cb1 = jest.fn();
      const cb2 = jest.fn();
      const unsub1 = broadcaster.onStateChange(cb1);
      broadcaster.onStateChange(cb2);
      unsub1();
      broadcaster._onInternalStateChange(InBodyDeviceState.MEASUREMENT_STARTED);
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });

  // ────────────────────────────────────────
  // onCompleted
  // ────────────────────────────────────────

  describe('onCompleted / _onInternalCompleted', () => {
    it('回调收到测量结果对象', () => {
      const cb = jest.fn();
      broadcaster.onCompleted(cb);
      const data = { cmd: 'HR', deviceId: '', isCompleted: true, weight: 65.5, bmi: 22.1 } as InBodyResult;
      broadcaster._onInternalCompleted(data);
      expect(cb).toHaveBeenCalledWith(data);
    });

    it('取消后不触发', () => {
      const cb = jest.fn();
      const unsub = broadcaster.onCompleted(cb);
      unsub();
      broadcaster._onInternalCompleted({ cmd: 'HR', deviceId: '', isCompleted: true } as InBodyResult);
      expect(cb).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────
  // onError
  // ────────────────────────────────────────

  describe('onError / _onInternalError', () => {
    it('回调收到 Error 对象', () => {
      const cb = jest.fn();
      broadcaster.onError(cb);
      const err = new Error('timeout');
      broadcaster._onInternalError(err);
      expect(cb).toHaveBeenCalledWith(err);
    });

    it('取消后不触发', () => {
      const cb = jest.fn();
      const unsub = broadcaster.onError(cb);
      unsub();
      broadcaster._onInternalError(new Error('x'));
      expect(cb).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────
  // onWeight (via subscribe + broadcast)
  // ────────────────────────────────────────

  describe('onWeight', () => {
    it('HW 包广播时触发 weight 回调', () => {
      const cb = jest.fn();
      broadcaster.onWeight(cb);
      const hwResult = { cmd: 'HW', weight: 72.3, deviceId: '', isCompleted: false } as unknown as InBodyResult;
      broadcaster.broadcast(hwResult, mockParser);
      expect(cb).toHaveBeenCalledWith(72.3);
    });

    it('非 HW 包不触发 weight 回调', () => {
      const cb = jest.fn();
      broadcaster.onWeight(cb);
      const hmResult = { cmd: 'HM', progress: 50, deviceId: '', isCompleted: false } as unknown as InBodyResult;
      broadcaster.broadcast(hmResult, mockParser);
      expect(cb).not.toHaveBeenCalled();
    });

    it('取消后不触发', () => {
      const cb = jest.fn();
      const unsub = broadcaster.onWeight(cb);
      unsub();
      const hwResult = { cmd: 'HW', weight: 70, deviceId: '', isCompleted: false } as unknown as InBodyResult;
      broadcaster.broadcast(hwResult, mockParser);
      expect(cb).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────
  // onProgress
  // ────────────────────────────────────────

  describe('onProgress', () => {
    it('HM 包广播时触发 progress 回调', () => {
      const cb = jest.fn();
      broadcaster.onProgress(cb);
      const hmResult = { cmd: 'HM', progress: 60, deviceId: '', isCompleted: false } as unknown as InBodyResult;
      broadcaster.broadcast(hmResult, mockParser);
      expect(cb).toHaveBeenCalledWith(60);
    });

    it('HW 包不触发 progress 回调', () => {
      const cb = jest.fn();
      broadcaster.onProgress(cb);
      const hwResult = { cmd: 'HW', weight: 70, deviceId: '', isCompleted: false } as unknown as InBodyResult;
      broadcaster.broadcast(hwResult, mockParser);
      expect(cb).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────
  // onPosture
  // ────────────────────────────────────────

  describe('onPosture', () => {
    it('HP 包广播时触发 posture 回调', () => {
      const cb = jest.fn();
      broadcaster.onPosture(cb);
      const hpResult = { cmd: 'HP', statu: 1, deviceId: '', isCompleted: false } as unknown as InBodyResult;
      broadcaster.broadcast(hpResult, mockParser);
      expect(cb).toHaveBeenCalledWith(1);
    });
  });

  // ────────────────────────────────────────
  // subscribe / broadcast (原始包)
  // ────────────────────────────────────────

  describe('subscribe / broadcast', () => {
    it('原始 subscribe 收到每个广播包', () => {
      const cb = jest.fn();
      broadcaster.subscribe(cb);
      const result = { cmd: 'AK', deviceId: '', isCompleted: false } as unknown as InBodyResult;
      broadcaster.broadcast(result, mockParser);
      expect(cb).toHaveBeenCalledWith(result, mockParser);
    });

    it('取消后不再收到广播', () => {
      const cb = jest.fn();
      const unsub = broadcaster.subscribe(cb);
      unsub();
      broadcaster.broadcast({ cmd: 'AK', deviceId: '', isCompleted: false } as any, mockParser);
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
