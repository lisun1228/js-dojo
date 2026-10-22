# CSS · 05 响应式与移动端适配

> 覆盖原题：24、32、33、47、50、57
> 合并后 5 个知识点 ｜ 重要度 ★★★★ ｜ 建议时长 55 分钟

---

## 目录

- [本主题速查](#本主题速查)
- [Q22 · 响应式布局的完整方案](#q22--响应式布局的完整方案)
- [Q23 · 单位体系：%、vh/vw、em/rem](#q23--单位体系vhvwemrem)
- [Q24 · 移动端 1px 问题](#q24--移动端-1px-问题)
- [Q25 · 750px 设计稿的适配方案](#q25--750px-设计稿的适配方案)
- [Q26 · iOS 上 position: fixed 的问题](#q26--ios-上-position-fixed-的问题)
- [本主题自测](#本主题自测)

---

## 本主题速查

| 编号 | 知识点 | 合并自 |
|---|---|---|
| Q22 | 响应式布局的完整方案 | 33 |
| Q23 | 单位体系：%、vh/vw、em/rem | 24 |
| Q24 | 移动端 1px 问题 | 47、50 |
| Q25 | 750px 设计稿的适配方案 | 57 |
| Q26 | iOS 上 position: fixed 的问题 | 32 |

一句话主线：**这一章考的是"工程落地能力"——面试官想知道你有没有真机调过页面。** 答题时务必带上"原因 → 方案 → 方案的副作用"这三段，只说结论会被追着问。

---

## Q22 · 响应式布局的完整方案

> 合并原题：33（响应式布局怎么弄）

**一句话答案**：响应式的五件套是——① `<meta viewport>`；② 媒体查询（移动优先，用 `min-width` 递进）；③ 弹性布局（flex/grid + 百分比 + `max-width`）；④ 相对单位与流式排版（`rem` / `vw` / `clamp()`）；⑤ 响应式资源（`srcset` / `<picture>`）。新时代还可以用容器查询 `@container`。

### 答题思路

1. 先给"响应式不是一招，是一套组合拳"的定性。
2. 按五件套顺序讲，每件一句话说清作用。
3. 讲断点怎么定（不要背 768/1024，要说"按内容断点"）。
4. 补容器查询、`clamp()` 这些现代方案，体现知识新鲜度。
5. 讲一个实际项目中的取舍：移动优先 vs 桌面优先。

### 核心要点

**① viewport 声明（移动端的地基）**

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

- 不加这行，移动端会按 980px 的虚拟视口渲染再缩放，媒体查询全部失效。
- `viewport-fit=cover` 配合 iPhone 刘海屏安全区 `env(safe-area-inset-bottom)` 使用。

**② 媒体查询（按断点切换）**

```css
/* 移动优先：先写小屏样式，再用 min-width 递进增强 */
.card { padding: 12px; }

@media (min-width: 768px) {
  .card { padding: 20px; }
}
@media (min-width: 1200px) {
  .card { padding: 24px; }
}
```

- **移动优先**（`min-width`）：基础样式给小屏，逐步增强。代码更少、优先级更自然，是现代主流。
- **桌面优先**（`max-width`）：基础样式给大屏，逐级降级。老项目常见。
- 断点不要照抄框架，**按内容断**：把窗口拉窄，直到布局"看起来难受"的那个宽度就是断点。
- 常见断点参考：`576`（手机横屏）、`768`（平板竖屏）、`992`、`1200`（桌面）、`1440`。
- 媒体查询还可以按其他特性：`prefers-color-scheme`（深色模式）、`prefers-reduced-motion`（减少动画）、`hover: hover`（区分触屏与鼠标）、`orientation`（横竖屏）、`resolution`（高清屏）。

**③ 弹性布局**

```css
/* 百分比 + 最大宽度：流式但不失真 */
.container { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 16px; }

/* flex 自动换行 */
.cards { display: flex; flex-wrap: wrap; gap: 16px; }
.cards > .card { flex: 1 1 240px; }   /* 最小 240，可长可缩 */

/* grid 自动列数（不需要媒体查询） */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}
```

`repeat(auto-fit, minmax(240px, 1fr))` 是"零媒体查询响应式"的核心写法：容器宽度变化时自动决定列数。

**④ 相对单位与流式排版**

```css
/* 字号随视口平滑变化，不再需要断点 */
.title { font-size: clamp(20px, 4vw, 32px); }

/* 间距也流式 */
.section { padding: clamp(16px, 5vw, 64px) 16px; }
```

`clamp(最小值, 理想值, 最大值)` 是响应式排版最实用的函数，理想值通常用 `vw`。

**⑤ 响应式资源**

```html
<!-- 按 DPR 和宽度选图 -->
<img src="small.jpg"
     srcset="small.jpg 480w, medium.jpg 800w, large.jpg 1600w"
     sizes="(max-width: 600px) 100vw, 50vw"
     alt="...">

<!-- 艺术方向（不同屏幕裁不同构图） -->
<picture>
  <source media="(min-width: 768px)" srcset="desktop.jpg">
  <img src="mobile.jpg" alt="...">
</picture>
```

**⑥ 现代补充：容器查询**

媒体查询看的是**视口**，容器查询看的是**父容器**。组件库场景下后者更合理：

```css
.card-wrapper { container-type: inline-size; }

@container (min-width: 400px) {
  .card { display: flex; }
}
```

同一张卡片放在侧边栏（窄）和主区域（宽）会自动切换布局，不需要为每个使用场景写媒体查询。

**移动优先 vs 桌面优先**

| | 移动优先 | 桌面优先 |
|---|---|---|
| 方向 | 基础样式给小屏，`min-width` 增强 | 基础样式给大屏，`max-width` 降级 |
| 优点 | 代码精简、移动端性能好、符合渐进增强 | 老项目改造成本低 |
| 缺点 | 桌面端复杂布局要写更多增强规则 | 移动端要写大量覆盖，样式冗余 |

### 口述回答（约 90 秒）

> 响应式是一套组合，我一般分五块讲。
>
> 第一是 viewport。移动端必须写 `<meta name="viewport" content="width=device-width, initial-scale=1">`，不写的话手机会按 980px 虚拟视口渲染再缩放，媒体查询和尺寸全部对不上。现在还会加 `viewport-fit=cover` 配合安全区变量处理刘海屏。
>
> 第二是媒体查询。我用移动优先，基础样式写小屏，然后 `min-width` 逐级增强。断点我不背固定值，而是把窗口拉窄，到布局开始难受的那个宽度就是断点，一般是 768、1024、1200 这几档。
>
> 第三是弹性布局。容器用百分比宽度加 `max-width` 限制，列表用 flex wrap 配 `flex: 1 1 240px`，或者直接用 grid 的 `repeat(auto-fit, minmax(240px, 1fr))`，后者不用写媒体查询就能自动决定列数。
>
> 第四是相对单位。字号和间距用 `clamp()` 做流式变化，比如 `clamp(20px, 4vw, 32px)`，比断点跳变平滑。
>
> 第五是图片资源，用 `srcset` 和 `sizes` 按屏幕宽度选图，`<picture>` 做艺术方向切换，能省不少流量。
>
> 现在做组件库我会用容器查询 `@container`，因为它看的是父容器宽度而不是视口，同一个组件在不同位置能自适应，比媒体查询更合理。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| 为什么移动端不加 viewport 会出问题？ | 虚拟视口 980px 渲染后整体缩放，媒体查询基于 980 判定 |
| 移动优先为什么更好？ | 渐进增强、移动端加载更少样式、覆盖规则更少 |
| `rem` 做断点有什么坑？ | 断点用 `rem` 会受根字号影响；用 `em` 还会受浏览器默认字号设置影响，断点建议用 `px` |
| `auto-fit` 和 `auto-fill` 区别？ | `auto-fill` 空列也占位保留，`auto-fit` 会折叠空列让已有元素拉伸填满 |
| 媒体查询和容器查询什么时候用哪个？ | 页面级布局用媒体查询，组件级自适应用容器查询 |
| 响应式图片一定要用 `srcset` 吗？ | 是内容大图、移动端流量敏感时值得；小图标用 SVG 更划算 |
| 如何处理横竖屏？ | `@media (orientation: landscape)`，注意横屏高度很小，要避免固定 `100vh` 内容 |

---

## Q23 · 单位体系：%、vh/vw、em/rem

> 合并原题：24（vh 和百分比的区别）

**一句话答案**：百分比是**相对父元素（包含块）**计算的，具体参照哪个维度取决于属性——`width` 相对父宽，`height` 相对父高（父高为 auto 时失效），`padding/margin` 无论方向都相对**父宽**；`vh/vw` 是**相对视口**的绝对单位，`100vh` 恒等于视口高度，与父元素无关。`em` 相对自身（或父级）字号，`rem` 相对根元素字号。

### 答题思路

1. 先一句话点出本质差异：**百分比的参照物是父级，视口单位是全局的**。
2. 讲百分比的三个特例（最容易被追问）：高度失效、padding 相对宽度、绝对定位相对包含块。
3. 讲 `vh` 的移动端坑（地址栏）+ `dvh/svh/lvh` 新单位。
4. 补全单位家族：`em`、`rem`、`vmin/vmax`、`ch`、`ex`。
5. 给选型建议。

### 核心要点

**百分比：参照物是包含块，且各属性参照的维度不同**

| 属性 | 百分比相对谁 |
|---|---|
| `width` | 包含块的**宽度** |
| `height` | 包含块的**高度**；若父级 `height: auto`，则百分比高度**失效**（按内容算） |
| `padding`（四个方向） | 包含块的**宽度**（上下也是宽度！） |
| `margin`（四个方向） | 包含块的**宽度** |
| `top/bottom` | 包含块的**高度** |
| `left/right` | 包含块的**宽度** |
| `font-size` | **父元素**的 `font-size` |
| `line-height` | **自身**的 `font-size` |
| `border-radius` | 自身对应边的尺寸 |
| `translate` 的 `%` | **元素自身**的宽高 |

**`height: 100%` 不生效的原因**：父元素高度是 `auto`（由内容撑开），此时父高度不确定，百分比无处可依，退化为 `auto`。解决：给父级链路上每一级都设确定高度（`html, body, #app { height: 100% }`），或用 `100vh` / `100dvh`。

**视口单位**

| 单位 | 含义 |
|---|---|
| `vw` | 视口宽度的 1% |
| `vh` | 视口高度的 1% |
| `vmin` | `min(vw, vh)` 的 1%（短边） |
| `vmax` | `max(vw, vh)` 的 1%（长边） |
| `dvh` | **动态视口**高度（随地址栏收起/展开变化） |
| `svh` | **小视口**高度（地址栏展开时的最小高度） |
| `lvh` | **大视口**高度（地址栏收起时的最大高度） |

**`100vh` 的移动端坑**：iOS Safari / Android Chrome 的地址栏会动态收起展开，`100vh` 按**最大**视口计算，导致 `height: 100vh` 的页面出现滚动条或底部按钮被挡住。解法：

```css
.full { min-height: 100dvh; }              /* 现代首选 */
.full { min-height: 100vh; min-height: -webkit-fill-available; }  /* 兼容老 iOS */
```

**`vw` 的滚动条坑**：`100vw` 含滚动条宽度，在 Windows 上会出现横向滚动条。解法：`width: 100%` 或 `max-width: 100vw` 配合 `overflow-x: hidden`。

**字号单位**

| 单位 | 相对谁 | 特点 |
|---|---|---|
| `px` | 绝对单位 | 精确，不随用户字号缩放（无障碍上略差） |
| `em` | **自身** `font-size`（用在 `font-size` 上时相对**父级**） | 会级联累积，嵌套容易失控 |
| `rem` | **根元素** `html` 的 `font-size` | 可控、适合整体缩放与适配 |
| `%` | 父级字号 | 同 `em` 的级联问题 |

```css
html { font-size: 16px; }        /* 1rem = 16px */
.title { font-size: 1.5rem; }    /* 24px */
.icon { width: 2em; }            /* 相对自身字号 24px → 48px */
```

- `em` 的级联陷阱：`ul { font-size: 0.9em }` 嵌套三层后字号变成 `0.9³ ≈ 0.73`，越来越小。用 `rem` 避免。
- `rem` 做适配时要注意：改变根字号会影响所有用 `rem` 的尺寸，包括无障碍缩放（用户改浏览器字号时页面会整体放大/缩小）。

**其他单位（知道即可）**

- `ch`：`0` 字符的宽度，适合限制"多少字符宽"的文本容器。
- `ex`：小写 `x` 的高度，很少用。
- `fr`：grid 专用，表示剩余空间的份数。
- `deg/turn/s`：动画相关。

**选型建议**

- 布局尺寸：`px`（简单）或 `rem`（需要整体缩放）。
- 容器宽度：`%` + `max-width`。
- 全屏高度：`100dvh`。
- 字号：`rem` 为主，`clamp()` 做流式。
- 移动端适配：`vw`（详见 Q25）。

### 口述回答（约 85 秒）

> 本质区别是参照物不同。百分比是相对**父元素**，也就是包含块算的；`vh`、`vw` 是相对**视口**算的，`100vh` 永远是视口高度，跟父元素没有关系。
>
> 百分比有个关键点是"不同属性参照的维度不一样"，这是最容易错的：`width` 相对父宽度；`height` 相对父高度，但如果父级高度是 auto，百分比就失效，这是 `height: 100%` 不生效的根本原因；而 `padding` 和 `margin`，不管是上下还是左右，**都相对父元素的宽度**——这也是 `padding-top: 56.25%` 能做 16 比 9 占位盒的原理。
>
> `vh` 在移动端有个实际的坑：手机浏览器的地址栏会收起展开，`100vh` 是按最大视口算的，所以全屏页会多出一条滚动或者底部按钮被挡。现在有 `dvh`，动态视口单位，能跟着地址栏变化，推荐用 `100dvh`；老 iOS 可以用 `-webkit-fill-available` 兜底。
>
> 另外 `100vw` 是包含滚动条宽度的，PC 上可能产生横向滚动条，这种场景用 `100%` 更稳。
>
> 字号方面 `em` 相对自身字号，会级联累积，嵌套容易越变越小；`rem` 相对根元素，更适合做整体缩放和移动端适配。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| 为什么 `height: 100%` 不生效？ | 父级高度 auto，百分比无参照；需逐级设置确定高度或用 `100dvh` |
| 上下 `padding` 的百分比相对谁？ | 相对包含块**宽度**，不是高度 |
| `100vw` 为什么会有横向滚动条？ | 含滚动条宽度；用 `100%` 或 `overflow-x: hidden` |
| `em` 和 `rem` 怎么选？ | 组件内部局部缩放用 `em`，全局尺寸用 `rem`；避免深层嵌套的 `em` |
| `dvh` 兼容性？ | Safari 15.4+ / Chrome 108+，可用 `vh` 兜底覆盖 |
| `translate(-50%)` 相对谁？ | 相对元素自身宽高（不是父级），所以能实现居中 |
| `line-height: 1.5` 和 `150%` 的百分比相对谁？ | 无单位相对自身字号并按倍数继承；百分比相对自身字号但继承的是计算值 |
| `vw` 和 JS 的 `clientWidth` 一致吗？ | `vw` 含滚动条，`clientWidth` 不含 |

---

## Q24 · 移动端 1px 问题

> 合并原题：47、50（同一题的不同问法）

**一句话答案**：高清屏的 `devicePixelRatio`（DPR）是 2 或 3，CSS 里写 `1px` 会被渲染成 2~3 个物理像素，视觉上比设计稿粗。解决方案有：`transform: scaleY(0.5)` 伪元素方案（最通用）、`0.5px` 直接写（iOS 支持）、`box-shadow`/渐变模拟、以及构建时用 PostCSS 插件自动处理。

### 答题思路

1. 先解释**为什么会有这个问题**（CSS 像素 ≠ 物理像素，DPR 的存在）。
2. 给 4–5 种方案，每种说清原理和兼容性。
3. 给推荐结论（伪元素 + transform 是兼容性和效果最平衡的）。
4. 补一句"现在很多团队直接用 PostCSS 插件或 `vw` 方案统一处理"，体现工程视角。

### 核心要点

**问题根源**

- CSS 像素是逻辑像素，物理像素是屏幕真实发光点。`DPR = 物理像素 / CSS 像素`。
- iPhone 6/7/8 的 DPR = 2，iPhone Plus / X 及之后是 3。也就是 CSS 的 `1px` 会被铺成 2×2 或 3×3 个物理像素。
- 设计稿上的 1px 细线（如分割线、边框）在真机上看起来明显偏粗，视觉上不够精致。

**方案一：伪元素 + `transform: scaleY(0.5)`（最通用）**

```css
.hairline {
  position: relative;
}
.hairline::after {
  content: '';
  position: absolute;
  left: 0; bottom: 0;
  width: 100%;
  height: 1px;                      /* 先画 1px */
  background: #e5e5e5;
  transform: scaleY(0.5);           /* 再压成 0.5 个 CSS 像素 */
  transform-origin: 0 100%;         /* 从底部开始缩放，避免位移 */
}
```

- 优点：兼容性好（iOS 8+ / Android 4.4+），不受 DPR 限制（DPR=3 时理论上要 `0.333`，实践中 0.5 已足够）。
- 缺点：多一个伪元素；圆角边框不好处理；`transform` 会创建层叠上下文。
- 需要按 DPR 动态算缩放比例时：

```js
const dpr = window.devicePixelRatio || 1;
document.documentElement.style.setProperty('--hairline-scale', 1 / dpr);
```

```css
.hairline::after { transform: scaleY(var(--hairline-scale)); }
```

**方案二：直接写 `0.5px`**

```css
.border { border-bottom: 0.5px solid #e5e5e5; }
```

- iOS 8+ 支持（会渲染成 1 个物理像素）。
- **Android 部分机型不支持**，会把 0.5px 舍入成 0，边框直接消失——这是它的致命缺陷。
- 现在多数场景可用，但仍需兜底。

**方案三：`box-shadow`**

```css
.hairline { box-shadow: inset 0 -1px 0 0 #e5e5e5; }
/* 或更细 */
.hairline { box-shadow: 0 0 0 0.5px #e5e5e5; }
```

- 优点：不用伪元素，不影响布局。
- 缺点：不能单独控制某条边的圆角、和 `overflow: hidden` 有交互问题。

**方案四：背景渐变**

```css
.hairline {
  background-image: linear-gradient(180deg, #e5e5e5, #e5e5e5 50%, transparent 50%);
  background-size: 100% 1px;
  background-repeat: no-repeat;
  background-position: bottom;
}
```

优点是渲染清晰，缺点是颜色必须写死、不支持 `currentColor` 动态换色。

**方案五：viewport 缩放（`lib-flexible` 时代）**

```js
// 根据 DPR 动态设置 viewport 的 initial-scale
const scale = 1 / window.devicePixelRatio;
document.querySelector('meta[name=viewport]').setAttribute(
  'content', `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`
);
```

原理：把整个页面的 CSS 像素放大 DPR 倍，1px 就等于 1 个物理像素。缺点是影响整页缩放、禁止用户缩放（无障碍问题）、旋转屏幕后 DPR 变化要重算。**现在不推荐**（`amfe-flexible` 已停止维护）。

**方案六：构建时自动处理**

- `postcss-1px-hairline`、`postcss-px-to-viewport`（配 `minPixelValue`）、`postcss-write-svg`（用 SVG 生成 1px 边框，兼容性最好）。
- 团队规范层面：统一用 `@mixin hairline`，避免每个人各写一套。

**选型建议**

| 场景 | 推荐方案 |
|---|---|
| 普通分割线/边框 | 伪元素 + `scaleY(0.5)` |
| 简单场景、只跑 iOS | `0.5px` |
| 需要圆角的卡片边框 | `box-shadow` 或 SVG |
| 工程化统一 | PostCSS 插件 + mixin |

### 口述回答（约 80 秒）

> 问题的根源是 DPR。CSS 里的 1px 是逻辑像素，而 iPhone 的 DPR 是 2 或 3，所以一个 CSS 像素会被铺成 2 到 3 个物理像素，设计稿上很细的一条线，真机上看就明显粗了。
>
> 解决方案我常用的有四个。
>
> 第一个是伪元素加 `transform: scaleY(0.5)`。给元素加一个 `::after`，画一条 1px 高的线，再用 `scaleY(0.5)` 压成半个 CSS 像素，配合 `transform-origin` 固定在底部避免位置偏移。这个方案兼容性最好，iOS 和安卓都行，是我默认的选择，缺点是圆角边框不好处理。
>
> 第二个是直接写 `0.5px`，iOS 8 以上支持得很好，但部分安卓机型会把 0.5px 舍入成 0，边框直接消失，所以要么加兜底，要么只用在 iOS。
>
> 第三个是用 `box-shadow` 模拟，`0 0 0 0.5px` 或者 inset 阴影，不用额外元素，但圆角和 `overflow: hidden` 配合时会有问题。
>
> 第四个是背景渐变，`linear-gradient` 配 `background-size: 100% 1px`，渲染很清晰，但颜色写死了没法跟着主题变。
>
> 工程上我会把它抽成 mixin 或者用 PostCSS 插件统一处理，避免每个页面各写一套。viewport 缩放那套 `flexible` 方案现在已经不推荐了，因为要禁用用户缩放，无障碍上有问题，而且维护也停了。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| 为什么 `1px` 会变粗？ | CSS 像素按 DPR 映射到物理像素，1 CSS px = DPR² 个物理点 |
| `0.5px` 在安卓上为什么消失？ | 部分浏览器把亚像素舍入为 0 |
| `scaleY(0.5)` 为什么需要 `transform-origin`？ | 默认从中心缩放，会把线上下各缩一半导致偏移；设 `0 100%` 固定底部 |
| DPR 怎么获取？ | `window.devicePixelRatio`，注意旋转/投屏后可能变化 |
| 圆角边框的 1px 怎么做？ | SVG `postcss-write-svg`，或 `box-shadow` 配合 `border-radius` |
| 现在还需要处理 1px 吗？ | 需要。虽然部分浏览器已支持亚像素渲染，但安卓碎片化仍需兜底 |

---

## Q25 · 750px 设计稿的适配方案

> 合并原题：57（设计稿 750px 宽怎么处理）

**一句话答案**：核心是"**等比缩放**"——把设计稿上的 px 按比例映射到不同宽度的设备上。主流三种：① `rem` 方案（JS 动态设根字号，设计稿 px / 100 写 rem）；② `vw` 方案（PostCSS 把 px 转 vw，`1px = 100/750 vw`）；③ `scale` 整体缩放（适合活动页/第三方页面）。现在推荐 **vw**，因为它不需要 JS、不存在根字号跳变。

### 答题思路

1. 先讲清"为什么不能用固定 px"——750 设计稿是 iPhone 6 的 2 倍图，实际 CSS 宽度是 375。
2. 讲 rem 方案的完整推导（根字号 = 屏宽 / 7.5，1rem = 100 设计稿 px）。
3. 讲 vw 方案（更现代，无需 JS）。
4. 讲 scale 方案的适用场景和缺陷。
5. 讲落地细节：字体是否缩放、1px 怎么处理、大屏怎么办、`max-width` 限制。

### 核心要点

**前提认知**

- 750px 设计稿 = 375 CSS px 的 2 倍图（iPhone 6/7/8 的物理宽度 750，CSS 宽度 375）。
- 设计稿上的 `100px`，在 375 宽设备上应该显示为 `50px`，在 414 宽设备上是 `55.2px`——**等比缩放**。

**方案一：`rem` + 动态根字号（兼容性最好）**

约定：`1rem = 100px 设计稿`，方便口算（设计稿 24px → 0.24rem）。

```js
// 设计稿宽 750，则 1rem = 屏宽 / 7.5
function setRem() {
  const width = Math.min(document.documentElement.clientWidth, 750); // 大屏限制
  document.documentElement.style.fontSize = width / 7.5 + 'px';
}
setRem();
window.addEventListener('resize', setRem);
window.addEventListener('pageshow', (e) => { if (e.persisted) setRem(); });
```

- 375 宽设备：根字号 = 50px，`1rem = 50px`，设计稿 100px → `1rem` → 实际 50px ✓
- 414 宽设备：根字号 = 55.2px，等比放大 ✓
- 配合 `postcss-pxtorem`（`rootValue: 75`，即按 750 稿直接写 px，插件自动除以 75）可以不用手工换算。

> 注意：`rootValue: 75` 表示 1rem = 75px 设计稿；如果约定 1rem = 100px，则 `rootValue: 100` 且根字号 = `clientWidth / 7.5 * 1.333`。工程里两种约定都常见，关键是**根字号公式和 rootValue 必须匹配**。下面统一用"1rem = 100 设计稿 px"这套：根字号 = `clientWidth / 7.5`。

**方案二：`vw`（现代首选，无需 JS）**

```css
/* 750 设计稿：1px = 100/750 vw = 0.1333vw */
.box {
  width: 13.3333vw;    /* 设计稿 100px */
  font-size: 4vw;      /* 设计稿 30px */
}
```

配合 PostCSS 自动转换：

```js
// postcss.config.js
module.exports = {
  plugins: {
    'postcss-px-to-viewport': {
      viewportWidth: 750,        // 设计稿宽度
      unitPrecision: 5,
      viewportUnit: 'vw',
      selectorBlackList: ['.ignore'],  // 不改这些选择器
      minPixelValue: 1,          // 小于 1px 不转换（保护 1px 边框）
      mediaQuery: false,         // 媒体查询里的 px 不转
    },
  },
};
```

优点：

- 纯 CSS，不需要 JS 监听 `resize`，没有根字号计算的时序问题（首屏不会闪一下）。
- 浏览器原生支持，不受"最小字号 12px"限制（`rem` 方案里根字号可能小于 12px 被浏览器强制修正，导致误差）。

缺点：

- 大屏上会无限放大，需要配 `max-width` 或媒体查询兜底。
- 部分场景（如 `border: 1px`）不能转，需要 `minPixelValue` 或黑名单。

**方案三：`transform: scale` 整体缩放**

```js
const designWidth = 750;
const scale = document.documentElement.clientWidth / designWidth;
document.querySelector('#app').style.transform = `scale(${scale})`;
document.querySelector('#app').style.transformOrigin = '0 0';
document.querySelector('#app').style.width = designWidth + 'px';
```

- 优点：**零改造**，设计稿 px 直接照抄，适合活动页、H5 投放页、内嵌第三方页面。
- 缺点：整体缩放会让字体渲染变模糊（尤其非整数倍）、`fixed` 定位会跟着缩放失效、无法做响应式（不同设备布局完全一样，只是大小不同）。
- 适合"设计稿长图 + 强视觉"的营销页，不适合需要真响应的业务页面。

**方案四：媒体查询 + 百分比（老方案）**

按 320/375/414 几档写死字号和间距。维护成本高、档位之间体验断层，现在基本不用。

**落地细节（体现经验）**

1. **字体要不要跟随缩放**：正文建议设最小值（如 `font-size: max(14px, 0.28rem)`），否则小屏上字会小到看不清。
2. **1px 边框不参与缩放**：`minPixelValue: 1` 或单独写 `1px`，配合 Q24 的 hairline 方案。
3. **大屏兜底**：`max-width: 750px; margin: 0 auto`，或 `@media (min-width: 750px)` 切换到固定布局。
4. **横屏处理**：横屏时 `clientWidth` 变大，整体会被放大得离谱，通常横屏时按高度或固定值计算。
5. **`rem` 的根字号不要小于 12px**：Chrome 有最小字号限制，`font-size: 10px` 可能被强制为 12px，导致比例失真。用 `100px` 基准可以规避。
6. **`vw` 与滚动条**：`100vw` 含滚动条，移动端一般无滚动条，PC 调试时注意。

### 口述回答（约 90 秒）

> 750 设计稿本质是 iPhone 6 的 2 倍图，实际 CSS 宽度是 375，所以核心目标是**等比缩放**：设计稿上的 100px，在 375 宽设备上显示 50px，在 414 上显示 55.2px。
>
> 主流有三种做法。
>
> 第一种是 rem。用 JS 监听 resize，把根字号设成 `clientWidth / 7.5`，这样 1rem 就等于 100 个设计稿像素。375 的设备根字号是 50px，设计稿 100px 就写 1rem，实际渲染 50px。配合 `postcss-pxtorem` 可以照设计稿写 px，插件自动除。这个方案兼容性最好，但要跑 JS，首屏可能有一瞬间的字号跳变，而且根字号太小会被浏览器的最小字号限制影响。
>
> 第二种是 vw，现在我最推荐。1vw 是视口宽的 1%，750 稿上 1px 就是 `100/750 vw`，约 0.1333vw。用 `postcss-px-to-viewport` 配 `viewportWidth: 750` 自动转，纯 CSS 不需要 JS，也不受最小字号限制。要注意 `minPixelValue` 设成 1，别把 1px 边框也转了。
>
> 第三种是 `transform: scale`，整页按 `clientWidth / 750` 缩放。好处是零改造，设计稿 px 直接抄，适合活动页这种长图投放页；缺点是字体会模糊、fixed 定位会失效、完全没有响应式，只是整体放大缩小。
>
> 落地的时候还要补三件事：大屏要限制 `max-width` 或者切固定布局；正文设字号下限防止小屏看不清；1px 边框单独处理。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| 为什么 750 稿在 375 设备上是 1:2？ | 设计稿是 2 倍图，DPR=2，CSS 宽度 = 750/2 |
| `rem` 方案根字号怎么算？ | `clientWidth / 7.5`（约定 1rem = 100 设计稿 px）；公式和 `rootValue` 必须匹配 |
| `rem` 和 `vw` 怎么选？ | 新项目选 `vw`（无 JS、无跳变）；需兼容老 WebView 或要动态改根字号选 `rem` |
| `scale` 方案有什么致命问题？ | 字体模糊、`fixed` 失效、无真正响应式、`1px` 精度丢失 |
| 怎么处理大屏（iPad/PC）？ | `max-width` 限制 + 居中，或用媒体查询切换布局 |
| 设计稿 375 怎么办？ | `viewportWidth` 改 375，或 `clientWidth / 3.75`，比例关系不变 |
| 字体也跟着缩放会不会太大？ | 会，正文通常用 `clamp()` 或 `max()` 设下限 |

---

## Q26 · iOS 上 position: fixed 的问题

> 合并原题：32

**一句话答案**：iOS Safari 在软键盘弹出、页面滚动、以及在 `transform` 祖先内时，`fixed` 元素会错位、被顶起或直接失效。原因在于 iOS 的视口模型（键盘不改变 layout viewport）和 Safari 的滚动实现。常见解法是：整页用 flex 布局 + 内部滚动替代 `fixed`、监听 `focusin/focusout` 动态改 `absolute`、用 `visualViewport` API、或改成 `sticky`。

### 答题思路

1. 先说清三种典型表现（键盘顶起、滚动抖动、transform 祖先失效）。
2. 分别讲原因，重点是"iOS 软键盘不改变 layout viewport，但 fixed 会重新计算位置"。
3. 给 4–5 种解法，说明各自的代价。
4. 给推荐结论：现代项目优先用"整页 flex + 内部滚动"，从根上避开 `fixed`。

### 核心要点

**三种典型问题**

1. **软键盘弹起时，底部 `fixed` 按钮被顶到键盘上方**，或输入框被键盘遮住。iOS 的软键盘不改变 `layout viewport` 高度，但 Safari 会重新定位 `fixed` 元素，导致它"跟着键盘跑"。
2. **页面滚动时 `fixed` 元素抖动/漂移**，尤其在 `-webkit-overflow-scrolling: touch` 的滚动容器里，`fixed` 元素可能短暂消失或错位（iOS 的合成层滚动与 fixed 重绘不同步）。
3. **祖先有 `transform` / `filter` / `will-change` 时 `fixed` 直接失效**，变成相对该祖先定位（这一条在 Android 上也一样，属于规范行为，不是 iOS 独有）。

**原因归纳**

- iOS Safari 的 `fixed` 定位在滚动时依赖合成层的重定位，滚动惯性期间会出现短暂不同步。
- 软键盘弹出只改变 `visual viewport`，不改变 `layout viewport`，但 WebKit 对 fixed 元素的处理会参考可视区域，导致"被顶起"。
- 输入框聚焦时，Safari 会滚动页面把输入框带入视野，这个自动滚动会把 `fixed` 元素的参照系打乱。

**解决方案**

**方案一：整页 flex + 内部滚动（推荐，治本）**

```css
html, body, #app {
  height: 100%;
  overflow: hidden;         /* 页面本身不滚 */
}
.page {
  display: flex;
  flex-direction: column;
  height: 100dvh;
}
.page__header { flex: 0 0 auto; }
.page__body   { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.page__footer { flex: 0 0 auto; }   /* 底部栏不再需要 fixed */
```

用布局代替定位，底部栏天然贴在容器底部，键盘弹起时输入框在滚动容器内部，Safari 会把滚动容器滚到合适位置，不会出现 `fixed` 错位。

**方案二：`absolute` + 手动跟随滚动**

```css
.fixed-bottom {
  position: absolute;    /* 相对页面容器 */
  left: 0; right: 0; bottom: 0;
}
```

```js
// 页面滚动时同步更新位置（节流）
const footer = document.querySelector('.fixed-bottom');
window.addEventListener('scroll', () => {
  footer.style.transform = `translateY(${window.scrollY}px)`;
}, { passive: true });
```

代价：滚动时每帧改样式，性能一般；适合滚动不频繁的场景（如单个表单页）。

**方案三：监听键盘状态动态切换**

```js
const input = document.querySelector('input');
let originHeight = window.innerHeight;

input.addEventListener('focus', () => {
  // 键盘弹起，把 fixed 换成 static 或 absolute
  document.querySelector('.fixed-bottom').style.position = 'static';
});

input.addEventListener('blur', () => {
  setTimeout(() => {
    document.querySelector('.fixed-bottom').style.position = 'fixed';
  }, 100);
});

// 更稳的做法：监听 visualViewport 的 resize
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    const keyboardHeight = originHeight - window.visualViewport.height;
    console.log('键盘高度约', keyboardHeight);
  });
}
```

`visualViewport` API 是官方给的"键盘高度"方案，比监听 `window.innerHeight` 变化可靠（iOS 上 `innerHeight` 在键盘弹出时**不变**）。

**方案四：改用 `position: sticky`**

```css
.header {
  position: sticky;
  top: 0;
  z-index: 10;
}
```

`sticky` 在 iOS 上的滚动表现比 `fixed` 稳定，适合吸顶导航。注意父级不能 `overflow: hidden`、父级高度要足够。

**方案五：第三方库 / 原生能力**

- `ios-safe-area`、`fixed-position-employee` 这类库本质是方案二/三的封装。
- 用 `env(safe-area-inset-bottom)` 处理 iPhone 底部安全区：

```css
.footer {
  padding-bottom: env(safe-area-inset-bottom);
}
```

需要 `viewport-fit=cover` 配合。

**选型建议**

| 场景 | 推荐 |
|---|---|
| 移动端 H5 整页应用 | 方案一（flex + 内部滚动），从根上避免 |
| 只有底部一个按钮 + 输入框 | 方案三（`visualViewport` 监听） |
| 吸顶导航 | 方案四（`sticky`） |
| 老项目无法重构布局 | 方案二（`absolute` + 跟随滚动） |
| 老 iOS（< 13） | 方案五 + `-webkit-fill-available` 兜底 |

### 口述回答（约 85 秒）

> iOS 上 fixed 主要有三种表现。一是软键盘弹起时，底部的 fixed 按钮被顶到键盘上面，或者输入框被键盘挡住；二是页面滚动的时候 fixed 元素会抖动、甚至短暂消失，尤其是在容器滚动里；三是祖先有 `transform` 或者 `will-change` 的时候，fixed 直接失效，变成相对祖先定位——这一条其实是规范行为，安卓也一样。
>
> 根本原因是 iOS 的视口模型。软键盘弹出只改变 visual viewport，不改变 layout viewport，但 WebKit 对 fixed 元素的定位会参考可视区域，所以看起来像被顶起来了。滚动那条则是合成层滚动和 fixed 重定位不同步导致的。
>
> 解法上我优先从布局上治本：整页用 flex 布局，`html, body` 设 `height: 100%; overflow: hidden`，页面内部用 `overflow-y: auto` 的容器滚动，底部栏就是一个普通的 flex 子项，根本不用 fixed。这样键盘弹起时是容器内部滚动，不会错位。
>
> 如果必须用定位，可以用 absolute 加监听 scroll 同步位移，或者监听 focusin、focusout 把 fixed 临时换回 static。现在更规范的是用 `visualViewport` API，它能拿到键盘高度，比监听 `innerHeight` 可靠，因为 iOS 上键盘弹起时 `innerHeight` 是不变的。
>
> 吸顶导航我更倾向用 `position: sticky`，它在 iOS 上稳定性比 fixed 好，另外底部栏记得加 `env(safe-area-inset-bottom)` 处理安全区。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| 为什么键盘弹起 fixed 会跑？ | 键盘只改变 visual viewport，fixed 定位受可视区影响 |
| `visualViewport` 能干什么？ | 拿键盘高度、缩放比例、可视区偏移，做输入框跟随 |
| `100vh` 在这里也有问题吗？ | 有，地址栏动态变化，用 `100dvh` 或 `-webkit-fill-available` |
| 为什么祖先有 `transform` 会让 fixed 失效？ | `transform` 创建包含块，fixed 后代改为相对它定位 |
| 安全区怎么处理？ | `viewport-fit=cover` + `env(safe-area-inset-bottom)` |
| 整页 flex 布局有什么代价？ | 页面无法整体滚动，需要处理内部滚动容器的滚动位置恢复（如路由切换） |
| 有没有纯 CSS 的解法？ | 没有可靠方案，这是 Safari 的实现问题，只能靠布局规避或 JS 兜底 |

---

## 本主题自测

1. 响应式的五个组成部分是什么？为什么移动优先更好？
2. `100vh` 在 iOS 上会怎样？用什么单位替代？
3. 上下 `padding: 10%` 的高度是多少？为什么？
4. 1px 问题有几种解法？`0.5px` 在安卓上为什么消失？
5. 750 设计稿的 rem 方案，根字号公式怎么写？
6. iOS 上 fixed 被键盘顶起，给出两种解法及代价。
