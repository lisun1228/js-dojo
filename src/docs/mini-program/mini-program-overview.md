# 小程序面试题 · 总览与索引

> 覆盖 9 道题，按考点归并为 4 个专题 + 本索引。
> 每篇结构：30 秒结论 → 机制展开 → 追问预判 → 易错与加分点。

---

## 一、合并说明：9 题 → 4 篇

| 原题 | 原题标题 | 归入 | 合并理由 |
| --- | --- | --- | --- |
| 1 | 说说微信小程序的架构 | [01-架构与双线程模型](/doc/mini-program-architecture) | 与 2/3/4 **同一内核**（双线程 + 通信桥），只是问法不同 |
| 2 | 为什么拿不到 DOM 相关 API | [01-架构与双线程模型](/doc/mini-program-architecture) | 是架构设计的**推论**，需放在架构答案里讲 |
| 3 | 双线程分别做什么 | [01-架构与双线程模型](/doc/mini-program-architecture) | 架构题的**细节层**，与分工表一起讲 |
| 4 | 简述小程序原理 | [01-架构与双线程模型](/doc/mini-program-architecture) | 原理 = 编译 + 双线程运行，仍属同一套 |
| 5 | 小程序的优劣势 | [04-优劣势与选型对比](/doc/mini-program-pros-cons) | 独立成篇，并补横向对比与选型判断 |
| 6 | 页面间传数据的方法 | [03-事件系统与页面通信](/doc/mini-program-events-communication) | 与 7 同属"页面交互链路" |
| 7 | bindtap 和 catchtap 区别 | [03-事件系统与页面通信](/doc/mini-program-events-communication) | 事件机制，与 6 连问频率极高 |
| 8 | WXSS 与 CSS 的区别 | [02-工程结构与WXSS样式](/doc/mini-program-structure-wxss) | 与 9 同属"工程与样式体系" |
| 9 | 主要文件有哪些 | [02-工程结构与WXSS样式](/doc/mini-program-structure-wxss) | 项目结构的宏观视角 |

**合并依据：** 原 1/2/3/4 的答案内核都是「双线程 + 通信桥」，只是入口不同（架构 / 分工 / 原理 / DOM 限制），合成一条**设计目标 → 分工 → 通信链路 → 开发约束**的链路即可覆盖四问。

---

## 二、知识地图

```
                        ┌─────────────────────────────┐
                        │  01 架构与双线程（基础）      │
                        │  逻辑层 JSCore/V8 ─ Native 桥 ─ 渲染层 WebView │
                        └──────────┬──────────────────┘
                                   │ 决定了
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
   ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
   │ 02 工程与样式     │  │ 03 事件与通信     │  │ 04 优劣势与选型   │
   │ 四件套/分包/rpx   │  │ bind·catch/传参   │  │ 业务视角/横向对比 │
   └──────────────────┘  └──────────────────┘  └──────────────────┘
        为什么会这样？        为什么这么设计？        所以该不该用？
        —— 因为沙箱 + 包体积  —— 因为跨线程序列化  —— 因为受限换触达
```

三条线都由架构推导：
- **包体积/分包** ← 逻辑层启动时要注入代码包，包越大启动越慢
- **不能操作 DOM / 只能 setData** ← 双线程隔离
- **传参要序列化** ← 跨线程只能传可 JSON 化的数据

---

## 三、通用答题框架（四步法）

答题按四步展开：

| 步骤 | 说什么 |
| --- | --- |
| **1. 给结论** | 一句话定性，先让面试官知道你要往哪讲 |
| **2. 讲机制** | 分层/分步展开，用"第一、第二"或"编译期/运行期" |
| **3. 说取舍** | 为什么这么设计？代价是什么？ |
| **4. 落实践** | 具体手段或数字 |

例：

> - **结论**：小程序是双线程模型
> - **机制**：逻辑层 JSCore/V8 管算，渲染层 WebView 管画，中间靠 Native 桥传消息
> - **取舍**：换来安全隔离与跨端一致，代价是通信开销
> - **实践**：setData 只传变化路径，长列表用 recycle-view

---

## 四、建议复习顺序

1. **01 架构**：其他三篇的推导起点。要点：双线程分工、setData 四阶段、无 DOM 的三层理由。
2. **03 事件与通信**：bind/catch 区别、五种传参对比、EventChannel。
3. **02 工程与 WXSS**：四件套、rpx 换算、WXSS 与 CSS 的差异。
4. **04 优劣势与选型**：开放题，按结论 + 取舍 + 场景组织。

时间紧时优先 01、03：架构是其他题的推导基础，事件与传参是追问最集中的两块。

---

## 五、全局速记卡（考前扫一眼）

```
【架构】逻辑层 JSCore/V8（单例·管算）+ 渲染层 WebView（每页一个·管画）；双线程指两个独立运行环境，Native 桥转发，只传可序列化数据
【setData】序列化 → 跨线程 → 渲染层 diff → 更新 DOM；成本 ∝ 数据量 → 少传/传路径/少频次/纯数据字段
【无 DOM】逻辑层无宿主 + 故意沙箱 + 跨端统一 → 只能数据驱动；查节点用 wx.createSelectorQuery
【原理】WXML→虚拟节点函数，WXSS→CSS，JS→逻辑层，运行时映射成真实 DOM（view→div）
【工程】app.js/json/wxss + 页面四件套（wxml/wxss/js/json）+ 分包（主包/单分包 ≤2MB，整包 ≤20MB）
【样式】+rpx（750=屏宽）+@import −*选择器 −本地背景图 +样式隔离（page 代替 body）
【事件】bind 冒泡 / catch 停冒泡 / capture-catch 全断；取参用 currentTarget.dataset
【传参】URL（要 encode）· globalData · Storage（总 10MB）· EventChannel（双向）· 状态管理；switchTab 不带参
【优劣势】免安装+社交裂变+支付闭环 ↔ 主包 2MB/强管控/性能天花板/离不开微信
【加分词】Skyline、lazyCodeLoading、preloadRule、分包异步化、WXS 响应事件、虚拟列表
```

---

## 六、可能被扩问到、但原题没覆盖的点（自查清单）

原题未覆盖、容易被顺带追问的话题：

| 话题 | 一句话准备 |
| --- | --- |
| 生命周期 | 应用 `onLaunch/onShow/onHide`；页面 `onLoad → onShow → onReady → onHide → onUnload`；组件 `created/attached/detached` |
| 登录流程 | `wx.login` 拿 code → 后端换 `openid/session_key` → 自定义登录态 token → 存储并带上请求头 |
| 请求封装 | `wx.request` Promise 化 + 拦截器 + 统一错误码 + token 刷新 |
| 页面栈 | 最多 10 层；`navigateTo` 入栈、`redirectTo` 替换、`reLaunch` 清栈、`switchTab` 跳 tabBar |
| 组件通信 | `properties` 下行、`triggerEvent` 上行、`selectComponent` 拿实例、`behaviors` 复用逻辑 |
| 长列表 | `recycle-view` / 虚拟列表 / `IntersectionObserver` 做曝光 |
| 更新机制 | 代码包更新（`wx.getUpdateManager`）+ 分包按需下载，新包默认下次冷启动生效 |
| 多端方案 | Taro / uni-app：编译时转 WXML，运行时适配层，条件编译处理差异 |
