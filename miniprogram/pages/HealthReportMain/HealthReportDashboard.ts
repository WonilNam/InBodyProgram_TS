import { registerComponent } from "../../src/presentation/platform/registerComponent";
import { getContainer } from '../../src/application/AppContainer';
import { DashboardPresenter, DashboardState } from '../../src/presentation/dashboard/DashboardPresenter';
import { buildDashboardView, HEALTH_GOALS } from '../../src/presentation/dashboard/DashboardView';
import { WxDashboardPreferences } from '../../src/presentation/dashboard/WxDashboardPreferences';
import { DashboardChart, ChartTouchEvent } from '../../src/infrastructure/renderers/DashboardChart';
import { scanQR } from '../../src/infrastructure/adapters/QrScanAdapter';

interface TapEvent { currentTarget: { id: string; dataset: { key?: string } } }
interface DashboardInstance {
  data: DashboardState & { showAddResult: boolean; canvasHidden: boolean; status: boolean };
  presenter?: DashboardPresenter;
  chart?: DashboardChart;
  state?: DashboardState;
  ready: boolean;
  disposed: boolean;
  selected: boolean;
  starting: boolean;
  setData(patch: Record<string, unknown>): void;
  closeAddResult(): void;
}
const LOGIN = '/pages/Login/GetTelHPComponent';
const navigate = (url: string) => wx.navigateTo({ url });

registerComponent<DashboardInstance>({
  options: { addGlobalClass: true },
  properties: {
    Refresh: { type: Number, observer(this: DashboardInstance) {
      void this.presenter?.refresh();
    } },
  },
  data: {
    ...buildDashboardView([]), isGuest: true, historyLoading: false, initialLoading: false,
    healthGoals: HEALTH_GOALS, healthGoal: '', healthGoalLabel: '', testEquip: 'NotEquip',
    showAddResult: false, canvasHidden: false, status: false, trendSelection: null,
  },
  lifetimes: {
    attached(this: DashboardInstance) {
      this.disposed = false;
      this.ready = false;
      this.selected = false;
      this.chart = new DashboardChart(this);
      this.presenter = new DashboardPresenter(getContainer(), new WxDashboardPreferences(), state => {
        if (this.disposed) return;
        this.state = state;
        const { inbodyTestData, trendMetric, trendValues, timeData, availableMetrics, ...pageData } = state;
        this.setData(pageData);
        if (this.ready) this.chart?.render(state);
        if (this.selected) this.setData({ trendSelection: this.chart?.selection(state) ?? null });
      });
      this.presenter.mount();
    },
    ready(this: DashboardInstance) {
      this.ready = true;
      if (this.state) this.chart?.render(this.state);
    },
    detached(this: DashboardInstance) {
      this.disposed = true;
      this.presenter?.dispose();
      this.chart?.dispose();
      if (getContainer().measureStore.getState().active) void getContainer().measurementWorkflow.cancelSession();
    },
  },
  methods: {
    openLogin() { navigate(LOGIN); },
    openInBodyHelp() { navigate('/pages/HealthReportBarGraph/WebViewInBodyItemHelp'); },
    openAddResult(this: DashboardInstance) { this.setData({ showAddResult: true, canvasHidden: true }); },
    closeAddResult(this: DashboardInstance) { this.setData({ showAddResult: false, canvasHidden: false }); },
    scanResult(this: DashboardInstance) {
      this.closeAddResult();
      if (!getContainer().authStore.getState().isAuthenticated) { navigate(LOGIN); return; }
      scanQR(true, () => { if (!this.disposed) void this.presenter?.refresh(); });
    },
    addResultEquipment(this: DashboardInstance) { this.closeAddResult(); navigate('/pages/SetupInBodyEquip/SetupInBodyEquipList'); },
    bindEquip(this: DashboardInstance) { this.setData({ status: false, canvasHidden: false }); navigate('/pages/SetupInBodyEquip/SetupInBodyEquipList'); },
    handlecancel(this: DashboardInstance) { this.setData({ status: false, canvasHidden: false }); },
    async showHint(this: DashboardInstance) {
      this.closeAddResult();
      const container = getContainer();
      const auth = container.authStore.getState();
      if (!auth.isAuthenticated) { navigate(LOGIN); return; }
      if (container.measureStore.getState().active || this.starting) return;
      const type = this.data.testEquip === 'H20B' ? 'H20' : this.data.testEquip === 'InBody120' ? '120' :
        this.data.testEquip === 'H30' || this.data.testEquip === 'H40' ? this.data.testEquip : null;
      if (!type) { this.setData({ status: true, canvasHidden: true }); return; }
      if (!auth.profile?.gender || auth.profile.age <= 0 || auth.profile.height <= 0) {
        navigate('/pages/InBodyTestMain/InBodyTestProfile'); return;
      }
      this.starting = true;
      try { await container.measurementWorkflow.startMeasurementSession(type); }
      catch (error) { wx.showModal({ content: error instanceof Error ? error.message : '无法启动测量', showCancel: false }); }
      finally { this.starting = false; }
    },
    onClickComponent(this: DashboardInstance, event: TapEvent) {
      this.selected = false;
      this.setData({ trendSelection: null });
      this.presenter?.selectMetric(event.currentTarget.id);
    },
    touchcanvas(this: DashboardInstance, event: ChartTouchEvent) {
      if (!this.state) return;
      const index = this.chart?.start(event, this.state.inbodyTestData.length) ?? -1;
      if (index < 0) return;
      this.selected = true;
      this.presenter?.selectRecord(index);
    },
    touchmove(this: DashboardInstance, event: ChartTouchEvent) {
      this.chart?.move(event);
      if (this.selected && this.state) this.setData({ trendSelection: this.chart?.selection(this.state) ?? null });
    },
    touchend(this: DashboardInstance) { this.chart?.end(); },
    openDisplaySettings(this: DashboardInstance) {
      this.presenter?.prepareMetricSettings();
      wx.navigateTo({ url: '/pages/HealthReportHistoryGraph/HistoryGraphMetricSettings?mode=dashboard',
        events: { dashboardSettingsChanged: () => this.presenter?.reloadPreferences() } });
    },
    selectHealthGoal(this: DashboardInstance, event: TapEvent) {
      if (!this.presenter?.saveGoal(event.currentTarget.dataset.key ?? '')) { navigate(LOGIN); return; }
      wx.showToast({ title: '目标已保存', icon: 'success' });
    },
    openHealthGoal(this: DashboardInstance) {
      if (!getContainer().authStore.getState().isAuthenticated) { navigate(LOGIN); return; }
      wx.showActionSheet({ itemList: HEALTH_GOALS.map(goal => goal.label), success: (result: { tapIndex: number }) => {
        const goal = HEALTH_GOALS[result.tapIndex];
        if (goal && !this.disposed) this.presenter?.saveGoal(goal.key);
      } });
    },
    openReportShare(this: DashboardInstance) {
      const payload = this.presenter?.sharePayload();
      if (!payload) { wx.showToast({ title: '暂无可分享的测量结果', icon: 'none' }); return; }
      wx.navigateTo({ url: '/pages/ReportShare/ReportShare',
        success: (result: { eventChannel: { emit(name: string, data: unknown): void } }) => result.eventChannel.emit('report', payload) });
    },
    bindHealthReportBP() { navigate('/pages/HealthReportHistoryGraphBP/HealthReportHistoryGraphBP'); },
    bindHealthReportInBody() { navigate('/pages/HealthReportMain/HealthReportMain'); },
    moveToMenu() { navigate('/pages/ViewMoreMain/ViewMoreMain'); },
  },
});

