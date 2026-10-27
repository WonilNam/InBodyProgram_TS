import { createCanvas2DContext } from './Canvas2DContextAdapter';
import {
  Canvas2DContext,
  createCurveControlPoints,
  DEFAULT_CONFIG,
  findRange,
  getDataRange,
  measureText,
  splitPoints,
  TrendChartConfig,
  TrendChartOptions,
  TrendChartPoint,
  TrendChartSeries,
  TrendChartTooltipOption,
  TrendChartXAxisOptions,
  TrendChartYAxisOptions,
  TrendChartExtraOptions,
} from './TrendChartModel';

export type {
  TrendChartConfig,
  TrendChartExtraOptions,
  TrendChartOptions,
  TrendChartPoint,
  TrendChartSeries,
  TrendChartTooltipOption,
  TrendChartXAxisOptions,
  TrendChartYAxisOptions,
} from './TrendChartModel';

export class TrendChart2D {
  public opts: Required<Pick<TrendChartOptions, 'yAxis' | 'xAxis' | 'extra'>> & TrendChartOptions;
  public config: TrendChartConfig;
  public context: Canvas2DContext;
  public chartData: {
    xAxisPoints: number[];
    calPoints: Array<Array<TrendChartPoint | null>>;
    eachSpacing: number;
  };
  public scrollOption: {
    currentOffset: number;
    startTouchX: number;
    distance: number;
  };
  private listeners: Record<string, Array<(...args: unknown[]) => void>> = {};

  constructor(opts: TrendChartOptions, scope?: unknown) {
    const normalizedOpts = {
      ...opts,
      yAxis: opts.yAxis || {},
      xAxis: opts.xAxis || {},
      extra: opts.extra || {},
      legend: opts.legend !== false,
      animation: opts.animation !== false,
    };

    const cfg: TrendChartConfig = { ...DEFAULT_CONFIG };
    if (
      typeof normalizedOpts.yAxis.splitNumber === 'number' &&
      Number.isInteger(normalizedOpts.yAxis.splitNumber) &&
      normalizedOpts.yAxis.splitNumber > 0
    ) {
      cfg.yAxisSplit = normalizedOpts.yAxis.splitNumber;
    }
    cfg.yAxisTitleWidth =
      normalizedOpts.yAxis.disabled !== true && normalizedOpts.yAxis.title ? cfg.yAxisTitleWidth : 0;
    if (normalizedOpts.legend === false) {
      cfg.legendHeight = 0;
    }

    const yAxisTotalWidth = cfg.yAxisWidth + cfg.yAxisTitleWidth;
    const spacingValid = normalizedOpts.width - 2 * cfg.padding - yAxisTotalWidth;
    const dataCount = normalizedOpts.enableScroll
      ? Math.min(normalizedOpts.visibleCount || 12, normalizedOpts.categories.length)
      : normalizedOpts.categories.length;

    const eachSpacing =
      spacingValid /
      (normalizedOpts.extra.dashboardLayout ? Math.max(1, dataCount - 1) : Math.max(1, dataCount));
    const initialScrollOffset =
      normalizedOpts.categories.length > dataCount
        ? -eachSpacing * (normalizedOpts.categories.length - dataCount)
        : 0;

    normalizedOpts.eachSpacing = eachSpacing;
    normalizedOpts.dataCount = dataCount;
    normalizedOpts._scrollDistance_ = initialScrollOffset;

    this.opts = normalizedOpts;
    this.config = cfg;
    this.context = createCanvas2DContext(normalizedOpts.canvasId, scope, {
      width: normalizedOpts.width,
      height: normalizedOpts.height,
    });
    this.chartData = {
      xAxisPoints: [],
      calPoints: [],
      eachSpacing,
    };
    this.scrollOption = {
      currentOffset: initialScrollOffset,
      startTouchX: 0,
      distance: 0,
    };

    this.render(this.opts);
  }

  public updateData(data: Partial<Pick<TrendChartOptions, 'series' | 'categories'>> = {}): void {
    if (data.series) this.opts.series = data.series;
    if (data.categories) this.opts.categories = data.categories;
    this.render(this.opts);
  }

  public stopAnimation(): void {
    // Synchronous Canvas 2D rendering requires no timer cancellation
  }

  public addEventListener(type: string, listener: (...args: unknown[]) => void): void {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  public getCurrentDataIndex(e: {
    touches?: Array<{ x: number; y: number }>;
    changedTouches?: Array<{ x: number; y: number }>;
  }): number {
    const touches = e.touches && e.touches.length ? e.touches : e.changedTouches;
    if (!touches || !touches.length) {
      return -1;
    }
    const { x, y } = touches[0];
    const offset = Math.abs(this.scrollOption.currentOffset);
    const { padding, legendHeight, xAxisHeight, yAxisWidth, yAxisTitleWidth } = this.config;

    if (
      this.opts.extra.dashboardLayout &&
      y >= padding &&
      y <= this.opts.height - legendHeight - xAxisHeight - padding
    ) {
      const firstX = this.chartData.xAxisPoints[0] ?? padding;
      const spacing = this.opts.eachSpacing || 1;
      return Math.max(
        0,
        Math.min(this.opts.categories.length - 1, Math.round((x + offset - firstX) / spacing))
      );
    }

    const inArea =
      this.opts.yAxis.position === 'right'
        ? x > padding &&
          x < this.opts.width - padding - yAxisWidth - yAxisTitleWidth &&
          y > padding &&
          y < this.opts.height - legendHeight - xAxisHeight - padding
        : x < this.opts.width - padding &&
          x > padding + yAxisWidth + yAxisTitleWidth &&
          y > padding &&
          y < this.opts.height - legendHeight - xAxisHeight - padding;

    if (!inArea) {
      return -1;
    }

    let currentIndex = -1;
    this.chartData.xAxisPoints.forEach((ptX, idx) => {
      if (x + offset > ptX) {
        currentIndex = idx;
      }
    });
    return currentIndex;
  }

  public showToolTip(
    e: { touches?: Array<{ x: number; y: number }>; changedTouches?: Array<{ x: number; y: number }> },
    option: TrendChartTooltipOption = {}
  ): void {
    const index = this.getCurrentDataIndex(e);
    const currentOffset = this.scrollOption.currentOffset;
    const renderOpts: typeof this.opts = {
      ...this.opts,
      _scrollDistance_: currentOffset,
      animation: false,
      tooltip: undefined,
    };

    if (index > -1) {
      const seriesData: Array<{ name?: string; color?: string; data: string | number }> = [];
      for (const item of this.opts.series) {
        const rawVal = item.data[index];
        if (rawVal !== null && typeof rawVal !== 'undefined') {
          seriesData.push({
            color: item.color,
            name: item.name,
            data: item.format ? item.format(rawVal) : rawVal,
          });
        }
      }

      if (seriesData.length > 0) {
        const textList = seriesData.map((item) => ({
          text: option.format
            ? option.format(item, this.opts.categories[index], index)
            : `${item.name || ''}: ${item.data}`,
          color: item.color,
        }));
        const validPoints: TrendChartPoint[] = [];
        for (const pts of this.chartData.calPoints) {
          const pt = pts[index];
          if (pt) {
            validPoints.push(pt);
          }
        }
        const offset: TrendChartPoint = { x: 0, y: 0 };
        for (const pt of validPoints) {
          offset.x = Math.round(pt.x);
          offset.y += pt.y;
        }
        if (validPoints.length > 0) {
          offset.y /= validPoints.length;
        }
        renderOpts.tooltip = {
          textList,
          offset,
          option,
        };
      }
    }

    this.render(renderOpts);
  }

  public scrollStart(e: { touches?: Array<{ x: number; y: number }> }): void {
    if (e.touches && e.touches[0] && this.opts.enableScroll === true) {
      this.scrollOption.startTouchX = e.touches[0].x;
    }
  }

  public scroll(e: { touches?: Array<{ x: number; y: number }> }): void {
    if (e.touches && e.touches[0] && this.opts.enableScroll === true) {
      const rawDelta = e.touches[0].x - this.scrollOption.startTouchX;
      const currentOffset = this.scrollOption.currentOffset;
      const validDistance = this.calculateValidDistance(currentOffset + rawDelta);
      const actualDelta = validDistance - currentOffset;
      this.scrollOption.distance = actualDelta;

      this.render({
        ...this.opts,
        _scrollDistance_: currentOffset + actualDelta,
        animation: false,
      });
    }
  }

  public scrollEnd(): void {
    if (this.opts.enableScroll === true) {
      this.scrollOption.currentOffset += this.scrollOption.distance;
      this.scrollOption.distance = 0;
    }
  }

  private calculateValidDistance(distance: number): number {
    const firstX = this.chartData.xAxisPoints[0] ?? this.config.padding;
    const rightYAxisSpace =
      this.opts.yAxis.position === 'right' ? this.config.yAxisWidth + this.config.yAxisTitleWidth : 0;
    const dataChartAreaWidth = this.opts.width - this.config.padding - firstX - rightYAxisSpace;
    const itemCount = this.opts.extra.dashboardLayout
      ? Math.max(0, this.opts.categories.length - 1)
      : this.opts.categories.length;
    const dataChartWidth = this.chartData.eachSpacing * itemCount;

    if (distance >= 0 || dataChartWidth <= dataChartAreaWidth) {
      return 0;
    }
    if (Math.abs(distance) >= dataChartWidth - dataChartAreaWidth) {
      return dataChartAreaWidth - dataChartWidth;
    }
    return distance;
  }

  private computeYAxisData(opts: typeof this.opts): {
    ranges: number[];
    rangesFormat: string[];
    yAxisWidth: number;
  } {
    const combined: number[] = [];
    const useVisibleSlice = Boolean(opts.extra.dashboardLayout && opts.categories.length > 0);
    const spacing = opts.eachSpacing || 1;
    const first = useVisibleSlice
      ? Math.max(0, Math.round(-(opts._scrollDistance_ || 0) / spacing))
      : 0;
    const count = useVisibleSlice
      ? Math.min(opts.visibleCount || 11, opts.categories.length)
      : opts.categories.length;

    for (const s of opts.series) {
      const slice = useVisibleSlice ? s.data.slice(first, first + count) : s.data;
      for (const val of slice) {
        if (val !== null && typeof val === 'number' && Number.isFinite(val)) {
          combined.push(val);
        }
      }
    }

    let minData = combined.length > 0 ? Math.min(...combined) : 0;
    let maxData = combined.length > 0 ? Math.max(...combined) : 10;

    let ranges: number[];
    if (opts.yAxis.tickMultiple && Number.isFinite(minData) && Number.isFinite(maxData)) {
      const multiple = opts.yAxis.tickMultiple;
      let step = Math.max(
        multiple,
        Math.ceil((maxData - minData) / this.config.yAxisSplit / multiple) * multiple
      );
      const lower = Math.floor(minData / multiple) * multiple;
      while (lower + step * this.config.yAxisSplit < maxData) {
        step += multiple;
      }
      ranges = [];
      for (let i = 0; i <= this.config.yAxisSplit; i++) {
        ranges.push(lower + step * i);
      }
      ranges.reverse();
    } else {
      if (typeof opts.yAxis.min === 'number') {
        minData = Math.min(opts.yAxis.min, minData);
      }
      if (typeof opts.yAxis.max === 'number') {
        maxData = Math.max(opts.yAxis.max, maxData);
      }
      if (minData === maxData) {
        const span = maxData || 1;
        minData -= span;
        maxData += span;
      }
      const { minRange, maxRange } = getDataRange(minData, maxData);
      const eachRange = (maxRange - minRange) / this.config.yAxisSplit;
      ranges = [];
      for (let i = 0; i <= this.config.yAxisSplit; i++) {
        ranges.push(minRange + eachRange * i);
      }
      ranges.reverse();
    }

    let yAxisWidth = this.config.yAxisWidth;
    const rangesFormat = ranges.map((val) => {
      const fixed = val % 1 !== 0 ? Number(val.toFixed(2)) : val;
      const formatted = opts.yAxis.format ? String(opts.yAxis.format(Number(fixed))) : String(fixed);
      yAxisWidth = Math.max(yAxisWidth, measureText(formatted) + 5);
      return formatted;
    });

    if (opts.yAxis.disabled === true) {
      yAxisWidth = 0;
    }

    return { ranges, rangesFormat, yAxisWidth };
  }

  private getXAxisPoints(opts: typeof this.opts): {
    xAxisPoints: number[];
    startX: number;
    endX: number;
    eachSpacing: number;
  } {
    const yAxisTotalWidth = this.config.yAxisWidth + this.config.yAxisTitleWidth;
    const eachSpacing = opts.eachSpacing || 1;
    const startX =
      this.config.padding + (opts.yAxis.position === 'right' ? 0 : yAxisTotalWidth);
    const endX =
      opts.width - this.config.padding - (opts.yAxis.position === 'right' ? yAxisTotalWidth : 0);

    const xAxisPoints = opts.categories.map((_, idx) => startX + idx * eachSpacing);
    if (opts.enableScroll === true) {
      xAxisPoints.push(startX + opts.categories.length * eachSpacing);
    } else {
      xAxisPoints.push(endX);
    }
    return { xAxisPoints, startX, endX, eachSpacing };
  }

  private render(opts: typeof this.opts): void {
    const series = opts.series.map((s, idx) => ({
      ...s,
      color: s.color || this.config.colors[idx % this.config.colors.length],
    }));
    opts.series = series;

    const { yAxisWidth } = this.computeYAxisData(opts);
    this.config.yAxisWidth = yAxisWidth;

    if (opts.extra.dashboardLayout) {
      const visibleCount = Math.min(opts.visibleCount || 11, opts.categories.length);
      const plotWidth =
        opts.width - 2 * this.config.padding - this.config.yAxisWidth - this.config.yAxisTitleWidth;
      const previousSpacing = opts.eachSpacing;
      const nextSpacing = plotWidth / Math.max(1, visibleCount - 1);
      opts.eachSpacing = nextSpacing;
      this.opts.eachSpacing = nextSpacing;
      if (previousSpacing && previousSpacing !== nextSpacing) {
        const ratio = nextSpacing / previousSpacing;
        opts._scrollDistance_ = (opts._scrollDistance_ || 0) * ratio;
        this.opts._scrollDistance_ = opts._scrollDistance_;
        this.scrollOption.currentOffset *= ratio;
        this.scrollOption.distance *= ratio;
      }
    }

    const ctx = this.context;
    this.drawYAxisGrid(opts, ctx);
    const { xAxisPoints, calPoints, eachSpacing } = this.drawLineDataPoints(opts, ctx);
    this.chartData.xAxisPoints = xAxisPoints;
    this.chartData.calPoints = calPoints;
    this.chartData.eachSpacing = eachSpacing;

    this.drawXAxis(opts, ctx);
    this.drawYAxis(opts, ctx);
    ctx.draw();

    const listeners = this.listeners['renderComplete'] || [];
    for (const fn of listeners) {
      fn();
    }
  }

  private drawYAxisGrid(opts: typeof this.opts, ctx: Canvas2DContext): void {
    const spacingValid =
      opts.height - 2 * this.config.padding - this.config.xAxisHeight - this.config.legendHeight;
    const eachSpacing = opts.extra.dashboardLayout
      ? spacingValid / this.config.yAxisSplit
      : Math.floor(spacingValid / this.config.yAxisSplit);
    const yAxisTotalWidth = this.config.yAxisWidth + this.config.yAxisTitleWidth;
    const startX =
      this.config.padding + (opts.yAxis.position === 'right' ? 0 : yAxisTotalWidth);
    const endX =
      opts.width - this.config.padding - (opts.yAxis.position === 'right' ? yAxisTotalWidth : 0);

    ctx.beginPath();
    ctx.setStrokeStyle(opts.yAxis.gridColor || '#cccccc');
    ctx.setLineWidth(1);
    for (let i = 0; i <= this.config.yAxisSplit; i++) {
      const y =
        this.config.padding +
        eachSpacing * i +
        (i === this.config.yAxisSplit && !opts.extra.dashboardLayout ? 2 : 0);
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.closePath();
    ctx.stroke();
  }

  private drawLineDataPoints(
    opts: typeof this.opts,
    ctx: Canvas2DContext
  ): {
    xAxisPoints: number[];
    calPoints: Array<Array<TrendChartPoint | null>>;
    eachSpacing: number;
  } {
    const { ranges } = this.computeYAxisData(opts);
    const { xAxisPoints, eachSpacing } = this.getXAxisPoints(opts);
    const minRange = ranges[ranges.length - 1] ?? 0;
    const maxRange = ranges[0] ?? 10;
    const validHeight =
      opts.height - 2 * this.config.padding - this.config.xAxisHeight - this.config.legendHeight;
    const calPoints: Array<Array<TrendChartPoint | null>> = [];

    ctx.save();
    if (opts._scrollDistance_ && opts.enableScroll === true) {
      ctx.translate(opts._scrollDistance_, 0);
    }

    if (opts.tooltip && opts.tooltip.textList && opts.tooltip.textList.length > 0) {
      const startY = this.config.padding;
      const endY =
        opts.height - this.config.padding - this.config.xAxisHeight - this.config.legendHeight;
      ctx.beginPath();
      ctx.setStrokeStyle('#cccccc');
      ctx.setLineWidth(1);
      if (opts.extra.dashboardLayout) {
        ctx.setLineDash([5, 3]);
      }
      ctx.moveTo(opts.tooltip.offset.x, startY);
      ctx.lineTo(opts.tooltip.offset.x, endY);
      ctx.stroke();
      if (opts.extra.dashboardLayout) {
        ctx.setLineDash([]);
      }
      ctx.closePath();
    }

    opts.series.forEach((eachSeries) => {
      const points: Array<TrendChartPoint | null> = eachSeries.data.map((val, idx) => {
        if (val === null || typeof val !== 'number' || !Number.isFinite(val)) {
          return null;
        }
        const x =
          xAxisPoints[idx] + (opts.extra.dashboardLayout ? 0 : Math.round(eachSpacing / 2));
        const ratio = maxRange === minRange ? 0.5 : (val - minRange) / (maxRange - minRange);
        const height = validHeight * ratio;
        const y =
          opts.height -
          this.config.xAxisHeight -
          this.config.legendHeight -
          Math.round(height) -
          this.config.padding;
        return { x, y };
      });
      calPoints.push(points);

      const segments = splitPoints(points);
      for (const seg of segments) {
        ctx.beginPath();
        ctx.setStrokeStyle('#ccc');
        ctx.setLineWidth(2);
        if (seg.length === 1) {
          ctx.moveTo(seg[0].x, seg[0].y);
          ctx.arc(seg[0].x, seg[0].y, 1, 0, 2 * Math.PI);
        } else if (seg.length > 1) {
          ctx.moveTo(seg[0].x, seg[0].y);
          if (opts.extra.lineStyle === 'curve') {
            seg.forEach((pt, idx) => {
              if (idx > 0) {
                const ctrl = createCurveControlPoints(seg, idx - 1);
                ctx.bezierCurveTo(ctrl.ctrA.x, ctrl.ctrA.y, ctrl.ctrB.x, ctrl.ctrB.y, pt.x, pt.y);
              }
            });
          } else {
            seg.forEach((pt, idx) => {
              if (idx > 0) {
                ctx.lineTo(pt.x, pt.y);
              }
            });
          }
          ctx.moveTo(seg[0].x, seg[0].y);
        }
        ctx.closePath();
        ctx.stroke();
      }

      if (opts.dataPointShape !== false) {
        ctx.beginPath();
        ctx.setStrokeStyle('#ffffff');
        ctx.setLineWidth(1);
        ctx.setFillStyle('#4dba9b');
        for (const pt of points) {
          if (pt !== null) {
            ctx.moveTo(pt.x + 3.5, pt.y);
            ctx.arc(pt.x, pt.y, 4, 0, 2 * Math.PI, false);
          }
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    });

    ctx.restore();
    return { xAxisPoints, calPoints, eachSpacing };
  }

  private drawXAxis(opts: typeof this.opts, ctx: Canvas2DContext): void {
    const { xAxisPoints, eachSpacing } = this.getXAxisPoints(opts);
    const startY =
      opts.height - this.config.padding - this.config.xAxisHeight - this.config.legendHeight;

    ctx.save();
    if (opts._scrollDistance_) {
      ctx.translate(opts._scrollDistance_, 0);
    }

    ctx.beginPath();
    ctx.setFontSize(this.config.fontSize);
    ctx.setFillStyle(opts.xAxis.fontColor || '#666666');
    const categories = opts.categories;
    categories.forEach((item, index) => {
      const offset = eachSpacing / 2 - measureText(item) / 2;
      if (categories.length === 1) {
        ctx.fillText(item, xAxisPoints[index] + offset, startY + this.config.fontSize + 10);
      } else if (index === categories.length - 1) {
        ctx.fillText(item, xAxisPoints[index] + offset - 5, startY + this.config.fontSize + 10);
      } else if ((categories.length >= 12 && index === categories.length - 12) || index === 0) {
        ctx.fillText(item, xAxisPoints[index] + offset, startY + this.config.fontSize + 10);
      }
    });
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  private drawYAxis(opts: typeof this.opts, ctx: Canvas2DContext): void {
    if (opts.yAxis.disabled === true) {
      return;
    }
    const { rangesFormat } = this.computeYAxisData(opts);
    const yAxisTotalWidth = this.config.yAxisWidth + this.config.yAxisTitleWidth;
    const spacingValid =
      opts.height - 2 * this.config.padding - this.config.xAxisHeight - this.config.legendHeight;
    const eachSpacing = opts.extra.dashboardLayout
      ? spacingValid / this.config.yAxisSplit
      : Math.floor(spacingValid / this.config.yAxisSplit);
    const startX =
      this.config.padding + (opts.yAxis.position === 'right' ? 0 : yAxisTotalWidth);
    const endX =
      opts.width - this.config.padding - (opts.yAxis.position === 'right' ? yAxisTotalWidth : 0);
    const endY =
      opts.height - this.config.padding - this.config.xAxisHeight - this.config.legendHeight;

    ctx.setFillStyle(opts.background || '#ffffff');
    const pointClearance = opts.extra.dashboardLayout ? 5 : 0;
    if ((opts._scrollDistance_ || 0) < 0) {
      ctx.fillRect(0, 0, Math.max(0, startX - pointClearance), endY + this.config.xAxisHeight + 5);
    }
    ctx.fillRect(endX + pointClearance, 0, opts.width, endY + this.config.xAxisHeight + 5);

    ctx.beginPath();
    ctx.setFontSize(this.config.fontSize);
    ctx.setFillStyle(opts.yAxis.fontColor || '#666666');
    if (opts.extra.dashboardLayout) {
      ctx.setTextBaseline('middle');
    }
    rangesFormat.forEach((item, index) => {
      const pos = this.config.padding + eachSpacing * index;
      const textX =
        opts.yAxis.position === 'right'
          ? endX + 6
          : this.config.padding + this.config.yAxisTitleWidth;
      const textY = pos + (opts.extra.dashboardLayout ? 0 : this.config.fontSize / 2);
      ctx.fillText(item, textX, textY);
    });
    ctx.closePath();
    ctx.stroke();

    if (opts.extra.dashboardLayout) {
      ctx.setTextBaseline('alphabetic');
    }
  }
}

module.exports = TrendChart2D;
export default TrendChart2D;
