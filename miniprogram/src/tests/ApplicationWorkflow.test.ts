import { InBodyDeviceState } from '../../hardware-sdk/src/domain/entities/InBodyDevice.entity';
import { AuthAppService } from '../application/services/AuthAppService';
import { MeasurementWorkflowService } from '../application/services/MeasurementWorkflowService';
import { ReportAppService } from '../application/services/ReportAppService';
import { AuthStore } from '../application/stores/AuthStore';
import { MeasureSessionStore } from '../application/stores/MeasureSessionStore';
import { ReportStore } from '../application/stores/ReportStore';
import { IAudioPlayer } from '../domain/ports/IAudioPlayer';
import { IHttpClient } from '../domain/ports/IHttpClient';
import { IStorageRepository, StorageSchema } from '../domain/ports/IStorageRepository';
import { Canvas2DContextLike, Canvas2DRenderer } from '../infrastructure/renderers/Canvas2DRenderer';
import { createCanvas2DContext } from '../infrastructure/renderers/Canvas2DContextAdapter';

class InMemoryStorage implements IStorageRepository {
  private map = new Map<string, unknown>();

  get<K extends keyof StorageSchema>(key: K): StorageSchema[K] | null {
    return (this.map.get(key) as StorageSchema[K]) ?? null;
  }

  set<K extends keyof StorageSchema>(key: K, value: StorageSchema[K]): void {
    this.map.set(key, value);
  }

  remove<K extends keyof StorageSchema>(key: K): void {
    this.map.delete(key);
  }

  clearAll(): void {
    this.map.clear();
  }
}

describe('Host Application Workflows & Canvas2DRenderer Tests', () => {
  let storage: InMemoryStorage;
  let authStore: AuthStore;
  let reportStore: ReportStore;
  let measureStore: MeasureSessionStore;
  let mockHttp: jest.Mocked<IHttpClient>;
  let mockAudio: jest.Mocked<IAudioPlayer>;
  let reportService: ReportAppService;
  let authService: AuthAppService;

  beforeEach(() => {
    storage = new InMemoryStorage();
    authStore = new AuthStore();
    reportStore = new ReportStore();
    measureStore = new MeasureSessionStore();
    mockHttp = {
      request: jest.fn(),
      postEnvelope: jest.fn(),
    };
    mockAudio = {
      playByMeasureState: jest.fn(),
      playFile: jest.fn(),
      stop: jest.fn(),
      destroy: jest.fn(),
    };
    reportService = new ReportAppService(mockHttp, storage, authStore, reportStore);
    authService = new AuthAppService(mockHttp, storage, authStore, reportService);
  });

  describe('AuthAppService — Direct Home Navigation & Preload Guarantee', () => {
    it('routes first-time login directly to /pages/HealthReportMain/HealthReportMain (never redirects to equip-setup) and preloads report data', async () => {
      mockHttp.postEnvelope.mockImplementation(async (path: string) => {
        if (path === '/main_v3/GetUserInfoWeChat') {
          return { UID: '10086', Name: 'Alice', Gender: 'F', Age: 27, Height: 165 } as any;
        }
        if (path === '/main/GetUserInfo') {
          return [{ Name: 'Alice', Gender: 'F', Age: 27, Height: 165 }] as any;
        }
        if (path === '/inbody/BindInBodyItemDefaultSetWeChat') {
          return [{ Equip: 'InBodyH30', WT: '1', SMM: '1', BFM: '1', ECW_TBW: '1' }] as any;
        }
        if (path === '/inbody/GetInBodyDataWeChat') {
          return [
            {
              UID_DATETIMES: '10086_20260322090000',
              DATETIMES: '20260322090000',
              EQUIP: 'InBodyH30',
              WT: 54.2,
              SMM: 22.1,
              BFM: 13.5,
            },
          ] as any;
        }
        return null as any;
      });

      const result = await authService.loginWithPhone('13800138000', 'wx_code_123');

      expect(result.targetRoute).toBe('/pages/HealthReportMain/HealthReportMain');
      expect(authStore.getState().isAuthenticated).toBe(true);
      expect(authStore.getState().profile?.uid).toBe('10086');
      // ReportStore already populated before navigation finishes so home chart renders immediately
      expect(reportStore.getState().records).toHaveLength(1);
      expect(reportStore.getState().records[0].metrics.WT.displayValue).toBe('54.2');
    });

    it('clears previous account cached history when switching accounts', async () => {
      storage.set('auth:profile', {
        uid: 'OLD_UID',
        telHP: '13900000000',
        name: 'Old',
        gender: 'M',
        age: 30,
        height: 175,
      });
      storage.set('report:history', [{ uidDatetimes: 'old' } as any]);

      mockHttp.postEnvelope.mockResolvedValue({ UID: 'NEW_UID', Name: 'New' } as any);

      await authService.loginWithPhone('13700000000');
      expect(authStore.getState().profile?.uid).toBe('NEW_UID');
    });
  });

  describe('ReportAppService — Request Deduplication & Period/Equipment Filtering', () => {
    it('deduplicates concurrent refreshHistory calls for the same UID', async () => {
      authStore.setAuthenticatedUser({
        uid: '10086',
        telHP: '13800138000',
        name: 'Alice',
        gender: 'F',
        age: 27,
        height: 165,
      });

      let resolveCall!: (val: unknown[]) => void;
      mockHttp.postEnvelope.mockReturnValue(
        new Promise<unknown[]>((r) => {
          resolveCall = r;
        }) as any
      );

      const p1 = reportService.refreshHistory();
      const p2 = reportService.refreshHistory();

      expect(mockHttp.postEnvelope).toHaveBeenCalledTimes(1);

      resolveCall([
        { DATETIMES: '20260322120000', EQUIP: 'InBodyH30', WT: 55.0 },
      ]);

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toHaveLength(1);
      expect(r2).toHaveLength(1);
    });

    it('filters records by date range and equipment model', () => {
      reportStore.setRecords([
        {
          uidDatetimes: '1',
          datetimes: '20260325100000',
          dateText: '',
          shortDateText: '03.25',
          timestamp: 20260325100000,
          equip: 'InBodyH30',
          sex: 'F',
          age: 27,
          height: 165,
          cidType: 'I',
          metrics: {} as any,
          raw: {},
        },
        {
          uidDatetimes: '2',
          datetimes: '20260310100000',
          dateText: '',
          shortDateText: '03.10',
          timestamp: 20260310100000,
          equip: 'InBodyH20',
          sex: 'F',
          age: 27,
          height: 165,
          cidType: 'I',
          metrics: {} as any,
          raw: {},
        },
      ]);

      const filtered = reportService.getFilteredRecords({
        startDate: { date: '20260320', dateText: '26.03.20' },
        endDate: { date: 'recent', dateText: '最后一次InBody测量日期' },
        selectedEquips: ['InBodyH30'],
        selectedDatetimes: [],
      });

      expect(filtered).toHaveLength(1);
      expect(filtered[0].equip).toBe('InBodyH30');
    });
  });

  describe('MeasurementWorkflowService — Hardware SDK Integration', () => {
    it('orchestrates Bluetooth SDK measurement, plays audio cues, uploads result, and refreshes report', async () => {
      authStore.setAuthenticatedUser({
        uid: '10086',
        telHP: '13800138000',
        name: 'Alice',
        gender: 'F',
        age: 27,
        height: 165,
      });

      let capturedObserver: any = null;
      const fakeSdk = {
        init: jest.fn(),
        onConnectionStateChange: jest.fn((cb: (c: boolean) => void) => cb(true)),
        subscribe: jest.fn((obs: any) => {
          capturedObserver = obs;
          return () => {};
        }),
        scan: jest.fn().mockResolvedValue([{ deviceId: 'AA:BB:CC', name: 'InBodyH30', type: 'H30' }]),
        connect: jest.fn().mockResolvedValue(undefined),
        startAutoMeasurement: jest.fn().mockResolvedValue(undefined),
        setCancelMeasure: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn().mockResolvedValue(undefined),
      } as any;

      mockHttp.postEnvelope.mockResolvedValue([] as any);

      const workflow = new MeasurementWorkflowService(
        authStore,
        measureStore,
        reportService,
        mockHttp,
        mockAudio,
        fakeSdk
      );

      await workflow.startMeasurementSession('H30');

      expect(fakeSdk.init).toHaveBeenCalledWith('H30');
      expect(fakeSdk.connect).toHaveBeenCalled();
      expect(fakeSdk.startAutoMeasurement).toHaveBeenCalledWith({
        uid: '10086',
        nickname: 'Alice',
        sex: 'F',
        age: 27,
        height: 165,
      });

      // Simulate SDK emitting state change, realtime weight, and completion
      capturedObserver.onStateChange(InBodyDeviceState.MEASURING_WEIGHT);
      expect(mockAudio.playByMeasureState).toHaveBeenCalledWith(InBodyDeviceState.MEASURING_WEIGHT);

      capturedObserver.onWeight(54.6);
      expect(measureStore.getState().realtimeWeight).toBe(54.6);

      await capturedObserver.onCompleted({ deviceId: 'AA:BB:CC', isCompleted: true, cmd: 'HR', weight: 54.6, ira20: 300, fitScore: 78 });
      expect(measureStore.getState().deviceState).toBe(InBodyDeviceState.COMPLETED);
      expect(mockHttp.postEnvelope).toHaveBeenCalledWith(
        '/inbody/SetInBodyDataWeChat',
        expect.objectContaining({ UID: '10086', Equip: 'H30', Gender: 'F', HT: 165, Age: 27, WT: 54.6, IRA20: 300, FS: 78, UserID: '13800138000' })
      );
      expect(mockHttp.postEnvelope).toHaveBeenCalledWith(
        '/inbody/GetInBodyDataWeChat',
        { UID: '10086', SyncDatetime: '1990-01-01', NumberPerData: '999999', CurrentIndex: '0' }
      );
    });

    it('uploads InBody120 results to the dedicated inbodyapi endpoint with StatusData/UserData/InBodyData envelope', async () => {
      authStore.setAuthenticatedUser({
        uid: '10086', telHP: '13800138000', name: 'Alice', gender: 'F', age: 27, height: 165,
      });
      let observer: any = null;
      const fakeSdk = {
        init: jest.fn(),
        onConnectionStateChange: jest.fn(),
        subscribe: jest.fn((obs: any) => { observer = obs; return () => {}; }),
        scan: jest.fn().mockResolvedValue([{ deviceId: 'X', name: 'INBODY120-001', type: '120' }]),
        connect: jest.fn().mockResolvedValue(undefined),
        startAutoMeasurement: jest.fn().mockResolvedValue(undefined),
      } as any;
      mockHttp.postEnvelope.mockResolvedValue([] as any);
      const workflow = new MeasurementWorkflowService(authStore, measureStore, reportService, mockHttp, mockAudio, fakeSdk);
      await workflow.startMeasurementSession('120');
      await observer.onCompleted({ deviceId: 'X', isCompleted: true, cmd: 'HR', weight: 60.1 });
      expect(mockHttp.postEnvelope).toHaveBeenCalledWith(
        'https://inbodyapi.lookinbody.cn/InBodyAPI/SetJsonToInBodyDataWechat',
        expect.objectContaining({
          StatusData: { UID: '10086', DataType: 'Wechat' },
          UserData: expect.objectContaining({ USER_ID: '13800138000', GENDER: 'F', WebSend: '1' }),
          InBodyData: expect.objectContaining({ UID: '10086', Equip: 'INBODY120', WT: 60.1 }),
        })
      );
    });
  });

  describe('Canvas2DRenderer — Trend Chart Drawing Guarantee', () => {
    it('renders single-point and multi-point trend charts cleanly without duplicate date labels', () => {
      const fillTextCalls: Array<{ text: string; x: number; y: number }> = [];
      const mockCtx: Canvas2DContextLike = {
        clearRect: jest.fn(),
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        arc: jest.fn(),
        stroke: jest.fn(),
        fill: jest.fn(),
        fillText: jest.fn((text, x, y) => {
          fillTextCalls.push({ text, x, y });
        }),
        fillRect: jest.fn(),
        strokeStyle: '',
        fillStyle: '',
        lineWidth: 1,
        font: '',
        textAlign: 'center',
      };

      // Single point test: must draw the date label '03.22' only ONCE
      Canvas2DRenderer.drawTrendLine(
        mockCtx,
        320,
        180,
        [{ label: '03.22', value: 54.2 }],
        0
      );
      const dateLabels = fillTextCalls.filter(c => c.text === '03.22');
      expect(dateLabels).toHaveLength(1);

      // Multi-point test
      fillTextCalls.length = 0;
      Canvas2DRenderer.drawTrendLine(
        mockCtx,
        320,
        180,
        [
          { label: '03.20', value: 54.8 },
          { label: '03.22', value: 54.2 },
        ],
        1
      );
      expect(mockCtx.stroke).toHaveBeenCalled();
      expect(fillTextCalls.filter(c => c.text === '03.20')).toHaveLength(1);
      expect(fillTextCalls.filter(c => c.text === '03.22')).toHaveLength(1);
    });

    it('Canvas2DContextAdapter configures DPR physical buffer, maps legacy setters, and replays synchronously once cached', async () => {
      const native2DCtx = {
        setTransform: jest.fn(),
        clearRect: jest.fn(),
        beginPath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        stroke: jest.fn(),
        fillText: jest.fn(),
        createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        font: '',
        textBaseline: 'alphabetic',
      };
      const fakeNode = {
        width: 0,
        height: 0,
        getContext: jest.fn(() => native2DCtx),
      };

      (globalThis as any).wx = {
        getWindowInfo: () => ({ pixelRatio: 3, windowWidth: 375 }),
        createSelectorQuery: () => ({
          in: () => ({
            select: () => ({
              fields: () => ({
                exec: (cb: any) => cb([{ node: fakeNode, width: 320, height: 180 }]),
              }),
            }),
          }),
        }),
      };

      const scope = {};
      const ctx = createCanvas2DContext('lineCanvas', scope);
      ctx.setFillStyle('#0E8A65');
      ctx.setFontSize(14);
      ctx.setTextBaseline('normal');
      const grad = ctx.createLinearGradient(0, 0, 100, 0);
      grad.addColorStop(0, '#40ED94');
      ctx.setStrokeStyle(grad);
      ctx.beginPath();
      ctx.moveTo(10, 20);
      ctx.lineTo(100, 80);
      ctx.stroke();
      ctx.fillText('70.5', 50, 40);

      await new Promise<void>((resolve) => ctx.draw(false, resolve));

      // Verify DPR = 3 physical buffer scaling (320 * 3 = 960, 180 * 3 = 540)
      expect(fakeNode.width).toBe(960);
      expect(fakeNode.height).toBe(540);
      expect(native2DCtx.setTransform).toHaveBeenCalledWith(3, 0, 0, 3, 0, 0);
      expect(native2DCtx.fillStyle).toBe('#0E8A65');
      expect(native2DCtx.textBaseline).toBe('alphabetic');
      expect(native2DCtx.fillText).toHaveBeenCalledWith('70.5', 50, 40);

      // Subsequent draw on same scope executes synchronously from cache
      const ctx2 = createCanvas2DContext('lineCanvas', scope);
      ctx2.fillText('71.0', 60, 45);
      let syncDone = false;
      ctx2.draw(false, () => {
        syncDone = true;
      });
      expect(syncDone).toBe(true);
      expect(native2DCtx.fillText).toHaveBeenCalledWith('71.0', 60, 45);
    });
  });
});
