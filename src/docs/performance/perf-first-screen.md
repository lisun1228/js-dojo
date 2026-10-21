# 性能 · 03 首屏优化：从 SSR 到关键路径

> 覆盖题号：**5、10、19**（三题同源，合并讲透）
> 对应原题：《首屏优化的常用方案》《首屏优化》《SPA 项目首屏加载太慢怎么办》
> 这一册是性能题里**最常被问、也最容易答得空泛**的一题。核心是先把"慢在哪"拆开，再对号入座给手段。

---

## 目录

- [1. 先搞清"首屏"到底指什么](#1-先搞清首屏到底指什么)
- [2. SPA 首屏为什么慢（时序剖析）](#2-spa-首屏为什么慢时序剖析)
- [3. 四类手段总览（12 种，按思路分类）](#3-四类手段总览12-种按思路分类)
- [4. A 类：少给 —— 减少首屏必须下载和执行的东西](#4-a-类少给--减少首屏必须下载和执行的东西)
- [5. B 类：快给 —— 缩短传输时间](#5-b-类快给--缩短传输时间)
- [6. C 类：改变渲染方式 —— SSR / SSG / 流式 / 预渲染](#6-c-类改变渲染方式--ssr--ssg--流式--预渲染)
- [7. D 类：感知优化 —— 让用户"觉得"快](#7-d-类感知优化--让用户觉得快)
- [8. 骨架屏怎么做才不帮倒忙](#8-骨架屏怎么做才不帮倒忙)
- [9. 关键 CSS 内联与剩余 CSS 异步加载](#9-关键-css-内联与剩余-css-异步加载)
- [10. 路由懒加载与预加载策略](#10-路由懒加载与预加载策略)
- [11. 决策树：什么项目该上什么](#11-决策树什么项目该上什么)
- [12. 常见坑](#12-常见坑)
- [13. 答题模板](#13-答题模板)
- [14. 追问表](#14-追问表)
- [15. 速记卡](#15-速记卡)

---

## 1. 先搞清"首屏"到底指什么

面试官问"首屏优化"，很多人直接开始报手段。**更好的开场是先定义**——因为"首屏"在技术上有三种口径，对应三种优化目标：

| 口径 | 含义 | 对应指标 |
|---|---|---|
| **视觉首屏** | 用户看到页面上部有内容 | FCP |
| **内容首屏** | 视口内主要内容都渲染完 | **LCP**（最常用） |
| **可交互首屏** | 页面能响应点击 | INP / TBT / TTI |

> 一句可以加分的开场："首屏优化我会先确认是哪个口径。多数业务场景关心的是 LCP——用户看到主要内容；但如果是表单类页面，'能点了'更关键，那要盯 TBT 和 INP。这两者的优化手段不完全一样。"

---

## 2. SPA 首屏为什么慢（时序剖析）

### 2.1 完整时序

```mermaid
sequenceDiagram
  participant U as 用户
  participant N as 网络
  participant S as 服务器
  participant B as 浏览器

  U->>N: 输入 URL
  N->>S: 请求 index.html
  S-->>B: 返回空壳 HTML（只有 <div id="app"></div>）
  Note over B: TTFB ✅（此时页面还是白的）
  B->>B: 解析 HTML，发现 <script src="app.js">
  B->>N: 下载 app.js（可能 500KB~2MB）
  Note over B: ⚠️ 第一段浪费：下载时间
  B->>B: 解析 + 执行 JS（创建 Vue 实例、注册路由、跑所有模块）
  Note over B: ⚠️ 第二段浪费：执行时间（主线程被占）
  B->>N: 首屏接口请求（串行！JS 执行完才知道要请求什么）
  Note over B: ⚠️ 第三段浪费：串行等待
  N-->>B: 返回数据
  B->>B: 渲染 DOM → 首次绘制
  Note over B: FCP 终于发生 😩
```

### 2.2 三段"浪费"（这就是答题骨架）

| 阶段 | 问题本质 | 优化方向 |
|---|---|---|
| ① HTML 是空壳 | 服务端没给内容 | **改变渲染方式**（SSR/SSG/预渲染） |
| ② JS 太大且必须执行完才有内容 | 体积 + 执行成本 | **少给**（分割、tree-shaking、按需） |
| ③ 数据请求串行在 JS 之后 | 瀑布流 | **提前**（SSR 直出、preload 接口、并行请求） |

**这就是为什么"路由懒加载 + gzip + CDN"这套标准答案往往效果有限**——它们优化的是 ②，但真正的瓶颈可能是 ①（空壳）和 ③（串行请求）。

---

## 3. 四类手段总览（12 种，按思路分类）

| 类别 | 思路 | 手段 | 主要改善 |
|---|---|---|---|
| **A 少给** | 首屏不需要的别加载 | ① 路由/组件级代码分割 ② tree-shaking + 按需引入 ③ 第三方脚本治理 ④ 移除无用 polyfill | LCP、TBT |
| **B 快给** | 缩短传输时间 | ⑤ CDN + brotli ⑥ 资源优先级（preload/preconnect） ⑦ HTTP/2/3 ⑧ 减少重定向 | TTFB、LCP |
| **C 换方式** | 别让浏览器从零渲染 | ⑨ SSR ⑩ SSG/预渲染 ⑪ 流式 SSR + 渐进水合 | LCP、FCP |
| **D 抢先感知** | 让用户觉得快 | ⑫ 骨架屏 + 关键 CSS 内联 + 字体优化 + 渐进式图片 | FCP、CLS、主观体验 |

> **答题时的黄金句式**："首屏优化我会分四类：少给、快给、换渲染方式、抢先感知。前两类是常规优化，第三类要看项目类型决定是否值得，第四类只改善感知不改善真实指标。"

---

## 4. A 类：少给 —— 减少首屏必须下载和执行的东西

### 4.1 路由/组件级代码分割

```js
// ❌ 全量引入：所有页面打成一个 bundle
import Home from './views/Home.vue'
import About from './views/About.vue'
import Detail from './views/Detail.vue'

// ✅ 路由级分割：每个页面一个 chunk，访问时才下载
const routes = [
  { path: '/', component: () => import('./views/Home.vue') },
  { path: '/about', component: () => import('./views/About.vue') },
  { path: '/detail/:id', component: () => import('./views/Detail.vue') },
]
```

```js
// ✅ 组件级分割：首屏不可见的重组件（弹窗、图表、编辑器）
const HeavyChart = defineAsyncComponent(() => import('./components/HeavyChart.vue'))

// ✅ 条件加载：只在需要时 import
async function openEditor() {
  const { Editor } = await import('./editor')
  new Editor()
}
```

**Vite 下的分包配置：**

```js
// vite.config.js
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // 把变化频率低的第三方库单独成 chunk，利于长期缓存
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
          'vendor-chart': ['echarts'],
          'vendor-ui': ['element-plus'],
        },
      },
    },
  },
}
```

> **判断拆分粒度的原则**：按「**变更频率**」和「**首屏是否需要**」两个维度拆，而不是按文件大小。`vue` 全家桶几乎不变 → 单独 chunk 长期缓存；业务代码天天变 → 单独 chunk 高频更新。

### 4.2 tree-shaking 与按需引入

**tree-shaking 生效的三个前提：**

1. 使用 **ESM**（`import/export`），CJS 的 `module.exports` 无法静态分析
2. 打包工具开启 `usedExports` + `sideEffects`（Webpack 生产模式默认开）
3. 库本身是"可摇"的（提供 ESM 产物、`sideEffects: false`）

```js
// ❌ 全量引入 lodash：即使只用 debounce，也会打进 70KB+
import _ from 'lodash'
_.debounce(fn, 300)

// ✅ 具名引入（依赖 tree-shaking）
import { debounce } from 'lodash-es'

// ✅ 更稳：直接引子模块
import debounce from 'lodash/debounce'

// ❌ 全量引入 ECharts
import * as echarts from 'echarts'

// ✅ 按需注册
import * as echarts from 'echarts/core'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer])
```

**Element Plus / Ant Design 按需引入：**

```js
// Vite + unplugin-vue-components 自动按需
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default {
  plugins: [Components({ resolvers: [ElementPlusResolver()] })],
}
```

> **一个真实数字**：Element Plus 全量引入约 800KB（gzip 后 280KB）；按需 + 只用一个 Table 组件，可降到 60KB 左右。

### 4.3 第三方脚本治理（最容易被忽略，收益最大）

第三方脚本（统计、客服、广告、A/B 测试、地图）通常是**首屏性能的最大杀手**：

| 问题 | 数据 |
|---|---|
| 第三方脚本常占主线程 30%~50% | 移动端更严重 |
| 一个聊天客服 SDK 可能 300KB+ | 且常常同步加载 |
| 广告脚本会引发额外布局偏移 | 直接拉高 CLS |

**治理手段：**

```html
<!-- ① 非关键脚本全部延后 -->
<script src="https://analytics.example.com/a.js" defer></script>

<!-- ② 交互后才加载（如客服、评论） -->
<script>
  ['scroll', 'click', 'keydown'].forEach(evt =>
    window.addEventListener(evt, loadThirdParty, { once: true, passive: true })
  )
  function loadThirdParty() {
    const s = document.createElement('script')
    s.src = 'https://chat.example.com/sdk.js'
    s.async = true
    document.head.appendChild(s)
    // 记得移除监听
    ;['scroll', 'click', 'keydown'].forEach(evt =>
      window.removeEventListener(evt, loadThirdParty))
  }
</script>

<!-- ③ 用 iframe / Web Worker 隔离（重脚本放沙箱，不占主线程） -->
```

**面试加分**：说"我会用 Performance 面板看 Third-party 占比，如果第三方脚本主线程时间超过 30%，优先治理它，收益往往比折腾 bundle 更大"。

### 4.4 移除无用 polyfill

```js
// babel 按目标浏览器注入，而不是全量引入
// vite: 用 @vitejs/plugin-legacy 只给老浏览器出 polyfill 包
// webpack: 用 babel-preset-env 的 useBuiltIns: 'usage'
```

> 很多项目为了兼容 IE，引入了 `core-js` 全量 + `regenerator-runtime`，体积 100KB+。如果已经不支持 IE，**删掉就能白赚 100KB**。这是"零成本优化"。

---

## 5. B 类：快给 —— 缩短传输时间

这部分与分册 02 重叠，这里只列首屏相关的要点：

| 手段 | 首屏相关要点 |
|---|---|
| **CDN** | 静态资源上 CDN，命中率 > 90%；HTML 也可走 CDN（但要 `no-cache`） |
| **brotli** | 首屏 JS/CSS 收益最大，通常 -70%~-80% |
| **preconnect** | 对首屏要用的 API 域名提前建连，省 2~4 RTT |
| **preload** | 首屏 LCP 图、字体、关键 CSS/JS |
| **HTTP/2** | 单连接多路复用，避免 6 并发排队 |
| **减少重定向** | 每个 301 多一次 RTT；`http→https` + `不带 www→带 www` 串起来就是 2 次 |
| **HTML 直出** | 配合 SSR 或至少把关键数据内联（`window.__INITIAL_STATE__`） |

### 5.1 一个具体例子：内联初始数据，砍掉一次串行请求

```html
<!-- SSR 或后端模板直接注入，前端不再发首屏请求 -->
<script>
  window.__INITIAL_STATE__ = {"user":{"name":"张三"},"list":[...]}
</script>
```

```js
// 前端启动时优先读这份数据
const store = createStore()
if (window.__INITIAL_STATE__) {
  store.replaceState(window.__INITIAL_STATE__)
  delete window.__INITIAL_STATE__   // 释放内存
}
```

**收益**：省掉"JS 执行 → 发请求 → 等响应"这一整段串行，通常 300~800ms。

---

## 6. C 类：改变渲染方式 —— SSR / SSG / 流式 / 预渲染

### 6.1 四种渲染模式对比（必背表）

| | CSR | SSR | SSG | ISR / 增量静态 |
|---|---|---|---|---|
| HTML 生成时机 | 浏览器运行时 | **每次请求** | **构建时** | 构建时 + 定期/按需重新生成 |
| 首屏 LCP | 差（等 JS） | 好（HTML 直出） | **最好**（CDN 直接返回） | 最好 |
| TTFB | 好（静态壳） | **较差**（服务端渲染耗时） | 最好 | 最好 |
| SEO | 差 | 好 | 好 | 好 |
| 数据新鲜度 | 实时 | 实时 | 构建时 | 可配置（如 60s） |
| 服务端成本 | 无 | **高**（每请求渲染） | 无 | 低 |
| 适合 | 后台管理、强交互应用 | 内容需实时 + 要 SEO | 博客、文档、营销页 | 电商列表、资讯 |

> **关键认知**：SSR **不是"更快"，而是"更早"**。它把渲染工作从客户端挪到服务端，让用户更早看到内容；但总 JS 体积没减少（还要加上 hydration 成本），TTFB 反而可能变差。**如果首屏不需要 SEO 且用户是登录后的内部系统，SSR 基本不值得。**

### 6.2 SSR 的完整流程与代价

```mermaid
flowchart TD
  A["浏览器请求"] --> B["服务端创建 Vue 实例"]
  B --> C["渲染成 HTML 字符串<br/>renderToString"]
  C --> D["返回完整 HTML<br/>用户立刻看到内容 ✅"]
  D --> E["浏览器下载同一份 JS"]
  E --> F["客户端再次执行，<br/>hydrate 绑定事件"]
  F --> G["页面可交互 ✅"]
  E -.-> H["⚠️ 代价：JS 白下载一遍<br/>⚠️ 代价：hydration 占主线程<br/>⚠️ 代价：TBT 可能变差"]
```

**SSR 的 5 项代价（这题的高分点，很多人只说好处）：**

| 代价 | 说明 |
|---|---|
| **TTFB 变差** | 服务端要渲染，接口慢会直接拖慢首字节 |
| **Hydration 成本** | 客户端要重新执行一遍组件树来绑定事件；大页面 TBT 反而升高 |
| **两套环境** | 代码里不能用 `window`/`document`，第三方库可能不兼容 |
| **部署复杂** | 需要 Node 服务、缓存策略、降级方案 |
| **状态一致性** | 服务端与客户端渲染结果必须一致，否则 hydration mismatch |

**hydration mismatch 的典型原因：**

| 原因 | 例子 | 解法 |
|---|---|---|
| 用了随机/时间 | `Math.random()`、`Date.now()` | 用固定值，或放到 `onMounted` 后再更新 |
| 依赖浏览器 API | `window.innerWidth` 决定渲染内容 | 服务端给默认值，客户端挂载后修正 |
| 浏览器插件改 DOM | 翻译插件、广告拦截 | 用 `data-allow-mismatch` 忽略 |
| 非法 HTML 嵌套 | `<p>` 里套 `<div>` | 修正结构 |
| 数据不一致 | 服务端数据与客户端首帧数据不同 | 用同一份序列化状态 |

### 6.3 流式 SSR（Streaming SSR）

传统 SSR 要等**整个页面渲染完**才返回，TTFB 被最慢的接口拖住。流式 SSR 边渲染边发送：

```js
// Vue 3 + Node
import { renderToPipeableStream } from 'vue/server-renderer'

app.get('*', (req, res) => {
  const { pipe } = renderToPipeableStream(createApp(), {
    onShellReady() {
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html')
      pipe(res)                 // 外壳先发出去，用户立刻看到骨架
    },
    onError(err) {
      console.error(err)
      res.statusCode = 500
    },
  })
})
```

```vue
<!-- 慢的区块用 Suspense 包起来，先发占位，数据好了再流式补上 -->
<template>
  <Header />
  <Suspense>
    <SlowComments />
    <template #fallback><CommentsSkeleton /></template>
  </Suspense>
</template>
```

**收益**：TTFB 从"等所有接口"降到"外壳渲染完"，LCP 通常改善 30%~50%。React 18 的 `renderToPipeableStream` 同理。

### 6.4 预渲染（Prerender）：只给首屏做一次静态化

如果只有**首页/落地页**需要快，没必要上完整 SSR：

```js
// vite-plugin-prerender 或 prerender-spa-plugin
// 构建时用无头浏览器访问一次，把渲染结果存成 index.html
export default {
  plugins: [prerender({ routes: ['/', '/about', '/pricing'] })],
}
```

**适合**：页面数量少、内容变化不频繁（营销页、官网、活动页）。
**不适合**：内容实时变化、页面数量成百上千。

### 6.5 选型的现实建议（体现工程判断）

| 项目类型 | 建议 | 理由 |
|---|---|---|
| 后台管理系统 | **CSR 就够** | 登录后使用、无 SEO 需求、交互复杂；SSR 收益低且维护成本高 |
| 官网 / 营销页 | **SSG / 预渲染** | 内容静态、要 SEO、可全站 CDN |
| 电商 / 资讯 | **SSR + 流式 + CDN 缓存** | 要 SEO、内容需实时、列表页可短缓存 |
| 活动页（H5） | **CSR + 极致体积优化** | 生命周期短，上 SSR 不值；重投在体积和图片 |
| 内容站 / 博客 | **SSG / ISR** | 大量静态页面，构建期生成最划算 |

---

## 7. D 类：感知优化 —— 让用户"觉得"快

> 这一类**不改善真实指标，但极大改善主观体验**。面试时要说清这个区别，否则会被追问"这不是没优化吗"。

### 7.1 骨架屏

见第 8 节详述。

### 7.2 关键 CSS 内联

见第 9 节详述。

### 7.3 字体优化

| 手段 | 说明 |
|---|---|
| `font-display: swap` | 先用系统字体显示，字体到了再换（会有闪烁，但不白屏） |
| `font-display: optional` | 字体没在 100ms 内到就用系统字体，本次不换（**CLS 最好**） |
| **子集化** | 只保留用到的字符（中文可从 5MB 降到 200KB） |
| **`unicode-range` 分片** | 中文字体按字符集切片，按需加载 |
| **预加载首屏字体** | `<link rel="preload" as="font" crossorigin>` |
| **`size-adjust` 匹配度量** | 减少字体切换时的布局抖动 |

```css
@font-face {
  font-family: 'PingFang Custom';
  src: url('/fonts/pingfang-subset.woff2') format('woff2');
  font-display: swap;                /* 或 optional，看业务 */
  unicode-range: U+4E00-9FFF;        /* 只加载中文字符范围 */
  size-adjust: 105%;                 /* 与系统字体度量对齐，减小 CLS */
}
```

### 7.4 渐进式图片

```html
<!-- 先给模糊小图（LQIP），再换高清 -->
<img src="/hero-tiny.jpg"
     data-src="/hero.webp"
     style="filter: blur(20px); transition: filter .3s"
     onload="this.src=this.dataset.src; this.style.filter='none'"
     width="1200" height="600" alt="">
```

或者用 CSS 背景色 + `aspect-ratio` 占位，避免布局抖动。

### 7.5 交互反馈（改善 INP 体感）

| 手段 | 说明 |
|---|---|
| 点击立即给视觉反馈 | 按钮立刻变 loading 态，即使用户要等 500ms 也不觉得卡 |
| 乐观更新 | 先更新 UI，失败再回滚 |
| 进度条 | 路由切换时顶部进度条（NProgress） |

---

## 8. 骨架屏怎么做才不帮倒忙

### 8.1 核心原则：**骨架的形状必须和真实内容一致**

骨架屏最大的坑是：**骨架高度 ≠ 真实内容高度**，导致内容到达时页面跳动，**CLS 反而变差**。

```vue
<!-- ✅ 正确：骨架和真实结构的尺寸对齐 -->
<template>
  <div class="card">
    <div v-if="loading" class="skeleton" style="height: 120px"></div>
    <img v-else :src="data.cover" width="240" height="120" alt="">
    <h3>{{ data.title }}</h3>
    <p>{{ data.desc }}</p>
  </div>
</template>
```

### 8.2 三种实现方式

| 方式 | 优点 | 缺点 | 适合 |
|---|---|---|---|
| **手写组件** | 可控、精准 | 工作量大 | 结构固定的核心页面 |
| **构建时自动生成** | 一次配置全站可用（`vue-skeleton-webpack-plugin`） | 生成的骨架可能不准 | 多页面项目 |
| **HTML 内置首屏骨架** | 0 JS 即可显示（写在 `index.html` 里） | 需要手动维护 | **对 FCP 收益最大** |

**最有价值的是第三种**——把骨架直接写进 `index.html`：

```html
<!-- index.html -->
<div id="app">
  <!-- 这个骨架会在 JS 加载前就显示，把 FCP 从 3s 拉到 300ms -->
  <div class="app-skeleton">
    <div class="sk-header"></div>
    <div class="sk-banner"></div>
    <div class="sk-list">
      <div class="sk-item"></div>
      <div class="sk-item"></div>
    </div>
  </div>
</div>
<!-- Vue 挂载时会替换 #app 的内容，骨架自动消失 -->
```

### 8.3 骨架屏的常见坑

| 坑 | 说明 |
|---|---|
| 骨架显示太久 | 如果接口只要 100ms，骨架一闪而过反而像"闪屏"；可加 200ms 延迟再显示骨架 |
| 骨架和真实内容高度不一致 | 导致 CLS 变差（前面说过） |
| 骨架动画太重 | `shimmer` 用 `background-position` 动画，别用 `width/height` 动画（会触发 Layout） |
| 骨架没无障碍处理 | 加 `aria-busy="true"`，屏幕阅读器才不读空内容 |

---

## 9. 关键 CSS 内联与剩余 CSS 异步加载

### 9.1 为什么 CSS 是"渲染阻塞资源"

浏览器必须拿到 CSSOM 才能构建 Render Tree → **CSS 不加载完，页面一片空白**。而一个 200KB 的 CSS 里，首屏真正用到的可能只有 14KB。

### 9.2 标准做法：内联关键 CSS + 异步剩余 CSS

```html
<head>
  <!-- ① 首屏关键样式直接内联（目标：< 14KB，见下方说明） -->
  <style>
    /* header / banner / 首屏列表的样式 */
    .header{height:56px;display:flex;...}
    .banner{aspect-ratio:16/9;...}
  </style>

  <!-- ② 剩余 CSS 异步加载，不阻塞渲染 -->
  <link rel="preload" href="/styles/main.css" as="style"
        onload="this.onload=null;this.rel='stylesheet'">
  <noscript><link rel="stylesheet" href="/styles/main.css"></noscript>
</head>
```

> **为什么是 14KB？** TCP 慢启动的初始拥塞窗口约 10 个 MSS ≈ 14.6KB。**首屏 HTML（含内联 CSS）如果能装进第一个 RTT，就能省掉一个往返**。这是一个非常漂亮的加分点。

### 9.3 自动化方案

手写关键 CSS 不现实，一般用工具：

```js
// critical（npm）+ 构建钩子
import { generate } from 'critical'

await generate({
  base: 'dist/',
  src: 'index.html',
  target: 'index.html',
  inline: true,
  extract: true,          // 把原 CSS 抽出为异步加载
  dimensions: [{ width: 375, height: 667 }, { width: 1920, height: 1080 }],
})
```

Vite 生态可用 `vite-plugin-critical`。

### 9.4 常见坑

| 坑 | 说明 |
|---|---|
| 内联了全量 CSS | HTML 变大、无法缓存，反而更慢 |
| 用 `media="print" onload` 老技巧 | 仍可用但不如 `rel=preload` 语义清晰；注意 `noscript` 兜底 |
| 忘了 `noscript` | 禁用 JS 时页面完全没样式 |
| 内联 CSS 里引用了字体 | 字体加载仍会阻塞文本渲染，要配 `font-display` |

---

## 10. 路由懒加载与预加载策略

### 10.1 懒加载只是"推迟"，不是"消灭"

路由懒加载让首屏只加载当前路由，但如果用户下一步就点"关于我们"，那 200ms 的等待就转移到了路由切换时。所以**必须配预加载**。

### 10.2 三级预加载策略

```js
// 策略 1：空闲时预取所有路由（简单粗暴，适合路由少的项目）
router.isReady().then(() => {
  requestIdleCallback(() => {
    routes.forEach(r => r.component?.())    // 触发 import()
  })
})

// 策略 2：hover / focus 时预取（推荐，命中率高）
const prefetched = new Set()
router.options.routes.forEach(route => {
  const loader = route.component
  if (typeof loader !== 'function') return
  // 给每个路由挂一个预取函数
  route.meta.preload = () => {
    if (prefetched.has(route.path)) return
    prefetched.add(route.path)
    loader()
  }
})

document.addEventListener('mouseover', (e) => {
  const link = e.target.closest('a[href]')
  if (!link) return
  const route = router.resolve(link.getAttribute('href'))
  route.meta.preload?.()
}, { passive: true })

// 策略 3：视口内出现链接就预取（IntersectionObserver）
const io = new IntersectionObserver((entries) => {
  entries.forEach(en => {
    if (en.isIntersecting) {
      en.target.dataset.preload && router.resolve(en.target.dataset.preload).meta.preload?.()
      io.unobserve(en.target)
    }
  })
})
document.querySelectorAll('[data-preload]').forEach(el => io.observe(el))
```

### 10.3 Webpack 魔法注释

```js
// prefetch：空闲时下载（浏览器自动，无需手写策略 1）
const About = () => import(/* webpackPrefetch: true */ './views/About.vue')

// preload：与父 chunk 并行下载（慎用，会抢首屏带宽）
const Home = () => import(/* webpackPreload: true */ './views/Home.vue')

// 指定 chunk 名，便于分析
const Detail = () => import(/* webpackChunkName: "detail" */ './views/Detail.vue')
```

> Vite 不支持这些注释，需要用 `vite-plugin-prefetch-chunk` 或手写策略 2。

---

## 11. 决策树：什么项目该上什么

```mermaid
flowchart TD
  A["首屏慢"] --> B{"有 SEO 需求？"}
  B -->|否| C{"是登录后的内部系统？"}
  C -->|是| D["CSR + 体积优化<br/>路由分割 / 按需引入 / 骨架屏"]
  C -->|否| E["CSR + 极致体积<br/>H5 活动页路线"]
  B -->|是| F{"内容更新频率？"}
  F -->|"几乎不变"| G["SSG / 预渲染<br/>（最省成本，LCP 最好）"]
  F -->|"分钟级/秒级"| H{"页面数量？"}
  H -->|"少（<100）"| I["SSR + CDN 缓存"]
  H -->|"多（电商/资讯）"| J["SSR + 流式 + 分层缓存<br/>或 ISR"]
  D --> K["无论哪条路，都要做：<br/>图片治理 / 第三方脚本治理 / 缓存策略"]
  E --> K
  G --> K
  I --> K
  J --> K
```

**一段可以直接说给面试官的判断：**

> "如果面试官问我这个项目该不该上 SSR，我会先问三个问题：有没有 SEO 需求、首屏数据是否必须实时、团队能不能承担 Node 服务的运维。三个都是 yes 才值得上。否则我会把钱花在图片治理、第三方脚本、缓存策略上——这三件事在任何项目上 ROI 都比 SSR 高。"

---

## 12. 常见坑

| # | 坑 | 纠正 |
|---|---|---|
| 1 | 认为 SSR 一定更快 | SSR 改善 LCP，但 TTFB 可能变差，TBT 可能变差（hydration） |
| 2 | 首屏图加 `loading="lazy"` | 直接劣化 LCP 1~2s |
| 3 | 骨架屏高度与真实内容不一致 | CLS 变差，帮倒忙 |
| 4 | 路由懒加载不配预加载 | 把等待转移到路由切换，体验割裂 |
| 5 | 内联全量 CSS | HTML 变大且不可缓存 |
| 6 | `manualChunks` 按大小拆 | 应按变更频率拆；过细会导致请求数爆炸（HTTP/1.1 下更糟） |
| 7 | 预渲染用在实时数据页面 | 用户看到过期内容 |
| 8 | SSR 里用 `window` | 服务端报错 `window is not defined` |
| 9 | hydration mismatch 忽略 | 页面会闪一下重渲染，甚至事件失效 |
| 10 | 第三方脚本同步加载 | 阻塞解析，直接拖垮 FCP |
| 11 | `font-display: block` | 文本最长 3s 不可见，文本类 LCP 直接崩 |
| 12 | 只优化首屏不管二次访问 | 二次访问靠缓存，别只盯首屏 |

---

## 13. 答题模板

### 13.1 「首屏优化方案」——30 秒（及格线）

> "分四类：**少给**——路由分割、按需引入、第三方脚本延后；**快给**——CDN、brotli、preload 关键资源、减少重定向；**换渲染方式**——有 SEO 需求就 SSR 或 SSG，没有就用骨架屏顶住；**抢先感知**——把骨架屏写进 HTML、关键 CSS 内联、字体用 swap。另外首屏图一定要 `fetchpriority=high` 且不能 lazy。"

### 13.2 「SPA 首屏太慢怎么办」——2 分钟（高分线）

> "SPA 首屏慢，我一般先拆成三段看。
>
> **第一段是 HTML 是空壳。** 服务端返回的只有一个 `div#app`，用户在看到 JS 执行完之前完全是白屏。这一段只能靠改变渲染方式解决：如果项目有 SEO 需求，上 SSR 或 SSG；如果没有，至少把骨架屏直接写进 `index.html`，这样 FCP 能从 3 秒降到 300 毫秒，虽然没解决真实性能，但用户不再觉得白屏。
>
> **第二段是 JS 太大、执行太慢。** 我会先看 bundle 分析，通常能发现三个问题：路由没分割、某个库全量引入、polyfill 冗余。对应做路由级代码分割、ECharts 这种按需注册、删掉不需要的 core-js。再进一步是第三方脚本，统计、客服、地图这些常常占主线程 30% 以上，我会把非关键的改成交互后加载，收益经常比折腾 bundle 更大。
>
> **第三段是数据请求串行在 JS 之后。** 这是 SPA 独有的瀑布流——必须等 JS 执行完才知道要请求什么。解法是把首屏数据随 HTML 一起直出，比如后端模板注入 `window.__INITIAL_STATE__`，前端启动时直接读，省掉 300 到 800 毫秒。
>
> 这三段做完，再做常规的网络优化：CDN、brotli、preconnect、preload 首屏图。最后是验证，看 LCP 的四段归因，确认瓶颈真的被移走了。
>
> 至于要不要上 SSR，我的判断是：有 SEO 需求、数据要实时、团队能维护 Node 服务，三个都满足才上。否则性价比不如前面那几件事。"

### 13.3 「首屏优化」被追问"你怎么知道有效"时

> "看 LCP 的四段拆分。如果 TTFB 大，说明问题在服务端或网络；如果资源加载延迟大，说明资源发现太晚，通常是图片写在 JS 里或者被 lazy 了；如果资源加载时长大，说明图太大；如果元素渲染延迟大，说明主线程被占。四段里哪段占比最大就优化哪段，改完再跑一次确认那一段降下来了。"

---

## 14. 追问表

| # | 追问 | 要点 |
|---|---|---|
| 1 | SSR 一定比 CSR 快吗？ | 不一定。改善 LCP，但 TTFB 可能更差（服务端渲染耗时），TBT 可能更差（hydration） |
| 2 | 什么是 hydration？ | 客户端复用服务端 HTML，重新执行组件树以绑定事件，而不是重新创建 DOM |
| 3 | hydration mismatch 怎么排查？ | 看控制台警告定位组件；常见原因是随机数、时间、浏览器 API、非法 HTML 嵌套 |
| 4 | 流式 SSR 解决了什么？ | TTFB 不再被最慢接口拖住；外壳先发，慢区块用 Suspense 补流 |
| 5 | SSG 和 SSR 怎么选？ | 内容是否随请求变化；SSG 无服务端成本、可全站 CDN；实时数据要 SSR 或 ISR |
| 6 | 预渲染和 SSG 区别？ | 预渲染通常指给 SPA 的少数路由生成静态 HTML（工具驱动）；SSG 是框架级全站生成 |
| 7 | 骨架屏会改善 LCP 吗？ | 会。如果骨架被视为 LCP 元素（通常不是最大内容），主要改善 FCP；核心价值是感知 |
| 8 | 关键 CSS 为什么要控制在 14KB？ | TCP 初始拥塞窗口约 14.6KB，装进第一个 RTT 可省一次往返 |
| 9 | 路由懒加载有什么副作用？ | 把加载延迟转移到路由切换；需要配 prefetch/hover 预取 |
| 10 | `webpackPrefetch` 和 `webpackPreload` 区别？ | prefetch 空闲低优先，preload 与父 chunk 并行高优先（慎用） |
| 11 | 首屏图片怎么优化？ | WebP/AVIF + srcset + `fetchpriority=high` + preload + 不 lazy + 预留尺寸 |
| 12 | 为什么首屏图不能 lazy？ | 浏览器会等布局完成才判断是否在视口，导致请求延后 1~2s |
| 13 | 怎么量化首屏优化效果？ | LCP p75 前后对比 + Lighthouse 多次采样 + 灰度 A/B |
| 14 | 首屏优化做到什么程度停？ | LCP p75 < 2.5s 或达到业务目标；继续投入 ROI 明显下降 |
| 15 | 大屏/低端机怎么兼顾？ | 响应式图片 + 按 `deviceMemory`/`connection` 降级（少图、关动画） |
| 16 | SPA 首屏后切路由也慢怎么办？ | 路由级 prefetch、组件级缓存（keep-alive）、接口并行、骨架屏 |
| 17 | 内联 `__INITIAL_STATE__` 有什么风险？ | XSS（要转义 `</script>`）、数据量大增 HTML、敏感信息泄露 |
| 18 | 为什么不把所有代码都内联进 HTML？ | 无法缓存、HTML 变大、每次都要重新下载 |
| 19 | Islands 架构是什么？ | 静态 HTML + 局部交互岛屿（Astro），只水合需要交互的部分，大幅减少 JS |
| 20 | 边缘渲染（ESR）是什么？ | 在 CDN 边缘节点跑 SSR，兼顾"HTML 直出"和"低 TTFB"，如 Vercel Edge、Cloudflare Workers |

---

## 15. 速记卡

```
【三段浪费（答 SPA 首屏的骨架）】
① HTML 是空壳 → 改渲染方式（SSR/SSG/预渲染/HTML 内骨架）
② JS 太大太慢 → 少给（路由分割/按需引入/第三方治理/删 polyfill）
③ 数据串行在 JS 后 → 提前（__INITIAL_STATE__ 直出 / 接口并行）

【四类手段】
少给 / 快给 / 换渲染方式 / 抢先感知

【四种渲染模式】
CSR：无 SEO，LCP 差，适合后台
SSR：SEO 好，LCP 好，TTFB 差，成本高
SSG：最好，构建时生成，适合静态内容
ISR：SSG + 定期重生成，适合电商/资讯

【SSR 五代价】
TTFB 变差 / hydration 成本 / 两套环境 / 部署复杂 / 状态一致性

【两个魔法数字】
14KB —— 关键 CSS 内联上限（TCP 初始窗口）
14.6KB / 10 MSS —— 同理，装进第一个 RTT

【首屏图四件套】
WebP + srcset + fetchpriority=high + preload（且绝对不能 lazy）

【骨架屏铁律】
形状尺寸必须与真实内容一致，否则 CLS 反而变差
写进 index.html 才对 FCP 有真实收益
```
