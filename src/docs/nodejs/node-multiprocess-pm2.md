# Node 07｜多进程、进程通信与 pm2

> 覆盖题号：26（两个 Node 进程如何通信）、24（pm2 守护进程原理）
> 去重后：**2 个考点**

---

## 7.1 题单答案的问题

> **26.** 「`child_process` 的 `send/on('message')`；共享内存 / Redis / MQ；HTTP / WebSocket；cluster 模块的 IPC。」
> **24.** 「PM2 启动 Node 进程并 fork 子进程，主进程监控子进程，崩溃自动重启。cluster 模式启多个实例利用多核。日志轮转、负载均衡。」

**这两条把「有什么」列全了，但没说「怎么选」和「有什么坑」**。

| 题 | 题单缺的关键点 |
|---|---|
| 26 通信 | **四种方式各自的适用场景**、**IPC 的底层是什么**、**什么时候不能用 IPC** |
| 24 pm2 | **pm2 解决的是「运维」还是「代码」问题**、**cluster 模式的负载均衡会被 keep-alive 破坏**（我实测到了） |

---

## 7.2 为什么需要多进程

先说清这个问题，否则后面全是「技术清单」。

Node 的局限是**一个进程只有一个事件循环**：

```
一个进程 = 一个 CPU 核心
即使机器有 32 核，Node 默认也只用 1 核
```

**两个需求**：

| 需求 | 解法 |
|---|---|
| **用满多核**（提升吞吐） | `cluster` / `child_process.fork`（多进程）或 `worker_threads`（多线程） |
| **不阻塞主线程**（CPU 密集任务） | `worker_threads` 或独立进程 |

**关键区分**：

| | `cluster` | `worker_threads` |
|---|---|---|
| 内存 | **不共享**（各进程独立） | **可共享**（`SharedArrayBuffer`） |
| 通信 | IPC（序列化） | 消息传递 + 共享内存 |
| 适合 | **扛 HTTP 请求**（I/O 密集） | **CPU 密集计算** |
| 崩溃影响 | 单个进程崩，其他还在 | 单线程崩，可能整个进程崩 |
| 端口 | **可以共享同一端口** | 同一进程内，无所谓 |

> **一句话区分**：
> 「`cluster` 是**多个进程抢同一个端口**，用来吃满多核扛请求；`worker_threads` 是**一个进程里多条线程**，用来把 CPU 密集任务挪出主线程。**前者解决『吞吐』，后者解决『阻塞』。**」

---

## 7.3 四种进程创建方式（题 26 的前置知识）

| API | 启动方式 | 有 IPC | 适合 |
|---|---|---|---|
| **`fork(modulePath)`** | 启动一个新的 Node 进程执行 JS 文件 | ✅ **自动建立** | Node 子进程（**最常用**） |
| **`spawn(cmd, args)`** | 启动任意可执行文件 | ❌（要手动配 stdio） | 调外部命令、流式处理 |
| **`exec(cmd)`** | 用 shell 执行，返回完整输出 | ❌ | 简单命令（**有注入风险**） |
| **`execFile(file, args)`** | 直接执行文件，不经 shell | ❌ | 比 `exec` 安全 |

### `spawn` vs `exec`（安全 × 性能）

```js
// ❌ exec：经过 shell，有命令注入风险
exec(`ls ${userInput}`);
// 如果 userInput 是 "; rm -rf /"，灾难

// ✅ execFile / spawn：参数是数组，不经过 shell
execFile('ls', [userInput]);
```

| | `exec` | `spawn` |
|---|---|---|
| 是否经 shell | ✅ 是 | ❌ 否 |
| 输出 | **缓冲全部到内存**（有 `maxBuffer` 限制，默认 1MB） | **流式**（可边读边处理） |
| 适合 | 小输出的短命令 | **大输出、长时间运行** |

> **如果一个命令输出 100MB，用 `exec` 会直接报 `maxBuffer exceeded`**——必须用 `spawn` 流式读。

---

## 7.4 进程通信的四种方式（题 26）

### 方式 1：IPC（`fork` 专用）

**实测**：

```js
// 父进程
const child = fork('./child.js');
child.on('message', (msg) => console.log('收到:', msg));
child.send({ type: 'ping', n: 1 });
```

```
父进程 pid: 15903
子进程 pid: 15904 (通过 IPC 告知)
收到 pong, echo = 1  来自 pid 15904
收到 CPU 计算结果: 3464100748.90
等待期间父进程定时器跑了 53 次 → 没被阻塞
```

**`fork` 自动建立了 IPC 通道**。底层是：

| 平台 | IPC 底层 |
|---|---|
| Linux / macOS | **Unix domain socket**（`socketpair`） |
| Windows | **命名管道**（named pipe） |

**消息通过 `JSON.stringify` 序列化**（默认），所以：

- ❌ 不能传函数
- ❌ 不能传 Buffer（会变成 `{type:'Buffer',data:[...]}`）
- ❌ 不能传循环引用
- ✅ 可以传 Buffer，但要用 `serialization: 'advanced'`（比 JSON 快，支持更多类型）

```js
fork('./child.js', [], { serialization: 'advanced' });
```

**IPC 的局限**：

| 局限 | 说明 |
|---|---|
| **只能父子之间** | 兄弟进程不能直接 IPC，要经过父进程转发 |
| **单向队列可能阻塞** | 如果子进程 `send` 太快而父进程不读，会积压在内存 |
| **不适合大数据** | 每次都要序列化 + 拷贝。传 100MB 要序列化 100MB |

> **「不适合大数据」这条很重要**：
> 「IPC 适合传『指令和元数据』，不适合传『数据本身』。如果你要传一个 100MB 的 Buffer，序列化 + 反序列化的开销比重新读文件还大。**这种情况应该传文件路径，让子进程自己读。**」

### 方式 2：Redis / MQ（跨机器）

**唯一能跨机器的方案**。

| 场景 | 用什么 |
|---|---|
| 多个 Node 实例共享 session | Redis |
| 任务队列（异步处理） | Redis List / BullMQ / RabbitMQ / Kafka |
| 广播（所有实例都要收到） | Redis Pub/Sub |
| 跨语言的系统间通信 | MQ（RabbitMQ / Kafka） |

> **为什么 Redis 是最常用的**：
> 「因为多进程部署时，**状态必须外置**。session、缓存、分布式锁、限流计数——这些东西放在进程内存里就只对当前进程有效。**Redis 是『多进程/多机器共享状态』的标准答案。**」

### 方式 3：HTTP / WebSocket

```js
// 服务之间调用
await fetch('http://other-service/api/x');

// 实时通信
const ws = new WebSocket('ws://other-service');
```

**特点**：通用、跨语言、可观测（有日志、有链路追踪），但**有协议开销**。

**适合**：微服务之间的业务调用。
**不适合**：高频、小消息（比如每进程每秒上千次的计数同步——那用 Redis 的 `INCR`）。

### 方式 4：共享内存（`SharedArrayBuffer` + `Atomics`）

**只有在 `worker_threads` 里才有意义**（进程之间无法共享内存）。

```js
const sab = new SharedArrayBuffer(1024);
const arr = new Int32Array(sab);
Atomics.add(arr, 0, 1);        // 原子操作
```

**用途**：高频数值计算（图像处理、音视频、科学计算）。**业务代码基本用不到。**

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

## 7.5 cluster：多进程共享端口（题 24 的前置）

### 实测

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

实测输出：

```
primary pid: 15915 | CPU 核数: 10
worker 15917 监听 null:4310
worker 15918 监听 null:4310
```

**两个 worker 都监听 `4310`**——这在操作系统层面是不允许的（会 `EADDRINUSE`）。cluster 怎么做到的？

### 原理：Primary 持有监听 socket，分发给 worker

```
① primary 创建 server 并 listen(4310)         ← 只有 primary 真正持有 socket
② fork 出 worker
③ primary 把 socket 的 fd 通过 IPC 传给 worker ← 关键：传文件描述符
④ worker 收到 fd 后，用这个 fd 创建 server 对象（不再重新 listen）
⑤ 连接到达时，primary 按策略分发给某个 worker
```

**两种分发策略**：

| 策略 | 平台 | 行为 |
|---|---|---|
| **Round-robin（默认）** | 除 Windows 外所有平台 | **primary 负责 accept，按顺序分发给 worker** |
| **Shared（共享）** | Windows | 所有 worker 竞争 accept（OS 调度） |

### ★ 实测发现：keep-alive 会破坏负载均衡

这个发现我一开始没预料到——同一份代码，8 个请求全落到 **1 个 worker**。

```
第一个测试：
  8 个请求被 1 个不同进程处理
  处理过请求的 worker: 15917        ← 只有一个！
```

**排查后发现是 keep-alive**。我做了一组对照：

```
默认 agent（keepAlive: true）    请求 12 次 → 落到 1 个 worker（12）
keepAlive: false（每次新连接）   请求 12 次 → 落到 2 个 worker（6 / 6）
```

**完美的 round-robin！**

#### 根因

**cluster 是在「连接（connection）」层面分发的，不是「请求（request）」层面。**

```
一个 TCP 连接 → 被分给一个 worker → 这条连接上所有请求都归它处理
```

而 Node 19 起 `http.globalAgent` **默认 `keepAlive: true`**。所以：

```
客户端 12 个请求复用 1 条连接 → 全部由同一个 worker 处理
```

#### 影响

| 场景 | 影响 |
|---|---|
| **前端浏览器 → 服务** | 浏览器对同域名会开 6 条连接，所以有 6 个 worker 在干活，**影响小** |
| **服务 A → 服务 B（Node 客户端）** | **服务间调用默认 keepAlive**，一个上游实例可能只打到下游的一个实例 → **负载严重不均** |
| **压测** | 如果用单连接压测，会误判「cluster 没生效」 |

> **这个坑太值得说了**：
> 「cluster 是在**连接层**分发的，不是请求层。我实测过：同一份 cluster 代码，用默认 agent（keepAlive: true）发 12 个请求，**全部落到 1 个 worker**；关掉 keepAlive 后立刻变成 6/6 的完美轮询。
>
> 这意味着两件事：**一是压测时要注意**，单连接压测会误判 cluster 没生效；**二是服务间调用要注意**，Node 的 http client 默认 keepAlive，上游一个实例可能只打下游一个实例，负载会严重不均。解法是配 `keepAliveMsecs` + 多个连接，或者用更上层的负载均衡（服务网格 / Nginx）。」

### cluster 的四个限制

| 限制 | 说明 | 影响 |
|---|---|---|
| **内存不共享** | 每个 worker 独立 | session / 缓存要外置到 Redis |
| **端口共享靠 primary** | primary 是单点 | primary 挂了全挂（pm2 会重启它） |
| **不能热重载代码** | 改了代码要重启 worker | pm2 的 `reload` 会逐个重启（不中断服务） |
| **worker 之间不直接通信** | 只能经 primary 转发 | 跨 worker 状态同步要用 Redis |

---

## 7.6 pm2 是什么、原理（题 24）

### 一句话结论

> pm2 是**进程守护 + 集群管理**工具。它不改变你的代码，只负责「**让进程活着、用满多核、日志能看**」。

### 题单答案的问题

> 「PM2 启动 Node 进程并 fork 子进程，主进程监控子进程，崩溃自动重启。cluster 模式启多个实例利用多核。日志轮转、负载均衡。」

**基本对**，但需要澄清两点：

1. **pm2 的 `cluster` 模式和 Node 的 `cluster` 模块是两回事**
2. **pm2 只解决「进程层面」的问题，不解决「应用层面」的问题**（比如优雅退出要自己写）

### pm2 和 Node cluster 的关系

| | Node 的 `cluster` 模块 | pm2 的 `cluster` 模式 |
|---|---|---|
| 谁在用 | **你的代码里** `require('cluster')` | pm2 帮你 fork，**你的代码不用改** |
| 分发 | 你的代码里写 | pm2 实现的（**基于 cluster 模块**） |
| 关系 | 底层机制 | **封装了这个机制** |

**所以**：用 pm2 cluster 模式时，**代码里不要再用 `cluster` 模块**——会冲突（变成「每个 pm2 实例里又 fork 多个」）。

```bash
# pm2 cluster 模式：启动 4 个实例（= CPU 核数）
pm2 start app.js -i 4

# 或者用 max 自动匹配核数
pm2 start app.js -i max
```

**你的代码**（`app.js`）就是普通的单进程服务器：

```js
const http = require('http');
http.createServer((req, res) => res.end('ok')).listen(3000);
```

**pm2 帮你做了 cluster 化。**

### pm2 做了四件事

| 功能 | 说明 |
|---|---|
| **守护（daemon）** | pm2 自己作为常驻进程，监控子进程；子进程崩了立刻重启 |
| **集群（cluster）** | `-i N` 起 N 个实例，共享端口 |
| **日志** | 统一收集 stdout/stderr 到文件，支持轮转（`pm2-logrotate`） |
| **监控** | `pm2 monit` 看 CPU/内存/重启次数 |

**其他能力**：

```bash
pm2 start app.js --name api -i max
pm2 list                        # 看所有进程状态
pm2 logs api                    # 看日志
pm2 monit                       # 实时监控
pm2 reload api                  # ★ 零停机重启（逐个替换 worker）
pm2 restart api                 # 全部重启（有短暂中断）
pm2 stop / delete api
pm2 startup                     # 生成开机自启脚本
pm2 save                        # 保存当前进程列表
```

**`reload` 和 `restart` 的区别是关键**：

| 命令 | 行为 | 服务中断 |
|---|---|---|
| `restart` | **全部**杀掉再启动 | **有**（几秒不可用） |
| `reload` | **逐个**替换 worker | **无**（始终有 worker 在服务） |

> **`reload` 是 pm2 最有价值的功能**：
> 「滚动发布靠 `reload`——它逐个重启 worker，先启动新的，等它就绪再杀掉旧的。所以整个过程始终有实例在服务，用户无感。**但前提是你的应用能优雅退出**——如果旧 worker 有没处理完的请求，会被硬杀，那些请求就失败了。」

### ⚠️ pm2 不解决的事（这段最能加分）

| pm2 不解决 | 你要自己做 |
|---|---|
| **优雅退出** | 监听 `SIGINT`/`SIGTERM`，停收新请求、等在途请求、关连接池 |
| **多进程的状态共享** | session / 缓存 / 限流计数 → 外置 Redis |
| **日志分级与结构化** | pm2 只做收集，格式要自己定（建议 JSON 行） |
| **内存泄漏** | pm2 的 `max_memory_restart` 只是「涨到阈值就重启」——**这是掩盖问题，不是解决** |
| **健康检查** | 要做 `/health` 接口，配合负载均衡摘除 |

#### `max_memory_restart` 是个陷阱

```bash
pm2 start app.js --max-memory-restart 1G
```

看起来很贴心——内存超 1G 就重启。**但它是「掩盖内存泄漏」**：

```
内存泄漏 → 涨到 1G → pm2 重启 → 内存归零 → 又慢慢涨
```

**现象**：你的服务每隔几小时重启一次，日志里看到「restart count: 37」，但你不知道为什么。

> **这句能直接说出很多人的痛**：
> 「`max_memory_restart` 我用它当**兜底**，不当解法。如果 `pm2 list` 里看到 restart 次数在持续增长，那说明有内存泄漏，必须去查——`max_memory_restart` 只是让服务在泄漏的情况下还能活，不是修好了。」

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
    console.log('已退出');
    process.exit(0);
  });

  // ② 给在途请求一个超时上限（pm2 默认 1.6s 后发 SIGKILL）
  setTimeout(() => {
    console.error('超时，强制退出');
    process.exit(1);
  }, 10_000).unref();      // unref 让它不阻止进程退出
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
```

**pm2 的 `kill_timeout`**：

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

> **`wait_ready` 很关键**：
> 「默认 pm2 认为『进程启动 = 可以服务』，但实际上 Node 启动后还要连数据库、预热缓存。如果这时候就开始接请求，会有一批失败。
>
> `wait_ready: true` 会让 pm2 等你在应用里 `process.send('ready')`——你在所有依赖就绪后才发这个信号。**配合 `reload` 使用，滚动发布才能真正做到零失败。**」

### 面试怎么说（2 分钟版）

> 「pm2 我理解成『**进程层面的运维工具**』——它不改变你的代码，只负责让进程活着、用满多核、日志能看。
>
> 核心是四件事：**守护**（崩了重启）、**集群**（`-i max` 起多个实例共享端口）、**日志收集和轮转**、**监控**。
>
> 有个容易混的点：**pm2 的 cluster 模式和 Node 的 cluster 模块不是一回事**。pm2 是封装了 cluster 模块——所以用 pm2 的 cluster 模式时，代码里**不要**再 `require('cluster')`，否则会变成「每个 pm2 实例里又 fork 多个」。
>
> 最有价值的功能是 `reload`——它逐个替换 worker，先起新的再杀旧的，所以滚动发布零停机。**但前提是你的应用能优雅退出**：要监听 SIGTERM，停收新请求、等在途请求、关连接池。这个 pm2 不会帮你做。
>
> 最后我会强调 pm2 **不解决**什么：多进程的状态共享（session 要外置 Redis）、日志结构化、内存泄漏。特别是 `max_memory_restart`——它是兜底不是解法。**如果 `pm2 list` 里 restart 次数在持续增长，那说明有内存泄漏，得去查，不能靠自动重启掩盖。**」

---

## 7.7 多进程带来的三个新问题

上了多进程之后，原本「进程内就是全局」的假设全部失效。

### 问题 1：session / 状态

```js
// ❌ 用内存存 session
const sessions = new Map();     // 每个 worker 一份，用户请求打到别的 worker 就"登出"了
```

**解决**：外置到 Redis。

### 问题 2：定时任务会重复执行

```js
// ❌ 4 个 worker，这个定时任务会跑 4 次
setInterval(() => { sendDailyReport(); }, 24 * 60 * 60 * 1000);
```

**三种解法**：

| 方案 | 做法 |
|---|---|
| **只让一个 worker 跑** | 判断 `cluster.isPrimary` 或 `process.env.NODE_APP_INSTANCE === '0'`（pm2 提供） |
| **分布式锁** | Redis `SET key value NX EX 60`，拿到锁才执行 |
| **独立进程** | 定时任务单独部署一个实例（**最干净**） |

> **pm2 的 `NODE_APP_INSTANCE` 是个好用的东西**：
> 「pm2 cluster 模式会给每个实例注入 `NODE_APP_INSTANCE`（0、1、2…）。所以 `if (process.env.NODE_APP_INSTANCE === '0')` 就能让定时任务只在第一个实例跑。**但注意这只在 pm2 下有效，k8s 里要用别的机制。**」

### 问题 3：日志交错

```
4 个进程同时写同一个日志文件 → 行会交错、截断
```

**解决**：

- pm2 会自动按进程分开写（`api-0.log`、`api-1.log`）
- 或者直接输出到 stdout，由容器/收集器统一处理（**k8s 推荐这个**）

---

## 7.8 追问总表

| 问题 | 一句话答 |
|---|---|
| 为什么需要多进程？ | 一个进程一个事件循环，只能用 1 核 |
| cluster 和 worker_threads 区别？ | 前者多进程（不共享内存，扛请求），后者多线程（可共享内存，跑计算） |
| fork / spawn / exec 区别？ | fork 启动 Node 子进程有 IPC；spawn 流式无 shell；exec 经 shell 缓冲输出 |
| exec 的两个问题？ | 命令注入风险 + `maxBuffer` 限制（默认 1MB） |
| IPC 底层是什么？ | Unix domain socket（Linux/macOS）/ 命名管道（Windows） |
| IPC 能传什么？ | JSON 可序列化的（默认）。Buffer 也可以，但要用 `serialization: 'advanced'` |
| IPC 不适合传什么？ | 大量数据（序列化开销大）。应该传文件路径 |
| 兄弟进程能直接 IPC 吗？ | 不能，要经父进程转发 |
| cluster 怎么做到共享端口？ | primary 持有 socket，通过 IPC 把 fd 传给 worker |
| ★ cluster 在什么层面分发？ | **连接层，不是请求层**。keep-alive 会让请求集中到一个 worker |
| 实测证据？ | keepAlive: true → 12 请求落 1 个 worker；false → 6/6 |
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
Redis/MQ   唯一能跨机器的方案，多进程共享状态的标准答案
HTTP/WS    通用、跨语言、可观测，但有协议开销
SharedArrayBuffer  只有 worker_threads 才有意义

【cluster 原理】
primary 持有 socket → fork worker → 通过 IPC 传 fd
→ worker 用同一个 fd 创建 server（不重新 listen）
→ 连接到达时 primary 分发（Round-robin）

★ 实测：keep-alive 破坏负载均衡
keepAlive: true  → 12 请求落 1 个 worker（12）
keepAlive: false → 12 请求落 2 个 worker（6 / 6）
根因：分发在「连接层」不是「请求层」
影响：① 单连接压测会误判 cluster 失效
     ② 服务间调用（Node client 默认 keepAlive）负载不均

【cluster 四个限制】
内存不共享 → session 要外置 Redis
primary 单点 → pm2 重启它
不能热重载 → 要重启 worker
worker 间不能直连 → 经 primary 或 Redis

【pm2 四件事】
守护（崩了重启）/ 集群（-i max）/ 日志轮转 / 监控
★ reload（逐个替换，零停机）vs restart（全杀全起，有中断）

【pm2 不解决】
优雅退出（自己监听 SIGTERM）
状态共享（Redis）
日志结构化（自己定 JSON 格式）
内存泄漏（max_memory_restart 是兜底不是解法）
★ restart 次数增长 = 有泄漏，要查不能掩盖

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
□ 能复述 keep-alive 破坏负载均衡的实测数据和根因
□ 能说出这个发现的两个实际影响
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
