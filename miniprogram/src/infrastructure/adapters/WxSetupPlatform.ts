import {
  ISetupPlatform, PlayingSound, SetupAppGlobals, SetupModalOptions,
} from '../../domain/ports/ISetupPlatform';

/** WeChat implementation of the host services the device-setup flow relies on. */
export class WxSetupPlatform implements ISetupPlatform {
  globals(): SetupAppGlobals {
    const app = getApp<{ globalData: SetupAppGlobals }>();
    return (app && app.globalData) || {};
  }

  getStored(key: string): unknown {
    return wx.getStorageSync(key);
  }

  setStored(key: string, value: unknown): void {
    wx.setStorageSync(key, value);
  }

  currentRoute(): string {
    const pages = getCurrentPages();
    const current = pages[pages.length - 1];
    return current ? current.route : '';
  }

  navigateTo(url: string): void {
    wx.navigateTo({ url });
  }

  redirectToHome(): void {
    wx.redirectTo({ url: '/pages/index/index' });
  }

  showLoading(): void {
    wx.showLoading({ title: '加载中...', mask: true });
  }

  hideLoading(): void {
    wx.hideLoading();
  }

  showModal(options: SetupModalOptions): Promise<{ confirm: boolean }> {
    return new Promise(resolve => {
      wx.showModal({
        ...options,
        success: (res: { confirm?: boolean }) => resolve({ confirm: Boolean(res && res.confirm) }),
        fail: () => resolve({ confirm: false }),
      });
    });
  }

  openAppSettings(): void {
    wx.openSetting({ success: () => {} });
  }

  playSound(src: string): PlayingSound {
    const player = wx.createInnerAudioContext();
    player.autoplay = true;
    player.src = src;
    return player;
  }

  postJson(url: string, data: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      wx.request({
        method: 'POST',
        url,
        data,
        success: (res: { data?: unknown }) => resolve(res.data),
        fail: reject,
      });
    });
  }

  pickFirmwareFile(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      wx.chooseMessageFile({
        count: 1,
        type: 'file',
        success: (res: { tempFiles: Array<{ path: string }> }) => {
          wx.getFileSystemManager().readFile({
            filePath: res.tempFiles[0].path,
            encoding: 'binary',
            success: (readRes: { data?: string | ArrayBuffer }) => resolve(String(readRes.data || '')),
            fail: () => reject(new Error('无法读取固件文件')),
          });
        },
        fail: () => reject(new Error('未选择固件文件')),
      });
    });
  }
}
