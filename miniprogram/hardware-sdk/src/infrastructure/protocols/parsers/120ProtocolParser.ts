import { BaseProtocolParser } from './BaseProtocolParser';
import { InBodyResult } from '../../../domain/entities/DeviceResponse.entity';
import { IProgressTrait, IWeightTrait } from '../../../domain/ports/IDeviceDataTranslator';
import { InBody120Protocol } from '../framers/InBody120Protocol';
import { InBody120TransitionEvaluator } from './InBody120TransitionEvaluator';

/**
 * InBody 120 (基础型) 协议语义层解析器
 * 严格对齐 IDeviceDataTranslator 接口，强制使用 InBodyResult。
 * 
 * 对齐旧版 inbody120.js → setInBodyData() 的完整字段映射。
 */
export class InBody120ProtocolParser extends BaseProtocolParser implements IWeightTrait, IProgressTrait {
  
  protected _protocol = new InBody120Protocol();
  protected _transitionEvaluator = new InBody120TransitionEvaluator();

  public extractWeight(res: InBodyResult): number | undefined {
    return (res as any).cmd === 'w' ? (res as any).weight : undefined;
  }

  public extractProgress(res: InBodyResult): number | undefined {
    return ((res as any).cmd === 'P' || (res as any).cmd === 'p') ? (res as any).progress : undefined;
  }

  /**
   * 120 语义映射：将物理帧转换为业务结果
   */
  protected mapFrameToResult(frame: { cmd: string, payload: Uint8Array }): InBodyResult {
    const { cmd, payload } = frame;
    // 120 的 AT 协议指令码通常是一个字符 ('u', 't', 'r', 'p')
    const result: any = { deviceId: '', isCompleted: false, cmd };
    
    if (cmd === 'w') {
      result.weight = parseFloat(String.fromCharCode(...payload)) || 0;
      return result as unknown as InBodyResult;
    }

    if (cmd === 'P' || cmd === 'p') {
      result.progress = parseInt(String.fromCharCode(...payload), 10) || 0;
      return result as unknown as InBodyResult;
    }

    if (cmd === 'e') {
      result.code = 'MEASUREMENT_ABORTED';
      return result as unknown as InBodyResult;
    }

    // 'u' = 个人信息应答，'t' = 时间/单位应答
    if (cmd === 'u' || cmd === 't') {
      return result as unknown as InBodyResult;
    }

    // 'r' = 最终结果包（CSV 格式）
    if (cmd === 'r') {
      result.isCompleted = true;
      const str = String.fromCharCode(...payload);
      const args = str.split(',');

      // ── 基础字段 (旧版 L336-L349) ──
      if (args.length >= 20) {
        result.sex = args[0] === 'M' ? 1 : 0;
        result.height = parseFloat(args[1]) || 0;
        result.age = parseInt(args[2]) || 0;
        result.weight = parseFloat(args[3]) || 0;
        // args[4], args[5] 未使用
        result.protein = parseFloat(args[6]) || 0;
        result.mineral = parseFloat(args[7]) || 0;
        result.bfm = parseFloat(args[8]) || 0;      // 体脂肪量
        result.tbw = parseFloat(args[9]) || 0;       // 体水分
        // args[10] 未使用
        result.smm = parseFloat(args[11]) || 0;      // 骨骼肌量 (SMM)
        // args[12] 未使用
        result.bmi = parseFloat(args[13]) || 0;
        result.pbf = parseFloat(args[14]) || 0;      // 体脂率
        result.whr = parseFloat(args[15]) || 0;      // 腰臀比
        // args[16], args[17] 未使用
        result.bmr = parseFloat(args[18]) || 0;      // 基础代谢率
        result.vfaLevel = parseFloat(args[19]) || 0;  // 内脏脂肪等级
      }

      // ── 评估百分比 (旧版 L351-L354) ──
      if (args.length >= 25) {
        result.bfmp = parseFloat(args[21]) || 0;     // 体脂肪量评估
        result.smmp = parseFloat(args[22]) || 0;     // 骨骼肌量评估
        result.pbfp = parseFloat(args[23]) || 0;     // 体脂率评估
        result.weightp = parseFloat(args[24]) || 0;  // 体重评估
      }

      // ── 节段骨骼肌百分比 (PDF No.26-30) ──
      if (args.length >= 30) {
        result.ffmpRa = parseFloat(args[25]) || 0;   // 右上肢骨骼肌%
        result.ffmpLa = parseFloat(args[26]) || 0;   // 左上肢骨骼肌%
        result.ffmpT = parseFloat(args[27]) || 0;    // 全身骨骼肌%
        result.ffmpRl = parseFloat(args[28]) || 0;   // 右下肢骨骼肌%
        result.ffmpLl = parseFloat(args[29]) || 0;   // 左下肢骨骼肌%
      }

      // ── 正常范围 (旧版 L361-L378) ──
      if (args.length >= 56) {
        result.proteinMax = parseFloat(args[34]) || 0;
        result.proteinMin = parseFloat(args[35]) || 0;
        result.mineralMax = parseFloat(args[36]) || 0;
        result.mineralMin = parseFloat(args[37]) || 0;
        result.bfmMax = parseFloat(args[38]) || 0;
        result.bfmMin = parseFloat(args[39]) || 0;
        result.wtMax = parseFloat(args[40]) || 0;
        result.wtMin = parseFloat(args[41]) || 0;
        result.pbfMax = parseFloat(args[46]) || 0;
        result.pbfMin = parseFloat(args[47]) || 0;
        result.whrMax = parseFloat(args[48]) || 0;
        result.whrMin = parseFloat(args[49]) || 0;
        result.vflMin = parseFloat(args[50]) || 0;
        result.vflMax = parseFloat(args[51]) || 0;
        result.tbwMax = parseFloat(args[54]) || 0;
        result.tbwMin = parseFloat(args[55]) || 0;
      }

      // ── 体成分详细 (旧版 L380-L384) ──
      if (args.length >= 65) {
        result.iWeight = parseFloat(args[60]) || 0;
        result.wc = parseFloat(args[61]) || 0;
        result.mc = parseFloat(args[62]) || 0;
        result.fc = parseFloat(args[63]) || 0;
        result.fitScore = parseFloat(args[64]) || 0; // 旧版字段 is: InBody 评分
      }

      // ── 阻抗数据 (旧版 L385-L394) ──
      if (args.length >= 75) {
        result.ira20 = parseFloat(args[65]) || 0;
        result.ila20 = parseFloat(args[66]) || 0;
        result.it20 = parseFloat(args[67]) || 0;
        result.irl20 = parseFloat(args[68]) || 0;
        result.ill20 = parseFloat(args[69]) || 0;
        result.ira100 = parseFloat(args[70]) || 0;
        result.ila100 = parseFloat(args[71]) || 0;
        result.it100 = parseFloat(args[72]) || 0;
        result.irl100 = parseFloat(args[73]) || 0;
        result.ill100 = parseFloat(args[74]) || 0;
      }

      // ── 节段体脂肪百分比 (PDF No.76-80) ──
      if (args.length >= 80) {
        result.pfra = parseFloat(args[75]) || 0;
        result.pfla = parseFloat(args[76]) || 0;
        result.pft = parseFloat(args[77]) || 0;
        result.pfrl = parseFloat(args[78]) || 0;
        result.pfll = parseFloat(args[79]) || 0;
      }

      // ── 肥胖度 (旧版 L400-L402) ──
      if (args.length >= 83) {
        result.obesity = parseFloat(args[80]) || 0;
        result.odMax = parseFloat(args[81]) || 0;
        result.odMin = parseFloat(args[82]) || 0;
      }

      // ── 节段瘦体重 + 节段脂肪 (旧版 L404-L413) ──
      if (args.length >= 94) {
        result.lra = parseFloat(args[84]) || 0;
        result.lla = parseFloat(args[85]) || 0;
        result.lt = parseFloat(args[86]) || 0;
        result.lrl = parseFloat(args[87]) || 0;
        result.lll = parseFloat(args[88]) || 0;
        result.fra = parseFloat(args[89]) || 0;
        result.fla = parseFloat(args[90]) || 0;
        result.ft = parseFloat(args[91]) || 0;
        result.frl = parseFloat(args[92]) || 0;
        result.fll = parseFloat(args[93]) || 0;
      }

      // ── 骨骼肌/基础代谢正常范围 (旧版 L414-L417) ──
      if (args.length >= 98) {
        result.smmMax = parseFloat(args[94]) || 0;
        result.smmMin = parseFloat(args[95]) || 0;
        result.bmrMin = parseFloat(args[96]) || 0;
        result.bmrMax = parseFloat(args[97]) || 0;
      }
    }

    return result as unknown as InBodyResult;
  }

  public getExpectedResponseCmds(actionCode: string): string[] {
    const map: Record<string, string[]> = {
      't': ['t'],
      'u': ['u', 'e'],
      'r': ['r'],
      's': ['s'],
    };
    return map[actionCode] || [actionCode];
  }

}
