# JS · 10 手写实现（上）· 函数与工具（题 11、12、57~63、71、73~75）

> 本册覆盖：防抖（题 11、57）、节流（题 11、58）、`call`/`apply`/`bind`（题 12、61）、`new`（题 62）、`instanceof`（题 63）、柯里化（题 59）、`compose`（题 71）、发布订阅（题 60）、`reduce`（题 73）、`add(1)(2)(3)`（题 75）、`setTimeout` 实现 `setInterval`（题 74）
> **题单这 12 道全部写着「同编程题文档第 X 题」——那份文档不在工作区**，所以本册从零实现。
> 所有实现在 Node 22 跑过，**防抖/节流还给实测执行次数**。

---

## 10.1 一句话结论

这一组题考的不是「能不能写出来」，而是**三个细节**：

| 细节 | 说明 |
|---|---|
| **`this` 和参数透传** | 用 `fn.apply(this, args)` 而不是 `fn(...args)` |
| **边界** | 空数组、`new` 调用、`cancel`、重复注册 |
| **为什么这么设计** | 比如「`bind` 后还能 `new` 吗」「为什么要 `setTimeout` 实现 `setInterval`」 |

**评分权重：边界 > 设计意图 > 代码正确性 > 简洁度。**

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
| **`fn.apply(this, args)`** | 用箭头函数的话 `this` 是外层（普通函数的外层 `this` 是调用者），必须显式传 |
| **`args` 在闭包里存** | 因为要延迟执行，参数必须捕获下来 |

**⚠️ 如果用箭头函数返回**：

```js
// ❌ this 丢失
function debounce(fn, wait) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);    // this 是 undefined
  };
}

// ✅ 要么用普通函数 + apply
// ✅ 要么用箭头函数但捕获外层 this（在方法里用不了）
```

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

**实测验证**（Node 22，100ms 内连续调用 5 次，`wait=100ms`）：

```
普通模式（immediate=false）：
  执行次数: 1，参数: 9          ← 只执行最后一次（第 10 次调用的参数）

immediate 模式：
  执行次数: 1，参数: 0          ← 只执行第一次
```

### 10.2.4 追问：`this` 为什么用 `apply` 不用 `call`

```js
fn.apply(this, args);        // 参数是数组
fn.call(this, ...args);      // 等价（ES6 展开）

// 都行，apply 更传统（不需要展开，老环境兼容好）
```

### 10.2.5 追问：为什么不能只写 `fn(...args)`

**因为 `args` 是数组，而 `fn` 期待的是展开的参数列表**：

```js
fn(...args);          // ✅ 展开
fn(args);             // ❌ 把整个数组当一个参数
```

**但在箭头函数里 `this` 会丢**，所以最稳的是 `fn.apply(this, args)`。

---

## 10.3 节流（throttle）

### 10.3.1 语义

> **保证 `wait` 毫秒内最多执行一次。**
> 场景：滚动监听、拖拽、鼠标移动、按钮防连击（不限首次）。

### 10.3.2 三种实现对比

| 版本 | 首次执行 | 末次执行 | 问题 |
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

#### 版本 2：定时器（末执行，首延迟）

```js
function throttle(fn, wait = 300) {
  let timer = null;
  return function (...args) {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
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

  return function (...args) {
    const now = Date.now();
    const remaining = wait - (now - last);

    if (remaining <= 0) {
      // 已经超过 wait，立即执行
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      // 还在 wait 内，但没排定时器 → 排一个「补齐剩余时间」的
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}
```

**实测验证**：

| 场景 | wait | 调用情况 | 实际执行次数 |
|---|---|---|---|
| 100ms 内连续 10 次（每 10ms） | 100ms | 10 次 | **2 次**（第 0ms 和第 100ms） |
| 1000ms 内每 50ms 一次（共 20 次） | 100ms | 20 次 | **11 次**（约每 100ms 一次） |

**为什么第二个场景是 11 次而不是 10 次**：因为首次立即执行（leading edge）额外多了 1 次。

### 10.3.3 防抖 vs 节流（一句话区分）

```
防抖：事件密集触发时 → 只认「最后一次」（或第一次）
      ┌──────────────────────┐
      │ 触发触发触发触发触发 → │ 等 300ms → 执行 1 次
      └──────────────────────┘

节流：事件密集触发时 → 「匀速执行」
      ┌──────────────────────┐
      │ 触发触发触发触发触发 → │ 每 300ms 执行 1 次
      └──────────────────────┘
```

**记忆**：
- **防抖 = 「等你停下来」**（搜索输入）
- **节流 = 「按节奏来」**（滚动、拖拽）

---

## 10.4 `call` / `apply` / `bind`（题 12、61）

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
  // ① 处理 null/undefined（非严格下指向 globalThis）
  ctx = ctx ?? globalThis;

  // ② 用 Symbol 当键，避免覆盖 ctx 上同名属性
  const key = Symbol('fn');

  // ③ 把函数挂上去（不可枚举，避免影响 for...in）
  Object.defineProperty(ctx, key, {
    value: this,
    enumerable: false,
    configurable: true,
  });

  // ④ 调用
  const ret = ctx[key](...args);

  // ⑤ 清理
  delete ctx[key];

  return ret;
};
```

**四个细节**：

| 细节 | 为什么 |
|---|---|
| **`ctx = ctx ?? globalThis`** | `fn.call(null)` 在非严格模式下 `this` 是 `globalThis` |
| **用 `Symbol` 而不是字符串键** | 字符串可能覆盖 `ctx` 上的真实属性（比如 `ctx.fn`） |
| **`enumerable: false`** | 不让它出现在 `for...in` / `Object.keys` 里 |
| **`delete ctx[key]`** | 用完必须清理，否则污染 `ctx` |

**⚠️ 原始值会被装箱**：

```js
fn.myCall(1);      // ctx = 1，非严格下会被装箱成 Number 对象
// 严格模式下不装箱，this 就是 1
```

### 10.4.3 手写 `apply`

```js
Function.prototype.myApply = function (ctx, args = []) {
  return this.myCall(ctx, ...args);
};
```

**`args` 要给默认值 `[]`**，因为 `fn.apply(ctx)` 是合法的（不传参数）。

**⚠️ 注意 `args` 可以是类数组**（`arguments`），所以严格说应该 `Array.from(args)`。面试简化版用展开就行。

### 10.4.4 手写 `bind`（重点：`new` 的处理）

```js
Function.prototype.myBind = function (ctx, ...preset) {
  const target = this;

  function Bound(...args) {
    // ★ 关键：如果被 new 调用，this 是新对象，忽略 ctx
    return target.myCall(
      this instanceof Bound ? this : ctx,
      ...preset,
      ...args
    );
  }

  // ★ 让 new Bound() 的实例原型正确
  Bound.prototype = Object.create(target.prototype);

  return Bound;
};
```

**两个关键点**：

**① `new` 调用时 `ctx` 失效**

```js
function Person(name) { this.name = name; }
const Bound = Person.myBind({ name: 'ignored' }, 'alice');

const p = new Bound();
p.name;                    // 'alice'（来自预设参数）
Object.getPrototypeOf(p) === Person.prototype;   // true  ← 原型正确
```

**实测确认**：`bp.name === 'new-name'`（预设参数生效），`instanceof Person === true`。

**规范依据**：`bind` 返回的函数在 `new` 调用时，`this` 是新建的对象，`boundThis` 被忽略（但预设参数仍然生效）。

**② `Bound.prototype = Object.create(target.prototype)`**

**为什么需要**：让 `new Bound()` 创建的实例，原型链是 `instance → Person.prototype`，这样：
- `instance instanceof Person` 为 true
- `instance` 能访问 `Person.prototype` 上的方法

**如果不设**：`instance` 的原型是 `Bound.prototype`（默认是 `{}`），链上找不到 `Person.prototype`。

**⚠️ 一个细节**：`Bound.prototype.constructor` 会变成 `Object`（因为 `Object.create` 不设 constructor）。严格实现要补：

```js
Bound.prototype = Object.create(target.prototype, {
  constructor: { value: Bound, enumerable: false, writable: true, configurable: true },
});
```

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

## 10.5 `new`（题 62）

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
myNew(arrow);   // 报错（箭头函数没有 prototype，Object.create(undefined) 会抛）
```

**规范层面**：箭头函数没有 `[[Construct]]`，`new` 直接抛 `TypeError`。

**③ `class` 也必须用 `new`**

```js
class C {}
C();            // TypeError: Class constructor C cannot be invoked without 'new'
```

---

## 10.6 `instanceof`（题 63）

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
| **① 原始值必须排除** | `1 instanceof Number` 是 **false**（实测确认） |
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
| **不能跨 realm** | 不同 iframe 的 `Array.prototype` 不同 |
| **可被 `Symbol.hasInstance` 改写** | `class Even { static [Symbol.hasInstance](n) { return n % 2 === 0 } }` |
| **改 `prototype` 会失效** | `F.prototype = {}` 后旧实例 `instanceof F` 变 false |

---

## 10.7 柯里化（题 59）

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

**所以「有默认参数」的函数没法用这个 `curry`**——要用下面的「不定长」版本。

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

**面试时要先问清**：「是 `add(1)(2)(3)` 隐式转数字，还是 `add(1)(2)(3)()` 显式调用？」——**这个澄清本身就是加分项**。

### 10.7.4 带占位符的柯里化（加分版）

```js
function curry(fn) {
  const PLACEHOLDER = Symbol('_');
  return function curried(...args) {
    // 判断参数是否够（且没有占位符）
    const valid = args.slice(0, fn.length).filter((a) => a !== PLACEHOLDER);
    if (valid.length >= fn.length) return fn.apply(this, args);

    return (...rest) => {
      // ★ 把新参数填到占位符位置
      const merged = [];
      let ri = 0;
      for (const a of args) {
        if (a === PLACEHOLDER && ri < rest.length) merged.push(rest[ri++]);
        else merged.push(a);
      }
      merged.push(...rest.slice(ri));
      return curried.apply(this, merged);
    };
  };
}

curry(fn)(1)(_, 3)(2);     // 占位符被后续参数填上
```

**这个版本面试很少要求，知道存在即可。**

---

## 10.8 `compose` / `pipe`（题 71）

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
```

### 10.8.2 关键点

| 点 | 说明 |
|---|---|
| **空参数** | `compose()` 应该返回恒等函数 `x => x`（`reduce` 不传初值会抛错，所以传 `x` 作为初值） |
| **`reduce` vs `reduceRight`** | 前者左到右，后者右到左 |
| **`this`** | 上面的实现不支持 `this`，严格实现要用 `function` 而非箭头 |

**支持空参数和多参数的写法**：

```js
const compose = (...fns) => {
  if (fns.length === 0) return (x) => x;
  if (fns.length === 1) return fns[0];
  return fns.reduce((a, b) => (...args) => a(b(...args)));
};
```

**这个版本支持「第一个函数接收多个参数」**（比如 `compose(f, g)(x, y)` → `f(g(x, y))`）。

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

## 10.9 发布订阅（题 60）

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
      fn(...args);
      this.off(name, wrapper);      // ★ 执行后自己摘掉
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
    // ★ 用 slice() 拷贝：防止回调里 off 导致遍历跳过元素
    (this.events.get(name) || []).slice().forEach((fn) => fn(...args));
    return true;
  }
}
```

**实测**：`on` 触发 2 次，`once` 只触发 1 次 ✅。

### 10.8.2 四个必须注意的点

**① `emit` 要用 `slice()` 拷贝数组**

```js
// ❌ 如果回调里调了 off，forEach 会跳过下一个元素
list.forEach((fn) => fn(...args));

// ✅ 拷贝一份再遍历
list.slice().forEach((fn) => fn(...args));
```

**这是最容易被忽略的 bug**：A 回调里注销了 B，会导致 B 后面的元素被跳过。

**② `once` 要先执行再摘掉**

```js
// ❌ 先摘掉再执行：如果 fn 抛错，就再也摘不掉了？不，是如果 fn 里又 emit 会重复
// ✅ 上面的写法是对的：先执行 fn，再 off
```

**更严谨的写法**（先摘再执行，防止递归 emit 重复）：

```js
once(name, fn) {
  const wrapper = (...args) => {
    this.off(name, wrapper);      // 先摘
    fn(...args);                  // 再执行
  };
  return this.on(name, wrapper);
}
```

**两种写法都能工作，但「先摘再执行」能防止「fn 里又 emit 同一事件」导致的重复执行。**

**③ `on` 返回取消函数（比返回 `this` 更易用）**

```js
// ✅ 返回 unsubscribe
const unsub = emitter.on('x', handler);
unsub();

// ⚠️ 返回 this（链式调用好看，但取消订阅不方便）
emitter.on('x', h1).on('y', h2);      // 链式
emitter.off('x', h1);                 // 得自己保存 h1
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

## 10.10 `reduce`（题 73）

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
    acc = arr[0];
    i = 1;
  }

  for (; i < arr.length; i++) {
    acc = fn(acc, arr[i], i, arr);
  }
  return acc;
};
```

**实测**：

```
[1,2,3].myReduce((a,b) => a+b, 10)  → 16
[1,2,3].myReduce((a,b) => a+b)      → 6
[].myReduce((a,b) => a+b)           → TypeError ✅
```

### 10.10.2 三个关键点

**① 用 `arguments.length` 判断而不是 `init === undefined`**

```js
// ❌ 错：显式传 undefined 时会被当成「没传」
[1, 2].reduce((a, b) => a + b, undefined);    // 1+2=3（其实走的是无初始值分支？）

// 实际测试：
[1, 2].reduce((a, b) => a + b, undefined);    // NaN
// 因为规范里：如果有 initialValue（即使 undefined），acc = undefined
// undefined + 1 = NaN
```

**规范用 `HasInitialValue`（内部标记），不是判 `undefined`。**

**② 稀疏数组会跳过空位**

```js
[1, , 3].reduce((a, b) => a + b, 0);    // 4（跳过了空位）
// 但按规范，回调不执行，空位被跳过
```

**③ 回调接收四个参数**

```js
arr.reduce((acc, cur, index, array) => {}, init);
//                      ↑      ↑
//                   当前索引  原数组
```

---

## 10.11 `add(1)(2)(3)`（题 75）

**见 10.7.2**（已并入柯里化）。核心是 `valueOf` / `toString`。

---

## 10.12 `setTimeout` 实现 `setInterval`（题 74）

### 10.12.1 为什么要这个

**`setInterval` 有三个问题**：

| 问题 | 说明 |
|---|---|
| **① 回调堆积** | 如果回调执行时间 > 间隔，会堆积（下一个还在排队） |
| **② 时间漂移** | 每次执行的实际间隔 ≈ 执行时间 + 间隔，误差累积 |
| **③ 无法动态调整** | 想改间隔只能 `clearInterval` 再重建 |

**实测验证第 ① 条**：

```js
// setInterval：回调耗时 > 间隔 → 堆积
setInterval(() => {
  const start = Date.now();
  while (Date.now() - start < 200) {}    // 阻塞 200ms
}, 100);
// 结果：回调会一个接一个立即执行，间隔远小于 100ms
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
| **`stopped` 标记** | 防止 `clear` 后已经在队列里的 `tick` 还执行 |
| **返回 `{ clear }`** | 模仿 `clearInterval` 的用法 |

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

**`next += delay` 而不是 `next = Date.now() + delay`**——这样才能补偿执行误差，保持长期平均间隔准确。

**这个细节答出来很加分**：它区分了「相对间隔」和「绝对时间点」两种策略。

---

## 10.13 常见坑

| 坑 | 正确说法 |
|---|---|
| 防抖里写 `fn(...args)` 而不用 `apply` | `this` 会丢（尤其在箭头函数里） |
| 节流只用时间戳版 | 会丢最后一次，要用合体版 |
| `bind` 手写忘了处理 `new` | `new Bound()` 时 `this` 应该是新对象 |
| `bind` 忘了设 `Bound.prototype` | `instanceof` 会失效 |
| `call` 用字符串键挂方法 | 会覆盖 `ctx` 上的同名属性，用 `Symbol` |
| `call` 忘了 `delete` | 污染 `ctx` |
| `new` 判断返回值只判 `object` | 还要判 `function` |
| `new` 忘了排除 `null` | `null` 是原始值，要返回新对象 |
| `instanceof` 没排除原始值 | `1 instanceof Number` 是 false |
| `instanceof` 用 `__proto__` | 应该用 `Object.getPrototypeOf` |
| `curry` 用 `fn.length` 判断参数够不够 | 有默认值/rest 参数时 `length` 不准 |
| `add(1)(2)(3)` 忘了 `valueOf`/`toString` | 隐式转换拿不到数值 |
| `add(1)(2)(3) === 6` 以为是 true | ❌ `===` 不触发转换 |
| `emit` 用 `forEach` 不拷贝 | 回调里 `off` 会导致跳过元素 |
| `once` 忘了摘掉自己 | 会重复执行 |
| 用对象存事件列表 | `'toString'` 等键有原型链干扰，用 `Map` |
| `myReduce` 用 `init === undefined` 判断 | 应该用 `arguments.length` |
| `setTimeout` 版 `setInterval` 忘了 `stopped` 标记 | `clear` 后可能还执行一次 |

---

## 10.14 答题模板

### 30 秒版（题 11：防抖节流）

> **防抖**是「事件停止触发 `wait` 毫秒后才执行一次」——适合搜索联想、表单校验。
> **节流**是「`wait` 毫秒内最多执行一次」——适合滚动、拖拽。
> 防抖的关键是「每次触发都清掉上一个定时器」；节流有三种实现：时间戳版（首执行、丢末次）、定时器版（末执行、首延迟）、合体版（首末都执行，推荐）。
> 两个都必须用 `fn.apply(this, args)` 保留 `this` 和参数，还要提供 `cancel` 方法供组件卸载时清理。

### 30 秒版（题 61：`call`/`apply`/`bind` 手写）

> `call` 的核心是「把函数临时挂到目标对象上当方法调用」——用 `Symbol` 作键避免属性覆盖，`Object.defineProperty` 设 `enumerable: false`，用完 `delete` 清理。
> `apply` 就是把数组展开后调 `call`。
> `bind` 复杂一点：要返回一个新函数，且**必须处理 `new` 调用的情况**——被 `new` 时 `this` 应该是新建对象而不是绑定的 `ctx`，所以用 `this instanceof Bound ? this : ctx` 判断；还要设 `Bound.prototype = Object.create(target.prototype)` 保证 `instanceof` 正确。

### 2 分钟版（把这一组串起来讲，推荐）

> 这一组手写题有个共同点：**都是在「模拟语言内置行为」**，所以核心是「规范怎么定义的」。
>
> **防抖节流**是最常考的。防抖是「清零重计时」，节流是「匀速放行」。防抖要补 `immediate`（首次立即执行，按钮防连击）和 `cancel`（卸载时清理）。节流三个版本必须都答得出——时间戳版会丢最后一次，定时器版首次有延迟，合体版用 `remaining` 计算补齐，首末都执行。实测数据可以加强说服力：100ms 内触发 10 次，防抖执行 1 次，节流执行 2 次。
>
> **`call`/`apply` 是同一套实现**，核心技巧是「临时挂方法」。三个细节：用 `Symbol` 当键避免覆盖、`enumerable: false` 避免污染枚举、用完 `delete`。
>
> **`bind` 有两个坑**。一是 `new` 调用时 `ctx` 要失效——规范里 `BoundFunction` 被 `new` 时 `this` 是新对象，所以要用 `this instanceof Bound` 判断。二是要设 `Bound.prototype`，否则 `new Bound()` 出来的实例原型链断了，`instanceof` 会失败。还有个冷知识：`bind` 只能绑一次，再次 `bind` 新 `ctx` 会被忽略。
>
> **`new` 四步**里第 ④ 步最容易错：要判「返回的是对象**或函数**」，而且 `null` 要排除。
>
> **`instanceof`** 核心是沿 `Object.getPrototypeOf` 找，两个坑：原始值直接 false、循环条件判 `proto` 为 null 终止。
>
> **发布订阅**最容易忽略的是 `emit` 要用 `slice()` 拷贝数组——否则回调里调 `off` 会导致 `forEach` 跳过元素。另外 `on` 返回 unsubscribe 函数比返回 `this` 更实用，Vue 3 的 `watch` 返回 `stop` 也是这个设计。
>
> **`setTimeout` 实现 `setInterval`** 的理由要答出来：`setInterval` 在回调耗时超过间隔时会**堆积**，而且有累积漂移；`setTimeout` 递归是「执行完才开始计时」，不会堆积。如果要精确间隔，还得用 `next += delay` 的绝对时间点策略补偿耗时。

### 追问表

| 追问 | 回答要点 |
|---|---|
| 防抖和节流的区别 | 「等你停下来」vs「按节奏来」 |
| 防抖的 `immediate` 是什么 | 首次立即执行，之后 `wait` 内忽略 |
| 节流为什么要合体版 | 时间戳版丢末次、定时器版首次延迟 |
| 为什么用 `apply` 不用直接调 | 保留 `this` 和展开参数 |
| `call` 为什么要用 `Symbol` | 避免覆盖 `ctx` 同名属性 |
| `call` 为什么要 `delete` | 不污染 `ctx` |
| `bind` 后还能 `new` 吗 | 能，且 `this` 是新对象，`ctx` 失效 |
| `bind` 为什么要设 `prototype` | 保证 `instanceof` 和原型方法可用 |
| `bind` 能绑多次吗 | 不能，只有第一次生效 |
| `new` 的第 4 步要注意什么 | 判对象**或函数**，并排除 `null` |
| `instanceof` 能判断原始值吗 | 不能，`1 instanceof Number` 是 false |
| `curry` 用 `fn.length` 有什么问题 | 有默认值/rest 参数时不准 |
| `add(1)(2)(3)` 靠什么拿值 | `valueOf`（数值）/ `toString`（字符串） |
| `add(1)(2)(3) === 6` 是 true 吗 | 不是，`===` 不触发转换 |
| `compose` 和 `pipe` 区别 | 右到左 vs 左到右 |
| `emit` 为什么要 `slice` | 回调里 `off` 会导致跳过元素 |
| 发布订阅和观察者区别 | 发布订阅有事件中心（解耦） |
| `reduce` 怎么判断有没有初始值 | `arguments.length`，不是 `=== undefined` |
| 为什么要 `setTimeout` 实现 `setInterval` | `setInterval` 会堆积、有漂移 |
| 怎么做到精确间隔 | 用 `next += delay` 绝对时间点补偿 |

---

## 10.15 速记卡

```
防抖（题 11、57）
  语义：停止触发 wait 后执行一次
  实现：每次 clearTimeout 再 setTimeout
  ★ fn.apply(this, args) 保 this 和参数
  ★ immediate：首次立即执行（按钮防连击）
  ★ cancel：卸载时清理
  实测：100ms 内 10 次 → 执行 1 次（参数是最后一次）

节流（题 58）
  语义：wait 内最多执行一次
  三版：时间戳（首执行丢末次）/ 定时器（末执行首延迟）/ 合体（首末都执行）
  ★ 合体版用 remaining = wait - (now - last) 计算补齐
  实测：100ms 内 10 次 → 2 次；1000ms 每 50ms → 11 次

call / apply（题 61）
  核心：把函数临时挂到 ctx 上当方法
  ★ Symbol 作键避免覆盖 + enumerable: false + delete 清理
  ★ ctx = ctx ?? globalThis（非严格下 null 指向全局）
  apply = myCall(ctx, ...args)

bind（题 61）
  返回新函数，要处理两件事：
  ★ new 调用时 ctx 失效：this instanceof Bound ? this : ctx
  ★ Bound.prototype = Object.create(target.prototype) 保 instanceof
  ★ bind 只能绑一次，再 bind 新 ctx 被忽略

new（题 62）
  ① Object.create(Ctor.prototype) ② apply ③ 返回对象/函数则用它，否则用 obj
  ★ 必须判 'function'；必须排除 null

instanceof（题 63）
  沿 Object.getPrototypeOf 找，while (proto) 判 null 终止
  ★ 原始值直接 false
  ★ 不用 __proto__（遗留特性）
  限制：不能跨 realm / 可被 Symbol.hasInstance 改写 / 改 prototype 会失效

柯里化（题 59）+ add(1)(2)(3)（题 75）
  curry：args.length >= fn.length 则执行
  ★ fn.length 不含默认值/rest 参数
  add：递归 + ★ valueOf/toString 让隐式转换拿值
  ★ add(1)(2)(3) === 6 是 false（=== 不转换）
  若要求 add(1)(2)(3)()，则不需要 valueOf

compose / pipe（题 71）
  compose = reduceRight（右到左）；pipe = reduce（左到右）
  ★ 空参数返回恒等函数（reduce 初值传 x）
  Redux 的 applyMiddleware 就是 compose

发布订阅（题 60）
  on 返回 unsubscribe（比返回 this 实用）；once 先摘再执行
  ★ emit 必须 slice() 拷贝，否则回调里 off 会跳过元素
  ★ 用 Map 不用普通对象（避免原型链干扰）
  发布订阅 = 观察者 + 事件中心

reduce（题 73）
  ★ 用 arguments.length < 2 判断，不能 init === undefined
  空数组 + 无初始值 → TypeError

setTimeout → setInterval（题 74）
  理由：setInterval 回调超时会【堆积】+ 累积漂移
  实现：tick 里先 fn() 再 setTimeout，加 stopped 标记
  ★ 精确间隔用 next += delay（补偿耗时），不是 next = now + delay
```
