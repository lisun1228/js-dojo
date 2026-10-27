# 小程序 · 02 工程结构与 WXSS 样式体系

> 覆盖：小程序工程结构（全局文件、页面四件套、分包）、WXSS 与 CSS 的差异（rpx、@import、选择器、样式隔离）

---

## 目录

- [一、30 秒结论](#一30-秒结论)
- [二、目录结构：一个真实项目的全貌](#二目录结构一个真实项目的全貌)
- [三、WXSS 与 CSS 的差异（完整版）](#三wxss-与-css-的差异完整版)
- [四、面试话术（口语版）](#四面试话术口语版)
- [五、追问预判](#五追问预判)
- [六、易错点 & 加分点](#六易错点--加分点)
- [七、速记卡](#七速记卡)

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
├── app.wxss                # 全局样式，默认对所有页面生效
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

### 三个全局文件的分工

| 文件 | 作用 | 典型内容 |
| --- | --- | --- |
| `app.js` | 注册整个应用，全局生命周期 | `App({ onLaunch, onShow, onHide, globalData })`、登录态初始化、全局 error 监听 |
| `app.json` | 全局配置，**决定页面路由和窗口表现** | `pages`、`window`、`tabBar`、`subPackages`、`usingComponents`、`lazyCodeLoading` |
| `app.wxss` | 全局样式 | 主题变量、重置样式、公共类 |

**注意三个易踩的坑：**

1. **`pages` 数组的第一项就是启动页**，顺序有意义。
2. **`app.json` 里没登记的页面不能跳转**，新建页面后忘了加 `pages` 会直接报错。
3. **`app.wxss` 全局生效**，实际项目一般只放 CSS 变量、`reset`、通用布局类。

### 页面四件套职责

| 文件 | 类比 | 职责 | 注意 |
| --- | --- | --- | --- |
| `.wxml` | HTML | 结构 + 数据绑定 + 事件绑定 + 列表/条件渲染 | 标签必须是内置组件或已注册组件，不能写 `div` |
| `.wxss` | CSS | 页面样式 | 支持 rpx、`@import`，选择器受限 |
| `.js` | JS | `Page({ data, onLoad, ... })` | 逻辑层，无 DOM |
| `.json` | 页面配置 | 覆盖 `window` 配置、声明 `usingComponents` | 只能写配置，不能写逻辑 |

页面 `.json` 的常见配置：

```json
{
  "navigationBarTitleText": "订单详情",
  "navigationStyle": "custom",
  "usingComponents": { "van-button": "@vant/weapp/button/index" },
  "enablePullDownRefresh": true,
  "onReachBottomDistance": 50
}
```

### 分包

**为什么要分包：** 主包与单个分包各不超过 2MB，整包不超过 20MB；非首屏代码放进分包可减少启动下载量。

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

要点：

> 分包的核心是**把非首屏代码挪出主包**，缩短下载和注入时间；再配 `preloadRule` 在进入指定页面时预下载，减少进入分包页面的等待。分包之间的 JS 默认不能互相引用，公共代码要提到主包或者用**分包异步化**（`require.async` / 占位组件）解决。

---

## 三、WXSS 与 CSS 的差异（完整版）

先给结论：**WXSS ≈ CSS + rpx + @import − 部分选择器 − 部分全局能力**。

| 维度 | CSS | WXSS | 说明 |
| --- | --- | --- | --- |
| 尺寸单位 | px / em / rem / vw | **新增 rpx** | 按屏宽等比换算，详见下文 |
| 引入方式 | `@import` / `<link>` | 只支持 **`@import`** | 相对路径，相当于把目标文件内容插入当前位置 |
| 选择器 | 全支持 | **受限**：只推荐 class、伪类、伪元素；属性选择器不支持，ID/标签选择器不推荐 | 通配符 `*` 不在支持列表 |
| 伪类/伪元素 | 全支持 | 支持无参伪类与 `::before` / `::after`，带参伪类/伪元素不支持 | 点击态用 `hover-class` |
| 作用域 | 全局 | **页面/组件级作用域 + 样式隔离** | 组件默认不被外部类名影响，`styleIsolation` 可调 |
| 本地图片 | 可随意引用 | **`background-image` 不能用本地图片** | 只能网络图或 base64；`<image>` 标签可以本地 |
| 预处理器 | 需构建 | 原生不支持，靠工具链（WePY/Taro/uni-app 或 sass 插件） | 项目里一般都会接 |
| 全局选择器 | `html` / `body` | 用 `page` 代替 `body` | `page { background: #fff }` |

### rpx 换算

- 规定**屏幕宽度恒等于 750rpx**，与机型无关。
- 所以 `1rpx = 屏幕宽度(px) / 750`。
- 375px 宽（iPhone 6/7/8）：`1rpx = 0.5px`，750 设计稿可 1:1 写 rpx。
- 430px 宽（iPhone 14 Pro Max）：`1rpx ≈ 0.573px`。
- 本质是运行时按屏宽换算，不需要 JS 动态设置根字号。

**使用建议：**
- 字号、间距、图标尺寸用 rpx；边框用 1px。
- 设计稿不是 750 宽（如 375）时，数值 ×2 再写 rpx。

### 样式隔离与 styleIsolation

```json
{
  "styleIsolation": "isolated"
}
```

- `isolated`：普通自定义组件的默认值，组件内外的 class 样式互不影响；`apply-shared` 让页面样式进入组件；`shared` 双向影响。
- `styleIsolation` 写在组件 JSON 中（基础库 2.10.1+），JS `options` 中配置已不推荐；页面根组件默认 `shared`。
- 外部改组件样式：`externalClasses`、`apply-shared` 或 CSS 变量。
- 页面之间天然隔离，但 `app.wxss` 默认对所有页面生效。

---

## 四、面试话术（口语版）

- **文件题**：应用级 `app.js` / `app.json` / `app.wxss` → 页面四件套 → `project.config.json` / `sitemap.json` → 分包。
- **样式题**：单位 → 引入方式 → 选择器 → 作用域。
- **展开原则**：先给职责与差异结论，配置字段和边界留给追问。

---

## 五、追问预判

**Q：rpx 和 vw 有什么区别？**
A：两者都按屏宽比例换算；`rpx` 仅 WXSS 可用，`vw` 是标准单位，跨端通用。

**Q：1px 边框为什么不用 rpx？**
A：750 设计稿下 `2rpx` 在 375px 宽屏幕上等于 1px，但屏宽变化后不再等于整数；边框通常直接写 `1px`，避免 rpx 换算出小数导致不同机型表现不一致。

**Q：`app.wxss` 和页面 wxss 谁优先级高？**
A：同权重下页面样式通常覆盖 `app.wxss`；权重规则与 CSS 相同，`!important` 或更高权重选择器会改变结果。

**Q：自定义组件和页面的 js 有什么不同？**
A：页面用 `Page()`，生命周期 `onLoad/onShow/onReady/onHide/onUnload`；组件用 `Component()`，有 `properties`、`data`、`methods`、`lifetimes`、`observers`、`behaviors`，以及插槽、`triggerEvent`、`relations`。

**Q：分包之后公共代码怎么处理？**
A：公共代码优先放主包；只有某个分包使用的库放该分包；跨分包复用用分包异步化（`require.async` + 占位组件）。

**Q：`sitemap.json` 有用吗？**
A：控制页面是否允许被微信搜索收录；默认通常全部允许，隐私页或临时页设为 `disallow`。

---

## 六、易错点 & 加分点

**易错：**
- 漏掉页面 `.json`：四件套不全，页面级 `window` 配置和 `usingComponents` 无法按页面覆盖。
- 把 `rpx` 当 `rem`：`rpx` 由运行时按屏宽换算，不需要 JS 设置根字号。
- WXSS 写属性选择器或带参伪类：规则不生效。

**可补充：**
- `lazyCodeLoading: "requiredComponents"` 按需注入，减少启动时执行的代码量。
- CSS 变量做主题，不需要放开样式隔离。

---

## 七、速记卡

```
全局三件套：app.js（入口/生命周期） app.json（路由/窗口/分包） app.wxss（全局样式）
页面四件套：wxml 结构 / wxss 样式 / js 逻辑 / json 配置   —— 同名同目录
WXSS 差异：+rpx  +@import  −属性选择器/带参伪类  +样式隔离（page 代替 body）
rpx：750rpx = 屏宽，1rpx = 屏宽/750；边框用 1px 不用 rpx
分包：主包/单分包 ≤2MB，整包 ≤20MB，preloadRule 预下载，异步化解耦
```
