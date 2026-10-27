# 编程 04｜并发控制与异步调度

> 覆盖题号：19（用 Promise 实现并发限制）、21（异步任务并发数量限制）、36（Scheduler 类）
> 去重后：**1 个考点，3 种实现形态**

---

## 目录

- [4.0 为什么这三道题是同一道](#40-为什么这三道题是同一道)
- [4.1 先说结论：这道题的正确性怎么验证](#41-先说结论这道题的正确性怎么验证)
- [4.2 原题单 Q36 Scheduler 的两个 bug](#42-原题单-q36-scheduler-的两个-bug)
- [4.3 正确实现（形态一：Scheduler 类）](#43-正确实现形态一scheduler-类)
- [4.4 正确实现（形态二：asyncPool 函数）](#44-正确实现形态二asyncpool-函数)
- [4.5 正确实现（形态三：信号量，最通用）](#45-正确实现形态三信号量最通用)
- [4.6 串行队列（limit=1 的特例）](#46-串行队列limit1-的特例)
- [4.7 超时控制](#47-超时控制)
- [4.8 面试怎么说](#48-面试怎么说)
- [4.9 速记卡](#49-速记卡)
- [4.10 自测](#410-自测)

---

## 4.0 为什么这三道题是同一道

题单把它们编成 19、21、36，其中 21 明写「同第 19 题」。36 的 Scheduler 只是**换了个 API 形态**：

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

---

## 4.1 先说结论：这道题的正确性怎么验证

不能只看「跑完了没」，要测**四个指标**：

| 指标 | 怎么测 | 期望 |
|---|---|---|
| **最大并发数** | 每个任务进出时更新 `maxRunning` | 恰好等于 limit |
| **总耗时** | `Date.now()` 差值 | ≈ 串行总时长 / limit |
| **结果顺序** | 对比输入顺序 | 与输入顺序一致（不是完成顺序） |
| **槽位是否泄漏** | 结束后看 `running` | 必须为 0 |

第 4 项最容易漏测：槽位每泄漏一次，可用并发就永久少一个，最终完全卡死。

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

### bug 1：非排队分支的返回值丢失

实测：

```
add 四次 → [null, null, "task3", "task4"], count = 0
```

前两个任务拿到 `undefined`，后两个拿到值。根因：`_run` 的 `.then` 回调**没有 `return val`**，返回值靠结尾的 `then` 链传递：

- 排队分支：外层 `new Promise(resolve => ...)` 在任务完成时 `resolve(val)`，能拿到值；
- 直接分支：`resolve` 是 `undefined`，`resolve && resolve(val)` 什么都不做，`.then` 返回 `undefined`。

同一份代码产生两种行为，且与任务提交顺序相关，不是随机现象。

### bug 2：reject 时并发槽位永久泄漏

实测：

```
四个任务含一个 reject → ["fulfilled","rejected","fulfilled","fulfilled"]
但 count = 1（应为 0）
```

根因：`_run` 只有 `.then(val => { count--; ... })`，**没有 `.catch` 也没有 `.finally`**。任务 reject 时 `onFulfilled` 不执行，`count--` 永远不跑。

后果：**每 reject 一次，并发上限就永久 -1**，limit 为 2 时两次失败后完全卡死。

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
| ① | `Promise.resolve().then(fn)` | `fn` 同步抛错会直接逃出 `run`，`.finally` 挂不上：外层 Promise 虽然 reject，但 `running` 停在 1、队列不再补位（实测后续任务永久 pending） |
| ② | `.then(resolve, reject)` | 用双参，不是 `.then(resolve).catch(reject)`——后者会把 `resolve` 抛的错也捕获 |
| ③ | `.finally(...)` | bug 2：reject 时槽位泄漏 |
| ④ | `while` 而不是 `if` | 一次释放后理论上能补多个，`if` 只补一个 |

### 实测

```
1) 返回值 ["task1","task2","task3","task4"]，running = 0，queue = 0，最大并发 2
2) 含一个 reject: ["fulfilled","rejected","fulfilled","fulfilled"]，running = 0
3) 全失败 limit=1: ["rejected","rejected","rejected"]，running = 0
4) 动态添加（5 个 + 后补 1 个）: [0,1,2,3,4,"late"]
5) 同步抛错: ["rejected","fulfilled"]，running = 0
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
      // 只等「有槽位腾出」，单个任务失败不能中断入队
      await Promise.race([...executing].map(q => q.catch(() => {})));
    }
  }

  const settled = await Promise.allSettled(all);   // ← 必须等全部
  const failed = settled.find(s => s.status === 'rejected');
  if (failed) throw failed.reason;
  return results;
}
```

### 常见错误：把 results 直接交给 Promise.all

```js
return Promise.all(results);       // 错：results 里是「值 + 空洞」，不是 promise
```

实测：

```
6 任务 limit=2 → [1,2,3,4,5,null]
3 任务 limit=5 → [null,null,null]
```

原因：循环里的 `await` 会让出控制权，前面几批任务顺带把结果写进 `results`；但**最后一批**在循环结束时还在跑，没人等它们。任务数小于 limit 时循环里一次都不 `await`，所以全部是空洞。`Promise.all` 对普通值立即 resolve，空洞原样保留。

同理，`await Promise.race(executing)` 不吞 rejection 时，一个任务失败会让 `race` 直接 reject、循环中断，后面的任务根本不会启动：实测 4 任务 limit=2、第 2 个任务失败时只启动了 2 个，12ms 就抛出；给每个 promise 加 `.catch(() => {})` 后 4 个全部启动，等全部结束后才抛出。

### 实测

```
6 任务 limit=2 → [1,2,3,4,5,6] | 耗时 183ms | 最大并发 2
3 任务 limit=5 → [1,2,3]       | 耗时 51ms
4 任务 limit=1 → [1,2,3,4]     | 耗时 205ms
含同步抛错     → rejected: sync boom
空数组         → []
```

**验算**：6 个任务耗时分别 100/100/50/50/30/30，limit=2：前两个并行 100ms，接着两个并行 50ms（到 150），最后两个并行 30ms（到 180）。实测 183ms，差值来自调度开销。

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

实测：5 个任务 limit=2 → 结果按输入顺序返回，最大并发 2，结束后 `current = 0`。

**价值**：不要求一次性拿到所有任务，适合流式处理——无限滚动持续加载、WebSocket 持续推任务。

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
去掉 chain.catch → 第二个任务被跳过：err:boom | err:boom
```

**关键点**：`chain = result.catch(() => {})`。不加的话 `chain` 是 rejected promise，后面的 `.then` 全部被跳过——一次失败，整个队列停摆。

链式串行比 Scheduler 更简洁，但不支持动态调整 limit，只适合严格串行。

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
超时     → timeout
超时返回时底层任务仍在跑，之后再结束
```

两个必须说的点：

1. **`finally(() => clearTimeout(timer))` 不能省**——任务先完成时，定时器会一直挂到 ms 到期，请求量大时大量堆积。
2. **超时只是「不再等」，不是「取消」**。底层任务还在跑，结果被丢弃。

真正的取消要用 `AbortController`：

```js
const ac = new AbortController();
fetch(url, { signal: ac.signal });          // 只有支持 signal 的 API 才能被真正取消
setTimeout(() => ac.abort(), 3000);
```

实测：`race([sleep(100), abortSign()])` 在约 10ms 时以 `aborted` 返回，此时 `sleep(100)` 尚未结束，之后仍会自己跑完。

---

## 4.8 面试怎么说

- **接题先定语义**：是「最多 limit 个同时跑」还是「每秒最多 limit 个」——前者是并发数控制，后者是速率限制；再确认结果顺序是否与输入一致、失败是整体失败还是保留全部结果。
- **主体思路**：计数器 + 队列；未满直接跑，满了入队；任务结束时 `running--` 并从队列补位。
- **关键细节**：释放槽位必须放在 `finally`，任务 reject 也要执行；`fn` 用 `Promise.resolve().then(fn)` 包裹，把同步抛错转成 rejection。
- **主动补边界**：结束断言 `running === 0` 查槽位泄漏；`asyncPool` 的 `results` 装的是值不是 promise，要另用数组收集 promise 再 `allSettled`；`await Promise.race` 要吞掉单个任务的 rejection，否则会中断入队。
- **本质**：资源池（上限 + 排队 + 超时），与连接池、线程池同构。

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

---

## 4.9 速记卡

```
【内核】计数器 running + 队列 queue；完成时 running-- 并补位

【原答案两个 bug】
① 直接分支没 return → 返回值丢失（[null,null,task3,task4]）
② 没有 finally → reject 时槽位永久泄漏（count 停在 1）

【Scheduler 四要点】
Promise.resolve().then(fn)            ← 同步抛错转 rejection
.then(resolve, reject)                ← 双参，不用 .catch
.finally(() => { running--; _next() })
while 而不是 if                       ← 一次能补多个

【验证四指标】最大并发 = limit / 总耗时 ≈ 串行 ÷ limit / 结果顺序 = 输入顺序 / 结束后 running === 0

【asyncPool】
results 里是「值 + 空洞」→ 不能直接 Promise.all   ← 最后一批丢失，任务数 < limit 时全空
正确：单独收集 promise，最后 await Promise.allSettled(all)
race 要吞掉失败：map(q => q.catch(() => {}))      ← 否则一个失败中断入队

【串行队列】chain = result.catch(() => {})，不加则一次失败后后续全跳过

【超时】race + finally(clearTimeout)；超时 ≠ 取消，真正取消用 AbortController

【本质】资源池：上限 + 排队 + 超时
```

---

## 4.10 自测

```
□ 能说出并发限制和速率限制的区别
□ 能默写 Scheduler 的 add / _next，并说清 run 里四步各自的作用
□ 能解释为什么释放槽位必须用 finally 而不是 then
□ 能说出原答案 [null,null,task3,task4] 的成因
□ 能说出槽位泄漏会导致什么后果，以及怎么在结束时断言
□ 能解释 Promise.resolve().then(fn) 的作用（不写时 running 会停在哪）
□ 能说出 asyncPool 里为什么要单独收集 promise，以及任务数 < limit 时的现象
□ 能算出「6 个任务耗时 100/100/50/50/30/30，limit=2」的总耗时
□ 能说出串行队列里 chain.catch 的作用
□ 能解释超时和取消的区别
□ 能说出并发池和「分批切片」的性能差异在哪
```
