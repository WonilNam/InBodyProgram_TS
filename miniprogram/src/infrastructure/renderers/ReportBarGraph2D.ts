import { DrawRoundBarGraphToHealthReport, RoundBarOptions } from './HistoryGraphic2D';

export const FONT_FAMILY = '"PingFang SC", "Microsoft YaHei", sans-serif';

export const BAR_STYLE: Required<
  Pick<
    RoundBarOptions,
    | 'continuousBar'
    | 'shortTickHeight'
    | 'labelGap'
    | 'labelColor'
    | 'boundaryColor'
    | 'shortTickColor'
    | 'lowColor'
    | 'normalColor'
    | 'highColor'
    | 'trackColor'
  >
> & { labelFontSize: number } = {
  continuousBar: true,
  shortTickHeight: 4,
  labelGap: 5,
  labelFontSize: 10,
  labelColor: '#B5BABB',
  boundaryColor: '#333333',
  shortTickColor: '#a0a0a0',
  lowColor: '#F25C75',
  normalColor: '#47B998',
  highColor: '#F25C75',
  trackColor: '#E9ECF1',
};

export interface ReportBarDrawOptions extends RoundBarOptions {
  labelFontSize?: number;
  makeMinMaxData?: (min?: number, max?: number) => number[];
}

export function makeMinMaxData(min?: number | string | null, max?: number | string | null): number[] {
  let ticks = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110];
  if (min != null && max != null && min !== '' && max !== '') {
    const nMin = Number(min);
    const nMax = Number(max);
    const interval = (nMax - nMin) / 2;
    if (Number.isFinite(interval) && interval > 0) {
      ticks = [];
      for (let i = 0; i < 11; i++) {
        ticks.push(nMin - interval * 2 + interval * i);
      }
    }
  }
  return ticks;
}

export function drawReportBar(
  context: any,
  data: Record<string, any>,
  windowWidth: number,
  dataKind: string,
  options: ReportBarDrawOptions = {}
): void {
  const muscle = dataKind === 'SMM' || dataKind === 'SMM99';
  const cid = ['WT99', 'SMM99', 'BFM99'].includes(dataKind);
  const mergedOptions: ReportBarDrawOptions = {
    ...BAR_STYLE,
    ...options,
    showShortTicks: !cid,
  };
  if (cid) {
    if (!mergedOptions.barHeight) mergedOptions.barHeight = (windowWidth * 22) / 750;
    mergedOptions.boundaryPosition = 'inside';
    mergedOptions.boundaryColor = 'rgba(255,255,255,0.50)';
  }
  const labelFontSize = mergedOptions.labelFontSize ?? BAR_STYLE.labelFontSize;
  const graphWidth = (windowWidth * 500) / 750 - 10;
  const stepWidth = graphWidth / 12;

  DrawRoundBarGraphToHealthReport(
    context,
    5,
    25,
    graphWidth,
    graphWidth,
    35,
    false,
    makeMinMaxData(muscle ? 90 : data.MIN, muscle ? 110 : data.MAX),
    0.5,
    cid ? [2] : [2, 4],
    cid
      ? []
      : [
          { value: '低标准', gradationCnt: 3 },
          { value: '标准', gradationCnt: 2 },
          { value: '超标准', gradationCnt: 6 },
        ],
    `normal ${labelFontSize}px ${FONT_FAMILY}`,
    labelFontSize,
    muscle ? data.PSMM : data.VALUE,
    stepWidth,
    stepWidth,
    mergedOptions.barHeight || 10,
    6,
    dataKind,
    mergedOptions
  );
}

module.exports = {
  makeMinMaxData,
  drawReportBar,
  FONT_FAMILY,
};
