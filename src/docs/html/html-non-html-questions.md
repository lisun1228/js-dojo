# HTML · 08 题单里的非 HTML 题

> 本册覆盖：性能优化、Webpack 图片、loader 与 plugin、CSS 选择器、盒模型、伪元素与伪类、Vue 响应式、跨域、HTTP 与 HTTPS、GET 与 POST、状态码、内存泄漏
>
> 这些题不属于 HTML，分散在性能优化、工程化、CSS、框架、网络五个领域。本册给出能支撑追问的技术结论，不展开专项细节。

---

## 目录

- [8.1 性能优化](#81-性能优化)
- [8.2 Webpack 如何处理图片资源](#82-webpack-如何处理图片资源)
- [8.3 loader 与 plugin 的区别](#83-loader-与-plugin-的区别)
- [8.4 CSS 选择器与优先级](#84-css-选择器与优先级)
- [8.5 盒模型](#85-盒模型)
- [8.6 伪元素与伪类](#86-伪元素与伪类)
- [8.7 Vue 响应式原理](#87-vue-响应式原理)
- [8.8 跨域](#88-跨域)
- [8.9 HTTP 与 HTTPS](#89-http-与-https)
- [8.10 GET 与 POST](#810-get-与-post)
- [8.11 常见状态码](#811-常见状态码)
- [8.12 内存泄漏](#812-内存泄漏)
- [8.13 速记卡](#813-速记卡)

---

## 8.1 性能优化

### 8.1.1 一句话结论

**性能优化不是「列手段」，而是「定位 → 度量 → 优化 → 验证」的闭环。** 先讲指标，再讲链路，最后给数据。

### 8.1.2 先说指标

| 指标 | 全称 | 衡量什么 | 好 |
|---|---|---|---|
| **LCP** | Largest Contentful Paint | **加载**：首屏最大内容出现的时间 | < 2.5s |
| **INP** | Interaction to Next Paint | **交互**：点击/输入到画面响应 | < 200ms |
| **CLS** | Cumulative Layout Shift | **稳定**：布局偏移累积 | < 0.1 |
| TTFB | Time to First Byte | 服务端响应速度 | < 800ms |
| FCP | First Contentful Paint | 首次出现内容 | < 1.8s |

> **INP 在 2024 年 3 月正式取代 FID**，Core Web Vitals 已不再包含 FID。

### 8.1.3 再按「五条链路」展开手段

```
① 网络层            ② 资源层            ③ 渲染层
   DNS/TLS 往返       体积（压缩/图片）    关键 CSS / SSR
   CDN / HTTP2-3      数量（合并/内联）   减少阻塞
   预连接/预加载      加载时机（懒加载）   骨架屏
        ↓                   ↓                  ↓
④ 运行时            ⑤ 缓存层
   长任务切片           HTTP 缓存
   Worker/虚拟列表      Service Worker
   减少重排重绘         本地存储
```

| 层 | 手段 | 主要改善 |
|---|---|---|
| **网络** | CDN、`preconnect`/`dns-prefetch`、HTTP/2 多路复用、HTTP/3（QUIC）、TLS 1.3 | TTFB、LCP |
| **资源** | Gzip/Brotli、图片 WebP/AVIF + `srcset`、字体子集化 + `font-display: swap`、代码分割 + tree-shaking、按需引入 | LCP |
| **加载时机** | 路由懒加载、`loading="lazy"`（**非首屏**）、`preload` 关键资源、`defer`/`async` | LCP、INP |
| **渲染** | 内联关键 CSS、SSR/SSG、骨架屏、避免 `@import`、减少 DOM 数量 | FCP、LCP、CLS |
| **运行时** | 虚拟列表、防抖节流、`requestAnimationFrame`、Web Worker、时间切片、`content-visibility` | INP |
| **缓存** | `index.html` no-cache + 静态资源 hash 长缓存、Service Worker、接口缓存 | 二次访问全部指标 |

### 8.1.4 五个典型案例

| 现象 | 定位 | 根因 | 修复 | 改善方向 |
|---|---|---|---|---|
| 首屏白屏数秒 | Lighthouse 看 LCP 元素是首屏大图 | 图片 2.4MB，没压缩没 CDN | 转 AVIF + `srcset` + CDN + `preload` | LCP 回到 2.5s 内 |
| 发版后用户看到旧页面 | 用户反馈「刷新才好」 | `index.html` 被强缓存 | 改为 `no-cache`，静态资源 hash | 旧页面问题消失 |
| 列表滚动卡顿 | Performance 面板看长任务 | 一次渲染 5000 个 DOM 节点 | 虚拟列表（只渲染可视区 20 个） | 掉帧消失，INP 回到 200ms 内 |
| 输入框打字延迟 | Profile 看到每次输入都全量 filter | 大数据量同步计算 | 防抖 + 索引 + Worker | 输入延迟降到一帧内 |
| 图片加载后页面跳动 | CLS 0.35 | `img` 没写 `width/height` | 加宽高 + `aspect-ratio` | CLS 接近 0 |

### 8.1.5 答题结构

1. **指标**：LCP（加载 < 2.5s）、INP（交互 < 200ms）、CLS（稳定 < 0.1），TTFB、FCP 辅助。
2. **方法论**：Lighthouse / Performance 面板定位 → `web-vitals` + RUM 度量（看 P75/P95）→ 按链路优化 → 复测。
3. **五条链路各 1-2 个手段**：网络、资源、加载时机、渲染、运行时与缓存。
4. **一个真实案例**：现象 → 定位 → 根因 → 修复 → 数据。

**追问表**

| 追问 | 回答要点 |
|---|---|
| LCP 怎么优化 | 找出 LCP 元素 → 图片压缩/格式/CDN/`preload`/`fetchpriority=high`；HTML 层做 SSR、减小 TTFB |
| INP 怎么优化 | 减少长任务（>50ms）、拆分、Worker、避免强制同步布局、减少 DOM |
| CLS 怎么优化 | 图片/iframe 写宽高、字体 `font-display`、动态插入内容预留空间、动画用 `transform` |
| 首屏优化 | SSR/SSG、关键 CSS 内联、减少阻塞脚本、预加载、骨架屏 |
| 二次访问优化 | HTTP 缓存 + Service Worker + 本地数据缓存 |
| 怎么度量线上性能 | RUM：`web-vitals` 库上报 + 分位数统计（P75/P95），别只看平均值 |

---

## 8.2 Webpack 如何处理图片资源

### 8.2.1 一句话结论

**Webpack 4 用 `file-loader`（输出文件 + 返回 URL）和 `url-loader`（小于阈值转 base64）；Webpack 5 统一成「资源模块（Asset Modules）」四个类型，用 `type` 声明，不再需要 loader。**

### 8.2.2 Webpack 4 的两个 loader

```js
module: {
  rules: [
    {
      test: /\.(png|jpe?g|gif|svg)$/,
      use: [
        {
          loader: 'url-loader',
          options: {
            limit: 8 * 1024,              // < 8KB 转 base64
            fallback: 'file-loader',      // 超过则交给 file-loader
            name: '[name].[contenthash:8].[ext]',
            outputPath: 'images/',
          },
        },
      ],
    },
  ],
}
```

| loader | 行为 |
|---|---|
| `file-loader` | 把文件**复制到输出目录**，把模块导出为**文件 URL** |
| `url-loader` | 小于 `limit` 时**转成 base64 data URI**；否则调用 `fallback`（默认 `file-loader`） |

### 8.2.3 Webpack 5 的 Asset Modules

```js
module: {
  rules: [
    // ① 按大小自动决定 inline 还是输出文件（默认 8KB）
    {
      test: /\.(png|jpe?g|gif)$/i,
      type: 'asset',
      parser: { dataUrlCondition: { maxSize: 8 * 1024 } },
      generator: { filename: 'images/[name].[contenthash:8][ext]' },
    },
    // ② 强制输出文件
    { test: /\.svg$/i, type: 'asset/resource' },
    // ③ 强制转 base64
    { test: /\.ico$/i, type: 'asset/inline' },
    // ④ 导出源码字符串（少用）
    { test: /\.txt$/i, type: 'asset/source' },
  ],
}
```

| 类型 | 行为 | 等价于 |
|---|---|---|
| `asset/resource` | 输出文件，导出 URL | `file-loader` |
| `asset/inline` | 转 data URI | `url-loader`（无 limit） |
| `asset/source` | 导出源码字符串 | `raw-loader` |
| **`asset`** | **按 `maxSize` 自动选择上面两种** | `url-loader` + `file-loader` |

**Vite 的对应**：默认 **< 4096 字节转 base64**，用 `build.assetsInlineLimit` 调；静态资源用 `assetsInclude` 扩展类型；`?url` / `?inline` / `?raw` 后缀显式指定。

### 8.2.4 base64 的利弊

| 优点 | 缺点 |
|---|---|
| **减少 HTTP 请求数**（HTTP/1.1 下有意义） | **体积增大约 33%**（base64 用 4 字符表示 3 字节） |
| 小图标不用额外往返 | **无法单独缓存**（跟着 CSS/JS 一起失效） |
| 不会因为图片 404 导致样式错乱 | **阻塞解析**：内联在 CSS 里会拖慢关键 CSS 体积 |
| | **无法用 CDN 单独优化**、无法渐进式解码 |
| | HTTP/2 下「减少请求」的收益已经很小 |

**结论**：**阈值应该小（4~8KB）**，只把真正的小图标内联。HTTP/2 时代「合并请求」的收益已经很低，反而体积更重要。

### 8.2.5 追问表

| 追问 | 回答要点 |
|---|---|
| 阈值设多少 | 4~8KB，只内联真正的小图标 |
| 图片还能怎么优化 | 压缩（sharp/squoosh）、WebP/AVIF、`srcset`、CDN、懒加载、SVG symbol |
| SVG 怎么处理 | 用 `@svgr/webpack` 转 React 组件，或者 `svg-sprite-loader` 做雪碧图 |
| `contenthash` 有什么用 | 内容变才变文件名，配合长期缓存 |

---

## 8.3 loader 与 plugin 的区别

### 8.3.1 一句话结论

**loader 是「文件级的翻译官」**——把 A 格式的源码转成 B 格式，只工作在**模块构建阶段**；**plugin 是「构建流程的插件」**——通过钩子介入 Webpack 的**整个生命周期**，能做的事远不止转换文件。

| 维度 | loader | plugin |
|---|---|---|
| **职责** | **转换单个文件的内容** | **介入构建流程**（改配置、产文件、优化产物） |
| **配置位置** | `module.rules` | `plugins: []` |
| **工作阶段** | 模块构建（load）阶段 | 全流程（compiler / compilation 的各种钩子） |
| **输入输出** | 源码字符串/Buffer → 源码 | 无固定形态，通过钩子操作 |
| **能否改构建流程** | ❌ 不能 | ✅ 能 |
| **执行顺序** | **从右到左 / 从下到上**（链式） | 按钩子时机 |
| **本质** | 一个 `function(source)` | 一个带 `apply(compiler)` 的类 |
| **典型** | `babel-loader` `ts-loader` `css-loader` `style-loader` `sass-loader` `file-loader` `postcss-loader` | `HtmlWebpackPlugin` `MiniCssExtractPlugin` `DefinePlugin` `CopyWebpackPlugin` `TerserPlugin` `BundleAnalyzerPlugin` |

### 8.3.2 loader 的「从右到左」

```js
{
  test: /\.scss$/,
  use: ['style-loader', 'css-loader', 'sass-loader'],
  //     ③              ②            ①
}
```

实际执行顺序：**`sass-loader` → `css-loader` → `style-loader`**

```
a.scss
  ↓ sass-loader    编译成 CSS
CSS 字符串
  ↓ css-loader     解析 @import / url()，转成 JS 模块
JS 模块（导出 CSS）
  ↓ style-loader   生成 <style> 注入代码
最终 JS
```

> 记忆法：**「后写的先执行」**（像 `compose`/`pipe` 的反向）。

### 8.3.3 一个最小 plugin 长什么样

```js
class MyPlugin {
  apply(compiler) {
    // 1. 改配置
    compiler.hooks.environment.tap('MyPlugin', () => {});

    // 2. 编译开始时（每次增量编译都会触发）
    compiler.hooks.compilation.tap('MyPlugin', (compilation) => {
      // 3. 生成资源阶段：可以往产物里加文件
      compilation.hooks.processAssets.tap(
        { name: 'MyPlugin', stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL },
        (assets) => {
          compilation.emitAsset('hello.txt', new compiler.webpack.sources.RawSource('hi'));
        }
      );
    });

    // 4. 全部完成
    compiler.hooks.done.tap('MyPlugin', (stats) => {
      console.log('构建完成', stats.hash);
    });
  }
}
```

**核心机制**：Webpack 用 **Tapable** 实现了一套发布订阅，`compiler`（全局）和 `compilation`（单次构建）上挂着几十个钩子。plugin 就是「在正确的时间点 `tap` 进去」。

### 8.3.4 追问表

| 追问 | 回答要点 |
|---|---|
| plugin 怎么拿到 compiler | 构造函数注入，`apply(compiler)` 由 Webpack 调用 |
| `compiler` 和 `compilation` 区别 | `compiler` 是全局唯一（启动到结束）；`compilation` 每次构建/增量编译新建 |
| Tapable 是什么 | Webpack 的事件流库，SyncHook/AsyncSeriesHook 等 |
| `HtmlWebpackPlugin` 干什么 | 生成 HTML 并自动注入带 hash 的 script/link |
| `DefinePlugin` 干什么 | 编译期替换全局常量（如 `process.env.NODE_ENV`） |
| 能不能写一个 loader | 能，`module.exports = function(source) { return transformed }` |
| Vite 里有 loader 吗 | 没有，Vite 用 Rollup 插件 + esbuild，插件模型统一 |

---

## 8.4 CSS 选择器与优先级

### 8.4.1 一句话结论

**优先级是四元组 `(a, b, c, d)`**：`a` 是内联样式，`b` 是 ID 数，`c` 是类/属性/伪类数，`d` 是元素/伪元素数。**同权重看书写顺序（后写的赢）**，`!important` 单独分层（作者 `!important` 仍低于用户/UA 的 `!important`）。

### 8.4.2 选择器分类

| 类别 | 例子 | 权重贡献 |
|---|---|---|
| **通配** | `*` | (0,0,0,0) |
| **元素/类型** | `div` `p` | (0,0,0,1) |
| **类** | `.btn` | (0,0,1,0) |
| **属性** | `[type="text"]` | (0,0,1,0) |
| **伪类** | `:hover` `:nth-child(2)` `:not(.a)` | (0,0,1,0)（`:not()` 算**括号里**的权重） |
| **ID** | `#app` | (0,1,0,0) |
| **内联 style** | `style="color:red"` | (1,0,0,0) |
| **伪元素** | `::before` | (0,0,0,1) |
| **组合器** | 后代` `、子`>`、相邻`+`、通用兄弟`~`、列`||` | **不贡献权重** |
| **分组** | `a, b` | 各自独立计算 |
| **`:is()` / `:where()`** | — | `:is()` 取括号内最高；**`:where()` 权重恒为 0** |
| **`:has()`** | `.card:has(img)` | 相当于伪类，按括号内最高算 |

### 8.4.3 权重不进位

```css
/* (0,10,0,0) —— 10 个 class */
.a1.a2.a3.a4.a5.a6.a7.a8.a9.a10 { color: red; }

/* (0,1,0,0) —— 1 个 ID，赢！ */
#app { color: blue; }
```

**优先级是「逐位比较」，不是「加起来比大小」**。所以 11 个 class 也打不过 1 个 ID。

### 8.4.4 完整层叠顺序（从高到低）

```
① 用户代理 !important（极少见）
② 用户 !important
③ 作者 !important
④ 内联 style（非 important）
⑤ 作者样式表（正常）
⑥ 用户样式表（正常）
⑦ 用户代理样式表（浏览器默认）
```

**同一档内**：先比 `@layer` 顺序（未分层的普通声明高于任何分层）→ 再比权重 → 权重相同比出现顺序（后写的赢）。

**`@layer`（现代 CSS 的优先级管理）**：

```css
@layer reset, base, components, utilities;   /* 声明顺序：越后越高 */
@layer utilities  { .text-blue { color: blue } }
@layer components { .btn { color: red } }    /* 写在后面也赢不了 utilities */
```

**`@layer` 里的普通声明优先级低于「未分层」的普通声明**，典型用途是让引入的第三方库打不过自己的样式。

### 8.4.5 追问表

| 追问 | 回答要点 |
|---|---|
| `!important` 和 ID 谁高 | `!important` 高，但会破坏可维护性 |
| 选择器写太深会慢吗 | 现代浏览器从右向左匹配 + 有优化，影响很小；但可读性和复用性是问题 |
| CSS 变量受优先级影响吗 | 变量是「继承 + 就近覆盖」，也遵守层叠规则 |
| 怎么覆盖第三方样式 | 提高选择器特异性，或用 `@layer` 把库放到低优先级层；若库自身用 `:where()`，其权重为 0 |

---

## 8.5 盒模型

### 8.5.1 一句话结论

**盒模型描述 `width` 到底包含什么**：`content-box`（默认）只含内容；`border-box` 含内容 + padding + border。**`margin` 在盒子外面，不参与 `width` 计算**；CSS 盒模型的概念模型包含 margin，但尺寸计算不包含。

常见误解是把 `margin` 算进 `width`，于是以为 `width:100px; margin:10px` 的总宽是 100px。

### 8.5.2 两种盒模型的尺寸计算

```css
.box { width: 100px; padding: 10px; border: 5px solid; margin: 20px; }
```

| | `content-box`（默认） | `border-box` |
|---|---|---|
| `width` 表示 | **内容区**宽度 | **边框盒**宽度 |
| 实际占宽（border 外沿） | 100 + 20 + 10 = **130px** | **100px** |
| 加上 margin 的总占位 | 130 + 40 = **170px** | 100 + 40 = **140px** |
| 内容区宽度 | 100px | 100 - 20 - 10 = **70px** |

> **注意**：`margin` 在两种模型下都**不算进 `width`**，它永远是盒子外面的间距。

### 8.5.3 `box-sizing: border-box` 为什么是实践标准

```css
*, *::before, *::after { box-sizing: border-box; }
```

| 好处 | 说明 |
|---|---|
| **写 `width:100%` 不会溢出** | `content-box` 下 `width:100%; padding:10px` 会超出父容器 20px |
| **「所见即所设」** | 设 100px 就占 100px，符合直觉 |
| **栅格系统好用** | `width: 33.33%` + `padding` 不会破格 |

**代价**：改的是 `width` 的语义，老代码可能依赖 `content-box`；现代项目通常全局开启。

### 8.5.4 `margin` 折叠

| 场景 | 是否折叠 | 结果 |
|---|---|---|
| **相邻兄弟** | ✅ 折叠 | 取两者较大值 |
| **父子**（父无 padding/border/overflow） | ✅ 折叠 | 子元素的 margin 跑到父元素外面 |
| **空元素自身**（上下 margin 相邻） | ✅ 折叠 | 自身折叠成一个 |
| **浮动元素** | ❌ 不折叠 | — |
| **绝对定位元素** | ❌ 不折叠 | — |
| **行内块元素** | ❌ 不折叠 | — |
| **BFC 元素内部** | ✅ 内部仍折叠，但**不影响外部** | — |
| **flex / grid 子项** | ❌ **不折叠** | — |

**父子折叠的经典解法**：

```css
/* 给父元素任意一条即可 */
.parent { overflow: hidden; }        /* 触发 BFC */
.parent { padding-top: 1px; }
.parent { border-top: 1px solid transparent; }
.parent { display: flow-root; }      /* 最干净的方案 */
```

### 8.5.5 追问表

| 追问 | 回答要点 |
|---|---|
| `margin` 属于盒模型吗 | 概念上属于盒模型，但**不参与 `width` 计算** |
| `margin` 折叠条件 | 普通流中的**块级**元素、垂直方向；flex/grid/浮动/绝对定位不折叠 |
| BFC 是什么 | 块级格式化上下文，独立布局区域，内部不影响外部；触发方式 `overflow:hidden`、`float`、`position:absolute`、`display:flow-root`/`flex`/`grid` |
| `outline` 和 `border` 区别 | `outline` 不占空间、不能分边设置（`outline-offset` 可调） |

---

## 8.6 伪元素与伪类

### 8.6.1 一句话结论

**伪类（pseudo-class）描述「元素的状态或位置」**，元素**本来存在**；**伪元素（pseudo-element）创建一个「不存在的子元素」**，用来做装饰或特殊部分。**单冒号 `:` 是伪类，双冒号 `::` 是伪元素**（CSS2 时代的伪元素用单冒号，为了兼容现在还能写）。

| | 伪类 `:` | 伪元素 `::` |
|---|---|---|
| **是否真实存在** | ✅ 真实元素，只是加了状态 | ❌ **虚拟的**，不在 DOM 里 |
| **能绑 JS 事件吗** | ✅ 元素本身能绑（状态不产生独立事件） | ❌ **不能**（不在 DOM） |
| **能否被 JS 选中** | ✅ 选择器可用，`querySelectorAll(':hover')` 能匹配到（含祖先） | ❌ 不能 `querySelector` |
| **权重** | (0,0,1,0) | (0,0,0,1) |
| **代表** | `:hover` `:focus` `:first-child` `:nth-child()` `:not()` `:checked` `:disabled` `:has()` | `::before` `::after` `::first-line` `::first-letter` `::selection` `::placeholder` `::marker` `::backdrop` |

### 8.6.2 常用伪类速查

| 类别 | 伪类 |
|---|---|
| **交互状态** | `:hover` `:active` `:focus` `:focus-visible` `:focus-within` `:visited` `:link` `:target` |
| **表单状态** | `:checked` `:disabled` `:enabled` `:required` `:optional` `:valid` `:invalid` `:in-range` `:placeholder-shown` `:read-only` |
| **结构位置** | `:first-child` `:last-child` `:only-child` `:nth-child()` `:nth-of-type()` `:first-of-type` `:empty` `:root` |
| **逻辑** | `:not()` `:is()` `:where()` `:has()` |

**四个常用伪类**：

| 伪类 | 用途 | 要点 |
|---|---|---|
| **`:focus-visible`** | 由浏览器判断是否需要可见焦点：键盘导航通常匹配，普通按钮鼠标点击通常不匹配 | 既保留键盘可达性，又避免鼠标点击时出现焦点框 |
| **`:focus-within`** | 子元素获得焦点时，**父元素**也匹配 | 做「输入框聚焦时整行高亮」 |
| **`:has()`** | **父选择器** | `.card:has(img)` 选「含图片的卡片」；`.form:has(:invalid)` 选「有错误的表单」 |
| **`:where()`** | 权重恒为 0 | 写 reset 不污染优先级 |

### 8.6.3 `::before` / `::after` 的三个要点

```css
.icon::before {
  content: '';            /* ★ 必须写，否则不渲染（可以是空字符串） */
  display: inline-block;  /* 默认是 inline，要设宽高必须改 display */
  width: 16px;
  height: 16px;
  background: url(icon.svg);
}
```

| 要点 | 说明 |
|---|---|
| **`content` 必须写** | 不写 `content` 时伪元素**完全不生成**（不是「显示不出来」，是根本没这个盒子） |
| **默认是 `display: inline`** | 要设 `width`/`height` 必须改成 `inline-block` / `block` / `flex` |
| **不能被 JS 直接操作** | 不在 DOM 里，只能通过改 class 间接改样式 |

**用例**：清除浮动（`clearfix`）、装饰图标、引号、下划线动效、`::after` 做遮罩层。

### 8.6.4 追问表

| 追问 | 回答要点 |
|---|---|
| 单冒号和双冒号区别 | 单是伪类，双是伪元素；CSS2 伪元素也能用单冒号（兼容） |
| `::before` 不显示怎么办 | 检查 `content` 是否写了、`display` 是否是 inline |
| 伪元素能绑事件吗 | **不能**，不在 DOM |
| 伪元素能设 z-index 吗 | 能，但 `z-index` 只对定位元素（`position` 非 `static`）或 flex/grid 子项生效，伪元素通常要配 `position` |
| `:has()` 兼容性 | Chrome 105+、Safari 15.4+、Firefox 121+ |
| `:focus` 和 `:focus-visible` | 后者由浏览器判断是否需要可见焦点，鼠标点击普通按钮时通常不匹配 |
| 清除浮动怎么写 | `.clearfix::after { content:''; display:block; clear:both }`；现在直接 `display: flow-root` |

---

## 8.7 Vue 响应式原理

### 8.7.1 一句话结论

**Vue 2 用 `Object.defineProperty` 劫持每个属性的 getter/setter**（遍历递归）；**Vue 3 用 `Proxy` 代理整个对象**（惰性递归）。核心链路一致：**数据劫持 → 依赖收集（getter 里 track）→ 派发更新（setter 里 trigger）→ 微任务批量执行**。

### 8.7.2 Vue 2：`Object.defineProperty`

```js
function defineReactive(obj, key, val) {
  const dep = new Dep();                 // 每个属性一个依赖收集器
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get() {
      if (Dep.target) dep.depend();      // ★ 收集：谁在读我
      return val;
    },
    set(newVal) {
      if (newVal === val) return;
      val = newVal;
      dep.notify();                      // ★ 派发：通知所有 watcher 更新
    },
  });
}
```

**四个缺陷**：

| 缺陷 | 表现 | 解法 |
|---|---|---|
| **无法监听新增/删除属性** | `obj.newKey = 1` 不触发更新 | `Vue.set` / `Vue.delete`（内部用 `$set` 调 `defineReactive` + `notify`） |
| **无法监听数组索引赋值和 `length`** | `arr[0] = x`、`arr.length = 0` 不响应 | 重写 7 个数组方法（`push`/`pop`/`shift`/`unshift`/`splice`/`sort`/`reverse`） |
| **必须初始化时递归遍历** | 大对象/深层对象初始化慢 | 无法优化（这也是 Vue3 用 Proxy 的动机之一） |
| **需要 `$set` 才能加响应式属性** | 心智负担 | — |

### 8.7.3 Vue 3：`Proxy`

```js
function reactive(target) {
  return new Proxy(target, {
    get(obj, key, receiver) {
      track(obj, key);                       // 收集依赖
      const res = Reflect.get(obj, key, receiver);
      return isObject(res) ? reactive(res) : res;   // ★ 惰性：访问到才代理
    },
    set(obj, key, value, receiver) {
      const old = obj[key];
      const ok = Reflect.set(obj, key, value, receiver);
      if (old !== value) trigger(obj, key);  // 派发更新
      return ok;
    },
    deleteProperty(obj, key) { /* 能拦截 delete */ },
    has(obj, key) { /* 能拦截 in */ },
    ownKeys(obj) { /* 能拦截 Object.keys */ },
    // ... 共 13 种拦截
  });
}
```

**相比 Vue 2 的五个提升**：

| 提升 | 说明 |
|---|---|
| **能监听新增/删除/索引/length** | 因为 `set` / `deleteProperty` 都能拦，不需要 `$set` |
| **惰性递归** | 只有**访问到的嵌套对象**才被代理，初始化更快 |
| **支持 Map / Set / WeakMap / WeakSet** | `defineProperty` 根本做不到 |
| **能拦截 `in`、`Object.keys`、`for...in`** | — |
| **数组也能直接监听索引** | 不用重写 7 个方法 |

**`Proxy` 的代价**：

| 代价 | 说明 |
|---|---|
| **兼容性** | 不支持 IE（无法 polyfill，因为 `Proxy` 是语言级特性） |
| **`reactive` 只能用对象** | 基本类型要用 `ref`（`ref` 内部是 `{ value }` 的对象包一层） |
| **解构会丢失响应性** | `const { count } = reactive(obj)` 之后 `count` 不再是响应式的（要用 `toRefs`） |
| **代理对象 ≠ 原对象** | `reactive(obj) !== obj`，比较时要注意 |

### 8.7.4 两者共同的四步模型

```
① 数据劫持
   Vue2: defineProperty 每个属性
   Vue3: Proxy 整个对象
        ↓
② 依赖收集（读的时候）
   渲染函数执行 → 读到响应式数据 → getter/track 记录「这个 effect 依赖这个 key」
        ↓
③ 派发更新（写的时候）
   setter/trigger → 找出依赖这个 key 的所有 effect → 加入调度队列 → 微任务里批量执行
        ↓
④ 调度
   Vue2: queueWatcher + nextTick（Promise.then）
   Vue3: scheduler queue + nextTick（Promise.then）
```

**为什么用微任务**：同一个 tick 里改 10 次数据，只重新渲染 1 次（`nextTick` 后统一 flush）。

### 8.7.5 追问表

| 追问 | 回答要点 |
|---|---|
| `ref` 和 `reactive` 区别 | `ref` 包基本类型（`.value`），`reactive` 只能对象；`ref` 存对象时内部也用 `reactive` |
| `computed` 怎么实现 | 本质是带缓存的 effect（`dirty` 标记 + 依赖变化才重算） |
| `nextTick` 原理 | 微任务（`Promise.then`），在 DOM 更新后执行 |
| Vue3 的 `effect` 是什么 | 响应式副作用，渲染函数、`watch`、`computed` 都基于它 |
| 为什么 Vue3 快 | 编译优化（静态提升、Patch Flag、Block Tree）+ 惰性代理 + 更小的运行时 |

---

## 8.8 跨域

### 8.8.1 一句话结论

**跨域问题的根源是「同源策略」——它限制的是「读取」，不是「发送」。** 请求常常已经发出去了（服务端也处理了），只是**浏览器不让 JS 读响应**。所以「跨域」不等于「请求发不出去」。

### 8.8.2 同源与限制范围

**同源 = 协议 + 域名 + 端口三者完全相同**。

| 限制什么 | 不限制什么 |
|---|---|
| `fetch` / `XHR` **读响应** | `<img>` `<script>` `<link>` `<video>` **可以加载**（但不能读内容） |
| 访问 iframe 的 DOM（跨域时 `contentDocument` 为 `null`） | 表单可以**提交**到任意域 |
| 读跨域的 `localStorage` / `Cookie`（按域隔离） | `<a>` 可以**跳转**到任意域 |
| `canvas` 读取跨域图片像素 | WebSocket **不受同源限制**（这是 CSWSH 的根源） |

### 8.8.3 CORS：官方方案

**简单请求（不触发预检）的三个条件**（缺一不可）：

| # | 条件 |
|---|---|
| **① 方法** | `GET` / `HEAD` / `POST` 之一 |
| **② 头部** | 只含「安全头」：`Accept` `Accept-Language` `Content-Language` `Content-Type`（且值受限）`Range` 等 |
| **③ `Content-Type`** | 只能是 `text/plain` / `multipart/form-data` / `application/x-www-form-urlencoded` 三者之一 |

**不满足就触发预检（`OPTIONS`）**：

```http
OPTIONS /api/user HTTP/1.1
Origin: https://a.com
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: content-type, authorization
```

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://a.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: content-type, authorization
Access-Control-Max-Age: 86400            ← 预检结果缓存 24 小时
Access-Control-Allow-Credentials: true
```

**带 Cookie 的三个必须**（最常见的报错来源）：

```js
// 前端
fetch(url, { credentials: 'include' });
```

后端响应头三条缺一不可：

```http
Access-Control-Allow-Credentials: true
Access-Control-Allow-Origin: https://a.com     ← 不能是 *（浏览器直接拒绝）
Access-Control-Allow-Headers: ...              ← 不能有 *
```

### 8.8.4 五种方案对比

| 方案 | 原理 | 优点 | 缺点 | 用在哪 |
|---|---|---|---|---|
| **CORS** | 服务端返回 `Access-Control-*` | **标准、支持所有方法** | 需要服务端配合 | **首选** |
| **代理** | 开发：devServer proxy；生产：Nginx 反代 | **前端零改动**，服务端无感 | 多一层转发；生产要运维配合 | **生产最常用** |
| **JSONP** | `<script src>` 不受限，回调函数接数据 | 兼容极老浏览器 | **只支持 GET**、无错误处理、**有 XSS 风险** | 历史遗留 |
| **postMessage** | 跨窗口通信 | 支持跨域 iframe | 只能通信，不能替代 API | 嵌套页面、微前端 |
| **WebSocket** | 不受同源策略限制 | 双向 | — | 实时场景（但要防 CSWSH） |

```nginx
# Nginx 反代（生产最常用）
location /api/ {
  proxy_pass https://backend.example.com/;
  proxy_set_header Host $host;
}
```

前端直接请求同源的 `/api/xxx`，不产生跨域。

### 8.8.5 追问表

| 追问 | 回答要点 |
|---|---|
| 预检什么时候触发 | 不满足简单请求条件；`OPTIONS` 请求 |
| 怎么减少预检 | `Access-Control-Max-Age` 缓存；把自定义头改成简单头 |
| 为什么 JSONP 只能 GET | 靠 `<script src>` 加载，script 只能 GET |
| `document.domain` 还能用吗 | 已废弃（Chrome 115 起移除） |
| WebSocket 受同源限制吗 | **不受**，所以有 CSWSH，服务端必须校验 `Origin` |
| 生产怎么解决跨域 | Nginx 反代（同源）/ 网关统一加 CORS 头 |

---

## 8.9 HTTP 与 HTTPS

### 8.9.1 一句话结论

**HTTPS = HTTP + TLS**。它解决三个问题：**机密性**（数据加密，中间人看不到）、**完整性**（防篡改）、**身份认证**（证书证明「你是你」）。

### 8.9.2 对比表

| 维度 | HTTP | HTTPS |
|---|---|---|
| 默认端口 | **80** | **443** |
| 传输 | **明文** | **TLS 加密** |
| 身份验证 | ❌ | ✅ 证书链 |
| 防篡改 | ❌ | ✅（MAC/AEAD） |
| 性能 | 无加密开销 | 有 TLS 握手（**TLS 1.3 = 1-RTT**，可 0-RTT 恢复） |
| SEO | — | ✅ Google 明确加权 |
| 浏览器提示 | 「不安全」 | 锁标 |
| 成本 | 无 | 证书（Let's Encrypt 免费） |

### 8.9.3 为什么用「混合加密」

| 加密方式 | 速度 | 密钥分发 | 用途 |
|---|---|---|---|
| **对称加密**（AES） | **快**（快几个数量级） | ❌ 密钥怎么安全传给对方？ | **加密数据** |
| **非对称算法**（RSA/ECDHE） | **慢** | ✅ 公钥可以公开 | **协商密钥 + 验证身份** |

```
① 用 ECDHE 协商出一个「对称密钥」
② 之后所有数据用对称密钥加密（AES-GCM）
③ 证书链证明「这个服务器确实是 example.com」
```

常见错误：「HTTPS 用非对称加密传数据」。非对称只用来协商/验证，数据全程对称加密。

### 8.9.4 追问表

| 追问 | 回答要点 |
|---|---|
| HTTPS 怎么防中间人 | 证书链验证到系统信任的根 CA + 域名匹配 + 有效期 |
| 证书链怎么验 | 用上级 CA 公钥验下一级签名，一路到根证书（内置在系统/浏览器） |
| TLS 1.3 相比 1.2 | 握手从 2-RTT 降到 1-RTT，删掉 RSA 密钥交换（只留 ECDHE，**前向安全**） |
| 什么是前向安全 | 长期私钥泄露也无法解密历史会话（因为每次用临时 ECDHE 密钥） |
| 0-RTT 有什么风险 | 有**重放攻击**风险，只能用于幂等请求 |
| HSTS 是什么 | 响应头告诉浏览器「以后只用 https」，之后本地改写，防 SSL 剥离 |
| HTTPS 会慢吗 | 首次多 1-RTT 握手；有会话复用/HTTP2 后基本可忽略 |
| 为什么还需要 CDN 也上 HTTPS | 否则混合内容（mixed content）会被浏览器拦截 |

---

## 8.10 GET 与 POST

### 8.10.1 一句话结论

**GET 是「取」，POST 是「交」**。RFC 上的本质区别是**语义**：GET 应该**安全**（不改服务端状态）且**幂等**（重复执行结果相同），POST 两者都不保证。**长度限制、是否缓存、参数位置都是这个语义的推论，不是 HTTP 规定。**

### 8.10.2 对比表

| 维度 | GET | POST |
|---|---|---|
| **语义** | 获取资源 | 提交数据 / 处理 |
| **安全（不改状态）** | ✅ 应该安全 | ❌ |
| **幂等** | ✅ 幂等 | ❌ 非幂等 |
| **参数位置** | **URL query** | **请求体 body** |
| **长度限制** | **HTTP 规范无限制**；受**浏览器/服务器** URL 长度限制（常见 2KB~8KB） | HTTP 规范无限制；受服务器 `client_max_body_size` 等限制 |
| **可缓存** | ✅ 默认可缓存 | ❌ 一般不缓存（除非显式声明） |
| **进历史记录 / 可收藏** | ✅ | ❌ |
| **能被浏览器预加载/预取** | ✅ | ❌ |
| **编码** | `application/x-www-form-urlencoded`（URL 编码） | 可以任意（JSON、form-data、二进制） |
| **安全性（防窥探）** | ❌ 参数在 URL 里，会进日志、历史、Referer | 相对好（body 不进日志和 Referer） |

> **两个常见误解**：
> 1. **「GET 有长度限制、POST 没有」**——HTTP 规范**两者都没有**长度限制；限制来自浏览器和服务器实现。
> 2. **「GET 一个 TCP 包、POST 两个」**——这是十几年前的观测，现代浏览器和 TLS 下不成立。

### 8.10.3 什么时候必须用 POST

| 场景 | 原因 |
|---|---|
| 新增/修改数据 | GET 应该安全，用 GET 做写操作会被爬虫/预取误触发 |
| 传敏感信息（密码） | URL 会进日志、历史、Referer |
| 传大量数据（文件） | URL 不适合承载大量数据，且二进制无法放 query |
| 需要非 ASCII/二进制 | 要 base64 二次编码，有额外开销 |

### 8.10.4 追问表

| 追问 | 回答要点 |
|---|---|
| RESTful 里怎么用 | GET 查、POST 增、PUT 全量改、PATCH 局部改、DELETE 删 |
| 表单默认是 GET 吗 | 是；传密码/文件必须显式 `method="post"` |

---

## 8.11 常见状态码

### 8.11.1 一句话结论

**五类：1xx 信息、2xx 成功、3xx 重定向、4xx 客户端错、5xx 服务端错。** 重点是几组易混码：**301 vs 302 vs 307 vs 308**、**401 vs 403**、**502 vs 503 vs 504**。

### 8.11.2 重点状态码表

| 码 | 含义 | 要点 |
|---|---|---|
| **200** | OK | — |
| **201** | Created | 创建成功，常配 `Location` 头指向新资源 |
| **204** | No Content | 成功但**无响应体**（常用于 DELETE、OPTIONS） |
| **206** | Partial Content | **断点续传 / 分段下载**，配 `Range` |
| **301** | Moved Permanently | **永久**重定向，**会被浏览器/CDN 缓存**，SEO 传权重。**慎用，改错了很难回滚** |
| **302** | Found | **临时**重定向；默认不缓存，是否缓存取决于响应头（部分浏览器会启发式缓存） |
| **303** | See Other | 强制用 **GET** 访问新地址（POST 后跳转应用 303） |
| **304** | Not Modified | **协商缓存命中**，只回头不回体 |
| **307** | Temporary Redirect | 临时重定向，**严格保持原方法和请求体**（302 的修正版） |
| **308** | Permanent Redirect | 永久重定向，**严格保持原方法**（301 的修正版） |
| **400** | Bad Request | 参数格式错 |
| **401** | Unauthorized | **未认证**（没登录 / token 无效）→ 应引导登录 |
| **403** | Forbidden | **已认证但无权限**（登录了但没资格） |
| **404** | Not Found | 资源不存在（也常被用来隐藏 403） |
| **405** | Method Not Allowed | 方法不允许，响应应带 `Allow` 头 |
| **409** | Conflict | 冲突（如重复创建） |
| **429** | Too Many Requests | **限流**，应带 `Retry-After` |
| **500** | Internal Server Error | 服务端代码异常 |
| **502** | Bad Gateway | **网关/反代收到上游的无效响应**（上游挂了或崩了） |
| **503** | Service Unavailable | 服务**暂时不可用**（过载 / 维护），应带 `Retry-After` |
| **504** | Gateway Timeout | **网关等上游超时** |

### 8.11.3 五组易混状态码

| 对比 | 区别 |
|---|---|
| **301 vs 302** | 永久 vs 临时；301 会被缓存，**上线后改不回来** |
| **302 vs 307** | 302 历史上很多实现会把 POST 改成 GET；**307 严格保持方法和 body** |
| **301 vs 308** | 都永久；308 是 301 的「严格保持方法」版本 |
| **401 vs 403** | 401 = **你是谁？**（没认证）；403 = **我知道你是谁，但你不能**（没权限） |
| **502 vs 503 vs 504** | 502 = 上游返回**无效响应**；503 = **自身**过载/维护；504 = 上游**太慢** |

### 8.11.4 追问表

| 追问 | 回答要点 |
|---|---|
| 502 怎么排查 | 看上游服务是否存活、端口、健康检查、Nginx `error_log` |
| 504 怎么排查 | 上游处理慢（慢 SQL、下游超时）、反代 `proxy_read_timeout` 太短 |
| 204 和 200 空响应区别 | 204 语义明确「无内容」，不该有 body；200 + 空 body 不规范 |
| 3xx 会影响 SEO 吗 | 301 传权重；302 不传；链式重定向会损耗 |

---

## 8.12 内存泄漏

### 8.12.1 一句话结论

**内存泄漏 = 「本该被 GC 回收的对象，因为还有引用指向它，所以回收不掉」。** 在 JS 里，根因几乎总是**意外的强引用**。

### 8.12.2 九种典型场景

| # | 场景 | 代码 | 为什么泄漏 |
|---|---|---|---|
| **1** | **未清理的定时器** | `setInterval(() => render(data), 1000)` 组件销毁时没 `clearInterval` | 定时器回调持有 `data` 和组件作用域 |
| **2** | **未解绑的事件监听** | `window.addEventListener('resize', onResize)` | `window` 是永久对象，持有回调 → 回调闭包持有组件 |
| **3** | **脱离 DOM 的引用（detached DOM）** | `this.el = document.querySelector('#x'); this.el.remove();` | JS 变量还引用着已被移除的 DOM，整个子树都回收不掉 |
| **4** | **闭包持有大对象** | 闭包捕获了巨大的数组但只用其中一个字段 | 闭包保留整个作用域链 |
| **5** | **全局变量** | `function f() { leak = bigData }`（非严格模式下漏了 `var/let`） | 挂到 `window` 上永不回收 |
| **6** | **Observer 未断开** | `new IntersectionObserver(cb)` 没 `disconnect()` | 观察者持有目标元素引用 |
| **7** | **`Map`/`Set` 强引用** | `map.set(domNode, data)` 从不 delete | `Map` 的 key 是强引用；用 **`WeakMap`/`WeakSet`** 解决 |
| **8** | **`console.log` 持有对象** | `console.log(bigData)` | DevTools 会保留对象引用（清除控制台或关闭面板后释放） |
| **9** | **未取消的 `fetch` / Promise** | 组件卸载后回调仍执行 | 闭包持有组件作用域；用 `AbortController` 取消 |

### 8.12.3 修复前后对比

```js
// ❌ 泄漏：组件卸载后定时器和监听还在
export default {
  mounted() {
    this.timer = setInterval(this.poll, 1000);
    window.addEventListener('resize', this.onResize);
  },
};

// ✅ 正确：成对出现
export default {
  mounted() {
    this.timer = setInterval(this.poll, 1000);
    window.addEventListener('resize', this.onResize);
    this.abort = new AbortController();
  },
  beforeUnmount() {
    clearInterval(this.timer);
    window.removeEventListener('resize', this.onResize);
    this.abort.abort();               // 取消 fetch
    this.observer?.disconnect();      // 断开 observer
  },
};
```

> **Vue 3 的清理方式**：在 `setup` 或 `effectScope` 内用 `onScopeDispose` 注册清理函数；`watchEffect` 的 `onCleanup` 也能清理副作用。

### 8.12.4 怎么排查

| 工具 | 用途 |
|---|---|
| **Chrome DevTools → Memory → Heap Snapshot** | **三次快照法**：操作前拍一次 → 反复操作 N 次 → 再拍一次 → 对比，看哪些对象数量**持续增长** |
| **Performance monitor** | 实时看 `JS heap size`、`DOM Nodes`、`Event Listeners` 数量是否只增不减 |
| **Allocation instrumentation on timeline** | 看内存分配的时序，找「该回收没回收」的蓝色块 |
| **`performance.memory`**（Chrome） | 脚本里读 `usedJSHeapSize` 做监控 |

**三次快照法**的步骤：

```
① 打开页面，拍 Snapshot 1
② 执行可能泄漏的操作 10 次
③ 手动触发 GC（DevTools 里的垃圾桶按钮）
④ 拍 Snapshot 2
⑤ 再执行 10 次，GC，拍 Snapshot 3
⑥ 对比 Snapshot 2 和 3 的 "Delta"，找对象数持续增长的构造器
```

### 8.12.5 追问表

| 追问 | 回答要点 |
|---|---|
| JS 的 GC 机制 | 标记-清除（mark-and-sweep）为主，从根对象出发标记可达对象，未标记的回收 |
| 闭包一定泄漏吗 | 不一定，只有「闭包被长期持有且捕获了大对象」才泄漏 |
| `WeakMap` 为什么能解决 | key 是弱引用，key 被回收时对应条目自动移除 |
| 怎么检测泄漏 | Heap Snapshot 三次对比 + Performance monitor 看堆趋势 |
| 定时器为什么会泄漏 | 回调闭包持有作用域，且定时器被浏览器持有 |
| SPA 为什么更容易泄漏 | 页面不刷新，泄漏会累积；组件反复挂载卸载放大了问题 |
| React/Vue 里怎么防 | React 用 `useEffect` 返回清理函数；Vue 用 `onUnmounted` / `onScopeDispose` 清理 |
| 内存泄漏的表现 | 页面越用越卡、切页面后内存不降、最终崩溃（OOM） |

---

## 8.13 速记卡

```
性能优化
  ★ 先说指标：LCP<2.5s（加载）INP<200ms（交互）CLS<0.1（稳定）
  ★ INP 已取代 FID（2024.3）
  方法论：定位(Lighthouse/Performance) → 度量(RUM/web-vitals) → 优化 → 验证
  五链路：网络(CDN/preconnect) 资源(压缩/图片/字体) 渲染(关键CSS/SSR)
         运行时(虚拟列表/Worker/rAF) 缓存(HTTP/SW)

Webpack 图片
  webpack4：file-loader（输出文件）+ url-loader（小图 base64）
  webpack5：asset/resource | asset/inline | asset/source | asset（按 maxSize 自动）
  Vite：默认 <4096 内联，assetsInlineLimit 可调
  ★ base64 坏处：体积+33%、不能单独缓存、拖慢关键 CSS

loader vs plugin
  loader：文件级转换，module.rules，★ 从右到左
  plugin：介入构建生命周期，compiler/compilation 钩子，Tapable
  典型：babel-loader/css-loader/style-loader/sass-loader
       HtmlWebpackPlugin/DefinePlugin/MiniCssExtractPlugin

CSS 优先级
  四元组 (内联, ID, 类/属性/伪类, 元素/伪元素)，★ 不进位
  10 个 class 打不过 1 个 ID
  层叠：UA !important > 用户 !important > 作者 !important > 内联 > 作者 > 用户 > UA
  :where() 权重 0；:is() 取括号最高；@layer 管理层级

盒模型
  ★ margin 在盒外，不参与 width 计算
  content-box：width = 内容；border-box：width = 内容+padding+border
  实践：* { box-sizing: border-box }
  margin 折叠：相邻兄弟/父子（无 padding|border|overflow）/空元素；flex/grid 不折叠
  阻止父子折叠：display: flow-root 最干净

伪元素 vs 伪类
  伪类：状态/位置（:hover :focus :nth-child :not :has）
  伪元素：虚拟子元素（::before ::after ::first-line ::selection）
  ★ 伪元素不在 DOM → 不能绑事件、不能 querySelector
  ::before 必须写 content；默认 display:inline，设宽高要改
  :focus-visible 只在键盘时显示；:has() 父选择器；:where() 权重 0

Vue 响应式
  Vue2：defineProperty 逐属性 → 缺陷：新增/删除属性、数组索引/length、全量递归、要 $set
  Vue3：Proxy 整对象，13 种拦截 → 惰性递归、支持 Map/Set、不需要 $set
  共同链路：劫持 → 收集依赖(get/track) → 派发更新(set/trigger) → 微任务批量
  代价：不支持 IE；解构丢响应性（toRefs）

跨域
  ★ 同源策略限制「读」不限制「发」
  简单请求三条件：GET/HEAD/POST + 安全头 + Content-Type 三种之一
  带 Cookie：credentials:include + Allow-Credentials:true + Allow-Origin 不能是 *
  方案：CORS（首选）/ 代理（生产最常用）/ JSONP（仅 GET）/ postMessage / WebSocket

HTTP vs HTTPS
  HTTPS = HTTP + TLS（机密性 + 完整性 + 身份认证）；80 vs 443
  ★ 混合加密：非对称只协商密钥，数据全程对称
  TLS1.3 = 1-RTT，只留 ECDHE（前向安全）；0-RTT 有重放风险
  HTTPS 页面加载 HTTP 资源会被当作混合内容拦截

GET vs POST
  ★ 本质是语义：GET 安全+幂等，POST 都不
  ★ 「GET 有长度限制」是错的——规范都没限制，限制来自浏览器/服务器
  参数位置 / 缓存 / 历史记录 / 编码 都是语义的推论

状态码
  2xx：200 201 204 206
  3xx：301 永久 · 302 临时 · 303 强制GET · 304 协商缓存 · 307 临时保方法 · 308 永久保方法
  4xx：400 401 未认证 · 403 无权限 · 404 405 409 429
  5xx：500 502 上游无效响应 · 503 自身过载 · 504 上游超时

内存泄漏
  九种：定时器 / 事件监听 / detached DOM / 闭包持大对象 / 全局变量 /
       Observer 未 disconnect / Map 强引用（→ WeakMap/WeakSet）/ console.log / 未取消的 fetch
  排查：Heap Snapshot 三次对比 + Performance monitor 看堆趋势
  SPA 更严重（不刷新，累积）
```
