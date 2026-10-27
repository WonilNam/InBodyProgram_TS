

import { alertSetupFailure, getH30Setup, showSetupBusy } from "../../src/application/services/H30Setup";

Page({
  data: {
    viewType: "normal",
    nickName: "",
    title: "",
    imgSrc: "/images/inBodyDialH30Lcd.png",
  },

  confirmNickName: async function () {
    const nickName = this.data.nickName;
    if (nickName == "" || this.registering) return;
    this.registering = true;
    getApp().globalData.nickName = nickName;
    showSetupBusy();
    let status;
    try {
      status = await getH30Setup().register(nickName);
    } catch (error) {
      console.error("昵称注册失败", error);
      wx.hideLoading();
      this.registering = false;
      await alertSetupFailure();
      return;
    }
    wx.hideLoading();
    this.registering = false;
    wx.setStorageSync("MyEquipList", wx.getStorageSync("ConnectEquip") == "H40" ? "H40" : "H30");
    wx.setStorageSync("nickName", nickName);
    this.wifiSearch(status.wifiUsageVariable);
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
    const foundObject = getH30Setup().userList.find(
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

    const foundObject = getH30Setup().userList.find(
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

