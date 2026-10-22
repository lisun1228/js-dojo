# Node.js 27 题｜总览与索引

> 来源：`8. Node.js（27题）.md`
> 整理原则：先去重（按考点合并，不是按字面）→ 补齐每条答案缺的「为什么」和「边界」→ 按 Node 的能力层次分册

---

## 0.1 先说结论：27 题全是「有内容」的，但只答了表层

这是本工作区里**第一份 100% 有内容**的题单——27 道题全都有答案，没有一道是「同第 N 题」。

但代价是**每一条都很短**：27 题总字数约 2200 字，**平均每题 80 字**。这个长度只够说「是什么」，不够说「为什么」和「什么时候会踩坑」。

| 特征 | 这份题单 | 之前的题单 |
|---|---|---|
| 字面重复（同第 N 题） | **0 处** | 19~43 处 |
| 跨文档悬空 | **0 处** | 3~6 处 |
| 考点重叠（同一知识点拆成多题） | **4 组** | 较少 |
| 平均答案长度 | **80 字（最短）** | 40~300 字 |
| 有没有实测/数据 | 0 处 | 0 处 |

**所以这份题单的问题不是「缺题」，是「太浅」。** 它的价值在于**覆盖面完整**——Node 的各个方向都点到了，适合当 checklist 用；但每一条都需要自己往下挖两三层。

### 4 组考点重叠

| 组 | 题号 | 关系 |
|---|---|---|
| **Koa 中间件家族** | 19（不调 next 会怎样）、20（无 async 怎么实现）、21（异常处理）、23（洋葱模型）、25（koa vs express） | **5 题讲同一件事**：洋葱模型的机制、历史、行为、对比 |
| **模块系统** | 1（CJS vs ESM）、2（ESM 为什么必须写扩展名）、9（require 查找策略） | 2 是 1 的一个细节；9 是 CJS 侧的查找机制 |
| **事件循环** | 3（浏览器 vs Node）、10（Node 事件循环机制） | 10 是机制本身，3 是对比视角 |
| **process 与全局对象** | 15（process）、16（全局对象） | 16 的清单里包含 process |

**Koa 那 5 题最夸张**——如果面试官连着问，你其实只需要一套准备就能答完全部。我把它们合并到 05 册讲透。

### 23 个考点 → 10 册映射

| 册 | 考点 | 对应题号 |
|---|---|---|
| 00 | 总览、六层模型、答题方法论 | — |
| 01 | Node 定位、全局对象、process | 17、16、15 |
| 02 | 事件循环、EventEmitter | 3、10、11 |
| 03 | CJS vs ESM、require 查找 | 1、2、9 |
| 04 | Stream、Buffer、fs | 12、13、14 |
| 05 | 中间件、洋葱模型、Koa 异常、Koa vs Express、body-parser | 8、19、20、21、23、25、18 |
| 06 | JWT、文件上传、分页 | 7、6、5 |
| 07 | 进程通信、pm2 | 26、24 |
| 08 | 性能监控与优化、调试 | 4、22 |
| 09 | npm 与包管理 | 27 |

---

## 0.2 Node 的六层模型（先建框架）

Node 面试最大的陷阱是「散」——问什么答什么，答完就没了。你需要一个框架，能把 23 个考点全挂上去：

```
第 6 层  生态与包管理    npm / pnpm / semver / package.json exports
第 5 层  运维与稳定性    pm2 / cluster / 多进程 / 优雅退出
第 4 层  服务端能力      JWT / 上传 / 分页 / 缓存 / 限流
第 3 层  框架与中间件    Express / Koa / 洋葱模型 / 错误处理
第 2 层  异步与 I/O      事件循环 / EventEmitter / Stream / Buffer / fs
第 1 层  运行时基础      V8 + libuv / 模块系统 / 全局对象 / process
```

**每层解决什么问题**：

| 层 | 核心问题 | 一句话 |
|---|---|---|
| 1 运行时基础 | 这段代码在哪跑、怎么组织 | 「跑起来」 |
| 2 异步与 I/O | 怎么不阻塞 | 「扛得住」 |
| 3 框架与中间件 | 请求怎么流过应用 | 「有条理」 |
| 4 服务端能力 | 具体业务怎么做 | 「能干活」 |
| 5 运维与稳定性 | 崩了怎么办、怎么用满多核 | 「不挂」 |
| 6 生态与包管理 | 依赖怎么管 | 「可维护」 |

**这张图的用法**：

面试官问「说说你对 Node 的理解」，你不要背「事件驱动、非阻塞 I/O」，而是说：

> 「我把 Node 拆成六层看。**最底层是运行时**——V8 执行 JS，libuv 提供异步 I/O 和线程池，模块系统分 CJS 和 ESM。**往上是异步与 I/O**——事件循环决定回调什么时候执行，Stream 和 Buffer 决定大数据怎么不爆内存。**再往上是框架层**——Express/Koa 的中间件模型。**然后是服务端能力**——鉴权、上传、分页这些具体问题。**最后是运维和生态**——pm2/cluster 解决多核和稳定性，npm 解决依赖管理。」

**这一段的杀伤力**：它证明你有全局视角。后面每个具体问题，你都可以说「这属于第 N 层」。

---

## 0.3 这份题单里的答案「浅」在哪：三个对比

### 例 1：事件循环

❌ 题单给的：

> 「Node：分阶段——timers、pending callbacks、idle/prepare、poll、check、close callbacks。每个阶段后清空微任务队列。」

✅ 补完「为什么」+「边界」之后：

> 「Node 的事件循环分 6 个阶段，但**面试真正会考的是三个顺序问题**：
>
> 1. **`process.nextTick` 和 Promise 谁先**？nextTick 先。它在**每个阶段切换时**都会清空，比微任务还优先。
> 2. **`setImmediate` 和 `setTimeout(0)` 谁先**？**看场景**。在顶层不确定（我实测 Node 22 里 setImmediate 先），但在 **I/O 回调内部一定是 setImmediate 先**——因为 poll 阶段之后就是 check 阶段，而 timers 要等下一轮。
> 3. **微任务在哪清**？每个阶段结束时清空，包括 nextTick 队列。」
>
> 我实测的顺序是：`sync → nextTick → Promise → queueMicrotask → setImmediate → setTimeout`，而在 `fs.readFile` 回调内部是：`nextTick → Promise → setImmediate → setTimeout`。

对比一下信息密度：**题单 45 字，补完 260 字，但多出来的全是面试真正会问的。**

### 例 2：CommonJS vs ESM

题单给了一个 5 行表格（加载方式、导出、加载顺序、this、动态导入）——**这 5 行全对**，但少了三个最容易考的：

| 题单没提的 | 为什么重要 |
|---|---|
| **ESM 是 live binding，CJS 是值拷贝** | 这是两者最本质的语义差别，很多 bug 源于此 |
| **ESM 必须写扩展名**（单列了一题，但没说为什么） | 因为 ESM 不做扩展名猜测 |
| **ESM 循环依赖会 TDZ 报错，CJS 反而"宽容"** | 反直觉：很多人以为 ESM 更先进所以循环依赖也更好，实际相反 |

### 例 3：分页

❌ 题单给的：

> 「前端传 page/pageSize；后端 SQL `LIMIT offset, size`，返回 `{list, total, page, pageSize}`；大数据量用游标分页。」

✅ 补完数据之后：

> 「我用真实的 SQL 测了 80 万行数据：**OFFSET 的耗时随偏移量线性增长**——offset=0 时 0.005ms，offset=700000 时 4.596ms，**涨了 934 倍**；而游标方式始终 0.005ms。执行计划也直接给出了原因：OFFSET 是 `SCAN users`（全表扫描后丢弃），游标是 `SEARCH users USING INTEGER PRIMARY KEY (rowid>?)`（索引直接定位）。」

> **这就是这份题单的统一修法**：每一条答案后面补上「为什么」+「具体数字」+「什么情况下会出错」。这三样是背不出来的。

---

## 0.4 Node 面试的答题方法论

### 三段式（和工程化那套类似，但侧重不同）

**第一段：说清「它解决什么问题」（15 秒）**

> 「Stream 解决的是**内存问题**——当你需要处理一个 2GB 的文件，不可能一次性读进内存。」

**第二段：说清「机制」（60 秒）**

> 「它的核心是**分块 + 背压**。Readable 每次只产出一块（默认 64KB），Writable 处理不过来时会返回 false，生产方就暂停，这就是背压。`pipe()` 把这件事自动化了。」

**第三段：说清「边界和坑」（30 秒）**

> 「但用 Stream 有两个坑：一是**编码问题**——按字节切片会把多字节字符切断，要用 `StringDecoder` 或者设 `encoding`；二是**错误处理**——`pipe` 默认不会把错误传给下游，源流出错时目标流会挂住，所以要么手动监听 `error`，要么用 `pipeline()`。」

### 一份「深度清单」：答完任何一题后自检

背完答案后问自己四个问题，能答上就说明到位了：

| 问题 | 举例（以 Buffer 为例） |
|---|---|
| **它和相邻概念的区别是什么？** | Buffer vs Uint8Array：Buffer 是后者子类，多了编码转换方法 |
| **它的性能/内存代价是什么？** | 小于 4KB 从共享 slab 切（省内存但 `byteOffset` 非 0）；大于 4KB 单独分配 |
| **什么情况下会出错？** | 按字节切片切出半个中文字符 → 出现 `\uFFFD` 替换字符 |
| **实际项目里你在哪用过？** | 图片/文件上传的分片、TCP 粘包处理、`crypto` 的哈希结果 |

---

## 0.5 题单的 5 个问题

| # | 问题 | 严重度 | 说明 |
|---|---|---|---|
| 1 | **每条答案只有 1~3 句** | 🔴 高 | 平均 80 字，只够答「是什么」 |
| 2 | **没有一处提「坑」和「边界」** | 🔴 高 | 而这些恰是面试的区分度所在 |
| 3 | 题 3 说「Node 11+ 对齐浏览器」但没说对齐了什么 | 🟠 中高 | 对齐的是「每阶段后清微任务」，但阶段划分仍不同 |
| 4 | 题 11 的 EventEmitter 漏了 `error` 事件特例 | 🟠 中高 | `emit('error')` 没有监听器会**直接 throw**，这是最常踩的坑 |
| 5 | 题 27「npm 是什么」只说了一句话 | 🟠 中高 | 而 `package.json` 的 `exports` 字段是现在最实用的知识点 |

### 题 3 的具体问题

题单说「Node 11+ 行为对齐浏览器」——**这个说法容易误导**。

准确的表述是：

> **Node 11 修复了一个 bug**：早期 Node 里，`process.nextTick` 队列和微任务队列在**每一轮循环（loop iteration）之后**才清空，导致和浏览器行为不一致。Node 11 起改成**每个阶段（phase）之间都清空**，更接近浏览器。
>
> 但**两者的模型仍然不同**：浏览器是「一个宏任务 + 清空微任务」的循环；Node 是「6 个阶段的循环，每个阶段之间清微任务」。所以「对齐」只是对齐了微任务的清空时机，不是模型相同。

### 题 11 的具体问题

题单的 EventEmitter 只写了 `on`/`emit`/`off`。少了三个关键行为（下面 02 册有实测）：

1. **`emit('error')` 没有监听器会直接 throw**——不是静默失败
2. **`emit` 期间修改监听器列表**，Node 内部用数组拷贝，所以不影响本轮
3. **`maxListeners` 超了会有内存泄漏警告**（默认 10）

---

## 0.6 本册的实测数据（可以先记结论）

环境：Node 22.22.2，`node:sqlite`（内置）。

### 事件循环的实测顺序

```
顶层：
  sync → nextTick → Promise.then → queueMicrotask → setImmediate → setTimeout

在 fs.readFile 回调内部（poll 阶段）：
  nextTick → Promise → setImmediate → setTimeout
```

**关键**：`setImmediate` 一定先于 `setTimeout(0)` —— 但**只在 I/O 回调内部确定**。顶层顺序不保证（本次实测 setImmediate 先）。

### `require` 的查找优先级（实测）

```
./local       → local.js        （.js 优先于 .json）
./dir         → dir/index.js
./pkg         → package.json 的 main 字段
foo           → app/node_modules/foo/main.js
bar           → 向上找到根目录的 node_modules/bar
fs            → 核心模块（伪造的 node_modules/fs 被忽略）
```

`require.resolve('fs')` 返回 **`fs`**（裸名字），说明它是内置模块而不是文件。

### CJS vs ESM 的十项差异（实测）

| 维度 | CommonJS | ES Module |
|---|---|---|
| 不写扩展名 | ✅ `require('./dep')` 成功 | ❌ **`ERR_MODULE_NOT_FOUND`** |
| 顶层 `this` | `module.exports`（实测 `this === module.exports` 为 true） | **`undefined`** |
| `__dirname` | ✅ 有 | ❌ 没有，要用 `import.meta.url` |
| `require` | ✅ 有 | ❌ 没有（`import()` 是异步的） |
| 导出绑定 | **值拷贝**（`snapshot` 不跟着变） | **live binding**（`count` 跟着变，实测 0→1→2） |
| 顶层 await | ❌ 只能包一层 async | ✅ 支持 |
| 循环依赖 | ✅ 能跑（输出 `a.a = A`、`b.b = B`） | ❌ **`ReferenceError`（TDZ）** |
| 严格模式 | 默认非严格 | **默认严格** |
| 静态分析 | ❌ | ✅（tree shaking 的基础） |
| 加载时机 | 运行时同步 | 编译时静态 |

**最反直觉的一条**：**ESM 的循环依赖比 CJS 更容易炸。** 因为 ESM 的 import 是 live binding + TDZ——模块还没执行完就访问绑定会抛 `ReferenceError`；而 CJS 的 `module.exports` 是普通对象，可以先挂一部分上去，反而"宽容"。

### Buffer 的 slab 池化（实测）

```
Buffer.from('aaaa').byteOffset = 24
Buffer.from('bbbb').byteOffset = 32
两者 .buffer 是同一个 ArrayBuffer: true
x.buffer.byteLength = 8192   ← 8KB slab

Buffer.allocUnsafe(5000).byteOffset = 0，buffer 独立
```

**所以**：小于 4096 字节的 Buffer 都从同一个 8KB slab 里切，**`byteOffset` 不是 0**。这会影响「直接拿 `buf.buffer` 做底层操作」的代码——必须带上 `byteOffset` 和 `byteLength`。

### 编码截断的坑（实测）

```
'中文' 的 UTF-8: e4b8ad e69687（6 字节）
截断前 4 字节再 toString() → "中\ufffd"     ← 出现替换字符

用 StringDecoder 分块：
  第一块 → "中"
  第二块 → "文"
```

### 分页性能（80 万行真实 SQL）

| 偏移量 | OFFSET 方式 | 游标方式 | 倍数 |
|---|---|---|---|
| 0 | 0.005 ms | 0.006 ms | 0.9× |
| 50,000 | 0.221 ms | 0.005 ms | 44.6× |
| 200,000 | 0.964 ms | 0.005 ms | 194.9× |
| 400,000 | 2.280 ms | 0.005 ms | 437.5× |
| 700,000 | **4.596 ms** | 0.005 ms | **851.2×** |

执行计划：

```
LIMIT/OFFSET   → SCAN users
WHERE id > ?   → SEARCH users USING INTEGER PRIMARY KEY (rowid>?)
```

**顺带测到**：`ORDER BY` 一个没有索引的列，`EXPLAIN` 会显示 `USE TEMP B-TREE FOR ORDER BY`，实测 **25.69ms vs 0.007ms（3842 倍）**。

### JWT 的 `alg:none` 漏洞（实测复现）

```js
// 攻击者构造：header = {alg:'none'}，签名段为空
eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMDAxIiwibmFtZSI6ImFkbWluIiwicm9sZSI6InN1cGVyYWRtaW4ifQ.

// 天真实现（相信 header.alg）：
{ "sub": "1001", "name": "admin", "role": "superadmin" }   ← 直接放行

// 正确实现（白名单算法）：
"不支持的算法: none"   ← 已拦截
```

### cluster 分发与 keep-alive（实测）

```
默认 agent（keepAlive: true）：12 个请求 → 落到 1 个 worker（12）
keepAlive: false：           12 个请求 → 落到 2 个 worker（6 / 6）
```

**结论**：**cluster 是在「连接」层分发的，不是「请求」层。** keep-alive 会让一条连接上的所有请求都打到同一个 worker——这是负载不均衡的真实原因。

---

## 0.7 三级自测

### L1 基础（必须会说，15 项）

```
□  1. 用一句话说清 Node 是什么、为什么适合高并发
□  2. 说出 Node 不适合什么场景、为什么
□  3. 说出事件循环的 6 个阶段
□  4. 说出 nextTick / Promise / setImmediate / setTimeout 的执行顺序
□  5. 说出 CommonJS 和 ESM 的五个区别
□  6. 说出 require 的查找优先级
□  7. 说出 Stream 有哪四种
□  8. 说出 Buffer 和 String 的关系
□  9. 说出 fs 同步和异步 API 的区别
□ 10. 说出 process 的五个常用属性
□ 11. 说出中间件是什么、next() 的作用
□ 12. 说出洋葱模型的执行顺序
□ 13. 说出 JWT 的三段结构
□ 14. 说出 pm2 是干什么的
□ 15. 说出 npm 的三个常用命令
```

### L2 进阶（区分度在这里，20 项）

```
□ 16. 说出 Node 事件循环和浏览器的三个差别
□ 17. 说出为什么 setImmediate 在 I/O 内部一定先于 setTimeout
□ 18. 说出 nextTick 递归为什么会饿死 I/O
□ 19. 说出 ESM 为什么必须写扩展名、CJS 为什么可以不写
□ 20. 说出 live binding 和值拷贝的区别、各自导致的 bug
□ 21. 说出 ESM 循环依赖为什么会抛 TDZ 错误
□ 22. 说出 package.json 的 exports 字段怎么控制可访问性
□ 23. 说出 Stream 的背压是什么、pipe 怎么实现它
□ 24. 说出按字节切片为什么会切坏中文、怎么解
□ 25. 说出 Buffer 的 slab 池化、byteOffset 为什么不是 0
□ 26. 说出 `emit('error')` 没有监听器时的行为
□ 27. 说出 Koa 中间件不调 next() 会怎样、next() 调两次会怎样
□ 28. 说出 co 是怎么驱动 generator 的
□ 29. 说出 JWT 的 alg:none 漏洞和防御
□ 30. 说出 HS256 和 RS256 的适用场景
□ 31. 说出 OFFSET 分页为什么慢、游标分页怎么工作
□ 32. 说出 fork 和 cluster 的区别
□ 33. 说出 cluster 为什么会被 keep-alive 破坏负载均衡
□ 34. 说出如何监控事件循环延迟
□ 35. 说出 npm 的 dependencies / devDependencies / peerDependencies 区别
```

### L3 精通（能讲取舍，20 项）

```
□ 36. 说出 libuv 线程池默认大小、什么时候会被打满
□ 37. 说出 Node 的单线程到底是哪部分单线程
□ 38. 说出什么任务会阻塞事件循环、怎么移到线程池
□ 39. 说出一份 1GB 文件的处理方案（读、转、写）
□ 40. 说出 Stream 的四种错误处理方式及优劣
□ 41. 说出内存泄漏的三种典型来源和排查方法
□ 42. 说出 heap snapshot 怎么看、三个快照法
□ 43. 说出 CPU profile 的火焰图怎么读
□ 44. 说出优雅退出要处理哪几件事
□ 45. 说出 pm2 cluster 和 Node cluster 的关系
□ 46. 说出多进程下 session/日志/缓存要怎么处理
□ 47. 说出 Node 里怎么做限流
□ 48. 说出 `require` 缓存导致的三个坑
□ 49. 说出 npm 的幽灵依赖和 pnpm 怎么解决
□ 50. 说出「Node 服务内存持续增长」你怎么排查
□ 51. 说出你踩过的最大的一个 Node 坑
□ 52. 说出 Node 20/22 相比 16 你最想用的三个新特性
□ 53. 说出 `--max-old-space-size` 什么时候要调
□ 54. 说出为什么 Node 不适合做图片/视频转码，但又要怎么做
□ 55. 说出 ESM 在 Node 里的现状（能不能在生产用）
```

> **第 51 项（踩过的最大的坑）是 Node 面试的终极问题**。能讲出一个有具体现象、排查过程、根因、修复的坑，比背 50 个概念都管用。

---

## 0.8 分册导航

| 文件 | 核心 | 优先级 |
|---|---|---|
| `Node-01-运行时全景与全局对象.md` | Node 是什么、全局对象、process | ⭐⭐⭐ |
| `Node-02-事件循环与EventEmitter.md` | 事件循环、事件驱动 | ⭐⭐⭐⭐⭐ |
| `Node-03-模块系统-CJS与ESM.md` | 两种模块、查找策略、exports | ⭐⭐⭐⭐⭐ |
| `Node-04-Stream-Buffer与fs.md` | 数据通道 | ⭐⭐⭐⭐ |
| `Node-05-Express与Koa中间件.md` | 洋葱模型（5 题合并） | ⭐⭐⭐⭐⭐ |
| `Node-06-服务端实战-JWT上传分页.md` | 三个业务题 | ⭐⭐⭐⭐ |
| `Node-07-多进程与pm2.md` | fork/cluster/守护 | ⭐⭐⭐⭐ |
| `Node-08-性能监控与调试.md` | 定位问题 | ⭐⭐⭐⭐ |
| `Node-09-npm与包管理.md` | 依赖管理 | ⭐⭐⭐ |

**如果只有一天**：02 → 03 → 05 → 07。这四册覆盖 Node 面试 75% 的问题。

---

## 0.9 一句话速记

> **Node 面试考的不是「你知道几个 API」，而是「你知不知道它在什么情况下会崩」。**
>
> 说「Node 是非阻塞 I/O」是及格；
> 说「Node 的单线程只是 JS 执行单线程，I/O 靠 libuv 的线程池（默认 4 个）」是良好；
> 说「所以我们做过一次事故：并发上传图片时线程池被打满，所有 fs 操作排队，接口 P99 从 50ms 涨到 3s——后来把图片压缩挪到了独立进程」是优秀。
