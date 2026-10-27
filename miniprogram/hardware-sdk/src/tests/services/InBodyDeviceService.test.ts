import { InBodyDeviceService } from '../../application/services/InBodyDeviceService';
import { CommunicationRunner } from '../../infrastructure/engine/CommunicationRunner';
import { ParsedDataBroadcaster } from '../../infrastructure/engine/ParsedDataBroadcaster';
import { IBluetoothService } from '../../domain/ports/IBluetoothService';
import { InBodyDeviceState } from '../../domain/entities/InBodyDevice.entity';

// ────────────────────────────────────────
// Mocks
// ────────────────────────────────────────

function makeBluetoothService(deviceId = 'device-001'): jest.Mocked<IBluetoothService> {
  return {
    startScan:              jest.fn().mockResolvedValue(undefined),
    stopScan:               jest.fn().mockResolvedValue(undefined),
    connect:                jest.fn().mockResolvedValue(undefined),
    disconnect:             jest.fn().mockResolvedValue(undefined),
    isConnected:            jest.fn().mockReturnValue(true),
    getCurrentDeviceId:     jest.fn().mockReturnValue(deviceId),
    onAdapterStateChange:   jest.fn().mockReturnValue(() => {}),
    onConnectionStatusChange: jest.fn().mockReturnValue(() => {}),
    destroy:                jest.fn(),
    getActualServiceId:     jest.fn().mockReturnValue('service-001'),
    getActualWriteCharId:   jest.fn().mockReturnValue('char-001'),
    getActualWriteNoResponse: jest.fn().mockReturnValue(false),
    getDeviceType:          jest.fn().mockReturnValue('H30'),
  } as any;
}

function makeRunner(): jest.Mocked<CommunicationRunner> {
  return {
    startListening:         jest.fn(),
    setActiveDevice:        jest.fn(),
    sendRaw:                jest.fn().mockResolvedValue(undefined),
    executeSingle:          jest.fn(),
    runAutoMeasurement:     jest.fn().mockResolvedValue(undefined),
    destroy:                jest.fn(),
    activeDevice:           undefined,
  } as any;
}

function makeBroadcaster(): jest.Mocked<ParsedDataBroadcaster> {
  const unsubFn = jest.fn().mockReturnValue(() => {});
  return {
    onStateChange:          jest.fn().mockReturnValue(jest.fn()),
    onError:                jest.fn().mockReturnValue(jest.fn()),
    onCompleted:            jest.fn().mockReturnValue(jest.fn()),
    onWeight:               jest.fn().mockReturnValue(jest.fn()),
    onProgress:             jest.fn().mockReturnValue(jest.fn()),
    onPosture:              jest.fn().mockReturnValue(jest.fn()),
    _onInternalStateChange: jest.fn(),
    _onInternalCompleted:   jest.fn(),
    _onInternalError:       jest.fn(),
    subscribe:              jest.fn().mockReturnValue(jest.fn()),
    broadcast:              jest.fn(),
  } as any;
}

const PARAMS = { uid: 'u1', nickname: 'N', age: 30, height: 175, sex: 'M' as const };

// ────────────────────────────────────────
// 测试套件
// ────────────────────────────────────────

describe('InBodyDeviceService', () => {
  let btService: ReturnType<typeof makeBluetoothService>;
  let runner: ReturnType<typeof makeRunner>;
  let broadcaster: ReturnType<typeof makeBroadcaster>;
  let service: InBodyDeviceService;

  beforeEach(() => {
    btService   = makeBluetoothService();
    runner      = makeRunner();
    broadcaster = makeBroadcaster();
    service     = new InBodyDeviceService('H30', btService, runner, broadcaster);
  });

  // ────────────────────────────────────────
  // subscribe
  // ────────────────────────────────────────

  describe('subscribe', () => {
    it('传入全量 handlers 时各 broadcaster 方法均被调用', () => {
      service.subscribe({
        onStateChange: jest.fn(),
        onError:       jest.fn(),
        onCompleted:   jest.fn(),
        onWeight:      jest.fn(),
        onProgress:    jest.fn(),
        onPosture:     jest.fn(),
      } as any);

      expect(broadcaster.onStateChange).toHaveBeenCalledTimes(1);
      expect(broadcaster.onError).toHaveBeenCalledTimes(1);
      expect(broadcaster.onCompleted).toHaveBeenCalledTimes(1);
      expect(broadcaster.onWeight).toHaveBeenCalledTimes(1);
      expect(broadcaster.onProgress).toHaveBeenCalledTimes(1);
      expect(broadcaster.onPosture).toHaveBeenCalledTimes(1);
    });

    it('只传部分 handlers 时仅注册对应的 broadcaster', () => {
      service.subscribe({ onStateChange: jest.fn() });
      expect(broadcaster.onStateChange).toHaveBeenCalledTimes(1);
      expect(broadcaster.onError).not.toHaveBeenCalled();
      expect(broadcaster.onWeight).not.toHaveBeenCalled();
    });

    it('返回的 unsub 函数调用后取消所有注册的订阅', () => {
      const mockUnsub1 = jest.fn();
      const mockUnsub2 = jest.fn();
      broadcaster.onStateChange.mockReturnValue(mockUnsub1);
      broadcaster.onError.mockReturnValue(mockUnsub2);

      const unsub = service.subscribe({ onStateChange: jest.fn(), onError: jest.fn() });
      unsub();

      expect(mockUnsub1).toHaveBeenCalledTimes(1);
      expect(mockUnsub2).toHaveBeenCalledTimes(1);
    });
  });

  // ────────────────────────────────────────
  // startAutoMeasurement
  // ────────────────────────────────────────

  describe('startAutoMeasurement', () => {
    it('成功时: 不触发 _onInternalError', async () => {
      runner.runAutoMeasurement.mockResolvedValue(undefined);
      await service.startAutoMeasurement(PARAMS);
      expect(broadcaster._onInternalError).not.toHaveBeenCalled();
    });

    it('runner 抛出错误时: 通过 _onInternalError 广播', async () => {
      const err = new Error('设备超时');
      runner.runAutoMeasurement.mockRejectedValue(err);

      await expect(service.startAutoMeasurement(PARAMS)).rejects.toThrow('设备超时');
      expect(broadcaster._onInternalError).toHaveBeenCalledWith(err);
    });

    it('runner 抛出非 Error 时: 包装成 Error 后广播', async () => {
      runner.runAutoMeasurement.mockRejectedValue('string_error');

      await expect(service.startAutoMeasurement(PARAMS)).rejects.toThrow();
      const [broadcastedErr] = (broadcaster._onInternalError as jest.Mock).mock.calls[0];
      expect(broadcastedErr).toBeInstanceOf(Error);
    });

    it('链路未连接时 (getCurrentDeviceId 返回空) 直接抛错', async () => {
      btService.getCurrentDeviceId.mockReturnValue('');
      await expect(service.startAutoMeasurement(PARAMS)).rejects.toThrow('尚未绑定任何设备');
    });

    it('向 runner 传入正确的 device context', async () => {
      runner.runAutoMeasurement.mockResolvedValue(undefined);
      await service.startAutoMeasurement(PARAMS);
      expect(runner.setActiveDevice).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: 'device-001', type: 'H30' })
      );
    });
  });

  // ────────────────────────────────────────
  // call
  // ────────────────────────────────────────

  describe('call', () => {
    it('转发给 runner.executeSingle', async () => {
      const mockResult = { cmd: 'AK', deviceId: '', isCompleted: false } as any;
      runner.executeSingle.mockResolvedValue(mockResult);

      const result = await service.call('AK');
      expect(runner.executeSingle).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: 'device-001' }),
        'AK',
        undefined
      );
      expect(result).toBe(mockResult);
    });
  });

  // ────────────────────────────────────────
  // destroy
  // ────────────────────────────────────────

  describe('destroy', () => {
    it('调用 runner.destroy', () => {
      service.destroy();
      expect(runner.destroy).toHaveBeenCalledTimes(1);
    });
  });
});
