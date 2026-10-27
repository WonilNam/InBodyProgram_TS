
Page({

  /**
   * Page initial data
   */
  data: {
    defaultData: [],
    listData: [],
    L: getApp().globalData.Language,
  },
  setEquipChange: function (e) {
    var data = e.detail.value || [];
    var list = this.data.listData;
    for (var i = 0; i < list.length; i++) {
      list[i].IsChecked = data.indexOf(list[i].Equip) >= 0;
    }
    this.setData({
      listData: list
    });
    wx.setStorageSync('TempHistoryGraphEquipFilter', data);
  },
  confirmEquip: function () {
    var equip = wx.getStorageSync('TempHistoryGraphEquipFilter');
    if (!equip || equip.length === 0) {
      wx.showModal({
        title: '设备选择发生错误',
        content: '请至少选择一个设备.',
        showCancel: false,
      });
      return;
    }
    wx.navigateBack({
      delta: 1,
    });
  },
  checkboxAllUncheck: function () {
    var data = this.data.listData;
    var equip: any[] = [];
    for (var i = 0; i < data.length; i++){
      data[i].IsChecked = false;
    }

    this.setData({
      listData: data
    });
    wx.setStorageSync('TempHistoryGraphEquipFilter', equip);
  },
  checkboxAllCheck: function () {
    var data = this.data.listData;
    var equip = [];
    for (var i = 0; i < data.length; i++) {
      data[i].IsChecked = true;
      equip.push(data[i].Equip);
    }

    this.setData({
      listData: data
    });
    wx.setStorageSync('TempHistoryGraphEquipFilter', equip);
  },
  makeEquipObject: function (data){
    data = data || [];
    var equipDefault = wx.getStorageSync('TempHistoryGraphEquipFilter');
    var equip = [];
    var initialSelected = [];
    for (var i = 0; i < data.length; i++) {
      var e: Record<string, any> = {
        Equip: data[i],
        EquipText: data[i].indexOf('H20') < 0 ? data[i] : 'H20'
      };
      
      var bIsChecked = false;
      if (equipDefault != null && equipDefault != '') {
        if(equipDefault.indexOf(data[i]) >= 0){
          bIsChecked = true;
        }
      } else {
        bIsChecked = true;
      }

      e.IsChecked = bIsChecked;
      if (bIsChecked) {
        initialSelected.push(data[i]);
      }
      equip.push(e);
    }
    if (equipDefault == null || equipDefault === '') {
      wx.setStorageSync('TempHistoryGraphEquipFilter', initialSelected);
    }
    
    return equip;
  },
  onLoad: function (options) {
    wx.showLoading();

    var data = this.makeEquipObject(JSON.parse(options.data));
    
    console.log('Datafilter',data);
    this.setData({
      listData: data
    });

    setTimeout(function () {
      wx.hideLoading()
    }, 2000);
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
    var equip = wx.getStorageSync('TempHistoryGraphEquipFilter');
    if (equip == null || equip == '' || equip.length === 0) {
      var equipDefault = wx.getStorageSync('HistoryGraphEquipFilterDefault');
      if (equipDefault && equipDefault.length > 0) {
        wx.setStorageSync('TempHistoryGraphEquipFilter', equipDefault);
      }
    }
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
