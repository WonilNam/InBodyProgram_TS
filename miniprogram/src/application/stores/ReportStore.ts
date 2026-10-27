import { BCARecord, BCARecordWithDelta } from '../../domain/entities/BCARecord.entity';
import { HistoryFilterCriteria } from '../../domain/entities/UserProfile.entity';
import { MetricCode } from '../../domain/value-objects/MetricSpec.vo';
import { BcaReportMapper } from '../../infrastructure/mappers/BcaReportMapper';
import { TrendChartPoint } from '../../infrastructure/renderers/Canvas2DRenderer';
import { ObservableStore } from './ObservableStore';

export type DashboardMetricTab = 'WT' | 'SMM' | 'PBF';

export interface ReportState {
  readonly loading: boolean;
  readonly historyConfirmed: boolean;
  readonly records: readonly BCARecord[];
  readonly selectedIndex: number;
  readonly currentViewRecord: BCARecordWithDelta | null;
  readonly dashboardTab: DashboardMetricTab;
  readonly filter: HistoryFilterCriteria;
  readonly draftFilter: HistoryFilterCriteria;
}

const DEFAULT_FILTER: HistoryFilterCriteria = {
  startDate: { date: '', dateText: '' },
  endDate: { date: 'recent', dateText: '最后一次InBody测量日期' },
  selectedEquips: [],
  selectedDatetimes: [],
};

export class ReportStore extends ObservableStore<ReportState> {
  constructor() {
    super({
      loading: false,
      historyConfirmed: false,
      records: [],
      selectedIndex: 0,
      currentViewRecord: null,
      dashboardTab: 'WT',
      filter: DEFAULT_FILTER,
      draftFilter: DEFAULT_FILTER,
    });
  }

  setLoading(loading: boolean): void {
    this.setState({ loading });
  }

  setRecords(records: readonly BCARecord[], selectedIndex = 0): void {
    const safeIdx = records.length > 0
      ? Math.max(0, Math.min(selectedIndex, records.length - 1))
      : 0;
    const current = records[safeIdx] ?? null;
    const previous = current && safeIdx + 1 < records.length ? records[safeIdx + 1] : null;
    const currentViewRecord = current
      ? BcaReportMapper.withPreviousDelta(current, previous)
      : null;

    const allEquips = Array.from(new Set(records.map(r => r.equip).filter(Boolean)));
    const allDatetimes = records.map(r => r.datetimes);
    const oldest = records.length > 0 ? records[records.length - 1] : null;

    const initialFilter: HistoryFilterCriteria = {
      startDate: oldest
        ? { date: oldest.datetimes, dateText: oldest.dateText }
        : { date: '', dateText: '' },
      endDate: { date: 'recent', dateText: '最后一次InBody测量日期' },
      selectedEquips: allEquips,
      selectedDatetimes: allDatetimes,
    };

    this.setState({
      loading: false,
      historyConfirmed: true,
      records,
      selectedIndex: safeIdx,
      currentViewRecord,
      filter: initialFilter,
      draftFilter: initialFilter,
    });
  }

  selectRecordIndex(index: number): void {
    const { records } = this.getState();
    if (index < 0 || index >= records.length) return;
    const current = records[index];
    const previous = index + 1 < records.length ? records[index + 1] : null;
    this.setState({
      selectedIndex: index,
      currentViewRecord: BcaReportMapper.withPreviousDelta(current, previous),
    });
  }

  setDashboardTab(tab: DashboardMetricTab): void {
    this.setState({ dashboardTab: tab });
  }

  /**
   * 获取首页看板趋势图数据点（按时间升序排列，从旧到新）
   */
  getDashboardTrendSeries(metric?: MetricCode): {
    points: TrendChartPoint[];
    selectedChronologicalIndex: number;
  } {
    const state = this.getState();
    const code = metric ?? state.dashboardTab;
    const chronological = state.records.slice().reverse();
    const points: TrendChartPoint[] = [];
    const selectedRecord = state.records[state.selectedIndex];
    let selectedChronologicalIndex = 0;

    chronological.forEach((rec) => {
      const val = rec.metrics[code]?.value;
      if (val !== null && val !== undefined) {
        if (selectedRecord && rec.timestamp <= selectedRecord.timestamp) {
          selectedChronologicalIndex = points.length;
        }
        points.push({
          label: rec.shortDateText,
          value: val,
        });
      }
    });

    return { points, selectedChronologicalIndex };
  }

  updateDraftFilter(patch: Partial<HistoryFilterCriteria>): void {
    const currentDraft = this.getState().draftFilter;
    this.setState({
      draftFilter: {
        ...currentDraft,
        ...patch,
      },
    });
  }

  commitDraftFilter(): void {
    const { draftFilter } = this.getState();
    this.setState({
      filter: { ...draftFilter },
    });
  }

  resetForGuestOrEmpty(): void {
    this.setState({
      loading: false,
      historyConfirmed: true,
      records: [],
      selectedIndex: 0,
      currentViewRecord: null,
      filter: DEFAULT_FILTER,
      draftFilter: DEFAULT_FILTER,
    });
  }
}
