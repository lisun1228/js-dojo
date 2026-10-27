# 算法 · 07 字符串与双指针

> 覆盖：去除出现次数最少的字符、判断回文字符串（含最长回文子串）、双指针三种范式
> 字符边界：UTF-16 码元、Unicode 码点、字素簇

---

## 目录

- [7.1 去除出现次数最少的字符](#71-去除出现次数最少的字符)
- [7.2 判断回文字符串](#72-判断回文字符串)
- [7.3 双指针的三种范式（本册的方法论收尾）](#73-双指针的三种范式本册的方法论收尾)
- [7.4 本册速记卡](#74-本册速记卡)

---

## 7.1 去除出现次数最少的字符

### 7.1 一句话结论

两遍扫描：第一遍统计每个字符出现次数，第二遍过滤掉「次数等于最小值」的字符。时间 O(n)，空间 O(k)（k 是字符集大小）。要求保持原顺序，所以不能排序，只能过滤。

### 7.1.1 原题单的代码

```js
function removeLeastFrequent(str) {
  const map = {};
  for (const c of str) map[c] = (map[c] || 0) + 1;
  const min = Math.min(...Object.values(map));
  return str.split('').filter(c => map[c] !== min).join('');
}
```

两个问题：

| 问题 | 后果 |
|---|---|
| `Math.min(...Object.values(map))` | 空串时 `Object.values` 为 `[]`，`Math.min()` 返回 `Infinity`，过滤条件恒真 → 返回 `''`（结果对，但依赖巧合）；不同字符数很大时展开实参会抛 `RangeError` |
| 统计用 `for...of`、过滤用 `split('')` | 两边遍历粒度不同：前者按码点，后者按 UTF-16 码元 |

### 7.1.2 陷阱：`for...of` vs `split('')`

JS 字符串有三种「字符」粒度：

| 维度 | 单位 | 例：`'😀'` | 遍历方式 |
|---|---|---|---|
| **code unit**（UTF-16 码元） | 16 bit | 2 个（`D83D`、`DE00`） | `split('')`、`str[i]`、`str.length` |
| **code point**（码点） | 一个 Unicode 字符 | 1 个（`U+1F600`） | `for...of`、`[...str]` |
| **grapheme cluster**（字素簇） | 用户看到的一个「字」 | 1 个 | `Intl.Segmenter` |

`'😀'.length === 2`：JS 用 UTF-16 存储，`U+10000` 以上只能用代理对（两个码元）表示。

原题单统计时 Map 的键是 `'😀'`，过滤时 `split('')` 产出的是 `'\uD83D'`、`'\uDE00'`，查不到计数（`undefined`），于是两个代理项都被保留，而计数为 1 的 `'a'` 被删除：

```js
removeLeastFrequent('😀😂a')   // '😀😂'，期望 ''
```

如果统计也改成 `split('')`，计数变成 `D83D=2, DE00=1, DE02=1, a=1`，min 为 1，只保留 `D83D`：

```js
str.split('')                  // ['\uD83D','\uDE00','\uD83D','\uDE02','a']
// 过滤结果 '\uD83D\uD83D'：两个孤立高位代理，渲染为乱码
```

结论：统计和过滤必须使用同一粒度，都 `for...of` 或都 `[...str]`。

### 7.1.3 更深的坑：`for...of` 也不够

`for...of` 只解决代理对，解决不了字素簇：

```js
[...'👨‍👩‍👦'].length   // 5：👨 + ZWJ + 👩 + ZWJ + 👦
```

同类情况：

- `'é'` 可以是 `U+00E9`，也可以是 `e` + `U+0301`（组合重音）
- `'🇨🇳'` 是两个区域指示符（2 个码点）
- `'👍🏽'` 是 emoji + 肤色修饰符（2 个码点）

按用户看到的「字」切分要用 `Intl.Segmenter`：

```js
const seg = new Intl.Segmenter('zh', { granularity: 'grapheme' });
[...seg.segment('👨‍👩‍👦a')].map(s => s.segment);   // ['👨‍👩‍👦', 'a']
```

`granularity` 可选 `'grapheme'`（字素簇）、`'word'`（词）、`'sentence'`（句）。

### 7.1.4 修正版实现

```js
function removeLeastFrequent(str) {
  if (!str) return '';

  // 1. 统计（for...of 按码点）
  const count = new Map();
  for (const ch of str) {
    count.set(ch, (count.get(ch) || 0) + 1);
  }

  // 2. 找最小次数（不用 Math.min(...values)）
  let min = Infinity;
  for (const v of count.values()) {
    if (v < min) min = v;
  }

  // 3. 过滤（同样用 for...of，保持粒度一致）
  const out = [];
  for (const ch of str) {
    if (count.get(ch) !== min) out.push(ch);
  }
  return out.join('');
}
```

| 改进 | 原因 |
|---|---|
| `if (!str) return ''` | 显式处理空串，不依赖 `Math.min()` 返回 `Infinity` |
| 循环求 min | 避免展开实参的调用栈上限（30 万个参数实测抛 `RangeError`） |
| 统计与过滤都用 `for...of` | 粒度一致，代理对不会被拆开 |

实测：与按码点计数的参考实现在 3000 组随机串（含 emoji）上结果一致。

### 7.1.5 逐步推演

```
'aabbbc'：a→2，b→3，c→1 → 最小值 1 → 删除 c → 'aabbb'
'abc'：  a→1，b→1，c→1 → 最小值 1 → 全部删除 → ''
```

所有字符出现次数相同时返回空串，因为所有字符都是「出现最少的」。

### 7.1.6 复杂度

| 项目 | 复杂度 | 说明 |
|---|---|---|
| 时间 | **O(n)** | 两遍扫描，每遍 O(n) |
| 空间 | **O(k)** | k 是不同字符数，最坏 k = n |

不做排序：按次数排序的思路是 O(n log n)，且会打乱原顺序。

### 7.1.7 三个变体

**变体 1：删除所有出现次数为奇数的字符**

```js
function removeOddFrequency(str) {
  const count = new Map();
  for (const ch of str) count.set(ch, (count.get(ch) || 0) + 1);
  const out = [];
  for (const ch of str) if (count.get(ch) % 2 === 0) out.push(ch);
  return out.join('');
}
```

**变体 2：只保留出现次数最多的 K 种字符（保持原顺序）**

```js
function keepTopK(str, k) {
  const count = new Map();
  for (const ch of str) count.set(ch, (count.get(ch) || 0) + 1);

  const keep = new Set(
    [...count.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, k)
      .map(([ch]) => ch)
  );

  const out = [];
  for (const ch of str) if (keep.has(ch)) out.push(ch);
  return out.join('');
}
```

排序是 O(k log k)，k 为字符种类数，总计 O(n + k log k)。

**变体 3：不改变顺序，删除出现次数 ≤ 阈值的字符**

把 `!== min` 改成 `> threshold`。

### 7.1.8 口述要点

- 计数 + 过滤两遍扫描，O(n) 时间、O(k) 空间；保持原顺序，不排序。
- 统计与过滤必须同粒度：`for...of` 按码点，`split('')` 按码元；混用会让代理项查不到计数。
- `for...of` 处理不了 ZWJ 组合与组合重音，字素簇要用 `Intl.Segmenter`。
- 边界：空串返回 `''`；所有字符次数相同也返回 `''`。

---

## 7.2 判断回文字符串

### 7.2 一句话结论

双指针从两端向中间夹，遇到不相等的就返回 false。预处理（统一大小写、去掉非字母数字）取决于题意。时间 O(n)，空间 O(n)（预处理成数组）或 O(1)（ASCII 跳过版）。

### 7.2.1 原题单的代码有两个问题

```js
function isPalindrome(s) {
  s = s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  let l = 0, r = s.length - 1;
  while (l < r) {
    if (s[l] !== s[r]) return false;
    l++; r--;
  }
  return true;
}
```

| 问题 | 后果 |
|---|---|
| ① `[^a-zA-Z0-9]` 只保留 ASCII | 中文、日文、带重音的字母全被删掉；删空后空串被判为回文，产生假阳性 |
| ② `s[l]` 按码元访问 | 若把过滤换成 Unicode 正则而比较仍用下标，代理对会被拆开 |

```js
'我爱我家'.replace(/[^a-zA-Z0-9]/g, '')   // ''
// 空串被判为回文 → true；但 '我爱我家' 反转是 '家我爱我'，应为 false
```

### 7.2.2 正确实现（Unicode 感知）

```js
function isPalindrome(s) {
  // 1. 预处理：只保留字母和数字，统一小写
  const chars = [];
  for (const ch of s) {
    if (/[\p{L}\p{N}]/u.test(ch)) {
      chars.push(ch.toLowerCase());
    }
  }

  // 2. 双指针
  let l = 0, r = chars.length - 1;
  while (l < r) {
    if (chars[l] !== chars[r]) return false;
    l++;
    r--;
  }
  return true;
}
```

| 写法 | 含义 |
|---|---|
| `\p{L}` | Unicode 的 Letter 类（含中文） |
| `\p{N}` | Unicode 的 Number 类（含全角数字） |
| `u` 标志 | 必须加，否则 `\p{...}` 被当成字面量 |
| `for...of` | 按码点遍历，不会拆代理对 |

```js
isPalindrome('A man, a plan, a canal: Panama')  // true
isPalindrome('race a car')                      // false
isPalindrome('上海自来水来自海上')                 // true
isPalindrome('我爱我家')                          // false
isPalindrome('')                                // true
isPalindrome('a')                               // true
isPalindrome('ab')                              // false
```

### 7.2.3 空间 O(1) 的版本（ASCII 场景）

题目限定 ASCII 时，可以不做预处理，在双指针移动时跳过非字母数字：

```js
function isPalindromeAscii(s) {
  const isAlnum = (c) =>
    (c >= 48 && c <= 57) ||   // 0-9
    (c >= 65 && c <= 90) ||   // A-Z
    (c >= 97 && c <= 122);    // a-z

  let l = 0, r = s.length - 1;
  while (l < r) {
    while (l < r && !isAlnum(s.charCodeAt(l))) l++;
    while (l < r && !isAlnum(s.charCodeAt(r))) r--;
    if (l < r && s[l].toLowerCase() !== s[r].toLowerCase()) return false;
    l++;
    r--;
  }
  return true;
}
```

三个细节：

1. 内层 while 也要判断 `l < r`，否则全标点串会越界
2. 比较前要判 `l < r`，跳过后可能已经 `l >= r`
3. `charCodeAt` 直接读码元，不逐字符跑正则

Unicode 版要做到 O(1)，反向跳字符时必须判断低位代理（`0xDC00 ~ 0xDFFF`）并一次回退两个码元；通常直接用 O(n) 的数组版换可读性。

### 7.2.4 中心扩展法（求最长回文子串）

回文一定有一个中心，从中心向两边扩。中心分两种：奇数长度是单个字符（`aba`），偶数长度是两个字符之间的缝（`abba`）。对每个位置 i 试 `(i, i)` 和 `(i, i+1)`。

```js
function longestPalindrome(s) {
  const a = [...s];
  if (a.length < 2) return s;

  let start = 0, maxLen = 1;

  function expand(l, r) {
    while (l >= 0 && r < a.length && a[l] === a[r]) {
      l--;
      r++;
    }
    return [l + 1, r - 1];      // 越界或多走一步，要退回来
  }

  for (let i = 0; i < a.length; i++) {
    for (const [l, r] of [expand(i, i), expand(i, i + 1)]) {
      if (r - l + 1 > maxLen) {
        maxLen = r - l + 1;
        start = l;
      }
    }
  }
  return a.slice(start, start + maxLen).join('');
}
```

时间 O(n²)（n 个中心 × 每个扩 O(n)），空间 O(n)（码点数组）。

返回 `[l+1, r-1]` 是因为循环退出时 `s[l] !== s[r]` 或越界，`[l, r]` 已经不是回文。手动验证 `'aba'`：

```
expand(1,1)：'b'='b' → (0,2) 'a'='a' → (-1,3) 越界
返回 [0,2]，长度 3
```

实测：含 emoji 的随机串 3000 组，与暴力解的最长回文长度一致。

### 7.2.5 Manacher 算法

中心扩展是 O(n²)。Manacher 用「回文半径复用」降到 O(n)，两步：

**① 插入分隔符，统一奇偶**

```
原串:   a b a
处理后: # a # b # a #     （长度 2n+1，一定是奇数）
```

**② 复用最右回文的对称半径**

维护当前「最右回文的中心和右边界」`(center, right)`。对位置 i：

- `i < right` 时，对称点 `2*center - i` 的半径可以复用
- 复用值不能超过 `right - i`，超出部分未知，需要暴力扩

```js
function manacher(s) {
  const a = [...s];
  const t = [];
  for (const ch of a) {
    t.push('#');
    t.push(ch);
  }
  t.push('#');

  const n = t.length;
  const p = new Array(n).fill(0);   // p[i] = 以 i 为中心的回文半径
  let center = 0, right = 0;
  let maxLen = 0, maxCenter = 0;

  for (let i = 0; i < n; i++) {
    if (i < right) p[i] = Math.min(right - i, p[2 * center - i]);

    while (i - p[i] - 1 >= 0 && i + p[i] + 1 < n && t[i - p[i] - 1] === t[i + p[i] + 1]) {
      p[i]++;
    }

    if (i + p[i] > right) {
      center = i;
      right = i + p[i];
    }

    if (p[i] > maxLen) { maxLen = p[i]; maxCenter = i; }
  }

  const start = (maxCenter - maxLen) / 2;
  return a.slice(start, start + maxLen).join('');
}
```

每次成功扩展都会让 `right` 增加 1，`right` 最多到 `2n`，总扩展次数 ≤ 2n，所以均摊 O(n)。时间 O(n)，空间 O(n)。

用 token 数组而不是 `'#' + [...s].join('#') + '#'`，是因为 emoji 在字符串里占两个码元，拼成字符串后下标与码点不再对应。实测含 emoji 的随机串 3000 组，与暴力解一致。

### 7.2.6 三个变体

**变体 1：最多删除一个字符，能否变成回文（LeetCode 680）**

首次不相等时试两种删法：

```js
function validPalindrome(s) {
  const a = [...s];

  function check(l, r) {
    while (l < r) {
      if (a[l] !== a[r]) return false;
      l++; r--;
    }
    return true;
  }

  let l = 0, r = a.length - 1;
  while (l < r) {
    if (a[l] !== a[r]) {
      return check(l + 1, r) || check(l, r - 1);   // 删左 或 删右
    }
    l++; r--;
  }
  return true;
}
```

第一次不相等时必须删掉其中一个字符，没有第三种选择。

**变体 2：回文数（LeetCode 9）**

反转一半数字，避免溢出：

```js
function isPalindromeNumber(x) {
  if (x < 0 || (x % 10 === 0 && x !== 0)) return false;
  let rev = 0;
  while (x > rev) {
    rev = rev * 10 + (x % 10);
    x = Math.floor(x / 10);
  }
  return x === rev || x === Math.floor(rev / 10);   // 偶数位 或 奇数位
}
```

`x === rev` 对应偶数位（1221），`x === Math.floor(rev / 10)` 对应奇数位（12321，中间位被多反转一次）。

**变体 3：回文链表**

见 05 册 5.9.6（找中点 + 反转后半 + 比较）。

### 7.2.7 常见坑

| 坑 | 后果 | 修正 |
|---|---|---|
| `[^a-zA-Z0-9]` | 中文/重音字母被删光，非回文被判成回文 | `[\p{L}\p{N}]` + `u` 标志 |
| 忘加 `u` 标志 | `\p{L}` 不生效，被当成字面量 | `/[\p{L}\p{N}]/u` |
| `s[l]` 按码元访问 | emoji 被拆成两个代理项比较 | 先 `[...s]` 再比较 |
| 空串返回 `false` | 空串是回文 | 初始 `return true` |
| 单字符串返回 `false` | 同上 | `while (l < r)` 天然处理 |
| 内层 while 不判 `l < r` | 全标点串越界 | `while (l < r && ...)` |
| 中心扩展返回 `[l, r]` | 长度多算 2 | 返回 `[l+1, r-1]` |

空串正着读反着读都是空串，是回文；`' '` 预处理后为空串，同样返回 true。

### 7.2.8 口述要点

- 双指针向中间夹，O(n)；预处理成数组是 O(n) 空间，ASCII 跳过版是 O(1)。
- 过滤不能用 `[^a-zA-Z0-9]`，会把中文删空导致假阳性；用 `\p{L}\p{N}` 且必须加 `u`。
- 下标比较只适用于 BMP，emoji 要先 `[...s]` 转成码点数组。
- 求最长回文用中心扩展：两种中心，返回 `[l+1, r-1]`；O(n) 版本是 Manacher。

---

## 7.3 双指针的三种范式（本册的方法论收尾）

### 7.3.1 对撞指针（左右向中间）

```
l →                    ← r
[ ][ ][ ][ ][ ][ ][ ][ ]
```

一个从左往右，一个从右往左，直到相遇。

| 题目 | 移动规则 |
|---|---|
| **回文判断** | `s[l] !== s[r]` → false；否则同时内移 |
| **两数之和（有序数组）** | 和太小 → `l++`；和太大 → `r--` |
| **盛最多水的容器** | 移动**较短**的一侧（高度受短板限制） |
| **三数之和** | 固定一个数 + 内层对撞；注意去重 |
| **反转字符串/数组** | 交换 `l`、`r` 后同时内移 |

单次对撞 O(n)：两个指针合计移动不超过 2n。三数之和外层再枚举一个数，总复杂度 O(n²)。

### 7.3.2 快慢指针（同向不同速）

```
s →  →  →  →  →
f → → → → → → → →   （速度 2 倍，或先走 N 步）
```

同方向，速度不同（或初始偏移不同）。

| 题目 | 用法 |
|---|---|
| **链表判环** | `slow` 走 1、`fast` 走 2，相遇则有环 |
| **找环入口** | 相遇后一个指针回 head，同速走 |
| **找中点** | `fast` 到末尾时 `slow` 在中点 |
| **倒数第 N 个** | `fast` 先走 N 步 |
| **数组原地去重** | `slow` 是「已去重的末尾」，`fast` 扫描 |
| **移除元素** | `slow` 是「保留区的末尾」 |

`slow` 是写入位置，`fast` 是读取位置，这是原地修改数组的通用写法：

```js
// 原地删除所有值为 val 的元素
function removeElement(nums, val) {
  let slow = 0;
  for (let fast = 0; fast < nums.length; fast++) {
    if (nums[fast] !== val) {
      nums[slow++] = nums[fast];
    }
  }
  return slow;          // 新长度
}
```

### 7.3.3 滑动窗口（同向，维护区间）

```
    l →        → r
[ ][ ][ ][ ][ ][ ][ ]
    └── 窗口 ──┘
```

`r` 扩张窗口，`l` 收缩窗口。**正确性前提是合法性对区间伸缩单调**：最大窗口问题里扩张只会让条件变差、收缩才能恢复；最小窗口问题里扩张只会让条件变好、收缩会破坏。因此每个下标最多被加入、移出各一次，总移动 O(n)。合法性对区间伸缩不单调时，这套指针可能跳过最优解，不能直接用。

```js
let l = 0, ans = 0;
const state = new Map();

for (let r = 0; r < n; r++) {
  add(state, s[r]);                  // 1. 扩张
  while (!valid(state)) {            // 2. 收缩到重新合法
    remove(state, s[l]);
    l++;
  }
  ans = Math.max(ans, r - l + 1);    // 3. 最大窗口：此时合法
}
```

- 求**最长**窗口：收缩后窗口合法，在此处更新 `max`。
- 求**最短**窗口（最小覆盖子串、和 ≥ target）：在 `valid` 为真时收缩，并在收缩过程中用 `min` 记录候选；收缩结束后窗口已不合法。
- 条件用「不同字符数」时，计数减到 0 必须 `delete` 键，否则 `size` 不下降，收缩循环不终止。

| 题目 | 条件与更新位置 |
|---|---|
| **最长无重复子串** | 当前字符计数 > 1 时收缩；收缩后取 max |
| **最小覆盖子串** | 覆盖全部目标字符时收缩；收缩过程中取 min |
| **长度最小的子数组（和 ≥ target）** | 窗口和 ≥ target 时收缩；收缩过程中取 min |
| **至多 K 个不同字符的最长子串** | 不同字符数 > K 时收缩，计数归零要删键；收缩后取 max |

实测：最长无重复的写法与暴力解 3000 组一致；最小覆盖的正确实现在 3000 组上一致；照抄「收缩后取 max」的写法 2805/3000 组不符；不删 0 计数键的至多 K 写法 377/1000 组不符，且窗口越界后循环不终止。

### 7.3.4 三者的选择

```
需要比较两端？
  └─ 是 → 对撞指针（回文、两数和、盛水）
需要原地修改数组？
  └─ 是 → 读写双指针（slow 写、fast 读）
需要「连续子数组/子串」满足某条件？
  └─ 是 → 滑动窗口
需要在链表上找位置/判环？
  └─ 是 → 快慢指针
```

三种范式的共同前提是「指针移动不会跳过可能的最优解」：对撞依赖两端比较后可以排除一侧，快慢依赖速度差带来的固定距离关系，滑动窗口依赖合法性对区间伸缩单调。

---

## 7.4 本册速记卡

```
去除最少字符
  两遍扫描：Map 计数 → 循环求 min → 过滤 ≠ min
  O(n) 时间，O(k) 空间
  边界：空串 / 全部同次数 → ''
  统计与过滤同粒度：都 for...of，不能混 split('')

三种字符粒度
  code unit（split('')、length、str[i]）→ '😀' 算 2
  code point（for...of、[...str]）→ '👨‍👩‍👦' 算 5（含 2 个 ZWJ）
  grapheme（Intl.Segmenter）→ 用户看到的「字」
  例：'👨‍👩‍👧‍👦'.length = 11，[...s].length = 7，Segmenter = 1

回文判断
  双指针向中夹；预处理用 \p{L}\p{N} + u
  空串是回文
  ASCII O(1)：charCodeAt 跳过非字母数字，内层 while 也判 l < r
  中心扩展：两种中心 (i,i)、(i,i+1)，返回 [l+1, r-1]
  Manacher：插 # 统一奇偶 + 复用最右回文半径 → O(n)
  按下标访问前先 [...s]，否则代理对被拆开

双指针三范式
  对撞：回文、两数和（有序）、盛水（移动短板）；单次 O(n)
  快慢：判环、中点、倒数第 N、原地去重（slow 写 fast 读）
  滑窗：最长无重复、最小覆盖、和 ≥ target；条件是单调的
```
