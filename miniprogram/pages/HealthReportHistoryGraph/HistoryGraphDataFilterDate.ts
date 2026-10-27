
const util = require('../../src/domain/services/InBodyFormatService');

function saveDateSelectionInternal(pageInstance: any) {
  if (!pageInstance || !pageInstance.data || !pageInstance.data.dateArray || pageInstance.data.dateArray.length === 0) return;

  var sDate = (pageInstance.data.startDate && pageInstance.data.startDate[0] != null) ? pageInstance.data.startDate[0] : 0;
  var eDate = (pageInstance.data.endDate && pageInstance.data.endDate[0] != null) ? pageInstance.data.endDate[0] : (pageInstance.data.dateArray.length - 1);
  if (sDate < 0) sDate = 0;
  if (sDate >= pageInstance.data.dateArray.length) sDate = pageInstance.data.dateArray.length - 1;
  if (eDate < 0) eDate = 0;
  if (eDate >= pageInstance.data.dateArray.length) eDate = pageInstance.data.dateArray.length - 1;

  var startItem = pageInstance.data.dateArray[sDate];
  var endItem = pageInstance.data.dateArray[eDate];

  var getRawDate = function (item: any) {
    if (!item) return '';
    var d = item.date != null ? String(item.date).trim() : '';
    if (d === 'recent' || (item.dateText && item.dateText.indexOf('最后一次') >= 0)) {
      return '99999999';
    }
    var m = d.match(/^(\d{4})(\d{2})(\d{2})/);
    if (m) return m[1] + m[2] + m[3];
    var m2 = (item.dateText || d).match(/^(\d{2}|\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
    if (m2) {
      var y = m2[1].length === 2 ? '20' + m2[1] : m2[1];
      return y + m2[2].padStart(2, '0') + m2[3].padStart(2, '0');
    }
    return d;
  };

  var startVal = getRawDate(startItem);
  var endVal = getRawDate(endItem);

  if (startVal && endVal && startVal > endVal) {
    var temp = startItem;
    startItem = endItem;
    endItem = temp;
  }

  var data = { StartDate: startItem, EndDate: endItem };
  wx.setStorageSync('TempHistoryGraphDateFilter', data);
}

Page({

  /**
   * Page initial data
   */
  data: {
    startDate: [0],
    endDate: [0],
    dateArray: []
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    var raw = [];
    if (options && options.data) {
      try {
        var dataStr = options.data;
        try {
          dataStr = decodeURIComponent(dataStr);
        } catch (e) {}
        raw = JSON.parse(dataStr);
      } catch (e) {
        raw = [];
      }
    }
    if (!Array.isArray(raw) || raw.length === 0) {
      try {
        var cached = wx.getStorageSync('TempHistoryGraphDateList');
        if (Array.isArray(cached) && cached.length > 0) {
          raw = cached;
        }
      } catch (e) {}
    }
    if (!Array.isArray(raw) || raw.length === 0) {
      var pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
      if (pages.length >= 2) {
        var prevPage = pages[pages.length - 2];
        if (prevPage && prevPage.data && Array.isArray(prevPage.data.listData)) {
          var pList = prevPage.data.listData;
          for (var i = 0; i < pList.length; i++) {
            if (pList[i].Datetimes && String(pList[i].Datetimes).length >= 8) {
              var ymd = String(pList[i].Datetimes).substring(0, 8);
              if (raw.indexOf(ymd) < 0) raw.push(ymd);
            }
          }
        }
      }
    }
    if (!Array.isArray(raw) || raw.length === 0) {
      var stored = wx.getStorageSync('InBodyData') || (getApp().globalData && getApp().globalData.InBodyData) || [];
      if (Array.isArray(stored)) {
        for (var i = 0; i < stored.length; i++) {
          var item = stored[i];
          var dt = item && (item.DATETIMES || (item.BCA && item.BCA.DATETIMES) || item.Datetimes);
          if (dt && String(dt).length >= 8) {
            var ymd = String(dt).substring(0, 8);
            if (raw.indexOf(ymd) < 0) raw.push(ymd);
          }
        }
      }
    }

    var data = this.makeEquipObject(raw);
    var defaultEndIndex = data.length > 0 ? data.length - 1 : 0;
    this.setData({
      dateArray: data,
      startDate: [0],
      endDate: [defaultEndIndex]
    });
  },
  makeEquipObject: function (data) {
    var date = [];
    data = data || [];
    var dateList = [];
    for (var i = 0; i < data.length; i++) {
      var item = data[i];
      if (!item) continue;
      var rawStr = String(item).trim();
      if (rawStr === 'recent' || rawStr.indexOf('最后一次') >= 0) continue;
      var clean = rawStr.replace(/[^\d]/g, '');
      if (clean.length >= 8) {
        clean = clean.substring(0, 8);
      }
      if (clean && dateList.indexOf(clean) < 0) {
        dateList.push(clean);
      }
    }
    dateList.sort();

    for (var i = 0; i < dateList.length; i++) {
      var d = dateList[i];
      var obj = util.frometYYmmddWW(d);
      if (obj && obj.dateText) {
        date.push(obj);
      }
    }
    date.push({ date: 'recent', dateText: '最后一次InBody测量日期' });

    return date;
  },
  onPickStart: function () {
    this._isPicking = true;
  },
  onPickEnd: function () {
    this._isPicking = false;
  },
  setPickerStartDate: function (e) {
    if (e && e.detail && e.detail.value) {
      this.data.startDate = e.detail.value;
    }
  },
  setPickerEndDate: function (e) {
    if (e && e.detail && e.detail.value) {
      this.data.endDate = e.detail.value;
    }
  },
  confirmDate: function () {
    this.saveDateSelection();
    wx.navigateBack({
      delta: 1
    });
  },
  saveDateSelection: function () {
    saveDateSelectionInternal(this);
  },
  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function () {
    var date = wx.getStorageSync('TempHistoryGraphDateFilter');
    if (date != null && date != '' && date.StartDate && date.EndDate) {
      var nStartIndex = 0;
      var nEndIndex = this.data.dateArray.length > 0 ? this.data.dateArray.length - 1 : 0;
      var sDate = date.StartDate.date;
      var sText = date.StartDate.dateText;
      var eDate = date.EndDate.date;
      var eText = date.EndDate.dateText;

      for (var i = 0; i < this.data.dateArray.length; i++) {
        var item = this.data.dateArray[i];
        if (item.date === sDate || (sText && item.dateText === sText)) {
          nStartIndex = i;
        }

        if (item.date === eDate || (eText && item.dateText === eText)) {
          nEndIndex = i;
        }
      }

      this.setData({
        startDate: [nStartIndex],
        endDate: [nEndIndex]
      });
    }
  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {
    console.log('onShow');
  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {
    console.log('onHide');
  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload: function () {
    console.log('onUnload');
    saveDateSelectionInternal(this);
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
