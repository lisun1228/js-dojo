# CSS · 01 基础与盒模型

> 覆盖原题：1、3、7、14、19、22、30（部分）、39、49、61（部分）
> 合并后 5 个知识点 ｜ 重要度 ★★★★ ｜ 建议时长 45 分钟

---

## 目录

- [本主题速查](#本主题速查)
- [Q1 · 盒模型与 box-sizing](#q1--盒模型与-box-sizing)
- [Q2 · 块级 / 行内 / 行内块与 display](#q2--块级--行内--行内块与-display)
- [Q3 · inline-block 的空白与底部空隙](#q3--inline-block-的空白与底部空隙)
- [Q4 · CSS 属性继承](#q4--css-属性继承)
- [Q5 · 隐藏元素的方式与区别](#q5--隐藏元素的方式与区别)
- [本主题自测](#本主题自测)

---

## 本主题速查

| 编号 | 知识点 | 合并自 |
|---|---|---|
| Q1 | 盒模型与 box-sizing | 3、39 |
| Q2 | 块级 / 行内 / 行内块与 display | 1、61 |
| Q3 | inline-block 的空白与底部空隙 | 22 |
| Q4 | CSS 属性继承 | 14、30 |
| Q5 | 隐藏元素的方式与区别 | 7、19、49 |

一句话主线：**盒模型决定"一个盒子多大"，display 决定"盒子怎么排"，继承决定"哪些属性会往下传"，隐藏方式决定"元素消失后还剩下什么"。**

---

## Q1 · 盒模型与 box-sizing

> 合并原题：3（介绍一下 box-sizing）、39（说一下盒模型）

**一句话答案**：盒模型是元素尺寸的计算方式，分标准盒模型（content-box，宽高只算内容区）和 IE 盒模型（border-box，宽高包含 padding 和 border），`box-sizing` 就是在这两种算法之间切换，工程上一般全局设为 `border-box`。

### 答题思路

1. 先画清楚四层：content → padding → border → margin。
2. 讲两种盒模型的差别，重点是 **width 到底指哪一段**。
3. 讲 `box-sizing` 的取值和默认值。
4. 落到工程实践：为什么全局 border-box，以及它的副作用。
5. 补一个 JS 取值口径（offsetWidth / getBoundingClientRect / getComputedStyle），面试官会觉得你真写过代码。

### 核心要点

- 四层结构：内容区（content）→ 内边距（padding）→ 边框（border）→ 外边距（margin）。**margin 不参与"盒子大小"计算**，它只影响盒子之间的间距。
- `content-box`（默认）：`width` 只等于 content 宽度。实际占据宽度 = width + padding×2 + border×2。
- `border-box`：`width` = content + padding + border。内容区实际宽度 = width − padding − border（可能是负数，浏览器会取 0）。
- `box-sizing` 只影响 **width / height 的计算口径**，不影响 margin，也不影响百分比参照对象。
- 工程惯例：

```css
*, *::before, *::after { box-sizing: border-box; }
```

- 副作用：使用第三方组件库（尤其是老组件、canvas、iframe）时，其内部可能依赖 content-box，全局设置会导致尺寸偏差；这类组件要单独 `box-sizing: content-box` 还原。
- JS 取值口径（高频追问）：

| API | 包含范围 |
|---|---|
| `offsetWidth` / `clientWidth` | 边框盒（border-box）。`clientWidth` 不含 border 和滚动条，`offsetWidth` 含 border |
| `getBoundingClientRect()` | 渲染后的实际尺寸（含 transform 缩放），小数精度 |
| `getComputedStyle(el).width` | **内容区**宽度，即使设了 border-box 也是减完 padding/border 之后的值 |

### 口述回答（约 60 秒）

> 盒模型描述一个元素在页面上占据的空间怎么算，从里到外是 content、padding、border、margin 四层。
>
> 它有两种算法。默认的 content-box，也就是标准盒模型，`width` 只代表内容区宽度，元素实际占的宽度还要再加 padding 和 border。IE 盒模型是 border-box，`width` 已经把 padding 和 border 算进去了，内容区等于 width 减去 padding 和 border。
>
> 两种模型的差别在写布局时特别明显：比如一个 100px 宽、左右各 10px padding 的盒子，content-box 下最终占 120px，很容易把栅格撑破；border-box 下就稳稳占 100px，内容区自动变成 80px。所以现在基本都会在 reset 里写 `*, *::before, *::after { box-sizing: border-box }`，让"写多少就是多少"。
>
> 需要注意的是，全局设了 border-box 之后，第三方组件或者 canvas 这类依赖 content-box 的地方要做还原，否则尺寸会算错。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| 什么是 IE 盒模型？ | 就是 border-box。IE6 及更早的怪异模式（quirks mode）默认用它，加 doctype 后 IE 也走标准模式 |
| `offsetWidth` 和 `getComputedStyle().width` 为什么对不上？ | 前者是边框盒尺寸（整数、含 border），后者是内容区宽度（可能带小数、不含 border）。差值是 padding + border |
| 百分比 padding 相对谁算？ | **相对包含块的宽度**，上下 padding 也是相对宽度——这是 `padding-top: 56.25%` 做 16:9 占位盒的原理 |
| margin 会影响盒子大小吗？ | 不影响，但它影响布局占位；相邻兄弟的垂直 margin 还会合并 |
| 元素设了 border-box，width 小于 padding+border 会怎样？ | 内容区被压缩到 0，盒子仍按 padding+border 撑开，`overflow` 决定内容表现 |
| 哪些属性会触发重排？ | width/height/padding/margin/border/font-size/display 等几何相关属性，详见 Q29 |

---

## Q2 · 块级 / 行内 / 行内块与 display

> 合并原题：1（行内元素和块级元素的区别）、61（position 和 display 相关问题，display 部分）

**一句话答案**：块级元素独占一行、宽高和上下 margin 都生效；行内元素不换行、宽高设置无效、垂直方向 margin 无效；行内块用行内方式排列、内部却是块级格式化，宽高生效。本质区别在于 `display` 决定元素参与哪种格式化上下文。

### 答题思路

1. 先用三条维度对比：是否换行、宽高是否生效、内外 margin/padding 表现。
2. 举典型标签，但强调**标签的默认 display 可以被 CSS 改**，所以考点是"显示类型"而不是"标签名"。
3. 讲行内元素的两个坑：垂直 padding 撑不开行高、替换元素（img/input）例外。
4. 补现代 `display` 的双值语法和 `flow-root`、`contents` 这类加分点。

### 核心要点

| 维度 | block | inline | inline-block |
|---|---|---|---|
| 是否换行 | 独占一行 | 不换行，水平排列 | 不换行 |
| width / height | 生效；默认 `width: auto` 撑满父级 | **不生效**（替换元素除外） | 生效 |
| 垂直 margin | 生效（相邻会合并） | **不生效** | 生效 |
| 垂直 padding | 生效，撑开盒子 | 视觉上生效，但**不撑开行高、不推开上下元素** | 生效 |
| 典型标签 | div、p、h1、ul、li、section | span、a、strong、em、label | img、input、button、select |
| 内部格式化 | 块级（BFC 规则） | 行内（IFC） | 块级 |

- **替换元素例外**：`img`、`input`、`video`、`canvas`、`iframe` 等替换元素，即使 `display: inline` 也能设宽高，因为它们的尺寸来自外部资源。这就是"行内元素不能设宽高"这句话唯一要补的例外。
- **行内元素的垂直 padding**：加 `padding: 20px` 后背景会向外扩，但不会把上下行推开，会盖住相邻内容——因为行盒高度由 `line-height` 和 `font-size` 决定，不由 padding 决定。
- 现代 `display` 是"外部显示类型 + 内部显示类型"的组合：

```css
display: block flow;        /* = block */
display: inline flow-root;  /* = inline-block */
display: block flex;        /* = flex */
display: flow-root;         /* 块级容器 + 内部 BFC，清浮动神器 */
display: contents;          /* 盒子本身消失，子元素提升到父级 */
```

- `display: contents` 的坑：元素本身不进渲染树，背景、边框、padding 全部失效，且部分场景下无障碍语义会丢失。
- 块化（blockification）：元素一旦 `float`、`position: absolute/fixed`、或成为 flex/grid 子项，`display` 会被强制转换成块级（`inline` → `block`，`inline-block` → `block`），所以给 `span` 加 `float: left` 后能设宽高。
- `display: none` 与 `visibility: hidden` 的区别见 Q5。

### 口述回答（约 75 秒）

> 我一般从三个维度对比。第一是排列方式：块级元素独占一行，垂直方向一个接一个堆；行内元素像文字一样水平排列，排满才换行，中间遇到换行符还会折成一个空格。第二是尺寸：块级元素的宽高、四方向 margin、padding 全部生效，默认 width 是 auto，会撑满父容器；行内元素的 width 和 height 完全无效，垂直方向的 margin 也无效。第三是内部结构：块级元素内部按块级规则排，行内元素内部是行内格式化。
>
> 行内块是折中方案，`inline-block` 对外表现像行内元素、可以并排，对内是块级，宽高生效，所以 img、input、button 都是这个类型。
>
> 有两个细节容易漏。一是"行内元素不能设宽高"要排除替换元素，img 和 input 即使 display 是 inline 也能设宽高。二是行内元素加垂直 padding，背景会撑出来，但不会把上下行推开，会盖住相邻元素。
>
> 现在 CSS 规范里 display 是双值的，`inline-block` 等价于 `inline flow-root`，还有 `flow-root` 可以创建一个干净的 BFC，比 `overflow: hidden` 更适合清浮动。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| `<a>` 里能放 `<div>` 吗？ | HTML5 规范允许（a 是透明内容模型），但 a 默认是 inline，里面放块级元素会破坏布局，一般给 a 设 `display: block` |
| 给 span 加 `float: left` 后能设宽高吗？ | 能。float/absolute 会让 display 计算值块化 |
| `display: inline-block` 和 `float: left` 的区别？ | 前者仍在文档流、父元素高度能撑开；后者脱标、导致父级高度塌陷。inline-block 有空白符问题，float 没有 |
| `flow-root` 有什么用？ | 让元素内部形成 BFC，可清浮动且不像 `overflow: hidden` 那样裁剪溢出内容 |
| `display: none` 和 `visibility: hidden`？ | 见 Q5 |
| 块级元素 `width: auto` 和 `width: 100%` 一样吗？ | 不一样。`auto` 会先扣掉 margin/border/padding 再分配，且在有 margin 时不会溢出；`100%` 是硬性等于父内容宽度，加上 padding 会溢出（content-box 下） |

---

## Q3 · inline-block 的空白与底部空隙

> 合并原题：22（display: inline-block 问题 / 基线对齐）

**一句话答案**：`inline-block` 有两个不同的"空隙"问题——横向是 HTML 换行符被折叠成空格，宽度等于父元素 `font-size`；纵向是行内块默认按 `baseline` 对齐，基线下方还有 descender 空间。前者靠 `font-size: 0` 或去掉空白解决，后者靠 `vertical-align` 解决。

这道题答得好不好，能直接区分"背过"和"调过"。

### 答题思路

1. 先纠正题面：inline-block 的问题不止基线对齐，横向也会多出空白，两者原因不同。
2. 分别讲成因 + 解法。
3. 最后给工程结论：现代直接用 flex/grid，别再用 inline-block 做栅格。

### 核心要点

**问题一：横向空白（元素之间多出几像素）**

- 成因：inline-block 参与行内格式化上下文（IFC），HTML 源码中的换行、缩进、空格被当作**文本节点**，连续空白折叠成一个空格，宽度由父元素的 `font-size` 决定（16px 字体下一个空格约 4~5px）。
- 解法：
  1. 父元素 `font-size: 0`，子元素重置字号（最常见）；
  2. 源码中不留空白：标签紧贴、或用 HTML 注释 `<!-- -->` 隔开；
  3. 父元素改 `display: flex` / `grid`（现代首选）；
  4. 负 `letter-spacing` / 负 `word-spacing` 抵消（不推荐，受字体影响）；
  5. 构建时压缩 HTML。

**问题二：纵向底部空隙**

- 成因：`inline-block` 的基线是**最后一个行盒的基线**（无内容时是底边 margin 边），父级行盒按 `vertical-align: baseline` 对齐，基线下方还要留出字体的 descender（字母 g、p 的下伸部分）空间，所以盒子底部和父容器底部之间有几像素缝隙。
- 解法：
  1. 父元素 `line-height: 0`；
  2. 元素设 `vertical-align: top / middle / bottom`；
  3. 图片直接 `display: block`（脱离 IFC，最干净）；
  4. 父元素 `font-size: 0`（间接让行盒高度归零）。

```css
/* 图片底部缝隙的经典修复 */
img { display: block; }
/* 或者 */
.parent { line-height: 0; }
```

### 口述回答（约 70 秒）

> 这个问题其实是两个独立的空隙，很多资料混在一起讲。
>
> 第一个是横向的。inline-block 元素是在行内格式化上下文里排的，HTML 里标签之间的换行和缩进会被当成文本节点，空白折叠成一个空格，宽度跟父元素的 font-size 有关。所以三个 33.33% 宽的盒子放不下，会掉行。解决办法是父元素 `font-size: 0`，子元素再单独设字号；或者干脆把标签写在一起不留空白；最省事的是父级直接用 flex。
>
> 第二个是纵向的。inline-block 默认按基线对齐，父级行盒的基线下方还要给字母 g、p 这种下伸部分留空间，所以图片或者行内块下面会有几像素缝。解决是给元素 `vertical-align: top` 或者 middle，或者父级 `line-height: 0`，图片最直接的办法是 `display: block`。
>
> 当然现在做栅格都用 flex 和 grid 了，这两个坑基本不用踩，但排查老项目或者图片缝隙时还是会遇到。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| 为什么 `font-size: 0` 能同时解决两个空隙？ | 空格宽度为 0 且 `line-height` 若为无单位值也随之归零，行盒高度塌到内容高度 |
| 图片底部的缝隙还有别的原因吗？ | 如果 img 是 `display: inline`，本身就是行内替换元素，同样按 baseline 对齐，缝隙同源 |
| inline-block 和 vertical-align 的关系？ | `vertical-align` 只对 inline / inline-block / table-cell 生效，对块级元素无效 |
| 为什么 flex 子项没有这个问题？ | flex 容器建立 FFC，子项不是行内盒，空白文本节点不产生匿名 flex item（纯空白被忽略） |
| `white-space: nowrap` 能解决横向空白吗？ | 不能，它只阻止换行，空白字符仍在 |

---

## Q4 · CSS 属性继承

> 合并原题：14（哪些属性可以继承）、30（选择器有哪些？哪些属性可以继承）

**一句话答案**：继承是子元素在没有自己声明某属性时，自动取父元素计算值的机制。可以继承的主要是**文字排版类**属性（font、color、text-*、line-height、visibility、cursor、list-style），布局盒模型类（width/height/margin/padding/border/background/position/display）一律不继承。

### 答题思路

1. 先给判断规律：跟"文字和排版"相关的通常继承，跟"盒子和布局"相关的通常不继承。
2. 分类列清单，不要零散背。
3. 讲 4 个显式控制关键字：inherit / initial / unset / revert，以及 `all`。
4. 主动提 line-height 的继承陷阱——这是本题唯一有杀伤力的追问。

### 核心要点

**可继承（Inherited: yes）**

- 字体：`font-family`、`font-size`、`font-weight`、`font-style`、`font-variant`
- 文本：`color`、`text-align`、`text-indent`、`text-transform`、`letter-spacing`、`word-spacing`、`line-height`、`white-space`、`word-break`、`direction`
- 列表：`list-style`、`list-style-type`、`list-style-position`
- 其他：`visibility`、`cursor`、`quotes`、`border-collapse`、`border-spacing`、`caption-side`、`orphans`、`widows`

**不可继承**

- 盒模型：`width`、`height`、`margin`、`padding`、`border`、`box-sizing`
- 背景：`background` 全家
- 布局：`display`、`position`、`float`、`clear`、`z-index`、`overflow`、`flex` 相关、`grid` 相关
- 其他：`opacity`、`transform`、`vertical-align`、`text-decoration`（注意：不继承，但视觉上会"穿透"到子元素，因为装饰线是绘制在祖先上的）

**四个控制关键字**

| 关键字 | 含义 |
|---|---|
| `inherit` | 强制取父元素的计算值 |
| `initial` | 取该属性在规范里的初始值（如 `color` 是 canvastext，`display` 是 inline） |
| `unset` | 有继承性的属性等同 `inherit`，无继承性的等同 `initial` |
| `revert` | 回滚到浏览器/用户样式表的层叠结果 |

- `all: unset` 可以一键清空所有属性（慎用，会连 `display` 一起干掉）。

**最大的坑：line-height 的继承**

| 写法 | 继承的是 | 子元素 20px 字号时的行高 |
|---|---|---|
| `line-height: 1.5` | 数值本身 | 20 × 1.5 = **30px**（推荐） |
| `line-height: 150%` | **计算后的像素值** | 16 × 1.5 = 24px（跟着父级字号定死） |
| `line-height: 1.5em` | **计算后的像素值** | 同上 24px |

所以全局 `line-height` 一定用无单位数值。

**继承与优先级无关**：继承来的值优先级最低，任何直接命中选择器的声明都能覆盖它，甚至 `*` 通配符（优先级 0）也能覆盖继承值。

### 口述回答（约 70 秒）

> 继承是说子元素没有显式声明某个属性时，直接用父元素的计算值。判断规律很好记：跟文字排版有关的会继承，跟盒子布局有关的不会。
>
> 会继承的典型是 font 系列、color、text-align、text-indent、line-height、letter-spacing、white-space，还有 list-style、visibility、cursor。不会继承的是 width、height、margin、padding、border、background、display、position、float、z-index、opacity、transform 这些。
>
> 有个容易记错的：`text-decoration` 本身不继承，但它的下划线是画在祖先元素上的，所以视觉上会穿过子元素，看起来像继承了。
>
> 想显式控制可以用四个关键字：inherit 强制继承，initial 回到规范初始值，unset 是前两者的自动判断，revert 回到浏览器默认样式；`all: unset` 可以一次性重置。
>
> 实际项目里最容易踩的是 line-height。写 `1.5` 继承的是这个倍数，子元素按自己字号算；写 `150%` 或 `1.5em` 继承的是算完的像素值，子元素字号变大后行高就偏小了。所以全局 line-height 一定要用无单位数字。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| 继承的优先级是多少？ | 最低。继承值不进层叠比较，任何命中该元素的声明都能覆盖 |
| `font-size` 的百分比和 em 相对谁？ | 相对**父元素**的 font-size；而 `line-height` 的百分比相对**自身** font-size |
| `background-color` 为什么不继承？ | 由 box 绘制模型决定，若继承会导致每层盒子重复绘制背景 |
| `visibility: hidden` 会继承吗？ | 会。这正是子元素可以设 `visibility: visible` 单独显示的原因（display: none 做不到） |
| 表单元素为什么不吃继承的字体？ | `input`/`button` 等在 UA 样式表里有显式 font 声明，需要手动 `font: inherit` |
| CSS 变量继承吗？ | 继承。自定义属性默认继承，这也是主题切换的实现基础 |

---

## Q5 · 隐藏元素的方式与区别

> 合并原题：7（至少三种方法）、19（有哪些方式）、49（方式及区别）

**一句话答案**：常用 5 种——`display: none`（不渲染不占位）、`visibility: hidden`（占位不可见）、`opacity: 0`（占位透明仍可交互）、移出视口或 `clip-path`（占位但不可见）、`content-visibility: hidden`（保留布局盒子但跳过内部渲染）。选型看四点：是否占位、能否过渡、是否可交互/可聚焦、是否影响性能。

### 答题思路

1. 先给 5–6 种方案，每种一句话定性。
2. 用一张对比表把维度拉齐（占位 / 渲染树 / 可点击 / 可聚焦 / 可被读屏 / 可动画 / 触发重排重绘）。
3. 给选型结论，落到场景。
4. 补 `display: none` 无法做过渡的替代方案（`visibility` + `opacity` 组合）。

### 核心要点

| 方式 | 占位 | 在渲染树 | 可点击/聚焦 | 读屏可读 | 可 transition | 开销 |
|---|---|---|---|---|---|---|
| `display: none` | 否 | 否 | 否 | 否 | 否 | 触发重排 |
| `visibility: hidden` | 是 | 是 | 否 | 否 | 是（可延迟切换） | 触发重绘 |
| `opacity: 0` | 是 | 是 | **是** | 是 | 是 | 合成层，开销低 |
| `transform: scale(0)` | 是 | 是 | 否（尺寸为 0） | 是 | 是 | 合成，开销低 |
| `clip-path: inset(50%)` | 是 | 是 | 否 | **是** | 是 | 重绘 |
| `position: absolute; left: -9999px` | 否（脱标） | 是 | 可聚焦（会滚动） | 是 | — | 低 |
| `content-visibility: hidden` | 是 | 是（跳过内容渲染） | 否 | 否 | 否 | **最低**（不渲染子树） |
| `width: 0; height: 0; overflow: hidden` | 否（占 0 尺寸） | 是 | 否 | 部分可读 | 是（尺寸动画） | 中 |
| `hidden` 属性 | 否 | 否 | 否 | 否 | 否 | 等同 display: none |

关键差异解释：

- `display: none`：元素不生成盒子，**不在渲染树里**，子孙全部消失且无法救回；`transition` 完全失效（因为起始和结束状态之间没有可插值的盒子）。DOM 仍在，`offsetWidth` 为 0。
- `visibility: hidden`：盒子仍在，占位，只是不绘制；**子元素可以 `visibility: visible` 复活**；不能聚焦、不响应事件；支持 `transition`（`visibility` 是离散动画，配合 `transition: visibility 0s .3s` 可做"淡出后再隐藏"）。
- `opacity: 0`：完全透明但**仍在渲染树、仍接收鼠标事件、仍可 Tab 聚焦、读屏仍会读**。这是它最大的坑——做"视觉隐藏"时要补 `pointer-events: none` 或 `visibility: hidden`。
- `clip-path: inset(50%)` / `.sr-only` 方案：视觉隐藏但对屏幕阅读器可见，是无障碍场景的标准做法。

```css
/* 无障碍友好的视觉隐藏 */
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  margin: -1px; padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
```

- `content-visibility: hidden`：保留元素的布局盒子（尺寸由 `contain-intrinsic-size` 提供），但跳过整棵子树的样式、布局、绘制。长列表/折叠面板用它比 `display: none` 更省，因为切换时不需要重建。

### 口述回答（约 80 秒）

> 我一般按"消失之后还剩什么"来分类。
>
> 第一种 `display: none`，元素不生成盒子，不进渲染树，不占位、不能点击、读屏也读不到，子孙元素也救不回来。它不能做 transition，因为根本没有可插值的盒子。切它会触发重排。
>
> 第二种 `visibility: hidden`，盒子还在、占位也在，只是不绘制。它的特点是子元素可以设 `visibility: visible` 单独显示，而且它支持 transition，常配合 opacity 做淡出后再隐藏。
>
> 第三种 `opacity: 0`，完全透明，但仍然占位、仍然能点击、能 Tab 聚焦，读屏也会读。所以做纯视觉隐藏时，我会补一个 `pointer-events: none` 或者 `visibility: hidden`。
>
> 第四种是裁切类，比如 `clip-path: inset(50%)` 或者老办法 `position: absolute; left: -9999px`，这类是视觉上隐藏但对读屏可见，做无障碍的 sr-only 就用它。
>
> 第五种是 `content-visibility: hidden`，保留布局盒子但跳过子树渲染，适合长列表或者折叠面板，性能最好。
>
> 选型上：要做动画就 opacity 或 visibility；要彻底移除就 display: none；要兼顾无障碍就 clip-path。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| `display: none` 的元素能获取到尺寸吗？ | 不能，`offsetWidth` 为 0。需要测量时先临时设为 `visibility: hidden; position: absolute` 或 `display: block` 再测 |
| 如何让元素淡出后再彻底隐藏？ | `opacity: 0` + `visibility: hidden`，用 `transition: opacity .3s, visibility 0s .3s` 让 visibility 延迟切换 |
| `opacity: 0` 和 `visibility: hidden` 哪个性能好？ | opacity 走合成层，性能更好，但可交互；visibility 触发重绘但不重建渲染树 |
| 隐藏元素上的动画还会跑吗？ | `display: none` 下 CSS 动画不运行；`visibility: hidden` 下仍在运行（可被读屏/资源消耗） |
| 虚拟 DOM diff 时会移除元素吗？ | 取决于框架，Vue 的 `v-show` 用 `display: none`，`v-if` 才真正销毁组件 |
| `hidden` 属性和 `display: none` 一样吗？ | 浏览器 UA 样式是 `[hidden] { display: none }`，所以任何 `display` 声明都能覆盖它，容易失效 |

---

## 本主题自测

1. 一个 `width: 200px; padding: 0 20px; border: 1px solid` 的盒子，在两种盒模型下分别占多宽？内容区多宽？（答：border-box 占 200，内容 158；content-box 占 242，内容 200）
2. 为什么 `span` 加垂直 padding 会盖住上下文字？
3. 三个 33.33% 宽的 inline-block 为什么掉行？给两种修法。
4. `line-height: 150%` 和 `1.5` 在嵌套结构里的差别？
5. 无障碍场景下隐藏一段文字，用哪个属性组合？
