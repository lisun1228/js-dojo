# 算法 · 05 链表与堆：合并 K 个升序链表

> 本册覆盖：合并 K 个升序链表
> 原题单只给了「最小堆法」的步骤描述、**没有代码**。这里补：链表基础 → 合并两个 → 三种解法完整实现 → 复杂度对比 → 链表题通用技巧 → 6 个高频变体。
> 这题的价值不在「会写」，而在**它同时考了链表指针、分治、堆三个知识点**，是「一题串三章」的典型。

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

把 k 个有序链表合并成一个有序链表。**三种解法**：顺序两两合并 O(k²n) → 分治两两合并 O(N log k) → **最小堆** O(N log k)。其中 N 是节点总数、n 是单个链表平均长度、k 是链表数。
**最优解是分治或堆**，两者复杂度相同，分治常数更小，堆更适合「k 未知 / 流式输入」。

---

## 5.2 前置：链表题的三板斧

在写这题之前，必须先把三个基本功练到「不用想」。

### 5.2.1 哑节点（dummy head）

**链表题 80% 的 bug 都出在「头节点特殊处理」上。** dummy 节点把「头」变成「普通节点」，彻底消除特判。

```js
// ❌ 没有 dummy：要判断"结果链表是否为空"
let head = null, tail = null;
for (const v of values) {
  const node = { val: v, next: null };
  if (!head) head = node;        // ← 每次都要判断
  else tail.next = node;
  tail = node;
}

// ✅ 有 dummy：统一处理
const dummy = { val: 0, next: null };
let tail = dummy;
for (const v of values) {
  tail.next = { val: v, next: null };
  tail = tail.next;
}
return dummy.next;               // ← 最后返回 dummy.next
```

**记忆点**：`dummy` 是「假的头」，`dummy.next` 才是真头。**返回时一定要 `return dummy.next`，不是 `return dummy`**。

### 5.2.2 快慢指针

| 用途 | 写法 |
|---|---|
| **找中点**（偶数时停在左中点） | `slow = head, fast = head.next`，`while (fast && fast.next)` |
| **找中点**（偶数时停在右中点） | `slow = head, fast = head`，同上循环 |
| **找倒数第 N 个** | `fast` 先走 N 步，再 `slow`/`fast` 同步走 |
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

**为什么 `fast = head.next` 而不是 `head`？** 因为归并排序要「断开」，如果 `slow` 停在右中点，左半会是 `[1]`、右半 `[2,3,4]`，切分不均衡（虽然仍正确，但递归深度变差）。用 `head.next` 保证左半长度 ≤ 右半。

### 5.2.3 断链

合并/排序链表时，**必须显式断开**，否则会形成环或把已处理的部分又带回来。

```js
const mid = findMid(head);
const right = mid.next;
mid.next = null;          // ★ 必须断开
```

**不断开会怎样？** 左半的尾节点还指着右半的头，递归排序时左半会「吞掉」整个右半，导致无限递归或结果重复。

---

## 5.3 第一步：合并两个有序链表

K 个的基础是 2 个。这题本身也是高频题（LeetCode 21）。

### 5.3.1 迭代版（推荐）

```js
function mergeTwo(a, b) {
  const dummy = { val: 0, next: null };
  let tail = dummy;

  while (a && b) {
    // ★ 用 <= 保证稳定：相等时优先取 a
    if (a.val <= b.val) {
      tail.next = a;
      a = a.next;
    } else {
      tail.next = b;
      b = b.next;
    }
    tail = tail.next;
  }

  // 剩下的直接接上（不需要再遍历）
  tail.next = a || b;
  return dummy.next;
}
```

**三个关键点**：

1. **`tail.next = a || b` 而不是用 while 循环追加**：链表剩下的部分本身就是有序的链，直接接上即可，O(1)。
2. **`<=` 保证稳定**：相等时先取 `a`，而 `a` 是「更靠前」的那条链。
3. **不需要 `new` 节点**：直接复用原节点，空间 O(1)。

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

**空间 O(n)**（递归栈），n 是两个链表总长。链表很长时会爆栈，**面试建议写迭代版**。

> 递归版和前面的「尾递归」呼应：`return mergeTwoRec(...)` **不是**尾调用，因为前面还有 `a.next = ...` 的赋值。所以不能用 TCO 优化。

### 5.3.3 合并两个有序数组（对比，常被一起问）

数组版要从**后往前**填，避免覆盖：

```js
// nums1 长度 m+n，前 m 个有效，后 n 个是 0 占位
function mergeArray(nums1, m, nums2, n) {
  let i = m - 1, j = n - 1, k = m + n - 1;
  while (j >= 0) {                    // 只需判断 j，i 用完时 nums1 剩下本来就是对的
    if (i >= 0 && nums1[i] > nums2[j]) nums1[k--] = nums1[i--];
    else nums1[k--] = nums2[j--];
  }
  return nums1;
}
```

**为什么从后往前？** 因为 `nums1` 后面是空的（占位 0），从后往前填不会覆盖还没处理的 `nums1` 元素。从前往后就必须额外开数组。

**注意循环条件只判断 `j >= 0`**：如果 `j` 用完了（`nums2` 全部合并完），`nums1` 剩下的部分本来就在正确位置，不需要再动。

---

## 5.4 解法一：顺序合并（暴力，O(k²n)）

最直觉的做法：`result = merge(result, lists[0])`，然后 `merge(result, lists[1])`……

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

**问题所在**：`result` 越来越长，但每次都要**从头遍历**它。前面合并好的节点被重复扫描了 k 次。

### 5.4.2 什么时候可以用

- **k 很小**（k ≤ 5）：O(k²n) 和 O(N log k) 差距不大，代码最短。
- **面试时作为「第一版答案」**：先说「我想到一个暴力解」，再说「但它有重复扫描的问题，可以优化到 O(N log k)」——**这个递进过程是加分的**。

---

## 5.5 解法二：分治（推荐，代码短、常数小）

### 5.5.1 思路

把 k 个链表**两两配对合并**，一轮下来 k 变成 k/2，再两两合并……共 `log₂k` 轮。

```
第 1 轮：L0+L1, L2+L3, L4+L5, L6+L7      → k/2 条
第 2 轮：+           +                    → k/4 条
...
第 log k 轮：                              → 1 条
```

**每轮的总节点数都是 N**（所有节点都在某一轮被合并一次），共 log k 轮 → **O(N log k)**。

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

**注意两个终止条件**：
- `lo === hi`：只剩一条链，直接返回（可能是 `null`，也被 `mergeTwo` 正确处理）
- `lo + 1 === hi`：只剩两条，直接合并

**为什么需要 `lo + 1 === hi`？** 如果没有，`mid = (lo + hi) >> 1` 在 `hi = lo + 1` 时会得到 `mid = lo`，于是 `divide(lo, lo)` 和 `divide(lo+1, hi)` —— 后者是 `divide(lo+1, lo+1)`，能终止。所以其实**不加也能跑**，但多一层无意义的递归。加上更清晰。

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

**这段代码比递归版更值得记**：它把「两两配对」写得很直白，且没有栈深问题。

**注意 `else next.push(arr[i])`**：奇数个链表时最后一个落单，必须带到下一轮，否则会丢数据。**这是最容易漏的一行**。

---

## 5.6 解法三：最小堆（O(N log k)）

### 5.6.1 思路

维护一个**大小为 k 的最小堆**，堆里放「每条链表当前未合并的头节点」。

1. 把 k 个链表的头节点入堆
2. 弹出堆顶（当前最小的节点），接到结果链表尾部
3. 把该节点的 `next` 入堆（如果存在）
4. 重复直到堆空

**为什么是 O(N log k)**：每个节点入堆一次、出堆一次，每次操作 O(log k)（堆大小是 k，不是 N）。

### 5.6.2 手写最小堆

JS 没有内置堆，必须手写。**这本身也是考点**（很多面试官会要求你顺手写个优先队列）。

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
    if (node) heap.push(node);           // ★ 必须判 null
  }

  const dummy = { val: 0, next: null };
  let tail = dummy;

  while (heap.size > 0) {
    const node = heap.pop();             // 当前最小的节点
    tail.next = node;                    // 接到结果尾部
    tail = node;

    if (node.next) heap.push(node.next); // 该链表的下一个入堆
  }

  tail.next = null;                      // ★ 必须断开，防止残留指针
  return dummy.next;
}
```

**两个必须加的细节**：

1. **`if (node) heap.push(node)`**：`lists` 里可能有 `null`（空链表），不判断会崩。
2. **`tail.next = null`**：最后一个被弹出的节点可能还连着原来的 `next`（虽然那个 next 也会被弹出并重新接上，但保险起见要断开）。实际上因为每个节点的 next 都会被处理，最后 `tail` 一定是最末尾的节点，其 next 本来就是 null。**但显式置 null 更安全**，尤其是当输入链表本身有环或结构不规范时。

### 5.6.4 一个更省事的写法（k 很小时）

如果 `k ≤ 10` 左右，用「有序数组 + 每次线性找最小」反而更快（常数小）：

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

**复杂度 O(N·k)**（每次找最小是 O(k)）。k 很小时比堆快，因为**没有堆的维护开销**。

> 这个写法说明一个重要观点：**O(N log k) 不总是比 O(Nk) 快**，要看 k 的实际大小和常数因子。面试时可以主动提这一点。

---

## 5.7 三种解法对比

### 5.7.1 复杂度

| 解法 | 时间 | 空间 | 代码量 | 适用 |
|---|---|---|---|---|
| 顺序合并 | O(k²n) = O(kN) | O(1) | 最短 | k ≤ 5 |
| **分治** | **O(N log k)** | O(log k) 栈 | 短 | **通用最优** |
| **最小堆** | **O(N log k)** | **O(k)** | 长（要写堆） | k 很大 / 流式 |
| 线性找最小 | O(Nk) | O(1) | 短 | k ≤ 10 |

### 5.7.2 分治 vs 堆：都是 O(N log k)，选哪个？

| 维度 | 分治 | 堆 |
|---|---|---|
| 常数因子 | **更小**（只有指针操作，无堆维护） | 较大（siftUp/siftDown 有多次比较和交换） |
| 空间 | O(log k) 栈 | O(k) 堆数组 |
| 代码量 | **短** | 长（要手写堆） |
| **k 未知 / 流式输入** | ❌ 需要预先知道所有链表 | ✅ 来一个 push 一个 |
| 缓存局部性 | 好（顺序遍历链表） | 差（堆是跳跃访问） |
| 是否修改原链表 | 是 | 是 |

**结论**：
- **面试/LeetCode 首选分治**（代码短、常数小、不容易写错）
- **如果题目是「数据流，不断有新的有序链表加入」→ 必须用堆**
- **如果要展示「我懂堆」→ 写堆版**

> 面试话术：「两种都是 O(N log k)。分治常数更小、代码更短，是我默认的选择；但如果输入是流式的、k 不固定，就必须用堆，因为分治需要一次性拿到所有链表。」

### 5.7.3 一个容易搞错的点：堆的大小是 k 不是 N

很多人第一次分析堆版复杂度会说 O(N log N)。**错在把堆大小当成 N**。

**堆里最多同时有 k 个节点**（每条链表一个「当前头」）。所以每次 push/pop 是 `O(log k)`，不是 `O(log N)`。

**这就是「k 小、N 大」时堆的优势来源**：当 k = 100、N = 10⁶ 时，`log k ≈ 7`，而 `log N ≈ 20`。

---

## 5.8 链表题通用技巧总结

### 5.8.1 五个必须条件反射的技巧

| 技巧 | 用途 | 关键代码 |
|---|---|---|
| **dummy 节点** | 消除头节点特判 | `const dummy = {}; let tail = dummy; ... return dummy.next` |
| **快慢指针** | 找中点、判环、找倒数第 N | `slow = head, fast = head.next` |
| **断链** | 归并/切分前必须断开 | `mid.next = null` |
| **就地反转** | 反转、重排 | `prev/cur/next` 三指针 |
| **头插法** | 构造逆序链表、合并 | `node.next = dummy.next; dummy.next = node` |

### 5.8.2 反转链表（最高频的基础操作）

```js
function reverseList(head) {
  let prev = null, cur = head;
  while (cur) {
    const next = cur.next;    // 先存下一个
    cur.next = prev;          // 反转指针
    prev = cur;               // prev 前移
    cur = next;               // cur 前移
  }
  return prev;                // ★ 返回 prev，不是 cur（cur 是 null）
}
```

**三个必须记住的点**：
1. 必须先存 `next`，否则反转后找不到后半段
2. 返回 `prev`（新头），不是 `cur`（此时是 `null`）
3. 空链表返回 `null`，单节点返回自己（都正确）

### 5.8.3 链表题调试技巧

**把链表转成数组打印**，比在脑子里模拟指针可靠得多：

```js
function toArray(head, limit = 20) {
  const out = [];
  let cur = head, i = 0;
  while (cur && i++ < limit) { out.push(cur.val); cur = cur.next; }
  if (cur) out.push('...');
  return out;
}
```

**加 `limit` 很重要**：如果链表有环，不限长度会死循环。

---

## 5.9 六个高频变体（面试很可能顺着问）

### 5.9.1 链表排序（LeetCode 148）

**为什么链表排序用归并而不用快排？** 因为快排的 partition 需要随机访问，链表只能顺序遍历；而归并的 merge 只需改指针。

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

**复杂度**：时间 O(n log n)，空间 **O(log n)**（只有递归栈，不需要额外数组）。**这比数组归并的 O(n) 空间更优**。

### 5.9.2 重排链表（LeetCode 143）

把 `L0 → L1 → ... → Ln` 变成 `L0 → Ln → L1 → Ln-1 → ...`

**三步**：找中点 → 反转后半 → 交替合并。

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

**一次遍历**：`fast` 先走 N 步，然后 `slow`/`fast` 同步走，`fast` 到末尾时 `slow` 在倒数第 N+1 个（要删的前一个）。

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

**为什么 `fast` 走 `n+1` 步？** 因为要让 `slow` 停在**待删节点的前一个**，才能执行 `slow.next = slow.next.next`。用 dummy 保证「删除头节点」也统一处理。

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

**为什么「相遇后同速走」能到入口？**

设头到入口距离 `a`，入口到相遇点距离 `b`，环长 `c`。相遇时：
- `slow` 走了 `a + b`
- `fast` 走了 `a + b + kc`（多转了 k 圈）
- `fast = 2 × slow` → `a + b + kc = 2(a + b)` → `a = kc - b = (k-1)c + (c - b)`

`c - b` 正是「相遇点继续走到入口」的距离。所以从头走 `a` 步、从相遇点走 `c-b` 步，会同时到达入口。

### 5.9.5 相交链表（LeetCode 160）

两条链表在某个节点相交（Y 形），求交点。

**巧妙解法**：两个指针分别走「自己的链 + 对方的链」，总路程相同，必然同时到达交点。

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

**为什么对？** `p` 走 `lenA + lenB`，`q` 也走 `lenB + lenA`，路程相同。有交点时必然在交点相遇；无交点时同时变成 `null`。

### 5.9.6 回文链表（LeetCode 234）

**三步**：找中点 → 反转后半 → 逐位比较（可以再反转回来恢复原链表）。

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

  // 恢复（可选，好习惯）
  let back = null;
  while (prev) { const n = prev.next; prev.next = back; back = prev; prev = n; }

  return ok;
}
```

**为什么这里用 `fast = head`（不是 `head.next`）？** 因为回文比较希望后半部分**不长于**前半（奇数长度时中点归前半），所以让 `slow` 停在正中间（奇数）或左中点（偶数）。

---

## 5.10 常见坑

| 坑 | 后果 | 修正 |
|---|---|---|
| 忘记 `return dummy.next` | 返回了假头，多一个 0 | `return dummy.next` |
| `mergeTwo` 里剩余部分用 while 追加 | 逻辑对但多遍历一遍 | `tail.next = a \|\| b` |
| 堆版没判 `if (node)` | `null` 入堆，`.val` 报错 | `if (node) heap.push(node)` |
| 堆版没设 `tail.next = null` | 末尾可能残留指针（某些输入下成环） | 显式置 null |
| 迭代分治漏了 `else next.push(arr[i])` | **奇数个链表时数据丢失** | 补上落单分支 |
| 分析堆复杂度说 O(N log N) | 答错，应该是 O(N log k) | 堆大小是 k |
| 用 `mergeTwo` 递归版 | 长链表爆栈 | 用迭代版 |
| 忘记过滤 `lists` 里的 `null` | 崩 | `filter(Boolean)` 或 `if (node)` |
| 以为必须 new 新节点 | 空间 O(N) | 直接复用原节点，O(1) |
| 链表排序没断链 | 无限递归 | `slow.next = null` |

---

## 5.11 答题模板

### 30 秒版

> 合并 K 个有序链表有三种解法。最直接的是顺序两两合并，但 result 越来越长、每次都要重新遍历，是 O(k²n)。更好的是分治：两两配对，共 log k 轮，每轮处理 N 个节点，O(N log k)。也可以用最小堆：堆里放每条链的当前头，每次弹最小的接到结果尾部，再把它 next 入堆，每个节点进出堆各一次，也是 O(N log k)，但空间是 O(k)。
> 我一般写分治，因为代码短、常数小；如果输入是流式的、k 不固定，就用堆。

### 2 分钟版（加分层）

> 这题的基础是「合并两个有序链表」，用 dummy 节点加双指针，`a.val <= b.val` 就接 a，最后 `tail.next = a || b` 把剩余部分一次接上——注意这里是 O(1) 而不是再遍历一遍。
> 有了 mergeTwo，K 个链表就是「怎么组织合并顺序」的问题。
> 顺序合并是 `result = merge(result, lists[i])`，问题是 result 越来越长，前面合并好的节点被重复扫描 k 次，总代价 n(1+2+...+k) = O(k²n)。
> 分治把它改成两两配对：第 1 轮 k 条变 k/2 条，每轮总节点数都是 N，共 log k 轮，所以 O(N log k)。实现上递归二分下标就行，或者写迭代版自底向上，每轮 for 循环两两合并，注意奇数个时最后一个要直接带入下一轮，这行最容易漏。
> 堆的思路是维护 k 个「当前头节点」，每次弹最小的。这里有个容易错的复杂度分析：堆的大小是 k 不是 N，所以是 O(N log k)。堆的优点是支持流式输入，缺点是常数比分治大、要手写堆。JS 没有内置堆，所以如果要写堆版，得顺手实现一个 MinHeap。
> 空间上三种都能做到 O(1)（复用原节点），分治是 O(log k) 递归栈，堆是 O(k)。

### 追问表

| 追问 | 回答要点 |
|---|---|
| 三种解法复杂度？ | 顺序 O(k²n)、分治 O(N log k)、堆 O(N log k) |
| 分治为什么是 O(N log k)？ | 共 log k 轮，每轮总节点 N |
| 堆的复杂度为什么不是 O(N log N)？ | 堆大小是 k，每次操作 O(log k) |
| 分治和堆选哪个？ | 分治常数小代码短；堆支持流式、k 不固定 |
| 空间能到 O(1) 吗？ | 能，复用原节点；分治是 O(log k) 栈，堆是 O(k) |
| 为什么 `mergeTwo` 里 `<=` 而不是 `<`？ | 保证稳定性（相等取更靠前的那条链） |
| `tail.next = a \|\| b` 为什么不用循环？ | 剩余部分本身有序，直接接上 O(1) |
| 如果链表是降序的？ | 改成大顶堆，或先反转再合并 |
| 如果 k = 1？ | 直接返回 lists[0]（分治的 `lo === hi` 分支已处理） |
| 链表排序为什么用归并不用快排？ | 快排 partition 要随机访问，链表只能顺序遍历 |

---

## 5.12 本册速记卡

```
合并两个
  dummy + 双指针；a.val <= b.val 取 a（稳定）
  tail.next = a || b    ← O(1) 接剩余，不要 while

合并 K 个
  顺序：result = merge(result, lists[i]) → O(k²n)，前面节点被重复扫 k 次
  分治：两两配对，log k 轮，每轮 N → O(N log k)；迭代版别漏 else next.push(落单)
  堆：堆里放 k 个当前头，O(N log k)，堆大小是 k 不是 N
  选型：默认分治；流式/未知 k 用堆

链表现在板斧
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
  234 回文：中点 + 反转后半 + 比较（fast=head 让 slow 停正中间）
```
