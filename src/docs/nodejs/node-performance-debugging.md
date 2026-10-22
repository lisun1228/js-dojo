# Node 08｜性能监控与调试

> 覆盖题号：4（Node 性能监控与优化）、22（Node.js 如何调试）
> 去重后：**2 个考点**

---

## 8.1 题单答案的问题

> **4.** 「监控：`clinic.js`、`pm2 monit`、Chrome DevTools Inspector、APM。优化：事件循环延迟监控、内存泄漏检测（heap snapshot）、CPU profiling、cluster 多进程、流式处理大请求、缓存热点数据。」
> **22.** 「`node --inspect app.js`，然后 Chrome 打开 `chrome://inspect`。或 VS Code 断点调试、`console.log`、`debugger` 语句。」

**这两条把「工具有哪些」列全了，但完全没有「怎么定位问题」的方法论。**

而性能题真正的考点恰恰是**方法论**：

> 「线上接口 P99 从 50ms 涨到 3s，你怎么排查？」

**面试官问的不是「你知道 clinic.js」，而是「你有没有一个可复现的排查路径」。**

---

## 8.2 一句话结论

> **性能排查的核心是「先定位在哪一层，再深入那一层」——不是一上来就看代码。**

---

## 8.3 排查路径：五层漏斗

```
① 是不是所有接口都慢了？
   ├─ 是 → 看机器/进程层面（CPU、内存、GC、事件循环延迟、连接数）
   └─ 否（只有某几个接口慢）
        ↓
② 是不是依赖慢了？（DB / Redis / 三方 API）
   ├─ 是 → 看依赖的耗时监控、慢查询日志
   └─ 否
        ↓
③ 是不是这个接口的代码有问题？（同步阻塞、N+1 查询、大 JSON）
   ↓
④ 是不是流量/数据量变了？（缓存失效、某类请求暴增）
   ↓
⑤ 是不是最近发版引入的？（对比版本、回滚验证）
```

**这个漏斗的价值**：它让你**从最便宜的检查开始**。第 ① 步看监控面板 30 秒就能排除一半可能，不需要上 profiling。

> **面试时的开场白**：
> 「我先说排查顺序，因为顺序比工具重要。**第一步永远是看监控确认『影响范围』**——所有接口都慢还是只有部分慢？所有实例都慢还是只有某个实例？这一句话就能把范围缩小一半。」

---

## 8.4 第一层：进程层面（先看这三个指标）

### 指标 1：事件循环延迟（最重要的单一指标）

**为什么它最重要**？因为 Node 的一切都跑在事件循环上。**事件循环延迟高 = 所有请求都在排队。**

```js
// 用 perf_hooks 做生产级监控（推荐）
const { monitorEventLoopDelay } = require('node:perf_hooks');

const h = monitorEventLoopDelay({ resolution: 20 });   // 20ms 采样
h.enable();

setInterval(() => {
  const p = {
    p50: h.percentile(50) / 1e6,
    p99: h.percentile(99) / 1e6,
    max: h.max / 1e6,
  };
  // 上报到监控系统
  metrics.gauge('node.eventloop.lag.p99', p.p99);
  if (p.p99 > 100) {
    logger.warn({ msg: '事件循环延迟过高', ...p });
  }
  h.reset();
}, 10_000);
```

**实测**：我制造了一次 150ms 的同步阻塞：

```
采样 16 次，最大延迟 146.6ms
```

**它精准捕获到了。** 这就是「接口变慢但 CPU 不高」的排查入口。

**经验阈值**：

| P99 延迟 | 判断 |
|---|---|
| < 20 ms | 健康 |
| 20 ~ 50 ms | 关注（有明显 GC 或短时阻塞） |
| 50 ~ 100 ms | 有问题，要查 |
| **> 100 ms** | **严重，用户可感知** |

### 指标 2：内存（要区分三个字段）

```js
const mu = process.memoryUsage();
```

| 字段 | 含义 | 涨了意味着 |
|---|---|---|
| `heapUsed` | V8 实际用的堆 | **JS 对象泄漏** |
| `external` / `arrayBuffers` | C++ 对象 / Buffer | **Buffer 泄漏** |
| `rss` | 进程总物理内存 | 上面两个之和 + 栈 + 碎片 |

**实测三种泄漏形态**：

```
形态 A：模块级缓存没有上限
  heapUsed: 4.13MB → 16.35MB（+12.22MB）
  → 特征：heapUsed 持续增长，且不回落

形态 B：监听器越加越多（没 off）
  监听器数量: 0 → 5000
  → 真实场景：WebSocket 重连时反复 on("message") 却不清旧的

形态 C：定时器没 clear
  创建 1000 个未清理的定时器，每个闭包持有 1KB
  → 特征：进程退出不了 + 内存缓慢增长
```

### ★ 判别表（这张表能直接答「内存一直涨怎么查」）

| 现象 | 结论 | 下一步 |
|---|---|---|
| `heapUsed` 持续涨不回落 | **JS 对象泄漏** | 三快照法找具体类型 |
| `heapUsed` 平 / `external` 涨 | **Buffer 泄漏** | 查流是否 release、`subarray` 是否持有大 Buffer |
| `rss` 涨但 `heapUsed` 和 `external` 都平 | **内存碎片 / native 泄漏** | 查 C++ 插件，考虑调 `--max-old-space-size` |
| 全部周期性涨落 | **正常**（GC 在工作） | 不用管，看峰值是否稳定 |

> **这张表的价值**：
> 「内存『一直涨』这个描述太粗。我第一件事是看 `memoryUsage` 的三个字段——**`heapUsed` 涨是 JS 对象泄漏，`external` 涨是 Buffer 泄漏，两个都不涨但 RSS 涨是碎片或 native 泄漏**。三种的排查方向完全不同。」

### 指标 3：CPU

```bash
# 看进程 CPU 占用
top -p $(pgrep -f "node app.js")
```

**判别**：

| 现象 | 可能原因 |
|---|---|
| CPU 100%（单核打满） | 同步阻塞 / 死循环 / 无限微任务 |
| CPU 周期性尖峰 | 定时任务 / 大 JSON 解析 / GC |
| CPU 不高但请求慢 | **I/O 等待**（依赖慢、线程池打满） |

> **「CPU 不高但请求慢」是最常见的误判点**。这时候不是代码算得慢，是**在等**——等数据库、等下游接口、等线程池。**要去查依赖，不是查代码。**

---

## 8.5 定位到代码：CPU Profile

确认是「代码算得慢」之后，用 CPU Profile 找具体是哪一行。

### 方式 A：Chrome DevTools（功能最全）

```bash
node --inspect-brk app.js      # 启动时暂停，等调试器连接
# 或
node --inspect app.js          # 直接启动，可以后连
```

然后打开 `chrome://inspect`，点 `inspect`。

**能做的事**：

- **断点调试**（源码 + 条件断点）
- **CPU Profile**（火焰图）
- **Heap Snapshot**（堆快照）
- **Performance 面板**（时间轴）

### 方式 B：`--prof`（适合线上/容器）

```bash
node --prof app.js
# 运行一段时间后正常退出，会生成 isolate-*.log
node --prof-process isolate-*.log > profile.txt
```

**优点**：不需要开端口、不连 DevTools，适合容器/线上。
**缺点**：结果是文本，不如火焰图直观。

### 方式 C：clinic.js（一键诊断）

```bash
npm i -g clinic
clinic doctor -- node app.js      # 先判断问题类型（CPU/内存/I-O）
clinic flame -- node app.js       # 火焰图
clinic bubbleprof -- node app.js  # 异步调用图（看「在等谁」）
```

> **`bubbleprof` 是 Node 特有的神器**：
> 「普通火焰图只能看『CPU 花在哪』，但 Node 的瓶颈常常是**异步等待**——比如在等数据库。`clinic bubbleprof` 画的是**异步调用关系图**，能直观看出『这个请求在等谁、等了多久』。**排查『CPU 不高但慢』的问题，它比火焰图有用。**」

### 怎么读火焰图

```
      ┌────────────────────────────────┐
      │         handleRequest          │  ← 越宽 = 占用 CPU 越多
      ├──────────────┬─────────────────┤
      │  parseBody   │   generateReport │
      ├──────┬───────┤  ┌────────────┐  │
      │ JSON │validate│ │  sort 100万 │  │  ← 这个很窄但很深 = 单次调用耗时
      └──────┴───────┴─└────────────┘──┘
                                   ↑
                          自顶向下找「最宽的层」
```

**读法三条**：

1. **看宽度**：最宽的那个函数是 CPU 消耗最多的
2. **看深度**：深而窄的栈说明「调用次数少但单次很慢」
3. **看 `(program)` / `(idle)`**：如果 `(idle)` 占比很高，说明 CPU 不忙，瓶颈在 I/O

> **第 3 条很实用**：
> 「火焰图里如果 `(idle)` 占 70%，那说明 CPU 根本没在干活，问题在 I/O 等待——这时候应该去看 `bubbleprof` 或者依赖的耗时，不要继续优化代码。」

---

## 8.6 内存泄漏：三快照法（完整流程）

### 步骤

```
① 启动后立刻保存快照         snapshot-1.heapsnapshot
② 压测/操作一段时间后         snapshot-2.heapsnapshot
③ 再操作同样长的时间          snapshot-3.heapsnapshot
```

**关键**：**对比 2 和 3，不是 1 和 3。**

```
如果只是「总量涨了但稳定」→ 正常（缓存预热、JIT 编译）
如果「3 > 2 且 2 > 1」→ 泄漏
```

### 在 DevTools 里怎么对比

**Memory 面板 → 选两个快照 → 下拉选 `Comparison`**：

| 列 | 含义 |
|---|---|
| `# New` | 新增的对象数 |
| `# Deleted` | 释放的对象数 |
| **`# Delta`** | **净增（正数 = 泄漏嫌疑）** |
| `Size Delta` | 净增字节数 |

**按 `Size Delta` 降序排，看前三名。** 通常能立刻看到可疑类型（比如某个业务对象有几万个实例）。

### 一个必须知道的细节

**`v8.writeHeapSnapshot()` 会让进程暂停（STW）**，且文件很大：

```
实际生成快照: /tmp/nodecheck/snapshot-demo.heapsnapshot
文件大小: 31.51MB     ← 当时 heapUsed 约 16MB，快照是它的 2 倍
```

**所以线上采集要注意**：

- 不要在高峰期采（会暂停几百 ms 到几秒）
- 生成前先 `global.gc()`（需要 `--expose-gc`），否则会把垃圾也算进去
- 文件要传到外部存储，不要留在容器里

> **这一条能体现经验**：
> 「线上采 heap snapshot 要小心——**生成过程是 STW 的**，堆大的话会暂停几秒，相当于一次小故障。所以我会：① 挑低峰期；② 先手动 GC 再采（减少噪音）；③ 采完立刻上传然后删掉本地文件。」

---

## 8.7 调试

### 四种调试方式

| 方式 | 适用 | 优点 | 缺点 |
|---|---|---|---|
| `console.log` | 快速验证 | 零成本 | 侵入代码、异步日志顺序乱 |
| `node --inspect` | 本地/远程 | 断点、单步、看作用域 | 需要开端口（**安全风险**） |
| VS Code 调试器 | 本地开发 | 图形化、集成好 | 只能本地 |
| `node --inspect-brk` + 容器 | 容器内 | 能调试启动阶段 | 要端口映射 |

### VS Code 的 `launch.json`（最常用）

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "调试当前文件",
      "program": "${file}",
      "skipFiles": ["<node_internals>/**"],
      "env": { "NODE_ENV": "development" }
    },
    {
      "type": "node",
      "request": "attach",
      "name": "附加到进程",
      "port": 9229,
      "restart": true
    }
  ]
}
```

**`skipFiles: ["<node_internals>/**"]` 很重要**——否则单步调试会跳进 Node 内部代码，非常痛苦。

### ⚠️ `--inspect` 的安全风险（必须说）

```bash
node --inspect=0.0.0.0:9229 app.js    # ← 灾难
```

**这会把调试端口暴露到公网**。后果：

- 任何人都能连上来**执行任意代码**（DevTools 协议支持 `Runtime.evaluate`）
- **这是真实的入侵途径**，不是理论风险

**安全做法**：

| 环境 | 做法 |
|---|---|
| 本地 | `--inspect`（默认只绑 `127.0.0.1`，安全） |
| 容器/远程 | `--inspect=0.0.0.0` + **SSH 隧道 / k8s port-forward**，绝不直接暴露 |
| 生产 | **不要开 inspector**。用 `--prof` 或 APM |

> **这条是加分项**：
> 「`--inspect` 默认只绑 `127.0.0.1`，这是安全的。但很多人为了容器调试改成 `--inspect=0.0.0.0:9229`，**如果这个端口被暴露出去，等于给攻击者一个能执行任意代码的入口**。正确做法是用 SSH 隧道或 `kubectl port-forward` 转发，不要直接暴露端口。」

### 调试异步代码的难点

```js
async function a() { await b(); }
async function b() { await c(); }
async function c() { throw new Error('炸了'); }
```

**栈里只能看到 `c`**，看不到「是谁调用到这里的」——因为异步调用之间栈断了。

**三个解法**：

| 方案 | 做法 |
|---|---|
| **`--async-stack-traces`** | Node 12+ 默认开启，能追踪 `await` 链的调用栈 |
| **`async_hooks`** | 追踪每个异步资源的生命周期（谁创建、谁触发、谁销毁） |
| **请求 ID 串日志** | 每个请求生成 `reqId`，所有日志带上它 → 靠日志串起来 |

**推荐实践是第三个**：

> 「调试异步问题，靠断点很难——栈断了看不到调用链。我实际最有效的手段是**给每个请求一个 `reqId`，用 `AsyncLocalStorage` 全链路透传**。所有日志都带上 `reqId`，出问题时按 `reqId` 一搜就能看到完整链路。`async_hooks` 底层太复杂，`AsyncLocalStorage` 是它的高层封装，用起来简单得多。」

```js
const { AsyncLocalStorage } = require('node:async_hooks');
const als = new AsyncLocalStorage();

app.use((ctx, next) => {
  const reqId = crypto.randomUUID();
  return als.run({ reqId }, next);
});

// 日志里自动带 reqId
function log(msg) {
  const store = als.getStore();
  console.log(JSON.stringify({ reqId: store?.reqId, msg }));
}
```

---

## 8.8 优化手段（按性价比）

| 手段 | 收益 | 代价 | 优先级 |
|---|---|---|---|
| **加缓存**（Redis / 进程内 LRU） | 极大 | 要处理一致性 | ⭐⭐⭐⭐⭐ |
| **消除 N+1 查询** | 极大 | 改数据访问层 | ⭐⭐⭐⭐⭐ |
| **把 CPU 密集任务移出主线程** | 大 | worker_threads / 独立服务 | ⭐⭐⭐⭐⭐ |
| **流式处理大请求/响应** | 大 | 改代码 | ⭐⭐⭐⭐ |
| **cluster 用满多核** | 大（吞吐） | 状态要外置 | ⭐⭐⭐⭐ |
| **连接池调优** | 中 | 要压测找最优值 | ⭐⭐⭐ |
| **压缩响应（gzip）** | 中（带宽） | CPU 开销 | ⭐⭐⭐⭐ |
| **减少 JSON 体积**（字段裁剪/分页） | 中 | 改接口 | ⭐⭐⭐ |

**两个最容易忽略的**：

- **`JSON.stringify` 大对象也会阻塞**。一个 10MB 的响应体序列化要几十毫秒
- **同步日志**（`fs.appendFileSync`）在请求路径上是灾难。**用异步或专门的日志库（pino 是最快的）**

> **pino 值得提**：
> 「日志库的性能差异很大。`winston` 功能全但慢，**`pino` 是目前最快的**——它把日志先写到内存缓冲，用 `sonic-boom` 异步刷盘。高 QPS 服务里日志往往是隐藏的性能杀手。」

---

## 8.9 面试怎么说（2 分钟版）

> 「性能问题我不从工具讲，从**排查路径**讲，因为顺序比工具重要。
>
> 我的第一步永远是**看监控确认影响范围**——所有接口都慢还是只有几个？所有实例都慢还是只有一个？这一句就能缩小一半范围。
>
> 如果**所有接口都慢**，我看三个指标：
>
> **第一是事件循环延迟**，这是 Node 最重要的单一指标。**因为它高就代表所有请求都在排队。** 我用 `monitorEventLoopDelay` 上报 P99，超过 100ms 就告警。
>
> **第二是内存**，但要分三个字段看——`heapUsed` 涨是 JS 对象泄漏，`external` 涨是 Buffer 泄漏，两个都不涨但 RSS 涨是碎片或 native 泄漏。**这三种排查方向完全不同。**
>
> **第三是 CPU**。这里有个常见误判：**CPU 不高但请求慢，说明是在『等』，不是在『算』**——要去查依赖和线程池，不要看代码。
>
> 如果只有**某几个接口慢**，我直接看那几个接口的耗时拆解（DB 时间 / 三方调用时间 / 自身处理时间），然后针对性优化。
>
> 到了代码层面，CPU 密集用 CPU Profile 看火焰图，内存泄漏用**三快照法**——重点是对比 2 和 3 的 **Delta**，不是看总量。总量大不一定是泄漏，持续增长才是。
>
> 最后说一个我踩过的坑：**线上采 heap snapshot 是 STW 的**。我实测过一个 16MB 的堆，快照文件 31MB，生成过程会暂停几百毫秒。所以线上采集要挑低峰期、先手动 GC、采完立刻上传删本地。」

---

## 8.10 追问总表

| 问题 | 答法 |
|---|---|
| 性能排查第一步做什么？ | 看监控确认影响范围（全量还是局部、全实例还是单实例） |
| Node 最重要的性能指标？ | **事件循环延迟**（它高代表所有请求排队） |
| 事件循环延迟怎么监控？ | `perf_hooks.monitorEventLoopDelay`，上报 P99 |
| 延迟多少算有问题？ | P99 > 100ms 严重，> 50ms 要查 |
| 内存要看哪几个字段？ | `heapUsed`（JS 对象）、`external`（Buffer）、`rss`（总） |
| `heapUsed` 涨说明什么？ | JS 对象泄漏 |
| `external` 涨但 `heapUsed` 平？ | Buffer 泄漏 |
| 都平但 RSS 涨？ | 碎片 / native 插件泄漏 |
| CPU 不高但请求慢？ | 在等 I/O（依赖/线程池），不是算得慢 |
| 火焰图怎么读？ | 看宽度（CPU 最多）、看深度（单次最慢）、看 `(idle)` 占比 |
| `(idle)` 占 70% 说明什么？ | CPU 不忙，瓶颈在 I/O |
| 三快照法对比哪两个？ | 2 和 3（不是 1 和 3） |
| 看哪一列？ | `# Delta` / `Size Delta`（净增） |
| 采快照要注意什么？ | STW 会暂停进程、文件是内存的 1~3 倍、先手动 GC |
| `--inspect` 的安全风险？ | 绑 0.0.0.0 暴露后等于任意代码执行入口 |
| 容器里怎么安全调试？ | SSH 隧道 / `kubectl port-forward`，不要直接暴露 |
| 异步栈断了怎么排查？ | `AsyncLocalStorage` 透传 reqId 串日志 |
| 为什么火焰图看不出「在等数据库」？ | 火焰图只看 CPU，等待不占 CPU。要 `clinic bubbleprof` |
| 高 QPS 下日志是瓶颈吗？ | 是。用 pino（`sonic-boom` 异步刷盘） |

---

## 8.11 速记卡

```
【排查五层漏斗】
① 全量慢？→ 进程层（CPU/内存/事件循环延迟/连接数）
② 局部慢？→ 依赖慢？（DB/Redis/三方）
③ 代码问题？（同步阻塞/N+1/大 JSON）
④ 流量或数据量变了？
⑤ 最近发版引入的？（回滚验证）

【三个核心指标】
★ 事件循环延迟（最重要）
   perf_hooks.monitorEventLoopDelay
   实测：150ms 阻塞 → 捕获到 146.6ms
   阈值：<20 健康 / 20-50 关注 / >100 严重
   意义：它高 = 所有请求在排队

★ 内存看三字段
   heapUsed 涨        → JS 对象泄漏 → 三快照法
   external 涨        → Buffer 泄漏 → 查流 release/大 Buffer 引用
   两者平但 rss 涨    → 碎片/native 泄漏 → 查插件
   实测泄漏 A：heapUsed 4.13MB → 16.35MB
   实测泄漏 B：listenerCount 0 → 5000
   实测泄漏 C：1000 个未 clear 的定时器

★ CPU
   100% 单核打满 → 同步阻塞/死循环/无限微任务
   周期性尖峰    → 定时任务/大 JSON/GC
   ★ 不高但慢    → 在等 I/O（去查依赖，别查代码）

【三快照法】
拍 1（启动）/ 2（操作后）/ 3（再操作同样时间）
★ 对比 2 和 3，看 Delta，不看总量
总量大可能是缓存预热；持续增长才是泄漏
★ 采集代价：STW 暂停进程 + 文件是内存 1~3 倍
  实测 16MB 堆 → 31.51MB 快照文件

【调试】
console.log    最快，但侵入
--inspect      Chrome DevTools，功能最全
--prof         不连 DevTools，适合线上/容器
clinic         doctor/flame/bubbleprof（bubbleprof 看异步等待）
★ --inspect 默认绑 127.0.0.1 是安全的
  改成 0.0.0.0 又暴露端口 = 任意代码执行入口
  容器用 SSH 隧道 / port-forward

【异步栈断了怎么办】
--async-stack-traces（Node 12+ 默认开）
AsyncLocalStorage 透传 reqId + 日志串起来 ← 最实用

【火焰图读法】
看宽度（CPU 最多）/ 看深度（单次最慢）/ 看 (idle)
(idle) 占 70% → CPU 不忙，查 I/O，别优化代码

【优化优先级】
缓存 > 消除 N+1 > CPU 任务移出主线程 > 流式 > cluster > 连接池
★ 隐藏杀手：JSON.stringify 大对象、同步日志（用 pino）
```

---

## 8.12 自测

```
□ 能背出排查五层漏斗的顺序
□ 能说出为什么排查第一步是「确认影响范围」
□ 能说出 Node 最重要的单一性能指标及原因
□ 能写出事件循环延迟监控的代码
□ 能说出延迟的三个阈值区间
□ 能说出内存的三个字段分别对应什么泄漏
□ 能说出内存泄漏的三种典型形态
□ 能解释「CPU 不高但请求慢」意味着什么
□ 能说出三快照法对比哪两个、看哪一列
□ 能解释为什么「总量大不一定是泄漏」
□ 能说出采 heap snapshot 的代价
□ 能说出四种调试方式和各自适用场景
□ 能说出 --inspect 的安全风险和正确做法
□ 能说出异步栈断了之后的三种解法
□ 能说出火焰图的三种读法
□ 能解释 (idle) 占比高意味着什么
□ 能说出至少五个优化手段的优先级
□ 能说出两个隐藏的性能杀手
```
