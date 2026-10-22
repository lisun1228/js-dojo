# TS · 04 interface 与 type

> 本册覆盖：interface vs type 的差异、类类型接口
> 题单给了三个差异（扩展方式、声明合并、能表示什么），**方向对但有两处不准**：
> ① 「interface 能被 implements，type 不能」——**错**，对象类型的 type 也能被 implements；
> ② 没说 `extends` 冲突会报错、而 `&` 会静默变成 `never` 这个实战差异。

---

## 4.1 一句话结论

**`interface` 和 `type` 在描述对象形状时 95% 的能力重叠**。真正的差异只有四条：
**① `interface` 能声明合并，`type` 不能；② `type` 能表示联合/元组/条件/映射等「非对象类型」，`interface` 不能；③ `extends` 遇冲突报错，`&` 遇冲突变 `never`；④ `interface` 有类型缓存，深层组合时性能更好。**
**约定：描述对象/类的形状用 `interface`，其余（联合、工具类型、函数别名）用 `type`。**

---

## 4.2 七个维度完整对比

| # | 维度 | `interface` | `type` |
|---|---|---|---|
| 1 | **能表示什么** | 只能描述**对象形状**（含函数、构造器、索引签名） | **任意类型**（联合、元组、原始类型、条件、映射、模板字面量） |
| 2 | **扩展方式** | `extends A, B`（可多个） | `A & B`（交叉类型） |
| 3 | **声明合并** | ✅ **同名自动合并** | ❌ 同名报错 |
| 4 | **同名重复定义** | ✅ 允许（合并） | ❌ `Duplicate identifier` |
| 5 | **冲突处理** | `extends` 时成员冲突 → **编译报错** | `&` 交叉 → **静默变 `never`** |
| 6 | **能被 `implements`** | ✅ | ✅ **也可以**（只要是对象类型；联合不行） |
| 7 | **性能** | ✅ 有类型缓存（named type） | ⚠️ 交叉/联合要重新计算，深嵌套会慢 |

**逐条展开下面几节。**

---

## 4.3 差异一：能表示什么（这是最本质的）

### 4.3.1 `interface` 只能描述对象形状

```ts
// ✅ 对象
interface User { name: string; age: number }

// ✅ 函数（call signature）
interface Fn {
  (x: number): string;
}

// ✅ 构造器（construct signature）
interface Ctor {
  new (name: string): User;
}

// ✅ 索引签名
interface Dict {
  [key: string]: number;
}

// ✅ 方法简写
interface Service {
  getUser(id: string): Promise<User>;
}

// ❌ 不能表示联合
interface Bad = string | number;      // 语法错误

// ❌ 不能给原始类型起别名
interface Id = string;                // 语法错误

// ❌ 不能表示元组
interface Pair = [string, number];    // 语法错误
```

### 4.3.2 `type` 什么都能表示

```ts
type Id = string;                              // 原始类型别名
type Status = 'idle' | 'loading' | 'done';     // 联合
type Pair = [string, number];                  // 元组
type Nullable<T> = T | null;                   // 泛型 + 联合
type Keys = keyof User;                        // 索引类型
type Fn = (x: number) => string;               // 函数
type Obj = { a: string } & { b: number };      // 交叉
type IsString<T> = T extends string ? true : false;   // 条件类型
type Mapped<T> = { [K in keyof T]: T[K] };     // 映射类型
type Event = `on${Capitalize<string>}`;        // 模板字面量类型
type T = typeof someValue;                     // typeof 的结果
type U = User['name'];                         // 索引访问
```

**这一条是「用 type 的核心理由」** —— 一旦你要表达「不是对象」的类型，就只有 `type` 可选。

> **面试话术**：「interface 只能描述对象形状，type 能表示任意类型。所以联合类型、元组、条件类型、映射类型这些只有 type 能做。反过来说，如果你只是描述一个对象，两者都可以，那就看需不需要声明合并。」

---

## 4.4 差异二：扩展方式与「冲突处理」（这条最能体现深度）

### 4.4.1 基本写法

```ts
// interface 用 extends
interface A { a: string }
interface B { b: number }
interface C extends A, B {
  c: boolean;
}

// type 用交叉
type C2 = A & B & { c: boolean };
```

**表面看等价，但冲突时的行为完全不同。**

### 4.4.2 关键差异：冲突时 `extends` 报错，`&` 变成 `never`

```ts
// ① interface：编译直接报错
interface A { x: string }
interface B { x: number }
interface C extends A, B { }
// ❌ 报错：Interface 'C' cannot simultaneously extend types 'A' and 'B'.
//         Named property 'x' of types 'A' and 'B' are not identical.
```

```ts
// ② type：不报错，x 变成 never
type A2 = { x: string };
type B2 = { x: number };
type C2 = A2 & B2;
// ✅ 不报错！

// 但 C2['x'] 是 never，任何赋值都失败
const c: C2 = { x: 1 };     // ❌ 报错：不能将 number 赋给 never
const d: C2 = { x: 'a' };   // ❌ 报错：不能将 string 赋给 never
```

**为什么会有这个差异**：

| | 行为 | 原因 |
|---|---|---|
| `extends` | **检查兼容性并报错** | `extends` 的语义是「C 是 A 和 B 的子类型」，成员冲突就不可能成立 |
| `&` | **取交集** | `string & number` 的交集是空集，所以类型是 `never`（数学上正确，但实践中是陷阱） |

**实测两个错误信息对比（TS 7.0）**：

```
① interface C extends A, B  →
   error TS2320: Interface 'C' cannot simultaneously extend types 'A' and 'B'.
                 Named property 'x' of types 'A' and 'B' are not identical.
   ↑ 直接告诉你「C 不能同时扩展 A 和 B，属性 x 不一致」

② type C2 = A2 & B2  →  不报错
   const c: C2 = { x: 'a' }  →
   error TS2322: Type 'string' is not assignable to type 'never'.
   ↑ 报错完全不提 A2/B2 的冲突，只说「不能赋给 never」
```

**这就是为什么交叉类型难排查**：报错位置和真正的原因隔着好几层。

**这个差异在实战里很重要**：

```ts
// 场景：合并两个配置，但字段类型冲突了
type Config = BaseConfig & OverrideConfig;
// 如果某个字段类型冲突 → 变成 never → 后续所有赋值都报「不能赋给 never」
// 报错信息完全不指向真正的冲突点，排查很痛苦

// 用 interface 会立刻告诉你哪两个字段冲突
interface Config extends BaseConfig, OverrideConfig {}
// ❌ Named property 'timeout' of types ... are not identical  ← 直接指出问题
```

> **面试话术**：「`interface extends` 和 `type &` 有个重要差异：成员冲突时，`extends` 会编译报错并指出哪个属性冲突，而交叉类型会**静默地把属性变成 `never`**。因为 `string & number` 的交集是空集。后者在实战里很难排查，因为报错不指向冲突点，而是后面某处『不能赋给 never』。所以我一般建议：合并已知的、可能冲突的对象用 interface，可控的类型组合才用交叉。」

### 4.4.3 `interface` 还能 `extends` 一个类

**这是 `interface` 独有的能力**（`type` 没有）：

```ts
class Control {
  private state: any;
  select(): void {}
}

// interface 可以继承 class（只继承「形状」，不继承实现）
interface SelectableControl extends Control {
  select(): void;
}

// 注意：因为 Control 有 private 成员，只有 Control 的子类才能实现这个接口
class Button extends Control implements SelectableControl {
  select() {}
}

class MyImage implements SelectableControl {
  private state: any;    // ❌ 报错：private 必须来自同一个声明
  select() {}
}
```

**用途**：表达「只有某个类的子类才能满足这个约束」。这个模式很冷门，但知道它存在说明你读过文档。

---

## 4.5 差异三：声明合并（`interface` 的杀手级能力）

### 4.5.1 基本规则

```ts
// interface 同名 → 自动合并
interface User {
  name: string;
}
interface User {
  age: number;
}
// 等价于 interface User { name: string; age: number }

const u: User = { name: 'a', age: 1 };   // ✅ 两个属性都要
```

```ts
// type 同名 → 报错
type User = { name: string };
type User = { age: number };
// ❌ 报错：Duplicate identifier 'User'
```

### 4.5.2 声明合并的三个真实用途

**用途 ①：扩展第三方库的类型（最常见）**

```ts
// 给 Express 的 Request 加自定义字段
declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: string };
    }
  }
}
export {};

// 之后所有 req.user 都有类型
app.get('/', (req, res) => {
  req.user?.id;    // ✅
});
```

**用途 ②：给 `window` 加全局变量**

```ts
// global.d.ts
export {};

declare global {
  interface Window {
    __APP_CONFIG__: {
      apiBase: string;
      env: 'dev' | 'prod';
    };
    gtag?: (...args: any[]) => void;
  }
}

// 使用
window.__APP_CONFIG__.apiBase;    // ✅ 有类型
```

**用途 ③：扩展第三方库的接口（模块增强）**

```ts
// 给 vue-router 的 RouteMeta 加自定义字段
declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    title?: string;
  }
}

// 之后 route.meta.requiresAuth 有类型
```

**这三个用途全是「跨模块扩展别人的类型」——`type` 做不到。**

> **面试话术**：「声明合并是 interface 独有的。同名 interface 会自动合并，同名 type 会报错。它的真实价值不是『自己写两个同名接口』，而是**扩展第三方库的类型**——比如给 Express 的 Request 加 `user` 字段、给 `window` 加全局变量、给 vue-router 的 `RouteMeta` 加自定义字段。这些场景 type 完全做不到，因为不能改别人的源码，只能靠声明合并『补上去』。」

### 4.5.3 声明合并的坑

```ts
// 坑：合并是「无条件」的，容易意外污染
interface Config {
  debug: boolean;
}

// 某个第三方库也定义了 Config
interface Config {
  debug: string;     // ❌ 报错：后续属性声明必须具有相同的类型
}

// 更隐蔽的坑：第三方库定义的属性你根本没意识到
interface Window {
  name: string;      // window.name 本来就有（string）
}
```

---

## 4.6 差异四：`implements`（这里纠正一个常见错误说法）

### 4.6.1 常见错误说法

> ❌「interface 可以被 class implements，type 不行。」

**这是错的。** 对象类型的 `type` 也可以被 `implements`：

```ts
type Animal = {
  name: string;
  speak(): void;
};

class Dog implements Animal {      // ✅ 完全合法
  name = 'dog';
  speak() { console.log('woof'); }
}
```

### 4.6.2 准确的规则

**`implements` 接受「任何有静态已知成员的对象类型」**：

| 被实现的类型 | 能否 `implements` |
|---|---|
| `interface` | ✅ |
| `type` 对象类型 | ✅ |
| `type` 交叉类型（`A & B`） | ✅ |
| `type` **联合类型**（`A \| B`） | ❌ 报错 |
| `type` 原始类型（`type Id = string`） | ❌ 报错 |
| `type` 条件类型（无法静态确定成员） | ❌ 报错 |

```ts
// ❌ 联合类型不能 implements
type Shape = { kind: 'a' } | { kind: 'b' };
class S implements Shape { }    // 报错：A class can only implement an object type
                                 //       or intersection of object types with statically known members
```

> **面试话术**：「有个常见的错误说法是『type 不能被 implements』——其实对象类型的 type 是可以的，`class A implements SomeTypeAlias` 完全合法。准确规则是：`implements` 接受任何有静态已知成员的对象类型，所以 interface、对象 type、交叉 type 都行，但**联合类型和原始类型不行**。」

---

## 4.7 差异五：性能（真实存在，但别过度强调）

### 4.7.1 为什么有性能差异

**`interface` 会创建一个「命名的类型实体」，TS 可以缓存它的展开结果。**
**`type` 的交叉/联合是「匿名组合」，每次引用都要重新计算。**

```
interface A { a: 1 }        → 编译时创建一个 named type "A"，缓存
interface B { b: 2 }
interface C extends A, B {} → C 直接引用 A、B 的缓存

type A2 = { a: 1 }          → 没有创建 named type
type B2 = { b: 2 }
type C2 = A2 & B2           → 每次用到 C2 都要重新展开成 { a: 1 } & { b: 2 }
```

### 4.7.2 什么时候真的会慢

| 场景 | 影响 |
|---|---|
| 几十层的交叉类型嵌套 | 编辑器补全变慢、类型检查变慢 |
| 大对象上的映射类型（`DeepPartial<BigType>`） | 计算量爆炸 |
| 递归条件类型（类型体操） | 可能触发「Type instantiation is excessively deep」 |
| 普通业务代码 | **几乎无感** |

**TS 官方 wiki 的 Performance 页面确实建议「优先用 interface 而不是交叉类型」，但那是针对「大型类型组合」的场景。**

> **面试话术**：「性能差异真实存在但通常不重要。`interface` 会创建有名字的类型实体，TS 能缓存；`type` 的交叉是匿名的，每次引用都要重新展开。所以几十层交叉嵌套时编辑器会卡。但正常业务代码里感知不到——除非你在写「类型体操」库，否则不用为这个纠结。」

### 4.7.3 正确的心态

**别把性能当成选择依据**。选择依据应该是：

1. **需要声明合并** → `interface`
2. **需要联合/元组/条件/映射** → `type`
3. **只是描述对象** → 两者都行，**跟团队约定**（TS 官方 lint 规则 `consistent-type-definitions` 可以强制统一）

---

## 4.8 决策树（怎么选）

```
你要定义的东西是「对象形状」吗？
├─ 是
│   ├─ 需要被第三方扩展 / 声明合并？ → interface
│   ├─ 需要 class implements？        → interface 或 type 都行
│   ├─ 需要 extends 多个且希望冲突报错？→ interface
│   └─ 其他情况                        → 跟团队约定（大多选 interface）
└─ 否（联合 / 元组 / 原始类型 / 条件 / 映射 / 函数别名）
    └─ → type（没得选）
```

**一条实用的团队约定**（很多大厂在用）：

> **「对象用 interface，其他用 type；对外导出的 API 用 interface（便于使用方扩展），内部工具类型用 type。」**

---

## 4.9 类类型接口

### 4.9.1 基本用法

```ts
interface Animal {
  name: string;
  speak(): void;
}

class Dog implements Animal {
  name = 'dog';
  speak() { console.log('woof'); }
}

class Cat implements Animal {
  constructor(public name: string) {}
  speak() { console.log('meow'); }
}
```

### 4.9.2 `implements` 只检查「实例侧」，不检查「静态侧」

**这是最容易踩的坑。**

```ts
interface Animal {
  name: string;
  speak(): void;
}

class Dog implements Animal {
  static create() { return new Dog(); }   // 静态方法不在接口约束范围
  name = 'dog';
  speak() {}
}
```

**为什么**：`implements Animal` 的语义是「`new Dog()` 出来的实例符合 Animal」。**静态成员属于「类本身」，不属于「实例」**，所以不在检查范围。

**如果要约束静态侧 / 构造函数**，要单独定义：

```ts
interface AnimalConstructor {
  new (name: string): Animal;      // 构造签名
  createDefault(): Animal;         // 静态方法
}

const Factory: AnimalConstructor = Dog;   // Dog 的构造函数必须匹配
```

**这就是「构造函数类型」的标准写法**：

```ts
type Ctor<T> = new (...args: any[]) => T;

function createInstance<T>(Ctor: Ctor<T>): T {
  return new Ctor();
}

createInstance(Dog);    // ✅ T 推断为 Dog
```

### 4.9.3 `implements` vs `extends`（必问）

| | `implements`（实现） | `extends`（继承） |
|---|---|---|
| 语义 | 「我**承诺**有这些成员」 | 「我**是**它的子类，继承它的实现」 |
| 是否继承实现 | ❌ **只检查，不继承任何代码** | ✅ 继承属性、方法、实现 |
| 能否多继承 | ✅ 可以 `implements A, B` | ❌ 只能 `extends` 一个类 |
| 编译后 | **完全消失**（`implements` 是纯类型） | 生成 `__extends` / `class X extends Y` |
| 能否访问父类方法 | ❌ 不能 | ✅ 可以，还能 `super.xxx()` |
| 用途 | 约束形状、面向接口编程 | 复用实现、IS-A 关系 |

```ts
interface Flyable { fly(): void }
interface Swimmable { swim(): void }

// ✅ 可以多实现
class Duck implements Flyable, Swimmable {
  fly() {}
  swim() {}
}

// ❌ 不能多继承
class Duck extends Bird, Fish { }   // 报错
```

**⚠️ 关键：`implements` 编译后完全不生成代码**

```ts
// 输入
interface Animal { name: string }
class Dog implements Animal { name = 'dog' }

// 输出（implements 那部分消失了）
class Dog {
  constructor() {
    this.name = 'dog';
  }
}
```

**所以「用 interface 约束类」是零运行时成本的**——这也是「面向接口编程」在 TS 里很自然的原因。

### 4.9.4 抽象类 vs 接口（常被一起问）

| | `interface` | `abstract class` |
|---|---|---|
| 能否有实现 | ❌ 只有签名 | ✅ **可以有具体方法实现** |
| 能否有构造函数 | ❌ | ✅ |
| 多继承 | ✅ 可以 implements 多个 | ❌ 只能 extend 一个 |
| 运行时存在 | ❌ 完全擦除 | ✅ 生成真实类 |
| 能否有访问修饰符 | ❌ | ✅ `protected` / `private` |
| 适用 | 纯契约、跨类层次 | 有共享实现、模板方法模式 |

```ts
// 抽象类：可以有共享实现
abstract class Shape {
  abstract area(): number;          // 子类必须实现
  describe(): string {              // 共享实现
    return `Area is ${this.area()}`;
  }
}

class Circle extends Shape {
  constructor(private r: number) { super(); }
  area() { return Math.PI * this.r ** 2; }
}
```

**选择**：需要共享代码用抽象类，只需要契约用接口，两者可以同时用（`class A extends Base implements IFoo`）。

### 4.9.5 一个进阶技巧：用接口约定「可被 new 的东西」

```ts
// 泛型工厂：传入类本身，返回实例
function createForm<T>(FormClass: new () => T): T {
  return new FormClass();
}

// 更完整的版本（带参数）
function createWith<T, A extends any[]>(
  Ctor: new (...args: A) => T,
  ...args: A
): T {
  return new Ctor(...args);
}

const u = createWith(User, 'alice', 18);   // ✅ 参数类型也被检查
```

**这个技巧在写工厂、依赖注入、ORM 时非常常用。**

---

## 4.10 常见坑

| 坑 | 正确说法 |
|---|---|
| **「type 不能被 implements」** | ❌ 对象类型的 type 可以；只有联合/原始类型不行 |
| **以为 `extends` 和 `&` 完全等价** | 冲突时 `extends` 报错、`&` 变 `never`（难排查） |
| **以为 `interface` 和 `type` 只差语法** | 声明合并、能表示的类型范围完全不同 |
| **用 `type` 给对象起别名后就无法扩展** | 实际上第三方也扩展不了你的 `type`（除非改成 interface） |
| **以为 `implements` 会继承实现** | ❌ 只检查形状，**编译后完全消失**；要继承实现用 `extends` |
| **`implements` 能约束静态方法** | ❌ 只约束实例侧；静态侧要单独定义构造签名接口 |
| **无脑优先 interface（因为性能）** | 性能差异只在「深嵌套类型组合」时明显，普通业务无感 |
| **`interface` 同名合并是好事** | ⚠️ 也会带来意外污染（第三方库同名接口被你的定义影响） |
| **`type` 能做声明合并** | ❌ 同名直接报 `Duplicate identifier` |

---

## 4.11 答题模板

### 30 秒版（interface vs type）

> 描述对象形状时两者 95% 重叠，真正的差异有四条。
> **第一，能表示的范围**：interface 只能描述对象形状，type 能表示任意类型——联合、元组、原始类型别名、条件类型、映射类型这些只有 type 能做。
> **第二，声明合并**：同名 interface 会自动合并，同名 type 会报错。这个能力主要用于**扩展第三方库的类型**，比如给 `window` 加全局变量、给 Express 的 Request 加字段。
> **第三，冲突处理**：`extends` 遇成员冲突会编译报错并指出是哪两个属性，而 `&` 交叉会静默地变成 `never`，报错不指向冲突点，很难排查。
> **第四，性能**：interface 会创建有名字的类型实体、能被缓存，type 的交叉每次都要重新展开，深嵌套时编辑器会卡。
> 我的约定是：对象用 interface，其余用 type。

### 30 秒版（类类型接口）

> 接口不只约束对象，也能约束类——用 `class Dog implements Animal` 表达「Dog 的实例必须满足 Animal 的形状」。
> 三个要点：**一是 `implements` 只检查实例侧，不检查静态方法和构造函数**，要约束构造器得单独定义 `new (...) => T` 的接口；**二是 `implements` 编译后完全消失**，不生成任何代码，所以是零运行时成本的；**三是 `implements` 可以多个，`extends` 只能一个，而且 `implements` 不继承实现**。

### 2 分钟版（完整版）

> 我按「差异、选择、类接口」三块讲。
>
> **差异**，四条。第一条是能表示的范围：interface 只能描述对象形状，虽然可以写函数签名、构造签名、索引签名，但**不能表示联合、元组、原始类型别名、条件类型、映射类型**——这些只有 type 能做。所以一旦你要写 `type Status = 'a' | 'b'` 或者 `type Id = string`，就只有 type 一条路。
>
> 第二条是声明合并：同名 interface 自动合并，同名 type 报错。这条的真实价值不是「自己写两个同名接口」，而是**扩展别人的类型**——给 window 加全局变量要写 `declare global { interface Window { ... } }`，给 vue-router 的 RouteMeta 加字段要写 `declare module 'vue-router' { interface RouteMeta { ... } }`。这些场景 type 完全做不到，因为你改不了别人的源码。
>
> 第三条是冲突处理，这个最实用但最少人知道：`interface A extends B, C` 如果 B 和 C 有同名但类型不同的属性，编译会**直接报错并指出是哪两个属性冲突**；而 `type A = B & C` 不报错，那个属性会**静默变成 never**，因为 `string & number` 的交集是空集。后果是后面所有赋值都报「不能赋给 never」，但报错完全不指向真正的冲突点，排查很痛苦。
>
> 第四条是性能：interface 创建有名字的类型实体，TS 能缓存；type 的交叉是匿名组合，每次引用都要重新展开。所以几十层嵌套时编辑器会卡。但普通业务代码感知不到，不建议为这个纠结。
>
> **选择**上，我的约定是「对象用 interface，其他用 type」，对外导出的 API 优先 interface 因为使用方可能需要扩展。
>
> **类接口**这块，三个要点。一是 `implements` 只检查实例侧——静态方法和构造函数不在约束范围，要约束构造器得写 `interface Ctor { new (): T }` 这样的构造签名接口。二是 `implements` **编译后完全消失**，不生成任何代码，所以是零运行时成本的。三是 `implements` 和 `extends` 的语义区别：`implements` 是「我承诺有这些成员」，只检查不继承；`extends` 是「我是它的子类」，会继承实现。`implements` 可以多个，`extends` 只能一个。如果既需要共享实现又需要契约，就用 `class A extends Base implements IFoo`。

### 追问表

| 追问 | 回答要点 |
|---|---|
| interface 和 type 的核心差异 | 声明合并 / 能表示范围 / 冲突处理 / 性能 |
| type 能 implements 吗 | 能，对象类型的 type 可以；联合、原始类型不行 |
| interface 能表示联合类型吗 | 不能，只有 type 可以 |
| 声明合并有什么用 | 扩展第三方库类型、给 window 加字段、模块增强 |
| `extends` 和 `&` 冲突时差别 | 前者报错并指出冲突属性；后者变 `never`，难排查 |
| 为什么 `&` 会变 never | `string & number` 交集为空集 |
| interface 性能为什么更好 | 创建 named type，可缓存；交叉每次重新计算 |
| 性能差异什么时候重要 | 深嵌套类型组合、类型体操；普通业务无感 |
| implements 会继承实现吗 | 不会，只检查形状，编译后消失 |
| implements 能约束静态方法吗 | 不能，只约束实例侧 |
| 怎么约束构造函数 | `interface Ctor { new (...args): T }` 或 `type Ctor<T> = new () => T` |
| implements 能多个吗 | 能；`extends` 只能一个类 |
| interface 和抽象类怎么选 | 要共享实现用抽象类，纯契约用接口，可同时用 |
| interface 能 extends class 吗 | 能，只继承形状（含 private），用途是「只有子类能满足」 |

---

## 4.12 速记卡

```
四条真实差异
  ① 能表示：interface 只描述对象；type 能表示任意类型（联合/元组/原始/条件/映射）
  ② 声明合并：interface 同名合并；type 同名报错
  ③ 冲突：extends 报错并指出属性；& 静默变 never（难排查）
  ④ 性能：interface 有 named type 缓存；交叉每次重算

interface 独有
  声明合并 → 扩展三方库（declare global / declare module）
  extends class（继承形状含 private，用于「只有子类能满足」）

type 独有
  联合 / 元组 / 原始类型别名 / 条件类型 / 映射类型 / 模板字面量

两者都能
  描述对象 / 泛型 / 索引签名 / 函数签名 / 被 implements / extends（各自写法）

纠正一个错误说法
  ✗「type 不能被 implements」
  ✓ 对象类型、交叉类型都能；只有联合类型和原始类型不能

类类型接口
  implements = 承诺形状，不继承实现，编译后完全消失（零运行时成本）
  只检查实例侧，静态方法和构造函数不检查 → 要写 new (...) => T
  可多个 implements；extends 只能一个
  抽象类 vs 接口：要共享实现用抽象类，纯契约用接口
```
