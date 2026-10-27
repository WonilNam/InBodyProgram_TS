
import { alertSetupFailure, getH30Setup, showSetupBusy } from "../../src/application/services/H30Setup";

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

  // Connects (or re-reads the device if already connected), then shows its status.
  async loadDevice() {
    showSetupBusy();
    let status;
    try {
      status = await getH30Setup().refresh();
    } catch (error) {
      console.error("设备连接失败", error);
      wx.hideLoading();
      await alertSetupFailure();
      this.setInfo(false);
      return;
    }
    wx.hideLoading();
    this.setInfo(status);
  },

  // Writes one device setting. A failure drops back to the reconnect state, as before.
  async applySetting(change: { unit?: number; sound?: number }) {
    try {
      await getH30Setup().applySetting(change);
    } catch (error) {
      console.error("设置写入失败", error);
      await alertSetupFailure();
      this.setInfo(false);
      return;
    }
    this.settingChanged(true);
  },

  moveTutorial: function (e) {
    if (!this.data.isConnected) {
      this.setData({
        showMask: true,
        processCase: 0,
        SettingCase: 0,
      });
      this.loadDevice();
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
    this.loadDevice();
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
        var userCount = getH30Setup().userList.length;
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
    this.applySetting({ sound: flag });
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
          void getH30Setup().disconnect();
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
    this.applySetting({ unit: 3 });
  },
  setKg(e) {
    if (this.data.unitKg == true) return;
    this.setData({
      unitKg: true,
      SettingCase: 2,
    });
    this.applySetting({ unit: 0 });
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

    this.loadDevice();
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

