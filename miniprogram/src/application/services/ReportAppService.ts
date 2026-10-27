import { INBODY_ENDPOINTS, historyRequest, inBodyApiUrl } from "../../infrastructure/api/InBodyApi";
import { BCARecord } from '../../domain/entities/BCARecord.entity';
import { HistoryFilterCriteria } from '../../domain/entities/UserProfile.entity';
import { IHttpClient } from '../../domain/ports/IHttpClient';
import { IStorageRepository } from '../../domain/ports/IStorageRepository';
import { DateParser } from '../../domain/services/DateParser';
import { EquipmentMetricMatrix } from '../../domain/services/EquipmentVisibilityPolicy';
import { MetricCode } from '../../domain/value-objects/MetricSpec.vo';
import { BcaReportMapper } from '../../infrastructure/mappers/BcaReportMapper';
import { AuthStore } from '../stores/AuthStore';
import { ReportStore } from '../stores/ReportStore';
import * as DashboardBootstrapService from './DashboardBootstrapService';

interface HistoryItemMapping {
  readonly key: MetricCode;
  readonly serverKey: string;
}

interface LegacyMatrixItemMapping {
  readonly key: string;
  readonly serverKey: string;
}

const SERVER_METRIC_MATRIX_MAP: readonly HistoryItemMapping[] = [
  { key: 'WT', serverKey: 'WT' },
  { key: 'SMM', serverKey: 'SMM' },
  { key: 'BFM', serverKey: 'BFM' },
  { key: 'PBF', serverKey: 'PBF' },
  { key: 'WED', serverKey: 'ECW_TBW' },
  { key: 'INLL', serverKey: 'LLM' },
  { key: 'BMI', serverKey: 'BMI' },
  { key: 'VFA', serverKey: 'VFA' },
  { key: 'VFALevel', serverKey: 'VFL' },
  { key: 'BMR', serverKey: 'BMR' },
  { key: 'WHR', serverKey: 'WHR' },
  { key: 'TBW', serverKey: 'TBW' },
  { key: 'ICW', serverKey: 'ICW' },
  { key: 'ECW', serverKey: 'ECW' },
  { key: 'PROTEIN', serverKey: 'PROTEIN' },
  { key: 'MINERAL', serverKey: 'MINERAL' },
  { key: 'BMC', serverKey: 'BMC' },
  { key: 'BCM', serverKey: 'BCM' },
  { key: 'BSMI', serverKey: 'SMI' },
  { key: 'WBPA50', serverKey: 'WBPA' },
  { key: 'FS', serverKey: 'FS' },
  { key: 'InBodyAge', serverKey: 'InBodyAge' },
];

const FULL_HISTORY_DEFAULT_SET_MAP: readonly LegacyMatrixItemMapping[] = [
  ...SERVER_METRIC_MATRIX_MAP,
  { key: 'SEG_SLM', serverKey: 'SEG_SLM' },
  { key: 'SEG_BFM', serverKey: 'SEG_BFM' },
  { key: 'SEG_ECW_TBW', serverKey: 'SEG_ECW_TBW' },
  { key: 'ETYPE2', serverKey: 'BBE' },
];

export interface BodyTypeExplainDto {
  readonly Type?: 'C' | 'I' | 'D' | 'P' | string;
  readonly Title?: string;
  readonly Explain?: string;
  cidImage?: string;
  readonly [key: string]: unknown;
}

export interface ItemExplainDto {
  readonly Explain?: string;
  readonly [key: string]: unknown;
}

export interface CustomerExpireDto {
  readonly IsExpire?: boolean;
  readonly [key: string]: unknown;
}

export interface BloodPressureRecordDto {
  readonly DATETIMES: string | number;
  readonly SPHYG1: string | number;
  readonly SPHYG2: string | number;
  readonly SPHYG3: string | number;
  readonly [key: string]: unknown;
}

export class ReportAppService {
  private inflightRequest: { uid: string; promise: Promise<BCARecord[]> } | null = null;
  private generationCounter = 0;

  constructor(
    private readonly http: IHttpClient,
    private readonly storage: IStorageRepository,
    private readonly authStore: AuthStore,
    private readonly reportStore: ReportStore
  ) {}

  /**
   * 同步各设备型号的指标支持矩阵 (POST /inbody/BindInBodyItemDefaultSetWeChat)
   */
  async syncEquipmentMetricMatrix(): Promise<EquipmentMetricMatrix> {
    try {
      const rawData = await this.http.postEnvelope<Array<Record<string, string>>>(
        INBODY_ENDPOINTS.metricMatrix,
        { SyncDatetime: '1990-01-01' }
      );
      const matrix: Partial<Record<MetricCode, string[]>> = {};
      const legacyHistoryDefaultSet: Record<string, string[]> = {};

      for (const mapping of SERVER_METRIC_MATRIX_MAP) {
        matrix[mapping.key] = [];
      }
      for (const mapping of FULL_HISTORY_DEFAULT_SET_MAP) {
        legacyHistoryDefaultSet[mapping.key] = [];
      }

      if (Array.isArray(rawData)) {
        for (const row of rawData) {
          const equip = row.Equip;
          if (!equip) continue;
          for (const mapping of SERVER_METRIC_MATRIX_MAP) {
            if (row[mapping.serverKey] === '1' || mapping.key === 'BMR') {
              matrix[mapping.key]!.push(equip);
            }
          }
          for (const mapping of FULL_HISTORY_DEFAULT_SET_MAP) {
            if (row[mapping.serverKey] === '1' || mapping.key === 'BMR') {
              legacyHistoryDefaultSet[mapping.key].push(equip);
            }
          }
        }
      }

      this.storage.set('report:equipMatrix', matrix);
      this.storage.set('report:visibilityMatrix', legacyHistoryDefaultSet);
      this.syncLegacyHistoryDefaultSet(legacyHistoryDefaultSet);
      return matrix;
    } catch {
      return this.storage.get('report:equipMatrix') ?? {};
    }
  }

  /**
   * 刷新当前登录用户的体成分历史记录（真实接口：POST /inbody/GetInBodyDataWeChat）
   * 自带按 UID 的并发去重与竞态隔离，并同步 InBodyData / InBodyDataUID 存储与全局数据
   */
  async refreshHistory(forceBypassCache = false): Promise<BCARecord[]> {
    const uid = this.resolveCurrentUid();
    if (!uid) {
      this.reportStore.resetForGuestOrEmpty();
      return [];
    }

    if (!forceBypassCache && this.inflightRequest && this.inflightRequest.uid === uid) {
      return this.inflightRequest.promise;
    }

    if (!forceBypassCache) {
      const cached = this.storage.get('report:history');
      if (this.storage.get('report:historyOwner') === uid &&
          cached && cached.length > 0 && this.reportStore.getState().records.length === 0) {
        this.reportStore.setRecords(cached);
      }
    }

    const currentGen = ++this.generationCounter;
    const sessionVersion = this.authStore.getSessionVersion();
    this.reportStore.setLoading(true);

    const requestPromise = (async () => {
      const matrix = this.storage.get('report:equipMatrix') ?? {};
      const rawResponse = await this.http.postEnvelope<unknown>(
        INBODY_ENDPOINTS.history,
        historyRequest(uid)
      );

      const rawList = Array.isArray(rawResponse) ? rawResponse : [];
      const domainList = BcaReportMapper.toChronologicalDescList(rawList, matrix);

      // 校验返回时用户未发生切换且未被新测量作废
      const latestUid = this.resolveCurrentUid();
      if (latestUid === uid && currentGen === this.generationCounter &&
          sessionVersion === this.authStore.getSessionVersion()) {
        this.storage.set('report:history', domainList);
        this.storage.set('report:historyOwner', uid);
        this.reportStore.setRecords(domainList);
        this.syncLegacyHistoryRecords(uid, domainList.map(record => record.raw));
      }
      return domainList;
    })();

    this.inflightRequest = { uid, promise: requestPromise };

    try {
      return await requestPromise;
    } catch (err) {
      if (currentGen === this.generationCounter &&
          sessionVersion === this.authStore.getSessionVersion()) {
        this.reportStore.setLoading(false);
      }
      throw err;
    } finally {
      if (this.inflightRequest?.promise === requestPromise) {
        this.inflightRequest = null;
      }
    }
  }

  async getHistoryRows(force = false): Promise<Array<Record<string, unknown>>> {
    return (await this.refreshHistory(force)).map(record => ({ ...record.raw }));
  }

  getResultsSheetUrl(uidDatetimes: string): string {
    return inBodyApiUrl(`${INBODY_ENDPOINTS.resultsSheet}?UID_DATETIMES=${encodeURIComponent(uidDatetimes)}&CountryCode=86&Language=CN&Unit=1`);
  }

  async isResultsSheetAvailable(uidDatetimes: string): Promise<boolean> {
    if (!uidDatetimes) return false;
    try {
      const body = await this.http.request<ArrayBuffer>({ url: this.getResultsSheetUrl(uidDatetimes),
        method: 'GET', responseType: 'arraybuffer' });
      if (!(body instanceof ArrayBuffer) || body.byteLength < 4) return false;
      const bytes = new Uint8Array(body);
      return (bytes[0] === 0xff && bytes[1] === 0xd8) ||
        (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) ||
        (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46);
    } catch { return false; }
  }

  checkQrData(data: string, hp: string, uid: string): Promise<unknown> {
    return this.http.request({ url: INBODY_ENDPOINTS.qrCheck, method: 'POST',
      data: { Data: data, HP: hp, UID: uid, CountryCode: '86' } });
  }

  async saveBloodPressureQr(data: string, uid: string): Promise<void> {
    await this.http.postEnvelope(INBODY_ENDPOINTS.bpQrSave,
      { Data: data, UID: uid, CountryCode: '86' });
    DashboardBootstrapService.invalidate();
  }

  async saveQrData(data: string, hp: string, uid: string): Promise<{ DatetimesT?: string }> {
    const result = await this.http.postEnvelope<{ DatetimesT?: string }>(INBODY_ENDPOINTS.qrSave,
      { Data: data, HP: hp, UID: uid, CountryCode: '86' });
    try {
      await this.invalidateAndRefresh();
    } catch {
      // The save succeeded. Let the page retry reading without resubmitting the QR record.
    }
    return result;
  }

  /**
   * 新测量完成或删除数据后使旧请求失效并强制刷新
   */
  async invalidateAndRefresh(): Promise<BCARecord[]> {
    this.generationCounter++;
    this.inflightRequest = null;
    DashboardBootstrapService.invalidate();
    return this.refreshHistory(true);
  }

  resetSession(): void {
    this.generationCounter++;
    this.inflightRequest = null;
    this.storage.remove('report:history');
    this.storage.remove('report:historyOwner');
    this.storage.remove('filter:bca');
    this.reportStore.resetForGuestOrEmpty();
    DashboardBootstrapService.invalidate();
  }

  /**
   * 删除单条体成分测试记录并刷新历史数据 (POST /inbody/DeleteInBodyData)
   */
  async deleteRecord(uid: string, datetimes: string): Promise<BCARecord[]> {
    const deleteItems = [{ UID: uid, DATETIMES: datetimes }];
    await this.http.postEnvelope(INBODY_ENDPOINTS.deleteRecord, {
      data: JSON.stringify(deleteItems),
    });
    return this.invalidateAndRefresh();
  }

  /**
   * 获取首页看板最新摘要 (POST /main/GetDashboard_WeChat)
   */
  async getDashboardSummary(
    uid: string
  ): Promise<DashboardBootstrapService.NormalizedDashboardSummary> {
    const data = await this.http.postEnvelope<Record<string, unknown>>(
      INBODY_ENDPOINTS.dashboard,
      { UID: uid }
    );
    return DashboardBootstrapService.normalize(data ?? {});
  }

  /**
   * 获取 C/I/D 体型分析详情并写入 CID_CACHE (POST /inbody_v3/GetInBodyBodyType)
   */
  async getBodyTypeExplain(uidDatetimes: string): Promise<BodyTypeExplainDto | null> {
    if (!uidDatetimes) return null;
    try {
      if (typeof wx !== 'undefined' && typeof wx.getStorageSync === 'function') {
        const cidCache = (wx.getStorageSync('CID_CACHE') || {}) as Record<
          string,
          BodyTypeExplainDto
        >;
        if (cidCache[uidDatetimes]?.Title) {
          return cidCache[uidDatetimes];
        }
      }
    } catch {
      // Ignore cache read error
    }

    const data = await this.http.postEnvelope<BodyTypeExplainDto>(
      INBODY_ENDPOINTS.bodyType,
      {
        UID_DATETIMES: uidDatetimes,
        Language: 'CN',
        CountryCode: '86',
      }
    );
    if (!data) return null;

    let cidImage = '';
    switch (data.Type) {
      case 'C':
        cidImage = '/images/ic_cidp_c.png';
        break;
      case 'I':
        cidImage = '/images/ic_cidp_i.png';
        break;
      case 'D':
        cidImage = '/images/ic_cidp_d.png';
        break;
      case 'P':
        cidImage = '/images/ic_cidp_p.png';
        break;
    }

    const enriched: BodyTypeExplainDto = {
      ...data,
      cidImage,
    };

    try {
      if (typeof wx !== 'undefined' && typeof wx.setStorageSync === 'function') {
        const cache = (wx.getStorageSync('CID_CACHE') || {}) as Record<
          string,
          BodyTypeExplainDto
        >;
        cache[uidDatetimes] = enriched;
        wx.setStorageSync('CID_CACHE', cache);
      }
    } catch {
      // Ignore cache write error
    }

    return enriched;
  }

  /**
   * 获取单项体成分指标说明文案 (POST /inbody_v3/GetInBodyItemExPlain)
   */
  async getItemExplain(code: string, language = 'zh'): Promise<string> {
    const data = await this.http.postEnvelope<ItemExplainDto>(
      INBODY_ENDPOINTS.itemExplain,
      {
        Code: code,
        Language: language,
      }
    );
    return String(data?.Explain ?? '');
  }

  /**
   * 查询机构客户 LB WEB 到期状态 (POST /main_v3/GetCustomerExpire)
   */
  async getCustomerExpire(
    customerId: string,
    localDate: string
  ): Promise<CustomerExpireDto> {
    return this.http.postEnvelope<CustomerExpireDto>(INBODY_ENDPOINTS.customerExpire, {
      CustomerID: customerId,
      LocalDate: localDate,
    });
  }

  /**
   * 获取血压历史记录列表 (POST /basalmedical/GetBloodPressureData)
   */
  async getBloodPressureHistory(uid: string): Promise<BloodPressureRecordDto[]> {
    const list = await this.http.postEnvelope<BloodPressureRecordDto[]>(
      INBODY_ENDPOINTS.bloodPressure,
      {
        UID: uid,
        SyncDatetime: '1990-01-01',
        NumberPerData: '999999',
        CurrentIndex: '0',
      }
    );
    return Array.isArray(list) ? list : [];
  }

  /**
   * 根据期间与设备筛选条件过滤历史记录
   */
  getFilteredRecords(criteria?: HistoryFilterCriteria): BCARecord[] {
    const state = this.reportStore.getState();
    const records = state.records;
    if (!records.length) return [];

    const activeFilter = criteria ?? state.filter;
    const latest14 = records[0]?.datetimes ?? '';

    let stBoundary = DateParser.toBoundary14Digits(
      activeFilter.startDate.date,
      false,
      latest14
    );
    let edBoundary = DateParser.toBoundary14Digits(
      activeFilter.endDate.date,
      true,
      latest14
    );
    if (stBoundary > edBoundary) {
      const tmp = stBoundary;
      stBoundary = edBoundary;
      edBoundary = tmp;
    }

    const equipSet = new Set(activeFilter.selectedEquips);

    return records.filter((rec) => {
      const dt14 = DateParser.normalizeTo14Digits(rec.datetimes, false);
      const dateMatch = stBoundary <= dt14 && dt14 <= edBoundary;
      const equipMatch = equipSet.size === 0 || equipSet.has(rec.equip);
      return dateMatch && equipMatch;
    });
  }

  private resolveCurrentUid(): string {
    const profileUid = this.authStore.getState().profile?.uid;
    if (profileUid) return String(profileUid);
    try {
      if (typeof getApp === 'function') {
        const appUid = getApp<{ globalData?: { UID?: string | number | null } }>()
          ?.globalData?.UID;
        if (appUid) return String(appUid);
      }
      if (typeof wx !== 'undefined' && typeof wx.getStorageSync === 'function') {
        const storedUid = wx.getStorageSync('InBodyUID');
        if (storedUid) return String(storedUid);
      }
    } catch {
      // Ignore in test runner
    }
    return '';
  }

  private syncLegacyHistoryDefaultSet(
    historyDefaultSet: Record<string, string[]>
  ): void {
    try {
      if (typeof wx !== 'undefined' && typeof wx.setStorageSync === 'function') {
        wx.setStorageSync('historyDefaultSet', historyDefaultSet);
      }
      if (typeof getApp === 'function') {
        const app = getApp<{ globalData?: Record<string, unknown> }>();
        if (app?.globalData) {
          app.globalData.historyDefaultSet = historyDefaultSet;
        }
      }
    } catch {
      // Ignore
    }
  }

  private syncLegacyHistoryRecords(uid: string, rawList: unknown[]): void {
    try {
      if (typeof wx !== 'undefined' && typeof wx.setStorageSync === 'function') {
        wx.setStorageSync('InBodyData', rawList);
        wx.setStorageSync('InBodyDataUID', uid);
      }
      if (typeof getApp === 'function') {
        const app = getApp<{ globalData?: Record<string, unknown> }>();
        if (app?.globalData && String(app.globalData.UID || uid) === uid) {
          app.globalData.InBodyData = rawList;
        }
      }
    } catch {
      // Ignore
    }
  }
}

