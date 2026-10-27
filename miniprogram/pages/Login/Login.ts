
//index.js
//获取应用实例
const app = getApp()

Page({
  data: {
  },
  getPhoneNumber:function(e){
    console.log('getphoneNumber',e);
    console.log(e.detail.errMsg)
    console.log(e.detail.iv)
    console.log(e.detail.encryptedData)
  },
  onLoad: function () {
    //wx.navigateTo({
    //  url: '../barGraph/barGraph'
    //})
   wx.login({
      success: (res: any) => {
        if (res.code) {

          var url = getApp().globalData.serverUrl + '/main_v3/GetWechatSession'
          console.log(url);
          //Initiate network request
          wx.request({
            method: 'POST',
            data: { "Code": res.code },
            url: url,
            success: function (res: any) {
              //여기 인증 코드 들어오면 정상적으로 구동됨 openid, session key 서버로 부터 받음. sesstion key를 이용해서 작업 해야함.
              console.log('success:', res)
            }, fail: function (res: any) {
              console.log('fail:', res)
            }
          })
        } else {
          console.log('Failed to obtain user login status!' + res.errMsg)
        }
      }
    })

    wx.getUserInfo({
      success: (res: any) => {
      console.log('getUserInfo',res);
        app.globalData.userInfo = res.userInfo
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
      }
    })

    wx.getSetting({
      success: (res: any) => {
        console.log('getSetting',res)
        if (!res.authSetting['scope.userInfo']){
        wx.authorize({
          scope: 'scope.userInfo',
          success() {
            // 用户已经同意小程序使用录音功能，后续调用 wx.startRecord 接口不会弹窗询问
            //wx.startRecord()
            console.log("getSetting")
          }
        })
      }
        wx.checkSession({
          success: function () {
            console.log('sesstion true')
            //"session_key" has not expired and remains valid during this life cycle
          },
          fail: function () {
            console.log('sesstion false')
            // "session_key" has expired, and the login process has to be re-run
            wx.login() //re-login
          }
        })
        if (res.authSetting['scope.userInfo']) {
          // 已经授权，可以直接调用 getUserInfo 获取头像昵称，不会弹框
          wx.getUserInfo({
            success: (res: any) => {
              // 可以将 res 发送给后台解码出 unionId
              getApp().globalData.userInfo = res.userInfo

              // 由于 getUserInfo 是网络请求，可能会在 Page.onLoad 之后才返回
              // 所以此处加入 callback 以防止这种情况
              if (this.userInfoReadyCallback) {
                this.userInfoReadyCallback(res)
              }
            }
          })
        }
      }
    })
  
   // this.InBodyLogin();
  },
  InBodyLogin: function () {
    var LoginID = "01091675300";
    var LoginPW = "inbody0515";

    wx.request({
      method: 'POST',
      url: getApp().globalData.serverUrl + '/main/GetLoginWithSyncDataPart',
      data: { LoginID: LoginID, LoginPW: LoginPW },
      success: function (res: any) {
        console.log(res);
      }
    });
  }
})

// Marks this file as a module so top-level names do not collide with other page scripts.
export {};
