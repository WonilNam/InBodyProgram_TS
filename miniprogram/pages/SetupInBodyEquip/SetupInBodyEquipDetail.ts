
// pages/SetupInBodyEquip/SetupInBodyEquipDetail.js
Page({

  /**
   * Page initial data
   */
  data: {
    viewType: '',
    IsHideButton: false,
    BtnText:'설정',
    HelpText: '인바디의 전원을 켜고 설정 버튼을 누르세요. 현재 인바디가 곁에 없을 경우, 건너뛰기 버튼을 누르세요.', 
    HelpColor:'#000000',
    selectEquip: {}
  },
  skipSet: function (e) {
    var that = this;
    var equip = this.data.selectEquip;
    var viewType = this.data.viewType;
    wx.showModal({
      title: '',
      content: '인바디 설정을 위해 필요한 연결절차를 건너뛰었습니다. 앱 사용 중에 인바디 연결을 하면 설정이 마무리 됩니다.',
      showCancel: false,
      confirmText: '확인',
      success: function () {
        wx.setStorageSync('MyEquipList', [equip]);
        if (viewType == 'Setup') {
          wx.redirectTo({
            url: '/pages/SetupInBodyEquip/SetupInBodyEquipMy?view=' + viewType
          });
        } else {
          wx.navigateBack({
            delta: 1
          });
        }
      }
    })
  },
  setEquip: function (e) {
    var that = this;
    that.connectEquip();
  },
  //인바디 장비 연결
  connectEquip:function (){
    var that = this;
    wx.showLoading({
      title: '인바디 설정중',
      mask:true,
    });
    
    setTimeout(function (){
      wx.hideLoading();

      that.successConnect();
      //that.failConnect();
    }, 2000);
  },
  successConnect:function(){
    var equip = this.data.selectEquip;
    var viewType = this.data.viewType;
    wx.showModal({
      content: '인바디 설정이 완료되었습니다.',
      showCancel: false,
      confirmText: '확인',
      success: function () {
        wx.setStorageSync('MyEquipList', [equip]);
        if (viewType == 'Setup') {
          wx.redirectTo({
            url: '/pages/SetupInBodyEquip/SetupInBodyEquipMy?view=' + viewType
          });
        } else {
          wx.navigateBack({
            delta: 1
          });
        }
      }
    })
  },
  failConnect:function(){
    var that = this;
    wx.showModal({
      title: '',
      content: '인바디를 찾을 수 없습니다. 인바디의 전원이 켜져 있는지 확인한 후 다시시도 버튼을 누르세요.',
      showCancel: false,
      confirmText: '확인',
      success: function () {
        that.setData({
          IsHideButton: false,
          HelpText: '인바디를 찾을 수 없습니다. 인바디의 전원이 켜져 있는지 확인한 후 다시시도 버튼을 누르세요.',
          HelpColor:'#AE2424',
          BtnText: '다시시도',
        });
      }
    })
  },
  onLoad: function (options) {
    var view = options.view;
    var equip = options.equip;
    if(equip != null && equip != ''){
      equip = JSON.parse(equip);
    }
    this.setData({ viewType: view, selectEquip: equip });
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function () {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {

  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload: function () {

  },

  /**
   * Page event handler function--Called when user drop down
   */
  onPullDownRefresh: function () {

  },

  /**
   * Called when page reach bottom
   */
  onReachBottom: function () {

  },

  /**
   * Called when user click on the top right corner to share
   */
  onShareAppMessage: function () {

  }
})
