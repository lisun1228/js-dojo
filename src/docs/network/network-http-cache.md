# 网络 · 08 HTTP 缓存（题 8、10、20、23、35、38、40、43、58、60、62、65、69）

> 本册覆盖：强缓存、协商缓存、缓存全过程（原题 8、10、20、23、35、38、40、43、58、60、62、65、69，**被问 13 次，是本题单重复最多的知识点**）
> 面试官问这么多次，说明他认为**这是前端的分内事**。这块答不好，其他答得再花哨也会被判定「基础不牢」。
> 本册的目标：让你能画出完整判定流程、说清每个指令的边界、并且能解释「发版后用户看到旧页面」这种真实故障。

---

## 8.1 一句话结论

浏览器缓存分两层：**强缓存**（`Cache-Control` / `Expires`，命中就**不发请求**，直接用本地）→ **协商缓存**（`ETag` / `Last-Modified`，**发请求但只传头**，服务器说「没变」就返回 **304** 用本地）。
**核心判据只有一句话：强缓存省的是「请求」，协商缓存省的是「响应体」。**

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

**三层成本对比**（这是理解缓存价值的关键）：

| 情况 | 网络成本 | 省了什么 |
|---|---|---|
| **强缓存命中** | **0 字节，0 RTT** | 省了**整个请求**（连 DNS/TCP 都不用，如果连接还在） |
| **协商缓存命中（304）** | 请求头 + 响应头，**1 RTT** | 省了**响应体**（大文件能省几百 KB） |
| **完全未命中** | 完整请求 + 响应 | — |

> **关键认知：304 是要走一次完整往返的**。所以「强缓存」的价值远大于「协商缓存」。这就是为什么静态资源要用「内容 hash 文件名 + 一年强缓存」——让请求根本不发出去。

---

## 8.3 强缓存：`Cache-Control` 与 `Expires`

### 8.3.1 两个头，一个赢家

| 头 | 版本 | 值 | 优先级 |
|---|---|---|---|
| **`Cache-Control`** | HTTP/1.1 | 相对时间 + 指令（`max-age=3600`） | **更高** |
| `Expires` | HTTP/1.0 | **绝对时间**（`Thu, 01 Dec 2026 16:00:00 GMT`） | 更低 |

**为什么 `Cache-Control` 优先**：`Expires` 用的是**服务器绝对时间**，如果客户端时钟不准（比如用户手动改了系统时间），缓存就会失效或永不失效。`max-age` 是相对时间，不受时钟影响。

```http
Cache-Control: max-age=31536000
Expires: Thu, 01 Dec 2027 16:00:00 GMT
    ↑ 同时存在时，Cache-Control 生效，Expires 被忽略
```

> 现代实践：**只写 `Cache-Control`，不写 `Expires`**（除非要兼容极老的客户端）。

### 8.3.2 `Cache-Control` 全指令表（必须掌握）

#### 时间类

| 指令 | 含义 | 备注 |
|---|---|---|
| **`max-age=N`** | 资源在 **N 秒**内是新鲜的（强缓存） | 从**响应生成时间**算起，不是从收到算起 |
| **`s-maxage=N`** | 同上，但**只对共享缓存**（CDN、代理）生效 | **优先级高于 `max-age`**；浏览器会忽略它 |
| `stale-while-revalidate=N` | 过期后 N 秒内，**先用旧的同时后台异步更新** | 体验极好：用户永远不等，代价是可能看到略旧的内容 |
| `stale-if-error=N` | 上游出错时，N 秒内**继续用旧缓存** | 容灾神器：后端挂了页面还能打开 |

#### 开关类（最容易混的三个）

| 指令 | 能否缓存 | 每次用之前要验证吗 | 一句话 |
|---|---|---|---|
| **`no-store`** | **完全不缓存** | — | 「**别存**」（敏感数据、token） |
| **`no-cache`** | ✅ **可以缓存** | ✅ **每次必须验证** | 「**可以存，但用之前问我**」 |
| `must-revalidate` | ✅ 可以缓存 | 过期后必须验证，**不允许用过期副本** | 「过期了就不能凑合用」 |

> **`no-cache` vs `no-store` 是最高频的追问，务必说清**：
> - `no-cache` **会**存到本地磁盘/内存，只是**每次使用前都要发请求验证**（走协商缓存）。名字里的 "no-cache" 是历史遗留的误导。
> - `no-store` **真的什么都不存**，连磁盘缓存都不写。用于**敏感数据**（银行流水、token、个人信息）。

#### 范围类

| 指令 | 含义 |
|---|---|
| **`public`** | 任何缓存都能存（包括 CDN、代理等共享缓存） |
| **`private`** | **只有浏览器**能存，CDN/代理不能存（默认值，针对用户私有数据） |

#### 特殊类

| 指令 | 含义 | 什么时候用 |
|---|---|---|
| **`immutable`** | 资源**永远不会变**，浏览器**连条件请求都不发**（刷新也不发） | **带内容 hash 的 JS/CSS**（`app.a1b2c3.js`） |
| `no-transform` | 禁止代理修改内容（比如压缩图片、转码） | 图片、视频 |

**`immutable` 到底省了什么？**

```
没有 immutable：
  用户按 F5 → 浏览器发条件请求 → 304 → 用本地
  仍然是一次 RTT

有 immutable：
  用户按 F5 → 浏览器直接用本地，不发请求
  0 RTT
```

**这就是为什么「hash 文件名 + `max-age=31536000, immutable`」是现代静态资源的最佳实践。**

### 8.3.3 一条完整的静态资源响应头

```http
HTTP/1.1 200 OK
Content-Type: application/javascript
Cache-Control: public, max-age=31536000, immutable
ETag: "a1b2c3d4"
```

**注意这里 `max-age` 和 `ETag` 同时存在**：
- 正常情况下 `max-age` 生效，一年内不请求
- 如果用户强制刷新（Ctrl+F5），`ETag` 还能救一下——服务器对比后回 304，省下传输

---

## 8.4 协商缓存：`ETag` 与 `Last-Modified`

### 8.4.1 两对头

| 响应头（服务器给） | 请求头（浏览器下次带） | 比较什么 |
|---|---|---|
| **`Last-Modified`** | **`If-Modified-Since`** | 文件**修改时间** |
| **`ETag`** | **`If-None-Match`** | 文件**内容指纹** |

**完整交互**：

```
① 首次
   GET /app.js
   ← 200 OK
     Last-Modified: Wed, 21 Oct 2026 07:28:00 GMT
     ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"

② 再次（强缓存已过期）
   GET /app.js
   If-None-Match: "33a64df551425fcc55e4d42a148795d9f25f89d4"
   If-Modified-Since: Wed, 21 Oct 2026 07:28:00 GMT
   ← 304 Not Modified          ← 无响应体
     ETag: "33a64df..."        ← 可以更新 ETag

③ 内容变了
   ← 200 OK
     ETag: "新的hash"
     （新内容）
```

### 8.4.2 优先级：`ETag` 赢

**同时存在时，`If-None-Match` / `ETag` 优先，`If-Modified-Since` 被忽略。**

**为什么 ETag 更可靠**：

| `Last-Modified` 的三个缺陷 | 说明 |
|---|---|
| **只有秒级精度** | 1 秒内改了多次，浏览器无法识别 |
| **内容没变但时间变了** | 重新部署、`touch` 文件、`cp -p` 失败都会改 mtime，导致**无谓的重新下载** |
| **分布式环境时间不同步** | 多台服务器 mtime 不一致，同一资源在不同机器上 ETag/时间不同，缓存反复失效 |

| `ETag` 的缺陷 | 说明 |
|---|---|
| **要计算** | 服务器要读文件算 hash 或读 inode/mtime/size（Nginx 默认用后者，不是真 hash） |
| **分布式不一致** | Nginx 默认的 ETag 是 `"inode-mtime-size"`，多机部署时 inode 不同 → ETag 不同 → 缓存失效 |
| **强/弱之分** | 见下 |

### 8.4.3 强 ETag vs 弱 ETag

```http
ETag: "abc123"        ← 强 ETag：字节级完全相同
ETag: W/"abc123"      ← 弱 ETag（Weak）：语义等价，但可能有细微差异
```

| 类型 | 含义 | 什么时候用 |
|---|---|---|
| **强 ETag** | **每一个字节都相同** | 静态文件（JS/CSS/图片） |
| **弱 ETag**（`W/` 前缀） | **语义上等价**（比如压缩级别不同、空白差异） | 动态内容（HTML、API 响应） |

**判断规则**：如果请求带 `If-None-Match: "abc"`，服务器只有**强 ETag** 完全相同才回 304；如果是弱 ETag，只要语义等价就回 304。

### 8.4.4 一个重要的实践细节：Nginx 的 ETag

**Nginx 默认的 `ETag` 不是内容 hash**，而是：

```
ETag: "<文件的 inode>-<修改时间>-<大小>"
```

**后果**：多台服务器（inode 不同）返回的 ETag 不同 → 用户在不同机器间切换时缓存失效。

**解决方案**：
1. **静态资源用内容 hash 文件名 + `immutable`**（根本不需要协商）
2. 用 `etag off` 关掉，只靠 `Last-Modified`
3. 在 CDN 层统一处理 ETag

---

## 8.5 强缓存 vs 协商缓存：一张总表

| 维度 | 强缓存 | 协商缓存 |
|---|---|---|
| **相关头** | `Cache-Control: max-age`、`Expires` | `ETag` / `If-None-Match`、`Last-Modified` / `If-Modified-Since` |
| **是否发请求** | ❌ **不发** | ✅ **发** |
| **状态码** | `200 (from disk cache)` / `200 (from memory cache)` | **`304 Not Modified`** |
| **响应体** | 用本地 | **空**（304 没有 body） |
| **省了什么** | **省整个请求**（0 RTT） | 省**响应体**（1 RTT 还在） |
| **谁判断** | **浏览器自己**（看时间） | **服务器**（对比内容） |
| **可控性** | 差（时间一到就过期） | 好（内容不变就一直 304） |
| **典型配置** | 带 hash 的静态资源：一年 + `immutable` | HTML、API：`no-cache` + `ETag` |

**一句话记忆**：

> **强缓存 = 「别问了，直接用」**
> **协商缓存 = 「问一句，没变就用」**

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
| **Memory Cache** | 内存里，**最快**，但**页面关闭就没了** | 当前标签页 |
| **Disk Cache** | 磁盘上，**持久**，但读取慢 | 按 HTTP 缓存规则，或用户清缓存 |
| **Push Cache** | HTTP/2 推送的临时存储 | 会话级，几秒 |

**Memory vs Disk 的实际表现**：

- **同一次导航内的资源**（比如 JS 动态 import 的 chunk）→ 常在 Memory Cache
- **跨页面、重新打开** → Disk Cache
- **HTML 通常不进 Memory Cache**（因为要频繁验证）

> 面试时如果被问「`from memory cache` 和 `from disk cache` 有什么区别」，答：**内存缓存快但生命周期短（标签页级），磁盘缓存慢但持久；同一次会话内的资源更可能在内存里**。

---

## 8.7 用户行为对缓存的影响（高频细节题）

**这是「知不知道细节」的分水岭。**

| 用户操作 | 强缓存 | 协商缓存 | 说明 |
|---|---|---|---|
| **地址栏回车** | ✅ 生效 | ✅ 生效 | 完整走缓存 |
| **点击链接跳转** | ✅ 生效 | ✅ 生效 | 完整走缓存 |
| **前进 / 后退** | ✅ 生效 | ✅ 生效 | 甚至可能直接用 bfcache（往返缓存） |
| **F5 / Ctrl+R（刷新）** | ❌ **跳过** | ✅ 生效 | 请求会带 `Cache-Control: max-age=0`，强制重新验证 |
| **Ctrl+F5 / Ctrl+Shift+R（强制刷新）** | ❌ 跳过 | ❌ **也跳过** | 连 `If-None-Match` 都不带，完全重新下载 |
| **关闭标签页再打开** | ✅ 生效 | ✅ 生效 | 看 Disk Cache |
| **禁用缓存（DevTools）** | ❌ | ❌ | 只在 DevTools 打开时生效 |

**为什么 F5 会跳过强缓存？**

因为用户按 F5 的语义是「**我要看最新的**」。所以浏览器在请求头里加：

```http
Cache-Control: max-age=0
```

服务器看到这个，就当「缓存已过期」，走协商缓存流程。

**Ctrl+F5 更彻底**：不仅加 `no-cache`，还**不发送 `If-None-Match` / `If-Modified-Since`**，所以服务器一定返回 200 + 完整内容。

> **这个表在排查「为什么我本地看到的是新的，用户看到的是旧的」时非常有用**——因为**开发者按 F5 会跳过强缓存，而用户是正常点击链接，会命中强缓存**。

---

## 8.8 实战配置：三类资源三种策略

**这是本册最有价值的部分——面试官问「你们项目怎么配缓存」时，就是这个答案。**

### 8.8.1 三类资源分类

| 资源类型 | 例子 | 特点 | 策略 |
|---|---|---|---|
| **① 入口 HTML** | `index.html` | **文件名不能带 hash**（因为要被人访问） | **`no-cache`**（每次验证） |
| **② 带 hash 的静态资源** | `app.a1b2c3.js`、`style.d4e5f6.css` | 内容变 → 文件名变 | **`max-age=31536000, immutable`**（一年强缓存） |
| **③ 不带 hash 的静态资源** | `logo.png`、`favicon.ico` | 文件名固定 | 中等 `max-age` + `ETag` |
| **④ 接口数据** | `/api/user` | 实时性要求高 | **`no-store`** 或 `private, max-age=0` |

### 8.8.2 Nginx 配置模板

```nginx
# ① 入口 HTML：绝对不能被强缓存！
location = /index.html {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    # 或者只写 no-cache（允许缓存但要验证，更省带宽）
    # add_header Cache-Control "no-cache";
}

# ② 带 hash 的静态资源：一年强缓存 + immutable
location ~* \.(js|css|woff2?|ttf|eot)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    # 注意：文件名必须带内容 hash，否则发版不生效
}

# ③ 图片等：中等缓存
location ~* \.(png|jpe?g|gif|webp|avif|svg|ico)$ {
    add_header Cache-Control "public, max-age=604800";   # 7 天
}

# ④ 接口：不缓存
location /api/ {
    add_header Cache-Control "no-store";
    proxy_pass http://backend;
}
```

### 8.8.3 为什么 `index.html` 绝对不能强缓存

**这是「发版不生效」故障的第一大原因，必须能讲透。**

```
假设给 index.html 配了 max-age=31536000（一年）

发版前：index.html 引用 app.OLD.js
发版后：index.html 引用 app.NEW.js

用户 A 昨天访问过 → 浏览器缓存了旧 index.html（一年有效）
今天发版 → 用户 A 打开网站
    ↓
浏览器直接用缓存里的旧 index.html（因为强缓存没过期）
    ↓
旧 index.html 引用 app.OLD.js
    ↓
app.OLD.js 已经被你从服务器删了 → 404 → 白屏
```

**所以正确做法是**：

```
index.html     → no-cache（每次都向服务器验证）
    ↓ 内容变了
200 + 新的 index.html（引用 app.NEW.js）
    ↓
app.NEW.js 是新文件名 → 缓存里没有 → 下载新的
app.OLD.js 在缓存里但不再被引用 → 自然淘汰
```

**这就是「**HTML 不缓存 + 静态资源长缓存 + 文件名带 hash**」这个组合的原理**：用「入口不缓存」换取「内容可无限缓存」。

### 8.8.4 hash 的三种类型（webpack/vite）

| hash 类型 | 变化条件 | 适用 |
|---|---|---|
| `[hash]` | **整个构建**变化就变（所有文件 hash 一起变） | ❌ 不推荐（改一个文件全部失效） |
| `[chunkhash]` | **按 chunk** 变化 | webpack 常用 |
| **`[contenthash]`** | **按文件内容**变化 | ✅ **推荐**（最精确的缓存粒度） |

```js
// webpack
output: {
  filename: '[name].[contenthash:8].js',
  chunkFilename: '[name].[contenthash:8].chunk.js',
}

// vite（内置就是 contenthash 行为）
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

**排查顺序**：

| 步骤 | 检查 |
|---|---|
| 1 | `index.html` 的响应头是不是 `max-age` 很大？→ 改成 `no-cache` |
| 2 | **CDN 是不是缓存了 `index.html`**？→ 刷新 CDN 缓存，或配 CDN 不缓存 HTML |
| 3 | 文件名有没有带 hash？→ 没带的话必须配 `no-cache` |
| 4 | **Service Worker 是不是缓存了旧版本**？→ 检查 SW 的 `skipWaiting` / `clients.claim` |
| 5 | 用户是不是按了 F5？→ F5 会跳过强缓存，所以「开发者看到新的、用户看到旧的」是正常的 |

### 8.9.2 「改了 JS 但页面还是旧的」

因为 **JS 文件名没变**（比如 `app.js` 而不是 `app.a1b2c3.js`），浏览器缓存了旧的。

**修复**：改用 contenthash；临时方案是在 URL 后加版本号 `app.js?v=2`（**但这招在 CDN 上不可靠**，因为有些 CDN 忽略 query string）。

### 8.9.3 「CDN 上的资源和源站不一致」

**原因**：CDN 节点缓存了旧版本，或者源站更新后 CDN 没刷新。

**解决**：
- 发版时**主动刷新 CDN**（阿里云/腾讯云都有 API）
- **文件名带 hash**（最可靠：新文件名 = 新 URL，CDN 一定回源）
- 配 CDN 的 `Cache-Control` 遵循源站，不要覆盖

### 8.9.4 「304 太多导致接口慢」

**原因**：API 也配了 `ETag`，每次请求都 304，看似省了带宽，但**每次都要 1 RTT**。

**解决**：接口用 `max-age` 短时间强缓存（比如列表页 5 秒），或 `no-store` 直接不缓存。

### 8.9.5 「跨域请求拿到了其他站点的缓存」

**原因**：CDN 或代理缓存了响应，但没有 `Vary: Origin`，导致 A 站的 CORS 响应被返回给 B 站。

**解决**：CORS 响应必须加 `Vary: Origin`。

### 8.9.6 「用户登出后又看到上一个用户的数据」

**原因**：接口或页面被缓存了。

**解决**：
- 用户私有数据必须 `Cache-Control: private, no-store`
- 登出时**清空 Service Worker 缓存**
- 不要用 `max-age` 缓存用户数据

---

## 8.10 常见坑

| 坑 | 正确说法 |
|---|---|
| **`no-cache` = 不缓存** | ❌ `no-cache` **会缓存**，只是每次要验证；`no-store` 才是不缓存 |
| 只配 `Expires` 不配 `Cache-Control` | `Expires` 受客户端时钟影响；现代应只用 `Cache-Control` |
| 给 `index.html` 配长 `max-age` | **发版必出事**，入口 HTML 必须 `no-cache` |
| 静态资源不带 hash 却配一年缓存 | 改了不生效 |
| 带 hash 但只配 `max-age=3600` | 浪费了 hash 的价值（应该配一年 + `immutable`） |
| 说「304 省了一次请求」 | 304 **仍然是一次完整往返**，省的是响应体 |
| 说「ETag 一定比 Last-Modified 好」 | ETag 要计算成本；Nginx 默认 ETag 是 inode+mtime，多机部署反而不一致 |
| 说「强缓存过期了就要重新下载」 | 过期后走**协商缓存**，不是直接重新下载 |
| 说「`s-maxage` 和 `max-age` 一样」 | `s-maxage` **只对共享缓存（CDN）生效**，且优先级更高 |
| 忽略 `Vary` | CORS / 多语言场景会串版本 |
| 以为开发者 F5 和用户点击行为一样 | F5 **跳过强缓存**，用户点击不会 |
| 用 `?v=1` 做版本控制就以为万无一失 | 某些 CDN 忽略 query string，必须改文件名 |

---

## 8.11 答题模板

### 30 秒版

> HTTP 缓存分强缓存和协商缓存两级。
> **强缓存**用 `Cache-Control` 的 `max-age`（老的用 `Expires`），命中就**不发请求**，直接从本地读，返回 `200 (from disk cache)`。**协商缓存**用 `ETag` / `If-None-Match` 或 `Last-Modified` / `If-Modified-Since`，会**发请求但只传头**，服务器说没变就返回 **304**，没有响应体，用本地缓存。
> 所以强缓存省的是整个请求，协商缓存省的是响应体。实际项目里，`index.html` 配 `no-cache`，带 hash 的静态资源配一年 `max-age` 加 `immutable`。

### 2 分钟版（完整版，含实战）

> 我按「判定流程 + 两层的头 + 实战配置」来讲。
>
> **判定流程**：先查强缓存，看 `Cache-Control: max-age` 有没有过期，没过期就直接用本地、不发请求；过期了或者标了 `no-cache`，就带着 `If-None-Match` 或 `If-Modified-Since` 去服务器验证，没变就返回 304、没有响应体、继续用本地，变了就返回 200 新内容。
>
> **强缓存**用 `Cache-Control`，优先级高于 HTTP/1.0 的 `Expires`，因为 `Expires` 是绝对时间、受客户端时钟影响。几个指令要分清：`max-age` 是有效期；`s-maxage` 只对 CDN 这种共享缓存生效、优先级更高；**`no-cache` 是可以缓存但每次要验证，`no-store` 才是完全不缓存**——这是最高频的坑；`immutable` 表示资源永不变，连条件请求都不发，配合 hash 文件名用；`stale-while-revalidate` 是过期后先用旧的同时后台更新，体验很好。
>
> **协商缓存**有两对头：`Last-Modified` 对 `If-Modified-Since`，`ETag` 对 `If-None-Match`。**同时存在时 ETag 优先**。原因是 `Last-Modified` 有三个缺陷：只有秒级精度、内容没变但 mtime 变了会导致无谓重下、多机时间不同步。但 ETag 也有成本——Nginx 默认的 ETag 是 `inode-mtime-size`，多机部署时 inode 不同会导致 ETag 不一致，所以静态资源最好还是别依赖协商缓存。
>
> **实战配置**分三类资源。**入口 HTML 必须 `no-cache`**，因为文件名不能带 hash，一旦强缓存，发版后用户会拿到旧 HTML、引用已经被删的旧 JS，直接白屏。**带 contenthash 的 JS/CSS 配 `max-age=31536000, immutable`**，内容变文件名就变，永不过期。**图片等不带 hash 的配中等时间加 ETag**。**接口用 `no-store` 或短 `max-age`**。
>
> 还有一个容易被问的细节：**用户行为会影响缓存**。地址栏回车和点击链接会走完整缓存；按 **F5** 会跳过强缓存（带 `Cache-Control: max-age=0`），但仍走协商；按 **Ctrl+F5** 连协商都跳过，条件头都不带，完全重新下载。这就是为什么「开发者本地看到新的、用户看到旧的」——开发者按 F5，用户是正常点击。

### 追问表

| 追问 | 回答要点 |
|---|---|
| 强缓存和协商缓存的区别 | 不发请求 vs 发请求只传头；省整个请求 vs 省响应体 |
| `no-cache` 和 `no-store` 区别 | 前者缓存但每次验证，后者完全不缓存 |
| `Cache-Control` 和 `Expires` 优先级 | `Cache-Control` 更高（相对时间不受时钟影响） |
| `ETag` 和 `Last-Modified` 优先级 | `ETag`（`If-None-Match`）优先 |
| `Last-Modified` 有什么缺陷 | 秒级精度、内容没变时间变了、多机时间不同步 |
| 强 ETag 和弱 ETag 区别 | 强 ETag 字节级相同；弱 `W/` 只需语义等价 |
| 304 有响应体吗 | 没有；但仍是一次完整 RTT |
| 304 和 200 (from cache) 区别 | 304 发了请求；from cache 没发请求 |
| 为什么 `index.html` 不能强缓存 | 发版后用户拿旧 HTML 引用已删除的旧资源 → 白屏 |
| `immutable` 有什么用 | 连条件请求都不发，刷新也不验证 |
| `s-maxage` 和 `max-age` 区别 | `s-maxage` 只对 CDN/代理生效，优先级更高 |
| memory cache 和 disk cache 区别 | 内存快但标签页关闭就没了；磁盘慢但持久 |
| F5 和 Ctrl+F5 区别 | F5 跳过强缓存走协商；Ctrl+F5 全部跳过 |
| `Vary` 有什么用 | 告诉缓存按哪些头区分版本，CORS 必须 `Vary: Origin` |
| 发版不生效怎么排查 | 查 HTML 是否被强缓存 → CDN 是否缓存 HTML → 文件名是否带 hash → SW 是否缓存旧版 |
| `[hash]` / `[chunkhash]` / `[contenthash]` 区别 | 全局 / 按 chunk / 按文件内容（推荐） |
| 用 `?v=1` 做版本号可靠吗 | 不可靠，部分 CDN 忽略 query string |

---

## 8.12 速记卡

```
两级
  强缓存：不发请求，200 (from cache)  ← 省整个请求
  协商缓存：发请求只传头，304 无 body ← 省响应体
  ★ 304 仍是一次完整 RTT

强缓存
  Cache-Control: max-age=N（相对，优先）> Expires（绝对，受时钟影响）
  s-maxage：只对 CDN/代理生效，优先级最高
  no-cache：可缓存，但每次必须验证   ← 不是「不缓存」！
  no-store：完全不缓存              ← 这个才是「不缓存」
  must-revalidate：过期后不许用旧副本
  immutable：永不变，连条件请求都不发
  stale-while-revalidate：过期后先用旧的，后台更新
  public / private：是否允许共享缓存

协商缓存
  Last-Modified ↔ If-Modified-Since（秒级、mtime 不可靠、多机不同步）
  ETag ↔ If-None-Match（优先）
  强 ETag "abc" / 弱 ETag W/"abc"（语义等价）
  Nginx 默认 ETag = inode-mtime-size → 多机不一致

缓存位置
  Service Worker → Memory（标签页级，快）→ Disk（持久，慢）→ Push（已废）

用户行为
  回车/点链接/前进后退：走完整缓存
  F5：跳过强缓存（带 max-age=0），走协商
  Ctrl+F5：全跳过，连条件头都不带
  ★ 这就是「开发者看到新的、用户看到旧的」的原因

实战配置
  index.html        → no-cache（绝对不能强缓存）
  app.[hash].js     → max-age=31536000, immutable
  logo.png          → max-age=604800 + ETag
  /api/*            → no-store 或 private, max-age=0

发版不生效排查
  ① index.html 被强缓存 ② CDN 缓存了 HTML ③ 文件名没带 hash ④ SW 缓存旧版
```
