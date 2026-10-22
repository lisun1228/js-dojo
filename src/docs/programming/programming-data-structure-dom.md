# 编程 07｜数据结构与 DOM

> 覆盖题号：15（LRU，题单指向外部文档）、29（EventBus）、32（setInterval）、46（DOM 提取 href）、50
> 去重后：**4 个考点**

---

## 目录

- [7.0 这一册的内核：数据结构选型](#70-这一册的内核数据结构选型)
- [7.1 LRU 缓存](#71-lru-缓存)
- [7.2 发布订阅 EventBus](#72-发布订阅-eventbus)
- [7.3 用 setTimeout 实现 setInterval](#73-用-settimeout-实现-setinterval)
- [7.4 DOM：提取所有 a 标签的 href](#74-dom提取所有-a-标签的-href)
- [7.5 面试怎么说（本册通用）](#75-面试怎么说本册通用)
- [7.6 速记卡](#76-速记卡)
- [7.7 自测](#77-自测)

---

## 7.0 这一册的内核：数据结构选型

这 4 道题看着无关，其实都在问同一件事：**「用什么数据结构能让操作变快」**。

| 题 | 要快的操作 | 选型 |
|---|---|---|
| LRU | `get` O(1) + `put` O(1) + 「找最旧」O(1) | 哈希表 + 双向链表 |
| EventBus | 按事件名找监听器 O(1) | `Map<event, cb[]>` |
| setInterval | 可停止、不漂移 | 闭包存 `stopped` 标志 |
| DOM 遍历 | 不递归爆栈、可中断 | `TreeWalker` |

**LRU 是唯一的「真考点」**——因为它需要**两种结构配合**才能同时满足三个 O(1)。其他三道都是工程细节。

---

## 7.1 LRU 缓存

### ⚠️ 先说题单的问题

题单第 15 题的答案是：

> **「同算法文档第18题。」**

而那个「算法文档」不在本工作区。**LRU 是编程题里出题率最高的三道之一**（另外两道是防抖和 Promise），题单却把它甩给一个不存在的文件。这里补全。

### 一句话结论

> **哈希表负责 O(1) 查，双向链表负责 O(1) 移动和删除。**

### 为什么单用一个结构不行

| 方案 | `get` | `put` | 淘汰最旧 | 问题 |
|---|---|---|---|---|
| 只用数组 | O(n) 查找 | O(1) | O(1) | **查找太慢** |
| 只用哈希表 | O(1) | O(1) | ❌ **无法知道谁最旧** | 缺顺序信息 |
| 哈希表 + **单链表** | O(1) | O(1) | O(1) | **删除需要前驱，单链表拿不到** |
| 哈希表 + **双向链表** | O(1) | O(1) | O(1) | ✅ 唯一可行 |

**为什么单链表不行**：`get` 命中后要把它从原位置摘下来。单链表摘节点需要**前驱指针**，只能从头遍历找 → O(n)。双向链表有 `prev`，直接摘 → O(1)。

> 这一句是这道题的**核心考点**。很多人能写出代码，但说不出「为什么必须是双向链表」。

### 实现一：`Map` 版（JS 特性红利）

JS 的 `Map` 有两个特性，正好构成一个天然的 LRU：

1. **保持插入顺序**
2. `map.keys().next().value` 拿到**最早插入的键**

所以只要在 `get` 命中时「先 delete 再 set」，就把它挪到了「最新」的位置：

```js
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map();
  }

  get(key) {
    if (!this.map.has(key)) return -1;
    const value = this.map.get(key);
    this.map.delete(key);          // 先删
    this.map.set(key, value);      // 再插 → 挪到末尾（最新）
    return value;
  }

  put(key, value) {
    if (this.map.has(key)) {
      this.map.delete(key);        // 已存在：先删，等下重新插入
    } else if (this.map.size >= this.capacity) {
      this.map.delete(this.map.keys().next().value);   // 淘汰最旧（第一个键）
    }
    this.map.set(key, value);
  }
}
```

### 实测（LeetCode 146 用例）

```
capacity=2
put(1,1) put(2,2)
get(1) → 1                  （1 变成最新，顺序变成 [2,1]）
put(3,3) → 淘汰 2
get(2) → -1                 ✓ 已被淘汰
get(3) → 3
get(1) → 1
put(4,4) → 此时顺序 [3,1]，淘汰 3
get(1) → 1                  ✓ 1 还在（因为刚被 get 过）
get(3) → -1                 ✓ 被淘汰
get(4) → 4
```

> **注意倒数第三行**：`put(4,4)` 淘汰的是 **3 而不是 1**。因为 `get(1)` 把 1 变成了最新。**这个顺序变化就是 LRU 的全部精髓**，面试时如果面试官问「那 1 为什么没被淘汰」，你要能立刻答出「因为前面 `get(1)` 刷新了它的时间戳」。

### 实现二：双向链表 + 哈希表（正统解法，面试要写这个）

```js
class Node {
  constructor(k, v) {
    this.k = k; this.v = v;
    this.prev = null; this.next = null;
  }
}

class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map();              // key → Node

    // 两个哨兵节点，省掉大量边界判断
    this.head = new Node(0, 0);        // head.next 是「最新」
    this.tail = new Node(0, 0);        // tail.prev 是「最旧」
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  _remove(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  _addFront(node) {                    // 插到 head 之后 = 标记为最新
    node.next = this.head.next;
    node.prev = this.head;
    this.head.next.prev = node;
    this.head.next = node;
  }

  get(key) {
    const node = this.map.get(key);
    if (!node) return -1;
    this._remove(node);
    this._addFront(node);
    return node.v;
  }

  put(key, value) {
    let node = this.map.get(key);
    if (node) {
      node.v = value;
      this._remove(node);
      this._addFront(node);
      return;
    }
    if (this.map.size >= this.capacity) {
      const oldest = this.tail.prev;   // 最旧的
      this._remove(oldest);
      this.map.delete(oldest.k);       // ★ Node 必须存 key，否则删不掉 map
    }
    node = new Node(key, value);
    this._addFront(node);
    this.map.set(key, node);
  }
}
```

### 三个技巧

| 技巧 | 作用 |
|---|---|
| **哨兵节点（head/tail）** | 插入/删除时不用判「是不是第一个/最后一个」，代码量减半 |
| **Node 存 key** | 淘汰时要 `map.delete(node.k)`。只存 value 就删不掉 |
| **`head.next` 最新 / `tail.prev` 最旧** | 约定好方向，插入和淘汰都在两端，不用遍历 |

### 实测（LeetCode 146 全部用例 + 随机对照）

```
用例 1: put(2,1) put(1,1) put(2,3) put(4,1)
        get(1) = -1 ✓   get(2) = 3 ✓
用例 2: put(2,1) put(2,2)  → get(2) = 2 ✓  keys: [2]
        put(1,1) put(4,1)  → get(2) = -1 ✓
capacity=1: put(2,1) → get(2) = 1
            put(3,2) → get(2) = -1 ✓  get(3) = 2 ✓

随机对照：200 轮、每轮 50 次随机操作，Map 版与链表版结果完全一致 ✓
```

> **写完主动说**：「我用 200 轮随机操作对照过 Map 版和链表版，结果一致。**Map 版代码短适合快速写，链表版是正统答案、也说明我理解为什么要双向。**」

### 追问链

| 追问 | 答法 |
|---|---|
| 为什么必须是双向链表？ | `get` 命中后要把节点从中间摘下来，单链表拿不到前驱指针，只能 O(n) 遍历 |
| `Map` 版算不算「作弊」？ | 不算。它利用了 ES6 规范保证的「插入顺序」+「`keys()` 按序返回」。**但面试官问「自己实现一个链表」时就得写链表版** |
| 时间复杂度？ | `get` / `put` 都是 O(1)。空间 O(capacity) |
| 哨兵节点有什么用？ | 避免「删除的是头/尾」这些边界判断。少写 4 个 if |
| 淘汰时为什么要 `map.delete(node.k)`？ | 因为 Node 只被链表和 map 双向引用。不删 map 里的键，map 会一直增长 → 内存泄漏 |
| LRU 有什么缺点？ | ① **缓存污染**：一次全表扫描会把所有热点数据挤出去；② 对「周期性访问」不友好。**改进方案：LRU-K、2Q、LFU、TinyLFU（Caffeine 用的）** |
| 前端哪里用到 LRU？ | Vue 的 `<keep-alive max="10">`（源码里就是 LRU）、图片/接口缓存、vscode 的编辑器缓存 |
| 并发安全要考虑吗？ | JS 单线程不用。**但如果是 SharedArrayBuffer 多线程，或者 Node 集群，就要加锁** |

---

## 7.2 发布订阅 EventBus

### 一句话结论

> `Map<事件名, 回调数组>`，四个方法：`on` / `off` / `emit` / `once`。

### 原题单答案的 4 个问题

```js
class EventBus {
  constructor() { this.map = {}; }
  on(ev, cb) { (this.map[ev] ||= []).push(cb); }
  off(ev, cb) { this.map[ev] = (this.map[ev] || []).filter(c => c !== cb); }
  emit(ev, ...args) { (this.map[ev] || []).forEach(cb => cb(...args)); }
  once(ev, cb) {
    const fn = (...args) => { cb(...args); this.off(ev, fn); };
    this.on(ev, fn);
  }
}
```

实测 4 个问题：

| # | 问题 | 实测 |
|---|---|---|
| 1 | **`off(ev)` 不传 cb 时什么都不删** | 剩余 2 个监听器（期望 0） |
| 2 | **`once` 回调抛错 → 监听器永久残留** | 剩余 1 个（期望 0） |
| 3 | `once` 里先执行再移除 → 回调内递归 emit 会重复触发 | 见下文 |
| 4 | 一个监听器抛错会**中断后续所有监听器** | 后面的不执行 |

#### 问题 1：`off(ev)` 的语义

`filter(c => c !== cb)` 里 `cb` 是 `undefined`，所以 `c !== undefined` 恒为 `true`——**一个都没删**。

**约定应该是：不传 cb 就清空该事件的所有监听器**（这在组件卸载时非常常用）。

#### 问题 2：`once` 的清理顺序

```js
const fn = (...args) => { cb(...args); this.off(ev, fn); };
```

如果 `cb` 抛错，`this.off` 永远不执行 → **监听器永久泄漏**。而且 `once` 的语义是「只执行一次」，**应该先移除再执行**：

```js
const wrapper = (...args) => {
  this.off(ev, wrapper);      // 先移除
  return cb(...args);         // 再执行
};
```

先移除的好处：**如果 `cb` 内部又 `emit` 同一个事件，不会重复触发**（否则会无限递归）。

#### 问题 4：错误隔离

`forEach` 里一个回调抛错，后面全部跳过。**事件总线的一个重要特性是「一个监听器坏了不能影响别人」**——尤其在插件化架构里。

### 正确实现

```js
class EventBus {
  constructor() {
    this.map = new Map();
  }

  on(event, cb) {
    if (!this.map.has(event)) this.map.set(event, []);
    this.map.get(event).push(cb);
    return () => this.off(event, cb);        // 返回取消函数（比记引用方便）
  }

  once(event, cb) {
    const wrapper = (...args) => {
      this.off(event, wrapper);              // ★ 先移除，再执行
      return cb(...args);
    };
    wrapper._origin = cb;                    // 让 off(event, 原函数) 也能生效
    return this.on(event, wrapper);
  }

  off(event, cb) {
    const list = this.map.get(event);
    if (!list) return;
    if (!cb) { this.map.delete(event); return; }        // ★ 不传 cb → 清空
    const i = list.findIndex(f => f === cb || f._origin === cb);
    if (i !== -1) list.splice(i, 1);
    if (list.length === 0) this.map.delete(event);      // 空数组也清掉，防泄漏
  }

  emit(event, ...args) {
    const list = this.map.get(event);
    if (!list) return 0;
    for (const cb of list.slice()) {          // ★ 快照！防遍历中被修改
      try { cb(...args); }
      catch (e) { console.error('[EventBus]', e); }     // ★ 错误隔离
    }
    return list.length;
  }
}
```

### 实测（6 个场景全过）

```
1) once + 两个 on:
   注册 A、once、B → emit(1) → emit(2)
   输出: A1,once1,B1,A2,B2        ← once 只出现一次 ✓

2) emit 中调用 off（slice 快照）:
   第一个监听器里 off('x') → 两个都执行 ✓
   （如果不 slice，会在遍历中改数组导致跳过）

3) off(ev) 不传 cb → 剩余 0 ✓

4) 一个监听器抛错，后面的还能执行 ✓

5) once 回调里递归 emit → 只执行 1 次 ✓（不无限递归）

6) on 返回的取消函数生效 ✓
```

### 四个关键点

| 点 | 为什么 |
|---|---|
| `list.slice()` 快照 | 遍历中若 `off`/`on` 修改数组，`forEach` 会跳过元素或死循环 |
| `once` 先移除再执行 | ① 抛错也移除了；② 递归 emit 不重复触发 |
| 一个监听器一个 `try/catch` | 错误隔离。**插件系统里尤其重要** |
| 空数组要 `map.delete` | 否则 `Map` 里堆满空数组，长跑应用会泄漏 |

### 追问链

| 追问 | 答法 |
|---|---|
| 发布订阅和观察者模式区别？ | 观察者：**被观察者直接持有观察者列表**（紧耦合）。发布订阅：**中间有个 EventBus**（松耦合），双方互不知道 |
| 为什么不用 `{}` 而用 `Map`？ | `{}` 的键只能是字符串/Symbol，`__proto__`、`toString` 会冲突；`Map` 支持任意类型键且无原型污染风险 |
| 怎么支持 `emit` 的返回值？ | 收集每个监听的返回值成数组。Vue 的 `$emit` 不返回值，但某些库支持 |
| 怎么支持异步监听器？ | 两种语义：① `Promise.all(list.map(cb => cb(...)))` 等全部；② 不等待（current）。**要明确约定** |
| 内存泄漏怎么排查？ | 每个 `on` 都要有对应的 `off`。React 里在 `useEffect` cleanup；Vue 里在 `onUnmounted`。**开发环境可以统计 on/off 次数差值** |
| 和 Node 的 `EventEmitter` 区别？ | Node 版有 `maxListeners` 警告、`prependListener`、`removeAllListeners`、`listenerCount`。**还支持 `error` 事件——没有监听器时会 throw** |
| 事件名冲突怎么办？ | 加命名空间 `user:login`，或者用 Symbol 做事件名 |

---

## 7.3 用 setTimeout 实现 setInterval

### 一句话结论

> 递归 `setTimeout` 可以**避免任务堆积**、**可精确控制下次执行时间**。

### 原题单答案的问题

```js
function myInterval(fn, delay) {
  let timer;
  function loop() {
    fn();
    timer = setTimeout(loop, delay);
  }
  timer = setTimeout(loop, delay);
  return () => clearTimeout(timer);
}
```

**实测：回调内部调用 stop 完全无效。**

```
tick 1
→ 第 1 次 tick 内部调用 stop()
tick 2
tick 3
tick 4
... 无限 tick，跑到 12 次才被外部定时器观察到，之后还在继续
```

#### 根因

调用 `stop()` 时，`clearTimeout(timer)` 清的是**「刚刚已经执行完的那个 setTimeout」**——清一个已触发的定时器毫无作用。然后 `fn()` 返回，`timer = setTimeout(loop, delay)` 又排了一个新的。

**所以「在回调内部停止」这条路是断的。**

**这个 bug 特别隐蔽**：因为「在外部调用 stop」是正常工作的。只有「回调里自己停」才会失效——而这恰恰是 `setInterval` 最常见的用法（数到 10 次就停）。

### 正确实现

```js
function mySetInterval(fn, delay) {
  let timer = null;
  let stopped = false;

  const loop = () => {
    if (stopped) return;
    fn();
    if (stopped) return;          // ★ 回调里可能调用了 stop
    timer = setTimeout(loop, delay);
  };

  timer = setTimeout(loop, delay);

  return () => {
    stopped = true;               // ★ 标志位，不只是 clearTimeout
    clearTimeout(timer);
  };
}
```

**核心是加一个 `stopped` 标志位**，在两个位置检查：

1. `loop` 开头（防止已停止的任务还在队列里被唤醒）
2. `fn()` 之后（**关键**：回调里刚调用了 stop）

### 实测

```
1) 回调内调用 stop → 执行 1 次 ✓
2) 外部调用 stop → 执行 5 次后停止，再等 100ms 仍是 5 ✓
3) 间隔: 23,44,66,87,108,129,151,173,194,216 ms
   → 每周期重新计时，不累积漂移 ✓
```

### 为什么不用原生 setInterval（三个理由）

| 问题 | 原生 `setInterval` | 递归 `setTimeout` |
|---|---|---|
| **任务堆积** | 如果 `fn` 执行时间 > delay，任务会排队堆积，**最终一串连续触发** | 每次 `fn` 执行完才排下一次，**不堆积** |
| **漂移** | 引擎按固定周期触发，`fn` 的耗时会让实际间隔 = delay + 执行时间 | 可以让「下次执行时间」精确对齐（见下方代码） |
| **可停止性** | 要保存 id，且回调内停止有坑 | 用标志位控制，随时可停 |

#### 精确间隔版（补偿执行时间）

```js
function preciseInterval(fn, delay) {
  let timer = null;
  let stopped = false;
  let next = Date.now() + delay;      // 预期的下一次执行时间

  const loop = () => {
    if (stopped) return;
    fn();
    if (stopped) return;
    next += delay;                    // 累加「预期时间」，而不是「当前时间」
    const wait = Math.max(0, next - Date.now());   // 补偿 fn 的耗时
    timer = setTimeout(loop, wait);
  };

  timer = setTimeout(loop, delay);
  return () => { stopped = true; clearTimeout(timer); };
}
```

**关键区别**：

- 基础版：`setTimeout(loop, delay)` → 实际间隔 = `delay + fn执行时间`
- 精确版：`next += delay` 然后 `wait = next - now` → 长期平均间隔严格等于 `delay`

### 追问链

| 追问 | 答法 |
|---|---|
| setTimeout 的最小延迟是多少？ | HTML 规范是 4ms（嵌套超过 5 层后）。**Chrome 里 0 也会被钳到 1ms 或 4ms** |
| 后台标签页会怎样？ | 定时器被**节流**到最少 1 秒一次（Chrome）。所以计时不能用定时器累加，要用 `Date.now()` 差值 |
| 为什么回调里停止原版无效？ | `clearTimeout` 清的是已经执行完的那个 timer，新的还没赋值。**必须用标志位** |
| 定时器会造成内存泄漏吗？ | 会。**忘了 clearTimeout 的定时器会一直持有闭包引用**。React 组件卸载必须清 |
| 怎么让定时器更精确？ | 用 `requestAnimationFrame`（跟屏幕刷新对齐，16.7ms）；或者 Web Worker 里跑定时器（不受主线程阻塞影响） |
| 为什么 Web Worker 里的定时器更准？ | 主线程的定时器受渲染、GC、长任务影响。**Worker 是独立线程，不受主线程卡顿影响** |
| `setInterval(fn, 0)` 会怎样？ | 被钳到 4ms（或 1ms）。而且**不会真正「连续」执行**——每轮之间要让出事件循环 |

---

## 7.4 DOM：提取所有 a 标签的 href

### 一句话结论

> `querySelectorAll` 能找到节点，但 **`a.href` 有三个坑**：自动补全、空值变当前页、SVG 不是字符串。

### 原题单答案

```js
function getLinks(root) {
  return [...root.querySelectorAll('a')].map(a => a.href);
}
```

### 用真实 DOM 实测（jsdom，base URL = `https://example.com/page/index.html`）

HTML：

```html
<div id="root">
  <a href="/a">相对路径</a>
  <a href="https://other.com/b">绝对路径</a>
  <a href="javascript:void(0)">空链接</a>
  <a href="">空 href</a>
  <a>没有 href</a>
  <p><a href="#hash">锚点</a></p>
  <svg><a href="/in-svg">SVG 里的 a</a></svg>
</div>
<a id="self" href="/root-itself">root 自身</a>
```

原答案输出：

```js
["https://example.com/a",
 "https://other.com/b",
 "javascript:void(0)",
 "https://example.com/page/index.html",        // ← href="" 变成了当前页 URL！
 "",
 "https://example.com/page/index.html#hash",
 null]                                        // ← SVG 的 a
```

### 四个坑

#### 坑 1：`a.href` 返回的是**绝对 URL**，不是原始属性值

```
a.href            → "https://example.com/a"
a.getAttribute()  → "/a"
```

浏览器会用 `<base>` 或当前页面 URL 补全。**如果你要把链接存下来做跳转，用 `getAttribute('href')`；如果要判断「是不是站外链接」，用 `a.href`（绝对 URL 才好比较 origin）。**

#### 坑 2：`href=""` 会变成**当前页面的 URL**

```
<a href="">  →  "https://example.com/page/index.html"
```

这是规范行为（空字符串按当前文档解析）。**结果就是「空链接」会混进结果里，看起来像一个合法的站内链接。**

#### 坑 3：没有 href 属性的 `<a>` 返回 `""`

```
<a>没有 href</a>  →  a.href === ""
```

也会混进结果。

#### 坑 4：**SVG 里的 `<a>` 的 `.href` 不是字符串**

实测：

```
<A>  namespaceURI=.../xhtml  typeof href=string     href="https://example.com/a"
<a>  namespaceURI=.../svg    typeof href=undefined  href=undefined
                             getAttribute="/s"   ← 这个能拿到
```

HTML 的 `<a>` 和 SVG 的 `<a>` 是**两个不同的元素类型**：前者是 `HTMLAnchorElement`（`href` 是字符串），后者是 `SVGAElement`（`href` 是 `SVGAnimatedString` 对象，jsdom 里甚至是 `undefined`）。

**直接 `.map(a => a.href)` 会得到 `undefined` 或 `[object SVGAnimatedString]`。**

> 这一条几乎没人知道，说出来非常有说服力。

#### 坑 5：`querySelectorAll` **不包含自身**

```
root 就是 <a id="self"> 时
  root.querySelectorAll('a') → 长度 0
  getLinks(root)             → []
```

`querySelectorAll` 只查后代。要包含自身得单独判断。

### 正确实现

```js
function getLinks(root, {
  absolute = true,       // 是否返回绝对 URL
  includeSelf = false,   // 是否包含 root 自身（当 root 是 a 时）
  filter = true,         // 是否过滤无效链接
} = {}) {
  const list = [...root.querySelectorAll('a')];
  if (includeSelf && root.tagName === 'A') list.unshift(root);

  return list
    .map(a => {
      // ★ SVG 的 a 必须用 getAttribute
      const raw = a.getAttribute && a.getAttribute('href');
      return absolute && typeof a.href === 'string' ? a.href : raw;
    })
    .filter(href => {
      if (!filter) return true;
      if (href == null || href === '') return false;          // 空值 / 无 href
      if (/^\s*javascript:/i.test(href)) return false;        // javascript:
      return true;
    });
}
```

### 实测

```
1) 默认（绝对 + 过滤）:
   ["https://example.com/a","https://other.com/b",
    "https://example.com/page/index.html","https://example.com/page/index.html#hash"]

2) 相对原始值:
   ["/a","https://other.com/b","#hash","/in-svg"]     ← SVG 的也能拿到

3) 不过滤:
   7 项（含 javascript:void(0)、空串、null）

4) root 自身是 a:
   原答案 → []
   加 includeSelf → ["https://example.com/root-itself"]
```

### 更高性能的写法（用 TreeWalker）

如果 DOM 很大（几万个节点），`querySelectorAll('a')` 会先在内部构建完整的结果列表。用 `TreeWalker` 可以**边遍历边筛**：

```js
function getLinksFast(root) {
  const out = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node;
  while ((node = walker.nextNode())) {
    if (node.tagName === 'A') {
      const href = node.getAttribute('href');
      if (href && !/^\s*javascript:/i.test(href)) out.push(href);
    }
  }
  return out;
}
```

实测 1000 次迭代：`5ms`。

### DOM 遍历的三种方式对比

| 方式 | 代码量 | 能否中断 | 性能 | 适用 |
|---|---|---|---|---|
| 递归 | 少 | ❌ | 中（有函数调用开销 + 爆栈风险） | 树不深时最简单 |
| `querySelectorAll('*')` | **最少** | ❌ | 快（C++ 实现） | 只要元素列表 |
| `TreeWalker` | 中 | ✅ | 快（可边遍历边处理） | **大 DOM、要提前退出** |

实测（同一个 10 个元素的树）：

```
递归                  → 10 个（含 root 自身）
TreeWalker            → 9 个（不含 root）
querySelectorAll('*') → 9 个（不含 root）
```

> **注意这三者「含不含 root」不一致**——递归从 root 开始自然包含它，另外两个都是「后代」。**写代码时必须明确语义。**

### TreeWalker 的三个优势

1. **不爆栈**：内部用迭代，超深 DOM 也没问题
2. **可中断**：`while` 循环里 `break` 就行（递归要抛异常）
3. **支持过滤**：`NodeFilter` 可以在遍历阶段就筛掉不需要的节点，不用先收集再过滤

```js
// 只遍历 <a> 和 <img>
const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
  acceptNode(node) {
    return /^(A|IMG)$/.test(node.tagName)
      ? NodeFilter.FILTER_ACCEPT
      : NodeFilter.FILTER_SKIP;
  }
});
```

### 如果节点在 Shadow DOM 里

`querySelectorAll` **穿不透 Shadow DOM**。必须递归进入 `shadowRoot`：

```js
function deepQueryAll(root, selector, out = []) {
  out.push(...root.querySelectorAll(selector));
  for (const el of root.querySelectorAll('*')) {
    if (el.shadowRoot) deepQueryAll(el.shadowRoot, selector, out);
  }
  return out;
}
```

### 追问链

| 追问 | 答法 |
|---|---|
| `querySelectorAll` 返回的是数组吗？ | **不是**。是静态的 `NodeList`，有 `forEach` 但没有 `map`/`filter`。要 `[...]` 或 `Array.from` |
| `NodeList` 和 `HTMLCollection` 区别？ | `NodeList`（`querySelectorAll`）是**静态**的；`HTMLCollection`（`getElementsByTagName`）是**活的**——DOM 变化它自动更新。**活集合遍历时改 DOM 会死循环** |
| `href` 和 `getAttribute('href')` 该用哪个？ | 要判断站内/站外用 `href`（绝对 URL 好比 origin）；要原样保存或传给后端用 `getAttribute` |
| 怎么过滤外链？ | `new URL(a.href).origin !== location.origin` |
| 为什么要过滤 `javascript:`？ | 安全。渲染这些链接会导致 XSS（虽然现代浏览器对 `javascript:` 有防护，但 `data:text/html` 也能执行脚本） |
| 大 DOM 下还有更快的方法吗？ | ① `TreeWalker` 边遍历边筛；② 把整个 HTML 字符串用正则提（不推荐，容易错）；③ **服务端预渲染时直接生成链接列表** |
| 怎么处理相对路径？ | `new URL(raw, base)` 手动解析，或者依赖 `a.href` 的自动补全 |

---

## 7.5 面试怎么说（本册通用）

### 接题时

> 「这题我先确认数据结构的选择。**LRU 要同时满足三个 O(1)：查、移动、淘汰最旧。单一结构做不到，所以必须是哈希表 + 双向链表。**」

### 写的时候

> 「两个哨兵节点，`head.next` 是最新的，`tail.prev` 是最旧的。这样插入和淘汰都在两端，不用遍历，也不用判空。」

### 写完之后

> 「三个细节：① **Node 必须存 key**，否则淘汰时删不掉 map 里的键；② **哨兵节点**省掉所有边界判断；③ 我用 200 轮随机操作对照过 Map 版和链表版，结果一致。」

### 追问链（跨题）

| 问题 | 答法 |
|---|---|
| 这 4 道题有什么共同点？ | 都是「选对数据结构让操作变快」。LRU 靠双结构配合，EventBus 靠 Map 做 O(1) 索引 |
| 哪个最常考？ | LRU > EventBus > setInterval > DOM |
| 哪个最容易翻车？ | LRU 的「为什么必须双向链表」，以及 setInterval 的「回调内停止」 |
| 写不出来怎么办？ | 先把「数据结构选型」说清楚：「我需要一个能 O(1) 查到节点的哈希表，加一个能 O(1) 移动的双向链表」。**说出选型比写出代码更重要** |

---

## 7.6 速记卡

```
【LRU】
哈希表 + 双向链表 = 查/移动/淘汰 全 O(1)
为什么必须双向：摘中间节点要前驱指针，单链表只能 O(n)
哨兵 head/tail → 省掉边界判断
Node 必须存 key → 淘汰时才能 map.delete

【EventBus】
Map<event, cb[]>
emit 要 list.slice() 快照      ← 防遍历中被修改
once 要「先移除再执行」        ← 防抛错残留 + 防递归重复
每个监听器一个 try/catch       ← 错误隔离
off(ev) 不传 cb → 清空该事件
空数组要 map.delete            ← 防泄漏

【setInterval】★
原答案：回调内 stop 无效（清的是已执行的 timer）
必须加 stopped 标志位，在 fn() 前后各检查一次
递归 setTimeout 优于原生：不堆积 / 不漂移
精确间隔：next += delay; wait = max(0, next - now)
后台标签页节流到 1s，计时要用 Date.now()

【DOM 提取 href】★ 四个坑
a.href 是绝对 URL（getAttribute 才是原始值）
href="" → 变成当前页 URL
无 href → ""
SVG 的 a：href 不是字符串，必须 getAttribute
querySelectorAll 不含 root 自身

【遍历三方式】
递归（爆栈、不能中断）
querySelectorAll('*')（最快）
TreeWalker（不爆栈、可中断、可过滤）← 大 DOM 首选
```

---

## 7.7 自测

```
□ 能说出 LRU 为什么必须用双向链表
□ 能默写 LRU 的链表版（含哨兵节点）
□ 能说出 Node 为什么必须存 key
□ 能说出容量满时淘汰谁、get 之后顺序怎么变
□ 能说出 Map 版 LRU 依赖 Map 的哪两个特性
□ 能解释 EventBus 的 emit 为什么要 slice
□ 能说出 once 为什么必须先移除再执行
□ 能说出监听器抛错为什么不能中断其他监听器
□ 能说出原版 setInterval 回调内停止为什么无效
□ 能说出递归 setTimeout 相比原生 setInterval 的两个优势
□ 能说出 a.href 和 getAttribute('href') 的三个区别
□ 能说出 href="" 会返回什么
□ 能说出 SVG 里的 a 为什么不能用 .href
□ 能说出 querySelectorAll 和 TreeWalker 的三个差别
```
