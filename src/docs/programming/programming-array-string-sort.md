# 编程 05｜数组、字符串与排序

> 覆盖题号：12（去重）、13（flat）、17（千分位）、16（URL 解析）、47（括号匹配）、22（快排）、23（冒泡）、24、31、48、49
> 去重后：**7 个考点**

---

## 目录

- [5.0 这一册的内核：边界意识](#50-这一册的内核边界意识)
- [5.1 数组去重](#51-数组去重)
- [5.2 数组扁平化](#52-数组扁平化)
- [5.3 千分位分隔](#53-千分位分隔)
- [5.4 URL 参数解析](#54-url-参数解析)
- [5.5 括号匹配](#55-括号匹配)
- [5.6 快速排序](#56-快速排序)
- [5.7 冒泡排序](#57-冒泡排序)
- [5.8 排序速查（完整版见算法册）](#58-排序速查完整版见算法册)
- [5.9 速记卡](#59-速记卡)
- [5.10 自测](#510-自测)

---

## 5.0 这一册的内核：边界意识

多数题单答案能跑通正常输入，但在边界输入上给出错误结果，而且不抛错：

| 题 | 失效的边界 | 现象 |
|---|---|---|
| 去重 | `NaN` | `indexOf` 版一个 NaN 都不剩 |
| flat | 深层嵌套 | 递归版与 `flat(Infinity)` 都抛 `RangeError` |
| 千分位 | 4 位小数、`1e21` | 小数被分组、科学计数法失效 |
| URL 解析 | 重复 key、`+`、`#` | 只留最后一个值、空格未还原、hash 混进值 |
| 括号匹配 | 含字母 | 直接返回 `false` |

**面试官测手写题只有 30 秒，会直接把边界输入喂进去**，所以重点不是「怎么写」，而是「写完必须测什么」。

---

## 5.1 数组去重

### 一句话结论

> `[...new Set(arr)]` 是标准答案，但它只做「同值零」去重，不解决「对象按内容去重」。

### 五种写法

```js
// ① Set（推荐）
const uniqSet = a => [...new Set(a)];

// ② indexOf
const uniqIndexOf = a => a.filter((v, i) => a.indexOf(v) === i);

// ③ includes
const uniqIncludes = a => {
  const r = [];
  for (const v of a) if (!r.includes(v)) r.push(v);
  return r;
};

// ④ Map（能记录额外信息）
const uniqMap = a => {
  const m = new Map(), r = [];
  for (const v of a) if (!m.has(v)) { m.set(v, v); r.push(v); }
  return r;
};

// ⑤ sort + 相邻比较
const uniqSort = a => a.slice().sort()
  .filter((v, i, arr) => i === 0 || v !== arr[i - 1]);
```

### 实测对比

输入 `[1, '1', NaN, NaN, null, undefined, {x:1}, {x:1}, 0, -0]`，共 10 项：

```
set      → 8 项  ["1","1","NaN","null","undefined","[obj]","[obj]","0"]
indexOf  → 7 项  ["1","1","null","undefined","[obj]","[obj]","0"]        ← NaN 全丢
includes → 8 项  ["1","1","NaN","null","undefined","[obj]","[obj]","0"]
map      → 8 项  ["1","1","NaN","null","undefined","[obj]","[obj]","0"]
sort     → 9 项  ["0","1","1","NaN","NaN","[obj]","[obj]","null","undefined"]
```

### 三个细节

**① `indexOf` 丢 `NaN`**

`indexOf` 用 `===`，`NaN === NaN` 为 `false`，`indexOf(NaN)` 恒为 `-1`，`a.indexOf(v) === i` 永不成立，结果所有 NaN 都被过滤掉。`includes` 与 `Set` 用 `SameValueZero`，认为 NaN 等于自身，因此保留。

**② `0` 与 `-0` 合并**

`Set` 与 `includes` 都用 `SameValueZero`，`0` 和 `-0` 视为同一个值；需要区分时只能用 `Object.is`。

**③ 对象只按引用去重**

两个内容相同的对象是不同引用，`Set` 会都保留。按内容去重必须序列化或深比较，实际更常用唯一字段：

```js
[...new Map(list.map(o => [o.id, o])).values()]
```

`JSON.stringify` 不适合当 key：属性顺序、`undefined`、`Date`、循环引用都会改变结果或直接抛错。

### 追问链

| 追问 | 答法 |
|---|---|
| `Set` 去重的复杂度？ | 插入平均 O(1)，整体 O(n)；常数项里有哈希计算开销 |
| 对象数组怎么去重？ | 按唯一 id 走 `Map`，后出现的覆盖先出现的 |
| 怎么去重同时统计次数？ | `reduce` 成 `Map<值, 次数>` |
| 怎么保持原数组不变？ | `[...new Set(a)]` 不改原数组；`sort` 版要先 `slice()` |
| 大数据量（10 万+）怎么办？ | 用 `Set`；元素是长字符串时可先哈希成短 key，注意碰撞 |

---

## 5.2 数组扁平化

### 一句话结论

> 递归版最好写但受调用栈限制，迭代栈版不会栈溢出，`flat(Infinity)` 最省事、同样受引擎栈限制。

### 原题单答案

```js
arr.flat(Infinity);
// 或递归
function flat(arr) {
  return arr.reduce((acc, cur) =>
    acc.concat(Array.isArray(cur) ? flat(cur) : cur), []);
}
```

**两个实现对普通输入都正确**：实测 `[1,[2,[3,[4,[5]]]]]` 输出 `[1,2,3,4,5]`，稀疏数组 `[1,,3]` 输出 `[1,3]`，与原生一致。缺的是 `depth` 参数和深度保护：递归版靠调用栈，嵌套几千层就抛 `RangeError`。

### 正确实现（四版）

#### 版本 A：递归 + depth

```js
function flatDepth(arr, depth = 1) {
  if (depth < 1) return arr.slice();          // depth=0 返回浅拷贝
  return arr.reduce((acc, cur) =>
    acc.concat(Array.isArray(cur) ? flatDepth(cur, depth - 1) : cur), []);
}
```

实测：

```
flatDepth([1,[2,[3,[4,[5]]]]], 2) → [1,2,3,[4,[5]]]   | 原生 flat(2): 相同
flatDepth([1,[2,[3,[4,[5]]]]], 0) → [1,[2,[3,[4,[5]]]]]
```

#### 版本 B：迭代栈（防栈溢出）

```js
function flatStack(arr) {
  const out = [];
  const stack = [{ list: arr, i: 0 }];        // 存「当前处理到哪个数组的第几个」

  while (stack.length) {
    const frame = stack[stack.length - 1];
    if (frame.i >= frame.list.length) { stack.pop(); continue; }
    const v = frame.list[frame.i++];
    if (Array.isArray(v)) stack.push({ list: v, i: 0 });
    else out.push(v);
  }
  return out;
}
```

**为什么用「帧 + 索引」而不是 `pop` 后再 `push(...children)`？** 后者要先把子数组 `reverse()` 才不逆序，多一个容易写错的步骤；帧 + 索引天然保序。

实测：`[1,[2,[3,[4,[5]]]]] → [1,2,3,4,5]`。

#### 版本 C：原生 `flat`

```js
arr.flat(Infinity);
```

两个坑：

- 规范里 `Infinity` 不会被截断（`ToIntegerOrInfinity` 保留 ∞），但引擎内部仍按递归实现：node 实测原生 `flat(Infinity)` 约 5～6 千层开始抛 `RangeError: Maximum call stack size exceeded`，手写递归 reduce 版约 3 千层就溢出。它不是无限深，只是比手写递归多撑一倍左右的栈深。
- `flat()` 默认只展 **1 层**。

#### 版本 D：`reduce` + 展开（最简洁但不推荐）

```js
const flatOne = arr => arr.reduce((a, b) => a.concat(b), []);
```

只能展一层，且 `concat` 对 `Symbol.isConcatSpreadable` 有特殊行为。

### 追问链

| 追问 | 答法 |
|---|---|
| 递归版什么时候会栈溢出？ | node 实测约 3 千层；原生 `flat` 约 5～6 千层。出现这种深度就改用迭代栈 |
| 怎么处理循环引用（数组里有自己）？ | 用 `WeakSet` 记录已访问的数组，遇到就跳过或抛错 |
| `flat` 会改变原数组吗？ | 不会，返回新数组 |
| `flat` 会保留空位吗？ | **不保留**。`[1,,3].flat()` → `[1,3]` |
| 性能上哪个最好？ | 浅层嵌套三者只差常数项；几千层时必须用迭代栈避免 `RangeError` |
| 怎么展平对象（不是数组）？ | 递归 `Object.entries`，用路径拼接 key |

---

## 5.3 千分位分隔

### 一句话结论

> 正则 `\B(?=(\d{3})+(?!\d))` 是标准答案，但它**必须先把整数部分和小数部分拆开**。

### 原题单答案的问题

```js
function thousand(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
```

实测：

```
thousand(1234567)     → 1,234,567       ✅
thousand(-123456)     → -123,456        ✅（负号碰巧没事）
thousand(1234.5678)   → 1,234.5,678     ❌ 小数位被分组
thousand(0.123456)    → 0.123,456       ❌
thousand(1e21)        → 1e+21           ❌ 科学计数法失效
thousand(null)        → TypeError       ❌ 没有类型校验
```

三个问题：

1. **小数位超过 3 位就出错**：正则对整串执行，不知道小数点在哪，`1234.5678` 会在 `5` 后插逗号。`1234567.891` 恰好正确，是因为小数部分只有 3 位、起点又被 `.` 的单词边界挡住，凑不出完整分组。
2. **科学计数法**：`(1e21).toString()` 是 `'1e+21'`，没有连续数字可分组。
3. **输入没有校验**：`null` / `undefined` 直接抛 `TypeError`；`'1,2345'` 这种不规范字符串会被再插逗号变成 `'1,2,345'`；已经规范的 `'1,234,567'` 反而保持不变。

### 正则原理

```
/\B(?=(\d{3})+(?!\d))/g
  │   │
  │   └─ 前瞻：从当前位置到结尾的连续数字个数是 3 的倍数，且后面不再有数字
  └───── \B：非单词边界，排除字符串开头
```

用 `\B` 而不是 `\b`：`\b` 会在开头匹配，得到 `,123,456`。

`(?!\d)` 的作用是拒绝「剩余位数不是 3 的倍数时硬凑一组」。实测：

```
'12345'.replace(/\B(?=(\d{3})+)/g, ',')      → 1,2,345
'12345'.replace(/\B(?=(\d{3})+(?!\d))/g, ',') → 12,345
```

不带前瞻时，位置 1 会把 `234` 当成一组、位置 2 再把 `345` 当成一组，得到 `1,2,345`；加上 `(?!\d)` 后，位置 1 因为后面还剩 `5` 而失败，只有位置 2 能匹配到末尾的 `345`，得到 `12,345`。

### 正确实现

```js
function thousands(input) {
  let s = String(input);

  // ① 科学计数法 → 展开成完整数字
  if (/e/i.test(s)) {
    const n = Number(s);
    if (!Number.isFinite(n)) return s;
    s = Number.isInteger(n)
      ? BigInt(n).toString()
      : n.toFixed(20).replace(/0+$/, '');
    if (n < 0) s = '-' + s.replace('-', '');
  }

  // ② 剥符号
  const neg = s.startsWith('-');
  if (neg) s = s.slice(1);

  // ③ 拆整数 / 小数
  const [int, dec] = s.split('.');
  if (!/^\d+$/.test(int)) return String(input);      // 非法输入原样返回

  // ④ 只对整数部分加逗号
  const withComma = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return (neg ? '-' : '') + withComma + (dec !== undefined ? '.' + dec : '');
}
```

### 实测（修正版）

```
               1234567 → 1,234,567
               -123456 → -123,456
                     0 → 0
              1234.5678 → 1,234.5678
            1234567.891 → 1,234,567.891
               0.123456 → 0.123456
                   1e21 → 1,000,000,000,000,000,000,000
                  -1e21 → -1,000,000,000,000,000,000,000
       '-1234567.891' → -1,234,567.891
```

### 生产环境该用什么

```js
new Intl.NumberFormat('en-US').format(1234567.891)      // "1,234,567.891"
new Intl.NumberFormat('zh-CN').format(1e21)             // "1,000,000,000,000,000,000,000"
new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })
    .format(1234567.89)                                 // "¥1,234,567.89"
```

手写只为展示正则与边界处理；生产用 `Intl.NumberFormat`，它处理 locale（有些地区 `.` 和 `,` 的角色相反）、货币符号、负数括号表示。构造 formatter 实例开销大，渲染大量行时要缓存复用。

### 追问链

| 追问 | 答法 |
|---|---|
| 不用正则怎么写？ | 循环从右往左每 3 位插一个逗号；负号要先剥掉，否则会被当成一个字符，得到 `-,123,456` |
| 为什么金额不能用 `Number`？ | 精度问题，`0.1 + 0.2 !== 0.3`。金额要用整数分或 decimal 库 |
| `toFixed` 有什么坑？ | `(1.005).toFixed(2) === '1.00'`，因为 1.005 的二进制值略小于 1.005 |
| 怎么处理反向操作（字符串转数字）？ | `Number(str.replace(/,/g, ''))`；欧洲格式用 `.` 作千分位、`,` 作小数点，不能直接替换 |

---

## 5.4 URL 参数解析

### 一句话结论

> `Object.fromEntries(new URLSearchParams(qs))` 一行能解析，但它**丢重复 key**，也**不剥离 `#`**。

### 原题单答案的问题

```js
Object.fromEntries(new URLSearchParams(location.search));
```

实测：

```
输入: ?a=1&a=2&b=%E4%B8%AD%E6%96%87&c=hello+world&d=&e
结果: {"a":"2","b":"中文","c":"hello world","d":"","e":""}
```

| 问题 | 说明 |
|---|---|
| **重复 key 只留最后一个** | `a=1&a=2` → `{a:'2'}`，`1` 丢了。多选框、多标签筛选全靠重复 key |
| `location` 是浏览器专属 | Node / SSR 环境没有 `location` |
| 不解析嵌套 | `filter[name]=x` 会变成一个字面 key |

### 正确实现

```js
function parseQuery(url) {
  const qi = url.indexOf('?');
  let qs = qi === -1 ? '' : url.slice(qi + 1);

  // ① 砍掉 hash（# 之后不是查询参数）
  const hi = qs.indexOf('#');
  if (hi !== -1) qs = qs.slice(0, hi);

  const out = {};

  for (const part of qs.split('&')) {
    if (!part) continue;                         // 跳过空段（?a=1&&b=2）

    const eq = part.indexOf('=');
    const rawK = eq === -1 ? part : part.slice(0, eq);
    const rawV = eq === -1 ? '' : part.slice(eq + 1);

    // ② `+` 在 query 里代表空格（表单编码）
    const key = decodeURIComponent(rawK.replace(/\+/g, ' '));
    const val = decodeURIComponent(rawV.replace(/\+/g, ' '));

    // ③ 重复 key → 数组
    if (Object.prototype.hasOwnProperty.call(out, key)) {
      Array.isArray(out[key]) ? out[key].push(val) : (out[key] = [out[key], val]);
    } else {
      out[key] = val;
    }
  }

  return out;
}
```

### 实测

```
?a=1&a=2&b=%E4%B8%AD%E6%96%87&c=hello+world&d=&e
  → {"a":["1","2"],"b":"中文","c":"hello world","d":"","e":""}

https://x.com/p?x=1#hash   → {"x":"1"}          （hash 被正确剥离）
https://x.com/p#hash       → {}                 （没有 ? 就是空）
?k=%26%3D&k2=a%3Db         → {"k":"&=","k2":"a=b"}   （编码的 = 和 & 正确解码）
?                          → {}
```

### 四个技术点

| 点 | 为什么 |
|---|---|
| `+` → 空格 | 表单编码（`application/x-www-form-urlencoded`）规定 `+` 表示空格，`URLSearchParams` 同样处理 |
| `indexOf('=')` 而不是 `split('=')` | 值里可能有 `=`（比如 base64 的 padding），`split` 会把它切断 |
| `hasOwnProperty.call` 而不是 `key in out` | `in` 会查到原型链：`?constructor=1` 会让逻辑出错，也是原型污染类问题的入口 |
| 先切 `#` 再解析 | 不然 `#hash` 会被当成最后一个参数值的一部分 |

### 追问链

| 追问 | 答法 |
|---|---|
| 为什么不用 `URLSearchParams`？ | 它本身保留重复 key（`getAll` 可以取全），但转普通对象要自己 `forEach` 收集；它也不剥离 `#` |
| 嵌套参数怎么解析？ | 两种约定：`a[b]=1` 方括号式、`a.b=1` 点号式。递归建对象，**要防 `__proto__` 污染** |
| 中文乱码怎么办？ | `decodeURIComponent` 处理 UTF-8。GBK 编码的老系统要用 `TextDecoder('gbk')` |
| `decodeURIComponent` 会抛错吗？ | 会。非法序列（比如孤立的 `%`）抛 `URIError`，生产代码要 `try/catch` |
| 参数怎么序列化回去？ | `new URLSearchParams(obj).toString()`，数组要手动处理 |

---

## 5.5 括号匹配

### 一句话结论

> 栈。遇左括号入栈，遇右括号看栈顶是否匹配。

### 原题单答案的问题：非括号字符

```js
function validBrackets(s) {
  const stack = [];
  const map = { '(': ')', '[': ']', '{': '}' };
  for (const c of s) {
    if (map[c]) stack.push(c);
    else if (map[stack.pop()] !== c) return false;   // ← 这里
  }
  return stack.length === 0;
}
```

实测：

```
"()"                               → true    ✅
"()[]{}"                           → true    ✅
"(]"                               → false   ✅
"(a)"                              → false   ❌ 应为 true
"a"                                → false   ❌ 应为 true
"const f = (a) => { return [a]; }" → false   ❌ 应为 true
```

**根因**：代码假设「不是左括号就是右括号」，遇到字母 `a` 时走进 `else`，把栈顶弹出与 `a` 比较，然后返回 false。只覆盖纯括号字符串的测试全都能过，换成真实代码片段就全错——这道题考的是「遇到不认识的输入怎么办」。

### 正确实现

```js
function validBrackets(s) {
  const stack = [];
  const open = { '(': ')', '[': ']', '{': '}' };
  const close = { ')': '(', ']': '[', '}': '{' };

  for (const c of s) {
    if (open[c]) {
      stack.push(c);                    // 左括号入栈
    } else if (c in close) {            // ← 关键：明确判断「是不是右括号」
      if (stack.pop() !== close[c]) return false;
    }
    // 其他字符（字母/数字/空白/运算符）直接忽略
  }

  return stack.length === 0;
}
```

实测 12 个用例全过：

```
"()"  "()[]{}"  "{[]}"                        → true
"(]"  "([)]"  "("  ")"  "(()"                 → false
"(a)"  "a"  ""  "const f = (a) => { return [a]; }"  → true
```

### 追问链

| 追问 | 答法 |
|---|---|
| 时间复杂度？ | O(n) 时间，O(n) 空间 |
| `([)]` 为什么是错的？ | 括号必须**正确嵌套**，不能交叉。数量相等不构成充分条件，所以计数法过不了这个用例 |
| 只有一种括号能不能不用栈？ | 能，用一个计数器：左 +1、右 -1，中途为负就 false。**推广到三种括号就必须用栈** |
| 扩大输入规模怎么办（1 亿字符）？ | 栈最多只存未闭合的左括号，实际空间远小于 n；但字符串本身要能流式读取 |
| 变体：最长有效括号长度？ | 用 DP 或栈存索引，LeetCode 32 |
| 变体：删除最少括号使其有效？ | 用栈记录要删的索引，或两遍扫描（左到右删多余的 `)`，右到左删多余的 `(`） |

---

## 5.6 快速排序

> 排序的**完整原理**（复杂度分析、稳定性、各类排序对比）在 [算法 · 02 基础排序](/doc/algo-basic-sorts) 和 [算法 · 03 进阶排序](/doc/algo-advanced-sorts) 里已经写过。这里只给**手写面试版 + 口述要点**。

### 一句话结论

> 选一个 pivot，把数组分成「小于 / 等于 / 大于」三段，递归处理两侧。

### 实现（三路划分 + 随机 pivot）

```js
function quickSort(arr) {
  const a = arr.slice();                    // 不改原数组
  const sort = (lo, hi) => {
    if (lo >= hi) return;                   // 0 或 1 个元素

    // 随机 pivot：避免「已排序数组」退化成 O(n²)
    const p = a[lo + Math.floor(Math.random() * (hi - lo + 1))];

    let lt = lo, i = lo, gt = hi;
    while (i <= gt) {
      if (a[i] < p)      { [a[lt], a[i]] = [a[i], a[lt]]; lt++; i++; }
      else if (a[i] > p) { [a[i], a[gt]] = [a[gt], a[i]]; gt--; }
      else               i++;               // 等于 pivot，原地不动
    }
    // 此时 [lo, lt-1] < p，[lt, gt] === p，[gt+1, hi] > p
    sort(lo, lt - 1);
    sort(gt + 1, hi);
  };
  sort(0, a.length - 1);
  return a;
}
```

实测：

```
100 个随机数        → 有序 ✓
[3,1,3,2,1,3]      → [1,1,2,3,3,3]    （重复元素正确）
[5,5,5,5,5]        → [5,5,5,5,5]      （全相同不死循环）
[]                 → []
```

### 为什么用「三路划分」

两路划分每次只把 pivot 放到最终位置，等于 pivot 的元素留到下一轮；数组全相同时每轮只归位一个元素，递归 n 层 → **O(n²)**。三路划分把「等于 pivot」的元素一次性归位，全相同时只递归 0 次 → **O(n)**。

### 面试怎么说

- **接题**：写三路划分版，说明两路在大量重复元素时会退化成 O(n²)；pivot 随机取，避免已排序数组也退化。
- **写的时候**：`lt` 指向小于区的下一个位置，`gt` 指向大于区的前一个位置，`i` 是扫描位置；小于 pivot 就与 `lt` 交换，大于就与 `gt` 交换且不回退 `i`，等于则 `i++`。
- **收尾**：平均 O(n log n)、最坏 O(n²)（每次 pivot 都是最值）、递归栈平均 O(log n)；快排不稳定，要稳定用归并。

### 追问链

| 追问 | 答法 |
|---|---|
| 最坏情况什么时候出现？ | pivot 每次都是最大/最小值。**已排序数组用「取第一个元素」当 pivot 就会这样**。随机化或三数取中能规避 |
| 快排和归并怎么选？ | 快排原地、常数小、缓存友好；归并稳定、最坏也是 O(n log n)、但要额外空间 |
| 为什么 JS 的 sort 不用快排？ | ES2019 起规范**要求 sort 稳定**，快排做不到稳定，V8 因此用 TimSort |
| 递归太深怎么办？ | 先递归较短的一侧、较长的一侧用循环，把栈深控制在 O(log n)；或者显式用栈 |
| 三数取中是什么？ | 取 `a[lo]`、`a[mid]`、`a[hi]` 的中位数当 pivot，比随机少一次随机数开销，效果接近 |

---

## 5.7 冒泡排序

### 一句话结论

> 相邻两两比较，大的往后冒。**关键是加「提前退出」优化。**

### 实现（带提前退出）

```js
function bubbleSort(arr) {
  const a = arr.slice();
  const n = a.length;

  for (let i = 0; i < n - 1; i++) {
    let swapped = false;                      // ← 本轮有没有交换
    for (let j = 0; j < n - 1 - i; j++) {
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        swapped = true;
      }
    }
    if (!swapped) break;                      // ← 没交换说明已经有序
  }
  return a;
}
```

### 实测（提前退出省了多少）

```
已排序 1000 个元素 → 只比较 999 次
  不加提前退出需要 999 + 998 + … + 1 = 499,500 次
  省下 498,501 次（99.8%）

随机 100 个元素 → 比较次数仍接近理论上限 4,950，提前退出基本不生效
```

提前退出把已排序数组从 O(n²) 降到 O(n)，这是这道题的核心优化。

### 三个优化层次

| 层次 | 优化 | 效果 |
|---|---|---|
| 基础版 | `j < n - 1` | O(n²) 恒定 |
| + 右侧收敛 | `j < n - 1 - i` | 少比较一半（已经排好的尾部不再看） |
| + 提前退出 | `swapped` 标志 | **已排序数组降到 O(n)** |
| + 记录最后交换位置 | `lastSwap`，下一轮只扫到这里 | 接近 O(n + 逆序对数) |

### 追问链

| 追问 | 答法 |
|---|---|
| 冒泡是稳定的吗？ | **是**。只有 `a[j] > a[j+1]` 才交换，相等不动 |
| 时间复杂度？ | 平均/最坏 O(n²)，最好 O(n)（加了提前退出） |
| 空间？ | O(1)，原地 |
| 为什么实际不用冒泡？ | 交换次数太多（最坏 O(n²) 次写操作）。插入排序比较次数一样但移动次数少得多，所以小数组用插入 |
| 冒泡、插入、选择怎么选？ | 小数组或基本有序用插入；选择排序在交换次数要求最少时用；冒泡只作教学示例 |
| 为什么面到冒泡？ | 不是要你写冒泡，是看你会不会主动加优化、能不能说出它的缺点 |

---

## 5.8 排序速查（完整版见算法册）

| 算法 | 平均 | 最坏 | 空间 | 稳定 | 何时用 |
|---|---|---|---|---|---|
| 冒泡 | O(n²) | O(n²) | O(1) | ✅ | 教学 / 基本有序的小数组 |
| 插入 | O(n²) | O(n²) | O(1) | ✅ | **小数组、基本有序** |
| 选择 | O(n²) | O(n²) | O(1) | ❌ | 交换次数要求最少时 |
| 快排 | O(n log n) | **O(n²)** | O(log n) | ❌ | 通用、内存受限 |
| 归并 | O(n log n) | O(n log n) | O(n) | ✅ | **要求稳定**、链表排序 |
| 堆排 | O(n log n) | O(n log n) | O(1) | ❌ | 求 Top K、内存受限 |
| TimSort | O(n log n) | O(n log n) | O(n) | ✅ | **JS / Python 内置** |

---

## 5.9 速记卡

```
【去重】[...new Set(a)]；indexOf 丢 NaN、includes/Set 不丢；对象按 id 走 Map
【flat】带 depth 参数；深层用迭代栈（帧+索引）；flat() 默认只展 1 层
【千分位】先剥符号 → 拆整数/小数 → 只给整数加逗号；\B(?=(\d{3})+(?!\d))
【URL】重复 key → 数组；+ → 空格；先切 #；用 hasOwnProperty
【括号】open/close 两张表，非括号字符忽略；([)] → false
【快排】三路划分 + 随机 pivot；不稳定
【冒泡】swapped 提前退出；已排序 1000 个：999 次 vs 499,500 次
```

---

## 5.10 自测

```
□ 能说出 indexOf 去重为什么丢 NaN
□ 能说出 0 和 -0 在 Set 里会被合并
□ 能说出对象数组按 id 去重的写法
□ 能写出带 depth 参数的 flat
□ 能说出 flat() 默认展几层、深层嵌套为什么会 RangeError
□ 能说出稀疏数组在 flat 里的行为
□ 能解释千分位正则里 \B 和 (?!\d) 各自的作用
□ 能说出千分位为什么要先拆整数部分和小数部分
□ 能说出 Intl.NumberFormat 的性能坑
□ 能说出 URL 解析为什么不能用 key in obj
□ 能说出 + 在 query 里代表什么、# 为什么要先切
□ 能说出括号匹配为什么要忽略非括号字符
□ 能说出 ([)] 为什么不能用计数法判断
□ 能写出三路划分的快排，并说出它什么时候退化到 O(n²)
□ 能说出冒泡的提前退出怎么实现、省了多少次比较
```
