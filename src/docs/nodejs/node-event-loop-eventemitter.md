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

阶段名和流程正确，三处需要修正：

| 问题 | 说明 |
|---|---|
| 「Node 11+ 行为对齐浏览器」 | 对齐的只是微任务清空粒度，**模型仍然不同** |
| 「异步操作交给 libuv 线程池」 | **不准确**。只有部分操作走线程池，网络 I/O 走 OS 的 epoll/kqueue |
| 没提 `setImmediate` 和 `setTimeout(0)` 的顺序 | 这是最常被追问的一点 |

---

## 2.2 一句话结论

> Node 的事件循环是 **6 个阶段的循环**，阶段之间清空 nextTick 队列与微任务队列。
>
> 需要答的是**三个顺序问题**：nextTick vs Promise、setImmediate vs setTimeout、微任务在哪清。

---

## 2.3 六个阶段（先建立骨架）

```
① timers            setTimeout / setInterval 到期回调
② pending callbacks 上一轮延迟的系统级回调（如 TCP ECONNREFUSED）
③ idle, prepare     libuv 内部使用，业务代码碰不到
④ poll              ★ 核心：取新 I/O 事件、执行 I/O 回调；无任务时阻塞在此
⑤ check             setImmediate 回调
⑥ close callbacks   socket.on('close')、stream.on('close')
```

阶段切换时按固定顺序清空两个队列：

```
1. nextTick 队列（process.nextTick）
2. 微任务队列（Promise.then、queueMicrotask）
```

poll 阶段的两个行为：

```
1. 计算阻塞时长：
   有到期的 timer 或待执行的 setImmediate → 不阻塞，继续下一阶段
   否则 → 阻塞等待 I/O，最长等到下一个 timer 到期
2. 执行 poll 队列中的 I/O 回调
```

所以 Node 空闲时 CPU 接近 0：它阻塞在 poll 等 I/O，不是空转。

---

## 2.4 三个必须答对的顺序问题

### 问题 1：`nextTick` 和 `Promise` 谁先

**`nextTick` 先。** 顶层实测（Node 22.12.0）：

```
0 sync
nextTick
Promise.then
queueMicrotask
```

Node 有两个「微任务级」队列，nextTick 队列优先级更高，阶段切换时先清空它。

两个边界（实测）：

```
nextTick 内注册 nextTick  → 同一次清空中执行
Promise 内注册 nextTick   → 等整条微任务队列清空后才执行
```

```
sync
nt1
nt2 (nextTick 内注册)
p1
promise (nextTick 内注册)
p2
nextTick (promise 内注册)
```

> ESM 入口顶层是例外：同一组代码实测为 `Promise.then → nextTick`，因为模块求值本身已在微任务中。

### 问题 2：`setImmediate` 和 `setTimeout(0)` 谁先

**分场景。**

#### 场景 A：顶层（主模块）—— 不确定

前四项稳定，之后两项 5 次实测（Node 22.12.0）出现两种顺序：

```
0 sync → nextTick → Promise.then → queueMicrotask
run 1  setTimeout → setImmediate
run 2  setImmediate → setTimeout
run 3  setImmediate → setTimeout
run 4  setImmediate → setTimeout
run 5  setTimeout → setImmediate
```

原因：进入事件循环时 `setTimeout(0)` 的 1ms 可能已到期，也可能未到期，取决于主模块执行耗时。

#### 场景 B：I/O 回调内 —— 一定 setImmediate 先

`fs.readFile` 回调内实测：

```
nextTick (I/O 内)
Promise (I/O 内)
setImmediate (I/O 内)
setTimeout (I/O 内)
```

I/O 回调在 poll 阶段执行，poll 之后紧接 check（setImmediate），timers 要等下一轮循环。

### 问题 3：微任务在哪清

**每个阶段之间都清**；Node ≥11 起，同一 timers 阶段内也是每个 timer 回调之后清。两个同批到期的 timer 实测：

```
timer A
nextTick from A
Promise from A
timer B
```

`timer B` 与 A 同批到期，但 A 的 nextTick 和 Promise 都排在 B 之前。

---

## 2.5 node 11 到底「对齐」了什么

「Node 11+ 行为对齐浏览器」容易读成「Node 就是浏览器那套」。实际对齐的只是**微任务的清空粒度**：

| 维度 | Node 10 及以前 | Node ≥11（本机 22.12 实测） | 浏览器 |
|---|---|---|---|
| 同一 timers / immediates 阶段的多个回调之间 | 不插入微任务，阶段内回调全部跑完才清 | 每个回调之后清空 | 不适用 |
| 循环模型 | 6 阶段流水线 | 6 阶段流水线 | 单宏任务队列 |
| 渲染 | 无 | 无 | 有，rAF 在渲染前 |

结论：**清空粒度对齐，模型不同**。Node 没有渲染，也就没有 `requestAnimationFrame`。

---

## 2.6 浏览器 vs Node 完整对比

| 维度 | 浏览器 | Node |
|---|---|---|
| 循环结构 | 宏任务队列 + 微任务队列 | **6 个阶段** |
| 任务来源 | 用户交互、网络、定时器、渲染 | 文件 I/O、网络、定时器、`setImmediate` |
| 微任务清空 | 每个宏任务之后 | 每个阶段之间（细则见 2.5） |
| 独有 API | `requestAnimationFrame`、`MutationObserver`、`MessageChannel` | `setImmediate`、`process.nextTick`、`fs` 回调 |
| 渲染 | 有，rAF 在渲染前 | **无**，也没有 rAF |
| 微任务优先级 | Promise 与 `queueMicrotask` 同队列 | nextTick 队列 > 微任务队列 |
| 循环节拍 | 受渲染帧约束（约 16.7ms） | 无固定节拍，有活就干 |

`requestAnimationFrame` 在 Node 里不存在；`setImmediate` 是 check 阶段回调，与画面刷新无关。

---

## 2.7 `process.nextTick` 会饿死 I/O（实测）

```js
let depth = 0;
const spin = () => {
  depth++;
  if (depth < 5) process.nextTick(spin);
  else console.log(`nextTick 递归 ${depth} 层后停止`);
};
process.nextTick(spin);
setImmediate(() => console.log('setImmediate 执行'));
```

```
nextTick 递归 5 层后停止
setImmediate 执行
```

nextTick 队列不清空，事件循环就无法推进。无限递归 nextTick 会占满 CPU，所有 I/O 都得不到响应。

Promise 无限递归同样饿死 I/O，但 nextTick 队列优先，会先被耗尽。

---

## 2.8 EventEmitter

### 题单最小实现缺什么

题单的最小实现只有 `on` / `emit` / `off`，缺少原生 `EventEmitter` 的三个行为：

| 缺的 | 后果 |
|---|---|
| `error` 事件无监听器时 throw | 未处理错误直接崩进程 |
| `maxListeners` 超限警告 | 丢失内存泄漏的早期信号 |
| `emit` 期间修改监听器列表 | `once` 与 `removeAllListeners` 行为不对 |

### 实测：三个关键行为

#### ① 普通事件无监听器 → 静默返回 `false`

```
emit('nothing') → false
```

#### ② `emit('error')` 无监听器 → 直接 throw

```
error 无监听器抛出: boom
error 有监听器: boom2
emit error 的返回值: true
```

`error` 是异常通道：普通事件无人监听就静默返回，`error` 无人监听则抛出。使用 EventEmitter 的对象都应注册 `error` 监听。

#### ③ 超过 `maxListeners` → 警告，不是报错

Node 22.12.0 实测：`setMaxListeners(2)` 后注册 3 个监听器。

```
(node:8112) MaxListenersExceededWarning: Possible EventEmitter memory leak detected.
3 x listeners added to [EventEmitter]. MaxListeners is 2. Use emitter.setMaxListeners() to increase limit
```

默认值是 10（`getMaxListeners()` 实测）。限制的是**单个事件**的监听器数量；常见来源是循环里反复 `on` 却没 `off`。

### 其他实测行为

`once` / `prependListener` 顺序（注册顺序：`on-1`、`on-2`、`once`、`prepend`）：

```
执行顺序: prepend → on-1 → on-2 → once → prepend → on-1 → on-2
剩余监听器: 3
```

- `prependListener` 插到最前面
- `once` 第一次 emit 后移除自身

`emit` 期间 `removeAllListeners`：

```
removeAll 前: 1
removeAll 后: 2
```

第一个监听器清空列表后，第二个仍然执行：`emit` 遍历的是拷贝后的快照。这也是 `once` 能安全移除自身的前提。

### 正确的手写实现

```js
class MyEventEmitter {
  constructor() {
    this._events = new Map();
  }

  on(event, cb) {
    if (!this._events.has(event)) this._events.set(event, []);
    this._events.get(event).push(cb);
    return this;
  }

  once(event, cb) {
    const wrapper = (...args) => {
      this.off(event, wrapper);                // 先移除，再执行
      cb(...args);
    };
    wrapper._origin = cb;                      // 让 off(event, 原函数) 也能生效
    return this.on(event, wrapper);
  }

  off(event, cb) {
    const list = this._events.get(event);
    if (!list) return this;
    if (!cb) { this._events.delete(event); return this; }
    const i = list.findIndex(f => f === cb || f._origin === cb);
    if (i !== -1) list.splice(i, 1);
    if (list.length === 0) this._events.delete(event);  // 空数组也清掉
    return this;
  }

  emit(event, ...args) {
    if (event === 'error' && !this._events.has('error')) {
      throw args[0] instanceof Error ? args[0] : new Error('Unhandled error');
    }
    const list = this._events.get(event);
    if (!list) return false;
    for (const cb of list.slice()) {           // 快照，防遍历中被改
      cb(...args);
    }
    return true;
  }
}
```

### 追问链

| 追问 | 答法 |
|---|---|
| `emit` 是同步还是异步？ | **同步**，所有监听器执行完才返回 |
| `maxListeners` 限制什么？ | 单个事件的监听器数量；`setMaxListeners(0)` 取消限制（实测 20 个监听器无警告） |
| 怎么避免内存泄漏？ | `on` 配 `off`、用 `once`、用 `events.on` 的 `{ signal }` 绑定 `AbortSignal`、监控 `listenerCount` |
| `events.once(emitter, name)` 是什么？ | 静态方法，返回 Promise，等事件触发；默认处理 `error` |
| Stream 和 EventEmitter 什么关系？ | Stream 继承自 EventEmitter，所以有 `stream.on('data')` |
| EventEmitter 和发布订阅区别？ | EventEmitter 是观察者模式（对象自己持有监听器）；发布订阅通常有中间 EventBus |

---

## 2.9 面试怎么说（2 分钟版）

### 事件循环

- 先界定：单线程执行 JS，异步 I/O 由 libuv 承担；网络 I/O 走 OS 的 epoll/kqueue，只有部分操作进线程池。
- 六阶段按顺序报一遍即可，重点放在 2.4 的三个顺序问题。
- `nextTick` 先于 Promise；顶层 `setImmediate` 与 `setTimeout(0)` 不确定，I/O 回调内 `setImmediate` 一定先。
- 收尾：Node 11 只改了微任务清空粒度，模型仍是六阶段流水线；Node 无渲染，没有 rAF。

### EventEmitter

- 定位：Node 事件机制基础，Stream、`http.Server` 都继承它。
- 三个行为：`emit('error')` 无监听器 throw；`maxListeners` 默认 10，超限只警告；`emit` 遍历快照，期间改列表不影响本轮。
- 手写：`once` 先移除再执行；`wrapper._origin` 让 `off` 能按原函数删除；空数组从 Map 里 delete。
- 补充：`emit` 同步执行；`setMaxListeners(0)` 取消限制；`events.once(emitter, name)` 返回 Promise。

---

## 2.10 追问总表（跨题）

| 追问 | 结论位置 |
|---|---|
| 事件循环一句话、六个阶段、poll 的两个行为 | 2.2、2.3 |
| nextTick 和微任务谁先 | 2.4 问题 1 |
| 顶层 `setImmediate` vs `setTimeout(0)` | 2.4 问题 2 场景 A |
| I/O 回调内 `setImmediate` vs `setTimeout(0)` | 2.4 问题 2 场景 B |
| 微任务在哪清 | 2.4 问题 3、2.5 |
| Node 11 改了什么 | 2.5 |
| 浏览器和 Node 最大的不同 | 2.6 |
| nextTick 会饿死 I/O 吗 | 2.7 |
| `emit('error')`、`maxListeners`、`once` 顺序、emit 同步 | 2.8 |
| Stream 和 EventEmitter 的关系 | 2.8 追问链 |

---

## 2.11 速记卡

```
【六阶段】
timers → pending callbacks → idle/prepare → poll → check → close
阶段切换：nextTick 队列 → 微任务队列

【三个顺序】
nextTick > Promise
顶层 setImmediate vs setTimeout(0)：不定
I/O 回调内：setImmediate 一定先
同一 timers 阶段：每个回调后清微任务

【Node 11】
清空粒度变细，模型不变；无渲染 → 无 rAF

【nextTick 饿死】
递归占满队列 → 事件循环无法推进

【EventEmitter】
error 无监听 → throw；普通事件 → false
maxListeners 默认 10，只警告；setMaxListeners(0) 取消
emit 同步；遍历快照
once 先移除再执行；_origin；空数组 delete
```

---

## 2.12 自测

```
□ 能默画 6 个阶段并说出每个装什么
□ 能说出 poll 阶段的两个行为、为什么空闲时 CPU 接近 0
□ 能答出 nextTick 和 Promise 谁先，以及 Promise 内注册 nextTick 的执行时机
□ 能说清 setImmediate 和 setTimeout 在顶层和 I/O 内的差别
□ 能解释为什么 I/O 内 setImmediate 一定先
□ 能说出 Node 11 到底改了什么
□ 能说出浏览器和 Node 事件循环的三个差别
□ 能解释 nextTick 递归为什么会卡死进程
□ 能说出 emit('error') 无监听、超 maxListeners、emit 期间 removeAllListeners 的行为
□ 能说出手写 EventEmitter 的五个要点
```
