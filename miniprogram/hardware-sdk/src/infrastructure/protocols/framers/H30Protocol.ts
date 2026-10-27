import { IProtocol, RawFrame } from '../framers/IProtocol';
import { DeviceRequest, SetupRequest, PersonalInfoRequest } from '../../../domain/entities/DeviceRequest.entity';

/**
 * H30 物理层协议实现 (Physical Framing Only)
 * 职责：负责 H30 物理报文的封包 (STX, ETX, Length, CRC) 与 分帧。
 */
export class H30Protocol implements IProtocol {
    private cachedHOConfig: any = {
        language: 0,
        unit: 0,
        sound: 1,
        wifiUsage: 1,
        powerSaveModeEnable: 0,
        powerSaveMode: 0,
        rangeCountry: 1,
        urlByteCount: 4,
        url: 'NONE',
        UID: '',
        nickName: '',
        sex: 'M',
        age: 0,
        height: 0
    };

    /**
     * 状态回流：当从设备解析到最新的配置包（如 AK 或 HO 应答）时，
     * 将最新状态反向同步到协议缓存中，防止增量修改时覆盖掉其他字段。
     */
    public updateHOConfig(update: Partial<any>): void {
        this.cachedHOConfig = { ...this.cachedHOConfig, ...update };
    }



    public encode(action: string, params?: DeviceRequest): ArrayBuffer {
        let payload: Uint8Array = new Uint8Array(0);
        
        switch (action) {
            case 'HI': {
                const p = params as any;
                // 旧协议 sendHI: 10 字节 (sex+age+ht×2+wt×2+pbf×2+slm×2，后6字节置0)
                payload = new Uint8Array(10);
                const isMale = p.sex === 'M';
                payload[0] = isMale ? 0x01 : 0x00;
                payload[1] = p.age;
                const ht = Math.round(p.height * 10);
                payload[2] = (ht >> 8) & 0xff; payload[3] = ht & 0xff;
                // payload[4..9]: weight/pbf/slm 固定为 0（Uint8Array 默认值）
                break;
            }
            case 'AK': {
                payload = new Uint8Array(6); 
                if (params && (params as any).syncTime) {
                    const now = new Date();
                    payload[0] = now.getFullYear() % 100;
                    payload[1] = now.getMonth() + 1;
                    payload[2] = now.getDate();
                    payload[3] = now.getHours();
                    payload[4] = now.getMinutes();
                    payload[5] = now.getSeconds();
                } else {
                    payload[0] = 0x52; // 'R'
                }
                break;
            }
            case 'HO': {
                const incoming = params as any || {};
                // 将传入的新参数合并到缓存配置中，保证增量更新时不丢失旧配置
                this.cachedHOConfig = { ...this.cachedHOConfig, ...incoming };
                const p = this.cachedHOConfig;
                
                const urlByteCount = p.urlByteCount || 4;
                const url = p.url || 'NONE';
                payload = new Uint8Array(51 + urlByteCount);
                const now = new Date();
                payload[0] = now.getFullYear() % 100;
                payload[1] = now.getMonth() + 1;
                payload[2] = now.getDate();
                payload[3] = now.getHours();
                payload[4] = now.getMinutes();
                payload[5] = now.getSeconds();
                payload[6] = p.language ?? 0;
                payload[7] = p.unit ?? 0;
                payload[8] = p.sound ?? 1;
                
                const uid = p.UID || p.uid || '';
                const uidBytes = this._stringToUtf8(uid);
                for (let i = 0; i < 25; i++) {
                    payload[9 + i] = i < uidBytes.length ? uidBytes[i] : 0x00;
                }
                const nickName = p.nickName || '';
                const nickBytes = this._stringToUtf8(nickName);
                for (let i = 0; i < 6; i++) {
                    payload[34 + i] = i < nickBytes.length ? nickBytes[i] : 0x00;
                }
                
                payload[40] = p.wifiUsage ?? 1;
                const sex = p.sex || 'M';
                payload[41] = sex === 'M' ? 0x01 : 0x00;
                payload[42] = p.age ?? 0;
                const ht = Math.round((p.height || 0) * 10);
                payload[43] = (ht >> 8) & 0x00ff;
                payload[44] = ht & 0x00ff;
                payload[45] = p.rangeCountry ?? 1; // 1 = CHN
                
                payload[46] = urlByteCount;
                const urlBytes = this._stringToUtf8(url);
                for (let i = 0; i < urlByteCount; i++) {
                    payload[47 + i] = i < urlBytes.length ? urlBytes[i] : 0x00;
                }
                
                payload[payload.length - 4] = p.powerSaveModeEnable ?? 0;
                payload[payload.length - 3] = p.powerSaveMode ?? 0;
                payload[payload.length - 2] = 0; // Hardcoded Type1
                payload[payload.length - 1] = 1; // Hardcoded Medium
                break;
            }
            case 'WI': {
                const p = params as any;
                let url = p.url || 'NONE';
                if (url.length > 60) url = url.substring(0, 60);
                const urlBytes = this._stringToUtf8(url);
                payload = new Uint8Array(53 + urlBytes.length);

                const ssid = p.SSID || '';
                const ssidBytes = this._stringToUtf8(ssid);
                for (let i = 0; i < 32; i++) {
                    payload[i] = i < ssidBytes.length ? ssidBytes[i] : 0x00;
                }
                const pw = p.password || "";
                const pwBytes = this._stringToUtf8(pw);
                for (let i = 0; i < 20; i++) {
                    payload[32 + i] = i < pwBytes.length ? pwBytes[i] : 0x00;
                }
                payload[52] = urlBytes.length;
                for (let i = 0; i < urlBytes.length; i++) {
                    payload[53 + i] = urlBytes[i];
                }
                break;
            }
            case 'WA': {
                const p = params as any;
                let url = p.url || 'NONE';
                if (url.length > 60) url = url.substring(0, 60); 
                const urlBytes = this._stringToUtf8(url);
                
                payload = new Uint8Array(96 + urlBytes.length);
                
                const ssid = p.SSID || '';
                const ssidBytes = this._stringToUtf8(ssid);
                for (let i = 0; i < 32; i++) {
                    payload[i] = i < ssidBytes.length ? ssidBytes[i] : 0x00;
                }
                
                const pw = p.password || "";
                const pwBytes = this._stringToUtf8(pw);
                for (let i = 0; i < 63; i++) {
                    payload[32 + i] = i < pwBytes.length ? pwBytes[i] : 0x00;
                }
                
                payload[95] = urlBytes.length;
                for (let i = 0; i < urlBytes.length; i++) {
                    payload[96 + i] = urlBytes[i];
                }
                break;
            }
            case 'WR': {
                const p = params as any;
                payload = new Uint8Array(1);
                payload[0] = p.packageIndex;
                break;
            }
            case 'DR': {
                const p = params as any;
                payload = new Uint8Array(31);
                for (let i = 0; i < 25; i++) {
                    payload[i] = i < p.UID.length ? p.UID.charCodeAt(i) : 0x00;
                }
                for (let i = 0; i < 6; i++) {
                    payload[25 + i] = i < p.nickName.length ? p.nickName.charCodeAt(i) : 0x00;
                }
                break;
            }
            case 'UT': {
                const p = params as any;
                payload = new Uint8Array(32);
                for (let i = 0; i < 25; i++) {
                    payload[i] = i < p.UID.length ? p.UID.charCodeAt(i) : 0x00;
                }
                for (let i = 0; i < 6; i++) {
                    payload[25 + i] = i < p.nickName.length ? p.nickName.charCodeAt(i) : 0x00;
                }
                payload[31] = p.index;
                break;
            }
            case 'DK': {
                const p = params as any;
                payload = new Uint8Array(1);
                payload[0] = p.kind;
                break;
            }
            case 'SR': {
                payload = new Uint8Array(1);
                payload[0] = 0x30;
                break;
            }
            case 'IC': {
                const p = params as any;
                payload = new Uint8Array(35);
                for (let i = 0; i < 25; i++) {
                    payload[i] = i < p.UID.length ? p.UID.charCodeAt(i) : 0x00;
                }
                for (let i = 0; i < 6; i++) {
                    payload[25 + i] = i < p.nickName.length ? p.nickName.charCodeAt(i) : 0x00;
                }
                payload[31] = p.sex === 'M' ? 0x01 : 0x00;
                payload[32] = p.age;
                const ht = Math.round(p.height * 10);
                payload[33] = (ht >> 8) & 0xff; payload[34] = ht & 0xff;
                break;
            }
            case 'HI': {
                const p = params as any;
                payload = new Uint8Array(10);
                payload[0] = p.sex === 'M' ? 0x01 : 0x00;
                payload[1] = p.age || 0;
                const ht = Math.round((p.height || 0) * 10);
                payload[2] = (ht >> 8) & 0xff; payload[3] = ht & 0xff;
                const wt = Math.round((p.weight || 0) * 10);
                payload[4] = (wt >> 8) & 0xff; payload[5] = wt & 0xff;
                const pbf = Math.round((p.pbf || 0) * 10);
                payload[6] = (pbf >> 8) & 0xff; payload[7] = pbf & 0xff;
                const slm = Math.round((p.slm || 0) * 10);
                payload[8] = (slm >> 8) & 0xff; payload[9] = slm & 0xff;
                break;
            }
            case 'DD': {
                const p = params as any;
                const userList = Array.isArray(p?.userList) ? p.userList : [];
                const count = userList.length;
                payload = new Uint8Array(1 + count * 32);
                payload[0] = count;
                for (let i = 0; i < count; i++) {
                    const user = userList[i] || {};
                    const uid = user.UID || user.uid || '';
                    const nickName = user.nickName || '';
                    for (let j = 0; j < 25; j++) {
                        payload[1 + i * 32 + j] = j < uid.length ? uid.charCodeAt(j) : 0x00;
                    }
                    for (let j = 0; j < 7; j++) {
                        payload[1 + i * 32 + 25 + j] = j < nickName.length ? nickName.charCodeAt(j) : 0x00;
                    }
                }
                break;
            }
            case 'DC': {
                const p = params as any;
                const count = p.saveResult.length;
                payload = new Uint8Array(32 + 8 * count);
                for (let i = 0; i < 25; i++) {
                    payload[i] = i < p.UID.length ? p.UID.charCodeAt(i) : 0x00;
                }
                for (let i = 0; i < 6; i++) {
                    payload[25 + i] = i < p.nickName.length ? p.nickName.charCodeAt(i) : 0x00;
                }
                payload[31] = count;
                for (let i = 0; i < count; i++) {
                    const r = p.saveResult[i];
                    let k = 0;
                    const bOffset = 32 + i * 8;
                    for (let j = 0; j < 8; j++) {
                        if (j === 6) {
                            payload[bOffset + j] = r.result;
                        } else if (j === 7) {
                            payload[bOffset + j] = 0xff;
                        } else {
                            const dateTimes = r.dateTimes;
                            payload[bOffset + j] = parseInt(dateTimes[k * 2] + dateTimes[k * 2 + 1]);
                            k++;
                            if (k === 6) k = 0;
                        }
                    }
                }
                break;
            }
            case 'WD': {
                // WiFi模块固件数据传输
                // params: { packetNum, packetIndex, data?: Uint8Array, zeroCount?: number }
                const p = params as any;
                const packetNum = (p.packetNum || 1) % 256;
                const packetIndex = p.packetIndex || 1;
                if (p.zeroCount) {
                    // 零数据压缩模式：发送连续零块的数量
                    payload = new Uint8Array(4);
                    payload[0] = packetNum;
                    payload[1] = 255 - packetNum; // ~packetNum
                    payload[2] = packetIndex;
                    payload[3] = p.zeroCount;
                } else {
                    const data: Uint8Array = p.data instanceof Uint8Array ? p.data : new Uint8Array(0);
                    payload = new Uint8Array(3 + data.length);
                    payload[0] = packetNum;
                    payload[1] = 255 - packetNum; // ~packetNum
                    payload[2] = packetIndex;
                    payload.set(data, 3);
                }
                break;
            }
            // --- 无 payload 指令 ---
            case 'UL': // 用户列表请求
            case 'HW': // 体重请求
            case 'HP': // 姿势检测请求
            case 'HM': // 测量进度请求
            case 'HR': // 测量结果请求
            case 'WS': // Wifi 扫描请求
            case 'WU': // WiFi 模块更新启动
            case 'WC': // WiFi 模块更新完成
            case 'SV': // 固件更新
            case 'MC': // 取消测量
            case 'UI': // 用户列表初始化
                // payload 保持默认 new Uint8Array(0)
                break;

        }

        const totalLen = 8 + payload.length;
        const buffer = new Uint8Array(totalLen);
        buffer[0] = 0x02; buffer[1] = 0x48;
        buffer[2] = ((totalLen - 6) & 0x3f) + 0x0a; 
        buffer[3] = (((totalLen - 6) >> 6) & 0x3f) + 0x0a;
        buffer[4] = action.charCodeAt(0);
        buffer[5] = action.charCodeAt(1);
        buffer.set(payload, 6);

        buffer[totalLen - 2] = this._calculateChecksum(buffer, 1, totalLen - 2);
        buffer[totalLen - 1] = 0x03;
        return buffer.buffer;
    }

    public decode(data: Uint8Array): { frame: RawFrame; consumed: number } | null {
        if (data.length < 8) return null;

        for (let i = 0; i <= data.length - 8; i++) {
            if (data[i] === 0x02 && data[i + 1] === 0x48) { // STX, 'H'
                const bodLen = (data[i + 2] - 0x0a) + ((data[i + 3] - 0x0a) << 6);
                const frameTotalLen = bodLen + 6;
                
                if (frameTotalLen > 2500) continue; // 疑似脏数据，丢弃本位置
                
                if (data.length < i + frameTotalLen) {
                    return null; // 有正常包头且长度合理，但数据仍未收取完整，等待下次数据
                }

                if (data[i + frameTotalLen - 1] !== 0x03) {
                    console.warn(`[H30Protocol] 找到 STX, 但尾部缺少 ETX. 期望长度: ${frameTotalLen}, 实际尾部: 0x${data[i + frameTotalLen - 1].toString(16)}`);
                    continue; // 尾部缺少 ETX
                }

                const expectedCrc = this._calculateChecksum(data, i + 1, i + frameTotalLen - 2);
                const actualCrc = data[i + frameTotalLen - 2];
                if (expectedCrc !== actualCrc) {
                    console.warn(`[H30Protocol] CRC 校验失败! 期望: 0x${expectedCrc.toString(16)}, 实际: 0x${actualCrc.toString(16)}`);
                    continue; // CRC 校验未能通过
                }

                const cmd1 = String.fromCharCode(data[i + 4]);
                const cmd2 = String.fromCharCode(data[i + 5]);
                const payload = data.slice(i + 6, i + frameTotalLen - 2);

                return { 
                  frame: { cmd: cmd1 + cmd2, payload }, 
                  consumed: i + frameTotalLen 
                };
            }
        }

        return null;
    }

    private _calculateChecksum(data: Uint8Array, start: number, end: number): number {
        let sum = 0;
        for (let i = start; i < end; i++) sum += data[i];
        return (sum & 0x3f) + 0x0a;
    }

    /**
     * 将字符串转换为 UTF-8 字节数组 (同步 legacy_js: encodeUtf8)
     */
    private _stringToUtf8(str: string): number[] {
        const bytes: number[] = [];
        for (let i = 0; i < str.length; i++) {
            const charCode = str.charCodeAt(i);
            if (charCode < 0x80) {
                bytes.push(charCode);
            } else if (charCode < 0x800) {
                bytes.push(0xc0 | (charCode >> 6));
                bytes.push(0x80 | (charCode & 0x3f));
            } else if (charCode < 0x10000) {
                bytes.push(0xe0 | (charCode >> 12));
                bytes.push(0x80 | ((charCode >> 6) & 0x3f));
                bytes.push(0x80 | (charCode & 0x3f));
            } else if (charCode < 0x200000) {
                bytes.push(0xf0 | (charCode >> 18));
                bytes.push(0x80 | ((charCode >> 12) & 0x3f));
                bytes.push(0x80 | ((charCode >> 6) & 0x3f));
                bytes.push(0x80 | (charCode & 0x3f));
            } else {
                // 更大的 Unicode 字符按三字节处理或忽略
                bytes.push(0x3f); // '?'
            }
        }
        return bytes;
    }
}
