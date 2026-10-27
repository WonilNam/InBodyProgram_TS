import { buildDashboardSharePayload } from '../../application/services/DashboardShareService';
import { SegmentPartSnapshot, MetricFieldSnapshot } from '../../domain/services/BcaReportSnapshotMapper';
import { formatDatetimes, formatYMD } from '../../domain/services/InBodyFormatService';

export type SegmentType = 'smm' | 'bfm' | 'wed';
const GROUP = { smm: 'SEG_SLM', bfm: 'SEG_BFM', wed: 'SEG_ECW_TBW' } as const;
export function supportsResultsSheet(equip: unknown): boolean {
  const key = String(equip ?? '').toUpperCase();
  return !['NAN','MANUAL','MANUALINPUT','H20B','H30','H40','INBODYH30','INBODYH40'].includes(key) && !key.includes('WATCH');
}
export function orderedSegments(rows: SegmentPartSnapshot[], changes: Record<string, string>): SegmentPartSnapshot[] {
  const order = ['LT','LLA','LRA','LLL','LRL','FT','FLA','FRA','FLL','FRL','WEDT','WEDLA','WEDRA','WEDLL','WEDRL'];
  return rows.slice().sort((a,b) => order.indexOf(a.TYPE) - order.indexOf(b.TYPE)).map(row => {
    const value = Number(row.VALUE);
    const lean = /^(LT|LLA|LRA|LLL|LRL)$/.test(row.TYPE);
    const fat = /^(FT|FLA|FRA|FLL|FRL)$/.test(row.TYPE);
    const decimals = value === 0 ? 2 : Math.max(0, 2 - Math.floor(Math.log10(Math.abs(value))));
    const scale = Math.pow(10, decimals);
    return { ...row, VALUE: Number.isFinite(value) ? lean ? (Math.round((value + Number.EPSILON) * scale) / scale).toFixed(decimals) : fat ?
      (Math.floor(value * 10 + 1e-9) / 10).toFixed(1) : row.VALUE : row.VALUE,
      CHANGE: changes[row.TYPE] ?? '0' };
  });
}
export function buildReportView(rows: Array<Record<string, unknown>>, index = 0, segmentType: SegmentType = 'smm', matrix: Record<string, unknown> = {}) {
  if (!rows.length) return null;
  const safe = Math.max(0, Math.min(index, rows.length - 1));
  const payload = buildDashboardSharePayload(rows, safe, matrix)!;
  const detail = payload.detail;
  detail.IsNotNext = safe === 0;
  detail.IsNotPrev = safe === rows.length - 1;
  detail.IsViewResultsSheet = !supportsResultsSheet(detail.EQUIP);
  detail.PreSrc = `/images/icon_left_${detail.IsNotPrev ? 'gray' : 'black'}.png`;
  detail.NextSrc = `/images/btnPaginationNext${detail.IsNotNext ? 'Gray' : 'Black'}.png`;
  // Missing values are hidden before the page renders or a canvas receives NaN.
  for (const field of Object.values(detail)) {
    if (field && typeof field === 'object' && 'VALUE' in field) {
      const metric = field as MetricFieldSnapshot;
      if (metric.VALUE === '' || !Number.isFinite(Number(metric.VALUE)) || Number(metric.VALUE) <= 0) metric.Style = 'display:none;';
    }
  }
  for (const key of Object.values(GROUP)) {
    if (!detail[key].DATA.some(row => Number(row.VALUE) > 0)) detail[key].Style = 'display:none;';
  }
  const active = detail[GROUP[segmentType]].Style.includes('none')
    ? (Object.keys(GROUP) as SegmentType[]).find(type => !detail[GROUP[type]].Style.includes('none')) ?? segmentType
    : segmentType;
  const balance = String(detail.ETYPE2.VALUE ?? '');
  const changes = Object.fromEntries(Object.entries(payload.changes).map(([key,value]) =>
    [key, Number.isFinite(Number(value)) ? String(Number(value)) : '0']));
  changes.SMI = changes.BSMI ?? '0';
  return {
    Index: safe, RawData: rows, InBodyData: detail, IsExistsData: true, isLoading: false,
    ChangeRange: changes, segmentType: active,
    AnalysisData: orderedSegments(detail[GROUP[active]].DATA, payload.changes),
    BodyBalance: { ARM: balance.slice(9,10), LEG: balance.slice(10,11), BODY: balance.slice(11,12) },
    DataFilter: rows.map((row, idx) => ({ Index: idx, Datetimes: row.DATETIMES,
      DatetimesText: formatDatetimes(row.DATETIMES), Equip: row.EQUIP, EquipText: `InBody ${row.EQUIP}`,
      WT: row.WT, PBF: row.PBF, CustomerName: row.CustomerName, checked: safe === idx })),
    share: payload,
  };
}
export type ReportView = NonNullable<ReturnType<typeof buildReportView>>;

export function reportManagementRows(rows: readonly Record<string, unknown>[]) {
  return rows.filter(row => !row.IsDeleted).map((row, Index) => ({
    Index, DatetimesText: formatYMD(row.DATETIMES), Datetimes: row.DATETIMES,
    EquipText: `InBody ${row.EQUIP}`, Equip: row.EQUIP,
    WT: Number.isFinite(Number(row.WT)) ? Number(row.WT).toFixed(1) : '',
    PBF: row.PBF, CompanyName: row.CompanyName,
  }));
}
