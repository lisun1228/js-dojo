# 网络 · 06 HTTP 报文 · 方法 · 状态码 · 头部

> 本册覆盖：状态码、请求方法、报文格式、常用头、重定向 vs 转发
> 高频细节：301 vs 302、304 有没有 body、401 vs 403、307 为何存在。

---

## 目录

- [6.1 一句话结论](#61-一句话结论)
- [6.2 报文格式（逐字节看清）](#62-报文格式逐字节看清)
- [6.3 请求方法](#63-请求方法)
- [6.4 状态码全表](#64-状态码全表)
- [6.5 3xx 详解（核心）](#65-3xx-详解核心)
- [6.6 常用请求头](#66-常用请求头)
- [6.7 常用响应头](#67-常用响应头)
- [6.8 重定向 vs 转发](#68-重定向-vs-转发)
- [6.9 101 Switching Protocols](#69-101-switching-protocols)
- [6.10 常见坑](#610-常见坑)
- [6.11 答题模板](#611-答题模板)
- [6.12 速记卡](#612-速记卡)

---

## 6.1 一句话结论

HTTP 报文是**纯文本的「起始行 + 头部 + 空行 + 消息体」**四段结构。
**方法**说意图（语义 + 幂等），**状态码**说结果（五类三位数），**头部**说细节（类型、缓存、认证、跨域）。

---

## 6.2 报文格式（逐字节看清）

### 6.2.1 请求报文

```http
POST /api/users?from=web HTTP/1.1          ← 请求行：方法 SP 目标 SP 版本 CRLF
Host: api.example.com                       ← 请求头（每个一行）
User-Agent: Mozilla/5.0 ...
Content-Type: application/json
Content-Length: 26
Cookie: sessionid=abc123
                                            ← 空行（CRLF，必须有，标志头部结束）
{"name":"张三","age":18}                     ← 请求体（可选）
```

**四个部分**：

| 部分 | 内容 | 说明 |
|---|---|---|
| **请求行** | `方法 目标 版本` | 三者用**空格**分隔，结尾 `CRLF`（`\r\n`） |
| **请求头** | `字段名: 字段值` | 冒号后建议一个空格；字段名**大小写不敏感** |
| **空行** | 只有一个 `CRLF` | **必须有**，用来分隔头和体 |
| **请求体** | 任意字节 | GET 通常没有，POST/PUT/PATCH 有 |

**注意请求行里的「目标」三种形式**：

```
GET /path?q=1 HTTP/1.1              → origin-form（最常见，只有路径）
GET http://a.com/path HTTP/1.1      → absolute-form（代理请求时用）
CONNECT a.com:443 HTTP/1.1          → authority-form（HTTPS 代理隧道）
```

### 6.2.2 响应报文

```http
HTTP/1.1 200 OK                             ← 状态行：版本 SP 状态码 SP 原因短语 CRLF
Content-Type: application/json; charset=utf-8
Content-Length: 42
Cache-Control: no-cache
Set-Cookie: token=xyz; HttpOnly; Secure
                                            ← 空行
{"code":0,"data":{"id":1,"name":"张三"}}     ← 响应体
```

**状态行三段**：`版本 状态码 原因短语`。**原因短语只是给人看的，客户端只看状态码**（HTTP/2 之后原因短语被取消了）。

### 6.2.3 三个容易被追问的格式细节

| 细节 | 说明 |
|---|---|
| **换行必须是 `\r\n`** | 不是 `\n`。HTTP/1.x 严格要求 CRLF；HTTP/2 是二进制，不用文本 |
| **`Content-Length` 和 `Transfer-Encoding` 互斥** | 同时出现是**请求走私（request smuggling）**的攻击面，服务器必须拒绝 |
| **头部可以重复** | 比如多个 `Set-Cookie`；也可以一行写多个值（`Accept: a, b`） |

---

## 6.3 请求方法

### 6.3.1 九个方法 + 两个属性

| 方法 | 用途 | **安全**（不改状态） | **幂等**（重复执行结果相同） | 有 body |
|---|---|---|---|---|
| **GET** | 获取资源 | ✅ | ✅ | 通常无 |
| **HEAD** | 只要响应头，不要 body | ✅ | ✅ | 无 |
| **POST** | 提交数据/创建资源 | ❌ | **❌** | ✅ |
| **PUT** | **整体替换**资源 | ❌ | ✅ | ✅ |
| **PATCH** | **局部更新**资源 | ❌ | **❌** | ✅ |
| **DELETE** | 删除资源 | ❌ | ✅ | 可有 |
| **OPTIONS** | 查询支持的方法 / CORS 预检 | ✅ | ✅ | 无 |
| **TRACE** | 回显请求（诊断，**生产应禁用**） | ✅ | ✅ | 无 |
| **CONNECT** | 建立隧道（HTTPS 代理） | ❌ | ❌ | 无 |

**为什么幂等重要**：网络会重试（超时、网关、用户狂点），非幂等接口被重发就会出问题。

```js
// ❌ 非幂等 + 自动重试 = 重复下单
POST /orders  { "sku": "A1", "qty": 1 }
// 网关超时重试一次 → 用户被扣两次钱

// ✅ 用幂等键解决
POST /orders  { "sku": "A1", "qty": 1, "requestId": "uuid-xxx" }
// 服务端用 requestId 去重
```

**注意**：`PATCH` **不幂等**。因为 `PATCH` 的语义是「应用一个补丁」，比如 `{"op":"increment","field":"count"}`，重复执行会加两次。

### 6.3.2 GET vs POST

| 维度 | GET | POST |
|---|---|---|
| **语义（RFC 定义）** | 获取资源，**安全且幂等** | 处理/提交，**非安全非幂等** |
| **参数位置** | URL query（`?a=1&b=2`） | 请求体 |
| **可见性** | 在 URL 里，会进浏览器历史、日志、Referer | 在 body 里，不进历史 |
| **可缓存** | ✅ 默认可以被缓存 | ❌ 一般不缓存（除非显式声明） |
| **可收藏/分享** | ✅ | ❌ |
| **长度限制** | **协议本身无限制**，受浏览器/服务器限制 | 协议无限制，受服务器配置限制 |
| **编码** | 只能 URL 编码（`encodeURIComponent`） | 支持任意编码（JSON、二进制、文件流） |
| **后退/刷新** | 无害 | 可能重复提交（浏览器会提示） |
| **TCP 包数** | 协议不规定 | 协议不规定（不受方法影响） |

**三个必须澄清的常见错误说法**：

| 错误说法 | 事实 |
|---|---|
| 「GET 长度限制 2KB / 8KB」 | **HTTP 协议没有限制**。是浏览器（Chrome 地址栏约 2MB）和服务器（Nginx `large_client_header_buffers`、Tomcat `maxHttpHeaderSize` 8KB）在限制 |
| 「POST 比 GET 安全」 | **都不安全**，都是明文。只有 HTTPS 才安全。POST 的参数在 body 里只是「不那么显眼」，抓包一样能看到 |
| 「POST 会发两个 TCP 包（先发头、再发体）」 | 协议不按方法规定包数。「先头后体」来自 `Expect: 100-continue` 的交互，是否分开由客户端实现决定 |

**什么时候必须用 POST 不能用 GET**：

1. **有副作用**（创建/修改/删除）
2. **数据量大**（长文本、文件）
3. **有敏感信息**（密码、token）——虽然都不安全，但至少不进日志和历史
4. **需要发二进制**（文件上传必须 `multipart/form-data`）

### 6.3.3 语义 vs 实现

**HTTP 方法只是「语义约定」，服务器可以不遵守。**

```js
// 语法合法、语义错误：用 GET 做删除
GET /api/deleteUser?id=1
```

**用 GET 做写操作会把基础设施变成自动触发源**：浏览器预取、爬虫抓取、代理/CDN 缓存或预取、用户后退重放，都会重放这个请求。

---

## 6.4 状态码全表

### 6.4.1 五类三位数

| 类别 | 含义 | 记忆 |
|---|---|---|
| **1xx** | 信息性（临时响应） | 「我还在处理」 |
| **2xx** | 成功 | 「搞定了」 |
| **3xx** | 重定向 | 「去别处」 |
| **4xx** | **客户端**错误 | 「你请求错了」 |
| **5xx** | **服务端**错误 | 「我出错了」 |

### 6.4.2 完整表（前端需要知道的）

#### 1xx 信息性

| 码 | 名称 | 含义 | 前端场景 |
|---|---|---|---|
| **100** | Continue | 「你可以继续发 body 了」 | 大文件上传时，客户端先发头带 `Expect: 100-continue`，服务器同意后再发体 |
| **101** | Switching Protocols | **协议切换** | **WebSocket 握手成功**（详见 11 册） |
| **103** | Early Hints | 提前告知可以预加载的资源 | 配合 `Link: rel=preload` 优化 LCP |

#### 2xx 成功

| 码 | 名称 | 含义 | 典型场景 |
|---|---|---|---|
| **200** | OK | 成功，有响应体 | 最常见的 GET 成功 |
| **201** | Created | **创建成功**，`Location` 头指向新资源 | `POST /users` 创建用户 |
| **202** | Accepted | **已接受但未处理完**（异步） | 提交任务、导出报表 |
| **204** | No Content | 成功但**没有响应体** | `DELETE` 成功、`PUT` 成功不需要返回内容 |
| **206** | Partial Content | **部分内容**（断点续传、分片下载） | 视频拖动进度条、`Range` 请求 |

#### 3xx 重定向

301/302/303/307/308 的语义与是否保持方法见 6.5.1，304 见 6.5.4。

#### 4xx 客户端错误

| 码 | 名称 | 含义 | 排查 |
|---|---|---|---|
| **400** | Bad Request | 请求格式错（参数缺失、JSON 语法错） | 看请求体 |
| **401** | Unauthorized | **未认证**（没登录 / token 失效） | 该去登录 |
| **403** | Forbidden | **已认证但无权限** | 登录了，但没这个权限 |
| **404** | Not Found | 资源不存在 | 路径错 / 被删 |
| **405** | Method Not Allowed | 方法不允许（该用 POST 你用了 GET） | 响应里 `Allow` 头会列出支持的方法 |
| **406** | Not Acceptable | 无法满足 `Accept` 头 | 内容协商失败 |
| **408** | Request Timeout | 服务端等请求超时 | 客户端网络慢 |
| **409** | Conflict | 冲突（并发修改、唯一键重复） | 业务层处理 |
| **410** | Gone | 资源**永久**不存在（比 404 更确定） | SEO 用 |
| **413** | Payload Too Large | 请求体太大 | 调 `client_max_body_size` |
| **414** | URI Too Long | URL 太长 | GET 参数太多 |
| **415** | Unsupported Media Type | `Content-Type` 不支持 | 服务端只收 JSON 你发了 form |
| **418** | I'm a teapot | 彩蛋（RFC 2324 愚人节） | — |
| **422** | Unprocessable Entity | 格式对但语义错（校验失败） | 表单校验 |
| **429** | Too Many Requests | 限流 | 看 `Retry-After` |
| **451** | Unavailable For Legal Reasons | 因法律原因不可用 | — |

#### 5xx 服务端错误

| 码 | 名称 | 含义 | 排查方向 |
|---|---|---|---|
| **500** | Internal Server Error | 服务端内部错误 | 看服务端日志 |
| **501** | Not Implemented | 方法未实现 | — |
| **502** | **Bad Gateway** | **网关/代理从上游收到无效响应** | 上游挂了 / 上游返回了非法内容 / 上游提前断连 |
| **503** | Service Unavailable | 服务暂不可用（过载/维护） | 看 `Retry-After` |
| **504** | **Gateway Timeout** | **网关等上游超时** | 上游慢（不是挂，是慢） |
| **505** | HTTP Version Not Supported | 版本不支持 | — |

### 6.4.3 两组最容易混淆的状态码

#### ① 401 vs 403

| | 401 Unauthorized | 403 Forbidden |
|---|---|---|
| 含义 | **你是谁？我不知道**（未认证） | **我知道你是谁，但你不能访问**（无权限） |
| 类比 | 你没带门禁卡 | 你带了卡，但这层楼不让你进 |
| 前端处理 | 跳登录页 | 显示「无权限」提示 |
| 响应头 | 通常带 `WWW-Authenticate` | 不带 |

> 名字 `401 Unauthorized` 其实起错了，它的准确含义是 **Unauthenticated**（未认证）。

#### ② 502 vs 504

| | 502 Bad Gateway | 504 Gateway Timeout |
|---|---|---|
| 本质 | 上游**返回了无效的东西** | 上游**根本没在超时时间内返回** |
| 上游状态 | 可能挂了、崩了、返回了非 HTTP 内容 | 还活着，但太慢 |
| 排查 | 看上游进程是否存活、端口是否对 | 看上游耗时、调大 `proxy_read_timeout` |

**一句话记忆**：**502 是「上游说错了话」，504 是「上游不说话」。**

---

## 6.5 3xx 详解（核心）

### 6.5.1 五个重定向码的差异

| 码 | 语义 | 是否永久 | 方法是否保持 | 典型用途 |
|---|---|---|---|---|
| **301** | Moved Permanently | **永久** | ❌ 历史上会变 GET | **域名迁移、http→https、加 www** |
| **302** | Found | 临时 | ❌ 历史上会变 GET | 登录后跳转、临时活动页 |
| **303** | See Other | 临时 | ❌ **规范强制变 GET** | **POST 提交后跳转到结果页（PRG 模式）** |
| **307** | Temporary Redirect | 临时 | ✅ **严格保持方法和 body** | 需要保持 POST 的临时跳转 |
| **308** | Permanent Redirect | **永久** | ✅ **严格保持** | 永久迁移且必须保持 POST |

### 6.5.2 为什么会有 303/307（历史包袱）

**问题的根源**：301 和 302 在 RFC 里的原意是「保持方法」，但**早期浏览器实现成了「一律改成 GET」**。

```
POST /submit  →  302 Location: /result
    ↓ 浏览器实际行为
GET /result   ← body 丢了，方法变了
```

**这导致了一个经典问题**：如果重定向后的地址只接受 POST，就会失败。

**HTTP/1.1（RFC 2616，1999）用两个码明确语义**：

- **303**：**就是要变 GET**（明确表达「去用 GET 拿那个资源」）→ 用于 **PRG（Post/Redirect/Get）模式**
- **307**：**就是不变**（严格保持原方法 + body）

**308** 是 2015 年补的（RFC 7538），对应「永久版 307」；RFC 7231（2014）只是重写了 303/307 的措辞。

### 6.5.3 301 和 302 的实际差别

| 维度 | 301 | 302 |
|---|---|---|
| **浏览器缓存** | **默认会缓存**（有时缓存很久，甚至永久） | 现代浏览器**默认不缓存**，除非响应带 `Cache-Control` / `Expires` |
| **不可逆性** | ⚠️ **一旦用户访问过，浏览器可能永久记住**，即使你后来改了配置也不生效 | 相对安全 |
| **SEO** | 权重转移到新地址（推荐用 301 做永久迁移） | 不转移权重 |
| **误用风险** | **高**（测试时用了 301，上线后改不回来） | 低 |

**301 被缓存后不可撤回**：`/old → /new` 已下发 301，再改成 `/old → /newer`，老用户仍按缓存跳到 `/new`，只能清缓存或换路径。

### 6.5.4 304 Not Modified

**含义**：协商缓存命中，**资源没变，用你本地的**。

**三个关键事实**：

1. **304 没有 body**；`Content-Length` 可缺省，也可写成与 200 响应体等长的字节数（不是 0）
2. **只有请求带了条件头才会返回 304**（`If-None-Match` 或 `If-Modified-Since`）
3. **304 仍然是一次完整往返**（省带宽，不省 RTT）

**完整交互**：

```
① 首次请求
   GET /app.js
   ← 200 OK
     ETag: "abc123"
     Last-Modified: Wed, 21 Oct 2026 07:28:00 GMT
     Cache-Control: no-cache          ← 每次都验证

② 再次请求（带条件头）
   GET /app.js
   If-None-Match: "abc123"
   If-Modified-Since: Wed, 21 Oct 2026 07:28:00 GMT
   ← 304 Not Modified                 ← 没有 body，省了传输时间

③ 如果文件变了
   ← 200 OK
     ETag: "def456"
     （新的 body）
```

**304 的价值只在带宽和解析**（大文件、JS/CSS 不必重新解析），首屏仍要等一个 RTT。所以性能上的做法是**强缓存 + 内容 hash 文件名**，让请求根本不发出去：`Cache-Control: max-age=31536000, immutable` 配 `app.a1b2c3.js`。

### 6.5.5 重定向的成本

**每一次 3xx 都是一次额外的完整往返**：

```
GET http://example.com
← 301 Location: https://example.com/
   ↓ 再来一轮：DNS（可能已缓存）+ TCP + TLS + 请求
GET https://example.com/
← 200 OK
```

**所以线上要消灭「重定向链」**：

| 常见重定向链 | 优化 |
|---|---|
| `http://a.com` → `https://a.com` → `https://www.a.com` | HSTS + 直接配 `http://a.com` → `https://www.a.com` 一步到位 |
| `/api/user` → `/api/user/`（末尾斜杠） | 前端统一加斜杠 |
| 短链服务两次跳转 | 合并成一次 |

**用 `curl -IL` 可以看完整重定向链**：

```bash
curl -IL http://example.com
# 会依次打印每个 3xx 的 Location
```

---

## 6.6 常用请求头

| 头 | 作用 | 示例 |
|---|---|---|
| **Host** | 目标域名（HTTP/1.1 必需，支持虚拟主机） | `Host: api.example.com` |
| **User-Agent** | 客户端标识 | `Mozilla/5.0 (Macintosh...)` |
| **Accept** | 能接受的响应类型 | `text/html,application/json;q=0.9` |
| **Accept-Encoding** | 能接受的压缩算法 | `gzip, deflate, br` |
| **Accept-Language** | 语言偏好 | `zh-CN,zh;q=0.9,en;q=0.8` |
| **Content-Type** | **请求体的类型** | `application/json` |
| **Content-Length** | 请求体的字节数 | `26` |
| **Cookie** | 携带 cookie | `sessionid=abc; theme=dark` |
| **Authorization** | 认证凭据 | `Bearer eyJhbGci...` |
| **Referer** | 从哪个页面来的（可被用于防盗链、统计） | `https://a.com/page` |
| **Origin** | **跨域请求的来源**（CORS 用，比 Referer 更严格） | `https://a.com` |
| **If-None-Match** | 协商缓存（ETag） | `"abc123"` |
| **If-Modified-Since** | 协商缓存（时间） | `Wed, 21 Oct 2026 07:28:00 GMT` |
| **Range** | 请求部分内容（断点续传） | `bytes=0-1023` |
| **Connection** | 连接控制 | `keep-alive` / `close` / `Upgrade` |
| **Cache-Control** | 请求方的缓存指令 | `no-cache`（强制验证） |
| **X-Requested-With** | 标识 AJAX（jQuery 习惯） | `XMLHttpRequest` |

**`Referer` vs `Origin`（常被问）**：

| | Referer | Origin |
|---|---|---|
| 内容 | **完整 URL**（含路径、query） | **只有 协议 + 域名 + 端口** |
| 是否可省略 | 可以通过 `Referrer-Policy` 完全去掉 | 跨域请求**必带**（CORS 规范要求） |
| 用途 | 统计、防盗链 | **CORS 校验、CSRF 防御** |

---

## 6.7 常用响应头

| 头 | 作用 | 示例 |
|---|---|---|
| **Content-Type** | 响应体类型 + 字符集 | `application/json; charset=utf-8` |
| **Content-Length** | 响应体字节数 | `8234` |
| **Content-Encoding** | 压缩算法 | `br` / `gzip` |
| **Content-Disposition** | 是内联显示还是下载 | `attachment; filename="a.pdf"` |
| **Cache-Control** | 缓存策略（**优先级最高**） | `public, max-age=31536000, immutable` |
| **ETag** | 内容指纹（协商缓存） | `"abc123"` |
| **Last-Modified** | 最后修改时间 | `Wed, 21 Oct 2026 07:28:00 GMT` |
| **Expires** | 过期绝对时间（被 Cache-Control 覆盖） | `Thu, 01 Dec 2026 16:00:00 GMT` |
| **Set-Cookie** | 设置 cookie | `token=x; HttpOnly; Secure; SameSite=Lax` |
| **Location** | 重定向目标（配 3xx） | `https://new.com/path` |
| **Access-Control-Allow-Origin** | CORS 允许的来源 | `https://a.com` |
| **Vary** | 缓存按哪些头区分版本 | `Accept-Encoding, Origin` |
| **Transfer-Encoding** | 分块传输 | `chunked` |
| **Strict-Transport-Security** | HSTS | `max-age=31536000; includeSubDomains` |
| **Content-Security-Policy** | CSP | `default-src 'self'` |
| **X-Frame-Options** | 防点击劫持 | `DENY` / `SAMEORIGIN` |
| **Server** | 服务器标识（**建议隐藏**） | `nginx` |
| **Date** | 服务器时间 | — |

### 6.7.1 `Content-Type` 的常见值（前端必记）

加粗三项是 CORS 简单请求允许的 `Content-Type`。

| 值 | 用途 |
|---|---|
| `application/json` | JSON（现代 API 标准） |
| **`application/x-www-form-urlencoded`** | 表单（`a=1&b=2`） |
| **`multipart/form-data`** | 文件上传 |
| **`text/plain`** | 纯文本 |
| `text/html` | HTML |
| `application/octet-stream` | 二进制流（下载） |
| `application/javascript` | JS |
| `text/css` | CSS |
| `image/svg+xml` | SVG（**注意：可以内嵌脚本，有 XSS 风险**） |

### 6.7.2 `Vary` 为什么重要

`Vary` 告诉缓存：「**同一个 URL，这些头不同就要当成不同的版本**」。

```http
Vary: Accept-Encoding
```

意思是「gzip 版和 br 版要分别缓存」——不写，CDN 可能把 gzip 编码的内容返给只声明 br 的客户端，客户端无法解码。

```http
Vary: Origin
```

**CORS 场景必须写**，否则 CDN 可能把 A 站点的响应（带 `Access-Control-Allow-Origin: https://a.com`）返回给 B 站点，导致 B 站点拿到错误的 CORS 头。

---

## 6.8 重定向 vs 转发

> 这对概念来自 **Java Servlet**（`response.sendRedirect()` vs `request.getRequestDispatcher().forward()`），本质区别是**客户端跳转**与**服务端内部转发**；前端对应 Nginx 的 `rewrite` / `proxy_pass`。

### 6.8.1 Java 语境下的对比

| 维度 | 重定向（sendRedirect） | 转发（forward） |
|---|---|---|
| **谁发起** | **客户端**（浏览器） | **服务端**内部 |
| **请求次数** | **2 次** | **1 次** |
| **地址栏** | **变化** | **不变** |
| **能否跨域/跨应用** | ✅ 能（可以跳到任何 URL） | ❌ 只能应用内部 |
| **request 域能否共享** | ❌ 不能（是新请求） | ✅ 能（同一个 request 对象） |
| **性能** | 差（多一次往返） | 好（服务器内部调用） |
| **状态码** | 302 / 301 | 无（内部行为，客户端无感） |
| **典型用途** | 登录成功后跳到首页；支付完成跳到结果页 | 控制器转发到视图（MVC 的 `forward` 到 JSP） |

### 6.8.2 前端语境下的三种「跳转」

| 手段 | 谁发起 | 请求次数 | URL 变化 | 说明 |
|---|---|---|---|---|
| **HTTP 重定向（301/302）** | 服务端告诉浏览器 | **2 次** | ✅ 变 | 浏览器会重新发请求，可跨域 |
| **Nginx 内部重写（`rewrite` / `try_files`）** | Nginx | **1 次** | ❌ 不变（浏览器看不到） | 相当于「转发」，SPA 用 `try_files` 回退到 `index.html` |
| **Nginx `proxy_pass`（反向代理）** | Nginx | **1 次**（对浏览器而言） | ❌ 不变 | 把请求转给上游服务 |

**一个典型的 SPA 部署配置**：

```nginx
location / {
    # 这是「内部重写」，等价于 forward：URL 不变，一次请求
    try_files $uri $uri/ /index.html;
}

location /api/ {
    # 这是「反向代理」，把 /api/ 转给上游
    proxy_pass http://backend:3000/;
}
```

**注意 `proxy_pass` 末尾斜杠的坑**：

```nginx
location /api/ {
    proxy_pass http://backend:3000;    # → /api/user  （保留 /api 前缀）
}
location /api/ {
    proxy_pass http://backend:3000/;   # → /user      （去掉 /api 前缀）
}
                                              ↑ 一个斜杠的差别
```

### 6.8.3 一句话对比

> 重定向 = 客户端行为，2 次请求，URL 变，可跨域；转发 = 服务端行为，1 次请求，URL 不变，只能应用内。

---

## 6.9 101 Switching Protocols

**含义**：服务器同意**切换协议**。最典型的场景是 **WebSocket 握手**。

```http
① 客户端请求升级
GET /chat HTTP/1.1
Host: example.com
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==
Sec-WebSocket-Version: 13

② 服务端同意
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
```

**之后这个 TCP 连接就不再是 HTTP 了**，而是 WebSocket 帧协议。

**其他 101 的场景**：HTTP/2 的 `h2c` 升级（明文 HTTP/2，实际很少用）。

详细内容见 11 册。

---

## 6.10 常见坑

| 坑 | 正确说法 |
|---|---|
| 说「GET 有 2KB 限制」 | 协议无限制，是浏览器/服务器在限制 |
| 说「POST 比 GET 安全」 | 都不安全，只有 HTTPS 才安全 |
| 说「POST 发两个 TCP 包」 | 协议不按方法规定包数；这是老实现的遗留说法 |
| 说「302 一定不缓存」 | 302 默认不缓存，但带 `Cache-Control` / `Expires` 时仍会被缓存；要禁缓存就显式 `no-store` |
| 说「301 可以随时改回来」 | 用户浏览器会缓存 301，**改了不生效** |
| 说「304 省了一次请求」 | 304 **仍然是一次完整往返**，省的是带宽不是 RTT |
| 把 401 和 403 说反 | 401 未认证（去登录），403 无权限（登录了也不行） |
| 把 502 和 504 说反 | 502 上游返回了无效内容，504 上游超时 |
| 说「PUT 和 PATCH 一样」 | PUT 是整体替换（幂等），PATCH 是局部更新（**不幂等**） |
| 说「DELETE 不幂等」 | DELETE **幂等**（删一次和删多次，结果都是「不存在」） |
| 说「OPTIONS 没用」 | CORS 预检就是 OPTIONS；也用于查 `Allow` |
| 说「原因短语有用」 | HTTP/2 已取消原因短语，客户端只看状态码 |
| 说「`Content-Length` 和 `Transfer-Encoding` 可以共存」 | 共存是**请求走私**攻击面，服务器必须拒绝 |

---

## 6.11 答题模板

### 30 秒版（状态码）

> 状态码是三位数，第一位表示类别：1xx 信息、2xx 成功、3xx 重定向、4xx 客户端错误、5xx 服务端错误。
> 常用的：200 成功、201 创建、204 无内容、206 部分内容；301 永久重定向、302 临时、304 协商缓存命中；400 参数错、401 未认证、403 无权限、404 不存在、405 方法不允许、429 限流；500 服务端错误、502 网关收到无效响应、503 服务不可用、504 网关超时。

### 30 秒版（301 vs 302）

- 301 永久、可被浏览器缓存，用于域名迁移 / http→https；302 临时、默认不缓存，用于登录后跳转。
- 301 一旦被缓存，改配置对老用户不生效，测试环境不要用。
- 303 强制变 GET（POST 后跳转）；307/308 严格保持方法和 body，308 为永久版。

### 2 分钟版（报文 + 方法 + 状态码 + 头部）

- 报文四段：起始行、头部、空行、消息体；空行必须有。
- 方法语义决定基础设施行为：浏览器预取、CDN 缓存、网关重试都按语义行事；非幂等接口重发要用幂等键。
- 三条常见误区：GET 没有协议层面的长度限制；POST 不比 GET 安全；「POST 必发两个 TCP 包」是旧实现的遗留。
- 3xx：301 永久 / 302 临时 / 303 强制 GET / 307、308 保持方法；304 没有 body，但仍是一次完整往返。
- 头部按内容协商、缓存、身份、跨域四类；CORS 场景必须写 `Vary: Origin`。

### 追问表

| 追问 | 回答要点 |
|---|---|
| GET 和 POST 的本质区别 | 语义（安全/幂等）不同，不是「参数在 URL 还是 body」 |
| GET 有长度限制吗 | 协议无，浏览器/服务器有 |
| POST 比 GET 安全吗 | 都不安全，只有 HTTPS 安全 |
| 什么是幂等 | 执行 N 次与 1 次结果相同；GET/HEAD/PUT/DELETE/OPTIONS 幂等，POST/PATCH 不幂等 |
| PUT 和 PATCH 区别 | 整体替换 vs 局部更新；PUT 幂等，PATCH 不一定 |
| 301 和 302 区别 | 永久 vs 临时；301 会被浏览器缓存且不可撤销 |
| 307 和 302 区别 | 307 严格保持方法和 body，302 历史上会变 GET |
| 303 用来干什么 | POST 后跳转（PRG 模式），强制变 GET |
| 304 有 body 吗 | 没有；省带宽不省 RTT |
| 401 和 403 区别 | 未认证 vs 无权限 |
| 502 和 504 区别 | 上游返回无效内容 vs 上游超时 |
| 429 是什么 | 限流，看 `Retry-After` |
| `Referer` 和 `Origin` 区别 | 前者完整 URL 可省略，后者只有源且跨域必带 |
| `Vary` 有什么用 | 告诉缓存按哪些头区分版本，CORS 必须 `Vary: Origin` |
| 101 是什么 | 协议切换，WebSocket 握手成功 |
| 重定向和转发区别 | 客户端两次请求 URL 变 / 服务端一次请求 URL 不变 |
| 为什么禁用 TRACE | 回显完整请求，可被 XST 利用读取凭据；生产应禁用 |

---

## 6.12 速记卡

```
报文
  请求行（方法 目标 版本）/ 状态行（版本 码 短语）+ 头 + 空行(CRLF) + 体
  Content-Length 与 Transfer-Encoding 不能共存（请求走私）

方法
  安全：GET HEAD OPTIONS TRACE
  幂等：GET HEAD PUT DELETE OPTIONS（PATCH 不幂等！）
  GET vs POST 是语义差异，不是「参数位置」
  三个辟谣：GET 无协议长度限制 / POST 不比 GET 安全 / 包数不由方法决定

状态码
  1xx 100 Continue、101 切换协议、103 Early Hints
  2xx 200 / 201 创建 / 202 接受 / 204 无体 / 206 部分
  3xx 301 永久 / 302 临时 / 303 强制GET / 304 协商命中 / 307 临时保方法 / 308 永久保方法
  4xx 400 / 401 未认证 / 403 无权限 / 404 / 405 / 413 / 415 / 422 / 429
  5xx 500 / 502 上游返回无效 / 503 / 504 上游超时

必记三组
  401 vs 403：没登录 vs 没权限
  502 vs 504：上游说错了话 vs 上游不说话
  301 vs 302：永久（会被缓存，改不回来）vs 临时

头部四类
  内容协商：Accept / Content-Type / Accept-Encoding
  缓存：Cache-Control / ETag / Last-Modified / Vary
  身份：Cookie / Authorization / Set-Cookie
  跨域：Origin / Access-Control-Allow-Origin（必须配 Vary: Origin）

重定向 vs 转发
  重定向：客户端、2 次请求、URL 变、可跨域
  转发：服务端、1 次请求、URL 不变、不可跨域
  前端对应：302 vs nginx rewrite / proxy_pass
```
