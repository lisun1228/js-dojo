# JS · 05 Promise 与 async/await

> 本册覆盖：Promise 三种状态、`all` / `race`、`async/await` 原理、Generator、迭代器
> 题单的答案：题 7「同 ES6 文档第 10 题」（不存在）、题 8「Generator + 自动执行器的语法糖」（**已过时**）、题 17「同 ES6 文档第 8 题」（不存在）。
> **题 8 那句话在 2018 年之后就不准确了**——V8 7.x 起改用基于 CPS 的状态机，不再依赖 Generator。本册会讲清。

---

## 目录

- [5.1 一句话结论](#51-一句话结论)
- [5.2 Promise 三种状态](#52-promise-三种状态)
- [5.3 `then` 链的三个机制](#53-then-链的三个机制)
- [5.4 四个静态方法的差异](#54-四个静态方法的差异)
- [5.5 `async/await` 原理](#55-asyncawait-原理)
- [5.6 `async/await` 的六个陷阱](#56-asyncawait-的六个陷阱)
- [5.7 五道输出题](#57-五道输出题)
- [5.8 Generator 与迭代器](#58-generator-与迭代器)
- [5.9 常见坑](#59-常见坑)
- [5.10 答题模板](#510-答题模板)
- [5.11 速记卡](#511-速记卡)

---

## 5.1 一句话结论

**Promise 是一个「三态、单向、可链式」的状态机**：`pending` → `fulfilled` / `rejected`，**状态一旦改变就不可逆**。
**`async/await` 是「用同步写法表达异步」的语法**：`async` 函数总是返回 Promise，`await` 会挂起函数、把后续代码放进微任务，等 Promise settled 后恢复。

---

## 5.2 Promise 三种状态

### 5.2.1 状态机

```
                  ┌──────────────┐
                  │   pending    │  ← 初始状态，可以转移
                  └──┬────────┬──┘
        resolve()    │        │   reject()
                     ▼        ▼
        ┌────────────────┐  ┌────────────────┐
        │  fulfilled     │  │   rejected     │  ← 都是「已敲定 settled」
        │  (有 value)    │  │  (有 reason)   │     不能再变
        └────────────────┘  └────────────────┘
```

**两条铁律**：

| 规则 | 说明 |
|---|---|
| **状态不可逆** | 从 `pending` 敲定后，**再调 `resolve`/`reject` 都无效**（静默忽略） |
| **不可从 fulfilled 到 rejected** | 反之亦然 |

```js
const p = new Promise((resolve, reject) => {
  resolve('first');
  reject('second');       // ❌ 被忽略
  resolve('third');       // ❌ 被忽略
});
p.then(v => console.log(v));   // 'first'
```

### 5.2.2 `resolve` 一个 Promise 会怎样

```js
const inner = Promise.resolve(1);
const outer = new Promise(resolve => resolve(inner));

outer.then(v => console.log(v));    // 1，不是 inner 这个 Promise
```

**`resolve(thenable)` 会「吸收」它**——`outer` 的状态跟随 `inner`。这叫 **Promise Resolution Procedure**（规范 25.6.1.3.2）。

**这也解释了 `async` 函数的 `return Promise` 行为**：

```js
async function f() { return Promise.resolve(1); }
f().then(v => console.log(v));      // 1（不是 Promise）
```

### 5.2.3 `executor` 是同步执行的

```js
console.log('1');
new Promise((resolve) => {
  console.log('2');         // ← 同步！不是异步
  resolve();
});
console.log('3');

// 输出：1 2 3
```

**很多人以为 `new Promise` 的回调是异步的，这是错的**——`executor` **立即同步执行**，只有 `then` 的回调才异步。

### 5.2.4 `reject()` 不会中断执行

```js
new Promise((resolve, reject) => {
  reject('err');
  console.log('still runs');    // ← 会执行！
});
```

**`reject()` 只是改状态，不是 `throw`。** 要中断必须 `return` 或 `throw`。

---

## 5.3 `then` 链的三个机制

### 5.3.1 每次 `then` 都返回**新的** Promise

```js
const p1 = Promise.resolve(1);
const p2 = p1.then(v => v + 1);
const p3 = p1.then(v => v + 1);

p1 === p2;        // false   ← 每次 then 都是新 Promise
p2 === p3;        // false
```

**这是「为什么可以链式调用」的原因**，也是「为什么 `p1.then().then()` 和 `p1.then()` 是两条独立链」的原因。

### 5.3.2 值穿透

```js
Promise.resolve(1)
  .then(null)                    // ← 不是函数，被忽略
  .then(undefined)               // ← 同上
  .then(v => console.log(v));    // 1  ← 值一路穿过来
```

**如果 `then` 的参数不是函数，会被替换成「原样返回」的函数**：

```js
// 规范里等价于
.then(v => v)
```

**用途**：条件式地插入处理。

```js
promise
  .then(shouldLog ? v => { log(v); return v; } : null)   // 不需要时传 null，值穿透
  .then(handle);
```

### 5.3.3 错误穿透

```js
Promise.resolve(1)
  .then(v => { throw new Error('boom'); })
  .then(v => console.log('跳过'))       // ← 被跳过
  .then(v => console.log('也跳过'))     // ← 被跳过
  .catch(e => console.log('catch:', e.message))
  .then(v => console.log('恢复:', v));  // ← 恢复正常
```

**规则**：`then` 的 `onRejected` 没传时，rejection 会**一路往下传**，直到遇到 `catch`。

**`catch` 之后链会恢复**（变成 fulfilled），除非 `catch` 里又 `throw`。

**实测验证**：

```js
// 两条链的错误穿透速度不同（影响输出顺序）
Promise.resolve().then(() => { throw new Error('x'); })
  .then(() => console.log('跳过'))
  .catch(e => console.log('穿透到 catch:', e.message));   // 1 个 then 后到达

Promise.resolve(1).then(v => { throw new Error('boom'); })
  .then(v => console.log('不会被调用'))
  .catch(e => console.log('catch:', e.message));          // 2 个 then 后到达

// 实测输出：先「穿透到 catch: x」，后「catch: boom」
```

**这个差异会影响输出题的顺序**——`then` 链越长，到达 `catch` 越晚。

### 5.3.4 `finally` 的特点

```js
Promise.resolve(1)
  .finally(() => console.log('finally'))
  .then(v => console.log(v));      // 1  ← 值原样传递

Promise.reject(new Error('e'))
  .finally(() => console.log('finally'))
  .catch(e => console.log(e.message));   // 'e'  ← 错误也原样传递
```

**`finally` 的回调不接收参数，返回值也被忽略**（除非抛错或返回 rejected Promise）。

**用途**：清理工作（关 loading、清定时器）。

```js
showLoading();
fetchData()
  .then(render)
  .catch(showError)
  .finally(hideLoading);       // 成功失败都会执行
```

---

## 5.4 四个静态方法的差异

### 5.4.1 对比表（全部实测）

| 方法 | 什么时候 resolve | 什么时候 reject | 空数组行为 |
|---|---|---|---|
| **`all`** | **全部** fulfilled | **任意一个** rejected（立即） | `[]` ✅ |
| **`race`** | **第一个** settled（不看状态） | 同左 | **永久 pending** ⚠️ |
| **`allSettled`** | **全部** settled（不管成败） | **永不** reject | `[]` ✅ |
| **`any`** | **第一个** fulfilled | **全部** rejected → `AggregateError` | **立即 reject** ⚠️ |

**实测结果**：

```js
await Promise.all([])              // []
await Promise.allSettled([])       // []
await Promise.any([])              // ❌ AggregateError
await Promise.race([])             // ⚠️ 永久 pending（不会 resolve 也不会 reject）
```

**这四个空数组的差异非常容易考。**

### 5.4.2 `all`

```js
// 基本用法
const [user, orders] = await Promise.all([
  fetchUser(),
  fetchOrders(),
]);
```

**三个特性**：

| 特性 | 说明 |
|---|---|
| **顺序保证** | 结果数组的**顺序和输入一致**，不管谁先完成 |
| **快速失败** | 任何一个 reject，整体立即 reject（**其他 Promise 仍在跑，只是结果被丢弃**） |
| **接受非 Promise** | 内部会用 `Promise.resolve` 包一层，所以 `Promise.all([1, 2])` → `[1, 2]` |

**⚠️ 「快速失败」不代表其他 Promise 停了**：

```js
const p1 = fetch('/a');       // 5 秒
const p2 = fetch('/b');       // 立即失败
Promise.all([p1, p2]).catch(() => {});
// p1 仍然会跑完 5 秒，只是结果没人要了
```

**要真正取消**需要 `AbortController`。

### 5.4.3 `race`

```js
// 超时控制（最经典用法）
function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), ms)
  );
  return Promise.race([promise, timeout]);
}
```

**注意**：`race` 是「第一个 **settled**」，所以**第一个 reject 也会让整体 reject**。要和 `all` 区分。

### 5.4.4 `allSettled`

```js
const results = await Promise.allSettled([ok, bad]);
// [
//   { status: 'fulfilled', value: 1 },
//   { status: 'rejected', reason: Error('e') }
// ]
```

**用途**：批量操作，不关心单个失败。

```js
// 批量上传，失败的记录下来重试
const results = await Promise.allSettled(files.map(upload));
const failed = results.filter(r => r.status === 'rejected');
```

**它永不 reject**（除了实现 bug）。

### 5.4.5 `any`（ES2021）

```js
await Promise.any([bad, ok]);      // 1  ← 第一个成功的
await Promise.any([bad1, bad2]);   // ❌ AggregateError，errors: [err1, err2]

try {
  await Promise.any([bad1, bad2]);
} catch (e) {
  e.constructor.name;    // 'AggregateError'
  e.errors;              // [Error: x, Error: y]
}
```

**用途**：多镜像竞速（CDN 有多个源，取最快的成功的）。

**⚠️ 和 `race` 的关键区别**：`race` 是「第一个 settled」，`any` 是「第一个 **fulfilled**」。所以 `race([bad, ok])` 会 **reject**，而 `any([bad, ok])` 会 **resolve 成 ok**。

---

## 5.5 `async/await` 原理

### 5.5.1 题单的说法已经过时

> 原文：「Generator + 自动执行器的语法糖。」

**这句话在 2017 年是对的，但 2018 年之后就不准确了。**

| 时间 | 实现方式 |
|---|---|
| ES2017 刚出时 / Babel 编译产物 | **Generator + 自动执行器**（`_asyncToGenerator`） |
| **V8 7.x（2018）起** | **基于 CPS 的状态机**（`AsyncFunctionAwait` + 显式状态机） |

**V8 的官方说法**：从 V8 7.2 开始，`async` 函数不再用 Generator 实现，改用**更高效的 CPS（Continuation Passing Style）转换**，因为有三个问题：

| 旧实现的问题 | 说明 |
|---|---|
| **多两次 Promise 分配** | Generator 包装 + 手动 Promise 各一次 |
| **每次 await 都要 `next()`** | Generator 的 `next/throw` 有额外开销 |
| **无法省掉微任务** | 有些场景 V8 能优化掉一次微任务跳转 |

**性能提升**：V8 官方博客说 `async` 函数性能提升约 **2 倍**（对 Node 的 `async_hooks` 也有改善）。

**所以面试的标准答法要分两层**：

> 「**语义上**，`async/await` 可以理解为 Generator + 自动执行器——`await` 相当于 `yield`，自动执行器负责在 Promise settled 后调 `next()` 恢复。
> **但实现上**，现代 V8（7.x 起）已经不用 Generator 了，改成基于 CPS 的显式状态机，省掉了 Generator 的包装和 `next()` 开销，性能大约提升 2 倍。Babel 编译到 ES5 时输出的 `_asyncToGenerator` 还是 Generator 方案的模拟。」

### 5.5.2 用 Generator 手写一个「async 运行时」

**这是最能证明你懂原理的方式**：

```js
function run(generatorFn) {
  return new Promise((resolve, reject) => {
    const gen = generatorFn();

    function step(method, arg) {
      let result;
      try {
        result = gen[method](arg);
      } catch (e) {
        return reject(e);
      }

      if (result.done) return resolve(result.value);

      // 把 yield 出来的值包成 Promise，等它 settled 后继续
      Promise.resolve(result.value).then(
        (v) => step('next', v),
        (e) => step('throw', e)
      );
    }

    step('next');
  });
}

// 使用
function* fetchAll() {
  const user = yield fetch('/user').then(r => r.json());
  const orders = yield fetch(`/orders?u=${user.id}`).then(r => r.json());
  return { user, orders };
}

run(fetchAll).then(data => console.log(data));
```

**核心三行**：

```js
if (result.done) return resolve(result.value);         // 结束
Promise.resolve(result.value).then(                    // 等 yield 的值
  (v) => step('next', v),                             // 成功 → 恢复
  (e) => step('throw', e)                             // 失败 → 在 yield 处抛错
);
```

**`step('throw', e)` 是关键**——它让 `yield` 表达式「抛出异常」，从而能被 `try/catch` 捕获。这就是 `await` 的错误能进 `catch` 的机制。

### 5.5.3 三个必须知道的语义细节

**① `async` 函数总是返回 Promise**

```js
async function f() { return 1; }
f();                          // Promise { 1 }
typeof f().then;              // 'function'
```

**即使不写 `return`**：

```js
async function g() {}
g();                          // Promise { undefined }
```

**② `await` 会让出控制权（进微任务）**

```js
async function f() {
  console.log('1');
  await null;                 // ← 让出，后续进微任务
  console.log('2');
}
f();
console.log('3');
// 输出：1 3 2
```

**③ `await` 非 thenable 与 thenable 的差异**（详见 04 册 4.7 题 6）

- `await null` / `await 1` → 让出 **1 次**微任务
- `await Promise.resolve()` → 让出 **2 次**微任务

**原因**：thenable 要先等它自己的 `.then` 队列，然后才恢复外层。

---

## 5.6 `async/await` 的六个陷阱

### 陷阱 1：`return await` vs `return`（最隐蔽）

```js
// ✅ 有 await → catch 能抓到
async function withAwait() {
  try {
    return await Promise.reject(new Error('A'));
  } catch (e) {
    return 'caught: ' + e.message;
  }
}
await withAwait();             // 'caught: A'

// ❌ 没有 await → catch 抓不到！
async function withoutAwait() {
  try {
    return Promise.reject(new Error('B'));    // ← 直接返回一个 rejected Promise
  } catch (e) {
    return 'caught: ' + e.message;            // ← 永远不执行
  }
}
await withoutAwait();          // ❌ 抛错，且触发 unhandledRejection
```

**实测确认**：`withoutAwait()` 的 catch 分支**不执行**，而是产生 `unhandledRejection: B`。

**为什么**：`return Promise.reject(...)` 是「**返回**一个 rejected Promise」，不是「**抛出**异常」。`try/catch` 只捕获同步 throw 和 `await` 出来的 rejection。

**规范建议**：ESLint 的 `no-return-await` 规则曾经建议「不要 `return await`」，但**在 `try/catch` 里必须用 `return await`**。所以这条规则后来被改成 `no-return-await` 只对「不在 try 里」的情况警告。

### 陷阱 2：`forEach` + `async` 不会等待

```js
// ❌ 不会等
[1, 2, 3].forEach(async (n) => {
  await sleep(100);
  console.log(n);
});
console.log('done');       // ← 立即打印，不等上面

// ✅ 用 for...of
for (const n of [1, 2, 3]) {
  await sleep(100);
  console.log(n);
}

// ✅ 或 Promise.all（并发）
await Promise.all([1, 2, 3].map(async (n) => {
  await sleep(100);
  console.log(n);
}));
```

**实测**：`forEach + await` 在 1ms 内就返回了（没等 100ms）。

**`map` 为什么可以**：`map` **返回**回调的返回值（Promise），所以能收集起来 `Promise.all`。`forEach` **丢弃**返回值。

### 陷阱 3：串行 vs 并发

```js
// ❌ 串行：总耗时 = 50 + 50 = 100ms（实测 101ms）
await sleep(50); await sleep(50);

// ✅ 并发：总耗时 = 50ms（实测 52ms）
await Promise.all([sleep(50), sleep(50)]);
```

**更隐蔽的串行**：

```js
// ❌ 循环里串行
const results = [];
for (const id of ids) {
  results.push(await fetchItem(id));     // 一个一个等
}

// ✅ 并发
const results = await Promise.all(ids.map(id => fetchItem(id)));
```

**⚠️ 但并发不是越多越好**——1000 个并发请求会打爆浏览器（同域 6 连接）和服务端。要用并发池（见 11 册）。

### 陷阱 4：在 `async` 函数里 `new Promise` 的坑

```js
// ❌ 反模式：多余的 Promise 包装（这就是 Promise 构造器反模式）
async function bad() {
  return new Promise((resolve, reject) => {
    doSomethingAsync().then(resolve, reject);   // 多余的包装
  });
}

// ✅ 直接返回
async function good() {
  return doSomethingAsync();
}
```

### 陷阱 5：`await` 在循环里做条件判断

```js
// ❌ 每次迭代都要 await 一次，即使是同步判断
for (const item of items) {
  if (await isAllowed(item)) { ... }
}

// ✅ 先并发拿到所有判断结果
const allowed = await Promise.all(items.map(isAllowed));
items.filter((_, i) => allowed[i]).forEach(...);
```

### 陷阱 6：忘记处理 rejection

```js
// ❌ 无人处理的 rejection
async function fireAndForget() {
  await riskyOperation();      // 如果 reject，没人管
}
fireAndForget();               // 调用处没 catch

// ✅
fireAndForget().catch(handleError);

// 或
void (async () => {
  try { await riskyOperation(); } catch (e) { handleError(e); }
})();
```

**Node 15+ 起，未处理的 rejection 会让进程退出**（以前只是警告）。

---

## 5.7 五道输出题

### 题 1：`then` 链的基本顺序

```js
Promise.resolve(1)
  .then(v => { console.log('A', v); return v + 1; })
  .then(v => { console.log('B', v); throw new Error('x'); })
  .then(v => console.log('C', v))
  .catch(e => console.log('D', e.message))
  .then(v => console.log('E', v));
```

**答案**：`A 1` → `B 2` → `D x` → `E undefined`

**解析**：`C` 被跳过（错误穿透），`catch` 捕获后链恢复（返回 `undefined`），所以 `E undefined`。

### 题 2：两条链的竞争

```js
const p = Promise.resolve();

p.then(() => console.log(1)).then(() => console.log(2));
p.then(() => console.log(3)).then(() => console.log(4));
```

**答案**：`1` → `3` → `2` → `4`

**解析**：两条链独立。第一轮微任务执行 `1` 和 `3`，第二轮执行 `2` 和 `4`。

**（不是 `1 2 3 4`）**

### 题 3：`async` 与 `then` 混用

```js
async function a() {
  console.log('a1');
  await b();
  console.log('a2');
}
async function b() {
  console.log('b1');
}

a();
Promise.resolve().then(() => console.log('p1'));
console.log('sync');
```

**答案**：`a1` → `b1` → `sync` → `a2` → `p1`

**解析**：`a()` 同步跑到 `await b()`，`b()` 同步打印 `b1` 并返回，`await` 挂起 a 并把恢复排队。然后 `p1` 入队（在恢复 a 之后）。`sync` 打印。清微任务：先恢复 a（打印 a2），再 p1。

### 题 4：`Promise.all` 的快速失败

```js
const slow = new Promise(r => setTimeout(() => r('slow'), 100));
const fast = Promise.reject('fast-fail');

Promise.all([slow, fast])
  .then(v => console.log('then', v))
  .catch(e => console.log('catch', e));

console.log('sync');
```

**答案**：`sync` → `catch fast-fail`

**解析**：`fast` 立即 reject，`all` 立即 reject。`slow` 之后仍会 resolve，但结果被丢弃。

### 题 5：`await` 在循环里的累加

```js
async function sum() {
  let total = 0;
  for (const n of [1, 2, 3]) {
    total += await Promise.resolve(n);
  }
  return total;
}
sum().then(v => console.log(v));
console.log('sync');
```

**答案**：`sync` → `6`

**解析**：`for...of` 里每个 `await` 都会让出，但因为 `for...of` 是顺序的，最终还是 `1+2+3=6`。`sync` 先打印因为 `sum()` 在第一个 await 处就让出了。

---

## 5.8 Generator 与迭代器

### 5.8.1 Generator 是什么

```js
function* gen() {
  console.log('start');
  const a = yield 1;
  console.log('got', a);
  const b = yield 2;
  return a + b;
}

const g = gen();
g.next();        // 'start'，返回 { value: 1, done: false }
g.next(10);      // 'got 10'，返回 { value: 2, done: false }
g.next(20);      // 返回 { value: 30, done: true }
```

**三个特点**：

| 特点 | 说明 |
|---|---|
| **可暂停/恢复** | `yield` 处暂停，`next()` 恢复 |
| **双向通信** | `next(v)` 的值成为 `yield` 表达式的返回值 |
| **可抛错进去** | `g.throw(e)` 会在暂停处抛错（这就是 `await` 错误传递的机制） |

**Generator 也是可迭代的**：

```js
[...gen()]        // 用扩展运算符收集
for (const v of gen()) { }   // for...of 遍历
```

### 5.8.2 迭代器协议

**一个对象只要实现了 `[Symbol.iterator]` 方法（返回一个迭代器），就是「可迭代的」。**

**迭代器必须有 `next()`，返回 `{ value, done }`**：

```js
const iterable = {
  [Symbol.iterator]() {
    let i = 0;
    return {
      next() {
        return i < 3 ? { value: i++, done: false } : { value: undefined, done: true };
      },
      // ★ 可选：提前终止时的清理
      return() {
        console.log('cleanup');
        return { done: true };
      },
    };
  },
};
```

**「迭代器关闭」行为**（这个知识点很冷门但很值钱）：

```js
for (const v of iterable) {
  if (v === 1) break;        // ← break 会调用 return()！
}
// 输出：cleanup  ✅ 实测
```

**规则**：`for...of` 被 `break` / `return` / `throw` 中断时，**会调用迭代器的 `return()` 方法**做清理。

**用途**：释放资源（关闭文件、断开连接）。

**内置例子**：`generator.return()` 会让 generator 提前结束并执行 `finally` 块。

### 5.8.3 哪些东西是可迭代的

| 可迭代 | 不可迭代 |
|---|---|
| `Array`、`String`、`Map`、`Set` | **普通对象 `{}`**（❌） |
| `arguments`、`NodeList` | `WeakMap`、`WeakSet`（❌） |
| `TypedArray` | 数字、布尔 |
| Generator 对象 | — |

**所以 `for...of` 遍历对象会报错**：

```js
for (const v of { a: 1 }) { }    // TypeError: obj is not iterable
```

**要让对象可迭代**：

```js
const obj = {
  a: 1, b: 2,
  [Symbol.iterator]() {
    return Object.entries(this)[Symbol.iterator]();
  },
};
[...obj];      // [['a', 1], ['b', 2]]
```

---

## 5.9 常见坑

| 坑 | 正确说法 |
|---|---|
| 说「Promise 状态可以从 fulfilled 变 rejected」 | ❌ 不可逆，敲定后再调 `resolve`/`reject` 无效 |
| 说「`new Promise` 的回调是异步的」 | **同步执行**，只有 `then` 回调异步 |
| 说「`reject()` 会中断执行」 | 不会，只是改状态 |
| 说「`async` 是 Generator 的语法糖」 | 语义上像；但 **V8 7.x 起已改成 CPS 状态机** |
| 说「`all` 会等所有 Promise 结束」 | 是「快速失败」，第一个 reject 就返回，**其他 Promise 仍在跑** |
| 说「`race` 和 `any` 一样」 | `race` 第一个 **settled**；`any` 第一个 **fulfilled** |
| 说「`race([])` 返回空数组」 | **永久 pending** |
| 说「`any([])` 返回空数组」 | **立即 reject** `AggregateError` |
| 说「`forEach` + `async` 会等待」 | ❌ 不会，`forEach` 丢弃返回值 |
| 说「`return await` 是多余的」 | 在 `try/catch` 里**必须**，否则 catch 抓不到 |
| 说「`Promise.all` 串行执行」 | 并发执行，只是结果按输入顺序排列 |
| 说「`for...of` 遍历对象」 | ❌ 普通对象不可迭代，要 `Object.entries` |

---

## 5.10 答题模板

### 30 秒版（Promise 三种状态）

> `pending`、`fulfilled`、`rejected`。两条铁律：**状态不可逆**，一旦敲定再调 `resolve`/`reject` 都无效；**只能从 pending 转移**，不能从 fulfilled 到 rejected。
> 补充两点容易错的：`new Promise` 的 executor 是**同步执行**的，只有 `then` 的回调才异步；`resolve` 一个 Promise 会「吸收」它的状态，这也是 `async` 函数 `return Promise` 时不嵌套的原因。

### 30 秒版（async/await 原理）

> **语义上**可以理解为 Generator + 自动执行器：`await` 相当于 `yield`，自动执行器在 Promise settled 后调 `next()` 恢复。
> **但实现上**，现代 V8（7.x 起）已经不用 Generator 了，改成基于 CPS 的显式状态机，省掉 Generator 的包装和 `next()` 开销，性能大约提升 2 倍。Babel 编译到 ES5 时输出的 `_asyncToGenerator` 还是 Generator 方案的模拟。
> `async` 函数总是返回 Promise，`await` 会让出控制权把后续代码放进微任务。

### 2 分钟版（四个静态方法）

> 我按「什么时候 resolve、什么时候 reject、空数组怎么办」三个维度对比。
>
> **`all`**：全部 fulfilled 才 resolve，任意一个 rejected 就**立即** reject（快速失败）；空数组返回 `[]`。注意「快速失败」不代表其他 Promise 停了，它们还在跑，只是结果被丢弃；要真正取消得用 `AbortController`。另外结果顺序和输入一致，不管谁先完成。
>
> **`race`**：第一个 **settled**（不管成功失败）就跟着它走；**空数组会永久 pending**，既不 resolve 也不 reject。最经典的用法是超时控制。
>
> **`allSettled`**：全部 settled 才 resolve，**永不 reject**；结果是 `{status, value/reason}` 的数组；空数组返回 `[]`。适合批量操作，比如批量上传后筛选失败的。
>
> **`any`**：第一个 **fulfilled** 就 resolve，**全部失败**才 reject 一个 `AggregateError`（errors 属性里有所有错误）；**空数组立即 reject**。适合多镜像竞速。
>
> 最容易混的是 `race` 和 `any`：`race([bad, ok])` 会 reject（bad 先 settled），但 `any([bad, ok])` 会 resolve 成 ok。四个方法的空数组行为也常考：`all`/`allSettled` 返回 `[]`，`any` 立即 reject，`race` 永久 pending。

### 追问表

| 追问 | 回答要点 |
|---|---|
| Promise 三种状态 | pending / fulfilled / rejected，不可逆 |
| executor 同步还是异步 | **同步** |
| `resolve` 一个 Promise 会怎样 | 吸收它的状态（Promise Resolution Procedure） |
| `then` 返回什么 | **新的** Promise |
| 值穿透是什么 | `then(null)` 等价于 `then(v => v)` |
| 错误穿透是什么 | 没传 `onRejected` 时 rejection 一路往下传 |
| `finally` 会改变结果吗 | 不会（除非抛错） |
| `all` 是快速失败吗 | 是，但其他 Promise 仍在跑 |
| `race` 和 `any` 区别 | 第一个 settled vs 第一个 fulfilled |
| `race([])` 会怎样 | 永久 pending |
| `any([])` 会怎样 | 立即 reject `AggregateError` |
| `allSettled` 会 reject 吗 | 永不 |
| `async` 是 Generator 糖吗 | 语义像；V8 7.x 起是 CPS 状态机 |
| `await` 让出几次微任务 | 非 thenable 1 次，thenable 2 次 |
| `return await` 有必要吗 | 在 `try/catch` 里必须 |
| `forEach` 能配合 async 吗 | 不能，用 `for...of` 或 `map + all` |
| `for...of` 被 break 会怎样 | 调用迭代器的 `return()` 做清理 |
| 普通对象可迭代吗 | 不可，要 `Object.entries` |

---

## 5.11 速记卡

```
Promise 三态
  pending → fulfilled / rejected，★不可逆
  executor 同步执行；then 回调异步
  resolve(promise) 会「吸收」状态
  reject() 不中断执行（不是 throw）

then 链三机制
  每次 then 返回新 Promise（所以能链式）
  值穿透：then(null) = then(v => v)
  错误穿透：没 onRejected 就往下传，catch 后恢复
  ★ 链越长，到 catch 越晚（影响输出顺序）
  finally 不改变结果

四个静态方法
           resolve 条件        reject 条件        空数组
  all      全部 fulfilled      任一 rejected       []
  race     第一个 settled      第一个 settled      永久 pending
  allSettled 全部 settled      永不               []
  any      第一个 fulfilled    全部 rejected      立即 reject AggregateError
  ★ all 快速失败但其他 Promise 仍在跑
  ★ race ≠ any（settled vs fulfilled）

async/await 原理
  语义：Generator + 自动执行器（await ≈ yield）
  实现：V8 7.x 起是 CPS 状态机，不再用 Generator（性能提升约 2 倍）
  Babel 的 _asyncToGenerator 仍是 Generator 模拟
  async 总是返回 Promise；return Promise 会被吸收
  await 非 thenable 让出 1 次微任务 / thenable 2 次

六个陷阱
  ★ return Promise.reject() 不 await → catch 抓不到
  ★ forEach + async 不等待（用 for...of 或 map+all）
  串行 vs 并发（101ms vs 52ms 实测）
  async 里 new Promise 包一层是反模式
  循环里 await 条件判断
  忘记 catch → Node 15+ 进程退出

Generator / 迭代器
  可暂停恢复 / next(v) 双向通信 / throw(e) 注入错误
  可迭代 = 有 [Symbol.iterator]
  ★ for...of 被 break 会调 return() 清理
  普通对象不可迭代
```
