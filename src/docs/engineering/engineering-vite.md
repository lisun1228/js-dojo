# 工程化 03｜Vite 与新一代构建工具

> 覆盖题号：14（vite/esbuild/webpack 区别）、31（为什么 vite 比 webpack 快）
> 去重后：**1 个考点**（这两题本质是同一题的两面）
> 版本基准：本仓库 `vite@8.3.4`（内置 `rolldown@1.2.13`）、Node 22.12.0

---

## 目录

- [3.0 题单答案的问题](#30-题单答案的问题)
- [3.1 一句话结论](#31-一句话结论)
- [3.2 根因：启动时间与项目规模的关系](#32-根因启动时间与项目规模的关系)
- [3.3 Vite dev 的完整链路](#33-vite-dev-的完整链路)
- [3.4 三方对比表](#34-三方对比表)
- [3.5 实测：esbuild 到底快多少](#35-实测esbuild-到底快多少)
- [3.6 HMR：两者的差距在哪](#36-hmr两者的差距在哪)
- [3.7 Vite 的坑（这题的高分在「缺点」）](#37-vite-的坑这题的高分在缺点)
- [3.8 采访怎么说（2 分钟版）](#38-采访怎么说2-分钟版)
- [3.9 追问链](#39-追问链)
- [3.10 速记卡](#310-速记卡)
- [3.11 自测](#311-自测)

---

## 3.0 题单答案的问题

> **14.** Webpack：打包器，全量打包，冷启动慢。Vite：开发用 esbuild 预构建依赖 + 原生 ESM，冷启动快；生产用 Rollup。esbuild：Go 写的打包器，极快，只做构建。
>
> **31.** 开发环境：Vite 用原生 ESM，浏览器请求哪个文件才编译哪个，不用打包整个 bundle。Webpack 要先全量打包再启动。

「dev 按需编译、build 打包」的框架成立，缺的是四层解释：

1. 原生 ESM 为什么能省掉启动成本（根因：启动时不需要完整依赖图）
2. 依赖预构建解决什么（CJS/UMD → ESM、请求瀑布、缓存）
3. 生产打包器为什么不是 esbuild
4. 可复现的数字

题单里的工具对应 Vite 7 及更早：Vite 8 的开发转译改用 Oxc、依赖预构建和生产打包改用 Rolldown，esbuild 已不在默认链路里。

---

## 3.1 一句话结论

> **webpack 是「先打包、再服务」，Vite 开发时是「浏览器要什么、就编译什么」。**

差别不是优化程度，而是启动时需要处理多少信息：webpack 必须先有完整依赖图才能生成 bundle，Vite 把模块解析交给浏览器的 ESM loader。

---

## 3.2 根因：启动时间与项目规模的关系

| | webpack dev | Vite dev |
|---|---|---|
| 启动时做什么 | 从 entry 递归解析**所有**模块，全部 transform + parse，生成完整 bundle 后才启动 server | 只启动 HTTP server + 依赖预构建，**不碰业务代码** |
| 启动成本 | **O(模块数)** | **O(依赖数)**，与业务模块数无关 |
| 浏览器请求时 | 返回已打好的 bundle | 按 `import` 逐个请求，Vite 按需转译单个文件 |

webpack 必须先打包完才能服务，因为它输出的是**自包含 bundle**，内部要有一套 `__webpack_require__` 运行时。生成运行时需要先知道所有模块和依赖关系，才能分配模块 id、生成模块表。

浏览器本身已有 ESM 加载能力，Vite 把「模块解析」交还给浏览器：

```
webpack:  服务器（打包所有） → 浏览器（执行一个大文件）
Vite dev: 服务器（按需转译） ←→ 浏览器（自己解析 import）
```

所以模块数增长时，webpack 的启动成本线性增长；Vite 的启动成本只随依赖数量变化。

---

## 3.3 Vite dev 的完整链路

```
① 启动：创建 HTTP server；用 Rolldown 做依赖预构建（只处理 node_modules）；返回 HTML
② 浏览器请求 /index.html
   └─ Vite 注入 /@vite/client 与 <script type="module" src="/src/main.ts">
③ 浏览器请求 /src/main.ts
   ├─ Vite 中间件拦截，用 Oxc 转成浏览器能跑的 ESM
   ├─ ★ 把裸模块名重写成可请求的 URL
   │     import { createApp } from 'vue'
   │     → import { createApp } from '/node_modules/.vite/deps/vue.js?v=f834f11c'
   └─ 返回转换后的代码
④ 浏览器解析到 import，继续请求子模块，重复 ③
⑤ 改文件 → WebSocket 推送更新，只重新 import 受影响的模块（见 3.6）
```

核心机制：`vue` 这类**裸模块名**在浏览器里无法解析，Vite 把它重写成 `.vite/deps` 下的真实 URL，后续解析交给浏览器的 ESM loader。本仓库 `curl /src/main.ts` 拿到的就是上面这条重写结果，`v=f834f11c` 即 `node_modules/.vite/deps/_metadata.json` 里的 `browserHash`。

### 为什么需要「依赖预构建」

只重写路径不够，预构建解决三件事：

| 问题 | 不预构建会怎样 | 预构建怎么解决 |
|---|---|---|
| **CJS / UMD 依赖** | 浏览器只认 ESM | 用 Rolldown 把 CJS/UMD 转成 ESM |
| **请求瀑布** | Vite 官方文档的例子：`lodash-es` 有 600+ 个内部模块，每个都是一次 HTTP 请求 | 合并成一个文件，变成 1 个请求 |
| **重复转换** | 每次启动都重新转换 node_modules | 结果缓存到 `node_modules/.vite/deps` |

缓存是否失效由 lockfile、相关配置与 `NODE_ENV` 决定，任一变化才重新预构建；`vite --force` 可强制重建。

### 什么时候需要手动干预预构建

```js
// vite.config.js
export default {
  optimizeDeps: {
    // 静态分析不到的依赖（动态 import、require 拼接）
    include: ['some-cjs-package', 'another-package > deep-import'],
    // 预构建后反而出问题的包
    exclude: ['your-local-linked-package'],
  },
}
```

典型场景：本地 `npm link` 的包、运行时拼接路径才出现的包、monorepo 中应作为源码处理的内部包。Vite 8 的 `optimizeDeps.esbuildOptions` 已废弃，对应能力改用 `optimizeDeps.rolldownOptions`。

---

## 3.4 三方对比表

| 维度 | webpack 5 | Vite（dev） | Vite（build） | esbuild |
|---|---|---|---|---|
| **定位** | 通用打包器 | 开发服务器 | 生产打包器 | 转译 / 打包 |
| **实现语言** | JavaScript | JS + Oxc / Rolldown（Rust） | Rolldown + Oxc（Rust） | **Go** |
| **dev 是否打包** | ✅ 全量打包 | ❌ 业务代码不打包（依赖会预构建） | — | — |
| **启动成本** | O(模块数) | 与业务模块数无关 | — | — |
| **HMR 粒度** | 模块级，需重建受影响 chunk | 模块级，直接替换 ESM 模块 | — | — |
| **代码分割** | ✅ 成熟 | — | ✅ Rolldown `codeSplitting` | ⚠️ 仅 ESM 输出 |
| **CSS 处理** | ✅ 生态完整 | — | ✅ Lightning CSS 压缩 | ⚠️ 弱 |
| **Tree shaking** | ✅（需 Terser 配合） | — | ✅ Rolldown | ⚠️ 基础 |
| **插件生态** | **最庞大** | 兼容 Rollup 插件 API（个别 hook 未实现） | 同左 | ❌ 较少 |
| **配置复杂度** | 高 | **低** | 低 | 中 |
| **适合** | 老项目、复杂定制 | — | 新项目 | 库、CLI、内部工具 |

### 为什么「生产不用 esbuild」

| 原因 | 说明 |
|---|---|
| **代码分割不成熟** | 只支持 ESM 输出格式，缺少按 vendor 精细拆包的能力 |
| **CSS 处理弱** | 能力停留在打包/压缩层面，CSS Modules 与 PostCSS 插件链支持有限 |
| **插件生态小** | 自动生成 HTML、抽离 CSS、图片压缩、PWA 等都要另做 |
| **Tree shaking 较弱** | 静态分析深度不如 Rollup/Rolldown，为速度做了取舍 |

Vite 的分工因此变成：

```
开发：Oxc 转译 + Rolldown 预构建（要快，不打包业务代码）
生产：Rolldown 打包 + Oxc 压缩（要产物质量，只跑一次）
```

Vite 8 用 Rolldown/Oxc 取代了 Rollup/esbuild；esbuild 的上述短板，是它没有成为生产打包器的原因。

---

## 3.5 实测：esbuild 到底快多少

### 测试设计

- 200 个模块，共 84.4 KB，每模块含 `class`、私有字段、可选链、空值合并、`async`、展开、模板字符串
- 历史记录环境：Node 22.22.2、`@babel/core 8.0.7`、`esbuild 0.28.2`；该组数字未在本仓库复现
- 两组任务目标不同：Babel 用 `preset-env` 降到 IE11，esbuild 输出 ES2015

### 结果

| 任务 | 耗时 | 相对倍数 |
|---|---|---|
| Babel 逐个 transform | **1956 ms** | 1× |
| esbuild 逐个 transform | **100 ms** | **19.6×** |
| esbuild 完整 bundle + minify | **15 ms** | 130× |

130× 不能直接采信：那一轮同时做了 tree shaking，产物仅 1.2 KB，工作量不同。排除打包差异后，纯转译约 **19.6 倍**；但 Babel 目标 IE11、esbuild 目标 ES2015，降级深度不同，不是严格同口径。

### 为什么快 19.6 倍

| 原因 | 机制 |
|---|---|
| **实现语言** | Go 编译成原生机器码，内存布局紧凑，没有 V8 对象分配与 GC 压力；Babel 跑在 V8 里 |
| **并行** | esbuild 用多个 goroutine 并行解析；Babel 单线程，并行只能靠 `thread-loader` fork 进程 |
| **单遍转换** | esbuild 把内置转换合并进一条流水线；Babel 是通用插件架构，需要完整 AST 构建与插件调度 |
| **少做降级** | Babel 严格按规范生成冗长代码，`obj?.a` 会展开成 `var _obj; (_obj = obj) === null || _obj === void 0 ? void 0 : _obj.a;` |

Vite 8 的转译已改用 Oxc，esbuild 不在默认链路中；上述机制同样适用于 Oxc/Rolldown 这类原生实现的工具链。

---

## 3.6 HMR：两者的差距在哪

| | webpack HMR | Vite HMR |
|---|---|---|
| 更新粒度 | 模块级，但要重新生成受影响的 chunk | 模块级，直接让浏览器重新请求那个模块 |
| 实现机制 | 下发 `hot-update.json` + `hot-update.js` 补丁，运行时替换模块 | WebSocket 通知，浏览器 `import('/src/xxx.vue?t=...')` 重新拉取 |
| 大项目表现 | 重建范围随 chunk 图扩大 | 只失效一条 import 链 |
| 边界 | 模块需自己实现 `module.hot.accept`，否则冒泡到整页刷新 | 框架插件（`@vitejs/plugin-vue` 等）自动处理 |

```
① 文件改动 → ② watcher 捕获
③ 沿 import 图向上找 accept 边界：找到就只更新到该边界，找不到整页刷新
④ WebSocket 发送 { type: 'update', path, acceptedPath, timestamp }
⑤ 浏览器 import(`/src/Comp.vue?t=${timestamp}`)   ← 时间戳绕过缓存
⑥ 框架插件在 accept 回调里重新渲染
```

`?t=timestamp` 是关键：浏览器以 URL 为缓存 key，换时间戳等于换 URL，从而强制重新请求。Vite 客户端就是在 `importUpdatedModule` 里把 `?t=${timestamp}` 拼到路径上（`node_modules/vite/dist/client/client.mjs`）。

---

## 3.7 Vite 的坑（这题的高分在「缺点」）

| 坑 | 现象 | 原因 / 解法 |
|---|---|---|
| **首次启动要预构建** | 第一次 `vite` 明显慢于后续 | 预构建耗时取决于依赖体积；之后命中 `node_modules/.vite` 缓存，`--force` 可强制重建 |
| **依赖变化触发重新预构建** | 装包后重启变慢 | 缓存 key 含 lockfile 哈希、相关配置与 `NODE_ENV`，任一变化即重建 |
| **dev 与 build 的边界差异** | 开发正常、构建后报错 | 两边同为 Rolldown/Oxc，但 dev 按模块转译、build 整体打包，循环依赖、CJS `default` interop 仍可能不同 |
| **Vite 8 迁移项** | 旧配置失效 | `build.rollupOptions` → `build.rolldownOptions`；`manualChunks` 对象形式移除，改用 `codeSplitting`；`esbuild` / `optimizeDeps.esbuildOptions` 废弃 |
| **动态 import 拼接** | 运行时 404 | `import('./pages/' + name)` 无法静态分析，改用 `import.meta.glob` |
| **本地 link 的包不预构建** | 改了依赖不生效 | linked 包按源码处理；改动后重启并加 `--force` |
| **老浏览器** | IE11 无法运行 | dev 依赖原生 ESM；默认构建目标是 `baseline-widely-available`（Chrome 111 / Safari 16.4 起），`plugin-legacy` 也不支持降到 ES5 |

风险集中在「dev 按模块、build 整体打包」这条边界，而不是启动速度。

---

## 3.8 采访怎么说（2 分钟版）

- **架构差异**：webpack 启动时要生成完整依赖图并打包，成本是 O(模块数)；Vite dev 只起 server + 预构建依赖，业务代码按浏览器请求转译，成本与业务模块数无关。
- **裸模块名**：Vite 把 `import 'vue'` 重写成 `/node_modules/.vite/deps/vue.js?v=<browserHash>`，再由浏览器 ESM loader 继续解析。
- **预构建三件事**：CJS/UMD → ESM、合并多内部模块消除请求瀑布、结果缓存；必要时用 `optimizeDeps.include/exclude` 干预。
- **生产**：Vite 8 用 Rolldown + Oxc，不再用 Rollup/esbuild；esbuild 因代码分割、CSS、插件生态的短板没有成为生产打包器。
- **代价**：dev 按模块转译与 build 整体打包仍有边界差异，升级 Vite 8 还要改 `build.rolldownOptions` 等配置。

---

## 3.9 追问链

| 追问 | 答法 |
|---|---|
| Vite 开发时真的完全不打包吗？ | 业务代码不打包，**依赖会预构建打包**。准确说法是「业务代码按需编译 + 依赖预打包」 |
| 那 Vite 开发时请求数不是很多吗？ | 只有用到的模块才请求；webpack 会把没用的也打进 bundle。HTTP/2 下多请求的代价可以接受 |
| Vite 能用在生产吗？ | 能。Vite 8 的生产构建由 Rolldown 完成，Vue 官方脚手架的默认构建工具就是 Vite |
| 为什么不直接用 Rollup 做 dev？ | Rollup 是打包器；dev 需要按需编译 + HMR，Vite 在打包器之上另做了 dev server |
| esbuild 能替代 webpack 吗？ | 不能。代码分割、CSS、插件生态都弱；适合库打包、CLI 工具、Node 服务 |
| webpack 有没有「不打包」模式？ | 有实验性的 `experiments.lazyCompilation`，效果与 Vite 的按需编译不同 |
| 为什么 webpack 不改成 Vite 那样？ | 历史包袱：它的定位是「一切皆模块」的通用打包器，loader/plugin 体系建立在「先分析完再生成」上 |
| Turbopack / Rspack 是什么？ | Turbopack 是 Vercel 的 Rust 打包器（Next.js 用）；Rspack 是字节的 Rust 版 webpack，主打兼容 webpack 配置与插件 |
| Rolldown 是什么？ | Rollup 的 Rust 重写版，Vite 8 用它做依赖预构建和生产打包；插件 API 基本兼容 Rollup（少数 hook 未实现） |
| 怎么量化「Vite 快」？ | 用同一份脚本测冷启动、HMR 响应、改文件后的可见延迟，别只描述感觉 |

---

## 3.10 速记卡

```
启动：webpack O(模块数) · Vite dev O(依赖数)
链路：server + 预构建 → 按需转译 → 裸模块名重写成 /node_modules/.vite/deps/*.js?v=<browserHash>
预构建：CJS/UMD→ESM · 多模块合一 · 缓存在 .vite/deps（lockfile/config 变才重建）
生产：Rolldown + Oxc（Vite 8）；esbuild 只作历史对照
HMR：WebSocket update → import(url?t=timestamp)
坑：首次预构建 · Vite 8 配置改名 · 动态拼接 import · IE11
```

---

## 3.11 自测

```
□ 能解释 webpack 为什么必须先构建完整依赖图
□ 能说出裸模块名被重写成什么，?v= 从哪来
□ 能说出依赖预构建解决的三件事
□ 能说出 Vite 8 dev / build 分别用哪套工具
□ 能说出生产不用 esbuild 的四个原因
□ 能说清 ?t=timestamp 在 HMR 中的作用
□ 能说出 Vite 8 至少三个坑
□ 能说出 Rolldown 与 Rollup 的关系
```
