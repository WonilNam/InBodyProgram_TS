/**
 * Domain Value Object: Body Composition 11-Zone Coordinate Classification.
 */
export const CoordinateType = {
  XIAOSHOU: '消瘦型',
  MIAOTIAOJIROU: '苗条肌肉型',
  JIROU: '肌肉型',
  YUNDONGYUANTIXING: '运动员体型',
  PIANSHOU: '偏瘦型',
  MIAOTIAO: '苗条',
  JIANKANG: '健康型',
  YIBANQIANGZHUANG: '一般强壮型',
  YINXINGFEIPANG: '隐形肥胖',
  PIANPANG: '偏胖',
  FEIPANG: '肥胖',
} as const;

export type CoordinateTypeValue = (typeof CoordinateType)[keyof typeof CoordinateType] | '';

module.exports = {
  CoordinateType,
};
