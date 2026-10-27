import { DashboardPresenter, DashboardPreferences, DashboardState } from '../presentation/dashboard/DashboardPresenter';
import { buildDashboardView, equipmentModel } from '../presentation/dashboard/DashboardView';
import { buildReportView } from '../presentation/report/ReportView';
import { buildHistoryView, HistoryPreferences } from '../presentation/history/HistoryView';
import { BcaReportMapper } from '../infrastructure/mappers/BcaReportMapper';
import { normalize } from '../application/services/DashboardBootstrapService';
import { AuthStore } from '../application/stores/AuthStore';
import { ReportStore } from '../application/stores/ReportStore';
import { AppContainer } from '../application/AppContainer';

const raw = (date: string, weight: number | string = '63.7') => ({
  UID: 'A', UID_DATETIMES: `A_${date}`, DATETIMES: date, EQUIP: 'H30',
  WT: weight, WT_MIN: 50, WT_MAX: 70, SMM: 26.3, PSMM: 85, PBF: 25.5, BMR: 1500,
});
const records = BcaReportMapper.toChronologicalDescList([
  raw('20261021140320'), raw('20261020140320',62.5), raw('20261019140320',61),
]);
function pending<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
function setup() {
  const auth = new AuthStore();
  auth.setAuthenticatedUser({ uid: 'A', telHP: '13800000000', name: 'A', gender: 'F', age: 30, height: 165 });
  const store = new ReportStore();
  store.setRecords(records);
  const refresh = jest.fn().mockResolvedValue(records);
  const summary = jest.fn().mockResolvedValue(normalize({ SPHYG1: 120, SPHYG2: 80, SPHYG3: 72 }));
  const container = { authStore: auth, reportStore: store,
    reportService: { refreshHistory: refresh, getDashboardSummary: summary },
    storage: { get: () => ({}) }, initializeSession: jest.fn().mockResolvedValue({ isGuest: false }),
  } as unknown as AppContainer;
  let goal = '';
  const preferences: DashboardPreferences = {
    getMetricSelection: () => undefined, setAvailableMetrics: jest.fn(),
    getGoal: () => goal, setGoal: (_uid,key) => { goal = key; }, getEquipment: () => 'H40',
  };
  const render = jest.fn<void,[DashboardState]>();
  const presenter = new DashboardPresenter(container, preferences, render);
  return { presenter, auth, store, refresh, summary, render, preferences, container };
}

describe('Dashboard presentation without wx or Page', () => {
  it('publishes cards and numeric trend points while preserving device identity', () => {
    const view = buildDashboardView(records);
    expect(view.summaryCards[0]).toMatchObject({ whole: '63', fraction: '7', status: '标准' });
    expect(view.summaryCards[1].status).toBe('低标准');
    expect(view.trendValues).toEqual([61,62.5,63.7]);
    expect(equipmentModel([{ id: 'H40' }])).toBe('H40');
  });
  it('loads report and summary independently and publishes the pulse', async () => {
    const h = setup(); h.presenter.mount(); await flush();
    expect(h.refresh).toHaveBeenCalledTimes(1);
    expect(h.render.mock.calls.slice(-1)[0]?.[0]).toMatchObject({ SPHYG3: 72, isGuest: false, historyLoading: false });
    h.presenter.dispose();
  });
  it('retains loaded records when only the summary request fails', async () => {
    const h = setup(); h.summary.mockRejectedValueOnce(new Error('offline'));
    await h.presenter.refresh();
    expect(h.render.mock.calls.slice(-1)[0]?.[0]).toMatchObject({ errorMessage: '部分数据加载失败，请刷新重试', historyLoading: false });
    expect(h.render.mock.calls.slice(-1)[0]?.[0].inbodyTestData).toHaveLength(3);
  });
  it('does not publish delayed requests or store changes after disposal', async () => {
    const h = setup(); const result = pending<ReturnType<typeof normalize>>();
    h.summary.mockReturnValueOnce(result.promise); h.presenter.mount(); await flush();
    h.presenter.dispose(); const count = h.render.mock.calls.length;
    result.resolve(normalize({ WT: 99 })); h.store.setRecords([]); await flush();
    expect(h.render).toHaveBeenCalledTimes(count);
  });
  it('does not apply a previous account summary after an account switch', async () => {
    const h = setup(); const result = pending<ReturnType<typeof normalize>>();
    h.summary.mockReturnValueOnce(result.promise); h.presenter.mount(); await flush();
    h.auth.enterGuestMode(); result.resolve(normalize({ WT: 99 })); await flush();
    expect(h.render.mock.calls.slice(-1)[0]?.[0].isGuest).toBe(true);
    expect(h.render.mock.calls.slice(-1)[0]?.[0].WT).not.toBe('99.0'); h.presenter.dispose();
  });
  it('isolates selection and goals between component instances', () => {
    const a = setup(), b = setup();
    a.presenter.selectRecord(1); a.presenter.selectMetric('pbf'); a.presenter.saveGoal('muscle');
    b.presenter.reloadPreferences();
    expect(a.render.mock.calls.slice(-1)[0]?.[0]).toMatchObject({ selectedIndex: 1, viewType: 'pbf', healthGoal: 'muscle' });
    expect(b.render.mock.calls.slice(-1)[0]?.[0]).toMatchObject({ selectedIndex: 0, viewType: 'weight', healthGoal: '' });
  });
});

const historyPreferences: HistoryPreferences = {
  range: 'T', dates: null, equips: null, visible: null, order: [], equipMode: '', start: '', end: 'recent', dateLabel: '',
};
describe('Report and history projections', () => {
  it('keeps record navigation bounds and report changes consistent', () => {
    const latest = buildReportView(records.map(record => ({ ...record.raw })))!;
    expect(latest.InBodyData.IsNotNext).toBe(true);
    expect(latest.InBodyData.IsNotPrev).toBe(false);
    expect(Number(latest.ChangeRange.WT)).toBeCloseTo(1.2);
    expect(latest.InBodyData.IsViewResultsSheet).toBe(true);
    const oldest = buildReportView(records.map(record => ({ ...record.raw })), 99)!;
    expect(oldest.Index).toBe(2);
    expect(oldest.InBodyData.IsNotPrev).toBe(true);
  });
  it('does not send NaN metric values to visible report graphs', () => {
    const view = buildReportView([raw('20261021140320')])!;
    expect(view.InBodyData.VFA.Style).toContain('none');
    expect(view.InBodyData.WT.Style).not.toContain('none');
  });
  it('does not mutate source records when changing detail segment or visibility', () => {
    const rows = records.map(record => ({ ...record.raw })); const snapshot = JSON.stringify(rows);
    buildReportView(rows,0,'bfm',{ WT:['120'] });
    expect(JSON.stringify(rows)).toBe(snapshot);
  });
  it('keeps explicit empty date and device selections empty', () => {
    const emptyDates = buildHistoryView(records,{ ...historyPreferences, dates: [] },{});
    const emptyEquips = buildHistoryView(records,{ ...historyPreferences, equips: [] },{});
    expect(emptyDates.historyGroup).toHaveLength(0);
    expect(emptyEquips.historyGroup).toHaveLength(0);
    expect(emptyDates.IsExistsData).toBe(true);
  });
  it('filters in chronological order and applies the recent seven-point limit', () => {
    const long = BcaReportMapper.toChronologicalDescList(Array.from({ length:10 },(_,i) => raw(`202610${String(i+10).padStart(2,'0')}120000`,i+50)));
    const view = buildHistoryView(long,{ ...historyPreferences, range:'R' },{});
    expect(view.historyData.Datetimes).toHaveLength(7);
    expect(view.historyData.Datetimes[0]).toBe(20261013120000);
  });
  it('retains numeric values, configured order and bounds for history cards', () => {
    const view = buildHistoryView(records,{ ...historyPreferences, visible:['SMM','WT'], order:['SMM','WT'] },{});
    expect(view.historyGroup[0].map(item => item.key)).toEqual(['SMM','WT']);
    expect(view.historyGroup[0][1].data).toEqual([61,62.5,63.7]);
    expect(view.historyGroup[0][1].rangeData[0]).toEqual({ min:50, max:70 });
  });
});

