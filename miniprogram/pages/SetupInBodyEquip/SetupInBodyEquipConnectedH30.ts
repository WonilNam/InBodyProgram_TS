
Page({
  data: {
    imgSrc: "/images/setting_img_inbodydialH30.png",
    equip: "H30",
  },

  confirm: function (e) {
    wx.redirectTo({
      url: "/pages/SetupInBodyEquip/SetupInBodyEquipTutorialH30",
    });
  },
  onLoad: function (options) {
    var equip = wx.getStorageSync("ConnectEquip");
    if (equip == "H30") {
      this.setData({
        imgSrc: "/images/setting_img_inbodydialH30.png",
        equip: "H30",
      });
    } else if (equip == "H40") {
      this.setData({
        imgSrc: "/images/inBodyDialH40QuarterviewNoBg (non-optimized).png",
        equip: "H40",
      });
    }
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function () {},

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {},

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

