import { AppContainer } from '../../application/AppContainer';
import { buildHistoryView, HistoryView } from './HistoryView';
import { WxHistoryPreferences } from './WxHistoryPreferences';

export class HistoryPresenter {
  private disposed = false;
  private unsubscribe?: () => void;
  private version = 0;
  constructor(private readonly container: AppContainer, private readonly preferences: WxHistoryPreferences,
    private readonly render: (state: HistoryView) => void) {}
  mount(): void {
    this.unsubscribe = this.container.reportStore.subscribe(() => this.publish(), false);
  }
  async refresh(): Promise<void> {
    const version = ++this.version;
    await this.container.initializeSession();
    await this.container.reportService.refreshHistory();
    if (!this.disposed && version === this.version) this.publish();
  }
  toggleRange(): void {
    this.preferences.setRange(this.preferences.read().range === 'R' ? 'T' : 'R');
    this.publish();
  }
  prepareFilter(): void {
    this.preferences.prepareFilter(this.container.reportStore.getState().records.map(record => record.raw));
  }
  prepareSettings(): void {
    const state = this.view();
    this.preferences.prepareSettings(state.historyItem.filter(item => item.check >= 0).map(item => item.key));
  }
  reloadPreferences(): void { this.publish(); }
  dispose(): void { this.disposed = true; this.version++; this.unsubscribe?.(); }
  private view(): HistoryView {
    return buildHistoryView(this.container.reportStore.getState().records, this.preferences.read(),
      this.container.storage.get('report:equipMatrix') ?? {});
  }
  private publish(): void {
    if (this.disposed) return;
    const store = this.container.reportStore.getState();
    this.render({ ...this.view(), isLoading: store.loading && store.records.length === 0 });
  }
}
