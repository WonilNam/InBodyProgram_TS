/** Paths and defaults retained from wx_InBodyProgram-new_master. */
export const INBODY_SERVER_URL = 'https://wechat.lookinbody.cn';
export const INBODY_ENDPOINTS = {
  weChatSession: '/main_v3/GetWechatSession',
  weChatPhone: '/main_v3/GetWeChatTelHP',
  smsCode: '/main_v3/SendAuthCodeWeChat',
  login: '/main_v3/GetUserInfoWeChat',
  member: '/main/GetUserInfo',
  updateMember: '/main/SetUpdateUserInfo',
  uploadPhoto: '/main/UploadUserPhoto',
  deleteAccount: '/main/SetDeleteUserInfo',
  metricMatrix: '/inbody/BindInBodyItemDefaultSetWeChat',
  history: '/inbody/GetInBodyDataWeChat',
  dashboard: '/main/GetDashboard_WeChat',
  bloodPressure: '/basalmedical/GetBloodPressureData',
  deleteRecord: '/inbody/DeleteInBodyData',
  bodyType: '/inbody_v3/GetInBodyBodyType',
  itemExplain: '/inbody_v3/GetInBodyItemExPlain',
  customerExpire: '/main_v3/GetCustomerExpire',
  resultsSheet: '/inbody_v3/GetResultsSheetImage',
  qrCheck: '/inbody_v3/SetInBodyDataQRCodeCheck',
  qrSave: '/inbody_v3/SetInBodyDataQRCode',
  bpQrSave: '/inbody_v3/SetBPDataQRCode',
  dialUpload: '/inbody/SetInBodyDataWeChat',
  inBody120Upload: 'https://inbodyapi.lookinbody.cn/InBodyAPI/SetJsonToInBodyDataWechat',
} as const;

export function resolveInBodyServerUrl(): string {
  if (typeof getApp === 'function') {
    try {
      const server = getApp<{ globalData?: { serverUrl?: string } }>()?.globalData?.serverUrl;
      if (server) return server.replace(/\/+$/, '');
    } catch { /* getApp is not available during application construction. */ }
  }
  return INBODY_SERVER_URL;
}

export function inBodyApiUrl(path: string, server = resolveInBodyServerUrl()): string {
  return /^https?:\/\//i.test(path) ? path : `${server.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

export function historyRequest(uid: string): Record<string, string> {
  return { UID: uid, SyncDatetime: '1990-01-01', NumberPerData: '999999', CurrentIndex: '0' };
}
