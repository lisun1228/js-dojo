# 小程序 · 03 事件系统与页面间通信

> 覆盖原题：6. 页面间传递数据的方法 / 7. `bindtap` 与 `catchtap` 的区别
> 主线：事件在节点树上的传播规则，以及数据在页面之间的流动方式

---

## 目录

- [一、30 秒结论](#一30-秒结论)
- [二、事件系统](#二事件系统)
- [三、页面间传参的五（六）种方式](#三页面间传参的五六种方式)
- [四、面试话术（口语版）](#四面试话术口语版)
- [五、追问预判](#五追问预判)
- [六、易错点 & 加分点](#六易错点--加分点)
- [七、速记卡](#七速记卡)

---

## 一、30 秒结论

> 事件：`bind` 冒泡绑定，`catch` 阻止冒泡并在当前节点处理，`capture-bind` / `capture-catch` 走捕获阶段。
> 事件对象：`target` 是实际触发节点，`currentTarget` 是绑定节点；取绑定节点的数据用 `currentTarget.dataset`。
> 传参：跳转带少量标识用 URL 参数，跨页共享用 `globalData` / Storage，需要回传结果用 EventChannel（仅 `navigateTo`），复杂共享状态用状态管理。

---

## 二、事件系统

### bind / catch / capture 三组四类

| 写法 | 阶段 | 是否冒泡 | 场景 |
| --- | --- | --- | --- |
| `bindtap` | 冒泡阶段 | 继续向上冒泡 | 默认绑定 |
| `catchtap` | 冒泡阶段 | **阻止冒泡**，事件到此为止 | 列表项里的删除按钮、弹窗内容区阻止关闭 |
| `capture-bind:tap` | 捕获阶段 | 继续传递 | 需要在子元素之前拦截 |
| `capture-catch:tap` | 捕获阶段 | **中断捕获并取消冒泡** | 需要完全阻断时 |

```html
<view bindtap="onOuter">
  外层
  <view catchtap="onInner">点我只触发我，不触发外层</view>
</view>
```

`catch` 相当于在冒泡阶段 `stopPropagation()`；`capture-catch` 相当于在捕获阶段 `stopPropagation()`，并同时取消冒泡。

### 事件对象里该看什么

```js
onItemTap(e) {
  e.target.dataset.id          // 实际触发节点（可能是内部子节点）
  e.currentTarget.dataset.id   // 绑定事件的节点
  e.mark                       // 触发节点到根节点路径上合并的 mark 数据（2.7.1+）
  e.detail                     // triggerEvent 的 detail / 表单值
  e.touches / e.changedTouches // 触摸点
}
```

列表项自身绑定事件时用 `e.currentTarget.dataset`；`e.target` 可能指向内部子节点，直接取 `dataset` 容易为空。事件委托绑在父容器上时，`e.currentTarget` 是父容器；`e.target.dataset` 只包含实际触发节点自身的 `data-*`，需要跨层级标识列表项时用 `mark:`，触发节点到根节点路径上的 `mark` 会合并到 `e.mark`。

### 事件传参：只能走 dataset

```html
<view data-id="{{item.id}}" data-item="{{item}}" bindtap="onTap">
```
```js
onTap(e) { const { id, item } = e.currentTarget.dataset }
```

`bindtap="onTap(1)"` 无效：事件绑定只接受方法名，不能写调用表达式。需要传参时通过 `data-*` 写入 `dataset`。

### 其他必备小知识

- **点击态**：用 `hover-class="btn-hover"`，`hover-start-time` / `hover-stay-time` 控制时长。
- **常用事件**：`tap`、`longpress`、`touchstart/move/end`、`input`、`change`、`confirm`、`scrolltolower`、`submit`。
- **合成事件**：`tap` 在手指触摸后立即离开时触发；触摸超过 350ms 再离开触发 `longpress`，若绑定了 `longpress` 回调则 `tap` 不再触发。
- **事件委托**：把 `bindtap` 绑在父容器上，长列表可减少监听节点数量。

---

## 三、页面间传参的五（六）种方式

### 总览对比表

| 方式 | 适合场景 | 数据方向 | 能否传对象 | 生命周期 | 坑 |
| --- | --- | --- | --- | --- | --- |
| **URL 参数** | 跳转时带少量标识（id、type） | 单向过去 | 不能，需 `JSON.stringify` + `encodeURIComponent` | 页面加载时一次 | URL 长度有限、特殊字符必须编码 |
| **globalData** | 全局共享状态（登录态、用户信息） | 任意方向 | 能（内存引用） | 整个应用运行期间 | 小程序进程销毁后丢失；命名易冲突 |
| **Storage** | 需要持久化（token、草稿、筛选条件） | 任意方向 | 能（序列化存储） | 持久，除非清除 | 同步 API 阻塞、单 key 1MB / 总 10MB 限制 |
| **EventChannel** | 需要**回传结果**（选地址、选商品返回） | **双向** | 能（直接传对象） | 页面销毁即失效 | 只能 `navigateTo` 用，`switchTab`/`redirectTo` 不行 |
| **getCurrentPages()** | 拿到上一页实例直接 `setData` | 反向回传 | 能（直接引用实例） | 页面栈存在期间 | **不要修改页面栈**，栈变化会取错页 |
| **状态管理（MobX / 自建 store）** | 多页面共享的复杂状态 | 任意方向 | 能 | 应用级 | 引入成本高，小项目过度设计 |

### 1）URL 参数

```js
wx.navigateTo({
  url: `/pages/detail/detail?id=${id}&info=${encodeURIComponent(JSON.stringify(obj))}`
})

// 接收
onLoad(options) {
  const id = options.id
  const info = JSON.parse(decodeURIComponent(options.info))
}
```

对象先 `JSON.stringify` 再 `encodeURIComponent`；不编码时 `&`、`?`、中文会被截断。大数据不要走 URL。

### 2）globalData

```js
// app.js
App({ globalData: { userInfo: null, token: '' } })

// A 页写
getApp().globalData.userInfo = res.data

// B 页读
const { userInfo } = getApp().globalData
```

globalData 只在内存中，进程销毁后丢失；多页读写要注意时序，B 页 `onLoad` 时 A 页可能还没写入。

### 3）Storage

```js
wx.setStorageSync('token', token)      // 同步，简单但阻塞
await wx.setStorage({ key: 'draft', data })  // 异步
```

`Sync` 版本会阻塞逻辑层线程，启动路径上避免大量调用；单 key 上限 1MB，总上限 10MB。

### 4）EventChannel

```js
// A 页：打开选择页，监听它 emit 的结果
wx.navigateTo({
  url: '/pages/select/select',
  events: {
    onSelected(data) {           // 监听 B 页 emit 的事件
      this.setData({ address: data })
    }
  },
  success(res) {
    res.eventChannel.emit('initData', { from: 'A', type: 'address' }) // 给 B 传初始数据
  }
})

// B 页：接收初始数据，选完后回传
onLoad() {
  const ec = this.getOpenerEventChannel()
  ec.on('initData', (data) => { /* 初始化 */ })
  ec.emit('onSelected', pickedAddress)   // 回传给 A
}
```

EventChannel 是 `navigateTo` 场景的页面间双向通道：`events` 监听被打开页面发回的数据，被打开页面用 `getOpenerEventChannel()` 取通道；页面销毁后失效。大对象或需要回传结果优先用它，需要持久化则写 Storage 并只传 key。

### 5）getCurrentPages()

```js
// B 页回传 A 页
const pages = getCurrentPages()
const prevPage = pages[pages.length - 2]
prevPage.setData({ address: picked })
wx.navigateBack()
```

能拿到页面实例并直接 `setData`，但页面栈变化（被 `redirectTo` 替换、层级变化）会取错页，且直接改其他页面 `data` 破坏单向数据流；页面栈只应读取，优先 EventChannel。

### 6）tabBar 页面的特殊性

`wx.switchTab` 不支持 URL 参数，也不支持 `events`；往 tabBar 页传值的常规做法是 `globalData` 或 Storage，并在 `onShow` 里读取。

---

## 四、面试话术（口语版）

- `bindtap` 在冒泡阶段执行，父级的 `bindtap` 也会执行；`catchtap` 阻止冒泡，但当前节点的处理函数照常执行。列表项的删除按钮用 `catchtap`，避免触发整行跳转。
- 捕获阶段用 `capture-bind` / `capture-catch`；后者同时中断捕获和冒泡。
- 事件对象取数据用 `e.currentTarget.dataset`；`e.target` 是实际触发节点，可能落在子节点上。父容器做事件委托时 `e.target.dataset` 只含触发节点自身的数据，跨层标识用 `e.mark`。
- 页面传参按场景选：少量标识走 URL（对象先 `JSON.stringify` 再 `encodeURIComponent`）；共享状态走 `globalData`（内存）或 Storage（持久）；需要回传结果走 EventChannel；`getCurrentPages()` 能改上一页，但页面栈变化会取错页，不推荐。
- `switchTab` 不支持 URL 参数和 `events`，tabBar 页通常通过 `globalData` / Storage 传值。

---

## 五、追问预判

**Q：事件为什么会冒泡？底层怎么实现的？**
A：事件在渲染层触发，沿 WXML 节点树完成捕获/冒泡，框架再把命中的回调转发到逻辑层执行；`catch` 在转发前截断节点链。

**Q：`catch` 会不会影响同一个节点上的其他事件？**
A：只拦冒泡链路，不影响自身绑定的其他事件类型和捕获阶段的事件。

**Q：自定义组件怎么把事件抛给父级？**
A：`this.triggerEvent('myevent', detail, options)`，父级用 `bind:myevent` 监听，`detail` 对应 `e.detail`。`options` 的 `bubbles`、`composed`、`capturePhase` 默认都是 `false`；需要冒泡传 `{ bubbles: true }`，要穿越组件边界再加 `composed: true`。

**Q：多个页面同时需要同一份数据，怎么做同步？**
A：抽一个 store（MobX / 自研发布订阅），页面 `onLoad` 订阅、`onUnload` 取消订阅。`behaviors` 只复用逻辑，不是状态容器。

**Q：`onLoad` 和 `onShow` 里读数据有什么区别？**
A：`onLoad` 只执行一次，适合用 URL 参数初始化；`onShow` 每次回到前台都触发，适合读可能被其他地方改过的全局数据或做刷新。

**Q：高频手势怎么优化？**
A：事件回调要跨线程到逻辑层，拖拽、滚动这类高频手势用 WXS 在渲染层处理，避免每次交互都回逻辑层。

---

## 六、易错点 & 加分点

**易错：**
- `bindtap="fn(1)"` 无效，只能通过 `data-*` 传参。
- 列表项自身绑定时用 `e.target.dataset` 取 id，拿不到值。
- 把 `catchtap` 当成能拦捕获阶段；捕获阶段要用 `capture-catch`。
- 认为 `switchTab` 能带 URL 参数，或 `globalData` 能持久化。

**加分：**
- `getCurrentPages()` 改上一页的缺陷与 EventChannel 替代方案。
- tabBar 页传参限制。
- 长列表事件委托 + `catch` 控制监听数量与冒泡。
- 高频手势用 WXS 在渲染层响应。

---

## 七、速记卡

```
bind = 冒泡；catch = 停冒泡；capture-bind / capture-catch = 捕获阶段（后者全断）
取参：currentTarget.dataset（自身绑定）；委托看 target.dataset；跨层标识用 mark；不能写 fn(1)
传参：URL（少量，要 encode）＜ globalData（共享，易丢）＜ Storage（持久，10MB）
      ＜ EventChannel（双向，navigateTo 专用）＜ 状态管理（复杂）
switchTab 不能带参 → globalData / Storage / store
getCurrentPages 能改但别改（栈变就错页）
```
