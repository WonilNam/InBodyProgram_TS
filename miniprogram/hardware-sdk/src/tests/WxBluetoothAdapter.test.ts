import { WxBluetoothAdapter } from '../infrastructure/adapters/WxBluetoothAdapter';

describe('WxBluetoothAdapter.writeData', () => {
  const runtime = globalThis as unknown as { wx: Record<string, unknown> };

  it('only sets writeType when write-without-response is requested', async () => {
    const original = runtime.wx;
    const calls: Array<Record<string, unknown>> = [];
    runtime.wx = {
      ...original,
      writeBLECharacteristicValue: (options: Record<string, unknown> & { success: () => void }) => {
        calls.push(options);
        options.success();
      },
    };
    try {
      const adapter = new WxBluetoothAdapter();
      await adapter.writeData('d', 's', 'c', new ArrayBuffer(1));
      await adapter.writeData('d', 's', 'c', new ArrayBuffer(1), true);
      expect('writeType' in calls[0]).toBe(false);
      expect(calls[1].writeType).toBe('writeNoResponse');
    } finally {
      runtime.wx = original;
    }
  });
});
