
// pages/SetupInBodyEquip/SetupInBodyEquipWifiSearchH30.js
Page({

    /**
     * 页面的初始数据
     */
    data: {
        displayValue: '',
        passwordValue: '',
        timer: 0,
        SSID: '',
        isEnterPressed: false,
        viewType: 'register',
        security: 0,
        maxPasswordLength: 20,
        showPassword: true
    },


    onInput(e) {
        this.lastPassword = e.detail.value;
        this.setData({
            passwordValue: e.detail.value
        });
    },

    toggleShowPassword() {
        this.setData({
            showPassword: !this.data.showPassword
        });
    },

    onConfirm(e) {
        this.data.isEnterPressed = true;
        getApp().globalData.BluetoothH30.wifiSet(this.data.SSID, this.data.passwordValue);
    },
    connectRes(res) {
        if (res == 48) {
            getApp().globalData.BluetoothH30.setSSID(this.data.SSID);
            if (this.data.viewType == 'register') {
                wx.redirectTo({
                    url: '/pages/SetupInBodyEquip/SetupInBodyEquipConnectedH30',
                })
            } else {
                wx.redirectTo({
                    url: '/pages/SetupInBodyEquip/SetupInBodyEquipSettingH30',
                })
            }

            // wx.navigateTo({
            //   url: '/pages/SetupInBodyEquip/SetupInBodyEquipWifiSearchH30?viewType=connected',
            // })
        } else {
            wx.showModal({
                title: '提示', // 对话框标题
                content: '连接失败！', // 对话框内容
                showCancel: false, // 是否显示取消按钮，false表示不显示，默认为true
            });
        }
    },
    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
        let viewType = options.viewType;
        this.setData({
            viewType: viewType
        })
        const eventChannel = this.getOpenerEventChannel()
        // 监听acceptDataFromOpenerPage事件，获取上一页面通过eventChannel传送到当前页面的数据
        eventChannel.on('acceptDataFromOpenerPage', (data: any) => {
            console.log(data);
            this.setData({
                SSID: data.data,
            })
        })

        // 根据管理者判定结果设置最大密码长度
        const BT = getApp().globalData.BluetoothH30;
        let maxLen = BT.isWASupported() ? 63 : 20;

        this.setData({
            maxPasswordLength: maxLen
        });
        this.lastPassword = ""; // 初始化同步追踪变量
        console.log("Setting maxPasswordLength to:", maxLen);
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
        getApp().globalData.BluetoothH30.setOnWifiConnectCompletedCallback(this.connectRes);
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
