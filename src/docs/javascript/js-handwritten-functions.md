# JS · 10 手写实现（上）· 函数与工具

> 覆盖：防抖、节流、`call`/`apply`/`bind`、`new`、`instanceof`、柯里化、`compose`、发布订阅、`reduce`、`add(1)(2)(3)`、`setTimeout` 实现 `setInterval`
> 所有手写实现均在 Node 22 实跑，文中输出为真实结果

---

## 目录

- [10.1 一句话结论](#101-一句话结论)
- [10.2 防抖（debounce）](#102-防抖debounce)
- [10.3 节流（throttle）](#103-节流throttle)
- [10.4 `call` / `apply` / `bind`](#104-call--apply--bind)
- [10.5 `new`](#105-new)
- [10.6 `instanceof`](#106-instanceof)
- [10.7 柯里化](#107-柯里化)
- [10.8 `compose` / `pipe`](#108-compose--pipe)
- [10.9 发布订阅](#109-发布订阅)
- [10.10 `reduce`](#1010-reduce)
- [10.11 `add(1)(2)(3)`](#1011-add123)
- [10.12 `setTimeout` 实现 `setInterval`](#1012-settimeout-实现-setinterval)
- [10.13 常见坑](#1013-常见坑)
- [10.14 答题模板](#1014-答题模板)
- [10.15 速记卡](#1015-速记卡)

---

## 10.1 一句话结论

这一组题的共同难点是三个细节：

| 细节 | 说明 |
|---|---|
| **`this` 和参数透传** | 延迟执行/间接调用时用 `fn.apply(this, args)`，不要只写 `fn(...args)` |
| **边界** | 空数组、`null`/`undefined`、类数组、`new` 调用、`cancel`、重复注册 |
| **设计意图** | `bind` 后为什么还能 `new`、为什么要用 `setTimeout` 实现 `setInterval` |

---

## 10.2 防抖（debounce）

### 10.2.1 语义

> **事件触发后等 `wait` 毫秒，如果这期间没有再触发，才执行一次。**
> 场景：搜索框输入联想、窗口 resize 结束后重算布局、表单校验。

### 10.2.2 基础版

```js
function debounce(fn, wait = 300) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);       // ★ 保留 this 和参数
    }, wait);
  };
}
```

**两个关键点**：

| 点 | 为什么要这样写 |
|---|---|
| **`fn.apply(this, args)`** | `setTimeout` 的回调是普通调用，不转发 `this`；用普通函数接收调用时的 `this`，再显式传给 `fn` |
| **`args` 在闭包里存** | 真正执行在 `wait` 之后，参数必须先捕获 |

**⚠️ 用箭头函数返回会丢 `this`**：

```js
function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);   // 普通调用，不转发 this
  };
}
```

实测：用对象方法调用时，箭头版的 `fn` 拿到的是 `globalThis`（非严格函数）或 `undefined`（严格函数），不是调用者对象。

### 10.2.3 完整版（`immediate` + `cancel`）

```js
function debounce(fn, wait = 300, immediate = false) {
  let timer = null;

  function debounced(...args) {
    // ★ immediate 模式：只在「没有待执行任务」时立即执行（即首次）
    const callNow = immediate && timer === null;

    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (!immediate) fn.apply(this, args);      // 非 immediate：延迟执行
    }, wait);

    if (callNow) fn.apply(this, args);            // immediate：立即执行
  }

  // ★ cancel：取消待执行的任务（组件卸载时用）
  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return debounced;
}
```

**`immediate` 的语义**：**首次立即执行，之后 `wait` 内的触发全部忽略**。
场景：按钮防连击（第一次点击立即响应，后面 300ms 内的点击忽略）。

**实测**（Node 22，`wait=100ms`，每 10ms 调用一次，共 10 次）：

```
普通模式（immediate=false）：执行 1 次，参数 9（最后一次）
immediate 模式：执行 1 次，参数 0（首次）
```

### 10.2.4 追问：参数与 `this` 的透传

- `fn.apply(this, args)` 与 `fn.call(this, ...args)` 等价；前者不需要展开参数。
- 不能写 `fn(args)`：这会把整个数组当成第一个参数。
- `args` 必须在闭包里捕获，因为真正执行发生在 `setTimeout` 之后。

---

## 10.3 节流（throttle）

### 10.3.1 语义

> **保证 `wait` 毫秒内最多执行一次。**
> 场景：滚动监听、拖拽、鼠标移动、按钮防连击（不限首次）。

### 10.3.2 三种实现对比

| 版本 | 首次执行 | 尾执行 | 问题 |
|---|---|---|---|
| **时间戳版** | ✅ 立即 | ❌ **丢失最后一次** | 停止触发时最后一次被丢弃 |
| **定时器版** | ❌ 延迟 | ✅ 有 | 首次不立即响应 |
| **合体版** | ✅ | ✅ | 代码稍长（推荐） |

#### 版本 1：时间戳（首执行，丢末次）

```js
function throttle(fn, wait = 300) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= wait) {
      last = now;
      fn.apply(this, args);
    }
  };
}
```

**问题**：如果最后一次触发后不再触发，那次调用就**丢了**。

#### 版本 2：定时器（尾执行，首延迟）

```js
function throttle(fn, wait = 300) {
  let timer = null;
  let lastArgs;
  let lastThis;

  return function (...args) {
    lastArgs = args;
    lastThis = this;
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      fn.apply(lastThis, lastArgs);     // 尾执行用最后一次的 this/参数
    }, wait);
  };
}
```

**问题**：第一次触发要等 `wait` 才执行（用户感知延迟）。

#### 版本 3：合体（首末都执行）★ 推荐

```js
function throttle(fn, wait = 300) {
  let last = 0;
  let timer = null;
  let lastArgs;
  let lastThis;

  return function (...args) {
    const now = Date.now();
    const remaining = wait - (now - last);
    lastArgs = args;
    lastThis = this;

    if (remaining <= 0) {
      // 已经超过 wait，立即执行
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      last = now;
      fn.apply(lastThis, lastArgs);
    } else if (!timer) {
      // 还在 wait 内，但没排定时器 → 排一个「补齐剩余时间」的
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn.apply(lastThis, lastArgs);
      }, remaining);
    }
  };
}
```

**实测（Node 22）**：

- 10 次调用、每 10ms 一次、`wait=100`：时间戳版 1 次、定时器版 1 次（参数 9）、合体版 2 次（参数 0、9，时刻约 0ms、100ms）。
- 20 次调用、每 50ms 一次、`wait=100`：合体版 11 次；首次立即执行（leading edge）额外多了 1 次。

### 10.3.3 防抖 vs 节流（一句话区分）

```
防抖：事件密集触发时 → 只认「最后一次」（或第一次）
      触发触发触发触发触发 → 等 wait → 执行 1 次

节流：事件密集触发时 → 「匀速执行」
      触发触发触发触发触发 → 每 wait 执行 1 次
```

**记忆**：
- **防抖 = 「等你停下来」**（搜索输入）
- **节流 = 「按节奏来」**（滚动、拖拽）

---

## 10.4 `call` / `apply` / `bind`

### 10.4.1 三者区别（先答清语义）

| | `call` | `apply` | `bind` |
|---|---|---|---|
| **是否立即执行** | ✅ 立即 | ✅ 立即 | ❌ **返回新函数** |
| **参数形式** | 逐个传 | **数组** | 逐个传（可预设） |
| **能否改 `this`** | ✅ | ✅ | ✅（但 `new` 调用时失效） |
| **返回值** | 函数执行结果 | 函数执行结果 | **新函数** |

```js
fn.call(ctx, 1, 2);         // 立即执行
fn.apply(ctx, [1, 2]);      // 立即执行
const bound = fn.bind(ctx, 1);   // 不执行
bound(2);                   // 现在才执行
```

### 10.4.2 手写 `call`

**核心思路**：把函数临时挂到 `ctx` 上当方法，调用完删掉——这样 `this` 就指向 `ctx` 了。

```js
Function.prototype.myCall = function (ctx, ...args) {
  // ① null/undefined → globalThis；原始值先装箱
  ctx = ctx == null ? globalThis : Object(ctx);

  // ② 用 Symbol 当键，避免覆盖 ctx 上同名属性
  const key = Symbol('fn');

  // ③ 把函数挂上去（不可枚举，避免影响 for...in）
  Object.defineProperty(ctx, key, {
    value: this,
    enumerable: false,
    configurable: true,
  });

  // ④ 调用；try/finally 保证函数抛错也会清理
  try {
    return ctx[key](...args);
  } finally {
    delete ctx[key];
  }
};
```

**四个细节**：

| 细节 | 为什么 |
|---|---|
| **`ctx == null ? globalThis : Object(ctx)`** | `null`/`undefined` 走非严格语义；原始值不装箱的话，`Object.defineProperty` 直接抛 `TypeError` |
| **用 `Symbol` 而不是字符串键** | 字符串可能覆盖 `ctx` 上的真实属性（比如 `ctx.fn`） |
| **`enumerable: false`** | 不让它出现在 `for...in` / `Object.keys` 里 |
| **`try/finally` + `delete`** | 用完必须清理；回调抛错也不残留 |

**⚠️ 原始值会被装箱**：

```js
fn.myCall(1);      // 返回装箱后的 Number 对象，instanceof Number 为 true
```

原生 `call` 是否装箱取决于目标函数：非严格函数装箱，严格函数保持原始值 `1`。手写版无法感知目标函数的严格模式，统一按非严格语义装箱。

### 10.4.3 手写 `apply`

```js
Function.prototype.myApply = function (ctx, args) {
  return this.myCall(ctx, ...(args == null ? [] : Array.from(args)));
};
```

`Array.from` 同时支持数组、`arguments` 和类数组；`null`/`undefined` 视为没有参数（`fn.apply(ctx, null)` 合法）。

### 10.4.4 手写 `bind`（重点：`new` 的处理）

```js
Function.prototype.myBind = function (ctx, ...preset) {
  const target = this;

  function Bound(...args) {
    // 箭头函数/方法简写没有 prototype，不能 new
    if (new.target && typeof target.prototype !== 'object') {
      throw new TypeError(`${target.name || 'target'} is not a constructor`);
    }
    // ★ 关键：如果被 new 调用，this 是新对象，忽略 ctx
    return target.myCall(
      this instanceof Bound ? this : ctx,
      ...preset,
      ...args,
    );
  }

  // ★ 让 new Bound() 的实例原型链经过 Bound.prototype
  if (typeof target.prototype === 'object') {
    Bound.prototype = Object.create(target.prototype, {
      constructor: { value: Bound, enumerable: false, writable: true, configurable: true },
    });
  }

  return Bound;
};
```

**两个关键点**：

**① `new` 调用时 `ctx` 失效**

```js
function Person(name) { this.name = name; }
const Bound = Person.myBind({ name: 'ignored' }, 'alice');

const p = new Bound();
p.name;                                          // 'alice'（预设参数生效）
p instanceof Person;                             // true
Object.getPrototypeOf(p) === Bound.prototype;    // true
Object.getPrototypeOf(p) === Person.prototype;   // false（手写版多一层）
```

**实测**：`new Bound()` 时 `ctx` 被忽略，预设参数按顺序传入；`instanceof Person` 为 `true`。原生 `new Bound()` 的实例原型直接是 `Person.prototype`；手写版是 `instance → Bound.prototype → Person.prototype`，所以精确比较原型会得到 `false`。

**规范依据**：`bind` 返回的函数在 `new` 调用时，`this` 是新建的对象，`boundThis` 被忽略（但预设参数仍然生效）。

**② `Bound.prototype = Object.create(target.prototype)`**

**为什么需要**：让 `new Bound()` 创建的实例原型链是 `instance → Bound.prototype → Person.prototype`，这样：

- `instance instanceof Person` 为 true
- `instance` 能访问 `Person.prototype` 上的方法

**如果不设**：`instance` 的原型是 `Bound.prototype`（默认是 `{}`），链上找不到 `Person.prototype`。

`Object.create` 不设 `constructor`，严格实现要一并补成 `Bound`（见上面的代码）。

**⚠️ 箭头函数/方法简写没有 `prototype`**：`bind` 后可以正常调用，但不能 `new`；直接 `Object.create(undefined)` 会抛 `TypeError`，所以先判 `target.prototype`。

### 10.4.5 追问：`bind` 能改几次

```js
const f = function () { return this.x; };
const b1 = f.bind({ x: 1 });
const b2 = b1.bind({ x: 2 });
b2();          // 1  ← 只有第一次生效！
```

**`bind` 是「一次性」的**——已经绑定过 `this` 的函数，再 `bind` 不会改变 `this`（但预设参数会叠加）。

**规范依据**：`BoundFunction` 内部有 `[[BoundThis]]`，再次 `bind` 时新的 `boundThis` 被忽略（因为调用时用的是旧的）。

---

## 10.5 `new`

### 10.5.1 四步

```js
function myNew(Ctor, ...args) {
  // ① 创建新对象，② 把它的 [[Prototype]] 设为 Ctor.prototype
  const obj = Object.create(Ctor.prototype);

  // ③ 用 obj 作为 this 执行构造函数
  const ret = Ctor.apply(obj, args);

  // ④ 如果返回对象（含函数），用它；否则用 obj
  return ret !== null && (typeof ret === 'object' || typeof ret === 'function')
    ? ret
    : obj;
}
```

**第 ④ 步的判断必须包含 `function`**：

```js
function F() { return function () {}; }
myNew(F);      // 返回那个函数（typeof 是 'function'）
```

**要排除 `null`**：

```js
function G() { return null; }
myNew(G);      // 返回 obj（null 是原始值），不能是 null
```

### 10.5.2 三个追问

**① 构造函数 `return` 对象会怎样**

```js
function A() { this.x = 1; return { y: 2 }; }
new A();       // { y: 2 }  ← this.x 白设了
```

**② 箭头函数不能 `new`**

```js
const arrow = () => {};
myNew(arrow);   // TypeError: Object prototype may only be an Object or null: undefined
new arrow();    // TypeError: arrow is not a constructor
```

`myNew` 是在 `Object.create(undefined)` 处抛；原生 `new` 是因为箭头函数没有 `[[Construct]]` 直接抛。两者都报 `TypeError`，原因不同。

**③ `class` 也必须用 `new`**

```js
class C {}
C();            // TypeError: Class constructor C cannot be invoked without 'new'
```

---

## 10.6 `instanceof`

### 10.6.1 实现

```js
function myInstanceof(obj, Ctor) {
  // ① 原始值直接 false
  if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) {
    return false;
  }

  // ② 沿原型链查找
  let proto = Object.getPrototypeOf(obj);
  while (proto) {
    if (proto === Ctor.prototype) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}
```

**三个关键点**：

| 点 | 说明 |
|---|---|
| **① 原始值必须排除** | `1 instanceof Number` 是 **false**；不排除的话 `Object.getPrototypeOf(1)` 会装箱成 `Number.prototype`，误判为 true |
| **② 用 `Object.getPrototypeOf`** | 不用 `__proto__`（遗留特性，`Object.create(null)` 的对象没有） |
| **③ 循环条件判 `proto`** | 原型链终点是 `null`，`while (proto)` 自然终止 |

### 10.6.2 验证

```js
myInstanceof([], Array);            // true
myInstanceof([], Object);           // true   ← 数组也是对象
myInstanceof(1, Number);            // false  ✅
Object.create(null) instanceof Object;   // false  ← 没有原型链
```

### 10.6.3 追问：`instanceof` 的三个限制

| 限制 | 说明 |
|---|---|
| **不能跨 realm** | 不同 realm（iframe、Node `vm` context）的 `Array.prototype` 不同；`vm.runInNewContext('[1,2]') instanceof Array` → false |
| **可被 `Symbol.hasInstance` 改写** | 原生会优先查它（`class Even { static [Symbol.hasInstance](n) { return n % 2 === 0 } }`，`2 instanceof Even` → true）；手写版只沿原型链，不支持 |
| **改 `prototype` 会失效** | `F.prototype = {}` 后旧实例 `instanceof F` 变 false |

---

## 10.7 柯里化

### 10.7.1 基础版（按参数个数）

```js
function curry(fn) {
  return function curried(...args) {
    // 参数够了就执行
    if (args.length >= fn.length) return fn.apply(this, args);
    // 不够就继续收集
    return (...rest) => curried.apply(this, [...args, ...rest]);
  };
}

function add3(a, b, c) { return a + b + c; }
const cadd = curry(add3);

cadd(1)(2)(3);      // 6
cadd(1, 2)(3);      // 6
cadd(1)(2, 3);      // 6
cadd(1, 2, 3);      // 6
```

**实测四种调用方式全部得 6。**

**`fn.length` 的含义**：**形参个数**（不含 rest 参数、不含默认值参数）。

```js
function f(a, b = 1, ...rest) {}
f.length;      // 1  ← 只算 a
```

`fn.length` 遇到第一个默认参数就停止计数，`curry` 会误判参数已够而提前执行：

```js
const cdef = curry((a, b = 1) => a + b);
cdef(1);      // 2（直接执行，b 用默认值）
cdef(1)(2);   // TypeError: cdef(...) is not a function
```

### 10.7.2 不定长版（`add(1)(2)(3)` 无限累加）

```js
function add(...args) {
  const sum = args.reduce((a, b) => a + b, 0);

  function curried(...more) {
    return add(sum, ...more);
  }

  // ★ 关键：让隐式转换时得到数值
  curried.toString = () => String(sum);
  curried.valueOf = () => sum;

  return curried;
}

add(1)(2)(3);            // 函数对象
+add(1)(2)(3);           // 6      ← valueOf
`${add(1)(2)(3)}`;       // '6'    ← toString
add(1, 2)(3, 4);         // 10
add(1)(2)(3) === 6;      // false  ← ⚠️ 严格相等不触发转换
```

**⚠️ 最后一行是关键坑**：`add(1)(2)(3) === 6` 是 **false**，因为 `===` 不做类型转换。

### 10.7.3 另一种要求：`add(1)(2)(3)()` 显式空调用

**如果题目要求「用 `()` 结束」**，就不需要 `toString`：

```js
function add(...args) {
  const sum = args.reduce((a, b) => a + b, 0);
  return (...more) => (more.length ? add(sum, ...more) : sum);
}

add(1)(2)(3)();      // 6
add(1, 2)(3)();      // 6
```

题目要求隐式转数字还是 `()` 结束，决定要不要 `valueOf`/`toString`。

### 10.7.4 带占位符的柯里化（加分版）

```js
const _ = Symbol('_');   // 占位符必须和调用方共用同一个 Symbol

function curry(fn) {
  return function curried(...args) {
    // 判断参数是否够（且没有占位符）
    const valid = args.slice(0, fn.length).filter((a) => a !== _);
    if (valid.length >= fn.length) return fn.apply(this, args);

    return (...rest) => {
      // ★ 把新参数填到占位符位置
      const merged = [];
      let ri = 0;
      for (const a of args) {
        if (a === _ && ri < rest.length) merged.push(rest[ri++]);
        else merged.push(a);
      }
      merged.push(...rest.slice(ri));
      return curried.apply(this, merged);
    };
  };
}

curry((a, b, c) => `${a}-${b}-${c}`)(1)(_, 3)(2);   // '1-2-3'
```

---

## 10.8 `compose` / `pipe`

### 10.8.1 实现

```js
// compose：从右往左（数学上 f∘g 表示先 g 后 f）
const compose = (...fns) => (x) => fns.reduceRight((acc, fn) => fn(acc), x);

// pipe：从左往右（更符合阅读顺序）
const pipe = (...fns) => (x) => fns.reduce((acc, fn) => fn(acc), x);
```

**实测**（`f1 = x+1`、`f2 = x*2`，输入 5）：

```
compose(f1, f2)(5) = 11   ← f2(5)=10，f1(10)=11
pipe(f1, f2)(5)    = 12   ← f1(5)=6，f2(6)=12
compose()(5)       = 5    ← 空参数返回恒等
compose(f1)(5)     = 6
```

### 10.8.2 关键点

| 点 | 说明 |
|---|---|
| **空参数** | 上面的写法用 `x` 作 `reduce` 初值，`compose()`/`pipe()` 返回恒等函数，不需要额外特判 |
| **`reduce` vs `reduceRight`** | 前者左到右，后者右到左 |
| **`this`** | 上面的实现不支持 `this`，严格实现要用 `function` 而非箭头 |

**需要多参数时**，把 reducer 改成 `(...args) => a(b(...args))`：

```js
const compose = (...fns) => {
  if (fns.length === 0) return (x) => x;
  if (fns.length === 1) return fns[0];
  return fns.reduce((a, b) => (...args) => a(b(...args)));
};
```

多参数只能给 **最右侧（最先执行）** 的函数：`compose(f, g)(x, y)` → `f(g(x, y))`，`g` 收到 `x`、`y`，`f` 只收到 `g` 的返回值。实测 `compose((x) => x + 1, (x, y) => x + y)(1, 2)` → 4；顺序反过来会得到 `NaN`。

### 10.8.3 实际用途

**Redux 的 `applyMiddleware` 就是 `compose`**。

```js
// Redux 源码（简化）
export default function applyMiddleware(...middlewares) {
  return (createStore) => (...args) => {
    const store = createStore(...args);
    let dispatch = store.dispatch;
    const middlewareAPI = { getState: store.getState, dispatch: (...a) => dispatch(...a) };
    const chain = middlewares.map((m) => m(middlewareAPI));
    dispatch = compose(...chain)(store.dispatch);
    return { ...store, dispatch };
  };
}
```

**用 `compose` 把多个中间件包成一个**——这是函数式编程的经典用法。

---

## 10.9 发布订阅

### 10.9.1 实现

```js
class EventEmitter {
  constructor() {
    this.events = new Map();      // Map<eventName, Function[]>
  }

  // 订阅，返回「取消订阅」函数（更易用）
  on(name, fn) {
    if (!this.events.has(name)) this.events.set(name, []);
    this.events.get(name).push(fn);
    return () => this.off(name, fn);
  }

  // 一次性订阅
  once(name, fn) {
    const wrapper = (...args) => {
      this.off(name, wrapper);      // ★ 先摘：fn 里递归 emit 也不会重复
      fn(...args);
    };
    return this.on(name, wrapper);
  }

  // 取消订阅（不传 fn 就清空该事件）
  off(name, fn) {
    if (!fn) return this.events.delete(name);
    const list = this.events.get(name);
    if (!list) return;
    const i = list.indexOf(fn);
    if (i > -1) list.splice(i, 1);
  }

  // 触发
  emit(name, ...args) {
    // ★ 用 slice() 拷贝：防止回调里注销自己导致遍历跳过元素
    (this.events.get(name) || []).slice().forEach((fn) => fn(...args));
    return true;
  }
}
```

**实测**：`on` 两次 emit 触发 2 次；`once` 两次 emit 触发 1 次；`once` 回调里递归 emit 也只触发 1 次。

### 10.9.2 四个必须注意的点

**① `emit` 要用 `slice()` 拷贝数组**

```js
// ❌ 如果回调里注销自己（比如 once），forEach 会跳过下一个元素
list.forEach((fn) => fn(...args));

// ✅ 拷贝一份再遍历
list.slice().forEach((fn) => fn(...args));
```

实测 `[A, B, C]` 中 A 注销自己：不拷贝只执行 `A, C`（B 被跳过），拷贝后三个都执行。

**② `once` 要先摘再执行**

如果先执行，`fn` 里再 `emit` 同一事件会再次命中自己（实测触发 2 次）；先 `off` 再执行则只触发 1 次，而且 `fn` 抛错也不会留下订阅。

**③ `on` 返回取消函数（比返回 `this` 更易用）**

```js
// ✅ 返回 unsubscribe
const unsub = emitter.on('x', handler);
unsub();

// ⚠️ 返回 this 能链式调用，但取消订阅要自己保存 handler
```

**Vue 3 的 `watch` 就返回 `stop` 函数**，这是现代 API 的设计趋势。

**④ 用 `Map` 而不是普通对象**

```js
// ❌ 普通对象：'toString' 这种键会有原型链干扰
// ✅ Map：任意字符串作键都安全
```

### 10.9.3 发布订阅 vs 观察者模式（常被追问）

| | 观察者模式 | 发布订阅 |
|---|---|---|
| **耦合** | Subject **直接持有** Observer 列表 | 通过**事件中心（EventBus）**解耦 |
| **谁通知谁** | Subject 直接调 `observer.update()` | Publisher `emit` → EventBus 分发给 Subscriber |
| **典型实现** | `MutationObserver`、Vue 2 的 `Dep` | `EventEmitter`、Redux `store`、`mitt` |
| **中间层** | ❌ 无 | ✅ 有（EventBus） |

**一句话**：**发布订阅 = 观察者模式 + 一个事件中心（解耦）。**

---

## 10.10 `reduce`

### 10.10.1 实现

```js
Array.prototype.myReduce = function (fn, init) {
  const arr = this;
  let i = 0;
  let acc = init;

  // ★ 用 arguments.length 判断有没有传初始值
  // （不能判 init === undefined，因为可能显式传 undefined）
  if (arguments.length < 2) {
    if (arr.length === 0) {
      throw new TypeError('Reduce of empty array with no initial value');
    }
    // 跳过开头的空位，找到第一个存在的元素
    let j = 0;
    while (j < arr.length && !(j in arr)) j++;
    if (j === arr.length) {
      throw new TypeError('Reduce of empty array with no initial value');
    }
    acc = arr[j];
    i = j + 1;
  }

  for (; i < arr.length; i++) {
    if (!(i in arr)) continue;       // 稀疏数组跳过空位
    acc = fn(acc, arr[i], i, arr);
  }
  return acc;
};
```

**实测**：

```
[1,2,3] init 10      → 16
[1,2,3] 无 init      → 6
[] 无 init           → TypeError
[] init 0            → 0
[1,2] init undefined → NaN（与原生一致）
[1,,3] init 0        → 4
[1,,3] 无 init       → 4
[,1,2] 无 init       → 3
[,,] 无 init         → TypeError
[,,] init 0          → 0
```

### 10.10.2 三个关键点

**① 用 `arguments.length` 判断而不是 `init === undefined`**

```js
[1, 2].reduce((a, b) => a + b, undefined);    // NaN
// 传了 initialValue（值是 undefined），acc 从 undefined 开始
```

**规范用 `HasInitialValue`（内部标记），不是判 `undefined`。**

**② 稀疏数组会跳过空位**

```js
[1, , 3].reduce((a, b) => a + b, 0);    // 4（跳过了空位）
[, ,].reduce((a, b) => a + b);          // TypeError（没有可用的第一个元素）
```

循环里用 `if (!(i in arr)) continue` 跳过空位；无初始值时还要先找到第一个存在的元素作为 `acc`。

**③ 回调接收四个参数**

```js
arr.reduce((acc, cur, index, array) => {}, init);
//                      ↑      ↑
//                   当前索引  原数组
```

---

## 10.11 `add(1)(2)(3)`

**见 10.7.2**（已并入柯里化）。核心是 `valueOf` / `toString`。

---

## 10.12 `setTimeout` 实现 `setInterval`

### 10.12.1 为什么要这个

**`setInterval` 有三个问题**：

| 问题 | 说明 |
|---|---|
| **① 回调背靠背** | 如果回调执行时间 > 间隔，下一次触发早已到期，回调结束后立刻再执行，没有空闲 |
| **② 时间漂移** | 每次执行的实际间隔 ≈ 执行时间 + 间隔，误差累积 |
| **③ 无法动态调整** | 想改间隔只能 `clearInterval` 再重建 |

**实测第 ① 条**：

```js
setInterval(() => {
  const start = Date.now();
  while (Date.now() - start < 200) {}    // 阻塞 200ms
}, 100);
// start 时刻：102 / 302 / 502 / 702
// 间隔 200ms：下一次触发早已到期，回调背靠背执行，没有 100ms 空闲
```

**`setTimeout` 递归能解决**：每次执行完才开始算下一个间隔。

### 10.12.2 实现

```js
function mySetInterval(fn, delay) {
  let timer = null;
  let stopped = false;

  function tick() {
    if (stopped) return;
    fn();                              // 先执行
    timer = setTimeout(tick, delay);   // 执行完再排下一个
  }

  timer = setTimeout(tick, delay);     // 首次延迟

  return {
    clear: () => {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
```

**关键点**：

| 点 | 说明 |
|---|---|
| **`tick` 里先 `fn()` 再 `setTimeout`** | 保证「执行完才计时」，不堆积 |
| **`stopped` 标记** | 防止 `clear` 后已排队的 `tick` 再执行回调 |
| **返回 `{ clear }`** | 模仿 `clearInterval` 的用法 |

**实测**（`delay=20`）：start 时刻 `21 / 42 / 63 / 84 / 104 / 125`；`clear` 在首次 tick 前调用 → 0 次；在回调内 `clear` → 2 次后停止。

### 10.12.3 追问：那「立即执行首次」怎么做

```js
function mySetInterval(fn, delay, immediate = false) {
  let timer = null, stopped = false;

  function tick() {
    if (stopped) return;
    fn();
    timer = setTimeout(tick, delay);
  }

  if (immediate) tick();               // 立即跑第一次
  else timer = setTimeout(tick, delay);

  return { clear: () => { stopped = true; clearTimeout(timer); } };
}
```

实测（`delay=30`）：start 时刻 `0 / 32 / 64 / 96`，首次同步执行。

### 10.12.4 追问：要「精确间隔」怎么办

**用「下一次触发时间」计算，而不是「执行完再等」**：

```js
function preciseInterval(fn, delay) {
  let timer = null, stopped = false;
  let next = Date.now() + delay;

  function tick() {
    if (stopped) return;
    fn();

    // 计算下一个时间点（补偿执行耗时）
    next += delay;
    const wait = Math.max(0, next - Date.now());
    timer = setTimeout(tick, wait);
  }

  timer = setTimeout(tick, delay);
  return { clear: () => { stopped = true; clearTimeout(timer); } };
}
```

**`next += delay` 而不是 `next = Date.now() + delay`**——这样才能补偿执行误差，保持长期平均间隔准确。前提是单次执行时间小于 `delay`；如果一直超过，`wait` 会一直是 0，只能背靠背执行（实测 `fn` 80ms / `delay` 50 → `50 / 131 / 212 / 293`）。

实测（`fn` 阻塞 20ms，`delay=50`）：相对间隔 `51 / 122 / 193 / 263`，精确间隔 `50 / 101 / 150 / 200 / 251`。

---

## 10.13 常见坑

| 坑 | 正确说法 |
|---|---|
| 防抖里写 `fn(...args)` 而不用 `apply` | `this` 会丢（非严格函数是 `globalThis`，严格函数是 `undefined`） |
| 节流只用时间戳版 | 会丢最后一次，要用合体版 |
| 节流尾执行不更新 args/this | 补的那次会用第一次触发的参数和 `this` |
| `bind` 手写忘了处理 `new` | `new Bound()` 时 `this` 应该是新对象 |
| `bind` 忘了设 `Bound.prototype` | `instanceof` 会失效 |
| `bind` 对箭头函数直接 `Object.create` | 没有 `prototype`，`Object.create(undefined)` 会抛 |
| `call` 用字符串键挂方法 | 会覆盖 `ctx` 上的同名属性，用 `Symbol` |
| `call` 忘了 `delete` / 没用 `finally` | 污染 `ctx`；回调抛错时残留 |
| `call` 原始值不装箱 | `Object.defineProperty` 直接对原始值抛 `TypeError` |
| `new` 判断返回值只判 `object` | 还要判 `function` |
| `new` 忘了排除 `null` | `null` 是原始值，要返回新对象 |
| `instanceof` 没排除原始值 | `Object.getPrototypeOf(1)` 会装箱，误判 true |
| `instanceof` 用 `__proto__` | 应该用 `Object.getPrototypeOf` |
| `curry` 用 `fn.length` 判断参数够不够 | 有默认值/rest 参数时 `length` 不准 |
| `add(1)(2)(3)` 忘了 `valueOf`/`toString` | 隐式转换拿不到数值 |
| `add(1)(2)(3) === 6` 以为是 true | ❌ `===` 不触发转换 |
| `emit` 用 `forEach` 不拷贝 | 回调里注销自己（如 `once`）会跳过下一个 |
| `once` 忘了摘掉自己 | 会重复执行 |
| 用对象存事件列表 | `'toString'` 等键有原型链干扰，用 `Map` |
| `myReduce` 用 `init === undefined` 判断 | 应该用 `arguments.length` |
| `myReduce` 不判 `i in arr` | 稀疏数组会把空位算成 `undefined`，结果变 `NaN` |
| `setTimeout` 版 `setInterval` 忘了 `stopped` 标记 | `clear` 后已排队的 tick 还会执行回调 |

---

## 10.14 答题模板

### 30 秒版（防抖节流）

- 防抖：停止触发 `wait` 后执行一次；每次触发先 `clearTimeout`，用 `fn.apply(this, args)` 保留 `this` 和参数；补 `immediate`（首次立即执行）和 `cancel`（卸载清理）。
- 节流：`wait` 内最多执行一次；三版是时间戳（首执行、丢末次）、定时器（尾执行、首延迟）、合体（首尾都执行，尾执行用最新参数和 `this`）。
- 实测：10 次触发、`wait=100` → 防抖 1 次，合体节流 2 次。

### 30 秒版（`call`/`apply`/`bind` 手写）

- `call`：把函数临时挂到 `ctx` 上当方法；`Symbol` 作键、`enumerable: false`、`try/finally` 清理；`null`/`undefined` 走 `globalThis`，原始值 `Object()` 装箱。
- `apply`：`myCall(ctx, ...Array.from(args))`，兼容数组、`arguments`、类数组和 `null`。
- `bind`：返回新函数；`new` 调用时用 `this instanceof Bound` 忽略 `ctx`，并用 `Bound.prototype = Object.create(target.prototype)` 保住 `instanceof`；没有 `prototype` 的函数只可调用、不可 `new`。`bind` 只生效一次，预设参数可叠加。

### 2 分钟版（把这一组串起来讲，推荐）

- 共同点：都是在「模拟语言内置行为」，先讲规范再写代码。
- 防抖/节流：防抖是「停止后执行一次」，节流是「`wait` 内最多一次」；节流三版要都能说，合体版的尾执行要用最新参数和 `this`；实测 10 次触发 → 防抖 1 次、合体节流 2 次。
- `call`/`apply`/`bind`：`call` 的核心是临时挂方法（`Symbol` + 不可枚举 + `finally delete`），`apply` 负责把类数组展开；`bind` 的难点是 `new` 时忽略 `ctx`、`Bound.prototype` 保住 `instanceof`，且再次 `bind` 不会改变 `this`。
- `new`/`instanceof`：`new` 第 4 步判对象或函数、排除 `null`；`instanceof` 排除原始值、沿 `Object.getPrototypeOf` 找到 `null` 为止，原生还会查 `Symbol.hasInstance`。
- 发布订阅/`reduce`/`setInterval`：`emit` 必须拷贝（`once` 会在回调里注销自己），`once` 先摘再执行；`reduce` 用 `arguments.length` 判初始值并跳过空位；`setInterval` 的间隔会被回调耗时占满且累积漂移，`setTimeout` 递归不堆积，精确间隔用 `next += delay`。

### 追问表

| 追问 | 回答要点 |
|---|---|
| 防抖和节流的区别 | 「等你停下来」vs「按节奏来」 |
| 防抖的 `immediate` 是什么 | 首次立即执行，之后 `wait` 内忽略 |
| 节流为什么要合体版 | 时间戳版丢末次、定时器版首次延迟 |
| `bind` 后还能 `new` 吗 | 能，且 `this` 是新对象，`ctx` 失效 |
| `bind` 为什么要设 `prototype` | 保证 `instanceof` 和原型方法可用 |
| `bind` 能绑多次吗 | 不能，只有第一次的 `this` 生效 |
| `new` 的第 4 步要注意什么 | 判对象**或函数**，并排除 `null` |
| `instanceof` 能判断原始值吗 | 不能，`1 instanceof Number` 是 false |
| `add(1)(2)(3)` 靠什么拿值 | `valueOf`（数值）/ `toString`（字符串） |
| `add(1)(2)(3) === 6` 是 true 吗 | 不是，`===` 不触发转换 |
| `emit` 为什么要 `slice` | 回调里注销自己（如 `once`）会跳过下一个 |
| `reduce` 怎么判断有没有初始值 | `arguments.length`，不是 `=== undefined` |
| 为什么要 `setTimeout` 实现 `setInterval` | 回调背靠背、有累积漂移 |
| 怎么做到精确间隔 | 用 `next += delay` 绝对时间点补偿 |

---

## 10.15 速记卡

```
防抖
  语义：停止触发 wait 后执行一次
  实现：每次 clearTimeout 再 setTimeout
  ★ fn.apply(this, args) 保 this 和参数
  ★ immediate：首次立即执行；cancel：卸载清理
  实测：10 次@10ms → 1 次（普通参数 9 / immediate 参数 0）

节流
  语义：wait 内最多执行一次
  三版：时间戳（首执行丢末次）/ 定时器（尾执行首延迟）/ 合体（首尾都执行）
  ★ 合体版 remaining = wait - (now - last)；尾执行用最新 args/this
  实测：10 次@10ms → 2 次；20 次@50ms → 11 次

call / apply
  核心：把函数临时挂到 ctx 上当方法
  ★ Symbol 作键 + enumerable: false + try/finally delete
  ★ ctx == null → globalThis；原始值 Object(ctx) 装箱（严格函数原生不装箱）
  apply = myCall(ctx, ...Array.from(args))，兼容类数组和 null

bind
  返回新函数，要处理两件事：
  ★ new 调用时 ctx 失效：this instanceof Bound ? this : ctx
  ★ Bound.prototype = Object.create(target.prototype) 保 instanceof（比原生多一层）
  ★ 无 prototype 的函数（箭头/方法简写）只能调用，不能 new
  ★ bind 只绑一次，预设参数可叠加

new
  ① Object.create(Ctor.prototype) ② apply ③ 返回对象/函数则用它，否则用 obj
  ★ 必须判 'function'；必须排除 null
  ★ 箭头函数没有 [[Construct]]；class 必须 new

instanceof
  沿 Object.getPrototypeOf 找，while (proto) 判 null 终止
  ★ 原始值直接 false（否则 Object.getPrototypeOf(1) 会装箱误判）
  ★ 不用 __proto__
  限制：不能跨 realm / 原生会查 Symbol.hasInstance / 改 prototype 会失效

柯里化 + add(1)(2)(3)
  curry：args.length >= fn.length 则执行
  ★ fn.length 遇到第一个默认值/rest 就停，默认参数会提前执行
  占位符：Symbol 必须定义在外层，调用方和 curry 共用同一个
  add：递归 + ★ valueOf/toString 让隐式转换拿值
  ★ add(1)(2)(3) === 6 是 false（=== 不转换）
  若要求 add(1)(2)(3)()，则不需要 valueOf

compose / pipe
  compose = reduceRight（右到左）；pipe = reduce（左到右）
  ★ 初值 x 让空参数返回恒等函数
  ★ 多参数只能给最右侧（最先执行）的函数
  Redux 的 applyMiddleware 就是 compose

发布订阅
  on 返回 unsubscribe；once 先摘再执行（防递归 emit 重复）
  ★ emit 必须 slice() 拷贝，否则回调里注销自己会跳过下一个
  ★ 用 Map 不用普通对象（避免原型链干扰）
  发布订阅 = 观察者 + 事件中心

reduce
  ★ arguments.length < 2 判初始值，不能 init === undefined
  ★ 跳过空位：if (!(i in arr)) continue；全空位且无初始值 → TypeError
  空数组 + 无初始值 → TypeError

setTimeout → setInterval
  理由：setInterval 回调耗时超过间隔时背靠背执行，且有累积漂移
  实现：tick 里先 fn() 再 setTimeout，加 stopped 标记
  ★ 精确间隔用 next += delay（补偿耗时），不是 next = now + delay
  实测：fn 20ms + delay 50 → 相对 51/122/193；精确 50/101/150
```
