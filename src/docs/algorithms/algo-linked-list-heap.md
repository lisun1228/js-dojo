# 算法 · 05 链表与堆：合并 K 个升序链表

> 覆盖：合并 K 个升序链表——顺序合并 / 分治 / 最小堆
> 前置：dummy 节点、快慢指针、断链、两链合并；后附 6 个链表变体与常见坑

---

## 目录

- [5.1 一句话结论](#51-一句话结论)
- [5.2 前置：链表题的三板斧](#52-前置链表题的三板斧)
- [5.3 第一步：合并两个有序链表](#53-第一步合并两个有序链表)
- [5.4 解法一：顺序合并（暴力，O(k²n)）](#54-解法一顺序合并暴力ok²n)
- [5.5 解法二：分治（推荐，代码短、常数小）](#55-解法二分治推荐代码短常数小)
- [5.6 解法三：最小堆（O(N log k)）](#56-解法三最小堆on-log-k)
- [5.7 三种解法对比](#57-三种解法对比)
- [5.8 链表题通用技巧总结](#58-链表题通用技巧总结)
- [5.9 六个高频变体（面试很可能顺着问）](#59-六个高频变体面试很可能顺着问)
- [5.10 常见坑](#510-常见坑)
- [5.11 答题模板](#511-答题模板)
- [5.12 本册速记卡](#512-本册速记卡)

---

## 5.1 一句话结论

把 k 个有序链表合并成一个有序链表。三种解法：顺序两两合并 O(k²n)、分治 O(N log k)、最小堆 O(N log k)。N 为节点总数，n 为单链表平均长度，k 为链表数。
分治与堆复杂度相同：分治常数更小、代码更短；堆支持 k 未知或流式输入。

---

## 5.2 前置：链表题的三板斧

三种解法都建立在这三个指针操作上。

### 5.2.1 哑节点（dummy head）

头节点特判是链表题的主要 bug 来源。dummy 把「头」变成「普通节点」，插入逻辑无需特判。

```js
const dummy = { val: 0, next: null };
let tail = dummy;
for (const v of values) {
  tail.next = { val: v, next: null };
  tail = tail.next;
}
return dummy.next;               // 返回 dummy.next，不是 dummy
```

### 5.2.2 快慢指针

| 用途 | 写法 |
|---|---|
| **找中点**（偶数时停在左中点） | `slow = head, fast = head.next`，`while (fast && fast.next)` |
| **找中点**（偶数时停在右中点） | `slow = head, fast = head`，同上循环条件 |
| **找倒数第 N 个** | `fast` 先走 N 步，再与 `slow` 同步走 |
| **判环** | 同起点，`slow` 走 1 步、`fast` 走 2 步，相遇则有环 |

```js
// 找中点（左中点），用于归并排序的「断开」
function findMid(head) {
  let slow = head, fast = head.next;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
  }
  return slow;
}
// [1,2,3,4] → slow 停在 2（左中点）
// [1,2,3,4,5] → slow 停在 3（正中间）
```

`fast = head.next` 让 `slow` 停在左中点，保证左半长度 ≤ 右半；换成 `fast = head` 时偶数长度会停在右中点，切分点右移，左半比右半长，递归深度变差。

### 5.2.3 断链

合并/排序链表前必须显式断开，否则左半尾节点仍指向右半，递归会把整个右半「吞」进左半，导致无限递归或结果重复。

```js
const mid = findMid(head);
const right = mid.next;
mid.next = null;          // 必须断开
```

---

## 5.3 第一步：合并两个有序链表

K 个链表的合并建立在两两合并之上（LeetCode 21）。

### 5.3.1 迭代版（推荐）

```js
function mergeTwo(a, b) {
  const dummy = { val: 0, next: null };
  let tail = dummy;

  while (a && b) {
    // <= 保证稳定：相等时优先取 a
    if (a.val <= b.val) {
      tail.next = a;
      a = a.next;
    } else {
      tail.next = b;
      b = b.next;
    }
    tail = tail.next;
  }

  tail.next = a || b;      // 剩余部分本身有序，O(1) 接上
  return dummy.next;
}
```

1. `tail.next = a || b` 直接接上剩余链，不需要再遍历。
2. `<=` 在相等时取 `a`，保持稳定。
3. 复用原节点，空间 O(1)。

### 5.3.2 递归版（更短，但有栈风险）

```js
function mergeTwoRec(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (a.val <= b.val) {
    a.next = mergeTwoRec(a.next, b);
    return a;
  } else {
    b.next = mergeTwoRec(a, b.next);
    return b;
  }
}
```

空间 O(n)（递归栈），n 为两链表总长，长链表会爆栈。`a.next = mergeTwoRec(...)` 前面还有赋值，不是尾调用，不能依赖 TCO。

### 5.3.3 合并两个有序数组（对比，常被一起问）

数组版要从**后往前**填，避免覆盖：

```js
// nums1 长度 m+n，前 m 个有效，后 n 个是 0 占位
function mergeArray(nums1, m, nums2, n) {
  let i = m - 1, j = n - 1, k = m + n - 1;
  while (j >= 0) {                    // 只需判断 j
    if (i >= 0 && nums1[i] > nums2[j]) nums1[k--] = nums1[i--];
    else nums1[k--] = nums2[j--];
  }
  return nums1;
}
```

`nums1` 尾部是占位 0，从后往前写入不会覆盖未处理元素；从前往后则必须额外开数组。
循环条件只判断 `j >= 0`：`nums2` 合并完后，`nums1` 剩余元素已在正确位置。

---

## 5.4 解法一：顺序合并（暴力，O(k²n)）

最直接的做法：`result = merge(result, lists[0])`，再与 `lists[1]` 合并，依次到 `lists[k-1]`。

```js
function mergeKSequential(lists) {
  if (!lists || lists.length === 0) return null;
  let result = null;
  for (const list of lists) {
    result = mergeTwo(result, list);
  }
  return result;
}
```

### 5.4.1 为什么是 O(k²n)

假设每个链表长度都是 n，总节点数 `N = kn`：

```
第 1 次合并：0 + n = n 个节点
第 2 次合并：n + n = 2n
第 3 次合并：2n + n = 3n
...
第 k 次合并：kn

总代价 = n(1 + 2 + ... + k) = n·k(k+1)/2 = O(k²n) = O(kN)
```

`result` 越来越长，但每次都从头遍历，前面合并好的节点被重复扫描 k 次。

### 5.4.2 什么时候可以用

- k 很小（个位数）：O(k²n) 与 O(N log k) 差距不大，代码最短。

---

## 5.5 解法二：分治（推荐，代码短、常数小）

### 5.5.1 思路

k 个链表两两配对合并，一轮后剩 k/2 条，共 `log₂k` 轮。

```
第 1 轮：L0+L1, L2+L3, L4+L5, L6+L7      → k/2 条
第 2 轮：+           +                    → k/4 条
...
第 log k 轮：                              → 1 条
```

每轮的总节点数都是 N（所有节点在该轮各合并一次），共 log k 轮 → **O(N log k)**。

### 5.5.2 实现

```js
function mergeKDivide(lists) {
  if (!lists || lists.length === 0) return null;

  function divide(lo, hi) {
    if (lo === hi) return lists[lo];
    if (lo + 1 === hi) return mergeTwo(lists[lo], lists[hi]);
    const mid = (lo + hi) >> 1;
    return mergeTwo(divide(lo, mid), divide(mid + 1, hi));
  }

  return divide(0, lists.length - 1);
}
```

两个终止条件：`lo === hi` 返回单条链（`null` 交给 `mergeTwo` 处理）；`lo + 1 === hi` 直接合并两条。没有第二个条件也能正确终止，只是会多一层 `divide(lo, lo)` 的无意义递归。

### 5.5.3 迭代版（自底向上，不需要递归）

```js
function mergeKIterative(lists) {
  if (!lists || lists.length === 0) return null;
  let arr = lists.filter(Boolean);           // 先去掉 null
  if (arr.length === 0) return null;

  while (arr.length > 1) {
    const next = [];
    for (let i = 0; i < arr.length; i += 2) {
      if (i + 1 < arr.length) next.push(mergeTwo(arr[i], arr[i + 1]));
      else next.push(arr[i]);                // 落单的直接带入下一轮
    }
    arr = next;
  }
  return arr[0];
}
```

`else next.push(arr[i])`：奇数个链表时最后一个落单，必须带入下一轮，否则丢数据。

---

## 5.6 解法三：最小堆（O(N log k)）

### 5.6.1 思路

维护一个大小为 k 的最小堆，堆里放每条链表当前未合并的头节点。

1. k 个链表的头节点入堆
2. 弹出堆顶（当前最小节点），接到结果链表尾部
3. 该节点的 `next` 入堆（如果存在）
4. 重复直到堆空

每个节点入堆一次、出堆一次，单次操作 O(log k)（堆大小是 k，不是 N），总 O(N log k)。

### 5.6.2 手写最小堆

JS 没有内置堆，优先队列需要手写：

```js
class MinHeap {
  constructor(cmp = (a, b) => a - b) {
    this.a = [];
    this.cmp = cmp;
  }
  get size() { return this.a.length; }
  peek() { return this.a[0]; }

  push(x) {
    this.a.push(x);
    this._siftUp(this.a.length - 1);
  }

  pop() {
    const a = this.a;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0) {
      a[0] = last;
      this._siftDown(0);
    }
    return top;
  }

  _siftUp(i) {
    const a = this.a;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.cmp(a[i], a[p]) >= 0) break;
      [a[i], a[p]] = [a[p], a[i]];
      i = p;
    }
  }

  _siftDown(i) {
    const a = this.a;
    const n = a.length;
    while (true) {
      const l = 2 * i + 1, r = l + 1;
      let best = i;
      if (l < n && this.cmp(a[l], a[best]) < 0) best = l;
      if (r < n && this.cmp(a[r], a[best]) < 0) best = r;
      if (best === i) break;
      [a[i], a[best]] = [a[best], a[i]];
      i = best;
    }
  }
}
```

### 5.6.3 用堆合并 K 链表

```js
function mergeKHeap(lists) {
  if (!lists || lists.length === 0) return null;

  const heap = new MinHeap((x, y) => x.val - y.val);
  for (const node of lists) {
    if (node) heap.push(node);           // 过滤 null
  }

  const dummy = { val: 0, next: null };
  let tail = dummy;

  while (heap.size > 0) {
    const node = heap.pop();
    tail.next = node;
    tail = node;

    if (node.next) heap.push(node.next);
  }

  tail.next = null;                      // 收尾：规范输入下末节点 next 本就是 null
  return dummy.next;
}
```

`if (node)` 过滤空链表，否则入堆后取 `.val` 会报错。`tail.next = null` 对规范输入不改变结果，只是显式收尾。

### 5.6.4 一个更省事的写法（k 很小时）

k 很小时可以不用堆：用数组保存各链当前头，每次线性找最小。

```js
function mergeKSmallK(lists) {
  const arr = lists.filter(Boolean);
  const dummy = { val: 0, next: null };
  let tail = dummy;

  while (true) {
    let minIdx = -1;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] && (minIdx === -1 || arr[i].val < arr[minIdx].val)) minIdx = i;
    }
    if (minIdx === -1) break;
    tail.next = arr[minIdx];
    tail = arr[minIdx];
    arr[minIdx] = arr[minIdx].next;
  }
  tail.next = null;
  return dummy.next;
}
```

复杂度 O(Nk)（每次找最小 O(k)）。k 固定时它比 O(N log k) 多一个 k/log k 因子，但省掉堆的 siftUp/siftDown 比较与交换，k 很小时常数因子占主导。

---

## 5.7 三种解法对比

### 5.7.1 复杂度

| 解法 | 时间 | 空间 | 代码量 | 适用 |
|---|---|---|---|---|
| 顺序合并 | O(k²n) = O(kN) | O(1) | 最短 | k 很小 |
| **分治** | **O(N log k)** | O(log k) 栈 | 短 | **通用** |
| **最小堆** | **O(N log k)** | **O(k)** | 长（要写堆） | k 很大 / 流式 |
| 线性找最小 | O(Nk) | O(1) | 短 | k 很小 |

### 5.7.2 分治 vs 堆：都是 O(N log k)，选哪个？

| 维度 | 分治 | 堆 |
|---|---|---|
| 常数因子 | **更小**（只有指针操作） | 较大（siftUp/siftDown 有多次比较和交换） |
| 空间 | O(log k) 栈 | O(k) 堆数组 |
| 代码量 | **短** | 长（要手写堆） |
| **k 未知 / 流式输入** | 需要预先知道所有链表 | 来一个 push 一个 |

结论：
- 默认选分治：代码短、常数小、不容易写错。
- 输入是流式的、k 不固定：必须用堆，分治需要一次性拿到所有链表。

### 5.7.3 一个容易搞错的点：堆的大小是 k 不是 N

堆里最多同时有 k 个节点（每条链表一个当前头），每次 push/pop 是 `O(log k)`。若把堆大小当成 N，会得出错误的 `O(N log N)`。k = 100、N = 10⁶ 时 `log k ≈ 7`、`log N ≈ 20`，这是 k 小、N 大时堆的优势来源。

---

## 5.8 链表题通用技巧总结

### 5.8.1 反转与头插法

反转链表（基础操作）：

```js
function reverseList(head) {
  let prev = null, cur = head;
  while (cur) {
    const next = cur.next;    // 先存下一个
    cur.next = prev;          // 反转指针
    prev = cur;               // prev 前移
    cur = next;               // cur 前移
  }
  return prev;                // 返回新头 prev，此时 cur 为 null
}
```

三点：先存 `next`，否则反转后找不到后半段；返回 `prev` 而非 `cur`；空链表返回 `null`、单节点返回自身。

头插法构造逆序链：

```js
node.next = dummy.next;
dummy.next = node;
```

### 5.8.2 链表题调试技巧

调试时把链表转成数组，比在脑子里模拟指针可靠：

```js
function toArray(head, limit = 20) {
  const out = [];
  let cur = head, i = 0;
  while (cur && i++ < limit) { out.push(cur.val); cur = cur.next; }
  if (cur) out.push('...');
  return out;
}
```

`limit` 防止链表有环时死循环。

---

## 5.9 六个高频变体（面试很可能顺着问）

### 5.9.1 链表排序（LeetCode 148）

链表排序用归并而非快排：快排的 partition 需要随机访问，链表只能顺序遍历；归并的 merge 只改指针。

```js
function sortList(head) {
  if (!head || !head.next) return head;

  // 1. 找中点并断开
  let slow = head, fast = head.next;
  while (fast && fast.next) { slow = slow.next; fast = fast.next.next; }
  const mid = slow.next;
  slow.next = null;

  // 2. 递归排序两半
  const left = sortList(head);
  const right = sortList(mid);

  // 3. 合并
  return mergeTwo(left, right);
}
```

时间 O(n log n)，空间 O(log n)（只有递归栈，不需要额外数组），优于数组归并的 O(n)。

### 5.9.2 重排链表（LeetCode 143）

把 `L0 → L1 → ... → Ln` 变成 `L0 → Ln → L1 → Ln-1 → ...`。三步：找中点 → 反转后半 → 交替合并。

```js
function reorderList(head) {
  if (!head || !head.next) return head;

  // 1. 找中点
  let slow = head, fast = head.next;
  while (fast && fast.next) { slow = slow.next; fast = fast.next.next; }

  // 2. 反转后半
  let prev = null, cur = slow.next;
  slow.next = null;                    // 断开
  while (cur) {
    const next = cur.next;
    cur.next = prev;
    prev = cur;
    cur = next;
  }

  // 3. 交替合并
  let a = head, b = prev;
  while (b) {
    const aNext = a.next, bNext = b.next;
    a.next = b;
    b.next = aNext;
    a = aNext;
    b = bNext;
  }
  return head;
}
```

### 5.9.3 删除倒数第 N 个节点（LeetCode 19）

一次遍历：`fast` 从 dummy 先走 n+1 步，`slow`/`fast` 同步走到 `fast` 为 null，`slow` 停在待删节点的前一个。

```js
function removeNthFromEnd(head, n) {
  const dummy = { next: head };
  let slow = dummy, fast = dummy;

  for (let i = 0; i <= n; i++) fast = fast.next;   // fast 先走 n+1 步
  while (fast) { slow = slow.next; fast = fast.next; }

  slow.next = slow.next.next;
  return dummy.next;
}
```

`slow` 必须停在待删节点的前一个，才能执行 `slow.next = slow.next.next`；dummy 让删除头节点也统一处理。

### 5.9.4 判断链表是否有环（LeetCode 141）+ 找环入口（142）

```js
// 141：Floyd 判圈
function hasCycle(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) return true;
  }
  return false;
}

// 142：找入口（相遇后，一个指针回到 head，同速前进）
function detectCycle(head) {
  let slow = head, fast = head;
  while (fast && fast.next) {
    slow = slow.next;
    fast = fast.next.next;
    if (slow === fast) {
      let p = head;
      while (p !== slow) { p = p.next; slow = slow.next; }
      return p;
    }
  }
  return null;
}
```

相遇后同速走能到入口：设头到入口距离 `a`、入口到相遇点 `b`、环长 `c`。相遇时 `slow` 走了 `a+b`，`fast` 走了 `a+b+kc`，由 `fast = 2 × slow` 得 `a = kc - b = (k-1)c + (c-b)`。`c-b` 是相遇点继续走到入口的距离，所以从头走 `a` 步与从相遇点走 `c-b` 步同时到达入口。

### 5.9.5 相交链表（LeetCode 160）

两条链在某个节点相交（Y 形），求交点。两个指针分别走「自己的链 + 对方的链」，总路程相同，必然同时到达交点。

```js
function getIntersectionNode(a, b) {
  let p = a, q = b;
  while (p !== q) {
    p = p ? p.next : b;      // 走到尽头就换到另一条链
    q = q ? q.next : a;
  }
  return p;                  // 无交点时同时为 null
}
```

`p` 走 `lenA + lenB`，`q` 也走 `lenB + lenA`，路程相同。有交点时在交点相遇；无交点时同时变成 `null`。

### 5.9.6 回文链表（LeetCode 234）

三步：找中点 → 反转后半 → 逐位比较（可再反转回来恢复原链表）。

```js
function isPalindromeList(head) {
  if (!head || !head.next) return true;

  let slow = head, fast = head;
  while (fast.next && fast.next.next) { slow = slow.next; fast = fast.next.next; }

  // 反转后半
  let prev = null, cur = slow.next;
  while (cur) { const n = cur.next; cur.next = prev; prev = cur; cur = n; }

  // 比较
  let p = head, q = prev;
  let ok = true;
  while (q) {
    if (p.val !== q.val) { ok = false; break; }
    p = p.next; q = q.next;
  }

  // 恢复（可选）
  let back = null;
  while (prev) { const n = prev.next; prev.next = back; back = prev; prev = n; }

  return ok;
}
```

这里用 `fast = head`（循环条件 `fast.next && fast.next.next`）：奇数长度时 `slow` 停在正中间，偶数时停在左中点，后半长度不超过前半，比较循环以 `q` 走完为界。

---

## 5.10 常见坑

| 坑 | 后果 | 修正 |
|---|---|---|
| 忘记 `return dummy.next` | 返回假头，多一个 0 | `return dummy.next` |
| `mergeTwo` 剩余部分用 while 追加 | 逻辑对但多遍历一遍 | `tail.next = a \|\| b` |
| 堆版没判 `if (node)` | `null` 入堆，取 `.val` 报错 | `if (node) heap.push(node)` |
| 迭代分治漏了 `else next.push(arr[i])` | **奇数个链表时数据丢失** | 补上落单分支 |
| 分析堆复杂度说 O(N log N) | 答错，应该是 O(N log k) | 堆大小是 k |
| 用 `mergeTwo` 递归版 | 长链表爆栈 | 用迭代版 |
| 忘记过滤 `lists` 里的 `null` | 崩 | `filter(Boolean)` 或 `if (node)` |
| 以为必须 new 新节点 | 空间 O(N) | 直接复用原节点，O(1) |
| 链表排序没断链 | 无限递归 | `slow.next = null` |

---

## 5.11 答题模板

### 口述要点

- 三种解法与复杂度：顺序 O(k²n)、分治 O(N log k)、堆 O(N log k)。
- 顺序合并的问题：`result` 越来越长，前面节点被重复扫描 k 次，总代价 n(1+…+k)。
- 分治：两两配对，log k 轮，每轮总节点 N；迭代版别漏奇数个时落单的链。
- 堆：堆里放 k 个当前头，每次弹最小、把它的 next 入堆；堆大小是 k，所以是 O(N log k)，额外空间 O(k)。
- 额外空间：顺序/线性扫描 O(1)，分治 O(log k) 栈，堆 O(k)；节点全部复用，不新建。

### 追问表

| 追问 | 回答要点 |
|---|---|
| 为什么 `mergeTwo` 里 `<=` 而不是 `<`？ | 相等时取更靠前的 `a`，保持稳定 |
| `tail.next = a \|\| b` 为什么不用循环？ | 剩余部分本身有序，直接接上 O(1) |
| 如果链表是降序的？ | 改成大顶堆，或先反转再合并 |
| 如果 k = 1？ | 直接返回 `lists[0]`（分治的 `lo === hi` 分支已处理） |
| 链表排序为什么用归并不用快排？ | 快排 partition 要随机访问，链表只能顺序遍历 |

---

## 5.12 本册速记卡

```
合并两个
  dummy + 双指针；a.val <= b.val 取 a（稳定）
  tail.next = a || b    ← O(1) 接剩余，不要 while

合并 K 个
  顺序：result = merge(result, lists[i]) → O(k²n)，前面节点被重复扫 k 次
  分治：两两配对，log k 轮，每轮 N → O(N log k)；迭代版别漏落单分支
  堆：堆里放 k 个当前头，O(N log k)，堆大小是 k 不是 N
  选型：默认分治；流式/未知 k 用堆

链表三板斧
  dummy：消除头特判，return dummy.next
  快慢指针：slow=head, fast=head.next → 左中点
  断链：mid.next = null（不断会无限递归）
  反转：存 next → 改指针 → prev/cur 前移 → return prev

变体
  148 排序：找中点 + 断链 + 递归 merge
  143 重排：找中点 + 反转后半 + 交替合并
  19 删倒数第 N：fast 先走 n+1 步
  142 环入口：相遇后一个指针回 head，同速走
  160 相交：走完自己换到对方链，路程相同必相遇
  234 回文：中点 + 反转后半 + 比较（fast=head 让 slow 停左中点）
```
