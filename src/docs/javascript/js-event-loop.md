# JS · 04 事件循环

> 本册覆盖：事件循环、Promise 执行顺序、async/await 顺序
> 题单的答案：「同步先执行 → 微任务（Promise）→ 宏任务（setTimeout）」，**太粗，而且术语不准确**（规范里没有「宏任务」这个词）。
> 更重要的是：**题单把 223 道「输出题」压成一段话**，而事件循环输出题是这里面占比最高的。本册补了 **10 道**，全部在 Node 22 实测。

---

## 目录

- [4.1 一句话结论](#41-一句话结论)
- [4.2 为什么需要事件循环](#42-为什么需要事件循环)
- [4.3 浏览器的两个队列](#43-浏览器的两个队列)
- [4.4 一轮完整循环（含渲染时机）](#44-一轮完整循环含渲染时机)
- [4.5 微任务里再产生微任务（必问）](#45-微任务里再产生微任务必问)
- [4.6 Node.js 的六个阶段（和浏览器不一样）](#46-nodejs-的六个阶段和浏览器不一样)
- [4.7 十道输出题（题单 101~323 被折叠的部分）](#47-十道输出题题单-101323-被折叠的部分)
- [4.8 常见坑](#48-常见坑)
- [4.9 答题模板](#49-答题模板)
- [4.10 速记卡](#410-速记卡)

---

## 4.1 一句话结论

**JS 是单线程的，靠事件循环调度任务。每一轮循环：取出一个「任务（task）」执行完 → 清空「微任务（microtask）队列」直到为空 → （浏览器可能在这里渲染）→ 下一轮。**
**微任务会在「每个任务之后」全部执行完，包括微任务里新产生的微任务。**

⚠️ **术语纠正**：规范里只有 **task** 和 **microtask**（后者正式名是 **Job**），**「宏任务」是社区造的词**。面试时说「task / microtask」比「宏任务/微任务」更专业，但两者都能听懂。

---

## 4.2 为什么需要事件循环

**JS 是单线程的**（一个调用栈），但浏览器要做很多事：处理点击、发请求、跑定时器、渲染。

**如果所有事都同步做**：

```
用户点击 → 发请求 → 等 3 秒（阻塞） → 渲染
               ↑ 这 3 秒里页面完全卡死，点什么都没反应
```

**事件循环的作用**：**把「等待」变成「注册回调 + 继续做别的事」**，等结果到了再回来执行回调。

```
主线程：执行脚本 → 空闲 → 取任务 → 执行 → 清微任务 → 渲染 → 取任务 → ...
                            ↑
                    网络/定时器/事件 在别的线程完成后，把回调放进队列
```

---

## 4.3 浏览器的两个队列

### 4.3.1 task 队列（社区叫「宏任务」）

| 来源 | 说明 |
|---|---|
| **`setTimeout` / `setInterval`** | 定时器 |
| **`setImmediate`** | ⚠️ **只有 Node 有**，浏览器没有 |
| **`MessageChannel`** | 跨线程通信（Vue 3 用它做 `nextTick`） |
| **`postMessage`** | 跨窗口通信 |
| **DOM 事件回调** | 点击、滚动、输入 |
| **`<script>` 执行** | 整个脚本本身就是一个 task |
| **网络请求回调**（`XHR`/`fetch` 的完成回调） | |
| **`requestAnimationFrame`** | ⚠️ **特殊**：不属于 task 队列，在渲染前执行（见 4.5） |

### 4.3.2 microtask 队列（社区叫「微任务」）

| 来源 | 说明 |
|---|---|
| **`Promise.then/catch/finally`** | 最常用 |
| **`queueMicrotask(fn)`** | 显式入队（ES2020） |
| **`MutationObserver`** | DOM 变化监听 |
| **`await` 后面的代码** | 本质是 Promise 的 then |
| **`process.nextTick`** | ⚠️ **只有 Node 有**，且优先级比 Promise 还高 |

### 4.3.3 一个关键差异

```js
setTimeout(fn, 0);          // 浏览器：4ms（嵌套 5 层后）
setImmediate(fn);           // 浏览器：不存在（TypeError）
requestAnimationFrame(fn);  // 浏览器：渲染前
queueMicrotask(fn);         // 都有
```

**`setTimeout(fn, 0)` 在浏览器里不是真的 0ms**：
- 规范规定**嵌套超过 5 层后，最小延迟 4ms**
- 页面在后台时，最小延迟变成 1000ms（节能）

---

## 4.4 一轮完整循环（含渲染时机）

```
┌─────────────────────────────────────────────────────────┐
│  ① 从 task 队列取【一个】task 执行                        │
│     （如果一个都没有，就等新的来）                          │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│  ② 清空 microtask 队列（直到为空）                        │
│     ★ 执行过程中新产生的 microtask 也会在本轮执行完        │
└────────────────────────┬────────────────────────────────┘
                         ▼
┌─────────────────────────────────────────────────────────┐
│  ③ 判断是否需要渲染（浏览器自行决定，通常 ~16.7ms 一次）    │
│     ├─ 执行 requestAnimationFrame 回调                    │
│     ├─ 样式计算 → 布局 → 绘制 → 合成                      │
│     └─ 执行 ResizeObserver / IntersectionObserver 回调    │
└────────────────────────┬────────────────────────────────┘
                         ▼
                    回到 ①，下一轮
```

**三个关键点**：

| 点 | 说明 |
|---|---|
| **一次只取一个 task** | 不是「把 task 队列清空」，只取一个 |
| **microtask 要清空** | 一直执行到队列为空，包括新产生的 |
| **渲染时机不确定** | 浏览器根据帧率决定，不是每轮都渲染 |

---

## 4.5 微任务里再产生微任务（必问）

```js
Promise.resolve().then(() => {
  console.log('m1');
  Promise.resolve().then(() => console.log('m2'));
});
Promise.resolve().then(() => console.log('m3'));
```

**答案**（实测）：`m1` → `m3` → `m2`

**为什么**：

```
初始微任务队列：[m1, m3]

执行 m1 → 打印 'm1' → 把 m2 加入队尾
    队列变成：[m3, m2]

执行 m3 → 打印 'm3'
    队列变成：[m2]

执行 m2 → 打印 'm2'
    队列空 → 本轮结束
```

**结论：微任务是「FIFO + 直到队空」，不是「执行完当前快照」**。

**⚠️ 危险**：如果微任务里**无限产生**微任务，会**永久卡死**（渲染永远不发生）。

```js
function loop() {
  Promise.resolve().then(loop);    // 💥 页面直接卡死
}
loop();
```

**这也是「为什么不能用微任务做轮询」的原因**——会饿死渲染。

---

## 4.6 Node.js 的六个阶段（和浏览器不一样）

### 4.6.1 六个阶段

```
┌─────────────────────────────┐
│ ① timers                    │  setTimeout / setInterval 到期回调
├─────────────────────────────┤
│ ② pending callbacks         │  上一轮延迟的系统回调（如 TCP error）
├─────────────────────────────┤
│ ③ idle, prepare             │  内部使用
├─────────────────────────────┤
│ ④ poll                      │  ★ 核心：等 I/O，执行 I/O 回调
├─────────────────────────────┤
│ ⑤ check                     │  setImmediate 回调
├─────────────────────────────┤
│ ⑥ close callbacks           │  close 事件（socket.on('close')）
└─────────────────────────────┘
         ↑ 每阶段之间都会清空 nextTick 队列 + microtask 队列
```

### 4.6.2 `process.nextTick` 优先级最高

**Node 里有两个「微任务级别」的队列，执行顺序是**：

```
process.nextTick 队列  →  microtask（Promise）队列
```

**实测**：

```js
Promise.resolve().then(() => console.log('1 Promise'));
process.nextTick(() => console.log('2 nextTick'));
setImmediate(() => console.log('3 setImmediate'));
setTimeout(() => console.log('4 setTimeout 0'), 0);

// 实测输出：
// 2 nextTick
// 1 Promise
// 3 setImmediate
// 4 setTimeout 0
```

**但注意**：`setImmediate` 和 `setTimeout(0)` 的先后**在主模块里是不确定的**（Node 官方文档明确说了），取决于进程启动耗时。**只有在 I/O 回调里，`setImmediate` 才一定先于 `setTimeout`**：

```js
fs.readFile(__filename, () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
  // 这里 immediate 一定先（因为 readFile 回调在 poll 阶段，下一个是 check 阶段）
});
```

**我实测的这次是 setImmediate 先，但不要把它当定论**——面试时要主动说「这个顺序不稳定」。

### 4.6.3 在 timer 回调里的顺序（这个是确定的）

```js
setTimeout(() => {
  setTimeout(() => console.log('setTimeout from timer'), 0);
  setImmediate(() => console.log('setImmediate from timer'));
  Promise.resolve().then(() => console.log('Promise from timer'));
  process.nextTick(() => console.log('nextTick from timer'));
}, 30);
```

**实测输出**：

```
nextTick from timer
Promise from timer
setImmediate from timer
setTimeout from timer
```

**为什么 `setTimeout from timer` 排最后**：因为新注册的 `setTimeout(0)` 要等到**下一轮**的 timers 阶段，而 `setImmediate` 在**本轮**的 check 阶段就会执行，check 在 timers 之后。

---

## 4.7 十道输出题（题单 101~323 被折叠的部分）

> 全部在 Node 22 实测。**先自己答，再看答案。**

### 题 1：最基础

```js
console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve().then(() => console.log('3'));
console.log('4');
```

**答案**：`1` → `4` → `3` → `2`

**解析**：同步代码先执行（1、4），然后清微任务（3），然后下一个宏任务（2）。

---

### 题 2：`queueMicrotask` 与 `Promise.then` 的顺序

```js
setTimeout(() => console.log('T'), 0);
Promise.resolve().then(() => console.log('P'));
queueMicrotask(() => console.log('Q'));
```

**答案**：`P` → `Q` → `T`

**解析**：`Promise.then` 和 `queueMicrotask` **都进同一个微任务队列**，按**入队顺序**执行。这里 `P` 先注册，所以先执行。

---

### 题 3：微任务里产生微任务

```js
Promise.resolve().then(() => {
  console.log('m1');
  Promise.resolve().then(() => console.log('m2'));
});
Promise.resolve().then(() => console.log('m3'));
```

**答案**：`m1` → `m3` → `m2`

**解析**：见 4.5。微任务是「直到队空」，`m2` 排在 `m3` 后面。

---

### 题 4：经典混合题（最高频）

```js
async function async1() {
  console.log('async1 start');
  await async2();
  console.log('async1 end');
}
async function async2() {
  console.log('async2');
}

console.log('script start');
setTimeout(() => console.log('setTimeout'), 0);
async1();
new Promise((resolve) => {
  console.log('promise1');
  resolve();
}).then(() => console.log('promise2'));
console.log('script end');
```

**答案**（实测）：

```
script start
async1 start
async2
promise1
script end
async1 end
promise2
setTimeout
```

**逐步解析**：

| 步 | 动作 | 输出 | 微任务队列 |
|---|---|---|---|
| 1 | 打印 `script start` | `script start` | — |
| 2 | 注册 setTimeout | — | — |
| 3 | 调 `async1()` → 打印 `async1 start` | `async1 start` | — |
| 4 | `await async2()` → 先执行 `async2()` → 打印 `async2`，返回 undefined | `async2` | — |
| 5 | `await` 把 undefined 包成 Promise，**挂起 async1**，把「恢复 async1」加入微任务 | — | `[resume-async1]` |
| 6 | `new Promise` 的 executor **同步执行** → 打印 `promise1`，`resolve()` | `promise1` | `[resume-async1]` |
| 7 | `.then` 注册回调（因为已 resolve，回调入队） | — | `[resume-async1, promise2]` |
| 8 | 打印 `script end` | `script end` | 同上 |
| 9 | 同步结束，清微任务：执行 resume-async1 → 打印 `async1 end` | `async1 end` | `[promise2]` |
| 10 | 执行 promise2 → 打印 `promise2` | `promise2` | `[]` |
| 11 | 下一轮宏任务：`setTimeout` | `setTimeout` | — |

**关键点：`new Promise(executor)` 的 executor 是同步执行的**，所以 `promise1` 在 `script end` 之前打印。很多人答错这一条。

---

### 题 5：`await` 后面是普通值

```js
async function f() {
  console.log('f start');
  await null;
  console.log('after await null');
}
f();
Promise.resolve().then(() => console.log('then1'));
Promise.resolve().then(() => console.log('then2'));
```

**答案**（实测）：`f start` → `after await null` → `then1` → `then2`

**解析**：`await null` 会**立刻**把「恢复 f」加入微任务队列（在 `then1`/`then2` 之前注册的），所以它先执行。

**⚠️ 但注意**：`await` 一个 **thenable** 会多一层微任务（见下题）。

---

### 题 6：`await` 非 thenable vs thenable（细节题）

```js
async function f() {
  console.log('A');
  await null;                  // 非 thenable
  console.log('B');
  await Promise.resolve();     // thenable
  console.log('C');
}
f();
console.log('D');
Promise.resolve().then(() => console.log('P1'));
Promise.resolve().then(() => console.log('P2'));
```

**答案**（实测）：`A` → `D` → `B` → `P1` → `P2` → `C`

**解析**：

| 步 | 微任务队列 |
|---|---|
| 同步：打印 A，`await null` 入队 resume-B | `[resume-B]` |
| 打印 D | — |
| 入队 P1、P2 | `[resume-B, P1, P2]` |
| 清空：resume-B → 打印 B，`await Promise.resolve()` 入队（**这里是 2 层**） | `[P1, P2, resume-C-1]` |
| P1 → 打印 P1 | `[P2, resume-C-1]` |
| P2 → 打印 P2 | `[resume-C-1]` |
| resume-C-1 → 排队 resume-C-2 | `[resume-C-2]` |
| resume-C-2 → 打印 C | `[]` |

**结论**：
- **`await 非 thenable`**（`null`、`1`、`'a'`）→ 让出 **1 次**微任务
- **`await thenable`**（Promise）→ 让出 **2 次**微任务

**这是本题最值钱的知识点。**

---

### 题 7：`Promise` 构造函数里 reject 后还继续执行

```js
new Promise((resolve, reject) => {
  console.log('executor');
  reject('err');
  console.log('after reject');     // ← 会执行！
}).catch((e) => console.log('catch:', e));
```

**答案**：`executor` → `after reject` → `catch: err`

**解析**：**`reject()` 不会中断 executor 的执行**（不是 `throw`）。它只是把 Promise 状态改成 rejected，后面的代码继续跑。

**要中断必须 `return` 或 `throw`**：

```js
new Promise((resolve, reject) => {
  reject('err');
  return;                          // ← 手动返回
  console.log('不会执行');
});
```

---

### 题 8：`then` 返回 Promise 会「多等一层」

```js
Promise.resolve()
  .then(() => {
    console.log('1');
    return Promise.resolve();    // ← 返回 Promise
  })
  .then(() => console.log('2'));

Promise.resolve()
  .then(() => {
    console.log('3');
    return undefined;            // ← 返回普通值
  })
  .then(() => console.log('4'));
```

**答案**：`1` → `3` → `4` → `2`

**解析**：`then` 的回调返回 Promise 时，会**多等 2 个微任务**（Promise 要被 resolve，然后外层 Promise 才能 resolve）。

**这个差异在复杂题目里会导致顺序颠倒。**

---

### 题 9：`async` 函数的返回值

```js
async function a() { return 1; }
async function b() { return Promise.resolve(2); }

a().then(v => console.log('a:', v));
b().then(v => console.log('b:', v));
```

**答案**（实测）：`a: 1` → `b: 2`

**解析**：`async` 函数**总是返回 Promise**。`return 1` 被包成 `Promise.resolve(1)`；`return Promise.resolve(2)` 会被**「吸收」**（不是嵌套 Promise），所以 `.then` 拿到的是 `2` 而不是 Promise。

---

### 题 10：`setTimeout` 延迟不准

```js
const start = Date.now();
setTimeout(() => {
  console.log(Date.now() - start);   // 多少？
}, 0);

const s = Date.now();
while (Date.now() - s < 50) {}       // 同步阻塞 50ms
```

**答案**（实测）：**约 51ms**（不是 0）

**解析**：`setTimeout(0)` 只是「尽快排进队列」，但**必须等当前同步代码执行完**。同步阻塞了 50ms，所以回调至少延迟 50ms。

**这解释了「为什么 `setTimeout(fn, 0)` 不能保证立即执行」，也解释了「长任务会阻塞渲染和交互」。**

---

## 4.8 常见坑

| 坑 | 正确说法 |
|---|---|
| 说「宏任务/微任务是规范术语」 | 规范里是 **task / microtask（Job）**，「宏任务」是社区词 |
| 说「每轮把宏任务队列全部执行完」 | ❌ **只取一个** task |
| 说「微任务执行完当前快照就停」 | ❌ 一直执行到队列为空，**包括新产生的** |
| 说「`await` 后面的代码是宏任务」 | 是**微任务** |
| 说「`await` 都让出 1 次微任务」 | 非 thenable 1 次，**thenable 2 次** |
| 说「`new Promise` 的 executor 是异步的」 | **同步执行** |
| 说「`reject()` 会中断执行」 | ❌ 不会，只是改状态；要中断得 `return`/`throw` |
| 说「`setImmediate` 一定先于 `setTimeout(0)`」 | 主模块里**不确定**，只有 I/O 回调里确定 |
| 说「`setTimeout(0)` 就是 0ms」 | 浏览器嵌套 5 层后 4ms；后台 1000ms；且被同步代码阻塞 |
| 说「`requestAnimationFrame` 是宏任务」 | 它**不在 task 队列**，在渲染前执行 |
| 说「Node 和浏览器事件循环一样」 | Node 有六阶段，还多一个 `nextTick` 队列（优先级最高） |
| 用微任务做轮询 | 会饿死渲染（微任务无限产生 → 页面卡死） |

---

## 4.9 答题模板

### 30 秒版

> JS 是单线程的，靠事件循环调度。每一轮：从 task 队列取**一个**任务执行完 → **清空微任务队列（直到为空）** → 浏览器可能在这一步渲染 → 下一轮。
> task 有 `setTimeout`、DOM 事件、网络回调；微任务有 `Promise.then`、`queueMicrotask`、`MutationObserver`、`await` 后面的代码。
> 关键点：微任务不是「执行完当前快照」，而是「一直执行到队列为空」，包括执行过程中新产生的。

### 2 分钟版（完整版，推荐）

> 我分「浏览器」「Node」「输出题技巧」三块说。
>
> **浏览器**这边，规范里只有 task 和 microtask（后者正式名叫 Job），「宏任务」是社区造的词。一轮循环是：取**一个** task 执行 → 清空 microtask 队列直到为空 → （浏览器判断要不要渲染，这时会跑 `requestAnimationFrame` 和布局绘制）→ 下一轮。注意两点：**task 是一次只取一个**，不是清空队列；**microtask 要清到空**，包括执行中新产生的，所以微任务里无限产生微任务会卡死页面。
>
> **Node** 有六个阶段：timers、pending callbacks、idle/prepare、poll、check、close callbacks，每个阶段之间都会清空 `nextTick` 队列和微任务队列。Node 还多一个 `process.nextTick` 队列，**优先级比 Promise 还高**。实测顺序是 nextTick → Promise → setImmediate → setTimeout(0)，但要注意 **setImmediate 和 setTimeout(0) 在主模块里顺序不确定**，只有 I/O 回调里 setImmediate 才一定先。
>
> **输出题的技巧**，我总结成四步：**① 先扫一遍把所有同步代码标出来**（包括 `new Promise` 的 executor，它是同步的）；**② 把 `await` 后面的代码当成 `then` 回调**；**③ 按入队顺序排微任务**；**④ 记住两个细节**：`await` 非 thenable 让出 1 次微任务、`await` thenable 让出 2 次；`then` 的回调返回 Promise 会多等 2 个微任务。这两个细节会让顺序和直觉不一样。
>
> 另外补充一个常见的错：`reject()` **不会中断** executor 的执行，它只是改状态，后面的代码继续跑，要中断必须 `return` 或 `throw`。

### 追问表

| 追问 | 回答要点 |
|---|---|
| 宏任务和微任务的规范名 | task / microtask（Job），「宏任务」是社区词 |
| 一轮循环做什么 | 取 1 个 task → 清空 microtask → 可能渲染 |
| 微任务会清到空吗 | 会，包括执行中新产生的 |
| 微任务无限产生会怎样 | 页面卡死（渲染被饿死） |
| `await` 让出几次微任务 | 非 thenable 1 次，thenable 2 次 |
| `new Promise` executor 同步吗 | 同步 |
| `reject()` 会中断吗 | 不会，只是改状态 |
| `then` 返回 Promise 会怎样 | 多等 2 个微任务 |
| `setTimeout(0)` 真的是 0ms 吗 | 不是，至少 1ms；嵌套 5 层后 4ms；被同步代码阻塞 |
| `requestAnimationFrame` 在哪个队列 | 不在 task 队列，在渲染前 |
| Node 有几个阶段 | 六个；每阶段之间清 nextTick 和 microtask |
| `nextTick` 和 Promise 谁先 | nextTick 先 |
| `setImmediate` 一定先于 `setTimeout(0)` 吗 | 主模块不确定，I/O 回调里确定 |
| 浏览器和 Node 事件循环区别 | Node 六阶段 + nextTick；浏览器有渲染步骤 |
| 为什么 `setTimeout` 延迟不准 | 只保证「不早于」，不保证「准时」 |

---

## 4.10 速记卡

```
术语
  task（宏任务，社区词）/ microtask（Job，微任务）
  一轮 = 取 1 个 task → 清空 microtask → 可能渲染

task 来源
  setTimeout / setInterval / DOM 事件 / 网络回调 / script 本身
  ★ setImmediate 只有 Node；requestAnimationFrame 不在 task 队列

microtask 来源
  Promise.then/catch/finally / queueMicrotask / MutationObserver / await 后面
  ★ process.nextTick 只有 Node，优先级高于 Promise

★ 微任务清到空（包括新产生的）
  m1 → m3 → m2（不是 m1 → m2 → m3）
  无限产生会卡死渲染

输出题四步法
  ① 标同步代码（new Promise 的 executor 也同步！）
  ② await 后面 = then 回调
  ③ 按入队顺序排微任务
  ④ 记两个细节：await 非 thenable 1 次微任务 / thenable 2 次
                then 返回 Promise 多等 2 个微任务

Node 六阶段
  timers → pending → idle/prepare → poll → check(setImmediate) → close
  每阶段之间清 nextTick 再清 microtask
  实测：nextTick > Promise > setImmediate > setTimeout(0)
  ★ setImmediate vs setTimeout(0) 主模块不确定，I/O 回调里确定

setTimeout 不保证准时
  只保证「不早于」；嵌套 5 层后 4ms；后台 1000ms；被长任务阻塞
```
