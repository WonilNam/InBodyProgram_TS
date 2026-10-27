
// pages/ViewMoreMain/WebViewInBodyAppDown.js
Page({
  /**
   * Page initial data
   */
  data: {
    isAndroid: false,
    apkUrl: "https://inbodychn.blob.core.chinacloudapi.cn/inbodychina-apk/InBody_app.apk",
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    const device = typeof wx.getDeviceInfo === "function"
      ? wx.getDeviceInfo()
      : (typeof wx.getSystemInfoSync === "function" ? wx.getSystemInfoSync() : {});
    this.setData({ isAndroid: String(device.platform || "").toLowerCase() === "android" });
  },
  copyDownloadUrl: function () {
    wx.setClipboardData({
      data: this.data.apkUrl,
      success: () => wx.showToast({ title: "已复制，请在浏览器打开", icon: "none" }),
      fail: () => wx.showToast({ title: "复制失败，请重试", icon: "none" }),
    });
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

