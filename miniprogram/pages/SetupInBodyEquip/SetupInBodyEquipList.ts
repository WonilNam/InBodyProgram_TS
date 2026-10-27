
// pages/SetupInBodyEquip/SetupInBodyEquipList.js
Page({
  /**
   * Page initial data
   */
  data: {
    viewType: "",
    listItem: [
      {
        id: "H20B",
        title: "InBodyDialH20",
        sub: "与智能手机兼容的家庭\n用人体成分分析仪",
        img: "setting_img_inbodydialH20_bluetooth.png",
      },
      {
        id: "H30",
        title: "InBodyDialH30",
        sub: "与智能手机兼容的家庭\n用人体成分分析仪",
        img: "setting_img_inbodydialH30.png",
      },
      {
        id: "H40",
        title: "InBodyDialH40",
        sub: "与智能手机兼容的家庭\n用人体成分分析仪",
        img: "setting_img_inbodydialH40.png",
      },
      {
        id: "InBody120",
        title: "InBody120体成分分析仪",
        sub: "适用于个体机构的快速便捷型\n人体成分分析仪",
        img: "setting_img_inbody120_bluetooth.png",
      },
    ],
    showLoginDialog: false,
  },

  handleConfirmLogin: function () {
    this.setData({
      showLoginDialog: false,
    });
    wx.navigateTo({
      url: "/pages/Login/GetTelHPComponent",
    });
  },

  handleCancelLogin: function () {
    this.setData({
      showLoginDialog: false,
    });
  },

  selectEquip: function (e) {
    var uid = getApp().globalData.UID;
    if (uid == null || uid == "") {
      this.setData({
        showLoginDialog: true,
      });
      return;
    }

    var userInfo = getApp().globalData.InBodyUserInfo;
    if (
      userInfo.Height == null ||
      userInfo.Height == "" ||
      userInfo.Height == "undefined" ||
      userInfo.Age == null ||
      userInfo.Age == "" ||
      userInfo.Age == "undefined" ||
      userInfo.Gender == null ||
      userInfo.Gender == "" ||
      userInfo.Gender == "undefined"
    ) {
      wx.navigateTo({
        url: "/pages/compo/pages/SetupUserModify/UserModify",
      });
      return;
    }
    var selVal = e.currentTarget.id;
    console.log(selVal);
    if (selVal == "H30" || selVal == "H40") {
      wx.setStorageSync("ConnectEquip", selVal);
      if (selVal == "H30") {
        wx.redirectTo({
          url: "/pages/SetupInBodyEquip/SetupInBodyEquipConnectH30?equip=InBodyDial H30",
        });
      } else {
        wx.redirectTo({
          url: "/pages/SetupInBodyEquip/SetupInBodyEquipConnectH30?equip=InBodyDial H40",
        });

        // wx.redirectTo({
        //   url: "/pages/SetupInBodyEquip/SetupInBodyEquipConnectedH30",
        // });
      }
    } else {
      this.successConnect(selVal);
    }
  },
  successConnect: function (equip) {
    var viewType = this.data.viewType;
    console.log(viewType);
    wx.showModal({
      content: "InBody 设置完成。",
      showCancel: false,
      confirmText: "确认",
      success: function () {
        wx.setStorageSync("MyEquipList", [equip]);
        if (viewType == "Setup") {
          wx.redirectTo({
            url: "/pages/SetupInBodyEquip/SetupInBodyEquipMy?view=Setup",
          });
        } else {
          wx.navigateBack({
            delta: 1,
          });
        }
      },
    });
  },
  checkRegistsEquip: function () {
    var listItem = this.data.listItem;
    var myEquip = wx.getStorageSync("MyEquipList");
    for (var i = 0; i < myEquip.length; i++) {
      for (var j = 0; j < listItem.length; j++) {
        console.log(myEquip[i].id, listItem[j].id);
        if (myEquip[i].id == listItem[j].id) {
          listItem.splice(j, 1);
          break;
        }
      }
    }
    console.log(listItem);
    this.setData({
      listItem: listItem,
    });
  },
  onLoad: function (options) {
    var view = options.view;

    var that = this;
    wx.getStorage({
      key: "MyEquipList",
      success: (res: any) => {
        var myEquip = res.data;
        if (myEquip > 0) {
          that.setData({
            viewType: view,
            listItem: [
              {
                id: "H20B",
                title: "InBody智能体脂秤",
                sub: "设置已保存",
                img: "setting_img_inbodydial_bluetooth.png",
              },
            ],
          });
        }
      },
      fail: (res: any) => {
        //that.setCheckInBodyData();
      },
      complete: () => {
        that.setData({
          viewType: view,
        });
      },
    });

    /*if (view == 'Setup'){
          this.checkRegistsEquip();
          if (this.data.listItem.length == 0){
            wx.showToast({
              title: '설정할 장비가 없습니다.',
              icon: 'none',
              duration: 2000
            })
            wx.navigateBack({
              delta: 1
            })
          }
        }*/
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function () {},

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {},

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

