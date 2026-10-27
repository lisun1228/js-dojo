# 算法 · 01 复杂度分析与递归（尾调用）

> 覆盖：时间复杂度（大 O/Ω/Θ、主定理、均摊、空间）与尾调用/尾递归
> 数值以 Node 22（V8，默认 `--stack-size`）实测为准：栈深、操作计数器、`Array.prototype.sort` 比较次数

---

## 目录

- [1.1 什么是时间复杂度](#11-什么是时间复杂度)
- [1.2 尾调用优化与尾递归](#12-尾调用优化与尾递归)
- [1.3 本册速记卡](#13-本册速记卡)

---

## 1.1 什么是时间复杂度

### 1.1 一句话结论

时间复杂度不是「代码跑多久」，而是**运行时间随输入规模 n 增长的趋势**；大 O 记法忽略常数与低阶项，只保留最高阶。

### 1.1.1 为什么需要「趋势」而不是「秒数」

同一段代码在 M1 上跑 0.1 秒，在十年前的机器上跑 2 秒，用秒数描述没有可移植性。所以不测时间，而是数**基本操作执行次数随 n 怎么变**。

```js
// 求数组和
function sum(arr) {
  let s = 0;              // 1 次
  for (const x of arr) {  // n 次循环
    s += x;               // 每次 1 次
  }
  return s;               // 1 次
}
// 2n + 2 次基本操作 → 去常数、去系数 → O(n)
```

大 O 描述 n → ∞ 时的增长率：`2n` 与 `n` 只差常数倍。n 很小时常数项与低阶项占主导，大 O 预测不准，这也是小数组上插入排序常快于快排的原因。

### 1.1.2 大 O / Ω / Θ 三个记号的区别

| 记号 | 含义 | 对 `3n² + 2n + 1` |
|---|---|---|
| **O**（Big-O） | 渐进**上界**：最多这么慢 | O(n²)、O(n³) 都成立 |
| **Ω**（Big-Omega） | 渐进**下界**：至少这么慢 | Ω(n²)、Ω(n) 都成立 |
| **Θ**（Big-Theta） | **紧确界**：上下界同阶 | 只有 Θ(n²) 成立 |

快排最坏 Θ(n²)、平均/随机 Θ(n log n)。说「快排是 O(n²)」是上界，没错但不精确；追问时应能区分 O 与 Θ。

### 1.1.3 常见复杂度 + 增长速度直觉

```
O(1)      常量      数组下标访问 arr[i]
O(log n)  对数      二分查找、平衡树查找
O(√n)     根号      判断素数（试除到 √n）
O(n)      线性      一次遍历、两数之和（哈希）
O(n log n) 线性对数 归并/堆排、快排平均、排序后处理
O(n²)     平方      双层循环、冒泡、选择、插入
O(n³)     立方      Floyd 最短路、三重循环 DP
O(2ⁿ)     指数      子集枚举、朴素斐波那契（O(2ⁿ) 上界）
O(n!)     阶乘      全排列、旅行商暴力
```

**n = 10⁶ 时的操作数量级**（按每秒 10⁸ 次简单操作估算）：

| 复杂度 | 操作数 | 估算耗时 |
|---|---|---|
| O(log n) | 20 | 纳秒级 |
| O(n) | 10⁶ | ~10 ms |
| O(n log n) | 2×10⁷ | ~200 ms |
| O(n²) | 10¹² | ~2.8 小时 ❌ |
| O(2ⁿ) | 天文数字 ❌ | — |

> 经验值：JS 里 1 秒约 10⁸ 次简单操作（V8 紧凑循环）。n = 10⁵ 时 O(n²) = 10¹⁰，约 100 秒，必须降到 O(n log n)。

### 1.1.4 怎么数：四种常见情形

**情形 1：单层循环 → O(n)**

```js
for (let i = 0; i < n; i++) { /* O(1) */ }
```

**情形 2：嵌套循环 → 相乘，但要看内层边界**

```js
for (let i = 0; i < n; i++)
  for (let j = 0; j < n; j++) { }        // O(n²)

for (let i = 0; i < n; i++)
  for (let j = i; j < n; j++) { }        // n + (n-1) + ... + 1 = n(n+1)/2 → O(n²)
```

反例：双层循环不一定是 O(n²)。

```js
// 有序数组的双指针：l 与 r 各自单调移动，总共移动 ≤ n 次 → O(n)
let l = 0, r = arr.length - 1;
while (l < r) {
  if (arr[l] + arr[r] === target) return true;
  arr[l] + arr[r] < target ? l++ : r--;
}
```

判据：看每个指针/下标的**总移动次数**，而不是看有几层循环。

**情形 3：循环变量 ×2 / ÷2 → O(log n)**

```js
for (let i = 1; i < n; i *= 2) { }          // ⌈log₂n⌉ 次
while (n > 1) { n = Math.floor(n / 2); }    // ⌊log₂n⌋ 次
```

**情形 4：递归 → 写递推式再解**

```js
// 二分查找
T(n) = T(n/2) + O(1)          → Θ(log n)

// 归并排序
T(n) = 2T(n/2) + O(n)         → Θ(n log n)

// 朴素斐波那契（T(n) 为调用次数）
T(n) = T(n-1) + T(n-2) + O(1) → Θ(φⁿ)，φ ≈ 1.618，O(2ⁿ) 是它的上界

// 平衡二叉树遍历
T(n) = 2T(n/2) + O(1)         → Θ(n)
```

> 计数器实测：n = 65536 时二分 16 步（log₂n = 16）；归并比较 956,515 次（n log₂n ≈ 1,048,576）。

**主定理**（`T(n) = aT(n/b) + f(n)`，a ≥ 1、b > 1 为常数，f 渐进为正）：

| 分支 | 条件 | 结果 | 例子 |
|---|---|---|---|
| 1 | `f(n) = O(n^(log_b a − ε))`，存在 ε > 0 | `Θ(n^(log_b a))` | `T(n)=2T(n/2)+1` → `Θ(n)` |
| 2 | `f(n) = Θ(n^(log_b a) · log^k n)`，k ≥ 0 | `Θ(n^(log_b a) · log^(k+1) n)` | 二分 a=1,b=2,k=0 → `Θ(log n)`；归并 a=2,b=2,k=0 → `Θ(n log n)` |
| 3 | `f(n) = Ω(n^(log_b a + ε))`，存在 ε > 0，且 `a·f(n/b) ≤ c·f(n)`（c < 1） | `Θ(f(n))` | `T(n)=2T(n/2)+n²` → `Θ(n²)` |

三个分支之间有空隙：如 `f(n) = n^(log_b a) / log n` 不满足任一分支，主定理不适用；此时画递归树，总代价 = 每层代价 × 层数。

### 1.1.5 均摊复杂度

有些操作偶尔很慢，但摊到一串操作上很快。经典例子是动态数组 `push`：

```js
// 简化版动态数组
class ArrayList {
  constructor() { this.arr = []; this.size = 0; this.cap = 8; }
  push(x) {
    if (this.size === this.cap) {
      this.cap *= 2;
      this.arr = this.arr.slice();       // 扩容：O(n) 复制旧元素
      this.arr.length = this.cap;
    }
    this.arr[this.size++] = x;           // 常态：O(1)
  }
}
```

n 次 push 的复制量是 `8 + 16 + … + n/2 < n`（n 足够大时约 n），加上 n 次写入，总代价 < 2n，所以**单次均摊 O(1)**。

> 计数器实测：n = 2²⁰ 时总代价 2,097,144 ≈ 2n。记账法（每次 O(1) 操作存常数余额，扩容时支付）与势能法得到同一结论。

### 1.1.6 空间复杂度

只算**额外**空间，不算输入本身。

| 写法 | 空间 | 原因 |
|---|---|---|
| `arr[i]` 原地交换 | O(1) | 只用几个临时变量 |
| `[...arr]` / `arr.slice()` | O(n) | 新建数组 |
| 递归（深度 d，每帧 O(1)） | O(d) | 每层一个栈帧 |
| `new Map()` 存 n 项 | O(n) | 哈希表 |
| 快排（原地 + 递归，随机/平衡） | O(log n)，最坏 O(n) | 递归栈深度 |
| 快排（`slice` 版） | O(n)（平衡/随机），最坏 O(n²) | 每层创建的数组同时存活 |
| 归并（`slice` 版） | O(n) | 同上 |
| 归并（temp 数组复用） | O(n) | 一次性分配 |

常见错误：把递归深度 O(log n) 当成总空间，忽略每层创建且同时存活的辅助数组。

### 1.1.7 五个容易数错的场景

**① `includes` / `indexOf` 藏在循环里**

```js
// 看起来是单层循环，实际是 O(n²)
const res = [];
for (const x of arr) {
  if (!res.includes(x)) res.push(x);   // includes 是 O(n)
}

// 修正：用 Set，O(n)
const res2 = [...new Set(arr)];
```

同类：`arr.indexOf`、`str.includes`、`Array.prototype.find`。

**② 字符串拼接**

```js
let s = '';
for (const ch of arr) s += ch;
```

现代 V8 用 ConsString（rope）摊还 O(n)；朴素实现每次复制整串是 O(n²)。用 `arr.join('')` 不依赖引擎优化。

**③ `JSON.parse(JSON.stringify(obj))` 深拷贝**

时间 O(n)（n 为总节点数），空间 O(n)。会丢弃 `undefined`、`function`、`Symbol` 字段，`Date` 变成字符串，循环引用抛 `TypeError`。

**④ `sort()` 的比较函数**

`arr.sort((a, b) => a - b)` 最坏/随机 O(n log n)，V8 7.0 起用 TimSort，排序稳定。

> 计数器实测：n = 262,144 时随机输入 3,787,026 次比较（≈0.8·n log₂n）；已排序/逆序输入各 262,143 次（n−1，O(n)）。

比较函数每次若为 O(k)，总代价乘 k：例如比较函数里做 `a.split('').length`，整体就退化。

**⑤ 数组 `unshift` / `splice(0, 1)`**

都要移动后续元素，单次 O(n)，在循环里就是 O(n²)。用 `push` + 末尾 `reverse`，或改用双端队列。

### 1.1.8 答题要点

- **定义**：时间复杂度是运行时间随 n 增长的趋势，不是精确耗时；大 O 只保留最高阶，忽略常数与低阶项。
- **三个记号**：O 是上界、Ω 是下界、Θ 是紧确界；快排最坏 Θ(n²)、平均 Θ(n log n)。
- **数法**：单层 O(n)；嵌套看指针总移动次数（双指针/滑动窗口仍是 O(n)）；变量 ×2/÷2 是 O(log n)；递归写递推式，主定理不满足条件时画递归树。
- **均摊**：动态数组 push 单次最坏 O(n)，n 次总代价 < 2n，均摊 O(1)。
- **空间**：只算额外空间；递归是 O(深度)，每层同时存活的 O(n) 辅助数组要计入（快排 `slice` 版是 O(n) 而非 O(log n)）。

### 1.1.9 追问表

| 追问 | 回答要点 |
|---|---|
| 均摊和平均有什么区别？ | 均摊是「一串操作的总代价 / 操作数」，确定性的；平均是对输入分布求期望，依赖概率假设 |
| 什么操作看起来 O(1) 实际 O(n)？ | `unshift`、`shift`、`splice(0,k)`、`includes`、`indexOf`；`Object.keys()` 是 O(属性数) |
| 空间换时间的典型例子？ | 哈希表（两数之和 O(n²)→O(n)）、前缀和、记忆化搜索、位图 |

---

## 1.2 尾调用优化与尾递归

### 1.2 一句话结论

**尾调用**是函数最后一步只调用另一个函数，当前栈帧没有待办；**尾递归**是尾调用中调用自己的特例。理论上引擎可复用栈帧（TCO），把递归空间从 O(n) 降到 O(1)；但 JS 只有 Safari/JSC 在严格模式下实现，Chrome、Node、Firefox 都没有。

### 1.2.1 先分清三个概念

```
尾调用（Tail Call）
  └─ 最后一步调用另一个函数 f，f 的返回值直接作为本函数返回值
       └─ 尾递归（Tail Recursion）
            └─ 尾调用中，被调用的函数就是自己
```

判定标准：`return` 后只有一个函数调用，没有后续运算。

```js
function a(x) { return b(x); }                       // ✅ 尾调用
function a(x) { return b(x) + 1; }                   // ❌ 加法要用当前栈帧
function a(x) { const r = b(x); console.log(r); return r; }  // ❌ 调用后还有 log
function a(x) { return b(x) || c(); }                // ❌ b 的返回值还要参与 ||
```

### 1.2.2 为什么尾调用能省栈帧

普通递归（阶乘）：

```js
function fact(n) {
  if (n <= 1) return 1;
  return n * fact(n - 1);   // ← 调用返回后还要乘 n
}
```

调用 `fact(4)` 时栈的样子：

```
fact(4)  等待 4 * ?      ← 必须保留，因为返回后要做乘法
  fact(3)  等待 3 * ?
    fact(2)  等待 2 * ?
      fact(1)  return 1
      ──────── 开始逐层返回 ────────
    fact(2) 得到 1 → 返回 2*1 = 2
  fact(3) 得到 2 → 返回 3*2 = 6
fact(4) 得到 6 → 返回 4*6 = 24
```

栈深度 = n。Node 22 默认栈实测：裸递归约 1.06 万层溢出，带 `acc` 的尾递归版约 7.6k 层（形参更多、栈帧更大）；10 万层必然 `RangeError`。

尾递归（累加器）：

```js
function fact(n, acc = 1) {
  if (n <= 1) return acc;
  return fact(n - 1, n * acc);   // ← 调用是最后一步，返回值直接用
}
```

```
fact(4, 1)
  → fact(3, 4)     旧帧可以丢弃（没有任何待办）
  → fact(2, 12)
  → fact(1, 24)
  → return 24
```

若引擎复用栈帧，栈深度为 1；JS 主流引擎不复用（见 1.2.5），实际仍为 n。

### 1.2.3 怎么把普通递归改成尾递归：累加器模式

通用套路：把「返回后要做的事」变成「调用前先做完，放进参数」。

```js
// 普通：求和
function sum(arr, i = 0) {
  if (i === arr.length) return 0;
  return arr[i] + sum(arr, i + 1);        // 返回后还要加
}

// 尾递归：带累加器
function sum(arr, i = 0, acc = 0) {
  if (i === arr.length) return acc;
  return sum(arr, i + 1, acc + arr[i]);   // 加法先做完再调用
}
```

```js
// 普通：反转链表
function reverse(head) {
  if (!head || !head.next) return head;
  const newHead = reverse(head.next);     // 返回后还要改指针
  head.next.next = head;
  head.next = null;
  return newHead;
}

// 尾递归：把「新头」也当参数传下去
function reverse(head, prev = null) {
  if (!head) return prev;
  const next = head.next;
  head.next = prev;                       // 先改指针再调用
  return reverse(next, head);
}
```

```js
// 普通：斐波那契
function fib(n) {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);         // 两个调用，不是尾调用
}

// 尾递归：两个累加器
function fib(n, a = 0, b = 1) {
  if (n === 0) return a;
  return fib(n - 1, b, a + b);
}
```

尾递归版 `fib` 用两个累加器自底向上累加，顺带把 Θ(φⁿ) 降到 Θ(n)。

### 1.2.4 不是所有递归都能转尾递归

尾递归要求「递归调用之后没有任何待办」，而有回溯需求的递归做不到：

```js
// 二叉树中序遍历
function inorder(node) {
  if (!node) return;
  inorder(node.left);    // 返回后还要 visit，不是尾调用
  visit(node.val);
  inorder(node.right);   // 位于末尾，但整体仍不是尾递归
}
```

这类递归无法直接转尾递归，只能用**显式栈**模拟。

### 1.2.5 现实：JS 的 TCO 现状

规范层面：ES2015 要求在**严格模式**下实现 Proper Tail Calls（PTC），包括尾调用优化。

| 引擎 | 是否实现 TCO | 说明 |
|---|---|---|
| **JavaScriptCore**（Safari） | ✅ | 唯一实现 ES2015 PTC 的主流引擎 |
| **V8**（Chrome / Node / Edge） | ❌ | 明确表示不实现 |
| **SpiderMonkey**（Firefox） | ❌ | 未发布 |

V8 不实现的两个具体理由：

1. **栈信息丢失**：TCO 会「吃掉」栈帧，`Error.stack` 看不到完整调用链，线上排查困难。
2. **调试体验崩坏**：断点、单步执行无法还原真实调用层级。

所以在 Chrome/Node/Firefox 里，尾递归不会避免栈溢出，需要手动改循环或 trampoline。

### 1.2.6 既然没有 TCO，尾递归在 JS 里还有什么用？

**价值 1：让代码能被机械地改成循环**

尾递归和 `while` 循环同构：

```js
// 尾递归
function loop(state) {
  if (done(state)) return state;
  return loop(step(state));
}

// 等价循环
function loop(state) {
  while (!done(state)) state = step(state);
  return state;
}
```

**价值 2：配合 trampoline 自己实现「不爆栈」**

```js
// trampoline：递归处返回 thunk，由外层循环反复执行
function trampoline(fn) {
  return function (...args) {
    let result = fn(...args);
    while (typeof result === 'function') {
      result = result();
    }
    return result;
  };
}

const fact = trampoline(function factInner(n, acc = 1) {
  if (n <= 1) return acc;
  return () => factInner(n - 1, n * acc);   // 调原始函数，而不是包装后的 fact
});

fact(100000);   // 不爆栈；结果是 Infinity（100000! 超出 Number 范围）
```

关键是 thunk 里调用原始 `factInner`。若调用包装后的 `fact`，每层会新起一个 trampoline 循环，栈仍会增长（实测 5000 层即 `RangeError`）。

**价值 3：可读性 / 函数式风格**

状态机、AST 转换、批量 reducer 这类纯数据变换，尾递归写法接近声明式：

```js
// reducer 本身仍是 (state, action) => state，递归只发生在 applyAll
function applyAll(state, actions, i = 0) {
  if (i === actions.length) return state;
  return applyAll(reducer(state, actions[i]), actions, i + 1);
}
```

### 1.2.7 手写「用显式栈替代递归」

非尾递归（有回溯需求）的通用办法是显式栈。

```js
// 普通递归：二叉树前序遍历
function preorder(node, out = []) {
  if (!node) return out;
  out.push(node.val);
  preorder(node.left, out);
  preorder(node.right, out);
  return out;
}

// 显式栈：入栈顺序反过来（先右后左），因为栈是后进先出
function preorderStack(root) {
  if (!root) return [];
  const out = [];
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    out.push(node.val);
    if (node.right) stack.push(node.right);   // 先压右
    if (node.left) stack.push(node.left);     // 后压左 → 先弹出左
  }
  return out;
}
```

更通用的模板是用栈保存状态机，能模拟任意递归：

```js
// 模拟「处理左 → 处理根 → 处理右」的中序
function inorderStack(root) {
  const out = [];
  const stack = [];
  let cur = root;
  while (cur || stack.length) {
    while (cur) { stack.push(cur); cur = cur.left; }  // 一路向左
    cur = stack.pop();                                 // 弹出最左
    out.push(cur.val);
    cur = cur.right;                                   // 转向右子树
  }
  return out;
}
```

快排的非递归版同样用栈保存 `[lo, hi]` 区间。

### 1.2.8 常见坑

| 坑 | 现象 | 原因 / 修正 |
|---|---|---|
| 把 `return f(x) + 1` 当尾调用 | 栈仍然增长 | 有后续运算，不是尾调用 |
| 以为 JS 有 TCO | Chrome/Node 深递归仍 `RangeError` | 只有 Safari/JSC 在严格模式实现 |
| 非严格模式 | 即使 Safari 也不优化 | PTC 只在 `'use strict'` 下生效 |
| 累加器共享可变对象 | 多次调用互相污染 | 默认 `acc = []` 在顶层调用时新建；模块级数组会共享 |
| `arguments.callee` 做递归 | 严格模式报错 | 用命名函数表达式或具名函数 |

```js
function collect(arr, i = 0, acc = []) {   // ✅ 顶层调用时新建 acc
  if (i === arr.length) return acc;
  acc.push(arr[i]);
  return collect(arr, i + 1, acc);
}

const SHARED = [];
function bad(n, acc = SHARED) { /* ❌ 所有调用共享同一个数组 */ }
```

### 1.2.9 应用场景

| 场景 | 为什么适合 |
|---|---|
| **DFS / 树的深度优先遍历** | 天然递归；转尾递归或显式栈可避免深树爆栈 |
| **状态机 / 解析器** | 每个 token 处理完进入下一状态，天然是「最后一步」 |
| **编译器 AST 遍历与转换** | Babel 的 visitor 模式本质是递归下降 |
| **函数式累积（reduce 类）** | 累加器模式的标准形态 |
| **链表操作** | 反转、合并、删除倒数第 n 个都可用累加器改写 |
| **深拷贝 / 序列化** | 递归遍历对象树；循环引用要带 `WeakMap` |
| **分治算法** | 归并、快排不是尾递归（见下） |

归并和快排都不是尾递归：

- **归并**：`return merge(sort(left), sort(right))`，`merge` 在两次递归调用之后。
- **快排**：原地版 `quickSort(left); quickSort(right);` 的第二个调用在尾部，第一个不是；先递归较短一侧、另一侧用循环，栈深为 **O(log n)**，不是 O(1)。

### 1.2.10 答题要点

- **判定**：`return` 后只有一个函数调用，没有 `+1`、`console.log`、`||` 等后续运算。
- **改写**：用累加器把「返回后要做的运算」提前到参数里；阶乘写成 `fact(n-1, n*acc)`，斐波那契用双累加器从 Θ(φⁿ) 降到 Θ(n)。
- **JS 现实**：只有 Safari/JSC 在严格模式实现 PTC，V8 不实现（栈信息丢失、调试困难），所以尾递归仍会爆栈，需要循环或 trampoline。
- **不能转的情况**：中序、归并、快排这类有回溯需求的递归用显式栈；快排可先递归短侧，把栈深降到 O(log n)。

### 1.2.11 追问表

| 追问 | 回答要点 |
|---|---|
| trampoline 是什么？ | 递归处返回 thunk（函数），外层 `while` 反复执行，栈帧不累积 |
| 归并排序是尾递归吗？ | 不是，`merge` 在递归调用之后 |
| 快排能尾递归优化吗？ | 部分可以：先递归较短一侧，另一侧用循环，栈深 O(log n) |
| 怎么把任意递归改成非递归？ | 显式栈 + 状态机；有记忆化时也可自底向上 DP |

---

## 1.3 本册速记卡

```
复杂度
  大 O = 上界，Ω = 下界，Θ = 紧确界；快排最坏 Θ(n²)、平均 Θ(n log n)
  1e8 次简单操作 ≈ 1 秒（JS 经验值）
  双层循环不一定 n²（双指针每个指针只单调走一次）
  ×2 / ÷2 的循环 → log n
  递归 → 写递推式；主定理分支 1/3 需多项式间隔、分支 3 需正则条件；空隙用递归树
  均摊：动态数组 push 单次最坏 O(n)，n 次总代价 < 2n → 均摊 O(1)
  空间只算额外；递归 O(深度)，每层 slice 的数组同时存活则 O(n)
  隐藏的 O(n)：includes / indexOf / unshift / shift / splice(0,k)
  sort：V8 用 TimSort，随机 O(n log n)，已排序/逆序 O(n)，稳定

尾调用
  判定：return 后只有一个函数调用
  尾递归 = 累加器把中间结果传下去
  TCO：ES2015 要求严格模式，只有 Safari/JSC 实现，V8 不做（栈信息/调试）
  没有 TCO 时尾递归的价值：易转循环 + trampoline + 可读
  有回溯需求的递归（中序、归并、快排）转不了 → 显式栈；快排先递归短侧 O(log n)
```
