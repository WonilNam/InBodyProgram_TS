import * as canvas from './PrimitiveCanvas2D';
import { BarGradationLabel, COLORS, convertDatetimeDiffSeconds, parse14DigitToMs, RoundBarOptions } from './HistoryGraphShared';

export function DrawAgeGraph(
  context: any,
  windowWidth: number,
  ageInput: number | string,
  inBodyAgeInput: number | string
): void {
  const age = Number(ageInput);
  const inbodyage = Number(inBodyAgeInput);
  const height = 80;
  const width = windowWidth - 140;
  const startX = 30;
  const startY = 50;
  const rectWidth = 40;
  const ageX = 70;
  const wordWidth = 50;

  canvas.SetDrawLine(context, startX, startY, startX + width, startY, 1, COLORS.black);
  canvas.SetDrawLine(
    context,
    startX,
    startY + height / 2,
    startX + width,
    startY + height / 2,
    1,
    COLORS.black
  );
  canvas.SetDrawLine(
    context,
    startX,
    startY + height,
    startX + width,
    startY + height,
    1,
    COLORS.black
  );

  canvas.SetDrawText(
    context,
    '实际年龄',
    'bold 10px sans-serif',
    COLORS.black,
    'left',
    'right',
    'bottom',
    'top',
    startX + ageX,
    height + 20,
    wordWidth,
    40
  );
  canvas.SetDrawText(
    context,
    'InBody年龄',
    'bold 10px sans-serif',
    COLORS.newRed,
    'left',
    'right',
    'bottom',
    'top',
    startX + ageX + 80,
    height + 20,
    wordWidth,
    40
  );
  canvas.SetDrawText(
    context,
    age,
    'bold 10px sans-serif',
    COLORS.black,
    'left',
    'right',
    'bottom',
    'top',
    startX + ageX - 12,
    0,
    0,
    30
  );
  canvas.SetDrawText(
    context,
    inbodyage,
    'bold 10px sans-serif',
    COLORS.newRed,
    'left',
    'right',
    'bottom',
    'top',
    startX + ageX + 58,
    0,
    0,
    30
  );

  if (age > inbodyage && age > 0) {
    const dashHeight = height - (height * inbodyage) / age;
    canvas.SetTopRoundRect(
      context,
      startX + ageX - rectWidth,
      startY,
      rectWidth,
      height,
      10,
      COLORS.llGray
    );
    canvas.SetTopRoundRect(
      context,
      startX + ageX + 70 - rectWidth,
      startY + dashHeight,
      rectWidth,
      (height * inbodyage) / age,
      10,
      COLORS.newRed
    );
    canvas.dashedLine(
      context,
      startX,
      startY + dashHeight,
      startX + width,
      startY + dashHeight,
      1,
      COLORS.black
    );
  } else if (age <= inbodyage && inbodyage > 0) {
    const dashHeight = height - (height * age) / inbodyage;
    canvas.SetTopRoundRect(
      context,
      startX + ageX - rectWidth,
      startY + dashHeight,
      rectWidth,
      (height * age) / inbodyage,
      10,
      COLORS.llGray
    );
    canvas.SetTopRoundRect(
      context,
      startX + ageX + 70 - rectWidth,
      startY,
      rectWidth,
      height,
      10,
      COLORS.newRed
    );
    canvas.dashedLine(
      context,
      startX,
      startY + dashHeight,
      startX + width,
      startY + dashHeight,
      1,
      COLORS.black
    );
  }
}

export function DrawPentagonToHealthReport(
  ctx: any,
  sectionData: string,
  sectionPercent: Array<string | number>,
  wed: Array<string | number>,
  segmentType: string,
  x: number,
  y: number,
  r: number,
  circularTimes: number
): void {
  canvas.SetDrawPentagon(
    ctx,
    sectionData,
    sectionPercent,
    wed,
    segmentType,
    x,
    y,
    r,
    circularTimes
  );
}

export function DrawRoundBarGraphToHealthReport(
  context: any,
  left: number,
  top: number,
  _width: number,
  graphWidth: number,
  _graphHeight: number,
  _isGradation: boolean,
  gradationDataInput: Array<number | string>,
  gradationStroke: number,
  boldGradationIndex: number[],
  textData: BarGradationLabel[],
  textFont: string,
  textH: number,
  valueInput: number | string,
  firstBarW: number,
  barW: number,
  barH: number,
  gradationBarS: number,
  dataKind: string,
  options: RoundBarOptions = {}
): void {
  const gradationH = 5;
  const boldGradationH = 20;
  const segmentGap = options.continuousBar ? 0 : gradationStroke;
  const value = parseFloat(String(valueInput));
  const gradationData = (gradationDataInput || []).map((v) => parseFloat(String(v)));

  // Track background
  canvas.SetRoundRect(
    context,
    left,
    top,
    graphWidth,
    barH,
    10,
    options.trackColor || COLORS.bGray
  );

  // Tick marks
  let startX = left + firstBarW;
  let startY = options.continuousBar
    ? top + barH
    : top + gradationStroke / 2 + textH + (barH - 10);

  for (let i = 0; i < gradationData.length; i++) {
    if (boldGradationIndex.includes(i)) {
      if (!options.boundaryColor) {
        canvas.SetDrawLine(
          context,
          startX,
          startY - boldGradationH / 2,
          startX,
          startY + boldGradationH / 2,
          gradationStroke,
          COLORS.black
        );
      }
    } else if (options.showShortTicks !== false) {
      canvas.SetDrawLine(
        context,
        startX,
        startY,
        startX,
        startY + (options.shortTickHeight || gradationH),
        gradationStroke,
        options.shortTickColor || COLORS.ldGray
      );
    }
    if (i < gradationData.length - 1) {
      startX += barW;
    }
  }

  // Labels under bar
  startX = left;
  startY =
    options.labelGap !== undefined
      ? top + barH + 8 + options.labelGap + textH / 2
      : top + gradationStroke / 2 + gradationH + gradationBarS + textH + (barH - 10);

  context.save();
  const labelScaleY = options.labelScaleY || 1;
  context.scale(1, labelScaleY);
  startY /= labelScaleY;

  let textW = 0;
  if (textData && textData[0] !== undefined) {
    textW = firstBarW + barW * (Number(textData[0].gradationCnt) - 1);
    canvas.SetDrawText(
      context,
      textData[0].value,
      textFont,
      options.labelColor || COLORS.dGray,
      'center',
      'left',
      'top',
      'middle',
      startX,
      startY,
      textW,
      textH
    );
  }
  startX += textW;
  for (let i = 1; i < (textData || []).length; i++) {
    textW = barW * Number(textData[i].gradationCnt);
    canvas.SetDrawText(
      context,
      textData[i].value,
      textFont,
      options.labelColor || COLORS.dGray,
      'center',
      'left',
      'top',
      'middle',
      startX,
      startY,
      textW,
      textH
    );
    startX += textW;
  }
  context.restore();

  // Filled value bar
  const lower = gradationData[2];
  const upper = gradationData[4];
  const isMuscleMetric =
    dataKind === 'SMM' || dataKind === 'SMM99' || dataKind === 'INLL';

  if (options.continuousBar) {
    const color =
      value < lower
        ? options.lowColor || COLORS.ibGray
        : value <= upper || isMuscleMetric
        ? options.normalColor || COLORS.green
        : options.highColor || COLORS.red;

    let filledWidth = 0;
    if (Number.isFinite(value) && gradationData.length > 0) {
      if (value <= gradationData[0]) {
        filledWidth =
          gradationData[0] > 0 ? (barW * Math.max(0, value)) / gradationData[0] : 0;
      } else {
        const upperIndex = gradationData.findIndex((tick) => tick > value);
        if (upperIndex > 0) {
          filledWidth =
            barW *
            (upperIndex +
              (value - gradationData[upperIndex - 1]) /
                (gradationData[upperIndex] - gradationData[upperIndex - 1]));
        } else {
          const last = gradationData.length - 1;
          const extra =
            (value - gradationData[last]) /
            (gradationData[last] - gradationData[last - 1] || 1);
          filledWidth = barW * (gradationData.length + Math.min(1, extra));
        }
      }
    }
    filledWidth = Math.max(0, Math.min(graphWidth, filledWidth));
    if (filledWidth > 0) {
      canvas.SetLeftRoundRect(
        context,
        left,
        top,
        filledWidth,
        barH,
        Math.min(barH / 2, filledWidth / 2),
        color
      );
    }
  } else {
    startX = left;
    const color =
      value >= lower && value <= upper
        ? COLORS.green
        : value <= lower
        ? COLORS.ibGray
        : isMuscleMetric
        ? COLORS.green
        : COLORS.red;

    for (let i = 0; i < gradationData.length; i++) {
      if (value >= gradationData[i]) {
        if (i === 0) {
          canvas.SetLeftRoundRect(context, startX, top, barW - segmentGap, barH, 10, color);
        } else {
          canvas.SetDrawRect(context, startX, top, barW - segmentGap, barH, color);
        }
      } else if (value <= gradationData[0]) {
        canvas.SetLeftRoundRect(
          context,
          startX,
          top,
          ((barW - segmentGap) * value) / (gradationData[0] || 1),
          barH,
          10,
          color
        );
      } else {
        const endBarW =
          (barW * (value - gradationData[i - 1])) /
          (gradationData[i] - gradationData[i - 1] || 1);
        canvas.SetDrawRect(context, startX, top, endBarW, barH, color);
        break;
      }
      startX += barW;
    }
    if (gradationData.length > 10 && value > gradationData[10]) {
      const endBarW = Math.min(
        barW,
        (barW * (value - gradationData[10])) /
          (gradationData[10] - gradationData[9] || 1)
      );
      canvas.SetRightRoundRect(context, startX, top, endBarW, barH, 10, color);
    }
  }

  if (options.boundaryColor) {
    boldGradationIndex.forEach((index) => {
      const x = left + firstBarW + barW * index;
      const inside = options.boundaryPosition === 'inside';
      canvas.SetDrawLine(
        context,
        x,
        inside ? top : top + barH,
        x,
        inside ? top + barH : top + barH + 8,
        0.75,
        options.boundaryColor!
      );
    });
  }
}

export function DrawRoundBarHighLowGraph(
 context: any, left: number, top: number, width: number, graphWidth: number,
 graphHeight: number, gradationData: number[], gradationStroke: number,
 textData: string[], textFont: string, textH: number, value: number,
 barH: number, gradationBarS: number, isDefaultMinBar: boolean
): void {
  
  var startX, startY; 
  var barValueS = 10; 
  var i; 
  var tempCnt, tempWidth;
  var endBarW = 0.0; 
  var defaultMinBarW; 
  var graphMinValue = 0;
  var gradationH = 10; 
  var barW;
  var barS = gradationStroke;
  
  var color: string = COLORS.green; 
  
  var valueHdirection = 'left'; 
  var valueVdirection = 'middle'; 
  var valueTextAlign = 'left'; 
  var valueTextBaseLine = 'middle'; 

  var textHdirection = 'left'; 
  var textVdirection = 'top'; 
  var textTextAlign; 
  var textTextBaseLine = 'middle'; 
  

  value = Number(value);
  
  if (value > gradationData[gradationData.length - 1]) {
    value = gradationData[gradationData.length - 1];
  }

  gradationData = gradationData.map(Number);
  var temp = 0;
  temp = Math.floor(gradationData.length / 2); 
  tempWidth = graphWidth / 2 - barS * (temp - 1); 

  barW = tempWidth / temp;
  defaultMinBarW = (barW * 1) / 10;
  
  
  startX = left;
  startY = top;
  
  
  
  

  
  canvas.SetRoundRect(
    context,
    startX,
    startY,
    startX + graphWidth,
    gradationH,
    10,
    COLORS.bGray
  );

  
  startX += graphWidth / 2;
  canvas.SetDrawLine(
    context,
    startX,
    startY + gradationH,
    startX,
    startY + gradationH * 2,
    gradationStroke,
    COLORS.black
  );
  
  startX = left + 50;
  startY = top + gradationStroke / 2 + gradationH + gradationBarS + textH;
  var textW = 30;
  
  textTextAlign = 'left'; 
  canvas.SetDrawText(
    context,
    textData[0],
    textFont,
    COLORS.dGray,
    textHdirection,
    textTextAlign,
    textVdirection,
    textTextBaseLine,
    startX,
    startY,
    textW,
    textH
  );
  
  startX = left + graphWidth / 2;
  textTextAlign = 'center'; 
  canvas.SetDrawText(
    context,
    textData[1],
    textFont,
    COLORS.dGray,
    textHdirection,
    textTextAlign,
    textVdirection,
    textTextBaseLine,
    startX,
    startY,
    textW,
    textH
  );
  
  startX = left + graphWidth - 50;
  textTextAlign = 'right'; 
  canvas.SetDrawText(
    context,
    textData[2],
    textFont,
    COLORS.dGray,
    textHdirection,
    textTextAlign,
    textVdirection,
    textTextBaseLine,
    startX,
    startY,
    textW,
    textH
  );
  
  startX = left;
  startY = top; 

  if (value <= gradationData[5]) {
    
    color = COLORS.green;
  } else {
    
    color = COLORS.red;
  }
  
  if (value < gradationData[0]) {
    
    if (value <= graphMinValue) {
      
      if (isDefaultMinBar) {
        
        canvas.SetLeftRoundRect(
          context,
          startX,
          startY,
          (barW * 1) / 10,
          barH,
          10,
          color
        );
        startX += (barW * 1) / 10 + barS;
      }
    }
    
    else {
      
      endBarW =
        (barW * (value - graphMinValue)) / (gradationData[0] - graphMinValue);
      
      if (endBarW < defaultMinBarW) endBarW = defaultMinBarW;
      canvas.SetLeftRoundRect(
        context,
        startX,
        startY,
        endBarW,
        barH,
        10,
        color
      );
    }
  }
  
  else {
    
    canvas.SetLeftRoundRect(context, startX, startY, barW, barH, 10, color);
    startX += barW + barS;
  }
  
  if (value > gradationData[0]) {
    
    for (i = 1; i < gradationData.length; i++) {
      
      if (value <= gradationData[5]) {
        
        color = COLORS.green;
      } else {
        
        color = COLORS.red;
      }

      
      if (value >= gradationData[i]) {
        
        if (i == 10) {
          canvas.SetRightRoundRect(
            context,
            startX,
            startY,
            barW,
            barH,
            10,
            color
          );
        } else {
          canvas.SetDrawRect(context, startX, startY, barW, barH, color);
        }
      } else {
        
        
        endBarW =
          (barW * (value - gradationData[i - 1])) /
          (gradationData[i] - gradationData[i - 1]);
        if (endBarW > barW) {
          endBarW = barW;
        }
        console.log("endbarw===", endBarW, "==barw==", barW);
        
        canvas.SetRightRoundRect(
          context,
          startX,
          startY,
          endBarW,
          barH,
          10,
          color
        );
        break;
      }
      startX += barW + barS;
    }
  }
};
