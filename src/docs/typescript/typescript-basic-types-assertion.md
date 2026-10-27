# TS · 02 类型系统基础：原始类型 · 联合 · 断言

> 覆盖：内置数据类型、联合类型数组、变量声明、null/undefined 检查、类型断言
> 四个易错点：`object` vs `Object` vs `{}`、`const` 推断的字面量拓宽、`??` vs `||`、`as` 不做运行时转换。

---

## 目录

- [2.1 一句话结论](#21-一句话结论)
- [2.2 类型全表](#22-类型全表)
- [2.3 `object` vs `Object` vs `{}`（最高频的坑之一）](#23-object-vs-object-vs-最高频的坑之一)
- [2.4 数组与元组](#24-数组与元组)
- [2.5 联合类型的使用限制](#25-联合类型的使用限制)
- [2.6 变量声明与类型推断](#26-变量声明与类型推断)
- [2.7 null / undefined 的检查](#27-null--undefined-的检查)
- [2.8 类型断言](#28-类型断言)
- [2.9 常见坑](#29-常见坑)
- [2.10 答题模板](#210-答题模板)
- [2.11 速记卡](#211-速记卡)

---

## 2.1 一句话结论

TS 的类型分四组：**原始类型**（7 种）、**对象类型**（object/array/tuple/function…）、**特殊类型**（any/unknown/never/void）、**字面量类型**（`'a'`、`1`）。
写类型有三种方式：**类型注解（`:`）**、**类型断言（`as`）**、**类型推断（不写）**——**首选推断，其次注解，慎用断言**。

---

## 2.2 类型全表

### 2.2.1 七种原始类型

| 类型 | 例子 | 备注 |
|---|---|---|
| **`string`** | `'a'`、`` `tpl` `` | |
| **`number`** | `1`、`1.5`、`NaN`、`Infinity` | **不区分整数和浮点** |
| **`boolean`** | `true` / `false` | |
| **`null`** | `null` | `strictNullChecks` 下是独立类型 |
| **`undefined`** | `undefined` | 同上 |
| **`symbol`** | `Symbol('a')` | ES2015 |
| **`bigint`** | `10n` | ES2020，需要 `target >= ES2020` |

> **常见错误**：把 `void` 说成「原始类型」。`void` 是**函数返回值**的类型，表示「没有返回值」，不是原始值类型。

### 2.2.2 对象类型（一组）

| 类型 | 写法 | 说明 |
|---|---|---|
| **`object`** | `object` | **非原始类型**（见 2.3 的坑） |
| **数组** | `T[]` / `Array<T>` | 等价 |
| **只读数组** | `readonly T[]` / `ReadonlyArray<T>` | 不能 `push`/`pop` |
| **元组** | `[string, number]` | 定长、定类型 |
| **对象字面量** | `{ a: string; b?: number }` | |
| **函数** | `(a: string) => void` | |
| **构造器** | `new () => Foo` | |
| **内置对象** | `Date`、`RegExp`、`Error`、`Promise<T>`、`Map<K,V>`、`Set<T>` | |

### 2.2.3 特殊类型

| 类型 | 含义 | 一句话 |
|---|---|---|
| **`any`** | 关闭检查 | 「别管我」（会传染，见 03 册） |
| **`unknown`** | 安全的任意 | 「我不知道，你先证明」（必须收窄） |
| **`never`** | 空集，不存在值 | 「永远不会有结果」（抛异常/死循环/穷尽检查） |
| **`void`** | 无返回值 | 「函数干了事但不返回东西」 |

### 2.2.4 高级类型

| 类别 | 例子 |
|---|---|
| **联合类型** | `string \| number` |
| **交叉类型** | `A & B` |
| **字面量类型** | `'success' \| 'error'`、`1 \| 2 \| 3` |
| **模板字面量类型** | `` `prefix-${string}` ``（TS 4.1） |
| **条件类型** | `T extends U ? X : Y` |
| **映射类型** | `{ [K in keyof T]: T[K] }` |
| **索引访问类型** | `T['name']` |
| **`keyof` / `typeof` / `infer`** | 类型层面的运算符 |
| **工具类型** | `Partial` / `Required` / `Pick` / `Omit` / `Record` / `Exclude` / `Extract` / `ReturnType` / `Parameters` / `Awaited` |

---

## 2.3 `object` vs `Object` vs `{}`（最高频的坑之一）

**这三个看起来一样，实际完全不同。**

```ts
// ① object（小写）：所有「非原始类型」
let a: object;
a = {};              // ✅
a = [];              // ✅
a = () => {};        // ✅
a = new Date();      // ✅
a = 'hello';         // ❌ 报错（string 是原始类型）
a = 1;               // ❌
a = null;            // ❌
a = undefined;       // ❌

// ② Object（大写）：几乎所有值（除 null/undefined）
let b: Object;
b = {};              // ✅
b = 'hello';         // ✅ 不报错！
b = 1;               // ✅ 不报错！
b = null;            // ❌（strictNullChecks 下）

// ③ {}（空对象字面量类型）：等同于「除 null/undefined 外的任何值」
let c: {};
c = {};              // ✅
c = 'hello';         // ✅ 不报错！
c = 1;               // ✅ 不报错！
c = null;            // ❌
```

**结论表**：

| 写法 | 接受原始类型（string/number） | 接受对象 | 推荐度 |
|---|---|---|---|
| **`object`** | ❌ | ✅ | ✅ **推荐**（表达「我要一个对象」） |
| `Object` | ✅ | ✅ | ❌ 几乎不用（历史遗留） |
| `{}` | ✅ | ✅ | ❌ **最容易误用**（很多人以为它表示「空对象」） |

**⚠️ 最常见的 bug**：

```ts
// ❌ 意图是「传一个空对象」，实际是「传任何非 null/undefined 的值」
function init(options: {}) { }

init('hello');    // ✅ 不报错！但逻辑上肯定错了
init(123);        // ✅ 不报错！

// ✅ 正确写法
function initRecord(options: Record<string, unknown>) { }
// 或
function initObject(options: object) { }
// 或定义具体形状
function initShape(options: { debug?: boolean }) { }
```

---

## 2.4 数组与元组

### 2.4.1 两种数组写法

```ts
let a: number[];             // 推荐，简洁
let b: Array<number>;        // 等价

// 联合类型时必须加括号！
let c: (string | number)[];  // ✅ 元素是 string 或 number
let d: string | number[];    // ⚠️ 这是「string 或 number 数组」，完全不同的意思！
```

### 2.4.2 元组（Tuple）

```ts
// 定长、定类型
let point: [number, number] = [1, 2];

point[0] = 3;        // ✅
point[2] = 3;        // ❌ 报错：长度为 2 的元组没有索引 2
point[2];            // ❌ 报错：元组越界（数组越界不报错）

// 可选元素（必须在末尾）
let entry: [string, number?] = ['a'];
entry = ['a', 1];    // ✅

// 剩余元素
let list: [string, ...number[]] = ['a', 1, 2, 3];

// 命名元组（TS 4.0，提升可读性）
let range: [start: number, end: number] = [1, 10];
```

**元组 vs 数组的关键差异**：

| | 数组 `number[]` | 元组 `[number, number]` |
|---|---|---|
| 长度 | 不固定 | **固定** |
| 越界访问 | ✅ 允许（类型仍是 `number`，运行时 `undefined`，TS 不健全之处） | ❌ **编译期报错** |
| 元素类型 | 全部相同 | **可以不同** |

---

## 2.5 联合类型的使用限制

```ts
type Status = 'idle' | 'loading' | 'success' | 'error';
let s: Status = 'loading';
s = 'done';    // ❌ 报错：'done' 不在联合里
```

**关键限制：只能访问所有成员的「共有属性」**

```ts
type A = { a: string; common: number };
type B = { b: string; common: number };

declare const x: A | B;

x.common;    // ✅ 共有属性可以访问
x.a;         // ❌ 报错：B 上没有 a
x.b;         // ❌ 报错
```

**要用特有属性，必须先收窄**（见 03 册）：

```ts
if ('a' in x) {
  x.a;       // ✅ 收窄成 A
}
```

**判别联合（Discriminated Union）**：

```ts
type Result =
  | { ok: true; data: string }
  | { ok: false; error: Error };

function handle(r: Result) {
  if (r.ok) {
    r.data;      // ✅ 自动收窄，能访问 data
  } else {
    r.error;     // ✅ 自动收窄，能访问 error
  }
}
```

**为什么叫「判别」**：因为有一个**共同的、字面量类型的字段**（`ok: true/false`）可以作为「判别器」，TS 能据此自动收窄。

---

## 2.6 变量声明与类型推断

### 2.6.1 三种写类型的方式

```ts
// ① 类型注解（推荐用于函数参数、返回值、导出的变量）
let a: number = 1;

// ② 类型推断（推荐用于局部变量）
let b = 1;              // 推断为 number

// ③ 类型断言（慎用）
let c = JSON.parse('{"x":1}') as { x: number };
```

**原则：能推断就不写，但「函数参数」和「导出的 API」必须写。**

```ts
// ❌ 冗余：类型一眼可见
const n: number = 1;
const s: string = 'a';

// ✅ 只写必要的
function add(a: number, b: number): number { return a + b; }
```

### 2.6.2 `let` vs `const` 的推断差异

**TS 有一个「字面量拓宽（literal widening）」规则**：

```ts
let a = 'hello';         // 类型是 string（拓宽了）
const b = 'hello';       // 类型是 'hello'（保留字面量）

let c = 1;               // number
const d = 1;             // 1
```

**为什么**：`let` 可以重新赋值，所以必须拓宽成「可能的类型集合」；`const` 不能重新赋值，所以能保留精确的「值」。

**⚠️ 但对象和数组例外！**

```ts
const obj = { x: 1 };
// 类型是 { x: number }，不是 { x: 1 }  ← 属性仍然被拓宽了

const arr = [1, 2, 3];
// 类型是 number[]，不是 [1, 2, 3]  ← 元素仍然被拓宽了

obj.x = 2;    // ✅ 合法！const 只保证「引用不变」，不保证「内容不变」
```

**要用 `as const` 才能保留字面量**：

```ts
const obj = { x: 1 } as const;
// 类型是 { readonly x: 1 }

const arr = [1, 2, 3] as const;
// 类型是 readonly [1, 2, 3]

obj.x = 2;    // ❌ 报错（readonly）
```

```ts
// 用 as const 代替 enum
const Status = {
  Idle: 'idle',
  Loading: 'loading',
  Success: 'success',
} as const;

type Status = typeof Status[keyof typeof Status];
// → 'idle' | 'loading' | 'success'
```

### 2.6.3 `var` / `let` / `const` 在 TS 里的差异

**TS 层面几乎没差异**（类型系统不关心作用域规则），差异都在 JS 运行时：

| | 作用域 | 提升 | 重复声明 | 重新赋值 |
|---|---|---|---|---|
| `var` | 函数作用域 | ✅（`undefined`） | ✅ 允许 | ✅ |
| `let` | 块级 | ⚠️ TDZ | ❌ 报错 | ✅ |
| `const` | 块级 | ⚠️ TDZ | ❌ 报错 | ❌ |

**TS 的建议**：`const` > `let` > 不用 `var`。可以开 ESLint 的 `prefer-const` 强制。

---

## 2.7 null / undefined 的检查

### 2.7.1 `strictNullChecks` 是分水岭

**关闭时（旧版默认关闭；现在需显式 `strictNullChecks: false`）**：

```ts
let s: string = null;        // ✅ 不报错！
s.toUpperCase();             // 💥 运行时崩
```

**开启时（现代标准）**：

```ts
let s: string = null;        // ❌ 报错
let t: string | null = null; // ✅ 必须显式声明
t.toUpperCase();             // ❌ 报错：可能是 null
t?.toUpperCase();            // ✅
```

**`strict: true` 会自动开启 `strictNullChecks`**；不开它，`null` 能赋给任何类型。

### 2.7.2 四种检查方式

```ts
declare const x: string | null | undefined;

// ① 严格相等（最明确）
if (x === null) { }
if (x === undefined) { }

// ② 松散相等（同时匹配 null 和 undefined，唯一的合法 == 用法）
if (x == null) {
  // 这里 x 收窄为 null | undefined
}
if (x != null) {
  // 这里 x 收窄为 string
}

// ③ 真值判断（注意会同时排除 '' 和 0）
if (x) { }

// ④ 可选链 + 空值合并
const len = x?.length ?? 0;
```

**为什么 `x == null` 是推荐的**：它同时匹配 `null` 和 `undefined`，比 `x === null || x === undefined` 简洁得多。`eqeqeq` 规则可用 `{ null: "ignore" }` 单独放行这一写法。

### 2.7.3 `??` vs `||`

```ts
const a = 0;
const b = '';

console.log(a || 10);    // 10  ← 因为 0 是 falsy
console.log(a ?? 10);    // 0   ← 因为 0 不是 null/undefined

console.log(b || '默认');  // '默认'  ← 因为 '' 是 falsy
console.log(b ?? '默认');  // ''
```

| 运算符 | 触发默认值的条件 |
|---|---|
| **`\|\|`** | 左侧是 **falsy**（`false`、`0`、`''`、`null`、`undefined`、`NaN`） |
| **`??`** | 左侧是 **`null` 或 `undefined`**（**只有这两个**） |

**⚠️ 真实 bug 场景**：

```ts
// ❌ 用户把音量调到 0，会被设成默认值 50
const volume = userVolume || 50;

// ✅ 只有用户没设置过才用默认值
const volume = userVolume ?? 50;
```

**同类坑**：分页 `page || 1`（page=0 时错）、开关 `enabled || true`（传 false 时错）、价格 `price || 99`（0 元商品时错）。

### 2.7.4 非空断言 `!`：慎用

```ts
const el = document.querySelector('#app')!;
el.innerHTML = 'hi';       // 编译期不报错，但如果 #app 不存在，运行时崩
```

**`!` 的本质**：告诉编译器「我保证不是 null/undefined」。**它不做任何运行时检查。**

**什么时候可以用**：

```ts
// ✅ 合理：上下文已经保证了
const map = new Map<string, number>();
map.set('a', 1);
map.get('a')!;                 // 刚 set 过，一定有

// ❌ 危险：外部数据 / DOM 查询 / 数组查找
document.querySelector('#app')!;         // 可能不存在
arr.find(x => x.id === 1)!;              // 可能找不到
JSON.parse(s).data!.list!;               // 外部数据，完全不可信
```

**更好的替代**：

```ts
// 用类型守卫
const el = document.querySelector('#app');
if (el instanceof HTMLDivElement) {
  el.innerHTML = 'hi';       // ✅ 收窄了
}

// 用默认值
const fallbackEl = document.querySelector('#app') ?? document.body;

// 用可选链
arr.find(x => x.id === 1)?.name;
```

---

## 2.8 类型断言

### 2.8.1 两种语法

```ts
// ① as 语法（推荐）
const el = document.querySelector('#app') as HTMLDivElement;

// ② 尖括号语法（JSX/TSX 里不能用！会和标签冲突）
const el2 = <HTMLDivElement>document.querySelector('#app');
```

**所以 `.tsx` 文件里只能用 `as`。**

### 2.8.2 断言的本质：编译期指令，不做运行时转换

**这和 Java/C# 的 cast 完全不同**：

```ts
const x = 'hello' as unknown as number;

typeof x;    // 'string'  ← 运行时还是字符串！
x.toFixed(); // 💥 运行时崩：x.toFixed is not a function
```

**TS 的 `as` 只做两件事**：
1. 检查「这两个类型是否有重叠」（没有重叠会报错，需要 `as unknown as T` 双重断言）
2. 通过后，**让编译器相信你是对的**

**所以断言错了，编译期不报错，运行时值也不变**——按断言的类型调用方法才会崩。

### 2.8.3 `as const`：一个特殊的断言

对 2.6.2 的字面量加 `as const`，三个作用：

1. **保留字面量类型**（`'x'` 而不是 `string`）
2. **加 `readonly`**
3. **数组变元组**（`string[]` → `readonly ['x', 'y']`）

**典型用途**：常量表、配置、枚举替代品（见 2.6.2）。

### 2.8.4 `satisfies`（TS 4.9 新增）

**问题**：类型注解会「覆盖」推断，导致类型变宽。

```ts
// 用类型注解：类型被写死成宽泛的 Record
const config: Record<string, string | number> = {
  port: 3000,
  host: 'localhost',
};
config.port.toFixed();     // ❌ 报错：port 类型是 string | number
```

```ts
// 用 satisfies：校验形状，但保留精确推断
const config = {
  port: 3000,
  host: 'localhost',
} satisfies Record<string, string | number>;

config.port.toFixed();     // ✅ 因为 port 推断为 number
config.hots;               // ❌ 报错：拼写错误也能抓出来
```

| 写法 | 校验形状 | 保留精确推断 |
|---|---|---|
| **类型注解** `const x: T = ...` | ✅ | ❌ 类型被写成 T |
| **类型断言** `const x = ... as T` | ⚠️ 只检查可比较性，不校验完整形状 | ❌ |
| **`satisfies`** | ✅ | ✅ |

### 2.8.5 一个安全的替代：类型守卫

```ts
// ❌ 断言：不安全
const data = JSON.parse(str) as User;

// ✅ 守卫：真的检查了
function isUser(x: unknown): x is User {
  return (
    typeof x === 'object' && x !== null &&
    typeof (x as any).id === 'number' &&
    typeof (x as any).name === 'string'
  );
}

const raw: unknown = JSON.parse(str);
if (isUser(raw)) {
  raw.name;    // ✅ 且保证运行时真的是 User
}
```

---

## 2.9 常见坑

| 坑 | 正确说法 |
|---|---|
| **`{}` 表示空对象** | ❌ `{}` 接受任何非 null/undefined 的值；要用 `object` 或 `Record<string, unknown>` |
| **`Array<string \| number>` 写成 `string \| number[]`** | 后者是「string 或 number 数组」，意思完全不同，**括号不能少** |
| **以为 `const obj` 不可变** | `const` 只保证引用不变，属性可以改；要不可变用 `as const` 或 `Readonly<T>` |
| **以为 `const` 能保留字面量** | 只对**基本类型**成立；对象/数组的属性仍会拓宽，要 `as const` |
| **`||` 给默认值** | `0`、`''`、`false` 都会被替换；应该用 `??` |
| **`as` 会做类型转换** | ❌ 不做任何运行时转换，只是编译期指令 |
| **`!` 是安全的** | ❌ 只是关掉检查，运行时该崩还是崩 |
| **元组越界不报错** | 元组**会**报错（数组不会） |
| **把 `void` 说成原始类型** | `void` 是函数返回值类型，不是原始值类型 |
| **`Object` 和 `object` 一样** | 完全不同：`object` 排除原始类型，`Object` 包含 |
| **`satisfies` 和类型注解一样** | 注解会覆盖推断，`satisfies` 保留推断 |

---

## 2.10 答题模板

### 30 秒版（类型有哪些）

- **原始类型 7 种**：`string`、`number`、`boolean`、`null`、`undefined`、`symbol`、`bigint`；TS 不区分整数与浮点，都叫 `number`。
- **对象类型**：`object`、`T[]`、`readonly T[]`、元组 `[T, U]`、对象字面量、函数类型，以及 `Date`、`Promise`、`Map` 等内置对象。
- **特殊类型 4 个**：`any` 关闭检查、`unknown` 必须收窄、`never` 空集、`void` 无返回值。
- **字面量类型**：`'a'`、`1`、`true`，配合联合类型可当枚举用。
- 再往上：联合/交叉、条件类型、映射类型、模板字面量类型，以及 `Partial`/`Pick`/`Omit` 等工具类型。

### 30 秒版（类型断言）

- 两种写法：`as T` 与 `<T>`；TSX 里 `<T>` 与 JSX 标签冲突，只能用 `as`。
- `as` 是编译期指令，不做运行时检查或转换：`'hello' as unknown as number` 编译通过，运行时 `typeof` 仍是 `string`，调用 `toFixed` 抛 `TypeError`。
- 断言只要求两个类型可比较；无重叠时必须 `as unknown as T`。
- 更安全的替代：类型守卫（`x is T`）在运行时真的检查；`satisfies` 校验形状且保留精确推断，`as` 不校验完整形状。

### 2 分钟版（把本册串起来讲）

- **范围与写法**：类型分四组（原始 7 / 对象 / 特殊 4）+ 字面量类型，见 30 秒版；写类型优先推断、其次注解、慎用断言，函数参数与导出的 API 必须写注解。
- **三个易混**：`object` 只接受非原始类型；`Object` 与 `{}` 几乎等价，接受任何非 `null`/`undefined` 的值，所以 `{}` 不能表达「空对象」。
- **拓宽**：`let a = 'x'` 推断 `string`，`const b = 'x'` 推断 `'x'`；但对象/数组的属性与元素仍会拓宽（`{ x: number }`、`number[]`），保留字面量要 `as const`。
- **null 检查**：`strictNullChecks` 关闭时 `null` 能赋给任何类型；`x == null` 同时匹配 `null` 与 `undefined`；`??` 只在 `null`/`undefined` 触发，`||` 在 `0`、`''`、`false` 时也触发。
- **断言**：`as` 不做运行时转换，断言错了运行时按错误类型继续跑；更安全的是类型守卫，配置对象可用 `satisfies` 校验形状并保留推断。

### 追问表

| 追问 | 回答要点 |
|---|---|
| `object` 和 `Object` 区别 | 小写只接受非原始类型；大写包含原始类型 |
| `{}` 表示什么 | 「除 null/undefined 外的任何值」，**不是空对象** |
| `(string \| number)[]` 和 `string \| number[]` | 前者元素是联合，后者是「string 或 number 数组」 |
| 元组和数组的区别 | 元组定长、越界报错；数组可变长、越界不报错 |
| `const` 能保证不可变吗 | 只保证引用不变；属性可改，需 `as const` / `Readonly` |
| 为什么 `const obj` 属性没有字面量类型 | 对象属性会「拓宽」，要 `as const` |
| `as const` 做了什么 | 保留字面量 + 加 readonly + 数组变元组 |
| `??` 和 `||` 区别 | `??` 只在 null/undefined 触发；`||` 在 falsy 触发 |
| 为什么不推荐 `!` | 只是关掉检查，运行时该崩还是崩 |
| `as` 会做类型转换吗 | **不会**，编译期指令，运行时值不变 |
| 双重断言什么时候用 | 两个类型没有重叠时，`x as unknown as T`（危险） |
| `satisfies` 和类型注解区别 | 注解覆盖推断，`satisfies` 保留推断 |
| 为什么 TSX 里不能用 `<T>` 断言 | 和 JSX 标签语法冲突 |
| `void` 是原始类型吗 | 不是，是函数返回类型 |

---

## 2.11 速记卡

```
类型四组
  原始 7：string number boolean null undefined symbol bigint
  对象：object / T[] / readonly T[] / [T,U] / {a:T} / (a:T)=>U / Date Promise Map
  特殊 4：any（关检查）/ unknown（要收窄）/ never（不存在）/ void（无返回）
  字面量：'a' / 1 / true；模板字面量 `p-${string}`

三个易混（高频坑）
  object  → 非原始类型（推荐）
  Object  → 几乎等于 {}
  {}      → 接受任何非 null/undefined 的值（不是「空对象」！）

数组 vs 元组
  (string | number)[]  ← 括号不能少
  string | number[]    ← 完全不同的意思
  元组越界报错，数组越界不报错（TS 不健全）

const 与拓宽
  let a = 'x'    → string
  const b = 'x'  → 'x'
  const obj = {x:1} → {x: number}  ← 属性仍拓宽！
  const o2 = {x:1} as const → {readonly x: 1}
  枚举替代：const S = {...} as const; type S = typeof S[keyof typeof S]

null 检查
  strictNullChecks 是关键；x == null 同时匹配两者（eqeqeq 可放行）
  ?? 只在 null/undefined 触发；|| 在 falsy（0 '' false NaN）也触发 ← 高频坑
  ! 只是关检查，不做运行时判断

断言三兄弟
  as T        → 编译期指令，运行时值不变，用错方法才崩
  as const    → 保留字面量 + readonly + 元组化
  satisfies   → 校验形状 + 保留精确推断（vs 注解覆盖推断、as 不校验）
```
