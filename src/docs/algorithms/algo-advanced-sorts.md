# 算法 · 03 进阶排序：归并 / 快排 / 堆排

> 覆盖：归并排序、快速排序、堆排序
> 平均都是 O(n log n)；面试频率：快排 > 归并 > 堆排，堆排常与 TopK 一起追问。

---

## 目录

- [3.1 归并排序](#31-归并排序)
- [3.2 快速排序](#32-快速排序)
- [3.3 堆排序](#33-堆排序)
- [3.4 三者横向对比](#34-三者横向对比)
- [3.5 本册速记卡](#35-本册速记卡)

---

## 3.1 归并排序

### 一句话结论

分治：数组一分为二，递归排好两半，再 `merge` 成有序数组。**稳定、任何输入都是 O(n log n)、额外空间 O(n)**。

### 3.1.1 核心思想

```
                [5, 3, 8, 1, 9, 2]
                 /            \
        [5, 3, 8]              [1, 9, 2]
         /     \                /     \
      [5]     [3, 8]         [1]    [9, 2]
               /  \                   /  \
             [3]  [8]               [9]  [2]
        ↓ 自底向上合并 ↓
        [3, 5, 8]              [1, 2, 9]
                 \            /
                [1, 2, 3, 5, 8, 9]
```

两个阶段：
1. **分（divide）**：递归到长度 ≤ 1（天然有序）
2. **治（conquer）**：合并两个有序数组

排序工作全部发生在 **merge 阶段**，递归本身不排序。快排相反：partition 阶段就确定了大小关系。

### 3.1.2 实现（递归版）

```js
function mergeSort(arr) {
  if (arr.length <= 1) return arr;              // 递归出口
  const mid = arr.length >> 1;                  // 等价于 Math.floor(len / 2)
  const left = mergeSort(arr.slice(0, mid));    // ⚠️ slice 产生 O(n) 拷贝
  const right = mergeSort(arr.slice(mid));
  return merge(left, right);
}

function merge(a, b) {
  const res = new Array(a.length + b.length);
  let i = 0, j = 0, k = 0;
  while (i < a.length && j < b.length) {
    // ★ 用 <= 而不是 <，这是稳定性的唯一来源
    if (a[i] <= b[j]) res[k++] = a[i++];
    else res[k++] = b[j++];
  }
  while (i < a.length) res[k++] = a[i++];
  while (j < b.length) res[k++] = b[j++];
  return res;
}
```

### 3.1.3 逐步推演 `[5, 3, 8, 1]`

```
分：
  [5,3,8,1] → [5,3] + [8,1]
  [5,3]     → [5] + [3]
  [8,1]     → [8] + [1]

治（合并）：
  merge([5],[3])       → 5<=3? 否 → 取 3，再取 5     → [3,5]
  merge([8],[1])       → 8<=1? 否 → 取 1，再取 8     → [1,8]
  merge([3,5],[1,8]):
     3<=1? 否 → 取 1     res=[1]   i=0 j=1
     3<=8? 是 → 取 3     res=[1,3] i=1 j=1
     5<=8? 是 → 取 5     res=[1,3,5] i=2（左耗尽）
     补右剩余 → 取 8      res=[1,3,5,8]
```

### 3.1.4 稳定性：只差一个等号

```js
if (a[i] <= b[j]) res[k++] = a[i++];   // ✅ 稳定：相等时优先取左边
if (a[i] <  b[j]) res[k++] = a[i++];   // ❌ 不稳定：相等时取右边，左元素被"插队"
```

`left` 和 `right` 来自原数组的前后两半。`a[i] === b[j]` 时，`a[i]` 在原数组中更靠前；取 `a[i]` 就保住了「前面的先出」。写成 `<` 时相等取右，`[2a, 2b]` 会变成 `[2b, 2a]`。

实测（200 个键值 0~4 打乱、带原下标）：`<=` 结果有序且同键下标递增；`<` 同键下标出现逆序。

排序对象时必须传比较器：

```js
if (cmp(a[i], b[j]) <= 0) res[k++] = a[i++];
else res[k++] = b[j++];
```

`a[i] <= b[j]` 对两个普通对象会先 `ToPrimitive` 成 `"[object Object]"`，比较恒为真，结果保持原序——实测输入 `[2, 1, 3]` 输出仍是 `[2, 1, 3]`。

### 3.1.5 复杂度：为什么恒为 O(n log n)

递归树每层的总代价：

```
第 0 层：1 个节点，处理 n 个元素  → 代价 n
第 1 层：2 个节点，各 n/2        → 总代价 n
第 2 层：4 个节点，各 n/4        → 总代价 n
...
第 log₂n 层：n 个节点，各 1      → 总代价 n
```

每层 O(n)，共 log₂n + 1 层 → O(n log n)。递归树形状与输入无关（永远均分），所以最好、平均、最坏相同。

空间：递归栈 O(log n)，merge 辅助数组 O(n)。slice 版每层都在新建数组，但递归是深度优先的，同时存活的只有当前路径上的子数组与 merge 结果，峰值 O(n)（常数约 2n）。

### 3.1.6 优化：一次性分配 temp

slice 版每层新建数组，分配次数多、GC 压力大。改为一次分配 temp、按下标合并：

```js
function mergeSortWithTemp(arr) {
  const n = arr.length;
  const tmp = new Array(n);          // 只分配一次
  sort(0, n - 1);
  return arr;

  function sort(lo, hi) {
    if (lo >= hi) return;
    const mid = (lo + hi) >> 1;
    sort(lo, mid);
    sort(mid + 1, hi);
    mergeRange(lo, mid, hi);
  }

  function mergeRange(lo, mid, hi) {
    let i = lo, j = mid + 1, k = lo;
    while (i <= mid && j <= hi) {
      if (arr[i] <= arr[j]) tmp[k++] = arr[i++];
      else tmp[k++] = arr[j++];
    }
    while (i <= mid) tmp[k++] = arr[i++];
    while (j <= hi) tmp[k++] = arr[j++];
    for (let t = lo; t <= hi; t++) arr[t] = tmp[t];   // 回写
  }
}
```

辅助数组 O(n) + 递归栈 O(log n)，只有一次分配。这**不是原地排序**（仍有 O(n) 辅助空间）；真正的原地归并（如 SymMerge）实现复杂、常数大，工程不用。

### 3.1.7 优化：自底向上（非递归）

用「宽度倍增」合并，消除递归：

```js
function mergeSortBottomUp(arr) {
  const n = arr.length;
  if (n <= 1) return arr.slice();
  const a = arr.slice();
  const tmp = new Array(n);

  for (let width = 1; width < n; width *= 2) {      // 1, 2, 4, 8...
    for (let lo = 0; lo < n - width; lo += width * 2) {
      const mid = lo + width - 1;
      const hi = Math.min(lo + width * 2 - 1, n - 1);
      let i = lo, j = mid + 1, k = lo;
      while (i <= mid && j <= hi) tmp[k++] = a[i] <= a[j] ? a[i++] : a[j++];
      while (i <= mid) tmp[k++] = a[i++];
      while (j <= hi) tmp[k++] = a[j++];
      for (let t = lo; t <= hi; t++) a[t] = tmp[t];
    }
  }
  return a;
}
```

外层条件必须是 `lo < n - width`，保证右半至少一个元素。写成 `lo < n` 会进入右半为空的无效合并，并读写数组末尾之外的下标——实测 n=0~200 结果仍正确，但有 170 个长度出现 `mid > n-1` 的越界读。

没有递归开销；同一思路用于链表时不需要数组下标。

### 3.1.8 四个真实用途

**① 需要稳定排序**

ES2019 起 `Array.prototype.sort` 规范要求稳定，V8 因此改用 TimSort。TimSort = 归并 + 插入：先找自然有序的 run，短 run 用插入排序补到最小长度，再按规则合并。

**② 链表排序**

链表没有随机访问，标准 partition 的下标交换不适用；归并只改指针，空间只有递归栈 O(log n)。

```js
function sortList(head) {
  if (!head || !head.next) return head;
  // 快慢指针找中点（fast 从 head.next 开始，保证偶数长度时 slow 停在左中点）
  let slow = head, fast = head.next;
  while (fast && fast.next) { slow = slow.next; fast = fast.next.next; }
  const mid = slow.next;
  slow.next = null;                       // 断开
  return mergeList(sortList(head), sortList(mid));
}

function mergeList(a, b) {
  const dummy = { next: null };
  let tail = dummy;
  while (a && b) {
    if (a.val <= b.val) { tail.next = a; a = a.next; }   // <= 保证稳定
    else { tail.next = b; b = b.next; }
    tail = tail.next;
  }
  tail.next = a || b;                     // 接上剩余部分
  return dummy.next;
}
```

**③ 求逆序对**

merge 时若取右元素，左半剩余的 `a[i..mid]` 都大于它，累加 `mid - i + 1`。这是归并最高频的变体（剑指 Offer 51、LeetCode 493）。

```js
function countInversions(arr) {
  let count = 0;
  const a = arr.slice();
  const tmp = new Array(a.length);

  function sort(lo, hi) {
    if (lo >= hi) return;
    const mid = (lo + hi) >> 1;
    sort(lo, mid);
    sort(mid + 1, hi);

    let i = lo, j = mid + 1, k = lo;
    while (i <= mid && j <= hi) {
      if (a[i] <= a[j]) {
        tmp[k++] = a[i++];
      } else {
        tmp[k++] = a[j++];
        count += mid - i + 1;    // ★ a[i..mid] 全部 > a[j]，都是逆序对
      }
    }
    while (i <= mid) tmp[k++] = a[i++];
    while (j <= hi) tmp[k++] = a[j++];
    for (let t = lo; t <= hi; t++) a[t] = tmp[t];
  }

  sort(0, a.length - 1);
  return count;
}
```

`count += mid - i + 1`：`a[i..mid]` 是左半剩下的元素，且都 ≥ `a[i]`；既然 `a[i] > a[j]`，这一段全部 > `a[j]`。

**④ 外部排序（数据量超过内存）**

1. 分块读入内存，块内排序后写回磁盘，得到若干有序小文件；
2. 多路归并：用最小堆从 k 个有序文件里取最小值，边读边写。

这是数据库 `ORDER BY`、`sort` 命令、MapReduce 的底层思路。

### 3.1.9 常见坑

| 坑 | 后果 | 修正 |
|---|---|---|
| 递归出口写 `length === 1` | 空数组无限递归（实测 RangeError） | `length <= 1` |
| 自底向上外层写 `lo < n` | 右半为空仍合并，读写数组外下标 | `lo < n - width` |
| `merge` 只写 while，忘了补尾部 | 结果缺元素 | 两个 while 补齐 |
| 在链表上用数组版归并 | 需要随机访问，性能极差 | 用 `mergeList` 版 |

### 3.1.10 口述要点

- 结论先行：分治 + merge，任何输入都是 O(n log n)，稳定，额外空间 O(n)。
- 再讲 merge：双指针，`<=` 是稳定性的唯一来源；左边来自原数组前半，相等取左才保序。
- 主动补空间差异：数组版 O(n) 辅助 + O(log n) 栈；链表版只有 O(log n) 栈。
- 收尾落到用途：稳定排序 / TimSort、链表、逆序对、外部排序。

---

## 3.2 快速排序

### 一句话结论

选 pivot 分区，把小于、大于 pivot 的元素分到两侧，再递归两边。**原地、不稳定、平均 O(n log n)、最坏 O(n²)**；工业实现以快排为骨架。

### 3.2.1 教学版实现与三个问题

```js
function quickSort(arr) {
  if (arr.length <= 1) return arr;
  const pivot = arr[0];
  const left = [], right = [];
  for (let i = 1; i < arr.length; i++) {
    arr[i] < pivot ? left.push(arr[i]) : right.push(arr[i]);
  }
  return [...quickSort(left), pivot, ...quickSort(right)];
}
```

这个写法能排序，但有三个问题：

| 问题 | 说明 |
|---|---|
| ① **空间不是 O(log n)** | 每层都新建 `left`/`right` 并 `[...]` 拼接，空间是 O(n) |
| ② **固定取 `arr[0]` 作 pivot** | 已排序 / 逆序输入时每层分区 1 : n-1，深度 n，时间 O(n²) |
| ③ **没处理重复元素** | 全相同数组下 `left` 为空、`right` 有 n-1 个，同样退化 O(n²) |

### 3.2.2 分区（partition）

#### Lomuto 分区

思路：pivot 换到末尾，`i` 维护「小于区的下一个位置」，`j` 扫描。

```js
function partitionLomuto(arr, lo, hi) {
  // 随机化：随机选一个换到末尾，避免固定 pivot 的退化
  const r = lo + Math.floor(Math.random() * (hi - lo + 1));
  [arr[r], arr[hi]] = [arr[hi], arr[r]];

  const pivot = arr[hi];
  let i = lo;                        // i 左边都是 < pivot
  for (let j = lo; j < hi; j++) {
    if (arr[j] < pivot) {
      [arr[i], arr[j]] = [arr[j], arr[i]];
      i++;
    }
  }
  [arr[i], arr[hi]] = [arr[hi], arr[i]];   // pivot 归位
  return i;                                 // pivot 的最终下标
}
```

手算 `[3, 8, 2, 5, 1]`，随机选中 `5`（原 index 3），先换到末尾：

```
[3, 8, 2, 1, 5]   pivot = 5

j=0: 3 < 5 → swap(a[0], a[0])，i=1      [3, 8, 2, 1, 5]
j=1: 8 < 5? 否                          [3, 8, 2, 1, 5]
j=2: 2 < 5 → swap(a[1], a[2])，i=2      [3, 2, 8, 1, 5]
j=3: 1 < 5 → swap(a[2], a[3])，i=3      [3, 2, 1, 8, 5]
最后 swap(a[3], a[4]) → [3, 2, 1, 5, 8]，返回 3
```

分区结果 `[3, 2, 1] | 5 | [8]`。若 pivot 取末尾的 `1`：没有元素 < 1，最后 `swap(a[0], a[4])` → `[1, 8, 2, 5, 3]`，返回 0，分区结果 `[1] | [8, 2, 5, 3]`，是 1 : n-1 的极端不均衡。

Lomuto 用 `arr[j] < pivot`（严格小于），等于 pivot 的元素全被分到右边。全相同数组下 `i` 一直是 `lo`，分区是 `[lo] | [lo+1, hi]`，每次只缩小 1 个元素 → **O(n²)**。这就是三路快排要解决的问题。

#### Hoare 分区

双指针从两端向中间逼近，左边找 ≥ pivot 的，右边找 ≤ pivot 的，交换。

```js
function partitionHoare(arr, lo, hi) {
  const pivot = arr[lo + ((hi - lo) >> 1)];   // 取中间值作 pivot（不用换位置）
  let i = lo - 1, j = hi + 1;
  while (true) {
    do { i++; } while (arr[i] < pivot);
    do { j--; } while (arr[j] > pivot);
    if (i >= j) return j;                      // ★ 返回 j，不是 i
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
```

三个细节：
1. **返回 `j`**，递归用 `[lo, j]` 和 `[j+1, hi]`（不是 `j-1` / `j+1`）；
2. **`do-while` 而非 `while`**：保证至少走一步，否则 pivot 本身会让循环卡住；
3. **不需要哨兵**：pivot 一定在区间内，`i`、`j` 不会越界。

Hoare 的交换次数约为 Lomuto 的 1/3（n=20000 随机数组实测 67,127 vs 193,519），且全相同数组下仍然均分。

### 3.2.3 完整实现（随机化 + 短边递归）

```js
function quickSort(arr, lo = 0, hi = arr.length - 1) {
  while (lo < hi) {
    const p = partitionLomuto(arr, lo, hi);
    // ★ 先递归较短的一侧，较长的一侧用循环继续（手动尾递归）
    //   这样栈深最坏是 O(log n) 而不是 O(n)
    if (p - lo < hi - p) {
      quickSort(arr, lo, p - 1);
      lo = p + 1;
    } else {
      quickSort(arr, p + 1, hi);
      hi = p - 1;
    }
  }
  return arr;
}
```

即使 pivot 每次都恰好是最小值，因为每次都只递归较短的一侧（长度 0），较长的一侧用 `while` 继续，栈深始终是 O(log n)。时间仍是 O(n²)，但不会栈溢出——实测 n=20000 已排序 + 固定末尾 pivot，最大栈深 2；n=100000 随机 pivot，最大栈深 12。

### 3.2.4 三路快排（解决重复元素）

把数组分成 `< pivot`、`== pivot`、`> pivot` 三段，等于 pivot 的部分不再递归。

```js
function quickSort3Way(arr, lo = 0, hi = arr.length - 1) {
  if (lo >= hi) return arr;

  const r = lo + Math.floor(Math.random() * (hi - lo + 1));
  [arr[lo], arr[r]] = [arr[r], arr[lo]];
  const pivot = arr[lo];

  let lt = lo;        // [lo, lt)     < pivot
  let i = lo + 1;     // [lt, i)      == pivot
  let gt = hi;        // (gt, hi]     > pivot

  while (i <= gt) {
    if (arr[i] < pivot) {
      [arr[lt], arr[i]] = [arr[i], arr[lt]];
      lt++; i++;
    } else if (arr[i] > pivot) {
      [arr[i], arr[gt]] = [arr[gt], arr[i]];
      gt--;                    // ⚠️ 不 i++，换过来的元素还没检查
    } else {
      i++;
    }
  }

  quickSort3Way(arr, lo, lt - 1);
  quickSort3Way(arr, gt + 1, hi);
  return arr;
}
```

`gt--` 之后不能再 `i++`：换过来的元素来自未检查区。实测把这里写成 `i++` 后，1000 组随机数组里有 890 组结果错误。

全相同数组只需一次分区，**O(n)**。

实测比较次数（n=20000，只统计比较；Node v22.12.0；Hoare 固定取中值，Lomuto / 三路随机 pivot，随机数值为单次运行）：

| 输入 | Lomuto | Hoare | 三路 |
|---|---|---|---|
| 已排序（固定末尾 pivot） | 199,990,000 | — | — |
| 已排序（随机 pivot） | 335,928 | 307,231 | 509,006 |
| 全相同（随机 pivot） | 199,990,000 | 318,430 | 39,998 |
| 随机（随机 pivot） | 344,524 | 390,787 | 483,492 |

1. **随机化之后，已排序输入不退化**：固定末尾 1.9999 亿次比较，随机 pivot 降到约 33 万次。
2. **Lomuto 的死穴是全相同**：随机化无效，仍是 n(n-1)/2 次比较；Hoare 靠均分保持在 n log n 量级；三路只做一遍分区，比较 2(n-1) 次。
3. **三路不是万能的**：在「全部不重复的有序数据」上，比较次数约为 Lomuto 的 1.5 倍（50.9 万 vs 33.6 万），因为每个元素最多比较两次。

### 3.2.5 复杂度分析

| 情况 | 时间 | 触发条件 |
|---|---|---|
| **最好** | O(n log n) | 每次都均分 |
| **平均** | O(n log n) | 随机输入 |
| **最坏** | **O(n²)** | 每次分区都极不均衡（1 : n-1） |

最坏情况的两个来源：
1. **固定取首/尾元素作 pivot，且输入已排序或逆序**：每层只减少 1 个元素，总代价 n + (n-1) + ... + 1 = O(n²)；
2. **所有元素相同（Lomuto）**：分区固定为 1 : n-1。

避免手段：

| 手段 | 效果 |
|---|---|
| **随机化 pivot** | 期望 O(n log n)，与输入分布无关；最坏仍是 O(n²)，但需要每层都选到极值 |
| **三数取中**（lo / mid / hi 的中位数） | 已排序 / 逆序输入直接得到均分 |
| **三路分区** | 全相同输入降到 O(n) |
| **递归短边 + 循环长边** | 不改善时间，但保证栈深 O(log n) |
| **小区间切换插入排序** | 减少递归层数，提升常数（阈值 10~16） |

平均 O(n log n) 的推导：随机 pivot 下分区位置均匀分布，期望递归式

```
T(n) = (1/n) Σ_{k=0}^{n-1} [T(k) + T(n-1-k)] + O(n)
```

解得期望比较次数 ≤ 2n ln n ≈ 1.39 n log₂n。

### 3.2.6 空间复杂度

| 实现方式 | 空间 | 原因 |
|---|---|---|
| **原地 + 递归** | **O(log n)** | 只有递归栈 |
| **`slice` / `left` / `right` 版** | **O(n)** | 每层都新建数组 |

峰值不是 O(n log n)：递归是深度优先的，处理左半时右半还没创建，处理右半时左半已经释放，峰值约为 2n。

### 3.2.7 为什么工业界默认用快排

| 原因 | 说明 |
|---|---|
| **常数因子小** | 内层只有一个比较 + 一个自增，没有函数调用、没有额外数组分配 |
| **缓存友好** | 顺序扫描数组，CPU 预取命中率高；归并的 merge 在两个数组间跳动 |
| **原地** | 不需要 O(n) 辅助空间，减少分配和 GC 压力 |
| **可组合优化** | 三数取中、三路分区、小区间插入排序、深度限制 |

这些是常数层面的优势，不改变最坏 O(n²)。`std::sort` 用 introsort：快排为主，递归深度超过约 2log n 时切堆排保证最坏 O(n log n)，小区间切插入排序。

### 3.2.8 常见坑

| 坑 | 后果 | 修正 |
|---|---|---|
| partition 返回 pivot 下标，递归却用 `[lo, p]` / `[p+1, hi]` | **无限递归**（p 位置元素没排除） | Lomuto 用 `[lo, p-1]` / `[p+1, hi]`；Hoare 用 `[lo, j]` / `[j+1, hi]` |
| 三路快排 `gt--` 后还 `i++` | 跳过元素，结果错（实测 890/1000） | 不 `i++` |
| 忘记随机化 | 有序输入 O(n²) | 随机 swap 或三数取中 |
| `hi` 传 `arr.length` 而不是 `length - 1` | 越界或漏元素 | 统一用闭区间 `[lo, hi]` |

**不稳定反例**：`[2a, 1, 2b]`，pivot 取末尾的 `2b`，分区后为 `[1, 2b, 2a]`（实测）。根因是 partition 的交换是**跨距离**的。

### 3.2.9 口述要点

- 结论先行：pivot 分区 + 递归，原地、不稳定，平均 O(n log n)、最坏 O(n²)、空间 O(log n)。
- 讲 partition：Lomuto 用 `i` 维护小于区边界、返回 pivot 下标；Hoare 返回 `j`、用 `do-while`。
- 主动补最坏与防线：固定 pivot + 有序输入，或 Lomuto + 全相同；随机化、三数取中、三路分区、短边递归。
- 工程收尾：introsort = 快排 + 堆排兜底 + 插入排序收尾。

---

## 3.3 堆排序

### 一句话结论

把数组看成一棵**完全二叉树**，先建成**大顶堆**（每个父节点 ≥ 子节点），再反复「堆顶换到末尾 → 剩余部分重新下沉」。**原地、不稳定、任何情况都是 O(n log n)**。

### 3.3.1 堆的数组表示

完全二叉树可以**用数组存，不需要指针**：

```
        9 (0)
       /     \
    7 (1)    8 (2)
   /   \     /
 3(3) 5(4) 6(5)

数组: [9, 7, 8, 3, 5, 6]
下标:  0  1  2  3  4  5
```

| 关系 | 公式 |
|---|---|
| 父节点下标 | `(i - 1) >> 1` |
| 左子节点 | `2 * i + 1` |
| 右子节点 | `2 * i + 2` |

按层序编号后，第 k 层有 2^k 个节点，编号连续；下标 i 的左子正好是 `2i+1`。完全二叉树除最后一层外都填满、最后一层靠左对齐，数组没有空洞，才能用下标直接算父子关系。

### 3.3.2 两个核心操作：siftDown / siftUp

**siftDown（下沉）**：节点比子节点小就往下换，直到满足堆性质。用于**建堆**和**删除堆顶**。

```js
// 大顶堆的下沉：把 a[i] 下沉到合适位置，只在 [0, len) 范围内
function siftDown(a, i, len) {
  const val = a[i];              // 先存值（"挖洞"法，比反复 swap 快）
  while (true) {
    let child = 2 * i + 1;
    if (child >= len) break;                        // 没有子节点
    if (child + 1 < len && a[child + 1] > a[child]) child++;  // 选较大的子节点
    if (a[child] <= val) break;                     // 已经比子节点大，停止
    a[i] = a[child];                                // 子节点上移
    i = child;
  }
  a[i] = val;                    // 最后填回洞里
}
```

「挖洞法」只在下沉路径上各赋一次值；反复 swap 每次要 3 次赋值。

**siftUp（上浮）**：节点比父节点大就往上换。用于**插入**。

```js
function siftUp(a, i) {
  const val = a[i];
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (a[parent] >= val) break;
    a[i] = a[parent];
    i = parent;
  }
  a[i] = val;
}
```

**建堆用 siftDown（从后往前），插入用 siftUp（从前往后）。**

### 3.3.3 建堆：为什么是 O(n) 而不是 O(n log n)

从**最后一个非叶子节点**开始，倒序对每个节点 `siftDown`：

```js
for (let i = (n >> 1) - 1; i >= 0; i--) siftDown(a, i, n);
```

下标 ≥ `n/2` 的节点都是叶子，不需要下沉；最后一个非叶子节点的下标是 `⌊n/2⌋ - 1`。

粗看是「n/2 个节点 × 每个最多下沉 log n 层 = O(n log n)」，但这个估算过松：越靠底层的节点越多，但它们能下沉的高度越小。高度 h 的节点约有 `n / 2^(h+1)` 个，每个最多下沉 h 层：

```
总代价 = Σ_{h=0}^{log n} (n / 2^(h+1)) × h
       = (n/2) Σ_{h=0}^{log n} h / 2^h
       ≤ (n/2) × 2                    （Σ h/2^h 收敛到 2）
       = O(n)
```

直觉：最底层（叶子）占一半节点，下沉 0 层；倒数第二层占 1/4，下沉 1 层；倒数第三层占 1/8，下沉 2 层。节点数按 1/2 递减，下沉层数按 1 递增，乘积收敛。

对比：用 siftUp 从前往后逐个插入建堆，底层节点最多、上浮路径最长，总代价是 O(n log n)。实测移动次数（递增输入）：

| n | siftDown 建堆 | siftUp 建堆 |
|---|---|---|
| 1023 | 1,013 ≈ 1.0n | 8,194 ≈ 8.0n |
| 4095 | 4,083 ≈ 1.0n | 40,962 ≈ 10.0n |
| 16383 | 16,369 ≈ 1.0n | 196,610 ≈ 12.0n |
| 65535 | 65,519 ≈ 1.0n | 917,506 ≈ 14.0n |

### 3.3.4 完整实现

```js
function heapSort(arr) {
  const n = arr.length;
  if (n <= 1) return arr;

  // 1. 建大顶堆：O(n)
  for (let i = (n >> 1) - 1; i >= 0; i--) {
    siftDown(arr, i, n);
  }

  // 2. 依次把堆顶换到末尾，剩余部分重新堆化：n 次 × O(log n)
  for (let end = n - 1; end > 0; end--) {
    [arr[0], arr[end]] = [arr[end], arr[0]];   // 最大值归位
    siftDown(arr, 0, end);                     // 注意：范围是 [0, end)
  }
  return arr;
}
```

`siftDown(arr, 0, end)` 的第三个参数是**有效长度**。`[end, n)` 已经排好序，不能再参与堆化；误传 `n` 会把刚归位的最大值捞回来——实测 `[3, 1, 4, 5, 2]` 会得到 `[5, 4, 3, 2, 1]`。

### 3.3.5 逐步推演 `[3, 1, 4, 5, 2]`

**建堆**（n=5，从 index 1 开始倒序）：

```
初始:      [3, 1, 4, 5, 2]
        树:      3(0)
               /      \
            1(1)      4(2)
           /   \
        5(3)  2(4)

i=1（值 1）：子节点 5、2 → 最大 5 > 1 → 交换
           [3, 5, 4, 1, 2]

i=0（值 3）：子节点 5、4 → 最大 5 > 3 → 交换
           [5, 3, 4, 1, 2]
           继续看 index 1（值 3）：子节点 1、2 → 最大 2 < 3 → 停

建堆结果: [5, 3, 4, 1, 2]
        树:      5(0)
               /      \
            3(1)      4(2)
           /   \
        1(3)  2(4)
✓ 每个父节点都 ≥ 子节点
```

**排序**：

```
end=4: swap(0,4) → [2,3,4,1,5]  siftDown(0,4) → 4 上到顶 → [4,3,2,1,5]
end=3: swap(0,3) → [1,3,2,4,5]  siftDown(0,3) → 3 上到顶 → [3,1,2,4,5]
end=2: swap(0,2) → [2,1,3,4,5]  siftDown(0,2) → 2 > 1 不换 → [2,1,3,4,5]
end=1: swap(0,1) → [1,2,3,4,5]  siftDown(0,1) → 无子节点 → [1,2,3,4,5]
结果: [1,2,3,4,5] ✅
```

### 3.3.6 为什么堆排序不稳定

反例：`[3a, 3b, 2]`

```
建堆: n=3, i 从 0 开始
  siftDown(0,3): 子节点 3b、2 → 最大 3b；3b <= 3a → 停下
  堆 = [3a, 3b, 2]

end=2: swap(0,2) → [2, 3b, 3a]
       siftDown(0,2): 子节点只有 3b；3b > 2 → 交换 → [3b, 2, 3a]
end=1: swap(0,1) → [2, 3b, 3a]
       siftDown(0,1): 无子节点 → 不变

结果: [2, 3b, 3a]
```

原顺序 `3a` 在前，结果 `3b` 在前 → **不稳定**。根因是「堆顶 ↔ 末尾」的**远距离交换**。

### 3.3.7 复杂度

| 项目 | 复杂度 | 说明 |
|---|---|---|
| 建堆 | **O(n)** | 见 3.3.3 |
| 排序阶段 | O(n log n) | n 次 siftDown，每次 O(log n) |
| **总时间** | **O(n log n)** | 最好 = 平均 = 最坏 |
| 空间 | **O(1)** | 原地，只用几个临时变量 |
| 稳定 | ❌ | 远距离交换 |

三者中唯一同时做到 O(1) 空间与最坏 O(n log n)：

| 算法 | 最坏时间 | 空间 |
|---|---|---|
| 快排 | O(n²) ❌ | O(log n) |
| 归并 | O(n log n) | O(n) ❌ |
| **堆排** | **O(n log n)** ✅ | **O(1)** ✅ |

适用场景：
- **内存 / 栈极度受限**（嵌入式、内核）
- **不能接受最坏退化**（实时系统）
- **introsort 的兜底**：快排递归太深时切堆排

工程上不默认用堆排，原因是**缓存不友好**：`siftDown` 跳跃访问 `2i+1`、`2i+2`，不如快排的顺序扫描。

### 3.3.8 手写优先队列（堆的真正主战场）

堆排本身用得少，但**堆（优先队列）用得极多**：TopK、任务调度、Dijkstra、合并 K 个链表、数据流中位数。

```js
class MinHeap {
  constructor(cmp = (a, b) => a - b) {
    this.a = [];
    this.cmp = cmp;                 // cmp(a,b) < 0 表示 a 优先
  }
  get size() { return this.a.length; }
  peek() { return this.a[0]; }

  push(x) {
    this.a.push(x);
    let i = this.a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.cmp(this.a[i], this.a[p]) >= 0) break;
      [this.a[i], this.a[p]] = [this.a[p], this.a[i]];
      i = p;
    }
  }

  pop() {
    const a = this.a;
    if (a.length === 0) return undefined;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      while (true) {
        const l = 2 * i + 1, r = l + 1;
        let best = i;
        if (l < a.length && this.cmp(a[l], a[best]) < 0) best = l;
        if (r < a.length && this.cmp(a[r], a[best]) < 0) best = r;
        if (best === i) break;
        [a[i], a[best]] = [a[best], a[i]];
        i = best;
      }
    }
    return top;
  }
}
```

**TopK 的标准解法**：

```js
// 求前 K 大：维护大小为 K 的【最小堆】
function topK(arr, k) {
  const heap = new MinHeap();
  for (const x of arr) {
    heap.push(x);
    if (heap.size > k) heap.pop();     // 弹掉当前 K+1 个里最小的
  }
  return heap.a.slice();               // 堆内即前 K 大（无序）
}
```

求「前 K 大」用「最小堆」：堆顶是这 K 个里最小的，来了更大的就淘汰堆顶，堆顶充当守门员。

| 方案 | 时间 | 空间 | 适用 |
|---|---|---|---|
| 全排序后取前 K | O(n log n) | O(n) 或 O(1) | 简单，n 小时可用 |
| **维护 K 大小堆** | **O(n log k)** | **O(k)** | **n 很大、k 很小（最优）** |
| 快速选择（quickselect） | 平均 O(n) | O(1) | 只需第 K 个，不需要全序 |
| 桶 / 计数（值域小） | O(n) | O(值域) | 分数、年龄这类有限值域 |

数据流中位数：一个大顶堆存前半、一个小顶堆存后半，保持大小差 ≤ 1。

### 3.3.9 常见坑

| 坑 | 后果 | 修正 |
|---|---|---|
| 排序阶段 `siftDown(arr, 0, n)` 用 n | **已排好的部分被重新打乱**（实测 `[3,1,4,5,2]` → `[5,4,3,2,1]`） | 用当前有效长度 `end` |
| 建堆从 `i = n - 1` 开始 | 对叶子做无用的 siftDown | 从 `n/2 - 1` |
| 建堆从 `i = 0` 正序 | 建出来的**不是堆**（实测 `[1..7]` → `[3,5,7,4,2,6,1]`） | 必须倒序 |
| 大顶堆写成 `a[child] < val` | 变成小顶堆，结果降序 | 大顶堆用 `>` |

### 3.3.10 口述要点

- 结论先行：数组即完全二叉树，建大顶堆 + 反复取堆顶；原地、不稳定、恒定 O(n log n)。
- 讲建堆：从 `n/2-1` 倒序 siftDown；用 `Σ (n/2^(h+1))·h` 收敛说明 O(n)，对比 siftUp 建堆是 O(n log n)。
- 讲排序：`swap(0, end)` + `siftDown(0, end)`，第三个参数是有效长度。
- 讲价值：三者中唯一 O(1) 空间 + 最坏 O(n log n)；高频的是堆结构本身（TopK、调度、Dijkstra、合并 K 路）。

---

## 3.4 三者横向对比

### 3.4.1 总表

| | 归并 | 快排 | 堆排 |
|---|---|---|---|
| 平均 | O(n log n) | O(n log n) | O(n log n) |
| 最好 | O(n log n) | O(n log n) | O(n log n) |
| **最坏** | **O(n log n)** ✅ | **O(n²)** ❌ | **O(n log n)** ✅ |
| 空间 | O(n) ❌ | O(log n) | **O(1)** ✅ |
| 稳定 | ✅ | ❌ | ❌ |
| 局部性 | 差（两数组跳） | **好（顺序扫）** | 差（跳父子） |
| 核心操作 | merge | partition | siftDown |
| 排序发生在 | 合并阶段 | 分区阶段 | 建堆 + 交换 |

### 3.4.2 一句话选型

```
要稳定？
  └─ 是 → 归并（或 TimSort）
  └─ 否 → 要 O(1) 空间 / 怕最坏退化？
            └─ 是 → 堆排
            └─ 否 → 快排（默认选择）
```

### 3.4.3 工业界的真实选择

| 场景 | 用的算法 | 原因 |
|---|---|---|
| **V8 `Array.prototype.sort`** | TimSort（归并 + 插入） | ES2019 要求稳定 |
| **C++ `std::sort`** | introsort（快排 + 堆排 + 插入） | 快排快，堆排兜底，插入收尾 |
| **C++ `std::stable_sort`** | 归并 | 要稳定 |
| **Java `Arrays.sort(对象)`** | TimSort | 要稳定 |
| **Java `Arrays.sort(基本类型)`** | 双轴快排 | 基本类型不需要稳定 |
| **Redis `SORT`** | 快排 | 不需要稳定 |
| **数据库 `ORDER BY`** | 外部归并排序 | 数据超内存 |
| **Linux 内核 `sort`** | 堆排 | 栈空间极度受限 |

---

## 3.5 本册速记卡

```
归并
  分治：均分 + merge；排序只发生在 merge 阶段
  稳定靠 <=；排对象必须传比较器
  恒定 O(n log n)；数组 O(n) 辅助 + O(log n) 栈，链表 O(log n)
  用途：稳定排序 / 链表 / 逆序对（mid-i+1）/ 外部排序
  自底向上：外层 lo < n - width，保证右半非空

快排
  partition 是核心；Lomuto 返回 i，Hoare 返回 j
  最坏 O(n²)：固定 pivot + 有序输入，或 Lomuto + 全相同
  防线：随机化 / 三数取中 / 三路分区 / 短边递归 / introsort
  空间：原地 O(log n) 栈；slice 版 O(n)
  三路：lt / i / gt，gt-- 后不 i++

堆排
  子 2i+1、2i+2；父 (i-1)>>1
  建堆：n/2-1 倒序 siftDown → O(n)
  排序：swap(0, end) + siftDown(0, end)
  三者中唯一 O(1) 空间 + 最坏 O(n log n)
  TopK：大小为 K 的最小堆，O(n log k)
```
