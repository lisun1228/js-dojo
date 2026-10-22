# HTML · 06 存储、缓存与离线

> 本册覆盖：Cookie / sessionStorage / localStorage（题 7、11，重复 2 次）、HTML5 离线缓存与本地缓存的区别（题 17）、HTTP 缓存（题 29）
> 这 4 道题覆盖了「**浏览器把东西存在哪**」的全部答案，分三个层次：
> **① 应用数据**（Cookie / Storage / IndexedDB）→ **② 代码与资源**（Service Worker / HTTP 缓存）→ **③ 已死的方案**（AppCache）
> 题 17 的题单答案有一处概念错位：把 AppCache 的对照物说成了「HTTP 缓存」，实际应该是 **Service Worker**。

---

## 6.1 一句话结论

**浏览器有四种存数据的地方，区别在「谁能读到、多大、同步还是异步、会不会跟着请求跑」**：

```
Cookie         4KB    每次请求自动带上  ← 唯一会「跟着 HTTP 请求跑」的
localStorage   5-10MB 同步、永久        ← 简单键值，用完即弃的小数据
sessionStorage 5MB    同步、标签页级    ← 表单草稿、单次流程状态
IndexedDB      GB 级  异步、事务         ← 离线数据、大量结构化数据
```

而「资源缓存」是另一套东西：**HTTP 缓存是被动命中，Service Worker 是主动拦截**。

---

## 6.2 Cookie / localStorage / sessionStorage（题 7、11）

### 6.2.1 一句话回答

**Cookie 是「HTTP 状态管理机制」**（不是存储方案），4KB、每次请求自动带、可设 HttpOnly 防 XSS 读取；**localStorage 是「同源共享的永久键值存储」**，5-10MB、同步 API；**sessionStorage 是「标签页级的会话存储」**，关掉标签页就没，同源不同标签页之间**不共享**。

### 6.2.2 完整对比表（8 个维度）

| 维度 | Cookie | localStorage | sessionStorage |
|---|---|---|---|
| **生命周期** | 可设 `Expires`/`Max-Age`；不设则**会话结束消失** | **永久**（除非用户清除或代码删除） | **标签页关闭即消失**（刷新保留） |
| **容量** | **4KB 左右**（含 name/value/所有属性），每域约 50 个 | **5-10MB**（Chrome/Firefox 约 10MB，Safari 5MB） | 同 localStorage（约 5MB） |
| **是否随请求发送** | ✅ **每次同源请求自动带在请求头**（这是它最大的特征，也是最大的负担） | ❌ | ❌ |
| **作用域** | 同源 + `Domain` + `Path` 匹配 | **同源**（scheme + host + port），**不跨子域** | 同源 + **同一个标签页** |
| **API** | `document.cookie`（字符串拼接，很难用） | `getItem/setItem/removeItem/clear` | 同 localStorage |
| **同步/异步** | 同步（但由浏览器在请求时处理） | **同步**（阻塞主线程） | **同步** |
| **能否被 JS 读** | 设了 `HttpOnly` 就**不能** | 能 | 能 |
| **跨标签页共享** | ✅ 共享 | ✅ 共享（`storage` 事件可监听变化） | ❌ **不共享**（每个标签页独立） |
| **服务端能读吗** | ✅ 能（在请求头里） | ❌ 不能 | ❌ 不能 |
| **典型用途** | 会话 ID、Token（不推荐）、用户偏好、埋点 | 用户设置、草稿、缓存列表数据、主题 | 表单草稿、单次流程状态（如多步注册） |

### 6.2.3 Cookie 的七个属性（★ 高频）

```http
Set-Cookie: sid=abc123; Max-Age=3600; Path=/; Domain=.example.com;
            Secure; HttpOnly; SameSite=Lax
```

| 属性 | 作用 | 关键细节 |
|---|---|---|
| **`Expires`** | 绝对过期时间（HTTP-date） | `Expires=Wed, 21 Oct 2026 07:28:00 GMT` |
| **`Max-Age`** | 相对过期时间（秒） | **优先级高于 `Expires`**；`0` 或负数 = 立即删除 |
| **`Domain`** | 允许哪些域携带 | `.example.com` 表示**含所有子域**；不写则只限当前域（**不含子域**） |
| **`Path`** | 允许哪些路径携带 | `Path=/admin` 则只有 `/admin/*` 的请求会带 |
| **`Secure`** | 只在 HTTPS 下发送 | 防中间人窃取 |
| **`HttpOnly`** | **JS 读不到**（`document.cookie` 里看不到） | **防 XSS 窃取 Cookie 的核心手段** |
| **`SameSite`** | 跨站请求是否带 Cookie | `Strict` / `Lax`（**现代浏览器默认**）/ `None`（必须配 `Secure`） |

**`SameSite` 三个值的行为**（这是 CSRF 防御的第一道防线）：

| 值 | 同站请求 | 跨站 GET（点链接） | 跨站 POST（表单/fetch） | iframe 内 |
|---|---|---|---|---|
| `Strict` | ✅ 带 | ❌ **不带** | ❌ 不带 | ❌ 不带 |
| `Lax`（默认） | ✅ 带 | ✅ **带** | ❌ 不带 | ❌ 不带 |
| `None` | ✅ 带 | ✅ 带 | ✅ 带 | ✅ 带（必须 `Secure`） |

**`Lax` 的实际影响**：从别的站点点链接跳过来，Cookie 会带（用户是登录状态）；但第三方站点发起的 POST 不会带（防 CSRF）。**这也带来一个坑**：跨站的 POST 回调（如第三方支付跳回）会因为 Cookie 不带而丢失登录态，需要显式设 `SameSite=None; Secure`。

### 6.2.4 Cookie 的三个实战坑

| 坑 | 现象 | 原因 |
|---|---|---|
| **请求头越来越大** | 首屏请求 `Cookie` 头几百字节甚至几 KB | Cookie 会跟着**每一个**同源请求（图片、CSS、JS 全带）。所以**静态资源要用独立域**（CDN 域不设 Cookie） |
| **跨域请求 Cookie 不带** | 前端 `fetch` 带了 `credentials: 'include'` 还是没登录态 | 服务端必须同时返回 `Access-Control-Allow-Credentials: true` **且** `Access-Control-Allow-Origin` **不能是 `*`**（必须是具体源） |
| **HTTPS 站点 Cookie 失效** | 上线 https 后登录态丢了 | Cookie 设了 `Secure` 但在 http 下测试；或者 `SameSite=None` 没配 `Secure`（会被浏览器直接拒绝） |

```js
// 设置 Cookie（原生 API 很难用，只能整串赋值）
document.cookie = 'theme=dark; Max-Age=31536000; Path=/; SameSite=Lax';

// 读：需要自己解析
const getCookie = (name) =>
  document.cookie.split('; ').find((c) => c.startsWith(name + '='))?.split('=')[1];
```

### 6.2.5 localStorage 的四个坑

| 坑 | 说明 | 解法 |
|---|---|---|
| **同步阻塞主线程** | `localStorage` 是同步 API，读写大 JSON（几 MB）会卡住渲染 | 大数据用 IndexedDB；写入放到 `requestIdleCallback` |
| **只能存字符串** | 存对象要 `JSON.stringify` | 封装 `getJSON/setJSON`；注意 `Date`/`Map`/`undefined` 会丢 |
| **隐私模式下会抛错** | Safari 无痕模式 `setItem` 抛 `QuotaExceededError` | `try/catch` 包裹，降级到内存 |
| **不跨子域** | `a.example.com` 和 `b.example.com` 的 localStorage 完全独立 | 用 Cookie（设 `Domain`）或 postMessage 同步 |

```js
// 一个健壮的封装（隐私模式 + 容量超限都要处理）
const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      // QuotaExceededError / 隐私模式
      console.warn('localStorage 写入失败', e);
      return false;
    }
  },
};
```

### 6.2.6 sessionStorage 的「标签页」到底怎么算

这是最容易答错的一点：

| 操作 | sessionStorage 行为 |
|---|---|
| 刷新页面 | ✅ **保留** |
| 同一标签页里跳转（`location.href`） | ✅ 保留（同源） |
| 关闭标签页再开 | ❌ **丢失** |
| **在新标签页打开同一 URL** | ❌ **新的、空的**（不共享） |
| **复制标签页**（Ctrl+点击 / 右键复制） | ⚠️ **会复制一份**（内容被 clone 过去，但之后独立） |
| 同源 iframe | ✅ **共享父页面的 sessionStorage** |
| 浏览器恢复上次会话 | ✅ 通常保留（`restore on startup`） |

**典型用途**：多步表单（步骤 1 填完存起来，步骤 2 刷新不丢）、单次活动的状态、防止重复提交的标记。

### 6.2.7 `storage` 事件：跨标签页通信

```js
// 标签页 A 修改 localStorage
localStorage.setItem('theme', 'dark');

// 标签页 B 监听
window.addEventListener('storage', (e) => {
  console.log(e.key, e.oldValue, e.newValue, e.url);
  // 注意：A 自己不会收到事件，只有【其它】标签页收到
});

// sessionStorage 也有 storage 事件，但只在同源 iframe 之间
```

| 特性 | 说明 |
|---|---|
| 触发条件 | **其它**同源标签页/窗口修改了 localStorage 或 sessionStorage |
| 不触发的情况 | 修改发生在**当前**页面；`clear()` 时 `key` 为 `null` |
| 用途 | 多标签页同步登录态、主题、登出广播 |
| 局限 | **不能传复杂结构**（只有 key/value 字符串）；不能跨域 |

### 6.2.8 补充：IndexedDB（现在面试也常问）

| 维度 | IndexedDB | localStorage |
|---|---|---|
| 容量 | 按磁盘配额算（通常可用几百 MB 到几 GB） | 5-10MB |
| API | **异步**（事件/Promise 封装） | **同步** |
| 数据类型 | **结构化克隆**（对象、数组、Blob、File、Date、Map/Set） | 只有字符串 |
| 查询 | 索引、游标、范围查询、事务 | 只能按 key 取 |
| 事务 | ✅ ACID | ❌ |
| 复杂度 | 高（所以要 Dexie / idb 这类封装） | 极低 |
| 适用 | 离线应用、大文件缓存、本地数据库 | 少量配置、草稿 |

**一句话**：**大于 1MB 或者需要查询，就用 IndexedDB；小配置用 localStorage。**

> **注意**：**Service Worker 里不能用 localStorage**（没有同步 API 的窗口环境），只能用 IndexedDB + Cache API。

### 6.2.9 面试怎么答

**30 秒版**

> 三个的核心区别有四点。**容量**：Cookie 4KB 左右，两个 Storage 是 5 到 10MB。**生命周期**：Cookie 可设过期、不设就是会话级；localStorage 永久；sessionStorage 关标签页就没了。**是否随请求发送**：只有 Cookie 会，每个同源请求都自动带上，这也是它最大的负担。**作用域**：Cookie 可以跨子域（设 Domain）；localStorage 同源共享但不跨子域；sessionStorage 是同源加单标签页，新开标签页不共享。所以 Cookie 用来做会话管理，localStorage 存用户设置这类持久数据，sessionStorage 存表单草稿这类单次流程状态。

**2 分钟版**

> 我按「是什么、比什么、怎么选」讲。
>
> **是什么**：首先要纠正一个认知——**Cookie 不是存储方案，它是 HTTP 的状态管理机制**。HTTP 是无状态的，服务端需要认人，所以发明了 Cookie：浏览器存一小段，每次请求自动带上。localStorage 和 sessionStorage 是 HTML5 加的纯客户端存储，服务端看不到。
>
> **比什么**：六个维度。容量上 Cookie 4KB、Storage 5-10MB。生命周期上 Cookie 可设 Max-Age、不设就是会话级，localStorage 永久，sessionStorage 关标签页就没。是否随请求发送——这是最本质的区别，只有 Cookie 会带，所以 Cookie 越大请求越慢，静态资源一定要用无 Cookie 的独立域。作用域上 Cookie 可以通过 Domain 跨子域，localStorage 不跨子域，sessionStorage 还要再加一个「单标签页」。API 上 Cookie 只有一个 `document.cookie` 字符串，非常难用；Storage 有 getItem/setItem 这样的正经 API。同步异步上两个 Storage 都是同步的，会阻塞主线程。
>
> **怎么选**：登录态用 Cookie，而且必须加 `HttpOnly`（防 XSS 读取）+ `Secure` + `SameSite`；如果项目用 Token 方案存在 localStorage 里，要清楚它有 XSS 风险。用户偏好、主题、草稿用 localStorage。多步表单这种单次流程用 sessionStorage，关掉就自动清理。如果是几 MB 以上的结构化数据或者需要查询，就上 IndexedDB，因为 localStorage 是同步的，读大 JSON 会卡住渲染。

**追问表**

| 追问 | 回答要点 |
|---|---|
| Cookie 为什么每次请求都带 | 它是 HTTP 状态管理机制，浏览器按 Domain/Path 匹配自动附加 |
| Cookie 怎么防 XSS 窃取 | `HttpOnly`（JS 读不到）+ `Secure`（只走 HTTPS） |
| Cookie 怎么防 CSRF | `SameSite=Lax/Strict` + CSRF Token + 校验 Origin/Referer |
| `SameSite` 默认值是什么 | **Lax**（Chrome 80 起） |
| 跨域请求怎么带 Cookie | 前端 `credentials:'include'` + 后端 `Allow-Credentials:true` + `Allow-Origin` 不能是 `*` |
| localStorage 跨子域吗 | **不跨**；需要共享就用 Cookie（设 Domain）或 postMessage |
| sessionStorage 刷新会丢吗 | **不会**，只有关闭标签页才丢 |
| 新标签页打开同 URL，sessionStorage 共享吗 | **不共享**，是全新空的 |
| 复制标签页呢 | 会复制一份内容，之后独立 |
| localStorage 满了怎么办 | `QuotaExceededError`；清理、降级、改用 IndexedDB |
| 怎么跨标签页通信 | `storage` 事件（只有其它标签页收到）、BroadcastChannel、SharedWorker |
| Token 存哪最安全 | **HttpOnly Cookie**（防 XSS）；localStorage 有 XSS 读取风险；内存 + 刷新用 refresh token Cookie 是常见折中 |
| Service Worker 能用 localStorage 吗 | **不能**，只能用 IndexedDB + Cache API |

---

## 6.3 HTML5 离线缓存：AppCache 与 Service Worker（题 17）

### 6.3.1 一句话回答

题单把 HTML5 离线缓存说成「Application Cache（manifest），已废弃，现在用 Service Worker；本地缓存是 HTTP 缓存」——**前半句对，后半句概念错位**。

**准确说法**：**AppCache 是「应用级离线缓存」，它的替代者是 Service Worker**，两者都是「**开发者主动控制缓存**」；而 **HTTP 缓存是「服务端通过响应头被动声明缓存策略」**，两者不是同一层的东西。

### 6.3.2 AppCache 怎么用（了解即可，已经不能用了）

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

### 6.3.3 ★ AppCache 为什么被废弃（6 个原因，这是本题的真正考点）

| # | 原因 | 具体表现 |
|---|---|---|
| **1** | **更新机制极端粗暴** | 只有 **manifest 文件本身字节变化**才触发更新（改一个注释才行）；而且更新是**全量原子替换**，没有增量 |
| **2** | **缓存优先级高于 HTTP 缓存，且不可控** | 一旦资源进了 AppCache，**即使你改了服务器上的文件、清了 HTTP 缓存，用户还是看到旧的**。开发者完全无法干预 |
| **3** | **配置错了会导致永久白屏，且无法远程修复** | 如果 manifest 里漏了某个文件，或者首次加载时有一个文件 404，整个缓存失效 → 用户**永远打不开页面，只能手动清浏览器数据** |
| **4** | **无法按 URL 精细控制** | 要么全进缓存，要么全走网络，没有「这个接口缓存 5 分钟」这种粒度 |
| **5** | **不支持动态内容 / 不支持 POST** | 只缓存 GET 资源；API 响应基本没法处理 |
| **6** | **多标签页/多窗口行为混乱** | 更新时机不确定，`swapCache()` 的语义让人困惑 |

**结局**：2015 年从 HTML 规范草案中移除；**Chrome 95（2021）彻底删除支持**，Firefox 84 也移除了。现在写了 `manifest` 属性浏览器**直接忽略**。

> **面试话术**：「AppCache 被废弃的核心原因是**不可控**——它的更新只认 manifest 文件的字节变化，而且是全量替换，缓存优先级还高于 HTTP 缓存。一旦配置错了，用户会永久白屏而且你没法远程修复，只能让他手动清浏览器数据。这在生产环境是不可接受的，所以规范上直接删掉了，Chrome 95 也不支持了。」

### 6.3.4 Service Worker 是什么

**一句话**：Service Worker 是**运行在浏览器后台的独立线程**，可以**拦截页面发出的所有网络请求**，从而自己决定「用缓存还是走网络」。

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
| **事件驱动** | 空闲会被**终止**，需要时再唤醒（所以**不能存全局状态**，要用 IndexedDB） |
| **必须 HTTPS** | `localhost` 例外（安全要求：能拦截请求的脚本必须可信） |
| **作用域（scope）** | 默认是 sw.js 所在目录，只能拦截**该目录下**的请求 |
| **生命周期由浏览器管** | 页面关闭后依然存活（用于推送、后台同步） |

### 6.3.5 生命周期（★ 必背）

```
① register（页面注册）
     navigator.serviceWorker.register('/sw.js')
        ↓
② install（安装）
     event.waitUntil() 里预缓存关键资源
     失败 → 整个 SW 作废
        ↓
③ installed / waiting（等待）
     ★ 如果已有旧版本在控制页面，新版本进入 waiting 状态
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

**两个关键 API**：

```js
// 让 waiting 的新版本立刻接管（配合页面 reload）
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
```

**更新机制**（高频追问）：

| 问题 | 答案 |
|---|---|
| 浏览器什么时候检查更新 | 每次**导航**到 scope 内的页面时检查 `sw.js` |
| 怎么判断「有更新」 | **字节级比较**（内容有一个字符不同就算更新） |
| 强制检查间隔 | 浏览器至少每 **24 小时**强制检查一次 |
| `importScripts` 引入的脚本会检查吗 | **不会**（这是坑，要手动改主文件或加版本号） |
| 新版本什么时候生效 | 进入 waiting，**等所有旧页面关闭**才 activate；或者用 `skipWaiting` |
| 为什么不能立刻生效 | 怕新旧版本同时控制不同页面，缓存策略冲突导致错乱 |

### 6.3.6 四种缓存策略（工程实践）

| 策略 | 逻辑 | 适用 |
|---|---|---|
| **Cache First** | 有缓存就用，没有才走网络 | 静态资源（带 hash 的 JS/CSS/图片） |
| **Network First** | 先走网络，失败才用缓存 | API 数据、HTML（要保证新鲜） |
| **Stale While Revalidate** | **立刻返回缓存**，同时后台请求更新 | 头像、列表、允许短暂过期的数据 |
| **Cache Only / Network Only** | 只用缓存 / 只用网络 | 特殊场景 |

```js
// Stale While Revalidate 的典型实现
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request);
      const network = fetch(e.request).then((res) => {
        cache.put(e.request, res.clone());
        return res;
      }).catch(() => cached);
      return cached || network;      // 有缓存立刻返回，同时后台更新
    })
  );
});
```

**实际项目几乎不手写**，用 **Workbox**（Google 官方库）：`registerRoute` + `CacheFirst` / `NetworkFirst` / `StaleWhileRevalidate` 一行搞定。

### 6.3.7 AppCache vs Service Worker vs HTTP 缓存（三者对比）

| 维度 | HTTP 缓存 | AppCache | Service Worker |
|---|---|---|---|
| **谁决定** | **服务端**（响应头） | 开发者（manifest 文件） | 开发者（JS 代码） |
| **控制粒度** | 单个资源 | 整体（全有或全无） | **任意精细**（可以按 URL、按方法、按请求头） |
| **能否编程** | ❌ | ❌ | ✅ **完全可编程** |
| **离线能力** | 只能命中已缓存的资源 | ✅ 完整离线 | ✅ 完整离线 + 后台同步 + 推送 |
| **更新控制** | HTTP 语义 | ❌ 只认 manifest 字节变化 | ✅ 代码里自己写 |
| **失败恢复** | 正常回源 | ❌ 可能永久白屏 | ✅ 可写降级逻辑 |
| **状态** | ✅ 标准 | ❌ **已删除** | ✅ 标准（PWA 基础） |

### 6.3.8 面试怎么答

**30 秒版**

> HTML5 的离线缓存是 Application Cache，靠 `<html manifest="...">` 声明一个 manifest 文件，列出要缓存的资源。它已经被废弃了，Chrome 95 就彻底删了支持。核心原因是**不可控**：更新只认 manifest 文件的字节变化，而且是全量替换；缓存优先级高于 HTTP 缓存，开发者改不动；配置错了会让用户永久白屏，还无法远程修复。替代者是 Service Worker，它是个独立的后台线程，能拦截所有网络请求，用代码决定走缓存还是走网络，粒度完全可控。要注意 Service Worker 和 HTTP 缓存不是同一层的东西——HTTP 缓存是服务端声明策略、浏览器被动命中，Service Worker 是开发者主动拦截。

**追问表**

| 追问 | 回答要点 |
|---|---|
| AppCache 怎么用 | `<html manifest>` + manifest 文件（CACHE/NETWORK/FALLBACK） |
| 为什么废弃 | 更新只认 manifest 字节变化、全量替换、优先级不可控、错了会永久白屏 |
| 现在还能用吗 | 不能，Chrome 95 / Firefox 84 已移除，写了也被忽略 |
| Service Worker 能操作 DOM 吗 | **不能**，没有 window/document；有 caches/IndexedDB/fetch |
| SW 为什么必须 HTTPS | 能拦截所有请求的脚本必须可信 |
| SW 生命周期 | register → install → waiting → activate → fetch → terminated |
| 新版本为什么不立刻生效 | waiting 到所有旧页面关闭，避免新旧混用 |
| 怎么让它立刻生效 | `skipWaiting()` + `clients.claim()` + 页面 reload |
| 什么时候检查更新 | 每次导航，字节级比较，至少 24 小时强制一次 |
| `importScripts` 会检查更新吗 | **不会**，是坑 |
| SW 能用 localStorage 吗 | 不能，只能 IndexedDB |
| 有哪些缓存策略 | CacheFirst / NetworkFirst / StaleWhileRevalidate / CacheOnly / NetworkOnly |
| 实际项目怎么写 | 用 Workbox，不手写 |

---

## 6.4 HTTP 缓存（题 29）

> 这一节只给「能过面试」的深度。**深水区（Cache-Control 全指令、ETag 强弱、F5 与 Ctrl+F5 的差异、`stale-while-revalidate`）请直接看工作区里的 `计算机网络-71题/网络-08-HTTP缓存.md`。**

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

> **`no-cache` vs `no-store` 是最经典的追问点**：
> `no-cache` = "**先别信我这份，去问一下服务端**"（还会缓存，只是每次验证）
> `no-store` = "**别存我**"（彻底不缓存）

### 6.4.4 缓存位置（按查找顺序）

```
① Service Worker（可以完全接管）
② Memory Cache（内存，当前页面会话有效，关标签页就没）
③ Disk Cache（磁盘，跨会话）
④ Push Cache（HTTP/2 推送，极少用）
⑤ 都没有 → 发请求
```

### 6.4.5 最佳实践（一问就能看出有没有做过项目）

| 资源 | 策略 | 原因 |
|---|---|---|
| **`index.html`** | `Cache-Control: no-cache` | **绝对不能强缓存**。否则发版后用户还引用旧 hash 的 JS/CSS → 白屏 |
| **带 hash 的 JS/CSS** | `Cache-Control: max-age=31536000, immutable` | 文件名变了就是新 URL，可以永久缓存 |
| **图片/字体** | `max-age=31536000` + hash 或版本号 | 同上 |
| **API 响应** | `no-store` 或短 `max-age` + `ETag` | 数据要新鲜 |
| **CDN 上的公开资源** | `public, max-age=..., s-maxage=...` | 让 CDN 缓存 |

**「发版白屏」的完整因果链**（面试讲这个非常有说服力）：

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

**30 秒版**

> 缓存分强缓存和协商缓存。强缓存用 `Cache-Control` 的 `max-age` 或者老的 `Expires`，命中就完全不发请求，直接从本地读。协商缓存用 `ETag` / `Last-Modified`，浏览器发请求带 `If-None-Match` / `If-Modified-Since`，服务端判断没变就返回 304，只回头不回体。优先级上 `Cache-Control` 高于 `Expires`，`ETag` 高于 `Last-Modified`。实践上 `index.html` 必须 `no-cache`，静态资源用 hash 文件名配长期 `max-age` 加 `immutable`。

**追问表**

| 追问 | 回答要点 |
|---|---|
| `no-cache` 和 `no-store` | 前者可缓存但每次验证；后者完全不缓存 |
| `ETag` 和 `Last-Modified` 谁优先 | `ETag`；且 `Last-Modified` 精度只到秒，一秒内多次修改会漏 |
| 304 有响应体吗 | **没有**，只有响应头 |
| 强缓存命中会有请求吗 | **没有**，状态码显示 200 (from disk cache) |
| 为什么 `index.html` 不能强缓存 | 发版后会引用已删除的旧资源 → 白屏 |
| F5 和 Ctrl+F5 区别 | F5 跳过强缓存但仍带协商缓存头；Ctrl+F5 连协商缓存都跳过，强制完整请求 |
| `s-maxage` 和 `max-age` 区别 | `s-maxage` 只对 CDN/代理生效，且优先级更高 |
| `immutable` 干什么 | `max-age` 内连刷新都不验证，减少 304 请求 |
| `Vary` 头干什么 | 告诉缓存「同一个 URL 按某个请求头区分不同版本」，如 `Vary: Accept-Encoding`；用错会导致缓存命中率暴跌 |

---

## 6.5 速记卡

```
三种前端存储
              Cookie        localStorage    sessionStorage
  容量        4KB           5-10MB          5MB
  生命周期    可设过期/会话  永久            关标签页即失（刷新保留）
  随请求发送  ★ 是          否              否
  作用域      同源+Domain+Path  同源(不跨子域) 同源+单标签页
  JS 可读     HttpOnly 则不可  可              可
  同步/异步   同步           同步(阻塞)        同步(阻塞)
  跨标签页    共享           共享(storage事件) 不共享
  服务端可读  可              不可              不可

Cookie 属性
  Max-Age 优先于 Expires；Domain 加点号才含子域；Path 限制路径
  Secure（只走 HTTPS）/ HttpOnly（JS 读不到，防 XSS）
  SameSite: Strict / Lax（默认）/ None（必须配 Secure）
  ★ SameSite=Lax 的影响：点链接带，跨站 POST 不带

Storage 坑
  同步阻塞 → 大 JSON 卡渲染 → 上 IndexedDB
  只存字符串 → JSON.stringify；Date/Map 会丢
  隐私模式抛 QuotaExceededError → try/catch 降级
  不跨子域 → Cookie/Domain 或 postMessage

IndexedDB
  异步、事务、GB 级、可存 Blob/File、有索引游标
  ★ Service Worker 里不能用 localStorage，只能用 IDB + Cache API

AppCache（已死）
  <html manifest="...">，CACHE / NETWORK / FALLBACK
  废弃原因（6）：
    ① 更新只认 manifest 字节变化，全量替换
    ② 优先级高于 HTTP 缓存，开发者改不动
    ③ 配置错 → 永久白屏，无法远程修复
    ④ 粒度太粗
    ⑤ 不支持 POST / 动态内容
    ⑥ 多标签页行为混乱
  Chrome 95 / Firefox 84 已移除

Service Worker
  独立线程，不能访问 DOM，必须 HTTPS（localhost 除外）
  生命周期：register → install → waiting → activate → fetch → terminated
  更新：每次导航字节比较 sw.js，至少 24h 强制；importScripts 不检查
  立刻生效：skipWaiting() + clients.claim()
  策略：CacheFirst / NetworkFirst / StaleWhileRevalidate
  ★ 与 HTTP 缓存不是一层：SW 是主动拦截，HTTP 缓存是被动命中

HTTP 缓存
  强缓存：Cache-Control max-age / Expires（Cache-Control 优先）→ 不发请求
  协商缓存：ETag/If-None-Match > Last-Modified/If-Modified-Since → 304
  ★ no-cache = 可缓存但每次验证；no-store = 完全不缓存
  位置：SW > Memory > Disk > Push
  实践：index.html no-cache；静态资源 hash + max-age=31536000 + immutable
```
