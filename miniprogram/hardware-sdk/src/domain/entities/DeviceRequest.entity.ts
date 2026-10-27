/**
 * 通用协议动作参数体系 (H30/H40)
 */

/**
 * 测量流程的入参与状态机定义
 * 注: 测量结果数据结构请参考 InBodyResult.entity.ts 中的 InBodyMeasurementResult
 */

/**
 * 宿主小程序传入测量用例所需的入参DTO
 */
export interface StartMeasurementRequest {
  uid: string;
  age: number;
  height: number;
  sex: 'M' | 'F';  // M=1, F=0 (通常体脂秤协议中约定)
  /** 仅 H30/H40 的 HO 环境设置指令需要 */
  nickname?: string;
}

/** HO: 环境设置 */
export interface SetupRequest {
  language: number;      // 0:KOR, 1:ENG...
  unit: number;          // 0:kg/cm, 1:kg/inch, 2:lbs/cm, 3:lbs/inch
  sound: number;         // 0:Off, 1:On
  UID: string;           // 手机标识 (25 bytes)
  nickName: string;      // 昵称 (6 bytes)
  wifiUsage: number;     // 0:Off, 1:On
  sex: 'M' | 'F';
  age: number;
  height: number;
  rangeCountry: number;  // 0:KOR, 1:CHN, 2:JPN, 3:OTHER ASIA, 4:USA, 5:OTHERS
  url: string;           // API URL
  urlByteCount: number;
  powerSaveModeEnable: number; // 0:OFF, 1:ON
  powerSaveMode: number;       // 0:Normal, 1:Low Power, 2:Hibernation
}

/** HI: 个人资料下发 */
export interface PersonalInfoRequest {
  sex?: 'M' | 'F';
  age: number;
  height: number;
  weight?: number;
  pbf?: number;
  slm?: number;
}

/** WI: Wi-Fi 配置库 */
export interface WifiConfigRequest {
  SSID: string;
  password?: string;
  url: string;
}

/** WR: Wi-Fi 扫描包请求 */
export interface WifiScanRequest {
  packageIndex: number;
}

/** IC: 信息变更 */
export interface InfoChangeRequest {
  UID: string;
  nickName: string;
  sex: 'M' | 'F';
  age: number;
  height: number;
}

/** DC: 数据保存结果确认 (Data Confirm) */
export interface DataConfirmRequest {
  UID: string;
  nickName: string;
  saveResult: Array<{ result: number; dateTimes: string }>;
}

/** DD: 用户数据删除 */
export interface DataDeleteRequest {
  userList: Array<{ UID: string; nickName: string }>;
}

/** DR: 数据提取请求 */
export interface DataRequestRequest {
  UID: string;
  nickName: string;
}

/** UT: 用户数据传输 */
export interface UserTransferRequest {
  UID: string;
  nickName: string;
  index: number;
}

/** DK: 设定数据种类 */
export interface DataKindRequest {
  kind: number;
}

export type DeviceRequest = 
  | SetupRequest 
  | PersonalInfoRequest 
  | WifiConfigRequest 
  | WifiScanRequest 
  | InfoChangeRequest
  | DataConfirmRequest
  | DataDeleteRequest
  | DataRequestRequest
  | UserTransferRequest
  | DataKindRequest;
