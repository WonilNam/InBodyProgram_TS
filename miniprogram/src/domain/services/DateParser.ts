const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const;

export class DateParser {
  /**
   * 提取字符串或数字中的纯数字时间序列
   */
  static extractDigits(input: unknown): string {
    if (input === null || input === undefined) return '';
    return String(input).replace(/\D/g, '');
  }

  /**
   * 将 6位(YYMMDD)、8位(YYYYMMDD) 或 14位(YYYYMMDDHHmmss) 规范化为 14 位数字字符串
   */
  static normalizeTo14Digits(input: unknown, isEndOfDay = false): string {
    const digits = DateParser.extractDigits(input);
    const timeSuffix = isEndOfDay ? '235959' : '000000';
    if (digits.length >= 14) {
      return digits.substring(0, 14);
    }
    if (digits.length === 8) {
      return digits + timeSuffix;
    }
    if (digits.length === 6) {
      return '20' + digits + timeSuffix;
    }
    return '';
  }

  /**
   * 格式化为 YY.MM.DD (周X) 或 YY.MM.DD (周X) HH:mm
   */
  static formatDisplayDate(input: unknown, includeTime = false): string {
    if (input === 'recent') return '最后一次InBody测量日期';
    const digits = DateParser.extractDigits(input);
    if (digits.length < 6) return String(input ?? '');

    let fullYear: number;
    let month: number;
    let day: number;
    let hour = 0;
    let minute = 0;

    if (digits.length >= 8) {
      fullYear = Number(digits.substring(0, 4));
      month = Number(digits.substring(4, 6));
      day = Number(digits.substring(6, 8));
      if (digits.length >= 12) {
        hour = Number(digits.substring(8, 10));
        minute = Number(digits.substring(10, 12));
      }
    } else {
      fullYear = 2000 + Number(digits.substring(0, 2));
      month = Number(digits.substring(2, 4));
      day = Number(digits.substring(4, 6));
    }

    const jsDate = new Date(fullYear, month - 1, day, hour, minute);
    if (Number.isNaN(jsDate.getTime())) return String(input ?? '');

    const yy = String(fullYear).slice(-2).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const week = WEEKDAYS[jsDate.getDay()];

    if (includeTime && digits.length >= 12) {
      const hh = String(hour).padStart(2, '0');
      const min = String(minute).padStart(2, '0');
      return `${yy}.${mm}.${dd} (${week}) ${hh}:${min}`;
    }
    return `${yy}.${mm}.${dd} (${week})`;
  }

  /**
   * 格式化为 MM.DD 短标签（用于首页看板横轴）
   */
  static formatShortMonthDay(input: unknown): string {
    const digits = DateParser.extractDigits(input);
    if (digits.length >= 8) {
      return `${digits.substring(4, 6)}.${digits.substring(6, 8)}`;
    }
    if (digits.length === 6) {
      return `${digits.substring(2, 4)}.${digits.substring(4, 6)}`;
    }
    return String(input ?? '');
  }

  /**
   * 将期间筛选端点转化为可比较的 14 位时间戳字符串
   */
  static toBoundary14Digits(
    endpointDate: string,
    isEndBoundary: boolean,
    latestDatetimes14: string
  ): string {
    if (!endpointDate) {
      return isEndBoundary ? '99991231235959' : '00000101000000';
    }
    if (endpointDate === 'recent') {
      const latest8 = DateParser.extractDigits(latestDatetimes14).substring(0, 8);
      if (!latest8) return isEndBoundary ? '99991231235959' : '00000101000000';
      return latest8 + (isEndBoundary ? '235959' : '000000');
    }
    return DateParser.normalizeTo14Digits(endpointDate, isEndBoundary);
  }
}
