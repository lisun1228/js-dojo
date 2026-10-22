# HTML · 02 语义化、元素分类与 SEO

> 本册覆盖：HTML 语义化（重复 2 次）、行内/块级/空元素（重复 4 次）、SEO
> **这 8 道题是整份题单里重复率最高的部分（元素分类 4 次）。**
> 但题单的答案只有一行「用正确的标签，好处是无障碍、SEO、可读」——**这三条恰好是最容易被打穿的**：语义化对 SEO 的直接作用很弱，元素分类里 `img` 被标成「行内块」是错的。

---

## 目录

- [2.1 一句话结论](#21-一句话结论)
- [2.2 HTML 语义化](#22-html-语义化)
- [2.3 行内元素、块级元素、空元素](#23-行内元素块级元素空元素)
- [2.4 SEO：前端能做什么](#24-seo前端能做什么)
- [2.5 速记卡](#25-速记卡)

---

## 2.1 一句话结论

**语义化 = 用「表达含义」的标签替代「表达样式」的标签**，收益是**可访问性 + 可维护性 + 机器可理解**（SEO 只是第三条的副产物，且直接权重很低）；**元素分类有两条互不相干的线**——HTML 规范分的是「内容模型（能不能出现在哪）」，CSS 分的是「`display` 默认值（怎么排）」，**两者不能混为一谈**。

---

## 2.2 HTML 语义化

### 2.2.1 一句话回答

**语义化就是：让标签本身说明「这块内容是什么」，而不是「这块内容长什么样」。**

```html
<!-- ❌ 不语义：只有 div，含义全靠 class 名（机器读不懂 class 的语义） -->
<div class="header">
  <div class="nav">
    <div class="nav-item" onclick="go('/')">首页</div>
  </div>
</div>
<div class="content">
  <div class="title">文章标题</div>
  <div class="text">正文...</div>
</div>

<!-- ✅ 语义化：标签自带含义 -->
<header>
  <nav>
    <a href="/">首页</a>
  </nav>
</header>
<main>
  <article>
    <h1>文章标题</h1>
    <p>正文...</p>
  </article>
</main>
```

**关键认知**：`class="header"` 和 `<header>` 在**视觉上完全一样**（都要写 CSS），差别在**机器能不能读懂**。谁在「读」？

| 读者 | 读懂了有什么用 |
|---|---|
| **屏幕阅读器** | 可以按「地标（landmark）」跳转：直接跳到 `main`、在 `nav` 列表里选导航、跳过 `footer` |
| **搜索引擎爬虫** | 能识别哪块是正文、哪块是导航/广告（正文权重 vs 噪音） |
| **浏览器** | 阅读模式（Safari Reader）、画中画、翻译、自动填充 |
| **其他工具** | Pocket/Instapaper 正文提取、RSS 生成、无障碍检测工具 |
| **下一个维护者** | 扫一眼就知道结构，不用看 CSS |

### 2.2.2 常用语义标签全表

| 标签 | 含义 | 使用要点 |
|---|---|---|
| `<header>` | 页头 / 区块头部 | 可以出现在 `body` 里，也可以出现在 `article`/`section` 里（表示这一块的头部） |
| `<nav>` | 导航链接组 | **只给主要导航用**，不要把页面所有链接都塞进去 |
| `<main>` | 主体内容 | **一个页面只能有一个**，且不能放在 `article`/`aside`/`nav` 里 |
| `<article>` | **独立、可分发**的内容单元 | 判断标准：**这块内容单独拿出去（RSS、分享）还成立吗？** 成立就是 article |
| `<section>` | 有主题的区块 | **应该有自己的标题**（`h1~h6`），没有标题就用 `div` |
| `<aside>` | 旁支内容 | 侧边栏、相关推荐、广告、作者简介 |
| `<footer>` | 页脚 / 区块尾部 | 可放版权、联系方式、相关链接 |
| `<figure>` / `<figcaption>` | 图 + 图注 | 图片、代码块、图表、引用都可以用 |
| `<time datetime="2026-10-22">` | 时间 | `datetime` 给机器读，标签内文本给人读 |
| `<mark>` | 高亮（搜索命中） | 语义是「因为相关性被标记」，不是「我要黄色背景」 |
| `<details>` / `<summary>` | 原生折叠面板 | **不用一行 JS 就能做手风琴** |
| `<dialog>` | 原生对话框 | 配 `showModal()` 有原生焦点陷阱和 `::backdrop` |
| `<address>` | 联系信息 | 只用于「最近的 article 或 body 的联系方式」，不是「地址」 |
| `<hgroup>` | 标题组 | 主标题 + 副标题打包，避免副标题占一个 heading 层级 |
| `<search>` | 搜索区域 | HTML 新元素（2023 进规范），替代 `<form role="search">` |
| `<picture>` | 响应式图片容器 | 配合 `source` + `media`/`type` |

### 2.2.3 `article` / `section` / `div` 怎么选（高频追问）

```
这块内容「单独拿出去」还有意义吗？
├─ 有（一篇博客、一条评论、一个商品卡）→ <article>
└─ 没有
    ├─ 它有自己的标题、是一个主题区块吗？
    │   ├─ 是 → <section>
    │   └─ 否 → <div>（纯样式容器）
```

**判断口诀**：**article 是「能独立分发」，section 是「有主题」，div 是「只为了布局」。**

```html
<article>                          <!-- 一篇博客，单独拿出去成立 -->
  <header><h1>标题</h1></header>
  <section>                        <!-- 文中的一个主题小节 -->
    <h2>背景</h2>
    <p>...</p>
  </section>
  <section>
    <h2>实现</h2>
    <p>...</p>
  </section>
  <div class="toolbar">            <!-- 纯布局，无语义 -->
    <button>分享</button>
  </div>
  <footer>作者信息</footer>
</article>
```

### 2.2.4 语义化的真实收益（按重要性排序）

| 排序 | 收益 | 具体说明 | 面试价值 |
|---|---|---|---|
| **1** | **可访问性（a11y）** | 读屏器可以用「地标导航」跳过导航直达正文；`<button>` 天然可 Tab 聚焦、可回车触发，`<div onclick>` 不行 | ★★★ 说出来立刻加分 |
| **2** | **可维护性 / 团队协作** | 标签即文档，新人不用看 CSS 就能理解结构 | ★★ |
| **3** | **机器可理解（SEO / 阅读模式 / 提取）** | 爬虫区分正文和噪音；Safari 阅读模式靠 `article` 提取 | ★★ |
| **4** | **渐进增强** | `<details>`、`<dialog>`、表单校验、`<video>` 都是「不写 JS 就能用」 | ★★ |
| **5** | **未来兼容** | 新设备/新交互（语音助手、折叠屏）更依赖语义而不是像素布局 | ★ |

### 2.2.5 语义化的三个常见误解（要主动澄清）

| 误解 | 真相 |
|---|---|
| 「语义化就是不用 `div`」 | 错。`div` 是**合法的无语义容器**，纯布局就该用 div。语义化是「**在需要表达含义的地方用对标签**」，不是「消灭 div」 |
| 「用了语义标签 SEO 就会好」 | 错。语义化对排名的**直接权重极低**。它帮的是「爬虫理解结构」，而排序主要看内容质量、外链、性能、用户体验 |
| 「语义化会影响样式，所以不敢用」 | 错。所有语义标签的默认样式都可以被 CSS 覆盖（`display`、`margin` 全都能改），唯一要注意的是别丢掉**默认的无障碍行为**（比如把 `button` 改成 `display:block` 没问题，但去掉 `outline` 就破坏了键盘可达性） |

### 2.2.6 面试怎么答

**30 秒版**

> 语义化就是用表达含义的标签代替表达样式的标签，比如用 `header`、`nav`、`main`、`article` 而不是一堆 `div class="header"`。它的核心价值不是视觉，而是**让机器能读懂结构**——屏幕阅读器可以按地标跳转到正文，爬虫能区分正文和导航噪音，Safari 阅读模式能提取正文。另外它天然带来渐进增强，比如 `details` 不用一行 JS 就能做折叠面板。要注意的是，语义化不等于不用 `div`，纯布局的容器就该用 div。

**2 分钟版**

> 我分「是什么、为什么、怎么用」三点讲。
>
> **是什么**：语义化是让标签本身携带含义。`div class="header"` 和 `<header>` 视觉上一样，但前者机器读不懂，后者读屏器能识别成「横幅地标」。所以语义化的本质是**给人以外的读者提供结构信息**。
>
> **为什么**：收益按重要性排是三条。第一是**可访问性**，这是最实在的——读屏器用户可以用快捷键在 landmark 之间跳转，直接跳到 `main` 跳过导航；`<button>` 天生可以 Tab 聚焦、回车触发，而 `<div onclick>` 需要自己补 `tabindex`、`role`、键盘事件，还容易补漏。第二是**可维护性**，标签即文档。第三才是**机器可理解**——爬虫能区分正文和噪音，Safari 阅读模式靠 article 提取正文。**这里我要强调一下，语义化对 SEO 排名的直接权重很低，它帮的是「理解」不是「排序」**，很多面试者会把这条夸大。
>
> **怎么用**：判断 article 和 section 的口诀是——article 是「单独拿出去还成立的内容单元」，section 是「有主题的区块，应该有自己的标题」，没有标题或者纯布局就用 div。另外语义标签自带渐进增强：`details/summary` 是原生手风琴，`dialog` 配 `showModal` 有原生焦点陷阱和 backdrop，`input type="email"` 自带格式校验。

**追问表**

| 追问 | 回答要点 |
|---|---|
| 语义化对 SEO 有用吗 | 有帮助但**直接权重很低**；主要是帮爬虫理解结构、提升可访问性（间接影响体验指标） |
| article 和 section 区别 | article 能独立分发（RSS/分享成立）；section 是有主题的区块，应带标题 |
| 一个页面能有几个 `main` | **只能一个** |
| 一个页面能有几个 `h1` | HTML5 允许多个（每个 section 一个），SEO 实践建议一个主 h1 |
| `div` 还有用吗 | 有用，纯布局容器就该用 div；语义化不是消灭 div |
| `header` 只能有一个吗 | 不是，`body` 里一个，每个 `article`/`section` 内部都可以有 |
| 语义标签能改样式吗 | 能，全部可被 CSS 覆盖；但别破坏无障碍行为（如去掉 focus 样式） |
| `<b>` 和 `<strong>` 区别 | `b` 只是视觉加粗（无语义强调），`strong` 表示重要性（读屏器会加重语气）；同理 `i` vs `em` |
| 怎么做无障碍 | 语义标签 + `alt` + `label` + 键盘可达 + `aria-*` 补语义 + 对比度 + 焦点管理 |

---

## 2.3 行内元素、块级元素、空元素

**这 4 道题是同一道题。** 而且题单的答案里有一个明确的错误：**把 `img` 标成「行内块」**。

### 2.3.1 一句话回答

**「行内 / 块级」是 CSS 的 `display` 默认值，不是 HTML 的规范分类。** HTML 规范分的是**内容模型（content model）**——元素能出现在哪里、能包含什么。这两套体系**有相关性但不是一回事**。

### 2.3.2 先破一个误区：HTML 规范里没有「块级元素」

很多人以为「块级元素 / 行内元素」是 HTML 规范定义的。**不是。**

```
HTML 规范（WHATWG）分类               CSS 规范分类
─────────────────────              ─────────────
metadata content                    display: block
flow content                        display: inline
sectioning content                  display: inline-block
heading content                     display: flex / grid / ...
phrasing content                    display: none / contents
embedded content
interactive content
（+ palpable / script-supporting）
```

**关键结论**：

- `div` 之所以「是块级」，是因为 **UA 样式表**里写了 `div { display: block }`，**不是**因为 HTML 规范叫它块级元素
- 所以 `div { display: inline }` 完全合法，它就变成行内了（虽然很少这么写）
- 反之 `span { display: block }` 也合法

> **面试时的正确说法**：「HTML 规范里的分类是内容模型，行内/块级是 CSS display 的默认值。我们平时说『块级元素』，指的是 UA 样式表给了 `display:block` 的那些元素。」

### 2.3.3 两套分类的对照

**HTML5 内容模型（7 类 + 2 个补充）**：

| 类别 | 定义 | 典型元素 |
|---|---|---|
| **metadata** | 描述文档的元信息，只能放 `head` | `base` `link` `meta` `noscript` `script` `style` `template` `title` |
| **flow** | 能出现在 `body` 里的大部分元素，是「流」 | 几乎所有 body 元素 |
| **sectioning** | 划分文档结构 | `article` `aside` `nav` `section` |
| **heading** | 标题 | `h1`~`h6` `hgroup` |
| **phrasing** | 文本级、能出现在段落内部 | `span` `a` `strong` `em` `code` `img` `input` `button` `label` `br` `q` `cite` `time` |
| **embedded** | 引入外部资源 | `img` `video` `audio` `canvas` `iframe` `embed` `object` `picture` `svg` `math` |
| **interactive** | 用户可交互 | `a[href]` `button` `input` `select` `textarea` `label` `details` `audio[controls]` `video[controls]` `embed` `iframe` `img[usemap]` |

**CSS `display` 默认值分类**：

| 类别 | 默认 `display` | 典型元素 | 特点 |
|---|---|---|---|
| **块级** | `block` | `div` `p` `h1`~`h6` `ul` `ol` `li` `table` `form` `section` `article` `header` `footer` `nav` `aside` `main` `figure` `blockquote` `pre` `dl` `dt` `dd` `hr` | 独占一行；`width/height/margin/padding` 全生效；默认宽度撑满父级 |
| **行内** | `inline` | `span` `a` `strong` `em` `b` `i` `u` `s` `code` `small` `sub` `sup` `label` `cite` `q` `abbr` `mark` `time` `br` `img` `input` `button` `select` `textarea` | 不换行、跟着文字流；`width/height` **无效**；竖直方向 `margin` 无效、`padding` 会溢出但不撑开行高 |
| **行内块** | `inline-block` | **原生元素里几乎没有**（`button` `input` `select` `textarea` 是 inline-block / inline-flex 的近似） | 不换行，但 `width/height/margin/padding` 全生效 |
| **列表项** | `list-item` | `li` | 带标记（`::marker`） |
| **表格系** | `table` / `table-row` / `table-cell` … | `table` `tr` `td` … | 表格布局算法 |
| **无** | `none` | `head` `title` `meta` `link` `script` `style` `template` `datalist` `param` | 不生成盒子 |

### 2.3.4 ★ `img` 到底是什么（题单答错的那个点）

**题单原文**：「行内：`span/a/strong/em/img`（行内块）」。**这个括号是错的。**

**正确答案**：

```
img 的默认 display 是 inline
但它是「行内级 + 可替换元素（replaced element）」
```

**拆开解释**：

| 概念 | 含义 | `img` 的情况 |
|---|---|---|
| **行内级（inline-level）** | 参与行内格式化上下文（IFC），跟着文字排 | ✅ `display: inline` |
| **可替换元素（replaced）** | 元素的内容不由 DOM 决定，而由**外部资源**决定（图片、视频、iframe） | ✅ 内容来自图片文件 |
| **内在尺寸（intrinsic size）** | 可替换元素有「天然宽高」 | ✅ 图片文件本身的宽高 |
| **行内块（inline-block）** | 一个具体的 `display` 值 | ❌ 不是 |

**为什么它「看起来像 inline-block」**：

```css
/* 如果 img 真的是 inline，为什么 width/height 生效？ */
img { width: 100px; height: 100px; }   /* 生效 */
```

因为 CSS 规范对 **replaced element** 有特殊规定：**行内级可替换元素的 `width` / `height` 是生效的**（普通行内元素不生效）。

```
普通行内元素（span）：width/height 无效
行内级可替换元素（img/input/video/canvas）：width/height 生效  ← 规范特例
```

**所以 `img` 是「inline + replaced」，不是 `inline-block`。** 这个差别有实际后果：

| 现象 | 因为它是 inline |
|---|---|
| **图片底部有多余空隙**（经典 bug） | inline 元素按**基线（baseline）** 对齐，图片底边压在基线上，基线下方还有 descender 空间 → 多出 3~5px |
| **多个图片之间有空格** | HTML 里的换行/空格字符在 inline 布局中会产生一个空格宽度 |
| **`vertical-align` 生效** | 只有 inline 级元素才吃 `vertical-align` |

**两个经典修法**：

```css
/* 修底部空隙 */
img { display: block; }              /* 最常用 */
img { vertical-align: middle; }      /* 或者改对齐方式 */
img { vertical-align: bottom; }

/* 修图片之间的空格 */
.container { display: flex; }         /* 或者 font-size: 0 */
.container { font-size: 0; }
```

> **这一段能主动说出来，面试官基本会认为你「真的调过页面」**，而不是背八股。

### 2.3.5 行内 vs 块级的实际差异（不只是「换不换行」）

| 维度 | 块级 `block` | 行内 `inline` |
|---|---|---|
| **是否换行** | 独占一行 | 与文字同流 |
| **`width` / `height`** | 生效 | **无效**（replaced 元素例外） |
| **`margin` 水平** | 生效 | 生效 |
| **`margin` 垂直** | 生效 | **视觉上不生效**（不影响行盒高度） |
| **`padding` 垂直** | 撑开盒子 | **生效但会溢出、不撑开行高**（会盖住相邻行） |
| **`text-align`** | 影响内部行内内容 | 受父级 `text-align` 影响 |
| **`vertical-align`** | **无效** | 生效 |
| **默认宽度** | 撑满父容器 | 由内容决定 |
| **能否包含块级子元素** | 可以 | **规范上不行**（`<p><div></div></p>` 会被浏览器自动拆开） |
| **格式化上下文** | 参与 BFC（视情况） | 参与 IFC |

**「行内元素不能包块级」的实际表现**（很实用的坑）：

```html
<p>段落 <div>块</div> 结束</p>
```

浏览器实际生成：

```html
<p>段落 </p><div>块</div> 结束<p></p>
```

因为 HTML 解析器遇到 `<div>` 会**自动闭合 `<p>`**（`p` 的结束标签可省略，且 `p` 不能包含流内容中的块级元素）。**这会导致样式莫名其妙地断开**。

### 2.3.6 空元素（void elements）

已在 **01 册 1.5** 详述，这里只列清单方便复习：

```
area  base  br  col  embed  hr  img  input  link  meta  source  track  wbr
```

**三个概念别混**：

| 概念 | 定义 |
|---|---|
| **空元素（void）** | 规范要求**不能有子节点**，不能写闭合标签 |
| **空内容元素** | 可以有子节点，只是当前没内容（`<div></div>`） |
| **可替换元素（replaced）** | 内容来自外部资源（`img`/`video`/`iframe`/`input`/`canvas`） |

### 2.3.7 面试怎么答

**30 秒版**

> 先说一个容易搞混的点：行内和块级严格来说不是 HTML 规范的分类，而是 CSS `display` 的默认值。HTML5 规范分的是内容模型，比如 flow content、phrasing content、embedded content。我们平时说块级元素，指的是 UA 样式表给了 `display: block` 的那些。常用于块级的有 `div`、`p`、`h1~h6`、`ul`、`table`、`section` 这些；行内的是 `span`、`a`、`strong`、`em`、`code`、`label` 这些。空元素一共 14 个，常用的有 `br`、`hr`、`img`、`input`、`link`、`meta`。

**2 分钟版**

> 我分「分类标准」「具体清单」「一个常见错误」三点讲。
>
> **第一，分类标准**。这里有个普遍误解：行内和块级不是 HTML 规范的概念，而是 CSS `display` 的默认值。HTML5 规范分的是内容模型——metadata、flow、sectioning、heading、phrasing、embedded、interactive 七类，它管的是「这个元素能出现在哪、能包含什么」。`div` 之所以是块级，是因为浏览器默认样式表里写了 `div { display: block }`，你可以用 CSS 把它改成 inline，完全合法。
>
> **第二，具体清单**。块级常用的：`div p h1~h6 ul ol li dl table form section article header footer nav aside main figure blockquote pre hr`。行内常用的：`span a strong em b i u s code small sub sup label cite q abbr mark time`。空元素 14 个：`area base br col embed hr img input link meta source track wbr`。
>
> **第三，一个常见错误**。很多资料把 `img` 说成「行内块元素」，这是错的。`img` 的默认 `display` 是 `inline`，它是**行内级的可替换元素**。它看起来像 inline-block，是因为 CSS 规范对可替换元素有特例——行内级可替换元素的 `width`/`height` 是生效的，而普通行内元素不生效。这个区别有实际后果：因为它是 inline，所以按基线对齐，底部会多出 3~5px 空隙，修法是 `display: block` 或者 `vertical-align: middle`；也因为它是 inline，多个图片之间的 HTML 换行会产生一个空格宽度，修法是用 flex 或者 `font-size: 0`。

**追问表**

| 追问 | 回答要点 |
|---|---|
| `img` 是行内块吗 | **不是**，是 `display: inline` + 可替换元素（replaced） |
| 为什么 `img` 的 width 生效 | CSS 规范特例：行内级可替换元素的宽高生效 |
| 图片底部为什么有空隙 | inline 按基线对齐，基线下方有 descender 空间 |
| 多个图片之间有空格怎么办 | 父级 `display: flex` 或 `font-size: 0` |
| 行内元素能包块级吗 | 规范上不行；`<p><div>` 会被解析器自动拆开 |
| `inline-block` 和 `inline` 区别 | inline-block 的 `width/height/margin/padding` 全生效，inline 的宽高无效 |
| 空元素有哪些 | 14 个：`area base br col embed hr img input link meta source track wbr` |
| 哪些是可替换元素 | `img video audio iframe embed object canvas input select textarea` |
| `display: none` 和 `visibility: hidden` | 前者不生成盒子（不占位、不参与渲染）；后者生成盒子但不绘制（占位） |
| 怎么让行内元素支持宽高 | `display: inline-block` / `block` / `flex`，或者用 `float`（不推荐） |

---

## 2.4 SEO：前端能做什么

### 2.4.1 一句话回答

**SEO 是让搜索引擎「抓得到、读得懂、愿意排」**。前端能控制的是「抓得到」和「读得懂」这两层——**「愿意排」主要靠内容和外链，前端只能通过性能和体验间接影响**。

**这句话是这道题的分水岭**：大多数人只会背「语义化、meta、SSR」，但说不出「前端的能力边界在哪」。

### 2.4.2 搜索引擎的三段流水线

```
① 抓取 Crawl            ② 索引 Index              ③ 排序 Rank
─────────────────       ─────────────────         ──────────────────
URL 发现                 解析 HTML                内容相关性
├─ 外链                  执行 JS（如果有）         外链权重（PageRank）
├─ sitemap.xml           提取正文/标题/链接        用户体验信号
├─ 内链                  去重（canonical）         （CWV、点击率）
└─ 手动提交              建倒排索引               时效性、地域
   ↓                        ↓                        ↓
robots.txt 允许吗？      能被理解吗？              值得排前面吗？
meta robots 允许吗？
返回 200 吗？
```

**前端能影响的**：① 的可抓取性、② 的可理解性、③ 的性能信号。
**前端影响不了的**：内容质量、外链、算法权重。

### 2.4.3 前端 SEO 的 8 个动作（按投入产出排序）

| # | 动作 | 具体做法 | 影响哪一层 |
|---|---|---|---|
| **1** | **SSR / SSG / 预渲染** | 让首屏 HTML 里就有内容，不要是空的 `<div id="app">` | ② 索引（**最关键**） |
| **2** | **title 和 meta description** | title 是**最重要的 on-page 因素**；description 不影响排名但影响点击率（CTR） | ② + ③ |
| **3** | **语义化 HTML** | `h1` 唯一、`article` 包正文、`nav` 标导航、`img` 有 `alt` | ② |
| **4** | **结构化数据（JSON-LD）** | schema.org 标记 Article/Product/FAQ/Breadcrumb → 富媒体摘要（rich results） | ③（提升 CTR） |
| **5** | **Core Web Vitals** | LCP < 2.5s、INP < 200ms、CLS < 0.1 | ③（体验信号） |
| **6** | **URL 与技术基建** | 语义化 URL、`canonical` 防重复、`hreflang` 多语言、HTTPS、移动友好 | ① + ② |
| **7** | **robots.txt / sitemap.xml / meta robots** | 别误挡爬虫；提交 sitemap；测试环境加 `noindex` | ① |
| **8** | **内链结构** | 重要页面从首页 3 次点击内可达；面包屑导航 | ① + ③ |

### 2.4.4 ★ SPA 为什么 SEO 差（核心技术点）

```html
<!-- SPA 服务端返回的 HTML，实际长这样 -->
<!DOCTYPE html>
<html>
  <body>
    <div id="app"></div>          <!-- ← 爬虫拿到的是空的 -->
    <script src="/app.js"></script>
  </body>
</html>
```

**问题**：所有内容都要等 JS 下载 → 解析 → 执行 → 请求接口 → 渲染。而爬虫：

| 爬虫 | 对 JS 的处理 | 后果 |
|---|---|---|
| **Google** | 有 WRS（Web Rendering Service），基于常青版 Chrome 真正渲染 JS | 能索引，但有**渲染队列延迟**（可能几天），且**有渲染预算**，超时/报错就放弃 |
| **百度** | 对 JS 渲染支持**较弱**（有部分能力，但远不如 Google） | 国内项目**必须 SSR** |
| **Bing** | 支持但不完全 | 有风险 |
| **社交平台爬虫**（微信/Twitter/Facebook） | **完全不执行 JS** | 分享卡片抓不到 title/图片 |
| **AI 爬虫**（GPTBot 等） | 多数不执行 JS | 内容无法被引用 |

> **一句话**：**「Google 能渲染 JS」不等于「你可以不做 SSR」**。渲染有延迟、有预算、有失败率，而且百度和社交爬虫是硬伤。

### 2.4.5 五种渲染方案对比（高频追问）

| 方案 | 首屏 HTML 有内容 | 首屏速度 | 服务器压力 | SEO | 适用 |
|---|---|---|---|---|---|
| **CSR**（客户端渲染） | ❌ | 慢（等 JS） | 小（静态托管） | **差** | 后台管理、登录后页面 |
| **SSR**（服务端渲染） | ✅ | 快（TTFB 稍慢） | **大**（每次请求渲染） | **好** | 内容型 + 需要实时数据 |
| **SSG**（静态生成） | ✅ | **最快**（CDN 直出） | 极小 | **最好** | 博客、文档、营销页 |
| **ISR**（增量静态再生） | ✅ | 最快 | 小 | 好 | 大量内容页 + 偶尔更新（Next.js） |
| **预渲染**（Prerender） | ✅ | 快 | 无 | 好 | 少量固定路由的 SPA（如官网 5 个页面） |

**选型口诀**：

```
内容会变吗？
├─ 不变（博客、文档、官网）→ SSG / 预渲染
└─ 会变
    ├─ 每个用户不同 / 强实时 → SSR
    └─ 定期更新 → ISR
```

**补充**：`动态渲染（Dynamic Rendering）`——对爬虫返回预渲染 HTML、对用户返回 SPA。**Google 已明确不推荐**（2024 起视为 cloaking 的灰色地带），只在过渡期用。

### 2.4.6 meta 与结构化数据的具体写法

```html
<head>
  <title>前端面试 HTML 高频题详解 | 我的站点</title>   <!-- 50-60 字符，关键词靠前 -->
  <meta name="description" content="...">                <!-- 120-158 字符，影响点击率 -->
  <link rel="canonical" href="https://example.com/html/1"> <!-- 防重复内容 -->
  <meta name="robots" content="index,follow">            <!-- 默认值，测试环境用 noindex -->
</head>
```

```html
<!-- 结构化数据：JSON-LD（Google 推荐格式） -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "前端面试 HTML 高频题详解",
  "datePublished": "2026-10-22",
  "author": { "@type": "Person", "name": "张三" },
  "image": "https://example.com/cover.png"
}
</script>
```

**结构化数据的作用**：让搜索结果出现**富媒体摘要**（星级、FAQ 折叠、面包屑、价格），**提升 CTR**——它不提升排名，但提升点击率，间接影响排名。

**常见 `@type`**：`Article`、`Product`、`FAQPage`、`HowTo`、`BreadcrumbList`、`Organization`、`Person`、`Recipe`、`Event`。

### 2.4.7 「前端为什么需要 SEO」

题单的答案「搜索引擎流量是免费流量」——太浅。完整的答法：

| 角度 | 说明 |
|---|---|
| **流量成本** | 自然搜索是**边际成本趋零**的流量，相比投放广告（CPC）长期 ROI 高得多 |
| **用户意图** | 搜索来的用户**带着明确需求**，转化率通常高于信息流 |
| **长尾效应** | 一篇文章可以持续带来几年流量，广告停了就没了 |
| **品牌信任** | 自然排名靠前被视为「权威」 |
| **但前端不是主角** | 内容质量、外链、站点权重是运营/内容团队的事；**前端负责「不拖后腿」**：能被抓、能读懂、够快 |

> **面试话术**：「SEO 的收益是免费且长尾的流量，但主要决定因素是内容和外链，不是前端。前端的职责是**保证不被技术问题拖后腿**——最常见的就是 SPA 首屏是空 div，爬虫拿不到内容，这时候不管内容多好都白搭。所以我们的做法是内容页走 SSR 或者 SSG，交互页走 CSR。」

### 2.4.8 面试怎么答（前端怎么做 SEO）

**30 秒版**

> 分三层：抓得到、读得懂、愿意排。抓得到靠 robots.txt、sitemap、canonical 和正确的状态码；读得懂靠 SSR 或 SSG 让首屏 HTML 里有内容，加上语义化标签、title、meta description、结构化数据 JSON-LD；愿意排主要靠内容质量和外链，前端能做的是 Core Web Vitals 和移动端体验。最关键的一条是 SPA 默认首屏是个空 div，Google 虽然有渲染服务但有延迟和预算，百度和社交爬虫基本不执行 JS，所以内容页必须 SSR 或预渲染。

**2 分钟版**

> 我把 SEO 拆成搜索引擎的三段流水线来讲：抓取、索引、排序。前端在三段里各有分工。
>
> **抓取阶段**：保证爬虫能进来。robots.txt 别误挡、提交 sitemap.xml、用 canonical 处理重复页面、测试环境加 `noindex`、重要页面别超过三次点击才能到达。
>
> **索引阶段**：这是前端最关键的一段。核心问题是 SPA 默认返回的是 `<div id="app"></div>`，内容全靠 JS 渲染。Google 有 WRS 渲染服务，是基于常青版 Chrome 真渲染的，但有**渲染队列延迟**（可能几天）和**渲染预算**，超时就放弃；**百度对 JS 渲染支持很弱**；微信、Twitter 这类社交爬虫**完全不执行 JS**，所以分享卡片抓不到 title 和图片。所以内容页必须 SSR、SSG 或者预渲染——博客文档用 SSG，最快而且能 CDN 直出；实时数据用 SSR；只有少量固定路由的 SPA 用预渲染。
> 索引阶段还有 on-page 的东西：title 是最重要的，description 不影响排名但影响点击率，然后是语义化标签让爬虫分清正文和导航，图片有 alt，还有结构化数据 JSON-LD 让搜索结果出现富媒体摘要。
>
> **排序阶段**：主要靠内容质量、外链和用户行为，前端能做的是 Core Web Vitals——LCP 小于 2.5 秒、INP 小于 200 毫秒、CLS 小于 0.1，这三个是 Google 明确的排名信号。
>
> 最后一句总结：**前端在 SEO 里的职责不是「把排名做上去」，而是「不拖后腿」**。内容质量是运营的事，前端保证技术上没有硬伤。

**追问表**

| 追问 | 回答要点 |
|---|---|
| SPA 怎么做 SEO | SSR / SSG / 预渲染；动态渲染已不被 Google 推荐 |
| Google 能执行 JS 吗 | 能（WRS，常青版 Chrome），但有渲染延迟和预算，不保证 |
| 百度能执行 JS 吗 | 能力很弱，国内项目建议 SSR |
| SSR 和 SSG 区别 | SSR 每次请求渲染；SSG 构建时生成静态 HTML，CDN 直出最快 |
| title 和 description 哪个重要 | title 影响排名；description 不影响排名但影响点击率 |
| 结构化数据提升排名吗 | 不提升排名，提升 CTR（富媒体摘要） |
| canonical 干什么 | 告诉搜索引擎「多个 URL 里哪个是正版」，解决重复内容 |
| Core Web Vitals 是哪三个 | LCP（最大内容绘制）、INP（交互到下次绘制）、CLS（累积布局偏移） |
| 什么是 cloaking | 对爬虫和用户返回不同内容，属于作弊，会被降权 |
| 预渲染和 SSR 区别 | 预渲染是构建期/抓取期生成静态 HTML（通常用无头浏览器），SSR 是请求时动态渲染 |

---

## 2.5 速记卡

```
语义化
  用「表达含义」的标签代替「表达样式」的标签
  收益排序：① 可访问性（landmark 跳转 / button 可聚焦）
            ② 可维护性  ③ 机器可理解（SEO/阅读模式）  ④ 渐进增强
  ★ 对 SEO 的直接权重很低，它帮「理解」不帮「排序」
  article：单独拿出去还成立（RSS/分享）
  section：有主题的区块，应有标题
  div：纯布局
  main 只能一个；b/i 是视觉，strong/em 是语义
  details/summary 原生手风琴；dialog 原生模态

元素分类（★ 两套体系别混）
  HTML 规范分的是 content model：
    metadata / flow / sectioning / heading / phrasing / embedded / interactive
  「行内/块级」是 CSS display 的默认值，不是 HTML 分类
  块级：div p h1~h6 ul ol li table form section article header footer nav aside main figure blockquote pre hr
  行内：span a strong em b i u s code small sub sup label cite q abbr mark time
  空元素（14）：area base br col embed hr img input link meta source track wbr

★ img 不是 inline-block
  display 默认值是 inline，且是「可替换元素（replaced）」
  CSS 特例：行内级可替换元素的 width/height 生效 → 看起来像 inline-block
  后果① 按基线对齐 → 底部 3~5px 空隙 → display:block / vertical-align:middle
  后果② HTML 换行产生空格宽度 → flex / font-size:0

行内 vs 块级实际差异
  换行 | width/height（inline 无效） | 垂直 margin（inline 无效）
  垂直 padding（inline 会溢出、不撑行高） | vertical-align（只有 inline 有效）
  ★ 行内不能包块级：<p><div> 会被解析器自动拆开

SEO
  三段流水线：抓取 → 索引 → 排序
  前端负责：抓得到 + 读得懂；排序主要靠内容和外链
  ★ SPA 首屏是空 div → 必须 SSR / SSG / 预渲染
  Google 有 WRS 但延迟+预算；百度弱；社交爬虫不执行 JS
  动作：title、description、语义化、JSON-LD、CWV、canonical、sitemap
  CWV：LCP<2.5s、INP<200ms、CLS<0.1
  选型：内容不变→SSG；实时→SSR；定期更新→ISR；少量固定路由→预渲染
```
