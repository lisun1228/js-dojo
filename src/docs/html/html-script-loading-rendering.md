# HTML · 05 脚本加载与渲染链路

> 覆盖：`defer` 与 `async`、输入 URL 到页面展示、重绘与回流、浏览器渲染优化

---

## 目录

- [5.1 一句话结论](#51-一句话结论)
- [5.2 `defer` 与 `async`](#52-defer-与-async)
- [5.3 补充：`defer` 和「把脚本放 body 末尾」有什么区别](#53-补充defer-和把脚本放-body-末尾有什么区别)
- [5.4 从输入 URL 到页面展示](#54-从输入-url-到页面展示)
- [5.5 重绘与回流](#55-重绘与回流)
- [5.6 浏览器渲染优化与合成层](#56-浏览器渲染优化与合成层)
- [5.7 速记卡](#57-速记卡)

---

## 5.1 一句话结论

**浏览器主线程是「单线程 + 渲染流水线」**：HTML 解析、CSS 计算、布局、绘制、JS 执行，全在一个线程上排队。`defer`/`async` 的所有细节、重绘回流的所有优化手段，都在解决同一个问题——**别让某个环节把主线程堵住**。

---

## 5.2 `defer` 与 `async`

### 5.2.1 一句话回答

| 模式 | 下载 | 执行时机 | 执行顺序 | 与 `DOMContentLoaded` |
|---|---|---|---|---|
| **普通 `<script>`** | **阻塞解析**（停下解析去下载） | 下载完**立刻**执行 | 按文档顺序 | **在它之前**（必须等它执行完） |
| **`defer`** | **并行下载，不阻塞解析** | **HTML 解析完之后** | **严格按文档顺序** | **在它之前**（等所有 defer 执行完才触发） |
| **`async`** | **并行下载，不阻塞解析** | **下载完立刻执行**（此时可能还在解析） | **不保证顺序** | **不确定**（可能之前也可能之后） |
| **`type="module"`** | 并行下载，不阻塞解析 | 解析完之后（**默认就是 defer 行为**） | 按文档顺序 | 之前（DCL 等模块执行完） |

### 5.2.2 时间线图

```
普通 script
解析 HTML ──┬── 停下 ──[下载 JS]──[执行 JS]──┬── 继续解析 ──→ DOMContentLoaded
             ↑                                │
             └────────── 解析被完全阻塞 ───────┘

async
解析 HTML ─────────────────────────────────────────→ DOMContentLoaded → load（等 async 执行完）
              ↓ 并行下载
           [下载完就执行]  ← 随时可能打断解析，位置不确定

defer
解析 HTML ──────────────────────────────→ 解析完
              ↓ 并行下载                    ↓
                                      按顺序执行所有 defer
                                             ↓
                                      DOMContentLoaded → load
```

### 5.2.3 为什么 `<script>` 会阻塞解析

| # | 原因 | 说明 |
|---|---|---|
| ① | `document.write()` 能在**解析中途**往字符流里插入 HTML | 解析器必须等脚本执行完，否则插入的内容位置就错了 |
| ② | 脚本可能操作 DOM（如 `getElementById`） | 必须保证脚本之前的 DOM 已经建好，所以脚本按文档顺序执行 |
| ③ | 脚本可能读取样式（`getComputedStyle` 等） | CSSOM 未就绪时脚本要等样式表，即「CSS 阻塞 JS」 |

> **「CSS 阻塞 JS」的准确表述**：`<link rel="stylesheet">` 后面的 `<script>`，必须等 CSS 下载并解析完（CSSOM 构建完）才能执行，因为脚本可能依赖样式信息。

### 5.2.4 三个必须知道的细节

**① 内联脚本的 `defer` / `async` 无效**

```html
<!-- ❌ defer 对内联脚本完全无效，解析到就执行 -->
<script defer>console.log('inline')</script>

<!-- ✅ 只对外部脚本有效 -->
<script defer src="/app.js"></script>
```

**原因**：`defer`/`async` 的意义是「**下载**不阻塞解析」，内联脚本没有下载过程，无从延迟。

**② 动态创建的 script 默认是 `async`**

```js
const s = document.createElement('script');
s.async = false;    // 必须在插入前设置；插入后再改无效
s.src = '/lazy.js';
document.head.appendChild(s);
```

动态插入的脚本 `async` 默认为 `true`，多个脚本按下载完成先后执行。`async = false` 让它们按插入顺序执行，但这个标志在插入时确定：先 `appendChild` 再设 `async = false`，属性虽然读回 `false`，执行顺序仍按下载完成先后（Chrome 实测）。

**③ `defer` 和 `async` 同时写**

```html
<script defer async src="/a.js"></script>
```

**`async` 优先**。这个组合是历史上的兼容写法：老浏览器不认 `async` 会退化成 `defer`。

### 5.2.5 `type="module"` 与 `defer` 的关系

```html
<script type="module" src="/main.js"></script>
<!-- 等价于（defer 是多余的） -->
<script type="module" defer src="/main.js"></script>
```

`type="module"` 默认按 defer 处理；此外还有 5 个特性：

| 特性 | 说明 |
|---|---|
| **严格模式** | 模块内自动 `'use strict'` |
| **只执行一次** | 同一个模块被多处 import 也只执行一次（模块缓存） |
| **CORS 限制** | 跨域加载模块必须带 CORS 头 |
| **独立作用域** | 顶层变量不挂到 `window` |
| **支持 `import` / `export`** | 静态分析、tree-shaking 的基础 |

```html
<!-- module 也可以 async：下载完立刻执行，不等解析完 -->
<script type="module" async src="/widget.js"></script>
```

**`modulepreload`**：预加载模块及其整个依赖图，比 `preload` 更适合 ES module。

### 5.2.6 该用哪个（工程实践）

| 场景 | 选择 | 理由 |
|---|---|---|
| **现代 SPA 的入口 JS** | `<script type="module" src="/main.js">` | 默认 defer、支持 import、构建工具产物 |
| **需要独立统计/广告/客服脚本** | `async` | 互不依赖、不阻塞、越早跑越好 |
| **有依赖顺序的多个脚本**（老项目） | `defer` | 保序，且在 DOMContentLoaded 前执行 |
| **必须在解析早期执行的**（如打点、AB 分流） | 内联脚本放 `head` | 但要小心阻塞，代码要极短 |
| **完全独立的小工具**（图片放大、代码高亮） | `async` 或动态插入 | 出错也不影响主流程 |

### 5.2.7 口述要点

- **阻塞的根因**：解析器无法预判脚本副作用——`document.write` 会改字符流、脚本会读 DOM、也会读样式；所以脚本执行前必须等前面的 DOM 建好，有未加载的 CSS 还要等 CSSOM。
- **执行时机**：`defer` 与 `async` 都并行下载；`defer` 解析完才按文档顺序执行，因此排在 `DOMContentLoaded` 之前；`async` 下载完立即执行，不保序，与 `DOMContentLoaded` 的先后不确定。
- **模块**：`type="module"` 默认 defer，`DOMContentLoaded` 会等它；加 `async` 才脱离这个约束。
- **边界**：内联脚本的 `defer`/`async` 无效；动态插入的脚本默认 async，保序必须在插入前设 `async = false`。
- **选择**：入口用 module，独立第三方脚本用 async，有依赖的老脚本用 defer。

---

## 5.3 补充：`defer` 和「把脚本放 body 末尾」有什么区别

| 对比 | `<script defer>` 放 `head` | `<script>` 放 `body` 末尾 |
|---|---|---|
| **下载开始时间** | **解析到 head 时立刻开始**（最早） | 要解析到 body 末尾才开始 |
| **是否阻塞解析** | ❌ 不阻塞 | ✅ 此时解析已经基本完成，阻塞影响小 |
| **执行顺序** | 保序 | 保序 |
| **首次渲染** | 不阻塞首屏渲染 | 不阻塞首屏渲染 |
| **总结** | **下载更早** | 兼容性更好（老浏览器） |

**结论**：`defer` 的下载从解析到该标签时开始，body 末尾的脚本要等解析走到文末；两者执行时前面的 DOM 都已就绪，主要差别是下载起点。

> 内联脚本不能用 `defer`；如果内联脚本必须操作 DOM，放 body 末尾仍然是最简单的做法。

---

## 5.4 从输入 URL 到页面展示

这条链路把网络与渲染串起来，按 8 个阶段拆解，最后是 `DOMContentLoaded` 与 `load`。

### 5.4.1 一句话回答

**八步：URL 解析 → 缓存查找 → DNS 解析 → TCP 连接 → TLS 握手 → HTTP 请求响应 → 解析构建 DOM/CSSOM → 布局绘制合成。**

### 5.4.2 完整链路（8 个阶段 + 后续）

```
┌─ ① URL 处理 ──────────────────────────────────────────────────┐
│  补全协议、路径；判断是搜索词还是 URL；HSTS 强制 https；         │
│  检查是否被安全策略（CSP / 混合内容）拦截                        │
└───────────────────────────┬───────────────────────────────────┘
                            ↓
┌─ ② 缓存查找 ──────────────────────────────────────────────────┐
│  Service Worker → Memory Cache → Disk Cache → HTTP 缓存判定      │
│  命中强缓存 → 直接用（不发请求）                                 │
└───────────────────────────┬───────────────────────────────────┘
                            ↓
┌─ ③ DNS 解析 ──────────────────────────────────────────────────┐
│  浏览器 DNS 缓存 → OS 缓存 → hosts → 本地 DNS 服务器            │
│  本地 DNS：递归查询（帮你跑腿）                                  │
│  根 → 顶级(.com) → 权威 → 得到 IP                               │
│  （这一段是迭代查询：本地 DNS 逐个问）                            │
└───────────────────────────┬───────────────────────────────────┘
                            ↓
┌─ ④ TCP 连接 ──────────────────────────────────────────────────┐
│  三次握手：SYN → SYN+ACK → ACK                                  │
│  （HTTP/3 则走 QUIC over UDP，1-RTT 或 0-RTT）                  │
└───────────────────────────┬───────────────────────────────────┘
                            ↓
┌─ ⑤ TLS 握手（https） ─────────────────────────────────────────┐
│  TLS 1.2：2-RTT（ClientHello → ServerHello+证书 → 密钥交换 → Finished）│
│  TLS 1.3：1-RTT（只保留 ECDHE）                                 │
│  验证证书链：域名 / 有效期 / 签发链 / 吊销状态                    │
│  协商出对称密钥 → 之后全程对称加密                                │
└───────────────────────────┬───────────────────────────────────┘
                            ↓
┌─ ⑥ HTTP 请求与响应 ───────────────────────────────────────────┐
│  请求行 + 请求头 + 请求体                                        │
│  可能经历：301/302 重定向、304 协商缓存命中                       │
│  响应：状态行 + 响应头 + 响应体（HTML 字节流）                    │
└───────────────────────────┬───────────────────────────────────┘
                            ↓
┌─ ⑦ 解析与构建 ────────────────────────────────────────────────┐
│  HTML：字节 → 字符（charset）→ Token（词法）→ 节点 → DOM 树      │
│  CSS ：字节 → CSSOM 树                                          │
│  遇到 <script> → 阻塞（除非 defer/async）                        │
│  预加载扫描器并行发现 img/script/link，提前发请求                 │
└───────────────────────────┬───────────────────────────────────┘
                            ↓
┌─ ⑧ 渲染 ──────────────────────────────────────────────────────┐
│  Render Tree（DOM + CSSOM，排除 display:none / head / script）  │
│       ↓                                                        │
│  Layout / 回流（算每个盒子的几何位置和大小）                      │
│       ↓                                                        │
│  Paint / 重绘（生成绘制指令，按层记录）                           │
│       ↓                                                        │
│  Composite / 合成（合成线程把图层拼成最终画面，GPU 加速）          │
└───────────────────────────┬───────────────────────────────────┘
                            ↓
┌─ ⑨ 后续 ──────────────────────────────────────────────────────┐
│  DOMContentLoaded（DOM 就绪，且所有 defer/module 执行完）        │
│  async 脚本（可能在 DCL 前或后）、图片解码、iframe 加载            │
│  load（页面与所有资源就绪）                                      │
└───────────────────────────────────────────────────────────────┘
```

### 5.4.3 每个阶段的高频追问

| 阶段 | 常见追问 | 回答要点 |
|---|---|---|
| **URL 处理** | 浏览器怎么判断输入的是 URL 还是搜索词 | 有协议/有域名特征/有端口 → 当 URL；否则交给默认搜索引擎 |
| | HSTS 是什么 | 服务端通过 `Strict-Transport-Security` 头告诉浏览器「以后只用 https」，之后浏览器**本地**就把 http 改成 https，不发那次明文请求。首次访问无效（TOFU） |
| **缓存** | 缓存优先级 | Service Worker > Memory Cache > Disk Cache > HTTP 缓存（强缓存/协商缓存） |
| | 强缓存和协商缓存怎么判定 | `Cache-Control` / `Expires` 命中就不发请求；否则带 `If-None-Match` / `If-Modified-Since` 问服务端，未变返回 304 |
| **DNS** | 递归 vs 迭代 | **客户端 → 本地 DNS 是递归**（本地 DNS 负责跑完全程）；**本地 DNS → 各级 DNS 是迭代**（逐个去问） |
| | DNS 预解析 | `<link rel="dns-prefetch">` / `preconnect` |
| | 为什么要 CDN + DNS 调度 | CDN 通过 DNS 返回**离用户最近**的节点 IP |
| **TCP** | 为什么三次握手 | 确认双方收发能力 + 同步初始序号 + 防历史连接 |
| | HTTP/3 为什么用 UDP | 绕开 TCP 层队头阻塞，QUIC 自己在用户态实现可靠传输 |
| **TLS** | 为什么用混合加密 | 非对称只用来协商/验证，数据用对称（性能差几个数量级） |
| | TLS 1.3 为什么能 1-RTT | 删掉了多余往返，只保留 ECDHE，客户端在 ClientHello 就带上 key share |
| | 证书怎么验证 | 域名匹配 → 有效期 → 用上级 CA 公钥验签 → 一路到根证书（在系统信任库里） |
| **HTTP** | 301 / 302 区别 | 301 永久（会被缓存），302 临时；SEO 上 301 传递权重 |
| | 为什么 `index.html` 不能强缓存 | 否则发版后用户还加载旧的 JS/CSS 引用，白屏 |
| **解析** | DOM 和 CSSOM 能并行吗 | 能，HTML 解析和 CSS 解析是不同任务；但**脚本执行要等 CSSOM** |
| | 预加载扫描器是什么 | 独立轻量扫描器，提前扫出 `img`/`script`/`link` 并发起请求 |
| **渲染** | Render Tree 排除了什么 | `display:none` 的元素、`head`、`script`、`meta`；`visibility:hidden` **仍在**树里（占位） |
| | 回流和重绘的区别 | 见 5.5 |
| | 合成层是什么 | 见 5.6 |

### 5.4.4 口述要点

- **八步**：URL 解析与 HSTS → 缓存查找 → DNS → TCP → TLS → HTTP → 解析构建 DOM/CSSOM → Render Tree / Layout / Paint / Composite。
- **DNS**：客户端到本地 DNS 是递归；本地 DNS 到根、顶级、权威是迭代；CDN 通过 DNS 返回最近节点。
- **连接**：TCP 三次握手确认双向可达并同步初始序号；HTTPS 再加 TLS 握手，1.3 为 1-RTT，证书链逐级验签到根证书。
- **渲染**：DOM 与 CSSOM 并行构建，但脚本执行要等 CSSOM；Render Tree 排除 `display:none`、`head`、`script`，`visibility:hidden` 保留，之后 Layout → Paint → Composite。
- **收尾**：`DOMContentLoaded` 在 DOM 就绪且 defer/module 执行完后触发，`load` 再等图片、iframe、async 脚本等资源。

| 追问 | 回答要点 |
|---|---|
| TLS 握手在第几次 TCP 之后 | TCP 建立之后（TLS over TCP） |
| HTTP/2 的连接复用 | 一个 TCP 连接上跑多个 stream，减少握手次数 |
| Render Tree 和 DOM 树的区别 | Render Tree 只含**需要渲染**的节点，且一个元素可能对应多个 RenderObject（如 `::before`） |
| 首屏白屏时间怎么优化 | 减小 HTML、内联关键 CSS、SSR/预渲染、骨架屏、preconnect、减少阻塞脚本 |
| 什么是关键渲染路径（CRP） | 从收到 HTML 到首屏像素上屏的链路：HTML → DOM → CSSOM → Render Tree → Layout → Paint |

---

## 5.5 重绘与回流

### 5.5.1 一句话回答

| | 回流（Reflow / Layout） | 重绘（Repaint） |
|---|---|---|
| **触发原因** | **几何属性变化**（尺寸、位置、显隐） | **外观属性变化**（颜色、背景、阴影、可见性） |
| **代价** | **高**（要重新计算整棵或部分树的布局） | 中（重新生成绘制指令） |
| **关系** | **回流一定会引起重绘** | **重绘不一定引起回流** |
| **例子** | 改 `width`/`height`/`margin`/`padding`/`font-size`、增删 DOM、改窗口大小 | 改 `color`/`background-color`/`visibility`/`box-shadow` |

### 5.5.2 会触发回流的操作清单

| 类别 | 具体操作 |
|---|---|
| **几何属性** | `width` `height` `padding` `margin` `border` `top/left/right/bottom` `font-size` `line-height` `letter-spacing` |
| **DOM 结构** | 增删节点、`innerHTML`、`textContent`（内容改变导致尺寸变） |
| **内容变化** | 图片加载完成（原来没写宽高）、字体加载完成（FOUT 引起尺寸变） |
| **窗口** | `resize`、`scroll`（滚动不一定回流，但滚动事件里读几何属性会强制回流） |
| **读取几何属性（★ 强制同步布局）** | `offsetWidth/Height/Top/Left`、`clientWidth/...`、`scrollWidth/...`、`getBoundingClientRect()`、`getComputedStyle()`、`scrollIntoView()` |
| **样式表操作** | 改变 `class`（如果影响了布局）、`display` 切换 |
| **伪类** | `:hover` 如果改了几何属性 |

**读写交错会触发强制同步布局**：

```js
// ❌ 布局抖动（layout thrashing）：读 → 写 → 读 → 写，每次都强制同步布局
for (let i = 0; i < 100; i++) {
  el.style.width = el.offsetWidth + 1 + 'px';   // 读一次强制回流，写一次，再读又强制回流
}
// 100 次循环 = 200 次布局计算
```

```js
// ✅ 读写分离：批量读 → 批量写
const widths = [];
for (let i = 0; i < 100; i++) widths.push(items[i].offsetWidth);   // 只读
for (let i = 0; i < 100; i++) items[i].style.width = widths[i] + 1 + 'px';  // 只写
```

**为什么「读几何属性」会强制回流**：浏览器本来会把多次样式修改**攒起来**，等到下一帧统一计算。但如果你**立刻读**一个几何属性，浏览器必须**马上把攒的修改都算出来**才能给你准确值——这就叫「**强制同步布局（forced synchronous layout）**」。

### 5.5.3 浏览器的渲染队列机制

```
JS 修改了 3 个元素的 width
   ↓
浏览器不当场回流，而是标记「dirty」，放进渲染队列
   ↓
同一帧内的多次修改合并成一次计算
   ↓
下一次 requestAnimationFrame / 帧刷新时统一 Layout → Paint → Composite
```

**这就是为什么「连续改 100 次样式」不会回流 100 次**——但**中间插入一次「读」，就会被打断**。

### 5.5.4 减少回流的 8 个手段

| # | 手段 | 原理 |
|---|---|---|
| **1** | **用 `transform` / `opacity` 做动画** | 这两个属性可以**只走合成（composite）**，跳过 Layout 和 Paint。这是最有效的手段 |
| **2** | **批量修改：切 `class` 而不是逐条改 `style`** | 一次样式重算 |
| **3** | **`DocumentFragment` / 离线 DOM 批量插入** | 在内存里拼好再一次性插入 |
| **4** | **先 `display:none` 再改，改完再显示** | 元素不在渲染树里时修改不触发回流（代价是两次回流，只适合大量修改） |
| **5** | **读写分离**（避免强制同步布局） | 见 5.5.2 |
| **6** | **图片/iframe 写死 `width`/`height`** | 加载完成不引起布局变化（同时防 CLS） |
| **7** | **用 `will-change` / `translateZ(0)` 提升为合成层** | 让动画元素独立成层，不影响其它元素（但有内存代价，见 5.6） |
| **8** | **避免 `table` 布局** | table 的布局算法是「内容驱动」的，一个单元格变化可能引发整表重算 |

```js
// 例：一次点击要改 5 个元素的样式
// ❌ 5 次样式重算
a.style.width = '100px';
a.style.height = '100px';
a.style.margin = '10px';
// ...

// ✅ 1 次（切 class）
a.classList.add('expanded');

// ✅ 或者用 cssText 一次写
a.style.cssText = 'width:100px;height:100px;margin:10px';
```

### 5.5.5 口述要点

- **区别**：回流改几何（重新算布局），重绘改外观（重新生成绘制指令）；回流必带重绘，重绘不一定回流。
- **触发**：改宽高/margin/字体、增删 DOM、resize、图片或字体加载完成；读取 `offsetWidth`、`getBoundingClientRect`、`getComputedStyle` 会强制同步布局，读写交错就形成布局抖动。
- **优化**：动画用 `transform`/`opacity` 只走合成；其余手段见 5.5.4：切 class、`DocumentFragment` 批量插入、`display:none` 期间修改、读写分离、图片写死宽高、避免 table 布局。

| 追问 | 回答要点 |
|---|---|
| `visibility:hidden` 和 `display:none` | 前者只重绘（仍占位、仍在渲染树）；后者回流（脱离渲染树） |
| 为什么读 `offsetWidth` 会回流 | 浏览器必须立刻算完排队的样式修改才能返回准确几何值 |
| 为什么 table 布局慢 | 内容驱动的布局算法，一个单元格变化可能整表重算 |

---

## 5.6 浏览器渲染优化与合成层

### 5.6.1 一句话回答

浏览器渲染优化的核心是**「按帧预算分配工作」**：每帧 16.7ms（60fps），主线程要在这个时间内完成 JS → 样式 → 布局 → 绘制，任何一环超时就会掉帧。优化的方向只有三个：**减少主线程工作量、把工作挪到别的线程、把工作交给 GPU（合成层）**。

### 5.6.2 渲染流水线的四个阶段与「哪些能跳过」

```
JS / CSS 修改
    ↓
① Style（重新计算样式）       ← 改 class / 内联样式必过
    ↓
② Layout（布局/回流）         ← 只改颜色可以跳过
    ↓
③ Paint（绘制/生成绘制指令）   ← 只改 transform/opacity 可以跳过
    ↓
④ Composite（合成）           ← 永远要走
```

| 你改的属性 | 经过哪些阶段 | 代价 |
|---|---|---|
| `width` / `top` / `margin` | ①Style ②Layout ③Paint ④Composite | **最贵** |
| `background-color` / `color` | ①Style ③Paint ④Composite | 中 |
| **`transform` / `opacity`** | ①Style ④Composite | **最便宜** |
| `filter` / `backdrop-filter` | ①Style ③Paint ④Composite（GPU） | 中（但可能很重） |

> **这就是「动画用 `transform` 不用 `left/top`」的根本原因**——不是风格问题，是流水线问题。

### 5.6.3 合成层（Compositing Layer）

**什么是合成层**：浏览器把页面拆成多个图层，每个图层单独绘制，最后由**合成线程**（不是主线程）把它们拼成最终画面。这样某个图层的变化**不影响其它图层**，而且合成可以用 GPU。

**什么会创建合成层**：

| 触发条件 | 说明 |
|---|---|
| `transform: translate3d()` / `translateZ(0)` | 最常用的「强制提升」技巧 |
| `will-change: transform` / `opacity` | **推荐的显式声明方式** |
| `opacity` 动画 / `filter` 动画 | 动画期间自动提升 |
| `<video>` / `<canvas>` / `<iframe>` | 独立层 |
| `position: fixed` | 部分情况下 |
| `backdrop-filter` | 需要独立层做背景采样 |

**⚠️ 合成层的代价（「层爆炸」）**：

| 代价 | 说明 |
|---|---|
| **显存占用** | 每个层都要一张纹理，大层会吃掉大量 GPU 内存 |
| **合成开销** | 层太多，合成本身变慢；移动端尤其明显 |
| **文字渲染** | 某些层的文字会失去子像素抗锯齿（变模糊） |

**正确用法**：

```css
/* ✅ 只在真正需要动画的元素上，且动画开始前加、结束后可移除 */
.animating { will-change: transform; }

/* ❌ 全局滥用 */
* { will-change: transform; }   /* 层爆炸，直接卡死 */
```

### 5.6.4 主线程优化的 5 个方向

| 方向 | 手段 | 说明 |
|---|---|---|
| **① 减少主线程长任务** | 任务切片（`scheduler.postTask` / `requestIdleCallback`）、`setTimeout` 分片 | 超过 **50ms** 的任务叫「长任务」，会阻塞输入响应（影响 INP） |
| **② 把计算挪到 Worker** | Web Worker、`OffscreenCanvas`、WASM | 大数据解析、加密、图像处理 |
| **③ 减少 DOM 数量** | 虚拟列表、`content-visibility: auto`、分页 | DOM 节点多 → 样式计算和布局都慢 |
| **④ 减少样式计算范围** | 避免深层选择器、避免频繁改 class、`contain: layout/paint` | 隔离影响范围 |
| **⑤ 减少布局/绘制** | 见 5.5.4；`content-visibility` 跳过屏外渲染 | — |

**两个相关 API**：

```css
/* content-visibility：屏外内容完全跳过渲染（连布局都不算） */
.card { content-visibility: auto; contain-intrinsic-size: 300px; }

/* contain：告诉浏览器「这个元素内部的变化不影响外部」 */
.widget { contain: layout paint; }
```

```js
// requestAnimationFrame：在下一帧开始前执行，天然和渲染对齐
function animate() {
  el.style.transform = `translateX(${x++}px)`;
  if (x < 500) requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// 对比 setTimeout：时机不可控，可能在一帧中间执行，导致丢帧
```

### 5.6.5 `requestAnimationFrame` vs `setTimeout` vs `requestIdleCallback`

| API | 时机 | 用途 |
|---|---|---|
| `setTimeout(fn, 16)` | 队列空闲时（不保证和帧对齐） | 通用延迟；**不适合动画** |
| `requestAnimationFrame` | **下一帧绘制之前** | **所有视觉动画**（浏览器会节流到屏幕刷新率，后台标签页自动暂停） |
| `requestIdleCallback` | **一帧内的空闲时间** | 低优先级后台任务（打点、预计算），可能被无限延迟 |
| `scheduler.postTask` | 可指定优先级（user-blocking / user-visible / background） | 现代替代方案，Chrome 支持 |

### 5.6.6 口述要点

- **预算**：60fps 下每帧 16.7ms，主线程要跑完 JS、样式、布局、绘制，任一环超时就掉帧。
- **三个方向**：减少主线程工作量、把计算挪到 Worker、把绘制交给 GPU（合成层）。
- **流水线**：Style → Layout → Paint → Composite；`transform` / `opacity` 只走 Style + Composite，`width` / `top` 走完整流水线。
- **合成层**：独立绘制的图层由合成线程拼接，可由 GPU 完成；每个层占一张纹理，层过多会占显存、拖慢合成，文字还可能失去子像素抗锯齿。

---

## 5.7 速记卡

```
defer / async
  普通 script：下载阻塞解析 + 执行阻塞解析
  defer：并行下载，解析完按【顺序】执行，在 DOMContentLoaded 之前
  async：并行下载，下载完【立刻】执行，不保序，与 DCL 关系不确定
  module：默认 = defer；另加 严格模式 / 只执行一次 / CORS / 独立作用域 / import
  ★ 内联脚本的 defer/async 无效（没有下载过程）
  ★ 动态 createElement('script') 默认 async；保序须在 append 前设 s.async = false
  ★ defer + async 同时写 → async 优先（老兼容写法）
  ★ defer 下载更早；内联脚本不能用 defer

为什么 script 阻塞
  ① document.write 能插字符流  ② 可能操作 DOM  ③ 可能读样式（CSS 阻塞 JS）

输入 URL 到页面（八步）
  ① URL 解析 + HSTS    ② 缓存查找（SW > Memory > Disk > HTTP 缓存）
  ③ DNS（客户端→本地 DNS 递归；本地→根/顶级/权威 迭代）
  ④ TCP 三次握手        ⑤ TLS 握手（1.3 = 1-RTT）
  ⑥ HTTP 请求响应（301/304）
  ⑦ 解析：字节→字符→Token→DOM；CSS→CSSOM
  ⑧ Render Tree → Layout → Paint → Composite
  后续：DOMContentLoaded（等 defer/module）→ async/图片 → load
  ★ Render Tree 排除 display:none；visibility:hidden 仍在树里

回流 / 重绘
  回流 = 几何变（重新算布局）  重绘 = 外观变（重新画）
  ★ 回流必带重绘，重绘不一定回流
  触发回流：改宽高/margin/padding/字体、增删 DOM、resize、
           ★ 读 offsetWidth/clientWidth/getBoundingClientRect/getComputedStyle
  强制同步布局 = 读写交错 → 布局抖动 → 解法：读写分离
  优化：① transform/opacity 动画  ② 切 class  ③ Fragment 批量插入
       ④ display:none 期间改  ⑤ 读写分离  ⑥ 图片写死宽高
       ⑦ will-change 提升层  ⑧ 避免 table 布局

渲染优化
  流水线：Style → Layout → Paint → Composite（16.7ms/帧）
  改 width/top/margin  → 全流水线（最贵）
  改 color/bg          → 跳过 Layout
  改 transform/opacity → 只走 Composite（最便宜）
  合成层：will-change / translate3d / video / canvas / iframe
  ★ 层爆炸代价：显存、合成变慢、文字模糊
  长任务 > 50ms 阻塞 INP
  手段：Worker / 时间切片 / 虚拟列表 / content-visibility / contain
  rAF 用于动画（和帧对齐，后台暂停）；rIC 用于空闲任务
```
