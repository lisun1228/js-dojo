# 算法 · 01 复杂度分析与递归（尾调用）

> 本册覆盖：时间复杂度、尾递归与尾调用优化
> 这两类题在面试里的定位是「**基础筛子**」——答不好会直接被认为「没系统学过」，答得好也很难拉开差距。所以策略是：**说准、说全、别炫技**。

---

## 1.1 什么是时间复杂度

### 一句话结论

时间复杂度不是「代码跑多久」，而是**「运行时间随输入规模 n 增长的趋势」**，用大 O 记法忽略常数和低阶项，只保留最高阶。

### 1.1.1 为什么需要「趋势」而不是「秒数」

同一段代码，在 M1 上跑 0.1 秒，在十年前的机器上跑 2 秒。**用秒数描述的复杂度没有可移植性**。

所以我们不测时间，而是数「**基本操作执行了多少次，随 n 怎么变**」。

```js
// 例：求数组和
function sum(arr) {
  let s = 0;              // 1 次
  for (const x of arr) {  // n 次循环
    s += x;               // 每次 1 次，共 n 次
  }
  return s;               // 1 次
}
// 总操作数 = 2n + 2 → 去掉常数 2、去掉系数 2 → O(n)
```

**「去掉系数」的合法性**：因为大 O 描述的是 n → ∞ 时的增长率。`2n` 和 `n` 相差一个常数倍，在 n 足够大时这个差距被 n 的量级掩盖。这也意味着：**当 n 很小（比如 n < 50）时，大 O 的预测是不准的**——这正是「插入排序比快排快」在小数组上成立的原因。

### 1.1.2 大 O / Ω / Θ 三个记号的区别

很多人只知大 O，被追问就露怯。三者的严格定义：

| 记号 | 含义 | 通俗说法 | 例子（对 `3n² + 2n + 1`） |
|---|---|---|---|
| **O**（Big-O） | 渐进**上界** | 「最多这么慢」 | O(n²)、O(n³) 都对 |
| **Ω**（Big-Omega） | 渐进**下界** | 「至少这么慢」 | Ω(n²)、Ω(n) 都对 |
| **Θ**（Big-Theta） | **紧确界**（上下界同阶） | 「就是这么快」 | 只有 Θ(n²) 对 |

所以严格说，说「快排是 O(n²)」没错（它确实是上界），但不够精确；说「快排平均 Θ(n log n)」更准确。

面试时口头说「O」是行业惯例，不用刻意改成 Θ，但**如果面试官追问「快排到底是 O 还是 Θ」，你要能答出这个区别**。

### 1.1.3 常见复杂度 + 增长速度直觉

```
O(1)      常量      数组下标访问 arr[i]
O(log n)  对数      二分查找、平衡树查找
O(√n)     根号      判断素数（试除到 √n）
O(n)      线性      一次遍历、两数之和（哈希）
O(n log n) 线性对数 归并/快排/堆排、排序后处理
O(n²)     平方      双层循环、冒泡、选择、插入
O(n³)     立方      Floyd 最短路、三重循环 DP
O(2ⁿ)     指数      子集枚举、暴力递归（斐波那契朴素版）
O(n!)     阶乘      全排列、旅行商暴力
```

**n = 10⁶ 时的操作数量级**（用来判断会不会超时）：

| 复杂度 | 操作数 | 实际耗时（JS 估算） |
|---|---|---|
| O(log n) | 20 | 纳秒级 |
| O(n) | 10⁶ | ~1 ms |
| O(n log n) | 2×10⁷ | ~20 ms |
| O(n²) | 10¹² | 约 2.7 小时 ❌ |
| O(2ⁿ) | 天文数字 ❌ | — |

> 经验值：**JS 里 1 秒大约能做 10⁸ 次简单操作**（V8 优化后的紧凑循环）。所以 n = 10⁵ 时，O(n²) = 10¹⁰ 会超时，必须降到 O(n log n)。

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
  for (let j = i; j < n; j++) { }        // n + (n-1) + ... + 1 = n(n+1)/2 → 仍是 O(n²)
```

⚠️ **反例：双层循环不一定是 O(n²)**

```js
// 双指针：l 和 r 各自单调移动，总共移动 2n 次 → O(n)，不是 O(n²)
let l = 0, r = arr.length - 1;
while (l < r) {
  if (arr[l] + arr[r] === target) return true;
  arr[l] + arr[r] < target ? l++ : r--;
}
```

**判据：看每个指针/下标的总移动次数，而不是看有几层循环。**

**情形 3：循环变量不是 +1 而是 ×2 / ÷2 → O(log n)**

```js
for (let i = 1; i < n; i *= 2) { }   // log₂n 次
while (n > 1) { n = Math.floor(n / 2); }  // 同上
```

**情形 4：递归 → 写递推式再解**

```js
// 二分查找
T(n) = T(n/2) + O(1)  →  O(log n)

// 归并排序
T(n) = 2T(n/2) + O(n) →  O(n log n)

// 朴素斐波那契
T(n) = T(n-1) + T(n-2) + O(1) → O(2ⁿ)

// 二叉树遍历
T(n) = 2T(n/2) + O(1) → O(n)
```

**Master 定理速记**（`T(n) = aT(n/b) + f(n)`）：

| 关系 | 结果 | 例子 |
|---|---|---|
| `f(n)` 比 `n^(log_b a)` **小** | `Θ(n^(log_b a))` | 二分：a=1,b=2 → n^0 = 1，f=O(1) → Θ(log n)? 需特判 |
| 两者**同阶** | `Θ(n^(log_b a) · log n)` | 归并：a=2,b=2 → n^1，f=O(n) 同阶 → Θ(n log n) |
| `f(n)` 比它**大** | `Θ(f(n))` | — |

> 实际面试不用背 Master 定理的三种情形，**会写递推式 + 会画递归树**就够。递归树法：每层总代价 × 层数。

### 1.1.5 均摊复杂度（加分项）

有些操作「偶尔很慢，但平均下来很快」。

**经典例子：动态数组 push**

```js
// 简化版 JS 数组扩容逻辑
class ArrayList {
  constructor() { this.arr = []; this.size = 0; this.cap = 8; }
  push(x) {
    if (this.size === this.cap) {
      this.cap *= 2;                       // 扩容：O(n)，复制全部元素
      this.arr.length = this.cap;
    }
    this.arr[this.size++] = x;             // 常态：O(1)
  }
}
```

n 次 push 的总代价：`1 + 1 + ... + (扩容 n/2) + (扩容 n/4) + ...` ≈ `n + n = 2n`。

所以**单次 push 的均摊复杂度是 O(1)**。

> 面试话术：「单次最坏 O(n)，但均摊 O(1)。用**聚合法**算：n 次操作总代价 2n，摊到每次就是常数。」
>
> 另外两种分析法：**记账法**（每次 O(1) 操作存 2 块钱，扩容时用存款付）、**势能法**（定义势函数，用 ΔΦ 摊销）。

### 1.1.6 空间复杂度

只算**额外**空间，不算输入本身。

| 写法 | 空间 | 原因 |
|---|---|---|
| `arr[i]` 原地交换 | O(1) | 只用几个临时变量 |
| `[...arr]` / `arr.slice()` | O(n) | 新建数组 |
| 递归（深度 d） | O(d) | 每层一个栈帧 |
| `new Map()` 存 n 项 | O(n) | 哈希表 |
| 快排（原地 + 递归） | O(log n) | 递归栈深度 |
| 快排（`slice` 版） | **O(n)** | 每层都创建新数组，且同时存在 |
| 归并（`slice` 版） | O(n) | 同上 |
| 归并（temp 数组复用） | O(n) | 一次性分配 |

⚠️ 这是**最高频的错误**：把「递归深度 O(log n)」当成总空间，忽略了每层创建的辅助数组。

### 1.1.7 五个容易数错的真实场景

**① `arr.includes()` / `indexOf()` 藏在循环里**

```js
// 看起来是单层循环，实际是 O(n²)
const res = [];
for (const x of arr) {
  if (!res.includes(x)) res.push(x);   // includes 是 O(n)
}

// 修正：用 Set，O(n)
const res = [...new Set(arr)];
```

同类陷阱：`arr.indexOf`、`str.includes`、`Object.keys(obj).includes`、`Array.prototype.find`。

**② 字符串拼接**

```js
let s = '';
for (const ch of arr) s += ch;   // 现代 V8 用 rope 结构，实际接近 O(n)，但老引擎是 O(n²)
```

面试标准答法：「现代引擎有优化，但**仍然建议用数组 `join`**，因为无法保证所有环境都优化。」

**③ `JSON.parse(JSON.stringify(obj))` 深拷贝**

时间 O(n)（n 是总节点数），空间 O(n)。但会丢 `undefined`、`function`、`Symbol`、`Date` 变字符串、循环引用直接抛错。

**④ `sort()` 的比较函数**

`arr.sort((a, b) => a - b)` 是 O(n log n)，但如果比较函数内部有 O(n) 操作（比如 `a.split('').length`），整体就退化了。

**⑤ 数组 `unshift` / `splice(0, 1)`**

`unshift` 是 O(n)（要移动所有元素），在循环里用就是 O(n²)。用 `push` + 最后 `reverse`，或改用双端队列。

### 1.1.8 答题模板

**30 秒版**

> 时间复杂度描述的是运行时间随输入规模增长的趋势，用大 O 表示，只保留最高阶项、忽略常数。
> 常见量级从快到慢是 O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(2ⁿ)。
> 分析方法上，单层循环 O(n)、嵌套相乘、循环变量 ×2 或 ÷2 是 O(log n)、递归写递推式解。

**2 分钟版（加分层）**

> 时间复杂度不是精确耗时，是增长率。严格说有三个记号：大 O 是上界、Ω 是下界、Θ 是紧确界，平时口头说 O 是习惯。
> 分析时我一般看三件事：循环的嵌套关系、循环变量的变化方式、递归的递推式。要注意两个常见误判——双指针虽然有两层循环但每个指针只单调移动，总共 O(n)；`includes` 这类 O(n) 方法藏在循环里会把 O(n) 变成 O(n²)。
> 还有一种情况是单次最坏和整体平均差别很大，比如动态数组 push 单次最坏 O(n)，但均摊是 O(1)，n 次操作总代价只有 2n。
> 空间上只算额外空间，最容易算错的是递归——递归深度只是栈空间，如果每层还 `slice` 了新数组，那总空间是 O(n) 而不是 O(log n)。

### 1.1.9 追问表

| 追问 | 回答要点 |
|---|---|
| 大 O 和 Θ 有什么区别？ | O 是上界（可能不紧），Θ 是紧确界。`3n²` 是 O(n²) 也是 O(n³)，但只有 Θ(n²) |
| 为什么忽略常数？ | 描述 n→∞ 的趋势；n 很小时大 O 预测不准，这也是小数组用插入排序更快的原因 |
| 双层循环一定 O(n²) 吗？ | 不一定。双指针、滑动窗口都是双层但 O(n)，看指针总移动次数 |
| 均摊和平均有什么区别？ | 均摊是「一串操作的总代价 / 操作数」，是**确定性的**；平均是「对输入分布求期望」，依赖概率假设 |
| 快排的空间复杂度？ | 原地 + 递归是 O(log n)（栈深度）；`slice` 版是 O(n) |
| 递归的空间复杂度怎么算？ | 递归深度 × 每层栈帧大小；如果每层有 O(n) 的辅助数组且同时存活，要乘上去 |
| 什么操作看起来 O(1) 实际 O(n)？ | `unshift`、`splice(0,k)`、`shift`、`includes`、字符串 `+=`（老引擎）、`Object.keys()` |
| 10⁶ 数据能用什么复杂度？ | O(n) 和 O(n log n) 都行（1ms / 20ms），O(n²) 绝对不行 |
| 空间换时间的典型例子？ | 哈希表（两数之和从 O(n²) 到 O(n)）、前缀和、记忆化搜索、位图 |

---

## 1.2 尾调用优化与尾递归

> 原题单里第 2 题（尾递归的理解与应用场景）和第 6 题（什么是尾调用优化和尾递归）**内容完全重复**，这里合并成一节。

### 一句话结论

**尾调用**是函数最后一步只做「调用另一个函数」这一件事，不再需要当前栈帧；**尾递归**是尾调用的特例（调用自己）。理论上引擎可以复用栈帧（TCO），从而把递归的空间从 O(n) 降到 O(1)——**但 JS 里只有 Safari 实现了，Chrome/Node 都没有**。

### 1.2.1 先分清三个概念

```
尾调用（Tail Call）
  └─ 最后一步是调用另一个函数 f，且 f 的返回值直接作为本函数返回值
       └─ 尾递归（Tail Recursion）
            └─ 尾调用中，被调用的函数就是自己
```

**判定标准只有一个**：`return` 后面**只有一个函数调用**，没有其他运算。

```js
// ✅ 尾调用：return 后面直接是 b()
function a(x) { return b(x); }

// ❌ 不是尾调用：return 后面是 b(x) + 1，加法要用到 a 的栈帧
function a(x) { return b(x) + 1; }

// ❌ 不是尾调用：调用之后还有 console.log
function a(x) { const r = b(x); console.log(r); return r; }

// ❌ 不是尾调用：b() 的结果被 return 了，但 a 还要继续执行 log
function a(x) { return b(x) || c(); }   // 严格说 || 是运算

// ✅ 尾调用（三元也算「直接返回」的一种边界情况，引擎实现有差异，保守起见不举此例）
```

### 1.2.2 为什么尾调用能省栈帧

**普通递归**（阶乘）：

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

栈深度 = n。n = 10 万时直接 `RangeError: Maximum call stack size exceeded`。

**尾递归**（累加器）：

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

栈深度 = 1（理想情况下）。**关键差异：中间结果通过参数传下去了，当前帧没有任何「待办事项」。**

### 1.2.3 怎么把普通递归改成尾递归：累加器模式

**通用套路**：把「返回后要做的事」变成「调用前先做完，放进参数」。

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
// 普通：斐波那契（还顺便把 O(2ⁿ) 降到 O(n)）
function fib(n) {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);         // 两个调用，根本不是尾调用
}

// 尾递归：两个累加器
function fib(n, a = 0, b = 1) {
  if (n === 0) return a;
  return fib(n - 1, b, a + b);
}
```

> 注意：`fib` 的尾递归版**顺带解决了重复计算**，因为它是自底向上迭代的。这是「转尾递归」的额外收益——很多时候**转成尾递归 ≈ 转成迭代**。

### 1.2.4 尾递归能转，但所有递归都能转吗？

**不能。** 尾递归要求「递归调用之后没有任何待办」。而很多递归天然有「回溯」需求：

```js
// 二叉树中序遍历：左子树处理完还要处理根，再处理右子树
function inorder(node) {
  if (!node) return;
  inorder(node.left);    // 返回后还要访问 node.val
  visit(node.val);
  inorder(node.right);   // 返回后什么都不用做，这个才算尾调用
}
```

`inorder(node.left)` 不是尾调用（返回后要 `visit`）。这类**非线性递归无法直接转尾递归**，只能用**显式栈**模拟。

### 1.2.5 现实：JS 的 TCO 现状

**规范层面**：ES6（ES2015）明确要求在**严格模式**下实现 Proper Tail Calls（PTC），包括尾调用优化。

**实现层面**：

| 引擎 | 是否实现 TCO | 说明 |
|---|---|---|
| **JavaScriptCore**（Safari） | ✅ | 唯一实现了 ES6 PTC 的主流引擎 |
| **V8**（Chrome / Node / Edge） | ❌ | 明确表示不实现 |
| **SpiderMonkey**（Firefox） | ❌ | 曾实现过，后因兼容问题回滚 |

**V8 为什么不实现？**（这个问题答出来很加分）

1. **栈信息丢失**：TCO 会「吃掉」栈帧，`Error.stack` 里看不到完整的调用链，线上排查问题会变成噩梦。
2. **调试体验崩坏**：断点、单步执行无法还原真实调用层级。
3. **性能收益存疑**：真正需要深递归的场景，用循环更清晰也更快；TCO 引入的额外判断反而会让正常函数变慢。
4. **规范与实现的博弈**：只有 Safari 实现时，代码行为在不同浏览器不一致，反而更危险。V8 团队曾专门发博客说明这个决定。

> 面试话术：「ES6 规范要求严格模式下实现 PTC，但实际只有 Safari 的 JSC 做了。V8 明确拒绝，主要理由是栈信息丢失和调试困难。所以在 JS 里写尾递归**不会**避免栈溢出，需要手动改循环或 trampoline。」

### 1.2.6 既然没有 TCO，尾递归在 JS 里还有什么用？

这是面试官最爱追的一句。**有三个真实价值**：

**价值 1：让代码「能被安全地改成循环」**

尾递归和 `while` 循环是同构的，改写是机械的：

```js
// 尾递归
function loop(state) {
  if (done(state)) return state;
  return loop(step(state));
}

// 等价循环（无需思考，一行行换）
function loop(state) {
  while (!done(state)) state = step(state);
  return state;
}
```

**价值 2：配合 trampoline，自己实现「不爆栈」**

```js
// trampoline：把递归调用变成「返回一个函数」，由外层循环反复执行
function trampoline(fn) {
  return function (...args) {
    let result = fn(...args);
    while (typeof result === 'function') {
      result = result();
    }
    return result;
  };
}

// 用 trampoline 包装：递归处返回 thunk 而不是直接调用
const fact = trampoline(function (n, acc = 1) {
  if (n <= 1) return acc;
  return () => fact(n - 1, n * acc);   // ← 返回一个「待执行的调用」
});

fact(100000);   // 不会栈溢出
```

⚠️ 注意 `fact` 在闭包里引用自己——`const` 声明的变量在函数体内可访问，这里能工作。但更稳妥的写法是给内部函数单独命名。

**价值 3：可读性 / 函数式风格**

在 Redux reducer、编译器 AST 转换、状态机这类「纯数据变换」场景里，尾递归写法比循环更贴近声明式表达。

```js
// Redux reducer：本质就是 (state, action) => state 的累积
function reducer(state, action) {
  switch (action.type) {
    case 'ADD': return { ...state, list: [...state.list, action.payload] };
    default: return state;
  }
}
// 多个 action 的批处理，尾递归写法很自然
function applyAll(state, actions, i = 0) {
  if (i === actions.length) return state;
  return applyAll(reducer(state, actions[i]), actions, i + 1);
}
```

### 1.2.7 手写「用显式栈替代递归」

对于**非尾递归**（有回溯需求），唯一通用的办法是显式栈。

```js
// 普通递归：二叉树前序遍历
function preorder(node, out = []) {
  if (!node) return out;
  out.push(node.val);
  preorder(node.left, out);
  preorder(node.right, out);
  return out;
}

// 显式栈：注意入栈顺序要反过来（先右后左），因为栈是后进先出
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

**更通用的模板**：用栈保存「状态机」，能模拟任意递归。

```js
// 通用：模拟「处理左 → 处理根 → 处理右」的中序
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

> 后端常问的「手写快排的非递归版」也是这个套路：用栈保存 `[lo, hi]` 区间。

### 1.2.8 常见坑

| 坑 | 现象 | 原因 / 修正 |
|---|---|---|
| 以为 `return f(x) + 1` 是尾调用 | 栈依然溢出 | 有后续运算，不是尾调用 |
| 以为 JS 有 TCO | Chrome 里 n=10 万就爆栈 | 只有 Safari 实现 |
| 非严格模式 | 即使 Safari 也不优化 | PTC 只在 `'use strict'` 下生效 |
| 累加器用了可变对象 | 结果错乱 | `acc = []` 默认参数每次调用会新建，但如果传的是外部对象会被共享 |
| `arguments.callee` 做递归 | 严格模式报错 | 用命名函数表达式或具名函数 |
| 尾递归版 `fib` 写了三个参数但调用只传一个 | 结果不对 | 默认参数只在 `undefined` 时生效，`fib(10, undefined, undefined)` 才会用默认值 |

```js
// 坑：默认参数是对象/数组时，每次调用都会新建（这个是安全的）
function collect(arr, i = 0, acc = []) {   // ✅ 每次新数组
  if (i === arr.length) return acc;
  acc.push(arr[i]);
  return collect(arr, i + 1, acc);
}

// 但如果默认值来自模块级变量，就会共享
const SHARED = [];
function bad(n, acc = SHARED) { /* ❌ 所有调用共享同一个数组 */ }
```

### 1.2.9 应用场景（面试官常追问「有哪些应用场景」）

| 场景 | 为什么适合 |
|---|---|
| **DFS / 树的深度优先遍历** | 天然递归；转尾递归或显式栈可避免深树爆栈 |
| **状态机 / 解析器** | 每个 token 处理完进入下一状态，天然是「最后一步」 |
| **编译器 AST 遍历与转换** | Babel 的 visitor 模式本质是递归下降 |
| **函数式累积（reduce 类）** | 累加器模式的标准形态 |
| **链表操作** | 反转、合并、删除倒数第 n 个，尾递归写起来比循环更简洁 |
| **深拷贝 / 序列化** | 递归遍历对象树；注意循环引用要带 `WeakMap` |
| **分治算法** | 归并、快排——但注意这两个**不是**尾递归（返回后还要 merge/concat） |

> ⚠️ 一个常被搞错的点：**归并排序和快排都不是尾递归**。
> - 归并：`return merge(sort(left), sort(right))` —— `merge` 在调用之后，不是尾调用。
> - 快排：`return [...quickSort(left), pivot, ...quickSort(right)]` —— 拼接在调用之后；即使用原地版，`quickSort(左)` 之后还要 `quickSort(右)`，第一个调用不是尾调用（**第二个**是，这叫「尾递归优化一半」，可以让栈深变成 O(1) 如果先递归短的一侧）。

### 1.2.10 答题模板

**30 秒版**

> 尾调用是函数最后一步直接返回另一个函数的调用结果，当前栈帧没有待办，理论上可以被复用。尾递归是它调自己的特例，靠累加器把中间结果传下去。
> ES6 规范要求严格模式下实现尾调用优化，但实际只有 Safari 做了，Chrome 和 Node 都没有，所以 JS 里写尾递归**不会**避免栈溢出，大递归还是要改循环或用 trampoline。

**2 分钟版（加分层）**

> 尾调用的判定只有一个标准：`return` 后面只有一个函数调用，没有 `+1`、没有 `console.log`、没有 `||`。满足这个条件，当前帧的局部变量和返回地址都不再需要，引擎就可以把它弹掉，栈深度保持常数。
> 尾递归就是把递归写成这个样子，关键是**累加器模式**——把「返回后要做的运算」提前到参数里。比如阶乘从 `n * fact(n-1)` 改成 `fact(n-1, n*acc)`；斐波那契从双递归改成双累加器，顺带把 O(2ⁿ) 降到 O(n)。
> 但要注意两点。第一，JS 里 TCO 只有 JavaScriptCore 实现了，V8 明确拒绝，理由是栈信息丢失、调试困难；所以尾递归在 Chrome 里照样爆栈。第二，**不是所有递归都能转尾递归**——中序遍历、归并、快排这类有「回溯」需求的，只能用显式栈模拟。
> 实际工程里我的做法是：能一眼看出是尾递归的就写成循环（等价改写，可读性不损失）；确实需要递归表达的（比如 AST 遍历）就保留递归，但加深度上限保护，或者用显式栈。

### 1.2.11 追问表

| 追问 | 回答要点 |
|---|---|
| 尾调用和尾递归的区别？ | 尾递归是尾调用的特例（调用自己）；尾调用可以调任何函数 |
| `return f(x) + 1` 是尾调用吗？ | 不是，`+1` 要用到当前栈帧 |
| JS 有尾调用优化吗？ | 规范要求（严格模式），实际只有 Safari/JSC 实现 |
| V8 为什么不实现？ | 栈信息丢失、调试困难、性能收益有限 |
| 那尾递归在 JS 里还有意义吗？ | 有：可读性、易转循环、可配 trampoline 避免爆栈 |
| trampoline 是什么？ | 递归处返回 thunk（函数），外层 `while` 循环反复执行，把栈变成堆上的队列 |
| 归并排序是尾递归吗？ | 不是，`merge` 在递归调用之后 |
| 快排能尾递归优化吗？ | 部分可以：先递归较短的一侧，另一侧用循环，栈深降到 O(log n) |
| 怎么把任意递归改成非递归？ | 显式栈 + 状态机；或记忆化 + 自底向上 DP |
| 递归深度上限大概多少？ | V8 默认约 1 万层（视栈帧大小），实测常在 1~1.5 万之间；不要依赖具体数字 |

---

## 1.3 本册速记卡

```
复杂度
  大 O = 上界，Ω = 下界，Θ = 紧确界；口头说 O 是习惯
  1e8 次简单操作 ≈ 1 秒（JS）
  双层循环不一定 n²（双指针每个指针只单调走一次）
  ×2 / ÷2 的循环 → log n
  递归 → 写递推式 / 画递归树：每层代价 × 层数
  均摊：动态数组 push 单次最坏 O(n)，n 次总代价 2n → 均摊 O(1)
  空间只算额外；递归 O(深度)，但每层 slice 了数组就是 O(n)
  隐藏的 O(n)：includes / indexOf / unshift / shift / splice(0,k)

尾调用
  判定：return 后面只有一个函数调用
  尾递归 = 累加器把中间结果传下去
  TCO：ES6 要求严格模式，只有 Safari 实现，V8 不做（栈信息/调试）
  没用 TCO 也要写尾递归的理由：易转循环 + 可 trampoline + 可读
  有回溯需求的递归（中序、归并、快排）转不了尾递归 → 显式栈
```
