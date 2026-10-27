import { CommunicationRunner } from '../infrastructure/engine/CommunicationRunner';
import { ParsedDataBroadcaster } from '../infrastructure/engine/ParsedDataBroadcaster';
import { ProtocolManager } from '../infrastructure/protocols/ProtocolManager';
import { IBluetoothAdapter } from '../domain/ports/IBluetoothAdapter';
import { InBodyDevice, InBodyDeviceState } from '../domain/entities/InBodyDevice.entity';
import { InBodyResult } from '../domain/entities/DeviceResponse.entity';

// ────────────────────────────────────────
// Helpers
// ────────────────────────────────────────

/** 将所有待处理微任务全部排干，确保异步链完成 */
const flushPromises = () => new Promise<void>(resolve => setImmediate(resolve));

type DataCb = (deviceId: string, charId: string, payload: ArrayBuffer) => void;

interface MockRepo extends jest.Mocked<IBluetoothAdapter> {
  __fireData: (deviceId: string, charId: string, payload: ArrayBuffer) => void;
}

function makeRepo(): MockRepo {
  let dataCb: DataCb | null = null;
  return {
    initAdapter:          jest.fn().mockResolvedValue(undefined),
    setTargetType:        jest.fn(),
    stopScan:             jest.fn().mockResolvedValue(undefined),
    scanForDevices:       jest.fn().mockResolvedValue(undefined),
    connectDevice:        jest.fn().mockResolvedValue(undefined),
    disconnectDevice:     jest.fn().mockResolvedValue(undefined),
    getServices:          jest.fn().mockResolvedValue([]),
    getCharacteristics:   jest.fn().mockResolvedValue([]),
    writeData:            jest.fn().mockResolvedValue(undefined),
    notifyCharacteristic: jest.fn().mockResolvedValue(undefined),
    getConnectedDevices:  jest.fn().mockResolvedValue([]),
    onConnectionStateChange: jest.fn().mockReturnValue(() => {}),
    onAdapterStateChange: jest.fn().mockReturnValue(() => {}),
    onDataReceived: jest.fn().mockImplementation((cb: DataCb) => {
      dataCb = cb;
      return () => { dataCb = null; };
    }),
    __fireData: (deviceId: string, charId: string, payload: ArrayBuffer) => dataCb?.(deviceId, charId, payload),
  } as unknown as MockRepo;
}

/** 固定返回指定 result 的 mock parser */
function makeParser(fixedResult: InBodyResult) {
  return {
    parseIncomingData:    jest.fn().mockReturnValue(fixedResult),
    buildOutgoingCommand: jest.fn().mockReturnValue(new ArrayBuffer(8)),
    getExpectedResponseCmds: jest.fn().mockReturnValue(['AK']),
    evaluateTransition:   jest.fn(),
  };
}

function makeProtocolManager(parser: ReturnType<typeof makeParser>): jest.Mocked<ProtocolManager> {
  return {
    getParser:              jest.fn().mockReturnValue(parser),
    buildOut:               jest.fn().mockReturnValue(new ArrayBuffer(8)),
    getExpectedResponseCmds: jest.fn().mockReturnValue(['AK']),
    evaluateTransition:     jest.fn(),
    parseIn:                jest.fn(),
  } as any;
}

const DEVICE: InBodyDevice = { deviceId: 'dev-001', type: 'H30', name: 'InBody H30' };
const DEVICE_H20: InBodyDevice = { deviceId: 'dev-h20', type: 'H20', name: 'InBody H20' };
const DEVICE_120: InBodyDevice = { deviceId: 'dev-120', type: '120', name: 'InBody 120' };
const resolveChannel = () => ({
  deviceId: DEVICE.deviceId,
  deviceType: DEVICE.type,
  serviceId: 'service-001',
  writeCharId: 'char-001',
  writeNoResponse: false,
});

// ────────────────────────────────────────
// 测试套件
// ────────────────────────────────────────

describe('CommunicationRunner', () => {
  let repo: ReturnType<typeof makeRepo>;
  let broadcaster: ParsedDataBroadcaster;

  beforeEach(() => {
    repo        = makeRepo();
    broadcaster = new ParsedDataBroadcaster();
  });

  it('does not retry the measurement handshake after its runner is destroyed', async () => {
    jest.useFakeTimers();
    const parser = makeParser({ cmd: 'BUFFERING', deviceId: '', isCompleted: false } as any);
    const pm = makeProtocolManager(parser);
    const runner = new CommunicationRunner(repo, pm, broadcaster, resolveChannel);
    const pending = runner.runAutoMeasurement(DEVICE,
      { uid: 'A', age: 28, height: 165, sex: 'F' }, jest.fn(), jest.fn());
    const rejected = expect(pending).rejects.toThrow('destroyed');
    runner.destroy();
    await rejected;
    await jest.advanceTimersByTimeAsync(5000);
    expect(repo.writeData).toHaveBeenCalledTimes(1);
    await expect(runner.executeSingle(DEVICE, 'AK')).rejects.toThrow('disposed');
    expect(repo.writeData).toHaveBeenCalledTimes(1);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ────────────────────────────────────────
  // startListening
  // ────────────────────────────────────────

  describe('startListening', () => {
    it('构造时自动注册 onDataReceived', () => {
      const parser = makeParser({ cmd: 'AK', deviceId: '', isCompleted: false } as any);
      const pm = makeProtocolManager(parser);
      new CommunicationRunner(repo, pm, broadcaster, resolveChannel);
      expect(repo.onDataReceived).toHaveBeenCalledTimes(1);
    });

    it('重复调用 startListening 不重复注册', () => {
      const parser = makeParser({ cmd: 'AK', deviceId: '', isCompleted: false } as any);
      const pm = makeProtocolManager(parser);
      const runner = new CommunicationRunner(repo, pm, broadcaster, resolveChannel);
      runner.startListening(); // 第二次调用
      expect(repo.onDataReceived).toHaveBeenCalledTimes(1);
    });

    it('只处理 activeDevice 的数据，过滤其他 deviceId', () => {
      // 使用 BUFFERING 作为默认返回值，防止 drain 循环无限运行
      const bufferingResult = { cmd: 'BUFFERING', deviceId: '', isCompleted: false } as any;
      const parser = makeParser(bufferingResult);
      const pm = makeProtocolManager(parser);
      const runner = new CommunicationRunner(repo, pm, broadcaster, resolveChannel);
      runner.setActiveDevice(DEVICE);

      // 来自其他设备的数据：应被过滤，不调用 parseIncomingData
      repo.__fireData('other-device', 'char', new ArrayBuffer(8));
      expect(parser.parseIncomingData).not.toHaveBeenCalled();

      // 来自正确设备的数据：应被处理，调用 parseIncomingData 一次（返回 BUFFERING，循环立即退出）
      repo.__fireData(DEVICE.deviceId, 'char', new ArrayBuffer(8));
      expect(parser.parseIncomingData).toHaveBeenCalledTimes(1);
    });
  });

  // ────────────────────────────────────────
  // executeSingle (含 _settle)
  // ────────────────────────────────────────

  describe('executeSingle', () => {
    it('设备回包后 Promise resolve', async () => {
      const akResult = { cmd: 'AK', deviceId: '', isCompleted: false } as any;
      // 第一次调用（收到数据）返回 AK，之后（drain）返回 BUFFERING
      const parser = makeParser({ cmd: 'BUFFERING', deviceId: '', isCompleted: false } as any);
      parser.parseIncomingData
        .mockReturnValueOnce(akResult)   // 第一次: AK（进入循环，解析 awaiter）
        .mockReturnValue({ cmd: 'BUFFERING', deviceId: '', isCompleted: false }); // drain: BUFFERING

      const pm = makeProtocolManager(parser);
      const runner = new CommunicationRunner(repo, pm, broadcaster, resolveChannel);
      runner.setActiveDevice(DEVICE);
      pm.getExpectedResponseCmds.mockReturnValue(['AK']);

      const promise = runner.executeSingle(DEVICE, 'AK', undefined);

      // 模拟设备回包：第一次 parseIncomingData 返回 AK → awaiter 解析
      repo.__fireData(DEVICE.deviceId, 'char', new ArrayBuffer(8));

      const result = await promise;
      expect(result.cmd).toBe('AK');
    });

    it('等待超时时 reject', async () => {
      jest.useFakeTimers();
      const parser = makeParser({ cmd: 'BUFFERING', deviceId: '', isCompleted: false } as any);
      const pm = makeProtocolManager(parser);
      const runner = new CommunicationRunner(repo, pm, broadcaster, resolveChannel);
      runner.setActiveDevice(DEVICE);

      const promise = runner.executeSingle(DEVICE, 'AK', undefined);
      jest.advanceTimersByTime(11_000); // 超过 DEFAULT_TIMEOUT_MS (10_000)

      await expect(promise).rejects.toThrow('超时');
    });

    it('messageQueue 已有匹配结果时立即 resolve', async () => {
      const akResult = { cmd: 'AK', deviceId: '', isCompleted: false } as any;
      const parser = makeParser(akResult);
      // 先返回 AK（进入 messageQueue），再返回 BUFFERING
      parser.parseIncomingData
        .mockReturnValueOnce(akResult)
        .mockReturnValue({ cmd: 'BUFFERING', deviceId: '', isCompleted: false });

      const pm = makeProtocolManager(parser);
      const runner = new CommunicationRunner(repo, pm, broadcaster, resolveChannel);
      runner.setActiveDevice(DEVICE);

      // 先触发一次数据，让 AK 进入 messageQueue（没有 awaiter）
      repo.__fireData(DEVICE.deviceId, 'char', new ArrayBuffer(8));

      // 再调用 executeSingle，应从 queue 立即拿到结果
      const result = await runner.executeSingle(DEVICE, 'AK', undefined);
      expect(result.cmd).toBe('AK');
    });
  });

  describe('executeWifiScan', () => {
    it('WR 分包索引从 0 开始拉取，符合 legacy_js 协议', async () => {
      const parser = makeParser({ cmd: 'BUFFERING', deviceId: '', isCompleted: false } as any);
      const pm = makeProtocolManager(parser);
      const runner = new CommunicationRunner(repo, pm, broadcaster, resolveChannel);
      runner.setActiveDevice(DEVICE);

      jest.spyOn(runner as any, 'executeSingleWithTimeout')
        .mockResolvedValue({ cmd: 'WS', deviceId: '', isCompleted: false, count: 1 });
      const executeSingleSpy = jest.spyOn(runner, 'executeSingle')
        .mockResolvedValue({ cmd: 'WR', deviceId: '', isCompleted: false, packageCount: 1, wifiInfo: [{ ssid: 'Home 5G 中文 WiFi' }] } as any);

      const result = await runner.executeWifiScan(DEVICE);

      expect(executeSingleSpy).toHaveBeenCalledWith(DEVICE, 'WR', { packageIndex: 0 });
      expect(result).toEqual([{ ssid: 'Home 5G 中文 WiFi' }]);
    });
  });

  // ────────────────────────────────────────
  // destroy
  // ────────────────────────────────────────

  describe('destroy', () => {
    it('销毁后所有待 resolve 的 awaiter 都 reject', async () => {
      jest.useFakeTimers();
      const parser = makeParser({ cmd: 'BUFFERING', deviceId: '', isCompleted: false } as any);
      const pm = makeProtocolManager(parser);
      const runner = new CommunicationRunner(repo, pm, broadcaster, resolveChannel);
      runner.setActiveDevice(DEVICE);

      const p1 = runner.executeSingle(DEVICE, 'AK', undefined);
      const p2 = runner.executeSingle(DEVICE, 'SR', undefined);

      runner.destroy();

      await expect(p1).rejects.toThrow('destroyed');
      await expect(p2).rejects.toThrow('destroyed');
    });

    it('销毁后停止接收数据（rawDataUnsub 被调用）', () => {
      const parser = makeParser({ cmd: 'BUFFERING', deviceId: '', isCompleted: false } as any);
      const pm = makeProtocolManager(parser);
      const runner = new CommunicationRunner(repo, pm, broadcaster, resolveChannel);
      runner.setActiveDevice(DEVICE);
      runner.destroy();

      // 销毁后再触发数据，parser 不应被调用
      repo.__fireData(DEVICE.deviceId, 'char', new ArrayBuffer(8));
      expect(parser.parseIncomingData).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────
  // runAutoMeasurement
  // ────────────────────────────────────────

  describe('runAutoMeasurement', () => {
    it('启动时立即触发 onStateChange(INITIAL) 并以 AK 指令开启握手', async () => {
      const parser = makeParser({ cmd: 'BUFFERING', deviceId: '', isCompleted: false } as any);
      const pm = makeProtocolManager(parser);
      const runner = new CommunicationRunner(repo, pm, broadcaster, resolveChannel);
      runner.setActiveDevice(DEVICE);

      // spy executeSingle，让它永远不 resolve（只需要验证启动行为，不需要跑完整个状态机）
      const execSpy = jest.spyOn(runner, 'executeSingle')
        .mockReturnValue(new Promise(() => {}));

      const onStateChange = jest.fn();
      // 不 await：只需验证同步/首个微任务后的副作用
      runner.runAutoMeasurement(
        DEVICE,
        { uid: 'u1', nickname: 'N', age: 30, height: 175, sex: 'M' },
        onStateChange,
        jest.fn()
      );

      await Promise.resolve(); // 让 async 函数跑到第一个 await

      expect(onStateChange).toHaveBeenCalledWith(InBodyDeviceState.INITIAL);
      expect(execSpy).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: DEVICE.deviceId }),
        'AK',
        expect.anything()
      );

      runner.destroy(); // 清理挂起的 pending promise
    });

    it('InBody120 自动测量以 t 时间同步帧开启握手', async () => {
      const parser = makeParser({ cmd: 'BUFFERING', deviceId: '', isCompleted: false } as any);
      const pm = makeProtocolManager(parser);
      const runner = new CommunicationRunner(repo, pm, broadcaster, resolveChannel);
      runner.setActiveDevice(DEVICE_120);

      const execSpy = jest.spyOn(runner, 'executeSingle')
        .mockReturnValue(new Promise(() => {}));

      const onStateChange = jest.fn();
      runner.runAutoMeasurement(
        DEVICE_120,
        { uid: 'u1', nickname: 'N', age: 30, height: 175, sex: 'M' },
        onStateChange,
        jest.fn()
      );

      await Promise.resolve();

      expect(onStateChange).toHaveBeenCalledWith(InBodyDeviceState.INITIAL);
      expect(execSpy).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: DEVICE_120.deviceId }),
        't',
        expect.anything()
      );

      runner.destroy();
    });

    it('H20 自动测量以 HC 个人信息帧开启握手', async () => {
      const parser = makeParser({ cmd: 'BUFFERING', deviceId: '', isCompleted: false } as any);
      const pm = makeProtocolManager(parser);
      const runner = new CommunicationRunner(repo, pm, broadcaster, resolveChannel);
      runner.setActiveDevice(DEVICE_H20);

      const execSpy = jest.spyOn(runner, 'executeSingle')
        .mockReturnValue(new Promise(() => {}));

      const onStateChange = jest.fn();
      runner.runAutoMeasurement(
        DEVICE_H20,
        { uid: 'u1', nickname: 'N', age: 30, height: 175, sex: 'M' },
        onStateChange,
        jest.fn()
      );

      await Promise.resolve();

      expect(onStateChange).toHaveBeenCalledWith(InBodyDeviceState.INITIAL);
      expect(execSpy).toHaveBeenCalledWith(
        expect.objectContaining({ deviceId: DEVICE_H20.deviceId }),
        'HC',
        expect.anything()
      );

      runner.destroy();
    });

    it('evaluateTransition 返回 COMPLETED 时调用 onComplete 并结束', async () => {
      const akResult = { cmd: 'AK', deviceId: '', isCompleted: false } as any;
      const hrResult = { cmd: 'HR', deviceId: '', isCompleted: false } as any;

      const parser = makeParser({ cmd: 'BUFFERING', deviceId: '', isCompleted: false } as any);
      const pm = makeProtocolManager(parser);
      const runner = new CommunicationRunner(repo, pm, broadcaster, resolveChannel);
      runner.setActiveDevice(DEVICE);

      // spy executeSingle: 第一次(AK)返回 akResult，第二次返回 hrResult
      const execSpy = jest.spyOn(runner, 'executeSingle')
        .mockResolvedValueOnce(akResult);

      // evaluateTransition: 第一次返回 MEASUREMENT_STARTED + 下一步指令 HR，第二次返回 COMPLETED
      pm.evaluateTransition
        .mockReturnValueOnce({ nextState: InBodyDeviceState.MEASUREMENT_STARTED, nextCommand: { action: 'HR' } })
        .mockReturnValueOnce({ nextState: InBodyDeviceState.COMPLETED });

      // 第二次 executeSingle (HR 指令) → hrResult
      execSpy.mockResolvedValueOnce(hrResult);

      const onStateChange = jest.fn();
      const onComplete = jest.fn();

      await runner.runAutoMeasurement(
        DEVICE,
        { uid: 'u1', nickname: 'N', age: 30, height: 175, sex: 'M' },
        onStateChange,
        onComplete
      );

      expect(onStateChange).toHaveBeenCalledWith(InBodyDeviceState.MEASUREMENT_STARTED);
      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('状态机返回 FAILED 时立即 reject 测量流程', async () => {
      const errorResult = { cmd: 'e', deviceId: '', isCompleted: false } as any;

      const parser = makeParser({ cmd: 'BUFFERING', deviceId: '', isCompleted: false } as any);
      const pm = makeProtocolManager(parser);
      const runner = new CommunicationRunner(repo, pm, broadcaster, resolveChannel);
      runner.setActiveDevice(DEVICE_120);

      jest.spyOn(runner, 'executeSingle')
        .mockResolvedValueOnce(errorResult);

      pm.evaluateTransition
        .mockReturnValueOnce({ nextState: InBodyDeviceState.FAILED });

      const onStateChange = jest.fn();
      const onComplete = jest.fn();

      await expect(runner.runAutoMeasurement(
        DEVICE_120,
        { uid: 'u1', nickname: 'N', age: 30, height: 175, sex: 'M' },
        onStateChange,
        onComplete
      )).rejects.toThrow('设备返回测量失败指令: e');

      expect(onStateChange).toHaveBeenCalledWith(InBodyDeviceState.FAILED);
      expect(onComplete).not.toHaveBeenCalled();
    });
  });
});
