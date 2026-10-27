
Page({
  data: {
    imgSrc: "/images/nickname_example_EN.png",
  },

  addNickName: function (e) {
    // getApp().globalData.BluetoothH30.deleteUser();
    wx.redirectTo({
      url: "SetupInBodyEquipNickNameSetH30",
    });
  },

  onLoad: function (options) {
    var equip = wx.getStorageSync("ConnectEquip");

    if (equip == "H30") {
      this.setData({
        imgSrc: "/images/nickname_example_EN.png",
      });
    } else if (equip == "H40") {
      this.setData({
        imgSrc: "/images/imgH40NicknameEn.png",
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

