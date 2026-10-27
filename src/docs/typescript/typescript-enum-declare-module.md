# TS · 08 枚举 · declare · namespace 与 module

> 覆盖：枚举、`declare` 关键字、命名空间与模块的区别 —— **3 个考点**
> 主线：enum 的编译产物与代价、`declare` 不生成代码、namespace 与 ESM 的机制差异

---

## 目录

- [8.1 一句话结论](#81-一句话结论)
- [8.2 枚举](#82-枚举)
- [8.3 `declare` 关键字](#83-declare-关键字)
- [8.4 namespace](#84-namespace)
- [8.5 module](#85-module)
- [8.6 namespace vs module 完整对比（核心）](#86-namespace-vs-module-完整对比核心)
- [8.7 常见坑](#87-常见坑)
- [8.8 答题模板](#88-答题模板)
- [8.9 速记卡](#89-速记卡)

---

## 8.1 一句话结论

| 概念 | 一句话 | 现在还用吗 |
|---|---|---|
| **`enum`** | 命名常量集合，**会生成运行时代码** | ⚠️ 新项目建议用 `as const` 替代 |
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
    Direction[Direction["Up"] = 1] = "Up";
    Direction[Direction["Down"] = 2] = "Down";
    Direction[Direction["Left"] = 3] = "Left";
})(Direction || (Direction = {}));
```

**`Direction[Direction["Up"] = 1] = "Up"` 的执行顺序**：

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

数字枚举的对象有 6 个键（3 个正 + 3 个反）。字符串枚举没有反向映射：

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
| **无法反向映射** | 没有对象，`E[1]` 编译期直接报 `TS2476` |
| **编译产物里有注释** | `/* E.A */` 方便调试 |

**三个坑（tsc 实测）**：

| 坑 | 实际行为 |
|---|---|
| **`isolatedModules` 下不内联** | 输出真实 enum 对象（含反向映射），`E.A` 退化为运行时属性访问 |
| **访问环境声明直接报错** | `declare const enum` + `isolatedModules` 报 `TS2748: Cannot access ambient const enums when 'isolatedModules' is enabled` |
| **`preserveConstEnums` 只保留对象** | 仍生成 IIFE 供运行时反向查找，但使用处依旧内联成 `1 /* E.A */` |

内联的前提是「全量 tsc 编译 + 未开 `isolatedModules`」。换成单文件转译（Vite 默认的 esbuild、Babel 都不做跨文件分析）就没有内联收益。

### 8.2.4 `declare enum`（环境枚举）

```ts
declare enum Direction {
  Up = 1,
  Down = 2,
}
```

**用途**：声明「运行时已经存在的枚举」（比如由别的脚本注入）。编译后不生成 enum 对象，使用处的 `Direction.Up` 保持为运行时属性访问。

### 8.2.5 enum 的三个问题（这是「为什么不用」的答案）

**问题 ①：每个 enum 都生成一段运行时代码，体积变大**

```ts
enum A { X, Y, Z }
enum B { P, Q, R }
```

声明两个 enum = 两段 IIFE，产物随枚举数量线性增长。

**问题 ②：不能被 tree-shaking（成员无法单独裁剪）**

```ts
enum Status { Idle, Loading, Success }

// 只用了 Idle，但整个 Status 对象都会保留
console.log(Status.Idle);
```

**为什么**：成员的值由 IIFE 在运行时赋值产生，打包器无法静态求值，只能把整个对象都保留。

**对比 `as const` 对象**：

```ts
const Status = { Idle: 0, Loading: 1, Success: 2 } as const;
```

对象字面量可以静态求值，`Status.Idle` 能常量折叠，未引用的属性不会进入产物。

**问题 ③：数字枚举可能退化成 `number`**

```ts
enum Direction { Up = 1, Down = 2 }
const d: Direction = 99;    // ❌ TS2322: Type '99' is not assignable to type 'Direction'

// 含计算成员的枚举不是联合枚举，仍接受任意数字
enum Computed { A = 'x'.length, B = 2 }
const c: Computed = 99;     // ✅ 不报错
```

联合枚举是 TS 5.0 才引入的：只有「所有成员都是字面量初始化」时，越界数字才会被拒；含计算成员的枚举，类型仍等价于 `number`。

### 8.2.6 现代替代方案：`as const` 对象 + 联合类型

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
| 运行时代码 | 生成 IIFE | 生成对象字面量 |
| **tree-shaking** | ❌ 整个对象保留 | ✅ 未引用属性可被折叠 |
| 类型精确度 | 数字枚举可能退化成 `number` | ✅ **精确的联合字面量** |
| 反向映射 | 数字枚举有 | ❌ 无（一般不需要） |
| 可迭代/`Object.keys` | ❌ 混入反向键 | ✅ 干净 |
| 与后端字符串对接 | 数字枚举要转换 | ✅ 直接就是字符串值 |
| IDE 提示 | ✅ | ✅ |
| 学习成本 | 低 | 中（要理解 `typeof` + `keyof`） |

### 8.2.7 什么时候 enum 仍然合适

| 场景 | 为什么 enum 还行 |
|---|---|
| **纯后端/Node 项目** | 不依赖打包裁剪，enum 写起来更直接 |
| **需要反向映射** | 数字枚举有 `Direction[1] === 'Up'` |
| **团队已经很熟 / C#、Java 背景** | 概念对应，迁移成本高 |

---

## 8.3 `declare` 关键字

### 8.3.1 一句话作用

**告诉编译器「这个东西在运行时存在，但我在这里不实现」，`declare` 声明编译后完全不生成代码。**

```ts
declare const VERSION: string;
declare function greet(name: string): void;
declare class Foo {}

console.log(VERSION);
```

```js
// 编译后：declare 全没了，只留使用处
console.log(VERSION);
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
```

```ts
// ⑥ 全局扩展（必须在模块文件里）
export {};
declare global {
  interface Window {
    __CONFIG__: { apiBase: string };
  }
}
```

**⑤ 和 ⑥ 不能写在同一个文件里**：一旦有 `export`，文件成为模块，⑤ 会被当成「增强已有模块」并报 `TS2664: Invalid module name in augmentation`。

### 8.3.3 `.d.ts` 声明文件

**`.d.ts` 就是「只包含声明语句的文件」**——它是**类型声明**，不是实现。

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

**这样 `import legacy, { init } from 'legacy-lib'` 就有类型了。**

### 8.3.4 三种模块声明的区别（容易混）

| 写法 | 含义 | 场景 |
|---|---|---|
| `declare module 'foo'` | **定义**一个新模块的类型（这个模块原本没有类型） | 给无类型的三方库补类型 |
| `declare module 'foo' { ... }` **在已有模块的 `.ts` 文件里** | **增强**已有模块的类型 | 给 vue-router 的 `RouteMeta` 加字段 |
| `declare global { ... }` | 给全局作用域加声明 | 给 `window` 加属性、加全局函数 |

**注意：模块增强必须在「模块文件」里（有 import/export）。** 脚本文件里写 `declare module './foo'` 会报 `TS2436: Ambient module declaration cannot specify relative module name`；写成非相对名 `declare module 'foo'`，则会被当成「定义新模块」而不是「增强」。

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

**为什么**：`declare global` 的语义是「从模块作用域往外扩一层到全局」。脚本文件本身就在全局，没有「外层」可扩。

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

**⚠️ `types` 配了之后就只加载列表里的**：`"types": []` 时 `process` 直接报 `TS2591: Cannot find name 'process'`。

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

**本质是「IIFE + 命名空间对象」**：变量封在函数作用域里，只把 `export` 的成员挂到对象上，和 ES Module 的机制完全不同。

### 8.4.3 为什么 namespace 被淘汰（三个原因）

| 原因 | 说明 |
|---|---|
| **① 成员无法单独裁剪** | IIFE 内部无法静态分析，用到任一成员，整个对象都会保留 |
| **② 跨文件合并要靠 `--outFile`** | `--outFile` 按顺序拼接文件，和现代打包工具的模块图冲突 |
| **③ 与 ES Module 并用时作用域割裂** | namespace 在模块文件里只在文件内可见，外部引用报 `TS2304`，同一项目里成了两套组织方式 |

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

**为什么必须用 namespace**：因为 `$` 既是函数又有属性（`$.ajax`），只有「函数 + 命名空间」的声明合并能同时表达两者。

**② 声明文件里的类型分组**

```ts
declare namespace MyLib {
  interface Options { }
  interface Result { }
}
```

**③ 老代码 / 从 C#、Java 迁移过来的代码**

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

| 类型 | 判定条件 | 顶层声明的作用域 |
|---|---|---|
| **脚本（script）** | **没有**顶层 `import` / `export` | **全局！** |
| **模块（module）** | **有**顶层 `import` / `export` | 模块作用域（文件内） |

```ts
// a.ts（没有 import/export → 脚本）
const foo = 1;        // ← 这是全局变量！会污染 globalThis

// b.ts（没有 import/export → 脚本）
const foo = 2;        // ❌ TS2451: Cannot redeclare block-scoped variable 'foo'
```

**修复方式**：加一个 `export {}` 让它变成模块。

```ts
// a.ts
const foo = 1;        // ← 现在只在文件内，不污染全局
export {};
```

**为什么这是坑**：`.d.ts` 或工具文件不加 `export {}` 时，所有顶层声明都变成全局的，导致：

- 类型名冲突（两个脚本各写一份 `type Cfg` 报 `TS2300`）
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
| **`verbatimModuleSyntax` 要求** | 开启后只用于类型的导入必须写 `type`，否则报 `TS1484` |

### 8.5.4 `export type`（同理）

```ts
// types.ts
export interface User { name: string }
export type Id = string;

// index.ts：再导出类型
export type { User, Id } from './types';
```

再导出类型时写 `export type`：`isolatedModules` 下写成 `export { User }` 会报 `TS1205: Re-exporting a type when 'isolatedModules' is enabled requires using 'export type'`。

---

## 8.6 namespace vs module 完整对比（核心）

| 维度 | `namespace` | `module`（ES Module） |
|---|---|---|
| **来源** | TS 自创（早期） | **ECMAScript 标准** |
| **编译产物** | **IIFE**（生成代码） | 保持 `import/export`（或转成 CJS/AMD） |
| **作用域** | 函数作用域（IIFE） | **模块作用域** |
| **跨文件合并** | 需要 `--outFile` 按顺序拼 | 模块图（`import` 解析） |
| **成员级裁剪** | ❌ **不能** | ✅ **能** |
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
| **以为 `const enum` 一定更好** | `isolatedModules` 下不内联；`preserveConstEnums` 只保留对象；单文件转译没有收益 |
| **以为 enum 类型一定安全** | 只有全字面量成员的联合枚举会拒绝越界数字；含计算成员的仍等价于 `number` |
| **以为 enum 能被按成员裁剪** | ❌ 不能，整段 IIFE 产物都会保留 |
| **说 `declare` 会生成空实现** | ❌ **完全不生成任何代码** |
| **`declare global` 写在脚本文件里** | ❌ 必须先在文件里加 `export {}` 变成模块 |
| **`.d.ts` 文件忘了加 `export {}`** | 所有声明变成全局，重名时报 `TS2300` |
| **模块增强写成 `declare module` 但文件是脚本** | 相对名报 `TS2436`；非相对名会被当成「定义新模块」，不是「增强」 |
| **说 namespace 只是「老写法」** | 它在 `.d.ts` 里给全局库补类型时仍不可替代（声明合并） |
| **`import` 和 `import type` 混用无所谓** | `verbatimModuleSyntax` 下必须区分；`isolatedModules` 要求再导出类型写 `export type` |
| **`types` 配了不影响其他类型** | 配了就**只加载列表内的**全局类型 |

---

## 8.8 答题模板

### 30 秒版（枚举）

- `enum` 定义命名常量，有数字、字符串、异构三种写法。
- 它生成运行时代码：数字枚举编译成 IIFE 并带**双向映射**（`Direction[Direction["Up"] = 1] = "Up"`），字符串枚举只有正向映射。
- `const enum` 使用处内联成字面量、不生成对象，前提是全量 tsc 编译且未开 `isolatedModules`。
- 代价是运行时代码、成员无法单独裁剪、含计算成员的数字枚举退化成 `number`；新项目用 `as const` 对象 + `typeof`/`keyof` 提取联合类型。

### 30 秒版（namespace vs module）

- `namespace` 是 TS 早期的模块化方案，编译成 **IIFE**，只把 `export` 的成员挂到对象上。
- `module` 是 **ES Module 标准**，一个文件一个模块，`import/export` 保持模块语义（或转成 CJS）。
- 三个区别：成员无法单独裁剪、跨文件合并要靠 `--outFile`、不是语言标准；现在只在 `.d.ts` 给全局库补类型时用。

### 2 分钟版（串起来讲）

- **枚举**：三种形态 → 编译产物（IIFE + 双向映射）→ `const enum` 的内联条件 → 三个代价 → `as const` 替代。
- **`declare`**：作用与「不生成代码」→ 六种形式 → `.d.ts` 是容器 → `declare global` 只能从模块作用域往外扩。
- **script vs module**：有无顶层 `import`/`export` 决定顶层声明是全局还是文件内，这是 `.d.ts` 冲突与 `declare global` 报错的共同根源。
- **namespace vs module**：运行时形态（IIFE vs 模块图）决定了成员裁剪、跨文件合并、工具链兼容的差异。
- **结论**：运行时组织用 ESM，类型声明用 `declare`，常量集合用 `as const`。

---

## 8.9 速记卡

```
enum
  数字枚举：IIFE + ★双向映射（E[E["A"]=1]="A"）
  字符串枚举：只有正向
  const enum：内联成字面量，无对象
             isolatedModules / 单文件转译下退化成普通 enum
             preserveConstEnums 只保留对象、不阻止内联；E[1] 报 TS2476
  三个问题：生成代码 / ★成员无法单独裁剪 / 数字枚举可能退化成 number
  现代替代：const S = {...} as const
           type S = typeof S[keyof typeof S]

declare
  「运行时存在，我不实现」→ ★完全不生成代码
  六形式：变量 / 函数 / 类 / namespace / module / global
  .d.ts = 只含声明语句的文件
  ★ declare global 必须写在模块里（加 export {}），否则 TS2669
  ★ .d.ts 忘加 export {} → 声明变全局 → 重名报 TS2300
  declare module（脚本里）= 定义新模块；增强要写在模块文件里，相对名报 TS2436

namespace vs module
  namespace → IIFE，TS 自创；写在模块文件里只在文件内可见（外部 TS2304）
  module → ES 标准，import/export
  淘汰三因：成员无法单独裁剪 / 跨文件要 --outFile / 与 ESM 并用作用域割裂
  残留用途：.d.ts 里给「函数+属性」的全局库补类型（函数 + namespace 声明合并）
  ★ script（无 import/export，全局作用域）vs module（模块作用域）
  类型再导出用 export type；只用于类型的导入用 import type（verbatimModuleSyntax）
```
