# JS · 08 内存管理与垃圾回收

> 覆盖：分代回收、Scavenge、Mark-Sweep / Mark-Compact、三色标记与写屏障、引用计数、八类内存泄漏与排查
> 主线：先讲「怎么回收」，再讲「怎么泄漏」，最后讲「怎么排查」

---

## 目录

- [8.1 一句话结论](#81-一句话结论)
- [8.2 V8 的内存结构](#82-v8-的内存结构)
- [8.3 新生代：Scavenge（Cheney 复制算法）](#83-新生代scavengecheney-复制算法)
- [8.4 老生代：Mark-Sweep 与 Mark-Compact](#84-老生代mark-sweep-与-mark-compact)
- [8.5 三色标记与写屏障（这是「为什么」层面的答案）](#85-三色标记与写屏障这是为什么层面的答案)
- [8.6 引用计数：为什么被淘汰（纠正题单）](#86-引用计数为什么被淘汰纠正题单)
- [8.7 八类内存泄漏](#87-八类内存泄漏)
- [8.8 怎么排查内存泄漏](#88-怎么排查内存泄漏)
- [8.9 常见坑](#89-常见坑)
- [8.10 答题模板](#810-答题模板)
- [8.11 速记卡](#811-速记卡)

---

## 8.1 一句话结论

V8 用**分代回收**：**新生代**（对象朝生夕死）用 **Scavenge（Cheney 复制算法）**，**老生代**（活得久的）用 **Mark-Sweep + Mark-Compact**。
标记阶段用**三色标记**，为了不长时间停顿，把标记拆成**增量标记 + 并发标记**，并用**写屏障**保证并发时不出错。
**内存泄漏的本质是「不再需要的对象仍然被可达引用持有」**——不是「忘了释放」（JS 没有手动释放）。

---

## 8.2 V8 的内存结构

### 8.2.1 栈 vs 堆

| 位置 | 存什么 | 大小 | 回收方式 |
|---|---|---|---|
| **栈（Stack）** | 原始值、引用地址、执行上下文 | 小（V8 默认 `--stack-size`，约 0.9MB，平台相关） | 函数返回自动弹出 |
| **堆（Heap）** | 对象、数组、闭包、函数 | 大（GB 级） | **GC 回收** |

```js
const a = 1;              // 原始值随栈槽 / 寄存器走
const b = { x: 1 };       // { x: 1 } 在堆上，b 存的是地址
```

**`const` 锁的是绑定，不是对象内容**：绑定不能重新赋值，堆上对象的属性照样能改。

### 8.2.2 V8 堆的主要空间

`v8.getHeapSpaceStatistics()` 会列出所有 space，和回收策略相关的是这几个：

```
new_space             新生代 ← Scavenge
old_space             老生代 ← Mark-Sweep / Mark-Compact
code_space            编译后的机器码
large_object_space    大对象（超过常规对象上限，通常百 KB 级）不经过新生代
read_only_space       只读空间（内置对象，如 Object.prototype）
```

各 space 的 size / used 随机器、启动阶段、Node 版本变化（Node 22 还会额外列出 `shared_space`、`trusted_space`、`new_large_object_space` 等），记住分工即可，不要记数字。

### 8.2.3 默认堆上限（不要记死数字）

堆上限由**系统内存**推算，没有跨机器通用的常量：

| 因素 | 影响 |
|---|---|
| **Node 版本** | Node 12 之前 64 位固定约 1.4GB；之后按系统内存动态调整 |
| **系统内存** | 内存大的机器上限更高 |
| **`--max-old-space-size`** | 手动指定老生代上限（MB） |
| **`--max-semi-space-size`** | 指定新生代单个 semi-space 大小（MB） |

```bash
node --max-old-space-size=4096 app.js     # 4GB
```

**说「按系统内存动态调整，通常从 1.4GB 起步，可配置」即可**；把某个具体 MB 数当成固定值就是错的。

---

## 8.3 新生代：Scavenge（Cheney 复制算法）

### 8.3.1 为什么新生代用复制算法

**统计事实：绝大多数对象「朝生夕死」**（临时变量、函数内创建的对象、字符串拼接中间结果）。

**所以新生代可以只分配很小的空间，用「复制存活对象」的方式回收**——因为存活的对象很少，复制的成本低。

### 8.3.2 Cheney 算法（两个 semi-space）

**新生代被分成两个等大的空间：`From` 和 `To`。**

```
回收前：
┌─────────────────┬─────────────────┐
│   From（在用）    │   To（空闲）     │
│  [活][死][活][死] │                 │
└─────────────────┴─────────────────┘
         ↓ GC
① 从根出发，把 From 里的【存活对象】复制到 To（紧凑排列）
② 清空 From
③ From 和 To 角色互换

回收后：
┌─────────────────┬─────────────────┐
│   From（空闲）    │   To（在用）     │
│                 │  [活][活]        │   ← 紧凑，无碎片
└─────────────────┴─────────────────┘
```

**三个优点**：

| 优点 | 说明 |
|---|---|
| **无碎片** | 复制后对象紧凑排列（这是「复制算法」的天然优势） |
| **只处理存活对象** | 死亡对象完全不碰（成本 ∝ 存活数，不是总数） |
| **分配快** | 用「指针碰撞（bump pointer）」——只需移动指针 |

**一个缺点**：**内存利用率只有 50%**（总有一半空间空着）。

### 8.3.3 对象什么时候晋升到老生代

**两个条件，满足任一就晋升**：

| 条件 | 说明 |
|---|---|
| **① 经历过 2 次 Scavenge 仍存活** | 说明「不是朝生夕死」的，移到老生代 |
| **② 回收后存活对象占比过高（V8 取 25% 阈值）** | 继续留在新生代会挤占 To 空间，提前晋升 |

**所以老生代随驻留数据增长，新生代在 Scavenge 后回落**，`heapUsed` 因此呈锯齿状——这是正常现象，不是泄漏。

### 8.3.4 为什么是「两个」semi-space 而不是一个

**因为复制算法需要「一边读一边写」**。如果只有一个空间，复制时会覆盖还没处理的对象。

**这是所有「复制式 GC」的共同设计**（比如 JVM 的 Survivor 区）。

---

## 8.4 老生代：Mark-Sweep 与 Mark-Compact

### 8.4.1 为什么老生代不用复制算法

**老生代里存活对象很多**，复制成本高（成本 ∝ 存活数），而且 50% 的空间浪费在 GB 级堆上不可接受。

**所以用「标记 + 清除」**。

### 8.4.2 Mark-Sweep（标记清除）

```
① 标记阶段：从根（globalThis、当前调用栈、闭包）出发，遍历所有可达对象，打上标记
② 清除阶段：遍历整个堆，把【没标记】的对象回收
```

**优点**：不需要移动对象，空间利用率 100%。
**缺点**：**产生内存碎片**（回收后留下很多小空洞，大对象可能放不进去）。

### 8.4.3 Mark-Compact（标记整理）

```
① 标记（同上）
② 整理：把所有存活对象「往一端移动」，紧凑排列
③ 清除边界外的空间
```

**优点**：无碎片。
**缺点**：**移动对象要更新所有引用**，成本高。

### 8.4.4 V8 的策略：两者结合

**V8 不是固定用某一个，而是「主要用 Mark-Sweep，碎片多了再用 Mark-Compact」**：

| 情况 | 策略 |
|---|---|
| **大多数时候** | Mark-Sweep（快，不移动） |
| **碎片率超过阈值** | Mark-Compact（整理一次，解决碎片） |

**这就是「空间换时间」和「时间换空间」的折中。**

### 8.4.5 一次完整的 GC 流程（V8 Orinoco）

| 阶段 | 做什么 |
|---|---|
| **并发标记** | 标记线程与主线程并行，减少主线程停顿 |
| **增量标记** | 标记拆成很多小步，穿插在 JS 执行之间 |
| **并行标记** | 多个标记线程同时工作 |
| **原子停顿** | 短暂停，处理「标记期间变化的对象」（靠写屏障记录） |
| **并发清除** | 清除阶段也在后台线程做 |
| **并行整理** | 按需压缩，解决碎片 |

**关键指标**：V8 的目标是把「主线程停顿」压到毫秒级，避免掉帧。

---

## 8.5 三色标记与写屏障（这是「为什么」层面的答案）

### 8.5.1 三色标记

**每个对象有三种状态**：

| 颜色 | 含义 |
|---|---|
| **白** | 未访问（GC 结束后还是白 → **回收**） |
| **灰** | 已访问，但它的子节点还没全部访问（**待处理**） |
| **黑** | 已访问，且所有子节点也访问完了（**安全**） |

**流程**：

```
① 初始：所有对象白色，根对象灰色
② 从灰色集合取一个对象：
   - 把它变成黑色
   - 把它引用的白色对象变成灰色
③ 重复 ②，直到没有灰色对象
④ 剩下的白色对象全部不可达 → 回收
```

### 8.5.2 为什么需要写屏障（并发标记的难题）

**问题：标记过程中，JS 还在跑，可能修改对象引用。**

**经典错误场景**（「对象消失问题」）：

```
① 标记进行中：
   黑对象 A（已标记完，不会再扫描它的子节点）
   白对象 C（还没访问）

② 此时 JS 执行：
   A.child = C          ← 黑色对象引用了白色对象！
   B.child = null       （B 原本指向 C，现在断开）

③ 标记继续：
   A 已是黑色，GC 不会重新扫描 A；B 到 C 的引用又断了
   → C 永远是白色 → 被回收
   → 但 A.child 还指着 C，成了悬空引用
```

**解法：写屏障（Write Barrier）**——在「赋值」这一层加检查，把并发期间的引用变化告诉 GC：

```js
// 伪代码：SATB 写屏障，记录被覆盖掉的旧值
function writeBarrier(obj, key, oldValue) {
  if (isBlack(obj) && isWhite(oldValue)) {
    markAsLive(oldValue);   // 视作标记开始时就存活，避免漏标
  }
}
```

**两类屏障方向相反**：

| 策略 | 做法 | 用在哪 |
|---|---|---|
| **增量更新（Incremental Update）** | 插入引用时把**白色对象变灰**（重新纳入待扫描） | 老式实现 |
| **SATB（Snapshot-At-The-Beginning）** | 删除引用时把**被删掉的白色对象记为存活**（相当于保留标记开始时的快照） | **V8 用的** |

**这才是并发 GC 的核心难点**——不是「标记」难，是「标记期间程序还在改对象」难。

**口述要点**：

- 「对象消失」：黑色对象新引用白色对象，同时指向它的另一条路径被删除，GC 漏标 → 误回收。
- 解法是在赋值路径上加写屏障，把变化记录下来。
- V8 用 SATB，记录的是被删掉的旧引用，不是新插入的值。

---

## 8.6 引用计数：为什么被淘汰（纠正题单）

### 8.6.1 V8 主 GC 不用引用计数，但引用强度思想仍在

| 事实 | 说明 |
|---|---|
| **V8 主 GC 不用引用计数** | 用可达性分析（标记清除） |
| **「引用强度」思想还在用** | `WeakRef` / `FinalizationRegistry` / `WeakMap` 的弱引用语义；何时清理由 GC 决定，不能预期 |
| **某些引擎 / 场景仍用** | 早期的 DOM 实现、部分嵌入式 JS 引擎、Python 的主 GC（另配循环检测） |

### 8.6.2 引用计数的致命问题：循环引用

```js
// 引用计数：a 和 b 互相引用，各自计数都是 1
let a = {};
let b = {};
a.ref = b;      // b 的计数 +1
b.ref = a;      // a 的计数 +1

a = null;       // a 对象计数 -1（还剩 b.ref 指向它）
b = null;       // b 对象计数 -1（还剩 a.ref 指向它）

// 两个对象的计数都是 1，永远不归零 → 内存泄漏
```

**标记清除不会**：从根出发，`a` 和 `b` 都不可达，全回收。

**这就是「为什么必须用可达性分析而不是引用计数」的根本原因。**

### 8.6.3 引用计数的历史事故：IE 的 DOM 泄漏

**IE 6/7 的经典内存泄漏**：

```js
// IE 6/7 中，DOM 对象用引用计数，JS 对象用标记清除
// 两套 GC 互相引用时，谁都回收不了
window.onload = function () {
  var el = document.getElementById('myDiv');
  el.onclick = function () {
    // 闭包引用了 el
    alert(el.id);
  };
  // el 引用了闭包，闭包引用了 el → 循环引用
};
```

**即使页面跳转，这块内存也不释放**——因为 DOM 那边计数不为 0，JS 那边也认为可达。

**这就是「为什么老前端强调 `el.onclick = null`」的历史原因。**

---

## 8.7 八类内存泄漏

### 8.7.1 总表

| # | 类型 | 典型代码 | 怎么修 |
|---|---|---|---|
| **1** | **意外的全局变量** | `function f() { leaked = [] }` | `'use strict'` + `let/const` |
| **2** | **未清理的定时器** | `setInterval(fn, 1000)` 组件卸载时没 clear | `clearInterval`（定时器没有 `signal` 选项） |
| **3** | **未移除的事件监听** | `window.addEventListener('resize', fn)` 没 remove | `removeEventListener` / `{ signal }` |
| **4** | **闭包持有大对象** | 返回的函数引用了大数组 | 缩小闭包捕获范围，用完置 `null` |
| **5** | **未取消的订阅** | `store.subscribe(fn)` / `observer.observe` | 卸载时 `unsubscribe` |
| **6** | **游离 DOM 引用** | 全局变量持有已移除的 DOM | 移除后置 `null` |
| **7** | **无上限缓存** | `const cache = new Map()` 只增不减 | 用 `WeakMap` 或 LRU |
| **8** | **`console.log` 持有引用** | 开发时 `console.log(bigObj)` | 生产环境移除 console |

### 8.7.2 逐个展开

**① 意外的全局变量**

```js
function leak() {
  leaked = new Array(1e5).fill('x');    // ❌ 没有 var/let/const
}
leak();
// 非严格模式：挂到 globalThis，函数返回后仍然可达
// 严格模式：ReferenceError
```

**另一种**：

```js
function f() {
  this.bigData = new Array(1e5);    // ❌ this 是 globalThis（默认绑定）
}
f();
```

**② 未清理的定时器**

```js
// ❌ 组件卸载后定时器还在跑，回调闭包持有组件状态
mounted() {
  this.timer = setInterval(() => {
    this.count++;                    // 持有 this（组件实例）
  }, 1000);
}
// 忘了 beforeUnmount 里 clearInterval
```

**定时器没有 `signal` 选项**——`setInterval(fn, 1000, { signal })` 里的对象只会被当成回调参数传进去，`abort()` 不会停掉定时器。只能显式清理：

```js
// ✅ signal 只对 addEventListener / fetch 这类 API 有效
const ac = new AbortController();
const id = setInterval(fn, 1000);
ac.signal.addEventListener('abort', () => clearInterval(id));
ac.abort();
```

**③ 未移除的事件监听**

```js
// ❌ 每次挂载都加，卸载不移除
useEffect(() => {
  window.addEventListener('resize', handler);
}, []);       // 缺 cleanup

// ✅
useEffect(() => {
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);

// ✅ 更简洁：用 signal
useEffect(() => {
  const ac = new AbortController();
  window.addEventListener('resize', handler, { signal: ac.signal });
  return () => ac.abort();
}, []);
```

**④ 闭包持有大对象**

```js
// ❌ 只用了 big[0]，却持有整个 big
function makeGetter() {
  const big = new Array(1e6).fill('x');
  return () => big[0];              // 闭包持有整个数组
}

// ✅ 只捕获需要的部分
function makeGetter() {
  const big = new Array(1e6).fill('x');
  const first = big[0];             // 先取出来
  return () => first;               // 只捕获一个字符串
}

// ✅ 或者用完置 null
function makeGetter() {
  let big = new Array(1e6);
  const result = big[0];
  big = null;                       // 主动断开
  return () => result;
}
```

**⑤ 未取消的订阅**

```js
// ❌
useEffect(() => {
  const unsub = store.subscribe(handler);
  // 忘了 return unsub
}, []);

// ✅
useEffect(() => {
  return store.subscribe(handler);    // 直接返回 unsubscribe
}, []);
```

**⑥ 游离 DOM 引用（Detached DOM）**

```js
// ❌ 全局变量持有已从文档移除的 DOM
let cachedNode;
function removeNode() {
  const el = document.getElementById('list');
  cachedNode = el;                    // 缓存了
  el.remove();                        // 从 DOM 树移除，但 cachedNode 还引用着
}
// el 变成「游离节点」：不在文档树里，但 JS 引用还在 → 不回收
```

**DevTools 里的表现**：Memory 快照搜索 `Detached`，能看到 `Detached HTMLDivElement`。

**⑦ 无上限缓存**

```js
// ❌ 只增不减
const cache = new Map();
function get(key) {
  if (!cache.has(key)) cache.set(key, fetchSync(key));
  return cache.get(key);              // 缓存永远增长
}

// ✅ 方案 1：WeakMap（key 是对象时）
const cache = new WeakMap();

// ✅ 方案 2：LRU（限制容量）
class LRUCache { /* 见算法册 */ }

// ✅ 方案 3：定时清理
setInterval(() => cache.clear(), 60000);
```

**⑧ `console.log` 持有引用**

```js
// ❌ 开发时的调试代码
console.log('巨型数据：', hugeObject);
// DevTools 打开时，console 会保留对象的强引用（为了能展开查看）
```

**这就是「为什么生产环境要去掉 console」的一个理由**（另一个是性能）。

### 8.7.3 一个重要澄清：闭包「不一定」泄漏

```js
// ❌ 很多人以为这是泄漏，其实不是
function createFn() {
  const big = new Array(1e6);
  return () => big.length;
}

const fn = createFn();
fn();
// 只要 fn 还被引用，big 就不回收 —— 但这是【预期行为】，不是泄漏！
// fn = null 之后 big 不再可达，可被回收（具体时机由 GC 决定）
```

**泄漏 = 「不再需要的对象仍然可达」**。闭包让对象活得更久是设计目的，只有**你不想要它了、但引用没断**，才是泄漏。

---

## 8.8 怎么排查内存泄漏

### 8.8.1 浏览器：Memory 面板三快照法

```
① 打开 DevTools → Memory → Heap snapshot → 拍快照 1
② 操作页面（比如反复打开关闭某个弹窗 10 次）
③ 手动点「垃圾桶」强制 GC，拍快照 2
④ 再操作 10 次，再 GC，拍快照 3
⑤ 在快照 3 上选「Comparison」对比快照 2
⑥ 看「Delta」列，正数就是增长的
```

**关键观察点**：

| 迹象 | 说明 |
|---|---|
| **`(closure)` 数量持续增长** | 闭包泄漏 |
| **`Detached HTMLElement` 增长** | 游离 DOM |
| **`Array` / `Object` 大小持续增长** | 缓存没清 |
| **`EventListener` 增长** | 监听器没移除 |

### 8.8.2 Chrome 任务管理器 / Performance Monitor

**Performance Monitor（`Ctrl+Shift+P` → Show Performance Monitor）**：

- **JS heap size**：如果持续上升不回落 → 泄漏
- **DOM Nodes**：持续增长 → DOM 泄漏
- **JS event listeners**：持续增长 → 监听器泄漏

### 8.8.3 Node.js 侧

```js
// 打印内存
console.log(process.memoryUsage());
// { rss, heapTotal, heapUsed, external, arrayBuffers }

// 定时观察
setInterval(() => {
  const { heapUsed } = process.memoryUsage();
  console.log((heapUsed / 1024 / 1024).toFixed(1), 'MB');
}, 5000);
```

**判断标准**：**内存持续上升，GC 后不回落 → 泄漏**（正常情况是锯齿状波动）。

**工具**：

| 工具 | 用途 |
|---|---|
| **`node --inspect` + Chrome DevTools** | 同浏览器的 Memory 面板 |
| **`heapdump`** | 生成快照文件 |
| **`clinic`**（`clinic heapprofiler`） | 一站式诊断 |
| **`--max-old-space-size` + 压测** | 观察是否 OOM |

### 8.8.4 定位到具体代码：保留分配栈

**Chrome Memory 面板勾选「Record allocation stacks」**，快照里能看到「这个对象是在哪行代码分配的」。

**这是最有效的手段**——直接告诉你泄漏源。

---

## 8.9 常见坑

| 坑 | 正确说法 |
|---|---|
| 说「引用计数完全不用了」 | V8 主 GC 不用，但「引用强度」思想仍在（`WeakRef`/`WeakMap`）；Python 主 GC 就是引用计数 |
| 说「新生代用标记清除」 | 新生代用 **Scavenge（复制算法）**，老生代才用标记清除 |
| 说「老生代只用 Mark-Sweep」 | 碎片多了会切 **Mark-Compact** |
| 说「闭包一定泄漏」 | 不一定，只有「不再需要但引用不断」才是泄漏 |
| 说「循环引用一定泄漏」 | 现代 GC（标记清除）能回收循环引用；引用计数才会泄漏 |
| 说「GC 是定时的」 | 是**按需触发**（分配失败 / 堆增长到阈值），不是定时 |
| 说「内存越大越好」 | 堆越大，单次 GC 停顿越长（要遍历更多对象） |
| 说「手动 GC 可以用 `global.gc()`」 | 要 `node --expose-gc` 才有，生产不该依赖 |
| 说「V8 堆上限固定 1.4GB」 | 旧版 Node 才固定，现代 Node 按系统内存动态调整，可 `--max-old-space-size` 指定 |
| 忘记 `console.log` 会持有引用 | DevTools 打开时 console 保留强引用 |

---

## 8.10 答题模板

### 30 秒版（垃圾回收）

- **分代**：对象朝生夕死，新生代用 **Scavenge（Cheney 复制）**——From/To 两个半区，存活对象复制到 To、清空 From、互换；成本 ∝ 存活数，无碎片，代价是 50% 空间。
- **晋升**：经历 2 次 Scavenge 仍存活，或回收后存活占比过高（V8 阈值 25%），进入老生代。
- **老生代**：Mark-Sweep（不移动、有碎片），碎片率超阈值切 Mark-Compact。
- **并发正确性**：三色标记 + 写屏障（V8 用 SATB）解决「对象消失」。
- **不用引用计数的原因**：处理不了循环引用。

### 30 秒版（内存泄漏）

- **本质**：「不再需要的对象仍然可达」，不是「忘了释放」（JS 没有手动释放）。
- **八类**：意外全局变量、未清定时器、未移除监听、闭包持有大对象、未取消订阅、游离 DOM、无上限缓存、`console.log` 持有引用。
- **排查**：Chrome Memory 面板三快照对比 Delta，配合「Record allocation stacks」定位到分配代码。

### 2 分钟版（完整版，推荐）

- **怎么回收**：分代 + Scavenge（From/To、复制存活、无碎片、50% 利用率、成本 ∝ 存活数）；经历两次 Scavenge 或存活占比过高就晋升；老生代 Mark-Sweep，碎片率超阈值切 Mark-Compact。
- **哪里难**：标记期间 JS 还在改引用——黑色对象新引用白色对象、同时指向它的另一条路径被删，就会漏标误回收（对象消失）；写屏障 + SATB 记录被删掉的旧引用兜底，这才是并发 GC 的核心难点。
- **怎么泄漏**：八类场景本质都是「引用没断」；闭包、循环引用本身不是泄漏——闭包让对象活得更久是设计目的，循环引用能被可达性分析回收。
- **怎么排查**：浏览器三快照看 `(closure)` / `Detached HTMLElement` / `EventListener` 是否增长；Node 侧看 `process.memoryUsage()` 在 GC 后是否仍不回落。

### 追问表

| 追问 | 回答要点 |
|---|---|
| 为什么分代 | 绝大多数对象朝生夕死，分代能让回收成本匹配对象寿命 |
| 新生代用什么算法 | Scavenge（Cheney 复制），From/To 两个半区 |
| 为什么复制算法没碎片 | 复制时紧凑排列 |
| 复制算法的缺点 | 内存利用率只有 50% |
| 对象什么时候晋升 | 经历 2 次 Scavenge，或回收后存活占比过高（V8 阈值 25%） |
| 老生代用什么算法 | Mark-Sweep，碎片多了切 Mark-Compact |
| Mark-Sweep 的缺点 | 内存碎片 |
| 三色标记是什么 | 白（未访问）/ 灰（待处理）/ 黑（已完成） |
| 写屏障解决什么 | 并发标记时的「对象消失」问题 |
| V8 用哪种写屏障策略 | SATB（Snapshot-At-The-Beginning） |
| 引用计数为什么被淘汰 | 无法处理循环引用 |
| 循环引用会泄漏吗 | 现代 GC 不会；引用计数才会 |
| GC 什么时候触发 | 分配失败 / 堆增长到阈值，不是定时 |
| 闭包一定泄漏吗 | 不一定，只有「不需要但引用不断」才泄漏 |
| 堆越大越好吗 | 不是，堆越大单次 GC 停顿越长 |
| 怎么排查泄漏 | Memory 三快照对比 Delta + Record allocation stacks |
| 怎么手动触发 GC | `--expose-gc` 后用 `global.gc()`，生产不该依赖 |

---

## 8.11 速记卡

```
内存结构
  栈：原始值 + 引用地址 + 执行上下文（V8 默认 --stack-size，约 0.9MB）
  堆：对象/数组/闭包。主要 space：
    new_space（Scavenge）/ old_space（Mark-Sweep|Compact）
    code_space / large_object_space（不经过新生代）/ read_only_space
  ★ 堆上限按系统内存动态调整，--max-old-space-size 可调

新生代：Scavenge（Cheney 复制）
  From / To 两个半区
  ① 复制存活对象到 To（紧凑）② 清空 From ③ 互换
  优点：无碎片、成本∝存活数、分配快（指针碰撞）
  缺点：内存利用率 50%
  ★ 晋升：经历 2 次 Scavenge，或回收后存活占比过高（V8 阈值 25%）

老生代：Mark-Sweep + Mark-Compact
  标记可达 → 清除不可达（有碎片）；碎片率超阈值 → 整理一次
  V8 Orinoco：并发 / 增量 / 并行标记 + 原子停顿 + 并发清除 + 按需整理

三色标记 + 写屏障（★「对象消失」问题）
  白=未访问 灰=待处理 黑=已完成
  黑对象新引用白对象 + 另一条路径被删 → 白被误回收
  解法：写屏障
  增量更新（插入时白变灰）/ SATB（删除时记录旧值，V8 用这个）

引用计数
  V8 主 GC 不用：无法处理循环引用
  但「引用强度」思想仍在：WeakRef / WeakMap / FinalizationRegistry（清理时机由 GC 决定）
  Python 主 GC = 引用计数 + 循环检测
  IE 6/7 的 DOM 泄漏就是 DOM(引用计数) × JS(标记清除) 的循环引用

八类泄漏
  ① 意外全局变量（漏写 let）② 未清定时器 ③ 未移除监听
  ④ 闭包持有大对象 ⑤ 未取消订阅 ⑥ 游离 DOM
  ⑦ 无上限缓存 ⑧ console.log 持有引用
  ★ 本质：不再需要的对象仍然可达
  ★ 闭包不一定泄漏；循环引用在现代 GC 下不是问题

排查
  Chrome Memory 三快照对比 Delta
  看 (closure) / Detached HTMLElement / EventListener 增长
  勾选 Record allocation stacks → 直接定位分配代码
  Node：process.memoryUsage() 锯齿波动正常，GC 后仍不回落才是泄漏
```
