
const graphic = require('../../src/infrastructure/renderers/HistoryGraphic2D');
const util = require('../../src/domain/services/InBodyFormatService');
const { getContainer } = require('../../src/application/AppContainer');
const { createCanvas2DContext } = require('../../src/infrastructure/renderers/Canvas2DContextAdapter');
const enum_unit = { empty: '', mmHg: 'mmHg', bpm: 'bpm' }

Page({

  /**
   * Page initial data
   */
  data: {
    NoData:'',
    IsView: false,
    loadinglength: 0,
    maxGraphData: 7,
    L: getApp().globalData.Language,
    BtnIcon_HealthReport: 'btn_HealthReport_on',
    BtnIcon_QRScan: 'btn_QRScan',
    BtnIcon_ViewMore: 'btn_ViewMore',
    graphType: 'R',
    btnRClass: "btnR_TChecked",
    btnTClass: "btnR_T",
    dateRangeText: '',
    bloodPressureData: [],
    historyData: [],
    historyItem: [
      { key: 'BP', unit: enum_unit.mmHg, canvasID: 'bp_canvas', data: [], data2:[], tableName: '', itemName: '', decemal: 0 },
      { key: 'Pulse', unit: enum_unit.bpm, canvasID: 'pulse_canvas', data: [], tableName: '', itemName: '', decemal: 0 },
    ],
    historyDefaultSet: {},
  },

  getBloodPressureData: function () {
    var uid = String(getApp().globalData.UID || "");
    const page = this;
    getContainer().reportService.getBloodPressureHistory(uid).then(function (data: any) {
      if (String(getApp().globalData.UID || '') !== uid) return;
      page.makeBloodPressureData(data);
    }).catch(function () {
      wx.showToast({ title: '血压数据加载失败，请重试', icon: 'none' });
    }).finally(() => wx.hideLoading());
  },
  clickLink: function (e) {

    wx.navigateTo({
      url: '/pages/ViewMoreMain/WebViewInBodyAppDown'
    });

  },
  makeBloodPressureData: function(data){
    console.log(data);

    getApp().globalData.BPCount = data.length;
    var historyItem = this.data.historyItem;
    var historyData: Record<string, any> = {}

    for (var i = 0; i < historyItem.length; i++) {
      var key = historyItem[i].key;
      historyData[key] = [];
    }
    historyData['Datetimes'] = [];
    historyData['DatetimesText'] = [];
    historyData['SBP'] = [];
    historyData['DBP'] = [];
    historyData['Pulse'] = [];
    data.sort(function (a: any, b: any) {
      return a.DATETIMES - b.DATETIMES;
    })

    var filterDatetimes = wx.getStorageSync('HistoryGraphFilterBP');
    console.log('tempDatetimes', filterDatetimes);
    var tempDatetimes = [];
    if ((filterDatetimes == null || filterDatetimes == '')) {
      for (var i = 0; i < data.length; i++) {
        tempDatetimes.push(data[i].DATETIMES);
      }
      console.log('tempDatetimes', tempDatetimes);
      wx.setStorageSync('HistoryGraphFilterBP', tempDatetimes);
      filterDatetimes = tempDatetimes;
    }

    var date = wx.getStorageSync('HistoryGraphDateFilterBP');
    var dateRangeText = ''
    
    if (date == null || date == '') {
      
      var stDate = data.length > 0 ? data[0].DATETIMES : '';
      if (stDate != null && stDate != '' && stDate.length >= 8) {
        stDate = util.frometYYmmddWW(stDate).dateText;
      }
      
      var dateTemp = {
        StartDate: { date: stDate, dateText: stDate },
        EndDate: { date: 'recent', dateText: '最后一次血压测量日期' }
      };
      date = dateTemp;
      wx.setStorageSync('HistoryGraphDateFilterBP', dateTemp);
    }
    if (date != null && date != '') {
      dateRangeText = date.StartDate.dateText + '~' + date.EndDate.dateText;
    }


    var graphType = this.data.graphType;
    var dataCount = data.length;
    if (graphType == 'R') {
      dataCount = this.data.maxGraphData;
    }

    var indices = [];
    var count = 0;
    for (var i = data.length - 1; i >= 0; i--) {
      var d = data[i];
      console.log('1',d.DATETIMES);
      if ((filterDatetimes.indexOf(d.DATETIMES) >= 0 || getApp().globalData.QRDatetimes == d.DATETIMES) && dataCount > count) {
        console.log('push', i);
        indices.push(i);
        count = count + 1;
        if (getApp().globalData.QRDatetimes == d.DATETIMES)
          getApp().globalData.QRDatetimes = "";
      }
      
    }
    tempDatetimes = [];
    for (var i = 0; i < data.length; i++) {
      var d = data[i];

      if (indices.indexOf(i) < 0) continue;
      tempDatetimes.push (d.DATETIMES);
      historyData.Datetimes.push(Number(d.DATETIMES))
      historyData.DatetimesText.push(util.formatHistoryDatetimes(d.DATETIMES));
      historyData.SBP.push(data[i].SPHYG1);
      historyData.DBP.push(data[i].SPHYG2);
      historyData.Pulse.push(data[i].SPHYG3);
    }

    wx.setStorageSync('HistoryGraphFilterBP', tempDatetimes);
    filterDatetimes = tempDatetimes;

    var historyItem = this.data.historyItem;
    for (var i = 0; i < historyItem.length; i++){
      var key = historyItem[i].key;
      if (key == 'BP'){
        historyItem[i].data = historyData['SBP'];
        historyItem[i].data2 = historyData['DBP'];
      } else{
        historyItem[i].data = historyData[key];
      }
    }

    this.setData({
      historyData: historyData,
      historyItem: historyItem,
      bloodPressureData: data,
      IsView: true,
      dateRangeText: dateRangeText,
    });

    this.DrawHistoryGraph();
  },
  setFilterChange: function (e) {
    wx.navigateTo({
      url: '/pages/HealthReportHistoryGraphBP/HistoryGraphDataFilter?data=' + JSON.stringify(this.data.bloodPressureData)
    })
  },
  setBind: function (e) {
    wx.showLoading({ mask: false });

    if (e.target.id == "btnR") {
      this.setData({
        graphType: 'R',
        btnRClass: "btnR_TChecked",
        btnTClass: "btnR_T",
      });
    }
    else if (e.target.id == "btnT") {
      this.setData({
        graphType: 'T',
        btnRClass: "btnR_T",
        btnTClass: "btnR_TChecked",
      });
    }
    this.makeBloodPressureData(this.data.bloodPressureData);
  },

  onLoad: function (options) {
    var noData = options.NoData;
    wx.showLoading({ mask: false });
    this.setData({
      NoData: noData,
    })
    console.log(options);
    this.getBloodPressureData();
  },

  /**
   * Lifecycle function--Called when page is initially rendered
   */
  onReady: function () {

  },

  /**
   * Lifecycle function--Called when page show
   */
  onShow: function () {
    var dateRangeText = '';
    var date = wx.getStorageSync('HistoryGraphDateFilterBP');

    if (date != null && date != '') {
      dateRangeText = date.StartDate.dateText + " ~ " + date.EndDate.dateText;
    }

    this.setData({
      dateRangeText: dateRangeText,
      
    });
    if (this.data.IsView){
      this.makeBloodPressureData(this.data.bloodPressureData);
    }
    this.setData({
      IsView: true,
    })
    
  },

  /**
   * Lifecycle function--Called when page hide
   */
  onHide: function () {

  },

  /**
   * Lifecycle function--Called when page unload
   */
  onUnload: function () {

  },

  DrawHistoryGraph:function (){
    var maxGraphData = this.data.maxGraphData;
    var windowWidth = wx.getWindowInfo().windowWidth;

    for (var i = 0; i < this.data.historyItem.length; i++) {
      var canvasID = this.data.historyItem[i].canvasID;
      var context = createCanvas2DContext(canvasID, this);
      context.clearRect(0, 0, 999, 999)
      console.log("BP", canvasID);
      this.DrawHistoryGraphType(context, this.data.historyItem[i].data, this.data.historyItem[i].data2, this.data.historyItem[i].decemal, maxGraphData, windowWidth, this.data.graphType, this.data.historyItem[i].key);
    }
  },
  
  DrawHistoryGraphType: function (context, data, data2, decemal, maxGraphData, windowWidth, graphType, key) {
    var graphOption = {
      //히스토리 데이터 그래프
      context: null as any,                                      //context
      left: 5,                                                                    //시작 X좌표
      top: 30,                                                                     //시작 Y좌표
      dataCount: maxGraphData,                                       //그래프 데이터 개수
      dashLineThick: 0.3,                                                         //눈금두께
      boxW: (windowWidth - 25) / maxGraphData,                        //한칸당 너비
      boxH: 60,                                                                  //한칸당 높이 110
      valBoxH: 8,                                                                //그려지는값이 차지하는 높이
      valUnderGap: 15,                                                             //boxH 0으로 부터 띄어지는 간격 (0일시 baseLine에 점이 찍힌다.)
      valFont: '15px Arial',                                                      //값 폰트 20px Arial
      decemal: decemal,                                                                 //소숫점 자리수
      pointRadius: 3,                                                             //점(원)의 반지름
      dashLineGap: 0.3,                                                             //대쉬 라인 간격 [null이면 default : 5]
      isDrawWLine: true,                                                          //가로라인 그리기 여부 [null이면 true]
      isDrawHLine: false,                                                          //세로라인 그리기 여부 [null이면 true]
      isDrawHLineFull: true,                                                      //세로라인을 원래 높이대로 그릴것인지 여부 [null이면 false]
      isLastValueBold: true,                                                      //마지막 값을 진하게 하는지 여부 [null이면 false]
      //히스토리 날짜 그래프
      dashLineTop: 71,                                                           //대쉬라인 시작 y좌표
      dashLineThickDate: 100,                                                     //눈금 두께
      valBoxHDate: 38,                                                            //그려지는값이 차지하는 높이
      valFontDate: 'bold 12px Arial',                                                //값 폰트 13.5px Arial
      valFontTime: '10px Arial',                                                //값 폰트 13.5px Arial
      isDrawBackColor: false,                                                      //배경 색 여부 [null 이면 false]
      isDrawUnderLine: false                                                       //아래 라인 그리기 여부 [null 이면 false]
    }
    graphOption.context = context;
    
    var dataText = data;
    var dataText2 = data2;

    var date = this.data.historyData.Datetimes;
    var dateText = this.data.historyData.DatetimesText;
    
    if (graphType == 'R') {
      if (key == 'BP'){
        this.DrawRecentHistoryGraphBP(data, data2, dataText, dataText2, date, dateText, graphOption, maxGraphData, windowWidth);
      } else {
        this.DrawRecentHistoryGraph(data, dataText, date, dateText, graphOption, maxGraphData, windowWidth);
      }
    }
    else if (graphType == 'T') {
      if (key == 'BP') {
        this.DrawTotalHistoryGraphBP(data, data2, dataText, dataText2, date, dateText, graphOption, maxGraphData, windowWidth);
      } else {
        this.DrawTotalHistoryGraph(data, dataText, date, dateText, graphOption, maxGraphData, windowWidth);
      }
    }
    graphOption.context.draw();
    wx.hideLoading();
  },
  DrawRecentHistoryGraph: function (data, dataText, date, dateText, graphOption, maxGraphData, windowWidth) {
    graphic.DrawConnectionPointGraph(graphOption.context, graphOption.left, graphOption.top, data, graphOption.dataCount, graphOption.dashLineThick, graphOption.boxW, graphOption.boxH, graphOption.valBoxH, graphOption.valUnderGap, graphOption.valFont, graphOption.decemal, graphOption.pointRadius, graphOption.dashLineGap, graphOption.isDrawWLine, graphOption.isDrawHLine, graphOption.isDrawHLineFull, graphOption.isLastValueBold, true, dataText
    );

    graphic.DrawDateHistoryWithShiftDate(graphOption.context, graphOption.left, graphOption.dashLineTop, graphOption.dashLineTop, dateText, graphOption.dataCount, graphOption.dashLineThickDate, graphOption.boxW, graphOption.valBoxHDate, graphOption.valFontDate, graphOption.valFontTime, 'R', graphOption.isDrawBackColor, graphOption.isDrawUnderLine, date, data
    );

  },
  DrawTotalHistoryGraph: function (data, dataText, date, dateText, graphOption, maxGraphData, windowWidth) {
    graphic.DrawConnectionLineGraphWithShiftDate(graphOption.context, graphOption.left, graphOption.top, data, graphOption.dataCount, date, graphOption.dashLineThick, graphOption.boxW, graphOption.boxH, graphOption.valBoxH, graphOption.valUnderGap, graphOption.valFont, graphOption.decemal, graphOption.pointRadius, graphOption.dashLineGap, graphOption.isDrawWLine, graphOption.isDrawHLine, graphOption.isDrawHLineFull, graphOption.isLastValueBold, true, dataText
    );

    graphic.DrawDateHistoryWithShiftDate(graphOption.context, graphOption.left, graphOption.dashLineTop, graphOption.dashLineTop, dateText, graphOption.dataCount, graphOption.dashLineThickDate, graphOption.boxW, graphOption.valBoxHDate, graphOption.valFontDate, graphOption.valFontTime, 'T', graphOption.isDrawBackColor, graphOption.isDrawUnderLine, date, data
    );
  },
  DrawRecentHistoryGraphBP: function (data, data2, dataText, dataText2, date, dateText, graphOption, maxGraphData, windowWidth) {
    graphic.DrawConnectionPointGraph(graphOption.context, graphOption.left, graphOption.top, data, graphOption.dataCount, graphOption.dashLineThick, graphOption.boxW, graphOption.boxH, graphOption.valBoxH, graphOption.valUnderGap, graphOption.valFont, graphOption.decemal, graphOption.pointRadius, graphOption.dashLineGap, graphOption.isDrawWLine, graphOption.isDrawHLine, graphOption.isDrawHLineFull, graphOption.isLastValueBold, true, dataText
    );
    graphOption.top = 80;
    graphic.DrawConnectionPointGraph(graphOption.context, graphOption.left, graphOption.top, data2, graphOption.dataCount, graphOption.dashLineThick, graphOption.boxW, graphOption.boxH, graphOption.valBoxH, graphOption.valUnderGap, graphOption.valFont, graphOption.decemal, graphOption.pointRadius, graphOption.dashLineGap, graphOption.isDrawWLine, graphOption.isDrawHLine, graphOption.isDrawHLineFull, graphOption.isLastValueBold, true, dataText2
    );
    graphOption.dashLineTop = graphOption.dashLineTop + 80;
    graphic.DrawDateHistoryWithShiftDate(graphOption.context, graphOption.left, graphOption.dashLineTop, graphOption.dashLineTop, dateText, graphOption.dataCount, graphOption.dashLineThickDate, graphOption.boxW, graphOption.valBoxHDate, graphOption.valFontDate, graphOption.valFontTime, 'R', graphOption.isDrawBackColor, graphOption.isDrawUnderLine, date, data
    );

  },
  DrawTotalHistoryGraphBP: function (data, data2, dataText, dataText2, date, dateText, graphOption, maxGraphData, windowWidth) {
    graphic.DrawConnectionLineGraphWithShiftDate(graphOption.context, graphOption.left, graphOption.top, data, graphOption.dataCount, date, graphOption.dashLineThick, graphOption.boxW, graphOption.boxH, graphOption.valBoxH, graphOption.valUnderGap, graphOption.valFont, graphOption.decemal, graphOption.pointRadius, graphOption.dashLineGap, graphOption.isDrawWLine, graphOption.isDrawHLine, graphOption.isDrawHLineFull, graphOption.isLastValueBold, true, dataText
    );
    graphOption.top = 80;
    graphic.DrawConnectionLineGraphWithShiftDate(graphOption.context, graphOption.left, graphOption.top, data2, graphOption.dataCount, date, graphOption.dashLineThick, graphOption.boxW, graphOption.boxH, graphOption.valBoxH, graphOption.valUnderGap, graphOption.valFont, graphOption.decemal, graphOption.pointRadius, graphOption.dashLineGap, graphOption.isDrawWLine, graphOption.isDrawHLine, graphOption.isDrawHLineFull, graphOption.isLastValueBold, true, dataText2
    );
    graphOption.dashLineTop = graphOption.dashLineTop + 80;
    graphic.DrawDateHistoryWithShiftDate(graphOption.context, graphOption.left, graphOption.dashLineTop, graphOption.dashLineTop, dateText, graphOption.dataCount, graphOption.dashLineThickDate, graphOption.boxW, graphOption.valBoxHDate, graphOption.valFontDate, graphOption.valFontTime, 'T', graphOption.isDrawBackColor, graphOption.isDrawUnderLine, date, data
    );
  },
  
})

// Marks this file as a module so top-level names do not collide with other page scripts.
export {};
