import { H30_OTA, H30OtaService, toFirmwareBytes } from '../../application/services/H30OtaService';
import { IBluetoothAdapter } from '../../domain/ports/IBluetoothAdapter';
import { WxBluetoothAdapter } from '../../infrastructure/adapters/WxBluetoothAdapter';

function fakeAdapter() {
  const writes: Array<{ service: string; char: string; bytes: number[]; noResponse?: boolean }> = [];
  const adapter = {
    writeData: jest.fn(async (_d: string, service: string, char: string, payload: ArrayBuffer, noResponse?: boolean) => {
      writes.push({ service, char, bytes: Array.from(new Uint8Array(payload)), noResponse });
    }),
  } as unknown as jest.Mocked<IBluetoothAdapter>;
  return { adapter, writes };
}

describe('H30OtaService', () => {
  it('writes the start and end commands to the OTA control characteristic with a normal write', async () => {
    const { adapter, writes } = fakeAdapter();
    const ota = new H30OtaService(adapter, 0);
    await ota.start('dev');
    await ota.end('dev');
    expect(writes).toEqual([
      { service: H30_OTA.SERVICE_UUID, char: H30_OTA.CONTROL_UUID, bytes: [0x00], noResponse: undefined },
      { service: H30_OTA.SERVICE_UUID, char: H30_OTA.CONTROL_UUID, bytes: [0x03], noResponse: undefined },
    ]);
  });

  it('streams the image in order as 20-byte packets with write-without-response and reports progress', async () => {
    const { adapter, writes } = fakeAdapter();
    const image = new Uint8Array(45).map((_, i) => i);
    const progress: Array<[number, number]> = [];
    const sent = await new H30OtaService(adapter, 0).sendFirmware('dev', image, { onProgress: (a, b) => progress.push([a, b]) });
    expect(sent).toBe(45);
    expect(writes.map(w => w.bytes.length)).toEqual([20, 20, 5]);
    expect(writes.every(w => w.char === H30_OTA.DATA_UUID && w.noResponse === true)).toBe(true);
    expect(writes.flatMap(w => w.bytes)).toEqual(Array.from(image));
    expect(progress).toEqual([[20, 45], [40, 45], [45, 45]]);
  });

  it('accepts the binary string produced by readFile and keeps each char as one byte', () => {
    expect(Array.from(toFirmwareBytes('\u0000ÿA'))).toEqual([0, 255, 65]);
    expect(Array.from(toFirmwareBytes(new Uint8Array([1, 2]).buffer))).toEqual([1, 2]);
  });

  it('stops at the failing packet without sending the rest', async () => {
    const { adapter, writes } = fakeAdapter();
    adapter.writeData.mockImplementationOnce(async () => { writes.push({ service: '', char: '', bytes: [] }); })
      .mockRejectedValueOnce(new Error('link lost'));
    await expect(new H30OtaService(adapter, 0).sendFirmware('dev', new Uint8Array(100))).rejects.toThrow('link lost');
    expect(adapter.writeData).toHaveBeenCalledTimes(2);
  });

  it('stops before the next packet when cancelled', async () => {
    const { adapter } = fakeAdapter();
    let packets = 0;
    adapter.writeData.mockImplementation(async () => { packets++; });
    const sent = await new H30OtaService(adapter, 0).sendFirmware('dev', new Uint8Array(100), { isCancelled: () => packets >= 2 });
    expect(sent).toBe(40);
    expect(packets).toBe(2);
  });
});

describe('WxBluetoothAdapter.writeData write type', () => {
  const runtime = globalThis as unknown as { wx: Record<string, unknown> };
  it('only sets writeType when write-without-response is requested', async () => {
    const original = runtime.wx;
    const calls: Array<Record<string, unknown>> = [];
    runtime.wx = {
      ...original,
      writeBLECharacteristicValue: (o: Record<string, unknown> & { success: () => void }) => { calls.push(o); o.success(); },
    };
    try {
      const adapter = new WxBluetoothAdapter();
      await adapter.writeData('d', 's', 'c', new ArrayBuffer(1));
      await adapter.writeData('d', 's', 'c', new ArrayBuffer(1), true);
      expect('writeType' in calls[0]).toBe(false);
      expect(calls[1].writeType).toBe('writeNoResponse');
    } finally { runtime.wx = original; }
  });
});
