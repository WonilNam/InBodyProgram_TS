
import { alertSetupFailure, getH30Setup } from "../../src/application/services/H30Setup";

Page({
  data: {
    viewType: "searching",
    topText: "开始注册",
    btnText: "是，已经开启",
    tipText: "请确认设备电源是否已打开",
    isPageShow: false,
    equip: "InBodyDial H30",
    imgSearchSrc: "/images/img_h_30_search_360_270.png",
  },

  connectEquip: async function () {
    if (this.searching) return;
    this.searching = true;
    this.setData({
      topText: "搜索中",
      tipText: "即使Dial屏幕未开启也可搜索到设备。",
      viewType: "searching",
    });
    try {
      const h30 = getH30Setup();
      await h30.connect();
      await h30.loadUsers();
    } catch (error) {
      console.error("设备连接失败", error);
      this.searching = false;
      await alertSetupFailure();
      this.ConnectFail();
      return;
    }
    this.searching = false;
    this.ConnectedEquip();
  },

  ConnectFail: function (e) {
    this.setData({
      viewType: "original",
      topText: "开始注册",
      btnText: "是，已经开启",
      tipText: "请确认设备电源是否已打开",
    });
  },

  ConnectedEquip: function () {
    this.setData({
      viewType: "connected",
    });
    wx.navigateTo({
      url: "/pages/SetupInBodyEquip/SetupInBodyEquipNickNameH30",
    });
  },

  onLoad: function (options) {
    var viewType = options.viewType;
    console.log(viewType);
    var equip = options.equip;
    if (equip == "InBodyDial H40") {
      this.setData({
        imgSearchSrc: "/images/imgH40Search.png",
      });
    }
    this.setData({
      equip: equip,
    });

    console.log(equip);
    if (viewType == "connecting") {
      this.setData({
        topText: "连接中",
        tipText: "即使Dial屏幕未开启也可搜索到设备",
        viewType: "connecting",
      });
    }

    // var screenHeight;
    // wx.getSystemInfo({
    //     success(res){
    //         console.log(res.screenHeight);
    //         screenHeight = res.screenHeight;
    //     }
    // })
    // this.setData({
    //     screenHeight:screenHeight,
    // })
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function () {},

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {
    if (this.data.viewType == "connecting") {
      this.setData({
        topText: "连接中",
        tipText: "即使Dial屏幕未开启也可搜索到设备",
        viewType: "connecting",
        isPageShow: true,
      });
    } else {
      this.setData({
        viewType: "original",
        topText: "开始注册",
        btnText: "是，已经开启",
        tipText: "请确认设备电源是否已打开",
        isPageShow: true,
      });
    }
  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {
    this.setData({
      viewType: "original",
    });
  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload: function () {
    if (this.data.viewType != "connected") void getH30Setup().disconnect();
  },

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

