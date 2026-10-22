# 分册 07 · 类型转换与隐式规则

> 覆盖题号：**30**（`==` 和 `===` 的区别）、**20**（怎么让 `a==1 && a==2 && a==3` 成立）
> 只有 **2 题**，但第 20 题是"钓鱼题"，考的是 `ToPrimitive` 抽象操作——答得出不算本事，**讲得清才是**

---

## 目录

- [7.1 == 与 === 的区别](#71--与--的区别)
- [7.2 抽象相等：== 的完整规则](#72-抽象相等-的完整规则)
- [7.3 ToPrimitive：对象怎么变成原始值](#73-toprimitive对象怎么变成原始值)
- [7.4 十道经典"鬼畜"比较题](#74-十道经典鬼畜比较题)
- [7.5 让 a==1 && a==2 && a==3 成立](#75-让-a1--a2--a3-成立)
- [7.6 隐式转换全景（补漏）](#76-隐式转换全景补漏)
- [7.7 本册答题模板汇总](#77-本册答题模板汇总)
- [7.8 速记卡与连环追问](#78-速记卡与连环追问)

---

## 7.1 == 与 === 的区别

### 7.1.0 一句话结论

> **`===` 是严格相等**：类型不同直接 `false`，类型相同才比较值。**`==` 是抽象相等**：类型不同时先按一套规则**转成同一类型**再比。所以 `==` 的问题不是"不严格"，而是**规则太多、反直觉、容易出 bug**，工程上默认用 `===`。

### 7.1.1 严格相等的四条规则

```
① 类型不同 → false                    （1 === '1' → false）
② 类型相同，是原始值 → 比较值
   - Number：NaN !== NaN，+0 === -0
   - String / Boolean：逐字符/值比较
   - null === null，undefined === undefined
   - Symbol：按引用
③ 类型相同，是对象 → 比较【引用】
④ 其他情况 → false
```

```js
1 === 1;              // true
1 === '1';            // false  ← 类型不同，直接 false
NaN === NaN;          // false  ← 唯一一个自己不等于自己的值
+0 === -0;            // true   ← 严格相等不区分正负零
null === undefined;   // false  ← 类型不同
{} === {};            // false  ← 引用不同
const o = {}; o === o; // true
```

### 7.1.2 `Object.is` 与 `===` 的两个差异

```js
// 差异 1：NaN
NaN === NaN;                    // false
Object.is(NaN, NaN);            // true

// 差异 2：正负零
+0 === -0;                      // true
Object.is(+0, -0);              // false
```

**用途**：`Object.is` 用于需要"真正的同值判断"的场景，比如 React 的 `useState` 比较、Vue3 的 `hasChanged` 判断。

```js
// Vue3 源码里的用法
const hasChanged = (value, oldValue) => !Object.is(value, oldValue);
// 这样 NaN → NaN 不会触发更新，+0 → -0 会触发更新
```

### 7.1.3 三种"相等"算法总表（建议背下来）

| 算法 | 用在 | `NaN` vs `NaN` | `+0` vs `-0` | 类型转换 |
|---|---|---|---|---|
| **`==`**（抽象相等） | `a == b` | false | true | ✅ 会转换 |
| **`===`**（严格相等） | `a === b` | false | true | ❌ 不转换 |
| **`Object.is`**（同值相等） | `Object.is(a, b)` | **true** | **false** | ❌ 不转换 |
| **SameValueZero** | `Set`/`Map`/`includes` | true | true | ❌ 不转换 |

> 注意 `SameValueZero` 和 `Object.is` 只差一个 `+0/-0`，它是 `Set`、`Map`、`Array.includes` 用的算法。

### 7.1.4 为什么不推荐 `==`

```js
// ① 规则太多，记不住
0 == '';           // true   ← 反直觉
0 == '0';          // true
'' == '0';         // false  ← 传递性被破坏！a==b, b==c 但 a!=c

// ② 布尔值会被转成数字
1 == true;         // true
2 == true;         // false  ← 不是"真值判断"，是 2 == 1
'1' == true;       // true
[] == true;        // false
!![] === true;     // true   ← 想做真值判断应该用这个

// ③ null / undefined 是个特例
null == undefined; // true
null == 0;         // false  ← 很多人以为 true
null >= 0;         // true   ← 但关系比较又是 true，因为 null 被转成 0
null > 0;          // false
```

**唯一推荐用 `==` 的场景**：

```js
// 判断 null 或 undefined（这一个用法是社区共识）
if (value == null) {
  // 等价于 value === null || value === undefined
}

// 统一用 === 就得多写一个条件
if (value === null || value === undefined) {}
```

### 7.1.5 答题模板

**30 秒版：**

> "`===` 是严格相等，类型不同直接 `false`；`==` 是抽象相等，类型不同会先转换再比。
> 关键差异有三个：`NaN === NaN` 是 `false`，`+0 === -0` 是 `true`；而 `Object.is` 正好相反，它认 `NaN` 相等、区分正负零。
> 工程上默认用 `===`，因为 `==` 的规则太反直觉，比如 `0 == ''` 是 `true`、`null == 0` 是 `false` 但 `null >= 0` 是 `true`。唯一推荐用 `==` 的场景是 `value == null` 同时判断 `null` 和 `undefined`。"

**2 分钟版补充：**

> "如果面试官继续问，可以说清 `==` 的核心规则：
> 一是 `null` 只和 `undefined` 相等，和其他任何值都不等；
> 二是布尔值会先转成数字，所以 `2 == true` 是 `false`，因为它比的是 `2 == 1`；
> 三是对象和原始值比较时，会先调 `ToPrimitive` 把对象转成原始值，`hint` 是 `default`，也就是先 `valueOf` 再 `toString`。
> 这三条能覆盖 90% 的诡异比较题。"

### 7.1.6 追问表

| 追问 | 答题要点 |
|---|---|
| `===` 和 `==` 核心区别？ | 是否做类型转换 |
| `NaN === NaN`？ | `false`（唯一自己不等于自己的值） |
| `+0 === -0`？ | `true` |
| `Object.is` 和 `===` 差异？ | `NaN` 相等、`+0/-0` 不等 |
| Vue3 里哪里用了 `Object.is`？ | `hasChanged` 判断 |
| `null == undefined`？ | `true` |
| `null == 0`？ | `false` |
| `null >= 0`？ | `true`（关系运算会转数字） |
| `0 == ''`？ | `true` |
| `'' == '0'`？ | `false` |
| `2 == true`？ | `false`（比的是 `2 == 1`） |
| 什么时候可以用 `==`？ | `value == null` 判断空 |
| `==` 有传递性吗？ | 没有，`0==''` `0=='0'` 但 `''!='0'` |

---

## 7.2 抽象相等：== 的完整规则

> 这节是"能背出来就赢一半"的部分。**不用全背，但要能说出"类型不同时按什么顺序转"**。

### 7.2.1 规范里的 8 条规则（简化版）

```
设比较 x == y：

① 类型相同 → 退化成 ===
② x 是 null 且 y 是 undefined（或反过来） → true
③ 一方是 Number，一方是 String → String 转 Number 再比
④ 一方是 Boolean → Boolean 转 Number，再重新按规则比
⑤ 一方是 Object，一方是 String/Number/BigInt/Symbol
   → Object 走 ToPrimitive，再重新按规则比
⑥ BigInt vs String → String 转 BigInt
⑦ BigInt vs Number → 按数学值比较
⑧ 其他 → false
```

**用流程图看更清楚**：

```
x == y
  │
  ├─ 类型相同？ ──是──→ 用 === 的规则
  │
  ├─ null vs undefined？ ──是──→ true
  │
  ├─ 有 Boolean？ ──是──→ Boolean 转数字，重来
  │
  ├─ Number vs String？ ──是──→ String 转数字，重来
  │
  ├─ 有 Object？ ──是──→ Object 走 ToPrimitive，重来
  │
  └─ 其他 ──→ false
```

### 7.2.2 逐步推演三个典型例子

**例 1：`[] == false` → `true`**

```
[] == false
  ↓ 规则④：有 Boolean，false → 0
[] == 0
  ↓ 规则⑤：有 Object，[] 走 ToPrimitive(hint=default)
  ↓         valueOf 返回数组本身（不是原始值）→ 继续 toString
  ↓         [].toString() === ''
'' == 0
  ↓ 规则③：String vs Number，'' → 0
0 == 0
  ↓ 类型相同
true
```

**例 2：`[1,2] == '1,2'` → `true`**

```
[1,2] == '1,2'
  ↓ 规则⑤：[1,2].valueOf() 返回数组本身 → toString() 返回 '1,2'
'1,2' == '1,2'
  ↓ 类型相同
true
```

**例 3：`null == 0` → `false`**

```
null == 0
  ↓ 规则②：null 只和 undefined 相等，这里对方是 0，不匹配
  ↓ 规则③：null 不是 Number，不匹配
  ↓ 规则④：没有 Boolean
  ↓ 规则⑤：null 不是 Object（typeof null === 'object'，但规范里 Type(null) 是 Null）
  ↓ 规则⑧：其他 → false
false
```

> **关键点**：`null` 在 `==` 里**不参与任何类型转换**，它只和 `undefined` 相等。而关系运算（`>=`、`<`）走的是另一套 `ToNumber`，`null` 会变成 `0`，所以 `null >= 0` 是 `true`。

### 7.2.3 完整的"比较结果矩阵"

| | `undefined` | `null` | `0` | `''` | `false` | `NaN` |
|---|---|---|---|---|---|---|
| `undefined` | ✅ true | ✅ true | ❌ | ❌ | ❌ | ❌ |
| `null` | ✅ true | ✅ true | ❌ | ❌ | ❌ | ❌ |
| `0` | ❌ | ❌ | ✅ true | ✅ true | ✅ true | ❌ |
| `''` | ❌ | ❌ | ✅ true | ✅ true | ✅ true | ❌ |
| `false` | ❌ | ❌ | ✅ true | ✅ true | ✅ true | ❌ |
| `NaN` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

**读法**：

- 第一、二行/列：`null`/`undefined` 只和彼此相等
- 中间 3×3 块：`0`、`''`、`false` 三者**全等**（都是"假值"）
- `NaN` 和谁都不等（包括自己）

---

## 7.3 ToPrimitive：对象怎么变成原始值

> 这是第 20 题的**唯一考点**，也是 `==` 规则第 ⑤ 条的底层。

### 7.3.1 三个 hint 与优先级

```js
ToPrimitive(input, hint)
  hint ∈ { "default", "number", "string" }

① 如果 input 有 Symbol.toPrimitive 方法
   → 调用它，把 hint 传进去，用返回值（必须是原始值，否则 TypeError）

② 否则，按 hint 选顺序：
   hint = "number"   → valueOf() 先，toString() 后
   hint = "string"   → toString() 先，valueOf() 后
   hint = "default"  → 当作 "number" 处理（valueOf 先）

③ 两个都拿不到原始值 → TypeError: Cannot convert object to primitive value
```

**谁传什么 hint？**

| 场景 | hint |
|---|---|
| `==` 比较（对象 vs 原始值） | `"default"` → 实际按 `"number"` 走 |
| `+` 运算（对象参与） | `"default"` |
| `Number(obj)` / `*` / `-` / `<` | `"number"` |
| `String(obj)` / 模板字符串 | `"string"` |
| `Date` 的 `+` 运算 | **`"default"` 但 Date 特殊处理成 `"string"`** |

> **Date 是唯一的例外**：`Date.prototype[Symbol.toPrimitive]` 里，如果 hint 是 `"default"`，会当成 `"string"` 处理。所以 `new Date() + 1` 得到的是字符串拼接（日期字符串 + '1'），而不是时间戳加 1。

```js
const d = new Date('2026-01-01');
console.log(d + 1);        // 'Thu Jan 01 2026 ...1'  ← 字符串拼接
console.log(+d + 1);       // 1767225600001         ← 显式转数字才做加法
console.log(d - 0);        // 1767225600000         ← 减法是 number hint
```

### 7.3.2 `valueOf` 与 `toString` 的默认行为

```js
const obj = { a: 1 };

obj.valueOf();      // { a: 1 }        ← 默认返回对象本身（不是原始值！）
obj.toString();     // '[object Object]'  ← 返回字符串

const arr = [1, 2];
arr.valueOf();      // [1, 2]          ← 还是对象
arr.toString();     // '1,2'           ← 关键：数组的 toString 是 join(',')

const fn = function () {};
fn.toString();      // 'function () {}'  ← 源码字符串
```

**所以 `[] == 0` 走的是**：

```
[] → valueOf() 返回 []（对象，不合格）
   → toString() 返回 ''（原始值 ✅）
   → '' == 0 → 0 == 0 → true
```

### 7.3.3 自定义转换：三种写法

```js
// 写法 1：只覆盖 valueOf（数值场景）
const money = {
  amount: 100,
  valueOf() { return this.amount; },
};
console.log(money + 1);      // 101
console.log(money == 100);   // true
console.log(`${money}`);     // '100'？ 不，模板字符串用 string hint → toString → '[object Object]'
```

**⚠️ 这里有个坑**：`${money}` 走 `string` hint，会先调 `toString`，而 `toString` 没被覆盖，所以得到 `'[object Object]'`。

```js
// 写法 2：只覆盖 toString（字符串场景）
const user = {
  name: 'Tom',
  toString() { return `User(${this.name})`; },
};
console.log(`${user}`);        // 'User(Tom)'
console.log(user + '');        // 'User(Tom)'（default hint → valueOf 返回对象 → 落到 toString）
console.log(String(user));     // 'User(Tom)'
console.log(user + 1);         // 'User(Tom)1'  ← 注意：字符串拼接了，不是加法
```

```js
// 写法 3：Symbol.toPrimitive（最完整，能区分 hint）
const smart = {
  [Symbol.toPrimitive](hint) {
    console.log('hint =', hint);
    if (hint === 'number') return 42;
    if (hint === 'string') return 'smart';
    return 'default';           // hint === 'default'
  },
};
console.log(+smart);        // hint = number → 42
console.log(`${smart}`);    // hint = string → 'smart'
console.log(smart + '');    // hint = default → 'default'
console.log(smart == 42);   // hint = default → 'default' == 42 → false
```

> **面试话术**：「`Symbol.toPrimitive` 的优先级最高，而且能拿到 `hint` 区分场景。`valueOf`/`toString` 是兜底方案，按 hint 决定顺序。想要对象在数值和字符串场景下表现一致，最好实现 `Symbol.toPrimitive`。」

### 7.3.4 一个必须知道的失败情况

```js
const bare = Object.create(null);   // 没有原型，也就没有 valueOf/toString
// console.log(bare + '');          // ❌ TypeError: Cannot convert object to primitive value
// console.log(bare == 1);          // ❌ TypeError
console.log(String(bare));          // ❌ 同样报错
```

> 这是 `Object.create(null)` 的副作用：它连转换方法都没有。要用的话得手动挂 `toString`。

---

## 7.4 十道经典"鬼畜"比较题

> 面试官如果出这类题，目的不是考记忆，是看你**是否理解规则而不是背结论**。答的时候**一定要说出推导过程**。

### 题 1：`[] == ![]`

```js
[] == ![]
// ![] → false（[] 是真值，取反为 false）
// 变成 [] == false
// false → 0
// [] → ToPrimitive → ''
// '' == 0 → 0 == 0 → true
// 答案：true
```

### 题 2：`{} == !{}`

```js
{} == !{}
// 注意：在表达式位置 {} 是对象字面量
// !{} → false
// {} == false → {} == 0
// {}.valueOf() → {} （对象）→ toString() → '[object Object]'
// '[object Object]' == 0 → NaN == 0 → false
// 答案：false
```

> ⚠️ 如果写在语句开头（`{} == !{}` 单独一行），`{}` 会被解析成**代码块**，结果是 `SyntaxError`。要加括号：`({} == !{})`。

### 题 3：`[] + {}` 和 `{} + []`

```js
[] + {}       // '[object Object]'
// [] → '' ; {} → '[object Object]' ; 有字符串 → 拼接

({}) + []     // '[object Object]'（加括号才是表达式）

{} + []       // 0
// ← 语句位置：{} 是空代码块，等价于 +[] → +'' → 0
```

### 题 4：`[1,2] + [3,4]`

```js
[1,2] + [3,4]   // '1,23,4'
// 两边都走 toString → '1,2' 和 '3,4' → 字符串拼接
```

### 题 5：`'5' - 2` 和 `'5' + 2`

```js
'5' - 2    // 3    （减号只有数值语义 → 都转数字）
'5' + 2    // '52' （加号有字符串语义 → 一方是字符串就拼接）
'5' * '2'  // 10
'5' / '2'  // 2.5
```

### 题 6：`null == 0` vs `null >= 0`

```js
null == 0    // false（== 里 null 不转换，只和 undefined 相等）
null >= 0    // true （关系运算走 ToNumber，null → 0）
null > 0     // false
null < 1     // true
```

> **这三个放一起是面试官的"杀手锏"**，因为看起来自相矛盾：`null >= 0` 是 true 但 `null == 0` 是 false。原因是**两套不同的算法**。

### 题 7：`NaN == NaN` 与 `NaN != NaN`

```js
NaN == NaN    // false
NaN === NaN   // false
NaN != NaN    // true   ← 唯一一个 x != x 为 true 的值
Object.is(NaN, NaN)   // true
```

### 题 8：`new Number(1) == 1`

```js
new Number(1) == 1     // true  ← 对象走 ToPrimitive → valueOf() 返回 1
new Number(1) === 1    // false ← 类型不同（object vs number）
typeof new Number(1)   // 'object'
```

### 题 9：`' \t\n' == 0`

```js
' \t\n' == 0   // true
// String → Number 时，规范会先去除首尾空白字符
// Number(' \t\n') === 0
```

### 题 10：`0.1 + 0.2 == 0.3`

```js
0.1 + 0.2 === 0.3            // false
0.1 + 0.2                    // 0.30000000000000004
Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON   // true ← 正确比较方式
```

> 这不是类型转换问题，是**浮点数精度**问题（IEEE 754）。但面试常放在一起考，答的时候要区分清楚："这不是隐式转换的锅，是二进制无法精确表示 0.1。"

---

## 7.5 让 a==1 && a==2 && a==3 成立

### 7.5.0 一句话结论

> 关键在于**用 `==` 而不是 `===`**：`==` 在"对象 vs 数字"时会调用 `ToPrimitive(a, "default")`，也就是会调 `a` 的 `valueOf`（或 `Symbol.toPrimitive`）。**只要让每次调用返回递增的值**，条件就成立。本质是"**利用隐式转换的副作用做有状态的转换**"。

### 7.5.1 方案一：`valueOf` + 计数器（最标准）

```js
const a = {
  value: 1,
  valueOf() {
    return this.value++;
  },
};

console.log(a == 1 && a == 2 && a == 3);   // true
```

**推导过程**：

```
a == 1
  ↓ 对象 vs 数字 → ToPrimitive(a, "default")
  ↓ 没有 Symbol.toPrimitive → 按 "number" 顺序 → 先调 valueOf()
  ↓ valueOf 返回 1（同时 this.value 变成 2）
1 == 1 → true

a == 2
  ↓ 再调 valueOf() → 返回 2（this.value 变成 3）
2 == 2 → true

a == 3
  ↓ 再调 valueOf() → 返回 3
3 == 3 → true
```

**注意**：这里 `valueOf` **必须是普通方法**（不能用箭头函数），因为要用 `this.value`。

### 7.5.2 方案二：`Symbol.toPrimitive`（更"现代"）

```js
let i = 1;
const a = {
  [Symbol.toPrimitive]() {
    return i++;
  },
};

console.log(a == 1 && a == 2 && a == 3);   // true
```

**为什么这个更"正确"？** 因为它**优先级最高**，不会被 `toString` 干扰，而且能显式声明"我要处理转换"。

### 7.5.3 方案三：数组的 `toString` + `shift`

```js
const a = [1, 2, 3];
a.join = a.shift;   // 把 join 换成 shift

console.log(a == 1 && a == 2 && a == 3);   // true
```

**推导过程**：

```
a == 1
  ↓ ToPrimitive(a, "default")
  ↓ a.valueOf() 返回数组本身（不是原始值）
  ↓ 落到 a.toString()
  ↓ Array.prototype.toString 内部调用 this.join(',')
  ↓ 但 a.join 已被换成 a.shift
  ↓ a.shift() 弹出第一个元素 1，并返回 1
1 == 1 → true
```

**这个方案很"取巧"**，但它揭示了 `Array.prototype.toString` 依赖 `join` 这个细节，答出来很加分。

### 7.5.4 方案四：Proxy 拦截（最"炫技"）

```js
const a = new Proxy({}, {
  get(target, key) {
    if (key === Symbol.toPrimitive) {
      let i = 1;
      return () => i++;
    }
    return undefined;
  },
});

console.log(a == 1 && a == 2 && a == 3);   // true
```

### 7.5.5 方案五：全局 getter（换个思路）

```js
// 这个方案不是在"转换"上做文章，而是让每次读取 a 都得到新值
let i = 0;
Object.defineProperty(globalThis, 'a', {
  get() { return ++i; },
  configurable: true,
});

console.log(a == 1 && a == 2 && a == 3);   // true（浏览器非严格模式 / 全局脚本）
```

> **注意**：这个方案只在**全局作用域**生效（因为 `a` 成了全局 getter）。在模块里 `globalThis.a` 不会变成模块作用域的 `a`，所以不通用。**面试时提一句"这个思路不同，是靠 getter 而不是靠转换"就够了**。

### 7.5.6 为什么 `===` 不行

```js
const a = { value: 1, valueOf() { return this.value++; } };

console.log(a === 1);   // false ← 类型不同，=== 直接 false，不调用 valueOf
```

**这就是题目必须用 `==` 的原因**：`===` 不做类型转换，对象永远不等于数字。

> **面试话术**：「这题的考点其实是"`==` 会触发 `ToPrimitive`"这个机制。`===` 完全不转换，所以必然失败。所以这题严格说是**考隐式转换的副作用**，不是考什么黑魔法。」

### 7.5.7 实际意义（别只当脑筋急转弯）

这套机制在真实代码里很有用：

```js
// ① 让对象支持数值运算（金额、坐标、时间）
class Money {
  constructor(cents) { this.cents = cents; }
  valueOf() { return this.cents; }
  toString() { return `¥${(this.cents / 100).toFixed(2)}`; }
}

const price = new Money(1999);
console.log(price + 1);        // 2000（数值运算）
console.log(`${price}`);       // '¥19.99'（字符串场景）

// ② 让对象支持比较
class Version {
  constructor(str) { this.parts = str.split('.').map(Number); }
  valueOf() { return this.parts.reduce((a, n) => a * 1000 + n, 0); }
}
console.log(new Version('1.2.3') > new Version('1.2.10'));   // false ✅

// ③ 让对象"看起来像"原始值（ORM、DSL）
```

### 7.5.8 答题模板

**30 秒版：**

> "关键在于用 `==` 而不是 `===`。`==` 在'对象和数字比较'时会触发 `ToPrimitive`，`hint` 是 `default`，也就是会调用对象的 `valueOf`。所以只要让 `valueOf` 每次返回递增的值就行：
> ```js
> const a = { value: 1, valueOf() { return this.value++; } };
> a == 1 && a == 2 && a == 3   // true
> ```
> 换成 `===` 就不行了，因为 `===` 不做类型转换，对象永远不等于数字。"

**2 分钟版补充：**

> "如果继续问，可以补三种变体：
> 一是用 `Symbol.toPrimitive`，它优先级比 `valueOf` 高，而且能拿到 `hint`，是更规范的做法；
> 二是把数组的 `join` 换成 `shift`，因为 `Array.prototype.toString` 内部就是调 `join`；
> 三是用 Proxy 拦截 `Symbol.toPrimitive` 的 `get`。
>
> 另外要说清这题不是纯脑筋急转弯——`valueOf` 在真实项目里能让对象支持数值运算和比较，比如金额对象、版本号对象，都是靠这个机制。"

### 7.5.9 追问表

| 追问 | 答题要点 |
|---|---|
| 为什么用 `==` 不用 `===`？ | `===` 不转换，对象永不等于数字 |
| `==` 触发了什么？ | `ToPrimitive(a, "default")` |
| `default` hint 的顺序？ | 先 `valueOf`，后 `toString` |
| 为什么 `valueOf` 不能用箭头函数？ | 需要 `this` 访问计数器 |
| `Symbol.toPrimitive` 优先级？ | 最高，先于 `valueOf` |
| 数组那个方案为什么能work？ | `Array.prototype.toString` 内部调 `join` |
| `toString` 能行吗？ | 能，但要返回数字字符串（`==` 里字符串会转数字） |
| 还有别的思路吗？ | 全局 getter、Proxy |
| 这题有实际用途吗？ | 有，金额/版本号对象的运算与比较 |
| `valueOf` 返回对象会怎样？ | 继续走 `toString`，两个都不返回原始值则 `TypeError` |

---

## 7.6 隐式转换全景（补漏）

> 原题单没单独考，但 `==` 和 `a==1` 两题都建立在这上面。**这一节是"体系化"的部分，答任何转换题都能用。**

### 7.6.1 三个抽象操作

| 操作 | 作用 | 关键规则 |
|---|---|---|
| **`ToBoolean`** | 转布尔 | 只有 8 个假值，其余全真 |
| **`ToString`** | 转字符串 | 对象走 `ToPrimitive(hint="string")` |
| **`ToNumber`** | 转数字 | 对象走 `ToPrimitive(hint="number")`；字符串会 trim，非法则 `NaN` |
| **`ToPrimitive`** | 转原始值 | 见 7.3 |

**8 个假值（必须背）**：

```js
false, 0, -0, 0n, '', null, undefined, NaN
```

**容易判断错的"真值"**：

```js
'0'        // true   ← 非空字符串
' '        // true   ← 空格也是非空
[]         // true   ← 空数组是真值！
{}         // true   ← 空对象是真值！
function(){}  // true
-1         // true
Infinity   // true
```

> 这就是为什么 `if ([]) {}` 会进分支，而 `if (![])` 是 `false`——**空数组不是假值**。很多人把"空"和"假"混为一谈。

### 7.6.2 `+` 运算符的两义性

```
x + y
  ↓
px = ToPrimitive(x, default)
py = ToPrimitive(y, default)
  ↓
如果 px 或 py 是 String → 字符串拼接
否则 → 数值相加（BigInt 和 Number 混用会 TypeError）
```

```js
1 + 2          // 3
1 + '2'        // '12'    ← 有字符串就拼接
1 + true       // 2       ← true → 1
1 + null       // 1       ← null → 0
1 + undefined  // NaN     ← undefined → NaN
1 + {}         // '1[object Object]'
1 + []         // '1'     ← [] → ''
[] + []        // ''      ← '' + ''
[] + {}        // '[object Object]'
[1] + [2]      // '12'
```

### 7.6.3 其他运算符

```js
// 减法/乘法/除法/取模：只有数值语义，全部 ToNumber
'6' - '2'      // 4
'6' * '2'      // 12
'6' / '2'      // 3
'6' % '4'      // 2
true - 1       // 0
null - 1       // -1
undefined - 1  // NaN

// 一元 +：ToNumber
+'123'         // 123
+''            // 0
+'  12  '      // 12（trim）
+'0x10'        // 16（能识别十六进制）
+'1e3'         // 1000
+[]            // 0
+[1]           // 1
+[1,2]         // NaN（'1,2' 转数字失败）
+{}            // NaN
+true          // 1
+null          // 0
+undefined     // NaN

// 一元 !：ToBoolean 后取反
![]            // false
!{}            // false
!'0'           // false
!![]           // true

// 关系运算 < > <= >=：ToPrimitive(hint="number")，都是字符串则按字典序
'10' < '9'     // true   ← 字符串比较，按字符编码
10 < 9         // false
'10' < 9       // true?  不，'10' → 10, 10 < 9 → false
[2] < [11]     // false（'2' < '11' 是字符串比较？→ 不，[2]→'2', [11]→'11'，都是字符串 → 字典序 '2' > '1' → false）
```

**关于 `[2] < [11]` 的细节**：`ToPrimitive([2], number)` 会先 `valueOf`（返回数组），再 `toString` 返回 `'2'`。同理 `[11]` → `'11'`。两个都是字符串 → 按字典序比 → `'2' > '1'` → `false`。**这个例子说明 `ToPrimitive` 的 hint 是 `number` 但结果可能是字符串**。

### 7.6.4 一张速查表

| 值 | `String()` | `Number()` | `Boolean()` |
|---|---|---|---|
| `undefined` | `'undefined'` | `NaN` | `false` |
| `null` | `'null'` | `0` | `false` |
| `true` | `'true'` | `1` | `true` |
| `false` | `'false'` | `0` | `false` |
| `''` | `''` | `0` | `false` |
| `'  '` | `'  '` | `0` | **`true`** |
| `'12'` | `'12'` | `12` | `true` |
| `'12a'` | `'12a'` | `NaN` | `true` |
| `0` | `'0'` | `0` | `false` |
| `-0` | `'0'` | `-0` | `false` |
| `NaN` | `'NaN'` | `NaN` | `false` |
| `Infinity` | `'Infinity'` | `Infinity` | `true` |
| `[]` | `''` | `0` | **`true`** |
| `[1]` | `'1'` | `1` | `true` |
| `[1,2]` | `'1,2'` | `NaN` | `true` |
| `{}` | `'[object Object]'` | `NaN` | **`true`** |
| `function(){}` | 源码 | `NaN` | `true` |

### 7.6.5 面试话术：怎么答"隐式转换"类问题

> **三步法**：
> 1. **先判类型**：两边分别是什么类型？
> 2. **找规则**：`==` 走抽象相等、`+` 走"字符串优先"、其他算术走 `ToNumber`、关系运算走 `ToPrimitive(number)`
> 3. **对象就走 ToPrimitive**：`hint` 是 `default`（→ `valueOf` 先）还是 `number`/`string`？
>
> **切忌**：直接报答案。面试官要听的是推导过程。

---

## 7.7 本册答题模板汇总

### 7.7.1 一句话版

```
㉚ == vs ===   → 是否转换；NaN/±0 的三种算法差异
⑳ a==1&&a==2   → == 触发 ToPrimitive → valueOf 返回递增值
```

### 7.7.2 把两题串起来

> "第 30 题是**规则**，第 20 题是**规则的应用**。
> `==` 的规则里最关键的一条是"对象 vs 原始值 → 对象走 `ToPrimitive`"，而 `ToPrimitive` 的 `default` hint 会先调 `valueOf`。
> 第 20 题就是抓住这个入口，让 `valueOf` 每次返回不同的值——所以它考的不是"奇技淫巧"，是**你是否真的理解 `==` 的转换路径**。
>
> 一句话：**`==` 的转换路径里有一个"用户可控的钩子"（`valueOf`/`Symbol.toPrimitive`），第 20 题就是把这个钩子用到了极致。**

---

## 7.8 速记卡与连环追问

### 7.8.1 速记卡

```
【三种相等】
  ===            NaN≠NaN   +0===-0    不转换
  Object.is      NaN===NaN +0!==-0    不转换
  SameValueZero  NaN===NaN +0===-0    Set/Map/includes

【== 八条规则（简化）】
  ① 类型相同 → ===
  ② null 只和 undefined 相等
  ③ Number vs String → String 转 Number
  ④ 有 Boolean → 转 Number
  ⑤ 有 Object → ToPrimitive，重来
  ⑥⑦ BigInt 特例
  ⑧ 其他 → false

【ToPrimitive】
  hint: default | number | string
  有 Symbol.toPrimitive → 优先调它
  number  → valueOf → toString
  string  → toString → valueOf
  default → 当 number（Date 例外：当 string）

【三个默认转换】
  Object.prototype.valueOf → 返回对象本身（不是原始值！）
  Object.prototype.toString → '[object Object]'
  Array.prototype.toString → join(',')  ← 关键

【必背结论】
  null == undefined  true     null == 0  false     null >= 0  true
  0 == ''  true               '' == '0'  false
  [] == false  true           [] == ![]  true
  [] + {}  '…Object]'         [1,2]+[3,4] '1,23,4'
  '5'-2 → 3                   '5'+2 → '52'
  NaN != NaN  true

【8 个假值】
  false / 0 / -0 / 0n / '' / null / undefined / NaN
  ⚠️ [] 和 {} 都是真值！

【a==1&&a==2&&a==3】
  const a = { v: 1, valueOf() { return this.v++; } };
  或 Symbol.toPrimitive / a.join = a.shift / Proxy / 全局 getter
  必须用 ==（=== 不转换）
```

### 7.8.2 连环追问

| # | 追问 | 关键答点 |
|---|---|---|
| 1 | `==` 和 `===` 区别？ | 是否做类型转换 |
| 2 | `NaN === NaN`？ | `false` |
| 3 | `+0 === -0`？ | `true` |
| 4 | `Object.is` 和 `===` 差异？ | `NaN`、`+0/-0` |
| 5 | `null == 0`？ | `false` |
| 6 | `null >= 0`？ | `true`（关系运算走 `ToNumber`） |
| 7 | `undefined == 0`？ | `false` |
| 8 | `0 == ''`？ | `true` |
| 9 | `'' == '0'`？ | `false` |
| 10 | `==` 有传递性吗？ | 没有 |
| 11 | `[] == false`？ | `true`（`[]`→`''`→`0`） |
| 12 | `2 == true`？ | `false`（比 `2 == 1`） |
| 13 | 什么时候用 `==`？ | `value == null` |
| 14 | `ToPrimitive` 的 hint 有哪些？ | `default` / `number` / `string` |
| 15 | `default` 时先调谁？ | `valueOf`（Date 例外走 `toString`） |
| 16 | `valueOf` 默认返回什么？ | 对象本身 |
| 17 | `[].toString()`？ | `''` |
| 18 | `[].valueOf()`？ | `[]`（对象） |
| 19 | `Array.prototype.toString` 依赖什么？ | `join` |
| 20 | `Symbol.toPrimitive` 优先级？ | 最高 |
| 21 | `+` 的两义性？ | 有字符串就拼接，否则相加 |
| 22 | `'5' - 2`？ | `3` |
| 23 | `'5' + 2`？ | `'52'` |
| 24 | `+' 12 '`？ | `12`（会 trim） |
| 25 | `+[1,2]`？ | `NaN` |
| 26 | `[] + {}`？ | `'[object Object]'` |
| 27 | `{} + []`？ | `0`（`{}` 被当代码块） |
| 28 | 8 个假值？ | `false/0/-0/0n/''/null/undefined/NaN` |
| 29 | `[]` 是真值还是假值？ | **真值** |
| 30 | `a==1&&a==2&&a==3` 怎么实现？ | `valueOf` 返回递增值 |
| 31 | 为什么不能用 `===`？ | `===` 不转换 |
| 32 | `valueOf` 能用箭头函数吗？ | 不能，需要 `this` |
| 33 | 数组那个方案原理？ | `toString` 内部调 `join`，把 `join` 换成 `shift` |
| 34 | 这题有实际用途吗？ | 金额/版本号对象支持运算比较 |
| 35 | `0.1+0.2 == 0.3`？ | `false`，是浮点精度不是类型转换 |
