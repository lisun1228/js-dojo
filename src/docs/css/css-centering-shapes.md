# CSS · 04 居中与常见图形效果

> 覆盖原题：2、6、9、10、15、16、18、25、43、45、46、51、56、58
> 合并后 6 个知识点 ｜ 重要度 ★★★★★ ｜ 建议时长 60 分钟

---

## 目录

- [本主题速查](#本主题速查)
- [Q16 · 水平 / 垂直 / 水平垂直居中全景](#q16--水平--垂直--水平垂直居中全景)
- [Q17 · margin: auto 为什么能居中](#q17--margin-auto-为什么能居中)
- [Q18 · CSS 画三角形与扇形](#q18--css-画三角形与扇形)
- [Q19 · 宽高比与"最大正方形"](#q19--宽高比与最大正方形)
- [Q20 · 单行 / 多行文本溢出省略号](#q20--单行--多行文本溢出省略号)
- [Q21 · 图片固定尺寸、保持比例、超出裁切](#q21--图片固定尺寸保持比例超出裁切)
- [本主题自测](#本主题自测)

---

## 本主题速查

| 编号 | 知识点 | 合并自 |
|---|---|---|
| Q16 | 水平 / 垂直 / 水平垂直居中全景 | 2、10、18、45、51、56、58（7 条合并） |
| Q17 | margin: auto 为什么能居中 | 6 |
| Q18 | CSS 画三角形与扇形 | 9、46 |
| Q19 | 宽高比与"最大正方形" | 25、43 |
| Q20 | 单行 / 多行文本溢出省略号 | 15 |
| Q21 | 图片固定尺寸、保持比例、超出裁切 | 16 |

---

## Q16 · 水平 / 垂直 / 水平垂直居中全景

**一句话答案**：水平居中分三类——块级定宽用 `margin: 0 auto`，行内内容用 `text-align: center`，布局层面用 flex 的 `justify-content` 或 grid 的 `justify-items`。垂直居中同样三类——单行文本用 `line-height`，表格布局用 `vertical-align: middle`，现代方案用 flex 的 `align-items` 或绝对定位 + `transform`。同时居中首选 flex / grid，脱离文档流的元素用 `absolute + transform`，宽高已知时用 `inset: 0 + margin: auto`。

### 水平居中

| 方案 | 代码 | 前提 |
|---|---|---|
| 块级 + 定宽 | `margin: 0 auto` | 元素是块级、有确定宽度（`width: auto` 时会撑满，无需居中） |
| 行内内容 | `text-align: center`（父级） | 适用于 inline / inline-block / 文本 |
| flex | `display: flex; justify-content: center` | 主轴水平 |
| grid | `display: grid; justify-items: center` | 只控制水平，垂直方向仍按 `align-items` |
| 绝对定位 | `left: 50%; transform: translateX(-50%)` | 不需要知道宽度 |
| 绝对定位 + margin auto | `left: 0; right: 0; margin: 0 auto; width: 200px` | 需要知道宽度 |
| 绝对定位 + 负 margin | `left: 50%; margin-left: -100px` | 需要知道宽度的一半 |
| `fit-content` | `width: fit-content; margin: 0 auto` | 宽度由内容决定 |

### 垂直居中

| 方案 | 代码 | 前提 |
|---|---|---|
| 单行文本 | `line-height` = 容器 `height` | 只能单行，多行会溢出 |
| 表格 | 容器 `display: table-cell; vertical-align: middle` | 容器要有确定高度 |
| flex | `display: flex; align-items: center` | 交叉轴垂直 |
| grid | `display: grid; align-items: center` 或 `place-items: center` | — |
| 绝对定位 + transform | `top: 50%; transform: translateY(-50%)` | 未知高度首选 |
| 绝对定位 + margin auto | `top: 0; bottom: 0; margin: auto 0; height: 100px` | 已知高度 |
| 上下 padding 对称 | `padding: 20px 0` | 内容高度可预期 |
| `::before` + `inline-block` | `::before { content:''; height:100%; display:inline-block; vertical-align:middle }` | 老方案，历史遗留 |

### 同时水平 + 垂直

| 方案 | 代码 | 前提 |
|---|---|---|
| flex | `display: flex; justify-content: center; align-items: center` | 未知宽高、单行多行都适用 |
| grid | `display: grid; place-items: center` | `place-items` 是 `align-items` + `justify-items` 的简写 |
| absolute + transform | `position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%)` | 不依赖父级布局，百分比相对元素自身宽高 |
| absolute + inset + margin auto | `position: absolute; inset: 0; margin: auto; width: 300px; height: 200px` | 宽高必须确定；某一边为 auto 时该方向会被撑满 |

### 选型与注意

- 全屏 loading：`position: fixed; inset: 0; display: grid; place-items: center`。
- 按钮文字：`display: inline-flex; align-items: center; justify-content: center`，比 `line-height` 耐字号变化。
- `transform: translate(-50%, -50%)` 让元素成为层叠上下文（`transform` 不为 `none`），可能触发 GPU 合成。
- flex 容器的子项之间不发生 margin 合并，从普通流迁到 flex 后间距会变。

### 口述要点：居中

- 水平：块级定宽 `margin: 0 auto` 平分剩余空间；行内或文本用父级 `text-align: center`；布局层用 flex 的 `justify-content` 或 grid 的 `justify-items`；绝对定位用 `left: 50% + translateX(-50%)`，不需要知道宽度。
- 垂直：单行 `line-height` 等于高度；`table-cell + vertical-align: middle`；flex 的 `align-items`；绝对定位 `top: 50% + translateY(-50%)`。
- 同时居中：flex 双属性或 grid `place-items: center`；脱离文档流用 `translate(-50%, -50%)`，宽高已知用 `inset: 0 + margin: auto`（没有 transform 的层叠上下文副作用）。
- 选型：新代码用 flex / grid，`line-height` 与 table-cell 只在维护老代码时出现。

### 可能被追问：居中

| 追问 | 回答要点 |
|---|---|
| `margin: 0 auto` 为什么对行内元素无效？ | 行内非替换元素的 auto 外边距按规范计算为 0，水平居中要用 `text-align` |
| 为什么 `vertical-align: middle` 有时不生效？ | 只对 inline / inline-block / table-cell 生效，对块级元素无效 |
| `translate(-50%, -50%)` 的百分比相对谁？ | 相对**元素自身**的宽高（不是父级） |
| `absolute + margin: auto` 为什么能居中？ | `inset` 四边为 0 且宽高确定时，剩余空间由 margin 平分（详见 Q17） |
| flex 居中对绝对定位子元素有效吗？ | 子元素不再是 flex item，但未设 `top` / `left` 时静态位置按"唯一的 flex 子项"计算，仍会落在对齐位置；设了偏移则按 `top` / `left` 定位 |
| grid 的 `place-items` 是什么的简写？ | `align-items` + `justify-items` |
| 居中后元素模糊怎么办？ | `translate(-50%, -50%)` 可能产生半像素偏移导致抗锯齿模糊，改用 `margin: auto` 方案或将偏移取整 |

---

## Q17 · margin: auto 为什么能居中

**一句话答案**：块级元素宽度确定、左右 `margin` 为 `auto` 时，浏览器把包含块的剩余空间平分给左右外边距；普通流块级元素的 `margin-top` / `margin-bottom: auto` 按 CSS 2.1 §10.6.3 计算为 `0`，所以垂直方向不居中。绝对定位元素 `top` / `bottom` 与高度都确定时，垂直 auto 才有解。

### 核心要点：auto margin 的求解

**水平居中的求解逻辑**

```
包含块宽度 = margin-left + border + padding + width + padding + border + margin-right
设 margin-left = margin-right = auto
=> auto = (包含块宽度 − 元素总宽度) / 2
```

**两个前提**

1. 元素必须是块级（`display: block` / `flex` / `grid` / `table`）。行内非替换元素的 `margin: auto` 计算为 0；浮动元素的 auto 外边距同样按 0 处理。
2. 宽度必须确定。`width: auto` 时块级元素撑满包含块，剩余空间为 0，`margin: auto` 等于 0，看起来"居中失效"。

**垂直方向为什么不生效**

- CSS 2.1 规定：普通流中块级元素的 `margin-top: auto` 和 `margin-bottom: auto` 计算为 0。
- 根本原因：块级元素高度由内容决定（`height: auto`），如果 margin 也用 auto，方程里就有两个未知数，无法求解，规范干脆定为 0。
- 只有绝对定位元素在 `top` 和 `bottom` 都确定、`height` 也确定时，垂直 auto margin 才有解：

```css
.child {
  position: absolute;
  top: 0;
  bottom: 0; /* 上下都贴边 */
  height: 200px; /* 高度确定 */
  margin: auto 0; /* 垂直方向平分剩余空间 */
}
```

**flex 中的 `margin: auto`**

flex 容器里，`margin: auto` 会吃掉所有剩余空间，可以用来把单个子项推到另一端：

```css
.nav { display: flex; }
.nav .user { margin-left: auto; } /* 把 user 推到最右，比 justify-content 更灵活 */
```

**元素自身水平居中 vs 内容水平居中**

- `margin: 0 auto` 居中**元素本身**（需要宽度）。
- `text-align: center` 居中**内部行内内容**（不需要宽度）。
- `fit-content` + `margin: 0 auto` 可以让"宽度随内容"的元素也居中。

### 口述要点：margin auto

- 水平能居中，是因为左右 margin 设成 auto 后，浏览器把包含块的剩余空间平均分给两边；前提是元素为块级且宽度确定。
- `width: auto` 时块级元素撑满父容器，没有剩余空间可分，margin 变成 0，这是"时灵时不灵"的原因。
- 垂直不行是因为规范把普通流块级元素的垂直 auto margin 定为 0；本质是高度 auto 时方程有两个未知数。
- 绝对定位且 top / bottom 与高度都确定时，垂直 auto 有解，`inset: 0 + margin: auto` 由此成立；flex 里 `margin-left: auto` 则吃掉剩余空间，把子项推到另一端。

### 可能被追问：margin auto

| 追问 | 回答要点 |
|---|---|
| 绝对定位元素为什么垂直 auto 有效？ | `top` / `bottom` 都确定且高度固定，方程有唯一解 |
| 行内元素 `margin: 0 auto` 为什么无效？ | 行内非替换元素的 auto 外边距计算为 0 |
| `margin: 0 auto` 和 `text-align: center` 的区别？ | 前者居中盒子自身，后者居中内部行内内容 |
| 子元素 `margin: 0 auto` 无效的常见原因？ | 不是块级（如 `display: inline`）、`width: auto`、被 `float` 脱离 |
| flex 容器里 `margin: auto` 和 `justify-content` 的区别？ | margin auto 作用于单个子项，justify-content 作用于整体 |
| `margin: auto` 会触发 BFC 吗？ | 不会 |

---

## Q18 · CSS 画三角形与扇形

**一句话答案**：0×0 元素加四条 border，只给一条边颜色、其余透明，斜切后得到指向该边反方向的等腰三角形。三角形加 `border-radius: 50%` 只是把 border box 的角磨圆，得到圆角三角形，没有圆心和半径，不是扇形；扇形用 `conic-gradient` + `border-radius: 50%`，90° 用 `border-radius: 100% 0 0 0`。

### 核心要点：border 与渐变

**三角形原理**

```css
.triangle {
  width: 0;
  height: 0;
  border-left: 50px solid transparent;
  border-right: 50px solid transparent;
  border-bottom: 100px solid #e5484d;
}
```

- 元素宽高为 0 时，四条 border 在中心点交汇，外边缘被斜切，单条着色时可见部分就是三角形。
- 哪条边有颜色，三角形就指向它的**反方向**：上例 `border-bottom` 着色，得到向上的等腰三角形。
- 尺寸：底边 = 相邻两条 border 之和（左右各 50px → 100px），高 = 着色边宽度（`border-bottom: 100px`）。实测该 0×0 元素的 border box 为 100×100。

方向速查：

| 想要的方向 | 有颜色的边 |
|---|---|
| 向上 ▲ | `border-bottom` |
| 向下 ▼ | `border-top` |
| 向左 ◀ | `border-right` |
| 向右 ▶ | `border-left` |

**三角形 + `border-radius` 不是扇形**

```css
/* 得到的是圆角三角形，不是扇形 */
width: 0;
height: 0;
border-left: 50px solid transparent;
border-right: 50px solid transparent;
border-top: 100px solid red;
border-radius: 50%;
```

`border-radius: 50%` 作用在 100×100 的 border box 上，四个角被裁成半径 50px 的圆弧（实测底角像素变为背景色），三角形只是被磨圆；它没有圆心、半径，也不是由两条半径和一段弧围成。

**90° 扇形（圆心在角上）**

```css
.sector-90 {
  width: 100px;
  height: 100px;
  background: #e5484d;
  border-radius: 100% 0 0 0; /* 左上角弧半径 100%，圆心落在右下角 */
}
```

**任意角度扇形（conic-gradient）**

```css
.sector {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: conic-gradient(#e5484d 0 90deg, transparent 90deg 360deg);
}
```

从 12 点方向顺时针计角，改第二个 `90deg` 即改扇形角度；`conic-gradient(from 45deg at 50% 50%, ...)` 控制起始角。同样的写法可做饼图与环形进度条：

```css
/* 环形进度条 */
.ring {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: conic-gradient(#4c8dff 0 65%, #eee 65% 100%);
  mask: radial-gradient(circle, transparent 60%, #000 61%); /* 挖空中心 */
}
```

**其他常用图形**

```css
/* 圆形 */
.circle { width: 100px; height: 100px; border-radius: 50%; }
/* 椭圆 */
.ellipse { width: 160px; height: 100px; border-radius: 50%; }
/* 梯形：宽高非 0 + 单边 border */
.trapezoid { width: 100px; height: 0; border-bottom: 60px solid #333; border-left: 25px solid transparent; border-right: 25px solid transparent; }
/* 平行四边形：skew */
.parallelogram { transform: skewX(-20deg); }
/* 箭头/对勾：两条相邻 border 转 45° */
.check { width: 12px; height: 24px; border-right: 2px solid #fff; border-bottom: 2px solid #fff; transform: rotate(45deg); }
```

### 口述要点：三角形与扇形

- 三角形：0×0 元素、三条 transparent、一条着色，方向是着色边的反方向；底边 = 相邻两条 border 之和，高 = 着色边的宽度。
- 三角形加 `border-radius: 50%` 只把 border box 的角磨圆，得到圆角三角形，不是扇形。
- 90° 扇形：宽高相等的方块 + `border-radius: 100% 0 0 0`；任意角度用 `conic-gradient(red 0 90deg, transparent 90deg)` + `border-radius: 50%`，改角度改 deg。
- 环形再叠一层 radial-gradient mask 把中心挖掉；CSS 画图形省图片请求、颜色可跟主题变量、可直接加动画。

### 可能被追问：三角形与扇形

| 追问 | 回答要点 |
|---|---|
| 三角形的尺寸怎么控制？ | 底边 = 相邻两条 border 之和，高 = 着色那条 border 的宽度 |
| 直角三角形怎么画？ | 两条相邻边着色、另外两条透明，例如 `border-top` + `border-right` |
| 为什么 `border-radius: 50%` 加 0×0 盒子不是扇形？ | 圆角作用在 border box 上，只把角磨圆，没有圆心和半径 |
| `conic-gradient` 兼容性？ | 现代浏览器全面支持，IE 不支持 |
| 环形怎么挖空？ | `mask: radial-gradient(circle, transparent 60%, #000 61%)`，或用 `border` + `border-radius` 画环 |
| 用 canvas/SVG 还是 CSS？ | 简单装饰用 CSS（省请求）；复杂路径用 SVG；动态可视化用 canvas/SVG |

---

## Q19 · 宽高比与"最大正方形"

**一句话答案**：现代方案直接 `aspect-ratio: 16 / 9`，给一边另一边自动算。老方案用 `padding-top: 百分比` 占位，百分比相对**包含块宽度**计算。"最大正方形"取视口短边 + `aspect-ratio: 1`：`width: min(100vw, 100vh)` 或 `100vmin`。

### 核心要点：比例实现

**方案一：`aspect-ratio`（推荐）**

```css
.box {
  width: 100%;
  aspect-ratio: 16 / 9; /* 宽 / 高 */
  background: #eee;
}

/* 高度固定、宽度自动 */
.box { height: 200px; aspect-ratio: 1; }

/* 正方形 */
.square { aspect-ratio: 1; }

/* 优先使用图片固有比例，没有时才用 4 / 3 */
.img { aspect-ratio: auto 4 / 3; }
```

- `aspect-ratio: <width> / <height>`，只写一个数字等价于 `n / 1`。
- 同时设了 `width` 和 `height` 时，`aspect-ratio` 被忽略（实测 160×40 仍是 40）。
- 会被内容撑开：160×90 的盒子遇到 300px 高的内容会变成 300px 高；要严格锁定比例，加 `overflow: hidden` 或 `min-height: 0`（实测两者都回到 90px）。
- 兼容性：Chrome 88+ / Safari 15+ / Firefox 89+。

**方案二：`padding-top` 百分比 hack（老方案）**

```css
.ratio-box {
  position: relative;
  width: 100%;
  height: 0;
  padding-top: 56.25%; /* 9 / 16 = 0.5625 */
  overflow: hidden;
}
.ratio-box > .content {
  position: absolute;
  inset: 0;
}
```

原理：**百分比 padding（包括 `padding-top`）相对包含块的宽度计算**，不是元素自身宽度。示例里 `width: 100%`，两者相等，`padding-top: 56.25%` 正好得到 16:9；元素定宽且窄于包含块时，padding 仍按包含块宽度算（实测 160px 宽元素在 800px 包含块中、`56.25%` 得到 450px），需要外面再套一层定宽容器。

常见比例换算：

| 比例 | padding-top |
|---|---|
| 1:1 | 100% |
| 4:3 | 75% |
| 16:9 | 56.25% |
| 21:9 | 42.86% |

**最大正方形**

```css
/* 写法 1：取视口短边 */
.square {
  width: min(100vw, 100vh);
  aspect-ratio: 1;
  margin: auto; /* 配合父级 flex/grid 居中 */
}

/* 写法 2：vmin 直接就是短边单位 */
.square {
  width: 100vmin;
  aspect-ratio: 1;
}

/* 写法 3：不超出父容器 */
.parent { display: grid; place-items: center; height: 100vh; }
.square { width: min(100%, 100vh); aspect-ratio: 1; }
```

`vmin` = `min(vw, vh)`，`vmax` = `max(vw, vh)`。手机竖屏时 `vmin` 是宽度，横屏时是高度，所以 `100vmin` 永远是"能放进屏幕的最大正方形边长"。只要正方形、不要"最大"，`aspect-ratio: 1` 配一个宽度就够。

### 口述要点：宽高比

- 现代做法是 `aspect-ratio`，给宽度算高度，只给高度也行。
- 老方案 `padding-top` 百分比占位：百分比相对**包含块宽度**，容器 `height: 0`，内容绝对定位铺满。
- 最大正方形取视口短边：`min(100vw, 100vh)` 或 `100vmin`，配 `aspect-ratio: 1`，再用父级 flex / grid 居中。
- 两个坑：宽高都设时比例失效；内容更高会撑开盒子，`overflow: hidden` 或 `min-height: 0` 可以锁住。

### 可能被追问：宽高比

| 追问 | 回答要点 |
|---|---|
| 百分比 padding 相对谁？ | 包含块**宽度**（上下 padding 也是），不是元素自身宽度 |
| `aspect-ratio` 会被内容撑开吗？ | 会；`overflow: hidden` 或 `min-height: 0` 可锁定 |
| `aspect-ratio: auto 4/3` 什么意思？ | `auto` 表示优先使用元素固有比例（如图片原始比例），没有固有比例时才用 4/3 |
| `vmin` 和 `vw` 区别？ | `vmin` 取 vw/vh 中较小者，`vmax` 取较大者 |
| `100vh` 在移动端有什么问题？ | 地址栏收起/展开会改变视口高度，`100vh` 会超出屏幕，用 `100dvh` 更准 |
| 图片保持比例但不变形，用 `aspect-ratio` 还是 `object-fit`？ | 比例容器用 `aspect-ratio`，填充方式用 `object-fit`，两者常配合 |

---

## Q20 · 单行 / 多行文本溢出省略号

**一句话答案**：单行三件套——`overflow: hidden` + `white-space: nowrap` + `text-overflow: ellipsis`；多行用 `display: -webkit-box` + `-webkit-box-orient: vertical` + `-webkit-line-clamp: N` + `overflow: hidden`。两个高频坑：容器必须有**确定宽度**；flex 场景下，省略元素自身带 `overflow: hidden` 时不需要 `min-width: 0`，省略元素被包在 `overflow: visible` 的 flex 子项里才需要。

### 核心要点：单行与多行

**单行**

```css
.ellipsis {
  overflow: hidden;          /* 隐藏溢出部分 */
  white-space: nowrap;       /* 强制不换行，否则会折行不溢出 */
  text-overflow: ellipsis;   /* 溢出时显示省略号 */
  /* 可选：width / max-width 必须有确定值 */
}
```

三个属性缺一不可：

- `white-space: nowrap`：不换行，让内容真的溢出。
- `overflow: hidden`：裁掉溢出部分。
- `text-overflow: ellipsis`：在裁切处画省略号（它本身不裁切）。

**多行**

```css
.multiline {
  display: -webkit-box;
  -webkit-box-orient: vertical;   /* 必须设，否则 line-clamp 无效 */
  -webkit-line-clamp: 2;          /* 限制行数 */
  overflow: hidden;
  word-break: break-all;          /* 可选：长英文 / URL 强制断行 */
}
```

- `-webkit-line-clamp` 需要 `display: -webkit-box` 和 `-webkit-box-orient: vertical` 配合，三者缺一不可。
- 按整行裁切：盒子高度 = 行数 × `line-height`（实测 2 行 40px，内容 `scrollHeight` 101px 被裁掉），末行末尾渲染省略号。
- 标准 `line-clamp` 当前 Chrome 未实现（`CSS.supports('line-clamp', '2')` 返回 `false`），实际必须写 `-webkit-` 前缀。

**三个常见失效场景**

1. **flex 子项**：省略元素自身带 `overflow: hidden` 时，子项的 `min-width: auto` 会解析为 0，能正常收缩省略（实测 200px 容器中占 150px、`scrollWidth` 262）。需要 `min-width: 0` 的是省略元素被包在 `overflow: visible` 的 flex 子项里：子项的自动最小宽度按内容撑住，内层永远不溢出。

```css
.flex-child { flex: 1; min-width: 0; } /* 子项本身 overflow: visible 时必须加 */
```

2. **table 单元格**：`table-layout: auto` 时单元格宽度由内容撑开。

```css
table { table-layout: fixed; width: 100%; }
td { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

3. **float / inline-block 未定宽**：没有确定宽度就没有溢出参照，必须给 `width` 或 `max-width`。

**降级 / 替代方案**

```css
/* 1. 渐变遮罩：不显示省略号，视觉柔和，无兼容问题 */
.mask {
  max-height: 3em;
  overflow: hidden;
  background: linear-gradient(to bottom, transparent, #fff 90%);
}
/* 2. JS 测量 scrollHeight 截断，可配"展开 / 收起" */
```

**其他相关属性**

- `word-break: break-all`：中文/英文都强制断词，适合长 URL。
- `overflow-wrap: anywhere` / `word-wrap: break-word`：只在必要时断词。
- `hyphens: auto`：英文连字符断词（需要 `lang` 属性）。
- `text-overflow: clip`：默认值，直接裁切。

### 口述要点：文本溢出

- 单行三件套：`overflow: hidden`、`white-space: nowrap`、`text-overflow: ellipsis`；`nowrap` 先制造溢出，`overflow` 裁切，`text-overflow` 才画省略号，容器还要有确定宽度。
- 多行用 `-webkit-line-clamp`，需要 `display: -webkit-box`、`-webkit-box-orient: vertical`、`overflow: hidden` 配合；标准 `line-clamp` 还没实现，必须带 `-webkit-` 前缀。
- 常见失效在 flex：省略元素被包在 `overflow: visible` 的 flex 子项里时，`min-width: auto` 会按内容撑住，给子项加 `min-width: 0`；省略元素自身 `overflow: hidden` 时则无需设置。
- 需要精确控制或"展开 / 收起"，用 JS 测量 `scrollHeight` 截断，或用渐变遮罩做视觉降级。

### 可能被追问：文本溢出

| 追问 | 回答要点 |
|---|---|
| 只写 `overflow: hidden` 会怎样？ | 内容被裁掉但没有省略号；未设 `nowrap` 时还会先换行，不产生溢出 |
| 为什么 flex 里省略号不生效？ | 省略元素外层的 flex 子项 `overflow: visible` 时，`min-width: auto` 按内容撑住，需给该子项 `min-width: 0`；省略元素自身 `overflow: hidden` 时无需设置 |
| `text-overflow` 能作用于多行吗？ | 不能，它只处理单行溢出 |
| `-webkit-line-clamp` 是标准属性吗？ | 标准 `line-clamp` 尚未被当前 Chrome 实现（`CSS.supports` 返回 `false`），仍需 `-webkit-` 前缀 |
| 表格里怎么让省略号生效？ | `table-layout: fixed` + 单元格 `overflow: hidden` |
| 中文能正常截断吗？ | 能；英文长单词需 `word-break` 或 `overflow-wrap` |
| 如何显示"展开全文"？ | 切换 class 改变 `line-clamp`，或 JS 测量 `scrollHeight` 判断是否溢出 |

---

## Q21 · 图片固定尺寸、保持比例、超出裁切

**一句话答案**：给 `img` 设定固定宽高，再加 `object-fit: cover`——图片按比例缩放填满容器，超出部分被裁掉，不变形。`object-fit` 有 5 个值：`fill`（默认，会拉伸变形）、`contain`（完整显示，可能留白）、`cover`（填满，裁剪）、`none`（原始尺寸）、`scale-down`（取 contain 和 none 中更小的）。配合 `object-position` 控制裁切位置。

### 核心要点：object-fit

**核心方案**

```css
img {
  width: 200px;
  height: 200px;
  object-fit: cover;       /* 保持比例填满，超出裁切 */
  object-position: center; /* 裁切时保留哪一部分，默认居中 */
}
```

**五个取值对比**（假设容器 200×200，图片 400×300）

| 值 | 效果 | 是否变形 | 是否留白 | 是否裁切 |
|---|---|---|---|---|
| `fill`（默认） | 拉伸填满 | **会变形** | 否 | 否 |
| `contain` | 完整显示，缩放到能放下 | 否 | **会留白** | 否 |
| `cover` | 缩放到填满，超出裁切 | 否 | 否 | **会裁切** |
| `none` | 保持原始尺寸，居中 | 否 | 可能溢出 | 可能溢出 |
| `scale-down` | `none` 和 `contain` 中更小的那个 | 否 | 视情况 | 否 |

**`object-position`**

```css
.avatar { object-fit: cover; object-position: top center; }  /* 头像保头不保身 */
.banner { object-fit: cover; object-position: center 30%; }  /* 主体偏上 */
```

**与 `background-size` 的对比**

| 维度 | `img` + `object-fit` | `background-image` + `background-size` |
|---|---|---|
| 语义 | 内容图片，可被 SEO 抓取 | 装饰性图片 |
| 无障碍 | 有 `alt`，读屏可识别 | 无替代文本，需 ARIA |
| 打印 | 默认会打印 | 默认不打印背景图 |
| 懒加载 | 原生 `loading="lazy"` | 需 JS 或 CSS 技巧 |
| 响应式 | `srcset` / `sizes` / `<picture>` | 需媒体查询切换 |
| 裁切控制 | `object-position` | `background-position` |
| 多图/渐变叠加 | 单张 | 支持多重背景 |

内容图片（商品图、文章配图、头像）用 `img + object-fit`；纯装饰背景用 `background`。

**容器尺寸不确定时的宽高比组合**

```css
/* 卡片封面：宽度自适应，固定 16:9，图片裁切填满 */
.cover {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  border-radius: 8px;
}
```

**其他相关属性**

- `image-rendering: pixelated`：放大像素图不模糊（做像素风/二维码）。
- `object-view-box`：取景框式裁切图片局部（新特性，兼容性有限）。
- `aspect-ratio` + `object-fit` 是最常见的组合，用于图片墙、视频封面。

### 口述要点：图片裁切

- 标准做法是给 `img` 固定宽高，再 `object-fit: cover`：按原始比例缩放到刚好填满，超出裁切，不变形；位置用 `object-position` 控制，默认居中。
- `object-fit` 默认是 `fill`，直接拉伸到容器尺寸，图片会变形；`contain` 完整显示但可能留白；`scale-down` 取 contain 和 none 中更小的。
- 它和 `background-size: cover` 视觉一致，但内容图片用 `img + object-fit`：能被搜索引擎抓、有 `alt`、支持原生懒加载和 `srcset`；纯装饰背景才用 `background`。
- 卡片封面配 `aspect-ratio: 16/9` 让容器自带比例，再 `object-fit: cover`，宽高都不用写死。

### 可能被追问：图片裁切

| 追问 | 回答要点 |
|---|---|
| `object-fit: cover` 和 `background-size: cover` 区别？ | 视觉效果一致，差异在语义、SEO、无障碍、打印、懒加载 |
| `fill` 为什么是默认值？ | 历史行为，保证图片填满指定尺寸，但会变形 |
| 图片裁切位置怎么调？ | `object-position: 50% 20%` 或关键字 `top/center/bottom` |
| 只裁切不缩放怎么做？ | `object-fit: none` + `object-position`，或 `object-view-box` |
| `object-fit` 对 `video`、`canvas` 生效吗？ | 生效，它们是替换元素 |
| 图片加载前如何避免布局抖动？ | 用 `aspect-ratio` 占位，或 `width`/`height` 属性让浏览器预留空间 |

---

## 本主题自测

1. 说出水平居中 4 种、垂直居中 3 种，并各给一个适用前提。
2. `margin: 0 auto` 在什么情况下失效？为什么？
3. 用 `conic-gradient` 写一个 60° 扇形。
4. `aspect-ratio` 和 `padding-top: 56.25%` 各自的优缺点。
5. flex 子项里写省略号为什么不生效？怎么修？
6. `object-fit: cover` 和 `contain` 的视觉差别，各用在什么场景？
