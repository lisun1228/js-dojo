# TS · 10 手写实现题 10 道

> 本册覆盖：sleep、myMap、treePath、product、myAll、sum、mergeArray、firstSingleChar、reverseWord、objToArray
> 这 10 道占全部 46 题的 22%，但**考的不是 TS 特性，而是「用 TS 写代码 + 算法基本功」**。
> 原题单有 **3 个真实 bug**（myAll 空数组死锁、reverseWord 多余空格、product 类型全丢），本册逐一修复。
> **每题的答题重点不是「写出来」，而是「类型标注得准不准 + 边界想到了没有」。**

---

## 10.1 一句话结论

这类题的评分权重（按重要性）：

| 权重 | 维度 | 说明 |
|---|---|---|
| ★★★★★ | **边界** | 空输入、单元素、重复、稀疏数组、`null` 入参 |
| ★★★★★ | **类型标注** | 泛型用得对不对、返回类型精不精确、`readonly` 要不要加 |
| ★★★★☆ | **正确性** | 别看错题（比如「第一个只出现一次」是要**原串顺序**的第一个） |
| ★★★☆☆ | **复杂度** | 能报出来，且不写 O(n²) 的傻实现 |
| ★★★☆☆ | **可读性** | 命名、提前返回、不用 `var` |

**最容易失分的不是「写不出来」，而是「类型写得太松」**——比如 `product(...arrays: any[][]): any[][]`，等于没有类型。

---

## 10.2 十道题速查表

| # | 题号 | 题目 | 难度 | 核心考点 | 原答案 |
|---|---|---|---|---|---|
| 1 | 13 | sum | ⭐ | rest 参数、`reduce` 初值 | ✅ 正确但太简单 |
| 2 | 14 | mergeArray | ⭐ | 泛型 + `readonly` | ✅ 可加泛型约束 |
| 3 | 6 | sleep | ⭐⭐ | Promise 包装、可取消 | ✅ 可扩展 |
| 4 | 9 | myMap | ⭐⭐ | 泛型 + 稀疏数组 + `thisArg` | ⚠️ 漏了稀疏数组 |
| 5 | 18 | objToArray | ⭐⭐ | `Object.entries` 类型、保留 key | ⚠️ 丢失 key 字面量 |
| 6 | 15 | firstSingleChar | ⭐⭐ | Map 插入顺序、返回 `null` | ✅ 正确 |
| 7 | 16 | reverseWord | ⭐⭐ | 正则边界、trim | ❌ **多余空格 bug** |
| 8 | 10 | treePath | ⭐⭐⭐ | DFS + 回溯、避免拷贝 | ⚠️ O(n·depth) 拷贝 |
| 9 | 11 | product | ⭐⭐⭐ | 笛卡尔积 + **元组类型推导** | ❌ **类型全丢** |
| 10 | 12 | myAll | ⭐⭐⭐⭐ | Promise 并发 + **空数组** | ❌ **空数组永不 resolve** |

---

## 10.3 逐题详解

### 10.3.1 sum

**题目**：实现 `sum` 方法。

#### 基础版

```ts
function sum(...nums: number[]): number {
  return nums.reduce((acc, n) => acc + n, 0);
}

sum(1, 2, 3);      // 6
sum();             // 0（初值 0 保证空调用不报错）
```

**类型要点**：
- `...nums: number[]` 是 rest 参数，调用时可以传任意个
- **`reduce` 必须给初值 `0`**，否则空数组会抛 `Reduce of empty array with no initial value`

#### 追问一：浮点精度

```ts
sum(0.1, 0.2);     // 0.30000000000000004  ← IEEE 754 的锅
```

**三种解法**：

```ts
// ① 整数化（适合金额场景，单位用分）
function sumMoney(...cents: number[]): number {
  return cents.reduce((a, b) => a + b, 0) / 100;
}

// ② 按最大小数位数放大
function sumDecimal(...nums: number[]): number {
  const maxDigits = Math.max(
    ...nums.map((n) => (String(n).split('.')[1] ?? '').length)
  );
  const factor = 10 ** maxDigits;
  return nums.reduce((a, b) => a + Math.round(b * factor), 0) / factor;
}
sumDecimal(0.1, 0.2);    // 0.3 ✅

// ③ Kahan 求和（处理大数吃小数）
function kahanSum(nums: number[]): number {
  let sum = 0;
  let c = 0;                          // 补偿项
  for (const n of nums) {
    const y = n - c;
    const t = sum + y;
    c = t - sum - y;                  // 丢失的低位
    sum = t;
  }
  return sum;
}
```

#### 追问二：柯里化版本（「无限累加」）

```ts
function add(a: number) {
  return function (b?: number): any {
    if (b === undefined) return a;
    return add(a + b);
  };
}

add(1)(2)(3)();     // 6
add(1)(2)();        // 3
```

**类型怎么写**：

```ts
interface CurriedAdd {
  (a: number): CurriedAdd;
  (): number;
}
```
**但这个类型在 TS 里无法精确表达**（可变参数数量的链式调用），实际要用重载或多个接口，或者接受 `any`。

#### 追问三：支持数组或变参

```ts
function sum(a: number[]): number;
function sum(...nums: number[]): number;
function sum(...args: [number[]] | number[]): number {
  const nums = Array.isArray(args[0]) ? args[0] : (args as number[]);
  return nums.reduce((a, b) => a + b, 0);
}
```

---

### 10.3.2 mergeArray

**题目**：实现 `mergeArray`。

#### 基础版 + 类型改进

```ts
// 原答案
function mergeArray<T>(a: T[], b: T[]): T[] {
  return [...a, ...b];
}
```

**问题**：`T[]` 排除了 `readonly` 数组，而实际调用时经常传 `as const` 的数组。

```ts
// ✅ 改进：接受 readonly
function mergeArray<T>(a: readonly T[], b: readonly T[]): T[] {
  return [...a, ...b];
}

const A = [1, 2] as const;      // readonly [1, 2]
const B = [3, 4] as const;
mergeArray(A, B);                // ✅ 不报错
```

**但这样 T 会被推成 `1 | 2 | 3 | 4`**：

```ts
const r = mergeArray([1, 2] as const, [3, 4] as const);
// r: (1 | 2 | 3 | 4)[]   ← 元素类型是联合
```

**如果想要 `[1, 2, 3, 4]` 这样的元组**：

```ts
function mergeTuple<A extends readonly unknown[], B extends readonly unknown[]>(
  a: A,
  b: B,
): [...A, ...B] {
  return [...a, ...b];
}

const t = mergeTuple([1, 2] as const, ['a'] as const);
// t: [1, 2, 'a']  ← 精确元组
```

**`[...A, ...B]` 这个类型叫「变长元组（variadic tuple）」，TS 4.0 引入。**

#### 追问：合并去重

```ts
function mergeUnique<T>(a: readonly T[], b: readonly T[]): T[] {
  return [...new Set([...a, ...b])];
}
```

**注意**：`Set` 用 `SameValueZero` 比较，所以 `NaN === NaN`（去重时 `NaN` 只会留一个），但 `{}` 不会去重（引用不同）。

#### 追问：合并两个有序数组（归并）

```ts
function mergeSorted(a: readonly number[], b: readonly number[]): number[] {
  const res: number[] = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    res.push(a[i] <= b[j] ? a[i++] : b[j++]);
  }
  while (i < a.length) res.push(a[i++]);
  while (j < b.length) res.push(b[j++]);
  return res;
}
```

---

### 10.3.3 sleep

**题目**：实现 `sleep` 方法。

#### 基础版

```ts
function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function main() {
  console.log('start');
  await sleep(1000);
  console.log('1 秒后');
}
```

**类型要点**：
- `Promise<void>` 显式标注（`resolve` 不传值）
- **不要写 `Promise<unknown>` 或省略**，否则 `await sleep(1000)` 的类型不明确

#### 追问一：可取消的 sleep

**为什么要可取消**：组件卸载后还在 `await`，会导致「更新已卸载组件的状态」警告。

```ts
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    // 已经取消就直接 reject
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// 使用
const ac = new AbortController();
sleep(5000, ac.signal).catch((e) => {
  if (e.name === 'AbortError') console.log('取消了');
});
ac.abort();
```

**三个细节**：
1. **成功时要 `removeEventListener`**，否则 signal 上挂的监听器泄漏
2. **`{ once: true }`** 让监听器自动移除
3. **用 `DOMException` 而不是普通 Error**，和 `fetch` 的行为一致

#### 追问二：为什么不用 `setInterval`

不需要——`setTimeout` 一次性就够，用 `setInterval` 还要自己 `clearInterval`。

#### 追问三：`setTimeout` 的返回值类型

```ts
// 浏览器：number
// Node.js：NodeJS.Timeout
// 用这个类型可以跨环境
let timer: ReturnType<typeof setTimeout>;
```

**这是「为什么 TS 项目里要写 `ReturnType<typeof setTimeout>`」的原因。**

---

### 10.3.4 myMap

**题目**：实现 `myMap`。

#### 原答案与两个遗漏

```ts
// 原答案
function myMap<T, U>(arr: T[], fn: (item: T, index: number) => U): U[] {
  const result: U[] = [];
  for (let i = 0; i < arr.length; i++) {
    result.push(fn(arr[i], i));
  }
  return result;
}
```

**遗漏 1：稀疏数组**

```ts
const sparse = [1, , 3];          // 中间有空洞
sparse.length;                     // 3
1 in sparse;                       // false ← 索引 1 不存在
```

**实测两种实现的差异**（Node 22）：

| 检查项 | 原生 `map` | 原答案（`push`） |
|---|---|---|
| `result.length` | 3 | 3 |
| `result[1]` | **`undefined`** | **`NaN`** |
| `1 in result` | **`false`**（保持稀疏） | **`true`**（被填了值） |
| `JSON.stringify` | `[2,null,6]` | `[2,null,6]`（`NaN` 序列化成 `null`） |

**所以 `JSON.stringify` 看不出差别，但 `1 in result` 和 `result[1]` 不一样。** 原生 `map` 承诺「空洞还是空洞」，`push` 会把空洞填成 `NaN`。

**遗漏 2：`thisArg` 和完整回调参数**

原生 `map` 的回调签名是 `(value, index, array) => U`，还支持 `thisArg`。

#### 正确实现

```ts
function myMap<T, U, This = undefined>(
  arr: readonly T[],
  fn: (this: This, item: T, index: number, array: readonly T[]) => U,
  thisArg?: This,
): U[] {
  const len = arr.length;
  const result = new Array<U>(len);      // 先定长，保持稀疏性

  for (let i = 0; i < len; i++) {
    // ★ 跳过稀疏数组的空洞
    if (i in arr) {
      result[i] = fn.call(thisArg as This, arr[i], i, arr);
    }
  }
  return result;
}
```

**四个改进点**：

| 改进 | 原因 |
|---|---|
| `readonly T[]` | 接受 `as const` 数组，且语义上 map 不该改原数组 |
| `i in arr` 判断 | 跳过稀疏空洞，和原生行为一致 |
| `new Array<U>(len)` + `result[i] =` | 保持稀疏性（`1 in result === false`）；用 `push` 会把空洞填成 `NaN` |
| `this: This` + `call(thisArg)` | 支持 `thisArg`，类型也能正确推导 |

**验证**：

```ts
myMap([1, 2, 3], (x) => x * 2);           // [2, 4, 6]
myMap([1, , 3], (x) => x * 2);            // [2, <1 empty>, 6]  ✅ 和原生一致

const obj = { factor: 10 };
myMap([1, 2], function (x) { return x * this.factor; }, obj);   // [10, 20] ✅
```

#### 追问：泛型为什么是两个

```ts
function myMap<T, U>(...): U[]
//             ↑  ↑
//          元素类型  返回元素类型
```

**如果只用一个 `T`**，就只能返回 `T[]`，无法「映射成不同类型」：

```ts
// ❌ 这样只能同类型映射
function badMap<T>(arr: T[], fn: (x: T) => T): T[]

// ✅ 两个泛型才能把 number[] 映射成 string[]
myMap([1, 2], (x) => String(x));    // string[]
```

---

### 10.3.5 objToArray

**题目**：补充 `objToArray` 函数。

#### 原答案与问题

```ts
// 原答案
function objToArray<T>(obj: Record<string, T>): [string, T][] {
  return Object.entries(obj);
}
```

**问题**：`Record<string, T>` 会把所有 key 都变成 `string`，**丢失具体 key 的类型**：

```ts
const config = { host: 'localhost', port: 3000 };
const arr = objToArray(config);
// arr: [string, string | number][]     ← key 是 string，不是 'host' | 'port'
//                                     ← value 是联合，不是精确对应
```

**理想结果应该是**：

```ts
// [['host', string], ['port', number]]
type Expected = ['host', string] | ['port', number];
```

#### 精确版本

```ts
function objToArray<T extends Record<string, unknown>>(
  obj: T,
): { [K in keyof T]: [K, T[K]] }[keyof T][] {
  return Object.entries(obj) as { [K in keyof T]: [K, T[K]] }[keyof T][];
}
```

**拆解这个类型**：

```
① { [K in keyof T]: [K, T[K]] }
   对每个 key K，生成一个元组 [K, T[K]]
   → { host: ['host', string]; port: ['port', number] }

② [keyof T]
   取所有值的联合
   → ['host', string] | ['port', number]

③ []
   变成数组
   → (['host', string] | ['port', number])[]
```

**验证**：

```ts
const config = { host: 'localhost', port: 3000 };
const arr = objToArray(config);

for (const [k, v] of arr) {
  if (k === 'host') {
    v.toUpperCase();      // ✅ v 收窄为 string
  } else {
    v.toFixed();          // ✅ v 收窄为 number
  }
}
```

**这是「判别联合 + 元组」的实战用法**——`for...of` 里 `k` 一判断，`v` 的类型就自动收窄了。

#### 追问：`Object.entries` 的类型为什么不准

```ts
// lib.es2017.object.d.ts
entries<T>(o: { [s: string]: T } | ArrayLike<T>): [string, T][];
entries(o: {}): [string, any][];
```

**它只能给出 `[string, T]`，无法保留 key 的字面量类型**——这是 TS 的类型局限（`Object.entries` 返回的是新数组，无法表达「每个元素的 key 类型不同」）。

**所以必须 `as` 断言**。这是一个**合理的断言**（因为我们知道实现是正确的），但要在注释里说明。

---

### 10.3.6 firstSingleChar

**题目**：找第一个只出现一次的字符。

#### 原答案（正确）

```ts
function firstSingleChar(s: string): string | null {
  const map = new Map<string, number>();
  for (const c of s) {
    map.set(c, (map.get(c) || 0) + 1);
  }
  for (const [c, count] of map) {
    if (count === 1) return c;
  }
  return null;
}
```

#### 为什么这个实现是对的（关键）

**`Map` 的遍历顺序 = 插入顺序**（规范保证），而插入顺序 = 字符**首次出现**的顺序。

所以「遍历 Map 找到第一个 count === 1 的」= 「原串中第一个只出现一次的字符」✅

**⚠️ 换成普通对象就错了**：

```ts
// ❌ 错误：数字键会被「整数键优先排序」
const map: Record<string, number> = {};
for (const c of '3a3b1') map[c] = (map[c] || 0) + 1;
Object.keys(map);      // ['1', '3', 'a', 'b']  ← 数字键被提前了！
```

**实测验证**（输入 `'3a3b1'`）：

```
用 Record：返回 '1'   ❌ 错（原串第一个只出现一次的是 'a'）
用 Map：  返回 'a'   ✅ 对
```

**这两个实现只差「用 `Record` 还是 `Map` 做容器」，结果就完全相反。**

**这是「为什么计数要用 `Map` 不用 `Record`」的硬理由**——不是性能，是**顺序语义**。

#### 三处可改进

```ts
function firstSingleChar(s: string): string | null {
  if (!s) return null;                     // ① 空串快返回

  const count = new Map<string, number>();
  for (const ch of s) {
    count.set(ch, (count.get(ch) ?? 0) + 1);   // ② 用 ?? 而不是 ||
  }

  for (const [ch, c] of count) {
    if (c === 1) return ch;
  }
  return null;
}
```

| 改进 | 原因 |
|---|---|
| `if (!s) return null` | 空串直接返回，省一次 Map 构造（也是明确的语义） |
| `??` 代替 `\|\|` | 虽然 count 不会为 0，但 `??` 语义更准确（「没有这个 key」而不是「falsy」） |
| 用 `for...of` 而不是 `split('')` | **emoji 安全**（`split('')` 会把 emoji 拆成两个代理项） |

#### 变体：两遍扫描 O(n) / O(1) 空间？

**标准解法是两遍 + 哈希表，O(n) 时间、O(k) 空间**。

**如果要求 O(1) 空间**：可以用「位图」（只适合 ASCII）：

```ts
function firstSingleCharAscii(s: string): string | null {
  // 用两个 32 位整数当位图：seen 标记出现过，repeated 标记出现多次
  const seen = new Uint32Array(4);       // 128 位，覆盖 ASCII
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c > 127) continue;
    const w = c >> 5, b = 1 << (c & 31);
    if (seen[w] & b) repeated[w] |= b;
    else seen[w] |= b;
  }
  // 再扫一遍找第一个「出现过且没重复」的
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    if (c > 127) continue;
    const w = c >> 5, b = 1 << (c & 31);
    if ((seen[w] & b) && !(repeated[w] & b)) return ch;
  }
  return null;
}
```

**这个解法只在「字符集有限」时成立**（ASCII 128 个字符 = 4 个 32 位整数）。Unicode 做不到 O(1) 空间。

---

### 10.3.7 reverseWord【原答案有 bug】

**题目**：反转单词顺序，`'hello world'` → `'world hello'`。

#### 原答案的 bug

```ts
// ❌ 原答案
function reverseWord(s: string): string {
  return s.split(/\s+/).reverse().join(' ');
}
```

**问题：前导/尾随空格会产生空字符串元素**

```ts
' hello world'.split(/\s+/);
// ['', 'hello', 'world']     ← 第一个是空串！

// .reverse() → ['world', 'hello', '']
// .join(' ')  → 'world hello '   ← 末尾多一个空格
```

```ts
'hello world '.split(/\s+/);
// ['hello', 'world', '']
// .reverse().join(' ') → ' world hello'   ← 开头多一个空格
```

```ts
'  a  b  '.split(/\s+/);
// ['', 'a', 'b', '']  →  ' b a '   ← 两端都有多余空格
```

**根因**：`String.prototype.split(/\s+/)` 在字符串**以分隔符开头或结尾**时，会产生空字符串元素。

#### 修复一：加 trim

```ts
function reverseWord(s: string): string {
  return s.trim().split(/\s+/).reverse().join(' ');
}
```

**验证**：

**实测对比（Node 22，`JSON.stringify` 输出，空格可见）**：

| 输入 | 原答案 | 修复版 |
|---|---|---|
| `'hello world'` | `'world hello'` ✅ | `'world hello'` ✅ |
| `' hello'` | `'hello '` ❌ 尾随空格 | `'hello'` ✅ |
| `'hello '` | `' hello'` ❌ 前导空格 | `'hello'` ✅ |
| `'  a  b  '` | `' b a '` ❌ 两端多余 | `'b a'` ✅ |
| `''` | `''` ✅ | `''` ✅ |
| `'   '`（纯空格） | **`' '`** ❌ **返回一个空格！** | `''` ✅ |

**最后一行最能说明问题**：纯空格输入时，原答案返回的是**一个空格**，而不是空串。

**但 `''.split(/\s+/)` 是 `['']`**，所以 `''` 走一遍是 `['']` → reverse → `['']` → join → `''`。✅ 没问题。

**`'   '.trim()` 是 `''`**，同上。✅

#### 修复二：手动扫描（不依赖正则，更可控）

```ts
function reverseWord(s: string): string {
  const words: string[] = [];
  let cur = '';

  for (const ch of s) {
    if (/\s/.test(ch)) {
      if (cur) {                 // ★ 只在 cur 非空时 push（天然跳过连续空白）
        words.push(cur);
        cur = '';
      }
    } else {
      cur += ch;
    }
  }
  if (cur) words.push(cur);      // 收尾

  return words.reverse().join(' ');
}
```

**这个版本的好处**：
- **不依赖 `trim`**，逻辑自洽
- 能处理任意空白（空格、Tab、换行）
- **支持 Unicode**（`for...of` 按码点）

**代价**：`cur += ch` 在很长的字符串下有性能问题（虽然现代引擎有 rope 优化）。生产代码可以用数组收集字符。

> **面试话术**：「这题有个容易踩的坑：`split(/\s+/)` 在字符串以空白开头或结尾时会产生空字符串元素，直接 reverse + join 会多出空格。修复是加 `trim()`，或者手动扫描、只在遇到非空词时才 push。我一般用 `trim().split(/\s+/).reverse().join(' ')`，一行搞定且能归一多个连续空格。」

---

### 10.3.8 treePath

**题目**：获取树中从根到目标节点的路径。

#### 原答案与性能问题

```ts
// 原答案
function treePath(
  tree: TreeNode[],
  id: number,
  path: TreeNode[] = [],
): TreeNode[] | null {
  for (const node of tree) {
    const next = [...path, node];        // ⚠️ 每次递归都拷贝整个 path
    if (node.id === id) return next;
    if (node.children) {
      const found = treePath(node.children, id, next);
      if (found) return found;
    }
  }
  return null;
}
```

**逻辑正确**，但有两个问题：

| 问题 | 说明 |
|---|---|
| **每次 `[...path, node]` 是 O(depth) 拷贝** | 总复杂度从 O(n) 变成 **O(n × depth)**，深树时会明显变慢 |
| **`if (node.children)` 没判空数组** | `[]` 是 truthy，会白做一次递归（无害但浪费） |

#### 更优实现：回溯（push / pop）

```ts
interface TreeNode {
  id: number;
  name?: string;
  children?: TreeNode[];
}

function treePath(tree: readonly TreeNode[], id: number): TreeNode[] | null {
  const path: TreeNode[] = [];

  function dfs(nodes: readonly TreeNode[]): boolean {
    for (const node of nodes) {
      path.push(node);                              // 进入
      if (node.id === id) return true;              // 找到，path 就是答案
      if (node.children?.length && dfs(node.children)) return true;   // 递归
      path.pop();                                   // ★ 回溯：没找到就退出
    }
    return false;
  }

  return dfs(tree) ? [...path] : null;              // ★ 返回副本
}
```

**关键三点**：

1. **`path.push` / `path.pop` 配对**：进入时 push，没找到就 pop（回溯）
2. **找到时直接 `return true`，不 pop**——因为 path 正是我们要的路径
3. **返回 `[...path]` 而不是 `path`**——否则返回的是内部数组的引用，后续调用会污染它

**复杂度**：O(n) 时间（每个节点进出一次）、O(depth) 空间（只有一条路径 + 递归栈）。

**对比**：

| 实现 | 时间 | 空间 |
|---|---|---|
| 原答案（拷贝 path） | **O(n × depth)** | O(depth²)（每层的 path 都存活） |
| 回溯版 | **O(n)** | O(depth) |

#### 边界检查

```ts
treePath([], 1);                       // null ✅
treePath([{ id: 1 }], 1);              // [{id:1}] ✅
treePath([{ id: 1 }], 999);            // null ✅
treePath([{ id: 1, children: [] }], 1); // [{id:1}] ✅
```

#### 如果树是「父节点引用」结构

**另一种常见结构**：每个节点有 `parentId`，要「从叶子往上找」：

```ts
function pathByParentId(
  all: readonly TreeNode[],
  id: number,
): TreeNode[] | null {
  const byId = new Map(all.map((n) => [n.id, n]));
  const target = byId.get(id);
  if (!target) return null;

  const path: TreeNode[] = [];
  let cur: TreeNode | undefined = target;
  while (cur) {
    path.unshift(cur);              // 从头插，或最后 reverse
    cur = cur.parentId != null ? byId.get(cur.parentId) : undefined;
  }
  return path;
}
```

**这种结构下不需要 DFS**，直接顺着 parentId 往上走，O(depth)。

#### 追问：如果树很大（几万个节点）

| 优化 | 说明 |
|---|---|
| **迭代 DFS**（显式栈） | 避免递归爆栈（默认约 1 万层） |
| **先建 id → node 的 Map** | 如果查询多次，一次建表 O(n)，之后每次查询 O(1) 定位 + O(depth) 回溯 |
| **给每个节点加 path 字段** | 建树时就算好，查询 O(1)，但内存翻倍 |

---

### 10.3.9 product【原答案类型全丢】

**题目**：实现 `product` 方法（多个数组的笛卡尔积）。

#### 原答案与问题

```ts
// ❌ 原答案：类型全丢
function product(...arrays: any[][]): any[][] {
  return arrays.reduce(
    (acc, arr) => acc.flatMap((x) => arr.map((y) => [...x, y])),
    [[]],
  );
}
```

**逻辑正确**，但 `any[][]` 意味着：

```ts
const r = product([1, 2], ['a', 'b']);
r[0][0].toFixed();    // ✅ 编译通过（因为是 any），但如果第一个元素是 'a' 就运行时崩
```

**边界检查**：

```ts
product();             // [[]]  ← 0 个数组时返回「只有一个空组合」
product([]);           // []    ← 1 个空数组时返回空
product([1, 2], []);   // []    ← 任一为空则结果为空
```

**这三个边界都是正确的**（笛卡尔积的数学定义：空集的积有 1 个元素——空元组）。

#### 精确类型的实现

```ts
/** 把「数组的元组」映射成「元素类型的元组」 */
type ElementsOf<T extends readonly (readonly unknown[])[]> = {
  -readonly [K in keyof T]: T[K] extends readonly (infer U)[] ? U : never;
};

function product<T extends readonly (readonly unknown[])[]>(
  ...arrays: T
): ElementsOf<T>[] {
  return arrays.reduce<unknown[][]>(
    (acc, arr) => acc.flatMap((combo) => arr.map((item) => [...combo, item])),
    [[]],
  ) as ElementsOf<T>[];
}
```

**类型推导过程**：

```ts
const r = product([1, 2] as const, ['a', 'b'] as const);

// T = readonly [readonly [1, 2], readonly ['a', 'b']]
// ElementsOf<T> = [1 | 2, 'a' | 'b']       ← 精确的元组！
// 返回值： [1 | 2, 'a' | 'b'][]

r[0][0].toFixed();       // ✅ 因为 1|2 是 number
r[0][1].toUpperCase();   // ✅ 因为 'a'|'b' 是 string
r[0][2];                 // ❌ 报错：长度是 2
```

**为什么必须用 `as const`**：不加的话 `[1, 2]` 推断成 `number[]`，`ElementsOf` 得到 `number` 而不是 `1 | 2`。**但即使不加，`[number, string]` 这个元组结构也是精确的**——这已经比 `any[][]` 强太多了。

**`ElementsOf` 为什么能保持元组**：这是一个 **homomorphic mapped type**（`[K in keyof T]` 直接作用于 `T`），TS 对元组/数组有特殊处理，会保持结构。

#### 用生成器实现（大数据量更省内存）

```ts
function* productGen<T extends readonly (readonly unknown[])[]>(
  ...arrays: T
): Generator<ElementsOf<T>> {
  const indices = new Array(arrays.length).fill(0);

  if (arrays.some((a) => a.length === 0)) return;

  while (true) {
    yield indices.map((idx, i) => arrays[i][idx]) as ElementsOf<T>;

    // 从最后一位开始进位
    let k = indices.length - 1;
    while (k >= 0) {
      if (++indices[k] < arrays[k].length) break;
      indices[k] = 0;
      k--;
    }
    if (k < 0) return;      // 全部进位完，结束
  }
}
```

**优势**：**不一次性生成所有组合**（如果 3 个数组各 1000 个元素，结果是 10 亿个组合，`reduce` 版直接 OOM）。

#### 追问：结果数量是多少

```
product(a, b, c).length === a.length * b.length * c.length
```

**所以要提醒调用方：这个函数的输出规模是乘积级的**，实际用的时候要小心。

---

### 10.3.10 myAll【原答案有空数组死锁 bug】

**题目**：实现 `Promise.all`。

#### 原答案的致命 bug

```ts
// ❌ 原答案
function myAll<T>(promises: Promise<T>[]): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const results: T[] = [];
    let count = 0;
    promises.forEach((p, i) => {
      p.then((val) => {
        results[i] = val;
        if (++count === promises.length) resolve(results);
      }).catch(reject);
    });
  });
}
```

**问题**：`myAll([])` **永远不 resolve**。

```
promises.length === 0
    ↓
forEach 一次都不执行
    ↓
count 永远是 0
    ↓
`++count === 0` 永远为 false（因为 count 先自增变成 1）
    ↓
Promise 永久 pending  💥
```

**实测验证**（Node 22，用 `Promise.race` 加 100ms 超时探测）：

```
badAll([])  → TIMEOUT（死锁，Promise 永久 pending）
goodAll([]) → []      ✅ 立即 resolve
```

**这就是「看起来对、但在边界上死锁」的典型 bug**。面试官问「空数组呢」就是在等你这个。

**其他三个问题**：

| 问题 | 说明 |
|---|---|
| **参数类型太窄** | `Promise<T>[]` 不接受普通值（`Promise.all([1, 2])` 是合法的） |
| **不支持 `Iterable`** | 原生 `Promise.all` 接受任何可迭代对象（Set、生成器） |
| **用 `forEach` 处理稀疏数组** | `forEach` 会跳过空洞，导致某些索引永远不被赋值 |

#### 正确实现（面试版）

```ts
function myAll<T>(values: Iterable<T | Promise<T>>): Promise<Awaited<T>[]> {
  return new Promise((resolve, reject) => {
    const arr = [...values];
    const len = arr.length;

    // ★ 关键：空数组立即 resolve
    if (len === 0) {
      resolve([]);
      return;
    }

    const results = new Array<Awaited<T>>(len);
    let count = 0;

    for (let i = 0; i < len; i++) {
      // 用 Promise.resolve 包一层，支持普通值
      Promise.resolve(arr[i]).then((val) => {
        results[i] = val as Awaited<T>;
        if (++count === len) resolve(results);
      }, reject);      // ★ 用第二个参数而不是 .catch
    }
  });
}
```

**五个关键点**：

| 点 | 原因 |
|---|---|
| **`if (len === 0) resolve([])`** | 修复空数组死锁 |
| **`for` 循环而不是 `forEach`** | 稀疏数组下 `forEach` 会跳过空洞，导致 `count` 永远到不了 `len` |
| **`Promise.resolve(arr[i])`** | 支持普通值（`myAll([1, 2])`） |
| **`.then(onFulfilled, onRejected)`** | 用第二个参数捕获，**避免多建一个 Promise**（`.then().catch()` 会额外创建一个） |
| **`results[i] = val` 而不是 `push`** | 保证顺序（Promise 完成顺序是乱的，但结果顺序必须和输入一致） |

#### 精确类型版（对齐 `Promise.all`）

```ts
function myAll<T extends readonly unknown[] | []>(
  values: T,
): Promise<{ -readonly [P in keyof T]: Awaited<T[P]> }> {
  return new Promise((resolve, reject) => {
    const len = values.length;
    if (len === 0) {
      resolve([] as never);
      return;
    }
    const results = new Array(len);
    let count = 0;
    for (let i = 0; i < len; i++) {
      Promise.resolve(values[i]).then((v) => {
        results[i] = v;
        if (++count === len) resolve(results as never);
      }, reject);
    }
  });
}
```

**这个类型能做到**：

```ts
const r = await myAll([Promise.resolve(1), 'a'] as const);
// r: [number, 'a']   ← 精确的元组！不是 (number | string)[]
```

**`Awaited<T[P]>` 是关键**——它递归解包 Promise：

```ts
type A = Awaited<Promise<number>>;               // number
type B = Awaited<Promise<Promise<string>>>;      // string（递归解包）
type C = Awaited<number>;                        // number（非 Promise 原样）
```

**`{ -readonly [P in keyof T]: ... }` 里的 `-readonly` 不能省**——否则传入 `as const` 的数组时，结果会带 `readonly`，而 `Promise.all` 的结果应该是可变的。

#### 追问一：为什么不用 `async/await`

```ts
// ❌ 这样是串行的，不是并发！
async function serialAll<T>(ps: Promise<T>[]): Promise<T[]> {
  const out: T[] = [];
  for (const p of ps) out.push(await p);    // 一个一个等
  return out;
}
```

**关键区别**：

```ts
// 并发：所有 Promise 同时启动，总耗时 = max(各个耗时)
await Promise.all([sleep(1000), sleep(1000)]);     // ≈ 1000ms

// 串行：一个接一个，总耗时 = sum
for (const p of [sleep(1000), sleep(1000)]) await p;  // ≈ 2000ms
```

**注意**：`myAll` 的入参如果是「已经创建好的 Promise」，那它们**在传进来之前就已经开始执行了**，所以「并发」是天然的。区别只在「等待」的方式。

**如果入参是「返回 Promise 的函数」**，那才需要区分：

```ts
// 并发
await Promise.all(tasks.map((fn) => fn()));

// 串行
for (const fn of tasks) await fn();
```

#### 追问二：`allSettled` 怎么实现

```ts
type Settled<T> =
  | { status: 'fulfilled'; value: T }
  | { status: 'rejected'; reason: unknown };

function myAllSettled<T>(values: Iterable<T | Promise<T>>): Promise<Settled<Awaited<T>>[]> {
  return myAll(
    [...values].map((v) =>
      Promise.resolve(v).then(
        (value): Settled<Awaited<T>> => ({ status: 'fulfilled', value: value as Awaited<T> }),
        (reason): Settled<Awaited<T>> => ({ status: 'rejected', reason }),
      ),
    ),
  );
}
```

**核心技巧**：把每个 Promise 都 `.then` 成「永远不会 reject 的 settled 对象」，然后直接 `myAll`。

#### 追问三：`race` / `any` 的实现

```ts
// race：第一个 settled（不管成功失败）
function myRace<T>(values: Iterable<T | Promise<T>>): Promise<Awaited<T>> {
  return new Promise((resolve, reject) => {
    for (const v of values) Promise.resolve(v).then(resolve, reject);
  });
}

// any：第一个 fulfilled（全部 reject 才 reject）
function myAny<T>(values: Iterable<T | Promise<T>>): Promise<Awaited<T>> {
  return new Promise((resolve, reject) => {
    const arr = [...values];
    if (arr.length === 0) {
      return reject(new AggregateError([], 'All promises were rejected'));
    }
    const errors: unknown[] = [];
    let rejected = 0;
    arr.forEach((v, i) => {
      Promise.resolve(v).then(resolve, (e) => {
        errors[i] = e;
        if (++rejected === arr.length) {
          reject(new AggregateError(errors, 'All promises were rejected'));
        }
      });
    });
  });
}
```

**注意 `any` 的空数组**：原生行为是**立即 reject** 一个 `AggregateError`（和 `all` 相反）。

---

## 10.4 十道题的共同模式

### 10.4.1 五个反复出现的考点

| 模式 | 出现在 | 怎么写 |
|---|---|---|
| **泛型 + 两个类型参数** | myMap、product | `<T, U>` 或 `<T extends ...>` |
| **边界：空输入** | 全部 10 道 | 开头 `if (!len) return ...` |
| **边界：稀疏数组 / 空洞** | myMap、myAll | `i in arr` / 用 `for` 不用 `forEach` |
| **避免拷贝** | treePath | push/pop 回溯而不是 `[...path, x]` |
| **类型推导要精确** | product、myAll、objToArray | 元组映射类型 + `as const` + `Awaited` |

### 10.4.2 一个通用的「手写题检查清单」

```
□ 空输入会怎样？（[]、''、0 个参数）
□ 单元素会怎样？
□ 有重复元素 / 重复 key 会怎样？
□ 稀疏数组 / 空洞？
□ 入参是 null / undefined？
□ 返回类型精确吗？（不是 any，不是过宽的联合）
□ 会修改入参吗？（该不该 readonly）
□ 复杂度是多少？能报出来吗？
□ 有没有不必要的拷贝？（深递归里的展开）
```

**面试时写完代码，主动按这个清单说一遍**——比等面试官问要好得多。

---

## 10.5 这类题怎么答（答题策略）

### 30 秒版（开场）

> 这类手写题我会先确认三件事：**输入的类型和边界**（空、单元素、重复）、**要不要保持顺序**、**能不能改入参**。然后写实现，写完主动报复杂度和边界。最后如果有类型上的讲究（比如泛型推导、`readonly`），我会额外说一句。

### 2 分钟版（以 myAll 为例，展示答题节奏）

> 我先确认需求：实现一个类似 `Promise.all` 的方法，**所有成功才成功、任一失败就失败、结果顺序和输入一致**。
>
> **边界上我要处理三个**：空数组要立即 resolve（这是最容易漏的，因为 `forEach` 不执行、计数永远到不了 0）；入参可能是普通值不是 Promise，所以要用 `Promise.resolve` 包一层；入参可能是稀疏数组，所以要用 `for` 循环而不是 `forEach`，否则某些索引永远不被处理、计数永远不齐。
>
> **实现**：外层一个 `new Promise`，内部维护 `results` 数组和 `count` 计数器，遍历输入，每个元素 `Promise.resolve().then(onFulfilled, onRejected)`——**用 `.then` 的第二个参数而不是 `.catch`，可以少建一个 Promise**。成功时把值按**索引**写入 `results`（不能用 push，因为完成顺序是乱的），计数到长度就 resolve；失败时直接 reject。
>
> **类型上**，如果要做到和原生一样精确，可以写成泛型 + 元组映射：`<T extends readonly unknown[]>(values: T): Promise<{[P in keyof T]: Awaited<T[P]>}>`，这样 `myAll([Promise.resolve(1), 'a'] as const)` 会得到 `[number, 'a']` 而不是 `(number | string)[]`。`Awaited` 会递归解包 Promise。
>
> **复杂度** O(n) 时间、O(n) 空间。如果想扩展，`allSettled` 就是把每个 Promise 都 `.then` 成一个永不 reject 的 `{status, value/reason}` 对象再复用 `all`；`race` 是第一个 settled 就 resolve/reject；`any` 是第一个 fulfilled，全失败才 reject 一个 `AggregateError`。

### 各题的「一句话补充」

| 题 | 写完补一句 |
|---|---|
| sum | 「`reduce` 必须给初值 0，否则空数组抛错；浮点精度问题可以用整数化或 Kahan 求和」 |
| mergeArray | 「想保持元组精度可以用变长元组类型 `[...A, ...B]`」 |
| sleep | 「生产里应该支持 AbortSignal 可取消，否则组件卸载后还在 await」 |
| myMap | 「要跳过稀疏数组的空洞，用 `i in arr` 判断」 |
| objToArray | 「`Object.entries` 的类型只能给 `[string, T]`，要保留 key 字面量得用映射类型 + 断言」 |
| firstSingleChar | 「必须用 `Map` 不能用普通对象，因为对象的数字键会被排序，破坏『原串顺序』语义」 |
| reverseWord | 「`split(/\s+/)` 遇前后空格会产生空串元素，要 `trim()`」 |
| treePath | 「用 push/pop 回溯避免每层拷贝 path，把 O(n·depth) 降到 O(n)」 |
| product | 「输出规模是乘积级，大数据量应该用生成器」 |
| myAll | 「空数组必须立即 resolve，这是原答案的 bug」 |

---

## 10.6 速记卡

```
sum
  reduce 必须给初值 0（否则空数组抛错）
  浮点：整数化 / 按最大小数位放大 / Kahan 求和

mergeArray
  readonly T[] 更通用
  要元组精度 → [...A, ...B]（变长元组，TS 4.0）

sleep
  new Promise<void>(resolve => setTimeout(resolve, ms))
  可取消版：AbortSignal + 成功时 removeEventListener
  跨环境定时器类型：ReturnType<typeof setTimeout>

myMap
  ★ 稀疏数组要 i in arr 判断（原生 map 跳过空洞）
  new Array(len) + result[i] = 保长度
  三个参数 + thisArg 才和原生一致

objToArray
  Object.entries 类型只能给 [string, T]
  精确版：{[K in keyof T]: [K, T[K]]}[keyof T][]
  for...of 里判断 k 能自动收窄 v

firstSingleChar
  ★ Map 保持插入顺序 = 原串首次出现顺序
  ★ 用普通对象会因数字键排序而错
  for...of 遍历（emoji 安全），返回 string | null

reverseWord
  ★ split(/\s+/) 遇前后空格会产生空串元素 → 多余空格
  修复：trim() 或手动扫描（只在 cur 非空时 push）

treePath
  ★ 原答案每层 [...path, node] 是 O(depth) 拷贝 → O(n·depth)
  改 push/pop 回溯 → O(n)
  ★ 返回 [...path] 而不是 path（否则返回内部引用）
  children?.length 判断（[] 是 truthy）

product
  ★ 原答案 any[][] 类型全丢
  type ElementsOf<T> = {-readonly [K in keyof T]: T[K] extends readonly (infer U)[] ? U : never}
  边界：product() = [[]]；product([]) = []
  大数据量用生成器（否则 OOM）

myAll
  ★★ 原答案空数组永不 resolve（forEach 不执行 → count 永远 0）
  ★ 用 for 循环不用 forEach（稀疏数组会跳过）
  ★ Promise.resolve 包一层（支持普通值）
  ★ .then(onFulfilled, onRejected) 而不是 .catch（少建一个 Promise）
  ★ results[i] 而不是 push（保证顺序）
  精确类型：<T extends readonly unknown[]>(v: T) => Promise<{[P in keyof T]: Awaited<T[P]>}>
```
