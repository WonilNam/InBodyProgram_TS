import { WxHttpClient } from "../../infrastructure/adapters/WxHttpClient";
import { INBODY_ENDPOINTS, historyRequest } from "../../infrastructure/api/InBodyApi";
export interface CachedHistoryEntry {
  key: string;
  records: Array<Record<string, any>>;
  at: number;
}

export const DASHBOARD_HISTORY_LIMIT = 999999;
const FRESH_MS = 10_000;

let cached: CachedHistoryEntry | undefined;
let generation = 0;
const pending = new Map<string, Promise<Array<Record<string, any>>>>();

function buildKey(server: string, uid: string | number): string {
  return JSON.stringify([server, String(uid)]);
}

export function invalidate(): void {
  generation++;
  cached = undefined;
  pending.clear();
}

export function peek(server: string, uid: string | number): Array<Record<string, any>> | undefined {
  return cached && cached.key === buildKey(server, uid) ? cached.records : undefined;
}

export function refresh(
  server: string,
  uid: string | number,
  force = false
): Promise<Array<Record<string, any>>> {
  const requestKey = buildKey(server, uid);
  if (!force && cached && cached.key === requestKey && Date.now() - cached.at < FRESH_MS) {
    return Promise.resolve(cached.records);
  }
  const existing = pending.get(requestKey);
  if (existing) return existing;

  const startedGeneration = generation;
  const request = new WxHttpClient(server).postEnvelope<Array<Record<string, any>>>(
    INBODY_ENDPOINTS.history, historyRequest(String(uid)))
    .then((records) => {
      if (!Array.isArray(records)) throw new Error('Invalid history response');
      if (startedGeneration !== generation) {
        throw new Error('History invalidated');
      }
      cached = { key: requestKey, records, at: Date.now() };
      return records;
    })
    .finally(() => {
      if (pending.get(requestKey) === request) {
        pending.delete(requestKey);
      }
    });

  pending.set(requestKey, request);
  return request;
}

module.exports = {
  DASHBOARD_HISTORY_LIMIT,
  peek,
  refresh,
  invalidate,
};
