import { IProtocol, RawFrame } from '../framers/IProtocol';

/**
 * H20 物理层协议实现 (Physical Framing Only)
 * 帧格式: [STX(0x02)] [0x48('H')] [BOD0] [BOD1] [CMD0] [CMD1] [...payload...] [CRC] [ETX(0x03)]
 */
export class H20Protocol implements IProtocol {

    public encode(action: string, context?: any): ArrayBuffer {
        // 根据指令构建 payload
        const payload = this._buildPayload(action, context);
        const totalLen = 8 + payload.length;
        const buffer = new Uint8Array(totalLen);
        const bodLen = 2 + payload.length;

        buffer[0] = 0x02;  // STX
        buffer[1] = 0x48;  // 'H'
        buffer[2] = (bodLen & 0x3f) + 0x0a;        // BOD0
        buffer[3] = ((bodLen >> 6) & 0x3f) + 0x0a;  // BOD1
        buffer[4] = action.charCodeAt(0);            // CMD0
        buffer[5] = action.charCodeAt(1);            // CMD1

        // 填充 payload
        for (let i = 0; i < payload.length; i++) {
            buffer[6 + i] = payload[i];
        }

        buffer[totalLen - 2] = this._calculateBinaryChecksum(buffer, 1, totalLen - 2);
        buffer[totalLen - 1] = 0x03;  // ETX

        return buffer.buffer;
    }

    /**
     * 根据指令类型构建 payload
     * HC/HR: [sex(1B), age(1B), height_hi(1B), height_lo(1B)] = 4 bytes
     * 其他指令: 空 payload
     */
    private _buildPayload(action: string, context?: any): Uint8Array {
        if ((action === 'HC' || action === 'HR') && context) {
            const payload = new Uint8Array(4);
            // sex: 0x01=M, 0x00=F (与旧版 setHCFrame/setHRFrame 一致)
            payload[0] = context.sex === 'M' ? 0x01 : 0x00;
            // age: 直接作为字节值
            payload[1] = (typeof context.age === 'number') ? context.age : parseInt(context.age) || 0;
            // height: 乘以10后拆分为高/低字节
            const ht = Math.round((context.height || 0) * 10);
            payload[2] = (ht >> 8) & 0xff;
            payload[3] = ht & 0xff;
            return payload;
        }

        return new Uint8Array(0);
    }

    public decode(data: Uint8Array): { frame: RawFrame; consumed: number } | null {
        if (data.length < 8) return null;

        for (let i = 0; i <= data.length - 8; i++) {
            if (data[i] === 0x02 && data[i + 1] === 0x48) { // STX, 'H'
                const bodLen = ((data[i + 2] - 0x0a) & 0x3f) + (((data[i + 3] - 0x0a) & 0x3f) << 6);
                const frameTotalLen = bodLen + 6;
                
                if (frameTotalLen > 2500) continue; // 长度异常，必定是伪造头
                
                if (data.length < i + frameTotalLen) {
                    return null; // 找到头但数据不足
                }
                
                if (data[i + frameTotalLen - 1] !== 0x03) {
                    continue; // ETX 对不上
                }

                if (this._calculateBinaryChecksum(data, i + 1, i + frameTotalLen - 2) !== data[i + frameTotalLen - 2]) {
                    continue; // 校验和对不上
                }

                const cmd = String.fromCharCode(data[i + 4], data[i + 5]);
                const payload = data.slice(i + 6, i + frameTotalLen - 2);

                return { 
                  frame: { cmd, payload }, 
                  consumed: i + frameTotalLen 
                };
            }
        }

        return null;
    }

    private _calculateBinaryChecksum(data: Uint8Array, start: number, end: number): number {
        let sum = 0;
        for (let i = start; i < end; i++) sum += data[i];
        return (sum & 0x3f) + 0x0a;
    }
}
