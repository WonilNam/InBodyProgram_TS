import { CoordinateType, CoordinateTypeValue } from '../value-objects/CoordinateType.vo';

export interface BodyCoordinateTicks {
  pbfTicks: readonly number[];
  bmiTicks: readonly number[];
}

export interface BodyCoordinatePoint {
  x: number;
  y: number;
}

export interface FormattedWeekdayDate {
  dateText: string;
  date: string;
}

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

export function zeroPeding(n: number | string): string {
  const s = String(n);
  return s.length >= 2 ? s : `0${s}`;
}

export function getWeekend(dayIndex: number): string {
  return WEEKDAY_NAMES[dayIndex] ?? '';
}

export function getBodyCoordinateTicks(sex: string): BodyCoordinateTicks {
  const isMale = String(sex ?? '').toUpperCase() === 'M';
  return {
    pbfTicks: isMale ? [0, 10, 15, 20, 30] : [8, 18, 23, 28, 38],
    bmiTicks: isMale ? [10, 18.5, 21.25, 24, 35] : [10, 18.5, 21.75, 25, 35],
  };
}

export function mapCoordinateToRatio(val: number | string, ticks: readonly number[]): number {
  const num = Number(val);
  if (Number.isNaN(num) || ticks.length < 2 || num <= ticks[0]) return 0;
  if (num >= ticks[ticks.length - 1]) return 1;
  for (let i = 0; i < ticks.length - 1; i++) {
    const start = ticks[i];
    const end = ticks[i + 1];
    if (num <= end) {
      const ratio = end === start ? 0 : (num - start) / (end - start);
      return (i + ratio) / (ticks.length - 1);
    }
  }
  return 1;
}

export function getBodyCoordinatePoint(
  bmi: number | string,
  pbf: number | string,
  sex: string,
  firstX: number,
  firstY: number,
  graphWidth: number
): BodyCoordinatePoint {
  const { pbfTicks, bmiTicks } = getBodyCoordinateTicks(sex);
  const rx = mapCoordinateToRatio(pbf, pbfTicks);
  const ry = mapCoordinateToRatio(bmi, bmiTicks);
  return {
    x: firstX + graphWidth * rx,
    y: firstY + graphWidth - graphWidth * ry,
  };
}

export function getBodyCoordinate(
  bmiInput: number | string,
  pbfInput: number | string,
  sex: string
): CoordinateTypeValue {
  const bmi = Number(bmiInput);
  const pbf = Number(pbfInput);
  const isMale = String(sex ?? '').toUpperCase() === 'M';

  const bmiV1 = 18.5;
  const bmiV2 = isMale ? 21.25 : 21.75;
  const bmiV3 = isMale ? 24 : 25;
  const pbfV1 = isMale ? 10 : 18.0;
  const pbfV2 = isMale ? 15 : 23;
  const pbfV3 = isMale ? 20 : 28;

  if (bmi <= bmiV1 && pbf <= pbfV1) return CoordinateType.XIAOSHOU;
  if (bmi > bmiV1 && bmi <= bmiV2 && pbf <= pbfV1) return CoordinateType.MIAOTIAOJIROU;
  if (bmi > bmiV2 && bmi <= bmiV3 && pbf <= pbfV2) return CoordinateType.JIROU;
  if (bmi > bmiV3 && pbf <= pbfV2) return CoordinateType.YUNDONGYUANTIXING;
  if (bmi <= bmiV1 && pbf > pbfV1 && pbf <= pbfV3) return CoordinateType.PIANSHOU;
  if (bmi > bmiV1 && bmi <= bmiV2 && pbf > pbfV1 && pbf <= pbfV2) return CoordinateType.MIAOTIAO;
  if (bmi > bmiV1 && bmi <= bmiV3 && pbf > pbfV2 && pbf <= pbfV3) return CoordinateType.JIANKANG;
  if (bmi > bmiV3 && pbf > pbfV2 && pbf <= pbfV3) return CoordinateType.YIBANQIANGZHUANG;
  if (bmi <= bmiV2 && pbf > pbfV3) return CoordinateType.YINXINGFEIPANG;
  if (bmi > bmiV2 && bmi <= bmiV3 && pbf > pbfV3) return CoordinateType.PIANPANG;
  if (bmi > bmiV3 && pbf > pbfV3) return CoordinateType.FEIPANG;
  return '';
}

export function formatTime(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  return (
    [year, month, day].map(zeroPeding).join('/') +
    ' ' +
    [hour, minute, second].map(zeroPeding).join(':')
  );
}

function parse12DigitDatetime(datetime: unknown): {
  dateObj: Date;
  yy: string;
  mm: string;
  dd: string;
  hour: string;
  min: string;
} | null {
  if (datetime == null || datetime === '') return null;
  const d = String(datetime);
  if (d.length < 12) return null;

  const nYear = Number(d.substring(0, 4));
  const nMonth = Number(d.substring(4, 6)) - 1;
  const nDay = Number(d.substring(6, 8));
  const hour = d.substring(8, 10);
  const min = d.substring(10, 12);

  if (Number.isNaN(nYear) || Number.isNaN(nMonth) || Number.isNaN(nDay)) {
    return null;
  }
  const dateObj = new Date(nYear, nMonth, nDay);
  return {
    dateObj,
    yy: String(dateObj.getFullYear()).substring(2, 4),
    mm: zeroPeding(dateObj.getMonth() + 1),
    dd: zeroPeding(dateObj.getDate()),
    hour,
    min,
  };
}

export function formatHistoryDatetimes(datetime: unknown): string {
  const parsed = parse12DigitDatetime(datetime);
  if (!parsed) return String(datetime ?? '');
  return `${parsed.yy}.${parsed.mm}.${parsed.dd} ${parsed.hour}:${parsed.min}`;
}

export function formatDatetimes(datetime: unknown): string {
  const parsed = parse12DigitDatetime(datetime);
  if (!parsed) return String(datetime ?? '');
  const weekday = getWeekend(parsed.dateObj.getDay());
  return `${parsed.yy}.${parsed.mm}.${parsed.dd} (${weekday}) ${parsed.hour}:${parsed.min}`;
}

export function formatYMD(datetime: unknown): string {
  const parsed = parse12DigitDatetime(datetime);
  if (!parsed) return String(datetime ?? '');
  return `${parsed.yy}年${parsed.mm}月${parsed.dd}日 ${parsed.hour}:${parsed.min}`;
}

export function frometYYmmddWW(datetime: unknown): FormattedWeekdayDate {
  const raw = datetime != null ? String(datetime).trim() : '';
  let digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 6) {
    digits = `20${digits}`;
  }
  if (digits.length >= 8) {
    const nYear = Number(digits.substring(0, 4));
    const nMonth = Number(digits.substring(4, 6)) - 1;
    const nDay = Number(digits.substring(6, 8));
    if (!Number.isNaN(nYear) && !Number.isNaN(nMonth) && !Number.isNaN(nDay)) {
      const t = new Date(nYear, nMonth, nDay);
      const yy = String(t.getFullYear()).substring(2, 4);
      const mm = zeroPeding(t.getMonth() + 1);
      const dd = zeroPeding(t.getDate());
      return {
        dateText: `${yy}.${mm}.${dd} (${getWeekend(t.getDay())})`,
        date: `${t.getFullYear()}${mm}${dd}`,
      };
    }
  }
  return { dateText: '', date: '' };
}

export function formatYYYYMMDD(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = zeroPeding(now.getMonth() + 1);
  const day = zeroPeding(now.getDate());
  return `${year}-${month}-${day}`;
}

module.exports = {
  formatTime,
  zeroPeding,
  frometYYmmddWW,
  formatYMD,
  getWeekend,
  formatDatetimes,
  formatHistoryDatetimes,
  formatYYYYMMDD,
  getBodyCoordinate,
  getBodyCoordinateTicks,
  mapCoordinateToRatio,
  getBodyCoordinatePoint,
};
