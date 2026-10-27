import { IProtocol, RawFrame } from '../framers/IProtocol';

/**
 * InBody 120 全功能协议实现 (AT 文本帧格式)
 * 帧格式: [AT] [LEN(3位ASCII)] [CMD(1B)] [...payload(ASCII)...] [CRC_HI] [CRC_LO] [CR] [LF]
 */
export class InBody120Protocol implements IProtocol {

    public encode(action: string, context?: any): ArrayBuffer {
        const cmdChar = action.substring(0, 1);
        const payloadStr = this._buildPayloadString(cmdChar, context);
        const dataAreaLen = 1 + payloadStr.length; // CMD + payload
        const totalLen = 9 + dataAreaLen;           // AT(2) + LEN(3) + CMD(1) + payload + CRC(2) + CRLF(2) - 1 (CMD counted in dataAreaLen)
        const buffer = new Uint8Array(totalLen);

        // AT 头
        buffer[0] = 0x41; // 'A'
        buffer[1] = 0x54; // 'T'

        // 长度字段 (3位十进制 ASCII)
        const lenStr = dataAreaLen.toString().padStart(3, '0');
        buffer[2] = lenStr.charCodeAt(0);
        buffer[3] = lenStr.charCodeAt(1);
        buffer[4] = lenStr.charCodeAt(2);

        // 指令码
        buffer[5] = cmdChar.charCodeAt(0);

        // payload
        for (let i = 0; i < payloadStr.length; i++) {
            buffer[6 + i] = payloadStr.charCodeAt(i);
        }

        // CRC: 从 LEN 字段开始到 payload 结束
        const crc = this._calculateAtChecksum(buffer, 2, totalLen - 4);
        buffer[totalLen - 4] = crc.charCodeAt(0);
        buffer[totalLen - 3] = crc.charCodeAt(1);

        // CRLF
        buffer[totalLen - 2] = 0x0d;
        buffer[totalLen - 1] = 0x0a;

        return buffer.buffer;
    }

    /**
     * 根据指令构建 ASCII payload 字符串
     * 
     * 'u' 指令 (用户信息): sex,age,height → "M,30,175.0"
     * 't' 指令 (时间同步): YYMMDDHHmm,C → "1301010101,C"
     * 其他指令: 空串
     */
    private _buildPayloadString(cmd: string, context?: any): string {
        if (cmd === 'u' && context) {
            // 对齐旧版 setHRFrame: u + sex(M/F) + , + age + , + height
            const sex = context.sex === 'M' ? 'M' : 'F';
            const age = String(context.age || 0);
            const heightValue = Number(context.height || 0);
            const height = heightValue.toFixed(1);
            return `${sex},${age},${height}`;
        }

        if (cmd === 't') {
            // 对齐 PDF: t + YYMMDDHHmm + ,C
            const now = new Date();
            const pad = (n: number) => n.toString().padStart(2, '0');
            const year = pad(now.getFullYear() % 100);
            const dateStr = `${year}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;
            return `${dateStr},C`;
        }

        return '';
    }

    public decode(data: Uint8Array): { frame: RawFrame; consumed: number } | null {
        if (data.length < 9) return null;

        for (let i = 0; i <= data.length - 9; i++) {
            if (data[i] === 0x41 && data[i + 1] === 0x54) { // 'A', 'T'
                const lenStr = String.fromCharCode(data[i + 2], data[i + 3], data[i + 4]);
                const dataAreaLen = parseInt(lenStr, 10);
                if (isNaN(dataAreaLen) || dataAreaLen > 2000) continue;

                const frameTotalLen = 9 + dataAreaLen;
                if (data.length < i + frameTotalLen) {
                    return null; // 存在可能的包头但数据未接收完，继续等待
                }

                // 校验 CRC
                const expectedCrc = String.fromCharCode(data[i + frameTotalLen - 4], data[i + frameTotalLen - 3]).toUpperCase();
                const actualCrc = this._calculateAtChecksum(data, i + 2, i + frameTotalLen - 4);
                
                if (actualCrc !== expectedCrc) {
                    // 旧版 inbody120.js 在校验不一致时，只要完整长度满足 dataLen + 9 也接受该帧。
                    // 真机存在这种回包，严格丢弃会导致已完成测量但 SDK 等待超时。
                    console.warn(`[InBody120Protocol] CRC mismatch accepted by length: expected=${expectedCrc}, actual=${actualCrc}`);
                }

                const cmd = String.fromCharCode(data[i + 5]);
                const payload = data.slice(i + 6, i + frameTotalLen - 4);

                return { frame: { cmd, payload }, consumed: i + frameTotalLen };
            }
        }

        return null;
    }

    private _calculateAtChecksum(data: Uint8Array, start: number, end: number): string {
        let sum = 0;
        for (let i = start; i < end; i++) sum += data[i];
        return (sum & 0xff).toString(16).toUpperCase().padStart(2, '0');
    }
}
