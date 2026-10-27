
const { getContainer } = require("../../../../src/application/AppContainer");
const defaultAvatarUrl =
  "https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0";

Page({
  data: {
    Height: "",
    Gender: "",
    Age: "",
    Gender_M: "",
    Gender_F: "",
    avatarUrl: defaultAvatarUrl,
    theme: wx.getAppBaseInfo().theme,
    Name: "",
    ImgBase64: "",
    changeImg: false,
  },
  onLoad: function (options) {
    wx.onThemeChange((result: any) => {
      this.setData({
        theme: result.theme,
      });
    });
    this.getInBodyUserInfo();
  },
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({
      avatarUrl,
    });
    this.base64(avatarUrl, "png").then((res: any) => {
      this.setData({
        ImgBase64: res,
        changeImg: true,
      });
    });
  },
  base64(url, type) {
    return new Promise((resolve, reject) => {
      wx.getFileSystemManager().readFile({
        filePath: url,
        encoding: "base64",
        success: (res: any) => {
          resolve(res.data);
        },
        fail: (res: any) => reject(res.errMsg),
      });
    });
  },
  getInBodyUserInfo: function () {
    var UID = String(getApp().globalData.UID || "");
    getContainer()
      .authService.refreshMemberProfile(UID)
      .then(() => {
        var page = getCurrentPages().pop();
        var localUserinfo = wx.getStorageSync("InBodyUserInfo") || {};
        var gender = localUserinfo.Gender || "";
        var height = localUserinfo.Height || "";
        var age = localUserinfo.Age || "";
        var avatarUrl = localUserinfo.UserPIcon || localUserinfo.avatarUrl || defaultAvatarUrl;

        page.setData({
          Height: height,
          Gender: gender,
          Age: age,
          Gender_M: gender == "M" ? "true" : "",
          Gender_F: gender == "F" ? "true" : "",
          Name: localUserinfo.Name || "",
          avatarUrl: avatarUrl,
        });
      });
  },
  formValidate: function (data) {
    var check = true;
    var message = "";
    if (data.Name == "") {
      check = false;
      message = "请输入昵称";
    } else if (data.Gender == "") {
      check = false;
      message = "请选择性别";
    } else if (data.Height === "" || data.Height < 50 || data.Height > 300) {
      check = false;
      message = "请确认身高(50-300cm)";
    } else if (data.Age === "" || data.Age < 1 || data.Age > 99) {
      check = false;
      message = "请确认年龄(1-99岁)";
    }

    if (check == false) {
      wx.showModal({
        content: message,
        showCancel: false,
      });
    }

    return check;
  },
  formSubmit: function (e) {
    var Age = Number(e.detail.value.txtAge);
    var Gender = e.detail.value.rbGender;
    var Height = e.detail.value.txtHeight;
    var TelHP = getApp().globalData.InBodyUserInfo.TelHP || "";
    var UserID = TelHP.substring(TelHP.length - 4, TelHP.length);
    var Name = e.detail.value.txtName;
    var UserNickName = UserID;
    var LoginPW = "temppw";
    var Weight = "";
    var CountryCode = "86";
    var today = new Date();
    var month: number | string = today.getMonth() + 1;
    var avatarUrl = this.data.avatarUrl;

    if (month < 10) month = "0" + month;

    var BirthDay =
      today.getFullYear() - Age + "-" + month + "-" + today.getDate();

    var data = {
      Type: "MODIFY",
      UID: getApp().globalData.UID,
      UserID: UserID,
      TelHP: TelHP,
      LoginPW: LoginPW,
      Name: Name,
      UserNickName: UserNickName,
      BirthDay: BirthDay,
      Age: Age,
      Gender: Gender,
      Height: Height,
      Weight: Weight,
      CountryCode: CountryCode,
      UserPIcon: avatarUrl,
    };

    if (this.formValidate(data)) {
      if (this.data.changeImg) {
        this.SaveUserImg(this.data.ImgBase64);
      }
      this.SaveUserInfo(data);
    }
  },
  SaveUserInfo: function (data) {
    var that = this;
    getContainer()
      .authService.updateMemberProfile(data, false)
      .then(function () {
        getApp().globalData.InBodyUserInfo.Age = data.Age;
        getApp().globalData.InBodyUserInfo.Gender = data.Gender;
        getApp().globalData.InBodyUserInfo.Height = data.Height;
        getApp().globalData.InBodyUserInfo.Name = data.Name;
        getApp().globalData.InBodyUserInfo.UserPIcon = data.UserPIcon;
        if (!that.data.changeImg) {
          getApp().globalData.InBodyUserInfo.avatarUrl = data.UserPIcon;
          wx.setStorageSync("avatarUrl", data.UserPIcon);
        }
        wx.setStorageSync("InBodyUserInfo", getApp().globalData.InBodyUserInfo);
        wx.setStorageSync("avatarName", data.Name);
        wx.showModal({
          content: "更改内容已保存",
          showCancel: false,
          success: function (res: any) {
            if (res.confirm) {
              var page = getCurrentPages().pop();
              page.getInBodyUserInfo();
              wx.redirectTo({
                url: "/pages/HealthReportMain/HealthReportMain",
              });
            }
          },
        });
      })
      .catch(function (error: any) {
        wx.showToast({ title: error.message || '资料保存失败，请重试', icon: 'none' });
      });
  },
  SaveUserImg: function (imgBase64) {
    var uid = String(getApp().globalData.UID || "");
    getContainer()
      .authService.uploadUserPhoto(uid, imgBase64)
      .catch(() => {});
  },
});

// Marks this file as a module so top-level names do not collide with other page scripts.
export {};
