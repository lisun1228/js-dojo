# JS · 01 类型判断与类型转换

> 本册覆盖：`==` vs `===`、类型转换、浮点数、`typeof`、`instanceof`、`null` vs `undefined`、`NaN`
> 题单给的答案都只有一句话。**但这一块是 JS 面试最容易被追问到「底层」的地方**——因为所有反直觉的行为都能从规范的抽象操作解释。
> **本册所有输出都在 Node 22 上实际跑过。**

---

## 目录

- [1.1 一句话结论](#11-一句话结论)
- [1.2 `==` 的完整规则](#12--的完整规则)
- [1.3 `===` 与 `Object.is`](#13--与-objectis)
- [1.4 浮点数精度](#14-浮点数精度)
- [1.5 `typeof`](#15-typeof)
- [1.6 `instanceof`](#16-instanceof)
- [1.7 `null` vs `undefined`](#17-null-vs-undefined)
- [1.8 `NaN`](#18-nan)
- [1.9 `ToPrimitive`：对象怎么转原始值](#19-toprimitive对象怎么转原始值)
- [1.10 常见坑](#110-常见坑)
- [1.11 答题模板](#111-答题模板)
- [1.12 速记卡](#112-速记卡)

---

## 1.1 一句话结论

JS 的类型转换由规范的**抽象操作**控制：`ToPrimitive` / `ToNumber` / `ToString` / `ToBoolean`。
记住三条主线：
**① `==` 只在「同类型」和「null/undefined 互相」时不用转换，其余都转数字；② 对象转原始值先 `valueOf` 再 `toString`（`Date` 例外，先 `toString`）；③ 浮点数用 IEEE 754 双精度，`0.1` 在二进制里是无限循环小数。**

---

## 1.2 `==` 的完整规则

### 1.2.1 题单的答案只说了 20%

> 原文：「`==` 相等，会隐式转换；`===` 严格相等，类型不同直接 false。」

**这只是描述了现象，没给规则。** 面试官追问一句「`[] == ![]` 为什么是 true」就答不上来。

### 1.2.2 规范的 7 条规则（必须背下来）

`x == y` 的判定顺序（简化自 ECMA-262 的 `IsLooselyEqual`）：

| # | 条件 | 行为 |
|---|---|---|
| 1 | **类型相同** | 退化成 `===`（`NaN` 例外，`NaN == NaN` 是 false） |
| 2 | **`null` 和 `undefined`** | **互相相等，且只和对方相等**（`null == undefined` → true） |
| 3 | **一个是数字，一个是字符串** | 字符串 → 数字 |
| 4 | **一个是布尔** | 布尔 → 数字（`true`→1，`false`→0），然后重新走流程 |
| 5 | **一个是对象，一个是原始值** | 对象 → `ToPrimitive`，然后重新走流程 |
| 6 | **一个是 `BigInt`，一个是字符串** | 字符串 → BigInt |
| 7 | **其他所有组合** | **`false`**（包括 `null == 0`、`undefined == 0`） |

**第 2 条和第 7 条是核心**：`null` / `undefined` 是「特权的」——它们只和对方相等，**不参与数字转换**。

### 1.2.3 逐条验证（Node 22 实测）

```js
// 规则 2：null / undefined 只和对方相等
null == undefined        // true
null == 0                // false  ← 注意！不转数字
null == ''               // false
null == false            // false
undefined == 0           // false
undefined == ''          // false
undefined == false       // false

// 但关系运算符会转数字（这是最容易错的地方）
null >= 0                // true   ← 因为 >= 用的是 ToNumber(null) = 0
null > 0                 // false
null >= 0 && null == 0   // false  ← 两件事不矛盾：>= 转数字，== 不转

// 规则 3 + 4：布尔先转数字
'' == 0                  // true   （'' → 0）
'0' == false             // true   （false → 0，'0' → 0）
'  ' == 0                // true   （空白字符串 → 0）

// 规则 5：对象转原始值
[1] == 1                 // true   （[1].toString() = '1' → 1）
[1, 2] == '1,2'          // true   （[1,2].toString() = '1,2'）
[] == 0                  // true   （[].toString() = '' → 0）
[] == ![]                // true   ★ 经典题，见下

// 但 [null] 和 null 不同
[null] == 0              // true   （[null].toString() = '' → 0）
[null] == null           // false  （[null] 是对象，走规则 5 → '' ，'' == null 走规则 7 → false）
[undefined] == 0         // true   （同上，[undefined].toString() = ''）
```

### 1.2.4 `[] == ![]` 为什么是 `true`（必考题逐行拆）

```js
[] == ![]
```

**第一步：算右边 `![]`**

`[]` 是对象，`ToBoolean` 对**所有对象**都返回 `true`（包括空数组、空对象、`new Boolean(false)`）。
所以 `![]` = `!true` = **`false`**。

现在问题变成 `[] == false`。

**第二步：应用规则 4（一个是布尔）**

`false` → `0`。问题变成 `[] == 0`。

**第三步：应用规则 5（一个是对象）**

`[]` → `ToPrimitive([])`：
- 先调 `[].valueOf()` → 返回数组本身（还是对象），不是原始值
- 再调 `[].toString()` → `''`（空数组的 toString 是空字符串）
- 得到 `''`

问题变成 `'' == 0`。

**第四步：应用规则 3（字符串 vs 数字）**

`''` → `Number('')` → `0`。问题变成 `0 == 0` → **`true`** ✅

```
[] == ![]
→ [] == false         （![] 是 false）
→ [] == 0             （false → 0）
→ '' == 0             （[].toString() = ''）
→ 0 == 0              （Number('') = 0）
→ true
```

> **面试话术**：「`[] == ![]` 是 true。四步：`![]` 是 `false`，因为所有对象转布尔都是 true；然后 `false` 转数字变 0；再然后 `[]` 转原始值，`valueOf` 返回对象本身不算，所以走 `toString` 得到空字符串；最后空字符串转数字是 0，0 == 0 成立。」

### 1.2.5 二十道速算题（自己先答再看）

| 表达式 | 结果 | 原因 |
|---|---|---|
| `null == undefined` | ✅ true | 规则 2 |
| `null === undefined` | ❌ false | 类型不同 |
| `null == 0` | ❌ false | 规则 7（特权） |
| `null >= 0` | ✅ true | `>=` 用 ToNumber |
| `undefined == 0` | ❌ false | 规则 7 |
| `NaN == NaN` | ❌ false | 规则 1 的例外 |
| `'' == 0` | ✅ true | 规则 3 |
| `'' == false` | ✅ true | `false`→0，`''`→0 |
| `'1' == true` | ✅ true | `'1'`→1，`true`→1 |
| `[] == false` | ✅ true | `[]`→`''`→0 |
| `[] == ![]` | ✅ true | 见 1.2.4 |
| `[1] == 1` | ✅ true | `[1]`→`'1'`→1 |
| `[1,2] == '1,2'` | ✅ true | toString |
| `[null] == 0` | ✅ true | `[null]`→`''`→0 |
| `[null] == null` | ❌ false | `''` vs null |
| `[undefined] == 0` | ✅ true | 同上 |
| `{} == {}` | ❌ false | 引用比较 |
| `[] == []` | ❌ false | 引用比较 |
| `[] + []` | `''` | 两个都 toString 再拼 |
| `[] + {}` | `'[object Object]'` | `''` + `'[object Object]'` |
| `1 + '1'` | `'11'` | `+` 有字符串就拼接 |
| `'1' - 1` | `0` | `-` 只能数字，`'1'`→1 |
| `true + 1` | `2` | `true`→1 |

**⚠️ 一个语法坑**：

```js
{} + []      // 0     ← 在语句开头，{} 被当成「块」，实际执行的是 +[]
[] + {}      // '[object Object]'   ← 在表达式位置，正常相加
({}) + []    // '[object Object]'   ← 加括号强制当表达式
```

### 1.2.6 什么时候可以放心用 `==`

**唯一推荐的场景：判断 `null` / `undefined`**。

```js
// ✅ 推荐：一行同时判断两者
if (x == null) { /* x 是 null 或 undefined */ }

// ❌ 等价但啰嗦
if (x === null || x === undefined) { }
```

**这也是 ESLint 的 `eqeqeq` 规则唯一允许的例外**（`{ null: 'ignore' }`）。

---

## 1.3 `===` 与 `Object.is`

### 1.3.1 三者的差异表

| 场景 | `==` | `===` | `Object.is` |
|---|---|---|---|
| `NaN` vs `NaN` | false | false | **true** ✅ |
| `0` vs `-0` | true | true | **false** ✅ |
| `null` vs `undefined` | **true** | false | false |
| `'1'` vs `1` | **true** | false | false |
| `[1]` vs `1` | **true** | false | false |

**`Object.is` 只在这两个地方和 `===` 不同**：

```js
Object.is(NaN, NaN)   // true    ← === 是 false
Object.is(0, -0)      // false   ← === 是 true
```

**规范里 `Object.is` 用的是 `SameValue`，`===` 用的是 `IsStrictlyEqual`，`Map`/`Set`/`includes` 用的是第三个 `SameValueZero`。**

### 1.3.2 三个相等算法（这是进阶加分点）

| 算法 | `NaN` 等于自己？ | `0` 等于 `-0`？ | 用在 |
|---|---|---|---|
| **`IsStrictlyEqual`**（`===`） | ❌ | ✅ | `===`、`switch`、`indexOf` |
| **`SameValue`**（`Object.is`） | ✅ | ❌ | `Object.is` |
| **`SameValueZero`** | ✅ | ✅ | `Map`、`Set`、`includes`、`Array.prototype.includes` |

**实测验证**：

```js
[NaN].indexOf(NaN)          // -1     ← indexOf 用 ===
[NaN].includes(NaN)         // true   ← includes 用 SameValueZero
new Map([[NaN, 1]]).get(NaN) // 1     ← Map 用 SameValueZero
new Set([0, -0]).size        // 1     ← Set 用 SameValueZero，合并了
```

**这张表能解释一大类「为什么 `indexOf` 找不到 `NaN`」的问题。**

---

## 1.4 浮点数精度

### 1.4.1 题单的解法不通用（必须纠正）

> 原文：「浮点数二进制精度问题。解决：`Math.round((0.1+0.2)*10)/10`。」

**这个解法只对「1 位小数」有效。** 实测：

```js
Math.round((0.1 + 0.2) * 10) / 10
// 0.3 ✅ 碰巧对了

Math.round((0.123456 + 0.000001) * 10) / 10
// 0.1 ❌ 期望 0.123457，结果差了两个数量级！
```

**根因**：乘 10 再除 10 等于「保留 1 位小数」，它把 `0.123457` 四舍五入成 `0.1` 了。这不是修复精度，这是**丢精度**。

### 1.4.2 为什么 `0.1 + 0.2 !== 0.3`

**JS 的 `number` 是 IEEE 754 双精度（64 位）**：

```
┌─────┬──────────────┬────────────────────────────────────┐
│ 1 位 │   11 位       │              52 位                  │
│ 符号 │   指数         │            尾数（有效数字）           │
└─────┴──────────────┴────────────────────────────────────┘
```

**关键限制**：尾数只有 52 位（加隐含的 1 位共 53 位有效数字）。

`0.1` 的二进制是**无限循环小数**：

```
0.1₁₀ = 0.00011001100110011001100110011001100110011...₂
        （1100 无限循环）
```

**实测 `(0.1).toString(2)` 前 60 位**：

```
0.0001100110011001100110011001100110011001100110011001101
```

**第 53 位之后被截断（四舍五入）**，所以 `0.1` 存进去就已经不是精确的 0.1 了。

```
0.1 实际存的 ≈ 0.1000000000000000055511151231257827
0.2 实际存的 ≈ 0.2000000000000000111022302462515654
相加        ≈ 0.3000000000000000444089209850062616
0.3 实际存的 ≈ 0.2999999999999999888977697537484346
        ↑ 不相等
```

**所以 `0.1 + 0.2` 得到 `0.30000000000000004`**（实测）。

### 1.4.3 四种正确的解法

#### ① 整数化（金额场景首选）

```js
// 金额以「分」为单位存，展示时除以 100
const total = (10 + 20) / 100;   // 0.3 ✅
```

**这是最可靠的做法**——从数据源头就避免小数运算。

#### ② 按最大小数位数放大

```js
function add(...nums) {
  const maxDigits = Math.max(
    ...nums.map((n) => (String(n).split('.')[1] ?? '').length)
  );
  const factor = 10 ** maxDigits;
  return nums.reduce((sum, n) => sum + Math.round(n * factor), 0) / factor;
}

add(0.1, 0.2);              // 0.3 ✅
add(0.123456, 0.000001);    // 0.123457 ✅（题单方案在这里失败）
```

**注意 `Math.round(n * factor)`**：先转整数再加，避免小数相加累积误差。

#### ③ `toFixed` 格式化（只用于显示）

```js
(0.1 + 0.2).toFixed(2);     // '0.30'
```

**⚠️ 但 `toFixed` 自己有坑**：

```js
(1.005).toFixed(2)          // '1.00' ❌ 期望 '1.01'
```

**原因**：`1.005` 实际存的是 `1.00499999999999989...`，四舍五入到 2 位就是 `1.00`。**这是 `toFixed` 用「银行家舍入 + 二进制」的必然结果。**

正确做法：

```js
// 用 EPSILON 修正
function toFixedFix(n, digits) {
  const factor = 10 ** digits;
  return (Math.round((n + Number.EPSILON) * factor) / factor).toFixed(digits);
}
toFixedFix(1.005, 2);       // '1.01' ✅
```

#### ④ 用误差范围比较（浮点数比较的标准做法）

```js
function isEqual(a, b, epsilon = Number.EPSILON) {
  return Math.abs(a - b) < epsilon;
}

isEqual(0.1 + 0.2, 0.3);    // true ✅
```

**`Number.EPSILON` 是 `2 ** -52 ≈ 2.22e-16`**，两个可表示的浮点数之间的最小间隔。

**⚠️ 但对大数不能用固定 EPSILON**：

```js
Math.abs(1e20 + 1 - 1e20) < Number.EPSILON   // false
// 1e20 + 1 === 1e20（因为 1 远小于 1e20 的精度间隔）
```

**更稳的写法**（相对误差）：

```js
function nearlyEqual(a, b, relTol = 1e-9) {
  const diff = Math.abs(a - b);
  if (diff === 0) return true;
  return diff < Math.max(relTol * Math.max(Math.abs(a), Math.abs(b)), Number.EPSILON);
}
```

#### ⑤ 用成熟库

| 库 | 特点 |
|---|---|
| **`decimal.js`** | 任意精度十进制，功能全 |
| **`big.js`** | 轻量（~3KB） |
| **`bignumber.js`** | 精度可配置 |
| **`mathjs`** | 功能最全，体积大 |

### 1.4.4 一个反直觉的实测结果

```js
0.1 + 0.7    // 0.7999999999999999  ← 不是 0.8！
0.1 + 0.3    // 0.4                 ← 这个就对了
0.2 + 0.4    // 0.6000000000000001  ← 这个又不对
```

**为什么有的对有的不对？** 因为误差是否「恰好被舍入抵消」是偶然的，不能靠猜。

---

## 1.5 `typeof`

### 1.5.1 八种返回值的完整实测

| 值 | `typeof` | `Object.prototype.toString.call()` |
|---|---|---|
| `'a'` | `'string'` | `'[object String]'` |
| `1` | `'number'` | `'[object Number]'` |
| `true` | `'boolean'` | `'[object Boolean]'` |
| `undefined` | `'undefined'` | `'[object Undefined]'` |
| **`null`** | **`'object'`** ⚠️ | **`'[object Null]'`** ✅ |
| `Symbol()` | `'symbol'` | `'[object Symbol]'` |
| `1n` | `'bigint'` | `'[object BigInt]'` |
| `() => {}` | `'function'` | `'[object Function]'` |
| `[]` | `'object'` | `'[object Array]'` ✅ |
| `{}` | `'object'` | `'[object Object]'` |
| `new Date()` | `'object'` | `'[object Date]'` ✅ |
| `/a/` | `'object'` | `'[object RegExp]'` ✅ |
| `new Map()` | `'object'` | `'[object Map]'` ✅ |

**结论**：
- `typeof` 只能可靠区分**原始类型**和 `function`
- 要区分具体的对象类型（Array/Date/RegExp/Map），用 **`Object.prototype.toString.call()`**

### 1.5.2 `typeof null === 'object'` 的真实原因（能答出来很加分）

**这不是设计失误，是 1995 年第一个 JS 引擎的 bug。**

当时的实现用「**类型标签 + 值**」的方式表示值，值的低位用来存类型标签：

```
000  对象
1    整数（31 位带符号整数，用值本身存）
010  双精度浮点
100  字符串
110  布尔
```

**`null` 被实现为空指针（`NULL`，即全 0）**，而它的类型标签正好是 `000`——和「对象」一样。所以 `typeof null` 返回 `'object'`。

**为什么没修**：1996 年有人提出修复，但当时已经有大量网站依赖这个行为（比如用 `typeof x === 'object'` 检测 DOM），改了会破坏兼容性。所以 **Brendan Eich 在提案里被拒绝了**，这个 bug 一直保留到今天。

> 面试话术：「`typeof null === 'object'` 是 1995 年第一个 JS 引擎的 bug。它用值的低位做类型标签，`000` 表示对象，而 `null` 是空指针（全 0），标签位正好也是 `000`。后来想修，但已经有网站依赖这个行为，改了就破坏兼容，所以留到现在。要准确判断 null 只能 `x === null`。」

### 1.5.3 `typeof` 的三个额外坑

```js
// ① 未声明变量不会报错（这是 typeof 的特权）
typeof notDefined      // 'undefined'  ✅（直接访问 notDefined 会 ReferenceError）

// ② TDZ 里的 let 会报错
typeof x;              // ReferenceError: Cannot access 'x' before initialization
let x = 1;

// ③ 函数声明和函数表达式都是 'function'
typeof function() {}   // 'function'
typeof class {}        // 'function'  ← class 也是 function！
typeof (() => {})      // 'function'
```

**第 ② 条特别坑**：`typeof` 只对「未声明的变量」安全，对「TDZ 中的 `let`/`const`」照样抛错。

### 1.5.4 一个更可靠的类型判断函数

```js
function getType(v) {
  // 处理 null 和 undefined
  if (v === null) return 'null';
  if (v === undefined) return 'undefined';
  // 原始类型走 typeof
  const t = typeof v;
  if (t !== 'object' && t !== 'function') return t;
  // 对象走 toString
  return Object.prototype.toString.call(v).slice(8, -1).toLowerCase();
}

getType(null);           // 'null'
getType([]);             // 'array'
getType(new Date());     // 'date'
getType(/a/);            // 'regexp'
getType(new Map());      // 'map'
getType(1);              // 'number'
```

**`slice(8, -1)` 的作用**：把 `'[object Array]'` 切成 `'Array'`，再转小写。

---

## 1.6 `instanceof`

### 1.6.1 原理：沿原型链查找

```
obj instanceof Ctor
    ↓
取 obj.__proto__（即 [[Prototype]]）
    ↓ 是不是 === Ctor.prototype？
    ├─ 是 → true
    └─ 否 → 继续取 __proto__.__proto__ ... 直到 null
                                    ↓
                              null → false
```

**实现见 10 册（手写 instanceof）。**

### 1.6.2 四个限制（面试常追问）

```js
// ① 原始值永远 false
1 instanceof Number          // false  ← 原始值没有原型链
new Number(1) instanceof Number  // true

// ② 不能跨 iframe / 不同的全局环境
// 因为每个 realm 有独立的 Array.prototype

// ③ 可以被 Symbol.hasInstance 改写
class Even {
  static [Symbol.hasInstance](n) { return n % 2 === 0; }
}
2 instanceof Even            // true   ← 完全自定义了

// ④ 原型可以被改，instanceof 结果会变
function F() {}
const o = new F();
F.prototype = {};            // 换掉原型
o instanceof F;              // false  ← 现在是 false 了
```

**第 ④ 条是「为什么不要随便改 prototype」的原因之一。**

### 1.6.3 `typeof` vs `instanceof`（完整答法）

| | `typeof` | `instanceof` |
|---|---|---|
| 判断什么 | **值的类型**（原始类型 + function） | **对象的原型链上有没有某个 prototype** |
| 操作数 | 任意值 | 左边必须是对象（原始值直接 false） |
| 返回 | 字符串（8 种） | 布尔 |
| 能否判断数组 | ❌（返回 `'object'`） | ✅ `[] instanceof Array` |
| 能否判断 null | ❌（返回 `'object'`） | ❌（`null instanceof X` 恒 false） |
| 能否跨 realm | ✅ | ❌ |
| 能否被伪造 | ❌ | ✅（改 prototype / `Symbol.hasInstance`） |

**最佳实践**：

```js
// 判断原始类型 → typeof
typeof x === 'string'

// 判断数组 → Array.isArray（比 instanceof 可靠，能跨 realm）
Array.isArray(x)

// 判断某个类的实例 → instanceof
x instanceof Date

// 判断 null → === null
x === null
```

---

## 1.7 `null` vs `undefined`

### 1.7.1 六个维度对比

| 维度 | `null` | `undefined` |
|---|---|---|
| **语义** | 「**有意的空值**」（我主动设成空） | 「**未定义**」（还没赋值 / 不存在） |
| **`typeof`** | `'object'` ⚠️ | `'undefined'` |
| **`ToNumber`** | `0` | **`NaN`** |
| **`ToString`** | `'null'` | `'undefined'` |
| **`ToBoolean`** | `false` | `false` |
| **是否显式赋值** | ✅ 一般显式 `x = null` | 变量声明未赋值 / 函数无返回 / 访问不存在属性 |
| **JSON** | 保留 | **被忽略**（`JSON.stringify({a:undefined})` → `'{}'`） |
| **默认参数** | **不触发** | **触发** |

**实测验证**：

```js
Number(null)         // 0
Number(undefined)    // NaN
null + 1             // 1
undefined + 1        // NaN
JSON.stringify({ a: null, b: undefined })   // '{"a":null}'
function f(x = 'default') { return x; }
f(null)              // null      ← 默认值不生效
f(undefined)         // 'default' ← 默认值生效
f()                  // 'default'
```

### 1.7.2 `undefined` 的六个来源

```js
// ① 声明未赋值
let a;                    // undefined

// ② 函数没有返回值
function f() {}           // f() === undefined

// ③ 函数调用时参数没传
function g(x) {}          // g() 里 x === undefined

// ④ 访问不存在的属性
({}).foo                  // undefined

// ⑤ 数组越界
[1, 2][5]                 // undefined

// ⑥ 显式 return undefined / void 0
function h() { return void 0; }
```

### 1.7.3 为什么不用 `undefined` 做「空值」

**社区约定：`null` 表示「有意的空」，`undefined` 表示「本来就没有」。**

```js
// ✅ 推荐
let user = null;              // 还没登录，主动设空
if (user === null) { ... }

// ❌ 不推荐
let user = undefined;         // 语义模糊：是没赋值还是主动设空？
```

**TS 里更明显**：`strictNullChecks` 下 `null` 和 `undefined` 是不同类型，混用会很痛苦。

---

## 1.8 `NaN`

### 1.8.1 五个必须知道的事实

```js
// ① 不等于自己（唯一这样的值）
NaN === NaN             // false
NaN !== NaN             // true

// ② typeof 是 number
typeof NaN              // 'number'

// ③ 任何涉及 NaN 的运算都是 NaN（除了这个例外）
NaN + 1                 // NaN
NaN * 0                 // NaN
NaN ** 0                // 1  ← ⚠️ 例外！任何数的 0 次方是 1

// ④ 它是全局对象上的一个属性，可以被覆盖（危险）
NaN = 1;                // 非严格下静默失败，严格下 TypeError
// 用 Number.NaN 更安全

// ⑤ 判断只能用 Number.isNaN 或 Object.is
Number.isNaN(NaN)       // true
Object.is(NaN, NaN)     // true
```

### 1.8.2 `isNaN` vs `Number.isNaN`（必问）

```js
isNaN('abc')            // true   ⚠️ 因为先 Number('abc') → NaN
isNaN('123')            // false  （'123' → 123）
isNaN('')               // false  （'' → 0）
isNaN(null)             // false  （null → 0）
isNaN(undefined)        // true   （undefined → NaN）

Number.isNaN('abc')     // false  ✅ 只判断「是不是真的 NaN」
Number.isNaN(NaN)       // true
Number.isNaN(undefined) // false
```

| | `isNaN(x)` | `Number.isNaN(x)` |
|---|---|---|
| 行为 | 先 `ToNumber(x)`，再判断结果是不是 NaN | **直接判断 x 是不是 NaN，不做转换** |
| 规范 | 老 API（ES1） | ES6 新增 |
| 推荐 | ❌ | ✅ |

**自己实现 `Number.isNaN`**：

```js
function isNaNStrict(v) {
  return typeof v === 'number' && v !== v;   // 只有 NaN 满足 v !== v
}
```

### 1.8.3 数组去重里 `NaN` 的坑

```js
[NaN, NaN].indexOf(NaN)        // -1     ← indexOf 用 ===
[NaN, NaN].includes(NaN)       // true   ← includes 用 SameValueZero
new Set([NaN, NaN]).size       // 1      ← Set 用 SameValueZero

// 所以用 indexOf 去重会把 NaN 全部丢掉
[NaN, NaN].filter((v, i, a) => a.indexOf(v) === i)   // []  ← 空数组！
```

**这就是「数组去重为什么推荐 `Set`」的硬理由**（详见 11 册）。

---

## 1.9 `ToPrimitive`：对象怎么转原始值

### 1.9.1 抽象操作的三步

```
对象 → 原始值（ToPrimitive(input, hint)）
    ↓
hint = 'default' | 'number' | 'string'
    ↓
① 如果对象有 Symbol.toPrimitive 方法 → 调用它，用返回值
② hint = 'string' → 先 toString 再 valueOf
③ 其他 hint → 先 valueOf 再 toString
④ 如果两个方法都返回对象 → TypeError
```

**`hint` 从哪来**：

| 场景 | hint |
|---|---|
| `+` 运算（除了 `+` 一侧是字符串） | `'default'` |
| 其他算术运算（`-` `*` `/` `%`）、比较（`>` `<`） | `'number'` |
| `String(x)`、模板字符串 | `'string'` |
| **`Date` 的所有 hint** | **`'default'` 被当成 `'string'`**（唯一例外！） |

### 1.9.2 默认的 `valueOf` / `toString`

| 对象 | `valueOf()` | `toString()` |
|---|---|---|
| `{}` | 对象本身 | `'[object Object]'` |
| `[]` | 对象本身 | `''` |
| `[1,2]` | 对象本身 | `'1,2'` |
| `function(){}` | 对象本身 | `'function(){}'` 源码 |
| `new Date()` | 毫秒数 | 日期字符串 |
| `new Number(1)` | `1` | `'1'` |

**关键：普通对象的 `valueOf` 返回自己（不是原始值），所以会继续走 `toString`。**

### 1.9.3 自定义转换

```js
const obj = {
  [Symbol.toPrimitive](hint) {
    if (hint === 'number') return 42;
    if (hint === 'string') return 'hello';
    return 'default';
  },
};

+obj            // 42        （hint='number'）
`${obj}`        // 'hello'   （hint='string'）
obj + ''        // 'default' （hint='default'）
String(obj)     // 'hello'
Number(obj)     // 42
```

**这是「让对象支持运算」的正式方式**，比改写 `valueOf` 更优先。

### 1.9.4 一个经典面试题

```js
const a = {
  i: 1,
  valueOf() { return this.i++; },
};
a == 1 && a == 2 && a == 3    // true ！
```

**`==` 会调 `ToPrimitive`（hint='default'），走 `valueOf`，每次自增。**

**三种实现**：

```js
// ① valueOf
const a1 = { i: 1, valueOf() { return this.i++; } };

// ② toString
const a2 = { i: 1, toString() { return this.i++; } };

// ③ Symbol.toPrimitive
const a3 = { i: 1, [Symbol.toPrimitive]() { return this.i++; } };
```

**注意：`===` 做不到**，因为 `===` 不做类型转换，对象和数字直接 false。

---

## 1.10 常见坑

| 坑 | 正确说法 |
|---|---|
| 说「`==` 会把两边都转成数字」 | ❌ `null`/`undefined` 是特权，**只和对方相等**；同类型时不转换 |
| 用 `Math.round(x*10)/10` 修复精度 | 只对 1 位小数有效，对 `0.123456+0.000001` 直接算错 |
| 用 `toFixed` 做精确舍入 | `(1.005).toFixed(2)` 是 `'1.00'`，不是 `'1.01'` |
| 用 `typeof` 判断数组 | ❌ 返回 `'object'`，要用 `Array.isArray` |
| 以为 `typeof null` 是设计失误 | 是 1995 年的实现 bug，但修了会破坏兼容 |
| 以为 `typeof` 对 TDZ 也安全 | ❌ 只对**未声明**的变量安全，TDZ 里的 `let` 照样 ReferenceError |
| 用 `isNaN` 判断 NaN | 它会先转数字，`isNaN('abc')` 也是 true；用 `Number.isNaN` |
| 以为 `NaN ** 0` 是 NaN | 是 `1`（任何数的 0 次方是 1） |
| 用 `indexOf` 查 `NaN` | 返回 -1，因为 `indexOf` 用 `===` |
| 以为 `instanceof` 能判断原始值 | `1 instanceof Number` 是 false |
| 以为 `null` 和 `undefined` 可互换 | `Number(null)=0` 但 `Number(undefined)=NaN`，JSON 里一个有值一个被忽略 |
| 以为 `{} + []` 是字符串拼接 | 语句开头 `{}` 被当块，实际是 `+[]` = 0 |

---

## 1.11 答题模板

### 30 秒版（`==` vs `===`）

> `===` 是严格相等，类型不同直接 false，类型相同则比较值（`NaN` 不等于自己、`0` 等于 `-0`）。
> `==` 会做类型转换，规则核心是三条：**同类型退化成 `===`**；**`null` 和 `undefined` 互相相等且只和对方相等**（不参与数字转换）；**其余组合一律转数字**（布尔先转 0/1，对象先 `ToPrimitive` 再转）。
> 所以 `null == 0` 是 false，但 `null >= 0` 是 true——因为 `>=` 用的是 ToNumber。
> 实践上统一用 `===`，唯一例外是 `x == null` 同时判断 null 和 undefined。

### 30 秒版（浮点数）

> `0.1 + 0.2 !== 0.3` 是因为 JS 的 number 是 IEEE 754 双精度，尾数只有 52 位加隐含 1 位共 53 位有效数字。而 0.1 的二进制是无限循环小数 `0.0001100110011...`，存进去时第 53 位之后被截断，所以 0.1 本身就是近似值，相加后误差累积到能被看到。
> 解法有三个层次：**金额场景直接用整数（单位用分）最可靠**；需要小数运算就按最大小数位数放大成整数再算；浮点比较用 `Math.abs(a-b) < Number.EPSILON` 或相对误差。
> 注意 `toFixed` 不能用来修精度——`(1.005).toFixed(2)` 是 `'1.00'` 不是 `'1.01'`。

### 2 分钟版（串起来讲，推荐）

> 我把这块分成「相等判断」「类型判断」「数值精度」三条线。
>
> **相等判断**有三个算法，很多人只知道前两个。`===` 用的 `IsStrictlyEqual`：`NaN` 不等于自己、`0` 等于 `-0`。`Object.is` 用的 `SameValue`：`NaN` 等于自己、`0` 不等于 `-0`——正好和 `===` 相反。还有第三个 `SameValueZero`，`Map`/`Set`/`includes` 用它，`NaN` 等于自己且 `0` 等于 `-0`。这就解释了为什么 `[NaN].indexOf(NaN)` 是 -1 但 `[NaN].includes(NaN)` 是 true。
>
> **`==` 的规则核心是三条**：同类型退化成 `===`；`null` 和 `undefined` 互相相等、且只和对方相等（所以 `null == 0` 是 false，但 `null >= 0` 是 true，因为 `>=` 用 ToNumber）；其余组合转数字——布尔先转 0/1，对象先 ToPrimitive 再转。`[] == ![]` 是经典题，四步：`![]` 是 false（所有对象转布尔都是 true）→ false 转 0 → `[].toString()` 是空串 → 空串转 0，0==0 成立。
>
> **类型判断**这块，`typeof` 有 8 种返回值，但只能可靠区分原始类型和函数，数组和 null 都返回 `'object'`。`typeof null === 'object'` 是 1995 年的实现 bug——用值的低位做类型标签，`000` 表示对象，而 null 是空指针全 0，标签位正好也是 000。想区分具体对象类型要用 `Object.prototype.toString.call()`。
>
> 判断 NaN 要注意 `isNaN` 和 `Number.isNaN` 的区别：前者会先调 `Number()` 转换，所以 `isNaN('abc')` 也是 true；后者只判断「是不是真的 NaN」。自己实现的话就是 `typeof v === 'number' && v !== v`。
>
> **数值精度**是因为 IEEE 754 双精度的尾数只有 53 位有效数字，而 0.1 的二进制是无限循环小数，存进去就已经是近似值了。修法要分层：金额用整数最可靠；小数运算按最大小数位放大成整数；浮点比较用 EPSILON 或相对误差。特别注意两个坑：`Math.round(x*10)/10` 只对 1 位小数有效，`toFixed` 也不能修精度——`(1.005).toFixed(2)` 是 `'1.00'`。

### 追问表

| 追问 | 回答要点 |
|---|---|
| `[] == ![]` 为什么 true | `![]`→false→0；`[]`→`''`→0；0==0 |
| `null == 0` 为什么 false | `null`/`undefined` 是特权，只和对方相等 |
| `null >= 0` 为什么 true | `>=` 用 ToNumber，`Number(null) = 0` |
| `Object.is` 和 `===` 差在哪 | `NaN`（is 为 true）、`±0`（is 为 false） |
| 三个相等算法是什么 | IsStrictlyEqual / SameValue / SameValueZero |
| 为什么 `includes` 能找到 NaN | 它用 SameValueZero |
| `typeof null` 为什么是 object | 1995 年低位类型标签 bug，`000` 既是 object 也是空指针 |
| `typeof` 能判断数组吗 | 不能，用 `Array.isArray` |
| `typeof` 对未声明变量会报错吗 | 不会，返回 `'undefined'`；但对 TDZ 里的 `let` 会报错 |
| `class` 的 typeof 是什么 | `'function'` |
| `isNaN` 和 `Number.isNaN` 区别 | 前者先 `Number()` 转换 |
| `Number(null)` 和 `Number(undefined)` | `0` / `NaN` |
| `null` 和 `undefined` 在 JSON 里 | null 保留，undefined 被忽略 |
| 默认参数什么时候生效 | 只在 `undefined` 时生效，`null` 不触发 |
| `0.1+0.2` 为什么不等 0.3 | 尾数 53 位，0.1 是无限循环二进制 |
| `toFixed` 有什么坑 | `(1.005).toFixed(2)` 是 `'1.00'` |
| `NaN ** 0` 是多少 | `1` |
| 怎么让对象支持 `+` 运算 | 实现 `Symbol.toPrimitive` 或 `valueOf` |
| `a == 1 && a == 2 && a == 3` 怎么实现 | `valueOf` 里自增（`===` 做不到） |

---

## 1.12 速记卡

```
三个相等算法
  IsStrictlyEqual（===）：NaN≠自己，0==-0
  SameValue（Object.is）：NaN==自己，0≠-0
  SameValueZero（Map/Set/includes）：NaN==自己，0==-0
  → [NaN].indexOf(NaN) = -1，[NaN].includes(NaN) = true

== 的 7 条规则
  ① 同类型 → 退化成 ===
  ② null/undefined 互相相等，且只和对方相等（特权，不转数字）
  ③ 数字 vs 字符串 → 字符串转数字
  ④ 有布尔 → 布尔转 0/1，重走
  ⑤ 有对象 → ToPrimitive，重走
  ⑥ BigInt vs 字符串 → 字符串转 BigInt
  ⑦ 其余全 false
  ★ null == 0 是 false，但 null >= 0 是 true（>= 用 ToNumber）
  ★ [] == ![] → false→0，''→0 → true

ToPrimitive
  hint: default（+）/ number（- * / 比较）/ string（String、模板）
  Date 的 default 被当 string（唯一例外）
  顺序：Symbol.toPrimitive > (valueOf, toString)
  普通对象 valueOf 返回自己 → 继续走 toString

typeof
  8 种：string number boolean undefined object function symbol bigint
  ★ typeof null === 'object'（1995 年低位标签 bug）
  ★ 数组也是 'object' → 用 Array.isArray
  ★ 对未声明变量安全；对 TDZ 的 let 报错
  ★ class 的 typeof 是 'function'
  精确类型：Object.prototype.toString.call(v).slice(8,-1)

NaN
  NaN !== NaN；typeof NaN === 'number'；NaN ** 0 === 1
  用 Number.isNaN（不转换）而不是 isNaN（先 Number()）
  手写：typeof v === 'number' && v !== v
  indexOf 找不到 NaN，includes 能找到

浮点数（IEEE 754 双精度，53 位有效数字）
  0.1 二进制是无限循环 → 存进去就近似
  ★ Math.round(x*10)/10 只对 1 位小数有效
  ★ (1.005).toFixed(2) === '1.00'
  解法：整数化（金额）/ 按最大小数位放大 / EPSILON 或相对误差 / decimal.js

null vs undefined
  Number: 0 vs NaN | JSON: 保留 vs 忽略 | 默认参数: 不触发 vs 触发
  null = 有意的空；undefined = 本来就没有
```
