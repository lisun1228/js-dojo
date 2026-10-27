# 性能 · 02 加载与网络：缓存 / CDN / HTTP2 / 资源优先级

> 覆盖题号：**1、3**（加载优化，以及题 3 的网络与缓存维度）
> 对应原题：《前端性能优化有哪些方式》《从网络、渲染、缓存三方面讲优化》
> 范围：资源从服务器到浏览器的链路；渲染见 04，首屏整体见 03

---

## 目录

- [1. 一次请求的时间都花在哪（先建立成本模型）](#1-一次请求的时间都花在哪先建立成本模型)
- [2. DNS 与连接：把 RTT 砍掉](#2-dns-与连接把-rtt-砍掉)
- [3. HTTP 版本演进：从队头阻塞到多路复用](#3-http-版本演进从队头阻塞到多路复用)
- [4. 传输压缩：gzip / brotli](#4-传输压缩gzip--brotli)
- [5. HTTP 缓存（重中之重）](#5-http-缓存重中之重)
- [6. Service Worker 缓存](#6-service-worker-缓存)
- [7. 资源优先级：preload / prefetch / preconnect](#7-资源优先级preload--prefetch--preconnect)
- [8. CDN 怎么用才有效](#8-cdn-怎么用才有效)
- [9. "减少请求数"在 HTTP/2 时代还成立吗](#9-减少请求数在-http2-时代还成立吗)
- [10. 常见坑](#10-常见坑)
- [11. 答题模板（/ 题 3）](#11-答题模板-题-3)
- [12. 追问表](#12-追问表)
- [13. 速记卡](#13-速记卡)

---

## 1. 一次请求的时间都花在哪（先建立成本模型）

所有加载优化手段，都是在砍下面某一段：

```
t_total = DNS + TCP握手 + TLS握手 + 请求发送 + 服务端处理 + 响应传输 + 浏览器解析
          ↑视缓存  ↑1RTT      ↑1~2RTT      ~0         ↑可变         ↑可变        ↑可变
```

| 环节 | 成本 | 砍它的手段 |
|---|---|---|
| DNS 解析 | 取决于缓存与递归链路 | `dns-prefetch`、HTTPDNS、减少域名 |
| TCP 握手 | 1 RTT | `preconnect`、keep-alive 复用、HTTP/3 |
| TLS 握手 | TLS 1.2 为 2 RTT；TLS 1.3 首次 1 RTT、恢复 0 RTT | TLS 1.3、OCSP Stapling、`preconnect` |
| 请求/响应传输 | 取决于字节数与带宽 | 压缩、CDN 就近、HTTP/2 多路复用 |
| 服务端处理 | 可变，通常是 TTFB 的主要部分 | 缓存、索引、SSR 流式、边缘计算 |

新域名上的第一个请求要额外付 DNS + TCP + TLS，约 2~4 个 RTT；这部分与带宽无关，是 `preconnect` 和减少域名的依据。

---

## 2. DNS 与连接：把 RTT 砍掉

### 2.1 四个「预」指令

| 指令 | 做什么 | 省下 | 场景 |
|---|---|---|---|
| `dns-prefetch` | 只做 DNS 解析 | 一次 DNS 查询 | 即将访问的第三方域名 |
| `preconnect` | DNS + TCP + TLS | 2~4 个 RTT | 一定会用到、跨域的关键源站（字体、API） |
| `preload` | 当前页高优先级提前下载 | 资源发现延迟 | 首屏 LCP 图、字体、关键 CSS/JS |
| `prefetch` | 空闲时低优先级下载 | 下一次导航的加载时间 | 下一页、下一个路由 chunk |

```html
<link rel="dns-prefetch" href="https://cdn.example.com">
<link rel="preconnect" href="https://cdn.example.com" crossorigin>
<link rel="preconnect" href="https://api.example.com" crossorigin>

<link rel="preload" as="image" href="/hero.webp" fetchpriority="high"
      imagesrcset="/hero-640.webp 640w, /hero-1280.webp 1280w"
      imagesizes="100vw">
<link rel="preload" as="font" href="/font.woff2" type="font/woff2" crossorigin>
<link rel="modulepreload" href="/src/main.js">
```

### 2.2 三个高频陷阱

| 陷阱 | 后果 |
|---|---|
| `preload` 字体不加 `crossorigin` | 字体的 CORS 模式与其他资源不同，会下载两份 |
| `preload` 了但页面没用到 | 占着高优先级带宽，拖慢真正关键的资源 |
| `preconnect` 开太多 | 每个都占 socket 与 CPU，Chrome 建议不超过 4 个 |

### 2.3 DNS 优化

| 手段 | 说明 |
|---|---|
| HTTPDNS | 用 HTTP 接口查 IP，绕开 LocalDNS 劫持与解析慢（移动端常用） |
| 减少域名 | 每个新域名都要一次 DNS；HTTP/2 多路复用后域名分片收益消失 |
| 调 TTL | 太短解析频繁，太长切流不及时 |
| 放在 `<head>` 最前 | 解析越早开始越好 |

### 2.4 TLS 优化

| 手段 | 作用 |
|---|---|
| TLS 1.3 | 握手从 2 RTT 降到 1 RTT，支持 0-RTT 会话恢复 |
| OCSP Stapling | 服务器代取证书吊销状态，省一次客户端请求 |
| 会话复用（Session Ticket） | 二次连接 0-RTT |
| 精简证书链 | 减少握手包体积 |
| HTTP/3（QUIC） | 传输握手与 TLS 1.3 合并，首次 1 RTT，恢复 0 RTT |

---

## 3. HTTP 版本演进：从队头阻塞到多路复用

### 3.1 四个版本对照

| 维度 | HTTP/1.0 | HTTP/1.1 | HTTP/2 | HTTP/3 |
|---|---|---|---|---|
| 传输层 | TCP | TCP | TCP | UDP（QUIC） |
| 连接 | 每个请求一条 | keep-alive 默认开 | 单连接多 stream | 单连接多 stream |
| 并发 | 多开连接 | 多开连接 + 管线化（未落地） | 一条连接上的多路复用 | 同 HTTP/2 |
| 报文 | 文本 | 文本 | 二进制分帧 | 二进制分帧 |
| 头部压缩 | 无 | 无 | HPACK | QPACK |
| 队头阻塞 | 无 HTTP 层，受单域名连接数限制 | HTTP 层有（响应必须按序） | HTTP 层无，TCP 层有 | 基本消除 |
| 服务器推送 | 无 | 无 | 支持（Chrome 106 起默认关闭） | 无 |

### 3.2 HTTP/1.1 的两个限制

1. 响应必须按请求顺序返回：文本协议没有请求 ID，管线化因此未落地，实际等价于串行。
2. 浏览器对同一域名最多约 6 条并发连接（实现约定，非协议规定）。

合并文件、雪碧图、域名分片、内联小图，都是为绕开这两条。

### 3.3 HTTP/2 下老手段的取舍

| 老手段 | HTTP/2 下的结果 |
|---|---|
| 雪碧图 | 一张图变了整张缓存失效，无法按需加载 |
| 大合并 bundle | 一个字节变了整个文件 hash 变；首屏加载了用不到的代码 |
| 域名分片 | 反向优化：每个域名都要重新建连，失去单连接多路复用 |
| 大量内联 base64 | 增大 HTML，无法单独缓存，阻塞首屏 |

HTTP/2 下的做法：细粒度拆分 + 内容 hash 文件名 + 按路由加载。

### 3.4 HTTP/2 的遗留问题 → HTTP/3

HTTP/2 消除了应用层队头阻塞，但所有 stream 共享一条 TCP 连接：一个 TCP 段丢失，后续段无法交付，全部 stream 一起等重传。QUIC 给每个 stream 独立编号与偏移量，丢包只阻塞该 stream；同时把传输握手与 TLS 1.3 合并，并支持连接迁移（Connection ID）。

---

## 4. 传输压缩：gzip / brotli

### 4.1 选谁

| 算法 | 压缩率 | 压缩耗时 | 支持度 | 建议 |
|---|---|---|---|---|
| gzip | 一般 | 低 | 全平台 | 兜底必备 |
| brotli（br） | 优于 gzip | level 11 很慢，level 5 尚可 | 现代浏览器，仅 HTTPS | 首选 |

策略：静态资源构建时预压（brotli level 11 + gzip），按 `Accept-Encoding` 返回；动态内容用 brotli level 5 或 gzip level 6，级别过高会拖慢 TTFB。

```nginx
gzip on;
gzip_comp_level 6;
gzip_min_length 1024;            # 小于 1KB 收益很小，还占 CPU
gzip_vary on;                    # 让缓存按 Accept-Encoding 区分版本
gzip_types text/plain text/css application/json application/javascript
           application/xml image/svg+xml;

# brotli 需要 ngx_brotli 模块
brotli on;
brotli_comp_level 6;
brotli_static on;                # 优先用构建时生成的 .br 文件
brotli_types text/css application/javascript application/json image/svg+xml;
```

### 4.2 不要压缩的

| 类型 | 原因 |
|---|---|
| 图片（jpg/png/webp/avif） | 已压缩，再压可能变大 |
| 视频/音频 | 同上 |
| 字体（woff2） | 内部已用 Brotli 压缩 |
| 小于 1KB 的文件 | 固定开销与 CPU 成本高于收益 |

### 4.3 压缩改善的是哪一段

压缩缩短的是响应传输时间，对 TTFB 没有帮助：TTFB 由 DNS、连接与服务端处理决定。TTFB 已经很高时，先查服务端与回源链路，而不是调压缩级别。

---

## 5. HTTP 缓存（重中之重）

> 判定流程、指令表与刷新行为见《网络 · 08 HTTP 缓存》；本节只保留加载性能上的取舍。

### 5.1 两条命中路径的成本

| 路径 | 是否发请求 | 省下 |
|---|---|---|
| 强缓存命中 | 否 | 整个请求（DNS、TCP、TLS、响应体全免） |
| 协商缓存命中（304） | 是，1 RTT | 响应体 |
| 未命中 | 是 | — |

304 仍是一次完整往返，收益来自「不发请求」而不是「少传 body」。静态资源用内容 hash 文件名配长缓存，才能让请求根本不发出。

### 5.2 三个关键响应头

| 头 | 行为 | 适用 |
|---|---|---|
| `Cache-Control: public, max-age=31536000, immutable` | 有效期内不发请求，刷新也不验证 | 带内容 hash 的 JS/CSS/字体/图片 |
| `Cache-Control: no-cache` | 可以存，但每次使用前验证 | 入口 HTML、需要最新的接口 |
| `private` / `no-store` | 不进共享缓存 / 完全不写 | 用户私有数据 / 敏感数据 |

两个前提：

- `immutable` 只在文件名带内容 hash 时成立：内容一变 URL 就变，旧 URL 才敢声明不变。
- 入口 HTML 不能强缓存：它引用的 hash 文件名随发版变化，旧 HTML 会指向已删除的旧文件，导致 404 或白屏。

### 5.3 一套静态资源策略

| 资源 | `Cache-Control` |
|---|---|
| `index.html` | `no-cache` |
| 带 hash 的 JS/CSS/字体/图片 | `public, max-age=31536000, immutable` |
| 固定 URL 的图片（头像等） | 中等 `max-age`（如 7 天）+ `ETag` |
| 公开的 API GET | `private, max-age=60` 左右，可配 `stale-while-revalidate` |
| 用户私有 API / 敏感数据 | `private, no-store` |

`stale-while-revalidate=N`：过期后 N 秒内先返回旧副本并后台更新，用户不等，代价是可能看到略旧内容。

### 5.4 `Vary` 与 CDN 缓存污染

响应随请求头变化时，必须声明 `Vary`，否则边缘节点会把一个版本发给所有客户端：

| 变化维度 | 必须声明 |
|---|---|
| 编码（gzip / br） | `Vary: Accept-Encoding` |
| 语言 | `Vary: Accept-Language` |
| CORS 响应 | `Vary: Origin` |

---

## 6. Service Worker 缓存

### 6.1 定位

Service Worker 是浏览器与网络之间的可编程代理，能在离线、弱网、重复访问时接管请求，表达 HTTP 缓存表达不了的策略（如「先给缓存再后台更新」）。

### 6.2 五种策略

| 策略 | 流程 | 适合 |
|---|---|---|
| Cache First | 缓存有就用，没有才请求 | 不变的静态资源 |
| Network First | 先请求，失败回落缓存 | 接口、需要最新的内容 |
| Stale-While-Revalidate | 立即返回缓存 + 后台更新 | 头像、列表、非关键接口 |
| Network Only | 只走网络 | 支付、鉴权 |
| Cache Only | 只走缓存 | 预缓存的应用外壳 |

```js
// 预缓存外壳 + 静态资源 Cache First + 导航 Network First
const CACHE = 'v1'
const PRECACHE = ['/', '/index.html', '/app.js', '/app.css']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)))
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/index.html', copy))
          return res
        })
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  e.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy))
          return res
        })
    )
  )
})
```

### 6.3 三个坑

| 坑 | 说明 |
|---|---|
| 更新有延迟 | 默认等所有旧页面关闭才激活新 SW；`skipWaiting()` + `clients.claim()` 可立即接管，但要处理页面与 SW 版本不一致 |
| 缓存无限增长 | 必须在 `activate` 里删除旧 cache |
| 首次访问不生效 | 首次注册后的下一次访问才接管，优化的是二次访问与弱网 |

### 6.4 Workbox

生产环境用 Workbox 生成预缓存清单并处理版本清理：

```js
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

precacheAndRoute(self.__WB_MANIFEST)

registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 86400 })],
  })
)
```

---

## 7. 资源优先级：preload / prefetch / preconnect

四个「预」指令的区别见 2.1，本节只讲浏览器自身的优先级规则。

### 7.1 默认优先级（Chrome）

| 资源 | 默认优先级 |
|---|---|
| HTML、CSS、字体 | Highest |
| 首屏 `<img>` | High |
| 非首屏 `<img>`（`loading="lazy"`） | Low |
| `defer` / `async` 脚本 | Low |
| 同步 `<script>` | High |
| XHR / fetch | High |
| `preload` | 按要求（可覆盖） |
| `prefetch` | Lowest |

### 7.2 用 `fetchpriority` 干预

```html
<img src="/hero.webp" fetchpriority="high" width="1200" height="600" alt="">
<img src="/slide2.webp" fetchpriority="low" loading="lazy" width="1200" height="600" alt="">
<script src="/analytics.js" fetchpriority="low" defer></script>
```

优先级错配时，首屏 LCP 图会和大量非关键小图争带宽；把后者降到 `low` 是常见修法。

### 7.3 103 Early Hints

服务端在 HTML 还没算完时先返回 `103`，带 `Link: rel=preload`，让浏览器提前建连与下载：

```http
HTTP/1.1 103 Early Hints
Link: </app.css>; rel=preload; as=style
Link: </hero.webp>; rel=preload; as=image

HTTP/1.1 200 OK
Content-Type: text/html
```

SSR 场景下省掉「等 HTML 首字节」这段时间。Nginx / Cloudflare / Fastly 均已支持。

### 7.4 Speculation Rules

```html
<script type="speculationrules">
{
  "prerender": [{
    "where": { "href_matches": "/product/*" },
    "eagerness": "moderate"
  }]
}
</script>
```

浏览器在空闲时完整预渲染目标页面（含执行 JS），点击时直接显示。代价是 CPU、内存与流量，需限定范围。它取代了已废弃的 `<link rel="prerender">`。

---

## 8. CDN 怎么用才有效

### 8.1 CDN 优化的是哪几段

| 环节 | 作用 |
|---|---|
| DNS | 智能解析到最近节点 |
| TCP/TLS | 与边缘节点建连，RTT 远小于到源站 |
| 传输 | 边缘命中缓存则 0 回源，响应体就近返回 |
| 服务端 | 未命中时回源；边缘还可做压缩、图片处理、协议转换 |

核心是把「用户到源站」的长链路换成「用户到边缘」的短链路，降低的主要是 RTT 与回源带宽。

### 8.2 命中率是核心指标

| 提高命中率的手段 | 说明 |
|---|---|
| URL 稳定 | 别加随机 query（`?t=timestamp`），否则每次都 miss |
| 合理的缓存头 | 边缘按 `s-maxage` 或 `max-age` 缓存 |
| 忽略无关 query | 如 `utm_*` |
| 预热 | 发版后把热点资源推到边缘 |
| 分层缓存 | L1 边缘 + L2 区域 |
| 动态加速 | API 走路由优化与长连接回源，而不是缓存 |

命中率低时，CDN 只是多了一跳。

### 8.3 发版时的 CDN 陷阱

| 陷阱 | 后果 | 解法 |
|---|---|---|
| 只刷 CDN，入口 HTML 仍是旧版 | 用户拿不到新资源清单 | 入口 HTML 设 `no-cache`，让它天然回源 |
| 新旧资源不同步 | 旧 HTML 引用已删除的旧 JS → 404 | 发版期间保留上一版本资源（灰度/双版本共存） |
| 目录刷新慢 | 用户短时间看到新旧混合 | URL 刷新核心文件 + 预热新文件 |
| 图片处理未开 | 传原图，浪费带宽 | 边缘按需缩放与转格式（`?w=400&fm=webp`） |

---

## 9. "减少请求数"在 HTTP/2 时代还成立吗

部分成立，但优先级下降，手段从「合并」改为「拆分」。

| 老结论 | 现在 |
|---|---|
| 合并 CSS/JS 减少请求 | 过度合并让缓存粒度变粗（改一行全失效）；按变更频率分组 |
| 雪碧图 | 基本废弃，仅 HTTP/1.1 环境或精灵动画有意义 |
| base64 内联小图 | 谨慎；小于 2KB 可内联，但会增大 HTML 且无法单独缓存 |
| 域名分片 | 反向优化 |
| iconfont | 仍有价值（一个字体替代几十个图标），SVG symbol sprite 更灵活 |
| 减少第三方脚本 | 依然重要；第三方脚本是主线程成本，与 HTTP 版本无关 |

HTTP/2 消除的是「请求数带来的并发成本」，不改变总字节数与主线程执行成本。优化重点因此转向按需加载、缓存粒度与减少执行成本。

---

## 10. 常见坑

| 坑 | 纠正 |
|---|---|
| 静态资源文件名无 hash 却配一年缓存 | 内容更新后用户长期拿不到新版本 |
| 字体 `preload` 不加 `crossorigin` | 下载两份，比不 preload 更慢 |
| `preconnect` 开一堆 | Chrome 建议 ≤ 4 个，多了抢占 socket 与 CPU |
| `preload` 了不用 | 占高优先级带宽，拖慢关键资源 |
| CDN 上的 URL 带随机 query | 命中率归零 |
| 只刷 CDN 不处理入口 HTML | 用户卡在旧版本 |
| `gzip_min_length` 没设 | 压缩几十字节的文件纯浪费 CPU |

---

## 11. 答题模板（/ 题 3）

### 11.1 题 1「优化有哪些方式」

按资源从服务器到屏幕的路径分五段，每段给手段与它砍掉的成本：

1. **建连**：`dns-prefetch` / `preconnect`（≤4 个）；HTTP/2 或 HTTP/3 省掉并发排队。
2. **传输**：brotli 压缩；CDN 就近接入并提高命中率。
3. **缓存**：hash 资源一年 `immutable`；入口 HTML `no-cache`；Service Worker 做 HTTP 缓存表达不了的策略。
4. **加载量**：按路由代码分割、tree-shaking、第三方脚本延后。
5. **解析与渲染**：关键 CSS 内联、脚本 defer、减少重排重绘、长列表虚拟化；工程上加性能预算与 RUM。

### 11.2 题 3「从网络、渲染、缓存三方面讲」

1. **网络**：成本模型（DNS + TCP + TLS 的 RTT）→ `preconnect` → HTTP/2 多路复用 → CDN → brotli → 按路由拆包。
2. **渲染**：减少重排重绘、transform/opacity 只走合成、长列表虚拟滚动、图片预留尺寸防 CLS。
3. **缓存**：强缓存 0 请求 vs 协商 1 RTT；`immutable` 省掉刷新验证；入口 HTML 不缓存；SWR 与 Service Worker 策略。
4. **指标**：网络与缓存主要影响 LCP 与带宽成本；INP 靠渲染层与运行时优化。

---

## 12. 追问表

| 追问 | 要点 |
|---|---|
| `no-cache` 和 `no-store` 区别？ | 前者缓存但每次验证，后者完全不存 |
| 强缓存和协商缓存谁优先？ | 先判强缓存是否新鲜，不新鲜才走协商 |
| 304 有开销吗？ | 有，一次 RTT + 服务端判断；能强缓存就别只做协商 |
| `immutable` 解决什么？ | 刷新页面时的无谓协商请求 |
| `index.html` 为什么不能强缓存？ | 它是资源清单，缓存了就拿不到新 hash 的资源 |
| 为什么静态资源要带 hash？ | 内容变则 URL 变，可设长期缓存；否则只能短缓存 |
| HTTP/2 解决了什么？ | 单连接多路复用、HPACK、二进制分帧；TCP 层仍有队头阻塞 |
| HTTP/3 为什么用 UDP？ | 绕开 TCP 层队头阻塞；QUIC 在用户态实现可靠传输与 0-RTT |
| 服务器推送为什么被废弃？ | 无法感知浏览器缓存、优先级难控；Chrome 106 起默认关闭 |
| `preload` 和 `prefetch` 区别？ | preload 当前页高优先级；prefetch 下一页低优先级空闲下载 |
| `preconnect` 和 `dns-prefetch` 区别？ | 前者含 DNS+TCP+TLS，后者只 DNS；前者成本高，慎用数量 |
| 字体为什么要 `crossorigin`？ | 字体请求走 CORS 模式，不加会缓存未命中而重复下载 |
| CDN 命中率怎么提？ | 稳定 URL、合理缓存头、预热、忽略无关参数、分层缓存 |
| brotli 为什么比 gzip 好？ | 内置静态字典、上下文建模更强；代价是压缩更慢 |
| 为什么小文件不压缩？ | gzip 固定封装开销（头 + 尾）约 18 字节，加 CPU 成本高于收益 |
| Service Worker 能优化首屏吗？ | 首次不能（注册后下次才接管），优化的是二次访问与弱网 |
| 103 状态码是什么？ | Early Hints，服务端在算 HTML 前先发 preload 提示 |

---

## 13. 速记卡

```
【成本】
DNS + TCP(1RTT) + TLS(1~2RTT) + 传输 + 服务端
新域名首次额外 ≈ 2~4 RTT，与带宽无关

【四个「预」】
dns-prefetch  只解析 DNS
preconnect    DNS+TCP+TLS，≤4 个
preload       当前页高优先级下载（字体必带 crossorigin）
prefetch      下一页低优先级空闲下载

【HTTP】
1.1：6 并发 + 响应按序 → 合并、雪碧图、域名分片
2：多路复用 + HPACK，TCP 层仍阻塞 → 拆分取代合并
3：QUIC over UDP，stream 独立重传，0-RTT，连接迁移

【压缩】
brotli 优于 gzip；静态预压，动态低级别；<1KB、图片、字体不压

【缓存】
强缓存命中 0 请求 / 协商命中 1 RTT
hash 资源 → max-age=31536000, immutable
index.html → no-cache；私有/敏感 → private, no-store
Vary 按编码、语言、Origin 声明

【CDN】
价值 = 缩短 RTT + 边缘命中；核心指标 = 命中率
命中率杀手 = URL 带随机 query
发版 = 保留上一版本 + HTML 回源 + 预热
```
