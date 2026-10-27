import * as hardwareSdk from '../../../hardware-sdk/index';
import { InBodyDevice, InBodyDeviceState, InBodyDeviceType } from '../../../hardware-sdk/src/domain/entities/InBodyDevice.entity';
import { InBodyResult } from '../../../hardware-sdk/src/domain/entities/DeviceResponse.entity';
import { BoundEquipment, UserProfile } from '../../domain/entities/UserProfile.entity';
import { IAudioPlayer } from '../../domain/ports/IAudioPlayer';
import { IHttpClient } from '../../domain/ports/IHttpClient';
import { IStorageRepository } from '../../domain/ports/IStorageRepository';
import { AuthStore } from '../stores/AuthStore';
import { MeasureSessionStore } from '../stores/MeasureSessionStore';
import { ReportAppService } from './ReportAppService';
import { buildUploadRequest, DIAL_UPLOAD_PATH, INBODY120_UPLOAD_URL } from '../../infrastructure/mappers/MeasurementUploadMapper';

interface MeasurementSession {
  readonly profile: UserProfile;
  readonly equipment: BoundEquipment | null;
  readonly authVersion: number;
  readonly deviceType: InBodyDeviceType;
  completed: boolean;
  upload?: { url: string; payload: Record<string, unknown> };
  uploadPromise?: Promise<void>;
}

export class MeasurementWorkflowService {
  static readonly INBODY120_UPLOAD_URL = INBODY120_UPLOAD_URL;
  static readonly DIAL_UPLOAD_PATH = DIAL_UPLOAD_PATH;

  private session: MeasurementSession | null = null;
  private subscriptions: Array<() => void> = [];
  private connecting: Promise<unknown> | null = null;
  private releasing: Promise<void> = Promise.resolve();
  private startGeneration = 0;
  private resuming: Promise<void> | null = null;

  constructor(
    private readonly authStore: AuthStore,
    private readonly measureStore: MeasureSessionStore,
    private readonly reportService: ReportAppService,
    private readonly http: IHttpClient,
    private readonly audio: IAudioPlayer,
    private readonly sdk: typeof hardwareSdk = hardwareSdk,
    private readonly prepareConnection: () => Promise<void> = async () => {},
    private readonly storage?: IStorageRepository
  ) {}

  async startMeasurementSession(deviceType: InBodyDeviceType, targetDeviceId?: string): Promise<void> {
    const generation = ++this.startGeneration;
    if (this.session) await this.releaseSession();
    await this.releasing;
    if (generation !== this.startGeneration) return;

    const auth = this.authStore.getState();
    const profile = auth.profile;
    if (!profile?.uid || !auth.isAuthenticated) throw new Error('请先登录后再进行测量');
    if (!profile.gender || profile.age <= 0 || profile.height <= 0) {
      throw new Error('请先完善性别、年龄与身高信息');
    }
    if (deviceType === 'UNKNOWN') throw new Error('请选择支持的设备型号');

    const session: MeasurementSession = {
      profile: { ...profile },
      equipment: auth.boundEquipment ? { ...auth.boundEquipment } : null,
      authVersion: this.authStore.getSessionVersion(),
      deviceType,
      completed: false,
    };
    this.session = session;
    this.measureStore.startSession(deviceType);
    this.subscriptions.push(this.authStore.subscribe(() => {
      if (session.authVersion !== this.authStore.getSessionVersion()) void this.cancelSession();
    }, false));

    try {
      const preparation = this.prepareConnection();
      this.connecting = preparation;
      try {
        await preparation;
      } finally {
        if (this.connecting === preparation) this.connecting = null;
      }
      if (!this.isCurrent(session)) return;
      this.sdk.init(deviceType);
      this.subscriptions.push(this.sdk.onConnectionStateChange((connected) => {
        if (this.isCurrent(session)) this.measureStore.setState({ connected });
      }));
      this.subscriptions.push(this.sdk.subscribe({
        onStateChange: (deviceState) => {
          if (!this.isCurrent(session) || session.completed || deviceState === InBodyDeviceState.COMPLETED) return;
          this.measureStore.setState({ deviceState });
          this.audio.playByMeasureState(deviceState);
        },
        onWeight: (realtimeWeight) => {
          if (this.isCurrent(session) && !session.completed) this.measureStore.setState({ realtimeWeight });
        },
        onProgress: (progress) => {
          if (this.isCurrent(session) && !session.completed) this.measureStore.setState({ progress });
        },
        onPosture: (postureCode) => {
          if (this.isCurrent(session) && !session.completed) this.measureStore.setState({ postureCode });
        },
        onCompleted: (result) => this.completeSession(session, result),
        onError: (error) => {
          if (this.isCurrent(session) && !session.completed) this.failSession(error);
        },
      }));

      let target: string | InBodyDevice | undefined = targetDeviceId ??
        (session.equipment?.deviceType === deviceType ? session.equipment.deviceId : undefined);
      if (!target) {
        const devices = await this.sdk.scan(undefined, 8000);
        if (!this.isCurrent(session)) return;
        target = devices.find(device => device.type === deviceType);
        if (!target) throw new Error('未搜索到附近的 InBody 设备，请确认设备已开启');
      }
      if (!this.isCurrent(session)) return;
      const connection = this.sdk.connect(target);
      this.connecting = connection;
      try {
        await connection;
      } finally {
        if (this.connecting === connection) this.connecting = null;
      }
      if (!this.isCurrent(session)) return;
      await this.sdk.startAutoMeasurement({
        uid: profile.uid,
        nickname: profile.name || 'User',
        sex: profile.gender,
        age: profile.age,
        height: profile.height,
      });
    } catch (error) {
      if (!this.isCurrent(session) || session.completed) return;
      this.failSession(error);
    }
  }

  cancelSession(): Promise<void> {
    this.startGeneration++;
    const cleanup = this.releaseSession();
    this.measureStore.closeSession();
    return cleanup;
  }

  async retryUpload(): Promise<void> {
    const session = this.session;
    if (!session || !this.isCurrent(session) || !session.upload ||
        this.measureStore.getState().uploadStatus !== 'failed') return;
    await this.uploadAndRefresh(session);
  }

  /**
   * Re-sends a result persisted by a previous process that never confirmed its upload.
   * The server idempotency contract is unconfirmed, so a lost response may duplicate a record.
   */
  resumePendingUpload(): Promise<void> {
    if (this.resuming) return this.resuming;
    const task = this.doResumePendingUpload().finally(() => { this.resuming = null; });
    this.resuming = task;
    return task;
  }

  private async doResumePendingUpload(): Promise<void> {
    const pending = this.storage?.get('measure:pendingUpload');
    if (!pending) return;
    const auth = this.authStore.getState();
    // A live session owns its own upload; another account's result stays untouched.
    if (this.session || !auth.isAuthenticated || auth.profile?.uid !== pending.uid) return;
    const version = this.authStore.getSessionVersion();
    try {
      await this.http.postEnvelope(pending.url, pending.payload);
    } catch {
      return; // Kept for the next launch or login.
    }
    this.clearPending(pending);
    if (version !== this.authStore.getSessionVersion()) return;
    try { await this.reportService.invalidateAndRefresh(); } catch { /* History refreshes on next load. */ }
  }

  private clearPending(upload: { url: string; payload: Record<string, unknown> }): void {
    const current = this.storage?.get('measure:pendingUpload');
    if (current && current.url === upload.url && JSON.stringify(current.payload) === JSON.stringify(upload.payload)) {
      this.storage?.remove('measure:pendingUpload');
    }
  }

  private isCurrent(session: MeasurementSession): boolean {
    return this.session === session && session.authVersion === this.authStore.getSessionVersion();
  }

  private failSession(error: unknown): void {
    this.measureStore.setState({
      deviceState: InBodyDeviceState.FAILED,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    void this.releaseSession();
  }

  private async completeSession(session: MeasurementSession, result: InBodyResult): Promise<void> {
    if (!this.isCurrent(session) || session.completed) return;
    const weight = (result as { weight?: unknown }).weight;
    if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) {
      this.failSession(new Error('测量结果缺少有效体重，报告未上传，请重新测量'));
      return;
    }
    session.completed = true;
    this.audio.playByMeasureState(InBodyDeviceState.COMPLETED);
    this.measureStore.setState({
      deviceState: InBodyDeviceState.COMPLETED, completedResult: result, realtimeWeight: weight,
    });
    try {
      // onCompleted is the SDK completion contract; the public facade removes transport flags.
      session.upload = buildUploadRequest(session.deviceType, { ...result, isCompleted: true }, {
        profile: session.profile,
        datetimes: this.formatNow14Digits(),
        equipSerial: session.equipment?.serialNumber ?? '',
      });
      this.storage?.set('measure:pendingUpload', { uid: session.profile.uid, ...session.upload });
      await this.uploadAndRefresh(session);
    } catch (error) {
      if (this.isCurrent(session)) this.measureStore.setState({
        uploadStatus: 'failed',
        errorMessage: error instanceof Error ? error.message : '测量结果无法保存',
      });
    }
  }

  private async uploadAndRefresh(session: MeasurementSession): Promise<void> {
    if (session.uploadPromise) return session.uploadPromise;
    if (!session.upload || !this.isCurrent(session)) return;
    const upload = session.upload;
    this.measureStore.setState({ uploadStatus: 'uploading', errorMessage: null });
    const task = (async () => {
      try {
        await this.http.postEnvelope(upload.url, upload.payload);
      } catch (error) {
        if (this.isCurrent(session)) this.measureStore.setState({
          uploadStatus: 'failed',
          errorMessage: `测量已完成，报告保存失败：${error instanceof Error ? error.message : String(error)}`,
        });
        return;
      }
      // The server has the record even if the user has since switched account, so drop it regardless.
      this.clearPending(upload);
      if (!this.isCurrent(session)) return;
      this.measureStore.setState({ uploadStatus: 'saved' });
      try {
        await this.reportService.invalidateAndRefresh();
      } catch {
        if (this.isCurrent(session)) this.measureStore.setState({
          errorMessage: '报告已保存，历史记录刷新失败，请稍后刷新首页',
        });
      }
    })();
    session.uploadPromise = task;
    try {
      await task;
    } finally {
      session.uploadPromise = undefined;
    }
  }

  private releaseSession(): Promise<void> {
    const session = this.session;
    if (!session) return this.releasing;
    this.session = null;
    for (const unsubscribe of this.subscriptions.splice(0)) unsubscribe();
    this.audio.stop();
    const connecting = this.connecting;
    const connected = this.measureStore.getState().connected;
    this.releasing = (async () => {
      await Promise.allSettled([
        Promise.resolve().then(() => this.sdk.stopScan()),
        connected && !session.completed
          ? Promise.resolve().then(() => this.sdk.setCancelMeasure())
          : Promise.resolve(),
      ]);
      // A native connect may finish after cancellation. Close it before another session can init.
      if (connecting) await connecting.catch(() => {});
      try { await this.sdk.disconnect(); } catch { /* Already disconnected. */ }
      this.measureStore.setState({ connected: false });
    })();
    return this.releasing;
  }

  private formatNow14Digits(): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  }
}
