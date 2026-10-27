
// pages/SetupInBodyEquip/SetupInBodyEquipTestH30.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    viewType: "weight",
    tiltText: "请站上踏板",
    progress: 10,
  },

  switchStep(e) {
    console.log(e);
    if (e == "measure") {
      this.setData({
        viewType: "measure",
        tiltText: "请勿说话或乱动!",
      });
      this.drawProgressbg();
      this.startProgress();
    } else if (e == "posture") {
      this.setData({
        viewType: "posture",
        tiltText: "请握住Dial的",
      });
    } else if (e == "weight") {
      this.setData({
        viewType: "weight",
        tiltText: "请站上踏板!",
      });
    } else if (e == "timeover") {
      wx.showModal({
        title: "提示", // 对话框标题
        content: "测试超时！", // 对话框内容
        showCancel: false, // 是否显示取消按钮，false表示不显示，默认为true
        success: (res: any) => {
          wx.reLaunch({
            url: "/pages/index/index",
          });
        },
      });
    }
  },
  setProgress(e) {
    this.setData({
      progress: e,
    });
  },
  drawProgressbg: function () {
    this.setData({
      canvasID: "canvasProgressbg2d",
    });
    wx.createSelectorQuery()
      .in(this)
      .select(".progress_bg")
      .fields({
        node: true,
        size: true,
      })
      .exec((res: any) => {
        const canvas = res && res[0] && res[0].node;
        if (!canvas) {
          return;
        }
        const ctx = canvas.getContext("2d");
        const dpr = wx.getWindowInfo().pixelRatio;
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);
        const centerX = canvas.width / (2 * dpr);
        const centerY = canvas.height / (2 * dpr);
        const radius =
          Math.min(canvas.width / dpr, canvas.height / dpr) / 2 - 10;

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = "#bbddf8";
        ctx.fill();
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.clip();

        ctx.beginPath();
        ctx.arc(
          centerX,
          centerY - radius / 3,
          radius / 3,
          0,
          2 * Math.PI,
          false
        );
        ctx.fillStyle = "#ddeffd";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(centerX, centerY + radius, radius / 1.2, Math.PI, 0, false);
        ctx.fillStyle = "#ddeffd";
        ctx.fill();
        ctx.restore();
      });
  },
  drawCircle: function (progress) {
    wx.createSelectorQuery()
      .in(this)
      .select(".progress_canvas")
      .fields({
        node: true,
        size: true,
      })
      .exec((res: any) => {
        const canvas = res && res[0] && res[0].node;
        if (!canvas) {
          return;
        }
        const ctx = canvas.getContext("2d");
        var gradient = ctx.createLinearGradient(200, 100, 100, 200);
        gradient.addColorStop("0.5", "#40ED94");
        const dpr = wx.getWindowInfo().pixelRatio;
        canvas.width = res[0].width * dpr;
        canvas.height = res[0].height * dpr;
        ctx.scale(dpr, dpr);
        const centerX = canvas.width / (2 * dpr);
        const centerY = canvas.height / (2 * dpr);
        const radius =
          Math.min(canvas.width / dpr, canvas.height / dpr) / 2 - 10;

        ctx.beginPath();
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 7;
        ctx.lineCap = "round";

        ctx.arc(
          centerX,
          centerY,
          radius + 3,
          -Math.PI / 2,
          progress * Math.PI - Math.PI / 2,
          false
        );
        ctx.stroke();
      });
  },

  compareVersion: function (v1, v2) {
    v1 = v1.split(".");
    v2 = v2.split(".");
    const len = Math.max(v1.length, v2.length);

    while (v1.length < len) {
      v1.push("0");
    }
    while (v2.length < len) {
      v2.push("0");
    }

    for (let i = 0; i < len; i++) {
      const num1 = parseInt(v1[i]);
      const num2 = parseInt(v2[i]);
      if (num1 > num2) {
        return 1;
      } else if (num1 < num2) {
        return -1;
      }
    }
    return 0;
  },
  startProgress: function () {
    this.countTimer = setInterval(() => {
      if (this.data.progress <= 100 && this.data.progress >= 0) {
        /* 绘制彩色圆环进度条  
                注意此处 传参 step 取值范围是0到2，
                所以 计数器 最大值 60 对应 2 做处理，计数器count=60的时候step=2
                */
        let progress = this.data.progress / 50;
        this.drawCircle(progress);
      } else if (this.data.progress == -1) {
        this.setData({
          progress: 0,
        });
        wx.showToast({
          title: "姿势出错！",
          icon: "error",
          duration: 2000,
        });
        clearInterval(this.countTimer);
      } else {
        clearInterval(this.countTimer);
        // this.startProgress();
      }
    }, 100);
  },
  measureCompleted(e) {
    if (e == true) {
      this.setData({
        tiltText: "测试完成",
      });
    }

    setTimeout(() => {
      wx.reLaunch({
        url: "/pages/index/index",
      });
    }, 3000);
  },
  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    getApp().globalData.BluetoothH30.setOnInBodyTestStartCallback(
      this.switchStep
    );
    getApp().globalData.BluetoothH30.setOnInBodyTestingCallback(
      this.setProgress
    );
    getApp().globalData.BluetoothH30.setOnInBodyTestCompletedCallback(
      this.measureCompleted
    );
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {
    this.drawProgressbg();
  },

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
  onUnload() {
    getApp().globalData.BluetoothH30.sendMC();
  },

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

