/**
 * 设备响应类型定义 (Device Responses)
 * 设备返回的协议响应帧，经解析器解码后的结构化数据
 */

/**
 * 基础通信产物：所有物理包解析后必须具有的核心识别字段
 */
export interface BaseDeviceResponse {
    deviceId: string;
    isCompleted: boolean;
    cmd?: string;
}

// =========================================================
// 瞬时事件消息 (Transient Events, isCompleted = false)
// =========================================================

/** 重量流数据 (如 H30 的 HW指令) */
export interface WeightResponse extends BaseDeviceResponse {
    cmd: 'HW';
    weight: number;
}

/** 测量进度 (如 H30 的 HM指令) */
export interface ProgressResponse extends BaseDeviceResponse {
    cmd: 'HM';
    progress: number;
}

/** 姿势校验 (如 H30 的 HP指令) */
export interface PostureResponse extends BaseDeviceResponse {
    cmd: 'HP';
    statu: number;
}

/** 设备系统状态及连接防呆 (如 SR, BUFFERING) */
export interface SystemResponse extends BaseDeviceResponse {
    cmd: 'SR' | 'RE' | 'BUFFERING';
    statu?: number;
    deviceState?: number;
}

/** 设备唤醒与初次通信应答 (AK) */
export interface AckResponse extends BaseDeviceResponse {
    cmd: 'AK';
    serialNumber?: string;
    programVersion?: string;
    wifiUsageVariable?: number;
    UID?: string;
    nickName?: string;
    uidOverflow?: number;
    ssid?: string;
    language?: number;
    unit?: number;
    sound?: number;
    batteryVoltage?: number;
    firmwareUpdatePossible?: number;
    countrySetting?: number;
    wifiStatus?: number;
}

/** 设定参数返回 (HO) */
export interface SetupResponse extends BaseDeviceResponse {
    cmd: 'HO';
    serialNumber?: string;
    programVersion?: string;
    wifiUsageVariable?: number;
    UID?: string;
    nickName?: string;
    uidOverflow?: number;
    language?: number;
    unit?: number;
    sound?: number;
    wifiStatus?: number;
    sex?: number; 
    age?: number;
    height?: number;
    rangeCountry?: number;
    urlByteCount?: number;
    urlReturn?: string;
    powerSaveModeEnable?: number;
    powerSaveMode?: number;
}

/** 用户列表查询返回 (UL) */
export interface UserListResponse extends BaseDeviceResponse {
    cmd: 'UL';
    userCount?: number;
    userList?: Array<{
        uid: string;
        nickName: string;
        lastMeasurement: string;
        pendingDataCount: number;
    }>;
}

/** 个人身型初调返回 (如 H30 的 HI) */
export interface PersonalInfoResponse extends BaseDeviceResponse {
    cmd: 'HI';
    sex?: number;
    age?: number;
    height?: number;
    weight?: number;
    pbf?: number;
    slm?: number;
}

/** 设备报错返回 (如 H30 的 HE) */
export interface ErrorResponse extends BaseDeviceResponse {
    cmd: 'HE';
    code?: string;
}

/** Wi-Fi 扫描结果 (如 H30 的 WR) */
export interface WifiScanResponse extends BaseDeviceResponse {
    cmd: 'WR';
    count?: number;
    packageCount?: number;
    readIndex?: number;
    searchedWifiCount?: number;
    wifiInfo?: Array<{
        ssid: string;
        macAddr: string;
        networkMode: number;
        security: number;
        channel: number;
        rssi: number;
    }>;
}

/** Wi-Fi 配置返回 (如 H30 的 WI) */
export interface WifiConnectResponse extends BaseDeviceResponse {
    cmd: 'WI';
    code?: number;
    serverResponse?: string;
}

/** Wi-Fi 固件数据传输返回 (如 H30 的 WD) */
export interface WifiDataTransferResponse extends BaseDeviceResponse {
    cmd: 'WD';
    packetNum: number;
    _packetNum: number;
    packetIndex: number;
    statu: string;
    code: number;
}

/** 离线数据请求返回 (如 H30 的 DR) */
export interface DataRequestResponse extends BaseDeviceResponse {
    cmd: 'DR';
    UID?: string;
    nickName?: string;
    count?: number;
}

/** 离线数据确认返回 (如 H30 的 DC) */
export interface DataConfirmResponse extends BaseDeviceResponse {
    cmd: 'DC';
    isSaveCompleted?: boolean;
}

/** 离线数据删除返回 (如 H30 的 DD) */
export interface DataDeleteResponse extends BaseDeviceResponse {
    cmd: 'DD';
    userCount?: number;
    userList?: Array<{
        uid: string;
        nickName: string;
        lastMeasurement: string;
        pendingDataCount: number;
    }>;
}

/** 无业务载荷的确认帧 */
export interface CommandAckResponse extends BaseDeviceResponse {
    cmd: 'DK' | 'MC' | 'UI' | 'SV' | 'WU' | 'WC';
}

// =========================================================
// 统一聚合类型 (含响应消息 + 测量结果)
// =========================================================
import type { InBodyMeasurementResult } from './MeasurementResult.entity';

/** SDK 向外层广播或被 Promise 拦截的聚合结果类型 */
export type InBodyResult = 
    | WeightResponse 
    | ProgressResponse 
    | PostureResponse 
    | SystemResponse 
    | AckResponse
    | SetupResponse
    | UserListResponse
    | PersonalInfoResponse
    | ErrorResponse
    | WifiScanResponse
    | WifiConnectResponse
    | WifiDataTransferResponse
    | DataRequestResponse
    | DataConfirmResponse
    | DataDeleteResponse
    | CommandAckResponse
    | InBodyMeasurementResult;
