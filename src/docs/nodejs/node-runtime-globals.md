# Node 01｜运行时全景与全局对象

> 覆盖题号：17（Node 理解/优缺点/场景）、16（全局对象）、15（process）
> 去重后：**3 个考点**

---

## 目录

- [1.1 说说你对 Node.js 的理解](#11-说说你对-nodejs-的理解)
- [1.2 Node.js 有哪些全局对象](#12-nodejs-有哪些全局对象)
- [1.3 process 的理解](#13-process-的理解)
- [1.4 本册追问总表](#14-本册追问总表)
- [1.5 速记卡](#15-速记卡)
- [1.6 自测](#16-自测)

---

## 1.1 说说你对 Node.js 的理解

### 题单答案的问题

> 「Node 是 V8 引擎的服务端 JS 运行时，事件驱动、非阻塞 I/O。
> **优点**：高并发、轻量、前后端同语言、npm 生态
> **缺点**：不适合 CPU 密集型、回调地狱（已用 async/await 缓解）、单进程不稳定（用 PM2 cluster）
> **场景**：API 服务、实时应用（聊天/推送）、SSR、BFF、工具链」

**这是这份题单里最完整的一条**，结构（是什么 / 优点 / 缺点 / 场景）也对。但有三处需要修正或深入：

| 题单的说法 | 问题 |
|---|---|
| 「单进程不稳定」 | **不准确**。进程不稳定指的是「崩了没人重启」，这是运维问题（PM2 解决），不是 Node 的固有缺点 |
| 「不适合 CPU 密集型」 | **对，但没说为什么**。原因是 JS 执行是单线程，一个 CPU 密集任务会阻塞整个事件循环 |
| 「事件驱动、非阻塞 I/O」 | **对，但太抽象**。这句话背后的关键事实是 **libuv 有一个线程池**——「单线程」只说对了一半 |

### 一句话结论

> **Node = V8（执行 JS）+ libuv（异步 I/O 和线程池）+ 标准库（fs/net/http 等）。**
>
> 它用「单线程 + 事件循环」换来了**极高的 I/O 并发密度**，代价是**任何一个 CPU 密集任务都会卡住所有人**。

### 「单线程」这个说法只对了一半（这是最该讲清的）

面试官问「Node 是单线程的吗」，标准答法是：

> 「**JS 执行是单线程的，但 I/O 不是。**
>
> 准确地说：Node 只有一个主线程执行 JS，只有一个事件循环、一个调用栈。但底层 `libuv` 有一个**默认 4 个线程的线程池**，用来做「没有异步系统调用可用」的那些操作——比如 `fs` 的大部分方法、`dns.lookup`、`crypto.pbkdf2`/`scrypt`。
>
> 而网络 I/O（TCP/UDP）**不用线程池**，它走的是操作系统的 epoll/kqueue，是真正的异步。所以 Node 做 API 服务能扛很高并发，因为网络 I/O 不占线程。
>
> 真正会阻塞事件循环的，只有**在 JS 主线程上跑 CPU 密集代码**。」

#### 实测证据：线程池确实是 4 个

我用 `crypto.pbkdf2`（走线程池的 CPU 密集操作）做了一组对照实验，同一份代码只改 `UV_THREADPOOL_SIZE`：

```
UV_THREADPOOL_SIZE=1    1个=15ms   2个=29ms   4个=59ms   8个=119ms
UV_THREADPOOL_SIZE=2    1个=15ms   2个=15ms   4个=32ms   8个=64ms
UV_THREADPOOL_SIZE=4    1个=15ms   2个=16ms   4个=18ms   8个=34ms
UV_THREADPOOL_SIZE=8    1个=15ms   2个=17ms   4个=17ms   8个=31ms
```

**读法**：

- `size=1`：耗时随任务数**线性增长**（15→29→59→119），完全串行
- `size=4`：4 个以内耗时几乎不变（15→16→18），第 8 个才翻倍到 34ms
- `size=8`：8 个都不排队（31ms）

**结论**：默认就是 4 个线程。第 5 个任务必须排队——这就是「**Node 处理 CPU 密集任务会互相拖累**」的物理原因。

> 这组数据可以直接答「为什么 Node 不适合 CPU 密集」：**不是因为 JS 慢，是因为只有 4 条通道，第 5 个任务就要等。**

### 什么任务会阻塞事件循环

| 类型 | 例子 | 走不走线程池 | 会不会阻塞主线程 |
|---|---|---|---|
| **网络 I/O** | `http.request`、`net.Socket` | ❌ 走 OS 的 epoll | ❌ 不阻塞 |
| **定时器** | `setTimeout`、`setInterval` | ❌ 由 libuv timer 管理 | ❌ 不阻塞 |
| **文件 I/O** | `fs.readFile`、`fs.stat` | ✅ **走线程池** | ⚠️ 排队会变慢，但主线程不阻塞 |
| **DNS** | `dns.lookup` | ✅ 走线程池（`dns.resolve` 不走） | ⚠️ 同上 |
| **加密** | `crypto.pbkdf2`、`scrypt` | ✅ 走线程池 | ⚠️ 同上 |
| **同步文件 API** | `fs.readFileSync` | ❌ 主线程直接做 | ✅ **完全阻塞** |
| **CPU 密集 JS** | 大循环、复杂计算、`JSON.parse` 大字符串、正则回溯 | ❌ 主线程 | ✅ **完全阻塞** |

> **两个高分细节**：
> 1. **`dns.lookup` 和 `dns.resolve` 不一样**：`lookup` 用线程池（依赖 `getaddrinfo`），`resolve` 走网络（发 DNS 查询）。所以「DNS 解析拖慢接口」通常指 `lookup`。
> 2. **`JSON.parse` 大字符串也会阻塞**。一个 10MB 的 JSON，`JSON.parse` 要几十毫秒——这期间整个服务无响应。

### 优缺点重新梳理

| 优点 | 本质原因 |
|---|---|
| 高并发（I/O 密集） | 网络 I/O 不占线程，一个进程能挂几万个连接 |
| 内存占用低 | 没有「一连接一线程」的栈开销（对比 Java 的线程模型） |
| 前后端同语言 | 减少上下文切换，SSR/BFF 场景特别顺 |
| 生态巨大 | npm 上有几百万个包 |
| 启动快 | 没有 JVM 那种预热过程，适合 Serverless / 容器 |

| 缺点 | 本质原因 | 怎么缓解 |
|---|---|---|
| **不适合 CPU 密集** | 只有 4 个线程池 + 主线程单线程 | worker_threads / 独立服务 / 原生插件 |
| **单点故障** | 一个未捕获异常可能让进程退出 | PM2/systemd 守护 + `unhandledRejection` 兜底 |
| **调试异步栈难** | 回调链断了栈 | `async_hooks`、`--inspect`、`Error.captureStackTrace` |
| **依赖生态质量参差** | npm 包质量不可控 | 锁版本、审计、少用冷门包 |
| **类型安全弱**（历史） | JS 动态类型 | TypeScript |

> **「单点故障」要说得准确一点**：
> 「Node 本身不会因为一个请求出错就崩——`try/catch` 和 Express/Koa 的错误处理能兜住。真正会崩的是**未捕获的 Promise rejection**（Node 15 起默认也退出）和 **未捕获的同步异常**。所以生产上要做两件事：一是 `process.on('uncaughtException')` 记日志后优雅退出（**不要试图继续运行**），二是 PM2 这类守护进程自动重启。」

### 应用场景（按适配度排序）

| 场景 | 适配度 | 为什么 |
|---|---|---|
| **API 服务 / 网关** | ⭐⭐⭐⭐⭐ | 大量 I/O 等待，正是 Node 的强项 |
| **BFF（Backend for Frontend）** | ⭐⭐⭐⭐⭐ | 聚合多个后端接口，全是 I/O |
| **SSR** | ⭐⭐⭐⭐⭐ | 同构代码复用，前端团队能全栈 |
| **实时应用（IM/推送/协作）** | ⭐⭐⭐⭐⭐ | WebSocket 长连接，Node 的内存效率优势明显 |
| **工具链 / CLI** | ⭐⭐⭐⭐⭐ | Webpack/Vite/ESLint 全是 Node 写的 |
| **图片/视频处理** | ⭐⭐ | CPU 密集，只能包一层 FFmpeg 子进程 |
| **大数据计算 / 科学计算** | ⭐ | 语言和运行时都不合适 |
| **强事务的金融核心** | ⭐⭐ | 生态（ORM、分布式事务）不如 Java |

### 面试怎么说（2 分钟版）

> 「我理解 Node 是 **V8 + libuv + 标准库** 的组合。它的设计取向很明确：**用单线程换 I/O 并发密度**。
>
> 这里有个常见的误解要澄清——**Node 不是纯单线程**。JS 执行确实是单线程，但 libuv 有一个默认 4 个线程的线程池，负责文件 I/O、DNS 解析、加密这些『没有系统级异步接口』的操作。而网络 I/O 走的是 OS 的 epoll/kqueue，完全不占线程。所以它能扛几万个并发连接。
>
> 我实测过线程池的影响：`crypto.pbkdf2` 做 4 个并发是 17ms，第 5 个开始翻倍到 31ms，正好卡在 4 这个数字上。把 `UV_THREADPOOL_SIZE` 设成 1，4 个并发就要 59ms——**这就是『Node 不适合 CPU 密集』的物理原因：不是 JS 慢，是通道太少。**
>
> 所以我的选型判断是：**I/O 密集、长连接、BFF、SSR、工具链 —— 用 Node；CPU 密集（图片转码、复杂计算）—— 拆到独立服务或者用 worker_threads。**
>
> 缺点方面我会强调两个：一是**未捕获异常会导致进程退出**，生产必须配守护进程 + 优雅退出；二是**异步栈难调试**，出问题时不好定位，得靠 `--inspect` 和 `async_hooks`。」

### 追问链

| 追问 | 答法 |
|---|---|
| Node 的「单线程」到底指什么？ | 指 JS 执行和事件循环只有一个线程。I/O 有 libuv 线程池（默认 4 个）+ OS 的异步接口 |
| 为什么网络 I/O 不用线程池？ | 因为 OS 提供了 epoll/kqueue 这类 IO 多路复用机制，一个线程就能监听几万个 fd |
| 线程池打满了会怎样？ | 所有走线程池的操作（文件、DNS、加密）排队。主线程不阻塞，但响应变慢。**这是「接口突然变慢但 CPU 不高」的常见原因** |
| `UV_THREADPOOL_SIZE` 该设多大？ | 默认 4 对多数场景够。如果大量文件操作，可以调到 8~16。**不要超过 CPU 核心数太多**，线程切换反而变慢 |
| worker_threads 和 cluster 区别？ | `worker_threads` 是**同一进程内的多线程**，共享内存（`SharedArrayBuffer`），适合 CPU 密集；`cluster` 是**多进程**，各有独立内存，适合利用多核扛请求 |
| Node 能替代 Java 吗？ | 看场景。I/O 密集的网关/BFF 完全可以；强事务、复杂业务逻辑、需要丰富中间件生态的核心系统，Java 更稳 |
| Node 22 有什么值得用的新特性？ | `node:sqlite`（内置 SQLite，我这份文档的分页实测就用的它）、`--watch` 稳定、`require()` 支持 ESM、内置 `fetch` 已稳定 |

---

## 1.2 Node.js 有哪些全局对象

### 题单答案的问题

> 「`global`、`process`、`Buffer`、`__dirname`、`__filename`、`module`、`exports`、`require`、`setTimeout/setInterval/setImmediate`、`console`。」

**这个清单混了两类完全不同的东西**：

- `global`、`process`、`Buffer`、`console`、`setTimeout` —— 真的在 `globalThis` 上
- **`__dirname`、`__filename`、`module`、`exports`、`require` —— 不在全局上**，它们来自**模块包装函数的参数**

**这个区别是这道题的核心考点。** 面试官问「`__dirname` 是全局对象吗」，答「是」就错了。

### 实测：哪些真的在 `globalThis` 上

```
__dirname          ★ 模块作用域内可用，但不在 global
__filename         ★ 模块作用域内可用，但不在 global
module             ★ 模块作用域内可用，但不在 global
exports            ★ 模块作用域内可用，但不在 global
require            ★ 模块作用域内可用，但不在 global

'__dirname' in globalThis  → false
typeof __dirname           → string
```

### 为什么不在全局上？看模块包装函数

Node 执行每个 CJS 文件前，会把它包进一个函数：

```js
(function (exports, require, module, __filename, __dirname) {
  // ← 你的代码在这里
});
```

**实测拿到的真实 wrapper**（`require('module').wrapper`）：

```js
[
  '(function (exports, require, module, __filename, __dirname) { ',
  '\n});'
]
```

所以 `__dirname` 是**这个函数的第五个参数**，不是全局变量。

> **这个设计的价值**：
> 「它让每个模块有自己的作用域。如果 `__dirname` 是全局的，那所有模块看到的都是同一个值——毫无意义。作为参数传入，每个模块拿到的是自己的路径。**这也是 CJS 模块隔离的实现方式：不是靠作用域链，是靠把代码包进函数。**」

**推论**：在 ESM 里没有这层包装，所以 `__dirname` 不存在，要用 `import.meta.url` 自己算：

```js
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

### 完整分类表

#### ① 真正的全局对象（在 `globalThis` 上）

| 类别 | 成员 |
|---|---|
| **核心对象** | `global`（= `globalThis`）、`process`、`Buffer`、`console` |
| **定时器** | `setTimeout` / `clearTimeout` / `setInterval` / `clearInterval` / `setImmediate` / `clearImmediate` |
| **微任务** | `queueMicrotask` |
| **URL 相关** | `URL`、`URLSearchParams` |
| **编解码** | `TextEncoder`、`TextDecoder`、`atob`、`btoa` |
| **网络** | `fetch`、`Request`、`Response`、`Headers`、`WebSocket`（18+） |
| **能力** | `AbortController`、`AbortSignal`、`structuredClone`、`performance`、`crypto` |
| **错误类型** | `Error`、`TypeError`、`RangeError`…（JS 内置） |

> 注意 **`fetch` 从 Node 18 起在全局上**，之前要用 `node-fetch`。**`crypto` 全局提供的是 Web Crypto API**（`crypto.subtle`、`crypto.randomUUID()`），跟 `require('node:crypto')` 里的 `createHash` 等**不是同一套**。

#### ② 模块作用域变量（不在 `globalThis`，只存在于包装函数参数里）

| 成员 | 说明 |
|---|---|
| `module` | 当前模块对象，有 `exports` / `filename` / `id` / `parent` / `children` |
| `exports` | = `module.exports` 的初始引用 |
| `require` | 加载函数，带 `resolve` / `cache` / `main` 属性 |
| `__filename` | 当前文件的绝对路径 |
| `__dirname` | 当前文件所在目录的绝对路径 |

#### ③ 浏览器有但 Node 没有的（容易搞混）

| 成员 | Node 里怎么办 |
|---|---|
| `window` / `document` | 不存在（要 jsdom） |
| `localStorage` | Node 22+ 有实验性的 `localStorage`，生产别用 |
| `alert` / `confirm` | 不存在 |
| `navigator` | Node 21+ 有部分实现（`navigator.userAgent`） |
| `location` | 不存在（用 `import.meta.url` 或 `process.cwd()`） |

### 面试怎么说

> 「全局对象我会分两类说，因为题面里的清单其实是混的。
>
> **第一类是真的在 `globalThis` 上**：`global`、`process`、`Buffer`、`console`、各种定时器、`queueMicrotask`，还有 Node 18 之后内置的 `fetch`、`URL`、`TextEncoder` 这些 Web 标准 API。
>
> **第二类是模块作用域的**：`__dirname`、`__filename`、`module`、`exports`、`require`。**它们不是全局对象**——我实测过 `'__dirname' in globalThis` 是 `false`。
>
> 原因是 Node 执行 CJS 文件时会把它包进一个函数：
> `(function (exports, require, module, __filename, __dirname) { ... })`
> 这五个就是函数的参数。**这个包装同时实现了两件事：提供这些变量 + 隔离模块作用域。**
>
> 所以在 ESM 里没有这层包装，`__dirname` 就不存在了，要用 `import.meta.url` 配合 `fileURLToPath` 自己算。」

### 追问链

| 追问 | 答法 |
|---|---|
| `global` 和 `globalThis` 区别？ | `globalThis` 是 ES2020 的**标准**，浏览器里是 `window`、Node 里是 `global`。**新代码统一用 `globalThis`** |
| `exports` 和 `module.exports` 区别？ | 初始指向同一个对象。但 `exports = {...}` 会**断开引用**（因为重新赋值了局部变量），而 `module.exports = {...}` 才有效 |
| 为什么 `exports.a = 1` 能生效但 `exports = {a:1}` 不行？ | 前者改的是对象内容，后者改的是局部变量的指向。**require 返回的始终是 `module.exports`** |
| `require` 上有哪些属性？ | `require.resolve`（解析路径不加载）、`require.cache`（模块缓存）、`require.main`（入口模块）、`require.extensions`（已废弃） |
| 怎么判断「当前模块是入口还是被 require 的」？ | `require.main === module`。**CLI 工具常用**：`if (require.main === module) { main(); }` |
| `process` 为什么是全局的？ | 因为它代表整个进程，全局唯一，且每个模块都需要访问（环境变量、退出码）。**设计上就该全局** |

---

## 1.3 process 的理解

### 题单答案的问题

> 「当前 Node 进程信息和控制。常用：`process.env`（环境变量）、`process.argv`（命令行参数）、`process.cwd()`、`process.exit()`、`process.on('exit')`、`process.nextTick()`。」

**清单基本对，但这是一道「越问越深」的题**。面试官会追问：

- `process.exit()` 有什么坑？
- `process.on('exit')` 里为什么不能做异步操作？
- `process.nextTick` 和 Promise 什么关系？
- 怎么优雅退出？

### 一句话结论

> `process` 是**当前 Node 进程的句柄**——既能读信息（环境、参数、内存），也能控制行为（退出、信号、优先级）。

### 实测：常用属性

```js
process.pid              // 16053
process.ppid             // 16052（父进程）
process.version          // v22.22.2
process.platform         // darwin
process.arch             // arm64
process.execPath         // node 的绝对路径
process.cwd()            // /private/tmp/nodecheck
process.argv             // [node路径, 脚本路径, ...用户参数]
process.execArgv         // []（node 的启动参数，如 --max-old-space-size）
process.env.NODE_ENV     // undefined
process.uptime()         // 0.017（秒）
process.versions.v8      // 12.4.254.21-node.39
process.versions.uv      // 1.51.0
process.versions.openssl // 3.5.5
```

#### `process.argv` 的结构（容易搞错）

```js
// 执行：node app.js arg1 arg2
process.argv
// → ['/path/to/node', '/path/to/app.js', 'arg1', 'arg2']
//      ↑ 第 0 项               ↑ 第 1 项          ↑ 用户参数从这里开始
```

**所以取用户参数要 `slice(2)`**。这是个经典的小坑。

#### `process.memoryUsage()` 的五个字段（实测）

```
rss            48.39 MB    ← 进程占用的物理内存总量（含 C++ 对象、栈、堆）
heapTotal       6.64 MB    ← V8 已申请的堆内存
heapUsed        4.86 MB    ← V8 实际使用的堆内存（★ 排查泄漏主要看这个）
external        1.86 MB    ← C++ 对象占的内存（Buffer、绑定对象）
arrayBuffers    0.02 MB    ← ArrayBuffer / Buffer 占的内存
```

**排查内存泄漏时看哪个？**

| 现象 | 看什么 | 说明 |
|---|---|---|
| 内存持续增长，`heapUsed` 跟着涨 | **`heapUsed`** | JS 对象泄漏，用 heap snapshot 找 |
| `rss` 涨但 `heapUsed` 不涨 | **`external` / `arrayBuffers`** | Buffer 泄漏（常见于没释放的流） |
| `rss` 远大于 `heapTotal` + `external` | 可能是**内存碎片**或 native 插件泄漏 | 需要 `--max-old-space-size` 调优或查插件 |

> 这个区分很实用：**「RSS 一直涨但 heapUsed 稳定」是最常见的误判**——以为是 JS 泄漏，其实是 Buffer 没释放。

#### `v8.getHeapStatistics()` 的堆上限（实测）

```
heap_size_limit = 4144 MB
```

**这就是为什么大数据处理会 OOM**：默认堆上限约 4GB（64 位系统，取决于物理内存）。要调大：

```bash
node --max-old-space-size=8192 app.js   # 8GB
```

> **但这只是权宜之计**。真正的解法是「流式处理」——用 Stream 分块，而不是一次性加载。**调大堆上限只是把 OOM 推后，没解决根本问题。**

### 三个必须知道的坑

#### 坑 1：`process.exit()` 会粗暴终止

```js
process.exit(0);   // ← 立即退出，不等异步操作完成
```

**实测**：如果在这之前有 `console.log`，在**管道/文件重定向**的场景下可能**输出被截断**——因为 stdout 是异步刷盘的。

**正确做法**：

```js
// 温和退出：设置退出码，让事件循环自然结束
process.exitCode = 1;

// 或者主动关闭资源
server.close(() => {
  db.close(() => process.exit(0));
});
```

> **`process.exitCode = 1` 和 `process.exit(1)` 的区别**：
> - `exit()` **立即**终止，可能丢日志、断连接
> - `exitCode` 只是**设置退出码**，等事件循环空了自然退出，**所有 pending 的 I/O 都会完成**
>
> **生产代码优先用 `exitCode`。**

#### 坑 2：`exit` 事件里只能做同步操作

```js
process.on('exit', (code) => {
  // ❌ 这里的异步操作不会执行
  fs.writeFile('log.txt', 'bye', () => {});   // 永远不会写完

  // ✅ 只能同步
  fs.writeFileSync('log.txt', 'bye');
});
```

**为什么**？因为 `exit` 事件是在**事件循环已经停止**之后触发的——没有下一轮循环了，异步回调永远不会被调用。

#### 坑 3：`uncaughtException` 后不要继续运行

```js
// ❌ 错误做法（很多老教程这么写）
process.on('uncaughtException', (err) => {
  console.error(err);
  // 继续运行 —— 状态已经不可信了
});
```

**为什么不能继续**：未捕获异常发生时，可能有**半个事务没提交、锁没释放、内存结构不一致**。继续运行会导致更难排查的问题。

**正确做法**：

```js
process.on('uncaughtException', (err) => {
  console.error('未捕获异常，准备退出:', err);
  // 同步记录关键信息
  fs.writeFileSync('/tmp/crash.log', err.stack);
  // 让守护进程重启
  process.exit(1);
});
```

> **这句话很值钱**：
> 「`uncaughtException` 的正确用法是『**记录 + 退出**』，不是『吞掉继续』。Node 官方文档明确说了这一点。真正要保证的是『进程退出后能被快速重启』——这是 PM2 / k8s 的职责，不是应用层的。」

### 事件与信号（生产必备）

#### 三个退出相关事件（实测顺序）

```
beforeExit 触发，code = 0   ← 事件循环空了，但还没退出
exit 触发，code = 0         ← 即将退出，只能同步
```

| 事件 | 时机 | 能做什么 |
|---|---|---|
| `beforeExit` | 事件循环**空了**，即将退出 | **可以注册新的异步任务**（会让循环继续） |
| `exit` | 进程**即将退出** | **只能同步** |
| `uncaughtException` | 未捕获的同步异常 | 记录 + 退出 |
| `unhandledRejection` | 未处理的 Promise rejection | 记录（Node 15+ 默认会退出） |

#### 信号（优雅退出必用）

```js
['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, async () => {
    console.log(`收到 ${signal}，开始优雅退出`);
    server.close();                       // 停止接收新请求
    await new Promise(r => setTimeout(r, 3000));   // 等在途请求
    await db.destroy();                   // 关闭连接池
    process.exit(0);
  });
});
```

**信号对照**：

| 信号 | 谁发的 | 能不能捕获 | 典型场景 |
|---|---|---|---|
| `SIGINT` | Ctrl+C | ✅ | 本地开发 |
| `SIGTERM` | `kill` / k8s / docker stop | ✅ | **生产优雅退出主要靠它** |
| `SIGKILL` | `kill -9` | ❌ **不能捕获** | 强制杀，无法优雅退出 |
| `SIGHUP` | 终端关闭 | ✅ | 常被用来「重载配置」 |

> **`SIGKILL` 不能捕获**这一条要记住——所以 k8s 的 `terminationGracePeriodSeconds` 到期后会发 SIGKILL，你必须在这之前完成清理。

### 面试怎么说（1 分钟版）

> 「`process` 我用三块来说：
>
> **第一是读信息**：`argv` 拿命令行参数（注意要 `slice(2)`，前两个是 node 路径和脚本路径）、`env` 拿环境变量、`cwd()` 拿工作目录、`memoryUsage()` 拿内存（**排查泄漏主要看 `heapUsed`**）、`versions` 拿各组件版本。
>
> **第二是控制行为**：`exitCode` 设退出码、`nextTick` 插微任务、`kill` 发信号。
>
> **第三是生命周期事件**，这块最容易踩坑：
> - `exit` 事件里**只能做同步操作**，因为事件循环已经停了
> - `process.exit()` 会**立即终止**，stdout 可能没刷完，所以生产优先用 `exitCode`
> - `uncaughtException` 里**不要试图继续运行**，正确做法是记录后退出，让 PM2/k8s 重启
>
> 生产上我一定会注册 `SIGTERM` 处理：停收新请求 → 等在途请求 → 关连接池 → 退出。**这是滚动发布不出错的前提。**」

### 追问链

| 追问 | 答法 |
|---|---|
| `process.exit()` 和 `exitCode` 区别？ | `exit()` 立即终止会丢异步输出；`exitCode` 让循环自然结束，更安全 |
| `nextTick` 和 `Promise.then` 谁先？ | **`nextTick` 先**。实测顺序：`sync → nextTick → Promise.then → queueMicrotask` |
| `nextTick` 会饿死 I/O 吗？ | 会。**递归 `nextTick` 会一直清空队列，事件循环推进不了**。实测递归 5 层后 `setImmediate` 才执行 |
| `process.env` 能改吗？ | 能改（`process.env.X = 1`），但**只影响当前进程**，不影响父进程，也不会持久化 |
| 怎么读 `package.json` 的版本号？ | ① `require('./package.json').version`（会被缓存）；② `JSON.parse(fs.readFileSync(...))`；③ ESM 里用 `createRequire` |
| `process.cwd()` 和 `__dirname` 区别？ | `cwd()` 是**启动时的工作目录**（可被 `cd` 改）；`__dirname` 是**文件所在目录**（永远不变） |
| 子进程怎么传参？ | `fork` 用 IPC（`send`/`on('message')`）；`spawn`/`exec` 用命令行参数 + 环境变量 |

---

## 1.4 本册追问总表

| 问题 | 一句话答 |
|---|---|
| Node 是什么？ | V8 + libuv + 标准库 |
| 「单线程」指什么？ | JS 执行单线程；I/O 有 libuv 线程池（默认 4） |
| 为什么不适合 CPU 密集？ | 只有 4 条线程池通道 + 主线程单线程，第 5 个任务就要排队 |
| 网络 I/O 为什么不用线程池？ | 走 OS 的 epoll/kqueue，一个线程能监听几万个 fd |
| `__dirname` 是全局对象吗？ | **不是**。来自模块包装函数的参数 |
| 模块包装函数长什么样？ | `(function (exports, require, module, __filename, __dirname) {...})` |
| `exports` 和 `module.exports` 区别？ | 初始同引用；重新赋值 `exports = {}` 会断链 |
| 怎么判断当前是入口模块？ | `require.main === module` |
| `memoryUsage` 排查看哪个字段？ | JS 泄漏看 `heapUsed`；Buffer 泄漏看 `external`/`arrayBuffers` |
| 默认堆上限多少？ | 约 4GB（实测 `heap_size_limit` 4144MB） |
| `exit()` 和 `exitCode` 区别？ | `exit()` 立即终止可能丢输出；`exitCode` 等循环自然结束 |
| `exit` 事件里能写文件吗？ | 只能 `writeFileSync`，异步不会执行 |
| `uncaughtException` 后能继续跑吗？ | 不能。记录后退出，让守护进程重启 |
| 优雅退出要处理哪些信号？ | `SIGINT` + `SIGTERM`（`SIGKILL` 无法捕获） |

---

## 1.5 速记卡

```
【Node 是什么】
V8（执行 JS）+ libuv（异步 I/O + 线程池）+ 标准库

【单线程的真相】★
JS 执行：单线程（一个调用栈、一个事件循环）
I/O：libuv 线程池默认 4 个
  → fs / dns.lookup / crypto.pbkdf2 走线程池
  → 网络 I/O 走 OS epoll，不占线程
实测：pbkdf2 4 并发 18ms，第 8 个 34ms
      UV_THREADPOOL_SIZE=1 时 4 并发 59ms（线性）
结论：不是 JS 慢，是通道太少

【全局对象分两类】★
真全局（在 globalThis 上）：
  global / process / Buffer / console
  setTimeout 系列 / queueMicrotask
  URL / TextEncoder / fetch(18+) / TextDecoder
模块作用域（不是全局！）：
  __dirname / __filename / module / exports / require
  ← 来自模块包装函数参数
  (function (exports, require, module, __filename, __dirname) {...})
实测：'__dirname' in globalThis === false
ESM 里没有 __dirname → 用 fileURLToPath(import.meta.url)

【process】
argv → ['node路径','脚本路径', ...用户参数]，取用户参数 slice(2)
memoryUsage：
  heapUsed ↑ → JS 对象泄漏
  external/arrayBuffers ↑ 但 heapUsed 平 → Buffer 泄漏
heap 上限实测 4144MB → --max-old-space-size 可调（但应该改用流）

【三个坑】
process.exit() 立即终止，stdout 可能截断 → 用 exitCode
exit 事件只能同步操作（循环已停）
uncaughtException 后不要继续运行 → 记录 + 退出

【事件顺序实测】
beforeExit（可注册异步）→ exit（只能同步）

【信号】
SIGINT（Ctrl+C）/ SIGTERM（k8s、docker stop）可捕获
SIGKILL（kill -9）不能捕获
```

---

## 1.6 自测

```
□ 能说出 Node 由哪三个部分组成
□ 能解释「单线程」到底指什么、什么不是单线程
□ 能说出 libuv 线程池默认大小和它影响哪些操作
□ 能说出网络 I/O 为什么不占线程
□ 能举出线程池打满的后果
□ 能说出 worker_threads 和 cluster 的本质区别
□ 能分清哪些是全局对象、哪些是模块作用域变量
□ 能写出模块包装函数
□ 能说出 '__dirname' in globalThis 的结果并解释原因
□ 能说出 ESM 里怎么拿到 __dirname
□ 能说出 exports 重新赋值为什么失效
□ 能说出 process.argv 前两项是什么
□ 能说出排查内存泄漏看 memoryUsage 的哪个字段
□ 能说出 RSS 涨但 heapUsed 平稳意味着什么
□ 能解释 process.exit() 和 exitCode 的区别
□ 能解释为什么 exit 事件里只能同步
□ 能说出 uncaughtException 的正确处理方式
□ 能说出优雅退出要处理哪几个信号、顺序如何
```
