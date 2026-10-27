# 分册 02 · 对象、原型与继承

> 覆盖题号：**9**（`new` 发生了什么）、**32**（原型与原型链）、**5**（`class` 与普通函数的区别）、**14**（`Object.assign` 是深拷贝还是浅拷贝）
> 共 **4 题**

---

## 目录

- [2.1 new 一个函数发生了什么](#21-new-一个函数发生了什么)
- [2.2 原型与原型链](#22-原型与原型链)
- [2.3 class 与普通函数的区别](#23-class-与普通函数的区别)
- [2.4 Object.assign 与深浅拷贝](#24-objectassign-与深浅拷贝)
- [2.5 本册答题模板汇总](#25-本册答题模板汇总)
- [2.6 速记卡与连环追问](#26-速记卡与连环追问)

---

## 2.1 new 一个函数发生了什么

### 2.1.0 一句话结论

> `new` 做了**四件事**：① 创建一个新的空对象；② 把这个对象的原型指向构造函数的 `prototype`；③ 把构造函数里的 `this` 绑定到这个新对象并执行；④ **如果构造函数返回的是对象，就返回它；否则返回这个新对象**。

### 2.1.1 四步拆解

```js
function Person(name) {
  this.name = name;
}

const p = new Person('Tom');
```

```
① 创建空对象
   obj = {}

② 链接原型
   Object.setPrototypeOf(obj, Person.prototype)
   → obj.__proto__ === Person.prototype

③ 绑定 this 并执行
   Person.call(obj, 'Tom')
   → obj.name = 'Tom'

④ 决定返回值
   Person 返回 undefined（不是对象）→ 返回 obj
```

**对应到规范（ES2023, `[[Construct]]`）**：

```
1. newTarget = newTarget ?? F
2. thisArgument = OrdinaryCreateFromConstructor(newTarget, "%Object.prototype%")
   ← 这一步同时完成"创建对象"和"链接原型"，且如果 newTarget.prototype 不是对象，
      会回退到 Object.prototype（不会报错）
3. result = F.[[Call]](thisArgument, args)
4. if Type(result) is Object → return result
5. return thisArgument
```

### 2.1.2 第四步：返回值的三个分支

```js
// ① 返回原始值 → 被忽略，还是返回新对象
function A() {
  this.x = 1;
  return 42;
}
console.log(new A());        // A { x: 1 }  ← 42 被忽略

// ② 返回对象 → 用返回的对象
function B() {
  this.x = 1;
  return { y: 2 };
}
console.log(new B());        // { y: 2 }  ← this 上的属性被丢弃

// ③ 返回 null → null 是原始值（Type(null) 是 Null，不是 Object）→ 被忽略
function C() {
  this.x = 1;
  return null;
}
console.log(new C());        // C { x: 1 }
```

> 只有返回**对象**（数组、函数、`new` 出来的实例）才会覆盖 `this`；`null`、`undefined`、数字、字符串、布尔、`Symbol`、`BigInt` 都是原始值，会被忽略。

### 2.1.3 手写 `myNew`

```js
function myNew(Ctor, ...args) {
  // ① 校验：必须是函数
  if (typeof Ctor !== 'function') {
    throw new TypeError(`${Ctor} is not a constructor`);
  }

  // ② 创建对象并链接原型
  //    注意：Ctor.prototype 可能不是对象（比如箭头函数没有 prototype）
  const proto = Ctor.prototype;
  const obj = Object.create(
    proto !== null && (typeof proto === 'object' || typeof proto === 'function')
      ? proto
      : Object.prototype
  );

  // ③ 绑定 this 执行
  const result = Ctor.apply(obj, args);

  // ④ 处理返回值
  const isObject = result !== null && (typeof result === 'object' || typeof result === 'function');
  return isObject ? result : obj;
}

// 测试
function Person(name, age) {
  this.name = name;
  this.age = age;
}
Person.prototype.greet = function () {
  return `Hi, ${this.name}`;
};

const p = myNew(Person, 'Tom', 18);
console.log(p.name);                          // 'Tom'
console.log(p.greet());                       // 'Hi, Tom'
console.log(p instanceof Person);             // true

// 边界：构造函数返回对象
function Weird() { return { hijack: true }; }
console.log(myNew(Weird));                    // { hijack: true }
```

**三个局限**：

1. **不能处理 `class`**：`class` 的构造函数不能直接 `apply` 调用（会抛 `TypeError: Class constructor cannot be invoked without 'new'`）。要支持得用 `Reflect.construct(Ctor, args, Ctor)`。
2. **不能正确处理 `extends` 的派生类**：派生类的 `this` 是由 `super()` 创建的，不能先 `Object.create` 再 `apply`。
3. **不校验能否构造**：箭头函数、方法简写没有 `prototype`，`myNew` 会返回一个普通对象而不报错；`bind` 结果也没有 `prototype`，但原生 `new` 仍可构造目标函数。

```js
// 完整版（支持 class）
function myNewFull(Ctor, ...args) {
  return Reflect.construct(Ctor, args);
}
// Reflect.construct(target, args, newTarget?) 就是 new 的函数式表达
// 第三个参数 newTarget 决定 prototype 用谁的，这是实现"借用构造函数造不同实例"的关键
```

### 2.1.4 `new` 与 `Object.create` 的关系

```js
// 这两段不等价
const a = new Foo();                 // 执行了构造函数
const b = Object.create(Foo.prototype);  // 只链接原型，不执行构造

// new 的基本流程等价于（未含返回值分支）：
const c = Object.create(Foo.prototype);
Foo.call(c);
```

| 方式 | 创建对象 | 链接原型 | 执行构造函数 |
|---|---|---|---|
| `new Foo()` | ✅ | ✅ | ✅ |
| `Object.create(Foo.prototype)` | ✅ | ✅ | ❌ |
| `{}` | ✅ | ✅（指向 `Object.prototype`） | ❌ |

`Object.create(null)` 创建**没有原型**的字典对象，避免 `obj.toString`、`obj.constructor` 这类原型污染：

```js
const dict = Object.create(null);
dict['toString'] = 'not a function';
console.log(dict.toString);   // 'not a function'  ← 没有原型链干扰
console.log(dict.hasOwnProperty);  // undefined ← 连 hasOwnProperty 都没有，要用 Object.hasOwn
```

### 2.1.5 三个常见误区

```js
// 误区 1：new 箭头函数
const f = () => {};
new f();   // ❌ TypeError: f is not a constructor（没有 [[Construct]]）

// 误区 2：new 一个返回基本类型的方法
function g() { return 1; }
console.log(new g());   // g {}  ← 不是 1

// 误区 3：忘记 new 导致的 this 污染
function H() { this.x = 1; }
const h = H();              // 忘了 new → this 是全局对象（非严格模式）
console.log(globalThis.x);  // 1  ← 全局污染
```

**防呆写法**：

```js
function Safe(name) {
  if (!(this instanceof Safe)) {
    return new Safe(name);   // 自动补 new
  }
  this.name = name;
}
Safe('Tom');   // 也能正常工作
```

### 2.1.6 答题要点

- `new` 四步：创建空对象 → 链到 `Ctor.prototype` → 绑定 `this` 执行 → 返回值判定。
- 返回值只有对象（含函数、数组）会覆盖新对象；原始值（含 `null`）被忽略。
- `Ctor.prototype` 不是对象时回退到 `Object.prototype`，不报错。
- `Object.create(Ctor.prototype)` + `Ctor.apply(obj, args)` 只能模拟普通函数；class 与派生类要用 `Reflect.construct(Ctor, args[, newTarget])`。

### 2.1.7 追问表

| 追问 | 答题要点 |
|---|---|
| `new` 的第四步是什么？ | 返回对象则用它，否则用新对象 |
| 返回 `null` 会覆盖吗？ | 不会，`null` 是原始值（`Type(null)` 是 `Null`） |
| 返回函数会覆盖吗？ | 会，函数也是对象 |
| `new` 箭头函数？ | 报错，没有 `[[Construct]]` |
| `new` 一个 `class`？ | 正常（class 就是设计给 `new` 的） |
| 不用 `new` 调用 `class`？ | 报错 `Class constructor cannot be invoked without 'new'` |
| `Object.create` 和 `new` 的区别？ | 前者不执行构造函数 |
| `Object.create(null)` 有什么用？ | 创建无原型字典，避免原型污染 |
| `Ctor.prototype` 不是对象会怎样？ | 回退到 `Object.prototype`，不报错 |
| 怎么判断一个函数能否 `new`？ | 用 `Reflect.construct` 试最可靠；看 `prototype` 不严谨：generator 有 `prototype` 但不能 `new`，`bind` 结果没有 `prototype` 却能 `new` |
| `new.target` 是什么？ | 在构造函数内可访问，指向被 `new` 的那个构造函数；普通调用时是 `undefined` |

---

## 2.2 原型与原型链

### 2.2.0 一句话结论

> 每个对象都有一个内部槽 `[[Prototype]]`（可通过 `Object.getPrototypeOf` 读取，`__proto__` 是 `Object.prototype` 上暴露它的访问器），指向**另一个对象**。访问属性时先查自身，找不到就沿 `[[Prototype]]` 逐级向上，直到 `null`——这条链就是**原型链**。它的作用是**实现属性/方法共享**，也是 `instanceof`、`for...in` 的底层依据。

### 2.2.1 三个容易混的东西

| 名称 | 本质 | 谁有 | 怎么读 |
|---|---|---|---|
| `[[Prototype]]` | **内部槽**（规范概念） | 所有对象 | 只能用 `Object.getPrototypeOf` |
| `__proto__` | `Object.prototype` 上的**访问器属性**（getter/setter，Annex B） | 继承自 `Object.prototype` 的对象 | `obj.__proto__` |
| `prototype` | **函数的普通属性**，值是个对象 | 普通函数、class、generator（generator 不可 `new`）；箭头函数、方法简写、async 函数、`bind` 结果没有 | `Fn.prototype` |

```js
function Foo() {}
const f = new Foo();

console.log(f.__proto__ === Foo.prototype);            // true
console.log(Object.getPrototypeOf(f) === Foo.prototype); // true

// 三者的关系：
// ① f 的 [[Prototype]] → Foo.prototype
// ② Foo（函数本身）的 [[Prototype]] → Function.prototype
// ③ Foo.prototype 的 [[Prototype]] → Object.prototype
```

**关键区分**：

> `Foo.prototype` 是**给 `new Foo()` 创建出来的实例用的**，不是 `Foo` 自己的原型。
> `Foo` 自己的原型是 `Function.prototype`，即 `Foo.__proto__ === Function.prototype`。

```js
function Foo() {}
console.log(Foo.prototype.constructor === Foo);              // true
console.log(Foo.__proto__ === Function.prototype);           // true
console.log(Foo.prototype.__proto__ === Object.prototype);   // true
```

### 2.2.2 完整原型链图

```
                        null
                          ↑
                          │ [[Prototype]]
                ┌─────────────────────┐
                │  Object.prototype   │  ← 原型链的终点（它的 __proto__ 是 null）
                └─────────────────────┘
                    ↑             ↑
        ┌───────────┘             └──────────────┐
        │                                        │
┌───────────────────┐                  ┌──────────────────────┐
│ Function.prototype│                  │  Foo.prototype       │
│  （call/apply/    │                  │  { constructor: Foo }│
│   bind 在这里）    │                  └──────────────────────┘
└───────────────────┘                            ↑
        ↑                                        │
        │ [[Prototype]]                          │ [[Prototype]]
        │                                        │
┌───────────────────┐                  ┌──────────────────────┐
│      Foo          │                  │   f = new Foo()      │
│  （函数对象）      │                  │   （实例）            │
└───────────────────┘                  └──────────────────────┘
        ↑
        │ Foo.__proto__ === Function.prototype

  另外：Function.__proto__ === Function.prototype  ← 唯一一个自己指向自己原型的
        Object.__proto__   === Function.prototype  ← Object 也是函数
```

**四条恒成立的关系**：

```js
console.log(Function.__proto__ === Function.prototype);   // true  ← 唯一的自环
console.log(Object.__proto__ === Function.prototype);     // true  ← Object 也是函数
console.log(Function.prototype.__proto__ === Object.prototype); // true
console.log(Object.prototype.__proto__);                  // null  ← 链的终点
```

> **为什么 `Function.__proto__ === Function.prototype`？** `Function` 本身也是函数，所有函数的 `[[Prototype]]` 都指向 `Function.prototype`，所以它指向自己。

### 2.2.3 属性查找与几个相关 API

```js
function Foo() {}
Foo.prototype.inProto = 'proto';
const f = new Foo();
f.own = 'own';

// ① 属性查找：自身 → 原型链 → null
console.log(f.own);        // 'own'
console.log(f.inProto);    // 'proto'（从原型链找到）
console.log(f.notExist);   // undefined（走到 null 还没有）

// ② 三种判断方式，语义完全不同
console.log('own' in f);              // true  ← 自身 + 原型链
console.log('inProto' in f);          // true  ← 包含原型链
console.log(f.hasOwnProperty('own')); // true  ← 只查自身
console.log(Object.hasOwn(f, 'own')); // true  ← ES2022，更安全（不怕对象没原型）

// ③ instanceof：检查 Ctor.prototype 是否在 obj 的原型链上
console.log(f instanceof Foo);        // true
console.log(f instanceof Object);     // true（Object.prototype 也在链上）

// ④ isPrototypeOf：语义相反
console.log(Foo.prototype.isPrototypeOf(f));  // true

// ⑤ 手动改原型（性能差，慎用）
Object.setPrototypeOf(f, null);   // 断链
```

**`instanceof` 的实现原理**：

```js
function myInstanceof(obj, Ctor) {
  if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) return false;
  let proto = Object.getPrototypeOf(obj);
  while (proto !== null) {
    if (proto === Ctor.prototype) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}
```

> ⚠️ 注意：`typeof` 判断里必须包含 `'function'`，因为函数也能被 `instanceof` 判断（`fn instanceof Function`）。

### 2.2.4 继承的五种演进

五种方案逐层解决上一个方案的问题：

#### ① 原型链继承

```js
function Parent() { this.colors = ['red']; }
Parent.prototype.say = function () { console.log('hi'); };

function Child() {}
Child.prototype = new Parent();        // 关键
Child.prototype.constructor = Child;   // 修正 constructor

const c1 = new Child();
const c2 = new Child();
c1.colors.push('blue');
console.log(c2.colors);   // ['red', 'blue']  ❌ 引用被共享
```

**问题**：引用类型属性被所有实例共享；创建子类实例时无法传参。

#### ② 构造函数继承（借用父类）

```js
function Child(name) {
  Parent.call(this);     // 关键：复制父类实例属性到子类 this
  this.name = name;
}
```

**解决**：引用共享问题解决 ✅、可传参 ✅
**新问题**：**方法没继承**（父类原型上的方法拿不到）；若父类把函数写在构造函数里，每个实例都会复制一份。

#### ③ 组合继承

```js
function Child(name) {
  Parent.call(this);        // 第一次调用 Parent：拿实例属性
  this.name = name;
}
Child.prototype = new Parent();   // 第二次调用 Parent：拿原型方法
Child.prototype.constructor = Child;
```

**解决**：属性独立 ✅、方法共享 ✅、可传参 ✅
**新问题**：**父类构造函数被调用了两次**，`Child.prototype` 上多了一份无用的父类实例属性。

#### ④ 寄生组合继承

```js
function Child(name) {
  Parent.call(this);              // 只调一次 Parent
  this.name = name;
}
// 用 Object.create 直接链接原型，避免再调一次 Parent
Child.prototype = Object.create(Parent.prototype);
Child.prototype.constructor = Child;
```

**解决**：只调用一次父类构造函数 ✅ —— 这就是 `class extends` 编译后的样子（Babel 输出的 `_inherits` 就是这个逻辑）。

#### ⑤ `class extends`

```js
class Parent {
  constructor() { this.colors = ['red']; }
  say() { console.log('hi'); }
}
class Child extends Parent {
  constructor(name) {
    super();          // 必须在使用 this 之前调用
    this.name = name;
  }
}
```

**本质仍是原型链**，但多了两条链：

```js
class B extends A {}

B.__proto__ === A;                        // ✅ 静态属性/方法继承
B.prototype.__proto__ === A.prototype;    // ✅ 实例属性/方法继承
```

> **这个"双链"是 class 相比 ES5 继承的独特之处**：`static` 方法和静态属性通过 `B.__proto__ → A` 继承，实例方法通过 `B.prototype.__proto__ → A.prototype` 继承。ES5 的组合继承没有第一条链，所以静态方法不会继承。

### 2.2.5 为什么建议"不要在原型上放引用类型"

```js
function Bad() {}
Bad.prototype.list = [];        // ❌ 所有实例共享

const a = new Bad();
const b = new Bad();
a.list.push(1);
console.log(b.list);            // [1]  ← b 也被污染了

// ✅ 正确做法：实例属性放构造函数里（或 class 字段）
function Good() { this.list = []; }   // 每个实例独立
```

> 这与 Vue 的 `data` 必须是函数同理：**原型上的东西是所有实例共享的，实例上的东西才是私有的。**

### 2.2.6 性能相关

| 操作 | 性能影响 |
|---|---|
| 访问**原型链深处**的属性 | 慢（要走多层） |
| 访问**不存在的**属性 | 慢（要走完整条链到 `null`） |
| `for...in` | 慢（要枚举整条原型链） |
| `Object.setPrototypeOf` / `__proto__ =` | **非常慢**（会破坏引擎的内联缓存，推荐用 `Object.create` 在创建时指定） |
| 在原型上加方法 | 快（只加一次，所有实例共享） |
| 每个实例上挂方法 | 慢 + 费内存 |

**写法对比**：

```js
// ❌ 每个实例都有一个新的 say 函数
function A() {
  this.say = function () {};
}

// ✅ 所有实例共享一个 say
function B() {}
B.prototype.say = function () {};

// ✅ class 的写法天然就是原型方法
class C {
  say() {}         // 在 C.prototype 上
  handle = () => {}; // ⚠️ 这个是实例属性，每个实例一份（React 里常见）
}
```

### 2.2.7 答题要点

- `[[Prototype]]` 是内部槽，用 `Object.getPrototypeOf` 读；`__proto__` 是 `Object.prototype` 上的访问器；`prototype` 是函数属性，给实例用。
- 属性查找沿原型链到 `null`；`Foo.prototype` 是实例的原型，`Foo` 自己的原型是 `Function.prototype`。
- `Function.__proto__ === Function.prototype` 是唯一自环；链的终点是 `Object.prototype.__proto__ === null`。
- `instanceof` 沿链查找 `Ctor.prototype`；`in` 含原型链，`Object.hasOwn` 只查自身。
- 继承演进：原型链继承共享引用 → 借用构造函数丢原型方法 → 组合继承调两次父类 → 寄生组合 `Object.create(Parent.prototype)`；`class extends` 再加 `B.__proto__ === A` 静态链。

### 2.2.8 追问表

| 追问 | 答题要点 |
|---|---|
| `prototype` 和 `__proto__` 区别？ | 前者是**函数属性**（给实例用），后者是 `Object.prototype` 上的**访问器**（读自己的原型） |
| `__proto__` 是标准吗？ | 不是核心标准，是 Annex B 的兼容特性；标准写法是 `Object.getPrototypeOf` |
| 原型链的终点？ | `Object.prototype.__proto__ === null` |
| `Function.__proto__` 是什么？ | `Function.prototype`（自环） |
| `instanceof` 原理？ | 沿原型链找 `Ctor.prototype` |
| `in` 和 `hasOwnProperty` 区别？ | `in` 含原型链，`hasOwnProperty` 只查自身 |
| `Object.hasOwn` 好在哪？ | ES2022，`Object.create(null)` 的对象也能安全用 |
| 为什么不要在原型上放数组/对象？ | 所有实例共享同一引用，互相污染 |
| 改原型性能为什么差？ | 破坏 V8 的内联缓存 / 隐藏类 |
| 寄生组合继承的核心？ | `Child.prototype = Object.create(Parent.prototype)`，避免二次调用父类 |
| `class extends` 编译后是什么？ | 寄生组合继承 + `B.__proto__ = A` 静态链 |
| 怎么判断属性是自身的？ | `Object.hasOwn(obj, key)` / `Object.prototype.hasOwnProperty.call` |

---

## 2.3 class 与普通函数的区别

### 2.3.0 一句话结论

> `class` 是**原型继承的语法糖**，但**不是简单的语法糖**——它在语义上更严格：**必须 `new`**、**有 TDZ**、**方法不可枚举**、**内部默认严格模式**、**内部有 `[[ConstructorKind]]` 标记**（决定 `this` 由谁创建）。所以 `typeof class === 'function'`，但 `class` 和 `function` 在行为上有 6 个可观测的差异。

### 2.3.1 六个可观测差异

```js
// ① 必须用 new
class A {}
A();            // ❌ TypeError: Class constructor A cannot be invoked without 'new'

function B() {}
B();            // ✅ 正常执行

// ② TDZ：class 声明提升，但声明前不可用
new C();        // ❌ ReferenceError: Cannot access 'C' before initialization
class C {}

new D();        // ✅ 正常（函数声明完全提升）
function D() {}

// ③ 方法不可枚举
class E { m() {} }
console.log(Object.keys(E.prototype));                 // []      ← 不可枚举
function F() {}
F.prototype.m = function () {};
console.log(Object.keys(F.prototype));                 // ['m']   ← 可枚举

// ④ 内部默认严格模式
class G {
  m() { return this; }
}
const g = new G();
const m = g.m;
console.log(m());   // undefined（严格模式）而不是全局对象

// ⑤ class 的 name 属性不可写
class H {}
H.name = 'X';           // 严格模式抛 TypeError；非严格模式静默失败
console.log(H.name);    // 'H'

// ⑥ 内部可以访问 super / new.target
```

### 2.3.2 `[[ConstructorKind]]` 与 `super()`

派生类与基类的差别来自 `[[ConstructorKind]]`：

| 类型 | `[[ConstructorKind]]` | `this` 何时创建 |
|---|---|---|
| 普通函数 / 基类 | `"base"` | 进入函数时，由 `[[Construct]]` 创建 |
| `class extends` 的派生类 | `"derived"` | **由 `super()` 创建**，`super()` 之前访问 `this` 会报错 |

```js
class Base {
  constructor() { this.x = 1; }
}

class Derived extends Base {
  constructor() {
    // console.log(this);   // ❌ ReferenceError: Must call super constructor
    super();                // ← 这一步才创建 this
    console.log(this);      // ✅ Derived { x: 1 }
  }
}
```

**为什么派生类必须先 `super()`？** 因为派生类的 `this` 不是自己创建的，而是 `super()` 内部通过 `Reflect.construct(Base, args, newTarget=Derived)` 创建的——这保证了 `this` 的原型是 `Derived.prototype` 而不是 `Base.prototype`。

```js
class Base {}
class Derived extends Base {}
console.log(new Derived() instanceof Derived);   // true  ← 靠 newTarget 传下去
```

### 2.3.3 class 的常见坑

```js
// 坑 1：方法被单独调用时 this 为 undefined（class body 是严格模式）
class Counter {
  count = 0;
  inc() { this.count++; }
}
const c = new Counter();
const fn = c.inc;
fn();   // ❌ TypeError: Cannot read properties of undefined (reading 'count')

// 坑 2：class 字段 vs 原型方法
class A {
  method() {}          // → A.prototype.method（所有实例共享）
  handler = () => {};  // → 每个实例一个箭头函数（不能共享，但 this 自动绑定）
}
// 字段用 [[Define]] 语义（TS 的 useDefineForClassFields: true）：原型上有同名 setter 也不触发

// 坑 3：静态方法里的 this 是类本身
class B {
  static create() { return new this(); }   // this 指向 B（或子类）
}
class C extends B {}
C.create();   // C 的实例 ← 多态

// 坑 4：class 表达式也有 name
const X = class Named {};
console.log(X.name);   // 'Named'

// 坑 5：不能和同作用域的 let/const/var 重名
class Y {}
// var Y = 1;    // ❌ SyntaxError
```

### 2.3.4 `class` 的私有字段（ES2022）

```js
class Person {
  #name;                       // 私有字段声明
  static #count = 0;           // 私有静态字段

  constructor(name) {
    this.#name = name;
    Person.#count++;
  }

  get name() { return this.#name; }

  #secret() { return 'private'; }   // 私有方法

  static {
    // 静态初始化块，可以写多行逻辑
    console.log('class initialized');
  }
}

const p = new Person('Tom');
console.log(p.name);      // 'Tom'

// 类外访问是解析期错误，整段代码不会执行
// console.log(p.#name);  // ❌ SyntaxError: Private field '#name' must be declared in an enclosing class
```

> **注意**：`#` 私有字段是**真正的私有**（语言层面强制），而 `_name` 只是**约定**。私有字段无法被 `Object.keys`、`JSON.stringify`、`for...in` 访问，也不参与代理的 `get`（Proxy 无法拦截私有字段访问）。

### 2.3.5 答题要点

- `class` 是原型继承的语法糖，`typeof` 仍是 `'function'`，但语义更严格。
- 六个差异：必须 `new`、TDZ、方法不可枚举、class body 默认严格模式、`name` 不可写、可用 `super`/`new.target`。
- 派生类 `[[ConstructorKind]]` 为 `"derived"`，`this` 由 `super()` 创建；`super()` 前访问 `this` 抛 `ReferenceError`。
- 实例方法在 `prototype` 上；字段 `handler = () => {}` 是实例自有属性（`[[Define]]` 语义）。
- `class extends` 有实例链 `B.prototype.__proto__ === A.prototype` 与静态链 `B.__proto__ === A`，后者让 `static` 方法可继承。

### 2.3.6 追问表

| 追问 | 答题要点 |
|---|---|
| `class` 是语法糖吗？ | 是原型继承的糖，但语义更严格，不完全等价 |
| `typeof class` 是什么？ | `'function'` |
| class 有变量提升吗？ | 有，但 TDZ，声明前访问报错 |
| class 方法可枚举吗？ | 不可枚举（`Object.keys` 拿不到） |
| class 内部是严格模式吗？ | 是，整个 class body |
| 为什么派生类必须先 `super()`？ | `this` 由 `super()` 通过 `Reflect.construct` 创建 |
| `super` 在方法里指向什么？ | `super.method()` 走 `[[HomeObject]]` 的原型，`this` 仍是当前实例 |
| class 能实现私有属性吗？ | ES2022 的 `#field`，是语言级私有 |
| `#field` 和 `_field` 区别？ | 前者强制私有，后者只是约定 |
| class 字段是原型属性吗？ | 不是，是实例属性（`handler = () => {}`） |
| class 能多重继承吗？ | 不能，用 mixin 组合 |
| class 能 new 一个箭头函数吗？ | 不能 |

---

## 2.4 Object.assign 与深浅拷贝

### 2.4.0 一句话结论

> `Object.assign` 是**浅拷贝**。它只把源对象**自身可枚举属性**（字符串键 + `Symbol` 键）**赋值**到目标对象上，嵌套对象仍然是同一个引用。而且它**不是"创建新对象"**——它修改并返回第一个参数。

### 2.4.1 五个行为细节

```js
// ① 只拷第一层，嵌套对象共享引用
const src = { a: 1, nested: { b: 2 } };
const copy = Object.assign({}, src);
copy.a = 100;
console.log(src.a);            // 1      ← 第一层独立
copy.nested.b = 200;
console.log(src.nested.b);     // 200    ← 第二层共享！

// ② 返回的是 target，不是新对象
const target = { x: 1 };
const result = Object.assign(target, { y: 2 });
console.log(result === target);   // true  ← 是同一个对象

// ③ 会触发 source 的 getter，也会触发 target 的 setter
const src3 = {
  get computed() { console.log('getter 被调用'); return 1; },
};
Object.assign({}, src3);   // 打印 'getter 被调用'

// ④ 访问器属性会变成数据属性
const src4 = { get v() { return 1; } };
const c4 = Object.assign({}, src4);
console.log(Object.getOwnPropertyDescriptor(c4, 'v'));
// { value: 1, writable: true, enumerable: true, configurable: true }
// ← 变成普通数据属性了，getter 丢失

// ⑤ 不拷贝原型、不拷贝不可枚举属性
const proto = { inherited: 1 };
const src5 = Object.create(proto, {
  hidden: { value: 2, enumerable: false },
});
src5.visible = 3;
console.log(Object.assign({}, src5));   // { visible: 3 }
// 既没有 inherited（原型上的），也没有 hidden（不可枚举）
```

**另外三点**：

```js
// 字符串会被拆成索引属性
console.log(Object.assign({}, 'ab'));   // { '0': 'a', '1': 'b' }

// null / undefined 作为源会被忽略
console.log(Object.assign({}, null, undefined));   // {}

// 但作为 target 会报错
Object.assign(null, {});   // ❌ TypeError: Cannot convert undefined or null to object
```

### 2.4.2 浅拷贝的所有方式（对比）

| 方式 | 能拷 `Symbol` | 能拷不可枚举 | 对数组 | 备注 |
|---|---|---|---|---|
| `Object.assign({}, obj)` | ✅ | ❌ | ✅（目标为 `[]` 才是数组） | 触发 getter |
| `{ ...obj }` | ✅ | ❌ | ✅ | 同上，语法更简洁 |
| `arr.slice()` | — | — | ✅ | 只适合数组 |
| `arr.concat()` | — | — | ✅ | 同上 |
| `Array.from(arr)` | — | — | ✅ | 可迭代或类数组 |
| `Object.create(Object.getPrototypeOf(o), Object.getOwnPropertyDescriptors(o))` | ✅ | ✅ | — | **保留原型和属性描述符**，最完整的浅拷贝 |

```js
// 保留原型 + 不可枚举 + 访问器
function shallowClone(obj) {
  return Object.create(
    Object.getPrototypeOf(obj),
    Object.getOwnPropertyDescriptors(obj)
  );
}
```

### 2.4.3 深拷贝的三种方案

#### 方案 1：`structuredClone`

```js
const deep = structuredClone(obj);
```

**支持**：

- ✅ 循环引用
- ✅ `Date` / `RegExp` / `Map` / `Set` / `ArrayBuffer` / `TypedArray` / `Error`
- ✅ `Blob` / `File` / `ImageData`（部分环境）

**不支持**：

- ❌ 函数、DOM 节点：抛 `DataCloneError`
- ❌ 原型链：类实例变成普通对象，**丢失原型**
- ❌ getter/setter：求值成数据属性
- ❌ 非可枚举属性：直接丢弃；可枚举属性统一变成可写、可枚举、可配置
- ❌ `Symbol` 键：静默丢弃，不报错

```js
class Foo { bar() {} }
const cloned = structuredClone(new Foo());
console.log(cloned instanceof Foo);   // false ← 原型丢了
```

#### 方案 2：`JSON.parse(JSON.stringify(obj))`

**会丢失或变形的值**：

| 原值 | 拷贝后 |
|---|---|
| `undefined` | **属性直接消失** |
| 函数 | **属性直接消失** |
| `Symbol` | **属性直接消失** |
| `NaN` / `Infinity` | `null` |
| `Date` | **ISO 字符串**（不是 `Date` 对象） |
| `RegExp` | `{}`（空对象） |
| `Map` / `Set` | `{}` |
| `BigInt` | **抛 `TypeError`** |
| 循环引用 | **抛 `TypeError`** |
| 类实例 | 变成普通对象（丢原型） |
| 数组里的 `undefined` | `null` |

```js
const o = {
  u: undefined,
  f: () => {},
  n: NaN,
  d: new Date(0),
  a: [undefined],
};
console.log(JSON.parse(JSON.stringify(o)));
// { n: null, d: '1970-01-01T00:00:00.000Z', a: [ null ] }
// u 和 f 消失了
```

> **什么时候可以用 JSON 方案？** 只在"**纯数据、无 `Date`、无循环引用**"的场景。生产代码里建议直接用 `structuredClone`。

#### 方案 3：手写递归

```js
function deepClone(value, map = new WeakMap()) {
  // ① 原始类型 / 函数直接返回（函数一般不拷贝，共享引用）
  if (value === null || typeof value !== 'object') return value;

  // ② 循环引用：已拷贝过就直接返回
  if (map.has(value)) return map.get(value);

  // ③ 按类型分支
  let result;

  // Date
  if (value instanceof Date) return new Date(value);
  // RegExp
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);
  // Map
  if (value instanceof Map) {
    result = new Map();
    map.set(value, result);
    value.forEach((v, k) => result.set(deepClone(k, map), deepClone(v, map)));
    return result;
  }
  // Set
  if (value instanceof Set) {
    result = new Set();
    map.set(value, result);
    value.forEach((v) => result.add(deepClone(v, map)));
    return result;
  }
  // ArrayBuffer / TypedArray / DataView
  if (value instanceof ArrayBuffer) return value.slice();
  if (value instanceof DataView) {
    return new DataView(value.buffer.slice(0), value.byteOffset, value.byteLength);
  }
  if (ArrayBuffer.isView(value)) return value.slice();

  // ④ 普通对象 / 数组：保留原型
  result = Array.isArray(value)
    ? []
    : Object.create(Object.getPrototypeOf(value));
  map.set(value, result);

  // ⑤ 拷贝自身属性（含 Symbol，含不可枚举）
  for (const key of Reflect.ownKeys(value)) {
    const desc = Object.getOwnPropertyDescriptor(value, key);
    if (!desc) continue;
    if ('value' in desc) {
      // 数据属性：递归拷贝值
      Object.defineProperty(result, key, {
        ...desc,
        value: deepClone(desc.value, map),
      });
    } else {
      // 访问器属性：原样保留 getter/setter
      Object.defineProperty(result, key, desc);
    }
  }

  return result;
}
```

**测试**：

```js
const a = {
  n: 1,
  d: new Date('2026-01-01'),
  r: /abc/gi,
  m: new Map([['k', { v: 1 }]]),
  s: new Set([1, 2]),
  arr: [1, [2, 3]],
  [Symbol('sym')]: 'symbol key',
};
a.self = a;   // 循环引用

const b = deepClone(a);
console.log(b.self === b);        // true   ← 循环引用正确
console.log(b.d instanceof Date);  // true
console.log(b.arr[1] !== a.arr[1]);// true   ← 深层也复制了
```

**五个关键点**：

1. **循环引用**：必须用 `WeakMap` 记录"原对象 → 副本"的映射（用 `Map` 也行，但会阻止 GC）
2. **`Date` / `RegExp`**：不能直接 `{}` 递归，会变成空对象
3. **`Map` / `Set`**：要单独处理，`forEach` 或遍历
4. **`Symbol` 键**：`Object.keys` 拿不到，要用 `Reflect.ownKeys`
5. **原型**：`Object.create(Object.getPrototypeOf(value))` 而不是 `{}`，否则类实例的方法会丢

### 2.4.4 三种方案对比

| 维度 | `structuredClone` | JSON | 手写递归 |
|---|---|---|---|
| 循环引用 | ✅ | ❌ 抛错 | ✅（需 `WeakMap`） |
| `Date`/`RegExp`/`Map`/`Set` | ✅ | ❌ | ✅（需手动处理） |
| 函数 | ❌ 抛错 | ❌ 丢弃 | ✅ 可共享 |
| DOM 节点 | ❌ 抛错 | ❌ 序列化成 `{}` | 需手动处理 |
| 原型链 | ❌ 丢 | ❌ 丢 | ✅ 保留 |
| `Symbol` 键 | ❌ 丢 | ❌ 丢 | ✅ |
| 实现 | 原生 | 两次序列化 | 逐属性递归 |
| 代码量 | 1 行 | 1 行 | 50+ 行 |

**选型建议**：

```
纯数据、无特殊类型 → structuredClone
需要保留原型 / 函数 / Symbol → 手写递归
临时调试、确定是纯 JSON → JSON 方案
```

### 2.4.5 答题要点

- `Object.assign` 是浅拷贝：只拷自身可枚举属性（含 `Symbol` 键），嵌套引用共享；修改并返回 `target`。
- 它会触发源 getter 与目标 setter，访问器属性在目标上变成数据属性；不拷原型、不拷不可枚举属性。
- 深拷贝首选 `structuredClone`：支持循环引用、`Date`/`RegExp`/`Map`/`Set`；函数和 DOM 抛 `DataCloneError`，原型、`Symbol` 键、非可枚举属性会丢。
- `JSON.parse(JSON.stringify())` 只适合纯 JSON：`undefined`/函数/`Symbol` 丢，`Date` 变字符串，`NaN` 变 `null`，`BigInt` 和循环引用抛错。
- 手写深拷贝：`WeakMap` 处理循环、`Date`/`RegExp`/`Map`/`Set` 单独处理、`Reflect.ownKeys` 覆盖 `Symbol` 与不可枚举、`Object.create(Object.getPrototypeOf(v))` 保留原型。

### 2.4.6 追问表

| 追问 | 答题要点 |
|---|---|
| `Object.assign` 深还是浅？ | 浅，只拷第一层 |
| 它会改第一个参数吗？ | 会，并且返回它 |
| 拷贝 `Symbol` 键吗？ | 会（`Object.assign` 和扩展运算符都拷） |
| 拷贝不可枚举属性吗？ | 不会 |
| 拷贝原型上的属性吗？ | 不会 |
| 会触发 getter 吗？ | 会（取值赋值，等价于 `target[k] = source[k]`） |
| 访问器属性拷过去还是访问器吗？ | 不是，变成数据属性 |
| `{...obj}` 和 `Object.assign` 区别？ | 基本等价；`{...obj}` 总是创建新对象，且不触发 target 的 setter |
| `structuredClone` 支持函数吗？ | 不支持，抛 `DataCloneError` |
| `structuredClone` 保留原型吗？ | 不保留，类实例变普通对象 |
| JSON 方案会丢什么？ | `undefined`/函数/`Symbol`/原型；`Date`→字符串；`NaN`→`null` |
| 为什么深拷贝要用 `WeakMap`？ | 解决循环引用，且不阻止 GC |
| `Object.create(null)` 能做深拷贝目标吗？ | 可以；目标无原型，克隆结果也会丢掉原型 |
| 数组的浅拷贝有哪些？ | `slice`、`concat`、`[...arr]`、`Array.from` |

---

## 2.5 本册答题模板汇总

### 2.5.1 一句话版

```
⑨ new          → 创建 + 链原型 + 绑 this 执行 + 返回对象则用它
⑫ 原型链        → [[Prototype]] 逐级向上到 null；方法共享；instanceof 的依据
⑤ class        → 原型继承的糖，但必须 new、TDZ、方法不可枚举、严格模式
⑭ Object.assign → 浅拷贝；只拷自身可枚举；修改并返回 target
```

### 2.5.2 把四题串起来

`new` 建立实例与 `prototype` 的链接，原型链决定属性查找路径，`class` 在此之上增加静态链和更严格的语义，`Object.assign`/深拷贝处理对象引用的复制边界。

---

## 2.6 速记卡与连环追问

### 2.6.1 速记卡

```
【new 四步】创建 → 链原型(Object.create(Ctor.prototype)) → 绑 this 执行 → 返回
            返回对象则用它；原始值忽略（含 null）
            手写完整版：Reflect.construct(Ctor, args)

【原型三兄弟】
  [[Prototype]]  内部槽，只能 Object.getPrototypeOf 读
  __proto__      Object.prototype 上的访问器（Annex B）
  prototype      普通函数/class/generator 有；箭头/方法简写/async 函数/bind 结果没有

【原型链四条硬结论】
  f.__proto__ === Foo.prototype
  Foo.__proto__ === Function.prototype
  Function.__proto__ === Function.prototype   ← 唯一自环
  Object.prototype.__proto__ === null         ← 终点

【继承演进】
  原型链继承 → 引用共享
  构造函数继承 → 丢原型方法
  组合继承 → 父类调两次
  寄生组合 → Object.create(Parent.prototype)
  class extends → 寄生组合 + B.__proto__ = A（静态链）

【class 六差异】必须 new / TDZ / 方法不可枚举 / 严格模式 / name 不可写 / super+new.target
              派生类 this 由 super() 创建（[[ConstructorKind]] = derived）
              字段是实例自有属性（[[Define]]，不触发原型 setter）

【浅拷贝】Object.assign、{...}、slice、concat、Array.from
          都不拷原型/不可枚举；assign/{...} 拷 Symbol；assign 触发 getter，访问器变数据属性
【深拷贝】structuredClone（支持循环/Map/Set/Date；函数/DOM 抛错；原型/Symbol 键/非可枚举丢）
          JSON（丢 undefined/函数/Symbol/原型，Date→字符串，循环报错）
          手写（WeakMap 循环 + Date/RegExp/Map/Set + Reflect.ownKeys + 保留原型）
```

### 2.6.2 连环追问

| # | 追问 | 关键答点 |
|---|---|---|
| 1 | `new` 的四步？ | 创建、链原型、绑 `this` 执行、处理返回值 |
| 2 | 构造函数返回 `null` 会怎样？ | 忽略，返回新对象 |
| 3 | 手写 `myNew` 的局限？ | 不能处理 `class`/派生类；也不校验箭头函数、方法简写能否构造 |
| 4 | `prototype` 和 `__proto__` 区别？ | 函数属性 vs `Object.prototype` 上的访问器 |
| 5 | 原型链终点？ | `Object.prototype.__proto__ === null` |
| 6 | `instanceof` 原理？ | 沿原型链找 `Ctor.prototype` |
| 7 | 寄生组合继承怎么写？ | `Child.prototype = Object.create(Parent.prototype)` |
| 8 | `class extends` 的两条链？ | `B.prototype.__proto__ === A.prototype`、`B.__proto__ === A` |
| 9 | 派生类为什么要 `super()`？ | `this` 由 `super()` 创建 |
| 10 | `#field` 和 `_field` 区别？ | 语言级私有 vs 命名约定 |
| 11 | `Object.assign` 深还是浅？ | 浅 |
| 12 | `structuredClone` 不支持什么？ | 函数/DOM 抛错；原型、`Symbol` 键、非可枚举丢 |
| 13 | JSON 深拷贝会丢什么？ | `undefined`/函数/`Symbol`/原型；`Date`→字符串 |
| 14 | 深拷贝怎么处理循环引用？ | `WeakMap` 记录原对象→副本 |
