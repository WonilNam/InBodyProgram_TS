
Page({
  data: {
    viewType: "",
    listItem: [],
    defaultItem: [
      {
        id: "H20B",
        title: "InBodyDialH20",
        sub: "设置已保存",
        img: "setting_img_inbodydialH20_bluetooth.png",
        btnText: "删除",
      },
      {
        id: "H30",
        title: "InBodyDialH30",
        sub: "设置已保存",
        img: "setting_img_inbodydialH30.png",
        btnText: "管理",
      },
      {
        id: "H40",
        title: "InBodyDialH40",
        sub: "设置已保存",
        img: "setting_img_inbodydialH40.png",
        btnText: "管理",
      },
      {
        id: "InBody120",
        title: "InBody120体成分分析仪",
        sub: "设置已保存",
        img: "setting_img_inbody120_bluetooth.png",
        btnText: "删除",
      },
    ],
  },
  setNewEquip: function (e) {
    var viewType = this.data.viewType;
    var myEquip = wx.getStorageSync("MyEquipList");
    var equip = {};
    if (Array.isArray(myEquip) && myEquip.length > 0) {
      equip = myEquip[0];
    } else if (typeof myEquip === "string" && myEquip) {
      equip = { id: myEquip };
    }
    wx.showModal({
      content: "同步新设备\n将删除当前的 InBody。\n按“是”继续设置。",
      success: function (res: any) {
        if (res.confirm) {
          wx.navigateTo({
            url:
              "/pages/SetupInBodyEquip/SetupInBodyEquipDetail?view=" +
              viewType +
              "&selectEquip=" +
              JSON.stringify(equip),
          });
        }
      },
    });
  },
  setDeleteEquip: function (e) {
    var viewType = this.data.viewType;
    var myEquip = wx.getStorageSync("MyEquipList");

    console.log(myEquip);
    var isH30orH40 = myEquip == "H30" || myEquip == "H40" || (Array.isArray(myEquip) && (myEquip.indexOf("H30") >= 0 || myEquip.indexOf("H40") >= 0));
    if (isH30orH40) {
      wx.navigateTo({
        url: "/pages/SetupInBodyEquip/SetupInBodyEquipSettingH30",
      });
    } else {
      wx.showModal({
        content: "删除当前的 InBody 设备设置吗?",
        success: function (res: any) {
          if (res.confirm) {
            wx.setStorageSync("MyEquipList", "");
            wx.redirectTo({
              url:
                "/pages/SetupInBodyEquip/SetupInBodyEquipList?view=" + viewType,
            });
          }
        },
      });
    }
  },
  setEquip: function (e) {
    var viewType = this.data.viewType;
    wx.navigateTo({
      url: "/pages/SetupInBodyEquip/SetupInBodyEquipList?view=" + viewType,
    });
  },
  comfirm: function (e) {
    wx.navigateBack({
      delta: 1,
    });
  },
  comfirmSetupMain: function (e) {
    var pages = getCurrentPages();
    if (pages && pages.length > 1) {
      wx.navigateBack({
        delta: 1,
      });
    } else {
      wx.redirectTo({
        url: "/pages/HealthReportMain/HealthReportMain",
      });
    }
  },
  onLoad: function (options) {
    var view = options.view;

    this.setData({
      viewType: view,
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
    var rawEquip = wx.getStorageSync("MyEquipList");
    var equipIds = [];
    if (Array.isArray(rawEquip)) {
      equipIds = rawEquip.map(function (item) {
        return typeof item === "object" && item ? item.id : item;
      });
    } else if (typeof rawEquip === "string" && rawEquip) {
      equipIds = [rawEquip];
    }
    var listItem = [];
    var defaultItem = this.data.defaultItem;
    console.log(defaultItem, rawEquip);
    for (var i = 0; i < defaultItem.length; i++) {
      for (var j = 0; j < equipIds.length; j++) {
        if (String(equipIds[j]) === defaultItem[i].id) {
          listItem.push(defaultItem[i]);
          break;
        }
      }
    }

    this.setData({
      listItem: listItem,
    });
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

