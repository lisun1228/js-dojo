# 编程 05｜数组、字符串与排序

> 覆盖题号：12（去重）、13（flat）、17（千分位）、16（URL 解析）、47（括号匹配）、22（快排）、23（冒泡）、24、31、48、49
> 去重后：**7 个考点**

---

## 5.0 这一册的内核：边界意识

这一册的题单答案**每一个都有 bug**，而且全都不是「跑不起来」，是「**能跑，但结果是错的**」：

| 题 | 正常输入 | 边界输入 |
|---|---|---|
| 去重 | ✅ | `NaN` 丢失 |
| flat | ✅ | 稀疏数组 / 超深嵌套 |
| 千分位 | ✅ | **4 位小数**、`1e21` |
| URL 解析 | ✅ | **重复 key**、`+` |
| 括号匹配 | ✅ | **含字母**（最常见！） |

**面试官测手写题只有 30 秒，他会直接把边界输入喂进去。** 所以这一册的价值不在「怎么写」，而在「**写完必须测什么**」。

---

## 5.1 数组去重

### 一句话结论

> `[...new Set(arr)]` 是标准答案，但它**只做「同值零」去重**，不解决「对象按内容去重」。

### 五种写法的完整对比

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

### 实测对比（输入：`[1, '1', NaN, NaN, null, undefined, {x:1}, {x:1}, 0, -0]`，共 10 项）

```
set      → 8 项  ["1","1","NaN","null","undefined","[obj]","[obj]","0"]
indexOf  → 7 项  ["1","1","null","undefined","[obj]","[obj]","0"]        ← NaN 全丢
includes → 8 项  ["1","1","NaN","null","undefined","[obj]","[obj]","0"]
map      → 8 项  ["1","1","NaN","null","undefined","[obj]","[obj]","0"]
sort     → 9 项  ["0","1","1","NaN","NaN","[obj]","[obj]","null","undefined"]
```

### 三个必须说清的细节

#### ① `indexOf` 会丢 `NaN`

因为 `NaN === NaN` 是 `false`，`indexOf(NaN)` 永远返回 `-1`，所以**每个 NaN 都被当成新元素**——但 `filter` 里 `a.indexOf(NaN) === i` 永远不成立，结果**一个 NaN 都不剩**。

`includes` 用的是 `SameValueZero` 算法（认为 `NaN` 等于 `NaN`），所以能保留。**这就是 `includes` 和 `indexOf` 唯一的语义差别。**

#### ② `0` 和 `-0` 会被合并

`Set` 用 `SameValueZero`，`0` 和 `-0` 被认为是同一个值。如果业务上要区分（极少），得用 `Object.is`。

#### ③ 对象永远不去重

两个内容相同的 `{}` 是**不同引用**，`Set` 会都保留。要按内容去重必须序列化（`JSON.stringify`）或手写深比较。

> **面试官问「怎么给对象数组去重」，标准答法是：**
> 「按某个唯一字段用 `Map` 去重：`[...new Map(arr.map(o => [o.id, o])).values()]`。**不要用 `JSON.stringify`**——它受属性顺序、`undefined`、`Date`、循环引用影响。」

### 追问链

| 追问 | 答法 |
|---|---|
| `Set` 去重的复杂度？ | 插入 O(1)、整体 O(n)。**但构造 `Set` 有哈希开销**，小数组（< 10 个）有时 `indexOf` 更快 |
| 为什么 `indexOf` 丢 NaN 而 `includes` 不丢？ | `indexOf` 用 `===`（`NaN !== NaN`）；`includes` 用 `SameValueZero`（`NaN` 等于 `NaN`） |
| 对象数组怎么去重？ | 按唯一 id：`[...new Map(list.map(o => [o.id, o])).values()]`。**这个写法还顺便做到了「后面的覆盖前面的」** |
| 怎么去重同时统计次数？ | `reduce` 成 `Map<值, 次数>`，比 `Set` 更实用 |
| 怎么保持原数组不变？ | `[...new Set(a)]` 本来就不改原数组；`sort` 版要 `slice()` 先复制 |
| 大数据量（10 万+）怎么办？ | `Set` 就够。如果元素是长字符串，可以考虑先哈希 |

---

## 5.2 数组扁平化

### 一句话结论

> 递归版最好写，迭代栈版不会栈溢出，`flat(Infinity)` 最省事但有上限。

### 原题单答案

```js
arr.flat(Infinity);
// 或递归
function flat(arr) {
  return arr.reduce((acc, cur) =>
    acc.concat(Array.isArray(cur) ? flat(cur) : cur), []);
}
```

**两个都对**（实测 `[1,[2,[3,[4,[5]]]]] → [1,2,3,4,5]`，稀疏数组 `[1,,3] → [1,3]` 与原生一致）。但缺三样东西：

1. **不支持 `depth` 参数**（原生 `flat(2)` 只展两层）
2. **递归版在超深数组会栈溢出**
3. 没说 `flat(Infinity)` 的真实限制

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

**为什么需要「帧 + 索引」而不是简单的 `pop` 后 `push(...children)`？**

我第一版就是那么写的：

```js
// 错误写法
const stack = [...arr];
while (stack.length) {
  const v = stack.pop();
  if (Array.isArray(v)) stack.push(...v.reverse());   // ← 顺序会乱
  else out.push(v);
}
```
实际上如果 `reverse()` 忘了或者用错，就会得到 `[2,3,4,5,1]` 这种错乱结果。**用「帧 + 索引」最不容易出错，也不需要 `reverse`。**

实测：`[1,[2,[3,[4,[5]]]]] → [1,2,3,4,5]` ✓

#### 版本 C：原生 `flat`

```js
arr.flat(Infinity);
```

**两个坑**：
- `flat(Infinity)` 不等于「无限深」——规范里 `Infinity` 会被转成 `2^32 - 1`，理论上够用，但**真正的限制是引擎的递归深度**（V8 大约 1 万层左右就会栈溢出）
- `flat()` 默认只展 **1 层**，很多人以为默认全展

#### 版本 D：`reduce` + 展开（最简洁但不推荐）

```js
const flatOne = arr => arr.reduce((a, b) => a.concat(b), []);
```
只能展一层，且 `concat` 对 `Symbol.isConcatSpreadable` 有特殊行为。

### 追问链

| 追问 | 答法 |
|---|---|
| 递归版什么时候会栈溢出？ | 嵌套超过约 1 万层。**这种数据现实中几乎不会出现，但面试官可能故意造一个** |
| 怎么处理循环引用（数组里有自己）？ | 用 `WeakSet` 记录已访问的数组，遇到就跳过或抛错 |
| `flat` 会改变原数组吗？ | 不会，返回新数组 |
| `flat` 会保留空位吗？ | **不保留**。`[1,,3].flat()` → `[1,3]`，空位被直接丢弃 |
| 性能上哪个最好？ | 浅层嵌套递归最快（V8 能优化）；深层用迭代栈。`flat` 是 C++ 实现，通常比手写快 |
| 怎么展平对象（不是数组）？ | 那是另一道题：递归 `Object.entries`，用路径拼接 key |

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

实测三个 bug：

```
thousand(1234567)     → 1,234,567       ✅
thousand(-123456)     → -123,456        ✅（负号碰巧没事）
thousand(1234.5678)   → 1,234.5,678     ❌ 小数位被分组
thousand(0.123456)    → 0.123,456       ❌
thousand(1e21)        → 1e+21           ❌ 科学计数法失效
```

#### bug 1：小数位超过 3 位就出错

正则 `\B(?=(\d{3})+(?!\d))` 是**对整串**做的，它不知道小数点在哪。`1234.5678` 里 `5678` 有 4 位，会在 `5` 后面插一个逗号。

**注意 `1234567.891` 是碰巧对的**——因为 `891` 正好 3 位，凑不成 `(\d{3})+` 的倍数。**这种「有时候对」的 bug 最难发现**。

#### bug 2：科学计数法

`(1e21).toString()` 返回 `'1e+21'`，里面根本没有连续数字，正则无从下手。

#### bug 3：输入是字符串时

`thousand('1234567')` 能跑（`toString` 对字符串返回自身），但如果传入已经是带逗号的字符串就会重复加。

### 正则原理（这一句说出来很加分）

```
/\B(?=(\d{3})+(?!\d))/g
  │   │
  │   └─ 前瞻：从当前位置到结尾，是「3 的倍数个数字」，且后面不再有数字
  └───── \B：不是单词边界（即不在开头，也不在字母数字和非字母数字之间）
```

**为什么用 `\B` 而不是 `\b`？** 如果用 `\b`，会在开头也匹配（`^` 是边界），导致 `,123,456`。

**为什么必须加 `(?!\d)`？** 不加的话，`1234` 会在位置 1（`1|234`）和位置 2（`12|34`）都尝试。位置 2 后面是 `34`，不是 3 的倍数 → `(?!\d)` 保证只有「到结尾刚好 3 的倍数」才匹配。

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

### 实测（全部正确）

```
               1234567 → 1,234,567
               -123456 → -123,456
                     0 → 0
              1234.5678 → 1,234.5678
            1234567.891 → 1,234,567.891
               0.123456 → 0.123456
                 1e+21 → 1,000,000,000,000,000,000,000
                -1e+21 → -1,000,000,000,000,000,000,000
       '-1234567.891' → -1,234,567.891
```

### 生产环境该用什么

```js
new Intl.NumberFormat('en-US').format(1234567.891)      // "1,234,567.891"
new Intl.NumberFormat('zh-CN').format(1e21)             // "1,000,000,000,000,000,000,000"
new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })
    .format(1234567.89)                                 // "¥1,234,567.89"
```

**面试时这样收尾**：

> 「手写是为了展示我理解正则；**实际项目我会用 `Intl.NumberFormat`**——它处理了 locale（有些地区用 `.` 分隔、`,` 表示小数）、货币符号、负数括号表示法。唯一的问题是 `Intl` 在旧 Safari 上性能较差，如果要渲染几万行表格，就得缓存 formatter 实例。」

> 注意最后一句：**`new Intl.NumberFormat()` 的构造开销很大，一定要缓存实例**。这是真实项目里的性能坑。

### 追问链

| 追问 | 答法 |
|---|---|
| 正则里的 `\B` 和 `\b` 区别？ | `\b` 是单词边界（`\w` 和 `\W` 交界处）；`\B` 是非边界。这里要 `\B` 才能排除开头 |
| 不用正则怎么写？ | 循环从右往左，每 3 位插一个逗号。**记得处理负号**（我从右数的时候把负号当成了字符，就出过 `-,123,456` 这个 bug） |
| 为什么金额不能用 `Number`？ | 精度问题。`0.1 + 0.2 !== 0.3`。**金额要用整数分或 `decimal.js`** |
| `toFixed` 有什么坑？ | `(1.005).toFixed(2) === '1.00'`（不是 `1.01`）。因为 `1.005` 在二进制里是 `1.00499999...` |
| 怎么处理「千分位」的反向操作（字符串转数字）？ | `Number(str.replace(/,/g, ''))`。**但要注意 `,` 作为小数点的欧洲格式** |

---

## 5.4 URL 参数解析

### 一句话结论

> `URLSearchParams` 够用，但它**丢重复 key**，而且**不处理 `#`**。

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
| **重复 key 只留最后一个** | `a=1&a=2` → `{a:'2'}`，`1` 丢了。**多选框、多标签筛选全靠重复 key** |
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

原生 fromEntries → {"a":"2"}   ← 对比：重复 key 丢了
```

### 四个技术点

| 点 | 为什么 |
|---|---|
| `+` → 空格 | 表单编码（`application/x-www-form-urlencoded`）规定 `+` 表示空格。`URLSearchParams` 也这么做 |
| `indexOf('=')` 而不是 `split('=')` | 值里可能有 `=`（比如 base64 的 padding），`split` 会把它切断 |
| `hasOwnProperty.call` 而不是 `key in out` | `in` 会查到原型链上的 `toString`、`constructor`——**`?constructor=1` 会让逻辑出错** |
| 先切 `#` 再解析 | 不然 `#hash` 会被当成最后一个参数值的一部分 |

> 第 3 点是安全问题：`?__proto__=x` 或 `?constructor=1` 这类输入，用 `in` 判断会导致**原型污染**的雏形。

### 追问链

| 追问 | 答法 |
|---|---|
| 为什么不用 `URLSearchParams`？ | 它不支持重复 key 展开成数组。可以 `forEach` 手动收集，但还得自己处理 `#` |
| 嵌套参数怎么解析？ | 两种约定：`a[b]=1` 方括号式，或 `a.b=1` 点号式。解析后递归建对象，**但要防 `__proto__` 污染** |
| 中文乱码怎么办？ | `decodeURIComponent` 处理 UTF-8。如果是 GBK 编码的老系统，得用 `TextDecoder('gbk')` 转 |
| `decodeURIComponent` 会抛错吗？ | 会。遇到非法序列（比如孤立的 `%`）抛 `URIError`。**生产代码要 try/catch** |
| 参数怎么序列化回去？ | `new URLSearchParams(obj).toString()`，但数组要手动处理 |

---

## 5.5 括号匹配

### 一句话结论

> 栈。遇左括号入栈，遇右括号看栈顶是否匹配。

### ⚠️ 原题单答案有一个致命 bug

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

**根因**：代码假设「不是左括号就是右括号」，所以遇到字母 `a` 时会走 `else` 分支——**把栈顶弹出来跟 `a` 比较，然后返回 false**。

**这就是最危险的那类 bug**：如果测试用例只有 `"()"`、`"(]"` 这种纯括号字符串，**全都能通过**。一旦输入真实的代码片段（含字母）就全错。

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

**两个改进点**：
1. 分离 `open` 和 `close` 两张表——**用 `c in close` 明确判断类型**
2. `""` 空串返回 `true`（没有不匹配的括号）

### 为什么这道题会被反复出

因为它考的不是括号，是**「遇到不认识的输入怎么办」**：

| 输入 | 处理方式 | 体现的能力 |
|---|---|---|
| 字母 | 忽略 | 知道「题目约束」和「实际输入」的差距 |
| 空串 | 返回 true | 边界意识 |
| `([)]` | 返回 false | 理解「嵌套」不是「计数」 |
| 只有左括号 | 返回 false | 结束时检查栈空 |

> **`([)]` 这个用例最能区分水平**：很多人第一反应是「数一数左右括号数量相等就行」，那就掉坑了。栈能过这个用例，计数不能。

### 追问链

| 追问 | 答法 |
|---|---|
| 时间复杂度？ | O(n) 时间，O(n) 空间 |
| `([)]` 为什么是错的？ | 因为括号必须**正确嵌套**，不能交叉。数量相等不构成充分条件 |
| 只有一种括号能不能不用栈？ | 能，用一个计数器：左 +1、右 -1，中途为负就 false。**但从「一种」推广到「三种」就必须用栈** |
| 扩大输入规模怎么办（1 亿字符）？ | 栈最多只需要存「未闭合的左括号」，实际空间远小于 n。**但字符串本身要能流式读取** |
| 变体：最长有效括号长度？ | 那道题用 DP 或栈存「索引」。**这是括号匹配的进阶版，LeetCode 32** |
| 变体：删除最少括号使其有效？ | 用栈记录要删的索引，或者两遍扫描（左到右删多余的 `)`，右到左删多余的 `(`） |

---

## 5.6 快速排序

> 排序的**完整原理**（复杂度分析、稳定性、各类排序对比）在 [算法 · 02 基础排序](/doc/algo-basic-sorts) 和 [算法 · 03 进阶排序](/doc/algo-advanced-sorts) 里已经写过。这里只给**手写面试版 + 口述脚本**。

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

普通快排（两路）遇到**大量重复元素**会退化：

```js
// 两路划分的写法
const p = a[hi];
let i = lo;
for (let j = lo; j < hi; j++) {
  if (a[j] < p) { swap(a[i], a[j]); i++; }
}
swap(a[i], a[hi]);
```

如果数组是 `[3,3,3,3,3,...,3]`，两路划分每次只能确定**一个**元素的位置（pivot 本身），递归 n 层 → **O(n²)**。

**三路划分把「等于 pivot」的所有元素一次性归位**，全相同时只递归 0 次 → **O(n)**。

> 这个优化说出来，面试官会认为你看过真实实现（Java 的 `Arrays.sort` 对基本类型就是双轴快排 + 三路划分）。

### 面试怎么说

**接题时**：

> 「快排我写三路划分版本，因为普通两路在**大量重复元素**时会退化成 O(n²)。另外用随机 pivot，避免已排序数组也是 O(n²)。」

**写的时候**：

> 「三个指针：`lt` 指向『小于区的下一个位置』，`gt` 指向『大于区的前一个位置』，`i` 是当前扫描位置。遇到小于 pivot 就交换到左边，大于就交换到右边，等于就跳过。」

**写完之后**：

> 「平均 O(n log n)，最坏 O(n²)（每次 pivot 都是最值），空间 O(log n) 递归栈。**快排不稳定**——交换会打乱相同元素的相对顺序。要稳定用归并。」

### 追问链

| 追问 | 答法 |
|---|---|
| 最坏情况什么时候出现？ | pivot 每次都是最大/最小值。**已排序数组用「取第一个元素」当 pivot 就会这样**。随机化或三数取中能规避 |
| 快排和归并怎么选？ | 快排原地、常数小、缓存友好；归并稳定、最坏也是 O(n log n)、但要额外空间。**JS 的 `Array.prototype.sort` 用的是 TimSort（归并+插入），因为要求稳定** |
| 为什么 JS 的 sort 不用快排？ | 因为 ES2019 起规范**要求 sort 稳定**。快排做不到稳定 |
| 递归太深怎么办？ | 尾递归优化（先递归短的一侧，长的一侧用循环），或者显式用栈 |
| 三数取中是什么？ | 取 `a[lo]`、`a[mid]`、`a[hi]` 的中位数当 pivot，比随机更快（少一次随机数生成），效果接近 |

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
  不加优化需要 999 × 1000 / 2 = 499,500 次
  优化后省了 498,501 次（99.8%）

随机 100 个元素 → 比较 4,845 次（接近理论上限 4,950）
```

**这个对比数据是这道题的全部意义**：不加优化的冒泡对**已排序数组**（最常见的真实场景之一）白白跑了 50 万次比较。

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
| 为什么实际不用冒泡？ | 交换次数太多（最坏 O(n²) 次写操作）。**插入排序的比较次数一样但移动次数少得多**，所以小数组用插入 |
| 冒泡、插入、选择怎么选？ | 小数组（< 16）用插入；基本有序用插入；冒泡只在教学里出现 |
| 为什么面到冒泡？ | 不是要你写冒泡，是看你会不会**主动加优化**、能不能说出它的缺点 |

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

> 详细推导（递归树、主定理、各算法的实现细节、性能实测）见 `算法-19题/` 下的 02、03、04 册。

---

## 5.9 速记卡

```
【去重】
[...new Set(a)] 是标准答案
indexOf 丢 NaN（用 ===）；includes/Set 用 SameValueZero 不丢
对象永远不去重（不同引用）
对象数组按 id：[...new Map(list.map(o=>[o.id,o])).values()]

【flat】
递归版 + depth 参数；迭代栈防溢出（用「帧 + 索引」不要 push(...reverse())）
flat() 默认只展 1 层
稀疏数组会被丢弃（与原生一致）

【千分位】★ 三个 bug
原答案：小数超 3 位出错 / 1e21 失效 / 字符串输入
必须：先剥符号 → 拆整数小数 → 只对整数部分加逗号
正则 \B(?=(\d{3})+(?!\d))
生产用 Intl.NumberFormat（要缓存实例！）

【URL】★
fromEntries 丢重复 key
必须处理：+ → 空格 / # 剥离 / indexOf('=') 不用 split
用 hasOwnProperty 不用 in（防 __proto__）

【括号】★ 最危险
原答案遇到字母就返回 false（(a) → false）
必须分离 open / close 两张表，其他字符忽略
([)] 是 false —— 栈能过，计数不能

【快排】三路划分 + 随机 pivot
避免重复元素退化 O(n²)
快排不稳定；JS 的 sort 用 TimSort（稳定）

【冒泡】提前退出
已排序 1000 个：999 次 vs 499,500 次
```

---

## 5.10 自测

```
□ 能说出为什么 indexOf 去重会丢 NaN
□ 能说出 0 和 -0 在 Set 里会被合并
□ 能说出对象数组按 id 去重的写法
□ 能写出带 depth 参数的 flat
□ 能说出 flat() 默认展几层
□ 能说出稀疏数组在 flat 里的行为
□ 能解释千分位正则里 \B 和 (?!\d) 各自的作用
□ 能说出原千分位答案的 3 个 bug
□ 能说出 Intl.NumberFormat 的性能坑
□ 能说出 URL 解析为什么不能用 key in obj
□ 能说出 `+` 在 query 里代表什么
□ 能说出括号匹配原答案在 (a) 上为什么返回 false
□ 能说出 ([)] 为什么不能用计数法判断
□ 能写出三路划分的快排
□ 能说出快排什么时候退化到 O(n²)
□ 能说出冒泡的提前退出怎么实现、省了多少
□ 能说出 JS 的 sort 为什么不用快排
```
