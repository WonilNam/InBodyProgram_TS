import { H30Protocol } from '../../infrastructure/protocols/framers/H30Protocol';
import { buildRawFrame } from '../helpers/frameBuilder';

describe('H30Protocol', () => {
  let protocol: H30Protocol;

  beforeEach(() => {
    protocol = new H30Protocol();
  });

  // ────────────────────────────────────────
  // encode
  // ────────────────────────────────────────

  describe('encode', () => {
    it('AK 帧: 包头、包尾结构正确', () => {
      const buf = new Uint8Array(protocol.encode('AK'));
      expect(buf[0]).toBe(0x02);       // STX
      expect(buf[1]).toBe(0x48);       // 'H'
      expect(buf[buf.length - 1]).toBe(0x03); // ETX
    });

    it('AK 帧: cmd 字节正确', () => {
      const buf = new Uint8Array(protocol.encode('AK'));
      expect(buf[4]).toBe('A'.charCodeAt(0));
      expect(buf[5]).toBe('K'.charCodeAt(0));
    });

    it('SR 帧: payload 第一字节 = 0x30', () => {
      const buf = new Uint8Array(protocol.encode('SR'));
      expect(buf[6]).toBe(0x30);
    });

    it('HI 帧: sex/age/height 字节编码正确', () => {
      const buf = new Uint8Array(protocol.encode('HI', { sex: 'M', age: 30, height: 175.0 }));
      expect(buf[6]).toBe(0x01);  // sex M = 1
      expect(buf[7]).toBe(30);    // age
      const ht = Math.round(175.0 * 10); // 1750 = 0x06D6
      expect(buf[8]).toBe((ht >> 8) & 0xff);
      expect(buf[9]).toBe(ht & 0xff);
    });

    it('HI 帧: sex=F 编码为 0', () => {
      const buf = new Uint8Array(protocol.encode('HI', { sex: 'F', age: 25, height: 160.0 }));
      expect(buf[6]).toBe(0x00);
    });

    it('DD 帧: 编码用户删除列表 count + UID(25B) + nickName(7B)', () => {
      const buf = new Uint8Array(protocol.encode('DD', { userList: [{ UID: 'USER001', nickName: 'Tester' }] }));

      expect(buf[4]).toBe('D'.charCodeAt(0));
      expect(buf[5]).toBe('D'.charCodeAt(0));
      expect(buf[6]).toBe(1);
      expect(String.fromCharCode(...buf.slice(7, 14))).toBe('USER001');
      expect(String.fromCharCode(...buf.slice(32, 38))).toBe('Tester');
    });

    it('DD 帧: 支持一次删除多个用户', () => {
      const buf = new Uint8Array(protocol.encode('DD', {
        userList: [
          { UID: 'USER001', nickName: 'Tester' },
          { UID: 'USER002', nickName: 'Guest' },
        ]
      }));

      expect(buf[6]).toBe(2);
      expect(String.fromCharCode(...buf.slice(39, 46))).toBe('USER002');
      expect(String.fromCharCode(...buf.slice(64, 69))).toBe('Guest');
    });

    it('校验和在合法范围 [0x0a, 0x49]', () => {
      const buf = new Uint8Array(protocol.encode('AK'));
      const crc = buf[buf.length - 2];
      expect(crc).toBeGreaterThanOrEqual(0x0a);
      expect(crc).toBeLessThanOrEqual(0x49);
    });
  });

  // ────────────────────────────────────────
  // decode
  // ────────────────────────────────────────

  describe('decode', () => {
    it('合法帧: 返回正确 cmd 和 consumed', () => {
      const raw = buildRawFrame('AK', new Uint8Array(8));
      const result = protocol.decode(raw);
      expect(result).not.toBeNull();
      expect(result!.frame.cmd).toBe('AK');
      expect(result!.consumed).toBe(raw.length);
    });

    it('合法帧: payload 内容正确', () => {
      const payload = new Uint8Array([0x01, 0x02, 0x03]);
      const raw = buildRawFrame('HW', payload);
      const result = protocol.decode(raw);
      expect(result!.frame.payload).toEqual(payload);
    });

    it('数据不完整: 返回 null', () => {
      const raw = buildRawFrame('AK', new Uint8Array(8));
      const partial = raw.slice(0, raw.length - 3);
      expect(protocol.decode(partial)).toBeNull();
    });

    it('数据长度不足 8 字节: 返回 null', () => {
      expect(protocol.decode(new Uint8Array([0x02, 0x48, 0x0a, 0x0a]))).toBeNull();
    });

    it('ETX 不正确: 跳过该帧', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const raw = buildRawFrame('AK', new Uint8Array(4)).slice(); // copy
      raw[raw.length - 1] = 0x00; // 破坏 ETX
      expect(protocol.decode(raw)).toBeNull();
      warnSpy.mockRestore();
    });

    it('校验和错误: 跳过该帧', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const raw = buildRawFrame('AK', new Uint8Array(4)).slice();
      raw[raw.length - 2] = 0xff; // 破坏 CRC
      expect(protocol.decode(raw)).toBeNull();
      warnSpy.mockRestore();
    });

    it('带垃圾前缀: 仍能找到有效帧', () => {
      const valid = buildRawFrame('SR', new Uint8Array([0x30]));
      const garbage = new Uint8Array([0x00, 0xff, 0xaa, 0xbb]);
      const combined = new Uint8Array(garbage.length + valid.length);
      combined.set(garbage);
      combined.set(valid, garbage.length);
      const result = protocol.decode(combined);
      expect(result).not.toBeNull();
      expect(result!.frame.cmd).toBe('SR');
      expect(result!.consumed).toBe(combined.length);
    });

    it('encode → decode 往返一致', () => {
      const encoded = new Uint8Array(protocol.encode('SR'));
      const result = protocol.decode(encoded);
      expect(result!.frame.cmd).toBe('SR');
      expect(result!.frame.payload[0]).toBe(0x30);
    });
  });
});
