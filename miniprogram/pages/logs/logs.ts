
//logs.js
const util = require('../../src/domain/services/InBodyFormatService')

Page({
  data: {
    logs: []
  },
  onLoad: function () {
    this.setData({
      logs: (wx.getStorageSync('logs') || []).map((log: any) => {
        return util.formatTime(new Date(log))
      })
    })
  }
})

// Marks this file as a module so top-level names do not collide with other page scripts.
export {};
