
Page({
  data: {
    viewType: "",
    SSID: "",
    imgSrc: "/images/inBodyDialH30Lcd.png",
    title: "",
  },

  continuedUse: function (e) {
    wx.redirectTo({
      url: "/pages/SetupInBodyEquip/SetupInBodyEquipTutorialH30?viewType=1",
    });
  },

  reset: function (e) {
    wx.navigateTo({
      url: "/pages/SetupInBodyEquip/SetupInBodyEquipWifiSearchH30?viewType=searching",
    });
  },

  onLoad: function (options) {
    const ssid = getApp().globalData.BluetoothH30.BTConf.ssid;
    if (wx.getStorageSync("ConnectEquip") == "H40") {
      this.setData({
        imgSrc: "/images/inBodyDialH40QuarterviewNoBg (non-optimized).png",
        title: "InBodyDial H40",
      });
    } else {
      this.setData({
        imgSrc: "/images/setting_img_inbodydialH30.png",
        title: "InBodyDial H30",
      });
    }
    this.setData({
      SSID: ssid,
    });
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function () {},

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {
    console.log("onShow");
    wx.hideHomeButton();
  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {},

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload: function () {},

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh: function () {},

  /**
   * Called when page reach bottom
   */
  onReachBottom: function () {},

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage: function () {},
});

