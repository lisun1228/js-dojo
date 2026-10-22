# CSS · 04 居中与常见图形效果

> 覆盖原题：2、6、9、10、15、16、18、25、43、45、46、51、56、58
> 合并后 6 个知识点 ｜ 重要度 ★★★★★ ｜ 建议时长 60 分钟

## 本主题速查

| 编号 | 知识点 | 合并自 |
|---|---|---|
| Q16 | 水平 / 垂直 / 水平垂直居中全景 | 2、10、18、45、51、56、58（7 条合并） |
| Q17 | margin: auto 为什么能居中 | 6 |
| Q18 | CSS 画三角形与扇形 | 9、46 |
| Q19 | 宽高比与"最大正方形" | 25、43 |
| Q20 | 单行 / 多行文本溢出省略号 | 15 |
| Q21 | 图片固定尺寸、保持比例、超出裁切 | 16 |

一句话主线：**居中题的答题质量取决于"分类是否清晰 + 是否知道每个方案的适用边界"，而不是能背出几种。** 61 道题里有 7 道在问居中，说明这是必考题，必须练到能像讲菜单一样讲出来。

---

## Q16 · 水平 / 垂直 / 水平垂直居中全景

> 合并原题：2、10、18、45、51、56、58（7 条重复，问法各异）

**一句话答案**：水平居中分三类——块级定宽用 `margin: 0 auto`，行内内容用 `text-align: center`，布局层面用 flex/grid 的对齐属性；垂直居中同样三类——单行文本用 `line-height`，表格布局用 `vertical-align: middle`，现代方案用 flex/grid 的 `align-items` 或绝对定位 + `transform`。**首选 flex（`justify-content` + `align-items`）或 grid（`place-items: center`）**。

### 答题思路

1. 先分类，不要一上来就报菜名。按"水平 / 垂直 / 两者同时"三段讲，每段 3–5 个方案。
2. 每个方案说清**前提条件**（是否已知宽高、是否单行、父级是否需要是 flex）。
3. 给出选型结论和一条实战经验（比如"flex 会影响子元素 margin 合并"）。
4. 主动补 `absolute + margin: auto` 这种"冷门但能体现深度"的方案。

### 核心要点

**一、水平居中**

| 方案 | 代码 | 前提 |
|---|---|---|
| 块级 + 定宽 | `margin: 0 auto` | 元素是块级、有确定宽度（否则 auto 宽度会撑满，无需居中） |
| 行内内容 | `text-align: center`（父级） | 适用于 inline / inline-block / 文本 |
| flex | `display: flex; justify-content: center` | 主轴水平 |
| grid | `display: grid; justify-items: center` | — |
| 绝对定位 | `left: 50%; transform: translateX(-50%)` | 不需要知道宽度 |
| 绝对定位 + margin auto | `left: 0; right: 0; margin: 0 auto; width: 200px` | 需要知道宽度 |
| 绝对定位 + 负 margin | `left: 50%; margin-left: -100px` | 需要知道宽度的一半 |
| `fit-content` | `width: fit-content; margin: 0 auto` | 宽度由内容决定 |

**二、垂直居中**

| 方案 | 代码 | 前提 |
|---|---|---|
| 单行文本 | `line-height` = 容器 `height` | 只能单行，多行会溢出 |
| 表格 | 父级 `display: table-cell; vertical-align: middle` | 父级要有高度 |
| flex | `display: flex; align-items: center` | 交叉轴垂直 |
| grid | `display: grid; align-items: center` 或 `place-items: center` | — |
| 绝对定位 + transform | `top: 50%; transform: translateY(-50%)` | 未知高度首选 |
| 绝对定位 + margin auto | `top: 0; bottom: 0; margin: auto 0; height: 100px` | 已知高度 |
| 上下 padding 对称 | `padding: 20px 0` | 内容高度可预期 |
| `display: flow-root` + `::before` | `::before { content:''; height:100%; display:inline-block; vertical-align:middle }` | 老方案，历史遗留 |

**三、水平 + 垂直居中（四种主流写法）**

```css
/* 1. flex —— 最推荐，未知宽高、单行多行都行 */
.parent {
  display: flex;
  justify-content: center;  /* 主轴（默认水平） */
  align-items: center;      /* 交叉轴（默认垂直） */
}

/* 2. grid —— 最短 */
.parent {
  display: grid;
  place-items: center;      /* align-items + justify-items 的简写 */
}

/* 3. absolute + transform —— 适合弹窗/浮层，不依赖父级布局 */
.child {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
}

/* 4. absolute + margin: auto —— 已知宽高时最稳，无 transform 副作用 */
.child {
  position: absolute;
  top: 0; right: 0; bottom: 0; left: 0;
  width: 300px; height: 200px;
  margin: auto;
}
```

**四、特殊场景**

- **不定宽高的弹窗居中**：`absolute + transform` 或 `fixed + inset: 0 + margin: auto`。
- **多行文本垂直居中**：只能用 flex/grid/table-cell，`line-height` 会失效。
- **图片居中**：父级 flex + `align-items: center; justify-content: center`，或 `text-align: center; line-height` 组合。
- **全屏 loading**：`position: fixed; inset: 0; display: grid; place-items: center`。
- **少量文字的按钮**：`display: inline-flex; align-items: center; justify-content: center`，比 `line-height` 更耐改字号。

**五、注意事项（面试加分）**

- `transform: translate(-50%, -50%)` 会让元素**创建层叠上下文**（因为 transform 不为 none），可能导致 `z-index` 行为变化，也可能触发 GPU 合成（有利有弊）。
- flex 容器内的子元素 **margin 不会合并**，如果原来依赖 margin 合并，改成 flex 后间距会变。
- `line-height` 方案在字体被用户放大时会溢出，不够健壮。
- 不要用 `<table>` 或者负 margin 硬算的方式写新代码。

### 口述回答（约 90 秒）

> 我按水平、垂直、水平垂直三段来讲。
>
> 水平居中：块级元素有确定宽度，直接 `margin: 0 auto`，原理是左右 auto 平分剩余空间；行内元素或者文本，父级 `text-align: center`；现代写法父级 flex 加 `justify-content: center`，或者 grid 加 `justify-items: center`；绝对定位的话，`left: 50%` 加 `translateX(-50%)`，不需要知道宽度。
>
> 垂直居中要分情况。单行文本可以用 `line-height` 等于容器高度，但多行就废了；父级 `display: table-cell` 加 `vertical-align: middle` 是老的可行方案；flex 的 `align-items: center` 是最通用的；绝对定位就是 `top: 50%` 加 `translateY(-50%)`。
>
> 同时水平和垂直居中，我最常用两种：一是父级 `display: flex` 加 `justify-content: center` 和 `align-items: center`，未知宽高、内容多少行都没问题；二是 grid 一行 `place-items: center`，最短。
>
> 如果是弹窗这类脱离文档流的元素，用 absolute 加 `translate(-50%, -50%)`，或者已知宽高时用 `inset: 0` 加 `margin: auto`，后者不依赖 transform，不会有创建层叠上下文的副作用。
>
> 选型上，新代码一律 flex 或 grid；`line-height` 和 table-cell 只在维护老代码时遇到。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| `margin: 0 auto` 为什么对行内元素无效？ | 行内元素不在块级格式化上下文里，`auto` 的外边距解析为 0；要用 `text-align` |
| 为什么 `vertical-align: middle` 有时不生效？ | 只对 inline / inline-block / table-cell 生效，对块级元素无效 |
| `translate(-50%, -50%)` 的百分比相对谁？ | 相对**元素自身**的宽高（不是父级） |
| `absolute + margin: auto` 为什么能居中？ | `inset` 四边为 0 时，元素尺寸固定则剩余空间由 margin 平分，水平和垂直都成立（详见 Q17） |
| flex 居中对绝对定位子元素有效吗？ | 无效，绝对定位子元素脱离 flex 流，不再参与 flex 对齐 |
| grid 的 `place-items` 是什么的简写？ | `align-items` + `justify-items` |
| 居中后元素模糊怎么办？ | `translate(-50%, -50%)` 产生半像素偏移导致抗锯齿模糊，改用 `margin: auto` 方案或将偏移取整 |

---

## Q17 · margin: auto 为什么能居中

> 合并原题：6

**一句话答案**：块级元素在**宽度确定**时，如果左右 `margin` 都是 `auto`，浏览器会把包含块的剩余空间平均分给左右外边距，所以水平居中；而垂直方向，规范规定普通流块级元素的 `margin-top/bottom: auto` 一律计算为 `0`，因为高度由内容决定，不存在"剩余空间"可供分配，所以垂直不居中。

### 答题思路

1. 先讲水平：`width` + `margin-left/right: auto` 的求解过程（剩余空间 = 包含块宽度 − 元素宽度，平分）。
2. 强调两个前提：**必须是块级**、**宽度必须确定**（`width: auto` 时元素会撑满，没有剩余空间）。
3. 讲垂直为什么不生效：规范明确规定（CSS 2.1 §10.6.3）普通流块级元素的垂直 auto margin 计算为 0。
4. 讲什么时候垂直 auto 生效：**绝对定位元素**（`top/bottom: 0` + `height` 固定），因为此时方程有解。
5. 顺带讲 flex 里的 `margin: auto`——这是现代布局的一个妙用。

### 核心要点

**水平居中的求解逻辑**

```
包含块宽度 = margin-left + border + padding + width + padding + border + margin-right
设 margin-left = margin-right = auto
=> auto = (包含块宽度 − 元素总宽度) / 2
```

浏览器把这个方程解出来，就是居中。

**两个前提**

1. **元素必须是块级**（`display: block` / `flex` / `grid` / `table`，或浮动、绝对定位元素）。行内元素的 `margin: auto` 计算为 0。
2. **宽度必须确定**。`width: auto` 时块级元素会撑满包含块，剩余空间为 0，此时 `margin: auto` 等于 0，看起来"居中失效"——这也是很多人以为 `margin: 0 auto` 不好用的原因。

**垂直方向为什么不生效**

- CSS 2.1 规定：普通流中块级元素的 `margin-top: auto` 和 `margin-bottom: auto` **计算为 0**。
- 根本原因：块级元素的高度由内容决定（`height: auto`），如果 margin 也用 auto，方程里就有两个未知数，无法求解，规范干脆定为 0。
- 只有**绝对定位元素**（或 `fixed`）在 `top` 和 `bottom` 都确定、`height` 也确定时，垂直 auto margin 才有解：

```css
.child {
  position: absolute;
  top: 0; bottom: 0;          /* 上下都贴边 */
  height: 200px;              /* 高度确定 */
  margin: auto 0;             /* 垂直方向平分剩余空间 */
}
```

**flex / grid 中的 `margin: auto`（进阶用法）**

在 flex 容器里，`margin: auto` 会吃掉所有剩余空间，可以用来做"单个子项单独居中"或"推到另一端"：

```css
.nav { display: flex; }
.nav .logo { }
.nav .user { margin-left: auto; }   /* 把 user 推到最右，比 justify-content 更灵活 */
```

**元素自身水平居中 vs 内容水平居中**

- `margin: 0 auto` 居中**元素本身**（需要宽度）。
- `text-align: center` 居中**内部行内内容**（不需要宽度）。
- `fit-content` + `margin: 0 auto` 可以让"宽度随内容"的元素也居中。

### 口述回答（约 70 秒）

> 水平能居中，是因为块级元素的宽度方程里，左右 margin 设成 auto 之后，浏览器会把包含块的剩余空间平均分给左右两边。所以前提有两个：元素得是块级，而且宽度得确定——不管是通过 width 还是 max-width。如果 width 是 auto，块级元素会直接撑满父容器，没有剩余空间可分，margin 就变成 0 了，这也是很多人觉得 `margin: 0 auto` 时灵时不灵的原因。
>
> 垂直方向不行，是因为规范明确规定：普通流里块级元素的 `margin-top` 和 `margin-bottom` 设 auto 一律算作 0。本质原因是块级元素高度由内容决定，是 auto，如果 margin 也 auto，方程就有两个未知数解不出来，所以规范直接定成 0。
>
> 但绝对定位元素是例外。当 top 和 bottom 都为 0、高度也确定的时候，垂直方向的 auto margin 就有解了，会把剩余空间平分，这就是 `inset: 0` 加 `margin: auto` 能实现水平垂直双居中的原理。
>
> 另外在 flex 容器里 `margin: auto` 会吃掉所有剩余空间，常用来把某个子项单独推到另一端。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| 绝对定位元素为什么垂直 auto 有效？ | `top`/`bottom` 都确定且高度固定，方程有唯一解 |
| 行内元素 `margin: 0 auto` 为什么无效？ | 行内元素不在 BFC 中参与宽度分配，auto 解析为 0 |
| `margin: 0 auto` 和 `text-align: center` 的区别？ | 前者居中盒子自身，后者居中内部行内内容 |
| 子元素 `margin: 0 auto` 无效的常见原因？ | 不是块级（如 `display: inline`）、`width: auto`、父级是 flex 且子项已对齐、被 `float` 脱离 |
| flex 容器里 `margin: auto` 和 `justify-content` 的区别？ | margin auto 作用于单个子项，justify-content 作用于整体 |
| `margin: auto` 会触发 BFC 吗？ | 不会 |

---

## Q18 · CSS 画三角形与扇形

> 合并原题：9（实现一个扇形）、46（CSS 实现三角形）

**一句话答案**：三角形利用"元素尺寸为 0 时，四条 border 在角上以 45° 斜切相接"的特性——只给一条边颜色、其余透明，就得到一个指向反方向的三角形。扇形是在三角形基础上加圆角或裁切，但**题目里那种写法其实是"圆角三角形"，不是严格扇形**；真正的扇形用 `conic-gradient` + `border-radius: 50%`，或 `clip-path` 更准确。

### 答题思路

1. 先讲三角形原理（border 斜切），这是必答。
2. 讲怎么控制方向和大小。
3. 扇形部分要**敢于指出题面答案不严谨**，并给出正确做法——这是这道题最大的加分点。
4. 补 `clip-path`、`conic-gradient` 这些现代做法，以及"为什么要用 CSS 画图形"（减少图片请求、可换色、可动画）。

### 核心要点

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

- 元素宽高为 0 时，四条 border 在中心点交汇，每条 border 的外边缘被斜切成梯形/三角形。
- 哪条边有颜色，三角形就"指向"它的**反方向**。上例 `border-bottom` 有颜色，所以是一个**向上**的等腰三角形。
- 底边宽度 = 左右 border 之和（100px），高 = `border-bottom` 宽度（100px）。

方向速查：

| 想要的方向 | 有颜色的边 |
|---|---|
| 向上 ▲ | `border-bottom` |
| 向下 ▼ | `border-top` |
| 向左 ◀ | `border-right` |
| 向右 ▶ | `border-left` |

**扇形：题面答案的问题**

原题给的代码是：

```css
/* 这其实是"圆角三角形"，不是扇形 */
width: 0; height: 0;
border-left: 50px solid transparent;
border-right: 50px solid transparent;
border-top: 100px solid red;
border-radius: 50%;
```

`border-radius: 50%` 作用在 0×0 的盒子上，圆角实际加在 border 外框上，得到的是一个顶部被磨圆的三角形。**严格来说它没有圆心、没有半径，不是扇形**。

**正确做法一：90° 扇形（圆心在角上）**

```css
.sector-90 {
  width: 100px;
  height: 100px;
  background: #e5484d;
  border-radius: 100% 0 0 0;   /* 只有左上角是圆的 → 四分之一圆 */
}
```

**正确做法二：任意角度扇形（conic-gradient，最实用）**

```css
.sector {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: conic-gradient(#e5484d 0 90deg, transparent 90deg 360deg);
}
```

用 `conic-gradient(from 45deg at 50% 50%, ...)` 可以控制起始角度，用它还能做饼图、环形进度条：

```css
/* 环形进度条 */
.ring {
  width: 100px; height: 100px;
  border-radius: 50%;
  background: conic-gradient(#4c8dff 0 65%, #eee 65% 100%);
  mask: radial-gradient(circle, transparent 60%, #000 61%);  /* 挖空中心 */
}
```

**正确做法三：`clip-path`**

```css
/* 直角扇形：先做个圆，再用多边形裁掉一半 */
.sector {
  width: 100px; height: 100px;
  border-radius: 100% 0 0 0;   /* 已是四分之一圆 */
}
/* 任意角度用 polygon 近似，或直接 conic-gradient */
```

**其他常用 CSS 图形（一并准备，常被顺带问）**

```css
/* 圆形 */
.circle { width: 100px; height: 100px; border-radius: 50%; }
/* 椭圆 */
.ellipse { width: 160px; height: 100px; border-radius: 50%; }
/* 梯形：宽高非 0 + 单边 border */
.trapezoid { width: 100px; height: 0; border-bottom: 60px solid #333; border-left: 25px solid transparent; border-right: 25px solid transparent; }
/* 平行四边形：skew */
.parallelogram { transform: skewX(-20deg); }
/* 箭头/对勾：两条 border 转 45° */
.check { width: 12px; height: 24px; border-right: 2px solid #fff; border-bottom: 2px solid #fff; transform: rotate(45deg); }
```

### 口述回答（约 75 秒）

> 三角形是利用 border 的特性。元素宽高设为 0 的时候，四条 border 在中心交汇，外边缘是斜切的，所以每条 border 实际是个三角形。只给一条边颜色，其他三条设成 transparent，就得到一个三角形，方向是**有颜色那条边的反方向**——比如 `border-bottom` 有颜色，三角形就朝上。底边宽度等于左右 border 之和，高度等于那条边的宽度。
>
> 扇形我要补一句：常见的"三角形加 `border-radius: 50%`"写法其实得到的是圆角三角形，它没有圆心和半径，严格说不算扇形。真正的扇形有两种做法：如果是 90 度、圆心在角上，用宽高相等的方块加 `border-radius: 100% 0 0 0` 就行；任意角度最实用的是 `conic-gradient`，配合 `border-radius: 50%`，`background: conic-gradient(red 0 90deg, transparent 90deg)`，改角度只要改那个 deg。它还能直接做饼图和环形进度条，环形的话再叠一层 mask 把中心挖掉。
>
> 顺带还能用 `clip-path: polygon()` 做梯形、箭头这些不规则形状。用 CSS 画图形的好处是省图片请求、颜色能跟主题变量走、还能直接加动画。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| 三角形的尺寸怎么控制？ | 底边 = 左右 border 宽之和，高 = 对应那条 border 的宽度 |
| 直角三角形怎么画？ | 两条相邻边有颜色、另外两条透明，例如 `border-top` + `border-right` 有颜色 |
| 为什么 `border-radius: 50%` 加 0×0 盒子不是扇形？ | 圆角加在 border 外框上，得到圆角三角形，没有圆心 |
| `conic-gradient` 兼容性？ | 现代浏览器全面支持，IE 不支持 |
| 环形怎么挖空？ | `mask: radial-gradient(circle, transparent 60%, #000 61%)`，或用 `border` + `border-radius` 画环 |
| 用 canvas/SVG 还是 CSS？ | 简单装饰用 CSS（省请求）；复杂图形、需要精确路径用 SVG；动态数据可视化用 canvas/SVG |

---

## Q19 · 宽高比与"最大正方形"

> 合并原题：25（如何实现一个最大的正方形）、43（次世代 CSS 怎么实现容器宽高比）

**一句话答案**：现代方案直接 `aspect-ratio: 16 / 9`，浏览器自动按宽度算高度（或反之）。老方案用 `padding-top: 百分比` 占位（百分比 padding 相对**宽度**计算）。"最大正方形"= 取视口短边 + `aspect-ratio: 1`：`width: min(100vw, 100vh); aspect-ratio: 1;`，或用 `vmin`。

### 答题思路

1. 先给 `aspect-ratio`（现代标准答案），说明它替代了什么。
2. 讲 `padding-top` 百分比 hack，并解释**为什么是相对宽度**——这个点很多人只知道怎么写不知道为什么。
3. 讲"最大正方形"的两种写法，说明 `vmin` 的含义。
4. 讲 `aspect-ratio` 的坑：被内容撑开、与 `min-height` 冲突、`auto` 关键字。

### 核心要点

**方案一：`aspect-ratio`（推荐）**

```css
.box {
  width: 100%;
  aspect-ratio: 16 / 9;   /* 宽 / 高 */
  background: #eee;
}

/* 高度固定、宽度自动 */
.box { height: 200px; aspect-ratio: 1; }

/* 正方形 */
.square { aspect-ratio: 1; }

/* 保持图片原始比例，同时允许内容撑开 */
.img { aspect-ratio: auto 4 / 3; }   /* auto = 用元素固有比例 */
```

- `aspect-ratio: <width> / <height>`，只写一个数字等价于 `n / 1`。
- 同时设了 `width` 和 `height` 时，`aspect-ratio` 被忽略（两者都不为 auto 时无解）。
- **会被内容撑开**：如果内容高度超过按比例算出的高度，盒子会被撑高。要严格锁定比例，加 `overflow: hidden` 或设 `min-height: 0`。
- 兼容性：Chrome 88+ / Safari 15+ / Firefox 89+，2021 年后全面可用。

**方案二：`padding-top` 百分比 hack（老方案，必须知道）**

```css
.ratio-box {
  position: relative;
  width: 100%;
  height: 0;
  padding-top: 56.25%;   /* 9 / 16 = 0.5625 */
  overflow: hidden;
}
.ratio-box > .content {
  position: absolute;
  inset: 0;
}
```

原理：**百分比 padding（包括 `padding-top`）永远相对包含块的宽度计算**，所以 `padding-top: 56.25%` 得到的高度 = 宽度 × 0.5625，正好 16:9。这是 `aspect-ratio` 出现前唯一可靠的纯 CSS 方案。

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
  margin: auto;            /* 配合父级 flex/grid 居中 */
}

/* 写法 2：vmin 直接就是短边单位 */
.square {
  width: 100vmin;
  aspect-ratio: 1;
}

/* 写法 3：不超出父容器的最大正方形 */
.parent { display: grid; place-items: center; height: 100vh; }
.square { width: min(100%, 100vh); aspect-ratio: 1; }
```

`vmin` = `min(vw, vh)`，`vmax` = `max(vw, vh)`。手机竖屏时 `vmin` 是宽度，横屏时是高度，所以 `100vmin` 永远是"能放进屏幕的最大正方形边长"。

**注意**：如果只要"正方形"不要"最大"，`aspect-ratio: 1` 配一个宽度就够了，不用算 `vmin`。

### 口述回答（约 70 秒）

> 现代做法是 `aspect-ratio`，比如 `aspect-ratio: 16 / 9`，只给宽度，高度浏览器自己算；只给高度也行。它是为这个场景专门加的属性，2021 年之后主流浏览器都支持了，可以直接用。
>
> 老方案是 `padding-top` 百分比占位。因为 CSS 里百分比 padding 不管是上下左右，都是相对**包含块的宽度**算的，所以 `padding-top: 56.25%` 的高度正好是宽度的 56.25%，也就是 16 比 9。容器设 `height: 0`，里面内容用绝对定位铺满。
>
> 最大正方形，本质是取视口的短边。可以用 `width: min(100vw, 100vh)` 加 `aspect-ratio: 1`，更简洁的是直接用 `100vmin`，`vmin` 就是短边单位，横屏竖屏都成立。再配合父级 flex 或 grid 居中。
>
> 有两个坑要注意：`aspect-ratio` 同时设了宽高会失效；内容比比例高度更高时盒子会被撑开，要严格锁比例得加 `overflow: hidden`。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| 百分比 padding 相对谁？ | 相对包含块**宽度**（上下 padding 也是），这是 hack 成立的根本 |
| `aspect-ratio` 会被内容撑开吗？ | 会，除非 `overflow: hidden` 或限制 `max-height` |
| `aspect-ratio: auto 4/3` 什么意思？ | `auto` 表示优先使用元素固有比例（如图片原始比例），没有固有比例时才用 4/3 |
| `vmin` 和 `vw` 区别？ | `vmin` 取 vw/vh 中较小者，`vmax` 取较大者 |
| `100vh` 在移动端有什么问题？ | 移动浏览器地址栏收起/展开导致视口高度变化，`100vh` 会超出屏幕，用 `100dvh` 更准 |
| 图片保持比例但不变形，用 `aspect-ratio` 还是 `object-fit`？ | 比例容器用 `aspect-ratio`，图片填充方式用 `object-fit`，两者常配合 |

---

## Q20 · 单行 / 多行文本溢出省略号

> 合并原题：15

**一句话答案**：单行三件套——`overflow: hidden` + `white-space: nowrap` + `text-overflow: ellipsis`；多行用 `display: -webkit-box` + `-webkit-line-clamp: N` + `-webkit-box-orient: vertical` + `overflow: hidden`。两个高频坑：元素必须有**确定宽度**（flex 子项还要 `min-width: 0`），以及 `line-clamp` 是"截断"不是"真省略"，最后一行不会被压缩。

### 答题思路

1. 给单行代码 + 逐行解释每个属性的作用（缺一不可）。
2. 给多行代码 + 说明 `-webkit-` 前缀的现状（现在已标准化为 `line-clamp`，但兼容写法仍需前缀）。
3. 主动讲失效场景：flex 子项、table 单元格、float 布局。
4. 给不支持的降级方案（渐变遮罩、JS 计算）。

### 核心要点

**单行**

```css
.ellipsis {
  overflow: hidden;          /* 隐藏溢出部分 */
  white-space: nowrap;       /* 强制不换行，否则会折行不溢出 */
  text-overflow: ellipsis;   /* 溢出时显示省略号 */
  /* 可选：width / max-width 必须有确定值 */
}
```

三个属性各自的作用缺一不可：

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
  /* 标准属性（新浏览器） */
  line-clamp: 2;
  /* 可选：兼容旧写法 */
  word-break: break-all;
}
```

- `-webkit-line-clamp` 需要 `display: -webkit-box` 和 `-webkit-box-orient: vertical` 配合，三者缺一不可。
- 它**不是**标准的 `text-overflow` 机制：超出部分直接被裁掉，最后一行不会自动补 "…"，浏览器会在裁切处渲染省略号（视觉上是省略号，但最后一行可能显示不完整字符的一半）。
- `line-clamp` 现已进入 CSS Overflow 4 标准，但实际仍需 `-webkit-` 前缀写法。

**三个必然失效的场景**

1. **flex 子项**：子项默认 `min-width: auto`，宽度不会被压缩到内容以下，所以永远不溢出、不显示省略号。

```css
.flex-child { flex: 1; min-width: 0; }   /* 必须加 min-width: 0 */
```

2. **table 单元格**：`table-layout: auto` 时单元格宽度由内容撑开。

```css
table { table-layout: fixed; width: 100%; }
td { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

3. **float / inline-block 未定宽**：没有确定宽度就没有溢出参照，必须给 `width` 或 `max-width`。

**降级 / 替代方案**

```css
/* 1. 渐变遮罩（不显示省略号，但视觉柔和，无兼容问题） */
.mask {
  max-height: 3em;
  overflow: hidden;
  background: linear-gradient(to bottom, transparent, #fff 90%);
}

/* 2. JS 计算截断（精确控制，适合富文本 / 需要显示"展开"按钮） */
/* 3. -webkit-mask + max-height 组合 */
```

**其他相关属性（加分）**

- `word-break: break-all`：中文/英文都强制断词，适合长 URL。
- `overflow-wrap: anywhere` / `word-wrap: break-word`：只在必要时断词。
- `hyphens: auto`：英文连字符断词（需要 `lang` 属性）。
- `text-overflow: clip`：默认值，直接裁切。

### 口述回答（约 75 秒）

> 单行三件套：`overflow: hidden`、`white-space: nowrap`、`text-overflow: ellipsis`。三个缺一不可——`nowrap` 先让内容不换行从而真的溢出，`overflow: hidden` 裁掉溢出部分，`text-overflow` 才在裁切位置画省略号。另外容器必须有确定宽度，不然会撑开就永远不溢出。
>
> 多行用 `-webkit-line-clamp`，需要三个属性配合：`display: -webkit-box`、`-webkit-box-orient: vertical`、`overflow: hidden`，然后 `-webkit-line-clamp: 2` 限制行数。现在 `line-clamp` 已经进标准了，但兼容写法还是要带前缀。要注意它是直接裁切，最后一行不会被压缩成完整字符，只是视觉上有个省略号。
>
> 实战里最容易失效的是 flex 子项：因为子项 `min-width` 默认是 auto，宽度压不下去，所以永远不溢出。这时候要给子项加 `min-width: 0`。table 里则是要把 `table-layout` 设成 fixed。
>
> 如果要做"展开/收起"或者需要精确控制，就用 JS 测量截断，或者用渐变遮罩做视觉降级。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| 只写 `overflow: hidden` 会怎样？ | 内容被裁掉但没有省略号，也可能直接换行（未设 nowrap） |
| 为什么 flex 里省略号不生效？ | `min-width: auto` 阻止收缩，需 `min-width: 0` |
| `text-overflow` 能作用于多行吗？ | 不能，它只处理单行溢出 |
| `-webkit-line-clamp` 是标准属性吗？ | 已进入标准（`line-clamp`），但实现仍需 `-webkit-` 前缀 |
| 表格里怎么让省略号生效？ | `table-layout: fixed` + 单元格 `overflow: hidden` |
| 中文能正常截断吗？ | 能，中文无空格也会断行；英文长单词需 `word-break` 或 `overflow-wrap` |
| 如何显示"展开全文"？ | `line-clamp` 切换 class，或 JS 测量 `scrollHeight` 判断是否溢出 |

---

## Q21 · 图片固定尺寸、保持比例、超出裁切

> 合并原题：16

**一句话答案**：给 `img` 设定固定宽高，再加 `object-fit: cover`——图片按比例缩放填满容器，超出部分被裁掉，不变形。`object-fit` 有 5 个值：`fill`（默认，会拉伸变形）、`contain`（完整显示，可能留白）、`cover`（填满，裁剪）、`none`（原始尺寸）、`scale-down`（取 contain 和 none 中更小的）。配合 `object-position` 控制裁切位置。

### 答题思路

1. 先给标准答案 `object-fit: cover`。
2. 对比 5 个取值的视觉效果，突出 `fill` 默认值会变形这个坑。
3. 对比 `background-size: cover` + `background-position`，说明两者差异（语义、SEO、无障碍、打印）。
4. 补 `aspect-ratio` 组合用法，以及容器尺寸不确定时的写法。

### 核心要点

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

**与 `background-size` 的对比（常被追问）**

| 维度 | `img` + `object-fit` | `background-image` + `background-size` |
|---|---|---|
| 语义 | 内容图片，可被 SEO 抓取 | 装饰性图片 |
| 无障碍 | 有 `alt`，读屏可识别 | 无替代文本，需 ARIA |
| 打印 | 默认会打印 | 默认不打印背景图 |
| 懒加载 | 原生 `loading="lazy"` | 需 JS 或 CSS 技巧 |
| 响应式 | `srcset` / `sizes` / `<picture>` | 需媒体查询切换 |
| 裁切控制 | `object-position` | `background-position` |
| 多图/渐变叠加 | 单张 | 支持多重背景 |

**结论**：内容图片（商品图、文章配图、头像）用 `img + object-fit`；纯装饰背景用 `background`。

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
- `object-view-box`：可以"取景框"式裁切图片局部（新特性，兼容性有限）。
- `aspect-ratio` + `object-fit` 是最常见的组合，用于图片墙、视频封面。

### 口述回答（约 60 秒）

> 标准做法是给 img 设固定的宽高，然后 `object-fit: cover`。cover 的意思是保持原始比例缩放到**刚好填满**容器，超出的部分裁掉，所以不会变形。裁切位置用 `object-position` 控制，默认居中，做头像一般设 top center 保住头部。
>
> 要理解它和默认值的差别：`object-fit` 默认是 `fill`，直接拉伸到容器尺寸，图片会变形，这是很多人图片被拉扁的原因。`contain` 是完整显示，可能留白；`scale-down` 是取 contain 和 none 里更小的那个。
>
> 它和 `background-size: cover` 效果一样，但选择上有讲究：内容图片用 img 加 object-fit，因为能被搜索引擎抓、有无障碍的 alt、支持原生懒加载和 srcset；纯装饰性的背景才用 background。
>
> 实际做卡片封面时，我会配合 `aspect-ratio: 16/9` 让容器自己有比例，再 `object-fit: cover`，这样宽高都不写死也能自适应。

### 可能被追问

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
