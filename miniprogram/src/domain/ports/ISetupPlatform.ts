/** App-wide mutable values the H30/H40 setup pages and the setup session share. */
export interface SetupAppGlobals {
  UID?: string | null;
  nickName?: string;
  serverUrl?: string;
  bluetoothdata?: boolean;
  InBodyUserInfo?: {
    Gender?: string;
    Age?: number;
    Height?: number;
    TelHP?: string;
  };
}

/** A prompt sound that can be cut short. */
export interface PlayingSound {
  stop(): void;
  destroy(): void;
}

export interface SetupModalOptions {
  title: string;
  content: string;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
}

/**
 * Everything the device-setup flow needs from the host app besides Bluetooth: user-facing
 * dialogs, navigation, sounds, local storage and the one direct upload. Keeping these behind a
 * port lets the Wi-Fi / nickname / OTA flow run (and be tested) without the WeChat runtime.
 */
export interface ISetupPlatform {
  globals(): SetupAppGlobals;

  getStored(key: string): unknown;
  setStored(key: string, value: unknown): void;

  /** Route of the page currently on top, e.g. `pages/SetupInBodyEquip/SetupInBodyEquipTestH30`. */
  currentRoute(): string;
  navigateTo(url: string): void;
  redirectToHome(): void;

  showLoading(): void;
  hideLoading(): void;
  /** Resolves when the dialog is dismissed; `confirm` is true only for the confirm button. */
  showModal(options: SetupModalOptions): Promise<{ confirm: boolean }>;
  openAppSettings(): void;

  playSound(src: string): PlayingSound;

  /** POSTs JSON and resolves with the parsed response body, rejecting on transport failure. */
  postJson(url: string, data: Record<string, unknown>): Promise<unknown>;

  /** Lets the user pick a firmware file and resolves with its bytes as a binary string. */
  pickFirmwareFile(): Promise<string>;
}
