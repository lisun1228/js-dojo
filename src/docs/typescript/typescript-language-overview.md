# TS · 01 语言全景与工程价值

> 覆盖：TS 定义、类型擦除的真实边界、结构化类型系统、TS 的价值与不适用场景

---

## 1.1 一句话结论

TypeScript 是 JavaScript 的超集加一层静态类型系统：编译期检查类型，编译后擦除类型，输出纯 JS。它不改变运行时行为，也不提供运行时安全；价值是把一类 bug 从运行时提前到编码时。

---

## 1.2 TS 到底是什么（把定义说准）

### 1.2.1 三个关键词

| 关键词 | 含义 | 容易说错的地方 |
|---|---|---|
| **超集（Superset）** | 语法兼容 JS，`allowJs` + `checkJs` 可混合 | ❌ 不是所有 JS 都能原样通过：`let x = 01` 报 TS1121 |
| **静态类型（Static Typing）** | 类型在编译期确定并检查 | ❌ 运行时没有类型信息 |
| **编译期检查（Compile-time Check）** | 错误在 `tsc` 或 IDE 中暴露 | ❌ 不生成机器码，输出仍是 JS |

### 1.2.2 一句话说清「编译」

```
main.ts  ──[ tsc ]──→  main.js
   │                      │
类型注解、接口、泛型        全没了
（编译期概念）          （纯 JS）
```

这个过程严格叫**转译（transpile）**：输入输出同属 JS 家族，只去掉类型、把新语法降级。`tsc` 同时是 transpiler 和 type checker。

---

## 1.3 类型擦除的真实边界（这是最高频的深度追问）

类型擦除只覆盖编译期概念。`enum`、`namespace`、装饰器、参数属性会生成运行时代码，这是「编译后一行不剩」的边界。

### 1.3.1 会被完全擦除的（编译后一行不剩）

| 语法 | 编译后 |
|---|---|
| 类型注解 `let x: number` | `let x` |
| 接口 `interface Foo { a: string }` | **完全消失** |
| 类型别名 `type Id = string \| number` | **完全消失** |
| 泛型 `<T>`、泛型约束 `T extends X` | **完全消失**（`<T>` 被删掉） |
| 类型断言 `x as Foo` | `x` |
| 非空断言 `x!` | `x` |
| `satisfies Foo` | 表达式本身 |
| `declare` 语句 | **完全消失**（只是声明） |
| `type` 导入 `import type { Foo }` | **整行删除** |
| `x?.y` | 保留（可选链是 JS 语法，不是类型） |

### 1.3.2 会留下运行时代码的（这是重点）

| 语法 | 编译产物 | 为什么 |
|---|---|---|
| **`enum`** | 一个 **IIFE**，返回对象；数字枚举还有**双向映射** | 需要运行时的常量对象 |
| **`namespace`** | 一个 **IIFE** | 需要运行时的作用域封装 |
| **装饰器（`experimentalDecorators`）** | `__decorate([...], target, key, desc)`；开 `emitDecoratorMetadata` 还会生成 `__metadata` | 需要在运行时应用 |
| **参数属性** `constructor(private x: number)` | `this.x = x`；ES2022 默认还会生成字段声明 `x;` | 需要运行时赋值 |
| **`import x = require('y')`** | `const x = require("y")` | 需要运行时加载 |

**实测：TS 6.0.3 / Node 22.12.0，`target: ES2022`**

```ts
// ── 输入 ts ──
export enum Direction { Up = 1, Down }
export namespace Utils { export const name = 'utils'; }
export class User {
  constructor(private readonly id: number, public name: string) {}
}
export interface Shape { area(): number }
export type Id = string | number;
export function identity<T>(x: T): T { return x; }
const enum E { A = 1, B = 2 }
export const val = E.A;
```

```js
// ── 输出 js（★ 为标注）──
export var Direction;
(function (Direction) {
    Direction[Direction["Up"] = 1] = "Up";        // ★ 双向映射
    Direction[Direction["Down"] = 2] = "Down";
})(Direction || (Direction = {}));

export var Utils;
(function (Utils) {
    Utils.name = 'utils';                          // ★ namespace → IIFE
})(Utils || (Utils = {}));

export class User {
    id;
    name;
    constructor(id, name) {
        this.id = id;                              // ★ 参数属性 → this.x = x
        this.name = name;
    }
}

export function identity(x) { return x; }          // ★ 泛型 <T> 被擦除

export const val = 1 /* E.A */;                    // ★ const enum 被内联

// interface Shape / type Id → 完全消失，一行不剩
```

`interface`、`type`、泛型、`as` 不产生代码；`enum`、`namespace`、装饰器、参数属性会留下运行时代码。

### 1.3.3 这个边界带来的两个工程后果

**后果一：只作类型使用的 `import` 会被整行删除**

```ts
// 未开 verbatimModuleSyntax：Foo 只作类型 → 整行 import 被删除
import { Foo } from './foo';
let x: Foo;
// 实测产物：let x;（./foo 的副作用也不会执行）
```

```ts
// 需要模块副作用时，单独保留副作用导入
import './foo';
```

`import type` 只是显式声明「这是类型导入」，同样不产生运行时导入，解决的是语义明确而不是保留副作用。开启 `verbatimModuleSyntax` 后，类型导入必须写成 `import type`（否则报 TS1484），普通 `import './foo'` 会保留。

**后果二：不能靠类型做运行时判断**

```ts
interface User { name: string }

// ❌ TS2693：User 只是类型，不是值
function isUser(x: unknown): x is User {
  return x instanceof User;
}

// ✅ 运行时只能按结构校验
function isUserByShape(x: unknown): x is User {
  return typeof x === 'object' && x !== null && typeof (x as any).name === 'string';
}
```

---

## 1.4 结构化类型系统（TS 最核心的设计，很多人不知道）

TS 判断类型兼容看形状，Java/C# 看名字。

### 1.4.1 两种类型系统

| | 结构化类型（Structural） | 名义类型（Nominal） |
|---|---|---|
| 判断兼容看什么 | **形状（有哪些成员）** | **名字（是哪个类/接口）** |
| 代表语言 | **TypeScript**、Go | Java、C#、C++ |
| 例子 | `{x: 1}` 可以直接赋给需要 `x: number` 的 `Point` | `new Foo()` 不能赋给 `Bar`，即使成员一样 |

### 1.4.2 具体表现

```ts
interface Point { x: number; y: number }
interface Coordinate { x: number; y: number }

const p: Point = { x: 1, y: 2 };
const c: Coordinate = p;          // ✅ 完全合法，只看形状

class A { constructor(public x: number) {} }
class B { constructor(public x: number) {} }
const a: A = new B(1);            // ✅ 类也按形状比较
```

**例外：类中有 `private` / `protected` 成员时，必须来自同一个声明**：

```ts
class A { private x = 1 }
class B { private x = 1 }
const a: A = new B();   // ❌ TS2322：private 成员来自不同的声明
```

这是 TS 中最接近名义类型的地方。

### 1.4.3 结构化类型的利与弊

**好处**：

| 好处 | 说明 |
|---|---|
| 和 JS 生态一致 | JS 是鸭子类型，结构化类型对应「能嘎嘎叫就是鸭子」 |
| 不用为类型改代码 | 第三方库的返回值可以直接赋给自定义接口 |
| 支持最小接口 | 参数只要 `{ id: number }`，传任何带 `id` 的对象都行 |

**坏处**：

```ts
type UserId = string;
type OrderId = string;

function getUser(id: UserId) { /* ... */ }
const orderId: OrderId = 'order-1';
getUser(orderId);      // ✅ 类型检查通过，但语义错了
```

**品牌类型（Branded Type）** 用交叉类型加一个不存在的标记模拟名义类型：

```ts
type Brand<T, B> = T & { readonly __brand: B };

type UserId = Brand<string, 'UserId'>;
type OrderId = Brand<string, 'OrderId'>;

function getUser(id: UserId) { return id; }
function toUserId(s: string): UserId { return s as UserId; }
const orderId: OrderId = 'order-1' as OrderId;

getUser(toUserId('user-1'));      // ✅
getUser(orderId);                  // ❌ TS2345：__brand 不匹配
```

用于区分底层类型相同、语义不同的值：ID、金额单位（分/元）、URL 编码前后。

---

## 1.5 TS vs JS 完整对比（核心）

### 1.5.1 对比表

| 维度 | JavaScript | TypeScript |
|---|---|---|
| **类型系统** | 动态、运行时才检查 | **静态、编译期检查** |
| **运行方式** | 浏览器/Node 直接跑 | **必须先转译成 JS** |
| **类型标注** | 无 | 有（`:`、`as`、`<T>`、`interface`、`type`） |
| **错误发现时机** | 运行时（用户点了才炸） | **写代码时** |
| **IDE 支持** | 靠 JSDoc / 推断，弱 | **强（精确补全、跳转、重命名）** |
| **重构** | 靠搜索 + 手动改，易漏 | **编译器帮你找出所有引用点** |
| **代码即文档** | 靠注释和命名 | **类型签名本身就是契约** |
| **生态** | 全部 npm 包 | 大部分包自带 `@types` 或 `types` 字段 |
| **学习成本** | 低 | 中（要学类型系统 + 类型体操） |
| **构建步骤** | 可无（直接 `<script>`） | 必须有（tsc / esbuild / swc / babel） |
| **运行时开销** | 无 | **类型层无**；enum/namespace 等会生成代码 |
| **包体积** | — | 可能略大（enum/namespace 生成代码、辅助函数） |

### 1.5.2 一条容易被追问：TS 有运行时开销吗

**答案：类型层零开销；生成运行时代码的语法和低 target 降级会带来少量开销。**

| 来源 | 开销 |
|---|---|
| 类型注解、接口、泛型 | **0**（被擦除） |
| `enum` / `namespace` | 小（生成对象 / IIFE） |
| 旧版装饰器（`__decorate`；开 `emitDecoratorMetadata` 还有 `__metadata`） | 中等（每个被装饰声明一份） |
| `class` 降级 | 中等（`__extends` / `_super` 等辅助） |
| `async/await` 降级 | 中等（`__awaiter` / `__generator`） |
| `for...of` 降级 | 小（`downlevelIteration` 下生成 `__values`） |

**关键**：后面几项**不是 TS 特有的**——它们是「把新语法降级到旧 target」的成本，Babel 也一样。**把 `target` 提到 ES2020+ 就基本没有了。**

---

## 1.6 为什么推荐用 TS（价值主张）

### 1.6.1 五条价值

**① 把一类 bug 从运行时提前到编码时**

Airbnb 2019 年 JSConf 分享（Brie Bunge）对生产 bug 的复盘：约 38% 可被 TypeScript 静态发现。

**典型被捕获的 bug 类型**：

| Bug 类型 | 例子 | TS 能否捕获 |
|---|---|---|
| 拼写错误 | `user.nam` 而不是 `user.name` | ✅ |
| 参数传错顺序/类型 | `f(a, b)` 但签名是 `f(b, a)` | ✅ |
| 忘记处理 `null`/`undefined` | `res.data.length` 但 `data` 可能是 `null` | ✅（`strictNullChecks`） |
| 重构漏改 | 改了字段名，漏了几处引用 | ✅ |
| 调用不存在的方法 | `arr.frist()` | ✅ |
| 联合类型没处理全 | `switch` 漏了一个分支 | ✅（用 `never` 穷尽检查） |
| **业务逻辑错** | `if (a > b)` 应该是 `>=` | ❌ |
| **运行时数据非法** | 接口返回的 JSON 少了个字段 | ❌ **TS 不管** |

最后两行是边界：TS 只保证代码内部自洽，不保证外部数据符合假设。

**② 重构安全**

```ts
// 改一个字段名：name → fullName
interface User { fullName: string }
// 编译器会报出所有引用 user.name 的位置
```

大型项目里，重构成本从「人肉搜索 + 测试覆盖」降到「编译器报错列表」。

**③ 代码即文档**

```ts
// 不看实现就知道：要传什么、返回什么、可能返回 null
function parseDate(input: string, format?: string): Date | null;
```

对比 JS：

```js
// 只能靠 JSDoc 或者读源码
/**
 * @param {string} input
 * @param {string} [format]
 * @returns {Date|null}
 */
function parseDate(input, format) {}
```

JSDoc 不强制、会与实现脱节；类型签名由编译器校验。

**④ IDE 体验**

- 输入 `user.` 列出所有字段
- 跳转到定义（包括第三方库的类型声明）
- 重命名字段时所有引用一起改
- 参数提示（第 3 个参数是什么）

**⑤ 团队协作的契约**

前后端共享一份 `types` 比共享 Markdown 文档可靠：文档会过期，类型不过期就编译不过。

```ts
// packages/shared-types/api.ts
export interface GetUserRes {
  code: number;
  data: { id: string; name: string; avatar: string | null };
}
// 前端直接用，后端实现也必须匹配
```

### 1.6.2 四条代价

| 代价 | 具体表现 | 缓解方式 |
|---|---|---|
| **多一步构建** | 需要 `tsc` / `esbuild` / `swc`；CI 里多一步类型检查 | 用 `esbuild`/`swc` 只做转译，类型检查放 CI 和 IDE |
| **学习成本** | 类型系统本身不难，**难的是「类型体操」**（条件类型、映射类型、`infer`） | 约定「不为炫技写复杂类型」；公共类型库统一维护 |
| **初期开发变慢** | 写类型、处理 `any`、和第三方库的 `@types` 打架 | 从 `strict: false` 渐进过渡；用 `// @ts-expect-error` 标注例外 |
| **假的安全感** | 以为「有 TS 就不用写测试/校验」 | **TS 完全不检查运行时数据** |

### 1.6.3 什么项目「不该」用 TS

| 场景 | 建议 |
|---|---|
| 一次性脚本、demo | 不必，`node script.js` 更快 |
| 极小的静态页（< 500 行） | 收益有限 |
| 团队完全没有 TS 经验 + 排期极紧 | 强行上会拖垮进度 |
| 依赖大量无类型的第三方库 | 要先补 `@types` 或写 `.d.ts`，成本高 |

---

## 1.7 TS 不能做什么（这一段是 L4 的分水岭）

TS 的类型保证止于代码内部，以下三类它管不了。

### 1.7.1 三个典型的「TS 管不了」

**① 外部数据**

```ts
interface User { id: number; name: string }

// ❌ as 只是编译期断言，不做运行时校验
const user = (await fetch('/api/user').then(r => r.json())) as User;

// 服务端返回 { id: "1" } 时，user.id 在运行时是 string
// user.id.toFixed() 运行时抛错
```

**正确做法**：运行时校验库

```ts
import { z } from 'zod';

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const user = UserSchema.parse(await res.json());   // ✅ 真的会检查
// 类型也自动推导出来：{ id: number; name: string }
```

同类库：`zod`、`valibot`、`io-ts`、`typebox`、`arktype`。

**② 数组越界、空值**

```ts
const arr: number[] = [1, 2, 3];
const x: number = arr[10];      // ✅ 类型是 number，运行时是 undefined
x.toFixed();                     // 💥 运行时崩
```

TS 在这里不健全（unsound）：下标访问不做越界检查。开 `noUncheckedIndexedAccess` 后，`arr[10]` 的类型变成 `number | undefined`（把结果赋给 `number` 会报 TS2322）。

**③ `as` 断言、`any`、`!` 非空断言**

```ts
const el = document.querySelector('#app') as HTMLDivElement;
el.innerHTML = 'hi';       // 如果 #app 不存在，el 是 null，运行时崩
```

这三种写法主动关闭检查，TS 不介入。

### 1.7.2 一张「TS 能保证什么」的表

| 能保证 | 不能保证 |
|---|---|
| ✅ 变量赋值类型匹配 | ❌ 运行时数据的形状 |
| ✅ 函数参数个数和类型 | ❌ 数组下标是否越界 |
| ✅ 属性是否存在（编译期） | ❌ 对象是否真的是那个类 |
| ✅ 联合类型是否处理全 | ❌ 网络请求是否成功 |
| ✅ 重构不漏改 | ❌ 业务逻辑是否正确 |
| ✅ 接口契约一致 | ❌ 第三方库的运行时行为 |

---

## 1.8 TS 的主要特点清单（答法）

按「类型能力 / 工程能力 / 运行时特性」三组罗列。

### 1.8.1 类型能力

| 特点 | 一句话 |
|---|---|
| **静态类型 + 类型推断** | 不写类型也能推断出来（`const x = 1` → `1`） |
| **结构化类型** | 只看形状不看名字 |
| **接口与类型别名** | `interface` / `type` 两种抽象工具 |
| **泛型** | 类型参数化，`<T>` |
| **联合 / 交叉类型** | `A \| B` / `A & B` |
| **字面量类型** | `'a' \| 'b'`，配合联合类型做枚举替代 |
| **类型收窄** | `typeof` / `in` / `instanceof` / 判别联合 / 自定义守卫 |
| **条件类型 / 映射类型 / 模板字面量类型** | 类型层面的「编程」能力（高级） |
| **工具类型** | `Partial` / `Pick` / `Omit` / `Record` / `ReturnType` 等 |

### 1.8.2 工程能力

| 特点 | 一句话 |
|---|---|
| **渐进式** | 可以从一个 `.js` 文件开始，逐步迁移（`allowJs`） |
| **声明文件 `.d.ts`** | 给无类型的 JS 库补类型 |
| **`tsconfig` 细粒度配置** | `strict` 系列、`paths`、项目引用 |
| **装饰器 / mixin** | 元编程能力 |
| **Source Map** | 调试时映射回 TS 源码 |

### 1.8.3 运行时特性（这是「反直觉」的部分）

| 特点 | 一句话 |
|---|---|
| **类型擦除** | 运行时没有类型信息，类型层零开销 |
| **enum / namespace 会生成代码** | 需要常量对象时可用 `as const` 对象 + 联合类型，避免运行时产物 |
| **不保证运行时安全** | 外部数据必须自己校验 |

---

## 1.9 答题模板

- **定义**：JS 超集 + 静态类型 + 编译期检查；编译后类型擦除，输出纯 JS，运行时行为不变。
- **擦除边界**：`interface`、`type`、泛型、`as`、`!` 不产生代码；`enum`（IIFE + 双向映射）、`namespace`、装饰器、参数属性会生成运行时代码。
- **结构化类型**：只看形状不看名字；`private`/`protected` 成员要求同一声明；需要名义区分时用品牌类型 `T & { __brand: B }`。
- **收益**：编译期发现错误、重构安全、类型即文档、IDE 补全/跳转、共享类型契约；代价是构建步骤、学习成本、初期变慢、假的安全感。
- **边界**：只保证代码内部自洽，不保证外部数据合法；API 返回值需运行时校验，`arr[10]`、`as`/`any`/`!` 都不设防，不能替代测试。

---

## 1.10 速记卡

```
定义
  JS 超集 + 静态类型 + 编译期检查 → 编译后类型擦除 → 输出纯 JS
  类型层零运行时开销；enum/namespace/装饰器/参数属性会生成代码

类型擦除边界
  完全擦除：类型注解、interface、type、泛型、as、!、satisfies、import type、declare
  生成代码：enum（IIFE + 双向映射）、namespace（IIFE）、装饰器（__decorate）、参数属性（this.x = x）
  未开 verbatimModuleSyntax 时，纯类型 import 整行被删；副作用需单独 import './foo'

结构化类型
  只看形状不看名字 → 同形状接口可互赋；new B() 可赋给 A
  例外：private/protected 成员必须同源
  痛点：同为 string 但语义不同 → 品牌类型 T & { __brand: B }

TS vs JS
  静态检查 / 必须先转译 / IDE 强 / 重构安全 / 代码即文档 / 多一步构建

为什么用
  Airbnb 2019 JSConf：约 38% 生产 bug 可被静态发现 / 重构安全 / 类型即文档 / IDE / 团队契约
  代价：构建、学习成本、初期慢、假的安全感

TS 不能做什么
  ① 外部数据 → zod 等运行时校验
  ② 数组越界（arr[10] 是 number，运行时 undefined；noUncheckedIndexedAccess 可改）
  ③ as / any / ! 主动关闭检查
  → 不能替代测试，也不能替代运行时校验
```
