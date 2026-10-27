import * as hardwareSdk from '../../../hardware-sdk/index';
import { InBodyDevice } from '../../../hardware-sdk/src/domain/entities/InBodyDevice.entity';

type Sdk = typeof hardwareSdk;

/** Where the device calls the app back once it has Wi-Fi; written into HO and Wi-Fi commands. */
export const SETUP_API_URL = 'https://inbodyapiv3.lookinbody.cn';
/** The WI/WA response code the device reports when it joined the network (ASCII "0"). */
export const WIFI_JOINED_CODE = 48;

export interface SetupGlobals {
  UID?: string | null;
  nickName?: string;
  InBodyUserInfo?: { Gender?: string; Age?: number; Height?: number };
}

/** The few things the setup pages need from the host app, so this class stays testable. */
export interface H30SetupHost {
  globals(): SetupGlobals;
  /** Model the user picked on the equipment list. */
  targetType(): 'H30' | 'H40';
}

/** Device status as reported by `AK`. */
export interface DeviceStatus {
  serialNumber?: string;
  programVersion?: string;
  ssid?: string;
  wifiStatus?: number;
  unit?: number;
  sound?: number;
  wifiUsageVariable?: number;
  [key: string]: unknown;
}

export interface DeviceUser {
  uid?: string;
  nickName: string;
  lastMeasurement?: string;
  pendingDataCount?: number;
}

/** A Wi-Fi hotspot in the field names the setup page templates use. */
export interface WifiHotspot {
  SSID: string;
  SSIDLength: number;
  MacAddr: string;
  NetworkMode: number;
  Security: number;
  Channel: number;
  Rssi: number;
}

interface SdkWifiItem {
  ssid?: string;
  macAddr?: string;
  networkMode?: number;
  security?: number;
  channel?: number;
  rssi?: number;
}

const stripNul = (value: unknown): string => String(value ?? '').replace(/\0/g, '');

/**
 * What the H30/H40 setup pages share between screens: which device they are talking to, its last
 * reported status and its user list. Every device operation is a plain awaited SDK call; the pages
 * decide what happens next.
 */
export class H30Setup {
  status: DeviceStatus | null = null;
  userList: DeviceUser[] = [];
  device: InBodyDevice | null = null;
  /** SSID the device is (or was just set up to be) connected to. */
  ssid = '';

  constructor(
    private readonly host: H30SetupHost,
    private readonly sdk: Sdk = hardwareSdk
  ) {}

  /** Finds the chosen model nearby, connects, and reads its status. */
  async connect(timeoutMs = 20000): Promise<DeviceStatus> {
    const type = this.host.targetType();
    this.sdk.init(type);
    let found: InBodyDevice | undefined;
    const devices = await this.sdk.scan((candidate) => {
      if (!found && candidate.type === type) {
        found = candidate;
        void this.sdk.stopScan();
      }
    }, timeoutMs);
    const device = found ?? devices.find(candidate => candidate.type === type);
    if (!device) throw new Error('未搜索到附近的 InBody 设备，请确认设备已开启');
    await this.sdk.connect(device);
    this.device = device;
    return this.readStatus();
  }

  /** Re-reads status and users, reconnecting from scratch if the link or session was lost. */
  async refresh(): Promise<DeviceStatus> {
    let status: DeviceStatus;
    try {
      if (!this.device) throw new Error('not connected');
      status = await this.readStatus();
    } catch {
      status = await this.connect();
    }
    await this.loadUsers();
    return status;
  }

  async readStatus(): Promise<DeviceStatus> {
    const status = (await this.sdk.checkConnection()) as DeviceStatus;
    status.ssid = stripNul(status.ssid);
    this.status = status;
    this.ssid = status.ssid;
    return status;
  }

  async loadUsers(): Promise<DeviceUser[]> {
    const response = (await this.sdk.getUserList()) as { userList?: DeviceUser[] };
    this.userList = response.userList ?? [];
    return this.userList;
  }

  /** Registers the app user (UID and nickname in the app globals) on the device. */
  async register(nickName: string): Promise<DeviceStatus> {
    await this.readStatus();
    await this.sdk.call('HO', this.settingsFor({ nickName }));
    return this.readStatus();
  }

  /** Changes unit / sound / Wi-Fi usage, resending the device's other settings unchanged. */
  async applySetting(change: { unit?: number; sound?: number; wifiUsage?: number }): Promise<void> {
    await this.sdk.call('HO', this.settingsFor(change));
    if (!this.status) return;
    if (change.unit !== undefined) this.status.unit = change.unit;
    if (change.sound !== undefined) this.status.sound = change.sound;
    if (change.wifiUsage !== undefined) this.status.wifiUsageVariable = change.wifiUsage;
  }

  async scanWifi(): Promise<WifiHotspot[]> {
    const found = ((await this.sdk.wifiScan()) ?? []) as SdkWifiItem[];
    return found.map(item => ({
      SSID: item.ssid ?? '',
      SSIDLength: (item.ssid ?? '').length,
      MacAddr: item.macAddr ?? '',
      NetworkMode: item.networkMode ?? 0,
      Security: item.security ?? 0,
      Channel: item.channel ?? 0,
      Rssi: item.rssi ?? 0,
    }));
  }

  /** Joins a network; resolves with the device's result code (`WIFI_JOINED_CODE` on success). */
  async connectWifi(ssid: string, password: string): Promise<number> {
    const response = (this.supportsLongWifiPassword()
      ? await this.sdk.wifiSetV2(ssid, password, SETUP_API_URL)
      : await this.sdk.wifiSet(ssid, password, SETUP_API_URL)) as { code?: number };
    return response.code ?? -1;
  }

  /** Newer firmware (the `WA` command) accepts passwords up to 63 characters instead of 20. */
  supportsLongWifiPassword(): boolean {
    const parts = (this.status?.programVersion || '').split('.');
    const minor = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    return minor >= (this.host.targetType() === 'H40' ? 51 : 41);
  }

  async disconnect(): Promise<void> {
    this.device = null;
    await this.sdk.disconnect();
  }

  /** Firmware transfer helper bound to the connected device. */
  firmware() {
    const ota = this.sdk.createOtaService();
    const deviceId = (): string => {
      if (!this.device) throw new Error('尚未连接设备');
      return this.device.deviceId;
    };
    return {
      /** Puts the device in update mode (`SV`); reconnect afterwards so the OTA service appears. */
      enterUpdateMode: () => this.sdk.call('SV'),
      begin: () => ota.start(deviceId()),
      send: (image: Parameters<typeof ota.sendFirmware>[1]) => ota.sendFirmware(deviceId(), image),
      end: () => ota.end(deviceId()),
    };
  }

  /** Full HO payload: the app user, the device's current settings, then the requested changes. */
  private settingsFor(overrides: Record<string, unknown>): Record<string, unknown> {
    const globals = this.host.globals();
    const user = globals.InBodyUserInfo ?? {};
    const status = this.status;
    return {
      nickName: globals.nickName ?? '',
      UID: globals.UID ?? '',
      sound: status?.sound,
      unit: status?.unit,
      wifiUsage: status?.wifiUsageVariable,
      sex: user.Gender ?? '',
      age: Number(user.Age || 0),
      height: Number(user.Height || 0),
      url: SETUP_API_URL,
      urlByteCount: SETUP_API_URL.length,
      rangeCountry: 1,
      ...overrides,
    };
  }
}

let shared: H30Setup | null = null;

/** The instance the setup pages share, wired to the WeChat app globals. */
export function getH30Setup(): H30Setup {
  if (!shared) {
    shared = new H30Setup({
      globals: () => getApp<{ globalData: SetupGlobals }>().globalData,
      targetType: () => (wx.getStorageSync('ConnectEquip') === 'H40' ? 'H40' : 'H30'),
    });
  }
  return shared;
}
