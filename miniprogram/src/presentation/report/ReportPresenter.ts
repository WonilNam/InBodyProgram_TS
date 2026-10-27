import { AppContainer } from '../../application/AppContainer';
import { buildReportView, ReportView, SegmentType, supportsResultsSheet } from './ReportView';
import { BodyTypeExplainDto } from '../../application/services/ReportAppService';

export class ReportPresenter {
  private index = 0;
  private segment: SegmentType = 'smm';
  private rows: Array<Record<string, unknown>> = [];
  private version = 0;
  private disposed = false;
  private unsubscribe?: () => void;
  private readonly availability = new Map<string, Promise<boolean>>();
  constructor(private readonly container: AppContainer, private readonly render: (view: ReportView | null) => void,
    private readonly renderCid: (cid: BodyTypeExplainDto | null) => void,
    private readonly renderAvailability: (status: 'checking' | 'available' | 'unavailable') => void = () => {},
    private readonly renderError: () => void = () => {}) {}
  mount(): void {
    this.unsubscribe = this.container.reportStore.subscribe(state => {
      if (!state.historyConfirmed || this.disposed) return;
      this.rows = state.records.map(record => ({ ...record.raw }));
      this.publish();
    }, false);
    void this.refresh().catch(() => { if (!this.disposed) this.renderError(); });
  }
  async refresh(): Promise<void> {
    const version = ++this.version;
    await this.container.initializeSession();
    const authVersion = this.container.authStore.getSessionVersion();
    const rows = await this.container.reportService.getHistoryRows();
    if (this.disposed || version !== this.version || authVersion !== this.container.authStore.getSessionVersion()) return;
    this.rows = rows;
    this.publish();
  }
  select(index: number): void { this.index = index; this.publish(); }
  selectSegment(type: SegmentType): void { this.segment = type; this.publish(); }
  async deleteSelected(): Promise<void> {
    const row = this.rows[this.index];
    const uid = this.container.authStore.getState().profile?.uid;
    if (!row || !uid) return;
    await this.container.reportService.deleteRecord(uid, String(row.DATETIMES));
  }
  view(): ReportView | null {
    return buildReportView(this.rows, this.index, this.segment, this.container.storage.get('report:visibilityMatrix') ?? {});
  }
  dispose(): void { this.disposed = true; this.version++; this.unsubscribe?.(); }
  private publish(): void {
    if (this.disposed) return;
    const view = this.view();
    if (view) { this.index = view.Index; this.segment = view.segmentType; }
    this.render(view);
    const uidDate = view?.InBodyData.UID_DATETIMES;
    if (!uidDate) { this.renderCid(null); this.renderAvailability('unavailable'); return; }
    if (supportsResultsSheet(view.InBodyData.EQUIP)) {
      this.renderAvailability('checking');
      let task = this.availability.get(uidDate);
      if (!task) {
        task = this.container.reportService.isResultsSheetAvailable(uidDate);
        this.availability.set(uidDate, task);
      }
      void task.then(available => {
        if (!this.disposed && this.view()?.InBodyData.UID_DATETIMES === uidDate) {
          this.renderAvailability(available ? 'available' : 'unavailable');
        }
      });
    } else this.renderAvailability('unavailable');
    this.renderCid(null);
    void this.container.reportService.getBodyTypeExplain(uidDate).then(cid => {
      if (!this.disposed && this.view()?.InBodyData.UID_DATETIMES === uidDate) this.renderCid(cid);
    }).catch(() => {});
  }
}
