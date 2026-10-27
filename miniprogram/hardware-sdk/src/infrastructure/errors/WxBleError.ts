import { InBodyError, InBodyErrorCode } from '../../domain/value-objects/InBodyError';

// ─── 微信蓝牙 SDK 平台级错误码 (10000 系列) ───
export enum WxBleErrorCode {
    BLE_NOT_INIT = 10000,           // 未初始化蓝牙适配器
    BLE_NOT_AVAILABLE = 10001,      // 蓝牙适配器不可用（蓝牙未开启）
    BLE_NO_DEVICE = 10002,          // 没有找到指定设备
    BLE_CONNECTION_FAIL = 10003,    // 连接失败
    BLE_NO_SERVICE = 10004,         // 没有找到指定服务
    BLE_NO_CHARACTERISTIC = 10005,  // 没有找到指定特征值
    BLE_NO_CONNECTION = 10006,      // 当前连接已断开
    BLE_PROPERTY_NOT_SUPPORT = 10007, // 当前特征值不支持此操作
    BLE_SYSTEM_ERROR = 10008,       // 系统异常（MTU/时序/并发冲突）
    BLE_SYSTEM_NOT_SUPPORT = 10009, // 系统版本不支持 BLE
    BLE_ALREADY_CONNECTED = 10010,  // 已连接
    BLE_NEED_PIN = 10011,           // 配对设备需要配对码
    BLE_OPERATE_TIMEOUT = 10012,    // 连接超时
    BLE_INVALID_DATA = 10013,       // 参数不正确 / deviceId 为空
}

/**
 * 从微信 wx BLE API 的 fail 回调中创建 InBodyError
 * 将平台级错误码映射到业务层 InBodyError
 */
export function fromWxBle(err: any): InBodyError {
    const errCode = err?.errCode;
    const rawMsg = err?.errMsg || err?.message || JSON.stringify(err) || 'Unknown BLE error';
    
    // 1. 预设特定关键映射
    let code = InBodyErrorCode.ABNORMALERROR;

    if (errCode === WxBleErrorCode.BLE_NOT_AVAILABLE) {
        // 手机蓝牙未开启，映射为物理级未就绪
        code = InBodyErrorCode.ABNORMALERROR; 
    } else if (errCode === WxBleErrorCode.BLE_OPERATE_TIMEOUT) {
        code = InBodyErrorCode.TIMEOUT;
    } else if (Object.values(InBodyErrorCode).includes(errCode)) {
        code = errCode;
    }

    // 如果没匹配到业务码，统一挂载物理码在 message 中以供诊断
    return new InBodyError(code, `[微信物理层错误 ${errCode || '??'}] ${rawMsg}`);
}
