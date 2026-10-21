# 算法 · 06 哈希与缓存：LRU

> 本册覆盖：实现一个 LRU 缓存（原题 18）
> 原题单只给了 Map 版实现。这里补：**为什么需要 LRU** → Map 版（含边界）→ **双向链表 + 哈希表版**（面试常要求）→ 两种实现对比 → LRU vs LFU → 五个真实应用 → 变体。
> 这题是「数据结构设计题」的入门款，**考的是你能否把「O(1) 查找」和「O(1) 淘汰」两个需求拼成一个结构**。

---

## 6.1 一句话结论

LRU（Least Recently Used，最近最少使用）：缓存满了就淘汰**最久没被访问**的那条。
两个 O(1) 需求逼出了唯一解：**哈希表（O(1) 定位）+ 双向链表（O(1) 删除和移动）**。JS 里因为 `Map` 天然保持插入顺序，可以只用 `Map` 写出更短的版本。

---

## 6.2 为什么需要 LRU

### 6.2.1 缓存的本质矛盾

缓存容量有限，但数据无限。**满了之后必须扔掉一些**，扔谁？

| 策略 | 淘汰谁 | 优点 | 缺点 | 典型场景 |
|---|---|---|---|---|
| **FIFO** | 最早进入的 | 最简单 | 不管「热不热」，可能淘汰掉正在用的 | 消息队列 |
| **LRU** | 最久没被访问的 | 符合「时间局部性」，实现简单 | 偶发的批量扫描会「冲刷」整个缓存 | 通用缓存（主流） |
| **LFU** | 访问次数最少的 | 保护长期热点 | 需要维护计数，新数据容易「饿死」；实现复杂 | 热点数据明显时 |
| **ARC** | 自适应调节 LRU/LFU 比例 | 兼顾两者 | 实现复杂 | ZFS、数据库 |
| **Random** | 随机 | 极简，无状态 | 命中率不可控 | Redis 的 `allkeys-random` |
| **TTL** | 过期时间 | 保证数据新鲜度 | 不解决容量问题（通常和上面组合） | HTTP 缓存 |

**LRU 为什么是主流？** 因为大多数访问模式符合**时间局部性**——刚访问过的数据，很可能马上还会被访问。LRU 正好利用这一点。

### 6.2.2 LRU 的核心假设和它的失效场景

**假设**：访问有时间局部性。

**失效场景：顺序扫描（sequential flooding）**

假设缓存容量 100，你顺序读取 1000 条数据各一次。LRU 会把 100 条全换一遍，命中率 **0%**——但实际上「重复读同一条」的场景下缓存本来就没用。

**更糟的情况**：缓存 100 条热点数据，突然来一次「全表扫描」读了 1000 条，LRU 会把 100 条热点全部冲掉。之后热点数据的访问全部 miss。

**解决方案**：
- **LRU-K**：记录最近 K 次访问时间，用第 K 次的时间排序（抵抗偶发扫描）
- **2Q**：分「试用区」和「保护区」，新数据先进试用区
- **ARC**：自适应
- **Redis 的近似 LRU**：随机采样 N 个 key，淘汰其中最久未用的（不用维护完整链表）

> 面试如果被问「LRU 有什么缺点」，答「顺序扫描会导致缓存冲刷」，并提一句「所以 Redis 用的是采样近似 LRU」——这就能拉开差距。

---

## 6.3 解法一：Map 版（最短，LeetCode 能过）

### 6.3.1 核心洞察：Map 保持插入顺序

ECMAScript 规范明确规定：**`Map` 的遍历顺序 = 键的插入顺序**。这不是 V8 的实现细节，是**语言标准**。

所以：
- `map.keys().next().value` → **第一个键 = 最早插入的 = 最久未使用的**
- `map.set(key, val)` → 如果 key 已存在，**不改变顺序**（这是坑点）
- `map.delete(key)` + `map.set(key, val)` → **删了再加 = 移到末尾 = 变成最新**

**这三条就是 Map 版 LRU 的全部原理。**

### 6.3.2 实现

```js
class LRUCache {
  constructor(capacity) {
    this.cap = capacity;
    this.map = new Map();          // 顺序：头 = 最久未用，尾 = 最近使用
  }

  get(key) {
    if (!this.map.has(key)) return -1;
    const val = this.map.get(key);
    // ★ 刷新顺序：删了再插，移到末尾
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }

  put(key, value) {
    if (this.cap <= 0) return;                 // ★ 边界：容量为 0

    if (this.map.has(key)) {
      // 已存在：删了再插，既更新值又刷新顺序
      this.map.delete(key);
    } else if (this.map.size >= this.cap) {
      // 满了：淘汰第一个（最久未使用）
      const oldestKey = this.map.keys().next().value;
      this.map.delete(oldestKey);
    }
    this.map.set(key, value);
  }
}
```

### 6.3.3 逐步推演

容量 2，依次 `put(1,1)`、`put(2,2)`、`get(1)`、`put(3,3)`、`get(2)`、`put(4,4)`、`get(1)`、`get(3)`、`get(4)`：

```
put(1,1)  map = {1=1}                    顺序: [1]
put(2,2)  map = {1=1, 2=2}               顺序: [1, 2]
get(1)    命中，delete+set               顺序: [2, 1]   ← 1 变成最新
put(3,3)  满了，淘汰第一个(2)，插入 3      顺序: [1, 3]
get(2)    未命中 → -1
put(4,4)  满了，淘汰第一个(1)，插入 4      顺序: [3, 4]
get(1)    未命中 → -1
get(3)    命中 → 3                       顺序: [4, 3]
get(4)    命中 → 4                       顺序: [3, 4]
```

**注意 `get(1)` 那一步**：如果忘了 `delete + set`，顺序会变成 `[1, 2]`，`put(3,3)` 就会淘汰 1 而不是 2，结果全错。**这是 Map 版最容易漏的一行。**

### 6.3.4 三个必须处理的边界

| 边界 | 不处理会怎样 | 处理方式 |
|---|---|---|
| **`capacity = 0`** | `map.size >= 0` 恒为真，每次都淘汰，但 `map` 是空的，`keys().next().value` 是 `undefined`，然后 `set` 又插入 → **缓存永远有 1 个元素，违反容量 0** | 开头 `if (this.cap <= 0) return` |
| **`put` 已存在的 key** | 如果只 `set` 不 `delete`，**顺序不变**，等于没刷新 | 先 `delete` 再 `set` |
| **`get` 不存在的 key** | 返回 `undefined` 而非 `-1` | 返回 `-1`（题目约定） |

**关于「put 已存在的 key 不 delete」这个坑，值得单独强调**：

```js
const m = new Map();
m.set('a', 1);
m.set('b', 2);
m.set('a', 3);          // 更新值，但顺序不变！
console.log([...m.keys()]);   // ['a', 'b']  ← a 还在前面
```

**规范就是这样定义的**：`Map.prototype.set` 对已存在的 key **只更新值，不改变位置**。所以要「刷新顺序」必须**先 `delete` 再 `set`**。

### 6.3.5 复杂度

| 操作 | 复杂度 | 说明 |
|---|---|---|
| `get` | O(1) | `has` + `get` + `delete` + `set` 都是 O(1) |
| `put` | O(1) | 同上；`keys().next()` 是 O(1)（迭代器持有指针） |
| 空间 | O(capacity) | Map 存 cap 项 |

⚠️ **`map.keys().next().value` 是 O(1) 吗？**

是的。V8 的 `Map` 内部维护一个**双向链表**记录插入顺序，迭代器持有链表指针，`next()` 就是取当前节点并前移。**不是遍历到第一个**。

> 这也解释了为什么 `Map` 能同时做到「哈希查找 O(1)」和「保持插入顺序」——它本来就是「哈希表 + 双向链表」，和 LRU 要的结构一模一样。**所以 Map 版 LRU 本质上是「用语言内置的 LRU 结构实现 LRU」**。

---

## 6.4 解法二：双向链表 + 哈希表（面试常要求手写）

### 6.4.1 为什么需要这个版本

Map 版虽然简洁，但有两个问题：
1. **面试官常常明确要求「不要用 Map 的顺序特性」**，考察你对底层结构的理解。
2. **Map 版无法做变体**（比如「访问次数达到 N 才进入保护区的 2Q」、LFU）。

所以「哈希表 + 双向链表」是必须掌握的**标准答案**。

### 6.4.2 结构设计：为什么必须是双向链表

需求拆解：

| 需求 | 需要什么结构 | 为什么 |
|---|---|---|
| 按 key 找节点 | **哈希表** `key → Node` | O(1) 定位 |
| 把节点移到「最新」位置 | 从链表中**摘下**，**插入头部** | 需要 O(1) 删除 |
| 淘汰「最旧」 | 删除尾节点 | 需要 O(1) 删除 |

**为什么删除要 O(1) 就必须双向？**

单链表删除节点 `node` 需要**前驱**才能改指针（`prev.next = node.next`），而找前驱是 O(n)。双向链表有 `node.prev`，直接 O(1)。

**这就是「哈希表 + 双向链表」这个组合的唯一性来源**：哈希表解决「找」，双向链表解决「删和移」。

### 6.4.3 图解结构

```
head(哨兵) ⇄ [最近使用] ⇄ ... ⇄ [最久未使用] ⇄ tail(哨兵)
                ↑                                  ↑
           新节点插这里                      淘汰从这里删

哈希表 map: key → Node 引用

例：容量 3，访问顺序 1, 2, 3, 再访问 1
  head ⇄ 1 ⇄ 3 ⇄ 2 ⇄ tail      （1 被移到最前）
  map: {1→N1, 2→N2, 3→N3}
  淘汰时删 tail.prev = 2，同时 map.delete(2)
```

**哨兵节点（head / tail）的作用**：消除「链表为空」「只有一个节点」「插入到头部」「删除尾节点」的所有特判。

没有哨兵时，`_remove` 必须写：

```js
_remove(node) {
  if (node.prev) node.prev.next = node.next;
  else this.head = node.next;          // node 是头
  if (node.next) node.next.prev = node.prev;
  else this.tail = node.prev;          // node 是尾
}
```

有哨兵时，只需两行，**没有 if**：

```js
_remove(node) {
  node.prev.next = node.next;
  node.next.prev = node.prev;
}
```

> 这就是「哨兵节点能把代码复杂度降一个量级」的典型例子，和链表的 dummy 节点是同一个思想。

### 6.4.4 完整实现

```js
class Node {
  constructor(key, val) {
    this.key = key;      // ★ 必须存 key，淘汰时要靠它去 map 里删
    this.val = val;
    this.prev = null;
    this.next = null;
  }
}

class LRUCache {
  constructor(capacity) {
    this.cap = capacity;
    this.map = new Map();

    // 哨兵：head.next 是最近使用，tail.prev 是最久未使用
    this.head = new Node(0, 0);
    this.tail = new Node(0, 0);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  // 从链表中摘下（不删除 map）
  _remove(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
    // 可选：node.prev = node.next = null  （帮助 GC，但不是必须）
  }

  // 插到 head 后面 = 标记为「最近使用」
  _addToFront(node) {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next.prev = node;
    this.head.next = node;
  }

  get(key) {
    const node = this.map.get(key);
    if (!node) return -1;              // 未命中
    this._remove(node);
    this._addToFront(node);            // 刷新为最近使用
    return node.val;
  }

  put(key, value) {
    if (this.cap <= 0) return;

    const node = this.map.get(key);
    if (node) {
      // 已存在：更新值 + 刷新位置
      node.val = value;
      this._remove(node);
      this._addToFront(node);
      return;
    }

    // 容量满：淘汰最久未使用（tail.prev）
    if (this.map.size >= this.cap) {
      const oldest = this.tail.prev;
      this._remove(oldest);
      this.map.delete(oldest.key);     // ★ 靠 node.key 才能删对
    }

    // 插入新节点
    const newNode = new Node(key, value);
    this.map.set(key, newNode);
    this._addToFront(newNode);
  }
}
```

### 6.4.5 三个必须理解的细节

**① `Node` 为什么必须存 `key`？**

淘汰时拿到的是 `tail.prev`（一个 Node），需要从 `map` 里删掉对应项，但 `map` 的键是 `key`。**Node 不存 key 就无法反查**。

这是最容易被忽略的一行，面试写漏了就会卡在「怎么删 map」。

**② `_addToFront` 的四行顺序不能乱**

```js
node.prev = this.head;              // 1. node 的前驱
node.next = this.head.next;         // 2. node 的后继
this.head.next.prev = node;         // 3. 原第一个节点的前驱指向 node
this.head.next = node;              // 4. head 的后继指向 node
```

**为什么 3 必须在 4 之前？** 因为第 4 步会覆盖 `this.head.next`，之后就找不到「原第一个节点」了。必须先把它的 `prev` 改好。

**③ `get` 命中后必须移动节点**

```js
this._remove(node);
this._addToFront(node);
```

不移动的话，「最近使用」的语义就丢了，淘汰顺序会错。

### 6.4.6 逐步推演（容量 2）

```
初始: head ⇄ tail        map: {}

put(1,1):
  新建 N1，_addToFront → head ⇄ N1 ⇄ tail
  map: {1→N1}

put(2,2):
  head ⇄ N2 ⇄ N1 ⇄ tail
  map: {1→N1, 2→N2}

get(1) → 1:
  _remove(N1) → head ⇄ N2 ⇄ tail
  _addToFront(N1) → head ⇄ N1 ⇄ N2 ⇄ tail
  map 不变

put(3,3):
  满了，oldest = tail.prev = N2
  _remove(N2) → head ⇄ N1 ⇄ tail
  map.delete(2) → {1→N1}
  新建 N3，_addToFront → head ⇄ N3 ⇄ N1 ⇄ tail
  map: {1→N1, 3→N3}

get(2) → -1  ✅（2 已被淘汰）
```

---

## 6.5 两种实现对比

| | Map 版 | 双向链表 + 哈希表 |
|---|---|---|
| 代码量 | ~20 行 | ~60 行 |
| `get` 复杂度 | O(1) | O(1) |
| `put` 复杂度 | O(1) | O(1) |
| 空间 | O(cap) | O(cap)，但常数更大（每个节点 4 个字段） |
| 依赖 | Map 的插入顺序（规范保证） | 无 |
| 可扩展性 | 差（改不动内部结构） | **好**（能改造成 LFU、2Q） |
| 面试适用 | ✅ 能过 | ✅✅ **首选，展示理解** |
| 真实工程 | 少用（不够灵活） | 常用（Redis、LevelDB 都是类似结构） |

**面试策略**：

> 「最简洁的写法是用 `Map`，因为规范保证它按插入顺序遍历，`delete` + `set` 就能刷新顺序，淘汰时取第一个键。但如果要求不用 Map 的顺序特性，标准做法是哈希表 + 双向链表：哈希表存 key 到节点的引用做 O(1) 定位，双向链表维护访问顺序，`get` 命中就摘下来插到头部，`put` 满了就删尾节点。两个结构各解决一个问题：哈希表解决『找』，双向链表解决『O(1) 删除』。」

**这一段话把「两个方案 + 为什么」全说了**，是最理想的答法。

---

## 6.6 LRU vs LFU

面试常追问「LRU 和 LFU 有什么区别」，甚至要求现场实现 LFU（LeetCode 460，Hard）。

### 6.6.1 核心差异

| | **LRU** | **LFU** |
|---|---|---|
| 淘汰依据 | **最后一次访问时间** | **访问次数** |
| 数据结构 | 哈希表 + 1 条双向链表 | 哈希表 + **每个频率一条双向链表** + 最小频率指针 |
| `get`/`put` | O(1) | O(1) |
| 实现难度 | 中 | **高**（要处理频率链表的增删和 minFreq 维护） |
| 抗扫描 | ❌ 一次扫描冲刷全部 | ✅ 热点数据访问次数高，不会被冲掉 |
| 新数据 | 天然友好（刚插入就是最新） | ❌ **容易饿死**（新数据 count=1，稍不留神就被淘汰） |
| 缓存污染 | 一次全表扫描就废 | 抗污染 |

### 6.6.2 LFU 的「饿死」问题

假设缓存里有 3 个 key，访问次数分别是 `100, 100, 1`。现在来一个新 key（count=1），缓存满了要淘汰——LFU 会淘汰 count 最小的那个（可能是新来的，也可能是老的 count=1 的）。

如果持续有新数据涌入，每次都是 count=1、每次都被立刻淘汰，**新数据永远进不了缓存**。这叫 **cache pollution / 饿死**。

**解决方案**：LFU with aging（定期把所有 count 减半），或给新数据一个「初始 boost」。

### 6.6.3 LFU 的结构（了解即可）

```
freqMap: freq → 双向链表（存该频率的所有 key，按访问时间排序）
keyMap:  key → {value, freq, node}
minFreq: 当前最小频率（淘汰时从 freqMap[minFreq] 的尾部取）
```

**关键点**：同一频率内用 LRU 排序（所以 LFU 是「LRU 的分层版」）。`minFreq` 只在「最小频率的链表变空」时 +1，不需要每次扫描。

**为什么 LFU 难写？** 因为 `get` 时要把节点从 `freqMap[f]` 移到 `freqMap[f+1]`，还要维护 `minFreq`；`put` 新 key 时可能创建新的 `freqMap[1]`。边界极多。

> 面试话术：「LFU 用『频率 → 双向链表』的哈希表，每个频率内部按 LRU 排序，再加一个 minFreq 指针。复杂度也是 O(1) 但实现复杂得多，而且新数据容易饿死，所以实际系统里 LRU 更常见，或者用 LRU-K / 2Q 这种折中方案。」

---

## 6.7 五个真实应用

LRU 不只是面试题，它是**真实系统里最高频的缓存策略**。

### 6.7.1 Vue 的 `<keep-alive :max="10">`

这个**前面 keep-alive 文档里讲过**，这里串起来：

Vue 的 `KeepAlive` 内部维护 `cache: Map` 和 `keys: Set`。当缓存数量超过 `max` 时：

```js
// Vue 3 源码（简化）
if (max && keys.size > parseInt(max, 10)) {
  // keys 的第一个就是最久未使用的
  pruneCacheEntry(keys.values().next().value)
}
```

**每次渲染被缓存的组件时，会把它从 `keys` 里删掉再重新 `add`**，这就是「刷新为最近使用」。和 LRU 的 `delete + set` 完全同构。

> 面试如果能把 keep-alive 的 LRU 和这道题串起来讲，是很强的加分点——说明你有「知识网络」而不是孤立背题。

### 6.7.2 HTTP 缓存（浏览器）

浏览器的 HTTP 缓存淘汰是 **LRU + 大小限制**的组合。Chrome 的磁盘缓存用 LRU 变体（考虑资源大小和优先级）。

### 6.7.3 Redis 的 `maxmemory-policy allkeys-lru`

Redis 用的是**近似 LRU**：不维护完整链表（太耗内存），而是**随机采样 N 个 key（默认 5），淘汰其中最久未用的**。

**为什么近似就够？** 因为精确 LRU 要为每个 key 维护 `prev`/`next` 指针（16 字节 × 数百万 key = 几十 MB），而采样 5 个的命中率已经接近精确 LRU（Redis 作者实测差距 < 5%）。

**Redis 4.0 之后还有 LFU 策略**（`allkeys-lfu`），用 8 bit 的概率计数器（不是精确计数），并支持衰减。

### 6.7.4 数据库的 Buffer Pool

MySQL InnoDB 的 Buffer Pool 用**改进的 LRU**：分成「young 区」（约 5/8）和「old 区」（约 3/8），新读入的页先进 old 区，只有被再次访问才进 young 区。

**这样设计正是为了抵抗「全表扫描冲刷缓存」**——扫描读进来的页只在 old 区，不会把 young 区的热点页挤掉。

### 6.7.5 前端：图片/接口缓存、路由缓存

| 场景 | 实现 |
|---|---|
| 图片懒加载缓存 | 限制并发数 + 已完成列表 LRU |
| 接口响应缓存 | `Map` + `max` + TTL |
| 路由页面缓存 | keep-alive 的 `max` |
| 虚拟列表的测量缓存 | 固定容量 Map |

**一个前端实战例子**：

```js
// 带 TTL 的 LRU 接口缓存（前端真实会用）
class TTLCache {
  constructor(capacity, ttl) {
    this.cap = capacity;
    this.ttl = ttl;
    this.map = new Map();     // key → { value, expire }
  }
  get(key) {
    const item = this.map.get(key);
    if (!item) return undefined;
    if (Date.now() > item.expire) {       // 过期
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, item);              // 刷新 LRU 顺序
    return item.value;
  }
  set(key, value) {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.cap) {
      this.map.delete(this.map.keys().next().value);
    }
    this.map.set(key, { value, expire: Date.now() + this.ttl });
  }
}
```

---

## 6.8 三个变体题

### 6.8.1 变体：LRU 但要求 `get` 是 O(1) 且不用 Map

就是 6.4 的版本。**必须用双向链表 + 哈希表**。

### 6.8.2 变体：LFU（LeetCode 460）

见 6.6.3 的结构说明。完整实现约 100 行，面试现场写不完，**能讲清结构就够**。

### 6.8.3 变体：设计一个「最近最少使用」但容量按「总字节数」算

把 `map.size` 换成 `totalBytes`，淘汰时循环删尾节点直到 `totalBytes <= cap`。

```js
put(key, value) {
  // ...
  this.totalBytes += sizeOf(value);
  while (this.totalBytes > this.cap && this.map.size > 0) {
    const oldest = this.tail.prev;
    this._remove(oldest);
    this.map.delete(oldest.key);
    this.totalBytes -= sizeOf(oldest.val);
  }
}
```

**注意 `while` 而不是 `if`**：一个大对象可能一次要淘汰好几个小对象。

---

## 6.9 常见坑

| 坑 | 后果 | 修正 |
|---|---|---|
| `get` 命中后没刷新顺序 | 淘汰顺序错，语义变成 FIFO | `delete` + `set` / `_remove` + `_addToFront` |
| `put` 已存在的 key 只 `set` | Map 版顺序不变，没刷新 | 先 `delete` |
| `capacity = 0` 没处理 | Map 版永远留 1 个元素 | 开头 `return` |
| Node 没存 `key` | 淘汰时不知道从 map 删哪个 | `constructor(key, val)` |
| `_addToFront` 四行顺序乱 | 链表断裂或成环 | 先改 `node`，再改「原第一个」，最后改 `head` |
| 单向链表 | 删除需要找前驱，O(n) | 必须双向 |
| `get` 未命中返回 `undefined` | 和 0 混淆 | 返回 `-1` |
| 用 `Map.size` 判断但用链表存 | 两套结构不同步 | 只用一个真源，或严格同步 |
| 忘了哨兵，写一堆 if | 边界 bug 频发 | 用 head/tail 哨兵 |

**最阴险的坑：`_addToFront` 的赋值顺序**

```js
// ❌ 错误：先把 head.next 改了，就找不到原第一个节点
_addToFront(node) {
  node.prev = this.head;
  node.next = this.head.next;
  this.head.next = node;              // ← 此时原第一个节点的引用丢了
  this.head.next.prev = node;         // ← 变成 node.prev = node，成环
}
```

**这个 bug 的后果是链表自环**，`get` 时会死循环（虽然本实现里 `get` 不遍历，所以可能不崩，但结构已经错了，淘汰时会出问题）。

---

## 6.10 答题模板

### 30 秒版

> LRU 是「最近最少使用」淘汰。要同时做到 O(1) 查找和 O(1) 淘汰，标准结构是「哈希表 + 双向链表」：哈希表存 key 到节点的引用，双向链表维护访问顺序，头是最近使用、尾是最久未使用。`get` 命中就把节点摘下来插到头部；`put` 满了就删尾节点，并从哈希表里删掉对应 key。
> 之所以必须双向链表，是因为删除节点需要前驱，单链表找前驱是 O(n)。
> 在 JS 里可以用 `Map` 写更短的版本，因为规范保证 Map 按插入顺序遍历，`delete` + `set` 就能刷新顺序，淘汰时取第一个键。

### 2 分钟版（加分层）

> LRU 的需求可以拆成两个 O(1)：按 key 找、把节点移到最新位置、淘汰最旧。三个操作都需要 O(1)。
> 哈希表解决「找」，O(1)。但哈希表本身不维护顺序，所以需要一个链表记录「谁最久没用」。链表要支持 O(1) 删除，就必须是双向的——单链表删节点要先找前驱，那是 O(n)。
> 结构上我用两个哨兵 head 和 tail，这样删除和插入都不用判空、不用判头尾，`_remove` 就两行。节点里必须存 key，因为淘汰时拿到的是尾节点，要从哈希表里删掉对应项，没有 key 就删不了。
> `get` 命中时先把节点从链表摘下，再插到 head 后面，标记为最近使用。`put` 分三种情况：key 已存在就更新值并刷新位置；容量满就先删 tail.prev 并同步删哈希表；最后插入新节点到头部。
> 另外有个更短的写法是用 Map：Map 在规范层面保证按插入顺序遍历，所以第一个键就是最久未用的。刷新顺序就是 delete 再 set。但要注意两个坑：一是 `set` 已存在的 key 不会改变顺序，必须先 delete；二是容量为 0 要特判，否则会永远留一个元素。
> 如果想体现深度，可以提一句：Map 内部本来就是「哈希表 + 双向链表」，所以 Map 版 LRU 本质上是「用内置的 LRU 结构实现 LRU」。Redis 的近似 LRU 则是另一个思路——不维护完整链表，随机采样 5 个 key 淘汰最久未用的，省内存且命中率接近精确 LRU。

### 追问表

| 追问 | 回答要点 |
|---|---|
| 为什么用双向链表不用单链表？ | 删除需要前驱，单链表找前驱 O(n) |
| 为什么节点要存 key？ | 淘汰时拿尾节点，要反查哈希表删除项 |
| 哨兵节点有什么用？ | 消除空链表/头尾特判，`_remove` 从 6 行降到 2 行 |
| Map 版为什么能工作？ | 规范保证 Map 按插入顺序遍历；`keys().next()` 是 O(1) |
| `set` 已存在的 key 会改变顺序吗？ | 不会，只更新值；必须 `delete` 再 `set` |
| LRU 有什么缺点？ | 顺序扫描会冲刷整个缓存（缓存污染） |
| 怎么解决缓存污染？ | LRU-K、2Q、ARC、Redis 的采样近似 |
| LRU 和 LFU 区别？ | LRU 看时间，LFU 看次数；LFU 抗污染但新数据易饿死 |
| LFU 怎么实现 O(1)？ | 频率 → 双向链表的哈希表 + minFreq 指针 |
| Redis 的 LRU 是精确的吗？ | 不是，是采样近似（默认采样 5 个） |
| Vue keep-alive 的 max 是什么策略？ | LRU，cache 是 Map，keys 是 Set，超限删第一个 |
| 淘汰时怎么处理引用？ | 链表摘除 + `map.delete`，两处必须同步 |

---

## 6.11 本册速记卡

```
LRU = 哈希表（O(1) 找）+ 双向链表（O(1) 删/移）
  单向不行：删节点要前驱
  节点必须存 key：淘汰时反查 map
  哨兵 head/tail：消除空链表和头尾特判

链表版三步
  get 命中 → _remove + _addToFront
  put 已存在 → 改 val + _remove + _addToFront
  put 新的且满 → 删 tail.prev + map.delete(它的 key) + 插头部

_addToFront 顺序（不能乱）
  node.prev = head
  node.next = head.next
  head.next.prev = node      ← 必须在改 head.next 之前
  head.next = node

Map 版
  规范保证按插入顺序遍历 → 第一个键 = 最久未用
  刷新顺序 = delete + set
  两个坑：set 已存在的 key 不改顺序（要先 delete）；cap=0 要特判

LRU vs LFU
  LRU 看时间，LFU 看次数
  LRU 怕顺序扫描，LFU 怕新数据饿死
  LFU = 频率→双向链表的哈希表 + minFreq

真实应用
  Vue keep-alive :max
  浏览器 HTTP 缓存
  Redis allkeys-lru（采样近似，默认 5 个）
  InnoDB Buffer Pool（young/old 分区抗扫描）
```
