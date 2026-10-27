
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

  connectEquip: function (e) {
    console.log("searching");
    this.setData({
      topText: "搜索中",
      tipText: "即使Dial屏幕未开启也可搜索到设备。",
      viewType: "searching",
    });
    getApp().globalData.BluetoothH30.connectEquip();
    //getApp().globalData.BluetoothH30.startInBodyTest();
    // wx.navigateTo({
    //     url: '/pages/SetupInBodyEquip/SetupInBodyEquipWifiH30'
    //   });
  },

  ConnectFail: function (e) {
    this.setData({
      viewType: "original",
      topText: "开始注册",
      btnText: "是，已经开启",
      tipText: "请确认设备电源是否已打开",
    });
  },

  ConnectingEquip: function (e) {
    console.log("connecting!");
    this.setData({
      topText: "连接中",
      tipText: "即使Dial屏幕未开启也可搜索到设备。",
      viewType: "connecting",
    });
  },

  ConnectedEquip: function (e) {
    console.log("connected!");
    this.setData({
      viewType: "connected",
    });
    if (e == "measure") {
      wx.redirectTo({
        url: "/pages/SetupInBodyEquip/SetupInBodyEquipTestH30",
      });
    } else {
      wx.navigateTo({
        url: "/pages/SetupInBodyEquip/SetupInBodyEquipNickNameH30",
      });
    }
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
    getApp().globalData.BluetoothH30.setOnBluetoothConnectingCallback(
      this.ConnectingEquip
    );
    getApp().globalData.BluetoothH30.setOnBluetoothConnectedCallback(
      this.ConnectedEquip
    );
    getApp().globalData.BluetoothH30.setOnBluetoothConnectFailCallback(
      this.ConnectFail
    );
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
    console.log(this.data.viewType);
    if (this.data.viewType != "connected")
      getApp().globalData.BluetoothH30.closeBluetoothAdapter();
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

