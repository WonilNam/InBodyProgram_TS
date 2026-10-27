import type * as HardwareSdk from '../../hardware-sdk/index';
import { MeasurementWorkflowService } from '../application/services/MeasurementWorkflowService';
import { ReportAppService } from '../application/services/ReportAppService';
import { AuthStore } from '../application/stores/AuthStore';
import { MeasureSessionStore } from '../application/stores/MeasureSessionStore';
import { ReportStore } from '../application/stores/ReportStore';
import { UserProfile } from '../domain/entities/UserProfile.entity';
import { IAudioPlayer } from '../domain/ports/IAudioPlayer';
import { IHttpClient } from '../domain/ports/IHttpClient';
import { IStorageRepository, StorageSchema } from '../domain/ports/IStorageRepository';

class MemoryStorage implements IStorageRepository {
  private readonly values = new Map<keyof StorageSchema, unknown>();
  get<K extends keyof StorageSchema>(key: K): StorageSchema[K] | null {
    const value = this.values.get(key);
    // Round-trip like wx storage, which hands back a fresh copy rather than the stored reference.
    return value === undefined ? null : JSON.parse(JSON.stringify(value));
  }
  set<K extends keyof StorageSchema>(key: K, value: StorageSchema[K]): void { this.values.set(key, value); }
  remove<K extends keyof StorageSchema>(key: K): void { this.values.delete(key); }
  clearAll(): void { this.values.clear(); }
}

const A: UserProfile = { uid: 'A', telHP: '13800000000', name: 'Alice', gender: 'F', age: 28, height: 165 };
const B: UserProfile = { uid: 'B', telHP: '13900000000', name: 'Bob', gender: 'M', age: 32, height: 178 };
type Handlers = Parameters<typeof HardwareSdk.subscribe>[0];

function harness() {
  const storage = new MemoryStorage();
  const auth = new AuthStore();
  auth.setAuthenticatedUser(A);
  const measure = new MeasureSessionStore();
  const http: jest.Mocked<IHttpClient> = { request: jest.fn(), postEnvelope: jest.fn().mockResolvedValue([]) };
  const audio: jest.Mocked<IAudioPlayer> = {
    playByMeasureState: jest.fn(), playFile: jest.fn(), stop: jest.fn(), destroy: jest.fn(),
  };
  const reportService = new ReportAppService(http, storage, auth, new ReportStore());
  let observer: Handlers = {};
  const sdk = {
    init: jest.fn(),
    scan: jest.fn().mockResolvedValue([{ deviceId: 'device-A', type: 'H30', name: 'H30' }]),
    stopScan: jest.fn().mockResolvedValue(undefined),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    onConnectionStateChange: jest.fn().mockReturnValue(jest.fn()),
    subscribe: jest.fn((handlers: Handlers) => { observer = handlers; return jest.fn(); }),
    startAutoMeasurement: jest.fn().mockResolvedValue(undefined),
    setCancelMeasure: jest.fn().mockResolvedValue(undefined),
  };
  const workflow = new MeasurementWorkflowService(
    auth, measure, reportService, http, audio, sdk as unknown as typeof HardwareSdk, async () => {}, storage
  );
  return { storage, auth, measure, http, workflow, observer: () => observer };
}

const completed = { deviceId: 'device-A', isCompleted: true, cmd: 'HR', weight: 60 } as never;
const isUpload = (call: unknown[]) => String(call[0]).includes('SetInBodyDataWeChat');

describe('Pending measurement upload persistence', () => {
  it('persists the result before uploading and removes it once the server confirms', async () => {
    const h = harness();
    let storedDuringUpload: unknown = null;
    h.http.postEnvelope.mockImplementation(async (url: string) => {
      if (url.includes('SetInBodyDataWeChat')) storedDuringUpload = h.storage.get('measure:pendingUpload');
      return [];
    });
    await h.workflow.startMeasurementSession('H30');
    await h.observer().onCompleted?.(completed);
    expect(storedDuringUpload).toMatchObject({ uid: 'A' });
    expect(h.storage.get('measure:pendingUpload')).toBeNull();
    expect(h.measure.getState().uploadStatus).toBe('saved');
  });

  it('keeps the result when the upload fails so it survives a process kill', async () => {
    const h = harness();
    h.http.postEnvelope.mockRejectedValue(new Error('offline'));
    await h.workflow.startMeasurementSession('H30');
    await h.observer().onCompleted?.(completed);
    expect(h.measure.getState().uploadStatus).toBe('failed');
    expect(h.storage.get('measure:pendingUpload')).toMatchObject({ uid: 'A' });
  });

  it('resumes the stored upload for the same account with the original payload, then clears it', async () => {
    const h = harness();
    const payload = { UID: 'A', DATETIMES: '20261027120000', WT: 60 };
    h.storage.set('measure:pendingUpload', { uid: 'A', url: '/inbody/SetInBodyDataWeChat', payload });
    await h.workflow.resumePendingUpload();
    expect(h.http.postEnvelope).toHaveBeenCalledWith('/inbody/SetInBodyDataWeChat', payload);
    expect(h.storage.get('measure:pendingUpload')).toBeNull();
  });

  it('keeps the stored result when the resumed upload fails again', async () => {
    const h = harness();
    h.storage.set('measure:pendingUpload', { uid: 'A', url: '/u', payload: { WT: 60 } });
    h.http.postEnvelope.mockRejectedValue(new Error('offline'));
    await h.workflow.resumePendingUpload();
    expect(h.storage.get('measure:pendingUpload')).not.toBeNull();
  });

  it('never uploads another account\'s result and leaves it stored', async () => {
    const h = harness();
    h.storage.set('measure:pendingUpload', { uid: 'B', url: '/u', payload: { WT: 70 } });
    await h.workflow.resumePendingUpload();
    expect(h.http.postEnvelope).not.toHaveBeenCalled();
    expect(h.storage.get('measure:pendingUpload')).toMatchObject({ uid: 'B' });
    h.auth.setAuthenticatedUser(B);
    await h.workflow.resumePendingUpload();
    expect(h.http.postEnvelope.mock.calls.filter(c => c[0] === '/u')).toHaveLength(1);
    expect(h.storage.get('measure:pendingUpload')).toBeNull();
  });

  it('does not resume for a guest and de-duplicates concurrent resume calls', async () => {
    const h = harness();
    h.storage.set('measure:pendingUpload', { uid: 'A', url: '/u', payload: { WT: 60 } });
    await Promise.all([h.workflow.resumePendingUpload(), h.workflow.resumePendingUpload()]);
    expect(h.http.postEnvelope.mock.calls.filter(c => c[0] === '/u')).toHaveLength(1);

    h.storage.set('measure:pendingUpload', { uid: 'A', url: '/u', payload: { WT: 60 } });
    h.http.postEnvelope.mockClear();
    h.auth.enterGuestMode();
    await h.workflow.resumePendingUpload();
    expect(h.http.postEnvelope).not.toHaveBeenCalled();
    expect(h.http.postEnvelope.mock.calls.some(isUpload)).toBe(false);
  });
});
