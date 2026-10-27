import { EvaluationLevel, MetricCode } from '../value-objects/MetricSpec.vo';

export type CidBodyType = 'C' | 'I' | 'D' | '';

export interface MetricReading {
  readonly code: MetricCode;
  readonly value: number | null;
  readonly displayValue: string;
  readonly min: number;
  readonly max: number;
  readonly percent: number;
  readonly level: EvaluationLevel;
  readonly visible: boolean;
}

export interface SegmentSites {
  readonly rightArm: number;
  readonly leftArm: number;
  readonly trunk: number;
  readonly rightLeg: number;
  readonly leftLeg: number;
  readonly rightArmEval: EvaluationLevel;
  readonly leftArmEval: EvaluationLevel;
  readonly trunkEval: EvaluationLevel;
  readonly rightLegEval: EvaluationLevel;
  readonly leftLegEval: EvaluationLevel;
}

export interface BCARecord {
  readonly uidDatetimes: string;
  readonly datetimes: string;
  readonly dateText: string;
  readonly shortDateText: string;
  readonly timestamp: number;
  readonly equip: string;
  readonly sex: 'M' | 'F' | '';
  readonly age: number;
  readonly height: number;
  readonly cidType: CidBodyType;
  readonly metrics: Readonly<Record<MetricCode, MetricReading>>;
  readonly segmentLean?: SegmentSites;
  readonly segmentFat?: SegmentSites;
  readonly segmentEcwTbw?: SegmentSites;
  readonly raw: Readonly<Record<string, unknown>>;
}

export interface BCARecordWithDelta {
  readonly record: BCARecord;
  readonly previousRecord: BCARecord | null;
  readonly deltas: Readonly<Record<MetricCode, string>>;
}
