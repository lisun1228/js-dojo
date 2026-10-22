# TS · 06 类与面向对象

> 本册覆盖：访问修饰符、类的特性、继承、方法重写、getter/setter
> 题单把 `readonly` 列为「访问修饰符」——**这是错的**，它不是修饰符。更重要的是题单没说：**TS 的 `private` 是假的，编译后运行时能访问**。这一条是这类题的必问点。

---

## 6.1 一句话结论

TS 的类在 JS 类的基础上加了**四类**东西：
**① 访问控制**（`public` / `private` / `protected` / `#`）、**② 只读与静态**（`readonly` / `static`）、**③ 类型层能力**（`implements`、`abstract`、`override`）、**④ 参数属性**（`constructor(private x)`）。
**但要记住：所有访问控制在编译后都会消失，运行时只有 `#` 是真私有。**

---

## 6.2 类的完整语法清单（答法）

**题 38 是「罗列题」，按四组说最清晰。**

### 6.2.1 成员类型

| 成员 | 写法 |
|---|---|
| **属性** | `name: string = 'a'` |
| **只读属性** | `readonly id: string` |
| **可选属性** | `age?: number` |
| **方法** | `greet(): void {}` |
| **静态属性/方法** | `static count = 0` |
| **getter / setter** | `get name() {}` / `set name(v) {}` |
| **私有字段（真私有）** | `#secret = 1` |
| **索引签名** | `[key: string]: unknown` |

### 6.2.2 修饰符

| 修饰符 | 作用 |
|---|---|
| `public`（默认） | 任何地方可访问 |
| `private` | 只有**类内部**可访问（**编译期检查**） |
| `protected` | 类内部 + **子类**可访问 |
| `readonly` | 只能在声明处或构造函数中赋值 |
| `static` | 属于类本身，不属于实例 |
| `abstract` | 抽象成员，子类必须实现 |
| `override` | 显式标记「我在重写父类方法」（TS 4.3） |
| `declare` | 只声明类型，不生成代码（用于 `useDefineForClassFields` 场景） |

### 6.2.3 类型层能力

| 能力 | 写法 |
|---|---|
| **继承（单继承）** | `class A extends B` |
| **实现接口（多实现）** | `class A implements I1, I2` |
| **抽象类** | `abstract class A` |
| **泛型类** | `class Box<T>` |

### 6.2.4 参数属性（语法糖）

```ts
// 写法 A：传统方式（啰嗦）
class User {
  private name: string;
  public readonly id: string;
  constructor(name: string, id: string) {
    this.name = name;
    this.id = id;
  }
}

// 写法 B：参数属性（一行搞定）
class User {
  constructor(
    private name: string,
    public readonly id: string,
  ) {}
}
```

**参数属性是 TS 独有的语法糖**，编译后会生成 `this.name = name` 等赋值语句：

```js
// 编译产物
class User {
  constructor(name, id) {
    this.name = name;      // ← 自动生成
    this.id = id;
  }
}
```

> **注意**：参数属性只能用 `public`/`private`/`protected`/`readonly`，**不能用 `static`**（参数不可能是静态的）。

---

## 6.3 访问修饰符（含一个必须纠正的点）

### 6.3.1 三个真正的访问修饰符

```ts
class Base {
  public a = 1;        // 默认，写不写一样
  private b = 2;       // 只有本类
  protected c = 3;     // 本类 + 子类
}

class Derived extends Base {
  test() {
    this.a;    // ✅
    this.b;    // ❌ 报错：private 只在 Base 内可访问
    this.c;    // ✅ protected 子类可访问
  }
}

const obj = new Base();
obj.a;         // ✅
obj.b;         // ❌ 报错
obj.c;         // ❌ 报错
```

**⚠️ `readonly` 不是访问修饰符**：

| | 访问修饰符 | `readonly` |
|---|---|---|
| 控制什么 | **谁能访问** | **能否赋值** |
| 能否组合 | 三者互斥 | ✅ **可以和 public/private 组合** |
| 编译后 | 消失 | 消失 |

```ts
class A {
  public readonly x = 1;      // ✅ 合法组合
  private readonly y = 2;     // ✅
  public private z = 3;       // ❌ 报错：不能同时用两个访问修饰符
}
```

### 6.3.2 【核心】TS 的 `private` 是假的（必问）

**这是本册最重要的一条。**

```ts
// 源码
class User {
  private password = 'secret';
}

const u = new User();
console.log(u.password);    // ❌ 编译期报错：属性 'password' 为私有属性
```

```js
// 编译后
class User {
  constructor() {
    this.password = 'secret';    // ← private 完全消失了！
  }
}
```

```js
// 运行时（或者用 any 绕过）
(u as any).password;    // 'secret'  ← 能读到，也能写
```

**结论**：

| 机制 | 编译期 | 运行时 | 能否真正防止访问 |
|---|---|---|---|
| **`private`** | ✅ 报错 | ❌ **完全可访问** | ❌ |
| **`#x`（ES2022）** | ✅ 报错 | ✅ **真正不可访问** | ✅ |

### 6.3.3 `#x`：真正的私有字段

```ts
class User {
  #password = 'secret';        // 真私有

  check(pwd: string) {
    return pwd === this.#password;
  }
}

const u = new User();
u.#password;           // ❌ 编译期报错（语法层面就不允许）
(u as any).#password;  // ❌ 运行时抛 SyntaxError：Private field must be declared in an enclosing class
```

**`#x` 的特点**：

| 特点 | 说明 |
|---|---|
| **真私有** | 运行时无法从外部访问，连 `as any` 都不行 |
| **不会出现在 `Object.keys`** | 也不在 `for...in` 里 |
| **不能被子类访问** | 连 `protected` 的效果都没有 |
| **可以用 `static #x`** | 静态私有字段 |
| **编译产物** | 现代 target 直接输出 `#x`；低 target 用 `WeakMap` 模拟 |

**`#` 和 `private` 的完整对比**：

| 维度 | `private` | `#` |
|---|---|---|
| 编译期检查 | ✅ | ✅ |
| **运行时隔离** | ❌ **无** | ✅ **有** |
| 子类能否访问 | ❌ | ❌ |
| 能否用 `#x in obj` 检测 | — | ✅（ES2022） |
| 兼容性 | 所有 JS | 需要 ES2022 或降级 |
| 能否用于参数属性 | ✅ | ❌（`constructor(#x)` 语法不允许） |

> **面试话术**：「TS 的 `private` **只在编译期检查**，编译后这个修饰符完全消失，运行时 `(obj as any).x` 照样能读写。真正要运行时隔离得用 ES2022 的 `#x` 私有字段——它连 `as any` 都绕不过，会抛 SyntaxError。所以如果密封敏感数据（比如用户密码、密钥），应该用 `#`；如果只是表达『内部实现，别用』的约定，`private` 就够了。」

### 6.3.4 `protected` 的一个细节

```ts
class Base {
  protected value = 1;
}

class Derived extends Base {
  compare(other: Base) {
    return this.value === other.value;    // ❌ 报错！
    // protected 只能通过「this 或子类实例」访问
    // 不能通过「父类类型的实例」访问
  }

  compare2(other: Derived) {
    return this.value === other.value;    // ✅
  }
}
```

**规则**：`protected` 成员只能通过**当前类或其子类的实例**访问，**不能通过父类型的引用访问**。这个限制很多人不知道。

### 6.3.5 `static` 与静态侧

```ts
class Counter {
  static count = 0;              // 静态属性
  static #instances = 0;         // 静态私有

  static increment() {           // 静态方法
    Counter.count++;
  }

  instanceMethod() {
    Counter.count;               // ✅ 实例方法里能访问静态成员（要写类名）
    this.count;                  // ❌ 报错：实例上没有 count
  }
}

Counter.count;                   // ✅
new Counter().count;             // ❌ 报错
```

**静态成员属于「类这个函数对象」，不属于实例。**

**关键：类的「三个类型」**

| 指什么 | 类型写法 | 例子 |
|---|---|---|
| **实例类型** | `Counter` | `const c: Counter = new Counter()` |
| **静态侧类型** | `typeof Counter` | `const C: typeof Counter = Counter` |
| **构造器签名** | `new () => Counter` | 用于工厂函数参数 |

```ts
// 这个区别非常重要
function createInstance(Ctor: new () => Counter): Counter {
  return new Ctor();
}
createInstance(Counter);        // ✅

function useStatic(C: typeof Counter) {
  C.count;                      // ✅ 能访问静态成员
}
```

### 6.3.6 修饰符的书写顺序

**TS 要求固定顺序**：

```
 accessibility → static → override → readonly
 public        static    override   readonly
```

```ts
class A {
  public static readonly MAX = 100;    // ✅
  static public readonly MAX2 = 100;   // ❌ 报错：'public' 修饰符必须出现在 'static' 之前
}
```

**记忆**：**「谁能看 → 是不是静态 → 是不是重写 → 能不能改」**。

---

## 6.4 继承

### 6.4.1 基本用法

```ts
class Animal {
  constructor(public name: string) {}

  speak(): void {
    console.log(`${this.name} makes a sound`);
  }
}

class Dog extends Animal {
  constructor(name: string, public breed: string) {
    super(name);          // ★ 必须先调用 super()
    // 这里才能用 this
  }

  speak(): void {
    super.speak();        // 调用父类方法
    console.log('woof');
  }
}
```

**三个规则**：

| 规则 | 说明 |
|---|---|
| **子类构造器必须先 `super()`** | 否则用 `this` 会报错（因为 `this` 由 `super()` 创建） |
| **只支持单继承** | `class A extends B, C` 报错；要「多继承」用 mixin 或接口 |
| **`extends` 可以是表达式** | `class A extends mixin(Base)`，这是 mixin 的基础 |

### 6.4.2 一个经典坑：字段初始化顺序

**这是 Vue/React 类组件时代最常见的 bug。**

```ts
class Base {
  constructor() {
    console.log('Base ctor:', this.value);   // 输出 undefined！
  }
}

class Derived extends Base {
  value = 42;
}

new Derived();
// 输出：Base ctor: undefined
```

**为什么**：执行顺序是

```
① 创建对象（this 绑定）
② 调用 super() → 执行 Base 构造函数
   ↑ 此时 Derived 的字段【还没初始化】
③ 回到 Derived，初始化字段 value = 42
④ 执行 Derived 构造函数剩余部分
```

**所以「在父类构造函数里访问子类字段」永远是 `undefined`。**

**正确做法**：不要在构造函数里依赖子类字段，用「初始化方法」或「延迟到生命周期」。

```ts
class Base {
  init() { }                    // 子类重写
  constructor() {
    // 不要在这里访问子类字段
  }
}

class Derived extends Base {
  value = 42;
  init() { console.log(this.value); }   // ✅
}

const d = new Derived();
d.init();
```

### 6.4.3 `super` 的两种用法

```ts
class Derived extends Base {
  constructor() {
    super();              // ① 调用父类构造函数（只能在构造器里）
  }

  method() {
    super.method();       // ② 调用父类同名方法（任意方法里）
  }

  // ⚠️ 不能这样
  other() {
    super();              // ❌ 报错：super 调用只能在构造函数里
  }
}
```

---

## 6.5 方法重写

### 6.5.1 基本规则

```ts
class Base {
  greet(name: string): string {
    return `Hello, ${name}`;
  }
}

class Derived extends Base {
  // ✅ 合法：参数相同、返回相同
  greet(name: string): string {
    return `Hi, ${name}`;
  }

  // ❌ 报错：参数类型不兼容（子类参数必须更宽松，不能更严格）
  greet(name: number): string { return ''; }

  // ❌ 报错：返回类型不兼容
  greet(name: string): number { return 1; }
}
```

### 6.5.2 型变规则（这是「为什么」层面的答案）

| 位置 | 规则 | 记忆 |
|---|---|---|
| **参数** | 子类必须**更宽松或相同**（逆变） | 「父类能接受的，子类必须也能接受」 |
| **返回值** | 子类必须**更窄或相同**（协变） | 「父类承诺返回的，子类至少也要返回那个」 |

```ts
class Base {
  fn(x: string | number): string | number { return x; }
}

class Derived extends Base {
  // ✅ 参数更宽（逆变 OK）
  fn(x: string | number | boolean): string { return ''; }
  //   ↑ 参数更宽          ↑ 返回值更窄（协变 OK）
}
```

**LSP（里氏替换原则）**：子类实例必须能替换父类实例而不出错。所以「子类要求更多（参数更严）」就破坏了替换性。

**⚠️ 但 TS 的方法参数是「双变（bivariant）」的**——为了兼容 JS 的数组方法（`Array<T>` 的 `push` 等）。这是一个**故意的不健全**。

```ts
// TS 默认允许（双变），虽然不安全
class A { fn(x: string) {} }
class B extends A { fn(x: 'a' | 'b') {} }   // ✅ 参数更窄，TS 也允许

// 开启 strictFunctionTypes 后，函数类型的参数变成逆变
// 但【方法】仍然双变（这是 TS 的特例）
```

**这个细节答出来非常加分**，说明你读过 `strictFunctionTypes` 的文档。

### 6.5.3 `override` 关键字（TS 4.3，加分项）

```ts
class Base {
  greet() {}
}

class Derived extends Base {
  override greet() {}         // ✅ 明确表示「我在重写」

  override notExist() {}      // ❌ 报错：父类没有这个方法
}
```

**价值**：

| 场景 | 不加 `override` | 加 `override` |
|---|---|---|
| 父类方法改名了 | 子类方法变成「新方法」，**悄悄失效** | **编译报错** |
| 拼写错误 | 变成新方法，没重写成功 | **编译报错** |

**配合 `noImplicitOverride: true`，可以强制所有重写都写 `override`**——这是大型项目的好实践。

---

## 6.6 getter / setter

### 6.6.1 基本用法

```ts
class User {
  private _name = '';

  get name(): string {
    return this._name;
  }

  set name(v: string) {
    this._name = v.trim();      // 可以在这里做校验/转换
  }
}

const u = new User();
u.name = '  alice  ';
u.name;      // 'alice'（已 trim）
```

**getter/setter 在类型上表现为一个普通属性**：

```ts
interface HasName { name: string }
const u: HasName = new User();   // ✅ 兼容
```

### 6.6.2 只读属性（只有 getter）

```ts
class Circle {
  constructor(private r: number) {}

  get area(): number {
    return Math.PI * this.r ** 2;
  }
  // 没有 setter → 外部赋值报错
}

const c = new Circle(1);
c.area;         // ✅
c.area = 10;    // ❌ 报错：Cannot assign to 'area' because it is a read-only property
```

**这比 `readonly` 更强**：`readonly` 只在声明处和构造函数里能赋值，而「只有 getter」是**永远不能赋值**。

### 6.6.3 TS 4.3 后的新能力：getter 和 setter 可以有不同类型

```ts
class Box {
  private _value: string | number = '';

  get value(): string | number {
    return this._value;
  }

  set value(v: string | number) {   // 4.3 之前必须和 getter 同类型
    this._value = v;
  }
}
```

**更实用的场景**：setter 接受宽类型，getter 返回窄类型。

```ts
class Config {
  private _port = 3000;

  get port(): number {
    return this._port;
  }

  set port(v: number | string) {          // ✅ TS 4.3+
    this._port = typeof v === 'string' ? parseInt(v, 10) : v;
  }
}

const c = new Config();
c.port = '8080';       // ✅ setter 接受 string
const p: number = c.port;   // ✅ getter 返回 number
```

**这个特性在「接受多种输入、统一成一种输出」的场景很有用。**

### 6.6.4 ⚠️ 一个非常隐蔽的坑：`useDefineForClassFields`

**它会改变「子类字段初始化时是否触发父类 setter」——这是语义级的变化。**

```ts
class Base {
  private _v = '';
  set value(v: string) { console.log('  setter called:', v); this._v = v; }
  get value() { return this._v; }
}

class Derived extends Base {
  value = 'default';       // ← 注意这里
}
```

**实测两个 target 下的运行结果（Node 22 / TS 7.0）**：

| target | `useDefineForClassFields` | 编译产物 | 运行结果 |
|---|---|---|---|
| **ES2019** | `false`（默认） | `this.value = 'default'` | **setter 被调用**，`_v = "default"` ✅ |
| **ES2022** | `true`（默认） | `value = 'default';`（字段声明） | **setter 被绕过**，`_v = ""`（空！） |

**`_v` 是空字符串还是 `"default"`——这是实打实的行为差异。**

**原因：两种字段初始化的语义不同**

| 设置 | 语义 | 编译产物 | 结果 |
|---|---|---|---|
| **`false`** | **赋值**（`[[Set]]`） | `this.value = 'default'` | **触发父类 setter** |
| **`true`**（ES2022） | **定义**（`[[Define]]`） | `class { value = 'default' }`（实例字段） | **直接定义自己的属性，绕过 setter** |

**默认值**：

```
target: ES2022 或更高 → useDefineForClassFields 默认 true
target: ES2021 或更低 → 默认 false
```

**所以「只改 tsconfig 的 target」就可能悄悄改变类的运行时行为**——这是升级 TS/改构建配置时最容易踩的坑之一。

#### 好消息：TS 4.0+ 会在编译期拦住它

**上面那段代码在 TS 里其实编译不过**：

```
error TS2610: 'value' is defined as an accessor in class 'Base',
              but is overridden here in 'Derived' as an instance property.
```

**TS 特意加了这个检查**，正因为两种语义有歧义——**它不让你写出「既可能走 setter 又可能不走」的代码**。

**所以这个坑真正会咬人的场景是**：

| 场景 | 说明 |
|---|---|
| **从 JS 迁移过来的代码** | 原 JS 里这么写没问题，加类型后突然报错 |
| **`// @ts-ignore` 绕过了** | 错误被压掉，运行时行为取决于 target |
| **用的库内部这么写** | 你看到的现象和文档不一致 |
| **升级 target 后行为变了** | 之前对，现在错，而且没有编译错误（如果代码用了 `declare` 或类型断言） |

#### 正确写法

**想触发 setter**（让父类处理赋值逻辑）：

```ts
class Derived extends Base {
  declare value: string;       // 只声明类型，不生成字段
  constructor() {
    super();
    this.value = 'default';    // 显式赋值 → 走 setter
  }
}
```

**想保留旧语义**（全局关掉）：

```json
{ "compilerOptions": { "useDefineForClassFields": false } }
```

> **面试话术**：「`useDefineForClassFields` 是 TS 4.0 引入的，target 是 ES2022 时默认开启。它把类字段初始化从『赋值语义』改成『定义语义』——`false` 时编译成 `this.x = v`，会触发父类的 setter；`true` 时是实例字段声明，**直接定义自己的属性、绕过 setter**。我实测过，父类 setter 里写 `_v`，子类 `value = 'default'`，ES2019 编译下 `_v` 是 `'default'`，ES2022 下 `_v` 是空字符串——这是真实的行为差异。不过好消息是 **TS 4.0+ 会对『用属性覆盖父类 accessor』直接报 TS2610 错误**，所以正常写 TS 代码碰不到；真正会咬人的是从 JS 迁移的代码、或者用 `@ts-ignore` 压掉错误的情况。」

### 6.6.5 getter/setter 与 `Object.keys`

```ts
class A {
  get computed() { return 1; }
  normal = 2;
}

Object.keys(new A());     // ['normal']  ← getter 是原型上的，不在实例上
```

**getter 定义在 `A.prototype` 上**（除非用 `Object.defineProperty` 定义在实例上），所以不在实例的自有属性里。

---

## 6.7 常见坑

| 坑 | 正确说法 |
|---|---|
| **把 `readonly` 当访问修饰符** | 它不是，它控制「能否赋值」，可以和 `public/private` 组合 |
| **以为 `private` 运行时也隔离** | ❌ 只在编译期检查，编译后完全消失；要真私有用 `#x` |
| **`private` 和 `#` 当一回事** | `#` 是真私有（运行时抛错），`private` 只是约定 |
| **子类构造器里先用 `this` 再 `super()`** | ❌ 报错，`this` 由 `super()` 创建 |
| **在父类构造函数里访问子类字段** | 永远是 `undefined`（子类字段在 `super()` 之后才初始化） |
| **以为子类方法参数可以更严格** | ❌ 参数必须更宽或相同（逆变）；返回值必须更窄（协变） |
| **不知道 `strictFunctionTypes`** | 函数类型参数逆变，但**方法参数仍然双变**（TS 的故意不健全） |
| **`protected` 能通过父类引用访问** | ❌ 只能通过 `this` 或子类实例访问 |
| **字段初始化覆盖了父类 setter** | `useDefineForClassFields: true` 用 `[[Define]]` 语义绕过 setter；TS 4.0+ 会报 TS2610 拦住 |
| **修饰符顺序乱写** | 顺序是 `accessibility → static → override → readonly` |
| **想用 `#x` 做参数属性** | ❌ `constructor(#x)` 语法不允许 |
| **以为 `static` 成员能通过实例访问** | ❌ 只能通过类名 |

---

## 6.8 答题模板

### 30 秒版（访问修饰符）

> TS 有四个：`public` 默认、`private` 只有本类、`protected` 本类和子类、还有 `readonly`——**但 `readonly` 严格说不是访问修饰符**，它控制的是「能否赋值」，可以和前三个组合使用。
> **最关键的一点：`private` 和 `protected` 只在编译期检查，编译后修饰符完全消失，运行时 `(obj as any).x` 照样能访问。** 要真正的运行时隔离要用 ES2022 的 `#x` 私有字段，它连 `as any` 都绕不过，会抛 SyntaxError。
> 另外还有 `static`（属于类不属于实例）和参数属性 `constructor(private x: string)` 这个语法糖。

### 30 秒版（方法重写）

> 子类重新定义父类的同名方法。TS 会对类型做检查：**参数必须更宽松或相同（逆变），返回值必须更窄或相同（协变）**——这是里氏替换原则的要求，因为父类能接受的东西子类必须也能接受。
> 补充两点：TS 4.3 加了 `override` 关键字，显式标记重写，配合 `noImplicitOverride` 能防止「父类方法改名后子类方法悄悄失效」；另外 TS 里**方法参数是双变的**（不是严格的逆变），这是为了兼容 JS 的数组方法，属于故意的不健全。

### 2 分钟版（把类这块串起来）

> 我按「成员 → 访问控制 → 继承 → 一个隐蔽坑」讲。
>
> **成员**：属性、方法、静态成员、getter/setter、`#` 私有字段、索引签名。还有参数属性这个语法糖——`constructor(private name: string)` 会自动生成 `this.name = name`，编译产物里能看到。
>
> **访问控制**：`public`/`private`/`protected` 三个，加 `readonly`。这里要纠正一个常见说法：**`readonly` 不是访问修饰符**，它控制「能否赋值」，所以可以和前三个组合，比如 `private readonly x`。修饰符顺序也是固定的：`accessibility → static → override → readonly`。
>
> **最关键的一点是 `private` 是假的**。它只在编译期报错，编译后的 JS 里修饰符完全消失，`(obj as any).password` 照样能读到。真正要运行时隔离得用 ES2022 的 `#x`——它连 `as any` 都不行，访问会直接抛 SyntaxError，因为它是在语法层面就不允许。所以如果是密封敏感数据（密码、密钥）应该用 `#`，如果只是表达「内部实现别用」的约定，`private` 就够。
>
> **继承**：单继承 + `super()`。三个规则：子类构造器必须先 `super()` 才能用 `this`；只支持单继承，多继承用 mixin 或接口；`extends` 后面可以是表达式，这是 mixin 的基础。重写时参数逆变、返回值协变——因为里氏替换原则。不过 TS 的方法参数其实是双变的，`strictFunctionTypes` 只对函数类型生效，方法仍然双变，是为了兼容数组方法，这是故意的不健全。
>
> **一个特别隐蔽的坑**：字段初始化顺序。父类构造函数执行时，子类字段还没初始化，所以在父类构造函数里访问子类字段永远是 `undefined`。Vue/React 类组件时代经常踩这个。
>
> 还有一个更隐蔽的：`useDefineForClassFields`。TS 4.0 引入，target 是 ES2022 时默认 true。它把字段初始化从「赋值语义」改成「定义语义」——`false` 时是 `this.x = v`，会触发父类的 setter；`true` 时是 `Object.defineProperty`，**直接覆盖属性、绕过 setter**。所以升级 target 可能悄悄改变类的行为，要保留旧行为就显式设成 `false`，或者用 `declare` 只声明类型然后在构造函数里显式赋值。
>
> 最后 getter/setter：TS 4.3 起 getter 和 setter 可以有不同类型，典型场景是 setter 接受 string 或 number、getter 统一返回 number，做输入归一化很方便。

### 追问表

| 追问 | 回答要点 |
|---|---|
| `private` 运行时能访问吗 | **能**，只在编译期检查；`#x` 才是真私有 |
| `readonly` 是访问修饰符吗 | 不是，它控制能否赋值，可与前三个组合 |
| `readonly` 是深还是浅 | **浅**只读，对象属性仍可改 |
| `readonly` 数组怎么写 | `readonly T[]` / `ReadonlyArray<T>` |
| `protected` 有什么限制 | 只能通过 `this` 或子类实例访问，不能用父类引用 |
| 修饰符顺序 | `accessibility → static → override → readonly` |
| 参数属性是什么 | `constructor(private x)` 自动生成 `this.x = x` |
| 参数属性能用 `#` 吗 | 不能，语法不允许 |
| 子类构造器能不用 `super()` 吗 | 不能，`this` 由 `super()` 创建 |
| 为什么父类构造函数里拿不到子类字段 | 字段初始化在 `super()` 返回之后 |
| 重写的型变规则 | 参数逆变（更宽）、返回值协变（更窄） |
| `strictFunctionTypes` 管方法吗 | 不管，方法参数仍然双变（故意不健全） |
| `override` 有什么价值 | 父类方法改名时能编译报错，防止静默失效 |
| getter/setter 类型可以不同吗 | TS 4.3+ 可以 |
| `useDefineForClassFields` 影响什么 | 字段初始化语义：赋值 vs 定义（后者绕过 setter） |
| 类的三个类型是什么 | 实例类型 `Foo`、静态侧 `typeof Foo`、构造器 `new () => Foo` |

---

## 6.9 速记卡

```
成员清单
  属性 / 可选属性 / readonly / 方法 / static / getter-setter / #私有 / 索引签名

访问控制
  public（默认）/ private（本类）/ protected（本类+子类）
  ★ readonly 不是访问修饰符（控制能否赋值，可组合）
  ★ private 只在编译期！运行时完全可访问
  ★ #x 才是真私有（运行时抛 SyntaxError，as any 也不管用）
  protected 只能通过 this 或子类实例访问（父类引用不行）
  顺序：accessibility → static → override → readonly

参数属性
  constructor(private name: string) → 自动生成 this.name = name
  不能用 static，不能用 #

继承
  单继承 + super()（必须先调用才能用 this）
  ★ 父类构造函数执行时子类字段还没初始化 → 访问得到 undefined
  extends 后面可以是表达式 → mixin 的基础

重写
  参数逆变（更宽或相同）+ 返回值协变（更窄或相同）= 里氏替换
  ★ TS 方法参数实际是「双变」（故意不健全，为兼容数组方法）
  override 关键字 + noImplicitOverride 防「父类改名后静默失效」

getter/setter
  只有 getter = 永远只读（比 readonly 更强）
  TS 4.3+ getter 和 setter 可以有不同类型（setter 宽、getter 窄）
  ★ useDefineForClassFields: true → [[Define]] 语义，绕过父类 setter
    target ≥ ES2022 时默认为 true ← 升级 target 会悄悄改变行为
    实测：ES2019 下 _v='default'（走了 setter）/ ES2022 下 _v=''（绕过了）
    TS 4.0+ 会用 TS2610 拦住「属性覆盖父类 accessor」，正常写 TS 碰不到
    规避：设成 false，或 declare + 构造函数里显式赋值
```
