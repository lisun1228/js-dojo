# 编程 07｜数据结构与 DOM

> 覆盖题号：15（LRU）、29（EventBus）、32（setInterval）、46（DOM 提取 href）、50
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

这 4 道题看着无关，其实都在问同一件事：**用什么数据结构能让操作变快**。

| 题 | 要快的操作 | 选型 |
|---|---|---|
| LRU | `get` O(1) + `put` O(1) + 淘汰最旧 O(1) | 哈希表 + 双向链表 |
| EventBus | 按事件名找监听器 O(1) | `Map<event, cb[]>` |
| setInterval | 可停止、周期可控 | 闭包存 `stopped` 标志 |
| DOM 遍历 | 不递归爆栈、可中断 | `TreeWalker` |

LRU 是唯一需要两种结构配合的题：查、移动、淘汰三个 O(1) 缺一不可；另外三道考的是边界与工程细节。

---

## 7.1 LRU 缓存

### 一句话结论

> **哈希表负责 O(1) 查，双向链表负责 O(1) 移动和删除。**

### 题单原答案：一行引用

题单第 15 题只写了「同算法文档第 18 题」，没有给出实现。完整推导见 [算法 06｜哈希与缓存：LRU](/doc/algo-hash-lru)，这里保留编程题要手写的两个版本与边界。

### 为什么单用一个结构不行

| 方案 | `get`（含摘除） | `put` | 淘汰最旧 | 问题 |
|---|---|---|---|---|
| 只用数组 | O(n) | O(n) | O(n) | 查找、保序移动都要搬元素 |
| 只用哈希表 | O(1) | O(1) | ❌ 无法知道谁最旧 | 缺顺序信息 |
| 哈希表 + **单链表** | O(n) | O(n) | O(n) | 摘除任意节点要 O(n) 找前驱 |
| 哈希表 + **双向链表** | O(1) | O(1) | O(1) | ✅ 唯一可行 |

`get` 命中后要把节点从原位置摘下来。单链表摘节点需要前驱指针，只能从头遍历；双向链表有 `prev`，摘除和插入都是 O(1)。

### 实现一：`Map` 版

JavaScript 的 `Map` 有两个特性，正好构成一个天然的 LRU：

1. **保持插入顺序**（ES 规范保证，不是引擎实现细节）
2. `map.keys().next().value` 拿到**最早插入的键**

所以在 `get` 命中时「先 delete 再 set」，就把它挪到了最新位置：

```js
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map();
  }

  get(key) {
    if (!this.map.has(key)) return -1;
    const value = this.map.get(key);
    this.map.delete(key); // 先删
    this.map.set(key, value); // 再插 → 挪到末尾（最新）
    return value;
  }

  put(key, value) {
    if (this.map.has(key)) {
      this.map.delete(key); // 已存在：先删，等下重新插入
    } else if (this.map.size >= this.capacity) {
      this.map.delete(this.map.keys().next().value); // 淘汰最早插入的键
    }
    this.map.set(key, value);
  }
}
```

### 实测（LeetCode 146 示例）

```
capacity=2
put(1,1) put(2,2)
get(1) → 1                  （1 变成最新，顺序变成 [2,1]）
put(3,3) → 淘汰 2
get(2) → -1
get(3) → 3
get(1) → 1
put(4,4) → 此时顺序 [3,1]，淘汰 3
get(1) → 1
get(3) → -1
get(4) → 4
```

`put(4,4)` 淘汰的是 3 而不是 1：前面的 `get(1)` 把 1 刷新成了最新。

### 实现二：双向链表 + 哈希表

```js
class Node {
  constructor(k, v) {
    this.k = k;
    this.v = v;
    this.prev = null;
    this.next = null;
  }
}

class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.map = new Map(); // key → Node

    // 两个哨兵节点，省掉大量边界判断
    this.head = new Node(0, 0); // head.next 是「最新」
    this.tail = new Node(0, 0); // tail.prev 是「最旧」
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  _remove(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  _addFront(node) {
    // 插到 head 之后 = 标记为最新
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
      const oldest = this.tail.prev;
      this._remove(oldest);
      this.map.delete(oldest.k); // Node 必须存 key，否则删不掉 map
    }
    node = new Node(key, value);
    this._addFront(node);
    this.map.set(key, node);
  }
}
```

### 实测（LeetCode 146 全部用例 + 随机对照）

```
用例 1: put(2,1) put(1,1) put(2,3) put(4,1)
        get(1) = -1   get(2) = 3
用例 2: put(2,1) put(2,2) → get(2) = 2
        put(1,1) put(4,1) → get(2) = -1
capacity=1: put(2,1) → get(2) = 1
            put(3,2) → get(2) = -1, get(3) = 2
随机对照: 200 轮 × 每轮 50 次随机操作，Map 版与链表版结果完全一致
```

`Map` 版代码短，适合快速写；链表版是面试要求的手写答案，也顺带证明了为什么必须是双向链表。

### 追问链

| 追问 | 答法 |
|---|---|
| 为什么必须是双向链表？ | `get`/`put` 命中后要把节点从中间摘下来，单链表拿不到前驱，只能 O(n) 遍历 |
| `Map` 版算不算「作弊」？ | 不算。它利用 ES 规范保证的插入顺序和 `keys()` 顺序；要求手写链表时再写链表版 |
| 时间复杂度？ | `get` / `put` 都是 O(1)，空间 O(capacity) |
| 哨兵节点有什么用？ | 避免「删除的是头/尾」这些边界判断 |
| 淘汰时为什么要 `map.delete(node.k)`？ | Node 同时被链表和 map 引用，不删 map 里的键，map 会一直增长 |
| LRU 有什么缺点？ | 一次全表扫描会把热点数据全部挤出；改进方案有 LRU-K、2Q、LFU、TinyLFU |
| 前端哪里用到 LRU？ | Vue 的 `<keep-alive max>` 缓存裁剪、图片/接口缓存、编辑器缓存 |
| 并发安全要考虑吗？ | JS 单线程不用；Worker + `SharedArrayBuffer` 或集群共享缓存才需要同步或外部存储 |

---

## 7.2 发布订阅 EventBus

### 一句话结论

> `Map<事件名, 回调数组>`，四个方法：`on` / `off` / `emit` / `once`。

### 题单原答案的四个问题

```js
class EventBus {
  constructor() {
    this.map = {};
  }
  on(ev, cb) {
    (this.map[ev] ||= []).push(cb);
  }
  off(ev, cb) {
    this.map[ev] = (this.map[ev] || []).filter((c) => c !== cb);
  }
  emit(ev, ...args) {
    (this.map[ev] || []).forEach((cb) => cb(...args));
  }
  once(ev, cb) {
    const fn = (...args) => {
      cb(...args);
      this.off(ev, fn);
    };
    this.on(ev, fn);
  }
}
```

实测四个问题：

```
off('x') 不传 cb        → 剩余 2 个监听器（期望 0）
once 回调抛错           → 剩余 1 个（期望 0）
once 回调内递归 emit    → RangeError: Maximum call stack size exceeded
第一个监听器抛错        → 后面的监听器不执行
```

**① `off(ev)` 不传 `cb` 时一个都不删**

`filter(c => c !== cb)` 里 `cb` 是 `undefined`，`c !== undefined` 恒为真。约定应该是：不传 `cb` 就清空该事件的所有监听器（组件卸载时常用）。

**② `once` 先执行再移除**

回调抛错时 `this.off` 永远不执行，监听器永久残留；回调里递归 `emit` 同一事件时，wrapper 还在列表里，会重复触发直到栈溢出。应先移除再执行：

```js
const wrapper = (...args) => {
  this.off(ev, wrapper); // 先移除
  return cb(...args); // 再执行
};
```

**③ `emit` 没有错误隔离**

`forEach` 里一个回调抛错，后面全部跳过。事件总线要求一个监听器坏了不影响别人，尤其是在插件化架构里；每个回调要单独 `try/catch`。

### 正确实现

```js
class EventBus {
  constructor() {
    this.map = new Map();
  }

  on(event, cb) {
    if (!this.map.has(event)) this.map.set(event, []);
    this.map.get(event).push(cb);
    return () => this.off(event, cb); // 返回取消函数
  }

  once(event, cb) {
    const wrapper = (...args) => {
      this.off(event, wrapper); // 先移除，再执行
      return cb(...args);
    };
    wrapper._origin = cb; // 让 off(event, 原函数) 也能生效
    return this.on(event, wrapper);
  }

  off(event, cb) {
    const list = this.map.get(event);
    if (!list) return;
    if (!cb) {
      this.map.delete(event); // 不传 cb → 清空
      return;
    }
    const i = list.findIndex((f) => f === cb || f._origin === cb);
    if (i !== -1) list.splice(i, 1);
    if (list.length === 0) this.map.delete(event); // 空数组也清掉，防泄漏
  }

  emit(event, ...args) {
    const list = this.map.get(event);
    if (!list) return 0;
    for (const cb of list.slice()) {
      // 快照，防遍历中被修改
      try {
        cb(...args);
      } catch (e) {
        console.error('[EventBus]', e); // 错误隔离
      }
    }
    return list.length;
  }
}
```

### 实测（6 个场景）

```
1) A、once、B 依次注册，emit(1) → emit(2)：A1,once1,B1,A2,B2
2) 第一个监听器里 off('x')：两个都执行（list.slice() 快照）
3) off(ev) 不传 cb：剩余 0
4) 一个监听器抛错：后面的仍执行
5) once 回调里递归 emit：只执行 1 次
6) on 返回的取消函数调用后：不再执行
```

### 三个关键点

| 点 | 为什么 |
|---|---|
| `list.slice()` 快照 | 遍历中 `off`/`on` 修改数组，直接 `forEach` 会跳过元素或重复执行 |
| `once` 先移除再执行 | 抛错也移除了；递归 `emit` 不重复触发 |
| 空数组要 `map.delete` | 否则 `Map` 里堆满空数组，长跑应用会泄漏 |

### 追问链

| 追问 | 答法 |
|---|---|
| 发布订阅和观察者模式区别？ | 观察者：被观察者直接持有观察者列表（紧耦合）；发布订阅：中间有 EventBus（松耦合） |
| 为什么不用 `{}` 而用 `Map`？ | `{}` 的键只能是字符串/Symbol，`__proto__`、`toString` 会冲突；`Map` 支持任意类型键 |
| 怎么支持 `emit` 的返回值？ | 收集每个监听器的返回值成数组。Vue 的 `$emit` 不返回值 |
| 怎么支持异步监听器？ | 两种语义：`Promise.all` 等全部完成，或不等待。必须明确约定 |
| 内存泄漏怎么排查？ | 每个 `on` 都要有对应的 `off`；开发环境统计 on/off 次数差值 |
| 和 Node 的 `EventEmitter` 区别？ | Node 版有 `maxListeners` 警告、`prependListener`、`listenerCount`；`error` 事件没有监听器时会 throw |
| 事件名冲突怎么办？ | 加命名空间 `user:login`，或用 Symbol 做事件名 |

---

## 7.3 用 setTimeout 实现 setInterval

### 一句话结论

> 递归 `setTimeout` 在回调结束后才排下一次，不会出现连续触发；代价是周期 = `delay` + 回调耗时，要消除这部分漂移得按绝对时间对齐。

### 题单原答案的问题

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

### 实测：回调内 stop 无效

```
delay=10ms，第 1 次回调里调用 stop()：
200ms 后已触发 18 次，且仍在继续
```

`stop()` 里 `clearTimeout(timer)` 清的是刚执行完的那个 timer，清一个已触发的定时器没有作用；`loop` 返回后又会 `setTimeout` 排一个新的。外部调用 `stop` 正常工作，只有回调内停止会失效，而「数到 n 次就停」正是这种写法。

### 正确实现

```js
function mySetInterval(fn, delay) {
  let timer = null;
  let stopped = false;

  const loop = () => {
    if (stopped) return;
    fn();
    if (stopped) return; // 回调里可能调用了 stop
    timer = setTimeout(loop, delay);
  };

  timer = setTimeout(loop, delay);

  return () => {
    stopped = true; // 标志位，不只是 clearTimeout
    clearTimeout(timer);
  };
}
```

核心是 `stopped` 标志位，在两个位置检查：

1. `loop` 开头：防止已停止的任务还在队列里被唤醒
2. `fn()` 之后：回调里刚调用了 stop

### 实测

```
回调内 stop → 只执行 1 次
外部 stop   → 停止时 6 次，100ms 后仍是 6 次
delay=20ms  → 实际间隔 21,22,21,21,...
回调阻塞 10ms、delay=20ms → 基础版间隔 31ms；精确版 20ms
```

### 与原生 setInterval 的差异

| 问题 | 原生 `setInterval` | 递归 `setTimeout` |
|---|---|---|
| **回调耗时 > 周期** | 下一次触发紧接上次，多次执行挤在一起，无法补偿 | 本次执行完才排下一次，不会连续触发；周期 = delay + 执行时间 |
| **长期漂移** | 每个周期都带上回调耗时 | 基础版同样带上；精确版按绝对时间对齐消除 |
| **可停止性** | 保存 id；回调内 clear 无效 | 标志位 + `clearTimeout`，回调内外都能停 |

#### 精确间隔版（补偿执行时间）

```js
function preciseInterval(fn, delay) {
  let timer = null;
  let stopped = false;
  let next = Date.now() + delay; // 预期的下一次执行时间

  const loop = () => {
    if (stopped) return;
    fn();
    if (stopped) return;
    next += delay; // 累加「预期时间」，而不是「当前时间」
    const wait = Math.max(0, next - Date.now()); // 补偿 fn 的耗时
    timer = setTimeout(loop, wait);
  };

  timer = setTimeout(loop, delay);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
```

- 基础版：`setTimeout(loop, delay)` → 实际间隔 = `delay + fn 执行时间`
- 精确版：`next += delay` 后 `wait = next - now` → 长期平均间隔回到 `delay`

### 追问链

| 追问 | 答法 |
|---|---|
| setTimeout 的最小延迟是多少？ | HTML 规范规定嵌套超过 5 层后最小 4ms；浏览器对 0 也会做钳制 |
| 后台标签页会怎样？ | 定时器被浏览器节流（Chrome 最少 1 秒一次，长时间后台更久）。所以计时要用 `Date.now()` 差值 |
| 为什么回调里停止原版无效？ | `clearTimeout` 清的是已经执行完的 timer，新的还没赋值。必须用标志位 |
| 定时器会造成内存泄漏吗？ | 会。忘了 `clearTimeout` 的定时器会一直持有闭包引用 |
| 怎么让定时器更精确？ | 用 `requestAnimationFrame` 跟屏幕刷新对齐；或把定时器放进 Web Worker |
| 为什么 Web Worker 里的定时器更准？ | 主线程的定时器受渲染、GC、长任务影响；Worker 不受主线程卡顿影响 |
| `setInterval(fn, 0)` 会怎样？ | 被钳到最小延迟，且每轮之间要让出事件循环，不会真正连续执行 |

---

## 7.4 DOM：提取所有 a 标签的 href

### 一句话结论

> `querySelectorAll` 能找到节点，但 **`a.href` 有五个坑**：绝对化、`href=""`、无 href、SVG、不含 root 自身。

### 原题单答案

```js
function getLinks(root) {
  return [...root.querySelectorAll('a')].map((a) => a.href);
}
```

### 实测（jsdom，base URL = `https://example.com/page/index.html`）

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

原答案输出（7 个 a）：

```js
["https://example.com/a",
 "https://other.com/b",
 "javascript:void(0)",
 "https://example.com/page/index.html",        // href="" 变成了当前页 URL
 "",
 "https://example.com/page/index.html#hash",
 null]                                        // SVG 的 a
```

### 五个坑

#### 坑 1：`a.href` 返回的是绝对 URL，不是原始属性值

```
a.href                  → "https://example.com/a"
a.getAttribute('href')  → "/a"
```

浏览器会用 `<base>` 或当前页面 URL 补全。保存原始链接用 `getAttribute('href')`；判断站内/站外用 `a.href`（绝对 URL 好比较 origin）。

#### 坑 2：`href=""` 会变成当前页面的 URL

```
<a href=""> → "https://example.com/page/index.html"
```

空字符串按当前文档解析（规范行为），结果像一个合法的站内链接。

#### 坑 3：没有 href 属性的 `<a>` 返回 `""`

```
<a>没有 href</a> → a.href === ""，getAttribute('href') === null
```

`""` 和 `null` 都会混进结果。要区分「没写 href」和「写了空 href」，只能看 `getAttribute`。

#### 坑 4：SVG 里的 `<a>` 不是 `HTMLAnchorElement`

```
HTML <a>: constructor HTMLAnchorElement，typeof href = "string"
SVG  <a>: jsdom 中 constructor SVGElement，typeof href = "undefined"
          getAttribute('href') = "/in-svg"
```

浏览器里 SVG `<a>` 是 `SVGAElement`，`href` 是 `SVGAnimatedString` 对象（取字符串用 `href.baseVal`）；jsdom 把 SVG 里的 `<a>` 解析成 `SVGElement`，没有 `href` 属性。两种环境统一用 `getAttribute('href')` 最稳，直接 `.map(a => a.href)` 会得到 `undefined`。

#### 坑 5：`querySelectorAll` 不包含自身

```
root 就是 <a id="self"> 时
  root.querySelectorAll('a') → 0
  getLinks(root)             → []
```

`querySelectorAll` 只查后代，要包含自身得单独判断。

### 正确实现

```js
function getLinks(
  root,
  {
    absolute = true, // 是否返回绝对 URL
    includeSelf = false, // 是否包含 root 自身（当 root 是 a 时）
    filter = true, // 是否过滤无效链接
  } = {},
) {
  const list = [...root.querySelectorAll('a')];
  if (includeSelf && root.tagName === 'A') list.unshift(root);

  return list
    .map((el) => ({ el, raw: el.getAttribute('href') }))
    .filter(({ raw }) => {
      if (!filter) return true;
      if (raw == null || raw === '') return false; // 无 href / 空 href
      return !/^\s*javascript:/i.test(raw); // javascript:
    })
    .map(({ el, raw }) => {
      if (!absolute || raw == null) return raw;
      // HTML a 用 el.href；SVG a 的 href 不是字符串，退回原始值补全
      return typeof el.href === 'string' && el.href
        ? el.href
        : new URL(raw, el.ownerDocument.baseURI).href;
    });
}
```

过滤建立在原始属性上：`href=""` 和无 href 都在绝对化之前被剔除，`#hash` 仍保留。

### 实测

```
1) 默认（绝对 + 过滤）:
   ["https://example.com/a","https://other.com/b",
    "https://example.com/page/index.html#hash","https://example.com/in-svg"]

2) 相对原始值:
   ["/a","https://other.com/b","#hash","/in-svg"]

3) 不过滤:
   ["https://example.com/a","https://other.com/b","javascript:void(0)",
    "https://example.com/page/index.html",null,
    "https://example.com/page/index.html#hash","https://example.com/in-svg"]

4) root 自身是 a:
   原答案 → []
   加 includeSelf → ["https://example.com/root-itself"]
```

### 更高性能的写法（用 TreeWalker）

`querySelectorAll('a')` 会先构建完整的结果列表。DOM 很大时，`TreeWalker` 可以边遍历边筛，也能提前 `break`：

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

### DOM 遍历的三种方式对比

| 方式 | 代码量 | 能否中断 | 性能 | 适用 |
|---|---|---|---|---|
| 递归 | 少 | ❌ | 中（函数调用开销 + 爆栈风险） | 树不深时最简单 |
| `querySelectorAll('*')` | **最少** | ❌ | 快（原生实现） | 只要元素列表 |
| `TreeWalker` | 中 | ✅ | 快（边遍历边处理） | **大 DOM、要提前退出** |

实测（同一个 10 个元素的树）：

```
递归                  → 10 个（含 root 自身）
TreeWalker            → 9 个（不含 root）
querySelectorAll('*') → 9 个（不含 root）
```

三者对 root 的包含关系不一致，写代码前要先明确语义。

### TreeWalker 的三个优势

1. **不爆栈**：内部用迭代，超深 DOM 也没问题
2. **可中断**：`while` 循环里 `break` 就行
3. **支持过滤**：`NodeFilter` 在遍历阶段就筛掉不需要的节点，不用先收集再过滤

```js
// 只遍历 <a> 和 <img>
const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
  acceptNode(node) {
    return /^(A|IMG)$/.test(node.tagName)
      ? NodeFilter.FILTER_ACCEPT
      : NodeFilter.FILTER_SKIP;
  },
});
```

### 如果节点在 Shadow DOM 里

`querySelectorAll` 不穿透 Shadow DOM，必须递归进入 `shadowRoot`：

```js
function deepQueryAll(root, selector, out = []) {
  out.push(...root.querySelectorAll(selector));
  for (const el of root.querySelectorAll('*')) {
    if (el.shadowRoot) deepQueryAll(el.shadowRoot, selector, out);
  }
  return out;
}
```

实测 shadowRoot 内的 `<a>` 不会出现在 `root.querySelectorAll('a')` 的结果里，递归后才能取到。

### 追问链

| 追问 | 答法 |
|---|---|
| `querySelectorAll` 返回的是数组吗？ | 不是。是静态的 `NodeList`，有 `forEach` 但没有 `map`/`filter`，要 `[...]` 或 `Array.from` |
| `NodeList` 和 `HTMLCollection` 区别？ | `NodeList`（`querySelectorAll`）是静态的；`HTMLCollection`（`getElementsByTagName`）是活的，遍历时改 DOM 容易漏项或死循环 |
| 怎么过滤外链？ | `new URL(a.href).origin !== location.origin` |
| 为什么要过滤 `javascript:`？ | 用户可控的 href 会在点击时执行脚本，要按协议白名单过滤 |
| 大 DOM 下还有更快的方法吗？ | `TreeWalker` 边遍历边筛；正则切 HTML 容易错，不推荐；服务端预渲染时可直接生成链接列表 |
| 怎么处理相对路径？ | `new URL(raw, base)` 手动解析，或依赖 `a.href` 的自动补全 |

---

## 7.5 面试怎么说（本册通用）

- **接题思路**：先讲数据结构选型。LRU 要同时满足查、移动、淘汰最旧三个 O(1)，只有哈希表 + 双向链表能做到；EventBus 用 `Map<event, cb[]>` 换 O(1) 索引。
- **关键细节**：LRU 用哨兵节点定方向（`head.next` 最新、`tail.prev` 最旧），Node 必须存 key 才能 `map.delete`；EventBus 的 `emit` 先 `slice()` 快照，`once` 先移除再执行，每个监听器单独 `try/catch`。
- **主动补的边界**：LRU 的容量 1、重复 `put` 已有 key、`get` 刷新顺序；EventBus 的 `off(ev)` 清空与回调抛错隔离；定时器在回调内停止；DOM 的空 `href`、无 `href`、SVG `<a>`、root 自身。
- **卡壳时**：先把「需要什么数据结构、每个操作什么复杂度」说清楚，再写代码。

---

## 7.6 速记卡

```
【LRU】
哈希表 + 双向链表 = 查/移动/淘汰全 O(1)
单链表缺前驱，摘中间节点 O(n)
哨兵 head/tail 省边界；Node 存 key 才能 map.delete
Map 版：利用插入顺序，get 时 delete + set

【EventBus】
Map<event, cb[]>；emit 用 list.slice() 快照
once 先移除再执行（抛错不残留、递归不重复）
每个监听器单独 try/catch；off(ev) 不传 cb 清空
空数组 map.delete

【setInterval】
回调内 stop 无效：clearTimeout 清的是已执行的 timer
stopped 标志位，fn 前后各查一次
递归 setTimeout：不连续触发，周期 = delay + 耗时
精确间隔：next += delay; wait = max(0, next - now)

【DOM 提取 href】
a.href 是绝对 URL，getAttribute 是原始值
href="" → 当前页 URL；无 href → ""（getAttribute 为 null）
SVG a 的 href 不是字符串，用 getAttribute
querySelectorAll 不含 root 自身

【遍历三方式】
递归（爆栈、不能中断）
querySelectorAll('*')（原生实现，直接拿列表）
TreeWalker（不爆栈、可中断、可过滤）
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
□ 能说出递归 setTimeout 与原生 setInterval 的差异
□ 能说出 a.href 和 getAttribute('href') 的区别
□ 能说出 href="" 会返回什么
□ 能说出 SVG 里的 a 为什么不能用 .href
□ 能说出 querySelectorAll 和 TreeWalker 的三个差别
```
