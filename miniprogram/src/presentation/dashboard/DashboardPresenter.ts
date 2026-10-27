import { AppContainer } from '../../application/AppContainer';
import { normalize, NormalizedDashboardSummary } from '../../application/services/DashboardBootstrapService';
import { buildDashboardSharePayload } from '../../application/services/DashboardShareService';
import { buildDashboardView, equipmentModel, HEALTH_GOALS, DashboardEquipment } from './DashboardView';

export interface DashboardPreferences {
  getMetricSelection(): unknown;
  setAvailableMetrics(keys: readonly string[]): void;
  getGoal(uid: string): string;
  setGoal(uid: string, key: string): void;
  getEquipment(): unknown;
}
export type DashboardState = ReturnType<typeof buildDashboardView> & {
  isGuest: boolean; historyLoading: boolean; errorMessage: string;
  testEquip: DashboardEquipment; healthGoal: string; healthGoalLabel: string;
};

/** Owns page-scoped subscriptions and read races; never calls wx or setData. */
export class DashboardPresenter {
  private summary: NormalizedDashboardSummary = normalize();
  private selectedIndex = 0;
  private viewType = 'weight';
  private requestVersion = 0;
  private disposed = false;
  private error = '';
  private pending = false;
  private unsubs: Array<() => void> = [];

  constructor(private readonly container: AppContainer, private readonly preferences: DashboardPreferences,
    private readonly render: (state: DashboardState) => void) {}

  mount(): void {
    this.unsubs.push(this.container.reportStore.subscribe(() => this.publish(), false));
    this.unsubs.push(this.container.authStore.subscribe(() => {
      this.summary = normalize();
      this.selectedIndex = 0;
      this.pending = false;
      this.error = '';
      this.publish();
    }, false));
    this.publish();
    void this.refresh();
  }

  async refresh(): Promise<void> {
    const version = ++this.requestVersion;
    try { await this.container.initializeSession(); }
    catch {
      if (!this.disposed && version === this.requestVersion) {
        this.pending = false;
        this.error = '登录状态恢复失败，请重试';
        this.publish();
      }
      return;
    }
    if (this.disposed || version !== this.requestVersion) return;
    if (!this.container.authStore.getState().isAuthenticated) { this.publish(); return; }
    const authVersion = this.container.authStore.getSessionVersion();
    const uid = this.container.authStore.getState().profile!.uid;
    this.pending = true;
    this.error = '';
    this.publish();
    const results = await Promise.allSettled([
      this.container.reportService.refreshHistory(),
      this.container.reportService.getDashboardSummary(uid),
    ]);
    if (this.disposed || version !== this.requestVersion || authVersion !== this.container.authStore.getSessionVersion()) return;
    if (results[1].status === 'fulfilled') this.summary = results[1].value;
    if (results.some(result => result.status === 'rejected')) this.error = '部分数据加载失败，请刷新重试';
    this.pending = false;
    this.publish();
  }

  selectMetric(id: string): void { this.viewType = id; this.publish(); }
  selectRecord(index: number): void { this.selectedIndex = index; this.publish(); }
  reloadPreferences(): void { this.publish(); }
  prepareMetricSettings(): void {
    this.preferences.setAvailableMetrics(this.view().availableMetrics);
  }
  saveGoal(key: string): boolean {
    const auth = this.container.authStore.getState();
    if (!auth.isAuthenticated || !auth.profile || !HEALTH_GOALS.some(goal => goal.key === key)) return false;
    this.preferences.setGoal(auth.profile.uid, key);
    this.publish();
    return true;
  }
  sharePayload() {
    const rows = this.container.reportStore.getState().records.map(record => record.raw);
    return buildDashboardSharePayload(rows, this.selectedIndex, this.container.storage.get('report:visibilityMatrix'));
  }
  dispose(): void {
    this.disposed = true;
    this.requestVersion++;
    this.unsubs.splice(0).forEach(unsubscribe => unsubscribe());
  }
  private view() {
    return buildDashboardView(this.container.authStore.getState().isAuthenticated ? this.container.reportStore.getState().records : [], this.summary,
      this.selectedIndex, this.viewType, this.preferences.getMetricSelection(), this.container.authStore.getState().profile);
  }
  private publish(): void {
    if (this.disposed) return;
    const auth = this.container.authStore.getState();
    const view = this.view();
    const goal = HEALTH_GOALS.find(item => item.key === (auth.profile ? this.preferences.getGoal(auth.profile.uid) : ''));
    this.viewType = view.viewType;
    this.render({ ...view, isGuest: !auth.isAuthenticated, historyLoading: this.pending,
      errorMessage: this.error, testEquip: equipmentModel(this.preferences.getEquipment()),
      healthGoal: goal?.key ?? '', healthGoalLabel: goal?.label ?? '' });
  }
}
