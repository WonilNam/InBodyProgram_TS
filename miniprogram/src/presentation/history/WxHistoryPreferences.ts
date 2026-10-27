import { HistoryPreferences } from './HistoryView';

export class WxHistoryPreferences {
  read(): HistoryPreferences {
    const list = (key: string): string[] | null => {
      const value: unknown = wx.getStorageSync(key);
      return Array.isArray(value) ? value.map(String) : null;
    };
    const date = wx.getStorageSync('HistoryGraphDateFilter') as {
      StartDate?: { date: string; dateText: string }; EndDate?: { date: string; dateText: string };
    } | undefined;
    return {
      range: wx.getStorageSync('HistoryGraphDisplayRange') === 'T' ? 'T' : 'R',
      dates: list('HistoryGraphFilter'), equips: list('HistoryGraphEquipFilter'),
      visible: list('HistoryGraphVisibleItems'), order: list('HistoryGraphItemOrder') ?? [],
      equipMode: String(wx.getStorageSync('HistoryGraphEquipSelectionMode') || ''),
      start: date?.StartDate?.date ?? '', end: date?.EndDate?.date ?? 'recent',
      dateLabel: date?.StartDate?.dateText ? `${date.StartDate.dateText}~${date.EndDate?.dateText ?? ''}` : '',
    };
  }
  setRange(range: 'R' | 'T'): void { wx.setStorageSync('HistoryGraphDisplayRange', range); }
  prepareFilter(rows: readonly Record<string, unknown>[]): void { wx.setStorageSync('TempHistoryGraphListData', rows); }
  prepareSettings(keys: readonly string[]): void { wx.setStorageSync('TempHistoryGraphSettingItems', keys); }
}
