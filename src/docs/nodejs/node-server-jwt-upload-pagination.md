# Node 06｜服务端实战：JWT、文件上传、分页

> 覆盖题号：7（JWT 鉴权）、6（文件上传）、5（分页设计）
> 去重后：**3 个考点**

---

## 目录

- [6.1 题单答案的问题](#61-题单答案的问题)
- [6.2 JWT 鉴权](#62-jwt-鉴权)
- [6.3 文件上传](#63-文件上传)
- [6.4 分页设计](#64-分页设计)
- [6.5 面试怎么说（三道题串起来）](#65-面试怎么说三道题串起来)
- [6.6 追问总表](#66-追问总表)
- [6.7 速记卡](#67-速记卡)
- [6.8 自测](#68-自测)

---

## 6.1 题单答案的问题

> **7.** 「1. 用户登录，服务端验证后签发 JWT（Header.Payload.Signature）2. 前端存 Token（localStorage 或 Cookie）3. 后续请求带 `Authorization: Bearer <token>` 4. 服务端中间件校验签名，解析 payload 拿用户信息。」
> **6.** 「前端 `<input type="file">` + FormData 提交到后端。后端：Multer / Koa-multer 接收，存磁盘或 OSS。大文件分片上传 + 断点续传。」
> **5.** 「前端传 page/pageSize；后端 SQL `LIMIT offset, size`，返回 `{list, total, page, pageSize}`；大数据量用游标分页。」

三条答案覆盖主流程，追问集中在边界和失败模式：

| 题 | 题单缺的关键点 |
|---|---|
| 7 JWT | `alg:none`、token 存哪、无法主动失效 |
| 6 上传 | 大文件为什么直传 OSS、分片大小、秒传/断点续传的依据 |
| 5 分页 | OFFSET 深分页的执行计划与实测、`total` 的代价、游标分页的完整设计 |

---

## 6.2 JWT 鉴权

### 一句话结论：JWT

> 通常说的 JWT 是 JWS：服务端签名的一段自包含 JSON，只签名不加密，payload 谁都能读。

### Payload 可读，不是加密

`base64url` 只是把字节编码成 URL 安全字符。用 Node 解码任意一段：

```js
Buffer.from(segment, 'base64url').toString()
```

实测解码结果：

```text
header  → {"alg":"HS256","typ":"JWT"}
payload → {"sub":"1001","name":"alice"}
```

payload 只放 `sub`、角色、`exp` 这类即便泄露也不致命的信息；密码、身份证、手机号不放。实测 HS256 签发后正常验签为 `true`，改动参与签名的数据后为 `false`。

### 三段结构

| 段 | 内容 | 说明 |
|---|---|---|
| **Header** | `{"alg":"HS256","typ":"JWT"}` | 算法声明；验签时不能信任这里的 `alg` |
| **Payload** | `{"sub":"1001","name":"alice","exp":...}` | 标准字段：`sub`、`exp`、`iat`、`jti` |
| **Signature** | `base64url(HMAC-SHA256(base64url(header) + "." + base64url(payload), secret))` | 防篡改 |

### `alg:none` 漏洞

#### 攻击原理

`alg` 在明文 header 里，攻击者可以改。若验签逻辑按 `header.alg` 分支并放行 `none`：

```js
function naiveVerify(token) {
  const [h, p] = token.split('.');
  const header = JSON.parse(fromB64url(h));
  if (header.alg === 'none') return JSON.parse(fromB64url(p));   // ❌ 信任 header
  // ...
}
```

伪造 token，签名段留空：

```js
const forged = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMDAxIiwibmFtZSI6ImFkbWluIiwicm9sZSI6InN1cGVyYWRtaW4ifQ.';
// header  → {"alg":"none","typ":"JWT"}
// payload → {"sub":"1001","name":"admin","role":"superadmin"}
```

#### 实测对比

```text
naiveVerify(forged)    → {"sub":"1001","name":"admin","role":"superadmin"}
verify(forged, secret) → Error: 不支持的算法: none
```

#### 正确防御：三条

```js
function verify(token, secret) {
  const [h, p, sig] = token.split('.');
  const header = JSON.parse(fromB64url(h));

  // ① 算法白名单：只用服务端约定的算法，不看 header 里的 alg
  if (header.alg !== 'HS256') {
    throw new Error(`不支持的算法: ${header.alg}`);
  }

  const expected = crypto.createHmac('sha256', secret).update(`${h}.${p}`).digest();

  // ② 常数时间比较签名；长度不等时 timingSafeEqual 会抛 RangeError
  const actual = Buffer.from(sig, 'base64url');
  if (actual.length !== expected.length) throw new Error('签名不匹配');
  if (!crypto.timingSafeEqual(actual, expected)) throw new Error('签名不匹配');

  const payload = JSON.parse(fromB64url(p));

  // ③ 访问令牌要求 exp 且未过期：签名对不代表没过期
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) {
    throw new Error('token 已过期');
  }

  return payload;
}
```

#### 为什么签名比较要用 `timingSafeEqual`

`===` 不保证常数时间；`crypto.timingSafeEqual` 是常数时间比较，耗时与内容无关，适合比较 HMAC 摘要。它要求两个 Buffer 等长，否则抛 `RangeError`，所以先比长度。

### Token 存哪里

| 存储位置 | XSS 风险 | CSRF 风险 | 说明 |
|---|---|---|---|
| **localStorage** | 高（JS 可读） | 无（不自动发送） | 一旦有 XSS，token 直接被偷走 |
| **`HttpOnly` Cookie** | 低（JS 不可读） | 高（自动发送） | 需要 `SameSite` + CSRF token |
| **内存（变量）** | 中 | 无 | 刷新就丢，要配 refresh token 续期 |

推荐双 token：

- `access_token`：存内存或状态管理，15~30 分钟。
- `refresh_token`：`HttpOnly + Secure + SameSite=Strict` Cookie，7~30 天，只有 `/refresh` 接口接受。

access 短期且刷新即丢，XSS 的影响窗口小；refresh 不能被 JS 读取，`SameSite` 降低 CSRF 风险。没有单一「最安全」的存储位置，只有权衡。

### JWT 的硬伤

| 硬伤 | 说明 | 解法 |
|---|---|---|
| **无法主动失效** | 退出、改密、封号后，已签发的 token 在 `exp` 前仍有效 | 黑名单（Redis，TTL=剩余时间）/ `token_version`（每次查用户表）/ 短期 access + refresh（改密时作废 refresh） |
| **体积比 sessionId 大** | 每次请求都带完整 token | 精简 payload、缩短字段名 |

黑名单和版本号都要在请求时查存储，会削弱无状态优势；需要频繁踢人时，session + Redis 更直接。

### HS256 vs RS256

| | HS256 | RS256 |
|---|---|---|
| 类型 | 对称（HMAC） | 非对称（RSA） |
| 密钥 | 一个 secret，签发和校验共用 | 私钥签发 / 公钥校验 |
| 适合 | 单体应用（自己签发自己校验） | 多服务（认证中心签发，各服务只拿公钥） |
| 泄露风险 | secret 泄露 = 谁都能签发 token | 公钥泄露不影响安全 |
| 性能 | 签发约 2µs（本机） | 签发约 0.36ms、验签约 13µs（本机 2048 位） |
| 密钥长度 | 32+ 字节随机串 | 2048 位以上 RSA |

```text
只有一个服务，签发和校验都在同一个进程 → HS256
有多个微服务，都要校验 token 但不能签发 → RS256
不能让每个服务都持有 secret，否则一个服务被攻破就能伪造 token
```

### 面试怎么说（2 分钟版）

- **结构**：三段；payload 只是 base64url，不放敏感信息。
- **安全**：`alg:none` 来自信任 header 的 `alg`；防御是固定算法、`timingSafeEqual` 比较签名、校验 `exp`。
- **存储与失效**：access 放内存，refresh 放 `HttpOnly + SameSite` Cookie；JWT 本身不能撤销，只能黑名单/版本号/短期 token，代价是削弱无状态。
- **选型**：单体 HS256，多服务 RS256；需要频繁踢人时 session + Redis 更直接。

### 追问链：JWT

| 追问 | 答法 |
|---|---|
| 为什么 refresh token 不也放内存？ | 刷新页面就丢了，用户要反复登录；refresh 必须持久化 |
| `exp` 用什么单位？ | 秒级时间戳，不是毫秒 |
| 怎么防重放？ | JWT 本身不能防；加 `jti` 并在服务端记录已用过的值，或用 nonce |
| 多设备登录怎么处理？ | token 里带 `deviceId`，服务端维护每个用户的有效设备列表，退出某设备时拉黑 |
| access 过期但用户正在操作怎么办？ | 前端拦截 401 → 用 refresh 换新 access → 重放原请求；并发刷新用队列或单飞 |

---

## 6.3 文件上传

### 一句话结论：上传

> 小文件直接传；大文件分片并直传 OSS。

### 三个层次

| 文件大小 | 方案 | 关键点 |
|---|---|---|
| < 10 MB | 普通表单上传 | `FormData` + `multer`，限制大小和类型 |
| 10 MB ~ 100 MB | 分片上传 | 切块、并发、合并 |
| > 100 MB / 视频 | 直传 OSS | 预签名 URL，不经过业务服务器 |

普通表单的请求体是 `multipart/form-data`：`Content-Type` 带 `boundary`，字段之间用 `--boundary` 分隔，结尾是 `--boundary--`；文件字段额外带 `filename` 和自己的 `Content-Type`。实测一个文本字段加一个文件时，body 中有三处 boundary，`Content-Length` 是整体字节数。

### 实测：分片 + 断点续传的完整实现

5MB 文件、1MB 分片，共 5 片。每片用 `Content-Range` 声明范围：

```text
chunk 0: bytes 0-1048575/5242880, body 1048576 B
chunk 4: bytes 4194304-5242879/5242880, body 1048576 B
```

`end` 是闭区间，`end - start + 1` 必须等于本片字节数，且 `end < total`。实测：不校验时 `bytes 10-5/100` 返回 200；按这些条件校验时返回 416，范围要自己校验。

#### 核心设计：两个 hash + 已传分片索引

| 项 | 用途 |
|---|---|
| **整体 hash** | 秒传；文件变化后旧分片全部作废 |
| **分片 hash** | 校验单片，坏了只重传该片 |
| **已传 index** | 断点续传：客户端先问服务端已有哪些片 |

```js
const CHUNK = 1024 * 1024;
const total = Math.ceil(fileSize / CHUNK);
```

#### 实测过程

5 片；传完 0、1 后中断；服务端记录 `[0,1]`；恢复后只补 2、3、4；合并后整体 hash 与原文件一致。

```js
for (let i = 0; i < total; i++) {
  if (uploaded.has(i)) continue;
  uploadChunk(i);
}
```

#### 合并后校验

合并后重算整体 hash 比对，用于发现分片缺失、顺序错误或传输损坏。实测合并后大小 5242880，hash 与原文件一致。

### 八个设计要点

| 要点 | 说明 |
|---|---|
| **分片大小** | 1~5MB。5GB 用 1MB 分片是 5120 个请求；分片太大则重传成本高 |
| **并发数** | 3~6 个。HTTP/1.1 同源连接数约 6，超过会排队；HTTP/2 多路复用不受此限 |
| **秒传** | 上传前先查整体 hash，服务端有就直接返回 |
| **断点续传** | 服务端记录已收到哪些 index，客户端先查再传 |
| **合并** | 按 index 顺序写入同一个文件；用流，不要 `Buffer.concat`（大文件会爆内存） |
| **清理** | 合并成功后删 chunks；未完成的残留要定时清理 |
| **校验** | 每片校验 + 合并后整体校验 |
| **文件名** | 不要用用户上传的文件名存盘（路径穿越、重名、非法字符）；用 hash 或 UUID |

### 为什么大文件要直传 OSS

```text
中转：浏览器 → Node → OSS
  5GB 文件进出各一遍，占带宽；落盘占 libuv 线程池；
  请求体上限和超时要调大；Node 成为瓶颈。

直传：浏览器 --(预签名 URL)--> OSS
  业务服务器只签发 URL、接收回调记录元数据。
```

```js
// 伪代码：参数以对象存储 SDK 为准
const url = storage.createPresignedUrl({
  method: 'PUT',
  key: `uploads/${uuid}`,
  expires: 3600,
  contentType: 'image/jpeg',
});
return { uploadUrl: url, fileKey: `uploads/${uuid}` };
```

三个约束：时效、限定方法与 key、限定 `Content-Type`/大小（POST 策略可用 `content-length-range`；PUT 预签名要把相关头纳入签名，或在服务端复核）。业务服务器负责授权，不负责搬运文件。

### 上传中间件（multer）的三个坑

```js
const multer = require('multer');
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024,      // ① 限制大小
    files: 1,
  },
  fileFilter(req, file, cb) {
    // ② mimetype 来自客户端，只能初筛；落盘前还要读 magic number
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('不支持的文件类型'));
    }
    cb(null, true);
  },
  storage: multer.diskStorage({
    // ③ 文件名和扩展名由服务端决定，不用 originalname
    // detectedType 由前面的 magic number 校验写入
    filename(req, file, cb) {
      cb(null, `${crypto.randomUUID()}${EXT[file.detectedType] ?? ''}`);
    },
  }),
});
```

`file.mimetype` 来自每个分片的 `Content-Type`，可以伪造；只信它会放过把 `.html` 声明成 `image/png` 的请求。落盘前读文件头 magic number：

```js
const magic = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
  'image/webp': [0x52, 0x49, 0x46, 0x46],   // RIFF，还需检查 offset 8 的 WEBP
};
```

类型正确也不要用原文件名存盘：路径穿越、重名、非法字符都可能出问题；用 UUID/hash 重命名，并用独立域名或不可执行目录提供访问。上传目录若同域返回 HTML，会变成存储型 XSS；若服务器会执行上传的文件类型，则可能 RCE。

---

## 6.4 分页设计

### 一句话结论：分页

> 小数据量用 `LIMIT/OFFSET`，大数据量用游标（seek）分页；差别在执行计划，不在写法风格。

### 实测：OFFSET 的耗时随偏移量线性增长

80 万行 SQLite 表（文件库），Node 22.12 `node:sqlite`，每项 30 次取中位数：

| 偏移量 | OFFSET | 游标 |
|---|---|---|
| 0 | 0.006 ms | 0.007 ms |
| 100,000 | 0.733 ms | 0.006 ms |
| 400,000 | 3.179 ms | 0.006 ms |
| 700,000 | 6.268 ms | 0.007 ms |

OFFSET 从 0.006ms 增至 6.268ms（约 1000 倍），游标稳定在 0.006~0.007ms。

### 为什么？看执行计划

```sql
-- OFFSET 方式
EXPLAIN QUERY PLAN SELECT id FROM users ORDER BY id LIMIT 20 OFFSET 700000;
→ SCAN users

-- 游标方式
EXPLAIN QUERY PLAN SELECT id FROM users WHERE id > 700000 ORDER BY id LIMIT 20;
→ SEARCH users USING INTEGER PRIMARY KEY (rowid>?)
```

`LIMIT 20 OFFSET 700000` 顺序读前 700000 行并丢弃，再取 20 行，耗时随偏移量线性增长；`WHERE id > 700000` 在 B+ 树定位后只读 20 行，不碰前面的数据。

### 游标分页的完整设计

简单的 `WHERE id > lastId` 有三个局限。

#### 局限 1：只能「下一页」，不能「跳到第 N 页」

游标是顺序访问，不支持随机跳页。产品必须跳页时：

- 前 N 页用 OFFSET（浅分页），超过后只允许「下一页」；
- 或缓存 id 列表（如 Redis sorted set），跳页时先查索引，再按 id 范围取数。

#### 局限 2：`ORDER BY` 的列必须唯一

```sql
-- ❌ created_at 可能重复，翻页会漏数据
WHERE created_at > '2024-01-01' ORDER BY created_at LIMIT 20
```

实测两行 `created_at` 相同：第一页以该时间戳结尾，第二页的 `>` 会跳过第二行。用组合游标：

```sql
WHERE (created_at, id) > (?, ?)
ORDER BY created_at, id
LIMIT 20
```

需要 `(created_at, id)` 联合索引；无索引时执行计划是 `SCAN` + 临时 B 树排序，有索引才是 `SEARCH`。

#### 局限 3：`total` 的代价

`{list, total, page, pageSize}` 里的 `total` 在 MySQL InnoDB 上要扫最小的二级索引，大表是 O(n)；SQLite 对无 `WHERE` 的 `COUNT(*)` 有快速路径（内存表 80 万行实测 0.083ms），但不能跨库假设。

```js
async function page(cursor, size) {
  const rows = await db.query(
    'SELECT id, name FROM users WHERE id > ? ORDER BY id LIMIT ?',
    [cursor, size + 1],              // 多取一条
  );
  const hasNext = rows.length > size;
  return {
    list: rows.slice(0, size),
    hasNext,
    nextCursor: rows[Math.min(size, rows.length) - 1]?.id,
  };
}
```

实测 size=3、返回 4 行（id 1001~1004）：`hasNext=true`，`nextCursor=1003`，`list` 只有前 3 条。没有 total 就没有页码器，交互改为「加载更多」或无限滚动。

### 三种分页方案对比

| 方案 | SQL | 优点 | 缺点 | 适用 |
|---|---|---|---|---|
| **页码分页** | `LIMIT ? OFFSET ?` | 支持跳页、显示总数 | 深分页 O(offset) | 后台管理、数据量小 |
| **游标分页** | `WHERE id > ? LIMIT ?` | 恒定 O(1) | 不能跳页 | 信息流、无限滚动、API |
| **混合** | 浅页 OFFSET + 深页游标 | 兼顾 | 实现复杂 | 必须支持跳页又要性能 |

### 追问链：分页

| 追问 | 答法 |
|---|---|
| 游标用什么值？ | 优先自增主键（有索引、唯一）；业务字段要保证 `(字段, id)` 组合唯一且有联合索引 |
| 游标要加密吗？ | base64url 只避免直接暴露格式，不是安全措施；需要防篡改再加签名 |
| 数据在两页之间被删了怎么办？ | 游标 `id > lastId` 不受删除影响；OFFSET 会漏数据（删一行，第二页第一行被跳过） |
| 数据在两页之间被插入了怎么办？ | 新插入的 id 更大，会出现在后面的页里，符合「实时」语义 |
| `total` 一定要查吗？ | 不一定；「加载更多」不需要总数，必须显示时可缓存或估算 |
| MySQL 深分页还有别的优化吗？ | 延迟关联、覆盖索引、记住上次位置；本质都是避免扫描后丢弃 |

延迟关联只减少回表，复杂度仍是 O(offset)：

```sql
-- 慢：读完整行
SELECT * FROM users ORDER BY id LIMIT 20 OFFSET 700000;
-- 快一些：先用索引取 id，再回表
SELECT u.* FROM users u
JOIN (SELECT id FROM users ORDER BY id LIMIT 20 OFFSET 700000) t ON u.id = t.id;
```

---

## 6.5 面试怎么说（三道题串起来）

- **JWT**：三段 `header.payload.signature`；payload 只 base64url 编码，不放敏感信息。安全靠固定算法、`timingSafeEqual` 比签名、校验 `exp`。access 放内存，refresh 放 `HttpOnly + SameSite` Cookie；无法主动失效，只能黑名单/版本号/短期 token。
- **上传**：按大小分三档，大文件直传 OSS，业务服务器只签预签名 URL。分片靠整体 hash（秒传/续传正确性）、分片 hash（单片校验）、已传 index（断点续传）；`Content-Range` 的 `end-start+1` 要等于本片长度；合并后重算整体 hash。
- **分页**：浅分页 OFFSET，深分页游标。OFFSET 是 `SCAN` 后丢弃，游标是 `SEARCH`；80 万行实测 700k 偏移 6.268ms vs 0.007ms。不需要总数时多取一条判 `hasNext`。

---

## 6.6 追问总表

| 问题 | 一句话答 |
|---|---|
| JWT payload 加密吗？ | 不加密，base64url 编码，谁都能读 |
| `alg:none` 怎么攻击？ | 改 header 的 `alg` 为 `none`、签名留空，信任 header 的实现会放行 |
| 怎么防 `alg:none`？ | 固定算法白名单，不使用 header 里的 `alg` |
| 为什么用 `timingSafeEqual`？ | 常数时间比较，不按内容提前返回 |
| JWT 能主动失效吗？ | 不能；黑名单、`token_version` 或短期 token |
| token 存哪？ | access 放内存，refresh 放 `HttpOnly` Cookie |
| HS256 和 RS256 选哪个？ | 单体 HS256，多服务 RS256 |
| `exp` 单位？ | 秒，不是毫秒 |
| 大文件怎么传？ | 直传 OSS，业务服务器只签预签名 URL |
| 分片大小和并发？ | 1~5MB，并发 3~6 |
| 秒传靠什么？ | 上传前查整体 hash |
| 断点续传靠什么？ | 服务端记录已传 index，客户端只补缺片 |
| 合并后要做什么？ | 重算整体 hash 比对 |
| 上传类型怎么校验？ | 读 magic number；mimetype 可伪造 |
| OFFSET 深分页为什么慢？ | 扫描 offset 行后丢弃，执行计划是 `SCAN` |
| 快多少？ | 700k 偏移时约 900×（6.268ms vs 0.006~0.007ms） |
| 游标分页怎么工作？ | `WHERE id > lastId LIMIT n`，走索引 `SEARCH` |
| 游标分页的局限？ | 不能跳页、排序列要唯一、`total` 不一定查 |

---

## 6.7 速记卡

```text
【JWT】
三段：base64url(header).base64url(payload).base64url(signature)
payload 只编码不加密 → 只放 sub/角色/exp
alg:none：header.alg 可控 → 固定算法白名单
签名比较：timingSafeEqual（常数时间，先比长度）
访问令牌要求 exp，秒级时间戳

【Token 存储】
access  → 内存，15~30 分钟
refresh → HttpOnly + Secure + SameSite=Strict Cookie，7~30 天
localStorage 怕 XSS；HttpOnly Cookie 怕 CSRF

【JWT 失效】
黑名单（Redis + TTL）/ token_version / 短期 access + refresh
黑名单和版本号要查状态，削弱无状态；短期 token 只缩短窗口

【HS256 vs RS256】
单体 HS256；多服务 RS256（私钥签发、公钥校验）
secret 不能下发给每个服务

【上传】
<10MB 普通表单；10~100MB 分片；>100MB 直传 OSS
预签名 URL：限方法、限 key、限时效、限类型/大小

【分片】
整体 hash → 秒传 + 断点续传正确性
分片 hash → 单片校验
已传 index → 断点续传
Content-Range: bytes start-end/total；end-start+1 = 本片字节数
合并后重算整体 hash
1~5MB/片，并发 3~6

【上传安全】
限制大小和类型；magic number；UUID 重命名；独立域名/不可执行目录
multipart body 用 --boundary 分隔，结尾 --boundary--

【分页】80 万行 SQLite 实测
offset 700k：OFFSET 6.268ms / 游标 0.007ms
LIMIT/OFFSET → SCAN；WHERE id > ? → SEARCH
游标三个局限：不能跳页 / 排序列要唯一 → 组合游标 / total 贵 → 多取一条判 hasNext
```

---

## 6.8 自测

```text
□ JWT 三段各是什么，签名怎么算
□ payload 为什么不能放敏感信息
□ alg:none 的攻击条件与三条防御
□ timingSafeEqual 防的是什么
□ localStorage / HttpOnly Cookie 的 XSS/CSRF 取舍
□ 双 token 的分工
□ JWT 无法主动失效的三种解法
□ HS256 / RS256 的适用场景
□ 上传三档与分界
□ 整体 hash、分片 hash、已传 index 各自用途
□ Content-Range 的语义与校验
□ 为什么大文件直传 OSS，预签名 URL 约束什么
□ 为什么不能只信 mimetype
□ OFFSET 与游标的执行计划差异
□ 游标分页的三个局限
□ 不查 total 时怎么判下一页
```
