import { getContainer } from '../../src/application/AppContainer';
import { registerComponent } from '../../src/presentation/platform/registerComponent';
import { WxDashboardPreferences } from '../../src/presentation/dashboard/WxDashboardPreferences';

interface SettingsInstance {
  unsubscribe?: () => void;
  disposed: boolean;
  deleting: boolean;
  setData(patch: Record<string, unknown>): void;
}
interface MenuEvent { currentTarget: { id: string } }
const ROUTES: Readonly<Record<string,string>> = {
  UserModify: '/pages/compo/pages/SetupUserModify/UserModify',
  InBodyDataManage: '/pages/SetupInBodyDataManage/InBodyDataManage',
  AppDown: '/pages/ViewMoreMain/WebViewInBodyAppDown',
};
registerComponent<SettingsInstance>({
  properties: { Refresh: { type: Number } },
  options: { addGlobalClass: true },
  data: { isLogin: false },
  lifetimes: {
    attached(this: SettingsInstance) {
      this.disposed = false;
      this.unsubscribe = getContainer().authStore.subscribe(state => {
        if (!this.disposed) this.setData({ isLogin: state.isAuthenticated });
      });
    },
    detached(this: SettingsInstance) { this.disposed = true; this.unsubscribe?.(); },
  },
  methods: {
    SetupMoveMenu(_event: MenuEvent) {
      const id = _event.currentTarget.id;
      const auth = getContainer().authStore.getState();
      if (!auth.isAuthenticated && id !== 'AppDown' && id !== 'InBodyEquip') {
        wx.navigateTo({ url: '/pages/Login/GetTelHPComponent' }); return;
      }
      let url = ROUTES[id];
      if (id === 'InBodyEquip') {
        const equipment = new WxDashboardPreferences().getEquipment();
        url = equipment && equipment !== 'NaN'
          ? '/pages/SetupInBodyEquip/SetupInBodyEquipMy?view=Setup'
          : '/pages/SetupInBodyEquip/SetupInBodyEquipList?view=Setup';
      }
      if (url) wx.navigateTo({ url });
    },
    bindLogout() {
      wx.showModal({ content: '确定要退出登录吗？', success: (result: { confirm: boolean }) => {
        if (!result.confirm) return;
        getContainer().authService.logout();
        wx.redirectTo({ url: '/pages/index/index' });
      } });
    },
    bindLeaveAccount(this: SettingsInstance) {
      if (this.deleting) return;
      wx.showModal({ content: '账户注销后，所有历史数据将全部被删除', success: (result: { confirm: boolean }) => {
        if (!result.confirm || this.disposed || this.deleting) return;
        const profile = getContainer().authStore.getState().profile;
        if (!profile) return;
        this.deleting = true;
        void getContainer().authService.deleteAccount(profile.uid,profile.telHP).then(() => {
          if (!this.disposed) wx.reLaunch({ url: '/pages/index/index' });
        }).catch(() => wx.showToast({ title: '注销失败，请重试', icon: 'none' }))
          .finally(() => { this.deleting = false; });
      } });
    },
  },
});
