import * as hardwareSdk from './hardware-sdk/index';
import { AppContainer, getContainer } from './src/application/AppContainer';


export interface IInBodyApp {
  readonly container: AppContainer;
  readonly hardwareSdk: typeof hardwareSdk;
  globalData: Record<string, any>;
  userInfoReadyCallback?: (res: any) => void;
}

App({
  container: getContainer(),
  hardwareSdk,
  onLaunch(this: IInBodyApp) {
    this.globalData.UID = wx.getStorageSync('InBodyUID') || null;
    this.globalData.InBodyUserInfo = wx.getStorageSync('InBodyUserInfo') || { avatarUrl: '', Name: '' };
    this.globalData.historyDefaultSet = wx.getStorageSync('historyDefaultSet') || {};
    void this.container.initializeSession().catch((error: unknown) => {
      console.error('会话恢复失败', error);
    });

    const logs = wx.getStorageSync('logs') || [];
    logs.unshift(Date.now());
    wx.setStorageSync('logs', logs);

    wx.login({
      success: () => {},
    });

    wx.getSetting({
      success: (res: any) => {
        if (res.authSetting && res.authSetting['scope.userInfo']) {
          wx.getUserInfo({
            success: (userRes: any) => {
              this.globalData.userInfo = userRes.userInfo;
              if (this.userInfoReadyCallback) {
                this.userInfoReadyCallback(userRes);
              }
            },
          });
        }
      },
    });
  },
  globalData: {
    UID: null,
    Language: 'cn',
    InBodyUserInfo: { avatarUrl: '', Name: '' },
    BPCount: 0,
    serverUrl: 'https://wechat.lookinbody.cn',
    isTestProfile: false,
    BarGraphIndex: '',
    InBodyResultPageCheck: false,
    GetTelHPType: '',
    QRDatetimes: '',
    InBodyData: '',
    historyDefaultSet: '',
    bluetoothdata: false,
    BluetoothH30: getContainer().setupSession,
    nickName: '',
  },
});
