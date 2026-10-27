import { getContainer } from '../../src/application/AppContainer';
import { reportManagementRows } from '../../src/presentation/report/ReportView';

interface ManageInstance {
  disposed: boolean;
  deleting: boolean;
  loadVersion: number;
  setData(patch: Record<string, unknown>): void;
  reload(): Promise<void>;
}
Page({
  data: { items: [] },
  onLoad(this: ManageInstance) { this.disposed = false; this.loadVersion = 0; void this.reload(); },
  onUnload(this: ManageInstance) { this.disposed = true; this.loadVersion++; },
  async reload(this: ManageInstance) {
    const container = getContainer();
    const version = ++this.loadVersion;
    const authVersion = container.authStore.getSessionVersion();
    wx.showLoading({ mask: true, title: '加载中' });
    try {
      const rows = await container.reportService.getHistoryRows();
      if (!this.disposed && version === this.loadVersion && authVersion === container.authStore.getSessionVersion()) {
        this.setData({ items: reportManagementRows(rows) });
      }
    } catch { if (!this.disposed) wx.showToast({ title: '记录加载失败，请重试', icon: 'none' }); }
    finally { wx.hideLoading(); }
  },
  DeleteInBodyDataConfirm(this: ManageInstance, event: { currentTarget: { id: string } }) {
    if (this.deleting) return;
    const date = event.currentTarget.id;
    wx.showModal({ content: '删除InBody数据吗?', success: (result: { confirm: boolean }) => {
      if (!result.confirm || this.disposed || this.deleting) return;
      const container = getContainer();
      const profile = container.authStore.getState().profile;
      if (!profile) return;
      this.deleting = true;
      void container.reportService.deleteRecord(profile.uid,date).then(() => this.reload())
        .catch(() => wx.showToast({ title: '删除或刷新失败，请重试', icon: 'none' }))
        .finally(() => { this.deleting = false; });
    } });
  },
});
