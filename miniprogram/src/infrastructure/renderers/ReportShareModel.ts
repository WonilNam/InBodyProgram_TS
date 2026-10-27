import { getBodyCoordinate } from '../../domain/services/InBodyFormatService';

const SHARE_METRIC_FIELDS: ReadonlyArray<readonly [string, string, string]> = [
  ['WT', '体重', 'kg'],
  ['SMM', '骨骼肌量', 'kg'],
  ['BFM', '体脂肪量', 'kg'],
  ['BMI', 'BMI', 'kg/m²'],
  ['PBF', '体脂率', '%'],
  ['VFALevel', '内脏脂肪等级', 'Lv'],
  ['BMR', '基础代谢率', 'kcal'],
];

const DETAILED_SECTIONS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['肌肉脂肪分析', ['WT', 'SMM', 'BFM']],
  ['肥胖分析', ['BMI', 'PBF']],
  ['下肢肌肉分析', ['INLL']],
  ['腹部肥胖分析', ['WHR', 'VFA', 'VFALevel']],
  ['体水分分析', ['TBW', 'ICW', 'ECW', 'WED']],
  ['综合分析', ['BMR', 'INLL_LV']],
];

const DETAILED_NAMES: Readonly<Record<string, string>> = {
  WT: '体重',
  SMM: '骨骼肌量',
  BFM: '体脂肪量',
  BMI: 'BMI',
  PBF: '体脂率',
  INLL: '下肢肌肉量',
  WHR: '腰臀比',
  VFA: '内脏脂肪面积',
  VFALevel: '内脏脂肪等级',
  TBW: '体水分',
  ICW: '细胞内水分',
  ECW: '细胞外水分',
  WED: '细胞外水分比率',
  BMR: '基础代谢率',
  INLL_LV: '下肢肌肉等级',
  PROTEIN: '蛋白质',
  MINERAL: '无机盐',
  BMC: '骨矿物质含量',
  BCM: '身体细胞量',
  BSMI: 'SMI骨骼肌指数',
  WBPA50: '全身相位角',
};

const DETAILED_UNITS: Readonly<Record<string, string>> = {
  BSMI: 'kg/m²',
  WBPA50: '°',
};

const DETAILED_DELTA_DECIMALS: Readonly<Record<string, number>> = {
  WED: 3,
};

const EQUIPMENT_CONTROLLED_KEYS: readonly string[] = [
  'WT',
  'SMM',
  'BFM',
  'PBF',
  'WED',
  'INLL',
  'BMI',
  'WHR',
  'TBW',
  'ICW',
  'ECW',
  'PROTEIN',
  'MINERAL',
  'BMC',
  'BCM',
  'VFA',
  'VFALevel',
  'SEG_SLM',
  'SEG_BFM',
  'SEG_ECW_TBW',
  'BSMI',
  'WBPA50',
  'ETYPE2',
  'FS',
  'InBodyAge',
];

function isMeasuredValue(value: unknown): boolean {
  return (
    value !== undefined &&
    value !== null &&
    String(value).trim() !== '' &&
    Number.isFinite(Number(value))
  );
}

function isShareMetricValue(key: string, value: unknown): boolean {
  return isMeasuredValue(value) && !(key === 'VFALevel' && Number(value) === 0);
}

function isVisible(data: any): boolean {
  return Boolean(data && !/display\s*:\s*none/i.test(String(data.Style || '')));
}

export function formatDelta(value: unknown, decimals = 2, fallbackZero = false): string {
  if (!isMeasuredValue(value)) return fallbackZero ? '0' : '';
  const num = Number(value);
  if (!Number.isFinite(num)) return fallbackZero ? '0' : '';
  const trimmed = parseFloat(num.toFixed(decimals)).toString();
  const normalized = trimmed === '-0' ? '0' : trimmed;
  return Number(normalized) > 0 ? `+${normalized}` : normalized;
}

export function formatFixedDelta(value: unknown, decimals: number): string {
  const zero = (0).toFixed(decimals);
  if (!isMeasuredValue(value)) return zero;
  const fixed = Number(value).toFixed(decimals);
  if (Number(fixed) === 0) return zero;
  return Number(fixed) > 0 ? `+${fixed}` : fixed;
}

export function buildMetrics(
  detail: Record<string, any>,
  changes: Record<string, any> = {}
): Array<Record<string, any>> {
  return SHARE_METRIC_FIELDS.filter(
    ([key]) =>
      detail[key] &&
      !/display\s*:\s*none/i.test(String(detail[key].Style || '')) &&
      isShareMetricValue(key, detail[key].VALUE)
  ).map(([key, name, unit]) => {
    const data = detail[key];
    const change = changes[key];
    const hasValue = isMeasuredValue(data.VALUE);
    const hasGraph =
      hasValue &&
      (key === 'SMM'
        ? isMeasuredValue(data.PSMM)
        : isMeasuredValue(data.MIN) &&
          isMeasuredValue(data.MAX) &&
          Number(data.MAX) > Number(data.MIN));
    const formattedValue = hasValue
      ? key === 'BMR'
        ? String(Math.floor(Number(data.VALUE)))
        : String(data.VALUE)
      : '--';
    const formattedChange = isMeasuredValue(change)
      ? key === 'BMR'
        ? Math.round(Number(change))
        : change
      : 0;
    const delta = !hasValue
      ? ''
      : key === 'BMI'
      ? formatFixedDelta(change, 1)
      : Number(formattedChange) > 0
      ? `+${formattedChange}`
      : String(formattedChange);

    return {
      key,
      name: data.NAME || name,
      unit: data.UNIT === undefined ? unit : data.UNIT,
      value: formattedValue,
      delta,
      hasGraph,
      graphData: { ...data },
      rawKey: key === 'VFALevel' ? 'VFL' : key,
    };
  });
}

export function cropSquare(
  width: number,
  height: number
): { x: number; y: number; size: number } {
  const size = Math.min(width, height);
  return { x: (width - size) / 2, y: (height - size) / 2, size };
}

export function formatMeasurementTime(value: unknown, fallback = ''): string {
  const raw = String(value ?? '').trim();
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(?:\d{2})?$/);
  const separated = raw.match(/^(\d{4})[-/.](\d{2})[-/.](\d{2})[ T](\d{2}):(\d{2})/);
  const parts = compact || separated;
  if (!parts) return fallback || '';
  return `${parts[1]}.${parts[2]}.${parts[3]} ${parts[4]}:${parts[5]}`;
}

export function distributeMetricTops(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [341];
  const layouts: Record<number, { start: number; step: number }> = {
    2: { start: 171, step: 340 },
    3: { start: 101, step: 220 },
    4: { start: 71, step: 170 },
    5: { start: 41, step: 150 },
  };
  const layout = layouts[Math.min(count, 5)];
  return Array.from({ length: count }, (_, index) => layout.start + index * layout.step);
}

export function applyEquipmentVisibility<T extends Record<string, any>>(
  detail: T,
  historyDefaultSet: Record<string, any> = {}
): T {
  if (!detail || !historyDefaultSet || !Object.keys(historyDefaultSet).length) {
    return detail;
  }
  const equip = detail.EQUIP;
  EQUIPMENT_CONTROLLED_KEYS.forEach((key) => {
    const data = detail[key];
    if (!data) return;
    const configuredEquipment = historyDefaultSet[key];
    const enabled =
      (key === 'FS' && equip === '120') ||
      (configuredEquipment != null && String(configuredEquipment).indexOf(String(equip)) >= 0);
    if (!enabled) {
      data.Style = 'display:none;';
    }
  });
  return detail;
}

export function getScoreEmoji(score: unknown): string {
  const value = Number(score);
  if (!Number.isFinite(value)) return '';
  return value >= 80 ? '🏆' : value >= 70 ? '👍' : '💪';
}

export function calculateSafeCanvasSize(
  logicalWidth: number,
  logicalHeight: number,
  maxCanvasHeight = 8192,
  maxExportSide = 8192
): {
  renderScale: number;
  canvasWidth: number;
  canvasHeight: number;
  exportWidth: number;
  exportHeight: number;
} {
  const renderScale = Math.min(
    2,
    maxCanvasHeight / logicalHeight,
    maxExportSide / logicalHeight,
    maxExportSide / logicalWidth
  );
  const canvasWidth = Math.max(1, Math.round(logicalWidth * renderScale));
  const canvasHeight = Math.max(1, Math.round(logicalHeight * renderScale));
  return {
    renderScale,
    canvasWidth,
    canvasHeight,
    exportWidth: canvasWidth,
    exportHeight: canvasHeight,
  };
}

export function buildDetailedReport(
  detail: Record<string, any>,
  changes: Record<string, any> = {},
  extras: Record<string, any> = {}
): Record<string, any> {
  const buildMetricRow = (key: string): Record<string, any> | null => {
    const data = detail[key];
    if (!isVisible(data) || !isShareMetricValue(key, data.VALUE)) return null;
    if (key === 'INLL_LV' && Number(data.VALUE) === 0) return null;
    const graphValue = key === 'SMM' ? data.PSMM : data.VALUE;
    const isIntegerMetric = key === 'BMR' || key === 'SCORE';
    const formattedValue =
      isIntegerMetric && isMeasuredValue(data.VALUE)
        ? String(
            key === 'BMR'
              ? Math.floor(Number(data.VALUE))
              : Math.round(Number(data.VALUE))
          )
        : String(data.VALUE);
    return {
      type: 'metric',
      key,
      name: DETAILED_NAMES[key] || data.NAME || key,
      value: formattedValue,
      unit: DETAILED_UNITS[key] || data.UNIT || '',
      delta:
        key === 'BMI' || key === 'WHR'
          ? formatFixedDelta(changes[key], key === 'BMI' ? 1 : 2)
          : formatDelta(
              changes[key],
              isIntegerMetric ? 0 : DETAILED_DELTA_DECIMALS[key] || 2,
              true
            ),
      hasGraph:
        isMeasuredValue(graphValue) &&
        (key === 'SMM' ||
          (isMeasuredValue(data.MIN) &&
            isMeasuredValue(data.MAX) &&
            Number(data.MAX) > Number(data.MIN))),
      graphData: { ...data },
    };
  };

  const sections: Array<Record<string, any>> = [];
  const segmentType = String(detail.ETYPE3?.VALUE || '');
  const segmentCodeIndexes = [1, 4, 3, 0, 2];
  const evaluation = (code: string) =>
    code === '0' ? '低标准' : code === '1' ? '标准' : code === '2' ? '超标准' : '';

  const segmentDefs: Array<[string, any, string]> = [
    ['肌肉', detail.SEG_SLM, segmentType.substring(0, 5)],
    ['体脂肪', detail.SEG_BFM, segmentType.substring(5, 10)],
  ];
  const segmentGroups = segmentDefs
    .map(([title, group, codes]) => ({
      title,
      rows:
        isVisible(group) && Array.isArray(group.DATA)
          ? group.DATA.map((item: any, index: number) => ({ item, index }))
              .filter(({ item }: { item: any }) => isMeasuredValue(item.VALUE))
              .map(({ item, index }: { item: any; index: number }) => ({
                type: 'segment',
                name: item.NAME,
                value: String(item.VALUE),
                unit: item.STYLE || '',
                delta: formatDelta(
                  changes[item.TYPE] === undefined ? item.CHANGE : changes[item.TYPE],
                  2,
                  true
                ),
                pi: isMeasuredValue(item.PI) ? `${item.PI}%` : '',
                evaluation: evaluation(codes.charAt(segmentCodeIndexes[index])),
                segmentIndex: index,
              }))
              .sort(
                (a: any, b: any) =>
                  [4, 3, 0, 2, 1].indexOf(a.segmentIndex) -
                  [4, 3, 0, 2, 1].indexOf(b.segmentIndex)
              )
          : [],
    }))
    .filter((section) => section.rows.length > 0);

  if (segmentGroups.length) {
    sections.push({ title: '节段分析', groups: segmentGroups });
  }

  DETAILED_SECTIONS.forEach(([title, keys]) => {
    const rows = keys.map(buildMetricRow).filter(Boolean);
    if (rows.length) sections.push({ title, rows });
  });

  if (
    !detail.IsManualInput &&
    isVisible(detail.BMI) &&
    isVisible(detail.PBF) &&
    isMeasuredValue(detail.BMI.VALUE) &&
    isMeasuredValue(detail.PBF.VALUE)
  ) {
    sections.push({
      title: '体型坐标',
      rows: [
        {
          type: 'coordinate',
          name:
            extras.bodyType ||
            getBodyCoordinate(detail.BMI.VALUE, detail.PBF.VALUE, detail.SEX) ||
            '体型',
          bmi: Number(detail.BMI.VALUE),
          pbf: Number(detail.PBF.VALUE),
          sex: detail.SEX,
        },
      ],
    });
  }

  if (isVisible(detail.ETYPE2) && detail.ETYPE2.VALUE) {
    const raw = String(detail.ETYPE2.VALUE);
    const balanceLabel = (code: string) =>
      code === '0' ? '均衡' : code === '1' ? '轻度不均' : '严重不均';
    const rows: Array<Record<string, any>> = [
      { name: '上下', value: balanceLabel(raw.substring(11, 12)), unit: '', type: 'plain' },
    ];
    if (detail.EQUIP !== 'H30') {
      rows.unshift(
        { name: '上部', value: balanceLabel(raw.substring(9, 10)), unit: '', type: 'plain' },
        { name: '下部', value: balanceLabel(raw.substring(10, 11)), unit: '', type: 'plain' }
      );
    }
    sections.push({ title: '身体平衡评估', rows });
  }

  const compositionRows = ['PROTEIN', 'MINERAL', 'BMC', 'BCM', 'BSMI', 'WBPA50']
    .map(buildMetricRow)
    .filter(Boolean);
  if (compositionRows.length) {
    sections.push({ title: '人体成分分析', rows: compositionRows });
  }

  if (extras.cid && (isVisible(detail.WT) || isVisible(detail.SMM) || isVisible(detail.BFM))) {
    const cidRows = ['WT', 'SMM', 'BFM']
      .map(buildMetricRow)
      .filter((r): r is Record<string, any> => Boolean(r))
      .map((row) => ({ ...row, key: `${row.key}99` }));
    if (cidRows.length) {
      sections.splice(segmentGroups.length ? 2 : 1, 0, {
        title: 'CID',
        type: 'cid',
        subtitle: extras.cid.Title || '',
        symbol: extras.cid.Type || '',
        rows: cidRows,
      });
    }
  }

  return {
    date: extras.date || detail.DATETIMES_TXT || '',
    nickname: extras.nickname || '',
    age:
      isVisible(detail.InBodyAge) && Number(detail.InBodyAge.VALUE)
        ? `${detail.InBodyAge.VALUE} 岁 / ${detail.AGE || '--'} 岁`
        : '',
    score:
      isVisible(detail.FS) && isMeasuredValue(detail.FS.VALUE)
        ? `${detail.FS.VALUE} 分`
        : '',
    scoreDelta:
      isVisible(detail.FS) &&
      isMeasuredValue(detail.FS.VALUE) &&
      isMeasuredValue(changes.SCORE)
        ? Number(Number(changes.SCORE).toFixed(0)) === 0
          ? '0'
          : formatDelta(Number(changes.SCORE).toFixed(0))
        : '',
    sections,
  };
}

export function measureDetailedReport(report: Record<string, any>): number {
  let height = report.score ? 570 : 370;
  (report.sections || []).forEach((section: any) => {
    height += 88;
    if (section.type === 'cid') height += 294;
    else if (section.groups) height += section.groups.length * 332;
    else {
      (section.rows || []).forEach((row: any) => {
        height += row.type === 'coordinate' ? 650 : 116;
      });
    }
    if (section.subtitle && section.type !== 'cid') height += 62;
    height += 24;
  });
  return Math.max(750, height + 110);
}
