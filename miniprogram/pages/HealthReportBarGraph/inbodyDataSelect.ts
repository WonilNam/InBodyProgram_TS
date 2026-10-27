interface RecordChoice { Index: number; checked: boolean; [key: string]: unknown }
interface PickerInstance {
  data: { Index: number; items: RecordChoice[] };
  setData(patch: Record<string, unknown>): void;
}
Page({
  data: { Index: 0, items: [] },
  onLoad(this: PickerInstance, options: { index?: string; data?: string }) {
    try {
      const raw = options.data ?? '[]';
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { parsed = JSON.parse(decodeURIComponent(raw)); }
      if (!Array.isArray(parsed)) throw new Error('记录列表格式错误');
      const index = Math.max(0, Math.min(Number(options.index) || 0, parsed.length - 1));
      this.setData({ Index: index, items: parsed.map((row: RecordChoice, idx: number) => ({ ...row, checked: idx === index })) });
    } catch { wx.showToast({ title: '记录列表加载失败', icon: 'none' }); }
  },
  ChangeRadio(this: PickerInstance, event: { detail: { value: string } }) { this.setData({ Index: Number(event.detail.value) }); },
  ViewBarGraph_Cancel() { wx.navigateBack({ delta: 1 }); },
  ViewBarGraph_Select(this: PickerInstance) {
    // Compatibility with the existing standalone report route.
    getApp<{ globalData: { BarGraphIndex: number } }>().globalData.BarGraphIndex = this.data.Index;
    wx.navigateBack({ delta: 1 });
  },
});
