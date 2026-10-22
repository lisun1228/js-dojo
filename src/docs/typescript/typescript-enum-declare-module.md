# TS · 08 枚举 · declare · namespace 与 module

> 本册覆盖：枚举、`declare` 关键字、命名空间与模块的区别
> 题单说「数字枚举有双向映射，有运行时代码」——**方向对，但没给编译产物**。而 enum 最值得讲的是「**它的问题**」和「**现代为什么用 `as const` 替代**」。
> namespace 那题也一样：题单只说「TS 早期组织代码的方式」，没说**它编译成 IIFE、为什么被淘汰、现在还剩什么用途**。

---

## 8.1 一句话结论

| 概念 | 一句话 | 现在还用吗 |
|---|---|---|
| **`enum`** | 命名常量集合，**唯一会生成运行时代码的类型语法** | ⚠️ 新项目建议用 `as const` 替代 |
| **`declare`** | 告诉编译器「这个东西存在，别报错」，**不生成任何代码** | ✅ 大量使用（`.d.ts`、全局变量） |
| **`namespace`** | TS 早期的模块化方案，编译成 IIFE | ❌ 基本淘汰（只剩声明文件场景） |
| **`module`** | ES Module，一个文件一个模块 | ✅ 唯一标准 |

---

## 8.2 枚举

### 8.2.1 三种枚举

```ts
// ① 数字枚举（默认从 0 开始递增）
enum Direction {
  Up,        // 0
  Down,      // 1
  Left,      // 2
  Right,     // 3
}

// ② 数字枚举（指定起点，后续递增）
enum Status {
  Idle = 1,
  Loading,   // 2
  Success,   // 3
}

// ③ 字符串枚举（必须每个都指定）
enum Color {
  Red = 'RED',
  Green = 'GREEN',
}

// ④ 异构枚举（数字 + 字符串混用，不推荐）
enum Mixed {
  No = 0,
  Yes = 'YES',
}
```

### 8.2.2 【必答】编译产物：双向映射

```ts
// 输入
enum Direction {
  Up = 1,
  Down,
  Left,
}
```

```js
// 输出
var Direction;
(function (Direction) {
    Direction[Direction["Up"] = 1] = "Up";       // Direction["Up"] = 1，然后 Direction[1] = "Up"
    Direction[Direction["Down"] = 2] = "Down";
    Direction[Direction["Left"] = 3] = "Left";
})(Direction || (Direction = {}));
```

**`Direction[Direction["Up"] = 1] = "Up"` 这一行的执行顺序**：

```
① Direction["Up"] = 1        → 赋值，表达式返回 1
② Direction[1] = "Up"        → 用上一步的返回值 1 作为键
```

**结果**：

```js
Direction.Up;      // 1        （正向映射）
Direction[1];      // 'Up'     （反向映射）★
Direction;         // { 1:'Up', 2:'Down', 3:'Left', Up:1, Down:2, Left:3 }
```

**所以数字枚举的对象有 6 个键（3 个正 + 3 个反）。**

**字符串枚举没有反向映射**：

```ts
enum Color { Red = 'RED' }
```

```js
var Color;
(function (Color) {
    Color["Red"] = "RED";        // ← 只有一行，没有反向
})(Color || (Color = {}));

Color.Red;      // 'RED'
Color['RED'];   // undefined
```

> **面试话术**：「数字枚举会生成双向映射——`Direction.Up` 是 1，`Direction[1]` 是 'Up'，因为编译产物里用的是 `Direction[Direction["Up"] = 1] = "Up"` 这种嵌套赋值。字符串枚举只有正向映射，因为没有必要反向查。」

### 8.2.3 `const enum`：会被内联

```ts
const enum E {
  A = 1,
  B = 2,
}

const x = E.A;
```

```js
// 输出（注意：enum 对象完全消失！）
const x = 1 /* E.A */;
```

**`const enum` 的特点**：

| 特点 | 说明 |
|---|---|
| **无运行时对象** | 所有使用处都被内联成字面量 |
| **体积最小** | 不生成 IIFE |
| **无法反向映射** | 连对象都没有，当然不能 `E[1]` |
| **编译产物里有注释** | `/* E.A */` 方便调试 |

**⚠️ `const enum` 的三个坑**：

| 坑 | 说明 |
|---|---|
| **`isolatedModules` 下跨文件不可用** | Babel/esbuild 单文件转译时看不到别的文件的 `const enum` 声明，无法内联 |
| **esbuild/swc 会降级成普通 enum** | 它们不做跨文件分析，只能当普通 enum 处理（体积反而变大） |
| **`preserveConstEnums` 会保留对象** | 开启后 `const enum` 变成普通 enum |

**所以现代工程（Vite/esbuild）里 `const enum` 的收益基本没有了**，反而有兼容问题。

### 8.2.4 `declare enum`（环境枚举）

```ts
declare enum Direction {
  Up = 1,
  Down = 2,
}
```

**用途**：声明「运行时已经存在的枚举」（比如由别的脚本注入），只声明类型不生成代码。

### 8.2.5 enum 的三个问题（这是「为什么不用」的答案）

**问题 ①：生成运行时代码，体积变大**

```ts
// 每个 enum 都生成一个 IIFE
enum A { X, Y, Z }
enum B { P, Q, R }
enum C { ... }
// 三个 enum = 三段 IIFE
```

**问题 ②：不能被 tree-shaking**

```ts
enum Status { Idle, Loading, Success }

// 只用了 Idle，但整个 Status 对象都会被打包
console.log(Status.Idle);
```

**为什么**：打包器看到的是 `Status.Idle` 这种**属性访问**，无法静态确定「只用了 Idle 这一个成员」，所以整个对象都得保留。

**对比 `as const` 对象**：

```ts
const Status = { Idle: 0, Loading: 1, Success: 2 } as const;
```
**这个可以被 tree-shaking**——因为它是普通的对象字面量，打包器能分析属性访问。

**问题 ③：数字枚举的类型不安全（TS 5.0 之前）**

```ts
enum Direction { Up = 1, Down = 2 }

const d: Direction = 99;    // ⚠️ TS 5.0 之前：合法！不报错
```

**为什么**：早期 TS 把数字枚举的类型当成 `number` 的子类型，任何数字都能赋进去。

**TS 5.0 的改进（union enums）**：

```ts
enum Direction { Up = 1, Down = 2 }
const d: Direction = 99;    // ❌ TS 5.0+：报错

// 但如果是「计算成员」或「没有字面量初始值」，仍然不安全
enum Computed { A = 'x'.length, B }
const c: Computed = 99;     // 仍然合法
```

**所以：数字枚举的类型安全依赖「所有成员都是字面量初始化」这个条件。**

### 8.2.6 现代替代方案：`as const` 对象 + 联合类型

**这是目前最推荐的写法**：

```ts
// ① 定义常量对象
export const Status = {
  Idle: 'idle',
  Loading: 'loading',
  Success: 'success',
} as const;

// ② 提取联合类型
export type Status = typeof Status[keyof typeof Status];
// 'idle' | 'loading' | 'success'

// ③ 使用
const s: Status = 'idle';       // ✅
const t: Status = 'done';       // ❌ 报错
const u: Status = Status.Idle;  // ✅ 字面量也有提示
```

**对比表**：

| 维度 | `enum` | `as const` 对象 |
|---|---|---|
| 运行时代码 | ✅ 生成 IIFE | ✅ 生成对象（但可 tree-shaking） |
| **tree-shaking** | ❌ 不能 | ✅ **能** |
| 类型精确度 | 数字枚举可能不安全 | ✅ **精确的联合字面量** |
| 反向映射 | 数字枚举有 | ❌ 无（一般不需要） |
| 可迭代/`Object.keys` | ❌ 不方便（有反向键） | ✅ 干净 |
| 与后端字符串对接 | 需要 `.toString()` | ✅ 直接就是字符串值 |
| IDE 提示 | ✅ | ✅ |
| 学习成本 | 低 | 中（要理解 `typeof` + `keyof`） |

**这是「为什么现代项目不用 enum」的标准答案。**

> **面试话术**：「enum 有三个问题：一是生成运行时代码、二是**不能被 tree-shaking**（因为打包器看到的是属性访问，无法确定只用了哪个成员）、三是数字枚举在 TS 5.0 之前类型不安全，任意数字都能赋值。所以新项目我倾向用 `as const` 对象加联合类型——`const Status = {...} as const; type Status = typeof Status[keyof typeof Status]`。这样没有 IIFE、能 tree-shaking、类型是精确的联合字面量，而且和 JSON 对接也更自然。」

### 8.2.7 什么时候 enum 仍然合适

不是说 enum 一无是处：

| 场景 | 为什么 enum 还行 |
|---|---|
| **纯后端/Node 项目** | 不需要 tree-shaking 优化，enum 更方便 |
| **需要反向映射** | 数字枚举有 `Direction[1] === 'Up'` |
| **团队已经很熟** | 迁移成本高 |
| **和 C#/Java 背景团队协作** | 概念对应 |

---

## 8.3 `declare` 关键字

### 8.3.1 一句话作用

**「告诉编译器：这个东西在运行时存在，但我在这里不实现它，你别报错。」**

**关键：`declare` 声明的东西，编译后完全不生成任何代码。**

```ts
declare const VERSION: string;
declare function greet(name: string): void;
declare class Foo {}

console.log(VERSION);   // 编译后：console.log(VERSION);
// 前面的 declare 全没了
```

### 8.3.2 六种声明形式

```ts
// ① 变量
declare const VERSION: string;
declare let counter: number;
declare var legacy: any;

// ② 函数
declare function greet(name: string): void;

// ③ 类
declare class MyClass {
  constructor(x: number);
  method(): void;
}

// ④ 命名空间
declare namespace MyLib {
  function doSomething(): void;
}

// ⑤ 模块（ambient module）
declare module 'some-untyped-lib' {
  export function init(): void;
}

// ⑥ 全局扩展
export {};
declare global {
  interface Window {
    __CONFIG__: { apiBase: string };
  }
}
```

### 8.3.3 `.d.ts` 声明文件

**`.d.ts` 就是「只包含 `declare` 语句的文件」**——它是**类型声明**，不是实现。

```
types/
  global.d.ts        ← 全局类型声明
  modules.d.ts       ← 第三方模块声明
  assets.d.ts        ← 静态资源声明
```

**一个完整的 `.d.ts` 例子**：

```ts
// types/legacy-lib.d.ts
declare module 'legacy-lib' {
  export interface Options {
    debug?: boolean;
    timeout?: number;
  }

  export function init(opts?: Options): void;
  export function send(data: unknown): Promise<void>;

  const defaultExport: {
    init: typeof init;
    send: typeof send;
  };
  export default defaultExport;
}
```

**这样 `import { init } from 'legacy-lib'` 就有类型了。**

### 8.3.4 三种模块声明的区别（容易混）

| 写法 | 含义 | 场景 |
|---|---|---|
| `declare module 'foo'` | **定义**一个新模块的类型（这个模块原本没有类型） | 给无类型的三方库补类型 |
| `declare module 'foo' { ... }` **在已有模块的 `.ts` 文件里** | **增强**已有模块的类型 | 给 vue-router 的 `RouteMeta` 加字段 |
| `declare global { ... }` | 给全局作用域加声明 | 给 `window` 加属性、加全局函数 |

**注意：模块增强必须在「模块文件」里（有 import/export）**，否则 `declare module 'foo'` 会被当成「定义新模块」而不是「增强」。

```ts
// ✅ 模块增强：有 import 让它成为模块
import 'vue-router';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
  }
}
```

### 8.3.5 `declare global` 的一个坑

**`declare global` 只能在模块里用**：

```ts
// ❌ a.ts（没有 import/export，是「脚本」）
declare global {
  interface Window { x: string }   // 报错：Augmentations for the global scope
}                                   //       can only be directly nested in external
                                    //       modules or ambient module declarations
```

```ts
// ✅ 加一个 export {} 让它成为模块
export {};

declare global {
  interface Window { x: string }
}
```

**为什么**：`declare global` 的语义是「从模块作用域往外扩一层到全局」。如果文件本身就是全局脚本，那它已经在全局了，`declare global` 就没有意义（也没法确定扩展的「外层」是哪）。

### 8.3.6 三斜线指令（了解即可）

```ts
/// <reference path="./other.d.ts" />
/// <reference types="node" />
```

**这是老的「引入声明」方式**，现在基本被 `import` 和 `tsconfig` 的 `types`/`typeRoots` 取代。

### 8.3.7 `@types` 包与 `types` 配置

```bash
npm i -D @types/node @types/lodash
```

**`@types/*` 是社区维护的类型声明包**（DefinitelyTyped 项目）。

```json
// tsconfig
{
  "compilerOptions": {
    "types": ["node", "jest"],        // 只加载这些全局类型
    "typeRoots": ["./node_modules/@types", "./types"]   // 类型声明的查找目录
  }
}
```

**⚠️ `types` 配了之后就只加载列表里的**，没列的全局类型（比如 `@types/jest` 的 `describe`）会报错。

---

## 8.4 namespace

### 8.4.1 语法

```ts
namespace Utils {
  export const VERSION = '1.0';

  export function greet(name: string) {
    return `Hello, ${name}`;
  }

  // 不写 export 的就是私有的
  function internalHelper() {}
}

Utils.greet('alice');    // ✅
Utils.internalHelper();  // ❌ 报错：不存在
```

**嵌套 namespace**：

```ts
namespace App {
  export namespace Utils {
    export function greet() {}
  }
}
App.Utils.greet();
```

### 8.4.2 编译产物：IIFE

```ts
namespace Utils {
  export const VERSION = '1.0';
  export function greet(n: string) { return n; }
}
```

```js
var Utils;
(function (Utils) {
    Utils.VERSION = '1.0';
    function greet(n) { return n; }
    Utils.greet = greet;
})(Utils || (Utils = {}));
```

**就是一个立即执行函数，把变量封在函数作用域里，只把 `export` 的挂到对象上。**

**所以它的本质是「IIFE + 命名空间对象」，和 ES Module 的机制完全不同。**

### 8.4.3 为什么 namespace 被淘汰（三个原因）

| 原因 | 说明 |
|---|---|
| **① 不能被 tree-shaking** | IIFE 内部无法静态分析，整个 namespace 都会被打包 |
| **② 跨文件需要 `outFile`** | 多个 namespace 合并要靠 `--outFile` 按顺序拼接文件，这和现代打包工具（模块图）冲突 |
| **③ 与 ES Module 语义混乱** | 同一个文件里既有 `namespace` 又有 `import/export` 会让「这个文件是模块还是脚本」变得模糊 |

**更根本的原因**：**ES Module 已经是标准，浏览器和 Node 都原生支持，不需要 TS 发明自己的模块方案。**

```ts
// namespace（淘汰）
namespace Utils { export function greet() {} }

// ES Module（标准）
// utils.ts
export function greet() {}
// main.ts
import { greet } from './utils';
```

### 8.4.4 namespace 现在还剩什么用途

**只剩三个场景**：

**① 给全局库写声明文件**

```ts
// 给 jQuery 这种「挂到 window 上的库」写类型
declare namespace jQuery {
  function ajax(url: string): Promise<unknown>;
  interface AjaxSettings {
    method?: 'GET' | 'POST';
  }
}

declare const $: typeof jQuery;
```

**为什么必须用 namespace**：因为 `$` 既是函数又有属性（`$.ajax`），这需要「函数 + 命名空间」的合并声明。

**② 声明文件里的类型分组**

```ts
declare namespace MyLib {
  interface Options { }
  interface Result { }
}
```

**③ 老代码 / 从 C#/Java 迁移过来的代码**

> **面试话术**：「namespace 是 TS 早期的模块化方案，编译成 IIFE，把变量封在函数作用域里。它被淘汰有三个原因：**不能被 tree-shaking**、**跨文件合并要靠 `--outFile`**（和现代打包工具冲突）、**和 ES Module 语义混乱**。现在只在写 `.d.ts` 给全局库补类型时还会用——因为那种『函数 + 属性』的库（比如 jQuery）需要 namespace 的声明合并。」

---

## 8.5 module

### 8.5.1 什么是模块

**一个文件就是一个模块**，只要它有**顶层 `import` 或 `export`**。

```ts
// utils.ts
export const VERSION = '1.0';
export function greet(name: string) {
  return `Hello, ${name}`;
}
export default class Utils {}

// main.ts
import Utils, { VERSION, greet } from './utils';
```

### 8.5.2 【重要坑】script vs module

**这是 `.d.ts` 和全局类型里最常踩的坑。**

| 类型 | 判定条件 | 顶层声明的作用域 |
|---|---|---|
| **脚本（script）** | **没有**顶层 `import` / `export` | **全局！** |
| **模块（module）** | **有**顶层 `import` / `export` | 模块作用域（文件内） |

```ts
// a.ts（没有 import/export → 脚本）
const foo = 1;        // ← 这是全局变量！会污染 globalThis

// b.ts（没有 import/export → 脚本）
const foo = 2;        // ❌ 报错：Cannot redeclare block-scoped variable 'foo'
```

**修复方式**：加一个 `export {}` 让它变成模块。

```ts
// a.ts
const foo = 1;        // ← 现在只在文件内，不污染全局
export {};
```

**为什么这是坑**：很多人写 `.d.ts` 或者工具文件时，不加 `export {}`，结果**所有类型都变成了全局的**，导致：
- 类型名冲突
- 改一个文件影响另一个文件
- `declare global` 报错

### 8.5.3 `import type`（现代必用）

```ts
// ❌ 老写法：值导入，但只用于类型
import { User } from './types';

// ✅ 明确：只导入类型
import type { User } from './types';

// ✅ 混合
import { createUser, type User } from './types';
```

**为什么要用 `import type`**：

| 原因 | 说明 |
|---|---|
| **明确意图** | 一看就知道这行不会产生运行时 import |
| **避免误删/误留** | 老版本 TS 会「删掉只用于类型的 import」，如果那个模块有副作用就出 bug |
| **`isolatedModules` 要求** | 单文件转译时无法判断某个 import 是不是只用于类型，必须显式标注 |
| **`verbatimModuleSyntax` 要求** | TS 5.0 新增的更严格模式，要求所有只用于类型的导入都写 `type` |

### 8.5.4 `export type`（同理）

```ts
// types.ts
export interface User { name: string }
export type Id = string;
export const MAX = 10;

// ✅ 导出类型
export type { User, Id };
// 或者定义时直接标
export type { User };
```

---

## 8.6 namespace vs module 完整对比（核心）

| 维度 | `namespace` | `module`（ES Module） |
|---|---|---|
| **来源** | TS 自创（早期） | **ECMAScript 标准** |
| **编译产物** | **IIFE**（生成代码） | 保持 `import/export`（或转成 CJS/AMD） |
| **作用域** | 函数作用域（IIFE） | **模块作用域** |
| **跨文件合并** | 需要 `--outFile` 按顺序拼 | 模块图（`import` 解析） |
| **tree-shaking** | ❌ **不能** | ✅ **能** |
| **循环依赖** | 不涉及 | 支持（但有陷阱） |
| **动态导入** | ❌ | ✅ `import()` |
| **浏览器原生支持** | ❌ 需要编译 | ✅ `<script type="module">` |
| **和 npm 包协作** | ❌ 需要额外声明 | ✅ 天然 |
| **现状** | 仅用于 `.d.ts` 声明全局库 | ✅ **唯一标准** |

**一句话总结**：

> **`namespace` 是「编译期的命名空间 + 运行时的 IIFE」，`module` 是「语言级的模块系统」。前者是 TS 的历史包袱，后者是标准。**

---

## 8.7 常见坑

| 坑 | 正确说法 |
|---|---|
| **说「字符串枚举也有双向映射」** | ❌ 只有数字枚举有；字符串枚举只生成正向 |
| **以为 `const enum` 一定更好** | `isolatedModules` 下跨文件不可用；esbuild/swc 会降级成普通 enum |
| **以为 enum 类型一定安全** | 数字枚举在 TS 5.0 前任意数字都能赋值；即使 5.0 后，含计算成员的仍不安全 |
| **以为 enum 能被 tree-shaking** | ❌ 不能，属性访问无法静态分析 |
| **说 `declare` 会生成空实现** | ❌ **完全不生成任何代码** |
| **`declare global` 写在脚本文件里** | ❌ 必须先在文件里加 `export {}` 变成模块 |
| **`.d.ts` 文件忘了加 `export {}`** | 所有类型变成全局，导致冲突 |
| **模块增强写成 `declare module` 但文件是脚本** | 会被当成「定义新模块」，不是「增强」 |
| **说 namespace 只是「老写法」** | 它在 `.d.ts` 里给全局库补类型时仍不可替代（声明合并） |
| **`import` 和 `import type` 混用无所谓** | `isolatedModules`/`verbatimModuleSyntax` 下必须区分 |
| **`types` 配了不影响其他类型** | 配了就**只加载列表内的**全局类型 |

---

## 8.8 答题模板

### 30 秒版（枚举）

> `enum` 定义一组命名常量，支持数字枚举（自动递增）和字符串枚举。
> **关键点是它会生成运行时代码**：数字枚举编译成一个 IIFE，而且有**双向映射**——`Direction.Up` 是 1，`Direction[1]` 是 'Up'，因为编译产物用 `Direction[Direction["Up"] = 1] = "Up"` 这种嵌套赋值。字符串枚举只有正向映射。
> 另外 `const enum` 会被内联、不生成对象，但在 `isolatedModules` 下不能跨文件用。
> enum 有三个问题：生成代码、**不能被 tree-shaking**、数字枚举类型不安全。所以新项目我倾向用 `as const` 对象加联合类型替代。

### 30 秒版（namespace vs module）

> `namespace` 是 TS 早期的模块化方案，编译成**立即执行函数（IIFE）**，把变量封在函数作用域里，只把 `export` 的挂到返回的对象上。
> `module` 是 **ES Module 标准**，一个文件一个模块，用 `import/export`，编译后保持模块语义（或转成 CJS）。
> 三个关键区别：**namespace 不能 tree-shaking**（IIFE 内部无法静态分析）、**跨文件合并要靠 `--outFile`**（和现代打包工具冲突）、**它不是语言标准**（浏览器不原生支持）。
> 所以现代项目统一用 ES Module。namespace 现在只在写 `.d.ts` 给全局库补类型时还会用——比如 jQuery 这种「函数 + 属性」的库需要 namespace 的声明合并。

### 2 分钟版（串起来讲）

> 我按「枚举 → declare → namespace/module」讲。
>
> **枚举**：三种形态，数字、字符串、异构。核心是编译产物——数字枚举生成 IIFE 和**双向映射**，`Direction.Up` 是 1、`Direction[1]` 是 'Up'，实现是 `Direction[Direction["Up"] = 1] = "Up"` 嵌套赋值；字符串枚举只有正向。`const enum` 会被完全内联成字面量、不生成对象，但在 `isolatedModules` 下不能跨文件用，esbuild/swc 也会降级成普通 enum。
>
> enum 的三个问题：一是每个 enum 都生成 IIFE、体积变大；二是**不能被 tree-shaking**，因为打包器看到的是 `Status.Idle` 这种属性访问，无法确定只用了哪个成员；三是数字枚举类型不安全，TS 5.0 之前任意数字都能赋值。所以现代写法是 `const Status = {...} as const` 加 `type Status = typeof Status[keyof typeof Status]`——没有 IIFE、能 tree-shaking、类型是精确的联合字面量。
>
> **declare**：作用是「告诉编译器这个东西运行时存在，但我不实现，你别报错」，**编译后完全不生成任何代码**。六种形式：变量、函数、类、namespace、module、global。`.d.ts` 就是「只含 declare 的文件」。
>
> 这里有个高频坑：**`declare global` 只能写在模块里**，如果文件没有 `import/export` 它就是「脚本」，所有顶层声明都是全局的，`declare global` 会报错。修法是加 `export {}`。同理，写 `.d.ts` 时忘了加 `export {}` 会让所有类型变成全局，导致冲突——这是最坑的地方。
>
> **namespace vs module**：namespace 编译成 IIFE，是 TS 自创的；module 是 ES 标准。namespace 被淘汰有三个原因：不能 tree-shaking、跨文件合并需要 `--outFile`（和模块图冲突）、和 ESM 语义混乱——同一个文件既有 namespace 又有 import/export 会让「这是模块还是脚本」变得模糊。
>
> 但 namespace 没完全死：写 `.d.ts` 给 jQuery 这类「函数 + 属性」的全局库补类型时，还得用 `declare namespace` 配合声明合并，因为没有别的语法能表达「一个既是函数又有属性的东西」。

### 追问表

| 追问 | 回答要点 |
|---|---|
| 数字枚举为什么有双向映射 | 编译产物用 `E[E["A"]=1]="A"` 嵌套赋值 |
| 字符串枚举有双向映射吗 | 没有，只生成正向 |
| `const enum` 和普通 enum 区别 | 被内联成字面量，不生成对象 |
| `const enum` 有什么问题 | `isolatedModules` 跨文件不可用；esbuild 会降级 |
| enum 为什么不能 tree-shaking | 属性访问无法静态分析用了哪个成员 |
| enum 类型安全吗 | TS 5.0 前不安全；5.0 后全字面量成员才安全 |
| 为什么用 `as const` 替代 enum | 可 tree-shaking、类型精确、JSON 友好 |
| `declare` 会生成代码吗 | **完全不生成** |
| `.d.ts` 是什么 | 只含 declare 的声明文件 |
| `declare global` 写在脚本里为什么报错 | 只能从模块作用域往全局扩，要先 `export {}` |
| `.d.ts` 忘加 `export {}` 会怎样 | 所有类型变全局，冲突 |
| `declare module` 和模块增强区别 | 前者定义新模块；在模块文件里写才是增强 |
| namespace 编译成什么 | IIFE |
| namespace 为什么淘汰 | 不能 tree-shaking、需要 outFile、非标准 |
| namespace 还在哪用 | `.d.ts` 给全局库补类型（声明合并） |
| script 和 module 怎么区分 | 有没有顶层 import/export |
| 为什么要 `import type` | 明确意图、`isolatedModules`/`verbatimModuleSyntax` 要求 |

---

## 8.9 速记卡

```
enum
  数字枚举：IIFE + ★双向映射（E[E["A"]=1]="A"）
  字符串枚举：只有正向
  const enum：内联成字面量，无对象；isolatedModules 下跨文件不可用
  三个问题：生成代码 / ★不能 tree-shaking / 数字枚举类型不安全
  现代替代：const S = {...} as const
           type S = typeof S[keyof typeof S]

declare
  「运行时存在，我不实现」→ ★完全不生成代码
  六形式：变量 / 函数 / 类 / namespace / module / global
  .d.ts = 只含 declare 的文件
  ★ declare global 必须写在模块里（加 export {}）
  ★ .d.ts 忘加 export {} → 所有类型变全局 → 冲突
  declare module 'foo' vs 模块增强（要在模块文件里）

namespace vs module
  namespace → IIFE，TS 自创
  module → ES 标准，import/export
  淘汰三因：不能 tree-shaking / 跨文件要 --outFile / 与 ESM 语义混乱
  残留用途：.d.ts 里给「函数+属性」的全局库补类型
  ★ script（无 import/export，全局作用域）vs module（模块作用域）
  现代必用：import type / export type（isolatedModules 要求）
```
