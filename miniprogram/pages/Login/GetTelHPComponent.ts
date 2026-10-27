import { loginAndNavigate } from "./LoginActions";
import { getContainer } from "../../src/application/AppContainer";

Component({
  properties: {},

  data: {
    repeatCount: 0,
    isAgreed: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo'),
  },

  methods: {
    checkAgreement(e: { currentTarget: { dataset: { manual?: string } } }) {
      if (!this.data.isAgreed) {
        wx.showModal({
          showCancel: false,
          content: '请阅读并勾选用户协议',
        });
      } else {
        if (e.currentTarget.dataset.manual == 'manual') {
          this.inputManualPhone();
        }
      }
    },
    getUserInfo(telHP: string, openid: string) { return loginAndNavigate(telHP, openid || ""); },
    getPhoneNumber: function (e: { detail: { iv: string; encryptedData: string; errMsg: string } }) {
      this.setData({
        repeatCount: 0,
      });
      var iv = e.detail.iv;
      var eData = e.detail.encryptedData;
      if (e.detail.errMsg == 'getPhoneNumber:ok') {
        this.getTelHPFromServer(iv, eData);
      } else {
        wx.showToast({
          title: '已取消手机号授权',
          icon: 'none',
          duration: 2000,
        });
      }
    },
    onRejectLogin: function () {
      var pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack({
          delta: 1,
        });
      } else {
        wx.reLaunch({
          url: '/pages/HealthReportMain/HealthReportMain',
        });
      }
    },
    inputManualPhone: function () {
      wx.redirectTo({
        url: '/pages/Login/InputTelHPComponent',
      });
    },

    getTelHPFromServer: function (iv: string, eData: string) {
      var that = this;
      wx.login({
        success: (res: { code?: string; errMsg?: string }) => {
          if (res.code) {
            getContainer()
              .authService.decryptWeChatPhone(eData, iv, res.code)
              .then(({ telHP, openId }) => {
                that.getUserInfo(telHP, openId);
              })
              .catch(() => {
                wx.showModal({
                  content: '手机号码获取失败，请重新尝试。',
                  showCancel: false,
                });
              });
          } else {
            console.log('Failed to obtain user login status!' + res.errMsg);
          }
        },
      });
    },
    checkBoxChange: function () {
      this.setData({
        isAgreed: !this.data.isAgreed,
      });
    },
  },
});


