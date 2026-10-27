
// pages/Login/PrivateAgreementComponent.js
Component({
    /**
     * 组件的属性列表
     */

    /**
     * 组件的方法列表
     */
    methods: {


        OnDisagreed: function (e) {
          this.triggerEvent('disagreedpolicyevent', {}, {})
          },
          getTelHPFromServer:function (iv, eData){
            var that = this;
            wx.login({
              success: (res: any) => {
                if (res.code) {
                  wx.request({
                    method: 'POST',
                    data: { LoginID: eData, LogCode: iv, Code: res.code },
                    url: getApp().globalData.serverUrl + '/main_v3/GetWeChatTelHP',
                    success: function (res: any) {
                      console.log(res);
                      var data = res.data.Data;
                      try{
                        console.log(data)
                        var phone = JSON.parse(data.PhoneNumber);
                        var session = JSON.parse(data.Session);
                        console.log('call', phone, session)
                        that.triggerEvent('agreedpolicyevent', { TelHP: phone.purePhoneNumber, OpenID: session.openid }, {})
                      } catch(e){
                        wx.showModal({
                          content: '手机号码获取失败，请重新尝试。',
                          showCancel: false,
                          success: function (res: any) {
                            if (res.confirm) {
                              
                            }
                          }
                        })
                      }
                    }, fail: function (res: any) {
                      wx.showModal({
                        content: '手机号码获取失败，请重新尝试。',
                        showCancel: false,
                        success: function (res: any) {
                          if (res.confirm) {
                          }
                        }
                      })
                    }
                  })
                } else {
                  console.log('Failed to obtain user login status!' + res.errMsg)
                }
              }
            })
          },
          getPhoneNumber: function (e) {
            this.setData({
              repeatCount: 0,
            })
            console.log(e.detail.errMsg)
            var iv = e.detail.iv;
            var eData = e.detail.encryptedData;
            console.log(iv, eData);
            if (e.detail.errMsg == 'getPhoneNumber:ok'){
              this.getTelHPFromServer(iv, eData);
            }
            else { //授权通过执行跳转
              console.log("a");
              var that = this;
              wx.showModal({
                content: '不能自动获取手机号码，请重试。',
                success: function (res: any) {
                  if (res.confirm) {
                  } else{
                    wx.showModal({
                      content: '手机号码需要验证完成后，才可以使用InBody 小程序。',
                      showCancel: false,
                      success: function (res: any) {
                        if (res.confirm) {
      
                        }
                      }
                    })
                  }
                }
              })
            }
            
          },
          
  

    }
})

