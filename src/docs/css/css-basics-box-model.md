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

**一句话答案**：盒模型是元素尺寸的计算口径：`content-box` 的 `width` 只算内容区，`border-box` 的 `width` 含 padding 和 border；`box-sizing` 在两种口径间切换，工程上通常全局设为 `border-box`。

### 答题思路（盒模型）

1. 四层结构：content → padding → border → margin。
2. 两种口径的差别：`width` 到底指哪一段。
3. `box-sizing` 的取值、默认值，以及全局 `border-box` 的副作用。

### 核心要点（盒模型）

- 四层结构：content → padding → border → margin。**margin 不计入盒子尺寸**，只影响元素间距；相邻兄弟的垂直 margin 会合并，取较大值（30px 与 20px 相邻，间距为 30px）。
- 同一组声明 `width: 200px; padding: 0 20px; border: 1px` 在两种口径下的实测值：

| 盒模型 | 元素占宽 | 内容区宽 |
|---|---|---|
| `content-box` | 242px | 200px |
| `border-box` | 200px | 158px |

- `border-box` 下 `width` 小于 padding + border 时，内容区压到 0，盒子仍占 padding + border：`width: 10px; padding: 0 20px; border: 1px` 实测占 42px、内容区 0。
- `box-sizing` 只改 `width` / `height` 的计算口径，不影响 margin，也不改变百分比 padding 的参照物（包含块宽度）。
- 工程惯例：

```css
*, *::before, *::after { box-sizing: border-box; }
```

- 副作用：第三方组件（canvas、iframe、老组件）内部可能依赖 content-box，全局设置后要单独 `box-sizing: content-box` 还原。
- JS 取值口径：

| API | 范围与实测行为 |
|---|---|
| `offsetWidth` / `clientWidth` | 边框盒 / padding + 内容区，都是整数。`clientWidth` 不含 border 和滚动条（200px 内容 + 40px padding + 2px border → `offsetWidth` 242、`clientWidth` 240） |
| `getBoundingClientRect()` | 变换后的边框盒，可带小数：`transform: scale(.5)` 下 200px 的盒子返回 100px |
| `getComputedStyle(el).width` | Chrome 下 content-box 元素返回内容区宽度；border-box 元素返回边框盒宽度（实测 200px，不是内容区 158px） |

### 口述回答（约 60 秒）

- 先给四层结构，强调 margin 只影响间距、不算盒子尺寸。
- 用一组数字对比两种口径：同样的 `width: 200px`，content-box 占 242px，border-box 占 200px。
- 落到工程：全局 `border-box` 解决了栅格撑破问题，代价是依赖 content-box 的第三方组件要局部还原。
- 被追问时补 JS 取值口径和 IE 怪异模式。

### 可能被追问（盒模型）

| 追问 | 回答要点 |
|---|---|
| 什么是 IE 盒模型？ | 就是 border-box。IE6 及更早的怪异模式（quirks mode）默认用它，加 doctype 后 IE 也走标准模式 |
| 百分比 padding 相对谁算？ | **相对包含块的宽度**，上下 padding 也相对宽度（300px 宽的包含块，`padding-top: 56.25%` 实测 168.75px） |

---

## Q2 · 块级 / 行内 / 行内块与 display

**一句话答案**：`display` 决定元素参与哪种格式化上下文：块级独占一行、宽高与四向 margin 生效；行内水平排列、宽高与垂直 margin 无效；`inline-block` 对外行内、对内块级，宽高生效。

### 答题思路（display）

1. 三条维度：是否换行、宽高与 margin 是否生效、内部格式化。
2. 典型标签，以及替换元素、行内垂直 padding 两个例外。
3. 现代双值语法、`flow-root`、块化。

### 核心要点（display）

| 维度 | block | inline | inline-block |
|---|---|---|---|
| 是否换行 | 独占一行 | 不换行 | 不换行 |
| width / height | 生效；`auto` 撑满父级 | **不生效**（替换元素除外） | 生效 |
| 垂直 margin | 生效 | **不生效** | 生效 |
| 垂直 padding | 生效，撑开盒子 | 视觉上扩背景，**不撑开行盒** | 生效 |
| 典型标签 | div、p、h1、ul、li、section | span、a、strong、em、label | img、input、button、select |
| 内部格式化 | 块级 | 行内 | 块级 |

- **替换元素例外**：`img`、`input`、`video`、`canvas`、`iframe` 的尺寸来自外部资源，即使 `display: inline` 也能设宽高（实测 img 设 50×50 生效）。
- **行内垂直 padding**：`span` 加 `padding: 20px` 后背景向外扩、自身盒子变高，但父行盒高度仍由 `line-height` 决定（实测 20px），不推开上下行。
- 块化：元素 `float`、`position: absolute/fixed`、或成为 flex/grid 子项后，`display` 计算值变成 `block`（实测 inline 与 inline-block 子项都返回 `block`）。

现代 `display` 是「外部 + 内部」双值组合：

```css
display: block flow;        /* = block */
display: inline flow-root;  /* = inline-block */
display: block flex;        /* = flex */
display: flow-root;         /* 块级容器，包含浮动且不裁剪 */
display: contents;          /* 盒子本身消失，子元素提升到父级 */
```

- `flow-root` 建立 BFC：包含浮动子元素，且不像 `overflow: hidden` 那样裁剪溢出。
- `display: contents`：元素本身不生成盒子，背景、边框、padding 失效，部分场景会丢无障碍语义。

### 口述回答（约 75 秒）

- 先按三条维度对比：换行、宽高与垂直 margin、内部格式化上下文。
- 点出本质：看 `display` 计算值，不看标签名——标签默认值可以被 CSS 改。
- 补两个例外：替换元素在 inline 下仍可设宽高；inline 的垂直 padding 不撑行盒。
- 现代语法：`inline-block` = `inline flow-root`。

### 可能被追问（display）

| 追问 | 回答要点 |
|---|---|
| `<a>` 里能放 `<div>` 吗？ | HTML5 允许（a 是透明内容模型），但 a 默认 inline，放块级元素会破坏布局，通常改 `display: block` |
| `display: inline-block` 和 `float: left` 的区别？ | 前者仍在文档流、父元素高度能撑开；后者脱标、导致父级高度塌陷。inline-block 有空白符问题，float 没有 |
| 块级元素 `width: auto` 和 `width: 100%` 一样吗？ | 不一样。`auto` 先扣 margin/border/padding 再分配（200px 容器内实测占 200px）；`100%` 等于父内容宽，再加 padding 会溢出（实测 242px） |

---

## Q3 · inline-block 的空白与底部空隙

**一句话答案**：`inline-block` 的横向空隙来自 HTML 换行折叠成的空格，宽度由父元素 `font-size` 决定；纵向空隙来自 `baseline` 对齐后预留的 descender 空间。前者用 `font-size: 0` 或去掉空白解决，后者用 `vertical-align`、`line-height: 0` 或 `display: block` 解决。

### 答题思路（inline-block）

1. 先拆成横向空白与纵向底部空隙两个独立问题。
2. 分别讲成因和解法。
3. 给工程结论：新布局用 flex/grid，老项目排查仍会遇到。

### 核心要点（inline-block）

**横向空白**

- 成因：inline-block 参与行内格式化上下文（IFC），标签间的换行和缩进成为文本节点，连续空白折叠成一个空格。实测 16px 下空格宽度：默认字体 5.33px，Arial 4.45px；两个 33.33% 宽盒子的间距与空格宽度一致。
- 解法：父元素 `font-size: 0` 后重置子元素字号（实测间距 0，行盒高度归到子元素高度）；标签紧贴或用注释隔开；父级改 `flex` / `grid`。负 `letter-spacing` 受字体影响，不推荐。

**纵向底部空隙**

- 成因：`inline-block` 的基线是最后一个行盒的基线（无内容时是底 margin 边），父级行盒按 `baseline` 对齐，基线下方还要留 descender（g、p 的下伸部分）。实测 16px 下 100px 高的盒子让父行盒变成 105px，底部空 5px。
- 解法：元素 `vertical-align: top / middle / bottom`；父元素 `line-height: 0`；图片 `display: block`（实测 50px 图片的父容器高 50px，无缝隙）；父元素 `font-size: 0` 同样让行盒高度归零（实测父高 100px）。

```css
img { display: block; }
.parent { line-height: 0; }
```

### 口述回答（约 70 秒 · inline-block）

- 先声明这是两个独立空隙：横向是空白文本节点，纵向是 baseline + descender。
- 横向三招：父 `font-size: 0`、源码不留空白、直接上 flex/grid。
- 纵向三招：`vertical-align`、父 `line-height: 0`、图片 `display: block`。
- 现代布局用 flex/grid，但图片缝隙和老项目仍会用到这些修法。

### 可能被追问（inline-block）

| 追问 | 回答要点 |
|---|---|
| 图片底部的缝隙还有别的原因吗？ | img 默认 `display: inline`，本身是行内替换元素，同样按 baseline 对齐，缝隙同源 |
| `vertical-align` 对哪些元素生效？ | 只对 inline / inline-block / table-cell 生效，对块级元素无效 |
| 为什么 flex 子项没有这个问题？ | flex 容器建立 FFC，子项不是行内盒，纯空白文本不生成匿名 flex item |
| `white-space: nowrap` 能解决横向空白吗？ | 不能，它只阻止换行，空白字符仍在 |

---

## Q4 · CSS 属性继承

**一句话答案**：继承是子元素没有自己的声明时，自动取父元素计算值的机制。文字排版类（font、color、text-*、line-height、visibility、cursor、list-style）继承，布局盒模型类（width/height/margin/padding/border/background/position/display）不继承。

### 答题思路（继承）

1. 判断规律：跟文字排版有关的通常继承，跟盒子布局有关的通常不继承。
2. 分类列清单：字体、文本、列表、其他。
3. 四个控制关键字，以及 `line-height` 的继承陷阱。

### 核心要点（继承）

**可继承**

- 字体：`font-family`、`font-size`、`font-weight`、`font-style`、`font-variant`
- 文本：`color`、`text-align`、`text-indent`、`text-transform`、`letter-spacing`、`word-spacing`、`line-height`、`white-space`、`word-break`、`direction`
- 列表：`list-style`、`list-style-type`、`list-style-position`
- 其他：`visibility`、`cursor`、`quotes`、`border-collapse`、`border-spacing`、`caption-side`、`orphans`、`widows`

**不可继承**

- 盒模型：`width`、`height`、`margin`、`padding`、`border`、`box-sizing`
- 背景：`background` 全家
- 布局：`display`、`position`、`float`、`clear`、`z-index`、`overflow`、flex / grid 相关
- 其他：`opacity`、`transform`、`vertical-align`、`text-decoration`（不继承，但装饰线绘制在祖先上，视觉上会穿过子元素）

**四个控制关键字**

| 关键字 | 含义 |
|---|---|
| `inherit` | 强制取父元素的计算值 |
| `initial` | 取规范初始值（如 `color` 是 canvastext，`display` 是 inline） |
| `unset` | 有继承性等同 `inherit`，无继承性等同 `initial` |
| `revert` | 回滚到浏览器 / 用户样式表的层叠结果 |

- `all: unset` 一键清空所有属性（会连 `display` 一起重置）。

**line-height 的继承陷阱**

| 写法 | 子元素继承 | 子元素 20px 字号时的行高（父 16px） |
|---|---|---|
| `line-height: 1.5` | 数值 1.5 | 30px（实测） |
| `line-height: 150%` | 计算后的 24px | 24px（实测） |
| `line-height: 1.5em` | 计算后的 24px | 24px（实测） |

所以全局 `line-height` 用无单位数值。

- 继承值不参与层叠比较，优先级最低：任何命中该元素的声明都能覆盖它，包括 `*` 通配符。

### 口述回答（约 70 秒 · 继承）

- 判断规律一句话：跟文字排版有关的继承，跟盒子布局有关的不继承。
- 主动补 `text-decoration`：不继承但视觉穿透，容易被误判为继承。
- 显式控制提四个关键字 `inherit / initial / unset / revert` 和 `all`。
- 收尾落在 `line-height`：无单位数值按子元素字号重算，百分比和 em 继承的是算好的像素值。

### 可能被追问（继承）

| 追问 | 回答要点 |
|---|---|
| `font-size` 的百分比和 em 相对谁？ | 相对父元素的 font-size；`line-height` 的百分比相对自身 font-size |
| `background-color` 为什么不继承？ | 由盒绘制模型决定，继承会导致每层盒子重复绘制背景 |
| `visibility: hidden` 会继承吗？ | 会。所以子元素可以设 `visibility: visible` 单独显示（display: none 做不到） |
| 表单元素为什么不吃继承的字体？ | `input` / `button` 的 UA 样式有显式 font 声明，需要手动 `font: inherit` |
| CSS 变量继承吗？ | 继承。自定义属性默认继承，是主题切换的实现基础 |

---

## Q5 · 隐藏元素的方式与区别

**一句话答案**：常用 5 类——`display: none`（不渲染不占位）、`visibility: hidden`（占位不可见）、`opacity: 0`（占位透明、仍可交互）、裁剪或移出视口（占位但不可见）、`content-visibility: hidden`（保留元素盒子、跳过子树渲染）。选型看四点：是否占位、能否过渡、能否交互 / 聚焦、是否影响性能。

### 答题思路（隐藏）

1. 先列 5 类方案，每种一句定性。
2. 用一张表拉齐维度：占位、渲染树、交互 / 聚焦、读屏、过渡、开销。
3. 给选型结论，并补 `display: none` 无法过渡的替代方案。

### 核心要点（隐藏）

| 方式 | 占位 | 在渲染树 | 可点击 / 聚焦 | 读屏可读 | 可 transition | 开销 |
|---|---|---|---|---|---|---|
| `display: none` | 否 | 否 | 否 | 否 | 否 | 触发重排 |
| `visibility: hidden` | 是 | 是 | 否 | 否 | 是（可延迟切换） | 触发重绘 |
| `opacity: 0` | 是 | 是 | 是 | 是 | 是 | 合成层，开销低 |
| `transform: scale(0)` | 是 | 是 | 可聚焦，不可点击（0 面积） | 是 | 是 | 合成，开销低 |
| `clip-path: inset(50%)` | 是 | 是 | 可聚焦，不可点击（命中被裁掉） | **是** | 是 | 重绘 |
| `position: absolute; left: -9999px` | 否（脱标） | 是 | 可聚焦（会滚动） | 是 | — | 低 |
| `content-visibility: hidden` | 取决于 `contain-intrinsic-size`（默认 0） | 是（跳过内容渲染） | 否 | 否 | 否 | **最低**（不渲染子树） |
| `width: 0; height: 0; overflow: hidden` | 否（占 0 尺寸） | 是 | 子元素可聚焦 | 部分可读 | 是（尺寸动画） | 中 |
| `hidden` 属性 | 否 | 否 | 否 | 否 | 否 | 等同 display: none |

- `display: none`：不生成盒子，不在渲染树，子孙无法救回；`transition` 失效；`offsetWidth` 为 0。
- `visibility: hidden`：盒子仍在、占位、不绘制；子元素 `visibility: visible` 可复活；不可聚焦；支持 `transition`（离散动画，配合 `transition: visibility 0s .3s` 可延迟隐藏）。
- `opacity: 0`：透明但仍占位、仍命中鼠标事件、仍可聚焦、读屏仍会读；做纯视觉隐藏时要补 `pointer-events: none` 或 `visibility: hidden`。
- `clip-path` / `.sr-only`：视觉隐藏但对屏幕阅读器可见。

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

- `content-visibility: hidden`：保留元素盒子，但跳过整棵子树的样式、布局、绘制。不设 `contain-intrinsic-size` 时高度塌到 0（实测 100px 子元素 → 0；设 `contain-intrinsic-size: 100px 60px` → 60px），所以用它占位必须显式给尺寸。

### 口述回答（约 80 秒）

- 按"消失之后还剩什么"分类：不生成盒子 / 占位不绘制 / 占位透明 / 视觉裁剪 / 跳过子树渲染。
- 每种一句定性，再用同一张表拉齐占位、交互、读屏、过渡四个维度。
- 选型：要动画用 `opacity` 或 `visibility`；要彻底移除用 `display: none`；要兼顾无障碍用 `clip-path`。
- 补一句 `display: none` 无法过渡，通常用 `opacity` + 延迟的 `visibility` 组合。

### 可能被追问（隐藏）

| 追问 | 回答要点 |
|---|---|
| `display: none` 的元素能获取尺寸吗？ | 不能，`offsetWidth` 为 0。需要测量时先临时设为 `visibility: hidden; position: absolute` 或 `display: block` |
| 如何让元素淡出后再彻底隐藏？ | `transition: opacity .3s, visibility 0s .3s`，`visibility` 延迟到淡出结束再切换 |
| `opacity: 0` 和 `visibility: hidden` 哪个性能好？ | `opacity` 变化可只走合成，`visibility` 触发重绘；但 `opacity: 0` 仍可交互，语义不同 |
| 隐藏元素上的动画还会跑吗？ | `display: none` 下 CSS 动画不运行；`visibility: hidden` 下仍在运行 |
| 虚拟 DOM diff 时会移除元素吗？ | 取决于框架：Vue 的 `v-show` 用 `display: none`，`v-if` 才真正销毁组件 |
| `hidden` 属性和 `display: none` 一样吗？ | UA 样式是 `[hidden] { display: none }`，任何 `display` 声明都能覆盖它，容易失效 |

---

## 本主题自测

1. 一个 `width: 200px; padding: 0 20px; border: 1px solid` 的盒子，在两种盒模型下分别占多宽？内容区多宽？（答：border-box 占 200，内容 158；content-box 占 242，内容 200）
2. 为什么 `span` 加垂直 padding 会盖住上下文字？
3. 三个 33.33% 宽的 inline-block 为什么掉行？给两种修法。
4. `line-height: 150%` 和 `1.5` 在嵌套结构里的差别？
5. 无障碍场景下隐藏一段文字，用哪个属性组合？
