import { IDeviceDataTranslator } from '../../domain/ports/IDeviceDataTranslator';
import { InBodyResult } from '../../domain/entities/DeviceResponse.entity';
import { InBodyDevice, InBodyDeviceState } from '../../domain/entities/InBodyDevice.entity';
import { StartMeasurementRequest } from '../../domain/entities/DeviceRequest.entity';;
import { InBodyMeasurementResult } from '../../domain/entities/MeasurementResult.entity';
import { ProtocolManager } from '../protocols/ProtocolManager';
import { ParsedDataBroadcaster } from './ParsedDataBroadcaster';
import { IBluetoothAdapter } from '../../domain/ports/IBluetoothAdapter';
import { InBodyError, InBodyErrorCode } from '../../domain/value-objects/InBodyError';

/**
 * 基础设施层：统一通信引擎 (CommunicationRunner)
 * 掌管业务层超时等待与状态流转机制。
 */
export class CommunicationRunner {
  private destroyed = false;
  private static readonly DEFAULT_TIMEOUT_MS = 10_000;
  private static readonly STREAM_TIMEOUT_MS  = 30_000;
  private static readonly INBODY120_STREAM_TIMEOUT_MS = 90_000;
  private rawDataUnsub?: () => void;
  private connectionStateUnsub?: () => void;
  public activeDevice?: InBodyDevice;

  private messageQueue: InBodyResult[] = [];
  private pendingAwaiters: Array<{
    acceptedCmds: string[];
    predicate: (result: InBodyResult) => boolean;
    resolve: (value: InBodyResult) => void;
    reject: (error: Error) => void;
    timer: any;
  }> = [];

  constructor(
    private readonly repo: IBluetoothAdapter,
    private readonly protocolManager: ProtocolManager,
    private readonly broadcaster: ParsedDataBroadcaster,
    /** 可选：由外部注入，返回连接后设备实际使用的服务/写特征 UUID */
    private readonly resolveChannel?: () => { deviceId: string; deviceType: string; serviceId: string; writeCharId: string; writeNoResponse: boolean } | null
  ) {
    this.startListening();
    this.connectionStateUnsub = this.repo.onConnectionStateChange((deviceId, connected) => {
      if (!connected && this.activeDevice && deviceId === this.activeDevice.deviceId) {
        console.warn(`[Runner] 检测到活跃设备断开连接: ${deviceId}`);
        this.handleConnectionLoss();
      }
    });
  }

  private handleConnectionLoss() {
    const awaiters = [...this.pendingAwaiters];
    this.pendingAwaiters = [];
    awaiters.forEach(awaiter => {
      clearTimeout(awaiter.timer);
      awaiter.reject(new InBodyError(InBodyErrorCode.ABNORMALDISCONNECT, '[CommunicationRunner] 设备已断开连接'));
    });
  }

  /**
   * 启动蓝牙底层监听链路
   */
  public startListening() {
    if (this.rawDataUnsub) return;

    this.rawDataUnsub = this.repo.onDataReceived((deviceId, _charId, payload) => {
      // activeDevice 已设置时按其过滤；未设置时退回到 resolveChannel（连接后设备主动推帧的场景）
      const channel = this.resolveChannel?.();
      const effectiveDeviceId = this.activeDevice?.deviceId ?? channel?.deviceId;
      const effectiveType     = this.activeDevice?.type     ?? (channel?.deviceType as any);

      if (!effectiveDeviceId || deviceId !== effectiveDeviceId) return;
      if (!effectiveType) return;

      const parser = this.protocolManager.getParser(effectiveType);
      let result: InBodyResult;
      try {
        result = parser.parseIncomingData(effectiveType, payload);
      } catch (e) {
        console.error('[Runner] parseIncomingData 异常，丢弃本帧:', e);
        return;
      }

      while (result && result.cmd && result.cmd !== 'BUFFERING') {
        // 1. 拦截解析进行内部唤醒检查 (替代旧版 broadcaster subscribe 绕远路)
        let handled = false;
        const newAwaiters = [];
        for (const awaiter of this.pendingAwaiters) {
          if (!handled) {
            const matchesCmd = awaiter.acceptedCmds.length === 0 || awaiter.acceptedCmds.indexOf(result.cmd) !== -1;
            const matchesPredicate = awaiter.predicate(result);
            if (matchesCmd && matchesPredicate) {
              clearTimeout(awaiter.timer);
              awaiter.resolve(result);
              handled = true;
              continue;
            }
          }
          newAwaiters.push(awaiter);
        }
        this.pendingAwaiters = newAwaiters;

        if (!handled) {
          this.messageQueue.push(result);
          if (this.messageQueue.length > 50) this.messageQueue.shift();
        }

        // 2. 将有效帧抛给外部 UI 处理 (订阅系统)
        console.log(`[Runner] >>> 分发业务报文: ${result.cmd}`);
        this.broadcaster.broadcast(result as any, parser);

        // 3. 继续游标滑动，榨干缓冲
        try {
          result = parser.parseIncomingData(effectiveType, new ArrayBuffer(0));
        } catch (e) {
          console.error('[Runner] drain parseIncomingData 异常:', e);
          break;
        }
      }
    });
  }

  /**
   * 原 InstructionManager 职责：发送底层报文
   */
  public async sendRaw(device: InBodyDevice, payload: ArrayBuffer): Promise<void> {
    if (this.destroyed) throw new InBodyError(InBodyErrorCode.CANCEL, 'Communication runner disposed');
    const channel = this.resolveChannel?.();
    if (!channel) {
      throw new InBodyError(InBodyErrorCode.NODEVICE, '[CommunicationRunner] 尚未建立连接，无法发送数据');
    }
    console.log(`[Runner] sendRaw → serviceId=${channel.serviceId} charId=${channel.writeCharId} writeNR=${channel.writeNoResponse} len=${payload.byteLength}`);
    await this.repo.writeData(
      device.deviceId,
      channel.serviceId,
      channel.writeCharId,
      payload,
      channel.writeNoResponse
    );
  }

  /** 在交互或全自动测量前，必须设定活跃设备，以过滤数据流 */
  public setActiveDevice(device: InBodyDevice) {
    this.activeDevice = device;
  }

  public destroy() {
    this.destroyed = true;
    this.rawDataUnsub?.();
    this.rawDataUnsub = undefined;
    this.connectionStateUnsub?.();
    this.connectionStateUnsub = undefined;
    this.activeDevice = undefined;
    this.pendingAwaiters.forEach(a => {
        clearTimeout(a.timer);
        a.reject(new InBodyError(InBodyErrorCode.CANCEL, '[CommunicationRunner] Runner destroyed'));
    });
    this.pendingAwaiters = [];
    this.messageQueue = [];
  }

  /**
   * 强行中断所有正在挂起等待回包的 Promise
   */
  private abortPendingAwaiters() {
    const awaiters = [...this.pendingAwaiters];
    this.pendingAwaiters = [];
    awaiters.forEach(a => {
      clearTimeout(a.timer);
      a.reject(new InBodyError(InBodyErrorCode.CANCEL, '[CommunicationRunner] 操作已由用户取消'));
    });
  }

  /**
   * 特定慢指令的超时配置（需要设备物理操作，默认 10s 不够）
   */
  private static readonly COMMAND_TIMEOUT_MAP: Record<string, number> = {
    'WS': 15_000,   // WiFi 扫描
    'WI': 20_000,   // WiFi 连接
    'WA': 20_000,   // WiFi 连接 (新协议)
  };

  /**
   * 发送单条指令并等待对应的协议回包
   */
  public async executeSingle(device: InBodyDevice, action: string, context?: any): Promise<InBodyResult> {
    if (this.destroyed) throw new InBodyError(InBodyErrorCode.CANCEL, 'Communication runner disposed');
    const timeoutMs = CommunicationRunner.COMMAND_TIMEOUT_MAP[action] || CommunicationRunner.DEFAULT_TIMEOUT_MS;
    console.log(`[Runner] 执行指令 [${action}] (timeout=${timeoutMs}ms)`);
    const acceptedCmds = this.protocolManager.getExpectedResponseCmds(device, action);

    const cmd = this.protocolManager.buildOut(device, action, context);

    // 精准拦截 WiFi 配置指令的物理空 ACK 包
    const predicate = (res: any) => {
        if ((res.cmd === 'WI' || res.cmd === 'WA') && res.code === undefined) {
            console.log(`[Runner] 捕获到 ${res.cmd} 中间物理空确认，忽略并继续等待最终结果包...`);
            return false;
        }
        return true;
    };

    if (action === 'MC') {
        this.broadcaster._onInternalStateChange(InBodyDeviceState.CANCELLED);
        this.abortPendingAwaiters();
    }

    return this._settle(acceptedCmds, timeoutMs, () =>
        this.sendRaw(device, cmd),
        predicate
    );
  }

  private static readonly AK_MAX_RETRIES = 3;
  private static readonly AK_RETRY_DELAY_MS = 1_000;

  private getInitialMeasurementAction(device: InBodyDevice): string {
    if (device.type === 'H20') return 'HC';
    return device.type === '120' ? 't' : 'AK';
  }

  /**
   * 核心状态机执行器 —— 自动化测量流程
   */
  public async runAutoMeasurement(
    device: InBodyDevice,
    params: StartMeasurementRequest,
    onStateChange: (s: InBodyDeviceState) => void,
    onComplete: (m: InBodyMeasurementResult) => void
  ): Promise<void> {

    this.setActiveDevice(device);
    let state: InBodyDeviceState = InBodyDeviceState.INITIAL;
    onStateChange(state);

    // 起步握手：H30/H40 使用 AK，H20 使用 HC，InBody120 按 PDF 先使用 t 同步时间/单位
    const initialAction = this.getInitialMeasurementAction(device);
    let parsedResult!: InBodyResult;
    for (let attempt = 1; attempt <= CommunicationRunner.AK_MAX_RETRIES; attempt++) {
      try {
        parsedResult = await this.executeSingle(device, initialAction, params);
        break; // 握手成功
      } catch (err) {
        if (this.destroyed || (err instanceof InBodyError &&
            (err.code === InBodyErrorCode.CANCEL || err.code === InBodyErrorCode.ABNORMALDISCONNECT))) {
          throw err;
        }
        console.warn(`[Runner] ${initialAction}握手无响应 (第 ${attempt}/${CommunicationRunner.AK_MAX_RETRIES} 次): ${err}`);
        if (attempt === CommunicationRunner.AK_MAX_RETRIES) {
          // 重试耗尽，通知状态机失败并上抛
          onStateChange(InBodyDeviceState.FAILED);
          throw err;
        }
        // 等待后重试
        await new Promise(r => setTimeout(r, CommunicationRunner.AK_RETRY_DELAY_MS));
      }
    }

    // 测量主循环：任意步骤超时也需转为 FAILED
    try {
      while (true) {
        // 【熔断机制】如果检测到状态已变为 FAILED 或 CANCELLED，立即终止测量循环
        if ((state as InBodyDeviceState) === InBodyDeviceState.FAILED || this.broadcaster.lastState === InBodyDeviceState.CANCELLED) {
          console.log(`[Runner] 测量循环检测到已终止(state=${state}, lastState=${this.broadcaster.lastState})，正在退出...`);
          break;
        }

        const step: any = this.protocolManager.evaluateTransition(device, state, parsedResult, params);

        if (step.nextState !== state) {
          console.log(`[Runner] 状态机跳转: ${state} -> ${step.nextState}`);
          state = step.nextState;
          onStateChange(state);
        }

        if ((state as InBodyDeviceState) === InBodyDeviceState.FAILED) {
          throw new InBodyError(
            InBodyErrorCode.ABNORMALERROR,
            `[CommunicationRunner] 设备返回测量失败指令: ${parsedResult.cmd || 'UNKNOWN'}`
          );
        }

        if (state === InBodyDeviceState.COMPLETED) {
          const finalData = {
            ...parsedResult,
            uid: params.uid,
            sex: params.sex === 'M' ? 1 : 0,
            age: params.age,
            height: params.height,
          } as unknown as InBodyMeasurementResult;
          onComplete(finalData);
          return;
        }

        if (step.nextCommand) {
          const { action, context } = step.nextCommand;
          if (step.delayMs && step.delayMs > 0) {
            await new Promise(r => setTimeout(r, step.delayMs));
          }
          parsedResult = await this.executeSingle(device, action, context);
        } else {
          // 等待下一帧入场包（如状态 SR，或主动推送的 HW, HM 等）
          const streamTimeoutMs = device.type === '120'
            ? CommunicationRunner.INBODY120_STREAM_TIMEOUT_MS
            : CommunicationRunner.STREAM_TIMEOUT_MS;
          console.log(`[Runner] 等待设备主动推送下一帧 (timeout=${streamTimeoutMs}ms)`);
          parsedResult = await this._settle([], streamTimeoutMs, undefined,
            r => (r as any).isCompleted || (r.cmd && ['SR', 'HW', 'HM', 'HP', 'HR', 'HC', 'HA', 'RE', 'w', 'P', 'p', 'e', 'r'].indexOf(r.cmd) !== -1)
          );
        }
      }
    } catch (err) {
      // 如果用户已经主动取消了，捕获到的断连或超时就不再报 error
      if (this.broadcaster.lastState === InBodyDeviceState.CANCELLED) {
        console.log('[Runner] 测量已由用户主动取消，静默终止流程');
        return;
      }
      console.error('[Runner] 测量过程异常，转为 FAILED:', err);
      onStateChange(InBodyDeviceState.FAILED);
      throw err;
    }
  }

  /**
   * WiFi 扫描全链路引擎：发送 WS 触发扫描 → 自动循环拉取 WR 分包 → 返回完整 WiFi 列表
   */
  private static readonly WIFI_SCAN_TIMEOUT_MS = 20_000; // WiFi 物理射频扫描需要更长超时

  public async executeWifiScan(device: InBodyDevice): Promise<any[]> {
    this.setActiveDevice(device);

    // 1. 发送 WS 触发设备扫描
    console.log('[Runner] WiFi扫描: 发送 WS 触发扫描...');
    const wsResult = await this.executeSingleWithTimeout(device, 'WS', undefined, CommunicationRunner.WIFI_SCAN_TIMEOUT_MS);

    // 2. 判断扫描结果: count == 0 或 0xFF 表示无热点
    const count = (wsResult as any).count;
    if (!count || count === 0 || count === 255 || count === 0xff) {
      console.log('[Runner] WiFi扫描完成，共找到 0 个热点，跳过 WR 分包拉取');
      return [];
    }

    // 3. 循环拉取 WR 分包数据
    let allWifiList: any[] = [];
    let packageIndex = 0; // legacy_js 中 WRCommand.packageIndex 从 0 开始

    while (true) {
      console.log(`[Runner] WiFi扫描: 拉取 WR 分包 packageIndex=${packageIndex}...`);
      const wrResult = await this.executeSingle(device, 'WR', { packageIndex });

      if (wrResult && (wrResult as any).wifiInfo) {
        allWifiList = allWifiList.concat((wrResult as any).wifiInfo);
      }

      const totalPackages = (wrResult as any)?.packageCount || 0;
      
      if (totalPackages === 0 || packageIndex >= totalPackages - 1) {
        break;
      }
      packageIndex++;
    }

    console.log(`[Runner] WiFi扫描完成，共获取 ${allWifiList.length} 个热点`);
    return allWifiList;
  }

  /**
   * executeSingle 的自定义超时版本（用于 WS 等需要更长等待的指令）
   */
  private async executeSingleWithTimeout(device: InBodyDevice, action: string, context?: any, timeoutMs?: number): Promise<InBodyResult> {
    console.log(`[Runner] 执行指令 [${action}] (timeout=${timeoutMs}ms)`);
    const acceptedCmds = this.protocolManager.getExpectedResponseCmds(device, action);
    const cmd = this.protocolManager.buildOut(device, action, context);
    return this._settle(acceptedCmds, timeoutMs || CommunicationRunner.DEFAULT_TIMEOUT_MS, () =>
      this.sendRaw(device, cmd)
    );
  }

  private _settle(
    acceptedCmds: string[],
    timeoutMs: number,
    writeFn?: () => Promise<void>,
    predicate: (result: InBodyResult) => boolean = () => true
  ): Promise<InBodyResult> {
    return new Promise<InBodyResult>((resolve, reject) => {
      if (this.destroyed) {
        reject(new InBodyError(InBodyErrorCode.CANCEL, 'Communication runner disposed'));
        return;
      }
      
      const idx = this.messageQueue.findIndex(r => {
        const matchesCmd = acceptedCmds.length === 0 || (r.cmd && acceptedCmds.indexOf(r.cmd) !== -1);
        return matchesCmd && predicate(r);
      });

      if (idx !== -1) {
        const result = this.messageQueue[idx];
        this.messageQueue.splice(0, idx + 1);
        if (writeFn) {
            writeFn().then(() => resolve(result)).catch(reject);
        } else {
            resolve(result);
        }
        return;
      }

      const timer = setTimeout(() => {
        const index = this.pendingAwaiters.findIndex(a => a.timer === timer);
        if (index !== -1) this.pendingAwaiters.splice(index, 1);
        reject(new InBodyError(InBodyErrorCode.TIMEOUT, `[CommunicationRunner] 等待超时 (${timeoutMs}ms)`));
      }, timeoutMs);

      this.pendingAwaiters.push({ acceptedCmds, predicate, resolve, reject, timer });

      if (writeFn) {
        writeFn().catch(err => {
          clearTimeout(timer);
          const index = this.pendingAwaiters.findIndex(a => a.timer === timer);
          if (index !== -1) this.pendingAwaiters.splice(index, 1);
          reject(err);
        });
      }
    });
  }
}
