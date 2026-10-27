# 编程 02｜this 绑定与原型链

> 覆盖题号：5（call）、6（apply）、7（bind）、8（instanceof）、9（new）、33（new）、34（instanceof）、39（call+apply）、40（bind）
> 去重后：**5 个考点**

---

## 目录

- [2.0 这一册的共同内核：`this` 是「调用时」决定的，不是「定义时」决定的](#20-这一册的共同内核this-是调用时决定的不是定义时决定的)
- [2.1 手写 call](#21-手写-call)
- [2.2 手写 apply](#22-手写-apply)
- [2.3 手写 bind](#23-手写-bind)
- [2.4 手写 new](#24-手写-new)
- [2.5 手写 instanceof](#25-手写-instanceof)
- [2.6 本册串讲：一张图记住 5 道题](#26-本册串讲一张图记住-5-道题)
- [2.7 追问总表（跨题）](#27-追问总表跨题)
- [2.8 速记卡](#28-速记卡)
- [2.9 自测](#29-自测)

---

## 2.0 这一册的共同内核：`this` 是「调用时」决定的，不是「定义时」决定的

```js
function f() { return this; }

f();                    // 默认绑定 → globalThis / undefined
obj.f();                // 隐式绑定 → obj
f.call(x);              // 显式绑定 → x
new f();                // new 绑定 → 新对象
const g = f.bind(y);    // 硬绑定 → 永远 y
const h = () => this;   // 箭头函数 → 没有自己的 this
```

**这一册 5 道题，全部是在「手动实现这六种绑定中的某一种」**：

| 题 | 在实现什么 |
|---|---|
| `myCall` / `myApply` | 显式绑定（参数形式不同） |
| `myBind` | 硬绑定 + 保留 `new` 的能力 |
| `myNew` | new 绑定 + 原型链 |
| `myInstanceof` | 原型链查找（跟 this 无关，但同属「原型」这一族） |

**关键认知**：`this` 是在**函数被调用的那一刻**由「点号左边是谁」决定的。所以 `myCall` 的核心思路就是——**把函数临时挂到目标对象上，用点号调用它，然后再删掉**。理解这一点，5 道题都不用背。

---

## 2.1 手写 call

### 一句话结论

> 把函数临时挂到 `ctx` 上，用 `ctx.fn()` 的方式调用，这样 `this` 自然就指向 `ctx`。

### 原题单答案的问题

```js
Function.prototype.myCall = function(ctx, ...args) {
  ctx = ctx || globalThis;
  ctx.fn = this;
  const result = ctx.fn(...args);
  delete ctx.fn;
  return result;
};
```

**原答案能跑通基本路径，但有三处边界错误**（实测）。以下 `who` 指 `function who(a, b) { return this.name + ':' + a + b }`：

| 用例 | 期望 | 实际 |
|---|---|---|
| `obj = { name:'alice', fn:'ORIGINAL' }` 后 `who.myCall(obj)` | `obj.fn` 还是 `'ORIGINAL'` | **`undefined`（被永久删除）** |
| `who.myCall(1)` | `this` 是装箱后的 `Number` | **`ctx.fn is not a function`** |
| `fn` 内部 `throw` | 异常冒泡，但属性应被清理 | **`ctx.fn` 残留** |

#### 硬伤 1：属性污染

`ctx.fn = this` 会**覆盖** `ctx` 上已有的 `fn`；`delete ctx.fn` 之后，原值就永久丢了。修复：用 `Symbol()` 做键，保证不和任何字符串属性冲突。

#### 硬伤 2：原始值

`ctx = 1` 时 `ctx.fn = this` 在非严格模式下**静默失败**（不能给原始值设属性），然后 `ctx.fn(...)` 就报 `not a function`。

原生 `fn.call(1)` 会把 `1` **装箱**成 `Number` 对象。所以要显式 `Object(ctx)`。

#### 硬伤 3：异常时没清理

`ctx.fn(...args)` 抛错时，`delete` 不会执行。要用 `try/finally`。

### 正确实现

```js
Function.prototype.myCall = function (ctx, ...args) {
  if (typeof this !== 'function') {
    throw new TypeError('not a function');
  }

  // 1. null/undefined → 全局对象；原始值 → 装箱
  const target = (ctx === null || ctx === undefined) ? globalThis : Object(ctx);

  // 2. 用 Symbol 做键，避免覆盖 ctx 上的同名属性
  const key = Symbol('fn');
  Object.defineProperty(target, key, { value: this, configurable: true });

  // 3. 用点号调用，this 自然指向 target
  try {
    return target[key](...args);
  } finally {
    delete target[key];              // 4. 无论成功失败都清理
  }
};
```

实测（非严格模式下与原生一致）：

```
1) who.myCall({name:'alice'}, 1, 2)  → "alice:12"
2) ctx.fn 原值                       → "ORIGINAL"（未被污染）
3) myCall(null)                      → this === globalThis
4) myCall(1)                         → object/[object Number]（装箱）
   原生 call(1)                      → object/[object Number]
5) 无参数                            → "alice:undefinedundefined"
6) 严格模式目标函数 myCall(null)      → globalThis（原生 call(null) → null，不一致）
```

### 面试怎么说

- **接题思路**：`call` 就是「把函数临时挂到目标对象上，用点号调用，再删掉」，`this` 自然指向目标对象。
- **关键细节**：用 `Symbol` 做键避免覆盖同名属性；`defineProperty` 让临时属性不可枚举；调用包在 `try/finally` 里，抛错也能清理。
- **主动补边界**：`null`/`undefined` 落到 `globalThis`，原始值用 `Object(ctx)` 装箱；目标函数是严格模式时原生会保留原始 `this`，本实现不覆盖这一情形。

### 追问链

| 追问 | 答法 |
|---|---|
| 为什么用 `Symbol` 不用 `'fn'`？ | 字符串键会覆盖 ctx 上的同名属性。Symbol 是唯一的，不可能冲突 |
| `defineProperty` 为什么要加 `configurable: true`？ | 不加的话 `delete` 删不掉，属性永久残留 |
| 不用 `defineProperty` 行不行？ | 行，`target[key] = this` 也能跑。区别是会被 `Object.keys` / `for...in` 看到，而且如果 target 是冻结对象就直接失败 |
| 为什么严格模式下 `this` 是 `undefined`？ | 规范规定：非严格模式做 `this` 替换（`null`/`undefined` → 全局，原始值 → 装箱），严格模式不做 |

---

## 2.2 手写 apply

### 一句话结论

> 跟 `call` 一模一样，只是参数是**数组**。

### 原题单答案的问题

```js
Function.prototype.myApply = function(ctx, args) {
  ctx = ctx || globalThis;
  ctx.fn = this;
  const result = ctx.fn(...args);
  delete ctx.fn;
  return result;
};
```

除了 `call` 那三个问题之外，还有**第四个**（实测）：

```
who.myApply(obj)  → TypeError: args is not iterable (cannot read property undefined)
```

原生 `fn.apply(ctx)` 是合法的，等价于 `fn.call(ctx)`。但 `...undefined` 直接抛错。

> **这是 `apply` 相对 `call` 最容易漏的边界**：不传参数时要按空数组处理，不能直接展开 `undefined`。

### 正确实现

```js
Function.prototype.myApply = function (ctx, args) {
  if (typeof this !== 'function') throw new TypeError('not a function');

  const target = (ctx === null || ctx === undefined) ? globalThis : Object(ctx);
  const key = Symbol('fn');
  Object.defineProperty(target, key, { value: this, configurable: true });

  // 关键：用 Array.from，既支持数组也支持「类数组」
  const list = args == null ? [] : Array.from(args);

  try {
    return target[key](...list);
  } finally {
    delete target[key];
  }
};
```

以下 `who` 同 2.1，`o = { name: 'alice' }`：

```
1) myApply(o, [1,2])              → "alice:12"
2) myApply(o) 不传 args           → "alice:undefinedundefined"（原生也一样）
3) myApply(o, null)               → "alice:undefinedundefined"
4) myApply(o, {0:1,1:2,length:2}) → "alice:12"      ← 类数组
```

### 为什么要 `Array.from` 而不是 `[...args]`

| 输入 | `[...args]` | `Array.from(args)` |
|---|---|---|
| `[1,2]` | ✅ | ✅ |
| `{0:1, 1:2, length:2}` | ❌ 不是 iterable | ✅ |
| `'abc'` | ✅ `['a','b','c']` | ✅ |
| `null` / `undefined` | ❌ | ❌（`Array.from` 也抛，需先判空给 `[]`） |
| `arguments` | ✅ | ✅ |

> **`Array.from` 同时支持「可迭代」和「类数组」两种**，`[...]` 只支持可迭代。原生 `apply` 接受类数组，所以必须用 `Array.from`。

### 追问链

| 追问 | 答法 |
|---|---|
| `apply` 有长度限制吗？ | 有。参数多到超过引擎调用栈上限时抛 `RangeError: Maximum call stack size exceeded`；本机 Node 22 实测 65536 个参数正常，200000 个触发。**超大数组要分批处理，或直接用循环** |
| 为什么 `Math.max.apply(null, arr)` 能求最大值？ | 把 `Math.max` 的 `this` 指向 `null`（用不上），然后把数组展开成参数列表。**现在直接用 `Math.max(...arr)`** |
| 类数组有哪些？ | `arguments`、`NodeList`、`HTMLCollection`、`TypedArray`、`{0:'a',length:1}`。前三个现在都能 `for...of` 了 |
| `apply` 在现代代码里还用吗？ | 少了很多。展开运算符能替代大部分场景。**只剩两类：① 动态参数个数（`fn.apply(null, argsArray)`）；② 需要保持 `this` 同时传数组** |

---

## 2.3 手写 bind

### 一句话结论

> `bind` 返回新函数，同时做两件事：**固定 `this` 和前置参数**；但如果用 `new` 调用，`this` 要**让位给新对象**。

### 原题单答案的问题

```js
Function.prototype.myBind = function(ctx, ...args1) {
  const fn = this;
  return function(...args2) {
    return fn.apply(ctx, [...args1, ...args2]);
  };
};
```

**这个实现遇到 `new` 就完全失效**（实测）：

```
const inst = new (Person.myBind(null, 'tom'))(18);
inst                              → {}                      （期望 {name:'tom', age:18}）
inst instanceof Person            → false                   （期望 true）
inst.hi()                         → TypeError: inst.hi is not a function
非严格模式                         → globalThis.name === 'tom'（构造函数属性写到全局）
```

**根因**：`new Bound()` 时，JS 会创建一个新对象并把 `this` 指向它。但函数体里硬写了 `fn.apply(ctx, ...)`，`this` 被强行改成 `ctx`（这里是 `null`）——**新对象被丢弃了**。

规范规定 **`new` 的优先级高于 bind**：`new (fn.bind(obj))()` 的 `this` 是新对象，不是 `obj`，即「bind 的 this 会被 new 忽略」。

### 正确实现

```js
Function.prototype.myBind = function (ctx, ...args1) {
  if (typeof this !== 'function') {
    throw new TypeError('Bind must be called on a function');
  }
  const fn = this;

  function Bound(...args2) {
    // 关键：new.target 有值说明是 new 调用
    if (new.target) {
      // 用 Reflect.construct，把 newTarget 设成 Bound
      // 这样实例的原型链是 Bound.prototype → fn.prototype
      return Reflect.construct(fn, [...args1, ...args2], Bound);
    }
    // 普通调用：this 固定为 ctx
    return fn.apply(ctx, [...args1, ...args2]);
  }

  // 原型链：让 Bound.prototype 继承 fn.prototype
  if (fn.prototype) {
    Bound.prototype = Object.create(fn.prototype);
  }

  // 对齐原生的 length / name
  Object.defineProperty(Bound, 'length', {
    value: Math.max(0, fn.length - args1.length),
    configurable: true,
  });
  Object.defineProperty(Bound, 'name', {
    value: 'bound ' + (fn.name || ''),
    configurable: true,
  });

  return Bound;
};
```

设 `const Bound = Person.myBind(null, 'tom')`，`const inst = new Bound(18)`，`NB = Person.bind(null, 'tom')`；结果与原生一致（错误文案随实现不同）：

```
inst                              → {"name":"tom","age":18}
inst instanceof Person            → true
inst instanceof Bound             → true
inst.hi()                         → "hi tom"
inst.constructor === Person       → true
length / name                     → 1 / "bound Person"
箭头函数 bind 后 new               → TypeError: () => 1 is not a constructor
原生 `new NB(18)`：instanceof Person / instanceof NB → true / true
```

### 三个技术点（bind）

#### ① 为什么用 `new.target` 而不是 `this instanceof Bound`

老教材里常见写法是：

```js
if (this instanceof Bound) { ... }
```

**问题**：普通调用时如果 `this` 恰好是 `Bound` 的实例（原型链上有 `Bound.prototype`），也会被误判成 `new`。例如 `B.call(Object.create(B.prototype))` 会走进 `new` 分支。

`new.target` 是 ES6 专门为此设计的元属性：**只有通过 `new` 调用时才有值**，不可能误判。

#### ② 为什么 `Reflect.construct(fn, args, Bound)` 的第三个参数是 `Bound` 而不是 `fn`

这是最容易写错的一行。对比一下：

| 第三个参数 | 实例的原型 | `instanceof Bound` | `instanceof fn` |
|---|---|---|---|
| `fn`（错误） | `fn.prototype` | ❌ **false** | ✅ true |
| `Bound`（正确） | `Bound.prototype` → `fn.prototype` | ✅ true | ✅ true |

传 `fn` 时实例原型是 `fn.prototype`，`instanceof Bound` 为 false；传 `Bound` 时原型链是 `Bound.prototype → fn.prototype`，两者都为 true。原生 bind 出来的实例对 `Bound` 和原函数都返回 `true`。

#### ③ 为什么 `length` 要减 `args1.length`

规范规定：`bound.length = max(0, target.length - boundArgs.length)`。因为已经预填了参数，剩余需要的参数变少了。

### 追问链

| 追问 | 答法 |
|---|---|
| 多次 bind 会怎样？ | **只有第一次生效**。`fn.bind(a).bind(b)` 的 `this` 还是 `a`——因为第二个 bind 绑的是「第一个 bind 返回的函数」，那个函数内部已经硬编码了 `a` |
| 箭头函数能 bind 吗？ | 能调，但**没用**——箭头函数没有自己的 `this`，bind 的 `this` 会被忽略。而且 bind 后依然不能 `new` |
| `bind` 和 `call` 性能差多少？ | `bind` 多一次创建函数的开销。**更需要注意的是引用：bound 函数持有原函数与预置参数，长期保留会延长它们的生命周期**，循环里反复 bind 尤其要小心 |
| 为什么 React 类组件里要 `bind(this)`？ | 因为事件回调传出去后 `this` 丢了。现在用箭头函数或者 `useCallback` 解决 |
| `Bound.prototype` 为什么原生是 `undefined`？ | 规范里 bound function 没有 `prototype`；本实现为了 `instanceof Bound` 能工作，显式给了一个对象，这是有意与原生不同之处 |

---

## 2.4 手写 new

### 一句话结论

> 四步：**建对象 → 连原型 → 执行构造函数 → 处理返回值**。

### 原题单答案的问题

```js
function myNew(Constructor, ...args) {
  const obj = Object.create(Constructor.prototype);
  const result = Constructor.apply(obj, args);
  return result instanceof Object ? result : obj;
}
```

两个根因、三个失败现象（实测）：

| 用例 | 期望 | 实际 |
|---|---|---|
| 构造函数返回 `Object.create(null)` 的对象 | 返回那个对象 | **返回 `obj`（返回值被丢掉）** |
| `myNew(1)` | `TypeError: 1 is not a constructor` | `Object prototype may only be an Object or null: undefined`（错误信息误导） |
| **`myNew(class C {})`** | 正常实例 | **`TypeError: Class constructor C cannot be invoked without 'new'`** |

#### 问题 1：`result instanceof Object` 判断太宽松

`Object.create(null)` 创建的对象**没有原型链**，所以 `instanceof Object` 是 `false`——明明是个合法对象，却被判定为「不是对象」。

正确判断应该是：

```js
result !== null && (typeof result === 'object' || typeof result === 'function')
```

#### 问题 2：`apply` 调不了 class

ES6 的 class 构造函数**只能用 `new` 调用**，`Ctor.apply(obj)` 会直接抛错。所以老式的「`Object.create` + `apply`」写法**根本处理不了 class**。

### 正确实现（两个版本）

#### 版本 A：纸面版（考原型理解，必须会）

```js
function myNew(Ctor, ...args) {
  // 1. 校验
  if (typeof Ctor !== 'function') {
    throw new TypeError(`${String(Ctor)} is not a constructor`);
  }
  if (!Ctor.prototype) {
    throw new TypeError(`${String(Ctor)} is not a constructor`);   // 箭头函数 / 方法简写
  }

  // 2. 创建对象并连接原型
  const obj = Object.create(Ctor.prototype);

  // 3. 执行构造函数，this 指向新对象
  const result = Ctor.apply(obj, args);

  // 4. 处理返回值：只有「对象/函数」才替换，原始值忽略
  const isObjLike = result !== null
    && (typeof result === 'object' || typeof result === 'function');
  return isObjLike ? result : obj;
}
```

实测：

```
1) 返回对象 {b:2}            → {"b":2}
2) 返回 Object.create(null)   → 返回的是那个对象 ✓
3) 返回原始值 42              → {"a":1}
4) 返回函数                   → function
5) myNew(1)                   → "1 is not a constructor"
6) myNew(箭头函数)            → "()=>{} is not a constructor"
7) myNew(class C)             → TypeError: Class constructor C cannot be invoked without 'new'
8) 返回 null                  → {"a":1}
```

#### 版本 B：健壮版（支持 class）

```js
function myNew(Ctor, ...args) {
  if (typeof Ctor !== 'function') {
    throw new TypeError(`${String(Ctor)} is not a constructor`);
  }
  return Reflect.construct(Ctor, args);
}
```

实测：

```
1) 返回对象         → {"b":2}
2) 返回函数         → function
3) 返回原始值       → {"a":1}
4) class C, 参数 7  → {"x":7} | instanceof C: true | 方法: x=7   ← 版本 A 做不到
5) myNew(1)         → "1 is not a constructor"
```

`Reflect.construct` 会**同时完成「建对象 + 连原型 + 用 new 语义执行 + 处理返回值」四步**，并且能正确处理 class 与 `new.target`；纸面版只用于说明 new 的四步。

### new 的四个步骤（必背）

```
1. 创建一个空对象 obj
2. obj.__proto__ = Ctor.prototype
3. 执行 Ctor，this = obj，得到返回值 result
4. 如果 result 是对象/函数 → 返回 result；否则返回 obj
```

**第 4 步的规则要背准**：只有「对象」和「函数」会被当返回值，**`null` 也算原始值**（`typeof null === 'object'` 但它是特例）。

### 追问链

| 追问 | 答法 |
|---|---|
| 构造函数返回 `null` 会怎样？ | 返回新对象。`null` 是原始值（虽然 `typeof null === 'object'`，但规范里它是 Null 类型） |
| 为什么 `new` 一个箭头函数会报错？ | 箭头函数没有 `[[Construct]]` 内部方法，也没有 `prototype` |
| 对象方法简写能 new 吗？ | **不能**。`{ m() {} }.m` 也没有 `[[Construct]]` |
| `new.target` 是什么？ | 元属性，指向被 `new` 调用的那个构造函数。只有 `new` 调用才有值，比 `this instanceof Ctor` 更准确 |
| class 和构造函数 new 出来有区别吗？ | class 实例的方法在原型上、不可枚举；构造函数里 `this.m = function(){}` 是实例属性、可枚举。**class 还禁止不 new 调用** |
| `Reflect.construct` 比手写好在哪？ | 支持 class、支持 `new.target`、能指定 `newTarget` 实现继承。**`super()` 的底层就是它** |

---

## 2.5 手写 instanceof

### 一句话结论

> 沿原型链一路往上找，看能不能找到 `target.prototype`。

### 原题单答案的问题

```js
function myInstanceof(obj, target) {
  let proto = Object.getPrototypeOf(obj);
  while (proto) {
    if (proto === target.prototype) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}
```

三个问题（实测）：

| 用例 | 原生 | 原答案 |
|---|---|---|
| `1 instanceof Number` | `false` | **`true`** |
| `null instanceof Object` | `false` | **`TypeError`** |
| `{} instanceof 1` | `TypeError` | `false`（静默） |

#### 问题 1：原始值

`Object.getPrototypeOf(1)` 会**装箱**成 `Number` 对象再取原型，所以返回 `Number.prototype` → 判定为 `true`。但原生 `instanceof` 对原始值一律返回 `false`。

#### 问题 2：`null`

`Object.getPrototypeOf(null)` 直接抛 `TypeError: Cannot convert undefined or null to object`。

#### 问题 3：`target` 不是函数

`target.prototype` 是 `undefined`，循环永远不匹配 → 返回 `false`。原生应该抛 `TypeError`。

### 正确实现

```js
function myInstanceof(obj, target) {
  // 1. 右操作数必须是函数（可调用）
  if (typeof target !== 'function') {
    throw new TypeError("Right-hand side of 'instanceof' is not callable");
  }

  // 2. 自定义 Symbol.hasInstance 优先（ES6 允许改写 instanceof 行为）
  const desc = Object.getOwnPropertyDescriptor(target, Symbol.hasInstance);
  if (desc && typeof desc.value === 'function') {
    return desc.value.call(target, obj);
  }

  // 3. 原始值一律 false（含 null / undefined）
  if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) {
    return false;
  }

  // 4. 沿原型链查找
  let proto = Object.getPrototypeOf(obj);
  while (proto) {
    if (proto === target.prototype) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}
```

实测（`Dog extends Animal`，`d = new Dog()`；布尔结果与原生一致，错误文案由引擎决定）：

```
d vs Dog / Animal          → true / true
1 vs Number                → false    （原生也是 false）
null vs Object             → false    （原生也是 false，不抛错）
undefined vs Object        → false
[] vs Array / Object       → true / true
Object.create(null) vs Object → false  （没有原型链）
target 非函数               → TypeError: Right-hand side of 'instanceof' is not callable
Symbol.hasInstance 自定义   → true     （与原生一致）
```

> `target` 非函数时原生也抛 `TypeError`，但文案不同：原始值报 `... is not an object`，非可调用对象报 `... is not callable`。

### 三个技术点

| 点 | 为什么 |
|---|---|
| `typeof obj !== 'object' && !== 'function'` | 排除所有原始值。**注意要单独判 `typeof === 'function'`**，因为函数的 `typeof` 是 `'function'` 不是 `'object'` |
| `obj === null` 单独判 | `typeof null === 'object'`，会被上一条放过 |
| `Symbol.hasInstance` | ES6 允许通过 `Symbol.hasInstance` 自定义 `instanceof`；不判这条，自定义了该方法的类会与原生结果不一致 |

### 追问链

| 追问 | 答法 |
|---|---|
| `instanceof` 有什么局限？ | ① **跨 iframe/realm 失效**（不同窗口的 `Array` 是不同的构造函数）；② 无法判断原始类型；③ 可以被 `Symbol.hasInstance` 改写；④ 沿原型链查找是 O(n) |
| 那跨 iframe 怎么办？ | 用 `Array.isArray()`（它跨 realm 可靠）、`Object.prototype.toString.call()`、或者鸭子类型检测 |
| `typeof` 和 `instanceof` 区别？ | `typeof` 看**值的类型标签**（原始类型 + function）；`instanceof` 看**原型链**（只对对象有意义） |
| `instanceof` 和 `isPrototypeOf` 区别？ | `a instanceof B` ≈ `B.prototype.isPrototypeOf(a)`。区别是 `instanceof` 会走 `Symbol.hasInstance`，`isPrototypeOf` 不会 |
| 怎么判断一个值是不是「纯对象」？ | `Object.prototype.toString.call(x) === '[object Object]'`，或者检查原型是不是 `null` / `Object.prototype` |

---

## 2.6 本册串讲：一张图记住 5 道题

```
                    调用方式决定 this
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
     obj.f()          f.call(x)          new f()
   隐式绑定          显式绑定            new 绑定
        │                 │                 │
        │        ┌────────┴────────┐        │
        │     myCall           myApply      │
        │        │                 │        │
        │        └────────┬────────┘        │
        │                 │                 │
        │             myBind                │
        │        （延迟 + 硬绑定）            │
        │                 │                 │
        │        但 new 优先级更高 ←──────────┘
        │                 │
        └─────────────────┴──→ myNew（四步 + 原型链）
                                     │
                              原型链查找 → myInstanceof
```

**一句话把 5 道题串起来**：

> 「`call`/`apply` 是立即改变 `this`，`bind` 是把改变延迟到调用时、而且优先级低于 `new`。`new` 是创建新对象并按原型链连接。`instanceof` 是反过来沿原型链查找。**它们全都在操作同一个东西：`[[Prototype]]` 和 `this`。**」

---

## 2.7 追问总表（跨题）

| 问题 | 答法 |
|---|---|
| `this` 的六种绑定？ | 默认、隐式、显式、new、箭头（无自己的）、bind 硬绑定 |
| 优先级顺序？ | **new > bind > call/apply > 隐式 > 默认** |
| 箭头函数的 `this` 能改吗？ | 不能。它在定义时由外层词法作用域决定，`call`/`apply`/`bind` 全部无效 |
| 为什么 `(0, obj.fn)()` 会丢 `this`？ | 逗号表达式返回的是函数本身，调用时没有点号左边，走默认绑定（非严格模式为 `globalThis`） |
| `call` 和 `apply` 性能有差别吗？ | 差异只在参数形式；没有跨引擎的稳定性能结论，不适合作为考点 |
| 写不出来怎么办？ | 先写思路不写代码：`bind` 返回新函数，用 `apply` 固定 `this` 和前置参数；`new` 调用时让 `new.target` 走 `Reflect.construct`，并用 `Bound.prototype` 保住原型链 |

---

## 2.8 速记卡

```
【myCall】
  ctx 挂函数 → 点号调用 → 删除
  三个边界：Symbol 键（不污染）/ Object(ctx) 装箱 / try-finally

【myApply】
  唯一的差别：args 要 Array.from 支持类数组
  不传 args 要当 []，不能 ...undefined

【myBind】★ 最容易出错
  new.target 判断（不能用 instanceof Bound）
  Reflect.construct(fn, args, Bound)  ← 第三个参数是 Bound！
  原型链：Bound.prototype = Object.create(fn.prototype)
  length = max(0, fn.length - args.length)
  多次 bind 只认第一次

【myNew】
  四步：建对象 → 连原型 → 执行 → 处理返回值
  返回值判断：!== null && (object || function)，不能用 instanceof Object
  老版本不支持 class，要 class 就用 Reflect.construct

【myInstanceof】
  原始值（含 null）→ false
  target 非函数 → TypeError
  沿原型链找 target.prototype
  Symbol.hasInstance 优先

【优先级】new > bind > call/apply > 隐式 > 默认
```

---

## 2.9 自测

```
□ 能解释 myCall 为什么用 Symbol 做键
□ 能说出 myApply 与 myCall 的唯一差别（不传 args / 类数组）
□ 能解释 bind 的 this 为什么会被 new 忽略
□ 能说出用 new.target 而不是 this instanceof Bound 的原因
□ 能说出 Reflect.construct 第三个参数传错会怎样
□ 能背出 new 的四个步骤
□ 能说出 myNew 里返回值判断为什么不能用 instanceof Object
□ 能说出 instanceof 对原始值为什么必须返回 false
□ 能说出 instanceof 跨 iframe 为什么失效
□ 能说出 this 六种绑定的优先级
□ 能解释 (0, obj.fn)() 为什么丢 this
```
