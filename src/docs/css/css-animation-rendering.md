# CSS · 06 动画与渲染性能

> 覆盖原题：34、44、54 —— transition / animation / transform、CSS 与 JS 动画取舍、渲染属性与性能

---

## 目录

- [本主题速查](#本主题速查)
- [Q27 · CSS3 动画体系](#q27--css3-动画体系)
- [Q28 · CSS 动画与 JS 动画的取舍](#q28--css-动画与-js-动画的取舍)
- [Q29 · 渲染相关属性与性能优化](#q29--渲染相关属性与性能优化)
- [本主题自测](#本主题自测)

---

## 本主题速查

| 编号 | 主题 | 核心结论 |
|---|---|---|
| Q27 | CSS3 动画体系 | `transition` 管状态过渡，`animation` 管关键帧，`transform` 管几何变换 |
| Q28 | CSS 与 JS 动画取舍 | 差异在控制力与调度方式，不在"谁一定更快" |
| Q29 | 渲染属性与性能优化 | 先判断改动落在 layout / paint / composite 哪一步 |

---

## Q27 · CSS3 动画体系

**一句话答案**：`transition` 做状态间过渡（需属性值变化触发），`animation` + `@keyframes` 做可循环的多关键帧动画，`transform` 做几何变换且不改变布局。

### 核心要点（Q27）

**一、`transition`（过渡）**

```css
.btn {
  transition: background-color 0.2s ease-in-out 0.1s;
  /*          属性            时长  缓动        延迟 */
}
.btn:hover { background-color: #4c8dff; }
```

- 五个长写属性：`transition-property`、`transition-duration`、`transition-timing-function`、`transition-delay`，以及控制离散属性的 `transition-behavior`。
- 必须有状态变化（`:hover`、class 切换、JS 改样式）才触发；不能自动循环，也不能多段。
- `transition: all 0.3s` 会匹配所有可过渡属性，任何属性变化都进入过渡，应显式列出需要过渡的属性。
- 可过渡的是可插值属性（数值、颜色、`transform` 等）；`display` 是离散属性，默认没有中间态。`transition-behavior: allow-discrete` 可让离散属性参与过渡；`display` 的显隐切换还需配合 `@starting-style` 提供起始样式。
- 事件：`transitionend`（每个完成过渡的属性各触发一次）、`transitionstart`、`transitioncancel`。

**二、`animation` + `@keyframes`（关键帧动画）**

```css
@keyframes slide-in {
  0%   { transform: translateX(-100%); opacity: 0; }
  60%  { transform: translateX(10%); }
  100% { transform: translateX(0);    opacity: 1; }
}

.toast {
  animation: slide-in 0.4s cubic-bezier(.22,1,.36,1) 0.1s 1 normal both;
  /*        名称     时长  缓动函数               延迟 次数 方向 填充模式 */
}
```

| 属性 | 常用值 | 说明 |
|---|---|---|
| `animation-name` | `slide-in` | 对应 `@keyframes` 名 |
| `animation-duration` | `0.4s` | 一次循环时长 |
| `animation-timing-function` | `ease` / `linear` / `cubic-bezier()` / `steps(6)` | 缓动或分步函数 |
| `animation-delay` | `0.1s` / `-0.1s` | 负值表示从中间开始 |
| `animation-iteration-count` | `1` / `infinite` | 循环次数 |
| `animation-direction` | `normal` / `reverse` / `alternate` / `alternate-reverse` | 正放/反放/往返 |
| `animation-fill-mode` | `none` / `forwards` / `backwards` / `both` | 动画外是否应用起止帧样式 |
| `animation-play-state` | `running` / `paused` | 暂停/继续 |

- `animation-fill-mode: forwards` 让动画停在最后一帧；`none` 在结束后回到初始样式。实测位移动画结束后，`forwards` 的计算值为 `matrix(1, 0, 0, 1, 100, 0)`，`none` 为 `none`。
- `animation-play-state: paused` 可直接暂停，`Animation.currentTime` 停止推进。
- 事件：`animationstart`、`animationend`、`animationiteration`。
- 重新触发动画：移除 class → 强制 reflow（读 `el.offsetHeight`）→ 重新加 class。

**三、`transform`（变换）**

```css
.box {
  transform: translate(10px, 20px) rotate(45deg) scale(1.2) skewX(10deg);
  transform-origin: center;   /* 变换原点，默认元素中心 */
}
```

- 四类函数：`translate`、`rotate`、`scale`、`skew`，以及 3D 的 `translate3d`、`rotateY`、`perspective`。
- 不改变布局盒的尺寸和位置，因此不会触发 layout；是否触发 paint、能否交给合成线程取决于合成条件（见 Q29）。这是 `transform` 动画成本低的原因。
- 多个函数从右往左应用（矩阵乘法顺序），顺序不同结果不同。
- `translate` 的百分比相对元素自身尺寸。实测 100px 宽元素 `translateX(50%)` 的计算值为 `matrix(1, 0, 0, 1, 50, 0)`。
- `transform` 会创建层叠上下文和包含块，影响 `fixed`/`absolute` 后代定位（见 Q13）。

**四、缓动函数与帧动画**

- `linear` 匀速；`ease` 默认（先快后慢）；`ease-in-out` 两端慢。
- `cubic-bezier(x1,y1,x2,y2)` 自定义曲线，y 可以超过 1 做"回弹"效果。
- `steps(n, end)` 分步动画，用于精灵图帧动画：

```css
.sprite {
  width: 100px; height: 100px;
  background: url(sprite.png) no-repeat;
  animation: walk 0.8s steps(8) infinite;
}
@keyframes walk {
  to { background-position: -800px 0; }
}
```

**五、`transition` 与 `animation` 对比**

| 维度 | `transition` | `animation` |
|---|---|---|
| 触发 | 必须有属性值变化 | 自动播放（或 class 切换） |
| 关键帧 | 只有起止两帧 | 任意多个 |
| 循环 | 不支持 | 支持 `infinite` |
| 方向控制 | 无 | `alternate` 往返 |
| 暂停 | 无 | `animation-play-state` |
| 终态保持 | 天然保持（元素就是新状态） | 需要 `fill-mode: forwards` |
| 适用 | 交互反馈（hover、展开） | 入场动画、loading、循环动效 |

**六、工程实践与无障碍**

```css
/* 尊重系统"减少动态效果"设置 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- 关键动画可用 `will-change: transform` 提前提示提升为合成层，动画结束后移除，使用纪律见 Q29。
- 列表入场用 `animation-delay` 做交错（stagger），避免最后一项等待过久。
- WAAPI：`el.animate(keyframes, options)` 返回 `Animation`，支持 `pause()`、`reverse()`、`currentTime`；可合成属性同样有机会走合成线程。

### 追问（Q27）

| 追问 | 回答 |
|---|---|
| `transition` 能作用于 `display: none` 吗？ | 默认不能，离散属性无中间态；`transition-behavior: allow-discrete` 可让显隐切换，配合 `@starting-style` 处理入场首帧 |
| `animation-fill-mode` 四个值区别？ | `none` 不保留、`forwards` 保留终态、`backwards` 在延迟期间应用起始态、`both` 两者都 |
| 动画结束后元素跳回初始状态怎么办？ | `animation-fill-mode: forwards`，或动画结束后用 JS 加终态 class |
| 如何重新触发一个 CSS 动画？ | 移除 class → 强制 reflow（读 `offsetHeight`）→ 重新加 class |
| `steps()` 用在哪？ | 分步动画，如精灵图帧动画、打字机效果 |
| `cubic-bezier` 的 y 能超过 1 吗？ | 能，用于回弹/超调（如 `cubic-bezier(.34,1.56,.64,1)`） |

---

## Q28 · CSS 动画与 JS 动画的取舍

**一句话答案**：CSS 动画声明式、代码少，满足合成条件时可脱离主线程；JS 动画控制力强，但要用 `requestAnimationFrame` 自己调度。取舍看控制力、数据依赖和编排复杂度，而不是"CSS 一定比 JS 快"。

### 核心要点（Q28）

**对比**

| 维度 | CSS 动画 | JS 动画 |
|---|---|---|
| 执行线程 | `transform`/`opacity` 动画满足条件时由合成线程驱动，主线程长任务不阻塞它 | 回调在主线程的 `rAF` 中执行，主线程被长任务占用就掉帧 |
| 控制力 | 弱：暂停/调速/反向/进度回调能力有限 | 强：可任意控制时间、进度、条件分支 |
| 数据驱动 | 差：动态参数要改 CSS 变量或重写 keyframes | 强：直接读业务数据 |
| 复杂编排 | 差：多元素交错、依赖链难写 | 强：时间轴、Promise 串行 |
| 与交互耦合 | 声明式，靠 class 切换 | 命令式，逻辑集中 |
| 调试 | DevTools Animations 面板可调速度 | 断点调试，需自己打日志 |
| 代码量 | 少（几行 CSS） | 多（需封装缓动、帧循环） |

**性能差异的原因**

- CSS 动画的 `transform`/`opacity` 在满足合成条件时可跳过 layout 和 paint，由合成线程驱动；布局/绘制属性的 CSS 动画仍然占用主线程。
- JS 动画在 `rAF` 回调里改 `width`、`top`、`margin`，每帧都可能触发 layout + paint；主线程被长任务阻塞时直接丢帧。
- JS 只改 `transform`/`opacity` 时同样可以合成，性能与 CSS 相当。准确说法是"JS 动画更容易写错"，不是"JS 动画一定慢"。

**CSS 动画的边界**

1. 关键帧静态，运行时数据只能通过 CSS 变量注入，且变量不能用在 `@keyframes` 的所有位置。
2. 播放进度只能靠负 `animation-delay` 粗略跳转，无法精确 seek。
3. 无法在动画中途根据条件改变路径。
4. 物理动画（弹簧、惯性）需要 JS 计算，CSS 只能用 `cubic-bezier` 近似。
5. 多段动画的串行/依赖只能靠 `animation-delay` 拼，难维护。

**JS 动画的正确写法**

```js
function animate(el, from, to, duration, easing = t => t) {
  const start = performance.now();
  function frame(now) {
    const p = Math.min((now - start) / duration, 1);
    const v = from + (to - from) * easing(p);
    el.style.transform = `translateX(${v}px)`;   // 只改 transform
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
```

- 用 `rAF` 而非 `setInterval`：与屏幕刷新同步、后台标签页自动暂停、时间戳更精确。
- 只改 `transform`/`opacity`；用 `performance.now()` 计算进度。
- 避免在帧内读写布局属性，否则会造成 layout thrashing。

**选型清单**

| 场景 | 推荐 |
|---|---|
| hover、聚焦、展开收起、颜色过渡 | CSS `transition` |
| 入场/退场、loading、骨架屏 | CSS `@keyframes` |
| 需要暂停/反向/进度条、依赖滚动位置 | JS + `rAF`（或 WAAPI） |
| 复杂时间轴、多元素编排、物理效果 | JS 库（GSAP、anime.js） |
| 需要与 CSS 动画共存、要精确控制 | WAAPI（`element.animate()`） |

**WAAPI：两者的融合**

```js
const anim = el.animate(
  [{ transform: 'translateX(-100%)' }, { transform: 'translateX(0)' }],
  { duration: 400, easing: 'ease-out', fill: 'forwards' }
);
anim.pause();
anim.reverse();
anim.currentTime = 200;
```

WAAPI 用 JS 拿到控制力，可合成属性同样有机会走合成线程。

### 追问（Q28）

| 追问 | 回答 |
|---|---|
| 什么属性动画性能最差？ | `width`、`height`、`top`、`left`、`margin` 等触发 layout 的属性 |
| 为什么用 `rAF` 而不是 `setInterval`？ | 与屏幕刷新同步、后台标签页自动暂停、时间戳更精确 |
| 什么是 layout thrashing？ | 同一帧内交替读写布局属性，强制同步 layout |
| CSS 动画能做物理效果吗？ | 不能直接做，需要 JS 计算，或用 `cubic-bezier` 近似 |
| 动画卡顿怎么排查？ | Performance 面板看主线程长任务、Layout/Paint 耗时、是否强制同步布局 |

---

## Q29 · 渲染相关属性与性能优化

**一句话答案**：先判断属性改动落在渲染流水线的哪一步——layout（重排）、paint（重绘）还是 composite（合成），再用 `will-change`、`contain`、`content-visibility` 等属性缩小工作范围。

### 核心要点（Q29）

**渲染流水线**

```
DOM + CSSOM → 样式计算(Style) → 布局(Layout/Reflow) → 绘制(Paint) → 合成(Composite) → 屏幕
```

| 改动的属性 | 触发阶段 | 代价 |
|---|---|---|
| `width/height/padding/margin/top/left/font-size/display` | Layout + Paint + Composite | 最高（重排） |
| `color/background/border-color/box-shadow/visibility` | Paint + Composite | 中（重绘） |
| `transform/opacity/filter`（满足合成条件时） | Composite | 最低 |

"触发阶段"是可能路径，实际是否触发布局/绘制取决于元素状态和浏览器实现。

**`will-change`**

```css
.card { will-change: transform, opacity; }
```

- 作用：提前告知浏览器这些属性即将变化，浏览器可预先分配资源、将元素提升为合成层，减少动画起始时的抖动。
- 纪律：
  1. 只在动画开始前设，动画结束后移除；常驻会持续占用显存。
  2. 不要写在 `*` 上，避免大量元素同时提层（"层爆炸"）。
  3. 只写真正会变的属性，优先 `transform`、`opacity`。
- 副作用：`will-change: transform` 会创建层叠上下文和包含块，可能改变 `fixed`/`absolute` 后代的定位基准（见 Q13）。

**可能的提层条件**

- 3D 变换：`translateZ(0)`、`translate3d()`。
- `will-change: transform` / `will-change: opacity`：提示浏览器提前提层，实际是否提层由浏览器决定。
- 正在运行的 `transform` / `opacity` 动画：浏览器可能为动画元素单独提层，是否合成取决于实现。
- `filter` / `backdrop-filter`：会创建层叠上下文和包含块，也可能被单独合成。
- `backface-visibility: hidden` 曾被用作强制提层的技巧，现代浏览器不保证生效。

提层不是免费的：层数过多会增加显存和合成开销，不要用它替代性能分析。

**`contain`（渲染隔离）**

```css
.widget { contain: layout paint; }
```

| 值 | 效果 |
|---|---|
| `layout` | 内部布局与外部隔离：外部变化不引起内部重排，内部变化不影响外部布局 |
| `paint` | 内部绘制不溢出边界，创建独立格式化上下文、层叠上下文和包含块 |
| `size` | 元素尺寸不受内容影响（必须显式设尺寸，否则塌陷） |
| `style` | 计数器和 quote 作用域隔离 |
| `strict` | 等价于 `size layout paint style` |
| `content` | 等价于 `layout paint style`（不含 `size`） |

作用：缩小 layout / paint 的影响范围，适合表格、虚拟列表项等独立组件。

**`content-visibility`（跳过屏幕外渲染）**

```css
.list-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 80px;   /* 预估尺寸，防止滚动条跳动 */
}
```

- `auto`：元素在视口外时跳过子树的布局、绘制，进入视口再渲染。
- 必须配 `contain-intrinsic-size`，否则未渲染时尺寸为 0，滚动条长度会跳变。
- 屏幕外子树未渲染时，依赖渲染结果的能力（如部分查找、锚点定位、`getBoundingClientRect`）会受影响。

**`filter` / `backdrop-filter`**

```css
.blur { filter: blur(8px); }
.glass {
  backdrop-filter: blur(12px) saturate(180%);
  background: rgba(255,255,255,.6);
}
```

- 都会创建层叠上下文和包含块，且是开销较大的绘制操作，`blur` 半径和面积越大越明显。
- `backdrop-filter` 在低端移动设备上更容易掉帧，避免大面积使用。
- 可与 `will-change: filter` 配合，但同样受显存约束。

**其他相关属性**

| 属性 | 作用 | 提示 |
|---|---|---|
| `isolation: isolate` | 显式创建层叠上下文 | 用于隔离 `mix-blend-mode`、明确层级边界 |
| `clip-path` | 裁切元素 | 可动画（做展开/揭示效果），会创建层叠上下文 |
| `backface-visibility: hidden` | 隐藏元素背面 | 曾作为强制提升合成层的技巧，不保证生效 |
| `mix-blend-mode` | 混合模式 | 创建层叠上下文，开销较大 |
| `image-rendering` | 图片缩放算法 | `pixelated` 用于像素图/二维码 |
| `perspective` | 3D 透视 | 创建包含块和层叠上下文 |
| `scroll-behavior: smooth` | 平滑滚动 | 实现简单，但无法细控（复杂场景用 JS） |

**优化清单**

1. 动画只改 `transform` / `opacity`，避免 `top`/`left`/`width`。
2. 长列表用虚拟滚动，配合 `content-visibility: auto` + `contain-intrinsic-size`。
3. 少用 `box-shadow` 动画，改用 `opacity` 叠加或 `filter: drop-shadow`。
4. 不要给大量元素加 `will-change` / `translate3d(0)`，避免层爆炸。
5. 用 `contain` 隔离独立组件；用 Performance 面板确认瓶颈，不凭感觉优化。

### 追问（Q29）

| 追问 | 回答 |
|---|---|
| 重排和重绘的区别？ | 重排是几何变化导致重新计算布局；重绘只重画像素，不改布局 |
| `translateZ(0)` 和 `will-change: transform` 区别？ | 前者直接写 3D 变换，通常立即触发提层；后者是提示，浏览器可自行决定时机 |
| 什么是层爆炸？ | 过多元素被提升为合成层，显存和合成开销过高 |
| 怎么定位性能问题？ | Performance 面板录制 → 看 Layout/Paint 耗时 → 找强制同步布局 |

---

## 本主题自测

1. `transition` 和 `animation` 的本质差异。
2. `transform` / `opacity` 动画在满足合成条件时跳过了哪两步？
3. JS 动画一定比 CSS 慢吗？为什么？
4. `will-change` 的三条使用纪律。
5. `content-visibility: auto` 必须配什么属性？为什么？
