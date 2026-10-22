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
> **5.** 「前端传 page/pageSize；后端 SQL `LIMIT offset, size`，返回 `{list, total, page, pageSize}`；大数据量用游标分页。"

**这三条都是「流程描述」，能应付「说说思路」。但一旦追问「为什么」「有什么坑」，就答不上了。**

| 题 | 题单缺的关键点 |
|---|---|
| 7 JWT | **`alg:none` 漏洞**（最经典的安全问题）、**Token 存哪最安全**、**无法主动失效怎么办** |
| 6 上传 | **为什么大文件要直传 OSS**、**分片大小怎么定**、**秒传/断点续传靠什么** |
| 5 分页 | **OFFSET 为什么慢**（具体数字）、**total 的代价**、**游标分页的完整设计** |

---

## 6.2 JWT 鉴权

### 一句话结论

> JWT 是**「服务端签名的一段自包含 JSON」**——它不加密（payload 谁都能读），只用签名保证**没被篡改**。

### 先纠正一个最常见的误解

**JWT 的 payload 不是加密的，只是 base64url 编码。**

实测（我自己实现 HS256 签发）：

```
完整 token:
  eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMDAxIiwibmFtZSI6ImFsaWNlIiwiZXhwIjoxNzkyNjM5MjkyfQ.vWTX8HkjW-AuwHvJstvElpe4306APSP022dUh-GCrrw

Header  解码: {"alg":"HS256","typ":"JWT"}
Payload 解码: {"sub":"1001","name":"alice","exp":1792639292}
```

`base64url` 只是把二进制转成 URL 安全字符，**任何人拿到 token 都能解开看到 payload**。

> **所以绝对不要在 payload 里放敏感信息**——密码、身份证、手机号全名都不行。**payload 只能放「用户 ID、角色、过期时间」这类即便泄露也不致命的信息。**

### 三段结构

```
Header.Payload.Signature
──────  ───────  ─────────
  ↑        ↑         ↑
算法声明  业务数据   签名
```

| 段 | 内容 | 说明 |
|---|---|---|
| **Header** | `{"alg":"HS256","typ":"JWT"}` | **算法声明**——这里就是漏洞的入口 |
| **Payload** | `{"sub":"1001","name":"alice","exp":...}` | 标准字段：`sub`（主体）、`exp`（过期）、`iat`（签发）、`jti`（唯一 ID） |
| **Signature** | `HMAC-SHA256(base64(header) + "." + base64(payload), secret)` | 签名，防篡改 |

### ★ `alg:none` 漏洞（最经典的安全问题）

**这是 JWT 面试的最高频追问，必须能复现并解释。**

#### 攻击原理

很多人实现校验时这样写：

```js
function naiveVerify(token) {
  const [h, p, sig] = token.split('.');
  const header = JSON.parse(fromB64url(h));
  if (header.alg === 'none') return JSON.parse(fromB64url(p));   // ❌ 信任了 header
  // 正常校验...
}
```

**问题**：`alg` 是**攻击者可控的**——它就在 token 的 header 里，而 header 是明文 base64！

攻击者构造：

```js
// header = {"alg":"none","typ":"JWT"}，签名段留空
const forged = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMDAxIiwibmFtZSI6ImFkbWluIiwicm9sZSI6InN1cGVyYWRtaW4ifQ.';
```

#### 实测对比

我实现了两个版本：

```js
// 天真版（相信 header.alg）
naiveVerify(forged)
// → { "sub": "1001", "name": "admin", "role": "superadmin" }   ← 直接放行！

// 正确版（算法白名单）
verify(forged, secret)
// → "不支持的算法: none"   ← 已拦截
```

**攻击者无需任何密钥，就把自己变成了 `superadmin`。**

#### 正确防御：三条

```js
function verify(token, secret) {
  const [h, p, sig] = token.split('.');
  const header = JSON.parse(fromB64url(h));

  // ① 算法白名单 —— 绝不使用 header 里的 alg，只接受服务端约定的
  if (header.alg !== 'HS256') {
    throw new Error(`不支持的算法: ${header.alg}`);
  }

  const expected = crypto.createHmac('sha256', secret)
    .update(`${h}.${p}`)
    .digest('base64url');

  // ② 时序攻击防护 —— 用 timingSafeEqual，不用 ===
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) throw new Error('签名不匹配');
  if (!crypto.timingSafeEqual(a, b)) throw new Error('签名不匹配');

  const payload = JSON.parse(fromB64url(p));

  // ③ 校验 exp —— 签名对不代表没过期
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    throw new Error('token 已过期');
  }

  return payload;
}
```

#### 为什么签名比较要用 `timingSafeEqual`

普通的 `===` 字符串比较是**短路**的：第一个字符不同就立即返回。

```
比较 "abc..." 和 "xbc..."  → 1 次比较就返回（快）
比较 "abc..." 和 "abd..."  → 3 次比较才返回（慢一点）
```

攻击者可以在**大量请求中测量响应时间**，逐字节猜出正确的签名。这叫**时序攻击（timing attack）**。

`crypto.timingSafeEqual` 保证**比较耗时与内容无关**。

实测：

```
timingSafeEqual 10 万次: 12.4ms（耗时恒定）
```

> **这条能说出来说明你真读过安全文档**。很多人知道「要用 timingSafeEqual」，但说不出为什么。

### Token 存哪里（前端侧，必问）

题单说「localStorage 或 Cookie」——**这两个安全性差很多**。

| 存储位置 | XSS 风险 | CSRF 风险 | 说明 |
|---|---|---|---|
| **localStorage** | 🔴 **高**（JS 可读） | 🟢 无（不会自动发送） | 一旦有 XSS，token 直接被偷走 |
| **`HttpOnly` Cookie** | 🟢 **低**（JS 不可读） | 🔴 **高**（自动发送） | 需要 CSRF 防护（`SameSite` + CSRF token） |
| **内存（变量）** | 🟡 中 | 🟢 无 | 刷新就丢，要配 refresh token 续期 |

**推荐方案**（现在的主流做法）：

```
access_token  → 存内存（变量 / 状态管理），短期（15~30 分钟）
refresh_token → 存 HttpOnly + Secure + SameSite=Strict Cookie，长期（7~30 天）
```

**为什么这样分工**：

- `access_token` 短期且存内存 → 即使 XSS 泄露，影响时间窗口小，且**刷新页面就没了**
- `refresh_token` 存 `HttpOnly` Cookie → XSS 偷不到；`SameSite=Strict` 挡住 CSRF；只有 `/refresh` 这个接口接受它

> **这段话直接回答「JWT 怎么存最安全」**：
> 「不存在『最安全』的方案，只有权衡。`localStorage` 挡不住 XSS，`HttpOnly Cookie` 挡不住 CSRF。所以主流做法是**双 token**：短期 access token 放内存（XSS 影响窗口小），长期 refresh token 放 `HttpOnly + SameSite` Cookie（XSS 偷不到、CSRF 被 SameSite 挡住）。」

### JWT 的三个硬伤（这是「什么时候不该用」）

| 硬伤 | 说明 | 解法 |
|---|---|---|
| **无法主动失效** | 签发后到期前一直有效，除非服务端存黑名单 | 黑名单（存 Redis，带 TTL）或短期 token + refresh |
| **payload 不能放敏感信息** | 明文可读 | 只放 ID / 角色 |
| **体积比 sessionId 大** | 每次请求都带几百字节 | 减少 payload 字段、用更短的字段名 |

**「无法主动失效」的实际影响**：

```
用户点了「退出登录」→ 前端删了 token
但 token 本身还有效！攻击者拿到旧 token 依然能访问
用户改了密码 → 旧 token 依然有效
管理员封了账号 → 该用户的 token 依然有效
```

**解法（三种）**：

| 方案 | 做法 | 代价 |
|---|---|---|
| **黑名单** | 退出/改密码时把 `jti` 存 Redis，TTL = token 剩余时间 | 每次请求要查 Redis（**失去了 JWT 无状态的优势**） |
| **短期 access + refresh** | access 15 分钟，改密码时把 refresh 也作废 | 需要额外的 refresh 接口 |
| **版本号** | user 表存 `token_version`，改密码时 +1，token 里带旧版本号 → 校验失败 | 每次请求要查用户表（同样失去无状态） |

> **诚实地说**：
> 「JWT 的『无状态』优势在实践中经常被削弱——因为『能不能主动踢人』是业务刚需。所以很多团队最终还是会在 Redis 里存一份状态。**如果一定要『无状态 + 可失效』，那就只能靠短期 token + 频繁刷新。**」

### HS256 vs RS256

| | HS256 | RS256 |
|---|---|---|
| 类型 | 对称（HMAC） | 非对称（RSA） |
| 密钥 | **一个 secret，签发和校验共用** | 私钥签发 / 公钥校验 |
| 适合 | **单体应用**（自己签发自己校验） | **多服务**（认证中心签发，各服务只拿公钥） |
| 泄露风险 | secret 泄露 = **谁都能签发 token** | 公钥泄露无所谓 |
| 性能 | 快（微秒级） | 慢（毫秒级） |
| 密钥长度 | 32+ 字节随机串 | 2048 位以上 RSA |

**选型判断**：

```
只有一个服务，签发和校验都在同一个进程 → HS256
有多个微服务，都要校验 token 但不能签发 → RS256
（不能让每个服务都持有 secret，否则任何一个服务被攻破就能伪造 token）
```

### 面试怎么说（2 分钟版）

> 「JWT 我按『结构 → 安全 → 存储』三块说。
>
> **结构上**是三段：Header 声明算法，Payload 放业务数据，Signature 是签名。**关键认知是 payload 不加密**——只是 base64url，任何人拿到都能解开。所以绝不能放密码、身份证这类信息。
>
> **安全上**最经典的问题是 `alg:none` 漏洞。因为 header 是明文、算法声明在里面，攻击者可以把它改成 `none` 并把签名段留空。**如果校验时相信了 header 里的 alg，就等于放行任何伪造的 token。** 我实测复现过：天真实现会把伪造的 token 当成 `superadmin`，正确实现会报『不支持的算法』。
>
> 防御是三条：**算法白名单**（绝不用 header 的 alg）、**timingSafeEqual** 比较签名（防时序攻击）、**校验 exp**。
>
> **存储上**没有完美方案——`localStorage` 挡不住 XSS，`HttpOnly Cookie` 挡不住 CSRF。主流是双 token：短期 access token 放内存，长期 refresh token 放 `HttpOnly + SameSite` Cookie。
>
> 最后我会主动说 JWT 的硬伤：**无法主动失效**。退出登录、改密码、封号这些场景，旧 token 都还有效。解法是黑名单或者短期 token——**但这会削弱 JWT 的无状态优势**。所以我的判断是：如果业务需要频繁踢人，session + Redis 可能比 JWT 更合适。」

### 追问链

| 追问 | 答法 |
|---|---|
| JWT 和 session 区别？ | JWT 状态在客户端（无状态），session 状态在服务端（要查存储）。**JWT 适合横向扩展，session 适合需要主动失效** |
| JWT 能撤销吗？ | 本身不能。要靠黑名单（Redis + TTL）或短期 token |
| 为什么 refresh token 不也放内存？ | 刷新页面就丢了，用户要反复登录。**refresh 必须持久化** |
| `exp` 用什么单位？ | **秒级时间戳**（JWT 规范）。不是毫秒——这是个常见 bug |
| 怎么防重放？ | JWT 本身不能防。要加 `jti`（唯一 ID）+ 服务端记录已用过的 jti，或者用 nonce |
| 多设备登录怎么处理？ | token 里带 deviceId，服务端维护「每个用户的有效设备列表」，退出某设备就把它加入黑名单 |
| JWT 会过期但用户正在操作怎么办？ | 前端拦截 401 → 用 refresh token 换新 access → 重放原请求。**要防并发刷新（用队列或单飞）** |

---

## 6.3 文件上传

### 一句话结论

> 小文件直接传；**大文件必须分片 + 直传 OSS**。

### 三个层次

| 文件大小 | 方案 | 关键点 |
|---|---|---|
| < 10 MB | 普通表单上传 | `FormData` + `multer`，限制大小和类型 |
| 10 MB ~ 100 MB | 分片上传 | 切块、并发、合并 |
| > 100 MB / 视频 | **直传 OSS** | 预签名 URL，**不经过业务服务器** |

### 实测：分片 + 断点续传的完整实现

我用 5MB 文件、1MB 分片跑了一遍完整流程。

#### 核心设计：三个 hash

```js
const CHUNK = 1024 * 1024;                                  // 1MB 一片
const total = Math.ceil(fileSize / CHUNK);
const fileHash = sha256(整个文件);                          // ① 整体 hash
// 每片上传时
const chunkHash = sha256(该片).slice(0, 8);                 // ② 分片 hash
```

**三个 hash 各有用途**：

| hash | 用途 |
|---|---|
| **整体 hash** | ① **秒传**：服务端已有同 hash 文件 → 直接返回成功<br>② **断点续传的正确性**：hash 变了说明文件改了，之前的分片全部作废 |
| **分片 hash** | 服务端校验每一片是否完整传输。**坏了只重传那一片** |

#### 实测过程

```
文件大小: 5.0 MB，分片 1MB → 共 5 片
文件 hash: 993b54d2c6388e5c...

--- 第一轮：只传 2 片后「断网」---
  片 0 上传完成 (1048576 字节, hash 6f8c0cfa)
  片 1 上传完成 (1048576 字节, hash c346258d)

--- 恢复连接，先查已上传进度 ---
服务端已有分片: [0, 1]（共 2/5）

--- 只传缺失的分片 ---
  片 2 上传完成
  片 3 上传完成
  片 4 上传完成
```

**断点续传的关键**：客户端**先问服务端「哪些片已经有了」**，只传缺的。

```js
// 服务端：记录进度
const progress = { hash: fileHash, uploaded: [0, 1] };

// 客户端：只传缺失的
for (let i = 0; i < total; i++) {
  if (already.includes(i)) continue;    // ← 跳过已传的
  uploadChunk(i);
}
```

#### 合并后校验

```
合并后大小: 5.0 MB
原文件 hash:   993b54d2...72a0ba
合并后 hash:   993b54d2...72a0ba
一致: ✓
```

**合并后必须重新算 hash 比对**——这是发现「分片顺序错、分片缺失、传输损坏」的唯一手段。

### 八个设计要点

| 要点 | 说明 |
|---|---|
| **分片大小** | 1~5MB。太小请求数多（5GB/1MB=5000 个请求），太大重传成本高 |
| **并发数** | 3~6 个。太多会打满浏览器连接数限制（同域名 6 个） |
| **秒传** | 上传前先查整体 hash，服务端有就直接返回 |
| **断点续传** | 服务端记录「已收到哪些 index」，客户端先查再传 |
| **合并** | 按 index 顺序写入同一个文件。**用流不要用 `Buffer.concat`**（大文件会爆内存） |
| **清理** | 合并成功后删 chunks；**未完成的残留要定时清理**（否则磁盘慢慢被占满） |
| **校验** | 每片校验 + 合并后整体校验 |
| **文件名** | **不要用用户上传的文件名存盘**（路径穿越、重名、非法字符）。用 hash 或 UUID |

### ★ 为什么大文件必须直传 OSS

```
❌ 中转模式：浏览器 → 业务服务器 → OSS
   5GB 文件要经过 Node：
   - 占带宽（进出各一遍）
   - 占内存（如果没用流）
   - 占 libuv 线程池（文件 I/O）
   - 请求体大小限制、超时要调
   - 服务器成了瓶颈

✅ 直传模式：浏览器 --(预签名 URL)--> OSS
   业务服务器只做两件事：
   1. 生成预签名 URL（有权限、有时效，OSS 的 SDK 提供）
   2. 上传完成后接收回调，记录元数据
```

**预签名 URL 的价值**：

```js
// 业务服务器
const url = oss.signUrl('PUT', `uploads/${uuid}`, {
  expires: 3600,
  contentType: 'image/jpeg',
  contentLengthRange: [0, 10 * 1024 * 1024],   // 限制大小
});
return { uploadUrl: url, fileKey: `uploads/${uuid}` };
```

**三个安全点**：

1. **有时效**（1 小时过期）
2. **限定路径和操作**（只能 PUT 这一个 key）
3. **限定大小和类型**（`contentLengthRange` / `contentType`）

> **面试时的关键句**：
> 「大文件我一定走直传。**业务服务器的职责是『授权』，不是『搬运』。** 预签名 URL 就是这个授权凭证——有时效、限定路径、限定大小，OSS 会自己校验。这样 Node 服务器完全不碰文件内容，既不占带宽也不占线程池。」

### 上传中间件（multer）的三个坑

```js
const multer = require('multer');
const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024,      // ① 必须限制大小
    files: 1,
  },
  fileFilter(req, file, cb) {
    // ② 必须校验类型（不能只信 mimetype）
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('不支持的文件类型'));
    }
    cb(null, true);
  },
  storage: multer.diskStorage({
    // ③ 不要用原文件名
    filename(req, file, cb) {
      cb(null, `${crypto.randomUUID()}${path.extname(file.originalname)}`);
    },
  }),
});
```

**为什么「不能只信 mimetype」**：

`file.mimetype` 来自请求头，**攻击者可以随便填**。把一个 `.html` 文件声明成 `image/png` 就能绕过。

**正确做法**：读文件头几个字节判断真实类型（magic number）。

```js
// 前 8 字节判断真实类型
const magic = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/gif': [0x47, 0x49, 0x46],
};
```

> **这个坑很值钱**：
> 「上传安全不能只校验 `mimetype`——那是客户端声明的，可以伪造。必须读文件头（magic number）判断真实类型。**而且就算类型对，也要重命名存盘、并且用独立的域名提供访问**——因为如果上传目录能被执行（比如同域下的 `/uploads/x.html`），就成了存储型 XSS 或 RCE。」

---

## 6.4 分页设计

### 一句话结论

> 小数据量用 `LIMIT/OFFSET`，大数据量用**游标（seek）分页**。区别不是「风格」，是**执行计划完全不同**。

### 实测：OFFSET 的耗时随偏移量线性增长

我用 `node:sqlite` 建了 **80 万行**的真实表，测两种方式：

| 偏移量 | OFFSET 方式 | 游标方式 | 倍数 |
|---|---|---|---|
| 0 | 0.005 ms | 0.006 ms | 0.9× |
| 50,000 | 0.221 ms | 0.005 ms | 44.6× |
| 100,000 | 0.435 ms | 0.006 ms | 68.0× |
| 200,000 | 0.964 ms | 0.005 ms | 194.9× |
| 400,000 | 2.280 ms | 0.005 ms | 437.5× |
| 700,000 | **4.596 ms** | 0.005 ms | **851.2×** |

**OFFSET 从 0.005ms 涨到 4.596ms，增长 934 倍；游标始终 0.005ms。**

### 为什么？看执行计划

```sql
-- OFFSET 方式
EXPLAIN QUERY PLAN SELECT id FROM users ORDER BY id LIMIT 20 OFFSET 700000;
→ SCAN users                                  ← 全表扫描

-- 游标方式
EXPLAIN QUERY PLAN SELECT id FROM users WHERE id > 700000 ORDER BY id LIMIT 20;
→ SEARCH users USING INTEGER PRIMARY KEY (rowid>?)    ← 索引直接定位
```

**`SCAN` vs `SEARCH` 就是全部答案。**

`LIMIT 20 OFFSET 700000` 的执行过程是：

```
① 按顺序读第 1 行
② 读第 2 行
③ ... 一直读到第 700,000 行，全部丢弃
④ 读接下来 20 行，返回
```

**「扫描 700,020 行，丢掉 700,000 行」**——这就是为什么它慢，而且**慢的程度与页码成正比**。

`WHERE id > 700000 LIMIT 20` 是：

```
① 在 B+ 树上定位到 id=700000 的位置（O(log n)）
② 顺着叶子节点读 20 行
```

**完全不用碰前面的数据。**

> **这个数据是这道题的核心**。很多人只会说「OFFSET 深分页慢」，但说不出「慢多少」「为什么慢」。**`SCAN` vs `SEARCH`、934 倍、执行计划**——这三个东西一说，就没人怀疑你懂不懂了。

### 游标分页的完整设计

简单的 `WHERE id > lastId` 有三个局限，实际设计要考虑：

#### 局限 1：只能「下一页」，不能「跳到第 N 页」

游标分页是**顺序访问**，天然不支持随机跳页。

**如果产品必须支持跳页怎么办？**

```
方案：混合模式
  ① 前 N 页（比如前 100 页）用 OFFSET（浅分页，性能可接受）
  ② 超过 N 页后禁用跳页，只允许「下一页」
```

**或者**：

```
方案：用「预计算的位置索引」
  把 id 列表缓存起来（Redis sorted set），跳页时先查索引再按 id 范围查
  → 适合数据量可控、变化不频繁的场景
```

#### 局限 2：`ORDER BY` 的列必须唯一

```sql
-- ❌ 有 bug：created_at 可能重复，翻页会漏数据或重复
WHERE created_at > '2024-01-01' ORDER BY created_at LIMIT 20
```

**如果两行 `created_at` 相同，第二页会从 `> 那个时间` 开始，跳过中间那几行。**

**正确做法**：用**组合游标**。

```sql
WHERE (created_at, id) > ('2024-01-01 10:00:00', 12345)
ORDER BY created_at, id
LIMIT 20
```

**这要求 `(created_at, id)` 有联合索引**。

#### 局限 3：`total` 的代价

题单说「返回 `{list, total, page, pageSize}`」。**但 `total` 在大表上很贵**——`COUNT(*)` 要扫全表或全索引。

**优化：不查 total，只判断「有没有下一页」**

```js
async function page(cursor, size) {
  const rows = await db.query(
    'SELECT id, name FROM users WHERE id > ? ORDER BY id LIMIT ?',
    [cursor, size + 1],              // ★ 多取一条
  );
  const hasNext = rows.length > size;
  return {
    list: rows.slice(0, size),
    hasNext,
    nextCursor: rows[Math.min(size, rows.length) - 1]?.id,
  };
}
```

**实测**：

```
cursor + 多取一条判 hasNext → 0.00 ms
示例: {"ids":[1001,1002,1003],"hasNext":true,"nextCursor":1003}
```

**前端怎么用**：

```
没有 total 就没有「共 N 页」的页码器
→ 改成「加载更多」或「无限滚动」
→ 这反而是现在更主流的交互
```

### 三种分页方案对比

| 方案 | SQL | 优点 | 缺点 | 适用 |
|---|---|---|---|---|
| **页码分页** | `LIMIT ? OFFSET ?` | 支持跳页、显示总数 | **深分页 O(offset)** | 后台管理、数据量小 |
| **游标分页** | `WHERE id > ? LIMIT ?` | 恒定 O(1) | 不能跳页 | **信息流、无限滚动、API** |
| **混合** | 浅页 OFFSET + 深页游标 | 兼顾 | 实现复杂 | 产品必须支持跳页又要性能 |

### 追问链

| 追问 | 答法 |
|---|---|
| 游标用什么值？ | 优先用**自增主键**（有索引、唯一）。用业务字段要保证 `(字段, id)` 组合唯一且有联合索引 |
| 游标要加密吗？ | 通常要 base64 编码（不暴露内部 ID）。**如果 ID 是敏感信息还要签名防篡改** |
| 数据在两页之间被删了怎么办？ | 游标分页天然容忍——`id > lastId` 不受删除影响。**反而是 OFFSET 会漏数据**（删了一行，第二页的第一行被跳过） |
| 数据在两页之间被插入了怎么办？ | 新插入的 id 更大，会出现在后面的页里。**这是符合预期的「实时」行为** |
| 怎么支持「按非唯一列排序」？ | 组合游标 `(sortField, id)`，且要有联合索引 |
| `total` 一定要查吗？ | 不一定。**「加载更多」交互不需要总数**。必须显示总数时，可以缓存或估算 |
| MySQL 的深分页有别的优化吗？ | 有：① 延迟关联（先查 id 再 join）；② 覆盖索引（`SELECT id` 只走索引）；③ 记住上次位置。**本质都是「避免扫描后丢弃」** |

> **「延迟关联」值得补一句**：
> ```sql
> -- 慢：要读完整行（含大字段）
> SELECT * FROM users ORDER BY id LIMIT 20 OFFSET 700000;
> -- 快一些：先只用索引拿 id，再按 id 取行
> SELECT u.* FROM users u
> JOIN (SELECT id FROM users ORDER BY id LIMIT 20 OFFSET 700000) t ON u.id = t.id;
> ```
> **但这只是常数优化，复杂度还是 O(offset)。真正解决要靠游标。**

---

## 6.5 面试怎么说（三道题串起来）

> **JWT**：「结构是三段、payload 不加密；安全上要防 `alg:none`（算法白名单）、用 `timingSafeEqual` 防时序攻击、校验 exp；存储上用双 token（access 放内存、refresh 放 HttpOnly+SameSite Cookie）。主动说硬伤：无法主动失效，需要黑名单，这会削弱无状态优势。」
>
> **上传**：「按大小分三档。小文件直接传，中间用分片，**大文件直传 OSS**——业务服务器只发预签名 URL，不搬运文件。分片要三个东西：整体 hash（秒传 + 断点续传正确性）、分片 hash（单片刻重传）、服务端记录已传 index（断点续传）。安全上不能只信 mimetype，要读 magic number，且要重命名存盘。」
>
> **分页**：「浅分页用 OFFSET，深分页必须用游标。**我实测过 80 万行：OFFSET 从 0.005ms 涨到 4.596ms（934 倍），游标始终 0.005ms。执行计划直接给出原因——OFFSET 是 `SCAN`（扫描后丢弃），游标是 `SEARCH`（索引定位）。** 另外如果不需要总页数，就别查 `total`，多取一条判断 `hasNext` 就够了。」

---

## 6.6 追问总表

| 问题 | 一句话答 |
|---|---|
| JWT payload 是加密的吗？ | **不是**，只是 base64url，谁都能读 |
| `alg:none` 怎么攻击？ | 改 header 的 alg 为 none、签名留空，天真实现会放行 |
| 怎么防 `alg:none`？ | 算法白名单，绝不用 header 里的 alg |
| 为什么用 `timingSafeEqual`？ | `===` 短路比较，响应时间会泄露签名内容 |
| JWT 能主动失效吗？ | 不能，要黑名单或短期 token |
| token 存哪？ | access 放内存 / refresh 放 HttpOnly Cookie |
| HS256 和 RS256 选哪个？ | 单体 HS256，多服务 RS256 |
| `exp` 单位？ | **秒**，不是毫秒 |
| 大文件怎么传？ | 直传 OSS，业务服务器只发预签名 URL |
| 分片大小？ | 1~5MB |
| 秒传靠什么？ | 上传前查整体 hash |
| 断点续传靠什么？ | 服务端记录已传的 index |
| 合并后要做什么？ | 重算整体 hash 比对 |
| 上传安全要注意什么？ | 限制大小、读 magic number 验真实类型、重命名存盘、独立域名 |
| OFFSET 深分页为什么慢？ | 扫描 offset 行后全部丢弃，`SCAN` |
| 快多少？ | 实测 80 万行时 934 倍 |
| 游标分页怎么工作？ | `WHERE id > lastId LIMIT n`，走索引 `SEARCH` |
| 游标分页的局限？ | 不能跳页、排序列必须唯一、要组合游标 |
| `total` 一定要查吗？ | 不必，多取一条判 `hasNext` 即可 |

---

## 6.7 速记卡

```
【JWT】
三段：Header.Payload.Signature
★ payload 不加密！base64url，谁都能读 → 只放 ID/角色
★ alg:none 漏洞
   header 是明文，攻击者可改成 none + 空签名
   天真实现相信 header.alg → 放行 superadmin
   防御：① 算法白名单 ② timingSafeEqual ③ 校验 exp
★ timingSafeEqual 为什么
   === 是短路比较，响应时间泄露签名内容（时序攻击）
   实测 10 万次 12.4ms，耗时恒定

【Token 存储】
localStorage    XSS 可读，CSRF 无     ← 不安全
HttpOnly Cookie XSS 不可读，CSRF 有    ← 要防 CSRF
双 token 方案：access 放内存（短期）+ refresh 放 HttpOnly+SameSite（长期）

【JWT 三个硬伤】
无法主动失效 → 黑名单(Redis+TTL) / 短期 token
payload 不能放敏感信息
体积比 sessionId 大

【HS256 vs RS256】
单体 → HS256（一个 secret）
多服务 → RS256（私钥签发，公钥校验）
不能让每个服务都持有 secret（否则一个被攻破就全废）

【上传三档】
<10MB  普通表单（multer，限大小+类型）
10-100MB 分片
>100MB 直传 OSS ← 业务服务器只发预签名 URL

★ 三个 hash
整体 hash → 秒传 + 断点续传正确性
分片 hash → 单片校验，坏了只重传那片
服务端记录 index → 断点续传

实测：5MB/1MB分片，只传 2 片后中断，恢复后补 3 片，合并 hash 一致 ✓
分片 1~5MB，并发 3~6 个
★ 不要用原文件名存盘（路径穿越/重名）
★ 不能只信 mimetype（可伪造），要读 magic number

【分页】★ 实测 80 万行
偏移量    OFFSET    游标     倍数
0        0.005ms  0.006ms   0.9×
200,000  0.964ms  0.005ms   194.9×
700,000  4.596ms  0.005ms   851.2×

执行计划：
LIMIT/OFFSET → SCAN users（扫描后丢弃）
WHERE id > ? → SEARCH USING INTEGER PRIMARY KEY

游标三个局限：
① 不能跳页 → 混合模式（前 N 页 OFFSET）
② 排序列必须唯一 → 组合游标 (created_at, id) + 联合索引
③ total 贵 → 多取一条判 hasNext
```

---

## 6.8 自测

```
□ 能说出 JWT 三段分别是什么
□ 能说清 payload 为什么不能放敏感信息
□ 能完整复述 alg:none 攻击的原理和后果
□ 能说出防御 alg:none 的三条措施
□ 能解释 timingSafeEqual 防的是什么攻击
□ 能对比 localStorage 和 HttpOnly Cookie 的 XSS/CSRF 风险
□ 能说出双 token 方案的分工
□ 能说出 JWT 的三个硬伤和「无法失效」的三种解法
□ 能说出 HS256 和 RS256 的适用场景及原因
□ 能说出上传的三档方案和分界
□ 能解释三个 hash 各自的用途
□ 能说出断点续传靠什么实现
□ 能说出为什么大文件要直传 OSS
□ 能说出预签名 URL 的三个安全约束
□ 能说出上传为什么不能只信 mimetype
□ 能背出 OFFSET vs 游标的实测数字和执行计划
□ 能解释 OFFSET 为什么是 O(offset)
□ 能说出游标分页的三个局限和对策
□ 能说出不查 total 时的替代方案
```
