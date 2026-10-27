# Node 03｜模块系统：CommonJS 与 ES Module

> 覆盖题号：1（CJS 和 ESM 区别）、2（ESM 为什么必须写扩展名）、9（require 查找策略）
> 去重后：**2 个考点**

---

## 目录

- [3.1 题单答案的问题](#31-题单答案的问题)
- [3.2 一句话结论](#32-一句话结论)
- [3.3 十项差异（全部实测）](#33-十项差异全部实测)
- [3.4 `require` 的查找策略](#34-require-的查找策略)
- [3.5 面试怎么说（2 分钟版）](#35-面试怎么说2-分钟版)
- [3.6 速记卡](#36-速记卡)
- [3.7 自测](#37-自测)

---

## 3.1 题单答案的问题

题单给了 5 行对比（加载方式 / 导出 / 加载顺序 / this / 动态导入）、扩展名的浏览器侧解释、4 条查找优先级；缺少以下三项：

| 题单没提的 | 影响 |
|---|---|
| ESM 是 live binding，CJS 导出的是快照 | 跨模块共享状态能否生效 |
| ESM 循环依赖抛 TDZ 错误，CJS 能拿到部分导出 | 与「ESM 更先进」的直觉相反 |
| `package.json` 的 `type` / `exports` | 决定 `.js` 的解析方式与包内路径是否可见 |

---

## 3.2 一句话结论

> **CJS 是运行时同步加载 + 值拷贝，ESM 是编译时静态分析 + 活绑定：CJS 拿到值的快照，ESM 拿到指向变量的只读绑定。**

---

## 3.3 十项差异（全部实测）

以下结果（除静态分析一项外）均在 Node v22.12.0 的最小工程中实测。

| # | 维度 | CommonJS | ES Module | 实测 |
|---|---|---|---|---|
| 1 | **扩展名** | 可省略，自动补 `.js`/`.json`/`.node` | **必须写** | `require('./dep')` ✅ / `import './dep'` → `ERR_MODULE_NOT_FOUND` |
| 2 | **顶层 `this`** | `module.exports` | **`undefined`** | `this === module.exports` → true / `this === undefined` → true |
| 3 | **`__dirname`** | ✅ 有 | ❌ 没有 | `typeof __dirname` → `'string'` / `'undefined'`；ESM 用 `import.meta.dirname` 或 `fileURLToPath(import.meta.url)` |
| 4 | **`require`** | ✅ 有 | ❌ 没有 | `typeof require` → `'function'` / `'undefined'` |
| 5 | **导出语义** | `module.exports` 对象引用；原始值是快照 | **live binding** | 见差异 5 |
| 6 | **顶层 await** | ❌ 语法错误 | ✅ 支持 | CJS：`SyntaxError`；ESM：正常执行 |
| 7 | **循环依赖** | ✅ 能跑，拿到部分导出 | ❌ **TDZ 报错** | 见差异 7 |
| 8 | **严格模式** | 默认非严格 | **默认严格** | ESM 顶层 `this === undefined` |
| 9 | **静态分析** | ❌ 运行时求值 | ✅ 编译期可分析 | tree shaking 的前提 |
| 10 | **加载时机** | 调用 `require` 时同步执行 | 静态依赖先解析、先求值 | `import` 会被提升，见差异 10 |

### 差异 5：live binding vs 值拷贝

ESM 的 `import` 建立指向导出变量的只读绑定，读取时取当前值：

```js
// counter.mjs
export let count = 0;
export function inc() { count++; }

// main.mjs
import { count, inc } from './counter.mjs';
console.log(count);  // 0
inc();
console.log(count);  // 1
```

实测输出 `0` / `1`。导入方给绑定赋值会抛 `TypeError: Assignment to constant variable.`。

CJS 的 `require` 返回 `module.exports` 对象本身：对象属性随修改变化，导出原始值则是快照。

```js
// counter.cjs
let count = 0;
module.exports = {
  get count() { return count; },
  inc() { count++; },
  snapshot: count,
};
```

实测 `c.count` 在 `inc()` 后从 0 变为 1，`c.snapshot` 始终为 0。跨模块同步状态要导出对象或 getter。

`exports` 只是 `module.exports` 的初始引用，重写 `module.exports` 会断开：

```js
exports.x = 1;
module.exports = { y: 2 };
```

另一文件 `require` 的结果是 `{ y: 2 }`，`x` 丢失。

### 差异 7：循环依赖 —— ESM 更容易抛错

CJS 边执行边填充 `module.exports`；循环中的第二次 `require` 命中缓存，拿到已完成的部分导出：

```js
// cycle-a.cjs
exports.a = 'A';
const b = require('./cycle-b.cjs');
console.log('a.cjs b =', b.b);

// cycle-b.cjs
exports.b = 'B';
const a = require('./cycle-a.cjs');
console.log('b.cjs a =', a.a);
```

实测输出：

```
b.cjs a = A
a.cjs b = B
```

ESM 先建立绑定，再执行模块体；循环中访问的 `const`/`let` 仍在 TDZ：

```js
// cycle-a.mjs
import { b } from './cycle-b.mjs';
export const a = 'A';

// cycle-b.mjs
import { a } from './cycle-a.mjs';
export const b = 'B';
console.log(a);
```

实测：`ReferenceError: Cannot access 'a' before initialization`。CJS 不报错，但可能拿到不完整的对象。

### 差异 1：扩展名（单独问的）

浏览器把 `import './dep'` 当成对 `https://site.com/dep` 的请求，不猜 `.js` / `/index.js`；Node 的 ESM 对齐这一语义，故意不做路径补全：

| 原因 | 说明 |
|---|---|
| 性能 | 每次猜测都要额外的 `fs.stat` 系统调用 |
| 确定性 | 同一个 import 不会因目录结构不同解析到不同文件 |
| 同构 | 与浏览器语义一致，SSR 代码可直接复用 |
| 早失败 | 少写扩展名在 CJS 能跑，在 ESM 立刻报错 |

实测：`require('./dep')` → `ok`；`import './dep'` → `ERR_MODULE_NOT_FOUND`；`import './dep.js'` → `ok`。

### 差异 10：`import` 会被提升

`import` 声明在编译阶段处理，依赖模块先求值，再执行当前模块体：

```js
console.log(typeof foo); // 'string'
import { foo } from './x.mjs';
```

实测 `typeof foo` 为 `'string'`。等价的 `require` 在语句位置才执行，之前是 `undefined`。

条件加载只能用 `import()`（返回 Promise）；`import` 声明不能写在 `if` 里：

```js
if (cond) await import('./x.mjs');
```

---

## 3.4 `require` 的查找策略

### 题单答案的两处偏差

题单顺序是「绝对/相对路径 → 核心模块 → node_modules → 目录 main/index」，需要修正两点：

1. 内置模块优先级最高，先于文件系统查找。
2. 有 `package.json` 的 `exports` 字段时，按 `exports` 解析，不再看 `main`。

### 完整规则（六步）

```
① 内置模块（fs / path / http / node:fs）→ 直接返回，不查文件系统
② 以 ./、../ 或 / 开头 → 按文件/目录路径解析
③ 否则按模块名，从当前目录逐层向上查找 node_modules/<name>
④ 包目录有 package.json 的 exports → 按 exports 白名单与条件解析
⑤ 没有 exports 但有 main → 用 main 指向的文件
⑥ 否则找 index.js / index.json / index.node
```

文件路径（②）的尝试顺序：

```
X → X.js → X.json → X.node → X/package.json 的 main → X/index.js → X/index.json → X/index.node
```

### 实测：查找优先级

构造的目录树包含 `app/local.js`、`app/local.json`、`app/dir/index.js`、带 `main` 的 `app/pkg`、`app/node_modules/foo`、根 `node_modules/bar`，以及一个假的 `app/node_modules/fs`。

```
./local  → local.js              （.js 优先于 .json）
./dir    → dir/index.js
./pkg    → pkg/lib/entry.js      （main 字段）
foo      → app/node_modules/foo/main.js
bar      → 根 node_modules/bar/index.js
fs       → 内置模块               （app/node_modules/fs 被忽略）
```

`require.resolve` 实测：

```
./dir → app/dir/index.js
./pkg → app/pkg/lib/entry.js
foo   → app/node_modules/foo/main.js
bar   → <root>/node_modules/bar/index.js
fs    → fs                       （裸名字，表示内置模块）
```

### `exports` 字段：现代包的一道门

有 `exports` 时，未列出的路径一律不可访问，`main` 指向的文件也不例外。`pkg-a` 的配置：

```json
{
  "name": "pkg-a",
  "main": "./legacy.js",
  "module": "./esm.js",
  "exports": {
    ".": {
      "import": "./esm.mjs",
      "require": "./cjs.cjs",
      "default": "./fallback.js"
    },
    "./utils": {
      "import": "./utils.mjs",
      "require": "./utils.cjs"
    },
    "./feature/*": "./feature/*.js",
    "./package.json": "./package.json"
  }
}
```

CJS 侧实测：

```
require("pkg-a")              → "cjs.cjs"
require("pkg-a/utils")        → "utils.cjs"
require("pkg-a/feature/a")    → "feature/a.js"
require("pkg-a/package.json") → package.json 对象
require("pkg-a/secret")       → ERR_PACKAGE_PATH_NOT_EXPORTED
require("pkg-a/legacy")       → ERR_PACKAGE_PATH_NOT_EXPORTED
```

ESM 侧实测：

```
import a from "pkg-a"       → "esm.mjs"
import u from "pkg-a/utils" → "utils.mjs"
import "pkg-a/secret"       → ERR_PACKAGE_PATH_NOT_EXPORTED
```

没有 `exports` 的 `pkg-b`，内部文件可直接访问：

```
require("pkg-b")          → "pkg-b index"
require("pkg-b/internal") → "pkg-b internal"
```

结论：`exports` 是白名单；未列出的路径（包括 `main` 指向的）都报 `ERR_PACKAGE_PATH_NOT_EXPORTED`；条件导出按 `import` / `require` 分流；`./feature/*` 批量暴露子路径；`package.json` 需单独导出。

双格式包的标准写法：

```json
{
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    },
    "./package.json": "./package.json"
  }
}
```

`types` 放第一个：TypeScript 按条件顺序匹配，命中即停。

### `type` 字段：决定 `.js` 按什么解析

| 扩展名 | 解析方式 |
|---|---|
| `.cjs` | 永远 CommonJS |
| `.mjs` | 永远 ES Module |
| `.js` | 看最近的 `package.json` 的 `type`（默认 `commonjs`） |

实测：

```
type=commonjs 时，.js 顶层 this === module.exports：true
type=module 时，  .js 顶层 this === undefined：true
type=module 时，  .cjs 顶层 this === module.exports：true
```

---

## 3.5 面试怎么说（2 分钟版）

- **语法层**：`require`/`module.exports` 对应 `import`/`export`；CJS 可省扩展名，ESM 必须写全。
- **机制层**：CJS 运行时同步加载，执行到 `require` 才找文件；ESM 编译时静态分析，`import` 提升，依赖先求值。
- **语义层**：CJS 导出值快照（对象属性仍是活的），ESM 是导入方只读的 live binding。
- **反直觉点**：ESM 循环依赖抛 TDZ `ReferenceError`，CJS 能拿到部分导出。
- **扩展名**：表层是浏览器不猜 URL，深层是 Node 故意不做路径补全（省 `fs.stat`、保证确定性、同构、早失败）。

### 追问链

| 追问 | 答法 |
|---|---|
| `import` 能写在 if 里吗？ | 不能，静态 `import` 必须在顶层；条件加载用 `await import()` |
| `import()` 和 `import` 区别？ | `import()` 是函数调用，返回 Promise，可在任意位置执行 |
| ESM 里怎么拿到 `require`？ | `createRequire(import.meta.url)`；老包只提供 CJS 时使用 |
| 两种模块能混用吗？ | Node v22.12 实测 `require('./x.mjs')` 可用（有 ExperimentalWarning），返回含 `__esModule`、`default` 与具名导出的命名空间对象；`import cjs from './x.cjs'` 的 default 就是 `module.exports` |
| `import` CJS 能用具名导出吗？ | 只有 `exports.foo = ...` 这类静态可分析的写法可以；`module.exports = { a: 1 }` 会报 `SyntaxError: Named export 'a' not found` |
| `type: module` 会影响依赖吗？ | 不会，`node_modules` 里的包按各自 `package.json` 解析 |
| `exports` 会破坏老代码吗？ | 会；之前可访问的未导出子路径会变成 `ERR_PACKAGE_PATH_NOT_EXPORTED`，属于 breaking change |
| `require` 缓存能清吗？ | `delete require.cache[require.resolve('./x')]`；仅适合测试/热重载 |

---

## 3.6 速记卡

```
【一句话】CJS 运行时同步加载 + 值拷贝；ESM 编译时静态分析 + live binding

【差异】扩展名必须写 | this=undefined | 无 __dirname/require | 顶层 await | 循环依赖 TDZ | 严格模式

【require 查找】内置 → 路径 → node_modules → exports → main → index
文件尝试：X → X.js → X.json → X.node → X/package.json main → X/index.*

【exports】白名单，未列出即 ERR_PACKAGE_PATH_NOT_EXPORTED；优先于 main；条件 import/require/types/default

【type】.cjs 永远 CJS，.mjs 永远 ESM，.js 看最近的 package.json
```

---

## 3.7 自测

```
□ 能用「值拷贝 vs 活绑定」说出两者最本质的差别
□ 能说出 CJS 循环依赖为什么能拿到部分导出，ESM 为什么抛 TDZ
□ 能说出 ESM 必须写扩展名的两层原因
□ 能默写 require 的查找顺序与文件尝试顺序
□ 能说出 exports 字段是白名单、会覆盖 main
□ 能写出双格式包的 exports 配置，并说明 types 为什么放第一个
□ 能说出 ESM 里替代 __dirname 的写法
□ 能说出 require(esm) 与 import cjs 各自拿到什么
```
