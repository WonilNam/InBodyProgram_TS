import { WxBluetoothAdapter } from './src/infrastructure/adapters/WxBluetoothAdapter';
import { H30ProtocolParser } from './src/infrastructure/protocols/parsers/H30ProtocolParser';
import { InBody120ProtocolParser } from './src/infrastructure/protocols/parsers/120ProtocolParser';
import { H20ProtocolParser } from './src/infrastructure/protocols/parsers/H20ProtocolParser';
import { ProtocolManager } from './src/infrastructure/protocols/ProtocolManager';
import { InBodyDevice, InBodyDeviceType, DeviceCapability, DEVICE_CAPABILITIES } from './src/domain/entities/InBodyDevice.entity';
import { ParsedDataBroadcaster } from './src/infrastructure/engine/ParsedDataBroadcaster';
import { DeviceServiceFactory } from './src/application/DeviceServiceFactory';
import { BluetoothService } from './src/application/services/BluetoothService';
import { InBodyError, InBodyErrorCode } from './src/domain/value-objects/InBodyError';
import { IBluetoothService } from './src/domain/ports/IBluetoothService';
import { IBluetoothSetupAdapter } from './src/domain/ports/IBluetoothAdapter';
import { H30OtaService } from './src/application/services/H30OtaService';
import { IBaseDeviceEvents, IDeviceService, IPostureFeature, IProgressFeature, IWeightFeature, IWifiDeviceService } from './src/domain/ports/IDeviceService';
import { DataConfirmRequest, DataDeleteRequest, DeviceRequest, StartMeasurementRequest } from './src/domain/entities/DeviceRequest.entity';
import { InBodyResult } from './src/domain/entities/DeviceResponse.entity';

// --- 1. 初始化基层资产 ---
const bluetoothRepo = new WxBluetoothAdapter();
let protocolManager = new ProtocolManager(
  new InBody120ProtocolParser(),
  new H20ProtocolParser(),
  new H30ProtocolParser()
);
let broadcaster = new ParsedDataBroadcaster();

// --- 2. 运行时 Facade 状态 ---
type SDKSubscribeHandlers = IBaseDeviceEvents & Partial<IWeightFeature & IProgressFeature & IPostureFeature>;
type ActiveDeviceService = IDeviceService<SDKSubscribeHandlers> & IWifiDeviceService;
type PublicCommandData = DeviceRequest | Record<string, unknown>;

let _bluetoothService: IBluetoothService | null = null;
let _deviceService: ActiveDeviceService | null = null;
let _currentDeviceType: InBodyDeviceType = 'UNKNOWN';

/**
 * 递归清洗数据：剥离 deviceId, cmd, isCompleted 等底层字段
 */
function _clean(result: unknown): unknown {
  if (!result) return result;
  if (Array.isArray(result)) return result.map(item => _clean(item));
  if (typeof result !== 'object') return result;

  const { deviceId, isCompleted, cmd, ...data } = result as Record<string, unknown>;
  for (const key in data) {
    if (data[key] && typeof data[key] === 'object') {
      data[key] = _clean(data[key]);
    }
  }
  return data;
}

/**
 * 型号能力校验
 */
function _requireCap(cap: DeviceCapability): void {
  const caps = DEVICE_CAPABILITIES[_currentDeviceType];
  if (!caps || !caps.has(cap)) {
    throw new InBodyError(InBodyErrorCode.UNSUPPORTED, `[SDK] 不支持 ${cap}`);
  }
}

function _getBle(): IBluetoothService {
  if (!_bluetoothService) throw new Error("[SDK] 未初始化！");
  return _bluetoothService;
}

function _getDev(): ActiveDeviceService {
  if (!_deviceService) throw new Error("[SDK] 未初始化！");
  return _deviceService;
}

// --- 3. 核心接口导出 ---

export function init(deviceType: InBodyDeviceType) {
  _currentDeviceType = deviceType;
  
  // 销毁旧实例，清理监听器防止跨型号数据污染
  if (broadcaster) broadcaster.destroy();
  if (_bluetoothService) _bluetoothService.destroy();
  if (_deviceService) _deviceService.destroy();

  // Old asynchronous runners keep their own broadcaster and parser buffers.
  broadcaster = new ParsedDataBroadcaster();
  protocolManager = new ProtocolManager(
    new InBody120ProtocolParser(), new H20ProtocolParser(), new H30ProtocolParser()
  );

  _bluetoothService = new BluetoothService(bluetoothRepo, deviceType);
  const factory = new DeviceServiceFactory(_bluetoothService, bluetoothRepo, protocolManager, broadcaster);
  _deviceService = factory.createService(deviceType) as ActiveDeviceService;
}

export const scan = async (onDeviceFound?: (device: InBodyDevice) => void, timeoutMs?: number) => {
  return _getBle().startScan(onDeviceFound, timeoutMs);
};

export const stopScan = () => _getBle().stopScan();

export const connect = (deviceId: string | InBodyDevice) => _getBle().connect(deviceId);

export const disconnect = () => _getBle().disconnect();

export const onConnectionStateChange = (cb: (connected: boolean) => void) =>
  _getBle().onConnectionStatusChange((_id: string, connected: boolean) => cb(connected));

export const onAdapterStateChange = (cb: (available: boolean) => void) =>
  _getBle().onAdapterStateChange((available: boolean) => cb(available));

export const subscribe = (handlers: SDKSubscribeHandlers) => {
  const wrapped: SDKSubscribeHandlers = {};
  for (const key in handlers) {
    const handler = handlers[key as keyof SDKSubscribeHandlers];
    if (typeof handler === 'function') {
      (wrapped as Record<string, unknown>)[key] = (data: InBodyResult) => {
        (handler as (value: unknown) => void)(key === 'onError' ? data : _clean(data));
      };
    }
  }
  return _getDev().subscribe(wrapped);
};

export const startAutoMeasurement = (params: StartMeasurementRequest) => _getDev().startAutoMeasurement(params);

export const call = async (action: string, data?: PublicCommandData) =>
  _clean(await _getDev().call(action, data));

// --- 4. 语义化指令接口 ---

export const checkConnection = async () => {
  _requireCap(DeviceCapability.DEVICE_QUERY);
  return _clean(await _getDev().call('AK', { syncTime: true }));
};

export const setCompleteRegistration = async () => {
  _requireCap(DeviceCapability.DEVICE_QUERY);
  return _clean(await _getDev().call('AK'));
};

export const getStatus = async () => {
  _requireCap(DeviceCapability.DEVICE_QUERY);
  return _clean(await _getDev().call('SR'));
};

// --- 5. 用户管理接口 ---

export const registerUser = async (uid: string, nickName: string) => {
  _requireCap(DeviceCapability.USER_MGMT);
  return _clean(await _getDev().call('HO', {
    UID: uid,
    nickName
  }));
};

export const getUserList = async () => {
  _requireCap(DeviceCapability.USER_MGMT);
  return _clean(await _getDev().call('UL'));
};

export const initUserList = async () => {
  _requireCap(DeviceCapability.USER_MGMT);
  return _clean(await _getDev().call('UI'));
};

type DeleteUserItem = DataDeleteRequest['userList'][number] & { uid?: string };

export const deleteUser = async (users: DeleteUserItem[]) => {
  _requireCap(DeviceCapability.USER_MGMT);
  const userList = users.map(user => ({
    UID: user.UID ?? user.uid ?? '',
    nickName: user.nickName ?? ''
  }));

  return _clean(await _getDev().call('DD', { userList }));
};

export const infoChange = async (uid: string, nickName: string, sex: 'M' | 'F', age: number, height: number) => {
  _requireCap(DeviceCapability.USER_MGMT); // Reclassified to user mgmt logic
  return _clean(await _getDev().call('IC', { UID: uid, nickName, sex, age, height }));
};

export const setPersonalInfo = async (sex: 'M' | 'F', age: number, height: number, weight?: number, pbf?: number, slm?: number) => {
  _requireCap(DeviceCapability.MEASURE_CTRL);
  return _clean(await _getDev().call('HI', { sex, age, height, weight, pbf, slm }));
};


// --- 6. 设备配置接口 ---



export const setSoundOnOff = async (isOn: boolean) => {
  _requireCap(DeviceCapability.DEVICE_CONFIG);
  return _clean(await _getDev().call('HO', { sound: isOn ? 1 : 0 }));
};

export const setUnit = async (unit: number) => {
  _requireCap(DeviceCapability.DEVICE_CONFIG);
  return _clean(await _getDev().call('HO', { unit }));
};

export const setLanguage = async (lang: number) => {
  _requireCap(DeviceCapability.DEVICE_CONFIG);
  return _clean(await _getDev().call('HO', { language: lang }));
};

export const setWifiUsage = async (isOn: boolean) => {
  _requireCap(DeviceCapability.DEVICE_CONFIG);
  return _clean(await _getDev().call('HO', { wifiUsage: isOn ? 1 : 0 }));
};

export const setPowerSaveMode = async (enable: number, mode: number) => {
  _requireCap(DeviceCapability.DEVICE_CONFIG);
  return _clean(await _getDev().call('HO', { powerSaveModeEnable: enable, powerSaveMode: mode }));
};

export const setApiUrl = async (url: string) => {
  _requireCap(DeviceCapability.DEVICE_CONFIG);
  return _clean(await _getDev().call('HO', { url }));
};

// --- 7. 网络与测量接口 ---

export const wifiScan = async () => {
  _requireCap(DeviceCapability.WIFI);
  return _clean(await _getDev().wifiScan());
};

export const wifiSet = async (SSID: string, password?: string, url: string = '') => {
  _requireCap(DeviceCapability.WIFI);
  return _clean(await _getDev().call('WI', { SSID, password: password || '', url }));
};

export const wifiSetV2 = async (SSID: string, password?: string, url: string = '') => {
  _requireCap(DeviceCapability.WIFI);
  return _clean(await _getDev().call('WA', { SSID, password: password || '', url }));
};




export const setCancelMeasure = async () => {
  _requireCap(DeviceCapability.MEASURE_CTRL);
  return _clean(await _getDev().call('MC'));
};

// --- 8. 离线数据管理接口 ---

export const setDataKind = async (kind: number) => {
  _requireCap(DeviceCapability.OFFLINE_DATA);
  return _clean(await _getDev().call('DK', { kind }));
};

export const getOfflineDataCount = async (uid: string, nickName: string) => {
  _requireCap(DeviceCapability.OFFLINE_DATA);
  return _clean(await _getDev().call('DR', { UID: uid, nickName }));
};

export const getOfflineData = async (uid: string, nickName: string, index: number) => {
  _requireCap(DeviceCapability.OFFLINE_DATA);
  return _clean(await _getDev().call('UT', { UID: uid, nickName, index }));
};

export const manipulateData = async (uid: string, nickName: string, saveResult: DataConfirmRequest['saveResult']) => {
  _requireCap(DeviceCapability.OFFLINE_DATA);
  return _clean(await _getDev().call('DC', { UID: uid, nickName, saveResult }));
};

export { InBodyErrorCode, InBodyError };

// --- 5. 设备设置 / OTA 流程使用的底层能力 ---

/**
 * The single shared Bluetooth adapter. Setup flows (Wi-Fi, nickname, OTA) must use this instead of
 * registering their own wx listeners: the adapter owns the one set of native listeners, and a
 * flow that is not active simply unsubscribes.
 */
export const getSetupBluetoothAdapter = (): IBluetoothSetupAdapter => bluetoothRepo;

export const createOtaService = () => new H30OtaService(bluetoothRepo);

export { H30_OTA } from './src/application/services/H30OtaService';
export type { FirmwareImage, FirmwareSendOptions } from './src/application/services/H30OtaService';
