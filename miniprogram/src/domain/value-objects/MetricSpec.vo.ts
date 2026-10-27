export type MetricCode =
  | 'WT'
  | 'SMM'
  | 'BFM'
  | 'BMI'
  | 'PBF'
  | 'WHR'
  | 'VFA'
  | 'VFALevel'
  | 'BMR'
  | 'WED'
  | 'INLL'
  | 'INLL_LV'
  | 'TBW'
  | 'ICW'
  | 'ECW'
  | 'PROTEIN'
  | 'MINERAL'
  | 'BMC'
  | 'BCM'
  | 'BSMI'
  | 'WBPA50'
  | 'FS'
  | 'InBodyAge';

export type EvaluationLevel = 'low' | 'normal' | 'high' | 'unknown';

export interface MetricSpec {
  readonly code: MetricCode;
  readonly label: string;
  readonly unit: string;
  readonly decimals: 0 | 1 | 2 | 3;
  readonly hideWhenZero: boolean;
}

export const METRIC_SPECS: Readonly<Record<MetricCode, MetricSpec>> = {
  WT:        { code: 'WT',        label: '体重',          unit: 'kg',    decimals: 1, hideWhenZero: true },
  SMM:       { code: 'SMM',       label: '骨骼肌量',      unit: 'kg',    decimals: 1, hideWhenZero: true },
  BFM:       { code: 'BFM',       label: '体脂肪量',      unit: 'kg',    decimals: 1, hideWhenZero: true },
  BMI:       { code: 'BMI',       label: 'BMI',           unit: 'kg/m²', decimals: 1, hideWhenZero: true },
  PBF:       { code: 'PBF',       label: '体脂率',        unit: '%',     decimals: 1, hideWhenZero: true },
  WHR:       { code: 'WHR',       label: '腰臀比',        unit: '',      decimals: 2, hideWhenZero: true },
  VFA:       { code: 'VFA',       label: '内脏脂肪面积',  unit: 'cm²',   decimals: 1, hideWhenZero: true },
  VFALevel:  { code: 'VFALevel',  label: '内脏脂肪等级',  unit: '级',    decimals: 0, hideWhenZero: true },
  BMR:       { code: 'BMR',       label: '基础代谢率',    unit: 'kcal',  decimals: 0, hideWhenZero: true },
  WED:       { code: 'WED',       label: '细胞外水分比率', unit: '',      decimals: 3, hideWhenZero: true },
  INLL:      { code: 'INLL',      label: '下肢肌肉量',    unit: 'kg',    decimals: 1, hideWhenZero: true },
  INLL_LV:   { code: 'INLL_LV',   label: '腿部肌肉量等级', unit: '级',    decimals: 0, hideWhenZero: true },
  TBW:       { code: 'TBW',       label: '体水分',        unit: 'L',     decimals: 1, hideWhenZero: true },
  ICW:       { code: 'ICW',       label: '细胞内水分',    unit: 'L',     decimals: 1, hideWhenZero: true },
  ECW:       { code: 'ECW',       label: '细胞外水分',    unit: 'L',     decimals: 1, hideWhenZero: true },
  PROTEIN:   { code: 'PROTEIN',   label: '蛋白质',        unit: 'kg',    decimals: 1, hideWhenZero: true },
  MINERAL:   { code: 'MINERAL',   label: '无机盐',        unit: 'kg',    decimals: 2, hideWhenZero: true },
  BMC:       { code: 'BMC',       label: '骨矿物质含量',  unit: 'kg',    decimals: 2, hideWhenZero: true },
  BCM:       { code: 'BCM',       label: '身体细胞量',    unit: 'kg',    decimals: 1, hideWhenZero: true },
  BSMI:      { code: 'BSMI',      label: 'SMI骨骼肌指数', unit: 'kg/m²', decimals: 1, hideWhenZero: true },
  WBPA50:    { code: 'WBPA50',    label: '全身相位角',    unit: '°',     decimals: 1, hideWhenZero: true },
  FS:        { code: 'FS',        label: 'InBody 分数',   unit: '分',    decimals: 0, hideWhenZero: true },
  InBodyAge: { code: 'InBodyAge', label: 'InBody 年龄',   unit: '岁',    decimals: 0, hideWhenZero: true },
};

/**
 * 将原始测量值按指标规格规约为展示数值与字符串。
 */
export function normalizeMetricNumber(code: MetricCode, raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === '' || raw === '-') return null;
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  const spec = METRIC_SPECS[code];
  if (spec.hideWhenZero && num === 0) return null;
  const factor = Math.pow(10, spec.decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

export function formatMetricValue(code: MetricCode, raw: unknown): string {
  const normalized = normalizeMetricNumber(code, raw);
  if (normalized === null) return '';
  const spec = METRIC_SPECS[code];
  return normalized.toFixed(spec.decimals);
}

/**
 * 先按展示精度规约当前值与上一次值，再相减求差值，彻底消除视觉相差 1 的问题。
 */
export function computeMetricDelta(
  code: MetricCode,
  currentRaw: unknown,
  previousRaw: unknown
): { delta: number | null; formatted: string } {
  const current = normalizeMetricNumber(code, currentRaw);
  const previous = normalizeMetricNumber(code, previousRaw);
  if (current === null || previous === null) {
    return { delta: null, formatted: '' };
  }
  const spec = METRIC_SPECS[code];
  const factor = Math.pow(10, spec.decimals);
  const diff = Math.round((current - previous) * factor) / factor;
  if (Object.is(diff, -0) || diff === 0) {
    return { delta: 0, formatted: '0' };
  }
  const absFormatted = Math.abs(diff)
    .toFixed(spec.decimals)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*[1-9])0+$/, '$1');
  const sign = diff > 0 ? '+' : '-';
  return { delta: diff, formatted: `${sign}${absFormatted}` };
}
