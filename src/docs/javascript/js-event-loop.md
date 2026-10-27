# JS · 04 事件循环

> 覆盖：事件循环、Promise 执行顺序、async/await 顺序
> 结论：一轮循环 = 取 1 个 task → 清空 microtask 队列 → 可能渲染
> 术语：规范里只有 task / microtask（Job），「宏任务」是社区词；示例均为 Node 22 实跑输出。

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

**JS 单线程，靠事件循环调度：每一轮取一个 task 执行完 → 清空 microtask 队列（直到为空）→ 浏览器可能在这里渲染 → 下一轮。**
**microtask 包括执行过程中新产生的，必须清到队空。**

⚠️ 规范里只有 **task** 和 **microtask**（正式名 **Job**）；**「宏任务」是社区造的词**，面试时说 task / microtask 更准确。

---

## 4.2 为什么需要事件循环

JS 单线程（一个调用栈），但浏览器要同时处理点击、请求、定时器、渲染。若同步等待，这段时间页面完全卡死：

```
用户点击 → 发请求 → 等 3 秒（阻塞） → 渲染
               ↑ 这 3 秒里点什么都没反应
```

事件循环把「等待」变成「注册回调 + 继续做别的事」，结果到了再执行回调：

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
| **`MessageChannel`** | 跨线程通信（部分调度库用它排异步任务） |
| **`postMessage`** | 跨窗口通信 |
| **DOM 事件回调** | 点击、滚动、输入 |
| **`<script>` 执行** | 整个脚本本身就是一个 task |
| **`XHR` 的 `load` / `readystatechange` 回调** | `fetch` 的 `.then` 属于 microtask |
| **`requestAnimationFrame`** | ⚠️ **特殊**：不属于 task 队列，在渲染前执行（见 4.4） |

### 4.3.2 microtask 队列（社区叫「微任务」）

| 来源 | 说明 |
|---|---|
| **`Promise.then/catch/finally`** | 最常用 |
| **`queueMicrotask(fn)`** | 显式入队（ES2020） |
| **`MutationObserver`** | DOM 变化监听 |
| **`await` 后面的代码** | 本质是 Promise 的 then |
| **`process.nextTick`** | ⚠️ **只有 Node 有**；不在 microtask 队列，而是独立队列，每轮先清它再清 Promise |

### 4.3.3 一个关键差异

```js
setTimeout(fn, 0);          // 浏览器：嵌套 5 层后最小 4ms
setImmediate(fn);           // 浏览器：不存在（只有 Node 有）
requestAnimationFrame(fn);  // 浏览器：渲染前
queueMicrotask(fn);         // 浏览器 / Node 都有
```

**`setTimeout(fn, 0)` 在浏览器里不是真的 0ms**：
- 规范规定**嵌套超过 5 层后，最小延迟 4ms**
- 页面在后台时会被进一步降频（Chrome 常见到 1s 量级）

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

```
初始队列：[m1, m3]
执行 m1 → 打印 m1，把 m2 加到队尾 → [m3, m2]
执行 m3 → 打印 m3 → [m2]
执行 m2 → 打印 m2 → 队空
```

**结论：微任务是「FIFO + 直到队空」，不是「执行完当前快照」。**

**⚠️ 边界**：微任务里**无限产生**微任务会**永久卡死**（渲染永远不发生）。

```js
function loop() {
  Promise.resolve().then(loop);    // 💥 页面卡死
}
loop();
```

这也是「不能用微任务做轮询」的原因。

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

**实测**（Node 22.12，连续 8 次一致）：

```js
Promise.resolve().then(() => console.log('1 Promise'));
process.nextTick(() => console.log('2 nextTick'));
setImmediate(() => console.log('3 setImmediate'));
setTimeout(() => console.log('4 setTimeout 0'), 0);

// 实测输出：
// 2 nextTick
// 1 Promise
// 4 setTimeout 0
// 3 setImmediate
```

**但注意**：`setImmediate` 和 `setTimeout(0)` 的先后**在主模块里是不确定的**（Node 官方文档明确说了），取决于进程启动耗时与定时器到期时机；本机多次实测是 `setTimeout(0)` 先，但不能当定论。**只有在 I/O 回调里，`setImmediate` 才一定先于 `setTimeout`**：

```js
fs.readFile(__filename, () => {
  setTimeout(() => console.log('timeout'), 0);
  setImmediate(() => console.log('immediate'));
  // 这里 immediate 一定先（因为 readFile 回调在 poll 阶段，下一个是 check 阶段）
});
```

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

**为什么 `setTimeout from timer` 排最后**：timer 回调在 timers 阶段执行，同轮接着走 poll → check，所以 `setImmediate` 先；新注册的 `setTimeout(0)` 要等**下一轮**的 timers 阶段。

---

## 4.7 十道输出题（题单 101~323 被折叠的部分）

> 示例均为 Node 22 实跑输出。

### 题 1：最基础

```js
console.log('1');
setTimeout(() => console.log('2'), 0);
Promise.resolve().then(() => console.log('3'));
console.log('4');
```

**答案**：`1` → `4` → `3` → `2`

**解析**：同步代码先执行（1、4），然后清微任务（3），最后取下一个 task（2）。

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

同 4.5 的代码。**答案**：`m1` → `m3` → `m2`：微任务一直清到队空，`m2` 排在 `m3` 后面。

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
| 5 | `await` 的操作数是 `async2()` 返回的已 fulfilled Promise，**挂起 async1**，把「恢复 async1」加入微任务 | — | `[resume-async1]` |
| 6 | `new Promise` 的 executor **同步执行** → 打印 `promise1`，`resolve()` | `promise1` | `[resume-async1]` |
| 7 | `.then` 注册回调（因为已 resolve，回调入队） | — | `[resume-async1, promise2]` |
| 8 | 打印 `script end` | `script end` | 同上 |
| 9 | 同步结束，清微任务：执行 resume-async1 → 打印 `async1 end` | `async1 end` | `[promise2]` |
| 10 | 执行 promise2 → 打印 `promise2` | `promise2` | `[]` |
| 11 | 下一轮宏任务：`setTimeout` | `setTimeout` | — |

**关键点：`new Promise(executor)` 的 executor 是同步执行的**，所以 `promise1` 在 `script end` 之前打印。

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

**解析**：`await null` 只让出 1 次微任务，且它在 `then1`/`then2` 注册之前入队，所以先执行。

**⚠️ 注意**：`await` 一个**已 fulfilled 的原生 Promise** 同样是 1 次微任务；而**自定义 thenable** 要先展开，会多出若干轮（见下题）。

---

### 题 6：`await` 非 thenable vs thenable（细节题）

```js
async function f() {
  console.log('A');
  await null;                  // 非 thenable
  console.log('B');
  await Promise.resolve();     // 原生 Promise
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
| 打印 D；入队 P1、P2 | `[resume-B, P1, P2]` |
| resume-B：打印 B，`await Promise.resolve()` 入队 resume-C（1 层） | `[P1, P2, resume-C]` |
| P1 → P2 → resume-C：依次打印 P1、P2、C | `[]` |

**结论**：
- `await` 普通值、`await` 已 fulfilled 的原生 Promise，都只让出 **1 次**微任务（V8 的 await 优化）。
- `await` **自定义 thenable** 需要先展开，实测恢复时机比原生 Promise 更晚；「await thenable 一律 2 次」的说法不成立。
- 本题 C 排在 P1/P2 之后，是 resume-C 入队时前面已有 P1、P2，不是它多让出了一轮。

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

**解析**：`then` 的回调返回 Promise 时，外层要先等待这个 Promise 展开，**多出 2 个微任务**；返回普通值则直接 resolve。

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

**答案**（实测）：**≥ 50ms**（本机 50ms，不是 0）

**解析**：`setTimeout(0)` 只是「尽快排进队列」，但**必须等当前同步代码执行完**。同步阻塞了 50ms，所以回调至少延迟 50ms；Node 里还会被钳到最小 1ms。

**这解释了「为什么 `setTimeout(fn, 0)` 不能保证立即执行」，也解释了「长任务会阻塞渲染和交互」。**

---

## 4.8 常见坑

| 坑 | 正确说法 |
|---|---|
| 说「宏任务/微任务是规范术语」 | 规范里是 **task / microtask（Job）**，「宏任务」是社区词 |
| 说「每轮把宏任务队列全部执行完」 | ❌ **只取一个** task |
| 说「微任务执行完当前快照就停」 | ❌ 一直执行到队列为空，**包括新产生的** |
| 说「`await` 后面的代码是宏任务」 | 是**微任务** |
| 说「`await thenable` 一定让出 2 次微任务」 | 已 fulfilled 的原生 Promise 只让出 1 次；自定义 thenable 需展开，多出若干轮 |
| 说「`new Promise` 的 executor 是异步的」 | **同步执行** |
| 说「`reject()` 会中断执行」 | ❌ 不会，只是改状态；要中断得 `return`/`throw` |
| 说「`setImmediate` 一定先于 `setTimeout(0)`」 | 主模块里**不确定**，只有 I/O 回调里确定 |
| 说「`setTimeout(0)` 就是 0ms」 | 浏览器嵌套 5 层后 4ms；后台降频；Node 最小 1ms；且被同步代码阻塞 |
| 说「`requestAnimationFrame` 是宏任务」 | 它**不在 task 队列**，在渲染前执行 |
| 说「Node 和浏览器事件循环一样」 | Node 有六阶段，还多一个 `nextTick` 队列（优先级最高） |
| 用微任务做轮询 | 会饿死渲染（微任务无限产生 → 页面卡死） |

---

## 4.9 答题模板

### 30 秒版

- 单线程 + 事件循环：取 **1 个** task → 清空 microtask（直到队空）→ 浏览器可能渲染 → 下一轮。
- task 来源：`setTimeout`、DOM 事件、XHR 回调、`<script>` 本身；microtask 来源：`Promise.then`、`queueMicrotask`、`MutationObserver`、`await` 后面的代码。
- 微任务不是「执行完当前快照」，而是**一直执行到队空**，包括执行过程中新产生的。

### 2 分钟版

- **浏览器**：循环同上；规范里只有 task / microtask，`requestAnimationFrame` 不在 task 队列，在渲染前执行；微任务无限产生会饿死渲染。
- **Node**：六阶段 timers → pending callbacks → idle/prepare → poll → check → close；阶段之间先清 `nextTick` 队列再清 microtask，`nextTick` 优先于 Promise。
- **输出题四步**：标出全部同步代码（`new Promise` 的 executor 同步）→ `await` 后面的代码当成 `then` 回调 → 按入队顺序排微任务 → 记住 `then` 返回 Promise 会多出 2 个微任务。
- **易错**：`reject()` 不中断 executor；主模块里 `setImmediate` 与 `setTimeout(0)` 顺序不定；`setTimeout(0)` 只保证「不早于」。

---

## 4.10 速记卡

```
术语
  task（宏任务，社区词）/ microtask（Job，微任务）
  一轮 = 取 1 个 task → 清空 microtask → 可能渲染

task 来源
  setTimeout / setInterval / DOM 事件 / XHR 回调 / script 本身
  ★ setImmediate 只有 Node；requestAnimationFrame 不在 task 队列

microtask 来源
  Promise.then/catch/finally / queueMicrotask / MutationObserver / await 后面
  ★ process.nextTick 只有 Node，是独立队列，先于 Promise 清空

★ 微任务清到空（包括新产生的）
  m1 → m3 → m2（不是 m1 → m2 → m3）
  无限产生会卡死渲染

输出题四步法
  ① 标同步代码（new Promise 的 executor 也同步！）
  ② await 后面 = then 回调
  ③ 按入队顺序排微任务
  ④ await 普通值 / 原生 Promise 都只让出 1 次；自定义 thenable 更久
     then 返回 Promise 比返回普通值多 2 个微任务

Node 六阶段
  timers → pending → idle/prepare → poll → check(setImmediate) → close
  每阶段之间先清 nextTick 再清 microtask
  实测：nextTick > Promise > setTimeout(0) / setImmediate（主模块后两者不定）

setTimeout 不保证准时
  只保证「不早于」；浏览器嵌套 5 层后 4ms、后台降频；Node 最小 1ms；被长任务阻塞
```
