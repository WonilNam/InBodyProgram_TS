import { INBODY_ENDPOINTS } from "../api/InBodyApi";
import type { InBodyResult } from '../../../hardware-sdk/src/domain/entities/DeviceResponse.entity';
import type {
  InBody120MeasurementResult,
  InBodyH20MeasurementResult,
  InBodyH30MeasurementResult,
  InBodyMeasurementResult,
} from '../../../hardware-sdk/src/domain/entities/MeasurementResult.entity';
import type { InBodyDeviceType } from '../../../hardware-sdk/src/domain/entities/InBodyDevice.entity';
import type { UserProfile } from '../../domain/entities/UserProfile.entity';

/** 三型号测量结果字段的并集视图，便于统一读取（所有字段均可选） */
type MergedMeasurement = Partial<
  InBody120MeasurementResult & InBodyH20MeasurementResult & InBodyH30MeasurementResult
>;

export interface UploadContext {
  readonly profile: UserProfile;
  readonly datetimes: string;
  readonly equipSerial: string;
}

/** H20 / H30 / H40 上传：POST https://wechat.lookinbody.cn/inbody/SetInBodyDataWeChat */
export const DIAL_UPLOAD_PATH = INBODY_ENDPOINTS.dialUpload;
/** InBody120 上传：POST https://inbodyapi.lookinbody.cn/InBodyAPI/SetJsonToInBodyDataWechat */
export const INBODY120_UPLOAD_URL =
  INBODY_ENDPOINTS.inBody120Upload;

export function isMeasurementResult(result: InBodyResult): result is InBodyMeasurementResult {
  return result.isCompleted === true;
}

function impedance(m: MergedMeasurement): Record<string, number | undefined> {
  return {
    IRA20: m.ira20,
    ILA20: m.ila20,
    IT20: m.it20,
    IRL20: m.irl20,
    ILL20: m.ill20,
    IRA100: m.ira100,
    ILA100: m.ila100,
    IT100: m.it100,
    IRL100: m.irl100,
    ILL100: m.ill100,
  };
}

function userIdentity(ctx: UploadContext): { UserID: string; LoginID: string } {
  return { UserID: ctx.profile.telHP, LoginID: ctx.profile.telHP };
}

/** 对齐旧版 InBodyTestComponent.setCheckInBodyData 的 H20B 上传字段 */
export function toH20Payload(result: InBodyMeasurementResult, ctx: UploadContext): Record<string, unknown> {
  const m = result as MergedMeasurement;
  return {
    UID: ctx.profile.uid,
    DATETIMES: ctx.datetimes,
    Gender: ctx.profile.gender,
    HT: m.height ?? ctx.profile.height,
    Age: m.age ?? ctx.profile.age,
    WT: m.weight,
    SMM: m.slm ?? m.smm,
    PBF: m.pbf,
    VFALevel: m.vfaLevel,
    ...impedance(m),
    Equip: 'H20B',
    Equip_Serial: ctx.equipSerial,
    ...userIdentity(ctx),
  };
}

/** 对齐旧版 BluetoothH30.setInBodyData 的 H30 / H40 上传字段 */
export function toH30Payload(
  result: InBodyMeasurementResult,
  ctx: UploadContext,
  equip: 'H30' | 'H40'
): Record<string, unknown> {
  const m = result as MergedMeasurement;
  const gender = m.sex === 1 ? 'M' : m.sex === 2 ? 'F' : ctx.profile.gender;
  return {
    UID: ctx.profile.uid,
    DATETIMES: ctx.datetimes,
    Gender: gender,
    HT: m.height ?? ctx.profile.height,
    Age: m.age ?? ctx.profile.age,
    WT: m.weight,
    PWT: m.pwt,
    SMM: m.smm,
    SLM: m.slm,
    PSMM: m.psmm,
    PBF: m.pbf,
    IPBF: m.ipbf,
    PBF_MIN: m.pbfMin,
    PBF_MAX: m.pbfMax,
    BMI: m.bmi,
    IBMI: m.ibmi,
    BMI_MIN: m.bmiMin,
    BMI_MAX: m.bmiMax,
    VFALevel: m.vfaLevel,
    ...impedance(m),
    TBW: m.tbw,
    TBW_MAX: m.tbwMax,
    TBW_MIN: m.tbwMin,
    MINERAL: m.mineral,
    MINERAL_MIN: m.mineralMin,
    MINERAL_MAX: m.mineralMax,
    PROTEIN: m.protein,
    PROTEIN_MIN: m.proteinMin,
    PROTEIN_MAX: m.proteinMax,
    WHR: m.whr,
    IWHR: m.iwhr,
    WHR_MIN: m.whrMin,
    WHR_MAX: m.whrMax,
    BMC: m.bmc,
    BMC_MIN: m.bmcMin,
    BMC_MAX: m.bmcMax,
    BMR: m.bmr,
    BFM: m.bfm,
    IBFM: m.iBFM,
    WC: m.wc,
    MC: m.mc,
    FC: m.fc,
    FS: m.fitScore,
    Equip: equip,
    Equip_Serial: ctx.equipSerial,
    ...userIdentity(ctx),
    ETYPE2: `000000000${m.balUps ?? 0}${m.balLows ?? 0}${m.balUls ?? 0}000000`,
    INLL_LV: m.inllLv,
  };
}

/** 对齐旧版 InBodyTest120Component.setCheckInBodyData 的 StatusData/UserData/InBodyData 信封 */
export function toInBody120Payload(result: InBodyMeasurementResult, ctx: UploadContext): Record<string, unknown> {
  const m = result as MergedMeasurement;
  const { profile } = ctx;
  const age = m.age ?? profile.age;
  const height = m.height ?? profile.height;
  return {
    StatusData: { UID: profile.uid, DataType: 'Wechat' },
    UserData: {
      USER_ID: profile.telHP,
      GENDER: profile.gender,
      AGE: age,
      HEIGHT: height,
      WEIGHT: m.weight,
      TEL_HP: profile.telHP,
      WebSend: '1',
    },
    InBodyData: {
      UID: profile.uid,
      DATETIMES: ctx.datetimes,
      SEX: profile.gender,
      Age: age,
      HT: height,
      WT: m.weight,
      Protein: m.protein,
      Mineral: m.mineral,
      BFM: m.bfm,
      TBW: m.tbw,
      SMM: m.smm,
      BMI: m.bmi,
      PBF: m.pbf,
      WHR: m.whr,
      BMR: m.bmr,
      VFA_LEVEL: m.vfaLevel,
      PFAT: m.bfmp,
      PFATNEW: m.bfmp,
      PSMM: m.smmp,
      PWT: m.weightp,
      PILRA: m.ffmpRa,
      PILLA: m.ffmpLa,
      PILT: m.ffmpT,
      PILRL: m.ffmpRl,
      PILLL: m.ffmpLl,
      Protein_MAX: m.proteinMax,
      Protein_MIN: m.proteinMin,
      Mineral_MAX: m.mineralMax,
      Mineral_MIN: m.mineralMin,
      BFM_MAX: m.bfmMax,
      BFM_MIN: m.bfmMin,
      WT_MAX: m.wtMax,
      WT_MIN: m.wtMin,
      PBF_MAX: m.pbfMax,
      PBF_MIN: m.pbfMin,
      WHR_MAX: m.whrMax,
      WHR_MIN: m.whrMin,
      TBW_MAX: m.tbwMax,
      TBW_MIN: m.tbwMin,
      TW: m.tw,
      IWT: m.iWeight,
      WC: m.wc,
      MC: m.mc,
      FC: m.fc,
      FS: m.fitScore,
      ...impedance(m),
      PFRA: m.pfra,
      PFLA: m.pfla,
      PFT: m.pft,
      PFRL: m.pfrl,
      PFLL: m.pfll,
      Obesity: m.obesity,
      OD_MAX: m.odMax,
      OD_MIN: m.odMin,
      LRA: m.lra,
      LLA: m.lla,
      LT: m.lt,
      LRL: m.lrl,
      LLL: m.lll,
      FRA: m.fra,
      FLA: m.fla,
      FT: m.ft,
      FRL: m.frl,
      FLL: m.fll,
      SMM_MAX: m.smmMax,
      SMM_MIN: m.smmMin,
      BMR_MIN: m.bmrMin,
      BMR_MAX: m.bmrMax,
      Equip: 'INBODY120',
      Equip_Serial: ctx.equipSerial,
      ...userIdentity(ctx),
    },
  };
}

/** 根据设备型号路由到对应的真实上传端点与 payload */
export function buildUploadRequest(
  deviceType: InBodyDeviceType,
  result: InBodyMeasurementResult,
  ctx: UploadContext
): { url: string; payload: Record<string, unknown> } {
  switch (deviceType) {
    case '120':
      return { url: INBODY120_UPLOAD_URL, payload: toInBody120Payload(result, ctx) };
    case 'H20':
      return { url: DIAL_UPLOAD_PATH, payload: toH20Payload(result, ctx) };
    case 'H40':
      return { url: DIAL_UPLOAD_PATH, payload: toH30Payload(result, ctx, 'H40') };
    default:
      return { url: DIAL_UPLOAD_PATH, payload: toH30Payload(result, ctx, 'H30') };
  }
}
