
const enum_unit = { empty: '', kg: 'kg', percent: '%', kgm2: 'kg/m²', cm2: 'cm²' }
const util = require('../../src/domain/services/InBodyFormatService');
const { createCanvas2DContext } = require('../../src/infrastructure/renderers/Canvas2DContextAdapter');

// App 变化图按指标使用不同的横向刻度密度；这里记录的是相邻横线的区间数。
const GRID_INTERVALS: Record<string, number> = { FS: 8, BFM: 3, VFALevel: 6, BMR: 5, WT: 3 };
// 最小纵轴跨度避免相近测量值被放大到整张图，单位与指标原始值相同。
const MIN_AXIS_SPAN: Record<string, number> = {
  FS: 8, BMR: 100, WT: 6.5, SMM: 3, BFM: 4.7,
  BMI: 2, PBF: 10, WHR: .2, VFALevel: 6,
  TBW: 1.7, ICW: 1.1, ECW: .55, WED: .003,
  PROTEIN: 1.5, MINERAL: .2, BMC: .15, BCM: 4,
  BSMI: 1, WBPA50: .35, INLL: 4,
};

function metricPointColor(item: any, point: any) {
  var range = item.rangeData && item.rangeData[point.index];
  if (!range) return '#758095';
  return point.value < range.min || point.value > range.max ? '#F25C75' : '#47B998';
}

Component({
  behaviors: [],
  properties: {
    historyItem: {
      type: Object,
      observer: function (newData: any, oldData: any) {
        console.log('history 88 historyItem 변경--newData=='+newData+"==oldData=="+oldData)
        this.refresh();
      }
    },
    historyData: Object,
    graphType: String,
  },
  data: {
    loadinglength: 0,
    maxGraphData: 7,
    L: getApp().globalData.Language,
    selectedByKey: {},
  },

  attached: function () {
    console.log("history 88 attached");
    // this.refresh();
  },

  moved: function () {
    console.log("move");
   },
  detached: function () {
    console.log("detached");
   },


  methods: {
    
    refresh:function (){
      var that = this;
     
      that.DrawHistoryGraph();
      wx.hideLoading();
    },

    DrawHistoryGraph: function () {
      this._graphZoom = {};
      this._selectedPointIndex = {};
      this._pointPositions = {};
      this.setData({ selectedByKey: {} });
      var windowWidth = wx.getWindowInfo().windowWidth;
      var historyData = this.data.historyData || {};
      var dateLabels = historyData.DatetimesText || [];
      var items = this.data.historyItem || [];
      var canvasWidth = windowWidth * 614 / 750;
      var canvasHeight = windowWidth * 400 / 750;
      for (var i = 0; i < items.length; i++) {
        var canvasID = 'graph-' + items[i].key;
        var context = createCanvas2DContext(canvasID, this, { width: canvasWidth, height: canvasHeight });
        context.clearRect(0, 0, canvasWidth, canvasHeight);
        this.DrawMetricGraph(context, items[i], dateLabels, canvasWidth, canvasHeight, null);
        context.draw();
      }
    },
    redrawGraph: function (key) {
      var item = (this.data.historyItem || []).filter(function (entry: any) { return entry.key === key; })[0];
      if (!item) return;
      var width = wx.getWindowInfo().windowWidth * 614 / 750;
      var height = wx.getWindowInfo().windowWidth * 400 / 750;
      var context = createCanvas2DContext('graph-' + item.key, this, { width: width, height: height });
      context.clearRect(0, 0, width, height);
      this.DrawMetricGraph(context, item, (this.data.historyData || {}).DatetimesText || [], width, height, this._graphZoom[key]);
      context.draw();
    },
    defaultGraphScale: function (item) {
      if (this.data.graphType !== 'T') return 1;
      var count = (item.data || []).filter(function (value: any) {
        return value != null && value !== '' && Number.isFinite(Number(value));
      }).length;
      return count >= 7 ? 6 / Math.min(count - 1, 11) : 1;
    },
    graphLayout: function (item, width, scale) {
      var count = (item.data || []).filter(function (value: any) {
        return value != null && value !== '' && Number.isFinite(Number(value));
      }).length;
      var left = count >= 7 ? (this.data.graphType === 'R' ? 2 : width * .105) : width * .13;
      var right = width * (count >= 7 ? (this.data.graphType === 'R' ? .83 : .935) : .95);
      var slotSpacing = (right - left) / 6;
      var spacing = slotSpacing;
      return { left: left, right: right, spacing: spacing, minOffset: Math.min(0, right - left - spacing * Math.max(0, count - 1) * scale) };
    },
    onGraphTouchStart: function (event) {
      var key = event.currentTarget.dataset.key;
      var touches = event.touches || [];
      if (!key || touches.length === 0) return;
      if (!this._graphZoom) this._graphZoom = {};
      var item = (this.data.historyItem || []).filter(function (entry: any) { return entry.key === key; })[0];
      if (!item) return;
      var width = wx.getWindowInfo().windowWidth * 614 / 750;
      var defaultScale = this.defaultGraphScale(item);
      var zoom = this._graphZoom[key] || { scale: defaultScale, offset: this.graphLayout(item, width, defaultScale).minOffset };
      this._graphZoom[key] = zoom;
      if (touches.length >= 2) {
        var dx = touches[0].clientX - touches[1].clientX;
        var dy = touches[0].clientY - touches[1].clientY;
        zoom.gesture = { type: 'pinch', distance: Math.sqrt(dx * dx + dy * dy), scale: zoom.scale, offset: zoom.offset, moved: true };
      } else {
        zoom.gesture = { type: 'pan', x: touches[0].clientX, y: touches[0].clientY, offset: zoom.offset, moved: false };
      }
    },
    onGraphTouchMove: function (event) {
      var key = event.currentTarget.dataset.key;
      var touches = event.touches || [];
      var zoom = this._graphZoom && this._graphZoom[key];
      if (!zoom || !zoom.gesture || touches.length === 0) return;
      var item = (this.data.historyItem || []).filter(function (entry: any) { return entry.key === key; })[0];
      if (!item) return;
      if (touches.length >= 2) {
        if (zoom.gesture.type !== 'pinch') {
          this.onGraphTouchStart(event);
          return;
        }
        var dx = touches[0].clientX - touches[1].clientX;
        var dy = touches[0].clientY - touches[1].clientY;
        var distance = Math.sqrt(dx * dx + dy * dy);
        if (zoom.gesture.distance > 0) {
          var pointCount = (item.data || []).filter(function (value: any) {
            return value != null && value !== '' && Number.isFinite(Number(value));
          }).length;
          var minScale = this.data.graphType === 'R' ? 1 : 6 / Math.max(6, pointCount - 1);
          var maxScale = this.data.graphType === 'R' ? 4 : 1;
          zoom.scale = Math.max(minScale, Math.min(maxScale, zoom.gesture.scale * distance / zoom.gesture.distance));
          var anchorX = wx.getWindowInfo().windowWidth * 614 / 750 / 2;
          var left = this.graphLayout(item, wx.getWindowInfo().windowWidth * 614 / 750, zoom.scale).left;
          zoom.offset = anchorX - left - (anchorX - left - zoom.gesture.offset) * zoom.scale / zoom.gesture.scale;
        }
      } else {
        if (zoom.gesture.type !== 'pan') {
          this.onGraphTouchStart(event);
          return;
        }
        if (Math.abs(touches[0].clientX - zoom.gesture.x) > 6 || Math.abs(touches[0].clientY - zoom.gesture.y) > 6) {
          zoom.gesture.moved = true;
        }
        zoom.offset = zoom.gesture.offset + touches[0].clientX - zoom.gesture.x;
      }
      var width = wx.getWindowInfo().windowWidth * 614 / 750;
      var minOffset = this.graphLayout(item, width, zoom.scale).minOffset;
      zoom.offset = Math.max(minOffset, Math.min(0, zoom.offset));
      this.redrawGraph(key);
    },
    onGraphTouchEnd: function (event) {
      var key = event.currentTarget.dataset.key;
      var zoom = this._graphZoom && this._graphZoom[key];
      if (!zoom) return;
      var gesture = zoom.gesture;
      var touch = event.changedTouches && event.changedTouches[0];
      zoom.gesture = null;
      if (event.touches && event.touches.length > 0) {
        this.onGraphTouchStart(event);
      } else if (gesture && gesture.type === 'pan' && !gesture.moved && event.type !== 'touchcancel' && touch) {
        this.selectGraphPoint(key, touch);
      }
    },
    selectGraphPoint: function (key, touch) {
      var that = this;
      var positions = this._pointPositions && this._pointPositions[key] || [];
      var clientX = touch.clientX != null ? touch.clientX : touch.pageX;
      var clientY = touch.clientY != null ? touch.clientY : touch.pageY;
      if (!positions.length || !Number.isFinite(Number(clientX)) || !Number.isFinite(Number(clientY))) return;
      var query = wx.createSelectorQuery().in(this);
      query.select('#graph-' + key).boundingClientRect();
      query.select('#summary-' + key).boundingClientRect();
      query.exec(function (rects: any) {
        var rect = rects && rects[0];
        var summaryRect = rects && rects[1];
        if (!rect) return;
        var item = (that.data.historyItem || []).filter(function (entry: any) { return entry.key === key; })[0];
        if (!item) return;
        var touchX = clientX - rect.left;
        var touchY = clientY - rect.top;
        var nearest = null;
        var nearestDistance = Infinity;
        var visibleLeft = that.graphLayout(item, rect.width, 1).left;
        positions.forEach(function (point: any) {
          if (point.x < visibleLeft - .5 || point.x > rect.width - 8) return;
          var distance = Math.sqrt(Math.pow(point.x - touchX, 2) + Math.pow(point.y - touchY, 2));
          if (distance < nearestDistance) {
            nearest = point;
            nearestDistance = distance;
          }
        });
        if (nearestDistance > 24 && positions.length > 1) {
          var curveDistance = Infinity;
          var curvePoint = null;
          for (var segmentIndex = 1; segmentIndex < positions.length; segmentIndex++) {
            var previous = positions[segmentIndex - 1];
            var current = positions[segmentIndex];
            var midpoint = (previous.x + current.x) / 2;
            for (var step = 0; step <= 16; step++) {
              var t = step / 16;
              var inverse = 1 - t;
              var x = inverse * inverse * inverse * previous.x + 3 * inverse * inverse * t * midpoint + 3 * inverse * t * t * midpoint + t * t * t * current.x;
              var y = inverse * inverse * inverse * previous.y + 3 * inverse * inverse * t * previous.y + 3 * inverse * t * t * current.y + t * t * t * current.y;
              if (x < visibleLeft - .5 || x > rect.width - 8) continue;
              var distance = Math.sqrt(Math.pow(x - touchX, 2) + Math.pow(y - touchY, 2));
              if (distance < curveDistance) {
                curveDistance = distance;
                curvePoint = t < .5 ? previous : current;
              }
            }
          }
          if (curveDistance <= 22) nearest = curvePoint;
        }
        if (!nearest || (nearestDistance > 24 && !curvePoint)) return;
        var dateLabels = (that.data.historyData || {}).DatetimesText || [];
        var selectedByKey = Object.assign({}, that.data.selectedByKey);
        var halfSummaryWidth = summaryRect ? summaryRect.width / 2 : 0;
        var summaryX = Math.max(halfSummaryWidth, Math.min(rect.width - halfSummaryWidth, nearest.x));
        selectedByKey[key] = {
          date: String(dateLabels[nearest.index] || ''),
          value: item.textData && item.textData[nearest.index] != null
            ? String(item.textData[nearest.index]) : String(nearest.value),
          summaryX: summaryX,
        };
        if (!that._selectedPointIndex) that._selectedPointIndex = {};
        that._selectedPointIndex[key] = nearest.index;
        that.setData({ selectedByKey: selectedByKey }, function () { that.redrawGraph(key); });
      });
    },
    DrawMetricGraph: function (context, item, dateLabels, width, height, zoom) {
      var values = item.data || [];
      var points: any[] = [];
      for (var i = 0; i < values.length; i++) {
        var value = values[i];
        if (value != null && value !== '' && Number.isFinite(Number(value))) {
          points.push({ index: i, value: Number(value) });
        }
      }
      var plotLeft = 8;
      var pointLeft = this.graphLayout(item, width, 1).left;
      var plotTop = height * .17;
      var plotBottom = height - 52;
      var plotHeight = plotBottom - plotTop;
      var min = points.length ? Math.min.apply(null, points.map(function (point) { return point.value; })) : 0;
      var max = points.length ? Math.max.apply(null, points.map(function (point) { return point.value; })) : 0;
      var isWhr = item.key === 'WHR';
      var spread = max - min;
      var minSpan = MIN_AXIS_SPAN[item.key] || Math.max(Math.abs(max) * .1, 1);
      var axisSpan = Math.max(minSpan, spread * 1.15);
      var axisMin = (min + max - axisSpan) / 2;
      var axisMax = axisMin + axisSpan;
      if (item.key === 'FS') {
        axisMin = min;
        axisMax = min + axisSpan;
      } else if (isWhr) {
        axisMin = Math.min(.8, Math.floor(min / .05) * .05);
        axisMax = Math.max(1, Math.ceil(max / .05) * .05);
      }
      var gridCount = isWhr ? 4 : (GRID_INTERVALS[item.key] || 4);
      for (var line = 0; line <= gridCount; line++) {
        var gridY = plotTop + plotHeight * line / gridCount;
        context.setStrokeStyle('#ededed');
        context.setLineWidth(1);
        context.beginPath();
        context.moveTo(plotLeft, gridY);
        context.lineTo(width - 8, gridY);
        context.stroke();
      }
      if (points.length === 0) return;

      var scale = zoom && points.length > 1 ? zoom.scale : this.defaultGraphScale(item);
      var isOverview = this.data.graphType === 'T' && scale < 6 / 11 - .001;
      var layout = this.graphLayout(item, width, scale);
      var offset = zoom && points.length > 1 ? zoom.offset : layout.minOffset;
      points.forEach(function (point, index) {
        point.x = pointLeft + layout.spacing * index * scale + offset;
        point.y = plotTop + plotHeight * (axisMax - point.value) / (axisMax - axisMin);
      });
      var visiblePoints = points.filter(function (point) { return point.x >= pointLeft - .5 && point.x <= width - 8; });

      if (!this._pointPositions) this._pointPositions = {};
      this._pointPositions[item.key] = points.map(function (point) {
        return { index: point.index, value: point.value, x: point.x, y: point.y };
      });
      var selectedIndex = this._selectedPointIndex && this._selectedPointIndex[item.key];
      var selected = points.filter(function (point) { return point.index === selectedIndex; })[0] || points[points.length - 1];
      context.setStrokeStyle('#c9c7ce');
      context.setLineWidth(3);
      for (var dashY = 0; selected.x >= 0 && selected.x <= width - 8 && dashY < plotBottom; dashY += 10) {
        context.beginPath();
        context.moveTo(selected.x, dashY);
        context.lineTo(selected.x, Math.min(dashY + 6, plotBottom));
        context.stroke();
      }

      context.save();
      context.beginPath();
      // 裁剪线段时给首个可见点留出半径和白色描边，前一条记录仍在边界外。
      context.rect(pointLeft - 7, plotTop - 12, width - pointLeft - 1, plotBottom - plotTop + 24);
      context.clip();
      if (points.length > 1) {
        var overviewColor = metricPointColor(item, visiblePoints[visiblePoints.length - 1]);
        if (isOverview) {
          var overviewFill = overviewColor === '#F25C75' ? 'rgba(242,92,117,0.13)'
            : overviewColor === '#47B998' ? 'rgba(71,185,152,0.13)' : 'rgba(117,128,149,0.13)';
          context.setFillStyle(overviewFill);
          context.beginPath();
          context.moveTo(points[0].x, plotBottom);
          context.lineTo(points[0].x, points[0].y);
          for (var fillIndex = 1; fillIndex < points.length; fillIndex++) {
            context.lineTo(points[fillIndex].x, points[fillIndex].y);
          }
          context.lineTo(points[points.length - 1].x, plotBottom);
          context.closePath();
          context.fill();
        }
        context.setStrokeStyle(isOverview ? overviewColor : '#dedee0');
        context.setLineWidth(3);
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        for (var segment = 1; segment < points.length; segment++) {
          var previous = points[segment - 1];
          var current = points[segment];
          if (isOverview) {
            context.lineTo(current.x, current.y);
          } else {
            var midpoint = (previous.x + current.x) / 2;
            context.bezierCurveTo(midpoint, previous.y, midpoint, current.y, current.x, current.y);
          }
        }
        context.stroke();
      }
      var drawnPoints = isOverview && visiblePoints.length > 0
        ? [visiblePoints[0], visiblePoints[visiblePoints.length - 1]] : points;
      drawnPoints.forEach(function (point) {
        context.setFillStyle(metricPointColor(item, point));
        context.beginPath();
        context.arc(point.x, point.y, 5, 0, Math.PI * 2);
        context.fill();
        context.setStrokeStyle('#fff');
        context.setLineWidth(2);
        context.stroke();
      });
      context.restore();

      context.setFillStyle('#2a292e');
      context.setFontSize(15);
      context.font = 'bold 15px sans-serif';
      context.setTextAlign('center');
      var valuePoints = this.data.graphType === 'T' && visiblePoints.length >= 7
        ? [visiblePoints[0], visiblePoints[visiblePoints.length - 1]] : visiblePoints;
      valuePoints.forEach(function (point) {
        var valueText = item.textData && item.textData[point.index] != null
          ? String(item.textData[point.index]) : String(point.value);
        context.fillText(valueText, point.x, point.y - 14);
      });
      context.setFillStyle('#858d99');
      var datePoints = this.data.graphType === 'T' && visiblePoints.length >= 7
        ? [visiblePoints[0], visiblePoints[visiblePoints.length - 1]] : visiblePoints;
      if (isOverview && visiblePoints.length > 1) {
        var firstPoint = visiblePoints[0];
        var lastPoint = visiblePoints[visiblePoints.length - 1];
        var firstDate = String(dateLabels[firstPoint.index] || '');
        var lastDate = String(dateLabels[lastPoint.index] || '');
        context.setFontSize(13);
        context.font = '13px sans-serif';
        context.fillText(firstDate.substring(3, 8), firstPoint.x, height - 18);
        context.fillText(lastDate.substring(3, 8), lastPoint.x, height - 18);
        var previousYear = firstDate.substring(0, 2);
        visiblePoints.slice(1, -1).forEach(function (point) {
          var year = String(dateLabels[point.index] || '').substring(0, 2);
          if (!/^\d{2}$/.test(year) || year === previousYear) return;
          previousYear = year;
          if (point.x > firstPoint.x + 48 && point.x < lastPoint.x - 48) {
            context.fillText('20' + year, point.x, height - 18);
          }
        });
        return;
      }
      var dateLabelsToDraw: any[] = datePoints.map(function (this: any, point: any, dateIndex: number) {
        var fullDate = String(dateLabels[point.index] || '');
        var shortDate = fullDate.match(/^\d{2}\.(\d{2}\.\d{2})/);
        var isRecentLast = this.data.graphType === 'R' && dateIndex === datePoints.length - 1;
        var isSparseFirst = this.data.graphType === 'T' && visiblePoints.length < 7 && dateIndex === 0;
        var dateText = isRecentLast || isSparseFirst
          ? (shortDate ? shortDate[0] : fullDate.substring(0, 8))
          : (shortDate ? shortDate[1] : fullDate.substring(0, 5));
        return { text: dateText, x: point.x };
      }, this);
      var dateFontSize = 14;
      for (; dateFontSize >= 9; dateFontSize--) {
        context.setFontSize(dateFontSize);
        context.font = dateFontSize + 'px sans-serif';
        dateLabelsToDraw.forEach(function (label) { label.width = context.measureText(label.text).width; });
        var hasOverlap = false;
        for (var labelIndex = 1; labelIndex < dateLabelsToDraw.length; labelIndex++) {
          var previousLabel = dateLabelsToDraw[labelIndex - 1];
          var currentLabel = dateLabelsToDraw[labelIndex];
          if (currentLabel.x - previousLabel.x < (previousLabel.width + currentLabel.width) / 2 + 4) {
            hasOverlap = true;
            break;
          }
        }
        if (!hasOverlap || dateFontSize === 9) break;
      }
      dateLabelsToDraw.forEach(function (this: any, label: any, index: number) {
        var dateX = label.x;
        var isRecentEdge = this.data.graphType === 'R' && dateLabelsToDraw.length >= 7 &&
          (index === 0 || index === dateLabelsToDraw.length - 1);
        if (!isRecentEdge) {
          dateX = Math.max(plotLeft + label.width / 2, Math.min(width - 8 - label.width / 2, dateX));
        }
        context.fillText(label.text, dateX, height - 18);
      }, this);
    },
  }
});

// Marks this file as a module so top-level names do not collide with other page scripts.
export {};
