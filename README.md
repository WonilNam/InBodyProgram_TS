# InBody 微信小程序 TypeScript 重构

本项目主要由同级 `wx_InBodyProgram-new_master` 的原生小程序迁移而来。
页面、资源和后端契约沿用原项目；硬件通信另由 `hardware-sdk` 分层实现承接。
这是渐进迁移项目，当前仍保留旧设备设置、配网和部分报告页面。

## 运行与验证

使用微信开发者工具打开项目根目录，`project.config.json` 的小程序根目录为 `miniprogram/`。

```powershell
npm install
npm run typecheck
npm test -- --runInBand
```

单元测试使用 Node 和微信 API 替身，不代表已完成微信开发者工具预览、真实服务器联调或 BLE 真机验证。

## 结构与依赖

| 位置 | 职责 |
| --- | --- |
| `miniprogram/pages`、`components` | 原生页面、组件、页面交互与 setData |
| `miniprogram/src/application/services` | 登录、报告、测量和设备设置用例 |
| `miniprogram/src/application/stores` | 身份、报告、测量会话状态 |
| `miniprogram/src/application/AppContainer.ts` | 依赖装配、单次冷启动恢复、迁移期 BLE 交接 |
| `miniprogram/src/domain` | 记录类型、指标规则、日期与设备可见性规则、外部端口 |
| `miniprogram/src/infrastructure` | 微信 API 适配、数据映射、Canvas 渲染及设置流程的 BLE 传输与编解码 |
| `miniprogram/hardware-sdk` | 设备服务、通信引擎、帧解析、组帧和型号状态机 |

新增业务优先通过应用服务访问外部能力。领域规则不应直接调用微信 API。
当前模型以类型与纯函数为主，无需为满足 DDD 名称而增加聚合、仓储或事件总线。

## 当前主链路

- `app.onLaunch` 与启动页共同使用 `AppContainer.initializeSession()`，复用同一恢复 Promise。
- 启动恢复兼容 `auth:profile` 与旧版 `InBodyUID / UserTelHP / InBodyUserInfo`。
- 两个手机号入口调用 `LoginActions.loginAndNavigate`，仅成功登录后进入首页。
- 登录服务先同步设备指标矩阵，再映射历史；登录及会员资料响应均校验会话版本。
- 首页通过 `ReportAppService` 和 `ReportStore` 加载历史，使用记录的 `raw` 字段兼容原图表。
- 首页 H20B、InBody120、H30、H40 的开始测试操作分别映射为 SDK 的 `H20 / 120 / H30 / H40`，进入 `MeasurementWorkflowService`。
- 测量订阅由统一组件展示；完成后上传，成功后刷新报告，失败时保留本次 payload 并允许手动重试。

首页布局和按钮沿用既有设计，测量过程使用项目已有的 `measure-modal` 组件。

## 会话与取消约束

1. 会话版本在身份切换及退出时递增。旧资料响应不能恢复已退出的登录状态。
2. 退出或切换账号时，清理内存报告、报告缓存和身份相关旧存储。
3. 新报告缓存附带 `report:historyOwner`。没有归属标识的旧缓存不直接展示，改为重新请求。
4. 每次测量固定启动时的身份、设备和会话版本。取消或切号后，不再接受旧测量事件。
5. 扫描和连接返回后都再次检查会话。迟到的物理连接会在新会话初始化前断开。
6. 完成事件只处理一次；公开 SDK 的完成 payload 会移除传输字段，因此应用按完成事件确认结果，并验证有效体重。
7. 上传成功与历史刷新成功分别处理。历史刷新失败不会把已保存报告变成上传失败，也不会重新上传。
8. 失败上传的重试沿用原 payload 和 DATETIMES；没有确认服务端幂等契约，不承诺网络超时场景下的 exactly-once。
9. 未保存结果目前只保留在本次内存会话。关闭会有确认；杀进程后无法恢复待上传结果。

## BLE 边界

蓝牙传输已统一到 `hardware-sdk`：全项目只有 `WxBluetoothAdapter` 直接调用微信原生蓝牙 API，
也只有它注册原生监听。设备设置、Wi-Fi 配网、昵称、用户列表与 OTA 由
`src/application/services/H30SetupSession.ts` 承担（沿用原有 `processCase` 状态机，已不含任何 `wx` 调用）：

- 无线电访问经 `H30Transport` 订阅 SDK 的共享适配器；
- 对话框、跳转、提示音、本地存储、直接上传和固件文件选择经 `ISetupPlatform` 端口（`WxSetupPlatform` 实现）；
- OTA 使用 SDK 的 `H30OtaService`；
- `AppContainer.setupSession` 持有实例，`app.ts` 以 `globalData.BluetoothH30` 暴露，页面代码未改。

启动统一测量前，容器调用 `setupSession.pauseForMeasurement()`：取消订阅、停止扫描、断开旧连接，并让此前发起的
异步连接作废（`epoch`）。它不会全局移除微信 BLE 监听。

SDK 每次初始化使用新的广播器和解析器，隔离旧异步任务和解析缓存。
Runner 销毁后拒绝继续发送命令；取消或断连不会继续重试初始握手。

## 仍然存在的迁移边界

- 设备设置、配网和部分历史/报告页面仍使用旧 globalData 与兼容 API。
- 旧页面已全部去掉 `@ts-nocheck`,但大量页面仍使用显式 `any`(回调参数、`Record<string, any>`)和 `globalData`,平台声明也仍含 `any`;strict 通过不等于全项目完全类型安全。
- 大报告组件和 Canvas 实现仍需按独立职责逐步拆分，不能仅凭行数拆文件。
- 旧测量组件与旧型号协议已移除：`InBodyTestComponent`、`InBodyTest120Component`、
  `InBodyTestH30Component`（仅被已注释的 WXML 引用）以及 `InBody120Protocol`、`InBodyH20Protocol`。
  原文件备份在仓库外层的 `.backup/2026-10-27-legacy-ble/`。
- 设备设置状态机的设备时序行为沿用原实现，只替换了传输层与平台副作用；`InBodyH30Protocol` 仅剩命令/响应编解码（复用 `hardware-sdk` 的 `H30ProtocolParser`）和固件版本检查。
  这部分需要 H30/H40 真机逐页验证。

## 真机验收

- 原版用户升级后的冷启动、退出、切换账号、重新登录。
- H20 / 120 / H30 / H40 各完成一次测量并核对服务端记录与用户归属。
- 扫描中、连接中、测量中取消；蓝牙关闭、设备断连及重连。
- 上传断网、手动重试、上传成功但历史刷新失败。
- 旧设备设置或配网后返回首页测量，再返回设置，确认无重复指令与重复上传。
- 分享入口直接打开首页、页面卸载及后台切换。

## 原项目接口接入

实际地址与路径统一维护在 `miniprogram/src/infrastructure/api/InBodyApi.ts`。
默认服务器为 `https://wechat.lookinbody.cn`，请求时读取 `globalData.serverUrl`，兼容现有环境配置。

- 登录、微信 session/手机号、验证码及会员资料沿用原项目 `/main`、`/main_v3` 接口。
- 首页摘要使用 `/main/GetDashboard_WeChat`，包含血压与脉搏显示字段。
- 首页、报告详情及趋势页经 `ReportAppService` 读取 `/inbody/GetInBodyDataWeChat`，沿用完整历史请求参数。
- 报告说明、体型分析、删除、血压历史、报告纸 URL 和扫码保存由应用服务承接。
- 原有历史缓存兼容模块统一通过 `WxHttpClient` 发起请求。
- 扁平历史字段保持原值；嵌套指标 VALUE/MIN/MAX/PERCENT 转成原页面使用的扁平字段，VFL 映射到领域 VFALevel。

`ApiContracts.test.ts` 使用接口替身验证 HTTP 适配器、应用服务、Store、卡片及详情数据映射链路。
没有使用真实用户账号调用个人数据接口；实际账号记录由用户在微信开发者工具/真机验收。

## 页面层重构（当前范围）

首页容器、首页 Dashboard、报告详情、历史趋势主组件、短信登录页及报告日期选择页已重写为类型明确的原生页面适配层。
这些页面保留现有 WXML/WXSS；不再包含 `@ts-nocheck`、动态 require 或直接 HTTP 请求。

- `src/presentation/dashboard`：独立实例的 DashboardPresenter 管理请求、订阅与选择；DashboardView 负责纯展示映射。
- `src/presentation/report`：ReportPresenter 管理报告读取与日期选择；ReportView 管理报告快照、差值、节段顺序及空值隐藏。
- `src/presentation/history`：HistoryView 负责日期/设备过滤、近期七点、指标顺序及图表数据；显式的空选择不会恢复全部数据。
- `src/presentation/login`：SmsLoginPresenter 管理验证码请求与倒计时，销毁后不继续更新页面，验证码只保存在实例内存。
- `src/infrastructure/renderers/DashboardChart.ts` 和 `ReportDetailChart.ts` 只处理 Canvas，不发 HTTP 请求。
- `WxDashboardPreferences`、`WxHistoryPreferences` 是已有设置页 storage key 的明确兼容边界。
- 页面实例订阅在 detached 中释放，Presenter 的异步回写检查销毁状态和请求/会话版本。

这是核心数据页面的重构，尚未宣称所有旧页面都已迁移。旧设备设置/配网、部分筛选设置页、历史图表交互子组件等仍有兼容代码。
`PageBoundaries.test.ts` 会检查本轮页面的活动 WXML 事件全部有实现，并检查不能重新引入 unchecked 页面或直接请求。

本轮还重构了“我”、测量资料补全和报告数据管理页：账号状态订阅、资料校验/请求模型和列表映射均不再依赖旧页面的大段业务代码。
本轮页面和图表不再将完整分享载荷、历史副本发送到 setData；只发送当前模板需要的展示字段。
退出/切换账号时清理旧历史筛选键，防止上一账号的日期选择让新账号记录被过滤为空。
