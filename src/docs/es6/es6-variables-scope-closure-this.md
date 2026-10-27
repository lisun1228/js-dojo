# 分册 01 · 变量、作用域、闭包与 this

> 覆盖题号：**1、19**（let/const/var）、**24**（作用域与作用域链）、**25**（执行上下文与调用栈）、**29**（this）、**31**（闭包）、**23、27、28**（箭头函数）
> 共 **9 题**，去重后 **6 个独立考点**

---

## 目录

- [1.1 let、const、var 的区别](#11-letconstvar-的区别)
- [1.2 深入：变量提升与暂时性死区](#12-深入变量提升与暂时性死区)
- [1.3 作用域与作用域链](#13-作用域与作用域链)
- [1.4 执行上下文与调用栈](#14-执行上下文与调用栈)
- [1.5 this 的六种情况与优先级](#15-this-的六种情况与优先级)
- [1.6 箭头函数](#16-箭头函数)
- [1.7 闭包](#17-闭包)
- [1.8 本册答题模板汇总](#18-本册答题模板汇总)
- [1.9 速记卡与连环追问](#19-速记卡与连环追问)

---

## 1.1 let、const、var 的区别

### 1.1.0 一句话结论

> 核心差异是**作用域规则**，其余差异都是它的推论：`var` 是函数作用域，提升后初始化为 `undefined`，可重复声明，在浏览器 classic script 顶层会挂到全局对象上；`let`/`const` 是**块级作用域**，提升但不初始化（TDZ），不可重复声明，不挂全局对象。`const` 额外要求**声明时必须初始化**，且**绑定不可重新赋值**。

### 1.1.1 六维对照表

| 维度 | `var` | `let` | `const` |
|---|---|---|---|
| **作用域** | 函数作用域（或全局） | 块级 `{}` | 块级 `{}` |
| **变量提升** | ✅ 提升，初始化为 `undefined` | ✅ 提升，但**未初始化**（TDZ） | ✅ 同 `let` |
| **声明前访问** | `undefined` | ❌ `ReferenceError` | ❌ `ReferenceError` |
| **重复声明** | ✅ 允许（后者覆盖前者） | ❌ `SyntaxError` | ❌ `SyntaxError` |
| **顶层是否挂 `window`**（classic script） | ✅ `window.x` 能取到 | ❌ 取不到 | ❌ 取不到 |
| **初始化要求** | 可省略（默认 `undefined`） | 可省略 | ❌ **必须赋值** |
| **能否重新赋值** | ✅ | ✅ | ❌（对象内部属性可改） |
| **循环中的绑定** | 全程**共用一个** | 每轮迭代**新建一个** | 同 `let`（C 式 `for` 自增会 `TypeError`） |

### 1.1.2 作用域：块级到底"块"在哪

```js
// 1) 块级作用域：if / for / while / switch / 单独的 {}
{
  var a = 1;
  let b = 2;
  const c = 3;
}
console.log(a);   // 1     ← var 泄漏到外层
// console.log(b); // ReferenceError: b is not defined
// console.log(c); // ReferenceError: c is not defined
```

```js
// 2) 函数作用域：var 会穿透所有块，但穿透不了函数
function f() {
  if (true) {
    var x = 'var';
  }
  console.log(x);   // 'var'  ← 穿透了 if 块
}
// console.log(x);  // ReferenceError ← 没穿透函数
```

**一句话记忆**：`var` 只认「函数边界」，`let/const` 认「花括号边界」。**块级作用域的边界是 `{}`，函数的边界是函数体，两者位置相同时以函数为准。**

### 1.1.3 提升：三者都提升，但"初始化的时机"不同

常见误解是"`let` 没有变量提升"。实际是三者都提升，`var` 在创建阶段就初始化为 `undefined`，`let`/`const` 只创建绑定、不初始化。

```js
console.log(typeof a);  // 'undefined'  ← var 提升且已初始化为 undefined
var a = 1;
console.log(typeof b);  // ReferenceError: Cannot access 'b' before initialization
let b = 1;

// 对比：完全没声明的变量
console.log(typeof c);  // 'undefined'  ← 不报错，返回字符串 'undefined'
```

**为什么 `typeof tdzVar` 会抛错？** `typeof` 对"未声明的标识符"有特殊豁免（返回 `'undefined'`），但对"已声明但未初始化"的绑定不做豁免——它已经在作用域里了，只是处于 TDZ 状态。

> **`let`/`const` 有声明提升（hoisting），但没有初始化（initialization）。从进入块到声明语句执行之间，这个绑定处于「暂时性死区」（Temporal Dead Zone, TDZ），任何访问（包括 `typeof`）都会抛 `ReferenceError`。**

### 1.1.4 重复声明与"同一作用域"的判定

下面 ❌ 行会让整个脚本在解析阶段失败，仅作语法示意：

```js
var a = 1;
var a = 2;        // ✅ 允许

let b = 1;
let b = 2;        // ❌ SyntaxError: Identifier 'b' has already been declared

var c = 1;
let c = 2;        // ❌ SyntaxError（同一作用域内 var 和 let 也冲突）

// 但不同作用域可以同名——内层遮蔽（shadowing）
let d = 1;
{
  let d = 2;      // ✅ 合法，内层的 d
  console.log(d); // 2
}
console.log(d);   // 1
```

**注意**：`SyntaxError` 是在**编译阶段**报的，不是运行时。所以下面这段代码整个脚本都不会执行：

```js
console.log('hello');   // 不会打印
let a = 1;
let a = 2;              // 解析阶段就抛 SyntaxError
```

```js
// 经典陷阱：块内 let 遮蔽导致 TDZ
var x = 1;
{
  console.log(x);   // ReferenceError: Cannot access 'x' before initialization
  let x = 2;
}
```

> **为什么？** 因为块内的 `let x` 在整个块内都生效（提升到块顶），所以 `console.log(x)` 命中的是块内那个还在 TDZ 里的 `x`，而不是外层 `var x`。**遮蔽发生在进入块的那一刻，不是声明那一刻。**

### 1.1.5 const：到底"不能改"的是什么

```js
const a = 1;
// a = 2;              // TypeError: Assignment to constant variable.

const obj = { n: 1 };
obj.n = 2;             // ✅ 允许
obj.m = 3;             // ✅ 允许
// obj = {};           // TypeError: Assignment to constant variable.

const arr = [1, 2];
arr.push(3);           // ✅ 允许
// arr = [];           // TypeError: Assignment to constant variable.
```

**准确表述**：`const` 保证的是**绑定（binding）不可变**，不是**值不可变**。它阻止"重新赋值 / 重新绑定"，不阻止"修改对象内部状态"。

要真正冻结对象得用 `Object.freeze()`，而且它是**浅冻结**——嵌套对象还要递归处理。`Object.freeze` 在非严格模式下静默失败，严格模式下抛 `TypeError`。

```js
const o = Object.freeze({ a: 1, nested: { b: 2 } });
o.a = 10;              // 非严格：静默失败，o.a 仍为 1
o.nested.b = 20;       // 浅冻结：嵌套属性仍可改
// 严格模式下 o.a = 10 抛 TypeError: Cannot assign to read only property 'a'
```

### 1.1.6 循环中的绑定

```js
// ❌ var 版本：输出 3, 3, 3
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log(i), 0);
}

// ✅ let 版本：输出 0, 1, 2
for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log(j), 0);
}
```

**根因**：

- `var` 只有一个绑定，整个循环共享它。`setTimeout` 的回调是**异步**执行的，等它们跑的时候循环早结束了，`i` 已经是 `3`。
- `let` 在 `for` 语句里有一个特殊行为：**每轮进入循环体前，规范会执行 `CreatePerIterationEnvironment`，创建一个新的词法环境并把上一轮的值复制进来**。所以三轮循环产生了三个独立的 `j`，每个 `setTimeout` 的回调通过闭包各自捕获一个。

```
let 循环的展开等价于：

{
  let j = 0;                    // 第 1 轮环境
  setTimeout(() => console.log(j));
}
{
  let j = 1;                    // 第 2 轮环境（新绑定，值从上一轮复制）
  setTimeout(() => console.log(j));
}
{
  let j = 2;
  setTimeout(() => console.log(j));
}
```

**边界**：这个"每轮新绑定"是 **`for` 语句专属**的规范行为，不是"`let` 在所有循环里都这样"：

```js
// while 里用 let 没有这个效果，因为 let 在 while 外面
let k = 0;
while (k < 3) {
  setTimeout(() => console.log(k), 0);   // 3, 3, 3
  k++;
}
```

### 1.1.7 全局挂载：一个常被忽略的差异

以下结论只适用于浏览器 classic script（`<script>`，非 `type="module"`）：

```js
var g1 = 1;
let g2 = 2;
const g3 = 3;

console.log(window.g1);   // 1        ← var 在全局声明会成为全局对象属性
console.log(window.g2);   // undefined
console.log(window.g3);   // undefined

// 验证方式
console.log(Object.keys(window).includes('g1'));  // true
console.log(Object.keys(window).includes('g2'));  // false
```

**三条结论：**

1. `var g1` 创建的属性和 `window.g1` 是**同一个绑定**，`delete window.g1` 返回 `false`（不可配置）。
2. `let/const` 在全局是"**全局词法环境**的绑定"，和全局对象是**两个不同的东西**，这解决了老代码里 `var` 污染 `window` 的问题。
3. Node 不同：CJS 顶层 `var` 属于模块包装函数，ESM 顶层 `var` 属于模块作用域，都不挂 `globalThis`（Node 22 实测 `globalThis.g1 === undefined`）。

### 1.1.8 该怎么选：一条实用规则

```
默认全部用 const
  ↓
需要重新赋值（累加、循环变量、状态翻转）→ 改 let
  ↓
永远不要用 var（除非要兼容 IE 且不转译，或明确需要函数作用域/变量提升的特性）
  ↓
团队规范：ESLint 开 prefer-const + no-var
```

**为什么"默认 const"？** 因为 `const` 把"这个变量不会被重新赋值"变成了**编译期可验证的约束**，读代码时不用追踪它被改过几次，降低认知负担。

### 1.1.9 答题模板

- **作用域**：`var` 函数级；`let`/`const` 块级。
- **提升**：三者都提升；`var` 初始化为 `undefined`，`let`/`const` 未初始化（TDZ），声明前访问（含 `typeof`）抛 `ReferenceError`。
- **声明与赋值**：`var` 可重复声明；`let`/`const` 不可；`const` 必须初始化且绑定不可重新赋值（对象内容可改）。
- **顶层与循环**：浏览器 classic script 顶层 `var` 挂 `window`，`let`/`const` 不挂；C 式 `for` 中 `var` 共用一个绑定，`let` 每轮新绑定。
- **选型**：默认 `const`，需要重新赋值改 `let`，不用 `var`。

### 1.1.10 追问表

| 追问 | 答题要点 |
|---|---|
| `switch` 的 `case` 里能写 `let` 吗？ | 能，但**整个 switch 是一个块**，不同 case 里不能同名声明（会 SyntaxError），要用 `{}` 包起来 |
| 能不能用 `var` + IIFE 模拟 `let` 的循环效果？ | 能，ES5 时代就是这么做的：`(function(i){ setTimeout(...) })(i)` |
| 为什么顶层 `let` 和 `var` 行为不同？ | `var` 成为全局对象属性，`let` 只存在于全局词法环境 |

---

## 1.2 深入：变量提升与暂时性死区

### 1.2.1 提升的到底是什么

"提升"不是物理移动，而是**编译阶段的行为**：JS 引擎在执行代码前会先做一次**声明扫描**，把当前作用域内的所有声明登记到词法环境里。

```
进入一个作用域时（创建阶段）：
  ① 扫描 function 声明  → 在词法环境里创建绑定，并【立即初始化】为函数对象
  ② 扫描 var 声明        → 在变量环境里创建绑定，初始化为 undefined
  ③ 扫描 let/const 声明  → 在词法环境里创建绑定，但【不初始化】→ TDZ
  ④ 扫描 class 声明      → 同 let/const，TDZ
  ⑤ 记录 this 绑定、arguments、形参
```

```js
// function 声明：整体可用
foo();                  // 'ok'  ← 完全提升
function foo() { console.log('ok'); }

// 函数表达式：只有变量名被提升，值是 undefined
bar();                  // ❌ TypeError: bar is not a function
var bar = function () {};

// 具名函数表达式：名字只在函数内部可见
var baz = function inner() {
  console.log(typeof inner);   // 'function'
};
console.log(typeof inner);     // 'undefined'
```

### 1.2.2 形参和 `var` 的微妙关系

```js
// 非严格模式：形参和同名 var 是同一个绑定，arguments[0] 与形参联动
function f(a) {
  var a = 2;
  console.log(a, arguments[0]);   // 2 2
}
f(1);

// 严格模式：形参和 var 是两个独立绑定
function g(a) {
  'use strict';
  var a = 2;
  console.log(a, arguments[0]);   // 2 1
}
g(1);
```

ES6 之后规范用 `varEnv` 和 `lexEnv` 分离来表达这件事；非严格模式下两者可能指向同一个环境记录。

### 1.2.3 提升的实际危害：三个真实 bug

```js
// bug 1：内层 var 遮蔽外层，且提升导致 undefined
var value = 'outer';
function bad() {
  console.log(value);   // undefined（不是 'outer'！）
  var value = 'inner';
}
bad();

// bug 2：循环里创建函数 + 提升
for (var i = 0; i < 3; i++) {
  // ...
}
console.log(i);   // 3 ← 循环变量泄漏到外面

// bug 3：条件里的 var 也会提升
function h(flag) {
  if (flag) {
    var result = 'yes';
  }
  return result;   // flag 为 false 时返回 undefined，而不是报错
}
```

---

## 1.3 作用域与作用域链

### 1.3.0 一句话结论

> **作用域**是「变量能被访问的静态范围」；**作用域链**是「当前作用域找不到变量时，沿着外层词法环境的引用逐级向上查找，直到全局（再到 `null`）的那条链」。关键是它是**词法（静态）**的——写代码时位置就定了，跟谁调用它无关。

### 1.3.1 四种作用域

| 类型 | 边界 | 说明 |
|---|---|---|
| **全局作用域** | 整个脚本 / 模块外 | 最外层，只有一份 |
| **函数作用域** | 函数体 `{}` | 每次调用函数都创建一个新的 |
| **块级作用域** | 任意 `{}`（`if`/`for`/`while`/`try`/裸块） | 只有 `let/const/class/function`（严格模式）受它约束 |
| **模块作用域** | ESM 文件顶层 | 模块内的声明不会污染全局，顶层 `this` 是 `undefined` |

```js
// a.mjs
var x = 1;
console.log(this);          // undefined（不是 globalThis）
console.log(globalThis.x);  // undefined（模块顶层 var 不挂全局对象）
```

### 1.3.2 词法作用域 vs 动态作用域

```js
var scope = 'global';

function check() {
  console.log(scope);
}

function demo() {
  var scope = 'local';
  check();
}

demo();             // 'global'  ← 词法作用域：check 定义在全局，所以查全局
```

如果是**动态作用域**（像 Bash、早期 Lisp），`check()` 会沿着**调用栈**找，输出 `'local'`。JS 是词法作用域，所以输出 `'global'`。

> **一句话记忆**：**作用域看"定义在哪"，`this` 看"怎么调用"。** 这是 JS 里两套完全独立的查找机制，不能混。

### 1.3.3 作用域链的实现：`[[Environment]]` 与 `[[OuterEnv]]`

每个**函数对象**在被创建时，会记录当时所处的词法环境，存在内部槽 `[[Environment]]` 上。每个**环境记录**（Environment Record）又有 `[[OuterEnv]]` 指向外层。

```
全局环境 (OuterEnv: null)
  └── 函数 A 的环境 (OuterEnv: 全局)
        └── 函数 B 的环境 (OuterEnv: A 的环境)
              └── 块级环境 (OuterEnv: B 的环境)
```

查找变量时的流程：

```
1. 在当前环境记录的声明式记录里找 → 找到就返回
2. 没找到 → 沿 [[OuterEnv]] 上跳一层 → 重复
3. 到全局环境还没找到 → ReferenceError（读）/ 非严格模式下隐式创建全局变量（写）
```

```js
function outer() {
  const a = 1;
  function inner() {
    const b = 2;
    console.log(a + b + c);   // a 从 outer 取，c 从全局取
  }
  return inner;
}
const c = 3;
outer()();   // 6
```

### 1.3.4 作用域链 vs 原型链：一张表分清

| | 作用域链 | 原型链 |
|---|---|---|
| **查什么** | **变量 / 标识符** | **对象属性** |
| **什么时候建** | 函数**定义**时（静态） | 对象**创建**时（`Object.create` / `new`） |
| **方向** | 由内向外（词法嵌套） | 由下向上（继承层级） |
| **终点** | 全局环境 | `null` |
| **能否人为修改** | 基本不能（`with`/`eval` 例外） | 能（`Object.setPrototypeOf`） |
| **相关关键字** | `var`/`let`/`const`/闭包 | `.` / `[]` / `in` / `instanceof` |

```js
// 一个例子同时体现两条链
const obj = { name: 'obj' };
function f() {
  console.log(missingVar);       // 作用域链：找变量 missingVar → 全局没有 → ReferenceError
  console.log(obj.name);  // 原型链：obj 自身有 name → 'obj'
}
```

### 1.3.5 作用域链能被"延长"吗

主要有两种情况：

```js
// ① with：把对象的属性临时插入作用域链前端（非严格模式）
const o = { a: 1 };
with (o) {
  console.log(a);   // 1
}
// 严格模式禁用 with：SyntaxError: Strict mode code may not include a with statement

// ② catch 的块级绑定
try { throw new Error('x'); }
catch (e) { /* e 在 catch 块的作用域里 */ }
```

> **为什么 `with` 被禁？** 因为它让作用域链**在运行时才确定**，引擎无法做静态优化，所有变量查找都要走慢路径。

### 1.3.6 答题模板

- **定义**：作用域是变量能被访问的静态范围；作用域链是找不到变量时沿外层词法环境逐级向上查找的链，终点是全局环境，再往上 `[[OuterEnv]]` 为 `null`。
- **静态性**：JS 是词法作用域，链在函数**定义时**确定，与调用位置无关；`[[Environment]]` 记录函数创建时的外层环境。
- **区分**：作用域链查变量，原型链查对象属性；前者由内向外静态嵌套，后者由下向上对象继承。
- **延长**：`with` 把对象属性插入链前端，使查找运行时化、破坏优化，严格模式禁用；`catch` 块也有块级绑定。

### 1.3.7 追问表

| 追问 | 答题要点 |
|---|---|
| 全局变量为什么性能差？ | 查找路径最长（要走到链尾）；且挂在全局对象上，属性访问还要走原型链 |
| 什么会延长作用域链？ | `with`（严格模式禁用）、`catch` 块、`eval`（间接影响） |
| 块级作用域在 ES5 怎么模拟？ | IIFE + 函数作用域 |
| 模块作用域和函数作用域的区别？ | 模块顶层 `this` 是 `undefined`，`var` 不挂全局对象 |

---

## 1.4 执行上下文与调用栈

### 1.4.0 一句话结论

> **执行上下文**是代码执行时的运行环境，分全局、函数、`eval`（还有模块）几类，每个上下文包含**词法环境、变量环境、`this` 绑定、外层引用**；**调用栈**是管理这些上下文的 LIFO 栈，当前执行的函数上下文永远在栈顶，函数返回就出栈。

### 1.4.1 执行上下文的两个阶段

```
① 创建阶段（进入函数时，代码还没跑）
   ├─ 确定 this 绑定
   ├─ 创建词法环境（lexicalEnvironment）：let/const/class/函数声明
   ├─ 创建变量环境（variableEnvironment）：var 声明、形参
   └─ 建立 outer 引用（指向定义时的外层环境）
   ↓
② 执行阶段（逐行执行）
   ├─ 变量赋值、函数调用
   └─ 遇到函数调用 → 创建新上下文压栈
```

> **注意**：`this` 在函数**被调用**时、创建该次执行上下文的那一刻确定；逐行执行阶段不再改变（箭头函数不创建自己的 `this`）。

### 1.4.2 执行上下文的组成（ES5 视角 vs ES6 视角）

| 组成 | ES5 说法 | ES6+ 说法 |
|---|---|---|
| 变量存储 | 变量对象 VO / 活动对象 AO | **环境记录**（Environment Record） |
| 作用域 | 作用域链 | `[[OuterEnv]]` 链 |
| this | ThisBinding | `[[ThisValue]]` + `[[ThisBindingStatus]]` |
| 其他 | arguments、形参 | 同上 |

**ES6 的关键改进**：把"一个变量对象"拆成了**词法环境**和**变量环境**两个，让 `let/const` 的块级作用域和 `var` 的函数作用域能共存于同一个上下文里。

```js
function f() {
  var a = 1;      // 变量环境
  let b = 2;      // 词法环境
  {
    let c = 3;    // 新的词法环境（块级），outer 指向 f 的词法环境
    console.log(a, b, c);   // 1 2 3
  }
}
```

### 1.4.3 调用栈的执行过程

```js
function a() { b(); }
function b() { c(); }
function c() { console.log('done'); }

a();
```

```
      调用过程                          调用栈（从下到上）
 ┌─────────────┐
 │  a() 执行    │      ┌──────────┐
 │   └─ b()    │      │   c      │  ← 栈顶（当前执行）
 │       └─ c()│      ├──────────┤
 └─────────────┘      │   b      │
                      ├──────────┤
                      │   a      │
                      ├──────────┤
                      │ (global) │  ← 栈底
                      └──────────┘
```

**可验证的现象：**

```js
// 1) 栈溢出
function recurse() { recurse(); }
recurse();   // RangeError: Maximum call stack size exceeded（Node 22 实测约 9177 层）

// 2) 看当前调用栈
function c() { console.log(new Error().stack); }
function b() { c(); }
function a() { b(); }
a();
// Error
//     at c (demo.cjs:1:28)
//     at b (demo.cjs:2:16)
//     at a (demo.cjs:3:16)
//     at Object.<anonymous> (demo.cjs:4:1)     ← 路径前缀随运行位置变化，此处省略
// 后续是 Node 内部模块帧

// 3) 浏览器断点面板的 Call Stack 就是它
```

### 1.4.4 调用栈与"阻塞"的关系

```js
function sync() {
  const start = Date.now();
  while (Date.now() - start < 3000) {}   // 死循环 3 秒
  console.log('done');
}
sync();
console.log('after');   // 3 秒后才打印
```

在 `sync()` 执行期间，**调用栈一直不为空**，事件循环拿不到控制权：

- 不能执行任何其他 JS
- 不能响应用户点击（点击事件排在任务队列里等着）
- 不能渲染（渲染也要等主线程空闲）
- 甚至滚动都会卡住

> **这就是"为什么长任务会卡页面"的根因**：事件循环的规则是"**调用栈清空后才从队列里取下一个任务**"。所以一切"不阻塞"的方案（`setTimeout`、`Promise`、`requestIdleCallback`、Web Worker）本质都是"**把大任务拆小，或者挪出主线程**"。

### 1.4.5 答题模板

- **上下文**：代码运行时的环境，分全局、函数、`eval`、模块；创建阶段确定 `this`、建立词法环境（`let/const`）和变量环境（`var`）、挂外层引用，执行阶段逐行运行。
- **调用栈**：LIFO，函数调用压栈、返回出栈，栈顶是当前执行的函数；栈深有上限，递归过深抛 `RangeError`。
- **事件循环**：调用栈清空后才从任务队列取下一个任务；长任务占栈会阻塞点击与渲染。
- **非阻塞**：把大任务切片（`requestIdleCallback`、时间切片）或移出主线程（Worker），本质都是让调用栈尽快清空。

### 1.4.6 追问表

| 追问 | 答题要点 |
|---|---|
| 调用栈溢出怎么解决？ | 改迭代 / 尾递归（V8 未实现 TCO）/ 分片执行 / 加大栈（`--stack-size`，不推荐） |
| V8 的栈有多大？ | 默认上限约 1MB，递归大约 1 万层（随函数栈帧大小变化；Node 22 实测约 9177 层） |
| 为什么 `try/catch` 不能捕获异步错误？ | 异步回调执行时，原来的调用栈已经销毁了 |
| 执行上下文会一直存在吗？ | 不会，函数返回就出栈并被回收——**除非被闭包引用** |

---

## 1.5 this 的六种情况与优先级

### 1.5.0 一句话结论

> `this` 是**函数被调用时**才确定的（箭头函数除外），由**调用方式**决定，与定义位置无关。规则按优先级从高到低：**`new` 绑定 > 显式绑定（`bind` > `call`/`apply`）> 隐式绑定（`obj.fn()`）> 默认绑定（严格模式 `undefined`，非严格模式全局对象）**；箭头函数不参与这套规则，它的 `this` 在**定义时**从外层词法环境继承。

### 1.5.1 六种情况（含"没有 this"的箭头函数）

```js
// ① 默认绑定：独立函数调用
function f() { console.log(this); }
f();                    // 非严格：globalThis（浏览器 window）；严格：undefined

// ② 隐式绑定：作为对象方法调用
const obj = { name: 'obj', f() { console.log(this.name); } };
obj.f();                // 'obj'   ← this 是 obj

// ③ 显式绑定：call / apply / bind
f.call({ name: 'a' });  // this = { name: 'a' }
f.apply({ name: 'b' }); // 同上，区别是传参形式
const bound = f.bind({ name: 'c' });
bound();                // this = { name: 'c' }（永久绑定）

// ④ new 绑定：构造函数调用
function Person(name) { this.name = name; }
const p = new Person('Tom');   // this = 新创建的 p

// ⑤ 箭头函数：没有自己的 this，取定义时的外层
const arrow = () => console.log(this);
arrow();                // ESM 顶层：undefined；CJS 顶层：module.exports；浏览器 classic script：window

// ⑥ 特殊：DOM 事件处理、定时器等宿主环境回调
btn.addEventListener('click', function () {
  console.log(this);    // this = btn（currentTarget）
});
```

### 1.5.2 优先级：一条验证链

**`new` > `bind` > `call/apply` > 隐式 > 默认**

```js
function f() { console.log(this.tag); }

// ① 隐式 vs 默认 → 隐式赢
const o = { tag: 'implicit', f };
o.f();                                  // 'implicit'

// ② 显式 vs 隐式 → 显式赢
o.f.call({ tag: 'explicit' });          // 'explicit'

// ③ new vs 显式 → new 赢（call 被忽略）
const inst = new (f.bind({ tag: 'bound' }))();
console.log(inst.tag);                  // undefined ← this 是新对象，不是 bound 的那个

// ④ bind vs call → bind 赢（bind 的 this 改不掉）
const b = f.bind({ tag: 'bound' });
b.call({ tag: 'try-override' });        // 'bound'
```

> **注意第 ③ 条**：`new` 可以"穿透" `bind` 的 `this` 绑定，但 `bind` 预置的**参数**仍然生效（实测 `new (G.bind(null, 7))().x === 7`）。

### 1.5.3 隐式丢失：最常见的 bug 来源

```js
const user = {
  username: 'Tom',
  sayHi() { console.log(this.username); },
};

// ① 赋值给变量 → 变成默认绑定
const fn = user.sayHi;
fn();                          // 非严格：this = globalThis → undefined；严格：TypeError

// ② 作为回调传递
setTimeout(user.sayHi, 100);   // 丢失（回调里的 this 不再指向 user）

// ③ 作为数组元素取出
const arr = [user.sayHi];
arr[0]();                      // 丢失

// ④ 嵌套函数
const obj2 = {
  label: 'outer',
  inner: {
    label: 'inner',
    f() {
      function g() { console.log(this.label); }
      g();                     // 丢失！this 不再指向 inner
    },
  },
};
obj2.inner.f();
```

**四种修复方式：**

```js
// 方案 1：bind（推荐，显式）
setTimeout(user.sayHi.bind(user), 100);

// 方案 2：箭头函数包一层（推荐，最直观）
setTimeout(() => user.sayHi(), 100);

// 方案 3：在定义处用箭头函数（class 场景常用）
class A {
  username = 'A';
  sayHi = () => console.log(this.username);   // 箭头函数作为实例属性，天然绑定
}

// 方案 4：call/apply 立即调用（用于一次性调用）
user.sayHi.call(user);
```

### 1.5.4 严格模式的影响

```js
'use strict';
function f() { return this; }
console.log(f());                 // undefined（非严格：globalThis）
console.log(f.call(undefined));   // undefined
console.log(f.call(null));        // null
console.log(f.call(1));           // 1

// 非严格模式：call(null/undefined) → 全局对象；call(1) → Number 包装对象
// 严格模式：null/undefined/原始值都保持原样
```

### 1.5.5 class 里的 this：为什么更容易出问题

```js
class Counter {
  count = 0;
  inc() { this.count++; }
}

const c = new Counter();
const fn = c.inc;
fn();   // ❌ TypeError: Cannot read properties of undefined (reading 'count')
```

**两个原因叠加：**

1. `class` 内部的代码**默认是严格模式**，所以 `this` 是 `undefined` 而不是 `window`。
2. 方法定义在 `Counter.prototype` 上，不是实例自身属性，取出来调用就丢了接收者。

**三种解法：**

```js
// ① 构造函数里 bind
class A {
  constructor() { this.inc = this.inc.bind(this); }
  inc() {}
}

// ② 箭头函数作为实例字段（最常用）
class B {
  inc = () => { this.count++; };
}

// ③ 调用时 bind / 用箭头包（使用方负责）
button.addEventListener('click', () => c.inc());
```

### 1.5.6 答题模板

- **时机与规则**：`this` 在函数调用时确定，由调用方式决定；优先级 `new` > `bind` > `call/apply` > 隐式 `obj.fn()` > 默认绑定。
- **默认绑定**：严格模式 `undefined`；非严格模式全局对象（浏览器 `window`，Node `globalThis`）。
- **显式绑定**：`bind` 的 `this` 永久生效，但 `new` 能覆盖它；预置参数仍然保留。
- **常见坑**：把方法赋值给变量、当回调、从数组取出、嵌套函数调用都会丢失 `this`；用 `bind` 或箭头函数包一层。
- **class**：内部默认严格模式，方法丢了接收者就是 `undefined`，直接 `TypeError`。

### 1.5.7 追问表

| 追问 | 答题要点 |
|---|---|
| `bind` 能改两次吗？ | 不能，第一次 `bind` 的 `this` 永久生效 |
| `new` 能覆盖 `bind` 的 this 吗？ | 能，`new` 优先级更高（但参数保留） |
| `f.call(1)` 的 `this`？ | 非严格：`Number` 包装对象；严格：`1` |
| `this` 能在运行时用 `Object.defineProperty` 改吗？ | 不能，`this` 不是对象属性，是执行上下文的内部槽 |

---

## 1.6 箭头函数

### 1.6.0 一句话结论

> 箭头函数不是"更短的 `function`"，它是**另一类函数**：没有自己的 `this`、`arguments`、`super`、`new.target`，没有 `prototype`，**不能被 `new`**，不能用 `yield`。它的 `this` 在**定义时**从外层词法环境继承，且**永久不可变**（`call`/`apply`/`bind` 都改不了）。

### 1.6.1 五个"没有"

| 没有 | 后果 |
|---|---|
| **没有自己的 `this`** | 取定义时外层的 `this`；`call/apply/bind` 全部无效 |
| **没有 `arguments`** | 要用 rest 参数 `(...args)` 代替 |
| **没有 `prototype`** | `arrow.prototype === undefined` → 不能 `new`（`TypeError: ... is not a constructor`） |
| **没有 `super` / `new.target`** | 不能用于 `class` 的 `extends` 里的 `super()` 调用 |
| **不能作为 `Generator`** | `function*` 和 `()=>` 不能组合 |

```js
const arrow = () => {};
console.log(arrow.prototype);         // undefined
console.log(arrow.hasOwnProperty('prototype'));  // false
// new arrow();                       // ❌ TypeError: arrow is not a constructor

console.log(typeof arrow);            // 'function' ← 注意：typeof 仍然是 function
```

> 判断能否 `new` 看的是内部槽 `[[Construct]]`，不是 `typeof`。`class` 同理：`typeof` 是 `'function'`，但直接调用会抛 `TypeError`。

### 1.6.2 `this` 指向：定义时决定，且改不了

```js
const obj = {
  username: 'obj',
  // ① 普通函数：this 由调用方式决定
  normal() { return this.username; },
  // ② 箭头函数：this 是定义时的外层（这里是模块/全局）
  arrow: () => this.username,
};

console.log(obj.normal());          // 'obj'
console.log(obj.arrow());           // CJS/浏览器脚本：undefined；ESM：TypeError（外层 this 为 undefined）

// ③ 尝试修改 → 无效
console.log(obj.arrow.call({ username: 'x' }));   // 同上，call 改不了
```

```js
// ④ 嵌套场景：箭头函数捕获的是"最近的非箭头函数"的 this
const counter = {
  count: 0,
  start() {
    // 这里的 this 是 counter
    setInterval(() => {
      this.count++;      // ✅ 箭头函数继承 start 的 this
    }, 1000);
  },
};

// 对比例子：ES5 时代要写 var that = this
const counter5 = {
  count: 0,
  start: function () {
    var that = this;
    setInterval(function () {
      that.count++;      // 只能靠 that
    }, 1000);
  },
};
```

### 1.6.3 什么场景**不该**用箭头函数

```js
// ❌ 1. 对象方法（想用 this 访问自身属性）
const bad1 = {
  username: 'x',
  getUsername: () => this.username,     // this 是外层，取不到
};

// ❌ 2. 原型方法
function Foo() {}
Foo.prototype.bar = () => { this.xxx };   // this 不是实例

// ❌ 3. 构造函数
const Person = (name) => { this.name = name; };
new Person('x');                // TypeError: Person is not a constructor

// ❌ 4. 需要动态 this 的回调（如 Vue2 的 methods 里需要 this 指向组件）
//    箭头函数拿不到组件实例，所以不推荐

// ❌ 5. 需要 arguments 的函数
const sum = () => arguments;    // arguments 来自外层，通常不是你想要的

// ❌ 6. 需要 yield 的生成器

// ❌ 7. 事件处理里需要 event.currentTarget 作为 this
btn.addEventListener('click', () => {
  console.log(this);   // 不是 btn
});
```

**一句话判断法**：

> **如果这个函数体内需要用 `this` 指向"调用它的那个对象"，就不要用箭头函数。** 其余情况（纯计算、回调、需要外层 `this`）优先箭头函数。

### 1.6.4 箭头函数的其他特性

```js
// ① 返回对象字面量要加括号
const f1 = () => { name: 'x' };   // 代码块 + 标签，返回 undefined
const f2 = () => ({ name: 'x' }); // ✅ 返回对象

// ② 单表达式自动 return
const double = (n) => n * 2;

// ③ 单参数可省括号（Prettier 默认 always）
const inc = n => n + 1;

// ④ 没有 arguments，用 rest
const sum = (...nums) => nums.reduce((a, b) => a + b, 0);

// ⑤ 可作 tag 函数：s.raw 是原始字符串数组
const tag = (s, ...v) => s.raw.join('|');
tag`a${1}b`;                      // 'a|b'

// ⑥ 箭头函数也可以有 name（推断）
const named = () => {};
console.log(named.name);   // 'named'
```

### 1.6.5 答题模板

- **五个没有**：没有自己的 `this`、`arguments`、`prototype`、`super`/`new.target`，不能作 `Generator`。
- **this**：定义时从外层词法环境继承，`call`/`apply`/`bind` 都改不了。
- **不能 new**：没有 `prototype` 和 `[[Construct]]`，`typeof` 仍是 `'function'`。
- **适用**：纯计算、回调、需要外层 `this`；不适用对象方法、原型方法、构造函数、需要动态 `this` 或 `arguments` 的场景。

### 1.6.6 追问表

| 追问 | 答题要点 |
|---|---|
| 箭头函数有 `arguments` 吗？ | 没有自己的，但能访问**外层**的 `arguments`（CJS 顶层是模块包装函数的 arguments；ESM 顶层没有） |
| 箭头函数能用于 `class` 的方法吗？ | 能作为**实例字段**（`inc = () => {}`），这才是它绑 `this` 的用法 |
| 箭头函数和 `bind` 的区别？ | 箭头函数是**定义时**绑定且不可改；`bind` 是**调用时**显式绑定，也是永久的，但 `new` 能覆盖 `bind` |
| 为什么 React 里推荐箭头函数？ | class 组件时代方法需要绑定 `this`；函数组件里是配合 `useCallback` 避免每次渲染重建函数 |

---

## 1.7 闭包

### 1.7.0 一句话结论

> 闭包 = **函数 + 它被创建时所在的词法环境**。它让内层函数能访问外层函数的变量，**即使外层函数已经执行完毕返回了**。本质是函数对象通过内部槽 `[[Environment]]` 记住了当时的环境，导致那些变量无法被 GC 回收。

### 1.7.1 最小例子与"为什么"

```js
function outer() {
  let count = 0;
  return function inner() {
    count++;
    return count;
  };
}

const inc = outer();   // outer 已经执行完了
inc();   // 1
inc();   // 2
inc();   // 3
```

**关键问题**：`outer` 都执行完了，`count` 为什么还在？

```
执行 outer() 时：
  ┌─ outer 的执行上下文
  │    词法环境: { count: 0 }
  │    ↑
  │    └── inner 函数对象的 [[Environment]] 指向这里
  └─ outer 返回 inner

outer 出栈后：
  正常情况下，执行上下文会被销毁，count 应该被回收
  但 inner 的 [[Environment]] 还引用着那个词法环境
  → 可达性分析认为它仍然"可达" → 不回收
  → 所以 inc() 每次还能读写 count
```

**一句话解释**：闭包不是"把变量复制进函数"，而是"**函数持有了环境的引用**"。所以多个闭包共享同一个环境。

### 1.7.2 作用域链视角：闭包就是作用域链的"超期存活"

```js
function makeAdders() {
  const result = [];
  for (var i = 0; i < 3; i++) {
    result.push(function () { return i; });   // 三个闭包共享同一个 i
  }
  return result;
}
console.log(makeAdders().map((f) => f()));   // [3, 3, 3]

// 修复 1：IIFE 造新作用域
function makeAdders2() {
  const result = [];
  for (var i = 0; i < 3; i++) {
    result.push((function (n) { return function () { return n; }; })(i));
  }
  return result;
}
console.log(makeAdders2().map((f) => f()));   // [0, 1, 2]

// 修复 2：改用 let（每轮新绑定）
function makeAdders3() {
  const result = [];
  for (let i = 0; i < 3; i++) {
    result.push(() => i);
  }
  return result;
}
console.log(makeAdders3().map((f) => f()));   // [0, 1, 2]
```

### 1.7.3 六大实用场景

```js
// ① 数据私有化（模块模式 / 计数器）
function createCounter() {
  let count = 0;
  return {
    inc: () => ++count,
    dec: () => --count,
    get: () => count,
  };
}

// ② 函数工厂
const makeMultiplier = (n) => (x) => x * n;
const double = makeMultiplier(2);
const triple = makeMultiplier(3);

// ③ 防抖
function debounce(fn, delay = 300) {
  let timer = null;                  // ← 闭包保存 timer
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ④ 节流
function throttle(fn, wait = 200) {
  let last = 0;                      // ← 闭包保存 last
  return function (...args) {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn.apply(this, args);
    }
  };
}

// ⑤ 柯里化
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) return fn.apply(this, args);
    return (...rest) => curried(...args, ...rest);
  };
}

// ⑥ 单例 / 缓存（记忆化）
function memoize(fn, { cache = new Map() } = {}) {
  return function (key) {
    if (!cache.has(key)) cache.set(key, fn.call(this, key));
    return cache.get(key);
  };
}
```

### 1.7.4 闭包与内存：到底会不会泄漏

**准确的说法**：

> 闭包**本身不是内存泄漏**，它是**延长了变量的生命周期**——这是设计意图。只有当"**你不再需要的引用被闭包持续持有，且无法释放**"时，才叫泄漏。

```js
// ❌ 长生命周期对象持有闭包：监听器挂在 window 上且不解绑
function attach() {
  const hugeData = new Array(1e6).fill('x');
  window.addEventListener('resize', () => {
    console.log(hugeData.length);   // window 一直可达 → 闭包 → hugeData 一直可达
  });
}
// ✅ 保存同一个函数引用，在不需要时解绑
function attachFixed() {
  const hugeData = new Array(1e6).fill('x');
  const onResize = () => console.log(hugeData.length);
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
}

// ❌ 真泄漏：定时器没清
function start() {
  const data = new Array(1e6).fill('x');
  setInterval(() => console.log(data.length), 1000);
  // → 定时器一直跑，data 一直不释放
}
// ✅ 修复：保存 timer id，组件卸载时 clearInterval

// ❌ 常见误区：认为所有闭包都泄漏
function normal() {
  let x = 1;
  return () => x;   // 只持有 x，x 是数字，无所谓"泄漏"
}
```

监听器挂在会被移除、且之后不再被引用的元素上时，现代标记清除可以回收这个环；真正泄漏的是**长生命周期目标持有闭包**，或**已移除节点仍被 JS 引用**。

**现代引擎的优化（V8）**：V8 会做**上下文分配优化**——只有被闭包引用的变量才会被放进 `Context` 对象；同一作用域内未被引用的变量仍然可以回收。

```js
function f() {
  const big = new Array(1e6);      // 没被内层函数引用
  const small = 1;                 // 被引用
  return () => small;              // big 不进 Context，可以回收
}
```

Node 22 + `--expose-gc` 实测：被闭包引用的 `big` 仍可达；未被引用的 `big` 在下一轮任务后已被回收。

> 注意：**不要依赖这个优化**：在 `eval`、`with`、或者引擎无法静态分析的情况下，整个作用域都会被保留。写代码时该清的还是要清。

### 1.7.5 闭包的经典考察：循环 + 定时器 + 事件

```js
// 题目：点击每个 li 输出对应索引（5 种解法）
// ① let
for (let i = 0; i < lis.length; i++) {
  lis[i].onclick = () => console.log(i);
}

// ② IIFE
for (var i = 0; i < lis.length; i++) {
  (function (n) { lis[n].onclick = () => console.log(n); })(i);
}

// ③ 自定义属性
for (var i = 0; i < lis.length; i++) {
  lis[i].index = i;
  lis[i].onclick = function () { console.log(this.index); };
}

// ④ 事件委托（只在父节点挂一个监听器）
ul.addEventListener('click', (e) => {
  const li = e.target.closest('li');
  console.log([...ul.children].indexOf(li));
});

// ⑤ bind 预置参数
for (var i = 0; i < lis.length; i++) {
  lis[i].onclick = function (n) { console.log(n); }.bind(null, i);
}
```

### 1.7.6 答题模板

- **定义**：闭包是函数和它创建时所处词法环境的组合；`[[Environment]]` 让外层变量在函数返回后仍然可达。
- **共享**：多个闭包共享同一环境，所以 `for (var i)` 的回调都读到最终值；`let`、IIFE、`bind` 可以各捕获一份。
- **用途**：数据私有化、函数工厂、防抖、节流、柯里化、单例/记忆化。
- **内存**：闭包延长生命周期但不是泄漏；泄漏是长生命周期引用（未解绑监听、未清定时器）持有不再需要的数据。

### 1.7.7 追问表

| 追问 | 答题要点 |
|---|---|
| 闭包存在哪？ | 函数对象的内部槽 `[[Environment]]` 指向环境记录 |
| 怎么释放闭包占的内存？ | 解除引用（置 `null`）、清定时器、解绑监听、避免长期持有 DOM |
| 闭包和立即执行函数（IIFE）的关系？ | IIFE 用来**创建**一个私有作用域，配合闭包导出接口（模块模式） |
| 闭包在 React/Vue 里的体现？ | React Hooks 的"闭包陷阱"（`useEffect` 依赖缺失拿到旧值）、Vue 的 `computed` 缓存 |

---

## 1.8 本册答题模板汇总

### 1.8.1 一句话版

```
① let/const/var  → 作用域不同：函数级 vs 块级；提升后是否初始化不同；const 绑不可变
② 作用域          → 变量可见的静态范围；作用域链沿 [[Environment]] 向外找，词法决定
③ 执行上下文      → 创建（this+环境）+ 执行；调用栈 LIFO，栈空才取任务
④ this            → 调用时决定：new > bind > call/apply > 隐式 > 默认；箭头取外层
⑤ 箭头函数        → 没有 this/arguments/prototype/super/new.target，不能 new
⑥ 闭包            → 函数 + 词法环境；状态私有化 + 延长生命周期
```

### 1.8.2 三句话把六题串起来

- **作用域**决定变量在哪，**执行上下文**决定代码在哪跑。
- **this** 决定函数里的"我"是谁；**箭头函数**把它从"调用时"改成了"定义时"。
- **闭包**让作用域在函数返回后还能活着；**let/const** 把作用域的边界从"函数"细化到了"块"。
- Vue3 的 `composable`、React Hooks 的闭包陷阱，都建立在这套词法环境与闭包机制上。

---

## 1.9 速记卡与连环追问

### 1.9.1 速记卡

```
【let/const/var】
  作用域: 函数 / 块 / 块
  提升:   全提升；var 初始化为 undefined，let/const 落 TDZ
  重复声明: 可 / 不可 / 不可
  挂 window（classic script）: 是 / 否 / 否
  初始化: 可省 / 可省 / 必须
  循环绑定: 共用 / 每轮新建 / 每轮新建

【TDZ】typeof tdzVar 会抛 ReferenceError（不是返回 'undefined'）
       遮蔽在"进入块"时发生，不是"声明语句"时

【作用域链】[[Environment]] → [[OuterEnv]] → ... → 全局 → null
            词法（静态），看定义位置；与调用栈无关

【执行上下文】创建阶段（this + 词法环境 + 变量环境 + outer）→ 执行阶段
              调用栈 LIFO；栈空才取任务 → 长任务卡页面的根因

【this 优先级】new > bind > call/apply > 隐式 obj.fn() > 默认
              严格模式默认 undefined；非严格模式全局对象（浏览器 window，Node globalThis）
              call(null) 非严格 → 全局对象；call(1) 非严格 → Number 对象

【箭头函数】五没有：this / arguments / prototype / super / new.target
            不能 new、不能 yield、this 不可改
            不该用：对象方法、原型方法、构造函数、需要动态 this 的事件回调

【闭包】函数 + 词法环境；状态私有 + 延长生命周期
        for(var) 共享同一绑定 → 全输出末值；let / IIFE / bind 解决
        本身不是泄漏；泄漏 = 该释放的引用被持住

【顶层 var】浏览器 classic script 挂 window；CJS 是模块包装函数作用域，ESM 是模块作用域，均不挂 globalThis
```

### 1.9.2 连环追问

按 1.1 → 1.7 的追问表顺序过。五条主线：

1. `let` 有提升，但未初始化 → TDZ；`typeof` 也抛 `ReferenceError`。
2. `for (let i)` 每轮新绑定来自 `CreatePerIterationEnvironment`，是 `for` 语句专属。
3. `this` 在调用时创建执行上下文的那一刻确定；箭头函数不创建自己的 `ThisBinding`。
4. 闭包通过 `[[Environment]]` 持有环境，变量因此可达；可达不等于泄漏。
5. 顶层 `var` 只在浏览器 classic script 挂 `window`；CJS 是模块包装函数作用域，ESM 是模块作用域。
