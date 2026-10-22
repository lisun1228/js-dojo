# Node 03｜模块系统：CommonJS 与 ES Module

> 覆盖题号：1（CJS 和 ESM 区别）、2（ESM 为什么必须写扩展名）、9（require 查找策略）
> 去重后：**2 个考点**（是题 1 的一个细节，但因为容易被问，单独讲）

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

> **1.** 给了一个 5 行对比表（加载方式 / 导出 / 加载顺序 / this / 动态导入）。
> **2.** 「ESM 是浏览器标准，浏览器需要知道完整 URL 才能请求资源，不能像 CommonJS 那样自动补全 `.js`/`/index.js`。Node 对齐了浏览器行为。」
> **9.** 给了 4 条查找优先级。

**这三条的质量比其他题高**——题 1 的表格 5 行全对，题 2 的解释也抓住了要点，题 9 的顺序基本正确。

但**题 1 少了三个最关键的差异**，而这三个才是「为什么会踩 bug」的根源：

| 题单没提的 | 为什么重要 |
|---|---|
| **ESM 是 live binding，CJS 是值拷贝** | 这是两者**最本质的语义差别**，很多 bug 源于此 |
| **ESM 循环依赖会 TDZ 报错，CJS 反而"宽容"** | 反直觉——很多人以为 ESM 更先进所以更好 |
| **package.json 的 `type` / `exports` 字段** | 现在写库/用库都会碰到 |

---

## 3.2 一句话结论

> **CJS 是「运行时同步加载 + 值拷贝」，ESM 是「编译时静态分析 + 活绑定」。**
>
> 一句话记住：**CJS 输出的是「值的快照」，ESM 输出的是「值的引用」。**

---

## 3.3 十项差异（全部实测）

| # | 维度 | CommonJS | ES Module | 实测证据 |
|---|---|---|---|---|
| 1 | **扩展名** | 可省略，自动补 `.js`/`.json`/`.node` | **必须写** | `require('./dep')` ✅ / `import './dep'` → `ERR_MODULE_NOT_FOUND` |
| 2 | **顶层 `this`** | `module.exports` | **`undefined`** | `this === module.exports` → true / `this === undefined` → true |
| 3 | **`__dirname`** | ✅ 有 | ❌ 没有 | `typeof __dirname` → `'string'` / `'undefined'` |
| 4 | **`require`** | ✅ 有 | ❌ 没有 | 同上 |
| 5 | **导出绑定** | **值拷贝** | **live binding** | 见下方实测 |
| 6 | **顶层 await** | ❌ 只能包 async | ✅ 支持 | `await` 在顶层直接可用 |
| 7 | **循环依赖** | ✅ 能跑 | ❌ **TDZ 报错** | 见下方实测 |
| 8 | **严格模式** | 默认非严格 | **默认严格** | `this` 为 `undefined` 就是证据 |
| 9 | **静态分析** | ❌ 运行时求值 | ✅ 编译时可分析 | tree shaking 的基础 |
| 10 | **加载时机** | 同步阻塞 | 异步（先解析再执行） | `import` 会「提升」到顶部 |

### 差异 5：live binding vs 值拷贝（最本质的一条）

#### ESM：活绑定

```js
// counter.mjs
export let count = 0;
export function inc() { count++; }

// live.mjs
import { count, inc } from './counter.mjs';
console.log('导入后 count =', count);   // 0
inc();
console.log('调用 inc() 后 count =', count);   // 1  ← 跟着变！
inc();
console.log('再调用一次 count =', count);      // 2
```

**实测输出**：

```
导入后 count = 0
调用 inc() 后 count = 1   ← ESM 拿到的是最新值
再调用一次 count = 2
```

#### CJS：值拷贝

```js
// counter.cjs
let count = 0;
module.exports = {
  get count() { return count; },   // 用 getter 才能"活"起来
  inc() { count++; },
  snapshot: count,                 // 直接导出值 → 快照
};

// copy.cjs
const c = require('./counter.cjs');
console.log('初始 count =', c.count, ' snapshot =', c.snapshot);   // 0 0
c.inc();
console.log('inc() 后 count =', c.count, ' snapshot =', c.snapshot);   // 1 0
```

**实测输出**：

```
初始 count = 0  snapshot = 0
inc() 后 count = 1  snapshot = 0   ← snapshot 是值拷贝，不会变
```

**为什么会有这个差别？**

| | 机制 |
|---|---|
| **ESM** | `import` 建立的是**指向导出变量的绑定**（类似指针）。读取时总是读当前值。规范里叫 **live binding** 或 **immutable binding** |
| **CJS** | `require` 返回的是 `module.exports` 这个**对象**。你在 `module.exports` 上放什么值，拿到的就是什么值的**拷贝**（如果是原始值） |

**这个差别导致的真实 bug**：

```js
// ❌ 最常见的坑：CJS 里导出配置对象，后来改了配置，导入方看不到
// config.js
module.exports = { debug: false };
// app.js
const config = require('./config');
// 某个地方 require('config').debug = true;   ← 改的是对象属性，能看到

// 但如果这样：
let debug = false;
module.exports = { debug };          // ← 导出的是 false 的拷贝
debug = true;                        // ← 导入方永远看不到
```

```js
// ❌ ESM 里的等价坑：不能给 import 的绑定赋值
import { count } from './counter.mjs';
count = 10;   // SyntaxError: Assignment to constant variable
```

> **面试时的标准说法**：
> 「ESM 的 import 是**只读的活绑定**——你不能给它赋值，但能读到源模块的最新值。CJS 的 require 拿到的是**对象引用**，对象上的属性是活的，但如果导出的是原始值就是快照。
>
> 这个差别带来的实际影响是：**ESM 里 `export let` 加 `export function` 修改它是能跨模块生效的**；而 CJS 里如果你想跨模块同步状态，必须导出一个对象或 getter。」

### 差异 7：循环依赖 —— ESM 反而更容易炸

这是**最反直觉**的一条。

#### CJS：能跑

```js
// cycle-a.cjs
exports.a = 'A';
const b = require('./cycle-b.cjs');
console.log('a.cjs 里 b.b =', b.b);

// cycle-b.cjs
exports.b = 'B';
const a = require('./cycle-a.cjs');
console.log('b.cjs 里 a.a =', a.a);
```

**实测输出**：

```
b.cjs 里 a.a = A
a.cjs 里 b.b = B
```

**能跑！** 因为 CJS 的加载是「边执行边填充 `module.exports`」：

```
require('cycle-a') →
  ① 创建 a 的 module.exports = {}
  ② 执行 a 的代码，第一行 exports.a = 'A' → 此时 exports 已经有 a 了
  ③ a 里 require('cycle-b') →
       创建 b 的 module.exports = {}
       执行 b，第一行 exports.b = 'B'
       b 里 require('cycle-a') → 命中缓存，返回【部分导出】的 a（已含 a）
       → 打印 a.a = 'A' ✓
  ④ 回到 a，继续，打印 b.b = 'B' ✓
```

#### ESM：抛 TDZ 错误

```js
// cycle-a.mjs
import { b } from './cycle-b.mjs';
export const a = 'A';
console.log('a.mjs 里 b =', b);

// cycle-b.mjs
import { a } from './cycle-a.mjs';
export const b = 'B';
console.log('b.mjs 里 a =', a);
```

**实测**：

```
ReferenceError: Cannot access 'a' before initialization
```

**为什么**？因为 ESM 的 live binding + **TDZ**：

1. ESM 会**先把所有模块的「形状」确定下来**（hoisting），但 `const`/`let` 声明的变量处于 **TDZ（暂时性死区）**
2. 执行 `b.mjs` 时，它 import 了 `a`，但 `a.mjs` 还没执行到 `export const a = 'A'` 这一行
3. 访问处于 TDZ 的 `a` → **直接抛 `ReferenceError`**

> **这个对比的杀伤力**：
> 「很多人以为 ESM 更先进，循环依赖处理得更好。**实际相反。** ESM 的静态 + TDZ 特性让它对循环依赖**更严格**：CJS 能拿到『部分导出』的对象，ESM 拿到的是『还没初始化的绑定』，直接报错。
>
> 所以**用 ESM 时更要避免循环依赖**。这不是退步——严格报错比「静默拿到半个对象」更好排查。」

### 差异 1：扩展名（单独问的）

**题单的解释方向对，但不够准确。**

> 题单说：「浏览器需要知道完整 URL 才能请求资源，不能像 CJS 那样自动补全。」

**更准确的原因**有两条：

#### ① 浏览器确实不能猜（但这不是 Node 的完整理由）

浏览器的 `import './dep'` 会去请求 `https://site.com/dep`——如果服务器返回 404，就失败。**浏览器不会尝试 `./dep.js`、`./dep/index.js`**。这是 HTTP 的现实约束：**一个 URL 就是一个请求，猜错就多一次往返**。

#### ② Node 的 ESM 是「严格模式」，故意不做猜测

**这才是有意思的部分**。Node 完全可以像 CJS 一样去猜扩展名，但它**故意不猜**，理由是：

| 原因 | 说明 |
|---|---|
| **性能** | 猜一次要多次 `fs.stat` 系统调用。CJS 的 `require` 慢，很大一部分就是这个（每个路径都要试 `.js`、`.json`、`.node`、`/index.js`） |
| **确定性** | 「猜」会导致同一个 import 在不同目录结构下解析到不同文件。**显式是更可靠的** |
| **对齐标准** | 和浏览器语义一致，同构代码（SSR）才能无痛 |
| **提前发现错误** | 少写扩展名在 CJS 里能跑，在 ESM 里立刻报错——**早失败** |

**实测对比**：

```
CJS:  require('./dep')      → "ok"          ✅
ESM:  import './dep'        → ERR_MODULE_NOT_FOUND
ESM:  import './dep.mjs'    → "ok"          ✅
```

> **答题时的推荐版本**：
> 「有两个层面的原因。**表层是浏览器标准**——浏览器不会猜扩展名，一个 URL 就是一个请求。**深层是 Node 的设计选择**——ESM 故意不做路径猜测，一是省掉多次 `fs.stat` 的性能开销，二是保证解析结果的确定性，三是和浏览器语义一致，让同构代码能直接跑。」

### 差异 10：`import` 会被提升

```js
// 这段代码能跑，虽然 console.log 在 import 之前
console.log(typeof foo);   // ← 能拿到 foo？
import { foo } from './x.mjs';
```

**能**。因为 `import` 语句在编译阶段就被处理了，「提升」到了模块顶部。

**这和 `require` 完全不同**：

```js
console.log(typeof bar);
const { bar } = require('./x');   // ← 这里才执行，前面是 undefined
```

**为什么 CJS 能条件加载？**

```js
if (process.env.NODE_ENV === 'development') {
  require('./dev-tools');   // ✅ CJS 可以
}
```

```js
if (cond) {
  import { x } from './x';   // ❌ 语法错误：import 必须在顶层
}
// 要用动态导入
const { x } = await import('./x');   // ✅
```

---

## 3.4 `require` 的查找策略

### 题单答案

> 「1. 绝对/相对路径：直接找，失败补 `.js`/`.json`/`.node`
> 2. 核心模块（fs/path）：直接返回
> 3. node_modules：从当前目录向上找
> 4. 找目录：先找 package.json 的 main，没有则找 index.js」

**顺序基本对，但有两点需要修正**：

1. **核心模块优先级最高**，不是第二（题单的顺序容易让人以为先找文件）
2. 少了 `package.json` 的 `exports` 字段（现代包都要考虑）

### 实测：完整的查找优先级

我构造了一个包含所有情况的目录树，实测结果：

```
./local       → local.js              （.js 优先于 .json）
./local.js    → local.js
./noext       → noext.js              （自动补 .js）
./dir         → dir/index.js          （目录 → index）
./pkg         → pkg 的 main 字段指向 lib/entry.js
foo           → app/node_modules/foo/main.js
bar           → 向上找到根 node_modules/bar
fs            → [module]              （核心模块，node_modules 里的假 fs 被忽略）
path          → [module]
```

`require.resolve` 的完整路径：

```
./dir      ⇒ /app/dir/index.js
./pkg      ⇒ /app/pkg/lib/entry.js
foo        ⇒ /app/node_modules/foo/main.js
bar        ⇒ /tmp/.../node_modules/bar/index.js
fs         ⇒ fs                        ← 裸名字！说明是内置模块
```

### 完整规则（七步）

```
① 是内置模块吗？（fs / path / http / node:fs …）
   → 是则直接返回，不查文件系统
   ↓ 否
② 以 ./ 或 ../ 或 / 开头 → 当作文件/目录路径解析
   ↓ 否
③ 当作模块名 → 从当前目录开始，逐层向上查找 node_modules/<name>
   （/app/src → /app/node_modules → /node_modules → ... 直到根）
   ↓ 找到包目录后
④ 有 package.json 的 exports 字段吗？
   → 有：按 exports 的规则解析（子路径 + 条件），不再看 main
   ↓ 没有
⑤ 有 package.json 的 main 字段吗？
   → 有：用 main 指向的文件
   ↓ 没有
⑥ 找 index.js / index.json / index.node
```

**「当作文件路径」时的尝试顺序（② 的细节）**：

```
X                 → 直接找（必须有扩展名且存在）
X.js
X.json
X.node
X/package.json 的 main
X/index.js
X/index.json
X/index.node
```

**实测证据**：我同时放了 `local.js` 和 `local.json`，`require('./local')` 拿到的是 **`local.js`**——说明 `.js` 优先。

### `exports` 字段：现代包的一道门（实测）

这是题单完全没提但**现在最重要**的知识点。

如果一个包有 `exports` 字段，它就成了**一道门**——**没列出的路径完全不可访问**，连 `main` 指向的文件也不行。

我构造了 `pkg-a`：

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

实测结果（CJS 侧）：

```
require("pkg-a")              → "cjs.cjs（require 进来）"
require("pkg-a/utils")        → "utils.cjs"
require("pkg-a/feature/a")    → "feature/a.js"
require("pkg-a/package.json") → "1.0.0"
require("pkg-a/secret")       → ✗ ERR_PACKAGE_PATH_NOT_EXPORTED
require("pkg-a/legacy")       → ✗ ERR_PACKAGE_PATH_NOT_EXPORTED   ← main 指向的也被挡！
```

ESM 侧：

```
import "pkg-a"          → "esm.mjs（import 进来）"     ← 同一个包，不同文件
import "pkg-a/utils"    → "utils.mjs"
import "pkg-a/secret"   → ✗ ERR_PACKAGE_PATH_NOT_EXPORTED
```

**对照：没有 `exports` 的包**

```
require("pkg-b")            → "pkg-b index"
require("pkg-b/internal")   → "pkg-b/internal（能直接 require）"   ← 内部文件随便访问
```

**只写字符串的 `exports`**：

```json
{ "exports": "./only.js" }
```
```
require("pkg-c")        → "pkg-c only.js"
require("pkg-c/other")  → ✗ ERR_PACKAGE_PATH_NOT_EXPORTED
```

### `exports` 的五个要点

| 要点 | 说明 |
|---|---|
| **它是「白名单」** | 没列出的路径一律不可访问（`ERR_PACKAGE_PATH_NOT_EXPORTED`） |
| **它会覆盖 `main`/`module`** | 实测 `pkg-a/legacy`（main 指向的）也被挡 |
| **支持条件导出** | `import` / `require` / `default` / `node` / `browser`… **同一个包给不同环境不同文件** |
| **支持通配符** | `./feature/*` 批量暴露子路径 |
| **`package.json` 要单独导出** | 否则 `require('pkg/package.json')` 也会失败（很多工具需要读它） |

> **双格式包的标准写法（可以直接抄）**：
> ```json
> {
>   "type": "module",
>   "exports": {
>     ".": {
>       "types": "./dist/index.d.ts",
>       "import": "./dist/index.mjs",
>       "require": "./dist/index.cjs"
>     },
>     "./package.json": "./package.json"
>   }
> }
> ```
> **注意 `types` 要放第一个**——TypeScript 按顺序匹配，条件满足就停。

### `type` 字段：决定 `.js` 按什么解析

```json
{ "type": "commonjs" }   // 默认。.js 按 CJS 解析
{ "type": "module" }     // .js 按 ESM 解析
```

**实测**：

```
type=commonjs 时，.js 里 this === module.exports: true
type=module 时，  .js 里 this === undefined: true
```

**文件扩展名优先级高于 `type`**：

| 扩展名 | 永远按 |
|---|---|
| `.cjs` | CommonJS（不管 `type`） |
| `.mjs` | ES Module（不管 `type`） |
| `.js` | 看最近的 `package.json` 的 `type` |

---

## 3.5 面试怎么说（2 分钟版）

> 「CJS 和 ESM 的区别，我会分三层说。
>
> **第一层是表面的语法差异**：`require`/`module.exports` 对应 `import`/`export`；CJS 可以省略扩展名、ESM 必须写；CJS 有 `__dirname` 和 `require`，ESM 没有（要用 `import.meta.url`）。
>
> **第二层是机制差异**：CJS 是**运行时同步加载**，`require` 执行的时候才去找文件、执行模块；ESM 是**编译时静态分析**，`import` 会被提升到顶部，所以能做 tree shaking。
>
> **第三层是最本质的**，也是我最想强调的：**CJS 导出的是值拷贝，ESM 是 live binding**。我实测过——ESM 里 `export let count` 加一个 `inc()` 函数，导入方 `count` 会跟着从 0 变到 1 变到 2；但在 CJS 里如果导出 `snapshot: count`，那永远是 0。**这就是为什么 ESM 里能跨模块共享状态，而 CJS 必须导出对象或 getter。**
>
> 还有一个反直觉的点：**ESM 的循环依赖比 CJS 更容易炸**。CJS 能拿到「部分导出」的对象，正常输出；ESM 因为 live binding + TDZ，会直接抛 `ReferenceError: Cannot access 'a' before initialization`。所以用 ESM 更要避免循环依赖。
>
> 至于扩展名，表层原因是浏览器不会猜扩展名，深层原因是 **Node 的 ESM 故意不做路径猜测**——省掉多次 `fs.stat`、保证解析确定性、和浏览器语义一致让同构代码能跑。」

### 追问链

| 追问 | 答法 |
|---|---|
| `import` 能写在 if 里吗？ | 不能，必须在顶层。要条件加载用 `await import()` |
| `import()` 和 `import` 区别？ | 前者是**函数调用**，返回 Promise，可以动态、可以条件、可以在任何地方 |
| ESM 里怎么拿到 `require`？ | `createRequire(import.meta.url)`。**很多老包只提供 CJS，ESM 里就得这么引** |
| 两种模块能混用吗？ | Node 22+ 支持 `require()` 加载 ESM（之前不行）。但**最好别混**，容易出 interop 问题 |
| 为什么 `type: module` 后所有 `.js` 都变 ESM 了，会不会破坏依赖？ | 不会。`node_modules` 里的包**按它们自己的 `package.json`** 解析，不受你项目的 `type` 影响 |
| `exports` 会不会破坏老代码？ | 会。加了 `exports` 后，之前能 `require('pkg/internal/xxx')` 的代码全部失败。**所以很多库加 `exports` 是 breaking change，要发大版本** |
| 为什么有些包同时提供 `main`/`module`/`exports`？ | 兼容。老工具只认 `main`，打包器认 `module`，Node 12+ 认 `exports`。**新库可以只写 `exports`** |
| `require` 缓存能清吗？ | `delete require.cache[require.resolve('./x')]`。**但只适合测试/热重载，生产慎用**（可能导致状态不一致） |
| 为什么 `require` 比 `import` 慢？ | ① 同步 I/O；② 要试多个扩展名（多次 `fs.stat`）；③ 运行时解析路径。**ESM 的解析在编译期就做完了** |

---

## 3.6 速记卡

```
【一句话】
CJS：运行时同步加载 + 值拷贝
ESM：编译时静态分析 + live binding（活绑定）

【十项差异】
扩展名      可省            必须写
顶层 this   module.exports  undefined
__dirname   有              没有（用 import.meta.url）
require     有              没有
导出绑定    值拷贝          活绑定        ★最本质
顶层 await  不支持          支持
循环依赖    能跑(部分导出)   TDZ 报错      ★反直觉
严格模式    非严格          严格
静态分析    不能            能（tree shaking 基础）
加载时机    运行时可条件    提升到顶部

【live binding 实测】
ESM: count 0 → 1 → 2（跟着变）
CJS: count 1 / snapshot 0（快照不变）

【循环依赖实测】
CJS: b.cjs 里 a.a = A ✓  能跑
ESM: ReferenceError: Cannot access 'a' before initialization ✗
原因：CJS 边执行边填 exports；ESM 是 TDZ

【为什么 ESM 必须写扩展名】
表层：浏览器不会猜扩展名（一个 URL 一个请求）
深层：Node 故意不猜 → 省 fs.stat / 保证确定性 / 对齐标准 / 早失败

【require 查找七步】
① 内置模块（fs/path）→ 直接返回，不查文件
② ./ ../ / 开头 → 当路径
③ 否则逐层向上找 node_modules
④ 有 exports → 按 exports 白名单（覆盖 main！）
⑤ 有 main → 用 main
⑥ 找 index.js/json/node
文件尝试顺序：X → X.js → X.json → X.node → X/package.json main → X/index.*

【exports 是白名单】★
没列出的一律 ERR_PACKAGE_PATH_NOT_EXPORTED
连 main 指向的也被挡
支持条件导出：import/require/types/default
支持通配符 ./feature/*
package.json 要单独导出
types 要放第一个

【type 字段】
type:commonjs（默认）→ .js 按 CJS
type:module → .js 按 ESM
.cjs 永远 CJS，.mjs 永远 ESM（不受 type 影响）

【require 缓存】
3 次 require 只执行 1 次
delete require.cache[require.resolve(x)] 可清
```

---

## 3.7 自测

```
□ 能用「值拷贝 vs 活绑定」一句话说出两者最本质的差别
□ 能默写十项差异中的至少七项
□ 能解释 live binding 的实际影响（跨模块共享状态）
□ 能说出 CJS 为什么能跑循环依赖
□ 能说出 ESM 循环依赖为什么会 TDZ 报错
□ 能说出 ESM 必须写扩展名的两层原因
□ 能说出 require 查找的七个步骤
□ 能说出文件路径解析时的扩展名尝试顺序（.js 优先于 .json）
□ 能说出 __dirname 为什么不在 globalThis 上
□ 能说出 exports 字段是白名单、会覆盖 main
□ 能写出双格式包的标准 exports 配置
□ 能说出 types 条件为什么要放第一个
□ 能说出 .cjs/.mjs/.js 三者的解析优先级
□ 能说出 require 缓存的行为和清除方法
□ 能说出 require.main === module 的用途
```
