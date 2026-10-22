# 工程化 04｜Babel 与 AST

> 覆盖题号：2（babel 是怎么编译高级 js 的）
> 去重后：**1 个考点**，但它是理解「一切代码转换工具」的钥匙

---

## 目录

- [4.1 题单答案的问题](#41-题单答案的问题)
- [4.2 一句话结论](#42-一句话结论)
- [4.3 三阶段详解](#43-三阶段详解)
- [4.4 实测：各种语法降级成什么样](#44-实测各种语法降级成什么样)
- [4.5 实测：Babel 不转 API](#45-实测babel-不转-api)
- [4.6 preset 与 plugin 的执行顺序（跟直觉相反）](#46-preset-与-plugin-的执行顺序跟直觉相反)
- [4.7 AST 的三种用途（理解这个就理解了整个工具链）](#47-ast-的三种用途理解这个就理解了整个工具链)
- [4.8 手写一个 Babel 插件](#48-手写一个-babel-插件)
- [4.9 面试怎么说（2 分钟版）](#49-面试怎么说2-分钟版)
- [4.10 追问链](#410-追问链)
- [4.11 速记卡](#411-速记卡)
- [4.12 自测](#412-自测)

---

## 4.1 题单答案的问题

> 「Babel 三阶段：解析（源码 → AST）→ 转换（操作 AST）→ 生成（AST → 新代码）。插件做具体转换，preset 是插件集合。」

**三阶段说对了，但这只答了 30%**。缺四个东西，而它们恰好是追问会问的：

1. **三阶段内部到底在做什么**（词法/语法分析、visitor 模式、sourcemap）
2. **Babel 不能做什么**（这是最高频的追问：`Promise` 为什么没被转）
3. **preset 和 plugin 的执行顺序**（跟直觉相反）
4. **polyfill 和 transform 的区别**

---

## 4.2 一句话结论

> **Babel 只做「语法降级」，不做「API 降级」。**

这句话是这道题的核心。展开：

| | 语法（Syntax） | API（Built-in） |
|---|---|---|
| 例子 | 箭头函数、`class`、可选链、`async` | `Promise`、`Array.prototype.includes`、`Object.assign` |
| 本质 | **写法**。解析器能识别，但老浏览器不认识 | **运行时能力**。老浏览器里这个对象/方法根本不存在 |
| Babel 能处理吗 | ✅ 改写成老语法 | ❌ **改不了** |
| 谁来处理 | Babel 自己 | **polyfill（core-js）** |

> **一句话记法**：**「语法是『怎么写』，API 是『有没有』。Babel 能改写法，改不了有无。」**

---

## 4.3 三阶段详解

### ① Parse（解析）：源码 → AST

**内部还有两步**：

```
源码字符串
  ↓ 词法分析（Lexer / Tokenizer）
Token 流：[{type:'Keyword',value:'const'}, {type:'Identifier',value:'a'}, ...]
  ↓ 语法分析（Parser）
AST（抽象语法树）
```

**Babel 用的是 `@babel/parser`**（早期是 acorn 的 fork，现在独立维护）。

**AST 长什么样**？以 `var a = 1 + 2;` 为例（用 espree 实测）：

```json
{
  "type": "Program",
  "body": [{
    "type": "VariableDeclaration",
    "kind": "var",
    "declarations": [{
      "type": "VariableDeclarator",
      "id": { "type": "Identifier", "name": "a" },
      "init": {
        "type": "BinaryExpression",
        "operator": "+",
        "left":  { "type": "Literal", "raw": "1" },
        "right": { "type": "Literal", "raw": "2" }
      }
    }],
    "loc": { "start": { "line": 1, "column": 0 }, "end": { "line": 1, "column": 14 } },
    "range": [0, 14]
  }]
}
```

**关键点**：

- 每个节点都有 `type`，这是一切工具的分发依据
- `loc` / `range` 记录了位置——**sourcemap 和报错定位全靠它**
- 这棵树是**纯数据**，可以任意增删改

### ② Transform（转换）：遍历 AST，改它

**核心是 visitor 模式**：

```js
babel.transformSync(code, {
  plugins: [{
    visitor: {
      ArrowFunctionExpression(path) {
        // 遇到箭头函数就改
      },
      Identifier(path) {
        // 遇到标识符就改
      },
    },
  }],
});
```

**为什么用 visitor 而不是让用户自己递归？**

| 自己递归 | visitor 模式 |
|---|---|
| 每个插件写一遍遍历逻辑 | 一次遍历，分发到所有插件 |
| 容易漏节点类型 | 所有节点类型都覆盖 |
| 不好控制遍历顺序 | `enter` / `exit` 精确控制 |

**Babel 的遍历是「一次深度优先，所有插件同时收到通知」**——不是「每个插件遍历一遍」。

> 这个设计很重要：**它让 50 个插件的开销从「50 次遍历」降到「1 次遍历」**。（对比 esbuild 干脆把转换合并成一次，更进一步。）

**`path` 对象**（不是 `node`）才是操作的核心：

```js
ArrowFunctionExpression(path) {
  path.node;            // 当前节点
  path.parent;          // 父节点
  path.scope;           // 作用域信息（能查变量绑定）
  path.replaceWith(newNode);   // 替换
  path.remove();               // 删除
  path.insertBefore(...);      // 插入
  path.skip();                 // 跳过子节点
  path.stop();                 // 停止整个遍历
}
```

**`path.scope` 是最强大的部分**——它能回答「这个变量从哪来、有没有被重新赋值」，所以能做出安全的转换（比如把 `const` 改成 `var` 时判断是否需要 IIFE 隔离）。

**实测：三阶段的执行顺序**

我用一个自定义插件在三个阶段打点，输出：

```
① parse 完成，插件 pre 执行
① 收到 AST，顶层语句 1 条
② 访问到箭头函数
② 访问到可选链
② 访问到 class 表达式
③ generate 完成，插件 post 执行
```

**顺序是**：`pre`（parse 之后）→ `Program.enter` → 各节点 visitor → `post`（generate 之后）。

> 注意这里的细节：**`pre` 在 parse 之后才调用**，不是之前。因为插件要拿到 AST 才有意义。

### ③ Generate（生成）：AST → 新代码

用 `@babel/generator`：

- 深度优先打印每个节点
- **保留注释**（需要额外处理，默认会丢一部分）
- **生成 sourcemap**：因为每个节点有 `loc`，新代码的每个位置都能映射回原位置

**sourcemap 的本质**：一张映射表 `[生成行, 生成列] → [源文件, 源行, 源列]`。Babel 在每个节点输出时记录映射，拼成 VLQ 编码的 `mappings` 字符串。

---

## 4.4 实测：各种语法降级成什么样

配置：`@babel/preset-env`，`targets: { ie: '11' }`，`modules: false`。

| 语法 | 输入 | 输出 |
|---|---|---|
| **箭头函数** | `const f = (a) => a + 1;` | `var f = function f(a) { return a + 1; };` |
| **let/const** | `let a = 1; const b = 2;` | `var a = 1; var b = 2;` |
| **可选链** | `const v = obj?.a?.b;` | `var _obj; var v = (_obj = obj) === null \|\| _obj === void 0 \|\| (_obj = _obj.a) === null \|\| _obj === void 0 ? void 0 : _obj.b;` |
| **空值合并** | `const v = x ?? 'd';` | `var _x; var v = (_x = x) !== null && _x !== void 0 ? _x : 'd';` |
| **模板字符串** | ``const s = `a${b}c`;`` | `var s = "a".concat(b, "c");` |
| **解构** | `const [a, ...r] = arr;` | 引入 `_toArray` / `_arrayWithHoles` / `_iterableToArray` / `_unsupportedIterableToArray` / `_nonIterableRest` 五个 helper |
| **class** | `class A { constructor() { this.x = 1; } }` | 引入 `_typeof` / `_classCallCheck` / `_createClass` 等 helper |
| **async/await** | `async function f() { await g(); }` | 内联整个 `regenerator-runtime`（几千字节） |
| **展开运算符** | `const o = { ...a, b: 1 };` | 引入 `_typeof` + `_objectSpread` |
| **for...of** | `for (const x of arr) {...}` | 引入 `_createForOfIteratorHelper` |

### 三个值得注意的细节

#### ① `void 0` 而不是 `undefined`

```js
_obj === void 0        // 而不是 _obj === undefined
```

因为 **`undefined` 在老浏览器里可以被赋值**（`undefined = 1` 在非严格模式下合法）。`void 0` 永远返回真正的 `undefined`，无法被篡改。

#### ② helper 会重复注入

如果不配 `@babel/plugin-transform-runtime`，**每个文件都会内联一份 helper**。100 个文件都用了 class，就有 100 份 `_classCallCheck`。

```js
// 配了 transform-runtime 之后
var _classCallCheck2 = require("@babel/runtime/helpers/classCallCheck");
```

**这是实际项目里 bundle 变大的一个隐藏原因**。

#### ③ `async/await` 的代价最大

内联 `regenerator-runtime` 有 **几千字节**。所以：

- 如果用得多，一定要配 `transform-runtime` 抽出来
- 现代项目可以直接把 target 设成 `es2017`，Babel 就不会转 async/await 了

---

## 4.5 实测：Babel 不转 API

这是这道题**最重要的追问**。我测了 8 个 API，配置 `targets: { ie: '11' }`：

```
Promise          API 还在: 是 ← IE11 跑不了   → new Promise(function (r) { return r(1); });
Array.includes   API 还在: 是 ← IE11 跑不了   → arr.includes(1);
Array.from       API 还在: 是 ← IE11 跑不了   → Array.from(x);
Object.assign    API 还在: 是 ← IE11 跑不了   → Object.assign({}, a);
String.padStart  API 还在: 是 ← IE11 跑不了   → s.padStart(3, '0');
globalThis       API 还在: 是 ← IE11 跑不了   → globalThis.x = 1;
Symbol           API 还在: 是 ← IE11 跑不了   → Symbol("k");
Map              API 还在: 是 ← IE11 跑不了   → new Map();
```

**8 个全部原样保留。**

注意第一行：`new Promise(r => r(1))` 里的**箭头函数被转成了 `function`**，但 `Promise` 本身**没有被替换**。

> 这就是「语法能转、API 不能转」最直观的证据：**同一个表达式里，语法部分被改了，API 部分原样留着。**

### 为什么 Babel 不能转 API

**因为 API 是运行时的东西**。要「转」`Promise`，本质上是要**替换全局对象**：

```js
// 这已经不是「转换代码」，而是「往全局注入实现」
if (typeof Promise === 'undefined') {
  window.Promise = /* 一整个 Promise polyfill */;
}
```

这跟「把箭头函数改写成普通函数」是**完全不同的两件事**：

| | 语法转换 | API polyfill |
|---|---|---|
| 操作对象 | 当前文件里的代码 | **全局环境** |
| 是否影响其他代码 | 否 | **是**（全局污染） |
| 是否需要运行时 | 否（改完就能跑） | **是**（要加载 polyfill 代码） |
| 谁来做 | Babel 的 transform 插件 | core-js |

### polyfill 的三种引入方式（历史演进）

| 方式 | 配置 | 特点 |
|---|---|---|
| **全量引入**（最老） | `import '@babel/polyfill'` | 一把梭，**体积巨大**（几百 KB），已废弃 |
| **按需引入** | `useBuiltIns: 'usage'` + `corejs: 3` | Babel 分析代码里用了哪些 API，只 import 对应的 polyfill |
| **入口引入** | `useBuiltIns: 'entry'` | 在入口 import 'core-js/stable'，按 target 裁剪 |

> **⚠️ Babel 8 的破坏性变更（我实测到了）**：
>
> ```
> useBuiltIns: usage  ✗ [BABEL] @babel/preset-env: The 'useBuiltIns' option has been removed.
>                        Please use babel-plugin-polyfill-corejs3 instead.
> ```
>
> 同时 `bugfixes` 选项也被移除了：
>
> ```
> bugfixes: true  ✗ @babel/preset-env: The 'bugfixes' option has been removed,
>                    and now bugfix plugins are always enabled.
> ```
>
> **所以网上大量「配 `useBuiltIns: 'usage'`」的教程在 Babel 8 上直接报错。** 现在要用 `babel-plugin-polyfill-corejs3`。

**现代推荐做法**：

```js
// babel.config.js（Babel 8）
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: '> 0.5%, not dead', modules: false }],
  ],
  plugins: [
    ['polyfill-corejs3', { method: 'usage-pure' }],   // ← 替代 useBuiltIns
    ['@babel/plugin-transform-runtime', { regenerator: true }],
  ],
};
```

> **`usage-pure` vs `usage-global` 的区别很重要**：
> - `usage-global`：往全局打补丁（`Array.prototype.includes = ...`），会影响所有代码
> - `usage-pure`：不污染全局，而是在用到的地方 `import` 一个函数（`import _includesInstanceProperty from "core-js-pure/..."`）
>
> **写库必须用 `pure`**，否则会污染使用方的环境。这是「库作者的基本修养」。

---

## 4.6 preset 与 plugin 的执行顺序（跟直觉相反）

> **plugins 先于 presets 执行；同类内部，从后往前。**

```js
module.exports = {
  presets: ['@babel/preset-env', '@babel/preset-react'],
  plugins: ['@babel/plugin-transform-arrow-functions', 'my-plugin'],
};
```

**执行顺序**：

```
① plugins 逆序：my-plugin → transform-arrow-functions
② presets 逆序：preset-react → preset-env
```

**为什么要逆序？**

因为**数组书写习惯是「从通用到具体」，而执行要从具体到通用**。类比 CSS：

```css
/* 书写顺序：先通用后具体 */
.a { color: red; }
.a.b { color: blue; }

/* 但「后写的覆盖先写的」——所以具体规则要写在后面才生效 */
```

Babel 的逻辑类似：**后写 = 后执行 = 优先级更高**。而 preset 是「一组插件」，它整体比单个 plugin 更「通用」，所以 preset 放在后面执行（在 plugin 之后）。

> **实操建议**：不要依赖这个顺序，容易搞错。**该拆的拆开，用 `@babel/preset-env` 的 `targets` 来控制，而不是靠顺序。**

---

## 4.7 AST 的三种用途（理解这个就理解了整个工具链）

AST 不只是 Babel 的中间产物。**它是所有代码工具的公共底座**：

| 工具类型 | 代表 | 怎么用 AST |
|---|---|---|
| **编译/降级** | Babel、TypeScript、SWC | 源码 → AST → 改写 → 新代码 |
| **检查（Lint）** | ESLint、Stylelint | 源码 → AST → **只读遍历**找问题 |
| **格式化** | Prettier | 源码 → AST → **重新打印**（丢掉原有格式） |
| **打包分析** | webpack、Rollup | 源码 → AST → 找 `import`/`require` |
| **重构工具** | jscodeshift、codemod | 源码 → AST → 批量改写 |
| **代码高亮** | Shiki、Prism | 源码 → Token 流（不一定要完整 AST） |

**这个视角的价值**：

> 「Babel、ESLint、Prettier 看着是三个工具，其实是**同一个流水线的三种用法**：
> - Babel：AST → 改写 → 输出新代码
> - ESLint：AST → 遍历 → 报告问题（**不改代码**）
> - Prettier：AST → **丢弃原有格式信息** → 按自己的规则重新打印
>
> 所以 Prettier 永远不会「保留你的空行」——因为空行在 AST 里通常不存在，它是重新生成的。」

> 这句话能直接解释「为什么 Prettier 和 ESLint 会打架」——它们对同一个 AST 做了不同的输出决策。

### 手写一条 Lint 规则（不用 ESLint，直接遍历 AST）

理解了 AST，写 Lint 规则就是几十行的事。用 `espree` 解析：

```js
const espree = require('espree');

function walk(node, cb) {
  if (!node || typeof node !== 'object') return;
  if (node.type) cb(node);
  for (const k of Object.keys(node)) {
    if (k === 'loc' || k === 'range' || k === 'parent') continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach(c => walk(c, cb));
    else if (v && typeof v === 'object') walk(v, cb);
  }
}

// 规则：禁止 var（等价于 ESLint 的 no-var）
const code = 'var a = 1;\nlet b = 2;\nvar c = 3;';
const tree = espree.parse(code, { ecmaVersion: 2022, loc: true });

const problems = [];
walk(tree, (node) => {
  if (node.type === 'VariableDeclaration' && node.kind === 'var') {
    problems.push(`第 ${node.loc.start.line} 行：不允许使用 var，请用 let/const`);
  }
});
```

实测输出：

```
✗ 第 1 行：不允许使用 var，请用 let/const
✗ 第 3 行：不允许使用 var，请用 let/const
```

**再写一条（等价于 `eqeqeq`）**：

```js
walk(tree, (n) => {
  if (n.type === 'BinaryExpression' && n.operator === '==') {
    problems.push(`第 ${n.loc.start.line} 行：使用 ==，应为 ===`);
  }
});
```

**这就是 ESLint 的全部原理**——遍历 AST，匹配节点类型，报告位置。规则库只是这些判断的集合。

> **面试可以直接说**：「Lint 工具能检查错误，是因为它**不看你写的字符，看的是语法结构**。`a == b` 之所以能被查出，是因为 AST 里有个节点 `{type:'BinaryExpression', operator:'=='}`。所以它不会误判字符串里的 `'a == b'`——那在 AST 里只是个 `Literal`。」

---

## 4.8 手写一个 Babel 插件

「把 `console.log(x)` 全部删掉」——这是最经典的 Babel 插件练习题（生产环境去 console 就是干这个）。

```js
module.exports = function removeConsolePlugin() {
  return {
    name: 'remove-console',
    visitor: {
      // 匹配「调用表达式」
      CallExpression(path) {
        const callee = path.node.callee;

        // 判断是不是 console.xxx()
        const isConsoleCall =
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'console';

        if (!isConsoleCall) return;

        // console.error / console.warn 保留（生产也要看错误）
        const method = callee.property.name;
        if (method === 'error' || method === 'warn') return;

        // 关键：如果这个调用是「语句」，整句删掉；
        // 如果是「表达式的一部分」，要替换成 undefined 而不是删掉
        if (path.parentPath.isExpressionStatement()) {
          path.parentPath.remove();
        } else {
          path.replaceWith({ type: 'Identifier', name: 'undefined' });
        }
      },
    },
  };
};
```

**这里有一个非常容易踩的坑**（面试加分点）：

```js
// 情况 A：语句 → 可以整句删
console.log('x');

// 情况 B：表达式的一部分 → 不能删，要替换
const v = console.log('x') || 'default';
if (console.log(a)) { ... }
foo(console.log(b));
```

如果一律 `path.remove()`，情况 B 会变成语法错误（`const v = ;`）。所以必须判断父节点类型。

> **这个细节直接证明你写过 Babel 插件**，不是抄的。

---

## 4.9 面试怎么说（2 分钟版）

> 「Babel 的核心就一句话：**它只做语法降级，不做 API 降级。**
>
> 流程是三阶段：parse 把源码转成 AST，transform 遍历 AST 做改写，generate 把 AST 打回代码并生成 sourcemap。parse 内部还分词法分析和语法分析两步，transformer 用的是 visitor 模式——**一次遍历，所有插件同时收到节点通知**，不是每个插件遍历一遍。
>
> 但真正容易答错的是它的边界。我实测过，`targets: ie 11` 的情况下：
>
> - `obj?.a` 会被展开成 `(_obj = obj) === null || _obj === void 0 ? void 0 : _obj.a`
> - 但 `Promise`、`Array.prototype.includes`、`Object.assign` **全部原样保留**
>
> 因为语法是『怎么写』，API 是『有没有』。改写法是文本替换，改有无必须往全局注入实现——那是 core-js 干的活。所以完整的兼容方案是 **Babel 转语法 + core-js 补 API**，两者缺一不可。
>
> 另外有两个工程细节：如果不配 `transform-runtime`，每个文件都会内联一份 helper，100 个文件用了 class 就有 100 份 `_classCallCheck`；`async/await` 的 regenerator-runtime 有几千字节，用得多一定要抽出来。
>
> 最后，**Babel 8 移除了 `useBuiltIns` 和 `bugfixes`**，网上大量老教程直接会报错，现在要用 `babel-plugin-polyfill-corejs3`。」

---

## 4.10 追问链

| 追问 | 答法 |
|---|---|
| Babel 和 TypeScript 有什么关系？ | TS 的 `tsc` 也能把 TS 转成 JS，但**只做类型擦除 + 语法降级，不做 polyfill**。实际项目常用「tsc 只做类型检查 + Babel/SWC 做转译」，因为 Babel 生态的插件更全 |
| Babel 和 SWC 的区别？ | SWC 是 Rust 实现，快 20 倍左右。**API 兼容 Babel 的插件吗？不完全兼容**——大部分 preset 有对应实现，但自研插件要重写 |
| `@babel/preset-env` 怎么知道要转什么？ | 靠 **browserslist**（读 `package.json` 的 `browserslist` 或 `.browserslistrc`），再查 `caniuse` 和 `@babel/compat-data` 的兼容表，算出「哪些特性目标环境不支持」 |
| `targets: 'esmodules'` 是什么？ | 一个特殊值，表示「所有支持 `<script type="module">` 的浏览器」。**这是「现代浏览器构建」的推荐配置**——能保留大量新语法，产物小很多 |
| 为什么 `modules: false`？ | 保留 ESM 语法，让打包器（webpack/Rollup）去做模块处理。**如果让 Babel 转了 CJS，tree shaking 就废了**（因为 CJS 是动态的，静态分析不了） |
| Babel 插件能改 import 路径吗？ | 能。`visitor: { ImportDeclaration(path) { path.node.source.value = '...' } }`。但注意要同步改 `path.node.source.extra.raw`，否则打印时用的还是旧字符串 |
| 怎么调试 Babel 插件？ | ① [AST Explorer](https://astexplorer.net) 在线看 AST；② `console.log(path.node)`；③ `@babel/parser` 单独解析看结构 |
| Babel 的 `preset` 和 `plugin` 关系？ | preset 就是「一组配置好的 plugin + 它们的 options」。`@babel/preset-env` 内部有 100+ 个 transform 插件，按 target 动态启用 |
| 什么情况下 Babel 会「转错」？ | ① 依赖 `Function.prototype.toString()` 的代码（转完字符串变了）；② 依赖函数名/参数名的（`fn.length`）；③ 自定义的 `class` 继承内建对象（`class X extends Array`，转成 ES5 后行为不对） |
| 现在还需要 Babel 吗？ | 需要，但角色变了。**新项目可以只用 SWC/esbuild 做转译**，Babel 留给「需要特定插件」的场景（比如 `babel-plugin-import` 做按需加载、`babel-plugin-styled-components`） |

---

## 4.11 速记卡

```
【一句话】
Babel 只转语法，不转 API
语法 = 怎么写；API = 有没有
改写法是文本替换，改有無要注入全局实现（core-js）

【三阶段】
parse（词法 → Token → 语法 → AST）
transform（visitor 模式，一次遍历所有插件收到通知）
generate（打印 AST + 生成 sourcemap）
实测顺序：pre → Program.enter → 各节点 → post

【path 对象】
path.node / parent / scope / replaceWith / remove / skip / stop
path.scope 最强：能查变量绑定

【实测降级结果】
obj?.a  → (_obj = obj) === null || _obj === void 0 ? void 0 : _obj.a
用 void 0 不用 undefined（防被篡改）
模板字符串 → "a".concat(b, "c")
async/await → 内联 regenerator-runtime（几千字节！）
helper 会重复注入 → 要配 @babel/plugin-transform-runtime

【实测：8 个 API 全部保留】
Promise / includes / Array.from / Object.assign
padStart / globalThis / Symbol / Map  → IE11 全会挂

【Babel 8 破坏性变更】
useBuiltIns 移除 → 改用 babel-plugin-polyfill-corejs3
bugfixes 移除 → 总是启用
写库要用 usage-pure（不污染全局）

【顺序】
plugins 先于 presets；同类内部从后往前

【AST 三大用途】
Babel → 改写；ESLint → 只读检查；Prettier → 丢弃格式重新打印
Prettier 不保留空行，因为空行不在 AST 里

【写插件的坑】
console.log 是语句时删整句，是表达式时替换成 undefined
```

---

## 4.12 自测

```
□ 能用「语法 vs API」一句话说清 Babel 的边界
□ 能说出 parse 内部还分词法和语法两步
□ 能说出 visitor 模式相比自己递归的优势
□ 能说出 path 和 node 的区别，以及 path.scope 能做什么
□ 能解释为什么生成 void 0 而不是 undefined
□ 能说出 helper 重复注入的问题和解法
□ 能说出 3 个 Babel 转不了的 API
□ 能解释为什么 Babel 不能转 API（全局注入 vs 文本替换）
□ 能说出 Babel 8 移除了哪两个选项、替代方案是什么
□ 能说出 usage-pure 和 usage-global 的区别、为什么写库要用 pure
□ 能说出 plugins 和 presets 的执行顺序
□ 能解释为什么 Prettier 不保留你的空行
□ 能写出删除 console 的插件，并指出「表达式 vs 语句」的坑
□ 能说出 modules: false 的原因（保住 tree shaking）
```
