import { H30ProtocolParser } from '../../infrastructure/protocols/parsers/H30ProtocolParser';
import { InBodyDeviceState } from '../../domain/entities/InBodyDevice.entity';
import { InBodyResult } from '../../domain/entities/DeviceResponse.entity';
import {
  buildFrame,
  buildHWFrame,
  buildHMFrame,
  buildHPFrame,
  buildAKFrame,
  buildHRFrame,
  buildRawFrame,
} from '../helpers/frameBuilder';

describe('H30ProtocolParser', () => {
  let parser: H30ProtocolParser;

  beforeEach(() => {
    parser = new H30ProtocolParser();
  });

  const device = 'H30' as const;

  // ────────────────────────────────────────
  // parseIncomingData — 各帧类型
  // ────────────────────────────────────────

  describe('parseIncomingData', () => {
    it('数据不足时返回 BUFFERING', () => {
      const result = parser.parseIncomingData(device, new Uint8Array([0x02, 0x48]).buffer);
      expect(result.cmd).toBe('BUFFERING');
    });

    it('空 ArrayBuffer 返回 BUFFERING', () => {
      const result = parser.parseIncomingData(device, new ArrayBuffer(0));
      expect(result.cmd).toBe('BUFFERING');
    });

    it('HW 帧: 正确解析重量', () => {
      const result = parser.parseIncomingData(device, buildHWFrame(75.5)) as any;
      expect(result.cmd).toBe('HW');
      expect(result.weight).toBeCloseTo(75.5, 1);
    });

    it('HW 帧: 重量 0.0 kg 不崩溃', () => {
      const result = parser.parseIncomingData(device, buildHWFrame(0)) as any;
      expect(result.cmd).toBe('HW');
      expect(result.weight).toBe(0);
    });

    it('HM 帧: 正确解析进度', () => {
      const result = parser.parseIncomingData(device, buildHMFrame(50)) as any;
      expect(result.cmd).toBe('HM');
      expect(result.progress).toBe(50);
    });

    it('HM 帧: 进度 100% 仍保持 cmd=HM', () => {
      const result = parser.parseIncomingData(device, buildHMFrame(100)) as any;
      expect(result.cmd).toBe('HM');
      expect(result.progress).toBe(100);
    });

    it('HP 帧: 正确解析 statu', () => {
      const result = parser.parseIncomingData(device, buildHPFrame(1)) as any;
      expect(result.cmd).toBe('HP');
      expect(result.statu).toBe(1);
    });

    it('AK 帧: 返回 cmd=AK 并包含各字段', () => {
      const result = parser.parseIncomingData(device, buildAKFrame()) as any;
      expect(result.cmd).toBe('AK');
      // 全零载荷时 serialNumber 等字段为空字符串
      expect(result).toHaveProperty('serialNumber');
      expect(result).toHaveProperty('batteryVoltage');
    });

    it('AK 帧: 正确解码包含中文和空格的 SSID', () => {
      const payload = new Uint8Array(113);
      const ssidBytes = new TextEncoder().encode('中文 WiFi');
      payload.set(ssidBytes, 73);

      const result = parser.parseIncomingData(device, buildFrame('AK', payload)) as any;

      expect(result.cmd).toBe('AK');
      expect(result.ssid).toBe('中文 WiFi');
    });

    it('AK 帧: SSID 展示时过滤不可见控制字符', () => {
      const payload = new Uint8Array(113);
      payload.set(new Uint8Array([0x64, 0x08, 0x16]), 73);

      const result = parser.parseIncomingData(device, buildFrame('AK', payload)) as any;

      expect(result.cmd).toBe('AK');
      expect(result.ssid).toBe('d');
    });

    it('AK 帧: 电池电压按实际电压 x100 解析', () => {
      const payload = new Uint8Array(113);
      payload[108] = 0x02;
      payload[109] = 0x2b; // 555 => 5.55V

      const result = parser.parseIncomingData(device, buildFrame('AK', payload)) as any;

      expect(result.cmd).toBe('AK');
      expect(result.batteryVoltage).toBe(5.55);
    });

    it('WR 帧: 正确解析包含字母、数字、空格和中文的 WiFi 热点', () => {
      const ssid = 'Home 5G 中文 WiFi';
      const ssidBytes = new TextEncoder().encode(ssid);
      const prefix = new TextEncoder().encode(`${ssidBytes.length} `);
      const suffix = new TextEncoder().encode(' AA:BB:CC:DD:EE:FF 01 02 06 C8');
      const record = new Uint8Array(prefix.length + ssidBytes.length + suffix.length + 1);
      record.set(prefix, 0);
      record.set(ssidBytes, prefix.length);
      record.set(suffix, prefix.length + ssidBytes.length);
      record[record.length - 1] = 0xff;

      const payload = new Uint8Array(5 + record.length);
      payload[0] = 1; // count
      payload[1] = 1; // packageCount
      payload[2] = 0; // readIndex
      payload[3] = 1; // searchedWifiCount
      payload[4] = 0; // legacy 保留位
      payload.set(record, 5);

      const result = parser.parseIncomingData(device, buildFrame('WR', payload)) as any;

      expect(result.cmd).toBe('WR');
      expect(result.wifiInfo).toHaveLength(1);
      expect(result.wifiInfo[0].ssid).toBe(ssid);
      expect(result.wifiInfo[0].macAddr).toBe('AA:BB:CC:DD:EE:FF');
    });

    it('HR 帧: cmd 被归一化为 HR', () => {
      const result = parser.parseIncomingData(device, buildHRFrame()) as any;
      expect(result.cmd).toBe('HR');
      expect(result.isCompleted).toBe(true);
      expect(result).toHaveProperty('weight');
      expect(result).toHaveProperty('pbf');
      expect(result).toHaveProperty('bmi');
    });

    it('HR 帧: 227 字节载荷可解析为完整报告', () => {
      const payload = new Uint8Array(227);
      payload[8] = 0x02;
      payload[9] = 0x77; // weight = 63.1
      payload[10] = 0x00;
      payload[11] = 0xc8; // pbf = 20.0
      payload[12] = 0x01;
      payload[13] = 0x41; // smm = 32.1
      payload[225] = 1;
      payload[226] = 30;

      const result = parser.parseIncomingData(device, buildFrame('HR', payload)) as any;

      expect(result.cmd).toBe('HR');
      expect(result.isCompleted).toBe(true);
      expect(result.weight).toBeCloseTo(63.1, 1);
      expect(result.pbf).toBeCloseTo(20.0, 1);
      expect(result.smm).toBeCloseTo(32.1, 1);
      expect(result.sex).toBe(1);
      expect(result.age).toBe(30);
      expect(result.inllLv).toBe(0);
    });

    it('HR 帧: 测量结果字段名与 parser 输出保持一致', () => {
      const payload = new Uint8Array(233);
      const writeWord = (offset: number, value: number) => {
        payload[offset] = (value >> 8) & 0xff;
        payload[offset + 1] = value & 0xff;
      };

      writeWord(12, 321);  // smm = 32.1
      writeWord(46, 555);  // slm = 55.5
      writeWord(72, 300);  // iSMM = 30.0
      writeWord(74, 123);  // iBFM = 12.3
      writeWord(76, 950);  // pwt = 95.0
      writeWord(192, 876); // psmm = 87.6

      const result = parser.parseIncomingData(device, buildFrame('HR', payload)) as any;

      expect(result.smm).toBeCloseTo(32.1, 1);
      expect(result.slm).toBeCloseTo(55.5, 1);
      expect(result.iSMM).toBeCloseTo(30.0, 1);
      expect(result.iBFM).toBeCloseTo(12.3, 1);
      expect(result.pwt).toBeCloseTo(95.0, 1);
      expect(result.psmm).toBeCloseTo(87.6, 1);
      expect(result).not.toHaveProperty('leanMass');
      expect(result).not.toHaveProperty('idealSLM');
      expect(result).not.toHaveProperty('idealBFM');
      expect(result).not.toHaveProperty('pslm');
    });

    it('HE 帧: 正确解析错误 code', () => {
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const payload = new Uint8Array(10);
      // code 在 offset 6 开始读 4 字节，填写 'E001'
      payload[6] = 'E'.charCodeAt(0);
      payload[7] = '0'.charCodeAt(0);
      payload[8] = '0'.charCodeAt(0);
      payload[9] = '1'.charCodeAt(0);
      const result = parser.parseIncomingData(device, buildFrame('HE', payload)) as any;
      expect(result.cmd).toBe('HE');
      expect(result.code).toContain('E001');
      errorSpy.mockRestore();
    });
  });

  // ────────────────────────────────────────
  // 缓冲区积累 (流式数据)
  // ────────────────────────────────────────

  describe('流式缓冲', () => {
    it('分两次到达的帧可正常拼合解析', () => {
      const raw = buildRawFrame('HW', new Uint8Array([0x02, 0xF3])); // 75.5 kg
      const half = Math.floor(raw.length / 2);

      // 第一半 → BUFFERING
      const partial = parser.parseIncomingData(device, raw.slice(0, half).buffer);
      expect(partial.cmd).toBe('BUFFERING');

      // 第二半 → 完整帧
      const full = parser.parseIncomingData(device, raw.slice(half).buffer) as any;
      expect(full.cmd).toBe('HW');
      expect(full.weight).toBeCloseTo(75.5, 1);
    });

    it('解析完成后再传空 buffer 返回 BUFFERING（缓冲已消费）', () => {
      parser.parseIncomingData(device, buildHWFrame(60));
      const result = parser.parseIncomingData(device, new ArrayBuffer(0));
      expect(result.cmd).toBe('BUFFERING');
    });

    it('缓冲区超过 4096 字节时触发 OOM 保护不抛错', () => {
      const garbage = new Uint8Array(5000).fill(0xaa); // 不含合法包头
      expect(() => {
        parser.parseIncomingData(device, garbage.buffer);
      }).not.toThrow();
    });

    it('OOM 保护后仍可解析后续合法帧', () => {
      const garbage = new Uint8Array(5000).fill(0xaa);
      parser.parseIncomingData(device, garbage.buffer);

      // 发送完整合法帧
      const result = parser.parseIncomingData(device, buildHWFrame(50)) as any;
      expect(result.cmd).toBe('HW');
    });
  });

  // ────────────────────────────────────────
  // Trait 提取方法
  // ────────────────────────────────────────

  describe('extractWeight (IWeightTrait)', () => {
    it('HW result → 返回 weight 数值', () => {
      const res = parser.parseIncomingData(device, buildHWFrame(80.2)) as any;
      expect(parser.extractWeight(res)).toBeCloseTo(80.2, 1);
    });

    it('非 HW result → 返回 undefined', () => {
      const res = parser.parseIncomingData(device, buildHMFrame(30)) as any;
      expect(parser.extractWeight(res)).toBeUndefined();
    });
  });

  describe('extractProgress (IProgressTrait)', () => {
    it('HM result → 返回进度值', () => {
      const res = parser.parseIncomingData(device, buildHMFrame(75)) as any;
      expect(parser.extractProgress(res)).toBe(75);
    });

    it('非 HM/HP result → 返回 undefined', () => {
      const res = parser.parseIncomingData(device, buildHWFrame(60)) as any;
      expect(parser.extractProgress(res)).toBeUndefined();
    });
  });

  describe('extractPosture (IPostureTrait)', () => {
    it('HP result → 返回 statu 字段', () => {
      const res = parser.parseIncomingData(device, buildHPFrame(0)) as any;
      expect(parser.extractPosture(res)).toBe(0);
    });

    it('非 HP result → 返回 undefined', () => {
      const res = parser.parseIncomingData(device, buildHWFrame(60)) as any;
      expect(parser.extractPosture(res)).toBeUndefined();
    });
  });

  // ────────────────────────────────────────
  // evaluateTransition (状态机)
  // ────────────────────────────────────────

  describe('evaluateTransition', () => {
    const params = { uid: 'u1', nickname: 'N', age: 30, height: 175, sex: 'M' as const };

    it('INITIAL + AK → REGISTERING，附带 UL 指令', () => {
      const akResult: InBodyResult = { deviceId: '', isCompleted: false, cmd: 'AK' } as any;
      const t = parser.evaluateTransition(InBodyDeviceState.INITIAL, akResult, params);
      expect(t.nextState).toBe(InBodyDeviceState.REGISTERING);
      expect(t.nextCommand?.action).toBe('UL');
    });

    it('MEASUREMENT_STARTED + HW → MEASURING_WEIGHT，继续轮询 HW', () => {
      const hwResult: InBodyResult = { deviceId: '', isCompleted: false, cmd: 'HW', weight: 60 } as any;
      const t = parser.evaluateTransition(InBodyDeviceState.MEASUREMENT_STARTED, hwResult, params);
      expect(t.nextState).toBe(InBodyDeviceState.MEASURING_WEIGHT);
      expect(t.nextCommand?.action).toBe('HW');
    });

    it('MEASUREMENT_STARTED + HR 且未完成 → 维持当前状态', () => {
      const hrResult: InBodyResult = { deviceId: '', isCompleted: false, cmd: 'HR' } as any;
      const t = parser.evaluateTransition(InBodyDeviceState.MEASUREMENT_STARTED, hrResult, params);
      expect(t.nextState).toBe(InBodyDeviceState.MEASUREMENT_STARTED);
    });

    it('MEASUREMENT_STARTED + HE（设备报错）→ POSTURE_CHECKING 并继续 HP', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const heResult: InBodyResult = { deviceId: '', isCompleted: false, cmd: 'HE' } as any;
      const t = parser.evaluateTransition(InBodyDeviceState.MEASUREMENT_STARTED, heResult, params);
      expect(t.nextState).toBe(InBodyDeviceState.POSTURE_CHECKING);
      expect(t.nextCommand?.action).toBe('HP');
      warnSpy.mockRestore();
    });

    it('isCompleted=true → COMPLETED', () => {
      const completedResult: InBodyResult = { deviceId: '', isCompleted: true, cmd: 'HR' } as any;
      const t = parser.evaluateTransition(InBodyDeviceState.MEASUREMENT_STARTED, completedResult, params);
      expect(t.nextState).toBe(InBodyDeviceState.COMPLETED);
    });

    it('未知 cmd → 维持当前状态', () => {
      const unknown: InBodyResult = { deviceId: '', isCompleted: false, cmd: 'XX' } as any;
      const t = parser.evaluateTransition(InBodyDeviceState.MEASUREMENT_STARTED, unknown, params);
      expect(t.nextState).toBe(InBodyDeviceState.MEASUREMENT_STARTED);
    });
  });

  // ────────────────────────────────────────
  // getExpectedResponseCmds (BaseProtocolParser)
  // ────────────────────────────────────────

  describe('getExpectedResponseCmds', () => {
    it('AK 指令期望 [AK]', () => {
      expect(parser.getExpectedResponseCmds('AK')).toEqual(['AK']);
    });

    it('未知指令: 回传自身', () => {
      expect(parser.getExpectedResponseCmds('XY')).toEqual(['XY']);
    });
  });
});
