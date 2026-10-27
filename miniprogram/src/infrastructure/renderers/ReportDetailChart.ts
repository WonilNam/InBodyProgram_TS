import { ReportView } from '../../presentation/report/ReportView';
import { MetricFieldSnapshot } from '../../domain/services/BcaReportSnapshotMapper';
import { createCanvas2DContext } from './Canvas2DContextAdapter';
import { DrawAgeGraph, DrawRoundBarHighLowGraph, DrawPentagonToHealthReport } from './HistoryGraphic2D';
import { drawReportBar } from './ReportBarGraph2D';

export class ReportDetailChart {
  constructor(private readonly scope: unknown) {}
  render(view: ReportView): void {
    const width = wx.getWindowInfo().windowWidth as number;
    const detail = view.InBodyData;
    for (const [key, field] of Object.entries(detail)) {
      if (!field || typeof field !== 'object' || !('VALUE' in field)) continue;
      const metric = field as MetricFieldSnapshot;
      if (metric.Style.includes('none') || !Number.isFinite(Number(metric.VALUE))) continue;
      if (['BMR','BSMI','WBPA50','FS','ETYPE2','ETYPE3','INLL_LV'].includes(key)) continue;
      const ctx = createCanvas2DContext(`bargraph_${key}`, this.scope);
      if (key === 'InBodyAge') continue; // The age canvas lives inside its dialog.
      if (key === 'VFA' || key === 'VFALevel') {
        DrawRoundBarHighLowGraph(ctx, 5, 25, width-120, width-120, 35,
          [2,4,6,8,10,12,14,16,18,20], .5, ['低','','高'], '8px Arial', 10,
          Number(metric.VALUE) / (key === 'VFA' ? 10 : 1), 10, 6, true);
      } else {
        drawReportBar(ctx, metric, width, key);
      }
      ctx.draw();
      if (['WT','SMM','BFM'].includes(key)) {
        const secondary = createCanvas2DContext(`bargraph_${key}99`, this.scope);
        drawReportBar(secondary, metric, width, `${key}99`);
        secondary.draw();
      }
    }
    this.drawSegments(view);
  }
  age(view: ReportView): void {
    const ctx = createCanvas2DContext('bargraph_InBodyAge', this.scope);
    DrawAgeGraph(ctx, wx.getWindowInfo().windowWidth, Number(view.InBodyData.AGE), Number(view.InBodyData.InBodyAge.VALUE));
    ctx.draw();
  }
  private drawSegments(view: ReportView): void {
    const code = String(view.InBodyData.ETYPE3.VALUE ?? '');
    if (code.length < 10) return;
    const group = view.segmentType === 'smm' ? view.InBodyData.SEG_SLM : view.segmentType === 'bfm' ? view.InBodyData.SEG_BFM : view.InBodyData.SEG_ECW_TBW;
    if (group.Style.includes('none')) return;
    const ctx = createCanvas2DContext('bargraph_SEGMENT', this.scope);
    const width = wx.getWindowInfo().windowWidth as number;
    const values = group.DATA.map(row => Number(row.PI ?? 100));
    DrawPentagonToHealthReport(ctx, view.segmentType === 'smm' ? code.slice(0,5) : code.slice(5,10),
      values, group.DATA.map(row => row.VALUE), view.segmentType,
      width * 398 / 750 / 2, width * 500 / 750 / 2, width * 104 / 750, 10);
    ctx.draw();
  }
}
