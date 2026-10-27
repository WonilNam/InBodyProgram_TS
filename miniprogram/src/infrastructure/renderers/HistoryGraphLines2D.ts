import * as canvas from './PrimitiveCanvas2D';
import { BarGradationLabel, COLORS, convertDatetimeDiffSeconds, parse14DigitToMs, RoundBarOptions } from './HistoryGraphShared';

export function DrawConnectionPointGraph(
  context: any,
  left: number,
  top: number,
  rawData: Array<number | string | null | undefined>,
  maxDataCnt: number,
  gradationStroke: number,
  boxW: number,
  boxH: number,
  valueBoxH: number,
  valueUnderGap: number,
  valueFont: string,
  decimalPlace: number,
  pointRadius: number,
  dashLine = 5,
  isDrawWLine = true,
  isDrawHLine = true,
  isDrawHLineFull = false,
  isLastValueBold = false,
  isLastRedColor = false,
  dataText?: Array<number | string | null | undefined>
): void {
  const data = (rawData || []).map((v) =>
    v != null ? parseFloat(String(v).replace(/'|"/g, '')) : NaN
  );
  const totalBoxCnt = Math.max(data.length, maxDataCnt);
  const valueH = boxH - valueBoxH;
  const hLineTop = isDrawHLineFull ? top : top + (boxH * 2) / 10;

  let minValue = Infinity;
  let maxValue = -Infinity;
  for (const val of data) {
    if (!Number.isNaN(val)) {
      if (val < minValue) minValue = val;
      if (val > maxValue) maxValue = val;
    }
  }
  if (!Number.isFinite(minValue)) {
    minValue = 0;
    maxValue = 100;
  } else if (minValue === maxValue) {
    minValue = 0;
    maxValue = maxValue * 2 || 100;
  }
  const valueRange = maxValue - minValue || 1;

  const textArr = (dataText && dataText.length ? dataText : rawData || []).map((v) => {
    if (v == null || v === '') return '';
    const s = String(v);
    if (s.includes('/') || s.includes(':')) return s;
    const num = parseFloat(s);
    return Number.isNaN(num) ? s : num.toFixed(decimalPlace);
  });

  if (isDrawWLine) {
    canvas.SetDrawLine(
      context,
      left,
      top + boxH,
      left + boxW * totalBoxCnt,
      top + boxH,
      gradationStroke,
      COLORS.llGray
    );
  }

  let preX: number | null = null;
  let preY: number | null = null;

  for (let i = 0; i < totalBoxCnt; i++) {
    const startX = left + boxW * i;
    if (isDrawHLine && i + 1 < totalBoxCnt) {
      canvas.dashedLine(
        context,
        startX + boxW,
        hLineTop,
        startX + boxW,
        top + boxH,
        dashLine,
        COLORS.llGray
      );
    }
    const val = data[i];
    if (val != null && !Number.isNaN(val)) {
      const centerX = startX + boxW / 2;
      const curY =
        top + boxH - valueUnderGap - ((val - minValue) / valueRange) * (valueH - valueUnderGap);

      if (preX !== null && preY !== null) {
        canvas.SetDrawLine(context, preX, preY, centerX, curY, 1.5, COLORS.black);
      }
      const isLast = i === data.length - 1;
      const pointColor = isLast && isLastRedColor ? COLORS.red : COLORS.black;
      canvas.SetDrawEllipse(context, centerX, curY, pointRadius, pointColor);

      const font = isLast && isLastValueBold ? `bold ${valueFont}` : valueFont;
      canvas.SetDrawText(
        context,
        textArr[i] ?? '',
        font,
        pointColor,
        'center',
        'left',
        'bottom',
        'alphabetic',
        startX,
        curY - pointRadius - 4,
        boxW,
        0
      );
      preX = centerX;
      preY = curY;
    }
  }
}

export function DrawConnectionLineGraphWithShiftDate(
  context: any,
  left: number,
  top: number,
  rawData: Array<number | string | null | undefined>,
  maxDataCnt: number,
  dates: Array<number | string>,
  gradationStroke: number,
  boxW: number,
  boxH: number,
  valueBoxH: number,
  valueUnderGap: number,
  valueFont: string,
  decimalPlace: number,
  pointRadius: number,
  _dashLine = 5,
  isDrawWLine = true,
  _isDrawHLine = false,
  _isDrawHLineFull = false,
  isLastValueBold = false,
  isLastRedColor = false,
  dataText?: Array<number | string | null | undefined>
): void {
  const data = (rawData || []).map((v) =>
    v != null ? parseFloat(String(v).replace(/'|"/g, '')) : NaN
  );
  const contentBoxCnt = Math.max(1, maxDataCnt - 2);
  const valueH = boxH - valueBoxH;

  let minValue = Infinity;
  let maxValue = -Infinity;
  for (const val of data) {
    if (!Number.isNaN(val)) {
      if (val < minValue) minValue = val;
      if (val > maxValue) maxValue = val;
    }
  }
  if (!Number.isFinite(minValue)) {
    minValue = 0;
    maxValue = 100;
  } else if (minValue === maxValue) {
    minValue = 0;
    maxValue = maxValue * 2 || 100;
  }
  const valueRange = maxValue - minValue || 1;

  let minDate = Infinity;
  let maxDate = -Infinity;
  for (const d of dates || []) {
    const n = Number(d);
    if (!Number.isNaN(n)) {
      if (n < minDate) minDate = n;
      if (n > maxDate) maxDate = n;
    }
  }
  const dateRange = Math.max(1, convertDatetimeDiffSeconds(minDate, maxDate));

  if (isDrawWLine) {
    canvas.SetDrawLine(
      context,
      left,
      top + boxH,
      left + boxW * maxDataCnt,
      top + boxH,
      gradationStroke,
      COLORS.llGray
    );
  }

  const textArr = (dataText && dataText.length ? dataText : rawData || []).map((v) => {
    if (v == null || v === '') return '';
    const s = String(v);
    const num = parseFloat(s);
    return Number.isNaN(num) ? s : num.toFixed(decimalPlace);
  });

  const validIndices: number[] = [];
  data.forEach((v, idx) => {
    if (!Number.isNaN(v)) validIndices.push(idx);
  });
  if (!validIndices.length) return;

  const firstIdx = validIndices[0];
  const lastIdx = validIndices[validIndices.length - 1];

  let preX: number | null = null;
  let preY: number | null = null;

  for (const idx of validIndices) {
    const val = data[idx];
    const diffSec = convertDatetimeDiffSeconds(minDate, dates[idx]);
    const curX = left + boxW + (boxW * contentBoxCnt * diffSec) / dateRange;
    const curY =
      top + boxH - valueUnderGap - ((val - minValue) / valueRange) * (valueH - valueUnderGap);

    if (preX !== null && preY !== null) {
      canvas.SetDrawLine(context, preX, preY, curX, curY, 1.5, COLORS.black);
    }
    const isLast = idx === lastIdx;
    const pointColor = isLast && isLastRedColor ? COLORS.red : COLORS.black;
    canvas.SetDrawEllipse(context, curX, curY, pointRadius, pointColor);

    if (idx === firstIdx || idx === lastIdx) {
      const font = isLast && isLastValueBold ? `bold ${valueFont}` : valueFont;
      canvas.SetDrawText(
        context,
        textArr[idx] ?? '',
        font,
        pointColor,
        'center',
        'left',
        'bottom',
        'middle',
        curX - boxW / 2,
        curY - pointRadius - 6,
        boxW,
        0
      );
    }
    preX = curX;
    preY = curY;
  }
}

export function DrawDateHistoryWithShiftDate(
  context: any,
  left: number,
  top: number,
  _dashTop: number,
  dateLabels: Array<string | undefined>,
  maxDataCnt: number,
  _gradationStroke: number,
  boxW: number,
  boxH: number,
  dateValueFont: string,
  timeValueFont: string,
  isPrintType: 'R' | 'T' | string,
  isBackColor = false,
  _isDrawUnderLine = false,
  dateRaw: Array<number | string> = [],
  data: Array<unknown> = []
): void {
  if (isBackColor) {
    canvas.SetDrawRect(context, left, top, boxW * maxDataCnt, boxH, COLORS.reportGray);
  }

  if (isPrintType === 'R') {
    for (let i = 0; i < maxDataCnt; i++) {
      const label = dateLabels?.[i];
      if (!label) continue;
      const dateStr = i === 0 ? label.substring(0, 9) : label.substring(3, 9);
      const timeStr = label.substring(9, 14);
      canvas.SetDrawText(
        context,
        dateStr,
        dateValueFont,
        COLORS.black,
        'center',
        'left',
        'middle',
        'middle',
        left + boxW * i + 5,
        top,
        boxW,
        boxH / 2 + 45
      );
      canvas.SetDrawText(
        context,
        timeStr,
        timeValueFont,
        COLORS.ldGray,
        'center',
        'left',
        'top',
        'top',
        left + boxW * i + 5,
        top + boxH / 2 + 20,
        boxW,
        boxH / 2
      );
    }
  } else {
    let minDate = Infinity;
    let maxDate = -Infinity;
    for (const val of dateRaw || []) {
      const n = Number(val);
      if (!Number.isNaN(n)) {
        if (n < minDate) minDate = n;
        if (n > maxDate) maxDate = n;
      }
    }
    const contentBoxCnt = Math.max(1, maxDataCnt - 2);
    const dateRange = Math.max(1, convertDatetimeDiffSeconds(minDate, maxDate));

    let firstIdx = -1;
    let lastIdx = -1;
    for (let i = 0; i < (data || []).length; i++) {
      if (data[i] != null) {
        if (firstIdx === -1) firstIdx = i;
        lastIdx = i;
      }
    }
    const indices =
      firstIdx === -1
        ? []
        : firstIdx === lastIdx
        ? [firstIdx]
        : [firstIdx, lastIdx];

    for (const idx of indices) {
      const label = dateLabels?.[idx];
      if (!label) continue;
      const diffSec = convertDatetimeDiffSeconds(minDate, dateRaw[idx]);
      const curX = left + boxW + (boxW * contentBoxCnt * diffSec) / dateRange - boxW / 2;
      canvas.SetDrawText(
        context,
        label.substring(0, 9),
        dateValueFont,
        COLORS.black,
        'center',
        'left',
        'middle',
        'middle',
        curX,
        top,
        boxW,
        boxH / 2 + 45
      );
      canvas.SetDrawText(
        context,
        label.substring(9, 14),
        timeValueFont,
        COLORS.ldGray,
        'center',
        'left',
        'top',
        'top',
        curX,
        top + boxH / 2 + 20,
        boxW,
        boxH / 2
      );
    }
  }
}
