const shouldShowTestLogs = process.env.DEBUG_TEST_LOGS === '1';

if (typeof (globalThis as any).wx === 'undefined') {
  (globalThis as any).wx = {
    offBLECharacteristicValueChange: () => {},
    offBLEConnectionStateChange: () => {},
    offBluetoothAdapterStateChange: () => {},
    offBluetoothDeviceFound: () => {},
    onBLECharacteristicValueChange: () => {},
    onBLEConnectionStateChange: () => {},
    onBluetoothAdapterStateChange: () => {},
    onBluetoothDeviceFound: () => {},
  };
}

if (!shouldShowTestLogs) {
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
}
