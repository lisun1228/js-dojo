# JS · 11 手写实现（下）· 异步与数据处理

> 覆盖：Promise 全实现、`Promise.all`、`Promise.retry`、并发限制、深拷贝、数组去重、扁平化、千分位、URL 解析、括号匹配、LRU
> 示例输出均为 Node 22 实跑结果；浏览器专属行为只做定性说明，不编造数字

---

## 目录

- [11.1 一句话结论](#111-一句话结论)
- [11.2 Promise 全实现](#112-promise-全实现)
- [11.3 `Promise.all`](#113-promiseall)
- [11.4 `Promise.retry`](#114-promiseretry)
- [11.5 并发限制](#115-并发限制)
- [11.6 深拷贝](#116-深拷贝)
- [11.7 数组去重](#117-数组去重)
- [11.8 数组扁平化](#118-数组扁平化)
- [11.9 千分位](#119-千分位)
- [11.10 URL 解析](#1110-url-解析)
- [11.11 括号匹配](#1111-括号匹配)
- [11.12 LRU](#1112-lru)
- [11.13 常见坑](#1113-常见坑)
- [11.14 答题模板](#1114-答题模板)
- [11.15 速记卡](#1115-速记卡)

---

## 11.1 一句话结论

这一组题的共同点是**都有「第一个版本能跑，但在边界上死」的坑**：

| 题 | 最容易漏的边界 |
|---|---|
| **Promise** | 状态不可逆、`then` 返回值递归吸收、异步执行、错误穿透 |
| **`Promise.all`** | **空数组永不 resolve** |
| **深拷贝** | 循环引用、`Map`/`Set`/`Date`/`RegExp`/`Symbol` |
| **去重** | `NaN`（`indexOf` 会丢）、`0`/`-0`、对象引用 |
| **扁平化** | `depth` 参数、栈溢出 |
| **千分位** | 小数、负数 |
| **URL 解析** | 重复 key、`+` 转空格、`decodeURIComponent`、`#` |
| **LRU** | `capacity = 0`、`put` 已存在的 key |

---

## 11.2 Promise 全实现

### 11.2.1 完整实现

```js
class MyPromise {
  static PENDING = 'pending';
  static FULFILLED = 'fulfilled';
  static REJECTED = 'rejected';

  constructor(executor) {
    this.state = MyPromise.PENDING;
    this.value = undefined;
    this.callbacks = [];            // 待执行的回调队列

    const resolve = (v) => this.settle(MyPromise.FULFILLED, v);
    const reject = (r) => this.settle(MyPromise.REJECTED, r);

    // ★ executor 同步执行，且要捕获同步 throw
    try {
      executor(resolve, reject);
    } catch (e) {
      reject(e);
    }
  }

  settle(state, value) {
    // ★ 状态不可逆
    if (this.state !== MyPromise.PENDING) return;

    // ★ resolve 一个 thenable 要「吸收」它
    if (state === MyPromise.FULFILLED && value && typeof value.then === 'function') {
      value.then(
        (v) => this.settle(MyPromise.FULFILLED, v),
        (r) => this.settle(MyPromise.REJECTED, r)
      );
      return;
    }

    this.state = state;
    this.value = value;
    this.flush();
  }

  flush() {
    const cbs = this.callbacks;
    this.callbacks = [];
    // ★ 必须异步执行（微任务），否则 then 的回调会比同步代码先跑
    queueMicrotask(() => cbs.forEach((cb) => cb()));
  }

  then(onFulfilled, onRejected) {
    return new MyPromise((resolve, reject) => {
      const handle = () => {
        const cb = this.state === MyPromise.FULFILLED ? onFulfilled : onRejected;

        // ★ 值穿透 / 错误穿透：cb 不是函数就原样传下去
        if (typeof cb !== 'function') {
          this.state === MyPromise.FULFILLED ? resolve(this.value) : reject(this.value);
          return;
        }

        try {
          const ret = cb(this.value);
          resolve(ret);         // ★ 如果 ret 是 Promise，会被上面的 thenable 逻辑吸收
        } catch (e) {
          reject(e);
        }
      };

      if (this.state === MyPromise.PENDING) this.callbacks.push(handle);
      else queueMicrotask(handle);      // 已 settled → 直接排微任务
    });
  }

  catch(onRejected) {
    return this.then(null, onRejected);
  }

  finally(cb) {
    // ★ finally 不改变值/错误（除非 cb 抛错）；cb 返回 Promise 时要等它完成
    return this.then(
      (v) => MyPromise.resolve(cb()).then(() => v),
      (r) => MyPromise.resolve(cb()).then(() => { throw r; }),
    );
  }

  static resolve(v) {
    return v instanceof MyPromise ? v : new MyPromise((res) => res(v));
  }

  static reject(r) {
    return new MyPromise((_, rej) => rej(r));
  }
}
```

### 11.2.2 六个关键点

| # | 点 | 不写会怎样 |
|---|---|---|
| **1** | **`executor` 同步执行** | 把 `executor` 放 `setTimeout` 里 → `new Promise` 后同步代码顺序错乱 |
| **2** | **`try/catch` 包 executor** | `executor` 里同步 `throw` 时 Promise 不会 reject |
| **3** | **状态不可逆** | 重复 `resolve` 会覆盖，`then` 触发两次 |
| **4** | **`then` 回调异步执行** | `promise.then(fn); console.log(x);` 会先打 `fn` 再打 `x`（顺序反了） |
| **5** | **`then` 返回值递归吸收** | `then` 里 `return Promise` 时，下一个 `then` 拿到的是 Promise 对象而不是值 |
| **6** | **值/错误穿透** | `.then(fn).then(fn2)` 中间没传 `onRejected` 时，原始错误会被换成 `TypeError: cb is not a function` |

**第 4 点为什么用 `queueMicrotask` 而不是 `setTimeout(fn, 0)`**：

- `setTimeout` 是**宏任务**，会在下一轮事件循环
- 原生 Promise 用的是**微任务**，必须用 `queueMicrotask`（或 `process.nextTick` / `MutationObserver`）

两者都是微任务，顺序只由注册先后决定；换成 `setTimeout` 就晚一个宏任务：

```js
new MyPromise((r) => r(1)).then(() => log('mine'));
Promise.resolve().then(() => log('native'));
// mine → native；若 flush 改用 setTimeout，则 native → mine
```

### 11.2.3 实测验证

```
then1: ok           ← 异步 resolve 后能正确走 then
then2: ok!
catch: boom         ← 链中抛错被 catch
恢复: recovered     ← catch 返回新值后链继续
MyPromise.all([]): []
MyPromise.all([1, MyPromise.resolve(2)]): [1, 2]
all reject: x
```

### 11.2.4 追问：为什么 `then` 要返回新 Promise

```js
const p1 = Promise.resolve(1);
const p2 = p1.then(v => v + 1);
p1 === p2;        // false
```

**因为要支持链式调用**：每个 `then` 返回的 Promise 的**状态由回调的返回值决定**。如果返回同一个 Promise，就无法表达「链上每一步的新状态」。

---

## 11.3 `Promise.all`

### 11.3.1 实现

```js
static all(list) {
  return new MyPromise((resolve, reject) => {
    const arr = [...list];              // ★ 支持任何可迭代对象
    const len = arr.length;

    // ★★ 空数组必须立即 resolve（最常漏的一行）
    if (len === 0) return resolve([]);

    const results = new Array(len);
    let count = 0;

    arr.forEach((p, i) => {
      // ★ 用 Promise.resolve 包一层，支持普通值
      MyPromise.resolve(p).then((v) => {
        results[i] = v;                 // ★ 按【索引】写，不是 push
        if (++count === len) resolve(results);
      }, reject);                       // ★ 用第二个参数，不是 .catch
    });
  });
}
```

### 11.3.2 三个细节

**① 空数组**

空数组时 `forEach` 一次都不执行，没有任何代码调用 `resolve` → 永久 pending。所以必须先判 `len === 0`。

**② 稀疏数组不用改成 `for`**

`[...list]` 展开时会把空位变成 `undefined`，`forEach` 照常遍历 3 次，结果与原生一致：

```js
const sparse = [Promise.resolve(1), , Promise.resolve(3)];
MyPromise.all(sparse);   // [1, undefined, 3]
Promise.all(sparse);     // [1, undefined, 3]
```

**③ `results[i] = v` 而不是 `push`**

**Promise 完成的顺序是不确定的**，但结果必须按输入顺序排列：

```js
Promise.all([slow(100), fast(10)]);
// 结果必须是 [slow 的值, fast 的值]，不是 [fast 的值, slow 的值]
```

### 11.3.3 追问：`all` 是「快速失败」，其他 Promise 停了吗

**没停。**

```js
const p1 = fetch('/a');       // 慢请求
const p2 = fetch('/b');       // 先失败
Promise.all([p1, p2]).catch(() => {});

// p1 仍然会跑完，只是结果没人要了
```

**要真正取消**必须 `AbortController`：

```js
const ac = new AbortController();
Promise.all([
  fetch('/a', { signal: ac.signal }),
  fetch('/b', { signal: ac.signal }),
]).catch(() => ac.abort());
```

### 11.3.4 相关的三个方法

```js
// allSettled：全部结束，永不 reject
static allSettled(list) {
  return MyPromise.all([...list].map((p) =>
    MyPromise.resolve(p).then(
      (value) => ({ status: 'fulfilled', value }),
      (reason) => ({ status: 'rejected', reason })
    )
  ));
}

// any：第一个成功；全失败则 AggregateError
static any(list) {
  return new MyPromise((resolve, reject) => {
    const arr = [...list];
    if (arr.length === 0) return reject(new AggregateError([], 'All promises were rejected'));
    const errors = [];
    let rejected = 0;
    arr.forEach((p, i) => {
      MyPromise.resolve(p).then(resolve, (e) => {
        errors[i] = e;
        if (++rejected === arr.length) reject(new AggregateError(errors, 'All promises were rejected'));
      });
    });
  });
}

// race：第一个 settled
static race(list) {
  return new MyPromise((resolve, reject) => {
    for (const p of list) MyPromise.resolve(p).then(resolve, reject);
  });
}
```

**四个方法的空数组行为**（面试高频）：

| 方法 | `[]` 的结果 |
|---|---|
| `all` | `[]` |
| `allSettled` | `[]` |
| `any` | **立即 reject `AggregateError`** |
| `race` | **永久 pending** |

---

## 11.4 `Promise.retry`

### 11.4.1 实现

```js
function retry(fn, times = 3, delay = 0) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      Promise.resolve()
        .then(fn)                 // ★ 用 .then 包一层，捕获 fn 的同步 throw
        .then(resolve)
        .catch((err) => {
          if (n <= 0) return reject(err);
          setTimeout(() => attempt(n - 1), delay);
        });
    };
    attempt(times);
  });
}
```

**实测**：

```js
let n = 0;
await retry(() => { if (++n < 3) throw new Error('fail' + n); return 'success after ' + n; }, 5);
// 'success after 3'  ✅ 第 3 次成功
```

### 11.4.2 三个设计点

**① `Promise.resolve().then(fn)` 而不是直接 `fn()`**

```js
// ❌ fn 同步 throw 时，catch 抓不到（在 Promise 外面）
const attempt = (n) => {
  const ret = fn();              // 同步 throw 直接跳出
  ret.then(resolve).catch(...);
};

// ✅ 包进 Promise 链
Promise.resolve().then(fn).then(resolve).catch(...);
```

**② `times` 的语义**

```js
retry(fn, 3)     // 总共尝试几次？
// 本实现：attempt(3) → 失败 attempt(2) → 失败 attempt(1) → 失败 attempt(0) → reject
// 即：初始 1 次 + 重试 3 次 = 4 次
```

**面试时要澄清**：「`times` 是总次数还是重试次数？」——**这个澄清是加分项**。

**③ 指数退避**

```js
function retry(fn, times = 3, baseDelay = 100) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      Promise.resolve().then(fn).then(resolve).catch((err) => {
        if (n <= 0) return reject(err);
        const delay = baseDelay * 2 ** (times - n);      // ★ 指数退避
        const jitter = Math.random() * 100;              // ★ 抖动防惊群
        setTimeout(() => attempt(n - 1), delay + jitter);
      });
    };
    attempt(times);
  });
}
```

---

## 11.5 并发限制

### 11.5.1 实现

```js
async function asyncPool(limit, items, iteratorFn) {
  const ret = [];                    // 所有 Promise（保持顺序）
  const executing = new Set();       // 正在执行的

  for (const item of items) {
    // ★ 用 Promise.resolve().then 包一层，让 iteratorFn 异步启动
    const p = Promise.resolve().then(() => iteratorFn(item));
    ret.push(p);

    // ★ race 只看「不会 reject」的副本，否则一个失败就中断后续入队
    const slot = p.catch(() => {});
    executing.add(slot);
    slot.then(() => executing.delete(slot));

    // ★ 达到上限就等「任意一个完成」
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  return Promise.all(ret);
}
```

**实测**：

```
6 个任务，limit=2，每个耗时 50ms
→ 总耗时约 152ms（期望 3 批 × 50ms = 150ms）
→ 最大并发 2
```

### 11.5.2 四个关键点

| 点 | 说明 |
|---|---|
| **① `Promise.resolve().then(() => iteratorFn(item))`** | 让 `iteratorFn` 在**微任务**里启动，避免同步执行导致 `executing` 状态不对 |
| **② `executing` 里放 `p.catch(() => {})` 的副本** | 直接放 `p` 的话，失败会让 `Promise.race` 抛错，循环中断 |
| **③ `slot.then(() => executing.delete(slot))`** | 任务结束后从 `executing` 里删掉，空出并发位 |
| **④ `await Promise.race(executing)`** | 等「任意一个完成」，不是等全部 |

### 11.5.3 追问：为什么不用 `Promise.all` 分批

```js
// ❌ 分批：每批都要等最慢的那个
for (let i = 0; i < items.length; i += limit) {
  await Promise.all(items.slice(i, i + limit).map(iteratorFn));
}
```

**问题**：如果一批里有一个特别慢，整批都在等，**并发数没跑满**。

**`asyncPool` 的 `Promise.race` 方案**：每完成一个就补一个，**始终保持 `limit` 个在跑**。

### 11.5.4 追问：怎么控制「失败不中断」

真正中断入队的不是 `Promise.all(ret)`，而是 `await Promise.race(executing)`：如果直接把 `p` 放进 `executing`，失败的 promise 会让 race 跟着 reject，循环抛出，后面的 item 根本没启动。

实测（limit=2，第 2 个任务 10ms 失败、其余 50ms）：只有 `1, 2` 启动了。

修法就是上面的 `p.catch(() => {})`：race 只看不会 reject 的副本，循环继续补位；`ret` 里仍是原始 promise，最后的 `Promise.all(ret)` 照常把失败抛出来。

要让失败也继续，就换成 `Promise.allSettled(ret)`：

```js
const results = await Promise.allSettled(ret);
```

**或者改 `iteratorFn` 自己 catch**：

```js
asyncPool(limit, items, async (item) => {
  try { return await doWork(item); }
  catch (e) { return { error: e }; }
});
```

---

## 11.6 深拷贝

### 11.6.1 四种方案的对比

| 方案 | 能否拷贝嵌套 | 循环引用 | 特殊对象 | 函数 | 评价 |
|---|---|---|---|---|---|
| **`{ ...obj }` / `Object.assign`** | ❌ 浅 | — | — | ✅ 复制引用 | 只做浅拷贝 |
| **`JSON.parse(JSON.stringify(x))`** | ✅ | ❌ **抛错** | ❌ 全丢 | ❌ 丢 | 简单场景 |
| **`structuredClone`** | ✅ | ✅ | ✅ 支持 `Map`/`Set`/`Date` | ❌ 抛错 | **现代首选** |
| **手写递归** | ✅ | ✅（用 WeakMap） | ✅ 可控 | 看实现 | **面试要考** |

### 11.6.2 `JSON` 方案的丢失（实测）

```js
const src = { d: new Date(0), r: /a/g, m: new Map([['k',1]]), s: new Set([1]), f() {}, u: undefined, sym: Symbol('x') };
const copy = JSON.parse(JSON.stringify(src));

Object.keys(copy);      // ['d', 'r', 'm', 's']  ← f/u/sym 全丢了
typeof copy.d;          // 'string'   ← Date 变成 ISO 字符串
typeof copy.r;          // 'object'   ← RegExp 变成 {}
copy.m;                 // {}         ← Map 变成空对象
copy.s;                 // {}
'u' in copy;            // false      ← undefined 被忽略
'sym' in copy;          // false      ← Symbol 键被忽略
```

**还有两个**：

```js
// 循环引用直接抛错
const a = {}; a.self = a;
JSON.parse(JSON.stringify(a));   // TypeError: Converting circular structure to JSON

// NaN 变成 null
JSON.stringify({ x: NaN });      // '{"x":null}'
```

### 11.6.3 手写完整版

```js
function deepClone(obj, cache = new WeakMap()) {
  // ① 原始值和函数直接返回（函数没必要拷贝）
  if (obj === null || typeof obj !== 'object') return obj;

  // ② 循环引用：已经拷过就返回缓存
  if (cache.has(obj)) return cache.get(obj);

  let result;
  const tag = Object.prototype.toString.call(obj);

  // ③ 特殊对象单独处理
  if (tag === '[object Date]') {
    result = new Date(obj.getTime());
  } else if (tag === '[object RegExp]') {
    result = new RegExp(obj.source, obj.flags);
    result.lastIndex = obj.lastIndex;      // ★ 保留 lastIndex（有 g/y 标志时有效）
  } else if (tag === '[object Map]') {
    result = new Map();
    cache.set(obj, result);                // ★ 先存缓存再递归（防循环）
    obj.forEach((v, k) => result.set(deepClone(k, cache), deepClone(v, cache)));
    return result;
  } else if (tag === '[object Set]') {
    result = new Set();
    cache.set(obj, result);
    obj.forEach((v) => result.add(deepClone(v, cache)));
    return result;
  } else if (tag === '[object Array]') {
    result = [];
  } else {
    // ④ 保留原型（支持 class 实例，方法是原型上的引用，不需要拷贝）
    result = Object.create(Object.getPrototypeOf(obj));
  }

  cache.set(obj, result);                  // ★ 必须在遍历属性【之前】设置

  // ⑤ 用 Reflect.ownKeys 才能拿到 Symbol 键 + 不可枚举键
  for (const key of Reflect.ownKeys(obj)) {
    result[key] = deepClone(obj[key], cache);
  }

  return result;
}
```

### 11.6.4 五个关键点

| # | 点 | 说明 |
|---|---|---|
| **1** | **`WeakMap` 缓存循环引用** | `cache.set` 必须在**递归子属性之前** |
| **2** | **`Object.prototype.toString.call`** | 能跨 realm（`instanceof` 不能）；但会被 `Symbol.toStringTag` 伪造，不能当绝对可靠的类型判断 |
| **3** | **`Reflect.ownKeys`** | 能拿到 Symbol 键和不可枚举键；`Object.keys` 拿不到 |
| **4** | **`Object.create(Object.getPrototypeOf(obj))`** | 保留原型，class 实例拷完还是那个类 |
| **5** | **`Map`/`Set` 要先 `cache.set` 再递归** | 否则 `Map` 里自引用会死循环 |

**第 5 点最容易错**：

```js
// ❌ 错：先递归后缓存 → Map 自引用死循环
result = new Map();
obj.forEach((v, k) => result.set(k, deepClone(v, cache)));   // deepClone 里查 cache 查不到
cache.set(obj, result);

// ✅ 对：先缓存
result = new Map();
cache.set(obj, result);
obj.forEach((v, k) => result.set(k, deepClone(v, cache)));
```

### 11.6.5 实测验证

```
日期: true（instanceof Date）| 正则: /a/gi，lastIndex: 0
Map 内部对象不是同一引用: true
Set: 2 | 循环引用: true（copy.self === copy）
Symbol 键: 9（Reflect.ownKeys 拿到了）
嵌套数组不同引用: true
```

### 11.6.6 追问：`structuredClone` 什么时候不能用

```js
const copy = structuredClone(obj);
```

**优点**：原生、快、支持循环引用和大部分内置类型。
**五个限制**：

| 限制 | 说明 |
|---|---|
| **不能拷函数** | 函数值抛 `DataCloneError` |
| **不能拷 Symbol 值** | 抛 `DataCloneError` |
| **Symbol 键** | 不报错，直接被丢弃 |
| **不能拷 DOM 节点** | 抛错 |
| **不保留原型** | class 实例变成普通对象，`instanceof` 为 `false` |

**所以「需要保留类原型」或「要拷函数 / Symbol」时，还得手写。**

---

## 11.7 数组去重

### 11.7.1 五种实现与实测结果

```js
// ① Set（推荐）
const bySet = (arr) => [...new Set(arr)];

// ② filter + indexOf（O(n²)，会丢 NaN）
const byIndexOf = (arr) => arr.filter((v, i, a) => a.indexOf(v) === i);

// ③ filter + includes（O(n²)，用 SameValueZero，能保留 NaN）
const byIncludes = (arr) => arr.filter((v, i, a) => !a.slice(0, i).includes(v));

// ④ Map（O(n)，能保留 NaN）
const byMap = (arr) => {
  const m = new Map();
  return arr.filter((v) => !m.has(v) && m.set(v, 1));
};

// ⑤ 按 key 去重（对象数组）
const byKey = (arr, keyFn) => {
  const seen = new Set();
  return arr.filter((v) => {
    const k = keyFn(v);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};
```

**实测**（输入 `[1, 1, '1', NaN, NaN, null, null, {a:1}, {a:1}]`）：

| 方法 | 结果 | 说明 |
|---|---|---|
| **`Set`** | `[1, '1', NaN, null, {a:1}, {a:1}]` | 6 个；`NaN` 保留，**两个对象不合并** |
| **`indexOf`** | `[1, '1', null, {a:1}, {a:1}]` | **5 个；NaN 全丢** ⚠️ |
| **`includes`** | `[1, '1', NaN, null, {a:1}, {a:1}]` | 6 个（修正了 `NaN`） |
| **`Map`** | 同 `Set` | 6 个 |

**核心结论**：

| 差异点 | `Set` / `Map` / `includes` | `indexOf` |
|---|---|---|
| **判断相等用什么** | `SameValueZero` | `===` |
| **`NaN` 能去重吗** | ✅ 保留一个 | ❌ **全部丢弃** |
| **`0` / `-0`** | 合并成一个 | 合并成一个（`===` 认为相等） |

**所以「数组去重」绝不能只用 `indexOf`**——`[NaN, NaN]` 会变成 `[]`。

### 11.7.2 对象数组去重（真实场景）

```js
// 按 id 去重
const users = [
  { id: 1, name: 'a' },
  { id: 2, name: 'b' },
  { id: 1, name: 'c' },
];

// ✅ 保留最后一个：Map 里同 key 后写入的会覆盖先写入的
const uniqueLast = [...new Map(users.map((u) => [u.id, u])).values()];
// [{id:1,name:'c'}, {id:2,name:'b'}]

// ✅ 保留第一个：只留下某个 id 首次出现的位置
const uniqueFirst = users.filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i);
// [{id:1,name:'a'}, {id:2,name:'b'}]
```

**为什么不能直接用 `Set`**：`Set` 对对象是引用比较，`{id:1}` 和 `{id:1}` 是两个不同的对象。

**⚠️ 一个陷阱**：`byKey` 的 key 函数如果用 `String(v)`，`1` 和 `'1'` 会被当成同一个 key；如果用 `JSON.stringify`，属性顺序不同的等价对象会得到不同 key，反而合并不了。

```js
// ❌ 冲突
byKey([1, '1'], String);            // 只保留 1

// ✅ 类型安全
byKey([1, '1'], (v) => `${typeof v}:${v}`);
```

---

## 11.8 数组扁平化

### 11.8.1 递归版（最直观）

```js
function flatten(arr, depth = Infinity) {
  const res = [];
  (function walk(list, d) {
    for (const item of list) {
      if (Array.isArray(item) && d > 0) walk(item, d - 1);
      else res.push(item);
    }
  })(arr, depth);
  return res;
}
```

### 11.8.2 迭代版（防栈溢出）

**⚠️ 用 `push(...)` + `reverse()` 的写法容易写错顺序**。推荐「显式栈 + 索引」：

```js
function flattenIter(arr, depth = Infinity) {
  const res = [];
  const stack = [{ list: arr, i: 0, d: depth }];

  while (stack.length) {
    const top = stack[stack.length - 1];

    // 当前层遍历完了，弹出
    if (top.i >= top.list.length) {
      stack.pop();
      continue;
    }

    const v = top.list[top.i++];

    if (Array.isArray(v) && top.d > 0) {
      stack.push({ list: v, i: 0, d: top.d - 1 });   // 进下一层
    } else {
      res.push(v);
    }
  }
  return res;
}
```

**这个写法能保证顺序正确**，因为它模拟了递归的「深度优先 + 从左到右」。

**实测**：

```
输入 [1, [2, [3, [4, [5]]]]]
递归 Infinity  → [1,2,3,4,5]     ✅
递归 depth=1   → [1,2,[3,[4,[5]]]]  ✅（只展开一层）
迭代 Infinity  → [1,2,3,4,5]     ✅
空数组         → []
无嵌套         → [1,2,3]
```

**「reverse 后 push」的写法很容易把顺序写反**，优先用上面的「索引栈」。

### 11.8.3 原生 `flat`

```js
[1, [2, [3]]].flat();        // [1, 2, [3]]  默认 depth=1
[1, [2, [3]]].flat(2);       // [1, 2, 3]
[1, [2, [3]]].flat(Infinity);  // [1, 2, 3]
```

**`flat` 会移除空位**：

```js
[1, , 3].flat();      // [1, 3]  ← 空位被移除
```

**`flatMap` = `map` + `flat(1)`**：

```js
[1, 2].flatMap(x => [x, x * 2]);   // [1, 2, 2, 4]
```

---

## 11.9 千分位

### 11.9.1 五种实现

```js
// ① 正则（最简洁）
const regex = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// ② 正则 + 小数
const regexDecimal = (n) => {
  const [int, dec] = String(n).split('.');
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (dec ? '.' + dec : '');
};

// ③ 循环（要处理负数！）
const loop = (n) => {
  const s = String(n);
  const sign = s.startsWith('-') ? '-' : '';
  const [int, dec] = s.replace('-', '').split('.');
  let r = '';
  for (let i = 0; i < int.length; i++) {
    if (i > 0 && (int.length - i) % 3 === 0) r += ',';
    r += int[i];
  }
  return sign + r + (dec ? '.' + dec : '');
};

// ④ toLocaleString
const locale = (n) => n.toLocaleString('en-US');

// ⑤ Intl.NumberFormat
const intl = (n) => new Intl.NumberFormat('en-US').format(n);
```

**实测**（`1234567.891`）：`1,234,567.891`（五种都对）

### 11.9.2 正则怎么读

```js
/\B(?=(\d{3})+(?!\d))/g
```

| 部分 | 含义 |
|---|---|
| **`\B`** | **非单词边界**（保证不在开头插入逗号） |
| **`(?=...)`** | 正向先行断言（**零宽**，不消耗字符） |
| **`(\d{3})+`** | 后面有 3 的倍数个数字 |
| **`(?!\d)`** | 且后面不再有数字（即「正好到末尾」） |
| **`g`** | 全局替换 |

**合起来**：**在每个「后面跟着 3n 个数字且到结尾」的位置插入逗号。**

### 11.9.3 两个坑

**① 小数会被错误分组**

```js
String(1234567.891).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
// '1,234,567.891'  ← 这里碰巧对了（因为 . 打断了 \d）
// 但 '1234.5678' 会怎样？
String(1234.5678).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
// '1,234.5,678'  ← ❌ 小数部分也被分组了！
```

**所以处理小数必须用 `regexDecimal`（先拆分整数和小数）。**（`toLocaleString` / `Intl` 默认最多保留 3 位小数：`1234.5678` → `1,234.568`）

**② 负数要先剥符号**

```js
// ❌ 不剥负号的循环版
for (let i = 0; i < int.length; i++) { if (i > 0 && (int.length - i) % 3 === 0) r += ','; }
// 输入 -123456 → '-,123,456'  ← 负号被当成数字位了！
```

**实测**：不剥符号时 `-123456` 得到 `-,123,456`（错），`-1234567` 碰巧得到 `-1,234,567`（对）；上面的 `loop` 先剥符号，两个都得到 `-123,456` / `-1,234,567`。

**这种「有时候对」的 bug 最危险**——必须显式剥离符号。

---

## 11.10 URL 解析

### 11.10.1 手写版

```js
function parseQuery(url) {
  const qIndex = url.indexOf('?');
  if (qIndex === -1) return {};

  // ★ 要排除 hash 部分
  const hashIndex = url.indexOf('#', qIndex);
  const qs = url.slice(qIndex + 1, hashIndex === -1 ? undefined : hashIndex);

  const res = {};
  for (const pair of qs.split('&')) {
    if (!pair) continue;

    // ★ 按第一个 = 切分，值里可能还有 =（如 base64）
    const eq = pair.indexOf('=');
    const k = eq === -1 ? pair : pair.slice(0, eq);
    const v = eq === -1 ? '' : pair.slice(eq + 1);
    const key = decodeURIComponent(k);
    // ★ + 要还原成空格（表单编码规则）
    const val = decodeURIComponent(v.replace(/\+/g, ' '));

    // ★ 重复 key 变数组；必须用 hasOwnProperty，`in` 会命中原型链
    if (Object.prototype.hasOwnProperty.call(res, key)) res[key] = [].concat(res[key], val);
    else res[key] = val;
  }
  return res;
}
```

**实测**：

```js
parseQuery('https://a.com/p?a=1&b=%E4%B8%AD&c=x+y&a=2#hash')
// { a: ['1', '2'], b: '中', c: 'x y' }

parseQuery('https://a.com/p?token=YWJjZA==&empty&constructor=1')
// { token: 'YWJjZA==', empty: '', constructor: '1' }
```

### 11.10.2 六个关键点

| # | 点 | 不处理会怎样 |
|---|---|---|
| **1** | **排除 `#hash`** | `a=1#hash` 会把 `1#hash` 当成值 |
| **2** | **`+` 还原成空格** | `c=x+y` 会得到 `'x+y'` 而不是 `'x y'` |
| **3** | **`decodeURIComponent`** | 中文保持 `%E4%B8%AD` |
| **4** | **重复 key 变数组** | 后一个覆盖前一个 |
| **5** | **用 `indexOf('=')` 切分** | `split('=')` 只取第二段，`token=YWJjZA==` 会丢掉末尾的 `==` |
| **6** | **用 `hasOwnProperty.call` 判重** | `key in res` 会命中原型链，`?constructor=1` 会把 `Object` 当成旧值进数组 |

**第 2 点最容易漏**：`application/x-www-form-urlencoded` 规范里，空格编码成 `+`（不是 `%20`）。所以解析时要先替换。

### 11.10.3 原生 API（现代首选）

```js
// ① 只解析 query
const params = new URLSearchParams('a=1&b=中&c=x+y');
params.get('a');            // '1'
params.get('c');            // 'x y'   ← 原生已处理 +
params.getAll('a');         // ['1']（重复 key 用 getAll）
Object.fromEntries(params); // { a: '1', b: '中', c: 'x y' }

// ② 完整 URL 解析
const u = new URL('https://a.com:8080/p?x=1#h');
u.protocol;      // 'https:'
u.hostname;      // 'a.com'
u.port;          // '8080'
u.pathname;      // '/p'
u.search;        // '?x=1'
u.hash;          // '#h'
u.origin;        // 'https://a.com:8080'
u.searchParams.get('x');   // '1'
```

**`URLSearchParams` 的三个优势**：

| 优势 | 说明 |
|---|---|
| **自动处理 `+` 和编码** | 不用手写 `decodeURIComponent` |
| **`getAll` 处理重复 key** | 比手动变数组清晰 |
| **支持 `set`/`append`/`delete`/`sort`** | 能修改 query |

**所以面试时**：**手写版证明你懂原理，但要说「生产环境用 `URLSearchParams`」**——这才是加分。

---

## 11.11 括号匹配

### 11.11.1 实现（栈）

```js
function isBalanced(s) {
  const map = { ')': '(', ']': '[', '}': '{' };
  const stack = [];

  for (const ch of s) {
    if ('([{'.includes(ch)) {
      stack.push(ch);                         // 左括号入栈
    } else if (ch in map) {
      // ★ 右括号：栈为空 或 栈顶不匹配 → false
      if (stack.pop() !== map[ch]) return false;
    }
    // 其他字符忽略（比如字母）
  }

  return stack.length === 0;                  // ★ 栈必须为空
}
```

**实测**：

| 输入 | 结果 |
|---|---|
| `'()'` | ✅ true |
| `'()[]{}'` | ✅ true |
| `'(]'` | ❌ false |
| `'([)]'` | ❌ false（交叉嵌套） |
| `''` | ✅ true |
| `'((())'` | ❌ false（缺右括号） |
| `'a(b)c'` | ✅ true（忽略字母） |

### 11.11.2 三个关键点

**① `stack.pop() !== map[ch]` 一行搞定了两种情况**

- 栈为空时 `pop()` 返回 `undefined`，`undefined !== '('` → false ✅
- 栈顶不匹配时 → false ✅

**② 最后必须判 `stack.length === 0`**

`'((('` 遍历完栈里还有 3 个，但没触发任何 `return false`。**如果不判，会误判为 true。**

**③ 要忽略非括号字符**

`'a(b)c'` 应该返回 true。如果只处理括号字符，`else if` 那支不进入，自然就忽略了。

### 11.11.3 追问：如果要返回具体位置

```js
function findMismatch(s) {
  const map = { ')': '(', ']': '[', '}': '{' };
  const stack = [];       // 存 { ch, index }

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if ('([{'.includes(ch)) stack.push({ ch, index: i });
    else if (ch in map) {
      const top = stack.pop();
      if (!top || top.ch !== map[ch]) return { index: i, char: ch };
    }
  }
  if (stack.length) return { index: stack[stack.length - 1].index, char: stack[stack.length - 1].ch };
  return null;
}
```

**复杂度的自觉**：时间 O(n)，空间 O(n)（最坏全是左括号）。

---

## 11.12 LRU

### 11.12.1 `Map` 版（最简洁）

```js
class LRU {
  constructor(cap) {
    this.cap = cap;
    this.map = new Map();
  }

  get(k) {
    if (!this.map.has(k)) return -1;
    const v = this.map.get(k);
    // ★ 删了再插 = 移到末尾（标记为最近使用）
    this.map.delete(k);
    this.map.set(k, v);
    return v;
  }

  put(k, v) {
    if (this.cap <= 0) return;              // ★ capacity=0 边界
    if (this.map.has(k)) {
      this.map.delete(k);                   // ★ 已存在也要先删（刷新顺序）
    } else if (this.map.size >= this.cap) {
      // ★ 淘汰第一个（最久未使用）
      this.map.delete(this.map.keys().next().value);
    }
    this.map.set(k, v);
  }
}
```

**实测**（容量 2）：`put(1,1) → put(2,2) → get(1) → put(3,3)` 后：

```
get(2) → -1  ✅（2 被淘汰）
get(3) → 3   ✅
```

### 11.12.2 三个必须处理的边界

| 边界 | 不处理会怎样 |
|---|---|
| **`capacity = 0`** | `map.size >= 0` 恒真，但 map 是空的，`keys().next().value` 是 `undefined`，然后 `set` 又插入 → **永远留 1 个** |
| **`put` 已存在的 key** | 只 `set` 不 `delete` → **顺序不变**（等于没刷新） |
| **`get` 不存在的 key** | 返回 `undefined` 而非 `-1` |

**第 2 点是 `Map` 的规范行为**：

```js
const m = new Map();
m.set('a', 1);
m.set('b', 2);
m.set('a', 3);          // 更新值，但【顺序不变】
[...m.keys()];          // ['a', 'b']  ← a 还在前面
```

**所以要刷新顺序必须 `delete` 再 `set`。**

### 11.12.3 双向链表版（面试常要求）

思路是 `Map<key, node>` + 带哨兵的双向链表，`get` / `put` 都是 O(1)。关键点：

| 点 | 说明 |
|---|---|
| **为什么必须双向链表** | 删除或移动节点都要断开前驱，单链表找前驱是 O(n) |
| **节点必须存 `key`** | 淘汰尾节点时要用 key 从 `map` 里删；只存 value 删不掉 |
| **哨兵 head/tail** | 头尾不再是 `null`，插入/删除不用判空 |
| **指针赋值顺序** | 先接好「原首节点」的 `prev`，再改 `head.next`，否则链会断 |

完整实现与推演见 [哈希与缓存：LRU](/doc/algo-hash-lru)。

### 11.12.4 追问：为什么 `Map` 能直接用

**因为 `Map` 内部就是「哈希表 + 双向链表」**——规范保证遍历顺序 = 插入顺序，且 `keys().next()` 是 O(1)（迭代器持有指针）。

**所以 `Map` 版 LRU 本质上是「用语言内置的 LRU 结构实现 LRU」。**

---

## 11.13 常见坑

| 坑 | 正确说法 |
|---|---|
| Promise 的 `executor` 用 `setTimeout` 包 | 必须**同步执行** |
| `then` 的回调用 `setTimeout` 异步 | 必须用 `queueMicrotask`（微任务） |
| `then` 忘了捕获回调抛错 | 要 `try/catch` 包住 `cb(this.value)` |
| `Promise.all([])` 忘了立即 resolve | **永久 pending** |
| `all` 用 `push` 存结果 | 顺序会乱，要用 `results[i]` |
| `retry` 直接 `fn()` 不包 Promise | 同步 throw 时 catch 抓不到 |
| `asyncPool` 用 `Promise.all` 分批 | 慢任务会拖累整批，并发跑不满 |
| `asyncPool` 把原始 promise 放进 `executing` | 失败会让 `Promise.race` 抛错、中断后续入队，要放 `p.catch(() => {})` |
| 深拷贝不用 `WeakMap` | 循环引用死循环 |
| 深拷贝 `Map` 时先递归后缓存 | `Map` 自引用死循环 |
| 深拷贝用 `Object.keys` | 拿不到 Symbol 键 |
| 深拷贝不处理 `RegExp.lastIndex` | 带 `g` 标志时匹配位置错 |
| 用 `JSON` 做深拷贝 | 丢函数/`undefined`/`Symbol`/`Map`/`Set`，`Date` 变字符串，循环引用抛错 |
| `structuredClone` 拷 Symbol | Symbol 值抛 `DataCloneError`，Symbol 键被丢弃 |
| 用 `indexOf` 去重 | **`NaN` 全部丢弃** |
| 去重时 `1` 和 `'1'` 想区分但用 `String` 当 key | 会冲突，要带类型 |
| 扁平化用 `push(...arr.reverse())` | 顺序容易写错，用索引栈 |
| 千分位正则不拆小数 | `1234.5678` 会变成 `1,234.5,678` |
| 千分位循环不处理负号 | `-123456` 会变成 `-,123,456` |
| URL 解析不排除 `#` | `a=1#h` 的值会带 `#h` |
| URL 解析不处理 `+` | `x+y` 得到 `'x+y'` 而不是 `'x y'` |
| 括号匹配忘了判 `stack.length === 0` | `'((('` 会误判为 true |
| LRU 忘了 `capacity = 0` | 永远留 1 个元素 |
| LRU `put` 已存在的 key 只 `set` | 顺序没刷新 |

---

## 11.14 答题模板

### 30 秒版（Promise）

> 核心是**状态机 + 回调队列**。三个状态 `pending`/`fulfilled`/`rejected`，一旦敲定不可逆；`then` 把回调存进队列并返回**新 Promise**；状态变化时异步（`queueMicrotask`）执行队列。
> 六个必答细节：`executor` **同步执行**、要 `try/catch` 捕获同步 throw、状态不可逆、`then` 回调必须**微任务**异步、`then` 的返回值要**递归吸收**（如果是 thenable）、回调不是函数时要**值/错误穿透**。

### 30 秒版（深拷贝）

> 递归 + `WeakMap` 缓存循环引用。要特别处理 `Date`（`new Date(getTime())`）、`RegExp`（重建 + 保留 `lastIndex`）、`Map`/`Set`（**先存缓存再递归**）、数组、以及普通对象用 `Object.create(getPrototypeOf(obj))` 保留原型。
> 遍历要用 `Reflect.ownKeys` 才能拿到 Symbol 键。
> 生产环境优先用 `structuredClone`，但它不能拷函数/Symbol 值、不保留原型；`JSON` 方案会丢函数/`undefined`/`Symbol`/`Map`/`Set`，`Date` 变字符串，循环引用直接抛错。

---

## 11.15 速记卡

```
Promise
  状态机 + 回调队列；then 返回新 Promise
  ★ 六细节：executor 同步 / try-catch 包 executor / 状态不可逆
            then 回调用 queueMicrotask / 返回值递归吸收 / 非函数穿透

Promise.all
  ★★ 空数组必须立即 resolve（否则永久 pending）
  ★ 稀疏数组经 [...list] 展开后按 undefined 计入，结果与原生一致
  ★ results[i] 不用 push（保证顺序）
  ★ .then(onOk, onReject) 不用 .catch（.catch 会连带捕获 onOk 抛的错）
  四方法空数组：all→[] / allSettled→[] / any→reject / race→永久 pending

retry
  Promise.resolve().then(fn) 才能捕获同步 throw
  指数退避 + 抖动
  ★ 澄清 times 是总次数还是重试次数

asyncPool
  Set 存执行中 + await Promise.race(executing)
  ★ executing 里放 p.catch(() => {})，否则失败会中断后续入队
  ★ 不用 Promise.all 分批（慢任务拖累整批）
  实测：6 任务 limit=2 → 约 152ms，最大并发 2

深拷贝
  递归 + WeakMap
  ★ Map/Set 要先 cache.set 再递归（否则自引用死循环）
  ★ Reflect.ownKeys 才拿得到 Symbol 键
  ★ RegExp 要保留 lastIndex
  ★ 普通对象用 Object.create(getPrototypeOf) 保留原型
  JSON 方案丢：函数/undefined/Symbol/Map/Set，Date 变字符串，循环引用抛错
  structuredClone：不能拷函数/Symbol 值，不保留原型，Symbol 键被丢弃

数组去重
  ★ indexOf 用 ===，会把 NaN 全部丢掉
  ★ Set/includes/Map 用 SameValueZero，保留一个 NaN
  ★ 两个 {} 不会合并（引用比较）
  对象数组按 key 用 Map/Set；key 函数要带类型防 1 和 '1' 冲突

扁平化
  递归最简单；迭代用「显式栈 + 索引」
  ★ 别用 push(...arr.reverse())，顺序极易写错
  flat 默认 depth=1，会移除空位

千分位
  正则：\B(?=(\d{3})+(?!\d))
  ★ 必须拆小数（否则 1234.5678 → 1,234.5,678）
  ★ 循环版必须剥离负号（否则 -123456 → -,123,456）
  生产用 toLocaleString / Intl.NumberFormat

URL 解析
  ★ 排除 #hash
  ★ + 要还原成空格
  ★ decodeURIComponent
  ★ 重复 key 变数组
  ★ 用 indexOf('=') 切分，用 hasOwnProperty.call 判重
  生产用 URLSearchParams（getAll 处理重复 key）

括号匹配
  栈；stack.pop() !== map[ch] 同时处理栈空和不匹配
  ★ 最后必须判 stack.length === 0

LRU
  Map 版：get 时 delete+set 刷新；put 已存在也要先 delete
  ★ capacity = 0 直接 return
  双向链表版：节点必须存 key；哨兵 head/tail
  ★ Map 内部就是「哈希表 + 双向链表」→ Map 版是「用内置 LRU 实现 LRU」
```
