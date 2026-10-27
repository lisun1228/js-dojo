# 工程化 05｜产物优化与 Tree Shaking

> 覆盖题号：20（什么是 tree shaking）、30（tree shaking 原理）、16（bundle 为什么越来越大，怎么优化）
> 去重后：**2 个考点**（tree shaking 原理 + 产物体积优化）

---

## 目录

- [5.1 题单答案的问题](#51-题单答案的问题)
- [5.2 一句话结论](#52-一句话结论)
- [5.3 实测：Tree Shaking 的四个阶段](#53-实测tree-shaking-的四个阶段)
- [5.4 为什么 CJS 不能 Tree Shaking](#54-为什么-cjs-不能-tree-shaking)
- [5.5 `sideEffects` 是最容易出事的地方](#55-sideeffects-是最容易出事的地方)
- [5.6 bundle 为什么越来越大](#56-bundle-为什么越来越大)
- [5.7 代码分割：三个层次](#57-代码分割三个层次)
- [5.8 面试怎么说（2 分钟版）](#58-面试怎么说2-分钟版)
- [5.9 追问链](#59-追问链)
- [5.10 速记卡](#510-速记卡)
- [5.11 自测](#511-自测)

---

## 5.1 题单答案的问题

> **20.** 删除未使用的代码。基于 ES Module 静态分析，生产模式自动开启。CommonJS 不支持。
>
> **30.** 同第20题。

四句话各自缺的部分：

| 题单说的 | 缺什么 |
|---|---|
| 「删除未使用的代码」 | 删除发生在哪一步：分析是打包器做的，webpack 下真正删代码的是 Terser |
| 「基于 ESM 静态分析」 | 为什么 CJS 不行——`require` 是**运行时**求值 |
| 「生产模式自动开启」 | 自动开的是 `usedExports` 标记和 `minimize` 两件事，后者才删代码 |
| 「CommonJS 不支持」 | 不准确：`exports.x = fn` 这类规整形态，Rollup/Rolldown 能摇（见 5.4） |

---

## 5.2 一句话结论

> Tree shaking = **静态分析算出「哪些导出没被用到」 + 把它删掉**。
>
> 分析与删除是两个步骤，但两步由谁做取决于打包器：webpack 只标记、删除落在压缩阶段；Rollup/Rolldown 在打包阶段就删（5.3 实测）。

---

## 5.3 实测：Tree Shaking 的四个阶段

### 实验设计

三个导出都没被使用：`unusedFn` 被 import 但没有读取，`square`、`unusedGreet` 没被 import。

```js
// src/index.js
import { add, unusedFn } from './math.js';
import { greet } from './string.js';
import './polyfill.js';                 // 只有副作用，没有导出
console.log(add(1, 2));
console.log(greet('world'));

// src/math.js
export function add(a, b) { return a + b; }
export function unusedFn() { return 'I am never called'; }
export function square(x) { return x * x; }

// src/string.js
export function greet(name) { return `hi ${name}`; }
export function unusedGreet() { return 'never used'; }

// src/polyfill.js
console.log('[polyfill] executed');
Array.prototype.myIncludes = function (x) { return this.indexOf(x) !== -1; };
```

### 四组配置与结果

Rolldown 1.2.13，`format: 'esm'`，无 banner：

| # | 配置 | 产物 | `unusedFn`/`square`/`unusedGreet` | polyfill 副作用 |
|---|---|---|---|---|
| b1 | 默认 `treeshake`，`minify: false` | **399 B** | 全被删除 | 保留 |
| b2 | b1 + `minify` | **204 B** | 全被删除 | 保留 |
| b3 | `treeshake.moduleSideEffects: false` | **246 B** | 全被删除 | **被删除** |
| b4 | b3 + `minify` | **101 B** | 全被删除 | **被删除** |

### 关键发现 ①：未使用的导出在打包阶段就没了

b1 没有压缩，产物里已经找不到三个未使用函数，只剩用到的两个（省略 `//#region` 分隔注释）：

```js
function add(a, b) {
  return a + b;
}
function greet(name) {
  return `hi ${name}`;
}
console.log(add(1, 2));
console.log(greet("world"));
```

Rolldown/Rollup 在生成 chunk 时就删除。**webpack 5 不同**：开 `usedExports` 后只在产物里插入 `/* unused harmony export unusedFn */` 这类注释，函数体保留，要等 Terser 才消失（webpack 侧行为按其文档描述，本仓库只有 Rolldown，未复测）。

webpack 只标记不删的原因：删除是不可回退的优化，判断错（例如导出被动态访问）就是线上事故；标记错了只是多留代码，删除交给本来就在做 DCE 的压缩器。

### 关键发现 ②：`sideEffects` 决定整个模块能不能跳过

`import './polyfill.js'` 没有任何导出被使用。b1 仍保留它——默认假设模块有副作用；b3 把 `moduleSideEffects` 设为 `false` 后整段消失（399 → 246 B），`Array.prototype.myIncludes` 也就不存在了。同一开关在库侧写作 `package.json` 的 `sideEffects` 字段，用于 `node_modules` 里的包（5.5 实测）。

scope hoisting 是另一件事：它只去掉模块外壳（webpack 的 `concatenateModules`），不删任何导出。Rolldown 的产物本身就是单个作用域，没有 `__webpack_require__` 这类模块运行时。

### 关键发现 ③：`minify` 只做压缩

b2 相对 b1 少的 195 B、b4 相对 b3 少的 145 B，全部来自压缩（去空白、改短变量名），没有额外的删除动作。压缩器在这之外还会做常量折叠、模板字符串折叠，但不影响哪些模块被包含。

### 结论：Tree Shaking 的四个必要条件

```
① 源码是 ESM（静态结构，读语法树就能算依赖）
   ↓
② 算出「哪些导出没被用到」→ 删除（Rolldown/Rollup）或标记（webpack 的 usedExports）
   ↓
③ sideEffects / moduleSideEffects 决定「没有导出被使用的模块」能否整块跳过
   ↓
④ 压缩（webpack 必须靠 Terser 才真正删；Rolldown/Rollup 里只影响体积）
```

webpack 下四步缺一不可，最常见的「没生效」就是 `minimize: false`——标记不产生删除。Rolldown/Rollup 下第②步在打包阶段完成，关掉压缩照样能删掉未使用导出（b1 与 b2 都只剩两个函数）。

---

## 5.4 为什么 CJS 不能 Tree Shaking

```js
// ESM：静态的
import { add } from './math.js';
```

```js
// CJS：动态的
const { add } = require('./math.js');
```

### ESM 为什么能静态分析

| 特征 | 说明 |
|---|---|
| `import` 必须在**顶层** | 不能放在 `if` 里、函数里 |
| 路径必须是**字符串字面量** | 不能拼接（`import('./' + name)` 是动态 import，另算） |
| 导出是**声明式**的 | `export function add` 直接写在语法里 |
| **没有运行时求值** | 解析 import 语句不需要执行任何代码 |

打包器只需要读语法树就能拿到完整的依赖关系。

### CJS 为什么不能

```js
const name = process.env.NODE_ENV === 'production' ? './prod.js' : './dev.js';
const mod = require(name);                          // ← 路径运行时才算得出来

if (someCondition) {
  require('./optional-feature.js');                 // ← 条件加载
}

module.exports = someFunction();                    // ← 导出什么运行时才知道
```

打包器要执行代码才知道会加载什么，只能保守地全部保留。

### 那为什么 Rollup 对 CJS 有时也能 shake

因为很多 CJS 是 Babel 从 ESM 转出来的，形态规整：

```js
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.add = add;
function add(a, b) { return a + b; }
```

Rolldown 1.2.13 实测：入口 `import { add } from './cjs-math.cjs'`，`exports.add = ...` / `exports.unused = ...` 的写法产物 378 B，`unused` 已被删；换成 `Object.assign(exports, { add, unused })` 后产物 481 B，`unused` 原样保留。这是模式匹配，不是语言保证。

准确的说法：CJS 不是「绝对不能」，是「不能可靠地」。ESM 的静态性由语言层面保证，CJS 靠工具猜；所以库要同时提供 ESM 产物（`module` 字段或 `exports.import`，见 5.9）。

---

## 5.5 `sideEffects` 是最容易出事的地方

### 为什么需要它

```js
// index.js
import './polyfill.js';       // 只为了副作用：修改 Array.prototype
import './style.css';         // 只为了副作用：注入样式

// polyfill.js
console.log('[polyfill] executed');
Array.prototype.myIncludes = function (x) { return this.indexOf(x) !== -1; };
```

这两个 import 都没有「使用导出」。只看导出使用情况，模块会被判定为无用而删掉，`Array.prototype.myIncludes` 随之消失，运行时是 `TypeError`。

`sideEffects` 字段就是给打包器的声明：这个模块有副作用，即使没人用它的导出也不能删。

### 实测：三组 package.json

包 `side-demo` 的 `index.js` 只有上面两行副作用代码，入口为 `import { add } from './math.js'; import 'side-demo';`，Rolldown 1.2.13、不压缩：

| 配置 | 产物 | polyfill |
|---|---|---|
| 不写 `sideEffects` | **306 B** | 保留（默认假设有副作用） |
| `"sideEffects": false` | **137 B** | **整段删除** |
| `"sideEffects": ["./index.js"]` | **306 B** | 保留 |

`sideEffects: false` 的产物只剩业务代码：

```js
function add(a, b) { return a + b; }
console.log(add(1, 2));
```

到浏览器里就是 `TypeError: [].myIncludes is not a function`。`false` 的含义是「这个包的所有模块都没有副作用」，只要包里有一个 polyfill、样式或全局注册，写 `false` 就是错的。

### 什么时候必须写 `sideEffects: false`

| 场景 | 该不该写 |
|---|---|
| **业务应用**（自己构建、自己用） | 写，但必须用白名单列出 css、polyfill、全局注册 |
| **UI 组件库** | 写，且用白名单排出样式文件（`@vue/*`、`antd` 都这样做） |
| **工具库（纯函数）** | 放心写 `false` |
| **有任何模块顶层副作用的库** | 用白名单，不要写 `false` |

常见的「会被误删」的文件：

```
*.css / *.scss        ← 样式注入
*.polyfill.js         ← 原型方法扩展
src/setup.js          ← 全局注册（app.use、Vue.prototype.$xxx）
src/global.d.ts       ← 只有类型，不产出代码，无所谓
```

---

## 5.6 bundle 为什么越来越大

题单给的原因只有「依赖增多、代码没拆分」两条，优化项也只有动作、没有代价。按出现频率拆开：

### 六个真实原因

| # | 原因 | 怎么确认 | 典型体积 |
|---|---|---|---|
| 1 | **引入了完整 UI 库** | 看 bundle 里 `antd`/`element-plus` 占比 | 几百 KB ~ 1 MB+ |
| 2 | **`moment`/`lodash` 全量引入** | `moment` 带全部 locale 约 230 KB | 200 KB+ |
| 3 | **图标库全量引入** | `import * as Icons from '@ant-design/icons'` | 1 MB+ |
| 4 | **sourcemap 被打进产物** | 检查 `.map` 是否被误引入 | —— |
| 5 | **重复依赖**（同一库多个版本） | `npm ls react` 出现多个版本 | 每份 ×N |
| 6 | **没做代码分割**（所有页面一个 bundle） | bundle 数与路由数对比 | 与页面数成正比 |

### 定位手段

先看现状，再改配置。

```bash
# webpack：生成统计文件
npx webpack --profile --json > stats.json
# 拖进 https://webpack.github.io/analyse/ 或 https://chrisbateman.github.io/webpack-visualizer/
```

```js
// vite.config.js —— rollup-plugin-visualizer 同样适用于 Vite
import { visualizer } from 'rollup-plugin-visualizer';
export default { plugins: [visualizer({ open: true, gzipSize: true })] };
```

产物是 treemap：哪个包占多少面积一眼可见。按「占用面积 × 可优化性」排序；前几名常常是根本不该出现的依赖（重复的 lodash 版本、整个图标库），先删不该有的，再优化该有的。

### 优化手段与代价

| 手段 | 收益 | 代价 / 风险 | 优先级 |
|---|---|---|---|
| **按需引入 UI 库** | 极大（全量 → 只打进用到的组件） | 需要配插件（`babel-plugin-import` / `unplugin-vue-components`） | ⭐⭐⭐⭐⭐ |
| **替换重库** | 大（`moment` 230 KB → `dayjs` 2 KB） | 要改代码，注意 API 差异 | ⭐⭐⭐⭐⭐ |
| **路由级代码分割** | 大（首屏只加载当前路由） | 需要 `import()`，注意 loading 态 | ⭐⭐⭐⭐⭐ |
| **`splitChunks` 拆 vendor** | 中（利用缓存） | 多几个请求 | ⭐⭐⭐⭐ |
| **Tree Shaking + `sideEffects`** | 中 | 有误删风险（5.5 三组实验） | ⭐⭐⭐⭐ |
| **`externals` 走 CDN** | 大（bundle 里没有 React/Vue） | 依赖 CDN 可用性，失去版本锁定 | ⭐⭐⭐ |
| **图片压缩 / 转 WebP** | 大（但有上限） | 需要构建流程支持 | ⭐⭐⭐⭐ |
| **压缩 + gzip/brotli** | 中 | 服务器要配 | ⭐⭐⭐⭐⭐ |
| **删 sourcemap** | 大 | 失去线上排查能力 | ⭐⭐ |

sourcemap 不该直接关：用 `hidden-source-map`，产物里不带 `//# sourceMappingURL`，map 上传到 Sentry，既不暴露源码又能定位错误。

### gzip/brotli 没配

```nginx
gzip on;
gzip_types text/css application/javascript application/json image/svg+xml;
gzip_min_length 1024;
gzip_comp_level 6;

brotli on;   # 需要模块
brotli_types text/css application/javascript application/json image/svg+xml;
brotli_comp_level 6;
```

经验值：1 MB 的 JS 传到浏览器约 250 KB（brotli 更小）。看到的「bundle 大小」和用户实际下载量相差约 4 倍，优化前先确认压缩开着——这一步成本最低。

---

## 5.7 代码分割：三个层次

| 层次 | 做法 | 效果 |
|---|---|---|
| **入口分割** | 多 entry（MPA） | 每个页面独立 bundle |
| **路由分割** | `import()` 动态导入路由组件 | 首屏只加载当前路由 |
| **模块分割** | `splitChunks` 把公共依赖抽出来 | 多个 chunk 共享，利用缓存 |

### `splitChunks` 的默认行为（webpack 5）

```js
splitChunks: {
  chunks: 'async',        // 默认只对异步 chunk 分割
  minSize: 20000,         // 小于 20KB 不拆
  cacheGroups: {
    defaultVendors: { test: /[\\/]node_modules[\\/]/, priority: -10, reuseExistingChunk: true },
    default: { minChunks: 2, priority: -20, reuseExistingChunk: true },
  },
}
```

默认 `chunks: 'async'` 意味着**同步 import 的 node_modules 不会自动拆**，要拆全部得改成 `'all'`。

### 一个实用的 `splitChunks` 配置

```js
splitChunks: {
  chunks: 'all',
  cacheGroups: {
    // ① 框架代码：很少变，单独一个包利用长期缓存
    framework: {
      test: /[\\/]node_modules[\\/](react|react-dom|vue|vue-router|pinia)[\\/]/,
      name: 'framework',
      priority: 40,
      chunks: 'all',
    },
    // ② 大体积的第三方库
    libs: {
      test: /[\\/]node_modules[\\/]/,
      name: 'libs',
      priority: 30,
      chunks: 'all',
      minSize: 30000,
    },
    // ③ 业务公共组件
    common: { name: 'common', minChunks: 2, priority: 10, chunks: 'all', reuseExistingChunk: true },
  },
}
```

分层原则：**变化频率越低的，越应该单独成包**。

| 层 | 变化频率 | 缓存策略 |
|---|---|---|
| framework（React/Vue） | 几乎不变（升级才变） | 长期缓存 `max-age=31536000, immutable` |
| libs（其他三方） | 偶尔变（加依赖才变） | 长期缓存 |
| common（业务公共） | 经常变 | 中等缓存 |
| 页面 chunk | 每次发版都变 | 短缓存 + `[contenthash]` |

`[contenthash]` 保证内容不变就不换文件名，这是长期缓存能生效的前提。

---

## 5.8 面试怎么说（2 分钟版）

### Tree Shaking

- 本质是**用「副作用是否可判定」换体积**：ESM 是静态声明，打包器读语法树就能画出依赖图；CJS 的 `require` 运行时求值，只能全保留。
- `usedExports` 按导出标记使用情况；webpack 只加注释，真正的删除落在 Terser，所以 `minimize: false` 时看不到任何删除。
- Rollup/Rolldown 在打包阶段就删掉未使用导出：同一份源码，不压缩 399 B 里已经没有未使用函数，开 `minify` 只是压到 204 B。
- `sideEffects` 是模块级的「能否整块跳过」；`import './polyfill.js'` 没有任何导出被使用，标错就直接删掉，运行时报 `TypeError`。包侧写 `false` 时，产物从 306 B 变成 137 B，polyfill 一起没了。
- 结论：「生产模式自动开启 tree shaking」要拆开看——自动开的是标记与压缩，删除与否取决于压缩器或打包器。

### bundle 变大

- 先定位再优化：`rollup-plugin-visualizer` 或 `webpack --json` 出 treemap，按面积 × 可优化性排序，先删不该出现的依赖。
- 再按性价比动手：替换重库 → UI 库/图标库按需引入 → 路由级分割 → `splitChunks` 按变化频率分层。
- 最后确认服务端 gzip/brotli 已开启，否则测到的所有体积数字都失真。

---

## 5.9 追问链

| 追问 | 答法 |
|---|---|
| `usedExports` 和 `sideEffects` 区别？ | `usedExports` 是**导出级**（这个 `export` 有没有被 import）；`sideEffects` 是**模块级**（这个模块能不能整个跳过） |
| 为什么 webpack 的 `usedExports` 不直接删代码？ | 删除是危险操作，webpack 只做保守标记，删除交给已在做 DCE 的压缩器；标错了也不会造成事故 |
| scope hoisting 是什么？ | 把多个模块的代码拼到一个作用域，去掉模块外壳和 `__webpack_require__` 调用。要求模块是 ESM 且没有循环依赖 |
| scope hoisting 有什么限制？ | ① 必须是 ESM；② 不能有循环依赖（拼接顺序无法确定）；③ 会改变变量作用域，边界情况下 webpack 会保守跳过 |
| tree shaking 后代码真的完全不执行吗？ | 是。被摇掉的模块连顶层代码都不会执行，所以「为了副作用而 import」必须靠 `sideEffects` 保住 |
| 为什么组件库要提供 ESM 产物？ | CJS 产物只能靠模式匹配，不可靠。看 `package.json` 的 `module` 字段或 `exports` 的 `import` 条件 |
| `exports` 字段和 `main`/`module` 的关系？ | `exports` 是新标准，按条件决定用哪个文件，优先级高于 `main`/`module`；配错会出现「明明有 ESM 产物却加载了 CJS」 |
| 怎么验证 tree shaking 生效了？ | ① 在产物里搜函数名；② 用 visualizer 看模块是否还在 treemap；③ 给「应该被摇掉」的模块顶层加 `console.log`，看运行时是否打印 |
| `import * as X` 会影响 tree shaking 吗？ | 取决于打包器：Rolldown 实测 `import * as math` 后只用 `math.add`，未使用导出仍被删除，命名空间被拍平成直接调用；webpack 侧更保守，文档建议用具名导入。**能具名导入就具名导入** |
| 动态 `import()` 的 chunk 也能 tree shaking 吗？ | 能，每个异步 chunk 独立分析 |
| `externals` 和 `splitChunks` 区别？ | `externals` 是**不打包**（从全局变量/CDN 拿）；`splitChunks` 是**单独打包成一个文件**。前者减小 bundle，但引入外部依赖风险 |
| 微前端能减小首屏体积吗？ | 能，但要付出运行时集成代价（样式隔离、JS 沙箱、通信机制）。只想要代码分割时不需要微前端 |

---

## 5.10 速记卡

```
【Tree Shaking 四条件】
① ESM（静态可分析）
② 分析未使用导出 → Rolldown/Rollup 打包阶段就删；webpack 只加注释 /* unused harmony export */
③ sideEffects → 模块级「能否跳过」，默认 true
④ 压缩 → webpack 靠 Terser 才真正删；Rolldown 只影响体积

【实测（Rolldown 1.2.13，同一份 5.3 源码）】
默认 399B（未使用导出已删，polyfill 保留）
+minify 204B
moduleSideEffects:false 246B（polyfill 被删）
两者都开 101B

【为什么 CJS 不能】
require 运行时求值：路径可拼接、可条件加载、可运行时改 exports
ESM 是语言层保证；CJS 是工具层模式匹配
exports.x = fn 能摇（378B）；Object.assign(exports, {...}) 摇不动（481B，unused 仍在）

【sideEffects 三组（包级，minify 关）】
不写 306B → polyfill 保留
false 137B → polyfill 被删，线上 TypeError
白名单 ["./index.js"] 306B → 保留，其他纯模块仍可摇
必须白名单列出的：*.css / polyfill / 全局注册文件

【bundle 变大六个原因】
UI 库全量 / moment+lodash 全量 / 图标库全量
sourcemap 误入 / 重复依赖多版本 / 没做代码分割

【优化优先级】
① 替换重库（moment → dayjs）
② 按需引入（UI 库 + 图标库）
③ 路由级分割
④ splitChunks 分层（按变化频率）
⑤ 确认 gzip/brotli 开了

【splitChunks】默认 chunks:'async'；要拆同步依赖改 'all'
【sourcemap】别直接关，用 hidden-source-map + 上传 Sentry
```

---

## 5.11 自测

```
□ 能说出 tree shaking 的四个条件，并指出 webpack 与 Rolldown 在第②④步的差别
□ 能说清「滚动的是标记还是删除」：webpack 只标记，Terser 才删
□ 能在关闭压缩的情况下判断产物里还会不会有未使用导出
□ 能解释 scope hoisting 干了什么，以及它为什么不算 tree shaking
□ 能解释 CJS 为什么只能靠模式匹配，并说出哪种 CJS 写法摇不动
□ 能说出 usedExports 和 sideEffects 的层级差别
□ 能描述 sideEffects:false 误删 polyfill 的产物形态与运行时错误
□ 能说出白名单必须包含哪几类文件
□ 能列出 bundle 变大的六个原因
□ 能说出定位体积问题用什么工具、看什么
□ 能按性价比排序至少四个优化手段
□ 能解释 splitChunks 分层为什么要按「变化频率」
□ 能说出 webpack 5 的 chunks 默认值是 async
□ 能说出 sourcemap 为什么不该直接关
```
