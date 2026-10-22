# 工程化 05｜产物优化与 Tree Shaking

> 覆盖题号：20（什么是 tree shaking）、30（tree shaking 原理）、16（bundle 为什么越来越大，怎么优化）
> 去重后：**2 个考点**（tree shaking 原理 + 产物体积优化）

---

## 5.1 题单答案的问题

> **20.** 删除未使用的代码。基于 ES Module 静态分析，生产模式自动开启。CommonJS 不支持。
>
> **30.** 同第20题。

**这句话每一句都对，但每一句都不够**：

| 题单说的 | 缺什么 |
|---|---|
| 「删除未使用的代码」 | 谁删？**不是 webpack 删的**（下面有实测） |
| 「基于 ESM 静态分析」 | 为什么 CJS 不行？——因为 `require` 是**运行时**求值 |
| 「生产模式自动开启」 | 自动开了什么？`usedExports` 和 `minimize` 是**两件事** |
| 「CommonJS 不支持」 | 不准确。**Rollup 对部分 CJS 也能做到**，只是不可靠 |

> 「生产模式自动开启」这句话最容易误导人。我实测下来：**只开 `usedExports` 不压缩，代码一行都不会少。**

---

## 5.2 一句话结论

> Tree shaking = **静态分析标出「没用到的导出」 + 压缩器真正删掉它们**。
>
> **这是两个步骤，两个工具干的。** 缺任何一步都不叫 tree shaking。

---

## 5.3 实测：Tree Shaking 的四个阶段

### 实验设计

源码：

```js
// src/index.js
import { add, unusedFn } from './math.js';
import { greet } from './string.js';
console.log(add(1, 2));
console.log(greet('world'));

// src/math.js
export function add(a, b) { return a + b; }
export function unusedFn() { return 'I am never called'; }
export function square(x) { return x * x; }

// src/string.js
export function greet(name) { return `hi ${name}`; }
export function unusedGreet() { return 'never used'; }
```

`unusedFn`、`square`、`unusedGreet` **三个都没被调用**。

### 四组配置与结果

| # | 配置 | 产物体积 | `unusedFn` | `unusedGreet` | `square` |
|---|---|---|---|---|---|
| b1 | 全部关闭（`minimize:false, usedExports:false`） | **3573 B** | 残留 | 残留 | 残留 |
| b2 | 开 `usedExports` | **3003 B** | 残留 | 残留 | 残留 |
| b3 | 再加 `sideEffects` + `concatenateModules` | **413 B** | 残留 | 残留 | 残留 |
| b4 | 再加 `minimize`（Terser） | **62 B** | **已删除** | **已删除** | **已删除** |

### 关键发现 ①：`usedExports` 只加注释，不删代码

`b2` 的产物里多了两行注释：

```js
/* unused harmony exports unusedFn, square */
/* unused harmony export unusedGreet */
```

**只是注释！** 函数体原封不动：

```js
function add(a, b) { return a + b; }
function unusedFn() { return 'I am never called'; }    ← 还在
function square(x) { return x * x; }                   ← 还在
```

**为什么 webpack 不直接删？** 因为删代码是「危险的优化」——如果判断错了（比如这个函数其实通过某种动态方式被调用了），删掉就是线上事故。webpack 选择**只做标记**，把「删」这个动作交给压缩器——压缩器已经在做死代码消除（DCE），顺手就删了。

### 关键发现 ②：`concatenateModules`（scope hoisting）能大幅减小体积，但不删代码

`b3` 从 3003 B 降到 **413 B**（-86%），但三个函数**都还在**：

```js
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";

;// ./src/math.js
function add(a, b) { return a + b; }
function unusedFn() { return 'I am never called'; }
function square(x) { return x * x; }

;// ./src/string.js
function greet(name) { return `HI ${name}`; }
function unusedGreet() { return 'never used'; }

;// ./src/index.js
console.log(add(1, 2));
console.log(greet('world'));

/******/ })()
```

**注意变化**：

- `__webpack_modules__` 表没了
- `__webpack_require__` 运行时没了
- 模块外壳没了，所有代码**被拼到一个作用域里**
- `(0, _math.add)(1,2)` 变成了直接 `add(1, 2)`

**这就是 scope hoisting（作用域提升）**。它的收益比 tree shaking 还大（3573 → 413），但**完全不删代码**。

> **这个数据很有说服力**：很多人以为「包变小就是 tree shaking 生效了」，实际上**webpack 里体积下降最大的一步往往是 scope hoisting**。

### 关键发现 ③：真正删除的是 Terser

`b4` 的完整产物（62 字节）：

```js
(()=>{"use strict";console.log(3),console.log("HI world")})();
```

**三个函数全没了。** 而且 `console.log(3)` —— Terser 还顺手做了**常量折叠**（`1 + 2` 在编译期算成 `3`），`` `HI ${name}` `` 也被折叠成字符串常量 `"HI world"`。

### 结论：Tree Shaking 的四个必要条件

```
① 源码是 ESM
   ↓
② usedExports 分析出「哪些导出没被用」→ 加注释标记
   ↓
③ sideEffects 告诉打包器「能不能安全地跳过整个模块」
   ↓
④ 压缩器（Terser）真正删除死代码
```

**缺任何一个都不生效**。最常见的「tree shaking 没生效」就是缺了 ④ —— 因为很多人为了调试把 `minimize: false` 打开，然后以为 tree shaking 坏了。

---

## 5.4 为什么 CJS 不能 Tree Shaking

对比两种写法的本质差别：

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

所以打包器**只需要读语法树**就能知道完整的依赖关系。

### CJS 为什么不能

```js
const name = process.env.NODE_ENV === 'production' ? './prod.js' : './dev.js';
const mod = require(name);                          // ← 路径是运行时算出来的

if (someCondition) {
  require('./optional-feature.js');                 // ← 条件加载
}

module.exports = someFunction();                    // ← 导出什么是运行时决定的
```

**打包器根本不知道 `require` 会加载什么**——它要执行代码才知道。所以只能保守地**全部保留**。

### 那为什么 Rollup 对 CJS 有时也能 shake？

因为很多 CJS 代码是**Babel 从 ESM 转过来的**，形态很规整：

```js
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.add = add;
function add(a, b) { return a + b; }
```

Rollup 的 `commonjs` 插件能识别这种模式，把它「还原」成 ESM 再 shake。**但这是启发式的**——遇到 `Object.assign(exports, {...})` 或动态导出就失效。

> **准确的说法**：
> 「CJS 不是『绝对不能』tree shaking，是『不能可靠地』。ESM 的静态结构是**语言层面保证**的，CJS 的模式识别是**工具层面的猜测**。所以给库的作者的建议是：**一定要提供 ESM 产物（`module` 字段或 `exports.import`）**。」

---

## 5.5 `sideEffects` 是最容易出事的地方

### 为什么需要它

考虑这段代码：

```js
// index.js
import './polyfill.js';       // 只为了副作用：修改 Array.prototype
import './style.css';         // 只为了副作用：注入样式

// polyfill.js
console.log('[polyfill] executed');
Array.prototype.myIncludes = function (x) { return this.indexOf(x) !== -1; };
```

**这两个 import 都没有「使用任何导出」**。如果打包器只看 `usedExports`，就会认为「这个模块没被用到」→ 删掉。

但删掉 `polyfill.js`，`Array.prototype.myIncludes` 就不存在了 → **线上直接报错**。

所以需要 `sideEffects` 字段告诉打包器：**「这个文件有副作用，即使没人用它的导出，也不能删。」**

### 实测：三组对照

模块里有一句 `console.log('[polyfill] executed')` 和一行原型修改。

#### ① 不写 `sideEffects` 字段（默认保守）

```json
{ "name": "side-demo", "version": "1.0.0" }
```

产物（未压缩部分已展开）：

```js
(()=>{
  var o={509(){
    console.log("[polyfill] executed"),
    Array.prototype.myIncludes=function(o){return -1!==this.indexOf(o)}
  }};
  ...
  e(509),            // ← polyfill 模块被执行了
  console.log(3)
})();
```

**副作用保留** ✓ —— 但代价是 polyfill 模块被单独留了一份（体积大）。

#### ② `sideEffects: false`（危险！）

```json
{ "name": "side-demo", "version": "1.0.0", "sideEffects": false }
```

产物：

```js
(()=>{"use strict";console.log(3)})();
```

**`polyfill` 整段消失了！** 这一行代码在浏览器里跑会直接崩：

```
TypeError: [].myIncludes is not a function
```

> **这就是那个著名的线上事故**：库作者在 `package.json` 里写了 `"sideEffects": false`，但实际有副作用文件，导致使用方的 polyfill / 样式 / 全局注册全部被删。

#### ③ 白名单（正确做法）

```json
{
  "name": "side-demo",
  "version": "1.0.0",
  "sideEffects": ["**/*.css", "./src/polyfill.js"]
}
```

产物与 ① 相同 —— **副作用保留** ✓，同时其他纯模块仍可被安全地摇掉。

### 什么时候必须写 `sideEffects: false`

| 场景 | 该不该写 |
|---|---|
| **业务应用**（自己构建、自己用） | 写。能有明显收益。但**必须用白名单把 css、polyfill、全局注册列出来** |
| **UI 组件库** | 写，但要非常小心。`@vue/*`、`antd` 都写了，且用白名单排出样式文件 |
| **工具库（纯函数）** | 放心写 `false` |
| **有任何模块顶层副作用的库** | 用白名单，不要写 `false` |

**常见的「会被误删」的文件类型**：

```
*.css / *.scss        ← 样式注入
*.polyfill.js         ← 原型方法扩展
src/setup.js          ← 全局注册（app.use、Vue.prototype.$xxx）
src/global.d.ts        ← 只有类型，无所谓（不产出代码）
```

---

## 5.6 bundle 为什么越来越大（题 16）

### 题单答案的问题

> 「原因：依赖增多、代码没拆分。优化：路由懒加载、SplitChunks 拆公共包、Tree Shaking、externals、按需加载 UI 库。」

**方向对，但「原因」只有两个，太浅**。而且「优化」里的每一项都没有说「代价」。

### 六个真实原因（按出现频率排序）

| # | 原因 | 怎么确认 | 典型体积 |
|---|---|---|---|
| 1 | **引入了完整 UI 库** | 看 bundle 里的 `antd`/`element-plus` 占比 | 几百 KB ~ 1 MB+ |
| 2 | **`moment` / `lodash` 全量引入** | `moment` 带所有 locale 约 **230 KB** | 200 KB+ |
| 3 | **图标库全量引入** | `import * as Icons from '@ant-design/icons'` | 1 MB+ |
| 4 | **sourcemap 被打进了产物** | 检查 `.map` 是否被误引入 | —— |
| 5 | **重复依赖**（同一库多个版本） | `npm ls react` 出现多个版本 | 每份 ×N |
| 6 | **没做代码分割**（所有页面一个 bundle） | bundle 数与路由数对比 | 与页面数成正比 |

### 定位手段（这比「优化手段」更重要）

**第一步：先看现状，别猜。**

```bash
# webpack：生成统计文件
npx webpack --profile --json > stats.json
# 然后拖进 https://webpack.github.io/analyse/ 或 https://chrisbateman.github.io/webpack-visualizer/
```

```bash
# 更直观：rollup-plugin-visualizer（Vite 也能用）
npm i -D rollup-plugin-visualizer
```

```js
// vite.config.js
import { visualizer } from 'rollup-plugin-visualizer';
export default {
  plugins: [visualizer({ open: true, gzipSize: true })],
};
```

**产出的是一个 treemap 图**：哪个包占多少面积，一眼就能看到。

**第二步：按「占用面积 × 可优化性」排序处理。**

> **这一步是面试高分点**：
> 「我不会一上来就说『做代码分割』。我先跑 visualizer 看 treemap，通常前三名就占了 60% 以上。有时候前三名里有两个是根本不该出现的（比如重复的 lodash 版本、或者误引入的整个图标库）。**先删掉不该有的，再优化该有的。**」

### 优化手段与代价对照表

| 手段 | 收益 | 代价 / 风险 | 优先级 |
|---|---|---|---|
| **按需引入 UI 库** | 极大（1 MB → 100 KB） | 需要配插件（`babel-plugin-import` / `unplugin-vue-components`） | ⭐⭐⭐⭐⭐ |
| **替换重库** | 大（`moment` 230 KB → `dayjs` 2 KB） | 要改代码，注意 API 差异 | ⭐⭐⭐⭐⭐ |
| **路由级代码分割** | 大（首屏只加载当前路由） | 需要 `import()`，注意 loading 态 | ⭐⭐⭐⭐⭐ |
| **`splitChunks` 拆 vendor** | 中（利用缓存） | 多几个请求 | ⭐⭐⭐⭐ |
| **Tree Shaking + `sideEffects`** | 中 | 有误删风险（上面讲的三组实验） | ⭐⭐⭐⭐ |
| **`externals` 走 CDN** | 大（bundle 里没有 React/Vue） | **依赖 CDN 可用性**，且失去版本锁定 | ⭐⭐⭐ |
| **图片压缩 / 转 WebP** | 大（但有上限） | 需要构建流程支持 | ⭐⭐⭐⭐ |
| **压缩 + gzip/brotli** | 中（通常 -70%） | **服务器要配**（很多人忘了） | ⭐⭐⭐⭐⭐ |
| **删 sourcemap** | 大 | **失去线上排查能力** | ⭐⭐ |

> **最后一条要特别提醒**：很多人为了减小体积把生产 sourcemap 关了。**这是错的**——应该用 `hidden-source-map`，产物里不带 `//# sourceMappingURL`，但 map 文件上传到 Sentry。这样既不暴露源码，又能定位错误。

### 一个最容易被忽略的点：gzip/brotli 没配

```nginx
# Nginx
gzip on;
gzip_types text/css application/javascript application/json image/svg+xml;
gzip_min_length 1024;
gzip_comp_level 6;

# brotli（需要模块）
brotli on;
brotli_types text/css application/javascript application/json image/svg+xml;
brotli_comp_level 6;
```

**效果**：1 MB 的 JS 传到浏览器实际只有 **250 KB 左右**（brotli 更小）。

> **面试可以这样说**：
> 「我遇到过一次『优化了很久没效果』，最后发现**服务器根本没开 gzip**。所以我们看到的『bundle 大小』和用户实际下载的大小差 4 倍。**优化之前先确认压缩开了没有**，这是性价比最高的一步。」

---

## 5.7 代码分割：三个层次

| 层次 | 做法 | 效果 |
|---|---|---|
| **入口分割** | 多 entry（MPA） | 每个页面独立 bundle |
| **路由分割** | `import()` 动态导入路由组件 | 首屏只加载当前路由 |
| **模块分割** | `splitChunks` 把公共依赖抽出来 | 多个 chunk 共享，利用缓存 |

### `splitChunks` 的默认行为（webpack 5）

webpack 5 的默认值已经比 4 好很多：

```js
splitChunks: {
  chunks: 'async',        // 默认只对异步 chunk 分割
  minSize: 20000,         // 小于 20KB 不拆
  cacheGroups: {
    defaultVendors: {     // node_modules 的包
      test: /[\\/]node_modules[\\/]/,
      priority: -10,
      reuseExistingChunk: true,
    },
    default: {            // 业务代码的公共部分
      minChunks: 2,       // 被 2 个以上 chunk 引用才拆
      priority: -20,
      reuseExistingChunk: true,
    },
  },
}
```

**注意默认 `chunks: 'async'`**——意味着**同步 import 的 node_modules 不会自动拆**。要拆全部得改成 `'all'`。

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
    common: {
      name: 'common',
      minChunks: 2,
      priority: 10,
      chunks: 'all',
      reuseExistingChunk: true,
    },
  },
}
```

**分层的逻辑**：**变化频率越低的，越应该单独成包**。

| 层 | 变化频率 | 缓存策略 |
|---|---|---|
| framework（React/Vue） | 几乎不变（升级才变） | 长期缓存 `max-age=31536000, immutable` |
| libs（其他三方） | 偶尔变（加依赖才变） | 长期缓存 |
| common（业务公共） | 经常变 | 中等缓存 |
| 页面 chunk | 每次发版都变 | 短缓存 + contenthash |

> **这就是「用哈希做缓存」的核心思想**：`[contenthash]` 保证内容不变就不换文件名，从而能长期缓存。**把变化频率不同的代码分开打包，才能最大化缓存命中率。**

---

## 5.8 面试怎么说（2 分钟版）

### Tree Shaking

> 「Tree shaking 本质是**用『副作用是否可判定』换体积**。它需要四个条件同时满足，我实测过每一步：
>
> **第一，源码必须是 ESM。** 因为 `import`/`export` 是静态声明，打包器读语法树就能画出依赖图。CJS 的 `require` 是运行时求值，打包器不知道会加载什么，只能全保留。
>
> **第二，`usedExports` 标出没用的导出。** 但这里有个反直觉的点——**webpack 只加注释，不删代码**。产物里是一行 `/* unused harmony exports unusedFn, square */`，函数体还在。
>
> **第三，`sideEffects` 决定整模块能不能跳过。** 比如 `import './polyfill.js'`，没有任何导出被使用，但它是为了副作用。标错了直接删掉就是线上事故。
>
> **第四，真正删除的是 Terser。** 我做了一组对照：同一份代码，全关 3573 字节，开 `usedExports` 3003 字节，加 scope hoisting 413 字节，**最后加 Terser 变成 62 字节**。前 3 步一个函数都没删，最后一步全删了。
>
> 所以我的结论是：**『生产模式自动开启 tree shaking』这句话要拆开看——自动开的是标记，删除要靠压缩器。** 调试时关掉 `minimize`，tree shaking 就等于没生效。」

### bundle 变大

> 「我分两步：**先定位，再优化**。
>
> 定位我会跑 `rollup-plugin-visualizer` 或 `webpack --json` 出 treemap。**通常前三名占 60% 以上**，而且经常能发现不该出现的东西——重复的 lodash 版本、误引入的整个图标库、被一起打进来的 moment locale。
>
> 优化我会按性价比排序：
>
> 第一优先是**替换重库**，moment 换 dayjs 从 230 KB 到 2 KB，收益最大改动最小。
>
> 第二是**按需引入**，UI 库和图标库必须配 `unplugin-*` 自动按需。
>
> 第三是**路由级代码分割**，首屏只加载当前路由。
>
> 第四是 `splitChunks` 分层——框架代码、第三方库、业务公共、页面 chunk 分开，**让变化频率不同的代码有不同的缓存周期**。
>
> 还有一个最容易被忽略的：**服务器有没有开 gzip / brotli**。1 MB 的 JS 压缩后只有 250 KB。我有一次优化了很久没效果，最后发现根本没开压缩。」

---

## 5.9 追问链

| 追问 | 答法 |
|---|---|
| `usedExports` 和 `sideEffects` 区别？ | `usedExports` 是**导出级**（这个 `export` 有没有被 import）；`sideEffects` 是**模块级**（这个模块能不能整个跳过） |
| 为什么 `usedExports` 不直接删代码？ | 删除是危险操作，webpack 只做保守的标记，把删除交给已在做 DCE 的压缩器。**这样即使标记错了，也不会造成事故** |
| scope hoisting 是什么？ | 把多个模块的代码**拼到一个作用域**里，去掉模块外壳和 `__webpack_require__` 调用。要求模块是 ESM 且没有循环依赖 |
| scope hoisting 有什么限制？ | ① 必须是 ESM；② 不能有循环依赖（否则拼接顺序无法确定）；③ 会改变变量作用域，可能有边界问题（webpack 会保守跳过） |
| tree shaking 后代码真的完全不执行吗？ | 是。被摇掉的模块**连顶层代码都不会执行**。所以「为了副作用而 import」必须靠 `sideEffects` 保住 |
| 为什么组件库要提供 ESM 产物？ | CJS 产物无法可靠 tree shaking。看 `package.json` 的 `module` 字段或 `exports` 的 `import` 条件 |
| `exports` 字段和 `main`/`module` 的关系？ | `exports` 是新标准，能精确控制「什么条件下用哪个文件」。优先级高于 `main`/`module`。**配错了会导致「明明有 ESM 产物却用的是 CJS」** |
| 怎么验证 tree shaking 生效了？ | 三个办法：① 搜产物里有没有那个函数名；② 用 visualizer 看模块是否还在 treemap 里；③ 加个 `console.log` 到「应该被摇掉」的模块顶层，看运行时有没有打印 |
| `import * as X` 会影响 tree shaking 吗？ | 会。`import * as X` 会让打包器认为「可能用到任意导出」，保守地全保留。**尽量用具名导入** |
| 动态 `import()` 的 chunk 也能 tree shaking 吗？ | 能，每个异步 chunk 独立做 tree shaking |
| `externals` 和 `splitChunks` 区别？ | `externals` 是**不打包**（从全局变量/CDN 拿）；`splitChunks` 是**单独打包成一个文件**。前者能减小 bundle，但引入了外部依赖风险 |
| 微前端能减小首屏体积吗？ | 能，但要付出「运行时集成」的代价（样式隔离、JS 沙箱、通信机制）。**如果只是想要代码分割，不需要微前端** |

---

## 5.10 速记卡

```
【Tree Shaking 四条件】
① ESM（静态可分析）
② usedExports → 只加注释 /* unused harmony exports */
③ sideEffects → 模块级「能否跳过」
④ Terser → 真正删除  ★ webpack 不删！

【实测四阶段】
全关 3573B → +usedExports 3003B → +scopeHoisting 413B → +Terser 62B
前 3 步一个函数没删；第 4 步全删
最终产物：(()=>{"use strict";console.log(3),console.log("HI world")})();
（Terser 顺带做了常量折叠）

【为什么 CJS 不能】
require 是运行时求值，路径可能拼接、条件加载
ESM 是语言层保证的静态结构；CJS 是工具层的模式猜测

【sideEffects 三组实测】★
不写        → polyfill 保留（但体积大）
false       → (()=>{"use strict";console.log(3)})();  ← polyfill 被删！线上必崩
白名单      → 保留，且其他纯模块仍可摇

必须白名单列出的：*.css / polyfill / 全局注册文件

【bundle 变大六个原因】
UI 库全量 / moment+lodash 全量 / 图标库全量
sourcemap 误入 / 重复依赖多版本 / 没做代码分割

【优化优先级】
① 替换重库（moment → dayjs：230KB → 2KB）
② 按需引入（UI 库 + 图标库）
③ 路由级分割
④ splitChunks 分层（按变化频率）
⑤ 确认 gzip/brotli 开了（1MB → 250KB）

【splitChunks 分层原则】
变化频率越低，越单独成包
framework > libs > common > page
默认 chunks:'async'，要拆同步依赖得改 'all'

【sourcemap】
别直接关，用 hidden-source-map + 上传 Sentry
```

---

## 5.11 自测

```
□ 能说出 tree shaking 的四个条件
□ 能说出「webpack 只标记、Terser 才删」这个事实
□ 能背出四阶段实测的体积（3573 → 3003 → 413 → 62）
□ 能说出 scope hoisting 干了什么、为什么体积降那么多
□ 能解释 CJS 为什么不能可靠 tree shaking
□ 能说出 usedExports 和 sideEffects 的层级差别
□ 能描述 sideEffects:false 误删 polyfill 的现象
□ 能说出白名单必须包含哪几类文件
□ 能列出 bundle 变大的六个原因
□ 能说出定位体积问题用什么工具
□ 能按性价比排序至少四个优化手段
□ 能说出 moment → dayjs 的体积差
□ 能解释 splitChunks 分层为什么要按「变化频率」
□ 能说出 webpack 5 的 chunks 默认值是 async
□ 能说出 sourcemap 为什么不该直接关
```
