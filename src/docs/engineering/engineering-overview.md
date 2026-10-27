# 前端工程化 34 题｜总览与索引

> 覆盖：题单 34 题 —— 21 题有正文、7 题「同第 N 题」、6 题跨文档引用
> 整理：去重后 20 个考点，按工程化层次拆成 8 册

---

## 0.1 先说结论：34 题实际是 20 个考点

| 层级 | 数量 | 题号 |
|---|---|---|
| 标题声称 | 34 | — |
| 有实际内容 | 21 | 1,2,3,4,5,6,7,9,13,14,15,16,20,22,24,25,26,27,31,32,33 |
| 「同第 N 题」 | 7 | 8,19,21,28,29,30,34 |
| 「同 XX 文档第 N 题」 | 6 | 10,11,12,17,18,23 |
| 合并同类 + 补全 17/18 | 20 个考点 | 见 0.2 的 8 册映射 |

### 7 道「同第 N 题」

| 题号 | 指向 | 指向的那题本身是什么 |
|---|---|---|
| 8 | 同第 6 题 | rebase 与 merge 选择（有正文） |
| 19 | 同第 3 题 | CI/CD（有正文） |
| 21 | 同第 18 题 | 18 又指向性能优化文档第 11 题，二级悬空 |
| 28 | 同第 23 题 | 23 又指向安全文档，二级悬空 |
| 29 | 同第 23 题 | 同上 |
| 30 | 同第 20 题 | tree shaking（有正文） |
| 34 | 同第 7 题 | rebase 冲突（有正文） |

21、28、29 的指向本身也是指针，形成二级悬空。

### 6 道跨文档悬空

| 题号 | 题目 | 原文答案 | 判定 |
|---|---|---|---|
| 10 | HTTP 和 HTTPS 区别 | 同 HTML 文档第26题 | 网络领域，见 `network-https-tls.md` |
| 11 | HTTP 缓存哪些 header | 同 HTML 文档第29题 | 网络领域，见 `network-http-cache.md` |
| 12 | HTTP 状态码 | 同 HTML 文档第4题 | 网络领域，见 `network-http-message.md` |
| 17 | loader 和 plugin 区别 | 同 HTML 文档第24题 | 工程化核心题，本册补全 |
| 18 | Webpack 打包原理 | 同性能优化文档第11题 | 工程化核心题，本册补全 |
| 23 | 跨域原因与解决 | 同安全文档 | 网络/安全领域，见 `security-cors-websocket.md` |

处理方式：

- 10/11/12/23 在本册不重复写，0.8 给出对应文件
- 17/18 在本册补全：loader/plugin 与打包原理属于 Webpack 核心

---

## 0.2 20 个考点 → 8 册映射

| 册 | 考点数 | 内容 | 对应题号 |
|---|---|---|---|
| 00 | — | 总览、去重表、六层模型、答题方法论 | — |
| 01 | 2 | 工程化全景、CLI 脚手架 | 24、1 |
| 02 | 5 | Webpack 打包原理、loader vs plugin、tapable、手写 loader、手写 plugin | 18、17、15、32、22 |
| 03 | 1 | Vite / Rolldown / esbuild / webpack 对比与「为什么快」 | 14、31 |
| 04 | 1 | Babel 三阶段与 AST | 2 |
| 05 | 2 | Tree Shaking 原理、产物体积优化 | 20、30、16 |
| 06 | 3 | ESLint vs Prettier、Lint 原理、单元测试 | 5、13、26 |
| 07 | 3 | CI/CD、Docker、SPA 部署 404 | 3、19、25、27、4、33 |
| 08 | 3 | merge vs rebase、rebase 冲突、Git 命令 | 6、8、7、34、9 |

---

## 0.3 工程化的六层模型（先建立框架，再背细节）

工程化问题跨度大，先按层归类，再把具体问题挂到对应的层上。

```
第 6 层  监控与度量     Sentry / 埋点 / 性能监控 / 告警
第 5 层  部署与交付     CI/CD / Docker / Nginx / CDN / 灰度
第 4 层  测试与质量     单元测试 / E2E / 覆盖率 / 质量门禁
第 3 层  规范与约束     ESLint / Prettier / commitlint / husky / TS
第 2 层  构建与编译     Webpack / Vite / Babel / Tree Shaking / 产物优化
第 1 层  开发与协作     目录规范 / Git 工作流 / 脚手架 / Monorepo / 包管理
```

用法：

- 被问「你对工程化的理解」时，先给六层范围，再逐层说解决什么问题
- 第 1-2 层解决多人协作与目标环境：目录规范、Git 流、脚手架、Webpack/Vite/Babel
- 第 3-4 层解决约束与验证：ESLint/Prettier、commitlint、测试与质量门禁
- 第 5-6 层解决上线与反馈：CI/CD、Docker、Nginx/CDN、监控与告警

---

## 0.4 工程化题和前面的题不一样：它考「决策」不考「实现」

| 题型 | 考什么 | 答法 |
|---|---|---|
| JS 手写题 | **能不能写对** | 写代码 + 补边界 |
| 网络原理题 | **记不记得机制** | 讲清流程 + 关键细节 |
| **工程化题** | **能不能做技术决策** | **讲清取舍 + 说出踩过的坑** |

回答的差别：

- 定义式只覆盖「是什么」，例如「tree shaking 删除未使用代码，基于 ESM 静态分析」
- 决策式补上机制、成立前提与失效场景，三者缺一不可
- 同一机制在配置关闭时会失效，结论要能落到可复现的验证方式

---

## 0.5 工程化题的三段式答法

### 第一段：先说「解决什么问题」（15 秒）

先给问题归位：这项技术解决的是产物体积、构建速度还是协作成本，再给它的替代方案。

### 第二段：讲机制 + 关键前提（60 秒）

讲清输入、处理与产物；列出成立前提（如 ESM、`sideEffects`、压缩器）与关键配置。

### 第三段：说取舍 + 踩过的坑（30 秒）

给出代价与不适用场景，并说明误用后的现象与验证方式。

三段比例约 1:3:1，第三段需要具体失败模式，不能只写「注意配置」。

---

## 0.6 题单的 6 个问题

| # | 问题 | 证据 |
|---|---|---|
| 1 | 6 题指向其他文档 | 10、11、12、17、18、23 |
| 2 | 3 处二级悬空 | 21 指向 18，28/29 指向 23 |
| 3 | 答案停留在定义 | 缺机制与边界 |
| 4 | 混入网络/安全题 4 道 | 10、11、12、23 |
| 5 | 未涉及取舍 | 只有「是什么」，没有「何时不该用」 |
| 6 | 缺 5 个高频考点 | Monorepo、包管理、HMR、持久化缓存、提交规范 |

### 题单缺的 5 个高频考点

| 缺失考点 | 涉及内容 |
|---|---|
| **Monorepo**（pnpm workspace / Turborepo） | 跨包改动一致性、任务编排与增量构建 |
| **包管理与依赖**（pnpm 硬链接、锁文件、幽灵依赖） | 依赖隔离、可复现安装、磁盘占用 |
| **HMR 原理** | 文件改动到页面局部刷新的链路 |
| **持久化缓存**（webpack filesystem cache / Vite deps 缓存） | 二次构建速度与失效条件 |
| **提交规范**（commitlint + husky + lint-staged） | 提交信息校验与暂存区检查 |

---

## 0.7 本册的实测数据（可以先记结论）

### Tree Shaking 的四个阶段（同一份源码，逐级开配置）

- webpack（按文档，未在本仓库复测）：`usedExports` 只插入 `/* unused harmony export */` 注释，函数体保留；删除由 Terser 完成，`minimize: false` 时没有删除。
- Rolldown/Rollup：未使用导出在打包阶段删除。05 册以 Rolldown 1.2.13 实测，默认 `treeshake` 且不压缩为 399 B，开 `minify` 为 204 B；`moduleSideEffects: false` 为 246 B，再压缩为 101 B。
- `sideEffects` / `moduleSideEffects` 是模块级开关，决定「没有导出被使用的模块」能否整块跳过。

### Babel vs esbuild 速度（200 个模块 / 84.4 KB）

- 200 个模块、84.4 KB：Babel 逐个 transform 1956 ms，esbuild 逐个 transform 100 ms（19.6×），esbuild 完整 bundle + minify 15 ms。
- 环境为 Node 22.22.2、`@babel/core` 8.0.7、esbuild 0.28.2，该组数字未在本仓库复现（见 03 册）。
- 130× 同时包含 tree shaking 与目标差异，不能按同口径采信；Babel 目标 IE11、esbuild 目标 ES2015。

### tapable 九种钩子的语义差异

- `SyncHook`：依次执行，不接收返回值
- `SyncWaterfallHook`：前一个的返回值作为后一个的入参
- `SyncBailHook`：返回非 `undefined` 即中断后续
- `SyncLoopHook`：返回非 `undefined` 就重头执行
- `AsyncSeriesHook` / `AsyncParallelHook`：串行 / 并行

### loader 链的执行顺序（洋葱模型）

- 配置 `use: [l1, l2, l3]`：pitch 阶段左→右（l1→l3），normal 阶段右→左（l3→l1）。
- 产物里的追加顺序为 l3→l2→l1，整条链是洋葱模型。

### git merge vs rebase（同一个分叉）

- merge：保留分叉，原 5 个提交加 1 个 merge commit，B、C 的 hash 不变。
- rebase：5 个提交，历史线性，B、C 的 hash 改变——rebase 重放变更并产生新提交，不是移动提交。

### rebase 冲突现场的关键认知

- rebase 冲突中 `HEAD` 指向目标分支（main），不是正在被 rebase 的 feature；merge 冲突时 `HEAD` 是当前分支。

---

## 0.8 跨册索引：这 4 道题不在这里重复写

| 题号 | 题目 | 去哪看 |
|---|---|---|
| 10 | HTTP 和 HTTPS 区别 | `network-https-tls.md` |
| 11 | HTTP 缓存哪些 header | `network-http-cache.md` |
| 12 | HTTP 状态码 | `network-http-message.md` |
| 23 | 跨域原因与解决 | `security-cors-websocket.md` |

这 4 题考网络协议与安全机制，正文在对应分册；工程化的落点是构建与部署配置：

- 开发环境：`devServer.proxy` 转发请求
- 生产环境：Nginx 反代、`add_header` 与 `try_files`
- 关注点：本地与生产的环境一致性

---

## 0.9 工程化自测（三级）

### L1 基础（必须会说，15 项）

```
□  1. 用一句话说清「前端工程化」是什么
□  2. 说出工程化的六层模型
□  3. 说清 CLI 脚手架的 6 个环节
□  4. 说清 webpack 打包的三个阶段
□  5. 说出 loader 和 plugin 的三个区别
□  6. 说出 loader 链的执行顺序（pitch / normal）
□  7. 说出 tapable 是什么，为什么 webpack 需要它
□  8. 说出 Vite 开发为什么快（一句话）
□  9. 说清 Babel 三个阶段
□ 10. 说出 tree shaking 的三个前提
□ 11. 说出 CI / CD 分别是什么
□ 12. 说出 docker 镜像和容器的区别
□ 13. 说出 merge 和 rebase 的一句话区别
□ 14. 说出 rebase 冲突时 HEAD 指向谁
□ 15. 说出 SPA 刷新 404 的两个解法
```

### L2 进阶（区分度在这里，20 项）

```
□ 16. 说出为什么 loader 要从右往左执行
□ 17. 说出 plugin 的 apply 方法里能做哪些事
□ 18. 说出 SyncBailHook / SyncWaterfallHook 的区别和使用场景
□ 19. 说出 Vite 生产环境为什么用 Rolldown 而不是 esbuild
□ 20. 说出 Babel 为什么不能处理 Promise / includes
□ 21. 说出 polyfill 和 transform 的区别
□ 22. 说出 usedExports 和 sideEffects 各自的作用
□ 23. 说出为什么 minimize:false 时 tree shaking 失效
□ 24. 说出 package.json 里 sideEffects:false 的作用和风险
□ 25. 说出 ESLint 和 Prettier 谁管什么，怎么配合
□ 26. 说出 Lint 工具为什么能发现错误（AST 层面）
□ 27. 说出单元测试覆盖率不能反映什么
□ 28. 说出 docker 分层缓存怎么利用
□ 29. 说出为什么 production 镜像要用多阶段构建
□ 30. 说出发到 CDN 后 index.html 为什么不能强缓存
□ 31. 说出 rebase 为什么不能用在公共分支
□ 32. 说出 reset --soft/--mixed/--hard 的区别
□ 33. 说出 reflog 能救回什么
□ 34. 说出 revert 和 reset 的本质区别
□ 35. 说出 Monorepo 的三个好处和两个成本
```

### L3 精通（能讲取舍，15 项）

```
□ 36. 说出你们项目为什么选 Vite（或 webpack），另一个为什么不行
□ 37. 说出一次「构建变慢」你是怎么定位的
□ 38. 说出一次「产物变大」你是怎么定位的
□ 39. 说出 webpack 5 持久化缓存的原理和失效场景
□ 40. 说出 HMR 的完整链路（从文件改动到页面局部刷新）
□ 41. 说出 Vite 的「预构建」解决什么问题、什么时候需要手动加
□ 42. 说出 pnpm 的硬链接和符号链接分别解决了什么
□ 43. 说出「幽灵依赖」是什么、怎么避免
□ 44. 说出你项目里的质量门禁有哪几道
□ 45. 说出 CI 流水线你会放哪几个步骤、顺序为什么这么排
□ 46. 说出「构建产物不可复现」的常见原因
□ 47. 说出 sourcemap 在生产环境该怎么配
□ 48. 说出微前端的三种实现方式及各自的代价
□ 49. 能讲出一个具体工程化故障的现象、定位与根因
□ 50. 能说出一次工程化架构的替代方案与取舍
```

---

## 0.10 分册导航

| 文件 | 核心问题 | 建议优先级 |
|---|---|---|
| `engineering-panorama-scaffold.md` | 什么是工程化、怎么搭一套 | ⭐⭐⭐ |
| `engineering-webpack.md` | 打包怎么跑的、loader/plugin 怎么写 | ⭐⭐⭐⭐⭐ |
| `engineering-vite.md` | Vite 为什么快、和 webpack 怎么选 | ⭐⭐⭐⭐⭐ |
| `engineering-babel-ast.md` | 代码怎么被降级、AST 是什么 | ⭐⭐⭐⭐ |
| `engineering-tree-shaking.md` | 包怎么变小 | ⭐⭐⭐⭐⭐ |
| `engineering-lint-quality.md` | 怎么保证代码质量 | ⭐⭐⭐ |
| `engineering-cicd-deploy.md` | 怎么自动化上线 | ⭐⭐⭐⭐ |
| `engineering-git-workflow.md` | 多人怎么协作不打架 | ⭐⭐⭐⭐ |

时间有限时按 02 → 03 → 05 → 08 阅读：打包、构建工具、产物优化、Git 协作。

---

## 0.11 一句话速记

> **工程化面试考的是在多个方案里给出有理由的选择。**
>
> 只比较「Vite 比 webpack 快」，缺少机制与边界；
> 说清「开发态不打包所以快，生产态用 Rolldown 因为 esbuild 的代码分割与 CSS 处理不成熟」，落到机制；
> 能给出「因兼容 IE11 与大量 CJS 依赖，留在 webpack 5 + 持久化缓存」这类约束，说明选择有边界。
