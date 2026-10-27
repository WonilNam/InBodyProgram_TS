export interface TrendChartPoint {
  readonly label: string;
  readonly value: number;
}

export interface Canvas2DContextLike {
  clearRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, r: number, sAngle: number, eAngle: number): void;
  stroke(): void;
  fill(): void;
  fillText(text: string, x: number, y: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeStyle: string;
  fillStyle: string;
  lineWidth: number;
  font: string;
  textAlign: 'left' | 'center' | 'right';
  textBaseline?: 'top' | 'middle' | 'bottom' | 'alphabetic';
}

export class Canvas2DRenderer {
  /**
   * 绘制首页/历史趋势折线图（原生支持单点、多点、高亮选中点，不依赖旧版 wxcharts）
   */
  static drawTrendLine(
    ctx: Canvas2DContextLike,
    width: number,
    height: number,
    points: readonly TrendChartPoint[],
    selectedIndex: number,
    accentColor = '#b50937'
  ): void {
    ctx.clearRect(0, 0, width, height);
    if (!points.length) return;

    const padLeft = 32;
    const padRight = 32;
    const padTop = 30;
    const padBottom = 34;
    const plotW = Math.max(1, width - padLeft - padRight);
    const plotH = Math.max(1, height - padTop - padBottom);

    const values = points.map(p => p.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const span = maxVal - minVal || 1;

    const coords = points.map((pt, idx) => {
      const x = points.length === 1
        ? padLeft + plotW / 2
        : padLeft + (idx / (points.length - 1)) * plotW;
      const y = points.length === 1 || maxVal === minVal
        ? padTop + plotH / 2
        : padTop + plotH - ((pt.value - minVal) / span) * plotH;
      return { x, y, label: pt.label, value: pt.value };
    });

    // 1. 绘制折线
    if (coords.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      coords.forEach((c, i) => {
        if (i === 0) ctx.moveTo(c.x, c.y);
        else ctx.lineTo(c.x, c.y);
      });
      ctx.stroke();
    }

    // 2. 绘制数据圆点、数值与底部日期（单点也仅绘制一次日期标签）
    coords.forEach((c, i) => {
      const isSelected = i === selectedIndex;
      ctx.beginPath();
      ctx.fillStyle = isSelected ? accentColor : '#9ca3af';
      ctx.arc(c.x, c.y, isSelected ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = isSelected ? 'bold 12px sans-serif' : '11px sans-serif';
      ctx.fillStyle = isSelected ? '#111827' : '#6b7280';
      ctx.textAlign = 'center';
      ctx.fillText(String(c.value), c.x, c.y - 10);
      ctx.fillText(c.label, c.x, height - 10);
    });
  }

  /**
   * 绘制 InBody 年龄与实际年龄对比柱状图
   */
  static drawAgeComparison(
    ctx: Canvas2DContextLike,
    width: number,
    height: number,
    actualAge: number,
    inBodyAge: number
  ): void {
    ctx.clearRect(0, 0, width, height);
    if (!Number.isFinite(actualAge) || !Number.isFinite(inBodyAge) || actualAge <= 0 || inBodyAge <= 0) {
      return;
    }

    const maxAge = Math.max(actualAge, inBodyAge, 1);
    const baseLineY = height - 32;
    const maxBarH = Math.max(20, height - 68);
    const barW = 36;
    const leftX = width * 0.35 - barW / 2;
    const rightX = width * 0.65 - barW / 2;

    const actualH = (actualAge / maxAge) * maxBarH;
    const inBodyH = (inBodyAge / maxAge) * maxBarH;

    // 实际年龄柱
    ctx.fillStyle = '#d1d5db';
    ctx.fillRect(leftX, baseLineY - actualH, barW, actualH);
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${actualAge}岁`, leftX + barW / 2, baseLineY - actualH - 8);
    ctx.fillText('实际年龄', leftX + barW / 2, baseLineY + 18);

    // InBody年龄柱
    ctx.fillStyle = '#b50937';
    ctx.fillRect(rightX, baseLineY - inBodyH, barW, inBodyH);
    ctx.fillText(`${inBodyAge}岁`, rightX + barW / 2, baseLineY - inBodyH - 8);
    ctx.fillText('InBody年龄', rightX + barW / 2, baseLineY + 18);
  }
}
