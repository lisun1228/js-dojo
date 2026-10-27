# JS · 01 类型判断与类型转换

> 覆盖：`==` vs `===`、类型转换、浮点数、`typeof`、`instanceof`、`null` vs `undefined`、`NaN`
> 反直觉行为都能从规范的抽象操作解释。
> 输出以 Node 22 为准。

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
**① `==` 只在同类型和 `null`/`undefined` 互相比较时不转换，其余组合转数字（BigInt 与字符串转 BigInt）；② 对象转原始值先 `valueOf` 再 `toString`（`Date` 的 `default` hint 例外，按 `toString`）；③ 浮点数用 IEEE 754 双精度，`0.1` 的二进制是无限循环小数。**

---

## 1.2 `==` 的完整规则

### 1.2.1 一句话结论不够用

「`==` 会隐式转换，`===` 类型不同直接 false」只描述了现象，没有给出判定规则；`[] == ![]` 这类题必须落到规范条款。

### 1.2.2 规范的 7 条规则（必须背下来）

`x == y` 的判定顺序（简化自 ECMA-262 的 `IsLooselyEqual`）：

| # | 条件 | 行为 |
|---|---|---|
| 1 | **类型相同** | 退化成 `===`（`NaN` 例外，`NaN == NaN` 是 false） |
| 2 | **`null` 和 `undefined`** | **互相相等，且只和对方相等**（`null == undefined` → true） |
| 3 | **一个是数字，一个是字符串** | 字符串 → 数字 |
| 4 | **一个是布尔** | 布尔 → 数字（`true`→1，`false`→0），然后重新走流程 |
| 5 | **一个是对象，一个是原始值** | 对象 → `ToPrimitive`，然后重新走流程 |
| 6 | **一个是 `BigInt`，一个是字符串或数字** | 字符串 → BigInt；数字按数学值比较（`1n == 1` 为 true） |
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

// 关系运算符会转数字，与 == 不同
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

// 但 [null] 和 null 不同
[null] == 0              // true   （[null].toString() = '' → 0）
[null] == null           // false  （[null] 是对象，走规则 5 → '' ，'' == null 走规则 7 → false）
[undefined] == 0         // true   （同上，[undefined].toString() = ''）
```

### 1.2.4 `[] == ![]` 为什么是 `true`

**① 算 `![]`**：`[]` 是对象，`ToBoolean` 对所有对象返回 `true`（包括空数组、空对象、`new Boolean(false)`），所以 `![]` = `false`，问题变成 `[] == false`。

**② 规则 4**：`false` → `0`，问题变成 `[] == 0`。

**③ 规则 5**：`[]` → `ToPrimitive`，`valueOf()` 返回数组本身（不是原始值），继续 `toString()` 得到 `''`。

**④ 规则 3**：`''` → `0`，`0 == 0` → `true`。

```
[] == ![]
→ [] == false         （![] 是 false）
→ [] == 0             （false → 0）
→ '' == 0             （[].toString() = ''）
→ 0 == 0              （Number('') = 0）
→ true
```

### 1.2.5 速算题（自测）

| 表达式 | 结果 | 原因 |
|---|---|---|
| `null === undefined` | ❌ false | 类型不同 |
| `NaN == NaN` | ❌ false | 规则 1 的例外 |
| `'' == false` | ✅ true | `false`→0，`''`→0 |
| `'1' == true` | ✅ true | `'1'`→1，`true`→1 |
| `[] == false` | ✅ true | `[]`→`''`→0 |
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

**唯一推荐场景：判断 `null` / `undefined`。**

```js
if (x == null) { /* x 是 null 或 undefined */ }
```

等价于 `x === null || x === undefined`，也是 ESLint `eqeqeq` 的 `{ null: 'ignore' }` 例外。

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

**规范里 `Object.is` 用的是 `SameValue`，`===` 用的是 `IsStrictlyEqual`，`Map`/`Set`/`Array.prototype.includes` 用的是第三个 `SameValueZero`。**

### 1.3.2 三个相等算法

| 算法 | `NaN` 等于自己？ | `0` 等于 `-0`？ | 用在 |
|---|---|---|---|
| **`IsStrictlyEqual`**（`===`） | ❌ | ✅ | `===`、`switch`、`indexOf` |
| **`SameValue`**（`Object.is`） | ✅ | ❌ | `Object.is` |
| **`SameValueZero`** | ✅ | ✅ | `Map`、`Set`、`Array.prototype.includes` |

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

### 1.4.1 固定除以 10 只适用于 1 位小数

```js
Math.round((0.1 + 0.2) * 10) / 10
// 0.3

Math.round((0.123456 + 0.000001) * 10) / 10
// 0.1（期望 0.123457）
```

乘 10 再除 10 等于保留 1 位小数，`0.123457` 被舍入成 `0.1`：这不是修复精度，是丢精度。

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

**`(0.1).toString(2)` 的完整输出（55 位小数）**：

```
0.0001100110011001100110011001100110011001100110011001101
```

**53 位有效数字之外的部分被舍入**，所以 `0.1` 存进去就已经不是精确的 0.1。

```
0.1 实际存的 ≈ 0.1000000000000000055511151231257827
0.2 实际存的 ≈ 0.2000000000000000111022302462515654
相加        ≈ 0.3000000000000000444089209850062616
0.3 实际存的 ≈ 0.2999999999999999888977697537484346
        ↑ 不相等
```

**所以 `0.1 + 0.2` 得到 `0.30000000000000004`**（实测）。

### 1.4.3 五种解法

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
add(0.123456, 0.000001);    // 0.123457
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

**原因**：`1.005` 实际存的是 `1.00499999999999989342...`，按双精度实际值舍入到 2 位就是 `1.00`；这不是银行家舍入。

这个量级可以用 EPSILON 修正：

```js
function toFixedFix(n, digits) {
  const factor = 10 ** digits;
  return (Math.round((n + Number.EPSILON) * factor) / factor).toFixed(digits);
}
toFixedFix(1.005, 2);       // '1.01'
```

#### ④ 用误差范围比较

```js
function isEqual(a, b, epsilon = Number.EPSILON) {
  return Math.abs(a - b) < epsilon;
}

isEqual(0.1 + 0.2, 0.3);    // true
```

**`Number.EPSILON` 是 `2 ** -52 ≈ 2.22e-16`**，即 1 与下一个可表示数的间隔，不是通用容差。

**⚠️ 数量级远离 1 时，固定 EPSILON 会失效**：

```js
Math.abs(1e20 + 1 - 1e20) < Number.EPSILON   // true：1 已被吞掉，差为 0
1e20 + 1 === 1e20                            // true
Math.abs(1e-20 - 2e-20) < Number.EPSILON     // true：相差 50% 仍判等
```

按相对误差比较：

```js
function nearlyEqual(a, b, relTol = 1e-9) {
  const diff = Math.abs(a - b);
  if (diff === 0) return true;
  return diff <= relTol * Math.max(Math.abs(a), Math.abs(b));
}
```

被舍入掉的低位无法靠比较找回；相对误差只保证量级上的判断。

#### ⑤ 用成熟库

| 库 | 特点 |
|---|---|
| **`decimal.js`** | 任意精度十进制，功能全 |
| **`big.js`** | 轻量（~3KB） |
| **`bignumber.js`** | 精度可配置 |
| **`mathjs`** | 功能最全，体积大 |

### 1.4.4 一个反直觉的实测结果

```js
0.1 + 0.7    // 0.7999999999999999
0.1 + 0.3    // 0.4
0.2 + 0.4    // 0.6000000000000001
```

误差是否恰好被舍入抵消取决于具体数值，不能靠个例推断。

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

### 1.5.2 `typeof null === 'object'` 的真实原因

早期引擎用「类型标签 + 值」表示值，对象标签是 `000`；`null` 被实现为空指针（全 0），标签位同样是 `000`，所以 `typeof null` 返回 `'object'`。

修复会破坏依赖该行为的存量代码（例如用 `typeof x === 'object'` 检测 DOM），因此一直保留；准确判断 null 只能用 `x === null`。

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

**第 ② 条是边界**：`typeof` 只对「未声明的变量」安全，对「TDZ 中的 `let`/`const`」照样抛错。

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
// ① 原始值不装箱，直接 false
1 instanceof Number          // false
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
| 能否被用户改写 | ❌ | ✅（改 prototype / `Symbol.hasInstance`） |

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
| **语义** | 「**有意的空值**」（主动设成空） | 「**未定义**」（还没赋值 / 不存在） |
| **`typeof`** | `'object'` ⚠️ | `'undefined'` |
| **`ToNumber`** | `0` | **`NaN`** |
| **`ToString`** | `'null'` | `'undefined'` |
| **`ToBoolean`** | `false` | `false` |
| **是否显式赋值** | ✅ 一般显式 `x = null` | 变量声明未赋值 / 函数无返回 / 访问不存在属性 |
| **JSON** | 保留 | **对象属性被忽略，数组元素变 `null`**（`JSON.stringify({a:undefined})` → `'{}'`） |
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

// ③ 任何算术运算涉及 NaN 都是 NaN（除了这个例外）
NaN + 1                 // NaN
NaN * 0                 // NaN
NaN ** 0                // 1  ← ⚠️ 例外！任何数的 0 次方是 1

// ④ 全局只读属性，赋值无效
NaN = 1;                // 非严格下静默失败，严格下 TypeError
// 用 Number.NaN 更明确

// ⑤ 判断用 Number.isNaN、Object.is，或 v !== v
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

**这就是数组去重推荐 `Set` 的原因**（详见 11 册）。

---

## 1.9 `ToPrimitive`：对象怎么转原始值

### 1.9.1 抽象操作的步骤

```
对象 → 原始值（ToPrimitive(input, hint)）
    ↓
hint = 'default' | 'number' | 'string'
    ↓
① 有 Symbol.toPrimitive → 调用它，返回值必须是原始值，否则 TypeError
② hint = 'string' → 先 toString 再 valueOf
③ 其他 hint → 先 valueOf 再 toString
④ 两个方法都返回对象 → TypeError
```

**`hint` 从哪来**：

| 场景 | hint |
|---|---|
| 二元 `+`（另一侧是不是字符串都一样）、`==` 中对象与原始值比较 | `'default'` |
| 一元 `+`、`Number(x)`、`-` `*` `/` `%`、关系比较（`>` `<` `>=` `<=`） | `'number'` |
| `String(x)`、模板字符串 | `'string'` |
| **`Date` 的 `'default'`** | **按 `'string'` 处理（`'number'` 仍是 `'number'`）** |

### 1.9.2 默认的 `valueOf` / `toString`

| 对象 | `valueOf()` | `toString()` |
|---|---|---|
| `{}` | 对象本身 | `'[object Object]'` |
| `[]` | 对象本身 | `''` |
| `[1,2]` | 对象本身 | `'1,2'` |
| `function(){}` | 对象本身 | 函数源码 |
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
a == 1 && a == 2 && a == 3    // true
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
| 以为 `typeof null` 是设计失误 | 早期引擎的类型标签 bug，修复会破坏兼容 |
| 以为 `typeof` 对 TDZ 也安全 | ❌ 只对**未声明**的变量安全，TDZ 里的 `let` 照样 ReferenceError |
| 用 `isNaN` 判断 NaN | 它会先转数字，`isNaN('abc')` 也是 true；用 `Number.isNaN` |
| 以为 `NaN ** 0` 是 NaN | 是 `1`（任何数的 0 次方是 1） |
| 用 `indexOf` 查 `NaN` | 返回 -1，因为 `indexOf` 用 `===` |
| 以为 `instanceof` 能判断原始值 | `1 instanceof Number` 是 false |
| 以为 `null` 和 `undefined` 可互换 | `Number(null)=0`、`Number(undefined)=NaN`；JSON 对象属性保留/忽略，数组元素变 `null` |
| 以为 `{} + []` 是字符串拼接 | 语句开头 `{}` 被当块，实际是 `+[]` = 0 |

---

## 1.11 答题模板

### 30 秒版（`==` vs `===`）

- `===` 类型不同直接 false；类型相同比较值，`NaN` 不等于自己、`0` 等于 `-0`。
- `==` 同类型退化成 `===`；`null`/`undefined` 互相相等且只和对方相等，不转数字；其余组合转数字（布尔先 0/1，对象先 `ToPrimitive`；BigInt 与字符串转 BigInt）。
- `null == 0` 是 false，`null >= 0` 是 true（`>=` 用 ToNumber）。
- 实践统一用 `===`，唯一例外是 `x == null`。

### 30 秒版（浮点数）

- `number` 是 IEEE 754 双精度，尾数 52 位加隐含 1 位共 53 位有效数字；`0.1` 的二进制无限循环，存入即近似。
- 金额用整数（分）最可靠；小数运算按最大小数位放大成整数再算；比较按量级选绝对或相对容差。
- `toFixed` 不修精度：`(1.005).toFixed(2)` 是 `'1.00'`。

### 2 分钟版（串起来讲）

- **相等**：`===` 用 `IsStrictlyEqual`（`NaN` ≠ 自己，`0` == `-0`）；`Object.is` 用 `SameValue`（`NaN` == 自己，`0` ≠ `-0`）；`Map`/`Set`/`Array.prototype.includes` 用 `SameValueZero`（`NaN` == 自己，`0` == `-0`）。
- **`==`**：同类型退化成 `===`；`null`/`undefined` 只和对方相等；其余转数字（BigInt 与字符串转 BigInt）。`[] == ![]`：`![]` → `false` → `0`，`[]` → `''` → `0`。
- **类型判断**：`typeof` 有 8 种返回值，只能可靠区分原始类型和函数；数组和 `null` 都返回 `'object'`，具体对象类型用 `Object.prototype.toString.call()`。
- **`NaN`**：`NaN !== NaN`；`isNaN` 先做 `Number()` 转换，`Number.isNaN` 只判断真 NaN；手写 `typeof v === 'number' && v !== v`。
- **精度**：`0.1 + 0.2` 的误差来自二进制表示；金额整数化，小数放大成整数，比较用相对误差；`Math.round(x*10)/10` 只保留 1 位小数。

---

## 1.12 速记卡

```
三个相等算法
  IsStrictlyEqual（===）：NaN≠自己，0==-0
  SameValue（Object.is）：NaN==自己，0≠-0
  SameValueZero（Map/Set/Array.includes）：NaN==自己，0==-0
  → [NaN].indexOf(NaN) = -1，[NaN].includes(NaN) = true

== 的 7 条规则
  ① 同类型 → ===
  ② null/undefined 互相相等，只和对方相等（不转数字）
  ③ 数字 vs 字符串 → 字符串转数字
  ④ 有布尔 → 布尔转 0/1
  ⑤ 有对象 → ToPrimitive
  ⑥ BigInt vs 字符串/数字 → 字符串转 BigInt，数字按数学值比较
  ⑦ 其余全 false
  ★ null == 0 是 false，null >= 0 是 true
  ★ [] == ![] → false→0，''→0 → true

ToPrimitive
  hint: default（二元 +、==）/ number（一元 +、Number、- * / 关系比较）/ string（String、模板）
  Date 的 default 按 string 处理
  顺序：Symbol.toPrimitive > valueOf/toString
  普通对象 valueOf 返回自己 → 继续 toString

typeof / instanceof
  8 种：string number boolean undefined object function symbol bigint
  ★ typeof null === 'object'（早期类型标签 bug）
  ★ 数组也是 'object' → Array.isArray；class 是 'function'
  ★ 未声明变量安全；TDZ 的 let 报错
  ★ instanceof 不对原始值装箱；跨 realm 失效；可被 Symbol.hasInstance 改写

null vs undefined
  Number: 0 vs NaN | JSON: 对象属性保留/忽略，数组元素 null | 默认参数: 不触发/触发

NaN
  NaN !== NaN；typeof NaN === 'number'；NaN ** 0 === 1
  用 Number.isNaN（不转换），不用 isNaN（先 Number()）
  手写：typeof v === 'number' && v !== v
  indexOf 找不到 NaN，includes 能找到

浮点数
  尾数 53 位；0.1 二进制无限循环 → 存入即近似
  ★ Math.round(x*10)/10 只对 1 位小数有效
  ★ (1.005).toFixed(2) === '1.00'
  ★ EPSILON 是 1 附近的间隔，不是通用容差
  解法：整数化（金额）/ 按最大小数位放大 / 相对误差 / decimal.js
```
