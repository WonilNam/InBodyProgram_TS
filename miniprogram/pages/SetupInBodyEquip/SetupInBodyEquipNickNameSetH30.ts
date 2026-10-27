

Page({
  data: {
    viewType: "normal",
    nickName: "",
    title: "",
    imgSrc: "/images/inBodyDialH30Lcd.png",
  },

  confirmNickName: function (e) {
    console.log("Set NickName");
    let nickName = this.data.nickName;
    if (nickName == "") return;
    getApp().globalData.BluetoothH30.setOnSetNickNameCallback(this.wifiSearch);
    getApp().globalData.nickName = nickName;

    console.log(nickName);
    getApp().globalData.BluetoothH30.setNickName(nickName);
  },
  dr: function (e) {
    getApp().globalData.BluetoothH30.getMeasrementData();
  },
  ut0: function (e) {
    getApp().globalData.BluetoothH30.userDataTransfer(0);
  },
  ut1: function (e) {
    getApp().globalData.BluetoothH30.userDataTransfer(1);
  },
  dc: function (e) {
    getApp().globalData.BluetoothH30.confirmTransfer();
  },
  sv: function (e) {
    getApp().globalData.BluetoothH30.updateFirmware();
  },
  cota: function (e) {
    getApp().globalData.BluetoothH30.connectOTA();
  },
  stx: function (e) {
    getApp().globalData.BluetoothH30.startOTAWrite();
  },
  wota: function (e) {
    getApp().globalData.BluetoothH30.writeOTAFile();
  },
  etx: function (e) {
    getApp().globalData.BluetoothH30.endOTAWrite();
  },
  end: function (e) {
    getApp().globalData.BluetoothH30.closeBLEConnection();
  },
  dfu: function (e) {
    getApp().globalData.BluetoothH30.updateFirmwareFile();
  },
  ws: function (e) {
    getApp().globalData.BluetoothH30.wifiScan();
  },
  wi: function (e) {
    getApp().globalData.BluetoothH30.wifiSet();
  },
  wifiSearch: function (e) {
    let bWifiUsed = e == 1 ? true : false;
    if (bWifiUsed) {
      wx.redirectTo({
        url: "/pages/SetupInBodyEquip/SetupInBodyEquipWifiH30",
      });
    } else {
      wx.navigateTo({
        url: "/pages/SetupInBodyEquip/SetupInBodyEquipConnectedH30",
      });
    }
  },
  gfv: function (e) {
    getApp().globalData.BluetoothH30.getFirmwareVersion();
  },
  inputChange: function (e) {
    const inputValue = e.detail.value;
    const pattern = /^[A-Za-z0-9]*$/;
    if (!pattern.test(inputValue)) {
      this.setData({
        nickName: "",
        viewType: "error",
      });
    } else {
      this.setData({
        nickName: e.detail.value,
        viewType: "normal",
      });
    }
  },

  onLoad: function (options) {
    const nickName = wx.getStorageSync("nickName");
    const foundObject = getApp().globalData.BluetoothH30.userList.find(
      (obj: any) => obj.nickName.replace(/\u0000/g, "") === nickName
    );
    const exists = foundObject !== undefined;
    if (exists) {
      this.setData({
        title: "InBodyDial H30中" + nickName + "已被注册。",
        nickName: nickName,
      });
    } else {
      this.setData({
        title: "请在下方输入你的昵称。",
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
  onShow: function () {
    const nickName = wx.getStorageSync("nickName");

    const foundObject = getApp().globalData.BluetoothH30.userList.find(
      (obj: any) => obj.nickName.replace(/\u0000/g, "") == nickName
    );
    const exists = foundObject !== undefined;
    console.log(foundObject);
    if (exists && nickName != "") {
      this.setData({
        title: "InBodyDial H30中" + nickName + "已被注册。",
        nickName: nickName,
      });
    } else {
      this.setData({
        title: "请在下方输入你的昵称。",
      });
    }
    if (wx.getStorageSync("ConnectEquip") == "H40") {
      this.setData({
        imgSrc: "/images/inBodyDialH40Lcd.png",
      });
    } else {
      this.setData({
        imgSrc: "/images/inBodyDialH30Lcd.png",
      });
    }
  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {},

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload: function () {
    console.log("SetUnload");
    // wx.navigateBack({
    //     delta:1
    // })
  },

  SetNickName: function (e) {
    console.log("Set NickName finished!");
    wx.reLaunch({
      url: "/pages/SetupInBodyEquip/SetupInBodyEquipConnectedH30",
    });
  },
});

