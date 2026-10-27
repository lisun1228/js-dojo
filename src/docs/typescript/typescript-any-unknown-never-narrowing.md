# TS · 03 any / unknown / never / void 与类型收窄

> 本册覆盖：any vs unknown、unknown 转具体类型、never vs void、`is` 关键字、判断数组类型
> 四个特殊类型对应类型系统的四个边界：`any` 逃生舱、`unknown` 安全版、`never` 空集、`void` 无返回。

---

## 目录

- [3.1 一句话结论](#31-一句话结论)
- [3.2 `any`：不只是「不检查」，还会传染](#32-any不只是不检查还会传染)
- [3.3 `unknown`：安全的 any](#33-unknown安全的-any)
- [3.4 `never`：空集](#34-never空集)
- [3.5 `void`：真的没有返回值](#35-void真的没有返回值)
- [3.6 类型收窄的八种手段（这是本册最实用的部分）](#36-类型收窄的八种手段这是本册最实用的部分)
- [3.7 `unknown` 转具体类型的五种方式](#37-unknown-转具体类型的五种方式)
- [3.8 判断数组类型](#38-判断数组类型)
- [3.9 常见坑](#39-常见坑)
- [3.10 答题模板](#310-答题模板)
- [3.11 速记卡](#311-速记卡)

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
const n: number = x; // ✅ 不报错
const s: string = x; // ✅ 不报错
const fn: () => void = x; // ✅ 不报错
```

**这就是「关闭检查」的含义**——两个方向都不检查。

### 3.2.2 传染性

```ts
const x: any = getSomething();

// ① 运算：+ 仍是 any；* - / % ** 只在操作数为 number/any 时合法，结果是 number 或 any
const y = x + 1; // any
const z = x * 2; // number
const bad = x * 'abc'; // ❌ TS2363：右侧必须是 any/number/bigint/enum

// ② 属性访问还是 any
const name = x.user.profile.name; // any（整条链都是 any）

// ③ 函数返回值是 any
function f(a: any) { return a.foo; }   // 返回 any

// ④ 进数组，整个数组变 any[]
const list = [x, 1, 'a']; // any[]

// ⑤ 进对象，属性变 any
const obj = { data: x }; // { data: any }

// ⑥ 泛型推断被污染
const arr = [1, 2, 3];
arr.map((v) => x); // any[]
```

**后果**：一个有 `any` 的变量会顺着数据流污染整片代码，而且**编译器不会报错**——错误被推迟到运行时。这正是 `any` 与 `unknown` 的本质差距。

### 3.2.3 什么时候可以用 `any`

**不是完全禁用**，有四个合理场景：

| 场景 | 例子 | 更好的替代 |
|---|---|---|
| **渐进迁移** | 老 JS 文件临时标 `any` | 逐步补类型 |
| **第三方库确实没类型** | `const lib: any = require('old-lib')` | 写 `.d.ts` |
| **类型体操的中间态** | `T extends any ? ...`（分布式条件类型） | 无法替代 |
| **`console.log` 的包装** | `function log(...args: any[])` | 用 `unknown[]` |

**其余场景一律用 `unknown`。**

### 3.2.4 `noImplicitAny`

`strict: true` 包含 `noImplicitAny`，它只禁止「隐式 any」，**显式写 `any` 仍然合法**；要禁显式 any 得靠 ESLint 的 `@typescript-eslint/no-explicit-any`。

```ts
function f(x) { return x.foo; }   // ❌ TS7006：参数 x 隐式具有 any 类型
function g(x: unknown) { }        // ✅ 必须显式标注
```

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
const a: any = u; // ✅
const b: unknown = u; // ✅
const n: number = u; // ❌ TS2322
const s: string = u; // ❌ TS2322
const o: {} = u; // ❌ TS2322（{} 也不接受 unknown）
```

### 3.3.2 不能直接操作

```ts
declare const u: unknown;

u.toString(); // ❌ TS18046：'u' 的类型为 'unknown'
u.foo; // ❌ TS18046
u(); // ❌ TS18046，不能调用
u + 1; // ❌ TS18046，不能运算
u.length; // ❌ TS18046
new u(); // ❌ TS18046
```

**必须先用 3.6 节的手段收窄。**

### 3.3.3 为什么 `catch` 的变量是 `unknown`

TS 4.4 引入 `useUnknownInCatchVariables`，`strict` 下默认开启（`--useUnknownInCatchVariables false` 可退回 `any`）。原因：JS 里 `throw '字符串'`、`throw 42`、`throw { code: 500 }`、`throw null` 都合法，`catch` 到的值不一定是 `Error`，标成 `unknown` 强制你检查。

```ts
try {
  doSomething();
} catch (e) {
  // e 的类型是 unknown，不是 any
  e.message; // ❌ TS18046
  if (e instanceof Error) {
    e.message; // ✅ 收窄了
  }
}
```

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

### 3.4.2 `never` 的赋值规则

```ts
declare const n: never;

// ① never 可以赋给任何类型
const a: number = n; // ✅
const b: string = n; // ✅
const c: object = n; // ✅
const d: never = n; // ✅

// ② 任何类型（除 never）不能赋给 never
const e: never = 1; // ❌ TS2322
const f: never = undefined; // ❌ TS2322（strict 下）
```

**为什么 `never` 能赋给任何类型**：`never` 是空集，空集是任何集合的子集。它没有任何值，所以「所有 never 的值都是 number」空真。

### 3.4.3 最有价值的用途：穷尽检查（exhaustive check）

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

假设半年后有人给 `Shape` 加了 `{ kind: 'triangle' }`，三种写法的结果：

| 写法 | 结果 |
|---|---|
| 无 `default`、返回类型 `number` | 编译报 TS2366「缺少返回语句」，但错误指向函数末尾，不说明漏了哪个分支 |
| 返回类型含 `undefined` 或为 `void` | **编译通过**，运行时落到 `undefined` 或什么都不做 |
| `default` 里 `const _: never = s` | 编译报 TS2322「不能将 Shape 赋给 never」，错误直指漏掉的分支 |

**更简洁的写法**（用 `assertNever` 函数）：

```ts
function assertNever(x: never): never {
  throw new Error(`Unexpected: ${JSON.stringify(x)}`);
}

switch (s.kind) {
  // ...
  default:
    return assertNever(s); // 漏分支就报错
}
```

### 3.4.4 `never` 在类型运算里的行为

```ts
// ① 联合里 never 被吸收（never 是空集，并上任何集合等于那个集合）
type A = string | never;      // string

// ② 交叉里 never 吸收一切（交集为空）
type B = string & never;      // never

// ③ 分布式条件类型里，never 是空联合，分发时没有成员
type Dist<T> = T extends any ? T[] : never;
type C = Dist<string | number>;   // string[] | number[]
type D = Dist<never>;             // never（不是 never[]！）

// ④ ReturnType<() => never> = never
```

`never` 在分布式条件类型里不产生分支，所以 `Dist<never>` 直接得到 `never`。想关闭分配，用 `[T] extends [U]` 包一层：`type NoDist<T> = [T] extends [any] ? T[] : never`，此时 `NoDist<never>` 得到 `never[]`。

---

## 3.5 `void`：真的没有返回值

### 3.5.1 基本用法

```ts
function log(msg: string): void {
  console.log(msg);
  // 不需要 return，或者 return; （不能 return 值）
}

// ❌ TS2322
function bad(): void {
  return 1;
}
```

### 3.5.2 一个反直觉的规则：`() => void` 能接受任何返回值的函数

```ts
type Handler = () => void;

const h1: Handler = () => {}; // ✅
const h2: Handler = () => 123; // ✅ 合法！返回值被忽略
const h3: Handler = () => 'hello'; // ✅ 合法！

// 但反过来不行
type NumFn = () => number;
const f: NumFn = () => {}; // ❌ TS2322
```

**为什么允许**：`() => void` 的语义是「**我不关心你的返回值**」，而不是「你必须没有返回值」，所以任何返回值的函数都兼容。典型场景：

```ts
// forEach 要的是 () => void，回调返回 number 也不报错
[1, 2, 3].forEach((x) => x * 2);
```

这是赋值方向上的一次单向放宽：`() => number` 可以当 `() => void` 用，反过来不行。

### 3.5.3 `void` 类型的变量

```ts
let v: void = undefined;    // ✅
let v2: void = null;        // ❌ TS2322（strict 下）
let v3: void = 1;           // ❌ TS2322

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
| **字面量 / 判别联合** | `x === 'success'`、`switch (x.kind)` | 联合字面量、带判别字段的联合 |
| **真值判断 / `!= null`** | `if (x)`、`if (x != null)` | `if (x)` 排除所有 falsy（含 `''`/`0`/`NaN`）；`!= null` 只排除 `null`/`undefined` |
| **自定义守卫** | `x is T` | 复杂结构 |
| **断言函数** | `asserts x is T` | 需要抛异常的场景 |
| **`Array.isArray`** | `Array.isArray(x)` | 数组（见 3.8） |

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
typeof null;       // 'object'   ← JS 的历史 bug
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
type State = { count: number; items: { id: string }[] };

type Action =
  | { type: 'add'; payload: number }
  | { type: 'remove'; id: string }
  | { type: 'reset' };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'add':
      return { ...state, count: state.count + action.payload };   // ✅ payload 可用
    case 'remove':
      return { ...state, items: state.items.filter((i) => i.id !== action.id) };  // ✅ id 可用
    case 'reset':
      return { count: 0, items: [] };
  }
}
```

**这是 Redux / useReducer 的标准写法**：`switch` 到 `'add'` 时，编辑器只会补全 `payload`。

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

**四个要点**：

**① 编译器完全信任你，你可以「撒谎」**

```ts
// ⚠️ 这个守卫永远返回 true，编译器也信
function isString(x: unknown): x is string {
  return true;
}

process(123);    // 编译能过，运行时 x.toUpperCase 崩
```

**守卫写错了比 `as` 更危险**，因为它看起来像做了检查。

**② 必须返回 boolean**

```ts
function bad(x: unknown): x is string {
  return x;          // ❌ TS2322：unknown 不能赋给 boolean
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

### 3.6.6 断言函数 `asserts`

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

**Node.js 的 `assert` 就是用这个模式定义的**（`@types/node` 的 `assert.d.ts` 里是 `assert(value: unknown): asserts value`）：

```ts
import assert from 'node:assert';

function check(value: unknown) {
  assert(value);
  value.toString();   // ✅ 收窄成 {}（排除 falsy）
  value + 1;          // ❌ TS2365：{} 仍然不能运算
}
```

---

## 3.7 `unknown` 转具体类型的五种方式

### 3.7.1 总表

| 方式 | 安全性 | 写法 |
|---|---|---|
| **`typeof` 收窄** | ✅ 安全 | `if (typeof x === 'string')` |
| **`instanceof` 收窄** | ✅ 安全 | `if (x instanceof Date)` |
| **`in` 收窄** | ✅ 安全 | `if (typeof x === 'object' && x !== null && 'name' in x)` |
| **自定义守卫** | ✅ 安全（如果你写对） | `if (isUser(x))` |
| **断言 `as`** | ❌ **不安全** | `x as User` |

`Array.isArray` 也是 lib 内置的类型守卫，用法见 3.8。

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

### 3.7.3 可选链不是收窄手段

```ts
declare const x: unknown;

const r = x?.toString();   // ✅ 能编译，类型是 string | undefined
x.toString();              // ❌ TS18046：'x' 的类型为 'unknown'
x?.foo;                    // ❌ TS2339：Property 'foo' does not exist on type '{}'
```

`?.` 只是先判断 `null`/`undefined`，再把左侧按 `{}` 取属性，**不会把 `unknown` 变成具体类型**：`toString` 能过是因为 `{}` 自带它，自定义属性照样报错。所以 `unknown` 收窄只有上表的五种手段（`Array.isArray` 见 3.8），可选链不算——它是「处理 null」的语法，不是「收窄类型」的手段。

---

## 3.8 判断数组类型

### 3.8.1 `x is any[]` 的问题

```ts
function isArray(x: unknown): x is any[] {
  return Array.isArray(x);
}

if (isArray(x)) {
  x[0];         // any  ← 又回到 any 了，白收窄
}
```

`x is any[]` 会让元素访问变成 `any`，**继续传染**。

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

**其实可以直接用**，`lib.es5.d.ts` 里已经定义了守卫：

```ts
isArray(arg: any): arg is any[];
```

所以 `if (Array.isArray(x))` 里，`x` 会自动收窄成 `any[]`：

```ts
declare const x: unknown;
if (Array.isArray(x)) {
  x[0];     // any
}

// 自己写的版本可以收窄成 unknown[]
if (isArray(x)) {
  x[0];     // unknown
}
```

自己写的唯一理由是：想要 `unknown[]` 而不是 `any[]`，避免元素访问又退回 `any`。

---

## 3.9 常见坑

| 坑 | 正确说法 |
|---|---|
| **以为 `any` 只是「不检查自己」** | `any` 会**传染**：运算、属性访问、函数返回、进数组/对象，结果都带 `any` |
| **`noImplicitAny` 能禁掉所有 any** | 只禁**隐式**的，显式写 `any` 仍然允许（要 ESLint 规则） |
| **`unknown` 可以直接用** | 必须先收窄，否则任何操作都报 TS18046 |
| **可选链能收窄 unknown** | ❌ 不能，`x?.toString()` 只是按 `{}` 取属性，`x?.foo` 照样报错 |
| **`typeof null === 'object'` 会被漏掉** | 判断 object 时必须加 `x !== null` |
| **`typeof` 能区分数组** | ❌ 数组和对象都是 `'object'`，要用 `Array.isArray` |
| **`never` 不能赋给其他类型** | 相反，**`never` 是所有类型的子类型**，可以赋给任何类型 |
| **`void` 函数不能有返回值** | `() => void` **能接受**任何返回值的函数（返回值被忽略） |
| **自定义守卫一定安全** | 编译器**完全信任**你，写错了比 `as` 更危险 |
| **`is` 和 `asserts` 一样** | `is` 返回 boolean 放 if 里；`asserts` 抛异常，调用后自动收窄 |
| **`x is any[]` 就够了** | 会继续传染，建议 `unknown[]` 或带元素守卫的泛型版 |
| **以为 `never` 在联合里会单独成一支** | `string \| never` = `string`，空集被吸收 |

---

## 3.10 答题模板

### 30 秒版（any vs unknown）

- `any` 双向兼容，等于**关闭类型检查**；它参与运算、属性访问、函数返回都会继续带着 `any`，顺着数据流污染整个模块，编译器不报错。
- `unknown` 是**安全的 any**：什么都能赋给它，但它只能赋给 `any` / `unknown`，且不能直接操作，必须先收窄。
- 原则：能用 `unknown` 就别用 `any`。

### 30 秒版（never vs void）

- `void` 是「函数正常结束但没有返回值」，实际返回 `undefined`，典型是 `console.log`。
- `never` 是「函数永远不会正常结束」——抛异常或死循环；它是**空集**，所以是所有类型的子类型，反过来只有 `never` 能赋给 `never`。
- 最有价值的用法是**穷尽检查**：`default` 里把变量赋给 `never`，将来给联合加成员时编译会直接报错。

### 2 分钟版（把四者串起来讲）

- **`any`**：双向兼容、关闭检查；危害是会传染（`any + 1` 是 any、`any.foo.bar` 是 any、进数组变 `any[]`）；`noImplicitAny` 只禁隐式，显式 any 要 ESLint 规则。
- **`unknown`**：单向兼容、不能直接操作、必须先收窄；TS 4.4 把 `catch` 变量改成 `unknown`，因为 JS 里可以 `throw` 任何值。
- **`never`**：空集，三种来源（抛异常、死循环、不可能的分支），可赋给任何类型；穷尽检查与分布式条件类型都依赖这一点。
- **`void`**：正常结束但无返回值；`() => void` 能接受任何返回值的函数，因为语义是「不关心返回值」。
- **收窄**：`typeof` / `instanceof` / `in` / 字面量与判别联合 / 真值 / 自定义守卫 / `asserts` / `Array.isArray`；两个坑是 `typeof null === 'object'` 与自定义守卫完全靠自觉。

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
| 收窄有哪些手段 | typeof / instanceof / in / 字面量与判别联合 / 真值 / 自定义守卫 / asserts / Array.isArray |
| `typeof null` 是什么 | `'object'`（JS 历史 bug），必须额外判 `!== null` |
| `is` 和 `asserts` 区别 | 返回 boolean 放 if 里 / 抛异常，调用后自动收窄 |
| 自定义守卫安全吗 | 不安全，编译器完全信任，可以「撒谎」 |
| 为什么不写 `x is any[]` | 元素访问又变 any，等于没收窄；用 `unknown[]` |

---

## 3.11 速记卡

```
any
  双向兼容 = 关闭检查
  传染：+ 仍是 any；* - / % ** 只要另一侧是 number 就退成 number；属性链 / 返回值 / 进数组仍带 any
  合理场景：渐进迁移、无类型三方库、类型体操中间态、console.log 包装
  noImplicitAny 只禁隐式；显式要 ESLint no-explicit-any

unknown
  单向兼容：只能给 any/unknown
  不能直接操作 → 必须先收窄
  catch 变量是 unknown（TS 4.4，strict 默认）
  可选链不能收窄：x?.toString() 只是按 {} 取属性

never
  抛异常 / 死循环 / 不可能分支
  空集：可赋给任何类型；只有 never 能赋给它
  string | never = string；Dist<never> = never（空联合，不产生分支）
  穷尽检查：switch default 里 `const _: never = x`

void
  正常结束但无返回值（返回 undefined）
  () => void 能接受任何返回值的函数（「不关心返回值」）
  void 变量只能 undefined

收窄八种
  typeof（注意 typeof null === 'object'）
  instanceof（类实例）/ in（有某属性）
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
