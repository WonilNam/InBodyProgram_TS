
Page({
  data: {
    viewType: 1,
    tiltText: "1.添加新用户，请保存便于识别的昵称。",
    tiltToText: "屏幕显示0.0kg时，站上秤面。",
    imgSrc: "Tutorial_1_EN.png",
    imgList: ["Tutorial_4_EN1.png", "Tutorial_4_EN2.png"],
    timerFlag: true,
    timerChk: 0,
    TIMER5SEC: 1500,
    tickCount: 0,
    imgSrc3: "Tutorial_3_EN.png",
  },

  nextStep: function (e) {
    var viewType = this.data.viewType;
    var self = this;
    console.log(viewType);
    if (viewType == 4) {
      wx.reLaunch({
        url: "/pages/HealthReportMain/HealthReportMain",
      });
      return;
    }
    this.setData({
      viewType: ++viewType,
    });
    console.log(viewType);
    switch (viewType) {
      case 2:
        this.setData({
          tiltText: "2.无需操作按键，赤脚站上秤面，保持好测试姿势。",
          imgSrc: "Tutorial_2_H30.png",
        });
        break;
      case 3:
        this.setData({
          tiltText: "3.测量体重后，开始进入用户识别功能。",
          imgSrc: this.data.imgSrc3,
          tiltToText:
            "由于用户是根据测量的信息来识别的，因此可能识别体型相似的人。在这种情况下，可以左右转动旋钮，选择昵称。",
        });
        break;
      case 4:
        this.setData({
          tiltText: "4.结束InBody测试后可立即确认结果。",
          imgSrc: this.data.imgList[0],
          tiltToText: "使用用户识别功能进行测试时，提供变动值和标准范围图",
        });
        this.data.timerChk = setInterval(function () {
          self.setImageChange();
        }, this.data.TIMER5SEC);
        break;
      default:
        this.setData({
          tiltText: "1.添加新用户，请保存便于识别的昵称。",
          imgSrc: "Tutorial_1_EN.png",
        });
        break;
    }
  },

  skipStep: function (e) {
    wx.reLaunch({
      url: "/pages/HealthReportMain/HealthReportMain",
    });
  },

  setImageChange() {
    var timerFlag = this.data.timerFlag;
    var imgList = this.data.imgList;
    var tickCount = this.data.tickCount;

    console.log(timerFlag);
    if (tickCount == 13) {
      this.setData({
        timerFlag: false,
        imgSrc: imgList[1],
        tickCount: 0,
      });
      clearInterval(this.data.timerChk);
      return;
    }
    if (timerFlag == true) {
      this.setData({
        timerFlag: !timerFlag,
        imgSrc: imgList[1],
      });
    } else {
      this.setData({
        timerFlag: !timerFlag,
        imgSrc: imgList[0],
      });
    }
    this.setData({
      tickCount: tickCount + 1,
    });
    console.log(this.data.imgSrc);
  },

  onLoad: function (options) {
    console.log("onLoad");
    var equip = wx.getStorageSync("ConnectEquip");
    if (equip == "H30") {
      this.setData({
        imgSrc3: "Tutorial_3_EN.png",
        imgList: ["Tutorial_4_EN1.png", "Tutorial_4_EN2.png"],
      });
    } else if (equip == "H40") {
      this.setData({
        imgSrc3: "img_h_40_tutorial_4_en.png",
        imgList: [
          "img_h_40_tutorial_5_1_en.png",
          "img_h_40_tutorial_5_2_en.png",
        ],
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
    wx.hideHomeButton();
  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {
    console.log("onHide");
  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload: function (options) {
    clearInterval(this.data.timerChk);
    console.log("onUnload");
  },

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

