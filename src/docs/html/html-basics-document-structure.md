# HTML · 01 基础概念与文档结构

> 本册覆盖：什么是 HTML、DOCTYPE 与渲染模式、HTML vs XHTML、空元素与标签语法
> 题单在这部分只给了「一行结论」，但**这几道题恰恰是「追问最深」的**——因为它们看起来太简单，面试官一定会往下挖。
> 尤其 DOCTYPE：所有人都知道「不加会怪异模式」，但**能说清怪异模式到底改变了什么的人不到 1%**。

---

## 1.1 一句话结论

HTML 是**描述文档结构和语义的标记语言**，浏览器把它解析成 **DOM 树**；`DOCTYPE` 是**不参与文档内容、只负责切换渲染模式**的一行声明；HTML5 之后**只有一种 DOCTYPE**，它的唯一作用就是「别让浏览器进怪异模式」。

---

## 1.2 HTML 到底是什么

### 1.2.1 一句话回答

**HTML = HyperText Markup Language，超文本标记语言。它不是编程语言（没有变量、循环、逻辑），而是「用一套预定义标签给内容贴语义标签」的标记语言。浏览器把它解析成一棵 DOM 树，再交给 CSS 排版、JS 操作。**

### 1.2.2 三个关键词拆开讲

| 关键词 | 含义 | 面试时的作用 |
|---|---|---|
| **HyperText 超文本** | 文档之间可以通过链接跳转（`<a>`），不是线性阅读 | 说明 HTML 的初心就是「互联」，这是 Web 区别于纸质文档的根本 |
| **Markup 标记** | 给内容**加注语义**（这是标题、这是段落、这是导航），而不是描述样式 | 一句话区分 HTML 和 CSS：「HTML 说这是什么，CSS 说它长什么样」 |
| **Language 语言** | 但**不是**编程语言，没有控制流；只有「元素 + 属性 + 文本」三种东西 | 常被追问「HTML 是编程语言吗」——答：不是，它是声明式标记语言 |

### 1.2.3 一个 HTML 文档的最小骨架

```html
<!DOCTYPE html>                          <!-- ① 模式声明，不是标签 -->
<html lang="zh-CN">                      <!-- ② 根元素，lang 影响读屏发音和翻译 -->
  <head>                                 <!-- ③ 元信息，不渲染 -->
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>页面标题</title>
    <link rel="stylesheet" href="/app.css">
  </head>
  <body>                                 <!-- ④ 可见内容 -->
    <h1>标题</h1>
  </body>
</html>
```

**四个部分各自的职责**（这段能顺口说出来，会显得你「真的写过」）：

| 部分 | 职责 | 常见坑 |
|---|---|---|
| `<!DOCTYPE>` | 决定渲染模式 | 必须第一行（前面有注释/空白在部分老浏览器会失效） |
| `<html lang>` | 语言声明 | `lang="zh-CN"` 影响**读屏器发音**、**浏览器翻译提示**、**拼写检查**；写 `en` 但内容是中文，Chrome 会不停弹翻译 |
| `<head>` | 元信息 | `head` 里的元素**都不渲染**（除 `title`、`link`、`style`、`script` 的副作用） |
| `<body>` | 内容 | 只能有一个；`<body>` 之后的元素会被浏览器**移到 body 里** |

### 1.2.4 浏览器是怎么把字符串变成 DOM 的

这道题经常被延伸成「HTML 解析过程」，提前准备好：

```
字节流 (bytes)
   ↓ 按 HTTP 响应头 / <meta charset> 的编码解码
字符流 (characters)
   ↓ 词法分析（Tokenizer）
Token：StartTag / EndTag / Character / Comment / DOCTYPE
   ↓ 语法分析（Tree Construction）
DOM 节点
   ↓ 建树
DOM 树
```

**关键点（能说出这两条就超过大多数人）**：

| 现象 | 原因 |
|---|---|
| **HTML 解析是容错的、不会「报错白屏」** | 规范里定义了完整的错误恢复规则（比如 `<table>` 里出现非表格内容会被「寄养」foster parenting 到 table 前面），所以**写错标签页面照样出来** |
| **`<script>` 会打断解析** | 因为 `document.write()` 能在解析中途往字符流里插内容，解析器必须停下来执行脚本（详见 05 册） |

### 1.2.5 面试怎么答

**30 秒版**

> HTML 是超文本标记语言，用来描述文档的结构和语义，不是编程语言。浏览器把 HTML 解析成 DOM 树，CSS 负责表现，JS 负责行为——这就是 web 标准的结构、表现、行为三层分离。它有一个重要特性是解析容错，即使标签写错页面也能渲染出来，这是它和 XML 最大的区别。

**2 分钟版**

> 我从三个角度说。
>
> **第一，它是什么**。HTML 是 HyperText Markup Language，标记语言不是编程语言。它只有三样东西：元素、属性、文本。它的职责是**给内容贴语义**——告诉浏览器「这是一级标题、这是导航、这是段落」，而不是「这是 24px 加粗」。样式交给 CSS，交互交给 JS。
>
> **第二，它怎么被处理**。浏览器拿到字节流，先按响应头的 charset 或者 meta charset 解码成字符流，然后词法分析成 token，再由 Tree Construction 建 DOM 树。这里有个很重要的特性是**容错**——规范里定义了非常详细的错误恢复规则，所以标签没闭合、嵌套错误，页面照样能渲染出来，不会像 XML 那样直接报错白屏。代价是浏览器要写很复杂的解析器。
>
> **第三，演变**。HTML4 到 XHTML 想走严格 XML 路线，失败了；HTML5 回到容错路线，同时把语义化标签、多媒体、本地存储这些能力补上，并且从 W3C 的版本号模式改成了 WHATWG 的 Living Standard——不再有「HTML6」，规范是持续演进的。

**追问表**

| 追问 | 回答要点 |
|---|---|
| HTML 是编程语言吗 | 不是，是声明式标记语言，没有变量/循环/逻辑 |
| HTML 和 XML 的区别 | HTML 是预定义标签 + 容错；XML 是自定义标签 + 严格（一个错就整个文档失败） |
| 为什么 HTML 要容错 | 历史包袱：早期网页大量不规范，严格解析会让整个 Web 崩溃；且容错让作者犯错成本低 |
| 谁在维护 HTML 规范 | 现在是 **WHATWG 的 Living Standard**（Google/Apple/Mozilla/Microsoft 主导），W3C 出的是快照版 |
| `lang` 属性有什么用 | 读屏器发音、翻译提示、拼写检查、CSS `:lang()` 选择器、SEO 地区判断 |
| 一个页面能有几个 `h1` | HTML5 允许有多个（sectioning 概念），但 SEO 实践中**建议一个主 h1** |

---

## 1.3 DOCTYPE 与三种渲染模式

**这是本册最重要的一节。** 题单的答案只有一句「不加会怪异模式，盒模型等行为不一致」——但面试官会问「**具体哪些行为不一致**」。

### 1.3.1 一句话回答

`<!DOCTYPE html>` 是**文档类型声明**（不是标签，不产生 DOM 节点）。它唯一的作用是告诉浏览器「**请用标准模式渲染**」。HTML5 之后它已经没有 DTD 引用了，退化成一个**纯粹的模式开关**。

### 1.3.2 为什么会有这个东西（历史）

```
1990s：浏览器各自为政
   Netscape 有 Netscape 的盒模型，IE 有 IE 的盒模型
   页面都是按各自浏览器的行为写的
        ↓
1999：W3C 出 HTML4，定义了「标准盒模型」
   但直接改会让几百万张老页面全崩
        ↓
于是引入 DOCTYPE 做「开关」：
   写了正确的 DOCTYPE → 按 W3C 标准渲染（Standards Mode）
   没写 / 写错         → 保持老行为（Quirks Mode，"怪异模式"）
        ↓
2014：HTML5
   DTD 那套东西没人用了，但「开关」必须留着
   于是规定：<!DOCTYPE html> 这个最短的字符串 = 标准模式
```

**一句话总结**：DOCTYPE 是**为了「向后兼容」而被迫保留的历史遗留物**。

### 1.3.3 三种模式（不是两种！）

很多人只知道「标准 / 怪异」，其实浏览器有**三种**：

| 模式 | 触发条件 | `document.compatMode` | 说明 |
|---|---|---|---|
| **标准模式**<br>Standards / No-Quirks | `<!DOCTYPE html>`；或 HTML4 Strict DTD | `"CSS1Compat"` | 完全按规范 |
| **准标准模式**<br>Almost Standards | HTML4 **Transitional** + 带 system identifier（URL）；XHTML 1.0 Transitional | `"CSS1Compat"` | **只在一个地方不同**（见下） |
| **怪异模式**<br>Quirks | 没有 DOCTYPE；或 DOCTYPE 写错；或 HTML3.2/4.0 之前的 DTD | `"BackCompat"` | 模拟老浏览器行为 |

> **JS 检测方法**：
> ```js
> document.compatMode   // "CSS1Compat" 标准/准标准 | "BackCompat" 怪异
> ```
> 注意：**它区分不了标准和准标准**（两者都是 `CSS1Compat`）。

**准标准模式唯一的差异**：**table 单元格内的 `line-height` 按怪异模式计算**。后果就是最经典的那个 bug——`<td><img></td>` 里图片**底部多出一条 3~5px 的缝**。

### 1.3.4 怪异模式到底改变了什么（★ 核心考点）

这是「能说清的人不到 1%」的部分。**记住 6 条**：

| # | 行为 | 标准模式 | 怪异模式 | 实际表现 |
|---|---|---|---|---|
| **1** | **盒模型** | `width` = content 宽度（`content-box`） | `width` = content + padding + border（等价 `border-box`） | 同一个 `width:100px; padding:10px` 的盒子：标准模式占 120px，怪异模式占 100px |
| **2** | **`html` / `body` 的百分比高度** | `height:100%` 需要父级有确定高度才生效 | 百分比高度**能一路传到视口** | 怪异模式下 `body{height:100%}` 直接满屏；标准模式要写 `html,body{height:100%}` |
| **3** | **table 内字体继承** | table 继承 body 的 `font-size` | table **不继承**，用浏览器默认（通常更小） | 一模一样的内容放进 table 字体突然变小 |
| **4** | **行内元素的垂直对齐** | 按基线 + `line-height` 计算 | 行为不同（图片底部空隙表现不同） | 图片下方莫名多一条缝 |
| **5** | **class / id 选择器大小写** | **区分**大小写 | **不区分** | `.Foo` 在怪异模式能匹配 `class="foo"` |
| **6** | **`body` 的默认 margin / 图片作为 inline 的基线** | 8px / 有基线间隙 | 表现不一致 | 页面莫名有边距 |

**面试时只说前 3 条就足够，能说出第 5 条（选择器大小写）说明你真读过规范。**

**验证代码**（现场能写出来会很加分）：

```html
<!-- 去掉下面这行，盒子会从 120px 变成 100px -->
<!DOCTYPE html>
<style>
  .box { width: 100px; padding: 10px; border: 5px solid; background: #ddd; }
</style>
<div class="box" id="b">x</div>
<script>
  console.log(document.compatMode);      // "CSS1Compat" / "BackCompat"
  console.log(document.getElementById('b').offsetWidth);  // 130 / 100
</script>
```

### 1.3.5 为什么 HTML5 的 DOCTYPE 可以这么短

```html
<!DOCTYPE html>
```

对比 HTML4：

```html
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN"
  "http://www.w3.org/TR/html4/strict.dtd">
```

三个原因：

| 原因 | 说明 |
|---|---|
| **DTD 已经没人用了** | 浏览器**从来不去真正下载 DTD**，只是用字符串模式匹配来判断模式。所以那串 URL 是纯装饰 |
| **只保留「开关」语义** | HTML5 把 DOCTYPE 定义为「一个必须出现在最前面的、内容为 `html` 关键字的声明」，大小写不敏感 |
| **为了好记好写** | 短到「不用查文档也能背下来」，减少写错导致的怪异模式 |

> **HTML5 允许的写法**：`<!DOCTYPE html>` / `<!doctype html>` / `<!DocType HTML>`（大小写不敏感），但**只认 `html` 这个关键字**，写别的（比如 `<!DOCTYPE html5>`）虽然是标准模式，但属于非规范写法。

### 1.3.6 web 标准是什么（另一半）

题 54 问「对 web 标准、标准模式、混杂模式的理解」，前两个词其实不是一回事：

| 概念 | 是什么 | 谁定的 |
|---|---|---|
| **Web 标准** | 一套「网页应该怎么写」的**规范体系**：结构（HTML）、表现（CSS）、行为（JS）三层分离 | W3C + WHATWG + ECMA + IETF |
| **标准模式** | 浏览器的一种**渲染模式**（由 DOCTYPE 决定） | 浏览器实现 |
| **混杂模式（怪异模式）** | 另一种渲染模式，模拟老浏览器 | 浏览器实现 |

**Web 标准的三层分离**：

```
结构 Structure  →  HTML    （语义、内容）
表现 Presentation →  CSS     （样式、布局）
行为 Behavior   →  JavaScript（交互、逻辑）
```

**为什么要三层分离**（不要只背「方便维护」）：

| 收益 | 具体说明 |
|---|---|
| **可访问性** | 结构干净的 HTML，读屏器才能正确朗读 |
| **可维护/可复用** | 换皮肤只改 CSS；同一份 HTML 可输出 Web/邮件/打印 |
| **渐进增强** | JS 挂了，内容和样式仍在（这是很多公司「禁用 JS 测试」的由来） |
| **SEO / 抓取** | 爬虫只看 HTML，不执行复杂 JS 时内容仍可读 |

### 1.3.7 面试怎么答

**30 秒版**

> `<!DOCTYPE html>` 是文档类型声明，不产生 DOM 节点。它唯一的作用是告诉浏览器用标准模式渲染。如果不写，浏览器会进怪异模式，最典型的表现就是盒模型退化——`width` 会包含 padding 和 border，同一个 100px 的盒子会变成 130px 和 100px 两种宽度。HTML5 之后 DTD 引用已经没用了，浏览器从来不会真的去下载它，所以 DOCTYPE 退化成了一个纯粹的模式开关。

**2 分钟版**

> 我分三层说：历史、机制、影响。
>
> **历史**上，90 年代 Netscape 和 IE 的盒模型不一致，页面都是按各自浏览器写的。W3C 出 HTML4 定标准盒模型时，为了不把老页面搞崩，就用 DOCTYPE 做了一个开关：写了正确 DOCTYPE 就按标准渲染，没写就保持老行为。这就留下了「标准模式」和「怪异模式」。
>
> **机制**上有三种模式，很多人只知道两种。标准模式、准标准模式、怪异模式。准标准模式只在**table 单元格的 line-height** 上和标准模式不同，后果就是 `td` 里放图片底部会多一条缝——这是当年非常经典的 bug。JS 可以用 `document.compatMode` 检测，`CSS1Compat` 是标准/准标准，`BackCompat` 是怪异。
>
> **影响**上，怪异模式最典型的是盒模型：`width` 会包含 padding 和 border，等价于 `border-box`。除此之外还有几个：`html/body` 的百分比高度可以直接传到视口，所以怪异模式下 `body{height:100%}` 直接满屏；table 不继承 body 的 font-size，字会变小；class 选择器不区分大小写。这几个能说出来，基本就能证明不是只背了一句「盒模型不一致」。
>
> 最后 HTML5 的 DOCTYPE 之所以能缩成 `<!DOCTYPE html>`，是因为浏览器从来不真的去下载 DTD，只是拿字符串做模式匹配，那个 URL 是纯装饰。所以 HTML5 干脆把它简化成最短的一个「标准模式开关」。

**追问表**

| 追问 | 回答要点 |
|---|---|
| DOCTYPE 是标签吗 | 不是，是**声明**，不产生 DOM 节点，`document.doctype` 能读到它 |
| HTML5 有几个 DOCTYPE | 只有 `<!DOCTYPE html>` 一个 |
| 浏览器会去下载 DTD 吗 | **不会**（老 IE 某些情况下会，现代浏览器都是字符串匹配） |
| 怪异模式影响哪些 | 盒模型、百分比高度、table 字体继承、行内垂直对齐、选择器大小写、图片基线空隙 |
| 怎么检测当前模式 | `document.compatMode` |
| 准标准模式和标准模式差在哪 | 只有 table cell 的 `line-height` 计算方式不同（图片底部空隙） |
| 为什么怪异模式叫 quirks | 英文原义「怪癖」，指浏览器保留的一堆非标准行为 |
| `<!DOCTYPE html>` 前面能有注释吗 | HTML5 规范要求 DOCTYPE 在最前，但现代浏览器能容忍前面的空白和注释；保险起见别写 |
| 为什么有些老项目去掉 DOCTYPE 就乱了 | 因为它依赖了怪异模式的盒模型（width 含 padding），去掉后布局数值全变 |

---

## 1.4 HTML 与 XHTML 的区别

### 1.4.1 一句话回答

**XHTML 是「用 XML 语法重写的 HTML」**——标签必须闭合、必须小写、必须正确嵌套、属性必须加引号、必须有根元素和命名空间。它最大的特点是**用 XML 解析器解析，一个错误就整个文档渲染失败**（而不是像 HTML 那样容错）。

### 1.4.2 逐条对比

| 维度 | HTML（HTML5） | XHTML |
|---|---|---|
| **语法严格度** | 宽松，容错 | 严格，XML 规则 |
| **标签闭合** | 空元素不闭合（`<br>`），非空元素可省略闭合（`<li>`） | **必须**闭合（`<br />`） |
| **标签大小写** | 不敏感（`<DIV>` 也行） | **必须小写** |
| **属性引号** | 可省略（`<input disabled>`） | **必须加引号** |
| **属性值** | 可省略值（`<input checked>`） | 必须 `checked="checked"` |
| **嵌套** | 容错（`<b><i></b></i>` 会被纠正） | **必须严格嵌套** |
| **根元素 / 命名空间** | 无要求 | 必须有 `xmlns="http://www.w3.org/1999/xhtml"` |
| **MIME 类型** | `text/html` | `application/xhtml+xml`（这是关键） |
| **解析器** | HTML 解析器 | **XML 解析器** |
| **出错表现** | 页面照常渲染 | **整个页面白屏 + 解析错误信息** |
| **`&` 转义** | 宽松 | `&` 必须写成 `&amp;`（否则解析错误） |
| **`<script>` 内容** | 直接写 | 需要 `//<![CDATA[ ... //]]>` 包裹 |

### 1.4.3 最关键的一条：MIME 类型决定解析器

```http
Content-Type: text/html              → 用 HTML 解析器（容错）
Content-Type: application/xhtml+xml  → 用 XML 解析器（严格）
```

**很多人不知道**：如果你只写了 XHTML 的 DOCTYPE 和语法，但**服务器返回 `text/html`**，浏览器**会用 HTML 解析器解析**——你的严格语法等于白写，页面照样容错。

> 这也是 XHTML 失败的核心原因之一：**部署麻烦**（要配 MIME）、**容错为零**（线上一个 `&` 就白屏）、**收益不明显**（严格语法对浏览器没有额外好处）。

### 1.4.4 XHTML 为什么失败了

| 原因 | 说明 |
|---|---|
| **容错为零** | 一个未转义的 `&`、一个没闭合的标签 → 整个页面白屏。生产环境不可接受 |
| **MIME 部署困难** | 要服务端配 `application/xhtml+xml`，还要处理 IE 不支持（IE 会当成文件下载） |
| **`document.write` 等 API 失效** | XML 解析器下 `document.write` 不可用 |
| **收益太小** | 严格语法对浏览器渲染没帮助，只是「作者舒服」 |
| **HTML5 出现了** | HTML5 直接定义了**两种序列化**：HTML 序列化和 XML 序列化（XHTML5），一份规范覆盖两边 |

### 1.4.5 现在的正确认知

```
HTML5 = 一套 DOM 语义规范
  ├── HTML 序列化（text/html）      ← 99.9% 的项目用这个
  └── XML 序列化（application/xhtml+xml）  ← 极少数场景（如需要 XML 工具链处理）

所以「HTML vs XHTML」这个对立已经过时了。
准确说法是：「同一套语义，两种写法。日常用 HTML 写法，需要 XML 生态时才用 XML 写法。」
```

### 1.4.6 面试怎么答

**30 秒版**

> XHTML 是用 XML 语法重写的 HTML，要求标签必须闭合、必须小写、必须严格嵌套、属性必须加引号。最本质的区别是**解析器不同**：XHTML 用 XML 解析器，一个语法错误整个页面就白屏；HTML 用容错解析器，写错也能渲染。而且 XHTML 只有在服务端返回 `application/xhtml+xml` 时才会真正走 XML 解析，返回 `text/html` 的话语法严格等于白写。这也是 XHTML 后来失败的主要原因——容错为零、部署麻烦、收益太小。

**2 分钟版**

> 我从「语法」「解析」「历史」三点讲。
>
> **语法上**，XHTML 比 HTML 严格得多：标签必须闭合（空元素写成 `<br />`）、标签名必须小写、属性必须加引号、属性值不能省略、必须严格嵌套、必须有 `xmlns` 命名空间、`&` 必须转义成 `&amp;`、`script` 内容要用 CDATA 包起来。
>
> **解析上**，这才是关键。XHTML 必须配合 `Content-Type: application/xhtml+xml` 才真的用 XML 解析器。如果服务器返回 `text/html`，浏览器会用 HTML 解析器——你的严格语法一点作用都没有。而一旦真的走 XML 解析，任何语法错误（比如少个转义的 `&`）会导致整个页面解析失败白屏，而且 IE 还会把 `application/xhtml+xml` 当成文件下载。
>
> **历史上**，XHTML 1.0 是 2000 年的产物，本意是让 HTML 走进 XML 生态（可以用 XSLT、可以用 XML 工具链）。但 Web 的现实是「容错优先」——每天有海量的不规范页面，严格解析等于自杀。所以 HTML5 走回容错路线，并且直接定义了两种序列化：HTML 序列化和 XML 序列化，用一套语义覆盖两边。现在说「HTML 和 XHTML 的区别」，其实是在说「同一套语义的两种写法」，对立已经不存在了。

**追问表**

| 追问 | 回答要点 |
|---|---|
| XHTML 必须自闭合吗 | 是，空元素必须 `<br />`；HTML5 里 `<br>` 和 `<br />` 都合法 |
| 只写 XHTML 语法，不配 MIME 有用吗 | 没用，`text/html` 下走 HTML 解析器 |
| 为什么 XHTML 会白屏 | XML 解析器不容错，遇到语法错误整个文档失败 |
| XHTML 里 `&` 怎么处理 | 必须写 `&amp;`，否则解析错误 |
| HTML5 还有 XHTML 吗 | 有，叫 XHTML5，是 HTML5 的 XML 序列化 |
| 现在还需要写 `xmlns` 吗 | 不需要，HTML 序列化下 `xmlns` 是可选的（写了也无害） |

---

## 1.5 空元素与 `<br>` / `<br/>`

### 1.5.1 一句话回答

**空元素（void element）是「不能有内容、也不能有闭合标签」的元素**，规范上一共 14 个。`<br>` 和 `<br />` 在 HTML5 里**等价**（尾部斜杠被允许，是为了兼容 XHTML 写法），但 **`<br></br>` 是错的**。

### 1.5.2 全部空元素（记住这张表）

| 元素 | 作用 |
|---|---|
| `area` | 图像热区 |
| `base` | 基准 URL |
| `br` | 换行 |
| `col` | 表格列属性 |
| `embed` | 嵌入外部内容 |
| `hr` | 分隔线 |
| `img` | 图片 |
| `input` | 表单控件 |
| `link` | 外部资源链接 |
| `meta` | 元信息 |
| `source` | 媒体资源（`video`/`audio`/`picture` 的子元素） |
| `track` | 字幕轨道 |
| `wbr` | 可换行点 |

**历史遗留的 `param`**（`<object>` 参数）已废弃。

> 记忆法：**这些元素「自带内容」或「只是占位指令」，不可能包住别的东西**。`img` 的内容是它自己加载的图片，`input` 的内容是用户输入，`br` 只是一个断行指令——它们都没有「子节点」这个概念。

### 1.5.3 三种写法的区别

| 写法 | HTML5 | XHTML | 浏览器行为 |
|---|---|---|---|
| `<br>` | ✅ 推荐 | ❌ 不合法 | 换行 |
| `<br />` | ✅ 合法（向后兼容） | ✅ 必须 | 换行（**斜杠被忽略**） |
| `<br></br>` | ❌ 不合法 | ❌ 不合法 | **浏览器会当成两个 `<br>`**（第二个被解析成多余的开始标签） |

**为什么 `<br></br>` 会变成两个换行**：

HTML5 解析器遇到 `</br>` 时，规范里有一条特殊的错误恢复规则：

> 如果一个 end tag 的标签名是 `br`，就当作「插入一个 `<br>` 开始标签」处理。

这是**历史上为了兼容**（早期有人写 `</br>` 想换行，浏览器就顺着他们了）。现在这个行为被写进规范了，所以 `<br></br>` = 两个换行。

### 1.5.4 为什么 HTML5 不允许闭合，却允许斜杠

```html
<!-- HTML5 规范说：void element 不能有 end tag，但允许一个 "/" 在 start tag 末尾 -->

<br>       ✅ 规范写法
<br />     ✅ 规范允许（"the solidus" 在 void element 上是被允许的）
<br></br>  ❌ 不允许（end tag 是非法的）
```

**目的**：让「**同时是合法 HTML5 和合法 XHTML**」的文档能写出来（叫 **polyglot markup**，多语言标记）。这类文档可以用同一个文件同时服务 HTML 解析器和 XML 解析器。

> 所以 `<br />` 不是「HTML 里也要求闭合」，而是「**HTML5 特意留了一个口子，让 XHTML 写法不至于报错**」。

### 1.5.5 顺带：`display` 和「空元素」没关系

容易混淆的三个概念：

| 概念 | 定义 | 例子 |
|---|---|---|
| **空元素（void）** | 规范层面：**不能有子节点** | `img`、`input`、`br` |
| **空内容元素** | 可以有子节点，但通常没内容 | `<div></div>`、`<span></span>` |
| **`display: none` 的元素** | 有子节点，但不渲染 | `<div hidden>` |

**空元素 ≠ 不可见元素**。`<img>` 有宽高、可见；`<div></div>` 是空内容但可能在 DOM 里。

### 1.5.6 面试怎么答

**30 秒版**

> 空元素是指不能有内容、也不能有闭合标签的元素，规范里一共 14 个，常用的有 `br`、`hr`、`img`、`input`、`link`、`meta`、`source`、`track`、`wbr`。`<br>` 和 `<br />` 在 HTML5 里是等价的，尾部斜杠是规范特意允许的，目的是让文档同时是合法 HTML 和合法 XHTML。但 `<br></br>` 是错的——因为 HTML5 里有个历史遗留的错误恢复规则，`</br>` 会被当成一个 `<br>` 插入，所以实际上会产生两个换行。

**追问表**

| 追问 | 回答要点 |
|---|---|
| 空元素有几个 | 14 个（`area base br col embed hr img input link meta source track wbr` + 已废弃的 `param`） |
| 为什么允许 `<br />` | 为了 polyglot markup，让同一份文档同时符合 HTML5 和 XHTML |
| `<br></br>` 为什么是两个换行 | HTML5 规范里 `</br>` 的错误恢复规则 = 插入一个 `<br>` |
| `img` 是空元素吗 | 是，所以不能写 `<img>fallback</img>`；替代文本用 `alt` |
| 空元素能加伪元素吗 | `::before`/`::after` 可以（它们是渲染层的，不是子节点），但 `input` 等 replaced element 上部分浏览器不支持 |
| `display:inline` 和空元素是一回事吗 | 不是，前者是 CSS 布局，后者是内容模型（能不能有子节点） |

---

## 1.6 速记卡

```
HTML 是什么
  HyperText Markup Language，标记语言不是编程语言
  HTML 说「这是什么」，CSS 说「长什么样」，JS 说「怎么动」
  解析：字节 → 字符 → Token → DOM 树
  ★ 解析容错（XML 不容错），这是 HTML 和 XML 最大区别
  规范维护方：WHATWG Living Standard（不再有版本号）

DOCTYPE
  <!DOCTYPE html>  不是标签，不产生 DOM 节点，只是「模式开关」
  三种模式：标准 / 准标准(almost standards) / 怪异(quirks)
  ★ 准标准只在 table cell 的 line-height 上不同 → 图片底部空隙
  document.compatMode: "CSS1Compat"(标准/准标准) | "BackCompat"(怪异)
  怪异模式 6 个影响：
    ① 盒模型 width 含 padding+border（等价 border-box）
    ② html/body 百分比高度直传视口
    ③ table 不继承 font-size
    ④ 行内元素垂直对齐不同
    ⑤ class/id 选择器不区分大小写
    ⑥ body 默认 margin / 图片基线空隙
  浏览器从不真正下载 DTD，URL 是装饰 → 所以 HTML5 能缩短

HTML vs XHTML
  XHTML = XML 语法的 HTML：必须闭合、小写、引号、严格嵌套、xmlns、&转义
  ★ 关键是 MIME：application/xhtml+xml 才走 XML 解析器
     返回 text/html → 语法严格等于白写
  XML 解析器零容错 → 一个错整个页面白屏（XHTML 失败主因）
  现在：HTML5 有 HTML 序列化 + XML 序列化（XHTML5），对立已消失

空元素（void）
  14 个：area base br col embed hr img input link meta source track wbr
  <br> ✅   <br /> ✅（兼容 XHTML 的 polyglot）   <br></br> ❌ → 变两个换行
  原因：HTML5 错误恢复规则把 </br> 当成 <br> 插入

web 标准
  结构 HTML / 表现 CSS / 行为 JS，三层分离
  收益：可访问性、可维护、渐进增强、可被爬虫读
```
