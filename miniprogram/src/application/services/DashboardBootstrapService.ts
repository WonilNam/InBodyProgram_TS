import { WxHttpClient } from "../../infrastructure/adapters/WxHttpClient";
import { INBODY_ENDPOINTS, historyRequest } from "../../infrastructure/api/InBodyApi";
import * as dashboardHistory from './DashboardHistoryService';

export interface SplitMetricNumber {
  value: string;
  whole: string;
  decimal: string;
}

export interface NormalizedDashboardSummary {
  WT: string;
  WTT: string;
  WTP: string;
  SMM: string;
  SMMT: string;
  SMMP: string;
  PBF: string;
  PBFT: string;
  PBFP: string;
  SPHYG1: string | number;
  SPHYG2: string | number;
  SPHYG3: string | number;
  NoData: '' | 'NoData';
  NoDataBP: '' | 'NoData';
}

interface CachedSummaryEntry {
  key: string;
  value: NormalizedDashboardSummary;
  at: number;
}

const FRESH_MS = 10_000;
let cachedSummary: CachedSummaryEntry | undefined;
let generation = 0;
const pendingSummary = new Map<string, Promise<NormalizedDashboardSummary>>();

function buildKey(server: string, uid: string | number): string {
  return JSON.stringify([server, String(uid)]);
}

function splitValue(value: unknown): SplitMetricNumber {
  if (value === '-' || value == null || value === '') {
    return { value: '-', whole: '-', decimal: '-' };
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return { value: '-', whole: '-', decimal: '-' };
  }
  const fixed = numeric.toFixed(1);
  const [whole, decimal] = fixed.split('.');
  return { value: fixed, whole, decimal };
}

export function normalize(data: Record<string, any> = {}): NormalizedDashboardSummary {
  const wt = splitValue(data.WT);
  const smm = splitValue(data.SMM);
  const pbf = splitValue(data.PBF);
  const sphyg1 = data.SPHYG1 == null ? '-' : data.SPHYG1;
  const sphyg2 = data.SPHYG2 == null ? '-' : data.SPHYG2;
  const sphyg3 = Number(data.SPHYG3) > 0 ? data.SPHYG3 : '-';

  return {
    WT: wt.value,
    WTT: wt.whole,
    WTP: wt.decimal,
    SMM: smm.value,
    SMMT: smm.whole,
    SMMP: smm.decimal,
    PBF: pbf.value,
    PBFT: pbf.whole,
    PBFP: pbf.decimal,
    SPHYG1: sphyg1,
    SPHYG2: sphyg2,
    SPHYG3: sphyg3,
    NoData: wt.value === '-' && smm.value === '-' && pbf.value === '-' ? 'NoData' : '',
    NoDataBP: sphyg1 === '-' && sphyg2 === '-' ? 'NoData' : '',
  };
}

export function invalidate(): void {
  generation++;
  cachedSummary = undefined;
  pendingSummary.clear();
  dashboardHistory.invalidate();
}

export function peekSummary(
  server: string,
  uid: string | number
): NormalizedDashboardSummary | undefined {
  const cacheKey = buildKey(server, uid);
  return cachedSummary &&
    cachedSummary.key === cacheKey &&
    Date.now() - cachedSummary.at < FRESH_MS
    ? cachedSummary.value
    : undefined;
}

export function refreshSummary(
  server: string,
  uid: string | number
): Promise<NormalizedDashboardSummary> {
  const cacheKey = buildKey(server, uid);
  if (
    cachedSummary &&
    cachedSummary.key === cacheKey &&
    Date.now() - cachedSummary.at < FRESH_MS
  ) {
    return Promise.resolve(cachedSummary.value);
  }
  const existing = pendingSummary.get(cacheKey);
  if (existing) return existing;

  const startedGeneration = generation;
  const request = new WxHttpClient(server).postEnvelope<Record<string, unknown>>(
    INBODY_ENDPOINTS.dashboard, { UID: uid }).then(data => normalize(data || {}))
    .then((value) => {
      if (startedGeneration !== generation) {
        throw new Error('Summary invalidated');
      }
      cachedSummary = { key: cacheKey, value, at: Date.now() };
      return value;
    })
    .finally(() => {
      if (pendingSummary.get(cacheKey) === request) {
        pendingSummary.delete(cacheKey);
      }
    });

  pendingSummary.set(cacheKey, request);
  return request;
}

export function preload(
  server: string,
  uid: string | number | null | undefined
): Promise<PromiseSettledResult<unknown>[]> {
  if (!server || uid == null || uid === '') return Promise.resolve([]);
  const startedGeneration = generation;
  return Promise.allSettled([
    refreshSummary(server, uid),
    dashboardHistory.refresh(server, uid),
  ]).then((results) => {
    if (startedGeneration !== generation) return results;
    if (typeof getApp === 'function' && String(getApp()?.globalData?.UID) !== String(uid)) return results;
    const historyResult = results[1];
    if (historyResult && historyResult.status === 'fulfilled') {
      if (typeof wx !== 'undefined' && typeof wx.setStorageSync === 'function') {
        wx.setStorageSync('InBodyData', historyResult.value);
        wx.setStorageSync('InBodyDataUID', String(uid));
      }
      if (typeof getApp === 'function') {
        const app = getApp<any>();
        if (app && app.globalData && String(app.globalData.UID) === String(uid)) {
          app.globalData.InBodyData = historyResult.value;
        }
      }
    }
    return results;
  });
}

module.exports = {
  normalize,
  peekSummary,
  refreshSummary,
  preload,
  invalidate,
};
