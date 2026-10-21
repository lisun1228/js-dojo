# 分册 05 · 模块与工程化：ESM vs CommonJS、HMR

> 覆盖题号：**6**（ES6 模块与 CommonJS 的差异）、**2**（ES6 怎么热更新的）
> 只有 **2 题**，但第 6 题是「模块化」类追问的入口，第 2 题严格说不属于 ES6（属于构建工具）

---

## 目录

- [5.0 先纠正一个前提](#50-先纠正一个前提)
- [5.1 ES Module 与 CommonJS 的六个差异（题 6）](#51-es-module-与-commonjs-的六个差异题-6)
- [5.2 深入：ESM 的三个加载阶段](#52-深入esm-的三个加载阶段)
- [5.3 循环依赖：两种模块系统的表现差异](#53-循环依赖两种模块系统的表现差异)
- [5.4 互操作：Node 里怎么混用（实战必踩）](#54-互操作node-里怎么混用实战必踩)
- [5.5 HMR 是什么、怎么工作（题 2）](#55-hmr-是什么怎么工作题-2)
- [5.6 本册答题模板汇总](#56-本册答题模板汇总)
- [5.7 速记卡与连环追问](#57-速记卡与连环追问)

---

## 5.0 先纠正一个前提

### 5.0.1 第 2 题不是 ES6 的题

题单里第 2 题是「ES6 怎么热更新的」，但 **HMR（Hot Module Replacement）和 ES6 规范没有任何关系**——它是 **Webpack / Vite 这类构建工具**的能力，出现时间也远晚于 ES6（Webpack HMR 在 2014 年左右，Vite 在 2020 年）。

题库作者大概率是把「**模块化 → 模块热替换**」这条线串在一起了。

**面试时怎么说**：

> "HMR 严格来说不是 ES6 的能力，是构建工具基于模块系统实现的。不过既然放在一起问，我从『模块化之后为什么能热替换』这个角度答。"

这句话本身就是加分项——**说明你知道知识边界在哪**。

### 5.0.2 第 6 题的参考答案太薄

题单给的答案只有三行（静态分析、异步、tree-shaking、拷贝值），实际上这题能问到很深：

- **活绑定（live binding）** 到底是什么意思
- ESM 的**三个加载阶段**
- 为什么 **`import` 必须写在顶层**
- 循环依赖为什么两种系统表现不同
- Node 里怎么混用

下面逐层展开。

---

## 5.1 ES Module 与 CommonJS 的六个差异（题 6）

### 5.1.0 一句话结论

> **ESM 是"编译时静态"的模块系统**：依赖关系在**代码解析阶段**就确定了，导入的是**值的引用（活绑定）**，加载是**异步**的，所以能被 tree-shaking。
> **CommonJS 是"运行时动态"的模块系统**：`require` 是一个**普通函数调用**，什么时候执行、执行几次都由运行时决定，导入的是**值的拷贝**，加载是**同步**的。

### 5.1.1 六维对照表

| 维度 | ES Module | CommonJS |
|---|---|---|
| **依赖确定时机** | **编译时**（静态解析） | **运行时**（执行到 `require` 才知道） |
| **导出/导入的本质** | **值的引用**（live binding） | **值的拷贝** |
| **加载方式** | **异步**（先 fetch 再执行） | **同步**（阻塞式） |
| **顶层 `this`** | `undefined` | `module.exports` |
| **严格模式** | 默认严格模式 | 默认非严格模式 |
| **能否 tree-shaking** | ✅ 能 | ❌ 不能（多数情况） |
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

**这个差异直接决定了 tree-shaking 的可行性**：

```
ESM：打包工具在解析阶段就能构建完整的依赖图
     → 知道哪些 export 被用到 → 没用的可以摇掉

CJS：require 可能在 if 里、可能在函数里、路径可能是变量
     → 打包工具无法静态确定 → 只能保守地把整个模块打进去
```

> **这就是为什么很多库提供 `module` 字段（ESM 版本）给打包工具，`main` 字段（CJS 版本）给 Node**：
> ```json
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

**这是最容易被问倒的一条**，必须能举出具体例子。

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

```js
// ESM：加载是异步的（浏览器里要先 fetch 文件）
<script type="module" src="./main.js"></script>
// 等价于 defer，不会阻塞 HTML 解析

// CJS：加载是同步的（require 会阻塞，直到文件读完并执行完）
const a = require('./a');   // 阻塞在这里
console.log('after');       // 一定在 a 执行完之后
```

**这个差异的根源是使用场景**：

| | 浏览器 | Node |
|---|---|---|
| 网络请求 | 天然异步（必须异步，否则卡 UI） | 本地文件（可以同步） |
| ESM | 异步加载 | 异步（但也可以同步处理本地文件） |
| CJS | 不支持 | 同步加载（启动时一次性加载完） |

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
// CJS 里很常见的写法，在 ESM 里会报错
this.something = 1;   // ❌ ESM 里 this 是 undefined

// jQuery 插件那种 (function($){...})(this) 在 ESM 里也失效
```

### 5.1.6 差异五：循环依赖的表现

```js
// ===== CJS =====
// a.js
console.log('a 开始');
exports.done = false;
const b = require('./b');       // ← 这里会去执行 b.js
console.log('a 里 b.done =', b.done);
exports.done = true;
console.log('a 结束');

// b.js
console.log('b 开始');
const a = require('./a');       // ← a 还没执行完，拿到的是"不完整的 exports"
console.log('b 里 a.done =', a.done);   // undefined（此时 a.done 还没赋值）
exports.done = false;
console.log('b 结束');

// main.js
require('./a');

// 输出：
// a 开始
// b 开始
// b 里 a.done = false     ← 注意：拿到的是 false（因为 exports.done=false 已经执行了）
// b 结束
// a 里 b.done = false
// a 结束
```

> 关键：CJS 返回的是「**当前已经执行到的那部分 exports**」，所以可能拿到"半成品"。

```js
// ===== ESM =====
// a.js
import { b } from './b.js';
export const a = 'a';

// b.js
import { a } from './a.js';
export const b = a + '!';     // ❌ ReferenceError: Cannot access 'a' before initialization

// 但如果 a 是函数声明，就没问题（函数声明会提升并初始化）
// a.js
import { b } from './b.js';
export function a() { return 'a'; }
```

**为什么 ESM 会报 TDZ 而不是拿到 `undefined`？**

因为 ESM 的绑定在**实例化阶段**就创建好了（但未初始化），所以 `b.js` 里访问 `a` 时，绑定**存在**但处于 TDZ → 报 `ReferenceError`。这比 CJS 的"静默拿到 undefined"更安全，因为错误暴露得更早。

| | CJS | ESM |
|---|---|---|
| 循环依赖时 | 拿到未完成的 `exports`（可能 `undefined`） | 绑定存在但 TDZ → `ReferenceError` |
| 函数声明 | 需要 `exports.fn = ...`（执行到才有） | **函数声明提升，可用** |
| 调试难度 | 高（静默 undefined） | 低（直接报错） |

### 5.1.7 差异六：缓存机制

```js
// ESM：按 URL 缓存，同一个 URL 只求值一次
import './a.js';
import './a.js?foo';    // ← 不同 URL，会再执行一次（这是 Vite HMR 的原理）

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
| 动态导入 | `await import('./x')` | `require('./x')` |
| 再导出 | `export { a } from './x'` / `export * from './x'` | `module.exports = require('./x')` |

### 5.1.9 答题模板

**30 秒版：**

> "最根本的区别是**静态还是动态**。ESM 的 `import` 必须在顶层，依赖关系在**编译阶段**就确定了，所以打包工具能做 tree-shaking；CJS 的 `require` 是普通函数调用，可以放在 `if` 里、路径可以是变量，只能运行时确定。
> 这个差异还带来两点：ESM 导出的是**值的引用（活绑定）**，导出方改变量，导入方能"看到"变化；CJS 是**值的拷贝**，导出后就脱钩了。
> 另外 ESM 是异步加载、顶层 `this` 是 `undefined`、默认严格模式；CJS 是同步加载、顶层 `this` 是 `module.exports`。"

**2 分钟版补充：**

> "再补两个实战点：
> 一是**循环依赖的表现不同**。CJS 会拿到"执行到一半的 exports"，所以可能静默拿到 `undefined`；ESM 因为绑定在实例化阶段就创建了，会直接报 TDZ 的 `ReferenceError`，错误暴露更早。
> 二是 **Node 里的互操作**。ESM 里没有 `require`、`__dirname`、`__filename`，要用 `import.meta.url` 配合 `fileURLToPath` 换算；反过来 CJS 里不能静态 `import`，但可以 `await import()` 动态导入。"

### 5.1.10 追问表

| 追问 | 答题要点 |
|---|---|
| 最根本的区别？ | 静态（编译时）vs 动态（运行时） |
| 为什么 ESM 能 tree-shaking？ | 依赖图静态可分析，未使用的 export 能安全移除 |
| 活绑定是什么意思？ | 导入的是对导出变量的引用，值会同步变化 |
| 导入的变量能赋值吗？ | 不能，`TypeError`（只读绑定） |
| ESM 是同步还是异步？ | 异步（浏览器要先 fetch） |
| ESM 顶层 `this`？ | `undefined` |
| CJS 顶层 `this`？ | `module.exports` |
| 循环依赖谁更安全？ | ESM（报错早），CJS 会静默 `undefined` |
| ESM 里能用 `require` 吗？ | 不能（Node 22+ 支持 `require(esm)`，但方向相反） |
| ESM 里怎么拿 `__dirname`？ | `path.dirname(fileURLToPath(import.meta.url))` |
| `import()` 和 `import` 区别？ | 前者运行时、返回 Promise、可动态路径；后者静态、顶层 |
| 为什么 `import` 不能写在 `if` 里？ | 静态结构要求，否则无法在编译期建依赖图 |
| ESM 能条件加载吗？ | 顶层不能，要用 `import()` |
| CJS 能 tree-shaking 吗？ | 基本不能，除非工具做静态分析的"猜测" |
| `exports` 和 `module.exports` 区别？ | 初始指向同一对象；重新赋值 `module.exports` 会让 `exports` 失效 |

---

## 5.2 深入：ESM 的三个加载阶段

> 面试官如果追问"ESM 到底怎么加载的"，答这个能明显拉开差距。

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

```js
// main.js
import { fn } from './module.js';

console.log(fn());   // ✅ 能调用！尽管 module.js 还没求值
```

```js
// module.js
console.log('module 求值');     // 这行在 main.js 的 console.log 之后才执行
export function fn() { return 'ok'; }
```

**输出**：

```
ok
module 求值
```

**为什么？** 因为 `fn` 是**函数声明**，在**实例化阶段**就已经初始化好了，所以 `main.js` 求值时能直接调用它。而 `module.js` 的模块体（`console.log`）要等到求值阶段才执行。

> **这个例子非常能说明问题**：如果你只看"加载 → 执行"两阶段模型，会以为 `module.js` 一定先执行完，那就无法解释这个输出。

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

**关键**：④ 时 `a.js` 只执行到 ②，`exports.loaded` 还是 `false`（① 已执行，③ 未执行）。所以拿到的是"快照"。

**如果 `a.js` 里 `exports.loaded = true` 在 `require` 之前呢？**

```js
// a.js
exports.loaded = true;
const b = require('./b');   // b 里会看到 true
```

### 5.3.2 ESM 的循环依赖：TDZ 报错

```js
// a.js
import { b } from './b.js';
export const a = 'a';
console.log('a 求值，b =', b);   // ❌ ReferenceError（b 还没初始化）
```

```js
// b.js
import { a } from './a.js';
export const b = a + '!';        // ❌ ReferenceError（a 在 TDZ）
```

**但如果用函数，就能工作**：

```js
// a.js
import { getB } from './b.js';
export function getA() { return 'a'; }
console.log('a 求值，getB() =', getB());   // ✅ 'b'（函数已提升）

// b.js
import { getA } from './a.js';
export function getB() { return 'b'; }
```

**这也是为什么很多库的入口用函数导出而不是常量**——函数声明在实例化阶段就可用，能扛住循环依赖。

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

### 5.4.1 启用 ESM 的三种方式

```json
// package.json
{ "type": "module" }     // 整个包默认 ESM
```

```bash
# 或者用扩展名
.mjs   # 强制 ESM
.cjs   # 强制 CJS
```

### 5.4.2 ESM 里拿 CJS 的"缺失变量"

```js
// ❌ ESM 里这些都不可用
console.log(__dirname);   // ReferenceError
console.log(__filename);  // ReferenceError
console.log(require);     // ReferenceError

// ✅ 用 import.meta 换算
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

**`import.meta` 还能干什么？**

```js
console.log(import.meta.url);      // file:///path/to/module.js
console.log(import.meta.env);      // Vite 注入的环境变量
console.log(import.meta.hot);      // Vite 的 HMR API
console.log(import.meta.resolve('./x.js'));  // 解析路径
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

> **新变化**：Node 22.12+ 支持在 CJS 里 `require()` 一个 ESM 模块（前提是那个模块没有顶层 `await`）。但为了兼容性，生产代码还是建议用 `await import()`。

### 5.4.4 ESM 里加载 CJS

```js
// ✅ 可以，Node 会把 CJS 的 module.exports 当作默认导出
import pkg from 'lodash';           // 默认导入 = module.exports
import { debounce } from 'lodash';  // ⚠️ 命名导入可能不工作（取决于静态分析）

// 更稳的写法
import lodash from 'lodash';
const { debounce } = lodash;
```

**为什么命名导入可能失效？** 因为 Node 对 CJS 模块做**静态分析**（`cjs-module-lexer`）来推断有哪些命名导出，如果 `module.exports` 是动态构建的（比如 `module.exports = {...}` 里混了计算属性），就推断不出来。

### 5.4.5 常见报错对照表

| 报错 | 原因 | 解法 |
|---|---|---|
| `Cannot use import statement outside a module` | CJS 环境里写了 `import` | 加 `"type": "module"` 或改 `.mjs` |
| `require is not defined in ES module scope` | ESM 里用了 `require` | 改 `import`，或 `createRequire` |
| `__dirname is not defined` | ESM 没有 `__dirname` | `fileURLToPath(import.meta.url)` |
| `ERR_REQUIRE_ESM` | CJS `require` 了纯 ESM 包 | 用 `await import()` 或降级包版本 |
| `The requested module does not provide an export named 'x'` | 包的 CJS 版本没有该命名导出 | 默认导入再解构 |
| `ERR_MODULE_NOT_FOUND` | ESM **必须写扩展名** | 补 `.js`（浏览器和 Node ESM 都要求） |

> **最容易踩的一条**：**ESM 里 import 相对路径必须带扩展名**。`import './utils'` 在 CJS 里可以，在 ESM 里不行。

---

## 5.5 HMR 是什么、怎么工作（题 2）

### 5.5.0 一句话结论

> HMR（Hot Module Replacement，模块热替换）是**构建工具**的能力：文件改动后，**只替换被改动的那一个（或几个）模块**，不刷新页面，因此**应用状态得以保留**。流程是「**watch 文件 → 增量编译 → WebSocket 通知 → 拉取新模块 → 替换模块缓存 → 向上冒泡找 accept 边界**」。它和 ES6 规范无关，是模块化之后才可能实现的能力。

### 5.5.1 先分清三个概念

| 名称 | 行为 | 状态是否保留 |
|---|---|---|
| **Live Reload**（热重载） | 文件变了 → **刷新整个页面** | ❌ 全部丢失 |
| **HMR**（热替换） | 文件变了 → **只替换模块** | ✅ 保留（大多数情况） |
| **Hot Reloading**（React 社区叫法） | 通常是 HMR 的一种实现（Fast Refresh） | ✅ 保留组件 state |

**为什么需要 HMR？**

```
改一行 CSS → 等 3 秒页面刷新 → 重新登录 → 重新点开三层菜单 → 重新填表单
                ↑ 这个循环一天重复几百次，就是 HMR 要消灭的东西
```

**核心价值**：**保留应用状态**。调试一个深层页面的弹窗时，刷新意味着重新走一遍路径。

### 5.5.2 Webpack HMR 的完整流程（7 步）

```
① 启动 watch
   webpack-dev-server 启动，webpack 用 watch 模式监听文件系统

② 增量编译
   文件变化 → 只重新编译受影响的模块 → 生成新的 chunk 文件
   同时生成一个 manifest（描述"哪些 chunk 变了"）

③ 通过 WebSocket 推送通知
   服务端 → 浏览器：{ type: 'hash', data: 'abc123' }
                    { type: 'ok' }

④ 浏览器拉取 manifest
   HMR runtime 请求 `abc123.hot-update.json`
   → { "h": "abc123", "c": { "main": true } }   ← 告诉它 main chunk 需要更新

⑤ 拉取新模块代码
   请求 `main.abc123.hot-update.js`
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
// 一个模块可以声明"我能接受哪些依赖的变化"
if (import.meta.hot) {          // Vite
  import.meta.hot.accept('./dep.js', (newDep) => {
    // dep.js 变了，我自己处理，不用往上冒泡
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

  // 也可以声明"我自己能被替换"
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

- `style-loader` 的 HMR 是**最完美的**：直接替换 `<style>` 标签内容，连 DOM 都不用重建

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
④ 浏览器执行 import(`/src/App.vue?t=1699999999`)
   ↑ 加时间戳 query 绕过浏览器 HTTP 缓存和 ESM 模块缓存
⑤ 新模块替换旧模块，执行 accept 回调
```

**为什么加 `?t=` 参数？**

因为 **ESM 的模块是浏览器原生缓存的，而且无法"删除"某个模块的缓存**。加不同的 query 会创建一个**新的模块实例**，这是绕过 ESM 缓存的唯一办法。

**速度差异的量化**：

| | Webpack | Vite |
|---|---|---|
| 冷启动 | 要打包整个应用（大项目几十秒） | 不打包，秒开 |
| HMR 更新 | 增量打包相关 chunk（百毫秒级） | 只重请求单个文件（毫秒级） |
| 项目越大 | 越慢（打包范围可能扩大） | 基本不变 |

### 5.5.5 HMR 失效的四个原因（实战排查）

| 现象 | 原因 | 解决 |
|---|---|---|
| 改代码后整页刷新 | 没找到 accept 边界（模块没接入 HMR） | 在入口加 `module.hot.accept()`，或用框架的 loader |
| 状态还是丢了 | 改的是 `<script>` 部分（Vue）或 Hooks 逻辑（React） | 正常行为，逻辑变了只能重建 |
| HMR 后行为诡异（事件叠加） | 旧模块副作用没清理 | 用 `dispose` 清定时器/监听器 |
| 改了没反应 | 文件没在 watch 范围 / 路径大小写不一致 / 缓存 | 检查 `watchOptions`，重启 dev server |

### 5.5.6 答题模板

**30 秒版：**

> "HMR 是模块热替换，文件改动后**只替换改动的那几个模块，不刷新页面**，所以能保留应用状态。
> 流程是：构建工具 watch 文件 → 增量编译 → 通过 WebSocket 通知浏览器 → 浏览器拉取更新的模块 → 替换模块缓存 → 从改动模块**向上冒泡**，找到声明了 `accept` 的边界就执行回调，找不到就退化成整页刷新。
> 严格说它不是 ES6 的能力，是 Webpack/Vite 这类工具基于模块系统实现的。"

**2 分钟版补充：**

> "两个能体现深度的点：
> 一是 **HMR 边界**。模块可以声明 `accept` 表示"我能处理某个依赖的变化"，这样变化不会继续往上冒泡。框架的 loader 会帮你自动加，比如 Vue 的模板改动走 `rerender` 保留状态，`<script>` 改动走 `reload` 重建组件。
> 二是 **Vite 为什么快**。它开发时不打包，基于原生 ESM，文件变了只让相关模块失效，浏览器重新请求那个文件就行。有个细节是必须加 `?t=时间戳` 这样的 query，因为 ESM 模块缓存没法删除，只能靠不同 URL 创建新实例。"

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

### 5.6.2 把两题串起来（面试收尾用）

> "这两题其实有因果关系：**ESM 的静态结构让"模块"成了构建工具可以精确操作的单元**，HMR 才有可能只替换一个模块。
> CJS 的 `require` 是运行时行为，打包工具没法精确知道"谁依赖谁"，HMR 的边界就没法算——所以早期 Webpack 的 HMR 在 CJS 下经常"冒泡到入口"，退化成整页刷新。
>
> 一句话：**ESM 给了"模块"这个概念以静态边界，HMR 是在这个边界上做的增量替换。**"

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
  tree-shaking ✅                 ❌
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
  Vite：不打包 + 原生 ESM + ?t= 绕缓存 → 毫秒级
```

### 5.7.2 连环追问

| # | 追问 | 关键答点 |
|---|---|---|
| 1 | ESM 和 CJS 最根本区别？ | 静态 vs 运行时 |
| 2 | 为什么 ESM 能 tree-shaking？ | 依赖图静态可分析 |
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
