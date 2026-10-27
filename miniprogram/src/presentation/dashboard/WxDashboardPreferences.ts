import { DashboardPreferences } from './DashboardPresenter';

/** Explicit compatibility boundary for the existing settings pages' storage keys. */
export class WxDashboardPreferences implements DashboardPreferences {
  getMetricSelection(): unknown { return wx.getStorageSync('DashboardSummaryItems'); }
  setAvailableMetrics(keys: readonly string[]): void { wx.setStorageSync('TempDashboardSettingItems', keys); }
  getGoal(uid: string): string { return String(wx.getStorageSync(`DashboardHealthGoal:${uid}`) || ''); }
  setGoal(uid: string, key: string): void { wx.setStorageSync(`DashboardHealthGoal:${uid}`, key); }
  getEquipment(): unknown { return wx.getStorageSync('MyEquipList'); }
}
