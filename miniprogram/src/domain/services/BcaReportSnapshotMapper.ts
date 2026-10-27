import { formatDatetimes } from './InBodyFormatService';

export interface MetricFieldSnapshot {
  NAME: string;
  VALUE: string | number;
  MIN?: string | number;
  MAX?: string | number;
  UNIT?: string;
  Style: string;
  PSMM?: string;
}

export interface SegmentPartSnapshot {
  NAME: string;
  TYPE: string;
  STYLE: string;
  VALUE: string | number;
  MIN?: string | number;
  MAX?: string | number;
  PI?: string;
  CHANGE: string;
}

export interface SegmentGroupSnapshot {
  NAME: string;
  DATA: SegmentPartSnapshot[];
  Style: string;
}

export interface BcaReportSnapshot {
  EQUIP: string;
  IsManualInput: boolean;
  UID: string;
  UID_DATETIMES: string;
  DATETIMES_TXT: string;
  IsNotNext: boolean;
  IsNotPrev: boolean;
  PreSrc: string;
  NextSrc: string;
  IsViewResultsSheet: boolean;
  FS: MetricFieldSnapshot;
  InBodyAge: MetricFieldSnapshot;
  AGE: string;
  WT: MetricFieldSnapshot;
  SMM: MetricFieldSnapshot;
  BFM: MetricFieldSnapshot;
  PBF: MetricFieldSnapshot;
  WED: MetricFieldSnapshot;
  BMI: MetricFieldSnapshot;
  INLL: MetricFieldSnapshot;
  INLL_LV: MetricFieldSnapshot;
  VFA: MetricFieldSnapshot;
  VFALevel: MetricFieldSnapshot;
  BMR: MetricFieldSnapshot;
  SEG_SLM: SegmentGroupSnapshot;
  SEG_BFM: SegmentGroupSnapshot;
  SEG_ECW_TBW: SegmentGroupSnapshot;
  WHR: MetricFieldSnapshot;
  TBW: MetricFieldSnapshot;
  ICW: MetricFieldSnapshot;
  ECW: MetricFieldSnapshot;
  BCM: MetricFieldSnapshot;
  BSMI: MetricFieldSnapshot;
  WBPA50: MetricFieldSnapshot;
  PROTEIN: MetricFieldSnapshot;
  MINERAL: MetricFieldSnapshot;
  BMC: MetricFieldSnapshot;
  ETYPE2: MetricFieldSnapshot;
  ETYPE3: MetricFieldSnapshot;
  SEX: string;
  [key: string]: unknown;
}

export function isManualInputResult(equip: unknown): boolean {
  const normalized = String(equip ?? '').trim().toUpperCase();
  return normalized === 'NAN' || normalized === 'MANUAL' || normalized === 'MANUALINPUT';
}

function formatAge(value: unknown): string {
  if (value === '' || value == null) return '';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(1) : String(value);
}

function formatFixed(value: unknown, decimals: number): string {
  return Number(value).toFixed(decimals);
}

const SEGMENT_PARTS = [
  { name: '右上肢', slmKey: 'LRA', bfmKey: 'FRA', wedKey: 'WEDRA', slmPi: 'PILRA', bfmPi: 'PFRA' },
  { name: '右下肢', slmKey: 'LRL', bfmKey: 'FRL', wedKey: 'WEDRL', slmPi: 'PILRL', bfmPi: 'PFRL' },
  { name: '左下肢', slmKey: 'LLL', bfmKey: 'FLL', wedKey: 'WEDLL', slmPi: 'PILLL', bfmPi: 'PFLL' },
  { name: '左上肢', slmKey: 'LLA', bfmKey: 'FLA', wedKey: 'WEDLA', slmPi: 'PILLA', bfmPi: 'PFLA' },
  { name: '躯干', slmKey: 'LT', bfmKey: 'FT', wedKey: 'WEDT', slmPi: 'PILT', bfmPi: 'PFT' },
] as const;

export function currentInBodyData(
  isNotNext: boolean,
  isNotPrev: boolean,
  preSrc: string | null | undefined,
  nextSrc: string | null | undefined,
  isViewResultsSheet: boolean,
  data: Array<Record<string, any>>,
  index: number
): BcaReportSnapshot {
  const row = data[index] || {};
  const inll = row.INLL;
  const inllUnit = inll === '' ? '' : 'kg';

  const bmrRaw = row.BMR;
  const bmrValue =
    bmrRaw === '' || bmrRaw == null || Number.isNaN(Number(bmrRaw))
      ? ''
      : String(Math.floor(Number(bmrRaw)));

  const whrValue =
    row.WHR == null || row.WHR === '' ? '' : Number(row.WHR).toFixed(2);

  return {
    EQUIP: row.EQUIP,
    IsManualInput: isManualInputResult(row.EQUIP),
    UID: row.UID,
    UID_DATETIMES: row.UID_DATETIMES,
    DATETIMES_TXT: formatDatetimes(row.DATETIMES),
    IsNotNext: isNotNext,
    IsNotPrev: isNotPrev,
    PreSrc: preSrc ?? '/images/icon_left_black.png',
    NextSrc: nextSrc ?? '/images/btnPaginationNextBlack.png',
    IsViewResultsSheet: isViewResultsSheet,
    FS: {
      NAME: 'InBody 分数',
      VALUE: formatFixed(row.FS, 0),
      Style: '',
    },
    InBodyAge: {
      NAME: 'InBody 年龄',
      VALUE: formatAge(row.InBodyAge),
      Style: '',
    },
    AGE: formatAge(row.AGE),
    WT: {
      NAME: '体重',
      VALUE: formatFixed(row.WT, 1),
      MIN: row.WT_MIN,
      MAX: row.WT_MAX,
      UNIT: 'kg',
      Style: '',
    },
    SMM: {
      NAME: '骨骼肌量',
      VALUE: formatFixed(row.SMM, 1),
      MIN: row.SMM_MIN,
      MAX: row.SMM_MAX,
      UNIT: 'kg',
      Style: '',
      PSMM: formatFixed(row.PSMM, 1),
    },
    BFM: {
      NAME: '体脂肪量',
      VALUE: formatFixed(row.BFM, 1),
      MIN: row.BFM_MIN,
      MAX: row.BFM_MAX,
      UNIT: 'kg',
      Style: '',
    },
    PBF: {
      NAME: '体脂率',
      VALUE: formatFixed(row.PBF, 1),
      MIN: row.PBF_MIN,
      MAX: row.PBF_MAX,
      UNIT: '%',
      Style: '',
    },
    WED: {
      NAME: '细胞外水分比率',
      VALUE: row.WED,
      MIN: 0.3,
      MAX: 0.4,
      UNIT: '',
      Style: '',
    },
    BMI: {
      NAME: 'BMI',
      VALUE: formatFixed(row.BMI, 1),
      MIN: row.BMI_MIN,
      MAX: row.BMI_MAX,
      UNIT: 'kg/m²',
      Style: '',
    },
    INLL: {
      NAME: '下肢肌肉量',
      VALUE: inll,
      UNIT: inllUnit,
      Style: '',
    },
    INLL_LV: {
      NAME: '下肢肌肉量等级',
      VALUE: row.INLL_LV,
      UNIT: 'Lv',
      Style: '',
    },
    VFA: {
      NAME: '内脏脂肪面积',
      VALUE: formatFixed(row.VFA, 1),
      MIN: '',
      MAX: '',
      UNIT: 'cm²',
      Style: '',
    },
    VFALevel: {
      NAME: '内脏脂肪等级',
      VALUE: row.VFL,
      MIN: '',
      MAX: '',
      UNIT: 'Lv',
      Style: '',
    },
    BMR: {
      NAME: '基础代谢率',
      VALUE: bmrValue,
      MIN: '',
      MAX: '',
      UNIT: 'kcal',
      Style: '',
    },
    SEG_SLM: {
      NAME: '阶段分析肌肉',
      DATA: SEGMENT_PARTS.map((p) => ({
        NAME: p.name,
        TYPE: p.slmKey,
        STYLE: 'kg',
        VALUE: row[p.slmKey],
        MIN: row[`${p.slmKey}_MIN`],
        MAX: row[`${p.slmKey}_MAX`],
        PI: formatFixed(row[p.slmPi], 1),
        CHANGE: '+0',
      })),
      Style: '',
    },
    SEG_BFM: {
      NAME: '阶段分析体脂肪',
      DATA: SEGMENT_PARTS.map((p) => ({
        NAME: p.name,
        TYPE: p.bfmKey,
        STYLE: 'kg',
        VALUE: row[p.bfmKey],
        PI: formatFixed(row[p.bfmPi], 1),
        CHANGE: '+0',
      })),
      Style: '',
    },
    SEG_ECW_TBW: {
      NAME: '阶段分析细胞外水分比率',
      DATA: SEGMENT_PARTS.map((p) => ({
        NAME: p.name,
        TYPE: p.wedKey,
        STYLE: '',
        VALUE: row[p.wedKey],
        CHANGE: '+0',
      })),
      Style: '',
    },
    WHR: {
      NAME: '腰臀比',
      VALUE: whrValue,
      MIN: row.WHR_MIN,
      MAX: row.WHR_MAX,
      UNIT: '',
      Style: '',
    },
    TBW: {
      NAME: '体水分',
      VALUE: row.TBW,
      MIN: row.TBW_MIN,
      MAX: row.TBW_MAX,
      UNIT: 'L',
      Style: '',
    },
    ICW: {
      NAME: '细胞内水分',
      VALUE: row.ICW,
      MIN: row.ICW_MIN,
      MAX: row.ICW_MAX,
      UNIT: 'L',
      Style: '',
    },
    ECW: {
      NAME: '细胞外水分',
      VALUE: row.ECW,
      MIN: row.ECW_MIN,
      MAX: row.ECW_MAX,
      UNIT: 'L',
      Style: '',
    },
    BCM: {
      NAME: '身体细胞量',
      VALUE: row.BCM,
      MIN: row.BCM_MIN,
      MAX: row.BCM_MAX,
      UNIT: 'kg',
      Style: '',
    },
    BSMI: {
      NAME: 'SMI骨骼肌指数',
      VALUE: row.BSMI,
      UNIT: 'kg/m²',
      Style: '',
    },
    WBPA50: {
      NAME: '全身相位角',
      VALUE: row.WBPA50,
      UNIT: '°',
      Style: '',
    },
    PROTEIN: {
      NAME: '蛋白质',
      VALUE: row.PROTEIN,
      MIN: row.PROTEIN_MIN,
      MAX: row.PROTEIN_MAX,
      UNIT: 'kg',
      Style: '',
    },
    MINERAL: {
      NAME: '无机盐',
      VALUE: row.MINERAL,
      MIN: row.MINERAL_MIN,
      MAX: row.MINERAL_MAX,
      UNIT: 'kg',
      Style: '',
    },
    BMC: {
      NAME: '骨矿物质含量',
      VALUE: row.BMC,
      MIN: row.BMC_MIN,
      MAX: row.BMC_MAX,
      UNIT: 'kg',
      Style: '',
    },
    ETYPE2: {
      NAME: '身体平衡评估',
      VALUE: row.ETYPE2,
      Style: '',
    },
    ETYPE3: {
      NAME: '节段分析',
      VALUE: row.ETYPE3,
      Style: '',
    },
    SEX: row.SEX,
  };
}

export function formatHistoryValue<T>(key: string, value: T): T | string {
  if (value === '' || value == null) return value;
  if (key === 'FS') {
    const num = Number(value);
    return Number.isNaN(num) ? value : String(Math.round(num));
  }
  if (key === 'BMR') {
    const num = Number(value);
    return Number.isNaN(num) ? value : String(Math.floor(num));
  }
  return value;
}

module.exports = {
  currentInBodyData,
  formatHistoryValue,
  isManualInputResult,
};
