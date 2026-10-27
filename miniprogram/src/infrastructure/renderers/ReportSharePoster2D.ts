import { drawReportBar, FONT_FAMILY } from './ReportBarGraph2D';
import { getBodyCoordinatePoint } from '../../domain/services/InBodyFormatService';
import {
  applyEquipmentVisibility,
  buildDetailedReport,
  buildMetrics,
  calculateSafeCanvasSize,
  cropSquare,
  distributeMetricTops,
  formatMeasurementTime,
  getScoreEmoji,
  measureDetailedReport,
} from './ReportShareModel';

// Data shaping lives in ReportShareModel; re-exported so existing importers keep working.
export {
  applyEquipmentVisibility,
  buildDetailedReport,
  buildMetrics,
  calculateSafeCanvasSize,
  cropSquare,
  distributeMetricTops,
  formatDelta,
  formatFixedDelta,
  formatMeasurementTime,
  getScoreEmoji,
  measureDetailedReport,
} from './ReportShareModel';

export function drawDetailedReport(
  ctx: any,
  report: Record<string, any>,
  width = 750
): number {
  const height = measureDetailedReport(report);
  const dark = '#20272c';
  const muted = '#7b858b';
  const line = '#dfe3e4';
  const surface = '#f4f6f4';
  const brand = '#c51f46';

  const text = (
    value: unknown,
    x: number,
    y: number,
    size: number,
    color = dark,
    weight = 'normal'
  ) => {
    ctx.setFillStyle(color);
    ctx.setFontSize(size);
    ctx.font = `${weight} ${size}px ${FONT_FAMILY}`;
    ctx.fillText(String(value ?? ''), x, y);
  };

  const rightText = (
    value: unknown,
    right: number,
    y: number,
    size: number,
    color = dark,
    weight = 'normal'
  ) => {
    ctx.setFillStyle(color);
    ctx.setFontSize(size);
    ctx.font = `${weight} ${size}px ${FONT_FAMILY}`;
    const content = String(value ?? '');
    ctx.fillText(content, right - ctx.measureText(content).width, y);
  };

  const roundedRect = (
    x: number,
    top: number,
    rectWidth: number,
    rectHeight: number,
    radius: number,
    color: string
  ) => {
    ctx.setFillStyle(color);
    if (typeof ctx.arcTo !== 'function') {
      ctx.fillRect(x, top, rectWidth, rectHeight);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x + radius, top);
    ctx.lineTo(x + rectWidth - radius, top);
    ctx.arcTo(x + rectWidth, top, x + rectWidth, top + radius, radius);
    ctx.lineTo(x + rectWidth, top + rectHeight - radius);
    ctx.arcTo(
      x + rectWidth,
      top + rectHeight,
      x + rectWidth - radius,
      top + rectHeight,
      radius
    );
    ctx.lineTo(x + radius, top + rectHeight);
    ctx.arcTo(x, top + rectHeight, x, top + rectHeight - radius, radius);
    ctx.lineTo(x, top + radius);
    ctx.arcTo(x, top, x + radius, top, radius);
    if (typeof ctx.closePath === 'function') ctx.closePath();
    ctx.fill();
  };

  ctx.clearRect(0, 0, width, height);
  ctx.setFillStyle('#ffffff');
  ctx.fillRect(0, 0, width, height);
  ctx.setFillStyle(brand);
  ctx.fillRect(0, 0, width, 9);
  text('InBody', 44, 82, 43, brand, 'bold');
  rightText('BODY COMPOSITION RECORD', 706, 70, 13, muted);
  text('我的体成分记录', 44, 145, 35, dark, 'bold');
  text(report.nickname || '昵称', 44, 185, 19, muted);
  rightText(report.date, 706, 185, 19, muted);

  if (report.score) {
    roundedRect(44, 222, 662, 178, 22, surface);
    text('InBody 分数', 72, 264, 21, dark, 'bold');
    const scoreNumber = String(report.score).replace(/[^\d.-]/g, '') || '--';
    ctx.setFontSize(72);
    ctx.font = `bold 72px ${FONT_FAMILY}`;
    const scoreWidth = ctx.measureText(scoreNumber).width;
    text(scoreNumber, 72, 354, 72, brand, 'bold');
    text('分', 72 + scoreWidth + 10, 350, 22, dark);
    if (report.scoreDelta) {
      ctx.setFontSize(16);
      ctx.font = `bold 16px ${FONT_FAMILY}`;
      const scoreDeltaWidth = Math.max(54, ctx.measureText(report.scoreDelta).width + 26);
      const scoreDeltaX = 72 + scoreWidth + 48;
      roundedRect(scoreDeltaX, 326, scoreDeltaWidth, 31, 15, '#e7ebe8');
      text(report.scoreDelta, scoreDeltaX + 13, 348, 16, muted, 'bold');
    }
    const numericScore = Math.max(0, Math.min(100, Number(scoreNumber)));
    const scoreRingX = 599;
    const scoreRingY = 311;
    const scoreRingRadius = 45;
    ctx.beginPath();
    ctx.setStrokeStyle('#dfe4df');
    ctx.setLineWidth(12);
    ctx.arc(scoreRingX, scoreRingY, scoreRingRadius, 0, Math.PI * 2);
    ctx.stroke();
    if (Number.isFinite(numericScore)) {
      ctx.beginPath();
      ctx.setStrokeStyle(brand);
      ctx.setLineWidth(12);
      ctx.arc(
        scoreRingX,
        scoreRingY,
        scoreRingRadius,
        -Math.PI / 2,
        -Math.PI / 2 + (Math.PI * 2 * numericScore) / 100
      );
      ctx.stroke();
    }
    const scoreEmoji = getScoreEmoji(numericScore);
    ctx.setFontSize(31);
    ctx.font = `normal 31px ${FONT_FAMILY}`;
    text(
      scoreEmoji,
      scoreRingX - ctx.measureText(scoreEmoji).width / 2,
      scoreRingY + 11,
      31,
      dark
    );
  }

  const summaryTop = report.score ? 430 : 230;
  const allRows: any[] = (report.sections || []).reduce(
    (rows: any[], section: any) => rows.concat(section.rows || []),
    []
  );
  const summaryKeys = ['WT', 'SMM', 'PBF'];
  const summaryRows = summaryKeys
    .map((key) => allRows.find((item) => item.key === key))
    .filter(Boolean);
  const summaryColumnWidth = 662 / Math.max(1, summaryRows.length);

  summaryRows.forEach((row: any, index: number) => {
    const x = 44 + index * summaryColumnWidth;
    if (index) {
      ctx.setFillStyle(line);
      ctx.fillRect(x - 18, summaryTop, 1, 103);
    }
    text(row.name, x, summaryTop + 26, 18, muted);
    text(row.value, x, summaryTop + 69, 38, dark, 'bold');
    const valueWidth = ctx.measureText(row.value).width;
    text(row.unit, x + valueWidth + 7, summaryTop + 69, 17, muted);
    if (row.delta) text(row.delta, x, summaryTop + 97, 16, muted);
  });

  let y = report.score ? 570 : 370;

  const drawRow = (row: any) => {
    ctx.setFillStyle('#ffffff');
    ctx.fillRect(44, y, 662, row.type === 'coordinate' ? 626 : 114);
    if (row.type === 'coordinate') {
      rightText(row.name, 706, y + 34, 22, '#159f7e', 'bold');
      const imageX = 115;
      const imageY = y + 54;
      const imageWidth = 520;
      const imageHeight = Math.round((imageWidth * 311) / 300);
      const female = String(row.sex).toUpperCase() !== 'M';
      const firstX = imageX + Math.trunc(imageWidth * 0.12);
      const firstY = imageY + Math.trunc(imageWidth * 0.06);
      const graphWidth = Math.trunc(imageWidth * 0.82);
      const quarter = graphWidth / 4;
      const componentImg = female
        ? '/images/item_body_component_f.png'
        : '/images/item_body_component_m.png';
      const hasImage =
        typeof ctx.hasImage === 'function' &&
        ctx.hasImage(componentImg) &&
        typeof ctx.drawImage === 'function';

      if (hasImage) {
        ctx.drawImage(componentImg, imageX, imageY, imageWidth, imageHeight);
      } else {
        roundedRect(firstX, firstY, graphWidth, graphWidth, 14, '#f0f1f4');
      }

      const regions: Record<string, [number, number, number, number, string]> = {
        消瘦型: [0, 3, 1, 1, '#dcdfe4'],
        苗条肌肉型: [0, 2, 1, 1, '#dcdfe4'],
        肌肉型: [0, 1, 2, 1, '#dcdfe4'],
        运动员体型: [0, 0, 2, 1, '#dcdfe4'],
        偏瘦型: [1, 3, 2, 1, '#dcdfe4'],
        苗条: [1, 2, 1, 1, '#c9ede1'],
        健康型: [2, 1, 1, 2, '#c9ede1'],
        一般强壮型: [2, 0, 1, 1, '#dcdfe4'],
        隐形肥胖: [3, 2, 1, 2, '#fedcb7'],
        偏胖: [3, 1, 1, 1, '#dcdfe4'],
        肥胖: [3, 0, 1, 1, '#ffd4dd'],
      };
      const selectedRegion = regions[row.name];
      if (selectedRegion) {
        const [col, rIndex, colSpan, rowSpan, fillCol] = selectedRegion;
        const rx = firstX + col * quarter;
        const ry = firstY + rIndex * quarter;
        const rw = colSpan * quarter;
        const rh = rowSpan * quarter;
        const radius = Math.round(graphWidth * 0.0404);
        const isTL = col === 0 && rIndex === 0;
        const isTR = col + colSpan === 4 && rIndex === 0;
        const isBL = col === 0 && rIndex + rowSpan === 4;
        const isBR = col + colSpan === 4 && rIndex + rowSpan === 4;
        ctx.setFillStyle(fillCol);
        if ((isTL || isTR || isBL || isBR) && typeof ctx.arcTo === 'function') {
          ctx.beginPath();
          const rTL = isTL ? radius : 0;
          const rTR = isTR ? radius : 0;
          const rBR = isBR ? radius : 0;
          const rBL = isBL ? radius : 0;
          ctx.moveTo(rx + rTL, ry);
          ctx.lineTo(rx + rw - rTR, ry);
          if (rTR) ctx.arcTo(rx + rw, ry, rx + rw, ry + rTR, rTR);
          ctx.lineTo(rx + rw, ry + rh - rBR);
          if (rBR) ctx.arcTo(rx + rw, ry + rh, rx + rw - rBR, ry + rh, rBR);
          ctx.lineTo(rx + rBL, ry + rh);
          if (rBL) ctx.arcTo(rx, ry + rh, rx, ry + rh - rBL, rBL);
          ctx.lineTo(rx, ry + rTL);
          if (rTL) ctx.arcTo(rx, ry, rx + rTL, ry, rTL);
          if (typeof ctx.closePath === 'function') ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(rx, ry, rw, rh);
        }
      }

      ctx.setStrokeStyle('#ffffff');
      ctx.setLineWidth(3);
      const divider = (x1: number, y1: number, x2: number, y2: number) => {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      };
      divider(firstX + quarter, firstY + quarter * 2, firstX + quarter, firstY + graphWidth);
      divider(firstX + quarter * 2, firstY, firstX + quarter * 2, firstY + quarter * 3);
      divider(firstX + quarter * 3, firstY, firstX + quarter * 3, firstY + graphWidth);
      divider(firstX, firstY + quarter, firstX + graphWidth, firstY + quarter);
      divider(firstX, firstY + quarter * 2, firstX + quarter * 2, firstY + quarter * 2);
      divider(
        firstX + quarter * 3,
        firstY + quarter * 2,
        firstX + graphWidth,
        firstY + quarter * 2
      );
      divider(firstX, firstY + quarter * 3, firstX + quarter * 3, firstY + quarter * 3);

      if (!hasImage) {
        text('BMI', firstX - 46, firstY + Math.round(quarter * 0.45), 17, muted, 'bold');
        text(female ? '25.0' : '24.0', firstX - 46, firstY + quarter + 6, 16, muted);
        text('18.5', firstX - 46, firstY + quarter * 3 + 6, 16, muted);
        text(
          female ? '18.0' : '10.0',
          firstX + quarter - 18,
          firstY + graphWidth + 28,
          16,
          muted
        );
        text(
          female ? '28.0' : '20.0',
          firstX + quarter * 3 - 18,
          firstY + graphWidth + 28,
          16,
          muted
        );
        rightText('体脂百分比', firstX + graphWidth, firstY + graphWidth + 56, 16, muted);
      }

      const labels: Array<[string, number, number]> = [
        ['消瘦型', 0, 3],
        ['苗条肌肉型', 0, 2],
        ['肌肉型', 0, 1],
        ['运动员体型', 0, 0],
        ['偏瘦型', 1, 3],
        ['苗条', 1, 2],
        ['健康型', 2, 1],
        ['一般强壮型', 2, 0],
        ['隐形肥胖', 3, 2],
        ['偏胖', 3, 1],
        ['肥胖', 3, 0],
      ];
      labels.forEach(([labelName, col, rowIdx]) =>
        text(
          labelName,
          firstX + col * quarter + 7,
          firstY + rowIdx * quarter + 24,
          16,
          dark,
          labelName === row.name ? 'bold' : 'normal'
        )
      );

      const point = getBodyCoordinatePoint(
        row.bmi,
        row.pbf,
        row.sex,
        firstX,
        firstY,
        graphWidth
      );
      const pointColors: Record<string, string> = {
        健康型: '#0E8A65',
        苗条: '#0E8A65',
        隐形肥胖: '#EF8100',
        肥胖: '#CC1F3B',
      };
      ctx.beginPath();
      ctx.setFillStyle(pointColors[row.name] || '#718093');
      ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
      ctx.setStrokeStyle('#ffffff');
      ctx.setLineWidth(5);
      ctx.stroke();
      ctx.fill();
      y += 650;
      return;
    }

    text(row.name, 44, y + 29, 20, muted);
    if (row.type === 'plain') {
      const badgeColor =
        row.value === '均衡'
          ? '#caede2'
          : row.value === '轻度不均'
          ? '#fbe9d3'
          : '#ffd4dd';
      ctx.font = `bold 24px ${FONT_FAMILY}`;
      const badgeWidth = ctx.measureText(String(row.value)).width + 28;
      roundedRect(44, y + 45, badgeWidth, 46, 10, badgeColor);
      text(row.value, 58, y + 76, 24, '#454A5B', 'bold');
      y += 116;
      return;
    }

    text(row.value, 44, y + 76, 38, dark, 'bold');
    const valueWidth = ctx.measureText(row.value).width;
    if (row.unit) {
      const unitBaseline = row.key === 'WBPA50' ? y + 59 : y + 76;
      text(row.unit, 51 + valueWidth, unitBaseline, 17, muted);
    }
    if (row.delta) {
      text(row.delta, 44, y + 105, 16, muted);
    }
    if (row.hasGraph) {
      ctx.save();
      ctx.translate(271, y + 26);
      ctx.scale(1, 1.02);
      drawReportBar(ctx, row.graphData, 660, row.key, {
        barHeight: 18,
        lowColor: '#F25C75',
        normalColor: '#47B998',
        highColor: '#F25C75',
        labelFontSize: 13,
        labelColor: '#798088',
        boundaryColor: '#798088',
        shortTickColor: '#c8cdd2',
        trackColor: '#e7eaee',
      });
      ctx.restore();
    }
    y += 116;
  };

  let sectionNumber = 0;
  (report.sections || []).forEach((section: any) => {
    ctx.save();
    sectionNumber += 1;
    text(String(sectionNumber).padStart(2, '0'), 44, y + 42, 18, brand, 'bold');
    text(section.title, 91, y + 43, 28, dark, 'bold');
    ctx.setFillStyle(line);
    ctx.fillRect(44, y + 70, 662, 2);
    y += 88;

    if (section.type === 'cid') {
      roundedRect(44, y, 662, 282, 16, '#ffffff');
      text('CID', 70, y + 39, 18, brand, 'bold');
      text(section.subtitle || 'CID 体型', 133, y + 39, 21, dark, 'bold');
      if (section.symbol) {
        rightText(`${section.symbol} 字型`, 678, y + 38, 17, muted, 'bold');
      }
      ctx.setFillStyle('#e1e5e5');
      ctx.fillRect(70, y + 58, 610, 1);
      const cidCanvasLeft = 271;
      const cidWindowWidth = 660;
      if (section.symbol) {
        const symbolKey = String(section.symbol).trim().toLowerCase();
        const symbolImages: Record<string, string> = {
          c: '/images/ic_cidp_c.png',
          d: '/images/ic_cidp_d.png',
          p: '/images/ic_cidp_p.png',
        };
        const symbolHeight = 152;
        const symbolWidth = Math.round((symbolHeight * 200) / 224);
        const cidGraphWidth = (cidWindowWidth * 500) / 750 - 10;
        const symbolLeft = cidCanvasLeft + 5 + (cidGraphWidth / 12) * 3 - 30;
        const symbolTop = y + 100;
        if (symbolKey === 'i') {
          ctx.setFillStyle('rgba(121, 128, 136, 0.34)');
          ctx.fillRect(symbolLeft, symbolTop, (symbolWidth * 34) / 200, symbolHeight);
        } else if (symbolImages[symbolKey] && typeof ctx.drawImage === 'function') {
          ctx.drawImage(symbolImages[symbolKey], symbolLeft, symbolTop, symbolWidth, symbolHeight);
        } else {
          ctx.setFontSize(142);
          ctx.font = `bold 142px ${FONT_FAMILY}`;
          text(
            section.symbol,
            symbolLeft,
            symbolTop + 142,
            142,
            'rgba(121, 128, 136, 0.34)',
            'bold'
          );
        }
      }
      (section.rows || []).forEach((row: any, index: number) => {
        const rowY = y + 78 + index * 67;
        text(row.name, 70, rowY + 20, 18, muted);
        if (row.hasGraph) {
          ctx.save();
          ctx.translate(cidCanvasLeft, rowY - 1);
          ctx.scale(1, 0.94);
          drawReportBar(ctx, row.graphData, cidWindowWidth, row.key, {
            barHeight: 18,
            lowColor: '#F25C75',
            normalColor: '#47B998',
            highColor: '#F25C75',
            labelFontSize: 0,
            showShortTicks: false,
            boundaryColor: '#b8c1c4',
            shortTickColor: '#d1d6d9',
            trackColor: '#e3e7ea',
          });
          ctx.restore();
        }
      });
      y += 294 + 24;
      ctx.restore();
      return;
    }

    if (section.subtitle || section.symbol) {
      roundedRect(44, y, 662, 52, 12, surface);
      text('CID', 69, y + 34, 18, brand, 'bold');
      text(section.subtitle || 'CID 体型', 137, y + 34, 21, dark, 'bold');
      if (section.symbol) text(`（${section.symbol} 字型）`, 390, y + 34, 18, dark);
      y += 62;
    }

    if (section.groups) {
      section.groups.forEach((group: any) => {
        roundedRect(44, y, 662, 312, 16, surface);
        const muscle = group.title === '肌肉';
        ctx.setFillStyle(muscle ? '#47B998' : '#F25C75');
        ctx.fillRect(44, y, 7, 54);
        text(muscle ? '节段肌肉分析' : '节段体脂肪分析', 72, y + 37, 21, dark, 'bold');
        ctx.setFillStyle('#dfe3e4');
        ctx.fillRect(68, y + 62, 614, 1);
        if (typeof ctx.drawImage === 'function') {
          ctx.drawImage('/images/icon_body_gray.png', 76, y + 93, 150, 190);
        }
        const rowX = 250;
        roundedRect(rowX, y + 72, 440, 224, 12, '#ffffff');
        (group.rows || []).forEach((row: any, index: number) => {
          const rowTop = y + 72 + index * 45;
          if (index) {
            ctx.setFillStyle('#edf0f0');
            ctx.fillRect(rowX + 12, rowTop, 416, 1);
          }
          text(row.name, rowX + 12, rowTop + 17, 14, muted);
          text(
            `${row.value}${row.unit ? ` ${row.unit}` : ''}`,
            rowX + 12,
            rowTop + 38,
            18,
            dark,
            'bold'
          );
          if (row.evaluation) {
            const evaluationColor = row.evaluation === '标准' ? '#159f7e' : '#c51f46';
            rightText(row.evaluation, 610, rowTop + 35, 13, evaluationColor, 'bold');
          }
          if (row.pi) rightText(row.pi, 678, rowTop + 36, 14, muted);
        });
        y += 332;
      });
    } else {
      (section.rows || []).forEach(drawRow);
    }
    y += 24;
    ctx.restore();
  });

  ctx.save();
  ctx.setFillStyle(line);
  ctx.fillRect(44, height - 60, 662, 2);
  text('InBody', 44, height - 20, 28, brand, 'bold');
  rightText('每一次记录，都是更了解自己。', 706, height - 20, 15, muted);
  ctx.restore();
  return height;
}

export function drawOverlay(
  ctx: any,
  metrics: Array<Record<string, any>>,
  date: string,
  dark: boolean,
  showDelta: boolean,
  layout?: Record<string, any> | null
): void {
  const foreground = dark ? '#202735' : '#ffffff';
  ctx.clearRect(0, 0, 750, 750);
  ctx.setFillStyle(
    layout?.solidBackground
      ? '#ffffff'
      : dark
      ? 'rgba(255,255,255,0.48)'
      : 'rgba(0,0,0,0.28)'
  );
  ctx.fillRect(0, 0, 750, 750);

  const text = (value: unknown, x: number, y: number, size: number, weight = 'normal') => {
    ctx.setFillStyle(foreground);
    ctx.setFontSize(size);
    ctx.font = `${weight} ${size}px ${FONT_FAMILY}`;
    ctx.fillText(String(value ?? ''), x, y);
  };

  const rightText = (
    value: unknown,
    right: number,
    y: number,
    size: number,
    weight = 'normal'
  ) => {
    ctx.setFillStyle(foreground);
    ctx.setFontSize(size);
    ctx.font = `${weight} ${size}px ${FONT_FAMILY}`;
    const content = String(value ?? '');
    ctx.fillText(content, right - ctx.measureText(content).width, y);
  };

  text('InBody', 600, 69, 36, 'bold');
  const dateParts = String(date || '').split(' ');
  dateParts.forEach((part, index) => text(part, 590, 112 + index * 34, 23));
  if (layout?.nickname) rightText(layout.nickname, 710, 180, 22, 'bold');

  const selectedMetrics =
    layout && Array.isArray(layout.selectedKeys) && layout.selectedKeys.length
      ? layout.selectedKeys
          .map((key: string) => metrics.find((metric) => metric.key === key))
          .filter((m): m is Record<string, any> => Boolean(m))
      : metrics;

  if (layout && layout.template !== 'detail') {
    const selected =
      selectedMetrics[0] ||
      metrics.find((metric) => metric.key === layout.selectedKey) ||
      metrics[0];
    const metricValue = (metric: Record<string, any>, x: number, y: number, size = 43) => {
      text(metric.value, x, y, size, 'bold');
      const width = ctx.measureText(metric.value).width;
      text(metric.unit, x + width + 8, y, Math.round(size * 0.58), 'bold');
    };
    if (layout.template === 'summary') {
      selectedMetrics.slice(0, 3).forEach((metric, index) => {
        const x = [65, 305, 545][index];
        text(metric.name, x, 650, 25);
        metricValue(metric, x, 711, 42);
      });
      return;
    }
    if (!selected) return;
    if (layout.template === 'single') {
      text(selected.name, 52, 635, 31);
      metricValue(selected, 52, 706, 55);
      return;
    }
    if (layout.template === 'bar') {
      text(selected.name, 52, 573, 30);
      metricValue(selected, 52, 642, 55);
      if (selected.hasGraph) {
        ctx.save();
        ctx.translate(47, 642);
        ctx.scale(2.05, 1.4);
        drawReportBar(ctx, selected.graphData, 375, selected.key, {
          barHeight: 18,
          lowColor: '#E06575',
          normalColor: '#66B598',
          highColor: '#E06575',
          labelFontSize: 0,
          showShortTicks: false,
          boundaryPosition: 'inside',
          boundaryColor: 'rgba(255,255,255,.5)',
          trackColor: dark ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.25)',
        });
        ctx.restore();
      }
      return;
    }
    if (layout.template === 'trend') {
      text(`${selected.name}变化`, 46, 570, 30, 'bold');
      const values = (layout.history || [])
        .slice()
        .reverse()
        .map((item: any) => Number(item[selected.rawKey]))
        .filter(Number.isFinite);
      if (!values.length) return;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const range = max - min || 1;
      ctx.beginPath();
      ctx.setStrokeStyle(foreground);
      ctx.setLineWidth(3);
      values.forEach((value: number, index: number) => {
        const x = 47 + (index * 320) / Math.max(1, values.length - 1);
        const y = 705 - ((value - min) / range) * 105;
        if (index) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.stroke();
      const last = values[values.length - 1];
      ctx.beginPath();
      ctx.setFillStyle(foreground);
      ctx.arc(367, 705 - ((last - min) / range) * 105, 8, 0, Math.PI * 2);
      ctx.fill();
      text(`${last}${selected.unit}`, 385, 690, 25, 'bold');
      return;
    }
  }

  const detailMetrics = selectedMetrics.slice(0, 5);
  const metricTops = distributeMetricTops(detailMetrics.length);
  detailMetrics.forEach((metric, index) => {
    const top = metricTops[index];
    text(metric.name, 41, top, 25);
    text(metric.value, 41, top + 51, 38, 'bold');
    const valueWidth = ctx.measureText(metric.value).width;
    text(metric.unit, 46 + valueWidth, top + 51, 21);
    if (showDelta && metric.delta) {
      ctx.setFillStyle(dark ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.12)');
      ctx.fillRect(41, top + 68, Math.max(57, metric.delta.length * 13 + 16), 31);
      text(metric.delta, 49, top + 92, 23, 'bold');
    }
    if (metric.hasGraph) {
      ctx.save();
      ctx.translate(190, top - 17);
      ctx.scale(1.3, 1.6);
      drawReportBar(ctx, metric.graphData, 375, metric.key, {
        barHeight: 18,
        lowColor: '#E06575',
        normalColor: '#66B598',
        highColor: '#E06575',
        labelFontSize: 14,
        labelScaleY: 1.3 / 1.6,
        labelColor: dark ? 'rgba(32,39,53,0.65)' : 'rgba(255,255,255,0.75)',
        boundaryColor: dark ? 'rgba(0,0,0,0.30)' : 'rgba(255,255,255,0.65)',
        shortTickColor: dark ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.40)',
        trackColor: dark ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.25)',
      });
      ctx.restore();
    }
  });
}

module.exports = {
  applyEquipmentVisibility,
  buildDetailedReport,
  buildMetrics,
  calculateSafeCanvasSize,
  cropSquare,
  drawDetailedReport,
  distributeMetricTops,
  drawOverlay,
  formatMeasurementTime,
  getBodyCoordinatePoint,
  getScoreEmoji,
  measureDetailedReport,
};
