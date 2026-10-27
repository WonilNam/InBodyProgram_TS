
// pages/InBodyCommunity/InBodyCommunity.js
const app = getApp();
const serverUrl = "https://chncommunity.lookinbody.cn/";
const serverUrlAPI = "https://chncommunityapi.lookinbody.cn/api/Community";
const betaUrl = "https://communitychnbeta.lookinbody.cn/";

Page({
  /**
   * 页面的初始数据
   */
  data: {
    url: "",
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
    var that = this;
    var localUserinfo = wx.getStorageSync("InBodyUserInfo");
    var avartarUrl = wx.getStorageSync("avatarUrl") ?? "";
    var nickName = wx.getStorageSync("avatarName") ?? "";
    var telHP = wx.getStorageSync("UserTelHP");
    var uid = getApp().globalData.UID ?? "";
    console.log(
      "avatarUrl==",
      avartarUrl,
      "==nickname==",
      nickName,
      "==telHP===",
      telHP,
      "==uid==",
      uid
    );
    var webUrl = serverUrl + uid;
    console.log("weburl===", webUrl);
    that.setData({
      url: webUrl,
    });
    if (uid != "") {
      wx.request({
        method: "GET",
        url: serverUrlAPI + "/" + uid,
        success: (res: any) => {
          console.log("has data", res);
          if (res.statusCode == 404) {
            that.sendMsgToWeb(avartarUrl, nickName, telHP, uid);
          } else if (
            (res.data.avartarUrl != avartarUrl ||
              res.data.nickName != nickName) &&
            avartarUrl != "" &&
            nickName != ""
          ) {
            that.updateData(avartarUrl, nickName, telHP, uid);
          }
        },
        fail: function (res: any) {
          console.log("has no data", res);
          that.sendMsgToWeb(avartarUrl, nickName, telHP, uid);
        },
      });
    }
  },

  sendMsgToWeb: function (avartarUrl, nickName, telHP, uid) {
    var data = {
      uid: uid,
      customKey: "",
      appVersion: "",
      languageCode: "zh-cn",
      avartarUrl: avartarUrl,
      nickName: nickName,
      telHP: telHP,
    };

    wx.request({
      method: "POST",
      url: serverUrlAPI,
      data: data,
      success: (res: any) => {
        console.log("requestToWeb success", res);
      },
      fail: function (res: any) {
        console.log("requestToWeb fail", res);
      },
    });
  },

  updateData: function (avartarUrl, nickName, telHP, uid) {
    var putData = {
      customKey: "",
      appVersion: "",
      languageCode: "zh-cn",
      avartarUrl: avartarUrl,
      nickName: nickName,
      telHP: telHP,
    };
    wx.request({
      method: "PUT",
      url: serverUrlAPI + "/" + uid,
      data: putData,
      success: (res: any) => {
        console.log("change data success", res);
      },
      fail: function (res: any) {},
    });
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {},

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {},

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {},

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {},

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {},

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {},

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {},
});

// Marks this file as a module so top-level names do not collide with other page scripts.
export {};
