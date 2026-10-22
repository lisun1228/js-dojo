# 编程 04｜并发控制与异步调度

> 覆盖题号：19（用 Promise 实现并发限制）、21（异步任务并发数量限制）、36（Scheduler 类）
> 去重后：**1 个考点，3 种实现形态**

---

## 4.0 为什么这三道题是同一道

题单把它们编成 19、21、36，其中 21 明写「同第 19 题」。而 36 的 Scheduler 只是**换了个 API 形态**：

| 形态 | 入参 | 返回 | 适用 |
|---|---|---|---|
| `asyncPool(tasks, limit)` | 一次性给全量任务 | `Promise<results[]>` | 批量下载、批量上传 |
| `new Scheduler(limit).add(fn)` | 任务可以**陆续添加** | 每个 add 返回一个 Promise | 动态队列、请求池 |

**内核完全一样**：

```
一个计数器 running（当前在跑几个）
+ 一个队列 queue（还没排上的）
+ 一条规则：任务完成时 running--，然后从 queue 里取下一个
```

理解了这一句，两种形态都能推出来。

---

## 4.1 先说结论：这道题的正确性怎么验证

不能只看「跑完了没」，要测**四个指标**：

| 指标 | 怎么测 | 期望 |
|---|---|---|
| **最大并发数** | 每个任务进出时更新 `maxRunning` | 恰好等于 limit |
| **总耗时** | `Date.now()` 差值 | ≈ 串行总时长 / limit |
| **结果顺序** | 对比输入顺序 | 与输入顺序一致（不是完成顺序） |
| **槽位是否泄漏** | 结束后看 `running` | 必须为 0 |

**第 4 项是最容易被忽略、也最致命的**——泄漏几次之后，并发数就永久降低了，最终完全卡死。

---

## 4.2 原题单 Q36 Scheduler 的两个 bug

```js
class Scheduler {
  constructor(limit) { this.limit = limit; this.queue = []; this.count = 0; }
  add(promiseFn) {
    if (this.count >= this.limit) {
      return new Promise(resolve => {
        this.queue.push(() => this._run(promiseFn, resolve));
      });
    }
    return this._run(promiseFn);
  }
  _run(fn, resolve) {
    this.count++;
    return fn().then(val => {
      this.count--;
      if (this.queue.length) this.queue.shift()();
      resolve && resolve(val);
    });
  }
}
```

### bug 1：非排队分支的**返回值丢失**

实测：

```js
const s = new Scheduler(2);
const outs = await Promise.all(
  [1,2,3,4].map(i => s.add(() => sleep(30, 'task' + i)))
);
// outs → [null, null, "task3", "task4"]
```

**前两个是 `null`，后两个正常**——同一份代码，行为不一致。

**根因**：`_run` 里 `.then(val => { ...; resolve && resolve(val); })` 这个箭头函数**没有 `return val`**。所以：

- 走排队分支时：外层 `new Promise(resolve => ...)` 会 `resolve(val)`，能拿到值 ✓
- 走直接分支时：`resolve` 是 `undefined`，`resolve && resolve(val)` 什么都不做，`.then` 返回 `undefined` ✗

**这就是为什么「同一份代码有的返回 null 有的正常」——这种 bug 最难排查，因为它看起来是「随机」的。**

### bug 2：reject 时**并发槽位永久泄漏**

实测：

```js
const s2 = new Scheduler(2);
await Promise.allSettled([
  s2.add(() => sleep(20, 'ok1')),
  s2.add(() => sleep(10, 'fail', true)),   // 这个 reject
  s2.add(() => sleep(10, 'ok3')),
  s2.add(() => sleep(10, 'ok4')),
]);
// 结果: ["fulfilled","rejected","fulfilled","fulfilled"]
// 但 s2.count === 1     ← 应该是 0
```

**根因**：`_run` 里只有 `.then(val => { count--; ... })`，**没有 `.catch` 也没有 `.finally`**。任务 reject 时 `onFulfilled` 不执行，`count--` 就永远不跑。

后果：**每 reject 一次，并发上限就永久 -1**。limit=2 的场景下，两次失败之后就完全卡死了。

> 这个 bug 在测试环境很难发现，因为**大部分任务不会失败**。上了生产，某个接口一抖，整个请求池就慢慢瘫痪了。

---

## 4.3 正确实现（形态一：Scheduler 类）

```js
class Scheduler {
  constructor(limit) {
    this.limit = limit;
    this.running = 0;
    this.queue = [];
  }

  add(fn) {
    return new Promise((resolve, reject) => {
      const run = () => {
        this.running++;
        Promise.resolve()
          .then(fn)                    // ① 把同步抛错转成 rejection
          .then(resolve, reject)       // ② 值/错都往外交给调用方
          .finally(() => {             // ③ finally 保证成功失败都释放槽位
            this.running--;
            this._next();              // ④ 立刻补位
          });
      };

      if (this.running < this.limit) run();
      else this.queue.push(run);
    });
  }

  _next() {
    while (this.running < this.limit && this.queue.length) {
      this.queue.shift()();
    }
  }
}
```

### 四个关键点

| # | 写法 | 不写会怎样 |
|---|---|---|
| ① | `Promise.resolve().then(fn)` | `fn` 同步抛错时，异常在 `run` 里冒出，整个 `new Promise` 崩掉 |
| ② | `.then(resolve, reject)` | 用双参，不是 `.then(resolve).catch(reject)`——后者会把 `resolve` 抛的错也捕获 |
| ③ | `.finally(...)` | bug 2：reject 时槽位泄漏 |
| ④ | `while` 而不是 `if` | 如果一次释放后能补多个（比如 limit 被调大），`if` 只补一个 |

### 实测（全部通过）

```
1) 返回值 [task1, task2, task3, task4]   ← 原答案是 [null, null, task3, task4]
   running = 0, queue = 0

2) 含一个 reject: ["fulfilled","rejected","fulfilled","fulfilled"]
   running = 0                            ← 原答案是 1（泄漏）

3) 全失败 limit=1: ["rejected","rejected","rejected"]
   running = 0                            ← 不会死锁

4) 动态添加（5 个 + 后面再 add 1 个）: [0,1,2,3,4,"late"]

5) 同步抛错: ["rejected","fulfilled"], running = 0

6) 所有任务都失败时不报未捕获异常
```

---

## 4.4 正确实现（形态二：asyncPool 函数）

```js
async function asyncPool(tasks, limit) {
  const results = new Array(tasks.length);
  const all = [];                 // ← 关键：另外收集 promise
  const executing = new Set();
  let index = 0;

  for (const task of tasks) {
    const i = index++;
    const p = Promise.resolve()
      .then(task)
      .then(r => { results[i] = r; return r; })
      .finally(() => executing.delete(p));

    all.push(p);
    executing.add(p);

    if (executing.size >= limit) {
      await Promise.race(executing);      // 等任意一个完成，腾出槽位
    }
  }

  const settled = await Promise.allSettled(all);   // ← 必须等全部
  const failed = settled.find(s => s.status === 'rejected');
  if (failed) throw failed.reason;
  return results;
}
```

### ⚠️ 我第一版写错了，这个坑非常典型

第一版我写的是：

```js
return Promise.all(results);       // ← 错！
```

实测结果：

```
6 任务 limit=2 → [1,2,3,4,5,null]
3 任务 limit=5 → [null,null,null]      ← 任务数 < limit 时全部丢失
```

**为什么错**：`results` 里装的是「已经填好的值 + 还没填的空洞」，**不是 promise**。`Promise.all` 对普通值会立刻 resolve，所以：

- 循环里 `await Promise.race(executing)` 会让出控制权，**顺带**让前面几批任务填上了结果
- 但**最后一批**（循环结束那一刻还在跑的任务）没机会填
- 而「任务数 < limit」时循环里一次都没 `await`，所以**一个都没填**

**这个 bug 的可怕之处**：limit 比较小、任务比较多的时候，看起来「基本是对的」（只丢最后一个）；一旦任务数少于 limit，就全空。**测试用例稍微换一下结论就完全不同。**

正确做法：**单独用一个 `all` 数组收集 promise，最后 `await Promise.allSettled(all)`**。

### 实测

```
6 任务 limit=2 → [1,2,3,4,5,6] | 耗时 187ms | 最大并发 2
3 任务 limit=5 → [1,2,3]       | 耗时 51ms
4 任务 limit=1 → [1,2,3,4]     | 耗时 208ms   （串行，约 4×50ms）
含同步抛错     → rejected:sync boom
空数组         → []
```

**验算**：6 个任务耗时分别 100/100/50/50/30/30，limit=2：
- 前两个并行 100ms，接着两个并行 50ms（到 150），最后两个并行 30ms（到 180）
- 实测 187ms ✓ 与理论一致

---

## 4.5 正确实现（形态三：信号量，最通用）

前两种都是「拉」模型（自己从队列取任务）。第三种是「推」模型——**控制权在调用方**，用信号量限制入口：

```js
class Semaphore {
  constructor(max) {
    this.max = max;
    this.current = 0;
    this.waiters = [];
  }

  async acquire() {
    if (this.current < this.max) {
      this.current++;
      return;
    }
    // 满了，排队等一个 release
    await new Promise(resolve => this.waiters.push(resolve));
    this.current++;
  }

  release() {
    this.current--;
    const next = this.waiters.shift();
    if (next) next();
  }

  async run(fn) {
    await this.acquire();
    try { return await fn(); }
    finally { this.release(); }
  }
}

// 用法：任何地方都能包
const sem = new Semaphore(2);
const results = await Promise.all(urls.map(u => sem.run(() => fetch(u))));
```

**这个版本的价值**：它不要求你「一次性拿到所有任务」，所以**适合流式处理**——比如用户在无限滚动里不断加载、或者 WebSocket 持续推任务。

---

## 4.6 串行队列（limit=1 的特例）

```js
function serialQueue() {
  let chain = Promise.resolve();
  return (fn) => {
    const result = chain.then(() => fn());
    chain = result.catch(() => {});      // ← 防止一次失败炸掉整条链
    return result;
  };
}
```

实测：

```
三个任务（耗时 20/5/1ms）→ 结果 ["a","b","c"]，执行顺序 1→2→3
一个失败后继续 → err:boom | after-error
```

**关键点**：`chain = result.catch(() => {})` 这一行。如果不加，`chain` 就是个 rejected promise，后面的 `.then` 全部会被跳过——**一次失败，整个队列停摆**。

> 这个「链式串行」的写法比 Scheduler 更简洁，但它**不支持动态调整 limit**，只适合严格串行。

---

## 4.7 超时控制

并发控制几乎总会遇到「某个任务卡住不返回」，所以要配套超时：

```js
function withTimeout(promise, ms, msg = 'timeout') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(msg)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
```

实测：

```
正常完成 → done
超时     → caught:timeout
```

**两个必须说的点**：

1. **`finally(() => clearTimeout(timer))` 不能省**——否则任务先完成时，那个定时器还会挂着，直到 ms 后才清掉。大量请求时会积累几万个定时器。
2. **超时只是「不再等」，不是「取消」**。底层任务还在跑，结果被丢弃。

真正的取消要用 `AbortController`：

```js
const ac = new AbortController();
fetch(url, { signal: ac.signal });          // 只有支持 signal 的 API 才能被真正取消
setTimeout(() => ac.abort(), 3000);
```

实测（演示「AbortController 只是信号，不自动取消 promise」）：

```
Promise.race([sleep(100), abortSign()]) → aborted   （10ms 时就返回了）
```

但 `sleep(100)` 本身还会跑完——只是没人在等它了。

---

## 4.8 面试怎么说

### 接题时（先确认语义，这一步很多人跳过）

> 「并发限制我先确认一下语义：**是『最多 limit 个同时在跑』，还是『每秒最多 limit 个』？** 前者是并发数控制，后者是速率限制，实现不一样。」

> 「另外确认一下：结果顺序要跟输入一致吗？有任务失败时是整体失败还是要全部结果？」

**这三句话会让面试官觉得你在真实项目里处理过这类需求**，因为这两个歧义在需求评审里经常搞混。

### 写的时候

> 「思路是一个计数器加一个队列。任务进来时看计数器有没有满：没满就直接跑，满了就推进队列。任务结束时计数器减一，然后从队列里取一个补上。
>
> 关键点是**必须在 `finally` 里减计数器**，不能在 `then` 里——因为任务可能失败，失败也得释放槽位。」

### 写完之后（主动说边界）

> 「我测四个点：最大并发是不是真的等于 limit、总耗时是不是接近理论值、结果顺序对不对、结束之后计数器是不是回到 0。**最后一个是查槽位泄漏的**。
>
> 另外有个坑我踩过：用 `Set` 追踪正在跑的 promise 时，如果最后把所有结果收集起来用 `Promise.all(results)`，那个数组里装的是**值不是 promise**，最后一批任务的结果会丢。要单独用一个数组收集 promise，最后等它。」

> **主动说出自己踩过的坑，是手写题里最高效的加分方式**——它证明你真的写过，不是背的。

### 追问链

| 追问 | 答法 |
|---|---|
| limit 设多少合适？ | 不是越大越好。浏览器对同域名 HTTP/1.1 并发限制是 6，超过就是排队；**HTTP/2 多路复用后可以更大，但要考虑服务端承载**。经验值 4~8 |
| 任务失败了怎么办？ | 两种策略：① 整体失败（`all` 语义）；② 局部失败（`allSettled` 语义 + 结果里带 error）。**批量下载用①，页面多模块加载用②** |
| 怎么支持优先级？ | 把队列换成优先队列（堆），或者两个队列（高优/低优）分别处理 |
| 怎么支持取消？ | 每个任务返回的 promise 配一个 `AbortController`，取消时 `abort()` 并把它从队列里移除 |
| 和 `p-limit` 库有什么区别？ | 思路一样。`p-limit` 额外处理了「动态调大/调小 limit」「队列里的任务可取消」「Promise 拒绝时不产生 unhandled rejection」这些细节 |
| 为什么不用 `Promise.all` + 分批切片？ | 分批会导致「一批里最慢的拖住整批」——**批次末尾有空转**。并发池是「谁完成谁补位」，没有空转 |
| 这个和节流有关系吗？ | 不同维度。**并发数控制的是「同时多少个」，节流控制的是「单位时间多少个」**。做爬虫两者都要 |

### 加分点

> **「这个题的本质是『资源池』，和数据库连接池、线程池是同一个模型。」**

一说出来就跨了层次——从「会写 JavaScript」上升到「懂系统设计」。可以再补一句：

> 「所以连接池要解决的三个问题这里都有：**上限、排队、超时**。我上面只实现了前两个，第三个要靠 `withTimeout` 配合。」

---

## 4.9 速记卡

```
【内核】计数器 running + 队列 queue + 完成时 running-- 并补位

【原答案两个 bug】
① 直接分支没 return → 返回值丢失（[null,null,3,4]）
② 没有 finally → reject 时槽位永久泄漏（count 停在 1）

【正确写法四要点】
Promise.resolve().then(fn)   ← 同步抛错转 rejection
.then(resolve, reject)       ← 双参，不用 .catch
.finally(() => { running--; next() })   ← 成功失败都释放
while 而不是 if              ← 一次能补多个

【我踩过的坑】
Promise.all(results) 里装的是「值+空洞」不是 promise
→ 最后一批任务结果丢失
→ 任务数 < limit 时全空
正确：单独用 all[] 收集 promise，await Promise.allSettled(all)

【验证四指标】最大并发 / 总耗时 / 结果顺序 / 结束后 running===0

【串行队列】
chain = result.catch(() => {})   ← 不加则一次失败全队列停摆

【超时】race + finally(clearTimeout)；超时≠取消，要取消用 AbortController

【本质】资源池：上限 + 排队 + 超时 = 连接池/线程池同构
```

---

## 4.10 自测

```
□ 能说出并发限制和速率限制的区别
□ 能默写 Scheduler 的 add / _next
□ 能解释为什么必须用 finally 而不是 then
□ 能说出原答案 [null,null,3,4] 的成因
□ 能说出槽位泄漏会导致什么后果
□ 能解释 Promise.resolve().then(fn) 的作用
□ 能说出 asyncPool 里为什么要单独收集 promise
□ 能算出「6 个任务耗时 100/100/50/50/30/30，limit=2」的总耗时
□ 能说出串行队列里 chain.catch 的作用
□ 能解释超时和取消的区别
□ 能说出 limit 为什么不能设太大
□ 能说出并发池和「分批切片」的性能差异在哪
```
