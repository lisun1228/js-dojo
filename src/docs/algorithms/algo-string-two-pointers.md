# 算法 · 07 字符串与双指针

> 本册覆盖：去除出现次数最少的字符（原题 3）、判断回文字符串（原题 19）
> 这两题的代码都只有十几行，**真正的考点是「边界」**——空串、全相同字符、Unicode、emoji、中文。
> 原题单的两份答案在 Unicode 上都有问题，本册会逐一说清。

---

## 7.1 去除出现次数最少的字符（原题 3）

### 一句话结论

**两遍扫描**：第一遍统计每个字符出现次数，第二遍过滤掉「次数等于最小值」的字符。时间 O(n)，空间 O(k)（k 是字符集大小）。**要求「不改变原字符串顺序」，所以不能用排序，只能过滤。**

### 7.1.1 原题单的代码

```js
function removeLeastFrequent(str) {
  const map = {};
  for (const c of str) map[c] = (map[c] || 0) + 1;
  const min = Math.min(...Object.values(map));
  return str.split('').filter(c => map[c] !== min).join('');
}
```

**逻辑是对的，但有三个隐患**：

| 隐患 | 后果 |
|---|---|
| `Math.min(...Object.values(map))` | 空字符串时 `Object.values` 是 `[]`，`Math.min()` 返回 `Infinity`，过滤条件 `map[c] !== Infinity` 恒真 → 返回 `''`（碰巧对）；但字符集很大时 spread 有参数上限风险 |
| **`for...of` 和 `split('')` 遍历粒度不一致** | `for...of` 按 **code point**（emoji 算 1 个），`split('')` 按 **UTF-16 code unit**（emoji 拆成 2 个）→ **统计和过滤的单位不同，emoji 场景直接产出乱码** |
| 用了普通对象 `{}` 当字典 | `__proto__`、`constructor` 等键会读到原型上的值（虽然这里只是计数，风险低但习惯不好） |

**第二点是最致命的**，下面单独讲。

### 7.1.2 陷阱：`for...of` vs `split('')`

**先把 JS 的三种「字符」维度说清**：

| 维度 | 单位 | 例：`'😀'` | 遍历方式 |
|---|---|---|---|
| **code unit**（UTF-16 码元） | 16 bit | 2 个（`D83D`、`DE00`） | `split('')`、`str[i]`、`str.length` |
| **code point**（码点） | 一个 Unicode 字符 | 1 个（`U+1F600`） | `for...of`、`[...str]` |
| **grapheme cluster**（字素簇） | 用户看到的一个「字」 | 1 个 | `Intl.Segmenter` |

**`'😀'.length === 2`** —— 这就是 JS 字符串的「原罪」：它用 UTF-16 存，早期 Unicode 只到 U+FFFF，所以一个字符 = 一个 code unit。后来扩展到 U+10FFFF，超出部分只能用**代理对**（surrogate pair，两个 code unit）表示。

**具体会怎么错？**

输入 `'😀😂a'`（两个 emoji 各出现 1 次，`a` 出现 1 次，所以最小值是 1，应该全部删除 → 返回 `''`）：

```js
const str = '😀😂a';
// 内部: [D83D, DE00, D83D, DE02, 'a']

// for...of（按 code point）
for (const c of str) { /* '😀', '😂', 'a' —— 三个字符各 1 次 */ }

// split('')（按 code unit）
str.split('');   // [D83D, DE00, D83D, DE02, 'a']
// 统计结果: D83D=2, DE00=1, DE02=1, a=1
// min = 1 → 只保留 D83D → 结果 '\uD83D\uD83D'
```

**`'\uD83D\uD83D'` 是两个孤立的高位代理，渲染出来是 `��`** —— 一段彻底的乱码。

而 `for...of` 版本会正确返回 `''`。

**根本原因**：`for...of` 统计时把 `😀` 当成一个整体（count=1），但 `split('')` 过滤时按半个字符过滤，两套计数对不上。

> **结论：如果一个地方用 `for...of`，另一个地方也必须用 `for...of` 或 `[...str]`，绝不能混用 `split('')`。**

### 7.1.3 更深的坑：`for...of` 也不够

`for...of` 只解决「代理对」，**解决不了「组合字符」**。

```js
const family = '👨‍👩‍👦';          // 一家三口
[...family].length;               // 5  ← 不是 1！

// 实际是: 👨 + ZWJ + 👩 + ZWJ + 👦
// ZWJ = U+200D (Zero Width Joiner)，用来把多个 emoji 拼成一个
```

**同样的问题**：
- `'é'` 可以是 `U+00E9`（1 个码点）或 `'e' + U+0301`（2 个码点，组合重音）
- `'🇨🇳'` 是两个「区域指示符」拼的（2 个码点）
- `'👍🏽'` 是 emoji + 肤色修饰符（2 个码点）

**真正正确的做法：`Intl.Segmenter`**

```js
const seg = new Intl.Segmenter('zh', { granularity: 'grapheme' });
const chars = [...seg.segment('👨‍👩‍👦a')].map(s => s.segment);
// ['👨‍👩‍👦', 'a']  ← 正确
```

**`granularity` 三个可选值**：

| 值 | 切分单位 | 用途 |
|---|---|---|
| `'grapheme'` | 字素簇（用户看到的「字」） | 字符计数、反转字符串 |
| `'word'` | 词 | 分词、字数统计 |
| `'sentence'` | 句 | 断句 |

> **面试话术**：「如果只是普通 ASCII 场景，`for...of` 就够了。但它只处理代理对，处理不了 ZWJ 组合 emoji 和组合重音，那是字素簇层面的问题，要用 `Intl.Segmenter` 按 `grapheme` 切分。这个问题在『统计字数』『反转字符串』『截断显示』里都会遇到。」

### 7.1.4 修正版实现

```js
function removeLeastFrequent(str) {
  if (!str) return '';                       // 空串直接返回（★ 原题单漏了）

  // 1. 统计（for...of 按 code point）
  const count = new Map();
  for (const ch of str) {
    count.set(ch, (count.get(ch) || 0) + 1);
  }

  // 2. 找最小次数（不用 Math.min(...values)，避免大字符集展开）
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

**四个改进**：

| 改进 | 原因 |
|---|---|
| `if (!str) return ''` | 显式处理空串（虽然 `Infinity` 那版碰巧也对，但不该依赖巧合） |
| `Map` 代替 `{}` | 避免原型链污染，且 `Map` 的 `get/set` 在小数据量下不比对象慢 |
| 循环求 min | 避免 `Math.min(...arr)` 在大字符集上的参数上限 |
| `for...of` 统计 + `for...of` 过滤 | **粒度一致**，emoji 安全 |

### 7.1.5 逐步推演

`'aabbbc'`：

```
统计:  a→2, b→3, c→1
最小:  1（字符 c）
过滤:  a(2≠1) 保留，a 保留，b(3≠1) 保留，b 保留，b 保留，c(1=1) 删除
结果:  'aabbb'
```

`'abc'`（全部只出现 1 次）：

```
统计:  a→1, b→1, c→1
最小:  1
过滤:  全部删除
结果:  ''      ← 注意：这是题意的正确结果，不是 bug
```

**这个边界很容易被面试官追问**：「如果所有字符出现次数相同怎么办？」答案是**返回空串**（因为所有字符都是「出现最少的」）。如果要「至少保留一个」，需要额外约定——**面试时主动问清这个歧义是加分项**。

### 7.1.6 复杂度

| 项目 | 复杂度 | 说明 |
|---|---|---|
| 时间 | **O(n)** | 两遍扫描，每遍 O(n) |
| 空间 | **O(k)** | k 是不同字符数，最坏 k = n |

**为什么不是 O(n log n)？** 因为用了哈希表（Map）做 O(1) 计数，且没有排序。如果用「按次数排序后取前几个」的思路就是 O(n log n) 了，**没必要**。

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

  // 按次数降序取前 k 个字符
  const keep = new Set(
    [...count.entries()]
      .sort((a, b) => b[1] - a[1])     // O(k log k)，k 是字符种类数
      .slice(0, k)
      .map(([ch]) => ch)
  );

  const out = [];
  for (const ch of str) if (keep.has(ch)) out.push(ch);
  return out.join('');
}
```

**这里必须排序了**，所以是 O(n + k log k)。**k 通常很小（字符集大小），所以实际接近 O(n)**。

**变体 3：不改变顺序，删除出现次数 ≤ 阈值的字符**

就是把 `!== min` 改成 `> threshold`，一行改动。

### 7.1.8 答题模板

**30 秒版**

> 两遍扫描：第一遍用 Map 统计每个字符的出现次数，第二遍过滤掉次数等于最小值的字符。时间 O(n)，空间 O(k)，k 是不同字符数。
> 有个细节要注意：统计和过滤必须用同样的遍历粒度。`for...of` 按 code point，`split('')` 按 UTF-16 code unit，混用会让 emoji 被拆成两半，输出乱码。
> 边界上，空串返回空串；所有字符出现次数相同时，结果是空串（因为所有字符都是「最少的」）。

**2 分钟版（加分层）**

> 这题本质是「计数 + 过滤」，要求保持原顺序，所以不能排序，只能线性扫描。
> 第一步统计用 Map，比普通对象好——不会被 `__proto__` 这类键干扰。第二步求最小值我用循环而不是 `Math.min(...values)`，因为后者在字符集很大时有参数上限风险。第三步过滤，收集到数组再 join，比字符串 `+=` 更稳。
> 最值得讲的是 Unicode。JS 的字符串是 UTF-16，`'😀'.length` 是 2，所以 `split('')` 会把 emoji 拆成两个代理项。如果统计用 `for...of`（按码点）、过滤用 `split('')`（按码元），两套计数对不上，会产出孤立代理这种乱码。比如输入 `'😀😂a'`，正确结果是空串，`split('')` 版会返回两个 `\uD83D`。
> 再深一层，`for...of` 只解决代理对，解决不了 ZWJ 组合 emoji——`'👨‍👩‍👦'` 用 `[...str].length` 是 5 不是 1。要按「用户看到的字」切分，得用 `Intl.Segmenter` 的 `granularity: 'grapheme'`。这个问题在「统计字数」「反转字符串」「截断显示」里都会遇到。

### 7.1.9 追问表

| 追问 | 回答要点 |
|---|---|
| 复杂度？ | O(n) 时间、O(k) 空间，k 是不同字符数 |
| 为什么不能排序？ | 要求保持原顺序；排序会打乱，且 O(n log n) 更慢 |
| 所有字符次数相同怎么办？ | 全部删除，返回空串（都是「最少的」） |
| `for...of` 和 `split('')` 区别？ | 前者按码点（emoji 算 1），后者按 UTF-16 码元（emoji 算 2） |
| 混用会怎样？ | 统计和过滤粒度不一致，emoji 输出乱码 |
| `for...of` 够吗？ | 不够，处理不了 ZWJ 组合 emoji（`'👨‍👩‍👦'` 是 5 个码点） |
| 怎么正确按「字」切分？ | `Intl.Segmenter` + `granularity: 'grapheme'` |
| 为什么用 Map 不用 `{}`？ | 避免原型链键污染；`Map` 的键可以是任意类型 |
| `Math.min(...values)` 有什么问题？ | 大字符集时展开参数过多，可能栈溢出 |

---

## 7.2 判断回文字符串（原题 19）

### 一句话结论

**双指针从两端向中间夹**，遇到不相等的就返回 false。预处理（统一大小写、去掉非字母数字）是可选的，取决于题意。时间 O(n)，空间 O(1)（不预处理版）或 O(n)（预处理版）。

### 7.2.1 原题单的代码有三个问题

```js
function isPalindrome(s) {
  s = s.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();   // ⚠️ 问题 1
  let l = 0, r = s.length - 1;
  while (l < r) {
    if (s[l] !== s[r]) return false;
    l++; r--;
  }
  return true;
}
```

| 问题 | 后果 | 例子 |
|---|---|---|
| ① **`[^a-zA-Z0-9]` 只保留 ASCII** | 中文、日文、带重音的字母（`é`）、希腊字母等**全被删掉** | `'我爱我家'` → 全删 → `''` → 返回 `true`（**错！它不是回文**） |
| ② **`s[l]` 按码元访问** | 如果正则改成 Unicode 后仍用 `s[l]`，代理对会被拆开比较 | 见 7.2.4 |
| ③ **`toLowerCase` 可能改变长度** | `'İ'.toLowerCase()` 是 2 个码点（`i` + 组合点）；`'ß'.toUpperCase()` 是 `'SS'` | 极少见，但严格说是隐患 |

**问题 ① 是最典型的「假阳性」bug**：把所有非 ASCII 内容删光后，空串和单字符串都返回 `true`。

**验证一下**：

```js
'我爱我家'.replace(/[^a-zA-Z0-9]/g, '')   // ''
'' 是回文 → 返回 true
// 但 '我爱我家' 反转是 '家我爱我'，不是回文 → 答案应该是 false
```

### 7.2.2 正确实现（Unicode 感知）

**用 `\p{L}`（字母）和 `\p{N}`（数字）**，配 `u` 标志：

```js
function isPalindrome(s) {
  // 1. 预处理：只保留「字母和数字」，统一小写
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

**关键点**：

| 写法 | 含义 |
|---|---|
| `\p{L}` | Unicode 的 Letter 类（所有语言的字母，含中文） |
| `\p{N}` | Unicode 的 Number 类（含阿拉伯-印度数字、全角数字） |
| `u` 标志 | **必须加**，否则 `\p{...}` 不生效，`u` 还让正则该按码点处理 |
| `for...of` | 按码点遍历，不会拆代理对 |

**测试**：

```js
isPalindrome('A man, a plan, a canal: Panama')  // true
isPalindrome('race a car')                      // false
isPalindrome('上海自来水来自海上')                 // true  ✅ 中文正确
isPalindrome('我爱我家')                          // false ✅（原版会返回 true）
isPalindrome('')                                // true  （空串约定为回文）
isPalindrome('a')                               // true
isPalindrome('ab')                              // false
```

### 7.2.3 空间 O(1) 的版本（ASCII 场景）

如果题目限定只处理 ASCII（LeetCode 125 就是），可以**不预处理好字符串**，而是在双指针移动时**跳过非字母数字**：

```js
function isPalindromeAscii(s) {
  const isAlnum = (c) =>
    (c >= 48 && c <= 57) ||   // 0-9
    (c >= 65 && c <= 90) ||   // A-Z
    (c >= 97 && c <= 122);    // a-z

  let l = 0, r = s.length - 1;
  while (l < r) {
    while (l < r && !isAlnum(s.charCodeAt(l))) l++;   // 跳过左侧非字母数字
    while (l < r && !isAlnum(s.charCodeAt(r))) r--;   // 跳过右侧
    if (l < r && s[l].toLowerCase() !== s[r].toLowerCase()) return false;
    l++;
    r--;
  }
  return true;
}
```

**空间 O(1)**，因为不需要额外的 `chars` 数组。

**注意三个细节**：
1. **内层 while 也要判断 `l < r`**，否则 `'...'`（全是标点）会越界或死循环
2. **比较前要判 `l < r`**，因为跳过后可能 `l >= r`（说明中间全是标点，已经比完了）
3. **用 `charCodeAt` 比正则快**，因为正则有编译和匹配开销

**为什么 Unicode 版难做到 O(1)？**

因为「从右往左」跳过字符时，要先判断当前索引是不是代理对的低位（`0xDC00 ~ 0xDFFF`），如果是就要回退两格。逻辑能写，但很容易错：

```js
// 反向遍历码点的辅助函数（了解即可）
function prevCodePointIndex(s, i) {
  if (i <= 0) return -1;
  const code = s.charCodeAt(i - 1);
  if (code >= 0xDC00 && code <= 0xDFFF) return i - 2;   // 是低位代理 → 回退两格
  return i - 1;
}
```

> **面试话术**：「如果要 O(1) 空间，就不做预处理，双指针在移动时跳过非字母数字。这在 ASCII 下很干净。但 Unicode 下反向跳字符要处理代理对，代码会变复杂，所以我一般用 O(n) 的数组版换可读性——这题的 n 是字符串长度，O(n) 空间实际影响很小。」

### 7.2.4 中心扩展法（求最长回文子串）

回文题的第二形态：不是「判断是不是」，而是「找最长的」。

**思路**：回文一定有一个「中心」，从中心向两边扩，直到不相等。**中心有两种**：
- 奇数长度：中心是 1 个字符（`aba`）
- 偶数长度：中心是 2 个字符之间的缝（`abba`）

所以对每个位置 i，要试两个中心：`(i, i)` 和 `(i, i+1)`。

```js
function longestPalindrome(s) {
  if (!s || s.length < 2) return s;

  let start = 0, maxLen = 1;

  function expand(l, r) {
    while (l >= 0 && r < s.length && s[l] === s[r]) {
      l--;
      r++;
    }
    return [l + 1, r - 1];      // 越界时已经多走了一步，要退回来
  }

  for (let i = 0; i < s.length; i++) {
    for (const [l, r] of [expand(i, i), expand(i, i + 1)]) {
      if (r - l + 1 > maxLen) {
        maxLen = r - l + 1;
        start = l;
      }
    }
  }
  return s.slice(start, start + maxLen);
}
```

**复杂度**：时间 O(n²)（n 个中心 × 每个扩 O(n)），空间 O(1)。

**为什么返回 `[l+1, r-1]`？**

循环退出时，`s[l] !== s[r]`（或者越界），说明 `[l, r]` 已经不是回文了，真正的回文是 `[l+1, r-1]`。

**这个 off-by-one 是最高频的错误**，手写时一定要用 `'aba'` 手动验证：

```
i=1（字符 'b'）: expand(1,1)
  l=1,r=1: 'b'==='b' → l=0,r=2
  l=0,r=2: 'a'==='a' → l=-1,r=3
  l=-1 越界，退出
  返回 [-1+1, 3-1] = [0, 2]  → 长度 3 ✅
```

### 7.2.5 Manacher 算法（了解即可）

中心扩展是 O(n²)。**Manacher 用「回文半径复用」把它降到 O(n)**。

**核心两步**：

**① 插入分隔符，把奇偶统一**

```
原串:  a b a
处理后: # a # b # a #     （长度 2n+1，一定是奇数）
```

这样「偶数长度的回文」也变成「以某个 `#` 为中心」，不用分两种情况。

**② 利用「回文的对称性」复用半径**

维护当前「最右回文的中心和右边界」`(center, right)`。对于位置 i：
- 如果 `i < right`，则 `i` 关于 `center` 的对称点 `2*center - i` 的半径可以复用
- 但**不能超过 `right - i`**（超出部分未知，要暴力扩）

```js
function manacher(s) {
  // 1. 预处理
  const t = '#' + [...s].join('#') + '#';
  const n = t.length;
  const p = new Array(n).fill(0);   // p[i] = 以 i 为中心的回文半径
  let center = 0, right = 0;
  let maxLen = 0, maxCenter = 0;

  for (let i = 0; i < n; i++) {
    // 2. 复用对称点的半径（受 right 限制）
    if (i < right) p[i] = Math.min(right - i, p[2 * center - i]);

    // 3. 暴力扩展（Manacher 的均摊 O(n) 就靠这步"总扩展次数 ≤ n"）
    while (i - p[i] - 1 >= 0 && i + p[i] + 1 < n && t[i - p[i] - 1] === t[i + p[i] + 1]) {
      p[i]++;
    }

    // 4. 更新最右边界
    if (i + p[i] > right) {
      center = i;
      right = i + p[i];
    }

    if (p[i] > maxLen) { maxLen = p[i]; maxCenter = i; }
  }

  // 5. 映射回原串
  const start = (maxCenter - maxLen) / 2;
  return s.slice(start, start + maxLen);
}
```

**为什么是 O(n)？** 每次 `while` 成功扩展都会让 `right` 增加 1，而 `right` 最多增加到 `2n`，所以**总扩展次数 ≤ 2n**。这是均摊分析。

> 面试话术：「Manacher 通过插入分隔符统一奇偶，再用『最右回文』的对称性复用半径，把中心扩展的 O(n²) 降到 O(n)。核心是每次暴力扩展都会推进右边界，而右边界最多推进 2n 次，所以总扩展是线性的。不过这题面试一般只要求中心扩展，Manacher 说出来是加分。」

### 7.2.6 三个变体

**变体 1：最多删除一个字符，能否变成回文（LeetCode 680）**

遇到不相等时，**试两种删法**：删左边或删右边，任一成功即可。

```js
function validPalindrome(s) {
  function check(l, r) {
    while (l < r) {
      if (s[l] !== s[r]) return false;
      l++; r--;
    }
    return true;
  }

  let l = 0, r = s.length - 1;
  while (l < r) {
    if (s[l] !== s[r]) {
      return check(l + 1, r) || check(l, r - 1);   // 删左 或 删右
    }
    l++; r--;
  }
  return true;
}
```

**为什么只试两种？** 因为第一次不相等时，**必须**删掉其中一个字符，没有第三种选择。

**变体 2：回文数（LeetCode 9）**

不转字符串的做法：反转一半数字。

```js
function isPalindromeNumber(x) {
  if (x < 0 || (x % 10 === 0 && x !== 0)) return false;   // 负数和末尾 0 都不是
  let rev = 0;
  while (x > rev) {
    rev = rev * 10 + (x % 10);
    x = Math.floor(x / 10);
  }
  return x === rev || x === Math.floor(rev / 10);   // 偶数位 或 奇数位
}
```

**关键**：只反转一半，避免溢出。`x === rev` 对应偶数位（1221），`x === Math.floor(rev/10)` 对应奇数位（12321，中间的 3 被多反转了一位）。

**变体 3：回文链表**

见 05 册 5.9.6（找中点 + 反转后半 + 比较）。

### 7.2.7 常见坑

| 坑 | 后果 | 修正 |
|---|---|---|
| `[^a-zA-Z0-9]` | 中文/重音字母被删光，非回文被判成回文 | `[\p{L}\p{N}]` + `u` 标志 |
| 忘加 `u` 标志 | `\p{L}` 不生效，被当成字面量 `p{L}` | `/[\p{L}\p{N}]/u` |
| `s[l]` 按码元访问 | emoji 被拆成两个代理项比较 | 转成数组（`[...s]`）后比较，或用 `codePointAt` |
| 空串返回 `false` | 空串按定义是回文 | 初始 `return true` |
| 单字符串返回 `false` | 同上 | `while (l < r)` 天然处理 |
| 内层 while 不判 `l < r` | 全标点串死循环/越界 | `while (l < r && ...)` |
| `toLowerCase` 假设长度不变 | `'İ'` 会变成 2 个码点 | 极少见；严格要求时用 `toLowerCase` 后重新逐个比较 |
| 中心扩展返回 `[l, r]` | 长度多算 2 | 返回 `[l+1, r-1]` |

**关于「空串是不是回文」**：数学上，空串正着读反着读都是空串，**是回文**。LeetCode 125 的测试用例包含 `' '`（一个空格），预处理后是 `''`，期望输出 `true`。**所以必须返回 true**。

### 7.2.8 答题模板

**30 秒版**

> 双指针从两端往中间夹，遇到不相等就返回 false。预处理可选：如果题意要求忽略大小写和标点，就先过滤出字母数字并统一小写。
> 时间 O(n)。如果预处理成新数组，空间 O(n)；如果限定 ASCII，可以不做预处理、双指针跳过非字母数字，空间 O(1)。
> 有个坑要注意：过滤非字母数字不能用 `[^a-zA-Z0-9]`，那会把中文全删掉，导致非回文被判成回文。要用 `\p{L}` 和 `\p{N}` 加 `u` 标志。

**2 分钟版（加分层）**

> 这题主体非常简单，就是双指针，十行代码。真正值得讲的是两个细节。
> 第一是字符集的边界。原版用 `[^a-zA-Z0-9]` 过滤，只能保留 ASCII。遇到中文或者带重音的字母，整个字符串会被删空，而空串是回文，所以会返回 true——这是假阳性。正确做法是用 Unicode 属性类 `\p{L}` 和 `\p{N}`，并且必须加 `u` 标志，否则 `\p{...}` 不生效。遍历也要用 `for...of` 而不是 `split('')`，否则 emoji 会被拆成代理对。
> 第二是空间取舍。预处理成数组是 O(n) 空间，代码最清晰。如果想要 O(1)，就不预处理，双指针移动时用 `charCodeAt` 判断是不是字母数字，跳过它们。这招在 ASCII 下很干净，但要记得内层 while 也要判 `l < r`，否则全标点的输入会死循环。
> 延伸出去，如果题目变成「求最长回文子串」，就用中心扩展：对每个位置试 `(i,i)` 和 `(i,i+1)` 两种中心，向两边扩。O(n²) 时间、O(1) 空间。再快到 O(n) 就是 Manacher，插分隔符统一奇偶，再用最右回文边界的对称性复用半径。

### 7.2.9 追问表

| 追问 | 回答要点 |
|---|---|
| 复杂度？ | O(n)；预处理版空间 O(n)，ASCII 跳过版 O(1) |
| 为什么 `[^a-zA-Z0-9]` 不对？ | 只保留 ASCII，中文被删空 → 假阳性 |
| `\p{L}` 后面为什么要 `u`？ | 不加 `u`，`\p{...}` 被当字面量，匹配不到任何东西 |
| 空串是回文吗？ | 是，必须返回 true |
| `abcba` 的中心在哪？ | 中间字符 `c`；`abba` 的中心在两个 `b` 之间 |
| 中心扩展返回什么区间？ | `[l+1, r-1]`，因为退出时 `[l,r]` 已经不满足 |
| Manacher 为什么 O(n)？ | 每次成功扩展都推进右边界，右边界最多推进 2n 次 |
| 最多删一个字符怎么做？ | 首次不相等时试 `check(l+1,r)` 和 `check(l,r-1)` |
| 回文数怎么不转字符串？ | 反转一半，`x === rev` 或 `x === rev/10` 取整 |
| 怎么判断两个 emoji 相等？ | 必须按码点或字素簇比，不能用 `s[i]` |

---

## 7.3 双指针的三种范式（本册的方法论收尾）

这两道题都是双指针，但**用法完全不同**。把三种范式记清，能覆盖 80% 的数组/字符串题。

### 7.3.1 对撞指针（左右向中间）

```
l →                    ← r
[ ][ ][ ][ ][ ][ ][ ][ ]
```

**特征**：一个从左往右，一个从右往左，直到相遇。

| 题目 | 移动规则 |
|---|---|
| **回文判断** | `s[l] !== s[r]` → false；否则同时内移 |
| **两数之和（有序数组）** | 和太小 → `l++`；和太大 → `r--` |
| **盛最多水的容器** | 移动**较短**的那一侧（因为高度受短板限制） |
| **三数之和** | 固定一个 + 内层对撞；注意去重 |
| **反转字符串/数组** | 交换 `l`、`r` 后同时内移 |

**复杂度**：O(n)，因为两个指针总移动次数 ≤ 2n。

### 7.3.2 快慢指针（同向不同速）

```
s →  →  →  →  →
f → → → → → → → →   （速度 2 倍，或先走 N 步）
```

**特征**：同方向，速度不同（或初始偏移不同）。

| 题目 | 用法 |
|---|---|
| **链表判环** | `slow` 走 1、`fast` 走 2，相遇则有环 |
| **找环入口** | 相遇后一个指针回 head，同速走 |
| **找中点** | `fast` 到末尾时 `slow` 在中点 |
| **倒数第 N 个** | `fast` 先走 N 步 |
| **数组原地去重** | `slow` 是「已去重的末尾」，`fast` 扫描 |
| **移除元素** | `slow` 是「保留区的末尾」 |

**核心套路：`slow` 是「写入位置」，`fast` 是「读取位置」**。这个模式叫**读写双指针**，是原地修改数组的通用模板：

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

**特征**：`r` 扩张窗口，`l` 收缩窗口，维护窗口内的某种状态。

**通用模板**：

```js
function slidingWindow(s) {
  let l = 0, ans = 0;
  const state = new Map();     // 窗口内的状态

  for (let r = 0; r < s.length; r++) {
    // 1. 扩张：把 s[r] 加入状态
    state.set(s[r], (state.get(s[r]) || 0) + 1);

    // 2. 收缩：当窗口不满足条件时，移动 l
    while (/* 不满足条件 */) {
      // 把 s[l] 移出状态
      state.set(s[l], state.get(s[l]) - 1);
      l++;
    }

    // 3. 更新答案
    ans = Math.max(ans, r - l + 1);
  }
  return ans;
}
```

| 题目 | 「不满足条件」是什么 |
|---|---|
| **最长无重复子串** | 某个字符出现次数 > 1 |
| **最小覆盖子串** | 窗口已经覆盖所有目标字符（要收缩到最小） |
| **长度最小的子数组（和 ≥ target）** | 窗口和 ≥ target |
| **至多 K 个不同字符的最长子串** | 不同字符数 > K |

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

**一个更本质的统一视角**：三种范式都是「用 O(1) 的指针状态代替 O(n) 的辅助结构」。对撞指针替代「双端队列」，快慢指针替代「两次遍历」，滑动窗口替代「前缀和 + 二分」。**它们都是「用单调性换空间」**。

---

## 7.4 本册速记卡

```
去除最少字符
  两遍扫描：Map 计数 → 求 min → 过滤 ≠ min
  O(n) 时间，O(k) 空间
  边界：空串返回 ''；全部同次数 → 返回 ''
  ★ 统计和过滤必须同粒度：都 for...of，不能混 split('')

三种字符粒度
  code unit（split('')、length、str[i]）→ emoji 算 2
  code point（for...of、[...str]）→ emoji 算 1，但 ZWJ 组合仍拆开
  grapheme（Intl.Segmenter）→ 用户看到的「字」，唯一正确
  例：'👨‍👩‍👧‍👦'.length = 11，[...s].length = 7 或 5，Segmenter = 1

回文判断
  双指针 l/r 向中夹；O(n)
  预处理：\p{L}\p{N} + u 标志（不能用 [^a-zA-Z0-9]，会删掉中文）
  空串是回文 → true
  O(1) 空间：不预处理，charCodeAt 跳过非字母数字（内层 while 也要判 l<r）
  中心扩展返回 [l+1, r-1]（最高频 off-by-one）
  Manacher：插 # 统一奇偶 + 最右边界对称复用 → O(n)

双指针三范式
  对撞：回文、两数和（有序）、盛水（移动短板）
  快慢：判环、中点、倒数第N、原地去重（slow 写 fast 读）
  滑窗：最长无重复、最小覆盖、和≥target
  本质：用 O(1) 指针状态代替 O(n) 辅助结构
```
