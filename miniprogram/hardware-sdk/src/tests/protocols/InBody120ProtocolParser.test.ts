import { InBody120ProtocolParser } from '../../infrastructure/protocols/parsers/120ProtocolParser';
import { InBodyDeviceState } from '../../domain/entities/InBodyDevice.entity';

function buildAtFrame(cmd: string, payload: string, crc = '00'): ArrayBuffer {
  const dataAreaLen = 1 + payload.length;
  const text = `AT${String(dataAreaLen).padStart(3, '0')}${cmd}${payload}${crc}\r\n`;
  return Uint8Array.from(Array.from(text).map(ch => ch.charCodeAt(0))).buffer;
}

describe('InBody120ProtocolParser', () => {
  it('按真机回包兼容小写 p 进度帧', () => {
    const parser = new InBody120ProtocolParser();
    const result = parser.parseIncomingData('120', buildAtFrame('p', '40', '00')) as any;

    expect(result.cmd).toBe('p');
    expect(result.progress).toBe(40);
    expect(parser.extractProgress(result)).toBe(40);
  });

  it('兼容小写 p100 作为 100% 进度帧', () => {
    const parser = new InBody120ProtocolParser();
    const result = parser.parseIncomingData('120', buildAtFrame('p', '100', '00')) as any;

    expect(result.cmd).toBe('p');
    expect(result.progress).toBe(100);
    expect(parser.extractProgress(result)).toBe(100);
  });

  it('解析 PDF 协议的 w 体重回传和 P 进度回传', () => {
    const parser = new InBody120ProtocolParser();
    const weight = parser.parseIncomingData('120', buildAtFrame('w', '51.3', '00')) as any;
    const progress = parser.parseIncomingData('120', buildAtFrame('P', '10', '00')) as any;

    expect(weight.cmd).toBe('w');
    expect(weight.weight).toBe(51.3);
    expect(parser.extractWeight(weight)).toBe(51.3);
    expect(progress.cmd).toBe('P');
    expect(progress.progress).toBe(10);
    expect(parser.extractProgress(progress)).toBe(10);
  });

  it('r 结果帧将旧版 is 字段映射为 fitScore', () => {
    const parser = new InBody120ProtocolParser();
    const values = Array.from({ length: 98 }, () => '0');
    values[0] = 'M';
    values[1] = '175';
    values[2] = '30';
    values[3] = '63.1';
    values[11] = '32.5';
    values[22] = '104.5';
    values[38] = '14.5';
    values[39] = '7.2';
    values[48] = '0.90';
    values[49] = '0.80';
    values[54] = '41.4';
    values[55] = '33.9';
    values[60] = '60.2';
    values[64] = '80';
    values[94] = '41.4';
    values[95] = '33.9';

    const result = parser.parseIncomingData('120', buildAtFrame('r', values.join(','), '00')) as any;

    expect(result.cmd).toBe('r');
    expect(result.isCompleted).toBe(true);
    expect(result.smm).toBe(32.5);
    expect(result.smmp).toBe(104.5);
    expect(result.bfmMax).toBe(14.5);
    expect(result.bfmMin).toBe(7.2);
    expect(result.whrMax).toBe(0.9);
    expect(result.whrMin).toBe(0.8);
    expect(result.tbwMax).toBe(41.4);
    expect(result.tbwMin).toBe(33.9);
    expect(result.iWeight).toBe(60.2);
    expect(result.fitScore).toBe(80);
    expect(result.smmMax).toBe(41.4);
    expect(result.smmMin).toBe(33.9);
    expect(result.slm).toBeUndefined();
    expect(result.slmp).toBeUndefined();
    expect(result.is).toBeUndefined();
  });

  it('按 PDF 顺序定义 t/u/r/s 指令期望回包', () => {
    const parser = new InBody120ProtocolParser();

    expect(parser.getExpectedResponseCmds('t')).toEqual(['t']);
    expect(parser.getExpectedResponseCmds('u')).toEqual(['u', 'e']);
    expect(parser.getExpectedResponseCmds('r')).toEqual(['r']);
    expect(parser.getExpectedResponseCmds('s')).toEqual(['s']);
  });

  it('状态机按 PDF 流程 t -> u -> w/P/r 推进', () => {
    const parser = new InBody120ProtocolParser();
    const params = { uid: 'u1', nickname: 'N', sex: 'M', age: 30, height: 175 } as any;

    const afterTime = parser.evaluateTransition(
      InBodyDeviceState.INITIAL,
      { deviceId: '', isCompleted: false, cmd: 't' } as any,
      params
    );
    expect(afterTime.nextState).toBe(InBodyDeviceState.USER_CONFIGURING);
    expect(afterTime.nextCommand).toEqual({ action: 'u', context: params });

    const afterUser = parser.evaluateTransition(
      InBodyDeviceState.USER_CONFIGURING,
      { deviceId: '', isCompleted: false, cmd: 'u' } as any,
      params
    );
    expect(afterUser.nextState).toBe(InBodyDeviceState.MEASUREMENT_STARTED);
    expect(afterUser.nextCommand).toBeUndefined();

    const afterWeight = parser.evaluateTransition(
      InBodyDeviceState.MEASUREMENT_STARTED,
      { deviceId: '', isCompleted: false, cmd: 'w' } as any,
      params
    );
    expect(afterWeight.nextState).toBe(InBodyDeviceState.WEIGHT_CONFIRMED);

    const afterProgress = parser.evaluateTransition(
      InBodyDeviceState.WEIGHT_CONFIRMED,
      { deviceId: '', isCompleted: false, cmd: 'p', progress: 40 } as any,
      params
    );
    expect(afterProgress.nextState).toBe(InBodyDeviceState.ANALYZING);
  });
});
