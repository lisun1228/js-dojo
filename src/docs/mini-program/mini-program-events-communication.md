# 小程序 · 03 事件系统与页面间通信

> **本篇合并原题：** 6. 小程序页面间有哪些传递数据的方法？ / 7. 微信小程序 bindtap 和 catchtap 的区别？
>
> **为什么合并：** 一个是**事件怎么触发**，一个是**数据怎么跨页面流动**——在同一条"页面交互链路"上。面试官常连着问："事件绑定的 bind 和 catch 什么区别？""那页面之间怎么传值？"合并讲，答题有连贯感。
>
> **出现频率：** 高。bind/catch 几乎是必问的送分题，传参题则是区分"背题"和"写过项目"的分水岭。

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

> 事件这一层：`bind` 是**冒泡绑定**，`catch` 是**阻止冒泡**（catch 到哪层，冒泡到哪层就停，同时自己还能处理），`capture-bind` / `capture-catch` 走**捕获阶段**。事件对象里 `target` 是触发源、`currentTarget` 是绑定者，`dataset` 拿自定义数据。
>
> 传参这一层：小场景用 **URL 参数**，跨页共享用 **globalData** 或 **Storage**，需要返回值用 **EventChannel**（navigateTo 专用的双向通道），复杂应用上 **状态管理**。选型看"数据要单向带过去、还是要双向回传、还是要长期共享"。

---

## 二、事件系统

### bind / catch / capture 三组四类

| 写法 | 阶段 | 是否冒泡 | 场景 |
| --- | --- | --- | --- |
| `bindtap` | 冒泡阶段 | 会继续向上冒泡 | 默认首选 |
| `catchtap` | 冒泡阶段 | **阻止冒泡**，事件到此为止 | 列表项里的删除按钮、弹窗内容区阻止关闭 |
| `capture-bind:tap` | 捕获阶段 | 继续传递 | 需要在子元素之前拦截 |
| `capture-catch:tap` | 捕获阶段 | **中断捕获**，连冒泡也不触发 | 极少用 |

```html
<view bindtap="onOuter">
  外层
  <view catchtap="onInner">点我只触发我，不触发外层</view>
</view>
```

一句话类比：`catch` ≈ `event.stopPropagation()`，`capture-catch` ≈ 在捕获阶段就 `stopPropagation()`。

### 事件对象里该看什么

```js
onItemTap(e) {
  e.target.dataset.id          // 触发事件的源头节点（可能是内部的子节点）
  e.currentTarget.dataset.id   // 真正绑定事件的那个节点 —— 业务里优先用它
  e.detail                     // 自定义组件 triggerEvent 传出来的数据 / 表单值
  e.currentTarget.offsetLeft   // 位置信息
  e.touches / e.changedTouches // 触摸点
}
```

**易错点：** 列表里用 `e.target` 取 `dataset` 经常拿到 `undefined`，因为点到了内部子节点；**永远用 `e.currentTarget.dataset`**。

### 事件传参的两种写法

```html
<!-- 写法一：dataset（推荐） -->
<view data-id="{{item.id}}" bindtap="onTap">
```
```js
onTap(e) { const id = e.currentTarget.dataset.id }
```

```html
<!-- 写法二：直接传参（注意：不能用括号调用，只能传字面量） -->
<view bindtap="onTap" data-args="{{item}}">
```
> 常见误区：`bindtap="onTap(1)"` 是**无效**的，小程序事件绑定只接受方法名，不能像 React 那样写调用表达式。要传参只能走 `dataset`。

### 其他必备小知识

- **点击态**：没有 CSS `:active`，用 `hover-class="btn-hover"`，`hover-start-time` / `hover-stay-time` 控制时长。
- **常用事件**：`tap`、`longpress`、`touchstart/move/end`、`input`、`change`、`confirm`、`scrolltolower`、`submit`。
- **合成事件**：`tap` 由 `touchstart + touchend` 合成，移动超过阈值就不算 tap。
- **事件委托**：小程序也支持，把 `bindtap` 绑在父容器上，靠 `e.target.dataset` 区分——长列表能显著减少节点上的监听数量。

---

## 三、页面间传参的五（六）种方式

### 总览对比表（这题的核心就是这张表）

| 方式 | 适合场景 | 数据方向 | 能否传对象 | 生命周期 | 坑 |
| --- | --- | --- | --- | --- | --- |
| **URL 参数** | 跳转时带少量标识（id、type） | 单向过去 | 不能，需 `JSON.stringify` + `encodeURIComponent` | 页面加载时一次 | 长度有限（约 1KB 级别）、特殊字符必须编码 |
| **globalData** | 全局共享状态（登录态、用户信息） | 任意方向 | 能（内存引用） | 整个应用生命周期 | 小程序被销毁后丢失；命名易冲突 |
| **Storage** | 需要持久化（token、草稿、筛选条件） | 任意方向 | 能（序列化存储） | 持久，除非清除 | 同步 API 阻塞、单 key 1MB / 总 10MB 限制 |
| **EventChannel** | 需要**回传结果**（选地址、选商品返回） | **双向** | 能（不经序列化限制，直接传对象） | 页面销毁即失效 | 只能 `navigateTo` 用，`switchTab`/`redirectTo` 不行 |
| **getCurrentPages()** | 拿到上一页实例直接 `setData` | 反向回传 | 能（直接引用实例） | 页面栈存在期间 | **官方不推荐**，页面栈一变就崩，容易被面试官追问 |
| **状态管理（MobX/Redux/behaviors）** | 多页面共享的复杂状态 | 任意方向 | 能 | 应用级 | 引入成本高，小项目过度设计 |

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

要点：**必须 encode**，否则 `&`、`?`、中文会截断；对象要序列化；不要塞大对象。

### 2）globalData

```js
// app.js
App({ globalData: { userInfo: null, token: '' } })

// A 页写
getApp().globalData.userInfo = res.data

// B 页读
const { userInfo } = getApp().globalData
```

要点：小程序**冷启动后内存会被回收**，globalData 不是持久层；多个页面同时读写要小心时序（B 页 `onLoad` 时 A 页可能还没写）。

### 3）Storage

```js
wx.setStorageSync('token', token)      // 同步，简单但阻塞
await wx.setStorage({ key: 'draft', data })  // 异步，推荐
```

要点：`Sync` 版本会阻塞逻辑层线程，别在启动路径上大量调用；单 key 上限 1MB，总上限 10MB。

### 4）EventChannel（最容易被追问的一种）

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
    res.eventChannel.emit('initData', { from: 'A', type: 'address' }) // 主动给 B 传初始数据
  }
})

// B 页：接收初始数据，选完后回传
onLoad() {
  const ec = this.getOpenerEventChannel()
  ec.on('initData', (data) => { /* 初始化 */ })
  ec.emit('onSelected', pickedAddress)   // 回传给 A
}
```

要点：这是**唯一官方的双向通道**，适合"选完返回"这种典型交互；页面销毁后通道失效；只能在 `navigateTo` 场景使用。

### 5）getCurrentPages()（能说，但要带警告）

```js
// B 页回传 A 页
const pages = getCurrentPages()
const prevPage = pages[pages.length - 2]
prevPage.setData({ address: picked })
wx.navigateBack()
```

**答题时必须补一句：**"这种方式能跑，但官方不推荐——页面栈结构变化（比如中间被 `redirectTo` 替换、或者页面层级深了）就会取错页面，而且直接改别的页面 `data` 破坏了单向数据流。生产上我优先用 EventChannel。"

> 敢主动说出「不推荐 + 为什么」，是这题拉开差距的地方。

### 6）tabBar 页面的特殊性（加分点）

`wx.switchTab` **不支持 URL 参数**，也不支持 `events`。所以往 tabBar 页传值只能走 `globalData` 或 `Storage`，或者用 `getApp().globalData` + `onShow` 里读。

很多人不知道这点，面试时提一句会显得你真的踩过坑。

---

## 四、面试话术（口语版）

**问「bindtap 和 catchtap 的区别」：**

> 都是点击事件绑定，差别在冒泡。`bindtap` 触发后事件会继续往上冒泡，父级的 `bindtap` 也会执行；`catchtap` 会阻止冒泡，事件在它这层就停了，但它自己的处理函数照常执行。像列表项里放个删除按钮，点删除不希望触发整行的跳转，就用 `catchtap`。
>
> 另外还有捕获阶段的写法 `capture-bind` 和 `capture-catch`，前者是捕获阶段监听，后者连捕获带冒泡一起中断，用得比较少。
>
> 事件对象里要注意用 `e.currentTarget.dataset` 而不是 `e.target.dataset`，因为 target 是实际点到的子节点，dataset 经常是空的。

**问「页面间有哪些传数据的方法」：**

> 主要五种，我按场景选。
>
> 少量标识参数，比如列表跳到详情带个 id，用 URL 参数最简单，注意对象要 `JSON.stringify` 再 `encodeURIComponent`，不编码遇到 `&` 或中文会被截断。
>
> 全局共享的登录态、用户信息放 `globalData` 或者 Storage，Storage 适合要持久化的，但 sync 接口会阻塞逻辑层，启动路径上尽量用异步的。
>
> 需要**回传结果**的场景，比如选地址、选优惠券，我用 `EventChannel`——`navigateTo` 的 `events` 里监听，子页面 `getOpenerEventChannel` 拿到通道后 `emit` 回来，这是官方唯一的双向通道，也不用序列化，能直接传对象。
>
> 还有一种常见但不推荐的做法是 `getCurrentPages()` 拿上一页实例直接 `setData`，页面栈一变就容易取错页，而且破坏单向数据流。
>
> 复杂应用上就上 MobX 或者自建的全局 store。
>
> 补充一点，`switchTab` 跳 tabBar 页是不支持 URL 参数的，那种情况只能走 globalData 或 Storage。

---

## 五、追问预判

**Q：事件为什么会冒泡？底层怎么实现的？**
A：渲染层里 `view` 其实是 `div`，基础库用事件委托在根节点统一监听，捕获到 DOM 事件后按 WXML 的节点树模拟一遍冒泡/捕获，再决定把哪些节点的回调序列化后转发给逻辑层。所以 wxml 里写 `catch` 能"拦住"冒泡，本质是基础库在转发前把节点链截断了。

**Q：`catch` 会不会影响同一个节点上的其他事件？**
A：只拦冒泡链路，不影响自身绑定的其他事件类型和捕获阶段的事件。

**Q：自定义组件怎么把事件抛给父级？**
A：`this.triggerEvent('myevent', detail, options)`，父级用 `bind:myevent` 监听，`detail` 就是 `e.detail`。如果不想冒泡，`options` 里传 `{ bubbles: false }`。

**Q：如何往上一页传一个很大的对象？**
A：URL 肯定不行。优先 EventChannel（对象直接传，不过序列化）；数据特别大或者要持久化就写 Storage 只传 key；不建议 `getCurrentPages` 直接改。

**Q：多个页面同时需要同一份数据，怎么做同步？**
A：抽一个 store（MobX / 自研发布订阅），页面 `onLoad` 订阅、`onUnload` 取消订阅；或者用 `behaviors` 抽公共逻辑。核心是别靠 globalData 到处改。

**Q：`onLoad` 和 `onShow` 里读数据有什么区别？**
A：`onLoad` 只执行一次，适合用 URL 参数初始化；`onShow` 每次回到前台都触发，适合读可能被其他地方改过的全局数据或者做数据刷新。

**Q：点击事件有延迟吗？**
A：没有 300ms 那种移动端点击延迟，但事件从渲染层到逻辑层要跨线程，回调执行有几十毫秒级开销。高频手势（拖拽、滚动）建议用 WXS 响应事件，在渲染层直接处理，不回逻辑层。

---

## 六、易错点 & 加分点

**易错：**
- `bindtap="fn(1)"` 传参无效——只能 `dataset`。
- 用 `e.target.dataset` 取列表 id，拿不到值。
- 以为 `catchtap` 连捕获阶段也拦——那是 `capture-catch`。
- 以为 `switchTab` 能带参数。
- 以为 globalData 能持久化——冷启动就没了。

**加分：**
- 主动说 `getCurrentPages` 的缺陷和替代方案。
- 提 tabBar 传参的限制。
- 提事件委托 + `catch` 组合处理长列表性能。
- 提 WXS 响应事件可以绕开跨线程，做高频交互。

---

## 七、速记卡

```
bind = 冒泡；catch = 停冒泡；capture-bind / capture-catch = 捕获阶段（后者全断）
取参：currentTarget.dataset（不是 target）；不能写 fn(1)
传参：URL（少量，要 encode）＜ globalData（共享，易丢）＜ Storage（持久，10MB）
      ＜ EventChannel（双向，navigateTo 专用）＜ 状态管理（复杂）
switchTab 不能带参 → globalData / Storage
getCurrentPages 能改但别改（栈变就错页）
```
