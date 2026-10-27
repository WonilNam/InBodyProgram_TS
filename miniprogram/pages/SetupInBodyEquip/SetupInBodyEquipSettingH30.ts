
Page({
  data: {
    AKResponse: {
      serialNumber: "", //设备的序列号
      programVersion: "", //设备的程序版本
      wifiStatus: 0, //Wi-Fi 状态，表示设备连接的 Wi-Fi 状态
      ownerUID: "", //设备所有者的 UID
      ownerNickname: "", //设备所有者的昵称
      uidOverflow: 0, //UID 溢出标志，表示 UID 是否溢出
      ssid: "", //Wi-Fi 热点的SSID
      language: 0, //语言设置，表示设备的显示语言
      unit: 0, //单位设置，表示设备的计量单位
      sound: 0, //声音设置，表示设备的声音提示功能
      batteryVoltage: 0, //电池电压，表示设备的电池电压
      firmwareUpdatePossible: 0, //固件更新是否可行
      countrySetting: 0, //国家设置，表示设备所在国家/地区的设置
      wifiUsageVariable: 0, //可否Wi-Fi 使用变量
    },
    showMask: true,
    userCount: 0,
    unitKg: true,
    SettingCase: 0,
    soundOn: 1,
    isConnected: false,
    btnText: "查看教程",
    processCase: 0,
    title: "InBodyDial H30",
    imgSrc: "/images/setting_img_inbodydialH30.png",
  },

  moveTutorial: function (e) {
    if (!this.data.isConnected) {
      this.setData({
        showMask: true,
        processCase: 0,
        SettingCase: 0,
      });
      getApp().globalData.BluetoothH30.connectEquipSetting();
    } else {
      wx.navigateTo({
        url: "SetupInBodyEquipTutorialH30",
      });
    }
  },
  moveWifiSetting() {
    this.setData({
      SettingCase: 3,
    });
    getApp().globalData.BluetoothH30.connectEquipSetting();
  },
  setInfo(e) {
    console.log(e);

    if (e == false) {
      this.setData({
        showMask: false,
        isConnected: false,
        btnText: "重新连接",
      });
    } else {
      if (this.data.SettingCase == 3) {
        var ssid = this.data.AKResponse.ssid;
        ssid = ssid.trim();
        var wifiUsageVariable = this.data.AKResponse.wifiUsageVariable;
        if (ssid == "" || ssid == undefined) {
          wx.navigateTo({
            url: "SetupInBodyEquipWifiSearchH30?viewType=searching",
          });
        } else {
          wx.navigateTo({
            url:
              "SetupInBodyEquipWifiSearchH30?viewType=connected&ssid=" +
              ssid +
              "&wifiUsageVariable=" +
              wifiUsageVariable,
          });
        }
      } else {
        var AKResponse = e;
        AKResponse.ssid = AKResponse.ssid.replace(/\0/g, "");
        var userCount = getApp().globalData.BluetoothH30.userList.length;
        console.log(userCount);
        this.setData({
          AKResponse: AKResponse,
          showMask: false,
          userCount: userCount,
          isConnected: true,
          unitKg: AKResponse.unit == 0,
          btnText: "查看教程",
        });
      }
    }
  },
  switchChanged(e) {
    var flag = e.detail.value == true ? 1 : 0;
    this.setData({
      SettingCase: 0,
      soundOn: e.detail.value,
    });
    getApp().globalData.BluetoothH30.setSound(flag);
  },
  settingChanged(flag) {
    if (flag) {
      if (this.data.SettingCase == 1) {
        this.setData({
          unitKg: false,
        });
      } else if (this.data.SettingCase == 2) {
        this.setData({
          unitKg: true,
        });
      }
    } else {
      if (this.data.SettingCase == 0) {
        var soundOn = this.data.soundOn;
        this.setData({
          soundOn: !soundOn,
        });
      }
    }
  },
  initialize(e) {
    if (this.data.isConnected) {
      wx.navigateTo({
        url:
          "/pages/SetupInBodyEquip/SetupInBodyEquipInitializeH30?serialNumber=" +
          this.data.AKResponse.serialNumber,
      });
    }
  },
  disconnect() {
    wx.showModal({
      content: "删除当前的 InBody  设置吗?",
      success: (res: any) => {
        if (res.confirm) {
          wx.setStorageSync("MyEquipList", "");
          if (this.data.isConnected) {
            getApp().globalData.BluetoothH30.closeBLEConnection();
          }
          getApp().globalData.BluetoothH30.closeBluetoothAdapter();
          wx.reLaunch({
            url: "/pages/SetupInBodyEquip/SetupInBodyEquipList",
          });
        }
      },
    });
  },
  setInch(e) {
    if (this.data.unitKg == false) return;
    this.setData({
      SettingCase: 1,
    });
    getApp().globalData.BluetoothH30.setUnit(3);
  },
  setKg(e) {
    if (this.data.unitKg == true) return;
    this.setData({
      unitKg: true,
      SettingCase: 2,
    });
    getApp().globalData.BluetoothH30.setUnit(0);
  },
  onLoad: function (options) {
    if (wx.getStorageSync("ConnectEquip") == "H40")
      this.setData({
        title: "InBodyDial H40",
        imgSrc: "/images/setting_img_inbodydialH40.png",
      });
    else
      this.setData({
        title: "InBodyDial H30",
        imgSrc: "/images/setting_img_inbodydialH30.png",
      });
    getApp().globalData.BluetoothH30.setOnSettingBluetoothConnectedCallback(
      this.setInfo
    );
    getApp().globalData.BluetoothH30.setOnSettingChangedCallback(
      this.settingChanged
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
    this.setData({
      showMask: true,
      processCase: 0,
      SettingCase: 0,
    });

    getApp().globalData.BluetoothH30.connectEquipSetting();
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

