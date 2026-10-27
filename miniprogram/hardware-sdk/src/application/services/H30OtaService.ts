import { IBluetoothAdapter } from '../../domain/ports/IBluetoothAdapter';

/**
 * H30/H40 firmware (OTA) transfer. The device must already be in update mode (the `SV` command)
 * and reconnected so the OTA service is exposed. Values mirror the original setup-flow implementation.
 */
export const H30_OTA = {
  SERVICE_UUID: '1D14D6EE-FD63-4FA1-BFA4-8F47B42119F0',
  CONTROL_UUID: 'F7BF3564-FB6D-4E53-88A4-5E37E0326063',
  DATA_UUID: '984227F3-34FC-4045-A5D0-2C581F81A153',
  /** Payload bytes per data write; the legacy flow never negotiated a larger MTU. */
  PACKET_SIZE: 20,
  COMMAND_START: 0x00,
  COMMAND_END: 0x03,
} as const;

/** A firmware image: raw bytes, or the binary string `readFile({ encoding: 'binary' })` returns. */
export type FirmwareImage = ArrayBuffer | Uint8Array | string;

export interface FirmwareSendOptions {
  onProgress?: (sentBytes: number, totalBytes: number) => void;
  /** Checked before every packet; returning true stops the transfer without sending the rest. */
  isCancelled?: () => boolean;
}

export function toFirmwareBytes(image: FirmwareImage): Uint8Array {
  if (typeof image === 'string') {
    const bytes = new Uint8Array(image.length);
    for (let i = 0; i < image.length; i++) bytes[i] = image.charCodeAt(i) & 0xff;
    return bytes;
  }
  return image instanceof Uint8Array ? image : new Uint8Array(image);
}

export class H30OtaService {
  constructor(
    private readonly adapter: IBluetoothAdapter,
    /** Gap between data packets; the legacy flow yielded 1ms so the stack is not flooded. */
    private readonly packetGapMs = 1
  ) {}

  /** Tells the device a transfer is about to begin. */
  start(deviceId: string): Promise<void> {
    return this.writeControl(deviceId, H30_OTA.COMMAND_START);
  }

  /** Tells the device the image is complete. */
  end(deviceId: string): Promise<void> {
    return this.writeControl(deviceId, H30_OTA.COMMAND_END);
  }

  /**
   * Streams the image in order, one packet at a time. Resolves with the bytes sent, which is
   * less than the image length only when cancelled. A failed packet rejects and stops there.
   */
  async sendFirmware(deviceId: string, image: FirmwareImage, options: FirmwareSendOptions = {}): Promise<number> {
    const bytes = toFirmwareBytes(image);
    let sent = 0;
    while (sent < bytes.length) {
      if (options.isCancelled?.()) return sent;
      const chunk = bytes.slice(sent, Math.min(sent + H30_OTA.PACKET_SIZE, bytes.length));
      if (this.packetGapMs > 0) await new Promise<void>(resolve => setTimeout(resolve, this.packetGapMs));
      await this.adapter.writeData(deviceId, H30_OTA.SERVICE_UUID, H30_OTA.DATA_UUID, chunk.buffer as ArrayBuffer, true);
      sent += chunk.length;
      options.onProgress?.(sent, bytes.length);
    }
    return sent;
  }

  private writeControl(deviceId: string, command: number): Promise<void> {
    return this.adapter.writeData(deviceId, H30_OTA.SERVICE_UUID, H30_OTA.CONTROL_UUID, new Uint8Array([command]).buffer as ArrayBuffer);
  }
}
