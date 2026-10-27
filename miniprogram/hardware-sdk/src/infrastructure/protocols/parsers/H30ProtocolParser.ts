import { H30Protocol } from '../framers/H30Protocol';
import { BaseProtocolParser } from './BaseProtocolParser';
import { InBodyResult } from '../../../domain/entities/DeviceResponse.entity';
import { IWeightTrait, IProgressTrait, IPostureTrait } from '../../../domain/ports/IDeviceDataTranslator';
import { H30TransitionEvaluator } from './H30TransitionEvaluator';

const H30_RESULT_MIN_PAYLOAD_LENGTH = 227;

/**
 * H40 / H30 旗舰版解析中心
 * 核心：它通过继承 `BaseProtocolParser` 且增加 Traits，提供了 H30 的各种实时反馈能力。
 */
export class H30ProtocolParser extends BaseProtocolParser implements IWeightTrait, IProgressTrait, IPostureTrait {
  
  protected _protocol = new H30Protocol();
  protected _transitionEvaluator = new H30TransitionEvaluator();

  /**
   * 实现 IWeightTrait: 提取实时重量
   */
  public extractWeight(res: InBodyResult): number | undefined {
    if (res.cmd === 'HW' || res.cmd === 'HS') return (res as any).weight;
    return undefined;
  }

  /**
   * 实现 IProgressTrait: 提取测量进度
   */
  public extractProgress(res: InBodyResult): number | undefined {
    if (res.cmd === 'HM') return (res as any).progress;
    return undefined;
  }

  /**
   * 实现 IPostureTrait: 提取姿势/状态
   */
  public extractPosture(res: InBodyResult): number | undefined {
    // 对应 mapFrameToResult 里的字段名 'statu'
    if (res.cmd === 'HP') return (res as any).statu;
    return undefined;
  }

  /**
   * 语义决策：将物理层拿出的 RawFrame 映射为业务实体 InBodyResult
   */
  protected mapFrameToResult(frame: { cmd: string, payload: Uint8Array }): InBodyResult {
    const { cmd, payload } = frame;
    console.log(`[H30Parser] 收到物理帧: ${cmd}, 长度: ${payload.length}`);
    const result: any = { deviceId: '', isCompleted: false, cmd };
    const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

    if (cmd === 'AK') {
      console.log(`[H30Parser] 处理应答包 (AK), payload长度: ${payload.length}`);
      result.serialNumber = this._readString(dv, 0, 15);
      result.programVersion = this._readString(dv, 15, 25);
      result.wifiUsageVariable        = dv.byteLength > 40  ? dv.getUint8(40)  : 0;
      result.UID = this._readString(dv, 41, 25);
      result.nickName = this._readString(dv, 66, 6);
      result.uidOverflow       = dv.byteLength > 72  ? dv.getUint8(72)  : 0;

      result.ssid = this._readUtf8String(dv, 73, 32);

      result.language              = dv.byteLength > 105 ? dv.getUint8(105)  : 0;
      result.unit                  = dv.byteLength > 106 ? dv.getUint8(106)  : 0;
      result.sound                 = dv.byteLength > 107 ? dv.getUint8(107)  : 0;
      result.batteryVoltage        = dv.byteLength > 109 ? dv.getUint16(108) / 100 : 0;
      result.firmwareUpdatePossible= dv.byteLength > 110 ? dv.getUint8(110)  : 0;
      result.countrySetting        = dv.byteLength > 111 ? dv.getUint8(111)  : 0;
      result.wifiStatus     = dv.byteLength > 112 ? dv.getUint8(112)  : 0;

      // 状态回流：同步 AK 中的最新设备配置
      (this._protocol as H30Protocol).updateHOConfig({
        wifiUsage: result.wifiUsageVariable,
        UID: result.UID,
        nickName: result.nickName,
        language: result.language,
        unit: result.unit,
        sound: result.sound,
        rangeCountry: result.countrySetting
      });

    } else if (cmd === 'HO') {
      result.serialNumber = this._readString(dv, 0, 15);
      result.programVersion = this._readString(dv, 15, 25);
      result.wifiUsageVariable = dv.getUint8(40);
      result.UID = this._readString(dv, 41, 25);
      result.nickName = this._readString(dv, 66, 6);
      result.uidOverflow = dv.getUint8(72);
      result.language = dv.getUint8(73);
      result.unit = dv.getUint8(74);
      result.sound = dv.getUint8(75);
      result.wifiStatus = dv.getUint8(76);
      result.sex = dv.getUint8(77) === 1 ? 1 : 0;
      result.age = dv.getUint8(78);
      result.height = this._readWord(dv, 79) / 10;
      result.rangeCountry = dv.getUint8(81);
      result.urlByteCount = dv.getUint8(82);
      result.urlReturn = this._readString(dv, 83, result.urlByteCount);
      
      let offset = 83 + result.urlByteCount;
      if (offset < dv.byteLength) result.powerSaveModeEnable = dv.getUint8(offset++);
      if (offset < dv.byteLength) result.powerSaveMode = dv.getUint8(offset++);

      console.log(`[H30Parser] HO 配置同步成功, 身高: ${result.height}, 性别: ${result.sex === 1 ? '男' : '女'}`);

      // 状态回流：同步 HO 完整应答中的所有细节设置
      (this._protocol as H30Protocol).updateHOConfig({
        wifiUsage: result.wifiUsageVariable,
        UID: result.UID,
        nickName: result.nickName,
        language: result.language,
        unit: result.unit,
        sound: result.sound,
        sex: result.sex === 1 ? 'M' : 'F',
        age: result.age,
        height: result.height,
        rangeCountry: result.rangeCountry,
        urlByteCount: result.urlByteCount,
        url: result.urlReturn,
        powerSaveModeEnable: result.powerSaveModeEnable,
        powerSaveMode: result.powerSaveMode
      });

    } else if (cmd === 'UL') {
      console.log('[H30Parser] 处理用户列表 (UL)...');
      result.userList = [];
      result.userCount = dv.getUint8(0);
      for (let i = 0; i < result.userCount; i++) {
        const baseOffset = i * 39 + 1;
        const uid = this._readString(dv, baseOffset, 25);
        const nickName = this._readString(dv, baseOffset + 25, 6);
        
        const yr = dv.getUint8(baseOffset + 31).toString().padStart(2, '0');
        const mo = dv.getUint8(baseOffset + 32).toString().padStart(2, '0');
        const dy = dv.getUint8(baseOffset + 33).toString().padStart(2, '0');
        const hr = dv.getUint8(baseOffset + 34).toString().padStart(2, '0');
        const mi = dv.getUint8(baseOffset + 35).toString().padStart(2, '0');
        const sc = dv.getUint8(baseOffset + 36).toString().padStart(2, '0');
        
        result.userList.push({
          uid,
          nickName,
          lastMeasurement: `${yr}${mo}${dy}${hr}${mi}${sc}`,
          pendingDataCount: dv.getUint8(baseOffset + 37) // JS reads from 38, but 1+25+6+6=38... wait base+0..24 is uid, 25..30 is nick, 31..36 is datetime, 37 is count.
        });
      }
    } else if (cmd === 'HW') {
      result.weight = this._readWord(dv, 0) / 10;
      console.log(`[H30Parser] 实时重量(HW): ${result.weight} kg`);
    } else if (cmd === 'HP') {
      result.statu = dv.getUint8(0);
      console.log(`[H30Parser] 姿势检测(HP) 状态码: ${result.statu}`);
    } else if (cmd === 'HM') {
      const progress = dv.getUint8(0);
      result.progress = progress;

      if (progress === 100) {
          console.log('[H30Parser] 测量完成 (HM=100)');
      } else {
          console.log(`[H30Parser] 测量进度(HM): ${progress}%`);
      }
    } else if (cmd === 'HI') {
      console.log('[H30Parser] 个人信息同步(HI)...');
      result.sex = dv.getUint8(0);
      result.age = dv.getUint8(1);
      result.height = this._readWord(dv, 2) / 10;
      result.weight = this._readWord(dv, 4) / 10;
      result.pbf = this._readWord(dv, 6) / 10;
      result.slm = this._readWord(dv, 8) / 10;
    } else if (cmd === 'HE') {
      result.code = this._readString(dv, 6, 4);
      result.progress = 0; // 报错退回时，进度清空归零
      console.error(`[H30Parser] 设备报错(HE): ${result.code}`);
    } else if (cmd === 'WI') {
      // 防御性编程：只有收到真正包含业务事件码的包(长度>0)才去读取，避免空 ACK 包导致 getUint8(0) 越界崩溃
      if (dv.byteLength > 0) {
        result.code = dv.getUint8(0);
        result.serverResponse = this._readString(dv, 1, payload.length - 1);
        const wiCodeMap: Record<number, string> = { 0x30: '连接完成', 0x31: '连接失败', 0x32: '找不到', 0x33: '超时', 0x34: '连接被拒' };
        console.log(`[H30Parser] Wifi 配置结果(WI): ${wiCodeMap[result.code] || '未知(' + result.code + ')'}, 响应: ${result.serverResponse}`);
      } else {
        console.log(`[H30Parser] Wifi 配置握手(WI) 中间ACK - 保持静默等待最终包`);
      }
    } else if (cmd === 'WR') {
      if (dv.byteLength >= 5) {
        result.count = dv.getUint8(0);
        result.packageCount = dv.getUint8(1);
        result.readIndex = dv.getUint8(2);
        result.searchedWifiCount = dv.getUint8(3);
        result.wifiInfo = this._parseWifiScanList(payload);
        console.log(`[H30Parser] Wifi 列表同步(WR): 找到 ${result.searchedWifiCount} 个热点`);
      } else {
        console.warn(`[H30Parser] 收到异常短的 WR 报文, 长度: ${dv.byteLength}`);
        result.count = 0;
        result.packageCount = 0;
        result.readIndex = 0;
        result.searchedWifiCount = 0;
        result.wifiInfo = [];
      }
    } else if (cmd === 'DR') {
      if (dv.byteLength >= 32) {
        result.UID = this._readString(dv, 0, 25);
        result.nickName = this._readString(dv, 25, 6);
        result.count = dv.getUint8(31);
        console.log(`[H30Parser] 离线数据请求(DR): 用户 ${result.nickName}, 待同步数 ${result.count}`);
      } else if (dv.byteLength === 1) {
        result.count = dv.getUint8(0);
        console.log(`[H30Parser] 离线数据请求(DR)返回短载荷，待同步数 ${result.count}`);
      } else if (dv.byteLength > 0) {
        result.count = dv.getUint8(dv.byteLength - 1);
        console.log(`[H30Parser] 离线数据请求(DR)返回异常长度(${dv.byteLength})，末尾读取数 ${result.count}`);
      } else {
        result.count = 0;
        console.log(`[H30Parser] 离线数据请求(DR)返回空载荷，待同步数置为 0`);
      }
    } else if (cmd === 'DC') {
      if (payload.length > 0) result.isSaveCompleted = payload[0] === 0x01;
      console.log(`[H30Parser] 数据保存确认(DC): ${result.isSaveCompleted}`);
    } else if (cmd === 'DD') {
      result.userCount = dv.byteLength > 0 ? dv.getUint8(0) : 0;
      result.userList = [];
      for (let i = 0; i < result.userCount; i++) {
          const baseOffset = i * 39 + 1;
          if (baseOffset + 38 < dv.byteLength) {
            result.userList.push({
                uid: this._readString(dv, baseOffset, 25),
                nickName: this._readString(dv, baseOffset + 25, 6),
                lastMeasurement: this._readString(dv, baseOffset + 31, 6),
                pendingDataCount: dv.getUint8(baseOffset + 37)
            });
          }
      }
    } else if (cmd === 'HR' || cmd === 'UT') {
      result.cmd = cmd;
      if (cmd === 'UT') {
          if (dv.byteLength >= 32) {
            result.UID = this._readString(dv, 0, 25);
            result.nickName = this._readString(dv, 25, 6);
            result.index = dv.getUint8(31);
          }
          const hrPayload = payload.length > 32 ? payload.slice(32) : new Uint8Array(0);
          if (hrPayload.length >= H30_RESULT_MIN_PAYLOAD_LENGTH) {
            this._setInBodyData(result, new DataView(hrPayload.buffer, hrPayload.byteOffset, hrPayload.byteLength));
            result.isCompleted = true; // 标记全量数据已解析完成
          } else {
            console.warn(`[H30Parser] UT 返回载荷长度不足 (${hrPayload.length}), 无法解析完整报告`);
          }
      } else {
          if (dv.byteLength >= H30_RESULT_MIN_PAYLOAD_LENGTH) {
            this._setInBodyData(result, dv);
            result.isCompleted = true; // 标记全量数据已解析完成
          } else {
            console.warn(`[H30Parser] HR 返回载荷长度不足 (${dv.byteLength}), 无法解析完整报告`);
          }
      }
      console.log(`[H30Parser] 处理量测结果 (${cmd})...`);
      console.log(`[H30Parser] 结果概要: W:${result.weight}, PBF:${result.pbf}, SMM:${result.smm}, SLM:${result.slm}`);
    } else if (cmd === 'WS') {
      // Wifi 扫描结果：count=0xFF 或 0 表示无热点
      result.count = dv.byteLength > 0 ? dv.getUint8(0) : 0;
      console.log(`[H30Parser] Wifi扫描结果(WS): 共 ${result.count} 个热点`);
    } else if (cmd === 'HS') {
      // 修正：HS 代表稳定后的最终体重，其 Payload 结构与 HW 一致，附带最终锁定重量
      result.weight = this._readWord(dv, 0) / 10;
      console.log(`[H30Parser] 稳定重量锁定 (HS): ${result.weight} kg`);
    } else if (cmd === 'IC') {
      // 用户信息变更确认：UID(25) + nickName(6) + sex(1) + age(1) + height(2)
      result.UID = this._readString(dv, 0, 25);
      result.nickName = this._readString(dv, 25, 6);
      result.sex = dv.getUint8(31);
      result.age = dv.getUint8(32);
      result.height = this._readWord(dv, 33) / 10;
      console.log(`[H30Parser] 用户信息变更确认(IC): ${result.nickName}, 身高: ${result.height}`);
    } else if (cmd === 'SR') {
      // 设备状态：0睡眠 1身高 2体重 3电池/未注册 4握手提示 5用户识别 6阻抗 7WiFi传输 8结果
      result.statu = dv.byteLength > 0 ? dv.getUint8(0) : 0;
      console.log(`[H30Parser] 设备状态(SR): ${result.statu}`);
    } else if (cmd === 'WD') {
      // WiFi固件数据传输响应：packetNum(1) + ~packetNum(1) + packetIndex(1) + statu(1) + code(1)
      result.packetNum   = dv.byteLength > 0 ? dv.getUint8(0) : 0;
      result._packetNum  = dv.byteLength > 1 ? dv.getUint8(1) : 0;
      result.packetIndex = dv.byteLength > 2 ? dv.getUint8(2) : 0;
      result.statu       = dv.byteLength > 3 ? String.fromCharCode(dv.getUint8(3)) : '';
      result.code        = dv.byteLength > 4 ? dv.getUint8(4) : 0;
      console.log(`[H30Parser] WiFi固件传输响应(WD): packetNum=${result.packetNum}, status=${result.statu}`);
    } else if (cmd === 'DK' || cmd === 'MC' || cmd === 'UI' || cmd === 'SV' || cmd === 'WU' || cmd === 'WC') {
      // 纯确认帧，无需解析 payload
      console.log(`[H30Parser] 收到确认帧: ${cmd}`);
    }

    return result as unknown as InBodyResult;
  }


  private _setInBodyData(res: any, dv: DataView) {
    res.dateTime = this._readDateString(dv, 0);
    res.height = this._readWord(dv, 6) / 10;
    res.weight = this._readWord(dv, 8) / 10;
    res.pbf = this._readWord(dv, 10) / 10;
    res.smm = this._readWord(dv, 12) / 10;
    res.vfaLevel = this._readWord(dv, 14);
    res.tbw = this._readWord(dv, 16) / 10;
    res.mineral = this._readWord(dv, 18) / 100;
    res.protein = this._readWord(dv, 20) / 10;
    res.whr = this._readWord(dv, 22) / 100;
    res.bmc = this._readWord(dv, 44) / 100;
    res.slm = this._readWord(dv, 46) / 10;
    res.bfm = this._readWord(dv, 60) / 10;
    res.bmi = this._readWord(dv, 64) / 10;
    res.fitScore = this._readWord(dv, 66);
    res.bmr = this._readWord(dv, 68);
    res.iWeight = this._readWord(dv, 70) / 10;
    res.iSMM = this._readWord(dv, 72) / 10;
    res.iBFM = this._readWord(dv, 74) / 10;
    res.pwt = this._readWord(dv, 76) / 10;
    
    
    // Balance
    res.balUps = dv.getInt8(118);
    res.balLows = dv.getInt8(119);
    res.balUls = dv.getInt8(120);


    // Bounds & Max/Min & Others
    res.tbwMax = this._readWord(dv, 154) / 10; res.tbwMin = this._readWord(dv, 156) / 10;
    res.slmMax = this._readWord(dv, 158) / 10; res.slmMin = this._readWord(dv, 160) / 10;
    res.odk = this._readWord(dv, 162) / 10;
    res.obesity = this._readWord(dv, 164) / 10;
    res.odMax = this._readWord(dv, 166) / 10; res.odMin = this._readWord(dv, 168) / 10;
    res.tw = this._readWord(dv, 170) / 10;
res.wc = this._readWord(dv, 172) / 10;
    res.mc = this._readWord(dv, 174) / 10;
    res.fc = this._readWord(dv, 176) / 10;
    res.bmcMax = this._readWord(dv, 178) / 100; res.bmcMin = this._readWord(dv, 180) / 100;
    res.proteinMax = this._readWord(dv, 182) / 10; res.proteinMin = this._readWord(dv, 184) / 10;
    res.mineralMax = this._readWord(dv, 186) / 100; res.mineralMin = this._readWord(dv, 188) / 100;
    
    // Percentages and Ideals
    res.psmm = this._readWord(dv, 192) / 10;
    res.pfatNew = this._readWord(dv, 194) / 10; // 体脂肪量百分比图表值
    res.ibmi = this._readWord(dv, 196) / 10;
    res.bmiMax = this._readWord(dv, 198) / 10; res.bmiMin = this._readWord(dv, 200) / 10;
    res.ipbf = this._readWord(dv, 202) / 10;
    res.pbfMax = this._readWord(dv, 204) / 10; res.pbfMin = this._readWord(dv, 206) / 10;
    res.iwhr = this._readWord(dv, 208) / 100;
    res.whrMax = this._readWord(dv, 210) / 100; res.whrMin = this._readWord(dv, 212) / 100;
    res.islm = this._readWord(dv, 214) / 10;
    res.iprotein = this._readWord(dv, 216) / 10;
    res.imineral = this._readWord(dv, 218) / 100;
    res.ibmc = this._readWord(dv, 220) / 100;
    
    // Base Info
    res.sex = dv.byteLength > 225 ? dv.getInt8(225) : 0; 
    res.age = dv.byteLength > 226 ? dv.getInt8(226) : 0;
    res.inllLv = dv.byteLength > 232 ? dv.getInt8(232) : 0;
  }

  // --- 解析 Wifi (WR) ---
  private _parseWifiScanList(subArray: Uint8Array): any[] {
     const list: any[] = [];
     
     // 参照 legacy_js: 跳过前 5 个字节的头部 (count, packageCount, readIndex, searchedWifiCount)
     const dataPart = subArray.slice(5);
     
     let currentBlock: number[] = [];
     for (let i = 0; i < dataPart.length; i++) {
         if (dataPart[i] === 0xff) {
             if (currentBlock.length > 0) this._pushWifiInfo(new Uint8Array(currentBlock), list);
             currentBlock = [];
         } else {
             currentBlock.push(dataPart[i]);
         }
     }
     if (currentBlock.length > 0) this._pushWifiInfo(new Uint8Array(currentBlock), list);
     return list;
  }

  private _pushWifiInfo(block: Uint8Array, list: any[]) {
      const firstSpace = block.indexOf(0x20);
      if (firstSpace < 1) return;

      const ssidLenText = String.fromCharCode(...block.slice(0, firstSpace));
      const ssidLen = parseInt(ssidLenText, 10);
      if (isNaN(ssidLen)) return;

      const ssidStart = firstSpace + 1;
      const ssidEnd = ssidStart + ssidLen;
      if (ssidEnd > block.length) return;

      const ssid = this._utf8ArrayToString(block.slice(ssidStart, ssidEnd));
      const afterParts = String.fromCharCode(...block.slice(ssidEnd))
        .split(' ')
        .filter(p => p.length > 0);

      if (afterParts.length >= 5) {
          list.push({
              ssidLength: ssidLen,
              ssid: ssid,
              macAddr: afterParts[0],
              networkMode: parseInt(afterParts[1], 16),
              security: parseInt(afterParts[2], 16),
              channel: parseInt(afterParts[3], 16),
              rssi: parseInt(afterParts[4], 16)
          });
      }
  }

  private _readUtf8String(dv: DataView, start: number, len: number): string {
    if (start + len > dv.byteLength) return "";

    const bytes: number[] = [];
    for (let i = start; i < start + len; i++) {
      const c = dv.getUint8(i);
      if (c === 0xff || c === 0x00) continue;
      // 固定长度 SSID 区域可能带有不可见控制字节；展示时只保留空格、可见 ASCII 和 UTF-8 字节。
      if (c < 0x20) continue;
      bytes.push(c);
    }

    return this._utf8ArrayToString(new Uint8Array(bytes));
  }

  /**
   * 健壮的 UTF-8 字节流转字符串工具
   */
  private _utf8ArrayToString(array: Uint8Array): string {
    let out = "";
    let i = 0;
    const len = array.length;
    while (i < len) {
      const c = array[i++];
      switch (c >> 4) {
        case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
          out += String.fromCharCode(c);
          break;
        case 12: case 13:
          const char2 = array[i++];
          out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
          break;
        case 14:
          const char2_3 = array[i++];
          const char3 = array[i++];
          out += String.fromCharCode(((c & 0x0F) << 12) | ((char2_3 & 0x3F) << 6) | ((char3 & 0x3F) << 0));
          break;
        default:
          break;
      }
    }
    return out;
  }

  public getExpectedResponseCmds(actionCode: string): string[] {
    const map: Record<string, string[]> = {
      'AK': ['AK'],          
      'ST': ['HW', 'HP', 'HM', 'HE'],
      'RE': ['RE', 'SR'],
      'HW': ['HW', 'SR', 'HP', 'HM', 'HR', 'HS', 'HE'], 
      'HM': ['HM', 'SR', 'HP', 'HR', 'HS', 'HE'],       
      'HP': ['HP', 'SR', 'HM', 'HR', 'HS', 'HE'],
      'HR': ['HR', 'HE'],
      'WS': ['WS'],          
      'WR': ['WR'],          
      'WA': ['WI'],
      'WI': ['WI'],          
      'HO': ['HO'],          
      'HI': ['HI'],          
      'UL': ['UL'],          
      'SR': ['SR'],          
      'DR': ['DR'],          
      'UT': ['UT'],          
      'DC': ['DC'],          
      'DD': ['DD'],          
      'IC': ['IC'],          
      'DK': ['DK'],          
      'MC': ['MC'],          
      'UI': ['UI'],          
    };
    return map[actionCode] || [actionCode];
  }

}
