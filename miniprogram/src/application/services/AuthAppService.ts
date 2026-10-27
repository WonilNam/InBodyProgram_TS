import { INBODY_ENDPOINTS } from "../../infrastructure/api/InBodyApi";
import { UserProfile } from '../../domain/entities/UserProfile.entity';
import { IHttpClient } from '../../domain/ports/IHttpClient';
import { IStorageRepository } from '../../domain/ports/IStorageRepository';
import { AuthStore } from '../stores/AuthStore';
import * as DashboardBootstrapService from './DashboardBootstrapService';
import { ReportAppService } from './ReportAppService';

export interface LoginServerDto {
  readonly UID?: string | number;
  readonly Name?: string;
  readonly Gender?: 'M' | 'F' | '';
  readonly Age?: number | string;
  readonly Height?: number | string;
  readonly BPCount?: number;
}

export interface WeChatTelHPDto {
  readonly PhoneNumber?: string;
  readonly Session?: string;
}

export interface MemberServerDto {
  readonly UID?: string | number;
  readonly Name?: string;
  readonly NICKNAME?: string;
  readonly Gender?: 'M' | 'F' | '';
  readonly SEX?: 'M' | 'F' | '';
  readonly Age?: number | string;
  readonly AGE?: number | string;
  readonly Height?: number | string;
  readonly HT?: number | string;
  readonly TelHP?: string;
  readonly UserPIcon?: string;
  readonly BirthDay?: string;
}

export class AuthAppService {
  private loginGeneration = 0;
  /** 统一首页路由：无论是首次登录还是老用户登录，一律直接进入首页，绝不强跳设备设置页 */
  static readonly HOME_ROUTE = '/pages/HealthReportMain/HealthReportMain';

  constructor(
    private readonly http: IHttpClient,
    private readonly storage: IStorageRepository,
    private readonly authStore: AuthStore,
    private readonly reportService: ReportAppService
  ) {}

  /**
   * 小程序冷启动恢复会话并预加载首页报告数据
   */
  async bootstrapSession(): Promise<{ targetRoute: string; isGuest: boolean }> {
    const savedProfile = this.resolvePersistedProfile();
    const savedBoundEquip = this.storage.get('equip:bound');

    if (!savedProfile || !savedProfile.uid || !savedProfile.telHP) {
      // Retain a legacy phone-only hint for the launch page's wx-code login,
      // but never fetch reports using a stray UID while entering guest mode.
      this.authStore.enterGuestMode();
      this.reportService.resetSession();
      this.clearLegacyReportStorage();
      try {
        if (typeof wx !== 'undefined' && typeof wx.removeStorageSync === 'function') {
          wx.removeStorageSync('InBodyUID');
        }
        if (typeof getApp === 'function') {
          const app = getApp<{ globalData?: Record<string, unknown> }>();
          if (app?.globalData) app.globalData.UID = null;
        }
      } catch { /* No native runtime in unit tests. */ }
      return { targetRoute: AuthAppService.HOME_ROUTE, isGuest: true };
    }

    this.persistUserProfile(savedProfile);
    if (savedBoundEquip) {
      this.authStore.setAuthenticatedUser(savedProfile, savedBoundEquip);
    }
    const sessionVersion = this.authStore.getSessionVersion();

    await Promise.allSettled([
      this.refreshMemberProfile(savedProfile.uid, savedProfile.telHP),
      this.reportService.syncEquipmentMetricMatrix().then(() => {
        if (sessionVersion !== this.authStore.getSessionVersion()) return [];
        return this.reportService.refreshHistory();
      }),
    ]);

    return { targetRoute: AuthAppService.HOME_ROUTE, isGuest: this.authStore.getState().isGuest };
  }

  /**
   * 微信 code 换取 openid (POST /main_v3/GetWechatSession)
   */
  async getWeChatOpenId(wxLoginCode: string): Promise<string> {
    const rawJson = await this.http.postEnvelope<string>(
      INBODY_ENDPOINTS.weChatSession,
      { Code: wxLoginCode }
    );
    if (!rawJson) return '';
    const parsed = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
    return String((parsed as { openid?: string })?.openid ?? '');
  }

  /**
   * 微信手机号授权解密 (POST /main_v3/GetWeChatTelHP)
   */
  async decryptWeChatPhone(
    encryptedData: string,
    iv: string,
    wxLoginCode: string
  ): Promise<{ telHP: string; openId: string }> {
    const data = await this.http.postEnvelope<WeChatTelHPDto>(
      INBODY_ENDPOINTS.weChatPhone,
      { LoginID: encryptedData, LogCode: iv, Code: wxLoginCode }
    );
    const phoneObj =
      typeof data?.PhoneNumber === 'string'
        ? (JSON.parse(data.PhoneNumber) as { purePhoneNumber?: string })
        : (data?.PhoneNumber as { purePhoneNumber?: string } | undefined);
    const sessionObj =
      typeof data?.Session === 'string'
        ? (JSON.parse(data.Session) as { openid?: string })
        : (data?.Session as { openid?: string } | undefined);

    const telHP = String(phoneObj?.purePhoneNumber ?? '');
    const openId = String(sessionObj?.openid ?? '');
    if (!telHP) {
      throw new Error('手机号码获取失败，请重新尝试。');
    }
    return { telHP, openId };
  }

  /**
   * 发送手机短信验证码 (POST /main_v3/SendAuthCodeWeChat)
   */
  async sendSmsAuthCode(telHP: string): Promise<string> {
    const code = await this.http.postEnvelope<string | number>(
      INBODY_ENDPOINTS.smsCode,
      { LoginID: telHP }
    );
    return String(code ?? '');
  }

  /**
   * 手机号登录（统一收敛微信一键授权与手机验证码登录）
   * 首次登录或非首次登录均直接返回首页路由 `/pages/HealthReportMain/HealthReportMain`
   */
  async loginWithPhone(telHP: string, codeOrOpenId = ''): Promise<{
    profile: UserProfile;
    targetRoute: string;
    bpCount: number;
  }> {
    const generation = ++this.loginGeneration;
    const sessionVersion = this.authStore.getSessionVersion();
    const data = await this.http.postEnvelope<LoginServerDto>(
        INBODY_ENDPOINTS.login,
        { LoginID: telHP, Code: codeOrOpenId }
      );
    if (generation !== this.loginGeneration || sessionVersion !== this.authStore.getSessionVersion()) {
      throw new Error('登录会话已失效，请重新登录');
    }
    if (!data?.UID) throw new Error('登录响应缺少用户标识，请重新登录');

    const existingLocal = this.resolvePersistedProfile();
    const newUid = String(data.UID);
    const sameAccount = existingLocal?.uid === newUid && existingLocal.telHP === telHP;
    const fallback = sameAccount ? existingLocal : null;
    const bpCount = Number(data?.BPCount ?? 0) || 0;

    // 若切换了不同账号，清理上一账号的历史报告缓存与全局缓存
    if (!sameAccount) {
      this.reportService.resetSession();
      this.storage.remove('equip:bound');
      this.clearLegacyAuthStorage();
      this.clearLegacyReportStorage();
      DashboardBootstrapService.invalidate();
    }

    const profile: UserProfile = {
      uid: newUid,
      telHP,
      name: String(data.Name || fallback?.name || ''),
      gender: (data.Gender || fallback?.gender || '') as 'M' | 'F' | '',
      age: Number(data.Age || fallback?.age || 0) || 0,
      height: Number(data.Height || fallback?.height || 0) || 0,
    };

    this.persistUserProfile(profile, bpCount);
    const authenticatedVersion = this.authStore.getSessionVersion();

    // 并发预加载会员详情、设备指标矩阵与历史记录，确保跳转到首页时图表立即可画
    await Promise.allSettled([
      this.refreshMemberProfile(profile.uid, telHP),
      this.reportService.syncEquipmentMetricMatrix().then(() => {
        if (authenticatedVersion !== this.authStore.getSessionVersion()) return [];
        return this.reportService.refreshHistory(true);
      }),
    ]);

    if (generation !== this.loginGeneration || authenticatedVersion !== this.authStore.getSessionVersion()) {
      throw new Error('登录会话已失效，请重新登录');
    }
    return {
      profile: this.authStore.getState().profile ?? profile,
      targetRoute: AuthAppService.HOME_ROUTE,
      bpCount,
    };
  }

  /**
   * 刷新完整会员档案（真实接口：POST /main/GetUserInfo，返回 Data: [member] 或 member）
   */
  async refreshMemberProfile(uid: string, telHP = ''): Promise<UserProfile | null> {
    if (!uid) return null;
    const sessionVersion = this.authStore.getSessionVersion();
    try {
      const rawData = await this.http.postEnvelope<MemberServerDto[] | MemberServerDto>(
        INBODY_ENDPOINTS.member,
        { UID: uid }
      );
      const detail = Array.isArray(rawData) ? rawData[0] : rawData;
      if (sessionVersion !== this.authStore.getSessionVersion() ||
          this.authStore.getState().profile?.uid !== uid) return null;
      if (!detail) {
        return this.authStore.getState().profile;
      }

      const current = this.authStore.getState().profile ?? this.resolvePersistedProfile();
      const updated: UserProfile = {
        uid,
        telHP: telHP || detail.TelHP || current?.telHP || '',
        name: String(detail.Name || detail.NICKNAME || current?.name || ''),
        gender: ((detail.Gender || detail.SEX || current?.gender || '') as 'M' | 'F' | ''),
        age: Number(detail.Age || detail.AGE || current?.age || 0) || 0,
        height: Number(detail.Height || detail.HT || current?.height || 0) || 0,
      };
      this.persistUserProfile(updated, undefined, detail as Record<string, unknown>);
      return updated;
    } catch {
      return this.authStore.getState().profile;
    }
  }

  /**
   * 保存/修改用户档案 (POST /main/SetUpdateUserInfo)
   */
  async updateMemberProfile(
    payload: Record<string, unknown>,
    wrapAsModel = false
  ): Promise<UserProfile> {
    const sessionVersion = this.authStore.getSessionVersion();
    const requestUid = this.authStore.getState().profile?.uid;
    if (!requestUid || (payload.UID != null && String(payload.UID) !== requestUid)) {
      throw new Error('用户会话已失效，请重新登录');
    }
    const requestData = wrapAsModel ? { model: payload } : payload;
    await this.http.request({
      url: INBODY_ENDPOINTS.updateMember,
      method: 'POST',
      data: requestData,
    });

    if (sessionVersion !== this.authStore.getSessionVersion()) {
      throw new Error('用户会话已失效，请重新登录');
    }
    const current = this.authStore.getState().profile;
    const updated: UserProfile = {
      uid: String(payload.UID ?? current?.uid ?? ''),
      telHP: String(payload.TelHP ?? current?.telHP ?? ''),
      name: String(payload.Name ?? current?.name ?? ''),
      gender: (payload.Gender ?? current?.gender ?? '') as 'M' | 'F' | '',
      age: Number(payload.Age ?? current?.age ?? 0) || 0,
      height: Number(payload.Height ?? current?.height ?? 0) || 0,
    };
    this.persistUserProfile(updated, undefined, payload);
    return updated;
  }

  /**
   * 上传用户头像 Base64 (POST /main/UploadUserPhoto)
   */
  async uploadUserPhoto(uid: string, photoBase64: string): Promise<string> {
    const sessionVersion = this.authStore.getSessionVersion();
    const avatarUrl = await this.http.postEnvelope<string>(
      INBODY_ENDPOINTS.uploadPhoto,
      { UID: uid, PhotoBase64: photoBase64 }
    );
    if (avatarUrl && sessionVersion === this.authStore.getSessionVersion() &&
        this.authStore.getState().profile?.uid === uid) {
      try {
        if (typeof wx !== 'undefined' && typeof wx.setStorageSync === 'function') {
          wx.setStorageSync('avatarUrl', avatarUrl);
        }
        if (typeof getApp === 'function') {
          const app = getApp<{ globalData?: Record<string, any> }>();
          if (app?.globalData?.InBodyUserInfo) {
            app.globalData.InBodyUserInfo.avatarUrl = avatarUrl;
          }
        }
      } catch {
        // Ignore runtime sync errors
      }
    }
    return String(avatarUrl ?? '');
  }

  /**
   * 注销账户并清理全部本地会话数据 (POST /main/SetDeleteUserInfo)
   */
  async deleteAccount(uid: string, telHP: string): Promise<void> {
    const sessionVersion = this.authStore.getSessionVersion();
    await this.http.postEnvelope(INBODY_ENDPOINTS.deleteAccount, {
      UID: uid,
      TelHP: telHP,
    });
    if (sessionVersion === this.authStore.getSessionVersion()) this.logout();
  }

  logout(): void {
    this.loginGeneration++;
    this.storage.remove('auth:uid');
    this.storage.remove('auth:tel');
    this.storage.remove('auth:profile');
    this.storage.remove('equip:bound');
    this.reportService.resetSession();
    this.clearLegacyAuthStorage();
    this.clearLegacyReportStorage();
    DashboardBootstrapService.invalidate();
    this.authStore.enterGuestMode();
  }

  private resolvePersistedProfile(): UserProfile | null {
    const typedProfile = this.storage.get('auth:profile');
    if (typedProfile && typedProfile.uid) {
      return typedProfile;
    }
    try {
      if (typeof wx !== 'undefined' && typeof wx.getStorageSync === 'function') {
        const legacyUid = String(wx.getStorageSync('InBodyUID') || '');
        const legacyTel = String(wx.getStorageSync('UserTelHP') || '');
        const legacyInfo = (wx.getStorageSync('InBodyUserInfo') || {}) as Record<string, any>;
        if (legacyUid || legacyTel) {
          return {
            uid: legacyUid,
            telHP: legacyTel || String(legacyInfo.TelHP || ''),
            name: String(legacyInfo.Name || ''),
            gender: (legacyInfo.Gender || '') as 'M' | 'F' | '',
            age: Number(legacyInfo.Age || 0) || 0,
            height: Number(legacyInfo.Height || 0) || 0,
          };
        }
      }
    } catch {
      // Ignore wx storage error in non-WeChat test runner
    }
    return null;
  }

  private persistUserProfile(
    profile: UserProfile,
    bpCount?: number,
    extraUserInfo?: Record<string, unknown>
  ): void {
    this.storage.set('auth:uid', profile.uid);
    this.storage.set('auth:tel', profile.telHP);
    this.storage.set('auth:profile', profile);
    const bound = this.storage.get('equip:bound');
    this.authStore.setAuthenticatedUser(profile, bound);

    try {
      const legacyInfo: Record<string, unknown> = {
        ...(typeof wx !== 'undefined' && typeof wx.getStorageSync === 'function'
          ? (wx.getStorageSync('InBodyUserInfo') as Record<string, unknown>) || {}
          : {}),
        ...(extraUserInfo || {}),
        Name: profile.name,
        Gender: profile.gender || null,
        Age: profile.age > 0 ? profile.age : null,
        Height: profile.height > 0 ? profile.height : null,
        TelHP: profile.telHP,
      };

      if (typeof wx !== 'undefined' && typeof wx.setStorageSync === 'function') {
        if (profile.uid) {
          wx.setStorageSync('InBodyUID', profile.uid);
        } else if (typeof wx.removeStorageSync === 'function') {
          wx.removeStorageSync('InBodyUID');
        }
        wx.setStorageSync('UserTelHP', profile.telHP);
        wx.setStorageSync('InBodyUserInfo', legacyInfo);
      }

      if (typeof getApp === 'function') {
        const app = getApp<{ globalData?: Record<string, unknown> }>();
        if (app && app.globalData) {
          app.globalData.UID = profile.uid;
          app.globalData.InBodyUserInfo = legacyInfo;
          if (bpCount !== undefined) {
            app.globalData.BPCount = bpCount;
          }
        }
      }
    } catch {
      // Ignore sync error in pure Node unit test environment
    }
  }

  private clearLegacyAuthStorage(): void {
    try {
      if (typeof wx !== 'undefined' && typeof wx.removeStorageSync === 'function') {
        wx.removeStorageSync('InBodyUID');
        wx.removeStorageSync('UserTelHP');
        wx.removeStorageSync('InBodyUserInfo');
        wx.removeStorageSync('avatarUrl');
        wx.removeStorageSync('CID_CACHE');
      }
      if (typeof getApp === 'function') {
        const app = getApp<{ globalData?: Record<string, unknown> }>();
        if (app?.globalData) {
          app.globalData.UID = null;
          app.globalData.InBodyUserInfo = { avatarUrl: '', Name: '' };
          app.globalData.BPCount = 0;
        }
      }
    } catch {
      // Ignore
    }
  }

  private clearLegacyReportStorage(): void {
    try {
      if (typeof wx !== 'undefined' && typeof wx.removeStorageSync === 'function') {
        wx.removeStorageSync('InBodyData');
        wx.removeStorageSync('InBodyDataUID');
        for (const key of ['HistoryGraphFilter','HistoryGraphEquipFilter','HistoryGraphDateFilter',
          'HistoryGraphFilterBP','HistoryGraphDateFilterBP','HistoryGraphEquipSelectionMode']) {
          wx.removeStorageSync(key);
        }
      }
      if (typeof getApp === 'function') {
        const app = getApp<{ globalData?: Record<string, unknown> }>();
        if (app?.globalData) {
          app.globalData.InBodyData = '';
        }
      }
    } catch {
      // Ignore
    }
  }
}

