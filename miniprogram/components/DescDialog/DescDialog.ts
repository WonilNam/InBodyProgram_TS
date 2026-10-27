
// components/DescDialog/DescDialog.js
Component({

  /**
   * 组件的属性列表
   */
  properties: {
    title:{
        type:String,
        value:"标题"
      },
      content:String,
      status:{
        type:Boolean,
        value:false,
      },
      useNativeOverlay:{
        type:Boolean,
        value:false,
      }
  },

  /**
   * 组件的初始数据
   */
  data: {

  },

  /**
   * 组件的方法列表
   */
  methods: {
    handleCancel(){
        this.triggerEvent("cancel")
      },
      handleConfirm(){
          this.triggerEvent('confirm')
      },
      preventTouchMove() {}
  }
})

