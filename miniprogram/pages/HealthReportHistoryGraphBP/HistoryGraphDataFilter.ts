
const util = require('../../src/domain/services/InBodyFormatService')

Page({

  /**
   * Page initial data
   */
  data: {
    IsOpen:true,
    checkedCount: 0,
    checkedData: [],
    dateRangeText: '',
    filterDateRange: null,
    listData: [],
    openDateFilter: false,
  },
  makeFilterData: function (data) {
    var checkedData = wx.getStorageSync('HistoryGraphFilterBP');
    var filterData = [];
    for (var i = 0; i < data.length; i++) {
      var sbp: number | string = Number(data[i].SPHYG1);
      if (isNaN(sbp)) {
        sbp = 'NaN';
      } else {
        sbp = sbp.toFixed(0);
      }
      var dbp: number | string = Number(data[i].SPHYG2);
      if (isNaN(dbp)) {
        dbp = 'NaN';
      } else {
        dbp = dbp.toFixed(0);
      }

      var obj = {
        key: i,
        Datetimes: data[i].DATETIMES,
        DateText: util.formatDatetimes(data[i].DATETIMES),
        SBP: sbp,
        DBP: dbp,
        IsChecked: false
      }
      if (checkedData.indexOf(obj.Datetimes) >= 0){
        obj.IsChecked = true;
      } else {
        obj.IsChecked = false;
      }
      
      filterData.push(obj);
    }

    this.setData({
      listData: filterData
    });
  },

  setItemCheck: function (e) {
    var data = e.detail.value;

    this.setData({
      checkedData: data
    });
  },

  checkboxAllUncheck: function () {
    var list = this.data.listData;
    var checeked: any[] = [];
    for (var i = 0; i < list.length; i++) {
      list[i].IsChecked = false;
    }
    this.setData({
      listData: list,
      checkedData: checeked
    });
  },
  checkboxAllCheck: function () {
    var list = this.data.listData;
    var checked = [];
    var stDate = list.length > 0 ? list[0].Datetimes : '';
    for (var i = 0; i < list.length; i++) {
      list[i].IsChecked = true;
      checked.push(list[i].Datetimes);
    }

    this.setData({
      listData: list,
      checkedData: checked,
    });
  },

  setFilterChange: function (e) {
    console.log(this.data.filterDateRange, this.data.checkedData)
    wx.setStorageSync('HistoryGraphDateFilterBP', this.data.filterDateRange);
    wx.setStorageSync('HistoryGraphFilterBP', this.data.checkedData);
    wx.navigateBack({
      delta: 1
    })
  },

  onLoad: function (options) {
    var data = JSON.parse(options.data);
    var date = wx.getStorageSync('HistoryGraphDateFilterBP');
    wx.setStorageSync('TempHistoryGraphDateFilterBP', date);
    this.makeFilterData(data);
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function () {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {
    var dateRangeText = '';
    var date: any = {};
    date = wx.getStorageSync('TempHistoryGraphDateFilterBP');
    
    this.setData({
      filterDateRange: date,
    });
    if (date != null && date != '' && date.StartDate && date.EndDate) {
      var sText = date.StartDate.dateText || date.StartDate.date || '';
      var eText = date.EndDate.dateText || date.EndDate.date || '';
      dateRangeText = sText + " ~ " + eText;
    }
    var oldData = [];
    if (this.data.IsOpen) {
      oldData = wx.getStorageSync('HistoryGraphFilterBP') || [];
    } 
    
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
      var dt = listData[i].Datetimes;
      var dateMatch = stBoundary <= dt && dt <= edBoundary;
      if ((!this.data.IsOpen && dateMatch)
        || (oldData.indexOf(dt) >= 0 && this.data.IsOpen)) {
        listData[i].IsChecked = true;
        checkedData.push(listData[i].Datetimes);
      } else {
        listData[i].IsChecked = false;
      }
    }

    this.setData({
      IsOpen: false,
      dateRangeText: dateRangeText,
      listData: listData,
      checkedData: checkedData
    });    
  },

  transferToTimestamp: function (dateValue, isEnd, latestDatetimes) {
    var boundary = isEnd ? '99999999999999' : '00000000000000';
    if (dateValue == null || dateValue === '') return boundary;
    var raw = String(dateValue).trim();

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

    var numMatched = raw.match(/^(\d{4})(\d{2})(\d{2})/);
    if (numMatched) {
      return numMatched[1] + numMatched[2] + numMatched[3] + (isEnd ? '235959' : '000000');
    }

    var num6Matched = raw.match(/^(\d{2})(\d{2})(\d{2})$/);
    if (num6Matched) {
      return '20' + num6Matched[1] + num6Matched[2] + num6Matched[3] + (isEnd ? '235959' : '000000');
    }

    var matched = raw.match(/^(\d{2}|\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
    if (matched) {
      var year = matched[1].length === 2 ? '20' + matched[1] : matched[1];
      var month = matched[2].padStart(2, '0');
      var day = matched[3].padStart(2, '0');
      return year + month + day + (isEnd ? '235959' : '000000');
    }

    return boundary;
  },

  setDateChange: function (e) {
    var date = [];
    var dData = this.data.listData || [];
    for (var i = 0; i < dData.length; i++) {
      if (dData[i].Datetimes != null && String(dData[i].Datetimes).length >= 8) {
        var ymd = String(dData[i].Datetimes).substring(0, 8);
        if (date.indexOf(ymd) < 0) {
          date.push(ymd);
        }
      }
    }
    try {
      wx.setStorageSync('TempHistoryGraphDateListBP', date);
    } catch (e) {}
    wx.navigateTo({
      url: '/pages/HealthReportHistoryGraphBP/HistoryGraphDataFilterDate?data=' + encodeURIComponent(JSON.stringify(date))
    });
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

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh: function () {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom: function () {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage: function () {

  }
})

// Marks this file as a module so top-level names do not collide with other page scripts.
export {};
