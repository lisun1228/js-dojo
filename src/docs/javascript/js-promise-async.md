# JS · 05 Promise 与 async/await

> 覆盖：Promise 三种状态、`then` 链、四个静态方法、`async/await` 原理、Generator 与迭代器

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

状态从 `pending` 敲定后不可逆，再调 `resolve`/`reject` 会被静默忽略；`fulfilled` 与 `rejected` 之间也不能互转。

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
outer === inner;                    // false，外层仍是新 Promise
```

`resolve(thenable)` 会「吸收」它的状态——`outer` 跟随 `inner`。这就是规范中的 **Promise Resolution Procedure**，也解释了 `async` 函数 `return Promise` 不会产生嵌套：

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

`new Promise` 的回调**立即同步执行**，只有 `then` 的回调才是异步的。

### 5.2.4 `reject()` 不会中断执行

```js
new Promise((resolve, reject) => {
  reject('err');
  console.log('still runs');    // ← 会执行！
});
```

`reject()` 只是改状态，不是 `throw`。要中断必须 `return` 或 `throw`。

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

这是能链式调用的原因，也是 `p1.then().then()` 与 `p1.then()` 成为两条独立链的原因。

### 5.3.2 值穿透

```js
Promise.resolve(1)
  .then(null)                    // ← 不是函数，被忽略
  .then(undefined)               // ← 同上
  .then(v => console.log(v));    // 1  ← 值一路穿过来
```

`then` 的 `onFulfilled` 不是函数时，等价于 `v => v`。

### 5.3.3 错误穿透

```js
Promise.resolve(1)
  .then(v => { throw new Error('boom'); })
  .then(v => console.log('跳过'))       // ← 被跳过
  .then(v => console.log('也跳过'))     // ← 被跳过
  .catch(e => console.log('catch:', e.message))
  .then(v => console.log('恢复:', v));  // 恢复: undefined
```

规则：`then` 的 `onRejected` 没传时，rejection 会**一路往下传**，直到遇到 `catch`；`catch` 之后链恢复为 fulfilled，除非 `catch` 里又 `throw`。链上每多一个 `then`，rejection 到达 `catch` 就晚一个微任务；等长的链按注册顺序执行（实测）：

```js
Promise.resolve().then(() => { throw new Error('x'); })
  .then(() => {})
  .catch(e => console.log('catch1:', e.message));

Promise.resolve(1).then(() => { throw new Error('boom'); })
  .then(() => {})
  .catch(e => console.log('catch2:', e.message));

// 实测：catch1: x → catch2: boom
```

### 5.3.4 `finally` 的特点

```js
Promise.resolve(1)
  .finally(() => console.log('finally'))
  .then(v => console.log(v));      // 1  ← 值原样传递

Promise.reject(new Error('e'))
  .finally(() => console.log('finally'))
  .catch(e => console.log(e.message));   // 'e'  ← 错误也原样传递
```

回调不接收参数，返回值也被忽略；但回调抛错或返回 rejected Promise 时会覆盖原结果。

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

空数组这一列区分度最高：`all`/`allSettled` 返回 `[]`，`any` 立即 reject，`race` 永久 pending。

### 5.4.2 `all`

```js
const [user, orders] = await Promise.all([
  fetchUser(),
  fetchOrders(),
]);
```

| 特性 | 说明 |
|---|---|
| **顺序保证** | 结果数组的**顺序和输入一致**，不管谁先完成 |
| **快速失败** | 任何一个 reject，整体立即 reject（**其他 Promise 仍在跑，只是结果被丢弃**） |
| **接受非 Promise** | 内部用 `Promise.resolve` 包一层，`Promise.all([1, 2])` → `[1, 2]` |

要真正取消需要 `AbortController`。

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

`race` 跟随第一个 **settled** 的结果，所以第一个 reject 也会让整体 reject。

### 5.4.4 `allSettled`

```js
const results = await Promise.allSettled([ok, bad]);
// [
//   { status: 'fulfilled', value: 1 },
//   { status: 'rejected', reason: Error('e') }
// ]
```

批量操作不关心单个失败时用它；它永不 reject（规范路径）。

```js
// 批量上传，失败的记录下来重试
const results = await Promise.allSettled(files.map(upload));
const failed = results.filter(r => r.status === 'rejected');
```

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

多镜像竞速（CDN 多个源，取最快成功的）。

和 `race` 的关键区别：`race` 看第一个 **settled**，`any` 看第一个 **fulfilled**。实测 `race([bad, ok])` → reject `bad`，`any([bad, ok])` → resolve `ok`。

---

## 5.5 `async/await` 原理

### 5.5.1 语义等价与实现差异

语义上，`async/await` 等价于 Generator + 自动执行器：`await` ≈ `yield`，执行器在 Promise settled 后调 `next()` 恢复。Babel 转 ES5 的 `_asyncToGenerator` 仍是这套 Generator 模拟。

实现上，V8 7.2 起改用**基于 CPS 的显式状态机**，不再依赖 Generator，移除了 `await` 上两次额外微任务和一次临时 Promise 分配：

| 旧实现的问题 | 说明 |
|---|---|
| **多两次 Promise 分配** | Generator 包装 + 手动 Promise 各一次 |
| **每次 await 都要 `next()`** | Generator 的 `next/throw` 有额外开销 |
| **多出微任务跳转** | V8 7.2 移除了两次额外微任务 |

### 5.5.2 用 Generator 手写一个「async 运行时」

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

function* fetchAll() {
  const user = yield fetch('/user').then(r => r.json());
  return { user };
}
run(fetchAll).then(data => console.log(data));
```

`step('throw', e)` 让 `yield` 表达式抛出异常，从而能被 Generator 内的 `try/catch` 捕获——这就是 `await` 的错误能进 `catch` 的机制。

### 5.5.3 三个必须知道的语义细节

**① `async` 函数总是返回 Promise**

```js
async function f() { return 1; }
f();                          // Promise { 1 }
typeof f().then;              // 'function'

async function g() {}         // 即使不写 return
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

**③ `await` 非 thenable 与 thenable 的差异**

- `await null` / `await 1` → 让出 **1 次**微任务
- `await Promise.resolve()` → 现代 V8（Node 12+）也只让出 **1 次**，V8 7.2 优化掉了旧版多出的那一层
- `await` 非 Promise 的 thenable → **2 次**：先执行 `PromiseResolveThenableJob`，再恢复外层

实测（Node 22）：普通值与原生 Promise 是 `start → resume → t1`，自定义 thenable 是 `start → t1 → resume`。

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
// 实测：'caught: A'

// ❌ 没有 await → catch 抓不到
async function withoutAwait() {
  try {
    return Promise.reject(new Error('B'));    // ← 直接返回一个 rejected Promise
  } catch (e) {
    return 'caught: ' + e.message;            // ← 永远不执行
  }
}
// 实测：await withoutAwait() 抛出 B；只有返回的 Promise 无人处理时才会 unhandledRejection
```

`return Promise.reject(...)` 是「**返回**一个 rejected Promise」，不是「**抛出**异常」。`try/catch` 只捕获同步 throw 和 `await` 出来的 rejection。

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

实测 `forEach` 版本在 0ms 就打印 `done`，三个数字约 100ms 后才出现。`map` 能配合 `all`，是因为 `map` **返回**回调的 Promise，而 `forEach` **丢弃**返回值。

### 陷阱 3：串行 vs 并发

```js
// ❌ 串行：总耗时 = 50 + 50
await sleep(50); await sleep(50);

// ✅ 并发：总耗时 ≈ 50ms
await Promise.all([sleep(50), sleep(50)]);
```

实测 Node 22 分别约 102ms 与 51ms。并发不是越多越好：1000 个并发请求会打爆浏览器（同域 6 连接）和服务端，需要并发池（见 11 册）。

### 陷阱 4：在 `async` 函数里 `new Promise` 的坑

```js
// ❌ 反模式：多余的 Promise 包装
async function bad() {
  return new Promise((resolve, reject) => {
    doSomethingAsync().then(resolve, reject);
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

Node 15+ 起，未处理的 rejection 会让进程退出（Node 22 实测退出码 1；以前只是警告）。

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

**解析**：`C` 被错误穿透跳过；`catch` 捕获后返回 `undefined`，所以 `E undefined`。

### 题 2：两条链的竞争

```js
const p = Promise.resolve();

p.then(() => console.log(1)).then(() => console.log(2));
p.then(() => console.log(3)).then(() => console.log(4));
```

**答案**：`1` → `3` → `2` → `4`

**解析**：两条链独立。第一轮微任务执行 `1` 和 `3`，第二轮执行 `2` 和 `4`（不是 `1 2 3 4`）。

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

**解析**：`a()` 同步跑到 `await b()`；`b()` 打印 `b1` 并返回已 fulfilled 的 Promise；`await` 先排队 a 的恢复任务，`p1` 的任务排在其后，随后打印 `sync`。清微任务时先恢复 a（`a2`），再执行 `p1`。

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

**解析**：`fast` 立即 reject，`all` 立即失败；`slow` 之后仍会 resolve，但结果被丢弃。

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

**解析**：`sum()` 在第一个 `await` 处让出，`sync` 先打印；`for...of` 顺序累加得 `6`。

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

| 特点 | 说明 |
|---|---|
| **可暂停/恢复** | `yield` 处暂停，`next()` 恢复 |
| **双向通信** | `next(v)` 的值成为 `yield` 表达式的返回值 |
| **可抛错进去** | `g.throw(e)` 会在暂停处抛错（`await` 错误传递的基础） |

Generator 也是可迭代的：`[...gen()]` 可收集，`for (const v of gen())` 可遍历。

### 5.8.2 迭代器协议

对象只要实现了 `[Symbol.iterator]` 方法（返回一个迭代器），就是「可迭代的」。迭代器必须有 `next()`，返回 `{ value, done }`：

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

「迭代器关闭」行为：

```js
for (const v of iterable) {
  if (v === 1) break;        // ← break 会调用 return()
}
// 实测输出：cleanup
```

规则：`for...of` 被 `break` / `return` / `throw` 中断时，会调用迭代器的 `return()` 做清理，用于释放文件、连接等资源。`generator.return()` 同样会提前结束并执行 `finally` 块。

### 5.8.3 哪些东西是可迭代的

| 可迭代 | 不可迭代 |
|---|---|
| `Array`、`String`、`Map`、`Set` | 普通对象 `{}`（❌） |
| `arguments`、`NodeList` | `WeakMap`、`WeakSet`（❌） |
| `TypedArray` | 数字、布尔 |
| Generator 对象 | — |

```js
const plain = { a: 1 };
for (const v of plain) { }    // TypeError: plain is not iterable
```

要让对象可迭代，显式实现 `[Symbol.iterator]`：

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

| 错误说法 | 正确结论 |
|---|---|
| 「fulfilled 可以变 rejected」 | 不可逆，敲定后再调 `resolve`/`reject` 静默无效 |
| 「`new Promise` 的回调是异步的」 | **同步执行**，只有 `then` 回调异步 |
| 「`reject()` 会中断执行」 | 只是改状态，不是 `throw` |
| 「`all` 会等所有 Promise 结束」 | 第一个 reject 就返回，其他 Promise 仍在跑 |
| 「`race` 和 `any` 一样」 | `race` 看第一个 settled，`any` 看第一个 fulfilled |
| 「`forEach` + `async` 会等待」 | 不会，`forEach` 丢弃返回值 |

---

## 5.10 答题模板

### 30 秒版（Promise 三种状态）

- `pending` → `fulfilled` / `rejected`，敲定后不可逆，再调 `resolve`/`reject` 都无效。
- `executor` 同步执行，只有 `then` 回调异步。
- `resolve(promise)` 会吸收其状态；`reject()` 只是改状态，不中断执行。

### 30 秒版（async/await 原理）

- 语义上：Generator + 自动执行器，`await` ≈ `yield`。
- 实现上：V8 7.2 起是 CPS 状态机，不再依赖 Generator。
- `async` 总是返回 Promise；`await` 让出控制权，后续代码进微任务。

### 2 分钟版（四个静态方法）

- `all`：全部 fulfilled 才 resolve，任一 rejected 立即 reject；空数组 `[]`；结果按输入顺序。
- `race`：第一个 settled 就跟随（失败也算）；空数组永久 pending。
- `allSettled`：全部 settled 才 resolve，永不 reject；空数组 `[]`。
- `any`：第一个 fulfilled 就 resolve，全部失败 reject `AggregateError`；空数组立即 reject。
- `race([bad, ok])` 会 reject，`any([bad, ok])` 会 resolve 成 `ok`。

---

## 5.11 速记卡

```
Promise 三态
  pending → fulfilled / rejected，★不可逆
  executor 同步执行；then 回调异步
  resolve(promise) 吸收状态；reject() 不中断执行

then 链
  每次 then 返回新 Promise
  值穿透：then(null) ≡ then(v => v)
  错误穿透：没 onRejected 就下传，catch 后恢复
  finally 不改变结果；回调抛错会覆盖原结果

四个静态方法
  方法        resolve 条件        reject 条件         空数组
  all         全部 fulfilled      任一 rejected        []
  race        第一个 settled      第一个 settled       永久 pending
  allSettled  全部 settled        永不                []
  any         第一个 fulfilled    全部 rejected        立即 reject AggregateError
  ★ all 快速失败后其他 Promise 仍在跑
  ★ race ≠ any（settled vs fulfilled）

async/await 原理
  语义：Generator + 自动执行器（await ≈ yield）
  实现：V8 7.2 起 CPS 状态机，移除两次额外微任务
  Babel 的 _asyncToGenerator 仍是 Generator 模拟
  async 总返回 Promise；return Promise 会被吸收
  await：普通值 / 原生 Promise 1 次微任务，thenable 2 次

六个陷阱
  ★ return Promise.reject() 不 await → catch 抓不到
  ★ forEach + async 不等待（用 for...of 或 map+all）
  串行 vs 并发（实测 102ms vs 51ms）
  async 里 new Promise 包一层是反模式
  循环里 await 条件判断
  忘记 catch → Node 15+ 进程退出

Generator / 迭代器
  可暂停恢复 / next(v) 双向通信 / throw(e) 注入错误
  可迭代 = 有 [Symbol.iterator]
  ★ for...of 被 break 会调 return() 清理
  普通对象不可迭代
```
