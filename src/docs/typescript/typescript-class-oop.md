# TS · 06 类与面向对象

> 覆盖：访问修饰符、类的特性、继承、方法重写、getter/setter

---

## 目录

- [6.1 一句话结论](#61-一句话结论)
- [6.2 类的完整语法清单（答法）](#62-类的完整语法清单答法)
- [6.3 访问修饰符（含一个必须纠正的点）](#63-访问修饰符含一个必须纠正的点)
- [6.4 继承](#64-继承)
- [6.5 方法重写](#65-方法重写)
- [6.6 getter / setter](#66-getter--setter)
- [6.7 常见坑](#67-常见坑)
- [6.8 答题模板](#68-答题模板)
- [6.9 速记卡](#69-速记卡)

---

## 6.1 一句话结论

TS 的类在 JS 类的基础上加了**四类**东西：
**① 访问控制**（`public` / `private` / `protected` / `#`）、**② 只读与静态**（`readonly` / `static`）、**③ 类型层能力**（`implements`、`abstract`、`override`）、**④ 参数属性**（`constructor(private x)`）。
`public` / `private` / `protected` 编译后都会消失，运行时只有 `#` 是真私有。

---

## 6.2 类的完整语法清单（答法）

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
| `override` | 显式标记重写父类成员（TS 4.3） |
| `declare` | 只声明类型，不生成字段 |

### 6.2.3 类型层能力

| 能力 | 写法 |
|---|---|
| **继承（单继承）** | `class A extends B` |
| **实现接口（多实现）** | `class A implements I1, I2` |
| **抽象类** | `abstract class A` |
| **泛型类** | `class Box<T>` |

### 6.2.4 参数属性（语法糖）

```ts
// 写法 A：显式声明 + 赋值
class User {
  private name: string;
  public readonly id: string;
  constructor(name: string, id: string) {
    this.name = name;
    this.id = id;
  }
}

// 写法 B：参数属性
class User {
  constructor(
    private name: string,
    public readonly id: string,
  ) {}
}
```

**参数属性是 TS 独有的语法糖**，编译后生成 `this.name = name` 等赋值语句（target 为 ES2022 时还会额外生成 `name;` 字段声明）：

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

### 6.3.2 TS 的 `private` 是假的

```ts
// 源码
class User {
  private password = 'secret';
}

const u = new User();
console.log(u.password);    // ❌ 编译期报错：属性 'password' 为私有属性
```

```js
// 编译后（target ES2021 及以下）
class User {
  constructor() {
    this.password = 'secret';    // ← private 完全消失了！
  }
}
```

```js
// 编译后运行时：就是普通属性
u.password;    // 'secret'  ← 能读也能写
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
u.#password;           // ❌ 编译期报错（TS18016：私有标识符不能在类体外使用）
```

`(u as any)` 也绕不过：TS 在解析阶段就拒绝；纯 JS 里在类外部写 `obj.#p` 直接抛 `SyntaxError: Private field '#p' must be declared in an enclosing class`，模块根本无法加载。

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

### 6.3.4 `protected` 的一个细节

```ts
class Base {
  protected value = 1;
}

class Derived extends Base {
  compare(other: Base) {
    return this.value === other.value;    // ❌ 报错
    // protected 只能通过「this 或子类实例」访问
    // 不能通过「父类类型的实例」访问
  }

  compare2(other: Derived) {
    return this.value === other.value;    // ✅
  }
}
```

**规则**：`protected` 成员只能通过**当前类或其子类的实例**访问，**不能通过父类型的引用访问**。

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

```ts
class Base {
  declare value: number;                  // 只声明类型，不生成字段
  constructor() {
    console.log('Base ctor:', this.value);   // 输出 undefined
  }
}

class Derived extends Base {
  value = 42;
}

new Derived();
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
class Base {
  method() {}
}

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
}

class BadParam extends Base {
  // ❌ 报错：参数类型与父类不兼容
  greet(name: number): string { return ''; }
}

class BadReturn extends Base {
  // ❌ 报错：返回类型不兼容
  greet(name: string): number { return 1; }
}
```

### 6.5.2 型变规则

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

### 6.5.3 `override` 关键字（TS 4.3）

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

**`noImplicitOverride: true` 会强制所有重写都写 `override`。**

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

**赋值限制比 `readonly` 更严**：`readonly` 只在声明处和构造函数里能赋值，而「只有 getter」是**永远不能赋值**。

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

### 6.6.4 一个隐蔽的坑：`useDefineForClassFields`

**它会改变「子类字段初始化时是否触发父类 setter」——这是语义级的变化。**

```ts
class Base {
  private _v = '';
  set value(v: string) { console.log('  setter called:', v); this._v = v; }
  get value() { return this._v; }
}

class Derived extends Base {
  value = 'default';       // 子类字段覆盖父类 accessor
}
```

**实测两个 target 下的运行结果（Node 22 / TS 6.0.3）**：

| `useDefineForClassFields` | 语义 | 编译产物 | 运行结果（父类 setter 内写 `_v`） |
|---|---|---|---|
| `false`（target ≤ ES2021 默认） | 赋值 `[[Set]]` | `this.value = 'default'` | setter 被调用，`_v = "default"` |
| `true`（target ≥ ES2022 默认） | 定义 `[[Define]]` | `value = 'default'`（实例字段） | 绕过 setter，`_v = ""` |

**默认值**：

```
target: ES2022 或更高 → useDefineForClassFields 默认 true
target: ES2021 或更低 → 默认 false
```

改 `target` 就会改变类的运行时行为。

#### TS 会在编译期拦住它

**上面那段代码在 TS 里编译不过**：

```
error TS2610: 'value' is defined as an accessor in class 'Base',
              but is overridden here in 'Derived' as an instance property.
```

**TS 用这个检查阻止「既可能走 setter 又可能不走」的代码。** 剩下会咬人的场景：

| 场景 | 说明 |
|---|---|
| **从 JS 迁移的代码** | 原 JS 合法，加类型后报 TS2610 |
| **`// @ts-ignore` 绕过** | 错误被压掉，运行时行为取决于 target |
| **库内部这么写** | 现象与文档不一致 |

#### 正确写法

**想触发 setter**（让父类处理赋值逻辑）：

```ts
class Derived extends Base {
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
| **`private` 和 `#` 当一回事** | `#` 是真私有（类外部写不出合法访问），`private` 只是约定 |
| **子类构造器里先用 `this` 再 `super()`** | ❌ 报错，`this` 由 `super()` 创建 |
| **在父类构造函数里访问子类字段** | 永远是 `undefined`（子类字段在 `super()` 之后才初始化） |
| **不知道 `strictFunctionTypes`** | 函数类型参数逆变，但**方法参数仍然双变**（TS 的故意不健全） |
| **`protected` 能通过父类引用访问** | ❌ 只能通过 `this` 或子类实例访问 |
| **字段初始化覆盖了父类 setter** | `useDefineForClassFields: true` 用 `[[Define]]` 语义绕过 setter；TS 会报 TS2610 拦住 |
| **修饰符顺序乱写** | 顺序是 `accessibility → static → override → readonly` |
| **想用 `#x` 做参数属性** | ❌ `constructor(#x)` 语法不允许 |
| **以为 `static` 成员能通过实例访问** | ❌ 只能通过类名 |

---

## 6.8 答题模板

### 30 秒版（访问修饰符）

- 访问控制三个：`public` 默认、`private` 只有本类、`protected` 本类和子类。
- `readonly` 不是访问修饰符，它控制「能否赋值」，可以和前三个组合。
- `private` / `protected` 只在编译期检查，编译后修饰符消失，运行时 `(obj as any).x` 照常读写；真私有要用 ES2022 的 `#x`。

### 30 秒版（方法重写）

- 子类重新定义父类同名方法：按 LSP，参数要更宽或相同（逆变），返回值要更窄或相同（协变）。
- TS 的方法参数实际是双变的，更窄也放行；`strictFunctionTypes` 只约束函数类型的属性。
- `override`（TS 4.3）显式标记重写，配合 `noImplicitOverride` 可在父类改名时报错。

### 2 分钟版（把类这块串起来）

- **成员**：属性 / 可选属性 / `readonly` / 方法 / `static` / getter-setter / `#` 私有字段 / 索引签名；参数属性 `constructor(private name: string)` 自动生成 `this.name = name`，ES2022 下还会生成字段声明。
- **访问控制**：`public` / `private` / `protected` + `readonly`（不是访问修饰符，可组合），修饰符顺序 `accessibility → static → override → readonly`。
- **`private` 是假的**：只做编译期检查，运行时 `(obj as any)` 可读写；`#x` 在语法层面就禁止外部访问，纯 JS 里直接 SyntaxError。
- **继承与重写**：单继承 + `super()`，子类构造器必须先 `super()` 才能用 `this`；父类构造函数执行时子类字段尚未初始化，读到 `undefined`；`extends` 后可以是表达式（mixin 基础）；方法参数双变、返回值协变。
- **字段初始化坑**：`useDefineForClassFields: true`（target ≥ ES2022）用 `[[Define]]`，字段声明绕过父类 setter；`false` 用 `[[Set]]`，会触发 setter。用属性覆盖父类 accessor 时 TS 报 TS2610。getter/setter 在 TS 4.3+ 可以类型不同（setter 宽、getter 窄）。

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
  ★ #x 才是真私有（类外部写不出合法访问，as any 也不管用）
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
  只有 getter = 永远只读（赋值限制比 readonly 更严）
  TS 4.3+ getter 和 setter 可以有不同类型（setter 宽、getter 窄）
  ★ useDefineForClassFields: true → [[Define]] 语义，绕过父类 setter
    target ≥ ES2022 时默认为 true ← 升级 target 会悄悄改变行为
    实测：ES2019 下 _v='default'（走了 setter）/ ES2022 下 _v=''（绕过了）
    TS 会用 TS2610 拦住「属性覆盖父类 accessor」，正常写 TS 碰不到
    规避：设成 false，或在构造函数里显式赋值
```
