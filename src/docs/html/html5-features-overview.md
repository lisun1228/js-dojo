# HTML · 07 HTML5 新特性全景

> 本册覆盖：HTML5 有哪些新特性、Web Worker、WebSocket
> 「HTML5 新特性」是最典型的「背清单」题——**背清单只能拿及格分，按场景归类才能拿高分**。
> Web Worker 的核心考点是「**为什么不能操作 DOM**」和「**数据怎么传才不卡**」；WebSocket 的核心考点是「**和 SSE / 长轮询怎么选**」和「**心跳重连怎么做**」。

---

## 7.1 一句话结论

HTML5 不是一个「版本」，而是**一组能力的集合**（现在已经是 WHATWG 的 Living Standard，永远没有「HTML6」）。它的价值可以归为四句话：**让标签有语义、让浏览器有 API、让页面能离线、让前端能碰硬件**。

---

## 7.2 HTML5 新特性全景

### 7.2.1 先说答题策略

题单给的是一个 9 项的无序清单（语义化标签、Canvas、SVG、Storage、Web Worker、WebSocket、Geolocation、input 新类型、video/audio）。

**这样答的问题**：听起来像背目录，面试官随便挑一个往下问你就得重新组织语言。

**推荐答法**：**先给一句总纲，再分 4 组讲，每组点 2-3 个代表，最后说一个你真正用过的**。

> **总纲**：HTML5 的更新我通常分四块看——**语义（标签）**、**能力（浏览器 API）**、**离线（存储与缓存）**、**性能（多线程与预加载）**。

### 7.2.2 第一组：语义与结构

| 特性 | 内容 |
|---|---|
| **语义化标签** | `header` `footer` `nav` `main` `article` `section` `aside` `figure` `figcaption` `time` `mark` `details`/`summary` `dialog` `hgroup` |
| **表单增强** | 新 `type`：`email` `url` `tel` `number` `range` `date` `time` `datetime-local` `month` `week` `color` `search`<br>新属性：`placeholder` `required` `pattern` `autofocus` `multiple` `min`/`max`/`step` `list`（配 `datalist`）`form`（跨表单关联）<br>**约束校验 API**：`checkValidity()` `setCustomValidity()` `:valid` / `:invalid` / `:user-invalid` |
| **文档结构** | `<html manifest>`（已废）、`data-*` 属性、`<template>`、`<slot>`（Web Components） |

**表单校验的实际用法**（比背清单有用得多）：

```html
<form>
  <input type="email" name="mail" required
         pattern=".+@company\.com$"
         title="必须使用公司邮箱">
  <button>提交</button>
</form>
<script>
form.addEventListener('submit', (e) => {
  if (!form.checkValidity()) {
    e.preventDefault();
    form.reportValidity();       // 触发浏览器原生气泡提示
  }
});

// 自定义校验
input.addEventListener('input', () => {
  input.setCustomValidity(
    input.value.includes('admin') ? '不能用 admin 作为用户名' : ''
  );
});
</script>
```

> **`type="email"` 的真实价值**：手机端会弹出**带 @ 的键盘**，`type="tel"` 弹数字键盘，`type="number"` 弹数字键盘。**这是移动端体验最直接的收益**，比「格式校验」更值钱。

### 7.2.3 第二组：能力（浏览器 API）

| 特性 | 说明 | 现在还用吗 |
|---|---|---|
| **`<video>` / `<audio>`** | 原生播放器，不再依赖 Flash | ✅ 核心 |
| **`<track>`** | 字幕/章节轨道（WebVTT） | ✅ 无障碍要求 |
| **Canvas 2D** | 像素级绘图，JS 命令式 | ✅ |
| **内联 SVG** | 矢量、可被 CSS/JS 操作 | ✅ |
| **WebGL / WebGPU** | 3D 与通用 GPU 计算 | ✅（WebGPU 是新方向） |
| **拖放 API** | `draggable` + `dragstart/dragover/drop` | ⚠️ 体验差，多用库 |
| **History API** | `pushState` / `replaceState` / `popstate`，SPA 路由基础 | ✅ 核心 |
| **Geolocation** | `navigator.geolocation`（需用户授权） | ⚠️ 精度差，多用于 LBS 兜底 |
| **File API** | `File` / `FileReader` / `Blob` / 拖拽上传 / 分片上传 | ✅ 核心 |
| **Notification** | 桌面通知（需授权） | ⚠️ 常被滥用 |
| **Clipboard API** | `navigator.clipboard.writeText` | ✅ 替代 `execCommand` |
| **Fullscreen API** | `requestFullscreen()` | ✅ |
| **DeviceOrientation / DeviceMotion** | 陀螺仪、加速度计 | ⚠️ 需 HTTPS + 授权 |

### 7.2.4 第三组：离线与存储

| 特性 | 状态 |
|---|---|
| `localStorage` / `sessionStorage` | ✅ 常用 |
| `IndexedDB` | ✅ 大容量结构化存储 |
| **AppCache** | ❌ **已删除**（见 06 册 6.3） |
| **Service Worker** | ✅ PWA 基础（见 06 册 6.3） |
| `navigator.onLine` + `online`/`offline` 事件 | ✅ 简单的在线检测（不可靠，见下） |

> **`navigator.onLine` 的坑**：它只表示「有没有连上网络接口」，**不代表能上网**。连着 WiFi 但没有外网时它仍是 `true`。可靠做法是**自己 ping 一个极小的接口**（如 `/ping` 返回 204），或者用 `fetch` 的失败来判断。

### 7.2.5 第四组：连接、线程与性能

| 特性 | 说明 | 详见 |
|---|---|---|
| **WebSocket** | 全双工长连接 | 7.4 + 网络-11 |
| **SSE（EventSource）** | 服务端单向推送，纯 HTTP，自带重连 | 7.4 |
| **WebRTC** | P2P 音视频与数据传输 | 音视频场景 |
| **Web Worker** | 后台线程 | 7.3 |
| **`requestAnimationFrame`** | 与帧对齐的动画回调 | 05 册 5.6 |
| **`<link rel="preload">` / `prefetch`** | 资源预加载 | 04 册 4.4 |
| **`postMessage` / `BroadcastChannel`** | 跨窗口/跨标签页通信 | 06 册 |
| **`IntersectionObserver` / `MutationObserver` / `ResizeObserver`** | 观察者 API，替代 scroll 监听和轮询 | 懒加载、虚拟列表 |

### 7.2.6 HTML5 删掉了什么（容易被追问）

| 被移除 | 替代 |
|---|---|
| `<frame>` `<frameset>` `<noframes>` | `<iframe>` + CSS |
| `<applet>` | `<object>` / `<embed>` |
| `<center>` `<font>` `<big>` `<strike>` `<tt>` `<acronym>` | CSS |
| `<marquee>` `<blink>` | CSS 动画 |
| **AppCache** | Service Worker |
| `document.write`（未移除但不推荐） | DOM API |

### 7.2.7 面试怎么答

**30 秒版**

> HTML5 我一般分四块讲。**语义**上加了 `header`、`nav`、`article`、`section`、`footer` 这些标签，还有 `details`、`dialog` 这种自带交互的；**能力**上有了 `video`/`audio` 替代 Flash、Canvas 和 SVG、各种设备 API；**离线**上是 localStorage、IndexedDB 和 Service Worker；**性能和线程**上是 Web Worker、WebSocket、`requestAnimationFrame`，还有 `preload`/`prefetch` 这类资源提示。如果要挑一个我实际用得最多的，是 IntersectionObserver 替代 scroll 做懒加载和曝光统计。

**追问表**

| 追问 | 回答要点 |
|---|---|
| 现在还有 HTML6 吗 | 没有了，改成 WHATWG Living Standard，持续演进 |
| HTML5 最重要的三个特性 | 语义化标签、多媒体、离线能力（按你的项目说） |
| `video` 有哪些常用属性 | `src` `poster` `controls` `autoplay` `muted` `loop` `preload` `playsinline` |
| 为什么 `autoplay` 不生效 | 浏览器策略：必须 `muted` 才允许自动播放 |
| iOS 视频全屏怎么办 | `playsinline` + `webkit-playsinline` |
| input 新类型在桌面端有用吗 | 主要是移动端键盘类型和原生校验；桌面端样式不统一，常被重置 |
| `<template>` 干什么 | 声明不渲染的模板片段，供 JS 克隆（Web Components 基础） |
| `navigator.onLine` 可靠吗 | 不可靠，只表示网络接口状态，要自己 ping |
| History API 和 hash 路由区别 | History 用 `pushState` 改路径（需服务端 fallback），hash 用 `#`（不发请求但丑） |

---

## 7.3 Web Worker

### 7.3.1 一句话回答

**Web Worker 是浏览器提供的「独立于主线程的后台线程」**，用来执行**计算密集型任务**，从而不阻塞 UI。它的核心限制是**不能访问 DOM**（不能碰 `window`、`document`、`parent`），只能通过 `postMessage` 把结果传回主线程。

### 7.3.2 基本用法

```js
// main.js
const worker = new Worker('/worker.js');            // 或 { type: 'module' }

worker.postMessage({ cmd: 'parse', data: bigText });

worker.onmessage = (e) => {
  console.log('结果', e.data);
};

worker.onerror = (e) => {
  console.error('worker 出错', e.message);
};

// 用完要终止，否则线程一直占着
worker.terminate();
```

```js
// worker.js
self.onmessage = (e) => {
  const { cmd, data } = e.data;
  const result = heavyParse(data);
  self.postMessage(result);          // 或者 postMessage(result)
};
```

### 7.3.3 ★ Worker 里能访问什么、不能访问什么

**不能访问**（这是最常被问的）：

| 不能用的 | 原因 |
|---|---|
| `document` | Worker 没有 DOM，也没有渲染上下文 |
| `window` | 全局对象是 `self`（`DedicatedWorkerGlobalScope`） |
| `parent` / `top` | 没有窗口层级 |
| `alert` / `confirm` | 属于 UI |
| `localStorage` / `sessionStorage` | 同步 API，会产生跨线程竞态；只能用 IndexedDB |
| `XMLHttpRequest`（部分场景可用但不推荐） | 用 `fetch` |

**可以访问**：

| 能用的 | 说明 |
|---|---|
| `navigator` | 部分属性（`userAgent` `language` `hardwareConcurrency`） |
| `location` | **只读**（不能改 `href`） |
| `fetch` / `WebSocket` | 能发网络请求 |
| `IndexedDB` / `Cache API` | 能用存储 |
| `setTimeout` / `setInterval` | 能用 |
| `atob` / `btoa` / `TextEncoder` / `TextDecoder` | 编解码 |
| `crypto` | 加密 |
| `importScripts()` | 加载其它脚本（classic worker） |
| `OffscreenCanvas` | **可以在 Worker 里画图**（关键能力） |

**为什么不能操作 DOM**（面试官最爱追问这一句）：

> **因为 DOM 是主线程独占的共享可变状态。** 如果多个线程都能改 DOM，浏览器就必须给整棵 DOM 树加锁、做同步，这会彻底毁掉渲染性能（而且和 CSSOM/布局这些渲染流水线强耦合）。W3C 当年评估过「多线程 DOM」，结论是复杂度不可接受。所以规范选择了更简单的方案：**DOM 只归主线程，Worker 只做纯计算**。

**那「在 Worker 里画图」怎么实现**：

```
主线程：const canvas = document.querySelector('canvas');
       const offscreen = canvas.transferControlToOffscreen();
       worker.postMessage({ canvas: offscreen }, [offscreen]);   // 转移所有权

Worker：const ctx = e.data.canvas.getContext('2d');
       ctx.fillRect(...)      // 在 Worker 里画，UI 完全不受影响
```

> `OffscreenCanvas`（+ Worker）是做**高性能图表、地图、游戏**的关键手段。

### 7.3.4 ★ 数据怎么传（性能关键）

**默认是「结构化克隆（structured clone）」**，也就是**深拷贝**：

```js
const big = new Array(1e6).fill(0);
worker.postMessage(big);      // ⚠️ 深拷贝 100 万个元素，主线程会卡一下
```

**问题**：拷贝大对象本身就在主线程上执行，**卡顿没消除，只是转移了**。

**解法：Transferable Objects（转移所有权）**

```js
const buf = new ArrayBuffer(100 * 1024 * 1024);   // 100MB
worker.postMessage({ buf }, [buf]);                // ★ 第二个参数是 transfer 列表
console.log(buf.byteLength);                       // 0 ← 主线程这边已经「空了」
```

| 对比 | 结构化克隆（拷贝） | Transferable（转移） |
|---|---|---|
| 内存 | 复制一份（双倍占用） | **不复制，所有权移交** |
| 耗时 | 和体积成正比 | **接近 0**（O(1)） |
| 原对象 | 仍可用 | **原线程不可再用**（`byteLength` 变 0） |
| 支持的类型 | 对象/数组/Map/Set/Date/Blob/File/ImageData… | **`ArrayBuffer`**、`MessagePort`、`ImageBitmap`、`OffscreenCanvas`、`ReadableStream` |

**还有第三种：`SharedArrayBuffer`（真共享内存）**

```js
const sab = new SharedArrayBuffer(1024);
const view = new Int32Array(sab);
// 两个线程看到同一块内存，用 Atomics 做原子操作
Atomics.add(view, 0, 1);
Atomics.wait(view, 0, 0);      // 阻塞等待（只有 Worker 里能 wait）
```

**代价**：`SharedArrayBuffer` 需要 **跨源隔离（cross-origin isolated）**——服务端必须同时返回：

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

否则 `SharedArrayBuffer` 是 `undefined`（因为 Spectre 侧信道攻击）。**这也是为什么很多高性能 Web 应用需要特殊配置部署。**

### 7.3.5 三种 Worker

| 类型 | 创建方式 | 特点 | 用途 |
|---|---|---|---|
| **Dedicated Worker** | `new Worker(url)` | **专属**于创建它的页面，页面关闭就终止 | 99% 的场景：大数据计算 |
| **Shared Worker** | `new SharedWorker(url)` | **多个页面/标签页共享**同一个 Worker 实例，通过 `port` 通信 | 多标签页共享连接（少用） |
| **Service Worker** | `navigator.serviceWorker.register(url)` | **独立于页面**，能拦截网络请求，可离线、可推送 | PWA、离线、缓存 |

**三者对比记忆**：

```
Dedicated  → 一个页面一个线程，干重活
Shared     → 多个页面共用一个线程，省资源
Service    → 页面关了它还活着，管网络
```

### 7.3.6 什么时候该用 / 不该用

| 该用 | 不该用 |
|---|---|
| 大文件解析（CSV/Excel/JSON，几十 MB） | 简单计算（`a + b`），启动成本 > 收益 |
| 图像处理（滤镜、压缩、裁剪） | 需要频繁操作 DOM |
| 加密/解密、哈希计算 | 数据量很小（拷贝成本 > 计算成本） |
| 复杂的 diff / 搜索 / 排序 | 需要访问 `localStorage` |
| 代码高亮（大文件） | 需要和 UI 高频同步（每帧数百次消息） |
| WebAssembly 模块 | — |

**启动成本**：创建一个 Worker 通常要 **几毫秒到几十毫秒**（要加载脚本、初始化 JS 引擎上下文）。所以**不要为每个小任务新建 Worker**，而是**池化**：

```js
// 简易 Worker 池
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

> `navigator.hardwareConcurrency` 能拿到逻辑 CPU 核数，池大小一般设成它。

### 7.3.7 面试怎么答

**30 秒版**

> Web Worker 是浏览器提供的后台线程，用来跑计算密集型任务，避免阻塞主线程。它最大的限制是**不能访问 DOM**，也没有 `window`，全局对象是 `self`，跟主线程只能通过 `postMessage` 通信。数据传递默认是结构化克隆，也就是深拷贝，大对象拷贝本身就会卡；要真正零开销就得用 Transferable，比如把 `ArrayBuffer` 的所有权转移过去。典型场景是大文件解析、图像处理、加密这些。

**2 分钟版**

> 我讲四点：能力边界、通信方式、类型、工程实践。
>
> **能力边界**：Worker 里没有 `document`、没有 `window`，全局对象是 `self`。能用 `fetch`、`IndexedDB`、`crypto`、`setTimeout`，`location` 是只读的，**不能用 localStorage**（同步 API 会有跨线程问题）。**为什么不能操作 DOM**——因为 DOM 是主线程独占的共享可变状态，多线程改就要加锁、就要和渲染流水线同步，性能会被毁掉。所以规范的选择是：DOM 只归主线程，Worker 只做纯计算。如果真要在 Worker 里画图，可以用 `OffscreenCanvas`，主线程 `transferControlToOffscreen()` 把画布交出去。
>
> **通信方式**：`postMessage` 默认是**结构化克隆**，也就是深拷贝。这里有个反直觉的点：**拷贝是在主线程上做的**，所以传一个几十 MB 的数组，主线程照样卡。真正零开销的做法是 **Transferable**——把 `ArrayBuffer` 的所有权转移过去，O(1)，代价是原线程不能再用了。再进一步是 `SharedArrayBuffer` 真共享内存，但需要服务端配 COOP 和 COEP 做跨源隔离。
>
> **三种类型**：Dedicated 是一个页面一个，最常用；Shared 是多标签页共享；Service Worker 是独立于页面、能拦截网络请求的，用来做离线缓存。
>
> **工程实践**：Worker 的启动成本是几毫秒到几十毫秒，所以不能每个小任务都新建，要池化，池大小用 `navigator.hardwareConcurrency`。另外不是所有计算都值得放 Worker——如果数据很小，拷贝和通信的成本可能比计算本身还大。

**追问表**

| 追问 | 回答要点 |
|---|---|
| Worker 能操作 DOM 吗 | **不能**，没有 document/window |
| 为什么不能操作 DOM | DOM 是主线程独占的共享可变状态，多线程要加锁，会毁掉渲染性能 |
| Worker 能用 localStorage 吗 | 不能（同步 API），只能用 IndexedDB |
| 数据怎么传 | `postMessage` + 结构化克隆（深拷贝） |
| 怎么避免拷贝开销 | Transferable（`ArrayBuffer`/`ImageBitmap`/`MessagePort`），所有权转移 |
| `SharedArrayBuffer` 怎么用 | 需要 COOP + COEP 跨源隔离，配合 `Atomics` |
| 有几种 Worker | Dedicated / Shared / Service Worker |
| Worker 里能画图吗 | 能，用 `OffscreenCanvas` + `transferControlToOffscreen` |
| Worker 怎么终止 | `worker.terminate()`；Worker 内部 `self.close()` |
| 启动成本高吗 | 几 ms 到几十 ms，要池化复用 |
| 怎么知道 CPU 核数 | `navigator.hardwareConcurrency` |
| Worker 能 import 模块吗 | 能，`new Worker(url, { type: 'module' })` |
| Worker 出错怎么捕获 | `worker.onerror`；Worker 内部 `self.onerror` |

---

## 7.4 WebSocket

> 完整版（握手细节、帧协议、CSWSH 安全、Nginx 配置）见工作区 `计算机网络-71题/网络-11-WebSocket与实时通信.md`。本节只给「HTML5 新特性」语境下的答法。

### 7.4.1 一句话回答

**WebSocket 是在单个 TCP 连接上的全双工协议**。它通过一次 HTTP Upgrade 握手（返回 **101**）从 HTTP 升级，之后双方可以**任意方向、任意时刻**发消息。

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
| 通信方向 | 客户端拉（单向发起） | **双向** |
| 连接 | 每次请求新建（或复用 keep-alive） | **一条长连接** |
| 头部开销 | 每次几百字节 | 握手后每帧只有 **2~14 字节** |
| 实时性 | 取决于轮询间隔 | **毫秒级** |
| 服务端主动推 | ❌（只能等客户端来问） | ✅ |

### 7.4.3 实时方案怎么选（这才是本题的真正考点）

| 方案 | 方向 | 实时性 | 自动重连 | 适用 |
|---|---|---|---|---|
| **短轮询** | 客户端拉 | 差 | — | 极简、消息频率极低 |
| **长轮询** | 客户端拉（挂起） | 较好 | 需自己写 | 兼容老浏览器 |
| **SSE** | **服务端 → 客户端**（单向） | 好 | **✅ 内置** | **通知、进度、日志流、AI 打字机效果** |
| **WebSocket** | **双向** | **最好** | ❌ 需自己写 | 聊天、协作、游戏、行情 |

**选型口诀**：

```
需要客户端频繁发消息吗？
├─ 需要 → WebSocket
└─ 不需要（只要服务端推）
    ├─ 消息频率很低 → 短轮询（最省事）
    ├─ 要兼容极老浏览器 → 长轮询
    └─ 现代浏览器 → SSE（自带重连 + 断点续传，比 WS 简单）
```

> **一个高说服力的例子**：**ChatGPT 的打字机效果就是 SSE**，不是 WebSocket。因为只需要服务端单向流式输出，用 SSE 更简单、还自带重连。

### 7.4.4 工程上必须自己做的三件事（WS 不像 SSE 那样开箱即用）

| 事项 | 为什么必须做 | 怎么做 |
|---|---|---|
| **心跳** | Nginx 默认 `proxy_read_timeout` 60 秒，云 SLB 也有空闲超时，连接会被**静默断开**而两端不知道 | 应用层每 30 秒发 `{"type":"ping"}`；浏览器**不能主动发协议层 ping 帧** |
| **重连** | 断线不会自动恢复 | **指数退避 + 随机抖动**（防服务端重启时十万客户端同时重连的惊群） |
| **鉴权** | JS API **不支持自定义请求头** | 先 `POST /ws-ticket` 换一次性 ticket，再 `wss://...?ticket=xxx`（**别把长期 token 放 query**，会进 Nginx 日志） |

```js
// 心跳 + 指数退避重连的最小实现
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
      }, 30000);                                    // 心跳 30s
    };
    this.ws.onclose = () => {
      clearInterval(this.timer);
      const base = Math.min(30000, 1000 * 2 ** this.retry++);
      setTimeout(() => this.connect(), base + Math.random() * 1000);  // 抖动
    };
    this.ws.onerror = () => this.ws.close();
  }
}
```

### 7.4.5 面试怎么答

**30 秒版**

> WebSocket 是在单个 TCP 连接上的全双工协议，通过一次 HTTP Upgrade 握手、服务端返回 101 从 HTTP 升级上来，之后双方可以任意方向发消息。它和轮询的本质区别是**服务端能主动推**，而且握手之后每帧只有几个字节的头部开销。不过它不像 SSE 那样自带重连，心跳、重连、鉴权都得自己做。选型上，只需要服务端单向推的场景用 SSE 更划算——比如 ChatGPT 的打字机效果就是 SSE。

**追问表**

| 追问 | 回答要点 |
|---|---|
| WebSocket 握手返回什么状态码 | 101 Switching Protocols |
| 之后还是 HTTP 吗 | 不是，改用 WebSocket 的帧协议 |
| 和 SSE 区别 | SSE 单向、纯 HTTP、自带重连、只支持文本 |
| 为什么要心跳 | Nginx 60s、SLB 有空闲超时，会静默断开 |
| 浏览器能发 ping 帧吗 | 不能，只能服务端发、浏览器自动回 pong |
| 怎么带 token | 先 HTTP 换一次性 ticket；query 里的长期 token 会进日志 |
| 多节点怎么部署 | Redis Pub/Sub 广播，或粘性会话 |
| Nginx 怎么配 | `proxy_http_version 1.1` + `Upgrade` + 调大 `proxy_read_timeout` |
| 有安全问题吗 | 有，CSWSH：握手不受同源策略限制且会带 Cookie，服务端必须校验 Origin |

---

## 7.5 补充：Canvas vs SVG（HTML5 图形必问）

| 维度 | Canvas | SVG |
|---|---|---|
| **本质** | **位图**（像素），JS 即时绘制 | **矢量**（DOM 节点），声明式 |
| **渲染方式** | 立即模式（画完就没了，只留像素） | 保留模式（浏览器维护节点树） |
| **事件** | ❌ 元素上没有事件，要自己做命中检测 | ✅ 每个图形都能绑事件 |
| **缩放** | ❌ 放大失真（除非按 DPR 重绘） | ✅ 无损 |
| **可访问性 / SEO** | ❌ 基本无法被读 | ✅ 可被读屏器和爬虫理解 |
| **性能** | **大量对象、高频重绘时好**（一个 draw call 序列） | 少量对象时好；**对象上千会明显变慢**（DOM 开销） |
| **内存** | 一张位图 | 每个节点都有对象开销 |
| **适合** | 游戏、图像处理、大数据量图表、视频帧 | 图标、地图、流程图、少量图形的交互图表 |

**选型口诀**：

```
图形少于 ~1000 个且需要交互/可访问 → SVG
图形很多或每帧都在重画 → Canvas
两者都要（如图表：坐标轴 SVG + 数据点 Canvas）→ 混合
```

---

## 7.6 速记卡

```
HTML5 答题结构（别背清单，分四组）
  ① 语义：header/footer/nav/main/article/section/aside/figure
          details/summary、dialog、time、mark、hgroup
  ② 能力：video/audio/track、Canvas/SVG/WebGL、History API、
          File API、Clipboard、Geolocation、拖放
          表单：email/url/tel/number/range/date/color + required/pattern
                + checkValidity/setCustomValidity
  ③ 离线：localStorage/sessionStorage/IndexedDB/Service Worker
  ④ 性能：Web Worker、WebSocket、SSE、rAF、preload/prefetch、
          IntersectionObserver/ResizeObserver
  ★ 没有 HTML6，现在是 WHATWG Living Standard
  删掉了：frame/frameset、center/font/big/strike、applet、marquee、AppCache

Web Worker
  独立线程，全局对象是 self，★ 没有 window/document，不能碰 DOM
  不能用 localStorage（同步 API），能用 IndexedDB/fetch/crypto
  ★ 为什么不能碰 DOM：DOM 是主线程独占的共享可变状态，多线程要加锁
  通信：postMessage + 结构化克隆（深拷贝，★ 拷贝在主线程上做）
  ★ Transferable：ArrayBuffer / ImageBitmap / MessagePort / OffscreenCanvas
               转移所有权，O(1)，原线程不可再用
  SharedArrayBuffer 需 COOP:same-origin + COEP:require-corp，配 Atomics
  三种：Dedicated / Shared / Service Worker
  在 Worker 里画图：OffscreenCanvas + transferControlToOffscreen
  启动成本几 ms ~ 几十 ms → 池化，池大小 = hardwareConcurrency
  适合：大文件解析、图像处理、加密、diff、代码高亮
  不适合：简单计算、高频 DOM 操作、小数据

WebSocket
  单 TCP 全双工，HTTP Upgrade → 101，之后是帧协议
  头部开销：握手后每帧 2~14 字节
  必须自己做：心跳（30s，浏览器不能发 ping 帧）
             重连（指数退避 + 抖动，防惊群）
             鉴权（HTTP 换一次性 ticket）
  选型：只需服务端推 → SSE（自带重连，ChatGPT 打字机就是 SSE）
       需要双向高频 → WebSocket
  安全：CSWSH（握手不受 SOP 限制 + 带 Cookie）→ 服务端校验 Origin

Canvas vs SVG
  Canvas：位图、立即模式、无元素事件、失真、大量对象好
  SVG：矢量、保留模式、可绑事件、无损、可访问、对象多了慢
  <1000 个且要交互 → SVG；大量/每帧重绘 → Canvas
```
