# TS · 07 装饰器与 mixin

> 本册覆盖：装饰器、mixin
> 题单只说「需要开启 `experimentalDecorators`」——**这句话在 2023 年之后已经不完整了**。
> **TS 5.0 支持了 TC39 Stage 3 标准装饰器，不需要任何 flag，而且和旧版 `experimentalDecorators` 完全不兼容。** 这是现在最高频的坑，也是本册的重点。

---

## 目录

- [7.1 一句话结论](#71-一句话结论)
- [7.2 装饰器是什么（先讲清本质）](#72-装饰器是什么先讲清本质)
- [7.3 【重点】两套标准：TS 5.0 的分水岭](#73-重点两套标准ts-50-的分水岭)
- [7.4 五种装饰器（旧版，题 42 的答法）](#74-五种装饰器旧版题-42-的答法)
- [7.5 执行顺序（高频细节题）](#75-执行顺序高频细节题)
- [7.6 编译产物（理解「它会生成代码」）](#76-编译产物理解它会生成代码)
- [7.7 实际应用场景（要答的）](#77-实际应用场景要答的)
- [7.8 mixin](#78-mixin)
- [7.9 常见坑](#79-常见坑)
- [7.10 答题模板](#710-答题模板)
- [7.11 速记卡](#711-速记卡)

---

## 7.1 一句话结论

**装饰器**是一个 `@expression` 语法的特殊声明，用来在**类、方法、属性、访问器**上附加元信息或改写行为。它的本质是**一个在类定义时被调用的函数**。
**mixin** 是「用类工厂把多个类的成员组合到一个类上」的模式——因为 JS/TS 只支持单继承，mixin 是「多继承」的替代方案。

---

## 7.2 装饰器是什么（先讲清本质）

### 7.2.1 语法

```ts
@sealed                    // 装饰器
class Greeter {
  @readonly                // 属性装饰器
  name = 'world';

  @log                     // 方法装饰器
  greet() {}
}
```

### 7.2.2 本质：它是「编译期语法糖」，展开成函数调用

```ts
// 输入
@sealed
class Greeter {}

// 输出（旧版，简化）
let Greeter = class Greeter {};
Greeter = __decorate([sealed], Greeter);
```

**所以装饰器不是「注解」，是「在类定义时执行的函数」**——它会真的运行代码。

### 7.2.3 一个最小可运行的例子

```ts
function sealed(target: Function) {
  Object.seal(target);
  Object.seal(target.prototype);
}

@sealed
class Greeter {
  name = 'world';
}

Object.isSealed(Greeter);   // true ← 装饰器真的执行了
```

---

## 7.3 【重点】两套标准：TS 5.0 的分水岭

**这是本册最重要的内容，也是现在面试最容易踩的坑。**

### 7.3.1 两套标准对比

| | **旧版（`experimentalDecorators`）** | **新版（Stage 3 标准，TS 5.0+）** |
|---|---|---|
| 提案阶段 | TC39 **Stage 1**（早期草案） | TC39 **Stage 3**（即将标准化） |
| TS 支持 | TS 1.5 起 | **TS 5.0 起** |
| 是否需要 flag | ✅ `"experimentalDecorators": true` | ❌ **不需要，默认开启** |
| 参数签名 | `(target, key, descriptor)` | `(value, context)` |
| **参数装饰器** | ✅ 支持 | ❌ **不支持**（Stage 3 移除了） |
| 元数据反射 | ✅ `emitDecoratorMetadata` + `reflect-metadata` | ❌ 不支持（需 `Symbol.metadata`） |
| 谁在用 | **Angular、NestJS、TypeORM、InversifyJS** | 新的库（如 Lit、部分新框架） |
| 兼容性 | 事实标准，生态庞大 | 标准化方向，生态在迁移 |

### 7.3.2 两者**完全不兼容**

```
开 experimentalDecorators: true
    → 用旧版语义
    → 新版写法的装饰器会报类型错误

不开 experimentalDecorators
    → 用新版（Stage 3）语义
    → 现有 Angular/NestJS 生态的装饰器会全部报错
```

**这就是为什么「升级 TS 5.0 后装饰器报错」成了常见问题**——如果项目原来没开 `experimentalDecorators` 但有装饰器代码，升级后语义变了。

### 7.3.3 签名对比（看代码最直观）

**旧版**：

```ts
// 类装饰器
function classDec(target: Function) {}

// 方法装饰器
function methodDec(
  target: any,                    // 类的 prototype
  propertyKey: string,
  descriptor: PropertyDescriptor
) {}

// 属性装饰器
function propDec(target: any, propertyKey: string) {}

// 参数装饰器（★ 旧版独有）
function paramDec(target: any, propertyKey: string, index: number) {}
```

**新版（Stage 3）**：

```ts
// 类装饰器
function classDec(value: Function, context: ClassDecoratorContext) {}

// 方法装饰器
function methodDec(
  value: Function,
  context: ClassMethodDecoratorContext
) {}

// 字段装饰器
function fieldDec(
  value: undefined,
  context: ClassFieldDecoratorContext
) {}
// ★ 没有参数装饰器
```

**三个关键差异**：

| 差异 | 旧版 | 新版 |
|---|---|---|
| 第二个参数 | `propertyKey`（字符串） | **`context` 对象**（含 `kind`、`name`、`static`、`private`、`access`、`addInitializer`） |
| 修改行为的方式 | 直接改 `descriptor` | **返回一个新的函数/值**（更函数式） |
| 初始化钩子 | 无 | **`context.addInitializer()`** |

### 7.3.4 `context.addInitializer`（新版独有的好用法）

```ts
function bound(value: Function, context: ClassMethodDecoratorContext) {
  // 新版：每个实例创建时执行
  context.addInitializer(function (this: any) {
    this[context.name] = this[context.name].bind(this);
  });
  return value;
}

class Button {
  label = 'click';

  @bound
  handleClick() {
    console.log(this.label);    // ✅ this 正确绑定
  }
}

const b = new Button();
const fn = b.handleClick;
fn();      // ✅ 不会丢 this
```

**这比旧版优雅得多**——旧版要在 descriptor 里改 `value`，还要自己处理 prototype 和 instance 的差异。

### 7.3.5 怎么选

| 场景 | 选择 |
|---|---|
| 用 Angular / NestJS / TypeORM | **必须旧版**（`experimentalDecorators: true`），它们的装饰器依赖 `reflect-metadata` |
| 新项目、自己写装饰器 | 新版（Stage 3），更标准、更类型安全 |
| 库作者 | 两套都支持，或者明确声明要求 |

**在 `tsconfig` 里怎么配**：

```json
// 旧版（Angular/NestJS 项目）
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}

// 新版（Stage 3）
{
  "compilerOptions": {
    // 什么都不用加！TS 5.0+ 默认支持
  }
}
```

> **面试话术**：「装饰器现在有两套标准。旧版是 `experimentalDecorators`，基于 TC39 Stage 1 提案，Angular、NestJS、TypeORM 都用它，签名是 `(target, key, descriptor)`，还支持参数装饰器和 `reflect-metadata`。TS 5.0 加了 Stage 3 标准装饰器，**不需要任何 flag**，签名改成 `(value, context)`，更函数式，还有 `addInitializer` 钩子，但**不支持参数装饰器**。两套完全不兼容——同一个项目里只能选一套，靠 `experimentalDecorators` 开关切换。」

---

## 7.4 五种装饰器（旧版，题 42 的答法）

> 下面都按**旧版**讲，因为这是目前生态的主流（Angular/NestJS）。

### 7.4.1 类装饰器

```ts
function singleton<T extends new (...args: any[]) => any>(target: T) {
  let instance: InstanceType<T>;
  return new Proxy(target, {
    construct(t, args, newTarget) {
      if (!instance) instance = Reflect.construct(t, args, newTarget);
      return instance;
    },
  }) as T;
}

@singleton
class Config {
  constructor(public env = 'dev') {}
}

new Config() === new Config();   // true（单例）
```

**用途**：注册类、加静态属性、单例、冻结、替换构造函数。

### 7.4.2 方法装饰器（最常用）

```ts
function log(
  target: any,
  key: string,
  descriptor: PropertyDescriptor
) {
  const original = descriptor.value;

  descriptor.value = function (...args: any[]) {
    console.log(`→ ${key}(${JSON.stringify(args)})`);
    try {
      const result = original.apply(this, args);
      console.log(`← ${key}: ${result}`);
      return result;
    } catch (e) {
      console.error(`✗ ${key}:`, e);
      throw e;
    }
  };

  return descriptor;
}

class Calculator {
  @log
  add(a: number, b: number) { return a + b; }
}

new Calculator().add(1, 2);
// → add([1,2])
// ← add: 3
```

**用途**：日志、性能计时、权限校验、缓存、重试、事务。

### 7.4.3 属性装饰器

```ts
function defaultValue(value: unknown) {
  return function (target: any, key: string) {
    // ⚠️ 属性装饰器【不能】直接改初始值（此时实例还不存在）
    // 只能记录信息，在别处（比如类装饰器）读取并应用
    Object.defineProperty(target, key, {
      get() { return value; },
      configurable: true,
    });
  };
}

class Config {
  @defaultValue('localhost')
  host!: string;
}
```

**⚠️ 重要限制**：属性装饰器的 `target` 是**类的 prototype**（实例属性）或**构造函数**（静态属性），**此时实例还不存在**，所以不能直接改实例的属性值。

**要改实例属性，得用「属性装饰器记录信息 + 类装饰器应用」的模式**，或者在 `constructor` 里处理：

```ts
// 用 Symbol 记录默认值，在构造函数里应用
const DEFAULTS = Symbol('defaults');

function defaultValue(v: unknown) {
  return (target: any, key: string) => {
    (target[DEFAULTS] ??= {})[key] = v;
  };
}

function applyDefaults<T extends new (...args: any[]) => any>(target: T) {
  return class extends target {
    constructor(...args: any[]) {
      super(...args);
      const defaults = (target.prototype as any)[DEFAULTS];
      if (defaults) {
        for (const k in defaults) {
          if (this[k] === undefined) this[k] = defaults[k];
        }
      }
    }
  };
}
```

**这就是为什么很多库（比如 class-validator）会要求同时用类装饰器**。

### 7.4.4 访问器装饰器（getter/setter）

```ts
function enumerable(value: boolean) {
  return function (
    target: any,
    key: string,
    descriptor: PropertyDescriptor
  ) {
    descriptor.enumerable = value;
  };
}

class Point {
  private _x = 0;

  @enumerable(false)
  get x() { return this._x; }
}
```

**访问器装饰器和方法装饰器签名相同**，只是作用于 `get`/`set`。

### 7.4.5 参数装饰器（★ 旧版独有）

```ts
function inject(token: string) {
  return function (
    target: any,          // prototype
    key: string | undefined,  // 方法名（构造函数参数时是 undefined）
    index: number         // 参数在参数列表中的位置
  ) {
    // 记录「第 index 个参数需要注入 token 对应的实例」
    const deps = Reflect.getMetadata('deps', target, key) || [];
    deps[index] = token;
    Reflect.defineMetadata('deps', target, key, deps);
  };
}

class UserService {
  constructor(
    @inject('db') private db: Database,
    @inject('logger') private logger: Logger,
  ) {}
}
```

**这就是 Angular/NestJS 依赖注入的核心机制**——参数装饰器记录依赖，`reflect-metadata` 存元数据，容器在实例化时读取并注入。

**⚠️ Stage 3 装饰器不支持参数装饰器**，所以 Angular/NestJS 暂时无法迁移到新标准。

---

## 7.5 执行顺序（高频细节题）

### 7.5.1 同一个目标上的多个装饰器：从下往上

```ts
@f
@g
class A {}

// 等价于 f(g(A))
// 求值（表达式）：从上往下 → 先算 f，再算 g
// 执行（函数调用）：从下往上 → 先执行 g 的结果，再执行 f
```

**记忆：「表达式从上往下求值，函数从下往上执行」**。

### 7.5.2 不同类型的装饰器：参数 → 方法/属性 → 类

```ts
@classDec
class A {
  @methodDec
  method(@paramDec p: string) {}
}

new A();
// 执行顺序：
// 1. paramDec（参数装饰器）
// 2. methodDec（方法装饰器）
// 3. classDec（类装饰器）
```

### 7.5.3 完整示例（值得手算一遍）

```ts
function log(name: string) {
  console.log('evaluate:', name);          // 求值时打印
  return (...args: any[]) => {
    console.log('execute:', name);          // 执行时打印
  };
}

@log('class')
class Demo {
  @log('prop')
  prop = 1;

  @log('method')
  method(@log('param') p: string) {}
}
```

**输出**：

```
evaluate: class        ← 先对整段代码求值（从上往下）
evaluate: prop
evaluate: method
evaluate: param
execute: param         ← 然后执行（从内到外、从下往上）
execute: method
execute: prop
execute: class
```

**为什么 `evaluate: class` 最先**：因为装饰器表达式在类定义**之前**就要求值（就像函数调用要先算参数）。然后才是执行阶段。

> 这个顺序题在面试里能问倒大部分人。**记住两句：`evaluate` 自上而下，`execute` 自下而上（且参数最内层最先）。**

---

## 7.6 编译产物（理解「它会生成代码」）

### 7.6.1 类和方法装饰器

```ts
// 输入
@sealed
class Greeter {
  @enumerable(false)
  greet() {}
}
```

```js
// 输出（target: ES2015，简化）
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length,
        r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc,
        d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") {
        r = Reflect.decorate(decorators, target, key, desc);
    } else {
        for (var i = decorators.length - 1; i >= 0; i--) {
            if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        }
    }
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};

let Greeter = class Greeter {
    greet() { }
};
__decorate([
    enumerable(false)
], Greeter.prototype, "greet", null);
Greeter = __decorate([
    sealed
], Greeter);
```

**注意 `for (var i = decorators.length - 1; i >= 0; i--)`**——这就是「从下往上执行」的实现。

### 7.6.2 元数据反射（`emitDecoratorMetadata`）

```ts
// 开 emitDecoratorMetadata 后
class UserService {
  constructor(@inject() private db: Database) {}
}
```

```js
// 会额外生成 __metadata
__decorate([
    inject(),
    __metadata("design:paramtypes", [Database])   // ← 参数类型被保留到运行时！
], UserService);
```

**这是 Angular/NestJS 依赖注入能工作的关键**：平时类型是被擦除的，但**装饰器 + `emitDecoratorMetadata` 会把类型信息写进元数据**。

```ts
// 配合 reflect-metadata 读取
Reflect.getMetadata('design:paramtypes', UserService);
// [Database]
```

**三个可用的元数据键**：

| 键 | 内容 |
|---|---|
| `design:type` | 属性/参数的类型 |
| `design:paramtypes` | 方法/构造函数的参数类型数组 |
| `design:returntype` | 返回值类型 |

**⚠️ 限制**：只能记录「有运行时值的类型」（类、构造函数）。**`interface`、`type`、泛型、联合类型都拿不到**（因为它们被擦除了）。

```ts
class S {
  constructor(private repo: Repository<User>) {}   // ❌ 泛型信息拿不到
  // design:paramtypes 里只有 Repository，没有 User
}
```

> **这是 TS 装饰器的一个根本限制**：类型擦除 + 元数据类型有限。所以 NestJS 里注入泛型接口必须用 `@Inject('TOKEN')` 显式指定。

---

## 7.7 实际应用场景（要答的）

| 场景 | 例子 |
|---|---|
| **依赖注入** | Angular `@Injectable()`、NestJS `@Controller()` / `@Injectable()` |
| **路由声明** | NestJS `@Get('/users')`、`@Post()` |
| **ORM 实体** | TypeORM `@Entity()` / `@Column()`、Sequelize `@Table` |
| **参数校验** | class-validator `@IsEmail()` / `@MinLength(6)` |
| **权限控制** | `@Roles('admin')` + 守卫读取元数据 |
| **日志/计时** | `@Log()` 包裹方法 |
| **缓存** | `@Cacheable(60)` |
| **重试** | `@Retry(3)` |
| **事务** | `@Transactional()` |
| **废弃标记** | `@deprecated`（JSDoc，不是 TS 装饰器） |

**一个完整的「权限 + 日志」示例**：

```ts
function Roles(...roles: string[]) {
  return (target: any, key: string, desc: PropertyDescriptor) => {
    Reflect.defineMetadata('roles', roles, desc.value);
  };
}

function RequireRole(currentUser: { role: string }) {
  return (target: any, key: string, desc: PropertyDescriptor) => {
    const original = desc.value;
    desc.value = function (...args: any[]) {
      const roles: string[] = Reflect.getMetadata('roles', original) || [];
      if (roles.length && !roles.includes(currentUser.role)) {
        throw new Error(`Forbidden: requires ${roles.join(' or ')}`);
      }
      return original.apply(this, args);
    };
  };
}

class AdminController {
  @Roles('admin')
  @RequireRole({ role: 'user' })
  deleteAll() { /* ... */ }
}
```

**⚠️ 注意装饰器顺序**：`@Roles` 在上、`@RequireRole` 在下 → **`@RequireRole` 先执行**，此时 `@Roles` 的元数据**还没写入**！

**这是个真实的坑**：需要把写元数据的装饰器放在**下面**（后执行的在上面）。

```ts
// ✅ 正确顺序：写元数据的在下
@RequireRole({ role: 'user' })
@Roles('admin')
deleteAll() {}
```

**这就是为什么必须搞懂执行顺序**——顺序错了逻辑就错了。

---

## 7.8 mixin

### 7.8.1 为什么需要 mixin

**JS/TS 只支持单继承**：

```ts
class A extends B, C {}    // ❌ 语法错误
```

**要复用多个类的实现**，有四种方案：

| 方案 | 特点 |
|---|---|
| **mixin（类工厂）** | 组合实现，**TS 官方推荐** |
| 组合（has-a） | 更灵活，但要多写转发方法 |
| 接口（implements） | 只约束形状，**不提供实现** |
| 装饰器 | 改行为，不是组合成员 |

### 7.8.2 官方推荐的写法

```ts
// ① 定义构造器类型
type Constructor<T = {}> = new (...args: any[]) => T;

// ② 定义 mixin 工厂
function Timestamped<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    timestamp = Date.now();
  };
}

function Activatable<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    isActive = false;
    activate() { this.isActive = true; }
    deactivate() { this.isActive = false; }
  };
}

// ③ 使用
class User {
  constructor(public name: string) {}
}

const SmartUser = Activatable(Timestamped(User));

const u = new SmartUser('alice');
u.name;          // ✅ 'alice'
u.timestamp;     // ✅ 数字
u.activate();    // ✅
u.isActive;      // ✅ true
```

**TS 能自动推导出所有成员的类型**——这是这个写法的最大优势。

### 7.8.3 更常见的写法：class 表达式 + 继承

```ts
class SmartUser extends Activatable(Timestamped(User)) {
  // 可以继续加成员
  greet() { return `Hi, ${this.name}`; }
}

const u = new SmartUser('alice');
u.greet();       // ✅
u.timestamp;     // ✅
u.activate();    // ✅
```

**这个写法的好处**：`SmartUser` 是一个**有名字的类**，可以正常 `new`、可以 `extends`、可以做类型标注。

### 7.8.4 带约束的 mixin（要求基类有某些成员）

```ts
// 要求基类必须有 name: string
function Greetable<TBase extends Constructor<{ name: string }>>(Base: TBase) {
  return class extends Base {
    greet() {
      return `Hello, ${this.name}`;    // ✅ 因为约束保证了 name 存在
    }
  };
}

class Person { constructor(public name: string) {} }
class Robot { constructor(public id: string) {} }

class P extends Greetable(Person) {}     // ✅
class R extends Greetable(Robot) {}      // ❌ 报错：Robot 没有 name
```

**`Constructor<{ name: string }>` 这个约束是关键**——它保证 mixin 内部能安全访问 `this.name`。

### 7.8.5 两个必须知道的限制

**限制 ①：mixin 里的类不能有 `private` / `protected` 成员**

```ts
function Mixin<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    private secret = 1;      // ⚠️ 会导致「两个类有同名 private」的冲突
  };
}

class A extends Mixin(Mixin(Base)) {}
// ❌ 可能报错：Class 'A' incorrectly extends... private 成员来自不同声明
```

**原因**：匿名类的 `private` 成员无法在外部正确合并（回顾 01 册的「结构化类型 + private 必须同源」）。

**解法**：用 `#x`（真私有不受这个限制）或改用 `protected` 配合接口声明。

**限制 ②：多个 mixin 有同名成员时，后面的覆盖前面的**

```ts
function A<T extends Constructor>(B: T) {
  return class extends B { value = 'A'; };
}
function B<T extends Constructor>(B: T) {
  return class extends B { value = 'B'; };
}

class C extends A(B(Base)) {}
new C().value;    // 'A'（外层覆盖内层）
```

### 7.8.6 mixin vs 组合（什么时候不用 mixin）

| | mixin | 组合（has-a） |
|---|---|---|
| 关系 | is-a（伪装） | has-a |
| 类型推导 | 自动 | 需要手写转发 |
| 命名冲突 | 后者覆盖，静默 | 明确（`this.a.foo()`） |
| 调试 | 类名变匿名，堆栈难读 | 清晰 |
| 灵活性 | 编译期确定 | 运行时可替换 |

**我的建议**：**优先用组合**。mixin 只在「确实需要 is-a 关系 + 大量共享方法」时用（比如 Vue 2 的 mixin 就是典型，但也因为命名冲突和来源不清被 Vue 3 的 composable 取代了）。

> **面试话术**：「mixin 用类工厂实现『多继承』：接收一个基类，返回一个继承了它并加上新成员的匿名类。核心是 `type Constructor<T> = new (...args: any[]) => T` 这个构造器类型，加上 `TBase extends Constructor` 的约束，TS 就能自动推导所有成员类型。但有两个限制：mixin 里不能用 `private`/`protected` 成员（会冲突），同名成员会静默覆盖。所以实战里我更倾向用组合而不是 mixin——Vue 2 的 mixin 就因为命名冲突和来源不清，在 Vue 3 里被 composable 取代了。」

---

## 7.9 常见坑

| 坑 | 正确说法 |
|---|---|
| **「装饰器需要 experimentalDecorators」** | **TS 5.0+ 的 Stage 3 装饰器不需要**；只有旧版需要 |
| **两套装饰器可以混用** | ❌ 完全不兼容，靠 `experimentalDecorators` 开关二选一 |
| **Stage 3 支持参数装饰器** | ❌ **不支持**（这是 Angular/NestJS 迁移的最大障碍） |
| **属性装饰器能改初始值** | ❌ `target` 是 prototype，实例还不存在；要配合类装饰器 |
| **装饰器执行顺序从下往上** | 要分两阶段：**表达式求值从上往下，函数执行从下往上** |
| **写元数据的装饰器放上面** | ❌ 会被后执行的覆盖/读不到；**写元数据的要放在下面** |
| **`emitDecoratorMetadata` 能拿到泛型** | ❌ 只能拿到有运行时值的类型（类），泛型/接口/联合都拿不到 |
| **装饰器是「注解」不影响运行** | 它会真的执行代码，有运行时开销 |
| **mixin 可以用 private 成员** | ⚠️ 会冲突；用 `#x` 或 `protected` |
| **mixin 同名成员会报错** | 不会，**静默覆盖**（后者赢） |
| **mixin 比组合好** | 组合更清晰、无命名冲突、可运行时替换；mixin 只在 is-a 场景用 |

---

## 7.10 答题模板

### 30 秒版（装饰器）

> 装饰器是 `@expression` 语法的特殊声明，本质是**在类定义时被调用的函数**，可以作用于类、方法、属性、访问器、参数。
> 它可以用来加元信息或改写行为，常见用途是日志、权限校验、缓存、依赖注入——Angular 和 NestJS 的整个架构都靠它。
> **要补充一个重要变化**：装饰器现在有两套标准。旧版要开 `experimentalDecorators`，签名是 `(target, key, descriptor)`，支持参数装饰器和 `reflect-metadata`，Angular/NestJS 在用。**TS 5.0 加了 TC39 Stage 3 标准装饰器，不需要任何 flag**，签名改成 `(value, context)`，更函数式，但**不支持参数装饰器**。两套完全不兼容。

### 30 秒版（mixin）

> mixin 是「用类工厂实现多继承」的模式，因为 JS/TS 只支持单继承。
> 核心是一个接收基类、返回继承它并加上新成员的匿名类的函数。类型上要定义 `type Constructor<T> = new (...args: any[]) => T`，然后用 `TBase extends Constructor` 约束——这样 TS 能自动推导出所有成员类型。
> 两个限制：mixin 里不能用 `private`/`protected` 成员（会冲突），同名成员会静默覆盖。所以实战里我更倾向组合。

### 2 分钟版（串起来讲）

> 我分「装饰器是什么 → 两套标准 → 执行顺序 → mixin」讲。
>
> **装饰器本质**：语法是 `@expr`，但它的本质是**在类定义时被调用的函数**。展开后是 `__decorate([dec], Target)` 这样的调用。所以它不是「注解」，会真的执行代码、有运行时开销。
>
> **两套标准**（这是重点）：旧版基于 TC39 Stage 1 提案，要开 `experimentalDecorators`，签名是 `(target, key, descriptor)`，支持五种装饰器（类、方法、属性、访问器、**参数**），配合 `emitDecoratorMetadata` 和 `reflect-metadata` 能拿到参数类型——这就是 Angular/NestJS 依赖注入的基础。TS 5.0 加了 Stage 3 标准装饰器，**不需要任何 flag**，签名改成 `(value, context)`，通过返回新函数来改行为，还有 `context.addInitializer` 这个很好用的钩子，但**不支持参数装饰器**。两套完全不兼容，同一个项目只能选一套。
>
> **执行顺序**（高频细节）：分两个阶段。**表达式求值从上往下**，然后**函数执行从下往上**。不同类型之间是「参数装饰器 → 方法/属性装饰器 → 类装饰器」。这里有个实战坑：如果装饰器 A 写元数据、装饰器 B 读元数据，那 A 必须写在**下面**，因为它先执行。
>
> **一个限制**：`emitDecoratorMetadata` 只能记录「有运行时值的类型」——类、构造函数。**泛型、接口、联合类型都拿不到**，因为它们被擦除了。所以 NestJS 里注入泛型接口必须用 `@Inject('TOKEN')` 显式指定。
>
> **mixin**：因为只支持单继承，用类工厂组合多个类的成员。核心是 `Constructor<T> = new (...args: any[]) => T` 这个类型 + `TBase extends Constructor` 约束，TS 就能推导所有成员。更好的写法是 `class Smart extends Activatable(Timestamped(User))`，得到一个有名字的类。两个限制：不能用 private/protected 成员（会冲突），同名成员静默覆盖。所以实战里我优先用组合——Vue 2 的 mixin 就是因为命名冲突和来源不清被 Vue 3 的 composable 取代了。

### 追问表

| 追问 | 回答要点 |
|---|---|
| 装饰器是什么 | `@expr` 语法，本质是类定义时调用的函数 |
| 需要什么配置 | 旧版要 `experimentalDecorators`；TS 5.0 的 Stage 3 不需要 |
| 有哪些装饰器 | 类、方法、属性、访问器、参数（参数装饰器是旧版独有） |
| 执行顺序 | 求值自上而下，执行自下而上；参数 → 方法/属性 → 类 |
| 属性装饰器能改初始值吗 | 不能，target 是 prototype，要配合类装饰器 |
| `emitDecoratorMetadata` 干什么 | 把参数类型写进元数据，供 DI 容器读取 |
| 它能拿到泛型吗 | 不能，只能拿到有运行时值的类型 |
| 装饰器有运行时开销吗 | 有，会真的执行 |
| mixin 怎么实现 | 类工厂 `function M<T extends Constructor>(Base: T) { return class extends Base {} }` |
| mixin 的类型怎么写 | `type Constructor<T> = new (...args: any[]) => T` + 泛型约束 |
| mixin 有什么限制 | 不能有 private/protected；同名成员静默覆盖 |
| mixin 和组合怎么选 | 优先组合；mixin 只在 is-a + 大量共享方法时用 |

---

## 7.11 速记卡

```
装饰器
  语法 @expr，本质「类定义时被调用的函数」（不是注解，会执行）
  五种：类 / 方法 / 属性 / 访问器 / 参数

★ 两套标准（TS 5.0 分水岭）
  旧版：experimentalDecorators，Stage 1，签名 (target, key, descriptor)
        + 支持参数装饰器 + emitDecoratorMetadata（Angular/NestJS/TypeORM）
  新版：Stage 3，TS 5.0+ 默认开启，无需 flag，签名 (value, context)
        + context.addInitializer + 不支持参数装饰器
  两者完全不兼容，靠 experimentalDecorators 二选一

执行顺序（必考）
  求值：从上往下
  执行：从下往上
  类型间：参数 → 方法/属性 → 类
  实战坑：写元数据的装饰器要放在【下面】（先执行）

编译产物
  __decorate([dec], Target) / __decorate([dec], proto, "key", null)
  for (i = decorators.length - 1; i >= 0; i--)  ← 「从下往上」的实现
  emitDecoratorMetadata → __metadata("design:paramtypes", [X])
  限制：泛型/接口/联合类型拿不到

mixin
  type Constructor<T = {}> = new (...args: any[]) => T
  function M<TBase extends Constructor>(Base: TBase) { return class extends Base { ... } }
  用法：class Smart extends Activatable(Timestamped(User)) {}
  带约束：TBase extends Constructor<{ name: string }>
  限制：不能有 private/protected（冲突）；同名静默覆盖
  选型：优先组合（Vue 2 mixin → Vue 3 composable 就是这个教训）
```
