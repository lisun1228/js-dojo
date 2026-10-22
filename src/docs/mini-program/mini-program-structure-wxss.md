# 小程序 · 02 工程结构与 WXSS 样式体系

> **本篇合并原题：** 8. 小程序 WXSS 与 CSS 的区别？ / 9. 简述一下微信小程序的主要文件有哪些？
>
> **为什么合并：** 这两问都在问「小程序的工程长什么样」——一个是**目录与文件职责**，一个是**样式层的语法差异**。面试官通常连着问："项目结构说一下吧""那样式呢？跟 CSS 有什么区别？"，合并成一篇才是完整的答题链路。
>
> **出现频率：** 高。属于基础题，答得细能体现你真的写过项目而不是背题。

---

## 一、30 秒结论

> 小程序是**约定大于配置**的工程结构。根目录三个 `app.*` 负责全局（入口逻辑、全局配置、全局样式），`pages` 下每个页面是**四件套**：`.wxml` 结构、`.wxss` 样式、`.js` 逻辑、`.json` 局部配置，文件名必须同名且在同一目录。体量上去之后用 `subPackages` 拆分包。
>
> 样式层叫 WXSS，语法基本等于 CSS，核心差异是**新增 rpx 响应式单位**、**@import 引入**，以及**选择器受限 + 样式作用域和隔离机制**。

---

## 二、目录结构：一个真实项目的全貌

```
├── app.js                  # 小程序入口：注册应用、onLaunch/onShow/onHide、globalData
├── app.json                # 全局配置：pages 列表、window、tabBar、分包、组件、权限
├── app.wxss                # 全局样式，对所有页面生效
├── project.config.json     # 开发者工具项目配置（appid、编译设置、路径别名）
├── project.private.config.json  # 个人配置，一般不提交
├── sitemap.json            # 搜索索引配置：哪些页面允许被微信搜一搜收录
├── pages/
│   ├── index/
│   │   ├── index.wxml
│   │   ├── index.wxss
│   │   ├── index.js
│   │   └── index.json
│   └── detail/
│       └── ...（同样四件套）
├── components/             # 自定义组件（同样四件套，js 里是 Component 而非 Page）
│   └── card/
│       ├── card.wxml / card.wxss / card.js / card.json
├── subpackages/            # 分包目录，按业务域拆
│   └── user/
├── utils/                  # 工具函数
└── assets/                 # 图片等静态资源
```

### 三个全局文件的分工（高频追问点）

| 文件 | 作用 | 典型内容 |
| --- | --- | --- |
| `app.js` | 注册整个应用，全局生命周期 | `App({ onLaunch, onShow, onHide, globalData })`、登录态初始化、全局 error 监听 |
| `app.json` | 全局配置，**决定页面路由和窗口表现** | `pages`、`window`、`tabBar`、`subPackages`、`usingComponents`、`lazyCodeLoading` |
| `app.wxss` | 全局样式 | 主题变量、重置样式、公共类 |

**注意三个易踩的坑：**

1. **`pages` 数组的第一项就是启动页**，顺序有意义，不是随便排的。
2. **`app.json` 里没登记的页面不能跳转**，新建页面后忘了加 `pages` 是新手最常见的报错。
3. **`app.wxss` 是全局生效的**，写重了会污染所有页面；实际项目一般只放 CSS 变量、`reset`、通用布局类。

### 页面四件套职责

| 文件 | 类比 | 职责 | 注意 |
| --- | --- | --- | --- |
| `.wxml` | HTML | 结构 + 数据绑定 + 事件绑定 + 列表/条件渲染 | 标签必须是内置组件或已注册组件，不能写 `div` |
| `.wxss` | CSS | 页面样式 | 支持 rpx、`@import`，选择器受限 |
| `.js` | JS | `Page({ data, onLoad, ... })` | 逻辑层，无 DOM |
| `.json` | 页面配置 | 覆盖 `window` 配置、声明 `usingComponents` | 只能写配置，不能写逻辑 |

`app.json` 的页面级配置常见用法：

```json
{
  "navigationBarTitleText": "订单详情",
  "navigationStyle": "custom",
  "usingComponents": { "van-button": "@vant/weapp/button/index" },
  "enablePullDownRefresh": true,
  "onReachBottomDistance": 50
}
```

### 分包：一定会被追问的工程能力

**为什么要分包：** 主包/单分包上限 2MB，整包上限 20MB（以官方文档为准）。不拆分包，稍微大点的项目直接传不上去。

```json
{
  "pages": ["pages/index/index"],
  "subPackages": [
    {
      "root": "subpackages/user",
      "pages": ["profile/index", "setting/index"]
    }
  ],
  "preloadRule": {
    "pages/index/index": { "network": "all", "packages": ["subpackages/user"] }
  }
}
```

答题要点串成一句：

> 分包的核心是**把非首屏代码挪出主包**，缩短下载和注入时间；再配 `preloadRule` 在空闲时预下载，用户跳过去就没有等待感。分包之间的 JS 默认不能互相引用，公共代码要提到主包或者用**分包异步化**（`require.async` / 占位组件）解决。

---

## 三、WXSS 与 CSS 的差异（完整版）

先给结论：**WXSS ≈ CSS + rpx + @import − 部分选择器 − 部分全局能力**。

| 维度 | CSS | WXSS | 说明 |
| --- | --- | --- | --- |
| 尺寸单位 | px / em / rem / vw | **新增 rpx** | 750rpx = 屏幕宽度，自动适配 |
| 引入方式 | `@import` / `<link>` | 只支持 **`@import`** | 且是相对路径，编译时内联 |
| 选择器 | 全支持 | **受限**：不支持 `*`，属性选择器基本不可用，层级不宜过深 | 官方推荐用 class，少用标签/ID 选择器 |
| 伪类/伪元素 | 全支持 | `::after` / `::before` 支持；`:hover` 支持有限，无 `:active` 原生效果 | 点击态用 `hover-class` |
| 作用域 | 全局 | **页面/组件级作用域 + 样式隔离** | 组件默认不被外部类名影响，`styleIsolation` 可调 |
| 本地图片 | 可随意引用 | **`background-image` 不能用本地图片** | 只能网络图或 base64；`<image>` 标签可以本地 |
| 预处理器 | 需构建 | 原生不支持，靠工具链（WePY/Taro/uni-app 或 sass 插件） | 项目里一般都会接 |
| 全局选择器 | `*` / `html` / `body` | 用 `page` 代替 `body` | `page { background: #fff }` |

### rpx 到底怎么算（这题最容易被追问细节）

- 规定**屏幕宽度恒等于 750rpx**（不管什么机型）。
- 所以 `1rpx = 屏幕宽度 / 750` px。
- iPhone 6/7/8（375px 宽）：`1rpx = 0.5px`，设计稿 750 宽 → 直接按 1:1 写 rpx。
- iPhone 14 Pro Max（430px 宽）：`1rpx ≈ 0.573px`，等比放大。
- 一句话：**rpx 是"按 750 设计稿等比缩放"的单位**，本质是把 `rem` 方案里的 JS 计算内置到了渲染层。

**几个使用建议（面试说出来显得有经验）：**
- 字号、间距、图标尺寸用 rpx；**border 用 1px**（rpx 会出现 0.5px 导致部分安卓机不显示边框）。
- 根字号/整体布局也可以用 `vw`，`100vw = 750rpx`，两者等价。
- 设计稿不是 750 宽（比如 375）时，数值 ×2 再写 rpx。

### 样式隔离：组件化之后的重点

```js
Component({
  options: {
    styleIsolation: 'isolated'   // 默认：组件内外样式互不影响
    // 'apply-shared'：页面样式影响组件
    // 'shared'：双向影响
  }
})
```

- 页面之间天然隔离，页面 A 的 `.title` 不会污染页面 B（虽然 `app.wxss` 会）。
- **组件外部想改组件样式**，三条路：`externalClasses` 声明外部类、`styleIsolation: 'apply-shared'`、或 CSS 变量（推荐，最干净）。

---

## 四、面试话术（口语版）

**问「小程序主要有哪些文件」：**

> 分两层看。全局是三个：`app.js` 注册应用、管全局生命周期和 globalData；`app.json` 是全局配置，页面路由、窗口样式、tabBar、分包都在这里；`app.wxss` 是全局样式。另外还有 `project.config.json` 存项目配置，`sitemap.json` 控制搜一搜收录。
>
> 页面层是四件套：wxml 结构、wxss 样式、js 逻辑、json 页面配置，四个文件同名同目录，`app.json` 的 pages 里要登记才能访问，而且数组第一项就是启动页。
>
> 项目大了会拆分包，把非首屏的业务域放到 subPackages，因为主包和单个分包都有 2MB 限制。

**问「WXSS 和 CSS 有什么区别」：**

> 语法上基本一致，差异主要在四点。
>
> 第一是单位，WXSS 多了 rpx，规定屏幕宽度恒为 750rpx，所以按 750 的设计稿可以直接 1:1 写，等于把 rem 的动态计算内置了。
>
> 第二是引入方式只有 `@import`，没有 link。
>
> 第三是选择器受限，不支持 `*`，属性选择器也基本不可用，官方推荐 class 选择器；`body` 要用 `page` 代替。
>
> 第四是有样式作用域和隔离，组件默认 isolated，外面改不进去，得用 externalClasses、apply-shared 或者 CSS 变量。另外 `background-image` 不能引本地图片，只能用网络图或 base64。

---

## 五、追问预判

**Q：rpx 和 vw 有什么区别？**
A：数学上等价，`100vw = 750rpx`。区别是 rpx 是小程序特有的，只能在 WXSS 里用；vw 是标准单位，H5 和跨端框架都能用。做跨端项目我更倾向 vw。

**Q：1px 边框为什么不用 rpx？**
A：750 设计稿下 `2rpx = 1px`，但在 DPR 高的机型上 `1rpx` 会算出 0.5px，部分安卓 WebView 渲染 0.5px 边框会消失或者发虚，所以边框统一写 `1px`。

**Q：`app.wxss` 和页面 wxss 谁优先级高？**
A：同权重下，后加载的覆盖先加载的，页面样式在 `app.wxss` 之后注入，所以页面能覆盖全局。但权重计算规则和 CSS 一样，写了 `!important` 或更高权重选择器就不一定了。

**Q：自定义组件和页面的 js 有什么不同？**
A：页面用 `Page()`，有 `onLoad/onShow/onReady/onHide/onUnload` 这套页面生命周期；组件用 `Component()`，有 `properties / data / methods / lifetimes(created/attached/detached) / observers / behaviors`，还多出插槽、`triggerEvent`、`relations` 这些组件通信能力。

**Q：分包之后公共代码怎么处理？**
A：优先提到主包；如果某个库只有分包用，就放到该分包内，别放主包；跨分包复用可以用分包异步化，把公共库单独分成一个分包，通过 `require.async` 动态引用，配合占位组件处理加载态。

**Q：`sitemap.json` 有用吗？**
A：控制页面是否允许被微信搜索收录，做流量的话有意义，一般默认全允许，涉及隐私或临时页会 `disallow`。

---

## 六、易错点 & 加分点

**易错：**
- 说"页面有三个文件"——是四个，`.json` 常被漏掉。
- 说"rpx 就是 rem"——机制类似但 rpx 是编译/运行时由渲染层换算的，不需要 JS 动态设根字号。
- 说"WXSS 支持所有 CSS 选择器"——`*` 明确不支持。
- 说"组件样式可以直接被页面覆盖"——默认 isolated，覆盖不了。

**加分：**
- 主动提分包体积上限（主包/单分包 2MB、整包 20MB）和 `preloadRule` 预下载。
- 提 `lazyCodeLoading: "requiredComponents"` 按需注入，减少启动时执行的代码量。
- 提 CSS 变量做主题，比 `apply-shared` 更可控。

---

## 七、速记卡

```
全局三件套：app.js（入口/生命周期） app.json（路由/窗口/分包） app.wxss（全局样式）
页面四件套：wxml 结构 / wxss 样式 / js 逻辑 / json 配置   —— 同名同目录，pages 里要登记
WXSS 差异： +rpx  +@import  −*选择器  −本地背景图  +样式隔离  （page 代替 body）
rpx：750rpx = 屏宽，1rpx = 屏宽/750；边框用 1px 不用 rpx
分包：主包/单分包 ≤2MB，整包 ≤20MB，preloadRule 预下载，异步化解耦
```
