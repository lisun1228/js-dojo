# CSS · 03 布局与定位

> 覆盖原题：4、5、8、12、17、23、31、38、40、41、42、52、53、55、60、61（部分）
> 合并后 6 个知识点 ｜ 重要度 ★★★★★ ｜ 建议时长 70 分钟（本主题权重最高）

## 本主题速查

| 编号 | 知识点 | 合并自 |
|---|---|---|
| Q10 | 浮动的特性与清除浮动 | 12、55 |
| Q11 | BFC 块级格式化上下文 | 4、31、52 |
| Q12 | position 五个取值 | 23、40、61 |
| Q13 | absolute 到底相对谁定位 | 60 |
| Q14 | flex 布局与 flex:1 | 5、17、41 |
| Q15 | 两栏 / 三栏 / 圣杯 / 双飞翼 | 8、38、42、53 |

一句话主线：**先讲"正常流怎么排"（块级/行内/浮动），再讲"如何脱离正常流"（position、float），再讲"如何阻断相互影响"（BFC），最后讲"现代布局怎么排"（flex/grid）。**

建议学习顺序：Q11 BFC → Q10 浮动 → Q12/Q13 定位 → Q14 flex → Q15 综合布局。BFC 是这一章的地基，浮动和 margin 合并的很多问题都要用它解释。

---

## Q10 · 浮动的特性与清除浮动

> 合并原题：12（清除浮动的方式）、55（请说说浮动的特点）

**一句话答案**：`float` 让元素向左/右靠拢并**半脱离文档流**——块级盒子不再为它让位，但行内内容（文字）会绕开它，形成文字环绕；副作用是父元素高度塌陷。清除方式有 clearfix 伪元素、父级 `overflow` 触发 BFC、`display: flow-root`、以及现代直接改用 flex/grid。

### 答题思路

1. 先讲"半脱离"这个关键定性，比"脱离文档流"准确。
2. 列 4 个特性：靠边排列、块级化、文字环绕、父级高度塌陷。
3. 讲 `clear` 的作用机制。
4. 给清除浮动的 4 种方案 + 各自副作用，明确推荐 `flow-root` 或 flex。
5. 补一句"浮动原本是给文字环绕设计的，被误用为布局手段，现在已被 flex/grid 取代"——这句显功底。

### 核心要点

**浮动的四个特性**

1. **脱离文档流但不脱离文本流**：块级盒子当作它不存在（后续块级元素会钻到它下面），但行盒（inline 内容）会收缩避让，形成文字环绕。所以准确说法是"半脱离"。
2. **向指定方向靠拢**：`left` 靠左，`right` 靠右，多个浮动元素依次排列，一行放不下就换行（换行时可能被更高的浮动元素"卡住"，出现参差不齐）。
3. **块级化**：浮动元素的 `display` 计算值变成 `block`，所以 `span` 浮动后可以设宽高，且 `width` 默认由内容决定（收缩包裹 shrink-to-fit），不是撑满。
4. **父元素高度塌陷**：父元素计算高度时忽略浮动子元素，导致父级高度为 0，背景/边框"塌"掉，后续元素顶上来。

**`clear` 的作用**

`clear: left/right/both` 表示"该元素的**外边距上边界**不能与前面的浮动元素相邻"，浏览器会自动在它上方增加外边距（clearance）把它推到浮动元素下方。注意 `clear` 只对**块级元素**生效。

**清除浮动四种方案**

```css
/* 1. clearfix 伪元素（最经典，兼容性好） */
.clearfix::after {
  content: '';
  display: table;   /* 或 block */
  clear: both;
}
.clearfix { *zoom: 1; }  /* 兼容 IE6/7，现代项目可删 */

/* 2. 父元素触发 BFC（简单，但 overflow 会裁剪） */
.parent { overflow: hidden; }  /* 或 auto */

/* 3. display: flow-root（现代最优，无副作用） */
.parent { display: flow-root; }

/* 4. 父元素也浮动 / 加空标签 <div style="clear:both"></div> */
```

对比：

| 方案 | 副作用 | 评价 |
|---|---|---|
| `::after` clearfix | 需额外类名，无副作用 | 兼容老项目首选 |
| `overflow: hidden/auto` | 会裁剪溢出内容、影响 `position: sticky`、可能产生滚动条 | 可用但要注意 |
| `display: flow-root` | 无 | **现代项目首选** |
| 空标签 `clear: both` | 增加无意义 DOM | 不推荐 |
| 父元素浮动 | 塌陷转移给祖父级 | 不推荐 |
| flex / grid 布局 | — | 治本，根本不产生浮动 |

### 口述回答（约 75 秒）

> 浮动的核心特性我记四条。
>
> 第一，它半脱离文档流。块级盒子会当它不存在，后面的块级元素会钻到它下面；但行内内容，也就是文字，会自动避让，绕着它排，这就是文字环绕。所以严格说是"脱离文档流但不脱离文本流"。
>
> 第二，向指定方向靠拢，多个浮动元素依次排列，一行放不下就换行，换行时还可能被前面更高的元素卡住。
>
> 第三，浮动会让元素的 display 计算值变成 block，所以 span 浮动之后能设宽高，宽度默认由内容决定。
>
> 第四，也是最常见的副作用：父元素计算高度时忽略浮动子元素，导致高度塌陷，背景和边框塌掉，后面的元素顶上来。
>
> 清除浮动本质是让某个元素的上外边距不与浮动元素相邻，浏览器会在它上面加一段 clearance 把它推下去。方案上，经典的是给父级加 `::after { content:''; display: table; clear: both }`；简单点用父级 `overflow: hidden`，但它会裁剪溢出内容、还会让 sticky 失效；现在最干净的是给父级 `display: flow-root`，专门为这个场景设计的。当然，现代布局直接用 flex 或 grid，不产生浮动就没有这个问题。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| 浮动元素会脱离文档流吗？ | 半脱离。块级流忽略它，行盒避让它 |
| 为什么 `overflow: hidden` 能清浮动？ | 它让父元素成为 BFC，BFC 计算高度时包含浮动子元素 |
| `clear: both` 为什么必须放在块级元素上？ | 规范规定 clearance 只作用于块级盒（行内盒不参与 BFC 高度计算） |
| 浮动元素之间的 margin 会合并吗？ | 不会。margin 合并只发生在同一 BFC 的**普通流块级盒**之间，浮动和定位元素都不合并 |
| 如何实现"左侧固定、右侧自适应"，不用 flex？ | 左浮动 + 右侧 `overflow: hidden`（BFC 不与浮动重叠）或 `margin-left` |
| 浮动和 `inline-block` 的取舍？ | 浮动无空白符问题但有塌陷；inline-block 无塌陷但有空白符问题；两者都被 flex 取代 |
| `float` 还能用在哪些地方？ | 文字环绕图片、首字下沉、老式栅格；现代主要是图文混排 |

---

## Q11 · BFC 块级格式化上下文

> 合并原题：4（BFC 理解）、31（说说 BFC 布局规则）、52（BFC）

**一句话答案**：BFC（Block Formatting Context）是一块独立的块级渲染区域，内部元素的布局不影响外部，外部也不影响内部。它最实用的三个作用：包含浮动子元素（清浮动）、阻止 margin 合并（父子穿透/兄弟贴边）、不与浮动元素重叠（自适应两栏）。

### 答题思路

1. 一句话定义 + 关键词"隔离"。
2. 触发条件（说 6 个左右，重点 `overflow`、`float`、`absolute`、`inline-block`、`flow-root`、flex 子项）。
3. 五条布局规则。
4. 三个应用场景，每个配一句代码思路。
5. 对比 BFC / IFC / FFC / GFC，说明这是 CSS 格式化上下文家族——这是拉开差距的地方。

### 核心要点

**定义**：BFC 是页面上的一个隔离的独立容器，容器内的元素不会在布局上影响到外面的元素。可以理解为"块级元素的独立王国"。

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

注意：`display: flex` / `grid` / `table` 的元素本身建立的是 FFC/GFC/表格格式化上下文，**不是 BFC**，但它们同样是"隔离的格式化上下文"，效果类似。

**五条布局规则**

1. 内部的块级盒子在**垂直方向**一个接一个排列。
2. 同一个 BFC 内，相邻块级盒的**垂直 margin 会合并**（父子、兄弟都会）；不同 BFC 之间不会。
3. BFC 区域**不会与浮动元素重叠**（这一条实现了自适应两栏）。
4. 计算 BFC 高度时，**浮动子元素也参与计算**（这一条实现了清浮动）。
5. BFC 是一个隔离容器，内部元素不会影响外部布局。

**三大应用**

```css
/* 1. 清除浮动：父元素变成 BFC，高度包含浮动子元素 */
.parent { display: flow-root; }

/* 2. 解决父子 margin 穿透（子元素 margin-top 把父元素一起顶下去） */
.parent { overflow: hidden; }  /* 或给父级加 padding/border */

/* 3. 自适应两栏：右侧 BFC 不会与左侧浮动重叠，自动占满剩余宽度 */
.left  { float: left; width: 200px; }
.right { overflow: hidden; }
```

**兄弟 margin 合并的解法**：给其中一个包一层 BFC 容器，或改用 flex/grid（flex 子项之间不合并 margin）。

**格式化上下文家族（加分项）**

| 类型 | 全称 | 建立方式 |
|---|---|---|
| BFC | Block Formatting Context | 见上表 |
| IFC | Inline Formatting Context | 块级容器内只要有行内内容就自动形成 |
| FFC | Flex Formatting Context | `display: flex` |
| GFC | Grid Formatting Context | `display: grid` |
| TFC | Table Formatting Context | `display: table` |

**BFC 解决不了的问题（体现边界感）**

- 不影响 `z-index`（那是层叠上下文的事，虽然两者常被混淆）。
- 不能阻止浮动元素**自己**溢出父级（要靠 `overflow` 或 clear）。
- 相邻兄弟的 margin 合并不因父级是 BFC 而消失（因为它们在同一个 BFC 里）。

### 口述回答（约 85 秒）

> BFC 是块级格式化上下文，简单说就是一块独立的渲染区域，里面的元素怎么排不影响外面，外面也影响不到里面，核心词是"隔离"。
>
> 触发条件我记六类：`overflow` 不是 visible；元素浮动了；绝对定位或固定定位；`display` 是 inline-block、table-cell、flow-root 这些；作为 flex 或 grid 的子项；还有 `contain: layout` 这类。
>
> 它的布局规则有五条，最有用的是三条：一是 BFC 计算高度时包含浮动子元素，所以能清浮动；二是 BFC 区域不会和浮动元素重叠，所以能做自适应两栏——左边浮动定宽，右边 `overflow: hidden` 就自动占满剩下的宽度；三是同一个 BFC 内相邻块级盒的垂直 margin 会合并，跨 BFC 不合并，所以父子 margin 穿透可以用给父级建 BFC 来解决。
>
> 边界也要清楚：BFC 管不了 z-index，那是层叠上下文；它也管不了兄弟之间的 margin 合并，因为兄弟在同一个 BFC 里。
>
> 现在实现 BFC 我优先用 `display: flow-root`，它是规范里专门为"创建 BFC 且无副作用"设计的，不像 `overflow: hidden` 会裁剪内容、会让 sticky 失效。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| BFC 和层叠上下文有什么区别？ | BFC 管布局隔离，层叠上下文管绘制层级，两者互不相关，但一个元素可能同时是两者（如 `overflow: hidden` + `z-index`） |
| `overflow: hidden` 做 BFC 有什么副作用？ | 裁剪溢出、无法 `position: sticky`、可能隐藏下拉菜单/阴影 |
| 为什么 `display: flex` 不算 BFC？ | 它建立的是 FFC，规则不同（子项不合并 margin、无浮动概念），但同样隔离 |
| margin 合并的三种情况？ | 相邻兄弟、父子（无 padding/border/内容隔开）、空元素自身上下 margin |
| 怎么阻止父子 margin 穿透？ | 父级建 BFC、加 padding/border、或用 flex 布局 |
| BFC 能解决高度塌陷吗？ | 能，前提是塌陷由浮动引起；如果是 absolute 子元素，BFC 也没用（绝对定位不参与父级高度计算） |
| `contain: paint` 和 BFC 的关系？ | `contain: paint` 会创建 BFC 并裁剪绘制，性能上还有额外收益 |

---

## Q12 · position 五个取值

> 合并原题：23（relative/absolute/fixed/static 特性）、40（说一下 position 属性）、61（position 和 display 相关问题）

**一句话答案**：`static` 是默认的正常流；`relative` 相对自身原位置偏移、不脱标、保留占位；`absolute` 相对最近的非 static 祖先定位、脱标不占位；`fixed` 相对视口定位、脱标；`sticky` 在滚动到阈值时"粘住"、不脱标。只有非 static 元素 `z-index` 才生效。

### 答题思路

1. 用一个表格把五个值的"参照物 / 是否脱标 / 是否占位 / 是否可作为绝对定位参照"讲清。
2. 强调 `relative` 的两个用途：微调 + 给子元素做定位参照（工程上最重要）。
3. 讲 `fixed` 的坑（祖先有 transform 就失效，详见 Q26）。
4. 讲 `sticky` 的四个生效条件（最容易被追问）。
5. 补：`top/left` 对 static 无效；定位元素的 `z-index` 才生效；绝对定位元素会建立 BFC、会块级化。

### 核心要点

| 值 | 参照物 | 脱标 | 原位置占位 | 可作 abs 参照 | 典型用途 |
|---|---|---|---|---|---|
| `static` | 无（正常流） | 否 | 是 | 否 | 默认 |
| `relative` | **自身原来的位置** | 否 | **是**（保留） | **是** | 微调、给子元素做参照 |
| `absolute` | 最近的非 static 祖先（padding box） | 是 | 否 | 是 | 角标、气泡、弹层 |
| `fixed` | 视口（除非祖先有 transform 等） | 是 | 否 | 是 | 吸底按钮、悬浮导航 |
| `sticky` | 最近的滚动祖先 | 否 | 是 | 是 | 表头吸顶、楼层导航 |

**关键特性详解**

- `static`：`top/right/bottom/left` 和 `z-index` 全部无效。
- `relative`：
  - 视觉上偏移，但**原位置仍然占着**，不影响其他元素布局（"灵魂出窍，肉体还在"）。
  - 最大工程价值是**给 absolute 子元素当参照物**，所以常见 `.card { position: relative }` 但从不写 `top/left`。
  - 相对的是自身的**原位置**，不是父元素。
- `absolute`：
  - 完全脱标，不占位，后面的元素会补上来。
  - 参照物是"最近的非 static 祖先的 **padding box**"（不是 content box，也不是 border box）。
  - 找不到这样的祖先时，参照**初始包含块**（见 Q13）。
  - 脱标后会**块级化**，`width` 默认收缩包裹；同时建立 BFC。
  - 父元素高度不会包含它（这就是"absolute 导致的塌陷 BFC 也救不了"）。
- `fixed`：
  - 参照视口，滚动不动。但**祖先有 `transform`/`filter`/`perspective`/`will-change` 时，会退化成相对该祖先定位**——移动端弹层错位的头号原因。
  - 在 iOS 上有键盘/滚动错位问题（见 Q26）。
- `sticky`：
  - 是 `relative` 和 `fixed` 的混合：在容器范围内表现为 relative，滚动到阈值后表现为 fixed 效果。
  - **四个生效条件**：① 必须设 `top/bottom/left/right` 中至少一个；② 最近的滚动祖先不能是 `overflow: hidden/auto/scroll`（否则粘不住，这是最常见的失效原因）；③ 父级高度必须大于 sticky 元素本身（否则没有可"粘"的范围）；④ 父级不能设 `overflow: hidden`。
  - 多个 sticky 同容器会依次"顶住"前一个。

```css
/* 表头吸顶的标准写法 */
.table-header {
  position: sticky;
  top: 0;
  z-index: 10;   /* 防止被内容盖住 */
}
```

### 口述回答（约 85 秒）

> 五个值我按"参照物"和"是否脱标"来讲。
>
> `static` 是默认值，正常文档流，`top`、`left`、`z-index` 都无效。
>
> `relative` 相对自己原来的位置偏移，关键是它**不脱标，原来的位置还占着**，所以只影响视觉不影响布局。它最重要的用途其实不是微调，而是给子元素的 absolute 提供参照，所以卡片、弹层外面都会挂一个 `position: relative`。
>
> `absolute` 完全脱标，不占位，后面的元素会顶上来。它的参照物是最近的非 static 祖先的 padding box，找不到就相对初始包含块，这一点常被误说成"相对 body"。
>
> `fixed` 相对视口，滚动时不动，但有个大坑：祖先只要有 `transform`、`filter`、`perspective` 或者 `will-change`，fixed 就会退化成相对那个祖先定位，移动端弹层错位基本都是这个原因。
>
> `sticky` 是 relative 和 fixed 的混合，滚动到阈值就粘住。它要生效得满足几个条件：必须写 `top` 之类的阈值；父级不能 `overflow: hidden`；父级高度得比它高；最近的滚动容器不能裁掉它。
>
> 另外只有非 static 的元素，`z-index` 才生效。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| `relative` 会脱标吗？ | 不会，原位置保留，只是视觉偏移 |
| `absolute` 相对 padding box 还是 content box？ | padding box（含 padding 区域），不含 border |
| `fixed` 为什么会失效？ | 祖先有 transform/filter/perspective/will-change/contain，会创建包含块，fixed 退化为相对该祖先 |
| `sticky` 不生效怎么排查？ | 有没有写 top；父级/祖先有没有 `overflow: hidden`；父级高度是否足够；是否被 flex 拉伸 |
| 定位元素需要写 `z-index` 吗？ | 不需要也能生效（auto），但需要覆盖其他定位元素时要写 |
| 绝对定位元素的宽高百分比相对谁？ | 相对包含块（即定位祖先）的 padding box |
| `position: absolute` 会导致父元素高度塌陷吗？ | 会，父元素高度不包含它；BFC 也无法解决（因为不是浮动） |

---

## Q13 · absolute 到底相对谁定位

> 合并原题：60（position: absolute 什么时候相对 body，什么时候相对父元素）

**一句话答案**：`absolute` 相对**最近的、`position` 不为 `static` 的祖先元素**的 padding box 定位；如果一路往上都没有这样的祖先，就相对**初始包含块（initial containing block）**定位——它的大小等于视口，位置在文档原点，所以会随页面滚动而移动，看起来"像相对 body"，但严格说不是 body。

这道题是"细节题"，答对"初始包含块"这个词，比说"相对 body"高一个档次。

### 答题思路

1. 先给规则：从自身向上找第一个"定位祖先"。
2. 讲参照的是 padding box。
3. 讲没有定位祖先时的行为：初始包含块，并解释它和 body 的区别（尺寸=视口、不随文档高度变化、随滚动移动）。
4. 补 `transform` 等属性也会让祖先变成包含块（这是现代高频坑）。
5. 给实操建议：`offsetParent` 可以用来验证。

### 核心要点

**定位祖先的查找规则**

从元素自身开始向上遍历 DOM，第一个 `position` 为 `relative` / `absolute` / `fixed` / `sticky` 的祖先，就是它的**包含块**。找到后：

- 参照的是该祖先的 **padding box**（padding 的外边缘，不含 border）。
- `top: 0; left: 0` 对齐到该祖先 padding box 的左上角。
- 宽高百分比也相对这个 padding box 计算。

**没有定位祖先时**

包含块是 **初始包含块（initial containing block，ICB）**：

- 尺寸 = **视口大小**（不是文档总高度，也不是 body 的实际高度）。
- 位置固定在**文档原点**（页面左上角），所以绝对定位元素会**随页面滚动而移动**，看起来是跟着文档走的。
- 它**不是 `<body>` 元素**。`body` 有 margin、有背景、有 border，而 ICB 不是元素，只是布局用的矩形。
  - 特殊点：如果给 `html` 或 `body` 设了 `position: relative`，那 `body` 就会变成真正的定位祖先，此时行为确实"相对 body"——这才是"相对 body"这种说法的来源。

**现代坑：不只是 position 会产生包含块**

以下属性的祖先也会成为绝对定位后代的包含块（规范上称为"包含块由该元素建立"）：

- `transform` 不为 `none`
- `filter` / `backdrop-filter` 不为 `none`
- `perspective` 不为 `none`
- `will-change` 指定了上述属性
- `contain: layout` / `paint` / `strict` / `content`
- `content-visibility: auto`

这也是同一个原因导致 `position: fixed` 失效（Q26）。

**验证方法**

```js
console.log(el.offsetParent);  // 返回定位祖先（或最近的 table/td/body）
```

`offsetParent` 返回 `null` 的情况：`position: fixed`、`display: none`、或 `<body>`/`<html>` 自身。

```css
/* 工程实践：组件根节点统一挂 relative，避免子元素跑到最外层 */
.modal { position: relative; }
.modal__close { position: absolute; top: 8px; right: 8px; }
```

### 口述回答（约 70 秒）

> 规则其实一句话：absolute 会从自己往上找**最近的一个 position 不是 static 的祖先**，相对它的 padding box 定位；如果一直找到根都没有，就相对"初始包含块"。
>
> 这里容易说错。很多人说"相对 body"，不准确。初始包含块是个布局矩形，大小等于视口，位置在文档左上角，它不是 body 这个元素。所以这种情况下绝对定位元素会跟着页面一起滚，看起来像跟着 body 走。只有当 html 或 body 自己设了 `position: relative` 的时候，才是真的相对 body。
>
> 还有一点现在特别容易踩：能建立包含块的不只是 position，`transform`、`filter`、`perspective`、`will-change`、`contain` 这些都会。所以一个卡片加了 `transform: translateZ(0)` 做性能优化，里面 absolute 的角标位置可能就变了。
>
> 实际调试我会看 `el.offsetParent`，它就是浏览器算出来的定位祖先，比人眼找快得多。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| 初始包含块和 body 的区别？ | ICB 是布局矩形，尺寸等于视口，不是元素；body 有盒模型，尺寸由内容决定 |
| 为什么给 html/body 加 `position: relative` 就能"相对 body"？ | 它们成了真正的定位祖先，包含块换成它们的 padding box |
| 绝对定位元素会随页面滚动吗？ | 没有定位祖先时会（相对 ICB），若祖先在文档流中则会随祖先滚动 |
| `transform` 为什么影响定位？ | 它会创建包含块（也是层叠上下文），绝对/固定定位后代改为相对它定位 |
| 绝对定位元素能设 `z-index` 吗？ | 能，非 static 的定位元素天然支持 `z-index` |
| `offsetParent` 和 `parentNode` 一样吗？ | 不一样，前者是布局意义上的定位祖先，后者是 DOM 父节点 |
| 绝对定位元素的 `width: 100%` 相对谁？ | 相对包含块（定位祖先 padding box）的宽度 |

---

## Q14 · flex 布局与 flex:1

> 合并原题：5（flex:1 代表什么）、17（flex:1:0:0 是什么意思）、41（说一下 flex 布局，了解 flex:1 吗）

**一句话答案**：`flex` 是 `flex-grow`、`flex-shrink`、`flex-basis` 的简写。`flex: 1` 展开是 `1 1 0%`——可以放大、可以缩小、基准尺寸为 0，所以完全按比例平分容器；`flex: 1 0 0` 是不允许缩小、基准为 0，因此无论内容多长都不会被压缩，容易撑破容器。

### 答题思路

1. 先讲容器属性（`display: flex`、`flex-direction`、`justify-content`、`align-items`、`flex-wrap`、`gap`）和项目属性（`flex`、`order`、`align-self`），一句话带过，别拖时间。
2. 重点拆 `flex: 1` 的三个值。
3. 讲 `flex-basis: 0` 与 `auto` 的差异——这是"是否真等宽"的关键。
4. 讲 `min-width: auto` 导致 `flex-shrink` 失效的坑——这是最高频的追问。
5. 举两个经典场景：等分、左固定右自适应。

### 核心要点

**三个值的含义**

| 属性 | 作用 | 默认值 |
|---|---|---|
| `flex-grow` | 剩余空间**如何放大**，按比例分配 | 0（不放大） |
| `flex-shrink` | 空间不足时**如何缩小**，按 basis 加权收缩 | 1（可缩） |
| `flex-basis` | 分配前的**初始主轴尺寸**，`auto` 表示参考 `width`/内容 | `auto` |

**简写规则（必背）**

```css
flex: 1;          /* → 1 1 0%    ：放大、可缩、基准 0 → 真正平分 */
flex: auto;       /* → 1 1 auto  ：基于内容尺寸再分剩余空间 */
flex: none;       /* → 0 0 auto  ：不放大不缩小，按内容 */
flex: 1 0 auto;   /* → 1 0 auto  ：可放大、不可缩、基准为内容宽度 */
flex: 1 0 0;      /* → 1 0 0%    ：可放大、不可缩、基准 0 */
flex: 0 1 200px;  /* 固定基准 200，可缩不放 */
```

三个注意点：

- **单值写数字**（`flex: 1`）时，`flex-basis` 规范规定为 `0%`，不是 `0px`。
- 简写里写 `0`（无单位）时，`flex-basis` 也按 `0%` 处理（规范特别说明：flex 简写中的无单位 0 视为 0%）。
- 因此 `flex: 1` 和 `flex: 1 0 0` 的差别只在 `flex-shrink`（1 vs 0），`flex-basis` 是一样的。

**`flex-basis: 0` 和 `auto` 的本质差异**

- `basis: 0`：忽略内容宽度，容器空间**全部当作剩余空间**按 `grow` 比例分。三个 `flex: 1` 的子项，不管内容多长，**永远等宽**。
- `basis: auto`：先按内容宽度占位，**再把剩余空间**按比例分。内容长短不同，最终宽度就不同。
- 结论：要做**严格等分**，用 `flex: 1`（basis 0）；要**内容优先再分配**，用 `flex: auto` 或 `flex: 1 1 auto`。

**经典坑：`min-width: auto`**

flex 子项的 `min-width` 默认值是 `auto`，含义是"不小于内容的最小尺寸"。所以子项内部有长文本/长单词/`white-space: nowrap` 时，`flex-shrink: 1` 也压不下去，会撑破容器。

```css
.item {
  flex: 1;
  min-width: 0;   /* 关键：允许收缩到内容以下，配合 overflow/ellipsis 使用 */
}
```

同理，实现省略号时 flex 子项也必须 `min-width: 0`，否则 `text-overflow: ellipsis` 不生效（横向主轴）；纵向对应 `min-height: 0`。

**经典布局**

```css
/* 左固定 + 右自适应 */
.row { display: flex; }
.side { flex: 0 0 200px; }   /* 不可放大不可缩，固定 200 */
.main { flex: 1; min-width: 0; }

/* 三等分 */
.row > .col { flex: 1; }

/* 垂直居中 + 两端对齐 */
.row { display: flex; align-items: center; justify-content: space-between; }

/* 自动换行 + 等宽卡片 */
.list { display: flex; flex-wrap: wrap; gap: 16px; }
.list > .card { flex: 1 1 240px; }   /* 最小 240，可长可缩 */
```

**flex 的边界（体现深度）**

- `flex` 是一维布局，二维用 `grid`。
- flex 子项的 margin **不会合并**。
- flex 容器内的 float 失效；`::before/::after` 会成为 flex 项（可用 `order` 控制）。
- `justify-content` 管主轴，`align-items` 管交叉轴；`flex-direction: column` 时两者方向对调。
- `gap` 在 flex 中已全面支持（替代 margin 负值方案）。

### 口述回答（约 85 秒）

> `flex: 1` 是三个属性的简写，展开是 `flex-grow: 1; flex-shrink: 1; flex-basis: 0%`。意思是：容器有剩余空间时按比例放大，空间不够时允许缩小，而分配前的基础尺寸按 0 算，也就是完全忽略内容宽度，直接按比例平分容器。
>
> 所以 `flex: 1` 和 `flex: 1 0 0` 的差别只在中间那个 shrink：前者允许缩小，后者不允许。像 `flex: 1 0 0`，内容再长也不会被压缩，很容易把容器撑破；`flex: 1 0 auto` 则是基准取内容宽度，只在剩余空间上放大。
>
> 关键是要理解 `basis: 0` 和 `basis: auto` 的差别。basis 是 0，容器空间全部当剩余空间按 grow 分，所以三个 `flex: 1` 的子项不管内容多长都严格等宽；basis 是 auto，先按内容占位再分剩下的，内容不同宽度就会不同。
>
> 还有个必须知道的坑：flex 子项的 `min-width` 默认是 auto，意味着不能小于内容的最小宽度。所以里面如果有长单词或者 nowrap 的文字，`flex-shrink` 也压不下去，会溢出。要让省略号生效，得给子项加 `min-width: 0`。
>
> 常用组合我记两个：左固定右自适应用 `flex: 0 0 200px` 加 `flex: 1`；等分卡片用 `flex-wrap: wrap` 加 `flex: 1 1 240px` 配合 gap。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| `flex: 1` 和 `width: 100%` 的区别？ | `width: 100%` 是硬性等于父级内容宽度，多个子项会溢出；`flex: 1` 参与剩余空间分配 |
| `flex-basis` 和 `width` 谁优先？ | `flex-basis` 优先（非 auto 时），`width` 只在 basis 为 auto 时起作用 |
| 为什么 `flex-shrink: 1` 有时不生效？ | `min-width: auto` 兜底，需设 `min-width: 0` |
| `flex-grow` 是平均分配还是按比例？ | 按 grow 值比例分配**剩余空间**，不是分配总宽度 |
| `flex-shrink` 是按 shrink 值平均分吗？ | 不是，收缩量 = 超出量 × (shrink × basis) / Σ(shrink × basis)，basis 越大缩得越多 |
| `justify-content: space-between` 只有一个子项时怎样？ | 靠左（起始端）；要居中用 `center` 或 `space-around` |
| flex 能做两维布局吗？ | 不能，需要换行+对齐控制时用 grid |
| `flex: 1` 的元素在 `flex-direction: column` 下？ | 作用于高度，需要父级有确定高度才有效 |

---

## Q15 · 两栏 / 三栏 / 圣杯 / 双飞翼

> 合并原题：8（三栏中间自适应）、38（三栏布局）、42（两列布局）、53（如何实现三栏布局）

**一句话答案**：两栏三栏有五种实现——flex（最简单）、grid（最现代）、float + BFC、absolute、以及经典的圣杯/双飞翼（float + 负 margin，目的是让**中间列在 DOM 中优先渲染**）。实际项目首选 flex/grid，圣杯双飞翼的价值在于理解负 margin 和"内容优先加载"。

### 答题思路

1. 先给最简单的两个（flex、grid），代码一两行，展示工程习惯。
2. 再给圣杯和双飞翼，讲清"为什么要这么绕"——中间列先加载，两侧用负 margin 拉到旁边。
3. 最后给 absolute 和 float+BFC 作为补充。
4. 用表格对比，说明选型理由。

### 核心要点

**1. flex（推荐）**

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
.center { flex: 1; min-width: 0; }  /* min-width: 0 防止内容撑破 */
```

如果希望**中间内容在 DOM 中靠前**（利于 SEO/首屏），可以配合 `order`：

```css
.center { order: 1; }  /* DOM 中 center 放第一个，视觉排中间 */
.left   { order: 0; }
.right  { order: 2; }
```

**2. grid（最简洁）**

```css
.layout {
  display: grid;
  grid-template-columns: 200px 1fr 200px;  /* 或 minmax(200px, 1fr) */
  grid-template-areas: "left center right";
  min-height: 100vh;
  gap: 16px;
}
```

响应式更强：`grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))` 自动换行等分。

**3. 圣杯布局（Holy Grail）**

思路：三列都 `float: left`，中间列 `width: 100%` 占满，然后左列用 `margin-left: -100%` 拉到最左，右列用 `margin-left: -200px`（自身宽度）拉到最右；父容器用左右 padding 预留空间，再用 `relative` 把左右列"推"进预留区。

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

思路：同样三段浮动 + 中间 100%，区别是**不给父容器 padding**，而是给中间列内部再套一层 div，用它的左右 margin 让出两侧空间。

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
.center-inner { margin: 0 200px; }   /* 关键：内容区让位 */
.left  { float: left; width: 200px; margin-left: -100%; }
.right { float: left; width: 200px; margin-left: -200px; }
```

**圣杯 vs 双飞翼**

| 对比 | 圣杯 | 双飞翼 |
|---|---|---|
| 让位方式 | 父级 `padding` + 子级 `relative` 偏移 | 中间列内部 `margin` |
| 额外 DOM | 无 | 多一层包裹 div |
| 定位属性 | 需要 `position: relative` | 不需要 |
| 共同点 | 都是 float + 负 margin，中间列 DOM 优先 | 同 |

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

**选型结论**

- 新项目：**grid 或 flex**，两三行搞定，无需清浮动。
- 需要中间列优先渲染且兼容老浏览器：圣杯/双飞翼。
- 两栏"左固定右自适应"：`flex: 0 0 200px` + `flex: 1`，或 `float` + `overflow: hidden`。

### 口述回答（约 90 秒）

> 我会分两档答：现代方案和经典方案。
>
> 现代方案最省事。flex 三行：容器 `display: flex`，左右 `flex: 0 0 200px`，中间 `flex: 1`，如果想让中间列在 DOM 里靠前又显示在中间，加个 `order` 就行。grid 更直接，`grid-template-columns: 200px 1fr 200px`，一行搞定，还能配 `minmax` 和 `auto-fit` 做响应式。
>
> 经典方案是圣杯和双飞翼，它们存在的意义是**让中间的主要内容在 DOM 中优先加载**，利于首屏和 SEO，同时又不用绝对定位。两者的共同思路是：三列都左浮动，中间列宽度 100% 占满一整行，左列用 `margin-left: -100%` 拉到这一行最左边，右列用 `margin-left: -200px` 拉到最右边。
>
> 差别在怎么给左右列"腾位置"：圣杯是给父容器加左右 padding，然后左右列用 `position: relative` 偏移进这个 padding 区；双飞翼是不动父容器，而是在中间列里再套一层 div，用它的左右 margin 让出空间。所以双飞翼多一层 DOM，但不需要 relative。
>
> 还有两种补充：float 加右侧 `overflow: hidden` 做自适应两栏，以及 absolute 定位做三栏，但绝对定位撑不开父级高度。
>
> 实际项目我都用 flex 或 grid，圣杯双飞翼主要是理解负 margin 和内容优先渲染这两个点。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| 为什么中间列要放最前面？ | 内容优先加载/渲染，SEO 和首屏体验更好；屏幕阅读器也会先读主内容 |
| `margin-left: -100%` 的 100% 相对谁？ | 相对**包含块（父容器内容区）的宽度**，所以正好把元素拉到上一行行首 |
| 圣杯为什么需要 `position: relative`？ | 负 margin 只能拉到行首，还需再向左偏移自身宽度进入父级 padding 区 |
| 双飞翼为什么不需要 relative？ | 让位由内部 margin 完成，不需要把盒子挪出父容器可视区 |
| 三栏布局父级高度怎么撑开？ | flex/grid 天然撑开；float 方案需清浮动（`flow-root`/clearfix）；absolute 方案撑不开，要写死高度 |
| 中间列内容溢出怎么办？ | flex 方案加 `min-width: 0`；grid 用 `minmax(0, 1fr)` 而非 `1fr`（`1fr` 的 min 是 auto） |
| 如何做"两侧固定、中间自适应、且整体有最大宽度"？ | 外层容器 `max-width: 1200px; margin: 0 auto`，内层再 flex/grid |

---

## 本主题自测

1. 浮动"半脱离文档流"是什么意思？为什么文字会绕开？
2. 说出 BFC 的 5 条触发条件和 3 个应用。
3. `relative` 为什么"不影响布局"？它最重要的用途是什么？
4. 没有定位祖先时 absolute 相对谁？ICB 和 body 的三点区别。
5. `flex: 1` / `flex: 1 0 auto` / `flex: 1 0 0` 分别用在什么场景？
6. 手写圣杯布局，并解释每个负 margin 的作用。
