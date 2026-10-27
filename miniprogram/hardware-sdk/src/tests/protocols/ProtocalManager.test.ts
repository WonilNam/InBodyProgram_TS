import { ProtocolManager } from '../../infrastructure/protocols/ProtocolManager';
import { InBodyDevice } from '../../domain/entities/InBodyDevice.entity';
import { H30ProtocolParser } from '../../infrastructure/protocols/parsers/H30ProtocolParser';
import { H20ProtocolParser } from '../../infrastructure/protocols/parsers/H20ProtocolParser';
import { InBody120ProtocolParser } from '../../infrastructure/protocols/parsers/120ProtocolParser';

describe('ProtocolManager', () => {
  const h30 = new H30ProtocolParser();
  const h20 = new H20ProtocolParser();
  const i120 = new InBody120ProtocolParser();
  const manager = new ProtocolManager(i120, h20, h30);

  describe('getParser 路由', () => {
    it('H30 → H30ProtocolParser', () => {
      expect(manager.getParser('H30')).toBe(h30);
    });

    it('H40 → H30ProtocolParser（复用 H30 协议）', () => {
      expect(manager.getParser('H40')).toBe(h30);
    });

    it('H20 → H20ProtocolParser', () => {
      expect(manager.getParser('H20')).toBe(h20);
    });

    it('120 → InBody120ProtocolParser', () => {
      expect(manager.getParser('120')).toBe(i120);
    });

    it('UNKNOWN → 回退到 H30ProtocolParser', () => {
      expect(manager.getParser('UNKNOWN')).toBe(h30);
    });
  });

  describe('buildOut 委托', () => {
    it('H30 设备: buildOut 返回 ArrayBuffer', () => {
      const device: InBodyDevice = { deviceId: 'test-3', type: 'H30', name: 'H30' };
      const cmd = manager.buildOut(device, 'AK');
      expect(cmd).toBeInstanceOf(ArrayBuffer);
      expect(cmd.byteLength).toBeGreaterThan(0);
    });
  });

  describe('getExpectedResponseCmds 委托', () => {
    it('H30 设备 RE 指令', () => {
      const device = { deviceId: 'x', type: 'H30' as const, name: '' };
      const cmds = manager.getExpectedResponseCmds(device, 'RE');
      expect(cmds).toContain('RE');
    });
  });
});
