
// pages/SetupInBodyEquip/SetupInBodyEquipWifiSearchH30.js
Page({

    /**
     * 页面的初始数据
     */
    data: {
        viewType: 'searching',
        connected: false,
        progress: 0,
        intervalId: 0,
        SSID: '',
        btnSelect: '搜索',
        switchOn: true,
        wifiInfo: [{
            SSIDLength: 0, //SSID 的长度
            SSID: '', //Wi-Fi 的 SSID
            MacAddr: '', //Wi-Fi 的 MAC 地址
            NetworkMode: 0, //网络模式  0x30: Infrastructure, 0x31: IBSS(AdHoc), 0x32/0x34: reserved
            Security: 0, //安全性级别 0x30: open, 0x31: WEP, 0x32: WPA_PSK, 0x33: WPA_Enterprise,  0x34: WPA2_PSK, 0x35: WPA2_Enterprise           
            Channel: 0, //Wi-Fi 的信道
            Rssi: 0 //接收信号强度指示（RSSI)
        }],
        processEnum:0
    },



    /**
     * 生命周期函数--监听页面加载
     */
    onLoad(options) {
        getApp().globalData.BluetoothH30.setOnWifiSearchCallback(this.searchedCallBack);
        var viewType = options.viewType;
        var ssid = options.ssid;
        var wifiUsageVariable = options.wifiUsageVariable;
        console.log(wifiUsageVariable)
        console.log(viewType)
        console.log(ssid)
        this.setData({
            processEnum:0
        })
        if (viewType == 'searching') {
            this.setData({
                viewType: 'searching',
                btnSelect: '搜索',
            })
            getApp().globalData.BluetoothH30.wifiScan();
            if (this.data.intervalId) {
                clearInterval(this.data.intervalId);
            }

            this.setData({
                progress: 0
            });
            const intervalId = setInterval(() => {
                let newProgress = this.data.progress + 5;
                if (newProgress > 100) {
                    newProgress = 0;
                }
                this.setData({
                    progress: newProgress
                });
            }, 1000)
            this.setData({
                intervalId: intervalId
            })
        } else {
            if (ssid != '' && ssid != undefined && viewType == 'connected') {
                this.setData({
                    SSID: ssid,
                    viewType: 'connected',
                    btnSelect: '重新连接',
                    connected: true,
                    switchOn:wifiUsageVariable == '1'
                })
            }
        }

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
        if (this.data.intervalId) {
            clearInterval(this.data.intervalId);
        }
    },
    switchChanged(e) {
        console.log(e);
        this.setData({
            processEnum:1
        })
        var switchOn = e.detail.value;
        if (switchOn)
            getApp().globalData.BluetoothH30.setWifiUsage(1);
        else
            getApp().globalData.BluetoothH30.setWifiUsage(0);
        this.setData({
            switchOn:switchOn
        })
    },

    search: function (e) {
        this.setData({
            viewType: 'searching',
            processEnum:0
        })
        getApp().globalData.BluetoothH30.wifiScan();
        if (this.data.intervalId) {
            clearInterval(this.data.intervalId);
        }

        this.setData({
            progress: 0
        });
        const intervalId = setInterval(() => {
            let newProgress = this.data.progress + 4;
            if (newProgress > 100) {
                newProgress = 0;
            }
            this.setData({
                progress: newProgress
            });
        }, 1000)
        this.setData({
            intervalId: intervalId
        })
    },
    searchedCallBack: function (e) {
        console.log(e);
        var processCase = this.data.processEnum;
        if(processCase == 0)
        {
            if (this.data.intervalId) {
                clearInterval(this.data.intervalId);
            }
            if (e == false) {
                this.setData({
                    viewType: '',
                    btnSelect: '重新搜索'
                });
                return;
            }
            if(e == 'NONE')
            {
                wx.showModal({
                    title: '提示', // 对话框标题
                    content: '搜索失败！', // 对话框内容
                    showCancel: false, // 是否显示取消按钮，false表示不显示，默认为true
                });
                this.setData({
                    viewType: '',
                    btnSelect: '重新搜索'
                });
                return;
            }
            let sortedWifiInfo = e.sort((a: any, b: any) => b.Rssi - a.Rssi);
            sortedWifiInfo = this.removeDuplicatesBySSID(sortedWifiInfo);
            console.log(sortedWifiInfo);
            this.setData({
                progress: 100,
                viewType: 'searched',
                wifiInfo: sortedWifiInfo
            });
        }else{
            var switchOn = this.data.switchOn;
            if (!e) {
                this.setData({
                    switchOn: !switchOn
                })
            }
        }
       

    },
    select: function (e) {
        var SSID = e.currentTarget.dataset.id;
        let viewType = 'register';
        if(this.data.connected == true)
        viewType = 'settings'
        wx.navigateTo({
            url: '/pages/SetupInBodyEquip/SetupInBodyEquipWifiPasswordH30?viewType=' + viewType,
            success: function (res: any) {
                res.eventChannel.emit('acceptDataFromOpenerPage', {
                    data: SSID,
                });
            }
        })
    },
    removeDuplicatesBySSID: function (array) {
        const map = new Map();

        array.forEach((wifiInfo: any) => {
            if (!map.has(wifiInfo.SSID) || ((map.get(wifiInfo.SSID).Rssi < wifiInfo.Rssi) && !Number.isNaN(wifiInfo.Rssi))) {
                map.set(wifiInfo.SSID, wifiInfo);
            }
        });

        return Array.from(map.values());
    },
})
