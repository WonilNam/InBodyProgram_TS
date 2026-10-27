import { H30ProtocolParser } from '../../../hardware-sdk/src/infrastructure/protocols/parsers/H30ProtocolParser';

export interface H30InBodyDataPayload {
  DATETIMES: string;
  HT: number;
  WT: number;
  PBF: number;
  SMM: number;
  VFALevel: number;
  TBW: number;
  MINERAL: number;
  PROTEIN: number;
  WHR: number;
  BMC: number;
  SLM: number;
  BFM: number;
  BMI: number;
  FS: number;
  BMR: number;
  IWT: number;
  ISMM: number;
  IBFM: number;
  PWT: number;
  IRA5: number;
  ILA5: number;
  IT5: number;
  IRL5: number;
  ILL5: number;
  IRA50: number;
  ILA50: number;
  IT50: number;
  IRL50: number;
  ILL50: number;
  IRA200: number;
  ILA200: number;
  IT200: number;
  IRL200: number;
  ILL200: number;
  bal_ups: number;
  bal_lows: number;
  bal_uls: number;
  impedance20kHz_RA: number;
  impedance20kHz_LA: number;
  impedance20KHz_T: number;
  impedance20kHz_RL: number;
  impedance20kHz_LL: number;
  impedance100kHz_RA: number;
  impedance100kHz_LA: number;
  impedance100kHz_T: number;
  impedance100kHz_RL: number;
  impedance100kHz_LL: number;
  TBW_MAX: number;
  TBW_MIN: number;
  SLM_MAX: number;
  SLM_MIN: number;
  ODK: number;
  OBESITY: number;
  OD_MAX: number;
  OD_MIN: number;
  TW: number;
  WC: number;
  MC: number;
  FC: number;
  BMC_MAX: number;
  BMC_MIN: number;
  PROTEIN_MAX: number;
  PROTEIN_MIN: number;
  MINERAL_MAX: number;
  MINERAL_MIN: number;
  PSMM: number;
  pfatnew: number;
  IBMI: number;
  BMI_MAX: number;
  BMI_MIN: number;
  IPBF: number;
  PBF_MAX: number;
  PBF_MIN: number;
  IWHR: number;
  WHR_MAX: number;
  WHR_MIN: number;
  ISLM: number;
  IPROTEIN: number;
  IMINERAL: number;
  IBMC: number;
  SEX: number;
  AGE: number;
  INLL_LV: number;
}

export interface H30WifiItem {
  SSIDLength: number;
  SSID: string;
  MacAddr: string;
  NetworkMode: number;
  Security: number;
  Channel: number;
  Rssi: number;
}

const parser = new H30ProtocolParser();

/**
 * H30/H40 setup-flow command builders and response decoding on top of the SDK parser. It keeps the
 * last command arguments and decoded responses, so each setup session owns its own instance.
 * Pure: no platform calls.
 */
export class H30SetupCodec {
  public onFirmwareUpdateProgressCallback: ((progress: number) => void) | null = null;
  public onFirmwareUpdateFailCallback: (() => void) | null = null;

  public InBodyData: H30InBodyDataPayload = {
    DATETIMES: '',
    HT: 0,
    WT: 0,
    PBF: 0,
    SMM: 0,
    VFALevel: 0,
    TBW: 0,
    MINERAL: 0,
    PROTEIN: 0,
    WHR: 0,
    BMC: 0,
    SLM: 0,
    BFM: 0,
    BMI: 0,
    FS: 0,
    BMR: 0,
    IWT: 0,
    ISMM: 0,
    IBFM: 0,
    PWT: 0,
    IRA5: 0,
    ILA5: 0,
    IT5: 0,
    IRL5: 0,
    ILL5: 0,
    IRA50: 0,
    ILA50: 0,
    IT50: 0,
    IRL50: 0,
    ILL50: 0,
    IRA200: 0,
    ILA200: 0,
    IT200: 0,
    IRL200: 0,
    ILL200: 0,
    bal_ups: 0,
    bal_lows: 0,
    bal_uls: 0,
    impedance20kHz_RA: 0,
    impedance20kHz_LA: 0,
    impedance20KHz_T: 0,
    impedance20kHz_RL: 0,
    impedance20kHz_LL: 0,
    impedance100kHz_RA: 0,
    impedance100kHz_LA: 0,
    impedance100kHz_T: 0,
    impedance100kHz_RL: 0,
    impedance100kHz_LL: 0,
    TBW_MAX: 0,
    TBW_MIN: 0,
    SLM_MAX: 0,
    SLM_MIN: 0,
    ODK: 0,
    OBESITY: 0,
    OD_MAX: 0,
    OD_MIN: 0,
    TW: 0,
    WC: 0,
    MC: 0,
    FC: 0,
    BMC_MAX: 0,
    BMC_MIN: 0,
    PROTEIN_MAX: 0,
    PROTEIN_MIN: 0,
    MINERAL_MAX: 0,
    MINERAL_MIN: 0,
    PSMM: 0,
    pfatnew: 0,
    IBMI: 0,
    BMI_MAX: 0,
    BMI_MIN: 0,
    IPBF: 0,
    PBF_MAX: 0,
    PBF_MIN: 0,
    IWHR: 0,
    WHR_MAX: 0,
    WHR_MIN: 0,
    ISLM: 0,
    IPROTEIN: 0,
    IMINERAL: 0,
    IBMC: 0,
    SEX: 0,
    AGE: 3,
    INLL_LV: 0,
  };

  public DFUInfo = {
    currentVersion: '',
    FileURL_Firmware: '',
    FileURL_Image: '',
    isUpdateFirmWare: false,
    isUpdateImage: false,
    fileLength: 0,
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

  public HICommand = {
    sex: '',
    age: 0,
    height: 0,
    weight: 0,
    percent: 0,
    smm: 0,
  };

  public WRCommand = { packageIndex: 0 };
  public WICommand = { SSID: '', password: '', url: '' };
  public WACommand = { SSID: '', password: '', url: '' };
  public DRCommand = { UID: '', nickName: '' };
  public UTCommand = { UID: '', nickName: '', index: 0 };
  public DCCommand = {
    UID: '',
    nickName: '',
    dataCount: 0,
    saveResult: [] as Array<{ dateTimes: string; result: number }>,
  };
  public DDCommand = {
    userCount: 0,
    userList: [] as Array<{ UID: string; nickName: string }>,
  };
  public ICCommand = { UID: '', nickName: '', sex: '', age: 0, height: 0 };
  public DKCommand = { kind: 1 };

  public AKResponse = {
    serialNumber: '',
    programVersion: '',
    wifiStatus: 0,
    ownerUID: '',
    ownerNickname: '',
    uidOverflow: 0,
    ssid: '',
    language: 0,
    unit: 0,
    sound: 1,
    batteryVoltage: 0,
    firmwareUpdatePossible: 0,
    countrySetting: 1,
    wifiUsageVariable: 1,
  };

  public ULResponse = {
    userCount: 0,
    userList: [] as Array<{
      uid: string;
      UID: string;
      nickName: string;
      lastMeasurement: string;
      pendingDataCount: number;
    }>,
  };

  public HOResponse: Record<string, unknown> = {};
  public HIResponse: Record<string, unknown> = {};
  public HWResponse = { weight: 0 };
  public HPResponse = { statu: 0 };
  public HMResponse = { progress: 0 };
  public HEResponse = { code: '' };
  public WSResponse = { count: 0 };
  public WRResponse = {
    count: 0,
    packageCount: 0,
    readIndex: 0,
    searchedWifiCount: 0,
    wifiInfo: [] as H30WifiItem[],
  };
  public WIResponse = { code: 0, serverRespnse: '' };
  public WAResponse = { code: 0, serverRespnse: '' };
  public DRResponse = { UID: '', nickName: '', count: 0 };
  public UTResponse = { UID: '', nickName: '', index: 0, InBodyData: {} as H30InBodyDataPayload };
  public DCResponse = { userInfo: '', savedCount: 0, reservedCount: 0 };
  public DDResponse = {
    userCount: 0,
    userList: [] as Array<{ userInfo: string; lastMeasurement: string; pendingDataCount: number }>,
  };
  public ICResponse = { UID: '', nickName: '', sex: '', age: 0, height: 0 };
  public WDResponse = { packetNum: 0, _packetNum: 0, packetIndex: 0, statu: '', code: 0 };
  public SRResponse = { statu: '' };

  public setOnFirmwareUpdateProgressCallback(cb: (progress: number) => void): void {
    this.onFirmwareUpdateProgressCallback = cb;
  }

  public setOnFirmwareUpdateFailCallback(cb: () => void): void {
    this.onFirmwareUpdateFailCallback = cb;
  }

  public setHOCommand(cmd: Partial<typeof this.HOCommand>): void {
    this.HOCommand = { ...this.HOCommand, ...cmd };
  }

  public setHICommand(cmd: Partial<typeof this.HICommand>): void {
    this.HICommand = { ...this.HICommand, ...cmd };
  }

  public setWRCommand(cmd: Partial<typeof this.WRCommand>): void {
    this.WRCommand = { ...this.WRCommand, ...cmd };
  }

  public setWICommand(cmd: Partial<typeof this.WICommand>): void {
    this.WICommand = { ...this.WICommand, ...cmd };
  }

  public setWACommand(cmd: Partial<typeof this.WACommand>): void {
    this.WACommand = { ...this.WACommand, ...cmd };
  }

  public setDRCommand(cmd: Partial<typeof this.DRCommand>): void {
    this.DRCommand = { ...this.DRCommand, ...cmd };
  }

  public setUTCommand(cmd: Partial<typeof this.UTCommand>): void {
    this.UTCommand = { ...this.UTCommand, ...cmd };
  }

  public setDCCommand(cmd: Partial<typeof this.DCCommand>): void {
    this.DCCommand = { ...this.DCCommand, ...cmd };
  }

  public setDDCommand(cmd: Partial<typeof this.DDCommand>): void {
    this.DDCommand = { ...this.DDCommand, ...cmd };
  }

  public setICCommand(cmd: Partial<typeof this.ICCommand>): void {
    this.ICCommand = { ...this.ICCommand, ...cmd };
  }

  public setDKCommand(cmd: Partial<typeof this.DKCommand>): void {
    this.DKCommand = { ...this.DKCommand, ...cmd };
  }

  public GetAKResponse() {
    return this.AKResponse;
  }
  public GetULResponse() {
    return this.ULResponse;
  }
  public GetHOResponse() {
    return this.HOResponse;
  }
  public GetHIResponse() {
    return this.HIResponse;
  }
  public GetHWResponse() {
    return this.HWResponse;
  }
  public GetHPResponse() {
    return this.HPResponse;
  }
  public GetHMResponse() {
    return this.HMResponse;
  }
  public GetWSResponse() {
    return this.WSResponse;
  }
  public GetWRResponse() {
    return this.WRResponse;
  }
  public GetWIResponse() {
    return this.WIResponse;
  }
  public GetWAResponse() {
    return this.WAResponse;
  }
  public GetDRResponse() {
    return this.DRResponse;
  }
  public GetUTResponse() {
    return this.UTResponse;
  }
  public GetDCResponse() {
    return this.DCResponse;
  }
  public GetDDResponse() {
    return this.DDResponse;
  }
  public GetICResponse() {
    return this.ICResponse;
  }
  public GetSRResponse() {
    return this.SRResponse;
  }
  public GetWDResponse() {
    return this.WDResponse;
  }
  public GetInbodyData() {
    return this.InBodyData;
  }

  public sendAK(isComplete = false): ArrayBuffer {
    return parser.buildOutgoingCommand(
      'H30',
      'AK',
      { syncTime: !isComplete } as unknown as Parameters<typeof parser.buildOutgoingCommand>[2]
    );
  }

  public sendUL(): ArrayBuffer {
    return parser.buildOutgoingCommand('H30', 'UL');
  }

  public sendHO(): ArrayBuffer {
    return parser.buildOutgoingCommand('H30', 'HO', this.HOCommand);
  }

  public sendHI(sex?: string, age?: number, height?: number): ArrayBuffer {
    return parser.buildOutgoingCommand('H30', 'HI', {
      sex: (sex || this.HICommand.sex) === 'M' ? 'M' : 'F',
      age: Number(age ?? this.HICommand.age ?? 0),
      height: Number(height ?? this.HICommand.height ?? 0),
    });
  }

  public sendHW(): ArrayBuffer {
    return parser.buildOutgoingCommand('H30', 'HW');
  }

  public sendHP(): ArrayBuffer {
    return parser.buildOutgoingCommand('H30', 'HP');
  }

  public sendHM(): ArrayBuffer {
    return parser.buildOutgoingCommand('H30', 'HM');
  }

  public sendHR(): ArrayBuffer {
    return parser.buildOutgoingCommand('H30', 'HR');
  }

  public sendWS(): ArrayBuffer {
    return parser.buildOutgoingCommand('H30', 'WS');
  }

  public sendWR(): ArrayBuffer {
    return parser.buildOutgoingCommand('H30', 'WR', {
      packageIndex: this.WRCommand.packageIndex,
    });
  }

  public sendWI(): ArrayBuffer {
    return parser.buildOutgoingCommand('H30', 'WI', this.WICommand);
  }

  public sendWA(): ArrayBuffer {
    return parser.buildOutgoingCommand('H30', 'WA', this.WACommand);
  }

  public sendDR(): ArrayBuffer {
    return parser.buildOutgoingCommand('H30', 'DR', this.DRCommand);
  }

  public sendUT(): ArrayBuffer {
    return parser.buildOutgoingCommand('H30', 'UT', this.UTCommand);
  }

  public sendDC(): ArrayBuffer {
    return parser.buildOutgoingCommand('H30', 'DC', {
      UID: this.DCCommand.UID,
      nickName: this.DCCommand.nickName,
      confirmResults: this.DCCommand.saveResult.map((r) => ({
        dateTime: r.dateTimes,
        result: r.result,
      })),
    } as unknown as Parameters<typeof parser.buildOutgoingCommand>[2]);
  }

  public sendDD(): ArrayBuffer {
    return parser.buildOutgoingCommand('H30', 'DD', {
      userList: this.DDCommand.userList,
    });
  }

  public sendSV(): ArrayBuffer {
    return parser.buildOutgoingCommand('H30', 'SV');
  }

  public sendIC(): ArrayBuffer {
    return parser.buildOutgoingCommand('H30', 'IC', {
      UID: this.ICCommand.UID,
      nickName: this.ICCommand.nickName,
      sex: this.ICCommand.sex === 'M' ? 'M' : 'F',
      age: Number(this.ICCommand.age || 0),
      height: Number(this.ICCommand.height || 0),
    });
  }

  public sendSR(): ArrayBuffer {
    return parser.buildOutgoingCommand('H30', 'SR');
  }

  public sendMC(): ArrayBuffer {
    return parser.buildOutgoingCommand('H30', 'MC');
  }

  public sendUI(): ArrayBuffer {
    return parser.buildOutgoingCommand('H30', 'UI');
  }

  public sendDK(): ArrayBuffer {
    return parser.buildOutgoingCommand('H30', 'DK', { kind: this.DKCommand.kind });
  }

  public getReadInbodyData(dataView: DataView, byteCnt: number): string | undefined {
    let asciiPreview = '';
    for (let i = 0; i < byteCnt; i++) {
      asciiPreview += String.fromCharCode(dataView.getUint8(i));
    }
    if (asciiPreview.includes('InBodyDial2')) {
      return 'RE';
    }

    const chunk = dataView.buffer.slice(dataView.byteOffset, dataView.byteOffset + byteCnt) as ArrayBuffer;
    const parsed = parser.parseIncomingData('H30', chunk) as unknown as Record<string, unknown>;
    const cmd = String(parsed.cmd || '');
    if (!cmd || cmd === 'BUFFERING') {
      return undefined;
    }

    switch (cmd) {
      case 'AK': {
        this.AKResponse = {
          serialNumber: String(parsed.serialNumber || ''),
          programVersion: String(parsed.programVersion || ''),
          wifiStatus: Number(parsed.wifiStatus || 0),
          ownerUID: String(parsed.UID || ''),
          ownerNickname: String(parsed.nickName || ''),
          uidOverflow: Number(parsed.uidOverflow || 0),
          ssid: String(parsed.ssid || ''),
          language: Number(parsed.language || 0),
          unit: Number(parsed.unit || 0),
          sound: Number(parsed.sound ?? 1),
          batteryVoltage: Number(parsed.batteryVoltage || 0),
          firmwareUpdatePossible: Number(parsed.firmwareUpdatePossible || 0),
          countrySetting: Number(parsed.countrySetting ?? 1),
          wifiUsageVariable: Number(parsed.wifiUsageVariable ?? 1),
        };
        return 'AK';
      }
      case 'UL': {
        const rawList = Array.isArray(parsed.userList) ? parsed.userList : [];
        this.ULResponse = {
          userCount: Number(parsed.userCount || rawList.length),
          userList: rawList.map((u: Record<string, unknown>) => ({
            uid: String(u.uid || u.UID || ''),
            UID: String(u.uid || u.UID || ''),
            nickName: String(u.nickName || ''),
            lastMeasurement: String(u.lastMeasurement || '000000'),
            pendingDataCount: Number(u.pendingDataCount || 0),
          })),
        };
        return 'UL';
      }
      case 'HO': {
        this.HOResponse = parsed;
        return 'HO';
      }
      case 'HI': {
        this.HIResponse = parsed;
        return 'HI';
      }
      case 'HW': {
        this.HWResponse.weight = Number(parsed.weight || 0);
        return 'HW';
      }
      case 'HS': {
        return 'HS';
      }
      case 'HP': {
        this.HPResponse.statu = Number(parsed.statu || 0);
        return 'HP';
      }
      case 'HE': {
        this.HEResponse.code = String(parsed.code || '');
        this.HWResponse.weight = 0;
        this.HMResponse.progress = 0;
        return 'HE';
      }
      case 'HM': {
        const progress = Number(parsed.progress || 0);
        this.HMResponse.progress = progress;
        return progress === 100 ? 'HM' : 'HP';
      }
      case 'HR':
      case 'UT': {
        this.applyParsedInBodyData(parsed);
        this.HMResponse.progress = 0;
        if (cmd === 'UT') {
          this.UTResponse = {
            UID: String(parsed.UID || ''),
            nickName: String(parsed.nickName || ''),
            index: Number(parsed.index || 0),
            InBodyData: this.InBodyData,
          };
        }
        return cmd;
      }
      case 'WS': {
        const count = Number(parsed.count || 0);
        this.WSResponse.count = count;
        if (count === 0xff || count === 0) {
          return 'RWS';
        }
        return 'WS';
      }
      case 'WR': {
        const rawWifi = Array.isArray(parsed.wifiInfo) ? parsed.wifiInfo : [];
        this.WRResponse = {
          count: Number(parsed.count || 0),
          packageCount: Number(parsed.packageCount || 0),
          readIndex: Number(parsed.readIndex || 0),
          searchedWifiCount: Number(parsed.searchedWifiCount || 0),
          wifiInfo: rawWifi.map((w: Record<string, unknown>) => ({
            SSIDLength: Number(w.ssidLength ?? w.SSIDLength ?? 0),
            SSID: String(w.ssid ?? w.SSID ?? ''),
            MacAddr: String(w.macAddr ?? w.MacAddr ?? ''),
            NetworkMode: Number(w.networkMode ?? w.NetworkMode ?? 0),
            Security: Number(w.security ?? w.Security ?? 0),
            Channel: Number(w.channel ?? w.Channel ?? 0),
            Rssi: Number(w.rssi ?? w.Rssi ?? 0),
          })),
        };
        return 'WR';
      }
      case 'WI': {
        this.WIResponse = {
          code: Number(parsed.code || 0),
          serverRespnse: String(parsed.serverResponse || ''),
        };
        return 'WI';
      }
      case 'DR': {
        this.DRResponse = {
          UID: String(parsed.UID || ''),
          nickName: String(parsed.nickName || ''),
          count: Number(parsed.count || 0),
        };
        return 'DR';
      }
      default:
        return cmd;
    }
  }

  private applyParsedInBodyData(parsed: Record<string, unknown>): void {
    this.InBodyData.DATETIMES = String(parsed.dateTime || '');
    this.InBodyData.HT = Number(parsed.height || 0);
    this.InBodyData.WT = Number(parsed.weight || 0);
    this.InBodyData.PBF = Number(parsed.pbf || 0);
    this.InBodyData.SMM = Number(parsed.smm || 0);
    this.InBodyData.VFALevel = Number(parsed.vfaLevel || 0);
    this.InBodyData.TBW = Number(parsed.tbw || 0);
    this.InBodyData.MINERAL = Number(parsed.mineral || 0);
    this.InBodyData.PROTEIN = Number(parsed.protein || 0);
    this.InBodyData.WHR = Number(parsed.whr || 0);
    this.InBodyData.BMC = Number(parsed.bmc || 0);
    this.InBodyData.SLM = Number(parsed.slm || 0);
    this.InBodyData.BFM = Number(parsed.bfm || 0);
    this.InBodyData.BMI = Number(parsed.bmi || 0);
    this.InBodyData.FS = Number(parsed.fitScore || 0);
    this.InBodyData.BMR = Number(parsed.bmr || 0);
    this.InBodyData.IWT = Number(parsed.iWeight || 0);
    this.InBodyData.ISMM = Number(parsed.iSMM || 0);
    this.InBodyData.IBFM = Number(parsed.iBFM || 0);
    this.InBodyData.PWT = Number(parsed.pwt || 0);

    this.InBodyData.bal_ups = Number(parsed.balUps || 0);
    this.InBodyData.bal_lows = Number(parsed.balLows || 0);
    this.InBodyData.bal_uls = Number(parsed.balUls || 0);

    this.InBodyData.impedance20kHz_RA = Number(parsed.ira20 || 0);
    this.InBodyData.impedance20kHz_LA = Number(parsed.ila20 || 0);
    this.InBodyData.impedance20KHz_T = Number(parsed.it20 || 0);
    this.InBodyData.impedance20kHz_RL = Number(parsed.irl20 || 0);
    this.InBodyData.impedance20kHz_LL = Number(parsed.ill20 || 0);
    this.InBodyData.impedance100kHz_RA = Number(parsed.ira100 || 0);
    this.InBodyData.impedance100kHz_LA = Number(parsed.ila100 || 0);
    this.InBodyData.impedance100kHz_T = Number(parsed.it100 || 0);
    this.InBodyData.impedance100kHz_RL = Number(parsed.irl100 || 0);
    this.InBodyData.impedance100kHz_LL = Number(parsed.ill100 || 0);

    this.InBodyData.TBW_MAX = Number(parsed.tbwMax || 0);
    this.InBodyData.TBW_MIN = Number(parsed.tbwMin || 0);
    this.InBodyData.SLM_MAX = Number(parsed.slmMax || 0);
    this.InBodyData.SLM_MIN = Number(parsed.slmMin || 0);
    this.InBodyData.ODK = Number(parsed.odk || 0);
    this.InBodyData.OBESITY = Number(parsed.obesity || 0);
    this.InBodyData.OD_MAX = Number(parsed.odMax || 0);
    this.InBodyData.OD_MIN = Number(parsed.odMin || 0);
    this.InBodyData.TW = Number(parsed.tw || 0);
    this.InBodyData.WC = Number(parsed.wc || 0);
    this.InBodyData.MC = Number(parsed.mc || 0);
    this.InBodyData.FC = Number(parsed.fc || 0);
    this.InBodyData.BMC_MAX = Number(parsed.bmcMax || 0);
    this.InBodyData.BMC_MIN = Number(parsed.bmcMin || 0);
    this.InBodyData.PROTEIN_MAX = Number(parsed.proteinMax || 0);
    this.InBodyData.PROTEIN_MIN = Number(parsed.proteinMin || 0);
    this.InBodyData.MINERAL_MAX = Number(parsed.mineralMax || 0);
    this.InBodyData.MINERAL_MIN = Number(parsed.mineralMin || 0);

    this.InBodyData.PSMM = Number(parsed.psmm || 0);
    this.InBodyData.pfatnew = Number(parsed.pfatNew || 0);
    this.InBodyData.IBMI = Number(parsed.ibmi || 0);
    this.InBodyData.BMI_MAX = Number(parsed.bmiMax || 0);
    this.InBodyData.BMI_MIN = Number(parsed.bmiMin || 0);
    this.InBodyData.IPBF = Number(parsed.ipbf || 0);
    this.InBodyData.PBF_MAX = Number(parsed.pbfMax || 0);
    this.InBodyData.PBF_MIN = Number(parsed.pbfMin || 0);
    this.InBodyData.IWHR = Number(parsed.iwhr || 0);
    this.InBodyData.WHR_MAX = Number(parsed.whrMax || 0);
    this.InBodyData.WHR_MIN = Number(parsed.whrMin || 0);
    this.InBodyData.ISLM = Number(parsed.islm || 0);
    this.InBodyData.IPROTEIN = Number(parsed.iprotein || 0);
    this.InBodyData.IMINERAL = Number(parsed.imineral || 0);
    this.InBodyData.IBMC = Number(parsed.ibmc || 0);

    this.InBodyData.SEX = Number(parsed.sex || 0);
    this.InBodyData.AGE = Number(parsed.age || 0);
    this.InBodyData.INLL_LV = Number(parsed.inllLv || 0);
  }
}
