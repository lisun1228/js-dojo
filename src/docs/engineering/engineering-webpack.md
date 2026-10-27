# 工程化 02｜Webpack 原理与插件开发

> 覆盖：Webpack 打包原理、loader 与 plugin 的区别、Tapable、手写 loader、手写 plugin —— **5 个考点**

---

## 目录

- [2.0 先说题单的问题](#20-先说题单的问题)
- [2.1 Webpack 打包原理](#21-webpack-打包原理)
- [2.2 loader 和 plugin 的区别](#22-loader-和-plugin-的区别)
- [2.3 Tapable：webpack 的插件系统内核](#23-tapablewebpack-的插件系统内核)
- [2.4 手写一个 loader](#24-手写一个-loader)
- [2.5 手写一个 plugin](#25-手写一个-plugin)
- [2.6 本册追问总表](#26-本册追问总表)
- [2.7 速记卡](#27-速记卡)
- [2.8 自测](#28-自测)

---

## 2.0 先说题单的问题

本册两题都落在构建流程上：

- **Webpack 打包原理**：从 entry 构建依赖图，把模块包成函数，生成自带 `require` 的运行时。
- **loader 和 plugin 的区别**：loader 转换单文件内容，plugin 介入构建流程。

后三节（Tapable、loader、plugin）是这两题的下钻。

---

## 2.1 Webpack 打包原理

### 一句话结论

> Webpack 做三件事：**从入口出发递归构建依赖图 → 把每个模块包成函数 → 生成一个能自己实现 `require` 的运行时**。

### 四个核心概念

| 概念 | 是什么 | 数量关系 |
|---|---|---|
| **Module** | 一个源文件（`.js`、`.css`、图片……） | 最多 |
| **Chunk** | 一组 Module 的集合，是**代码分割的单位** | 中 |
| **Bundle** | 一个 Chunk 生成出的**产物文件** | 少 |
| **Asset** | 最终写入磁盘的文件（含 sourcemap、manifest） | 可能比 bundle 多 |

**关系**：`Module → (分组) → Chunk → (生成) → Bundle → (写盘) → Asset`

> **Chunk 是逻辑概念，Bundle 是物理文件。** 一个 entry 对应一个初始 chunk，配置 `splitChunks` 后会额外拆出 vendor chunk，`import()` 会生成异步 chunk；每个 chunk 默认产出一个 bundle 文件，开启 sourcemap 后还会多出 `.map`。

### 完整流程（四阶段）

```
① 初始化
   ├─ 合并命令行参数 + webpack.config.js + 默认配置 → 最终 options
   ├─ new Compiler(options)         ← 全局唯一，代表一次构建的生命周期
   └─ 加载所有 plugin，调用 plugin.apply(compiler)

② 编译（Make）
   ├─ 创建 Compilation              ← 每次构建一个，代表一次编译过程
   ├─ 从 entry 开始，调用 NormalModuleFactory 创建 Module
   ├─ 对每个 Module：
   │    ├─ resolve：找到文件真实路径（enhanced-resolve）
   │    ├─ load：读文件内容
   │    ├─ transform：按 rules 的 loader 链从右往左执行
   │    └─ parse：acorn 解析成 AST，找出所有 import/require
   └─ 对每个依赖重复上述过程 → 递归形成「依赖图」

③ 优化（Optimize / Seal）
   ├─ tree shaking（标记 used exports，production 下由 Terser 删除）
   ├─ splitChunks（拆公共包）
   ├─ scope hoisting（模块拼接）
   └─ 生成 Chunk

④ 生成（Emit）
   ├─ 用 webpack-sources 把 Chunk 转成源码字符串
   ├─ 按 chunk 类型走 renderManifest，由 JavascriptModulesPlugin 生成模块代码
   └─ 写入 output.path
```

流程中的关键钩子（plugin 会用到）：

```
initialize → beforeCompile → thisCompilation → make → processAssets → emit → done
```

### 产物结构

源码（`src/index.js`）：

```js
import { add } from './math.js';
import { greet } from './string.js';
console.log(add(1, 2));
console.log(greet('world'));
```

`dist/bundle.js`（webpack 5，development，关闭压缩）：

```js
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/math.js":
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);          // ← 标记为 ES Module
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   add: () => (/* binding */ add),   // ← 定义 getter
/* harmony export */   square: () => (/* binding */ square),
/* harmony export */   unusedFn: () => (/* binding */ unusedFn)
/* harmony export */ });
function add(a, b) { return a + b; }
function unusedFn() { return 'I am never called'; }
function square(x) { return x * x; }

/***/ }),

/***/ "./src/string.js":
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
__webpack_require__.d(__webpack_exports__, {
  greet: () => (/* binding */ greet),
  unusedGreet: () => (/* binding */ unusedGreet)
});
function greet(name) { return `hi ${name}`; }
function unusedGreet() { return 'never used'; }

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	const __webpack_module_cache__ = {};
/******/
/******/ 	function __webpack_require__(moduleId) {
/******/ 		const cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;             // ← 缓存命中直接返回
/******/ 		}
/******/ 		const module = __webpack_module_cache__[moduleId] = { exports: {} };
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 		return module.exports;
/******/ 	}
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	__webpack_require__.d = (exports, definition) => {
/******/ 		for(var key in definition) {
/******/ 			if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 				Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 			}
/******/ 		}
/******/ 	};
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop));
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	__webpack_require__.r = (exports) => {
/******/ 		Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};

let __webpack_exports__ = {};
(() => {
/* harmony import */ var _math_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("./src/math.js");
/* harmony import */ var _string_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("./src/string.js");

console.log((0, _math_js__WEBPACK_IMPORTED_MODULE_0__.add)(1, 2));
console.log((0, _string_js__WEBPACK_IMPORTED_MODULE_1__.greet)('world'));
})();
/******/ })();
```

### 五个必须看懂的细节

#### ① `__webpack_modules__` 是一个「模块路径 → 函数」的对象

每个模块被包成一个函数，参数固定三个：

```js
(module, __webpack_exports__, __webpack_require__) => { ... }
```

**这就是「模块作用域隔离」的实现方式**——每个源文件的内容被放进一个函数体里，所以不同文件里的同名变量不会冲突。产物里每个模块都有一层 `function(module, __webpack_exports__, __webpack_require__)` 外壳。

#### ② `__webpack_module_cache__` 是「模块单例」的来源

```js
if (cachedModule !== undefined) return cachedModule.exports;
```

同一个模块被多处 import，**只会执行一次**，后续都从缓存拿。这就是为什么模块顶层的 `console.log` 只打印一次。

#### ③ `__webpack_require__.d` 用 getter 而不是直接赋值

```js
Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
```

因为 ESM 的导出是**活绑定（live binding）**：

```js
// counter.js
export let count = 0;
export function inc() { count++; }

// main.js
import { count, inc } from './counter.js';
inc();
console.log(count);   // 1 ← 拿到的是最新值
```

如果 webpack 直接 `exports.count = count`（赋值），那拷贝的是 0，`inc()` 之后 `console.log` 还是 0。**用 getter 每次读取都取当前值，才符合 ESM 语义。**

#### ④ `(0, _math_js__.add)(1, 2)` 这个写法

为什么不直接 `_math_js__.add(1, 2)`？

因为 `obj.method()` 会让 `this` 指向 `obj`。如果被调用的函数内部用到了 `this`，行为就不对了。`(0, fn)` 这个逗号表达式**返回函数本身**，等于把 `this` 断成 `undefined`/`globalThis`，符合 ESM 里「导出的函数不该有 this 归属」的语义；这正是「`(0, obj.fn)()` 会丢 `this`」的规则在产物里的用法。

#### ⑤ `__webpack_require__.r` 标记 ESM

```js
Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
Object.defineProperty(exports, '__esModule', { value: true });
```

`__esModule: true` 是**给 Babel/TS 的 interop 用的**：`import x from 'cjs-module'` 时，编译器看到 `__esModule` 就知道「这是 ESM，`default` 在 `.default` 上」，否则会把整个 `module.exports` 当 `default`。

### 手写一个 mini bundler

```js
const fs = require('fs');
const path = require('path');

// ① 解析单个模块：import → __REQ__，export → __exports.x
function parseModule(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  const dir = path.dirname(filePath);
  const deps = [];

  code = code.replace(
    /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g,
    (_, names, spec) => {
      const abs = path.resolve(dir, spec);
      deps.push(abs);
      return `const {${names}} = __REQ__("${abs}");`;   // ← 先写路径，id 稍后定
    }
  );

  const exported = [];
  code = code.replace(/export\s+(function|const|let|class)\s+(\w+)/g, (_, kind, name) => {
    exported.push(name);
    return `${kind} ${name}`;
  });
  if (exported.length) code += '\n' + exported.map(n => `__exports.${n} = ${n};`).join('\n');

  return { filePath, deps, code, exported, id: -1 };
}

// ② 建图：深度优先，边收边分配全局 id
function buildGraph(entry) {
  const byPath = new Map();
  const list = [];
  (function walk(file) {
    if (byPath.has(file)) return;        // 已处理（同时挡住循环依赖）
    const mod = parseModule(file);
    mod.id = list.length;                // ★ 全局 id
    byPath.set(file, mod);
    list.push(mod);
    for (const dep of mod.deps) walk(dep);
  })(path.resolve(entry));
  return { byPath, list };
}

// ③ 生成：把 __REQ__(路径) 换成 __require(全局id)
function generate(byPath, list) {
  const body = list.map(mod => {
    const code = mod.code.replace(/__REQ__\("([^"]+)"\)/g, (_, abs) => {
      return `__require(${byPath.get(abs).id})`;
    });
    return `    ${mod.id}: function (__exports, __require) {\n${code}\n    }`;
  }).join(',\n');

  return `(function () {
  "use strict";
  const __modules = {
${body}
  };
  const __cache = {};
  function __require(id) {
    if (__cache[id]) return __cache[id];
    const module = (__cache[id] = { exports: {} });
    __modules[id](module.exports, __require);
    return module.exports;
  }
  __require(${list[0].id});
})();`;
}
```

#### 依赖图

```
#0 src/index.js    依赖: math.js → #1, string.js → #2   导出: []
#1 src/math.js     依赖: 无                              导出: [add]
#2 src/string.js   依赖: upper.js → #3                   导出: [greet]
#3 src/upper.js    依赖: 无                              导出: [upper]
```

#### 生成的 bundle（整理后）

```js
(function () {
  "use strict";
  const __modules = {
    /* src/index.js */
    0: function (__exports, __require) {
      const { add } = __require(1);
      const { greet } = __require(2);
      console.log(add(1, 2));
      console.log(greet('world'));
    },
    /* src/math.js */
    1: function (__exports, __require) {
      function add(a, b) { return a + b; }
      __exports.add = add;
    },
    /* src/string.js */
    2: function (__exports, __require) {
      const { upper } = __require(3);
      function greet(name) { return 'hi ' + upper(name); }
      __exports.greet = greet;
    },
    /* src/upper.js */
    3: function (__exports, __require) {
      function upper(s) { return s.toUpperCase(); }
      __exports.upper = upper;
    }
  };
  const __cache = {};
  function __require(id) {
    if (__cache[id]) return __cache[id];
    const module = (__cache[id] = { exports: {} });
    __modules[id](module.exports, __require);
    return module.exports;
  }
  __require(0);
})();
```

#### 预期输出

```
3
hi WORLD
```

核心就是「模块表 + 缓存 + `require` 运行时」，与 webpack 产物结构一致。

### 全局 id 与占位符

一个常见错误是把模块内依赖下标当成全局 id：

```js
code = code.replace(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g,
  (_, names, spec) => {
    const id = deps.length;        // ← 错！这是「模块内局部下标」
    deps.push(path.resolve(dir, spec));
    return `const {${names}} = __require(${id});`;
  });
```

生成的产物会报错：

```
TypeError: add is not a function
```

**根因**：`deps.length` 是**当前模块内的第几个依赖**（0、1、2……），不是全局模块 id。

- `index.js` 里 `math.js` 是第 0 个依赖 → 生成 `__require(0)`
- 但 `#0` 是 `index.js` 自己！
- 于是 `index.js` require 了自己，`add` 不是函数

**修法**：先写占位符 `__REQ__("绝对路径")`，**等所有模块都编完号，再统一替换成真实 id**。

这也是 webpack 分「解析」和「生成」两个阶段的原因：解析阶段拿不到全局 id，只有收集完所有模块才能编号。所以中间产物（这里的 `__REQ__` 占位符，webpack 里是 `dependency` 对象）必须先存在，到生成阶段再定 id。

### 追问链：打包原理

| 追问 | 答法 |
|---|---|
| webpack 的入口文件是整个构建的起点吗？ | 是。所有模块都是**从 entry 可达的**。不可达的模块根本不会被打包（这是 tree shaking 的基础：连图都进不去） |
| 为什么模块要包成函数？ | ① 隔离作用域（避免同名冲突）；② 能注入 `module`/`exports`/`__webpack_require__`；③ 支持循环依赖（函数先定义，执行时机可控） |
| 循环依赖 webpack 怎么处理？ | 会有「部分导出」现象。A import B，B import A：B 先执行时 A 还没执行完，拿到的是 A 的**不完整 exports**。所以循环依赖里不要用顶层变量 |
| `__webpack_require__.d` 为什么用 getter？ | ESM 的导出是**活绑定**。用 getter 才能保证 `import` 到的值随源模块变化 |
| `(0, fn)()` 是什么？ | 逗号表达式返回函数本身，断开 `this`。webpack 用它是为了符合 ESM 语义 |
| webpack 5 的持久化缓存在哪一层？ | 在「编译」阶段。`cache: { type: 'filesystem' }` 把模块的 transform 结果存到 `node_modules/.cache/webpack`，二次构建跳过 loader |
| 为什么 webpack 冷启动慢？ | 因为**必须先完整构建依赖图才能返回第一个结果**。几千个模块要全部 resolve + transform + parse 完，才能开始生成 |
| 打包原理和 Vite 的差别在哪？ | webpack 是「先打包再服务」，Vite 开发时是「浏览器要什么就给什么，按需编译」。**这是两者速度差的根源** |

---

## 2.2 loader 和 plugin 的区别

### 一句话结论：loader 与 plugin

> **loader 是「翻译官」，只处理单个文件的源码转换；plugin 是「监工」，能介入构建的任意阶段。**

### 五个维度对比

| 维度 | loader | plugin |
|---|---|---|
| **作用对象** | **单个文件**的源码 | **整个构建流程** |
| **工作时机** | 模块构建时，loader runner 执行 loader 链 | 任意钩子（initialize 到 done） |
| **形态与配置** | 函数 `(source) => newSource`，写在 `module.rules` | 类/对象，`apply(compiler)`，写在 `plugins` |
| **能做什么** | 只能改**文本/二进制内容** | 能改配置、改模块、改 chunk、生成文件、读写磁盘 |
| **不能做什么** | 不能新增/删除模块，不能改构建流程 | 几乎没有限制，但比 loader 重 |

loader 无状态：只拿到单个文件内容；plugin 拿到 `compiler`/`compilation`，能看到整个依赖图、chunk 和 assets。

### loader 链的执行顺序

配置：

```js
module: {
  rules: [{
    test: /\.js$/,
    use: ['./loader/l1.js', './loader/l2.js', './loader/l3.js']
  }]
}
```

执行顺序：

```
l1 pitch（最先执行）
l2 pitch
l3 pitch（最后执行）
l3 normal（最先执行）
l2 normal
l1 normal（最后执行）
```

产物里的追加顺序：

```
// appended by l3
// appended by l2
// appended by l1
```

**所以 loader 链是一个洋葱**：

```
pitch 阶段：  左 ──────────────→ 右
              l1 → l2 → l3

normal 阶段： 右 ←────────────── 左
              l3 → l2 → l1
```

### 为什么 normal 阶段要从右往左？

**因为它是「函数嵌套」**。配置 `use: [a, b, c]` 等价于：

```js
a(b(c(source)))
```

`c` 最先执行，结果给 `b`，再给 `a`。

**实际例子**：

```js
use: ['style-loader', 'css-loader', 'sass-loader']
```

- `sass-loader` 先把 `.scss` 编成 `.css`
- `css-loader` 把 CSS 变成 JS 模块（`export default "..."`）
- `style-loader` 再把 JS 模块改成「运行时插入 `<style>`」

**每一步的输入必须是上一步的输出**，所以顺序不能反。写反了 `sass-loader` 会拿到 JS 代码，直接报语法错。

### 为什么还要有 pitch 阶段？

**pitch 是「提前拦截」的机会。** 如果某个 loader 的 `pitch` 返回非 `undefined`，**后面的 loader（包括 resource 本身）全部跳过**，直接把这个值往回传。

更典型的例子是 `vue-loader`：它的 `pitch` 里会**重新发起一次请求**，把 `.vue` 文件拆成 `<template>`、`<script>`、`<style>` 三个虚拟模块。不借助 pitch 难以实现这种「一个文件变多个请求」。

### 回答要点：loader 与 plugin

- **作用对象**：loader 处理单个文件源码，是无状态转换；plugin 面向整个构建流程。
- **配置与形态**：loader 在 `module.rules` 里按 `test` 匹配，形态是函数；plugin 在 `plugins` 数组里，构造时收 options、`apply(compiler)` 时注册钩子。
- **能力边界**：loader 只改内容（scss→css、TS→JS、图片→base64）；plugin 能改流程（生成 HTML、抽离 CSS、生成 manifest、拷贝资源）。
- **执行时机**：loader 只在模块构建时跑；plugin 可在 `initialize` 到 `done` 的任意钩子跑。
- **一句话**：改「一个文件的内容」用 loader，改「构建过程」用 plugin。

### 追问链：loader 与 plugin

| 追问 | 答法 |
|---|---|
| 怎么判断一个问题该用 loader 还是 plugin？ | 判断标准：**要处理的东西是否在某个文件里？** 是 → loader；否 → plugin。比如「给所有 CSS 加浏览器前缀」是 loader（单个 css 文件）；「把所有 CSS 抽成一个文件」是 plugin（跨文件） |
| 一个 loader 可以是 async 吗？ | 可以，用 `this.async()` 拿到 callback，处理完再调。比如读子文件、调接口 |
| loader 能拿到配置吗？ | 能。`this.getOptions()` 拿 `use: [{ loader, options }]` 里的 options |
| loader 里怎么拿到文件路径？ | `this.resourcePath`。还有 `this.context`（所在目录）、`this.query`（旧式参数） |
| plugin 能改 webpack 配置吗？ | 能。在 `environment` 或 `afterPlugins` 钩子里改 `compiler.options`。但**改了要自己保证一致性**，容易出问题 |
| `compiler` 和 `compilation` 区别？ | `compiler` 是**全局唯一**的，代表整个 webpack 生命周期，有 `run`/`watch`/`done`；`compilation` 是**每次构建一个**，代表一次编译，有 `modules`/`chunks`/`assets`。**watch 模式下 compiler 一个、compilation 很多个** |
| loader 处理顺序能通过配置改吗？ | 能用 `enforce: 'pre' / 'post'` 调整相对位置。pre 在所有 normal loader 之前，post 在之后 |

---

## 2.3 Tapable：webpack 的插件系统内核

Tapable 是 webpack 的事件系统，需要说清三件事：钩子类型、与 EventEmitter 的差异、`stage` 的作用。

### 一句话结论：Tapable

> Tapable 是**带返回值语义和异步控制的事件系统**——比 EventEmitter 多了「中断」「传值」「串并行」三种能力。

### 为什么不用 Node 的 EventEmitter

| 能力 | EventEmitter | Tapable |
|---|---|---|
| 监听 | `on` | `tap` / `tapAsync` / `tapPromise` |
| 触发 | `emit`（不等待） | `call` / `callAsync` / `promise`（**能等待**） |
| 中断后续 | 做不到 | Bail 系列 |
| 上一个的返回值传给下一个 | 不支持 | Waterfall 系列 |
| 控制执行顺序 | 只能靠注册顺序 | `stage` 参数 |
| 知道谁注册了 | 不支持 | `tapInfo` |

**核心差别**：webpack 的构建是**流程**，不是**通知**。

- 事件通知：发出去就完事，谁处理、处理完没，都不关心
- 构建流程：**必须等所有 plugin 处理完才能进下一步**，而且某个 plugin 可能说「到此为止」

所以 webpack 需要一个「能等待、能中断、能传值」的钩子系统。

### 钩子类型与语义

tapable 提供 10 个钩子类，常用的是下面 6 个；其余 4 个（`AsyncParallelBailHook`、`AsyncSeriesBailHook`、`AsyncSeriesWaterfallHook`、`AsyncSeriesLoopHook`）由同样的维度组合而来。

```js
const T = require('tapable');
```

#### ① SyncHook：同步、依次执行、不管返回值

```js
const h = new T.SyncHook(['a', 'b']);
h.tap('A', (a, b) => { console.log('A:', a, b); return 'fromA'; });
h.tap('B', (a, b) => { console.log('B:', a, b, '← 拿不到 A 的返回值'); });
h.call(1, 2);
```

输出：

```
A: 1 2
B: 1 2 ← 拿不到 A 的返回值
call 返回值: undefined      ← SyncHook 不收集返回值
```

#### ② SyncWaterfallHook：上一个的返回值成为下一个的入参

```js
const h = new T.SyncWaterfallHook(['x']);
h.tap('A', x => { console.log('A 收到:', x); return x + 10; });
h.tap('B', x => { console.log('B 收到:', x, '← A 的返回值'); return x * 2; });
h.tap('C', x => { console.log('C 收到:', x, '← B 的返回值'); return x; });
h.call(1);
```

输出：

```
A 收到: 1
B 收到: 11 ← A 的返回值
C 收到: 22 ← B 的返回值
最终: 22
```

**用途**：`compilation.hooks.assetPath`（改产物路径）。**每个插件基于前一个的结果继续改。**

#### ③ SyncBailHook：任一返回非 undefined 就中断

```js
const h = new T.SyncBailHook(['x']);
h.tap('A', () => { console.log('A 执行'); return undefined; });
h.tap('B', () => { console.log('B 执行，返回 "STOP"'); return 'STOP'; });
h.tap('C', () => { console.log('C 执行 ← 不会打印'); });
h.call(1);
```

输出：

```
A 执行
B 执行，返回 "STOP"
call 返回值: STOP
```

**C 不执行。** 「Bail」就是「提前退出」。

**用途**：`compiler.hooks.shouldEmit` 返回 `false` 即阻止输出；返回非 `undefined` 就提前退出后续 tap。

#### ④ SyncLoopHook：返回非 undefined 就重头再来

```js
const h = new T.SyncLoopHook(['x']);
let n = 0;
h.tap('A', () => { n++; console.log(`A 第 ${n} 次`); return n < 3 ? 'retry' : undefined; });
h.tap('B', () => { console.log('B 执行（A 终于返回 undefined 后）'); });
h.call(1);
```

输出：

```
A 第 1 次
A 第 2 次
A 第 3 次
B 执行（A 终于返回 undefined 后）
```

**注意：A 返回非 undefined 时会从「第一个 tap」重新开始**，不是从 A 自己。

#### ⑤⑥ AsyncSeriesHook / AsyncParallelHook：串行 vs 并行

```js
const sleep = ms => new Promise(r => setTimeout(r, ms));

const mk = (Hook) => {
  const h = new Hook(['n']);
  h.tapPromise('A', async () => { console.log('A start'); await sleep(40); console.log('A end'); });
  h.tapPromise('B', async () => { console.log('B start'); await sleep(20); console.log('B end'); });
  return h;
};
```

串行（`AsyncSeriesHook`）：

```
A start → A end → B start → B end
总耗时约为 40 + 20
```

并行（`AsyncParallelHook`）：

```
A start → B start → B end → A end
总耗时约为 max(40, 20)
```

**用途**：

- `AsyncSeriesHook`：`compiler.hooks.emit`、`beforeCompile`——有先后依赖，必须串行
- `AsyncParallelHook`：`compiler.hooks.make`——多个插件并行添加依赖，互不等待

### 注册方式：`tap` / `tapAsync` / `tapPromise`

```js
// 同步
hook.tap('name', (args) => { ... });

// callback 风格（老 API）
hook.tapAsync('name', (args, callback) => { ...; callback(); });

// Promise 风格（推荐）
hook.tapPromise('name', async (args) => { ... });
```

**区别**：

| 方式 | 错误处理 | 代码量 |
|---|---|---|
| `tapAsync` | 必须 `callback(err)` 传错误，**漏调 callback 会永久挂起** | 多 |
| `tapPromise` | `throw` / `reject` 即可 | 少 |

`tapAsync` 漏调 `callback` 会让构建一直等下去，且不报错；新代码优先 `tapPromise`。

### `stage` 参数：控制同一钩子内多个 tap 的顺序

```js
h.tap({ name: 'stage20', stage: 20 }, () => console.log('stage 20'));
h.tap('plain', () => console.log('默认 0'));
h.tap({ name: 'stage-20', stage: -20 }, () => console.log('stage -20'));
```

输出：

```
[stage -20] 最后注册但最先执行
[默认 0]    按注册顺序
[stage 20]  先注册但后执行
```

**规则**：`stage` 越小越先执行；不写视为 `0`；同 stage 按注册顺序。

**为什么要这个？** plugin 的注册顺序取决于 `plugins` 数组顺序，而**第三方插件的位置不受控**。如果某个插件的逻辑必须在另一个之前跑，就得靠 `stage`。

例：`TerserPlugin` 注册在 `PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE`（400），体积报告类插件注册在 `PROCESS_ASSETS_STAGE_REPORT`（5000）；stage 选错，统计到的是压缩前的体积。

### `tap` 必须传 name

```js
h.tap(() => {});     // 错误：tap 的第一个参数必须是 name 或含 name 的 options 对象
```

`tap` 的第一个参数不是可选参数，必须传 name（或 options 对象且含 name）。

### 回答要点：Tapable

- Tapable 可以理解成**加强版 EventEmitter**：多了「等待、中断、传值」。
- 常用：`SyncHook`（纯通知，如 `environment`）、`SyncBailHook`（返回非 undefined 中断）、`SyncWaterfallHook`（返回值传递，如 `assetPath`）、`AsyncSeriesHook`（异步串行，如 `emit`）。
- `tap` / `tapAsync` / `tapPromise` 分别对应同步、callback、Promise 注册；异步优先 `tapPromise`。
- 不用 EventEmitter 的根因：**构建是流程不是通知**，必须能等待、中断、传值。

### 追问链：Tapable

| 追问 | 答法 |
|---|---|
| tapable 性能为什么好？ | 它用了**动态生成函数**（`new Function`）来编译出最优的执行路径。第一次调用时会根据 tap 的数量和类型生成专用函数，避免每次循环判断 |
| `tap` 和 `tapAsync` 能在同一个钩子上混用吗？ | 能，但**不建议**。混用容易搞错执行顺序；`SyncHook` 上挂 `tapPromise` 会直接报错 |
| plugin 里怎么知道当前是第几次构建？ | `compilation` 对象每次构建都不同，可以在 `compilation` 钩子里存引用。或者看 `compiler.hooks.watchRun` 被调了几次 |
| 钩子能取消吗？ | 没有「取消」的概念，但 `Bail` 系列能中断后续 tap，`AsyncSeriesHook` 里 `reject` 会中断整个链 |
| `intercept` 是干什么的？ | 拦截钩子的调用过程，能拿到「谁注册了」「什么时候调用」「参数是什么」。**性能分析插件用它来统计每个 tap 的耗时** |

`intercept` 的回调顺序：

```
[register] P1     ← 注册时
[call] 参数 1     ← 调用前
[tap] 注册了 P1   ← 执行某个 tap 前
P1 执行
```

---

## 2.4 手写一个 loader

### 常见 loader 写法的问题

```js
module.exports = function(source) {
  const result = transform(source);
  return result;
};
```

只有骨架，还缺四个关键点：

1. **怎么拿 options**
2. **怎么处理异步**
3. **怎么标记依赖（`addDependency`）**
4. **怎么返回 sourcemap**

### 最小可用 loader

```js
// loaders/replace-loader.js
module.exports = function replaceLoader(source, sourceMap, meta) {
  // 1. 拿配置：use: [{ loader, options: { from, to } }]
  const options = this.getOptions();
  const { from, to } = options;

  // 2. 标记为可缓存（webpack 会据此决定是否跳过）
  this.cacheable && this.cacheable();

  // 3. 做转换
  let result = source;
  if (from instanceof RegExp) {
    result = source.replace(from, to);
  } else {
    result = source.split(from).join(to);
  }

  // 4. 如果有外部依赖（比如读了别的文件），要声明，否则 watch 不到
  // this.addDependency('/abs/path/to/other-file');

  // 5. 返回值：同步 loader 直接 return，或用 this.callback
  return result;

  // 等价写法（能传 sourcemap）：
  // this.callback(null, result, sourceMap, meta);
};
```

配置：

```js
module: {
  rules: [{
    test: /\.js$/,
    exclude: /node_modules/,
    use: [{
      loader: path.resolve(__dirname, 'loaders/replace-loader.js'),
      options: { from: 'hi ', to: 'HI ' },
    }],
  }],
}
```

效果：源文件里的 `` `hi ${name}` `` 会被改成 `` `HI ${name}` ``。

### 异步 loader

```js
module.exports = function asyncLoader(source) {
  const callback = this.async();          // 拿到 callback，表示「异步返回」

  someAsyncWork(source)
    .then(result => callback(null, result))
    .catch(err => callback(err));         // 传 error 会让构建失败

  // 注意：一旦调了 this.async()，就不要再 return 值（会被忽略）
};
```

**`this.async()` 的机制**：调用它会让 webpack 进入「等待」状态，直到调用 `callback`。**漏调 `callback`，构建会永久挂起**——这是自定义 loader 最常见的事故。

### loader 的 `this` 上有什么

| 属性/方法 | 用途 |
|---|---|
| `this.getOptions()` | 拿配置（webpack 5 推荐，替代 `this.query`） |
| `this.async()` | 声明异步 |
| `this.callback(err, content, map, meta)` | 同步/异步都能用的回调 |
| `this.resourcePath` | 当前文件的绝对路径 |
| `this.resource` | 完整请求（含 query） |
| `this.context` | 所在目录 |
| `this.addDependency(file)` | 声明文件依赖（watch 会监听） |
| `this.addContextDependency(dir)` | 声明目录依赖 |
| `this.emitFile(name, content)` | 额外输出文件 |
| `this.cacheable(flag)` | 标记是否可缓存（默认 true） |
| `this.sourceMap` | 是否要生成 sourcemap |
| `this.mode` | `development` / `production` |
| `this.target` | 编译目标（`web` / `node`） |

`this.addDependency` 用于 loader 读取了额外文件的情况：不声明依赖，改被读取的文件不会触发重新构建。

### 追问链：loader

| 追问 | 答法 |
|---|---|
| loader 的返回值必须是字符串吗？ | 可以是 `Buffer`（处理二进制，配 `raw: true`）。`this.callback` 的 content 同样支持 string/Buffer |
| 怎么处理二进制文件？ | 加 `module.exports.raw = true`，此时 `source` 是 `Buffer` |
| loader 能返回多个文件吗？ | 不能直接返回，但能 `this.emitFile` 额外输出 |
| 为什么 loader 要「无状态」？ | 因为 webpack 可能并行/缓存地调用它。**状态放在闭包或 `this` 上，不要放模块级变量** |
| 官方 loader 推荐读哪些？ | `babel-loader`（缓存）、`css-loader`（如何把 CSS 变成 JS）、`raw-loader`（最简） |
| 怎么调试自己写的 loader？ | ① `console.log` 到终端（loader 跑在 Node 里，不是浏览器）；② `debugger` + `node --inspect-brk node_modules/webpack/bin/webpack.js` |

---

## 2.5 手写一个 plugin

### 常见 plugin 写法的问题

```js
class MyPlugin {
  apply(compiler) {
    compiler.hooks.emit.tapAsync('MyPlugin', (compilation, cb) => {
      // 操作 compilation.assets
      cb();
    });
  }
}
```

常见答案有三个问题：

1. 在 `emit` 阶段改 `compilation.assets` 会触发废弃警告
2. 没有 `apply` 之外的结构（options 怎么传）
3. 没说清 `compilation.assets` 怎么改（webpack 5 要用 `emitAsset`）

### emit 阶段修改 assets 的废弃警告

在 `compiler.hooks.emit` 里直接改 `compilation.assets`，webpack 5 会输出：

```
[DEP_WEBPACK_COMPILATION_ASSETS] DeprecationWarning:
Compilation.assets will be frozen in future, all modifications are deprecated.
BREAKING CHANGE: No more changes should happen to Compilation.assets after sealing the Compilation.
  Do changes to assets earlier, e.g. in Compilation.hooks.processAssets.
```

官方要求把资源修改放到 `compilation.hooks.processAssets`，并用 `emitAsset` / `updateAsset`。

### 正确的 plugin 实现

```js
// plugins/build-manifest-plugin.js
class BuildManifestPlugin {
  constructor(options = {}) {
    this.filename = options.filename || 'manifest.json';
  }

  apply(compiler) {
    const PLUGIN_NAME = 'BuildManifestPlugin';

    // ① 用 processAssets 处理资源
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          // ② stage 决定在「资源处理的哪个阶段」执行
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT,
        },
        (assets) => {
          // 已存在的资源（此时 hash 已算好）
          const manifest = {};
          for (const [filename, source] of Object.entries(assets)) {
            manifest[filename] = {
              size: source.size(),
            };
          }

          // ③ 用 emitAsset 新增文件，而不是直接赋值
          compilation.emitAsset(
            this.filename,
            new compiler.webpack.sources.RawSource(JSON.stringify(manifest, null, 2))
          );
        }
      );
    });
  }
}

module.exports = BuildManifestPlugin;
```

### 钩子执行顺序

在 plugin 里注册 6 个钩子后，顺序是：

```
[hook] initialize
[hook] beforeCompile
[hook] compilation
[hook] processAssets
[hook] emit
[hook] done
```

**顺序**：`initialize → beforeCompile → compilation → processAssets → emit → done`

### 六个常用钩子对照表

| 钩子 | 类型 | 时机 | 典型用途 |
|---|---|---|---|
| `initialize` | SyncHook | 最早，插件初始化 | 改配置 |
| `beforeCompile` | AsyncSeriesHook | 编译前 | 准备临时文件 |
| `compilation` | SyncHook | 创建 compilation | 拿到 compilation 挂子钩子 |
| `thisCompilation` | SyncHook | 同上，但不含子 compiler | **更推荐**（避免重复触发） |
| `processAssets` | AsyncSeriesHook | 处理产物资源 | **生成/修改文件** |
| `done` | AsyncSeriesHook | 构建完成 | 统计、通知、上报 |

### `processAssets` 的 stage 常量

```js
compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_*
```

| 常量 | 值 | 用途 |
|---|---|---|
| `ADDITIONAL` | -2000 | 加额外资源 |
| `PRE_PROCESS` | -1000 | 预处理 |
| `DERIVED` | -200 | 派生资源（如从 js 生成 map） |
| `ADDITIONS` | -100 | 给现有资源追加内容 |
| `OPTIMIZE` | 100 | 通用优化 |
| `OPTIMIZE_COUNT` | 200 | 优化资源数量 |
| `OPTIMIZE_SIZE` | 400 | 压缩、删除空白 |
| `SUMMARIZE` / `REPORT` | 1000 / 5000 | 整理资源 / 最终报告 |

**为什么需要 stage？** 因为「生成文件」和「压缩文件」有先后依赖。压缩插件必须在 400 附近，统计体积的插件必须在 5000（压缩之后），否则统计到的还是压缩前的体积。

### 回答要点：plugin

- 写 plugin 三步：类 + `constructor(options)`；`apply(compiler)`；在 `apply` 里注册钩子。
- webpack 5 不要改 `compilation.assets`（`emit` 阶段会报 `DEP_WEBPACK_COMPILATION_ASSETS`），改到 `thisCompilation` 的 `processAssets`，用 `emitAsset` / `updateAsset`。
- `processAssets` 要显式给 `stage`（默认 0）；统计最终体积用 `PROCESS_ASSETS_STAGE_REPORT`（5000），否则拿到压缩前的产物。

### 追问链：plugin

| 追问 | 答法 |
|---|---|
| `apply` 会被调几次？ | 一次。webpack 初始化时遍历 `plugins`，对每个调 `plugin.apply(compiler)` |
| 为什么要 `thisCompilation` 而不是 `compilation`？ | `compilation` 钩子在**子 compiler**（比如 `childCompilers`）里也会触发，容易重复注册。`thisCompilation` 只针对当前 compiler |
| 怎么在 plugin 里读文件？ | `compiler.inputFileSystem`（不是 `fs`）。这样能走 webpack 的缓存层 |
| 怎么改某个模块的内容？ | 用 `compilation.hooks.succeedModule` 或写个 loader。**改模块内容优先用 loader，不推荐用 plugin** |
| plugin 能改变 entry 吗？ | 能，在 `initialize` 或 `beforeCompile` 里改 `compiler.options.entry`。但要小心已经创建的 compilation |
| 怎么让 plugin 只在 production 生效？ | 在配置里 `plugins: isProd ? [new P()] : []`，或者 plugin 内部判 `compiler.options.mode` |
| 写 plugin 的常见错误？ | ① 在 `emit` 阶段改 assets；② `tapAsync` 忘调 `callback` 导致挂起；③ 直接赋值 `compilation.assets[x] = ...`（seal 后只读）；④ stage 选错导致拿到未压缩的产物 |

---

## 2.6 本册追问总表

| 问题 | 一句话答 |
|---|---|
| webpack 打包原理一句话 | 建依赖图 → 每模块包成函数 → 生成带 require 运行时的 bundle |
| Module/Chunk/Bundle 区别 | 源文件 / 模块的逻辑分组 / 产物文件 |
| 为什么模块要包成函数 | 隔离作用域 + 注入 require + 支持循环依赖 |
| `__webpack_require__.d` 为什么用 getter | ESM 是活绑定，赋值会拷贝快照 |
| `(0, fn)()` 为什么这么写 | 断开 this，符合 ESM 语义 |
| loader 和 plugin 一句话区别 | loader 改「一个文件的内容」，plugin 改「构建过程」 |
| loader 链为什么从右往左 | 本质是函数嵌套 `a(b(c(src)))` |
| pitch 有什么用 | 能提前返回、短路后续 loader（vue-loader 靠它拆 SFC） |
| 为什么不用 EventEmitter | 构建是流程，需要「等待 / 中断 / 传值」 |
| Tapable 钩子怎么记 | 同步 4 + 异步并行 2 + 异步串行 4，再按 Bail / Waterfall / Loop 区分语义 |
| `stage` 干什么 | 控制同一钩子内多个 tap 的顺序，越小越先 |
| webpack 5 生成文件的正确方式 | `compilation.hooks.processAssets` + `emitAsset`（`emit` 阶段改 assets 已废弃） |
| `tapAsync` 最大的坑 | 忘调 `callback` → 构建永久挂起 |
| `thisCompilation` vs `compilation` | 后者在子 compiler 里也会触发，前者更安全 |

---

## 2.7 速记卡

```
【打包原理】
Module → Chunk → Bundle → Asset
四阶段：初始化 / 编译（Make）/ 优化（Seal）/ 生成（Emit）
产物 = __webpack_modules__（模块函数表）+ __webpack_require__（缓存 + 执行）
模块隔离靠「包成函数」形成独立函数作用域

【产物五个细节】
.r()  标记 __esModule / Symbol.toStringTag
.d()  用 getter → 因为 ESM 是活绑定
.o()  hasOwnProperty 简写
(0, fn)()  断开 this 符合 ESM 语义
__webpack_module_cache__  模块单例

【手写 bundler 的全局 id】
把「模块内依赖下标」当「全局 id」→ 入口 require 了自己
修法：先占位 __REQ__(路径)，建完图再替换成 id
对应 webpack 的「解析」与「生成」两阶段

【loader vs plugin】
loader：单文件 / module.rules / 改内容 / 无状态
plugin：全流程 / plugins[] / 改流程 / 有 compiler
洋葱：pitch 左→右，normal 右→左（函数嵌套）
pitch 能提前返回短路（vue-loader 拆 SFC 靠它）

【tapable】
10 个钩子类：同步 4 + 异步并行 2 + 异步串行 4
SyncHook 不收集返回值
Bail 返回非 undefined 即中断
Loop 返回非 undefined 从第一个 tap 重来
Series 串行（耗时相加）/ Parallel 并行（取最慢者）
stage 越小越先执行
tap 必须传 name

【写 plugin 三步】
① 类 + constructor(options)
② apply(compiler)
③ 注册钩子

【webpack 5 关键变更】
emit 阶段修改 compilation.assets 已废弃（DEP_WEBPACK_COMPILATION_ASSETS）
改用 processAssets + emitAsset
processAssets 要传 stage（统计体积用 REPORT，否则拿到压缩前的）
用 thisCompilation 而不是 compilation
```

---

## 2.8 自测

```
□ 能说出 webpack 四阶段，以及流程中的关键钩子
□ 能分清 Module / Chunk / Bundle / Asset
□ 能解释「模块为什么要包成函数」
□ 能解释 __webpack_require__.d 为什么用 getter
□ 能解释 (0, _mod.fn)() 这个写法的原因
□ 能说出手写 bundler 时全局 id 的坑
□ 能用五个维度对比 loader 和 plugin
□ 能画出 loader 链的洋葱模型（pitch/normal 方向）
□ 能解释 pitch 阶段的实际用途
□ 能说出为什么 webpack 不用 EventEmitter
□ 能列出 tapable 的钩子类型并说出三种最常用的
□ 能解释 Bail / Waterfall / Loop 的语义
□ 能说出 stage 的作用和一个真实场景
□ 能说出 webpack 5 里生成文件的正确方式
□ 能说出 emit 阶段改 assets 为什么被废弃
□ 能说出 tapAsync 忘调 callback 的后果
□ 能说出手写 loader 需要声明 addDependency 的场景
□ 能记住六个常用钩子的顺序
```
