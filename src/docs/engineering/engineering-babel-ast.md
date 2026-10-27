# 工程化 04｜Babel 与 AST

> 覆盖题号：2（babel 是怎么编译高级 js 的）

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

三阶段正确，但只覆盖了流程；追问集中在这四项：

1. **三阶段内部到底在做什么**（词法/语法分析、visitor 模式、sourcemap）
2. **Babel 不能做什么**（`Promise` 为什么没被转）
3. **preset 和 plugin 的执行顺序**（与书写顺序不完全一致）
4. **polyfill 和 transform 的区别**

---

## 4.2 一句话结论

> **Babel 只做「语法降级」，不做「API 降级」。**

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

内部还有两步：

```
源码字符串
  ↓ 词法分析（Lexer / Tokenizer）
Token 流：[{type:'Keyword',value:'const'}, {type:'Identifier',value:'a'}, ...]
  ↓ 语法分析（Parser）
AST（抽象语法树）
```

解析器是 `@babel/parser`（早期从 acorn fork，现独立维护）。`var a = 1 + 2;` 的实际输出（有删减）：

```json
{
  "type": "Program",
  "body": [{
    "type": "VariableDeclaration",
    "kind": "var",
    "start": 0,
    "end": 14,
    "declarations": [{
      "type": "VariableDeclarator",
      "id": { "type": "Identifier", "name": "a" },
      "init": {
        "type": "BinaryExpression",
        "operator": "+",
        "left":  { "type": "NumericLiteral", "value": 1, "extra": { "raw": "1" } },
        "right": { "type": "NumericLiteral", "value": 2, "extra": { "raw": "2" } }
      }
    }],
    "loc": { "start": { "line": 1, "column": 0 }, "end": { "line": 1, "column": 14 } }
  }]
}
```

**关键点**：

- 每个节点都有 `type`，这是一切工具的分发依据
- 默认带 `start` / `end` / `loc`；`range` 要显式开 `ranges: true`
- 同一段代码，espree 把数字记为 `Literal`，Babel 记为 `NumericLiteral`——节点命名随解析器不同，跨工具比对不能按字面
- 这棵树是**纯数据**，可以任意增删改

### ② Transform（转换）：遍历 AST，改它

```js
babel.transformSync(code, {
  plugins: [{
    visitor: {
      ArrowFunctionExpression(path) { /* 遇到箭头函数就改 */ },
      Identifier(path) { /* 遇到标识符就改 */ },
    },
  }],
});
```

visitor 解决的是「遍历逻辑由谁写」：

| 自己递归 | visitor 模式 |
|---|---|
| 每个插件写一遍遍历逻辑 | 框架遍历，按节点类型分发 |
| 容易漏节点类型 | 节点类型由框架覆盖 |
| 遍历顺序自己控制 | `enter` / `exit` 区分进入与离开 |

所有插件的 visitor 会被合并成一棵 visitor 树，**一次深度优先遍历**（`@babel/core` 中先 `traverse.visitors.merge`，再单次 `traverse`），遍历开销不随插件数量线性增长。

**`path` 对象**（不是 `node`）才是操作核心：

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

`path.scope` 能回答「这个变量从哪来、有没有被重新赋值」，这是做安全转换的前提（例如把 `const` 改成 `var` 时判断是否需要 IIFE 隔离）。

**插件生命周期与遍历顺序**：

```
pre（parse 之后、遍历之前）
  → Program.enter → 各节点 enter / exit
  → post（遍历之后、generate 之前）
```

`pre` 拿到的是已解析的 AST，不是源码字符串；`post` 在生成代码之前执行，因此 `post` 里对 AST 的修改仍会进入输出。

### ③ Generate（生成）：AST → 新代码

用 `@babel/generator`：

- 深度优先打印每个节点
- 生成 sourcemap：每个节点有 `loc`，新代码的每个位置都能映射回原位置

sourcemap 的本质是一张映射表 `[生成行, 生成列] → [源文件, 源行, 源列]`；Babel 在打印节点时记录映射，拼成 VLQ 编码的 `mappings` 字符串。

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
| **解构** | `const [a, ...r] = arr;` | 引入 `_toArray` / `_arrayWithHoles` / `_iterableToArray` 等 helper |
| **class** | `class A { constructor() { this.x = 1; } }` | 引入 `_classCallCheck` / `_createClass` 等 helper |
| **async/await** | `async function f() { await g(); }` | 引入 regenerator helper |
| **展开运算符** | `const o = { ...a, b: 1 };` | 引入 `_objectSpread` 等 helper |
| **for...of** | `for (const x of arr) {...}` | 引入 `_createForOfIteratorHelper` |

### ① `void 0` 而不是 `undefined`

```js
_obj === void 0        // 而不是 _obj === undefined
```

`undefined` 在老浏览器里可以被赋值（非严格模式下 `undefined = 1` 合法）。`void 0` 永远返回真正的 `undefined`，无法被篡改。

### ② helper 会重复注入

不配 `@babel/plugin-transform-runtime` 时，**每个文件都会内联一份 helper**：100 个文件用到 class，就有 100 份 `_classCallCheck`。

```js
// 配了 transform-runtime 之后
var _classCallCheck2 = require("@babel/runtime/helpers/classCallCheck");
```

### ③ async/await 的 helper 体积最大

regenerator 相关 helper 是这组降级里最大的一块，所以：

- 用得多时配 `transform-runtime` 抽成共享模块
- target 设到 `es2017` 及以上，preset-env 就不再转 async/await

---

## 4.5 实测：Babel 不转 API

`targets: { ie: '11' }` 下，8 个 API 全部原样保留：

```
Promise          → new Promise(function (r) { return r(1); });   ← 箭头函数转了，Promise 没转
Array.includes   → arr.includes(1);
Array.from       → Array.from(x);
Object.assign    → Object.assign({}, a);
String.padStart  → s.padStart(3, '0');
globalThis       → globalThis.x = 1;
Symbol           → Symbol("k");
Map              → new Map();
```

第一行同时包含两类改动：`new Promise(r => r(1))` 里的箭头函数被转成 `function`，`Promise` 本身没有被替换。**同一个表达式里，语法部分被改写，API 部分原样保留。**

### 为什么 Babel 不能转 API

API 是运行时能力，替换它等于往全局环境注入实现：

```js
if (typeof Promise === 'undefined') {
  window.Promise = /* 一整个 Promise polyfill */;
}
```

这是对全局环境的写操作，会影响同环境下的其他代码，并且需要额外加载 polyfill 代码；语法转换只改当前文件里的代码，改完就能跑。所以前者归 core-js，后者归 Babel 的 transform 插件。

### polyfill 的三种引入方式（历史演进）

| 方式 | 配置 | 特点 |
|---|---|---|
| **全量引入**（最老） | `import '@babel/polyfill'` | 一次引入全部，**体积巨大**，已废弃 |
| **按需引入** | `useBuiltIns: 'usage'` + `corejs: 3` | 分析代码用了哪些 API，只 import 对应 polyfill |
| **入口引入** | `useBuiltIns: 'entry'` | 在入口 import `core-js/stable`，按 target 裁剪 |

> **Babel 8 的破坏性变更**：preset-env 移除了 `useBuiltIns` 与 `corejs`，`bugfixes` 也移除（总是启用）。网上大量「配 `useBuiltIns: 'usage'`」的教程在 Babel 8 上会直接报错，polyfill 改由 `babel-plugin-polyfill-corejs3` 注入。

**现代配置**：

```js
// babel.config.js（Babel 8）
module.exports = {
  presets: [['@babel/preset-env', { targets: '> 0.5%, not dead', modules: false }]],
  plugins: [
    ['babel-plugin-polyfill-corejs3', { method: 'usage-pure' }], // ← 替代 useBuiltIns
    '@babel/plugin-transform-runtime',
  ],
};
```

**`usage-pure` 与 `usage-global` 的区别**：

- `usage-global`：往全局打补丁（`Array.prototype.includes = ...`），影响同环境所有代码
- `usage-pure`：不污染全局，在用到的地方 `import` 一个函数（`core-js-pure/...`）

**写库必须用 `pure`**，否则会污染使用方的环境。

---

## 4.6 preset 与 plugin 的执行顺序（跟直觉相反）

> **plugins 先于 presets 执行；plugins 按书写顺序正序执行，presets 逆序执行。**

```js
module.exports = {
  presets: ['@babel/preset-env', '@babel/preset-react'],
  plugins: ['@babel/plugin-transform-arrow-functions', 'my-plugin'],
};
```

**执行顺序**：

```
① plugins 正序：transform-arrow-functions → my-plugin
② presets 逆序：preset-react → preset-env
```

容易记错的是 plugin 这一侧：**只有 preset 逆序，plugin 不逆序**。

实操上不要依赖顺序表达优先级，用 `@babel/preset-env` 的 `targets` 控制启用范围；确实需要分层时再拆成多个 preset。

---

## 4.7 AST 的三种用途（理解这个就理解了整个工具链）

AST 不只是 Babel 的中间产物，**它是所有代码工具的公共底座**：

| 工具类型 | 代表 | 怎么用 AST |
|---|---|---|
| **编译/降级** | Babel、TypeScript、SWC | 源码 → AST → 改写 → 新代码 |
| **检查（Lint）** | ESLint、Stylelint | 源码 → AST → **只读遍历**找问题 |
| **格式化** | Prettier | 源码 → AST → **重新打印**（丢掉原有格式） |
| **打包分析** | webpack、Rollup | 源码 → AST → 找 `import`/`require` |
| **重构工具** | jscodeshift、codemod | 源码 → AST → 批量改写 |
| **代码高亮** | Shiki、Prism | 源码 → Token 流（不一定要完整 AST） |

其中三个常被当成独立工具的产品，差别只在流水线的最后一步：

- Babel：AST → 改写 → 输出新代码
- ESLint：AST → 遍历 → 报告问题（**不改代码**）
- Prettier：AST → **丢弃原有格式信息** → 按自己的规则重新打印

Prettier 不保留空行，是因为空行通常不在 AST 里；它与 ESLint 的冲突，来自对同一棵 AST 做了不同的输出决策。

### 手写一条 Lint 规则

用 `espree` 解析，自己深度优先遍历：

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

输出：

```
✗ 第 1 行：不允许使用 var，请用 let/const
✗ 第 3 行：不允许使用 var，请用 let/const
```

再加一条等价于 `eqeqeq` 的规则：

```js
walk(tree, (n) => {
  if (n.type === 'BinaryExpression' && n.operator === '==') {
    problems.push(`第 ${n.loc.start.line} 行：使用 ==，应为 ===`);
  }
});
```

ESLint 的核心就是遍历 AST、匹配节点类型、报告位置，规则库是这些判断的集合。它看的是语法结构而不是字符，所以字符串里的 `'a == b'` 只是 `Literal`，不会被 `eqeqeq` 命中。

---

## 4.8 手写一个 Babel 插件

「把 `console.log(x)` 全部删掉」是最典型的插件练习，生产环境去 console 用的是同一套逻辑。

```js
module.exports = function removeConsolePlugin() {
  return {
    name: 'remove-console',
    visitor: {
      CallExpression(path) {
        const callee = path.node.callee;

        const isConsoleCall =
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'console';

        if (!isConsoleCall) return;

        // console.error / console.warn 保留（生产也要看错误）
        const method = callee.property.name;
        if (method === 'error' || method === 'warn') return;

        // 语句整句删；表达式的一部分必须替换，不能删
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

**易踩的坑**在于 `console.log` 的父节点类型：

```js
// 情况 A：语句 → 可以整句删
console.log('x');

// 情况 B：表达式的一部分 → 不能删，要替换
const v = console.log('x') || 'default';
if (console.log(a)) { ... }
foo(console.log(b));
```

一律 `path.remove()` 会让情况 B 变成语法错误（`const v = ;`），所以必须先判断 `path.parentPath.isExpressionStatement()`。

---

## 4.9 面试怎么说（2 分钟版）

- **一句话边界**：Babel 只做语法降级，不做 API 降级。语法是写法，改的是 AST；API 是运行时能力，只能由 core-js 这类 polyfill 往全局注入实现。
- **三阶段**：parse 把源码经词法、语法分析变成 AST；transform 把所有插件的 visitor 合并成一次深度优先遍历，操作对象是 `path`；generate 打印 AST 并生成 sourcemap。
- **preset-env**：按 browserslist / `targets` 与兼容数据决定启用哪些 transform；`modules: false` 保留 ESM，交给打包器做 tree shaking。
- **两个工程点**：不配 `transform-runtime` 时 helper 会逐文件重复内联；Babel 8 移除了 preset-env 的 `useBuiltIns` / `bugfixes`，polyfill 改用 `babel-plugin-polyfill-corejs3`。

---

## 4.10 追问链

| 追问 | 答法 |
|---|---|
| Babel 和 TypeScript 有什么关系？ | TS 的 `tsc` 也能把 TS 转成 JS，但**只做类型擦除 + 语法降级，不做 polyfill**。实际项目常用「tsc 只做类型检查 + Babel/SWC 做转译」，因为 Babel 生态的插件更全 |
| Babel 和 SWC 的区别？ | SWC 是 Rust 实现，转译速度通常高于 Babel。**插件不完全兼容**——多数 preset 有对应实现，但自研插件要重写 |
| `@babel/preset-env` 怎么知道要转什么？ | 靠 **browserslist**（读 `package.json` 的 `browserslist` 或 `.browserslistrc`），再查兼容数据（`@babel/compat-data`），算出「哪些特性目标环境不支持」 |
| `targets: 'esmodules'` 是什么？ | 一个特殊值，表示「所有支持 `<script type="module">` 的浏览器」。**这是「现代浏览器构建」的推荐配置**——能保留大量新语法，产物小很多 |
| 为什么 `modules: false`？ | 保留 ESM 语法，让打包器（webpack/Rollup）去做模块处理。**如果让 Babel 转了 CJS，tree shaking 就废了**（CJS 是动态的，静态分析不了） |
| Babel 插件能改 import 路径吗？ | 能。`visitor: { ImportDeclaration(path) { path.node.source.value = '...' } }`。但注意要同步改 `path.node.source.extra.raw`，否则打印时用的还是旧字符串 |
| 怎么调试 Babel 插件？ | ① [AST Explorer](https://astexplorer.net) 在线看 AST；② `console.log(path.node)`；③ `@babel/parser` 单独解析看结构 |
| Babel 的 `preset` 和 `plugin` 关系？ | preset 就是「一组配置好的 plugin + 它们的 options」。`@babel/preset-env` 内含大量 transform 插件，按 target 动态启用 |
| 什么情况下 Babel 会「转错」？ | ① 依赖 `Function.prototype.toString()` 的代码（转完字符串变了）；② 依赖函数名/参数名的（`fn.length`）；③ 自定义的 `class` 继承内建对象（`class X extends Array`，转成 ES5 后行为不对） |
| 现在还需要 Babel 吗？ | 需要，但角色变了。**新项目可以只用 SWC/esbuild 做转译**，Babel 留给「需要特定插件」的场景（比如 `babel-plugin-import` 做按需加载、`babel-plugin-styled-components`） |

---

## 4.11 速记卡

```
【边界】
Babel 改写法（改 AST）；core-js 补有无（注入全局实现）

【顺序】
plugins 正序 → presets 逆序；plugins 整体先于 presets

【AST 节点】
Babel: NumericLiteral；espree: Literal
默认有 start/end/loc，range 需 ranges: true

【生命周期】
pre → Program.enter → 各节点 → post → generate

【降级细节】
void 0 替代 undefined，防被篡改
helper 逐文件重复 → transform-runtime 抽取

【polyfill】
Babel 8 移除 useBuiltIns / corejs / bugfixes
→ babel-plugin-polyfill-corejs3；写库用 usage-pure

【AST 三大用途】
Babel 改写；ESLint 只读检查；Prettier 丢格式重打印

【插件坑】
console.log 是语句删整句，是表达式替换成 undefined
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
□ 能解释为什么 Babel 不能转 API（全局注入 vs 文本替换）
□ 能说出 Babel 8 移除了哪些选项、替代方案是什么
□ 能说出 usage-pure 和 usage-global 的区别、为什么写库要用 pure
□ 能说出 plugins 和 presets 的执行顺序
□ 能解释为什么 Prettier 不保留空行
□ 能写出删除 console 的插件，并指出「表达式 vs 语句」的坑
□ 能说出 modules: false 的原因（保住 tree shaking）
```
