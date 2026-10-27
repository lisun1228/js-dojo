# CSS · 02 选择器与层叠

> 覆盖原题：11、13、20、21、27、28、29、30（部分）、35、48
> 4 个知识点：选择器分类、优先级、伪类与伪元素、层叠上下文

---

## 目录

- [本主题速查](#本主题速查)
- [Q6 · 选择器的分类与写法](#q6--选择器的分类与写法)
- [Q7 · 选择器优先级与权重计算](#q7--选择器优先级与权重计算)
- [Q8 · 伪类与伪元素](#q8--伪类与伪元素)
- [Q9 · 层叠上下文、层叠顺序与 z-index](#q9--层叠上下文层叠顺序与-z-index)
- [本主题自测](#本主题自测)

---

## 本主题速查

| 编号 | 知识点 | 合并自 |
|---|---|---|
| Q6 | 选择器的分类与写法 | 30 |
| Q7 | 选择器优先级与权重计算 | 13、27、35 |
| Q8 | 伪类与伪元素 | 11 |
| Q9 | 层叠上下文、层叠顺序与 z-index | 20、21、28、29、48 |

选择器决定选中谁，优先级决定同一元素上哪条声明生效，层叠上下文决定绘制时谁盖住谁。

---

## Q6 · 选择器的分类与写法

> 合并原题：30（只取选择器部分，继承见 Q4）

**一句话答案**：五类——基础（通配/标签/类/ID/属性）、组合（后代/子代/相邻/通用兄弟）、伪类、伪元素、逻辑型（`:not`/`:is`/`:where`/`:has`）。日常以类选择器加后代/子代组合为主。

### 基础与组合

```css
*                        /* 通配，权重 0 */
div                      /* 标签 */
.card                    /* 类，最常用 */
#header                  /* ID，样式层不用 */
[type="text"]            /* 属性 */
a[href^="https"]         /* 前缀 */
a[href$=".pdf"]          /* 后缀 */
a[href*="example"]       /* 包含 */
[class~="btn"]           /* 词列表包含 */
[lang|="zh"]             /* 等于 zh 或以 zh- 开头 */

.a .b     /* 后代，任意层级 */
.a > .b   /* 子代，仅直接子元素 */
.a + .b   /* 相邻兄弟，紧随其后的一个 */
.a ~ .b   /* 通用兄弟，后面所有同级 */
.a.b      /* 交集：同时有 a、b 两个类 */
```

伪类与伪元素的完整清单见 Q8。逻辑型选择器：

```css
.card:has(img) { padding: 0; }            /* 反向选中：含 img 的卡片 */
:where(h1, h2, h3) { margin-block: 0; }   /* 权重恒为 0 */
:is(#app, .app) .title { color: #333; }   /* 取参数中最高权重 */
```

- `:where()` 与 `:is()` 匹配能力一致，唯一差别是权重：前者恒 0，后者取括号内最高值（实测见 Q7）。重置/基础样式用 `:where()`，业务覆盖时不会被卡住。
- `:has()` 现代浏览器已支持，可用 `CSS.supports('selector(:has(a))')` 判定（Chrome 实测为 `true`），老项目需降级。

### 工程选择

样式统一用类选择器 + BEM，不用 ID 和标签选择器，把优先级压在同一层，避免引入 `!important`。

### 口述要点（选择器）

- 五类：基础、组合、伪类、伪元素、逻辑型；每类给 1–2 个例子即可。
- 组合符只表达关系、不贡献权重；`.a.b` 是交集，`.a .b` 是后代。
- `:has()` 按子元素反向选父级；`:where()` 权重为 0，专门用于可被业务覆盖的基础样式。
- 工程上把权重压平，优先级就不会失控。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| `:is()` 和 `:where()` 的区别？ | 权重不同：`:where()` 恒为 0，`:is()` 取参数最高值；匹配能力一致 |
| `:has()` 兼容性如何？ | 现代浏览器已支持，可用 `CSS.supports` 判定，老项目需降级 |
| `nth-child` 和 `nth-of-type` 区别？ | 前者按全部同级元素计数，后者按同类型标签计数 |
| `+` 和 `~` 区别？ | `+` 只匹配紧随其后的一个兄弟，`~` 匹配后面所有同级兄弟 |

---

## Q7 · 选择器优先级与权重计算

> 合并原题：13（选择器优先级）、27（优先级怎么排）、35（同 13）

**一句话答案**：优先级是四元组 `(行内, ID, 类/属性/伪类, 标签/伪元素)`，逐位比较、不进位；`!important` 独立更高一档；同权重后声明胜；`@layer` 的层序压过权重。

### 权重四元组

| 位置 | 含义 | 示例 | 权重 |
|---|---|---|---|
| a | 行内样式 | `style="color:red"` | (1,0,0,0) |
| b | ID 选择器 | `#app` | (0,1,0,0) |
| c | 类、属性选择器、伪类 | `.btn`、`[type=text]`、`:hover` | (0,0,1,0) |
| d | 标签、伪元素 | `div`、`::before` | (0,0,0,1) |
| — | 通配符、组合符 | `*`、`>`、`+`、`~` | (0,0,0,0) |

逐位从左到右比较，某一位大的直接胜出，永不进位：

```css
#nav .item { }   /* (0,1,0,0) */
.nav .item { }   /* (0,0,2,0)，b 位 0 < 1，输 */
.item a { }      /* (0,0,1,1)，同样输 */
/* 10 个类 = (0,0,10,0)，仍然输给 (0,1,0,0) */
```

实测（`getComputedStyle` 读最终生效颜色）：

```
#nav .item vs .nav .item          → rgb(1,1,1)    ID 位胜
#idA vs 10 个类                   → rgb(3,3,3)    不进位
:not(.q) vs div.n1                → rgb(10,10,10) :not 只算参数权重 (0,0,1,0)
:is(#id,.c) .t vs .a1 .a2 .t      → rgb(7,7,7)    :is 取最高 (0,1,1,0)
:where(#id) .x vs .y .x           → rgb(6,6,6)    :where 权重 0
.combo > .ck vs .combo .ck        → rgb(35,35,35) 同权重后声明胜，> 不加权
.pc :first-child vs .pc .y        → rgb(41,41,41) 伪类是 c 位
section::before vs .xpe::before   → rgb(42,42,42) 伪元素是 d 位
```

### `!important` 与层叠总序

`!important` 不是第五位，而是独立的更高一档：两个 `!important` 之间再比四元组，只有更强的 `!important` 能覆盖它。

层叠顺序（从高到低）：

1. 用户代理 `!important`
2. 用户样式 `!important`
3. 作者样式 `!important`
4. 动画（`@keyframes` 中的声明）
5. 作者普通样式（行内 > ID > 类 > 标签）
6. 用户普通样式
7. 用户代理普通样式
8. 继承值 / 初始值（不进比较）

### `@layer` 层叠层

```css
@layer reset, base, components, utilities;
/* 后声明的层优先级更高；未分层的普通样式高于所有分层 */
```

- 普通声明：层与层的顺序压过选择器权重，层内再比四元组。
- 重要声明（`!important`）：层序反转，先声明的层胜；分层的重要声明高于未分层的重要声明。

实测：

```
@layer b #id vs @layer a .class                     → rgb(11,11,11) 后声明的层胜
@layer c #id vs 未分层 .class                       → rgb(14,14,14) 未分层胜
@layer e #id!important vs @layer d .class!important → rgb(16,16,16) 重要声明层序反转
@layer f .class!important vs 未分层 #id!important   → rgb(17,17,17) 分层重要声明胜
动画 vs 普通作者声明                                → rgb(27,27,27) 动画更高
动画 vs 作者 !important                             → rgb(29,29,29) 作者 !important 更高
keyframes 内的 !important                           → rgb(31,31,31) 被忽略
```

### 继承与内联

- 继承值不参与优先级，任何声明都能覆盖它：父元素上的 ID 级声明会原样继承给子元素，子元素一旦被 `#par span`（0,1,0,1）命中、甚至被 `*`（0,0,0,0）命中，都会覆盖继承值。
- 内联样式 (1,0,0,0) 高于任何选择器，但低于 `!important`：实测内联 vs `#id` 取内联值，内联 vs 类 `!important` 取 `!important` 值。

### 口述要点（优先级）

- 四元组按「行内、ID、类/属性/伪类、标签/伪元素」记，逐位比较、不进位，十个类打不过一个 ID。
- `!important` 单独一档，位于动画之上；动画声明位于普通作者样式之上。
- `@layer` 的层序压过权重：普通声明后层胜，`!important` 先层胜。
- `:is()`、`:not()` 取参数最高权重，`:where()` 恒为 0；继承来的值谁都能覆盖。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| 行内样式能覆盖 ID 选择器吗？ | 能，(1,0,0,0) > (0,1,0,0)；但覆盖不了 `!important` |
| 同权重同顺序谁生效？ | 后声明的生效；跨样式表时看引入顺序 |
| 为什么 `!important` 不好？ | 只能靠更多 `!important` 覆盖，用 `@layer` 或 `:where()` 更可控 |

---

## Q8 · 伪类与伪元素

> 合并原题：11

**一句话答案**：伪类（单冒号）选中处于某种状态或结构位置的真实元素；伪元素（双冒号）创建或选中原本不存在的盒子/片段。CSS3 用双冒号区分，为兼容 IE8 部分伪元素仍可写单冒号。

### 分类

| 伪类类别 | 例子 |
|---|---|
| 交互状态 | `:hover`、`:active`、`:focus`、`:focus-visible`、`:focus-within`、`:visited`、`:link` |
| 结构位置 | `:first-child`、`:last-child`、`:nth-child(n)`、`:nth-of-type(n)`、`:only-child`、`:empty`、`:root` |
| 表单状态 | `:checked`、`:disabled`、`:enabled`、`:required`、`:valid`、`:invalid`、`:placeholder-shown` |
| 逻辑组合 | `:not()`、`:is()`、`:where()`、`:has()` |
| 其他 | `:target`、`:lang()`、`:scope`、`:defined` |

| 伪元素 | 作用 |
|---|---|
| `::before` / `::after` | 在内容前后插入生成内容，**必须写 `content`**（空串也算） |
| `::first-line` / `::first-letter` | 首行/首字母（仅块级容器） |
| `::selection` | 选中文本的高亮 |
| `::placeholder` | 表单占位符 |
| `::marker` | 列表项符号 |
| `::file-selector-button` | 文件上传按钮 |
| `::backdrop` | dialog / 全屏元素的背景层 |

### 必答细节

- `::before`/`::after` 默认 `display: inline`（实测 computed `display` 为 `inline`），设宽高前要改成 `block`/`inline-block`。
- 生成的伪元素不在 DOM 里，`querySelector` 拿不到，但 `getComputedStyle(el, '::before').content` 能读到（实测返回 `"X"`）。
- 替换元素（`img`、`input` 等）不生成 `::before`/`::after` 盒子：给 `img::before` 声明 `position: fixed` 后该坐标命中的仍是 `HTML`，同结构的 `span::before` 能命中 `span` 本身。注意 `content` 的计算值仍会返回声明值，不能拿它判断是否渲染。
- 伪元素上可以继续加伪类：`.btn:hover::after { }`。
- LVHA 顺序：`:link` → `:visited` → `:hover` → `:focus` → `:active`；这些伪类权重相同，写反就会被后面的规则覆盖。

### 常见用途

```css
/* 表单校验反馈 */
input:invalid:not(:placeholder-shown) { border-color: #e5484d; }

/* 容器内任意子元素聚焦时高亮整卡 */
.card:focus-within { box-shadow: 0 0 0 2px #4c8dff; }

/* 列表项之间加分隔线（不污染第一个） */
li + li::before { content: '·'; margin: 0 8px; }
```

### 口述要点（伪类与伪元素）

- 本质区别：伪类选真实元素的状态，伪元素造盒子或选片段。
- 伪类三组常用值：交互状态、结构位置、表单状态；伪元素主力是 `::before`/`::after`，必须写 `content`，默认 `inline`。
- 伪类计入 c 位、伪元素计入 d 位。
- 实际用途：伪元素做图标与分隔线、`:focus-within` 做整块高亮。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| 伪元素能被 JS 选中吗？ | 不能进 DOM；只能用 `getComputedStyle(el, '::before')` 读样式 |
| `content` 能放什么？ | `attr(data-label)`、`counter(x)`、`var(--x)` |
| 为什么写 `.btn:hover` 而不是 `:hover`？ | 后者命中所有处于 hover 的元素，范围失控 |
| `::first-line` 为什么有时不生效？ | 只能用于块级容器，内部有行内块/图片时表现受限 |
| `:nth-child(2n+1)` 和 `:nth-child(odd)`？ | 等价；`an+b` 形式还支持 `:nth-child(-n+3)` 取前三个 |

---

## Q9 · 层叠上下文、层叠顺序与 z-index

> 合并原题：20（哪些属性会创建层叠上下文）、21（层叠上下文与层叠顺序）、28（对 z-index 的理解）、29（对层叠上下文的理解）、48（元素的层叠顺序）

**一句话答案**：层叠上下文是一个独立的层级区域，内部元素的 `z-index` 只和同一上下文内的元素比较；`z-index` 只在定位元素或 flex/grid 子项上生效。

### 定义与创建条件

层叠上下文（stacking context）是按 3D 层级排列的独立区域，内部元素 `z-index` 再大也压不过上下文之外的兄弟——即层叠上下文隔离。

| 类别 | 触发条件 |
|---|---|
| 根 | `html` |
| 定位 + z-index | `position: relative/absolute` 且 `z-index` 不为 `auto` |
| 固定/粘性 | `position: fixed` / `sticky`（`z-index: auto` 也创建） |
| Flex/Grid 子项 | 父级是 flex/grid 容器，子项 `z-index` 不为 `auto` |
| 透明度 | `opacity` < 1 |
| 变换/滤镜 | `transform`、`filter`、`perspective`、`backdrop-filter`、`clip-path` 不为 `none` |
| 隔离 | `isolation: isolate` |
| 混合模式 | `mix-blend-mode` 不为 `normal` |
| 性能相关 | `will-change` 指定了上述属性；`contain: layout` / `paint` / `content` |
| 其他 | `-webkit-overflow-scrolling: touch`（iOS） |

实测（`elementFromPoint` 判定同一坐标最上层元素，兄弟层为 `z-index: 1`，子元素为 `z-index: 9`）：

```
祖先 position:relative + z-index:auto  → 命中子元素（未隔离，可与外层比较）
祖先 position:relative + z-index:0     → 命中兄弟（祖先自成上下文，锁住子元素）
祖先 position:fixed + z-index:auto     → 命中兄弟（fixed 无条件创建）
祖先 opacity:0.99                      → 命中兄弟（opacity < 1 创建）
```

### 层叠顺序（从下到上，7 层）

1. 当前上下文的**背景和边框**
2. **负 z-index** 子元素
3. **块级**（非定位）子元素
4. **浮动**元素
5. **行内**子元素
6. `z-index: 0 / auto` 的**定位**元素
7. **正 z-index** 子元素（数值大的在上，同值后写在上）

实测：负 `z-index` 子元素在父级背景之上、被常规流块级内容压住；浮动元素压住常规流块级元素。

### z-index 生效条件

- 元素需是定位元素（`position` 非 `static`），或 flex/grid 容器的子项。实测：普通 `div` 写 `z-index: 5` 与 `z-index: 1`，靠后的那个仍在上（`z-index` 被忽略）；换成 flex 子项后立即按数值生效。
- 支持负值与 `auto`；`auto` 不创建新上下文，子元素可以穿透参与外层比较。

### 失效排查顺序

1. 没定位，也不是 flex/grid 子项 → `z-index` 不生效。
2. 祖先创建了上下文（`opacity`、`transform`、`filter`、`will-change`、`fixed`、`z-index: 0`）→ 提升**祖先**的 `z-index` 或去掉该属性。
3. 比较对象是祖先而非自己：兄弟分属不同父级时，比的是各自父级的层级。
4. 父级 `overflow: hidden` → 超出部分被裁剪，看起来像被盖住。

```css
/* 典型修复：提升祖先，而不是继续加子元素的 z-index */
.modal-wrapper { position: relative; z-index: 100; }
```

### 口述要点（层叠上下文）

- `z-index` 只在同一层叠上下文内比较，父级上下文会把子元素锁在里面。
- 创建条件记六类：根元素、定位 + `z-index`、fixed/sticky、flex/grid 子项 + `z-index`、`opacity` < 1、`transform`/`filter` 等。
- 七层顺序：背景边框 → 负 z-index → 块级 → 浮动 → 行内 → z-index 0/auto 的定位元素 → 正 z-index。
- 排查先看定位，再看祖先是否创建了上下文；修法通常是提升祖先。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| 子元素 `z-index: 9999` 为什么还被盖住？ | 父级创建了层叠上下文，子元素只能在该上下文内排序 |
| `z-index: 0` 和 `auto` 的区别？ | `0` 创建新上下文并参与排序；`auto` 不创建，子元素可穿透参与外层比较 |
| 负 z-index 会跑到父元素背景下面吗？ | 不会：在父级背景之上、父级常规流内容之下 |
| `opacity: 0.99` 会创建上下文吗？ | 会，小于 1 即创建 |
| 如何避免 z-index 军备竞赛？ | 用 CSS 变量定义层级阶梯（`--z-modal: 100`），或用 `isolation: isolate` 划边界 |
| 浮动元素和块级元素谁在上？ | 浮动在上，但浮动不脱离文字，会发生文字环绕 |

---

## 本主题自测

1. `.a #b .c` 和 `#a .b .c` 谁的权重高？（答：都是 (0,1,2,0)，同权重时后声明的生效）
2. 十个类选择器能压过 1 个 ID 吗？（不能）
3. `::before` 不生效的三个常见原因？（没写 content、元素是替换元素、display 为 inline 却设了宽高）
4. 画出 7 层层叠顺序。
5. 一个 `opacity: 0.99` 的父元素里，子元素 `z-index: 9999` 为什么压不过外面的侧边栏？
