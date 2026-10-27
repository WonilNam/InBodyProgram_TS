// Facade: bar-style graphs live in HistoryGraphBars2D, line/point graphs in HistoryGraphLines2D.
import {
  DrawAgeGraph,
  DrawPentagonToHealthReport,
  DrawRoundBarGraphToHealthReport,
  DrawRoundBarHighLowGraph,
} from './HistoryGraphBars2D';
import {
  DrawConnectionLineGraphWithShiftDate,
  DrawConnectionPointGraph,
  DrawDateHistoryWithShiftDate,
} from './HistoryGraphLines2D';

export type { BarGradationLabel, RoundBarOptions } from './HistoryGraphShared';
export {
  DrawAgeGraph,
  DrawPentagonToHealthReport,
  DrawRoundBarGraphToHealthReport,
  DrawRoundBarHighLowGraph,
  DrawConnectionLineGraphWithShiftDate,
  DrawConnectionPointGraph,
  DrawDateHistoryWithShiftDate,
};

module.exports = {
  DrawRoundBarHighLowGraph,
  DrawAgeGraph,
  DrawPentagonToHealthReport,
  DrawRoundBarGraphToHealthReport,
  DrawConnectionPointGraph,
  DrawConnectionLineGraphWithShiftDate,
  DrawDateHistoryWithShiftDate,
};
