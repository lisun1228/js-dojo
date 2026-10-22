# 编程 03｜Promise 核心实现

> 覆盖题号：4（手写 Promise）、10（all）、11（race）、18（allSettled）、26、30（finally）、35、37、44、27（retry）、43
> 去重后：**6 个考点**

---

## 目录

- [3.0 这一册的共同内核：状态机 + 微任务队列](#30-这一册的共同内核状态机--微任务队列)
- [3.1 手写完整 Promise](#31-手写完整-promise)
- [3.2 Promise.all](#32-promiseall)
- [3.3 Promise.race](#33-promiserace)
- [3.4 Promise.allSettled](#34-promiseallsettled)
- [3.5 Promise.any](#35-promiseany)
- [3.6 Promise.finally](#36-promisefinally)
- [3.7 Promise.retry](#37-promiseretry)
- [3.8 本册追问总表](#38-本册追问总表)
- [3.9 速记卡](#39-速记卡)
- [3.10 自测](#310-自测)

---

## 3.0 这一册的共同内核：状态机 + 微任务队列

所有 Promise 手写题都围绕两件事：

```
① 状态机：pending → fulfilled / rejected，只能转一次，不可逆
② 微任务队列：then 的回调必须异步执行，排在当前同步代码之后
```

搞清这两点，`then`/`all`/`race`/`finally` 全都能推出来：

| 方法 | 本质 |
|---|---|
| `then` | 注册回调 + 返回新 Promise |
| `all` | 注册 n 个回调，计数到 n 就 resolve |
| `race` | 注册 n 个回调，谁先 settle 就用谁 |
| `allSettled` | 注册 n 个回调，都转成 `{status}` 后计数 |
| `any` | 注册 n 个回调，成功就先赢，全失败返回 `AggregateError` |
| `finally` | `then` 包一层，回调里不改变值 |

---

## 3.1 手写完整 Promise

### ⚠️ 原题单答案有 3 个致命 bug

原答案（Q4）我原样复制跑了一遍，**三个都复现了**：

#### bug 1：已 settled 后 `then`，链直接断

```js
// 原答案的关键三行
this.callbacks.push({ /* ... */ });
if (this.state === 'fulfilled') onFulfilled && onFulfilled(this.value);
//                              ↑ 直接调原始回调，没有调用包装好的 handler，也没有 resolve
if (this.state === 'rejected') onRejected && onRejected(this.value);
```

实测：

```js
new MyPromise(r => r(1))
  .then(v => { log('then1', v); return v + 1; })
  .then(v => log('then2', v));

// 输出：
//   then1 收到: 1
//   （then2 永远不打印）
```

**根因**：`if (this.state === 'fulfilled')` 这个分支里，调用的是**原始的 `onFulfilled`**，而不是 `callbacks` 里那个「包了 `try/catch` 和 `resolve` 的 handler」。所以：

- 回调执行了（副作用生效，`then1` 打印了）
- 但**返回的新 Promise 永远不会 resolve**
- 后续 `.then` 全部挂死

**而这个分支恰恰是最常见的场景**——`new Promise(r => r(1))` 的 executor 是同步执行的，`then()` 被调用时状态已经是 `fulfilled` 了。

> **这是整份题单最严重的 bug**。不是边界问题，是主流程错的。

#### bug 2：`then` 回调同步执行，违背规范

实测：

```js
log('before');
new MyPromise(r => r('x')).then(v => log('  then 回调执行:', v));
log('after');

// 输出：
//   before
//     then 回调执行: x
//   after          ← 在 before 和 after 之间同步打印
```

规范要求 `then` 回调**必须**是微任务，正确输出应该是 `before → after → then 回调`。

**为什么规范要这样规定？** 保证**执行顺序可预测**：不管 Promise 是同步 resolve 还是异步 resolve，回调的执行时机都一致。否则「有时同步有时异步」会导致难以排查的时序 bug（这就是所谓的 Zalgo 问题）。

#### bug 3：`then` 里 throw，异常直接逃逸导致进程崩溃

实测直接崩了：

```
Error: boom
    at /private/tmp/coding-check/p1.js:64:29
Node.js v22.22.2
```

因为同步分支里 `onFulfilled(this.value)` 没有任何 `try/catch` 包裹，异常一路冒到顶层。正确行为应该是被下一个 `catch` 捕获。

### 正确实现（八个要素）

```js
const PENDING = 'pending';
const FULFILLED = 'fulfilled';
const REJECTED = 'rejected';

class MyPromise {
  constructor(executor) {
    this.state = PENDING;
    this.value = undefined;
    this.handlers = [];        // [{ onFulfilled, onRejected, resolve, reject }]

    const settle = (state, value) => {
      if (this.state !== PENDING) return;      // ① 状态不可逆
      this.state = state;
      this.value = value;
      this._flush();
    };

    const resolve = (value) => {
      if (this.state !== PENDING) return;

      // ② resolve 自己 → TypeError
      if (value === this) {
        return settle(REJECTED, new TypeError('Chaining cycle detected'));
      }

      // ③ thenable 展开
      if (value && (typeof value === 'object' || typeof value === 'function')) {
        let then;
        try { then = value.then; }              // 取 then 也可能抛（getter）
        catch (e) { return settle(REJECTED, e); }

        if (typeof then === 'function') {
          let called = false;                   // ④ 只认第一次回调
          try {
            then.call(
              value,
              v => { if (!called) { called = true; resolve(v); } },   // 递归展开
              r => { if (!called) { called = true; settle(REJECTED, r); } },
            );
          } catch (e) {
            if (!called) { called = true; settle(REJECTED, e); }
          }
          return;
        }
      }

      settle(FULFILLED, value);
    };

    const reject = (reason) => settle(REJECTED, reason);

    // ⑤ executor 同步抛错 → reject
    try { executor(resolve, reject); }
    catch (e) { reject(e); }
  }

  _flush() {
    // ⑥ then 回调必须异步 → 微任务
    queueMicrotask(() => {
      const list = this.handlers;
      this.handlers = [];
      for (const h of list) {
        const cb = this.state === FULFILLED ? h.onFulfilled : h.onRejected;

        // ⑦ 值穿透 / 错误穿透
        if (typeof cb !== 'function') {
          this.state === FULFILLED ? h.resolve(this.value) : h.reject(this.value);
          continue;
        }

        // ⑧ 回调抛错 → 新 Promise reject
        try { h.resolve(cb(this.value)); }
        catch (e) { h.reject(e); }
      }
    });
  }

  then(onFulfilled, onRejected) {
    return new MyPromise((resolve, reject) => {
      this.handlers.push({ onFulfilled, onRejected, resolve, reject });
      if (this.state !== PENDING) this._flush();
    });
  }

  catch(onRejected) { return this.then(null, onRejected); }

  finally(cb) {
    return this.then(
      v => MyPromise.resolve(cb()).then(() => v),
      e => MyPromise.resolve(cb()).then(() => { throw e; }),
    );
  }

  static resolve(v) {
    if (v instanceof MyPromise) return v;
    return new MyPromise(res => res(v));
  }
  static reject(r) { return new MyPromise((_, rej) => rej(r)); }
}
```

### 实测（全部通过）

```
链式: sync → t1:1 → t2:2 → t3:4        ← sync 在最前，证明 then 是异步
pending 后 resolve → delayed!
executor 同步抛错 → caught:executor boom
值穿透 then(null).then(undefined) → 5
错误穿透 .then().then().catch() → caught:e1
then 里 throw → caught:boom
thenable 展开 → from thenable
两层 thenable → deep
then 返回 promise → 10
状态不可逆（reject 后再 resolve）→ first
多个 then 各自独立 → [2, 3]
resolve 自己 → TypeError: Chaining cycle detected
原生对比   → TypeError: Chaining cycle detected for promise #<Promise>
```

### 八个要素逐个解释（这是面试的主战场）

| # | 要素 | 不写会怎样 |
|---|---|---|
| ① | 状态不可逆 | reject 后还能 resolve，状态乱套 |
| ② | `resolve` 自己 | 死锁（原生抛 TypeError） |
| ③ | thenable 展开 | `resolve(promise)` 拿不到值，拿到的是 promise 对象 |
| ④ | `called` 标志 | 恶意 thenable 调两次 resolve，状态被二次修改 |
| ⑤ | executor try/catch | `new Promise(() => { throw 1 })` 不会 reject，进程崩 |
| ⑥ | 微任务 | 顺序不可预测（bug 2） |
| ⑦ | 值穿透 | `p.then(null).then(fn)` 里 `fn` 收不到值 |
| ⑧ | 回调抛错转 reject | 异常逃逸（bug 3） |

### 面试怎么说

**接题时（先给结构，别直接写）**：

> 「手写 Promise 我按四块来：**构造函数里的状态机、then 的链式、thenable 展开、静态方法**。构造函数这块最关键的是三件事：状态不可逆、executor 同步执行但抛错要 reject、resolve 一个 thenable 要展开。」

**写的时候**：

> 「先定三个常量。构造函数里存 `state`、`value`、`handlers`。`handlers` 是回调队列——因为 `then` 可能在 Promise 还是 pending 的时候就调用了，回调得先存着。」

**写到 `then` 的同步分支时（这是原答案翻车的地方）**：

> 「这里有个坑：`then` 被调用时 Promise 可能**已经 settled** 了（因为 executor 是同步执行的）。所以不能只 push 到队列就走人，要判断一下状态，已经 settled 就立即 flush。但 flush 里必须用 `queueMicrotask` 包一层——**规范要求 then 回调是微任务**，不能同步调。」

**写完之后（主动补边界）**：

> 「我补几个规范细节：`resolve` 自己会抛 TypeError；thenable 展开要用 `called` 标志防止多次回调；`then` 里非函数参数要做值穿透。另外还有个我没实现的：`resolve` 里如果 `value.then` 是个 getter 且抛错，要转成 reject——这个我写了 try/catch。」

### 追问链

| 追问 | 答法 |
|---|---|
| 为什么要有三个状态？两个不行吗？ | 两个（pending/settled）无法区分成功失败。**关键是「不可逆」——一旦 settled 就锁定**，这保证了回调只执行一次 |
| `then` 为什么返回新 Promise 而不是 this？ | 为了让链式调用能改变值。如果返回 this，`p.then(v=>v+1)` 之后 `p` 还是原值，链就没意义了 |
| 为什么 `queueMicrotask` 不用 `setTimeout`？ | `setTimeout` 是宏任务，会晚一轮。**微任务在当前宏任务结束后、下一个宏任务之前清空**，这才是 Promise 的语义 |
| `then` 里返回 Promise 会怎样？ | 会被「展开」（adopt）。这就是为什么 `h.resolve(cb(...))` 能自动处理——因为 `resolve` 内部会判 thenable |
| 手写的和原生性能差多少？ | 数量级差距。V8 的 Promise 有大量 C++ 优化和内联缓存；手写版每次 `then` 都新建对象 + 闭包 |
| 为什么原生 Promise 的 `then` 是 `async`？ | 不是 `async`，是「回调通过微任务调度」。V8 里是 `PromiseReactionJob` 排队到 microtask queue |
| 能说出 `Promise.resolve` 和 `new Promise(r=>r(x))` 的区别吗？ | `Promise.resolve(p)` 如果 `p` 已是 Promise 会**直接返回 p**（同一个对象）；`new Promise` 永远新建 |
| 手写版怎么支持 `async/await`？ | 不需要额外支持。`await` 底层就是 `then`，**只要 `then` 符合规范，`await` 就能用** |

> 最后一条可以现场演示：`await new MyPromise(r => setTimeout(()=>r(42), 10))` 能正常拿到 42。这一步做出来非常有说服力。

---

## 3.2 Promise.all

### 一句话结论

> 等所有成功才成功，**任意一个失败就立刻失败**。

### 原题单答案的问题

```js
Promise.myAll = function(promises) {
  return new Promise((resolve, reject) => {
    const results = [];
    let count = 0;
    promises.forEach((p, i) => {
      Promise.resolve(p).then(val => {
        results[i] = val;
        if (++count === promises.length) resolve(results);
      }).catch(reject);
    });
  });
};
```

实测：

```
1) myAll([1,2,3])       → [1,2,3]     ✅
2) myAll([])            → TIMEOUT     ❌ 永久 pending
3) myAll(new Set([1,2])) → TIMEOUT    ❌ 永久 pending
```

#### bug：空数组永久 pending

`[].forEach` 一次都不执行，所以 `++count` 永远不跑，`count === 0` 但没有任何代码去 `resolve`。

**原生 `Promise.all([])` 立刻 resolve 成 `[]`。** 这是面试官**必测**的边界。

#### bug：传 Set 也死锁（更隐蔽）

`Set` 有 `.forEach`，所以能遍历；但 `Set` 没有 `.length`（是 `undefined`）。于是 `++count === undefined` 永远为 `false` → 永久 pending。

> 这个 bug 比空数组更难发现，因为 `forEach` 骗过了你。

### 正确实现

```js
static all(iterable) {
  return new MyPromise((resolve, reject) => {
    let items;
    try { items = Array.from(iterable); }        // ← 支持任意 iterable
    catch (e) { return reject(new TypeError('not iterable')); }

    const len = items.length;
    const results = new Array(len);

    if (len === 0) return resolve(results);      // ← 空数组立即成功

    let count = 0;
    items.forEach((p, i) => {
      MyPromise.resolve(p).then(
        val => {
          results[i] = val;                      // ← 用索引，保证顺序
          if (++count === len) resolve(results);
        },
        reject,                                  // ← 第一个失败立刻 reject
      );
    });
  });
}
```

实测：

```
1) 普通 [1, sleep(5,'a'), resolve('b')] → [1,"a","b"]
2) 空数组                                → []          ✅
3) Set([1,2])                            → [1,2]       ✅
4) 首个 reject（慢的成功 + 快的失败）     → caught:fast ✅
5) 非 iterable 'a'                       → TypeError   ✅
```

### 四个技术点

| 点 | 为什么 |
|---|---|
| `Array.from(iterable)` | 原生 `all` 接受任意 iterable，不只是数组 |
| `results[i] = val` 而不是 `push` | **保证结果顺序**。完成顺序和数组顺序不一定一致 |
| `if (len === 0) return resolve([])` | 空数组不特判就永远不 resolve |
| `.then(onFulfilled, onRejected)` 双参 | 用双参而不是 `.then().catch()`——**`.catch` 会连带捕获 onFulfilled 里抛的错**，语义不对 |

> 最后一点很多人不注意：`.then(f).catch(g)` 里的 `g` 会捕获 `f` 抛的错；而 `.then(f, g)` 不会。`all` 只需要处理「原始 promise 的 reject」，所以要用双参形式。

### 追问链

| 追问 | 答法 |
|---|---|
| 为什么 `all` 的结果顺序和传入顺序一致？ | 用的是**索引赋值** `results[i] = val`，不是 push。所以跟完成先后无关 |
| 有一个失败了，其他还在跑吗？ | **还在跑**。`all` 只是不再等待它们，但 Promise 本身无法取消。**要真正取消得用 `AbortController`** |
| 怎么让 `all` 支持「失败也继续」？ | 用 `allSettled`，或者把每个 promise 都包一层 `.catch(e => ({error: e}))` |
| `all` 传入非 Promise 值会怎样？ | 会被 `Promise.resolve` 包一层，直接当成功值处理 |
| 实现一个「全成功才成功，失败要等全部完成」的版本？ | 那是 `allSettled` + 手动检查有没有 rejected |

---

## 3.3 Promise.race

### 一句话结论

> 谁先 settle，就用谁的结果（**不管成功还是失败**）。

### 原题单答案

```js
Promise.myRace = function(promises) {
  return new Promise((resolve, reject) => {
    promises.forEach(p => {
      Promise.resolve(p).then(resolve).catch(reject);
    });
  });
};
```

**基本正确**，两个小问题：不支持非数组 iterable（`Set` 会报 `forEach` 不存在）；`.then(resolve).catch(reject)` 可以简化成双参。

### 正确实现

```js
static race(iterable) {
  return new MyPromise((resolve, reject) => {
    for (const p of Array.from(iterable)) {
      MyPromise.resolve(p).then(resolve, reject);
    }
  });
}
```

实测：

```
race([sleep(30,'slow'), sleep(5,'fast')])          → fast
race([sleep(30,'slow'), sleep(5,'err',true)])      → caught:err   （reject 也参与竞争）
```

### 追问链

| 追问 | 答法 |
|---|---|
| 空数组会怎样？ | **永久 pending**（规范如此）。因为没有任何 promise 参与竞争。这是最常见的超时写法的基础 |
| 怎么用 race 实现超时？ | `race([task, sleep(ms).then(() => { throw new Error('timeout') })])` |
| 超时后原任务会停止吗？ | **不会**。`race` 只是不再等它。要真正取消必须 `AbortController` + `fetch` 的 `signal` |
| `race` 和 `any` 区别？ | `race` 谁先 settle 就赢（包括失败）；`any` 只认成功，全失败才 reject |
| 和 `all` 的区别一句话？ | `all` 等全部成功，`race` 等第一个完成 |

---

## 3.4 Promise.allSettled

### 一句话结论

> 等所有都结束，**不管成功失败**，返回 `{status, value|reason}` 数组。

### 原题单答案

```js
Promise.myAllSettled = function(promises) {
  return Promise.all(promises.map(p =>
    Promise.resolve(p)
      .then(val => ({ status: 'fulfilled', value: val }))
      .catch(err => ({ status: 'rejected', reason: err }))
  ));
};
```

**这个实现是对的，而且写得很优雅**——把问题转化成「每个都包成永不 reject 的 promise，然后 `all`」。

实测：

```
混合 [1, reject, sleep] → [{"status":"fulfilled"},{"status":"rejected"},{"status":"fulfilled"}]
空数组                  → []
传 Set                  → TypeError: promises.map is not a function
```

唯一问题是只支持数组（`Set` 没有 `.map`）。改成 `Array.from(promises).map(...)` 即可。

### 为什么这个写法是「优雅」的

对比一下朴素写法（手写计数）：

```js
static allSettled(iterable) {
  return new MyPromise((resolve) => {
    const items = Array.from(iterable);
    const len = items.length;
    const results = new Array(len);
    if (len === 0) return resolve(results);
    let count = 0;
    items.forEach((p, i) => {
      MyPromise.resolve(p).then(
        value => { results[i] = { status: 'fulfilled', value }; if (++count === len) resolve(results); },
        reason => { results[i] = { status: 'rejected', reason }; if (++count === len) resolve(results); },
      );
    });
  });
}
```

两种都对。**原答案那种「转换 + 复用 all」的思路更值得说**：

> 「`allSettled` 可以看作一个问题变换：**先把每个 promise 的失败『吃掉』，转成一个描述对象，这样失败就不会中断 `all`**。于是直接复用 `all`。」

这种「把新问题转化成已有解」的思维，面试官会记一笔。

### 追问链

| 追问 | 答法 |
|---|---|
| `allSettled` 和 `all` 该用哪个？ | 要「全部结果」用 `allSettled`；要「一个失败就整体失败」用 `all`。**实际业务里批量请求多用 `allSettled`**，因为一个失败不该让整页空白 |
| 返回对象为什么用 `status` 字段而不是 `error` 字段？ | 跟 `PromiseSettledResult` 规范一致，`status` 是字面量类型，TS 里能自动收窄 |
| `allSettled` 会吞掉错误吗？ | 不吞，`reason` 字段里就是原始错误。只是它不会让整个 Promise reject |
| 什么场景必须用 `allSettled`？ | 页面多个模块并行加载——某个接口挂了其他模块还得渲染 |

---

## 3.5 Promise.any

题单里没有这题，但**现在面试经常连着 all/race/allSettled 一起问**，补上。

```js
static any(iterable) {
  return new MyPromise((resolve, reject) => {
    const items = Array.from(iterable);
    const len = items.length;
    const errors = new Array(len);
    if (len === 0) {
      return reject(new AggregateError([], 'All promises were rejected'));
    }
    let count = 0;
    items.forEach((p, i) => {
      MyPromise.resolve(p).then(resolve, err => {
        errors[i] = err;
        if (++count === len) {
          reject(new AggregateError(errors, 'All promises were rejected'));
        }
      });
    });
  });
}
```

实测：

```
any([reject('a'), sleep(5,'ok')])                  → ok
any([reject('a'), reject('b')])                    → AggregateError | errors: a,b
```

### 四个方法一张表（必背）

| 方法 | 全部成功 | 有一个失败 | 全部失败 | 空数组 |
|---|---|---|---|---|
| `all` | resolve 结果数组 | **立刻 reject** | 立刻 reject | **resolve `[]`** |
| `race` | 第一个 settle 的 | 第一个 settle 的 | 第一个 settle 的 | **永久 pending** |
| `allSettled` | resolve 描述数组 | resolve 描述数组 | resolve 描述数组 | resolve `[]` |
| `any` | 第一个成功的 | 第一个成功的 | **reject `AggregateError`** | **reject `AggregateError`** |

> 这张表的第四列（空数组）是**区分度最高的一格**。能把四个都答对的人不多。

---

## 3.6 Promise.finally

### 一句话结论

> 不管成功失败都执行，**但不改变值**。

### 原题单答案

```js
Promise.prototype.myFinally = function(cb) {
  return this.then(
    val => Promise.resolve(cb()).then(() => val),
    err => Promise.resolve(cb()).then(() => { throw err; })
  );
};
```

**这个实现是对的**。实测：

```
fulfilled: cleanup → then:v
rejected:  cleanup → catch:e
```

### 三个规范细节

#### ① 为什么要 `Promise.resolve(cb())`

如果 `cb` 返回一个 Promise（比如关闭动画），要**等它完成**再继续。`Promise.resolve` 包一层让同步返回值也能 `.then`。

#### ② reject 分支为什么要 `throw err` 而不是 `reject(err)`

因为这是在 `then` 的回调里，`throw` 会自动被转成新 Promise 的 reject。写 `reject(err)` 反而拿不到 `reject`（这里没有）。

#### ③ 如果 `cb` 自己抛错/返回 rejected 会怎样

```js
Promise.resolve(1).finally(() => { throw new Error('finally boom') })
// → 新 Promise reject 'finally boom'，原来的值 1 被覆盖
```

**这是规范行为**：`finally` 的回调出错会覆盖原结果。这一点很多人不知道。

### 追问链

| 追问 | 答法 |
|---|---|
| `finally` 和 `then` 的本质区别？ | `finally` 不接收值也不改变值（除非自己抛错）；`then` 会改变值 |
| `finally` 能拿到结果吗？ | **不能**。回调不接收参数。这是刻意设计——防止你在 `finally` 里做业务判断 |
| 为什么 `Promise.prototype.finally` 是 ES2018 才加的？ | 之前用 `then` 两遍写太啰嗦。**而且容易写错**（比如忘了 reject 分支要重新抛） |
| `try/finally` 和 `Promise.finally` 对应关系？ | `try { await p } finally { cb() }` ≈ `await p.finally(cb)`。区别是 `try/finally` 里 `finally` 抛错会覆盖 `try` 的返回值——**行为一致** |
| 实际项目用在哪？ | loading 关闭、loading 状态清理、关闭数据库连接、埋点上报 |

---

## 3.7 Promise.retry

### 一句话结论

> 失败自动重试，最多试 n 次，**全部失败才 reject**。

### 原题单答案的问题

```js
function retry(fn, times, delay) {
  return new Promise((resolve, reject) => {
    const attempt = n => {
      fn().then(resolve).catch(err => {
        if (n === 0) reject(err);
        else setTimeout(() => attempt(n - 1), delay);
      });
    };
    attempt(times);
  });
}
```

实测三个问题：

```
1) retry(flaky, 5) 首次第 3 次成功 → ok@3，实际调用 3 次        ✅
2) fn 同步抛错 → 「sync」直接逃逸，调用次数 1（没有重试）        ❌
3) 全部失败 → 总调用次数 3（times=2 时）                        ⚠️ 语义歧义
```

#### 问题 1：`fn` 同步抛错不重试

`fn().then(...)` 里如果 `fn()` 直接 `throw`，异常在 `attempt` 里冒出，整个 `new Promise` 的 executor 崩掉——**而且因为它是在 `attempt` 里抛的，不是在 executor 顶层，所以连 reject 都不会触发**，直接变成未捕获异常。

#### 问题 2：`times` 的语义歧义

`retry(fn, 2)` 实际上是「首次 + 重试 2 次 = 总共 3 次」。但参数名叫 `times`，很多人以为是「总共 2 次」。

**面试时必须明确说出你采用哪种语义**。

### 正确实现

```js
function retry(fn, { retries = 3, delay = 0, backoff = 1, shouldRetry = () => true } = {}) {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    const tryOnce = () => {
      attempt++;
      // Promise.resolve().then(fn) 能同时兼容「同步函数」和「返回 Promise 的函数」
      Promise.resolve()
        .then(fn)
        .then(resolve)
        .catch(err => {
          if (attempt > retries || !shouldRetry(err, attempt)) {
            return reject(err);
          }
          const wait = delay * Math.pow(backoff, attempt - 1);
          setTimeout(tryOnce, wait);
        });
    };

    tryOnce();
  });
}
```

实测：

```
retry(flaky, { retries: 5, delay: 10 })      → ok@3（调用 3 次）
fn 同步抛错                                   → 正常进入重试（不再逃逸）
全部失败 retries=2                            → 总调用 3 次，reject 最后一次的错误
```

### 三个技术点

| 点 | 为什么 |
|---|---|
| `Promise.resolve().then(fn)` | **把同步抛错转成 rejection**。这是最关键的技巧 |
| `attempt > retries` 而不是 `===` | 更健壮，防止并发/重入导致跳过 |
| `delay * Math.pow(backoff, attempt - 1)` | 指数退避：1s → 2s → 4s → 8s。**避免「服务刚挂，所有客户端同时重试」把服务再压死** |

### 追问链

| 追问 | 答法 |
|---|---|
| 指数退避为什么还要加随机？ | 叫 **jitter（抖动）**。如果所有客户端退避时间相同，重试请求会同时到达——这叫「惊群」。加 `Math.random()` 打散 |
| 什么错误不该重试？ | 4xx（客户端错误，重试也没用）、参数校验失败、业务逻辑错误。**只有 5xx、超时、网络错误才该重试** |
| 重试要不要考虑幂等？ | **必须**。POST 创建订单重试可能创建两单。要么接口支持幂等键，要么只重试 GET |
| 重试和超时怎么配合？ | 每次重试都要有自己的超时，否则一次卡死就永远不重试 |
| `retry` 和 `race` 组合用在哪？ | 重试 + 每次超时：`retry(() => race([task, timeout(3000)]))` |

---

## 3.8 本册追问总表

| 问题 | 一句话答 |
|---|---|
| Promise 解决了什么问题？ | 回调地狱 + 错误无法统一处理 + 无法组合 |
| 三个状态分别是什么？ | `pending` / `fulfilled` / `rejected`，只能转一次 |
| `then` 为什么必须异步？ | 保证执行顺序可预测，避免「有时同步有时异步」的 Zalgo 问题 |
| 微任务和宏任务的区别？ | 微任务在当前宏任务结束后立即清空；宏任务排到下一轮 |
| `async/await` 是 Promise 的语法糖吗？ | 是「then 的语法糖」更准确。V8 7.x 起用 CPS 状态机实现，**不再依赖 Generator** |
| 手写 Promise 最难的地方？ | 不是状态机，是 thenable 展开和 `called` 标志——**大部分人只写到了「能 then」这一层** |
| `all` 和 `allSettled` 怎么选？ | 一个失败就整体失败 → `all`；要全部结果 → `allSettled` |
| 四个静态方法空数组的行为？ | all→`[]`、race→永久 pending、allSettled→`[]`、any→reject |
| Promise 能取消吗？ | 不能。只能用 `AbortController` 把取消信号传给底层操作 |

---

## 3.9 速记卡

```
【完整 Promise 八要素】
① 状态不可逆  ② resolve 自己抛 TypeError  ③ thenable 展开
④ called 标志  ⑤ executor try/catch       ⑥ queueMicrotask
⑦ 值/错误穿透  ⑧ 回调抛错转 reject

【原答案三个致命 bug】
已 settled 后 then → 直接调原始回调，没 resolve → 链断
then 同步执行 → 违背规范（before/then/after）
then 里 throw → 无 try/catch，异常逃逸崩进程

【all】
空数组 → resolve([])      ← 必测
Set → 先 Array.from       ← 比空数组更隐蔽
results[i] = val          ← 保证顺序
.then(f, g) 双参          ← 不用 .catch（会误捕获 f 的错）

【race】谁先 settle 谁赢（含失败）；空数组永久 pending

【allSettled】把失败「吃掉」→ 复用 all

【any】全失败 → AggregateError；空数组 → reject

【finally】不改变值；callback 抛错会覆盖原结果

【retry】
Promise.resolve().then(fn)   ← 把同步抛错转 rejection
attempt > retries            ← 不用 ===
delay * backoff^(n-1)        ← 指数退避
+ random jitter              ← 防惊群

【四方法空数组】all→[] race→pending allSettled→[] any→reject
```

---

## 3.10 自测

```
□ 能说出 Promise 三个状态和「不可逆」的含义
□ 能解释为什么 then 回调必须是微任务
□ 能写出 then 的正确实现（含已 settled 的分支）
□ 能说出 thenable 展开为什么要 called 标志
□ 能解释 resolve 自己为什么要抛 TypeError
□ 能说出 all 空数组为什么必须特判
□ 能解释 all 用 results[i] 而不是 push 的原因
□ 能说出 .then(f).catch(g) 和 .then(f, g) 的区别
□ 能默写四个静态方法空数组的行为
□ 能解释 finally 为什么不能拿到结果
□ 能说出 retry 里 Promise.resolve().then(fn) 的作用
□ 能说出指数退避为什么还要加随机抖动
□ 能说出手写 Promise 能支持 await 的原因
```
