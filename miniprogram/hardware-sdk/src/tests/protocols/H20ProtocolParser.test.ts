import { H20ProtocolParser } from '../../infrastructure/protocols/parsers/H20ProtocolParser';
import { InBodyDeviceState } from '../../domain/entities/InBodyDevice.entity';

function buildH20Frame(cmd: string, payload: Uint8Array): ArrayBuffer {
  const totalLen = 8 + payload.length;
  const bodLen = 2 + payload.length;
  const buffer = new Uint8Array(totalLen);

  buffer[0] = 0x02;
  buffer[1] = 0x48;
  buffer[2] = (bodLen & 0x3f) + 0x0a;
  buffer[3] = ((bodLen >> 6) & 0x3f) + 0x0a;
  buffer[4] = cmd.charCodeAt(0);
  buffer[5] = cmd.charCodeAt(1);
  buffer.set(payload, 6);

  let checksum = 0;
  for (let i = 1; i < totalLen - 2; i++) checksum += buffer[i];
  buffer[totalLen - 2] = (checksum & 0x3f) + 0x0a;
  buffer[totalLen - 1] = 0x03;

  return buffer.buffer;
}

function writeWord(payload: Uint8Array, offset: number, value: number): void {
  payload[offset] = (value >> 8) & 0xff;
  payload[offset + 1] = value & 0xff;
}

describe('H20ProtocolParser', () => {
  const parser = new H20ProtocolParser();
  const params = { uid: 'u1', nickname: 'N', age: 30, height: 175, sex: 'M' } as const;

  it('HC 短帧按旧协议视为未完成', () => {
    const result = parser.parseIncomingData('H20', buildH20Frame('HC', new Uint8Array(4))) as any;

    expect(result.cmd).toBe('HC');
    expect(result.isCompleted).toBe(false);
  });

  it('HC 长帧按旧协议视为完整测量结果', () => {
    const payload = new Uint8Array(92);
    writeWord(payload, 0, 1750);
    writeWord(payload, 2, 631);
    writeWord(payload, 4, 201);
    writeWord(payload, 6, 280);
    payload[8] = 0;
    payload[9] = 7;

    const result = parser.parseIncomingData('H20', buildH20Frame('HC', payload)) as any;

    expect(result.cmd).toBe('HC');
    expect(result.isCompleted).toBe(true);
    expect(result.height).toBe(175);
    expect(result.weight).toBe(63.1);
    expect(result.pbf).toBe(20.1);
    expect(result.slm).toBe(28);
    expect(result.vfaLevel).toBe(7);
  });

  it('INITIAL + HC 短帧进入测量中，等待后续长帧', () => {
    const transition = parser.evaluateTransition(
      InBodyDeviceState.INITIAL,
      { deviceId: '', isCompleted: false, cmd: 'HC' } as any,
      params
    );

    expect(transition.nextState).toBe(InBodyDeviceState.MEASUREMENT_STARTED);
    expect(transition.nextCommand).toBeUndefined();
  });

  it('HA 中断帧进入 CANCELLED', () => {
    const transition = parser.evaluateTransition(
      InBodyDeviceState.MEASUREMENT_STARTED,
      { deviceId: '', isCompleted: false, cmd: 'HA' } as any,
      params
    );

    expect(transition.nextState).toBe(InBodyDeviceState.CANCELLED);
  });

  it('HC/HR 指令期望旧协议的 HC/HR/HA 回包', () => {
    expect(parser.getExpectedResponseCmds('HC')).toEqual(['HC', 'HR', 'HA']);
    expect(parser.getExpectedResponseCmds('HR')).toEqual(['HC', 'HR', 'HA']);
  });
});
