import { AppContainer } from '../application/AppContainer';
import { WxHttpClient } from '../infrastructure/adapters/WxHttpClient';
import { INBODY_ENDPOINTS } from '../infrastructure/api/InBodyApi';
import { BcaReportMapper } from '../infrastructure/mappers/BcaReportMapper';
import { currentInBodyData } from '../domain/services/BcaReportSnapshotMapper';
import { cards } from '../application/services/DashboardMetricsService';
import { IStorageRepository, StorageSchema } from '../domain/ports/IStorageRepository';

class Storage implements IStorageRepository {
  private data = new Map<string, unknown>();
  get<K extends keyof StorageSchema>(key: K): StorageSchema[K] | null { return (this.data.get(key) as StorageSchema[K]) ?? null; }
  set<K extends keyof StorageSchema>(key: K, value: StorageSchema[K]): void { this.data.set(key, value); }
  remove(key: keyof StorageSchema): void { this.data.delete(key); }
  clearAll(): void { this.data.clear(); }
}
const runtime = globalThis as typeof globalThis & { wx: typeof wx; getApp: typeof getApp };

describe('Original backend contracts through real HTTP adapter and application services', () => {
  const originalWx = runtime.wx;
  const originalApp = runtime.getApp;
  afterEach(() => { runtime.wx = originalWx; runtime.getApp = originalApp; });

  it('loads login, profile, equipment, history, dashboard and blood pressure into page-consumable data', async () => {
    const app = { globalData: { serverUrl: 'https://test.invalid', UID: '', InBodyUserInfo: {} } };
    runtime.getApp = (() => app) as typeof getApp;
    const calls: Array<{ path: string; data: Record<string, unknown> }> = [];
    const rows = [{ UID: 'test-user', UID_DATETIMES: 'test-user_20261027120000', DATETIMES: '20261027120000',
      EQUIP: 'H30', WT: '65.2', SMM: '28.3', PBF: '19.4', VFL: '6', BMR: '1500', SEX: 'F' }];
    const responses: Record<string, unknown> = {
      [INBODY_ENDPOINTS.login]: { UID: 'test-user', Name: 'Test', Gender: 'F', Age: 30, Height: 165, BPCount: 1 },
      [INBODY_ENDPOINTS.member]: [{ Name: 'Test Profile', Gender: 'F', Age: 30, Height: 165 }],
      [INBODY_ENDPOINTS.metricMatrix]: [{ Equip: 'H30', WT: '1', SMM: '1', PBF: '1', VFL: '1' }],
      [INBODY_ENDPOINTS.history]: rows,
      [INBODY_ENDPOINTS.dashboard]: { WT: '65.2', SMM: '28.3', PBF: '19.4', SPHYG1: 120, SPHYG2: 80, SPHYG3: 72 },
      [INBODY_ENDPOINTS.bloodPressure]: [{ DATETIMES: '20261027110000', SPHYG1: 120, SPHYG2: 80, SPHYG3: 72 }],
      [INBODY_ENDPOINTS.bodyType]: { Type: 'I', Title: '标准型', Explain: 'Test explanation' },
      [INBODY_ENDPOINTS.itemExplain]: { Explain: 'Test metric explanation' },
    };
    const local = new Map<string, unknown>();
    runtime.wx = {
      getStorageSync: (key: string) => local.get(key) ?? '',
      setStorageSync: (key: string, value: unknown) => local.set(key, value),
      removeStorageSync: (key: string) => local.delete(key),
      request: (options: { url: string; data: Record<string, unknown>; success: (res: unknown) => void }) => {
        const path = new URL(options.url).pathname;
        calls.push({ path, data: options.data });
        if (!(path in responses)) throw new Error(`Unexpected API ${path}`);
        options.success({ statusCode: 200, data: { IsSuccess: true, Data: responses[path] } });
      },
    };
    const container = new AppContainer({ http: new WxHttpClient(), storage: new Storage(),
      audio: { playByMeasureState() {}, playFile() {}, stop() {}, destroy() {} } });
    await container.authService.loginWithPhone('13800000000', 'openid');
    const history = await container.reportService.getHistoryRows();
    expect(history[0]).toMatchObject({ WT: '65.2', SMM: '28.3', PBF: '19.4' });
    expect(cards(undefined, history[0]).map(item => item.whole)).toEqual(['65', '28', '19']);
    const detail = currentInBodyData(false, false, null, null, false, history, 0);
    expect(detail.WT.VALUE).toBe('65.2');
    expect(container.reportStore.getState().records[0].metrics.VFALevel.value).toBe(6);
    expect((await container.reportService.getDashboardSummary('test-user')).SPHYG3).toBe(72);
    expect(await container.reportService.getBloodPressureHistory('test-user')).toHaveLength(1);
    expect((await container.reportService.getBodyTypeExplain('test-user_20261027120000'))?.Title).toBe('标准型');
    expect(await container.reportService.getItemExplain('WT')).toBe('Test metric explanation');
    expect(calls.find(item => item.path === INBODY_ENDPOINTS.login)?.data).toEqual({ LoginID: '13800000000', Code: 'openid' });
    expect(calls.find(item => item.path === INBODY_ENDPOINTS.history)?.data).toEqual({ UID: 'test-user', SyncDatetime: '1990-01-01', NumberPerData: '999999', CurrentIndex: '0' });
    expect(local.get('InBodyDataUID')).toBe('test-user');
    expect(app.globalData.InBodyUserInfo).toMatchObject({ Name: 'Test Profile' });
  });

  it('flattens supported nested metrics for both dashboard cards and detailed report values', () => {
    const [record] = BcaReportMapper.toChronologicalDescList([{ DATETIMES: '20261027120000', EQUIP: 'H30',
      WT: { VALUE: 65.2, MIN: 50, MAX: 70, PERCENT: 100 }, SMM: { VALUE: 28.3, MIN: 20, MAX: 30, PERCENT: 105 } }]);
    expect(record.raw).toMatchObject({ WT: 65.2, WT_MIN: 50, WT_MAX: 70, PWT: 100, SMM: 28.3, PSMM: 105 });
    expect(cards(undefined, record.raw)[0].whole).toBe('65');
    expect(currentInBodyData(false, false, null, null, false, [record.raw], 0).WT.VALUE).toBe('65.2');
  });

  it('parses JSON envelopes and keeps transport and business failures visible', async () => {
    runtime.wx = { request: (options: { success: (res: unknown) => void }) => options.success({ statusCode: 200,
      data: JSON.stringify({ IsSuccess: true, Data: 'EmptyData' }) }) };
    const http = new WxHttpClient('https://test.invalid');
    await expect(http.postEnvelope(INBODY_ENDPOINTS.history)).resolves.toEqual([]);
    runtime.wx.request = (options: { success: (res: unknown) => void }) => options.success({ statusCode: 200,
      data: { IsSuccess: false, ErrorMsg: 'Rejected by server' } });
    await expect(http.postEnvelope(INBODY_ENDPOINTS.login)).rejects.toThrow('Rejected by server');
    runtime.wx.request = (options: { success: (res: unknown) => void }) => options.success({ statusCode: 503, data: {} });
    await expect(http.postEnvelope(INBODY_ENDPOINTS.history)).rejects.toThrow('503');
  });
});
