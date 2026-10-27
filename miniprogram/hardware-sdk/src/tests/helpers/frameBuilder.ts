/**
 * H30 物理帧构造工具 —— 复刻 H30Protocol 的封帧逻辑供测试使用。
 * 格式: [0x02, 0x48, lenLow, lenHigh, cmd1, cmd2, ...payload, crc, 0x03]
 */
export function buildRawFrame(cmd: string, payload: Uint8Array): Uint8Array {
  const totalLen = 8 + payload.length;
  const buf = new Uint8Array(totalLen);

  buf[0] = 0x02; // STX
  buf[1] = 0x48; // 'H'
  buf[2] = ((totalLen - 6) & 0x3f) + 0x0a;
  buf[3] = (((totalLen - 6) >> 6) & 0x3f) + 0x0a;
  buf[4] = cmd.charCodeAt(0);
  buf[5] = cmd.charCodeAt(1);
  buf.set(payload, 6);

  // 校验和: sum(buf[1..totalLen-3]) & 0x3f + 0x0a
  let sum = 0;
  for (let i = 1; i < totalLen - 2; i++) sum += buf[i];
  buf[totalLen - 2] = (sum & 0x3f) + 0x0a;
  buf[totalLen - 1] = 0x03; // ETX

  return buf;
}

/** 返回 ArrayBuffer 版本，供 parseIncomingData 使用 */
export function buildFrame(cmd: string, payload: Uint8Array): ArrayBuffer {
  return buildRawFrame(cmd, payload).buffer as ArrayBuffer;
}

/** 构造 HW（实时重量）帧, weight 单位 kg，精度 0.1 */
export function buildHWFrame(weightKg: number): ArrayBuffer {
  const raw = Math.round(weightKg * 10);
  const payload = new Uint8Array(2);
  payload[0] = (raw >> 8) & 0xff;
  payload[1] = raw & 0xff;
  return buildFrame('HW', payload);
}

/** 构造 HM（测量进度）帧 */
export function buildHMFrame(progress: number): ArrayBuffer {
  return buildFrame('HM', new Uint8Array([progress]));
}

/** 构造 HP（姿势检测）帧 */
export function buildHPFrame(deviceState: number): ArrayBuffer {
  return buildFrame('HP', new Uint8Array([deviceState]));
}

/** 构造最小合法 AK 帧（载荷全零，113 字节满足解析器最大偏移） */
export function buildAKFrame(): ArrayBuffer {
  return buildFrame('AK', new Uint8Array(113));
}

/** 构造最小合法 HR 帧（227 字节包含到 age，inllLv 为可选扩展字段） */
export function buildHRFrame(): ArrayBuffer {
  return buildFrame('HR', new Uint8Array(227));
}
