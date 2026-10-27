# CSS · 03 布局与定位

> 覆盖原题：4、5、8、12、17、23、31、38、40、41、42、52、53、55、60、61（部分）
> 合并后 6 个知识点

---

## 目录

- [本主题速查](#本主题速查)
- [Q10 · 浮动的特性与清除浮动](#q10--浮动的特性与清除浮动)
- [Q11 · BFC 块级格式化上下文](#q11--bfc-块级格式化上下文)
- [Q12 · position 五个取值](#q12--position-五个取值)
- [Q13 · absolute 到底相对谁定位](#q13--absolute-到底相对谁定位)
- [Q14 · flex 布局与 flex:1](#q14--flex-布局与-flex1)
- [Q15 · 两栏 / 三栏 / 圣杯 / 双飞翼](#q15--两栏--三栏--圣杯--双飞翼)
- [本主题自测](#本主题自测)

---

## 本主题速查

| 编号 | 知识点 | 合并自 |
|---|---|---|
| Q10 | 浮动的特性与清除浮动 | 12、55 |
| Q11 | BFC 块级格式化上下文 | 4、31、52 |
| Q12 | position 五个取值 | 23、40、61 |
| Q13 | absolute 到底相对谁定位 | 60 |
| Q14 | flex 布局与 flex:1 | 5、17、41 |
| Q15 | 两栏 / 三栏 / 圣杯 / 双飞翼 | 8、38、42、53 |

主线：正常流怎么排（块级/行内/浮动）→ 如何脱离正常流（float、position）→ 如何阻断相互影响（BFC）→ 现代布局怎么排（flex/grid）。

---

## Q10 · 浮动的特性与清除浮动

**一句话答案**：`float` 让元素靠左/靠右并**半脱离文档流**——块级盒子不再为它让位，行盒（文字）绕开它形成环绕；副作用是父元素高度塌陷。清除方式有 clearfix、父级建 BFC（`flow-root`、`overflow`），以及直接改用 flex/grid。

### 核心要点

**四个特性**

1. **脱离文档流但不脱离文本流**：后续块级盒当它不存在，实测从 `top: 0; left: 0` 起排、被浮动覆盖；行盒收缩避让，实测文字首行 `left: 100px`（浮动宽 100）。所以准确说法是"半脱离"。
2. **向指定方向靠拢**：多个浮动元素依次排列，一行放不下就换行，换行时可能被更高的浮动元素卡住，出现参差不齐。
3. **块级化**：`display` 计算值变成 `block`（实测浮动的 `span` 计算值为 `block`），因此可设宽高，`width` 默认收缩包裹内容而非撑满。
4. **父元素高度塌陷**：父元素计算高度时忽略浮动子元素，实测父级 `height: 0`，后续元素顶上来。

**`clear` 的作用**

`clear: left/right/both` 表示该元素的**外边距上边界**不得与前面的浮动元素相邻，浏览器插入 clearance 把它推到浮动下方。它只作用于块级盒：实测 `clear: both` 的 `span` 仍在 `top: 0`，同样声明的块级 `div` 被推到 `top: 100`。

**清除浮动方案**

```css
/* 1. clearfix（老项目兼容） */
.clearfix::after {
  content: '';
  display: table;   /* 或 block */
  clear: both;
}

/* 2. 父级建 BFC：overflow 会裁剪溢出内容 */
.parent { overflow: hidden; }  /* 或 auto */

/* 3. 父级建 BFC：无副作用 */
.parent { display: flow-root; }

/* 4. 空标签 clear: both，或让父级也浮动 */
```

| 方案 | 代价 |
|---|---|
| `::after` clearfix | 需要额外类名 |
| `overflow: hidden/auto` | 裁剪溢出内容；该父级成为 sticky 的滚动容器，sticky 不再相对视口粘住 |
| `display: flow-root` | 无（实测父级高度由 0 变 100） |
| 空标签 / 父级浮动 | 多余 DOM / 塌陷转移给祖父级 |
| flex / grid | 不产生浮动，不需要清除 |

### 口述要点

- 定性：半脱离——块级盒忽略它，行盒避让它。
- 四个特性：靠边排列、块级化、收缩包裹、父级高度塌陷。
- 清除的本质：让块级盒的上外边距不与浮动相邻，由 clearance 顶下去。
- 方案取舍：现代用 `flow-root`；`overflow` 方案要接受裁剪溢出内容的代价。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| 浮动元素会脱离文档流吗？ | 半脱离：块级流忽略它，行盒避让它 |
| 为什么 `overflow: hidden` 能清浮动？ | 它让父元素成为 BFC，BFC 计算高度时包含浮动子元素 |
| `clear: both` 为什么必须放在块级元素上？ | clearance 只作用于块级盒；行内盒加 `clear` 不产生位移 |
| 浮动元素之间的 margin 会合并吗？ | 不会，margin 合并只发生在同一 BFC 内的普通流块级盒之间 |
| 如何实现"左侧固定、右侧自适应"，不用 flex？ | 左浮动 + 右侧 `overflow: hidden`（BFC 不与浮动重叠）或 `margin-left` |
| `float` 还能用在哪些地方？ | 文字环绕图片、首字下沉、老式栅格 |

---

## Q11 · BFC 块级格式化上下文

**一句话答案**：BFC 是一块独立的块级渲染区域，内部布局不影响外部，外部也不影响内部。三个实用作用：包含浮动子元素、阻止父子 margin 合并、不与浮动元素重叠。

### 核心要点

**定义**

BFC（Block Formatting Context）是隔离的独立容器，容器内的元素不会在布局上影响外部元素。关键性质是"隔离"，不是某条具体规则。

**触发条件（满足任一即创建）**

| 类别 | 条件 |
|---|---|
| 溢出 | `overflow` 不为 `visible`（`hidden`/`auto`/`scroll`/`clip`） |
| 浮动 | `float` 不为 `none` |
| 定位 | `position: absolute` / `fixed` |
| 显示类型 | `display: inline-block`、`table-cell`、`table-caption`、`flow-root` |
| 弹性/网格子项 | flex / grid 容器的**子项** |
| 多列 | `column-count` / `column-width` 不为 `auto` |
| 性能/隔离 | `contain: layout` / `paint` / `content` |

`display: flex` / `grid` / `table` 的元素本身建立的是 FFC/GFC/TFC，不是 BFC，但同样是隔离的格式化上下文。

**五条布局规则**

1. 内部块级盒在**垂直方向**依次排列。
2. 同一 BFC 内相邻块级盒的**垂直 margin 会合并**（父子、兄弟都会）；不同 BFC 之间不会。
3. BFC 区域**不与浮动元素重叠**。
4. 计算 BFC 高度时**包含浮动子元素**。
5. 内部元素不影响外部布局。

**三个应用**

```css
/* 1. 包含浮动：父级高度由 0 变 100（实测） */
.parent { display: flow-root; }

/* 2. 阻止父子 margin 合并：子元素 margin-top 不再把父级一起顶下去
      实测普通父级与子元素 top 同为 240；父级加 overflow: hidden 后父级 260、子元素 300 */
.parent { overflow: hidden; }  /* 或加 padding/border */

/* 3. 自适应两栏：右侧 BFC 不与左侧浮动重叠，自动占满剩余宽度 */
.left  { float: left; width: 200px; }
.right { overflow: hidden; }
```

兄弟 margin 合并：给其中一个包一层 BFC，或改用 flex/grid 布局。

**格式化上下文家族**

| 类型 | 全称 | 建立方式 |
|---|---|---|
| BFC | Block Formatting Context | 见上表 |
| IFC | Inline Formatting Context | 块级容器内出现行内内容 |
| FFC | Flex Formatting Context | `display: flex` |
| GFC | Grid Formatting Context | `display: grid` |
| TFC | Table Formatting Context | `display: table` |

**边界**

- 不影响 `z-index`，那是层叠上下文。
- 不能阻止浮动元素自己溢出父级，要靠 `overflow` 或 clear。
- 相邻兄弟的 margin 合并不因父级是 BFC 而消失，因为它们在同一个 BFC 内。

### 口述要点

- 定义落在"隔离"：内部不影响外部，外部不影响内部。
- 触发条件按六类记：溢出、浮动、定位、显示类型、flex/grid 子项、contain。
- 三条实用规则：包含浮动 → 清浮动；不与浮动重叠 → 自适应两栏；同 BFC 才合并 margin → 父子穿透。
- 边界：管不了 `z-index`，也管不了同一 BFC 内兄弟的 margin 合并。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| BFC 和层叠上下文有什么区别？ | BFC 管布局隔离，层叠上下文管绘制层级；一个元素可以同时是两者 |
| 为什么 `display: flex` 不算 BFC？ | 它建立 FFC，子项不合并 margin、没有浮动概念，但同样隔离 |
| margin 合并的三种情况？ | 相邻兄弟、父子（无 padding/border/内容隔开）、空元素自身上下 margin |
| 怎么阻止父子 margin 穿透？ | 父级建 BFC、加 padding/border、或改用 flex/grid |
| BFC 能解决高度塌陷吗？ | 由浮动引起时能；由 absolute 子元素引起时不能（绝对定位不参与父级高度计算） |
| `contain: paint` 和 BFC 的关系？ | 它会建立 BFC 并裁剪绘制，额外还有性能收益 |

---

## Q12 · position 五个取值

**一句话答案**：五个值的差别只有两个维度——参照物、是否脱标；`relative` 与 `sticky` 保留原位置，`absolute` 与 `fixed` 脱标。`z-index` 适用于定位元素与 flex/grid 子项，普通的静态块级盒不适用。

### 核心要点

| 值 | 参照物 | 脱标 | 原位置占位 | 可作 abs 参照 | 典型用途 |
|---|---|---|---|---|---|
| `static` | 无（正常流） | 否 | 是 | 否 | 默认 |
| `relative` | **自身原来的位置** | 否 | **是** | **是** | 微调、给子元素做参照 |
| `absolute` | 最近的非 static 祖先（padding box） | 是 | 否 | 是 | 角标、气泡、弹层 |
| `fixed` | 视口（除非祖先有 transform 等） | 是 | 否 | 是 | 吸底按钮、悬浮导航 |
| `sticky` | 最近的滚动容器（受包含块限制） | 否 | 是 | 是 | 表头吸顶、楼层导航 |

**关键特性**

- `static`：`top/right/bottom/left` 与 `z-index` 都无效。
- `relative`：视觉偏移，原位置仍占着（实测后续块级盒的 `top` 不受影响），不影响其他元素布局。参照物是自身原位置，不是父元素。工程价值主要是给 `absolute` 子元素当参照，所以常见 `.card { position: relative }` 却不写 `top/left`。
- `absolute`：完全脱标，后面的元素会补上来；会块级化（实测 `span` 变成 `block`）并建立 BFC；不计入父级高度，所以它引起的塌陷 BFC 也救不了。参照物见 Q13。
- `fixed`：参照视口，滚动不动。祖先有 `transform`/`filter`/`perspective`/`will-change` 时改为相对该祖先定位——实测祖先 `margin: 100px` 内 `fixed; top: 0` 落在 `top: 100`，页面滚 200 后变成 `-100`，跟着文档走了。
- `sticky`：行为介于 relative 和 fixed 之间，滚动到阈值前像 relative，到阈值后像 fixed，但始终不脱标。生效条件：
  1. 必须设 `top/bottom/left/right` 中至少一个作为阈值（不写阈值时滚动不会粘住，实测 `top` 随滚动从 100 变 -100）。
  2. 它相对最近的滚动容器粘住。祖先若有 `overflow: hidden`，该祖先就是滚动容器且自身不滚动，页面滚动时 sticky 会跟着走，看起来"失效"（实测 `top` 从 100 变 -100）。
  3. 粘住范围受包含块限制，父级滚出视口后 sticky 跟着走：实测父级底边 -100 时，sticky 底边也是 -100，不会越过父级。

```css
/* 表头吸顶 */
.table-header {
  position: sticky;
  top: 0;
  z-index: 10;   /* 防止被内容盖住 */
}
```

**`z-index` 的适用范围**

`z-index` 对定位元素（`relative`/`absolute`/`fixed`/`sticky`）与 flex/grid 子项生效，对普通静态块级盒无效：实测静态块级元素加 `z-index: 1` 仍被后出现的兄弟盖住；同样的 flex/grid 子项加 `z-index: 1` 后压住了后出现的兄弟。它只在同一层叠上下文内比较，祖先建立新的层叠上下文后，子元素的 `z-index` 不参与外层排序。

### 口述要点

- 按"参照物 + 是否脱标 + 是否占位"三个维度说五个值。
- `relative` 的工程价值是给 `absolute` 当参照，不是微调。
- `fixed` 的失效原因是祖先建立了包含块。
- `sticky` 三个前提：阈值、可滚动的滚动容器、父级提供的粘住范围。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| `relative` 会脱标吗？ | 不会，原位置保留，只是视觉偏移 |
| `absolute` 相对 padding box 还是 content box？ | padding box（含 padding 区域，不含 border） |
| `fixed` 为什么会失效？ | 祖先有 transform/filter/perspective/will-change/contain，会建立包含块，fixed 改为相对它定位 |
| `sticky` 不生效怎么排查？ | 先看有没有写阈值，再看滚动容器是不是不滚动的 `overflow: hidden` 祖先，最后看父级高度是否够粘 |
| 定位元素需要写 `z-index` 吗？ | 默认 `z-index: auto`，不加也参与层叠，按文档顺序绘制；要压住其他定位元素才需要显式写 |
| 绝对定位元素的宽高百分比相对谁？ | 相对包含块的 padding box |
| `position: absolute` 会导致父元素高度塌陷吗？ | 会，父级高度不包含它，BFC 也解决不了 |

---

## Q13 · absolute 到底相对谁定位

**一句话答案**：`absolute` 相对**最近的、`position` 不为 `static` 的祖先**的 padding box 定位；一路向上都没有这样的祖先时，相对**初始包含块（initial containing block）**定位——尺寸等于视口、位于文档原点，所以会随页面滚动而移动，看起来"像相对 body"，但它不是 body。

### 核心要点

**定位祖先的查找规则**

从元素自身向上遍历 DOM，第一个 `position` 为 `relative`/`absolute`/`fixed`/`sticky` 的祖先即为它建立**包含块**：

- 参照该祖先的 **padding box**（padding 的外边缘，不含 border）：实测祖先 `border: 10px` 时，`top: 0; left: 0` 的子元素相对 border box 偏移 10px。
- 宽高百分比也按这个 padding box 计算：实测 padding box 宽 340，子元素 `width: 50%` 得到 170。

**没有定位祖先时**

包含块是**初始包含块（ICB）**：

- 尺寸 = **视口大小**，不是文档高度也不是 body 的实际高度：实测视口 1000，`left: 0; right: 0` 的元素宽 1000。
- 位置在**文档原点**，所以绝对定位元素随页面滚动而移动：实测页面滚 500 后它的 `top` 从 0 变 -500。
- 它**不是 `<body>` 元素**：ICB 只是布局矩形，body 有 margin、背景、border。给 `html` 或 `body` 设 `position: relative` 后，body 才成为真正的定位祖先——这才是"相对 body"说法的来源。

**不只是 position 会产生包含块**

以下祖先也会成为绝对定位后代的包含块：

- `transform` 不为 `none`
- `filter` / `backdrop-filter` 不为 `none`
- `perspective` 不为 `none`
- `will-change` 指定了上述属性
- `contain: layout` / `paint` / `strict` / `content`
- `content-visibility: auto`

同一个原因也让 `position: fixed` 退化（Q12）。

**验证方法**

```js
console.log(el.offsetParent);  // 布局意义上的定位祖先（或最近的 table/td/body）
```

`offsetParent` 返回 `null` 的情况：`display: none`、`<body>`/`<html>` 自身、以及没有 transform 类包含块的纯 `fixed` 元素（有这类祖先时返回该祖先）。

```css
/* 组件根节点统一挂 relative，避免子元素跑到最外层 */
.modal { position: relative; }
.modal__close { position: absolute; top: 8px; right: 8px; }
```

### 口述要点

- 规则一句话：向上找最近的 `position != static` 祖先，相对它的 padding box 定位。
- 找不到就是初始包含块：尺寸等于视口、位于文档原点、随页面滚动，不是 body。
- 能建立包含块的不只是 position，还有 `transform`/`filter`/`perspective`/`will-change`/`contain`。
- 调试直接看 `offsetParent`。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| 初始包含块和 body 的区别？ | ICB 是布局矩形，尺寸等于视口，不是元素；body 有盒模型，尺寸由内容决定 |
| 为什么给 html/body 加 `position: relative` 就能"相对 body"？ | 它们成了真正的定位祖先，包含块换成它们的 padding box |
| 绝对定位元素会随页面滚动吗？ | 没有定位祖先时会（相对 ICB）；祖先在文档流中时随祖先滚动 |
| `transform` 为什么影响定位？ | 它建立包含块（同时是层叠上下文），绝对/固定定位后代改为相对它定位 |
| 绝对定位元素能设 `z-index` 吗？ | 能，定位元素天然适用 `z-index` |
| `offsetParent` 和 `parentNode` 一样吗？ | 不一样，前者是布局意义上的定位祖先，后者是 DOM 父节点 |
| 绝对定位元素的 `width: 100%` 相对谁？ | 相对包含块 padding box 的宽度 |

---

## Q14 · flex 布局与 flex:1

**一句话答案**：`flex` 是 `flex-grow`、`flex-shrink`、`flex-basis` 的简写。`flex: 1` 展开是 `1 1 0%`——可放大、可缩小、零基准，所以按比例平分容器；`flex: 1 0 0` 只是不允许缩小，内容过长时压不下去，容易撑破容器。

### 核心要点

**三个值**

| 属性 | 作用 | 默认值 |
|---|---|---|
| `flex-grow` | 剩余空间如何放大，按比例分配 | 0（不放大） |
| `flex-shrink` | 空间不足时如何缩小，按 basis 加权收缩 | 1（可缩） |
| `flex-basis` | 分配前的初始主轴尺寸，`auto` 表示参考 `width`/内容 | `auto` |

**简写规则**

```css
flex: 1;          /* → 1 1 0%   ：零基准，严格等分 */
flex: auto;       /* → 1 1 auto ：按内容占位后再分剩余空间 */
flex: none;       /* → 0 0 auto ：不放大不缩小 */
flex: 1 0 auto;   /* → 1 0 auto ：基准取内容宽度，可放大不可缩 */
flex: 1 0 0;      /* → 1 0 0px  ：零基准，不可缩 */
flex: 0 1 200px;  /* → 0 1 200px：固定 200，可缩不放 */
```

`flex-basis` 的零值有两种写法：单值 `flex: 1` 时规范补 `0%`；简写里显式写无单位 `0`（`flex: 1 0 0` 的第三个值）按长度 0 处理，计算值是 `0px`。两者在布局上都是零基准，所以 `flex: 1` 与 `flex: 1 0 0` 的实际差别只在 `flex-shrink`（1 vs 0）。

**`basis: 0` 与 `auto` 的差异**

- `basis: 0`：忽略内容宽度，容器空间全部作为剩余空间按 `grow` 分配。实测三个内容长度不同的 `flex: 1` 子项，容器 600 时各 200，严格等宽。
- `basis: auto`：先按内容宽度占位，再分配剩余空间。实测两个 `flex: auto` 子项分别 210.7 与 389.3。
- 结论：严格等分用 `flex: 1`，内容优先再分配用 `flex: auto`。

**`min-width: auto` 导致 shrink 失效**

flex 子项的 `min-width` 默认值是 `auto`，含义是"不小于内容的最小尺寸"。子项内部有长单词、`white-space: nowrap` 等内容时，`flex-shrink: 1` 也压不下去，会撑破容器。

```css
.item {
  flex: 1;
  min-width: 0;   /* 允许收缩到内容以下，省略号生效的前提 */
}
```

实测容器 300、两个 `flex: 1` 子项，其中一个含长 nowrap 文本时，子项宽度为 672.8 与 37.9，容器 `scrollWidth` 711；给子项加 `min-width: 0` 后回到 150 / 150。实现省略号时同理，横向主轴要 `min-width: 0`，纵向要 `min-height: 0`。

**常用布局**

```css
/* 左固定 + 右自适应 */
.row { display: flex; }
.side { flex: 0 0 200px; }
.main { flex: 1; min-width: 0; }

/* 三等分 */
.row > .col { flex: 1; }

/* 垂直居中 + 两端对齐 */
.row { display: flex; align-items: center; justify-content: space-between; }

/* 自动换行 + 等宽卡片 */
.list { display: flex; flex-wrap: wrap; gap: 16px; }
.list > .card { flex: 1 1 240px; }
```

**边界**

- flex 是一维布局，二维用 grid。
- flex 子项的 margin 不合并（实测相邻间距保留 20 + 30 = 50）。
- flex 容器内的 float 失效，`::before/::after` 会成为 flex 子项。
- `justify-content` 管主轴，`align-items` 管交叉轴；`flex-direction: column` 时两者方向对调。
- `gap` 已可用于 flex。

### 口述要点

- `flex: 1` 与 `flex: 1 0 0` 只差 shrink：前者可缩，后者不可缩、长内容会撑破。
- `basis: 0` 决定严格等分，`basis: auto` 决定内容优先再分配。
- 子项 `min-width: auto` 是内容兜底，要省略号就写 `min-width: 0`。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| `flex: 1` 和 `width: 100%` 的区别？ | `width: 100%` 硬性等于父级内容宽度，多个子项会溢出；`flex: 1` 参与剩余空间分配 |
| `flex-basis` 和 `width` 谁优先？ | `flex-basis` 非 auto 时优先，`width` 只在 basis 为 auto 时起作用 |
| `flex-grow` 是平均分配还是按比例？ | 按 grow 值比例分配剩余空间，不是分配总宽度 |
| `flex-shrink` 是按 shrink 值平均分吗？ | 不是，收缩量 = 超出量 × (shrink × basis) / Σ(shrink × basis) |
| `justify-content: space-between` 只有一个子项时怎样？ | 靠起始端；要居中用 `center` |
| flex 能做两维布局吗？ | 不能，需要同时控制行和列时用 grid |
| `flex: 1` 在 `flex-direction: column` 下？ | 作用于高度，父级需要有确定高度才有效 |

---

## Q15 · 两栏 / 三栏 / 圣杯 / 双飞翼

**一句话答案**：两栏三栏常见五种实现——flex、grid、float + BFC、absolute、圣杯/双飞翼（float + 负 margin，目的是让中间列在 DOM 中优先）。圣杯双飞翼的价值在于理解负 margin 和内容优先加载，工程上直接用 flex/grid。

### 核心要点

**1. flex**

```html
<div class="layout">
  <aside class="left">左</aside>
  <main class="center">中</main>
  <aside class="right">右</aside>
</div>
```

```css
.layout { display: flex; min-height: 100vh; }
.left, .right { flex: 0 0 200px; }
.center { flex: 1; min-width: 0; }  /* 内容过长时允许收缩 */
```

需要中间内容在 DOM 中靠前时配合 `order`：

```css
.center { order: 1; }
.left   { order: 0; }
.right  { order: 2; }
```

**2. grid**

```css
.layout {
  display: grid;
  grid-template-columns: 200px 1fr 200px;
  grid-template-areas: "left center right";
  min-height: 100vh;
  gap: 16px;
}
```

`1fr` 等价于 `minmax(auto, 1fr)`，最小值是内容的最小尺寸：容器 600、中间列内容不可断行时，实测三列变成 200 / 841 / 200，`scrollWidth` 1241；换成 `minmax(0, 1fr)` 后回到 200 / 200 / 200，溢出内容被裁在列内。响应式可用 `repeat(auto-fit, minmax(240px, 1fr))` 自动换行等分。

**3. 圣杯布局（Holy Grail）**

三列都 `float: left`，中间列 `width: 100%` 占满一行；左列用 `margin-left: -100%` 拉到行首，右列用 `margin-left: -200px`（自身宽度）拉到行尾；父容器用左右 padding 预留位置，再用 `relative` 把左右列推进预留区。

```html
<div class="container">
  <div class="center">中间（DOM 优先）</div>
  <div class="left">左</div>
  <div class="right">右</div>
</div>
```

```css
.container {
  padding: 0 200px;       /* 给左右列留位置 */
  overflow: hidden;       /* 清浮动 */
}
.center { float: left; width: 100%; }
.left {
  float: left; width: 200px;
  margin-left: -100%;     /* 拉到上一行最左边 */
  position: relative;
  left: -200px;           /* 推进 padding 区 */
}
.right {
  float: left; width: 200px;
  margin-left: -200px;    /* 拉到最右边 */
  position: relative;
  right: -200px;
}
```

**4. 双飞翼布局**

同样三段浮动 + 中间 100%，区别是不给父容器 padding，而是在中间列内部再套一层，用它的左右 margin 让出两侧空间。

```html
<div class="container">
  <div class="center"><div class="center-inner">中间</div></div>
  <div class="left">左</div>
  <div class="right">右</div>
</div>
```

```css
.container { overflow: hidden; }
.center { float: left; width: 100%; }
.center-inner { margin: 0 200px; }   /* 内容区让位 */
.left  { float: left; width: 200px; margin-left: -100%; }
.right { float: left; width: 200px; margin-left: -200px; }
```

**圣杯 vs 双飞翼**

| 对比 | 圣杯 | 双飞翼 |
|---|---|---|
| 让位方式 | 父级 `padding` + 子级 `relative` 偏移 | 中间列内部 `margin` |
| 额外 DOM | 无 | 多一层包裹 div |
| 定位属性 | 需要 `position: relative` | 不需要 |
| 共同点 | float + 负 margin，中间列 DOM 优先 | 同 |

**5. 其他两种**

```css
/* float + BFC：左浮动定宽，右侧 BFC 自动填满且不重叠 */
.left  { float: left; width: 200px; }
.right { overflow: hidden; }

/* absolute：容器 padding 留位，两侧绝对定位 */
.container { position: relative; padding: 0 200px; }
.left  { position: absolute; left: 0;  top: 0; bottom: 0; width: 200px; }
.right { position: absolute; right: 0; top: 0; bottom: 0; width: 200px; }
/* 缺点：绝对定位元素无法撑开父级高度 */
```

**选型**

- 新项目用 grid 或 flex，无需清浮动。
- 需要中间列优先渲染且兼容老浏览器时才用圣杯/双飞翼。
- 两栏"左固定右自适应"：`flex: 0 0 200px` + `flex: 1`，或 `float` + `overflow: hidden`。

### 口述要点

- 现代方案两行：flex（左右 `0 0 200px` + 中间 `flex: 1`）或 grid（`200px 1fr 200px`）。
- 圣杯/双飞翼的共同机制：三列浮动、中间列 100%、负 margin 拉回两侧。
- 两者差别在让位方式：圣杯给父级 padding 再用 `relative` 偏移，双飞翼在中间列内部用 margin。
- 存在理由只有一个：让中间列在 DOM 中优先加载。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| 为什么中间列要放最前面？ | 内容优先加载/渲染，SEO 与首屏体验更好，屏幕阅读器也先读主内容 |
| `margin-left: -100%` 的 100% 相对谁？ | 相对包含块的宽度（父容器内容区），所以正好把元素拉到上一行行首 |
| 圣杯为什么需要 `position: relative`？ | 负 margin 只能拉到行首，还要再向左偏移自身宽度进入父级 padding 区 |
| 双飞翼为什么不需要 relative？ | 让位由内部 margin 完成，不需要把盒子挪出父容器可视区 |
| 三栏布局父级高度怎么撑开？ | flex/grid 天然撑开；float 方案要清浮动；absolute 方案撑不开，要写死高度 |
| 如何做"两侧固定、中间自适应、且整体有最大宽度"？ | 外层 `max-width: 1200px; margin: 0 auto`，内层再 flex/grid |

---

## 本主题自测

1. 浮动"半脱离文档流"是什么意思？为什么文字会绕开？
2. 说出 BFC 的 5 条触发条件和 3 个应用。
3. `relative` 为什么"不影响布局"？它最重要的用途是什么？
4. 没有定位祖先时 absolute 相对谁？ICB 和 body 的三点区别。
5. `flex: 1` / `flex: 1 0 auto` / `flex: 1 0 0` 分别用在什么场景？
6. 手写圣杯布局，并解释每个负 margin 的作用。
