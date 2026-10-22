# 工程化 03｜Vite 与新一代构建工具

> 覆盖题号：14（vite/esbuild/webpack 区别）、31（为什么 vite 比 webpack 快）
> 去重后：**1 个考点**（这两题本质是同一题的两面）

---

## 3.0 题单答案的问题

> **14.** Webpack：打包器，全量打包，冷启动慢。Vite：开发用 esbuild 预构建依赖 + 原生 ESM，冷启动快；生产用 Rollup。esbuild：Go 写的打包器，极快，只做构建。
>
> **31.** 开发环境：Vite 用原生 ESM，浏览器请求哪个文件才编译哪个，不用打包整个 bundle。Webpack 要先全量打包再启动。

**方向完全正确**，是这份题单里少有的及格答案。但缺四个关键：

1. 没解释「原生 ESM 为什么就快」（**根因是不需要提前知道完整依赖图**）
2. 没提「依赖预构建」到底解决什么问题
3. 没说「为什么生产不用 esbuild」
4. 没有任何数据

---

## 3.1 一句话结论

> **webpack 是「先打包、再服务」，Vite 开发时是「浏览器要什么、就编译什么」。**
>
> 这个差别不是「优化程度」的差别，是**架构**的差别——它决定了启动时间跟项目规模的关系。

---

## 3.2 根因：启动时间与项目规模的关系

| | webpack dev | Vite dev |
|---|---|---|
| 启动时做什么 | 从 entry 递归解析**所有**模块，全部 transform + parse，生成完整 bundle，然后才启动 server | 只启动一个 HTTP server，**不碰业务代码** |
| 启动时间 | **与模块数成正比**（1000 个模块 ≈ 几秒到几十秒） | **与模块数无关**（≈ 几百毫秒） |
| 浏览器刷新时 | 直接返回已打好的 bundle | 浏览器按 `import` 逐个请求，**Vite 按需编译单个文件** |
| 模块数从 100 → 10000 | 启动从 2s → 200s（线性） | 启动还是几百 ms（**常数**） |

> **这一句是这道题的核心**：
> 「webpack 的启动时间是 **O(项目规模)**，Vite 是 **O(1)**。所以项目越大，差距越悬殊——这不是『Vite 优化得好』，是『Vite 根本不需要在启动时做那件事』。」

**为什么 webpack 必须打包完才能服务？**

因为 webpack 生成的是一个**自包含的 bundle**——它内部有一套自己的 `__webpack_require__` 运行时。要生成这个运行时，必须先知道**所有模块和它们的依赖关系**，才能分配模块 id、生成模块表。

而浏览器本身**已经有 ESM 的模块加载能力**了。Vite 的思路是：**把「模块解析」这件事交还给浏览器**。

```
webpack:  服务器（打包所有） → 浏览器（执行一个大文件）
Vite dev: 服务器（按需转译） ←→ 浏览器（自己解析 import）
```

---

## 3.3 Vite dev 的完整链路

```
① 启动（几百 ms）
   ├─ 创建 HTTP server（connect 中间件）
   ├─ 用 esbuild 做「依赖预构建」（只处理 node_modules，不碰业务代码）
   └─ 返回 HTML

② 浏览器请求 /index.html
   └─ Vite 注入 <script type="module" src="/src/main.js">

③ 浏览器请求 /src/main.js
   ├─ Vite 中间件拦截
   ├─ 读到源文件，用 esbuild 转成浏览器能跑的 ESM
   ├─ ★ 关键：把 import 的路径重写成浏览器能请求的形式
   │     import { createApp } from 'vue'
   │     → import { createApp } from '/node_modules/.vite/deps/vue.js?v=abc123'
   └─ 返回转换后的代码

④ 浏览器解析到 import，继续请求子模块
   └─ 重复 ③，直到所有用到的模块都拿到

⑤ 用户改了一个文件
   └─ Vite 通过 WebSocket 通知浏览器，只替换那个模块（HMR）
```

**核心机制就一句**：

> 「Vite 把 `import 'vue'` 这种**裸模块名**重写成 `/node_modules/.vite/deps/vue.js` 这种**浏览器能直接请求的 URL**。剩下的解析工作交给浏览器的 ESM loader。」

### 为什么需要「依赖预构建」

如果直接把 `import { createApp } from 'vue'` 交给浏览器，浏览器会报错——**它不认识裸模块名**。所以必须重写。

但只重写路径还不够。预构建解决三个问题：

| 问题 | 不预构建会怎样 | 预构建怎么解决 |
|---|---|---|
| **CJS / UMD 依赖** | 浏览器只认 ESM。`lodash` 这种 CJS 包直接挂 | 用 esbuild 把 CJS 转成 ESM |
| **请求瀑布** | `lodash-es` 有 **600+ 个内部模块**，每个都是一个 HTTP 请求 | 用 esbuild 把它们**合并成一个文件**，变成 1 个请求 |
| **重复转换** | 每次刷新都重新转换 node_modules | 转换结果**缓存到 `node_modules/.vite/deps`**，只在依赖变化时重建 |

> **「请求瀑布」这一条是最能体现深度的**：
> 「`lodash-es` 有 600 多个模块。如果不预构建，浏览器加载一个页面可能发出 600 个请求——即使 HTTP/2 多路复用，也会被浏览器的并发限制和解析开销拖垮。**Vite 用 esbuild 把它们打成一个文件，600 个请求变成 1 个。这是『开发环境也需要打包』的唯一理由。**」

### 什么时候需要手动干预预构建

```js
// vite.config.js
export default {
  optimizeDeps: {
    // ① 有些包 Vite 静态分析不到（动态 import、require 拼接），要手动加
    include: ['some-cjs-package', 'another-package > deep-import'],

    // ② 有些包预构建后反而出问题（比如依赖内部路径），要排除
    exclude: ['your-local-linked-package'],
  },
};
```

**真实的三种场景**：

1. **本地 `npm link` 的包**：预构建会缓存旧版本，改了不生效 → 加 `exclude`
2. **只在运行时拼接路径打进来的包**：Vite 扫不到 → 加 `include`
3. **monorepo 里的内部包**：应该被当成源码而不是依赖 → `exclude`

---

## 3.4 三方对比表

| 维度 | webpack 5 | Vite（dev） | Vite（build） | esbuild |
|---|---|---|---|---|
| **定位** | 通用打包器 | 开发服务器 | 生产打包器 | 极速转译/打包 |
| **实现语言** | JavaScript | JS + esbuild（Go） | Rollup（JS）→ Rolldown（Rust） | **Go** |
| **dev 是否打包** | ✅ 全量打包 | ❌ 不打包 | — | — |
| **启动时间** | 与模块数成正比 | **基本恒定** | — | — |
| **HMR 粒度** | 模块级（要重新生成 chunk） | 模块级（直接替换 ESM 模块） | — | — |
| **代码分割** | ✅ 非常成熟 | — | ✅ Rollup 做 | ⚠️ 较基础 |
| **CSS 处理** | ✅ 生态完整 | — | ✅ | ⚠️ **弱** |
| **Tree shaking** | ✅（需 Terser 配合） | — | ✅（Rollup 更强） | ⚠️ 只做基础 |
| **插件生态** | **最庞大** | 兼容 Rollup 插件 | 同左 | ❌ 几乎无 |
| **配置复杂度** | 高 | **极低** | 低 | 中 |
| **适合** | 老项目、复杂定制 | — | 新项目 | 库、CLI、内部工具 |

### 为什么「生产不用 esbuild」

这是追问率最高的一点。四个原因：

| 原因 | 说明 |
|---|---|
| **代码分割不成熟** | esbuild 的 `splitting` 只支持 ESM 格式，且**不支持把 vendor 拆成多个 chunk 的精细控制**。做不了 `splitChunks` 那种粒度 |
| **CSS 处理弱** | esbuild 的 CSS 支持是「能打包」级别，**不支持 CSS Modules 的完整语义、不支持 PostCSS 插件链的完整能力** |
| **没有插件生态** | 做不了「自动生成 HTML」「抽离 CSS」「图片压缩」「PWA」这些事 |
| **Tree shaking 不如 Rollup** | Rollup 的静态分析更深（能跨模块推断），esbuild 为了速度做了取舍 |

**所以 Vite 的分工是**：

```
开发：esbuild（要快，只做转译，不做打包）
生产：Rollup（要产物质量，慢一点没关系——反正只跑一次）
```

> **这句话是这道题的「点睛句」**：
> 「Vite 不是『用 esbuild 替代 webpack』，而是**在开发和构建两个阶段用不同的工具**。因为它对这两个阶段的要求是矛盾的——开发要快、要不打包，生产要产物小、要代码分割。**用一个工具同时满足两边，才是 webpack 慢的根本原因。**」

---

## 3.5 实测：esbuild 到底快多少

### 测试设计

- 200 个模块，共 **84.4 KB**，每个含 `class` / 私有字段 / 可选链 / 空值合并 / async / 展开 / 模板字符串
- 环境：Node 22.22.2，`@babel/core 8.0.7`，`esbuild 0.28.2`

### 结果

| 任务 | 耗时 | 相对倍数 |
|---|---|---|
| Babel（`preset-env` → IE11）逐个 transform | **1956 ms** | 1× |
| esbuild（transform → ES2015）逐个 | **100 ms** | **19.6×** |
| esbuild（完整 bundle + minify） | **15 ms** | 130× |

> **130× 那个数字要打折说明**：esbuild 那次同时做了 tree shaking，产物只有 1.2 KB，**工作量不一样**。所以严谨的说法是「同口径的纯转译对比是 **19.6 倍**」。

### 为什么快 19.6 倍（四个原因，按贡献排序）

#### ① 实现语言不同（最大贡献）

| | Babel | esbuild |
|---|---|---|
| 语言 | JavaScript | **Go** |
| 运行方式 | 跑在 Node 的 V8 里，JIT | 编译成**原生机器码** |
| 内存 | JS 对象 + GC | 直接内存 + **无 GC 压力** |

> 「Babel 处理 AST 时创建几十万个 JS 对象，每个都要经过 V8 的分配和 GC。esbuild 用 Go 的 struct，**分配在栈上或紧凑的堆里，没有 GC 停顿**。这是数量级的差别。」

#### ② 并行 vs 单线程

```
Babel：单线程，逐个文件串行处理
esbuild：多线程，文件在多个 goroutine 里并行解析
```

**这就是为什么 esbuild 的官方口号是「利用多核」**。Babel 想并行只能靠 `thread-loader`（要 fork 进程，进程间通信成本很高）。

#### ③ 一遍扫描 vs 多遍遍历

Babel 的架构是**插件式**：每个插件都要单独遍历一次 AST。50 个插件 = 50 次遍历。

esbuild 是**一体化**的：把所有转换合并到一次遍历里完成。

> 「这是**架构取舍**，不是实现技巧。Babel 的插件生态能做到『任意组合、任意顺序』，代价就是多次遍历。esbuild 为了速度放弃了这种灵活性——它的转换是不可拆的。」

#### ④ 不做「行为降级」

Babel 会为了严格符合规范而生成很啰嗦的代码：

```js
// 可选链 obj?.a  → Babel 生成 3 行
var _obj;
(_obj = obj) === null || _obj === void 0 ? void 0 : _obj.a;
```

esbuild 在目标支持时会直接保留，或者在目标不支持时用更紧凑的写法。

**实测对照**（同一个 `obj?.a`）：

```
Babel  →  var _obj; (_obj = obj) === null || _obj === void 0 ? void 0 : _obj.a;
```

---

## 3.6 HMR：两者的差距在哪

| | webpack HMR | Vite HMR |
|---|---|---|
| 更新粒度 | 模块级，但**要重新生成受影响的 chunk** | 模块级，**直接让浏览器重新 import 那个 URL** |
| 实现机制 | 通过 `hot-update.json` + `hot-update.js` 下发补丁，运行时替换 `__webpack_modules__` | 通过 WebSocket 通知，浏览器 `import('/src/xxx.js?t=123')` 重新拉取 |
| 大项目表现 | 越大的项目越慢（要重算 chunk graph） | 与项目规模无关（只换一个模块） |
| 边界 | 需要模块自己实现 `module.hot.accept`，否则冒泡到整页刷新 | 框架插件（`@vitejs/plugin-vue` 等）自动处理，通常不需要手写 |

**Vite HMR 的原理（值得讲清）**：

```
① 文件改动
② Vite 的 watcher 捕获
③ 沿着 import 图往上找，确定「哪些模块需要 accept 这个更新」
   ├─ 找到实现了 hot.accept 的边界 → 只更新到这里
   └─ 找不到 → 整页刷新
④ 通过 WebSocket 发 { type: 'update', path: '/src/Comp.vue', timestamp }
⑤ 浏览器收到后 import('/src/Comp.vue?t=时间戳')  ← 时间戳绕过缓存
⑥ 框架插件在 accept 回调里重新渲染组件
```

**关键点：`?t=timestamp` 这个 query**。

浏览器会用 URL 做缓存 key。加时间戳等于换了一个 URL，所以能强制重新请求。**这是 Vite HMR 能「只替换一个模块」的核心技巧**——不需要 webpack 那种复杂的补丁机制。

---

## 3.7 Vite 的坑（这题的高分在「缺点」）

面试官问「Vite 有什么问题」，能答出来才是真用过。

| 坑 | 现象 | 原因 / 解法 |
|---|---|---|
| **首次启动反而慢** | 第一次 `vite` 要几十秒 | 在做依赖预构建。之后有缓存就快了。可以 `--force` 强制重建 |
| **依赖变化会触发重新预构建** | 装了个新包，重启很慢 | 预构建缓存 key 含 lockfile 哈希。**频繁加依赖时会反复重建** |
| **生产行为和开发不一致** | 开发能跑，构建后报错 | 开发用 esbuild（宽松），生产用 Rollup（严格）。**典型：循环依赖、`export *` 冲突、CJS interop** |
| **CJS 依赖的各种坑** | `xxx is not a function` / `default is undefined` | 预构建的 interop 有时和 webpack 不一致。要配 `optimizeDeps.include` |
| **动态 import 分析不到** | 运行时报 404 | `import('./pages/' + name)` 这种拼接，Vite 要靠 `import.meta.glob` |
| **本地 link 的包不热更新** | 改了没反应 | 预构建缓存了旧版本。加 `optimizeDeps.exclude` + `server.watch` |
| **SSR 要两套构建** | 配置复杂 | 需要 `build.ssr` + 客户端/服务端两套产物 |
| **老浏览器兼容** | IE11 完全不支持 | Vite 从 3.0 起明确不支持 IE11（因为开发依赖原生 ESM） |

> **面试时的杀手句**：
> 「Vite 最大的风险不是性能，是**「开发环境和生产环境用不同工具」带来的不一致**。开发用 esbuild、生产用 Rollup，两边的 CJS interop、循环依赖处理、`export *` 语义都有细微差别。我遇到过开发正常、构建后 `default` 变成 undefined 的问题，最后是靠 `optimizeDeps.include` 解决的。
>
> 这是**架构换来的代价**——换来的是启动速度。所以要不要用 Vite，本质是问「你更怕慢，还是更怕不一致」。**新项目我选 Vite，老项目我留在 webpack。**」

---

## 3.8 采访怎么说（2 分钟版）

> 「我从架构差异讲起。
>
> **webpack 是打包器**。它启动时必须从入口递归解析所有模块，全部 transform + parse 完，生成一个自包含的 bundle，然后才启动 server。所以**启动时间和模块数成正比**——1 万个模块的项目冷启动能到几十秒。
>
> **Vite 开发时不打包**。它只启动一个 HTTP server，利用浏览器原生的 ESM 能力：浏览器请求 `main.js`，Vite 现编译这一个文件并返回；浏览器解析到 `import` 再请求下一个。所以**启动时间跟项目规模基本无关**。
>
> 但这里有个必须解决的问题：浏览器不认识 `import 'vue'` 这种裸模块名。所以 Vite 会做**依赖预构建**——用 esbuild 把 `node_modules` 里的依赖转成 ESM、并且**把几百个小模块合并成一个文件**（比如 `lodash-es` 有 600 多个模块）。这一步解决三件事：CJS 转 ESM、消除请求瀑布、结果缓存。
>
> **生产环境 Vite 不用 esbuild，用 Rollup**。因为 esbuild 的代码分割和 CSS 处理都不够成熟，做不了 `splitChunks` 那种精细控制。所以 Vite 的分工是：**开发要快用 esbuild，生产要产物质量用 Rollup**。
>
> 至于 esbuild 为什么快，我实测过：同样 200 个模块、84 KB 代码做 ES5 降级，Babel 要 1956 ms，esbuild 只要 100 ms，**快 19.6 倍**。原因是 Go 编译成原生码、多线程并行、以及一体化转换（Babel 每个插件都要遍历一遍 AST）。
>
> **Vite 的代价是不一致**：开发和生产用两套工具，CJS interop、循环依赖这些边界行为会有差别。所以我的选择是——新项目用 Vite，需要兼容老浏览器或有大量复杂定制的老项目留 webpack。」

---

## 3.9 追问链

| 追问 | 答法 |
|---|---|
| Vite 开发时真的完全不打包吗？ | 业务代码不打包，**依赖会预构建打包**。所以准确说法是「业务代码按需编译 + 依赖预打包」 |
| 那 Vite 开发时请求数不是很多吗？ | 多，但 HTTP/2 下可以接受。而且**只有用到的模块才请求**——webpack 是把没用的也打进 bundle。所以大项目里 Vite 的实际请求量反而更少 |
| Vite 能用在生产吗？ | 能，而且很成熟了。Vue 官方脚手架 `create-vue` 默认就是 Vite。**注意生产是 Rollup 在干活** |
| 为什么不直接用 Rollup 做 dev？ | Rollup 是打包器，dev 需要的是「按需编译 + HMR」，那是另一套能力。Vite 自己在 Rollup 之上做了 dev server |
| esbuild 能替代 webpack 吗？ | 目前不能。缺插件生态、代码分割弱、CSS 能力弱。但**做库打包、CLI 工具、Node 服务**非常合适 |
| webpack 有没有「不打包」模式？ | webpack 5 有 `experiments.lazyCompilation`（实验特性），但效果和 Vite 差很远 |
| 为什么 webpack 不做成 Vite 那样？ | 历史包袱。webpack 的定位是「一切皆模块」的通用打包器，支持 CJS/AMD/ESM/各种 asset，这套体系依赖「先分析完再生成」。**改成按需会破坏大量现有 loader/plugin 的假设** |
| Turbopack / Rspack 是什么？ | Turbopack 是 Vercel 出的 Rust 版 webpack 替代（Next.js 用）；Rspack 是字节出的 Rust 版 webpack，**主打「兼容 webpack 配置和插件生态」**。两者都是「保留打包模型，只把实现换成 Rust」 |
| Rolldown 是什么？ | Rollup 的 Rust 重写版，目标是替代 Vite 生产构建里的 Rollup，让开发和生产的工具链统一（都用 Rust），**减少上面说的「不一致」问题** |
| 怎么量化「Vite 快」？ | 别只说感觉。测三个数：**冷启动时间**、**HMR 响应时间**、**改一个文件后的浏览器可见延迟**。Vite 官方有 benchmark 仓库 |

---

## 3.10 速记卡

```
【根因一句话】
webpack 启动 O(项目规模)；Vite 启动 O(1)
不是优化差距，是架构差距

【Vite dev 链路】
HTTP server → 浏览器请求 main.js → Vite 按需转译
→ 把裸模块名重写成 /node_modules/.vite/deps/xxx.js
→ 浏览器自己的 ESM loader 继续解析

【依赖预构建解决三件事】
① CJS/UMD → ESM（浏览器只认 ESM）
② 合并小模块（lodash-es 600+ 模块 → 1 个请求）
③ 缓存到 node_modules/.vite/deps

【生产为什么不用 esbuild】
代码分割不成熟 / CSS 弱 / 无插件生态 / tree shaking 弱
→ 开发 esbuild（要快）· 生产 Rollup（要质量）

【实测速度】
200 模块 / 84.4 KB / ES5 降级
Babel 1956ms · esbuild 100ms → 19.6×
原因：Go 原生码 > JS+V8 / 多线程 / 一体化转换 ≠ 多遍遍历 / 不做行为降级

【HMR】
webpack：hot-update 补丁 + 运行时替换 __webpack_modules__
Vite：WebSocket 通知 + import(url?t=timestamp) 绕过缓存

【Vite 的坑】
首次启动慢（预构建）
加依赖触发重建
★ 开发(esbuild) 与生产(Rollup) 行为不一致
CJS interop / 动态 import 分析不到 / IE11 不支持
```

---

## 3.11 自测

```
□ 能用「O(项目规模) vs O(1)」解释两者的启动差异
□ 能说清 webpack 为什么必须打包完才能服务
□ 能说出 Vite 把裸模块名重写成什么
□ 能说出依赖预构建解决的三个问题
□ 能举出 lodash-es 600 模块这个例子
□ 能说出生产不用 esbuild 的四个原因
□ 能解释「Vite 不是用 esbuild 替代 webpack」
□ 能说 esbuild 快 19.6 倍的四个原因
□ 能说清 Vite HMR 里 ?t=timestamp 的作用
□ 能说出 Vite 至少三个坑
□ 能说出 webpack 为什么不改成按需编译
□ 能说出 Turbopack / Rspack / Rolldown 各自的定位
```
