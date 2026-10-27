import { getContainer } from "../../application/AppContainer";


const INBODY_QR_PREFIX = 'https://qrcode.inbody.com?IBData=';

function showRetryQrModal(isCheckMain: boolean, done?: () => void): void {
  wx.showModal({
    content: 'QR码不正确，请重试',
    success(res: any) {
      if (res?.confirm) {
        scanQR(isCheckMain, done);
      }
    },
  });
}

function submitQrData(
  qrPayload: string,
  hp: string,
  uid: string | number,
  isCheckMain: boolean,
  done?: () => void
): void {
  const app = getApp<any>();

  void getContainer().reportService.saveQrData(qrPayload, hp, String(uid)).then(result => {
    if (String(app?.globalData?.UID) !== String(uid)) return;
    app.globalData.QRDatetimes = result?.DatetimesT;
    if (typeof done === 'function') done();
    else if (isCheckMain) wx.navigateTo({ url: '/pages/HealthReportMain/HealthReportMain?NoData=' });
  }).catch(error => {
    wx.showToast({ title: error instanceof Error ? error.message : '扫码结果保存失败，请重试', icon: 'none' });
  }).finally(() => wx.hideLoading());
}

export function scanQR(isCheckMain: boolean, done?: () => void): void {
  wx.scanCode({
    onlyFromCamera: true,
    success: (res: any) => {
      const url = String(res?.result || '');
      if (!url) return;

      const app = getApp<any>();
      const uid = app?.globalData?.UID;
    
      if (url.includes(INBODY_QR_PREFIX)) {
        const qrPayload = url.replace(INBODY_QR_PREFIX, '');
        const hp = String(wx.getStorageSync('UserTelHP') || '');

        getContainer().reportService.checkQrData(qrPayload, hp, String(uid))
          .then((checkRes: any) => {
            if (String(app?.globalData?.UID) !== String(uid)) return;

            const response = checkRes;
            if (!response || !response.IsSuccess) return;
            const errorMsg = String(response.ErrorMsg || '');

            if (errorMsg.includes('ERROR_EXIST')) {
              wx.showModal({
                title: 'InBody',
                content: '已保存的InBody测试结果',
                showCancel: false,
                complete: () => {
                  if (app?.globalData) {
                    app.globalData.QRDatetimes = response.Data?.DatetimesT;
                  }
                  if (typeof done === 'function') done();
                },
              });
            } else if (errorMsg.includes('ERROR_GENDER')) {
              wx.showModal({
                title: 'InBody',
                content:
                  '您的性别信息与InBody测试结果中的信息不一致.\n请识别自己的InBody测试二维码.',
                showCancel: false,
              });
            } else if (
              errorMsg.includes('ERROR_AGE') ||
              errorMsg.includes('ERROR_HEIGHT') ||
              errorMsg.includes('ERROR_HP')
            ) {
              wx.showModal({
                title: 'InBody',
                content:
                  '此InBody测试结果是您的数据吗？\n点击“是”测试结果将保存至您的的账号中.',
                showCancel: true,
                success: (choice: { confirm: boolean }) => {
                  if (choice.confirm) submitQrData(qrPayload, hp, uid, isCheckMain, done);
                },
              });
            } else {
              submitQrData(qrPayload, hp, uid, isCheckMain, done);
            }
          })
          .catch(() => {
            wx.hideLoading();
            wx.showToast({
              title: '检查网络连接',
              icon: 'success',
              duration: 2000,
            });
          });
      } else if (url.includes('SYS:')) {
        const qrParts = url.split(' ');
        if (qrParts.length > 0 && app?.globalData) {
          app.globalData.QRDatetimes = `20${qrParts[0]}`;
        }
        void getContainer().reportService.saveBloodPressureQr(url, String(uid)).then(() => {
          if (String(app?.globalData?.UID) !== String(uid)) return;
          const dashUrl = app?.globalData?.BPCount === 0
            ? '/pages/HealthReportMain/HealthReportMain'
            : '/pages/HealthReportHistoryGraphBP/HealthReportHistoryGraphBP?NoData=';
          wx.navigateTo({ url: dashUrl });
        }).catch(() => wx.showToast({ title: '血压结果保存失败，请重试', icon: 'none' }))
          .finally(() => wx.hideLoading());
      } else {
        showRetryQrModal(isCheckMain, done);
      }
    },
  });
}

module.exports = {
  scanQR,
};
