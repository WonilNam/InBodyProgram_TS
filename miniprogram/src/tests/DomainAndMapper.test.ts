import { DateParser } from '../domain/services/DateParser';
import { EquipmentVisibilityPolicy } from '../domain/services/EquipmentVisibilityPolicy';
import {
  computeMetricDelta,
  formatMetricValue,
  normalizeMetricNumber,
} from '../domain/value-objects/MetricSpec.vo';
import { BcaReportMapper } from '../infrastructure/mappers/BcaReportMapper';

describe('Host Domain & BcaReportMapper Unit Tests', () => {
  describe('MetricSpec.vo — Precision & Delta Computation', () => {
    it('rounds before subtracting so integer metrics (BMR) never suffer off-by-1 errors', () => {
      // 1500.4 rounds to 1500, 1499.6 rounds to 1500 => delta must be 0, not 1
      expect(formatMetricValue('BMR', 1500.4)).toBe('1500');
      expect(formatMetricValue('BMR', 1499.6)).toBe('1500');
      const res = computeMetricDelta('BMR', 1500.4, 1499.6);
      expect(res.delta).toBe(0);
      expect(res.formatted).toBe('0');
    });

    it('formats 1-decimal metrics (WT, SMM, BFM) and 3-decimal WED accurately', () => {
      expect(formatMetricValue('WT', '68.46')).toBe('68.5');
      expect(formatMetricValue('WED', 0.3784)).toBe('0.378');
      expect(computeMetricDelta('WT', 68.5, 67.2).formatted).toBe('+1.3');
      expect(computeMetricDelta('WED', 0.375, 0.382).formatted).toBe('-0.007');
    });

    it('hides zero or empty values when hideWhenZero is true', () => {
      expect(normalizeMetricNumber('VFA', 0)).toBeNull();
      expect(normalizeMetricNumber('VFA', '')).toBeNull();
      expect(normalizeMetricNumber('VFA', '-')).toBeNull();
      expect(formatMetricValue('VFA', 0)).toBe('');
    });
  });

  describe('DateParser — Multi-format Date Normalization & Boundary Resolution', () => {
    it('normalizes 6-digit, 8-digit, and 14-digit dates to 14 digits', () => {
      expect(DateParser.normalizeTo14Digits('260322', false)).toBe('20260322000000');
      expect(DateParser.normalizeTo14Digits(20260322, true)).toBe('20260322235959');
      expect(DateParser.normalizeTo14Digits('2026-03-22 14:30:15')).toBe('20260322143015');
    });

    it('formats display dates and resolves recent boundary', () => {
      expect(DateParser.formatDisplayDate('recent')).toBe('最后一次InBody测量日期');
      expect(DateParser.formatShortMonthDay('20260322143000')).toBe('03.22');
      expect(DateParser.toBoundary14Digits('recent', true, '20260322143000')).toBe('20260322235959');
    });
  });

  describe('EquipmentVisibilityPolicy — ECW/TBW Standard Range & Equipment Matrix', () => {
    it('evaluates ECW/TBW (WED) against standard 0.360 ~ 0.390 thresholds', () => {
      expect(EquipmentVisibilityPolicy.evaluateEcwTbwLevel(0.359)).toBe('low');
      expect(EquipmentVisibilityPolicy.evaluateEcwTbwLevel(0.360)).toBe('normal');
      expect(EquipmentVisibilityPolicy.evaluateEcwTbwLevel(0.378)).toBe('normal');
      expect(EquipmentVisibilityPolicy.evaluateEcwTbwLevel(0.390)).toBe('high');
      expect(EquipmentVisibilityPolicy.evaluateEcwTbwLevel(0)).toBe('unknown');
    });

    it('checks equipment matrix while always keeping BMR visible', () => {
      const matrix = {
        WED: ['InBodyH30', 'InBodyH40'],
        BMR: ['InBodyH40'],
      };
      expect(EquipmentVisibilityPolicy.isMetricSupported('WED', 'InBodyH20', matrix)).toBe(false);
      expect(EquipmentVisibilityPolicy.isMetricSupported('WED', 'InBodyH30', matrix)).toBe(true);
      expect(EquipmentVisibilityPolicy.isMetricSupported('BMR', 'InBodyH20', matrix)).toBe(true);
    });
  });

  describe('BcaReportMapper — Raw Server DTO to Domain Entity', () => {
    it('maps raw server records in chronological descending order and computes C/I/D type', () => {
      const rawList = [
        {
          UID_DATETIMES: 'u1_20260320100000',
          DATETIMES: '20260320100000',
          EQUIP: 'InBodyH30',
          SEX: 'M',
          AGE: 30,
          HT: 175,
          WT: { VALUE: 70.2, MIN: 59.5, MAX: 80.5, PERCENT: 100 },
          SMM: { VALUE: 34.5, MIN: 28.0, MAX: 34.2, PERCENT: 112 },
          BFM: { VALUE: 12.1, MIN: 8.5, MAX: 17.0, PERCENT: 95 },
          BMR: 1650.4,
          WED: 0.376,
        },
        {
          UID_DATETIMES: 'u1_20260322100000',
          DATETIMES: '20260322100000',
          EQUIP: 'InBodyH30',
          SEX: 'M',
          AGE: 30,
          HT: 175,
          WT: { VALUE: 70.0, MIN: 59.5, MAX: 80.5, PERCENT: 100 },
          SMM: { VALUE: 35.0, MIN: 28.0, MAX: 34.2, PERCENT: 115 },
          BFM: { VALUE: 11.8, MIN: 8.5, MAX: 17.0, PERCENT: 92 },
          BMR: 1649.6,
          WED: 0.374,
        },
      ];

      const domainRecords = BcaReportMapper.toChronologicalDescList(rawList);
      expect(domainRecords).toHaveLength(2);
      // Latest record is first
      expect(domainRecords[0].datetimes).toBe('20260322100000');
      expect(domainRecords[0].cidType).toBe('D');
      expect(domainRecords[0].metrics.WED.level).toBe('normal');

      const withDelta = BcaReportMapper.withPreviousDelta(domainRecords[0], domainRecords[1]);
      expect(withDelta.deltas.WT).toBe('-0.2');
      expect(withDelta.deltas.SMM).toBe('+0.5');
      // 1649.6 -> 1650, 1650.4 -> 1650 => delta is 0
      expect(withDelta.deltas.BMR).toBe('0');
    });
  });
});
