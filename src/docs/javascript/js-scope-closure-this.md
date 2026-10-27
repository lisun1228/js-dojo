# JS · 02 作用域 · 闭包 · this · 执行上下文

> 本册覆盖：`var`/`let`/`const`、闭包、`this`、箭头函数、作用域、执行上下文与调用栈
> 这四块是**同一件事的四个侧面**：执行上下文决定「变量存哪」，作用域链决定「变量怎么找」，闭包决定「变量活多久」，`this` 决定「函数里的 this 是谁」。
> 代码输出为 Node 22（CommonJS 脚本）实跑结果；浏览器或 ESM 有差异时单独标注。

---

## 目录

- [2.1 一句话结论](#21-一句话结论)
- [2.2 `var` / `let` / `const`](#22-var--let--const)
- [2.3 作用域与作用域链](#23-作用域与作用域链)
- [2.4 执行上下文与调用栈](#24-执行上下文与调用栈)
- [2.5 闭包](#25-闭包)
- [2.6 `this`](#26-this)
- [2.7 箭头函数](#27-箭头函数)
- [2.8 十二道输出题（这是题单 101~323 被折叠的部分）](#28-十二道输出题这是题单-101323-被折叠的部分)
- [2.9 常见坑](#29-常见坑)
- [2.10 答题模板](#210-答题模板)
- [2.11 速记卡](#211-速记卡)

---

## 2.1 一句话结论

**执行上下文**是函数/全局代码执行时的「环境记录」，包含变量环境、词法环境和 `this`。
**作用域链**是「当前环境 + 外层环境」组成的链表，**在函数定义时就确定了（词法作用域）**。
**闭包**是「函数 + 它引用的词法环境」——只要函数活着，被引用的变量就不回收。
**`this`** 是执行上下文里的一个特殊绑定，**由调用方式决定**（箭头函数除外）。

---

## 2.2 `var` / `let` / `const`

### 2.2.1 六个维度对比

| 维度 | `var` | `let` | `const` |
|---|---|---|---|
| **作用域** | **函数作用域**（或全局） | **块级作用域** `{}` | **块级作用域** |
| **提升** | ✅ 提升，初始化为 `undefined` | ✅ 提升，但**不初始化**（TDZ） | ✅ 同 `let` |
| **TDZ（暂时性死区）** | ❌ 无 | ✅ 有 | ✅ 有 |
| **重复声明** | ✅ 允许 | ❌ 报错 | ❌ 报错 |
| **挂到全局对象** | ✅ 浏览器脚本 / Node REPL | ❌ | ❌ |
| **必须初始化** | ❌ | ❌ | ✅ **必须** |

### 2.2.2 逐条验证（Node 22 实测）

```js
// ① 作用域
{ var a = 1; }
console.log(a);          // 1        ← var 逃出块
{ let b = 2; }
console.log(b);          // ReferenceError: b is not defined

// ② 提升 + TDZ
console.log(typeof c);   // 'undefined'   ← var 提升并初始化
var c = 1;

console.log(d);          // ReferenceError: Cannot access 'd' before initialization
let d = 2;

// ③ 重复声明
var e = 1; var e = 2;    // 允许
let f = 1; let f = 2;    // SyntaxError: Identifier 'f' has already been declared

// ④ 全局对象
var g = 1;
console.log(globalThis.g);   // 浏览器脚本 / Node REPL: 1；Node CJS 文件: undefined
let h = 2;
console.log(globalThis.h);   // undefined

// ⑤ const 必须初始化
const i;                 // SyntaxError: Missing initializer in const declaration
```

### 2.2.3 「提升」到底提升的是什么（这是理解 TDZ 的关键）

**`var` 的提升**：声明提到作用域顶部，并**初始化为 `undefined`**；赋值留在原地。

**`let` / `const` 的提升**：声明**也**被提升，但**不初始化**——变量存在，却处于「未初始化」状态。

```js
console.log(x);   // undefined   ← var：提升 + 初始化
var x = 1;

console.log(y);   // ReferenceError: Cannot access 'y' before initialization
let y = 1;
```

**所以「TDZ」不是「变量不存在」，而是「变量存在但未初始化，访问就报错」。**

**TDZ 的边界**：

```js
// 从「块开始」到「声明语句执行完」为止
{
  typeof z;      // ReferenceError: Cannot access 'z' before initialization
  let z = 1;
  // 去掉上一行后，typeof z 才会得到 'number'
}

// 函数参数默认值里也有 TDZ
function f(a = b, b = 2) {}
f();             // ReferenceError: Cannot access 'b' before initialization
// 改成 function f(a = 2, b = a) 即可
```

**⚠️ `typeof` 在 TDZ 里也会报错**——这是 `typeof` 唯一不安全的情况（对完全未声明的变量是安全的）。

### 2.2.4 为什么 `const` 不是「不可变」

```js
const obj = { a: 1 };
obj.a = 2;           // 合法
obj = {};            // TypeError: Assignment to constant variable.
```

```js
const frozen = Object.freeze({ a: 1 });
frozen.a = 2;        // 非严格静默失败，严格模式 TypeError

const o = Object.freeze({ nested: { a: 1 } });
o.nested.a = 2;      // 能改：Object.freeze 是浅冻结
```

**`const` 保证的是「绑定不可变」（不能重新赋值），不是「值不可变」。** 要真正不可变得递归冻结：

```js
function deepFreeze(obj) {
  Object.getOwnPropertyNames(obj).forEach((key) => {
    const v = obj[key];
    if (v && typeof v === 'object') deepFreeze(v);
  });
  return Object.freeze(obj);
}
```

---

## 2.3 作用域与作用域链

### 2.3.1 三种作用域

| 类型 | 说明 | 例子 |
|---|---|---|
| **全局作用域** | 最外层 | `var a = 1`（在顶层） |
| **函数作用域** | 函数内部 | `function f() { var b }` |
| **块级作用域** | `{}` 内部（ES6） | `if (x) { let c }` |

**⚠️ `for` 循环的 `let` 有个特殊行为**：

```js
for (let i = 0; i < 3; i++) {
  setTimeout(() => console.log(i));
}
// 0 1 2   ← 每轮都是新的 i

for (var j = 0; j < 3; j++) {
  setTimeout(() => console.log(j));
}
// 3 3 3   ← 共享同一个 j
```

**规范里 `for` 的 `let` 会为每轮迭代创建一个新环境**（`CreatePerIterationEnvironment`），并把上一轮的值复制过去。这是规范专门为 `for` + `let` 开的特例。

### 2.3.2 作用域链

```
查找变量 a：当前环境 → 外层函数 → ... → 全局对象
                          ↓ 都没有
                     ReferenceError
```

**关键：作用域链在「函数定义时」就确定了，不是调用时。**

```js
var x = 'global';

function outer() {
  var x = 'outer';
  function inner() {
    console.log(x);      // 'outer'
  }
  return inner;
}

const fn = outer();
var x = 'changed';
fn();                    // 'outer'  ← 不是 'changed'
```

**这就是「词法作用域（lexical scoping）」，也叫「静态作用域」**——JS 用的是这个，不是「动态作用域」。如果 JS 是动态作用域，`fn()` 会查调用者的作用域，输出 `'changed'`。

### 2.3.3 `with` 和 `eval` 能改作用域链（但不该用）

```js
// with：把对象的属性加到作用域链前端
const obj = { a: 1 };
with (obj) {
  console.log(a);       // 1
}

// eval：可以访问和修改当前作用域
function f() {
  var local = 1;
  eval('local = 2');
  console.log(local);   // 2
}
```

**为什么不该用**：
- **性能**：引擎无法静态确定作用域，优化受限
- **安全**：`eval` 执行字符串代码，存在代码注入风险
- **严格模式 / ESM 下 `with` 直接 `SyntaxError`**

---

## 2.4 执行上下文与调用栈

### 2.4.1 执行上下文的组成

```
执行上下文（Execution Context）
├── 词法环境（LexicalEnvironment）
│   └── 用于 let / const 声明
├── 变量环境（VariableEnvironment）
│   └── 用于 var 声明 / 函数声明
├── this 绑定（ThisBinding）
└── 外部环境引用（OuterEnv）  ← 指向外层，构成作用域链
```

**为什么要分两套环境**：因为 `var` 提升并初始化为 `undefined`（放变量环境），`let` 提升但不初始化（放词法环境，处于 TDZ，见 2.2.3）。

### 2.4.2 三种执行上下文

| 类型 | 什么时候创建 |
|---|---|
| **全局** | 脚本加载时，只有 1 个 |
| **函数** | 每次调用函数时 |
| **`eval`** | `eval()` 执行时（不推荐） |

### 2.4.3 调用栈（Call Stack）

```js
function a() { b(); }
function b() { c(); }
function c() { console.log(new Error().stack); }
a();
```

**栈的变化**：

```
a() 调用 → [global, a]      b() 调用 → [global, a, b]
c() 调用 → [global, a, b, c]   返回时逐层弹出，直到 [global]
```

**栈溢出的原因**：

```js
function recurse() { recurse(); }
recurse();    // RangeError: Maximum call stack size exceeded
```

Node 22 下这个简单递归实测约 **9 千层**后抛 `RangeError`；深度取决于每帧大小，**不要依赖具体数字**。

### 2.4.4 一个执行上下文相关的经典坑

```js
var a = 1;
function f() {
  console.log(a);    // undefined  ← 不是 1！
  var a = 2;
}
f();
```

**为什么**：函数作用域内有 `var a`，声明被提升到函数顶部并初始化为 `undefined`，**遮蔽了外层的 `a = 1`**。规则同 2.2.3，术语叫「变量遮蔽（shadowing）」。

---

## 2.5 闭包

### 2.5.1 定义（要说得比「函数套函数」准确）

> **闭包 = 函数 + 它被创建时的词法环境。**
> 即使函数在外层作用域之外被调用，它仍然能访问那个词法环境里的变量。

**关键点：闭包不是「函数套函数」的语法形式，而是「函数 + 它创建时的词法环境」；函数引用了外层变量，这个环境就要随函数一起保留。**

```js
function outer1() {
  let x = 1;
  function inner() { return 'hi'; }   // 不引用 x：x 不需要被保留
  return inner;
}

function outer2() {
  let x = 1;
  function inner() { return x; }      // 引用 x：形成闭包
  return inner;
}
```

### 2.5.2 原理：`[[Environment]]` 内部槽

**每个函数对象在创建时，都会记录当时的词法环境**，存在内部槽 `[[Environment]]` 里。

```
函数对象 inner
├── [[Call]]          → 可执行代码
├── [[Environment]]   → 指向 outer 的词法环境  ← 闭包的实现
└── [[ThisMode]]      → 是否词法 this
```

**当 `inner` 执行时**：创建新的执行上下文，其 `OuterEnv` 指向 `inner.[[Environment]]`——所以能访问 `x`。

**V8 里的实现**：

| 概念 | V8 实现 |
|---|---|
| 词法环境 | **`Context` 对象**（堆上分配） |
| 被闭包引用的变量 | 从栈上「**上下文化（contextify）**」搬到 `Context` 里 |
| 没被引用的变量 | **留在栈上**，函数返回就销毁 |

```js
function outer() {
  let used = 1;       // 被闭包引用 → 放进 Context，闭包活着就不回收
  let unused = 2;     // 没被引用 → 留在栈上，函数返回即销毁
  return () => used;
}
```

**V8 在作用域分析阶段决定变量是否分配进 `Context`**：只有真正被内层函数引用的变量才需要上堆，不是所有局部变量都被闭包保留。

### 2.5.3 五个真实用途

**① 私有变量 / 数据封装**

```js
function createCounter() {
  let count = 0;                     // 外部无法直接访问
  return {
    inc: () => ++count,
    dec: () => --count,
    get: () => count,
  };
}

const c1 = createCounter();
c1.inc(); c1.inc(); c1.dec();
console.log(c1.get());      // 1
console.log(c1.count);      // undefined  ← 访问不到

const c2 = createCounter();
console.log(c2.get());      // 0  ← 两个实例互不影响
```

**② 函数工厂 / 偏函数**

```js
function makeMultiplier(factor) {
  return (n) => n * factor;
}
const double = makeMultiplier(2);
const triple = makeMultiplier(3);
double(5);    // 10
triple(5);    // 15
```

**③ 缓存 / 记忆化（memoize）**

```js
function memoize(fn) {
  const cache = new Map();           // 被闭包持有
  return function (...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}
```

**④ 一次性初始化（模块模式）**

```js
const config = (() => {
  const raw = loadFromEnv();         // 只执行一次
  return { api: raw.API_URL };
})();
```

**⑤ 事件处理里保留上下文**

```js
function bindHandlers(element, data) {
  element.addEventListener('click', () => {
    console.log(data);               // 闭包保留 data
  });
}
```

### 2.5.4 三个坑

**坑 1：循环里的 `var`（最经典）**

```js
const fns = [];
for (var i = 0; i < 3; i++) fns.push(() => i);
fns.map(f => f());        // [3, 3, 3]
```

**为什么**：`var` 共享同一个绑定（见 2.3.1），循环结束时 `i` 是 3。

**三种解法**：

```js
// ① 用 let（每轮新环境）
for (let i = 0; i < 3; i++) fns.push(() => i);
// [0, 1, 2]

// ② IIFE（手动造新环境）
for (var i = 0; i < 3; i++) fns.push(((n) => () => n)(i));
// [0, 1, 2]

// ③ 用 setTimeout 的第三参数（IIFE 的变体）
for (var i = 0; i < 3; i++) setTimeout((n) => console.log(n), 0, i);
// 0 1 2
```

**坑 2：闭包不一定泄漏（这是最常见的误解）**

```js
// 不是泄漏：函数返回后，如果没人引用，整个闭包会被 GC
function f() {
  const big = new Array(1e6).fill(0);
  return () => big.length;
}
f();     // 返回值没被保存 → 闭包可被回收

// 这才是泄漏：引用被长期持有
let leak;
function g() {
  const big = new Array(1e6).fill(0);
  leak = () => big.length;    // 模块级变量长期持有 → 只要 leak 在，big 就不回收
}
```

**准确说法是：「闭包延长了变量的生命周期，但只有在引用不被释放时才构成泄漏」。**

**坑 3：`this` 在闭包里丢了**

```js
const obj = {
  name: 'obj',
  greet() {
    setTimeout(function () {
      console.log(this.name);      // undefined：this 不是 obj（Node 下是 Timeout 对象）
    }, 0);
  },
};

// 三种解法：让 setTimeout 回调拿到外层方法里的 this
const fixes = {
  name: 'obj',
  arrow() { setTimeout(() => console.log(this.name), 0); },
  self() { const self = this; setTimeout(function () { console.log(self.name); }, 0); },
  bound() { setTimeout(function () { console.log(this.name); }.bind(this), 0); },
};
```

**浏览器非严格下普通回调的 `this` 是全局对象，严格 / ESM 下是 `undefined`；Node 定时器则固定把 `this` 设为 `Timeout` 对象。**

---

## 2.6 `this`

### 2.6.1 六种绑定（按优先级）

| # | 绑定类型 | 场景 | `this` 是什么 |
|---|---|---|---|
| **1** | **`new` 绑定** | `new Fn()` | **新创建的对象**（优先级最高） |
| **2** | **显式绑定** | `fn.call(obj)` / `apply` / `bind` | 传入的对象 |
| **3** | **隐式绑定** | `obj.fn()` | `obj`（最后那个 `.` 前面的对象） |
| **4** | **默认绑定** | `fn()` | 严格模式 `undefined`，非严格 `globalThis` |
| **5** | **词法绑定** | 箭头函数 | **外层作用域的 `this`**（不参与上面所有规则） |
| **6** | **全局顶层** | 脚本顶层 `this` | 浏览器脚本：`globalThis`；CJS：`module.exports`；ESM：`undefined` |

**前五种按优先级：`new` > `bind` > `call/apply` > 隐式 > 默认。**

**验证**：

```js
// new > bind
function H() { this.t = 'new'; }
const B = H.bind({ t: 'bound' });
new B().t;                    // 'new'

// bind > 隐式
const o = {
  n: 'obj',
  f: function () { return this.n; }.bind({ n: 'bound' }),
};
o.f();                        // 'bound'

// 隐式 > 默认
const o2 = { n: 'obj', f() { return this.n; } };
o2.f();                       // 'obj'
const detached = o2.f;
detached();                   // undefined（默认绑定；Node 的 globalThis.n 也是 undefined）
```

### 2.6.2 隐式绑定的「丢失」问题（最高频的坑）

```js
const obj = {
  name: 'obj',
  greet() { return this.name; },
};

obj.greet();                        // 'obj'

const fn = obj.greet;               // ← 赋值给变量，绑定丢失
fn();                               // undefined

setTimeout(obj.greet, 0);           // 回调里 this 是 Timeout 对象，不是 obj
[1].map(obj.greet);                 // [undefined]  ← 回调里 this 不是 obj
const { greet } = obj; greet();     // undefined  ← 解构
(obj.greet)();                      // 'obj'      ← 括号不影响引用
(0, obj.greet)();                   // undefined  ← 逗号运算符返回纯函数值
```

`setTimeout` 在 Node 里把回调的 `this` 设为 `Timeout` 对象（浏览器非严格下是全局对象，严格 / ESM 下是 `undefined`），都不是 `obj`。

**核心规则：`this` 看的是「调用时」的表达式形式，不是「定义时」。**

`obj.greet()` 是 `MemberExpression` 调用 → `this = obj`；`fn()` 是普通调用 → 默认绑定。

**`(0, obj.greet)()` 为什么丢失**：逗号运算符返回的是**值**（函数本身），不是引用，所以没有「基准对象」。

### 2.6.3 严格模式的影响

```js
function sloppy() { return this === globalThis; }
function strict() { 'use strict'; return this; }

sloppy();       // true          ← 非严格：this 就是 globalThis
strict();       // undefined     ← 严格：保持 undefined
```

**模块（ESM）默认就是严格模式**，所以模块里的顶层 `this` 是 `undefined`（不是 `globalThis`）。Node 的 CJS 文件顶层 `this` 则是 `module.exports`。

```js
// ESM 模块顶层
console.log(this);       // undefined
console.log(globalThis); // 全局对象
```

### 2.6.4 几个特殊场景

```js
// ① 原始值会被「装箱」
function f() { return typeof this; }
f.call(1);          // 'object'   ← 1 被装箱成 Number 对象（非严格）
f.call('a');        // 'object'

// 严格模式下不装箱
function strictF() { 'use strict'; return typeof this; }
strictF.call(1);    // 'number'
strictF.call('a');  // 'string'

// ② call(null) / call(undefined) 走默认绑定
f.call(null);       // 非严格：this = globalThis；严格：this = null

// ③ 类的方法默认是严格模式
class A {
  m() { return this; }
}
const m = new A().m;
m();                // undefined（类内部强制严格）
```

---

## 2.7 箭头函数

### 2.7.1 与普通函数的七个差异

| # | 差异 | 普通函数 | 箭头函数 |
|---|---|---|---|
| 1 | **`this`** | 动态绑定（看调用方式） | **词法绑定**（看定义位置） |
| 2 | **`arguments`** | ✅ 有自己的 | ❌ **没有**，沿作用域链找外层 |
| 3 | **`new`** | ✅ 可以 | ❌ **不能**，报 `is not a constructor` |
| 4 | **`prototype`** | ✅ 有 | ❌ **没有**（`undefined`） |
| 5 | **`super`** | 方法里可用 | ❌ 不能用（除了在类字段里） |
| 6 | **`yield`** | 生成器函数里可用 | ❌ 不能做生成器 |
| 7 | **`call/apply/bind`** | ✅ 能改 `this` | ❌ **忽略 thisArg**（但参数照传） |

```js
const arrow = () => {};
new arrow();              // TypeError: arrow is not a constructor
arrow.prototype;          // undefined
```

### 2.7.2 为什么箭头函数不能 `new`

**因为 `new` 需要两样东西，箭头函数都没有**：

1. **`[[Construct]]` 内部方法**——箭头函数只实现了 `[[Call]]`
2. **`prototype` 属性**——`new` 要把 `obj.__proto__` 指向 `Fn.prototype`

**规范里，箭头函数创建时不设置 `[[Construct]]`**，所以 `new` 直接抛错。同理，方法简写也不能 `new`：

```js
const o1 = { m() {} };
new o1.m();               // TypeError: o1.m is not a constructor

const o2 = { m: function () {} };
new o2.m();               // 可以
```

**对象字面量的方法简写（`m() {}`）在 ES6 里也被定义为没有 `[[Construct]]`。**

### 2.7.3 什么时候用箭头函数

| 场景 | 用什么 | 原因 |
|---|---|---|
| **回调函数**（`map`/`filter`/`setTimeout`） | ✅ 箭头 | 不需要自己的 `this`/`arguments` |
| **需要 `this` 指向外层**（类方法里的回调） | ✅ 箭头 | 天然绑定 |
| **需要动态 `this`**（事件处理里要用 `this` 指向元素） | ❌ 普通函数 | 箭头拿不到 |
| **构造函数** | ❌ 普通函数/class | 箭头不能 `new` |
| **对象的方法** | ❌ 普通函数 | 箭头拿不到 `obj` |
| **需要 `arguments`** | ❌ 普通函数 | 箭头没有 |
| **生成器** | ❌ 普通 `function*` | 箭头不能 `yield` |

**一个经典的反例**：

```js
const obj = {
  name: 'obj',
  greet: () => this.name,      // this 是定义处外层的 this，不是 obj
};
obj.greet();                   // undefined
```

**对象字面量不会创建作用域**，所以箭头函数的 `this` 是**定义时所在的外层**：CJS 顶层是 `module.exports`，ESM 顶层是 `undefined`，都取不到 `obj`。

---

## 2.8 十二道输出题（这是题单 101~323 被折叠的部分）

> 12 道代表性输出题，输出为 Node 22 实跑结果。

### 题 1：`var` 与 `let` 在循环里的闭包

```js
const fns = [];
for (var i = 0; i < 3; i++) fns.push(() => i);
console.log(fns.map(f => f()));
```

**答案**：`[3, 3, 3]`

**解析**：`var` 是函数作用域，三个箭头函数共享同一个 `i`。循环结束时 `i = 3`。

### 题 2：`let` 版本

```js
const fns = [];
for (let i = 0; i < 3; i++) fns.push(() => i);
console.log(fns.map(f => f()));
```

**答案**：`[0, 1, 2]`

**解析**：`for` + `let` 每轮创建新环境（`CreatePerIterationEnvironment`）。

### 题 3：变量遮蔽 + 提升

```js
var a = 1;
function f() {
  console.log(a);
  var a = 2;
}
f();
```

**答案**：`undefined`

**解析**：函数内 `var a` 提升到顶部并初始化为 `undefined`，遮蔽了外层的 `a = 1`。

### 题 4：`this` 在回调里丢失

```js
const obj = {
  name: 'obj',
  greet() {
    setTimeout(function () { console.log(this.name); }, 0);
  },
};
obj.greet();
```

**答案**：`undefined`

**解析**：回调是普通函数，调用时没有 `obj` 作为基准对象；Node 的定时器把 `this` 设为 `Timeout` 对象，`this.name` 为 `undefined`。

### 题 5：箭头函数修复

```js
const obj = {
  name: 'obj',
  greet() {
    setTimeout(() => console.log(this.name), 0);
  },
};
obj.greet();
```

**答案**：`'obj'`

**解析**：箭头函数的 `this` 是 `greet` 执行时的 `this`（即 `obj`）。

### 题 6：`obj.method` 赋值后丢失

```js
const obj = { name: 'obj', getName() { return this.name; } };
const fn = obj.getName;
console.log(fn());
```

**答案**：`undefined`

**解析**：赋值给变量后是普通调用，`this` 走默认绑定。

### 题 7：`new` 优先级高于 `bind`

```js
function F() { this.tag = 'new'; }
const Bound = F.bind({ tag: 'bound' });
console.log(new Bound().tag);
```

**答案**：`'new'`

**解析**：`new` 的优先级最高，`bind` 的 `thisArg` 被忽略（但 `bind` 预设的参数仍然生效）。

### 题 8：闭包共享同一个变量

```js
function make() {
  let count = 0;
  return [() => ++count, () => count];
}
const [inc, get] = make();
inc();
inc();
console.log(get());
```

**答案**：`2`

**解析**：两个箭头函数闭包引用的是**同一个** `count` 变量。

### 题 9：两个独立实例

```js
function make() {
  let count = 0;
  return () => ++count;
}
const a = make();
const b = make();
a(); a();
console.log(a(), b());
```

**答案**：`3 1`

**解析**：每次调 `make()` 都创建**新的** `count`，所以 `a` 和 `b` 互不影响。

### 题 10：IIFE 里的 `this`

```js
globalThis.name = 'global';
const obj = {
  name: 'obj',
  fn: function () {
    return (function () { return this.name; })();
  },
};
console.log(obj.fn());
```

**答案**：`'global'`（严格模式下 `TypeError`）

**解析**：内层是立即调用的**普通函数**，`this` 走默认绑定，不继承外层的 `obj`。浏览器脚本里 `var name = 'global'` 等价于这里的 `globalThis.name`；Node 的 CJS 顶层 `var` 不会挂到 `globalThis`，所以改用显式赋值。

**改成箭头函数**：

```js
fn: function () {
  return (() => this.name)();      // 'obj'
}
```

### 题 11：`typeof` 与 TDZ

```js
console.log(typeof x);
let x = 1;
```

**答案**：`ReferenceError: Cannot access 'x' before initialization`

**解析**：`let` 的 TDZ 内 `typeof` 也会抛错。如果换成 `var`，输出 `'undefined'`。

### 题 12：函数声明与 `var` 同名

```js
function test() {
  console.log(typeof x);
  var x = 1;
  function x() {}
  console.log(x);
}
test();
```

**答案**：`'function'` 然后 `1`

**解析**：
- 提升阶段：**函数声明优先**，`x` 是函数
- 执行阶段：`var x = 1` 赋值，`x` 变成 1（函数声明此时不会重新赋值）

---

## 2.9 常见坑

| 坑 | 正确说法 |
|---|---|
| 说「`let` 不提升」 | **也提升**，但不初始化（TDZ）；只是不能访问 |
| 说「TDZ 里 `typeof` 安全」 | ❌ 只有**未声明**变量才安全，TDZ 里的 `let` 抛 ReferenceError |
| 说「`const` 不可变」 | 只保证**绑定**不可变，对象属性可以改 |
| 以为 `Object.freeze` 是深冻结 | 浅冻结，嵌套对象还能改 |
| 说「闭包就是函数套函数」 | 是「函数 + 词法环境」，关键在**引用外层变量** |
| 说「闭包一定泄漏内存」 | 只有引用被长期持有才泄漏；正常闭包会被 GC |
| 说「`this` 指向定义时的对象」 | ❌ 由**调用方式**决定（箭头函数除外） |
| 说「箭头函数的 `this` 是它所在的函数」 | 是**定义位置的词法 `this`**，不是「运行时所在函数」 |
| 以为 `(0, obj.fn)()` 保留 `this` | ❌ 逗号运算符返回纯值，丢失基准对象 |
| 以为 `bind` 能覆盖 `new` 的 `this` | ❌ `new` 优先级更高 |
| 以为箭头函数能用 `arguments` | 没有自己的，会取**外层函数**的 |
| 以为 ESM 顶层 `this` 是 `globalThis` | 模块默认严格，顶层 `this` 是 `undefined` |
| 以为对象方法简写能 `new` | ❌ `{ m() {} }` 的 `m` 没有 `[[Construct]]` |

---

## 2.10 答题模板

### 30 秒版（闭包）

- 定义：函数 + 定义时的词法环境；`[[Environment]]` 让外层返回后仍能访问变量。
- 用途：私有变量、函数工厂、memoize。
- 坑：循环 `var` 共享变量输出 `3,3,3`，`let` 或 IIFE 解决；闭包只有被长期持有才泄漏。

### 30 秒版（this）

- `this` 由调用方式决定，优先级 `new > bind > call/apply > 隐式 > 默认`；默认严格 `undefined`、非严格 `globalThis`。
- 箭头函数在定义时捕获外层 `this`，不参与上述规则。
- 高频坑：赋值给变量、传参、解构、`(0, obj.method)()` 都会丢失 `this`。

### 2 分钟版（串起来讲，推荐）

- 执行上下文 = 词法环境（`let`/`const`）+ 变量环境（`var`）+ `this` + `OuterEnv`；两套环境对应 `var` 初始化为 `undefined`、`let` 不初始化（TDZ）。
- 作用域链是词法作用域，函数定义时确定，不是调用时。
- 闭包 = 函数 + `[[Environment]]`；V8 把被引用的变量上下文化到堆上的 `Context`，未被引用的留在栈上；闭包不一定泄漏，只有引用被长期持有才泄漏。
- `for` + `let` 每轮新环境（规范特例），输出 `0,1,2`；`var` 共享，输出 `3,3,3`。
- `this` 看调用方式；箭头函数没有自己的 `this`/`arguments`/`prototype`，也不能 `new`；对象方法简写同样不能 `new`。

### 追问表

| 追问 | 回答要点 |
|---|---|
| `let` 会提升吗 | 会，但不初始化（TDZ），所以访问报错 |
| TDZ 里 `typeof` 安全吗 | 不安全，抛 ReferenceError；只对未声明变量安全 |
| `const` 不可变吗 | 绑定不可变，对象属性可改；深不可变得递归 freeze |
| 闭包的定义 | 函数 + 词法环境，关键在引用外层变量 |
| 闭包一定泄漏吗 | 不一定，只有引用被长期持有才泄漏 |
| V8 怎么实现闭包 | 被引用的变量「上下文化」到堆上的 Context 对象 |
| `this` 的六种绑定 | new / 显式 / 隐式 / 默认 / 词法 / 全局顶层 |
| `this` 优先级 | new > bind > call/apply > 隐式 > 默认 |
| 哪些操作会丢失 `this` | 赋值给变量、传参、解构、`(0, fn)()` |
| 箭头函数能 `new` 吗 | 不能，没有 `[[Construct]]` 和 `prototype` |
| 箭头函数有 `arguments` 吗 | 没有自己的，取外层函数的 |
| 对象方法简写能 `new` 吗 | 不能（`is not a constructor`） |
| ESM 顶层 `this` | `undefined`（模块默认严格）；CJS 顶层是 `module.exports` |
| 严格模式下 `fn()` 的 `this` | `undefined`（不是 `globalThis`） |
| `call(null)` 的 `this` | 非严格是 `globalThis`，严格是 `null` |
| 为什么 `for` + `let` 能解决闭包问题 | 规范为 `for` 做了「每轮新环境」特例 |

---

## 2.11 速记卡

```
var / let / const
  作用域：函数 / 块 / 块
  提升：var 提升+初始化 undefined；let/const 提升但不初始化（TDZ）
  重复声明：允许 / 报错 / 报错
  挂全局对象：浏览器脚本、Node REPL 是；Node CJS 文件否
  ★ TDZ 里 typeof 也报错
  ★ const 只保证绑定不变，对象可改；Object.freeze 是浅冻结
  ★ for + let 每轮新环境（规范特例）

作用域链 / 执行上下文
  词法作用域：定义时确定，不是调用时
  with / eval 能改但禁用（性能 + 安全）
  词法环境（let/const）+ 变量环境（var）+ this + OuterEnv
  调用栈：全局 → 函数 → ...；Node 22 简单递归约 9 千层

闭包
  函数 + [[Environment]]
  V8：被引用的变量「上下文化」到堆上 Context；没引用的留栈上
  用途：私有变量 / 函数工厂 / memoize / 一次性初始化 / 事件上下文
  ★ 循环 var → 3,3,3；let 或 IIFE → 0,1,2
  ★ 不一定泄漏，只有长期持有才泄漏

this
  优先级：new > bind > call/apply > 隐式 > 默认
  默认：严格 undefined / 非严格 globalThis
  丢失场景：赋值给变量、传参、解构、(0, fn)()
  ESM 顶层 this = undefined；CJS 顶层 = module.exports
  类内部强制严格；Node 的 setTimeout 回调 this 是 Timeout 对象

箭头函数
  this 词法绑定 / 无 arguments / 不能 new / 无 prototype
  不能 yield / 忽略 thisArg（参数照传）
  ★ 对象方法简写 { m(){} } 也不能 new
```
