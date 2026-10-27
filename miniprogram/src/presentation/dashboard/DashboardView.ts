import { BCARecord } from '../../domain/entities/BCARecord.entity';
import { UserProfile } from '../../domain/entities/UserProfile.entity';
import { NormalizedDashboardSummary, normalize } from '../../application/services/DashboardBootstrapService';
import { cards, defaults, metrics, numeric } from '../../application/services/DashboardMetricsService';

export const HEALTH_GOALS = [
  { key: 'muscle', label: '增加骨骼肌' },
  { key: 'fat', label: '减少体脂肪' },
  { key: 'balance', label: '增加骨骼肌，减少体脂肪' },
] as const;
export type DashboardRow = Readonly<Record<string, unknown>>;
export type DashboardEquipment = 'H20B' | 'InBody120' | 'H30' | 'H40' | 'NotEquip';

export function equipmentModel(saved: unknown): DashboardEquipment {
  const values = Array.isArray(saved)
    ? saved.map(item => typeof item === 'object' && item !== null ? (item as { id?: unknown }).id : item).join(',')
    : String(saved ?? '');
  if (values.includes('H20B')) return 'H20B';
  if (values.includes('InBody120')) return 'InBody120';
  if (values.includes('H40')) return 'H40';
  if (values.includes('H30')) return 'H30';
  return 'NotEquip';
}

export function buildDashboardView(
  records: readonly BCARecord[], summary: NormalizedDashboardSummary = normalize(),
  selectedIndex = 0, viewType = 'weight', savedMetrics?: unknown, profile?: UserProfile | null
) {
  const rows = records.map(record => record.raw);
  const index = Math.max(0, Math.min(selectedIndex, rows.length - 1));
  const summaryCards = cards(savedMetrics, rows[index], summary, profile ? { Gender: profile.gender } : null);
  const active = summaryCards.some(item => item.id === viewType) ? viewType : summaryCards[0].id;
  const metric = metrics.find(item => item.id === active) ?? metrics[0];
  const chronological = records.slice().reverse();
  return {
    ...summary, summaryCards, selectedIndex: index, viewType: active,
    inbodyTestData: rows,
    timeData: chronological.map(record => record.shortDateText),
    trendValues: chronological.map(record => numeric(record.raw[metric.key]) ? Number(record.raw[metric.key]) : null),
    trendMetric: metric,
    availableMetrics: metrics.filter(item => defaults.includes(item.key) || rows.some(row => numeric(row[item.key]))).map(item => item.key),
  };
}

export function selectionText(row: DashboardRow, viewType: string) {
  const metric = metrics.find(item => item.id === viewType);
  if (!metric || !numeric(row[metric.key])) return null;
  const date = String(row.DATETIMES || '');
  return {
    date: `${date.slice(2,4)}.${date.slice(4,6)}.${date.slice(6,8)} ${date.slice(8,10)}:${date.slice(10,12)}`,
    value: Number(row[metric.key]).toFixed(metric.decimals) + metric.unit,
  };
}
