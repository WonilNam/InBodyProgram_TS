import { InBodyDeviceState } from '../../hardware-sdk/src/domain/entities/InBodyDevice.entity';
import { getContainer } from '../../src/application/AppContainer';
import { MeasureSessionState } from '../../src/application/stores/MeasureSessionStore';

const STATE_HINT_TEXT: Readonly<Record<number, string>> = {
  [InBodyDeviceState.INITIAL]: '准备连接设备...',
  [InBodyDeviceState.CONNECTING]: '正在搜索并连接 InBody 设备...',
  [InBodyDeviceState.REGISTERING]: '正在同步设备注册信息...',
  [InBodyDeviceState.USER_CONFIGURING]: '正在下发个人体测参数...',
  [InBodyDeviceState.MEASUREMENT_STARTED]: '测量已启动，请准备上秤',
  [InBodyDeviceState.WAITING_FOR_STEP_ON]: '请光脚站上设备踏板',
  [InBodyDeviceState.MEASURING_WEIGHT]: '正在测量体重，请保持身体稳定...',
  [InBodyDeviceState.WEIGHT_CONFIRMED]: '体重已锁定，请握住手柄',
  [InBodyDeviceState.POSTURE_CHECKING]: '正在检测手部电极接触与测量姿势...',
  [InBodyDeviceState.ANALYZING]: '正在进行体成分阻抗分析...',
  [InBodyDeviceState.COMPLETED]: '测量完成！正在更新健康报告...',
  [InBodyDeviceState.FAILED]: '测量连接中断或发生异常',
  [InBodyDeviceState.CANCELLED]: '测量已取消',
};

Component({
  data: {
    active: false,
    deviceType: 'UNKNOWN',
    stateText: '准备连接设备...',
    realtimeWeightText: '--',
    progress: 0,
    errorMessage: '',
    uploadStatus: 'idle',
    closeText: '取消测量',
  },
  lifetimes: {
    attached() {
      const container = getContainer();
      (this as any)._unsub = container.measureStore.subscribe((state: MeasureSessionState) => {
        this.setData({
          active: state.active,
          deviceType: state.deviceType,
          stateText: state.uploadStatus === 'saved' ? '测量完成，报告已保存' :
            state.uploadStatus === 'failed' ? '测量完成，报告尚未保存' :
            STATE_HINT_TEXT[state.deviceState] || '正在通信中...',
          realtimeWeightText: state.realtimeWeight !== null ? state.realtimeWeight.toFixed(1) : '--',
          progress: state.progress,
          errorMessage: state.errorMessage || '',
          uploadStatus: state.uploadStatus,
          closeText: state.deviceState === InBodyDeviceState.COMPLETED ||
            state.deviceState === InBodyDeviceState.FAILED ? '关闭' : '取消测量',
        });
      });
    },
    detached() {
      if ((this as any)._unsub) {
        (this as any)._unsub();
      }
    },
  },
  methods: {
    async onRetryTap() {
      await getContainer().measurementWorkflow.retryUpload();
    },
    async onCancelTap() {
      if (this.data.uploadStatus === 'uploading') {
        wx.showToast({ title: '正在保存报告，请稍候', icon: 'none' });
        return;
      }
      if (this.data.uploadStatus === 'failed') {
        const confirmed = await new Promise<boolean>(resolve => wx.showModal({
          title: '报告尚未保存',
          content: '关闭后将丢弃本次未保存的测量结果，确定关闭？',
          success: (result: { confirm: boolean }) => resolve(result.confirm),
          fail: () => resolve(false),
        }));
        if (!confirmed) return;
      }
      await getContainer().measurementWorkflow.cancelSession();
    },
  },
});
