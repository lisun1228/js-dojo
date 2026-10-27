# TS · 07 装饰器与 mixin

> 覆盖：装饰器、mixin
> 题单只说「需要开启 `experimentalDecorators`」——这只覆盖旧版。TS 5.0 起默认支持 TC39 Stage 3 装饰器，无需任何 flag，且与旧版语义不兼容。
> 下文结论按仓库自带的 TypeScript 6.0.3 实测：`npx tsc --noEmit --strict`，旧版另加 `--experimentalDecorators`。

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

**装饰器**是 `@expression` 形式的声明，作用于**类、方法、属性、访问器**（旧版还支持参数）。它本质上是**在类定义时被调用的函数**，会真的执行代码。
**mixin** 是用类工厂把多个类的成员组合进一个类的模式：JS/TS 只支持单继承，mixin 用来复用多份实现。

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

### 7.2.2 本质：编译期语法糖，展开成函数调用

```ts
// 输入
@sealed
class Greeter {}

// 输出（旧版，简化）
let Greeter = class Greeter {};
Greeter = __decorate([sealed], Greeter);
```

名字叫装饰器，落点仍是普通函数调用，所以**有运行时开销**。

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

Object.isSealed(Greeter); // true（实测）
```

---

## 7.3 【重点】两套标准：TS 5.0 的分水岭

### 7.3.1 两套标准对比

| | **旧版（`experimentalDecorators`）** | **新版（Stage 3 标准，TS 5.0+）** |
|---|---|---|
| 提案阶段 | TC39 旧提案，已被 Stage 3 取代 | TC39 **Stage 3** |
| TS 支持 | TS 1.5 起 | **TS 5.0 起** |
| 是否需要 flag | ✅ `"experimentalDecorators": true` | ❌ **不需要，默认开启** |
| 参数签名 | `(target, key, descriptor)` | `(value, context)` |
| **参数装饰器** | ✅ 支持 | ❌ **不支持**（TS1206） |
| 元数据反射 | `emitDecoratorMetadata` + `reflect-metadata` | `context.metadata`（TS 5.2+，运行时需 `Symbol.metadata`） |
| 谁在用 | **Angular、NestJS、TypeORM、InversifyJS** | 新库（Lit 3 等） |

### 7.3.2 两者**完全不兼容**

```
开 experimentalDecorators → 旧版语义；Stage 3 的 (value, context) 签名报 TS1238 / TS1270
不开（TS 5.0+）          → Stage 3 语义；旧版 (target, key, descriptor) 签名报 TS1241 / TS1270
```

升级 TS 5.0+ 后，未开 flag 的项目会按新语义编译，原有的旧版装饰器代码会直接报签名错误。

### 7.3.3 签名对比（看代码最直观）

**旧版**：

```ts
// 类装饰器
function classDec(target: Function) {}

// 方法装饰器
function methodDec(
  target: any,                    // 实例方法为 prototype，静态方法为构造函数
  propertyKey: string,
  descriptor: PropertyDescriptor
) {}

// 属性装饰器（没有 descriptor）
function propDec(target: any, propertyKey: string) {}

// 参数装饰器（★ 旧版独有）
function paramDec(target: any, propertyKey: string | undefined, index: number) {}
```

旧版的 `target` / `key` 由成员类型决定（实测）：

| 装饰位置 | `target` | `propertyKey` | `descriptor` |
|---|---|---|---|
| 实例属性 | `prototype` | 属性名 | `undefined` |
| 静态属性 | 构造函数 | 属性名 | `undefined` |
| 实例方法 / 访问器 | `prototype` | 方法名 | `PropertyDescriptor` |
| 静态方法 | 构造函数 | 方法名 | `PropertyDescriptor` |
| 方法参数 | `prototype` | 方法名 | 无此参数 |
| 构造函数参数 | 构造函数 | `undefined` | 无此参数 |

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
function bound<T extends (this: any, ...args: any[]) => any>(
  value: T,
  context: ClassMethodDecoratorContext
): T {
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
    console.log(this.label);
  }
}

const b = new Button();
const fn = b.handleClick;
fn(); // click（实测，this 没丢）
```

旧版要在 `descriptor.value` 上包一层，并自行处理 prototype 与实例的差异。

### 7.3.5 怎么选

| 场景 | 选择 |
|---|---|
| 用 Angular / NestJS / TypeORM | **必须旧版**（`experimentalDecorators: true`），它们的装饰器依赖 `reflect-metadata` |
| 新项目、自己写装饰器 | 新版（Stage 3），更标准、更类型安全 |
| 库作者 | 两套都支持，或者明确声明要求 |

**在 `tsconfig` 里怎么配**：

```json
// 旧版（Angular/NestJS 项目）
{ "compilerOptions": { "experimentalDecorators": true, "emitDecoratorMetadata": true } }

// 新版（Stage 3）：什么都不用加，TS 5.0+ 默认支持
```

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

new Config() === new Config(); // true（单例，实测）
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
    // target 是 prototype：只能挂原型访问器，不能给实例写值
    Object.defineProperty(target, key, {
      get() { return value; },
      configurable: true,
    });
  };
}

class Config {
  @defaultValue('localhost')
  declare host: string;   // declare：不生成实例字段，否则 ES2022 会用自有属性遮蔽原型 getter
}

new Config().host;        // 'localhost'（实测，所有实例共享同一个值）
```

**⚠️ 重要限制**：属性装饰器的 `target` 是**类的 prototype**（实例属性）或**构造函数**（静态属性），**此时实例还不存在**，所以拿不到 `this`，也不能写实例属性。上面的写法只能给出原型级默认值（共享、无 setter）。

**要给每个实例独立的初始值，得用「属性装饰器记录信息 + 类装饰器应用」的模式**：

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

实测 `@applyDefaults` + `@defaultValue('localhost')` 组合能拿到实例级默认值 `'localhost'`。class-validator 之类要求同时用类装饰器，就是这个原因。

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

**访问器装饰器和方法装饰器签名相同**（都有 `descriptor`），只是作用于 `get`/`set`。

### 7.4.5 参数装饰器（★ 旧版独有）

```ts
import 'reflect-metadata';

function inject(token: string) {
  return function (
    target: any,                      // 方法参数为 prototype；构造函数参数为构造函数
    key: string | symbol | undefined, // 构造函数参数时为 undefined
    index: number                     // 参数在参数列表中的位置
  ) {
    // 记录「第 index 个参数需要注入 token 对应的实例」
    const deps: string[] = Reflect.getMetadata('deps', target, key) || [];
    deps[index] = token;
    Reflect.defineMetadata('deps', deps, target, key);
  };
}

class UserService {
  constructor(
    @inject('db') private db: Database,
    @inject('logger') private logger: Logger,
  ) {}
}
```

`Reflect.getMetadata` / `defineMetadata` 由 `reflect-metadata` 提供，必须先 `import 'reflect-metadata'`，否则运行时报 `Reflect.getMetadata is not a function`、类型检查报 TS2339。

**这就是 Angular/NestJS 依赖注入的核心机制**：参数装饰器记录依赖，`reflect-metadata` 存元数据，容器在实例化时读取并注入。

**⚠️ Stage 3 装饰器不支持参数装饰器**，这是 Angular/NestJS 迁移到新标准的主要障碍。

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

### 7.5.2 不同类型的装饰器：类装饰器最后

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

这个例子只有一个成员，所以看起来是「参数 → 方法 → 类」。**成员之间按声明顺序处理**，不是所有参数装饰器先跑完：若类里先声明属性 `@propDec p = 1`，它会比后面的方法装饰器更早执行（实测）。类装饰器始终最后。

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

**旧版输出（实测）**：

```
evaluate: prop
execute: prop
evaluate: method
evaluate: param
execute: param
execute: method
evaluate: class
execute: class
```

每个成员先求值、随即执行；类装饰器在所有成员之后才求值并执行。**`evaluate: class` 不是最先**。

**新版（Stage 3）输出不同**（实测）：先按「类装饰器 → 成员声明顺序」求值，再执行「静态方法 → 实例方法 → 静态字段 → 实例字段 → 类」；参数装饰器不存在。

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
// 输出（旧版，target: ES2015，简化）
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

新版（Stage 3）不生成 `__decorate`，而是生成 `__esDecorate` 加类内 `static` 块：`static` 块里完成全部求值与执行，字段初始化器通过 `__runInitializers` 运行。

### 7.6.2 元数据反射（`emitDecoratorMetadata`）

前提：`emitDecoratorMetadata` 必须与 `experimentalDecorators` 同时开启，单独指定的报错是 `TS5052: Option 'emitDecoratorMetadata' cannot be specified without specifying option 'experimentalDecorators'`（实测）。

```ts
// 开 emitDecoratorMetadata 后
class UserService {
  constructor(@inject() private db: Database) {}
}
```

```js
// 会额外生成 __metadata
UserService = __decorate([
    __param(0, inject()),
    __metadata("design:paramtypes", [Database])   // ← 参数类型被保留到运行时！
], UserService);
```

**这是 Angular/NestJS 依赖注入能工作的关键**：平时类型是被擦除的，但**装饰器 + `emitDecoratorMetadata` 会把类型信息写进元数据**。

配合 `reflect-metadata` 读取（必须先 `import 'reflect-metadata'`）：`Reflect.getMetadata('design:paramtypes', UserService)` → `[Database]`。

**三个可用的元数据键**：

| 键 | 内容 |
|---|---|
| `design:type` | 属性/参数的类型 |
| `design:paramtypes` | 方法/构造函数的参数类型数组 |
| `design:returntype` | 返回值类型 |

**⚠️ 限制**：只能记录「有运行时值的类型」（类、构造函数）。**`interface`、泛型参数、联合类型在擦除后只能记成 `Object`**：

```ts
class S {
  constructor(private repo: Repository<User>) {}   // ❌ 泛型信息拿不到
  // design:paramtypes 里只有 Repository，没有 User
}
```

实测 `constructor(a: Repository<{ id: number }>, b: IFoo, c: string | number)` 生成的是 `__metadata("design:paramtypes", [Repository, Object, Object])`。所以 NestJS 里注入泛型接口必须用 `@Inject('TOKEN')` 显式指定。

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
import 'reflect-metadata';

function Roles(...roles: string[]) {
  return (target: any, key: string | symbol, desc: PropertyDescriptor) => {
    Reflect.defineMetadata('roles', roles, desc.value);
  };
}

function RequireRole(currentUser: { role: string }) {
  return (target: any, key: string | symbol, desc: PropertyDescriptor) => {
    // 装饰阶段就读取：能否读到取决于两个装饰器的执行顺序
    const roles: string[] = Reflect.getMetadata('roles', desc.value) || [];
    const original = desc.value;
    desc.value = function (...args: any[]) {
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

**⚠️ 注意装饰器顺序**：`@Roles` 在上、`@RequireRole` 在下 → **`@RequireRole` 先执行**，此时 `@Roles` 的元数据**还没写入**，读到的 `roles` 为空，鉴权不生效。

**写元数据的装饰器要放在下面**：

```ts
// ✅ 正确顺序：写元数据的在下（先执行）
@RequireRole({ role: 'user' })
@Roles('admin')
deleteAll() {}
```

实测：上面的顺序直接返回，下面的顺序抛 `Forbidden: requires admin`。

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
| **mixin（类工厂）** | 组合实现，**TS 文档给出的写法** |
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

**TS 能自动推导出所有成员的类型**——返回类型是基类与新增成员的交叉类型，不需要手写 `interface` 合并。

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
class R extends Greetable(Robot) {}      // ❌ TS2345：Robot 缺 name
```

**`Constructor<{ name: string }>` 这个约束是关键**——它保证 mixin 内部能安全访问 `this.name`。

### 7.8.5 两个必须知道的限制

**限制 ①：多个 mixin 不能声明同名的 `private` / `protected` 成员**

```ts
function MixinA<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    private secret = 1;      // 单个 mixin 可以
  };
}

function MixinB<TBase extends Constructor>(Base: TBase) {
  return class extends Base {
    private secret = 2;      // 与 MixinA 的同名 private 冲突
  };
}

class A extends MixinA(MixinB(class {})) {}
// ❌ TS2509：交叉类型因同名 private 来自不同声明退化为 never：
// "Base constructor return type 'never' is not an object type..."
```

**原因**：`private` 成员只能在同一声明内兼容，两个匿名类各声明一份 `secret`，交叉后不是同一个成员。单个 mixin 带 `private` 是合法的（实测）。

**解法**：改用 `#x`——私有名按类作用域隔离，两个 mixin 各写 `#secret` 不会冲突（实测可编译、可运行）；或者避免多个 mixin 使用同名私有成员。

**限制 ②：多个 mixin 有同名成员时，外层的静默覆盖内层的**

```ts
function A<T extends Constructor>(B: T) {
  return class extends B { value = 'A'; };
}
function B<T extends Constructor>(B: T) {
  return class extends B { value = 'B'; };
}

class C extends A(B(class {})) {}
new C().value;    // 'A'（外层覆盖内层，实测）
```

**不会报错，也没有提示**；`A(B(Base))` 里 B 先应用、A 后应用，A 的字段初始化在后，最终值来自 A。

### 7.8.6 mixin vs 组合（什么时候不用 mixin）

| | mixin | 组合（has-a） |
|---|---|---|
| 关系 | is-a（伪装） | has-a |
| 类型推导 | 自动 | 需要手写转发 |
| 命名冲突 | 外层覆盖，静默 | 明确（`this.a.foo()`） |
| 调试 | 类名变匿名，堆栈难读 | 清晰 |
| 灵活性 | 编译期确定 | 运行时可替换 |

**选型：优先用组合**。mixin 只在「确实需要 is-a 关系 + 大量共享方法」时用——Vue 2 的 mixin 就是因为命名冲突和来源不清，被 Vue 3 的 composable 取代。

---

## 7.9 常见坑

| 坑 | 正确说法 |
|---|---|
| **「装饰器需要 experimentalDecorators」** | **TS 5.0+ 的 Stage 3 装饰器不需要**；只有旧版需要 |
| **两套装饰器可以混用** | ❌ 完全不兼容，靠 `experimentalDecorators` 开关二选一 |
| **Stage 3 支持参数装饰器** | ❌ **不支持**（TS1206），这是 Angular/NestJS 迁移的最大障碍 |
| **属性装饰器能改初始值** | ❌ `target` 是 prototype，实例还不存在；且 ES2022 的实例字段会遮蔽原型 getter，要配合类装饰器 |
| **装饰器执行顺序从下往上** | 同一成员内如此；**类装饰器最后，成员按声明顺序** |
| **写元数据的装饰器放上面** | ❌ 在装饰阶段读取时读不到；**写元数据的要放在下面** |
| **`emitDecoratorMetadata` 能拿到泛型** | ❌ 擦除后只剩 `Object`；只能拿到有运行时值的类型（类） |
| **装饰器是「注解」不影响运行** | 它会真的执行代码，有运行时开销 |
| **mixin 可以用 private 成员** | 单个可以；**多个 mixin 同名 private 会冲突**（TS2509），改用 `#x` |
| **mixin 同名成员会报错** | 不会，**静默覆盖**（外层/最后应用的赢） |
| **mixin 比组合好** | 组合更清晰、无命名冲突、可运行时替换；mixin 只在 is-a 场景用 |

---

## 7.10 答题模板

### 30 秒版（装饰器）

- 语法是 `@expr`，本质是**类定义时被调用的函数**，作用于类、方法、属性、访问器（旧版还有参数）。
- 旧版要开 `experimentalDecorators`，签名 `(target, key, descriptor)`，支持参数装饰器和 `emitDecoratorMetadata`；Angular/NestJS 依赖这套。
- TS 5.0+ 默认 Stage 3，签名 `(value, context)`，用 `addInitializer` 和 `context.metadata`，**没有参数装饰器**；两套不兼容。

### 30 秒版（mixin）

- JS/TS 只能单继承，mixin 用类工厂组合多份实现。
- 核心类型 `type Constructor<T = {}> = new (...args: any[]) => T`，用 `TBase extends Constructor` 约束；返回类型自动带全部成员。
- 限制：多个 mixin 同名 private 冲突（改用 `#x`），同名成员外层静默覆盖；实战优先组合。

### 追问表

| 追问 | 回答要点 |
|---|---|
| 装饰器是什么 | `@expr` 语法，本质是类定义时调用的函数 |
| 需要什么配置 | 旧版要 `experimentalDecorators`；TS 5.0 的 Stage 3 不需要 |
| 有哪些装饰器 | 类、方法、属性、访问器、参数（参数装饰器是旧版独有） |
| 执行顺序 | 同一成员内求值自上而下、执行自下而上；类装饰器最后，成员按声明顺序 |
| 属性装饰器能改初始值吗 | 不能，target 是 prototype，要配合类装饰器 |
| `emitDecoratorMetadata` 干什么 | 把参数类型写进元数据，供 DI 容器读取；需 `reflect-metadata` |
| 它能拿到泛型吗 | 不能，擦除后只剩 `Object` |
| mixin 怎么实现 | 类工厂 `function M<T extends Constructor>(Base: T) { return class extends Base {} }` |
| mixin 的类型怎么写 | `type Constructor<T> = new (...args: any[]) => T` + 泛型约束 |
| mixin 有什么限制 | 多个 mixin 同名 private 冲突；同名成员静默覆盖 |

---

## 7.11 速记卡

```
装饰器
  @expr 语法，本质「类定义时被调用的函数」（不是注解，会执行）

★ 两套标准（TS 5.0 分水岭，完全不兼容，靠 experimentalDecorators 二选一）
  旧版：experimentalDecorators，(target, key, descriptor)
        + 参数装饰器 + emitDecoratorMetadata（Angular/NestJS/TypeORM）
        target：实例成员 prototype，静态成员构造函数；属性装饰器无 descriptor
  新版：默认开启，(value, context) + addInitializer + context.metadata
        context.metadata 需 Symbol.metadata（Node 22 没有）；参数位置写 @dec 报 TS1206

执行顺序
  同一成员：表达式从上往下求值，函数从下往上执行
  类装饰器最后；成员按声明顺序；参数装饰器先于其方法/属性
  装饰阶段读元数据时，写元数据的装饰器要放在下面

编译产物
  旧版：__decorate([dec], Target) / __decorate([dec], proto, "key", null)
        for (i = decorators.length - 1; i >= 0; i--)  ← 「从下往上」的实现
  新版：__esDecorate + static 块
  元数据：__metadata("design:paramtypes", [X])；泛型/接口/联合只剩 Object
  前提：emitDecoratorMetadata 必须与 experimentalDecorators 同开（TS5052）

mixin
  type Constructor<T = {}> = new (...args: any[]) => T
  function M<TBase extends Constructor>(Base: TBase) { return class extends Base { ... } }
  用法：class Smart extends Activatable(Timestamped(User)) {}
  带约束：TBase extends Constructor<{ name: string }>
  限制：多个 mixin 同名 private → TS2509（改用 #x）；同名成员外层静默覆盖
  选型：优先组合（Vue 2 mixin → Vue 3 composable 就是这个教训）
```
