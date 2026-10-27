# 网络 · 10 跨域与 CORS

> 覆盖：同源判定、简单请求与预检、credentials、暴露响应头、五种方案
> `ACAO` 指 `Access-Control-Allow-Origin`，`ACAC` 指 `Access-Control-Allow-Credentials`
> 简单请求、预检、credentials、`Expose-Headers` 的行为均在 Chrome 154 下用两个本地端口实测：`127.0.0.1:7001` 为页面源，`127.0.0.1:7002` 为接口

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
简单请求已经发出、服务端也已经处理，只是浏览器不把响应交给 JS。
解法只有两条路：**服务端明确授权（CORS）**，或者**让请求变成同源（代理）**。

---

## 10.2 同源策略：到底限制了什么（先纠正题单）

### 10.2.1 什么叫「同源」

**协议 + 域名 + 端口**三者**完全相同**才是同源。以 `https://www.example.com:443/page` 为基准：

| URL | 是否同源 | 差异 |
|---|---|---|
| `https://www.example.com/other` | ✅ 同源 | 路径不同不影响 |
| `https://www.example.com:443/x` | ✅ 同源 | 443 是 https 默认端口 |
| `http://www.example.com/page` | ❌ | **协议不同** |
| `https://api.example.com/page` | ❌ | **域名不同**（子域也算不同） |
| `https://www.example.com:8080/page` | ❌ | **端口不同** |
| `https://example.com/page` | ❌ | **域名不同**（有无 www 算不同） |

- 默认端口等价：`https://a.com` 与 `https://a.com:443` 同源，`http://a.com` 与 `http://a.com:80` 同理
- 子域、有无 `www`、IP 与域名都算不同源：`a.example.com` / `b.example.com`、`127.0.0.1` / `localhost`

### 10.2.2 不是「img/script/link 不受限」

把「能不能发」和「能不能读」分开：

| 方式 | 能否**发出**跨域请求 | 能否**读取响应内容** |
|---|---|---|
| `fetch` / `XHR` | ✅ 能（简单请求直接发，非简单先预检） | ❌ **默认不能**（需要 CORS 授权） |
| `<img src>` | ✅ 能 | ❌ 不能读像素（但能读 `width`/`height`、能 `onload`/`onerror`） |
| `<script src>` | ✅ 能 | ❌ 不能读源码（但**会执行**） |
| `<link rel=stylesheet>` | ✅ 能 | ❌ 不能读 CSS 规则（但**会应用**） |
| `<iframe src>` | ✅ 能 | ❌ 不能读 DOM（同源才能） |
| `<video>` / `<audio>` | ✅ 能 | ❌ 不能读媒体数据（`crossorigin` 影响 canvas 能否读） |
| `<form action>` | ✅ 能（会跳转） | ❌ 不能读结果 |

这些标签只需要浏览器加载、执行或应用，内容不必交给 JS；`fetch`/`XHR` 要把响应体交给 JS，所以受读取限制。

- **`<script>` 能执行跨域脚本**是历史设计（CDN 分发），代价是脚本拥有页面的全部权限，因此有 SRI（Subresource Integrity）校验完整性
- **`<img>` 不能读像素**：否则 canvas 可以把用户在其他站点的图片读出来

### 10.2.3 同源策略到底保护什么

保护的是**用户的登录态**。访问 `evil.com` 后，它的 JS 请求 `bank.com/transfer`，浏览器会自动带上 `bank.com` 的 Cookie；同源策略阻止的是 `evil.com` 读到响应，而不是阻止请求执行。

因此 CSRF 不需要读响应，只要「请求被执行」就够（转账、改密码不需要看结果），**防 CSRF 不能靠同源策略**，要靠 CSRF Token、`SameSite` Cookie、Origin 校验（详见「前端安全」分册）。

### 10.2.4 受同源策略限制的 API

不只是 `fetch`/`XHR`：

| API | 限制 |
|---|---|
| `fetch` / `XMLHttpRequest` | 读响应需要 CORS |
| **Cookie / localStorage / sessionStorage / IndexedDB** | **按源隔离**，不同源完全不同 |
| **iframe 的 DOM** | 跨域不能读（`contentWindow.document` 抛错） |
| **Canvas 的 `getImageData`** | 画了跨域图片后 canvas 被「污染」，读像素抛错 |
| **Web Font（`@font-face`）** | 需要 CORS（字体按跨域资源处理） |
| **跨域样式表的 `cssRules`** | 读取规则抛 `SecurityError` |
| **`window.opener` 访问** | 跨域受限（需 `postMessage`） |

字体是典型场景：`@font-face` 指向 CDN，CDN 没返回 `ACAO` 时字体静默回退到系统字体，只在控制台留一条 CORS 报错，页面本身不报错。解决方式是给字体文件加 `Access-Control-Allow-Origin`。

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

WebSocket 握手就是一个 HTTP 请求：

```
GET /chat HTTP/1.1
Upgrade: websocket
Origin: https://evil.com        ← 浏览器会带，但不会因此阻止连接
```

浏览器不会因为跨域拒绝 WebSocket 连接，所以**服务端不校验 `Origin` 就等于允许任意站点连接（CSWSH，跨站 WebSocket 劫持）**。同源策略保护的是用户，不是服务端。

---

## 10.4 CORS 简单请求（纠正题单）

### 10.4.1 三个条件（必须**同时**满足）

1. **方法**：`GET` / `HEAD` / `POST`
2. **请求头**：只能是 CORS 安全列表头，不能有自定义头
3. **请求体**：不能是 `ReadableStream`

安全列表请求头：

| 头 | 允许的值 |
|---|---|
| `Accept` | 任意（不含 CORS 不安全的字节） |
| `Accept-Language` | 任意 |
| `Content-Language` | 任意 |
| `Content-Type` | **只能是下面三个值之一** |
| `Range` | 只能是简单 range（如 `bytes=0-99`） |

**`Content-Type` 只有三种**：

```
application/x-www-form-urlencoded
multipart/form-data
text/plain
```

```js
// ❌ 触发预检：application/json 不在白名单里
fetch('https://api.com/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ a: 1 }),
});

// ✅ 不触发预检（但服务端要能解析 form 格式）
fetch('https://api.com/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: 'a=1',
});
```

实测：`text/plain` 与 `application/x-www-form-urlencoded` 的 POST 只有一次请求；`application/json` 的 POST 先收到 `OPTIONS`，通过后才收到 `POST`。

### 10.4.2 简单请求的完整流程

```
① 浏览器发出请求，自动加 Origin 头（JS 改不了）
   GET /data HTTP/1.1
   Origin: https://a.com

② 服务器返回，必须带 CORS 头
   HTTP/1.1 200 OK
   Access-Control-Allow-Origin: https://a.com

③ 浏览器检查
   · ACAO 匹配（或为 *）→ 把响应交给 JS
   · 不匹配/缺失 → 【拦截响应】
```

- **请求真的发出去了，服务器也真的处理了**（可能已经写库）
- **拦截发生在响应返回之后**，JS 拿到的是 `TypeError: Failed to fetch`，具体原因只在控制台里（出于安全考虑，浏览器不告诉 JS 详情）

---

## 10.5 预检请求

### 10.5.1 什么时候触发预检

**只要不满足简单请求的任一条件**，就触发预检：

| 触发条件 | 例子 |
|---|---|
| **方法不是 GET/HEAD/POST** | `PUT`、`DELETE`、`PATCH` |
| **有自定义请求头** | `X-Token`、`Authorization`（`Authorization` 不是安全列表头） |
| **`Content-Type` 不是那三种** | `application/json`、`text/xml` |
| **`ReadableStream` 作为 body** | — |

**禁止修改的请求头不触发预检**：手动设置 `Referer`、`User-Agent` 这类头会被浏览器直接忽略，实测请求里仍是浏览器自己的值，也没有多发 `OPTIONS`。

### 10.5.2 预检的完整交互

```
① 预检请求（OPTIONS，不带 body）
   OPTIONS /api/data HTTP/1.1
   Origin: https://a.com
   Access-Control-Request-Method: PUT                    ← 接下来要用的方法
   Access-Control-Request-Headers: content-type,x-token  ← 小写、逗号分隔

② 预检响应
   HTTP/1.1 204 No Content
   Access-Control-Allow-Origin: https://a.com
   Access-Control-Allow-Methods: GET, POST, PUT, DELETE
   Access-Control-Allow-Headers: Content-Type, X-Token
   Access-Control-Max-Age: 86400                          ← 期间不再预检
   Access-Control-Allow-Credentials: true                 ← 如果带 cookie

③ 预检通过 → 浏览器发真正的请求（带 Origin）
   PUT /api/data HTTP/1.1
   Origin: https://a.com
   Content-Type: application/json

④ 真实响应也要带 CORS 头
   HTTP/1.1 200 OK
   Access-Control-Allow-Origin: https://a.com
```

实测：`X-Token` 触发的预检里，`Access-Control-Request-Headers` 为 `x-token`；`PUT` 触发的预检里，`Access-Control-Request-Method` 为 `PUT`。

| 请求数 | 成本 |
|---|---|
| 无预检（简单请求） | 1 RTT |
| 有预检（未缓存） | **2 RTT**（OPTIONS + 真实请求） |
| 有预检 + `Max-Age` 缓存 | 首次 2 RTT，之后 1 RTT |

实测：`Max-Age: 60` 时，同一 URL 的第二次 JSON POST 没有再发 `OPTIONS`。

### 10.5.3 怎么减少预检

| 手段 | 说明 |
|---|---|
| **`Access-Control-Max-Age` 设大** | 浏览器缓存预检结果，时长受上限约束 |
| **改用简单请求** | 比如用 `application/x-www-form-urlencoded` 代替 JSON（但服务端要能解析） |
| **同域代理** | 走 `devServer.proxy` 或 Nginx 反向代理，根本不跨域 → 无预检 |
| **合并接口 / BFF** | 减少请求数，前端只跟同源的 BFF 通信 |

`Max-Age` 的取值规则：

- **不写该头时默认 5 秒**
- **写负数（如 `-1`）表示不缓存**，每次都要重新预检
- 各浏览器会把值截断到自己的上限，写更大也不保证生效（Chrome 7200 秒，Firefox 86400 秒）

---

## 10.6 带 Cookie 的跨域请求（credentials）

Cookie 能不能带上，取决于**前端 credentials 模式、CORS 响应头、Cookie 的 `SameSite`** 三方同时满足。

### 10.6.1 前端

```js
// fetch：默认 'same-origin'，跨域不带 Cookie
fetch('https://api.com/data', {
  credentials: 'include',      // 'omit' | 'same-origin'（默认）| 'include'
});

// XHR
xhr.withCredentials = true;

// axios
axios.get('/data', { withCredentials: true });
```

实测：同一页面不传 `credentials` 时服务端收不到 Cookie，传 `include` 才收到。

### 10.6.2 服务端（三条规定）

```http
Access-Control-Allow-Origin: https://a.com        ← ① 必须是具体 origin，不能是 *
Access-Control-Allow-Credentials: true            ← ② 必须显式声明
Vary: Origin                                      ← ③ 有 CDN/缓存层时必须加，否则会串响应
```

①② 缺任一条浏览器就拒绝交出响应；③ 决定响应能否被缓存复用，不写时缓存层可能把 A 站的响应返给 B 站。

### 10.6.3 为什么 `Access-Control-Allow-Origin: *` 不能配 credentials

`*` + credentials 等于允许任意站点（包括 `evil.com`）带着用户的 Cookie 请求并读到响应，同源策略完全失效。规范直接禁止这个组合，浏览器报错并丢弃响应：

```
The value of the 'Access-Control-Allow-Origin' header in the response
must not be the wildcard '*' when the request's credentials mode is 'include'.
```

实测 console 原样输出该信息，`fetch` 侧只得到 `TypeError: Failed to fetch`。所以带 cookie 时必须**动态回显 Origin**：

```js
// 服务端（Express 示例）
const ALLOW_LIST = ['https://a.com', 'https://b.com'];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (ALLOW_LIST.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);   // 动态回显
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Access-Control-Max-Age', '7200');
    return res.status(204).end();
  }
  next();
});
```

只开 `ACAC` 而 `ACAO` 仍是 `*`，或 `ACAO` 正确但少了 `ACAC`，浏览器都会拦截；后者实测报 `The value of the 'Access-Control-Allow-Credentials' header in the response is '' which must be 'true' when the request's credentials mode is 'include'`。

### 10.6.4 `SameSite` 的影响

CORS 配对了，Cookie 也可能带不上，因为 Cookie 自身还有 `SameSite`：

| `SameSite` 值 | 跨站请求会带 cookie 吗 |
|---|---|
| `Strict` | ❌ 完全不带 |
| `Lax`（现代浏览器默认） | ⚠️ **只对顶层导航的 GET 带**，`fetch`/`XHR`/`POST` 都不带 |
| `None` | ✅ 带（但**必须同时有 `Secure`**，即只能 HTTPS） |

CORS 三条（10.6.2）加 `SameSite=None; Secure`，缺任一条跨域登录就失败，且报错各不相同。

---

## 10.7 暴露自定义响应头

**JS 默认只能读 7 个「CORS 安全列表响应头」**：

```
Cache-Control
Content-Language
Content-Length
Content-Type
Expires
Last-Modified
Pragma
```

**其他头（比如 `X-Total-Count`、`X-Request-Id`）默认读不到**，要服务端显式暴露：

```http
Access-Control-Expose-Headers: X-Total-Count, X-Request-Id
```

实测同一份响应：加 `Expose-Headers` 后 `headers.get('X-Total-Count')` 拿到值，未暴露的 `X-Secret` 和未声明的 `X-Request-Id` 都是 `null`。Network 面板里这些头照常显示，读不到是 CORS 过滤，不是没返回。

---

## 10.8 五种解决方案对比

### 10.8.1 总表

| 方案 | 原理 | 前端改动 | 服务端改动 | 支持 cookie | 支持方法 |
|---|---|---|---|---|---|
| **① CORS** | 服务端返回授权头 | 带 `credentials` | 加 `ACAO` 等头 | ✅ | 全部 |
| **② 代理（devServer / Nginx）** | 同源服务器转发，浏览器看不到跨域 | 改请求路径 | 配 proxy | ✅（同源自动带） | 全部 |
| **③ JSONP** | `<script>` 不受 SOP 限制 | 动态插 script | 返回 `cb(data)` | ⚠️ 浏览器自动带 | **只 GET** |
| **④ postMessage** | 跨域窗口通信 | 监听 `message` | 对端页面配合 | — | — |
| **⑤ WebSocket** | 握手不受 SOP 限制 | 建 WS 连接 | 校验 `Origin` | — | — |
| ~~⑥ document.domain~~ | 主域相同则互通 | 双方都设 | — | — | **已废弃**（Chrome 115 移除） |
| ~~⑦ 关闭浏览器安全策略~~ | `--disable-web-security` | — | — | — | **只能本地排查** |

### 10.8.2 方案一：CORS（生产标准）

优点：标准、支持所有方法和自定义头。缺点：需要服务端配合；带 cookie 时配置复杂；非简单请求多一次预检。

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

**`always` 不能省**：Nginx 的 `add_header` 默认只在 2xx/3xx 生效，4xx/5xx 响应会丢 CORS 头，前端看到的是 CORS 错误而不是真正的 500。

### 10.8.3 方案二：代理（开发环境标配）

让请求「看起来是同源」，浏览器根本不认为跨域：

```
浏览器请求 http://localhost:3000/api/user     ← 同源
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

`changeOrigin` 控制转发时的 Host 头：`false`（默认）仍是 `localhost:3000`，后端按 Host 区分站点时会 404/403；`true` 改成 `backend:8080`，后端正常处理。

生产环境用 Nginx 做同样的事：

```nginx
location /api/ {
    proxy_pass http://backend:8080/;      # 注意末尾斜杠
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

`proxy_pass` 末尾斜杠决定是否保留前缀：

```nginx
proxy_pass http://backend:8080;    # /api/user → /api/user  （保留前缀）
proxy_pass http://backend:8080/;   # /api/user → /user      （去掉前缀）
```

### 10.8.4 方案三：JSONP（了解即可，别再用）

原理：`<script src>` 不受同源策略限制，让服务端返回一段可执行的 JS。

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

**四个缺陷**：

| 缺陷 | 说明 |
|---|---|
| **只支持 GET** | 因为是 `<script>` 加载，不能发 POST |
| **无法处理错误** | HTTP 500 时 script 加载成功但执行报错，拿不到错误码 |
| **XSS 风险** | 服务端返回的内容会被**当代码执行** |
| **无法设置超时/取消** | 只能靠清理 script 标签 |

CORS 已全面支持，JSONP 只适合极老浏览器或无法改服务端的 GET 场景。

### 10.8.5 方案四：postMessage（iframe 通信）

```js
// 父页面（https://a.com）
iframe.contentWindow.postMessage({ type: 'ping' }, 'https://b.com');   // 必须指定目标 origin

window.addEventListener('message', (e) => {
  if (e.origin !== 'https://b.com') return;   // 必须校验 origin
  console.log(e.data);
});

// 子页面（https://b.com）
window.addEventListener('message', (e) => {
  if (e.origin !== 'https://a.com') return;
  e.source.postMessage({ type: 'pong' }, e.origin);   // 用 e.origin 回，最安全
});
```

两个必须做的校验：

1. **发送时第二个参数指定具体 origin**（不能是 `*`，否则消息可能被恶意页面截获）
2. **接收时校验 `e.origin`**（否则任何页面都能给你发消息）

用途：微前端、嵌入第三方 widget（支付、地图、客服）、OAuth 弹窗回调。

### 10.8.6 方案五：WebSocket

握手不受同源策略限制，可以直接连跨域 WS；**服务端必须校验 `Origin`**，否则就是 CSWSH 漏洞（详见 11 册）。

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
| `No 'Access-Control-Allow-Origin' header is present on the requested resource` | 服务端没返回 ACAO 头 | 加 CORS 配置 |
| `The 'Access-Control-Allow-Origin' header has a value 'https://x.com' that is not equal to the supplied origin` | ACAO 的值和 `Origin` 不匹配 | 检查是否写死了错误的域名 |
| `The value of the 'Access-Control-Allow-Credentials' header in the response is '' which must be 'true' when the request's credentials mode is 'include'` | 前端带了 cookie，服务端没开 ACAC | 加 `Access-Control-Allow-Credentials: true` |
| `Response to preflight request doesn't pass access control check` | **预检失败**（OPTIONS 没被正确处理） | 服务端/网关处理 OPTIONS，返回 204 + CORS 头 |
| `Request header field x-token is not allowed by Access-Control-Allow-Headers` | 自定义头没在允许列表 | 加 `Access-Control-Allow-Headers: X-Token` |
| `The 'Access-Control-Allow-Origin' header contains multiple values 'a, b', but only one is allowed` | **重复设置**（Nginx 和后端都加了 ACAO） | 只在一处设置 |

排查顺序：先看 Network 里 `OPTIONS` 的响应头（预检问题都出在这里），再看真实响应的 CORS 头；前五条都是服务端缺头，最后一条是两层都设置了头。

---

## 10.10 常见坑

| 说法 | 事实 |
|---|---|
| 说「CORS 是前端要配的」 | CORS 是**服务端**返回头，前端只能决定带不带 `credentials` |
| 说「把 `Access-Control-Allow-Origin` 加在请求头里」 | ACAO 是**响应头**，不是请求头 |
| 以为预检结果永久缓存 | 受 `Access-Control-Max-Age` 和浏览器上限约束 |
| 说「`document.domain` 可以解决跨域」 | **已废弃**（Chrome 115 移除） |
| 说「用 `--disable-web-security` 能解决」 | 只能本地排查，上线无效 |
| JSONP 用于 POST | **只支持 GET** |

---

## 10.11 答题模板

### 30 秒版

> 跨域是因为浏览器的**同源策略**——协议、域名、端口三者有一个不同就是跨域。
> 但同源策略限制的是**读取响应**，不是发送请求：简单请求已经发出、服务器也处理了，只是浏览器不让 JS 读响应内容。
> 解决方式两种主路：服务端返回 CORS 头授权，或者用代理让请求变成同源；JSONP、postMessage、WebSocket 只覆盖特定场景。

### 2 分钟版（完整版，含预检和 cookie）

- **判定**：协议、域名、端口三者完全相同才同源；子域、有无 `www`、IP 与域名都算跨域。
- **限制的是「读」不是「发」**：`img`/`script`/`link` 能跨域加载，因为浏览器只需渲染、执行或应用，不必把内容交给 JS；`fetch` 读响应体就必须有 CORS 授权。CSRF 正是利用了「请求会执行」这一点，所以防 CSRF 不能靠同源策略。
- **两种请求**：简单请求要同时满足方法为 `GET`/`HEAD`/`POST`、只用安全列表头、`Content-Type` 为 urlencoded/form-data/text-plain；其余先发 `OPTIONS` 预检，带 `Access-Control-Request-Method` 和 `Request-Headers`，服务端回 `Allow-Methods`/`Allow-Headers`/`Max-Age`，通过后才发真实请求（2 RTT）。
- **带 cookie 三件套**：`ACAO` 回显具体 origin（不能是 `*`）、`Access-Control-Allow-Credentials: true`、`Vary: Origin`；此外 Cookie 自身要 `SameSite=None; Secure`，否则现代浏览器默认的 `Lax` 不会在跨站 `fetch` 里带 Cookie。
- **选型**：开发环境用 devServer proxy；生产首选 CORS；不能改服务端就反向代理；iframe 嵌入用 postMessage 并双向校验 origin；实时场景用 WebSocket，服务端校验 `Origin`。

### 追问表

| 追问 | 回答要点 |
|---|---|
| 同源策略限制什么 | 限制**读取**跨源响应，不限制发送 |
| img/script/link 为什么能跨域 | 它们只需加载/执行/应用，不需要 JS 读内容 |
| 简单请求的三个条件 | 方法三种 + 安全列表头 + `Content-Type` 三种 |
| 为什么 JSON 会触发预检 | `application/json` 不在简单 `Content-Type` 白名单 |
| `Authorization` 会触发预检吗 | 会，不在安全列表头里 |
| 预检请求长什么样 | `OPTIONS` + `Request-Method` + `Request-Headers` |
| 预检能缓存吗 | 能，`Access-Control-Max-Age`，受浏览器上限约束 |
| 带 cookie 为什么要具体 origin | `*` + credentials 等于取消同源策略，规范禁止 |
| 为什么还要 `SameSite=None` | Cookie 自身限制，`Lax` 下跨站 `fetch` 不带 |
| 为什么加 `Vary: Origin` | 防止缓存层把 A 站的响应（含 CORS 头）返给 B 站 |
| 自定义响应头读不到怎么办 | `Access-Control-Expose-Headers` |
| JSONP 有什么问题 | 只支持 GET、拿不到错误码、XSS 风险 |
| `changeOrigin` 有什么用 | 改转发时的 Host 头，虚拟主机必需 |
| WebSocket 受同源限制吗 | 不受，但服务端必须校验 Origin（防 CSWSH） |
| 生产环境推荐哪个方案 | CORS；有网关就反向代理 |

---

## 10.12 速记卡

```
同源 = 协议 + 域名 + 端口 三者全同
  SOP 限制「读响应」，不限制「发请求」
  img/script/link 能跨域加载，但不能读内容
  CSRF 防不住 SOP（攻击者不需要读）

简单请求三条件（缺一就预检）
  ① 方法 GET / HEAD / POST
  ② 头只能是安全列表（Accept / Accept-Language / Content-Language / Content-Type / Range）
  ③ Content-Type 只能是 urlencoded / form-data / text/plain
  application/json、Authorization 都会触发预检

预检
  OPTIONS + Access-Control-Request-Method + -Request-Headers
  响应 Allow-Methods / Allow-Headers / Max-Age
  成本 2 RTT；Max-Age 缓存后 1 RTT

带 cookie（缺一失败）
  ACAO 具体 origin（不能 *）+ ACAC: true + Vary: Origin
  Cookie 自身：SameSite=None; Secure（HTTPS）

其他
  自定义响应头要 Access-Control-Expose-Headers（默认只能读 7 个安全列表头）
  fetch 的 credentials 默认 'same-origin'，跨域要显式 'include'

五个方案
  CORS（标准）/ 代理（devServer、changeOrigin 改 Host）/ JSONP（只 GET）
  / postMessage（双向校验 origin）/ WebSocket（服务端校验 Origin）
  document.domain 已废弃

运维坑
  Nginx add_header 不加 always → 4xx/5xx 丢 CORS 头
  Nginx 和后端都设 ACAO → 多个值直接失败
  proxy_pass 末尾斜杠 → 决定是否保留路径前缀
```
