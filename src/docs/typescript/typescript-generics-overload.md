# TS · 05 泛型与方法重载

> 本册覆盖：泛型、方法重载
> 题单只给了 `identity<T>` 和一个 `pad` 的例子，**远不够**。泛型是 TS 里最能拉开差距的一块——面试官会顺着往「约束、推断、`keyof`、条件类型、映射类型、手写工具类型」追问。
> 本册按「泛型基础 → 类型运算符 → 条件/映射类型 → 手写工具类型 → 方法重载」的顺序展开。

---

## 5.1 一句话结论

**泛型是「类型参数化」**：把类型当参数传，让一份代码适配多种类型，同时**保持类型之间的关联关系**（输入什么类型，输出就对应什么类型）。
**方法重载是「同一个函数名，多组签名」**：让「输入类型 → 输出类型」的映射更精确。它和泛型的区别是——**泛型表达「关系」，重载表达「枚举」**。

---

## 5.2 泛型到底是什么（把定义说准）

### 5.2.1 一个没有泛型的痛点

```ts
// 方案 A：每种类型写一遍（重复）
function identityStr(x: string): string { return x; }
function identityNum(x: number): number { return x; }

// 方案 B：用 any（丢失类型信息）
function identityAny(x: any): any { return x; }
const n = identityAny(1);    // n 是 any，类型信息丢了

// 方案 C：用联合（丢失「输入输出对应」的关系）
function identityUnion(x: string | number): string | number { return x; }
const v = identityUnion('a');   // v 是 string | number，不是 string
```

**方案 C 的问题最关键**：传 `string` 进去，出来是 `string | number`——**「输入是 string 所以输出是 string」这个关系丢了**。

**泛型解决的正是「关系」**：

```ts
function identity<T>(x: T): T { return x; }

const a = identity('hello');   // a 是 'hello'
const b = identity(42);        // b 是 42
```

**`T` 把「参数类型」和「返回类型」绑定在一起了**——这才叫「类型参数化」。

### 5.2.2 `T` 只是一个约定名

```ts
function identity<Whatever>(x: Whatever): Whatever { return x; }
// 完全等价，T 只是社区习惯（Type 的首字母）
```

**常见命名约定**：

| 名字 | 含义 |
|---|---|
| `T` | Type（通用） |
| `U`、`V` | 第二个、第三个类型参数 |
| `K` | Key |
| `V` | Value |
| `E` | Element |
| `R` | Return |
| `P` | Props / Parameters |
| `A` | Args / Array |

**但语义化命名更好**：

```ts
function map<TInput, TOutput>(arr: TInput[], fn: (x: TInput) => TOutput): TOutput[];
```

### 5.2.3 泛型会保留「字面量类型」（这一点常被忽略）

```ts
function identity<T>(x: T): T { return x; }

const a = identity('hello');   // 类型是 'hello'，不是 string！
const b = identity(1);         // 类型是 1，不是 number！

// 如果想「拓宽」成 string/number，要加约束
function identity2<T extends string | number>(x: T): T { return x; }
// 仍然保留字面量…… 要拓宽得显式标注
const c: string = identity('hello');
```

**为什么**：泛型推断会尽量保留精确类型（这叫「字面量保留」）。**这在写常量、配置、判别联合时很有用，但也可能意外导致类型过窄。**

---

## 5.3 泛型的四个使用位置

### 5.3.1 函数

```ts
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}
```

### 5.3.2 接口

```ts
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

type UserRes = ApiResponse<{ id: string; name: string }>;
```

**这是实战里最常见的用法**——统一响应结构 + 泛型 data。

### 5.3.3 类型别名

```ts
type Nullable<T> = T | null;
type Pair<T, U> = [T, U];
type Dict<T> = Record<string, T>;
```

### 5.3.4 类

```ts
class Stack<T> {
  private items: T[] = [];
  push(item: T): void { this.items.push(item); }
  pop(): T | undefined { return this.items.pop(); }
  peek(): T | undefined { return this.items[this.items.length - 1]; }
}

const s = new Stack<number>();
s.push(1);
s.push('a');    // ❌ 报错
```

**也可以让 TS 推断**：

```ts
const s = new Stack<number>();
// 或者写工厂函数
function createStack<T>(): Stack<T> { return new Stack<T>(); }
const s2 = createStack<string>();   // 显式
```

### 5.3.5 泛型接口 vs 泛型函数（一个容易搞错的点）

```ts
// ① 泛型在接口上：整个接口共享一个 T
interface Repository<T> {
  find(id: string): T;
  save(item: T): void;
}

// ② 泛型在方法上：每个方法独立
interface Helper {
  parse<T>(s: string): T;
  stringify<T>(v: T): string;
}
```

**`Repository` 的所有方法必须用同一个 `T`；`Helper` 的每个方法可以有各自的 `T`。**

---

## 5.4 泛型约束 `extends`（必问）

### 5.4.1 为什么要约束

```ts
// ❌ 报错：T 上不存在 length
function getLength<T>(x: T): number {
  return x.length;
}

// ✅ 约束 T 必须有 length
function getLength<T extends { length: number }>(x: T): number {
  return x.length;
}

getLength('abc');        // ✅ string 有 length
getLength([1, 2, 3]);    // ✅ 数组有 length
getLength({ length: 5 });// ✅ 鸭子类型
getLength(123);          // ❌ number 没有 length
```

**注意这里的关键词是 `extends`，但语义是「约束 / 必须满足」**，不是「继承」。这是 TS 里 `extends` 的第二个用途（第三个是条件类型里）。

| `extends` 出现的场景 | 含义 |
|---|---|
| `class A extends B` | **继承**（运行时） |
| `interface A extends B` | **扩展**（类型） |
| `<T extends U>` | **约束**（T 必须是 U 的子类型） |
| `T extends U ? X : Y` | **条件判断**（类型层面 if） |

### 5.4.2 用 `keyof` 做约束（最经典的范式）

```ts
function get<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

const user = { name: 'alice', age: 18 };

get(user, 'name');    // 返回 string
get(user, 'age');     // 返回 number
get(user, 'email');   // ❌ 报错：'email' 不在 keyof typeof user 里
```

**这个模式三个泛型能力全用上了**：
1. `K extends keyof T`：约束 key 必须是 T 的键
2. `T[K]`：索引访问类型，返回精确的属性类型
3. **`obj[key]` 在实现里能通过检查**（TS 知道 `T[K]` 就是 `obj[key]` 的类型）

**这是「类型安全的对象取值」的标准写法**，lodash 的 `get`、React Hook Form 的 `register` 都是这个思路。

### 5.4.3 约束的常见形态

```ts
// ① 约束为对象
function merge<T extends object, U extends object>(a: T, b: U): T & U { ... }

// ② 约束为数组
function head<T extends any[]>(arr: T): T[0] { return arr[0]; }

// ③ 约束为函数
function wrap<T extends (...args: any[]) => any>(fn: T): T { return fn; }

// ④ 约束为字符串
function keys<T extends Record<string, any>>(obj: T): (keyof T)[] { ... }

// ⑤ 约束为某个具体形状
function render<T extends { id: string }>(item: T): string { ... }

// ⑥ 约束为「不能是某个类型」
// TS 没有 not 约束，通常用条件类型实现
```

---

## 5.5 泛型默认值

```ts
interface ApiResponse<T = unknown> {
  code: number;
  data: T;
}

// 不传时 T 是 unknown
const res: ApiResponse = { code: 0, data: 'anything' };

// 传了就覆盖
const res2: ApiResponse<{ id: string }> = { code: 0, data: { id: '1' } };
```

**规则和函数默认参数一样**：有默认值的必须在无默认值之后。

```ts
// ❌ 报错：Required type parameters must not follow optional type parameters
interface Bad<T = string, U> { }
```

**实战用途**：给工具类型提供合理默认值。

```ts
type DeepPartial<T, D extends number = 5> = ...
```

---

## 5.6 泛型推断：什么时候不用显式传

### 5.6.1 能推断的情况

```ts
// 从参数推断
function identity<T>(x: T): T { return x; }
identity('a');          // T 自动推断为 'a'

// 从回调推断
[1, 2, 3].map(x => x.toString());   // x 推断为 number

// 从返回值上下文推断
const arr: string[] = [];           // 空数组靠注解
```

### 5.6.2 无法推断、必须显式传的情况

```ts
// ① 类型参数没出现在参数里
function create<T>(): T { return {} as T; }
create<User>();         // 必须显式传，否则 T 是 unknown

// ② 只有一个泛型参数但用来控制返回
function fetchJson<T>(url: string): Promise<T> { ... }
fetchJson<User>('/api/user');    // 必须显式

// ③ 需要收窄到特定子类型
const el = document.querySelector<HTMLDivElement>('#app');
// 不传的话是 Element | null
```

### 5.6.3 推断失败时的行为

```ts
function pair<T>(a: T, b: T): [T, T] { return [a, b]; }

pair(1, 'a');    // ⚠️ T 推断为 number | string（联合），不报错
// 如果想报错，可以用 NoInfer 或者改成两个参数
```

**`NoInfer<T>`（TS 5.4）**：阻止从某个位置推断。

```ts
function createFSM<S extends string>(config: {
  initial: NoInfer<S>;      // 不从 initial 推断 S
  states: S[];
}) { }
```

---

## 5.7 三个类型运算符：`keyof` / `typeof` / 索引访问

### 5.7.1 `keyof`：取所有键的联合

```ts
interface User { name: string; age: number; readonly id: string }

type UserKeys = keyof User;     // 'name' | 'age' | 'id'
```

**注意 `keyof` 会包含所有键，不管是否 readonly/optional。**

```ts
type Optional = { a?: string };
type K = keyof Optional;   // 'a'
```

### 5.7.2 `typeof`（类型位置）：取值的类型

**注意：类型位置的 `typeof` 和运行时的 `typeof` 完全是两回事。**

```ts
const config = {
  port: 3000,
  host: 'localhost',
  features: ['a', 'b'],
};

type Config = typeof config;
// { port: number; host: string; features: string[] }
```

**`typeof` 只能用于「值」**：

```ts
type A = typeof User;    // ❌ 报错：User 是类型不是值
type B = typeof user;    // ✅ user 是变量
```

**经典组合：`typeof` + `keyof`**

```ts
const ROUTES = {
  home: '/',
  about: '/about',
  user: '/user/:id',
} as const;

type RouteName = keyof typeof ROUTES;         // 'home' | 'about' | 'user'
type RoutePath = typeof ROUTES[RouteName];    // '/' | '/about' | '/user/:id'
```

**这是「从常量表推导类型」的标准写法**，比手写枚举更可靠。

### 5.7.3 索引访问类型 `T[K]`

```ts
interface User { name: string; age: number; tags: string[] }

type Name = User['name'];         // string
type Tags = User['tags'];         // string[]
type TagsItem = User['tags'][number];  // string（数组元素）
type AllValues = User[keyof User];     // string | number | string[]
```

**`T[number]` 是取数组元素类型的惯用法**：

```ts
type Arr = ['a', 'b', 'c'];
type Item = Arr[number];    // 'a' | 'b' | 'c'

const COLORS = ['red', 'green', 'blue'] as const;
type Color = typeof COLORS[number];    // 'red' | 'green' | 'blue'
```

---

## 5.8 条件类型与 `infer`（高级，必答）

### 5.8.1 基本语法

```ts
type IsString<T> = T extends string ? true : false;

type A = IsString<'a'>;    // true
type B = IsString<1>;      // false
```

**注意：这里的 `extends` 是「能否赋值给」，不是继承。**

### 5.8.2 分布式条件类型（最容易答错的一点）

**当条件类型的「被检查类型」是裸类型参数，且传入的是联合类型时，会分发到每个成员。**

```ts
type ToArray<T> = T extends any ? T[] : never;

type R = ToArray<string | number>;
// 结果是 string[] | number[]，不是 (string | number)[]
```

**展开过程**：

```
ToArray<string | number>
→ (string extends any ? string[] : never) | (number extends any ? number[] : never)
→ string[] | number[]
```

**这就是「分布式条件类型」**，很多内置工具类型靠它工作（比如 `Exclude`）。

**如何阻止分发**：用元组包一层。

```ts
type ToArrayNoDist<T> = [T] extends [any] ? T[] : never;
type R2 = ToArrayNoDist<string | number>;    // (string | number)[]
```

**⚠️ `never` 是特例**：`never` 在分布式条件类型里**不分发**（因为空集没有成员可分）。

```ts
type R3 = ToArray<never>;    // never（不是 never[]）
```

### 5.8.3 `infer`：在条件类型里「提取」类型

```ts
// 提取函数返回值
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;
type R1 = ReturnType<() => string>;      // string

// 提取函数参数
type Parameters<T> = T extends (...args: infer P) => any ? P : never;
type P1 = Parameters<(a: string, b: number) => void>;    // [string, number]

// 提取数组元素
type ElementOf<T> = T extends (infer E)[] ? E : never;
type E1 = ElementOf<string[]>;           // string

// 提取 Promise 的值
type Unwrap<T> = T extends Promise<infer U> ? U : never;
type U1 = Unwrap<Promise<number>>;       // number

// 提取元组的第一个
type First<T extends any[]> = T extends [infer F, ...any[]] ? F : never;
type F1 = First<[string, number]>;       // string

// 多个 infer（协变位置会推断成联合，逆变位置推断成交叉）
type UnionToIntersection<U> =
  (U extends any ? (x: U) => void : never) extends ((x: infer I) => void) ? I : never;
```

**`infer` 的核心用法**：在 `extends` 的模式匹配里「捕获」某个位置的类型。

### 5.8.4 递归条件类型

```ts
// 深度 Awaited
type DeepAwaited<T> = T extends Promise<infer U> ? DeepAwaited<U> : T;
type A = DeepAwaited<Promise<Promise<number>>>;    // number

// 字符串转联合（模板字面量 + 递归）
type Split<S extends string, Sep extends string = ''> =
  S extends `${infer Head}${Sep}${infer Tail}`
    ? [Head, ...Split<Tail, Sep>]
    : [S];

type Parts = Split<'a,b,c', ','>;    // ['a', 'b', 'c']
```

**⚠️ 递归有深度限制**（约 50 层，或触发 `Type instantiation is excessively deep`）。

---

## 5.9 映射类型

### 5.9.1 基本语法

```ts
type Mapped<T> = {
  [K in keyof T]: T[K];
};
```

**`[K in keyof T]` 就是「遍历 T 的所有键」**，这是类型层面的 `for...in`。

### 5.9.2 三个修饰符

```ts
// ① 加可选
type MyPartial<T> = { [K in keyof T]?: T[K] };

// ② 加 readonly
type MyReadonly<T> = { readonly [K in keyof T]: T[K] };

// ③ 去掉修饰符（减号）
type MyRequired<T> = { [K in keyof T]-?: T[K] };
type MyMutable<T> = { -readonly [K in keyof T]: T[K] };
```

**`-?` 和 `-readonly` 里的减号是「移除修饰符」**，这是映射类型的一个重要语法。

### 5.9.3 键重映射（TS 4.1，`as` 子句）

```ts
// 生成 getter 类型
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

interface User { name: string; age: number }
type UserGetters = Getters<User>;
// { getName: () => string; getAge: () => number }

// 过滤掉某些键（映射成 never 会被移除）
type OmitByType<T, U> = {
  [K in keyof T as T[K] extends U ? never : K]: T[K];
};
```

**`as ... : never` 是「过滤键」的惯用法**——映射到 `never` 的键会被自动移除。

---

## 5.10 手写工具类型（面试必考）

### 5.10.1 `Partial` / `Required` / `Readonly`

```ts
type MyPartial<T> = { [K in keyof T]?: T[K] };
type MyRequired<T> = { [K in keyof T]-?: T[K] };
type MyReadonly<T> = { readonly [K in keyof T]: T[K] };
```

### 5.10.2 `Pick` / `Omit` / `Record`

```ts
type MyPick<T, K extends keyof T> = { [P in K]: T[P] };

type MyRecord<K extends keyof any, T> = { [P in K]: T };

type MyExclude<T, U> = T extends U ? never : T;

type MyOmit<T, K extends keyof any> = MyPick<T, MyExclude<keyof T, K>>;
```

**`Omit` 的实现思路值得说**：用 `Exclude` 从 `keyof T` 里减去 `K`，再 `Pick` 出来。

### 5.10.3 `ReturnType` / `Parameters`（用 `infer`）

```ts
type MyReturnType<T extends (...args: any) => any> =
  T extends (...args: any) => infer R ? R : never;

type MyParameters<T extends (...args: any) => any> =
  T extends (...args: infer P) => any ? P : never;
```

### 5.10.4 `DeepPartial`（最常考的一道）

**要处理四种情况**：数组、函数、对象、原始类型。

```ts
type DeepPartial<T> =
  T extends (infer U)[]                       // 数组 → 递归元素
    ? DeepPartial<U>[]
    : T extends readonly (infer U)[]           // 只读数组
      ? readonly DeepPartial<U>[]
      : T extends Function                     // 函数原样保留
        ? T
        : T extends object                     // 对象 → 递归每个属性
          ? { [K in keyof T]?: DeepPartial<T[K]> }
          : T;                                 // 原始类型原样
```

**为什么必须处理函数**：因为函数也是 `object`，如果不排除，会被递归成 `{}`。

**为什么数组要单独处理**：如果用 `{[K in keyof T]?: ...}` 处理数组，会得到「带所有数组方法的对象」，而不是数组。

**验证**：

```ts
interface Config {
  name: string;
  nested: { a: number; b: { c: boolean } };
  list: { id: string }[];
  fn: () => void;
}

type P = DeepPartial<Config>;
// {
//   name?: string;
//   nested?: { a?: number; b?: { c?: boolean } };
//   list?: DeepPartial<{ id: string }>[];
//   fn?: () => void;
// }
```

### 5.10.5 `UnionToTuple`（类型体操，加分）

```ts
type UnionToIntersection<U> =
  (U extends any ? (x: U) => void : never) extends ((x: infer I) => void) ? I : never;

type LastOfUnion<U> =
  UnionToIntersection<U extends any ? () => U : never> extends () => infer R ? R : never;

type UnionToTuple<U, Last = LastOfUnion<U>> =
  [U] extends [never] ? [] : [...UnionToTuple<Exclude<U, Last>>, Last];
```

**这段能写出来基本可以横着走了**，但面试一般不要求。知道「联合是乱序的，转元组要靠函数参数逆变」这个原理就够。

---

## 5.11 方法重载

### 5.11.1 基本结构：重载签名 + 实现签名

```ts
// 重载签名（对调用方可见，可以有多个）
function pad(n: number): string;
function pad(s: string): string;

// 实现签名（对调用方【不可见】，只能有一个）
function pad(value: number | string): string {
  return String(value).padStart(4, '0');
}

pad(1);         // ✅ 返回 string
pad('a');       // ✅ 返回 string
pad(true);      // ❌ 报错
```

### 5.11.2 五个必须知道的规则

**① 实现签名「对调用方不可见」**

```ts
function fn(x: string): string;
function fn(x: number): number;
function fn(x: string | number): string | number { return x; }

fn('a');        // ✅ 返回 string
fn(1);          // ✅ 返回 number
fn(true);       // ❌ 报错：没有匹配的重载（虽然实现签名也不接受 boolean）
```

**关键**：调用时**只检查重载签名**，实现签名完全不参与。所以你**不能靠实现签名放宽参数**：

```ts
function fn(x: string): string;
function fn(x: string | number): string { return String(x); }   // ⚠️ 实现签名更宽

fn(1);          // ❌ 仍然报错！因为重载签名里没有 number
```

**这是最反直觉的一点**——实现签名宽不等于调用能传。

**② 实现签名必须「兼容」所有重载签名**

```ts
function fn(x: string): string;
function fn(x: number): number;
function fn(x: number): string { return String(x); }
// ❌ 报错：这个重载签名与实现签名不兼容
//          （因为 string 的重载在实现里没被覆盖）
```

**③ 重载从上到下匹配，**更具体的放前面**

```ts
// ❌ 错误顺序：第一个 any 吞掉一切
function parse(x: any): any;
function parse(x: string): object;      // 永远不会被选中
function parse(x: any) { ... }

// ✅ 正确顺序：具体在前
function parse(x: string): object;
function parse(x: number): number;
function parse(x: string | number): object | number { ... }
```

**④ 箭头函数不能写重载**

```ts
// ❌ 语法错误
const fn = (x: string): string;
         (x: number): number;
         (x: any) => x;

// ✅ 用函数声明
function fn(x: string): string;
function fn(x: number): number;
function fn(x: any) { return x; }

// ✅ 或者用「带调用签名的接口」实现箭头函数
interface Fn {
  (x: string): string;
  (x: number): number;
}
const fn2: Fn = (x: any) => x;
```

**⑤ 类方法、对象方法都能重载**

```ts
class Formatter {
  format(x: string): string;
  format(x: number): string;
  format(x: string | number): string {
    return typeof x === 'string' ? x.trim() : x.toFixed(2);
  }
}
```

### 5.11.3 重载 vs 联合类型参数：怎么选

**核心判据：返回类型是否随输入类型变化。**

```ts
// ① 返回类型不随输入变 → 不需要重载
function log(x: string | number): void { }
// 用联合就够了

// ② 返回类型随输入变 → 需要重载
function parse(x: string): object;
function parse(x: number): number;
// 或者用泛型 + 条件类型
function parse<T extends string | number>(x: T): T extends string ? object : number;
```

**对比表**：

| | 重载 | 联合参数 | 泛型 + 条件类型 |
|---|---|---|---|
| 能表达「输入输出对应」 | ✅ | ❌ | ✅ |
| 可读性 | **好** | 好 | 差（复杂） |
| 实现里的类型收窄 | 需要手动判断 | 需要手动判断 | 需要断言 |
| 适合参数个数不同 | ✅ **很适合** | ❌ 不适合 | 一般 |
| 适合类型多（>5） | ❌ 冗长 | ✅ | ✅ |

**重载的真正优势：参数个数不同。**

```ts
// 这种场景联合类型做不到
function createElement(tag: string): HTMLElement;
function createElement(tag: string, props: object): HTMLElement;
function createElement(tag: string, props: object, ...children: Node[]): HTMLElement;
function createElement(tag: string, props?: object, ...children: Node[]) { ... }
```

### 5.11.4 实战：一个真实的 API 设计

```ts
// 事件系统：事件名 → 事件参数类型 的精确映射
interface EventMap {
  click: { x: number; y: number };
  keydown: { key: string };
  custom: { payload: unknown };
}

function on<K extends keyof EventMap>(
  event: K,
  handler: (data: EventMap[K]) => void
): void;

on('click', (d) => d.x);        // ✅ d 推断为 { x: number; y: number }
on('keydown', (d) => d.key);    // ✅ d 推断为 { key: string }
on('click', (d) => d.key);      // ❌ 报错：click 的参数没有 key
```

**这个模式比重载优雅得多**，而且是类型安全的。**这是「会用泛型」和「只会写 `<T>`」的分界线。**

---

## 5.12 常见坑

| 坑 | 正确说法 |
|---|---|
| **以为实现签名对调用方可见** | ❌ 只有重载签名可见；实现签名更宽也不会放宽调用 |
| **重载顺序写反** | 更具体的必须在前，`any`/宽泛的在后 |
| **用箭头函数写重载** | 不支持；用函数声明或「带调用签名的接口」 |
| **返回类型不随输入变还用重载** | 多余，用联合类型就够 |
| **以为泛型会「拓宽」字面量** | 泛型推断**保留**字面量（`identity('a')` 是 `'a'`） |
| **以为 `extends` 只有继承的意思** | 还有「泛型约束」和「条件判断」两个含义 |
| **分布式条件类型没意识到** | `T extends U ? X : Y` 在 T 是裸类型参数 + 联合时会分发 |
| **`DeepPartial` 没排除函数** | 函数也是 object，会被递归成 `{}` |
| **`DeepPartial` 没单独处理数组** | 会变成「带数组方法的对象」而不是数组 |
| **`typeof` 用在类型上** | ❌ `typeof` 只能用于值；取类型用 `keyof` / 索引访问 |
| **`NoInfer` 不知道** | TS 5.4 新增，用于阻止某处参与推断 |
| **类型体操写太深** | 会触发 `Type instantiation is excessively deep`，且拖慢编辑器 |

---

## 5.13 答题模板

### 30 秒版（泛型）

> 泛型是「类型参数化」——定义时不指定具体类型，使用时再传，用 `<T>` 表示。
> 它的核心价值不是「复用」，而是**保持类型之间的关联**：`function identity<T>(x: T): T` 能保证「传 string 进去，出来的就是 string」，而不是联合类型。
> 泛型可以用在函数、接口、类、类型别名上。配合 `extends` 做约束（比如 `T extends { length: number }`）、配合 `keyof` 做「类型安全的对象取值」（`<T, K extends keyof T>(obj: T, key: K): T[K]`）。
> 编译后泛型会被完全擦除，运行时拿不到 `T`。

### 30 秒版（方法重载）

> 方法重载是「多个重载签名 + 一个实现签名」。重载签名对调用方可见，**实现签名对调用方不可见**——所以调用时只按重载签名匹配。
> 三个要点：实现签名必须兼容所有重载签名；重载从上到下匹配，**更具体的要放前面**（否则被宽泛的吞掉）；箭头函数不能写重载。
> 重载的价值是让「输入类型 → 输出类型」的映射更精确。如果返回类型不随输入变化，用联合类型参数就够了，不需要重载。重载真正的优势场景是**参数个数不同**。

### 2 分钟版（串起来讲）

> 我把泛型分四层说：基础、约束、运算符、高级。
>
> **基础**：泛型是类型参数化，`<T>` 是约定名。核心价值是**保持类型关联**而不是复用——`identity<T>(x: T): T` 保证了输入输出同一个类型，用联合类型或 any 都会丢掉这个关系。泛型可以用在函数、接口、类、别名上。有个细节：泛型推断会**保留字面量**，`identity('a')` 得到的是 `'a'` 而不是 `string`。
>
> **约束**：`T extends U` 里的 `extends` 意思是「必须是 U 的子类型」，不是继承。最经典的范式是 `<T, K extends keyof T>(obj: T, key: K): T[K]`——三个能力都用上了：约束 key 的范围、索引访问取精确类型、实现里 `obj[key]` 能通过检查。这也是 lodash.get、React Hook Form 的 register 的底层思路。
>
> **运算符**：`keyof` 取键的联合，`typeof` 在类型位置取值类型（注意它和运行时 typeof 完全不同），`T[K]` 索引访问。最常用的组合是 `keyof typeof CONST`——从常量表推导联合类型，比手写枚举可靠。`as const` + `typeof obj[keyof typeof obj]` 是现代替代 enum 的标准写法。
>
> **高级**：条件类型 `T extends U ? X : Y`，配合 `infer` 能提取类型——`ReturnType` 就是 `T extends (...args: any) => infer R ? R : never`。这里有个必考点：**分布式条件类型**——当被检查的是裸类型参数且传入联合类型时，会分发到每个成员，所以 `ToArray<string | number>` 得到的是 `string[] | number[]` 而不是 `(string | number)[]`。要阻止分发就用 `[T] extends [U]` 包一层。`never` 是特例，它不分发。
>
> 然后是映射类型 `{[K in keyof T]?: T[K]}`，这是「类型层面的 for...in」，`-?` 和 `-readonly` 能去掉修饰符，`as` 子句能做键重映射。手写 `Partial`、`Pick`、`Omit`、`ReturnType` 都是基本功，`DeepPartial` 是最常考的一道——**必须单独处理数组和函数**，否则函数会被递归成 `{}`、数组会变成带数组方法的对象。
>
> 最后说重载。结构是多个重载签名加一个实现签名，**实现签名对调用方不可见**，所以实现写宽了也不会放宽调用。三个坑：实现签名必须兼容所有重载；重载从上到下匹配，具体的要放前面；箭头函数不能重载。判断要不要用重载：如果返回类型不随输入变，用联合就行；如果参数个数不同，重载最合适。不过更优雅的替代是「泛型 + 映射表」，比如事件系统里 `on<K extends keyof EventMap>(event: K, handler: (d: EventMap[K]) => void)`，比重载清晰得多。

### 追问表

| 追问 | 回答要点 |
|---|---|
| 泛型是什么 | 类型参数化，核心是保持类型关联 |
| 泛型编译后是什么 | 被完全擦除，运行时拿不到 T |
| `extends` 在泛型里是什么意思 | 约束（T 必须是 U 的子类型），不是继承 |
| `keyof T` 是什么 | T 所有键的联合 |
| `T[K]` 是什么 | 索引访问类型 |
| 类型位置的 `typeof` | 取某个**值**的类型；只能用于值 |
| 怎么从常量表推导联合类型 | `keyof typeof CONST`，配合 `as const` |
| 分布式条件类型是什么 | 裸类型参数 + 联合 → 分发到每个成员 |
| 怎么阻止分发 | `[T] extends [U]` 包一层 |
| `infer` 干什么 | 在条件类型里模式匹配并提取类型 |
| `Partial` 怎么实现 | `{[K in keyof T]?: T[K]}` |
| `Omit` 怎么实现 | `Pick<T, Exclude<keyof T, K>>` |
| `DeepPartial` 要注意什么 | 单独处理数组和函数 |
| `-?` 是什么 | 移除可选修饰符 |
| 映射类型的 `as` 子句 | 键重映射；映射到 `never` 会被移除 |
| 重载的实现签名可见吗 | **不可见**，调用只看重载签名 |
| 重载顺序有影响吗 | 有，具体的在前，否则被宽泛的吞掉 |
| 什么时候用重载 | 返回类型随输入变、或参数个数不同 |
| 重载能替代成泛型吗 | 能，用「泛型 + 映射表」更优雅（事件系统） |
| 箭头函数能重载吗 | 不能；用函数声明或带调用签名的接口 |

---

## 5.14 速记卡

```
泛型
  类型参数化，核心是「保持类型关联」（不是复用）
  位置：函数 / 接口 / 类型别名 / 类
  ★ 保留字面量：identity('a') 得到 'a' 不是 string
  ★ 编译后被完全擦除

约束
  <T extends U> 里的 extends = 「必须是 U 的子类型」
  经典范式：<T, K extends keyof T>(obj: T, key: K): T[K]

三个运算符
  keyof T        → 键的联合
  typeof value   → 值的类型（只能用于值！）
  T[K]           → 索引访问；T[number] 取数组元素
  常用：keyof typeof CONST（从常量表推联合）

条件类型
  T extends U ? X : Y
  ★ 分布式：裸 T + 联合 → 分发；阻止用 [T] extends [U]
  ★ never 不分发
  infer：在模式里捕获类型 → ReturnType / Parameters / Unwrap

映射类型
  { [K in keyof T]?: T[K] }   类型层面的 for...in
  -?  移除可选    -readonly  移除只读
  as 子句：键重映射；→ never 会被移除

手写工具类型
  Partial   {[K in keyof T]?: T[K]}
  Required  {[K in keyof T]-?: T[K]}
  Readonly  {readonly [K in keyof T]: T[K]}
  Pick      {[P in K]: T[P]}
  Omit      Pick<T, Exclude<keyof T, K>>
  Record    {[P in K]: T}
  ReturnType  T extends (...a:any)=>infer R ? R : never
  DeepPartial ★ 必须单独处理数组和函数

方法重载
  多个重载签名 + 一个实现签名
  ★ 实现签名对调用方不可见（写宽也没用）
  ★ 实现签名必须兼容所有重载签名
  ★ 从上到下匹配，具体的在前
  ★ 箭头函数不能重载（用带调用签名的 interface）
  用不用？返回类型不随输入变 → 用联合；参数个数不同 → 用重载
  更优雅替代：泛型 + EventMap 映射表
```
