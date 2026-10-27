import { getContainer } from '../../src/application/AppContainer';
import { AuthAppService } from '../../src/application/services/AuthAppService';
import { loginAndNavigate } from '../Login/LoginActions';

interface PhoneEvent {
  detail: { TelHP: string; OpenID?: string };
}

Page({
  data: {
    IsShowInput: false,
    IsShowGet: false,
    IsShowAgree: false,
  },
  async onLoad() {
    try {
      const result = await getContainer().initializeSession();
      const telHP = String(wx.getStorageSync('UserTelHP') || '');
      if (result.isGuest && telHP) {
        this.getLoginCode(telHP);
        return;
      }
      wx.redirectTo({ url: result.targetRoute });
    } catch (error) {
      wx.showToast({ title: '会话恢复失败，请重新登录', icon: 'none' });
      wx.redirectTo({ url: AuthAppService.HOME_ROUTE });
    }
  },
  onInputTelHP(event: PhoneEvent) {
    this.setData({ IsShowInput: false });
    this.getLoginCode(event.detail.TelHP);
  },
  onGetTelHP(event: PhoneEvent) {
    void loginAndNavigate(event.detail.TelHP, event.detail.OpenID);
  },
  onSwitchView() {
    this.setData({ IsShowGet: true, IsShowAgree: false });
  },
  OnAgreedPolicy(event: PhoneEvent) {
    this.setData({ IsShowGet: false, IsShowAgree: false });
    void loginAndNavigate(event.detail.TelHP, event.detail.OpenID);
  },
  getLoginCode(telHP: string) {
    wx.login({
      success: (result: { code?: string }) => {
        if (!result.code) {
          wx.showToast({ title: '微信登录失败，请重试', icon: 'none' });
          return;
        }
        void getContainer().authService.getWeChatOpenId(result.code)
          .then(openId => loginAndNavigate(telHP, openId))
          .catch(() => wx.showToast({ title: '微信登录失败，请重试', icon: 'none' }));
      },
      fail: () => wx.showToast({ title: '微信登录失败，请重试', icon: 'none' }),
    });
  },
});
