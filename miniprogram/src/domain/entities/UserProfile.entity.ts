import { InBodyDeviceType } from '../../../hardware-sdk/src/domain/entities/InBodyDevice.entity';

export interface UserProfile {
  readonly uid: string;
  readonly telHP: string;
  readonly name: string;
  readonly gender: 'M' | 'F' | '';
  readonly age: number;
  readonly height: number;
  readonly avatarUrl?: string;
}

export interface BoundEquipment {
  readonly equipModel: string;
  readonly deviceType: InBodyDeviceType;
  readonly serialNumber: string;
  readonly deviceId?: string;
  readonly macAddress?: string;
}

export interface DateFilterEndpoint {
  readonly date: string;     // 'YYYYMMDD' | 'YYYYMMDDHHmmss' | 'recent'
  readonly dateText: string; // '26.08.21 (周五)' | '最后一次InBody测量日期'
}

export interface HistoryFilterCriteria {
  readonly startDate: DateFilterEndpoint;
  readonly endDate: DateFilterEndpoint;
  readonly selectedEquips: readonly string[];
  readonly selectedDatetimes: readonly string[];
}
