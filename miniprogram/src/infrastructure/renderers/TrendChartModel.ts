import { createCanvas2DContext } from './Canvas2DContextAdapter';

export type Canvas2DContext = ReturnType<typeof createCanvas2DContext>;

export interface TrendChartPoint {
  x: number;
  y: number;
}

export interface TrendChartSeries {
  name?: string;
  data: Array<number | null>;
  color?: string;
  format?: (val: number) => string;
}

export interface TrendChartYAxisOptions {
  disabled?: boolean;
  position?: 'left' | 'right';
  title?: string;
  titleFontColor?: string;
  fontColor?: string;
  gridColor?: string;
  splitNumber?: number;
  tickMultiple?: number;
  min?: number;
  max?: number;
  format?: (val: number) => string | number;
}

export interface TrendChartXAxisOptions {
  disableGrid?: boolean;
  type?: 'calibration' | string;
  gridColor?: string;
  fontColor?: string;
}

export interface TrendChartExtraOptions {
  dashboardLayout?: boolean;
  lineStyle?: 'curve' | 'straight';
  legendTextColor?: string;
}

export interface TrendChartTooltipOption {
  background?: string;
  format?: (item: { name?: string; color?: string; data: string | number }, category: string, index: number) => string;
}

export interface TrendChartOptions {
  canvasId: string;
  type?: 'line' | string;
  width: number;
  height: number;
  categories: string[];
  series: TrendChartSeries[];
  yAxis?: TrendChartYAxisOptions;
  xAxis?: TrendChartXAxisOptions;
  extra?: TrendChartExtraOptions;
  enableScroll?: boolean;
  visibleCount?: number;
  animation?: boolean;
  legend?: boolean;
  dataLabel?: boolean;
  dataPointShape?: boolean;
  background?: string;
  eachSpacing?: number;
  dataCount?: number;
  _scrollDistance_?: number;
  tooltip?: {
    textList: Array<{ text: string; color?: string }>;
    offset: TrendChartPoint;
    option?: TrendChartTooltipOption;
  };
}

export interface TrendChartConfig {
  yAxisWidth: number;
  yAxisSplit: number;
  xAxisHeight: number;
  xAxisLineHeight: number;
  legendHeight: number;
  yAxisTitleWidth: number;
  padding: number;
  fontSize: number;
  dataPointShape: Array<'circle' | 'diamond' | 'triangle' | 'rect'>;
  colors: string[];
  xAxisTextPadding: number;
  toolTipPadding: number;
  toolTipBackground: string;
  toolTipOpacity: number;
  toolTipLineHeight: number;
  _xAxisTextAngle_?: number;
}

export const DEFAULT_CONFIG: TrendChartConfig = {
  yAxisWidth: 15,
  yAxisSplit: 4,
  xAxisHeight: 15,
  xAxisLineHeight: 15,
  legendHeight: 15,
  yAxisTitleWidth: 15,
  padding: 12,
  fontSize: 10,
  dataPointShape: ['circle', 'diamond', 'triangle', 'rect'],
  colors: ['#ae2424', '#f7a35c', '#434348', '#90ed7d', '#f15c80', '#8085e9'],
  xAxisTextPadding: 3,
  toolTipPadding: 3,
  toolTipBackground: '#F0F0F5',
  toolTipOpacity: 1,
  toolTipLineHeight: 14,
  _xAxisTextAngle_: 0,
};

export function measureText(text: string | number, fontSize = 10): number {
  const chars = String(text).split('');
  let width = 0;
  for (const ch of chars) {
    if (/[a-zA-Z]/.test(ch)) {
      width += 7;
    } else if (/[0-9]/.test(ch)) {
      width += 5.5;
    } else if (/\./.test(ch)) {
      width += 2.7;
    } else if (/-/.test(ch)) {
      width += 3.25;
    } else if (/[\u4e00-\u9fa5]/.test(ch)) {
      width += 10;
    } else if (/\(|\)/.test(ch)) {
      width += 3.73;
    } else if (/\s/.test(ch)) {
      width += 2.5;
    } else if (/%/.test(ch)) {
      width += 8;
    } else {
      width += 10;
    }
  }
  return (width * fontSize) / 10;
}

export function findRange(num: number, type: 'upper' | 'lower' = 'upper', limit = 10): number {
  if (Number.isNaN(num)) {
    return 0;
  }
  let adjustedLimit = limit || 10;
  let multiple = 1;
  while (adjustedLimit < 1) {
    adjustedLimit *= 10;
    multiple *= 10;
  }
  let scaled = type === 'upper' ? Math.ceil(num * multiple) : Math.floor(num * multiple);
  while (scaled % adjustedLimit !== 0) {
    scaled += type === 'upper' ? 1 : -1;
  }
  return scaled / multiple;
}

export function getDataRange(minData: number, maxData: number): { minRange: number; maxRange: number } {
  const range = maxData - minData;
  let limit = 0.01;
  if (range >= 10000) limit = 1000;
  else if (range >= 1000) limit = 100;
  else if (range >= 100) limit = 10;
  else if (range >= 10) limit = 5;
  else if (range >= 1) limit = 1;
  else if (range >= 0.1) limit = 0.1;

  return {
    minRange: findRange(minData, 'lower', limit),
    maxRange: findRange(maxData, 'upper', limit),
  };
}

export function createCurveControlPoints(
  points: TrendChartPoint[],
  i: number
): { ctrA: TrendChartPoint; ctrB: TrendChartPoint } {
  const isNotMiddlePoint = (pts: TrendChartPoint[], idx: number): boolean => {
    if (pts[idx - 1] && pts[idx + 1]) {
      return (
        pts[idx].y >= Math.max(pts[idx - 1].y, pts[idx + 1].y) ||
        pts[idx].y <= Math.min(pts[idx - 1].y, pts[idx + 1].y)
      );
    }
    return false;
  };

  const a = 0.2;
  const b = 0.2;
  let pAx: number;
  let pAy: number;
  let pBx: number;
  let pBy: number;

  if (i < 1) {
    pAx = points[0].x + (points[1].x - points[0].x) * a;
    pAy = points[0].y + (points[1].y - points[0].y) * a;
  } else {
    pAx = points[i].x + (points[i + 1].x - points[i - 1].x) * a;
    pAy = points[i].y + (points[i + 1].y - points[i - 1].y) * a;
  }

  if (i > points.length - 3) {
    const last = points.length - 1;
    pBx = points[last].x - (points[last].x - points[last - 1].x) * b;
    pBy = points[last].y - (points[last].y - points[last - 1].y) * b;
  } else {
    pBx = points[i + 1].x - (points[i + 2].x - points[i].x) * b;
    pBy = points[i + 1].y - (points[i + 2].y - points[i].y) * b;
  }

  if (isNotMiddlePoint(points, i + 1)) {
    pBy = points[i + 1].y;
  }
  if (isNotMiddlePoint(points, i)) {
    pAy = points[i].y;
  }

  return {
    ctrA: { x: pAx, y: pAy },
    ctrB: { x: pBx, y: pBy },
  };
}

export function splitPoints(points: Array<TrendChartPoint | null>): TrendChartPoint[][] {
  const segments: TrendChartPoint[][] = [];
  let current: TrendChartPoint[] = [];
  for (const pt of points) {
    if (pt !== null) {
      current.push(pt);
    } else if (current.length > 0) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    segments.push(current);
  }
  return segments;
}
