# CSS · 06 动画与渲染性能

> 覆盖原题：34、44、54
> 合并后 3 个知识点 ｜ 重要度 ★★★ ｜ 建议时长 40 分钟

---

## 目录

- [本主题速查](#本主题速查)
- [Q27 · CSS3 动画体系](#q27--css3-动画体系)
- [Q28 · CSS 动画与 JS 动画的取舍](#q28--css-动画与-js-动画的取舍)
- [Q29 · 渲染相关属性与性能优化](#q29--渲染相关属性与性能优化)
- [本主题自测](#本主题自测)

---

## 本主题速查

| 编号 | 知识点 | 合并自 |
|---|---|---|
| Q27 | CSS3 动画体系：transition / animation / transform | 54 |
| Q28 | CSS 动画与 JS 动画的取舍 | 34 |
| Q29 | 渲染相关属性与性能优化 | 44 |

一句话主线：**"能不能动"是 transition/animation 的事，"动得好不好看"是 transform 的事，"动得卡不卡"是合成层的事。** 这三层能分开讲，这道题就答透了。

---

## Q27 · CSS3 动画体系

> 合并原题：54（你了解 css3 动画吗）

**一句话答案**：CSS3 动画由三部分组成——`transition` 做**状态间过渡**（必须有属性值变化触发，不能循环）、`animation` + `@keyframes` 做**关键帧动画**（可自动播放、可循环、可多段控制）、`transform` 做**几何变换**（位移/旋转/缩放/倾斜，不触发重排，是动画性能的关键）。三者常配合使用。

### 答题思路

1. 先分清 `transition` 和 `animation` 的本质差异（触发方式、能否循环、关键帧数量）。
2. 讲 `transform` 为什么是"性能友好"的（不影响布局，可走合成）。
3. 给一组常用参数速查表。
4. 补工程细节：`animation-fill-mode`、`will-change`、`prefers-reduced-motion`、`steps()` 帧动画。
5. 提 WAAPI 作为现代补充。

### 核心要点

**一、`transition`（过渡）**

```css
.btn {
  transition: background-color 0.2s ease-in-out 0.1s;
  /*          属性            时长  缓动        延迟 */
}
.btn:hover { background-color: #4c8dff; }
```

- 四个子属性：`transition-property`、`transition-duration`、`transition-timing-function`、`transition-delay`。
- **必须有状态变化**（`:hover`、class 切换、JS 改样式）才触发，不能自动循环、不能多段。
- `transition: all 0.3s` 性能差（会监听所有属性变化），要用具体属性。
- 可动画的属性：数值类（宽高、颜色、透明度、`transform`）；不可动画的：`display`（离散属性，从 none 到 block 无中间态）、`background-image`（渐变除外）。
- 事件：`transitionend`（注意会为每个属性各触发一次）、`transitionstart`、`transitioncancel`。

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

八个子属性：

| 属性 | 常用值 | 说明 |
|---|---|---|
| `animation-name` | `slide-in` | 对应 `@keyframes` 名 |
| `animation-duration` | `0.4s` | 一次循环时长 |
| `animation-timing-function` | `ease` / `linear` / `cubic-bezier()` / `steps(6)` | 缓动曲线 |
| `animation-delay` | `0.1s` / `-0.1s` | 负值表示从中间开始 |
| `animation-iteration-count` | `1` / `infinite` | 循环次数 |
| `animation-direction` | `normal` / `reverse` / `alternate` / `alternate-reverse` | 往返播放 |
| `animation-fill-mode` | `none` / `forwards` / `backwards` / `both` | **动画结束后是否保留终态** |
| `animation-play-state` | `running` / `paused` | 暂停/继续 |

- `animation-fill-mode: forwards` 是最常用的：让动画停在最后一帧，否则结束瞬间会跳回初始状态。
- `animation-play-state: paused` 可实现 hover 暂停（比 JS 简单）。
- 事件：`animationstart`、`animationend`、`animationiteration`。
- **重新触发动画**的技巧：先移除 class，强制 reflow（`el.offsetHeight`），再加 class。

**三、`transform`（变换）**

```css
.box {
  transform: translate(10px, 20px) rotate(45deg) scale(1.2) skewX(10deg);
  transform-origin: center;   /* 变换原点，默认元素中心 */
}
```

- 四类函数：`translate`（位移）、`rotate`（旋转）、`scale`（缩放）、`skew`（倾斜），以及 3D 的 `translate3d`、`rotateY`、`perspective`。
- **不影响文档流**：变换发生在绘制之后，不触发重排（layout），通常也不触发重绘（paint），可以直接走合成（composite）——这是它性能好的根本原因。
- 多个函数**从右往左**应用（矩阵乘法顺序），顺序不同结果完全不同。
- `translate` 的百分比相对**元素自身**尺寸。
- `transform` 会创建**层叠上下文**和**包含块**（影响 `fixed` 和 `absolute` 后代，见 Q13）。

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

- 关键动画用 `will-change: transform` 提前提升图层，动画结束后移除（见 Q29）。
- 列表入场动画用 `animation-delay` 做交错（stagger），注意别让最后一项等太久。
- WAAPI（Web Animations API）可以用 JS 控制 CSS 动画：`el.animate(keyframes, options)`，返回 `Animation` 对象，支持 `pause()`、`reverse()`、`currentTime`。

### 口述回答（约 85 秒）

> CSS3 动画我按三块讲：transition、animation、transform。
>
> transition 是过渡，必须有属性值变化才触发，比如 hover 或者切 class。它只有起止两个状态，不能循环，适合做交互反馈，比如按钮变色、菜单展开。它有四个参数：属性、时长、缓动函数、延迟。要注意别写 `transition: all`，性能差，要指定具体属性。
>
> animation 是关键帧动画，配合 `@keyframes` 可以定义任意多个节点，支持自动播放、循环、往返、暂停。八个参数里最容易被忘的是 `animation-fill-mode`，不设 `forwards` 的话动画结束会跳回初始状态。它适合入场动画、loading、循环动效。
>
> transform 是变换，位移、旋转、缩放、倾斜。它的关键价值是**不影响文档流**——变换发生在绘制之后，不触发重排，可以走 GPU 合成，所以是动画性能最好的一类属性。多个函数写在一起时是从右往左应用的，顺序不同结果完全不同。
>
> 实际做动效我一般这么组合：交互反馈用 transition 加 transform，复杂入场用 keyframes，帧动画用 `steps()` 配精灵图。另外会加 `prefers-reduced-motion` 媒体查询，尊重用户的"减少动态效果"设置，这是无障碍的一部分。现在也会用 WAAPI，`element.animate()`，能用 JS 拿到动画对象做暂停、反向、进度控制。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| `transition` 能作用于 `display: none` 吗？ | 不能，离散属性无中间态；用 `opacity` + `visibility` 替代，或用 `@starting-style`（新特性） |
| `animation-fill-mode` 四个值区别？ | `none` 不保留、`forwards` 保留终态、`backwards` 应用起始态（在延迟期间）、`both` 两者都 |
| 为什么 `transform` 性能好？ | 不触发布局和绘制，只需重新合成 |
| `translate` 的百分比相对谁？ | 元素自身宽高 |
| 动画结束后元素"跳回去"怎么办？ | `animation-fill-mode: forwards`，或动画结束后用 JS 加终态 class |
| 如何重新触发一个 CSS 动画？ | 移除 class → 强制 reflow（读 `offsetHeight`）→ 重新加 class |
| `steps()` 有什么用？ | 分步动画，做精灵图帧动画或"打字机"效果 |
| `cubic-bezier` 的 y 能超过 1 吗？ | 能，用于回弹/超调效果（如 `cubic-bezier(.34,1.56,.64,1)`） |

---

## Q28 · CSS 动画与 JS 动画的取舍

> 合并原题：34（css 动画和 js 动画的优缺点）

**一句话答案**：CSS 动画由浏览器在合成线程执行，性能好、代码声明式、适合简单交互；JS 动画控制力强（可暂停、变速、按数据驱动、复杂编排），但需要 `requestAnimationFrame` 自己调度，处理不当会掉帧。**实践中不是二选一**：简单交互用 CSS，复杂时间轴/依赖数据的用 JS（或 WAAPI/GSAP）。

### 答题思路

1. 先给结论："不是谁替代谁，看场景"。
2. 用一张表对比 6 个维度（性能、控制力、代码组织、与交互耦合、调试、适用场景）。
3. 解释性能差异的**真正原因**（合成线程 vs 主线程），不要只说"CSS 快"。
4. 给选型清单，最后提 WAAPI 作为融合方案。

### 核心要点

**对比表**

| 维度 | CSS 动画 | JS 动画 |
|---|---|---|
| 执行线程 | `transform`/`opacity` 动画可在**合成线程**执行，主线程卡顿不影响 | 依赖主线程（`rAF`），主线程被阻塞就掉帧 |
| 性能 | 好，浏览器可自动优化、提升合成层 | 取决于实现，改布局属性会触发重排 |
| 控制力 | 弱：难做精细的暂停/调速/反向/进度回调 | 强：可任意控制时间、进度、条件分支 |
| 数据驱动 | 差：动态参数要改 CSS 变量或重写 keyframes | 强：直接读业务数据 |
| 复杂编排 | 差：多元素交错、依赖链难写 | 强：时间轴、Promise 串行 |
| 与交互耦合 | 声明式，靠 class 切换 | 命令式，逻辑集中 |
| 调试 | DevTools 有 Animations 面板，可调速度 | 断点调试，需自己打日志 |
| 代码量 | 少（几行 CSS） | 多（需封装缓动、帧循环） |

**性能差异的真正原因**

- 现代浏览器渲染流水线：**样式计算 → 布局（layout）→ 绘制（paint）→ 合成（composite）**。
- 只改 `transform` 和 `opacity` 的动画，可以跳过布局和绘制，直接在合成线程处理，甚至不需要主线程参与（例如滚动驱动的动画）。
- JS 动画如果在 `rAF` 里改 `width`、`top`、`margin`，每帧都触发重排 + 重绘，主线程一旦被长任务阻塞，帧就丢了。
- **但 JS 动画不必然慢**：用 `rAF` + `transform` 同样能走合成，性能与 CSS 相当。所以"JS 动画性能差"是个不准确的结论，准确说法是"JS 动画更容易写错"。

**CSS 动画的局限（要能说出边界）**

1. 无法根据运行时数据动态生成关键帧（只能改 CSS 变量，且变量不能用在 `@keyframes` 的所有位置）。
2. 无法精确控制播放进度（`animation-delay` 取负值能"跳到中间"，但很笨）。
3. 无法在动画中途根据条件改变路径。
4. 无法方便地做物理动画（弹簧、惯性滚动）——需要 JS 计算。
5. 多个动画的串行/依赖关系要靠 `animation-delay` 硬凑，难维护。

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

要点：用 `rAF` 而非 `setInterval`；只改 `transform`/`opacity`；用 `performance.now()` 计算精确进度；避免在帧内读写布局属性（会造成 layout thrashing）。

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

它用 JS 拿到 CSS 动画的控制力，同时在合成线程执行——现代项目里是很好的中间选择。

### 口述回答（约 80 秒）

> 我的结论是这俩不是替代关系，看场景。
>
> 性能上，CSS 动画的优势在于 `transform` 和 `opacity` 这类属性可以跳过布局和绘制，直接在合成线程执行，主线程再卡也不影响它。JS 动画跑在主线程的 rAF 里，一旦有长任务阻塞就会掉帧。但要注意，"JS 动画性能差"这个说法不准确——JS 里只改 transform，同样能走合成，性能跟 CSS 差不多。真正的差别是 JS 更容易写错，比如在帧循环里读写布局属性，就会触发重排，造成 layout thrashing。
>
> 控制力上，JS 明显更强：可以随时暂停、变速、反向、读进度、根据业务数据动态生成轨迹，也能做复杂的多元素编排和时间轴。CSS 动画做不到这些，它的关键帧是静态的，多段动画串行只能靠 `animation-delay` 硬凑，很难维护。
>
> 所以我的选型是：交互反馈、入场动画、loading 这类简单动效用 CSS，代码少、性能好、不占主线程；需要精细控制、依赖数据或者复杂时间轴的用 JS，比如滚动驱动的视差、物理弹簧效果，通常会用 GSAP 这类库。
>
> 现在的第三个选择是 WAAPI，`element.animate()`，它用 JS 拿控制力，同时能走合成线程，算是两者的融合，新项目里我会优先考虑。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| 为什么 CSS 动画不阻塞主线程？ | `transform`/`opacity` 可在合成线程执行，不依赖主线程布局绘制 |
| 什么属性动画性能最差？ | `width`、`height`、`top`、`left`、`margin` 等触发重排的属性 |
| 为什么用 `rAF` 而不是 `setInterval`？ | 与屏幕刷新同步、后台标签页自动暂停、时间更精确 |
| 什么是 layout thrashing？ | 同一帧内交替读写布局属性，强制同步重排，性能急剧下降 |
| CSS 动画能做物理效果吗？ | 不能，需要 JS 计算（或用 `cubic-bezier` 近似） |
| 动画卡顿怎么排查？ | Performance 面板看主线程长任务、渲染层、是否触发布局/绘制 |
| `will-change` 能提升 JS 动画性能吗？ | 能，提前提升图层减少绘制，但滥用会吃显存 |

---

## Q29 · 渲染相关属性与性能优化

> 合并原题：44（你知道哪些渲染相关的 CSS 属性）

**一句话答案**：常用的是 `will-change`（提前告知浏览器将要变化的属性）、`transform` / `opacity`（走合成的高性能动画属性）、`contain`（隔离渲染范围）、`content-visibility`（跳过屏幕外内容的渲染）、`filter` / `backdrop-filter`（滤镜，较重）、`isolation`（创建层叠上下文）、`clip-path`（裁切）。理解这些属性的前提是清楚渲染流水线：样式 → 布局 → 绘制 → 合成。

### 答题思路

1. 先讲渲染流水线四步，并说明哪些属性触发哪一步（重排 / 重绘 / 只合成）。
2. 逐个讲属性：作用、原理、副作用。
3. 强调 `will-change` 的使用纪律（这是最容易答成"背属性"的地方）。
4. 给一组实战优化建议。

### 核心要点

**渲染流水线**

```
DOM + CSSOM → 样式计算(Style) → 布局(Layout/Reflow) → 绘制(Paint) → 合成(Composite) → 屏幕
```

| 改动的属性 | 触发阶段 | 代价 |
|---|---|---|
| `width/height/padding/margin/top/left/font-size/display` | 布局 + 绘制 + 合成 | 最高（重排） |
| `color/background/border-color/box-shadow/visibility` | 绘制 + 合成 | 中（重绘） |
| `transform/opacity/filter`（部分场景） | 仅合成 | 最低 |

**`will-change`**

```css
.card { will-change: transform, opacity; }
```

- 作用：提前告诉浏览器"这个元素的这些属性即将变化"，浏览器可以预先提升为合成层、预分配资源，减少动画开始时的抖动。
- **三条纪律**：
  1. **提前设、别滥用**：只在动画开始前设，动画结束后移除（或用 `:hover` 等状态限定）。常驻 `will-change` 会一直占着显存。
  2. **别写在 `*` 上**：会造成大量图层，显存爆炸（"层爆炸"）。
  3. **只写真正会变的属性**，且优先 `transform`、`opacity` 这两个便宜属性。
- 副作用：创建**层叠上下文**和**包含块**（影响 `fixed`/`absolute` 后代定位，见 Q13）——这是排查定位问题的隐性原因。

**`contain`（渲染隔离）**

```css
.widget { contain: layout paint; }
```

| 值 | 效果 |
|---|---|
| `layout` | 内部布局与外部隔离，外部变化不引起内部重排 |
| `paint` | 内部绘制不溢出边界（同时创建 BFC 和层叠上下文） |
| `size` | 元素尺寸不受内容影响（必须显式设尺寸，否则塌陷） |
| `style` | 计数器和 quote 作用域隔离 |
| `strict` | 等价于 `layout paint style` |
| `content` | 等价于 `layout paint style` + 尺寸隔离 |

作用：让浏览器知道"这块区域的内部变化不会影响外部"，从而缩小重排/重绘范围，对大型组件（表格、虚拟列表项）效果明显。

**`content-visibility`（跳过屏幕外渲染）**

```css
.list-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 80px;   /* 预估尺寸，防止滚动条跳动 */
}
```

- `auto`：元素在视口外时跳过其子树的样式、布局、绘制（"懒渲染"），进入视口再渲染。
- 效果：长列表/长文档首屏渲染时间大幅下降（官方数据可达数倍提升）。
- `contain-intrinsic-size` 必须配，否则滚动条长度会随渲染跳变。
- 注意：跳过渲染的内容无法被 `Ctrl+F` 找到（浏览器已在逐步改善），锚点定位也可能不准。

**`transform` 与 `opacity`**

已在 Q27/Q28 详述。补充两点：

- `transform` 触发合成层的条件：3D 变换（`translateZ(0)`、`translate3d`）、`will-change: transform`、`backface-visibility: hidden`、动画中。
- `opacity` 动画只在 0~1 之间走合成；`opacity: 0` 会创建层叠上下文。

**`filter` / `backdrop-filter`**

```css
.blur { filter: blur(8px); }
.glass {
  backdrop-filter: blur(12px) saturate(180%);
  background: rgba(255,255,255,.6);
}
```

- 会创建层叠上下文和包含块，且是**昂贵的绘制操作**（尤其 `blur` 大半径、大面积）。
- `backdrop-filter` 在移动端（尤其旧安卓）性能较差，谨慎大面积使用。
- 常和 `will-change: filter` 配合，但同样要注意显存。

**其他相关属性**

| 属性 | 作用 | 提示 |
|---|---|---|
| `isolation: isolate` | 显式创建层叠上下文 | 用于隔离 `mix-blend-mode`、明确层级边界 |
| `clip-path` | 裁切元素 | 可动画（做展开/揭示效果），会创建层叠上下文 |
| `backface-visibility: hidden` | 隐藏元素背面 | 常作为"强制提升合成层"的老技巧 |
| `mix-blend-mode` | 混合模式 | 创建层叠上下文，开销较大 |
| `image-rendering` | 图片缩放算法 | `pixelated` 用于像素图/二维码 |
| `perspective` | 3D 透视 | 创建包含块和层叠上下文 |
| `scroll-behavior: smooth` | 平滑滚动 | 实现简单，但无法细控（复杂场景用 JS） |

**实战优化清单**

1. 动画只用 `transform` / `opacity`，避免 `top`/`left`/`width`。
2. 长列表用虚拟滚动 + `content-visibility: auto`。
3. 少用 `box-shadow` 动画（每帧重绘），改用 `opacity` 叠加或 `filter: drop-shadow`。
4. 避免"层爆炸"：不要给大量元素加 `will-change`/`translate3d(0)`。
5. 用 `contain` 隔离独立组件（地图、富文本、看板卡片）。
6. 高频事件（`scroll`、`resize`）用 `passive: true` + 节流。
7. 用 Performance 面板验证，不要凭感觉优化。

### 口述回答（约 85 秒）

> 讲这些属性之前得先说渲染流水线：样式计算、布局、绘制、合成四步。改 `width`、`margin` 这类属性会触发重排，代价最高；改颜色、阴影触发重绘；而 `transform` 和 `opacity` 可以只走合成，代价最低。渲染相关的属性基本都是围绕"尽量减少前两步"设计的。
>
> 第一个是 `will-change`，提前告诉浏览器某个属性要变，浏览器可以预先把元素提升为合成层。但它有纪律：要提前设、动画结束就撤掉，绝不能写在 `*` 上，否则图层太多会爆显存。另外它会创建层叠上下文和包含块，经常是定位错位的隐藏原因。
>
> 第二个是 `contain`，做渲染隔离，告诉浏览器"这块内部变化不影响外面"，可以缩小重排重绘范围。常用 `layout paint`，用在独立组件上效果明显。
>
> 第三个是 `content-visibility: auto`，屏幕外的内容直接跳过样式、布局、绘制，长列表和长文档的首屏能快好几倍。必须配 `contain-intrinsic-size` 预估高度，否则滚动条会跳。
>
> 第四类是 `filter` 和 `backdrop-filter`，毛玻璃效果用的就是它，但它们是很贵的绘制操作，大面积用会掉帧，移动端要谨慎。
>
> 还有 `isolation: isolate` 用来显式创建层叠上下文，`clip-path` 做裁切和揭示动画，`backface-visibility` 是老的强制提层技巧。
>
> 实战里我会守住两条：动画只碰 transform 和 opacity；优化一定用 Performance 面板验证，不凭感觉。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| 重排和重绘的区别？ | 重排是几何变化导致重新计算布局；重绘只是像素重画，不改变布局 |
| 哪些属性只触发合成？ | `transform`、`opacity`（部分场景）、`filter`（提升为合成层后） |
| `will-change` 用久了会怎样？ | 长期占显存、图层不释放，反而变慢；动画结束要移除 |
| `contain: size` 有什么坑？ | 元素尺寸不再由内容决定，必须显式设尺寸，否则高度为 0 |
| `content-visibility` 有什么副作用？ | 屏幕外内容无法被查找、锚点跳转可能不准、`getBoundingClientRect` 需先渲染 |
| 什么是层爆炸？ | 过多元素被提升为合成层，显存耗尽导致卡顿甚至崩溃 |
| `translateZ(0)` 和 `will-change: transform` 区别？ | 前者立即提层且常驻，后者是"预告"，浏览器可自行决定时机 |
| 怎么定位性能问题？ | Performance 面板录制 → 看 Layout/Paint 耗时 → 找强制同步布局 |

---

## 本主题自测

1. `transition` 和 `animation` 的四个本质差异。
2. 为什么 `transform` 动画性能好？渲染流水线里跳过了哪两步？
3. JS 动画一定比 CSS 慢吗？为什么？
4. `will-change` 的三条使用纪律。
5. `content-visibility: auto` 必须配什么属性？为什么？
