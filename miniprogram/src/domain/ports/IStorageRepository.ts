import { BCARecord } from '../entities/BCARecord.entity';
import { BoundEquipment, HistoryFilterCriteria, UserProfile } from '../entities/UserProfile.entity';
import { EquipmentMetricMatrix } from '../services/EquipmentVisibilityPolicy';

/** A completed measurement whose upload has not been confirmed; kept so it survives a process kill. */
export interface PendingMeasurementUpload {
  readonly uid: string;
  readonly url: string;
  readonly payload: Record<string, unknown>;
}

export interface StorageSchema {
  'auth:uid': string;
  'auth:tel': string;
  'auth:profile': UserProfile;
  'report:history': BCARecord[];
  'report:historyOwner': string;
  'report:equipMatrix': EquipmentMetricMatrix;
  'report:visibilityMatrix': Record<string, readonly string[]>;
  'filter:bca': HistoryFilterCriteria;
  'equip:bound': BoundEquipment;
  'measure:pendingUpload': PendingMeasurementUpload;
}

export interface IStorageRepository {
  get<K extends keyof StorageSchema>(key: K): StorageSchema[K] | null;
  set<K extends keyof StorageSchema>(key: K, value: StorageSchema[K]): void;
  remove<K extends keyof StorageSchema>(key: K): void;
  clearAll(): void;
}
