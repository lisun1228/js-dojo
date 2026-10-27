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

### 一句话结论

> Node = V8（执行 JS）+ libuv（异步 I/O 与线程池）+ 标准库。
>
> 它用「单线程 + 事件循环」换取 I/O 并发密度，代价是 CPU 密集任务会阻塞所有请求。

### 常见误区

| 说法 | 修正 |
|---|---|
| 「单进程不稳定」 | 「不稳定」多指崩溃后无人重启，属于运维问题；守护进程可解决，不是 Node 的固有缺点 |
| 「不适合 CPU 密集」 | 结论对；原因是 JS 在主线程执行，CPU 密集任务会占满事件循环 |
| 「事件驱动、非阻塞 I/O」 | 只说对一半；文件、DNS、加密等操作由 libuv 线程池执行 |

### 「单线程」只对了一半

- JS 执行单线程：一个主线程、一个调用栈、一个事件循环。
- libuv 线程池默认 4 个线程，负责没有系统级异步接口的操作：大部分 `fs` 方法、`dns.lookup`、`crypto.pbkdf2`/`scrypt`。
- 网络 I/O（TCP/UDP）走操作系统的 epoll/kqueue，不占线程池，因此一个进程可以维持大量并发连接。
- 运行在主线程上的 CPU 密集 JS 会真正阻塞事件循环。

### 实测：线程池默认 4 个

8 个 `crypto.pbkdf2` 任务（迭代 120000，本机一次测量）：

```
默认                  前 4 个 36–48ms 完成，后 4 个 70–85ms 完成，总计 85ms
UV_THREADPOOL_SIZE=1  约每 20ms 完成一个，总计 159ms
```

前 4 个任务并行，第 5 个开始排队。这是「Node 不适合 CPU 密集」的物理原因：不是 JS 执行慢，而是线程池只有 4 条通道。

### 什么任务会阻塞事件循环

| 类型 | 例子 | 执行位置 | 阻塞主线程 |
|---|---|---|---|
| 网络 I/O | `http.request`、`net.Socket` | OS 的 epoll/kqueue | 否 |
| 定时器 | `setTimeout`、`setInterval` | libuv timer | 否 |
| 文件 I/O | `fs.readFile`、`fs.stat` | libuv 线程池 | 否，但线程池排队会变慢 |
| DNS | `dns.lookup` | libuv 线程池（`dns.resolve` 走网络） | 否，同上 |
| 加密 | `crypto.pbkdf2`、`scrypt` | libuv 线程池 | 否，同上 |
| 同步文件 API | `fs.readFileSync` | 主线程 | 是 |
| CPU 密集 JS | 大循环、复杂计算、大字符串 `JSON.parse`、正则回溯 | 主线程 | 是 |

`dns.lookup` 依赖 `getaddrinfo`，使用线程池；`dns.resolve` 直接发 DNS 查询，不走线程池。

### 优缺点

| 优点 | 原因 |
|---|---|
| 高并发（I/O 密集） | 网络 I/O 不占线程，一个进程能挂大量连接 |
| 内存占用低 | 没有「一连接一线程」的栈开销 |
| 前后端同语言 | SSR/BFF 可复用代码 |
| 启动快 | 没有 JVM 式预热，适合 Serverless/容器 |

| 缺点 | 原因 | 缓解 |
|---|---|---|
| 不适合 CPU 密集 | 主线程单线程，线程池仅 4 个 | `worker_threads`、独立服务、原生插件 |
| 单点故障 | 一个进程承载所有请求，异常退出会影响整体可用性 | 守护进程 + 多实例 |
| 异步栈难调试 | 回调链断开调用栈 | `--inspect`、`async_hooks` |
| 生态质量参差 | npm 包质量不可控 | 锁版本、审计、少用冷门包 |

### 应用场景

| 场景 | 适配度 | 原因 |
|---|---|---|
| API 服务 / 网关 / BFF | 高 | 以 I/O 等待为主 |
| SSR / 实时应用（IM、推送、协作） | 高 | 同构代码、长连接内存效率高 |
| 工具链 / CLI | 高 | Webpack、Vite、ESLint 均基于 Node |
| 图片/视频处理、大数据、强事务金融核心 | 低 | CPU 密集或生态不匹配 |

### 面试怎么说（2 分钟版）

- Node 由 V8、libuv 和标准库组成，设计取向是用单线程换 I/O 并发密度。
- JS 执行是单线程；文件、DNS、加密走 libuv 线程池（默认 4），网络 I/O 走 OS 的 epoll/kqueue。
- 线程池只有 4 条通道，第 5 个文件或加密任务开始排队，所以 CPU 密集任务会拖慢整个进程。
- 选型：I/O 密集、长连接、BFF、SSR、工具链用 Node；CPU 密集拆到 `worker_threads` 或独立服务。

### 追问链（Node 理解）

| 追问 | 答法 |
|---|---|
| 线程池打满了会怎样？ | 文件、DNS、加密操作排队；主线程不阻塞，但响应变慢，表现为「接口变慢但 CPU 不高」 |
| `UV_THREADPOOL_SIZE` 设多大？ | 默认 4 对多数场景够；大量文件操作可调到 8~16，不宜远超 CPU 核心数 |
| `worker_threads` 和 `cluster` 区别？ | `worker_threads` 是同进程多线程，可用 `SharedArrayBuffer` 共享内存，适合 CPU 密集；`cluster` 是多进程，各有独立内存，适合利用多核扛请求 |

---

## 1.2 Node.js 有哪些全局对象

### 分类结论

题单清单混了两类东西：

- 在 `globalThis` 上：`global`、`process`、`Buffer`、`console`、定时器。
- 不在 `globalThis` 上：`__dirname`、`__filename`、`module`、`exports`、`require`，它们来自模块包装函数的参数。

`__dirname` 不是全局对象，这是这道题的核心考点。

### 实测：哪些在 globalThis 上

```
globalThis === global           → true
'__dirname' in globalThis       → false
typeof __dirname                → string
require('node:module').wrapper  → ["(function (exports, require, module, __filename, __dirname) { ", "\n});"]
```

### 模块包装函数

Node 执行每个 CJS 文件前，会把它包进一个函数：

```js
(function (exports, require, module, __filename, __dirname) {
  // 模块代码
})
```

`__dirname` 是这个函数的第五个参数，因此每个模块拿到自己的路径；模块隔离靠函数作用域，不靠作用域链。

ESM 没有这层包装，`__dirname` 不存在，需要用 `import.meta.url` 计算：

```js
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
```

### 完整分类表

#### ① 真正的全局对象（在 `globalThis` 上）

| 类别 | 成员 |
|---|---|
| 核心对象 | `global`（`globalThis` 的别名）、`process`、`Buffer`、`console` |
| 定时器 | `setTimeout` / `clearTimeout` / `setInterval` / `clearInterval` / `setImmediate` / `clearImmediate` |
| 微任务 | `queueMicrotask` |
| URL 相关 | `URL`、`URLSearchParams` |
| 编解码 | `TextEncoder`、`TextDecoder`、`atob`、`btoa` |
| 网络 | `fetch`、`Request`、`Response`、`Headers`、`WebSocket` |
| 能力 | `AbortController`、`AbortSignal`、`structuredClone`、`performance`、`crypto` |
| 错误类型 | `Error`、`TypeError`、`RangeError` 等 JS 内置 |

`fetch` 从 Node 18 起在全局上；`crypto` 全局是 Web Crypto API（`crypto.subtle`、`crypto.randomUUID()`），不包含 `node:crypto` 的 `createHash`。

#### ② 模块作用域变量（不在 `globalThis`，只存在于包装函数参数里）

| 成员 | 说明 |
|---|---|
| `module` | 当前模块对象，有 `exports` / `filename` / `id` / `parent` / `children` |
| `exports` | `module.exports` 的初始引用 |
| `require` | 加载函数，带 `resolve` / `cache` / `main` 属性 |
| `__filename` | 当前文件的绝对路径 |
| `__dirname` | 当前文件所在目录的绝对路径 |

#### ③ 浏览器有但 Node 没有的

| 成员 | Node 里的替代 |
|---|---|
| `window` / `document` | 不存在，需要 jsdom |
| `localStorage` | Node 22+ 需 `--experimental-webstorage` + `--localstorage-file` |
| `alert` / `confirm` | 不存在 |
| `navigator` | Node 21+ 有部分实现（如 `navigator.userAgent`） |
| `location` | 不存在，用 `import.meta.url` 或 `process.cwd()` |

### 面试怎么说（全局对象）

- 全局对象按「是否在 `globalThis` 上」分两类。
- 真全局：`global`、`process`、`Buffer`、`console`、定时器、`queueMicrotask`、`URL`、`fetch` 等 Web 标准 API。
- 模块作用域：`__dirname`、`__filename`、`module`、`exports`、`require`；原因是 CJS 包装函数的参数。
- ESM 没有包装函数，`__dirname` 需用 `import.meta.url` 和 `fileURLToPath` 计算。

### 追问链（全局对象）

| 追问 | 答法 |
|---|---|
| `exports` 和 `module.exports` 区别？ | 初始指向同一对象；`exports = {...}` 会断开引用（重新赋值局部变量），`module.exports = {...}` 才生效 |
| 为什么 `exports.a = 1` 生效但 `exports = { a: 1 }` 不行？ | 前者修改对象内容，后者修改局部变量指向；`require` 返回的始终是 `module.exports` |
| `require` 上有哪些属性？ | `require.resolve`（解析路径不加载）、`require.cache`（模块缓存）、`require.main`（入口模块）、`require.extensions`（已废弃） |
| 怎么判断当前模块是入口？ | `require.main === module`，CLI 工具常用 |
| `global` 和 `globalThis` 区别？ | `globalThis` 是 ES2020 标准；浏览器里是 `window`，Node 里 `global` 是它的别名。新代码统一用 `globalThis` |

---

## 1.3 process 的理解

### process 的定位

> `process` 是当前 Node 进程的句柄：既能读信息（环境、参数、内存），也能控制行为（退出码、信号、优先级）。

### 常用属性

```js
process.pid // 当前进程 id
process.ppid // 父进程 id
process.version // Node 版本
process.platform // 'darwin' | 'linux' | 'win32'
process.arch // 'arm64' | 'x64'
process.execPath // node 可执行文件绝对路径
process.cwd() // 当前工作目录
process.argv // [node 路径, 脚本路径, ...用户参数]
process.execArgv // node 启动参数，如 --max-old-space-size
process.uptime() // 进程运行秒数
process.versions.v8 // V8 版本
```

#### `process.argv` 的结构

```js
// 执行：node app.js arg1 arg2
process.argv
// ['/path/to/node', '/path/to/app.js', 'arg1', 'arg2']
//   argv[0]         argv[1]             用户参数从 argv[2] 开始
```

取用户参数用 `process.argv.slice(2)`。

#### `process.memoryUsage()` 的五个字段

一次实测：

```
rss           39.9 MB   进程占用的物理内存总量（含 C++ 对象、栈、堆）
heapTotal      5.0 MB   V8 已申请的堆内存
heapUsed       3.7 MB   V8 实际使用的堆内存
external       1.3 MB   C++ 对象占用的内存（Buffer、绑定对象）
arrayBuffers   0.01 MB  ArrayBuffer / Buffer 占用的内存
```

排查内存泄漏：

| 现象 | 看什么 | 说明 |
|---|---|---|
| 内存持续增长，`heapUsed` 跟着涨 | `heapUsed` | JS 对象泄漏，用 heap snapshot 定位 |
| `rss` 涨但 `heapUsed` 不涨 | `external` / `arrayBuffers` | Buffer 泄漏，常见于未释放的流 |
| `rss` 远大于 `heapTotal` + `external` | 内存碎片或 native 插件泄漏 | 调 `--max-old-space-size` 或排查插件 |

#### `v8.getHeapStatistics()` 的堆上限

```
heap_size_limit = 4144 MB
```

64 位系统默认堆上限约 4GB，可用 `node --max-old-space-size=8192 app.js` 调大。调大只是推迟 OOM，流式处理才是根本解法。

### 三个必须知道的坑

#### 坑 1：`process.exit()` 会立即终止进程

```js
process.exit(0) // 立即退出，不等异步操作完成
```

当 stdout 是异步写入目标（如 POSIX 管道）时，`process.exit()` 可能在缓冲区刷出前终止进程，导致输出截断。

```js
process.exitCode = 1 // 只设置退出码，等事件循环自然结束

// 或主动关闭资源后再退出
server.close(() => {
  db.close(() => process.exit(0))
})
```

`exit()` 立即终止，可能丢日志、断连接；`exitCode` 等事件循环清空，pending I/O 会完成。生产代码优先用 `exitCode`。

#### 坑 2：`exit` 事件里只能做同步操作

```js
process.on('exit', (code) => {
  fs.writeFile('log.txt', 'bye', () => {}) // 不会执行
  fs.writeFileSync('log.txt', 'bye') // 可以执行
})
```

`exit` 事件在事件循环停止之后触发，没有下一轮循环，异步回调不会执行。

#### 坑 3：`uncaughtException` 后不要继续运行

```js
process.on('uncaughtException', (err) => {
  console.error('未捕获异常，准备退出:', err)
  fs.writeFileSync('/tmp/crash.log', err.stack)
  process.exit(1) // 交给守护进程重启
})
```

未捕获异常发生时，可能有半个事务未提交、锁未释放、内存结构不一致，继续运行会产生更难排查的问题。正确做法是记录后退出，由 PM2/k8s 重启。

### 事件与信号

#### 退出相关事件

```
beforeExit 触发，code = 0   ← 事件循环空了，但还没退出
exit 触发，code = 0         ← 即将退出，只能同步
```

| 事件 | 时机 | 能做什么 |
|---|---|---|
| `beforeExit` | 事件循环空了，即将退出 | 可以注册新的异步任务（会让循环继续） |
| `exit` | 进程即将退出 | 只能同步 |
| `uncaughtException` | 未捕获的同步异常 | 记录后退出 |
| `unhandledRejection` | 未处理的 Promise rejection | 记录；Node 15+ 默认退出 |

#### 信号

```js
['SIGINT', 'SIGTERM'].forEach((signal) => {
  process.on(signal, async () => {
    console.log(`收到 ${signal}，开始优雅退出`)
    server.close() // 停止接收新请求
    await new Promise((r) => setTimeout(r, 3000)) // 等在途请求
    await db.destroy() // 关闭连接池
    process.exit(0)
  })
})
```

| 信号 | 谁发的 | 能否捕获 | 典型场景 |
|---|---|---|---|
| `SIGINT` | Ctrl+C | 能 | 本地开发 |
| `SIGTERM` | `kill` / k8s / `docker stop` | 能 | 生产优雅退出主要靠它 |
| `SIGKILL` | `kill -9` | 不能 | 强制杀，无法优雅退出 |
| `SIGHUP` | 终端关闭 | 能 | 常用来重载配置 |

`SIGKILL` 无法捕获；k8s 的 `terminationGracePeriodSeconds` 到期后会发 `SIGKILL`，清理必须在这之前完成。

### 面试怎么说（1 分钟版）

- 读信息：`argv`（用户参数从 `slice(2)` 开始）、`env`、`cwd()`、`memoryUsage()`、`versions`。
- 控制行为：`exitCode`、`nextTick`、`kill`。
- 生命周期：`exit` 事件只能同步；`exit()` 立即终止；`uncaughtException` 记录后退出。
- 生产优雅退出：收到 `SIGTERM` 后停收新请求 → 等在途请求 → 关连接池 → 退出。

### 追问链（process）

| 追问 | 答法 |
|---|---|
| `nextTick` 和 `Promise.then` 谁先？ | `nextTick` 先。实测顺序：`sync → nextTick → Promise.then → queueMicrotask` |
| `nextTick` 会饿死 I/O 吗？ | 会。只要 `nextTick` 持续入队，队列一直非空，事件循环无法进入下一阶段；递归停止后 `setImmediate` 才执行 |
| `process.env` 能改吗？ | 能改（`process.env.X = 1`），影响当前进程及之后创建的子进程，不影响父进程，也不会持久化 |
| 怎么读 `package.json` 的版本号？ | `require('./package.json').version`（会被缓存）；或 `JSON.parse(fs.readFileSync(...))`；ESM 里用 `createRequire` |
| `process.cwd()` 和 `__dirname` 区别？ | `cwd()` 是进程当前工作目录，`process.chdir()` 可改；`__dirname` 是文件所在目录，不随 cwd 变化 |
| 子进程怎么传参？ | `fork` 用 IPC（`send`/`on('message')`）；`spawn`/`exec` 用命令行参数和环境变量 |

---

## 1.4 本册追问总表

| 问题 | 一句话答 |
|---|---|
| Node 是什么？ | V8 + libuv + 标准库 |
| 「单线程」指什么？ | JS 执行单线程；I/O 有 libuv 线程池（默认 4）和 OS 异步接口 |
| 为什么不适合 CPU 密集？ | 主线程单线程，线程池只有 4 条通道，第 5 个任务开始排队 |
| `__dirname` 是全局对象吗？ | 不是，来自 CJS 模块包装函数的参数 |
| 模块包装函数长什么样？ | `(function (exports, require, module, __filename, __dirname) {...})` |
| `exports` 和 `module.exports` 区别？ | 初始同引用；`exports = {}` 会断链 |
| 怎么判断当前是入口模块？ | `require.main === module` |
| `memoryUsage` 排查看哪个字段？ | JS 泄漏看 `heapUsed`；Buffer 泄漏看 `external`/`arrayBuffers` |
| `exit()` 和 `exitCode` 区别？ | `exit()` 立即终止可能丢输出；`exitCode` 等循环自然结束 |
| 退出事件里能写文件吗？ | 只能 `writeFileSync`，异步不会执行 |
| `uncaughtException` 后能继续跑吗？ | 不能，记录后退出，让守护进程重启 |
| 优雅退出处理哪些信号？ | `SIGINT` + `SIGTERM`；`SIGKILL` 无法捕获 |

---

## 1.5 速记卡

```
【Node】V8 + libuv + 标准库
【单线程】JS 执行单线程；libuv 线程池默认 4
【线程池】fs / dns.lookup / crypto.pbkdf2；网络 I/O 走 epoll，不占线程
【全局对象】globalThis：global / process / Buffer / console / 定时器 / URL / fetch
【模块作用域】__dirname / __filename / module / exports / require
【来源】(function (exports, require, module, __filename, __dirname) {})
【ESM】fileURLToPath(import.meta.url)
【内存】heapUsed ↑ = JS 泄漏；external / arrayBuffers ↑ = Buffer 泄漏
【退出】exit() 立即终止；exitCode 等循环自然结束；exit 事件只能同步
【异常】uncaughtException 记录后退出
【信号】SIGINT / SIGTERM 可捕获；SIGKILL 不可
```

---

## 1.6 自测

```
□ Node 由哪三部分组成
□ 「单线程」指什么、什么不是单线程
□ libuv 线程池默认大小，影响哪些操作
□ 网络 I/O 为什么不占线程
□ 线程池打满后的现象
□ worker_threads 和 cluster 的区别
□ 哪些是全局对象、哪些是模块作用域变量
□ 模块包装函数的参数顺序
□ '__dirname' in globalThis 的结果及原因
□ ESM 里怎么拿到 __dirname
□ exports 重新赋值为什么失效
□ process.argv 前两项是什么
□ memoryUsage 排查泄漏看哪个字段
□ RSS 涨但 heapUsed 平稳意味着什么
□ exit() 和 exitCode 的区别
□ exit 事件里为什么只能同步
□ uncaughtException 的正确处理
□ 优雅退出处理哪些信号、顺序如何
```
