# 安全 · 06 鉴权体系与数据安全

> 覆盖题号：**3、4、15**
> 对应原题：《说说你对前端鉴权的理解》《如何禁止别人调试自己的前端代码》《前端数据安全》
> 三题共享一个前提：**前端代码、请求和存储都在用户控制之下**。因此鉴权只能做 UX，防调试只能提成本，数据安全只能靠“不放”。

---

## 目录

- [1. 前端鉴权](#1-前端鉴权)
- [2. 四种鉴权方案详解](#2-四种鉴权方案详解)
- [3. RBAC 与前端权限控制的边界](#3-rbac-与前端权限控制的边界)
- [4. 前端数据安全](#4-前端数据安全)
- [5. 如何"禁止"别人调试](#5-如何禁止别人调试)
- [6. 常见坑](#6-常见坑)
- [7. 答题模板](#7-答题模板)
- [8. 追问表](#8-追问表)
- [9. 速记卡](#9-速记卡)

---

## 1. 前端鉴权

### 1.1 认证、授权、审计

| 概念 | 英文 | 回答什么问题 | 例子 |
|---|---|---|---|
| **认证** | Authentication | **你是谁？** | 登录、验证密码/验证码/指纹 |
| **授权** | Authorization | **你能做什么？** | 有没有权限看这个订单、能不能删这条数据 |
| **审计** | Auditing | **你做过什么？** | 操作日志、登录日志 |

登录是认证；能否访问某个页面或资源是授权；操作留痕是审计。

### 1.2 一句话结论

**前端鉴权 = 携带凭证 + 按权限决定渲染什么 + 处理 401/403。** 它只控制“用户看到什么”，不决定“服务端返回什么”。

### 1.3 完整链路

```mermaid
sequenceDiagram
  participant U as 用户
  participant F as 前端
  participant B as 后端

  U->>F: 输入账号密码
  F->>B: POST /login
  B-->>F: 凭证（Set-Cookie session 或返回 token）+ 用户信息 + 权限列表
  Note over F: 存凭证（HttpOnly Cookie 或内存）+ 存权限到 store
  F->>F: 按权限生成可访问路由、菜单、按钮
  U->>F: 访问 /admin
  F->>F: 路由守卫检查权限 → 没权限就跳 403
  F->>B: GET /api/admin/data（自动带凭证）
  B->>B: 校验身份 + 校验权限
  B-->>F: 200 或 403
```

浏览器自动带 Cookie，或在请求头带 token；后端校验身份和权限后才返回数据。

---

## 2. 四种鉴权方案详解

### 2.1 Cookie + Session

**流程：**

```
① 登录成功 → 服务端创建 Session（存内存/Redis/数据库），得到 sessionId
② 响应 Set-Cookie: session=xxx; HttpOnly; Secure; SameSite=Lax
③ 后续请求浏览器自动带 Cookie
④ 服务端用 sessionId 查到 Session 数据 → 知道是谁
```

| 优点 | 缺点 |
|---|---|
| 凭证不暴露给 JS（HttpOnly） | 服务端要存状态（有状态） |
| 可随时失效（删 Session 即可） | 分布式要共享存储（Redis） |
| 实现简单、生态成熟 | 跨域/跨站场景配置麻烦 |
| `SameSite` 可挡大部分 CSRF（顶层 GET 仍放行） | 移动端/第三方接入不友好 |

**集群方案：**

| 方案 | 说明 |
|---|---|
| **Session 共享存储**（Redis） | 最常用 |
| **粘性会话（Sticky Session）** | 同一用户固定到同一台机器（负载均衡配置，机器挂了就丢） |
| **Session 复制** | 每台机器同步全量 Session（内存浪费，适合小集群） |
| **Token 化（JWT）** | 改成无状态 |

### 2.2 JWT

**结构：**

```text
token     = base64url(header) + "." + base64url(payload) + "." + signature

header    = {"alg":"HS256","typ":"JWT"}
payload   = {"sub":"1234","name":"张三","iat":1516239022,"exp":1516242622}
signature = base64url(HMACSHA256(base64url(header) + "." + base64url(payload), secret))

eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0IiwibmFtZSI6IuW8oOS4iSIsImlhdCI6MTUxNjIzOTAyMiwiZXhwIjoxNTE2MjQyNjIyfQ.yLNzhSXYV6ibcR5CVpPrlwjHXvKKvIAMQSFFsikbtr4
```

示例 secret 为 `your-256-bit-secret`，仅用于复现签名。

**Payload 可读，不是加密：**

```js
const [, payload] = token.split('.')
JSON.parse(Buffer.from(payload, 'base64url').toString())
// → { sub: '1234', name: '张三', iat: 1516239022, exp: 1516242622 }
```

浏览器里 `JSON.parse(atob(payload))` 不够：`atob` 按 Latin-1 解码，中文会变成 `name: 'å¼ ä¸'` 这类乱码；payload 含 `-` / `_` 时还会抛 `InvalidCharacterError`。先替换 base64url 字符，再用 `TextDecoder` 解 UTF-8：

```js
const b64uDecode = (s) => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  return new TextDecoder().decode(
    Uint8Array.from(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')), (c) => c.charCodeAt(0)),
  )
}
```

因此 payload 只放 `sub` 和必要声明；密码、身份证号、手机号、权限细节都不放。

**优缺点：**

| 优点 | 缺点 |
|---|---|
| **无状态**，服务端不用存 Session，易水平扩展 | 无状态模式下无法主动失效（签出去就有效到过期） |
| 跨域、跨端友好（放 `Authorization` 头） | 体积比 sessionId 大（每次请求都带） |
| 可携带声明，减少查库 | 放 `Authorization` 头不参与 CSRF；放 Cookie 仍要防 CSRF |
| 适合微服务（各服务自己验签） | 密钥泄露 = 全部凭证可伪造 |
| | 放 localStorage 怕 XSS |

**JWT 陷阱：**

| 陷阱 | 说明 | 防御 |
|---|---|---|
| **`alg: none`** | 验签器若按 `header.alg` 分支并放行 `none`，去掉签名也能通过 | 固定算法白名单，拒绝 `none` |
| **HS256 / RS256 混淆** | 把 `alg` 改成 HS256，用 RSA 公钥当 HMAC 密钥签名；按 token 里的 `alg` 选验证方式就会通过 | 服务端固定算法；公钥只用于 RS256 验签 |
| **无法撤销** | 登出/改密后旧 token 仍有效 | 短过期 + refresh token 轮换 + `jti` 黑名单 |
| **密钥弱/硬编码** | `secret` 进仓库，HS256 密钥可被复用或暴力破解 | 环境变量 + 至少 256 bit 随机密钥 |

签名通过不等于 token 可用：`exp`、`nbf`、`iss`、`aud` 都要单独校验。实测一个已过期的 token，HMAC 验签仍为 `true`，只有 `exp` 检查会拒绝。

实测（Node `crypto`）：

```text
原始签名 true / 篡改 payload false
alg:none → 按 header.alg 分支的验签器 true；空签名 HMAC 比较 RangeError
过期 token → 签名 true，exp 校验 false
HS256 + RSA 公钥当 HMAC 密钥 → 验签 true
```

```js
const payload = jwt.verify(token, PUBLIC_KEY, {
  algorithms: ['RS256'],        // ← 固定算法白名单
  issuer: 'https://auth.example.com',
  audience: 'api.example.com',
})

// 撤销方案：维护一个短期的 jti 黑名单
const revoked = await redis.sismember('jwt:revoked', payload.jti)
if (revoked) throw new Error('token revoked')
```

### 2.3 OAuth 2.0 / OIDC

**四个角色：**

| 角色 | 说明 |
|---|---|
| **Resource Owner** | 用户 |
| **Client** | 你的应用 |
| **Authorization Server** | 授权服务器（如微信、Google） |
| **Resource Server** | 资源服务器（提供用户信息的 API） |

**SPA 使用授权码 + PKCE：**

```mermaid
sequenceDiagram
  participant U as 用户
  participant App as 你的 SPA
  participant AS as 授权服务器

  App->>App: 生成 code_verifier + code_challenge
  App->>U: 跳转到授权页（带 code_challenge）
  U->>AS: 登录并同意授权
  AS-->>App: 回调带 authorization_code
  App->>AS: 用 code + code_verifier 换 token
  AS-->>App: access_token（OIDC 另有 id_token）
```

| 流程 | 状态 | 说明 |
|---|---|---|
| **授权码 + PKCE** | 推荐（SPA / 原生应用） | PKCE 防授权码拦截 |
| ~~Implicit~~ | 不推荐（RFC 9700 §2.1.2：SHOULD NOT） | token 直接在 URL fragment 里，容易泄露 |
| ~~密码模式~~ | 禁止（RFC 9700 §2.4：MUST NOT） | 应用直接拿用户密码，违反 OAuth 初衷 |
| 客户端凭证 | 仅服务间 | 无用户参与 |

SPA 是 public client，没有 `client_secret`。PKCE 让客户端生成一次性 `code_verifier`（43–128 字符），授权请求只带 `code_challenge = BASE64URL(SHA256(code_verifier))`，换 token 时再带 `code_verifier`。授权码即使被截获，没有 verifier 也换不到 token。

实测 RFC 7636 附录 B：`SHA256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")` 的 base64url 为 `E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM`，与附录一致。

OIDC 在 OAuth 2.0 上增加身份层：`id_token` 是 JWT，用来告诉应用“用户是谁”；`access_token` 用于访问资源。Google 等第三方登录通常基于 OIDC；微信网页授权是 OAuth 2.0 授权码流程，不返回 OIDC `id_token`。

### 2.4 SSO 单点登录

一次登录，多系统互通。

| 实现 | 说明 |
|---|---|
| **CAS** | 老牌方案，中心认证服务 + ticket |
| **OIDC / OAuth2** | 现代方案 |
| **SAML** | 企业级（老系统多） |
| **共享 Cookie（同主域）** | `Domain=.example.com`，只适合同主域 |

跨域 SSO 的难点：Cookie 不能跨站，需要“重定向 + ticket”；`SameSite=None` 必须配 `Secure`，同时 CSRF 风险上升。

### 2.5 四种方案对比表

| | Session-Cookie | JWT | OAuth2/OIDC | SSO |
|---|---|---|---|---|
| 状态 | 有状态 | 无状态 | 取决于实现 | 中心有状态 |
| 主动失效 | ✅ 容易 | ❌ 难（需黑名单） | 看实现 | ✅ |
| 水平扩展 | 需共享存储 | ✅ 天然 | ✅ | 中心要扛住 |
| 跨端 | 一般 | ✅ 好 | ✅ 好 | 桌面 Web 好 |
| 安全风险 | CSRF | XSS（存 localStorage 时）/ 密钥泄露 | 授权码拦截（PKCE 防） | 单点故障 |
| 适合 | 传统 Web、同域 | 微服务、多端 | 第三方登录 | 企业内部多系统 |

---

## 3. RBAC 与前端权限控制的边界

### 3.1 RBAC 模型

```
用户 (User)  ──N:N──  角色 (Role)  ──N:N──  权限 (Permission)
                                                 │
                                                 ├─ 菜单权限
                                                 ├─ 页面/路由权限
                                                 ├─ 按钮/操作权限
                                                 └─ 数据权限（行级/字段级）
```

```js
// 后端返回的典型结构
{
  "user": { "id": 1, "name": "张三" },
  "roles": ["admin", "editor"],
  "permissions": [
    "order:list", "order:detail", "order:export",
    "user:list", "user:disable"
  ]
}
```

### 3.2 前端权限控制的三种粒度

**粒度一：路由级（页面能不能进）**

```js
// Vue Router
router.beforeEach((to, from, next) => {
  const required = to.meta.permission
  if (!required) return next()

  const { permissions } = useUserStore()
  if (!permissions.includes(required)) {
    return next({ name: 'Forbidden' })     // 403 页面
  }
  next()
})
```

**粒度二：菜单级（侧边栏显示哪些）**

```js
// 从完整路由表里过滤出有权限的
function filterRoutes(routes, permissions) {
  return routes
    .filter((r) => !r.meta?.permission || permissions.includes(r.meta.permission))
    .map((r) => ({ ...r, children: r.children ? filterRoutes(r.children, permissions) : undefined }))
}
```

**粒度三：按钮/元素级（能不能点）**

```vue
<!-- 指令式（Vue） -->
<script setup>
const vPermission = {
  mounted(el, binding) {
    const { permissions } = useUserStore()
    const need = Array.isArray(binding.value) ? binding.value : [binding.value]
    if (!need.some((p) => permissions.includes(p))) {
      el.parentNode?.removeChild(el)      // 直接移除，而不是 display:none
    }
  },
}
</script>

<template>
  <button v-permission="'order:export'">导出</button>
</template>
```

```jsx
// 组件式（React）
function Can({ permission, children, fallback = null }) {
  const { permissions } = useUserStore()
  const need = Array.isArray(permission) ? permission : [permission]
  return need.some((p) => permissions.includes(p)) ? children : fallback
}

<Can permission="order:export"><button>导出</button></Can>
```

`display:none` 的元素仍在 DOM 里，改一行 CSS 就能看到；移除后 DOM 中不存在该元素。

### 3.3 前端权限的边界

| 前端能做的 | 前端做不了的 |
|---|---|
| 不给用户看没权限的菜单/路由/按钮 | **阻止用户直接调接口** |
| 提供更好的 UX（少走弯路） | **阻止用户改请求参数**（如 `userId=2`） |
| 减少无效请求 | **阻止用户用 curl/Postman 发请求** |
| 前端展示层的权限一致性 | **数据权限（行级/字段级）** |

**三种绕过方式：**

```js
// ① 直接改 JS 变量
useUserStore().permissions.push('order:export')

// ② 直接调接口
fetch('/api/order/export', { headers: { Authorization: `Bearer ${token}` } })

// ③ 改请求参数（水平越权）
// GET /api/order/123  →  GET /api/order/124
```

**结论**：前端权限是 UX 层的可见性控制，不是安全边界。真正的授权在后端每个接口上：校验身份、权限，以及资源是否属于当前用户。

### 3.4 水平越权与垂直越权

| 类型 | 说明 | 例子 | 防御 |
|---|---|---|---|
| **水平越权** | 同角色用户之间越界 | 用户 A 改 `orderId` 看到用户 B 的订单 | 每个查询都带 `where user_id = current_user` |
| **垂直越权** | 低权限做高权限操作 | 普通用户直接调管理员接口 | 每个接口做角色/权限校验 |

```js
// ❌ 水平越权漏洞
app.get('/api/order/:id', (req, res) => {
  const order = db.order.findById(req.params.id)   // 只按 id 查，没校验归属
  res.json(order)
})

// ✅ 正确
app.get('/api/order/:id', (req, res) => {
  const order = db.order.findOne({
    id: req.params.id,
    user_id: req.user.id,        // ← 强制带当前用户
  })
  if (!order) return res.status(404).end()   // 不透露"存在但无权限"
  res.json(order)
})
```

返回 404 而不是 403：403 会告诉攻击者“这个资源存在”，404 不泄露存在性。

---

## 4. 前端数据安全

### 4.1 打进 bundle 的东西都是公开的

```js
const API_KEY = 'sk-live-abc123...'
fetch(`https://api.example.com/data?key=${API_KEY}`)
```

打包后密钥在 JS 产物里是明文字符串，打开 DevTools 搜一下就有。混淆只改变量名，字符串常量还在。

**三个常见误解：**

| 误解 | 真相 |
|---|---|
| 用环境变量就能保密 | **`VITE_` / `REACT_APP_` / `NEXT_PUBLIC_` 前缀的变量会在构建时被静态替换进产物**。它们只用于区分环境，不用于保密 |
| `.env` 用户看不到 | `.env` 只在**构建时**被读取，最终值已经内联到 bundle 里 |
| 做了混淆/加密就安全 | 字符串常量还在；加密的密钥也在同一个 bundle 里 |

```bash
# Vite 的实际行为：构建时把 import.meta.env.VITE_XXX 替换成字面量
echo 'VITE_API_KEY=sk-live-abc' > .env.production
# 构建后，bundle 里就是 'sk-live-abc'，任何人可搜到
```

**自查方法：**

```bash
# 在 dist 里搜敏感词
grep -rE "sk-live|secret|password|AKID|Bearer [A-Za-z0-9]{20,}" dist/

# 或者更狠：grep 常见的密钥格式
grep -rE "(AKIA|sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{36})" dist/
```

**正确做法：**

| 需求 | 正确方案 |
|---|---|
| 调用第三方 API（如地图、支付） | **后端代理**（前端调自己的接口，后端带上密钥去调） |
| 需要限制调用量 | 后端做限流 + 短期临时凭证（如 STS、前端拿临时 token） |
| 需要在浏览器直连（如某些地图 SDK） | 用**域名白名单 + 配额限制**的 key（服务商支持），接受它公开 |
| 真正的机密（数据库密码、私钥） | **永远不进前端** |

### 4.2 敏感数据不要放 localStorage

```js
// ❌ 任何 XSS 都能一行偷走
localStorage.setItem('token', token)
localStorage.setItem('userInfo', JSON.stringify({ idCard: '...' }))

// ✅ 只放非敏感内容
localStorage.setItem('theme', 'dark')
localStorage.setItem('locale', 'zh-CN')
```

| 存储 | 能放什么 |
|---|---|
| `localStorage` | 主题、语言、非敏感的用户偏好、草稿（不含隐私） |
| `sessionStorage` | 同上，但生命周期短 |
| **Cookie（`HttpOnly`）** | 会话凭证（JS 读不到） |
| **内存变量** | access token（短命，刷新丢失但可续） |

### 4.3 前端加密≈混淆

```js
// ❌ 在前端加密密码，密钥也在前端
const key = 'a1b2c3d4'                             // 密钥在前端
const encrypted = CryptoJS.AES.encrypt(password, key).toString()
fetch('/api/login', { body: JSON.stringify({ password: encrypted }) })
```

**为什么没有意义：**

1. **密钥也在前端**——攻击者能看到加密逻辑和密钥，能自己解密
2. **攻击者不需要解密**——他直接重放这个密文就能登录
3. **真正的保护是 HTTPS**——传输层已经加密，前端再加密是重复劳动且更弱

**少数场景：**

| 场景 | 说明 |
|---|---|
| 减少明文在日志/埋点里出现 | 降低误泄露概率，不是安全边界 |
| 满足某些合规的“字段加密”要求 | 形式合规 |
| 密码在传输前做一次哈希（老方案） | 已被 HTTPS 取代，不要再做（会引入“哈希即密码”的问题） |

前端加密的密钥必然在前端，只能算混淆。传输保护靠 HTTPS，密码存储靠后端 bcrypt/argon2 加盐哈希。

### 4.4 日志与错误上报脱敏

```js
// ❌ 把敏感信息发给监控平台（等于把数据给了第三方）
Sentry.captureException(err, {
  extra: { requestBody: JSON.stringify(formData) },   // 含密码、身份证
})

// ✅ 统一脱敏
const SENSITIVE = ['password', 'pwd', 'token', 'secret', 'idCard', 'phone', 'bankCard', 'cvv']

function mask(obj) {
  if (obj == null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(mask)
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => {
      if (SENSITIVE.some((s) => k.toLowerCase().includes(s))) {
        return [k, '***']
      }
      return [k, typeof v === 'object' ? mask(v) : v]
    })
  )
}

app.config.errorHandler = (err, instance, info) => {
  report({ message: err.message, stack: err.stack, info, extra: mask(context) })
}
```

**两个容易忽略的位置：**

| 位置 | 风险 |
|---|---|
| `console.log` 打印完整响应 | 生产环境要去掉（用 `terser` 的 `drop_console`） |
| **URL 里带 token** | 可能进浏览器历史、Referer、服务器日志、截图 |

### 4.5 sourcemap 不要公开

```js
// Vite
export default {
  build: {
    sourcemap: false,              // 生产不生成
    // 或：sourcemap: 'hidden'     // 生成但不写 sourceMappingURL 注释
  },
}
```

```js
// webpack
module.exports = {
  devtool: false,                  // 或 'hidden-source-map'
}
```

**正确做法**：生成 `hidden-source-map` → 上传到 Sentry 等监控平台 → 从部署目录删除 `.map` 文件。这样既能有可读的堆栈，又不泄露源码。

sourcemap 若包含 `sourcesContent`，能还原出源码（包括注释、内部接口路径、硬编码的测试账号）。有工具（如 `sourcemapper`）可以抓取暴露的 `.map` 文件。

### 4.6 敏感页面的缓存与展示

| 场景 | 措施 |
|---|---|
| 订单详情、个人信息页 | `Cache-Control: no-store`（防止“后退键”看到上一个用户的页面，尤其是在公用电脑上） |
| 手机号/身份证展示 | 脱敏显示 `138****1234` |
| 敏感操作 | 二次验证（密码/短信） |
| 复制/截图 | 可加提示（无法真正阻止） |
| 打印 | 可加 `@media print` 隐藏敏感信息 |

```http
Cache-Control: no-store, no-cache, must-revalidate
Pragma: no-cache
```

用户在公用电脑上退出后，下一个人点“后退”仍可能看到缓存页面；`no-store` 禁止浏览器存储该响应。

### 4.7 自查清单

```
□ dist 里 grep 不到任何 secret / API key / 私钥
□ 所有 VITE_/REACT_APP_/NEXT_PUBLIC_ 变量都被 review 过（确认可以公开）
□ localStorage 里没有 token、身份证、手机号
□ 生产构建 sourcemap 关闭或已上传后删除
□ console.log 已被 drop_console 移除
□ 错误上报走统一脱敏函数
□ URL 里不携带 token（改用 header 或 body）
□ 敏感页面有 Cache-Control: no-store
□ 列表/详情页的手机号、身份证做了脱敏
□ 文件下载响应带 Content-Disposition: attachment
```

---

## 5. 如何"禁止"别人调试

### 5.1 一句话结论

**不可能真正禁止。** 前端代码最终交给浏览器执行，DevTools 是浏览器的一部分，页面无权控制；远程调试可以绕过页面内的所有检测。所有手段都只是提高门槛。

### 5.2 常见手段与真实效果

| 手段 | 实现 | 绕过方式 | 有效性 |
|---|---|---|---|
| **`debugger` 死循环** | `setInterval(() => { debugger }, 100)` | DevTools → Sources → **Deactivate breakpoints（Ctrl+F8）**；或右键 "Never pause here" | ⭐（几乎无效，还拖慢性能） |
| **检测窗口尺寸差** | `window.outerWidth - innerWidth > 160` | 把 DevTools 拖成独立窗口；或用远程调试 | ⭐⭐ |
| **检测 `console.log` getter** | 用带 getter 的对象，DevTools 展开时才触发 | 不展开那个对象；或用无 DevTools 的调试方式 | ⭐⭐ |
| **`debugger` 计时检测** | 执行 `debugger` 前后 `performance.now()` 差值大 → 说明被暂停 | 关断点 | ⭐⭐ |
| **禁用右键 / F12** | `oncontextmenu` / `onkeydown` 拦 F12 | 菜单栏打开；Ctrl+Shift+I；直接抓包 | ⭐（还影响正常用户体验） |
| **代码混淆** | `javascript-obfuscator` 控制流平坦化、字符串数组加密 | de4js、AST 还原、动态调试打日志 | ⭐⭐⭐（提高阅读成本，但不可阻止） |
| **域名锁** | 检测 `location.host` | 改 hosts / 本地代理 | ⭐ |
| **WebAssembly** | 核心逻辑编译成 wasm | 仍可调试；只是更麻烦 | ⭐⭐⭐ |

这些手段的共同点：检测逻辑本身也在前端，能被阅读、修改或跳过。

### 5.3 为什么无法真正禁止

| 原因 | 说明 |
|---|---|
| **① 代码是交给对方执行的** | 如同把文件交给别人却要求他不能打开看 |
| **② DevTools 不属于页面** | 它是浏览器的一部分，页面无权控制；甚至可以用**远程调试**（`chrome://inspect`）完全绕过页面内的检测 |
| **③ 攻击者不需要看你的代码** | 直接抓包看接口、直接改请求参数、用 Postman 调接口——这些都不需要 DevTools |

防调试假设“看不到代码就安全”，属于 security through obscurity；安全依赖“即使看懂也做不了”。

### 5.4 应该做什么

| 目标 | 正确做法 |
|---|---|
| 保护密钥 | **不放前端**（见 4.1） |
| 保护业务逻辑 | **核心逻辑放后端**（如价格计算、优惠券校验） |
| 防止篡改请求 | **接口签名 + 后端校验**（密钥仍不能在前端，所以更现实的是“后端校验所有输入”） |
| 提高逆向成本（有商业价值时） | 代码混淆（`javascript-obfuscator`）+ 关键逻辑 wasm + 接口签名 |
| 防批量爬取 | 后端限流、风控、验证码、行为分析 |
| 防截图/录屏 | **做不到**；可用水印（含用户 ID）做**追溯威慑** |

**数字水印：**

```js
function addWatermark(userId) {
  const wm = document.createElement('div')
  wm.style.cssText = `
    position: fixed; inset: 0; pointer-events: none; z-index: 9999;
    background-image: url("data:image/svg+xml,...");  /* 含 userId 的斜向文字 */
    opacity: .06;
  `
  document.body.appendChild(wm)
}
```

水印不能阻止截图，只提高泄露被追溯的概率。

---

## 6. 常见坑

| 症状 | 常见原因 | 位置 |
|---|---|---|
| 登录后接口仍 401 | 凭证没带、过期，或 Cookie 的 `SameSite`/`Secure` 配置不对 | 2.1 / 2.2 |
| 普通用户能看别人的订单 | 查询只按资源 ID，没带 `user_id` | 3.4 |
| 改一下 store 就能看到按钮 | 把前端权限当成了安全边界 | 3.3 |
| `dist` 里能搜到密钥 | `VITE_` / `NEXT_PUBLIC_` 变量被内联 | 4.1 |
| XSS 后 token 被读走 | token 存在 `localStorage` | 4.2 |
| 生产源码被还原 | sourcemap 公开 | 4.5 |
| 监控平台出现密码 | 日志/错误上报未脱敏 | 4.4 |
| 后退键看到上一个用户的数据 | 敏感页缺 `Cache-Control: no-store` | 4.6 |
| `debugger` 防调试被 Ctrl+F8 绕过 | 断点可以被关闭 | 5.2 |
| 下载接口在浏览器里直接打开 | 缺 `Content-Disposition: attachment` | 4.7 |

---

## 7. 答题模板

### 7.1 前端鉴权 · 30 秒

- 开场：认证（你是谁）、授权（你能做什么）、审计（你做过什么）（1.1）。
- 定义：前端鉴权做三件事——带凭证、按权限渲染、处理 401/403（1.2）。
- 选型：按“状态、主动失效、跨端、适用场景”四个维度过一遍（2.5）。
- 收尾：前端权限是 UX 可见性控制，不是安全边界（3.3）。

### 7.2 前端鉴权 · 2 分钟

- 结论先行：展示层控制（3.3）。
- 职责：前端三件事 + 后端逐接口校验（1.2 / 3.4）。
- 选型：Session / JWT / OAuth2 + PKCE / SSO 的取舍（2.1–2.5）。
- JWT 重点：结构、签名与验签、撤销（2.2）。
- 落地：RBAC 三粒度（3.2），补 Cookie 配置（2.1）。

### 7.3 前端数据安全 · 30 秒

- bundle 公开与密钥处理（4.1）。
- 客户端存储（4.2）。
- 前端加密与密码存储（4.3）。
- 日志与错误上报脱敏（4.4）。
- sourcemap 与敏感页缓存（4.5 / 4.6）。

### 7.4 禁止调试 · 30 秒

- 结论：不可能真正禁止（5.1）。
- 常见手段与对应绕过（5.2）。
- 三条根本原因（5.3）。
- 替代方案与数字水印（5.4）。

---

## 8. 追问表

| # | 追问 | 要点 |
|---|---|---|
| 1 | 认证和授权区别？ | 你是谁 vs 你能干什么 |
| 2 | Session 和 JWT 怎么选？ | 要主动踢人/同域用 Session；微服务/多端用 JWT（2.5） |
| 3 | JWT 能撤销吗？ | 不能直接撤销；短过期 + refresh 轮换 + `jti` 黑名单（2.2） |
| 4 | JWT 是加密的吗？ | 只签名，payload 可读（2.2） |
| 5 | `alg: none` 怎么防？ | 固定算法白名单，拒绝 `none`（2.2） |
| 6 | HS256/RS256 混淆怎么防？ | 服务端固定算法，公钥只用于 RS256（2.2） |
| 7 | SPA 为什么不能用 `client_secret`？ | public client 没有秘密；用 PKCE（2.3） |
| 8 | Implicit 为什么不用？ | RFC 9700 §2.1.2 SHOULD NOT；token 在 fragment 易泄露（2.3） |
| 9 | RBAC 和 ABAC 区别？ | 角色 vs 属性；ABAC 按部门、时间、资源属性动态判断 |
| 10 | 前端路由守卫安全吗？ | 不安全，只决定是否渲染；接口必须自己校验（3.3） |
| 11 | 水平/垂直越权？ | 同角色改 ID vs 低权限调高权限接口（3.4） |
| 12 | 无权限为什么返回 404？ | 403 泄露资源存在性（3.4） |
| 13 | 环境变量能保密吗？ | 不能，`VITE_` 等前缀会内联进 bundle（4.1） |
| 14 | 前端加密有意义吗？ | 基本没有；密钥在前端，只能算混淆（4.3） |
| 15 | sourcemap 泄露什么？ | 源码、注释、内部路径、可能的测试账号（4.5） |
| 16 | 敏感页为什么 `no-store`？ | 防止后退键读到上一个用户的数据（4.6） |
| 17 | 怎么防截图？ | 做不到；用带用户 ID 的水印追溯（5.4） |
| 18 | 前端能防爬虫吗？ | 不能；后端限流、风控、验证码、行为分析（5.4） |

---

## 9. 速记卡

```text
【边界】前端 = 可见性控制；安全边界 = 后端逐接口校验身份 + 权限 + 资源归属
【选型】Session 有状态可撤销｜JWT 无状态不可撤销｜OAuth2 SPA = 授权码 + PKCE｜SSO = 中心认证 + ticket
【JWT】base64url(header).base64url(payload).HMAC；只签名不加密；固定 alg；exp 单独校验
【撤销】短过期 + refresh 轮换 + jti 黑名单
【越权】水平 = 改 ID → where user_id；垂直 = 低权限调高权限 → 接口校验；无权限 404
【数据】bundle 公开｜不进 localStorage｜前端加密≈混淆｜日志脱敏｜sourcemap 不公开｜no-store
【防调试】不可能禁止；只提成本；密钥和核心逻辑放后端；水印追溯
```
