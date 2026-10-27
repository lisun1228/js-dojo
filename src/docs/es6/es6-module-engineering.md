# 分册 05 · 模块与工程化：ESM vs CommonJS、HMR

> 覆盖题号：**6**（ES6 模块与 CommonJS 的差异）、**2**（ES6 怎么热更新的）
> 只有 **2 题**，但第 6 题是「模块化」类追问的入口，第 2 题严格说不属于 ES6（属于构建工具）

---

## 目录

- [5.0 先纠正一个前提](#50-先纠正一个前提)
- [5.1 ES Module 与 CommonJS 的六个差异](#51-es-module-与-commonjs-的六个差异)
- [5.2 深入：ESM 的三个加载阶段](#52-深入esm-的三个加载阶段)
- [5.3 循环依赖：两种模块系统的表现差异](#53-循环依赖两种模块系统的表现差异)
- [5.4 互操作：Node 里怎么混用（实战必踩）](#54-互操作node-里怎么混用实战必踩)
- [5.5 HMR 是什么、怎么工作](#55-hmr-是什么怎么工作)
- [5.6 本册答题模板汇总](#56-本册答题模板汇总)
- [5.7 速记卡与连环追问](#57-速记卡与连环追问)

---

## 5.0 先纠正一个前提

### 5.0.1 第 2 题不是 ES6 的题

**HMR（Hot Module Replacement）和 ES6 规范没有关系**：它是 **Webpack / Vite 这类构建工具**基于模块系统实现的能力，不属于语言规范。

回答时先界定边界：HMR 不是 ES6 规范的一部分，下面从「模块化之后为什么能热替换」展开。

### 5.0.2 第 6 题的答题范围

第 6 题需要覆盖：**活绑定**、**三个加载阶段**、**`import` 必须在顶层**、**循环依赖的表现差异**、**Node 互操作**。下面逐层展开。

---

## 5.1 ES Module 与 CommonJS 的六个差异

### 5.1.0 一句话结论

> **ESM 是"编译时静态"的模块系统**：依赖关系在**代码解析阶段**就确定了，导入的是**值的引用（活绑定）**，加载是**异步**的，所以能被 tree-shaking。
> **CommonJS 是"运行时动态"的模块系统**：`require` 是一个**普通函数调用**，什么时候执行、执行几次都由运行时决定，导入的是**值的拷贝**，加载是**同步**的。

### 5.1.1 差异对照表

| 维度 | ES Module | CommonJS |
|---|---|---|
| **依赖确定时机** | **编译时**（静态解析） | **运行时**（执行到 `require` 才知道） |
| **导出/导入的本质** | **值的引用**（live binding） | **值的拷贝** |
| **加载方式** | **异步**（先 fetch 再执行） | **同步**（阻塞式） |
| **顶层 `this`** | `undefined` | `module.exports` |
| **严格模式** | 默认严格模式 | 默认非严格模式 |
| **能否 tree-shaking** | ✅ 能（需无副作用 / 纯函数标注） | ❌ 不能（多数情况） |
| **`import` 位置** | 必须在**顶层**（不能放 `if` 里） | `require` 可以放任何位置 |
| **缓存** | 按 URL 缓存，**只求值一次** | 按路径缓存，`require.cache` |
| **循环依赖表现** | 用 TDZ 报错，函数声明可用 | 拿到"未完成的 exports" |

### 5.1.2 差异一：静态 vs 运行时（最根本）

```js
// ===== ESM：依赖关系是"写死的" =====
import { a } from './a.js';         // ← 解析阶段就知道依赖 ./a.js

if (condition) {
  // import { b } from './b.js';   // ❌ SyntaxError：import 只能在顶层
}

const mod = await import('./c.js'); // ✅ 动态导入（返回 Promise，这是运行时）
```

```js
// ===== CJS：require 是函数调用，运行时才执行 =====
const a = require('./a');           // ← 执行到这一行才去加载

if (condition) {
  const b = require('./b');         // ✅ 完全合法
}

function load(name) {
  return require(`./${name}`);      // ✅ 甚至可以是变量（动态路径）
}
```

**这个差异是 tree-shaking 的前提**：

```
ESM：解析阶段可构建完整依赖图 → 未使用的 export 可被移除
CJS：require 可在 if / 函数内、路径可为变量 → 无法静态确定，只能整块打入
```

静态依赖图只是前提。实际能否移除还取决于副作用声明（`package.json` 的 `sideEffects`）和纯函数标注（`/*#__PURE__*/`）：模块若被判定有副作用，即使导出未被使用也不能删。

> **这就是 `package.json` 同时提供 `main` / `module` / `exports` 的原因**：`main` 给 Node 的 `require`，`module` 给打包工具做 tree-shaking，`exports` 按条件分流：
> ```jsonc
> {
>   "main": "./dist/index.cjs",     // Node require 用
>   "module": "./dist/index.esm.js", // 打包工具用（能 tree-shaking）
>   "exports": {
>     "import": "./dist/index.esm.js",
>     "require": "./dist/index.cjs"
>   }
> }
> ```

### 5.1.3 差异二：值引用（活绑定）vs 值拷贝

判断依据：导出方后续修改变量，导入方能否观察到。

```js
// ===== ESM =====
// counter.js
export let count = 0;
export function increment() {
  count++;
}

// main.js
import { count, increment } from './counter.js';
console.log(count);   // 0
increment();
console.log(count);   // 1  ← ✅ 变了！因为拿到的是"引用"
```

```js
// ===== CJS =====
// counter.js
let count = 0;
module.exports = {
  count,                      // ← 这里是"取值拷贝"，拷贝的是 0
  increment() { count++; },   // ← 内部的 count 和导出的 count 已经不是同一个了
};

// main.js
const { count, increment } = require('./counter.js');
console.log(count);   // 0
increment();
console.log(count);   // 0  ← ❌ 没变
```

**为什么 CJS 不变？**

```
CJS 的 module.exports 是一个普通对象
module.exports = { count: 0, increment }
                  ↑
           这里存的是"当时的值"
increment 里改的是模块作用域里的 count 变量
→ 和 exports.count 这个属性已经脱钩了
```

**要"看到"变化，必须通过 `exports` 对象读**：

```js
// counter.js（正确写法）
let count = 0;
module.exports = {
  get count() { return count; },   // ← 用 getter 才能实时读到
  increment() { count++; },
};

// 或者
module.exports = {
  increment() { module.exports.count++; },
  count: 0,
};
```

**ESM 的"活绑定"具体是什么？**

规范里，`import { count }` 不是"把值复制过来"，而是**在 importer 的模块环境里创建一个指向 exporter 绑定的"间接绑定"（indirect binding）**。所以：

```js
// main.js
import { count } from './counter.js';
count = 10;      // ❌ TypeError: Assignment to constant variable
                 //（导入的绑定是只读的，不能从 importer 侧赋值）
```

> **一句话记忆**：
> **ESM 是"共享同一个变量"，CJS 是"复制一份值"。** 这也是为什么 `import` 的绑定不能赋值，但能"跟着变"。

### 5.1.4 差异三：异步 vs 同步加载

```html
<!-- ESM：浏览器里异步 fetch，等价于 defer，不阻塞 HTML 解析 -->
<script type="module" src="./main.js"></script>
```

```js
// CJS：require 同步阻塞，直到文件读完并执行完
const a = require('./a');
console.log('after');   // 一定在 a 执行完之后
```

**这个差异的根源是使用场景**：

| | 浏览器 | Node |
|---|---|---|
| ESM | 异步 fetch，不阻塞解析 | loader 异步，模块体按依赖顺序求值（顶层 `await` 会挂起） |
| CJS | 不支持 | 同步加载，启动时一次性执行完 |

**ESM 的 `import` 为什么"看起来是同步的"？**

```js
import { a } from './a.js';
console.log(a);   // 能直接用，不像 await
```

因为**模块的求值发生在所有依赖加载完之后**，而 `import` 语句本身只是"声明依赖"，真正执行时依赖已经准备好了。规范里这叫「**实例化阶段先于求值阶段**」（见 5.2）。

### 5.1.5 差异四：顶层 `this`

```js
// ESM
console.log(this);        // undefined

// CJS
console.log(this);        // {} ← 就是 module.exports
console.log(this === module.exports);   // true
```

**为什么 ESM 是 `undefined`？** 因为 ESM 顶层是**模块作用域**，不是函数作用域，没有"调用者"，所以 `this` 没有意义，规范规定为 `undefined`（也可以理解为 ESM 默认严格模式）。

**实践影响**：

```js
this.something = 1;                      // ❌ ESM 里 this 是 undefined
(function ($) { /* ... */ })(this);      // ❌ 依赖 this 的 UMD/jQuery 插件写法失效
```

### 5.1.6 差异五：循环依赖的表现

- **CJS**：`require` 返回**当前已执行到的那部分 `exports`**，循环处拿到「半成品」，缺失属性静默为 `undefined`，已赋值的字段是当时的值。
- **ESM**：绑定在**实例化阶段**创建但尚未初始化；循环处访问 `let` / `const` / `class` 绑定会命中 TDZ，抛 `ReferenceError`。
- **函数声明**：ESM 在实例化阶段就初始化，循环中可调用；CJS 的 `exports.fn = ...` 仍要执行到那一行才存在。

完整执行顺序与代码见 [5.3 循环依赖](#53-循环依赖两种模块系统的表现差异)。

| | CJS | ESM |
|---|---|---|
| 循环处拿到 | 未完成的 `exports`（可能 `undefined`） | 绑定存在但处于 TDZ → `ReferenceError` |
| 函数声明 | 执行到 `exports.fn = ...` 才可用 | 实例化阶段已可用 |
| 错误暴露 | 晚（静默 `undefined`） | 早（直接抛错） |

### 5.1.7 差异六：缓存机制

```js
// ESM：按 URL 缓存，同一个 URL 只求值一次
import './a.js';
import './a.js?foo';    // ← 不同 URL 是新模块实例（Vite HMR 用时间戳 query 做替换）

// CJS：按解析后的绝对路径缓存
require('./a');
require('./a.js');      // ← 同一个缓存（补了扩展名也认）
require('./a');         // ← 同一个缓存
console.log(require.cache);   // 可以看到缓存表
```

### 5.1.8 语法对照表

| 能力 | ESM | CJS |
|---|---|---|
| 默认导出 | `export default foo` | `module.exports = foo` |
| 命名导出 | `export const a = 1` | `exports.a = 1` |
| 重命名导出 | `export { a as b }` | 手动赋值 |
| 默认导入 | `import foo from './x'` | `const foo = require('./x')` |
| 命名导入 | `import { a } from './x'` | `const { a } = require('./x')` |
| 全部导入 | `import * as ns from './x'` | `const ns = require('./x')` |
| 副作用导入 | `import './x'` | `require('./x')` |
| 动态导入 | `await import('./x')` | `import('./x')` |
| 再导出 | `export { a } from './x'` / `export * from './x'` | `module.exports = require('./x')` |

### 5.1.9 答题模板

- **根本差异**：ESM 是编译时静态，`import` 必须在顶层，依赖图在解析阶段确定；CJS 的 `require` 是运行时函数调用，可放在 `if` 里、路径可为变量。
- **值的语义**：ESM 导出活绑定，导出方改变量，导入方能观察到；CJS 导出值拷贝，导出后脱钩。
- **其他差异**：ESM 异步加载、顶层 `this` 为 `undefined`、默认严格模式；CJS 同步加载、顶层 `this` 为 `module.exports`。
- **两个实战点**：循环依赖 CJS 拿到半成品、ESM 报 TDZ；Node 里 ESM 没有 `require` / `__dirname`，用 `import.meta.url` 换算，CJS 侧用 `await import()` 加载 ESM。

### 5.1.10 追问表

| 追问 | 答题要点 |
|---|---|
| 最根本的区别？ | 静态（编译时）vs 动态（运行时） |
| 为什么 ESM 能 tree-shaking？ | 依赖图静态可分析，且模块无副作用（`sideEffects` / 纯函数标注） |
| 活绑定是什么意思？ | 导入的是对导出变量的引用，值会同步变化 |
| 导入的变量能赋值吗？ | 不能，`TypeError`（只读绑定） |
| ESM 是同步还是异步？ | 异步（浏览器要先 fetch） |
| ESM 顶层 `this`？ | `undefined` |
| CJS 顶层 `this`？ | `module.exports` |
| 循环依赖谁更安全？ | ESM（报错早），CJS 会静默 `undefined` |
| ESM 里能用 `require` 吗？ | 不能；Node 22.12+ 支持在 CJS 里 `require(esm)`，方向相反 |
| ESM 里怎么拿 `__dirname`？ | `path.dirname(fileURLToPath(import.meta.url))` |
| `import()` 和 `import` 区别？ | 前者运行时、返回 Promise、可动态路径；后者静态、顶层 |
| 为什么 `import` 不能写在 `if` 里？ | 静态结构要求，否则无法在编译期建依赖图 |
| ESM 能条件加载吗？ | 顶层不能，要用 `import()` |
| CJS 能 tree-shaking 吗？ | 基本不能；`require` 与导出都可能动态生成 |
| `exports` 和 `module.exports` 区别？ | 初始指向同一对象；重新赋值 `module.exports` 会让 `exports` 失效 |

---

## 5.2 深入：ESM 的三个加载阶段

ESM 的加载分构造、实例化、求值三阶段；循环依赖能成立，靠的是实例化阶段先建立绑定。

### 5.2.1 三个阶段

```
① Construction（构造）
   ├─ 下载文件（浏览器 fetch / Node 读文件）
   ├─ 解析成 Module Record
   └─ 递归处理 import，构建完整的模块图

② Instantiation（实例化 / 链接）
   ├─ 为每个模块创建"模块环境"
   ├─ 把所有 import/export 连接起来（创建绑定，但还不赋值）
   └─ ⚠️ 此时函数声明已经可用（提升），但 let/const/class 还在 TDZ

③ Evaluation（求值）
   ├─ 按依赖顺序（后序深度优先）执行模块体
   └─ 执行完，绑定被赋值
```

**为什么必须是这个顺序？**

因为**循环依赖需要它能工作**。如果只有"加载 + 执行"两步，循环依赖就死锁了。加了"实例化"这一步，两个模块的绑定可以**先连接好，再分别求值**——这就是 ESM 能处理循环依赖的原因。

### 5.2.2 用代码"看到"这三个阶段

```js
// a.js
console.log('a 求值');
export const value = 'a';

// b.js
console.log('b 求值');
import { value } from './a.js';
export const derived = value + '!';

// main.js
import { derived } from './b.js';
console.log(derived);
```

执行顺序：

```
① 构造：下载 a.js、b.js、main.js，建图
② 实例化：连接 a.value → b 的 value 绑定；b.derived → main 的 derived 绑定
   （此时还没有任何 console.log）
③ 求值：按后序深度优先
   → 先求值 a.js → 打印 'a 求值'
   → 再求值 b.js → 打印 'b 求值'
   → 最后求值 main.js → 打印 'a!'
```

**关键观察**：所有 `console.log('求值')` 都在**实例化之后**才执行，且**被依赖的模块先求值**。

### 5.2.3 一个能证明"实例化阶段存在"的例子

静态依赖总会被先求值，单独 `import` 无法证明实例化；必须用循环依赖：入口模块的函数在**自己的模块体执行前**就被依赖方调用。

```js
// a.mjs（入口）
import './b.mjs';
console.log('a 求值');
export function fn() { return 'ok'; }
```

```js
// b.mjs
import { fn } from './a.mjs';
console.log('b 求值，fn() =', fn());   // a.mjs 的模块体还没执行
```

**输出**：

```
b 求值，fn() = ok
a 求值
```

**为什么？** `fn` 是函数声明，在实例化阶段已初始化，`b.mjs` 求值时可以直接调用；`a.mjs` 的 `console.log` 要等依赖求值完才执行。若只有「加载 → 执行」两步，这个输出无法解释。

---

## 5.3 循环依赖：两种模块系统的表现差异

### 5.3.1 CJS 的循环依赖：拿到"半成品"

```js
// a.js
console.log('--- a 开始 ---');
exports.loaded = false;          // ① 先设个标记
const b = require('./b');        // ② 进入 b.js（此时 a 还没执行完）
console.log('a 看到 b.loaded =', b.loaded);
exports.loaded = true;           // ③ 最后改
console.log('--- a 结束 ---');

// b.js
console.log('--- b 开始 ---');
const a = require('./a');        // ④ 拿到 a 的"半成品 exports"
console.log('b 看到 a.loaded =', a.loaded);   // false（① 已经执行了）
exports.loaded = false;
console.log('--- b 结束 ---');

// main.js
require('./a');

// 输出：
// --- a 开始 ---
// --- b 开始 ---
// b 看到 a.loaded = false
// --- b 结束 ---
// a 看到 b.loaded = false
// --- a 结束 ---
```

**关键**：④ 时 `a.js` 只执行到 ②，`exports.loaded` 还是 `false`（① 已执行，③ 未执行）。CJS 返回的是同一个 `exports` 对象的引用，不是深拷贝；之后对 `exports` 的修改，调用方再读取时仍能看到。

**如果 `a.js` 里 `exports.loaded = true` 在 `require` 之前呢？**

```js
// a.js
exports.loaded = true;
const b = require('./b');   // b 里会看到 true
```

### 5.3.2 ESM 的循环依赖：TDZ 报错

```js
// a.mjs（入口）
import { b } from './b.mjs';
export const a = 'a';
console.log('a 求值，b =', b);   // 不会执行

// b.mjs
import { a } from './a.mjs';
export const b = a + '!';        // ❌ ReferenceError: Cannot access 'a' before initialization
```

求值时入口 `a` 先处理依赖 `b`，`b` 的模块体先执行；此时 `a` 的绑定仍在 TDZ，错误在 `b` 抛出，`a` 的模块体一行都没执行。

**换成函数声明就能工作**：函数声明在实例化阶段已初始化，循环中可以调用（执行过程见 [5.2.3](#523-一个能证明实例化阶段存在的例子)）；`let` / `const` / `class` 没有这一步，仍会命中 TDZ。

### 5.3.3 怎么避免循环依赖

| 方法 | 说明 |
|---|---|
| **分层架构** | 底层模块不依赖上层（`utils` → `services` → `components`） |
| **提取公共模块** | 两个模块互相依赖的部分抽到第三个模块 |
| **依赖注入** | 不在模块顶层 import，而是把依赖作为参数传入 |
| **动态导入** | `await import()` 放到函数体内，打破静态循环 |
| **用函数而非常量导出** | 函数声明提升，能扛住循环 |
| **ESLint 插件** | `import/no-cycle` 检测并报错 |

---

## 5.4 互操作：Node 里怎么混用（实战必踩）

### 5.4.1 启用 ESM 的两种方式

`package.json` 声明后整个包默认 ESM：

```json
{ "type": "module" }
```

另一种是按扩展名：`.mjs` 强制 ESM，`.cjs` 强制 CJS。

### 5.4.2 ESM 里拿 CJS 的"缺失变量"

```js
// ❌ ESM 里这些都不是全局变量
console.log(__dirname);   // ReferenceError: __dirname is not defined
console.log(__filename);  // ReferenceError: __filename is not defined
console.log(require);     // ReferenceError: require is not defined
```

```js
// ✅ 用 import.meta 换算
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

**`import.meta` 还能干什么？**

```js
console.log(import.meta.url);                 // file:///.../module.mjs
console.log(import.meta.resolve('./x.js'));   // file:///.../x.js（Node 同步返回 URL）
console.log(import.meta.env);                 // undefined；Vite 注入后才存在
console.log(import.meta.hot);                 // undefined；Vite HMR 运行时才注入
```

### 5.4.3 CJS 里加载 ESM

```js
// ❌ 静态 import 不行
// import x from './x.mjs'   // SyntaxError in .cjs

// ✅ 动态 import（返回 Promise）
(async () => {
  const { default: x } = await import('./x.mjs');
})();
```

> **新变化**：Node 22.12 起默认开启 `require(esm)`（本机 v22.12.0 实测可用，仍打印 `ExperimentalWarning`）。带顶层 `await` 的模块会抛 `ERR_REQUIRE_ASYNC_MODULE`，需改用 `await import()`。

### 5.4.4 ESM 里加载 CJS

```js
// ✅ 默认导入 = module.exports，最稳
import pkg from 'lodash';
const { debounce } = pkg;
```

```js
// 命名导入依赖 cjs-module-lexer 的静态分析，能静态识别时才有值
import { debounce } from 'lodash';
```

`module.exports = { ... }` 这类静态字面量能被识别；动态拼装（循环、计算属性）推断不出命名导出，只能走默认导入再解构。

### 5.4.5 常见报错对照表

| 报错 | 原因 | 解法 |
|---|---|---|
| `Cannot use import statement outside a module` | CJS 环境里写了 `import` | 加 `"type": "module"` 或改 `.mjs` |
| `require is not defined` | ESM 里用了 `require` | 改 `import`，或用 `createRequire` |
| `__dirname is not defined` | ESM 没有 `__dirname` | `fileURLToPath(import.meta.url)` |
| `ERR_REQUIRE_ASYNC_MODULE` | CJS `require` 了带顶层 `await` 的 ESM | 用 `await import()` |
| `ERR_REQUIRE_ESM` | Node < 22.12 的 CJS `require` 了纯 ESM | 升级 Node，或用 `await import()` |
| `Named export 'x' not found` | CJS 包没有该命名导出，或静态分析推断不出 | 默认导入再解构 |
| `ERR_MODULE_NOT_FOUND` | ESM **必须写扩展名** | 补 `.js`（浏览器和 Node ESM 都要求） |

ESM 相对路径必须带扩展名：`import './utils'` 在 CJS 里可以，在 ESM 里会报 `ERR_MODULE_NOT_FOUND`。

---

## 5.5 HMR 是什么、怎么工作

### 5.5.0 一句话结论

> HMR（Hot Module Replacement，模块热替换）是**构建工具**的能力：文件改动后，**只替换被改动的那一个（或几个）模块**，不刷新页面，因此**应用状态得以保留**。流程是「**watch 文件 → 增量编译 → WebSocket 通知 → 拉取新模块 → 替换模块缓存 → 向上冒泡找 accept 边界**」。它和 ES6 规范无关，是模块化之后才可能实现的能力。

### 5.5.1 先分清三个概念

| 名称 | 行为 | 状态是否保留 |
|---|---|---|
| **Live Reload**（热重载） | 文件变了 → **刷新整个页面** | ❌ 全部丢失 |
| **HMR**（热替换） | 文件变了 → **只替换模块** | ✅ 保留（大多数情况） |
| **Hot Reloading**（React 社区叫法） | 通常是 HMR 的一种实现（Fast Refresh） | ✅ 保留组件 state |

**为什么需要 HMR？** 刷新会丢失应用状态：深层弹窗、表单、登录态都要重走一遍；HMR 直接替换模块，保留这些状态，这是它的核心价值。

### 5.5.2 Webpack HMR 的完整流程（7 步）

```
① 启动 watch
   webpack-dev-server 启动，webpack 用 watch 模式监听文件系统

② 增量编译
   文件变化 → 只重新编译受影响的模块 → 生成新的 chunk 文件
   同时生成一个 manifest（描述"哪些 chunk 变了"）

③ 通过 WebSocket 推送通知
   服务端 → 浏览器：{ type: 'hash', data: '<hash>' }
                    { type: 'ok' }

④ 浏览器拉取 manifest
   HMR runtime 请求 `<hash>.hot-update.json`
   → { "h": "<hash>", "c": { "main": true } }   ← 告诉它 main chunk 需要更新

⑤ 拉取新模块代码
   请求 `main.<hash>.hot-update.js`
   → 里面是 JSONP 格式：webpackHotUpdate("main", { "./src/a.js": fn })

⑥ 替换模块缓存
   JSONP 回调执行 → 把新模块的工厂函数写进 __webpack_require__.c（模块缓存）
   → 之后 require('./src/a.js') 拿到的是新模块

⑦ 向上冒泡，找 accept 边界
   从被改的模块开始，沿着"谁 import 了它"往上找
   ├─ 找到 module.hot.accept(...) 的模块 → 执行它的回调，替换完成 ✅
   └─ 一直到入口都没找到 → 退化成 full reload（刷新页面）
```

**关键概念：HMR 边界（boundary）**

```js
// 一个模块可以声明自己能接受哪些依赖的变化
if (import.meta.hot) {          // Vite
  import.meta.hot.accept('./dep.js', (newDep) => {
    // dep.js 变了，本模块自行处理，不用往上冒泡
    render(newDep);
  });
}
```

```js
// Webpack 的写法
if (module.hot) {
  module.hot.accept('./dep.js', () => {
    render(require('./dep.js'));
  });

  // 也可以声明本模块可被替换
  module.hot.accept();

  // 清理副作用（比如解绑事件、清定时器）
  module.hot.dispose((data) => {
    clearInterval(timer);
    data.someState = currentState;   // 传给下一次
  });
}
```

**为什么需要 `dispose`？** 因为旧模块的副作用（定时器、事件监听、DOM 节点）不会自动清理，热替换后会**叠加**。`dispose` 就是给你清理的钩子。

### 5.5.3 框架怎么接入 HMR

**Vue（`vue-loader` / `@vitejs/plugin-vue`）**

```js
// 编译后的组件模块会带上这段
if (module.hot) {
  const api = require('vue-hot-reload-api');
  api.install(Vue);

  if (!module.hot.data) {
    api.createRecord('component-id', componentOptions);
  } else {
    // 只重新渲染，保留组件状态
    api.rerender('component-id', componentOptions);
  }
}
```

- **模板变了** → `rerender`：重新执行 render 函数，**保留 `data`/`state`**
- **`<script>` 变了** → `reload`：销毁重建组件（状态会丢，因为逻辑变了）

**React（Fast Refresh）**

- 基于 Babel 插件给每个组件注册"签名"
- 只改了 JSX / 样式 → 保留 `useState` 的值，重新渲染
- 改了 Hooks 的顺序/数量 → 降级为重新挂载

**CSS**

- CSS 的 HMR 直接替换 `<style>` 标签内容，不重建 DOM，开销最小

### 5.5.4 Vite 的 HMR 为什么快

**根本差异：Vite 开发时不打包。**

```
Webpack：文件变化 → 重新打包（可能涉及很多模块）→ 生成 chunk → 推送
Vite：  文件变化 → 只让"这个模块 + 它的导入者链"失效 → 浏览器重新请求这几个文件
```

```js
// Vite 的 HMR 流程
① 文件变化
② 沿模块图找到"接受这个变化的边界"（acceptedPath）
③ WebSocket 推送：{ type: 'update', updates: [{ path: '/src/a.js', acceptedPath: '/src/App.vue' }] }
④ 浏览器执行 import(`/src/App.vue?t=<timestamp>`)
   ↑ 加时间戳 query 绕过浏览器 HTTP 缓存和 ESM 模块缓存
⑤ 新模块替换旧模块，执行 accept 回调
```

**为什么加 `?t=` 参数？**

因为 **ESM 的模块是浏览器原生缓存的，而且无法"删除"某个模块的缓存**。加不同的 query 会创建一个**新的模块实例**，这是绕过 ESM 缓存的唯一办法。

**速度差异的来源**：

| | Webpack | Vite |
|---|---|---|
| 冷启动 | 先打包整个应用，耗时随项目规模增长 | 不打包，按需请求 |
| HMR 更新 | 增量打包相关 chunk | 只重新请求单个文件 |
| 项目越大 | 越慢（打包范围可能扩大） | 基本不变 |

### 5.5.5 HMR 失效的四个原因（实战排查）

| 现象 | 原因 | 解决 |
|---|---|---|
| 改代码后整页刷新 | 没找到 accept 边界（模块没接入 HMR） | 在入口加 `module.hot.accept()`，或用框架的 loader |
| 状态还是丢了 | 改的是 `<script>` 部分（Vue）或 Hooks 逻辑（React） | 正常行为，逻辑变了只能重建 |
| HMR 后行为诡异（事件叠加） | 旧模块副作用没清理 | 用 `dispose` 清定时器/监听器 |
| 改了没反应 | 文件没在 watch 范围 / 路径大小写不一致 / 缓存 | 检查 `watchOptions`，重启 dev server |

### 5.5.6 答题模板

- **定义**：HMR 是模块热替换，改动后只替换相关模块、不刷新页面，因而保留应用状态；它是构建工具基于模块系统实现的能力，不属于 ES6 规范。
- **流程**：watch 文件 → 增量编译 → WebSocket 通知 → 浏览器拉取新模块 → 替换模块缓存 → 从改动模块向上冒泡，找到 `accept` 边界执行回调，找不到则退化为整页刷新。
- **HMR 边界**：模块用 `accept` 声明自己能处理某个依赖的变化，变化不再向上冒泡；框架 loader 会自动生成，例如 Vue 模板变更走 `rerender` 保留状态，`<script>` 变更走 `reload` 重建组件。
- **Vite**：开发时不打包，基于原生 ESM，只让相关模块失效并由浏览器重新请求；用 `?t=` 时间戳创建新模块实例，绕过无法删除的 ESM 模块缓存。

### 5.5.7 追问表

| 追问 | 答题要点 |
|---|---|
| HMR 是什么？ | 模块热替换，只换模块不刷页面 |
| 和 Live Reload 区别？ | 后者整页刷新，状态全丢 |
| HMR 是 ES6 的能力吗？ | 不是，是构建工具的能力 |
| HMR 完整流程？ | watch → 编译 → WebSocket → 拉模块 → 替换 → 冒泡找边界 |
| 什么是 HMR 边界？ | 声明了 `accept` 的模块，能处理依赖变化 |
| 找不到边界会怎样？ | 退化成 full reload |
| `dispose` 干什么？ | 清理旧模块副作用（定时器、监听器） |
| Vue 的 HMR 怎么保留状态？ | 模板变更走 `rerender`，不重建组件实例 |
| React Fast Refresh 原理？ | Babel 插件注册组件签名，保留 `useState` |
| Vite 为什么比 Webpack 快？ | 不打包，按需请求，只让相关模块失效 |
| Vite 的 `?t=` 参数干什么？ | 绕过 ESM 模块缓存（缓存无法删除） |
| HMR 会丢状态吗？ | 可能，逻辑变更（Hooks 顺序、`<script>`）会重建 |
| CSS 的 HMR 为什么最快？ | 只替换 `<style>` 内容，不重建 DOM |
| 生产环境有 HMR 吗？ | 没有，只在 dev 环境 |

---

## 5.6 本册答题模板汇总

### 5.6.1 一句话版

```
⑥ ESM vs CJS   → 静态 vs 运行时；活绑定 vs 值拷贝；异步 vs 同步；undefined vs exports
② HMR          → 只换模块不刷页面；watch → 编译 → WS → 替换 → 冒泡找边界
```

### 5.6.2 把两题串起来

ESM 的静态依赖图让「模块」成为构建工具可精确操作的单元，HMR 才能只替换一个模块；CJS 的 `require` 是运行时行为，路径可动态生成，依赖边界无法完全静态确定，找不到 `accept` 边界时只能退化成整页刷新。一句话：**ESM 给出模块的静态边界，HMR 在这个边界上做增量替换。**

---

## 5.7 速记卡与连环追问

### 5.7.1 速记卡

```
【ESM vs CJS】
  依赖确定   编译时（静态）        运行时（require 是函数）
  导出        值的引用（活绑定）     值的拷贝
  加载        异步                同步
  顶层 this   undefined           module.exports
  严格模式    默认开启             默认关闭
  tree-shaking ✅（需 sideEffects/纯函数）  ❌
  import 位置 必须顶层             任意位置
  缓存        按 URL               按路径（require.cache）
  循环依赖    TDZ 报错（函数可用）   拿到半成品 exports
  扩展名      必须写               可省略

【ESM 三阶段】Construction → Instantiation（建绑定）→ Evaluation（求值）
             函数声明在实例化阶段就可用 → 能扛循环依赖

【Node 互操作】
  ESM 没有 __dirname/__filename/require
  → fileURLToPath(import.meta.url)
  CJS 加载 ESM → await import()
  ESM 加载 CJS → import pkg from 'cjs'（默认导出 = module.exports）
  ESM 相对路径必须带扩展名

【HMR】
  流程：watch → 增量编译 → WebSocket → 拉 manifest → 拉 chunk
        → 替换 module cache → 冒泡找 accept 边界 → 找不到则 full reload
  边界：module.hot.accept(dep, cb) / import.meta.hot.accept
  清理：module.hot.dispose（清定时器/监听器）
  Vue：模板变更 rerender（保状态）/ script 变更 reload（重建）
  React：Fast Refresh 保 useState
  Vite：不打包 + 原生 ESM + ?t= 绕缓存 → 按需请求
```

### 5.7.2 连环追问

| # | 追问 | 关键答点 |
|---|---|---|
| 1 | ESM 和 CJS 最根本区别？ | 静态 vs 运行时 |
| 2 | 为什么 ESM 能 tree-shaking？ | 依赖图静态可分析，且模块无副作用（`sideEffects` / 纯函数标注） |
| 3 | 活绑定是什么？ | 导入的是引用，值会同步变化 |
| 4 | 导入的变量能改吗？ | 不能，只读绑定 |
| 5 | ESM 异步还是同步？ | 异步 |
| 6 | ESM 顶层 `this`？ | `undefined` |
| 7 | CJS 顶层 `this`？ | `module.exports` |
| 8 | 循环依赖谁安全？ | ESM（TDZ 报错早），CJS 静默 `undefined` |
| 9 | ESM 三阶段？ | 构造、实例化、求值 |
| 10 | 为什么函数声明能扛循环依赖？ | 实例化阶段就初始化了 |
| 11 | `import` 为什么不能放 `if` 里？ | 静态结构要求 |
| 12 | 动态导入怎么做？ | `await import()` |
| 13 | ESM 里的 `__dirname`？ | `fileURLToPath(import.meta.url)` |
| 14 | ESM 必须写扩展名吗？ | 必须（相对路径） |
| 15 | CJS 在 ESM 里怎么用？ | `createRequire` 或 `import()` |
| 16 | `exports` 和 `module.exports`？ | 初始同对象；重新赋值后者会让前者失效 |
| 17 | 怎么检测循环依赖？ | ESLint `import/no-cycle` |
| 18 | HMR 是什么？ | 模块热替换，不刷页面 |
| 19 | HMR 是 ES6 能力吗？ | 不是，是构建工具 |
| 20 | HMR 完整流程？ | watch → 编译 → WS → 拉取 → 替换 → 冒泡 |
| 21 | HMR 边界是什么？ | `accept` 声明，能处理依赖变化 |
| 22 | 找不到边界？ | full reload |
| 23 | `dispose` 干什么？ | 清理副作用防叠加 |
| 24 | Vue HMR 两种模式？ | `rerender`（保状态）/ `reload`（重建） |
| 25 | React Fast Refresh 原理？ | Babel 签名 + 保留 `useState` |
| 26 | Vite 为什么快？ | 不打包 + 原生 ESM + 按需 |
| 27 | Vite 的 `?t=` 干什么？ | 绕 ESM 模块缓存 |
| 28 | CSS HMR 为什么最快？ | 只换 `<style>` 内容 |
| 29 | HMR 什么时候丢状态？ | 逻辑变更（Hooks 顺序、script 区块） |
| 30 | 生产环境有 HMR 吗？ | 没有 |
