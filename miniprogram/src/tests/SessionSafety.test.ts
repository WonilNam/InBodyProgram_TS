import type * as HardwareSdk from '../../hardware-sdk/index';
import { InBodyDeviceState } from '../../hardware-sdk/src/domain/entities/InBodyDevice.entity';
import { AuthAppService } from '../application/services/AuthAppService';
import { MeasurementWorkflowService } from '../application/services/MeasurementWorkflowService';
import { ReportAppService } from '../application/services/ReportAppService';
import { AuthStore } from '../application/stores/AuthStore';
import { MeasureSessionStore } from '../application/stores/MeasureSessionStore';
import { ReportStore } from '../application/stores/ReportStore';
import { BcaReportMapper } from '../infrastructure/mappers/BcaReportMapper';
import { WxStorageRepository } from '../infrastructure/adapters/WxStorageRepository';
import { UserProfile } from '../domain/entities/UserProfile.entity';
import { IStorageRepository, StorageSchema } from '../domain/ports/IStorageRepository';
import { IHttpClient } from '../domain/ports/IHttpClient';
import { IAudioPlayer } from '../domain/ports/IAudioPlayer';

class MemoryStorage implements IStorageRepository {
  private readonly values = new Map<keyof StorageSchema, unknown>();
  get<K extends keyof StorageSchema>(key: K): StorageSchema[K] | null {
    return (this.values.get(key) as StorageSchema[K] | undefined) ?? null;
  }
  set<K extends keyof StorageSchema>(key: K, value: StorageSchema[K]): void { this.values.set(key, value); }
  remove<K extends keyof StorageSchema>(key: K): void { this.values.delete(key); }
  clearAll(): void { this.values.clear(); }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
const A: UserProfile = { uid: 'A', telHP: '13800000000', name: 'Alice', gender: 'F', age: 28, height: 165 };
const B: UserProfile = { uid: 'B', telHP: '13900000000', name: 'Bob', gender: 'M', age: 32, height: 178 };
const record = { UID_DATETIMES: 'A_20261027120000', DATETIMES: '20261027120000', EQUIP: 'H30', WT: 60, SMM: 25, PBF: 20 };
type Handlers = Parameters<typeof HardwareSdk.subscribe>[0];

function harness() {
  const storage = new MemoryStorage();
  const auth = new AuthStore();
  auth.setAuthenticatedUser(A);
  storage.set('auth:profile', A);
  const reports = new ReportStore();
  const measure = new MeasureSessionStore();
  const http: jest.Mocked<IHttpClient> = { request: jest.fn(), postEnvelope: jest.fn().mockResolvedValue([]) };
  const audio: jest.Mocked<IAudioPlayer> = {
    playByMeasureState: jest.fn(), playFile: jest.fn(), stop: jest.fn(), destroy: jest.fn(),
  };
  const reportService = new ReportAppService(http, storage, auth, reports);
  const authService = new AuthAppService(http, storage, auth, reportService);
  let observer: Handlers = {};
  const unsubscribe = jest.fn();
  const connectionUnsubscribe = jest.fn();
  const sdk = {
    init: jest.fn(),
    scan: jest.fn().mockResolvedValue([{ deviceId: 'device-A', type: 'H30', name: 'H30' }]),
    stopScan: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    onConnectionStateChange: jest.fn().mockReturnValue(connectionUnsubscribe),
    subscribe: jest.fn((handlers: Handlers) => { observer = handlers; return unsubscribe; }),
    startAutoMeasurement: jest.fn().mockResolvedValue(undefined),
    setCancelMeasure: jest.fn().mockResolvedValue(undefined),
  };
  const workflow = new MeasurementWorkflowService(auth, measure, reportService, http, audio, sdk as unknown as typeof HardwareSdk);
  return { storage, auth, reports, measure, http, reportService, authService, workflow, sdk, audio,
    observer: () => observer, unsubscribe, connectionUnsubscribe };
}

describe('Session ownership and asynchronous invalidation', () => {
  it('does not fetch history when bootstrapping a guest with an incomplete stored identity', async () => {
    const h = harness();
    h.storage.set('auth:profile', { ...A, telHP: '' });
    h.reports.setRecords(BcaReportMapper.toChronologicalDescList([record]));
    const result = await h.authService.bootstrapSession();
    expect(result.isGuest).toBe(true);
    expect(h.http.postEnvelope).not.toHaveBeenCalled();
    expect(h.reports.getState().records).toHaveLength(0);
  });

  it('does not restore authentication when an old member response arrives after logout', async () => {
    const h = harness();
    const response = deferred<unknown>();
    h.http.postEnvelope.mockReturnValueOnce(response.promise);
    h.reports.setRecords(BcaReportMapper.toChronologicalDescList([record]));
    const pending = h.authService.refreshMemberProfile(A.uid, A.telHP);
    h.authService.logout();
    expect(h.reports.getState().records).toHaveLength(0);
    response.resolve([{ Name: 'Delayed Alice' }]);
    expect(await pending).toBeNull();
    expect(h.auth.getState().isAuthenticated).toBe(false);
    expect(h.storage.get('auth:profile')).toBeNull();
  });

  it('ignores a stale member response after switching accounts', async () => {
    const h = harness();
    const response = deferred<unknown>();
    h.http.postEnvelope.mockReturnValueOnce(response.promise);
    const pending = h.authService.refreshMemberProfile(A.uid, A.telHP);
    h.auth.setAuthenticatedUser(B);
    response.resolve([{ Name: 'Old Alice', Age: 99 }]);
    expect(await pending).toBeNull();
    expect(h.auth.getState().profile).toEqual(B);
  });

  it('rejects a delayed login response after logout', async () => {
    const h = harness();
    const response = deferred<unknown>();
    h.http.postEnvelope.mockReturnValueOnce(response.promise);
    const pending = h.authService.loginWithPhone(B.telHP);
    h.authService.logout();
    response.resolve({ UID: B.uid });
    await expect(pending).rejects.toThrow('失效');
    expect(h.auth.getState().isAuthenticated).toBe(false);
  });

  it('keeps the latest login when two logins complete out of order', async () => {
    const h = harness();
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    h.http.postEnvelope.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const oldLogin = h.authService.loginWithPhone(A.telHP);
    const newLogin = h.authService.loginWithPhone(B.telHP);
    second.resolve({ UID: B.uid, Name: B.name });
    await newLogin;
    first.resolve({ UID: A.uid });
    await expect(oldLogin).rejects.toThrow('失效');
    expect(h.auth.getState().profile?.uid).toBe(B.uid);
  });

  it('does not reuse a previous UID when login fails or has no UID', async () => {
    const h = harness();
    h.http.postEnvelope.mockRejectedValueOnce(new Error('offline'));
    await expect(h.authService.loginWithPhone(B.telHP)).rejects.toThrow('offline');
    h.http.postEnvelope.mockResolvedValueOnce({ Name: 'Invalid user' });
    await expect(h.authService.loginWithPhone(B.telHP)).rejects.toThrow('用户标识');
    expect(h.storage.get('auth:profile')).toEqual(A);
  });

  it('clears both in-memory reports and old profile fields before loading a new account', async () => {
    const h = harness();
    h.reports.setRecords(BcaReportMapper.toChronologicalDescList([record]));
    h.storage.set('report:history', [...h.reports.getState().records]);
    h.storage.set('equip:bound', { equipModel: 'H30', deviceType: 'H30', serialNumber: 'old' });
    const member = deferred<unknown>();
    h.http.postEnvelope.mockImplementation(path => {
      if (path === '/main_v3/GetUserInfoWeChat') return Promise.resolve({ UID: B.uid }) as never;
      if (path === '/main/GetUserInfo') return member.promise as never;
      return Promise.resolve([]) as never;
    });
    const pending = h.authService.loginWithPhone(B.telHP);
    await flush();
    expect(h.reports.getState().records).toHaveLength(0);
    expect(h.storage.get('report:history') ?? []).toHaveLength(0);
    expect(h.auth.getState().profile).toMatchObject({ uid: B.uid, gender: '', age: 0, height: 0 });
    expect(h.auth.getState().boundEquipment).toBeNull();
    member.resolve([]);
    await pending;
  });

  it('does not restore old reports after logout and login to the same UID', async () => {
    const h = harness();
    const response = deferred<unknown>();
    h.http.postEnvelope.mockReturnValueOnce(response.promise);
    const pending = h.reportService.refreshHistory();
    h.authService.logout();
    h.auth.setAuthenticatedUser(A);
    response.resolve([record]);
    await pending;
    expect(h.reports.getState().records).toHaveLength(0);
    expect(h.storage.get('report:history')).toBeNull();
  });

  it('does not let an obsolete request failure turn off a newer loading indicator', async () => {
    const h = harness();
    const old = deferred<unknown>();
    const current = deferred<unknown>();
    h.http.postEnvelope.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const p1 = h.reportService.refreshHistory();
    const p2 = h.reportService.refreshHistory(true);
    old.reject(new Error('old request failed'));
    await expect(p1).rejects.toThrow();
    expect(h.reports.getState().loading).toBe(true);
    current.resolve([]);
    await p2;
    expect(h.reports.getState().loading).toBe(false);
  });
});

describe('Measurement cancellation, ownership and saving', () => {
  it('does not connect or start measurement after cancelling an outstanding scan', async () => {
    const h = harness();
    const scan = deferred<unknown>();
    h.sdk.scan.mockReturnValueOnce(scan.promise);
    const started = h.workflow.startMeasurementSession('H30');
    await flush();
    await h.workflow.cancelSession();
    scan.resolve([{ deviceId: 'late', type: 'H30' }]);
    await started;
    expect(h.sdk.stopScan).toHaveBeenCalledTimes(1);
    expect(h.sdk.connect).not.toHaveBeenCalled();
    expect(h.sdk.startAutoMeasurement).not.toHaveBeenCalled();
    expect(h.unsubscribe).toHaveBeenCalledTimes(1);
    expect(h.connectionUnsubscribe).toHaveBeenCalledTimes(1);
    expect(h.measure.getState().active).toBe(false);
  });

  it('disconnects a connection that completes after cancellation and does not start measurement', async () => {
    const h = harness();
    const connection = deferred<void>();
    h.sdk.connect.mockReturnValueOnce(connection.promise);
    const started = h.workflow.startMeasurementSession('H30', 'device-A');
    await flush();
    const cancelled = h.workflow.cancelSession();
    connection.resolve();
    await Promise.all([started, cancelled]);
    expect(h.sdk.disconnect).toHaveBeenCalledTimes(1);
    expect(h.sdk.startAutoMeasurement).not.toHaveBeenCalled();
  });

  it('ignores old completion callbacks after switching accounts', async () => {
    const h = harness();
    await h.workflow.startMeasurementSession('H30');
    const old = h.observer();
    h.auth.setAuthenticatedUser(B);
    await old.onCompleted?.({ weight: 60 } as never);
    await flush();
    expect(h.http.postEnvelope).not.toHaveBeenCalled();
    expect(h.measure.getState().active).toBe(false);
  });

  it('accepts a facade-cleaned completion, uploads once and exposes a saved status', async () => {
    const h = harness();
    await h.workflow.startMeasurementSession('H30');
    await Promise.all([
      h.observer().onCompleted?.({ weight: 60, ira20: 300 } as never),
      h.observer().onCompleted?.({ weight: 60, ira20: 300 } as never),
    ]);
    const uploads = h.http.postEnvelope.mock.calls.filter(([path]) => path === MeasurementWorkflowService.DIAL_UPLOAD_PATH);
    expect(uploads).toHaveLength(1);
    expect(uploads[0][1]).toMatchObject({ UID: A.uid, WT: 60, UserID: A.telHP });
    expect(h.measure.getState().uploadStatus).toBe('saved');
    await h.workflow.cancelSession();
  });

  it('exposes save failure and retries the same payload without starting another measurement', async () => {
    const h = harness();
    h.http.postEnvelope.mockRejectedValueOnce(new Error('offline'));
    await h.workflow.startMeasurementSession('H30');
    await h.observer().onCompleted?.({ weight: 60 } as never);
    expect(h.measure.getState().deviceState).toBe(InBodyDeviceState.COMPLETED);
    expect(h.measure.getState().uploadStatus).toBe('failed');
    expect(h.measure.getState().errorMessage).toContain('offline');
    expect(h.http.postEnvelope).toHaveBeenCalledTimes(1);
    await Promise.all([h.workflow.retryUpload(), h.workflow.retryUpload()]);
    expect(h.measure.getState().uploadStatus).toBe('saved');
    expect(h.http.postEnvelope.mock.calls[1]).toEqual(h.http.postEnvelope.mock.calls[0]);
    expect(h.sdk.startAutoMeasurement).toHaveBeenCalledTimes(1);
    await h.workflow.cancelSession();
  });

  it('keeps upload attribution fixed and does not refresh another user after an in-flight upload', async () => {
    const h = harness();
    const upload = deferred<unknown>();
    h.http.postEnvelope.mockReturnValueOnce(upload.promise);
    await h.workflow.startMeasurementSession('H30');
    const completed = h.observer().onCompleted?.({ weight: 60 } as never);
    h.auth.setAuthenticatedUser(B);
    upload.resolve('ok');
    await completed;
    expect(h.http.postEnvelope).toHaveBeenCalledTimes(1);
    expect(h.http.postEnvelope.mock.calls[0][1]).toMatchObject({ UID: A.uid });
    expect(h.measure.getState().uploadStatus).toBe('idle');
  });

  it('reports connection failure and releases both SDK subscriptions', async () => {
    const h = harness();
    h.sdk.connect.mockRejectedValueOnce(new Error('connection failed'));
    await h.workflow.startMeasurementSession('H30', 'device-A');
    await flush();
    expect(h.measure.getState()).toMatchObject({ deviceState: InBodyDeviceState.FAILED, errorMessage: 'connection failed' });
    expect(h.unsubscribe).toHaveBeenCalledTimes(1);
    expect(h.connectionUnsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('Store projections and wx storage fallback', () => {
  it('keeps the selected trend index within the plotted points when a metric is missing', () => {
    const records = BcaReportMapper.toChronologicalDescList([
      { ...record, DATETIMES: '20261027120000', WT: 60 },
      { ...record, DATETIMES: '20261026120000', WT: '' },
      { ...record, DATETIMES: '20261025120000', WT: 58 },
    ]);
    const store = new ReportStore();
    store.setRecords(records);
    const series = store.getDashboardTrendSeries('WT');
    expect(series.points).toHaveLength(2);
    expect(series.selectedChronologicalIndex).toBe(1);
  });

  it('returns a pending memory write instead of stale native data when native persistence fails', () => {
    const runtime = globalThis as typeof globalThis & { wx: typeof wx };
    const original = runtime.wx;
    runtime.wx = {
      getStorageSync: jest.fn(() => A),
      setStorageSync: jest.fn(() => { throw new Error('quota'); }),
      removeStorageSync: jest.fn(() => { throw new Error('storage unavailable'); }),
    };
    try {
      const storage = new WxStorageRepository();
      storage.set('auth:profile', B);
      expect(storage.get('auth:profile')).toEqual(B);
      storage.remove('auth:profile');
      expect(storage.get('auth:profile')).toBeNull();
    } finally { runtime.wx = original; }
  });
});
