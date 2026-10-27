# CSS · 05 响应式与移动端适配

> 覆盖原题：24、32、33、47、50、57 —— 合并为 5 个知识点

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

Q22 响应式 → Q23 单位 → Q24 1px → Q25 750 稿 → Q26 fixed。

五个问题共用一个判断顺序：**先确定参照系（视口 / 父级 / DPR），再选实现，最后说明副作用。**

---

## Q22 · 响应式布局的完整方案

> 合并原题：33（响应式布局怎么弄）

**一句话答案**：响应式的五件套是——① `<meta viewport>`；② 媒体查询（移动优先，`min-width` 递进）；③ 弹性布局（flex/grid + 百分比 + `max-width`）；④ 相对单位与流式排版（`rem` / `vw` / `clamp()`）；⑤ 响应式资源（`srcset` / `<picture>`）。组件级自适应再加容器查询 `@container`。

### 核心要点：响应式

**① viewport 声明（移动端的地基）**

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

- 不加这行，移动端按 980px 的虚拟视口渲染再整体缩放，媒体查询按 980 判定（Chrome 移动仿真可复现）。
- `viewport-fit=cover` 让页面铺到刘海区，`env(safe-area-inset-*)` 才拿得到安全区距离。

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

- **移动优先**（`min-width`）：基础样式给小屏，逐级增强；覆盖规则更少，移动端加载的样式也更少。
- **桌面优先**（`max-width`）：基础样式给大屏，逐级降级；老项目改造成本低，但移动端要写大量覆盖。
- 断点按内容断：把窗口拉窄，布局开始拥挤的那个宽度就是断点，不照抄框架。
- 媒体查询还能按 `prefers-color-scheme`、`prefers-reduced-motion`、`hover`、`orientation`、`resolution` 命中。

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

`repeat(auto-fit, minmax(240px, 1fr))` 是零媒体查询响应的核心写法：容器变宽时自动决定列数。

**④ 相对单位与流式排版**

```css
/* 字号随视口平滑变化，不再需要断点 */
.title { font-size: clamp(20px, 4vw, 32px); }

/* 间距也流式 */
.section { padding: clamp(16px, 5vw, 64px) 16px; }
```

`clamp(最小值, 理想值, 最大值)` 在区间内取理想值：`clamp(20px, 4vw, 32px)` 在 767px 视口取 `30.68px`，800px 起封顶 `32px`。

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

同一张卡片放在侧边栏（窄）和主区域（宽）会自动切换布局。**页面级布局用媒体查询，组件级自适应用容器查询。**

### 口述要点：五件套

- 先定参照系：页面级看视口（媒体查询），组件级看父容器（`@container`），尺寸参照父级用百分比。
- 断点按内容断，不按设备背：布局开始拥挤的宽度就是断点，用 `min-width` 从窄到宽叠加。
- 布局优先用 flex/grid 的自动换行与 `auto-fit`，比逐档写媒体查询少一半规则。
- 字号和间距用 `clamp()` 做连续变化，只有布局形态改变时才用媒体查询。
- 图片用 `srcset` / `sizes` 按宽度选源，`<picture>` 做艺术方向切换。

### 可能被追问：响应式

| 追问 | 回答要点 |
|---|---|
| `rem` 做断点有什么坑？ | 断点用 `rem` 会受根字号影响；用 `em` 还会受浏览器默认字号设置影响，断点建议用 `px` |
| `auto-fit` 和 `auto-fill` 区别？ | `auto-fill` 空列也占位保留，`auto-fit` 会折叠空列让已有元素拉伸填满 |
| 响应式图片一定要用 `srcset` 吗？ | 内容大图、移动端流量敏感时值得；小图标用 SVG 更划算 |
| 如何处理横竖屏？ | `@media (orientation: landscape)` 单独调布局；横屏可用高度小，避免把内容锁死在一屏 |

---

## Q23 · 单位体系：%、vh/vw、em/rem

> 合并原题：24（vh 和百分比的区别）

**一句话答案**：百分比是**相对父元素（包含块）**计算的，具体参照哪个维度取决于属性——`width` 相对父宽，`height` 相对父高（父高为 auto 时失效），`padding/margin` 无论方向都相对**父宽**；`vh/vw` 是**相对视口**的单位，`100vh` 等于大视口高度，与父元素无关。`em` 相对自身（或父级）字号，`rem` 相对根元素字号。

### 核心要点：单位

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

例如父宽 300px 时，`padding-top: 10%` 计算为 30px，与父高无关（Chrome 实测）。

**`height: 100%` 不生效的原因**：父元素高度是 `auto`（由内容撑开），此时父高度不确定，百分比无处可依，退化为 `auto`。解决：给父级链路上每一级都设确定高度（`html, body, #app { height: 100% }`），或用 `100dvh`（`100vh` 在移动端会被地址栏影响）。

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

**`100vh` 的移动端坑**：`vh` 按大视口（地址栏收起）计算，地址栏展开时 `height: 100vh` 的页面会多出滚动或底部按钮被挡。解法：

```css
.full { min-height: 100dvh; }              /* 现代首选 */
.full { min-height: 100vh; min-height: -webkit-fill-available; }  /* 兼容老 iOS */
```

**`vw` 的滚动条坑**：`100vw` 按视口算，不按内容区算；桌面端出现传统滚动条时可能产生横向滚动。用 `width: 100%` 或 `overflow-x: hidden` 规避。

**字号单位**

| 单位 | 相对谁 | 特点 |
|---|---|---|
| `px` | 绝对单位 | 精确，不随浏览器默认字号设置缩放（无障碍上略差） |
| `em` | **自身** `font-size`（用在 `font-size` 上时相对**父级**） | 会级联累积，嵌套容易失控 |
| `rem` | **根元素** `html` 的 `font-size` | 可控、适合整体缩放与适配 |
| `%` | 父级字号 | 同 `em` 的级联问题 |

```css
html { font-size: 16px; }        /* 1rem = 16px */
.title { font-size: 1.5rem; }    /* 24px */
.icon { width: 2em; }            /* 相对自身字号 24px → 48px */
```

- `em` 的级联陷阱：`ul { font-size: 0.9em }` 嵌套三层后字号变成 `0.9³ ≈ 0.73`，越来越小。用 `rem` 避免。
- 根字号写死 `px` 会切断用户的默认字号设置；需要保留无障碍缩放时，根字号用 `%` 或 `clamp()`。

**其他单位（知道即可）**

- `ch`：`0` 字符的宽度，适合限制"多少字符宽"的文本容器。
- `ex`：小写 `x` 的高度，很少用。
- `fr`：grid 专用，表示剩余空间的份数。
- `deg/turn/s`：动画相关。

**选型建议**

- 布局尺寸：`px`（简单）或 `rem`（需要整体缩放）。
- 容器宽度：`%` + `max-width`。
- 全屏高度：`100dvh`。
- 字号：`rem` 为主；组件内部局部缩放可用 `em`，避免深层嵌套。
- 移动端等比适配：`vw`（详见 Q25）。

### 口述要点：参照物

- 百分比看包含块，属性不同参照维度不同：`width` 看父宽，`height` 看父高（父高 auto 则失效），`padding/margin` 四向都看父宽。
- `vw/vh` 看视口，与父级无关；`vh` 按大视口算，全屏用 `100dvh` 才跟地址栏联动。
- `em` 相对自身字号并级联，`rem` 相对根字号不级联；组件内局部缩放用 `em`，全局用 `rem`。

### 可能被追问：单位

| 追问 | 回答要点 |
|---|---|
| `line-height: 1.5` 和 `150%` 的百分比相对谁？ | 无单位值按倍数继承；百分比相对自身字号，但继承的是计算值 |

---

## Q24 · 移动端 1px 问题

> 合并原题：47、50（同一题的不同问法）

**一句话答案**：`DPR = 物理像素 / CSS 像素`；1 CSS px 的边框在 DPR 为 2 或 3 的屏幕上占 2 或 3 个物理像素厚度，设计稿按物理像素标注的细线实现成 `1px` 就会偏粗。解决方案有：`transform: scaleY(0.5)` 伪元素（通用）、`0.5px`（仅部分浏览器支持）、`box-shadow` / 渐变模拟、构建时插件统一处理。

### 核心要点：1px

**问题根源**

- CSS 像素是逻辑像素，物理像素是屏幕发光点，`DPR = 物理像素 / CSS 像素`。
- 因此 `1px` 的线在 DPR=2 的屏幕上占 2 个物理像素厚度，在 DPR=3 上占 3 个；设计稿按 1 物理像素画的细线，实现成 `1px` 就会偏粗。
- 是否要处理取决于设计稿的标注方式：按 CSS px 标注的 1px 不需要 hairline，按物理像素标注的才需要。

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

- 优点：兼容性好，不依赖亚像素边框支持；缩放比例可按 `1/DPR` 算，实践中常用 0.5。
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

- Safari 对亚像素边框支持较好；部分安卓浏览器不支持，会把 0.5px 舍入到不可见，边框直接消失。
- 只能作为 iOS 或兜底方案，不能全量依赖。

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
// 根据 DPR 设置 initial-scale，把布局视口放大 DPR 倍
const scale = 1 / (window.devicePixelRatio || 1);
document.querySelector('meta[name=viewport]')?.setAttribute(
  'content',
  `initial-scale=${scale}, maximum-scale=${scale}, minimum-scale=${scale}, user-scalable=no, viewport-fit=cover`,
);
```

原理：布局视口放大 DPR 倍后，1 CSS px 对应 1 个物理像素。缺点是影响整页缩放、禁止用户缩放（无障碍问题）、DPR 变化要重算。**现在不推荐**（`amfe-flexible` 已停止维护）。

**方案六：构建时自动处理**

- `postcss-write-svg` 用 SVG 生成 1px 边框；`postcss-px-to-viewport` 配 `minPixelValue`，避免把 1px 转成 `vw`。
- 团队规范层面：统一用 `@mixin hairline`，避免每个人各写一套。

**选型建议**

| 场景 | 推荐方案 |
|---|---|
| 普通分割线/边框 | 伪元素 + `scaleY(0.5)` |
| 简单场景、只跑 iOS | `0.5px` |
| 需要圆角的卡片边框 | `box-shadow` 或 SVG |
| 工程化统一 | PostCSS 插件 + mixin |

### 口述要点：DPR 与方案

- 判断标准：设计稿按物理像素标注的细线才需要 hairline；按 CSS px 标注的 1px 直接用。
- 通用做法是伪元素画 1px 再 `scaleY(0.5)`，`transform-origin` 固定贴边一侧；圆角用 `box-shadow` 或 SVG。
- `0.5px` 最省事，但部分安卓浏览器会舍入到不可见；工程上抽 mixin 或 PostCSS 插件统一处理。

### 可能被追问：1px

| 追问 | 回答要点 |
|---|---|
| `scaleY(0.5)` 为什么需要 `transform-origin`？ | 默认从中心缩放，会把线上下各缩一半导致偏移；设 `0 100%` 固定底部 |
| DPR 怎么获取？ | `window.devicePixelRatio`，运行时读取，不要写死 2/3 |

---

## Q25 · 750px 设计稿的适配方案

> 合并原题：57（设计稿 750px 宽怎么处理）

**一句话答案**：核心是**等比缩放**——把设计稿上的 px 按比例映射到不同宽度的设备上。主流三种：① `rem` 方案（JS 动态设根字号，设计稿 px / 100 写 rem）；② `vw` 方案（PostCSS 把 px 转 vw，`1px = 100/750 vw`）；③ `scale` 整体缩放（适合活动页/第三方页面）。现在推荐 **vw**，因为它不需要 JS、不存在根字号跳变。

### 核心要点：750 稿

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
- 配合 `postcss-pxtorem` 时，`rootValue` 等于「1rem 对应多少个设计稿 px」：约定 1rem = 100 设计稿 px 就写 `rootValue: 100`，此时根字号 = `clientWidth / 7.5`；约定 1rem = 75 设计稿 px 则 `rootValue: 75`，根字号 = `clientWidth / 10`。两者必须匹配。

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
      minPixelValue: 1,          // ≤1px 不转换（保护 1px 边框）
      mediaQuery: false,         // 媒体查询里的 px 不转
    },
  },
};
```

优点：

- 纯 CSS，不需要 JS 监听 `resize`，没有根字号计算的时序问题（首屏不会闪一下）。
- 不依赖根字号，布局比例不会被浏览器的默认字号设置改变。

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
- 缺点：整体缩放会让字体渲染变模糊、`fixed` 定位会跟着缩放失效、无法做响应式（不同设备布局完全一样，只是大小不同）。
- 适合"设计稿长图 + 强视觉"的营销页，不适合需要真响应的业务页面。

**方案四：媒体查询 + 百分比（老方案）**

按 320/375/414 几档写死字号和间距。维护成本高、档位之间体验断层，现在基本不用。

**落地细节**

1. **字体要不要跟随缩放**：正文建议设最小值（如 `font-size: max(14px, 0.28rem)`），否则小屏上字会小到看不清。
2. **大屏兜底**：`max-width: 750px; margin: 0 auto`，或 `@media (min-width: 750px)` 切换到固定布局。
3. **横屏处理**：横屏时 `clientWidth` 变大，整体会被放大得离谱，通常横屏时按高度或固定值计算。

### 口述要点：等比缩放

- 750 稿是 2 倍图，目标是等比缩放：设计稿 100px 在 375 屏显示 50px、414 屏显示 55.2px。
- `vw` 是首选：设计稿 px × 100/750 得到 vw，用 `postcss-px-to-viewport` 自动转换，无需 JS。
- `rem` 需要 JS 设根字号：约定 1rem = 100 设计稿 px 时，根字号 = `clientWidth / 7.5`，`rootValue` 必须是 100。
- `transform: scale` 适合活动长图，代价是字体发虚、`fixed` 失效、布局不随设备改变；大屏要加 `max-width`。

### 可能被追问：750 稿

| 追问 | 回答要点 |
|---|---|
| `rem` 和 `vw` 怎么选？ | 新项目选 `vw`（无 JS、无跳变）；需兼容老 WebView 或要动态改根字号选 `rem` |
| 设计稿 375 怎么办？ | `viewportWidth` 改 375，或 `clientWidth / 3.75`，比例关系不变 |

---

## Q26 · iOS 上 position: fixed 的问题

> 合并原题：32

**一句话答案**：iOS Safari 在软键盘弹出、页面滚动、以及在 `transform` 祖先内时，`fixed` 元素会错位、被顶起或直接失效。原因在于 iOS 的视口模型（键盘只改变 `visual viewport`）和 Safari 的滚动实现。常见解法是：整页用 flex 布局 + 内部滚动替代 `fixed`、监听 `focus`/`blur` 动态改定位、用 `visualViewport` API、或改成 `sticky`。

### 核心要点：fixed

**三种典型问题**

1. **软键盘弹起时，底部 `fixed` 按钮被顶到键盘上方**，或输入框被键盘遮住。软键盘只缩小 `visual viewport`，不改变 `layout viewport`，而 `fixed` 依赖后者定位，于是和可见区域错位。
2. **页面滚动时 `fixed` 元素抖动/漂移**，尤其在滚动容器里，`fixed` 元素可能短暂消失或错位（合成层滚动与 `fixed` 重绘不同步）。
3. **祖先有 `transform` / `filter` / `will-change` 时 `fixed` 直接失效**，变成相对该祖先定位（这一条在 Android 上也一样，属于规范行为，不是 iOS 独有）。

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
.page__body   { flex: 1; overflow-y: auto; }
.page__footer { flex: 0 0 auto; }   /* 底部栏不再需要 fixed */
```

用布局代替定位，底部栏天然贴在容器底部，键盘弹起时输入框在滚动容器内部，不会出现 `fixed` 错位。

**方案二：`absolute` + 手动跟随滚动**

```css
.fixed-bottom {
  position: absolute;    /* 相对一个高度等于视口的容器 */
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

父容器必须是 `position: relative` 且高度等于视口；如果容器随文档一起增高，`bottom: 0` 会落到文档底部，方案失效。代价是滚动时每帧改样式，性能一般，适合滚动不频繁的单个表单页。

**方案三：监听键盘状态动态切换**

```js
const bar = document.querySelector('.fixed-bottom');
const input = document.querySelector('input');

input.addEventListener('focus', () => {
  // 键盘弹起，把 fixed 换成 static
  bar.style.position = 'static';
});

input.addEventListener('blur', () => {
  setTimeout(() => {
    bar.style.position = 'fixed';
  }, 100);   // 等键盘收起动画结束
});

// 更稳的做法：监听 visualViewport 的 resize
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    const keyboardHeight = window.innerHeight - window.visualViewport.height;
    console.log('键盘高度约', keyboardHeight);
  });
}
```

`visualViewport` 是官方给的"键盘高度"方案；键盘弹出时以 `visualViewport.height` 为准，`innerHeight` 在 iOS 上不能可靠反映键盘高度。

**方案四：改用 `position: sticky`**

```css
.header {
  position: sticky;
  top: 0;
  z-index: 10;
}
```

`sticky` 在 iOS 上的滚动表现比 `fixed` 稳定，适合吸顶导航。注意父级不能 `overflow: hidden`、父级高度要足够。

**选型建议**

| 场景 | 推荐 |
|---|---|
| 移动端 H5 整页应用 | 方案一（flex + 内部滚动），从根上避免 |
| 只有底部一个按钮 + 输入框 | 方案三（`visualViewport` 监听） |
| 吸顶导航 | 方案四（`sticky`） |
| 老项目无法重构布局 | 方案二（`absolute` + 跟随滚动） |

### 口述要点：布局替代定位

- 三种表现：键盘弹起底部 fixed 被顶起、滚动时 fixed 抖动、祖先有 transform/filter 时 fixed 改相对祖先定位（最后一条是规范行为，Android 同样）。
- 根因是 `fixed` 依赖视口定位，而 iOS 的 `layout viewport` 与 `visual viewport` 在键盘、滚动时不同步。
- 首选整页 flex + 内部滚动：`html/body` 锁高不滚，内容区 `overflow-y: auto`，底部栏变成普通 flex 子项。
- 必须保留 fixed 时，用 `visualViewport` 监听键盘或临时改 `absolute`；吸顶用 `sticky` 更稳。

### 可能被追问：fixed

| 追问 | 回答要点 |
|---|---|
| `visualViewport` 能干什么？ | 拿键盘高度、缩放比例、可视区偏移，做输入框跟随 |
| 整页 flex 布局有什么代价？ | 页面无法整体滚动，需要处理内部滚动容器的滚动位置恢复（如路由切换） |
| 有没有纯 CSS 的解法？ | 单靠 CSS 无法完全规避 Safari 的 fixed 行为，通常用布局规避或 JS 兜底 |

---

## 本主题自测

1. 响应式的五个组成部分是什么？为什么移动优先更好？
2. `100vh` 在移动端会怎样？用什么单位替代？
3. 上下 `padding: 10%` 的高度是多少？为什么？
4. 1px 问题有几种解法？`0.5px` 在部分安卓浏览器上为什么不可见？
5. 750 设计稿的 rem 方案，根字号公式怎么写？
6. iOS 上 fixed 被键盘顶起，给出两种解法及代价。
