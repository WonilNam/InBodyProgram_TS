import { registerComponent } from '../../src/presentation/platform/registerComponent';
import { getContainer } from '../../src/application/AppContainer';
import { ReportPresenter } from '../../src/presentation/report/ReportPresenter';
import { ReportView, SegmentType, supportsResultsSheet } from '../../src/presentation/report/ReportView';
import { ReportDetailChart } from '../../src/infrastructure/renderers/ReportDetailChart';
import { METRIC_SPECS, MetricCode } from '../../src/domain/value-objects/MetricSpec.vo';
import { BodyTypeExplainDto } from '../../src/application/services/ReportAppService';
import { formatYYYYMMDD } from '../../src/domain/services/InBodyFormatService';

interface DetailEvent { currentTarget: { dataset: { type?: SegmentType; tag?: string; index?: number } }; detail?: { current?: number } }
interface Question { id: number; question: string; answer: string; showAnswer: boolean }
interface DetailInstance {
  data: { Index: number; segmentType: SegmentType; questions: Question[]; CIDData: BodyTypeExplainDto | null; descType: string };
  presenter?: ReportPresenter;
  chart?: ReportDetailChart;
  view?: ReportView | null;
  disposed: boolean;
  ready: boolean;
  deleting: boolean;
  descriptionVersion: number;
  setData(patch: Record<string, unknown>, callback?: () => void): void;
}
const notify = (title: string) => wx.showToast({ title, icon: 'none' });
const QUESTIONS: Question[] = [
  { id: 1, question: '问：实际年龄不正确。', answer: '实际年龄是指进行InBody测试时，在InBody设备上输入的年龄。', showAnswer: false },
  { id: 2, question: '问：什么是"InBody年龄"？', answer: 'InBody年龄是测量者的实际年龄的基础上，利用InBody拥有的大数据的统计、测量者的InBody体成分结果进行计算。计算得出的InBody年龄并不代表绝对值。请讲InBody年龄与您的实际年龄进行比较和分析。', showAnswer: false },
];

registerComponent<DetailInstance>({
  properties: { Refresh: { type: Number, observer(this: DetailInstance) {
    void this.presenter?.refresh().catch(() => notify('报告加载失败，请重试'));
  } } },
  data: { InBodyData: null, Index: 0, IsExistsData: false, isLoading: true, segmentType: 'smm',
    AnalysisData: [], ChangeRange: {}, BodyBalance: { ARM: '', LEG: '', BODY: '' },
    CIDData: null, CIDImage: '', ResultsSheetStatus: 'unavailable', descStatus: false,
    descType: '', descTitle: '', descContent: '', slotWrapper: '', hideReportCanvases: false,
    questions: QUESTIONS, InterpretationVisible: '', CurruntSwiper: 0 },
  lifetimes: {
    attached(this: DetailInstance) {
      this.disposed = false;
      this.ready = false;
      this.descriptionVersion = 0;
      this.chart = new ReportDetailChart(this);
      this.presenter = new ReportPresenter(getContainer(), view => {
        if (this.disposed) return;
        this.view = view;
        if (!view) { this.setData({ isLoading: false, IsExistsData: false }); return; }
        const { RawData, share, DataFilter, ...pageData } = view;
        this.setData(pageData, () => {
          if (this.ready && !this.disposed) this.chart?.render(view);
        });
      }, cid => {
        if (!this.disposed) this.setData({ CIDData: cid, CIDImage: cid?.cidImage ?? '' });
      }, status => {
        if (!this.disposed) this.setData({ ResultsSheetStatus: status, 'InBodyData.IsViewResultsSheet': status !== 'available' });
      }, () => {
        if (!this.disposed) { this.setData({ isLoading: false }); notify('报告加载失败，请重试'); }
      });
      this.presenter.mount();
    },
    ready(this: DetailInstance) { this.ready = true; if (this.view) this.chart?.render(this.view); },
    detached(this: DetailInstance) { this.disposed = true; this.descriptionVersion++; this.presenter?.dispose(); },
  },
  pageLifetimes: { show(this: DetailInstance) {
    // The existing record-picker page returns its index through this compatibility key.
    const app = getApp<{ globalData: { BarGraphIndex?: number | string } }>();
    const selected = app.globalData.BarGraphIndex;
    if (selected !== '' && selected != null) { this.presenter?.select(Number(selected)); app.globalData.BarGraphIndex = ''; }
  } },
  methods: {
    handleBodyTypeChild(this: DetailInstance, event: { detail: unknown }) { this.setData({ BodyType: event.detail }); },
    bindPrevInBodyData(this: DetailInstance) { this.presenter?.select(this.data.Index + 1); },
    bindNextInBodyData(this: DetailInstance) { this.presenter?.select(this.data.Index - 1); },
    changeSegmentType(this: DetailInstance, event: DetailEvent) {
      if (event.currentTarget.dataset.type) this.presenter?.selectSegment(event.currentTarget.dataset.type);
    },
    bindInBodyDataSelect(this: DetailInstance) {
      if (!this.view) return;
      wx.navigateTo({ url: `/pages/HealthReportBarGraph/inbodyDataSelect?index=${this.data.Index}&data=${encodeURIComponent(JSON.stringify(this.view.DataFilter))}` });
    },
    confirmDeleteRecord(this: DetailInstance) {
      if (!this.view || this.deleting) return;
      wx.showModal({ title: '删除测试结果', content: '确定删除当前测试结果吗？删除后无法恢复。', confirmText: '删除',
        success: (result: { confirm: boolean }) => {
          if (!result.confirm || this.disposed || this.deleting) return;
          this.deleting = true;
          void this.presenter?.deleteSelected().catch(() => notify('删除或刷新失败，请重试'))
            .finally(() => { this.deleting = false; });
        } });
    },
    openReportShare(this: DetailInstance) {
      if (!this.view) return;
      const payload = this.view.share;
      wx.navigateTo({ url: '/pages/ReportShare/ReportShare',
        success: (result: { eventChannel: { emit(name: string, payload: unknown): void } }) => result.eventChannel.emit('report', payload) });
    },
    async bindInBodyResultsSheet(this: DetailInstance) {
      if (!this.view || !supportsResultsSheet(this.view.InBodyData.EQUIP)) return;
      const record = this.view.RawData[this.view.Index];
      try {
        if (record.CustomerID) await getContainer().reportService.getCustomerExpire(String(record.CustomerID), formatYYYYMMDD());
        if (!this.disposed) wx.navigateTo({ url: `/pages/HealthReportBarGraph/WebViewInBodyResultsSheet?key=${encodeURIComponent(this.view.InBodyData.UID_DATETIMES)}` });
      } catch { notify('报告纸暂时无法打开，请稍后重试'); }
    },
    bindInBodyItemHelp() { wx.navigateTo({ url: '/pages/HealthReportBarGraph/WebViewInBodyItemHelp' }); },
    async showDesc(this: DetailInstance, event: DetailEvent) {
      const code = event.currentTarget.dataset.tag ?? '';
      const version = ++this.descriptionVersion;
      const title = code === 'CID' ? this.data.CIDData?.Title : code === 'SCORE' ? 'InBody 分数' :
        code === 'SMI' ? 'SMI骨骼肌指数' : METRIC_SPECS[code as MetricCode]?.label;
      this.setData({ descType: code, descTitle: title ?? code, descContent: '', descStatus: true,
        slotWrapper: code === 'InBodyAge' ? 'age' : '', hideReportCanvases: code === 'InBodyAge' });
      if (code === 'InBodyAge') {
        this.setData({ descContent: '这是以体成分为基础计算的年龄。肌肉量多、体脂率低的人年龄会更年轻。' }, () => {
          if (this.view && !this.disposed) this.chart?.age(this.view);
        });
        return;
      }
      if (code === 'CID') { this.setData({ descContent: this.data.CIDData?.Explain ?? '' }); return; }
      try {
        const text = await getContainer().reportService.getItemExplain(code);
        if (!this.disposed && version === this.descriptionVersion) this.setData({ descContent: text });
      } catch { if (!this.disposed && version === this.descriptionVersion) notify('说明加载失败，请重试'); }
    },
    handlecancel(this: DetailInstance) { this.descriptionVersion++; this.setData({ descStatus: false, hideReportCanvases: false }); },
    toggleAnswer(this: DetailInstance, event: DetailEvent) {
      const index = Number(event.currentTarget.dataset.index);
      this.setData({ questions: this.data.questions.map((question, idx) => idx === index ? { ...question, showAnswer: !question.showAnswer } : question) });
    },
    bindSwiperChangeView(this: DetailInstance, event: DetailEvent) { this.setData({ CurruntSwiper: event.detail?.current ?? 0 }); },
    bindInterpretationHide(this: DetailInstance) { this.setData({ InterpretationVisible: 'display:none;' }); },
    bindShowInterpretaion(this: DetailInstance) { this.setData({ InterpretationVisible: '' }); },
  },
});
