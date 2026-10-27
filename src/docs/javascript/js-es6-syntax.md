# JS · 06 ES6+ 语法特性

> 覆盖：数组方法、ES6 特性总览、`arguments`、rest、展开、解构、模板字符串、可选链、空值合并、`for...of` vs `for...in`
> 重点不是语法形式，而是各自的语义边界；示例输出以 Node 22 为准。

---

## 目录

- [6.1 一句话结论](#61-一句话结论)
- [6.2 数组方法全表](#62-数组方法全表)
- [6.3 `arguments`](#63-arguments)
- [6.4 rest 与展开](#64-rest-与展开)
- [6.5 解构](#65-解构)
- [6.6 模板字符串](#66-模板字符串)
- [6.7 可选链与空值合并](#67-可选链与空值合并)
- [6.8 `for...of` vs `for...in`](#68-forof-vs-forin)
- [6.9 ES6 特性总览](#69-es6-特性总览)
- [6.10 常见坑](#610-常见坑)
- [6.11 答题模板](#611-答题模板)
- [6.12 速记卡](#612-速记卡)

---

## 6.1 一句话结论

ES6+ 这批语法的共同作用是**减少样板代码**：`rest` 收集、展开摊平、解构提取、模板字符串拼接、可选链防空、空值合并给默认值、`for...of` 走迭代器。每一项都有语义边界，下面按语法逐条说明。

---

## 6.2 数组方法全表

### 6.2.1 按「是否改变原数组」分类（这是最重要的分类）

**9 个会改变原数组**：

| 方法 | 作用 | 返回 |
|---|---|---|
| **`push(...items)`** | 尾部添加 | **新长度** |
| **`pop()`** | 尾部删除 | 删掉的元素 |
| **`shift()`** | 头部删除 | 删掉的元素 |
| **`unshift(...items)`** | 头部添加 | **新长度** |
| **`reverse()`** | 原地反转 | 原数组引用 |
| **`sort(fn?)`** | 原地排序 | 原数组引用 |
| **`splice(start, count, ...items)`** | 增删改 | **被删除的元素数组** |
| **`fill(value, start?, end?)`** | 填充 | 原数组引用 |
| **`copyWithin(target, start, end?)`** | 内部复制 | 原数组引用 |

**记忆口诀：「推弹移反排剪填拷」——九个都会改原数组。**

**其余方法不修改原数组**：

| 分类 | 方法 |
|---|---|
| **遍历** | `forEach`、`map`、`filter`、`reduce`、`reduceRight`、`some`、`every`、`find`、`findIndex`、`findLast`、`findLastIndex`、`flatMap` |
| **提取** | `slice`、`concat`、`flat`、`join`、`at` |
| **查找** | `indexOf`、`lastIndexOf`、`includes` |
| **判断** | `isArray`（静态） |
| **转换** | `toString`、`toLocaleString`、`entries`、`keys`、`values` |

### 6.2.2 `sort` 的两个坑

**坑 1：默认按字符串排序**

```js
[10, 9, 1].sort();              // [1, 10, 9]  ← 按字典序
[10, 9, 1].sort((a, b) => a - b);   // [1, 9, 10]
```

默认把元素转成字符串比较，`'10' < '9'`（因为 `'1' < '9'`）。

**坑 2：`sort` 的稳定性**

```js
[{k:1,v:'a'}, {k:1,v:'b'}, {k:0,v:'c'}].sort((x,y) => x.k - y.k)
// [{k:0,v:'c'}, {k:1,v:'a'}, {k:1,v:'b'}]   ← a 在 b 前
```

ES2019 起规范要求 `sort` 必须稳定。

### 6.2.3 稀疏数组：迭代方法会「跳过空位」

```js
const sparse = [1, , 3];
let count = 0;

sparse.map(x => x).length;        // 3（长度保持）
1 in sparse.map(x => x);          // false  ← 空位还是空位
sparse.forEach(() => count++);    // count = 2，跳过空位

[...sparse].length;               // 3，但空位变成 undefined
for (const v of sparse) { }       // 遍历 3 次（含 undefined）
```

**结论**：`map`/`filter`/`forEach`/`reduce` **按规范跳过空位**，但 `for...of` 不跳。

### 6.2.4 `reduce` 的三个细节

```js
// ① 不给初始值，空数组会抛错
[].reduce((a, b) => a + b);       // TypeError: Reduce of empty array with no initial value

// ② 不给初始值时，第一个元素当初始值（且不执行回调）
[1, 2, 3].reduce((a, b) => a + b);      // 6，回调执行 2 次
[1, 2, 3].reduce((a, b) => a + b, 10);  // 16，回调执行 3 次

// ③ 单元素 + 不给初始值 → 直接返回，回调一次都不执行
[5].reduce((a, b) => a + b);      // 5
```

**「给初始值」是防止空数组报错的标准做法。**

---

## 6.3 `arguments`

### 6.3.1 五个特性

| 特性 | 说明 |
|---|---|
| **是类数组** | 有 `length` 和索引，但**没有数组方法**（`map`/`push` 都没有） |
| **`Array.isArray` 为 false** | 类数组，不是 `Array` 实例 |
| **原型是 `Object.prototype`** | 不是 `Array.prototype` |
| **只在普通函数里有** | 箭头函数没有（会取外层的） |
| **非严格模式下与形参双向绑定** | 改形参会影响 `arguments[0]`，反之亦然 |

**验证**：

```js
function f(a, b) {
  Array.isArray(arguments);                       // false
  arguments instanceof Array;                     // false
  Object.getPrototypeOf(arguments) === Object.prototype;   // true
  [...arguments];                                 // [1, 2, 3]
}
f(1, 2, 3);
```

### 6.3.2 「双向绑定」的差异

```js
function sloppy(a) { a = 9; return arguments[0]; }
sloppy(1);              // 9   ← 非严格：改 a 就改了 arguments[0]

function strictF(a) { 'use strict'; a = 9; return arguments[0]; }
strictF(1);             // 1   ← 严格：不绑定
```

**「双向绑定」只对「没有默认值、没有 rest 参数」的形参生效**：

```js
function f(a = 1) { a = 9; return arguments[0]; }
f(5);                   // 5   ← 有默认值时解除映射
```

### 6.3.3 转成真数组的四种方式

```js
Array.from(arguments);          // 推荐（ES6）
[...arguments];                 // 推荐（ES6，arguments 可迭代）
Array.prototype.slice.call(arguments);   // ES5
Array.prototype.concat.apply([], arguments);  // 更老
```

`[...arguments]` 能行的原因是 `arguments` 有 `Symbol.iterator`。

### 6.3.4 现在推荐用 rest 替代

```js
// 老写法
function sumOld() {
  return Array.prototype.reduce.call(arguments, (a, b) => a + b, 0);
}

// 新写法
function sumNew(...nums) {
  return nums.reduce((a, b) => a + b, 0);
}
```

rest 是真数组、只收剩余参数，箭头函数也能用。

---

## 6.4 rest 与展开

### 6.4.1 语法相同，位置不同

```js
// rest：函数参数位置 → 收集
function f(a, ...rest) { }        // rest 是剩余参数数组

// 展开：调用/字面量位置 → 摊开
f(...[1, 2, 3]);                  // 等价于 f(1, 2, 3)
const arr = [1, ...[2, 3]];       // [1, 2, 3]
const obj = { a: 1, ...{ b: 2 } };  // { a: 1, b: 2 }
```

### 6.4.2 五个展开场景

```js
// ① 数组 → 参数
Math.max(...[1, 5, 3]);          // 5

// ② 数组 → 数组（浅拷贝）
[...arr]

// ③ 对象 → 对象（浅拷贝）
({ ...obj })

// ④ 字符串 → 数组（按码点）
[...'😀a']                        // ['😀', 'a']，长度 2
'😀a'.split('')                   // ['\uD83D','\uDE00','a']，长度 3

// ⑤ Set / Map → 数组
[...new Set([1, 1, 2])]          // [1, 2]
[...new Map([['a', 1]])]         // [['a', 1]]
```

`[...'😀a']` 与 `split('')` 的差异（2 vs 3）：展开按**码点**，`split('')` 按 **UTF-16 码元**；处理 emoji 时不能混用。

### 6.4.3 展开是浅拷贝

```js
const o = { a: 1, b: { c: 2 } };
const copy = { ...o };
copy.b.c = 9;
o.b.c;              // 9  ← 原对象被改，因为 b 是同一个引用
```

展开只复制第一层引用，不能做深拷贝（见 11 册深拷贝）。

### 6.4.4 展开对象时的覆盖顺序

```js
({ a: 1, ...{ a: 2 } })        // { a: 2 }  ← 后面的覆盖前面
({ ...{ a: 2 }, a: 1 })        // { a: 1 }
({ ...undefined, ...null })    // {}        ← 展开 null/undefined 不报错
```

`{ ...maybeNull }` 是安全的；但展开数组时不行：

```js
[...undefined]               // TypeError: undefined is not iterable
```

---

## 6.5 解构

### 6.5.1 五种解构形式

```js
// ① 对象解构 + 重命名
const { a: x } = { a: 1 };              // x = 1

// ② 默认值
const { b = 10 } = { b: undefined };    // b = 10

// ③ 嵌套解构
const { d: { e } = {} } = { d: { e: 1 } };   // e = 1
const { f: { g } = {} } = {};                // g = undefined

// ④ 剩余元素
const { h, ...rest } = { h: 1, i: 2, j: 3 };   // rest = { i: 2, j: 3 }
const [first, ...others] = [1, 2, 3];          // others = [2, 3]

// ⑤ 跳过元素
const [, second] = [1, 2, 3];           // second = 2
```

### 6.5.2 八个实用场景

```js
// ① 交换变量（不用临时变量）
let a = 1, b = 2;
[a, b] = [b, a];                        // a=2, b=1

// ② 函数参数解构 + 默认值
function f({ name, age = 18 } = {}) { }   // 不传参也不报错

// ③ 提取对象的部分属性
const { id, ...payload } = user;

// ④ 解构字符串（字符串有 length 和索引）
const { length } = 'hello';             // 5

// ⑤ 解构函数返回值
const [err, data] = await to(promise);

// ⑥ 解构正则结果
const [, year, month] = '2026-10'.match(/(\d{4})-(\d{2})/);

// ⑦ 同一属性取不同别名时，来源要分开
const { data: userData } = userRes, { data: orderData } = orderRes;

// ⑧ 循环里解构
for (const [key, value] of Object.entries(obj)) { }
```

### 6.5.3 两个坑

**坑 1：解构 `null` / `undefined` 会报错**

```js
const { a } = null;               // TypeError: Cannot destructure property 'a' of 'null' as it is null.
// 解构 undefined 同样抛 TypeError

// ✅ 外层整体给默认值
const { a: safeA } = obj ?? {};

// ✅ 嵌套时也给外层兜底
const { b: { c } = {} } = obj ?? {};
```

**坑 2：默认值只对 `undefined` 生效**

```js
const { a = 10 } = { a: null };   // a = null（不是 10）
const { b = 10 } = { b: 0 };      // b = 0
const { c = 10 } = { c: '' };     // c = ''
```

默认值只在 `undefined` 时触发，和函数默认参数一致；`??` 则对 `null` 和 `undefined` 都生效。

---

## 6.6 模板字符串

### 6.6.1 三个基本能力

```js
const name = 'world';
`hello ${name}`;                  // 'hello world'
`line1
line2`;                           // 支持换行
`${1 + 1}`;                       // '2'（表达式，不能是语句）
```

插值走 `ToString`；它与 `String()` 在 `Symbol` 上不同——模板里插 `Symbol` 会抛 `TypeError`：

```js
`${null}`;                        // 'null'
`${undefined}`;                   // 'undefined'
`${{}}`;                          // '[object Object]'
`${[1, 2]}`;                      // '1,2'
`${Symbol('s')}`;                 // TypeError: Cannot convert a Symbol value to a string
```

### 6.6.2 标签模板

```js
function tag(strings, ...values) {
  console.log(strings);           // ['hello ', ', you are ', '']  ← 静态部分
  console.log(values);            // ['world', 18]
  return 'custom';
}

tag`hello ${'world'}, you are ${18}`;
```

`strings` 有一个特殊属性 `raw`，保留未转义的原始片段：

```js
((strings) => strings.raw)`a\nb`;  // ['a\\nb']
```

**实际用途**：

| 用途 | 例子 |
|---|---|
| **SQL 模板** | `sql\`SELECT * FROM ${table}\`` —— tag 函数负责转义，防注入 |
| **HTML 转义** | `html\`<div>${userInput}</div>\`` —— tag 函数负责转义 |
| **i18n** | `i18n\`Hello ${name}\`` |
| **CSS-in-JS** | `styled.div\`color: red\`` |
| **GraphQL** | `gql\`query { ... }\`` |

**这是很多库的底层机制**（styled-components、graphql-tag、slonik）。

### 6.6.3 `String.raw`

```js
String.raw`C:\path\new`;          // 结果：C:\path\new（反斜杠保留）
`C:\path\new`;                    // 结果：C:path + 换行 + ew（\n 被解释）
```

**用途**：Windows 路径、正则字面量。

---

## 6.7 可选链与空值合并

### 6.7.1 可选链 `?.` 的三种形式

```js
// ① 属性访问
obj?.a?.b?.c                      // 任何一层是 null/undefined 就返回 undefined

// ② 方法调用
obj?.fn?.()                       // fn 不存在就不调用

// ③ 动态属性
obj?.[key]
```

**验证**：

```js
const obj = { a: { b: null } };
obj?.a?.b?.c;                     // undefined
obj?.x?.y;                        // undefined
obj?.fn?.();                      // undefined
```

### 6.7.2 四个必须知道的细节

**① `?.` 只对 `null` / `undefined` 短路，对 `0` / `''` / `false` 不短路**

```js
const o = { a: 0 };
o?.a;                             // 0
o.a?.toString();                  // '0'
```

**② 短路只覆盖 `?.` 之后的连续链，不保护后续的非可选访问**

```js
const obj = null;
obj?.a.b.c;                       // undefined（obj 为 null，整条链短路）

const empty = {};
empty?.a.b.c;                     // TypeError: Cannot read properties of undefined (reading 'b')
empty?.a?.b?.c;                   // undefined
```

所以 `?.` 和 `&&` 的区别不是「一个安全一个不安全」，而是：

- `?.` 只在 `?.` 所在层级判断 `null`/`undefined`；后续层仍可能为空，要逐层写 `?.`。
- `&&` 在任意 falsy 值处短路，`0`/`''`/`false`/`NaN` 也会短路。
- `empty && empty.a.b.c` 与 `empty?.a.b.c` 在 `empty = {}` 时都会抛错；`empty?.a?.b?.c` 才安全。

**③ 不能用在赋值左侧**

```js
obj?.a = 1;                       // SyntaxError: Invalid left-hand side in assignment
```

**④ 不能和 `new` 一起用**

```js
new obj?.Ctor();                  // SyntaxError: Invalid optional chain from new expression
new (obj?.Ctor)();                // ✅ 加括号可以
```

### 6.7.3 空值合并 `??`

```js
null ?? 'dflt';                   // 'dflt'
undefined ?? 'dflt';              // 'dflt'
0 ?? 'dflt';                      // 0     ← 不触发
'' ?? 'dflt';                     // ''    ← 不触发
false ?? 'dflt';                  // false
NaN ?? 'dflt';                    // NaN
```

**和 `||` 的对比**：

| 左侧值 | `\|\|` 结果 | `??` 结果 |
|---|---|---|
| `null` | 默认值 | 默认值 |
| `undefined` | 默认值 | 默认值 |
| **`0`** | **默认值** | **`0`** ✅ |
| **`''`** | **默认值** | **`''`** ✅ |
| **`false`** | **默认值** | **`false`** ✅ |
| **`NaN`** | **默认值** | **`NaN`** ✅ |

**真实 bug 场景**：

```js
const volume = userVolume ?? 50;           // ✅ 用户设 0 保留 0；|| 会改成 50
const page = query.page ?? 1;              // ✅ page=0 保留 0
const enabled = config.enabled ?? true;    // ✅ 传 false 保留 false
const price = item.price ?? 99;            // ✅ 0 元商品保留 0
```

### 6.7.4 `??` 也是短路的

```js
let called = false;
const r = 1 ?? (called = true);
called;                            // false  ← 右侧没执行
```

### 6.7.5 `??=` 逻辑赋值（ES2021）

```js
let a = null;
a ??= 'default';                   // a = 'default'（只在 null/undefined 时赋值）

let b = 0;
b ??= 'default';                   // b = 0（不赋值）

// 对应的还有
let c = 0;
c ||= 'x';                         // falsy 时赋值 → 'x'
let d = 1;
d &&= 'y';                         // truthy 时赋值 → 'y'
```

**`??=` 的经典用途：惰性初始化**

```js
obj.cache ??= computeExpensiveValue();
// 只在 cache 是 null/undefined 时才算
```

---

## 6.8 `for...of` vs `for...in`

### 6.8.1 核心区别

| | `for...in` | `for...of` |
|---|---|---|
| **遍历什么** | **键名**（字符串） | **值** |
| **依据** | 对象的**可枚举属性**（含原型链） | 对象的 **`[Symbol.iterator]`** |
| **适用对象** | 对象 ✅、数组 ⚠️ | 数组 ✅、字符串 ✅、Map/Set ✅、**普通对象 ❌** |
| **顺序** | 规范顺序，见 6.8.4 | 按迭代器顺序 |
| **能 `break`** | ✅ | ✅ |

### 6.8.2 `for...in` 遍历数组的三个问题

```js
const arr = [10, 20];
arr.extra = 'x';                   // 给数组加自定义属性

for (const k in arr) { }
// 遍历到：'0', '1', 'extra'   ← 包含自定义属性
// k 是字符串 '0'，不是数字 0
```

**三个问题**：

| 问题 | 说明 |
|---|---|
| **① 会遍历自定义属性** | 上面 `extra` 被遍历了 |
| **② 会遍历原型链上的可枚举属性** | 给 `Array.prototype` 加的可枚举属性也会被遍历 |
| **③ 键是字符串** | `'0'` 不是 `0`，做运算要注意 |

**所以「永远不要用 `for...in` 遍历数组」。**

### 6.8.3 `for...of` 遍历对象会报错

```js
const obj = { a: 1 };
for (const v of obj) { }
// TypeError: obj is not iterable
```

**要遍历对象的三种方式**：

```js
// ① Object.entries（最常用）
for (const [k, v] of Object.entries(obj)) { }

// ② Object.keys / values
for (const k of Object.keys(obj)) { }

// ③ for...in（要加 hasOwnProperty 过滤）
for (const k in obj) {
  if (Object.hasOwn(obj, k)) { }
}
```

### 6.8.4 `for...in` 的顺序规则

规范顺序：

```
① 整数键（"0"、"1"、"2"…）→ 按数值升序
② 字符串键 → 按插入顺序
③ Symbol 键 → 不遍历（for...in 忽略 Symbol）
```

```js
const o = { b: 1, 2: 'two', a: 2, 1: 'one' };
Object.keys(o);                    // ['1', '2', 'b', 'a']
```

用对象当字典且 key 是数字时，顺序与插入顺序不同——这就是 07 册「计数用 `Map`」的原因。

### 6.8.5 `for...of` 的迭代器关闭

```js
for (const v of iterable) {
  if (v === 2) break;              // ← break 会调用 iterable 的 return()
}
```

`for...of` 被 `break` / `return` / `throw` 中断时，会调用迭代器的 `return()` 做清理（详见 05 册 5.8.2）。

---

## 6.9 ES6 特性总览

### 6.9.1 声明与作用域

| 特性 | 说明 |
|---|---|
| **`let` / `const`** | 块级作用域、TDZ |
| **块级函数声明** | ES6 允许在块里声明函数（严格模式下块级作用域） |

### 6.9.2 语法糖

| 特性 | 说明 |
|---|---|
| **箭头函数** | 词法 `this`、不能 `new` |
| **默认参数** | `function f(a = 1)` |
| **rest 参数** | `...args` |
| **展开运算符** | `...[1,2]` |
| **解构赋值** | 数组/对象/嵌套/默认值 |
| **模板字符串** | 插值 + 换行 + 标签模板 |
| **对象字面量增强** | 属性简写、方法简写、计算属性名 |
| **`for...of`** | 基于迭代器 |

### 6.9.3 数据结构与类型

| 特性 | 说明 |
|---|---|
| **`Map` / `Set`** | 新的集合类型 |
| **`WeakMap` / `WeakSet`** | 弱引用集合 |
| **`Symbol`** | 唯一标识符 |
| **`Proxy` / `Reflect`** | 元编程 |
| **`Promise`** | 异步编程基础 |
| **Generator** | `function*` 可暂停函数 |
| **迭代器协议** | `[Symbol.iterator]` |
| **TypedArray** | 二进制数组 |

### 6.9.4 模块与工程

| 特性 | 说明 |
|---|---|
| **ES Module** | `import` / `export` |
| **`class`** | 类语法（本质是原型继承的语法糖） |
| **`super` / `extends`** | 继承 |
| **动态 `import()`** | 按需加载 |

### 6.9.5 顺带补充：ES2016 之后的高频特性

| 版本 | 新特性 |
|---|---|
| **ES2016** | `Array.prototype.includes`、`**` 幂运算 |
| **ES2017** | **`async/await`**、`Object.entries/values`、`padStart/padEnd` |
| **ES2018** | 对象 rest/展开、`Promise.finally`、异步迭代 |
| **ES2019** | `flat/flatMap`、`Object.fromEntries`、`trimStart/End`、**`Array.sort` 稳定** |
| **ES2020** | **可选链 `?.`**、**空值合并 `??`**、`BigInt`、`Promise.allSettled`、`import.meta` |
| **ES2021** | `??=`、`Promise.any`、`replaceAll`、数字分隔符 `1_000` |
| **ES2022** | **顶层 await**、`Object.hasOwn`、`#private` 字段、`Array.at` |
| **ES2023** | `findLast/findLastIndex`、`toSorted/toReversed/toSpliced/with`（不可变数组方法） |

可选链、空值合并是 **ES2020**，不是 ES6——这是最常见的版本混淆。

---

## 6.10 常见坑

| 坑 | 正确说法 |
|---|---|
| 用 `for...in` 遍历数组 | 会遍历自定义属性和原型链，用 `for...of` |
| 用 `for...of` 遍历普通对象 | 报 `TypeError`，用 `Object.entries` |
| 用展开做深拷贝 | 浅拷贝，嵌套对象还是同一个引用 |
| 以为 `[...str]` 和 `split('')` 等价 | 前者按码点（emoji 算 1），后者按码元（算 2） |
| 以为解构默认值对 `null` 生效 | 只对 `undefined` 生效 |
| 解构 `null`/`undefined` | 报 `TypeError`，外层用 `?? {}` 兜底 |
| 用 `\|\|` 给默认值 | `0`/`''`/`false`/`NaN` 都会被替换，用 `??` |
| 以为 `?.` 对 `0`/`''`/`false` 短路 | 只对 `null`/`undefined` 短路 |
| 以为 `obj?.a.b.c` 全链安全 | `obj = {}` 时仍抛错，逐层可能为空要逐层 `?.` |
| 忘给 `reduce` 初始值 | 空数组抛 `TypeError` |
| 用 `sort()` 排数字 | 默认按字符串，要传 `(a,b) => a-b` |
| 以为 `arguments` 是数组 | 是类数组，`Array.isArray` 为 false |
| 在箭头函数里用 `arguments` | 会取外层的，不是自己的 |
| 说「可选链是 ES6」 | 是 **ES2020** |
| 以为 `?.` 能用在赋值左侧 | `SyntaxError` |

---

## 6.11 答题模板

### 30 秒版（`for...of` vs `for...in`）

- `for...in` 遍历键名，依据可枚举属性，包含原型链和自定义属性，不能用来遍历数组。
- `for...of` 遍历值，依据 `[Symbol.iterator]`，适用于数组、字符串、Map、Set；普通对象会抛 `TypeError`。
- 一句话：`for...in` 是属性枚举，`for...of` 是迭代器遍历。

### 30 秒版（可选链、空值合并）

- `?.` 只在 `null`/`undefined` 处短路，且只覆盖该 `?.` 之后的连续链；后续层可能为空时要逐层写 `?.`。
- `?.` 对 `0`/`''`/`false` 不短路。
- `??` 只在左侧是 `null`/`undefined` 时取默认值；`||` 对所有 falsy 值都会替换。
- 给可能为 `0`、`''`、`false` 的字段设默认值，必须用 `??`。

### 2 分钟版（把 ES6 语法串起来讲）

- 声明与语法糖：`let`/`const`（块级作用域、TDZ）；箭头函数（词法 `this`、不能 `new`）、默认参数、rest、展开、解构、模板字符串、对象字面量增强、`for...of`，共八样。
- 关键边界：展开是浅拷贝；`[...str]` 按码点、`split('')` 按 UTF-16 码元；解构默认值只对 `undefined` 生效，`null` 不触发。
- 数据结构：`Map`/`Set`/`WeakMap`/`Symbol`/`Proxy`/`Reflect`/`Promise`/Generator/迭代器/TypedArray。
- 模块与遍历：ES Module、`class`、动态 `import()`；`for...in` 枚举属性，`for...of` 走迭代器，`break` 时调用迭代器的 `return()`。
- `arguments`：类数组（`Array.isArray` 为 false），非严格模式下与形参双向绑定，有默认值或 rest 参数时解除绑定；新代码用 rest。

### 追问表

| 追问 | 回答要点 |
|---|---|
| 哪些数组方法会改变原数组 | 9 个：push/pop/shift/unshift/reverse/sort/splice/fill/copyWithin |
| `sort` 默认怎么排 | 转字符串按字典序，数字要传比较函数 |
| `sort` 稳定吗 | ES2019 起规范要求稳定 |
| 稀疏数组哪些方法会跳过空位 | map/filter/forEach/reduce 跳过；`for...of` 不跳 |
| `reduce` 不给初始值会怎样 | 空数组抛 TypeError |
| `arguments` 是数组吗 | 不是，类数组，`Array.isArray` 为 false |
| `arguments` 和形参绑定吗 | 非严格下绑定，有默认值/rest 时不绑定 |
| 怎么把 `arguments` 转数组 | `Array.from` 或 `[...arguments]` |
| rest 和展开区别 | 语法相同，位置不同：参数位置收集，调用位置摊开 |
| 展开是深拷贝吗 | 不是，浅拷贝 |
| `[...str]` 和 `split('')` 区别 | 前者按码点，后者按码元 |
| `{...null}` 会报错吗 | 不会，返回 `{}`；但 `[...null]` 会 |
| 解构默认值什么时候生效 | 只在 `undefined` 时 |
| 解构 `null` 会怎样 | TypeError |
| 标签模板有什么用 | SQL 转义、HTML 转义、i18n、CSS-in-JS、gql |
| `?.` 只对什么短路 | `null`/`undefined`（`0`/`''`/`false` 不短路） |
| `?.` 和 `&&` 区别 | `?.` 只在该层判断 `null`/`undefined`；两者都不保护后续非可选访问 |
| `??` 和 `\|\|` 区别 | `??` 只看 null/undefined |
| `??=` 有什么用 | 惰性初始化 |
| `for...in` 遍历数组有什么问题 | 包含自定义属性和原型链、键是字符串 |
| `for...of` 能遍历对象吗 | 不能，报 TypeError |
| `for...of` 被 break 会怎样 | 调用迭代器的 `return()` |
| 可选链是 ES6 吗 | 不是，是 ES2020 |

---

## 6.12 速记卡

```
数组方法
  ★ 9 个改原数组：push pop shift unshift reverse sort splice fill copyWithin
    口诀「推弹移反排剪填拷」
  不改原数组：map filter reduce slice concat flat flatMap join find findIndex some every includes
  ★ sort 默认按字符串 → 数字要 (a,b)=>a-b
  ★ sort ES2019 起稳定
  ★ reduce 不给初始值，空数组抛 TypeError
  ★ map/filter/forEach/reduce 跳过稀疏空位；for...of 不跳

arguments
  类数组，Array.isArray 为 false，原型是 Object.prototype
  ★ 非严格下与形参双向绑定（有默认值/rest 时不绑定）
  转数组：Array.from / [...arguments]
  现在用 rest 替代

rest vs 展开
  参数位置 = 收集；调用/字面量位置 = 摊开
  ★ 展开是浅拷贝（嵌套对象仍是同一引用）
  ★ [...'😀a'] 长度 2（码点）；split('') 长度 3（码元）
  ★ {...null} 返回 {}，但 [...null] 报错

解构
  重命名 / 默认值 / 嵌套 / rest / 跳过
  ★ 默认值只在 undefined 时生效（null 不触发）
  ★ 解构 null/undefined 报 TypeError；外层用 ?? {} 兜底

可选链 / 空值合并
  ?. 三种：obj?.a / obj?.fn?.() / obj?.[k]
  ★ 只对 null/undefined 短路；短路只覆盖该 ?. 之后的连续链
  ★ 逐层可能为空要逐层 ?.；不能用在赋值左侧、不能直接 new
  ?? 只在 null/undefined 时取默认值
  ★ 0 / '' / false / NaN 用 ?? 都不会被替换（|| 会）
  ??= 惰性初始化

for...of vs for...in
  for...in → 键名，枚举属性（含原型链 + 自定义属性）→ 不能遍历数组
  for...of → 值，走 [Symbol.iterator] → 不能遍历普通对象
  对象遍历用 Object.entries
  ★ 整数键会被提前并排序（1,2,b,a）
  ★ for...of 被 break 会调迭代器 return()

ES6 四组
  声明：let/const
  语法糖：箭头函数 / 默认参数 / rest / 展开 / 解构 / 模板字符串 / 对象增强 / for...of
  数据结构：Map Set WeakMap Symbol Proxy Reflect Promise Generator 迭代器
  模块：ESM / class / super / 动态 import
  ★ 可选链、空值合并是 ES2020，不是 ES6
```
