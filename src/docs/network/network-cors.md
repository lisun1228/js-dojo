# 网络 · 10 跨域与 CORS

> 本册覆盖：跨域的产生与解决、简单请求与非简单请求、为什么触发预检
> **这是本题单重复第二多的知识点（11 次）**，因为它是日常开发里最高频的坑。
> 题单的答案有一处**关键错误**：「只有 XHR/fetch 受限制，img/script/link 不受限」——**不准确**。本册 10.2 会讲清真正的边界。

---

## 目录

- [10.1 一句话结论](#101-一句话结论)
- [10.2 同源策略：到底限制了什么（先纠正题单）](#102-同源策略到底限制了什么先纠正题单)
- [10.3 不受同源策略约束的情况（面试常问「为什么 WebSocket 不受限」）](#103-不受同源策略约束的情况面试常问为什么-websocket-不受限)
- [10.4 CORS 简单请求（纠正题单）](#104-cors-简单请求纠正题单)
- [10.5 预检请求](#105-预检请求)
- [10.6 带 Cookie 的跨域请求（credentials）](#106-带-cookie-的跨域请求credentials)
- [10.7 暴露自定义响应头](#107-暴露自定义响应头)
- [10.8 五种解决方案对比](#108-五种解决方案对比)
- [10.9 六个常见报错与排查](#109-六个常见报错与排查)
- [10.10 常见坑](#1010-常见坑)
- [10.11 答题模板](#1011-答题模板)
- [10.12 速记卡](#1012-速记卡)

---

## 10.1 一句话结论

**同源策略限制的是「读取响应」，不是「发送请求」。**
跨域请求（简单请求）**已经发出去了、服务器也处理了**，只是浏览器不让 JS 读响应内容。
解决方案的核心只有两条路：**让服务器明确授权（CORS）**，或者**让请求变成同源（代理）**。

---

## 10.2 同源策略：到底限制了什么（先纠正题单）

### 10.2.1 什么叫「同源」

**协议 + 域名 + 端口**，三者**完全相同**才是同源。

以 `https://www.example.com:443/page` 为基准：

| URL | 是否同源 | 差异 |
|---|---|---|
| `https://www.example.com/other` | ✅ 同源 | 路径不同不影响 |
| `https://www.example.com:443/x` | ✅ 同源 | 443 是 https 默认端口 |
| `http://www.example.com/page` | ❌ | **协议不同** |
| `https://api.example.com/page` | ❌ | **域名不同**（子域也算不同） |
| `https://www.example.com:8080/page` | ❌ | **端口不同** |
| `https://example.com/page` | ❌ | **域名不同**（有无 www 算不同） |

**三个容易踩的细节**：

1. **端口要显式比较**：`https://a.com` 和 `https://a.com:443` 是同源（默认端口等价），但 `http://a.com` 和 `http://a.com:80` 也是。
2. **子域名算跨域**：`a.example.com` 和 `b.example.com` 跨域。
3. **IP 和域名算跨域**：`http://127.0.0.1` 和 `http://localhost` 跨域（虽然后者在某些浏览器有特例）。

### 10.2.2 题单的错误：不是「img/script/link 不受限」

**题单原文**：「只有 XHR/fetch 请求受限制，img/script/link 不受限。」

**这句话错在把「能不能发」和「能不能读」混为一谈。**

**准确的说法**：

| 方式 | 能否**发出**跨域请求 | 能否**读取响应内容** |
|---|---|---|
| `fetch` / `XHR` | ✅ 能（简单请求直接发，非简单先预检） | ❌ **默认不能**（需要 CORS 授权） |
| `<img src>` | ✅ 能 | ❌ 不能读像素（但能读 `width`/`height`、能 `onload`/`onerror`） |
| `<script src>` | ✅ 能 | ❌ 不能读源码（但**会执行**） |
| `<link rel=stylesheet>` | ✅ 能 | ❌ 不能读 CSS 规则（但**会应用**） |
| `<iframe src>` | ✅ 能 | ❌ 不能读 DOM（同源才能） |
| `<video>` / `<audio>` | ✅ 能 | ❌ 不能读媒体数据（`crossorigin` 影响 canvas 能否读） |
| `<form action>` | ✅ 能（会跳转） | ❌ 不能读结果 |

**所以真正的表述是**：

> **同源策略限制的是「跨源读取」，不是「跨源加载/发送」。**
> `img`、`script`、`link` 之所以「看起来不受限」，是因为它们**只需要加载，不需要 JS 读取内容**——图片渲染、脚本执行、样式应用，都是浏览器内部行为，不需要把内容交给 JS。

**为什么 `<script>` 能执行跨域脚本**：这是**历史设计**（CDN 加载 JS 必须支持跨域）。但这带来一个严重后果：**一个恶意脚本可以完全控制你的页面**。所以现代有 **SRI（Subresource Integrity）** 来校验脚本完整性。

**为什么 `img` 不能读像素**：如果 JS 能读跨域图片的像素，就可以用 canvas 把用户在其他网站的截图读出来（比如把 `<img src="https://bank.com/avatar">` 画到 canvas 上读取）。

### 10.2.3 同源策略到底保护什么

**保护的是「用户的登录态」。**

```
你登录了 bank.com（浏览器里有 bank.com 的 cookie）
    ↓
你访问了 evil.com
    ↓
evil.com 的 JS 发一个请求到 bank.com/transfer
    ↓
★ 关键：浏览器会自动带上 bank.com 的 cookie！
    ↓
如果没有同源策略：
  evil.com 的 JS 能读到响应 → 知道你余额多少、能伪造转账确认
    ↓
有了同源策略：
  请求还是会发出去（cookie 也带上了）
  但 evil.com 读不到响应 → 拿不到数据
```

**所以同源策略的第一个关键认知**：**它不能阻止请求发出，只能阻止读取。**
**这就是 CSRF 攻击的基础**——攻击者不需要读响应，只要「请求被执行」就够了（转账、改密码这类操作不需要读结果）。

> 这也是为什么**防 CSRF 不能靠同源策略**，要靠 CSRF Token、SameSite Cookie、Origin 校验。（详见「前端安全」分册）

### 10.2.4 受同源策略限制的 API

不只是 `fetch`/`XHR`：

| API | 限制 |
|---|---|
| `fetch` / `XMLHttpRequest` | 读响应需要 CORS |
| **Cookie / localStorage / sessionStorage / IndexedDB** | **按源隔离**，不同源完全不同 |
| **iframe 的 DOM** | 跨域不能读（`contentWindow.document` 抛错） |
| **Canvas 的 `getImageData`** | 画了跨域图片后 canvas 被「污染」，读像素抛错 |
| **Web Font（`@font-face`）** | 需要 CORS（字体是跨域加载的典型坑） |
| **CSS `@import`** | 同源策略影响（部分） |
| **`window.opener` 访问** | 跨域受限（需 `postMessage`） |

**一个真实案例**：字体文件跨域。

```
CSS 里 @font-face 引用了 CDN 上的字体
    ↓ 字体加载需要 CORS（因为字体被视为「可执行资源」）
CDN 没返回 Access-Control-Allow-Origin
    ↓
控制台报错，字体静默回退到系统字体
    ↓
表现：设计稿对不上，但不报明显错误
```

**解决**：CDN 给字体文件加 `Access-Control-Allow-Origin: *`。

---

## 10.3 不受同源策略约束的情况（面试常问「为什么 WebSocket 不受限」）

| 情况 | 说明 |
|---|---|
| **`<img>` `<script>` `<link>` `<iframe>` `<video>` `<audio>` `<form>`** | 可以跨域**加载/提交**，只是不能读内容 |
| **`<script>` 的 JSONP** | 利用 script 不受限，用回调函数拿数据（**只支持 GET**） |
| **WebSocket** | **握手阶段不受同源策略限制**（浏览器会带 `Origin` 头，但**不会拦截**）。服务端必须自己校验 Origin |
| **服务端请求**（Node、curl、Postman） | **没有同源策略**（SOP 是浏览器行为，不是 HTTP 协议） |
| **浏览器插件 / `--disable-web-security`** | 可以绕过，但**只用于开发排查**，不能作为方案 |
| **`postMessage`** | 跨域通信的**官方通道**，需要校验 `event.origin` |

**重点说 WebSocket**：

```
WebSocket 握手是一个 HTTP 请求：
  GET /chat HTTP/1.1
  Upgrade: websocket
  Origin: https://evil.com        ← 浏览器会带，但不会阻止请求发出
```

**所以**：浏览器**不会**因为跨域而阻止 WebSocket 连接。**服务端必须自己检查 `Origin` 头**，否则任何人都能连你的 WebSocket（这就是 **CSWSH，跨站 WebSocket 劫持**）。

**这也说明一个道理**：**同源策略是「浏览器保护用户」的机制，不是「服务端保护自己」的机制**。服务端的安全必须自己做。

---

## 10.4 CORS 简单请求（纠正题单）

### 10.4.1 三个条件（必须**同时**满足）

**题单只写了「GET/POST + 简单头」，不完整。完整的三条**：

#### 条件 1：方法只能是三种

```
GET  /  HEAD  /  POST
```

#### 条件 2：只能有「CORS 安全列表请求头」

允许的头（**只能是这些，不能有自定义头**）：

| 头 | 允许的值 |
|---|---|
| `Accept` | 任意（但某些字符受限） |
| `Accept-Language` | 任意 |
| `Content-Language` | 任意 |
| `Content-Type` | **只能是下面三个值之一** |
| `Range` | 只能是简单 range（如 `bytes=0-99`） |

**⚠️ 关键：`Content-Type` 只能是这三种**

```
application/x-www-form-urlencoded
multipart/form-data
text/plain
```

**这就解释了一个经典现象**：

```js
// ❌ 触发预检
fetch('https://api.com/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },   // ← 不在白名单里！
  body: JSON.stringify({ a: 1 }),
});

// ✅ 不触发预检（但服务端要能解析 form 格式）
fetch('https://api.com/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'a=1',
});
```

**「用 `application/json` 就会发 OPTIONS 预检」——这是前端最常遇到的现象，根因就在这里。**

#### 条件 3：不能使用 `ReadableStream` 作为请求体

（Fetch API 的 `body` 如果是 `ReadableStream`，会强制预检。）

### 10.4.2 简单请求的完整流程

```
① 浏览器发出请求，自动加 Origin 头
   GET /data HTTP/1.1
   Origin: https://a.com          ← 浏览器自动加，JS 改不了

② 服务器返回，必须带 CORS 头
   HTTP/1.1 200 OK
   Access-Control-Allow-Origin: https://a.com

③ 浏览器检查
   · 如果 ACAO 匹配（或为 *）→ 把响应交给 JS
   · 如果不匹配/缺失 → 【拦截响应】，JS 收到 TypeError
```

**⚠️ 三个关键认知**：

1. **请求是真的发出去了，服务器也真的处理了**（可能已经写库了）
2. **拦截发生在「响应返回之后」**，JS 只是拿不到内容
3. **JS 拿到的错误是 `TypeError: Failed to fetch`，看不到具体原因**（出于安全考虑，浏览器不告诉 JS 详情）——**真正的原因只在控制台里**

**第 3 点很重要**：很多新手以为「代码写错了」，其实是 CORS 被拦，只是 JS 层看不到。

---

## 10.5 预检请求

### 10.5.1 什么时候触发预检

**只要不满足简单请求的任一条件**，就触发预检：

| 触发条件 | 例子 |
|---|---|
| **方法不是 GET/HEAD/POST** | `PUT`、`DELETE`、`PATCH` |
| **有自定义请求头** | `X-Token`、`Authorization`（注意：`Authorization` 不是安全列表头，会触发预检） |
| **`Content-Type` 不是那三种** | `application/json`、`text/xml` |
| **`ReadableStream` 作为 body** | — |

**注意 `Authorization` 也会触发预检**——这是很多人不知道的（以为只有 `Content-Type` 会）。

**更隐蔽的**：**`fetch` 默认带的一些头不会触发**（`Accept`、`Accept-Language`），但**如果你手动设置了 `User-Agent`、`Referer` 这类「禁止修改的头」，浏览器会忽略你的设置，也不会触发预检**。

### 10.5.2 预检的完整交互

```
① 预检请求（OPTIONS，不带 body）
   OPTIONS /api/data HTTP/1.1
   Origin: https://a.com
   Access-Control-Request-Method: PUT                    ← 我接下来要用的方法
   Access-Control-Request-Headers: content-type,x-token  ← 我接下来要用的自定义头

② 预检响应
   HTTP/1.1 204 No Content
   Access-Control-Allow-Origin: https://a.com
   Access-Control-Allow-Methods: GET, POST, PUT, DELETE
   Access-Control-Allow-Headers: Content-Type, X-Token
   Access-Control-Max-Age: 86400                          ← 缓存 24 小时，期间不再预检
   Access-Control-Allow-Credentials: true                 ← 如果带 cookie

③ 预检通过 → 浏览器发真正的请求（带 Origin）
   PUT /api/data HTTP/1.1
   Origin: https://a.com
   Content-Type: application/json
   ...

④ 真实响应也要带 CORS 头
   HTTP/1.1 200 OK
   Access-Control-Allow-Origin: https://a.com
```

**⚠️ 预检本身也是一次完整的网络往返**！所以：

| 请求数 | 成本 |
|---|---|
| 无预检（简单请求） | 1 RTT |
| 有预检（每次） | **2 RTT**（OPTIONS + 真实请求） |
| 有预检 + `Max-Age` 缓存 | 首次 2 RTT，之后 1 RTT |

**这就是为什么「减少预检」是前端性能优化的一环**（详见下面 10.5.3）。

### 10.5.3 怎么减少预检

| 手段 | 说明 |
|---|---|
| **`Access-Control-Max-Age` 设大** | 浏览器缓存预检结果（Chrome 上限 2 小时 = 7200 秒；Firefox 上限 24 小时） |
| **改用简单请求** | 比如用 `application/x-www-form-urlencoded` 代替 JSON（但服务端要能解析） |
| **同域代理** | 走 `devServer.proxy` 或 Nginx 反向代理，根本不跨域 → 无预检 |
| **合并接口** | 减少请求数 = 减少预检数 |
| **BFF 层（Backend For Frontend）** | 前端只跟同源的 BFF 通信 |

**注意**：`Access-Control-Max-Age` 有浏览器上限，**你写再大也没用**：

| 浏览器 | 上限 |
|---|---|
| **Chrome / Edge（v76+）** | **7200 秒（2 小时）** |
| Chrome（v76 之前） | 600 秒（10 分钟） |
| **Firefox** | 86400 秒（24 小时） |
| Safari | 上限更低（按 10 分钟量级保守估计） |

**另外两个细节**：
- **默认值是 5 秒**（不写这个头时）
- **写 `-1` 表示禁用预检缓存**，每次都要重新预检

**所以你写 `Access-Control-Max-Age: 86400`，在 Chrome 里也只生效 2 小时。**

---

## 10.6 带 Cookie 的跨域请求（credentials）

**这是最容易出错的一块**，因为有三个必须同时满足的条件。

### 10.6.1 前端

```js
// fetch
fetch('https://api.com/data', {
  credentials: 'include',      // 'omit'（默认，不带）| 'same-origin' | 'include'（跨域也带）
});

// XHR
xhr.withCredentials = true;

// axios
axios.get('/data', { withCredentials: true });
```

### 10.6.2 服务端（三条规定，缺一不可）

```http
Access-Control-Allow-Origin: https://a.com        ← ① 必须是具体 origin，不能是 *
Access-Control-Allow-Credentials: true            ← ② 必须显式声明
Vary: Origin                                      ← ③ 必须加，防止缓存串版本
```

### 10.6.3 为什么 `Access-Control-Allow-Origin: *` 不能配 credentials

**这是必问的追问。**

```
假设允许 * + credentials：
    ↓
任何网站（包括 evil.com）都可以带着用户的 cookie 请求 api.com
    ↓
并且能读到响应
    ↓
→ 同源策略完全失效，等于没有
```

**规范直接禁止这个组合**：如果请求带了 credentials，而响应是 `ACAO: *`，浏览器会**报错并且不交出响应**。

**报错信息**：

```
The value of the 'Access-Control-Allow-Origin' header in the response
must not be the wildcard '*' when the request's credentials mode is 'include'.
```

**所以带 cookie 时必须「动态回显 Origin」**：

```js
// 服务端（Express 示例）
const ALLOW_LIST = ['https://a.com', 'https://b.com'];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOW_LIST.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);   // 动态回显
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Vary', 'Origin');                          // ★ 必须
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Access-Control-Max-Age', '7200');
    return res.status(204).end();
  }
  next();
});
```

### 10.6.4 `SameSite` 的影响（重要，常被漏掉）

**即使 CORS 配对了，Cookie 也可能带不上**，因为 Cookie 还有自己的 `SameSite` 限制：

| `SameSite` 值 | 跨站请求会带 cookie 吗 |
|---|---|
| `Strict` | ❌ 完全不带 |
| `Lax`（现代浏览器默认） | ⚠️ **只对顶层导航的 GET 带**，`fetch`/`XHR`/`POST` 都不带 |
| `None` | ✅ 带（但**必须同时有 `Secure`**，即只能 HTTPS） |

**所以跨域带 cookie 的完整要求是**：

```
① CORS：ACAO 具体 origin + ACAC: true + Vary: Origin
② Cookie：SameSite=None; Secure
③ 协议：必须 HTTPS（因为 Secure）
```

> **这是「跨域登录失败」最常见的三重坑**——很多人只配了 CORS，忘了 `SameSite=None`。

---

## 10.7 暴露自定义响应头

**JS 默认只能读 6 个「简单响应头」**：

```
Cache-Control
Content-Language
Content-Length
Content-Type
Expires
Last-Modified
Pragma
```

**其他头（比如 `X-Total-Count`、`Authorization`）默认读不到**，要服务端显式暴露：

```http
Access-Control-Expose-Headers: X-Total-Count, X-Request-Id
```

**这个坑很隐蔽**：`response.headers.get('X-Total-Count')` 返回 `null`，但 Network 面板里明明有——**因为是 CORS 没暴露，不是没返回**。

---

## 10.8 五种解决方案对比

### 10.8.1 总表

| 方案 | 原理 | 前端改动 | 服务端改动 | 支持 cookie | 支持方法 | 评价 |
|---|---|---|---|---|---|---|
| **① CORS** | 服务端返回授权头 | 带 `credentials` | 加 `ACAO` 等头 | ✅ | 全部 | **标准方案** |
| **② 代理（devServer / Nginx）** | 同源服务器转发，浏览器看不到跨域 | 改请求路径 | ✅ 配 proxy | ✅（同源自动带） | 全部 | **开发环境标配** |
| **③ JSONP** | `<script>` 不受 SOP 限制 | 动态插 script | 返回 `cb(data)` | ⚠️ 靠 cookie 自动带 | **只 GET** | 老旧，有 XSS 风险 |
| **④ postMessage** | 跨域窗口通信 | 监听 `message` | 对端页面配合 | — | — | iframe 嵌入场景 |
| **⑤ WebSocket** | 握手不受 SOP 限制 | 建 WS 连接 | 校验 `Origin` | — | — | 实时场景 |
| ~~⑥ document.domain~~ | 主域相同则互通 | 双方都设 | — | — | — | **已废弃**（Chrome 115 移除） |
| ~~⑦ 关闭浏览器安全策略~~ | `--disable-web-security` | — | — | — | — | **只能本地排查**，不能上线 |

### 10.8.2 方案一：CORS（生产标准）

**优点**：标准、灵活、支持所有方法和自定义头。
**缺点**：需要服务端配合；带 cookie 时配置复杂；每次非简单请求多一次预检。

**Nginx 配置模板**：

```nginx
location /api/ {
    # 动态回显 Origin（推荐，安全）
    if ($http_origin ~* "^https://(a|b)\.example\.com$") {
        add_header Access-Control-Allow-Origin $http_origin always;
        add_header Access-Control-Allow-Credentials true always;
    }
    add_header Vary Origin always;
    add_header Access-Control-Allow-Methods "GET,POST,PUT,DELETE,OPTIONS" always;
    add_header Access-Control-Allow-Headers "Content-Type,Authorization,X-Token" always;
    add_header Access-Control-Max-Age 7200 always;

    # 预检直接返回 204，不要转给后端
    if ($request_method = OPTIONS) {
        return 204;
    }

    proxy_pass http://backend;
}
```

**⚠️ 注意 `always`**：Nginx 的 `add_header` 默认只在 2xx/3xx 时生效，**4xx/5xx 不会加**！所以错误响应会丢 CORS 头，前端看到的是 CORS 错误而不是真正的 500。**必须加 `always`**。

**这是一个非常经典的坑**：后端报 500，前端却报 CORS 错误，根因就是 Nginx 没加 `always`。

### 10.8.3 方案二：代理（开发环境标配）

**原理**：让请求「看起来是同源」的，浏览器根本不认为跨域。

```
开发环境（webpack-dev-server / vite）：
  浏览器请求 http://localhost:3000/api/user     ← 同源！
      ↓ devServer 转发
  实际请求 http://backend:8080/api/user
      ↓
  响应原样返回给浏览器
```

```js
// Vite
export default {
  server: {
    proxy: {
      '/api': {
        target: 'http://backend:8080',
        changeOrigin: true,        // 改 Host 头为目标域名（虚拟主机必需）
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
};
```

```js
// webpack-dev-server
devServer: {
  proxy: {
    '/api': {
      target: 'http://backend:8080',
      changeOrigin: true,
      pathRewrite: { '^/api': '' },
    },
  },
}
```

**⚠️ `changeOrigin` 的作用**（常被问）：

```
changeOrigin: false（默认）
  转发时 Host 头还是 localhost:3000
  → 后端如果是虚拟主机（靠 Host 区分站点），会找不到对应站点 → 404 或 403

changeOrigin: true
  转发时 Host 头改成 backend:8080
  → 后端正常处理
```

**生产环境用 Nginx 做同样的事**：

```nginx
location /api/ {
    proxy_pass http://backend:8080/;      # 注意末尾斜杠
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**`proxy_pass` 末尾斜杠的坑**（再强调一次）：

```nginx
proxy_pass http://backend:8080;    # /api/user → /api/user  （保留前缀）
proxy_pass http://backend:8080/;   # /api/user → /user      （去掉前缀）
```

### 10.8.4 方案三：JSONP（了解即可，别再用）

**原理**：`<script src>` 不受同源策略限制，所以让服务端返回一段可执行的 JS。

```js
function jsonp(url, callbackName = 'callback') {
  return new Promise((resolve, reject) => {
    const name = `__jsonp_${Date.now()}`;
    window[name] = (data) => {
      resolve(data);
      delete window[name];
      script.remove();
    };
    const script = document.createElement('script');
    script.src = `${url}${url.includes('?') ? '&' : '?'}callback=${name}`;
    script.onerror = () => { reject(new Error('jsonp failed')); script.remove(); };
    document.body.appendChild(script);
  });
}

// 服务端返回：__jsonp_123456({ "code": 0, "data": [...] })
```

**三个致命缺陷**：

| 缺陷 | 说明 |
|---|---|
| **只支持 GET** | 因为是 `<script>` 加载，不能发 POST |
| **无法处理错误** | HTTP 500 时 script 加载成功但执行报错，拿不到错误码 |
| **XSS 风险** | 服务端返回的内容会被**当代码执行**。如果服务端被注入了恶意 JS，直接在你页面执行 |
| **无法设置超时/取消** | 只能靠清理 script 标签 |

**为什么现在不用了**：CORS 全面支持（IE10+），JSONP 没有存在必要。

### 10.8.5 方案四：postMessage（iframe 通信）

```js
// 父页面（https://a.com）
iframe.contentWindow.postMessage({ type: 'ping' }, 'https://b.com');   // ★ 必须指定目标 origin

window.addEventListener('message', (e) => {
  // ★ 必须校验 origin！否则任何页面都能给你发消息
  if (e.origin !== 'https://b.com') return;
  console.log(e.data);
});

// 子页面（https://b.com）
window.addEventListener('message', (e) => {
  if (e.origin !== 'https://a.com') return;
  e.source.postMessage({ type: 'pong' }, e.origin);   // 用 e.origin 回，最安全
});
```

**两个必须做的校验**：

1. **`postMessage` 的第二个参数必须指定具体 origin**（不能是 `*`，否则消息可能被恶意页面截获）
2. **接收时必须校验 `e.origin`**（否则任何页面都能给你发消息）

**用途**：微前端、嵌入第三方 widget（支付、地图、客服）、OAuth 弹窗回调。

### 10.8.6 方案五：WebSocket

**握手不受同源策略限制**，所以可以直接连跨域的 WS。

**但服务端必须校验 `Origin`**（否则就是 CSWSH 漏洞）。详见 11 册。

### 10.8.7 怎么选

```
开发环境？
  └─ 是 → devServer proxy（最省事，前端一个人就能搞定）

生产环境？
  ├─ 能改服务端 → CORS（标准方案，首选）
  ├─ 不能改服务端，但有网关/Nginx → 反向代理
  ├─ 需要 iframe 嵌入 → postMessage
  ├─ 需要实时双向 → WebSocket（服务端校验 Origin）
  └─ 只有 GET + 极老浏览器 → JSONP（基本不用了）
```

---

## 10.9 六个常见报错与排查

| 报错 | 原因 | 修复 |
|---|---|---|
| `No 'Access-Control-Allow-Origin' header is present on the requested resource` | 服务端没返回 ACAO 头 | 加 CORS 配置；检查是否被 Nginx 的 `add_header` 覆盖 |
| `The 'Access-Control-Allow-Origin' header has a value 'https://x.com' that is not equal to the supplied origin` | ACAO 的值和 `Origin` 不匹配 | 检查是否写死了错误的域名 |
| `The value of the 'Access-Control-Allow-Credentials' header in the response is '' which must be 'true' when the request's credentials mode is 'include'` | 前端带了 cookie，服务端没开 ACAC | 加 `Access-Control-Allow-Credentials: true` |
| `Response to preflight request doesn't pass access control check` | **预检失败**（OPTIONS 请求没被正确处理） | 服务端/网关要处理 OPTIONS，返回 204 + CORS 头 |
| `Request header field x-token is not allowed by Access-Control-Allow-Headers` | 自定义头没在允许列表 | 加 `Access-Control-Allow-Headers: X-Token` |
| `The 'Access-Control-Allow-Origin' header contains multiple values 'a, b', but only one is allowed` | **重复设置**（Nginx 和后端都加了 ACAO） | 只在一处设置 |

**第五条特别值得说**（Nginx 的经典坑）：

```nginx
# Nginx 加了
add_header Access-Control-Allow-Origin https://a.com;
# 后端也加了
res.setHeader('Access-Control-Allow-Origin', 'https://a.com');

# 结果：响应里有两个 ACAO 头
Access-Control-Allow-Origin: https://a.com
Access-Control-Allow-Origin: https://a.com
# → 浏览器报 "contains multiple values"，直接失败
```

**解决**：只在一层设置。通常建议**在网关/Nginx 统一处理 CORS**，后端不再加。

---

## 10.10 常见坑

| 坑 | 正确说法 |
|---|---|
| **说「跨域就是请求发不出去」** | 请求**发出去了**，服务器也处理了，只是 JS **读不到**响应 |
| **说「img/script/link 不受同源策略限制」** | 它们可以跨域**加载**，但**不能读内容**；SOP 限制「读」不限制「发」 |
| 说「CORS 是前端要配的」 | CORS 是**服务端**返回头，前端只能带 `credentials` |
| 说「设置 `Access-Control-Allow-Origin` 在请求头里」 | ACAO 是**响应头**，不是请求头 |
| 说「带 cookie 时 ACAO 可以写 `*`」 | **规范禁止**，必须具体 origin |
| 忘加 `Vary: Origin` | CDN/代理会把 A 站的响应返给 B 站 |
| 忘配 `SameSite=None; Secure` | CORS 配对了 cookie 也带不上 |
| 说「`Content-Type: application/json` 是简单请求」 | **不是**，只有 urlencoded / form-data / text/plain 三种 |
| 说「`Authorization` 不触发预检」 | **会触发**（不在安全列表头里） |
| 以为预检结果永久缓存 | 受浏览器上限限制（Chrome 7200 秒） |
| Nginx `add_header` 没加 `always` | 4xx/5xx 响应会丢 CORS 头，前端看到假 CORS 错误 |
| Nginx 和后端都设 ACAO | 响应有多个值，直接失败 |
| 说「`document.domain` 可以解决跨域」 | **已废弃**（Chrome 115 移除） |
| 说「用 `--disable-web-security` 能解决」 | 只能本地排查，上线无效 |
| JSONP 用于 POST | **只支持 GET** |

---

## 10.11 答题模板

### 30 秒版

> 跨域是因为浏览器的**同源策略**——协议、域名、端口三者有一个不同就是跨域。
> 但要注意，**同源策略限制的是「读取响应」，不是「发送请求」**。简单请求其实已经发出去了、服务器也处理了，只是浏览器不让 JS 读响应内容。
> 解决方式主要两种：服务端返回 CORS 头授权，或者用代理让请求变成同源。另外 JSONP、postMessage、WebSocket 也能解决特定场景。

### 2 分钟版（完整版，含预检和 cookie）

> 我分四块讲：为什么会跨域、同源策略到底限制什么、CORS 的两种请求、以及带 cookie 的坑。
>
> **第一，跨域的判定**。协议、域名、端口三者完全相同才叫同源。注意子域名也算跨域，`a.example.com` 和 `b.example.com` 是跨域的。
>
> **第二，同源策略限制的是「读」不是「发」**。这点很多人说错。比如 `img`、`script`、`link` 可以跨域加载，因为浏览器只需要渲染/执行/应用，不需要把内容交给 JS。但你要用 `fetch` 读内容就不行。这也解释了 CSRF——攻击者不需要读响应，只要请求被执行就够了，所以防 CSRF 不能靠同源策略。
>
> **第三，CORS 分两种请求**。**简单请求**要同时满足三个条件：方法是 GET/HEAD/POST；头部只能是安全列表里的（Accept、Accept-Language、Content-Language、Content-Type、Range）；**Content-Type 只能是 urlencoded、form-data、text/plain 三种**。这就是为什么用 `application/json` 一定会触发预检。**非简单请求**先发一个 OPTIONS 预检，带 `Access-Control-Request-Method` 和 `Access-Control-Request-Headers`，服务端回 `Allow-Methods`、`Allow-Headers` 和 `Max-Age`，通过了才发真实请求。所以一个非简单请求是 2 个 RTT，优化手段是配大 `Max-Age`（Chrome 上限 2 小时）。
>
> **第四，带 cookie 的跨域有三个坑**。一是 `Access-Control-Allow-Origin` **不能是 `*`**，必须动态回显具体的 origin——否则任何网站都能带用户 cookie 读你的接口，等于没有同源策略。二是必须加 `Access-Control-Allow-Credentials: true` 和 `Vary: Origin`。三是**Cookie 本身还要 `SameSite=None; Secure`**，因为现代浏览器默认 `Lax`，跨站的 fetch/XHR 根本不带 cookie。这三个缺一个就失败，而且报错信息各不相同，很难排查。
>
> 最后说解决方案选型：开发环境用 devServer proxy 最省事；生产环境首选 CORS；不能改服务端但有网关就用反向代理；iframe 嵌入用 postMessage，记得双向校验 origin；实时场景用 WebSocket，但服务端必须自己校验 Origin。
>
> 还有一个运维坑值得提：Nginx 的 `add_header` 默认只在 2xx/3xx 生效，**不加 `always` 的话 4xx/5xx 响应会丢 CORS 头**，前端看到的是 CORS 错误而不是真正的 500，排查会被带偏。

### 追问表

| 追问 | 回答要点 |
|---|---|
| 同源策略限制什么 | 限制**读取**跨源响应，不限制发送 |
| img/script/link 为什么能跨域 | 它们只需加载/执行/应用，不需要 JS 读内容 |
| 简单请求的三个条件 | 方法三种 + 安全列表头 + Content-Type 三种 |
| 为什么 JSON 会触发预检 | `application/json` 不在简单 Content-Type 白名单 |
| `Authorization` 会触发预检吗 | 会，不在安全列表头里 |
| 预检请求长什么样 | OPTIONS + `Request-Method` + `Request-Headers` |
| 预检能缓存吗 | 能，`Access-Control-Max-Age`；Chrome 上限 7200 秒 |
| 带 cookie 为什么要具体 origin | `*` + credentials 等于取消同源策略，规范禁止 |
| 为什么还要 `SameSite=None` | Cookie 自身限制，`Lax` 下跨站 fetch 不带 |
| 为什么加 `Vary: Origin` | 防止 CDN 把 A 站的响应（含 CORS 头）返给 B 站 |
| 自定义响应头读不到怎么办 | `Access-Control-Expose-Headers` |
| JSONP 有什么问题 | 只支持 GET、拿不到错误码、XSS 风险 |
| `changeOrigin` 有什么用 | 改转发时的 Host 头，虚拟主机必需 |
| WebSocket 受同源限制吗 | 不受，但服务端必须校验 Origin（防 CSWSH） |
| `document.domain` 还能用吗 | 已废弃，Chrome 115 移除 |
| 生产环境推荐哪个方案 | CORS；有网关就反向代理 |
| Nginx 加 CORS 头为什么有时不生效 | `add_header` 默认不加到 4xx/5xx，必须加 `always` |
| 报「contains multiple values」怎么办 | Nginx 和后端都设了 ACAO，只留一处 |

---

## 10.12 速记卡

```
同源 = 协议 + 域名 + 端口 三者全同
  ★ SOP 限制「读响应」，不限制「发请求」
  ★ img/script/link 能跨域加载，但不能读内容
  ★ 所以 CSRF 防不住靠 SOP（攻击者不需要读）

简单请求三条件（缺一就预检）
  ① 方法 GET / HEAD / POST
  ② 头只能是安全列表（Accept / Accept-Language / Content-Language / Content-Type / Range）
  ③ Content-Type 只能是 urlencoded / form-data / text/plain
  ★ application/json 和 Authorization 都会触发预检

预检
  OPTIONS + Access-Control-Request-Method + -Request-Headers
  响应 Allow-Methods / Allow-Headers / Max-Age
  成本：2 RTT；Max-Age 缓存（Chrome 上限 7200s）

带 cookie 三件套（缺一失败）
  ① ACAO 具体 origin（不能 *）
  ② Access-Control-Allow-Credentials: true
  ③ Vary: Origin
  + Cookie 自身：SameSite=None; Secure（必须 HTTPS）

其他
  自定义响应头要 Access-Control-Expose-Headers
  默认只能读 6 个简单响应头

五个方案
  CORS（标准）/ 代理（开发标配，changeOrigin 改 Host）/ JSONP（只 GET，已淘汰）
  / postMessage（iframe，双向校验 origin）/ WebSocket（服务端校验 Origin）
  document.domain 已废弃

三个量产坑
  Nginx add_header 不加 always → 4xx/5xx 丢 CORS 头（假 CORS 错误）
  Nginx + 后端都设 ACAO → 多个值直接失败
  proxy_pass 末尾斜杠 → 决定是否保留路径前缀
```
