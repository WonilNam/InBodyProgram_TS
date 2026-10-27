import type { AppContainer } from '../application/AppContainer';
import { AuthAppService } from '../application/services/AuthAppService';
import { AuthStore } from '../application/stores/AuthStore';
import { MeasureSessionStore } from '../application/stores/MeasureSessionStore';
import { ReportStore } from '../application/stores/ReportStore';

let mockContainer: AppContainer;
jest.mock('../application/AppContainer', () => ({ getContainer: () => mockContainer }));
jest.mock('../infrastructure/adapters/QrScanAdapter', () => ({ scanQR: jest.fn() }));

const runtime = globalThis as typeof globalThis & {
  wx: typeof wx;
  Page: (options: Record<string, unknown>) => void;
  Component: (options: Record<string, unknown>) => void;
  getApp: () => { globalData: Record<string, unknown> };
};
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };

describe('Actual page entry points', () => {
  const original = { wx: runtime.wx, Page: runtime.Page, Component: runtime.Component, getApp: runtime.getApp };
  let authStore: AuthStore;
  let measureStore: MeasureSessionStore;
  let reportStore: ReportStore;
  let app: { globalData: Record<string, unknown> };
  let captured: Record<string, unknown>;
  let login: jest.Mock;
  let start: jest.Mock;
  let cancel: jest.Mock;

  beforeEach(() => {
    authStore = new AuthStore();
    measureStore = new MeasureSessionStore();
    reportStore = new ReportStore();
    login = jest.fn().mockResolvedValue({ targetRoute: AuthAppService.HOME_ROUTE });
    start = jest.fn().mockResolvedValue(undefined);
    cancel = jest.fn().mockResolvedValue(undefined);
    app = { globalData: { UID: null, serverUrl: 'https://wechat.lookinbody.cn' } };
    runtime.wx = {
      redirectTo: jest.fn(), navigateTo: jest.fn(), showToast: jest.fn(), showModal: jest.fn(),
      getStorageSync: jest.fn(() => ''), canIUse: jest.fn(() => true),
    };
    runtime.getApp = () => app;
    runtime.Page = options => { captured = options; };
    runtime.Component = options => { captured = options; };
    mockContainer = {
      initializeSession: jest.fn().mockResolvedValue({ targetRoute: AuthAppService.HOME_ROUTE, isGuest: true }),
      authStore, measureStore, reportStore,
      authService: { loginWithPhone: login },
      reportService: { refreshHistory: jest.fn().mockResolvedValue([]) },
      measurementWorkflow: { startMeasurementSession: start, cancelSession: cancel },
    } as unknown as AppContainer;
  });
  afterEach(() => { Object.assign(runtime, original); });

  it('awaits the container bootstrap before navigating from the launch page', async () => {
    jest.isolateModules(() => { require('../../pages/index/index'); });
    await (captured.onLoad as () => Promise<void>).call({});
    expect(mockContainer.initializeSession).toHaveBeenCalledTimes(1);
    expect(runtime.wx.redirectTo).toHaveBeenCalledWith({ url: AuthAppService.HOME_ROUTE });
  });

  it.each(['GetTelHPComponent', 'InputTelHPComponent'])(
    '%s uses the shared login service and stays on the page when login fails',
    async name => {
      jest.isolateModules(() => { require(`../../pages/Login/${name}`); });
      const methods = (captured.methods ?? captured) as { getUserInfo: (tel: string, openId: string) => Promise<void> };
      await methods.getUserInfo('13800000000', 'openid');
      expect(login).toHaveBeenCalledWith('13800000000', 'openid');
      expect(runtime.wx.redirectTo).toHaveBeenCalledTimes(1);
      login.mockRejectedValueOnce(new Error('login rejected'));
      await methods.getUserInfo('13900000000', 'openid2');
      expect(runtime.wx.redirectTo).toHaveBeenCalledTimes(1);
      expect(runtime.wx.showToast).toHaveBeenCalledWith({ title: 'login rejected', icon: 'none' });
    }
  );

  it.each([
    ['H20B', 'H20'], ['InBody120', '120'], ['H30', 'H30'], ['H40', 'H40'],
  ])('routes the dashboard %s measurement action through the workflow as %s', async (selected, expected) => {
    authStore.setAuthenticatedUser({ uid: 'A', telHP: '13800000000', name: 'Alice', gender: 'F', age: 28, height: 165 });
    jest.isolateModules(() => { require('../../pages/HealthReportMain/HealthReportDashboard'); });
    const methods = captured.methods as { showHint: () => Promise<void> };
    const page = { data: { testEquip: selected }, closeAddResult: jest.fn() };
    await methods.showHint.call(page);
    expect(start).toHaveBeenCalledWith(expected);
    expect(runtime.wx.navigateTo).not.toHaveBeenCalled();
  });

  it('routes dashboard guests to login without opening a measurement session', async () => {
    jest.isolateModules(() => { require('../../pages/HealthReportMain/HealthReportDashboard'); });
    const methods = captured.methods as { showHint: () => Promise<void> };
    await methods.showHint.call({ data: { testEquip: 'H30' }, closeAddResult: jest.fn() });
    expect(start).not.toHaveBeenCalled();
    expect(runtime.wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/Login/GetTelHPComponent' });
  });

  it('keeps the profile completion route for users missing measurement parameters', async () => {
    authStore.setAuthenticatedUser({ uid: 'A', telHP: '13800000000', name: '', gender: '', age: 0, height: 0 });
    jest.isolateModules(() => { require('../../pages/HealthReportMain/HealthReportDashboard'); });
    const methods = captured.methods as { showHint: () => Promise<void> };
    await methods.showHint.call({ data: { testEquip: 'H30' }, closeAddResult: jest.fn() });
    expect(start).not.toHaveBeenCalled();
    expect(runtime.wx.navigateTo).toHaveBeenCalledWith({ url: '/pages/InBodyTestMain/InBodyTestProfile' });
  });

  it('does not leave the profile page or mutate global data when profile saving fails', async () => {
    const save = jest.fn().mockRejectedValue(new Error('save failed'));
    Object.assign(mockContainer.authService, { updateMemberProfile: save });
    runtime.wx.navigateBack = jest.fn();
    jest.isolateModules(() => { require('../../pages/InBodyTestMain/InBodyTestProfile'); });
    const method = captured.SaveUserInfo as (data: Record<string, unknown>) => Promise<void>;
    const page = { setData: jest.fn() };
    await method.call(page, { UID: 'A', Age: 28 });
    expect(runtime.wx.navigateBack).not.toHaveBeenCalled();
    expect(app.globalData.isTestProfile).toBeUndefined();
    expect(runtime.wx.showToast).toHaveBeenCalledWith({ title: 'save failed', icon: 'none' });
    expect(page.setData).toHaveBeenCalledWith({ btnLoading: false, isbtnDisable: false });
  });

  it('cancels a live measurement and releases the report subscription on detach', async () => {
    jest.isolateModules(() => { require('../../pages/HealthReportMain/HealthReportDashboard'); });
    measureStore.startSession('H30');
    const lifetimes = captured.lifetimes as { detached: () => void };
    const unsubscribe = jest.fn();
    lifetimes.detached.call({ presenter: { dispose: unsubscribe }, chart: { dispose: jest.fn() } });
    await flush();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
