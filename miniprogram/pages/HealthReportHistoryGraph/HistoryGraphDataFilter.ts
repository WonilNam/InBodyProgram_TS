
const util = require('../../src/domain/services/InBodyFormatService')
const { isManualInputResult } = require('../../src/domain/services/BcaReportSnapshotMapper')

function getEquipDisplayName(equip: any) {
  if (isManualInputResult(equip)) return '手动输入';
  var name = String(equip == null ? '' : equip).trim();
  if (!name) return '';
  var normalized = name.toUpperCase();
  var knownNames: Record<string, string> = {
    '120': 'InBody120', '270': 'InBody270', '380': 'InBody380', '770': 'InBody770', '970': 'InBody970',
    'H20': 'InBodyDial', 'H20B': 'InBodyDial', 'H30': 'InBodyDial H30', 'H40': 'InBodyDial H40',
    'WATCH': 'InBodyWATCH', 'INBODY120': 'InBody120', 'INBODY270': 'InBody270',
    'INBODY380': 'InBody380', 'INBODY770': 'InBody770', 'INBODY970': 'InBody970',
    'INBODYDIAL': 'InBodyDial', 'INBODYDIALH30': 'InBodyDial H30', 'INBODYDIALH40': 'InBodyDial H40',
    'INBODYWATCH': 'InBodyWATCH',
  };
  var compactName = normalized.replace(/\s+/g, '');
  if (knownNames[compactName]) return knownNames[compactName];
  if (normalized.indexOf('INBODY') === 0) return name;
  return 'InBody' + name;
}

function buildDateArray(records: any) {
  var dates: any[] = [];
  (records || []).forEach(function (item: any) {
    var value = String(item && item.Datetimes || '').substring(0, 8);
    if (/^\d{8}$/.test(value) && dates.indexOf(value) < 0) dates.push(value);
  });
  dates.sort();
  var dateArray = [{ date: 'initial', dateText: '初次检查' }];
  dateArray = dateArray.concat(dates.map(function (value) { return util.frometYYmmddWW(value); }).filter(function (item) { return item && item.date; }));
  dateArray.push({ date: 'recent', dateText: '最近' });
  return dateArray;
}

function getDateIndex(dateArray: any, selectedDate: any, fallback: any) {
  if (!selectedDate) return fallback;
  for (var i = 0; i < dateArray.length; i++) {
    if (dateArray[i].date === selectedDate.date || dateArray[i].dateText === selectedDate.dateText) return i;
  }
  return fallback;
}

function getDateCardText(item: any) {
  if (!item) return '';
  if (item.date === 'initial') return '初始';
  if (item.date === 'recent') return '最近';
  return item.dateText || '';
}

function getEquipCodesForTab(tab: any, listEquip: any) {
  var equip = listEquip || [];
  if (tab === '__manual__') return equip.filter(isManualInputResult);
  if (tab.indexOf('__device__:') === 0) {
    var deviceName = tab.substring('__device__:'.length);
    return equip.filter(function (code: any) { return getEquipDisplayName(code) === deviceName; });
  }
  return equip.slice();
}

function getEquipTabState(tabs: any, selected: any, listEquip: any, mode: any) {
  var allCodes = listEquip || [];
  var isAll = mode === 'all' || (mode !== 'selected' &&
    (!Array.isArray(selected) || selected.length === 0 ||
      allCodes.every(function (code: any) { return selected.indexOf(code) >= 0; })));
  return {
    selectedEquip: isAll ? 'all' : '__selected__',
    equipTabs: (tabs || []).map(function (tab: any) {
      var codes = getEquipCodesForTab(tab.value, allCodes);
      return Object.assign({}, tab, {
        selected: tab.value === 'all' ? isAll : !isAll && codes.some(function (code: any) { return selected.indexOf(code) >= 0; }),
      });
    }),
  };
}

Page({

  /**
   * Page initial data
   */
  data: {
    IsOpen: true,
    checkedCount:0,
    checkedData: [],
    dateRangeText: '',
    equipText: '',
    filterDateRange: null,
    filterEquip: null,
    equipSelectionMode: 'all',
    listData: [],
    visibleListData: [],
    listEquip: [],
    equipTabs: [],
    selectedEquip: 'all',
    isVisibleAllChecked: false,
    showDateSheet: false,
    openDateOnShow: false,
    dateArray: [],
    startDate: [0],
    endDate: [0],
    datePickerValue: [0],
    wheelCenterIndex: 0,
    activeDateField: 'start',
    startDateText: '',
    endDateText: '',
  },
  setItemCheck:function (e){
    var selected = e.detail.value || [];
    var visible = this.data.visibleListData || [];
    var visibleDates = visible.map(function (item: any) { return String(item.Datetimes); });
    var checked = (this.data.checkedData || []).filter(function (datetime: any) {
      return visibleDates.indexOf(String(datetime)) < 0;
    }).concat(selected.filter(function (datetime: any) {
      return visibleDates.indexOf(String(datetime)) >= 0;
    }));
    var checkedSet: Record<string, boolean> = {};
    checked.forEach(function (datetime: any) { checkedSet[String(datetime)] = true; });
    var list = (this.data.listData || []).map(function (item: any) {
      return Object.assign({}, item, { IsChecked: !!checkedSet[String(item.Datetimes)] });
    });
    this.setData(Object.assign({
      listData: list,
      checkedData: checked,
    }, this.getVisibleSelectionState(list)));
  },
  toggleItemCheck: function (e) {
    var datetime = String(e.currentTarget.dataset.datetime);
    var checked = (this.data.checkedData || []).map(String);
    var index = checked.indexOf(datetime);
    if (index >= 0) checked.splice(index, 1);
    else checked.push(datetime);
    this.setItemCheck({ detail: { value: checked } });
  },
  getVisibleListData: function (list, selectedEquip) {
    selectedEquip = selectedEquip || this.data.selectedEquip || 'all';
    if (selectedEquip === 'all') return list || [];
    if (selectedEquip === '__selected__') {
      var selectedCodes = this.data.filterEquip || [];
      return (list || []).filter(function (item: any) { return selectedCodes.indexOf(item.Equip) >= 0; });
    }
    if (selectedEquip === '__manual__') {
      return (list || []).filter(function (item: any) { return isManualInputResult(item.Equip); });
    }
    if (selectedEquip.indexOf('__device__:') === 0) {
      var deviceName = selectedEquip.substring('__device__:'.length);
      return (list || []).filter(function (item: any) { return getEquipDisplayName(item.Equip) === deviceName; });
    }
    return (list || []).filter(function (item: any) {
      return String(item.Equip) === String(selectedEquip);
    });
  },
  getVisibleSelectionState: function (list, selectedEquip) {
    var visibleListData = this.getVisibleListData(list, selectedEquip);
    return {
      visibleListData: visibleListData,
      isVisibleAllChecked: visibleListData.length > 0 && visibleListData.every(function (item: any) { return item.IsChecked; }),
    };
  },
  setEquipTab: function (e) {
    var tabValue = e.currentTarget.dataset.equip || 'all';
    var selectedTabs = tabValue === 'all' ? [] : (this.data.selectedEquip === 'all' ? [] : (this.data.filterEquip || []).map(function (code: any) {
      return isManualInputResult(code) ? '__manual__' : '__device__:' + getEquipDisplayName(code);
    }).filter(function (value: any, index: any, values: any) { return values.indexOf(value) === index; }));
    if (tabValue !== 'all') {
      var index = selectedTabs.indexOf(tabValue);
      if (index >= 0) selectedTabs.splice(index, 1);
      else selectedTabs.push(tabValue);
    }
    var listEquip = this.data.listEquip;
    var filterEquip = tabValue === 'all' || selectedTabs.length === 0 ? listEquip.slice() : [];
    if (selectedTabs.length > 0 && tabValue !== 'all') {
      selectedTabs.forEach(function (tab: any) {
        getEquipCodesForTab(tab, listEquip).forEach(function (code: any) {
          if (filterEquip.indexOf(code) < 0) filterEquip.push(code);
        });
      });
    }
    var equipSelectionMode = tabValue === 'all' || selectedTabs.length === 0 ? 'all' : 'selected';
    var tabState = getEquipTabState(this.data.equipTabs, filterEquip, this.data.listEquip, equipSelectionMode);
    try { wx.setStorageSync('TempHistoryGraphEquipFilter', filterEquip); } catch (error) {}
    this.setData(Object.assign({ filterEquip: filterEquip, equipSelectionMode: equipSelectionMode, IsOpen: false }, tabState));
    this.onShow();
  },
  toggleAll: function () {
    var visible = this.data.visibleListData || [];
    var shouldCheck = !(visible.length > 0 && visible.every(function (item: any) { return item.IsChecked; }));
    var visibleDates: Record<string, boolean> = {};
    visible.forEach(function (item: any) { visibleDates[String(item.Datetimes)] = true; });
    var list = (this.data.listData || []).map(function (item: any) {
      return visibleDates[String(item.Datetimes)]
        ? Object.assign({}, item, { IsChecked: shouldCheck })
        : item;
    });
    var checked = list.filter(function (item: any) { return item.IsChecked; }).map(function (item: any) { return item.Datetimes; });
    this.setData(Object.assign({ listData: list, checkedData: checked }, this.getVisibleSelectionState(list)));
  },
  checkboxAllUncheck: function () {
    var list = (this.data.listData || []).map(function (item: any) {
      return Object.assign({}, item, { IsChecked: false });
    });
    this.setData(Object.assign({
      listData: list,
      checkedData: [],
    }, this.getVisibleSelectionState(list)));
  },
  checkboxAllCheck: function () {
    var list = this.data.listData || [];
    var checked: any[] = [];
    list = list.map(function (item: any) {
      checked.push(item.Datetimes);
      return Object.assign({}, item, { IsChecked: true });
    });

    this.setData(Object.assign({
      listData: list,
      checkedData: checked,
    }, this.getVisibleSelectionState(list)));
  },
  makeFilterData: function (data) {
    var filterData = [];
    var listEquip = [];
    data = data || [];
    for (var i = 0; i < data.length; i++) {
      var item = data[i];
      if (!item) continue;
      var bca = item.BCA || item;
      var rawDt = item.DATETIMES || bca.DATETIMES || item.Datetimes || bca.Datetimes || '';
      var rawEquip = item.EQUIP || bca.EQUIP || item.Equip || bca.Equip || '';
      var rawWt = item.WT != null ? item.WT : (bca.WT != null ? bca.WT : '');
      var rawPbf = item.PBF != null ? item.PBF : (bca.PBF != null ? bca.PBF : '');
      var rawName = item.CustomerName || bca.CustomerName || '';

      var wt: number | string = Number(rawWt);
      if (isNaN(wt)) {
        wt = 'NaN';
      } else {
        wt = wt.toFixed(1);
      }
      var pbf: number | string = Number(rawPbf);
      if (isNaN(pbf)) {
        pbf = 'NaN';
      } else {
        pbf = pbf.toFixed(1);
      }

      var obj = {
        key: i,
        Datetimes: rawDt,
        DateText: util.formatDatetimes(rawDt),
        Equip: rawEquip,
        WT: wt,
        PBF: pbf,
        CustomerName: rawName,
        IsChecked: false,
        EquipText: getEquipDisplayName(rawEquip),
      };

      filterData.push(obj);

      if (rawEquip && listEquip.indexOf(obj.Equip) < 0) {
        listEquip.push(obj.Equip);
      }
    }

    var equipTabs = [{ value: 'all', label: '全部' }];
    var deviceNames: any[] = [];
    listEquip.forEach(function (equip) {
      var label = getEquipDisplayName(equip);
      if (!isManualInputResult(equip) && label && deviceNames.indexOf(label) < 0) deviceNames.push(label);
    });
    deviceNames.sort();
    deviceNames.forEach(function (label) {
      if (!equipTabs.some(function (tab) { return tab.label === label; })) {
        equipTabs.push({ value: '__device__:' + label, label: label });
      }
    });
    if (listEquip.some(isManualInputResult)) {
      equipTabs.push({ value: '__manual__', label: '手动输入' });
    }
    this.setData({
      listData: filterData,
      visibleListData: filterData,
      listEquip: listEquip,
      equipTabs: equipTabs,
      selectedEquip: 'all',
      isVisibleAllChecked: false,
    });
  },
  setDateChange: function (e) {
    var dateArray = buildDateArray(this.data.listData);
    var currentDate = this.data.filterDateRange || wx.getStorageSync('TempHistoryGraphDateFilter');
    var startIndex = getDateIndex(dateArray, currentDate && currentDate.StartDate, 0);
    var endIndex = getDateIndex(dateArray, currentDate && currentDate.EndDate, dateArray.length - 1);
    var startItem = dateArray[startIndex];
    var endItem = dateArray[endIndex];
    this.setData({
      showDateSheet: true,
      dateArray: dateArray,
      startDate: [startIndex],
      endDate: [endIndex],
      datePickerValue: [startIndex],
      wheelCenterIndex: startIndex,
      activeDateField: 'start',
      startDateText: getDateCardText(startItem),
      endDateText: getDateCardText(endItem),
    });
  },
  selectDateField: function (e) {
    var field = e.currentTarget.dataset.field;
    if (field === 'start' || field === 'end') {
      var index = (field === 'start' ? this.data.startDate : this.data.endDate)[0];
      this.setData({ activeDateField: field, datePickerValue: [index], wheelCenterIndex: index });
    }
  },
  onDatePickStart: function () { this._isPickingDate = true; },
  onDatePickEnd: function () {
    this._isPickingDate = false;
    this.syncDateCardText();
  },
  syncDateCardText: function () {
    var startItem = this.data.dateArray[this.data.startDate[0]];
    var endItem = this.data.dateArray[this.data.endDate[0]];
    var activeIndex = (this.data.activeDateField === 'end' ? this.data.endDate : this.data.startDate)[0];
    this.setData({
      startDate: this.data.startDate,
      endDate: this.data.endDate,
      datePickerValue: [activeIndex],
      wheelCenterIndex: activeIndex,
      startDateText: getDateCardText(startItem),
      endDateText: getDateCardText(endItem),
    });
  },
  setDate: function (e) {
    var index = Number(e.detail.value[0]);
    var item = this.data.dateArray[index];
    if (!item) return;
    if (this.data.activeDateField === 'end') {
      this.data.endDate = [index];
    } else {
      this.data.startDate = [index];
    }
    if (this._isPickingDate) {
      if (this.data.wheelCenterIndex !== index) this.setData({ wheelCenterIndex: index });
    } else {
      this.syncDateCardText();
    }
  },
  closeDateSheet: function () { this.setData({ showDateSheet: false }); },
  stopDateSheetTap: function () {},
  preventDateSheetScroll: function () {},
  nextDateStep: function () {
    this.syncDateCardText();
    if (this.data.activeDateField === 'start') {
      var endIndex = this.data.endDate[0];
      this.setData({
        activeDateField: 'end',
        datePickerValue: [endIndex],
        wheelCenterIndex: endIndex,
      });
      return;
    }
    this.confirmDateRange();
  },
  confirmDateRange: function () {
    this.syncDateCardText();
    var startItem = this.data.dateArray[this.data.startDate[0]];
    var endItem = this.data.dateArray[this.data.endDate[0]];
    if (!startItem || !endItem) return;
    var startValue = startItem.date === 'initial' ? '00000000' : (startItem.date === 'recent' ? '99999999' : String(startItem.date));
    var endValue = endItem.date === 'initial' ? '00000000' : (endItem.date === 'recent' ? '99999999' : String(endItem.date));
    if (startValue > endValue) {
      var temp = startItem;
      startItem = endItem;
      endItem = temp;
    }
    var date = startItem.date === 'initial' && endItem.date === 'recent'
      ? null
      : { StartDate: startItem, EndDate: endItem };
    wx.setStorageSync('TempHistoryGraphDateFilter', date);
    this.setData({
      showDateSheet: false,
      filterDateRange: date,
      IsOpen: false,
      startDateText: getDateCardText(startItem),
      endDateText: getDateCardText(endItem),
    });
    this.onShow();
  },
  setEquipChange: function (e) {
    var equip = this.data.listEquip;
    try{
      wx.setStorageSync('HistoryGraphEquipFilterDefault', equip);
    }catch(e){}
    
    wx.navigateTo({
      url: '/pages/HealthReportHistoryGraph/HistoryGraphDataFilterEquip?data=' + JSON.stringify(equip)
    })
  },
  setFilterChange: function (e) {
    if (!this.data.checkedData || this.data.checkedData.length === 0) {
      wx.showToast({ title: '请至少选择一条数据', icon: 'none' });
      return;
    }
    try {
      wx.setStorageSync('HistoryGraphEquipFilter', this.data.filterEquip);
      wx.setStorageSync('HistoryGraphEquipSelectionMode', this.data.equipSelectionMode);
    } catch (e) { }
    try {
      wx.setStorageSync('HistoryGraphDateFilter', this.data.filterDateRange);
    } catch (e) { }
    try {
      wx.setStorageSync('HistoryGraphFilter', this.data.checkedData);
    } catch (e) { }
    try {
      wx.setStorageSync('HistoryGraphDisplayRange', 'T');
    } catch (e) { }
    
    
    
    var pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    var previousPage = pages.length > 1 ? pages[pages.length - 2] : null;
    wx.navigateBack({ delta: 1, success: function () {
      if (previousPage && typeof previousPage.setData === 'function') {
        var nextRefresh = Number(previousPage.data && previousPage.data.Refresh || 0) + 1;
        var refreshData: Record<string, number> = { Refresh: nextRefresh };
        if (previousPage.data && Object.prototype.hasOwnProperty.call(previousPage.data, 'HistoryRefresh')) {
          refreshData.HistoryRefresh = nextRefresh;
        }
        previousPage.setData(refreshData);
      }
    } });
  },
  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    wx.showLoading({ mask: true, title: '加载中', });
    this.setData({ openDateOnShow: !!(options && options.openDate) });
    var data = null;
    if (options && options.data) {
      try {
        var str = options.data;
        try { str = decodeURIComponent(str); } catch (e) {}
        data = JSON.parse(str);
      } catch (e) {}
    }
    if (!data || !Array.isArray(data) || data.length === 0) {
      data = wx.getStorageSync('TempHistoryGraphListData') || wx.getStorageSync('InBodyData') || (getApp().globalData && getApp().globalData.InBodyData) || [];
    }
    data = data || [];
    var equip = wx.getStorageSync('HistoryGraphEquipFilter');
    var equipSelectionMode = wx.getStorageSync('HistoryGraphEquipSelectionMode');
    var date = wx.getStorageSync('HistoryGraphDateFilter');
    if (date && date.StartDate && typeof date.StartDate.date === 'object' && date.EndDate && date.EndDate.date === 'recent') {
      date = null;
    }
    try {
      wx.setStorageSync('TempHistoryGraphDateFilter', date);
    } catch (e) { }
    try {
      wx.setStorageSync('TempHistoryGraphEquipFilter', equip);
    } catch (e) { }
    
    this.makeFilterData(data);
    var tabState = getEquipTabState(this.data.equipTabs, equip, this.data.listEquip, equipSelectionMode);
    this.setData(Object.assign({ equipSelectionMode: tabState.selectedEquip === 'all' ? 'all' : 'selected' }, tabState, this.getVisibleSelectionState(this.data.listData, tabState.selectedEquip)));
    setTimeout(function () {
      wx.hideLoading()
    }, 1000);
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function () {

  },

  /**
   * Lifecycle function--Called when page show/a/sa/sa/as/awewewew2121212343433334554545454 4 45454mmmmm++f32lllllllll
   * 
   * ;';';';';'';'['= ]
   */
  onShow: function () {
    var equipText = '';
    var equip = wx.getStorageSync('TempHistoryGraphEquipFilter');
    
    this.setData({
      filterEquip: equip,
    });

    if (equip != null && equip != '') {
      if(equip.length == this.data.listEquip.length) {
        equipText = '所有设备数据'; //모든 장비 데이터
      } else {
        for (var i = 0; i < equip.length; i++) {
          equipText += 'InBody' + (equip[i].indexOf('H20') < 0 ? equip[i] : 'H20') + ',';
        }
        if (equipText.length > 1) {
          equipText = equipText.substring(0, equipText.length - 1);
        }
      }
    }
    
    var dateRangeText = '';
    var date = wx.getStorageSync('TempHistoryGraphDateFilter');
    this.setData({
      filterDateRange: date,
    });

    if (date != null && date != '' && date.StartDate && date.EndDate) {
      if (!(date.StartDate.date === 'initial' && date.EndDate.date === 'recent')) {
        dateRangeText = getDateCardText(date.StartDate) + ' ~ ' + getDateCardText(date.EndDate);
      }
    }

    var oldData = [];
    if(this.data.IsOpen){
      oldData = wx.getStorageSync('HistoryGraphFilter') || [];
    } 

    console.log(this.data.filterEquip, this.data.filterDateRange);
    var listData = this.data.listData || [];
    var checkedData = [];

    var latestDatetimes = '';
    for (var j = 0; j < listData.length; j++) {
      if (listData[j].Datetimes && (!latestDatetimes || listData[j].Datetimes > latestDatetimes)) {
        latestDatetimes = listData[j].Datetimes;
      }
    }

    var ft_st = (date && date.StartDate) ? date.StartDate.date : '';
    var ft_ed = (date && date.EndDate) ? date.EndDate.date : '';
    var stBoundary = this.transferToTimestamp(ft_st, false, latestDatetimes);
    var edBoundary = this.transferToTimestamp(ft_ed, true, latestDatetimes);
    if (stBoundary > edBoundary) {
      var tmp = stBoundary;
      stBoundary = edBoundary;
      edBoundary = tmp;
    }

    for (var i = 0; i < listData.length; i++) {
      var e = listData[i].Equip;
      var dt = listData[i].Datetimes;
      var equipMatch = !equip || equip.length === 0 || equip.indexOf(e) >= 0;
      var dateMatch = stBoundary <= dt && dt <= edBoundary;

      if ((!this.data.IsOpen && equipMatch && dateMatch)
      || (oldData.indexOf(dt) >= 0 && this.data.IsOpen )){
        listData[i].IsChecked = true;
        checkedData.push(listData[i].Datetimes);
      } else {
        listData[i].IsChecked = false;
      }
    }

    this.setData(Object.assign({
      IsOpen: false,
      dateRangeText: dateRangeText,
      equipText: equipText,
      listData: listData,
      checkedData: checkedData
    }, this.getVisibleSelectionState(listData)));

    if (this.data.openDateOnShow) {
      this.setData({ openDateOnShow: false });
      this.setDateChange();
    }

  },

  transferToTimestamp: function (dateValue, isEnd, latestDatetimes) {
    var boundary = isEnd ? '99999999999999' : '00000000000000';
    if (dateValue == null || dateValue === '') return boundary;
    var raw = String(dateValue).trim();

    if (raw === 'initial') {
      var earliest = '';
      var initialList = this && this.data ? this.data.listData || [] : [];
      for (var initialIndex = 0; initialIndex < initialList.length; initialIndex++) {
        var initialDate = initialList[initialIndex].Datetimes;
        if (initialDate && (!earliest || initialDate < earliest)) earliest = initialDate;
      }
      return earliest ? String(earliest).substring(0, 8) + (isEnd ? '235959' : '000000') : boundary;
    }

    if (raw.indexOf('recent') >= 0 || raw.indexOf('最后一次') >= 0) {
      var latest = latestDatetimes;
      if (!latest && this && this.data && this.data.listData) {
        var list = this.data.listData;
        for (var i = 0; i < list.length; i++) {
          if (list[i].Datetimes && (!latest || list[i].Datetimes > latest)) {
            latest = list[i].Datetimes;
          }
        }
      }
      if (latest && String(latest).length >= 8) {
        var latestYMD = String(latest).substring(0, 8);
        return latestYMD + (isEnd ? '235959' : '000000');
      }
      return boundary;
    }

    // 纯数字匹配：支持 8 位 YYYYMMDD、14 位 YYYYMMDDhhmmss
    var numMatched = raw.match(/^(\d{4})(\d{2})(\d{2})/);
    if (numMatched) {
      return numMatched[1] + numMatched[2] + numMatched[3] + (isEnd ? '235959' : '000000');
    }

    // 匹配 6 位纯数字 YYMMDD
    var num6Matched = raw.match(/^(\d{2})(\d{2})(\d{2})$/);
    if (num6Matched) {
      return '20' + num6Matched[1] + num6Matched[2] + num6Matched[3] + (isEnd ? '235959' : '000000');
    }

    // 带分隔符匹配：26.09.01 (周二) 或 2026-09-01 或 2026.09.01
    var matched = raw.match(/^(\d{2}|\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
    if (matched) {
      var year = matched[1].length === 2 ? '20' + matched[1] : matched[1];
      var month = matched[2].padStart(2, '0');
      var day = matched[3].padStart(2, '0');
      return year + month + day + (isEnd ? '235959' : '000000');
    }

    return boundary;
  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload: function () {

  }
})

// Marks this file as a module so top-level names do not collide with other page scripts.
export {};
