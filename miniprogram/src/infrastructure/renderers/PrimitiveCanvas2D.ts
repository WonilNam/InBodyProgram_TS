export function SetDrawLine(
  context: any,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  lineWidth: number,
  rgba: string
): void {
  context.setLineWidth(lineWidth);
  context.setStrokeStyle(rgba);
  context.beginPath();
  context.moveTo(x1, y1);
  context.lineTo(x2, y2);
  context.stroke();
  context.closePath();
}

export function SetDrawEllipse(
  context: any,
  x: number,
  y: number,
  radius: number,
  rgba: string
): void {
  context.beginPath();
  context.setFillStyle(rgba);
  context.setStrokeStyle(rgba);
  context.arc(x, y, radius, 0, Math.PI * 2, false);
  context.fill();
  context.stroke();
  context.closePath();
}

export function dashedLine(
  context: any,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  dashLen = 2,
  color = 'black'
): void {
  const stepLen = dashLen || 2;
  context.setStrokeStyle(color);
  context.beginPath();
  context.moveTo(x1, y1);

  const dX = x2 - x1;
  const dY = y2 - y1;
  const dashes = Math.max(1, Math.floor(Math.sqrt(dX * dX + dY * dY) / stepLen));
  const dashX = dX / dashes;
  const dashY = dY / dashes;

  let curX = x1;
  let curY = y1;
  let q = 0;
  while (q++ < dashes) {
    curX += dashX;
    curY += dashY;
    context[q % 2 === 0 ? 'moveTo' : 'lineTo'](curX, curY);
  }
  context[q % 2 === 0 ? 'moveTo' : 'lineTo'](x2, y2);
  context.closePath();
  context.stroke();
}

export function SetDrawText(
  context: any,
  text: string | number,
  font: string,
  rgb: string,
  hDirection: string,
  textAlign: string,
  vDirection: string,
  textBaseline: string,
  x: number,
  y: number,
  width = 0,
  height = 0,
  area?: boolean
): void {
  if (area) {
    context.fillStyle = 'yellow';
    context.fillRect(x, y, width, height);
  }
  context.beginPath();
  context.setFillStyle(rgb);
  context.setStrokeStyle(rgb);
  context.font = font;
  context.setTextAlign(textAlign);
  context.setTextBaseline(textBaseline);

  const content = String(text ?? '');
  let offsetX = 0;
  if (width > 0) {
    if (hDirection === 'left') {
      offsetX = 0;
    } else if (hDirection === 'right') {
      offsetX = width;
    } else {
      offsetX = (width - context.measureText(content).width) / 2;
    }
  }

  let offsetY = 0;
  if (height > 0) {
    if (vDirection === 'top') {
      offsetY = 0;
    } else if (vDirection === 'bottom') {
      offsetY = height;
    } else {
      offsetY = height / 2;
    }
  }

  context.fillText(content, x + offsetX, y + offsetY);
  context.closePath();
}

export function SetDrawRect(
  context: any,
  x: number,
  y: number,
  width: number,
  height: number,
  rgb: string
): void {
  context.beginPath();
  context.setFillStyle(rgb);
  context.fillRect(x, y, width, height);
  context.stroke();
  context.closePath();
}

export function SetRoundRect(
  context: any,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color = 'transparent'
): void {
  let radius = r;
  if (w < 2 * radius) radius = w / 2;
  if (h < 2 * radius) radius = h / 2;

  context.beginPath();
  context.fillStyle = color;
  context.arc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5);
  context.moveTo(x + radius, y);
  context.lineTo(x + w - radius, y);
  context.lineTo(x + w, y + radius);
  context.arc(x + w - radius, y + radius, radius, Math.PI * 1.5, Math.PI * 2);
  context.lineTo(x + w, y + h - radius);
  context.lineTo(x + w - radius, y + h);
  context.arc(x + w - radius, y + h - radius, radius, 0, Math.PI * 0.5);
  context.lineTo(x + radius, y + h);
  context.lineTo(x, y + h - radius);
  context.arc(x + radius, y + h - radius, radius, Math.PI * 0.5, Math.PI);
  context.lineTo(x, y + radius);
  context.lineTo(x + radius, y);
  context.fill();
  context.closePath();
}

export function SetLeftRoundRect(
  context: any,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color = 'transparent'
): void {
  let radius = r;
  if (w < 2 * radius) radius = w / 2;
  if (h < 2 * radius) radius = h / 2;

  context.beginPath();
  context.fillStyle = color;
  context.arc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5);
  context.moveTo(x + radius, y);
  context.lineTo(x + w, y);
  context.lineTo(x + w, y + h);
  context.lineTo(x + radius, y + h);
  context.lineTo(x, y + h);
  context.arc(x + radius, y + h - radius, radius, Math.PI * 0.5, Math.PI);
  context.lineTo(x, y + radius);
  context.lineTo(x + radius, y);
  context.fill();
  context.closePath();
}

export function SetRightRoundRect(
  context: any,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color = 'transparent'
): void {
  let radius = r;
  if (w < 2 * radius) radius = w / 2;
  if (h < 2 * radius) radius = h / 2;

  context.beginPath();
  context.fillStyle = color;
  context.moveTo(x + radius, y);
  context.lineTo(x + w - radius, y);
  context.lineTo(x + w, y + radius);
  context.arc(x + w - radius, y + radius, radius, Math.PI * 1.5, Math.PI * 2);
  context.lineTo(x + w, y + h - radius);
  context.lineTo(x + w - radius, y + h);
  context.arc(x + w - radius, y + h - radius, radius, 0, Math.PI * 0.5);
  context.lineTo(x, y + h);
  context.lineTo(x, y);
  context.fill();
  context.closePath();
}

export function SetTopRoundRect(
  context: any,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color = 'transparent'
): void {
  let radius = r;
  if (w < 2 * radius) radius = w / 5;
  if (h < 2 * radius) radius = h / 5;

  context.beginPath();
  context.fillStyle = color;
  context.arc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5);
  context.moveTo(x + radius, y);
  context.lineTo(x + w - radius, y);
  context.lineTo(x + w - radius, y + radius);
  context.arc(x + w - radius, y + radius, radius, Math.PI * 1.5, Math.PI * 2);
  context.lineTo(x + w, y + h);
  context.lineTo(x, y + h);
  context.lineTo(x, y + radius);
  context.lineTo(x + radius, y);
  context.fill();
  context.closePath();
}

function drawPentagonRing(ctx: any, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const theta = ((i * Math.PI) / 5) * 2 - Math.PI / 10;
    const vx = r * Math.cos(theta) + x;
    const vy = r * Math.sin(theta) + y;
    if (i === 0) ctx.moveTo(vx, vy);
    else ctx.lineTo(vx, vy);
  }
  ctx.closePath();
}

export function SetDrawPentagon(
  ctx: any,
  sectionData: string,
  segmentPercent: Array<string | number>,
  wedData: Array<string | number>,
  segmentType: string,
  pointX: number,
  pointY: number,
  tRadius: number,
  circularTimes: number
): void {
  const sectionGraphData = [
    { name: '右上肢', standard: '', value: '' },
    { name: '右下肢', standard: '', value: '' },
    { name: '左下肢', standard: '', value: '' },
    { name: '左上肢', standard: '', value: '' },
    { name: '躯干', standard: '', value: '' },
  ];

  const percentData = sectionGraphData.map(() => ({ value: 100, rData: 100 }));

  if (segmentType === 'wed') {
    (wedData || []).forEach((currentValue, index) => {
      if (index >= sectionGraphData.length) return;
      const val = Number(currentValue);
      if (Number.isNaN(val) || currentValue === '' || currentValue == null) {
        sectionGraphData[index].standard = '';
      } else if (val > 0.39) {
        sectionGraphData[index].standard = '超标准';
      } else if (val < 0.36) {
        sectionGraphData[index].standard = '低标准';
      } else {
        sectionGraphData[index].standard = '标准';
      }
    });
  } else {
    const codeIndices = [1, 4, 3, 0, 2];
    const chars = String(sectionData || '').split('');
    sectionGraphData.forEach((part, index) => {
      const code = chars[codeIndices[index]] || '';
      part.value = code;
      part.standard =
        code === '0' ? '低标准' : code === '1' ? '标准' : code === '2' ? '超标准' : '';
    });
    (segmentPercent || []).forEach((currentValue, index) => {
      if (index < percentData.length) {
        percentData[index].rData = Number(currentValue) || 0;
      }
    });
  }

  for (let x = 0; x < circularTimes; x++) {
    drawPentagonRing(ctx, pointX, pointY, (tRadius * (circularTimes - x)) / circularTimes);
    ctx.setLineWidth(1);
    ctx.setStrokeStyle('#eee');
    ctx.stroke();
  }

  const paintRadius = (tRadius * (circularTimes - 5)) / circularTimes;
  const paintRadiusBigger = (tRadius * (circularTimes - 4.5)) / circularTimes;
  const paintRadiusSmaller = (tRadius * (circularTimes - 6)) / circularTimes;

  // Measured polygon fill
  ctx.beginPath();
  for (let v = 0; v < percentData.length; v++) {
    const rawR = (paintRadius * percentData[v].rData) / percentData[v].value;
    const drawRadius = Math.min(tRadius, Math.max(0, rawR));
    const theta = ((v * Math.PI) / 5) * 2 - Math.PI / 10;
    const vx = drawRadius * Math.cos(theta) + pointX;
    const vy = drawRadius * Math.sin(theta) + pointY;
    if (v === 0) ctx.moveTo(vx, vy);
    else ctx.lineTo(vx, vy);
  }
  ctx.closePath();
  ctx.setFillStyle('#87909f');
  ctx.setGlobalAlpha(0.7);
  ctx.fill();

  drawPentagonRing(ctx, pointX, pointY, paintRadiusBigger);
  ctx.setGlobalAlpha(0.7);
  ctx.setLineWidth(1);
  ctx.setStrokeStyle('#aaa');
  ctx.stroke();

  drawPentagonRing(ctx, pointX, pointY, paintRadiusSmaller);
  ctx.setGlobalAlpha(0.7);
  ctx.setLineWidth(1);
  ctx.setStrokeStyle('white');
  ctx.stroke();

  ctx.setGlobalAlpha(1);
  ctx.setTextAlign('center');
  ctx.setTextBaseline('middle');

  sectionGraphData.forEach((part, index) => {
    const lower = index === 1 || index === 2;
    const labelX =
      pointX +
      (index === 0 || index === 1
        ? tRadius * 0.83
        : index === 2 || index === 3
        ? -tRadius * 0.83
        : 0);
    const labelY =
      pointY + (lower ? tRadius * 0.95 : index === 4 ? -tRadius - 42 : -tRadius - 14);
    const raw = segmentType === 'wed' ? wedData?.[index] : segmentPercent?.[index];
    const numeric = raw != null && raw !== '' && Number.isFinite(Number(raw));
    const percentage = numeric
      ? Number(raw).toFixed(segmentType === 'wed' ? 3 : 1) +
        (segmentType === 'wed' ? '' : '%')
      : '-';
    const lines = lower
      ? [part.name, part.standard, percentage]
      : [percentage, part.standard, part.name];

    lines.forEach((text, line) => {
      const isStatus = line === 1;
      const isName = lower ? line === 0 : line === 2;
      ctx.font = `${isName || isStatus ? 'bold' : 'normal'} 10px sans-serif`;
      ctx.setFillStyle(
        isStatus
          ? part.standard === '标准'
            ? '#50b998'
            : '#e3637d'
          : isName
          ? '#454a5b'
          : '#89919a'
      );
      ctx.fillText(text, labelX, labelY + line * 14);
    });
  });

  ctx.setTextAlign('left');
  ctx.setTextBaseline('alphabetic');
  ctx.draw();
}

module.exports = {
  SetDrawLine,
  SetDrawEllipse,
  SetDrawText,
  dashedLine,
  SetDrawRect,
  SetRoundRect,
  SetLeftRoundRect,
  SetRightRoundRect,
  SetDrawPentagon,
  SetTopRoundRect,
};
