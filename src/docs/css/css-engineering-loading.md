# CSS · 07 工程化与样式加载

> 覆盖原题：26、36、37、59
> 合并后 2 个知识点 ｜ 重要度 ★★ ｜ 建议时长 25 分钟

---

## 目录

- [本主题速查](#本主题速查)
- [Q30 · link 与 @import 的区别](#q30--link-与-import-的区别)
- [Q31 · Sass / Less 预处理器](#q31--sass--less-预处理器)
- [本主题自测](#本主题自测)

---

## 本主题速查

| 编号 | 知识点 | 合并自 |
|---|---|---|
| Q30 | link 与 @import 的区别 | 26、59 |
| Q31 | Sass / Less 预处理器 | 36、37 |

一句话主线：**这两题都是"知道就会，不知道就废"的记忆型题目，不需要深挖原理，但必须能给出准确的对比和一句工程结论。** 答题时间控制在 60 秒以内即可。

---

## Q30 · link 与 @import 的区别

> 合并原题：26、59（完全重复）

**一句话答案**：`link` 是 HTML 标签，属于 DOM 的一部分，浏览器解析 HTML 时**并行**发现并加载，可用 JS 动态操作；`@import` 是 CSS 的语法规则，必须写在样式表最前面，浏览器要**先下载并解析完宿主 CSS** 才能发现它，形成串行加载，阻塞渲染。所以工程上一律用 `link`。

### 答题思路

1. 先给"从属不同"这个最本质的区别：一个是 HTML 标签，一个是 CSS 规则。
2. 讲串行 vs 并行加载——这是性能上最实际的差异。
3. 讲可控性（JS 能否操作）和使用约束（`@import` 必须在最前面）。
4. 给工程结论 + 现代替代方案（`@layer`、构建工具合并）。

### 核心要点

**对比表**

| 维度 | `<link>` | `@import` |
|---|---|---|
| 本质 | HTML 标签 | CSS 的 at-rule |
| 归属 | DOM 的一部分 | 样式表内部规则 |
| 加载方式 | 解析 HTML 时**并行**发现并请求 | 必须先下载解析宿主 CSS 才能发现，**串行** |
| 兼容性 | 所有浏览器 | IE5+，但部分旧浏览器对 `@import` 支持有 bug |
| JS 可控 | 可以动态创建/修改/移除，做主题切换、按需加载 | 不可，无法通过 DOM 操作 |
| 位置要求 | 任意位置（`<head>` 内最佳） | 必须在样式表**最前面**（除 `@charset`、`@layer` 语句外），否则被忽略 |
| 媒体查询 | `media` 属性 | 支持 `@import url(x.css) screen and (min-width: 768px)` |
| 权重影响 | 按引入顺序参与层叠 | 内容插入在 `@import` 所在位置参与层叠 |
| 预加载支持 | 可配 `rel="preload"`、`rel="prefetch"` | 无 |
| 阻塞渲染 | 是（CSS 阻塞渲染） | 是，且因为串行，**阻塞时间更长** |

**为什么串行加载是硬伤**

浏览器解析 HTML 时遇到 `<link rel="stylesheet" href="a.css">` 会立刻发起请求（并行）。但 `a.css` 里的 `@import url(b.css)` 只有在 `a.css` 下载并解析到这一行时才能被发现，于是形成：

```
下载 a.css（RTT）→ 解析发现 @import → 下载 b.css（RTT）
```

两个 RTT 串起来，首屏渲染被推迟一个完整的网络往返。这就是"`@import` 拖慢首屏"的机制，也是所有性能规范都建议避免它的原因。

**`link` 的额外能力**

```html
<!-- 普通引入 -->
<link rel="stylesheet" href="main.css">

<!-- 预加载：提前以高优先级下载，稍后使用 -->
<link rel="preload" as="style" href="critical.css" onload="this.rel='stylesheet'">

<!-- 预取：空闲时下载下一个页面可能用到的样式 -->
<link rel="prefetch" href="next-page.css">

<!-- 按媒体条件加载（不匹配时仍会下载，但优先级低） -->
<link rel="stylesheet" href="print.css" media="print">
```

**`@import` 的合理使用场景（要能说出边界，不能一边倒）**

1. **老项目的样式分层**：早期没有构建工具时，用一个 `index.css` 用 `@import` 聚合各模块样式。现在应由构建工具（Webpack/Vite）在编译期合并，不用运行时 `@import`。
2. **条件加载**：`@import url(print.css) print;` 只在打印时应用。
3. **`@layer` 声明**：现代 CSS 里 `@import url(x.css) layer(base);` 可以把引入的样式放进指定层，这是 `@import` 现在比较有价值的用法。

**现代替代方案**

- 构建期合并：Vite/Webpack 的 `@import` 是**编译期**处理的（`postcss-import` / `sass`），打包后产物里没有 `@import`，不影响运行时性能——这一点要说清楚，别把"源码里的 `@import`"和"产物里的 `@import`"混为一谈。
- 样式分层：`@layer` 替代靠顺序控制优先级的老做法。
- 关键 CSS 内联：首屏关键样式内联到 `<style>`，其余异步加载。

### 口述回答（约 65 秒）

> 最本质的区别是归属：`link` 是 HTML 标签，是 DOM 的一部分；`@import` 是 CSS 的语法规则，写在样式表里面。
>
> 由此带来三个实际差异。
>
> 第一是加载方式。浏览器解析 HTML 时遇到 link 会立刻并行发起请求；而 `@import` 必须先把这个宿主 CSS 下载并解析到那一行，才能发现里面还引了别的文件，所以是串行的，多一个完整的网络往返，首屏会被推迟。这是它最大的性能问题。
>
> 第二是可控性。link 可以用 JS 动态创建、修改、移除，做主题切换和按需加载；`@import` 完全没法用 DOM 操作。
>
> 第三是写法约束。`@import` 必须写在样式表最前面，除了 `@charset` 和 `@layer` 语句，写在别处会被直接忽略，这个坑很常见。
>
> 所以工程上一律用 link。不过要区分一下：如果是在 Sass 或者 Vite、Webpack 里写 `@import`，那是编译期处理的，打包后产物里不会留下 `@import`，不影响运行时性能。现在 `@import` 比较有价值的用法是配合 `@layer` 做样式分层。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| `@import` 写在样式中间会怎样？ | 被浏览器忽略（必须在最前面） |
| 为什么 `@import` 更慢？ | 串行发现，多一个 RTT，且 CSS 阻塞渲染 |
| `@import` 会影响优先级吗？ | 会，引入内容按 `@import` 所在位置参与层叠，同权重看顺序 |
| 构建工具里的 `@import` 有性能问题吗？ | 没有，编译期已合并进产物 |
| 如何异步加载 CSS？ | `rel="preload" as="style" onload="this.rel='stylesheet'"`，或 JS 动态插入 |
| `link` 能加载非 CSS 资源吗？ | 能，`rel="icon"`、`rel="preconnect"`、`rel="manifest"` 等 |
| 现代 CSS 怎么替代 `@import` 的分层能力？ | `@layer` |

---

## Q31 · Sass / Less 预处理器

> 合并原题：36（Less 和 Sass 是什么）、37（Sass 是什么）

**一句话答案**：Sass 和 Less 都是 **CSS 预处理器**——在 CSS 的基础上增加变量、嵌套、Mixin、函数、运算、模块化等能力，编译后输出普通 CSS。Sass 功能更完整（有 `@use` 模块系统、`@each`/`@for` 控制流、更丰富的内置函数），社区生态更大；Less 语法更接近 CSS、可浏览器端编译、上手更轻。现在主流是 Sass（`dart-sass`）。

### 答题思路

1. 先给定义：预处理器 = 超集 + 编译。
2. 讲它解决的四个痛点（变量、嵌套、复用、模块化）。
3. 给 Sass vs Less 的对比表。
4. 讲 Sass 的两种语法（`.scss` / `.sass`）和 `dart-sass` 的现状。
5. **必须讲与 CSS 原生变量的区别**——这是这道题最有价值的追问。
6. 落到工程实践：怎么组织、怎么避免过度嵌套。

### 核心要点

**预处理器解决了什么**

| 痛点 | 预处理器的解法 |
|---|---|
| 颜色/尺寸散落各处，改一处要全局搜 | 变量：`$primary` / `@primary` |
| 选择器层层重复书写 | 嵌套（配合 `&` 引用父级） |
| 重复的样式片段（清除浮动、文字截断） | Mixin（可传参） |
| 无逻辑能力（条件、循环） | `@if` / `@each` / `@for` |
| 无模块化，全局污染 | Sass `@use` / `@forward`，Less `@import` + 命名空间 |
| 无法做颜色运算 | `lighten()`、`darken()`、`mix()`、`color.adjust()` |

**Sass 与 Less 对比**

| 维度 | Sass（SCSS） | Less |
|---|---|---|
| 变量符号 | `$color: #333;` | `@color: #333;` |
| Mixin | `@mixin name($a) {}` + `@include name(1)` | `.name(@a) {}` + `.name(1)`，直接调用 |
| 继承 | `@extend .base;`（输出合并选择器） | 无原生 `@extend`（用 mixin 模拟） |
| 模块化 | `@use` / `@forward`（作用域隔离） | `@import`（全局合并） |
| 控制流 | `@if` / `@else` / `@each` / `@for` / `@while` | 有 guard（`when`）和循环，能力较弱 |
| 内置函数 | 非常丰富（颜色、数学、字符串、列表、map） | 较少，但支持自定义函数 |
| 编译 | 需要编译（`dart-sass` / `sass-loader`） | 可编译，也可浏览器端 `less.js` 运行时编译 |
| 语法 | `.scss`（CSS 超集）、`.sass`（缩进语法） | `.less`，语法接近 CSS |
| 生态 | 更主流，Bootstrap 5、Element Plus 都用 | 老项目、Ant Design 4 及更早用 |
| 现状 | `node-sass` 已废弃，统一用 `dart-sass` | 维护活跃度低于 Sass |

**Sass 两种语法**

```scss
// .scss —— CSS 的超集，用大括号和分号，99% 的项目用它
.box {
  color: red;
  &:hover { color: blue; }
}
```

```sass
// .sass —— 缩进语法，无大括号分号，写起来更短但容错差
.box
  color: red
  &:hover
    color: blue
```

**核心能力示例**

```scss
// 变量 + 嵌套 + & 父级引用
$brand: #4c8dff;

.card {
  border: 1px solid $brand;

  &__title { font-weight: 600; }        // .card__title
  &:hover { box-shadow: 0 2px 8px rgba($brand, .2); }
  .is-active & { border-color: $brand; } // .is-active .card
}

// Mixin 传参
@mixin ellipsis($lines: 1) {
  @if $lines == 1 {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  } @else {
    display: -webkit-box;
    -webkit-line-clamp: $lines;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}
.title { @include ellipsis(2); }

// 循环生成工具类
@for $i from 1 through 12 {
  .mt-#{$i * 4} { margin-top: #{$i * 4}px; }
}

// 模块化
@use 'variables' as v;
@use 'mixins' as *;
```

**最关键的一问：Sass 变量与 CSS 变量的区别**

| 维度 | Sass 变量 `$x` | CSS 变量 `--x` |
|---|---|---|
| 生效时机 | **编译时**，产物里不存在 | **运行时**，浏览器解析 |
| 能否 JS 修改 | 不能 | 能（`style.setProperty`） |
| 能否继承/级联 | 不能，作用域是编译期的块 | 能，遵循继承和层叠 |
| 能否用于媒体查询条件 | 能（编译期替换） | 不能（媒体查询不支持 `var()`） |
| 主题切换 | 需编译多套 CSS | 一处改变量即可 |
| 调试 | 编译后看不到 | DevTools 里可见可改 |
| 适用 | 编译期常量（断点、栅格数） | 运行时主题（颜色、间距） |

**工程实践**

- **避免嵌套超过 3 层**：嵌套越深，产物选择器越长、权重越高、复用越难。BEM 命名 + 最多两层嵌套是常见规范。
- **变量分层**：`tokens`（原始值）→ `theme`（语义变量）→ 组件内引用语义变量，便于换肤。
- **Mixin 只封装"会变的模式"**（清除浮动、1px 边框、媒体查询断点），不要为了复用而过度抽象。
- **`@extend` 慎用**：会合并选择器，容易产生意料之外的样式穿透（尤其在跨文件时）。
- **`dart-sass` 替代 `node-sass`**：`node-sass` 已停止维护，且依赖 Node 版本编译，容易装不上。
- **现代 CSS 的追赶**：原生 `@layer`、嵌套语法（CSS Nesting）、`color-mix()`、`clamp()` 已经覆盖了预处理器的一部分能力，新项目可以少用预处理器，但变量体系、Mixin、循环在复杂项目里仍有价值。
- **PostCSS 不是预处理器**：它是"CSS 的 Babel"，靠插件转换（autoprefixer、px-to-viewport），常与 Sass 串联使用（Sass 编译 → PostCSS 加前缀）。

### 口述回答（约 80 秒）

> Sass 和 Less 都是 CSS 预处理器，本质是在 CSS 之上加了一层编程能力，最后编译成普通 CSS。
>
> 它们主要解决四个痛点：一是变量，颜色、间距这些能统一定义；二是嵌套，不用重复写父选择器，还能用 `&` 引用父级；三是 Mixin，可以把重复的样式片段封装成可传参的函数，比如清除浮动、多行省略；四是有了控制流和函数，能做循环生成工具类、颜色运算。
>
> 两者的差别：Sass 功能更完整，有 `@use` 模块系统、`@each`、`@for` 这些控制流，内置函数也丰富得多，社区生态更大，Bootstrap 5 和 Element Plus 都用它；Less 语法更接近原生 CSS，还能在浏览器端运行时编译，上手更轻，主要出现在老项目和早期的 Ant Design 里。Sass 有两种语法，`.scss` 是 CSS 的超集，用大括号分号，实际项目基本都用这个；`.sass` 是缩进语法，现在很少见。另外 `node-sass` 已经废弃了，现在统一用 `dart-sass`。
>
> 有个常被追问的点是它和 CSS 变量的区别：Sass 变量是**编译时**替换掉的，产物里根本没有这个变量，所以没法用 JS 动态改、也不能继承；CSS 变量是运行时生效的，能继承、能被 JS 改、能做主题切换，但它不能用在媒体查询的条件里。所以我的做法是：编译期常量用 Sass 变量，主题色、间距这类需要运行时切换的用 CSS 变量。
>
> 工程上我会控制嵌套不超过三层，配合 BEM 命名，避免产物选择器又长权重又高。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| Sass 变量和 CSS 变量怎么选？ | 编译期常量用 Sass，运行时主题/可被 JS 改的用 CSS 变量 |
| `@extend` 和 Mixin 的区别？ | `@extend` 合并选择器（产物小但易穿透），Mixin 复制声明（产物大但隔离） |
| 嵌套太深有什么问题？ | 选择器变长、权重变高、产物变大、难覆盖 |
| `node-sass` 和 `dart-sass` 区别？ | `node-sass` 基于 LibSass 需编译、已废弃；`dart-sass` 是官方现役实现 |
| PostCSS 是预处理器吗？ | 不是，是转换工具/插件体系，常与 Sass 串联 |
| 现在还需要预处理器吗？ | 简单项目可用原生嵌套 + CSS 变量；复杂项目里 Mixin、循环、模块化仍有价值 |
| Less 能直接在浏览器跑吗？ | 能，引入 `less.js` 运行时编译，但性能差，只适合演示 |
| CSS 原生嵌套和 Sass 嵌套的区别？ | 原生嵌套必须以 `&` 开头或使用元素选择器，不能像 Sass 那样直接写 `&__title` 拼接 |

---

## 本主题自测

1. `@import` 为什么比 `link` 慢？慢在哪一步？
2. 构建工具里的 `@import` 有性能问题吗？为什么？
3. Sass 变量和 CSS 变量的四个关键差异。
4. `@extend` 的风险是什么？
5. 为什么嵌套不建议超过三层？
