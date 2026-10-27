# HTML · 06 存储、缓存与离线

> 覆盖：Cookie / localStorage / sessionStorage / IndexedDB、AppCache 与 Service Worker、HTTP 缓存。
> 分三层：① 应用数据（Cookie / Storage / IndexedDB）→ ② 代码与资源（Service Worker / HTTP 缓存）→ ③ 已移除方案（AppCache）。

---

## 目录

- [6.1 一句话结论](#61-一句话结论)
- [6.2 Cookie / localStorage / sessionStorage](#62-cookie--localstorage--sessionstorage)
- [6.3 HTML5 离线缓存：AppCache 与 Service Worker](#63-html5-离线缓存appcache-与-service-worker)
- [6.4 HTTP 缓存](#64-http-缓存)
- [6.5 速记卡](#65-速记卡)

---

## 6.1 一句话结论

**应用数据看四个维度：谁能读到、容量多大、同步还是异步、是否随请求发送；资源缓存看两层：谁控制、能否离线。**

```
Cookie         4KB 级  每次同源请求自动携带   同步（浏览器处理）
localStorage   约 5MB  同源、永久、同步
sessionStorage 约 5MB  同源、单标签页、同步
IndexedDB      配额级   异步、事务、结构化克隆
```

**资源缓存是另一套机制**：HTTP 缓存由服务端响应头声明、浏览器被动命中；Service Worker 由开发者代码主动拦截。

---

## 6.2 Cookie / localStorage / sessionStorage

### 6.2.1 一句话回答

**Cookie 是 HTTP 状态管理机制，不是通用存储**：4KB 级、每次同源请求自动携带、可设 `HttpOnly` 阻止 JS 读取。**localStorage** 是同源共享的永久键值存储，同步 API；**sessionStorage** 是标签页级会话存储，关闭标签页即失效，同源不同标签页不共享。

### 6.2.2 完整对比表（10 个维度）

| 维度 | Cookie | localStorage | sessionStorage |
|---|---|---|---|
| **生命周期** | 可设 `Expires`/`Max-Age`；不设则**会话结束消失** | **永久**（除非用户清除或代码删除） | **标签页关闭即消失**（刷新保留） |
| **容量** | **4KB 级**（单条约 4096 字节） | **约 5MB**（浏览器实现有差异；Chrome 实测 4×1MiB 后超限） | 同 localStorage |
| **是否随请求发送** | ✅ **每次同源请求自动带在请求头** | ❌ | ❌ |
| **作用域** | 同源 + `Domain` + `Path` 匹配 | **同源**（scheme + host + port），**不跨子域** | 同源 + **同一个标签页** |
| **API** | `document.cookie`（字符串拼接） | `getItem/setItem/removeItem/clear` | 同 localStorage |
| **同步/异步** | 同步（由浏览器在请求时处理） | **同步**（阻塞主线程） | **同步** |
| **能否被 JS 读** | 设了 `HttpOnly` 就**不能** | 能 | 能 |
| **跨标签页共享** | ✅ 共享 | ✅ 共享（`storage` 事件可监听变化） | ❌ **不共享**（每个标签页独立） |
| **服务端能读吗** | ✅ 能（在请求头里） | ❌ 不能 | ❌ 不能 |
| **典型用途** | 会话 ID、Token（不推荐）、用户偏好、埋点 | 用户设置、草稿、缓存列表数据、主题 | 表单草稿、单次流程状态（如多步注册） |

### 6.2.3 Cookie 的七个属性

```http
Set-Cookie: sid=abc123; Max-Age=3600; Path=/; Domain=.example.com;
            Secure; HttpOnly; SameSite=Lax
```

| 属性 | 作用 | 关键细节 |
|---|---|---|
| **`Expires`** | 绝对过期时间（HTTP-date） | `Expires=Wed, 21 Oct 2026 07:28:00 GMT` |
| **`Max-Age`** | 相对过期时间（秒） | **优先级高于 `Expires`**；`0` 或负数 = 立即删除 |
| **`Domain`** | 允许哪些域携带 | `.example.com` 才含所有子域；不写则只限当前域 |
| **`Path`** | 允许哪些路径携带 | `Path=/admin` 则只有 `/admin/*` 的请求会带 |
| **`Secure`** | 只在 HTTPS 下发送 | 防中间人窃取 |
| **`HttpOnly`** | **JS 读不到**（`document.cookie` 里看不到） | **防 XSS 窃取 Cookie 的核心手段** |
| **`SameSite`** | 跨站请求是否带 Cookie | `Strict` / `Lax`（现代浏览器默认）/ `None`（必须配 `Secure`） |

`SameSite` 三个值的行为：

| 值 | 同站请求 | 跨站 GET（点链接） | 跨站 POST（表单/fetch） | iframe 内 |
|---|---|---|---|---|
| `Strict` | ✅ 带 | ❌ **不带** | ❌ 不带 | ❌ 不带 |
| `Lax`（默认） | ✅ 带 | ✅ **带** | ❌ 不带 | ❌ 不带 |
| `None` | ✅ 带 | ✅ 带 | ✅ 带 | ✅ 带（必须 `Secure`） |

`Lax` 下跨站点链接会带 Cookie、跨站 POST 不带；第三方支付回跳等跨站 POST 场景需要显式 `SameSite=None; Secure`。

### 6.2.4 Cookie 的三个实战坑

| 坑 | 现象 | 原因 |
|---|---|---|
| **请求头越来越大** | 首屏请求 `Cookie` 头几百字节甚至几 KB | Cookie 会跟着**每一个**同源请求（图片、CSS、JS 全带）。静态资源应放独立域（CDN 域不设 Cookie） |
| **跨域请求 Cookie 不带** | 前端 `fetch` 带了 `credentials: 'include'` 还是没登录态 | 服务端必须同时返回 `Access-Control-Allow-Credentials: true` **且** `Access-Control-Allow-Origin` **不能是 `*`** |
| **HTTPS 站点 Cookie 失效** | 上线 https 后登录态丢了 | 在 http 下设置/测试 `Secure` Cookie 会被忽略；`SameSite=None` 没配 `Secure` 也会被拒绝 |

```js
document.cookie = 'theme=dark; Max-Age=31536000; Path=/; SameSite=Lax';

const getCookie = (name) =>
  document.cookie.split('; ').find((c) => c.startsWith(name + '='))?.split('=')[1];
```

### 6.2.5 localStorage 的四个坑

| 坑 | 说明 | 解法 |
|---|---|---|
| **同步阻塞主线程** | 同步 API，读写几 MB 的 JSON 会卡住渲染 | 大数据用 IndexedDB；写入放到 `requestIdleCallback` |
| **只能存字符串** | 存对象要 `JSON.stringify` | 封装 `getJSON/setJSON`；注意 `Date`/`Map`/`undefined` 会丢 |
| **隐私模式限制写入** | 部分浏览器隐私模式 `setItem` 抛 `QuotaExceededError` | `try/catch` 包裹，降级到内存 |
| **不跨子域** | `a.example.com` 和 `b.example.com` 完全独立 | 用 Cookie（设 `Domain`）或 postMessage 同步 |

Chrome 实测：连续写入 4 个 1MiB 值成功，第 5 个抛 `QuotaExceededError`（code 22）。

```js
const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
};
```

### 6.2.6 sessionStorage 的「标签页」边界

| 操作 | sessionStorage 行为 |
|---|---|
| 刷新页面 | ✅ **保留** |
| 同一标签页里跳转（`location.href`） | ✅ 保留（同源） |
| 关闭标签页再开 | ❌ **丢失** |
| **在新标签页打开同一 URL** | ❌ **新的、空的**（不共享） |
| **复制标签页**（Ctrl+点击 / 右键复制） | ⚠️ **会复制一份**，之后各自独立 |
| 同源 iframe | ✅ **共享父页面的 sessionStorage** |
| 浏览器恢复上次会话 | ⚠️ 由浏览器实现决定，不保证保留 |

**典型用途**：多步表单（步骤 1 填完存起来，步骤 2 刷新不丢）、单次活动的状态、防止重复提交的标记。

### 6.2.7 `storage` 事件：跨标签页通信

```js
// 标签页 A 修改 localStorage
localStorage.setItem('theme', 'dark');

// 标签页 B 监听
window.addEventListener('storage', (e) => {
  console.log(e.key, e.oldValue, e.newValue, e.url);
  // A 自己不会收到事件，只有其它标签页收到
});
```

| 特性 | 说明 |
|---|---|
| 触发条件 | **其它**同源标签页/窗口修改了 localStorage 或 sessionStorage |
| 不触发的情况 | 修改发生在**当前**页面；`clear()` 时 `key` 为 `null` |
| 用途 | 多标签页同步登录态、主题、登出广播 |
| 局限 | **不能传复杂结构**（只有 key/value 字符串）；不能跨域 |

### 6.2.8 IndexedDB

| 维度 | IndexedDB | localStorage |
|---|---|---|
| 容量 | 按存储配额（Chrome 实测 `navigator.storage.estimate().quota` 默认 10GiB） | 约 5MB |
| API | **异步**（事件/Promise 封装） | **同步** |
| 数据类型 | **结构化克隆**（对象、数组、Blob、File、Date、Map/Set） | 只有字符串 |
| 查询 | 索引、游标、范围查询、事务 | 只能按 key 取 |
| 事务 | ✅ ACID | ❌ |
| 复杂度 | 高（常用 Dexie / idb 封装） | 极低 |
| 适用 | 离线应用、大文件缓存、本地数据库 | 少量配置、草稿 |

**选型**：数据量大或需要索引查询时用 IndexedDB；小配置用 localStorage。

> **Service Worker 里不能用 localStorage**（没有窗口环境），只能用 IndexedDB + Cache API。

### 6.2.9 面试怎么答

- Cookie 用于会话管理：`HttpOnly` 防 XSS 读取，`Secure` 限 HTTPS，`SameSite` 防 CSRF。
- localStorage 存用户偏好、主题、草稿；同源 JS 可读，Token 放这里有 XSS 读取风险，更稳的是 `HttpOnly` Cookie。
- sessionStorage 存单次流程状态，关闭标签页自动清理。
- 数据量大或需要查询用 IndexedDB；写入失败（`QuotaExceededError`）要 `try/catch` 降级。
- 跨标签页同步用 `storage` 事件（仅其它标签页触发）、`BroadcastChannel` 或 `SharedWorker`。

---

## 6.3 HTML5 离线缓存：AppCache 与 Service Worker

### 6.3.1 一句话回答

**AppCache 是应用级离线缓存，替代者是 Service Worker**；两者都由开发者主动控制缓存。**HTTP 缓存由服务端响应头声明策略、浏览器被动命中**，与二者不在同一层。

### 6.3.2 AppCache 的 manifest 结构（已移除）

```html
<html manifest="/cache.appcache">
```

```
CACHE MANIFEST
# version 1.0        ← 改这一行才会触发更新

CACHE:
/styles/app.css
/scripts/app.js
/images/logo.png

NETWORK:
/api/*
/login

FALLBACK:
/  /offline.html
```

| 段落 | 含义 |
|---|---|
| `CACHE` | 列出的资源**永久从缓存读**（即使在线也不发请求） |
| `NETWORK` | 列出的资源**必须联网**，不走缓存 |
| `FALLBACK` | 请求失败时的替补页面 |
| `SETTINGS` | `prefer-online` / `fast`（缓存策略） |

### 6.3.3 AppCache 被废弃的 6 个原因

| # | 原因 | 具体表现 |
|---|---|---|
| **1** | **更新机制极端粗暴** | 只有 **manifest 文件本身字节变化**才触发更新；更新是**全量原子替换**，没有增量 |
| **2** | **缓存优先级高于 HTTP 缓存，且不可控** | 资源进了 AppCache 后，即使服务器文件已改、HTTP 缓存已清，用户仍看到旧版本 |
| **3** | **配置错误会导致永久白屏，且无法远程修复** | manifest 漏文件或首次加载有资源 404，整个缓存失效，用户只能手动清浏览器数据 |
| **4** | **无法按 URL 精细控制** | 要么全进缓存，要么全走网络，没有「这个接口缓存 5 分钟」的粒度 |
| **5** | **不支持动态内容 / 不支持 POST** | 只缓存 GET 资源；API 响应基本无法处理 |
| **6** | **多标签页/多窗口行为混乱** | 更新时机不确定，`swapCache()` 语义混乱 |

现状：2015 年从 HTML 规范草案移除；Chrome 95、Firefox 84 移除支持，`manifest` 属性被浏览器忽略。

### 6.3.4 Service Worker 是什么

Service Worker 是**运行在浏览器后台的独立线程**，可以**拦截页面发出的网络请求**，决定用缓存还是走网络。

```
页面 fetch('/api/user')
    ↓
Service Worker 的 fetch 事件（可以在这里拦截）
    ↓
自己决定：读 Cache API？走网络？两者结合？
```

| 特性 | 说明 |
|---|---|
| **独立线程** | 不占用主线程，不影响页面性能 |
| **不能访问 DOM** | 没有 `window`、`document`；有 `self`、`caches`、`fetch`、`IndexedDB` |
| **事件驱动** | 空闲会被**终止**，需要时再唤醒（不能存全局状态，要用 IndexedDB） |
| **必须 HTTPS** | `localhost` 例外（能拦截请求的脚本必须可信） |
| **作用域（scope）** | 默认是 sw.js 所在目录，只能拦截**该目录下**的请求 |
| **生命周期由浏览器管** | 页面关闭后依然存活（用于推送、后台同步） |

### 6.3.5 生命周期

```
① register（页面注册）
     navigator.serviceWorker.register('/sw.js')
        ↓
② install（安装）
     event.waitUntil() 里预缓存关键资源
     失败 → 整个 SW 作废
        ↓
③ installed / waiting（等待）
     如果已有旧版本在控制页面，新版本进入 waiting
     （不会立刻接管，避免新旧版本混用）
        ↓
④ activate（激活）
     清理旧版本缓存
     clients.claim() 可以立刻接管所有页面
        ↓
⑤ fetch / message / push / sync（工作）
        ↓
⑥ idle → terminated（空闲被终止，随时可被唤醒）
```

```js
const CACHE = 'app-v1';

// 让 waiting 的新版本立刻接管（配合页面 reload）
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
```

| 问题 | 答案 |
|---|---|
| 浏览器什么时候检查更新 | 每次**导航**到 scope 内的页面时检查 `sw.js` |
| 怎么判断「有更新」 | **字节级比较**（内容有一个字符不同就算更新） |
| 强制检查间隔 | 浏览器至少每 **24 小时**强制检查一次 |
| `importScripts` 引入的脚本会检查吗 | **不会**（要手动改主文件或加版本号） |
| 新版本什么时候生效 | 进入 waiting，**等所有旧页面关闭**才 activate；或调用 `skipWaiting` |
| 为什么不能立刻生效 | 避免新旧版本同时控制不同页面，缓存策略冲突 |

### 6.3.6 四种缓存策略

| 策略 | 逻辑 | 适用 |
|---|---|---|
| **Cache First** | 有缓存就用，没有才走网络 | 静态资源（带 hash 的 JS/CSS/图片） |
| **Network First** | 先走网络，失败才用缓存 | API 数据、HTML（要保证新鲜） |
| **Stale While Revalidate** | **立刻返回缓存**，同时后台请求更新 | 头像、列表、允许短暂过期的数据 |
| **Cache Only / Network Only** | 只用缓存 / 只用网络 | 特殊场景 |

```js
// Stale While Revalidate
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request);
      const network = fetch(e.request)
        .then((res) => {
          cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
```

实际项目通常不手写，用 **Workbox**：`registerRoute` + `CacheFirst` / `NetworkFirst` / `StaleWhileRevalidate`。

### 6.3.7 AppCache vs Service Worker vs HTTP 缓存

| 维度 | HTTP 缓存 | AppCache | Service Worker |
|---|---|---|---|
| **谁决定** | **服务端**（响应头） | 开发者（manifest 文件） | 开发者（JS 代码） |
| **控制粒度** | 单个资源 | 整体（全有或全无） | **任意精细**（按 URL、方法、请求头） |
| **能否编程** | ❌ | ❌ | ✅ **完全可编程** |
| **离线能力** | 只能命中已缓存的资源 | ✅ 完整离线 | ✅ 完整离线 + 后台同步 + 推送 |
| **更新控制** | HTTP 语义 | ❌ 只认 manifest 字节变化 | ✅ 代码里自己写 |
| **失败恢复** | 正常回源 | ❌ 可能永久白屏 | ✅ 可写降级逻辑 |
| **状态** | ✅ 标准 | ❌ **已删除** | ✅ 标准（PWA 基础） |

### 6.3.8 面试怎么答

- AppCache 通过 `<html manifest>` 声明，manifest 分 `CACHE` / `NETWORK` / `FALLBACK`；已被移除，写了也被忽略。
- 废弃核心是不可控：更新只认 manifest 字节变化、全量替换、优先级高于 HTTP 缓存；配置错误会导致永久白屏且无法远程修复。
- Service Worker 是独立后台线程，可拦截 `fetch`，用代码决定缓存还是网络；不能访问 DOM，必须 HTTPS（`localhost` 例外）。
- 生命周期：register → install → waiting → activate → fetch → terminated；新版本默认等旧页面全部关闭，`skipWaiting()` + `clients.claim()` 可立即接管。
- Service Worker 与 HTTP 缓存不是一层：前者主动拦截，后者被动命中。

---

## 6.4 HTTP 缓存

本节覆盖强缓存与协商缓存的判定链路；`Cache-Control` 全指令、ETag 强弱、`stale-while-revalidate` 见 `网络-08-HTTP缓存.md`。

### 6.4.1 一句话回答

**强缓存决定「要不要发请求」，协商缓存决定「发了请求能不能省响应体」。**

```
浏览器要一个资源
    ↓
有强缓存且未过期？（Cache-Control: max-age / Expires）
├─ 是 → 直接用本地，状态码 200 (from disk cache)，【不发请求】
└─ 否 → 发请求，带上 If-None-Match / If-Modified-Since
        ↓
      服务端判断变了吗？
      ├─ 没变 → 304 Not Modified（【只返回头，不返回体】）
      └─ 变了 → 200 + 新资源
```

### 6.4.2 两套头

| 类型 | 响应头 | 请求头 | 优先级 |
|---|---|---|---|
| **强缓存** | `Cache-Control: max-age=31536000` | — | `Cache-Control` **高于** `Expires` |
| | `Expires: Wed, 21 Oct 2026 07:28:00 GMT` | — | 老方案，绝对时间，受客户端时钟影响 |
| **协商缓存** | `ETag: "abc123"` | `If-None-Match: "abc123"` | `ETag` **高于** `Last-Modified` |
| | `Last-Modified: Wed, 21 Oct 2026 07:28:00 GMT` | `If-Modified-Since: ...` | 精度只到秒 |

### 6.4.3 `Cache-Control` 的核心指令

| 指令 | 含义 | 常见误解 |
|---|---|---|
| `max-age=3600` | 缓存 3600 秒 | — |
| `s-maxage=3600` | 只对**共享缓存**（CDN/代理）生效，优先级高于 `max-age` | 常被忽略 |
| **`no-cache`** | **可以缓存，但每次使用前必须向服务端验证** | ❌ **不是「不缓存」** |
| **`no-store`** | **完全不许缓存**（不写磁盘、不写内存） | ✅ 这才是「不缓存」 |
| `private` | 只允许浏览器缓存，CDN 不能缓存 | 登录后的页面要用 |
| `public` | 允许任何缓存 | — |
| `immutable` | 在 `max-age` 内**连刷新都不重新验证** | 配 hash 文件名用 |
| `stale-while-revalidate=60` | 过期后 60 秒内先用旧的，同时后台更新 | 提升体验的利器 |
| `must-revalidate` | 过期后必须验证，不能用过期副本 | — |

### 6.4.4 缓存位置（按查找顺序）

```
① Service Worker（可以完全接管）
② Memory Cache（内存，当前页面会话有效，关标签页就没）
③ Disk Cache（磁盘，跨会话）
④ 都没有 → 发请求
```

### 6.4.5 最佳实践

| 资源 | 策略 | 原因 |
|---|---|---|
| **`index.html`** | `Cache-Control: no-cache` | **绝对不能强缓存**。否则发版后用户还引用旧 hash 的 JS/CSS → 白屏 |
| **带 hash 的 JS/CSS** | `Cache-Control: max-age=31536000, immutable` | 文件名变了就是新 URL，可以永久缓存 |
| **图片/字体** | `max-age=31536000` + hash 或版本号 | 同上 |
| **API 响应** | `no-store` 或短 `max-age` + `ETag` | 数据要新鲜 |
| **CDN 上的公开资源** | `public, max-age=..., s-maxage=...` | 让 CDN 缓存 |

**「发版白屏」的因果链**：

```
① index.html 被设了 max-age=86400
② 发版，index.html 引用了 app.a1b2c3.js
③ 用户浏览器还拿旧的 index.html，它引用 app.OLD.js
④ app.OLD.js 已经被新版本覆盖删除 → 404
⑤ 页面白屏，用户必须手动清缓存
    ↓
正确做法：index.html 用 no-cache（每次都验证，命中 304 也很快）
         静态资源用 hash + 长期 max-age
```

### 6.4.6 面试怎么答

- 强缓存：`Cache-Control: max-age` / `Expires`，命中不发请求；`Cache-Control` 优先。
- 协商缓存：`ETag` / `If-None-Match`、`Last-Modified` / `If-Modified-Since`，未变返回 304，只有响应头；`ETag` 优先。
- 实践：`index.html` 用 `no-cache`，带 hash 的静态资源用 `max-age=31536000, immutable`；否则发版后旧 HTML 引用已删除资源会白屏。
- `no-cache` 可缓存但每次验证，`no-store` 才是完全不缓存。
- F5 跳过强缓存、仍带协商缓存；Ctrl+F5 连协商缓存也跳过。`Vary` 让缓存按指定请求头区分版本。

---

## 6.5 速记卡

```
存储选型
  会话/登录态 → Cookie（HttpOnly + Secure + SameSite）
  偏好/主题/草稿 → localStorage（同源、同步、约 5MB）
  单次流程状态 → sessionStorage（关标签页即失效，新标签页不共享）
  大数据/查询 → IndexedDB（异步、事务、结构化克隆；SW 里只能用 IDB + Cache API）

Cookie
  单条约 4KB；每次同源请求自动携带
  Max-Age 优先于 Expires；Domain 不含子域除非显式加点
  HttpOnly 阻止 JS 读取；SameSite=Lax 跨站 POST 不带

离线与缓存
  AppCache 已移除 → Service Worker（主动拦截 fetch）≠ HTTP 缓存（被动命中）
  SW：独立线程、无 DOM、HTTPS、register → install → waiting → activate → fetch
  强缓存不发请求；协商缓存 304 只回头
  index.html no-cache；带 hash 静态资源 max-age=31536000 + immutable
```
