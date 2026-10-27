# 网络 · 08 HTTP 缓存

> 覆盖：强缓存、协商缓存、缓存位置、刷新行为与静态资源策略

---

## 目录

- [8.1 一句话结论](#81-一句话结论)
- [8.2 完整判定流程（这张图必须能画出来）](#82-完整判定流程这张图必须能画出来)
- [8.3 强缓存：`Cache-Control` 与 `Expires`](#83-强缓存cache-control-与-expires)
- [8.4 协商缓存：`ETag` 与 `Last-Modified`](#84-协商缓存etag-与-last-modified)
- [8.5 强缓存 vs 协商缓存：一张总表](#85-强缓存-vs-协商缓存一张总表)
- [8.6 缓存存在哪儿（缓存位置）](#86-缓存存在哪儿缓存位置)
- [8.7 用户行为对缓存的影响（高频细节题）](#87-用户行为对缓存的影响高频细节题)
- [8.8 实战配置：三类资源三种策略](#88-实战配置三类资源三种策略)
- [8.9 六个真实故障与排查（L5 层次的答案）](#89-六个真实故障与排查l5-层次的答案)
- [8.10 常见坑](#810-常见坑)
- [8.11 答题模板](#811-答题模板)
- [8.12 速记卡](#812-速记卡)

---

## 8.1 一句话结论

浏览器缓存分两级：**强缓存**（`Cache-Control` / `Expires`）命中时不发请求，直接读本地；未命中或已过期，再走**协商缓存**（`ETag` / `Last-Modified`），发请求但只传头，服务器判定未变返回 **304**，无响应体，继续用本地。

---

## 8.2 完整判定流程（这张图必须能画出来）

```
                     发起请求
                        │
                        ▼
        ┌───────────────────────────────┐
        │ 1. 查强缓存                    │
        │    Cache-Control: max-age=N   │
        │    （或 Expires）              │
        └───────┬───────────────┬───────┘
                │               │
          未过期 │               │ 已过期 / no-cache / 没有缓存
                ▼               ▼
        ┌──────────────┐   ┌──────────────────────────┐
        │ 直接用本地缓存 │   │ 2. 查协商缓存              │
        │ 200 (from    │   │    带 If-None-Match       │
        │  disk cache) │   │    或 If-Modified-Since   │
        │ ★ 不发请求    │   └──────┬───────────┬───────┘
        └──────────────┘          │           │
                            未修改 │           │ 已修改 / 没有缓存
                                  ▼           ▼
                          ┌────────────┐  ┌──────────────┐
                          │ 304        │  │ 200          │
                          │ Not Modified│ │ 返回新资源    │
                          │ ★ 无响应体  │  │ 并更新缓存    │
                          │ 用本地缓存  │  └──────────────┘
                          └────────────┘
```

| 情况 | 网络成本 | 省了什么 |
|---|---|---|
| **强缓存命中** | **0 字节，0 RTT** | 整个请求（连接复用时连 DNS/TCP 都不发生） |
| **协商缓存命中（304）** | 请求头 + 响应头，**1 RTT** | 响应体 |
| **完全未命中** | 完整请求 + 响应 | — |

**304 仍要走一次完整往返**，收益来自「不发请求」而不是「少传 body」；静态资源用内容 hash 文件名配长缓存，就是让请求根本不发出。

---

## 8.3 强缓存：`Cache-Control` 与 `Expires`

### 8.3.1 两个头，一个赢家

| 头 | 版本 | 值 | 优先级 |
|---|---|---|---|
| **`Cache-Control`** | HTTP/1.1 | 相对时间 + 指令（`max-age=3600`） | **更高** |
| `Expires` | HTTP/1.0 | 绝对时间（`Thu, 01 Dec 2026 16:00:00 GMT`） | 更低 |

`Cache-Control` 优先：`Expires` 用服务器绝对时间，客户端时钟不准会提前失效或永不失效；`max-age` 是相对时间。现代实践只写 `Cache-Control`。

### 8.3.2 `Cache-Control` 指令表

#### 时间类

| 指令 | 含义 | 备注 |
|---|---|---|
| **`max-age=N`** | 资源在 **N 秒**内新鲜（强缓存） | 从响应生成时间算起 |
| **`s-maxage=N`** | 同上，只对共享缓存（CDN、代理）生效 | 优先级高于 `max-age`，浏览器忽略它 |
| `stale-while-revalidate=N` | 过期后 N 秒内先用旧副本，同时后台更新 | 用户不等，可能看到略旧内容 |
| `stale-if-error=N` | 上游出错时 N 秒内继续用旧缓存 | 后端故障时页面仍可打开 |

#### 开关类（最容易混的三个）

| 指令 | 能否缓存 | 使用前验证 | 一句话 |
|---|---|---|---|
| **`no-store`** | 完全不写 | — | 不存（敏感数据、token） |
| **`no-cache`** | 可以存 | 每次必须验证 | 可以存，但用之前问服务器 |
| `must-revalidate` | 可以存 | 过期后必须验证 | 过期后不许用旧副本 |

`no-cache` 的名字有误导：响应仍会写入本地缓存，只是每次使用前必须验证；`no-store` 才是连写都不写。敏感数据用 `no-store`。

#### 范围类

| 指令 | 含义 |
|---|---|
| **`public`** | 共享缓存（CDN、代理）也能存 |
| **`private`** | 只有浏览器能存，共享缓存不能存 |

#### 特殊类

| 指令 | 含义 | 什么时候用 |
|---|---|---|
| **`immutable`** | 有效期内内容不变，浏览器不再发条件请求，刷新也不验证 | 带内容 hash 的 JS/CSS |
| `no-transform` | 禁止代理修改内容（压缩图片、转码） | 图片、视频 |

`immutable` 的前提是文件名带内容 hash：内容一变 URL 就变，旧 URL 才敢声明「永不改变」。

### 8.3.3 一条完整的静态资源响应头

```http
HTTP/1.1 200 OK
Content-Type: application/javascript
Cache-Control: public, max-age=31536000, immutable
ETag: "a1b2c3d4"
```

`max-age` 与 `ETag` 可以并存：有效期内不发请求；过期后重新验证时，`ETag` 让服务器只回 304。

---

## 8.4 协商缓存：`ETag` 与 `Last-Modified`

### 8.4.1 两对头

| 响应头（服务器给） | 请求头（浏览器下次带） | 比较什么 |
|---|---|---|
| **`Last-Modified`** | **`If-Modified-Since`** | 文件修改时间 |
| **`ETag`** | **`If-None-Match`** | 文件内容指纹 |

**完整交互**：

```
① 首次
   GET /app.js → 200 OK
   Last-Modified: Wed, 21 Oct 2026 07:28:00 GMT
   ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"

② 再次（强缓存已过期）
   GET /app.js
   If-None-Match: "33a64df551425fcc55e4d42a148795d9f25f89d4"
   If-Modified-Since: Wed, 21 Oct 2026 07:28:00 GMT
   ← 304 Not Modified（无响应体）

③ 内容已变
   ← 200 OK + 新内容 + 新 ETag
```

### 8.4.2 优先级：`ETag` 赢

**同时存在时 `ETag` / `If-None-Match` 优先，`If-Modified-Since` 被忽略。**

| 验证器 | 缺陷 |
|---|---|
| **`Last-Modified`** | 只有秒级精度，1 秒内多次修改无法区分 |
| | 内容没变但 mtime 变了（重新部署、`touch`、`cp -p` 失败），导致无谓重下 |
| | 多机 mtime 不同步，同一资源的时间不一致 |
| **`ETag`** | 服务器要计算 |
| | 默认实现未必是内容 hash，多机可能不一致（见 8.4.4） |
| | 有强弱之分（见 8.4.3） |

### 8.4.3 强 ETag vs 弱 ETag

```http
ETag: "abc123"        ← 强 ETag：字节级完全相同
ETag: W/"abc123"      ← 弱 ETag（Weak）：语义等价，可能有细微差异
```

| 类型 | 含义 | 什么时候用 |
|---|---|---|
| **强 ETag** | 每一个字节都相同 | 静态文件（JS/CSS/图片） |
| **弱 ETag**（`W/` 前缀） | 语义等价（压缩级别、空白差异） | 动态内容（HTML、API 响应） |

`If-None-Match` 用弱比较：`W/"abc"` 与 `"abc"` 视为同一个验证器，匹配即 304。强比较用于 `If-Match` 与 `If-Range`。

### 8.4.4 一个重要的实践细节：Nginx 的 ETag

Nginx 默认的 `ETag` 不是内容 hash，而是 `"<mtime 十六进制>-<文件大小十六进制>"`。

多机部署时若文件 mtime 不同，同一内容会得到不同 ETag，缓存反复失效。

处理方式：

1. `etag off`，只靠 `Last-Modified`
2. 在 CDN 层统一改写 ETag
3. 静态资源用内容 hash 文件名，不依赖协商缓存

---

## 8.5 强缓存 vs 协商缓存：一张总表

| 维度 | 强缓存 | 协商缓存 |
|---|---|---|
| **相关头** | `Cache-Control: max-age`、`Expires` | `ETag` / `If-None-Match`、`Last-Modified` / `If-Modified-Since` |
| **是否发请求** | ❌ 不发 | ✅ 发 |
| **状态码** | `200 (from disk cache)` / `200 (from memory cache)` | **`304 Not Modified`** |
| **响应体** | 用本地 | 空 |
| **谁判断** | 浏览器自己（看时间） | 服务器（对比内容） |
| **可控性** | 差（时间一到就过期） | 好（内容不变就一直 304） |
| **典型配置** | 带 hash 的静态资源：一年 + `immutable` | HTML、API：`no-cache` + `ETag` |

---

## 8.6 缓存存在哪儿（缓存位置）

发请求前，浏览器按这个顺序找：

```
① Service Worker
     ↓ 没命中（或没注册）
② Memory Cache（内存缓存）
     ↓ 没命中
③ Disk Cache（磁盘缓存）
     ↓ 没命中
④ Push Cache（HTTP/2 Server Push，已基本废弃）
     ↓ 没命中
发起网络请求
```

| 位置 | 特点 | 生命周期 |
|---|---|---|
| **Service Worker** | 完全由 JS 控制，可离线、可自定义策略 | 手动管理，直到被注销 |
| **Memory Cache** | 内存里，最快，页面关闭就没了 | 当前标签页 |
| **Disk Cache** | 磁盘上，持久，但读取慢 | 按 HTTP 缓存规则，或用户清缓存 |
| **Push Cache** | HTTP/2 推送的临时存储 | 会话级，几秒 |

`from memory cache` 与 `from disk cache` 的区别：内存快但随标签页销毁，磁盘持久但读取慢；同一次导航内的子资源更可能来自内存。

---

## 8.7 用户行为对缓存的影响（高频细节题）

| 用户操作 | 强缓存 | 协商缓存 | 说明 |
|---|---|---|---|
| **地址栏回车** | ✅ 生效 | ✅ 生效 | 完整走缓存 |
| **点击链接跳转** | ✅ 生效 | ✅ 生效 | 完整走缓存 |
| **前进 / 后退** | ✅ 生效 | ✅ 生效 | 可能直接用 bfcache |
| **F5 / Ctrl+R（刷新）** | ⚠️ 主文档跳过 | ✅ 生效 | 主文档请求带 `Cache-Control: max-age=0`，强制重新验证；页面内仍新鲜的子资源继续命中 |
| **Ctrl+F5 / Ctrl+Shift+R（强制刷新）** | ❌ 跳过 | ❌ 也跳过 | 带 `no-cache` + `Pragma: no-cache`，不带 `If-None-Match` / `If-Modified-Since`，必定 200 完整内容 |
| **关闭标签页再打开** | ✅ 生效 | ✅ 生效 | 看 Disk Cache |
| **禁用缓存（DevTools）** | ❌ | ❌ | 只在 DevTools 打开时生效 |

F5 只强制重新验证主文档，页面内仍新鲜的子资源不受影响。开发者刷新看到新版本、用户点击仍是旧页面，常见来源是入口 HTML 被强缓存。

---

## 8.8 实战配置：三类资源三种策略

### 8.8.1 三类资源分类

| 资源类型 | 例子 | 特点 | 策略 |
|---|---|---|---|
| **① 入口 HTML** | `index.html` | 文件名不能带 hash（要被人直接访问） | **`no-cache`**（每次验证） |
| **② 带 hash 的静态资源** | `app.a1b2c3.js`、`style.d4e5f6.css` | 内容变 → 文件名变 | **`max-age=31536000, immutable`** |
| **③ 不带 hash 的静态资源** | `logo.png`、`favicon.ico` | 文件名固定 | 中等 `max-age` + `ETag` |

### 8.8.2 Nginx 配置模板

```nginx
# ① 入口 HTML：允许缓存，但每次使用前验证
location = /index.html {
    add_header Cache-Control "no-cache";
}

# ② 带 hash 的静态资源：一年强缓存 + immutable
location ~* \.(js|css|woff2?|ttf|eot)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    # 文件名必须带内容 hash，否则发版不生效
}

# ③ 图片等：中等缓存
location ~* \.(png|jpe?g|gif|webp|avif|svg|ico)$ {
    add_header Cache-Control "public, max-age=604800";   # 7 天
}
```

### 8.8.3 为什么 `index.html` 绝对不能强缓存

入口 HTML 一旦被强缓存，发版后用户仍会拿到旧 HTML，其中引用的旧 hash 文件已被删除 → 404 → 白屏。

```
index.html  → no-cache（每次向服务器验证）
            → 内容变了：200 + 新 HTML，引用 app.NEW.js
app.NEW.js  → 新文件名，缓存里没有 → 下载
app.OLD.js  → 缓存里还在，但不再被引用 → 自然淘汰
```

用「入口不缓存」换「其余资源可长期缓存」。

### 8.8.4 hash 的三种类型（webpack/vite）

| hash 类型 | 变化条件 | 适用 |
|---|---|---|
| `[hash]` | 整个构建变化就变（所有文件 hash 一起变） | ❌ 不推荐（改一个文件全部失效） |
| `[chunkhash]` | 按 chunk 变化 | webpack 常用 |
| **`[contenthash]`** | 按文件内容变化 | ✅ 推荐（最精确的缓存粒度） |

```js
// webpack
output: {
  filename: '[name].[contenthash:8].js',
  chunkFilename: '[name].[contenthash:8].chunk.js',
}
```

```js
// vite：`[hash]` 基于内容
build: {
  rollupOptions: {
    output: {
      entryFileNames: 'assets/[name]-[hash].js',
      chunkFileNames: 'assets/[name]-[hash].js',
    },
  },
}
```

---

## 8.9 六个真实故障与排查（L5 层次的答案）

### 8.9.1 「发版后用户看到旧页面」

| 步骤 | 检查 |
|---|---|
| 1 | `index.html` 的 `Cache-Control` 是不是长 `max-age`？→ 改 `no-cache` |
| 2 | CDN 是否缓存了 `index.html`？→ 刷新 CDN，或配置 CDN 不缓存 HTML |
| 3 | 文件名有没有带 hash？→ 没带就必须配 `no-cache` |
| 4 | Service Worker 是否缓存了旧版本？→ 检查 `skipWaiting` / `clients.claim` |

### 8.9.2 「改了 JS 但页面还是旧的」

JS 文件名没变（`app.js` 而不是 `app.a1b2c3.js`），浏览器仍在用旧缓存。改用 contenthash；`?v=` 只是临时方案（见 8.10）。

### 8.9.3 「CDN 上的资源和源站不一致」

CDN 节点缓存了旧版本，或源站更新后 CDN 没刷新。处理：发版时主动刷新 CDN；文件名带 hash（新 URL 必然回源）；CDN 遵循源站的 `Cache-Control`，不要覆盖。

### 8.9.4 「304 太多导致接口慢」

API 配了 `ETag`，每次请求都 304，但 304 仍要 1 RTT。实时性要求低的接口用短 `max-age`（如列表 5 秒），否则用 `no-store`。

### 8.9.5 「跨域请求拿到了其他站点的缓存」

CDN 或代理缓存了响应，却没有 `Vary: Origin`，A 站的 CORS 响应被返回给 B 站。CORS 响应必须加 `Vary: Origin`。

### 8.9.6 「用户登出后又看到上一个用户的数据」

接口或页面被缓存了。用户私有数据用 `Cache-Control: private, no-store`；登出时清空 Service Worker 缓存。

---

## 8.10 常见坑

| 坑 | 正确说法 |
|---|---|
| 静态资源不带 hash 却配一年强缓存 | 内容更新后文件名不变，用户长期拿不到新版本 |
| 带 hash 却只配 `max-age=3600` | 浪费了 hash 的缓存价值，应配一年 + `immutable` |
| 认为 `ETag` 一定优于 `Last-Modified` | ETag 有计算成本；Nginx 默认 ETag 是 mtime + size，多机 mtime 不同仍会失效 |
| 用 `app.js?v=2` 做版本控制 | 部分 CDN 忽略 query string，必须改文件名 |

---

## 8.11 答题模板

### 30 秒版

- **判定链**：先查强缓存（`Cache-Control: max-age` / `Expires`），新鲜就直接用本地、不发请求；否则带 `If-None-Match` / `If-Modified-Since` 验证，未变回 304、无响应体。
- **成本**：强缓存省整个请求；协商缓存省响应体，304 仍是一次完整 RTT。
- **落地**：入口 HTML `no-cache`；带内容 hash 的 JS/CSS 配 `max-age=31536000, immutable`。

### 2 分钟版（完整版，含实战）

- **判定流程**：强缓存 → 协商缓存 → 回源（8.2 的图）。
- **强缓存**：`Cache-Control` 优先于 `Expires`；指令边界见 8.3.2，常考 `no-cache` 与 `no-store` 的区别、`s-maxage` 只对共享缓存。
- **协商缓存**：`ETag` 优先于 `Last-Modified`；`Last-Modified` 的秒级精度与多机 mtime 问题见 8.4.2。
- **实战**：HTML 不缓存、hash 资源长缓存、非 hash 图片中等缓存；发版异常按 8.9.1 四步排查。
- **刷新**：F5 只强制验证主文档，Ctrl+F5 连条件头都不带（8.7）。

---

## 8.12 速记卡

```
两级
  强缓存：不发请求，200 (from cache)  ← 省整个请求
  协商缓存：带条件头，304 无 body     ← 省响应体，仍有 1 RTT

优先级
  Cache-Control > Expires（相对 > 绝对）
  s-maxage > max-age（仅共享缓存）
  ETag / If-None-Match > Last-Modified / If-Modified-Since

易错
  no-cache 存但每次验证 / no-store 不存
  304 有 RTT 无 body / from cache 无请求
  If-None-Match 用弱比较：W/"x" 与 "x" 等价
  Nginx ETag = mtime-size，不是内容 hash

配置
  index.html → no-cache
  [hash].js → max-age=31536000, immutable
  图片 → max-age=604800 + ETag

刷新
  F5：主文档 max-age=0，子资源按自身新鲜度
  Ctrl+F5：no-cache + 不带条件头

发版不生效
  HTML 强缓存 → CDN 缓存 HTML → 文件名无 hash → SW 旧版
```
