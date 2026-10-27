# 分册 07 · 类型转换与隐式规则

> 覆盖题号：**30**（`==` 和 `===` 的区别）、**20**（怎么让 `a==1 && a==2 && a==3` 成立）
> 第 20 题的底层是 `ToPrimitive` 抽象操作。
> 输出以 Node 22（Asia/Shanghai）实测为准。

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

`===` 要求类型相同，类型不同直接 `false`；`==` 在类型不同时按抽象相等规则转成同一类型再比较。工程上默认用 `===`，唯一常用的例外是 `value == null`。

### 7.1.1 严格相等的规则

```
① 类型不同 → false
② 类型相同且是原始值 → 比较值
   - Number：NaN !== NaN，+0 === -0
   - String / Boolean：按值比较
   - null === null，undefined === undefined
   - Symbol：同一个 Symbol 值相等，Symbol() 每次生成新值
③ 类型相同且是对象 → 比较引用
```

```js
1 === 1; // true
1 === '1'; // false
NaN === NaN; // false
+0 === -0; // true
null === undefined; // false
({}) === {}; // false
const o = {};
o === o; // true
const s = Symbol('x');
s === s; // true
Symbol('x') === Symbol('x'); // false
```

### 7.1.2 `Object.is` 与 `===` 的两个差异

```js
NaN === NaN; // false
Object.is(NaN, NaN); // true

+0 === -0; // true
Object.is(+0, -0); // false
```

`Object.is` 用 `SameValue`。React 的 `useState` 用它判断状态是否变化；Vue3 的 `hasChanged` 是 `!Object.is(value, oldValue)`（`@vue/reactivity` 源码）。因此 `NaN → NaN` 不触发更新，`+0 → -0` 触发更新。

### 7.1.3 三种"相等"算法总表

| 算法 | 用在 | `NaN` vs `NaN` | `+0` vs `-0` | 类型转换 |
|---|---|---|---|---|
| **`==`**（抽象相等） | `a == b` | false | true | 类型不同时才转换 |
| **`===`**（严格相等） | `a === b` | false | true | ❌ 不转换 |
| **`Object.is`**（同值相等） | `Object.is(a, b)` | **true** | **false** | ❌ 不转换 |
| **SameValueZero** | `Set`/`Map`/`includes` | true | true | ❌ 不转换 |

`SameValueZero` 和 `Object.is` 只差一个 `+0/-0`，它是 `Set`、`Map`、`Array.includes` 用的算法。

### 7.1.4 为什么不推荐 `==`

```js
// 规则不可组合
0 == ''; // true
0 == '0'; // true
'' == '0'; // false  ← 不满足传递性

// 布尔值先转数字
1 == true; // true
2 == true; // false（2 == 1）
'1' == true; // true
[] == true; // false
!![] === true; // true

// null / undefined 是特例
null == undefined; // true
null == 0; // false
null >= 0; // true（>= 走 ToNumber(null) = 0）
null > 0; // false
```

唯一常用例外：

```js
if (value == null) {
  // 等价于 value === null || value === undefined
}
```

### 7.1.5 答题模板

- `===` 类型不同直接 `false`；类型相同比较值，`NaN` 不等于自己，`+0 === -0`。
- `==` 同类型退化成 `===`；`null`/`undefined` 只和对方相等；其余组合转数字（布尔先转 0/1，对象走 `ToPrimitive`，BigInt 与字符串转 BigInt）。
- `Object.is` 与 `===` 只差两处：`NaN` 相等、`+0/-0` 不等。
- 工程上用 `===`；唯一常用例外是 `value == null`。

---

## 7.2 抽象相等：== 的完整规则

### 7.2.1 规范里的 8 条规则（简化版）

设比较 `x == y`，按顺序命中即返回；③④⑤ 转换后会重新走这套规则：

```
① 类型相同 → 退化成 ===
② x 是 null 且 y 是 undefined（或反过来） → true
③ 一方 Number，一方 String → String 转 Number
④ 一方 Boolean → Boolean 转 Number，重来
⑤ 一方 Object，一方 String/Number/BigInt/Symbol → Object 走 ToPrimitive，重来
⑥ BigInt vs String → String 转 BigInt
⑦ BigInt vs Number → 按数学值比较
⑧ 其他 → false
```

BigInt 两条分支的实测：

```js
1n == 1; // true
1n == '1'; // true
1n == '1.0'; // false  ← StringToBigInt 失败，结果是 false，不抛错
1n == 1.5; // false
1n == true; // true   ← true → 1，再按 BigInt vs Number
0n == ''; // true
1n == Infinity; // false  ← 非有限数不与 BigInt 相等
1n + 1; // TypeError: Cannot mix BigInt and other types
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
  ↓ 规则②：null 只和 undefined 相等，对方是 0，不匹配
  ↓ 规则③④⑤：null 不是 Number/Boolean/Object，都不匹配
  ↓ 规则⑧：其他 → false
false
```

**关键点**：`null` 在 `==` 里不参与类型转换，它只和 `undefined` 相等。关系运算（`>=`、`<`）走另一套 `ToNumber`，`null` 会变成 `0`，所以 `null >= 0` 是 `true`。

### 7.2.3 完整的"比较结果矩阵"

| | `undefined` | `null` | `0` | `''` | `false` | `NaN` |
|---|---|---|---|---|---|---|
| `undefined` | ✅ true | ✅ true | ❌ | ❌ | ❌ | ❌ |
| `null` | ✅ true | ✅ true | ❌ | ❌ | ❌ | ❌ |
| `0` | ❌ | ❌ | ✅ true | ✅ true | ✅ true | ❌ |
| `''` | ❌ | ❌ | ✅ true | ✅ true | ✅ true | ❌ |
| `false` | ❌ | ❌ | ✅ true | ✅ true | ✅ true | ❌ |
| `NaN` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

- 第一、二行/列：`null`/`undefined` 只和彼此相等
- 中间 3×3 块：`0`、`''`、`false` 两两相等
- `NaN` 和谁都不等（包括自己）

---

## 7.3 ToPrimitive：对象怎么变成原始值

`==` 的第 ⑤ 条、二元 `+`、关系运算都会落到这个抽象操作。

### 7.3.1 三个 hint 与优先级

```
ToPrimitive(input, hint)
  hint ∈ { "default", "number", "string" }

① 有 Symbol.toPrimitive → 调用它并传入 hint；返回值必须是原始值，否则 TypeError
② 否则按 hint 选顺序：
   "number"  → valueOf() → toString()
   "string"  → toString() → valueOf()
   "default" → 按 "number" 处理（Date 例外，按 "string"）
③ 两个方法都拿不到原始值 → TypeError: Cannot convert object to primitive value
```

hint 来源：

| 场景 | hint |
|---|---|
| `==` 中对象 vs 原始值 | `"default"` |
| 二元 `+`（对象参与） | `"default"` |
| 一元 `+`、`Number(obj)`、`-` `*` `/` `%`、关系运算（`<` `>` `<=` `>=`） | `"number"` |
| `String(obj)`、模板字符串 | `"string"` |
| `Date` 的 `"default"` | 特例：按 `"string"` 处理；`"number"` 仍按 `"number"` |

普通对象的 `default` 顺序是 `valueOf → toString`。`Date.prototype[Symbol.toPrimitive]` 把 `default` 转成 `string`，所以 `new Date() + 1` 是字符串拼接，`==` 同样受影响：

```js
const d = new Date('2026-01-01');
console.log(d.toString()); // 'Thu Jan 01 2026 08:00:00 GMT+0800 (中国标准时间)'
console.log(d + 1); // 'Thu Jan 01 2026 08:00:00 GMT+0800 (中国标准时间)1'
console.log(d == 0); // false（d 先转成日期字符串）
console.log(+d + 1); // 1767225600001
console.log(d - 0); // 1767225600000
```

日期字符串随本地时区和语言环境变化，时间戳不变。

### 7.3.2 `valueOf` 与 `toString` 的默认行为

```js
const obj = { a: 1 };
obj.valueOf(); // { a: 1 }（对象本身，不是原始值）
obj.toString(); // '[object Object]'

const arr = [1, 2];
arr.valueOf(); // [1, 2]（对象本身）
arr.toString(); // '1,2'（等价于 join()）
[].toString(); // ''

const fn = function () {};
fn.toString(); // 'function () {}'（源码字符串）
```

普通对象的 `valueOf` 返回自身，所以 `ToPrimitive` 会继续走 `toString`。数组的 `toString` 调用 `join()`，默认分隔符为 `,`。

### 7.3.3 自定义转换：三种写法

```js
// 只覆盖 valueOf：数值场景生效
const money = {
  amount: 100,
  valueOf() {
    return this.amount;
  },
};
console.log(money + 1); // 101
console.log(money == 100); // true
console.log(`${money}`); // '[object Object]'
```

模板字符串是 `string` hint，先找 `toString()`；只覆盖 `valueOf` 时拿不到 `100`。

```js
// 只覆盖 toString：字符串场景生效
const user = {
  name: 'Tom',
  toString() {
    return `User(${this.name})`;
  },
};
console.log(`${user}`); // 'User(Tom)'
console.log(user + ''); // 'User(Tom)'（default → valueOf 返回对象 → toString）
console.log(String(user)); // 'User(Tom)'
console.log(user + 1); // 'User(Tom)1'
```

```js
// Symbol.toPrimitive：优先级最高，能直接拿到 hint
const smart = {
  [Symbol.toPrimitive](hint) {
    if (hint === 'number') return 42;
    if (hint === 'string') return 'smart';
    return 'default';
  },
};
console.log(+smart); // 42
console.log(`${smart}`); // 'smart'
console.log(smart + ''); // 'default'
console.log(smart == 42); // false（'default' == 42）
```

### 7.3.4 失败情况

```js
const bare = Object.create(null); // 没有原型，也就没有 valueOf / toString
bare + ''; // TypeError: Cannot convert object to primitive value
bare == 1; // TypeError
String(bare); // TypeError
```

---

## 7.4 十道经典"鬼畜"比较题

### 题 1：`[] == ![]`

```
[] == ![]
→ [] == false      （![] 为 false）
→ [] == 0          （false → 0）
→ '' == 0          （[].toString() = ''）
→ 0 == 0
→ true
```

### 题 2：`{} == !{}`

```
{} == !{}
→ {} == false      （!{} 为 false）
→ {} == 0
→ '[object Object]' == 0   （valueOf 返回对象 → toString）
→ NaN == 0
→ false
```

语句开头的 `{} == !{}` 会把 `{}` 解析成代码块，`==` 无法作为语句开头，抛 `SyntaxError: Unexpected token '=='`；加括号写成 `({} == !{})` 才是表达式。

### 题 3：`[] + {}` 和 `{} + []`

```js
[] + {}; // '[object Object]'（'' + '[object Object]'）
({}) + []; // '[object Object]'
{} + []; // 0（语句开头 {} 是空代码块，实际执行 +[]）
```

### 题 4：`[1,2] + [3,4]`

```js
[1, 2] + [3, 4]; // '1,23,4'
```

两边都走 `toString`，得到 `'1,2'` 和 `'3,4'`，再做字符串拼接。

### 题 5：`'5' - 2` 和 `'5' + 2`

```js
'5' - 2; // 3（- 只有数值语义）
'5' + 2; // '52'（+ 有字符串语义）
'5' * '2'; // 10
'5' / '2'; // 2.5
```

### 题 6：`null == 0` vs `null >= 0`

```js
null == 0; // false（== 不转换 null）
null >= 0; // true（>= 走 ToNumber(null) = 0）
null > 0; // false
null < 1; // true
```

`==` 用抽象相等，关系运算用 `ToPrimitive(number)` 后转数字，两套算法。

### 题 7：`NaN == NaN` 与 `NaN != NaN`

```js
NaN == NaN; // false
NaN === NaN; // false
NaN != NaN; // true
Object.is(NaN, NaN); // true
```

### 题 8：`new Number(1) == 1`

```js
new Number(1) == 1; // true（对象走 ToPrimitive → valueOf() 返回 1）
new Number(1) === 1; // false
typeof new Number(1); // 'object'
```

### 题 9：`' \t\n' == 0`

```js
' \t\n' == 0; // true
Number(' \t\n'); // 0（String → Number 会去掉首尾空白）
```

### 题 10：`0.1 + 0.2 == 0.3`

```js
0.1 + 0.2 === 0.3; // false
0.1 + 0.2; // 0.30000000000000004
Math.abs(0.1 + 0.2 - 0.3) < Number.EPSILON; // true
```

这是 IEEE 754 双精度表示问题，不是类型转换。`Number.EPSILON` 是 `2 ** -52 ≈ 2.22e-16`，即 1 与下一个可表示数的间隔；差值小于它只在这个量级成立，量级远离 1 时要按相对误差比较。

---

## 7.5 让 a==1 && a==2 && a==3 成立

### 7.5.0 一句话结论

`==` 在对象与数字比较时调用 `ToPrimitive(a, "default")`，普通对象先走 `valueOf`。让 `valueOf` 每次返回递增的值即可。`===` 不做类型转换，所以必然失败。

### 7.5.1 方案一：`valueOf` + 计数器

```js
const a = {
  value: 1,
  valueOf() {
    return this.value++;
  },
};

console.log(a == 1 && a == 2 && a == 3); // true
```

推导过程：

```
a == 1
  ↓ 对象 vs 数字 → ToPrimitive(a, "default")
  ↓ 没有 Symbol.toPrimitive → 先调 valueOf()
  ↓ valueOf 返回 1，this.value 变成 2
1 == 1 → true

a == 2
  ↓ 再调 valueOf() → 返回 2，this.value 变成 3
2 == 2 → true

a == 3
  ↓ 再调 valueOf() → 返回 3
3 == 3 → true
```

`valueOf` 必须是普通方法，不能用箭头函数，因为要用 `this.value`。

### 7.5.2 方案二：`Symbol.toPrimitive`

```js
let i = 1;
const a = {
  [Symbol.toPrimitive]() {
    return i++;
  },
};

console.log(a == 1 && a == 2 && a == 3); // true
```

`Symbol.toPrimitive` 优先于 `valueOf` / `toString`，且能直接拿到 `hint`。

### 7.5.3 方案三：数组的 `toString` + `shift`

```js
const a = [1, 2, 3];
a.join = a.shift;

console.log(a == 1 && a == 2 && a == 3); // true
```

推导过程：

```
a == 1
  ↓ ToPrimitive(a, "default")
  ↓ a.valueOf() 返回数组本身（不是原始值）
  ↓ 落到 a.toString()
  ↓ Array.prototype.toString 取 this.join 并调用（无参数）
  ↓ 但 a.join 已被换成 a.shift
  ↓ a.shift() 弹出第一个元素 1，并返回 1
1 == 1 → true
```

这个方案依赖 `Array.prototype.toString` 调用 `this.join` 这一细节。

### 7.5.4 方案四：Proxy 拦截

```js
let i = 1;
const a = new Proxy(
  {},
  {
    get(target, key) {
      if (key === Symbol.toPrimitive) return () => i++;
      return target[key];
    },
  },
);

console.log(a == 1 && a == 2 && a == 3); // true
```

计数器必须定义在 `get` 外面：每次比较都会重新读取 `Symbol.toPrimitive`，写在 `get` 里会每次新建闭包，始终返回 1。

### 7.5.5 方案五：全局 getter

```js
let i = 0;
Object.defineProperty(globalThis, 'a', {
  get() {
    return ++i;
  },
  configurable: true,
});

console.log(a == 1 && a == 2 && a == 3); // true
```

这个方案不经过类型转换：读取全局标识符 `a` 时触发 getter，每次返回新值。若存在同名局部绑定，读到的是局部变量，不会是 getter。

### 7.5.6 为什么 `===` 不行

```js
const a = {
  value: 1,
  valueOf() {
    return this.value++;
  },
};

console.log(a === 1); // false ← 类型不同，=== 直接 false，不调用 valueOf
```

`===` 不做类型转换，对象永远不等于数字，所以题目必须用 `==`。

### 7.5.7 实际用途

`valueOf` / `Symbol.toPrimitive` 让对象参与数值运算，`toString` 负责字符串场景。

```js
// 金额对象：数值运算与字符串展示分离
class Money {
  constructor(cents) {
    this.cents = cents;
  }
  valueOf() {
    return this.cents;
  }
  toString() {
    return `¥${(this.cents / 100).toFixed(2)}`;
  }
}

const price = new Money(1999);
console.log(price + 1); // 2000
console.log(`${price}`); // '¥19.99'

// 版本号对象：把分段版本映射成可比较的数值
class Version {
  constructor(str) {
    this.parts = str.split('.').map(Number);
  }
  valueOf() {
    return this.parts.reduce((a, n) => a * 1000 + n, 0);
  }
}
console.log(new Version('1.2.3') > new Version('1.2.10')); // false
```

### 7.5.8 答题模板

- `==` 在「对象 vs 数字」时触发 `ToPrimitive(a, "default")`，普通对象先调 `valueOf`。
- 让 `valueOf` 返回递增值：`const a = { value: 1, valueOf() { return this.value++; } };`
- `===` 不转换类型，对象永远不等于数字。
- 其他实现：`Symbol.toPrimitive`（优先级高于 `valueOf`）、`a.join = a.shift`、Proxy 拦截 `Symbol.toPrimitive`、全局 getter。

---

## 7.6 隐式转换全景（补漏）

### 7.6.1 四个抽象操作

| 操作 | 作用 | 关键规则 |
|---|---|---|
| **`ToBoolean`** | 转布尔 | 规范定义 8 个假值，其余为 true |
| **`ToString`** | 转字符串 | 对象走 `ToPrimitive(hint="string")` |
| **`ToNumber`** | 转数字 | 对象走 `ToPrimitive(hint="number")`；字符串先 trim，非法则 `NaN` |
| **`ToPrimitive`** | 转原始值 | 见 7.3 |

8 个假值：

```js
false, 0, -0, 0n, '', null, undefined, NaN;
```

容易判断错的真值：

```js
Boolean('0'); // true（非空字符串）
Boolean(' '); // true（空格也是非空）
Boolean([]); // true（空数组是真值）
Boolean({}); // true（空对象是真值）
Boolean(function () {}); // true
Boolean(-1); // true
Boolean(Infinity); // true
```

空数组和空对象不是假值，所以 `if ([]) {}` 会进分支，`if (![])` 是 `false`。

### 7.6.2 `+` 运算符的两义性

```
x + y
  ↓
px = ToPrimitive(x, "default")
py = ToPrimitive(y, "default")
  ↓
px 或 py 是 String → 字符串拼接
否则 → 数值相加（BigInt 与 Number 混用抛 TypeError）
```

```js
1 + 2; // 3
1 + '2'; // '12'
1 + true; // 2
1 + null; // 1
1 + undefined; // NaN
1 + {}; // '1[object Object]'
1 + []; // '1'
[] + []; // ''
[] + {}; // '[object Object]'
[1] + [2]; // '12'
```

### 7.6.3 其他运算符

```js
// 减法、乘法、除法、取模：只有数值语义，全部 ToNumber
'6' - '2'; // 4
'6' * '2'; // 12
'6' / '2'; // 3
'6' % '4'; // 2
true - 1; // 0
null - 1; // -1
undefined - 1; // NaN

// 一元 +：ToNumber
+'123'; // 123
+''; // 0
+'  12  '; // 12（trim）
+'0x10'; // 16
+'1e3'; // 1000
+[]; // 0
+[1]; // 1
+[1, 2]; // NaN（'1,2' 转数字失败）
+{}; // NaN
+true; // 1
+null; // 0
+undefined; // NaN

// 一元 !：ToBoolean 后取反
![]; // false
!{}; // false
!'0'; // false
!![]; // true

// 关系运算：ToPrimitive(hint="number")，两边都是字符串时按码点比较
'10' < '9'; // true
10 < 9; // false
'10' < 9; // false（'10' → 10）
[2] < [11]; // false（'2' 与 '11' 按字典序比较）
```

`[2] < [11]` 的 hint 是 `number`，但数组的 `valueOf` 返回对象，最终落到 `toString`，结果仍是字符串 `'2'` / `'11'`。

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

### 7.6.5 判断路径

- 先判两边类型。
- 按运算符选算法：`==` 走抽象相等；`+` 先 `ToPrimitive(default)` 再判字符串；其他算术走 `ToNumber`；关系运算走 `ToPrimitive(number)`。
- 对象先 `ToPrimitive`：`default` 按 number 顺序，`Date` 的 `default` 按 string。

---

## 7.7 本册答题模板汇总

两题共用一条底层路径：

- 第 30 题考规则：`==` 在对象与原始值比较时调用 `ToPrimitive(obj, "default")`。
- 第 20 题考入口：`valueOf` / `Symbol.toPrimitive` 返回递增值，让每次比较得到不同结果。

---

## 7.8 速记卡与连环追问

### 7.8.1 速记卡

- 相等：`===` 比较类型和值；`Object.is` 认 `NaN` 相等、区分 `±0`；`SameValueZero` 两者都认。
- `==`：同类型退化成 `===`；`null`/`undefined` 只和对方相等；其余转数字；BigInt 与字符串转 BigInt，与数字按数学值比较。
- `ToPrimitive`：`Symbol.toPrimitive` > `valueOf`/`toString`；`default` 按 number 顺序（Date 按 string）。
- 高频陷阱：`null == 0` false 但 `null >= 0` true；`'' == '0'` false；`[]`、`{}` 是真值。
- 第 20 题：让 `valueOf` 返回递增值；`===` 不转换，必然失败。

### 7.8.2 连环追问

| # | 追问 | 关键答点 |
|---|---|---|
| 1 | `==` 和 `===` 区别？ | 类型不同时是否转换 |
| 2 | `NaN === NaN`？ | `false` |
| 3 | `+0 === -0`？ | `true` |
| 4 | `Object.is` 和 `===` 差异？ | `NaN` 相等、`+0/-0` 不等 |
| 5 | `null == 0` / `null >= 0`？ | `false` / `true`（两套算法） |
| 6 | `0 == ''`？`'' == '0'`？ | `true` / `false`（`==` 无传递性） |
| 7 | `[] == false`？ | `true`（`[]` → `''` → `0`） |
| 8 | `2 == true`？ | `false`（比的是 `2 == 1`） |
| 9 | 什么时候用 `==`？ | `value == null` |
| 10 | `ToPrimitive` 的 hint？ | `default` / `number` / `string` |
| 11 | `default` 先调谁？ | 普通对象先 `valueOf`；Date 按 `toString` |
| 12 | `Symbol.toPrimitive` 优先级？ | 最高，先于 `valueOf` / `toString` |
| 13 | `valueOf` 默认返回？ | 对象本身，所以继续走 `toString` |
| 14 | `Array.prototype.toString` 依赖？ | `this.join()`，默认分隔符 `,` |
| 15 | `[] + {}` / `{} + []`？ | `'[object Object]'` / `0`（语句开头 `{}` 是代码块） |
| 16 | `'5' - 2` / `'5' + 2`？ | `3` / `'52'` |
| 17 | `+' 12 '` / `+[1,2]`？ | `12` / `NaN` |
| 18 | 8 个假值？ | `false 0 -0 0n '' null undefined NaN` |
| 19 | `[]` 是真值还是假值？ | 真值 |
| 20 | BigInt 怎么比？ | `1n == 1`、`1n == '1'` 为 true；`1n == 1.5` 为 false；`1n + 1` 抛 TypeError |
| 21 | `a==1 && a==2 && a==3` 怎么实现？ | `valueOf` 或 `Symbol.toPrimitive` 返回递增值 |
| 22 | 为什么不能用 `===`？ | `===` 不转换，对象与数字恒 false |
| 23 | `valueOf` 能用箭头函数吗？ | 不能，需要 `this` 访问计数器 |
| 24 | 数组方案为什么能成立？ | `Array.prototype.toString` 取 `this.join`，把 `join` 换成 `shift` |
| 25 | `toString` 能行吗？ | 能，返回值须是原始值；`==` 再按规则转数字 |
| 26 | 实际用途？ | 金额、版本号等对象支持运算与比较 |
| 27 | `0.1 + 0.2 == 0.3`？ | `false`，IEEE 754 精度问题，不是类型转换 |
