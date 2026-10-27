import { BcaReportSnapshot, currentInBodyData } from '../../domain/services/BcaReportSnapshotMapper';
import { applyEquipmentVisibility } from '../../infrastructure/renderers/ReportSharePoster2D';

export interface DashboardSharePayload {
  detail: BcaReportSnapshot;
  changes: Record<string, string>;
  measuredAt: string;
  history: Array<Record<string, any>>;
  nickname: string;
}

const SHARE_DELTA_FIELDS: Readonly<Record<string, string>> = {
  SCORE: 'FS',
  InBodyAge: 'InBodyAge',
  WT: 'WT',
  SMM: 'SMM',
  BFM: 'BFM',
  BMI: 'BMI',
  PBF: 'PBF',
  INLL: 'INLL',
  INLL_LV: 'INLL_LV',
  WHR: 'WHR',
  VFA: 'VFA',
  VFALevel: 'VFL',
  TBW: 'TBW',
  ICW: 'ICW',
  ECW: 'ECW',
  WED: 'WED',
  BMR: 'BMR',
  PROTEIN: 'PROTEIN',
  MINERAL: 'MINERAL',
  BMC: 'BMC',
  BCM: 'BCM',
  BSMI: 'BSMI',
  WBPA50: 'WBPA50',
  LRA: 'LRA',
  LRL: 'LRL',
  LLL: 'LLL',
  LLA: 'LLA',
  LT: 'LT',
  FRA: 'FRA',
  FRL: 'FRL',
  FLL: 'FLL',
  FLA: 'FLA',
  FT: 'FT',
  WEDRA: 'WEDRA',
  WEDRL: 'WEDRL',
  WEDLL: 'WEDLL',
  WEDLA: 'WEDLA',
  WEDT: 'WEDT',
};

export function buildDashboardSharePayload(
  records: unknown,
  selectedIndex: number | string,
  historyDefaultSet?: Record<string, any> | null
): DashboardSharePayload | null {
  const history = Array.isArray(records) ? (records as Array<Record<string, any>>) : [];
  if (!history.length) return null;

  const parsedIndex = Number(selectedIndex);
  const index = Math.max(
    0,
    Math.min(Number.isFinite(parsedIndex) ? parsedIndex : 0, history.length - 1)
  );
  const selected = history[index] || {};
  const previous = history[index + 1];
  const previousScored = history.slice(index + 1).find((record) => Number(record.FS) > 0);
  const nickname =
    [selected.CustomerName, selected.UserNickName, selected.NickName]
      .map((value) => String(value || '').trim())
      .find((value) => value && !/^(微信用户|InBody用户|InBody 用户)$/.test(value)) || '';

  const detail = currentInBodyData(false, false, null, null, false, history, index);
  applyEquipmentVisibility(detail, historyDefaultSet || {});

  const changes: Record<string, string> = {};
  if (previous) {
    for (const key of Object.keys(SHARE_DELTA_FIELDS)) {
      if (key === 'SCORE' && !detail.FS) continue;
      const sourceField = SHARE_DELTA_FIELDS[key];
      let currentValue = Number(key === 'SCORE' ? detail.FS.VALUE : selected[sourceField]);
      let previousValue = Number(
        (key === 'SCORE' ? previousScored : previous)?.[sourceField]
      );
      if (key === 'BMI' || key === 'WHR') {
        const precision = key === 'BMI' ? 1 : 2;
        currentValue = Number(currentValue.toFixed(precision));
        previousValue = Number(previousValue.toFixed(precision));
      }
      if (key === 'BMR') {
        currentValue = Math.floor(currentValue);
        previousValue = Math.floor(previousValue);
      }
      const decimals =
        key === 'SCORE' || key === 'BMR'
          ? 0
          : key === 'InBodyAge' || key === 'BMI'
          ? 1
          : key === 'WED' || key.startsWith('WED')
          ? 3
          : 2;
      if (key === 'SCORE' && !(currentValue > 0 && previousValue > 0)) continue;
      if (Number.isFinite(currentValue) && Number.isFinite(previousValue)) {
        changes[key] = (currentValue - previousValue).toFixed(decimals);
      }
    }
  }
  if (detail.FS && Number(detail.FS.VALUE) > 0 && !previousScored) {
    changes.SCORE = '0';
  }

  return {
    detail,
    changes,
    measuredAt: String(selected.DATETIMES || ''),
    history,
    nickname,
  };
}

module.exports = {
  buildDashboardSharePayload,
};
