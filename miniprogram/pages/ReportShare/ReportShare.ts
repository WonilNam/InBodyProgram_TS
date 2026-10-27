
import { getContainer } from "../../src/application/AppContainer";

const { buildDetailedReport, calculateSafeCanvasSize, drawDetailedReport, formatMeasurementTime, measureDetailedReport } = require("../../src/infrastructure/renderers/ReportSharePoster2D");
const { createShareCanvasContext, loadReportImages } = require("../../src/infrastructure/renderers/Canvas2DContextAdapter");

Page({
  data: { loading: true, busy: false, result: "", canvasWidth: 750, canvasHeight: 750 },

  onLoad() {
    const appData = getApp().globalData || {};
    const userInfo = appData.InBodyUserInfo || {};
    this.nickname = String(userInfo.Name || "").trim() || "昵称";

    this.getOpenerEventChannel().on("report", ({ detail, changes, measuredAt }: any) => {
      if (!detail) {
        this.setData({ loading: false });
        this.notify("未获取到测量数据");
        return;
      }
      this.detail = detail;
      this.changes = changes || {};
      this.date = formatMeasurementTime(measuredAt, detail.DATETIMES_TXT);
      this.loadCIDData().finally(() => { if (this.pageReady) this.generateImage(); });
    });
  },

  onReady() {
    this.pageReady = true;
    if (this.detail && this.cidLoaded) this.generateImage();
  },

  onUnload() { this.disposed = true; },

  notify(title) { wx.showToast({ title, icon: "none" }); },

  loadCIDData() {
    if (this.cidPromise) return this.cidPromise;
    const uidDatetimes = this.detail && this.detail.UID_DATETIMES;
    if (!uidDatetimes || typeof wx.request !== "function") {
      this.cidLoaded = true;
      return Promise.resolve();
    }
    this.cidPromise = getContainer().reportService.getBodyTypeExplain(uidDatetimes)
      .then(cid => { if (!this.disposed) this.cid = cid; })
      .catch(() => {})
      .finally(() => { this.cidLoaded = true; });
    return this.cidPromise;
  },

  getReportCanvas() {
    return new Promise((resolve, reject) => {
      this.createSelectorQuery().select("#shareCanvas").fields({ node: true }).exec((results: any) => {
        const canvas = results && results[0] && results[0].node;
        if (canvas) resolve(canvas);
        else reject(new Error("Report Canvas 2D unavailable"));
      });
    });
  },

  exportCanvas(canvas) {
    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas, x: 0, y: 0, width: this.canvasWidth, height: this.canvasHeight,
        destWidth: this.exportWidth, destHeight: this.exportHeight, fileType: "png",
        success: (res: any) => resolve(res.tempFilePath), fail: reject,
      }, this);
    });
  },

  async generateImage() {
    if (!this.detail || this.data.busy) return;
    this.setData({ loading: true, busy: true });
    try {
      const report = buildDetailedReport(this.detail, this.changes, {
        date: this.date, nickname: this.nickname, cid: this.cid,
      });
      const logicalHeight = measureDetailedReport(report);
      const canvasSize = calculateSafeCanvasSize(750, logicalHeight);
      this.canvasWidth = canvasSize.canvasWidth;
      this.canvasHeight = canvasSize.canvasHeight;
      this.exportWidth = canvasSize.exportWidth;
      this.exportHeight = canvasSize.exportHeight;
      await new Promise<void>(resolve => this.setData({ canvasWidth: this.canvasWidth, canvasHeight: this.canvasHeight }, () => resolve()));
      const canvas = await this.getReportCanvas();
      canvas.width = this.canvasWidth;
      canvas.height = this.canvasHeight;
      const images = await loadReportImages(canvas, report);
      if (this.disposed) return;
      const ctx = createShareCanvasContext(canvas.getContext("2d"), images);
      if (canvasSize.renderScale !== 1) ctx.scale(canvasSize.renderScale, canvasSize.renderScale);
      drawDetailedReport(ctx, report, 750);
      const result = await this.exportCanvas(canvas);
      if (!this.disposed) this.setData({ result, loading: false });
    } catch (_) {
      if (!this.disposed) this.setData({ loading: false });
      this.notify("分享图片生成失败，请重试");
    } finally {
      if (!this.disposed) this.setData({ busy: false });
    }
  },

  preview() { if (this.data.result) wx.previewImage({ urls: [this.data.result] }); },

  shareMore() {
    if (!this.data.result || this.data.busy) return;
    if (typeof wx.showShareImageMenu !== "function") {
      this.notify("当前微信版本不支持图片分享");
      return;
    }
    wx.showShareImageMenu({
      path: this.data.result,
      fail: (error: any) => { if (!/cancel/.test(error.errMsg || "")) this.notify("分享面板打开失败，请重试"); },
    });
  },

  save() {
    if (!this.data.result || this.data.busy) return;
    this.setData({ busy: true });
    wx.saveImageToPhotosAlbum({
      filePath: this.data.result,
      success: () => wx.showToast({ title: "已保存到相册", icon: "success" }),
      fail: (error: any) => {
        if (/cancel/.test(error.errMsg || "")) return;
        if (/auth|deny|denied/.test(error.errMsg || "")) {
          wx.showModal({
            title: "需要相册权限", content: "请在设置中允许保存图片，然后重新点击保存。", confirmText: "去设置",
            success: (res: any) => { if (res.confirm) wx.openSetting({}); },
          });
        } else this.notify("保存失败，请重试");
      },
      complete: () => { if (!this.disposed) this.setData({ busy: false }); },
    });
  },
});

