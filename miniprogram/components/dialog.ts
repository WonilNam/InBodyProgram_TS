
// components/dialog.js
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    title: {
      type: String,
      value: "",
    },
    content: String,
    status: {
      type: Boolean,
      value: false,
    },
    confirmText: {
      type: String,
      value: "确认",
    },
    cancelText: {
      type: String,
      value: "取消",
    },
    showCancel: {
      type: Boolean,
      value: true,
    },
  },

  /**
   * 组件的初始数据
   */
  data: {},

  /**
   * 组件的方法列表
   */
  methods: {
    handleCancel() {
      this.triggerEvent("cancel");
    },
    handleConfirm() {
      this.triggerEvent("confirm");
    },
    preventTouchMove() {},
  },
})

