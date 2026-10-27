# HTML · 01 基础概念与文档结构

> 覆盖：什么是 HTML、DOCTYPE 与渲染模式、HTML vs XHTML、空元素与标签语法

---

## 目录

- [1.1 一句话结论](#11-一句话结论)
- [1.2 HTML 到底是什么](#12-html-到底是什么)
- [1.3 DOCTYPE 与三种渲染模式](#13-doctype-与三种渲染模式)
- [1.4 HTML 与 XHTML 的区别](#14-html-与-xhtml-的区别)
- [1.5 空元素与 `<br>` / `<br/>`](#15-空元素与-br--br)
- [1.6 速记卡](#16-速记卡)

---

## 1.1 一句话结论

HTML 是描述文档结构与语义的标记语言，浏览器把它解析成 DOM 树；`DOCTYPE` 不参与文档内容，只负责切换渲染模式；HTML5 之后只剩 `<!DOCTYPE html>` 这一种推荐写法，作用是让浏览器停留在标准模式。

---

## 1.2 HTML 到底是什么

### 1.2.1 一句话回答

**HTML = HyperText Markup Language（超文本标记语言），标记语言而非编程语言**：没有变量、分支、循环。它由元素、属性、文本三样东西组成。浏览器把 HTML 解析成 DOM 树，CSS 负责排版，JS 负责操作。

### 1.2.2 三个关键词

| 关键词 | 含义 |
|---|---|
| **HyperText 超文本** | 文档通过 `<a>` 互相跳转，不是线性阅读 |
| **Markup 标记** | 给内容加语义（标题、段落、导航），不描述样式；HTML 说「是什么」，CSS 说「长什么样」 |
| **Language 语言** | 声明式标记语言，没有控制流；只有元素、属性、文本 |

### 1.2.3 一个 HTML 文档的最小骨架

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>页面标题</title>
    <link rel="stylesheet" href="/app.css">
  </head>
  <body>
    <h1>标题</h1>
  </body>
</html>
```

| 部分 | 职责 | 关键点 |
|---|---|---|
| `<!DOCTYPE>` | 决定渲染模式 | 应写在文档最前；现代浏览器容忍前面的注释和空白（实测仍为标准模式） |
| `<html lang>` | 语言声明 | 影响读屏器发音、翻译提示、拼写检查、CSS `:lang()`；`lang` 与正文语言不符会触发翻译提示 |
| `<head>` | 元信息 | 不参与渲染，只为文档提供元信息；`link`/`style` 影响样式，`script` 可执行 |
| `<body>` | 可见内容 | 只能有一个；`</body>` 之后的内容会被解析器移回 `body` 内（实测） |

### 1.2.4 浏览器是怎么把字符串变成 DOM 的

```
字节流 (bytes)
   ↓ 按 HTTP 响应头 charset，其次 <meta charset> 解码
字符流 (characters)
   ↓ 词法分析（Tokenizer）
Token：StartTag / EndTag / Character / Comment / DOCTYPE
   ↓ 语法分析（Tree Construction）
DOM 节点 → DOM 树
```

| 行为 | 原因 |
|---|---|
| 标签写错也能渲染，不会报错白屏 | 规范定义了完整的错误恢复规则（如 `<table>` 内的非表格内容会被 foster parenting 移到 table 前） |
| `<script>` 会打断解析 | `document.write()` 能在解析中途插入内容，解析器必须停下执行脚本（详见 05 册） |

缺失 `<html>`、`<head>`、`<body>` 时解析器会自动补齐：`<title>`、`<meta>` 进 `head`，其余内容进 `body`（本机 Chrome 实测）。

### 1.2.5 面试怎么答

- HTML 是标记语言，不是编程语言；职责是给内容贴语义，样式交 CSS，行为交 JS。
- 解析链路：字节 → 字符 → Token → DOM 树，容错解析，错误标签不会白屏。
- 规范由 WHATWG 的 Living Standard 维护，没有版本号；W3C 发布的是快照。

| 追问 | 回答要点 |
|---|---|
| 一个页面能有几个 `h1` | 规范不限制数量；SEO 实践建议只有一个主 `h1` |

---

## 1.3 DOCTYPE 与三种渲染模式

### 1.3.1 一句话回答

`<!DOCTYPE html>` 是文档类型声明，不是标签。它不产生元素节点，但在 DOM 中是一个 `DocumentType` 节点：`document.doctype` 可读取，位于 `document.childNodes`，不在 `<html>` 子树内。它唯一的作用是让浏览器进入标准模式——HTML5 之后没有 DTD 引用，只剩模式开关。

### 1.3.2 为什么会有这个东西（历史）

- 1990s：Netscape 与 IE 各有一套盒模型，页面按各自浏览器的行为编写。
- 1999：W3C 发布 HTML4，定义标准盒模型；直接切换会让存量页面布局全变。
- 对策：用 DOCTYPE 做开关——写了按 W3C 标准渲染（Standards），没写或写错保持旧行为（Quirks）。
- 2014：HTML5 把开关固定为最短字符串 `<!DOCTYPE html>`。

结论：DOCTYPE 是为向后兼容而保留的历史遗留物。

### 1.3.3 三种模式

| 模式 | 触发条件 | `document.compatMode` |
|---|---|---|
| **标准模式**<br>Standards / No-Quirks | `<!DOCTYPE html>`；HTML4 Strict DTD | `"CSS1Compat"` |
| **准标准模式**<br>Almost Standards / Limited Quirks | HTML4 Transitional + system identifier；XHTML 1.0 Transitional | `"CSS1Compat"` |
| **怪异模式**<br>Quirks | 没有 DOCTYPE；DOCTYPE 写错；HTML 3.2/4.0 之前的 DTD | `"BackCompat"` |

`compatMode` 只能区分「怪异」与「非怪异」，区分不了标准与准标准。

准标准模式唯一的差异在 table 单元格的行高计算：标准模式按 `line-height` 计入行内盒，`<td><img>` 底部会多出空隙；准标准与怪异模式不计这段行高。本机 Chrome 实测同样结构 `td` 高度为标准 22px、怪异 10px。

### 1.3.4 怪异模式实际改变了什么

| # | 行为 | 标准模式 | 怪异模式 | 本机 Chrome 实测 |
|---|---|---|---|---|
| 1 | 盒模型 | `width` 为 content 宽度 | 历史上按 IE 语义把 padding/border 计入 `width` | `width:100px; padding:10px; border:5px` 下两模式 `offsetWidth` 均为 130px，未复现该差异 |
| 2 | `html`/`body` 百分比高度 | `height:100%` 需要父级有确定高度 | 百分比高度可一路解析到视口 | `body{height:100%}`：22px vs 600px |
| 3 | table 内字体继承 | table 继承 body 的 `font-size` | 使用浏览器默认字号 | body 20px → `td` 20px vs 16px |
| 4 | class/id 选择器大小写 | 区分大小写 | 不区分 | `.Foo` 匹配 `class="foo"`：不匹配 vs 匹配 |

图片作为 inline 元素产生的基线空隙，本质是 table 单元格的行高规则，见 1.3.3，不是独立的怪异模式差异。

### 1.3.5 为什么 HTML5 的 DOCTYPE 可以这么短

```html
<!DOCTYPE html>
```

对比 HTML4：

```html
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN"
  "http://www.w3.org/TR/html4/strict.dtd">
```

- 浏览器从不下载 DTD，只用字符串模式匹配判断模式，那串 URL 是装饰。
- HTML5 只保留开关语义：关键字 `html`，大小写不敏感。
- 写法短，减少写错导致的怪异模式。

关键字必须是 `html`：`<!doctype html>` 仍是标准模式；`<!DOCTYPE html5>` 会让 DOCTYPE 名称变成 `html5`，进入怪异模式（本机 Chrome 实测 `compatMode` 为 `"BackCompat"`）。

### 1.3.6 web 标准与渲染模式的区别

| 概念 | 是什么 | 谁定的 |
|---|---|---|
| **Web 标准** | 「网页应该怎么写」的规范体系：结构 HTML、表现 CSS、行为 JS 三层分离 | W3C + WHATWG + ECMA + IETF |
| **标准模式** | 浏览器的一种渲染模式，由 DOCTYPE 决定 | 浏览器实现 |
| **怪异模式** | 另一种渲染模式，模拟老浏览器行为 | 浏览器实现 |

三层分离的收益：

| 收益 | 具体说明 |
|---|---|
| 可访问性 | 结构干净的 HTML，读屏器才能正确朗读 |
| 可维护 / 可复用 | 换皮肤只改 CSS；同一份 HTML 可输出 Web / 邮件 / 打印 |
| 渐进增强 | JS 失效时内容和样式仍在，这也是「禁用 JS 测试」的来源 |
| SEO / 抓取 | 爬虫依赖 HTML 内容，不执行复杂 JS 时仍可读取 |

### 1.3.7 面试怎么答

- `<!DOCTYPE html>` 是声明不是标签：不产生元素节点，但 `document.doctype` 能读到 `DocumentType` 节点。
- 作用只有一个：进入标准模式；缺失、写错、名称不是 `html` 都会进入怪异模式。
- 怪异模式可实测的差异：百分比高度直达视口、table 不继承字号、class/id 选择器大小写不敏感；盒模型差异来自旧 IE，Chrome 未复现。
- HTML5 缩成最短写法，是因为浏览器只做字符串匹配，从不下载 DTD。

| 追问 | 回答要点 |
|---|---|
| 为什么怪异模式叫 quirks | 英文原义「怪癖」，指浏览器保留的一批非标准行为 |
| 为什么老项目去掉 DOCTYPE 就乱 | 它依赖了怪异模式下的布局计算（百分比高度、table 字号继承等），切到标准模式数值全变 |

---

## 1.4 HTML 与 XHTML 的区别

### 1.4.1 一句话回答

**XHTML 是用 XML 语法重写的 HTML**：标签必须闭合、必须小写、必须正确嵌套，属性必须加引号，必须有根元素和命名空间。本质差别在解析器——MIME 为 `application/xhtml+xml` 时用 XML 解析器，一个语法错误整篇渲染失败；HTML 解析器则容错。

### 1.4.2 逐条对比

| 维度 | HTML（HTML5） | XHTML |
|---|---|---|
| 语法严格度 | 宽松，容错 | 严格，遵循 XML 规则 |
| 标签闭合 | 空元素不闭合（`<br>`），部分非空元素可省略闭合标签（`<li>`） | 必须闭合（`<br />`） |
| 标签大小写 | 不敏感（`<DIV>` 合法） | 必须小写 |
| 属性引号与值 | 引号可省略，值可省略（`<input checked>`） | 引号必须加，值不能省略（`checked="checked"`） |
| 嵌套 | 容错（`<b><i></b></i>` 会被纠正） | 必须严格嵌套 |
| 根元素 / 命名空间 | 无要求 | 必须有 `xmlns="http://www.w3.org/1999/xhtml"` |
| MIME 类型 | `text/html` | `application/xhtml+xml` |
| 解析器 | HTML 解析器 | XML 解析器 |
| 出错表现 | 页面照常渲染 | 整个页面白屏 + 解析错误信息 |
| `&` 转义 | 宽松 | 必须写成 `&amp;` |
| `<script>` 内容 | 直接写 | 需要 `//<![CDATA[ ... //]]>` 包裹 |

### 1.4.3 最关键的一条：MIME 类型决定解析器

```http
Content-Type: text/html              → HTML 解析器（容错）
Content-Type: application/xhtml+xml  → XML 解析器（严格）
```

只写 XHTML 的 DOCTYPE 和语法、但服务器返回 `text/html`，浏览器仍用 HTML 解析器，严格语法不起作用。

### 1.4.4 XHTML 为什么失败了

- 容错为零：一个未转义的 `&`、一个没闭合的标签就让整页白屏，生产环境不可接受。
- MIME 部署困难：服务端要配 `application/xhtml+xml`，旧 IE 还会把它当文件下载。
- `document.write` 在 XML 解析器下不可用。
- 收益小：严格语法对浏览器渲染没有帮助。
- HTML5 同时定义了 HTML 序列化与 XML 序列化（XHTML5），一份规范覆盖两边。

### 1.4.5 现在的正确认知

HTML5 是一套 DOM 语义规范，配两种序列化：`text/html`（绝大多数站点）与 `application/xhtml+xml`（需要 XML 工具链时）。「HTML vs XHTML」的对立已经过时，准确说法是同一套语义的两种写法。

### 1.4.6 面试怎么答

- XHTML 用 XML 语法：必须闭合、小写、加引号、严格嵌套、带 `xmlns`、`&` 转义。
- 决定行为的是 MIME：`application/xhtml+xml` 才真正走 XML 解析器，`text/html` 下严格语法无效。
- XHTML 失败的原因：零容错、部署麻烦、收益小。
- 现状：HTML5 同时提供 HTML 与 XML 两种序列化。

| 追问 | 回答要点 |
|---|---|
| 现在还需要写 `xmlns` 吗 | HTML 序列化下可选，写了也无害；XML 序列化下必须有 |

---

## 1.5 空元素与 `<br>` / `<br/>`

### 1.5.1 一句话回答

**空元素（void element）不能有内容，也没有闭合标签**，规范里共 13 个。`<br>` 与 `<br />` 在 HTML5 中等价，尾部斜杠合法是为了兼容 XHTML 写法；`<br></br>` 不合法，会被解析成两个 `<br>`。

### 1.5.2 全部空元素

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

`param`（`<object>` 参数）已废弃；把它算上才是历史常说的 14 个。

共同点：都不能有子节点——内容由元素自身加载（`img`）或用户输入（`input`）提供，`br` 只是断行指令。

### 1.5.3 三种写法的区别

| 写法 | HTML5 | XHTML | 浏览器行为 |
|---|---|---|---|
| `<br>` | 推荐 | 不合法 | 换行 |
| `<br />` | 合法（向后兼容） | 必须 | 换行（斜杠被忽略） |
| `<br></br>` | 不合法 | 不合法 | 解析成两个 `<br>` |

`</br>` 会变成两个换行，原因是 HTML5 解析器的错误恢复规则：

> 如果 end tag 的标签名是 `br`，就当作「插入一个 `<br>` 开始标签」处理。

本机 Chrome 实测 `<body><p>a<br></br>b</p></body>` 产生 2 个 `br` 元素。

### 1.5.4 为什么 HTML5 不允许闭合，却允许斜杠

为了让同一份文档同时是合法 HTML5 和合法 XHTML（polyglot markup），用同一个文件服务 HTML 解析器和 XML 解析器。斜杠不是 HTML 的闭合要求，而是规范为 XHTML 写法留的口子。

### 1.5.5 `display` 与「空元素」无关

| 概念 | 定义 | 例子 |
|---|---|---|
| **空元素（void）** | 规范层面：不能有子节点 | `img`、`input`、`br` |
| **空内容元素** | 可以有子节点，只是当前没有内容 | `<div></div>`、`<span></span>` |
| **`display: none` 的元素** | 有子节点，但不渲染 | `<div hidden>` |

空元素 ≠ 不可见元素：`<img>` 有宽高、可见；`<div></div>` 内容为空，仍在 DOM 中。

### 1.5.6 面试怎么答

- 空元素不能有内容和闭合标签，规范里共 13 个（`area base br col embed hr img input link meta source track wbr`）。
- `<br>` 与 `<br />` 等价，斜杠是为了让文档同时符合 HTML5 和 XHTML。
- `<br></br>` 会产生两个换行，因为 `</br>` 的错误恢复规则等价于插入 `<br>`。
- 空元素是内容模型概念，与 `display` 无关；`img` 是空元素，替代文本用 `alt`。

---

## 1.6 速记卡

```
HTML
  标记语言不是编程语言；元素 + 属性 + 文本
  解析：字节 → 字符 → Token → DOM 树；容错，不白屏
  缺 html/head/body 时解析器自动补齐；</body> 后的内容移入 body
  规范：WHATWG Living Standard

DOCTYPE
  声明，不是标签；不是元素节点，但 document.doctype 是 DocumentType 节点
  <!DOCTYPE html> → 标准；缺失 / 写错 / 名称不是 html → 怪异
  三种模式：标准 / 准标准 / 怪异；compatMode 只区分是否怪异
  准标准差异：table 单元格行高（<td><img> 底部空隙）
  怪异实测：body 百分比高度直达视口、table 不继承字号、class/id 选择器大小写不敏感
  浏览器从不下载 DTD，只做字符串匹配 → HTML5 能用最短 DOCTYPE

HTML vs XHTML
  XHTML：必须闭合、小写、加引号、严格嵌套、xmlns、& 转义
  MIME 决定解析器：application/xhtml+xml 才走 XML（text/html 下严格语法无效）
  XML 零容错 → 一个错误整篇白屏；HTML5 有 HTML / XML 两种序列化

空元素（13 个）
  area base br col embed hr img input link meta source track wbr
  <br> 合法   <br /> 合法（polyglot）   <br></br> 非法 → 两个 br
```
