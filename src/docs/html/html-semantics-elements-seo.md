# HTML · 02 语义化、元素分类与 SEO

> 覆盖：HTML 语义化、行内/块级/空元素、SEO —— 8 个考点
> 两处先纠正：语义化对 SEO 的直接权重很低；`img` 的默认 `display` 是 `inline`，不是「行内块」

---

## 目录

- [2.1 一句话结论](#21-一句话结论)
- [2.2 HTML 语义化](#22-html-语义化)
- [2.3 行内元素、块级元素、空元素](#23-行内元素块级元素空元素)
- [2.4 SEO：前端能做什么](#24-seo前端能做什么)
- [2.5 速记卡](#25-速记卡)

---

## 2.1 一句话结论

**语义化 = 用「表达含义」的标签替代「表达样式」的标签**，收益是可访问性、可维护性、机器可理解；SEO 属于第三条，且直接权重很低。

**元素分类有两条互不相干的线**：HTML 规范分的是「内容模型（能出现在哪、能包含什么）」，CSS 分的是「`display` 默认值（怎么排）」，两者不能混为一谈。

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

`class="header"` 和 `<header>` 视觉上完全一样（都要写 CSS），差别在机器能不能读懂：读屏器按地标跳转，爬虫区分正文与导航，浏览器阅读模式提取正文。

### 2.2.2 常用语义标签全表

| 标签 | 含义 | 使用要点 |
|---|---|---|
| `<header>` | 页头 / 区块头部 | `body` 级映射为 `banner`；嵌在 `article`/`section` 内时只是该块的头部，不再是地标 |
| `<nav>` | 导航链接组 | 只给主要导航用，不要把页面所有链接都塞进去 |
| `<main>` | 主体内容 | 一个页面只能有一个可见的，且不能嵌在 `article`/`aside`/`header`/`footer`/`nav` 里 |
| `<article>` | 独立、可分发的内容单元 | 判断标准：单独拿出去（RSS、分享）还成立吗？ |
| `<section>` | 有主题的区块 | 应带标题；只是样式容器就用 `div` |
| `<aside>` | 旁支内容 | 侧边栏、相关推荐、广告、作者简介 |
| `<footer>` | 页脚 / 区块尾部 | `body` 级映射为 `contentinfo`；嵌在 `article`/`section` 内时是该块的尾部 |
| `<figure>` / `<figcaption>` | 图 + 图注 | 图片、代码块、图表、引用都可以用 |
| `<time datetime="2026-10-22">` | 时间 | `datetime` 给机器读，标签内文本给人读 |
| `<mark>` | 高亮（搜索命中） | 语义是「因为相关性被标记」，不是「我要黄色背景」 |
| `<details>` / `<summary>` | 原生折叠面板 | 不写 JS 即可展开/收起 |
| `<dialog>` | 原生对话框 | `showModal()` 提供模态语义、焦点限制和 `::backdrop` |
| `<address>` | 联系信息 | 只用于最近的 `article` 或 `body` 的联系方式，不是任意地址 |
| `<hgroup>` | 标题组 | 主标题 + 副标题打包，只有其中的 `h1~h6` 参与标题层级 |
| `<search>` | 搜索区域 | 映射 ARIA `search` 地标，可替代 `<form role="search">` |
| `<picture>` | 响应式图片容器 | 配合 `source` + `media`/`type` |

### 2.2.3 `article` / `section` / `div` 怎么选

```
这块内容「单独拿出去」还有意义吗？
├─ 有（一篇博客、一条评论、一个商品卡）→ <article>
└─ 没有
    ├─ 它有自己的标题、是一个主题区块吗？
    │   ├─ 是 → <section>
    │   └─ 否 → <div>（纯样式容器）
```

**边界**：`article` 能独立分发，`section` 有主题且应带标题，`div` 只负责布局。`section` 只有具备可访问名称（`aria-label` / `aria-labelledby`）时才映射为 `region` 地标；仅有标题时仍是 `generic`。

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

### 2.2.4 语义化的收益（按重要性排序）

1. **可访问性**：读屏器按地标跳转（`main`/`nav`），`<button>` 天然可聚焦、可键盘触发，`<div onclick>` 默认不行。
2. **可维护性**：标签即文档，不必先读 CSS 才能理解结构。
3. **机器可理解**：爬虫区分正文与噪音，Safari 阅读模式靠 `article` 提取正文。
4. **渐进增强**：`details`、`dialog`、原生表单校验不写 JS 就能用。

### 2.2.5 语义化的三个常见误解

| 误解 | 真相 |
|---|---|
| 「语义化就是不用 `div`」 | `div` 是合法的无语义容器，纯布局就该用 `div`；语义化是「在需要表达含义的地方用对标签」 |
| 「用了语义标签 SEO 就会好」 | 语义化对排名的直接权重极低；它帮的是「爬虫理解结构」，排序主要看内容质量、外链、性能与用户体验 |
| 「语义化会影响样式，所以不敢用」 | 所有语义标签的默认样式都能被 CSS 覆盖；别丢掉默认的无障碍行为（例如去掉 `outline` 会破坏键盘可达性） |

### 2.2.6 答题要点

- **定义**：标签表达含义而非样式；`class` 名机器读不懂，地标角色可以。
- **收益**：可访问性 > 可维护性 > 机器可理解。
- **边界**：`article` 独立分发、`section` 有主题且带标题、纯布局用 `div`；`main` 全页唯一。
- **渐进增强**：`details`/`summary`、`dialog`、原生表单校验。

**追问**

| 追问 | 回答要点 |
|---|---|
| 一个页面能有几个 `main` | 只能一个可见的 |
| 一个页面能有几个 `h1` | 可以出现多个；浏览器和辅助技术不实现 section 大纲算法，通常保留一个主 `h1`，其余按层级递进 |
| `header` 只能有一个吗 | 不是；`body` 和每个 `article`/`section` 内都可以有，只有 `body` 级映射为 `banner` |
| `<b>` 和 `<strong>` 区别 | `b` 只是视觉加粗，`strong` 表示重要性；`i`/`em` 同理 |
| 怎么做无障碍 | 语义标签 + `alt` + `label` + 键盘可达 + `aria-*` 补语义 + 对比度 + 焦点管理 |

---

## 2.3 行内元素、块级元素、空元素

**这三类问法指向同一组事实**；其中 `img` 常被误标为「行内块」。

### 2.3.1 一句话回答

**「行内 / 块级」是 CSS 的 `display` 默认值，不是 HTML 的规范分类。** HTML 规范分的是**内容模型（content model）**——元素能出现在哪里、能包含什么。两套体系有相关性，但不是一回事。

### 2.3.2 先破一个误区：HTML 规范里没有「块级元素」

「块级元素 / 行内元素」不是 HTML 规范定义的概念。

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

**准确说法**：HTML 规范的分类是内容模型，行内/块级是 CSS `display` 的默认值；平时说「块级元素」，指的是 UA 样式表给了 `display: block` 的那些元素。

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
| **块级** | `block` | `div` `p` `h1`~`h6` `ul` `ol` `form` `section` `article` `header` `footer` `nav` `aside` `main` `figure` `blockquote` `pre` `dl` `dt` `dd` `hr` | 独占一行；`width/height/margin/padding` 全生效；默认宽度撑满父级 |
| **行内** | `inline` | `span` `a` `strong` `em` `b` `i` `u` `s` `code` `small` `sub` `sup` `label` `cite` `q` `abbr` `mark` `time` `br` `img`（replaced） | 不换行、跟着文字流；`width/height` **无效**（replaced 例外）；竖直方向 `margin` 无效、`padding` 会溢出但不撑开行高 |
| **行内块** | `inline-block` | `button` `input` `select` `textarea` | 不换行，但 `width/height/margin/padding` 全生效 |
| **列表项** | `list-item` | `li` `summary` | 带标记（`::marker`） |
| **表格系** | `table` / `table-row` / `table-cell` … | `table` `tr` `td` … | 表格布局算法 |
| **无** | `none` | `head` `title` `meta` `link` `script` `style` `template` `datalist` | 不生成盒子 |

### 2.3.4 `img` 到底是什么

**常见错误说法**：把 `img` 归到「行内块」。它的默认 `display` 是 `inline`，同时是「行内级 + 可替换元素（replaced element）」。

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
| **图片底部有多余空隙**（经典 bug） | inline 元素按**基线（baseline）** 对齐，图片底边压在基线上，基线下方还有 descender 空间 → 多出几像素（取决于字体和字号） |
| **多个图片之间有空格** | HTML 里的换行/空格字符在 inline 布局中会产生一个空格宽度 |
| **`vertical-align` 生效** | 只有行内级元素受 `vertical-align` 影响（`table-cell` 例外） |

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
| **默认宽度** | 通常撑满父容器 | 由内容决定 |
| **能否包含块级子元素** | 视元素而定（`p`、`h1`~`h6`、`pre`、`hr` 等受限） | 多数只能包含 phrasing content（`a` 是透明内容模型，可包流内容但不能嵌交互内容） |
| **格式化上下文** | 参与 BFC（视情况） | 参与 IFC |

**`<p>` 里写 `<div>` 的实际表现**：

```html
<p>段落 <div>块</div> 结束</p>
```

浏览器实际生成：

```html
<p>段落 </p><div>块</div> 结束<p></p>
```

原因不是「行内不能包块级」，而是 HTML 解析器对 `<p>` 的隐式闭合规则：遇到 `<div>` 会先补 `</p>`（`p` 的结束标签可省略，且 `p` 不能包含块级流内容）。`<span><div>` 不会被解析器拆开，但仍是内容模型错误。

### 2.3.6 空元素（void elements）

见 **01 册 1.5**，这里只列清单：

```
area  base  br  col  embed  hr  img  input  link  meta  source  track  wbr
```

**三个概念别混**：

| 概念 | 定义 |
|---|---|
| **空元素（void）** | 规范要求**不能有子节点**，不能写闭合标签 |
| **空内容元素** | 可以有子节点，只是当前没内容（`<div></div>`） |
| **可替换元素（replaced）** | 内容来自外部资源（`img`/`video`/`iframe`/`input`/`canvas`） |

### 2.3.7 答题要点

- **分类标准**：行内/块级是 CSS `display` 默认值；HTML 规范分的是内容模型（metadata / flow / sectioning / heading / phrasing / embedded / interactive）。
- **清单**：块级、行内、空元素各记 3~5 个代表，完整表见 2.3.3、2.3.6。
- **易错点**：`img` 是 `inline` + replaced，不是 `inline-block`；宽高生效、基线空隙、图片间空格都由这一点推出。

**追问**

| 追问 | 回答要点 |
|---|---|
| `inline-block` 和 `inline` 区别 | inline-block 的 `width/height/margin/padding` 全生效，inline 的宽高无效 |
| 怎么让行内元素支持宽高 | `display: inline-block` / `block` / `flex` |
| `display: none` 和 `visibility: hidden` | 前者不生成盒子（不占位），后者生成盒子但不绘制（占位） |

---

## 2.4 SEO：前端能做什么

### 2.4.1 一句话回答

**SEO 是让搜索引擎「抓得到、读得懂、愿意排」**。前端能控制「抓得到」和「读得懂」——「愿意排」主要靠内容和外链，前端只能通过性能和体验间接影响。

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

### 2.4.3 前端 SEO 的 8 个动作（按优先级排序）

| # | 动作 | 具体做法 | 影响哪一层 |
|---|---|---|---|
| **1** | **SSR / SSG / 预渲染** | 让首屏 HTML 里就有内容，不要是空的 `<div id="app">` | ② 索引（**最关键**） |
| **2** | **title 和 meta description** | title 是 on-page 的首要元素；description 对排名影响很小，主要影响点击率（CTR） | ② + ③ |
| **3** | **语义化 HTML** | 一个主 `h1`、`article` 包正文、`nav` 标导航、`img` 有 `alt` | ② |
| **4** | **结构化数据（JSON-LD）** | schema.org 标记 Article/Product/FAQ/Breadcrumb → 富媒体摘要 | 提升 CTR |
| **5** | **Core Web Vitals** | LCP < 2.5s、INP < 200ms、CLS < 0.1 | ③（体验信号） |
| **6** | **URL 与技术基建** | 语义化 URL、`canonical` 防重复、`hreflang` 多语言、HTTPS、移动友好 | ① + ② |
| **7** | **robots.txt / sitemap.xml / meta robots** | 别误挡爬虫；提交 sitemap；测试环境加 `noindex` | ① |
| **8** | **内链结构** | 重要页面从首页少量点击可达；面包屑导航 | ① + ③ |

### 2.4.4 SPA 为什么 SEO 差

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

**问题**：所有内容都要等 JS 下载 → 解析 → 执行 → 请求接口 → 渲染。**Google 能渲染 JS 不等于可以不 SSR**：渲染有延迟、预算和失败率。

| 爬虫 | 对 JS 的处理 | 后果 |
|---|---|---|
| **Google** | 有 WRS（Web Rendering Service），基于常青版 Chrome 真正渲染 JS | 能索引，但有**渲染队列延迟**和**渲染预算**，超时/报错就放弃 |
| **百度** | 对 JS 渲染支持**较弱** | 国内项目建议 SSR |
| **Bing** | 支持但不完全 | 有风险 |
| **社交平台爬虫**（微信/Twitter/Facebook） | **完全不执行 JS** | 分享卡片抓不到 title/图片 |
| **AI 爬虫**（GPTBot 等） | 多数不执行 JS | 内容无法被引用 |

### 2.4.5 五种渲染方案对比

| 方案 | 首屏 HTML 有内容 | 首屏速度 | 服务器压力 | SEO | 适用 |
|---|---|---|---|---|---|
| **CSR**（客户端渲染） | ❌ | 慢（等 JS） | 小（静态托管） | **差** | 后台管理、登录后页面 |
| **SSR**（服务端渲染） | ✅ | 快（TTFB 稍慢） | **大**（每次请求渲染） | **好** | 内容型 + 需要实时数据 |
| **SSG**（静态生成） | ✅ | **最快**（CDN 直出） | 极小 | **最好** | 博客、文档、营销页 |
| **ISR**（增量静态再生） | ✅ | 最快 | 小 | 好 | 大量内容页 + 偶尔更新（Next.js） |
| **预渲染**（Prerender） | ✅ | 快 | 无 | 好 | 少量固定路由的 SPA（如官网） |

**选型口诀**：

```
内容会变吗？
├─ 不变（博客、文档、官网）→ SSG / 预渲染
└─ 会变
    ├─ 每个用户不同 / 强实时 → SSR
    └─ 定期更新 → ISR
```

**补充**：动态渲染（Dynamic Rendering）——对爬虫返回预渲染 HTML、对用户返回 SPA。Google 不推荐：对爬虫和用户返回不同内容，接近 cloaking 的灰色地带，只适合过渡期。

### 2.4.6 meta 与结构化数据的具体写法

```html
<head>
  <title>前端面试 HTML 高频题详解 | 我的站点</title>   <!-- 关键词靠前，避免被截断 -->
  <meta name="description" content="...">                <!-- 写清价值点，影响点击率 -->
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

**结构化数据的作用**：让搜索结果出现**富媒体摘要**（星级、FAQ 折叠、面包屑、价格），提升 CTR——不直接提升排名。

**常见 `@type`**：`Article`、`Product`、`FAQPage`、`HowTo`、`BreadcrumbList`、`Organization`、`Person`、`Recipe`、`Event`。

### 2.4.7 前端为什么需要 SEO

| 角度 | 说明 |
|---|---|
| **流量成本** | 自然搜索是**边际成本趋零**的流量，相比投放广告（CPC）长期 ROI 高得多 |
| **用户意图** | 搜索来的用户**带着明确需求**，转化率通常高于信息流 |
| **长尾效应** | 一篇文章可以持续带来几年流量，广告停了就没了 |
| **品牌信任** | 自然排名靠前被视为「权威」 |
| **但前端不是主角** | 内容质量、外链、站点权重是运营/内容团队的事；**前端负责「不拖后腿」**：能被抓、能读懂、够快 |

### 2.4.8 答题要点（前端怎么做 SEO）

- **抓取**：robots.txt、sitemap.xml、canonical、正确的状态码、内链深度。
- **索引**：内容页用 SSR / SSG / 预渲染，让首屏 HTML 有内容；title、description、语义化、`alt`、JSON-LD。
- **排序**：内容质量与外链为主，前端能影响的是 Core Web Vitals 与移动体验。
- **边界**：前端负责「抓得到、读得懂」，不负责「排得高」。

**追问**

| 追问 | 回答要点 |
|---|---|
| SSR 和 SSG 区别 | SSR 每次请求渲染；SSG 构建时生成静态 HTML，CDN 直出最快 |
| 预渲染和 SSR 区别 | 预渲染在构建期/抓取期用无头浏览器生成静态 HTML；SSR 在请求时动态渲染 |
| canonical 干什么 | 告诉搜索引擎多个 URL 里哪个是正版，解决重复内容 |
| Core Web Vitals 是哪三个 | LCP（最大内容绘制）、INP（交互到下次绘制）、CLS（累积布局偏移） |
| 什么是 cloaking | 对爬虫和用户返回不同内容，属于作弊，会被降权 |

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
  块级：div p h1~h6 ul ol form section article header footer nav aside main figure blockquote pre hr
  行内：span a strong em b i u s code small sub sup label cite q abbr mark time img
  行内块：button input select textarea
  空元素（13）：area base br col embed hr img input link meta source track wbr

★ img 不是 inline-block
  display 默认值是 inline，且是「可替换元素（replaced）」
  CSS 特例：行内级可替换元素的 width/height 生效 → 看起来像 inline-block
  后果① 按基线对齐 → 底部空隙 → display:block / vertical-align:middle
  后果② HTML 换行产生空格宽度 → flex / font-size:0

行内 vs 块级实际差异
  换行 | width/height（inline 无效） | 垂直 margin（inline 无效）
  垂直 padding（inline 会溢出、不撑行高） | vertical-align（只有 inline 有效）
  ★ 内容模型：inline 只能包 phrasing content；<p> 遇到 <div> 会被解析器自动闭合

SEO
  三段流水线：抓取 → 索引 → 排序
  前端负责：抓得到 + 读得懂；排序主要靠内容和外链
  ★ SPA 首屏是空 div → 必须 SSR / SSG / 预渲染
  Google 有 WRS 但延迟+预算；百度弱；社交爬虫不执行 JS
  动作：title、description、语义化、JSON-LD、CWV、canonical、sitemap
  CWV：LCP<2.5s、INP<200ms、CLS<0.1
  选型：内容不变→SSG；实时→SSR；定期更新→ISR；少量固定路由→预渲染
```
