# CSS · 07 工程化与样式加载

> 覆盖原题：26、36、37、59
> 合并后 2 个知识点 ｜ 重要度 ★★

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

---

## Q30 · link 与 @import 的区别

> 合并原题：26、59（完全重复）

**一句话答案**：`link` 是 HTML 标签，HTML 解析器遇到就发起请求，可与其它资源并行；`@import` 是 CSS at-rule，必须位于样式表所有规则之前，且要等宿主 CSS 下载并解析到该行才会被发现，因此串行、多一个 RTT。样式入口用 `link`。

### 核心要点

| 维度 | `<link>` | `@import` |
|---|---|---|
| 本质 | HTML 标签，属于 DOM | CSS at-rule，属于样式表内部规则 |
| 发现与加载 | HTML 解析到标签即请求，可并行 | 等宿主 CSS 下载解析到该行才请求，串行 |
| JS 可控 | 可动态创建 / 修改 / 移除 | 不可 |
| 位置要求 | 任意位置（`<head>` 内最佳） | 必须在所有规则之前（`@charset`、`@layer` 语句除外），否则被忽略 |
| 媒体条件 | `media` 属性 | `@import url(x.css) print;` |
| 层叠顺序 | 按标签顺序参与层叠 | 引入内容在 `@import` 所在位置参与层叠 |
| 预加载 | 可配 `rel="preload"` / `rel="prefetch"` | 无法对 `@import` 的目标单独声明 |

兼容性不构成差异：现代浏览器两者都支持。

**为什么串行是硬伤**

`<link rel="stylesheet">` 被解析到就发起请求，多个 `link` 并行；而 `@import` 的目标文件要等宿主 CSS 下载并解析到那一行才被发现：

```
下载 a.css（RTT）→ 解析发现 @import → 下载 b.css（RTT）
```

首屏渲染要等 CSSOM 就绪，这段串行链路会整体推迟渲染。请求顺序上：宿主 CSS 响应结束之前，被导入文件不会发起请求；多个 `<link>` 的请求则在同一时刻开始。

**`link` 的预加载能力**

```html
<link rel="stylesheet" href="main.css">

<!-- preload：只下载不应用，需在 onload 里切回 stylesheet -->
<link rel="preload" as="style" href="critical.css" onload="this.rel='stylesheet'">

<!-- prefetch：预取下一次导航的资源，当前页不使用 -->
<link rel="prefetch" href="next-page.css">

<!-- 媒体不匹配时不应用、不阻塞渲染，但仍会下载 -->
<link rel="stylesheet" href="print.css" media="print">
```

`preload` 把发现时机提前到标签被解析时：不加它，样式表要等 HTML 解析到 `<link rel="stylesheet">` 才请求；加了它，head 里解析到 `preload` 就请求，后续 `stylesheet` 复用同一次响应，不会重复下载。

**`@import` 仍有价值的场景**

- 条件样式：`@import url(print.css) print;`，按媒体条件引入。
- 分层：`@import url(x.css) layer(base);`，把引入的样式放进指定 `@layer`。

**现代替代方案**

- 构建期合并：Vite / Webpack 链路里的 `@import`（`postcss-import`、`sass`）在编译期处理，产物里没有 `@import`，不产生运行时串行请求。源码里的 `@import` 与产物里的 `@import` 要分开看。
- 样式分层：`@layer` 控制层叠顺序，替代靠书写顺序压权重。
- 关键 CSS：首屏样式内联进 `<style>`，其余样式用 `preload` 或 JS 异步加载。

### 口述要点

- 运行时样式入口一律用 `link`；需要 JS 控制（换肤、按需加载）也只有 `link`。
- `@import` 值得保留的写法只剩两种：`print` 条件样式、`layer()` 分层。
- 异步加载样式：`preload as="style"` + `onload` 切 `rel`，或 JS 插入 `<link>`。

### 可能被追问

| 追问 | 回答要点 |
|---|---|
| `@import` 写在样式中间会怎样？ | 被忽略，也不会发起请求 |
| 为什么 `@import` 更慢？ | 要等宿主 CSS 下载解析后才能发现，串行多一个 RTT；首屏要等 CSSOM |
| `@import` 会影响优先级吗？ | 会，引入内容按 `@import` 所在位置参与层叠 |
| 构建工具里的 `@import` 有性能问题吗？ | 没有，编译期已合并进产物 |
| 如何异步加载 CSS？ | `rel="preload" as="style" onload="this.rel='stylesheet'"`，或 JS 动态插入 |
| `link` 能加载非 CSS 资源吗？ | 能，`rel="icon"`、`rel="preconnect"`、`rel="manifest"` 等 |
| 现代 CSS 怎么替代 `@import` 的分层能力？ | `@layer` |

---

## Q31 · Sass / Less 预处理器

> 合并原题：36（Less 和 Sass 是什么）、37（Sass 是什么）

**一句话答案**：Sass 和 Less 都是 **CSS 预处理器**——在 CSS 之上增加变量、嵌套、Mixin、函数、运算、模块化，编译后输出普通 CSS。Sass 功能更完整、生态更大；Less 语法更接近 CSS，维护活跃度更低。

### 核心要点（预处理器）

| 痛点 | 解法 |
|---|---|
| 颜色 / 尺寸散落，改一处要全局搜 | 变量：`$primary` / `@primary` |
| 选择器层层重复 | 嵌套 + `&` 引用父级 |
| 重复样式片段（清除浮动、文字截断） | Mixin（可传参） |
| 无逻辑能力 | `@if` / `@each` / `@for` |
| 全局污染 | Sass `@use` / `@forward`，Less `@import` + 命名空间 |
| 无法做颜色运算 | `color.mix()`、`color.adjust()`、`color.scale()` |

**Sass 与 Less 对比**

| 维度 | Sass（SCSS） | Less |
|---|---|---|
| 变量符号 | `$color: #333;` | `@color: #333;` |
| Mixin | `@mixin name($a) {}` + `@include name(1)` | `.name(@a) {}` + `.name(1)` |
| 继承 | `@extend .base;`（合并选择器输出） | `:extend(.base)`（选择器扩展） |
| 模块化 | `@use` / `@forward`（作用域隔离） | `@import`（全局合并） |
| 控制流 | `@if` / `@each` / `@for` / `@while` | 有 `when` guard 和循环，能力较弱 |
| 内置函数 | 颜色、数学、字符串、列表、map | 较少，支持自定义函数 |
| 编译 | `dart-sass` / `sass-loader` | 可编译，也可引入 `less.js` 运行时编译 |
| 语法 | `.scss`（CSS 超集）、`.sass`（缩进） | `.less`，接近 CSS |
| 生态 | Bootstrap 5、Element Plus | 老项目、Ant Design 4 及更早 |
| 现状 | `node-sass` 已废弃，用 `dart-sass` | 维护活跃度低于 Sass |

**Sass 两种语法**

```scss
// .scss：CSS 超集，大括号 + 分号
.box {
  color: red;
  &:hover { color: blue; }
}
```

```sass
// .sass：缩进语法，无大括号和分号
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

  &__title { font-weight: 600; }         // .card__title
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

**Sass 变量与 CSS 变量的区别**

| 维度 | Sass 变量 `$x` | CSS 变量 `--x` |
|---|---|---|
| 生效时机 | 编译时，产物里不存在 | 运行时，浏览器解析 |
| JS 修改 | 不能 | 能（`style.setProperty`） |
| 继承 / 级联 | 不能，作用域是编译期的块 | 能 |
| 媒体查询条件 | 能（编译期替换） | 不能（媒体查询不支持 `var()`） |
| 主题切换 | 需编译多套 CSS | 改变量即可 |
| 调试 | 产物中不可见 | DevTools 可见可改 |
| 适用 | 编译期常量（断点、栅格数） | 运行时主题（颜色、间距） |

**工程实践**

- **嵌套不超过 3 层**：嵌套越深，选择器越长、权重越高、复用越难；BEM 命名 + 最多两层嵌套。
- **变量分层**：`tokens`（原始值）→ `theme`（语义变量）→ 组件引用语义变量，便于换肤。
- **Mixin 只封装会变的模式**（清除浮动、1px 边框、断点），不为复用而过度抽象。
- **`@extend` 慎用**：合并选择器，容易跨文件样式穿透。
- **PostCSS 不是预处理器**：它是靠插件做转换的 CSS 工具链（autoprefixer、px-to-viewport），常与 Sass 串联：Sass 编译 → PostCSS 加前缀。
- **原生 CSS 已覆盖部分能力**：`@layer`、CSS Nesting、`color-mix()`、`clamp()`；变量体系、Mixin、循环在复杂项目里仍有价值。

### 口述要点（预处理器）

- 预处理器 = CSS 超集 + 编译：源码有变量、嵌套、Mixin、控制流，产物是普通 CSS。
- Sass 与 Less 的实质差别在模块系统和控制流，语法糖层面差别很小。
- 选择标准：编译期常量用 Sass 变量，运行时主题用 CSS 变量；后者不能出现在媒体查询条件里。
- 工程约束：嵌套不超过 3 层、Mixin 只封装会变的模式、`@extend` 少用。
- 原生 CSS 的 `@layer`、Nesting、`color-mix()` 已覆盖一部分预处理器能力。

### 可能被追问（预处理器）

| 追问 | 回答要点 |
|---|---|
| Sass 变量和 CSS 变量怎么选？ | 编译期常量用 Sass，运行时主题 / 可被 JS 改的用 CSS 变量 |
| `@extend` 和 Mixin 的区别？ | `@extend` 合并选择器（产物小但易穿透），Mixin 复制声明（产物大但隔离） |
| 嵌套太深有什么问题？ | 选择器变长、权重变高、产物变大、难覆盖 |
| `node-sass` 和 `dart-sass` 区别？ | `node-sass` 基于 LibSass、需按 Node 版本编译、已废弃；`dart-sass` 是官方现役实现 |
| PostCSS 是预处理器吗？ | 不是，是插件式转换工具，常与 Sass 串联 |
| 现在还需要预处理器吗？ | 简单项目可用原生嵌套 + CSS 变量；复杂项目里 Mixin、循环、模块化仍有价值 |
| Less 能直接在浏览器跑吗？ | 能，引入 `less.js` 运行时编译，但会增加首屏脚本开销 |
| CSS 原生嵌套和 Sass 嵌套的区别？ | 原生嵌套的 `&` 不是字符串替换，`&__title` 无效；BEM 要单独写 `.card__title`，其余场景可用 `&:hover`、`&.active`、`& .child` |

---

## 本主题自测

1. `@import` 为什么比 `link` 慢？慢在哪一步？
2. 构建工具里的 `@import` 有性能问题吗？为什么？
3. Sass 变量和 CSS 变量的四个关键差异。
4. `@extend` 的风险是什么？
5. 为什么嵌套不建议超过三层？
