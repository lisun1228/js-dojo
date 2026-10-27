# Node 07｜多进程、进程通信与 pm2

> 覆盖题号：26（两个 Node 进程如何通信）、24（pm2 守护进程原理）
> 去重后：**2 个考点**

---

## 目录

- [7.1 题单答案的问题](#71-题单答案的问题)
- [7.2 为什么需要多进程](#72-为什么需要多进程)
- [7.3 四种进程创建方式（前置知识）](#73-四种进程创建方式前置知识)
- [7.4 进程通信的四种方式](#74-进程通信的四种方式)
- [7.5 cluster：多进程共享端口（前置）](#75-cluster多进程共享端口前置)
- [7.6 pm2 是什么、原理](#76-pm2-是什么原理)
- [7.7 多进程带来的三个新问题](#77-多进程带来的三个新问题)
- [7.8 追问总表](#78-追问总表)
- [7.9 速记卡](#79-速记卡)
- [7.10 自测](#710-自测)

---

## 7.1 题单答案的问题

> **26.** 「`child_process` 的 `send/on('message')`；共享内存 / Redis / MQ；HTTP / WebSocket；cluster 模块的 IPC。」
> **24.** 「PM2 启动 Node 进程并 fork 子进程，主进程监控子进程，崩溃自动重启。cluster 模式启多个实例利用多核。日志轮转、负载均衡。」

题单列的是手段，缺的是**选择依据与失败模式**：

| 题 | 缺的关键点 |
|---|---|
| 26 通信 | 四种方式各自的适用场景；IPC 的底层；什么时候不能用 IPC |
| 24 pm2 | pm2 解决的是「运维」还是「代码」问题；cluster 的负载均衡会被 keep-alive 破坏 |

---

## 7.2 为什么需要多进程

Node 的 JS 主线程单线程、一个事件循环，同一时刻只用到一个核：

```
本机 os.cpus().length = 10，默认只有一个进程执行 JS
```

| 需求 | 解法 |
|---|---|
| 用满多核（提升吞吐） | `cluster` / `child_process.fork`（多进程）或 `worker_threads`（多线程） |
| 不阻塞主线程（CPU 密集任务） | `worker_threads` 或独立进程 |

| | `cluster` | `worker_threads` |
|---|---|---|
| 内存 | 不共享（各进程独立） | 可共享（`SharedArrayBuffer`） |
| 通信 | IPC（序列化） | 消息传递 + 共享内存 |
| 适合 | 扛 HTTP 请求（I/O 密集） | CPU 密集计算 |
| 崩溃影响 | 单个进程崩，其他还在 | 单线程崩，可能整个进程崩 |
| 端口 | 可以共享同一端口 | 同一进程内，无所谓 |

一句话：`cluster` 是多个进程共享同一端口吃满多核扛请求，`worker_threads` 是一个进程里多条线程把 CPU 密集任务挪出主线程；前者解决吞吐，后者解决阻塞。

---

## 7.3 四种进程创建方式（前置知识）

| API | 启动方式 | 有 IPC | 适合 |
|---|---|---|---|
| **`fork(modulePath)`** | 启动一个新的 Node 进程执行 JS 文件 | ✅ 自动建立 | Node 子进程（最常用） |
| **`spawn(cmd, args)`** | 启动任意可执行文件 | ❌ 需在 `stdio` 中显式配置 `ipc` | 调外部命令、流式处理 |
| **`exec(cmd)`** | 用 shell 执行，回调里拿完整输出 | ❌ | 小输出短命令（有注入风险） |
| **`execFile(file, args)`** | 直接执行文件，不经 shell | ❌ | 比 `exec` 安全 |

### `spawn` vs `exec`（安全 × 性能）

```js
// exec：经过 shell，命令拼接有注入风险
exec(`ls ${userInput}`);
// userInput 为 "; rm -rf /" 时会执行额外命令

// execFile / spawn：参数以数组传入，不经过 shell
execFile('ls', [userInput]);
```

| | `exec` | `spawn` |
|---|---|---|
| 是否经 shell | 是 | 否 |
| 输出 | 缓冲全部到内存，默认 `maxBuffer` 1MB | 流式，边读边处理 |
| 适合 | 小输出的短命令 | 大输出、长时间运行 |

实测（本机 Node v22.12.0）：`exec` 输出 933,337 字节正常；输出约 1.2MB 时报 `ERR_CHILD_PROCESS_STDIO_MAXBUFFER`，`stdout` 截断在 1,048,576 字节；同样 4MB 的输出用 `spawn` 流式读取正常结束。

---

## 7.4 进程通信的四种方式

### 方式 1：IPC（`fork` 专用）

```js
// 父进程
const child = fork('./child.js');
child.on('message', (msg) => console.log('收到:', msg));
child.send({ type: 'ping', n: 1 });
```

实测输出：

```
父进程 pid: 8041 | 子进程 pid: 8044
收到 {"type":"pong","echo":1,"pid":8044}
收到 {"type":"Buffer","data":[104,101,108,108,111]}   ← 默认序列化下的 Buffer
advanced 序列化 → Buffer(hello)
```

`fork` 自动建立 IPC 通道，底层：

| 平台 | IPC 底层 |
|---|---|
| Linux / macOS | Unix domain socket（`socketpair`） |
| Windows | 命名管道（named pipe） |

默认序列化是 JSON，因此：

- 不能传函数
- 不能传循环引用
- Buffer 会变成 `{ type: 'Buffer', data: [...] }`；需要保留 Buffer 时用 `serialization: 'advanced'`

```js
fork('./child.js', [], { serialization: 'advanced' });
```

IPC 的局限：

| 局限 | 说明 |
|---|---|
| 只能父子之间 | 兄弟进程不能直接 IPC，要经父进程转发 |
| 有背压 | `process.send` 在待发送消息积压超过阈值时返回 `false`，发送方要自行限速 |
| 不适合大数据 | 每次都要序列化 + 拷贝，传 100MB 的序列化开销可能超过重新读文件 |

所以 IPC 传「指令和元数据」，不传「数据本身」；要传大文件就传路径，让子进程自己读。

### 方式 2：Redis / MQ（跨机器）

跨机器的进程通信只能走网络：共享状态用 Redis / MQ，业务调用用 HTTP（方式 3）。

| 场景 | 用什么 |
|---|---|
| 多个 Node 实例共享 session | Redis |
| 任务队列（异步处理） | Redis List / BullMQ / RabbitMQ / Kafka |
| 广播（所有实例都要收到） | Redis Pub/Sub |
| 跨语言的系统间通信 | MQ（RabbitMQ / Kafka） |

多进程或多机器部署时，session、缓存、分布式锁、限流计数都不能留在进程内存里，必须外置；Redis 是共享状态的标准答案。

### 方式 3：HTTP / WebSocket

```js
// 服务之间调用
await fetch('http://other-service/api/x');

// 实时通信
const ws = new WebSocket('ws://other-service');
```

通用、跨语言、可观测（有日志、有链路追踪），但有协议开销。适合微服务之间的业务调用；不适合高频小消息（每进程每秒上千次的计数同步用 Redis 的 `INCR`）。

### 方式 4：共享内存（`SharedArrayBuffer` + `Atomics`）

只在 `worker_threads` 里才有意义，进程之间无法共享内存。

```js
const sab = new SharedArrayBuffer(1024);
const arr = new Int32Array(sab);
Atomics.add(arr, 0, 1);        // 原子操作
```

用于高频数值计算（图像处理、音视频、科学计算），业务代码基本用不到。

### 四种方式的选择树

```
需要跨机器？
  ├─ 是 → Redis / MQ（或者 HTTP 调用）
  └─ 否（同一台机器）
       ├─ 是父子进程，传的是「指令/元数据」
       │    → fork 的 IPC
       ├─ 是父子进程，传的是「大量数据」
       │    → 传文件路径，让子进程自己读
       ├─ 需要多进程共享「状态」（session/计数/锁）
       │    → Redis
       └─ CPU 密集计算，要共享大数组
            → worker_threads + SharedArrayBuffer
```

---

## 7.5 cluster：多进程共享端口（前置）

```js
// app.js
const cluster = require('cluster');
const http = require('http');

if (cluster.isPrimary) {
  for (let i = 0; i < 2; i++) cluster.fork();
  cluster.on('listening', (worker, addr) => {
    console.log('worker', worker.process.pid, '监听', addr.address + ':' + addr.port);
  });
} else {
  http.createServer((req, res) => res.end('handled by ' + process.pid)).listen(4310);
}
```

实测输出（本机 10 核）：

```
primary pid: 8100 | os.cpus().length: 10
worker 8102 监听 null:4310
worker 8103 监听 null:4310
```

两个 worker 都报告监听 `4310`，独立进程这样做会 `EADDRINUSE`。cluster 的做法：

### 原理：Primary 持有监听 socket，分发给 worker

```
① primary 创建 server 并 listen(4310)         ← 只有 primary 真正持有 socket
② fork 出 worker
③ primary 把 socket 的 fd 通过 IPC 传给 worker ← 关键：传文件描述符
④ worker 收到 fd 后用该 fd 创建 server 对象（不重新 listen）
⑤ 连接到达时 primary 按策略分发给某个 worker
```

`lsof -nP -iTCP:4310 -sTCP:LISTEN` 只列出 primary 的 pid，worker 侧没有 LISTEN 套接字，可印证第 ①③ 步。

两种分发策略：

| 策略 | 平台 | 行为 |
|---|---|---|
| Round-robin（默认） | 除 Windows 外所有平台 | primary 负责 accept，按顺序分发给 worker |
| Shared（共享） | Windows | 所有 worker 竞争 accept（OS 调度） |

### keep-alive 会破坏负载均衡

cluster 在连接层分发，不在请求层：一条 TCP 连接分给一个 worker 后，这条连接上的所有请求都由它处理。

实测（2 个 worker，串行 12 个请求）：

```
keepAlive true  x12: {"8102":12}
keepAlive false x12: {"8102":6,"8103":6}
```

Node 19 起 `http.globalAgent` 默认 `keepAlive: true`（本机 v22 实测 `http.globalAgent.options.keepAlive === true`），复用一条连接的客户端会把请求全部压到一个 worker。

| 场景 | 影响 |
|---|---|
| 浏览器 → 服务 | 通常并发多条连接，影响相对小 |
| 服务 A → 服务 B（Node 客户端） | 默认 keepAlive，一个上游实例可能只打到下游一个实例，负载严重不均 |
| 压测 | 单连接压测会误判 cluster 没生效 |

解法：客户端避免长连接复用（多开连接或 `keepAlive: false`），或在上层做负载均衡（Nginx / 服务网格）。

### cluster 的四个限制

| 限制 | 说明 | 影响 |
|---|---|---|
| 内存不共享 | 每个 worker 独立 | session / 缓存要外置到 Redis |
| 端口共享靠 primary | primary 是单点 | primary 挂了，监听与分发都失效 |
| 不能热重载代码 | 改了代码要重启 worker | pm2 的 `reload` 会逐个重启（不中断服务） |
| worker 之间不直接通信 | 只能经 primary 转发 | 跨 worker 状态同步要用 Redis |

---

## 7.6 pm2 是什么、原理

### 一句话结论

> pm2 是进程守护 + 集群管理工具。它不改变代码，只负责让进程活着、用满多核、日志能看。

### pm2 和 Node cluster 的关系

| | Node 的 `cluster` 模块 | pm2 的 `cluster` 模式 |
|---|---|---|
| 谁在用 | 代码里 `require('cluster')` | pm2 帮你 fork，代码不用改 |
| 分发 | 代码里写 | pm2 实现（基于 cluster 模块） |
| 关系 | 底层机制 | 封装了这个机制 |

用 pm2 cluster 模式时代码里不要再 `require('cluster')`，否则每个 pm2 实例内又会 fork 一层。

```bash
pm2 start app.js -i 4      # 4 个实例
pm2 start app.js -i max    # 实例数匹配 CPU 核数
```

`app.js` 保持普通单进程服务器：

```js
const http = require('http');
http.createServer((req, res) => res.end('ok')).listen(3000);
```

### pm2 做了四件事

| 功能 | 说明 |
|---|---|
| 守护（daemon） | pm2 常驻并监控子进程，子进程崩溃立即重启 |
| 集群（cluster） | `-i N` 起 N 个实例，共享端口 |
| 日志 | 收集 stdout/stderr 到文件，可配 `pm2-logrotate` 轮转 |
| 监控 | `pm2 monit` 查看 CPU / 内存 / 重启次数 |

常用命令：

```bash
pm2 start app.js --name api -i max
pm2 list                        # 看所有进程状态
pm2 logs api                    # 看日志
pm2 monit                       # 实时监控
pm2 reload api                  # 逐个替换 worker，零停机
pm2 restart api                 # 全部重启，有短暂中断
pm2 stop / delete api
pm2 startup                     # 生成开机自启脚本
pm2 save                        # 保存当前进程列表
```

| 命令 | 行为 | 服务中断 |
|---|---|---|
| `restart` | 全部杀掉再启动 | 有（几秒不可用） |
| `reload` | 逐个替换 worker，先起新的再杀旧的 | 无（始终有 worker 在服务） |

`reload` 零停机的前提是应用能优雅退出：旧 worker 若有未处理完的请求，会被直接杀掉。

### pm2 不解决的事

| pm2 不解决 | 要自己做 |
|---|---|
| 优雅退出 | 监听 `SIGINT`/`SIGTERM`，停收新请求、等在途请求、关连接池 |
| 多进程状态共享 | session / 缓存 / 限流计数外置 Redis |
| 日志分级与结构化 | pm2 只收集，格式自己定（建议 JSON 行） |
| 内存泄漏 | `max_memory_restart` 只是涨到阈值就重启 |
| 健康检查 | 提供 `/health` 接口，配合负载均衡摘除 |

#### `max_memory_restart` 不是解法

```bash
pm2 start app.js --max-memory-restart 1G
```

内存超阈值就重启，只能让服务在泄漏状态下继续存活：

```
内存泄漏 → 涨到阈值 → pm2 重启 → 内存归零 → 继续涨
```

它能当兜底，不能当修复。`pm2 list` 里 restart 次数持续增长，说明存在内存泄漏。

#### 优雅退出（必须自己写）

```js
const server = app.listen(3000);

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`收到 ${signal}，开始优雅退出`);

  // ① 停止接收新连接
  server.close(async () => {
    // ③ 关闭资源
    await db.destroy();
    await redis.quit();
    process.exit(0);
  });

  // ② 给在途请求一个超时上限，超时强制退出
  setTimeout(() => {
    console.error('超时，强制退出');
    process.exit(1);
  }, 10_000).unref();      // unref 不让定时器阻止进程退出
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
```

pm2 的 `kill_timeout` 控制 SIGTERM 到 SIGKILL 的间隔：

```json
// ecosystem.config.js
{
  "apps": [{
    "name": "api",
    "script": "app.js",
    "instances": "max",
    "exec_mode": "cluster",
    "kill_timeout": 5000,        // 发 SIGTERM 后等 5s 再 SIGKILL
    "wait_ready": true,          // 等 process.send('ready') 才算启动完成
    "listen_timeout": 10000
  }]
}
```

默认 pm2 把「进程启动」当作「可以服务」，但 Node 启动后还要连数据库、预热缓存。`wait_ready: true` 让 pm2 等到应用发出 `process.send('ready')` 才认为就绪，配合 `reload` 才能滚动发布零失败。

---

## 7.7 多进程带来的三个新问题

多进程后「进程内就是全局」的假设失效。

### 问题 1：session / 状态

```js
// ❌ 内存存 session：每个 worker 一份，请求打到别的 worker 就"登出"
const sessions = new Map();
```

解决：外置到 Redis。

### 问题 2：定时任务会重复执行

```js
// ❌ 4 个 worker，这个定时任务会跑 4 次
setInterval(() => { sendDailyReport(); }, 24 * 60 * 60 * 1000);
```

| 方案 | 做法 |
|---|---|
| 只让一个 worker 跑 | 判断 `cluster.isPrimary`，或 pm2 注入的 `process.env.NODE_APP_INSTANCE === '0'` |
| 分布式锁 | Redis `SET key value NX EX 60`，拿到锁才执行 |
| 独立进程 | 定时任务单独部署（最干净） |

`NODE_APP_INSTANCE` 只在 pm2 cluster 模式下有值；k8s 等环境要用别的机制。

### 问题 3：日志交错

```
多个进程同时写同一个日志文件 → 行交错、截断
```

解决：pm2 按进程分文件（`api-0.log`、`api-1.log`）；或输出到 stdout，由容器/收集器统一处理（k8s 推荐）。

---

## 7.8 追问总表

| 问题 | 一句话答 |
|---|---|
| 为什么需要多进程？ | 一个进程一个事件循环，只能用到 1 核 |
| cluster 和 worker_threads 区别？ | 前者多进程（不共享内存，扛请求），后者多线程（可共享内存，跑计算） |
| fork / spawn / exec 区别？ | fork 启动 Node 子进程有 IPC；spawn 流式无 shell；exec 经 shell 缓冲输出 |
| exec 的两个问题？ | 命令注入风险 + `maxBuffer` 限制（默认 1MB） |
| IPC 底层是什么？ | Unix domain socket（Linux/macOS）/ 命名管道（Windows） |
| IPC 能传什么？ | JSON 可序列化的（默认）。Buffer 也可以，但要用 `serialization: 'advanced'` |
| IPC 不适合传什么？ | 大量数据（序列化开销大）。应该传文件路径 |
| 兄弟进程能直接 IPC 吗？ | 不能，要经父进程转发 |
| cluster 怎么做到共享端口？ | primary 持有 socket，通过 IPC 把 fd 传给 worker |
| cluster 在什么层面分发？ | 连接层，不是请求层；keep-alive 会让请求集中到一个 worker（12 请求：keepAlive true → 1 个 worker，false → 6/6） |
| pm2 和 Node cluster 关系？ | pm2 封装了 cluster 模块，代码里不要再 require |
| pm2 reload 和 restart 区别？ | reload 逐个替换（零停机），restart 全杀全起（有中断） |
| pm2 不解决什么？ | 优雅退出、状态共享、日志结构化、内存泄漏 |
| max_memory_restart 是解法吗？ | 不是，是兜底。restart 次数增长说明有泄漏 |
| 多进程下定时任务会跑几次？ | N 个 worker 就跑 N 次。要用 `NODE_APP_INSTANCE` 或分布式锁 |
| 多进程下 session 怎么办？ | 外置 Redis |

---

## 7.9 速记卡

```
【为什么多进程】
一个进程 = 一个事件循环 = 1 核
cluster（多进程）→ 吞吐
worker_threads（多线程）→ 不阻塞（可共享内存）

【四种创建】
fork      启动 Node 子进程，自动有 IPC   ← 最常用
spawn     任意命令，流式，不经 shell
exec      经 shell，缓冲全部输出（maxBuffer 1MB），有注入风险
execFile  不经 shell，比 exec 安全

【通信四种】
IPC        父子专用，底层 Unix socket / 命名管道
           只适合指令和元数据，不适合大数据（序列化开销）
Redis/MQ   跨机器共享状态的标准答案（服务调用走 HTTP/WS）
HTTP/WS    通用、跨语言、可观测，但有协议开销
SharedArrayBuffer  只有 worker_threads 才有意义

【cluster 原理】
primary 持有 socket → fork worker → 通过 IPC 传 fd
→ worker 用同一个 fd 创建 server（不重新 listen）
→ 连接到达时 primary 分发（Round-robin）

【keep-alive 破坏负载均衡】
keepAlive true  → 12 请求落 1 个 worker（12）
keepAlive false → 12 请求落 2 个 worker（6 / 6）
根因：分发在「连接层」不是「请求层」
影响：① 单连接压测会误判 cluster 失效
     ② 服务间调用（Node client 默认 keepAlive）负载不均

【cluster 四个限制】
内存不共享 → session 要外置 Redis
primary 单点 → 挂了服务不可用
不能热重载 → 要重启 worker
worker 间不能直连 → 经 primary 或 Redis

【pm2 四件事】
守护（崩了重启）/ 集群（-i max）/ 日志轮转 / 监控
reload（逐个替换，零停机）vs restart（全杀全起，有中断）

【pm2 不解决】
优雅退出（自己监听 SIGTERM）
状态共享（Redis）
日志结构化（自己定 JSON 格式）
内存泄漏（max_memory_restart 是兜底不是解法）
restart 次数增长 = 有泄漏，要查不能掩盖

【多进程三个新问题】
session 在内存 → 用户"随机登出" → 外置 Redis
定时任务跑 N 次 → NODE_APP_INSTANCE==='0' 或分布式锁 或独立部署
日志交错 → pm2 分文件 / 输出到 stdout 由容器收集

【ecosystem 关键配置】
kill_timeout: 5000    SIGTERM 后等 5s 再 SIGKILL
wait_ready: true      等 process.send('ready') 才算启动完成
                      ← 滚动发布零失败的前提
```

---

## 7.10 自测

```
□ 能说出为什么需要多进程（一句话）
□ 能区分 cluster 和 worker_threads 的适用场景
□ 能说出 fork/spawn/exec/execFile 的差别
□ 能说出 exec 的两个问题
□ 能说出 IPC 的底层实现
□ 能说出 IPC 不适合传什么、为什么
□ 能说出兄弟进程为什么不能直接 IPC
□ 能说清 cluster 共享端口的原理（fd 传递）
□ 能说出 keep-alive 为什么会让 cluster 负载不均
□ 能说出该现象的两个实际影响
□ 能说出 cluster 的四个限制
□ 能说出 pm2 做的四件事
□ 能解释 pm2 cluster 和 Node cluster 的关系、为什么不能同时用
□ 能说出 reload 和 restart 的区别
□ 能说出 pm2 不解决的四件事
□ 能解释 max_memory_restart 为什么是兜底不是解法
□ 能写出优雅退出的核心代码
□ 能说出 kill_timeout 和 wait_ready 的作用
□ 能说出多进程下定时任务重复执行的三种解法
```
