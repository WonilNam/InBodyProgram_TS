
Page({
  data: {
    statusBarHeight: 0,
    L: getApp().globalData.Language,
    items: [],
    visibleItems: [],
    hiddenItems: [],
    selectedCount: 0,
    draggingKey: '',
  },

  onLoad: function (options) {
    this._dashboardMode = !!(options && options.mode === 'dashboard');
    var windowInfo = wx.getWindowInfo();
    var available = wx.getStorageSync(this._dashboardMode ? 'TempDashboardSettingItems' : 'TempHistoryGraphSettingItems') || [];
    var savedOrder = wx.getStorageSync(this._dashboardMode ? 'DashboardSummaryItems' : 'HistoryGraphItemOrder');
    var visible = this._dashboardMode ? (Array.isArray(savedOrder) && savedOrder.length === 3 ? savedOrder : ['WT', 'SMM', 'PBF']) : wx.getStorageSync('HistoryGraphVisibleItems');
    if (this._dashboardMode) available = Array.from(new Set(visible.concat(available)));
    if (Array.isArray(savedOrder)) {
      available = available.slice().sort(function (left: any, right: any) {
        var leftIndex = savedOrder.indexOf(left);
        var rightIndex = savedOrder.indexOf(right);
        return (leftIndex < 0 ? savedOrder.length : leftIndex) - (rightIndex < 0 ? savedOrder.length : rightIndex);
      });
    }
    var hasVisible = Array.isArray(visible) && available.some(function (key: any) { return visible.indexOf(key) >= 0; });
    var items = available.map(function (key: any) {
      return { key: key, selected: !hasVisible || visible.indexOf(key) >= 0 };
    });
    items = items.filter(function (item: any) { return item.selected; }).concat(items.filter(function (item: any) { return !item.selected; }));
    this.setData({
      statusBarHeight: windowInfo.statusBarHeight || 0,
      dashboardMode: this._dashboardMode,
      items: items,
      visibleItems: items.filter(function (item: any) { return item.selected; }),
      hiddenItems: items.filter(function (item: any) { return !item.selected; }),
      selectedCount: items.filter(function (item: any) { return item.selected; }).length,
    });
  },

  goBack: function () {
    wx.navigateBack({ delta: 1 });
  },

  toggleMetric: function (event) {
    var key = event.currentTarget.dataset.key;
    var target = this.data.items.find(function (item: any) { return item.key === key; });
    if (this._dashboardMode && target && !target.selected && this.data.selectedCount >= 3) {
      wx.showToast({ title: '请先取消一项，再选择新项目', icon: 'none' });
      return;
    }
    var items = this.data.items.map(function (item: any) {
      return item.key === key ? Object.assign({}, item, { selected: !item.selected }) : item;
    });
    items = items.filter(function (item: any) { return item.selected; }).concat(items.filter(function (item: any) { return !item.selected; }));
    this.setData({
      items: items,
      visibleItems: items.filter(function (item: any) { return item.selected; }),
      hiddenItems: items.filter(function (item: any) { return !item.selected; }),
      selectedCount: items.filter(function (item: any) { return item.selected; }).length,
    });
  },

  onDragStart: function (event) {
    var touch = event.touches && event.touches[0];
    var key = event.currentTarget.dataset.key;
    if (!touch || !key) return;
    this._drag = {
      key: key,
      startY: touch.clientY,
      startIndex: this.data.items.findIndex(function (item: any) { return item.key === key; }),
    };
    this.setData({ draggingKey: key });
  },

  onDragMove: function (event) {
    var touch = event.touches && event.touches[0];
    if (!touch || !this._drag) return;
    var rowHeight = wx.getWindowInfo().windowWidth * 140 / 750;
    var targetIndex = this._drag.startIndex + Math.round((touch.clientY - this._drag.startY) / rowHeight);
    targetIndex = Math.max(0, Math.min(this.data.selectedCount - 1, targetIndex));
    var items = this.data.items.slice();
    var currentIndex = items.findIndex(function (this: any, item: any) { return item.key === this._drag.key; }, this);
    if (currentIndex === targetIndex || currentIndex < 0) return;
    var moved = items.splice(currentIndex, 1)[0];
    items.splice(targetIndex, 0, moved);
    this.setData({ items: items, visibleItems: items.slice(0, this.data.selectedCount) });
  },

  onDragEnd: function () {
    this._drag = null;
    this.setData({ draggingKey: '' });
  },

  saveSettings: function () {
    var items = this.data.items;
    var visible = items.filter(function (item: any) { return item.selected; }).map(function (item: any) { return item.key; });
    if (this._dashboardMode) {
      if (visible.length !== 3) {
        wx.showToast({ title: '请选择三项数据', icon: 'none' });
        return;
      }
      wx.setStorageSync('DashboardSummaryItems', visible);
      const channel = typeof this.getOpenerEventChannel === 'function' ? this.getOpenerEventChannel() : null;
      if (channel) channel.emit('dashboardSettingsChanged');
      wx.navigateBack({ delta: 1 });
      return;
    }
    if (visible.length === 0) {
      wx.showToast({ title: '请至少选择一项', icon: 'none' });
      return;
    }
    var currentKeys = items.map(function (item: any) { return item.key; });
    var oldOrder = wx.getStorageSync('HistoryGraphItemOrder');
    var oldVisible = wx.getStorageSync('HistoryGraphVisibleItems');
    var order = currentKeys.concat(Array.isArray(oldOrder) ? oldOrder.filter(function (key) { return currentKeys.indexOf(key) < 0; }) : []);
    var selected = visible.concat(Array.isArray(oldVisible) ? oldVisible.filter(function (key) { return currentKeys.indexOf(key) < 0; }) : []);
    wx.setStorageSync('HistoryGraphItemOrder', order);
    wx.setStorageSync('HistoryGraphVisibleItems', selected);
    var pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    var previousPage = pages.length > 1 ? pages[pages.length - 2] : null;
    wx.navigateBack({ delta: 1, success: function () {
      if (previousPage && typeof previousPage.setData === 'function') {
        previousPage.setData({ Refresh: Number(previousPage.data && previousPage.data.Refresh || 0) + 1 });
      }
    } });
  },
});

