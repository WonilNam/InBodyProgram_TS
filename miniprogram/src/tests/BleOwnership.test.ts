import { H30SetupSession } from '../application/services/H30SetupSession';
import { H30SetupCodec } from '../infrastructure/ble/H30SetupCodec';
import { H30_OTA, H30OtaService } from '../../hardware-sdk/src/application/services/H30OtaService';
import { InBodyDevice } from '../../hardware-sdk/src/domain/entities/InBodyDevice.entity';
import { IBluetoothSetupAdapter } from '../../hardware-sdk/src/domain/ports/IBluetoothAdapter';
import { InBodyError, InBodyErrorCode } from '../../hardware-sdk/src/domain/value-objects/InBodyError';
import { H30Transport, toPlatformError } from '../infrastructure/ble/H30Transport';

const COMMAND_SERVICE = '6E400001-B5A3-F393-E0A9-E50E24DCCA9E';
const mockParser = jest.fn((): string | undefined => 'AK');
function fakeCodec() {
  return {
    getReadInbodyData: () => mockParser(),
    sendAK: () => new Uint8Array([0xaa]).buffer,
    setHOCommand: () => {},
    GetAKResponse: () => ({ programVersion: 'H30.1' }),
    DFUInfo: { currentVersion: '', isUpdateFirmWare: false, isUpdateImage: false, FileURL_Firmware: '', FileURL_Image: '' },
    onFirmwareUpdateFailCallback: null as (() => void) | null,
  };
}

type DataListener = (deviceId: string, characteristicId: string, payload: ArrayBuffer) => void;
type ConnListener = (deviceId: string, connected: boolean) => void;
type AdapterListener = (available: boolean, discovering: boolean) => void;

/** A fake of the SDK's shared adapter that records subscriptions and lets tests fire radio events. */
function fakeRadio() {
  const data = new Set<DataListener>();
  const conn = new Set<ConnListener>();
  const state = new Set<AdapterListener>();
  let found: ((device: InBodyDevice) => void) | null = null;
  const radio = {
    initAdapter: jest.fn().mockResolvedValue(undefined),
    closeAdapter: jest.fn().mockResolvedValue(undefined),
    setTargetType: jest.fn(),
    stopScan: jest.fn().mockResolvedValue(undefined),
    scanForDevices: jest.fn(async (cb: (device: InBodyDevice) => void) => { found = cb; }),
    connectDevice: jest.fn().mockResolvedValue(undefined),
    disconnectDevice: jest.fn().mockResolvedValue(undefined),
    getServices: jest.fn().mockResolvedValue([COMMAND_SERVICE]),
    getCharacteristics: jest.fn().mockResolvedValue([
      { uuid: 'cmd-char', properties: { read: true, write: true, notify: true } },
    ]),
    readCharacteristic: jest.fn().mockResolvedValue(undefined),
    notifyCharacteristic: jest.fn().mockResolvedValue(undefined),
    writeData: jest.fn().mockResolvedValue(undefined),
    getConnectedDevices: jest.fn().mockResolvedValue([]),
    onDataReceived: jest.fn((cb: DataListener) => { data.add(cb); return () => data.delete(cb); }),
    onConnectionStateChange: jest.fn((cb: ConnListener) => { conn.add(cb); return () => conn.delete(cb); }),
    onAdapterStateChange: jest.fn((cb: AdapterListener) => { state.add(cb); return () => state.delete(cb); }),
  };
  return {
    radio,
    adapter: radio as unknown as IBluetoothSetupAdapter,
    listeners: { data, conn, state },
    emitData: (value = new ArrayBuffer(1)) => data.forEach(cb => cb('dev', 'char', value)),
    emitConnection: (connected: boolean) => conn.forEach(cb => cb('dev', connected)),
    emitAdapter: (available: boolean) => state.forEach(cb => cb(available, false)),
    discover: (device: Partial<InBodyDevice>) => found?.({ deviceId: 'dev', name: 'InBodyH30-0001', type: 'H30', ...device } as InBodyDevice),
  };
}

const flush = async () => { for (let i = 0; i < 25; i++) await Promise.resolve(); };
describe('H30Transport', () => {
  it('delivers radio events to the attached handlers and stops after detach', () => {
    const r = fakeRadio();
    const transport = new H30Transport(r.adapter);
    const handlers = { onData: jest.fn(), onConnectionChange: jest.fn(), onAdapterState: jest.fn() };
    transport.attach(handlers);
    r.emitData(); r.emitConnection(false); r.emitAdapter(true);
    expect(handlers.onData).toHaveBeenCalledTimes(1);
    expect(handlers.onConnectionChange).toHaveBeenCalledWith('dev', false);
    expect(handlers.onAdapterState).toHaveBeenCalledWith(true);
    transport.detach();
    r.emitData(); r.emitConnection(true); r.emitAdapter(false);
    expect(handlers.onData).toHaveBeenCalledTimes(1);
    expect(transport.attached).toBe(false);
  });

  it('replaces the previous subscription when attached again instead of stacking listeners', () => {
    const r = fakeRadio();
    const transport = new H30Transport(r.adapter);
    const handlers = { onData: jest.fn(), onConnectionChange: jest.fn(), onAdapterState: jest.fn() };
    transport.attach(handlers);
    transport.attach(handlers);
    transport.attach(handlers);
    expect(r.listeners.data.size).toBe(1);
    r.emitData();
    expect(handlers.onData).toHaveBeenCalledTimes(1);
  });

  it('prepares the command channel: only known services, reads and notifies, ignores the OTA write characteristic', async () => {
    const r = fakeRadio();
    r.radio.getServices.mockResolvedValue(['0000FFFF-0000-1000-8000-00805F9B34FB', COMMAND_SERVICE, H30_OTA.SERVICE_UUID]);
    r.radio.getCharacteristics.mockImplementation(async (_d: string, service: string) =>
      service === H30_OTA.SERVICE_UUID
        ? [{ uuid: 'ota-char', properties: { write: true, notify: true } }]
        : [{ uuid: 'cmd-char', properties: { read: true, write: true, notify: true } }]);
    const channel = await new H30Transport(r.adapter).prepareChannel('dev');
    expect(channel).toEqual({ serviceId: COMMAND_SERVICE, characteristicId: 'cmd-char' });
    expect(r.radio.getCharacteristics).not.toHaveBeenCalledWith('dev', '0000FFFF-0000-1000-8000-00805F9B34FB');
    expect(r.radio.readCharacteristic).toHaveBeenCalledWith('dev', COMMAND_SERVICE, 'cmd-char');
    expect(r.radio.notifyCharacteristic).toHaveBeenCalledWith('dev', COMMAND_SERVICE, 'cmd-char', true);
    expect(r.radio.notifyCharacteristic).toHaveBeenCalledWith('dev', H30_OTA.SERVICE_UUID, 'ota-char', true);
  });

  it('keeps arming the remaining characteristics when one fails, and reports no channel when none can be written', async () => {
    const r = fakeRadio();
    r.radio.getCharacteristics.mockResolvedValue([
      { uuid: 'a', properties: { notify: true } },
      { uuid: 'b', properties: { notify: true } },
    ]);
    r.radio.notifyCharacteristic.mockRejectedValueOnce(new Error('busy'));
    expect(await new H30Transport(r.adapter).prepareChannel('dev')).toBeNull();
    expect(r.radio.notifyCharacteristic).toHaveBeenCalledTimes(2);
  });

  it('sets the scan target before scanning and maps every failure to the legacy error shape', async () => {
    const r = fakeRadio();
    await new H30Transport(r.adapter).startDiscovery('H40', () => {});
    expect(r.radio.setTargetType).toHaveBeenCalledWith('H40');
    const sdkError = new InBodyError(InBodyErrorCode.ABNORMALERROR, 'x', { errCode: 10001, errMsg: 'not available' });
    expect(toPlatformError(sdkError)).toEqual({ errCode: 10001, errMsg: 'not available' });
    expect(toPlatformError({ errCode: 10022, errMsg: 'gps' })).toEqual({ errCode: 10022, errMsg: 'gps' });
    expect(toPlatformError(new Error('plain'))).toEqual({ errCode: undefined, errMsg: 'plain' });
  });
});

function fakePlatform() {
  const stored: Record<string, unknown> = {};
  const sound = { stop: jest.fn(), destroy: jest.fn() };
  const platform = {
    globals: jest.fn(() => ({})),
    getStored: jest.fn((key: string) => stored[key] ?? ''),
    setStored: jest.fn((key: string, value: unknown) => { stored[key] = value; }),
    currentRoute: jest.fn(() => ''),
    navigateTo: jest.fn(),
    redirectToHome: jest.fn(),
    showLoading: jest.fn(),
    hideLoading: jest.fn(),
    showModal: jest.fn(async () => ({ confirm: false })),
    openAppSettings: jest.fn(),
    playSound: jest.fn(() => sound),
    postJson: jest.fn(async () => ({})),
    pickFirmwareFile: jest.fn(async () => 'ABC'),
  };
  return { platform, stored, sound };
}

describe('H30SetupSession on the shared SDK radio', () => {
  let r: ReturnType<typeof fakeRadio>;
  let p: ReturnType<typeof fakePlatform>;
  let legacy: H30SetupSession;
  let ota: { start: jest.Mock; end: jest.Mock; sendFirmware: jest.Mock };
  let codec: ReturnType<typeof fakeCodec>;

  beforeEach(() => {
    jest.useFakeTimers();
    r = fakeRadio();
    p = fakePlatform();
    ota = { start: jest.fn().mockResolvedValue(undefined), end: jest.fn().mockResolvedValue(undefined), sendFirmware: jest.fn().mockResolvedValue(0) };
    codec = fakeCodec();
    legacy = new H30SetupSession(p.platform, new H30Transport(r.adapter), ota as unknown as H30OtaService, codec as unknown as H30SetupCodec);
    mockParser.mockReset().mockReturnValue('AK');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('only subscribes to the shared adapter; it has no way to register native listeners itself', async () => {
    legacy.connectEquipSetting();
    await flush();
    expect(r.listeners.data.size).toBe(1);
    expect(r.listeners.conn.size).toBe(1);
  });

  it('opens, scans for the stored target model, connects, arms the channel and sends AK for the settings flow', async () => {
    p.stored.ConnectEquip = 'H40';
    legacy.connectEquipSetting();
    await flush();
    expect(r.radio.initAdapter).toHaveBeenCalledTimes(1);
    expect(r.radio.setTargetType).toHaveBeenCalledWith('H40');
    r.discover({ deviceId: 'dev-h40', name: 'InBodyH40-0002', type: 'H40' });
    await flush();
    expect(r.radio.connectDevice).toHaveBeenCalledWith('dev-h40');
    expect(r.radio.writeData).toHaveBeenCalledWith('dev-h40', COMMAND_SERVICE, 'cmd-char', expect.any(ArrayBuffer));
    expect(legacy.BTConf.connected).toBe(true);
    expect(p.stored[legacy.BTConf.deviceKey]).toBe('dev-h40');
  });

  it('ignores advertisements of other models and a second hit once one device was chosen', async () => {
    legacy.connectEquipSetting();
    await flush();
    r.discover({ deviceId: 'other', name: 'InBodyH20-0003', type: 'H20' });
    await flush();
    expect(r.radio.connectDevice).not.toHaveBeenCalled();
    r.discover({ deviceId: 'first' });
    r.discover({ deviceId: 'second' });
    await flush();
    expect(r.radio.connectDevice).toHaveBeenCalledTimes(1);
    expect(r.radio.connectDevice).toHaveBeenCalledWith('first');
  });

  it('routes device notifications into the protocol state machine', async () => {
    legacy.connectEquipSetting();
    await flush();
    const handle = jest.spyOn(legacy as unknown as { handleProtocolCommand(cmd: string | undefined): void }, 'handleProtocolCommand').mockImplementation(() => {});
    r.emitData();
    expect(mockParser).toHaveBeenCalledTimes(1);
    expect(handle).toHaveBeenCalledWith('AK');
  });

  it('hands the radio to a measurement: stops listening, scanning, sound and the link', async () => {
    legacy.connectEquipSetting();
    await flush();
    legacy.BTConf.deviceId = 'old-device';
    legacy.BTConf.audioPlayer = p.sound;
    await legacy.pauseForMeasurement();
    mockParser.mockClear();
    r.emitData();
    r.emitConnection(false);
    expect(mockParser).not.toHaveBeenCalled();
    expect(r.listeners.data.size).toBe(0);
    expect(r.radio.stopScan).toHaveBeenCalled();
    expect(r.radio.disconnectDevice).toHaveBeenCalledWith('old-device');
    expect(p.sound.stop).toHaveBeenCalledTimes(1);
    expect(legacy.BTConf.connected).toBe(false);
    expect(legacy.BTConf.processCase).toBe(0);
  });

  it('abandons a connection that completes after a measurement took over', async () => {
    let finishConnect!: () => void;
    r.radio.connectDevice.mockReturnValue(new Promise<void>(resolve => { finishConnect = resolve; }));
    legacy.connectEquipSetting();
    await flush();
    r.discover({});
    await flush();
    await legacy.pauseForMeasurement();
    r.radio.writeData.mockClear();
    r.radio.getServices.mockClear();
    finishConnect();
    await flush();
    expect(r.radio.getServices).not.toHaveBeenCalled();
    expect(r.radio.writeData).not.toHaveBeenCalled();
    expect(legacy.BTConf.connected).toBe(false);
    expect(p.platform.showModal).not.toHaveBeenCalled();
  });

  it('listens again when a setup flow starts after a measurement', async () => {
    legacy.connectEquipSetting();
    await flush();
    await legacy.pauseForMeasurement();
    expect(r.listeners.data.size).toBe(0);
    legacy.connectEquipSetting();
    await flush();
    expect(r.listeners.data.size).toBe(1);
  });

  it('explains a switched-off Bluetooth adapter when opening fails', async () => {
    r.radio.initAdapter.mockRejectedValue(new InBodyError(InBodyErrorCode.ABNORMALERROR, 'boom', { errCode: 10001, errMsg: 'openBluetoothAdapter:fail not available' }));
    legacy.connectEquipSetting();
    await flush();
    expect(p.platform.showModal).toHaveBeenCalledWith(expect.objectContaining({ content: expect.stringContaining('蓝牙开关'), showCancel: false }));
    expect(r.radio.closeAdapter).toHaveBeenCalled();
  });

  it('offers the system settings when Bluetooth permission was denied, and opens them on confirm', async () => {
    p.platform.showModal.mockResolvedValue({ confirm: true });
    r.radio.initAdapter.mockRejectedValue(new InBodyError(InBodyErrorCode.ABNORMALERROR, 'boom', { errCode: 10000, errMsg: 'bluetooth auth deny' }));
    legacy.connectEquipSetting();
    await flush();
    expect(p.platform.showModal).toHaveBeenCalledWith(expect.objectContaining({ confirmText: '去设置', showCancel: true }));
    expect(p.platform.openAppSettings).toHaveBeenCalledTimes(1);
  });

  it('reports a connection failure instead of hanging when the scan cannot start', async () => {
    r.radio.scanForDevices.mockRejectedValue(new Error('scan failed'));
    legacy.connectEquipSetting();
    await flush();
    expect(p.platform.showModal).toHaveBeenCalledWith(expect.objectContaining({ content: '连接失败！' }));
  });

  it('gives up with a failure when no device shows up before the discovery timeout', async () => {
    legacy.connectEquipSetting();
    await flush();
    jest.advanceTimersByTime(legacy.BTConf.discoveryTimeout + 1);
    await flush();
    expect(r.radio.stopScan).toHaveBeenCalled();
    expect(p.platform.showModal).toHaveBeenCalledWith(expect.objectContaining({ content: '连接失败！' }));
  });

  it('closes the link and reports failure when the physical connection fails', async () => {
    r.radio.connectDevice.mockRejectedValue(new Error('133'));
    legacy.connectEquipSetting();
    await flush();
    r.discover({});
    await flush();
    expect(r.radio.disconnectDevice).toHaveBeenCalledWith('dev');
    expect(p.platform.showModal).toHaveBeenCalledWith(expect.objectContaining({ content: '连接失败！' }));
    expect(legacy.BTConf.connected).toBe(false);
  });

  it('sends a measurement through the page-driven connect flow and opens the connecting page', () => {
    p.stored.ConnectEquip = 'H40';
    legacy.startInBodyTest();
    expect(p.platform.navigateTo).toHaveBeenCalledWith(expect.stringContaining('equip=InBodyDial H40'));
  });

  it('returns to the home page when a measurement-time connection fails', async () => {
    r.radio.scanForDevices.mockRejectedValue(new Error('scan failed'));
    legacy.startInBodyTest();
    await flush();
    expect(p.platform.redirectToHome).toHaveBeenCalledTimes(1);
  });

  describe('firmware version check', () => {
    it('asks the update service through the platform and caches the answer on the codec', async () => {
      p.platform.postJson.mockResolvedValue({ Data: { CurrentVersion: 'H30.2', IsUpdate_Firmware: true, FileURL_Firmware: 'https://fw/bin' } });
      legacy.getFirmwareVersion();
      await flush();
      expect(p.platform.postJson).toHaveBeenCalledWith(
        'https://wechat.lookinbody.cn/Main/CheckUpdateFirmwareDial',
        { AppName: 'InBodyH30', firmwareVersion: 'H30.27.05.08.00.1201M1' }
      );
      expect(codec.DFUInfo).toMatchObject({ currentVersion: 'H30.2', isUpdateFirmWare: true, isUpdateImage: false, FileURL_Firmware: 'https://fw/bin' });
    });

    it('swallows a failed check instead of raising an unhandled rejection', async () => {
      p.platform.postJson.mockRejectedValue(new Error('offline'));
      legacy.getFirmwareVersion();
      await flush();
      expect(codec.DFUInfo.currentVersion).toBe('');
    });
  });

  describe('firmware update', () => {
    it('starts and ends a transfer through the SDK OTA service on the connected device', () => {
      legacy.BTConf.deviceId = 'dev-ota';
      legacy.startOTAWrite();
      legacy.endOTAWrite();
      expect(ota.start).toHaveBeenCalledWith('dev-ota');
      expect(ota.end).toHaveBeenCalledWith('dev-ota');
    });

    it('streams the chosen file through the OTA service', async () => {
      legacy.BTConf.deviceId = 'dev-ota';
      await legacy.writeOTAFile();
      expect(p.platform.pickFirmwareFile).toHaveBeenCalledTimes(1);
      expect(ota.sendFirmware).toHaveBeenCalledWith('dev-ota', 'ABC');
    });

    it('does not send anything when no firmware file was chosen', async () => {
      p.platform.pickFirmwareFile.mockRejectedValue(new Error('未选择固件文件'));
      await expect(legacy.writeOTAFile()).rejects.toThrow('未选择固件文件');
      expect(ota.sendFirmware).not.toHaveBeenCalled();
    });

    it('reports a failed update-start through the protocol failure callback', async () => {
      const onFail = jest.fn();
      codec.onFirmwareUpdateFailCallback = onFail;
      ota.start.mockRejectedValue(new Error('no link'));
      legacy.updateFirmwareFile();
      await flush();
      expect(onFail).toHaveBeenCalledTimes(1);
    });
  });
});

describe('H30SetupCodec', () => {
  it('builds real setup commands through the SDK parser, and each instance keeps its own state', () => {
    const a = new H30SetupCodec();
    const b = new H30SetupCodec();
    expect(a.sendAK().byteLength).toBeGreaterThan(0);
    expect(a.sendUL().byteLength).toBeGreaterThan(0);
    a.setHOCommand({ nickName: 'Alice', UID: 'A' });
    expect(a.HOCommand.nickName).toBe('Alice');
    expect(b.HOCommand.nickName).not.toBe('Alice');
  });
});

describe('OTA wiring', () => {
  it('uses the same UUIDs the legacy adapter exposed', () => {
    expect(H30_OTA.SERVICE_UUID).toBe('1D14D6EE-FD63-4FA1-BFA4-8F47B42119F0');
    expect(H30_OTA.CONTROL_UUID).toBe('F7BF3564-FB6D-4E53-88A4-5E37E0326063');
    expect(H30_OTA.DATA_UUID).toBe('984227F3-34FC-4045-A5D0-2C581F81A153');
  });
});
