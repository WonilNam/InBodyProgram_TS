
// pages/SetupInBodyEquip/SetupInBodyEquipWifiSearchH30.js
Page({

    /**
     * 页面的初始数据
     */
    data: {
        displayValue: '',
        passwordValue: '',
        isEnterPressed: false,
        serialNumber:'',
        btnEnabled:false
    },


    onInput(e) {
        let serialNumber = e.detail.value;
        console.log(serialNumber);
        console.log(this.data.serialNumber);
        if(serialNumber == this.data.serialNumber){
            this.setData({
                btnEnabled:true
            })
        }else{
            this.setData({
                btnEnabled:false
            })
        }
        

    },
    initialized(){
        wx.redirectTo({
          url: '/pages/SetupInBodyEquip/SetupInBodyEquipSettingH30?viewType=initialized',
        })
    },

    onConfirm(e) {
        // Deliberately does nothing: resetting the device user list (sdk.initUserList) is not triggered from here.
    },
    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
        let serialNumber = options.serialNumber;
        console.log(serialNumber);
        this.setData({
            serialNumber:serialNumber
        })       
    },

    /**
     * 生命周期函数--监听页面初次渲染完成
     */
    onReady() {

    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow() {
       
    },

    /**
     * 生命周期函数--监听页面隐藏
     */
    onHide() {

    },

    /**
     * 生命周期函数--监听页面卸载
     */
    onUnload() {

    },

})
