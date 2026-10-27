import * as hardwareSdk from '../../hardware-sdk/index';
import { IAudioPlayer } from '../domain/ports/IAudioPlayer';
import { IHttpClient } from '../domain/ports/IHttpClient';
import { IStorageRepository } from '../domain/ports/IStorageRepository';
import { WxAudioPlayer } from '../infrastructure/adapters/WxAudioPlayer';
import { WxHttpClient } from '../infrastructure/adapters/WxHttpClient';
import { WxStorageRepository } from '../infrastructure/adapters/WxStorageRepository';
import { AuthAppService } from './services/AuthAppService';
import { EquipmentSetupService } from './services/EquipmentSetupService';
import { MeasurementWorkflowService } from './services/MeasurementWorkflowService';
import { ReportAppService } from './services/ReportAppService';
import { AuthStore } from './stores/AuthStore';
import { MeasureSessionStore } from './stores/MeasureSessionStore';
import { ReportStore } from './stores/ReportStore';

export interface AppDependencies {
  readonly http?: IHttpClient;
  readonly storage?: IStorageRepository;
  readonly audio?: IAudioPlayer;
  readonly sdk?: typeof hardwareSdk;
}

export class AppContainer {
  private initialization: ReturnType<AuthAppService['bootstrapSession']> | null = null;
  readonly http: IHttpClient;
  readonly storage: IStorageRepository;
  readonly audio: IAudioPlayer;
  readonly sdk: typeof hardwareSdk;

  readonly authStore: AuthStore;
  readonly reportStore: ReportStore;
  readonly measureStore: MeasureSessionStore;

  readonly reportService: ReportAppService;
  readonly authService: AuthAppService;
  readonly measurementWorkflow: MeasurementWorkflowService;
  readonly equipmentSetup: EquipmentSetupService;

  initializeSession(): ReturnType<AuthAppService['bootstrapSession']> {
    if (!this.initialization) {
      this.initialization = this.authService.bootstrapSession().catch((error: unknown) => {
        this.initialization = null;
        throw error;
      });
    }
    return this.initialization;
  }

  constructor(deps: AppDependencies = {}) {
    this.http = deps.http ?? new WxHttpClient();
    this.storage = deps.storage ?? new WxStorageRepository();
    this.audio = deps.audio ?? new WxAudioPlayer();
    this.sdk = deps.sdk ?? hardwareSdk;

    this.authStore = new AuthStore();
    this.reportStore = new ReportStore();
    this.measureStore = new MeasureSessionStore();

    this.reportService = new ReportAppService(
      this.http,
      this.storage,
      this.authStore,
      this.reportStore
    );

    this.authService = new AuthAppService(
      this.http,
      this.storage,
      this.authStore,
      this.reportService
    );

    this.measurementWorkflow = new MeasurementWorkflowService(
      this.authStore,
      this.measureStore,
      this.reportService,
      this.http,
      this.audio,
      this.sdk,
      undefined,
      this.storage
    );

    // Covers both cold-start restore and a fresh login: whenever an account is signed in,
    // a result left unuploaded by a killed process is re-sent (no-op when none is stored).
    this.authStore.subscribe((state) => {
      if (state.isAuthenticated) void this.measurementWorkflow.resumePendingUpload();
    }, false);

    this.equipmentSetup = new EquipmentSetupService(
      this.storage,
      this.authStore,
      this.sdk
    );
  }
}

let globalContainer: AppContainer | null = null;

export function getContainer(): AppContainer {
  if (!globalContainer) {
    globalContainer = new AppContainer();
  }
  return globalContainer;
}
