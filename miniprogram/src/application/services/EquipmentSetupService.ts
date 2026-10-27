import * as hardwareSdk from '../../../hardware-sdk/index';
import { InBodyDevice, InBodyDeviceType } from '../../../hardware-sdk/src/domain/entities/InBodyDevice.entity';
import { BoundEquipment } from '../../domain/entities/UserProfile.entity';
import { IStorageRepository } from '../../domain/ports/IStorageRepository';
import { AuthStore } from '../stores/AuthStore';

export class EquipmentSetupService {
  constructor(
    private readonly storage: IStorageRepository,
    private readonly authStore: AuthStore,
    private readonly sdk: typeof hardwareSdk = hardwareSdk
  ) {}

  /**
   * 扫描并连接待绑定的 InBody 设备
   */
  async scanAndConnect(
    deviceType: InBodyDeviceType,
    timeoutMs = 10000
  ): Promise<InBodyDevice> {
    this.sdk.init(deviceType);
    const devices = await this.sdk.scan(undefined, timeoutMs);
    if (!devices || devices.length === 0) {
      throw new Error('未发现指定型号的 InBody 设备');
    }
    const target = devices[0];
    await this.sdk.connect(target);
    return target;
  }

  /**
   * 注册设备用户并持久化绑定设备信息
   */
  async registerDeviceAndBind(
    device: InBodyDevice,
    serialNumber: string,
    nickName?: string
  ): Promise<BoundEquipment> {
    const profile = this.authStore.getState().profile;
    if (profile && (device.type === 'H30' || device.type === 'H40')) {
      await this.sdk.registerUser(profile.uid, nickName || profile.name || 'User');
      await this.sdk.setCompleteRegistration();
    }

    const bound: BoundEquipment = {
      equipModel: device.name || `InBody${device.type}`,
      deviceType: device.type,
      serialNumber,
      deviceId: device.deviceId,
    };
    this.storage.set('equip:bound', bound);
    this.authStore.setBoundEquipment(bound);
    return bound;
  }

  /**
   * H30 / H40 Wi-Fi 扫描与配网
   */
  async scanWifiHotspots(): Promise<unknown[]> {
    return (await this.sdk.wifiScan()) as unknown[];
  }

  async configureWifi(ssid: string, password?: string, useV2 = false): Promise<unknown> {
    if (useV2) {
      return this.sdk.wifiSetV2(ssid, password);
    }
    return this.sdk.wifiSet(ssid, password);
  }

  /**
   * 解绑当前设备
   */
  unbindEquipment(): void {
    this.storage.remove('equip:bound');
    this.authStore.setBoundEquipment(null);
  }
}
