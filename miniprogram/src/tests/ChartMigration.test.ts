import { BcaReportMapper } from '../infrastructure/mappers/BcaReportMapper';
import { buildDashboardView } from '../presentation/dashboard/DashboardView';
import { normalize } from '../application/services/DashboardBootstrapService';
import * as graphics from '../infrastructure/renderers/HistoryGraphic2D';
import * as primitive from '../infrastructure/renderers/PrimitiveCanvas2D';

jest.mock('../infrastructure/renderers/PrimitiveCanvas2D', () => ({
 SetRoundRect: jest.fn(), SetLeftRoundRect: jest.fn(), SetRightRoundRect: jest.fn(),
 SetDrawRect: jest.fn(), SetDrawText: jest.fn(), SetDrawLine: jest.fn(),
}));
const mockChart = jest.fn();
jest.mock('../infrastructure/renderers/TrendChart2D', () => mockChart);
jest.mock('../application/AppContainer', () => ({ getContainer: jest.fn() }));
jest.mock('../infrastructure/adapters/QrScanAdapter', () => ({ scanQR: jest.fn() }));

describe('Migrated chart contracts', () => {
  it('exports the original high/low graph and draws both standard and high levels', () => {
    const track = jest.mocked(primitive.SetRoundRect);
    const left = jest.mocked(primitive.SetLeftRoundRect);
    const right = jest.mocked(primitive.SetRightRoundRect);
    jest.mocked(primitive.SetDrawRect);
    jest.mocked(primitive.SetDrawText);
    jest.mocked(primitive.SetDrawLine);
    try {
      for (const value of [6, 15]) {
        graphics.DrawRoundBarHighLowGraph({}, 5, 25, 240, 240, 35,
          [2,4,6,8,10,12,14,16,18,20], 0.5, ['低','','高'], '8px Arial', 10, value, 10, 6, true);
      }
      expect(track).toHaveBeenCalledTimes(2);
      expect(left).toHaveBeenCalled();
      expect(right).toHaveBeenCalled();
      const colors = left.mock.calls.map(call => call[6]);
      expect(new Set(colors).size).toBe(2);
    } finally { jest.restoreAllMocks(); }
  });

  it('converts server numeric strings before passing points to the strict trend renderer', () => {
    const runtime = globalThis as typeof globalThis & { Component: typeof Component; wx: typeof wx };
    const oldComponent = runtime.Component;
    const oldWx = runtime.wx;
    let options: any;
    runtime.Component = value => { options = value; };
    runtime.wx = { getWindowInfo: () => ({ windowWidth: 375 }) };
    try {
      const records = BcaReportMapper.toChronologicalDescList([
        { DATETIMES: '20261020000000', WT: '63.7' }, { DATETIMES: '20261021000000', WT: '' },
        { DATETIMES: '20261022000000', WT: '64.1' },
      ]);
      const view = buildDashboardView(records, normalize());
      const { DashboardChart } = require('../infrastructure/renderers/DashboardChart');
      new DashboardChart({}).render(view);
      expect(mockChart.mock.calls[0][0].series[0].data).toEqual([63.7,null,64.1]);
    } finally { runtime.Component = oldComponent; runtime.wx = oldWx; }
  });
});
