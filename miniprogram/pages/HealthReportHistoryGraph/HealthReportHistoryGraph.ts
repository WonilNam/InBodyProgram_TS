
//index.js
const graphic = require("../../src/infrastructure/renderers/HistoryGraphic2D");
const util = require("../../src/domain/services/InBodyFormatService");
const { getContainer } = require("../../src/application/AppContainer");
const { createCanvas2DContext } = require("../../src/infrastructure/renderers/Canvas2DContextAdapter");
const enum_unit = {
  empty: "",
  kg: "kg",
  percent: "%",
  kgm2: "kg/m²",
  cm2: "cm²",
};

var customData = {
  IsView: false,
  IsDuringTest: false,
  loadinglength: 0,
  maxGraphData: 7,
  L: getApp().globalData.Language,
  BtnIcon_HealthReport: "btn_HealthReport_on",
  BtnIcon_QRScan: "btn_QRScan",
  BtnIcon_ViewMore: "btn_ViewMore",
  graphType: "R",
  btnRClass: "btnR_TChecked",
  btnTClass: "btnR_T",
  dateRangeText: "",
  equipText: "",
  inbodyData: [],
  historyData: [],
  historyItem: [
    {
      key: "WT",
      unit: enum_unit.kg,
      canvasID: "wt_canvas",
      data: [],
      tableName: "BCA",
      itemName: "WT",
      decemal: 1,
      check: -1,
    },
    {
      key: "SMM",
      unit: enum_unit.kg,
      canvasID: "smm_canvas",
      data: [],
      tableName: "MFA",
      itemName: "SMM",
      decemal: 1,
      check: -1,
    },
    {
      key: "BFM",
      unit: enum_unit.kg,
      canvasID: "bfm_canvas",
      data: [],
      tableName: "BCA",
      itemName: "BFM",
      decemal: 1,
      check: -1,
    },
    {
      key: "PBF",
      unit: enum_unit.percent,
      canvasID: "pbf_canvas",
      data: [],
      tableName: "MFA",
      itemName: "PBF",
      decemal: 1,
      check: -1,
    },
    {
      key: "WED",
      unit: enum_unit.empty,
      canvasID: "wed_canvas",
      data: [],
      tableName: "ED",
      itemName: "ECW_TBW",
      decemal: 3,
      check: -1,
    },
    {
      key: "INLL",
      unit: enum_unit.kg,
      canvasID: "inll_canvas",
      data: [],
      tableName: "LB",
      itemName: "LLM",
      decemal: 1,
      check: -1,
    },
    {
      key: "BMI",
      unit: enum_unit.kgm2,
      canvasID: "bmi_canvas",
      data: [],
      tableName: "MFA",
      itemName: "BMI",
      decemal: 1,
      check: -1,
    },
    {
      key: "VFA",
      unit: enum_unit.cm2,
      canvasID: "vfa_canvas",
      data: [],
      tableName: "WC",
      itemName: "VFA",
      decemal: 1,
      check: -1,
    },
    {
      key: "VFALevel",
      unit: enum_unit.empty,
      canvasID: "vfalevel_canvas",
      data: [],
      tableName: "WC",
      itemName: "VFL",
      decemal: 0,
      check: -1,
    },
  ],
  historyImage: {},
  historyDefaultSet: {},
};
Page({
  data: customData,
  navibp: function () {
    wx.navigateTo({
      url: "/pages/HealthReportBarGraph/WebViewInBodyResultsSheet",
    });
  },
  navi: function () {
    wx.navigateTo({
      url: "/pages/HealthReportBarGraph/WebViewInBodyItemHelp",
    });
  },

  getInBodyData: function () {
    getContainer().reportService.syncEquipmentMetricMatrix().then(function (matrix: any) {
      var page = getCurrentPages().pop();
      if (page) {
        page.setData({ historyDefaultSet: wx.getStorageSync("historyDefaultSet") || matrix });
      }
      return getContainer().reportService.getHistoryRows();
    }).then(function (data: any) {
      var page = getCurrentPages().pop();
      if (page && typeof page.makeInBodyData === "function") {
        page.makeInBodyData(data);
      }
    }).catch(function () {
      wx.hideLoading();
    });
  },
  CheckEnableData: function (key, equip) {
    var check = false;
    var historyDefaultSet = this.data.historyDefaultSet;

    if (
      historyDefaultSet[key] != null &&
      historyDefaultSet[key].indexOf(equip) >= 0
    ) {
      check = true;
    }
    return check;
  },
  makeInBodyData: function (data) {
    var historyItem = this.data.historyItem;
    var historyData: Record<string, any> = {};

    for (var i = 0; i < historyItem.length; i++) {
      var key = historyItem[i].key;
      historyItem[i]["check"] = -1;
      historyData[key] = [];
    }
    historyData["Datetimes"] = [];
    historyData["DatetimesText"] = [];
    historyData.Equip = [];
    data.sort(function (a: any, b: any) {
      return a.BCA.DATETIMES - b.BCA.DATETIMES;
    });

    var filterDatetimes = wx.getStorageSync("HistoryGraphFilter");
    if (filterDatetimes == null || filterDatetimes == "") {
      var tempDatetimes = [];
      for (var i = 0; i < data.length; i++) {
        tempDatetimes.push(data[i].BCA.DATETIMES);
      }
      wx.setStorageSync("HistoryGraphFilter", tempDatetimes);
      filterDatetimes = tempDatetimes;
    }

    var graphType = this.data.graphType;
    var dataCount = 0;
    if (graphType == "R") {
      dataCount = data.length - this.data.maxGraphData;
      if (dataCount < 0 || filterDatetimes.length < this.data.maxGraphData)
        dataCount = 0;
    }

    var equip = wx.getStorageSync("HistoryGraphEquipFilter");
    var date = wx.getStorageSync("HistoryGraphDateFilter");
    var dateRangeText = "";

    console.log("makeInBodyData", date);

    if (date == null || date == "") {
      var stDate = data.length > 0 ? data[0].BCA.DATETIMES : "";
      if (stDate != null && stDate != "" && stDate.length >= 8) {
        stDate = util.frometYYmmddWW(stDate);
      }
      var dateTemp = {
        StartDate: { date: stDate, dateText: stDate },
        EndDate: { date: "recent", dateText: "전체선택" },
      };
      date = dateTemp;
      wx.setStorageSync("HistoryGraphDateFilter", dateTemp);
    }
    if (date != null && date != "") {
      dateRangeText = date.StartDate.dateText + "~" + date.EndDate.dateText;
    }
    var tempEquip = [];
    for (var i = 0; i < data.length; i++) {
      var d = data[i];
      if (filterDatetimes.indexOf(d.BCA.DATETIMES) < 0 || i < dataCount)
        continue;

      historyData.Datetimes.push(Number(d.BCA.DATETIMES));
      historyData.DatetimesText.push(
        util.formatHistoryDatetimes(d.BCA.DATETIMES)
      );
      historyData.Equip.push(d.BCA.EQUIP);
      if (equip == null || equip == "") {
        if (tempEquip.indexOf(d.BCA.EQUIP) < 0) {
          tempEquip.push(d.BCA.EQUIP);
        }
      }
      for (var j = 0; j < historyItem.length; j++) {
        var key = historyItem[j].key;
        var tableName = historyItem[j].tableName;

        if (this.CheckEnableData(key, d.BCA.EQUIP)) {
          historyData[key].push(d[tableName][key]);
          historyItem[j]["check"] = j;
        } else {
          historyData[key].push(null);
        }
      }
    }
    var historyItem = this.data.historyItem;

    for (var i = 0; i < historyItem.length; i++) {
      var key = historyItem[i].key;
      historyItem[i].data = historyData[key];
    }
    var equipText = "";
    if (equip == null || equip == "") {
      equip = tempEquip;
      wx.setStorageSync("HistoryGraphEquipFilter", tempEquip);
    }
    for (var i = 0; i < equip.length; i++) {
      equipText += "인바디" + equip[i] + ",";
    }
    if (equipText.length > 1) {
      equipText = equipText.substring(0, equipText.length - 1);
    }
    this.setData({
      historyData: historyData,
      historyItem: historyItem,
      inbodyData: data,
      IsView: true,
      equipText: equipText,
      dateRangeText: dateRangeText,
    });

    console.log("히스토리그래프");
    this.DrawHistoryGraph();
    console.log("히스토리그래츠2");
  },
  setFilterChange: function (e) {
    var data = (this.data && this.data.inbodyData && this.data.inbodyData.length > 0)
      ? this.data.inbodyData
      : (wx.getStorageSync("InBodyData") || (getApp().globalData && getApp().globalData.InBodyData) || []);
    try {
      wx.setStorageSync("TempHistoryGraphListData", data);
    } catch (err) {}
    wx.navigateTo({
      url: "/pages/HealthReportHistoryGraph/HistoryGraphDataFilter",
    });
  },
  moveTap: function () {
    wx.redirectTo({
      url: "/pages/HealthReportBarGraph/HealthReportBarGraph",
    });
  },
  setBind: function (e) {
    wx.showLoading({ mask: false });

    var page = getCurrentPages().pop();

    var historyItem = page.data.historyItem;
    var historyImage = page.data.historyImage;

    for (var i = 0; i < historyItem.length; i++) {
      if (historyImage[historyItem[i].canvasID] == null)
        historyImage[historyItem[i].canvasID] = {};
      historyImage[historyItem[i].canvasID]["display"] = "";
      historyImage[historyItem[i].canvasID]["imagedisplay"] = "display:none;";
    }

    if (e.target.id == "btnR") {
      this.setData({
        graphType: "R",
        btnRClass: "btnR_TChecked",
        btnTClass: "btnR_T",
        historyImage: historyImage,
        loadinglength: 0,
      });
    } else if (e.target.id == "btnT") {
      this.setData({
        graphType: "T",
        btnRClass: "btnR_T",
        btnTClass: "btnR_TChecked",
        historyImage: historyImage,
      });
    }
    this.makeInBodyData(this.data.inbodyData);
  },
  moveToMenu: function (e) {
    var id = e.currentTarget.id;

    var url = "";
    switch (id) {
      case "healthReport":
        url = "/pages/HealthReportMain/HealthReportMain";
        break;
      case "qrScan":
        break;
      case "viewMore":
        url = "/pages/ViewMoreMain/ViewMoreMain";
        break;
    }

    wx.redirectTo({
      url: url,
    });
  },
  onLoad: function (e) {
    wx.showLoading({ mask: false });
    this.getInBodyData();
  },
  onReady: function (e) {},
  onShow: function (e) {
    if (!this.data.IsView) {
      this.setData({
        IsView: true,
      });
      return;
    }
    var equipText = "";
    var equip = wx.getStorageSync("HistoryGraphEquipFilter");

    if (equip != null && equip != "") {
      for (var i = 0; i < equip.length; i++) {
        equipText += "InBody" + equip[i] + ",";
      }
      if (equipText.length > 1) {
        equipText = equipText.substring(0, equipText.length - 1);
      }
    }

    var dateRangeText = "";
    var date = wx.getStorageSync("HistoryGraphDateFilter");

    if (date != null && date != "") {
      dateRangeText = date.StartDate.dateText + " ~ " + date.EndDate.dateText;
    }

    var historyItem = this.data.historyItem;
    var historyImage = this.data.historyImage;

    for (var i = 0; i < historyItem.length; i++) {
      if (historyImage[historyItem[i].canvasID] == null)
        historyImage[historyItem[i].canvasID] = {};
      historyImage[historyItem[i].canvasID]["display"] = "";
      historyImage[historyItem[i].canvasID]["imagedisplay"] = "display:none;";
    }

    this.setData({
      dateRangeText: dateRangeText,
      equipText: equipText,
      historyImage: historyImage,
    });
    if (this.data.IsView) {
      this.makeInBodyData(this.data.inbodyData);
    }
  },
  DrawHistoryGraph: function () {
    var maxGraphData = this.data.maxGraphData;
    var windowWidth = (wx.getWindowInfo ? wx.getWindowInfo().windowWidth : 0) || 375;

    for (var i = 0; i < this.data.historyItem.length; i++) {
      var canvasID = this.data.historyItem[i].canvasID;
      var context = createCanvas2DContext(canvasID, this);
      context.clearRect(0, 0, 999, 999);
      this.DrawHistoryGraphType(
        context,
        this.data.historyItem[i].data,
        this.data.historyItem[i].decemal,
        maxGraphData,
        windowWidth,
        this.data.graphType
      );
    }
  },
  DrawHistoryGraphType: function (
    context,
    data,
    decemal,
    maxGraphData,
    windowWidth,
    graphType
  ) {
    var graphOption = {
      //히스토리 데이터 그래프
      context: null as any, //context
      left: 5, //시작 X좌표
      top: 30, //시작 Y좌표
      dataCount: maxGraphData, //그래프 데이터 개수
      dashLineThick: 0.3, //눈금두께
      boxW: (windowWidth - 25) / maxGraphData, //한칸당 너비
      boxH: 60, //한칸당 높이 110
      valBoxH: 8, //그려지는값이 차지하는 높이
      valUnderGap: 15, //boxH 0으로 부터 띄어지는 간격 (0일시 baseLine에 점이 찍힌다.)
      valFont: "15px Arial", //값 폰트 20px Arial
      decemal: decemal, //소숫점 자리수
      pointRadius: 3, //점(원)의 반지름
      dashLineGap: 0.3, //대쉬 라인 간격 [null이면 default : 5]
      isDrawWLine: true, //가로라인 그리기 여부 [null이면 true]
      isDrawHLine: false, //세로라인 그리기 여부 [null이면 true]
      isDrawHLineFull: true, //세로라인을 원래 높이대로 그릴것인지 여부 [null이면 false]
      isLastValueBold: true, //마지막 값을 진하게 하는지 여부 [null이면 false]
      //히스토리 날짜 그래프
      dashLineTop: 71, //대쉬라인 시작 y좌표
      dashLineThickDate: 100, //눈금 두께
      valBoxHDate: 38, //그려지는값이 차지하는 높이
      valFontDate: "bold 12px Arial", //값 폰트 13.5px Arial
      valFontTime: "10px Arial", //값 폰트 13.5px Arial
      isDrawBackColor: false, //배경 색 여부 [null 이면 false]
      isDrawUnderLine: false, //아래 라인 그리기 여부 [null 이면 false]
    };
    graphOption.context = context;
    graphOption.context;
    var dataText = data;

    var date = this.data.historyData.Datetimes;
    var dateText = this.data.historyData.DatetimesText;

    if (graphType == "R") {
      this.DrawRecentHistoryGraph(
        data,
        dataText,
        date,
        dateText,
        graphOption,
        maxGraphData,
        windowWidth
      );
    } else if (graphType == "T") {
      this.DrawTotalHistoryGraph(
        data,
        dataText,
        date,
        dateText,
        graphOption,
        maxGraphData,
        windowWidth
      );
    }

    graphOption.context.draw(false, () => {
      wx.canvasToTempFilePath({
        x: 0,
        y: 0,
        canvasId: graphOption.context.canvasId,
        fileType: "jpeg",
        quality: 1,
        success: function (res: any) {
          var page = getCurrentPages().pop();
          var historyImage = page.data.historyImage;
          historyImage[graphOption.context.canvasId] = {
            img: res.tempFilePath,
            display: "display:none;",
            imagedisplay: "",
          };

          page.setData({
            historyImage: historyImage,
            loadinglength: page.data.loadinglength + 1,
          });
          var historyItem = page.data.historyItem;
          var count = 0;
          for (var i = 0; i < historyItem.length; i++) {
            if (historyItem[i].check > -1) {
              count = count + 1;
            }
          }
          if (page.data.loadinglength >= count) {
            wx.hideLoading();
          }
        },
      });
    });
  },
  DrawRecentHistoryGraph: function (
    data,
    dataText,
    date,
    dateText,
    graphOption,
    maxGraphData,
    windowWidth
  ) {
    graphic.DrawConnectionPointGraph(
      graphOption.context,
      graphOption.left,
      graphOption.top,
      data,
      graphOption.dataCount,
      graphOption.dashLineThick,
      graphOption.boxW,
      graphOption.boxH,
      graphOption.valBoxH,
      graphOption.valUnderGap,
      graphOption.valFont,
      graphOption.decemal,
      graphOption.pointRadius,
      graphOption.dashLineGap,
      graphOption.isDrawWLine,
      graphOption.isDrawHLine,
      graphOption.isDrawHLineFull,
      graphOption.isLastValueBold,
      true,
      dataText
    );

    graphic.DrawDateHistoryWithShiftDate(
      graphOption.context,
      graphOption.left,
      graphOption.dashLineTop,
      graphOption.dashLineTop,
      dateText,
      graphOption.dataCount,
      graphOption.dashLineThickDate,
      graphOption.boxW,
      graphOption.valBoxHDate,
      graphOption.valFontDate,
      graphOption.valFontTime,
      "R",
      graphOption.isDrawBackColor,
      graphOption.isDrawUnderLine,
      date,
      data
    );
  },
  DrawTotalHistoryGraph: function (
    data,
    dataText,
    date,
    dateText,
    graphOption,
    maxGraphData,
    windowWidth
  ) {
    graphic.DrawConnectionLineGraphWithShiftDate(
      graphOption.context,
      graphOption.left,
      graphOption.top,
      data,
      graphOption.dataCount,
      date,
      graphOption.dashLineThick,
      graphOption.boxW,
      graphOption.boxH,
      graphOption.valBoxH,
      graphOption.valUnderGap,
      graphOption.valFont,
      graphOption.decemal,
      graphOption.pointRadius,
      graphOption.dashLineGap,
      graphOption.isDrawWLine,
      graphOption.isDrawHLine,
      graphOption.isDrawHLineFull,
      graphOption.isLastValueBold,
      true,
      dataText
    );

    graphic.DrawDateHistoryWithShiftDate(
      graphOption.context,
      graphOption.left,
      graphOption.dashLineTop,
      graphOption.dashLineTop,
      dateText,
      graphOption.dataCount,
      graphOption.dashLineThickDate,
      graphOption.boxW,
      graphOption.valBoxHDate,
      graphOption.valFontDate,
      graphOption.valFontTime,
      "T",
      graphOption.isDrawBackColor,
      graphOption.isDrawUnderLine,
      date,
      data
    );
  },
});

// Marks this file as a module so top-level names do not collide with other page scripts.
export {};
