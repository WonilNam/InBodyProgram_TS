import type * as HardwareSdk from '../../hardware-sdk/index';
import { InBodyDevice } from '../../hardware-sdk/src/domain/entities/InBodyDevice.entity';
import { H30Setup, SETUP_API_URL, SetupGlobals, WIFI_JOINED_CODE } from '../application/services/H30Setup';

const H30: InBodyDevice = { deviceId: 'dev-h30', name: 'InBodyH30-0001', type: 'H30' };
const H20: InBodyDevice = { deviceId: 'dev-h20', name: 'InBodyH20-0002', type: 'H20' };

function harness(options: { type?: 'H30' | 'H40'; globals?: SetupGlobals } = {}) {
  const target: InBodyDevice = options.type === 'H40' ? { deviceId: 'dev-h40', name: 'InBodyH40-0003', type: 'H40' } : H30;
  const calls: string[] = [];
  const sdk = {
    init: jest.fn((type: string) => { calls.push(`init:${type}`); }),
    scan: jest.fn(async (onFound?: (d: InBodyDevice) => void) => { onFound?.(H20); onFound?.(target); return [H20, target]; }),
    stopScan: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    checkConnection: jest.fn().mockResolvedValue({
      serialNumber: 'SN1', programVersion: 'H30.45.01', ssid: 'Home\0\0', unit: 3, sound: 0, wifiUsageVariable: 1,
    }),
    getUserList: jest.fn().mockResolvedValue({ userList: [{ uid: 'A', nickName: 'Alice' }] }),
    call: jest.fn().mockResolvedValue({ cmd: 'HO' }),
    wifiScan: jest.fn().mockResolvedValue([{ ssid: 'Home', macAddr: 'aa:bb', networkMode: 0, security: 4, channel: 6, rssi: -40 }]),
    wifiSet: jest.fn().mockResolvedValue({ code: WIFI_JOINED_CODE }),
    wifiSetV2: jest.fn().mockResolvedValue({ code: WIFI_JOINED_CODE }),
  };
  const globals: SetupGlobals = options.globals ?? {
    UID: 'U-1', nickName: 'Alice', InBodyUserInfo: { Gender: 'F', Age: 28, Height: 165 },
  };
  const setup = new H30Setup({ globals: () => globals, targetType: () => options.type ?? 'H30' }, sdk as unknown as typeof HardwareSdk);
  return { setup, sdk, globals, calls };
}

describe('H30Setup', () => {
  describe('connect', () => {
    it('initialises for the chosen model, stops scanning at the first matching device and reads status', async () => {
      const h = harness();
      const status = await h.setup.connect();
      expect(h.sdk.init).toHaveBeenCalledWith('H30');
      expect(h.sdk.stopScan).toHaveBeenCalledTimes(1);
      expect(h.sdk.connect).toHaveBeenCalledWith(H30);
      expect(h.setup.device).toBe(H30);
      expect(status.serialNumber).toBe('SN1');
    });

    it('strips NUL padding from the SSID the device reports', async () => {
      const h = harness();
      await h.setup.connect();
      expect(h.setup.status?.ssid).toBe('Home');
      expect(h.setup.ssid).toBe('Home');
    });

    it('fails clearly when no device of that model is nearby, without connecting', async () => {
      const h = harness();
      h.sdk.scan.mockResolvedValue([H20]);
      await expect(h.setup.connect()).rejects.toThrow('未搜索到附近的 InBody 设备');
      expect(h.sdk.connect).not.toHaveBeenCalled();
      expect(h.setup.device).toBeNull();
    });

    it('does not connect to a connection failure silently', async () => {
      const h = harness();
      h.sdk.connect.mockRejectedValue(new Error('133'));
      await expect(h.setup.connect()).rejects.toThrow('133');
      expect(h.setup.device).toBeNull();
    });
  });

  describe('refresh', () => {
    it('reuses the existing link: status and users only, no scan', async () => {
      const h = harness();
      await h.setup.connect();
      h.sdk.init.mockClear();
      h.sdk.scan.mockClear();
      await h.setup.refresh();
      expect(h.sdk.scan).not.toHaveBeenCalled();
      expect(h.sdk.init).not.toHaveBeenCalled();
      expect(h.setup.userList).toEqual([{ uid: 'A', nickName: 'Alice' }]);
    });

    it('reconnects from scratch when the session was lost (for example after a measurement)', async () => {
      const h = harness();
      await h.setup.connect();
      h.sdk.checkConnection.mockRejectedValueOnce(new Error('NODEVICE'));
      h.sdk.init.mockClear();
      await h.setup.refresh();
      expect(h.sdk.init).toHaveBeenCalledWith('H30');
      expect(h.sdk.connect).toHaveBeenCalledTimes(2);
    });

    it('connects first when nothing was connected yet', async () => {
      const h = harness();
      await h.setup.refresh();
      expect(h.sdk.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe('device settings', () => {
    it('registers with the app user and the device\'s own settings, then re-reads status', async () => {
      const h = harness();
      await h.setup.connect();
      h.sdk.call.mockClear();
      h.sdk.checkConnection.mockClear();
      await h.setup.register('Alice');
      expect(h.sdk.call).toHaveBeenCalledWith('HO', expect.objectContaining({
        UID: 'U-1', nickName: 'Alice', sound: 0, unit: 3, wifiUsage: 1,
        sex: 'F', age: 28, height: 165, url: SETUP_API_URL, urlByteCount: SETUP_API_URL.length, rangeCountry: 1,
      }));
      expect(h.sdk.checkConnection).toHaveBeenCalledTimes(2);
    });

    it('never overwrites the device owner with blanks when only one setting changes', async () => {
      const h = harness();
      await h.setup.connect();
      await h.setup.applySetting({ unit: 0 });
      const sent = h.sdk.call.mock.calls[0][1] as Record<string, unknown>;
      expect(sent).toMatchObject({ UID: 'U-1', nickName: 'Alice', unit: 0, sound: 0, wifiUsage: 1 });
    });

    it('remembers each change so the next one keeps it', async () => {
      const h = harness();
      await h.setup.connect();
      await h.setup.applySetting({ sound: 1 });
      await h.setup.applySetting({ wifiUsage: 0 });
      const second = h.sdk.call.mock.calls[1][1] as Record<string, unknown>;
      expect(second).toMatchObject({ sound: 1, wifiUsage: 0, unit: 3 });
      expect(h.setup.status).toMatchObject({ sound: 1, wifiUsageVariable: 0 });
    });

    it('keeps the old values when the device rejects the change', async () => {
      const h = harness();
      await h.setup.connect();
      h.sdk.call.mockRejectedValue(new Error('timeout'));
      await expect(h.setup.applySetting({ unit: 0 })).rejects.toThrow('timeout');
      expect(h.setup.status?.unit).toBe(3);
    });

    it('falls back to empty owner fields for a guest instead of sending undefined', async () => {
      const h = harness({ globals: {} });
      await h.setup.connect();
      await h.setup.applySetting({ sound: 1 });
      expect(h.sdk.call.mock.calls[0][1]).toMatchObject({ UID: '', nickName: '', sex: '', age: 0, height: 0 });
    });
  });

  describe('wifi', () => {
    it('maps SDK hotspots to the field names the page templates use', async () => {
      const h = harness();
      expect(await h.setup.scanWifi()).toEqual([
        { SSID: 'Home', SSIDLength: 4, MacAddr: 'aa:bb', NetworkMode: 0, Security: 4, Channel: 6, Rssi: -40 },
      ]);
    });

    it('treats a missing scan result as no hotspots', async () => {
      const h = harness();
      h.sdk.wifiScan.mockResolvedValue(undefined);
      expect(await h.setup.scanWifi()).toEqual([]);
    });

    it('uses the long-password command on firmware that supports it, and the legacy one otherwise', async () => {
      const newer = harness();
      await newer.setup.connect(); // programVersion H30.45.01 -> 45 >= 41
      expect(await newer.setup.connectWifi('Home', 'p'.repeat(40))).toBe(WIFI_JOINED_CODE);
      expect(newer.sdk.wifiSetV2).toHaveBeenCalledWith('Home', 'p'.repeat(40), SETUP_API_URL);
      expect(newer.sdk.wifiSet).not.toHaveBeenCalled();

      const older = harness();
      await older.setup.connect();
      older.setup.status!.programVersion = 'H30.27.05';
      await older.setup.connectWifi('Home', 'secret');
      expect(older.sdk.wifiSet).toHaveBeenCalledWith('Home', 'secret', SETUP_API_URL);
    });

    it('applies a higher firmware threshold for the H40', async () => {
      const h = harness({ type: 'H40' });
      await h.setup.connect();
      h.setup.status!.programVersion = 'H40.45.00';
      expect(h.setup.supportsLongWifiPassword()).toBe(false);
      h.setup.status!.programVersion = 'H40.51.00';
      expect(h.setup.supportsLongWifiPassword()).toBe(true);
      h.setup.status!.programVersion = '';
      expect(h.setup.supportsLongWifiPassword()).toBe(false);
    });

    it('reports a failed join by its code rather than throwing', async () => {
      const h = harness();
      await h.setup.connect();
      h.sdk.wifiSetV2.mockResolvedValue({ code: 49 });
      expect(await h.setup.connectWifi('Home', 'wrong')).toBe(49);
    });
  });

  it('forgets the device on disconnect so the next refresh reconnects', async () => {
    const h = harness();
    await h.setup.connect();
    await h.setup.disconnect();
    expect(h.sdk.disconnect).toHaveBeenCalledTimes(1);
    expect(h.setup.device).toBeNull();
  });
});
