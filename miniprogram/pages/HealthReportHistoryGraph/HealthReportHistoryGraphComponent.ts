import { registerComponent } from '../../src/presentation/platform/registerComponent';
import { getContainer } from '../../src/application/AppContainer';
import { HistoryPresenter } from '../../src/presentation/history/HistoryPresenter';
import { WxHistoryPreferences } from '../../src/presentation/history/WxHistoryPreferences';

interface HistoryInstance {
  presenter?: HistoryPresenter;
  disposed: boolean;
  setData(patch: Record<string, unknown>): void;
}
interface FilterEvent { currentTarget?: { dataset?: { openDate?: string | number } } }
registerComponent<HistoryInstance>({
  properties: { Refresh: { type: Number, observer(this: HistoryInstance) {
    void this.presenter?.refresh().catch(() => {
      if (!this.disposed) this.setData({ isLoading: false });
      wx.showToast({ title: '历史记录加载失败，请重试', icon: 'none' });
    });
  } } },
  data: { isLoading: true, IsExistsData: false, L: 'cn', historyGroup: [], historyData: {}, graphType: 'R', flag: 0 },
  lifetimes: {
    attached(this: HistoryInstance) {
      this.disposed = false;
      this.presenter = new HistoryPresenter(getContainer(), new WxHistoryPreferences(), state => {
        if (!this.disposed) this.setData({ ...state });
      });
      this.presenter.mount();
      void this.presenter.refresh().catch(() => {
        if (!this.disposed) this.setData({ isLoading: false });
        wx.showToast({ title: '历史记录加载失败，请重试', icon: 'none' });
      });
    },
    detached(this: HistoryInstance) { this.disposed = true; this.presenter?.dispose(); },
  },
  pageLifetimes: { show(this: HistoryInstance) { this.presenter?.reloadPreferences(); } },
  methods: {
    toggleGraphRange(this: HistoryInstance) { this.presenter?.toggleRange(); },
    setFilterChange(this: HistoryInstance, event: FilterEvent) {
      this.presenter?.prepareFilter();
      wx.navigateTo({ url: '/pages/HealthReportHistoryGraph/HistoryGraphDataFilter' +
        (event.currentTarget?.dataset?.openDate ? '?openDate=1' : '') });
    },
    openMetricSettings(this: HistoryInstance) {
      this.presenter?.prepareSettings();
      wx.navigateTo({ url: '/pages/HealthReportHistoryGraph/HistoryGraphMetricSettings' });
    },
  },
});
