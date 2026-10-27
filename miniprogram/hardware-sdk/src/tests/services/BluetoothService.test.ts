import { BluetoothService } from '../../application/services/BluetoothService';
import { IBluetoothAdapter } from '../../domain/ports/IBluetoothAdapter';
import { InBodyDevice } from '../../domain/entities/InBodyDevice.entity';

// ────────────────────────────────────────
// 通用 Mock Repo 工厂
// ────────────────────────────────────────

interface MockRepo extends jest.Mocked<IBluetoothAdapter> {
  __triggerConnState: (deviceId: string, connected: boolean) => void;
}

function makeRepo(): MockRepo {
  let connStateCb: ((deviceId: string, connected: boolean) => void) | null = null;

  return {
    initAdapter:          jest.fn().mockResolvedValue(undefined),
    setTargetType:        jest.fn(),
    stopScan:             jest.fn().mockResolvedValue(undefined),
    scanForDevices:       jest.fn().mockResolvedValue(undefined),
    connectDevice:        jest.fn().mockResolvedValue(undefined),
    disconnectDevice:     jest.fn().mockResolvedValue(undefined),
    getServices:          jest.fn().mockResolvedValue(['service-001']),
    getCharacteristics:   jest.fn().mockResolvedValue([
      {
        uuid: 'char-001',
        properties: { read: false, write: true, writeNoResponse: false, notify: true, indicate: false },
      },
    ]),
    writeData:            jest.fn().mockResolvedValue(undefined),
    notifyCharacteristic: jest.fn().mockResolvedValue(undefined),
    getConnectedDevices:  jest.fn().mockResolvedValue([]),
    onDataReceived:       jest.fn().mockReturnValue(() => {}),
    onConnectionStateChange: jest.fn().mockImplementation(cb => {
      connStateCb = cb;
      return () => { connStateCb = null; };
    }),
    onAdapterStateChange: jest.fn().mockReturnValue(() => {}),
    __triggerConnState: (deviceId: string, connected: boolean) => connStateCb?.(deviceId, connected),
  } as unknown as MockRepo;
}

const TARGET_DEVICE: InBodyDevice = {
  deviceId: 'device-001',
  name: 'InBody H30',
  type: 'H30',
};

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

// ────────────────────────────────────────
// 测试套件
// ────────────────────────────────────────

describe('BluetoothService', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: BluetoothService;

  beforeEach(() => {
    repo = makeRepo();
    service = new BluetoothService(repo, 'H30');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ────────────────────────────────────────
  // startScan
  // ────────────────────────────────────────

  describe('startScan', () => {
    it('rejects when native discovery fails instead of leaving the scan promise pending', async () => {
      repo.scanForDevices.mockRejectedValueOnce(new Error('discovery failed'));
      await expect(service.startScan(undefined, 1000)).rejects.toThrow('discovery failed');
    });

    it('does not begin discovery after cancellation during adapter initialization', async () => {
      let ready!: () => void;
      repo.initAdapter.mockReturnValueOnce(new Promise<void>(resolve => { ready = resolve; }));
      const scanning = service.startScan(undefined, 1000);
      await flushMicrotasks();
      await service.stopScan();
      ready();
      await expect(scanning).resolves.toEqual([]);
      expect(repo.scanForDevices).not.toHaveBeenCalled();
    });

    it('settles an active scan even when native stop fails', async () => {
      const scanning = service.startScan(undefined, 0);
      await flushMicrotasks();
      repo.stopScan.mockRejectedValueOnce(new Error('stop failed'));
      await expect(service.stopScan()).rejects.toThrow('stop failed');
      await expect(scanning).resolves.toEqual([]);
    });

    it('调用 initAdapter 和 scanForDevices', async () => {
      const onDevice = jest.fn();
      const scanPromise = service.startScan(onDevice, 0);
      await flushMicrotasks();
      expect(repo.initAdapter).toHaveBeenCalledTimes(1);
      expect(repo.scanForDevices).toHaveBeenCalledTimes(1);
      const [registeredCallback] = repo.scanForDevices.mock.calls[0];
      registeredCallback(TARGET_DEVICE);
      expect(onDevice).toHaveBeenCalledWith(TARGET_DEVICE);
      await service.stopScan();
      await scanPromise;
    });

    it('timeoutMs=0 时不启动定时器', async () => {
      jest.useFakeTimers();
      const scanPromise = service.startScan(jest.fn(), 0);
      await flushMicrotasks();
      jest.advanceTimersByTime(60_000);
      // startScan 会先停止旧扫描；timeoutMs=0 不会再由定时器追加触发
      expect(repo.stopScan).toHaveBeenCalledTimes(1);
      await service.stopScan();
      await scanPromise;
    });

    it('定时器到期后自动调用 stopScan', async () => {
      jest.useFakeTimers();
      const scanPromise = service.startScan(jest.fn(), 500);
      await flushMicrotasks();
      jest.advanceTimersByTime(600);
      await flushMicrotasks();
      expect(repo.stopScan).toHaveBeenCalledTimes(2);
      await scanPromise;
    });

    it('第二次 startScan 清除第一次定时器，stopScan 只在第二次定时器到期时触发一次', async () => {
      jest.useFakeTimers();

      const firstScan = service.startScan(jest.fn(), 1000);  // 定时器 A: 1000ms
      await flushMicrotasks();
      repo.stopScan.mockClear();
      jest.advanceTimersByTime(200);

      const secondScan = service.startScan(jest.fn(), 1000);  // 定时器 B: 1000ms（此时清除了 A）
      await firstScan;
      await flushMicrotasks();
      repo.stopScan.mockClear();
      jest.advanceTimersByTime(900);

      // A 本应在整体 1000ms 处触发，但已被清除
      expect(repo.stopScan).not.toHaveBeenCalled();

      jest.advanceTimersByTime(200); // 超过 B 的 1000ms 到期
      await flushMicrotasks();
      expect(repo.stopScan).toHaveBeenCalledTimes(1);
      await secondScan;
    });
  });

  // ────────────────────────────────────────
  // stopScan
  // ────────────────────────────────────────

  describe('stopScan', () => {
    it('调用 repo.stopScan', async () => {
      await service.stopScan();
      expect(repo.stopScan).toHaveBeenCalledTimes(1);
    });

    it('取消正在等待的扫描定时器', async () => {
      jest.useFakeTimers();
      const scanPromise = service.startScan(jest.fn(), 5000);
      await flushMicrotasks();
      repo.stopScan.mockClear();
      await service.stopScan();
      jest.advanceTimersByTime(6000);
      // 定时器被取消，只有上面 stopScan() 的 1 次调用
      expect(repo.stopScan).toHaveBeenCalledTimes(1);
      await scanPromise;
    });
  });

  // ────────────────────────────────────────
  // connect
  // ────────────────────────────────────────

  describe('connect', () => {
    it('先调用 stopScan 再连接（清除定时器）', async () => {
      jest.useFakeTimers();
      const scanPromise = service.startScan(jest.fn(), 10_000); // 定时器 A 已设置
      await flushMicrotasks();
      repo.stopScan.mockClear();

      // connect 内部有 setTimeout 延迟，切换回真实定时器以便 await 可以完成
      jest.useRealTimers();
      await service.connect(TARGET_DEVICE); // 调用 stopScan → 清除定时器 A
      await scanPromise;

      // stopScan 被调用：仅 connect 内部的一次，定时器 A 已被 stopScan 清除
      expect(repo.stopScan).toHaveBeenCalledTimes(1);
    });

    it('按顺序调用 connectDevice → getServices → notifyCharacteristic', async () => {
      const order: string[] = [];
      repo.connectDevice.mockImplementation(async () => { order.push('connect'); });
      repo.getServices.mockImplementation(async () => { order.push('getServices'); return []; });
      repo.notifyCharacteristic.mockImplementation(async () => { order.push('notify'); });

      await expect(service.connect(TARGET_DEVICE)).rejects.toThrow('未在任何服务中找到');
      expect(order).toEqual(['connect', 'getServices']);
    });

    it('连接成功后 isConnected() 返回 true', async () => {
      await service.connect(TARGET_DEVICE);
      expect(service.isConnected()).toBe(true);
    });

    it('支持传入 deviceId 字符串', async () => {
      await service.connect('device-001');
      expect(repo.connectDevice).toHaveBeenCalledWith('device-001');
    });

    it('notifyCharacteristic 使用 H30 正确的服务/特征 UUID', async () => {
      await service.connect(TARGET_DEVICE);
      const [, serviceUuid, charUuid, enabled] = (repo.notifyCharacteristic as jest.Mock).mock.calls[0];
      expect(typeof serviceUuid).toBe('string');
      expect(serviceUuid.length).toBeGreaterThan(0);
      expect(enabled).toBe(true);
    });
  });

  // ────────────────────────────────────────
  // disconnect
  // ────────────────────────────────────────

  describe('disconnect', () => {
    it('连接后断开: 调用 disconnectDevice 并设 isConnected=false', async () => {
      await service.connect(TARGET_DEVICE);
      expect(service.isConnected()).toBe(true);

      await service.disconnect();
      expect(repo.disconnectDevice).toHaveBeenCalledWith(TARGET_DEVICE.deviceId);
      expect(service.isConnected()).toBe(false);
    });

    it('未连接时 disconnect 不调用 disconnectDevice', async () => {
      await service.disconnect();
      expect(repo.disconnectDevice).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────
  // isConnected / onConnectionStatusChange
  // ────────────────────────────────────────

  describe('isConnected', () => {
    it('初始状态为 false', () => {
      expect(service.isConnected()).toBe(false);
    });

    it('设备意外断线时 isConnected 变为 false', async () => {
      await service.connect(TARGET_DEVICE);
      expect(service.isConnected()).toBe(true);

      // 模拟底层上报断线
      repo.__triggerConnState(TARGET_DEVICE.deviceId, false);
      expect(service.isConnected()).toBe(false);
    });

    it('其他 deviceId 的状态变化不影响当前 isConnected', async () => {
      await service.connect(TARGET_DEVICE);
      repo.__triggerConnState('other-device', false);
      expect(service.isConnected()).toBe(true);
    });
  });

  describe('onConnectionStatusChange', () => {
    it('注册的回调收到连接状态事件', async () => {
      const cb = jest.fn();
      service.onConnectionStatusChange(cb);
      repo.__triggerConnState('device-001', true);
      expect(cb).toHaveBeenCalledWith('device-001', true);
    });
  });

  // ────────────────────────────────────────
  // destroy
  // ────────────────────────────────────────

  describe('destroy', () => {
    it('已连接时 destroy 调用 disconnectDevice', async () => {
      await service.connect(TARGET_DEVICE);
      service.destroy();
      expect(repo.disconnectDevice).toHaveBeenCalledWith(TARGET_DEVICE.deviceId);
    });

    it('未连接时 destroy 不调用 disconnectDevice', () => {
      service.destroy();
      expect(repo.disconnectDevice).not.toHaveBeenCalled();
    });

    it('destroy 取消扫描定时器，不再触发 stopScan', async () => {
      jest.useFakeTimers();
      const scanPromise = service.startScan(jest.fn(), 5000);
      await flushMicrotasks();
      repo.stopScan.mockClear();
      service.destroy(); // 应取消定时器
      await scanPromise;
      jest.advanceTimersByTime(6000);
      // destroy 调了 stopScan 一次（通过 this.stopScan()），之后定时器不再触发
      expect(repo.stopScan).toHaveBeenCalledTimes(1);
    });
  });

  // ────────────────────────────────────────
  // getCurrentDeviceId
  // ────────────────────────────────────────

  describe('getCurrentDeviceId', () => {
    it('连接后返回 deviceId', async () => {
      await service.connect(TARGET_DEVICE);
      expect(service.getCurrentDeviceId()).toBe(TARGET_DEVICE.deviceId);
    });

    it('连接前返回空字符串', () => {
      expect(service.getCurrentDeviceId()).toBe('');
    });
  });
});
