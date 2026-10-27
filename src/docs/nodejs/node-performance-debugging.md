# Node 08｜性能监控与调试

> 覆盖题号：4（Node 性能监控与优化）、22（Node.js 如何调试）
> 去重后：**2 个考点**

---

## 目录

- [8.1 题单答案的问题](#81-题单答案的问题)
- [8.2 一句话结论](#82-一句话结论)
- [8.3 排查路径：五层漏斗](#83-排查路径五层漏斗)
- [8.4 第一层：进程层面（先看这三个指标）](#84-第一层进程层面先看这三个指标)
- [8.5 定位到代码：CPU Profile](#85-定位到代码cpu-profile)
- [8.6 内存泄漏：三快照法（完整流程）](#86-内存泄漏三快照法完整流程)
- [8.7 调试](#87-调试)
- [8.8 优化手段（按性价比）](#88-优化手段按性价比)
- [8.9 面试怎么说（2 分钟版）](#89-面试怎么说2-分钟版)
- [8.10 追问总表](#810-追问总表)
- [8.11 速记卡](#811-速记卡)
- [8.12 自测](#812-自测)

---

## 8.1 题单答案的问题

> **4.** 「监控：`clinic.js`、`pm2 monit`、Chrome DevTools Inspector、APM。优化：事件循环延迟监控、内存泄漏检测（heap snapshot）、CPU profiling、cluster 多进程、流式处理大请求、缓存热点数据。」
> **22.** 「`node --inspect app.js`，然后 Chrome 打开 `chrome://inspect`。或 VS Code 断点调试、`console.log`、`debugger` 语句。」

两条答案只列了工具清单，没有定位问题的方法。性能题的实际考点是方法论：

> 「线上接口 P99 从 50ms 涨到 3s，你怎么排查？」

要回答的是可复现的排查路径，不是工具名词。

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

漏斗的作用是从最便宜的检查开始：第 ① 步看监控面板几秒内就能排除一半可能，不必先上 profiling。

---

## 8.4 第一层：进程层面（先看这三个指标）

### 指标 1：事件循环延迟（最重要的单一指标）

Node 的所有回调都跑在事件循环上，**延迟高就代表所有请求都在排队**。

```js
// 用 perf_hooks 做生产级监控（推荐）
const { monitorEventLoopDelay } = require('node:perf_hooks');

const h = monitorEventLoopDelay({ resolution: 20 });   // 20ms 采样
h.enable();

setInterval(() => {
  const p = {
    p50: h.percentile(50) / 1e6,   // 纳秒 → 毫秒
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

**实测**（`node -e`，`resolution: 20`）：在定时器回调里同步阻塞 150ms，采样 8 次，`max` 与 `p99` 均为 167.9ms。采样开销让读数略高于阻塞时长，量级一致。

**经验阈值**：

| P99 延迟 | 判断 |
|---|---|
| < 20 ms | 健康 |
| 20 ~ 50 ms | 关注（有明显 GC 或短时阻塞） |
| 50 ~ 100 ms | 有问题，要查 |
| **> 100 ms** | **严重，用户可感知** |

### 指标 2：内存（要区分三个字段）

```js
const mu = process.memoryUsage();   // { rss, heapTotal, heapUsed, external, arrayBuffers }
```

| 字段 | 含义 | 涨了意味着 |
|---|---|---|
| `heapUsed` | V8 已用的堆 | **JS 对象泄漏** |
| `external` / `arrayBuffers` | 绑定到 JS 的 C++ 对象 / Buffer 底层内存（`arrayBuffers` 是 `external` 的子集） | **Buffer 泄漏** |
| `rss` | 进程实际驻留的物理内存（含 V8 保留的 `heapTotal`、external、代码段与栈） | 需结合前两行判断 |

**实测三种泄漏形态**（Node 22，`--expose-gc`）：

```
形态 A：模块级缓存没有上限
  30 万个对象 → heapUsed 3.11MB → 42.68MB，GC 后不回落
  → 特征：heapUsed 持续增长，且不回落

形态 B：监听器只 on 不 off
  listenerCount 0 → 5000（默认超过 10 个会报 MaxListenersExceededWarning，常被 setMaxListeners(0) 掩盖）
  → 真实场景：WebSocket 重连时反复 on("message") 却不清旧的

形态 C：定时器没 clear
  未清理的定时器持有闭包 → 对象无法回收，事件循环一直有 handle，进程不退出
  → 特征：进程退出不了 + 内存缓慢增长
```

### ★ 判别表（这张表能直接答「内存一直涨怎么查」）

| 现象 | 结论 | 下一步 |
|---|---|---|
| `heapUsed` 持续涨不回落 | **JS 对象泄漏** | 三快照法找具体类型 |
| `heapUsed` 平 / `external` 涨 | **Buffer 泄漏** | 查流是否 release、`subarray` 是否持有大 Buffer |
| `rss` 涨但 `heapUsed` 和 `external` 都平 | **内存碎片 / native 泄漏** | 查 C++ 插件，考虑调 `--max-old-space-size` |
| 全部周期性涨落 | **正常**（GC 在工作） | 不用管，看峰值是否稳定 |

三个字段的涨幅对应三种完全不同的排查方向，只凭「内存一直涨」无法定位。

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

「CPU 不高但请求慢」说明请求在**等**，不是算得慢：查依赖和线程池，不要先改代码。

---

## 8.5 定位到代码：CPU Profile

确认是「代码算得慢」之后，用 CPU Profile 找具体是哪一行。

### 方式 A：Chrome DevTools（功能最全）

```bash
node --inspect-brk app.js      # 启动即暂停，等调试器连接（业务代码不执行）
# 或
node --inspect app.js          # 直接启动，可以后连：Debugger listening on ws://127.0.0.1:9229/...
```

打开 `chrome://inspect` 点 `inspect`，可用断点、CPU Profile（火焰图）、Heap Snapshot、Performance 时间轴。

### 方式 B：`--prof`（适合线上/容器）

```bash
node --prof app.js
# 运行后生成本地日志，文件名形如 isolate-<hex>-<pid>-v8.log
node --prof-process isolate-*-v8.log > profile.txt
```

**优点**：不需要开端口、不连 DevTools，适合容器/线上。
**缺点**：结果是文本，不如火焰图直观。输出形如：

```
Statistical profiling result from isolate-0x...-v8.log (37 ticks, 31 unaccounted)
  6  16.2%  JS: *fib [eval]:2:13
```

### 方式 C：clinic.js（一键诊断）

```bash
npm i -g clinic
clinic doctor -- node app.js      # 先判断问题类型（CPU/内存/I-O）
clinic flame -- node app.js       # CPU 火焰图
clinic bubbleprof -- node app.js  # 异步调用图（看「在等谁」）
```

`bubbleprof` 画的是异步调用关系图，能看出「这个请求在等谁、等了多久」。火焰图只统计 CPU 时间，Node 的瓶颈常常是异步等待（等数据库、等下游），这类「CPU 不高但慢」的问题用 `bubbleprof` 更直接。

### 怎么读火焰图

火焰图来自 CPU 采样，只反映 CPU 时间：

1. **看宽度**：最宽的函数在采样中占的 CPU 最多。
2. **看深度**：深而窄的栈表示调用次数少但单次耗时。
3. **看 `(program)` / `(idle)`**：`(idle)` 占比高说明 CPU 空闲，瓶颈在 I/O，此时应看 `bubbleprof` 或依赖耗时，不要继续优化代码。

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

**`v8.writeHeapSnapshot()` 是同步写盘，会让进程暂停（STW）**，文件大小与堆同量级：

```
实测（Node 22，--expose-gc）：
  heapUsed 3.64MB / heapTotal 5.05MB → 快照 4.77MB，写入耗时 55.8ms
```

**所以线上采集要注意**：

- 不要在高峰期采（写入期间事件循环完全停住，堆越大暂停越久）
- 生成前先 `global.gc()`（需要 `--expose-gc`），否则会把垃圾也算进去
- 文件要传到外部存储，不要留在容器里

---

## 8.7 调试

### 四种调试方式

| 方式 | 适用 | 优点 | 缺点 |
|---|---|---|---|
| `console.log` | 快速验证 | 零成本 | 侵入代码、异步日志顺序乱 |
| `node --inspect` | 本地/远程 | 断点、单步、看作用域 | 需要开端口（**安全风险**） |
| VS Code 调试器 | 本地开发 | 图形化、集成好 | 需要配置 `launch.json` |
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

**`skipFiles: ["<node_internals>/**"]` 很重要**——否则单步调试会跳进 Node 内部代码。

### ⚠️ `--inspect` 的安全风险（必须说）

```bash
node --inspect=0.0.0.0:9229 app.js    # ← 灾难
```

`--inspect` 默认只绑 `127.0.0.1`（启动输出 `ws://127.0.0.1:9229/...`），改成 `0.0.0.0` 后输出 `ws://0.0.0.0:9229/...`。一旦该端口可达：

- 任何人都能连上来**执行任意代码**（DevTools 协议支持 `Runtime.evaluate`）
- 这是真实的入侵途径，不是理论风险

**安全做法**：

| 环境 | 做法 |
|---|---|
| 本地 | `--inspect`（默认只绑 `127.0.0.1`，安全） |
| 容器/远程 | `--inspect=0.0.0.0` + **SSH 隧道 / k8s port-forward**，绝不直接暴露 |
| 生产 | **不要开 inspector**。用 `--prof` 或 APM |

### 调试异步代码的难点

```js
async function a() { await b(); }
async function b() { await c(); }
async function c() { throw new Error('炸了'); }
```

`await` 链的栈是完整的：`--async-stack-traces` 在当前 V8 中默认开启（`node --v8-options` 显示 `default: --async-stack-traces`），上面的错误能打印出 `at c` → `at b` → `at a`。

真正断栈的是**回调边界**：

```js
function schedule() { setTimeout(() => { throw new Error('late boom'); }, 10); }
schedule();
// 栈：at Timeout._onTimeout → listOnTimeout → process.processTimers
// 看不到 schedule，也看不出是哪个请求调度的
```

事件回调、流、并发请求之间同样无法靠栈区分。三种解法：

| 方案 | 做法 |
|---|---|
| **`--async-stack-traces`** | 默认开启，补齐 `await` 链；跨 `setTimeout`/事件回调仍会断 |
| **`async_hooks`** | 追踪每个异步资源的生命周期（谁创建、谁触发、谁销毁） |
| **请求 ID 串日志** | 每个请求生成 `reqId`，所有日志带上它 → 靠日志串起来 |

**最实用的是第三种**：用 `AsyncLocalStorage`（`async_hooks` 的高层封装）全链路透传 `reqId`，出问题时按 `reqId` 一搜就是完整链路。

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

- **`JSON.stringify` 是同步的**：实测 3MB 对象单次约 6ms，期间事件循环被占住
- **同步日志**（`fs.appendFileSync`）在请求路径上是灾难。用异步写盘或专门的日志库

日志库的差异主要在刷盘方式：`pino` 用 `sonic-boom` 先写内存缓冲再异步刷盘，高 QPS 服务里比同步写日志更稳。

---

## 8.9 面试怎么说（2 分钟版）

- **先讲顺序，再讲工具**：第一步看监控确认影响范围（所有接口还是部分接口、所有实例还是单个实例），据此决定看进程、依赖还是代码。
- **全量慢看三个指标**：事件循环延迟（`monitorEventLoopDelay` 上报 P99，> 100ms 告警）、内存三字段（`heapUsed` / `external` / `rss`）、CPU（不高但慢说明在等 I/O）。
- **局部慢看耗时拆解**：把该接口拆成 DB 时间 / 三方调用时间 / 自身处理时间，再针对性优化。
- **到代码层**：CPU 密集用 CPU Profile 看火焰图；内存泄漏用三快照法，对比 2 和 3 的 `Delta`，不看总量——总量大可能是缓存预热，持续增长才是泄漏。
- **线上采快照的代价**：`writeHeapSnapshot` 是 STW，挑低峰期、先 `global.gc()`、采完立即转存并删除本地文件（实测 4.77MB 快照写入 55.8ms，堆越大暂停越久）。

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
| `(idle)` 占比高说明什么？ | CPU 不忙，瓶颈在 I/O |
| 三快照法对比哪两个？ | 2 和 3（不是 1 和 3） |
| 看哪一列？ | `# Delta` / `Size Delta`（净增） |
| 采快照要注意什么？ | STW 阻塞事件循环、文件与堆同量级、先手动 GC |
| `--inspect` 的安全风险？ | 绑 0.0.0.0 暴露后等于任意代码执行入口 |
| 容器里怎么安全调试？ | SSH 隧道 / `kubectl port-forward`，不要直接暴露 |
| 异步栈什么时候会断？ | `await` 链默认有栈；断在 `setTimeout`/事件回调边界 |
| 断栈后怎么排查？ | `AsyncLocalStorage` 透传 reqId 串日志 |
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
   perf_hooks.monitorEventLoopDelay，上报 P99
   150ms 阻塞 → max 167.9ms；阈值：<20 健康 / 20-50 关注 / >100 严重
★ 内存看三字段
   heapUsed 涨     → JS 对象泄漏 → 三快照法
   external 涨     → Buffer 泄漏 → 查流 release / 大 Buffer 引用
   两者平但 rss 涨 → 碎片/native 泄漏
   ★ CPU 不高但慢  → 在等 I/O，去查依赖

【三快照法】
拍 1（启动）/ 2（操作后）/ 3（再操作同样时间）
★ 对比 2 和 3 的 Delta，不看总量
★ 采集代价：STW；实测 heapUsed 3.64MB → 快照 4.77MB、写入 55.8ms
  线上挑低峰、先 global.gc()、采完转存并删除

【调试】
console.log    最快，但侵入
--inspect      Chrome DevTools，功能最全；默认绑 127.0.0.1
--inspect-brk  启动即暂停，能调启动阶段
--prof         不连 DevTools，文本报告，适合线上/容器
clinic         doctor / flame / bubbleprof（bubbleprof 看异步等待）
★ 绑 0.0.0.0 且端口可达 = 任意代码执行入口
  容器用 SSH 隧道 / kubectl port-forward

【异步断栈】
await 链默认有栈（--async-stack-traces 默认开）
setTimeout / 事件回调处断栈
→ AsyncLocalStorage 透传 reqId，日志串起来

【火焰图读法】
看宽度（CPU 最多）/ 看深度（单次最慢）/ 看 (idle)
(idle) 高 → CPU 空闲，查 I/O，别优化代码

【优化优先级】
缓存 > 消除 N+1 > CPU 任务移出主线程 > 流式 > cluster > 连接池
★ 隐藏杀手：JSON.stringify 大对象、请求路径上的同步日志（用 pino）
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
□ 能说出 await 链与回调边界在调用栈上的区别，以及断栈后的三种解法
□ 能说出火焰图的三种读法
□ 能解释 (idle) 占比高意味着什么
□ 能说出至少五个优化手段的优先级
□ 能说出两个隐藏的性能杀手
```
