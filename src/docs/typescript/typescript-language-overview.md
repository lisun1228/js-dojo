# TS · 01 语言全景与工程价值

> 本册覆盖：对 TS 的理解与 vs JS、TS 的主要特点、为什么推荐用 TS
> 这四道题答案高度重叠，但**考察角度不同**：第 2 题要「定义」、第 27 题要「特性罗列」、第 46 题要「价值主张」。
> 题单的答案（4 条好处 + 3 条代价）是**及格线**。本册补的是**三个核心认知**：类型擦除的真实边界、结构化类型系统、TS 不保证运行时安全——这三个才是所有深度追问的源头。

---

## 1.1 一句话结论

TypeScript 是 **JavaScript 的超集 + 一层静态类型系统**，在**编译期**做类型检查，**编译后类型全部擦除**，输出纯 JS。
所以它**不改变运行时行为**，也**不提供任何运行时安全**——它的价值是「把一类 bug 从运行时提前到写代码时」。

---

## 1.2 TS 到底是什么（把定义说准）

### 1.2.1 三个关键词

| 关键词 | 含义 | 容易说错的地方 |
|---|---|---|
| **超集（Superset）** | 任何合法的 JS 都是合法的 TS（`tsconfig` 里 `allowJs` + `checkJs` 可以混合） | ❌ 不是「所有 JS 都能直接跑」——有些语法在 TS 里会被拒绝（比如 `let x = 01` 八进制字面量在严格模式下） |
| **静态类型（Static Typing）** | 类型在**编译期**确定并检查 | ❌ 不是「运行时也有类型」——运行时类型全没了 |
| **编译期检查（Compile-time Check）** | 错误在 `tsc` 或 IDE 里暴露 | ❌ 不是「编译成机器码」——它是**转译（transpile）**，输出还是 JS |

### 1.2.2 一句话说清「编译」

```
main.ts  ──[ tsc ]──→  main.js
   │                      │
类型注解、接口、泛型        全没了
（编译期概念）          （纯 JS）
```

**注意：这个过程叫「转译（transpile）」而不是「编译（compile）」**——因为输入输出都是同一种语言（JS 家族），只是去掉了类型、把新语法降级成旧语法。叫「编译」是习惯用法，但严格说 `tsc` 是 **transpiler + type checker**。

> 面试话术：「TS 是 JS 的超集，加了一层静态类型。它在编译期检查类型，编译后把类型全部擦除，输出纯 JS。所以它不改变运行时行为——这一点很重要，意味着**它不能替代运行时校验**。」

---

## 1.3 类型擦除的真实边界（这是最高频的深度追问）

**「类型擦除」这句话是对的，但不完整。** 有几类语法**会留下运行时代码**，知道这个边界才算真懂。

### 1.3.1 会被完全擦除的（编译后一行不剩）

| 语法 | 编译后 |
|---|---|
| 类型注解 `let x: number` | `let x` |
| 接口 `interface Foo { a: string }` | **完全消失** |
| 类型别名 `type Id = string \| number` | **完全消失** |
| 泛型 `<T>`、泛型约束 `T extends X` | **完全消失**（`<T>` 被删掉） |
| 类型断言 `x as Foo` | `x` |
| 非空断言 `x!` | `x` |
| 可选链的类型部分 `x?.y` | `x?.y`（可选链本身是 JS 语法，会保留） |
| `satisfies Foo` | 表达式本身（TS 4.9） |
| `declare` 语句 | **完全消失**（它只是声明） |
| `type` 导入 `import type { Foo }` | **整行删除** |

### 1.3.2 会留下运行时代码的（这是重点）

| 语法 | 编译产物 | 为什么 |
|---|---|---|
| **`enum`** | 一个 **IIFE**，返回对象；数字枚举还有**双向映射** | 需要运行时的常量对象 |
| **`namespace`** | 一个 **IIFE** | 需要运行时的作用域封装 |
| **装饰器**（旧版） | `__decorate([...], target, key, desc)` 辅助函数 | 需要在运行时应用 |
| **参数属性** `constructor(private x: number)` | `this.x = x` | 需要运行时赋值 |
| **`import x = require('y')`** | `const x = require('y')` | 需要运行时加载 |

**实测：一段 TS 编译前后对比**（Node 22 / TS 7.0，`target: ES2022`）

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
// ── 输出 js（逐字复制自 tsc 产物）──
export var Direction;
(function (Direction) {
    Direction[Direction["Up"] = 1] = "Up";        // ★ 双向映射！
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

**这张对照表同时回答了「什么是类型擦除」和「哪些不是」**——`interface`、`type`、泛型都消失了，但 `enum`、`namespace`、参数属性留下了运行时代码。

**这张对比表是本册最有价值的东西**——它同时回答了「什么是类型擦除」和「哪些不是」。

> 面试话术：「类型擦除指的是类型标注、接口、泛型这些**编译期概念**编译后完全消失。但要补充一点：**enum、namespace、装饰器会生成运行时代码**——比如数字 enum 会生成双向映射的 IIFE，这就是为什么 enum 不能被 tree-shaking。所以严格说不是『所有类型语法都不产生代码』。」

### 1.3.3 这个边界带来的两个工程后果

**后果一：`import` 可能被「误删」**

```ts
// ❌ 危险：Foo 只用作类型，TS 老版本会把整个 import 删掉
import { Foo } from './foo';
let x: Foo;

// ✅ 明确：用 import type 表明「我只用它做类型」
import type { Foo } from './foo';
```

**为什么会有问题**：如果 `./foo` 有副作用（比如注册全局、polyfill），被删掉就出 bug 了。所以现代配置会开 `verbatimModuleSyntax`（或老的 `importsNotUsedAsValues: "error"`），**强制区分 `import` 和 `import type`**。

**后果二：不能靠类型做运行时判断**

```ts
interface User { name: string }

function isUser(x: unknown): x is User {
  // ❌ 运行时拿不到 User 的信息，`x instanceof User` 会报错（User 不是值）
  return x instanceof User;
}

// ✅ 只能手写结构校验
function isUser(x: unknown): x is User {
  return typeof x === 'object' && x !== null && typeof (x as any).name === 'string';
}
```

---

## 1.4 结构化类型系统（TS 最核心的设计，很多人不知道）

**这是 TS 和 Java/C# 最本质的区别，也是最多「反直觉」现象的来源。**

### 1.4.1 两种类型系统

| | 结构化类型（Structural） | 名义类型（Nominal） |
|---|---|---|
| 判断兼容看什么 | **形状（有哪些成员）** | **名字（是哪个类/接口）** |
| 代表语言 | **TypeScript**、Go | Java、C#、C++ |
| 例子 | `{x: 1}` 可以直接赋给 `Point`（如果 `Point` 需要 `x: number`） | `new Foo()` 不能赋给 `Bar`，即使成员一样 |

### 1.4.2 具体表现

```ts
interface Point { x: number; y: number }
interface Coordinate { x: number; y: number }

const p: Point = { x: 1, y: 2 };
const c: Coordinate = p;          // ✅ 完全合法！TS 只看形状

class A { constructor(public x: number) {} }
class B { constructor(public x: number) {} }
const a: A = new B(1);            // ✅ 也合法！类也一样（只要有 private 才例外）
```

**⚠️ 唯一的例外：如果类里有 `private` / `protected` 成员，就必须来自同一个声明**：

```ts
class A { private x = 1 }
class B { private x = 1 }
const a: A = new B();   // ❌ 报错：类型 B 不能赋值给类型 A，因为 private 成员来自不同的声明
```

**这是 TS 里唯一接近「名义类型」的地方。**

### 1.4.3 结构化类型的利与弊

**好处**：

| 好处 | 说明 |
|---|---|
| 和 JS 生态无缝 | JS 是鸭子类型（duck typing），TS 的结构化类型正好对应「能嘎嘎叫就是鸭子」 |
| 不需要为了类型改代码 | 第三方库的返回值可以直接赋给你的接口 |
| 天然支持「最小接口」 | 函数参数只要 `{ id: number }`，传任何带 `id` 的对象都行 |

**坏处（这是实战痛点）**：

```ts
// ❌ 危险：userId 和 orderId 都是 string，可以互相传错
type UserId = string;
type OrderId = string;

function getUser(id: UserId) { /* ... */ }
const orderId: OrderId = 'order-1';
getUser(orderId);      // ✅ 类型检查通过，但逻辑错了！
```

**解决方案：品牌类型（Branded Type）**——用交叉类型加一个「不存在的标记」模拟名义类型：

```ts
type Brand<T, B> = T & { readonly __brand: B };

type UserId = Brand<string, 'UserId'>;
type OrderId = Brand<string, 'OrderId'>;

function toUserId(s: string): UserId { return s as UserId; }

getUser(toUserId('user-1'));      // ✅
getUser(orderId);                  // ❌ 报错：缺少 __brand: 'UserId'
```

**这是「高级 TS」的标配技巧**，在需要区分「同类型但语义不同」的 ID、金额单位（分/元）、URL 编码前后时非常有用。

> 面试话术：「TS 是**结构化类型系统**——只看形状不看名字，所以两个成员相同但名字不同的接口可以互相赋值，这和 Java 的名义类型不一样。唯一例外是类里有 `private` 成员时必须同源。这个设计对 JS 生态很友好，但会带来『两个都是 string 但语义不同』的误传问题，实战里用『品牌类型』（交叉一个假字段）来模拟名义类型。」

---

## 1.5 TS vs JS 完整对比（核心）

### 1.5.1 对比表

| 维度 | JavaScript | TypeScript |
|---|---|---|
| **类型系统** | 动态、运行时才检查 | **静态、编译期检查** |
| **运行方式** | 浏览器/Node 直接跑 | **必须先转译成 JS** |
| **类型标注** | 无 | 有（`:` `/` `<T>` `interface` `type`） |
| **错误发现时机** | 运行时（用户点了才炸） | **写代码时（IDE 红波浪线）** |
| **IDE 支持** | 靠 JSDoc / 推断，弱 | **强（精确补全、跳转、重命名）** |
| **重构** | 靠搜索 + 手动改，易漏 | **编译器帮你找出所有引用点** |
| **代码即文档** | 靠注释和命名 | **类型签名本身就是契约** |
| **生态** | 全部 npm 包 | 大部分包自带 `@types` 或 `types` 字段 |
| **学习成本** | 低 | 中（要学类型系统 + 类型体操） |
| **构建步骤** | 可无（直接 `<script>`） | 必须有（tsc / esbuild / swc / babel） |
| **运行时开销** | 无 | **无**（类型被擦除） |
| **包体积** | — | 可能略大（enum/namespace 生成代码、辅助函数） |

### 1.5.2 一条容易被追问：TS 有运行时开销吗

**答案：理论上没有，实际可能有一点点。**

| 来源 | 开销 |
|---|---|
| 类型注解、接口、泛型 | **0**（被擦除） |
| `enum` / `namespace` | 小（生成对象） |
| 装饰器辅助函数 `__decorate` / `__metadata` | 中等（每个被装饰的类/方法都有） |
| `class` 降级到 ES5 | 中等（`__extends` / `_super` 等辅助） |
| `async/await` 降级 | 中等（`__awaiter` / `__generator`） |
| `for...of` 降级 | 小（`__values`） |

**关键**：后面这几项**不是 TS 特有的**——它们是「把新语法降级到旧目标」的成本，Babel 也一样。**把 `target` 提到 ES2020+ 就基本没有了。**

> 面试话术：「TS 本身零运行时开销，因为类型被擦除。但有两类例外：一是 `enum`、`namespace`、装饰器**会生成运行时代码**；二是 `target` 设得很低时，`class`、`async` 会被降级成辅助函数——这个成本 Babel 也有，不是 TS 特有。所以现代项目把 `target` 设成 ES2020 以上，用 `esbuild`/`swc` 转译，成本可以忽略。」

---

## 1.6 为什么推荐用 TS（价值主张）

### 1.6.1 五条价值，按「能说服人」排序

**① 把一类 bug 从运行时提前到编码时**

这是最硬的理由。业界有一份被广泛引用的统计（Airbnb 2019 年的工程博客）：**在他们对历史 bug 的分析中，约 38% 的 bug 可以被 TypeScript 静态捕获**。

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

**最后两行很重要**：TS **只能保证「你的代码内部自洽」，不能保证「外部数据符合你的假设」**。这是下一节的内容。

**② 重构安全**

```ts
// 改一个字段名
interface User { name: string }  →  interface User { fullName: string }

// 编译器会立刻报出所有用到 user.name 的地方
// 没有 TS 的话，只能全局搜索，漏一个就是线上 bug
```

**这是大型项目里 TS 最大的收益**——重构成本从「靠人肉搜索 + 测试覆盖」降到「编译器报错列表」。

**③ 代码即文档（类型签名就是最好的注释）**

```ts
// 不用看实现，就知道：要传什么、返回什么、可能抛什么
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

**JSDoc 的问题**：不强制、容易过期、写起来啰嗦。**类型是强制的，而且不会和实现脱节。**

**④ IDE 体验（补全、跳转、重命名）**

这一点常被低估，但**是日常开发里感知最强的收益**：

- 输入 `user.` 立刻列出所有字段（不用查文档、不用猜）
- `Cmd+Click` 跳到定义（包括跳到第三方库的类型声明）
- 重命名字段，所有引用点一起改（`F2` 重命名）
- 参数提示（这个函数第 3 个参数是什么）

**⑤ 团队协作的契约**

前后端联调时，**一份共享的 `types` 包**比一份 Markdown 文档可靠得多——文档会过期，类型不会（因为不过期就编译不过）。

```ts
// packages/shared-types/api.ts
export interface GetUserRes {
  code: number;
  data: { id: string; name: string; avatar: string | null };
}
// 前端直接用，后端实现了也必须匹配
```

### 1.6.2 三条代价（要说清，不然显得只会吹）

| 代价 | 具体表现 | 缓解方式 |
|---|---|---|
| **多一步构建** | 需要 `tsc` / `esbuild` / `swc`；CI 里多一步类型检查 | 用 `esbuild`/`swc` 做转译（快 10~100 倍），类型检查放 CI 和 IDE |
| **学习成本** | 类型系统本身不难，**难的是「类型体操」**（条件类型、映射类型、`infer`） | 团队约定「不为炫技写复杂类型」；公共类型库统一维护 |
| **初期开发变慢** | 写类型、处理 `any`、和第三方库的 `@types` 打架 | 从 `strict: false` 渐进过渡；用 `// @ts-expect-error` 标注例外 |

**还有一个容易被忽略的代价**：

| 代价 | 说明 |
|---|---|
| **假的安全感** | 有人以为「有 TS 就不用写测试/校验了」——这是最危险的。**TS 完全不检查运行时数据** |

### 1.6.3 什么项目「不该」用 TS

诚实的回答比一味吹更有说服力：

| 场景 | 建议 |
|---|---|
| 一次性脚本、demo | 不必，`node script.js` 更快 |
| 极小的静态页（< 500 行） | 收益有限 |
| 团队完全没有 TS 经验 + 排期极紧 | 强行上会拖垮进度 |
| 依赖大量无类型的第三方库 | 要先补 `@types` 或写 `.d.ts`，成本高 |

---

## 1.7 TS 不能做什么（这一段是 L4 的分水岭）

**很多人把 TS 当成「万能的类型保证」，这是危险的误解。**

### 1.7.1 三个典型的「TS 管不了」

**① 外部数据**

```ts
interface User { id: number; name: string }

// ❌ 这只是「断言」，不是「校验」
const user = (await fetch('/api/user').then(r => r.json())) as User;

// 如果服务器返回 { id: "1" }（字符串），TS 一句话都不会说
// 运行时 user.id 是字符串，后续 user.id.toFixed() 直接崩
```

**正确做法**：运行时校验库

```ts
import { z } from 'zod';

const UserSchema = z.object({
  id: z.number(),
  name: z.string(),
});

const user = UserSchema.parse(await res.json());   // ✅ 真的会检查
// 类型也自动推导出来了：{ id: number; name: string }
```

同类库：`zod`、`valibot`、`io-ts`、`typebox`、`arktype`。

**② 数组越界、空值**

```ts
const arr: number[] = [1, 2, 3];
const x: number = arr[10];      // ✅ 类型是 number，运行时是 undefined
x.toFixed();                     // 💥 运行时崩
```

**这是 TS 的著名「不健全（unsound）」之处**：数组下标访问不做越界检查（除非开 `noUncheckedIndexedAccess`，那样 `arr[10]` 会变成 `number | undefined`）。

**③ `as` 断言、`any`、`!` 非空断言**

```ts
const el = document.querySelector('#app') as HTMLDivElement;
el.innerHTML = 'hi';       // 如果 #app 不存在，el 是 null，运行时崩
```

**这三个是「你自己关掉了检查」**，TS 无能为力。

> 面试话术：「TS 有个重要的边界：**它只保证代码内部自洽，不保证外部数据合法**。所以存在三个盲区：一是接口返回的数据（要用 zod 这类库做运行时校验）；二是数组越界（`noUncheckedIndexedAccess` 可以缓解）；三是 `as`、`any`、`!` 这些『自己关检查』的写法。**TS 不能替代测试，也不能替代运行时校验**。」

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

**题 27 是「罗列题」，需要条理清晰。建议按「类型能力 / 工程能力 / 运行时特性」三组说。**

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
| **类型擦除** | 运行时零开销，但也没有运行时类型信息 |
| **enum / namespace 会生成代码** | 唯一的例外，且不能被 tree-shaking |
| **不保证运行时安全** | 外部数据必须自己校验 |

> **答题技巧**：题 27 如果只答「静态类型、接口、泛型、枚举」四个词，太单薄。**按上面三组说，每组 3~4 个，20 秒讲完，条理清晰。** 最后补一句「但要注意类型擦除，所以它不提供运行时安全」——这一句立刻区分层次。

---

## 1.9 答题模板

### 30 秒版（TS vs JS）

> TypeScript 是 JavaScript 的超集，加了一层静态类型系统。它在编译期做类型检查，编译后把类型全部擦除，输出纯 JS，所以运行时没有额外开销，也不改变运行时行为。
> 相比 JS 的四个好处：编译期发现类型错误、IDE 补全和跳转更强、重构时编译器帮你找全引用点、类型签名本身就是文档。代价是多一步构建、有学习成本、初期写得慢。
> 关键补充：**TS 不保证运行时安全**——接口返回的数据、`as` 断言、`any` 都不做运行时检查，所以不能替代运行时校验和测试。

### 30 秒版（为什么用 TS）

> 最硬的理由是**把一类 bug 从运行时提前到编码时**——Airbnb 有一份被广泛引用的统计，约 38% 的历史 bug 可以被 TS 静态捕获，主要是拼写错误、参数传错、忘记处理 null、重构漏改这几类。
> 其次是重构安全（改字段名编译器会报出所有引用点）和类型即文档（前后端共享 types 包比 Markdown 可靠）。
> 代价是多一步构建和学习成本，但这些可以用 esbuild 转译 + CI 类型检查缓解。

### 2 分钟版（完整版，推荐）

> 我分三块讲：TS 是什么、带来什么、不能做什么。
>
> **第一，TS 是什么。** 三个关键词：JS 超集、静态类型、编译期检查。它编译后把类型全部擦除，输出纯 JS。但这里有个细节要说准——**不是所有类型语法都完全消失**：`interface`、`type`、泛型、`as` 确实一行不剩，但 **`enum` 会生成一个带双向映射的 IIFE，`namespace` 会生成 IIFE，装饰器会生成 `__decorate` 辅助函数，参数属性会生成 `this.x = x`**。这就是为什么 enum 不能被 tree-shaking。
>
> 还有一个很多人不知道的核心设计：**TS 是结构化类型系统**，只看形状不看名字。所以两个成员相同但名字不同的接口可以互相赋值，`new B()` 也能赋给类型 `A`——唯一例外是类里有 `private` 成员时必须同源。这个设计对 JS 生态很友好，但会导致「两个都是 string 但语义不同」的误传，实战里用「品牌类型」交叉一个假字段来模拟名义类型。
>
> **第二，带来什么。** 四条：编译期发现类型错误（被引用最多的一份统计是 Airbnb 说能捕获约 38% 的 bug）；重构安全（改字段名所有引用点立刻报错）；类型即文档（前后端共享 types 包）；IDE 体验（补全、跳转、重命名）。代价是多一步构建、有学习成本、初期变慢——但这些可以用 esbuild/swc 转译 + CI 里跑 `tsc --noEmit` 缓解。
>
> **第三，也是最重要的，TS 不能做什么。** 它只保证**代码内部自洽**，不保证**外部数据合法**。三个盲区：接口返回的 JSON（要用 zod 这类库做运行时校验）、数组越界（`arr[10]` 类型是 `number` 但运行时是 `undefined`，可以开 `noUncheckedIndexedAccess` 缓解）、以及 `as` / `any` / `!` 这些「自己关检查」的写法。
>
> 所以我一般会说：**TS 不能替代测试，也不能替代运行时校验。把它当成「编译期的契约检查器」，而不是「安全保证」**。

### 追问表

| 追问 | 回答要点 |
|---|---|
| TS 是什么 | JS 超集 + 静态类型 + 编译期检查，编译后擦除 |
| 类型擦除是什么意思 | 类型语法编译后消失；但 enum/namespace/装饰器/参数属性会生成代码 |
| 为什么叫「超集」 | 任何合法 JS 都是合法 TS；且可以渐进迁移 |
| 结构化类型是什么 | 只看形状不看名字；`private` 成员是唯一例外 |
| 怎么模拟名义类型 | 品牌类型：`T & { __brand: B }` |
| TS 有运行时开销吗 | 本身没有；enum/低 target 降级有一点，Babel 也一样 |
| TS 能捕获多少 bug | Airbnb 统计约 38%（拼写、传参、null、重构漏改） |
| TS 能替代运行时校验吗 | **不能**；外部数据要用 zod/valibot |
| TS 能替代测试吗 | **不能**；逻辑错误、边界、并发它都管不了 |
| 为什么 `arr[10]` 不报错 | TS 不健全（unsound），可开 `noUncheckedIndexedAccess` |
| `as` 安全吗 | 不安全，不做运行时检查，只是编译期指令 |
| 什么项目不该用 TS | 一次性脚本、极小页面、团队零经验且排期紧 |
| 怎么渐进迁移 | `allowJs` + `checkJs`，从 `strict: false` 逐步收紧 |
| 为什么不建议用 enum | 会生成运行时代码、不能 tree-shaking，现代多用 `as const` 对象 + 联合类型 |

---

## 1.10 速记卡

```
定义
  JS 超集 + 静态类型 + 编译期检查 → 编译后类型擦除 → 输出纯 JS
  零运行时开销（但 enum/namespace/装饰器/参数属性会生成代码）

类型擦除的真实边界
  完全擦除：类型注解、interface、type、泛型、as、!、satisfies、import type、declare
  生成代码：enum（IIFE + 双向映射）、namespace（IIFE）、装饰器（__decorate）、参数属性（this.x = x）
  → 所以 enum 不能 tree-shaking
  → 所以老版本可能「误删」有副作用的 import（用 import type 明确）

结构化类型（核心认知）
  只看形状不看名字 → 两个同形状接口可互赋；new B() 可赋给 A
  唯一例外：类里有 private/protected 时必须同源
  痛点：两个都是 string 但语义不同 → 品牌类型 T & { __brand: B }

TS vs JS
  静态检查 / 必须先转译 / IDE 强 / 重构安全 / 代码即文档 / 多一步构建

为什么用
  38% 的 bug 可被静态捕获（Airbnb）/ 重构安全 / 类型即文档 / IDE 体验 / 团队契约
  代价：构建、学习成本、初期慢、**假的安全感**

TS 不能做什么（L4 分水岭）
  ① 外部数据（API 返回值）→ 必须 zod 等运行时校验
  ② 数组越界（arr[10] 类型是 number，运行时 undefined）
  ③ as / any / ! 是「自己关检查」
  → TS 不能替代测试，不能替代运行时校验
```
