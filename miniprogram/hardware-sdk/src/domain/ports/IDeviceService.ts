import { InBodyDeviceState } from '../entities/InBodyDevice.entity'
import { DeviceRequest, StartMeasurementRequest } from '../entities/DeviceRequest.entity';;
import { InBodyResult } from '../entities/DeviceResponse.entity';
// IDeviceDataTranslator is no longer needed here for InBodyResult, already imported.

/**
 * 基础流程事件集 (所有设备必备)
 */
export interface IBaseDeviceEvents {
  onStateChange?: (state: InBodyDeviceState) => void;
  onError?: (err: Error) => void;
  onCompleted?: (result: InBodyResult) => void;
}

/** 实时重量检测能力 */
export interface IWeightFeature { onWeight?: (weight: number) => void; }
/** 测量进度显示能力 */
export interface IProgressFeature { onProgress?: (progress: number) => void; }
/** 姿势引导与视觉纠错能力 */
export interface IPostureFeature { onPosture?: (posture: number) => void; }

/** 内部引擎全量事件接口: 它是所有订阅机制的基础 */
export interface IInBodyUniversalEvents {
  onStateChange(cb: (state: InBodyDeviceState) => void): () => void;
  onError(cb: (err: Error) => void): () => void;
  onCompleted(cb: (res: InBodyResult) => void): () => void;
  onWeight(cb: (w: number) => void): () => void;
  onProgress(cb: (p: number) => void): () => void;
  onPosture(cb: (p: number) => void): () => void;
}

// --- 最终组合：不同型号对应的暴露特征集 ---

/** H40/H30: 全能订阅集 */
export type IH30Handlers = IBaseDeviceEvents & IWeightFeature & IProgressFeature & IPostureFeature;

/** H20: 进阶订阅集 (只有基础 + 体重) */
export type IH20Handlers = IBaseDeviceEvents & IWeightFeature;

/** 120: 基础订阅集 + 体重/进度（w 体重帧，P/p 进度帧） */
export type IInBody120Handlers = IBaseDeviceEvents & IWeightFeature & IProgressFeature;

/**
 * 设备业务服务核心接口 (IDeviceService)
 * 使用泛型 T，让不同型号的服务层自动获得对应能力的参数自动补全。
 */
export interface IDeviceService<T extends IBaseDeviceEvents = IBaseDeviceEvents> {
  /** 
   * 发送单一指令 
   */
  call(action: string, data?: DeviceRequest | Record<string, unknown>): Promise<InBodyResult>;

  /** 
   * 开启流程 
   */
  startAutoMeasurement(params: StartMeasurementRequest): Promise<void>;



  /** 
   * 强类型订阅：
   * 这里的泛型 T，会自动屏蔽当前设备不支持的所有回调选项。
   */
  subscribe(handlers: T): () => void;

  /** 
   * 销毁服务 
   */
  destroy(): void;
}

/**
 * WiFi 特化服务接口 (Interface Segregation)
 * 只有具备 WiFi 模块的设备服务（如 H30/H40）才应该实现此接口
 */
export interface IWifiDeviceService {
  /** 
   * WiFi 扫描：触发设备射频扫描并返回完整热点列表
   */
  wifiScan(): Promise<any[]>;
}
