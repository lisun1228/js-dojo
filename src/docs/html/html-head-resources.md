# HTML · 04 文档头部与资源引用

> 覆盖：meta、viewport、link 与 `@import`、img 的 `alt`/`title`/`loading`、favicon、PDF 展示、`src` vs `href`、MIME

---

## 目录

- [4.1 一句话结论](#41-一句话结论)
- [4.2 meta 标签](#42-meta-标签)
- [4.3 viewport](#43-viewport)
- [4.4 link 标签与 `@import`](#44-link-标签与-import)
- [4.5 img 的 `alt` 与 `title`](#45-img-的-alt-与-title)
- [4.6 img 的 `loading` 属性](#46-img-的-loading-属性)
- [4.7 favicon](#47-favicon)
- [4.8 页面上展示 PDF](#48-页面上展示-pdf)
- [4.9 `src` 与 `href` 的区别](#49-src-与-href-的区别)
- [4.10 MIME 类型](#410-mime-类型)
- [4.11 速记卡](#411-速记卡)

---

## 4.1 一句话结论

`<head>` 里的东西分两类：**告诉浏览器怎么处理这个文档**（meta / charset / viewport）和**告诉浏览器去拿哪些外部资源、以什么优先级拿**（link / script / preload）。`src` 与 `href` 的区别是：**这个资源是替换当前内容，还是被当前内容引用**。

---

## 4.2 meta 标签

### 4.2.1 一句话回答

`meta` 是空元素，用来声明**无法用其它 HTML 元素表达的文档级元信息**，有四种用法：`charset`（编码）、`name` + `content`（命名元信息）、`http-equiv` + `content`（模拟 HTTP 响应头）、`property` + `content`（Open Graph，非标准但事实标准）。

### 4.2.2 四类用法

```html
<head>
  <!-- ① charset：必须出现在文档前 1024 字节内 -->
  <meta charset="UTF-8">

  <!-- ② name + content：命名元信息 -->
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="页面描述，影响搜索点击率">
  <meta name="robots" content="index,follow">
  <meta name="theme-color" content="#ffffff">
  <meta name="color-scheme" content="light dark">
  <meta name="format-detection" content="telephone=no">

  <!-- ③ http-equiv：等价于 HTTP 响应头 -->
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta http-equiv="refresh" content="5;url=https://example.com">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'">

  <!-- ④ property（Open Graph）：社交分享卡片 -->
  <meta property="og:title" content="标题">
  <meta property="og:image" content="https://example.com/cover.png">
  <meta property="og:type" content="article">
  <meta name="twitter:card" content="summary_large_image">
</head>
```

### 4.2.3 逐个说明（按重要性）

| 属性 | 作用 | 关键细节 |
|---|---|---|
| **`charset`** | 声明字符编码 | **必须出现在文档前 1024 字节内**；太靠后浏览器会先按默认编码解析一段再重解析整个文档。**HTTP 头的 charset 优先级高于 meta** |
| **`viewport`** | 移动端视口 | 见 4.3 |
| **`description`** | 搜索结果摘要 | **不影响排名**，直接影响点击率；控制在摘要长度内，超出会被截断 |
| **`robots`** | 单页抓取/索引控制 | `index`/`noindex`、`follow`/`nofollow`、`noarchive`、`nosnippet`、`max-snippet:n`；测试环境必须 `noindex` |
| **`theme-color`** | 移动端地址栏/状态栏颜色 | 支持 `media` 属性做深浅色适配 |
| **`color-scheme`** | 声明页面支持深色模式 | 让表单控件、滚动条跟随系统深浅色 |
| **`format-detection`** | 是否自动识别电话号码 | iOS Safari 会把数字串识别成电话链接，`telephone=no` 可关 |
| **`referrer`** | 控制 Referer 头发送策略 | 等价于 `Referrer-Policy` 头 |
| **`keywords`** | **已无作用** | Google 早已明确不使用，百度也基本不用 |
| **`X-UA-Compatible`** | 让老 IE 用最新内核 | IE 退役后没有意义，只留在老项目里 |
| **`refresh`** | 定时刷新/跳转 | 影响后退按钮和可访问性，用 JS 或 301 代替 |

### 4.2.4 三个高频坑

| 坑 | 现象 | 原因 |
|---|---|---|
| **中文乱码** | 页面变成「锟斤拷」 | `charset` 与实际编码不符，或**服务器响应头声明了另一种编码**（HTTP 头优先） |
| **移动端页面很「小」** | 手机上像桌面版缩略图 | 漏了 viewport meta，浏览器用默认 980px 布局视口 |
| **`noindex` 上了生产** | 网站从搜索结果里消失 | 测试环境的 meta 忘记删 |

---

## 4.3 viewport

### 4.3.1 一句话回答

`<meta name="viewport">` 用来**控制移动端「布局视口（layout viewport）」的宽度和缩放**。不写它，手机浏览器用默认的 **980px** 布局视口，再把整个页面缩小塞进屏幕——字号同比变小。

### 4.3.2 三个视口

```
① 布局视口 layout viewport  → CSS 里的 100vw / 百分比按它算（默认 980px）
② 视觉视口 visual viewport  → 用户当前能看到的区域（随缩放变化）
③ 理想视口 ideal viewport   → 设备宽度（width=device-width 就是设成这个）
```

| 不写 viewport | 写 `width=device-width, initial-scale=1` |
|---|---|
| 布局视口 = 980px | 布局视口 = 设备 CSS 宽度（如 390px） |
| `width:100%` 的元素 = 980px 宽 | = 390px 宽 |
| 以 390px 设备为例，整页缩小约 2.5 倍显示 | 1:1 显示，字号正常 |

### 4.3.3 各参数的准确含义

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

| 参数 | 含义 | 建议 |
|---|---|---|
| `width` | 布局视口宽度，可以是具体像素或 `device-width` | **写 `device-width`** |
| `height` | 布局视口高度 | 基本不用（横屏会出问题） |
| `initial-scale` | 初始缩放比例（相对理想视口） | **写 `1`**，与 `width` 成对出现更稳 |
| `minimum-scale` / `maximum-scale` | 允许的最小/最大缩放 | **不建议限制**（无障碍问题） |
| `user-scalable=no` | 禁止用户缩放 | **不建议**：WCAG 1.4.4 要求可放大到 200%；iOS Safari 出于无障碍已忽略该值 |
| `viewport-fit` | 内容是否覆盖「安全区域」（刘海/圆角） | `cover` 用于全面屏，配合 `env(safe-area-inset-*)` |
| `interactive-widget` | 软键盘弹出时的视口行为 | `resizes-content`（内容压缩）/ `overlays-content`（覆盖） |

### 4.3.4 `viewport-fit=cover` 与安全区

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

```css
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);   /* 底部 Home Indicator */
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```

不写 `viewport-fit=cover` 时，浏览器会自动给内容加内边距避开刘海，背景色不会延伸进安全区；「全屏背景 + 内容避开刘海」需要 `cover` + `env()`。

### 4.3.5 为什么会有「1px 边框变粗」

| 概念 | 说明 |
|---|---|
| **物理像素** | 屏幕真实像素点（iPhone 14: 1170×2532） |
| **CSS 像素** | 逻辑像素（iPhone 14: 390×844） |
| **DPR** | 设备像素比 = 物理 / CSS（iPhone 14 = 3） |

`border: 1px` 在 DPR=3 的屏幕上占 **3 个物理像素**，看起来比设计稿粗。解法：伪元素 + `transform: scaleY()`、`0.5px`（部分设备支持）、`box-shadow` 模拟。

### 4.3.6 面试口述要点

- 不要限制缩放：`user-scalable=no`、`maximum-scale=1` 违反 WCAG 1.4.4（需可放大到 200%），iOS Safari 也已忽略。
- 全面屏用 `viewport-fit=cover` + `env(safe-area-inset-*)`；软键盘用 `interactive-widget=resizes-content`、`scrollIntoView` 或 `visualViewport` API。
- 移动端适配：`vw` 直接写、`rem` + `html{font-size:vw}`、`postcss-px-to-viewport`。

---

## 4.4 link 标签与 `@import`

### 4.4.1 一句话回答

`link` 是**空元素**，用来声明「本文档与外部资源的关系」，核心属性是 `rel`（关系类型）+ `href`（地址）。`@import` 是 **CSS 语法**，只能引入 CSS，必须写在样式表最前面，且**串行加载**——线上应优先用 `link`。

### 4.4.2 `rel` 的取值

| `rel` 值 | 作用 | 配套属性 |
|---|---|---|
| **`stylesheet`** | 引入 CSS，阻塞渲染、不阻塞解析 | `media`、`disabled` |
| **`icon`** | favicon（见 4.7） | `sizes`、`type` |
| **`apple-touch-icon`** | iOS 添加到主屏的图标，不写会用页面截图 | `sizes="180x180"` |
| **`manifest`** | PWA 清单 | — |
| **`canonical`** | 声明规范 URL，解决重复内容 | — |
| **`alternate`** | 替代版本（RSS / 多语言 / AMP） | `hreflang`、`type` |
| **`preload`** | 当前页面马上要用的资源，高优先级 | **`as`（必填）**、`crossorigin`、`type` |
| **`prefetch`** | 下一个页面可能要用，空闲时下载进 HTTP 缓存 | `as` |
| **`preconnect`** | 提前完成 DNS + TCP + TLS | `crossorigin` |
| **`dns-prefetch`** | 只做 DNS 解析 | — |
| **`modulepreload`** | 预加载 ES module 及其依赖，比 `preload` 更懂 module 图 | — |
| **`prerender`** | 预渲染下个页面，资源消耗大 | — |
| **`author` / `license` / `me` / `next` / `prev`** | 元信息；`next`/`prev` 用于分页 SEO | — |

### 4.4.3 `preload` 与三个资源提示指令

```html
<!-- ❌ 缺 as：preload 直接作废 -->
<link rel="preload" href="/font.woff2">

<!-- ✅ as 决定请求语义 -->
<link rel="preload" href="/font.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/hero.avif" as="image" fetchpriority="high">
<link rel="preload" href="/app.js" as="script">
<link rel="preload" href="/api/user" as="fetch" crossorigin>
```

| 指令 | 做什么 | 优先级 | 用在哪 |
|---|---|---|---|
| `preload` | 下载当前页资源 | **最高** | 首屏关键资源（字体、LCP 图、关键 JS） |
| `preconnect` | DNS + TCP + TLS | 高 | **确定会用的**第三方域（CDN、API） |
| `dns-prefetch` | 只解析 DNS | 低 | `preconnect` 的兼容性兜底、大量第三方域 |
| `prefetch` | 空闲时下载整个资源到 HTTP 缓存 | **最低** | 下一个页面 |

优先级从高到低：`preload` > `preconnect` > `dns-prefetch` > `prefetch`。

- **`as` 必填**：它决定请求的 `Accept` 头、资源优先级、与真实请求的缓存匹配。缺失或非法时 preload 作废（实测：只发一次请求，控制台报 `must have a valid as value`）；`as` 与实际用途不一致时才会「preload 一次 + 真正使用时再一次」，并提示 preloaded but not used。
- **字体必须 `crossorigin`**：字体请求是 CORS 请求，preload 不带 `crossorigin` 时凭证模式与实际请求对不上，preload 不会被复用 → 重复下载。
- **没用到的 `preload` 是负优化**：占带宽、抢其它资源优先级，Chrome 会在控制台警告。

### 4.4.4 `link` vs `@import`

| 维度 | `<link rel="stylesheet">` | `@import` |
|---|---|---|
| **归属** | HTML 标签 | CSS at-rule |
| **发现方式** | 与 HTML 解析**并行** | 必须等父 CSS 下载并解析完才能发现 → **串行** |
| **阻塞行为** | 阻塞**渲染**，不阻塞解析 | 同样阻塞渲染，但**多一次串行往返** |
| **位置要求** | `head` 内任意位置 | **必须在样式表最前**（`@charset` 之后），否则整条规则被忽略 |
| **DOM 可操作** | 可以 JS 动态增删 | 不能 |
| **预加载扫描器** | 能提前发现 | 看不到 CSS 内部的 `@import` |
| **媒体查询** | `media` 属性 | `@import url() screen and (max-width:600px)` |
| **层叠权重** | 都是作者样式，权重相同，后写的赢 | 同 |

**结论**：`@import` 唯一合理的场景是源码层面的 CSS 模块化（`index.css` 里 `@import` 一堆 partial），现代构建工具会在编译期合并成一个文件；运行时用 `@import` 引线上 CSS 是性能反模式。

实测：父 CSS 延迟 250ms 时，子 CSS 请求也在约 250ms 后才发出（串行）；写在其它规则之后的 `@import` 不发请求，整条规则被忽略。

---

## 4.5 img 的 `alt` 与 `title`

### 4.5.1 一句话回答

| 属性 | 什么时候出现 | 谁在用 | 作用 |
|---|---|---|---|
| **`alt`** | 图片加载失败、读屏器朗读、爬虫理解图片内容 | 所有人（尤其无障碍用户） | **替代文本** |
| **`title`** | 鼠标悬停 | 鼠标用户 | **补充提示** |

`title` 不能替代 `alt`：触摸设备没有 hover，键盘用户也看不到，读屏器对 `title` 的支持不稳定。

### 4.5.2 `alt` 的四种正确写法

`alt` 怎么写取决于图片的「角色」：

| 图片角色 | `alt` 怎么写 | 例子 |
|---|---|---|
| **① 有信息量的内容图** | 简明描述图片传达的信息 | `<img src="chart.png" alt="2026 年 Q3 营收同比增长 23%">` |
| **② 纯装饰图**（分隔线、背景纹理） | `alt=""`（空字符串，但不能省略） | `<img src="divider.png" alt="">` |
| **③ 图片是链接/按钮的唯一内容** | 描述点击后的目的地/动作，不是描述图片 | `<a href="/cart"><img src="cart.png" alt="购物车"></a>` |
| **④ 复杂图**（图表、流程图） | 一句话概括 + `aria-describedby` / `figcaption` 给长描述 | 见下 |

**② 最容易错**：

```html
<!-- ❌ 省略 alt：读屏器会念「图片」或文件名 -->
<img src="divider.png">

<!-- ❌ 写废话：读屏器念「分隔线图片 分隔线」 -->
<img src="divider.png" alt="分隔线图片">

<!-- ✅ 装饰图：alt="" → 读屏器直接跳过 -->
<img src="divider.png" alt="">
```

`<img>` **必须有 `alt` 属性**（哪怕值是空的）。**省略 `alt` 和 `alt=""` 完全不同**，前者会让读屏器退化成念文件名。

**④ 复杂图**：

```html
<figure>
  <img src="flow.png" alt="用户登录流程：输入手机号 → 获取验证码 → 校验 → 进入首页"
       aria-describedby="flow-detail">
  <figcaption id="flow-detail">详细说明：第一步……（长文本）</figcaption>
</figure>
```

图片旁已有完整文字说明时，`alt` 可以留空避免重复朗读。

### 4.5.3 `alt` 与 SEO

| 事实 | 说明 |
|---|---|
| `alt` 是**图片搜索**的重要信号 | Google 图片搜索靠 `alt` + 周边文本 + 文件名理解图片 |
| 对**网页搜索**排名影响很小 | 别指望靠 alt 堆关键词提升排名 |
| **堆关键词是负面** | 会被判定为作弊，也破坏无障碍 |

### 4.5.4 `title` 的真实定位

```html
<img src="logo.png" alt="公司 Logo" title="成立于 2010 年">
```

| 特性 | 说明 |
|---|---|
| 显示方式 | 鼠标悬停约 1 秒后出现系统 tooltip |
| 样式 | **完全不可控**（系统原生） |
| 触摸设备 | **完全不显示**（没有 hover） |
| 键盘用户 | 不显示 |
| 读屏器 | 支持不一致（有的读成描述，有的不读） |
| 移动端长按 | 部分浏览器会显示 |

`title` 只能作为锦上添花的补充信息，**任何关键信息都不能只放在 `title` 里**；需要 tooltip 就用组件自己实现（可控、可访问、移动端可用）。

### 4.5.5 `title` 的其它用途

| 元素 | `title` 的作用 |
|---|---|
| `<a title="">` | 补充说明链接目的地 |
| `<abbr title="HyperText Markup Language">` | **缩写全称，`title` 最正当的用途** |
| `<iframe title="">` | **无障碍要求**：读屏器用它说明框架是什么 |
| `<input title="">` | 补充说明（**不能替代 label**） |

`<abbr title>` 和 `<iframe title>` 是两个「必须写」的场景。

---

## 4.6 img 的 `loading` 属性

### 4.6.1 一句话回答

`loading="lazy"` 是**浏览器原生懒加载**：图片进入「接近视口」的范围才开始下载，不需要 JS。三个值：`lazy`、`eager`（默认）、`auto`（交给浏览器）。

```html
<img src="a.jpg" loading="lazy" alt="...">
```

### 4.6.2 首屏图不能用 lazy

```html
<!-- ❌ LCP 图加 lazy，LCP 会被推迟 -->
<img src="hero.avif" loading="lazy" alt="首屏大图">

<!-- ✅ 首屏主图：eager + 高优先级 + 固定宽高 -->
<img src="hero.avif" loading="eager" fetchpriority="high" width="1200" height="600" alt="首屏大图">
```

**原因**：`lazy` 的图片要等布局完成、浏览器算出它的位置才开始加载，而 LCP 图恰恰是首屏最大的那张——加 `lazy` 等于人为延后 LCP 的起点。

| 图片位置 | 建议 |
|---|---|
| 首屏（above the fold） | `loading="eager"` + `fetchpriority="high"` |
| 首屏以下 | `loading="lazy"` |
| 不确定 | 不写（默认 `eager`），或只在明确靠下的位置写 `lazy` |

### 4.6.3 原生 lazy 的加载距离

浏览器不等图片进入视口才加载，而是**提前一段距离**开始下载。这段距离由浏览器按网络状况决定，**网越慢提前越多**。

实测：视口 600px 时，距视口约 900px 的图片会立即请求，距视口约 5400px 的图片不请求，滚动到附近才请求。所以原生 lazy 对首屏以下的图片收益有限，但对长列表/长文章仍然有效。

### 4.6.4 原生 lazy vs 手写 IntersectionObserver

| 维度 | `loading="lazy"` | `IntersectionObserver` |
|---|---|---|
| 代码量 | 0 | 需要写 observer + 占位 |
| 阈值控制 | ❌ 浏览器决定 | ✅ 完全可控（`rootMargin`） |
| 占位/骨架屏 | ❌ 不会自动加 | ✅ 可以自定义 |
| 加载失败重试 | ❌ 无 | ✅ 可以自己实现 |
| 支持范围 | 只对 `<img>` / `<iframe>`（`background-image` 不支持） | 任意元素、任意资源 |
| 渐进增强 | ✅ 不支持的浏览器直接正常加载 | 需要 polyfill |
| 适用 | **常规图片列表** | **需要精细控制的场景**（无限滚动、虚拟列表） |

需要自定义阈值、骨架屏或重试时才上手写，其余情况优先用原生 `loading="lazy"`。

### 4.6.5 其它容易一起被问的图片属性

| 属性 | 作用 | 为什么重要 |
|---|---|---|
| **`width` / `height`** | 声明固有宽高 | **防止 CLS**：不写会在图片加载后把下方内容顶下去 |
| **`decoding="async"`** | 异步解码，不阻塞主线程渲染 | 大图解码会卡帧；`sync` 强制同步解码 |
| **`fetchpriority="high"`** | 提升该图片的请求优先级 | 专门给 **LCP 图**用 |
| **`srcset` / `sizes`** | 响应式图片，按 DPR/视口选图 | `w` 描述符配 `sizes`（按布局宽度选）；`x` 按 DPR 选 |
| **`<picture>` + `<source type="image/avif">`** | 按格式降级 | AVIF → WebP → JPEG |
| **`referrerpolicy`** | 控制 Referer | 外链图片防盗链场景 |

```html
<!-- 一个「各方面都正确」的首屏图片 -->
<picture>
  <source type="image/avif" srcset="hero-800.avif 800w, hero-1600.avif 1600w" sizes="100vw">
  <source type="image/webp" srcset="hero-800.webp 800w, hero-1600.webp 1600w" sizes="100vw">
  <img src="hero-800.jpg"
       alt="产品截图"
       width="1600" height="800"
       loading="eager"
       fetchpriority="high"
       decoding="async">
</picture>
```

写了 `width/height` 就建立了宽高比，CSS 里 `width:100%; height:auto` 即可自适应且不产生 CLS。

---

## 4.7 favicon

### 4.7.1 一句话回答

标签页上的小图标叫 **favicon**（favorite icon），通过 `<link rel="icon">` 声明；不声明时浏览器会去请求根目录的 `/favicon.ico`。

### 4.7.2 标准写法

```html
<!-- 现代浏览器：SVG 优先（矢量、可跟随深浅色） -->
<link rel="icon" href="/icon.svg" type="image/svg+xml">

<!-- 兜底：ico（可包含多尺寸） -->
<link rel="icon" href="/favicon.ico" sizes="32x32">

<!-- iOS 添加到主屏 -->
<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">

<!-- Android / PWA（通过 manifest） -->
<link rel="manifest" href="/manifest.webmanifest">
```

### 4.7.3 各平台要求

| 平台 | 文件 | 尺寸 | 注意 |
|---|---|---|---|
| 桌面浏览器标签页 | `.ico` / `.png` / `.svg` | 16×16、32×32 | `.ico` 一个文件可装多尺寸 |
| iOS 主屏 | `apple-touch-icon.png` | **180×180** | **不要圆角**（系统自动加）、**不要透明**（会变黑底） |
| Android 主屏 / PWA | `manifest.json` 的 `icons` | 192×192、512×512 | 需要 `purpose: "any maskable"` |
| Windows 磁贴 | `browserconfig.xml` | 150×150 | 基本没人用了 |

### 4.7.4 三个坑

| 坑 | 现象 | 原因/解法 |
|---|---|---|
| **改了 favicon 没生效** | 用户还看到旧图标 | favicon 缓存极顽固（浏览器、CDN、桌面快捷方式都缓存）。改文件名加 hash 或加 query（`favicon.ico?v=2`） |
| **SVG 图标在标签页不显示** | 一片空白 | 部分浏览器要求 SVG 有明确的 `viewBox`；SVG 里的外部引用（字体、图片）不生效 |
| **自动请求 `/favicon.ico` 返回 404** | 控制台一直报 404 | 浏览器默认会请求根路径的 `favicon.ico`。放一个文件，或显式声明 `<link rel="icon" href="data:,">` 关掉 |

---

## 4.8 页面上展示 PDF

### 4.8.1 四种方案对比

| 方案 | 实现 | 优点 | 缺点 |
|---|---|---|---|
| **`<iframe>`** | `<iframe src="a.pdf">` | 一行代码；用浏览器内置阅读器 | **完全依赖浏览器**：移动端内置阅读器行为不一致（iOS 体验差、部分 Android 直接下载）、无法自定义 UI、跨域有安全限制 |
| **`<embed>` / `<object>`** | `<embed type="application/pdf" src="a.pdf">` | 语义上更「嵌入」 | 同样依赖内置阅读器；`embed` 是空元素、无 fallback；`object` 可写 fallback 但仍受限 |
| **PDF.js**（Mozilla） | JS 解析 PDF，用 Canvas 渲染 | **完全可控**：UI、翻页、搜索、缩放、批注、跨端一致 | 体积大（可分包）、复杂 PDF 渲染性能一般 |
| **服务端转图片 / HTML** | 后端把 PDF 转成图片或 HTML | 移动端体验最好、加载快 | 需要服务端能力；转图片会失去文本选择和搜索 |

### 4.8.2 各方案代码

```html
<!-- ① iframe（最省事） -->
<iframe src="/doc.pdf" title="产品说明书" width="100%" height="800"></iframe>

<!-- ② object（带 fallback） -->
<object data="/doc.pdf" type="application/pdf" width="100%" height="800">
  <p>你的浏览器不支持内嵌 PDF，<a href="/doc.pdf">点击下载</a></p>
</object>

<!-- ③ PDF.js -->
<canvas id="pdf-canvas"></canvas>
<script type="module">
import * as pdfjsLib from '/pdfjs/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdfjs/build/pdf.worker.mjs';
const pdf = await pdfjsLib.getDocument('/doc.pdf').promise;
const page = await pdf.getPage(1);
const viewport = page.getViewport({ scale: 1.5 });
const canvas = document.getElementById('pdf-canvas');

canvas.width = viewport.width;
canvas.height = viewport.height;
await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
</script>
```

### 4.8.3 选型决策

```
PDF 需要「自定义 UI / 表单填写 / 批注 / 精准跳页」吗？
├─ 需要 → PDF.js（或者商业 SDK）
└─ 不需要
    ├─ 主要用户是桌面端 → iframe 就够
    └─ 主要用户是移动端 → 服务端转图片（体验最好）
```

### 4.8.4 两个安全/体验细节

| 细节 | 说明 |
|---|---|
| **PDF 可以内含 JS** | PDF 支持 JavaScript（表单计算、自动动作），部分阅读器会执行。**用户上传的 PDF 不要用 `iframe` 直接内嵌在你的域下**，改用独立域 + `sandbox`，或转成图片 |
| **跨域 iframe 读不到内容** | 同源策略下 `iframe.contentDocument` 对跨域 PDF 是 `null`，「检测 PDF 是否加载成功」做不到，只能用超时兜底 |

---

## 4.9 `src` 与 `href` 的区别

### 4.9.1 一句话回答

| | `src`（source） | `href`（hypertext reference） |
|---|---|---|
| **语义** | **替换**当前元素的内容 | **引用**外部资源 / 建立超链接 |
| **用于** | `script` `img` `iframe` `video` `audio` `source` `embed` `input` | `a` `link` `area` `base` |
| **浏览器行为** | 下载并嵌入到文档中（成为文档的一部分） | 建立关联，**并行加载**，不替代当前内容 |
| **类比** | 「把这张图**贴**在这里」 | 「这里**指向**那个地址」 |

### 4.9.2 「src 加载完才继续」只对 script 成立

`src` 的「替换内容 + 需要下载」只决定资源如何嵌入，不代表 HTML 解析被阻塞；**阻塞与否取决于元素**。

| 元素 | 阻塞 HTML 解析？ | 阻塞渲染？ | 阻塞 `load` 事件？ |
|---|---|---|---|
| **`<script src>`**（不带 defer/async） | **✅ 阻塞** | ✅ | ✅ |
| **`<link rel="stylesheet">`** | ❌ 不阻塞解析 | **✅ 阻塞渲染** | ✅ |
| **`<img src>`** | ❌ **不阻塞** | ❌ 不阻塞（但占位区域） | ✅ |
| **`<iframe src>`** | ❌ **不阻塞父文档** | ❌ | ✅ |
| **`<video>` / `<audio>`** | ❌ | ❌ | 部分（`preload` 策略决定） |

**为什么 `script` 会阻塞、`img` 不会**：

```
< script > 会阻塞，因为：
  ① 脚本可能 document.write() 往字符流里插内容 → 解析器必须停下等它
  ② 脚本可能查询/修改 DOM → 必须保证前面的 DOM 已经解析完
  ③ 脚本可能读取样式 → 有未加载的 CSS 时脚本要等 CSSOM（CSS 阻塞 JS）

< img > 不阻塞，因为：
  图片的尺寸/内容不影响后续 HTML 的解析
  浏览器只要留出位置，继续往下解析就行
```

**实践结论**：`<img>` 在解析阶段就被预加载扫描器发现并开始下载，不阻塞解析但占带宽；`<script src>` 同时阻塞解析与执行。

**预加载扫描器（preload scanner）**：浏览器一边用主解析器解析 HTML，一边用另一个轻量扫描器快速扫一遍源码，提前发现 `script`/`img`/`link` 并并行发起请求——这就是「图片不阻塞解析但能和 JS 并行下载」的原因。

实测（本地延迟响应）：`<script src>` 延迟 400ms → 其后内联脚本晚 401ms 执行；`<img src>` 延迟 400ms → 其后内联脚本立即执行；`<link rel="stylesheet">` 延迟 300ms → 其后内联脚本晚 302ms 执行（CSS 阻塞 JS）。

### 4.9.3 为什么 `link` 用 `href` 而 `script` 用 `src`

```
<link rel="stylesheet" href="a.css">
   → 「本文档引用（references）一个样式表」→ 引用关系 → href
   → 但它确实会「应用」到文档上

<script src="a.js">
   → 「把这段脚本嵌入（embed）进来执行」→ 替换内容 → src

<img src="a.png">
   → 「这张图就是这个元素的内容」→ 替换内容 → src
```

记忆法：**`src` 把资源「装进来」，`href` 指向资源「建立关系」**。

---

## 4.10 MIME 类型

### 4.10.1 一句话回答

**MIME 类型（现在叫 media type）是 HTTP `Content-Type` 头的值，用来告诉浏览器响应体是什么格式**。格式是 `type/subtype`，可带参数（如 `charset`）。它由服务端决定，与文件扩展名没有必然关系。

```http
Content-Type: text/html; charset=utf-8
Content-Type: application/json
Content-Type: image/svg+xml
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary...
```

### 4.10.2 常见类型表

| 类别 | MIME | 用途 |
|---|---|---|
| **文档** | `text/html` | HTML |
| | `text/css` | CSS |
| | `text/plain` | 纯文本 |
| | `application/json` | JSON |
| | `application/pdf` | PDF |
| **脚本** | `text/javascript` | JS（**规范推荐这个**，`application/javascript` 也普遍接受） |
| | `application/wasm` | WebAssembly |
| **图片** | `image/png` `image/jpeg` `image/gif` `image/webp` `image/avif` | 位图 |
| | `image/svg+xml` | **SVG 必须是这个**，否则 `<img>` 里不渲染 |
| **字体** | `font/woff2`（旧：`application/font-woff`） | Web 字体 |
| | `font/ttf` `font/otf` | 系统字体格式 |
| **音视频** | `video/mp4` `video/webm` `audio/mpeg` `audio/ogg` | 媒体 |
| **表单** | `application/x-www-form-urlencoded` | 默认表单提交 |
| | `multipart/form-data` | 含文件上传 |
| **二进制** | `application/octet-stream` | 「未知二进制」，会触发下载 |

### 4.10.3 为什么 MIME 这么重要（四个真实后果）

| 后果 | 说明 |
|---|---|
| **① `nosniff` 下错误 MIME 会让资源拒绝执行** | 返回 `X-Content-Type-Options: nosniff` 后浏览器不再猜测：`<script>` 必须是 JS MIME，`<style>` 必须是 `text/css`。否则报 *Refused to execute script because its MIME type ('text/plain') is not executable* |
| **② 安全** | 没有 `nosniff` 时浏览器会嗅探内容：用户上传一个内容是 HTML 的 `.txt`，若被当作 `text/html` 返回，其中的脚本会被执行（存储型 XSS 的经典路径） |
| **③ 编码** | `charset` 参数决定解码方式；`Content-Type: text/html` 不带 charset 时回退到 `<meta charset>` |
| **④ 渲染行为** | `image/svg+xml` 的 SVG 在 `<img>` 里不执行内部脚本（安全），但直接导航到 SVG 文件则会执行 |

### 4.10.4 浏览器嗅探（MIME sniffing）的来历

```
早期服务器配置混乱，常把文件一律返回 text/plain 或 application/octet-stream
  → 浏览器为了「让页面能用」开始猜：看到 <html> 按 HTML 渲染，看到 GIF89a 按图片渲染
  → 攻击者把 HTML + JS 伪装成图片，诱导浏览器按 HTML 执行
对策：X-Content-Type-Options: nosniff —— 让浏览器相信 Content-Type，不要猜
```

### 4.10.5 为什么上传的文件要单独域

```http
# 用户上传目录的响应头
Content-Type: application/octet-stream
Content-Disposition: attachment
X-Content-Type-Options: nosniff
# 并且部署在独立域（如 user-content.example-cdn.com）
```

四层防御：

1. **独立域**：即使被当成 HTML 执行，也拿不到主站 Cookie（同源策略）
2. **`Content-Disposition: attachment`**：强制下载而不是渲染
3. **`nosniff`**：禁止嗅探
4. **`Content-Type: application/octet-stream`**：不作任何类型声明

---

## 4.11 速记卡

```
meta（真正重要的三个）
  charset          必须在前 1024 字节内；HTTP 头 charset 优先
  viewport         width=device-width, initial-scale=1
  description      不影响排名，影响点击率
  keywords / X-UA-Compatible 已死
  四种用法：charset / name / http-equiv / property(og:*)

viewport
  不写 → 布局视口 980px → 页面被缩小 → 字变小
  三种视口：布局（980）/ 视觉（可见）/ 理想（设备宽）
  ★ 不限制缩放：WCAG 要求可放大，iOS 已忽略 user-scalable=no
  viewport-fit=cover + env(safe-area-inset-*)
  DPR = 物理/CSS → 1px 边框变粗

link
  stylesheet / icon / apple-touch-icon / manifest / canonical / alternate
  preload（当前页，as 必填）> preconnect > dns-prefetch > prefetch（下页，最低）
  ★ as 缺失/非法 → preload 作废，只发一次请求
  ★ as 与实际用途不一致 → 下载两次（preloaded but not used）
  ★ 字体 preload 必须 crossorigin，否则凭证模式不匹配 → 重复下载
  ★ modulepreload 比 preload 更懂 module 图

link vs @import
  link：HTML 标签，与解析并行发现，可 JS 操作，预加载扫描器能发现
  @import：CSS 语法，必须等父 CSS 解析完 → 串行，多一次往返
  写在其它规则之后 → 整条被忽略

img
  alt  替代文本：失败 / 读屏 / 爬虫
  title 悬停提示：样式不可控、触摸无、键盘无
  ★ title 不能替代 alt
  alt 四种写法：
    内容图 → 描述信息
    装饰图 → alt=""（空字符串，不能省略）
    链接内唯一内容 → 描述目的地
    复杂图 → 一句话 alt + aria-describedby/figcaption
  ★ 省略 alt → 读屏器念文件名
  必用 title：<abbr title> 全称、<iframe title> 无障碍

img loading
  lazy / eager / auto
  ★ 首屏 LCP 图绝对不能 lazy → 推迟 LCP
  首屏图：eager + fetchpriority="high" + preload
  提前距离由浏览器按网络状况决定，慢网更远
  防 CLS：width/height 或 aspect-ratio

favicon
  <link rel="icon" href="/icon.svg" type="image/svg+xml">
  不声明 → 自动请求 /favicon.ico
  apple-touch-icon 180×180，不圆角、不透明
  ★ 缓存极顽固 → 改文件名加 hash

PDF
  iframe / embed / object → 依赖内置阅读器（移动端差）
  PDF.js → 完全可控，体积大
  移动端最优：服务端转图片
  ★ PDF 内含 JS，用户上传的别直接内嵌主域

src vs href
  src = 替换内容（script/img/iframe/video）
  href = 引用/超链接（a/link/base）
  ★ 「src 加载完才继续」只对 script 成立，img/iframe 不阻塞解析
  预加载扫描器提前发现并并行请求

MIME
  Content-Type: type/subtype; charset=...
  常见：text/html / text/css / text/javascript / application/json
        image/svg+xml（SVG 必须是）/ font/woff2 / multipart/form-data
  ★ nosniff 下 MIME 错 → script/style 拒绝执行
  ★ 嗅探是安全漏洞 → nosniff 堵它
  用户上传：octet-stream + attachment + nosniff + 独立域
```
