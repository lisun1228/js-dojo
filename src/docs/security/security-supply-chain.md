# 安全 · 08 工程化落地：SQL 注入、供应链与检查清单

> 覆盖题号：**17、2**（落地部分）｜对应原题：《SQL 注入》《web 常见的攻击方式及防御》
> 前七册讲单点攻击怎么防，这一册讲防御怎么在项目里持续生效：前端防不了的部分怎么协作、供应链怎么管、上线前怎么卡。

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

### 1.1 先给结论

> **SQL 注入是后端漏洞，前端防不了。** 前端输入校验只提升体验、减少误操作；攻击者用 curl 直接发请求就能绕过。**唯一根治手段是参数化查询（预编译语句）。**

### 1.2 原理

```js
// ❌ 字符串拼接：输入参与语法解析
const sql = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`
db.query(sql)
```

| 目的 | username 输入 | 拼进 SQL 后 |
|---|---|---|
| 绕过登录 | `admin' -- `（`--` 后需空白） | `username = 'admin' -- ' AND password = '...'`，密码条件被注释 |
| 永真 | `' OR '1'='1` | `username = '' OR '1'='1' AND password = '' OR '1'='1'`，返回全表 |
| 联合查询 | `' UNION SELECT ... -- ` | 列数与原查询一致时，把其他表的数据拼进结果 |
| 破坏数据 | `'; DROP TABLE users; -- ` | 驱动允许一次执行多条语句时删表 |
| 盲注 | `' AND (SELECT SUBSTRING(password,1,1) ...)='a' -- ` | 按页面差异或响应时间逐字符猜 |

### 1.3 根本原因

**数据被当成了代码。** XSS 是 HTML 解析器把输入当标签，SQL 注入是 SQL 解析器把输入当语法；修复方向也一致——让数据留在数据层，不进入解析层（输出编码 / 参数绑定）。

### 1.4 防御：只有一个正确答案

```js
// ✅ Node + mysql2：execute 走服务端预编译，query 只是客户端拼接
const [rows] = await pool.execute(
  'SELECT * FROM users WHERE username = ? AND password_hash = ?',
  [username, passwordHash],
)
```

JDBC 用 `PreparedStatement` + `setString`，Python 用 `cursor.execute(sql, params)`；共同点是 **SQL 文本与参数分开传输**。

```
拼接：SQL 文本 = 模板 + 输入，输入参与语法解析
参数化：SQL 文本与参数分开传递，参数只作为值绑定
→ 输入里的 ' 或 -- 只是数据，不会变成语法
```

| 同一输入 `admin' -- ` | 结果（Node `node:sqlite` 实测） |
|---|---|
| 字符串拼接 | 返回 admin，密码条件被注释 |
| 参数绑定 | 0 行，输入只作为字符串值 |

**不是"转义了引号"，而是"数据根本不进入语法层"。**

**其他防御（辅助，不能替代）**：

| 手段 | 说明 |
|---|---|
| ORM / Query Builder | 默认参数化；`raw()` / `query()` 手写 SQL 仍有风险 |
| 最小权限数据库账号 | 只给需要的表与操作，禁 `DROP` / `GRANT` |
| 输入类型校验 | 纵深防御，不是主防御 |
| 错误信息不外露 | 不把 SQL 报错返回前端（泄露表结构） |
| WAF | 拦常见 payload，可被绕过 |
| 存储过程 | 参数化的一种，维护成本高 |

**转义为什么是下策**：

| 问题 | 说明 |
|---|---|
| 规则不一致 | MySQL 默认支持 `\`，标准 SQL 用 `''` |
| 编码绕过 | 宽字节注入（GBK 下 `%bf%27`） |
| 数字型注入 | `WHERE id = ${id}` 没有引号可转义 |

### 1.5 前端在这件事上的真实位置

| 前端能做 | 前端做不到 |
|---|---|
| 输入格式校验（手机号、邮箱、长度） | 阻止攻击者直接发请求 |
| 提交前做类型转换（把 `id` 转成 `Number`） | 阻止 SQL 拼接 |
| 错误提示友好化（不暴露后端错误细节） | 任何真正的防护 |
| 不拼接 SQL 字符串传给"通用查询接口" | — |

后端提供 `POST /api/query` 让前端传 SQL 片段，等于把注入面直接开放给客户端，应直接拒绝。

---

## 2. NoSQL 注入（前端更该知道的一种）

载荷是 **JSON 对象**，而前端正是发 JSON 的一方；Node + MongoDB 项目里常见。

### 2.1 注入原理

```js
// ❌ 直接把 req.body 里的对象透传给查询
app.post('/login', async (req, res) => {
  const { username, password } = req.body
  const user = await db.collection('users').findOne({ username, password })
  // ...
})
```

```json
{
  "username": "admin",
  "password": { "$ne": null }
}
```

`{ password: { $ne: null } }` 表示"密码字段存在且不为 null"，`findOne` 直接命中 admin，不需要知道密码。

| 操作符 | 效果 |
|---|---|
| `{"$gt": ""}` | 大于空字符串，几乎匹配任何非空值 |
| `{"$ne": null}` | 字段存在且不为 null，匹配任何非空密码 |
| `{"$regex": "^a"}` | 正则匹配，可做盲注逐字符猜 |
| `{"$where": "..."}` | 直接执行 JS（最危险） |

### 2.2 防御

```js
// ✅ 强制类型校验（最有效）
app.post('/login', async (req, res) => {
  const { username, password } = req.body
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'invalid input' })
  }
  const user = await db.collection('users').findOne({ username })
  const ok = user && (await bcrypt.compare(password, user.passwordHash))
  if (!ok) return res.status(401).json({ error: 'invalid credentials' })
})
```

| 防御 | 说明 |
|---|---|
| 类型校验（`typeof === 'string'`） | 最有效，直接断掉对象注入 |
| 禁止 `$` 开头的键 | 递归清理入参 |
| 禁用 `$where` | MongoDB 可配置禁用 JS 执行 |
| Schema 校验 | Zod / Joi / class-validator 收口所有入参 |
| 最小权限数据库账号 | 只给需要的集合权限 |

前端配合：不把整个表单对象直接 `JSON.stringify` 发出去，明确构造 `{ username: String(x), password: String(y) }`。

---

## 3. 供应链安全（最容易被忽略的一类）

依赖以你的权限运行：构建时在 Node 进程里，运行时在用户浏览器里。投毒者不必攻击你的代码，只要成为依赖链的一环。

### 3.1 为什么依赖是攻击面

```
你的代码只占最终运行代码的极小一部分
任何一层依赖被投毒，都能读环境变量、改构建产物、在页面里执行任意脚本
→ 依赖数量本身就是攻击面
```

### 3.2 五种攻击形式

| 形式 | 说明 | 案例 |
|---|---|---|
| 恶意包（typosquatting） | 起一个和热门包很像的名字 | `crossenv` 模仿 `cross-env` |
| 维护者账号被盗 | 攻击者发布恶意版本 | `event-stream@3.3.6` 引入 `flatmap-stream` 窃取钱包数据 |
| 维护者主动投毒 | 作者自己搞事 | `colors` / `faker` 作者自毁；`node-ipc` 抗议性删文件 |
| `postinstall` 脚本 | 安装时执行任意命令 | 恶意包靠它偷环境变量、SSH 密钥 |
| CDN 篡改 | 公共 CDN 上的文件被改 | SRI 校验（见 05 册） |

### 3.3 防御清单

| # | 措施 | 说明 |
|---|---|---|
| 1 | 提交 lockfile | `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock`，锁定精确版本 |
| 2 | CI 用 `npm ci` | 严格按 lockfile 安装，不会偷偷升级 |
| 3 | `npm ci --ignore-scripts` | 禁用 `postinstall` 等生命周期脚本，性价比最高 |
| 4 | `npm audit` 进 CI | 加 `--audit-level=high`；只有 high/critical 会非零退出，moderate 仍会放过 |
| 5 | 依赖数量审计 | 定期看 `npm ls --depth=0`，删掉不用的 |
| 6 | 新依赖 review | 看下载量、维护活跃度、lockfile 里有没有 `hasInstallScript`、代码量 |
| 7 | 私有 registry / 镜像 | 内部包不公开，外部包走可信镜像 |
| 8 | 构建环境隔离 | CI 不挂生产密钥，token 最小权限 |
| 9 | npm provenance | 验证包确实来自对应仓库的 CI |
| 10 | SBOM | 依赖清单，出事时快速定位影响范围 |
| 11 | Socket.dev / Snyk | 结合行为检测与漏洞库，不只看 CVE |

```bash
npm ci --ignore-scripts
npm audit --audit-level=high
npx depcheck                      # 找出没用到的依赖
node -e "const p=require('./package-lock.json').packages;console.log(Object.keys(p).filter(k=>p[k].hasInstallScript))"
```

> **`--ignore-scripts` 的代价**：生命周期脚本全部跳过，包括需要下载二进制的包（`esbuild` / `sharp` / `puppeteer`）和本仓库的 `prepare: husky`；npm 10 只有全局开关，按包放行要用包管理器自己的机制（npm 11 的 `allowScripts`、pnpm 的 `onlyBuiltDependencies`、Bun 的 `trustedDependencies`），或用 `npm rebuild <pkg>` 单独重建。

---

## 4. 第三方脚本治理

### 4.1 核心认知

引入第三方脚本 = 把页面的完全控制权交给对方：它在页面源下执行，能读 Cookie / DOM、改页面、发请求，权限与 XSS 相同，区别只是你主动引入。

### 4.2 常见第三方脚本及其风险

| 类型 | 例子 | 风险 |
|---|---|---|
| 统计 / 埋点 | Google Analytics、百度统计 | 能读全站数据 |
| 客服 | 在线客服 SDK | 能读页面、改 DOM（部分会注入广告） |
| 广告 | 广告联盟 | 可注入任意内容，历史上多次恶意投放 |
| A/B 测试 | Optimizely 等 | 能改页面任意内容 |
| 地图 | 高德 / 百度 / Google Maps | 体积大，权限多 |
| 支付 | 支付 SDK | 涉及资金，必须严格 |
| 社交 | 分享按钮、评论 | 常带追踪 |

### 4.3 治理手段

| 手段 | 说明 |
|---|---|
| 能自建就自建 | 统计可用自研埋点，风险可控 |
| SRI 校验 | 静态资源加 `integrity`（见 05 册） |
| `sandbox` iframe 隔离 | 重脚本放 iframe，不给 `allow-same-origin`（见 04 册） |
| CSP 限制 | `script-src` 只允许必要域名（见 03 册） |
| 延后加载 | 非关键脚本在交互后加载，同时提升性能 |
| 定期审计 | 看对方最近版本变化、有没有被收购 / 易主 |
| 降级方案 | 第三方挂了页面不能崩（`onerror` 兜底） |

```html
<!-- 延后加载 + onerror 兜底 -->
<script>
  const load = () => {
    const s = document.createElement('script')
    s.src = 'https://third-party.example.com/sdk.js'
    s.async = true
    s.onerror = () => console.warn('第三方脚本加载失败')
    document.head.appendChild(s)
  }
  ;['scroll', 'click', 'keydown'].forEach((e) =>
    window.addEventListener(e, load, { once: true, passive: true }),
  )
</script>
```

---

## 5. 上线前安全检查清单

可直接贴进 PR 模板或发布流程。

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
```

### 5.3 响应头层

```
□ Content-Security-Policy 已配（至少 default-src 'self' + object-src 'none' + base-uri 'none' + frame-ancestors 'none'）
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
□ 上传文件走独立域 + Content-Disposition: attachment
□ 错误上报做了脱敏
□ 有 CSP report-to 或安全事件监控
□ 供应链按 3.3 逐项过（lockfile / npm ci --ignore-scripts / audit / 依赖 review）
```

### 5.7 一条命令快速自查

```bash
# 打包产物敏感信息扫描
grep -rInE "(sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{36}|-----BEGIN [A-Z ]*PRIVATE KEY-----|password\s*[:=]\s*['\"][^'\"]+)" dist/ || echo "✅ 未发现明显密钥"

# 危险 API 扫描：只看代码文件
grep -rInE "(innerHTML|outerHTML|insertAdjacentHTML|dangerouslySetInnerHTML|v-html|document\.write|eval\(|new Function\()" src/ --include='*.vue' --include='*.ts' --include='*.js' || echo "✅ 未发现危险 API"
```

命中不等于漏洞：注释、仓库内置 Markdown 的 `v-html` 渲染需要人工豁免。

---

## 6. 安全责任分工表

按"漏洞的信任边界在哪"划分主责，避免把后端漏洞算到前端头上。

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

主责看边界：前端只对浏览器内和构建产物里能控制的部分负责；SQL 注入、越权、DDoS 的防线在后端与运维。

---

## 7. 一个漏洞修复的讲述模板

> 以存储型 XSS（`v-html` 渲染富文本）为例，按"发现 → 定位 → 三层修复 → 验证 → 防回退"组织：

| 步骤 | 内容 |
|---|---|
| 发现 | 安全扫描报存储型 XSS：商品描述插入 `<img src=x onerror=...>`，详情页执行 |
| 定位 | `grep -rn "v-html" src/ --include='*.vue'` 列出所有 sink；确认后端只做 `trim` 和长度校验；确认 CSP 在预览页也生效 |
| 修复 | 前端 `DOMPurify.sanitize` + 标签白名单 + ESLint `vue/no-v-html`；后端对同一字段再过滤一次；CSP 补 `script-src 'nonce-...' 'strict-dynamic'`、`object-src 'none'`、`base-uri 'none'` |
| 验证 | 用 `<img onerror>`、`<svg onload>`、`<a href="javascript:">`、`<iframe srcdoc>` 回归；查看 CSP report |
| 防回退 | `grep v-html` 与 `npm audit` 进 CI；新增 `v-html` 必须 review 说明理由 |

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
| 7 | 只在开发环境检查安全 | 生产构建才是真实攻击面 |
| 8 | 安全检查做成一次性 | 必须进 CI；lockfile、安装脚本、audit 见 3.3 |

---

## 9. 答题模板

### 9.1 「SQL 注入」——30 秒

> SQL 注入是输入被拼进 SQL、被数据库当语法执行，比如 `admin' -- ` 绕过密码校验。它和 XSS 同构：数据被当成代码。**这是后端漏洞，前端防不了**——前端校验只提升体验，攻击者用 curl 绕过。正解只有参数化查询：SQL 文本与参数分开，输入永远作为值绑定。辅助手段是最小权限、ORM、错误信息不外露、WAF。

### 9.2 「SQL 注入」——2 分钟

- **原理**：输入参与 SQL 语法；`'` 闭合字符串、`--` 注释、`UNION` 拼结果、`;` 多语句、盲注靠差异逐字符猜。
- **边界**：前端校验在攻击者浏览器里，直接发请求即可绕过；前端只做格式校验和类型转换。
- **正解**：参数化 / 预编译，SQL 文本与参数分开传输；转义引号不是正解。
- **辅助**：最小权限账号、ORM（小心 `raw()`）、错误不外露、WAF；NoSQL 变种见第 2 节。

### 9.3 「常见攻击方式及防御」——2 分钟

按 00 册 0.4 的矩阵逐条说，每条补一句"前端能做什么"；收尾用第 6 节的主责边界。

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
| 14 | 怎么关 `postinstall`？ | `npm ci --ignore-scripts`；需要脚本的包单独 `npm rebuild` |
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
本质 = 数据被当成代码（与 XSS 同构）
payload：admin' -- ｜ ' OR '1'='1 ｜ UNION SELECT ｜ '; DROP TABLE ｜ 盲注
前端防不了：攻击者 curl 直接绕过，前端校验只是 UX

唯一正解：参数化查询 / 预编译
  SQL 文本与参数分开传输，输入只作为值绑定，不参与语法
  ⚠️ 转义引号不是正解：数字型注入无引号 + 编码绕过 + 数据库规则不同

辅助：ORM（小心 raw）、最小权限账号、错误不外露、WAF

【NoSQL 注入】
{"password": {"$ne": null}} → 字段存在且非 null，绕过登录
{"$where": "..."} → 直接执行 JS（最危险）
防御：typeof === 'string' + 剥离 $ 键 + Schema 校验

【供应链】
风险：依赖以你的权限运行，任何一层被投毒都能读密钥 / 改产物 / 执行脚本
形式：typosquatting / 维护者账号被盗 / 作者自毁 / postinstall / CDN 篡改
底线：① lockfile 必须提交 ② CI 用 npm ci --ignore-scripts ③ 新依赖必须 review
    --ignore-scripts 会跳过所有生命周期脚本，需按包重建

【第三方脚本】
引入 = 交出页面控制权（权限等同 XSS）
治理：能自建就自建 / SRI / sandbox iframe / CSP / 延后加载

【前端主责三类】
① 不引入漏洞：输出编码、禁用危险 API
② 不泄露信息：密钥不进 bundle、sourcemap、日志脱敏
③ 不给错误的安全感：前端权限只是 UX

【上线六查】
代码（innerHTML/href/postMessage）→ 产物（grep 密钥/sourcemap）
→ 响应头（CSP/HSTS/nosniff）→ Cookie（三件套）
→ 接口（CORS 白名单/越权/错误信息）→ 工程（lockfile/audit/CI）
```
