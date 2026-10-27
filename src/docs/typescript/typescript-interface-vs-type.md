# TS · 04 interface 与 type

> 覆盖：`interface` 与 `type` 的能力边界、扩展与冲突、声明合并、`implements`、类类型接口。
> 两个容易说错的点：对象类型的 `type` 也能被 `implements`；`extends` 冲突编译报错，`&` 冲突把属性变成 `never`。

---

## 目录

- [4.1 一句话结论](#41-一句话结论)
- [4.2 七个维度完整对比](#42-七个维度完整对比)
- [4.3 差异一：能表示什么（这是最本质的）](#43-差异一能表示什么这是最本质的)
- [4.4 差异二：扩展方式与「冲突处理」（这条最能体现深度）](#44-差异二扩展方式与冲突处理这条最能体现深度)
- [4.5 差异三：声明合并（`interface` 的杀手级能力）](#45-差异三声明合并interface-的杀手级能力)
- [4.6 差异四：`implements`（这里纠正一个常见错误说法）](#46-差异四implements这里纠正一个常见错误说法)
- [4.7 差异五：性能（真实存在，但别过度强调）](#47-差异五性能真实存在但别过度强调)
- [4.8 决策树（怎么选）](#48-决策树怎么选)
- [4.9 类类型接口](#49-类类型接口)
- [4.10 常见坑](#410-常见坑)
- [4.11 答题模板](#411-答题模板)
- [4.12 速记卡](#412-速记卡)

---

## 4.1 一句话结论

**`interface` 和 `type` 描述对象形状时能力高度重叠**，差异集中在四条：
**① `interface` 能声明合并，`type` 不能；② 联合/元组/条件/映射等非对象类型只能用 `type`；③ `extends` 遇冲突报错，`&` 遇冲突把属性变成 `never`；④ 深层组合时 `interface` 的成员关系可复用，性能更好。**
**约定：描述对象/类的形状用 `interface`，联合、工具类型、函数别名用 `type`。**

---

## 4.2 七个维度完整对比

| # | 维度 | `interface` | `type` |
|---|---|---|---|
| 1 | **能表示什么** | 只能描述**对象形状**（含函数、构造器、索引签名） | **任意类型**（联合、元组、原始类型、条件、映射、模板字面量） |
| 2 | **扩展方式** | `extends A, B`（可多个） | `A & B`（交叉类型） |
| 3 | **声明合并** | ✅ **同名自动合并** | ❌ 同名报错 |
| 4 | **同名且成员类型冲突** | ✅ 合并时报 `TS2717` | ❌ 先报 `Duplicate identifier` |
| 5 | **冲突处理** | `extends` 时成员冲突 → **`TS2320`** | `&` 交叉 → **属性静默变 `never`** |
| 6 | **能被 `implements`** | ✅ | ✅ 对象/交叉（先起别名）/映射/已实例化条件；联合、原始类型、未实例化条件、函数类型 ❌ |
| 7 | **性能** | ✅ 命名类型，成员关系可复用 | ⚠️ 交叉/联合按需展开，深嵌套组合更慢 |

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

// ❌ 不能表示联合（语法错误 TS1005）
interface Bad = string | number;

// ❌ 不能给原始类型起别名（语法错误）
interface Id = string;

// ❌ 不能表示元组（语法错误）
interface Pair = [string, number];
```

### 4.3.2 `type` 什么都能表示

```ts
type User = { name: string };
declare const someValue: { id: number };

type Id = string;                              // 原始类型别名
type Status = 'idle' | 'loading' | 'done';     // 联合
type Pair = [string, number];                  // 元组
type Nullable<T> = T | null;                   // 泛型 + 联合
type Keys = keyof User;                        // 索引类型
type Fn = (x: number) => string;               // 函数
type Obj = { a: string } & { b: number };      // 交叉
type IsString<T> = T extends string ? true : false;   // 条件类型
type Mapped<T> = { [K in keyof T]: T[K] };     // 映射类型
type EventName = `on${Capitalize<string>}`;    // 模板字面量类型
type T = typeof someValue;                     // typeof 的结果
type U = User['name'];                         // 索引访问
```

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
// ✅ 不报错

const c: C2 = { x: 1 };     // ❌ TS2322: Type 'number' is not assignable to type 'never'
const d: C2 = { x: 'a' };   // ❌ TS2322: Type 'string' is not assignable to type 'never'
```

| | 行为 | 原因 |
|---|---|---|
| `extends` | **检查兼容性并报错** | `extends` 的语义是「C 是 A 和 B 的子类型」，成员冲突就不可能成立 |
| `&` | **取交集** | `string & number` 的交集是空集，所以属性类型是 `never` |

**实测（TypeScript 6.0.3）**：

```
① interface C extends A, B  →
   error TS2320: Interface 'C' cannot simultaneously extend types 'A' and 'B'.
                 Named property 'x' of types 'A' and 'B' are not identical.

② type C2 = A2 & B2  →  不报错
   const c: C2 = { x: 'a' }  →
   error TS2322: Type 'string' is not assignable to type 'never'.
```

类型或修饰符不一致都算冲突；`&` 的报错落在后续赋值处，不指向冲突字段：

```ts
type ConfigByIntersection = BaseConfig & OverrideConfig;
// 字段冲突 → 属性变 never → 后续赋值报 TS2322

interface ConfigByExtends extends BaseConfig, OverrideConfig {}
// → TS2320，直接指出冲突属性
```

### 4.4.3 `interface` 还能 `extends` 一个类

```ts
class Control {
  private state: any;
  select(): void {}
}

// interface 可以继承 class（只继承「形状」，不继承实现）
interface SelectableControl extends Control {
  select(): void;
}

// 因为 Control 有 private 成员，只有 Control 的子类才能实现这个接口
class Button extends Control implements SelectableControl {
  select() {}
}

class MyImage implements SelectableControl {
  private state: any;    // ❌ TS2420: Types have separate declarations of a private property 'state'
  select() {}
}
```

`extends` 右侧可以是类，这是 `interface` 的语法能力；`type` 没有 `extends`，等价约束写成 `type SelectableControlByType = Control & { select(): void }`，同样只有 `Control` 的子类能满足（private 成员必须来自同一处声明）。

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
// ❌ TS2300: Duplicate identifier 'User'
```

### 4.5.2 声明合并的三个真实用途

**用途 ①：扩展第三方库的类型**

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

三个用途都依赖声明合并；`type` 无法被其他模块补充。

### 4.5.3 声明合并的坑

```ts
// 合并是「无条件」的，第三方同名接口也会参与
interface Config {
  debug: boolean;
}

// 某个第三方库也定义了 Config
interface Config {
  debug: string;     // ❌ TS2717: Subsequent property declarations must have the same type
}

// 库里的同名属性类型不同时同样报错
interface Window {
  status: number;    // ❌ TS2717: lib.dom 中 window.status 是 string
}
```

---

## 4.6 差异四：`implements`（这里纠正一个常见错误说法）

### 4.6.1 常见错误说法

> ❌「interface 可以被 class implements，type 不行。」

对象类型的 `type` 也可以被 `implements`：

```ts
type Animal = {
  name: string;
  speak(): void;
};

class Dog implements Animal {      // ✅ 合法
  name = 'dog';
  speak() { console.log('woof'); }
}
```

### 4.6.2 准确的规则

**`implements` 的右侧必须是对象类型或对象交叉类型，且类实例真的具备这些成员**：

| 被实现的类型 | 能否 `implements` |
|---|---|
| `interface` | ✅ |
| `type` 对象类型 / 映射类型 | ✅ |
| `type` 交叉类型（先起别名） | ✅ |
| `type` 已实例化的条件类型 | ✅ |
| `type` 联合类型（`A \| B`） | ❌ `TS2422` |
| `type` 原始类型（`type Id = string`） | ❌ `TS2422` |
| `type` 未实例化的泛型条件类型 | ❌ `TS2422` |
| 函数类型（实例没有调用签名） | ❌ `TS2420` |

```ts
// ❌ 联合类型不能 implements
type Shape = { kind: 'a' } | { kind: 'b' };
class S implements Shape { }        // TS2422: A class can only implement an object type
                                   //         or intersection of object types with statically known members

// ❌ 不能直接写 implements A & B
type Named = { name: string };
type Aged = { age: number };
class P implements Named & Aged { } // TS1005: ',' expected

// ✅ 先起别名，或写成 implements A, B
type Person = Named & Aged;
class P2 implements Person { }
class P3 implements Named, Aged { }
```

---

## 4.7 差异五：性能（真实存在，但别过度强调）

### 4.7.1 为什么有性能差异

**`interface` 会创建一个「命名的类型实体」，成员关系可以复用。**
**`type` 的交叉/联合是「匿名组合」，使用时需要展开成员。**

```
interface A { a: 1 }        → 创建命名类型 "A"
interface B { b: 2 }
interface C extends A, B {} → C 引用 A、B 的成员关系

type A2 = { a: 1 }
type B2 = { b: 2 }
type C2 = A2 & B2           → C2 是交叉类型，使用时展开成员
```

### 4.7.2 什么时候真的会慢

| 场景 | 影响 |
|---|---|
| 几十层的交叉类型嵌套 | 编辑器补全变慢、类型检查变慢 |
| 大对象上的映射类型（`DeepPartial<BigType>`） | 计算量增大 |
| 递归条件类型（类型体操） | 可能触发「Type instantiation is excessively deep」 |
| 普通业务代码 | **通常无感** |

这些差异只在大型类型组合时考虑，不作为普通对象定义的选择依据。

---

## 4.8 决策树（怎么选）

```
要定义的东西是「对象形状」吗？
├─ 是
│   ├─ 需要被第三方扩展 / 声明合并？ → interface
│   ├─ 需要 class implements？        → interface 或 type 都行
│   ├─ 需要 extends 多个且希望冲突报错？→ interface
│   └─ 其他情况                        → 跟团队约定（大多选 interface）
└─ 否（联合 / 元组 / 原始类型 / 条件 / 映射 / 函数别名）
    └─ → type（没得选）
```

**团队约定**：

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

```ts
interface Animal {
  name: string;
  speak(): void;
}

class Dog implements Animal {
  static createDefault(): Animal { return new Dog(); }   // 静态方法不在接口约束范围
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

const Factory: AnimalConstructor = Dog;   // Dog 必须可赋值给 AnimalConstructor
```

**构造函数类型**：

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
| 语义 | 「类**承诺**具备这些成员」 | 「类**是**父类的子类，继承实现」 |
| 是否继承实现 | ❌ **只检查，不继承任何代码** | ✅ 继承属性、方法、实现 |
| 能否多继承 | ✅ 可以 `implements A, B` | ❌ 只能 `extends` 一个类 |
| 编译后 | **完全消失**（`implements` 是纯类型） | ES2015+ 生成 `class X extends Y`；ES5 生成 `__extends` 辅助函数 |
| 能否访问父类方法 | ❌ 不能（implements 不提供父类） | ✅ 可以，还能 `super.xxx()` |
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
class Mallard extends Bird, Fish { }   // TS1174: Classes can only extend a single class
```

**`implements` 编译后完全不生成代码**：

```ts
// 输入
interface Animal { name: string }
class Dog implements Animal { name = 'dog' }

// 输出（target ES2022，implements 那部分消失了）
class Dog {
  name = 'dog';
}
```

因此 `implements` 是零运行时成本。

### 4.9.4 抽象类 vs 接口（常被一起问）

| | `interface` | `abstract class` |
|---|---|---|
| 能否有实现 | ❌ 只有签名 | ✅ **可以有具体方法实现** |
| 能否有构造函数实现 | ❌（只能写构造签名） | ✅ |
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

适用场景：工厂、依赖注入、ORM 的类注册。

---

## 4.10 常见坑

- `type` 别名不能被声明合并扩展：第三方无法给它补字段，需要被扩展时改用 `interface`。
- `interface` 合并是全局的：同名第三方接口会参与合并，属性类型不一致时报 `TS2717`。
- `implements` 只检查实例侧，也不继承实现；静态/构造侧要单独写构造签名接口。

---

## 4.11 答题模板

### 30 秒版（interface vs type）

- **能表示的范围**：`interface` 只能描述对象形状；联合、元组、原始类型别名、条件、映射、模板字面量只能用 `type`。
- **声明合并**：同名 `interface` 自动合并，属性类型冲突报 `TS2717`；同名 `type` 报 `Duplicate identifier`。
- **冲突处理**：`extends` 冲突报 `TS2320` 并指出属性；`&` 冲突把属性变成 `never`，赋值处报 `TS2322`。
- **性能**：`interface` 是命名类型，成员关系可复用；交叉类型使用时展开，深嵌套组合才需要考虑。
- **约定**：对象用 `interface`，其余用 `type`。

### 30 秒版（类类型接口）

- `implements` 只检查实例侧；静态成员和构造函数要单独写 `new (...) => T` 或构造签名接口。
- `implements` 编译后擦除，不产生运行时代码。
- `implements` 可多个，不继承实现；`extends` 只能一个，会继承实现。

### 2 分钟版（完整版）

- **能表示什么**：`interface` 只能写对象形状（含函数、构造、索引签名）；联合、元组、原始类型别名、条件、映射、模板字面量只有 `type` 能声明。
- **声明合并**：同名 `interface` 合并，属性类型不一致报 `TS2717`；同名 `type` 报 `Duplicate identifier`。用途是用 `declare global` 扩展 `Window`、用 `declare module` 扩展第三方库接口。
- **冲突处理**：`interface extends A, B` 冲突报 `TS2320` 并指出属性；`type A & B` 冲突把属性变成 `never`，报错落在后续赋值（`TS2322`）。
- **类接口**：`implements` 只查实例侧、编译后擦除、可多个且不继承实现；构造侧用 `interface { new (...): T }` 约束。

---

## 4.12 速记卡

```
四条差异
  能表示：interface 只描述对象；type 能表示任意类型
  声明合并：interface 合并（冲突 TS2717）；type 重复声明报错
  冲突：extends 报 TS2320；& 把属性变 never（TS2322）
  性能：interface 命名类型可复用；交叉/联合使用时展开

interface 独有
  声明合并 → 扩展三方库（declare global / declare module）
  extends class 语法（等价约束可用 type 交叉）

type 独有
  联合 / 元组 / 原始类型别名 / 条件 / 映射 / 模板字面量

implements
  可用：interface、对象 type、交叉（先别名）、映射、已实例化条件
  不可用：联合/原始类型（TS2422）、未实例化条件（TS2422）、函数类型（TS2420）
  只查实例侧；编译后擦除；可多个；构造侧写 new (...) => T
```
