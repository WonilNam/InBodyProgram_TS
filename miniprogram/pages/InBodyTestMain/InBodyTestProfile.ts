import { getContainer } from '../../src/application/AppContainer';
import { measurementProfileFields, measurementProfilePayload } from '../../src/presentation/profile/MeasurementProfileForm';

interface ProfileInstance {
  disposed: boolean;
  saving: boolean;
  setData(patch: Record<string, unknown>): void;
  SaveUserInfo(payload: Record<string, unknown>): Promise<void>;
}
Page({
  data: { Height: '', Gender: '', Age: '', Gender_M: false, Gender_F: false, btnLoading: false, isbtnDisable: false },
  async onLoad(this: ProfileInstance) {
    this.disposed = false;
    const container = getContainer();
    const profile = container.authStore.getState().profile;
    if (!profile) { wx.navigateTo({ url: '/pages/Login/GetTelHPComponent' }); return; }
    this.setData(measurementProfileFields(profile));
    const updated = await container.authService.refreshMemberProfile(profile.uid);
    if (updated && !this.disposed) this.setData(measurementProfileFields(updated));
  },
  onUnload(this: ProfileInstance) { this.disposed = true; },
  async formSubmit(this: ProfileInstance, event: { detail: { value: { rbGender: string; txtAge: string; txtHeight: string } } }) {
    const profile = getContainer().authStore.getState().profile;
    if (!profile || this.saving) return;
    const input = event.detail.value;
    try { await this.SaveUserInfo(measurementProfilePayload(profile, { Gender: input.rbGender, Age: input.txtAge, Height: input.txtHeight })); }
    catch (error) { wx.showModal({ content: error instanceof Error ? error.message : '资料不正确', showCancel: false }); }
  },
  async SaveUserInfo(this: ProfileInstance, payload: Record<string, unknown>) {
    if (this.saving) return;
    this.saving = true;
    this.setData({ btnLoading: true, isbtnDisable: true });
    try {
      await getContainer().authService.updateMemberProfile(payload,true);
      if (!this.disposed) wx.navigateBack({ delta: 1 });
    } catch (error) {
      if (!this.disposed) wx.showToast({ title: error instanceof Error ? error.message : '资料保存失败，请重试', icon: 'none' });
    } finally {
      this.saving = false;
      if (!this.disposed) this.setData({ btnLoading: false, isbtnDisable: false });
    }
  },
});
