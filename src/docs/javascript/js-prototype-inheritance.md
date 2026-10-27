# JS · 03 原型链与继承

> 覆盖：原型与原型链、`new` 四步、五种继承方式
> 主线：每个继承方案修上一个方案的缺陷

---

## 目录

- [3.1 一句话结论](#31-一句话结论)
- [3.2 三个最容易混的概念](#32-三个最容易混的概念)
- [3.3 原型链查找](#33-原型链查找)
- [3.4 `new` 做了什么](#34-new-做了什么)
- [3.5 五种继承方式的演进](#35-五种继承方式的演进)
- [3.6 `class` 编译后长什么样（能答出来很加分）](#36-class-编译后长什么样能答出来很加分)
- [3.7 六个必须知道的原型细节](#37-六个必须知道的原型细节)
- [3.8 常见坑](#38-常见坑)
- [3.9 答题模板](#39-答题模板)
- [3.10 速记卡](#310-速记卡)

---

## 3.1 一句话结论

**每个对象都有一个内部槽 `[[Prototype]]` 指向另一个对象（或 `null`）**，访问属性时如果自己没有，就沿着这条链往上找——这就是原型链。
**`new F()` 做四件事**：创建新对象 → 把它的 `[[Prototype]]` 指向 `F.prototype` → 用新对象当 `this` 执行 `F` → 返回（如果 `F` 返回对象就用它，否则用新对象）。
**继承的本质是把「子类实例的原型链」接到「父类原型」上**，五种方案的区别只在「怎么接」和「有没有副作用」。

---

## 3.2 三个最容易混的概念

### 3.2.1 `prototype` / `__proto__` / `[[Prototype]]`

| 名字 | 是什么 | 谁有 | 规范地位 |
|---|---|---|---|
| **`[[Prototype]]`** | **内部槽**，指向原型对象 | **所有对象** | 规范定义的「真身」 |
| **`__proto__`** | 访问 `[[Prototype]]` 的**访问器属性** | 继承自 `Object.prototype` | **历史遗留（Annex B）**，不推荐直接用 |
| **`prototype`** | 一个**普通属性**，值是对象 | **普通函数、class、generator**（箭头函数、方法、async、bind 后没有） | 标准属性，但语义特殊 |

**关键区分**：

```
函数 F
├── F.prototype        ← 一个普通对象，将来当「实例的原型」
│   └── constructor    ← 指回 F
└── [[Prototype]]      ← F 自己的原型（即 Function.prototype）

实例 f = new F()
└── [[Prototype]]      ← 指向 F.prototype
```

**实测验证**：

```js
function Foo() {}
const f = new Foo();

f.__proto__ === Foo.prototype              // true  ← 实例的原型是函数的 prototype
Object.getPrototypeOf(f) === Foo.prototype // true  ← 推荐用这个
Foo.prototype.constructor === Foo          // true  ← 反向指回
Foo.__proto__ === Function.prototype       // true  ← 函数自己的原型是 Function.prototype
Foo.prototype.__proto__ === Object.prototype  // true  ← 原型对象的原型是 Object.prototype
```

### 3.2.2 用 `Object.getPrototypeOf` / `Object.setPrototypeOf` 代替 `__proto__`

```js
// ❌ 不推荐（Annex B，性能差，且可被覆盖/删除）
obj.__proto__

// ✅ 推荐
Object.getPrototypeOf(obj)
Object.setPrototypeOf(obj, proto)     // 也慢，能不用就不用
Object.create(proto)                  // 创建时指定，不改已有对象
```

**为什么 `__proto__` 不推荐**：
- 它是 `Object.prototype` 上的一个**访问器属性**，通过原型链继承来的
- 如果对象是 `Object.create(null)` 创建的，就没有 `__proto__`
- 性能上，`Object.setPrototypeOf` 会让 V8 的隐藏类失效（对象被「去优化」）

### 3.2.3 `constructor` 是什么

**`F.prototype.constructor === F` 只是一个「约定」，不是语言保证。**

```js
function Foo() {}
Foo.prototype.constructor === Foo       // true（引擎自动设置的）

// 但它可以被改掉
Foo.prototype = {};
Foo.prototype.constructor === Foo       // false（变成 Object 了）
```

**这就是「为什么继承时要手动写 `Sub.prototype.constructor = Sub`」的原因**——因为 `Sub.prototype = ...` 覆盖了原来的对象，`constructor` 丢了。

**`constructor` 的用途**：从实例反查构造函数。类型判断不要依赖它——改过 `prototype` 就会失真，`instanceof` 或 `Object.prototype.toString` 更可靠。

---

## 3.3 原型链查找

### 3.3.1 查找过程

```js
function A() {}
A.prototype.fromA = 'A';

function B() {}
B.prototype = Object.create(A.prototype);
B.prototype.constructor = B;
B.prototype.fromB = 'B';

const b = new B();

b.fromB;        // 'B'      B.prototype（第 1 跳）
b.fromA;        // 'A'      A.prototype（第 2 跳）
b.toString;     // function Object.prototype（第 3 跳）
```

**实测**：从 `b` 到 `null` 共 **4 次跳转**

```
b
  → B.prototype
    → A.prototype
      → Object.prototype
        → null          （四个对象：b、B.prototype、A.prototype、Object.prototype）
```

### 3.3.2 读 vs 写：一个关键差异

```js
const parent = { shared: 'p' };
const child = Object.create(parent);

// 读：沿原型链找
child.shared;                        // 'p'   ✅

// 写：在「自己」上创建属性，不动原型
child.shared = 'set-on-child';
parent.shared;                       // 'p'        ← 原型没变
child.shared;                        // 'set-on-child'
Object.hasOwn(child, 'shared');      // true       ← 现在自己有这个属性了
```

**这就是「原型链上的属性是共享的，但赋值会遮蔽」**。

**⚠️ 但如果原型上的属性是「访问器（getter/setter）」，赋值会触发 setter**：

```js
const parent = {
  _v: 1,
  get v() { return this._v; },
  set v(x) { console.log('setter'); this._v = x; },
};
const child = Object.create(parent);
child.v = 2;         // 打印 'setter'  ← 走的是原型的 setter，但仍在自己身上创建 _v
```

**这个差异会影响 `class` 字段**：`useDefineForClassFields: true` 时字段用 `defineProperty` 创建自有属性，不触发原型 setter；`false` 时编译成赋值，会触发（见 TS 册）。

### 3.3.3 `in` vs `hasOwnProperty`

```js
const parent = { a: 1 };
const child = Object.create(parent);
child.b = 2;

'a' in child;                            // true   ← in 会查原型链
'b' in child;                            // true
Object.hasOwn(child, 'a');               // false  ← 只查自己（ES2022，推荐）
Object.hasOwn(child, 'b');               // true
child.hasOwnProperty('a');               // false  ← 老写法，可能被覆盖
```

**推荐 `Object.hasOwn`（ES2022）**——因为 `obj.hasOwnProperty` 可能被对象自己覆盖，或者对象是 `Object.create(null)` 时根本不存在。

---

## 3.4 `new` 做了什么

### 3.4.1 四步（必须背）

```js
new Foo(args)
```

| 步 | 动作 |
|---|---|
| **①** | 创建一个**新对象** `obj`（空对象） |
| **②** | 把 `obj.[[Prototype]]` 设为 **`Foo.prototype`** |
| **③** | 用 `obj` 作为 `this`，执行 `Foo` 的函数体（传入 `args`） |
| **④** | 如果 `Foo` 返回的是**对象**，就返回它；否则返回 `obj` |

**第 ④ 步是关键**：`return` 原始值会被忽略。

**实测验证**：

```js
function ReturnsObj() { this.a = 1; return { b: 2 }; }
new ReturnsObj();        // { b: 2 }        ← 返回对象，覆盖了新对象
                         // 注意：{ a: 1 } 那个新对象被丢弃了

function ReturnsPrim() { this.a = 1; return 42; }
new ReturnsPrim();       // { a: 1 }        ← 返回原始值，被忽略

function ReturnsNull() { this.a = 1; return null; }
new ReturnsNull();       // { a: 1 }        ← null 也算原始值，被忽略
```

### 3.4.2 手写 `new`（完整版见 10 册）

```js
function myNew(Ctor, ...args) {
  // ① 创建对象，② 设置原型
  const obj = Object.create(Ctor.prototype);
  // ③ 执行构造函数
  const result = Ctor.apply(obj, args);
  // ④ 返回值判断
  return result !== null && (typeof result === 'object' || typeof result === 'function')
    ? result
    : obj;
}
```

**为什么第 ④ 步要判 `function`**：因为 `new` 的规范里，返回值只要是「对象」，就包括函数。

```js
function F() { return function () {}; }
new F();      // 返回那个函数（typeof 'function'）
```

### 3.4.3 `new` 的三个坑

```js
// ① 构造函数里 return 对象会「丢掉 this」
function A() { this.x = 1; return { y: 2 }; }
new A();        // { y: 2 }  ← this.x 白设了

// ② 构造函数不用 new 也能调用（但 this 就错了）
function B() { this.x = 1; }
B();            // 非严格：this = globalThis，污染全局；严格模式：this = undefined，抛 TypeError
const b = new B();   // ✅ 正确

// ③ 箭头函数和 class 方法不能 new
const arrow = () => {};
new arrow();    // TypeError: arrow is not a constructor
```

**「构造函数首字母大写 + 必须用 `new`」的约定就是为了避免第 ② 条这种误用。**

**更稳的做法**（防止忘写 `new`）：

```js
function Safe(name) {
  if (!(this instanceof Safe)) return new Safe(name);   // 自动补 new
  this.name = name;
}
Safe('a');        // 自动 new，不污染全局
```

---

## 3.5 五种继承方式的演进

> 主线：每个方案都在修上一个方案的缺陷。

### 3.5.1 ① 原型链继承

```js
function Parent() {
  this.name = 'parent';
  this.list = [1, 2, 3];        // ← 引用类型
}
Parent.prototype.say = function () { return 'say'; };

function Child() {}
Child.prototype = new Parent();  // 子类原型 = 父类实例

const c1 = new Child();
const c2 = new Child();
c1.list.push(4);
console.log(c2.list);            // [1, 2, 3, 4]  ← ⚠️ 被污染了！
```

**问题**：

| 问题 | 说明 |
|---|---|
| **① 引用属性被所有实例共享** | 因为 `list` 在 `Child.prototype` 上（父类实例上），所有子类实例共享同一个数组 |
| **② 创建子类时无法给父类传参** | `new Parent()` 是写死的，不能传不同参数 |
| **③ 无法实现多继承** | 原型链只有一条 |

**实测**：`c2.list` 初始长度 3，被 `c1` push 后变成 4。

### 3.5.2 ② 构造函数继承（借用构造函数）

```js
function Parent(name) {
  this.name = name;
  this.list = [1, 2, 3];
}
Parent.prototype.say = function () { return 'say'; };

function Child(name) {
  Parent.call(this, name);       // ← 在子类里「借用」父类构造函数
}

const c1 = new Child('a');
const c2 = new Child('b');
c1.list.push(4);
console.log(c2.list);            // [1, 2, 3]  ✅ 不共享了
console.log(c1.name, c2.name);   // 'a' 'b'    ✅ 能传参了
console.log(c1.say);             // undefined  ← ⚠️ 拿不到原型方法！
```

**解决了**：引用共享、传参。
**新问题**：

| 问题 | 说明 |
|---|---|
| **拿不到父类原型上的方法** | 只「借用」了构造函数体，没接原型链；`instanceof Parent` 也是 `false` |

### 3.5.3 ③ 组合继承（原型链 + 构造函数）

```js
function Parent(name) {
  this.name = name;
  this.list = [1, 2, 3];
}
Parent.prototype.say = function () { return 'say'; };

function Child(name) {
  Parent.call(this, name);        // 每个实例：初始化实例属性
}
Child.prototype = new Parent();   // 另一次父构造：接原型链（只执行一次）
Child.prototype.constructor = Child;

const c1 = new Child('a');
c1.list.push(4);
console.log(new Child('b').list);   // [1,2,3]  ✅ 不共享
console.log(c1.say());              // 'say'    ✅ 有原型方法
console.log(c1 instanceof Parent);  // true     ✅
```

**解决了**：前两个方案的问题。
**新问题**：

| 问题 | 说明 |
|---|---|
| **定义子类时额外执行一次父构造** | `new Parent()` 只为接原型链，每个实例仍要 `Parent.call`；这次额外调用的副作用（计数器、事件监听）会多执行一次 |
| **子类原型上多了无用的实例属性** | `Child.prototype` 上有 `name`、`list`（被实例属性遮蔽了，白占内存） |

### 3.5.4 ④ 寄生组合继承（最优方案）

```js
function Parent(name) {
  this.name = name;
  this.list = [1, 2, 3];
}
Parent.prototype.say = function () { return 'say'; };

function Child(name) {
  Parent.call(this, name);                    // 每个实例调一次父构造
}
// 关键：用 Object.create 接原型链，不调父构造函数
Child.prototype = Object.create(Parent.prototype);
Child.prototype.constructor = Child;

const c1 = new Child('a');
c1.list.push(4);
console.log(new Child('b').list);   // [1,2,3]  ✅
console.log(c1.say());              // 'say'    ✅
console.log(c1 instanceof Parent);  // true     ✅
console.log(Child.prototype.name);  // undefined ✅ 原型上干净了
```

**`Object.create(Parent.prototype)` 的作用**：创建一个空对象，`[[Prototype]]` 指向 `Parent.prototype`——**不执行 `Parent` 的构造函数**。

**这就是 ES5 时代的最优解**，也是 `Babel` 编译 `class` 时生成的代码。

### 3.5.5 ⑤ `class extends`（ES6）

```js
class Parent {
  constructor(name) {
    this.name = name;
    this.list = [1, 2, 3];
  }
  say() { return 'say'; }
  static staticSay() { return 'static'; }
}

class Child extends Parent {
  constructor(name, age) {
    super(name);          // 派生类构造：先用 super 初始化 this
    this.age = age;
  }
  say() {
    return super.say() + '!';
  }
}
```

**`class` 不是纯语法糖**，有六个本质区别：

| 差异 | ES5 函数 | `class` |
|---|---|---|
| **必须 `new` 调用** | 不用 `new` 也能调（非严格污染全局，严格模式抛 TypeError） | **不 `new` 直接报 TypeError** |
| **严格模式** | 看上下文 | **内部强制严格** |
| **方法不可枚举** | 挂在 prototype 上，可枚举 | **`enumerable: false`** |
| **提升行为** | 函数声明整体提升 | **class 声明也提升，但处于 TDZ，初始化前访问抛 ReferenceError** |
| **`super`** | 没有 | ✅ 有（还支持 `super.xxx()` 调父类方法） |
| **静态继承** | 需手动 `Object.setPrototypeOf(Sub, Parent)` | ✅ **自动**（等价于 `Object.setPrototypeOf(Sub, Parent)`） |

**`class extends` 的「双向原型」**（实测）：

```js
class Base { static s() { return 's'; } }
class Sub extends Base {}

Object.getPrototypeOf(Sub) === Base;                        // true  ← 静态继承
Object.getPrototypeOf(Sub.prototype) === Base.prototype;    // true  ← 实例继承
Sub.s();                                                    // 's'   ← 能访问父类静态方法
```

### 3.5.6 五种方案速查表

| 方案 | 引用共享 | 能传参 | 有原型方法 | 父构造调用次数 | 评价 |
|---|---|---|---|---|---|
| ① 原型链 | ❌ **共享** | ❌ | ✅ | 1（建原型） | 最原始，引用共享且不能传参 |
| ② 构造函数 | ✅ | ✅ | ❌ **没有** | 1/实例 | 只借实现，断链 |
| ③ 组合 | ✅ | ✅ | ✅ | **2（原型 1 + 实例 1）** | 可用，但多一次父构造 |
| ④ **寄生组合** | ✅ | ✅ | ✅ | **1/实例** | **ES5 最优** |
| ⑤ `class` | ✅ | ✅ | ✅ | 1/实例 | **现代标准** |

---

## 3.6 `class` 编译后长什么样（能答出来很加分）

```js
class Child extends Parent {
  constructor(name) {
    super(name);
    this.age = 1;
  }
}
```

**Babel / TS 编译到 ES5 后（简化）**：

```js
function Child(name) {
  var _this;
  // super(name) 的等价物
  _this = _Parent.call(this, name) || this;
  _this.age = 1;
  return _this;
}

// 关键：实例继承 + 静态继承
_inherits(Child, Parent);
```

```js
function _inherits(subClass, superClass) {
  // ① 实例继承：Sub.prototype = Object.create(Parent.prototype)
  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: { value: subClass, enumerable: false, writable: true, configurable: true },
  });
  // ② 静态继承：Object.setPrototypeOf(Sub, Parent)
  if (superClass) Object.setPrototypeOf(subClass, superClass);
}
```

**`_inherits` 就两步：`Object.create` + `setPrototypeOf`**——正好对应上面说的「双向原型」。

**注意 `_Parent.call(this, name) || this` 这个 `|| this`**：
- 如果父构造返回对象，就用那个对象（对应 `new` 的第 ④ 步）
- 否则用 `this`

---

## 3.7 六个必须知道的原型细节

### 3.7.1 `Object.create(null)` 没有原型

```js
const bare = Object.create(null);

Object.getPrototypeOf(bare);      // null      ← 实测
bare.toString;                    // undefined ← 连 toString 都没有
bare instanceof Object;           // false     ← 实测
```

**用途**：创建「纯净的字典对象」，避免原型链污染（比如 `__proto__`、`constructor` 这些键）。

```js
// 反例：普通对象当字典，'toString' 这种键会有坑
const dict = {};
'toString' in dict;               // true  ← 因为继承自 Object.prototype！
Object.hasOwn(dict, 'toString');  // false

// 正解
const safeDict = Object.create(null);
'toString' in safeDict;           // false ✅
```

**这也是 `Map` 比 `Object` 更适合做字典的原因之一**（见 07 册）。

### 3.7.2 改 `prototype` 会让旧实例的 `instanceof` 失效

```js
function F() {}
const inst = new F();
const oldProto = F.prototype;

F.prototype = {};                 // 换掉原型
inst instanceof F;                // false   ← 实测
Object.getPrototypeOf(inst) === oldProto;  // true  ← 实例的原型没变
```

**为什么**：`instanceof` 检查的是「`inst` 的原型链上有没有 `F.prototype` 这个**当前的**对象」。换掉 `F.prototype` 后，旧实例的原型链上就没有它；`new F()` 的新实例指向新对象，仍为 `true`。

### 3.7.3 `Object.prototype` 是原型链的终点

```js
Object.prototype.__proto__;       // null  ← 实测
```

**所以原型链一定以 `null` 结束**，不会无限循环。

**`instanceof` 手写的循环条件必须判断 `null`**：

```js
function myInstanceof(obj, Ctor) {
  if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) return false;
  let proto = Object.getPrototypeOf(obj);
  while (proto) {                       // ← proto 为 null 时退出
    if (proto === Ctor.prototype) return true;
    proto = Object.getPrototypeOf(proto);
  }
  return false;
}
```

### 3.7.4 内置构造函数的原型链

```js
Object.getPrototypeOf([]) === Array.prototype;              // true
Object.getPrototypeOf(Array.prototype) === Object.prototype; // true
Object.getPrototypeOf(Function.prototype) === Object.prototype; // true
Object.getPrototypeOf(Object.prototype) === null;           // true
```

**所以 `[] instanceof Object` 是 `true`**——数组也是对象。

### 3.7.5 `Function` 的 `[[Prototype]]` 指向自己的 `prototype`

```js
Function.__proto__ === Function.prototype;   // true   ← [[Prototype]] 等于自身 prototype，唯一
Function.prototype.__proto__ === Object.prototype;  // true
```

`Function` 是唯一一个 `[[Prototype]]` 等于自身 `prototype` 的内置对象，所以 `Function instanceof Function` 为 `true`；但 `Function.prototype` 的原型是 `Object.prototype`，链条并不闭环。

### 3.7.6 `instanceof` 可以被 `Symbol.hasInstance` 改写

```js
class Even {
  static [Symbol.hasInstance](n) { return n % 2 === 0; }
}
2 instanceof Even;      // true   ← 完全自定义了
3 instanceof Even;      // false
```

**内置的例子**：`[].concat()` 用 `Symbol.isConcatSpreadable`，`instanceof` 用 `Symbol.hasInstance`。

---

## 3.8 常见坑

| 坑 | 正确说法 |
|---|---|
| 混用 `prototype` 和 `__proto__` | `prototype` 只有**普通函数、class、generator**有；`__proto__` 是**对象都有**的原型访问器（`Object.create(null)` 除外） |
| 说「`__proto__` 是标准」 | 它是 **Annex B 的遗留特性**，推荐 `Object.getPrototypeOf` |
| 说「`constructor` 靠得住」 | 只是约定，改 `prototype` 就会丢，所以继承时要手动补 |
| 说「给原型属性赋值会改原型」 | ❌ 会在**自己**身上创建属性（遮蔽）；除非原型上是 setter |
| 说「`in` 和 `hasOwnProperty` 一样」 | `in` 查原型链，`hasOwn` 只查自己 |
| 说「组合继承是最优」 | 定义子类时多执行一次 `new Parent()`，原型上还有冗余实例属性；**寄生组合**才最优 |
| 说「class 是纯语法糖」 | 有六个本质区别（必须 new、严格模式、方法不可枚举、TDZ、super、静态继承） |
| 说「ES5 能实现静态继承」 | 能，但要手动 `Object.setPrototypeOf(Sub, Parent)`；class 自动做 |
| 说「原型链不会有循环」 | 正常不会（终点是 null），但 `Object.setPrototypeOf(a, b); Object.setPrototypeOf(b, a)` 会抛 TypeError |
| 用普通对象当字典 | `'toString' in {}` 是 true；用 `Object.create(null)` 或 `Map` |

---

## 3.9 答题模板

### 30 秒版（原型与原型链）

- 每个对象都有内部槽 `[[Prototype]]`，属性访问先查自身，再沿它上溯到 `null`，这条链就是原型链。
- `[[Prototype]]` 是内部槽；`__proto__` 是访问它的 Annex B 遗留访问器；`prototype` 是普通函数、class、generator 才有的属性，作为实例的原型。
- `Object.getPrototypeOf(f) === F.prototype`，而 `Object.getPrototypeOf(F) === Function.prototype`；终点是 `Object.prototype` 的原型为 `null`。

### 30 秒版（`new` 做了什么）

- 创建新对象，把它的 `[[Prototype]]` 指向 `Foo.prototype`。
- 以新对象为 `this` 执行 `Foo`；`Foo` 返回对象则用返回值，否则用新对象。
- `return` 原始值被忽略；手写 `new` 即 `Object.create(Ctor.prototype)` + `apply` + 判断返回值是否为对象或函数。

### 2 分钟版（继承方式，串起来讲）

- **原型链继承**：`Child.prototype = new Parent()`。能复用父类方法，但引用类型属性被所有实例共享，且创建子类时不能给父类传参。
- **构造函数继承**：`Parent.call(this, name)`。实例属性独立、能传参，但没接原型链，拿不到父类原型方法（`instanceof Parent` 为 `false`）。
- **组合继承**：两者都用。引用不共享、能传参、有原型方法，但定义子类时额外执行一次 `new Parent()`，且 `Child.prototype` 上多一份实例属性。
- **寄生组合继承**：用 `Object.create(Parent.prototype)` 接原型链，父构造只在实例化时调一次，是 ES5 最优解，也是 Babel 编译 class 的形态。
- **class extends**：语法层面统一，本质仍是寄生组合 + 更严格语义；`_inherits` 做 `Object.create` 接实例原型、`setPrototypeOf` 接静态原型。

### 追问表

| 追问 | 回答要点 |
|---|---|
| `new` 的四步 | 建对象 → 设原型 → 执行 → 判断返回值 |
| `new` 返回原始值会怎样 | 被忽略，返回新对象 |
| 改 `prototype` 后 `instanceof` 失效吗 | 旧实例会失效；新实例指向新 `prototype`，仍为 true |
| 原型链的终点 | `Object.prototype` 的原型为 `null` |
| 为什么 `[] instanceof Object` 是 true | 数组也是对象，原型链经过 `Object.prototype` |

---

## 3.10 速记卡

```
三个概念
  [[Prototype]]  内部槽，所有对象都有
  __proto__      访问器（Annex B 遗留），推荐 Object.getPrototypeOf
  prototype      普通函数、class、generator 才有，作为「实例的原型」
  f.__proto__ === F.prototype；F.__proto__ === Function.prototype
  Foo.prototype.__proto__ === Object.prototype；Object.prototype.__proto__ === null

new 四步
  ① 建对象 ② 设 [[Prototype]] = Ctor.prototype ③ 以 obj 为 this 执行 ④ 返回对象则用它，否则用 obj
  ★ return 原始值被忽略；return 函数也算对象

原型链读写
  读：沿链找；写：在自己身上创建（遮蔽），不改原型
  例外：原型上是 setter 时会触发 setter
  in 查链；Object.hasOwn 只查自己

五种继承（演进主线）
  ① 原型链：Child.prototype = new Parent()
     ✗ 引用共享 ✗ 不能传参
  ② 构造函数：Parent.call(this)
     ✓ 不共享 ✓ 能传参  ✗ 拿不到原型方法 / instanceof 父类为 false
  ③ 组合：两个都用
     ✓ 全都有  ✗ 定义原型时多调一次父构造 + 原型冗余
  ④ 寄生组合：Object.create(Parent.prototype)  ← ES5 最优
     ✓ 全都有且父构造 1 次/实例
  ⑤ class extends：本质寄生组合 + 更严格语义

class 不是纯语法糖（六个区别）
  必须 new / 强制严格 / 方法不可枚举 / 有 TDZ / 有 super / 自动静态继承
  Babel 的 _inherits：Object.create + setPrototypeOf（双向原型）

原型细节
  Object.create(null)：无原型，无 toString，instanceof Object 为 false
  改 F.prototype → 旧实例 instanceof F 变 false
  Function.__proto__ === Function.prototype（唯一 [[Prototype]] 等于自身 prototype 的内置对象）
  Symbol.hasInstance 可改写 instanceof
```
