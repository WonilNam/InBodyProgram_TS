import { BCARecord } from '../../domain/entities/BCARecord.entity';
import { METRIC_SPECS, MetricCode } from '../../domain/value-objects/MetricSpec.vo';
import { EquipmentVisibilityPolicy, EquipmentMetricMatrix } from '../../domain/services/EquipmentVisibilityPolicy';
import { formatHistoryDatetimes } from '../../domain/services/InBodyFormatService';
import { DateParser } from '../../domain/services/DateParser';

export interface HistoryPreferences {
  range: 'R' | 'T'; dates: string[] | null; equips: string[] | null;
  visible: string[] | null; order: string[]; equipMode: string;
  start: string; end: string; dateLabel: string;
}
export function buildHistoryView(records: readonly BCARecord[], preferences: HistoryPreferences, matrix: EquipmentMetricMatrix) {
  const all = records.slice().sort((a,b) => a.timestamp - b.timestamp);
  const start = DateParser.toBoundary14Digits(preferences.start, false, records[0]?.datetimes ?? '');
  const end = DateParser.toBoundary14Digits(preferences.end, true, records[0]?.datetimes ?? '');
  let selected = all.filter(row =>
    (preferences.dates === null || preferences.dates.includes(row.datetimes)) &&
    (preferences.equips === null || preferences.equips.includes(row.equip)) &&
    (!start || row.datetimes >= start) && (!end || row.datetimes <= end));
  if (preferences.range === 'R') selected = selected.slice(-7);
  const dates = selected.map(row => row.datetimes);
  const labels = dates.map(formatHistoryDatetimes);
  const items = (Object.keys(METRIC_SPECS) as MetricCode[]).map(key => {
    const spec = METRIC_SPECS[key];
    const data = selected.map(row => {
      const value = row.metrics[key].value;
      if (!EquipmentVisibilityPolicy.isMetricSupported(key, row.equip, matrix) || value === null || value <= 0) return null;
      return key === 'BMR' ? Math.floor(value) : value;
    });
    const textData = data.map(value => value === null ? null : value.toFixed(spec.decimals));
    const rangeData = selected.map(row => row.metrics[key].max > row.metrics[key].min
      ? { min: row.metrics[key].min, max: row.metrics[key].max } : null);
    let index = data.length - 1;
    while (index >= 0 && data[index] === null) index--;
    return { key, name: spec.label, unit: spec.unit, decemal: spec.decimals,
      data, textData, rangeData, check: index < 0 ? -1 : 0,
      pointCount: data.filter(value => value !== null).length,
      selectedIndex: index, selectedValue: textData[index] ?? '', selectedDate: labels[index] ?? '' };
  });
  const available = items.filter(item => item.check >= 0);
  const hasVisible = available.some(item => preferences.visible?.includes(item.key));
  const visible = available.filter(item => !hasVisible || preferences.visible!.includes(item.key));
  visible.sort((a,b) => {
    const rank = (key: string) => { const i = preferences.order.indexOf(key); return i < 0 ? preferences.order.length : i; };
    return rank(a.key)-rank(b.key);
  });
  return {
    isLoading: false, IsExistsData: records.length > 0, graphType: preferences.range, flag: 0,
    historyItem: items, historyGroup: visible.length ? [visible] : [], groupLength: visible.length ? 1 : 0,
    historyData: { Datetimes: dates.map(Number), DatetimesText: labels, Equip: selected.map(row => row.equip),
      ...Object.fromEntries(items.map(item => [item.key, item.data])) },
    shortDateRangeText: preferences.dateLabel || '全部',
    shortEquipText: preferences.equipMode === 'none' || preferences.equips?.length === 0 ? '未选择设备' :
      preferences.equips ? preferences.equips.join('、') : '所有设备',
  };
}
export type HistoryView = ReturnType<typeof buildHistoryView>;
