import { IInBodyUniversalEvents } from '../../domain/ports/IDeviceService';
import { IDeviceDataTranslator, IWeightTrait, IProgressTrait, IPostureTrait } from '../../domain/ports/IDeviceDataTranslator';
import { InBodyDeviceState } from '../../domain/entities/InBodyDevice.entity';
import { InBodyResult } from '../../domain/entities/DeviceResponse.entity';

/**
 * 【业务反馈中心】ParsedDataBroadcaster
 * 
 * 💡 瘦身说明：
 * 1. 移除了复杂的 Map<symbol>，改用直观的数组。
 * 2. 优化了广播逻辑：集中提取一次数据，分发给所有频道。
 */
export class ParsedDataBroadcaster implements IInBodyUniversalEvents {
  // --- 各个频道的听众名单 ---
  private weightHandlers:   ((w: number) => void)[] = [];
  private progressHandlers: ((p: number) => void)[] = [];
  private postureHandlers:  ((p: number) => void)[] = [];
  private stateHandlers:    ((s: InBodyDeviceState) => void)[] = [];
  private completedHandlers: ((res: InBodyResult) => void)[] = [];
  private errorHandlers:    ((err: Error) => void)[] = [];
  private rawHandlers:      ((res: InBodyResult, parser: IDeviceDataTranslator) => void)[] = [];
  private _lastState: InBodyDeviceState = InBodyDeviceState.INITIAL;

  constructor() {}

  /** 
   * 【核心广播】
   * 由 CommunicationRunner 在收到数据时调用
   */
  public broadcast(result: InBodyResult, parser: IDeviceDataTranslator): void {
    // 1. 先触发原始包监听
    this.rawHandlers.forEach(cb => cb(result, parser));

    // 2. 如果是测量结果包
    if ((result as any).isCompleted) {
      this.completedHandlers.forEach(cb => cb(result));
      this._onInternalStateChange(InBodyDeviceState.COMPLETED);
      return;
    }

    // 3. 【核心优化】集中利用 Trait 提取数据
    // 如果这个型号的解析器支持“提取体重”
    if (this.isWeightable(parser)) {
      const weight = parser.extractWeight(result);
      if (weight !== undefined) this.weightHandlers.forEach(cb => cb(weight));
    }

    // 如果这个型号的解析器支持“提取进度”
    if (this.isProgressable(parser)) {
      const progress = parser.extractProgress(result);
      if (progress !== undefined) this.progressHandlers.forEach(cb => cb(progress));
    }

    // 如果这个型号的解析器支持“提取姿势”
    if (this.isPosturable(parser)) {
      const posture = parser.extractPosture(result);
      if (posture !== undefined) this.postureHandlers.forEach(cb => cb(posture));
    }
  }

  // --- 内部驱动方法 (由 Runner 触发) ---

  public _onInternalStateChange(s: InBodyDeviceState) {
    this._lastState = s;
    this.stateHandlers.forEach(cb => cb(s));
  }

  public get lastState(): InBodyDeviceState {
    return this._lastState;
  }

  public _onInternalCompleted(res: InBodyResult) {
    this.completedHandlers.forEach(cb => cb(res));
  }

  public _onInternalError(err: Error) {
    this.errorHandlers.forEach(cb => cb(err));
  }

  // --- 公开订阅接口 (给 UI 层用) ---

  public onWeight(cb: (w: number) => void) {
    this.weightHandlers.push(cb);
    return () => { this.weightHandlers = this.weightHandlers.filter(h => h !== cb); };
  }

  public onProgress(cb: (p: number) => void) {
    this.progressHandlers.push(cb);
    return () => { this.progressHandlers = this.progressHandlers.filter(h => h !== cb); };
  }

  public onPosture(cb: (p: number) => void) {
    this.postureHandlers.push(cb);
    return () => { this.postureHandlers = this.postureHandlers.filter(h => h !== cb); };
  }

  public onStateChange(cb: (state: InBodyDeviceState) => void) {
    this.stateHandlers.push(cb);
    return () => { this.stateHandlers = this.stateHandlers.filter(h => h !== cb); };
  }

  public onCompleted(cb: (res: InBodyResult) => void) {
    this.completedHandlers.push(cb);
    return () => { this.completedHandlers = this.completedHandlers.filter(h => h !== cb); };
  }

  public onError(cb: (err: Error) => void) {
    this.errorHandlers.push(cb);
    return () => { this.errorHandlers = this.errorHandlers.filter(h => h !== cb); };
  }

  /** 注册原始包监听 (通常用于调试) */
  public subscribe(cb: (result: InBodyResult, parser: IDeviceDataTranslator) => void) {
    this.rawHandlers.push(cb);
    return () => { this.rawHandlers = this.rawHandlers.filter(h => h !== cb); };
  }

  /**
   * 销毁广播站，清理所有监听器
   */
  public destroy() {
    this.rawHandlers = [];
    this.stateHandlers = [];
    this.weightHandlers = [];
    this.progressHandlers = [];
    this.postureHandlers = [];
    this.completedHandlers = [];
    this.errorHandlers = [];
  }

  // --- 类型检查小工具 (Type Guards) ---

  private isWeightable(p: any): p is IWeightTrait {
    return typeof p?.extractWeight === 'function';
  }

  private isProgressable(p: any): p is IProgressTrait {
    return typeof p?.extractProgress === 'function';
  }

  private isPosturable(p: any): p is IPostureTrait {
    return typeof p?.extractPosture === 'function';
  }
}
