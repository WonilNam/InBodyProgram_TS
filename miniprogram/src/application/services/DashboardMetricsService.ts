export interface DashboardMetricDefinition {
  key: string;
  id: string;
  name: string;
  unit: string;
  decimals: number;
}

export interface DashboardSummaryCard extends DashboardMetricDefinition {
  whole: string;
  fraction: string;
  status: string;
  tone: '' | 'normal' | 'alert';
}

export const metrics: readonly DashboardMetricDefinition[] = [
  { key: 'WT', id: 'weight', name: '体重', unit: 'kg', decimals: 1 },
  { key: 'SMM', id: 'muscle', name: '骨骼肌量', unit: 'kg', decimals: 1 },
  { key: 'PBF', id: 'pbf', name: '体脂百分比', unit: '%', decimals: 1 },
  { key: 'BFM', id: 'BFM', name: '体脂肪量', unit: 'kg', decimals: 1 },
  { key: 'BMI', id: 'BMI', name: 'BMI', unit: 'kg/m²', decimals: 1 },
  { key: 'BMR', id: 'BMR', name: '基础代谢率', unit: 'kcal', decimals: 0 },
];

export const defaults: readonly string[] = ['WT', 'SMM', 'PBF'];

export function numeric(value: unknown): boolean {
  return value !== '' && value != null && value !== '-' && Number.isFinite(Number(value));
}

export function selection(saved: unknown): readonly string[] {
  return Array.isArray(saved) &&
    saved.length === 3 &&
    new Set(saved).size === 3 &&
    saved.every((key) => metrics.some((item) => item.key === key))
    ? (saved as string[])
    : defaults;
}

export function bmrRange(
  record: Record<string, any> = {},
  profile?: Record<string, any> | null
): { min: number; max: number } | null {
  if (
    numeric(record.BMR_MIN) &&
    numeric(record.BMR_MAX) &&
    Number(record.BMR_MIN) > 0 &&
    Number(record.BMR_MAX) > Number(record.BMR_MIN)
  ) {
    return { min: Number(record.BMR_MIN), max: Number(record.BMR_MAX) };
  }
  const gender = [record.SEX, record.GENDER, record.Gender, profile?.Gender].find(
    (v) => v != null && String(v).trim() !== ''
  );
  const sex = String(gender || '').trim().toUpperCase();
  if (!numeric(record.WT) || Number(record.WT) <= 0 || !['M', 'F'].includes(sex)) {
    return null;
  }
  const standardFatFreeWeight = Number(record.WT) * (sex === 'M' ? 0.85 : 0.77);
  return {
    min: 21.6 * standardFatFreeWeight * 0.9 + 370,
    max: 21.6 * standardFatFreeWeight * 1.1 + 370,
  };
}

export function cards(
  saved: unknown,
  record?: Record<string, any> | null,
  summary?: Record<string, any> | null,
  profile?: Record<string, any> | null
): DashboardSummaryCard[] {
  const hasRecord = Boolean(record);
  const rec = record || {};
  const sum = summary || {};

  return selection(saved).map((key) => {
    const metric = metrics.find((item) => item.key === key) ?? metrics[0];
    const value = hasRecord ? rec[key] : sum[key];
    const parts = numeric(value) ? Number(value).toFixed(metric.decimals).split('.') : ['-'];

    let status = '-';
    let tone: '' | 'normal' | 'alert' = '';
    const range = key === 'BMR' ? bmrRange(rec, profile) : null;
    const min = range ? range.min : rec[`${key}_MIN`];
    const max = range ? range.max : rec[`${key}_MAX`];

    if (numeric(value)) {
      if (key === 'SMM' && numeric(rec.PSMM)) {
        status =
          Number(rec.PSMM) < 90
            ? '低标准'
            : Number(rec.PSMM) > 110
            ? '超标准'
            : '标准';
      } else if (numeric(min) && numeric(max) && Number(max) > Number(min)) {
        status =
          Number(value) < Number(min)
            ? '低标准'
            : Number(value) > Number(max)
            ? '超标准'
            : '标准';
      }
      tone =
        status === '低标准' || (status === '超标准' && key !== 'SMM')
          ? 'alert'
          : status === '-'
          ? ''
          : 'normal';
    }

    return {
      ...metric,
      whole: parts[0],
      fraction: parts[1] || '',
      status,
      tone,
    };
  });
}

module.exports = {
  metrics,
  defaults,
  numeric,
  selection,
  cards,
  bmrRange,
};
