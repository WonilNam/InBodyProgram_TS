import TrendChart2D from './TrendChart2D';
import { createCanvas2DContext } from './Canvas2DContextAdapter';
import { DashboardState } from '../../presentation/dashboard/DashboardPresenter';
import { selectionText } from '../../presentation/dashboard/DashboardView';

export interface ChartTouchEvent {
  touches?: Array<{ x: number; y: number }>;
  changedTouches?: Array<{ x: number; y: number }>;
}

export class DashboardChart {
  private chart: TrendChart2D | null = null;
  private signature = '';
  constructor(private readonly scope: unknown) {}

  render(state: DashboardState): void {
    if (state.isGuest) { this.dispose(); return; }
    const signature = JSON.stringify([state.viewType, state.timeData, state.trendValues]);
    if (signature === this.signature) return;
    this.signature = signature;
    this.chart?.stopAnimation();
    if (!state.trendValues.some(value => value !== null)) {
      const context = createCanvas2DContext('lineCanvas', this.scope);
      context.clearRect(0, 0, 1000, 1000);
      context.draw();
      this.chart = null;
      return;
    }
    const width = wx.getWindowInfo().windowWidth as number;
    this.chart = new TrendChart2D({
      canvasId: 'lineCanvas', type: 'line', categories: state.timeData,
      series: [{ data: state.trendValues, format: value => `${value}${state.trendMetric.unit}` }],
      animation: false, enableScroll: true, visibleCount: 11,
      xAxis: { disableGrid: true },
      yAxis: { tickMultiple: state.viewType === 'BMR' ? 10 : undefined, splitNumber: 3,
        position: 'right', fontColor: '#b5b9bb', gridColor: '#D8D8D8',
        format: value => value.toFixed(state.viewType === 'BMR' ? 0 : 1) },
      width: width * 710 / 750, height: width * 550 / 750,
      dataLabel: false, dataPointShape: true, legend: false,
      extra: { dashboardLayout: true, lineStyle: 'curve' },
    }, this.scope);
  }

  start(event: ChartTouchEvent, count: number): number {
    if (!this.chart) return -1;
    this.chart.scrollStart(event);
    this.chart.showToolTip(event);
    const index = this.chart.getCurrentDataIndex(event);
    return index < 0 ? -1 : count - index - 1;
  }
  move(event: ChartTouchEvent): void { this.chart?.scroll(event); }
  end(): void { this.chart?.scrollEnd(); }
  selection(state: DashboardState) {
    const row = state.inbodyTestData[state.selectedIndex];
    const text = row && selectionText(row, state.viewType);
    if (!text || !this.chart) return null;
    const index = state.inbodyTestData.length - state.selectedIndex - 1;
    const point = this.chart.chartData.calPoints[0]?.[index];
    const chartWidth = this.chart.opts.width;
    const width = Math.min(wx.getWindowInfo().windowWidth * 510 / 750, chartWidth - 16);
    const pointX = point ? point.x + this.chart.scrollOption.currentOffset + this.chart.scrollOption.distance : chartWidth / 2;
    const right = chartWidth - this.chart.config.yAxisWidth - this.chart.config.yAxisTitleWidth - this.chart.config.padding;
    return { ...text, width, left: Math.max(8, Math.min(right - width, pointX - width / 2)) };
  }
  dispose(): void { this.chart?.stopAnimation(); this.chart = null; this.signature = ''; }
}
