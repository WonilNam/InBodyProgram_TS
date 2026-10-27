export type InBodyDeviceType = '120' | 'H20' | 'H30' | 'H40' | 'UNKNOWN';

/**
 * 设备能力标签 —— 用于 SDK 门面层的运行时守卫
 */
export enum DeviceCapability {
  DEVICE_QUERY = 'deviceQuery',     // AK/SR 设备查询
  USER_MGMT = 'userMgmt',          // HO/UL/DD/UI 用户管理
  DEVICE_CONFIG = 'deviceConfig',   // 声音/单位/昵称/WiFi开关
  WIFI = 'wifi',                    // WS/WR/WI WiFi 扫描与连接
  OFFLINE_DATA = 'offlineData',     // DR/UT/DC 离线数据
  MEASURE_CTRL = 'measureCtrl',     // HI/MC 测量控制（手动模式）
  PROGRESS = 'progress',            // 测量进度回调
  POSTURE = 'posture',              // 姿势引导回调
}

/**
 * 各型号支持的能力集合
 */
export const DEVICE_CAPABILITIES: Record<InBodyDeviceType, Set<DeviceCapability>> = {
  'H30': new Set([
    DeviceCapability.DEVICE_QUERY, DeviceCapability.USER_MGMT,
    DeviceCapability.DEVICE_CONFIG, DeviceCapability.WIFI,
    DeviceCapability.OFFLINE_DATA, DeviceCapability.MEASURE_CTRL,
    DeviceCapability.PROGRESS, DeviceCapability.POSTURE,
  ]),
  'H40': new Set([
    DeviceCapability.DEVICE_QUERY, DeviceCapability.USER_MGMT,
    DeviceCapability.DEVICE_CONFIG, DeviceCapability.WIFI,
    DeviceCapability.OFFLINE_DATA, DeviceCapability.MEASURE_CTRL,
    DeviceCapability.PROGRESS, DeviceCapability.POSTURE,
  ]),
  'H20': new Set([]),
  '120': new Set([]),
  'UNKNOWN': new Set([]),
};

export interface InBodyDevice {
  deviceId: string;
  name: string;
  type: InBodyDeviceType;
  RSSI?: number;
}

export interface BleCharacteristic {
  uuid: string;
  properties: {
    read: boolean;
    write: boolean;
    writeNoResponse: boolean;
    notify: boolean;
    indicate: boolean;
  };
}


/**
 * 测量状态机定义 (Measurement State Machine)
 * 包含 InBody 全系设备可能的测量环节全集。
 * 具体设备型号在运行时会依据其 Parser 逻辑跳过不支持的状态。
 */
export enum InBodyDeviceState {
  // --- 1. 基础生命周期 ---
  INITIAL = 0,
  CONNECTING = 1,

  // --- 2. 注册与配置环节 ---
  REGISTERING = 2,
  REGISTER_DONE = 3,
  USER_CONFIGURING = 4,         // 正在下发个人信息
  USER_CONFIG_DONE = 5,         // 个人信息配置完成
  MEASUREMENT_STARTED = 6,      // 测量流程已启动
  
  // --- 3. 交互扩展状态 ---
  WAITING_FOR_STEP_ON = 7,      // 请光脚上秤
  MEASURING_WEIGHT = 8,         // 正在称重...
  WEIGHT_CONFIRMED = 9,         // 体重已锁定
  POSTURE_CHECKING = 10,        // 姿势检查中 (细节通过 onPosture 回调获取 0x30/0x31/0x32)
  ANALYZING = 11,               // 正在分析中 (阻抗测量阶段)

  // --- 4. 最终出口环节 ---
  COMPLETED = 12,
  FAILED = 13,
  CANCELLED = 18,               // 测量已由用户主动取消
}
