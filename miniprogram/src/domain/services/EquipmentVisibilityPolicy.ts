import { EvaluationLevel, MetricCode } from '../value-objects/MetricSpec.vo';

export type EquipmentMetricMatrix = Partial<Record<MetricCode, readonly string[]>>;

export class EquipmentVisibilityPolicy {
  /**
   * 判断某个设备型号是否支持显示指定指标
   */
  static isMetricSupported(
    code: MetricCode,
    equipModel: string,
    matrix?: EquipmentMetricMatrix | null
  ): boolean {
    if (code === 'BMR') return true;
    if (!equipModel) return true;
    if (!matrix || Object.keys(matrix).length === 0) return true;
    const allowedEquips = matrix[code];
    if (!allowedEquips || allowedEquips.length === 0) return true;
    return allowedEquips.includes(equipModel);
  }

  /**
   * 评估细胞外水分比率 (ECW/TBW, WED) 的标准等级
   * 标准区间：0.360 ~ 0.390
   */
  static evaluateEcwTbwLevel(value: number | null): EvaluationLevel {
    if (value === null || !Number.isFinite(value) || value <= 0) return 'unknown';
    if (value < 0.36) return 'low';
    if (value >= 0.39) return 'high';
    return 'normal';
  }

  /**
   * 根据测量值与上下限评估标准等级
   */
  static evaluateRangeLevel(
    code: MetricCode,
    value: number | null,
    min: number,
    max: number
  ): EvaluationLevel {
    if (value === null || !Number.isFinite(value)) return 'unknown';
    if (code === 'WED') {
      return EquipmentVisibilityPolicy.evaluateEcwTbwLevel(value);
    }
    if (min > 0 && max > 0) {
      if (value < min) return 'low';
      if (value > max) return 'high';
      return 'normal';
    }
    return 'normal';
  }
}
