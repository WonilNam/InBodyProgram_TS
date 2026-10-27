import { loginAndNavigate } from './LoginActions';
import { getContainer } from '../../src/application/AppContainer';
import { SMS_INITIAL_STATE, SmsLoginPresenter } from '../../src/presentation/login/SmsLoginPresenter';

interface SmsInstance {
  presenter?: SmsLoginPresenter;
  disposed: boolean;
  setData(patch: Record<string, unknown>): void;
}
interface SubmitEvent { detail: { target: { id: string }; value: { txtTelHP: string; txtCode: string } } }
const notify = (error: unknown) => wx.showToast({ title: error instanceof Error ? error.message : '登录失败，请重试', icon: 'none' });
const weChatCode = () => new Promise<string>((resolve,reject) => wx.login({
  success: (result: { code?: string }) => result.code ? resolve(result.code) : reject(new Error('微信登录失败，请重试')),
  fail: () => reject(new Error('微信登录失败，请重试')),
}));

Page({
  data: { ...SMS_INITIAL_STATE },
  onLoad(this: SmsInstance) {
    this.disposed = false;
    this.presenter = new SmsLoginPresenter(getContainer().authService, state => {
      if (!this.disposed) this.setData({ ...state });
    });
  },
  onUnload(this: SmsInstance) { this.disposed = true; this.presenter?.dispose(); },
  bindInput(this: SmsInstance) { this.presenter?.hideValidation(); },
  bindInputCode(this: SmsInstance, event: { detail: { value: string } }) { this.presenter?.inputCode(event.detail.value); },
  bindBtnCancel(this: SmsInstance) { this.presenter?.cancel(); },
  getUserInfo(phone: string, openId: string) { return loginAndNavigate(phone,openId); },
  async formSubmit(this: SmsInstance, event: SubmitEvent) {
    const { txtTelHP: phone, txtCode: code } = event.detail.value;
    try {
      if (event.detail.target.id === 'TelHP') { await this.presenter?.send(phone); return; }
      if (event.detail.target.id !== 'Confirm' || !this.presenter) return;
      this.presenter.validate(phone,code);
      const wxCode = await weChatCode();
      if (this.disposed) return;
      const openId = await getContainer().authService.getWeChatOpenId(wxCode);
      if (!this.disposed) await loginAndNavigate(phone,openId);
    } catch (error) { if (!this.disposed) notify(error); }
  },
  onRejectLogin() {
    if (getCurrentPages().length > 1) wx.navigateBack({ delta: 1 });
    else wx.reLaunch({ url: '/pages/HealthReportMain/HealthReportMain' });
  },
});
