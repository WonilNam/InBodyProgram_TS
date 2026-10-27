
// components/BodyComponent/BodyComponent.js
const utils = require("../../src/domain/services/InBodyFormatService");
const CoordinateTypeUtil = require("../../src/domain/value-objects/CoordinateType.vo");
const { createCanvas2DContext } = require("../../src/infrastructure/renderers/Canvas2DContextAdapter");

Component({
  /**
   * 组件的属性列表
   */
  properties: {
    dataBMI: {
      type: Number,
      value: 0
    },
    dataPBF: {
      type: Number,
      value: 0
    },
    dataSEX: {
      type: String,
      value: ""
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    viewWidth: 0,
    canvaHeight: '',
    componentImg: '/images/item_body_component_m.png'
  },

  lifetimes: {
    attached: function () {
      this.initGraph(this.data.data);
    },
    detached: function () {}
  },

  attached: function () {
    this.initGraph(this.data.data);
  },

  observers: {
    'dataBMI, dataPBF, dataSEX': function (bmi, pbf, sex) {
      this.initGraph();
    }
  },

  methods: {
    loadGraph(data) {
      var that = this;
      var windowWith = 0;
      var query = wx.createSelectorQuery().in(this);
      query.select('.bodyComponent .img').boundingClientRect((res: any) => {
        if (!res || !res.width) return;
        windowWith = res.width;
        this.setData({
          viewWidth: res.width,
          canvaHeight: res.width
        });
        var firstPointX = parseInt(String(windowWith * 0.12));
        var firstPointY = parseInt(String(windowWith * 0.06));
        var graphWidth = parseInt(String(windowWith * 0.82));
        var bodyType = utils.getBodyCoordinate(this.properties.dataBMI, this.properties.dataPBF, this.properties.dataSEX);
        this.triggerEvent("bodyTypeChild", bodyType);
        const ctx = createCanvas2DContext("bargraph_body", this, { width: res.width, height: res.width });

        const cornerRadius = Math.round(graphWidth * 0.0404);
        const fillWithCorner = (x: any, y: any, w: any, h: any, color: any, corners: Record<string, number> = {}) => {
          ctx.setFillStyle(color);
          const { tl = 0, tr = 0, br = 0, bl = 0 } = corners;
          const hasArc = typeof ctx.arcTo === "function" && (tl || tr || br || bl);
          if (hasArc && typeof ctx.beginPath === "function" && typeof ctx.moveTo === "function") {
            const rTL = tl ? cornerRadius : 0;
            const rTR = tr ? cornerRadius : 0;
            const rBR = br ? cornerRadius : 0;
            const rBL = bl ? cornerRadius : 0;
            ctx.beginPath();
            ctx.moveTo(x + rTL, y);
            ctx.lineTo(x + w - rTR, y);
            if (rTR) ctx.arcTo(x + w, y, x + w, y + rTR, rTR);
            ctx.lineTo(x + w, y + h - rBR);
            if (rBR) ctx.arcTo(x + w, y + h, x + w - rBR, y + h, rBR);
            ctx.lineTo(x + rBL, y + h);
            if (rBL) ctx.arcTo(x, y + h, x, y + h - rBL, rBL);
            ctx.lineTo(x, y + rTL);
            if (rTL) ctx.arcTo(x, y, x + rTL, y, rTL);
            if (typeof ctx.closePath === "function") ctx.closePath();
          } else if (typeof ctx.rect === "function") {
            ctx.rect(x, y, w, h);
          }
        };

        // 绘制高亮背景色块（外角保留与底图一致的圆角）
        switch (bodyType) {
          case CoordinateTypeUtil.CoordinateType.XIAOSHOU:
            fillWithCorner(firstPointX, firstPointY + graphWidth / 4 * 3, graphWidth / 4, graphWidth / 4, '#dcdfe4', { bl: 1 });
            break;
          case CoordinateTypeUtil.CoordinateType.MIAOTIAOJIROU:
            fillWithCorner(firstPointX, firstPointY + graphWidth / 2, graphWidth / 4, graphWidth / 4, '#dcdfe4');
            break;
          case CoordinateTypeUtil.CoordinateType.JIROU:
            fillWithCorner(firstPointX, firstPointY + graphWidth / 4, graphWidth / 2, graphWidth / 4, '#dcdfe4');
            break;
          case CoordinateTypeUtil.CoordinateType.YUNDONGYUANTIXING:
            fillWithCorner(firstPointX, firstPointY, graphWidth / 2, graphWidth / 4, '#dcdfe4', { tl: 1 });
            break;
          case CoordinateTypeUtil.CoordinateType.PIANSHOU:
            fillWithCorner(firstPointX + graphWidth / 4, firstPointY + graphWidth / 4 * 3, graphWidth / 2, graphWidth / 4, '#dcdfe4');
            break;
          case CoordinateTypeUtil.CoordinateType.MIAOTIAO:
            fillWithCorner(firstPointX + graphWidth / 4, firstPointY + graphWidth / 2, graphWidth / 4, graphWidth / 4, '#c9ede1');
            break;
          case CoordinateTypeUtil.CoordinateType.JIANKANG:
            fillWithCorner(firstPointX + graphWidth / 2, firstPointY + graphWidth / 4, graphWidth / 4, graphWidth / 2, '#c9ede1');
            break;
          case CoordinateTypeUtil.CoordinateType.YIBANQIANGZHUANG:
            fillWithCorner(firstPointX + graphWidth / 2, firstPointY, graphWidth / 4, graphWidth / 4, '#dcdfe4');
            break;
          case CoordinateTypeUtil.CoordinateType.YINXINGFEIPANG:
            fillWithCorner(firstPointX + graphWidth / 4 * 3, firstPointY + graphWidth / 2, graphWidth / 4, graphWidth / 2, '#fedcb7', { br: 1 });
            break;
          case CoordinateTypeUtil.CoordinateType.PIANPANG:
            fillWithCorner(firstPointX + graphWidth / 4 * 3, firstPointY + graphWidth / 4, graphWidth / 4, graphWidth / 4, '#dcdfe4');
            break;
          case CoordinateTypeUtil.CoordinateType.FEIPANG:
            fillWithCorner(firstPointX + graphWidth / 4 * 3, firstPointY, graphWidth / 4, graphWidth / 4, '#ffd4dd', { tr: 1 });
            break;
        }
        ctx.setGlobalAlpha(1);
        ctx.fill();

        // 优化字号为 11px 并为单元格保留舒展内边距，统一使用顶对齐精准控制留白
        const fontSize = 11;
        const cellW = graphWidth / 4;
        const cellH = graphWidth / 4;
        const padX = 10;
        const padTop = 11;
        const lineHeight = fontSize + 2;

        if (typeof ctx.setTextBaseline === "function") {
          ctx.setTextBaseline("top");
        } else {
          ctx.textBaseline = "top";
        }

        const getHighlightColor = (type: any) => {
          switch (type) {
            case CoordinateTypeUtil.CoordinateType.YINXINGFEIPANG:
              return "#543E27";
            case CoordinateTypeUtil.CoordinateType.JIANKANG:
            case CoordinateTypeUtil.CoordinateType.MIAOTIAO:
              return "#0E8A65";
            case CoordinateTypeUtil.CoordinateType.FEIPANG:
              return "#CC1F3B";
            default:
              return "#2C3E50";
          }
        };

        const fontFamily = '-apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
        const normalFont = `normal ${fontSize}px ${fontFamily}`;
        const boldFont = `bold ${fontSize}px ${fontFamily}`;

        const drawTypeLabel = (text: any, type: any, x: any, y: any) => {
          const isSelected = bodyType === type;
          ctx.font = isSelected ? boldFont : normalFont;
          ctx.setFillStyle(isSelected ? getHighlightColor(type) : "#718093");
          ctx.fillText(text, x, y);
        };

        // 行0: 运动员体型(列0~1), 一般强壮型(列2), 肥胖(列3)
        drawTypeLabel("运动员体型", CoordinateTypeUtil.CoordinateType.YUNDONGYUANTIXING, firstPointX + padX, firstPointY + padTop);

        // 一般强壮型 换行为两行
        drawTypeLabel("一般强壮", CoordinateTypeUtil.CoordinateType.YIBANQIANGZHUANG, firstPointX + cellW * 2 + padX, firstPointY + padTop);
        drawTypeLabel("型", CoordinateTypeUtil.CoordinateType.YIBANQIANGZHUANG, firstPointX + cellW * 2 + padX, firstPointY + padTop + lineHeight);

        drawTypeLabel("肥胖", CoordinateTypeUtil.CoordinateType.FEIPANG, firstPointX + cellW * 3 + padX, firstPointY + padTop);

        // 行1: 肌肉型(列0~1), 健康型(列2), 偏胖(列3)
        drawTypeLabel("肌肉型", CoordinateTypeUtil.CoordinateType.JIROU, firstPointX + padX, firstPointY + cellH + padTop);
        drawTypeLabel("健康型", CoordinateTypeUtil.CoordinateType.JIANKANG, firstPointX + cellW * 2 + padX, firstPointY + cellH + padTop);
        drawTypeLabel("偏胖", CoordinateTypeUtil.CoordinateType.PIANPANG, firstPointX + cellW * 3 + padX, firstPointY + cellH + padTop);

        // 行2: 苗条肌肉型(列0), 苗条(列1), 隐形肥胖(列3)
        drawTypeLabel("苗条肌肉型", CoordinateTypeUtil.CoordinateType.MIAOTIAOJIROU, firstPointX + padX, firstPointY + cellH * 2 + padTop);
        drawTypeLabel("苗条", CoordinateTypeUtil.CoordinateType.MIAOTIAO, firstPointX + cellW + padX, firstPointY + cellH * 2 + padTop);
        drawTypeLabel("隐形肥胖", CoordinateTypeUtil.CoordinateType.YINXINGFEIPANG, firstPointX + cellW * 3 + padX, firstPointY + cellH * 2 + padTop);

        // 行3: 消瘦型(列0), 偏瘦型(列1~2)
        drawTypeLabel("消瘦型", CoordinateTypeUtil.CoordinateType.XIAOSHOU, firstPointX + padX, firstPointY + cellH * 3 + padTop);
        drawTypeLabel("偏瘦型", CoordinateTypeUtil.CoordinateType.PIANSHOU, firstPointX + cellW + padX, firstPointY + cellH * 3 + padTop);

        ctx.draw();
      }).exec();
    },

    loadCircle(data) {
      var windowWith = 0;
      var query = wx.createSelectorQuery().in(this);
      query.select('.bodyComponent .img').boundingClientRect((res: any) => {
        if (!res || !res.width) return;
        windowWith = res.width;
        this.setData({
          viewWidth: res.width,
          canvaHeight: res.width
        });
        var firstPointX = parseInt(String(windowWith * 0.12));
        var firstPointY = parseInt(String(windowWith * 0.06));
        var graphWidth = parseInt(String(windowWith * 0.82));
        var bodyType = utils.getBodyCoordinate(this.properties.dataBMI, this.properties.dataPBF, this.properties.dataSEX);
        const ctx = createCanvas2DContext("bargraph_circle", this, { width: res.width, height: res.width });

        let dotColor = '#718093';
        switch (bodyType) {
          case CoordinateTypeUtil.CoordinateType.JIANKANG:
          case CoordinateTypeUtil.CoordinateType.MIAOTIAO:
            dotColor = '#0E8A65';
            break;
          case CoordinateTypeUtil.CoordinateType.YINXINGFEIPANG:
            dotColor = '#EF8100';
            break;
          case CoordinateTypeUtil.CoordinateType.FEIPANG:
            dotColor = '#CC1F3B';
            break;
        }

        var pbf = Number(this.properties.dataPBF);
        var bmi = Number(this.properties.dataBMI);
        var point = utils.getBodyCoordinatePoint(bmi, pbf, this.properties.dataSEX, firstPointX, firstPointY, graphWidth);

        // 绘制白色外光圈（外半径 8px）
        ctx.beginPath();
        ctx.arc(point.x, point.y, 8, 0, 2 * Math.PI);
        ctx.setFillStyle('#FFFFFF');
        ctx.fill();

        // 绘制中心实心彩色圆点（内半径 3.5px，紧凑精致）
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3.5, 0, 2 * Math.PI);
        ctx.setFillStyle(dotColor);
        ctx.fill();
        ctx.draw();
      }).exec();
    },

    initGraph(data) {
      if (this.properties.dataSEX == "M") {
        this.setData({ componentImg: "/images/item_body_component_m.png" });
      } else {
        this.setData({ componentImg: "/images/item_body_component_f.png" });
      }
      this.loadGraph(data);
      this.loadCircle(data);
    }
  }
});

// Marks this file as a module so top-level names do not collide with other page scripts.
export {};
