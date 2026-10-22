# 安全 · 08 工程化落地：SQL 注入、供应链与检查清单

> 覆盖题号：**17、2**（落地部分）
> 对应原题：《SQL 注入》《web 常见的攻击方式及防御》
> 前七册讲的是"某一种攻击怎么防"，这一册讲**怎么让防御在项目里持续生效**——包含前端防不了的部分怎么协作、供应链怎么管、上线前怎么卡。

---

## 目录

- [1. SQL 注入](#1-sql-注入)
- [2. NoSQL 注入（前端更该知道的一种）](#2-nosql-注入前端更该知道的一种)
- [3. 供应链安全（最容易被忽略的一类）](#3-供应链安全最容易被忽略的一类)
- [4. 第三方脚本治理](#4-第三方脚本治理)
- [5. 上线前安全检查清单](#5-上线前安全检查清单)
- [6. 安全责任分工表](#6-安全责任分工表)
- [7. 一个漏洞修复的讲述模板](#7-一个漏洞修复的讲述模板)
- [8. 常见坑](#8-常见坑)
- [9. 答题模板](#9-答题模板)
- [10. 追问表](#10-追问表)
- [11. 速记卡](#11-速记卡)

---

## 1. SQL 注入

### 1.1 先给结论（这题的正确开场）

> **SQL 注入是后端漏洞，前端防不了。** 前端能做的只是"输入格式校验"，它的价值是提升体验和降低误操作，**对攻击者零作用**——攻击者直接用 curl 发请求，绕过你所有前端校验。
>
> **真正有效的防御只有一条：参数化查询（预编译语句）。**

**这句话就是本题的核心。** 面试时说清这个边界，比背十种防御手段更有价值。

### 1.2 原理

```js
// ❌ 典型漏洞代码：字符串拼接
const sql = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`
db.query(sql)
```

**攻击一：绕过登录**

```
username = admin' --
password = 任意

拼出来的 SQL：
SELECT * FROM users WHERE username = 'admin' --' AND password = '任意'
                                          ↑ 注释掉后面的密码校验
→ 直接以 admin 身份登录
```

**攻击二：永真条件**

```
username = ' OR '1'='1
password = ' OR '1'='1

SELECT * FROM users WHERE username = '' OR '1'='1' AND password = '' OR '1'='1'
→ 返回所有用户
```

**攻击三：联合查询窃取数据**

```
username = ' UNION SELECT username, password, null FROM admin_users --
→ 把管理员表的数据"拼"进查询结果
```

**攻击四：破坏数据**

```
username = '; DROP TABLE users; --
```

**攻击五：盲注 / 时间盲注**

```
username = ' AND (SELECT SUBSTRING(password,1,1) FROM users WHERE id=1)='a' --
→ 通过页面"是否正常返回"或"响应时间"逐字符猜出数据
```

### 1.3 根本原因

**和 XSS 完全同构**：**数据被当成了代码。**

```
XSS：用户输入的字符串被 HTML 解析器当成标签/脚本
SQL 注入：用户输入的字符串被 SQL 解析器当成语法
```

> **这个类比非常好用**：面试时把 XSS 和 SQL 注入放在一起讲"注入类漏洞的共同本质是数据与代码没有分离"，会让回答有统一的框架感。

### 1.4 防御：只有一个正确答案

**参数化查询 / 预编译语句（Prepared Statement）**

```js
// ✅ Node + mysql2
const [rows] = await pool.execute(
  'SELECT * FROM users WHERE username = ? AND password_hash = ?',
  [username, passwordHash]
)
// 注意用 execute 而不是 query（mysql2 的 execute 才是真正的预编译）
```

```java
// ✅ Java + JDBC
PreparedStatement ps = conn.prepareStatement(
  "SELECT * FROM users WHERE username = ? AND password_hash = ?");
ps.setString(1, username);
ps.setString(2, passwordHash);
ResultSet rs = ps.executeQuery();
```

```python
# ✅ Python
cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
```

**为什么参数化查询能根治**：

```
普通拼接：SQL 字符串 = "SELECT ... WHERE username = '" + 用户输入 + "'"
          → 用户输入参与"语法解析"

参数化：   SQL 模板先被数据库"预编译"成执行计划（语法已确定）
          用户输入作为"纯数据"传入，永远不参与语法解析
          → 即使输入里有 ' 或 --，也只是数据的一部分
```

> **关键理解**：**不是"转义了引号"，而是"数据根本不进入语法层"**。这比转义彻底得多。所以"用 `replace(/'/g, "''")` 转义"是**下策**（容易漏、编码问题、不同数据库行为不同）。

**其他防御（辅助，不能替代）**：

| 手段 | 说明 |
|---|---|
| **ORM / Query Builder** | 如 Prisma、TypeORM、Sequelize，默认参数化。**但要注意：`raw()` / `query()` 手写 SQL 仍有风险** |
| **最小权限数据库账号** | 应用账号只给 `SELECT/INSERT/UPDATE`，不给 `DROP/GRANT`；只给需要的库 |
| **输入类型校验** | `id` 必须是数字、`email` 必须符合格式——**这是纵深防御，不是主防御** |
| **错误信息不外露** | 不要把 SQL 报错直接返回给前端（会泄露表结构） |
| **WAF** | 兜底，能拦常见 payload，但可被绕过 |
| **存储过程** | 参数化的一种形式，但维护成本高 |

**关于"转义"**：

```js
// ⚠️ 下策：手工转义
const safe = input.replace(/'/g, "''").replace(/\\/g, '\\\\')
```

| 问题 | 说明 |
|---|---|
| 不同数据库转义规则不同 | MySQL 用 `\`，标准 SQL 用 `''` |
| 编码绕过 | 宽字节注入（GBK 编码下 `%bf%27`） |
| 容易漏 | 数字型注入不需要引号，转义引号完全无效 |

> **结论**：`数字型注入`（`WHERE id = ${id}`）里**根本没有引号可以转义**，所以"转义引号"防不住。**这正说明转义不是正解。**

### 1.5 前端在这件事上的真实位置

| 前端能做 | 前端做不到 |
|---|---|
| 输入格式校验（手机号、邮箱、长度） | 阻止攻击者直接发请求 |
| 提交前做类型转换（把 `id` 转成 `Number`） | 阻止 SQL 拼接 |
| 错误提示友好化（不暴露后端错误细节） | 任何真正的防护 |
| **不要拼接 SQL 字符串传给"通用查询接口"** | — |

> **最后一条很关键**：有些项目为了"灵活"，后端提供一个 `POST /api/query` 接口，前端传 SQL 片段。**这是把后端的洞直接搬到前端来**，遇到就要立刻反对。

### 1.6 30 秒版

> "SQL 注入是用户输入被拼进 SQL 语句，被数据库当成语法执行。它和 XSS 是同构的——都是数据被当成代码。防御只有一个正解：**参数化查询/预编译**，让用户输入永远作为纯数据传入，不参与语法解析。**这是后端的事，前端防不了**，前端能做的只是输入格式校验，那只是提升体验，对攻击者没用。"

---

## 2. NoSQL 注入（前端更该知道的一种）

> **为什么放在这里**：因为它的攻击载荷是 **JSON 对象**，而前端就是发 JSON 的。这在 Node + MongoDB 的项目里非常常见。

### 2.1 原理

```js
// ❌ 危险：直接把 req.body 里的对象透传给查询
app.post('/login', async (req, res) => {
  const { username, password } = req.body
  const user = await db.collection('users').findOne({ username, password })
  // ...
})
```

**攻击**：前端发这个 JSON

```json
{
  "username": "admin",
  "password": { "$ne": null }
}
```

**实际执行的查询**：

```js
db.collection('users').findOne({
  username: 'admin',
  password: { $ne: null }      // ← 意思是"密码不等于 null"，永远成立
})
// → 直接登录成功，不需要知道密码
```

**其他危险操作符**：

| 操作符 | 效果 |
|---|---|
| `{"$gt": ""}` | 大于空字符串 → 几乎匹配任何非空值 |
| `{"$ne": null}` | 不等于 null → 匹配任何存在的值 |
| `{"$regex": "^a"}` | 正则匹配 → 可做盲注逐字符猜 |
| `{"$where": "..."}` | **直接执行 JS**（最危险） |

### 2.2 防御

```js
// ✅ ① 强制类型校验（最有效）
app.post('/login', async (req, res) => {
  const { username, password } = req.body

  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'invalid input' })
  }
  if (username.length > 64 || password.length > 128) {
    return res.status(400).json({ error: 'input too long' })
  }

  const user = await db.collection('users').findOne({ username })
  if (!user) return res.status(401).json({ error: 'invalid credentials' })

  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return res.status(401).json({ error: 'invalid credentials' })
  // ...
})
```

```js
// ✅ ② 剥离以 $ 开头的键（递归）
function stripOperators(obj) {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(stripOperators)
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([k]) => !k.startsWith('$'))
      .map(([k, v]) => [k, stripOperators(v)])
  )
}
```

| 防御 | 说明 |
|---|---|
| **类型校验（`typeof === 'string'`）** | 最有效，直接断掉对象注入 |
| **禁止 `$` 开头的键** | 递归清理 |
| **禁用 `$where`** | MongoDB 可配置禁用 JS 执行 |
| **Schema 校验** | 用 Zod / Joi / class-validator 收口所有入参 |
| **最小权限数据库账号** | 只给需要的集合权限 |

> **前端能配合的**：**不要把整个表单对象直接 `JSON.stringify` 发出去**，明确构造 `{ username: String(x), password: String(y) }`。这是很好的习惯，虽然不能替代后端校验。

---

## 3. 供应链安全（最容易被忽略的一类）

> **这一节是"2020 年后的新重点"。** 前端项目动辄 1000+ 个依赖，你审计过几个？

### 3.1 一个残酷的事实

```
你的项目代码：约 5000 行
你的 node_modules：约 500,000 行
→ 你写的代码占你运行的代码的 1%
```

**任何一层依赖被投毒，你整站的安全就没了**——因为依赖运行在你的**服务端（构建时）**或**用户浏览器（运行时）**，拥有完全权限。

### 3.2 四种攻击形式

| 形式 | 说明 | 真实案例 |
|---|---|---|
| **恶意包（typosquatting）** | 起一个和热门包很像的名字 | `crossenv`（模仿 `cross-env`）、`djang0` |
| **维护者账号被盗 → 发布恶意版本** | 最防不胜防 | `event-stream@3.3.6` 引入 `flatmap-stream` 窃取比特币 |
| **维护者主动"投毒"/抗议** | 作者自己搞事 | `colors` / `faker` 作者自毁；`node-ipc` 抗议性删文件 |
| **`postinstall` 脚本** | 安装时执行任意命令 | 大量恶意包靠这个偷环境变量、SSH 密钥 |
| **CDN 篡改** | 公共 CDN 上的文件被改 | 用 SRI 防（见 05 册） |

> **最经典的 `event-stream` 事件值得记住**：原作者不想维护了，把包转让给一个"热心贡献者"，那人加了一个看似无害的依赖 `flatmap-stream`，里面藏了针对 Copay 钱包的窃取代码。**这个攻击潜伏了两个月才被发现。**

### 3.3 防御清单（可直接落地）

| # | 措施 | 说明 |
|---|---|---|
| 1 | **提交 lockfile** | `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock`，锁定精确版本 |
| 2 | **CI 用 `npm ci` 而不是 `npm install`** | `ci` 严格按 lockfile 安装，不会偷偷升级 |
| 3 | **`npm ci --ignore-scripts`** | **禁用 `postinstall`**，这是最高性价比的一招 |
| 4 | **`npm audit` / `pnpm audit` 进 CI** | 有高危就 fail |
| 5 | **依赖数量审计** | 定期看 `npm ls --depth=0`，删掉不用的 |
| 6 | **新依赖需要 review** | 加依赖前看：下载量、维护活跃度、有没有 `postinstall`、代码量是否合理 |
| 7 | **私有 registry / 镜像** | 内部包不公开；外部包走可信镜像 |
| 8 | **SRI（CDN 资源）** | 见 05 册 |
| 9 | **构建环境隔离** | CI 里不挂载生产密钥；用最小权限的 token |
| 10 | **npm provenance / 签名验证** | npm 的供应链证明，验证包确实来自对应仓库的 CI |
| 11 | **SBOM（软件物料清单）** | 生成依赖清单，出问题时能快速定位影响范围 |
| 12 | **Socket.dev / Snyk 等工具** | 检测"行为异常"（不只是 CVE），比如新版本突然加了网络请求 |

```bash
# 一条很实用的 CI 检查
npm ci --ignore-scripts
npm audit --audit-level=high
npx depcheck                      # 找出没用到的依赖
```

```json
// .npmrc：全局禁用安装脚本（更彻底）
ignore-scripts=true
```

> **`--ignore-scripts` 的注意事项**：有些包（如 `sharp`、`esbuild`、`puppeteer`）需要安装脚本下载二进制。所以实践上要**白名单**：

```json
// package.json
{
  "trustedDependencies": ["esbuild", "sharp"]
}
```

### 3.4 一个很现实的判断

> **面试时可以说**："供应链安全是前端最容易被忽略的一块。我的实践是三条底线：**lockfile 必须提交、CI 必须用 `npm ci --ignore-scripts`、新依赖必须 review**。前两条是零成本的，能挡掉大部分投毒。第三条是习惯问题——很多人 `npm i` 一个包只看名字像不像，不看它是不是真的是那个包。"

---

## 4. 第三方脚本治理

### 4.1 核心认知

> **引入任何第三方脚本，等于把页面的完全控制权交给对方。**
> 因为 JS 在同源下执行——它能读 Cookie、读 DOM、改页面、发请求。**它和 XSS 的危害完全一样，只是它是"你主动引入的"。**

### 4.2 常见第三方脚本及其风险

| 类型 | 例子 | 风险 |
|---|---|---|
| 统计/埋点 | Google Analytics、百度统计 | 能读全站数据 |
| 客服 | 各类在线客服 SDK | 能读页面、能改 DOM（有些会注入广告） |
| 广告 | 广告联盟 | **风险最高**，历史上多次出现恶意投放 |
| A/B 测试 | Optimizely 等 | 能改页面任意内容 |
| 地图 | 高德/百度/Google Maps | 体积大（1MB+），权限多 |
| 支付 | 支付 SDK | 涉及资金，必须严格 |
| 社交 | 分享按钮、评论 | 常带追踪 |

### 4.3 治理手段

| 手段 | 说明 |
|---|---|
| **能自建就自建** | 统计可以用自研埋点，风险可控 |
| **SRI 校验** | 静态资源加 `integrity`（见 05 册） |
| **`sandbox` iframe 隔离** | 把重脚本放进 iframe，不给 `allow-same-origin`（见 04 册） |
| **CSP 限制** | `script-src` 只允许必要域名 |
| **延后加载** | 非关键脚本在交互后加载（也提升性能） |
| **定期审计** | 看对方最近的版本变化、有没有被收购/易主 |
| **降级方案** | 第三方挂了页面不能崩（`onerror` 兜底） |

```html
<!-- 延后加载第三方脚本（同时也提升性能） -->
<script>
  const load = () => {
    const s = document.createElement('script')
    s.src = 'https://third-party.example.com/sdk.js'
    s.async = true
    s.onerror = () => console.warn('第三方脚本加载失败')
    document.head.appendChild(s)
  }
  ;['scroll', 'click', 'keydown'].forEach((e) =>
    window.addEventListener(e, load, { once: true, passive: true })
  )
</script>
```

---

## 5. 上线前安全检查清单

> **这是本册最实用的部分。** 可以直接贴到项目的 PR 模板或发布流程里。

### 5.1 前端代码层

```
□ 没有 innerHTML / v-html / dangerouslySetInnerHTML 直接用用户输入
□ 所有 href / src 绑定用户输入时校验了协议（挡 javascript:）
□ 富文本渲染前经过 DOMPurify
□ 所有 target="_blank" 都有 rel="noopener noreferrer"
□ postMessage 发送时 targetOrigin 不是 '*'
□ postMessage 接收时校验了 event.origin（精确匹配）+ event.source
□ 没有 eval / new Function / setTimeout(字符串)
□ 没有把 token 拼进 URL
□ 敏感数据没有存 localStorage
```

### 5.2 打包产物层

```
□ dist 里 grep 不到 secret / API key / 私钥
□ 所有 VITE_ / REACT_APP_ / NEXT_PUBLIC_ 变量都确认过可公开
□ 生产 sourcemap 已关闭（或已上传后删除）
□ console.log 已移除（drop_console）
□ 没有引入体积异常大的依赖（bundle analyzer 检查）
□ 第三方脚本都用了 SRI（如果是公共 CDN）
```

### 5.3 响应头层

```
□ Content-Security-Policy 已配（至少 default-src 'self' + object-src 'none' + base-uri 'none' + frame-ancestors）
□ Strict-Transport-Security
□ X-Content-Type-Options: nosniff
□ Referrer-Policy: strict-origin-when-cross-origin
□ X-Frame-Options（兼容老浏览器）
□ Permissions-Policy
□ 4xx/5xx 响应也带这些头（nginx add_header 要加 always）
```

### 5.4 Cookie 层

```
□ 会话 Cookie: HttpOnly + Secure + SameSite=Lax（或 Strict）
□ 没有设多余的 Domain=.example.com
□ 优先用 __Host- 前缀
□ 敏感页面响应带 Cache-Control: no-store
```

### 5.5 接口层

```
□ 跨域 ACAO 是精确白名单（不能是 * 或反射 Origin）
□ ACAO 与 Allow-Credentials 组合正确
□ 有 Vary: Origin
□ 所有接口都做了身份校验
□ 涉及资源 ID 的接口校验了归属（防水平越权）
□ 无权限返回 404 而非 403（对"资源不属于你"）
□ 错误信息不暴露堆栈/SQL/内部路径
□ 敏感操作有二次验证
```

### 5.6 工程层

```
□ lockfile 已提交
□ CI 使用 npm ci --ignore-scripts
□ npm audit 无高危
□ 新增依赖经过 review
□ 上传文件走独立域 + Content-Disposition: attachment
□ 错误上报做了脱敏
□ 有 CSP report-to 或安全事件监控
```

### 5.7 一条命令快速自查

```bash
# 打包产物敏感信息扫描
grep -rInE "(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|-----BEGIN [A-Z ]*PRIVATE KEY-----|password\s*[:=]\s*['\"][^'\"]+)" dist/ || echo "✅ 未发现明显密钥"

# 危险 API 扫描
grep -rInE "(innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML|v-html|document\.write|eval\(|new Function\()" src/ | grep -v "// safe" || echo "✅ 未发现危险 API"
```

---

## 6. 安全责任分工表

> **面试时问"你觉得前端安全该谁负责"，这张表就是最好的答案。**

| 风险 | 前端 | 后端 | 运维/安全 |
|---|---|---|---|
| **XSS** | ✅ **主责**：输出编码、CSP 配合、禁用危险 API | 辅助：存储前过滤、Cookie HttpOnly | CSP 头配置 |
| **CSRF** | 辅助：带 Token、`application/json` | ✅ **主责**：Token 签发校验、SameSite | — |
| **SQL 注入** | ❌ 只能做输入校验 | ✅ **主责**：参数化查询、最小权限 | WAF |
| **越权** | ❌ 只能做 UI 控制 | ✅ **主责**：每个接口校验归属与角色 | — |
| **点击劫持** | 辅助：JS 检测 | — | ✅ **主责**：`frame-ancestors` / XFO |
| **HTTPS / HSTS** | ❌ | — | ✅ **主责** |
| **CORS 配置** | 配合调试 | ✅ 主责 | 网关配置 |
| **密钥泄露** | ✅ **主责**：不放前端、扫 bundle | 提供代理接口 | 密钥管理 |
| **sourcemap 泄露** | ✅ **主责** | — | 部署配置 |
| **依赖投毒** | ✅ **主责**：lockfile、`npm ci`、review | 辅助 | 私有源 |
| **第三方脚本** | ✅ **主责**：SRI、sandbox、延后加载 | — | CSP |
| **DDoS** | ❌ | 辅助 | ✅ **主责**：CDN/WAF |
| **业务逻辑漏洞** | ❌ | ✅ **主责** | 风控 |

**一句总结**：

> "前端在安全上的主责是三类：**不引入漏洞**（XSS、危险 API）、**不泄露信息**（密钥、sourcemap、日志）、**不给用户错误的安全感**（前端权限控制只是 UX）。至于 SQL 注入、越权、DDoS 这些，前端只能配合，真正的防线在后端和运维。"

---

## 7. 一个漏洞修复的讲述模板

> 面试时如果问"你遇到过什么安全问题"，用这个结构讲会很完整。

> **背景**：B 端系统，富文本商品描述用了 `v-html` 渲染（因为要支持加粗、图片、表格）。
>
> **发现**：安全扫描报了一个存储型 XSS——在商品描述里插入 `<img src=x onerror=...>`，前台详情页会执行。
>
> **定位**：
> 1. `grep -r "v-html" src/` 找到 6 处使用点
> 2. 确认后端只做了 `trim` 和长度校验，没有 HTML 过滤
> 3. 确认 CSP 当时只配了 `default-src 'self'`，但 `'self'` 挡不住内联事件（因为没配 `script-src` 的严格策略，`onerror` 属性属于内联脚本，实际上会被挡——但我们验证时发现 CSP 没生效在预览页上）
>
> **修复（三层）**：
> 1. **前端**：所有 `v-html` 前过 `DOMPurify.sanitize`，白名单只放开必要标签；加 ESLint `no-unsanitized` 防回退
> 2. **后端**：输出时用 OWASP Java HTML Sanitizer 再过滤一次（防止有人绕过前端直接调接口）
> 3. **CSP**：补齐 `script-src 'nonce-xxx' 'strict-dynamic'`、`object-src 'none'`、`base-uri 'none'`
>
> **验证**：用 XSS payload 列表（`<img onerror>`、`<svg onload>`、`<a href="javascript:">`、`<iframe srcdoc>`）逐个回归，全部被拦或消毒；CSP 报告里能看到拦截记录。
>
> **收尾**：把 `grep v-html` 和 `npm audit` 接进 CI，新增 `v-html` 必须 review 说明理由。

> **讲这个案例的价值**：它体现了"**发现 → 定位 → 三层修复 → 验证 → 防回退**"这个完整闭环，而不是"我加了个 DOMPurify"。

---

## 8. 常见坑

| # | 坑 | 纠正 |
|---|---|---|
| 1 | 认为前端校验能防 SQL 注入 | 攻击者直接发请求，绕过一切前端 |
| 2 | 用转义引号防 SQL 注入 | 数字型注入没有引号；不同数据库规则不同 → 必须参数化 |
| 3 | ORM 就绝对安全 | `raw()` / `query()` 手写 SQL 仍有注入 |
| 4 | 直接把 `req.body` 透传给 MongoDB | `{"$ne": null}` 直接绕过登录 |
| 5 | 数据库账号给 root | 一旦注入，全库沦陷；必须最小权限 |
| 6 | 把 SQL 错误返回给前端 | 泄露表结构/字段名，辅助攻击者 |
| 7 | 前端给后端传 SQL 片段 | 把后端的洞搬到前端，绝对禁止 |
| 8 | 不提交 lockfile | 每次安装版本可能不同，构建不可复现，也挡不住投毒 |
| 9 | CI 用 `npm install` | 会升级版本；用 `npm ci` |
| 10 | 不关 `postinstall` | 恶意包靠这个执行任意命令 |
| 11 | 随便 `npm i` 名字像的包 | typosquatting（`crossenv` vs `cross-env`） |
| 12 | 第三方脚本当"可信" | 它拥有和 XSS 一样的权限 |
| 13 | 只在开发环境检查安全 | 生产构建才是真实攻击面 |
| 14 | 安全检查做成一次性 | 必须进 CI，否则下个人一个 `npm i` 就回退 |
| 15 | 出事才想起审计依赖 | 定期跑 `npm audit` + 依赖清单审查 |

---

## 9. 答题模板

### 9.1 「SQL 注入」——30 秒

> "SQL 注入是用户输入被拼进 SQL 语句，被数据库当语法执行，比如 `admin' --` 就能绕过密码校验。它和 XSS 是同构的，本质都是数据被当成代码。**这是后端漏洞，前端防不了**——前端的输入校验只是提升体验，攻击者直接用 curl 绕过。真正的防御只有一条：**参数化查询/预编译**，让用户输入作为纯数据传入，不参与语法解析。辅助手段是最小权限数据库账号、ORM、错误信息不外露。"

### 9.2 「SQL 注入」——2 分钟

> "我分四层讲：原理、为什么前端防不了、正确防御、辅助措施。
>
> **原理**：用户输入被字符串拼接进 SQL，于是输入里的 `'` 和 `--` 变成了 SQL 语法。最经典的 payload 是 `admin' --`，把后面的密码校验注释掉了；还有 `' OR '1'='1` 永真、`UNION SELECT` 偷数据、`'; DROP TABLE` 破坏数据，以及通过响应时间逐字符猜的盲注。
>
> 它的本质是**数据被当成代码**，和 XSS 完全同构——XSS 是被 HTML 解析器误解析，SQL 注入是被 SQL 解析器误解析。
>
> **为什么前端防不了**：前端校验发生在浏览器里，而浏览器在攻击者手里。他可以直接用 curl 发请求，绕过所有前端代码。所以前端做输入校验的价值是'提升体验、减少误操作'，对攻击者零作用。**这一点要说清，否则会显得你没有边界意识。**
>
> **正确防御只有一个**：参数化查询，也就是预编译语句。原理是 SQL 模板先被数据库编译成执行计划，语法已经确定；用户输入作为纯数据绑定进去，**永远不参与语法解析**。所以哪怕输入里有引号、有 `--`，也只是数据的一部分。
>
> 这里有个常见误解：**用 `replace(/'/g, "''")` 转义引号不是正解**。一是数字型注入（`WHERE id = ${id}`）里根本没有引号可以转义；二是不同数据库转义规则不同；三是还有宽字节编码绕过。**只有参数化是根本解法。**
>
> **辅助措施**：ORM 默认参数化，但要小心 `raw()` 手写 SQL；数据库账号要最小权限，只能 `SELECT/INSERT/UPDATE`，不能 `DROP`、不能跨库；错误信息不能返回给前端，否则泄露表结构；再外面加 WAF 兜底。
>
> 最后补一个前端更该注意的变种：**NoSQL 注入**。因为前端发 JSON，如果后端把 `req.body` 整个透传给 MongoDB，攻击者发 `{"password": {"$ne": null}}` 就能绕过登录。防御是强制类型校验 `typeof === 'string'` 和剥离 `$` 开头的键。"

### 9.3 「常见攻击方式及防御」——2 分钟

> （用 00 册 0.4 的矩阵 + 每条挂一句"前端能做什么"，最后补"前端主责是三类：不引入漏洞、不泄露信息、不给用户错误的安全感"。）

---

## 10. 追问表

| # | 追问 | 要点 |
|---|---|---|
| 1 | SQL 注入和 XSS 关系？ | 同构：都是数据被当成代码 |
| 2 | 为什么前端防不了 SQL 注入？ | 浏览器在攻击者手里，直接发请求绕过 |
| 3 | 参数化查询为什么有效？ | 数据不参与语法解析（不是"转义了"） |
| 4 | 转义引号行不行？ | 不行：数字型注入无引号、编码绕过、规则不一致 |
| 5 | ORM 就安全吗？ | 默认安全，但 `raw()`/`query()` 手写 SQL 仍有风险 |
| 6 | 最小权限账号怎么做？ | 只给需要的表和操作，禁 `DROP`/`GRANT`/跨库 |
| 7 | 为什么不能返回 SQL 错误？ | 泄露表结构、字段名，辅助构造 payload |
| 8 | 什么是盲注？ | 通过页面差异或响应时间逐字符猜数据 |
| 9 | 什么是 NoSQL 注入？ | 传对象操作符（`$ne`/`$gt`/`$where`）绕过查询 |
| 10 | NoSQL 注入怎么防？ | 强制 `typeof === 'string'` + 剥离 `$` 键 + Schema 校验 |
| 11 | 什么是供应链攻击？ | 依赖被投毒，你的项目跟着中招 |
| 12 | 举一个真实案例？ | `event-stream` 转让维护权后被植入窃取代码 |
| 13 | `postinstall` 有什么风险？ | 安装时执行任意命令，可偷环境变量/SSH 密钥 |
| 14 | 怎么关 `postinstall`？ | `npm ci --ignore-scripts`，需要时用 `trustedDependencies` 白名单 |
| 15 | 为什么要提交 lockfile？ | 构建可复现 + 防版本漂移 + 防投毒 |
| 16 | `npm ci` 和 `npm install` 区别？ | `ci` 严格按 lockfile，不升级 |
| 17 | 第三方脚本有什么风险？ | 拥有和 XSS 相同的权限，能读全站数据 |
| 18 | 怎么降低第三方脚本风险？ | SRI、sandbox iframe、CSP、延后加载、能自建就自建 |
| 19 | 安全检查怎么防回退？ | 进 CI（grep + lint + audit + bundle 扫描） |
| 20 | 前端安全的主责是哪几类？ | 不引入漏洞、不泄露信息、不给错误安全感 |

---

## 11. 速记卡

```
【SQL 注入】
本质 = 数据被当成代码（和 XSS 同构）
payload：admin' -- ｜ ' OR '1'='1 ｜ UNION SELECT ｜ '; DROP TABLE ｜ 盲注
前端防不了（攻击者 curl 直接绕过，前端校验只是 UX）

唯一正解：参数化查询 / 预编译
  原理：SQL 模板先编译成执行计划，用户输入作为纯数据绑定，不参与语法
  ⚠️ 转义引号不是正解：数字型注入无引号 + 编码绕过 + 数据库规则不同

辅助：ORM（小心 raw）、最小权限账号、错误不外露、WAF

【NoSQL 注入（前端更该知道）】
{"password": {"$ne": null}} → 绕过登录
{"$where": "..."} → 直接执行 JS（最危险）
防御：typeof === 'string' + 剥离 $ 键 + Schema 校验（Zod/Joi）

【供应链】
残酷事实：你的项目 5000 行，node_modules 50 万行
四种形式：typosquatting / 维护者账号被盗 / 作者自毁 / postinstall 脚本
三条底线：
  ① lockfile 必须提交
  ② CI 用 npm ci --ignore-scripts
  ③ 新依赖必须 review（看下载量、活跃度、有没有 postinstall）

【第三方脚本】
引入 = 交出页面完全控制权（权限等同 XSS）
治理：能自建就自建 / SRI / sandbox iframe / CSP / 延后加载

【前端主责三类】
① 不引入漏洞：XSS 输出编码、禁用危险 API
② 不泄露信息：密钥不进 bundle、sourcemap、日志脱敏
③ 不给错误的安全感：前端权限只是 UX

【上线六查】
代码（innerHTML/href/postMessage）→ 产物（grep 密钥/sourcemap）
→ 响应头（CSP/HSTS/nosniff）→ Cookie（三件套）
→ 接口（CORS 白名单/越权/错误信息）→ 工程（lockfile/audit/CI）
```
