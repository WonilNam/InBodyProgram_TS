export interface BarGradationLabel {
  value: string;
  gradationCnt: number | string;
}

export interface RoundBarOptions {
  continuousBar?: boolean;
  trackColor?: string;
  boundaryColor?: string;
  boundaryPosition?: 'inside' | 'outside';
  showShortTicks?: boolean;
  shortTickHeight?: number;
  shortTickColor?: string;
  labelGap?: number;
  labelScaleY?: number;
  labelColor?: string;
  lowColor?: string;
  normalColor?: string;
  highColor?: string;
  barHeight?: number;
}

export const COLORS = {
  black: 'rgba(34, 34, 34, 1)',
  newRed: 'rgba(196, 20, 61, 1)',
  red: 'rgba(205, 59, 82, 1)',
  green: 'rgba(35, 187, 149, 1)',
  ibGray: 'rgba(105, 121, 147, 1)',
  bGray: 'rgba(220, 223, 228, 1)',
  dGray: 'rgba(128, 128, 128, 1)',
  ldGray: 'rgba(160, 160, 160, 1)',
  llGray: 'rgba(200, 200, 200, 1)',
  reportGray: 'rgba(245, 245, 245, 1)',
} as const;

export function parse14DigitToMs(raw: number | string): number {
  const s = String(raw || '').padEnd(14, '0');
  const y = Number(s.slice(0, 4)) || 2000;
  const m = (Number(s.slice(4, 6)) || 1) - 1;
  const d = Number(s.slice(6, 8)) || 1;
  const hh = Number(s.slice(8, 10)) || 0;
  const mm = Number(s.slice(10, 12)) || 0;
  const ss = Number(s.slice(12, 14)) || 0;
  return new Date(y, m, d, hh, mm, ss).getTime();
}

export function convertDatetimeDiffSeconds(start: number | string, end: number | string): number {
  return Math.max(0, (parse14DigitToMs(end) - parse14DigitToMs(start)) / 1000);
}
