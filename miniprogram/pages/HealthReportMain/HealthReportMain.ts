import { scanQR } from '../../src/infrastructure/adapters/QrScanAdapter';

type MainTab = 'InBodyDashboard' | 'InBodyResult' | 'HistoryGraph' | 'InBodyMe';
interface MainState {
  ViewType: MainTab; Refresh: number; ResultRefresh: number; HistoryRefresh: number;
  hasOpenedResult: boolean; hasOpenedHistory: boolean; isCheckMain: boolean;
}
interface MainInstance {
  data: MainState;
  setData(patch: Record<string, unknown>): void;
  onShow(): void;
}
interface TapEvent { currentTarget: { id: string } }
const TABS: Readonly<Record<string, MainTab>> = {
  inbodyDashboard: 'InBodyDashboard', inbodyResult: 'InBodyResult', historyGraph: 'HistoryGraph', inbodyMe: 'InBodyMe',
};

Page({
  data: {
    statusBarHeight: 20, navigationHeight: 44, navigationRight: 100,
    NoData: '', Refresh: 0, ResultRefresh: 0, HistoryRefresh: 0, NotiViewHide: true,
    ViewType: 'InBodyDashboard', hasOpenedResult: false, hasOpenedHistory: false,
    L: 'cn', isMainBody: 'display:block;', isCheckMain: true, mainheaderView: '',
    navType: 'InBodyTest', reportSrc: '/images/icon_stand_black.png',
    communitySrc: '/images/icon_community_black.png',
  },
  onLoad(this: MainInstance) {
    const info = wx.getWindowInfo() as { statusBarHeight?: number; windowWidth: number };
    const capsule = wx.getMenuButtonBoundingClientRect() as { width: number; height: number; top: number; left: number };
    const statusBarHeight = info.statusBarHeight ?? 0;
    const valid = capsule?.width > 0 && capsule.height > 0 && capsule.top >= statusBarHeight;
    this.setData({ statusBarHeight,
      navigationHeight: valid ? (capsule.top - statusBarHeight) * 2 + capsule.height : 44,
      navigationRight: valid ? info.windowWidth - capsule.left + 12 : 100 });
  },
  onShow(this: MainInstance) {
    const refresh = this.data.Refresh + 1;
    this.setData({ Refresh: refresh,
      ResultRefresh: this.data.ViewType === 'InBodyResult' ? refresh : this.data.ResultRefresh,
      HistoryRefresh: this.data.ViewType === 'HistoryGraph' ? refresh : this.data.HistoryRefresh,
      isMainBody: this.data.isCheckMain ? 'display:block;' : 'display:none;' });
  },
  moveTap(this: MainInstance, event: TapEvent) {
    const tab = TABS[event.currentTarget.id];
    if (!tab) return;
    const refresh = this.data.Refresh + 1;
    this.setData({ ViewType: tab, Refresh: refresh,
      hasOpenedResult: this.data.hasOpenedResult || tab === 'InBodyResult',
      hasOpenedHistory: this.data.hasOpenedHistory || tab === 'HistoryGraph',
      ResultRefresh: tab === 'InBodyResult' ? refresh : this.data.ResultRefresh,
      HistoryRefresh: tab === 'HistoryGraph' ? refresh : this.data.HistoryRefresh });
  },
  moveToMenu(this: MainInstance, event: TapEvent) {
    if (event.currentTarget.id === 'qrScan') { scanQR(false, () => this.onShow()); return; }
    wx.redirectTo({ url: event.currentTarget.id === 'viewMore'
      ? '/pages/ViewMoreMain/ViewMoreMain' : '/pages/HealthReportMain/HealthReportMain' });
  },
  moveNavTap(this: MainInstance, event: TapEvent) {
    const community = event.currentTarget.id === 'inbodyCommunity';
    this.setData({ navType: community ? 'InBodyCommunity' : 'InBodyTest',
      reportSrc: `/images/icon_stand_${community ? 'gray' : 'black'}.png`,
      communitySrc: '/images/icon_community_black.png' });
    if (community) wx.navigateTo({ url: '/pages/compo/pages/InBodyCommunity/InBodyCommunity' });
  },
  clickLink() { wx.navigateTo({ url: '/pages/ViewMoreMain/WebViewInBodyAppDown' }); },
  notiClose(this: MainInstance) { this.setData({ NotiViewHide: true }); },
});
