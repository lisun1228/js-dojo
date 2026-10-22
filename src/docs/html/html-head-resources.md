# HTML · 04 文档头部与资源引用

> 本册覆盖：img 的 alt/title、meta、viewport、link 与 link vs @import、favicon、PDF 展示、src vs href、MIME、img 的 loading
> 这是题量最大的一册（11 题），但都是「**小而杂**」的知识点。**它们的共同特征是：答对不难，答全很难。**
> 题单在这一册有两处明显错误：`src` 的阻塞行为、`alt` 与 `title` 的定位。

---

## 4.1 一句话结论

`<head>` 里的东西分两类：**「告诉浏览器怎么处理这个文档」（meta/charset/viewport/DOCTYPE）** 和 **「告诉浏览器去拿哪些外部资源、以什么优先级拿」（link/script/preload）**。`<img>` 与 `src/href` 的问题本质是「**这个资源是替换当前内容，还是被当前内容引用**」。

---

## 4.2 meta 标签

### 4.2.1 一句话回答

`meta` 是**空元素**，用来声明**无法用其它 HTML 元素表达的文档级元信息**。它有三种用法：`charset`（编码）、`name` + `content`（命名元信息）、`http-equiv` + `content`（模拟 HTTP 响应头）、`property` + `content`（Open Graph，非标准但事实标准）。

### 4.2.2 四类用法

```html
<head>
  <!-- ① charset：必须在文档前 1024 字节内 -->
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
| **`charset`** | 声明字符编码 | **必须出现在文档前 1024 字节内**。如果太靠后，浏览器已经用默认编码解析了一段，再遇到 charset 会**重新解析整个文档**（性能损耗 + 可能闪一下）。**HTTP 头的 charset 优先级高于 meta** |
| **`viewport`** | 移动端视口 | 见 4.3 |
| **`description`** | 搜索结果摘要 | **不影响排名**，但**直接影响点击率**（CTR）。建议 120~158 字符，不写搜索引擎会自己截取正文 |
| **`robots`** | 单页抓取/索引控制 | `index/noindex`（能否索引）、`follow/nofollow`（能否跟踪链接）、`noarchive`、`nosnippet`、`max-snippet:n`。**测试环境必须 `noindex`** |
| **`theme-color`** | 移动端浏览器地址栏/状态栏颜色 | 支持 `media` 属性做深浅色适配 |
| **`color-scheme`** | 声明页面支持深色模式 | 让表单控件、滚动条自动跟随系统深浅色 |
| **`format-detection`** | 是否自动识别电话号码 | iOS Safari 会把数字串识别成电话链接并变蓝，`telephone=no` 可关 |
| **`referrer`** | 控制 Referer 头发送策略 | 等价于 `Referrer-Policy` 头 |
| **`keywords`** | **已无任何作用** | Google 2009 年就明确不用了，百度也基本不用。**别花时间写** |
| **`X-UA-Compatible`** | 让老 IE 用最新内核 | 现在**完全没意义**（IE 已退役），老项目里还留着 |
| **`refresh`** | 定时刷新/跳转 | 属于「坏味道」，会影响后退按钮和可访问性，用 JS 或 301 代替 |

### 4.2.4 三个高频坑

| 坑 | 现象 | 原因 |
|---|---|---|
| **中文乱码** | 页面变成「锟斤拷」 | `charset` 写错（写成 `gb2312` 但文件是 UTF-8），或**服务器响应头里声明了另一种编码**（HTTP 头优先） |
| **移动端页面很「小」** | 手机上显示得像桌面版缩略图 | 漏了 viewport meta，浏览器用默认 980px 布局视口 |
| **`noindex` 上了生产** | 网站从搜索结果里消失 | 测试环境的 meta 忘记删 |

> **面试话术**：「meta 里真正重要的只有三个：charset、viewport、description。charset 必须在前 1024 字节内，否则浏览器会重新解析；viewport 决定移动端布局视口宽度；description 不影响排名但影响点击率。`keywords` 已经完全没用了，`X-UA-Compatible` 在 IE 退役后也没意义了，这两个是老项目里的历史遗留。」

---

## 4.3 viewport

### 4.3.1 一句话回答

`<meta name="viewport">` 用来**控制移动端「布局视口（layout viewport）」的宽度和缩放**。不写它，手机浏览器会用默认的 **980px** 布局视口，然后把整个页面缩小塞进屏幕——结果就是「字小得像蚂蚁」。

### 4.3.2 三个视口的概念（这是深水区）

```
① 布局视口 layout viewport    → CSS 里的 100vw / 百分比按它算（默认 980px）
② 视觉视口 visual viewport    → 用户当前能看到的区域（随缩放变化）
③ 理想视口 ideal viewport     → 设备宽度（width=device-width 就是设成这个）
```

| 不写 viewport | 写了 `width=device-width, initial-scale=1` |
|---|---|
| 布局视口 = 980px | 布局视口 = 设备 CSS 宽度（如 390px） |
| `width:100%` 的元素 = 980px 宽 | = 390px 宽 |
| 浏览器把 980px 缩到 390px 显示 → **字变小 2.5 倍** | 1:1 显示，字号正常 |

### 4.3.3 各参数的准确含义

```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

| 参数 | 含义 | 建议 |
|---|---|---|
| `width` | 布局视口宽度，可以是具体像素或 `device-width` | **必须写 `device-width`** |
| `height` | 布局视口高度 | 基本不用（横屏会出问题） |
| `initial-scale` | 初始缩放比例（相对理想视口） | **必须写 `1`**。iOS 上 `width=device-width` 单独写有时不生效，配合 `initial-scale=1` 才稳 |
| `minimum-scale` / `maximum-scale` | 允许的最小/最大缩放 | **不建议限制**（无障碍问题） |
| `user-scalable=no` | 禁止用户缩放 | **强烈不建议**：WCAG 1.4.4 要求可放大到 200%；**iOS 10+ 已忽略这个属性**（为了无障碍），所以写了也没用 |
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

不写 `viewport-fit=cover` 时，浏览器会自动给内容加内边距避开刘海（叫 safe area inset），页面背景色不会延伸到刘海区域——所以「全屏背景 + 内容避开刘海」需要 `cover` + `env()`。

### 4.3.5 顺带：为什么会有「1px 边框变粗」

| 概念 | 说明 |
|---|---|
| **物理像素** | 屏幕真实像素点（iPhone 14: 1170×2532） |
| **CSS 像素** | 逻辑像素（iPhone 14: 390×844） |
| **DPR** | 设备像素比 = 物理 / CSS（iPhone 14 = 3） |

所以 `border: 1px` 在 DPR=3 的屏幕上会占 **3 个物理像素**，看起来比设计稿粗。解法：`transform: scaleY(0.333)` 伪元素、`0.5px`（部分设备支持）、`box-shadow` 模拟。

### 4.3.6 面试怎么答

**30 秒版**

> viewport meta 用来控制移动端布局视口。不写的话，手机浏览器默认用 980px 的布局视口，然后把页面缩小塞进屏幕，结果字特别小。写了 `width=device-width, initial-scale=1` 之后，布局视口等于设备宽度，1:1 显示。另外要注意 `user-scalable=no` 不该用——它违反无障碍规范，而且 iOS 10 之后已经直接忽略这个属性了。全面屏要加 `viewport-fit=cover` 配合 `env(safe-area-inset-*)` 处理刘海和底部指示条。

**追问表**

| 追问 | 回答要点 |
|---|---|
| 不写 viewport 会怎样 | 布局视口默认 980px，页面被缩小，字变小 |
| 三种视口 | 布局视口（980 默认）/ 视觉视口（可见区域）/ 理想视口（设备宽度） |
| `initial-scale=1` 为什么必须写 | iOS 上单独写 `width=device-width` 有时不生效 |
| `user-scalable=no` 能用吗 | 不建议（WCAG 要求可放大），且 iOS 10+ 已忽略 |
| `viewport-fit=cover` 干什么 | 让内容延伸到刘海区域，配合 `env(safe-area-inset-*)` |
| 1px 为什么变粗 | DPR=3 时 1 CSS px = 3 物理 px |
| 移动端适配方案 | rem + `html{font-size: vw}` / vw 直接写 / `postcss-px-to-viewport` / 媒体查询 |
| 软键盘遮挡输入框怎么办 | `interactive-widget=resizes-content`、`scrollIntoView`、`visualViewport` API |

---

## 4.4 link 标签与 `@import`

### 4.4.1 一句话回答

`link` 是**空元素**，用来声明「本文档与外部资源的关系」。核心属性是 `rel`（关系类型）+ `href`（地址）。`@import` 是 **CSS 语法**，只能用来引入 CSS，**必须写在样式表最前面**，而且是**串行加载**——所以工程上**应该用 `link` 而不是 `@import`**。

### 4.4.2 `rel` 的取值全表（按使用频率）

| `rel` 值 | 作用 | 配套属性 | 说明 |
|---|---|---|---|
| **`stylesheet`** | 引入 CSS | `media`、`disabled` | **阻塞渲染**，不阻塞解析 |
| **`icon`** | favicon | `sizes`、`type` | 见 4.7 |
| **`apple-touch-icon`** | iOS 添加到主屏的图标 | `sizes="180x180"` | 不写会用页面截图 |
| **`manifest`** | PWA 清单 | — | `<link rel="manifest" href="/manifest.json">` |
| **`canonical`** | 声明规范 URL | — | 解决重复内容，SEO 用 |
| **`alternate`** | 替代版本（RSS/多语言/AMP） | `hreflang`、`type` | `<link rel="alternate" hreflang="en" href="...">` |
| **`preload`** | **当前页面**马上要用，高优先级预加载 | **`as`（必填）**、`crossorigin`、`type` | 见下表 |
| **`prefetch`** | **下一个页面**可能要用，低优先级 | `as` | 空闲时下载，进缓存 |
| **`preconnect`** | 提前建立连接（DNS + TCP + TLS） | `crossorigin` | 用于第三方域（CDN、API） |
| **`dns-prefetch`** | 只做 DNS 解析 | — | `preconnect` 的降级方案，兼容性更好 |
| **`modulepreload`** | 预加载 ES module 及其依赖 | — | 比 `preload` 更懂 module 图 |
| **`prerender`** | 预渲染下个页面 | — | 资源消耗大，慎用 |
| **`author` / `license` / `me` / `next` / `prev`** | 元信息 | — | `next/prev` 用于分页 SEO |

### 4.4.3 `preload` 的三个必知细节（★ 高频）

```html
<!-- ❌ 漏了 as：浏览器不知道资源类型 → 会再发一次请求（下两次） -->
<link rel="preload" href="/font.woff2">

<!-- ✅ 正确 -->
<link rel="preload" href="/font.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/hero.avif" as="image" fetchpriority="high">
<link rel="preload" href="/app.js" as="script">
<link rel="preload" href="/api/user" as="fetch" crossorigin>
```

| 细节 | 说明 |
|---|---|
| **`as` 必须写** | 它决定：① 请求的 `Accept` 头 ② 资源优先级 ③ 是否复用缓存。**漏写会导致同一个资源下载两次**（`preload` 一次 + 真正使用时再一次），控制台会警告 "resource was preloaded but not used" |
| **字体必须 `crossorigin`** | 字体请求是 CORS 请求。`preload` 不加 `crossorigin` 会和实际请求的「凭证模式」不匹配 → **重复下载**。这是最常见的 `preload` 失效原因 |
| **没用到的 `preload` 是负优化** | 会占用带宽、抢占其它资源优先级。Chrome 会在控制台警告 |

**四个指令的优先级与用途对比**：

| 指令 | 做什么 | 优先级 | 用在哪 |
|---|---|---|---|
| `dns-prefetch` | 只解析 DNS | 最低 | 兼容性兜底、大量第三方域 |
| `preconnect` | DNS + TCP + TLS | 低 | **确定会用的**第三方域 |
| `prefetch` | 下载整个资源到 HTTP 缓存 | 最低（空闲时） | 下一个页面 |
| `preload` | 下载当前页资源，**高优先级** | **最高** | 首屏关键资源（字体、LCP 图、关键 JS） |

**优先级顺序（高 → 低）**：`preload` > `preconnect` > `dns-prefetch` > `prefetch`。

### 4.4.4 `link` vs `@import`

| 维度 | `<link rel="stylesheet">` | `@import` |
|---|---|---|
| **归属** | **HTML 标签** | **CSS at-rule** |
| **加载方式** | 与 HTML 解析**并行**发现 | **必须等父 CSS 下载并解析完**，才能发现 `@import` → **串行** |
| **阻塞行为** | 阻塞**渲染**，不阻塞解析 | 同样阻塞渲染，但**多一次串行往返**，首屏更慢 |
| **位置要求** | 任意（`head` 里） | **必须在样式表最前**（`@charset` 之后、其它规则之前），否则被忽略 |
| **DOM 可操作** | ✅ 可以 JS 动态增删 | ❌ 不能 |
| **媒体查询** | `media` 属性 | `@import url() screen and (max-width:600px)` |
| **兼容性** | 全部 | IE5+（但老版本有 bug） |
| **能否被 preload 扫描到** | ✅ 预加载扫描器能提前发现 | ❌ 扫描器看不到 CSS 内部的 `@import` |
| **层叠权重** | 都是「作者样式」，**权重相同**（取决于顺序，后写的赢） | 同 |
| **是否影响 CSSOM 构建** | 直接参与 | 嵌套，增加 CSSOM 构建时间 |

**一句话结论**：**`@import` 唯一合理的场景是「CSS 内部的模块化管理」**（比如 `index.css` 里 `@import` 一堆 partial），而且**现代构建工具（Sass/Less/PostCSS）会在编译期把它合并成一个文件，运行时根本不存在 `@import`**。手写 `@import` 引入线上 CSS 是性能反模式。

> **面试话术**：「`link` 是 HTML 标签，和 HTML 解析并行发现、并行下载；`@import` 是 CSS 语法，必须等父 CSS 下载并解析完才能发现，是串行的，多一次往返，首屏更慢。而且预加载扫描器能提前发现 `link`，但看不到 CSS 内部的 `@import`。所以线上应该用 `link`。`@import` 只在源码层面做 CSS 模块化有意义，构建工具会在编译期合并掉。」

---

## 4.5 img 的 `alt` 与 `title`

### 4.5.1 一句话回答

| 属性 | 什么时候出现 | 谁在用 | 作用 |
|---|---|---|---|
| **`alt`** | **图片加载失败**、**读屏器朗读**、**爬虫理解图片内容** | 所有人（尤其是无障碍用户） | **替代文本**——图片的「文字版」 |
| **`title`** | **鼠标悬停**（hover） | 鼠标用户 | **补充说明**——额外的提示信息 |

**关键认知：`title` 不能替代 `alt`。** 触摸设备没有 hover，键盘用户也看不到；读屏器对 `title` 的支持不稳定。

### 4.5.2 `alt` 的四种正确写法（★ 这是本题的真正考点）

大多数人只会说「alt 是图片加载失败时显示的文本」——这只对了一半。**`alt` 该怎么写，取决于图片的「角色」**：

| 图片角色 | `alt` 怎么写 | 例子 |
|---|---|---|
| **① 有信息量的内容图** | **简明描述图片传达的信息** | `<img src="chart.png" alt="2026 年 Q3 营收同比增长 23%">` |
| **② 纯装饰图**（分隔线、背景纹理） | **`alt=""`（空字符串，但不能省略）** | `<img src="divider.png" alt="">` |
| **③ 图片是链接/按钮的唯一内容** | **描述「点击后的目的地/动作」**，不是描述图片 | `<a href="/cart"><img src="cart.png" alt="购物车"></a>` |
| **④ 复杂图**（图表、流程图） | **`alt` 给一句话概括 + 用 `aria-describedby` / `figcaption` 给长描述** | 见下 |

**② 是最容易错的一条**：

```html
<!-- ❌ 省略 alt：读屏器会念「图片 / 或文件名 cart-icon-2023-final-v2.png」 -->
<img src="divider.png">

<!-- ❌ 写废话：读屏器念「分隔线图片 分隔线」 -->
<img src="divider.png" alt="分隔线图片">

<!-- ✅ 装饰图：alt="" → 读屏器直接跳过 -->
<img src="divider.png" alt="">
```

> **规范要求**：`<img>` **必须有 `alt` 属性**（哪怕值是空的）。**省略 `alt` 和 `alt=""` 完全不同**——前者会让读屏器退化成念文件名。

**④ 复杂图的写法**：

```html
<figure>
  <img src="flow.png" alt="用户登录流程：输入手机号 → 获取验证码 → 校验 → 进入首页"
       aria-describedby="flow-detail">
  <figcaption id="flow-detail">
    详细说明：第一步……第二步……（长文本）
  </figcaption>
</figure>
```

**另一个技巧**：如果图片旁边已经有完整的文字说明（比如图注里说清了），`alt` 可以留空避免重复朗读。

### 4.5.3 `alt` 与 SEO

| 事实 | 说明 |
|---|---|
| `alt` 是**图片搜索**的重要信号 | Google 图片搜索靠 `alt` + 周边文本 + 文件名理解图片 |
| 对**网页搜索**排名影响很小 | 别指望靠 alt 堆关键词提升排名 |
| **堆关键词是负面** | `alt="前端培训 前端培训学校 前端培训班"` 会被判定为作弊，也破坏无障碍 |

### 4.5.4 `title` 的真实定位

```html
<img src="logo.png" alt="公司 Logo" title="成立于 2010 年">
```

| 特性 | 说明 |
|---|---|
| 显示方式 | 鼠标悬停 ~1 秒后出现系统 tooltip |
| 样式 | **完全不可控**（系统原生），不能改颜色/字号/延迟 |
| 触摸设备 | **完全不显示**（没有 hover） |
| 键盘用户 | 不显示 |
| 读屏器 | 支持不一致（有的读作「描述」，有的不读） |
| 移动端长按 | 部分浏览器会显示 |

**结论**：`title` 只能作为「**锦上添花的补充信息**」，**任何关键信息都不能只放在 `title` 里**。需要 tooltip 就用组件库自己做（可控、可访问、移动端可用）。

### 4.5.5 `title` 的其它用途（顺带）

| 元素 | `title` 的作用 |
|---|---|
| `<a title="">` | 补充说明链接目的地 |
| `<abbr title="HyperText Markup Language">` | **缩写全称，这是 `title` 最正当的用途** |
| `<iframe title="">` | **无障碍要求**：iframe 必须有 `title`，读屏器用它说明这个框架是什么 |
| `<input title="">` | 补充说明（但**不能替代 label**） |

> **`<abbr title>` 和 `<iframe title>` 是两个「必须写」的场景**，很多人不知道。

### 4.5.6 面试怎么答

**30 秒版**

> `alt` 是替代文本，图片加载失败时显示、读屏器朗读、爬虫理解图片内容；`title` 是鼠标悬停时的补充提示，样式不可控、触摸设备不显示，所以 **`title` 不能替代 `alt`**。`alt` 的写法要看图片角色：内容图描述它传达的信息；纯装饰图要写 `alt=""`（空字符串），而不是省略——省略的话读屏器会念文件名；如果图片是链接里唯一的内容，`alt` 要描述点击后的目的地。

**追问表**

| 追问 | 回答要点 |
|---|---|
| `alt` 和 `title` 区别 | `alt` 是替代文本（失败/读屏/爬虫）；`title` 是悬停提示 |
| `alt` 能省略吗 | **不能**，装饰图要写 `alt=""`（空值），省略会念文件名 |
| 装饰图 alt 写什么 | `alt=""` |
| 图片在链接里 alt 写什么 | 描述目的地/动作（「购物车」而不是「购物车图标」） |
| 复杂图表怎么写 | `alt` 一句话概括 + `aria-describedby` / `figcaption` 长描述 |
| `title` 有什么必用场景 | `<abbr title>` 缩写全称、`<iframe title>` 无障碍要求 |
| `alt` 影响 SEO 吗 | 图片搜索重要，网页排名影响很小；堆关键词算作弊 |
| 想要 tooltip 怎么办 | 自己写组件（可控、可访问、移动端可用），别用 `title` |

---

## 4.6 img 的 `loading` 属性

### 4.6.1 一句话回答

`loading="lazy"` 是**浏览器原生懒加载**：图片进入「接近视口」的范围才开始下载。它替代了以前用 `IntersectionObserver` 手写懒加载的方案，**不用一行 JS**。

```html
<img src="a.jpg" loading="lazy" alt="...">
```

三个值：`lazy`（懒加载）、`eager`（立即加载，默认）、`auto`（交给浏览器决定）。

### 4.6.2 但有一条铁律：**首屏图不能用 lazy**

```html
<!-- ❌ 灾难：LCP 图加了 lazy，LCP 会被推迟几百毫秒到几秒 -->
<img src="hero.avif" loading="lazy" alt="首屏大图">

<!-- ✅ 正确：首屏主图要 eager + 高优先级 -->
<img src="hero.avif" loading="eager" fetchpriority="high" width="1200" height="600" alt="首屏大图">
```

**原因**：`lazy` 的图片要等**布局完成、浏览器算出它的位置**才开始加载。而 **LCP 图恰恰是首屏最大的那张**——给它加 `lazy` 等于人为延后 LCP 的起点。

| 图片位置 | 建议 |
|---|---|
| 首屏（above the fold） | `loading="eager"` + `fetchpriority="high"` |
| 首屏以下 | `loading="lazy"` |
| 不确定 | 不写（默认 `eager`），或只在明确靠下的位置写 `lazy` |

### 4.6.3 原生 lazy 的加载阈值

浏览器不会等图片进入视口才加载，而是**提前一段距离**开始下载。Chrome 的阈值取决于网络：

| 网络 | 预加载距离 |
|---|---|
| 4G | 约 1250px |
| 3G | 约 2500px |
| 慢速 2G | 约 8000px |

**这意味着**：移动端一屏 700px 高，4G 下相当于「提前 2 屏」就开始下载了。所以原生 lazy 对首屏以下的图片**收益没有想象中大**，但对长列表/长文章仍然有效。

### 4.6.4 原生 lazy vs 手写 IntersectionObserver

| 维度 | `loading="lazy"` | `IntersectionObserver` |
|---|---|---|
| 代码量 | 0 | 需要写 observer + 占位 |
| 阈值控制 | ❌ 浏览器决定 | ✅ 完全可控（`rootMargin`） |
| 占位/骨架屏 | ❌ 不会自动加 | ✅ 可以自定义 |
| 加载失败重试 | ❌ 无 | ✅ 可以自己实现 |
| 支持格式 | 只对 `<img>` / `<iframe>` | 任意元素、任意资源 |
| 渐进增强 | ✅ 不支持的浏览器直接正常加载 | 需要 polyfill |
| 适用 | **常规图片列表** | **需要精细控制的场景**（无限滚动、虚拟列表） |

> **现在的主流做法**：**优先用原生 `loading="lazy"`**，只在需要自定义阈值/骨架屏/重试时才上手写。

### 4.6.5 其它容易一起被问的图片属性

| 属性 | 作用 | 为什么重要 |
|---|---|---|
| **`width` / `height`** | 声明固有宽高 | **防止 CLS**：不写的话图片加载完成后会把下方内容顶下去，累积布局偏移 |
| **`decoding="async"`** | 异步解码，不阻塞主线程渲染 | 大图解码会卡帧；`sync` 会强制同步解码 |
| **`fetchpriority="high"`** | 提升该图片的请求优先级 | 专门给 **LCP 图**用 |
| **`srcset` / `sizes`** | 响应式图片，按 DPR/视口选图 | 移动端不用下载桌面大图 |
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

**注意 `width/height` 与 `sizes` 的关系**：写了 `width/height` 会建立宽高比（`aspect-ratio`），CSS 里 `width:100%; height:auto` 就能自适应且不产生 CLS。

### 4.6.6 面试怎么答

**30 秒版**

> `loading="lazy"` 是浏览器原生懒加载，图片接近视口才开始下载，不用写 JS。但有一条铁律：**首屏的 LCP 图绝对不能用 lazy**——因为 lazy 要等布局完成、算出位置才开始加载，等于人为推迟 LCP。首屏图应该用 `eager` 加 `fetchpriority="high"`。另外原生 lazy 的阈值跟网络有关，4G 下大概提前 1250px 就开始下载了，所以它的收益主要集中在长列表和长文章上。

**追问表**

| 追问 | 回答要点 |
|---|---|
| `loading` 有哪些值 | `lazy` / `eager` / `auto` |
| 首屏图能用 lazy 吗 | **不能**，会推迟 LCP |
| 原生 lazy 的阈值 | 4G 约 1250px，3G 约 2500px，慢网更远（浏览器决定） |
| 和 IntersectionObserver 区别 | 原生零代码但不可控；IO 可自定义阈值/骨架屏/重试 |
| 能用于 background-image 吗 | 不能，只对 `img`/`iframe` |
| 怎么防 CLS | 写 `width`/`height` 或 `aspect-ratio` |
| `decoding="async"` 干什么 | 异步解码，不阻塞渲染主线程 |
| LCP 图怎么优化 | `eager` + `fetchpriority="high"` + `preload` + 压缩/AVIF + CDN |
| srcset 的 w 和 x 区别 | `w` 描述符配 `sizes`（按布局宽度选）；`x` 描述符按 DPR 选 |

---

## 4.7 favicon

### 4.7.1 一句话回答

标签页上的小图标叫 **favicon**（favorite icon），通过 `<link rel="icon">` 声明。**不声明的话浏览器会自动请求根目录的 `/favicon.ico`**。

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
| **改了 favicon 但没生效** | 用户还看到旧图标 | **favicon 的缓存极其顽固**（浏览器、CDN、甚至桌面快捷方式都缓存）。解法：改文件名加 hash（`favicon-v2.ico`）或加 query（`favicon.ico?v=2`） |
| **SVG 图标在标签页不显示** | 一片空白 | 有些浏览器要求 SVG 有明确的 `viewBox`；且 SVG 里的外部引用（字体、图片）不生效 |
| **自动请求 `/favicon.ico` 返回 404** | 控制台一直报 404 | 浏览器默认会请求根路径的 `favicon.ico`。要么放一个文件，要么显式声明 `<link rel="icon" href="data:,">` 关掉 |

### 4.7.5 面试怎么答

**30 秒版**

> 那是 favicon，通过 `<link rel="icon" href="/favicon.ico">` 声明。不声明的话浏览器会自动去请求根目录的 `/favicon.ico`，所以如果那儿没有文件会一直报 404。现代做法优先用 SVG（矢量、能跟随深色模式），用 ico 兜底，iOS 主屏要单独的 `apple-touch-icon` 180×180 且不能圆角不能透明。要注意 favicon 的缓存特别顽固，改了不生效就得换文件名加 hash。

---

## 4.8 页面上展示 PDF

### 4.8.1 四种方案对比

| 方案 | 实现 | 优点 | 缺点 |
|---|---|---|---|
| **`<iframe>`** | `<iframe src="a.pdf">` | 一行代码；用浏览器内置阅读器 | **完全依赖浏览器**：iOS Safari 体验差、Android Chrome 常常直接下载、无法自定义 UI、跨域有安全限制 |
| **`<embed>` / `<object>`** | `<embed type="application/pdf" src="a.pdf">` | 语义上更「嵌入」 | 同样依赖内置阅读器；`embed` 是空元素、无 fallback；`object` 可写 fallback 但同样受限 |
| **PDF.js**（Mozilla） | JS 解析 PDF，用 Canvas 渲染 | **完全可控**：UI、翻页、搜索、缩放、批注、跨端一致 | 体积大（核心 ~1MB+，可分包）、复杂 PDF 渲染性能一般 |
| **服务端转图片 / 转 HTML** | 后端把 PDF 转成图片或 HTML | 移动端体验最好、加载快 | 需要服务端能力；失去文本选择和搜索（转图片时） |

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
| **PDF 可以内含 JS** | PDF 支持 JavaScript（表单计算、自动动作），某些阅读器会执行。**用户上传的 PDF 不要用 `iframe` 直接内嵌在你的域下**（等于把你的域暴露给一个可执行脚本的文件），应该用独立域 + `sandbox`，或者转成图片 |
| **跨域 iframe 读不到内容** | 同源策略下 `iframe.contentDocument` 对跨域 PDF 是 `null`，所以「检测 PDF 是否加载成功」做不到，只能用超时兜底 |

### 4.8.5 面试怎么答

**30 秒版**

> 最简单的方案是 `iframe src="a.pdf"`，用浏览器内置的 PDF 阅读器，一行代码。但它完全依赖浏览器——iOS Safari 体验差，Android Chrome 经常直接下载文件，而且 UI 不可控。需要自定义 UI、翻页、搜索、批注的话就用 PDF.js，它是 Mozilla 开源的，用 JS 解析 PDF 再用 Canvas 渲染，跨端一致。如果主要用户是移动端，最好的方案其实是服务端把 PDF 转成图片。

---

## 4.9 `src` 与 `href` 的区别

### 4.9.1 一句话回答

| | `src`（source） | `href`（hypertext reference） |
|---|---|---|
| **语义** | **替换**当前元素的内容 | **引用**一个外部资源 / 建立超链接 |
| **用于** | `script` `img` `iframe` `video` `audio` `source` `embed` `input` | `a` `link` `area` `base` |
| **浏览器行为** | **必须下载并嵌入**到文档中（成为文档的一部分） | 建立关联，**并行加载**，不替代当前内容 |
| **类比** | 「把这张图**贴**在这里」 | 「这里**指向**那个地址」 |

### 4.9.2 ★ 题单在这里说错了：「src 加载完才继续」

题单原文：**「src：替换当前资源（script/img/iframe），加载完才继续」**。

**这个说法只对 `script` 成立，对 `img` / `iframe` 是错的。**

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
  ③ 脚本可能读取样式 → 如果有未加载的 CSS，脚本要等 CSSOM（这就是「CSS 阻塞 JS」）

< img > 不阻塞，因为：
  图片的尺寸/内容不影响后续 HTML 的解析
  浏览器只要留出位置，继续往下解析就行
```

**这带来一个重要的实践结论**：

```html
<!-- 图片在解析阶段就会开始下载（由预加载扫描器 preload scanner 发现） -->
<img src="big.jpg">        <!-- 不阻塞解析，占带宽 -->
<script src="app.js"></script>  <!-- 阻塞解析，等它下载+执行 -->
```

**预加载扫描器（preload scanner）**：浏览器一边用主解析器解析 HTML，一边用另一个**轻量扫描器**快速扫一遍源码，提前发现 `script`/`img`/`link` 并**并行发起请求**。这就是为什么「图片不阻塞解析但能和 JS 并行下载」。

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

**记忆法**：**`src` = 把资源「装进来」，`href` = 指向资源「建立关系」。**

### 4.9.4 面试怎么答

**30 秒版**

> `src` 是 source，表示**替换**当前元素的内容，浏览器必须下载并嵌入，用在 `script`、`img`、`iframe`、`video` 上；`href` 是 hypertext reference，表示**引用/超链接**，建立关联但不替代内容，用在 `a`、`link`、`base` 上。要注意题单里「src 加载完才继续」这个说法只对 `script` 成立——`<img>` 和 `<iframe>` 的 `src` 是不阻塞 HTML 解析的，只有 `script` 会阻塞，因为脚本可能 `document.write` 或者操作 DOM。

**追问表**

| 追问 | 回答要点 |
|---|---|
| `src` 和 `href` 本质区别 | 替换内容 vs 引用关系 |
| `img` 的 src 阻塞解析吗 | **不阻塞**；只占用带宽、影响 `load` 事件 |
| `script` 为什么阻塞 | `document.write` 可能插入字符流；脚本可能操作 DOM/CSSOM |
| `link` 阻塞什么 | **阻塞渲染**，不阻塞解析 |
| 预加载扫描器是什么 | 独立于主解析器，提前扫源码发现 `script`/`img`/`link` 并并行请求 |
| 为什么 `link` 用 href | 语义是「引用一个样式表」，不是「嵌入一段内容」 |
| CSS 会阻塞 JS 吗 | 会：如果脚本要读样式，浏览器必须先构建完 CSSOM 才能执行脚本 |

---

## 4.10 MIME 类型

### 4.10.1 一句话回答

**MIME 类型（现在叫 media type）是 HTTP `Content-Type` 头的值，用来告诉浏览器「这个响应体是什么格式」**。格式是 `type/subtype`，可带参数（如 `charset`）。

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
| **① `nosniff` 下错误 MIME 会让资源拒绝执行** | 服务器返回 `X-Content-Type-Options: nosniff` 后，浏览器**不再猜测**：`<script>` 必须是 JS MIME（`text/javascript` 等），`<style>` 必须是 `text/css`。否则控制台报 *Refused to execute script because its MIME type ('text/plain') is not executable* |
| **② 安全** | 没有 `nosniff` 时，浏览器会「嗅探」内容：用户上传一个内容是 HTML 的 `.txt` 文件，如果被当作 `text/html` 返回，就会**执行其中的脚本**（存储型 XSS 的经典路径） |
| **③ 编码** | `charset` 参数决定解码方式。`Content-Type: text/html` 不带 charset 时，浏览器会回退到 `<meta charset>` |
| **④ 渲染行为** | `image/svg+xml` 的 SVG 在 `<img>` 里**不会执行内部脚本**（安全），但如果直接导航到 SVG 文件则会。类型决定了「在什么上下文里被如何处理」 |

### 4.10.4 浏览器嗅探（MIME sniffing）的历史

```
早期：服务器配置混乱，很多服务器给所有文件返回 text/plain 或 application/octet-stream
     → 浏览器为了「让页面能用」，开始猜内容：
        看到 <html> 就按 HTML 渲染
        看到 GIF89a 就按图片渲染
     → 安全问题：攻击者可以把 HTML+JS 伪装成图片，诱导浏览器按 HTML 执行
     ↓
对策：X-Content-Type-Options: nosniff
     告诉浏览器「相信我给的 Content-Type，不要猜」
     ↓
现在：主流站点都应该加 nosniff
```

### 4.10.5 一道高频关联题：为什么上传的文件要单独域

```http
# 用户上传目录的响应头（正确做法）
Content-Type: application/octet-stream
Content-Disposition: attachment
X-Content-Type-Options: nosniff
# 并且部署在独立域（如 user-content.example-cdn.com）
```

**四层防御**：
1. **独立域**：即使被当成 HTML 执行，也拿不到主站 Cookie（同源策略）
2. **`Content-Disposition: attachment`**：强制下载而不是渲染
3. **`nosniff`**：禁止嗅探
4. **`Content-Type: application/octet-stream`**：不作任何类型声明

### 4.10.6 面试怎么答

**30 秒版**

> MIME 类型就是 HTTP 的 `Content-Type`，格式是 `type/subtype`，可以带 charset 参数，用来告诉浏览器响应体是什么格式。常见的比如 `text/html`、`text/css`、`text/javascript`、`application/json`、`image/svg+xml`。它有两个重要性：一是配合 `X-Content-Type-Options: nosniff` 后，浏览器不再猜测类型，MIME 错了 script 和 style 会直接拒绝执行；二是安全，早期浏览器会嗅探内容，攻击者可以把 HTML 伪装成图片让浏览器执行，nosniff 就是为了堵这个。所以用户上传的文件要用 `application/octet-stream` + `attachment` + 独立域。

**追问表**

| 追问 | 回答要点 |
|---|---|
| MIME 在哪 | HTTP `Content-Type` 头；HTML 里也能用 `<script type>` / `<input accept>` 表达 |
| `text/javascript` 还是 `application/javascript` | 规范推荐 `text/javascript`，两者都被接受 |
| SVG 用什么 | `image/svg+xml`，写成 `image/svg` 或 `text/xml` 在 `<img>` 里不渲染 |
| `nosniff` 有什么影响 | 禁止类型嗅探；MIME 错了 script/style 直接拒绝执行 |
| 为什么表单上传文件用 `multipart/form-data` | 可以携带二进制 + `boundary` 分隔多个字段 |
| `octet-stream` 什么意思 | 「未知二进制」，浏览器会当下载处理 |
| MIME 和扩展名的关系 | **没关系**，MIME 由服务端决定；扩展名只是服务端配置的依据 |
| 故意返回错 MIME 有什么用 | 强制下载（`application/octet-stream` + `attachment`） |

---

## 4.11 速记卡

```
meta（真正重要的三个）
  charset          必须在前 1024 字节内；HTTP 头 charset 优先
  viewport         width=device-width, initial-scale=1
  description      不影响排名，影响点击率
  keywords 已死 / X-UA-Compatible 已死
  http-equiv = 模拟响应头（refresh / CSP / X-UA-Compatible）
  og:* = 社交分享卡片

viewport
  不写 → 布局视口 980px → 页面被缩小 → 字变小
  三种视口：布局（980）/ 视觉（可见）/ 理想（设备宽）
  ★ user-scalable=no 不该用，iOS 10+ 已忽略
  viewport-fit=cover + env(safe-area-inset-*)
  DPR = 物理/CSS → 1px 边框变粗

link（rel 全表）
  stylesheet / icon / apple-touch-icon / manifest / canonical / alternate
  preload（当前页，必须写 as）> preconnect > dns-prefetch > prefetch（下页）
  ★ preload 漏 as → 下载两次
  ★ 字体 preload 必须 crossorigin，否则凭证模式不匹配 → 重复下载
  ★ modulepreload 比 preload 更懂 module 图

link vs @import
  link：HTML 标签，与解析并行发现，可 JS 操作，预加载扫描器能发现
  @import：CSS 语法，必须等父 CSS 解析完 → 串行，多一次往返
  ★ 线上用 link；@import 只在源码层面做模块化

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
  必用 title 的场景：<abbr title> 全称、<iframe title> 无障碍

img loading
  lazy / eager / auto
  ★ 首屏 LCP 图绝对不能 lazy → 推迟 LCP
  首屏图：eager + fetchpriority="high" + preload
  阈值：4G≈1250px，3G≈2500px
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
  ★ 「src 加载完才继续」只对 script 成立
    img / iframe 的 src 不阻塞解析
  预加载扫描器 preload scanner 提前发现并并行请求

MIME
  Content-Type: type/subtype; charset=...
  常见：text/html / text/css / text/javascript / application/json
        image/svg+xml（SVG 必须是）/ font/woff2 / multipart/form-data
  ★ nosniff 下 MIME 错 → script/style 拒绝执行
  ★ 嗅探是安全漏洞 → nosniff 堵它
  用户上传：octet-stream + attachment + nosniff + 独立域
```
