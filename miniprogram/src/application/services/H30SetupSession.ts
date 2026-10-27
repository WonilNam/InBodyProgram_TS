import * as DashboardBootstrapService from './DashboardBootstrapService';
import { H30SetupCodec, H30WifiItem } from '../../infrastructure/ble/H30SetupCodec';
import { ISetupPlatform, PlayingSound } from '../../domain/ports/ISetupPlatform';
import type * as HardwareSdk from '../../../hardware-sdk/index';
import { H30_OTA } from '../../../hardware-sdk/src/application/services/H30OtaService';
import type { H30OtaService } from '../../../hardware-sdk/src/application/services/H30OtaService';
import { H30Transport, toPlatformError } from '../../infrastructure/ble/H30Transport';

export const ProcessEnum = {
  REGISTER: 1,
  CONNECT: 2,
  SETUP_VALUE_CHANGE: 3,
  NICKNAME_ADD: 4,
  DELETE: 5,
  MEASURE: 6,
  MEASUREMENT_DATA_TRANSFER: 7,
  DATA_DELETE: 8,
  WIFI_SCAN: 9,
  SET_WIFI: 10,
  FIRMWARE_UPDATE: 11,
} as const;

export type ProcessType = (typeof ProcessEnum)[keyof typeof ProcessEnum] | 0;

/** The SDK registers its native listeners when first loaded, so load it on first use, not at import. */
function loadSdk(): typeof HardwareSdk {
  return require('../../../hardware-sdk/index');
}

export class H30SetupSession {
  /** Bumped whenever the radio is handed to a measurement; async work started before that bails out. */
  private epoch = 0;
  private transportInstance?: H30Transport;
  private otaInstance?: H30OtaService;

  constructor(
    private readonly platform: ISetupPlatform,
    transport?: H30Transport,
    ota?: H30OtaService,
    private readonly codec: H30SetupCodec = new H30SetupCodec()
  ) {
    this.transportInstance = transport;
    this.otaInstance = ota;
  }

  /** Open/connect failures already showed the user a dialog; don't also surface an unhandled rejection. */
  private readonly alreadyReported = (): void => {};

  private get transport(): H30Transport {
    return (this.transportInstance ??= new H30Transport(loadSdk().getSetupBluetoothAdapter()));
  }

  private get ota(): H30OtaService {
    return (this.otaInstance ??= loadSdk().createOtaService());
  }

  /** Starts receiving radio events. The transport never touches listeners other flows registered. */
  private attachTransport(): void {
    this.transport.attach({
      onData: value => this.handleNotification(value),
      onConnectionChange: (deviceId, connected) => this.handleConnectionChange(deviceId, connected),
      onAdapterState: available => {
        this.BTConf.isOpened = available;
        if (!available) this.BTConf.isFirstConnect = true;
      },
    });
  }

  private handleNotification(value: ArrayBuffer): void {
    const dataView = new DataView(value);
    const cmd = this.codec.getReadInbodyData(dataView, value.byteLength);
    this.handleProtocolCommand(cmd);
  }

  /** Hands the radio to the unified SDK: stop listening, stop scanning, drop the link. */
  public async pauseForMeasurement(): Promise<void> {
    this.epoch++;
    this.transport.detach();
    this.BTConf.processCase = 0;
    this.BTConf.connected = false;
    this.BTConf.isSearched = false;
    for (const timer of [this.BTConf.discoveryTimer, this.BTConf.connectTimer,
      this.BTConf.loadingTimer, this.BTConf.stableWeightTimer, this.BTConf.measureTimer,
      this.BTConf.postureTimer, this.BTConf.measuringTimer]) {
      clearTimeout(timer as ReturnType<typeof setTimeout>);
    }
    try { this.BTConf.audioPlayer.stop(); } catch { /* A previous prompt may have destroyed it. */ }
    const deviceId = this.BTConf.deviceId;
    await Promise.all([
      this.transport.stopDiscovery(),
      deviceId ? this.transport.disconnect(deviceId).catch(() => {}) : Promise.resolve(),
    ]);
  }
  public ProcessEnum = ProcessEnum;

  public BTConf = {
    devices: [] as Array<{ deviceId: string; name?: string }>,
    connected: false,
    chs: [] as Array<{ uuid: string; value: string }>,
    deviceId: '',
    serviceId: '',
    characteristicId: '',
    OTA_CONTROL_UUID: H30_OTA.CONTROL_UUID as string,
    OTA_SERVICE_UUID: H30_OTA.SERVICE_UUID as string,
    OTA_DATA_UUID: H30_OTA.DATA_UUID as string,
    deviceName: 'InBodyH30',
    name: '',
    deviceKey: 'InBodyBT',
    ssid: '',
    mtu: 255,
    isSearched: false,
    isBTCheck: false,
    isAuido: false,
    audioPlayer: { stop() {}, destroy() {} } as PlayingSound,
    isTestStart: false,
    isFirstConnect: true,
    isSVMode: false,
    Step: 0,
    TempInBodyData: '',
    Equip_Serial: '',
    discoveryTimeout: 20000,
    discoveryTimer: 0 as unknown as ReturnType<typeof setTimeout> | number,
    connectTimeout: 20000,
    connectTimer: 0 as unknown as ReturnType<typeof setTimeout> | number,
    loadingTimeout: 60000,
    loadingTimer: 0 as unknown as ReturnType<typeof setTimeout> | number,
    stableWeightTimeout: 1000,
    stableWeightTimer: 0 as unknown as ReturnType<typeof setTimeout> | number,
    measureTimeout: 10000,
    measureTimer: 0 as unknown as ReturnType<typeof setTimeout> | number,
    postureTimeout: 1000,
    postureTimer: 0 as unknown as ReturnType<typeof setTimeout> | number,
    measuringTimeout: 1000,
    measuringTimer: 0 as unknown as ReturnType<typeof setTimeout> | number,
    processCase: 0 as ProcessType,
    retryCount: 0,
    fileData: '',
    wifiResearchCount: 0,
    wifiReadIndex: 1,
    isOpened: false,
    isRegistered: false,
    isLoading: false,
    isPlayed: false,
  };

  public WRResponse = {
    count: 0,
    packageCount: 0,
    readIndex: 0,
    searchedWifiCount: 0,
    wifiInfo: [] as H30WifiItem[],
  };

  public HOCommand = {
    language: 0,
    unit: 0,
    sound: 1,
    UID: '',
    nickName: '',
    wifiUsage: 1,
    sex: '',
    age: 0,
    height: 0,
    rangeCountry: 1,
    urlByteCount: 4,
    url: 'NONE',
    powerSaveModeEnable: 0,
    powerSaveMode: 0,
    soundType: 0,
    soundVolume: 1,
  };

  public wifiInfo: H30WifiItem[] = [];

  public userList: Array<{
    uid?: string;
    UID: string;
    nickName: string;
    lastMeasurement: string;
    pendingDataCount: number;
  }> = [
    {
      UID: '',
      nickName: '',
      lastMeasurement: '000000',
      pendingDataCount: 0,
    },
  ];

  public onBluetoothConnectingCallback: (() => void) | null = null;
  public onBluetoothConnectedCallback: ((step?: string) => void) | null = null;
  public onBluetoothConnectFailCallback: ((ok: boolean) => void) | null = null;
  public onInBodyTestStartCallback: ((step: string) => void) | null = null;
  public onInBodyTestingCallback: ((progress: number) => void) | null = null;
  public onInBodyTestCompletedCallback: ((ok: boolean) => void) | null = null;
  public onSettingBluetoothConnectedCallback: ((res: unknown) => void) | null = null;
  public onSettingChangedCallback: ((ok: boolean) => void) | null = null;
  public onSetNickNameCallback: ((wifiUsage: number) => void) | null = null;
  public onWifiSearchCallback: ((res: unknown) => void) | null = null;
  public onWifiConnectCompletedCallback: ((code: number) => void) | null = null;
  public onUserInitializedCallback: (() => void) | null = null;

  public setOnBluetoothConnectingCallback(cb: () => void): void {
    this.onBluetoothConnectingCallback = cb;
  }
  public setOnBluetoothConnectedCallback(cb: (step?: string) => void): void {
    this.onBluetoothConnectedCallback = cb;
  }
  public setOnBluetoothConnectFailCallback(cb: (ok: boolean) => void): void {
    this.onBluetoothConnectFailCallback = cb;
  }
  public setOnInBodyTestStartCallback(cb: (step: string) => void): void {
    this.onInBodyTestStartCallback = cb;
  }
  public setOnInBodyTestingCallback(cb: (progress: number) => void): void {
    this.onInBodyTestingCallback = cb;
  }
  public setOnInBodyTestCompletedCallback(cb: (ok: boolean) => void): void {
    this.onInBodyTestCompletedCallback = cb;
  }
  public setOnSettingBluetoothConnectedCallback(cb: (res: unknown) => void): void {
    this.onSettingBluetoothConnectedCallback = cb;
  }
  public setOnSettingChangedCallback(cb: (ok: boolean) => void): void {
    this.onSettingChangedCallback = cb;
  }
  public setOnSetNickNameCallback(cb: (wifiUsage: number) => void): void {
    this.onSetNickNameCallback = cb;
  }
  public setOnWifiSearchCallback(cb: (res: unknown) => void): void {
    this.onWifiSearchCallback = cb;
  }
  public setOnWifiConnectCompletedCallback(cb: (code: number) => void): void {
    this.onWifiConnectCompletedCallback = cb;
  }
  public setOnUserInitializedCallback(cb: () => void): void {
    this.onUserInitializedCallback = cb;
  }

  public async openBluetoothAdapter(): Promise<unknown> {
    this.attachTransport();
    if (this.BTConf.processCase === this.ProcessEnum.SETUP_VALUE_CHANGE) {
      this.showLoading();
    }
    const epoch = this.epoch;
    try {
      await this.transport.open();
    } catch (err) {
      this.handleBluetoothError(toPlatformError(err));
      throw err;
    }
    if (epoch !== this.epoch) return undefined;
    this.BTConf.isOpened = true;
    return this.startBluetoothDevicesDiscovery();
  }

  public startBluetoothDevicesDiscovery(): void {
    const epoch = this.epoch;
    const target = this.platform.getStored('ConnectEquip') === 'H40' ? 'H40' : 'H30';
    const targetEquip = `InBody${target}`;
    this.transport.startDiscovery(target, (device) => {
      if (epoch !== this.epoch || this.BTConf.isSearched) {
        return;
      }
      const deviceName = device.name || '';
      this.BTConf.deviceName = targetEquip;
      if (!(deviceName === targetEquip || deviceName.includes(targetEquip))) {
        return;
      }
      this.BTConf.isSearched = true;
      void this.transport.stopDiscovery();
      clearTimeout(this.BTConf.discoveryTimer as ReturnType<typeof setTimeout>);
      try {
        this.platform.setStored(this.BTConf.deviceKey, device.deviceId);
      } catch {
        // ignore storage failure
      }
      this.BTConf.deviceId = device.deviceId;
      this.BTConf.name = deviceName;
      if (
        (!this.BTConf.connected && this.BTConf.isFirstConnect) ||
        this.BTConf.processCase === this.ProcessEnum.MEASURE
      ) {
        this.setConnectInbodyH30(device.deviceId, deviceName).catch(this.alreadyReported);
      }
    }).then(() => {
      if (epoch !== this.epoch || this.BTConf.isSearched) return;
      this.BTConf.discoveryTimer = setTimeout(() => {
        void this.transport.stopDiscovery();
        this.closeBLEConnection();
        this.closeBluetoothAdapter();
        this.failedCallback();
      }, this.BTConf.discoveryTimeout);
    }).catch(() => {
      if (epoch !== this.epoch) return;
      clearTimeout(this.BTConf.discoveryTimer as ReturnType<typeof setTimeout>);
      this.failedCallback();
    });
  }

  public setInBodyData(): void {
    const globalData = this.platform.globals();
    const userInfo = globalData.InBodyUserInfo || {};
    const d = this.codec.InBodyData;
    const payload = {
      UID: globalData.UID,
      DATETIMES: this.formatDate(),
      Gender: d.SEX === 1 ? 'M' : 'F',
      HT: d.HT,
      Age: d.AGE,
      WT: d.WT,
      PWT: d.PWT,
      SMM: d.SMM,
      SLM: d.SLM,
      PSMM: d.PSMM,
      PBF: d.PBF,
      IPBF: d.IPBF,
      PBF_MIN: d.PBF_MIN,
      PBF_MAX: d.PBF_MAX,
      BMI: d.BMI,
      IBMI: d.IBMI,
      BMI_MIN: d.BMI_MIN,
      BMI_MAX: d.BMI_MAX,
      VFALevel: d.VFALevel,
      IRA20: d.impedance20kHz_RA,
      ILA20: d.impedance20kHz_LA,
      IT20: d.impedance20KHz_T,
      IRL20: d.impedance20kHz_RL,
      ILL20: d.impedance20kHz_LL,
      IRA100: d.impedance100kHz_RA,
      ILA100: d.impedance100kHz_LA,
      IT100: d.impedance100kHz_T,
      IRL100: d.impedance100kHz_RL,
      ILL100: d.impedance100kHz_LL,
      TBW: d.TBW,
      TBW_MAX: d.TBW_MAX,
      TBW_MIN: d.TBW_MIN,
      MINERAL: d.MINERAL,
      MINERAL_MIN: d.MINERAL_MIN,
      MINERAL_MAX: d.MINERAL_MAX,
      PROTEIN: d.PROTEIN,
      PROTEIN_MIN: d.PROTEIN_MIN,
      PROTEIN_MAX: d.PROTEIN_MAX,
      WHR: d.WHR,
      IWHR: d.IWHR,
      WHR_MIN: d.WHR_MIN,
      WHR_MAX: d.WHR_MAX,
      BMC: d.BMC,
      BMC_MIN: d.BMC_MIN,
      BMC_MAX: d.BMC_MAX,
      BMR: d.BMR,
      BFM: d.BFM,
      IBFM: d.IBFM,
      WC: d.WC,
      MC: d.MC,
      FC: d.FC,
      FS: d.FS,
      Equip: this.BTConf.deviceName.includes('H30') ? 'H30' : 'H40',
      Equip_Serial: '',
      UserID: userInfo.TelHP || '',
      LoginID: userInfo.TelHP || '',
      ETYPE2: `000000000${d.bal_ups}${d.bal_lows}${d.bal_uls}000000`,
      INLL_LV: d.INLL_LV,
    };

    try {
      this.platform.setStored('tempData', payload);
      globalData.bluetoothdata = true;
    } catch {
      // ignore storage error
    }

    this.platform
      .postJson(`${globalData.serverUrl || 'https://wechat.lookinbody.cn'}/inbody/SetInBodyDataWeChat`, payload)
      .then((data) => {
        const body = (data || {}) as { IsSuccess?: boolean; Data?: unknown };
        if (body.IsSuccess) {
          DashboardBootstrapService.invalidate();
          const result = body.Data;
          if (Number.isNaN(Number(result)) && String(result).includes('NoEqupiMB')) {
            globalData.UID = String(result);
          }
          if (this.onInBodyTestCompletedCallback) {
            this.onInBodyTestCompletedCallback(true);
          }
          this.BTConf.audioPlayer = this.platform.playSound('/images/_done.mp3');
        }
      }, () => {
        const notifyFailed = () => {
          if (this.onInBodyTestCompletedCallback) {
            this.onInBodyTestCompletedCallback(false);
          }
        };
        void this.platform
          .showModal({ title: 'InBody', content: '无法保存InBody数据。', showCancel: false })
          .then(notifyFailed);
      })
      .catch(() => {});
  }

  public async setConnectInbodyH30(deviceId: string, devicename: string): Promise<void> {
    this.attachTransport();
    const epoch = this.epoch;
    if (
      this.ProcessEnum.MEASURE !== this.BTConf.processCase &&
      this.ProcessEnum.CONNECT !== this.BTConf.processCase
    ) {
      this.showLoading();
    }

    this.BTConf.connectTimer = setTimeout(() => {
      this.closeBLEConnection();
      this.failedCallback();
    }, this.BTConf.connectTimeout);

    try {
      await this.transport.connect(deviceId);
    } catch (err) {
      clearTimeout(this.BTConf.connectTimer as ReturnType<typeof setTimeout>);
      if (epoch !== this.epoch) return;
      this.closeBLEConnection();
      this.failedCallback();
      throw err;
    }
    // A measurement took over while connecting; it already cleared our timers and owns the radio.
    if (epoch !== this.epoch) return;

    this.BTConf.deviceId = deviceId;
    this.BTConf.deviceName = devicename;
    clearTimeout(this.BTConf.connectTimer as ReturnType<typeof setTimeout>);
    try {
      const channel = await this.transport.prepareChannel(deviceId);
      if (epoch !== this.epoch) return;
      if (channel) {
        this.BTConf.serviceId = channel.serviceId;
        this.BTConf.characteristicId = channel.characteristicId;
      }
    } catch (err) {
      if (epoch !== this.epoch) return;
      this.closeBLEConnection();
      this.failedCallback();
      throw err;
    }
    this.BTConf.isFirstConnect = false;
    this.BTConf.connected = true;
    if (this.BTConf.processCase === this.ProcessEnum.SETUP_VALUE_CHANGE) {
      this.sendAK();
    }
  }

  private handleConnectionChange(_deviceId: string, connected: boolean): void {
    if (connected) return;
    if (
      this.BTConf.processCase === this.ProcessEnum.MEASURE &&
      typeof this.onInBodyTestStartCallback === 'function'
    ) {
      const route = this.platform.currentRoute();
      if (route === 'pages/SetupInBodyEquip/SetupInBodyEquipTestH30') {
        clearTimeout(this.BTConf.stableWeightTimer as ReturnType<typeof setTimeout>);
        clearTimeout(this.BTConf.measureTimer as ReturnType<typeof setTimeout>);
        this.onInBodyTestStartCallback('timeover');
        this.BTConf.processCase = this.ProcessEnum.CONNECT;
      }
      if (this.BTConf.isPlayed) {
        this.BTConf.audioPlayer.destroy();
        this.BTConf.isPlayed = false;
      }
    }
    if (
      this.BTConf.processCase === this.ProcessEnum.CONNECT &&
      typeof this.onBluetoothConnectFailCallback === 'function'
    ) {
      const route = this.platform.currentRoute();
      if (route === 'pages/SetupInBodyEquip/SetupInBodyEquipConnectH30') {
        clearTimeout(this.BTConf.connectTimer as ReturnType<typeof setTimeout>);
        clearTimeout(this.BTConf.discoveryTimer as ReturnType<typeof setTimeout>);
        this.failedCallback();
      }
    }
    this.BTConf.connected = false;
  }

  private syncHOCommandFromGlobal(): void {
    const globalData = this.platform.globals();
    const userInfo = globalData.InBodyUserInfo || {};
    const ak = this.codec.GetAKResponse();
    this.HOCommand.nickName = globalData.nickName || '';
    this.HOCommand.sound = ak.sound;
    this.HOCommand.wifiUsage = ak.wifiUsageVariable;
    this.HOCommand.UID = globalData.UID || '';
    this.HOCommand.sex = userInfo.Gender || '';
    this.HOCommand.age = Number(userInfo.Age || 0);
    this.HOCommand.height = Number(userInfo.Height || 0);
    this.HOCommand.unit = ak.unit;
    this.HOCommand.url = 'https://inbodyapiv3.lookinbody.cn';
    this.HOCommand.urlByteCount = this.HOCommand.url.length;
    this.HOCommand.rangeCountry = 1;
    this.codec.setHOCommand(this.HOCommand);
  }

  private handleProtocolCommand(cmd: string | undefined): void {
    if (!cmd) {
      return;
    }
    const globalData = this.platform.globals();
    const userInfo = globalData.InBodyUserInfo || {};

    switch (this.BTConf.processCase) {
      case this.ProcessEnum.REGISTER: {
        if (cmd === 'HO') {
          this.BTConf.isRegistered = true;
          this.sendAK();
        } else if (cmd === 'AK') {
          if (!this.BTConf.isRegistered) {
            this.syncHOCommandFromGlobal();
            this.sendHO();
          } else {
            this.hideLoading();
            const ak = this.codec.GetAKResponse();
            this.BTConf.ssid = ak.ssid;
            if (this.onSetNickNameCallback) {
              this.onSetNickNameCallback(ak.wifiUsageVariable);
            }
            this.platform.setStored(
              'MyEquipList',
              this.BTConf.deviceName.includes('H30') ? 'H30' : 'H40'
            );
            this.platform.setStored('nickName', globalData.nickName || '');
            this.BTConf.isRegistered = false;
          }
        }
        break;
      }
      case this.ProcessEnum.CONNECT: {
        if (cmd === 'RE') {
          this.BTConf.processCase = this.ProcessEnum.CONNECT;
          this.sendAK();
        } else if (cmd === 'AK') {
          this.sendUL();
        } else if (cmd === 'UL') {
          this.userList = this.codec.GetULResponse().userList;
          if (this.onBluetoothConnectedCallback) {
            this.onBluetoothConnectedCallback();
          }
        }
        break;
      }
      case this.ProcessEnum.SETUP_VALUE_CHANGE: {
        if (cmd === 'HO') {
          this.hideLoading();
          if (this.onSettingChangedCallback) {
            this.onSettingChangedCallback(true);
          }
        } else if (cmd === 'AK') {
          this.sendUL();
          this.syncHOCommandFromGlobal();
        } else if (cmd === 'UL') {
          this.hideLoading();
          this.userList = this.codec.GetULResponse().userList;
          if (this.onSettingBluetoothConnectedCallback) {
            this.onSettingBluetoothConnectedCallback(this.codec.GetAKResponse());
          }
        }
        break;
      }
      case this.ProcessEnum.NICKNAME_ADD: {
        if (cmd === 'HO') {
          this.sendUL();
        } else if (cmd === 'UL') {
          this.hideLoading();
        }
        break;
      }
      case this.ProcessEnum.DELETE: {
        if (cmd === 'UI') {
          this.hideLoading();
          if (this.onUserInitializedCallback) {
            this.onUserInitializedCallback();
          }
        }
        break;
      }
      case this.ProcessEnum.MEASURE: {
        if (cmd === 'RE') {
          this.BTConf.processCase = this.ProcessEnum.MEASURE;
          this.sendAK();
        } else if (cmd === 'AK') {
          this.sendUL();
        } else if (cmd === 'UL') {
          this.syncHOCommandFromGlobal();
          this.sendHO();
        } else if (cmd === 'HO') {
          this.codec.setHICommand({
            sex: userInfo.Gender || '',
            age: Number(userInfo.Age || 0),
            height: Number(userInfo.Height || 0),
          });
          this.sendHI();
        } else if (cmd === 'HI') {
          if (this.onBluetoothConnectedCallback) {
            this.onBluetoothConnectedCallback('measure');
          }
          this.sendHW();
        } else if (cmd === 'HW') {
          if (!this.BTConf.isPlayed) {
            this.BTConf.audioPlayer = this.platform.playSound('/images/_last.mp3');
            this.BTConf.isPlayed = true;
          }
          this.BTConf.stableWeightTimer = setTimeout(() => {
            if (this.BTConf.connected) {
              this.sendHW();
            }
          }, this.BTConf.stableWeightTimeout);
        } else if (cmd === 'HS') {
          clearTimeout(this.BTConf.stableWeightTimer as ReturnType<typeof setTimeout>);
          clearTimeout(this.BTConf.measureTimer as ReturnType<typeof setTimeout>);
          if (this.onInBodyTestStartCallback) {
            this.onInBodyTestStartCallback('posture');
          }
          this.sendHP();
        } else if (cmd === 'HP') {
          clearTimeout(this.BTConf.postureTimer as ReturnType<typeof setTimeout>);
          const progress = this.codec.GetHMResponse().progress;
          if (this.onInBodyTestingCallback) {
            this.onInBodyTestingCallback(progress);
          }
          const posture = this.codec.GetHPResponse().statu;
          if (posture === 0x31) {
            this.sendHM();
            if (this.onInBodyTestStartCallback) {
              this.onInBodyTestStartCallback('measure');
            }
          } else if (posture === 0x30) {
            this.sendHP();
          } else {
            if (this.onInBodyTestStartCallback) {
              this.onInBodyTestStartCallback('weight');
            }
            this.sendHW();
          }
        } else if (cmd === 'HM') {
          if (this.BTConf.isPlayed) {
            this.BTConf.audioPlayer.destroy();
            this.BTConf.isPlayed = false;
          }
          if (this.onInBodyTestingCallback) {
            this.onInBodyTestingCallback(100);
          }
          this.sendHR();
        } else if (cmd === 'HE') {
          if (this.BTConf.isPlayed) {
            this.BTConf.audioPlayer.destroy();
            this.BTConf.isPlayed = false;
          }
          if (this.onInBodyTestingCallback) {
            this.onInBodyTestingCallback(-1);
          }
          setTimeout(() => {
            this.sendHP();
          }, 3000);
        } else if (cmd === 'HR') {
          this.setInBodyData();
        } else if (cmd === 'MC') {
          this.closeBluetoothAdapter();
        }
        break;
      }
      case this.ProcessEnum.WIFI_SCAN: {
        if (cmd === 'WS') {
          this.wifiInfo.length = 0;
          this.BTConf.wifiReadIndex = 0;
          this.codec.setWRCommand({ packageIndex: this.BTConf.wifiReadIndex });
          this.sendWR();
          this.BTConf.wifiResearchCount = 0;
        } else if (cmd === 'RWS') {
          this.hideLoading();
          if (this.onWifiSearchCallback) {
            this.onWifiSearchCallback('NONE');
          }
        } else if (cmd === 'WR') {
          this.WRResponse = this.codec.GetWRResponse();
          this.wifiInfo = this.wifiInfo.concat(this.WRResponse.wifiInfo);
          this.BTConf.wifiReadIndex += 1;
          if (this.BTConf.wifiReadIndex < this.WRResponse.packageCount) {
            this.codec.setWRCommand({ packageIndex: this.BTConf.wifiReadIndex });
            this.sendWR();
          } else {
            this.hideLoading();
            if (this.onWifiSearchCallback) {
              this.onWifiSearchCallback(this.wifiInfo);
            }
          }
        } else if (cmd === 'HO') {
          this.hideLoading();
          if (this.onWifiSearchCallback) {
            this.onWifiSearchCallback(true);
          }
        }
        break;
      }
      case this.ProcessEnum.SET_WIFI: {
        if (cmd === 'WI') {
          const code = this.codec.GetWIResponse().code;
          this.hideLoading();
          if (this.onWifiConnectCompletedCallback) {
            this.onWifiConnectCompletedCallback(code);
          }
        }
        break;
      }
      default: {
        if (cmd === 'AK') {
          this.writeBLECharacteristicValue(1);
        }
        break;
      }
    }
  }

  public writeBLECharacteristicValue(step: number): void {
    if (
      !this.BTConf.isLoading &&
      this.BTConf.processCase !== this.ProcessEnum.MEASURE &&
      this.BTConf.processCase !== this.ProcessEnum.CONNECT
    ) {
      this.showLoading();
    }

    const userInfo = this.platform.globals().InBodyUserInfo || {};
    let buffer: ArrayBuffer;
    switch (step) {
      case 0:
        buffer = this.codec.sendAK(this.BTConf.isRegistered);
        break;
      case 1:
        buffer = this.codec.sendUL();
        break;
      case 2:
        buffer = this.codec.sendHO();
        break;
      case 3:
        buffer = this.codec.sendHI(userInfo.Gender, userInfo.Age, userInfo.Height);
        break;
      case 4:
        buffer = this.codec.sendHW();
        break;
      case 5:
        buffer = this.codec.sendHP();
        break;
      case 6:
        buffer = this.codec.sendHM();
        break;
      case 7:
        buffer = this.codec.sendHR();
        break;
      case 8:
        buffer = this.codec.sendWS();
        break;
      case 9:
        buffer = this.codec.sendWR();
        break;
      case 10:
        buffer = this.codec.sendWI();
        break;
      case 11:
        buffer = this.codec.sendDR();
        break;
      case 12:
        buffer = this.codec.sendUT();
        break;
      case 13:
        buffer = this.codec.sendDC();
        break;
      case 14:
        buffer = this.codec.sendDD();
        break;
      case 15:
        buffer = this.codec.sendSV();
        break;
      case 16:
        buffer = this.codec.sendIC();
        break;
      case 17:
        buffer = this.codec.sendSR();
        break;
      case 18:
        buffer = this.codec.sendMC();
        break;
      case 19:
        buffer = this.codec.sendUI();
        break;
      case 20:
        buffer = this.codec.sendDK();
        break;
      case 21:
        buffer = this.codec.sendWA();
        break;
      default:
        buffer = new ArrayBuffer(0);
        break;
    }

    this.transport
      .write(this.BTConf.deviceId, {
        serviceId: this.BTConf.serviceId,
        characteristicId: this.BTConf.characteristicId,
      }, buffer)
      .then(() => {
        this.BTConf.retryCount = 0;
      })
      .catch((err: unknown) => {
        if (
          toPlatformError(err).errCode === 10006 &&
          this.BTConf.processCase !== this.ProcessEnum.MEASURE
        ) {
          this.closeBLEConnection();
          this.setConnectInbodyH30(this.BTConf.deviceId, this.BTConf.deviceName)
            .then(() => {
              if (this.BTConf.retryCount < 1) {
                this.BTConf.retryCount++;
                this.writeBLECharacteristicValue(step);
              } else {
                this.failedCallback();
              }
            })
            .catch(() => {});
        } else {
          this.closeBLEConnection();
          this.failedCallback();
        }
      });
  }

  public closeBLEConnection(): void {
    if (this.BTConf.deviceId) {
      void this.transport.disconnect(this.BTConf.deviceId);
    }
    this.BTConf.connected = false;
    clearTimeout(this.BTConf.connectTimer as ReturnType<typeof setTimeout>);
    clearTimeout(this.BTConf.discoveryTimer as ReturnType<typeof setTimeout>);
    clearTimeout(this.BTConf.stableWeightTimer as ReturnType<typeof setTimeout>);
    clearTimeout(this.BTConf.measureTimer as ReturnType<typeof setTimeout>);
    clearTimeout(this.BTConf.postureTimer as ReturnType<typeof setTimeout>);
  }

  public closeBluetoothAdapter(): void {
    this.closeBLEConnection();
    void this.transport.closeAdapter().then(() => this.clearBTConf());
  }

  public clearBTConf(): void {
    this.BTConf.isFirstConnect = true;
    this.BTConf.isOpened = false;
    this.BTConf.connected = false;
    this.BTConf.isSearched = false;
  }

  public sendAK(): void {
    this.writeBLECharacteristicValue(0);
  }
  public sendUL(): void {
    this.writeBLECharacteristicValue(1);
  }
  public sendHO(): void {
    this.writeBLECharacteristicValue(2);
  }
  public sendHI(): void {
    this.writeBLECharacteristicValue(3);
  }
  public sendHW(): void {
    this.writeBLECharacteristicValue(4);
  }
  public sendHP(): void {
    this.writeBLECharacteristicValue(5);
  }
  public sendHM(): void {
    this.writeBLECharacteristicValue(6);
  }
  public sendHR(): void {
    this.writeBLECharacteristicValue(7);
  }
  public sendWS(): void {
    this.writeBLECharacteristicValue(8);
  }
  public sendWR(): void {
    this.writeBLECharacteristicValue(9);
  }
  public sendWI(): void {
    this.writeBLECharacteristicValue(10);
  }
  public sendDR(): void {
    this.writeBLECharacteristicValue(11);
  }
  public sendUT(): void {
    this.writeBLECharacteristicValue(12);
  }
  public sendDC(): void {
    this.writeBLECharacteristicValue(13);
  }
  public sendDD(): void {
    this.writeBLECharacteristicValue(14);
  }
  public sendSV(): void {
    this.writeBLECharacteristicValue(15);
  }
  public sendIC(): void {
    this.writeBLECharacteristicValue(16);
  }
  public sendSR(): void {
    this.writeBLECharacteristicValue(17);
  }
  public sendMC(): void {
    this.writeBLECharacteristicValue(18);
  }
  public sendUI(): void {
    this.writeBLECharacteristicValue(19);
  }
  public sendDK(): void {
    this.writeBLECharacteristicValue(20);
  }
  public sendWA(): void {
    this.writeBLECharacteristicValue(21);
  }

  public connectEquip(): void {
    this.attachTransport();
    this.BTConf.processCase = this.ProcessEnum.CONNECT;
    this.connectBluetooth();
  }

  public connectEquipSetting(): void {
    this.attachTransport();
    this.BTConf.processCase = this.ProcessEnum.SETUP_VALUE_CHANGE;
    if (!this.BTConf.isOpened) {
      this.openBluetoothAdapter().catch(this.alreadyReported);
      return;
    }
    if (this.BTConf.isOpened && !this.BTConf.connected) {
      this.setConnectInbodyH30(this.BTConf.deviceId, this.BTConf.deviceName).catch(this.alreadyReported);
    } else {
      this.sendAK();
    }
  }

  public setNickName(_nickName?: string): void {
    this.BTConf.processCase = this.ProcessEnum.REGISTER;
    this.sendAK();
  }

  public wifiScan(): void {
    this.BTConf.processCase = this.ProcessEnum.WIFI_SCAN;
    this.sendWS();
  }

  public setWifiUsage(flag: number): void {
    this.HOCommand.wifiUsage = flag;
    this.codec.setHOCommand(this.HOCommand);
    this.BTConf.processCase = this.ProcessEnum.WIFI_SCAN;
    this.sendHO();
  }

  public setSound(flag: number): void {
    this.HOCommand.sound = flag;
    this.codec.setHOCommand(this.HOCommand);
    this.BTConf.processCase = this.ProcessEnum.SETUP_VALUE_CHANGE;
    this.sendHO();
  }

  public setUnit(flag: number): void {
    this.HOCommand.unit = flag;
    this.codec.setHOCommand(this.HOCommand);
    this.BTConf.processCase = this.ProcessEnum.SETUP_VALUE_CHANGE;
    this.sendHO();
  }

  public wifiSet(SSID = '', password = ''): void {
    this.BTConf.processCase = this.ProcessEnum.SET_WIFI;
    const payload = {
      SSID,
      password,
      url: 'https://inbodyapiv3.lookinbody.cn',
    };
    if (this.isWASupported()) {
      this.codec.setWACommand(payload);
      this.sendWA();
    } else {
      this.codec.setWICommand(payload);
      this.sendWI();
    }
  }

  public isWASupported(): boolean {
    const programVersion = this.codec.GetAKResponse().programVersion;
    const parts = (programVersion || '').split('.');
    const versionNum = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    if (this.BTConf.deviceName.includes('H40')) {
      return versionNum >= 51;
    }
    return versionNum >= 41;
  }

  public updateFirmware(): void {
    this.sendSV();
    this.BTConf.isSVMode = true;
  }

  public getFirmwareVersion(): void {
    // Same request as before: the version string is fixed, and the answer is cached on the codec.
    this.platform
      .postJson('https://wechat.lookinbody.cn/Main/CheckUpdateFirmwareDial', {
        AppName: 'InBodyH30',
        firmwareVersion: 'H30.27.05.08.00.1201M1',
      })
      .then((response) => {
        const data = ((response || {}) as { Data?: Record<string, unknown> }).Data || {};
        this.codec.DFUInfo.currentVersion = String(data.CurrentVersion || '');
        this.codec.DFUInfo.isUpdateFirmWare = Boolean(data.IsUpdate_Firmware);
        this.codec.DFUInfo.isUpdateImage = Boolean(data.IsUpdate_Image);
        this.codec.DFUInfo.FileURL_Firmware = String(data.FileURL_Firmware || '');
        this.codec.DFUInfo.FileURL_Image = String(data.FileURL_Image || '');
      })
      .catch(() => {});
  }

  public connectOTA(): void {
    this.BTConf.isSVMode = true;
    this.BTConf.isFirstConnect = true;
    this.BTConf.isSearched = false;
    this.closeBLEConnection();
    this.closeBluetoothAdapter();
    this.openBluetoothAdapter().catch(this.alreadyReported);
  }

  public infoChange(): void {
    this.codec.setICCommand({
      nickName: this.platform.globals().nickName || '',
      UID: this.platform.globals().UID || '',
      sex: 'F',
      age: 18,
      height: 177.0,
    });
    this.sendIC();
  }

  public getStatu(): void {
    this.sendSR();
  }

  public measureCancel(): void {
    this.sendMC();
  }

  public userListInitialize(): void {
    this.BTConf.processCase = this.ProcessEnum.DELETE;
    this.sendUI();
  }

  public setDataKind(): void {
    this.sendDK();
  }

  public getMeasrementData(): void {
    this.codec.setDRCommand({
      UID: this.platform.globals().UID || '',
      nickName: this.platform.globals().nickName || '',
    });
    this.sendDR();
  }

  public userDataTransfer(index: number): void {
    this.BTConf.processCase = this.ProcessEnum.MEASUREMENT_DATA_TRANSFER;
    this.codec.setUTCommand({
      UID: this.platform.globals().UID || '',
      nickName: this.platform.globals().nickName || '',
      index,
    });
    this.sendUT();
  }

  public confirmTransfer(): void {
    this.sendDC();
  }

  public deleteUser(): void {
    this.BTConf.processCase = this.ProcessEnum.DELETE;
    const ul = this.codec.GetULResponse();
    this.codec.setDDCommand({
      userCount: ul.userCount,
      userList: ul.userList.map((u) => ({ UID: u.UID, nickName: u.nickName })),
    });
    this.sendDD();
  }

  public startInBodyTest(): void {
    this.BTConf.processCase = this.ProcessEnum.MEASURE;
    const equip =
      this.platform.getStored('ConnectEquip') === 'H40' ? 'InBodyDial H40' : 'InBodyDial H30';
    this.platform.navigateTo(
      `/pages/SetupInBodyEquip/SetupInBodyEquipConnectH30?viewType=connecting&&equip=${equip}`
    );
    if (this.BTConf.isOpened && this.BTConf.connected) {
      this.sendAK();
      return;
    }
    const globalData = this.platform.globals();
    this.codec.setHOCommand({
      nickName: globalData.nickName || '',
      UID: globalData.UID || '',
    });
    if (!this.BTConf.isOpened) {
      this.openBluetoothAdapter().catch(this.alreadyReported);
      return;
    }
    if (this.BTConf.isOpened && !this.BTConf.connected) {
      this.setConnectInbodyH30(this.BTConf.deviceId, this.BTConf.deviceName).catch(this.alreadyReported);
    }
  }

  public connectBluetooth(): void {
    this.attachTransport();
    if (this.BTConf.connected && this.BTConf.processCase !== this.ProcessEnum.MEASURE) {
      if (this.onBluetoothConnectingCallback) {
        this.onBluetoothConnectingCallback();
      }
      if (this.onBluetoothConnectedCallback) {
        this.onBluetoothConnectedCallback();
      }
      return;
    }
    if (!this.BTConf.isOpened) {
      this.openBluetoothAdapter().catch(this.alreadyReported);
      return;
    }
    if (this.BTConf.isOpened && !this.BTConf.connected) {
      this.setConnectInbodyH30(this.BTConf.deviceId, this.BTConf.deviceName).catch(this.alreadyReported);
    }
  }

  public startOTAWrite(): void {
    this.ota.start(this.BTConf.deviceId).catch((err: unknown) => console.error('[OTA] start failed', err));
  }

  public endOTAWrite(): void {
    this.ota.end(this.BTConf.deviceId).catch((err: unknown) => console.error('[OTA] end failed', err));
  }

  public async writeOTAFile(): Promise<void> {
    const image = await this.platform.pickFirmwareFile();
    this.BTConf.fileData = image;
    await this.ota.sendFirmware(this.BTConf.deviceId, image);
  }

  public updateFirmwareFile(): void {
    this.ota.start(this.BTConf.deviceId).catch(() => {
      if (this.codec.onFirmwareUpdateFailCallback) this.codec.onFirmwareUpdateFailCallback();
    });
  }

  public getSSID(): string {
    return this.BTConf.ssid;
  }

  public setSSID(SSID: string): void {
    this.BTConf.ssid = SSID;
  }

  public formatDate(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(
      now.getHours()
    )}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }

  public showLoading(): void {
    this.platform.showLoading();
    this.BTConf.isLoading = true;
    this.BTConf.loadingTimer = setTimeout(() => {
      if (this.BTConf.isLoading) {
        this.BTConf.isLoading = false;
        this.failedCallback();
      }
    }, this.BTConf.loadingTimeout);
  }

  public hideLoading(): void {
    if (this.BTConf.isLoading) {
      clearTimeout(this.BTConf.loadingTimer as ReturnType<typeof setTimeout>);
      this.platform.hideLoading();
      this.BTConf.isLoading = false;
    }
  }

  public handleBluetoothError(res?: { errCode?: number; errMsg?: string }): void {
    this.hideLoading();
    clearTimeout(this.BTConf.discoveryTimer as ReturnType<typeof setTimeout>);
    void this.transport.stopDiscovery();
    this.closeBLEConnection();
    this.closeBluetoothAdapter();
    this.BTConf.isSearched = false;
    this.BTConf.isBTCheck = false;

    const errCode = res ? res.errCode : undefined;
    const errMsg = res && res.errMsg ? res.errMsg.toLowerCase() : '';
    let content = '';
    let needOpenSetting = false;

    if (errCode === 10022 || errMsg.includes('location') || errMsg.includes('gps')) {
      content = '蓝牙搜索失败，请在手机下拉控制中心或系统设置中开启【定位服务(GPS)】及定位权限。';
    } else if (
      errMsg.includes('bluetooth') &&
      (errMsg.includes('auth') || errMsg.includes('deny') || errMsg.includes('permission'))
    ) {
      content = '小程序未获取到蓝牙权限，请进入权限设置界面开启蓝牙授权。';
      needOpenSetting = true;
    } else if (
      errCode === 10001 ||
      errMsg.includes('not available') ||
      errMsg.includes('off') ||
      errMsg.includes('disable')
    ) {
      content = '请在手机下拉控制中心或系统设置中开启【蓝牙开关】。';
    } else if (errMsg.includes('auth') || errMsg.includes('deny') || errMsg.includes('permission')) {
      content = '小程序未获取到相关权限，请在设置中检查并授权。';
      needOpenSetting = true;
    } else {
      content = `蓝牙初始化失败${errCode ? `(错误码:${errCode})` : ''}，请检查手机蓝牙并重试。`;
    }

    if (needOpenSetting) {
      void this.platform
        .showModal({
          title: '蓝牙权限提示',
          content,
          confirmText: '去设置',
          cancelText: '取消',
          showCancel: true,
        })
        .then((modalRes) => {
          if (modalRes.confirm) {
            this.platform.openAppSettings();
          }
        });
    } else {
      void this.platform.showModal({
        title: '提示',
        content,
        confirmText: '我知道了',
        showCancel: false,
      });
    }

    this.dispatchProcessFailure();
  }

  public failedCallback(): void {
    this.hideLoading();
    void this.platform.showModal({
      title: '提示',
      content: '连接失败！',
      showCancel: false,
    });
    this.dispatchProcessFailure();
  }

  private dispatchProcessFailure(): void {
    if (
      this.BTConf.processCase === this.ProcessEnum.SETUP_VALUE_CHANGE &&
      this.onSettingBluetoothConnectedCallback
    ) {
      this.onSettingBluetoothConnectedCallback(false);
    }
    if (
      this.BTConf.processCase === this.ProcessEnum.CONNECT &&
      this.onBluetoothConnectFailCallback
    ) {
      this.onBluetoothConnectFailCallback(false);
    }
    if (this.BTConf.processCase === this.ProcessEnum.WIFI_SCAN && this.onWifiSearchCallback) {
      this.onWifiSearchCallback(false);
    }
    if (this.BTConf.processCase === this.ProcessEnum.MEASURE) {
      this.platform.redirectToHome();
    }
  }
}
