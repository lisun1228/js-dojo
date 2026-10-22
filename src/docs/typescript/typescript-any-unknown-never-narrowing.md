# TS · 03 any / unknown / never / void 与类型收窄

> 本册覆盖：any vs unknown、unknown 转具体类型、never vs void、`is` 关键字、判断数组类型
> 这四个特殊类型是「TS 类型系统的边界」：`any` 是**逃生舱**、`unknown` 是**安全版逃生舱**、`never` 是**空集**、`void` 是**无返回**。
> 题单只说「unknown 更安全」，没说 **`any` 会传染**——这才是最要命的。

---

## 3.1 一句话结论

| 类型 | 一句话 | 记忆 |
|---|---|---|
| **`any`** | **关闭类型检查**，而且**会传染** | 「别管我，也别管我碰过的一切」 |
| **`unknown`** | **安全的 any**：什么都能装，但**用之前必须先证明** | 「我不知道，你先证明给我看」 |
| **`never`** | **空集**：不可能有值 | 「永远不会发生」 |
| **`void`** | **无返回值** | 「干了事，但不给你东西」 |

---

## 3.2 `any`：不只是「不检查」，还会传染

### 3.2.1 `any` 的双向兼容

```ts
let x: any = 1;

// ① 任何类型都能赋给 any
x = 'hello';
x = true;
x = { a: 1 };
x = null;

// ② any 能赋给任何类型（不报错）
const n: number = x;      // ✅ 不报错
const s: string = x;      // ✅ 不报错
const fn: () => void = x; // ✅ 不报错
```

**这就是「关闭检查」的含义**——两个方向都不检查。

### 3.2.2 传染性（这是最要命的，题单没提）

```ts
const x: any = getSomething();

// ① 运算后还是 any
const y = x + 1;             // any
const z = x * 'abc';         // any（连这种都允许）

// ② 属性访问还是 any
const name = x.user.profile.name;   // any（x 是 any，整条链都是 any）

// ③ 函数返回值是 any
function f(a: any) { return a.foo; }   // 返回 any

// ④ 进数组，整个数组变 any[]
const list = [x, 1, 'a'];    // any[]

// ⑤ 进对象，属性变 any
const obj = { data: x };     // { data: any }

// ⑥ 泛型推断被污染
const arr = [1, 2, 3];
arr.map(v => x);             // any[]
```

**后果**：**一个有 `any` 的变量能顺着数据流污染整个模块**，让那一整片代码失去类型保护，而且**编译器不会警告你**。

**一个真实例子**：

```ts
// 某个第三方库返回 any
const res: any = legacyLib.fetch();

// 后面 200 行代码全部失去保护
const list = res.data.items.filter((i: any) => i.enabled);
const total = list.reduce((s: any, i: any) => s + i.price, 0);
renderTotal(total);     // total 是 any，传错也没人管
```

### 3.2.3 什么时候可以用 `any`

**不是完全禁用**，有三个合理场景：

| 场景 | 例子 | 更好的替代 |
|---|---|---|
| **渐进迁移** | 老 JS 文件临时标 `any` | 逐步补类型 |
| **第三方库确实没类型** | `const lib: any = require('old-lib')` | 写 `.d.ts` |
| **类型体操的中间态** | `T extends any ? ...`（分布式条件类型） | 无法替代 |
| **`console.log` 的包装** | `function log(...args: any[])` | 用 `unknown[]` |

**其余场景一律用 `unknown`。**

### 3.2.4 `noImplicitAny`

```json
{ "compilerOptions": { "noImplicitAny": true } }
```

**作用**：禁止「隐式 any」（比如函数参数没写类型）。**`strict: true` 会自动开启它。**

```ts
// noImplicitAny: false（危险）
function f(x) { return x.foo; }   // x 隐式 any，不报错

// noImplicitAny: true
function f(x) { return x.foo; }   // ❌ 报错：参数 x 隐式具有 any 类型
function f(x: unknown) { }        // ✅ 必须显式标注
```

> **注意**：`noImplicitAny` 只禁「隐式」的，**显式写 `any` 仍然允许**。要禁显式 any 得靠 ESLint 的 `@typescript-eslint/no-explicit-any`。

---

## 3.3 `unknown`：安全的 any

### 3.3.1 核心区别：单向兼容

```ts
let u: unknown = 1;

// ① 任何类型都能赋给 unknown（和 any 一样）
u = 'hello';
u = { a: 1 };
u = null;

// ② 但 unknown 只能赋给 any 或 unknown
const a: any = u;        // ✅
const b: unknown = u;    // ✅
const n: number = u;     // ❌ 报错
const s: string = u;     // ❌ 报错
```

### 3.3.2 不能直接操作

```ts
declare const u: unknown;

u.toString();       // ❌ 报错：'u' 的类型为 'unknown'
u.foo;              // ❌
u();                // ❌ 不能调用
u + 1;              // ❌ 不能运算
u.length;           // ❌
new u();            // ❌
```

**必须先用 3.6 节的手段收窄。**

### 3.3.3 为什么 `catch` 的变量是 `unknown`

**这是 TS 4.4 的一个重要变更（`useUnknownInCatchVariables`，`strict` 下默认开）。**

```ts
try {
  doSomething();
} catch (e) {
  // e 的类型是 unknown，不是 any
  e.message;              // ❌ 报错
  if (e instanceof Error) {
    e.message;            // ✅ 收窄了
  }
}
```

**为什么改**：因为 **JS 里 `throw` 可以扔任何东西**：

```js
throw '字符串';
throw 42;
throw { code: 500 };
throw null;
```

所以 `catch` 到的**不一定是 `Error`**。标成 `unknown` 强制你检查，这是正确的设计。

**实战写法**：

```ts
catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  logger.error(msg);
}
```

### 3.3.4 `unknown` 的最佳实践位置

| 位置 | 为什么用 unknown |
|---|---|
| **`catch` 变量** | 抛出的可能是任何值 |
| **`JSON.parse` 的结果** | 运行时才知道形状 |
| **函数参数（通用工具）** | 比如 `isString(x: unknown)` |
| **外部 API 响应** | 配合 zod 校验 |
| **事件回调的 `detail`** | `CustomEvent<unknown>` |
| **`localStorage.getItem` 的解析结果** | 字符串转对象后不可信 |

---

## 3.4 `never`：空集

### 3.4.1 三种产生方式

```ts
// ① 抛异常
function fail(msg: string): never {
  throw new Error(msg);
}

// ② 无限循环
function loop(): never {
  while (true) {}
}

// ③ 不可能成立的分支（穷尽检查）
function assertNever(x: never): never {
  throw new Error('unexpected: ' + x);
}
```

### 3.4.2 `never` 的赋值规则（必须记住）

```ts
declare const n: never;

// ① never 可以赋给任何类型
const a: number = n;      // ✅
const b: string = n;      // ✅
const c: object = n;      // ✅
const d: never = n;       // ✅

// ② 任何类型（除 never）不能赋给 never
const e: never = 1;       // ❌
const f: never = undefined; // ❌（strict 下）
```

**为什么 `never` 能赋给任何类型**：因为 `never` 是**空集**——「空集是任何集合的子集」。既然 `never` 没有任何值，那「所有 never 的值都是 number」这个命题**永真**（空真）。

### 3.4.3 最有价值的用途：穷尽检查（exhaustive check）

**这是一段必须背下来的模式**：

```ts
type Shape =
  | { kind: 'circle'; r: number }
  | { kind: 'square'; s: number }
  | { kind: 'rect'; w: number; h: number };

function area(s: Shape): number {
  switch (s.kind) {
    case 'circle':
      return Math.PI * s.r ** 2;
    case 'square':
      return s.s ** 2;
    case 'rect':
      return s.w * s.h;
    default:
      // ★ 如果上面漏了一个分支，s 就不是 never，这里会编译报错
      const _exhaustive: never = s;
      throw new Error(`unknown shape: ${_exhaustive}`);
  }
}
```

**价值在哪**：假设半年后有人给 `Shape` 加了 `{ kind: 'triangle' }`：

```
❌ 不加穷尽检查：编译通过 → 运行时 area() 返回 undefined → 线上 bug
✅ 加了穷尽检查：编译直接报错「不能将 Shape 赋给 never」→ 强制你处理
```

**这是「用类型系统防止未来的人犯错」的典型例子**，也是 TS 最有工程价值的能力之一。

**更简洁的写法**（用 `assertNever` 函数）：

```ts
function assertNever(x: never): never {
  throw new Error(`Unexpected: ${JSON.stringify(x)}`);
}

switch (s.kind) {
  case 'circle': return ...;
  case 'square': return ...;
  default: return assertNever(s);    // 漏分支就报错
}
```

> 面试话术：「`never` 最有价值的用法是穷尽检查。在一个 `switch` 的 `default` 分支里把变量赋给 `never` 类型，如果上面漏了某个分支，变量就不是 `never`，编译会直接报错。这样将来给联合类型加新成员时，编译器会强制你去处理所有分支——这是用类型系统防止未来的人犯错。」

### 3.4.4 `never` 在类型运算里的行为

```ts
// ① 联合里 never 被吸收（never 是空集，并上任何集合等于那个集合）
type A = string | never;      // string

// ② 交叉里 never 吸收一切（交集为空）
type B = string & never;      // never

// ③ 分布式条件类型里，never 会「跳过」
type Dist<T> = T extends any ? T[] : never;
type C = Dist<string | number>;   // string[] | number[]
type D = Dist<never>;             // never（不是 never[]！）

// ④ ReturnType<() => never> = never
```

**第 ③ 点是高频考点**：`never` 在分布式条件类型里是**唯一不参与分配**的类型（因为空集没有成员可分）。所以如果想「关闭分配」，可以用 `[T] extends [U]` 包一层。

---

## 3.5 `void`：真的没有返回值

### 3.5.1 基本用法

```ts
function log(msg: string): void {
  console.log(msg);
  // 不需要 return，或者 return; （不能 return 值）
}

// ❌ 报错
function bad(): void {
  return 1;
}
```

### 3.5.2 一个反直觉的规则：`() => void` 能接受任何返回值的函数

**这是 TS 特意设计的**：

```ts
type Handler = () => void;

const h1: Handler = () => {};         // ✅
const h2: Handler = () => 123;        // ✅ 合法！返回值被忽略
const h3: Handler = () => 'hello';    // ✅ 合法！

// 但反过来不行
type NumFn = () => number;
const f: NumFn = () => {};            // ❌ 报错：void 不能赋给 number
```

**为什么允许**：

```ts
// 典型场景：数组方法
[1, 2, 3].forEach((x) => x * 2);   // 回调返回 number，但 forEach 要的是 void

// 如果 () => void 不接受返回值，这里就报错了
```

**TS 的设计意图**：`() => void` 的语义是「**我不关心你的返回值**」，而不是「你必须没有返回值」。所以任何函数（不管返回什么）都兼容。

**这个规则叫「返回值类型协变 + void 特例」**，是 TS 官方 FAQ 里专门解释过的一点。

### 3.5.3 `void` 类型的变量

```ts
let v: void = undefined;    // ✅
let v2: void = null;        // ❌（strict 下）
let v3: void = 1;           // ❌

// 实际用途：泛型默认值
function create<T = void>(): T | void { }
```

**实战里 `void` 类型的变量基本不用**，`void` 只出现在函数返回值位置。

### 3.5.4 `never` vs `void` 完整对比

| 维度 | `void` | `never` |
|---|---|---|
| **语义** | 函数**正常结束**但没有返回值 | 函数**永远不会正常结束** |
| **返回值** | 返回 `undefined` | **不返回**（抛异常 / 死循环） |
| **能否赋值给其他类型** | 只能赋给 `any`/`unknown`/`void` | **可以赋给任何类型** |
| **其他类型能否赋给它** | `undefined` 可以 | **只有 `never`** |
| **是不是所有类型的子类型** | ❌ | ✅ **是** |
| **典型场景** | `console.log`、事件处理、`forEach` 回调 | `throw`、`while(true)`、穷尽检查 |
| **在联合类型里** | `string \| void` 有意义（可能没返回） | `string \| never` = `string`（被吸收） |
| **函数式意义** | 一个「副作用」 | 「底部类型（bottom type）」 |

**一句话记忆**：

> **`void` 是「返回了 undefined」，`never` 是「压根没返回」。**

---

## 3.6 类型收窄的八种手段（这是本册最实用的部分）

### 3.6.1 总表

| 手段 | 写法 | 适用 |
|---|---|---|
| **`typeof`** | `typeof x === 'string'` | 原始类型、函数 |
| **`instanceof`** | `x instanceof Date` | **类实例** |
| **`in`** | `'foo' in x` | 对象是否有某属性 |
| **字面量相等** | `x === 'success'` | 联合字面量 |
| **判别联合** | `switch (x.kind)` | 带判别字段的联合 |
| **真值判断** | `if (x)` | 排除 `null`/`undefined`/`''`/`0` |
| **`!= null`** | `if (x != null)` | 排除 null 和 undefined |
| **自定义守卫** | `x is T` | 复杂结构 |
| **断言函数** | `asserts x is T` | 需要抛异常的场景 |
| **`Array.isArray`** | `Array.isArray(x)` | 数组 |

### 3.6.2 `typeof` 的坑

```ts
typeof 'a';        // 'string'
typeof 1;          // 'number'
typeof true;       // 'boolean'
typeof undefined;  // 'undefined'
typeof Symbol();   // 'symbol'
typeof 1n;         // 'bigint'
typeof (() => {}); // 'function'
typeof {};         // 'object'
typeof null;       // 'object'   ← JS 的历史 bug！
typeof [];         // 'object'   ← 数组也是 object
```

**两个必须记住的坑**：

```ts
// ❌ 错误：null 也会通过
if (typeof x === 'object') {
  x.toString();     // 如果 x 是 null，崩
}

// ✅ 正确：要先排除 null
if (typeof x === 'object' && x !== null) { }
```

```ts
// ❌ 数组和对象都是 'object'，区分不了
// ✅ 用 Array.isArray
if (Array.isArray(x)) { }
```

### 3.6.3 `in` 收窄

```ts
type A = { a: string };
type B = { b: number };

function f(x: A | B) {
  if ('a' in x) {
    x.a;    // ✅ 收窄为 A
  } else {
    x.b;    // ✅ 收窄为 B
  }
}
```

### 3.6.4 判别联合（最实用的模式）

```ts
type Action =
  | { type: 'add'; payload: number }
  | { type: 'remove'; id: string }
  | { type: 'reset' };

function reducer(state: State, action: Action) {
  switch (action.type) {
    case 'add':
      return { ...state, count: state.count + action.payload };   // ✅ payload 可用
    case 'remove':
      return { ...state, items: state.items.filter(i => i.id !== action.id) };  // ✅ id 可用
    case 'reset':
      return initialState;
  }
}
```

**这是 Redux / useReducer 的标准写法**，也是 TS 最能提升开发体验的地方——`switch` 到 `'add'` 时，编辑器只会补全 `payload`。

### 3.6.5 自定义守卫 `is`

```ts
function isString(x: unknown): x is string {
  return typeof x === 'string';
}

function process(x: unknown) {
  if (isString(x)) {
    x.toUpperCase();    // ✅ x 收窄为 string
  }
}
```

**三个必须知道的点**：

**① 编译器完全信任你，你可以「撒谎」**

```ts
// ⚠️ 这个守卫永远返回 true，编译器也信
function isString(x: unknown): x is string {
  return true;
}

process(123);    // 编译能过，运行时 x.toUpperCase 崩
```

**所以自定义守卫是「有安全责任的代码」**，写错了比 `as` 更危险（因为看起来像做了检查）。

**② 必须返回 boolean**

```ts
function bad(x: unknown): x is string {
  return x;          // ❌ 报错：必须返回 boolean
}
```

**③ 可以守卫 `this`**

```ts
class Foo {
  isFoo(): this is Foo { return true; }
}
```

**④ 类型守卫可以组合（用 `is` 联合）**

```ts
function isStringOrNumber(x: unknown): x is string | number {
  return typeof x === 'string' || typeof x === 'number';
}
```

### 3.6.6 断言函数 `asserts`（TS 3.7，比 `is` 更优雅在某些场景）

```ts
function assertIsString(x: unknown): asserts x is string {
  if (typeof x !== 'string') {
    throw new TypeError('expected string');
  }
}

function process(x: unknown) {
  assertIsString(x);
  x.toUpperCase();    // ✅ 调用之后就收窄了，不需要 if
}
```

**`is` vs `asserts` 的区别**：

| | `x is T` | `asserts x is T` |
|---|---|---|
| 返回类型 | `boolean` | **`void`**（但会抛异常） |
| 用法 | 必须放在 `if` / `&&` 里 | **直接调用**，之后自动收窄 |
| 失败时 | 返回 `false` | **抛异常** |
| 适用 | 需要分支处理 | 「不满足就该挂」的前置条件 |

**Node.js 的 `assert` 就是用这个模式定义的**：

```ts
import assert from 'node:assert';
assert(value);    // asserts value
// 之后 value 被收窄为非 falsy
```

---

## 3.7 `unknown` 转具体类型的五种方式

### 3.7.1 总表

| 方式 | 安全性 | 写法 |
|---|---|---|
| **`typeof` 收窄** | ✅ 安全 | `if (typeof x === 'string')` |
| **`instanceof` 收窄** | ✅ 安全 | `if (x instanceof Date)` |
| **`in` 收窄** | ✅ 安全 | `if ('name' in x)` |
| **自定义守卫** | ✅ 安全（如果你写对） | `if (isUser(x))` |
| **断言 `as`** | ❌ **不安全** | `x as User` |
| **`Array.isArray`** | ✅ 安全 | `if (Array.isArray(x))` |

### 3.7.2 完整示例

```ts
function handle(input: unknown) {
  // ① typeof
  if (typeof input === 'string') {
    return input.toUpperCase();
  }

  // ② instanceof
  if (input instanceof Date) {
    return input.toISOString();
  }

  // ③ in（注意要先排除 null）
  if (typeof input === 'object' && input !== null && 'name' in input) {
    return (input as { name: string }).name;
  }

  // ④ 自定义守卫（推荐）
  if (isUser(input)) {
    return input.name;
  }

  // ⑤ 断言（危险，只在确定时用）
  return (input as { fallback: string }).fallback;
}
```

### 3.7.3 题 22 的一个坑：题单说「三种方式」，其实不止

题单写「三种方式：类型断言、类型守卫、可选链」，**可选链不是类型收窄手段**：

```ts
const x: unknown = null;
x?.toString();    // ❌ 报错：'x' 的类型为 'unknown'
```

**可选链要求左边已经是「可能为 null/undefined 的对象类型」，`unknown` 上不能直接用可选链**。必须先收窄成对象。

**正确表述**：`unknown` 收窄有 **`typeof` / `instanceof` / `in` / 自定义守卫 / `Array.isArray` / 断言** 六种，**可选链不算**（它是「处理 null」的语法，不是「收窄类型」的手段）。

---

## 3.8 判断数组类型

### 3.8.1 题单的答案，以及它的不足

```ts
// 题单的答案
function isArray(x: unknown): x is any[] {
  return Array.isArray(x);
}
```

**逻辑正确，但类型不够好**——`x is any[]` 会让元素访问变成 `any`，**继续传染**：

```ts
if (isArray(x)) {
  x[0];         // any  ← 又回到 any 了，白收窄
}
```

### 3.8.2 更好的写法：`unknown[]`

```ts
function isArray(x: unknown): x is unknown[] {
  return Array.isArray(x);
}

if (isArray(x)) {
  x[0];         // unknown  ← 至少还需要再收窄，不会传染
  x.length;     // number   ← 长度可以安全访问
}
```

### 3.8.3 更精确的写法：带元素守卫

```ts
// 判断「是不是 string 数组」
function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((i) => typeof i === 'string');
}

// 泛型版（复用）
function isArrayOf<T>(
  x: unknown,
  guard: (item: unknown) => item is T
): x is T[] {
  return Array.isArray(x) && x.every(guard);
}

if (isArrayOf(x, isString)) {
  x[0].toUpperCase();    // ✅ 元素也收窄了
}
```

### 3.8.4 为什么不直接用 `Array.isArray`

**其实可以直接用**，TS 的 lib 里已经定义了：

```ts
// lib.es5.d.ts
isArray(arg: any): arg is any[];
```

**所以在 `if (Array.isArray(x))` 里，`x` 会自动收窄成 `any[]`**。

**那为什么还要自己写**？两个理由：
1. 面试题要求「用 TS 实现一个方法」
2. 想要 `unknown[]` 而不是 `any[]`（避免传染）

```ts
// 如果直接用，会收窄成 any[]
declare const x: unknown;
if (Array.isArray(x)) {
  x[0];     // any
}

// 用自定义的，收窄成 unknown[]
if (isArray(x)) {
  x[0];     // unknown
}
```

> **面试话术**：「`Array.isArray` 本身在 TS 的 lib 里就是类型守卫，签名是 `arg is any[]`，所以直接用就能收窄。但如果自己实现，我建议返回 `x is unknown[]` 而不是 `any[]`——因为 `any[]` 会让元素访问又变回 any，等于没收窄。更进一步可以写一个带元素守卫的泛型版本 `isArrayOf<T>(x, guard): x is T[]`。」

---

## 3.9 常见坑

| 坑 | 正确说法 |
|---|---|
| **以为 `any` 只是「不检查自己」** | `any` 会**传染**：运算、属性访问、函数返回、进数组/对象，结果都是 `any` |
| **`noImplicitAny` 能禁掉所有 any** | 只禁**隐式**的，显式写 `any` 仍然允许（要 ESLint 规则） |
| **`unknown` 可以直接用** | 必须先收窄，否则任何操作都报错 |
| **可选链能收窄 unknown** | ❌ 不能，`unknown` 上不能用 `?.` |
| **`typeof null === 'object'` 会被漏掉** | 判断 object 时必须加 `x !== null` |
| **`typeof` 能区分数组** | ❌ 数组和对象都是 `'object'`，要用 `Array.isArray` |
| **`never` 不能赋给其他类型** | 相反，**`never` 是所有类型的子类型**，可以赋给任何类型 |
| **`void` 函数不能有返回值** | `() => void` **能接受**任何返回值的函数（返回值被忽略） |
| **自定义守卫一定安全** | 编译器**完全信任**你，写错了比 `as` 更危险 |
| **`is` 和 `asserts` 一样** | `is` 返回 boolean 放 if 里；`asserts` 抛异常，调用后自动收窄 |
| **`x is any[]` 就够了** | 会继续传染，建议 `unknown[]` 或带元素守卫的泛型版 |
| **`never` 在联合里有用** | `string \| never` = `string`，会被吸收 |

---

## 3.10 答题模板

### 30 秒版（any vs unknown）

> `any` 是**关闭类型检查**——任何类型能赋给它，它也能赋给任何类型，而且**会传染**：`any` 参与运算、属性访问、函数返回，结果都是 `any`，一个有 any 的变量能污染整个模块。
> `unknown` 是**安全的 any**——任何类型能赋给它，但它**只能赋给 any 或 unknown**，而且**不能直接操作**（不能访问属性、不能调用、不能运算），必须先收窄。
> 所以原则是：能用 `unknown` 就别用 `any`。

### 30 秒版（never vs void）

> `void` 是「函数正常结束但没有返回值」，实际返回 `undefined`，典型是 `console.log`。
> `never` 是「函数永远不会正常结束」——要么抛异常，要么死循环。它在类型系统里是**空集**，所以是**所有类型的子类型**（能赋给任何类型），反过来只有 `never` 能赋给 `never`。
> `never` 最有价值的用法是**穷尽检查**：在 `switch` 的 `default` 里把变量赋给 `never`，将来给联合类型加新成员时编译会直接报错，强制你处理。

### 2 分钟版（把四者串起来讲）

> 这四个特殊类型其实是「类型系统的四个边界」，我一个个说。
>
> **`any`** 是逃生舱，双向兼容、完全关闭检查。但它的危害不只是「自己不被检查」，而是**会传染**——`any + 1` 是 any，`any.foo.bar` 是 any，`any` 作为参数返回还是 any，进数组就变成 any[]。所以一个大 any 能顺着数据流污染整片代码，而编译器不会警告。`noImplicitAny` 只能禁隐式的，显式写 any 还是允许，要彻底禁得靠 ESLint。
>
> **`unknown`** 是安全版的 any。区别只有一个：**单向兼容**——什么都能赋给它，但它只能赋给 any 和 unknown，而且不能直接操作，必须先收窄。TS 4.4 把 `catch` 变量从 any 改成 unknown 就是这个原因：JS 里可以 `throw` 任何值，不一定是 Error，所以必须先 `instanceof Error` 检查。
>
> **`never`** 是空集。三种产生方式：抛异常、死循环、不可能的分支。它的赋值规则很特殊——**可以赋给任何类型**（空集是任何集合的子集），但只有 never 能赋给自己。最有价值的用法是**穷尽检查**：`switch` 的 default 里写 `const _: never = x`，漏分支就编译报错。这样半年后有人给联合类型加成员，编译器会强制他处理所有分支。
>
> **`void`** 是「无返回值」。这里有个反直觉但很重要的规则：**`() => void` 能接受任何返回值的函数**。因为 void 的语义是「我不关心你的返回值」，不是「你必须没有返回值」。这就是为什么 `[1,2,3].forEach(x => x * 2)` 不报错——回调返回 number，但 forEach 要的是 void。
>
> 最后说收窄。手段有 `typeof`、`instanceof`、`in`、字面量相等、判别联合、真值判断、自定义守卫 `x is T`、断言函数 `asserts x is T`。两个坑要提醒：`typeof null` 是 `'object'`，所以判断对象必须加 `!== null`；自定义守卫编译器是**完全信任**的，写错了比 `as` 更危险，因为它看起来像做了检查。

### 追问表

| 追问 | 回答要点 |
|---|---|
| any 和 unknown 区别 | 单向兼容：unknown 只能赋给 any/unknown；且不能直接操作 |
| any 有什么危害 | 会传染，污染整条数据流，且不警告 |
| 什么时候可以用 any | 渐进迁移、无类型三方库、类型体操中间态 |
| 怎么禁掉 any | `noImplicitAny`（只禁隐式）+ ESLint `no-explicit-any` |
| 为什么 catch 是 unknown | JS 可以 throw 任何值，不一定是 Error（TS 4.4） |
| never 能赋给 number 吗 | 能，never 是所有类型的子类型（空集是任何集合的子集） |
| never 有什么用 | 穷尽检查、抛异常函数的返回类型、条件类型里的空联合 |
| `string \| never` 是什么 | `string`（never 被吸收） |
| `() => void` 能接受 `() => number` 吗 | **能**，void 表示「不关心返回值」 |
| void 变量能赋什么 | 只能是 `undefined` |
| 收窄有哪些手段 | typeof / instanceof / in / 字面量 / 判别联合 / 真值 / 自定义守卫 / asserts |
| `typeof null` 是什么 | `'object'`（JS 历史 bug），必须额外判 `!== null` |
| `is` 和 `asserts` 区别 | 返回 boolean 放 if 里 / 抛异常，调用后自动收窄 |
| 自定义守卫安全吗 | 不安全，编译器完全信任，可以「撒谎」 |
| 为什么不写 `x is any[]` | 元素访问又变 any，等于没收窄；用 `unknown[]` |

---

## 3.11 速记卡

```
any
  双向兼容 = 关闭检查
  ★ 会传染：any+1 / any.foo / 返回 any / 进数组变 any[]
  合理场景：渐进迁移、无类型三方库、类型体操
  noImplicitAny 只禁隐式；显式要 ESLint no-explicit-any

unknown
  单向兼容：什么都能给它，它只能给 any/unknown
  不能直接操作（属性/调用/运算全报错）→ 必须先收窄
  catch 变量是 unknown（TS 4.4）：JS 可 throw 任何值
  最佳位置：catch / JSON.parse / 外部响应 / 通用工具参数

never
  抛异常 / 死循环 / 不可能分支
  ★ 空集：可赋给任何类型；只有 never 能赋给它
  联合里被吸收（string | never = string）
  ★ 穷尽检查：switch default 里 `const _: never = x`
  分布式条件类型里 never 不参与分配

void
  正常结束但无返回值（返回 undefined）
  ★ () => void 能接受任何返回值的函数（「不关心返回值」）
  void 变量只能 undefined

收窄手段
  typeof（注意 typeof null === 'object'）
  instanceof（类实例）
  in（有某属性）
  字面量相等 / 判别联合（switch on kind）
  真值 / != null
  自定义守卫 x is T（编译器完全信任，写错很危险）
  断言函数 asserts x is T（抛异常，调用后自动收窄）
  Array.isArray（lib 里已是守卫，返回 any[]；自写建议 unknown[]）

isArray 三档
  x is any[]      → 元素还是 any（没收窄）
  x is unknown[]  → 推荐，元素需再收窄
  isArrayOf<T>(x, guard): x is T[]  → 最精确
```
