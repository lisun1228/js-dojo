# 网络 · 02 从输入 URL 到页面展示（+ DNS 题 64）

> 覆盖：输入 URL 到页面展示（8 个阶段）+ DNS
> 一条主线串起 DNS、TCP、TLS、HTTP、渲染五块

---

## 目录

- [2.1 一句话结论](#21-一句话结论)
- [2.2 全景图（先记这张图，再填细节）](#22-全景图先记这张图再填细节)
- [2.3 阶段 ①：URL 解析](#23-阶段-①url-解析)
- [2.4 阶段 ②：查缓存（可能直接结束）](#24-阶段-②查缓存可能直接结束)
- [2.5 阶段 ③：DNS 解析（含原题 64）](#25-阶段-③dns-解析含原题-64)
- [2.6 阶段 ④：TCP 连接（详见 03 册）](#26-阶段-④tcp-连接详见-03-册)
- [2.7 阶段 ⑤：TLS 握手（详见 09 册）](#27-阶段-⑤tls-握手详见-09-册)
- [2.8 阶段 ⑥：发送请求、接收响应](#28-阶段-⑥发送请求接收响应)
- [2.9 阶段 ⑦：解析与构建 DOM / CSSOM](#29-阶段-⑦解析与构建-dom--cssom)
- [2.10 阶段 ⑧：渲染（渲染树 → 布局 → 绘制 → 合成）](#210-阶段-⑧渲染渲染树--布局--绘制--合成)
- [2.11 阶段 ⑨（延伸）：JS 执行与后续](#211-阶段-⑨延伸js-执行与后续)
- [2.12 每个阶段对应的优化手段（把这道题和性能优化串起来）](#212-每个阶段对应的优化手段把这道题和性能优化串起来)
- [2.13 答题模板](#213-答题模板)
- [2.14 速记卡](#214-速记卡)

---

## 2.1 一句话结论

一次页面访问可以拆成 **8 个阶段**：**URL 解析 → 查缓存 → DNS 解析 → TCP 连接 → TLS 握手 → 发请求收响应 → 解析构建 DOM/CSSOM → 布局绘制合成**。

前三段回答「**找得到吗**」，中间三段回答「**连得上吗**」，最后两段回答「**看得懂吗**」。

---

## 2.2 全景图（先记这张图，再填细节）

```
① URL 解析 ──→ ② 查缓存 ──→ ③ DNS 解析 ──→ ④ TCP 连接 ──→ ⑤ TLS 握手
     │              │             │              │              │
  拆协议/域名     命中就直接用    域名→IP      三次握手      证书+密钥协商
  /端口/路径     不命中继续       （递归+迭代）  1 RTT         1~2 RTT
                                                                 │
                                                                 ▼
⑧ 渲染 ──←── ⑦ 解析构建 ──←── ⑥ 发请求收响应 ────────────────────┘
 布局/绘制/合成   HTML→DOM     请求行+头+体
 合成层          CSS→CSSOM    状态码+响应头+体
                JS 阻塞？
```

各阶段的**耗时性质**（只有 RTT 数是协议规定的，其余随资源与网络变化）：

| 阶段 | 耗时性质 |
|---|---|
| ① URL 解析 + ② 查缓存 | 本地计算与查表，可忽略 |
| ③ DNS | 缓存命中近乎为零；未命中要一次到本地 DNS 的往返 |
| ④ TCP | 1 RTT（连接可复用时省掉） |
| ⑤ TLS | 1~2 RTT（TLS 1.3 为 1 RTT） |
| ⑥ 请求响应 | TTFB = 网络往返 + 服务端处理 + 排队 |
| ⑦ 解析构建 | 与 HTML/CSS 体积、脚本阻塞时长相关 |
| ⑧ 布局绘制 | 与 DOM 规模、样式复杂度、合成层数量相关 |

---

## 2.3 阶段 ①：URL 解析

浏览器先判断输入的是**搜索词**还是 **URL**。这属于地址栏的启发式规则，不是 `URL` 构造器的行为——Node 里 `new URL('example.com')` 会直接抛 `ERR_INVALID_URL`：

```
输入 "example.com"     → 补全成 https://example.com/（现代浏览器默认 HTTPS）
输入 "http://a.com:8080/p?q=1#hash" → 拆成：
    protocol: http:
    hostname: a.com       ← 是 hostname；host 是 a.com:8080（含端口）
    port:     8080
    path:     /p
    query:    q=1
    hash:     #hash   ← 不会发给服务器，只在本地用
```

**几个容易追问的点**：

| 点 | 说明 |
|---|---|
| **默认端口** | HTTP 80、HTTPS 443。显式写默认端口会被规范化掉：`new URL('http://a.com:80/p').href` 是 `http://a.com/p`，`.port` 是空串 |
| **hash 不发服务器** | `#hash` 只在客户端生效（锚点、前端路由）。实测 `fetch('http://127.0.0.1:PORT/p?q=1#hash')`，服务端拿到的 `req.url` 是 `/p?q=1` |
| **HSTS 升级** | 域名在 HSTS 列表里时，即使输入 `http://` 也会被强制改成 `https://`（307 Internal Redirect） |
| **危险协议** | `javascript:`、`data:`、`file:` 会被特殊处理，`javascript:` 是 XSS 的经典向量 |

---

## 2.4 阶段 ②：查缓存（可能直接结束）

在**发出任何网络请求之前**，浏览器按顺序查缓存：

```
Service Worker（如果注册了，它完全接管，可以自己决定用不用缓存）
    ↓ 没命中
Memory Cache（内存缓存，同一次会话内的资源）
    ↓ 没命中
Disk Cache（磁盘缓存，走 HTTP 缓存规则：强缓存 / 协商缓存）
    ↓ 没命中
Push Cache（HTTP/2 Server Push，已基本废弃）
    ↓ 没命中
发起网络请求
```

**强缓存命中时，流程在这里直接结束**：不走 DNS、不建连接、不发请求。协商缓存命中则仍要发一次请求，拿 304 和空响应体。

缓存细节见 08 册。

---

## 2.5 阶段 ③：DNS 解析（含原题 64）

### 2.5.1 一句话结论

DNS 把**域名翻译成 IP**。查询方向是「**客户端到本地 DNS 用递归，本地 DNS 到根/顶级/权威用迭代**」——说反了就是硬伤。

### 2.5.2 DNS 的层级结构

```
                        根域名服务器（.）
                        /       |        \
                  .com          .org       .cn         ← 顶级域 TLD
                 /                 \
        example.com            google.com               ← 权威域名服务器（域名持有者配置）
             |
      www.example.com  →  A 记录  →  203.0.113.10
```

- **根域名服务器**：全球 13 组（逻辑上 13 个 IP，物理上有上千个实例，靠 Anycast）
- **顶级域（TLD）**：`.com`、`.org`、`.cn`、`.net`
- **权威域名服务器**：域名注册商/云厂商给你配的那台，**只有它知道最终答案**
- **本地 DNS 服务器**：ISP 提供的（或 8.8.8.8 / 114.114.114.114），负责替你跑完后续查询

### 2.5.3 完整查询链路

以 `www.example.com` 为例：

```
① 浏览器 DNS 缓存         chrome://net-internals/#dns       （时长由浏览器实现决定）
② 操作系统 DNS 缓存        Windows DNS Client / systemd-resolved / macOS mDNSResponder
③ hosts 文件              /etc/hosts 或 C:\Windows\System32\drivers\etc\hosts
④ 本地 DNS 服务器（递归查询的起点）   ← 到这里为止都是「客户端 → 本地 DNS」，是【递归】
      ↓
⑤ 本地 DNS → 根服务器：      "www.example.com 的 IP 是多少？"
   根 → "我不知道，但 .com 的服务器地址是 xxx，你去问它"        ← 从这里开始都是【迭代】
⑥ 本地 DNS → .com TLD：      "www.example.com 的 IP 是多少？"
   TLD → "我不知道，但 example.com 的权威服务器是 yyy，你去问它"
⑦ 本地 DNS → 权威服务器：    "www.example.com 的 IP 是多少？"
   权威 → "203.0.113.10"（A 记录）
      ↓
⑧ 本地 DNS 把结果返回给客户端，并按 TTL 缓存
```

**递归 vs 迭代**：

| | 递归查询 | 迭代查询 |
|---|---|---|
| 谁在跑腿 | **被问的人负责给出最终答案** | **被问的人只告诉你下一步问谁** |
| 发生在哪 | 客户端 → 本地 DNS | 本地 DNS → 根/顶级/权威 |
| 类比 | 「你帮我搞定」 | 「你去问隔壁老王」 |

之所以这样设计，是让根服务器只回答「下一个该问谁」，不必替全球客户端跑完全程。

### 2.5.4 DNS 记录类型

| 类型 | 含义 | 例子 |
|---|---|---|
| **A** | 域名 → IPv4 | `example.com. IN A 203.0.113.10` |
| **AAAA** | 域名 → IPv6 | `example.com. IN AAAA 2606:2800:...` |
| **CNAME** | 别名 → 另一个域名 | `www.example.com. IN CNAME example.com.`（**CDN 最常用**） |
| **MX** | 邮件服务器 | `example.com. IN MX 10 mail.example.com.` |
| **TXT** | 任意文本 | SPF、DKIM、域名所有权验证 |
| **NS** | 该域的权威服务器 | `example.com. IN NS ns1.example.com.` |
| **SOA** | 区域起始授权（主 NS、管理员邮箱、序列号） | — |
| **CAA** | 允许哪些 CA 给这个域签证书 | 防证书误签 |

### 2.5.5 DNS 为什么用 UDP

| 原因 | 说明 |
|---|---|
| **快** | 不用三次握手，一个 RTT 就拿到结果 |
| **请求小** | 一个查询报文通常几十字节，UDP 完全够 |
| **自己实现重传** | DNS 客户端自己超时重发，不需要 TCP 的可靠传输 |
| **无状态** | 服务器不用维护连接，能扛更高 QPS |

**什么时候用 TCP？**

- 响应超过 512 字节（传统限制），或超过 EDNS0 协商的大小
- **区域传送（AXFR/IXFR）**：主从 DNS 同步，数据量大必须可靠
- **DNS over TLS / HTTPS（DoT/DoH）**：加密查询走 TCP 443/853

### 2.5.6 CDN 是怎么靠 DNS 做调度的

```
用户请求 www.example.com
    ↓
权威 DNS 返回 CNAME：www.example.com.cdn.com     ← 交给 CDN 的 DNS
    ↓
CDN 的 DNS 根据「用户本地 DNS 的出口 IP」或「EDNS Client Subnet」
判断用户大概在哪个区域
    ↓
返回该区域最近的边缘节点 IP
```

**这个机制的两个问题**：

| 问题 | 说明 |
|---|---|
| **调度不准** | 用的是「本地 DNS 的 IP」，不是「用户的 IP」。如果用户用了 8.8.8.8，可能被调度到美国节点 |
| **解法** | **EDNS Client Subnet（ECS）**：本地 DNS 把你的网段一起带给权威 DNS，调度更准 |

公司内网 DNS 出口在国外时，访问国内站点反而慢，就是被调度到了国外节点。

### 2.5.7 前端能做的 DNS 优化

```html
<!-- 提前解析（只做 DNS，不建连接） -->
<link rel="dns-prefetch" href="//api.example.com">

<!-- 提前解析 + TCP + TLS（一次到位，代价稍高） -->
<link rel="preconnect" href="https://api.example.com" crossorigin>
```

| 手段 | 省了什么 | 用在什么场景 |
|---|---|---|
| `dns-prefetch` | 只省 DNS 一次往返 | 第三方域名多、不确定会不会用到 |
| `preconnect` | DNS + TCP + TLS（1~3 RTT） | 确定马上要用的关键域名（API、CDN、字体） |
| 增大 TTL | 减少重复解析 | 域名 IP 稳定时 |
| 减少域名数量 | 减少解析次数 | 把静态资源收敛到 1~2 个域名 |
| HTTP/2 连接复用 | 同一域名只解析一次 | — |

**注意**：`preconnect` 会**提前占一个 TCP 连接**，域名很多时会浪费资源（浏览器对并发连接数有限制），所以只对 3~5 个关键域名用。

---

## 2.6 阶段 ④：TCP 连接（详见 03 册）

拿到 IP 后，浏览器向 `IP:443` 发起 TCP 连接：

```
客户端 → 服务端：SYN  (seq=x)
服务端 → 客户端：SYN+ACK (seq=y, ack=x+1)
客户端 → 服务端：ACK  (ack=y+1)
```

**耗时 1 个 RTT**。如果连接被复用（HTTP/1.1 keep-alive 或 HTTP/2 单连接），这一步可以省掉。

**这一阶段前端的优化点**：

| 手段 | 效果 |
|---|---|
| `preconnect` | 提前建连，把 1 RTT 藏到「用户还在看上一页」的时候 |
| HTTP/2 单连接 | 同一域名只建一次 |
| 减少域名分片 | HTTP/1.1 时代为了并行会拆多个域名，HTTP/2 下反而应该合并 |
| TCP Fast Open | 用 TFO cookie 把握手数据带上，省 1 RTT（需要内核和服务端支持，普及度一般） |

---

## 2.7 阶段 ⑤：TLS 握手（详见 09 册）

如果是 HTTPS，还要再做一次 TLS 握手：

```
TLS 1.2（ECDHE）：2 RTT
  ClientHello → ServerHello + Certificate + ServerKeyExchange → ClientKeyExchange → Finished

TLS 1.3：1 RTT（会话复用可以 0-RTT）
  把密钥协商和证书合并到第一轮
```

**所以一个全新的 HTTPS 连接，从 DNS 到能发请求，需要**：

```
DNS(1 RTT) + TCP(1 RTT) + TLS(1~2 RTT) ≈ 3~4 个 RTT
```

这段是与服务端处理能力无关的纯等待，RTT 越大（跨地区、移动网络）越明显，所以首屏优化先砍这三段 RTT。

---

## 2.8 阶段 ⑥：发送请求、接收响应

### 2.8.1 请求

```http
GET /index.html HTTP/1.1
Host: example.com
User-Agent: Mozilla/5.0 ...
Accept: text/html,application/xhtml+xml
Accept-Encoding: gzip, deflate, br
Accept-Language: zh-CN,zh;q=0.9
Cookie: sessionid=abc123
Connection: keep-alive
```

**注意 `Accept-Encoding`**：浏览器告诉服务器「我支持哪些压缩」，服务器选一个（通常 `br` > `gzip`），在响应里通过 `Content-Encoding` 告知。文本资源压缩率最高。

### 2.8.2 响应

```http
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
Content-Encoding: br
Content-Length: 8234
Cache-Control: public, max-age=31536000, immutable
ETag: "abc123"
Set-Cookie: sessionid=...; HttpOnly; Secure; SameSite=Lax

<!DOCTYPE html>...
```

**浏览器收到后要做的判断**：

| 检查项 | 后续动作 |
|---|---|
| 状态码 200 | 正常处理 |
| 状态码 **304** | 用本地缓存，**响应体为空** |
| 状态码 **301/302/307/308** | 读 `Location`，重新走一遍流程（可能跨域，可能换协议） |
| `Content-Type` | 决定怎么处理（`text/html` → 解析；`image/*` → 解码；`application/json` → 交给 JS） |
| `Content-Encoding` | 先解压 |
| **CSP / HSTS / X-Frame-Options** | 安全策略生效 |
| **CORS 头** | 判断是否允许 JS 读这个响应 |

**重定向是隐藏成本**：一次 302 意味着可能再来一轮 DNS + TCP + TLS + 请求，线上要尽量消灭重定向链（`http → https`、裸域 → `www`、末尾斜杠补全）。

---

## 2.9 阶段 ⑦：解析与构建 DOM / CSSOM

### 2.9.1 HTML → DOM

```
字节流 → 字符流（按 charset 解码）→ Token → Node → DOM 树
```

**HTML 解析是增量、容错的**：

- 不规范的 HTML（缺闭合标签）也能解析，浏览器会**自动纠正**
- 解析过程中遇到 `<script>` 会**暂停解析**去执行 JS（因为 JS 可能 `document.write` 改变文档结构）
- 所以 `<script>` 默认**阻塞 HTML 解析**

### 2.9.2 CSS → CSSOM

CSS 是**阻塞渲染**的（render-blocking）：没有 CSSOM，浏览器不知道该画成什么样。

**更关键的是 CSS 也会阻塞 JS 执行**：JS 可能读取样式（`getComputedStyle`），浏览器必须等 CSSOM 建好才能执行 JS。所以：

```
<link rel="stylesheet"> 在后面 + <script> 在前面
    ↓
浏览器必须等 CSS 下载完、CSSOM 建好，才能执行 script
    ↓
表现为「白屏时间变长」
```

「CSS 放 head、JS 放 body 末尾（或用 defer）」不是编码习惯，而是由这条阻塞链决定的。

### 2.9.3 三种 script 加载方式

| 写法 | 下载 | 执行时机 | 是否阻塞解析 |
|---|---|---|---|
| `<script src>` | 立即，**阻塞解析** | 下载完立即执行 | ✅ 阻塞 |
| `<script async src>` | 异步 | **下载完立即执行**（可能打断解析） | ⚠️ 下载不阻塞，执行阻塞 |
| `<script defer src>` | 异步 | **HTML 解析完后按顺序执行** | ❌ 不阻塞 |
| `<script type="module">` | 异步 | **默认 defer 行为** | ❌ 不阻塞 |

**怎么选**：

- **有依赖关系 / 需要操作 DOM** → `defer`
- **独立脚本（统计、广告）** → `async`
- **必须在解析前执行的** → 裸 `<script>`

### 2.9.4 预加载扫描器（preload scanner）

**主解析器被 `<script>` 阻塞时，浏览器会启动预加载扫描器**，提前扫描后面的 HTML，把 `img`、`link`、`script` 等资源先下载。

所以「阻塞解析」不等于「所有资源都停了」：图片、CSS 仍会并行下载。

---

## 2.10 阶段 ⑧：渲染（渲染树 → 布局 → 绘制 → 合成）

### 2.10.1 四步

```
DOM 树 + CSSOM 树
      ↓ 合并（只保留可见节点）
   渲染树（Render Tree）
      ↓ 计算每个节点的位置和大小
   布局 / 回流（Layout / Reflow）
      ↓ 生成绘制指令
   绘制（Paint）
      ↓ 分层、栅格化、合成
   合成（Composite）→ 屏幕
```

**三棵树的差异**：

| 树 | 包含什么 |
|---|---|
| DOM 树 | 所有节点 |
| CSSOM 树 | 所有样式规则 |
| **渲染树** | **只包含「可见」节点**：`display: none` 的**不在**树里；`visibility: hidden` 的**在**树里（占位） |

### 2.10.2 哪些操作触发哪一步

| 操作 | 触发 | 代价 |
|---|---|---|
| 改 `width`/`height`/`margin`/`font-size` | 布局 + 绘制 + 合成 | **最贵** |
| 改 `color`/`background`/`box-shadow` | 绘制 + 合成 | 中等 |
| 改 `transform`/`opacity`（在合成层上） | 只合成 | **最便宜** |
| 改 `filter`/`backdrop-filter` | 绘制（可能）+ 合成 | 较贵 |

所以动画优先用 `transform` 而不是 `left/top`，详见性能优化分册的「渲染优化」章。

### 2.10.3 首屏相关的时间点

| 指标 | 含义 | 对应哪个阶段 |
|---|---|---|
| **FP**（First Paint） | 首次绘制（哪怕只是背景色） | ⑧ 开始 |
| **FCP**（First Contentful Paint） | 首次绘制内容（文字/图片） | ⑧ 中 |
| **LCP**（Largest Contentful Paint） | 最大内容元素绘制完成 | ⑧ 后段 |
| **TTI**（Time to Interactive） | 可交互（主线程空闲） | ⑨ JS 执行完 |

---

## 2.11 阶段 ⑨（延伸）：JS 执行与后续

DOM 构建完成 → 触发 `DOMContentLoaded` → 等所有资源（图片、样式、iframe）加载完 → 触发 `load`。

**之后还有**：懒加载图片、异步接口请求、React/Vue 的 hydration 或首次渲染、字体加载（`font-display`）、埋点上报。

被问「页面展示完了还有什么事」时，落点是 `DOMContentLoaded` / `load` 的区别、hydration、懒加载、字体 FOIT/FOUT，即「页面展示 ≠ 页面可用」。

---

## 2.12 每个阶段对应的优化手段（把这道题和性能优化串起来）

| 阶段 | 优化手段 | 效果 |
|---|---|---|
| ② 缓存 | 强缓存 + 内容 hash 文件名 | 命中后不产生网络请求 |
| ③ DNS | `dns-prefetch`、CDN、减少域名 | 省一次解析往返 |
| ④ TCP | `preconnect`、HTTP/2 复用、减少域名分片 | 每域名省 1 RTT |
| ⑤ TLS | TLS 1.3、会话复用、OCSP Stapling | 省 1 RTT |
| ⑥ 响应 | CDN、Brotli、SSR、HTTP/2 多路复用 | 降低 TTFB |
| ⑦ 解析 | 减小 HTML、内联关键 CSS、`defer`、代码分割 | FCP 提前 |
| ⑧ 渲染 | 减少 DOM 数、避免强制同步布局、`content-visibility` | LCP 提前 |
| ⑨ 交互 | 减少主线程长任务、`requestIdleCallback`、虚拟列表 | INP 降低 |

---

## 2.13 答题模板

### 30 秒版

```
8 个阶段：URL 解析 → 查缓存 → DNS → TCP → TLS → 请求响应 → 解析构建 → 布局绘制合成
3 个判断点：缓存是否命中、是否 HTTPS、是否有阻塞资源
1 个结论：固定开销集中在 DNS、TCP、TLS 三段 RTT，是首屏优化的重点
```

### 2 分钟版

- **解析与缓存**：判断搜索词还是 URL，拆出协议、主机、端口、路径、查询、fragment；再依次查 Service Worker → 内存 → 磁盘 → Push 缓存，强缓存命中则本轮结束。
- **DNS**：浏览器/系统/hosts 缓存未命中后问本地 DNS；客户端→本地 DNS 是递归，本地 DNS→根/顶级/权威是迭代；结果是 A/AAAA/CNAME 记录并带 TTL。
- **传输**：TCP 三次握手 1 RTT；HTTPS 再叠 TLS 握手（1.2 为 2 RTT，1.3 为 1 RTT）。
- **请求响应**：请求行 + 头 + 空行 + 体；响应先看状态码（200/304/3xx），再按 `Content-Type`、`Content-Encoding`、CORS 决定怎么处理。
- **解析与渲染**：HTML 增量解析成 DOM，CSS 成 CSSOM；`<script>` 阻塞解析、CSS 阻塞渲染且阻塞 JS 执行；渲染树只含可见节点，之后布局、绘制、合成，最后是 `DOMContentLoaded`、`load` 与 hydration。

继续追问优化时，按 2.12 的阶段表逐段说。

### 追问表

| 追问 | 回答要点 |
|---|---|
| DNS 递归和迭代分别在哪一段？ | 客户端→本地 DNS 递归；本地 DNS→根/顶级/权威迭代 |
| DNS 为什么用 UDP？ | 快（1 RTT）、报文小、自己重传、无状态；区域传送和 DoH 用 TCP |
| `dns-prefetch` 和 `preconnect` 区别？ | 前者只解析，后者解析 + TCP + TLS；后者更贵，只对关键域名用 |
| 三个 RTT 是哪三个？ | DNS + TCP + TLS（TLS 1.2 是 2 个） |
| 重定向会增加多少成本？ | 再来一轮（可能）DNS + TCP + TLS + 请求，所以要消灭重定向链 |
| `DOMContentLoaded` 和 `load` 区别？ | 前者 DOM 构建完（不等图片），后者所有资源加载完 |
| CDN 怎么知道用户在哪个区域？ | 看本地 DNS 出口 IP，或用 EDNS Client Subnet |
| 一个 TCP 段最多装多少应用数据？ | MSS 1460（MTU 1500 - IP 20 - TCP 20） |

---

## 2.14 速记卡

```
八阶段
  ① URL 解析 ② 查缓存 ③ DNS ④ TCP ⑤ TLS ⑥ 请求响应 ⑦ 解析构建 ⑧ 渲染

DNS
  缓存顺序：浏览器 → 系统 → hosts → 本地 DNS
  客户端→本地 DNS = 递归（要最终答案）
  本地 DNS→根/顶级/权威 = 迭代（只给下一个地址）
  记录：A / AAAA / CNAME（CDN）/ MX / TXT / NS
  53 端口，UDP；区域传送和 DoH 用 TCP
  CDN 调度看本地 DNS 出口 IP，不准就用 EDNS Client Subnet

RTT 成本
  DNS 1 + TCP 1 + TLS 1~2 = 3~4 RTT（全新连接）
  优化：preconnect / HTTP2 复用 / TLS1.3 / 会话复用

阻塞规则
  <script> 阻塞 HTML 解析（async 不阻塞下载但阻塞执行，defer 完全不阻塞）
  CSS 阻塞渲染，且阻塞 JS 执行（JS 可能读样式）
  → CSS 放 head，JS 放 body 末尾或 defer
  预加载扫描器在主解析器阻塞时仍会预下载资源

渲染
  渲染树只含可见节点（display:none 不在，visibility:hidden 在）
  布局 → 绘制 → 合成
  transform/opacity 只走合成，left/top 要走布局
```
