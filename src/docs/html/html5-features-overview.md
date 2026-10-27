# HTML · 07 HTML5 新特性全景

> 本册覆盖：HTML5 新特性全景、Web Worker、WebSocket、Canvas 与 SVG
> HTML5 不是版本号，而是 WHATWG Living Standard 下持续增补的一组能力；按「语义 / 能力 / 离线 / 性能」四组归类，每组给结论与边界。

---

## 7.1 一句话结论

HTML5 是一组能力的集合，不是一个版本：WHATWG 接管后转为 Living Standard，持续演进，不存在「HTML6」。能力可归为四句：**让标签有语义、让浏览器有 API、让页面能离线、让前端能用多线程与资源提示**。

---

## 7.2 HTML5 新特性全景

### 7.2.1 答题框架

直接背 9 项清单（语义化标签、Canvas、SVG、Storage、Web Worker、WebSocket、Geolocation、input 新类型、video/audio）会丢掉结构，任意一项都可能被继续追问。固定框架是四组：

> **语义（标签）**、**能力（浏览器 API）**、**离线（存储与缓存）**、**性能（多线程与预加载）**。

每组点 2-3 个代表，最后补一个实际用过的特性收口。

### 7.2.2 第一组：语义与结构

| 特性 | 内容 |
|---|---|
| **语义化标签** | `header` `footer` `nav` `main` `article` `section` `aside` `figure` `figcaption` `time` `mark` `details`/`summary` `dialog` `hgroup` |
| **表单增强** | 新 `type`：`email` `url` `tel` `number` `range` `date` `time` `datetime-local` `month` `week` `color` `search`<br>新属性：`placeholder` `required` `pattern` `autofocus` `multiple` `min`/`max`/`step` `list`（配 `datalist`）`form`（跨表单关联）<br>约束校验：`checkValidity()` `setCustomValidity()` `reportValidity()` 与 `:valid` / `:invalid` / `:user-invalid` |
| **文档结构** | `data-*` 属性、`<template>`（`content` 是 `DocumentFragment`）、`<slot>`（Web Components 分发） |

```html
<form id="signup" novalidate>
  <input type="email" name="mail" required
         pattern=".+@company\.com$" title="必须使用公司邮箱">
  <button>提交</button>
</form>
<script>
  const form = document.getElementById('signup');
  const mail = form.elements.mail;

  // novalidate 关掉浏览器默认拦截，submit 里才能自己判
  form.addEventListener('submit', (e) => {
    if (!form.checkValidity()) {
      e.preventDefault();
      form.reportValidity();            // 触发浏览器原生气泡提示
    }
  });

  // 自定义校验：清空字符串才恢复默认校验
  mail.addEventListener('input', () => {
    mail.setCustomValidity(mail.value.includes('admin') ? '不能用 admin 作为用户名' : '');
  });
</script>
```

`pattern` 按整串匹配编译（`^(?:…)$`），`^` / `$` 可省；`type="email"` 与 `pattern` 需同时满足。移动端的主要收益是键盘类型：`email` 带 `@` 的键盘、`tel`/`number` 数字键盘；桌面端样式与提示文案各浏览器不一致，通常要自定义样式。

### 7.2.3 第二组：能力（浏览器 API）

| 特性 | 说明 |
|---|---|
| **`<video>` / `<audio>`** | 原生播放，替代 Flash；`<track>` 加载 WebVTT 字幕，`playsinline` 控制 iOS 内联播放 |
| **Canvas 2D / 内联 SVG** | 位图即时绘制 / 矢量 DOM 节点，选型见 7.5 |
| **WebGL / WebGPU** | 3D 渲染与 GPU 通用计算，WebGPU 是 WebGL 的后继 |
| **History API** | `pushState` / `replaceState` / `popstate`，SPA 路由基础 |
| **File API** | `File` / `FileReader` / `Blob`，拖拽上传与分片上传 |
| **拖放 API** | `draggable` + `dragstart` / `dragover` / `drop`，需在 `dragover` 里 `preventDefault` |
| **Clipboard API** | `navigator.clipboard.writeText()`，替代 `document.execCommand('copy')` |
| **Fullscreen API** | `requestFullscreen()`，用户手势内调用 |
| **Geolocation** | `navigator.geolocation`，需授权，且要求安全上下文 |
| **Notification** | 桌面通知，需授权 |
| **DeviceOrientation / DeviceMotion** | 陀螺仪、加速度计，需 HTTPS + 授权 |

### 7.2.4 第三组：离线与存储

| 特性 | 说明 |
|---|---|
| `localStorage` / `sessionStorage` | 同步、按源隔离、容量受实现限制；`sessionStorage` 随标签页生命周期 |
| `IndexedDB` | 异步、大容量结构化存储，支持索引与事务 |
| **Service Worker** | 拦截网络请求、离线缓存、推送；取代了 AppCache（见 7.2.6） |
| `navigator.onLine` + `online` / `offline` 事件 | 只反映网络接口状态，不代表能上网 |

`navigator.onLine` 连着 WiFi 但没有外网时仍是 `true`。要判断真实可达性，需自己请求一个极小接口（如返回 204 的 `/ping`），或直接以业务请求失败为准。

### 7.2.5 第四组：连接、线程与性能

| 特性 | 说明 | 详见 |
|---|---|---|
| **WebSocket** | 全双工长连接，HTTP Upgrade 握手 | 7.4 |
| **SSE（EventSource）** | 服务端单向推送，纯 HTTP，内置重连 | 7.4 |
| **WebRTC** | P2P 音视频与数据传输 | 音视频场景 |
| **Web Worker** | 后台线程，`postMessage` 通信 | 7.3 |
| **`requestAnimationFrame`** | 与合成帧对齐的动画回调 | 05 册 5.6 |
| **`<link rel="preload">` / `prefetch`** | 提前请求当前页 / 后续页所需资源 | 04 册 4.4 |
| **`postMessage` / `BroadcastChannel`** | 跨窗口、跨标签页通信 | 06 册 |
| **`IntersectionObserver` / `MutationObserver` / `ResizeObserver`** | 观察者 API，替代 scroll 监听与轮询 | 懒加载、虚拟列表 |

### 7.2.6 HTML5 删掉了什么

| 被移除 | 替代 |
|---|---|
| `<frame>` `<frameset>` `<noframes>` | `<iframe>` + CSS |
| `<applet>` | `<object>` / `<embed>` |
| `<center>` `<font>` `<big>` `<strike>` `<tt>` `<acronym>` | CSS |
| `<marquee>` `<blink>` | CSS 动画 |
| **AppCache**（`<html manifest>`） | Service Worker |

### 7.2.7 面试怎么答

- **顺序**：一句话总纲（四组）→ 每组两个代表 → 一个实际用过的特性收口（如 `IntersectionObserver` 做懒加载）。
- **能力组**：`video` 的常用属性是 `src` `poster` `controls` `autoplay` `muted` `loop` `preload` `playsinline`；`autoplay` 需 `muted`（或用户已与页面交互）才生效。
- **路由**：`pushState` 改路径需服务端 fallback；hash 不发请求，但 URL 带 `#`。

---

## 7.3 Web Worker

### 7.3.1 一句话回答

**Web Worker 是独立于主线程的后台线程**，用来跑计算密集型任务，避免阻塞 UI。它没有 DOM，也没有 `window`，与主线程只能通过 `postMessage` 通信（可用范围见 7.3.3）。

### 7.3.2 基本用法

```js
// main.js
const worker = new Worker('/worker.js');            // 模块脚本：{ type: 'module' }
worker.postMessage({ cmd: 'parse', data: bigText });
worker.onmessage = (e) => console.log('结果', e.data);
worker.onerror = (e) => console.error('worker 出错', e.message);
worker.terminate();                                // 用完终止，否则线程常驻
```

```js
// worker.js
self.onmessage = (e) => {
  const { cmd, data } = e.data;
  self.postMessage(heavyParse(data));              // 等价于 postMessage(...)
};
```

### 7.3.3 ★ Worker 的可见环境

| 不可用 | 原因 |
|---|---|
| `document` / `window` / `parent` / `top` | 没有 DOM 与窗口层级；全局对象是 `self`（`DedicatedWorkerGlobalScope`） |
| `alert` / `confirm` | 属于主线程 UI |
| `localStorage` / `sessionStorage` | 同步 API，跨线程共享同一份存储需全局互斥锁，规范未纳入 Worker；改用 IndexedDB |

| 可用 | 说明 |
|---|---|
| `navigator` | 子集：`userAgent` `language` `hardwareConcurrency` |
| `location` | 只读（`WorkerLocation`，给 `href` 赋值会抛 `TypeError`） |
| `fetch` / `WebSocket` / `XMLHttpRequest` | 可发网络请求，推荐 `fetch` |
| `IndexedDB` / `Cache API` | 存储 |
| `setTimeout` / `setInterval` | 定时器 |
| `atob` / `btoa` / `TextEncoder` / `TextDecoder` | 编解码 |
| `crypto` | 加密与随机数 |
| `importScripts()` | 加载其它脚本（classic worker） |
| `OffscreenCanvas` | 在 Worker 里绘图 |

**为什么不能操作 DOM**：DOM 是主线程独占的共享可变状态。若多线程都能修改，浏览器必须给整棵 DOM 树加锁，并与 CSSOM、布局等渲染阶段同步，渲染性能不可接受。规范因此把 DOM 限定在主线程，Worker 只做纯计算。

要在 Worker 里画图，就把画布所有权交出去：

```
主线程：const offscreen = canvas.transferControlToOffscreen();
       worker.postMessage({ canvas: offscreen }, [offscreen]);
Worker：const ctx = e.data.canvas.getContext('2d');
       ctx.fillRect(...)                                  // 与主线程渲染解耦
```

### 7.3.4 ★ 数据怎么传

`postMessage` 默认走**结构化克隆（structured clone）**，即深拷贝；**拷贝在发送方线程执行**，所以主线程传大对象照样卡。

```js
worker.postMessage(new Array(1e6).fill(0));          // 深拷贝 100 万个元素，主线程阻塞

const buf = new ArrayBuffer(100 * 1024 * 1024);
worker.postMessage({ buf }, [buf]);                  // 第二个参数是 transfer 列表
console.log(buf.byteLength);                         // 0 ← 原线程已不可再用
```

| 对比 | 结构化克隆（拷贝） | Transferable（转移） |
|---|---|---|
| 内存 | 复制一份（双倍占用） | 所有权移交，不复制 |
| 耗时 | 与体积成正比 | 接近 O(1) |
| 原对象 | 仍可用 | 不可再用（`byteLength` 变 0） |
| 支持类型 | 对象/数组/Map/Set/Date/Blob/File/ImageData… | `ArrayBuffer`、`MessagePort`、`ImageBitmap`、`OffscreenCanvas`、`ReadableStream` |

**真共享内存：`SharedArrayBuffer` + `Atomics`**

```js
const sab = new SharedArrayBuffer(1024);
const view = new Int32Array(sab);
Atomics.add(view, 0, 1);        // 原子自增，两个线程看到同一块内存
Atomics.wait(view, 0, 0);       // 阻塞等待，会卡线程，只在 Worker 里用
```

代价是**跨源隔离**：服务端必须同时返回下面两个响应头，否则页面里 `SharedArrayBuffer` 直接是 `undefined`（Spectre 侧信道缓解）。

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### 7.3.5 三种 Worker

| 类型 | 创建方式 | 特点 | 用途 |
|---|---|---|---|
| **Dedicated Worker** | `new Worker(url)` | 专属于创建它的页面，页面关闭即终止 | 大数据计算，绝大多数场景 |
| **Shared Worker** | `new SharedWorker(url)` | 多个页面共享同一实例，经 `port` 通信 | 多标签页共享连接 |
| **Service Worker** | `navigator.serviceWorker.register(url)` | 独立于页面，可拦截网络请求 | PWA、离线缓存、推送 |

### 7.3.6 什么时候该用 / 不该用

| 该用 | 不该用 |
|---|---|
| 大文件解析（CSV/Excel/JSON，几十 MB） | 简单计算，创建与通信成本大于收益 |
| 图像处理（滤镜、压缩、裁剪） | 需要频繁操作 DOM |
| 加密/解密、哈希计算 | 数据量小，拷贝成本大于计算成本 |
| 复杂 diff / 搜索 / 排序 | 需要访问 `localStorage` |
| 代码高亮、WebAssembly 模块 | 需要与 UI 高频同步（每帧数百条消息） |

创建 Worker 要加载脚本并初始化 JS 引擎上下文，成本远高于一次函数调用，所以不要为每个小任务新建，而要池化复用，池大小取 `navigator.hardwareConcurrency`：

```js
class WorkerPool {
  constructor(url, size = navigator.hardwareConcurrency || 4) {
    this.idle = [];
    this.queue = [];
    for (let i = 0; i < size; i++) {
      const w = new Worker(url);
      w.onmessage = (e) => this._done(w, e.data);
      this.idle.push(w);
    }
  }
  run(payload) {
    return new Promise((resolve) => {
      const task = { payload, resolve };
      const w = this.idle.pop();
      if (w) this._exec(w, task); else this.queue.push(task);
    });
  }
  _exec(w, task) { w._task = task; w.postMessage(task.payload); }
  _done(w, data) {
    w._task.resolve(data);
    const next = this.queue.shift();
    if (next) this._exec(w, next); else this.idle.push(w);
  }
}
```

### 7.3.7 面试怎么答

- **边界**：没有 `document` / `window`，全局是 `self`；无 `localStorage`，用 IndexedDB；绘图走 `OffscreenCanvas` + `transferControlToOffscreen`。
- **原因**：DOM 是主线程独占的共享可变状态，多线程修改要加锁并与渲染流水线同步。
- **通信**：默认结构化克隆且拷贝在发送方；零拷贝用 Transferable；真共享用 `SharedArrayBuffer` + `Atomics` + COOP/COEP。
- **分类与工程**：Dedicated / Shared / Service Worker；Worker 要池化，数据太小时不值得进 Worker。

| 追问 | 回答要点 |
|---|---|
| Worker 怎么终止 | 主线程 `worker.terminate()`；Worker 内部 `self.close()` |
| Worker 能 import 模块吗 | 能，`new Worker(url, { type: 'module' })`，内部用 `import` |
| Worker 出错怎么捕获 | 主线程 `worker.onerror`；Worker 内部 `self.onerror` / `unhandledrejection` |

---

## 7.4 WebSocket

> 握手细节、帧协议、CSWSH 与 Nginx 配置见网络篇 WebSocket 一节；本节只保留「HTML5 新特性」语境下的结论。

### 7.4.1 一句话回答

**WebSocket 是单个 TCP 连接上的全双工协议**：一次 HTTP Upgrade 握手（服务端返回 **101 Switching Protocols**）后，双方可在任意时刻向任意方向发消息，此后不再走 HTTP 语义。

```js
const ws = new WebSocket('wss://api.example.com/ws');
ws.onopen = () => ws.send(JSON.stringify({ type: 'join', room: 1 }));
ws.onmessage = (e) => console.log(JSON.parse(e.data));
ws.onclose = (e) => console.log('关闭', e.code, e.reason);
ws.onerror = () => {};
```

### 7.4.2 和 HTTP 轮询的本质区别

| | HTTP 轮询 | WebSocket |
|---|---|---|
| 通信方向 | 客户端拉（单向发起） | 双向 |
| 连接 | 每次请求新建（或复用 keep-alive） | 一条长连接 |
| 头部开销 | 每次带完整 HTTP 头 | 握手后每帧只有 2~14 字节 |
| 服务端主动推 | 不能，只能等客户端来问 | 能 |
| 实时性 | 取决于轮询间隔 | 帧到达即推送 |

### 7.4.3 实时方案怎么选

| 方案 | 传输 | 自动重连 | 适用 |
|---|---|---|---|
| **短轮询** | HTTP | — | 消息频率极低，最省事 |
| **长轮询** | HTTP 挂起 | 需自己写 | 需兼容极老浏览器或中间层不支持流式 |
| **SSE** | HTTP（`text/event-stream`） | 内置，`Last-Event-ID` 续传 | 服务端单向推送：通知、进度、日志流、大模型逐 token 输出 |
| **WebSocket** | 升级后的帧协议 | 需自己写 | 双向高频：聊天、协作、游戏、行情 |

判断顺序：需要客户端频繁发消息才用 WebSocket；只要服务端推，SSE 更简单，代价是只支持文本、受 CORS 约束。

### 7.4.4 工程上必须自己做的三件事

| 事项 | 为什么必须做 | 怎么做 |
|---|---|---|
| **心跳** | Nginx 默认 `proxy_read_timeout` 60 秒、云 SLB 也有空闲超时，连接会被静默断开而两端不知道 | 应用层定时发 `{"type":"ping"}`；浏览器 JS 不能发协议层 ping 帧，只能服务端发、浏览器自动回 pong |
| **重连** | 断线不会自动恢复 | 指数退避 + 随机抖动，防止服务端重启时大量客户端同时重连（惊群） |
| **鉴权** | 浏览器 WebSocket API 不支持自定义请求头 | 先 `POST /ws-ticket` 换一次性 ticket，再连 `wss://...?ticket=xxx`；长期 token 不放 query，会进访问日志 |

```js
class WS {
  constructor(url) { this.url = url; this.retry = 0; this.connect(); }

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      this.retry = 0;
      this.timer = setInterval(() => {
        if (this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };
    this.ws.onclose = () => {
      clearInterval(this.timer);
      const base = Math.min(30000, 1000 * 2 ** this.retry++);
      setTimeout(() => this.connect(), base + Math.random() * 1000);   // 抖动
    };
    this.ws.onerror = () => this.ws.close();
  }
}
```

### 7.4.5 面试怎么答

- **协议**：单 TCP 全双工；HTTP Upgrade → 101；之后是 WebSocket 帧协议，不再走 HTTP。
- **对比轮询**：服务端可主动推，握手后每帧头部 2~14 字节。
- **选型**：只需服务端推用 SSE（纯 HTTP、内置重连、只支持文本）；双向高频才用 WebSocket。
- **工程**：心跳、指数退避重连、ticket 鉴权三件事 WS 都不内置，必须自己做。

| 追问 | 回答要点 |
|---|---|
| 多节点怎么部署 | Redis Pub/Sub 广播，或粘性会话 |
| Nginx 怎么配 | `proxy_http_version 1.1` + `Upgrade` / `Connection` 头 + 调大 `proxy_read_timeout` |
| 有什么安全问题 | CSWSH：握手不受同源策略限制且会带 Cookie，服务端必须校验 `Origin` |

---

## 7.5 补充：Canvas vs SVG

| 维度 | Canvas | SVG |
|---|---|---|
| **本质** | 位图（像素），JS 即时绘制 | 矢量，DOM 节点声明式描述 |
| **渲染模式** | 立即模式，画完只剩像素 | 保留模式，浏览器维护节点树 |
| **事件** | 元素上没有事件，需自己做命中检测 | 每个图形都能绑事件 |
| **缩放** | 放大失真（除非按 DPR 重绘） | 无损 |
| **可访问性 / SEO** | 无法被读屏器与爬虫解析 | 节点文本可被解析 |
| **性能** | 大量对象、高频重绘时好 | 少量对象时好，对象上千后 DOM 开销明显 |
| **内存** | 一张位图 | 每个节点都有对象开销 |
| **适合** | 游戏、图像处理、大数据量图表、视频帧 | 图标、地图、流程图、少量可交互图形 |

选型：图形少于约 1000 个且需要交互/可访问用 SVG；对象多或每帧重绘用 Canvas；两者兼有可混合（坐标轴 SVG + 数据点 Canvas）。

---

## 7.6 速记卡

```
【四组】语义 / 能力 / 离线 / 性能；无 HTML6，WHATWG Living Standard
【表单】新 type 的价值在移动端键盘；校验三件套 checkValidity / setCustomValidity / reportValidity
【移除】frame/frameset、applet、center/font/big/strike、marquee、AppCache

【Worker】无 document/window/parent/top，全局 self，无 localStorage
          有 fetch / IndexedDB / crypto / OffscreenCanvas
【传递】结构化克隆在发送方拷贝 → Transferable O(1) 且原线程失效 → SAB 需 COOP+COEP
【池化】大小取 hardwareConcurrency；数据太小不进 Worker

【WS】Upgrade 101；心跳 / 退避重连 / ticket 鉴权均需自建
【选型】服务端单向推 → SSE；双向高频 → WebSocket
【图形】<1000 且要交互 → SVG；大量对象或每帧重绘 → Canvas
```
