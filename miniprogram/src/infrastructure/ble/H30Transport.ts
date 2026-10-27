import { IBluetoothSetupAdapter } from '../../../hardware-sdk/src/domain/ports/IBluetoothAdapter';
import { InBodyDevice } from '../../../hardware-sdk/src/domain/entities/InBodyDevice.entity';
import { H30_OTA } from '../../../hardware-sdk/src/application/services/H30OtaService';

/** Services the setup flows talk to (device info, UART-style command channel, OTA, ...). */
export const H30_SETUP_SERVICE_UUIDS: readonly string[] = [
  '0000180A-0000-1000-8000-00805F9B34FB',
  '6E400001-B5A3-F393-E0A9-E50E24DCCA9E',
  '0000181B-0000-1000-8000-00805F9B34FB',
  H30_OTA.SERVICE_UUID,
  '743820DF-FC1E-A844-F473-B8853EA80239',
];

export interface H30TransportHandlers {
  onData(value: ArrayBuffer): void;
  onConnectionChange(deviceId: string, connected: boolean): void;
  onAdapterState(available: boolean): void;
}

export interface CommandChannel {
  serviceId: string;
  characteristicId: string;
}

/** The `{ errCode, errMsg }` shape the legacy error dialogs key off, whatever failed underneath. */
export function toPlatformError(error: unknown): { errCode?: number; errMsg?: string } {
  const raw = error as { platform?: { errCode?: number; errMsg?: string }; errCode?: number; errMsg?: string; message?: string } | undefined;
  // Structural, not instanceof: the error may come from a separately loaded copy of the SDK.
  if (raw?.platform) return raw.platform;
  return { errCode: raw?.errCode, errMsg: raw?.errMsg ?? raw?.message };
}

/**
 * Promise-style Bluetooth access for the device-setup flows, built on the SDK's single shared
 * adapter. The adapter owns the only set of native `wx.on*` listeners; this class just
 * subscribes to it, so handing the radio to a measurement is `detach()` and nothing global is
 * ever removed from under the SDK.
 */
export class H30Transport {
  private subscriptions: Array<() => void> = [];

  constructor(private readonly adapter: IBluetoothSetupAdapter) {}

  get attached(): boolean {
    return this.subscriptions.length > 0;
  }

  /** Starts delivering events to `handlers`, replacing any previous subscription. */
  attach(handlers: H30TransportHandlers): void {
    this.detach();
    this.subscriptions = [
      this.adapter.onDataReceived((_deviceId, _characteristicId, value) => handlers.onData(value)),
      this.adapter.onConnectionStateChange((deviceId, connected) => handlers.onConnectionChange(deviceId, connected)),
      this.adapter.onAdapterStateChange(available => handlers.onAdapterState(available)),
    ];
  }

  /** Stops delivering events. Safe to call repeatedly. */
  detach(): void {
    for (const unsubscribe of this.subscriptions.splice(0)) unsubscribe();
  }

  open(): Promise<void> {
    return this.adapter.initAdapter();
  }

  closeAdapter(): Promise<void> {
    return this.adapter.closeAdapter();
  }

  startDiscovery(target: 'H30' | 'H40', onDevice: (device: InBodyDevice) => void): Promise<void> {
    this.adapter.setTargetType(target);
    return this.adapter.scanForDevices(onDevice);
  }

  async stopDiscovery(): Promise<void> {
    try { await this.adapter.stopScan(); } catch { /* Not scanning is the state we want. */ }
  }

  connect(deviceId: string): Promise<void> {
    return this.adapter.connectDevice(deviceId);
  }

  disconnect(deviceId: string): Promise<void> {
    return this.adapter.disconnectDevice(deviceId);
  }

  /**
   * Prepares the link the way the legacy flow did: request reads, enable notifications, and pick
   * the characteristic commands are written to. The OTA service is excluded from that choice —
   * it has its own fixed characteristics — so the pick no longer depends on discovery order.
   */
  async prepareChannel(deviceId: string, serviceUuids: readonly string[] = H30_SETUP_SERVICE_UUIDS): Promise<CommandChannel | null> {
    const services = await this.adapter.getServices(deviceId);
    let channel: CommandChannel | null = null;
    for (const serviceId of services.filter(id => serviceUuids.includes(id))) {
      const characteristics = await this.adapter.getCharacteristics(deviceId, serviceId);
      for (const characteristic of characteristics) {
        try {
          if (characteristic.properties.read) await this.adapter.readCharacteristic(deviceId, serviceId, characteristic.uuid);
          if (characteristic.properties.write && serviceId !== H30_OTA.SERVICE_UUID) {
            channel = { serviceId, characteristicId: characteristic.uuid };
          }
          if (characteristic.properties.notify || characteristic.properties.indicate) {
            await this.adapter.notifyCharacteristic(deviceId, serviceId, characteristic.uuid, true);
          }
        } catch {
          // One characteristic failing to arm must not abort the rest, as before.
        }
      }
    }
    return channel;
  }

  write(deviceId: string, channel: CommandChannel, payload: ArrayBuffer): Promise<void> {
    return this.adapter.writeData(deviceId, channel.serviceId, channel.characteristicId, payload);
  }
}
