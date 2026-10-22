# 分册 04 · 异步：Promise、async/await 与事件循环

> 覆盖题号：**10**（Promise 状态与回调地狱）、**8**（`all` 与 `race`）、**26**（并发 vs 串行）、**11**（async/await 做什么）、**12**（await 做了什么）、**21**（事件循环）
> 共 **6 题**，是前端面试**出题密度最高**的一册。不仅要会答，还要能手写、能算输出顺序。

---

## 目录

- [4.1 Promise 的三种状态与回调地狱](#41-promise-的三种状态与回调地狱)
- [4.2 then 的四个行为规则（必考）](#42-then-的四个行为规则必考)
- [4.3 all / race / allSettled / any](#43-all--race--allsettled--any)
- [4.4 并发与串行：性能差异与并发控制](#44-并发与串行性能差异与并发控制)
- [4.5 async 与 await 做了什么](#45-async-与-await-做了什么)
- [4.6 事件循环](#46-事件循环)
- [4.7 输出顺序题实战（背这 5 道就够）](#47-输出顺序题实战背这-5-道就够)
- [4.8 本册答题模板汇总](#48-本册答题模板汇总)
- [4.9 速记卡与连环追问](#49-速记卡与连环追问)

---

## 4.1 Promise 的三种状态与回调地狱

### 4.1.0 一句话结论

> Promise 有**三种状态**：`pending`（进行中）、`fulfilled`（已成功）、`rejected`（已失败）。状态只能从 `pending` 单向转到另外两个之一，**一旦确定就不可逆**，且**只能确定一次**。它解决回调地狱的核心手段是：把**嵌套**变成**链式**，并让错误可以**统一冒泡到一个 `catch`**。

### 4.1.1 三态与两条铁律

```
                 ┌──────────────┐
                 │   pending    │  ← 初始状态
                 └──────┬───────┘
              resolve() │ reject()
          ┌─────────────┴─────────────┐
          ▼                           ▼
  ┌───────────────┐          ┌───────────────┐
  │  fulfilled    │          │   rejected    │
  │  （已成功）     │          │  （已失败）     │
  └───────────────┘          └───────────────┘
          │                           │
          └─────── 不可逆，不可再变 ────┘
```

```js
const p = new Promise((resolve, reject) => {
  resolve(1);
  resolve(2);        // ❌ 无效：状态已确定，第二次调用被忽略
  reject(new Error());  // ❌ 无效
  console.log('executor 里的代码是同步执行的');   // ✅ 会打印
});

p.then((v) => console.log(v));   // 1
```

**两条铁律**：

1. **状态不可逆**：`pending → fulfilled` 或 `pending → rejected`，之后不能再变。
2. **只认第一次**：后续的 `resolve`/`reject` 调用被静默忽略（不报错）。

> **注意**：`executor`（`new Promise(fn)` 里的 `fn`）是**同步立即执行**的，只有 `then` 里的回调才是异步的（微任务）。这是最常见的误解。

### 4.1.2 回调地狱到底"痛"在哪

```js
// 回调地狱：三层就已经很难读了
getUser(userId, (err, user) => {
  if (err) return handleError(err);
  getOrders(user.id, (err, orders) => {
    if (err) return handleError(err);
    getOrderDetail(orders[0].id, (err, detail) => {
      if (err) return handleError(err);
      render(detail);
    });
  });
});
```

**四个具体问题**（不说"难看"，要说"工程问题"）：

| 问题 | 说明 |
|---|---|
| **错误处理重复** | 每层都要写 `if (err)`，漏一个就吞掉错误 |
| **无法统一 catch** | 深层错误没法在一个地方兜住 |
| **无法表达"并发"** | 想同时发两个请求再合并，回调里很别扭 |
| **无法中断 / 无法返回** | 回调没有返回值，想 return 一个结果继续用做不到 |

### 4.1.3 Promise 链怎么解决

```js
getUser(userId)
  .then((user) => getOrders(user.id))
  .then((orders) => getOrderDetail(orders[0].id))
  .then((detail) => render(detail))
  .catch((err) => handleError(err));   // ← 一处兜住整条链
```

**三个关键改进**：

1. **扁平化**：`then` 返回新 Promise，链式调用，不再嵌套
2. **错误冒泡**：任一环 `throw` 或返回 rejected，都会跳过后续 `then`，直接到最近的 `catch`
3. **可组合**：因为返回 Promise，所以能 `Promise.all`、能 `await`

### 4.1.4 从回调到 async/await 的三级演进

```js
// 第 1 级：回调
fs.readFile('a.txt', (err, a) => {
  if (err) throw err;
  fs.readFile('b.txt', (err, b) => {
    if (err) throw err;
    console.log(a + b);
  });
});

// 第 2 级：Promise 链
fs.promises.readFile('a.txt')
  .then((a) => fs.promises.readFile('b.txt').then((b) => a + b))
  .then(console.log)
  .catch(console.error);

// 第 3 级：async/await（真正像同步）
async function main() {
  try {
    const a = await fs.promises.readFile('a.txt');
    const b = await fs.promises.readFile('b.txt');
    console.log(a + b);
  } catch (e) {
    console.error(e);
  }
}
```

> **面试话术**："`async/await` 是 Promise 的**语法糖**，它没有取代 Promise，而是让**等待**这件事从回调变成了表达式。底层还是 Promise + 微任务。"

### 4.1.5 答题模板

**30 秒版：**

> "Promise 有三种状态：`pending`、`fulfilled`、`rejected`，只能从 `pending` 单向转变，而且**只能变一次**，之后的 `resolve`/`reject` 都被忽略。
> 它解决回调地狱靠两点：一是 `then` 返回新 Promise，把**嵌套变成链式**；二是错误会**沿链冒泡**，一个 `catch` 就能兜住整条链。再往后 `async/await` 让它写起来像同步代码。"

**2 分钟版补充：**

> "有个容易误解的点：`new Promise(fn)` 里的 `fn` 是**同步立即执行**的，只有 `then` 里的回调是异步的。所以 `new Promise(() => console.log(1)); console.log(2)` 输出是 `1, 2`。
> 另外 `then` 的两个回调只走一个，`catch` 等价于 `then(null, fn)`，`finally` 不接收值也不改变结果，适合做清理。"

### 4.1.6 追问表

| 追问 | 答题要点 |
|---|---|
| 三种状态？ | `pending` / `fulfilled` / `rejected` |
| 能变几次？ | 只能变一次，后续调用被忽略 |
| `resolve` 一个 Promise 会怎样？ | 状态"跟随"它（adopt），等它 settled 才确定 |
| executor 同步还是异步？ | **同步**执行 |
| `then` 回调同步还是异步？ | 异步（微任务） |
| `catch` 和 `then(null, fn)` 一样吗？ | 等价 |
| `finally` 有什么用？ | 清理（关 loading、断连接），不改变结果 |
| `finally` 里 return 会覆盖吗？ | 不会覆盖，但 `finally` 里 `throw` 会覆盖 |
| Promise 能取消吗？ | 原生不能，需要 `AbortController` 或自己封装 |
| 回调地狱还有别的解法吗？ | 事件总线、发布订阅、`async/await`、状态机 |

---

## 4.2 then 的四个行为规则（必考）

> 这一节不在原题单里，但是「Promise」类追问的核心。**`then` 的行为决定了一切输出顺序题的答案。**

### 4.2.1 规则一：`then` 总是返回**新的** Promise

```js
const p1 = Promise.resolve(1);
const p2 = p1.then((v) => v + 1);
console.log(p1 === p2);   // false ← 永远是新的
```

### 4.2.2 规则二：返回值决定新 Promise 的状态

```js
Promise.resolve(1)
  .then(() => 2)                        // 返回普通值 → fulfilled(2)
  .then(() => { throw new Error('x') }) // 抛错 → rejected
  .then(() => 3)                        // 被跳过（因为上一个 rejected）
  .then(
    (v) => console.log('成功', v),       // 不执行
    (e) => console.log('失败', e.message) // 打印 '失败 x'
  );

// 返回 Promise → 会"展开"（等它 settled）
Promise.resolve(1)
  .then(() => Promise.resolve(2))
  .then((v) => console.log(v));   // 2（不是 Promise 对象）

// 返回 thenable → 也会被展开
Promise.resolve(1).then(() => ({ then: (res) => res(3) })).then(console.log);  // 3
```

### 4.2.3 规则三：**值穿透**

```js
// then 不传回调（或传非函数）→ 值直接透传
Promise.resolve(1)
  .then()                 // 非函数 → 忽略
  .then(null)             // 同上
  .then((v) => console.log(v));   // 1

// 错误也会"穿透"：没有 onRejected 就一直往下传
Promise.reject(new Error('boom'))
  .then((v) => console.log('跳过'))
  .then((v) => console.log('跳过'))
  .catch((e) => console.log('捕获到', e.message));   // '捕获到 boom'
```

**这条规则解释了为什么"错误可以冒泡"**：中间没有 `onRejected` 时，rejected 状态会沿着链一路传下去，直到遇到 `catch`。

### 4.2.4 规则四：`then` 的回调**永远异步**

```js
console.log('A');
Promise.resolve().then(() => console.log('B'));
console.log('C');
// A, C, B

// 即使 Promise 已经是 fulfilled，then 回调也不会同步执行
const p = Promise.resolve('x');
p.then((v) => console.log(v));
console.log('after');   // 先打印 'after'
```

### 4.2.5 顺带：手写一个简化版 Promise（面试常考）

```js
const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

class MyPromise {
  #state = PENDING;
  #value = undefined;
  #callbacks = [];          // 待执行的回调队列

  constructor(executor) {
    const resolve = (value) => {
      if (this.#state !== PENDING) return;
      // 处理 resolve 一个 Promise/thenable 的情况
      if (value instanceof MyPromise) return value.then(resolve, reject);
      this.#state = FULFILLED;
      this.#value = value;
      this.#flush();
    };
    const reject = (reason) => {
      if (this.#state !== PENDING) return;
      this.#state = REJECTED;
      this.#value = reason;
      this.#flush();
    };
    try {
      executor(resolve, reject);
    } catch (e) {
      reject(e);
    }
  }

  #flush() {
    if (this.#state === PENDING) return;
    queueMicrotask(() => {
      this.#callbacks.forEach((cb) => cb());
      this.#callbacks = [];
    });
  }

  then(onFulfilled, onRejected) {
    return new MyPromise((resolve, reject) => {
      const handle = () => {
        // 值穿透：非函数则透传
        const cb = this.#state === FULFILLED ? onFulfilled : onRejected;
        if (typeof cb !== 'function') {
          return this.#state === FULFILLED ? resolve(this.#value) : reject(this.#value);
        }
        try {
          resolve(cb(this.#value));      // 返回值决定新 Promise 状态
        } catch (e) {
          reject(e);
        }
      };

      if (this.#state === PENDING) {
        this.#callbacks.push(handle);
      } else {
        queueMicrotask(handle);          // 已 settled → 异步执行
      }
    });
  }

  catch(onRejected) {
    return this.then(null, onRejected);
  }

  finally(onFinally) {
    return this.then(
      (v) => MyPromise.resolve(onFinally()).then(() => v),
      (e) => MyPromise.resolve(onFinally()).then(() => { throw e; })
    );
  }

  static resolve(v) {
    return v instanceof MyPromise ? v : new MyPromise((res) => res(v));
  }
  static reject(e) {
    return new MyPromise((_, rej) => rej(e));
  }
}
```

**手写要点（面试官只看这几个）**：

1. 状态机 + **只变一次**
2. `then` 返回**新 Promise**
3. 回调**异步执行**（`queueMicrotask` 或 `setTimeout`）
4. **值穿透**（非函数回调直接透传）
5. 返回值 / 抛错决定新 Promise 状态
6. `executor` 抛错要 `reject`
7. `resolve` 一个 Promise 要"跟随"（adopt）

---

## 4.3 all / race / allSettled / any

### 4.3.0 一句话结论

> 四个静态方法解决"多个 Promise 怎么组合"：
> **`all`** —— 全部成功才成功，**一个失败立刻失败**；
> **`race`** —— **谁先 settled 就用谁**（成功失败都算）；
> **`allSettled`** —— **等全部结束**，永远成功，返回每个的状态；
> **`any`** —— **第一个成功**就成功，全部失败才失败（抛 `AggregateError`）。

### 4.3.1 四种方法对照

| 方法 | 成功条件 | 失败条件 | 返回值 | 用途 |
|---|---|---|---|---|
| `Promise.all` | 全部 fulfilled | **任一 rejected**（立即） | 结果数组（**按顺序**） | 并发请求，缺一不可 |
| `Promise.allSettled` | **总是 fulfilled** | 永不 rejected | `[{status, value/reason}]` | 部分失败也要结果 |
| `Promise.race` | 第一个 fulfilled | 第一个 rejected | 第一个 settled 的值 | 超时控制 |
| `Promise.any` | 第一个 fulfilled | 全部 rejected | 第一个成功的值 | 多源容灾（CDN 竞速） |

```js
const p1 = Promise.resolve(1);
const p2 = new Promise((r) => setTimeout(() => r(2), 100));
const p3 = Promise.reject(new Error('boom'));

Promise.all([p1, p2]).then(console.log);            // [1, 2]
Promise.all([p1, p3]).catch((e) => console.log(e.message));  // 'boom'
Promise.allSettled([p1, p3]).then(console.log);
// [ { status: 'fulfilled', value: 1 },
//   { status: 'rejected', reason: Error } ]
Promise.race([p2, p3]).catch((e) => console.log('race:', e.message));  // race: boom（p3 更快）
Promise.any([p3, p1]).then((v) => console.log('any:', v));             // any: 1
Promise.any([p3, Promise.reject(new Error('b2'))])
  .catch((e) => console.log(e.constructor.name, e.errors.length));     // AggregateError 2
```

### 4.3.2 三个必须知道的细节

#### 细节 1：`all` 只要一个失败就 reject，但**其他请求不会停止**

```js
const slow = new Promise((res) => setTimeout(() => { console.log('slow 仍在跑'); res(1); }, 500));
const fail = Promise.reject(new Error('x'));

Promise.all([slow, fail]).catch((e) => console.log('all 失败'));
// 立刻打印 'all 失败'，但 500ms 后仍会打印 'slow 仍在跑'
```

> **要真正"失败即取消"，必须用 `AbortController`**：

```js
const ctrl = new AbortController();
Promise.all([
  fetch('/api/a', { signal: ctrl.signal }),
  fetch('/api/b', { signal: ctrl.signal }),
]).catch((e) => { ctrl.abort(); throw e; });
```

#### 细节 2：`all` 的结果**顺序是传入顺序**，不是完成顺序

```js
Promise.all([
  new Promise((r) => setTimeout(() => r('慢'), 100)),
  new Promise((r) => setTimeout(() => r('快'), 10)),
]).then(console.log);   // ['慢', '快']  ← 与传入顺序一致
```

#### 细节 3：`race` 在空数组上会**永远 pending**

```js
Promise.race([]);        // 永远 pending（不 resolve 也不 reject）
Promise.all([]);         // 立即 resolve([])
Promise.allSettled([]);  // 立即 resolve([])
Promise.any([]);         // 立即 reject(AggregateError)
```

### 4.3.3 手写 `Promise.all`（必考）

```js
function myAll(iterable) {
  return new Promise((resolve, reject) => {
    const items = Array.from(iterable);      // 支持 Set / 生成器
    const results = new Array(items.length);
    let count = 0;

    if (items.length === 0) return resolve(results);   // 空数组边界

    items.forEach((item, index) => {
      // 用 Promise.resolve 包一层，兼容非 Promise 值
      Promise.resolve(item).then(
        (value) => {
          results[index] = value;            // 按下标存，保证顺序
          if (++count === items.length) resolve(results);
        },
        reject                                // 直接 reject，后续忽略
      );
    });
  });
}
```

**五个易错点**：

1. **不能用 `push`** —— 完成顺序不是传入顺序，必须用下标
2. **空数组**要立即 `resolve([])`，否则永远 pending
3. **非 Promise 值**要 `Promise.resolve` 包一层
4. **计数器**用 `++count === length`，不能用 `results.length`
5. **迭代器**要 `Array.from`，`forEach` 对 `Set` 不适用（`Set` 有 `forEach` 但参数不同）

### 4.3.4 顺带：手写 `Promise.allSettled` 和 `race`

```js
function myAllSettled(iterable) {
  return Promise.all(
    Array.from(iterable, (item) =>
      Promise.resolve(item).then(
        (value) => ({ status: 'fulfilled', value }),
        (reason) => ({ status: 'rejected', reason })
      )
    )
  );
}

function myRace(iterable) {
  return new Promise((resolve, reject) => {
    for (const item of iterable) {
      Promise.resolve(item).then(resolve, reject);
    }
  });
}
```

### 4.3.5 答题模板

**30 秒版：**

> "`all` 是**全部成功才成功，一个失败立刻失败**，结果按传入顺序返回；`race` 是**谁先 `settled` 就用谁**，成功失败都算；`allSettled` 是**等全部结束**，永远成功，返回每个的状态和值；`any` 是**第一个成功就成功**，全失败才抛 `AggregateError`。
> 实际用 `all` 处理并发请求，用 `race` 做超时控制，用 `allSettled` 处理"部分失败也要展示"的场景，用 `any` 做多源竞速。"

**2 分钟版补充：**

> "三个细节：
> 一是 `all` 有一个失败就 reject，但**其他请求不会被取消**，还在继续跑。真要取消得配合 `AbortController`。
> 二是 `race` 在空数组上会**永远 pending**，`all` 空数组会立即 `resolve([])`。
> 三是手写 `all` 的关键点是**用下标存结果**而不是 `push`，因为完成顺序和传入顺序不一样。"

### 4.3.6 追问表

| 追问 | 答题要点 |
|---|---|
| `all` 和 `race` 区别？ | 全成功 vs 第一个 settled |
| `allSettled` 和 `all` 区别？ | 前者永不 reject，返回状态数组 |
| `any` 和 `race` 区别？ | 前者只认成功，后者成功失败都算 |
| `all` 一个失败其他会停吗？ | 不会，只是 `all` 的 Promise rejected |
| `all` 结果是完成顺序吗？ | 不是，是**传入顺序** |
| `race([])` 会怎样？ | 永远 pending |
| `all([])` 会怎样？ | 立即 `resolve([])` |
| `any([])` 会怎样？ | 立即 reject `AggregateError` |
| `AggregateError` 是什么？ | 包含所有失败原因的聚合错误，`e.errors` |
| 怎么实现超时？ | `Promise.race([task, timeout])` |
| 超时后原请求会停吗？ | 不会，要 `AbortController` |
| 怎么手写 `all`？ | 下标存结果 + 计数器 + 空数组边界 |
| `all` 能接收 `Set` 吗？ | 能，但要用 `Array.from` 转 |
| 非 Promise 值会怎样？ | 被 `Promise.resolve` 包装成 fulfilled |

---

## 4.4 并发与串行：性能差异与并发控制

### 4.4.0 一句话结论

> `await a(); await b();` 是**串行**——总耗时是两者之和；`await Promise.all([a(), b()])` 是**并发**——总耗时约等于两者最大值。但要注意：**`a()` 和 `b()` 在写进数组时就已经开始执行了**，`Promise.all` 只是"等它们"，不是"启动它们"。并发不是越多越好，需要**并发控制**。

### 4.4.1 先看清一个关键细节

```js
// 串行：b 要等 a 完成才开始
const t1 = Date.now();
const ra = await a();   // 3s
const rb = await b();   // 2s
console.log(Date.now() - t1);   // ≈ 5000ms

// 并发：两个请求"同时"发出
const t2 = Date.now();
const [ra2, rb2] = await Promise.all([a(), b()]);
//                              ↑    ↑
//                       这两个调用是先执行的，Promise.all 只是收集结果
console.log(Date.now() - t2);   // ≈ 3000ms
```

**这里有个常见误解**：

```js
// ❌ 这样写还是串行！
const pa = a();          // 已经开始跑
const pb = await b();    // 但这里 await 会"挂起"，pa 的结果要等到下面才拿
const ra = await pa;
```

实际上上面这段**是并发**的，因为 `a()` 在 `await b()` 之前已经启动了。真正的串行是 `await a(); await b();`。

**准确的理解**：

> **`await` 只是"在这里等"，不会"启动"或"阻止"之前已经调用的异步操作。** 所以"先启动所有，再逐个 `await`"也是并发：

```js
// ✅ 也是并发（常用写法）
const p1 = fetch('/a');
const p2 = fetch('/b');
const r1 = await p1;
const r2 = await p2;
```

### 4.4.2 最常见的错误：`for` 循环里 `await`

```js
// ❌ 串行：10 个请求依次发，总耗时 = 10 × 单次
for (const id of ids) {
  const data = await fetchDetail(id);
  results.push(data);
}

// ✅ 并发：10 个同时发
const results = await Promise.all(ids.map((id) => fetchDetail(id)));
```

**还有一个更隐蔽的错误**：

```js
// ❌ forEach 里的 await 完全无效！
ids.forEach(async (id) => {
  const data = await fetchDetail(id);
  results.push(data);
});
console.log(results);   // [] ← 循环已经结束，但请求都没回来
```

**为什么无效？** `forEach` 不关心回调的返回值（哪怕返回 Promise 也直接丢弃），所以它不会等。而且 `forEach` 本身是同步的，`await` 只暂停了**回调函数**，没暂停 `forEach`。

**要用 `for...of`**（因为它会 `await` 迭代器的下一个值）：

```js
for (const id of ids) {
  const data = await fetchDetail(id);   // ✅ 真的会等
  results.push(data);
}
```

**一张表记住**：

| 写法 | 是否等待 | 是否并发 |
|---|---|---|
| `for (const x of arr) { await f(x) }` | ✅ 等待 | ❌ 串行 |
| `for await (const x of arr) { ... }` | ✅ 等待 | ❌ 串行 |
| `arr.forEach(async (x) => { await f(x) })` | ❌ **不等待** | ✅ 实际并发但无法收结果 |
| `await Promise.all(arr.map(f))` | ✅ 等待 | ✅ 并发 |
| `arr.map(async (x) => f(x))` | ❌ 不等待（返回 Promise 数组） | ✅ 已启动 |

### 4.4.3 并发不是越多越好：并发控制

```js
// ❌ 1000 个请求同时发 → 浏览器限制 6 个/域名，其余排队；服务端可能限流
await Promise.all(urls.map((u) => fetch(u)));
```

**后果**：

- 浏览器同域名并发限制（HTTP/1.1 是 6 个），超出会排队，反而可能更慢
- 服务端 QPS 限制 → 429 限流
- 内存暴涨（1000 个请求的响应都堆在内存）
- 用户体验：首屏等待时间不可控

**手写并发池**（面试高频）：

```js
/**
 * @param {Array<() => Promise<any>>} tasks 任务工厂（注意是函数，不是 Promise）
 * @param {number} limit 最大并发数
 */
async function pool(tasks, limit = 6) {
  const results = new Array(tasks.length);
  let cursor = 0;

  async function worker() {
    while (cursor < tasks.length) {
      const index = cursor++;          // 先取下标，再 await（关键）
      results[index] = await tasks[index]();
    }
  }

  // 启动 limit 个 worker，它们会"抢"任务
  const workers = Array.from(
    { length: Math.min(limit, tasks.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

// 用法
const tasks = urls.map((u) => () => fetch(u).then((r) => r.json()));
const data = await pool(tasks, 6);
```

**为什么 `index = cursor++` 必须在 `await` 之前？**

因为 `cursor++` 是同步的，`await` 会挂起当前 worker。如果写在 `await` 之后，多个 worker 可能拿到同一个下标（竞态）。

**`p-limit` 的核心也是这个思路**，只是用了队列 + `activeCount`。

### 4.4.4 什么时候该串行

并发不是无脑用：

| 场景 | 选择 | 原因 |
|---|---|---|
| 请求之间**有依赖**（B 需要 A 的结果） | 串行 | 无法并发 |
| 无依赖的列表请求 | 并发（`all`） | 快 |
| 大量请求（>10） | 并发 + 限流 | 防止打爆服务端 |
| **有顺序要求**的写操作 | 串行 | 保证顺序 |
| 分页加载（无限滚动） | 串行 | 依赖上一页的游标 |
| 上传大文件分片 | 并发 + 限流 | 兼顾速度与稳定 |

### 4.4.5 答题模板

**30 秒版：**

> "`await a(); await b()` 是串行，总耗时是两者之和；`Promise.all([a(), b()])` 是并发，总耗时约等于最大值。
> 有个关键细节：**`a()` 和 `b()` 写进数组时就已经开始执行了**，`Promise.all` 只是收集结果，不是启动。所以'先启动再逐个 await'也是并发。
> 但并发不能无脑用，请求多了要限流。比如 1000 个请求同时发，浏览器同域名有 6 个的限制，服务端也可能限流，这时候要用并发池控制数量。"

**2 分钟版补充：**

> "两个高频坑：
> 一是 **`forEach` 里的 `await` 是无效的**。`forEach` 会丢弃回调的返回值，本身也是同步的，所以它不会等。要真的串行等待得用 `for...of`。
> 二是**手写并发池**的关键是 worker 模式：启动 `limit` 个 worker 抢任务，取下标 `const index = cursor++` 必须在 `await` 之前，否则多个 worker 会拿到同一个下标。`p-limit` 就是这个思路。"

### 4.4.6 追问表

| 追问 | 答题要点 |
|---|---|
| `await a(); await b()` 耗时？ | 两者之和（串行） |
| `Promise.all([a(), b()])` 耗时？ | 约等于最大值（并发） |
| `Promise.all` 会"启动"任务吗？ | 不会，任务在传入时已启动 |
| 先启动再逐个 `await` 是并发吗？ | 是 |
| `forEach` 里 `await` 有效吗？ | **无效**，`forEach` 丢弃返回值且本身同步 |
| 用什么替代？ | `for...of`（串行）或 `Promise.all(map)`（并发） |
| `map` 里 `async` 会等待吗？ | 不会，返回的是 Promise 数组，要 `Promise.all` 收 |
| 为什么要并发控制？ | 浏览器 6 并发限制、服务端限流、内存 |
| 怎么实现并发池？ | worker 模式 + 共享游标 |
| `cursor++` 为什么要在 `await` 前？ | 避免多个 worker 抢到同一下标 |
| 并发控制库有哪些？ | `p-limit`、`p-queue`、`async`（`eachLimit`） |
| 怎么保证请求按顺序返回？ | `Promise.all` 结果按传入顺序，不用额外处理 |

---

## 4.5 async 与 await 做了什么

### 4.5.0 一句话结论

> **`async`** 做了两件事：把函数**返回值包装成 Promise**（`return 1` → `Promise.resolve(1)`，`throw` → rejected），并且**允许函数体内使用 `await`**。
> **`await`** 做了三件事：把后面的值**用 `Promise.resolve` 包装**、**暂停当前 async 函数的执行**（把后续代码注册为该 Promise 的回调）、**让出线程**（后续代码进入微任务队列）。它**不阻塞主线程**，只是暂停了这一个函数。

### 4.5.1 `async` 的三个行为

```js
// ① 返回值自动包装成 Promise
async function f1() { return 1; }
f1() instanceof Promise;   // true
f1().then(console.log);    // 1

// ② 抛错自动变成 rejected
async function f2() { throw new Error('boom'); }
f2().catch((e) => console.log(e.message));   // 'boom'

// ③ 不 return 就是 resolve(undefined)
async function f3() {}
f3().then((v) => console.log(v));   // undefined
```

**等价关系**：

```js
async function f() { return 1; }
// ≈
function f() { return Promise.resolve(1); }

async function g() { throw new Error(); }
// ≈
function g() { return Promise.reject(new Error()); }
```

### 4.5.2 `await` 做了什么（逐步拆解）

```js
async function main() {
  console.log('1');
  const r = await fetch('/api');   // ← 断点
  console.log('2', r);
  return 'done';
}
```

```
① 执行 fetch('/api')，得到一个 Promise（记作 P）
② 用 PromiseResolve(P) 包装（如果 P 是原生 Promise 就是它本身）
③ 注册"后续代码"为 P 的回调（相当于 P.then(rest)）
④ main 函数【返回】一个 pending 的 Promise（不阻塞调用者）
   → 控制权交回调用方
⑤ 主线程继续执行其他同步代码 / 其他任务
⑥ 当 P fulfilled，'后续代码'作为【微任务】执行
   → 打印 '2'，返回 'done'，main 的 Promise 变成 fulfilled
```

**关键点**：

- **不是"暂停线程"，是"暂停这一个函数"**。主线程该干嘛干嘛。
- `await` 之后的代码等价于 `.then()` 的回调，**必然异步**（微任务）。
- **`await` 一个非 Promise 值也会让出一次**：

```js
async function f() {
  console.log(1);
  await 123;              // 不是 Promise，但仍会暂停
  console.log(2);
}
f();
console.log(3);
// 输出：1, 3, 2   ← 2 在 3 之后！
```

**为什么？** 因为规范里 `await` 走 `PromiseResolve(value)`，哪怕值是 `123` 也会包成 `Promise.resolve(123)`，然后注册回调 → 至少延迟一个微任务。

> ⚠️ 细节：V8 曾对 `await` 做过优化（`await` 已 resolve 的 Promise 从 3 个 tick 减到 1 个 tick），但"异步"这一点没变。所以 `await 123` 一定不会同步往下走。

### 4.5.3 `await` 是 Generator + 自动执行器的语法糖

这是"加分项"，能说清说明你真懂：

```js
// Generator 版
function* gen() {
  const a = yield fetchA();
  const b = yield fetchB(a);
  return b;
}

// 自动执行器（co 库的核心，约 10 行）
function run(generatorFn) {
  const it = generatorFn();
  return new Promise((resolve, reject) => {
    function step(method, arg) {
      let result;
      try {
        result = it[method](arg);
      } catch (e) {
        return reject(e);
      }
      if (result.done) return resolve(result.value);
      Promise.resolve(result.value).then(
        (v) => step('next', v),
        (e) => step('throw', e)
      );
    }
    step('next');
  });
}

run(gen).then(console.log);
```

**`async/await` ≈ `run` + `function*`**。区别是：

| | Generator + co | async/await |
|---|---|---|
| 语法 | `function*` + `yield` + `run()` | `async` + `await` |
| 原生支持 | 需要库（co） | ✅ 语言内置 |
| 错误处理 | `try/catch` 需要 co 支持 | ✅ 原生 `try/catch` |
| 调试 | 断点跳跃，体验差 | ✅ 像同步代码一样单步 |

### 4.5.4 五个高频坑

```js
// 坑 1：forEach 里 await 无效（见 4.4.2）
// 坑 2：忘记 try/catch，错误变成 unhandled rejection
async function bad() {
  const r = await fetch('/api');   // 网络错误 → 函数返回 rejected
}
bad();   // 没人 catch → UnhandledPromiseRejection

// 坑 3：在循环里串行 await，性能差
for (const u of urls) await fetch(u);   // 应该用 Promise.all

// 坑 4：await 在类字段初始化里不合法
class A {
  // data = await fetch();   // ❌ SyntaxError
}

// 坑 5：async 函数作为回调，错误没人管
[1, 2, 3].forEach(async (n) => {
  throw new Error('x');    // ❌ 没人 catch，静默变成 unhandled rejection
});
```

**关于坑 5 的补充**：这是"`forEach` + `async`"的另一个隐患——不仅不等待，抛错还没人接。

### 4.5.5 顶层 `await`（ES2022）

```js
// 模块顶层可以直接 await（不需要包在 async 函数里）
// data.mjs
const res = await fetch('/api');
export const data = await res.json();
```

**三个限制**：

1. 只能在 **ESM 模块**里用（`<script type="module">` 或 `.mjs`），CJS 不行
2. 会让**依赖它的模块也变成异步**（父模块要等它）
3. 会**阻塞依赖链**，但不阻塞其他模块（这点和 CJS 的同步加载不同）

### 4.5.6 答题模板

**30 秒版：**

> "`async` 做了两件事：把返回值自动包装成 Promise，并且允许函数体里用 `await`。`await` 做了三件事：把后面的值用 `Promise.resolve` 包装、暂停当前 async 函数的执行、把后续代码注册成这个 Promise 的回调（也就是微任务）。
> 关键是要说清：**它暂停的是"这一个函数"，不是主线程**。所以 `await` 不会阻塞页面。"

**2 分钟版补充：**

> "两个细节：
> 一是 **`await` 一个非 Promise 值也会让出一次**。`await 123` 之后的代码也是异步的，所以 `async function f(){ console.log(1); await 123; console.log(2) } f(); console.log(3)` 输出是 `1, 3, 2`。
> 二是 `async/await` 的本质是 **Generator + 自动执行器**。用 `function*` + `yield` 加上一个 `run` 函数（co 库那 10 行）就能模拟出来，区别只是 async/await 是语言内置的、调试体验更好。"

### 4.5.7 追问表

| 追问 | 答题要点 |
|---|---|
| `async` 函数的返回值？ | 总是 Promise |
| `async` 里 `throw` 会怎样？ | 返回 rejected Promise |
| `await` 阻塞主线程吗？ | 不阻塞，只暂停当前函数 |
| `await 123` 会异步吗？ | 会，仍延迟一个微任务 |
| `await` 后面跟 thenable？ | 会被展开（走 `then`） |
| `await` 的错误怎么捕？ | `try/catch` |
| 不 catch 会怎样？ | unhandled rejection |
| `async/await` 和 Generator 关系？ | 是它的语法糖，靠自动执行器 |
| 顶层 `await` 限制？ | 只能 ESM，会让父模块变异步 |
| `await` 能用在普通函数里吗？ | 不能（除顶层 await） |
| `async` 函数能用 `new` 吗？ | 不能，返回的是 Promise |
| `await` 多个任务怎么并发？ | `Promise.all` |
| `return await` 和 `return` 有区别吗？ | 在 try/catch 里有区别（`return await` 能被 catch 捕到） |

---

## 4.6 事件循环

### 4.6.0 一句话结论

> 浏览器的事件循环规则是：**执行一个宏任务 → 清空整个微任务队列 → （可能需要渲染）→ 取下一个宏任务**，如此循环。**微任务永远优先于下一个宏任务**，而且在同一轮里会**被全部清空**（包括微任务里新产生的微任务）。

### 4.6.1 一轮完整的事件循环

```
┌─────────────────────────────────────────────────┐
│  ① 从宏任务队列取【一个】任务执行                   │
└────────────────────┬────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────┐
│  ② 执行完毕，检查微任务队列 → 【清空】              │
│     （微任务里新产生的微任务也要执行完）             │
└────────────────────┬────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────┐
│  ③ 判断是否需要渲染（浏览器决定，约 60fps 一次）     │
│     ├─ requestAnimationFrame 回调                 │
│     ├─ 样式计算 → 布局 → 绘制 → 合成               │
│     └─ （这之后才轮到下一轮宏任务）                 │
└────────────────────┬────────────────────────────┘
                     ▼
              回到 ①，循环
```

### 4.6.2 宏任务与微任务清单

| 宏任务（Task / Macrotask） | 微任务（Microtask） |
|---|---|
| `<script>` 整体代码 | `Promise.then` / `catch` / `finally` |
| `setTimeout` / `setInterval` | `queueMicrotask(fn)` |
| `setImmediate`（Node / IE） | `MutationObserver` 回调 |
| `MessageChannel` / `postMessage` | `process.nextTick`（Node，**优先级更高**） |
| I/O 回调（文件、网络） | `await` 之后的代码 |
| UI 事件（click、scroll 等） | `IntersectionObserver` / `ResizeObserver` 回调 |
| `requestAnimationFrame`（**特殊**，在渲染前） | |

> **`requestAnimationFrame` 不是宏任务也不是微任务**，它属于"渲染步骤"里的回调，在**微任务清空之后、样式计算之前**执行。

### 4.6.3 为什么微任务优先？一句话解释

因为**微任务队列是在"当前宏任务结束后"立刻清空的**，而下一个宏任务要等渲染（如果需要）之后才取。所以：

```
宏任务 A 执行完 → 清空微任务 → 渲染 → 宏任务 B
                ↑
        微任务插在这里，永远比 B 早
```

### 4.6.4 Node.js 的事件循环（6 个阶段）

```
   ┌───────────────────────────┐
┌─>│        timers             │  setTimeout / setInterval 回调
│  └─────────────┬─────────────┘
│  ┌─────────────▼─────────────┐
│  │     pending callbacks     │  上一轮延迟的 I/O 回调（如 TCP 错误）
│  └─────────────┬─────────────┘
│  ┌─────────────▼─────────────┐
│  │     idle / prepare        │  内部使用
│  └─────────────┬─────────────┘
│  ┌─────────────▼─────────────┐
│  │          poll             │  ← 核心：获取新 I/O 事件，执行 I/O 回调
│  └─────────────┬─────────────┘     （会在这里阻塞等待）
│  ┌─────────────▼─────────────┐
│  │          check            │  setImmediate 回调
│  └─────────────┬─────────────┘
│  ┌─────────────▼─────────────┐
│  │     close callbacks       │  socket.on('close') 等
│  └─────────────┬─────────────┘
└────────────────┘
```

**三个关键规则**：

1. **每个阶段结束后都会清空微任务队列**（Node 11+ 是每个宏任务后都清，Node 10 之前是阶段之间清）
2. **`process.nextTick` 优先于 Promise 微任务**（nextTick 队列先清空）
3. **`setImmediate` 在 `check` 阶段，`setTimeout` 在 `timers` 阶段**，顺序取决于进入循环的时机

```js
// Node 里的经典顺序题
setTimeout(() => console.log('timeout'), 0);
setImmediate(() => console.log('immediate'));

// 在主模块中：顺序不确定（取决于进程启动耗时是否超过 1ms）
// 在 I/O 回调中：immediate 一定先（因为 poll → check）
```

```js
// nextTick vs Promise
Promise.resolve().then(() => console.log('promise'));
process.nextTick(() => console.log('nextTick'));
// 输出：nextTick, promise
```

### 4.6.5 一个反直觉的点：`setTimeout(fn, 0)` 不是 0ms

```js
const start = Date.now();
setTimeout(() => console.log(Date.now() - start), 0);
// 通常输出 1~4ms，不是 0
```

**原因**：

1. HTML 规范规定嵌套超过 5 层的 `setTimeout` 最小间隔是 **4ms**（`setTimeout(fn, 0)` 会被钳制到 1ms，实际执行还要等调度）
2. 要等当前宏任务 + 所有微任务 + 可能的渲染
3. 浏览器会对后台标签页做节流（最低 1 秒一次）

### 4.6.6 事件循环与渲染：为什么改 DOM 后要等一等

```js
// ❌ 这样读到的还是旧布局（但会触发强制同步布局，性能差）
el.style.width = '100px';
console.log(el.offsetWidth);   // 100（浏览器被迫立即重排）

// ✅ 批量改，一次重排
el.style.width = '100px';
el.style.height = '100px';
// 浏览器在下一帧统一处理

// 想在下一次渲染后执行 → rAF + rAF 或 setTimeout
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    // 此时上一帧的 DOM 变更已经渲染
  });
});
```

**为什么 `nextTick` 能拿到更新后的 DOM？**

Vue 的 `nextTick` 本质是 `Promise.resolve().then(fn)`，也就是微任务。而 Vue 的 DOM 更新也是放在微任务队列里的（`queueFlush`），所以 `await nextTick()` 时 DOM 已经更新了。

### 4.6.7 答题模板

**30 秒版：**

> "事件循环的规则是：**执行一个宏任务，然后清空整个微任务队列，再取下一个宏任务**，如此循环。
> 宏任务包括 `setTimeout`、`setInterval`、I/O、UI 事件和整个 `<script>`；微任务包括 `Promise.then`、`queueMicrotask`、`MutationObserver` 和 `await` 之后的代码。
> 所以微任务永远比下一个宏任务先执行，而且同一轮里微任务会被**全部清空**，包括微任务里新产生的。"

**2 分钟版补充：**

> "补三个点：
> 一是 **`requestAnimationFrame` 既不是宏任务也不是微任务**，它在渲染步骤里，位置是"微任务清空之后、样式计算之前"。
> 二是 **Node 的事件循环有 6 个阶段**：`timers`、`pending callbacks`、`idle/prepare`、`poll`、`check`、`close callbacks`，`setImmediate` 在 `check` 阶段，`process.nextTick` 的优先级比 Promise 微任务还高。
> 三是 **`setTimeout(fn, 0)` 不是 0ms**，规范里嵌套超过 5 层会钳制到 4ms，而且还要等当前宏任务、微任务和渲染，实际通常 1-4ms。"

### 4.6.8 追问表

| 追问 | 答题要点 |
|---|---|
| 宏任务有哪些？ | `script`、`setTimeout`、`setInterval`、I/O、UI 事件、`MessageChannel` |
| 微任务有哪些？ | `Promise.then`、`queueMicrotask`、`MutationObserver`、`await` 之后 |
| 一轮循环的流程？ | 一个宏任务 → 清空微任务 → 可能渲染 → 下一个宏任务 |
| 微任务里产生微任务会怎样？ | 同一轮继续清空，直到队列为空 |
| 微任务会饿死宏任务吗？ | 会，无限 `Promise.then` 递归会卡死页面 |
| `requestAnimationFrame` 属于什么？ | 渲染步骤，不是宏/微任务 |
| `nextTick` 和微任务关系？ | `nextTick` 就是微任务（Vue 用 `Promise.then`） |
| Node 有 6 个阶段，分别是什么？ | `timers`/`pending`/`idle-prepare`/`poll`/`check`/`close` |
| `setImmediate` 和 `setTimeout(0)` 谁先？ | 主模块不确定；I/O 回调里 `setImmediate` 先 |
| `process.nextTick` 和 Promise 谁先？ | `nextTick` 先 |
| `setTimeout(fn, 0)` 真的 0ms 吗？ | 不是，最小 1ms（嵌套 5 层后 4ms） |
| 为什么长任务卡页面？ | 调用栈不清空，事件循环拿不到控制权 |
| `setTimeout` 能精确计时吗？ | 不能，只保证"至少这么久"，且会被节流 |
| 为什么 Vue 的 `nextTick` 能拿到新 DOM？ | 都是微任务，`nextTick` 排在 DOM 更新之后 |

---

## 4.7 输出顺序题实战（背这 5 道就够）

### 题 1：基础三件套

```js
console.log(1);
setTimeout(() => console.log(2), 0);
Promise.resolve().then(() => console.log(3));
console.log(4);
```

**答案**：`1 → 4 → 3 → 2`

**解析**：

```
同步：1, 4
微任务：3（Promise.then）
宏任务：2（setTimeout）
```

---

### 题 2：async/await 与 Promise 混排（**最高频**）

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

**答案**：

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

**解析**（关键在于 `await async2()` 的时间线）：

```
① 同步执行：
   'script start'
   async1() 进入 → 'async1 start'
   → await async2()：async2() 同步执行完，打印 'async2'
   → await 把后续代码（'async1 end'）注册为微任务，async1 挂起返回
   → new Promise executor 同步执行：'promise1'，resolve()
   → 注册微任务 'promise2'
   'script end'

② 清空微任务队列（顺序）：
   'async1 end'   ← 先注册的
   'promise2'

③ 宏任务：
   'setTimeout'
```

> ⚠️ **版本差异说明**：老版本 V8（Chrome 73 之前）里 `await` 要 3 个 tick，输出会是 `promise2` 在前。**现代浏览器（Chrome 73+）都是 `async1 end` 在前**，面试按现代行为答即可，但可以补一句"老版本 V8 有差异，现在已优化"。

---

### 题 3：`await` 后面的代码在什么时候执行

```js
async function f() {
  console.log(1);
  await 0;            // 注意：不是 Promise
  console.log(2);
}
f();
console.log(3);
Promise.resolve().then(() => console.log(4));
```

**答案**：`1 → 3 → 2 → 4`

**解析**：

```
同步：1, 3
微任务队列（按注册顺序）：
   [0] await 的后续（打印 2）
   [1] then（打印 4）
```

> **关键点**：`await 0` 也会产生微任务，而且**注册顺序在 `then` 之前**，所以 2 在 4 前面。

---

### 题 4：微任务里再产生微任务

```js
Promise.resolve().then(() => {
  console.log(1);
  Promise.resolve().then(() => console.log(2));
}).then(() => console.log(3));

setTimeout(() => console.log(4), 0);
console.log(5);
```

**答案**：`5 → 1 → 3 → 2 → 4`

**解析**：

```
同步：5

微任务队列初始：[A, B]
   A = () => { log(1); push(C) }
   B = () => log(3)

执行 A → 打印 1，把 C 加入队尾 → 队列 [B, C]
执行 B → 打印 3
执行 C → 打印 2

宏任务：4
```

> **关键点**：**同一轮微任务队列是 FIFO，新加入的排在队尾**。所以 3 在 2 前面，不是 2 在 3 前面。

---

### 题 5：`async` 函数里的 `return await`

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
// 输出？
```

**答案**：`a1 → b1 → a2`

**解析**：`b()` 是同步执行的（函数体里没有 `await`），所以 `b1` 立刻打印；`await` 只是把 `a2` 推迟到微任务。

---

## 4.8 本册答题模板汇总

### 4.8.1 一句话版

```
⑩ Promise 状态  → pending/fulfilled/rejected，单向不可逆，只认第一次
⑧ all/race      → all 全成功/一败即败；race 第一个 settled；allSettled 全等；
                  any 第一个成功
㉖ 并发 vs 串行  → await 串行 = 和；Promise.all = 最大值；forEach 里 await 无效
⑪ async/await   → async 包返回值；await 暂停当前函数 + 后续进微任务
⑫ await 做了什么 → Promise.resolve 包装 → 注册回调 → 让出线程（不阻塞）
㉑ 事件循环      → 一个宏任务 → 清空微任务 → 渲染 → 下一个宏任务
```

### 4.8.2 把六题串起来（面试收尾用）

> "这六题其实是一条链：
> **Promise 定状态** → **then 定规则**（链式 + 冒泡）→ **all/race 做组合** → **async/await 做语法糖** → **事件循环定时机**。
> 所有输出顺序题的答案，本质都回到同一句话：**同步先跑完，然后清空微任务，最后才轮到宏任务；微任务内部的顺序就是注册顺序，FIFO。**"

---

## 4.9 速记卡与连环追问

### 4.9.1 速记卡

```
【Promise 三态】pending → fulfilled / rejected，单向不可逆，只认第一次
               executor 同步执行；then 回调异步（微任务）

【then 四规则】
  ① 总是返回新 Promise
  ② 返回值/抛错决定新状态；返回 Promise 会展开
  ③ 非函数回调 → 值穿透（错误也穿透）
  ④ 回调永远异步

【四方法】
  all         全成功 / 一败即败（其余不停）    结果按传入顺序
  allSettled  等全部，永不 reject              [{status, value/reason}]
  race        第一个 settled                   空数组 → 永远 pending
  any         第一个 fulfilled / 全败 AggregateError

【并发 vs 串行】
  await a(); await b()            → 和
  Promise.all([a(), b()])         → 最大值（a() b() 传入时已启动）
  forEach(async ...)              → 不等待！用 for...of 或 Promise.all(map)

【async/await】
  async = 返回值包 Promise + 允许 await
  await = Promise.resolve 包装 + 暂停当前函数 + 后续进微任务
  await 123 也会异步；不阻塞主线程
  本质 = Generator + 自动执行器

【事件循环】
  一个宏任务 → 清空微任务（含新产生的）→ 渲染 → 下一个宏任务
  宏：script / setTimeout / setInterval / I/O / UI 事件 / MessageChannel
  微：Promise.then / queueMicrotask / MutationObserver / await 之后
  rAF 在渲染步骤，不是宏/微任务
  Node 6 阶段：timers → pending → idle/prepare → poll → check → close
  Node 优先级：nextTick > Promise
```

### 4.9.2 连环追问

| # | 追问 | 关键答点 |
|---|---|---|
| 1 | Promise 几种状态？ | 3 种，单向不可逆 |
| 2 | 能 resolve 两次吗？ | 不能，第二次被忽略 |
| 3 | executor 同步还是异步？ | 同步 |
| 4 | then 回调同步还是异步？ | 异步（微任务） |
| 5 | then 返回什么？ | 新 Promise |
| 6 | 值穿透是什么？ | 回调非函数时值直接透传 |
| 7 | 错误怎么冒泡？ | 没有 `onRejected` 就沿链往下传 |
| 8 | `catch` 和 `then(null, fn)` 区别？ | 等价 |
| 9 | `finally` 会改变结果吗？ | 不会（除非 `throw`） |
| 10 | `all` 一个失败其他会取消吗？ | 不会，需 `AbortController` |
| 11 | `all` 结果顺序？ | 传入顺序 |
| 12 | `race([])` 会怎样？ | 永远 pending |
| 13 | `any` 全失败抛什么？ | `AggregateError` |
| 14 | 怎么手写 `all`？ | 下标存 + 计数器 + 空数组边界 |
| 15 | 怎么实现超时？ | `race` + `setTimeout` |
| 16 | `await a(); await b()` 耗时？ | 和 |
| 17 | `Promise.all` 会启动任务吗？ | 不会，传入时已启动 |
| 18 | `forEach` 里 `await` 有效吗？ | 无效 |
| 19 | `map` 里 `async` 会等待吗？ | 不会，要 `Promise.all` |
| 20 | 怎么实现并发池？ | worker 模式 + 共享游标 |
| 21 | `cursor++` 为什么在 `await` 前？ | 避免竞态 |
| 22 | `async` 函数返回什么？ | Promise |
| 23 | `async` 里 `throw`？ | 返回 rejected |
| 24 | `await` 阻塞主线程吗？ | 不阻塞 |
| 25 | `await 123` 异步吗？ | 异步，仍延迟一个微任务 |
| 26 | `async/await` 和 Generator？ | 语法糖，靠自动执行器 |
| 27 | 顶层 `await` 限制？ | 只能 ESM |
| 28 | 宏任务有哪些？ | `script`、`setTimeout`、I/O、UI 事件 |
| 29 | 微任务有哪些？ | `then`、`queueMicrotask`、`MutationObserver` |
| 30 | 微任务会饿死宏任务吗？ | 会，无限递归会卡死 |
| 31 | `rAF` 属于什么？ | 渲染步骤，不是宏/微任务 |
| 32 | Node 6 阶段？ | `timers/pending/idle/poll/check/close` |
| 33 | `nextTick` 和 Promise 谁先？ | `nextTick` |
| 34 | `setImmediate` 和 `setTimeout(0)`？ | 主模块不确定，I/O 里 `immediate` 先 |
| 35 | 为什么长任务卡页面？ | 调用栈不清空，事件循环拿不到控制权 |
| 36 | Vue 的 `nextTick` 为什么能拿到新 DOM？ | 都是微任务，且排在 DOM 更新后 |
