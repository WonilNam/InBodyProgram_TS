
// pages/SetupInBodyEquip/SetupInBodyEquipWifiSearchH30.js
import { alertSetupFailure, getH30Setup, showSetupBusy, WIFI_JOINED_CODE } from "../../src/application/services/H30Setup";

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

    async onConfirm(e) {
        if (this.data.isEnterPressed) return;
        this.data.isEnterPressed = true;
        showSetupBusy();
        let code;
        try {
            code = await getH30Setup().connectWifi(this.data.SSID, this.data.passwordValue);
        } catch (error) {
            console.error('Wi-Fi 配置失败', error);
            wx.hideLoading();
            this.data.isEnterPressed = false;
            await alertSetupFailure();
            return;
        }
        wx.hideLoading();
        this.data.isEnterPressed = false;
        this.connectRes(code);
    },
    connectRes(res) {
        if (res == WIFI_JOINED_CODE) {
            getH30Setup().ssid = this.data.SSID;
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
        let maxLen = getH30Setup().supportsLongWifiPassword() ? 63 : 20;

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
