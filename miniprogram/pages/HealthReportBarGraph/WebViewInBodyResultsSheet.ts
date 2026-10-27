
import { getContainer } from "../../src/application/AppContainer";
// pages/HealthReportBarGraph/WebViewInBodyResultsSheet.js
Page({

  /**
   * Page initial data
   */
  data: {
    key:'',
    imgurl: '',
    status:false
  },

  /**
   * Lifecycle function--Called when page load
   */
  onLoad: function (options) {
    console.log("options",options.key);
    var that = this;
    /*wx.showLoading({ mask: false, title: '加载中', });
    this.setData({
      key : options.key,
      imgurl: getApp().globalData.serverUrl +"/inbody_v3/GetResultsSheetImage?UID_DATETIMES=" + options.key+"&CountryCode=86&Language=CN&Unit=1"
    })
  
    setTimeout(function () {
      wx.hideLoading()
    }, 3000);*/
    
    wx.getImageInfo({
      src: getContainer().reportService.getResultsSheetUrl(options.key),
      success: function (res: any) {
        console.log(res)
        that.setData({
          imgurl: res.path,
        })
        wx.hideLoading();
      },fail:function(res: any)
      {
        wx.showModal({
          title: 'InBody',
          content: 'InBody 报告纸出错',
          showCancel: false,
          complete: (e: any) => {
          }
        });
        wx.hideLoading();
      }
    })
   
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

  },

  //点击弹出弹窗
  showdialog: function() {
    this.setData({
      status:true
    })
  },
  handlecancel(){
    this.setData({
      status:false
    })
  },

  // 保存图片到系统相册
  saveImg: function() {
    this.setData({
      status:false
    })
    wx.saveImageToPhotosAlbum({
      filePath: this.data.imgurl,
      success: (res: any) => {
        wx.showToast({
          title: '保存成功',
          icon: "success"
        })
      },
      fail: (res: any) => {
        wx.openSetting({
          success: (settingdata: any) => {
            if (settingdata.authSetting['scope.writePhotosAlbum']) {
              console.log('获取权限成功，给出再次点击图片保存到相册的提示。')
            } else {
              console.log('获取权限失败，给出不给权限就无法正常使用的提示')
            }
          },
          fail: (error: any) => {
            console.log(error)
          }
        })
        wx.showModal({
          title: '提示',
          content: '保存失败，请确保相册权限已打开',
        })
      }
    })
  }
})
