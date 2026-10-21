# TS · 02 类型系统基础：原始类型 · 联合 · 断言（题 20、30、17、4、39、31、44）

> 本册覆盖：内置数据类型（原题 20、30）、联合类型数组（题 17）、变量声明（题 4、39）、null/undefined 检查（题 31）、类型断言（题 44）
> 这些是「必须全过」的基础题，但里面藏着几个**高频坑**：`object` vs `Object` vs `{}`、`const` 推断的「拓宽」、`??` vs `||`、`as` 不做运行时转换。

---

## 2.1 一句话结论

TS 的类型分四组：**原始类型**（7 种）、**对象类型**（object/array/tuple/function…）、**特殊类型**（any/unknown/never/void）、**字面量类型**（`'a'`、`1`）。
写类型有三种方式：**类型注解（`:`）**、**类型断言（`as`）**、**类型推断（不写）**——**首选推断，其次注解，慎用断言**。

---

## 2.2 类型全表（题 20、30）

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

### 2.2.3 特殊类型（这四个是必问）

| 类型 | 含义 | 一句话 |
|---|---|---|
| **`any`** | 关闭检查 | 「别管我」（会传染，见 03 册） |
| **`unknown`** | 安全的任意 | 「我不知道，你先证明」（必须收窄） |
| **`never`** | 空集，不存在值 | 「永远不会有结果」（抛异常/死循环/穷尽检查） |
| **`void`** | 无返回值 | 「函数干了事但不返回东西」 |

### 2.2.4 高级类型（题 30 可能被问到）

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
function init(options: Record<string, unknown>) { }
// 或
function init(options: object) { }
// 或定义具体形状
function init(options: { debug?: boolean }) { }
```

> **面试话术**：「`object` 是『非原始类型』，`Object` 和 `{}` 几乎等价，都接受原始类型。所以 `{}` 经常被误用成『空对象』——它实际接受任何非 null/undefined 的值。要表达『一个对象』应该用 `object` 或 `Record<string, unknown>`。」

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

**题 17 的考点就在这里**——问「元素可能是字符串也可能是数值的数组」，答案必须是 `(string | number)[]` 或 `Array<string | number>`，**括号不能少**。

### 2.4.2 元组（Tuple）

```ts
// 定长、定类型
let point: [number, number] = [1, 2];

point[0] = 3;        // ✅
point[2] = 3;        // ❌ 报错：长度为 2 的元组没有索引 2
point[2];            // ❌ 报错（注意：数组越界不报错，元组报错！）

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
| 越界访问 | ✅ 允许（类型仍是 `number`，运行时 `undefined`） | ❌ **编译期报错** |
| 元素类型 | 全部相同 | **可以不同** |

> **这个差异很重要**：`arr[10]` 在数组上不报错（TS 的不健全之处），但在元组上会报错。

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

**判别联合（Discriminated Union）**——这是 TS 最实用的模式之一：

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

## 2.6 变量声明与类型推断（题 4、39）

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

### 2.6.2 `let` vs `const` 的推断差异（这是高频考点）

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

**这个知识点在实战里非常有用**：定义配置、常量表、枚举替代品。

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

> **这段代码是「现代替代 enum」的标准写法**，值得背下来。

### 2.6.3 `var` / `let` / `const` 在 TS 里的差异

**TS 层面几乎没差异**（类型系统不关心作用域规则），差异都在 JS 运行时：

| | 作用域 | 提升 | 重复声明 | 重新赋值 |
|---|---|---|---|---|
| `var` | 函数作用域 | ✅（`undefined`） | ✅ 允许 | ✅ |
| `let` | 块级 | ⚠️ TDZ | ❌ 报错 | ✅ |
| `const` | 块级 | ⚠️ TDZ | ❌ 报错 | ❌ |

**TS 的建议**：`const` > `let` > 不用 `var`。可以开 ESLint 的 `prefer-const` 强制。

---

## 2.7 null / undefined 的检查（题 31）

### 2.7.1 `strictNullChecks` 是分水岭

**关闭时（TS 早期默认，非常危险）**：

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

**`strict: true` 会自动开启 `strictNullChecks`**——这是 TS 最重要的一个开关，**不开等于白用 TS**。

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

**为什么 `x == null` 是推荐的**：它同时匹配 `null` 和 `undefined`，比 `x === null || x === undefined` 简洁得多。**这是 ESLint 唯一允许 `==` 的场景**（`eqeqeq: ["error", "always", { null: "ignore" }]`）。

### 2.7.3 `??` vs `||`（高频坑）

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
const el = document.querySelector('#app') ?? document.body;

// 用可选链
arr.find(x => x.id === 1)?.name;
```

---

## 2.8 类型断言（题 44）

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

**所以断言错了，编译期不一定报错，运行时一定崩。**

### 2.8.3 `as const`：一个特殊的断言

```ts
const a = ['x', 'y'] as const;
// 类型：readonly ['x', 'y']（不是 string[]）

const b = { type: 'success' } as const;
// 类型：{ readonly type: 'success' }（不是 { type: string }）
```

**三个作用**：
1. **保留字面量类型**（`'x'` 而不是 `string`）
2. **加 `readonly`**
3. **数组变元组**（`string[]` → `readonly ['x', 'y']`）

**典型用途**：常量表、配置、枚举替代品（见 2.6.2）。

### 2.8.4 `satisfies`（TS 4.9 新增，能答出来很加分）

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
| **类型断言** `const x = ... as T` | ❌ **不校验** | ❌ |
| **`satisfies`** | ✅ | ✅ |

**这是三者最关键的区别，值得单独记住。**

> 面试话术：「`satisfies` 是 TS 4.9 加的，解决的是『既要校验形状、又要保留精确推断』的问题。用类型注解会把变量类型写成那个宽泛的类型，用 `as` 又完全不校验。`satisfies` 两边都要——它会检查对象是否符合约束，但不改变推断出来的类型。典型场景是配置对象：既要保证字段类型对，又想在后续代码里拿到精确的字面量类型。」

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

const data: unknown = JSON.parse(str);
if (isUser(data)) {
  data.name;    // ✅ 且保证运行时真的是 User
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

### 30 秒版（题 20 / 30：类型有哪些）

> 分四组说。**原始类型**七种：string、number、boolean、null、undefined、symbol、bigint。**对象类型**：object、数组 `T[]`、元组 `[T, U]`、对象字面量、函数类型，还有内置的 Date、Promise、Map 等。**特殊类型**四个：any 关闭检查、unknown 安全但必须收窄、never 表示不存在、void 表示无返回。**字面量类型**：`'a'`、`1`、`true`，配合联合类型可以当枚举用。
> 再往上还有联合/交叉、条件类型、映射类型、模板字面量类型，以及 Partial/Pick/Omit 这些工具类型。

### 30 秒版（题 44：类型断言）

> 类型断言是告诉编译器「我知道这个值是什么类型」，有两种写法：`as T` 和 `<T>`，但 TSX 里只能用 `as`。
> **它和 Java 的强制转换完全不同——不做任何运行时检查或转换**。`'hello' as unknown as number` 编译能过，但运行时 `typeof` 还是 string，调用 `toFixed` 直接崩。
> 所以断言错了就是错了。安全的替代是类型守卫（`x is T`），或者用 `satisfies` ——它既校验形状又保留精确推断，而 `as` 完全不校验。

### 2 分钟版（把本册串起来讲）

> 我按「类型从哪来」和「怎么用」两块讲。
>
> **类型从哪来**：TS 的类型可以分成四组。原始类型七种——string、number、boolean、null、undefined、symbol、bigint，注意 **TS 不区分整数和浮点**，都叫 number。对象类型里最容易被问的是 `object` 和 `Object` 的区别：小写 `object` 表示「非原始类型」，所以字符串数字不行；大写 `Object` 和空对象字面量 `{}` 几乎等价，**接受任何非 null/undefined 的值**——这是最高频的坑，很多人以为 `{}` 表示「空对象」，结果传个字符串也通过。特殊类型四个：any、unknown、never、void。再加上字面量类型和联合类型。
>
> **怎么用**：写类型有三种方式，优先推断，其次注解，慎用断言。这里有个细节：`let a = 'x'` 推断成 string，`const b = 'x'` 推断成 `'x'`，因为 TS 有「字面量拓宽」规则。**但对象和数组例外**——`const obj = { x: 1 }` 的属性仍然被拓宽成 number，要保留字面量必须加 `as const`，这个规则在写配置表和枚举替代品时特别有用。
>
> 然后是 null 检查。`strictNullChecks` 是关键开关，关了的话 null 能赋给任何类型，等于白用 TS。检查手段里最推荐 `x == null`——它同时匹配 null 和 undefined，是 ESLint 唯一允许 `==` 的场景。另外 `??` 和 `||` 必须分清：`||` 遇到 0、空字符串、false 也会取默认值，`??` 只在 null/undefined 时取。这个坑在音量、分页、开关这些场景里经常出现。
>
> 最后是断言。`as` 是编译期指令，不做运行时转换，所以断言错了运行时直接崩。更安全的做法是类型守卫，或者用 TS 4.9 的 `satisfies`——它和类型注解的区别是，注解会把变量类型写成那个宽泛类型，`satisfies` 只校验形状、保留精确推断。

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
  strictNullChecks 是关键；x == null 同时匹配两者（唯一合法 ==）
  ?? 只在 null/undefined 触发；|| 在 falsy（0 '' false NaN）也触发 ← 高频坑
  ! 只是关检查，不做运行时判断

断言三兄弟
  as T        → 编译期指令，不做运行时转换，错了就崩
  as const    → 保留字面量 + readonly + 元组化
  satisfies   → 校验形状 + 保留精确推断（vs 注解覆盖推断、as 不校验）
```
