import { BCARecord, BCARecordWithDelta, CidBodyType, MetricReading } from '../../domain/entities/BCARecord.entity';
import { DateParser } from '../../domain/services/DateParser';
import { EquipmentMetricMatrix, EquipmentVisibilityPolicy } from '../../domain/services/EquipmentVisibilityPolicy';
import {
  computeMetricDelta,
  formatMetricValue,
  METRIC_SPECS,
  MetricCode,
  normalizeMetricNumber,
} from '../../domain/value-objects/MetricSpec.vo';

const ALL_METRIC_CODES = Object.keys(METRIC_SPECS) as MetricCode[];

/** Flatten the nested metric DTO already supported by the mapper for legacy page consumers. */
export function toDisplayRow(input: Record<string, any>): Record<string, any> {
  const row = { ...input, ...(input.BCA && typeof input.BCA === 'object' ? input.BCA : {}) };
  for (const [key, field] of Object.entries(row)) {
    if (field && typeof field === 'object' && 'VALUE' in field) {
      const metric = field as { VALUE: unknown; MIN?: unknown; MAX?: unknown; PERCENT?: unknown };
      row[key] = metric.VALUE;
      if (metric.MIN != null) row[`${key}_MIN`] = metric.MIN;
      if (metric.MAX != null) row[`${key}_MAX`] = metric.MAX;
      if (metric.PERCENT != null) row[`P${key}`] = metric.PERCENT;
    }
  }
  row.DATETIMES = String(row.DATETIMES ?? row.Datetimes ?? '');
  row.EQUIP = String(row.EQUIP ?? row.Equip ?? '');
  return row;
}

export class BcaReportMapper {
  /**
   * 将后端原始记录对象映射为强类型的领域实体 BCARecord
   */
  static toDomainRecord(
    rawInput: Record<string, any>,
    matrix?: EquipmentMetricMatrix | null
  ): BCARecord {
    const bca = toDisplayRow(rawInput);
    const rawDt = String(rawInput?.DATETIMES ?? bca?.DATETIMES ?? rawInput?.Datetimes ?? '');
    const normalized14 = DateParser.normalizeTo14Digits(rawDt, false);
    const equip = String(rawInput?.EQUIP ?? bca?.EQUIP ?? rawInput?.Equip ?? '');
    const uidDatetimes = String(rawInput?.UID_DATETIMES ?? bca?.UID_DATETIMES ?? rawDt);
    const sexRaw = String(rawInput?.SEX ?? bca?.SEX ?? '').toUpperCase();
    const sex: 'M' | 'F' | '' = sexRaw === 'M' || sexRaw === '1' ? 'M' : sexRaw === 'F' || sexRaw === '2' ? 'F' : '';

    const metrics = {} as Record<MetricCode, MetricReading>;

    for (const code of ALL_METRIC_CODES) {
      const sourceCode = code === 'VFALevel' ? 'VFL' : code;
      const rawField = bca?.[code] ?? bca?.[sourceCode] ?? rawInput?.[code];
      const rawVal = rawField && typeof rawField === 'object' && 'VALUE' in rawField
        ? rawField.VALUE
        : rawField;
      const minVal = Number(rawField?.MIN ?? bca?.[`${code}_MIN`] ?? 0) || 0;
      const maxVal = Number(rawField?.MAX ?? bca?.[`${code}_MAX`] ?? 0) || 0;
      const pctVal = Number(rawField?.PERCENT ?? bca?.[`P${code}`] ?? 100) || 100;

      const normalizedVal = normalizeMetricNumber(code, rawVal);
      const displayValue = formatMetricValue(code, rawVal);
      const supportedByEquip = EquipmentVisibilityPolicy.isMetricSupported(code, equip, matrix);
      const visible = supportedByEquip && normalizedVal !== null;
      const level = EquipmentVisibilityPolicy.evaluateRangeLevel(code, normalizedVal, minVal, maxVal);

      metrics[code] = {
        code,
        value: normalizedVal,
        displayValue,
        min: minVal,
        max: maxVal,
        percent: pctVal,
        level,
        visible,
      };
    }

    const cidType = BcaReportMapper.evaluateCidType(metrics.WT, metrics.SMM, metrics.BFM);

    return {
      uidDatetimes,
      datetimes: normalized14 || rawDt,
      dateText: DateParser.formatDisplayDate(rawDt, true),
      shortDateText: DateParser.formatShortMonthDay(rawDt),
      timestamp: Number(normalized14 || 0),
      equip,
      sex,
      age: Math.round(Number(rawInput?.AGE ?? bca?.AGE ?? 0) || 0),
      height: Number(rawInput?.HT ?? bca?.HT ?? 0) || 0,
      cidType,
      metrics,
      raw: bca,
    };
  }

  /**
   * 批量转换历史记录并按时间降序（最新在前）排列
   */
  static toChronologicalDescList(
    rawList: unknown,
    matrix?: EquipmentMetricMatrix | null
  ): BCARecord[] {
    if (!Array.isArray(rawList)) return [];
    return rawList
      .filter((item): item is Record<string, any> => Boolean(item && typeof item === 'object'))
      .map(item => BcaReportMapper.toDomainRecord(item, matrix))
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * 组合当前选中记录与其前一次记录，生成全部指标的规约差值
   */
  static withPreviousDelta(
    current: BCARecord,
    previous: BCARecord | null
  ): BCARecordWithDelta {
    const deltas = {} as Record<MetricCode, string>;
    for (const code of ALL_METRIC_CODES) {
      const curVal = current.metrics[code]?.value ?? null;
      const prevVal = previous?.metrics[code]?.value ?? null;
      deltas[code] = computeMetricDelta(code, curVal, prevVal).formatted;
    }
    return {
      record: current,
      previousRecord: previous,
      deltas,
    };
  }

  /**
   * 根据体重、骨骼肌量、体脂肪量的百分比判定 C / I / D 体型
   */
  static evaluateCidType(
    wt?: MetricReading,
    smm?: MetricReading,
    bfm?: MetricReading
  ): CidBodyType {
    if (!wt?.visible || !smm?.visible || !bfm?.visible) return '';
    const smmPct = smm.percent;
    const wtPct = wt.percent;
    const bfmPct = bfm.percent;
    if (smmPct < wtPct - 5 && smmPct < bfmPct - 5) return 'C';
    if (smmPct > wtPct + 5 && smmPct > bfmPct + 5) return 'D';
    return 'I';
  }
}
