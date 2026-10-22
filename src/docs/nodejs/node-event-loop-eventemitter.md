# Node 02｜事件循环与 EventEmitter

> 覆盖题号：3（浏览器 vs Node 事件循环）、10（Node 事件循环机制）、11（EventEmitter）
> 去重后：**2 个考点**

---

## 目录

- [2.1 题单答案的问题](#21-题单答案的问题)
- [2.2 一句话结论](#22-一句话结论)
- [2.3 六个阶段（先建立骨架）](#23-六个阶段先建立骨架)
- [2.4 三个必须答对的顺序问题](#24-三个必须答对的顺序问题)
- [2.5 node 11 到底「对齐」了什么](#25-node-11-到底对齐了什么)
- [2.6 浏览器 vs Node 完整对比](#26-浏览器-vs-node-完整对比)
- [2.7 `process.nextTick` 会饿死 I/O（实测）](#27-processnexttick-会饿死-io实测)
- [2.8 EventEmitter](#28-eventemitter)
- [2.9 面试怎么说（2 分钟版）](#29-面试怎么说2-分钟版)
- [2.10 追问总表（跨题）](#210-追问总表跨题)
- [2.11 速记卡](#211-速记卡)
- [2.12 自测](#212-自测)

---

## 2.1 题单答案的问题

> **3.** 「浏览器：宏任务和微任务，每轮宏任务后清空微任务队列。Node：分阶段——timers、pending callbacks、idle/prepare、poll、check、close callbacks。每个阶段后清空微任务队列。Node 11+ 行为对齐浏览器。」
>
> **10.** 「Node 单线程通过事件循环处理异步 I/O：调用 V8 执行 JS，异步操作交给 libuv 线程池，完成后回调进入对应队列，事件循环按阶段执行。」

**阶段名和流程都对**。但有两处需要修正、一处需要补：

| 问题 | 说明 |
|---|---|
| 「Node 11+ 行为对齐浏览器」 | **容易误导**。对齐的只是「微任务的清空时机」，**模型仍然不同** |
| 「异步操作交给 libuv 线程池」 | **不准确**。只有部分操作走线程池，网络 I/O 走的是 OS 的 epoll |
| 完全没提最关键的问题 | **`setImmediate` 和 `setTimeout(0)` 谁先？** 这才是面试真正会问的 |

---

## 2.2 一句话结论

> Node 的事件循环是**6 个阶段的循环**，每个阶段之间清空「nextTick 队列 + 微任务队列」。
>
> 面试真正要答的是**三个顺序问题**，不是背阶段名。

---

## 2.3 六个阶段（先建立骨架）

```
   ┌───────────────────────────┐
┌─>│        timers             │  setTimeout / setInterval 到期回调
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │     pending callbacks     │  上一轮延迟到本轮的 I/O 回调（如 TCP 错误）
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │      idle, prepare        │  内部使用（libuv）
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │           poll            │  ★ 核心：获取新 I/O 事件、执行 I/O 回调
│  └─────────────┬─────────────┘     这里会「等」——没有任务时阻塞在这里
│  ┌─────────────┴─────────────┐
│  │           check           │  setImmediate 回调
│  └─────────────┬─────────────┘
│  ┌─────────────┴─────────────┐
│  │      close callbacks      │  socket.on('close') 等
│  └─────────────┬─────────────┘
└────────────────┘
```

**每个阶段之间**（注意：不是每个阶段之后立刻，而是阶段切换时）会清空：

```
1. nextTick 队列（process.nextTick 的回调）
2. 微任务队列（Promise.then、queueMicrotask）
```

**这个「阶段之间清空」就是 Node 11 修复的那个行为。**

### 各阶段装什么

| 阶段 | 装什么 | 典型来源 |
|---|---|---|
| **timers** | 到期的定时器回调 | `setTimeout`、`setInterval` |
| **pending callbacks** | 延迟到下一轮的系统级回调 | TCP 连接错误（`ECONNREFUSED`） |
| **idle / prepare** | libuv 内部用 | 业务代码碰不到 |
| **poll** | **I/O 回调** | `fs.readFile`、`net.Socket`、`http` 请求 |
| **check** | `setImmediate` 回调 | `setImmediate` |
| **close callbacks** | 关闭类回调 | `socket.on('close')`、`stream.on('close')` |

### poll 阶段的两个行为（最容易被忽略）

poll 阶段是事件循环的「心脏」，它做两件事：

```
1. 计算应该阻塞多久：
   ① 如果 timers 阶段有到期的定时器 → 不阻塞，立刻进入下一轮
   ② 如果有 setImmediate → 不阻塞，去 check 阶段
   ③ 否则 → 阻塞等待 I/O 事件（最长等到下一个定时器到期）

2. 处理 poll 队列里的 I/O 回调
```

**这解释了为什么「Node 空闲时 CPU 占用接近 0」**——它阻塞在 poll 阶段等 I/O，不是死循环。

---

## 2.4 三个必须答对的顺序问题

### 问题 1：`nextTick` 和 `Promise` 谁先

**答案：`nextTick` 先。**

实测（顶层）：

```
0 sync
1 nextTick
2 Promise.then
3 queueMicrotask
```

**为什么**？因为 Node 的微任务有**两个队列**，且优先级不同：

```
nextTick 队列（process.nextTick）  ← 优先级更高
微任务队列（Promise / queueMicrotask）
```

每个阶段切换时，**先清空 nextTick 队列，再清空微任务队列**。而且在清空微任务队列的过程中如果又产生了 nextTick，**会回到 nextTick 队列再清一次**。

> **面试可以直接说**：「Node 里 `process.nextTick` 比 Promise 优先级更高，因为它是独立的队列，且在微任务之前清空。**这也是为什么很多人说 nextTick 不是微任务——严格说它是『比微任务更优先的队列』。**」

### 问题 2：`setImmediate` 和 `setTimeout(0)` 谁先

**答案：分场景。这是这道题的核心。**

#### 场景 A：在顶层（主模块）—— **不确定**

实测（Node 22.22.2）：

```
sync → nextTick → Promise.then → queueMicrotask → setImmediate → setTimeout
```

本次是 **setImmediate 先**。但这**不是保证的**。

**为什么不保证**？因为进入事件循环时的时机不同：

```
主模块执行耗时 → 进入循环时，setTimeout(0) 的 1ms 可能已经到了，也可能还没到
  → 到了：先走 timers 阶段，setTimeout 先
  → 没到：timers 阶段空转，走到 check 阶段，setImmediate 先
```

**所以顶层顺序取决于「主模块执行了多久」**——机器快慢、代码多少都会影响。**这是不确定的，面试要主动说出来。**

#### 场景 B：在 I/O 回调内部 —— **一定 setImmediate 先**

实测（在 `fs.readFile` 回调里注册）：

```
nextTick (在 I/O 内)
Promise (在 I/O 内)
setImmediate (在 I/O 内)     ← 一定先
setTimeout (在 I/O 内)       ← 一定后
```

**为什么一定**？因为 I/O 回调在 **poll 阶段**执行，poll 之后紧跟着就是 **check 阶段**（setImmediate），而 **timers 要等下一轮循环**。

```
poll 阶段（你的 I/O 回调在这里）
  ↓ 注册了 setImmediate 和 setTimeout
check 阶段 → setImmediate 执行        ← 同一轮
  ↓
（下一轮）timers 阶段 → setTimeout 执行  ← 晚一轮
```

> **这句话是标准答案**：
> 「`setImmediate` 和 `setTimeout(0)` 的顺序**在顶层不确定**，取决于进入事件循环的时机；**但在 I/O 回调内部，`setImmediate` 一定先执行**——因为 I/O 回调在 poll 阶段，poll 之后就是 check 阶段（setImmediate），而 timers 要等下一轮。」

### 问题 3：微任务在哪清

**答案：每个阶段切换时都清。**

实测验证：在两个相邻的 timer 里，前一个注册的 nextTick 和 Promise **都在后一个 timer 之前执行**：

```
timer A
  nextTick from A
  promise from A
timer B            ← 后注册的 timer 等到下一轮
```

**说明 timer A 执行完后，微任务被清空了，才继续。**

---

## 2.5 node 11 到底「对齐」了什么

题单说「Node 11+ 行为对齐浏览器」，这个说法容易让人以为「Node 就是浏览器那套」。**准确的说法是**：

| | Node ≤ 10 | Node ≥ 11 | 浏览器 |
|---|---|---|---|
| 微任务清空时机 | **每轮宏任务循环之后**（一轮 = 6 个阶段走完） | **每个阶段之间** | 每个宏任务之后 |
| 结果 | 一个 timer 里的 Promise 要等整轮循环结束才执行 | timer A 里的 Promise 在 timer B 之前执行 | 类似的「宏任务内清空」 |

**所以「对齐」只是让「微任务的清空粒度」变得和浏览器一样细**，**模型还是不同的**：

- 浏览器：`宏任务 → 清微任务 → 渲染 → 下一个宏任务`
- Node：`timers → 清 → pending → 清 → idle → 清 → poll → 清 → check → 清 → close → 清`

> **面试时这个区分能加分**：
> 「Node 11 改的是「微任务在什么时候清空」——从「每轮循环之后」改成「每个阶段之间」。这让它更接近浏览器的「每个宏任务后清微任务」。**但两者的循环模型本质不同：浏览器是宏任务队列，Node 是 6 个阶段的流水线。所以『对齐』是清空粒度对齐，不是模型相同。**」

---

## 2.6 浏览器 vs Node 完整对比

| 维度 | 浏览器 | Node |
|---|---|---|
| **循环结构** | 一个宏任务队列 + 一个微任务队列 | **6 个阶段**的循环 |
| **任务来源** | 用户交互、网络、定时器、渲染 | 文件 I/O、网络、定时器、`setImmediate` |
| **微任务清空** | 每个宏任务之后 | 每个阶段之间 |
| **独有的 API** | `requestAnimationFrame`、`MutationObserver`、`MessageChannel` | `setImmediate`、`process.nextTick`、`fs` 回调 |
| **渲染** | 有（`requestAnimationFrame` 在渲染前） | **没有渲染**，所以没有 rAF |
| **优先级队列** | 无（除 `queueMicrotask`） | **nextTick 队列 > 微任务队列** |
| **单次循环的耗时** | 受「渲染帧」约束（16.7ms） | **没有固定节拍**，有活就干 |

> **最容易答错的一点**：**`requestAnimationFrame` 在 Node 里不存在**。有人会把它和 `setImmediate` 类比，其实完全不同——`setImmediate` 是 check 阶段的回调，跟画面刷新无关。

---

## 2.7 `process.nextTick` 会饿死 I/O（实测）

这是一个很能体现深度的点。

```js
let depth = 0;
const spin = () => {
  depth++;
  if (depth <= 5) process.nextTick(spin);
  else console.log(`nextTick 递归 5 层后 setImmediate 才执行`);
};
process.nextTick(spin);
setImmediate(() => console.log('setImmediate (被 nextTick 递归推迟)'));
```

实测：

```
nextTick 递归 5 层后 setImmediate 才执行
setImmediate (被 nextTick 递归推迟)
```

**含义**：nextTick 队列不清空，事件循环就推进不了。**如果无限递归 nextTick，整个进程会卡死**（而且 CPU 100%，因为它不是异步等待）。

```js
// 这段代码会让进程永久卡住
function bad() {
  process.nextTick(bad);
}
bad();
// 事件循环永远进不去，所有 I/O 都不会响应
```

**对比 Promise**：

```js
// 同样会卡，但表现略有不同
function bad2() {
  Promise.resolve().then(bad2);
}
```
微任务队列被无限填充，也同样饿死——但 nextTick 的队列优先级更高，所以先用完。

> **实际项目里的场景**：
> 「`nextTick` 饿死 I/O 不是理论问题。我见过一次：递归 `nextTick` 做数据处理，日志里看到所有请求超时，但 CPU 只有 25%（单核打满）——**表现像死锁，实际是在无限清 nextTick 队列**。后来改成 `setImmediate` 分批处理就好了，因为 `setImmediate` 会让出一轮，I/O 有机会执行。」

---

## 2.8 EventEmitter

### 题单答案的问题

```js
class EventEmitter {
  constructor() { this.map = {}; }
  on(ev, cb) { (this.map[ev] ||= []).push(cb); }
  emit(ev, ...args) { (this.map[ev] || []).forEach(cb => cb(...args)); }
  off(ev, cb) { this.map[ev] = (this.map[ev] || []).filter(c => c !== cb); }
}
```

**这是「能跑」的最小版**，但漏了 Node 原生 `EventEmitter` 的**三个关键行为**，而这三个恰好是最常被追问的：

| 漏掉的 | 后果 |
|---|---|
| **`emit('error')` 没有监听器会直接 throw** | 这是 Node 里最经典的崩溃原因 |
| **`maxListeners` 超限警告** | 内存泄漏的早期信号 |
| **`emit` 期间修改监听器列表的行为** | 影响 `once` 的实现正确性 |

### 实测：原生 EventEmitter 的三个关键行为

#### ① `emit` 一个普通事件、没有监听器 → 静默返回 `false`

```
emit('nothing') → false
```

**不报错。** 这是符合预期的——事件可以「没人关心」。

#### ② `emit('error')` 没有监听器 → **直接 throw**

```
抛出了: 没人管我
```

**这是特例！** Node 把 `error` 事件当作「异常通道」：如果没有监听器处理，它会**把错误抛出去**（本质上是 `throw err`）。

```js
const e = new EventEmitter();
e.emit('error', new Error('boom'));   // ← 进程直接崩
```

加监听器就正常了：

```
加了 error 监听后：被捕获 → 这次没事
```

> **这个设计的意义**：
> 「`error` 事件是 EventEmitter 的『最后一道防线』。它假设『错误必须有人处理』，没人处理就崩给你看——**这比静默失败好**，因为静默失败会让问题在更远的地方爆发。
>
> 所以**任何用 EventEmitter 的地方，都应该注册一个 `error` 监听器**。这是 Node 的约定，不是可选项。」

#### ③ 超过 `maxListeners` → 内存泄漏警告

```
当前监听器数: 2
触发警告: MaxListenersExceededWarning -
  Possible EventEmitter memory leak detected. 3 x listeners added to [EventEmitter].
  MaxListeners is 2. Use emitter.setMaxListeners() to increase limit
```

**默认阈值是 10**。超了会打印警告（不是报错）。

**为什么会有这个警告**？因为「同一个事件注册了几百个监听器」通常是 bug——比如在循环里反复 `on` 却没 `off`。

> 实际场景：**WebSocket 连接泄漏**。每次重连都 `socket.on('message')` 但没清理旧的，监听器越堆越多，最后内存爆掉。**这个警告是第一手线索。**

### 其他实测行为

#### `once` / `prependListener` 的顺序

```
执行顺序: prepend → on-1 → on-2 → once → prepend → on-1 → on-2
剩余监听器数: 3
```

- `prependListener` 插到**最前面**
- `once` 只执行一次（第一次 emit 后就被移除）

#### `emit` 期间修改监听器列表

```
emit 中 removeAllListeners → 执行了 2 个（1, 2）
```

**即使第一个监听器里调用了 `removeAllListeners`，第二个仍然执行。**

**为什么**？因为 Node 内部在 `emit` 时会**先拷贝一份监听器数组**再遍历。所以「遍历中修改」不会影响本轮。

> **这个实现的必要性**：如果不拷贝，`once` 就无法安全实现——`once` 的包装函数会在执行时移除自己，如果没有拷贝，`forEach` 会跳过下一个监听器。

### 正确的手写实现

```js
class MyEventEmitter {
  constructor() {
    this._events = new Map();
  }

  on(event, cb) {
    if (!this._events.has(event)) this._events.set(event, []);
    this._events.get(event).push(cb);
    return this;                               // 支持链式
  }

  once(event, cb) {
    const wrapper = (...args) => {
      this.off(event, wrapper);                // ★ 先移除，再执行
      cb(...args);
    };
    wrapper._origin = cb;                      // 让 off(event, 原函数) 也能生效
    return this.on(event, wrapper);
  }

  off(event, cb) {
    const list = this._events.get(event);
    if (!list) return this;
    if (!cb) { this._events.delete(event); return this; }   // 不传 cb → 清空
    const i = list.findIndex(f => f === cb || f._origin === cb);
    if (i !== -1) list.splice(i, 1);
    if (list.length === 0) this._events.delete(event);      // 空数组也清掉
    return this;
  }

  emit(event, ...args) {
    // ★ error 特例
    if (event === 'error' && !this._events.has('error')) {
      throw args[0] instanceof Error ? args[0] : new Error('Unhandled error');
    }
    const list = this._events.get(event);
    if (!list) return false;
    for (const cb of list.slice()) {           // ★ 快照，防遍历中被改
      cb(...args);
    }
    return true;
  }
}
```

实测：

```
on + once + on: A,once,B,A,B        (once 只一次)
error 无监听 → 未捕获
```

### 五个关键点

| 点 | 为什么 |
|---|---|
| `error` 事件特例 | Node 约定：没人处理就 throw |
| `once` 先移除再执行 | ① 回调抛错也会移除；② 递归 emit 不会重复触发 |
| `list.slice()` 快照 | 遍历中 `off`/`on` 不影响本轮 |
| `wrapper._origin` | 让 `off(event, 原始函数)` 能删掉 `once` 注册的包装 |
| 空数组要 `delete` | 否则 Map 里堆满空数组，长跑应用会泄漏 |

### 追问链

| 追问 | 答法 |
|---|---|
| EventEmitter 和「发布订阅」区别？ | EventEmitter 是**观察者模式**（对象自己持有监听器列表）；发布订阅通常有个中间 EventBus（松耦合）。**实际用起来很像** |
| `emit` 是同步还是异步？ | **同步**。`emit` 会立刻执行所有监听器，全部执行完才返回 |
| 怎么让监听器并发执行？ | `emit` 里收集返回值 → `Promise.all(list.map(cb => cb(...)))`。**但这就改变了语义，要明确约定** |
| `EventEmitter` 能监听多少种事件？ | 无限（Map 存）。但注意 `maxListeners` 限制的是**单个事件**的监听器数 |
| 怎么避免内存泄漏？ | ① 每个 `on` 配一个 `off`；② 用 `once`；③ 长生命周期对象上注册时，用 `AbortSignal`（Node 的 `events.on` 支持 `{ signal }`）；④ 监控 `listenerCount` |
| `setMaxListeners(0)` 是什么意思？ | **取消限制**（不是设为 0 个）。某些框架会这么做（比如 `http.Server` 内部） |
| Stream 和 EventEmitter 什么关系？ | **Stream 继承自 EventEmitter**。所以能做到 `stream.on('data')` |
| `events.once(emitter, 'event')` 是干什么的？ | 静态方法，返回一个 Promise，等事件触发。**比手写 `new Promise` 更简洁，而且默认处理了 `error`** |

---

## 2.9 面试怎么说（2 分钟版）

### 事件循环

> 「Node 的事件循环我习惯先纠正一个常见误解：**它不是「单线程处理所有事」，而是「单线程执行 JS + libuv 处理 I/O」**。
>
> 循环本身分 6 个阶段，但面试真正考的是三个顺序问题：
>
> **第一，`nextTick` 和 `Promise` 谁先？** nextTick 先。Node 有两个微任务队列，nextTick 的优先级更高，每个阶段切换时先清 nextTick 再清微任务。实测顺序是 `sync → nextTick → Promise → queueMicrotask`。
>
> **第二，`setImmediate` 和 `setTimeout(0)` 谁先？** 这个要分场景说——**顶层不确定**，取决于进入循环时的时机；但**在 I/O 回调内部一定 setImmediate 先**，因为 I/O 回调在 poll 阶段，poll 之后就是 check 阶段，而 timers 要等下一轮。这个差别很多人答不出来。
>
> **第三，微任务在哪清？** 每个阶段之间都清。
>
> 至于和浏览器的区别，我要澄清一下题面里那句『Node 11+ 对齐浏览器』——**对齐的只是微任务的清空粒度**（从「每轮循环后」改成「每阶段之间」），**模型还是不同的**：浏览器是宏任务队列，Node 是 6 阶段流水线。而且 Node 没有渲染，所以没有 `requestAnimationFrame`。」

### EventEmitter

> 「EventEmitter 是 Node 的事件机制基础，Stream、http.Server 全都继承它。
>
> 核心 API 是 `on`/`emit`/`off`/`once`，但**有三个行为必须知道**：
>
> **第一，`emit('error')` 如果没有监听器，会直接 throw。** 这是特例——普通事件没人听就静默返回 false，但 `error` 没人听会崩进程。所以用 EventEmitter 的地方一定要注册 error 监听。
>
> **第二，超过 maxListeners（默认 10）会打印内存泄漏警告。** 这通常是「循环里反复 on 但忘了 off」的信号，是排查泄漏的第一手线索。
>
> **第三，`emit` 期间修改监听器列表不影响本轮**——因为 Node 内部会先拷贝数组。这也是 `once` 能正确实现的前提：`once` 的包装会在执行时移除自己，如果没有拷贝，就会跳过下一个监听器。
>
> 手写时我特别注意 `once` 要**先移除再执行**，这样即使回调抛错也不会残留，而且回调里递归 emit 也不会重复触发。」

---

## 2.10 追问总表（跨题）

| 问题 | 答法 |
|---|---|
| 事件循环一句话？ | 6 个阶段的循环，每阶段之间清 nextTick + 微任务 |
| 哪 6 个阶段？ | timers / pending / idle-prepare / poll / check / close |
| 哪个阶段最重要？ | **poll**，I/O 回调在这执行，空闲时阻塞在这 |
| poll 阻塞多久？ | 有到期定时器或 setImmediate → 不阻塞；否则等到下一个定时器 |
| nextTick 和微任务谁先？ | nextTick |
| 顶层 setImmediate vs setTimeout？ | 不确定 |
| I/O 内 setImmediate vs setTimeout？ | **setImmediate 一定先** |
| 为什么顶层不确定？ | 取决于主模块执行耗时是否让 timer 到期 |
| nextTick 会饿死 I/O 吗？ | 会，无限递归会卡死进程 |
| Node 11 改了什么？ | 微任务从「每轮循环后清」改成「每阶段之间清」 |
| 浏览器和 Node 最大的不同？ | Node 是 6 阶段流水线，浏览器是宏任务队列；Node 无渲染 |
| `emit('error')` 没监听器会怎样？ | 直接 throw |
| maxListeners 默认多少？ | 10，超了警告不报错 |
| `once` 为什么先移除再执行？ | 防抛错残留 + 防递归重复触发 |
| `emit` 是同步的吗？ | 是 |

---

## 2.11 速记卡

```
【六阶段】
timers → pending callbacks → idle/prepare → poll → check → close
每阶段之间清：nextTick 队列 → 微任务队列

【poll 是关键】
I/O 回调在这里
空闲时阻塞在这（所以 CPU 接近 0）
阻塞时长：有到期 timer 或 setImmediate 就不阻塞，否则等下一个 timer

【三个顺序问题】★
① nextTick > Promise
   实测：sync → nextTick → Promise.then → queueMicrotask
   原因：nextTick 是独立的高优先队列

② setImmediate vs setTimeout(0)
   顶层：不确定（取决于主模块耗时）
   I/O 回调内：setImmediate 一定先 ← 因为 poll 之后就是 check
   实测 I/O 内：nextTick → Promise → setImmediate → setTimeout

③ 微任务每个阶段之间都清

【Node 11 改了什么】
微任务清空从「每轮循环之后」→「每阶段之间」
对齐的是清空粒度，不是模型
Node：6 阶段流水线｜浏览器：宏任务队列
Node 无渲染 → 没有 requestAnimationFrame

【nextTick 会饿死 I/O】
递归 nextTick → 队列永不清空 → 循环推进不了
实测：递归 5 层后 setImmediate 才执行
现象：CPU 单核打满、所有请求超时

【EventEmitter 三个关键行为】★
① emit('error') 没监听器 → 直接 throw（普通事件返回 false）
② 超 maxListeners(10) → 警告（泄漏信号）
③ emit 期间改列表不影响本轮（内部拷贝数组）

【手写五要点】
error 特例 / once 先移除再执行 / list.slice() 快照
wrapper._origin / 空数组 delete

【Stream 继承 EventEmitter】
```

---

## 2.12 自测

```
□ 能默画 6 个阶段并说出每个装什么
□ 能说出 poll 阶段的两个行为、为什么会阻塞
□ 能答出 nextTick 和 Promise 谁先，并解释原因
□ 能说清 setImmediate 和 setTimeout 在顶层和 I/O 内的差别
□ 能解释为什么 I/O 内 setImmediate 一定先
□ 能说出 Node 11 到底改了什么、为什么「对齐」这个说法容易误导
□ 能说出浏览器和 Node 事件循环的三个差别
□ 能解释 nextTick 递归为什么会卡死进程、现象是什么
□ 能说出 emit('error') 没有监听器时的行为
□ 能说出 maxListeners 默认值和它的意义
□ 能解释 emit 期间 removeAllListeners 为什么还有效
□ 能说出 once 为什么必须先移除再执行
□ 能说出手写 EventEmitter 的五个要点
□ 能说出 Stream 和 EventEmitter 的关系
```
