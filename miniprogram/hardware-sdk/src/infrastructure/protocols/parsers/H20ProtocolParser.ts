import { BaseProtocolParser } from './BaseProtocolParser';
import { InBodyResult } from '../../../domain/entities/DeviceResponse.entity';
import { IWeightTrait } from '../../../domain/ports/IDeviceDataTranslator';
import { H20Protocol } from '../framers/H20Protocol';
import { H20TransitionEvaluator } from './H20TransitionEvaluator';

/**
 * H20 定向解析器 (Semantic Parser)
 */
export class H20ProtocolParser extends BaseProtocolParser implements IWeightTrait {

  protected _protocol = new H20Protocol();
  protected _transitionEvaluator = new H20TransitionEvaluator();

  /**
   * 实现 IWeightTrait: 提取实时重量
   */
  public extractWeight(res: any): number | undefined {
    if (res.cmd === 'HW' || res.cmd === 'WT') return res.weight;
    return undefined;
  }



  /**
   * H20 语义映射：将物理帧转换为业务结果
   */
  protected mapFrameToResult(frame: { cmd: string, payload: Uint8Array }): InBodyResult {
    const { cmd, payload } = frame;
    const result: any = { deviceId: '', isCompleted: false, cmd };
    const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
    
    if (cmd === 'HC' || cmd === 'HR') {
      // 旧版 inbodyH20.js: HC/HR 短帧为 HC0，长帧为 HC1（完整结果）
      result.isCompleted = payload.length > 14;

      if (payload.length >= 10) {
        result.height = this._readWord(dv, 0) / 10.0;
        result.weight = this._readWord(dv, 2) / 10.0;
        result.pbf = this._readWord(dv, 4) / 10.0;
        result.slm = this._readWord(dv, 6) / 10.0;
        
        // Level
        let level = (dv.getUint8(8) << 8) & 0xff00;
        if (level > 0) {
          level = (level / 256) * 10;
        }
        level += dv.getUint8(9) & 0xff;
        result.vfaLevel = level;

        // Impedance
        // start of impedance block in payload is index 10 (which is index 16 in original total frame)
        // For array of 41 items starting at index 10:
        // IRA20 is at i=32 in the array of 41, so offset = 10 + 32*2 = 74
        if (payload.length >= 74 + 10) {
           result.ira20 = this._readWord(dv, 10 + 32*2) / 10.0;
           result.ila20 = this._readWord(dv, 10 + 33*2) / 10.0;
           result.it20 = this._readWord(dv, 10 + 34*2) / 10.0;
           result.irl20 = this._readWord(dv, 10 + 35*2) / 10.0;
           result.ill20 = this._readWord(dv, 10 + 36*2) / 10.0;
           
           result.ira100 = this._readWord(dv, 10 + 37*2) / 10.0;
           result.ila100 = this._readWord(dv, 10 + 38*2) / 10.0;
           result.it100 = this._readWord(dv, 10 + 39*2) / 10.0;
           result.irl100 = this._readWord(dv, 10 + 40*2) / 10.0;
           // ILL100 seems out of bounds of 41 items (i=41) but let's map it safely if exists
           if (payload.length >= 10 + 41*2 + 2) {
             result.ill100 = this._readWord(dv, 10 + 41*2) / 10.0;
           }
        }
      }
    } else if (cmd === 'HW' || cmd === 'WT') {
       if (payload.length >= 2) {
           result.weight = this._readWord(dv, 0) / 10.0;
       }
    }

    return result as unknown as InBodyResult;
  }

  public getExpectedResponseCmds(actionCode: string): string[] {
    const map: Record<string, string[]> = {
      'HC': ['HC', 'HR', 'HA'],
      'HR': ['HC', 'HR', 'HA'],
    };
    return map[actionCode] || [actionCode];
  }

}
