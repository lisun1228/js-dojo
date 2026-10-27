# Node.js 27 题｜总览与索引

> 来源：`8. Node.js（27题）.md`
> 组织方式：按 Node 的能力层次分册——运行时 → 异步与 I/O → 框架 → 服务端能力 → 运维 → 生态

---

## 0.1 先说结论：27 题全是「有内容」的，但只答了表层

27 道题都有答案，没有字面重复（「同第 N 题」）和跨文档悬空；但每条答案只有 1~3 句，只覆盖「是什么」，机制、边界和失败模式需要逐条补。覆盖面完整，可以当 checklist 用。

### 4 组考点重叠

| 组 | 题号 | 关系 |
|---|---|---|
| **Koa 中间件家族** | 19、20、21、23、25 | 洋葱模型的机制、历史、行为、对比，共用一套准备 |
| **模块系统** | 1、2、9 | 2 是 1 的细节；9 是 CJS 侧的查找机制 |
| **事件循环** | 3、10 | 10 是机制本身，3 是对比视角 |
| **process 与全局对象** | 15、16 | 16 的清单里包含 process |

Koa 的 5 道题合并到 05 册讲。

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

23 个考点可以挂到同一条主线上，避免只答单点：

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

按这条主线回答「说说你对 Node 的理解」：

- **第 1 层运行时**：V8 执行 JS，libuv 提供异步 I/O 与线程池，模块系统分 CJS 和 ESM。
- **第 2 层异步与 I/O**：事件循环决定回调什么时候执行，Stream 和 Buffer 决定大数据怎么不爆内存。
- **第 3 层框架**：Express/Koa 的中间件与洋葱模型。
- **第 4 层服务端能力**：鉴权、上传、分页这些具体问题。
- **第 5~6 层运维与生态**：pm2/cluster 解决多核和稳定性，npm 解决依赖管理。

后面每个具体问题都可以归到某一层。

---

## 0.3 这份题单里的答案「浅」在哪：三个对比

### 例 1：事件循环

题单只列了 6 个阶段名（timers、pending callbacks、idle/prepare、poll、check、close callbacks），真正要补的是三个顺序问题：

| 问题 | 结论 |
|---|---|
| `process.nextTick` 和 Promise 谁先 | CJS 顶层 nextTick 先；ESM 顶层 Promise 先（Node 22 实测）。nextTick 是独立队列，但 ESM 的模块求值路径不同 |
| `setImmediate` 和 `setTimeout(0)` 谁先 | 顶层不确定；I/O 回调内 setImmediate 一定先——poll 之后是 check，timers 要等下一轮 |
| 微任务何时清 | 每个阶段切换和每个回调后清，先 nextTick 队列再微任务队列 |

CJS 顶层实测（Node 22，顺序不保证）：`nextTick → Promise → queueMicrotask → setImmediate → setTimeout`；`fs.readFile` 回调内：`nextTick → Promise → setImmediate → setTimeout`。

### 例 2：CommonJS vs ESM

题单的 5 行表格（加载方式、导出、加载顺序、this、动态导入）全部正确，但缺三项最容易出错的语义差别：

| 差别 | 后果 |
|---|---|
| CJS 值拷贝，ESM live binding | CJS 导出的是快照，后续变化看不到；ESM 始终读最新值 |
| ESM 不做扩展名猜测 | `import './dep'` 直接 `ERR_MODULE_NOT_FOUND` |
| ESM 循环依赖触发 TDZ | 模块未执行完就访问绑定，抛 `ReferenceError`；CJS 可以先挂一部分 exports，反而能跑 |

完整十项见 03 册。

### 例 3：分页

题单只说了 OFFSET 和游标两种写法，没解释代价：

- OFFSET 的执行计划是 `SCAN`：扫描 `offset + limit` 行后丢弃前 offset 行，代价随偏移量线性增长。
- 游标分页是 `SEARCH ... USING INTEGER PRIMARY KEY (rowid>?)`：索引直接定位，代价与页码无关。
- 深分页改用 `WHERE id > ?` 或游标；不需要总页数时不查 `total`，多取一条判断 `hasNext`。

---

## 0.4 Node 面试的答题方法论

### 三段式（和工程化那套类似，但侧重不同）

每题按「解决什么问题 → 机制 → 边界与坑」三段回答，以 Stream 为例：

- **解决什么问题（15 秒）**：Stream 解决内存问题——2GB 文件不能一次读进内存。
- **机制（60 秒）**：分块 + 背压。Readable 每块默认 64 KiB（Node 22 的 `highWaterMark` 默认值），Writable 缓冲达到 `highWaterMark` 时 `write()` 返回 `false`，`pipe()` 据此暂停上游，这套流转由 `pipe()` 自动化。
- **边界与坑（30 秒）**：按字节切片会切断多字节字符，用 `StringDecoder` 或设 `encoding`；`pipe()` 默认不把 `error` 转发给下游，源流出错时目标流会挂住，应手动监听 `error` 或改用 `pipeline()`。

### 一份「深度清单」：答完任何一题后自检

| 问题 | 举例（以 Buffer 为例） |
|---|---|
| **它和相邻概念的区别是什么？** | Buffer vs Uint8Array：Buffer 是后者的子类，多了编码转换方法 |
| **它的性能/内存代价是什么？** | 小于 4 KiB 从共享 slab 切（省内存，但 `byteOffset` 非 0）；大于 4 KiB 单独分配 |
| **什么情况下会出错？** | 按字节切片切出半个中文字符 → 出现 `\uFFFD` 替换字符 |
| **典型使用场景是什么？** | 图片/文件上传分片、TCP 粘包处理、`crypto` 哈希结果 |

---

## 0.5 题单的 5 个问题

| # | 问题 | 需要补的正确说法 |
|---|---|---|
| 1 | **每条答案只有 1~3 句** | 只够答「是什么」，机制与边界要逐条补 |
| 2 | **没有提「坑」和「边界」** | 需要补齐失败模式与边界 |
| 3 | 题 3 说「Node 11+ 对齐浏览器」但没说对齐了什么 | 对齐的是微任务清空粒度，不是事件循环模型 |
| 4 | 题 11 的 EventEmitter 漏了 `error` 事件特例 | `emit('error')` 没有监听器会直接 throw |
| 5 | 题 27「npm 是什么」只说了一句话 | `package.json` 的 `exports` 控制包的子路径与可访问性 |

### 题 3 的具体问题

「Node 11+ 行为对齐浏览器」只对齐了微任务的清空粒度：

- Node 11 起，nextTick 队列在每个 timer / immediate 回调后清空（Node 11 changelog `#22842`）；微任务随同清空，阶段切换时也会清空。
- 浏览器是「一个宏任务 → 清空微任务」的循环；Node 是 6 个阶段的流水线。
- 所以「对齐」指清空时机，不是模型相同。

### 题 11 的具体问题

EventEmitter 除 `on` / `emit` / `off` 外，还有三个行为：

- `emit('error')` 没有监听器时直接 throw，不是静默失败。
- `emit` 期间修改监听器列表不影响本轮：Node 内部遍历的是数组拷贝。
- 监听器数量超过 `maxListeners`（默认 10）会打印内存泄漏警告。

详见 02 册。

---

## 0.6 本册的实测数据（可以先记结论）

### 事件循环的实测顺序

```
CJS 顶层：nextTick → Promise → queueMicrotask → setImmediate → setTimeout
ESM 顶层：Promise → queueMicrotask → nextTick → setImmediate → setTimeout
I/O 回调内：nextTick → Promise → setImmediate → setTimeout
```

顶层 `setImmediate` 与 `setTimeout(0)` 的先后不保证，取决于进入事件循环的时机；I/O 回调内 `setImmediate` 一定先。`nextTick` 与 Promise 的先后在 CJS / ESM 顶层不同。更多细节见 02 册。

### `require` 的查找优先级（实测）

```
相对/绝对路径 → 文件（补 .js/.json/.node）→ 目录（package.json main → index）
裸模块名 → 内置模块 → 逐级向上找 node_modules
```

`require.resolve('fs')` 返回裸名 `fs`，说明内置模块不经过文件查找。完整顺序见 03 册。

### CJS vs ESM 的十项差异（实测）

| 维度 | CommonJS | ES Module |
|---|---|---|
| 扩展名 | 可省略 | 必须写，否则 `ERR_MODULE_NOT_FOUND` |
| 顶层 `this` 与全局 | `module.exports`；有 `__dirname`、`require` | `undefined`；无 `__dirname`、`require` |
| 导出绑定 | 值拷贝 | live binding |
| 循环依赖 | 可运行，能拿到已挂载的部分导出 | 未初始化即访问 → `ReferenceError`（TDZ） |

其余六项（顶层 await、严格模式、静态分析、加载时机等）见 03 册。

### Buffer 的 slab 池化（实测）

小于 4 KiB 的 Buffer 从共享的 8 KiB slab 切出：`byteOffset` 非 0，多个 Buffer 共享同一个 `.buffer`；`Buffer.allocUnsafe(5000)` 独立分配，`byteOffset` 为 0。直接拿 `buf.buffer` 做底层操作时必须同时传 `byteOffset` 和 `byteLength`。详见 04 册。

### 编码截断的坑（实测）

`'中文'` 的 UTF-8 编码是 6 字节（`e4b8ad e69687`）。在 4 字节处截断再 `toString()` 得到 `"中\ufffd"`；用 `StringDecoder` 分块写，第一块输出 `"中"`，第二块输出 `"文"`。详见 04 册。

### 分页性能（80 万行真实 SQL）

OFFSET 的执行计划是 `SCAN users`——扫描 `offset + limit` 行后丢弃前 offset 行，耗时随偏移量线性增长；游标分页是 `SEARCH users USING INTEGER PRIMARY KEY (rowid>?)`，耗时基本恒定。深分页用游标而不是大 OFFSET。详见 06 册。

### JWT 的 `alg:none` 漏洞（实测复现）

JWT 的 header 只是 Base64URL 编码、未加密，算法声明也在里面。若校验时直接信任 header 的 `alg`，攻击者可改成 `none` 并把签名段留空，从而伪造任意 payload。防御是算法白名单，不使用 header 中的 `alg`。详见 06 册。

### cluster 分发与 keep-alive（实测）

cluster 在连接层分发，不在请求层。keep-alive 复用一条连接时，该连接上的请求都会落到同一个 worker（Node 19 起 `http.globalAgent` 默认 `keepAlive: true`），造成负载不均；关闭 keep-alive、使用多连接或上层负载均衡可缓解。详见 07 册。

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
□ 50. 说出「Node 服务内存持续增长」的排查路径
□ 51. 描述一次 Node 故障：现象、排查过程、根因、修复
□ 52. 说出 Node 20/22 相对 16 的三个可用新特性
□ 53. 说出 `--max-old-space-size` 什么时候要调
□ 54. 说出为什么 Node 不适合做图片/视频转码，但又要怎么做
□ 55. 说出 ESM 在 Node 里的现状（能不能在生产用）
```

---

## 0.8 分册导航

| 册 | 核心 | 优先级 |
|---|---|---|
| 00｜总览与索引 | 总览、六层模型、答题方法论 | — |
| 01｜运行时全景与全局对象 | Node 是什么、全局对象、process | ⭐⭐⭐ |
| 02｜事件循环与 EventEmitter | 事件循环、事件驱动 | ⭐⭐⭐⭐⭐ |
| 03｜模块系统：CommonJS 与 ES Module | 两种模块、查找策略、exports | ⭐⭐⭐⭐⭐ |
| 04｜Stream、Buffer 与 fs | 数据通道 | ⭐⭐⭐⭐ |
| 05｜Express 与 Koa 中间件 | 洋葱模型（5 题合并） | ⭐⭐⭐⭐⭐ |
| 06｜服务端实战：JWT、文件上传、分页 | 三个业务题 | ⭐⭐⭐⭐ |
| 07｜多进程、进程通信与 pm2 | fork/cluster/守护 | ⭐⭐⭐⭐ |
| 08｜性能监控与调试 | 定位问题 | ⭐⭐⭐⭐ |
| 09｜npm 与包管理 | 依赖管理 | ⭐⭐⭐ |

时间有限时按 02 → 03 → 05 → 07 的顺序看。

---

## 0.9 一句话速记

> **Node = V8（执行 JS）+ libuv（异步 I/O 与线程池）+ 标准库。**
>
> JS 执行是单线程的；网络 I/O 由操作系统完成（Linux/macOS 的 epoll/kqueue、Windows 的 IOCP），文件 I/O、`dns.lookup`、部分 `crypto` 走 libuv 线程池（默认 4 个线程）；CPU 密集代码会阻塞事件循环。
