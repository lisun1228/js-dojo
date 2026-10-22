# Node 09｜npm 与包管理

> 覆盖题号：27（npm 是什么）
> 去重后：**1 个考点**——但这是题单里答案最短的一题（一句话），需要补到能应付追问

---

## 目录

- [9.1 题单答案的问题](#91-题单答案的问题)
- [9.2 一句话结论](#92-一句话结论)
- [9.3 `package.json` 的依赖字段（必问）](#93-packagejson-的依赖字段必问)
- [9.4 semver：`^` 和 `~` 的区别（必问）](#94-semver-和--的区别必问)
- [9.5 锁文件（`package-lock.json`）为什么必须有](#95-锁文件package-lockjson为什么必须有)
- [9.6 发布一个包（实操清单）](#96-发布一个包实操清单)
- [9.7 三个「依赖管理」的经典问题](#97-三个依赖管理的经典问题)
- [9.8 pnpm 为什么快、为什么省空间](#98-pnpm-为什么快为什么省空间)
- [9.9 面试怎么说（2 分钟版）](#99-面试怎么说2-分钟版)
- [9.10 追问总表](#910-追问总表)
- [9.11 速记卡](#911-速记卡)
- [9.12 自测](#912-自测)

---

## 9.1 题单答案的问题

> 「Node Package Manager，Node 的包管理工具和仓库。`npm install/publish/run`。」

**这是全篇最短的答案（20 字）**，而且只说了「是什么」。

面试官问「npm 是什么」通常只是个引子，真正的追问在后面：

- `dependencies` / `devDependencies` / `peerDependencies` 什么区别？
- `^1.2.3` 和 `~1.2.3` 什么区别？
- `package-lock.json` 有什么用？为什么要锁？
- 你发布过 npm 包吗？`files` 字段是干什么的？
- 幽灵依赖是什么？
- pnpm 为什么快？

**这些才是考点。** 本册按「从包的定义 → 依赖 → 锁定 → 发布 → 包管理器的演进」组织。

---

## 9.2 一句话结论

> npm 有三个身份：**命令行工具**（`npm install`）、**注册中心**（registry.npmjs.org）、**依赖规范**（`package.json` + semver）。

---

## 9.3 `package.json` 的依赖字段（必问）

| 字段 | 用途 | 会不会被安装到使用者项目 |
|---|---|---|
| **`dependencies`** | 运行时依赖（生产需要） | ✅ 会 |
| **`devDependencies`** | 开发/构建时依赖 | ❌ 不会（`npm i --production` 或使用者安装时） |
| **`peerDependencies`** | **「我需要宿主提供这个」** | ⚠️ **不自动装**（npm 7+ 会自动装，但有冲突会报错） |
| **`optionalDependencies`** | 可选依赖（装失败不报错） | ✅ 会（失败时跳过） |
| **`bundledDependencies`** | 打包进 tarball 的依赖 | ✅ 会（在包内部） |

### `peerDependencies` 是理解插件生态的关键

**典型场景：一个 React 组件库**

```json
{
  "name": "my-ui-lib",
  "peerDependencies": {
    "react": "^18.0.0"
  },
  "devDependencies": {
    "react": "^18.0.0"
  }
}
```

**为什么用 `peerDependencies` 而不是 `dependencies`**？

```
如果用 dependencies：
  my-ui-lib 自己的 node_modules 里装一份 React
  使用者的项目里也有一份 React
  → 两份 React 实例！
  → React Hooks 报错 "Invalid hook call"（因为 hooks 依赖同一个 React 实例）
  → Context 拿不到（两个不同的 createContext）
```

**`peerDependencies` 的含义是**：「我不带 React，我需要**宿主**提供它」。这样全局只有一个 React 实例。

> **这条能直接解释很多「组件库装了但用不了」的问题**：
> 「`peerDependencies` 的核心是**避免依赖被装两份**。React 的 hooks 和 Context 都依赖『同一个模块实例』，如果组件库自己装了一份 React，就会出现两个实例——表现为 `Invalid hook call` 或者 Context 取不到值。所以组件库必须把 React 放 `peerDependencies`。」

**`peerDependencies` 的三个坑**：

| 坑 | 说明 |
|---|---|
| **npm 7 之前不自动装** | 使用者得自己装 React，否则报错 |
| **npm 7+ 自动装但会冲突** | 如果使用者的 React 版本不满足 `^18`，`npm install` 直接失败（`ERESOLVE`） |
| **`peerDependenciesMeta.optional`** | 标记为可选，避免强制要求 |

```json
{
  "peerDependencies": { "react": "^18.0.0" },
  "peerDependenciesMeta": {
    "react": { "optional": true }
  }
}
```

---

## 9.4 semver：`^` 和 `~` 的区别（必问）

版本号 `1.2.3` = `主版本.次版本.修订号`（`major.minor.patch`）。

| 范围写法 | 允许升级到 | 记忆 |
|---|---|---|
| `1.2.3` | **只装 1.2.3** | 精确 |
| `~1.2.3` | `>=1.2.3 <1.3.0` | **只允许 patch** |
| `^1.2.3` | `>=1.2.3 <2.0.0` | **允许 minor + patch** |
| `^0.2.3` | `>=0.2.3 <0.3.0` | ⚠️ **0.x 时 `^` 只允许 patch** |
| `*` / `latest` | 任意 | 危险 |
| `>=1.2.3 <2` | 显式区间 | 清晰 |

### `^0.x` 的特殊规则（容易错）

```
^1.2.3  →  >=1.2.3 <2.0.0     （minor 可以升）
^0.2.3  →  >=0.2.3 <0.3.0     （minor 不能升！）
^0.0.3  →  >=0.0.3 <0.0.4     （只有这一个版本）
```

**原因**：semver 规定 `0.x` 是「开发阶段」，API 不稳定。所以 `0.x` 的 minor 升级被视为 **breaking**。

> **面试时的说法**：
> 「`^` 和 `~` 的区别是**允许升级到哪一位**。`~1.2.3` 只允许 patch 升级（1.2.x），`^1.2.3` 允许 minor 升级（1.x.x）。
>
> 但有个特殊规则：**`^0.x` 和 `^1.x` 行为不同**。因为 semver 规定 0.x 是开发阶段、API 不稳定，所以 `^0.2.3` 只允许 patch（等价于 `~0.2.3`）。**这就是为什么很多库在 1.0 之前不敢用 `^`。**」

### 那到底该用哪个

| 场景 | 建议 |
|---|---|
| **业务应用** | `^`（方便拿安全修复）+ **锁文件**（保证可复现） |
| **库** | `^`（放宽 peer 兼容性），但要测多个版本 |
| **CI / 生产** | **锁文件 + `npm ci`**（不用 `^` 的浮动） |

---

## 9.5 锁文件（`package-lock.json`）为什么必须有

### 没有锁文件会怎样

```
package.json:  "lodash": "^4.17.0"

今天安装  → lodash 4.17.21
三个月后  → lodash 4.17.25（上游发了新版）
```

**代码一行没改，依赖变了。** 这会导致：

- 「昨天还好的，今天突然报错」
- 本地能跑、CI 失败
- 回滚代码也修不好（因为依赖是新装的）

### 锁文件的三个作用

| 作用 | 说明 |
|---|---|
| **锁定精确版本** | 记录每个包的实际版本（含嵌套依赖） |
| **锁定完整依赖树** | 不只顶层，是整棵树 |
| **记录 integrity（哈希）** | 防篡改，保证下载的是同一个文件 |

### `npm install` vs `npm ci`（CI 必须用后者）

| | `npm install` | `npm ci` |
|---|---|---|
| 读锁文件 | 会，但**可能更新它** | ✅ 严格按锁文件 |
| 锁文件不一致时 | **自动修改锁文件** | ❌ **直接报错退出** |
| 是否删 `node_modules` | 不删 | ✅ 先删再装 |
| 速度 | 较慢 | **更快**（跳过解析） |
| 适用 | 本地开发 | **CI / Docker / 生产** |

> **这一条在工程化那册也提过，这里再强调**：
> 「CI 里必须用 `npm ci`。因为 `npm install` 在锁文件和 package.json 不一致时会**悄悄修改锁文件**——这意味着 CI 装的依赖可能和本地不一样，构建就不可复现了。`npm ci` 遇到不一致直接报错，逼你先修好。」

---

## 9.6 发布一个包（实操清单）

### 实测：`files` 字段是白名单

我建了一个包，`package.json` 里有 `"files": ["dist", "README.md"]`，还故意放了 `src/secret.js` 和 `.env`。

`npm pack --dry-run` 实测输出：

```
npm notice 📦  @acme/demo-lib@1.2.3
npm notice Tarball Contents
npm notice 7B README.md
npm notice 19B dist/index.cjs
npm notice 31B dist/index.d.ts
npm notice 17B dist/index.mjs
npm notice 17B dist/utils.mjs
npm notice 504B package.json
npm notice Tarball Details
npm notice package size: 480 B
npm notice total files: 6
```

**只有 6 个文件。`src/secret.js` 和 `.env` 都被排除了。**

**规则**：

```
有 files 字段 → 白名单模式，只发布列出的
没有 files    → 黑名单模式，用 .npmignore 排除（或 .gitignore）
```

**两个必须知道的细节**：

1. **`package.json`、`README.md`、`LICENSE` 总是会被包含**（不管 files 里写没写）
2. **`files` 的优先级高于 `.npmignore`**

> **「发布前必做的一步」**：
> 「`npm publish` 之前我一定先跑 `npm pack --dry-run`。因为**它会把要发布的文件全部列出来**。我见过太多人把 `node_modules`、测试文件、甚至 `.env` 一起发出去——**一旦发布就无法彻底删除**（npm 允许 unpublish，但 24 小时后就不能了，而且可能已经被别人装走）。」

### 发布清单（10 项）

```json
{
  "name": "@scope/name",              // ① 带 scope 的包名
  "version": "1.0.0",                  // ② 语义化版本
  "description": "一句话说明",          // ③ 影响搜索结果
  "keywords": ["a", "b"],              // ④ 影响搜索
  "license": "MIT",                    // ⑤ 必须写，否则警告
  "repository": { "type": "git", "url": "..." },   // ⑥ 源码链接
  "main": "./dist/index.cjs",          // ⑦ CJS 入口
  "module": "./dist/index.mjs",        // ⑧ ESM 入口（打包器用）
  "types": "./dist/index.d.ts",        // ⑨ 类型
  "exports": { ... },                  // ⑩ 现代入口（优先级最高）
  "files": ["dist"],                   // ⑪ 只发必要文件
  "sideEffects": false,                // ⑫ 让 tree shaking 生效
  "engines": { "node": ">=18" }        // ⑬ 声明运行时要求
}
```

### 入口字段的优先级（容易混）

```
exports  >  module  >  main
```

| 工具 | 用哪个 |
|---|---|
| Node（`import`） | `exports` 的 `import` 条件 |
| Node（`require`） | `exports` 的 `require` 条件 |
| Webpack / Vite / Rollup | `exports`（现代）/ `module`（老版本）/ `main` |
| TypeScript | `exports` 的 `types` 条件 / `types` 字段 |

**所以「双格式包」的标准写法**（03 册有完整实测）：

```json
{
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    },
    "./package.json": "./package.json"
  }
}
```

**`types` 必须放第一个**——TS 按顺序匹配，条件满足就停。

---

## 9.7 三个「依赖管理」的经典问题

### 问题 1：幽灵依赖（phantom dependency）

**现象**：你能 `import` 一个**没在 `package.json` 里声明**的包，而且能跑。

```
npm 的 node_modules（扁平化）：
node_modules/
├── lodash/          ← 你声明的
├── ms/              ← 你没声明，但 lodash 依赖它，被"提升"到顶层
└── debug/           ← 同上

→ 你的代码可以 import 'ms'，但它不在你的 package.json 里
```

**为什么危险**：

- 哪天 `lodash` 升级不再依赖 `ms`，你的代码立刻挂
- 换包管理器（pnpm）立刻挂
- 别人 clone 你的项目，可能装不出一样的依赖树

**pnpm 怎么解决**：用**符号链接**，只有声明过的包才出现在顶层。

```
pnpm 的 node_modules：
node_modules/
├── lodash -> .pnpm/lodash@4/node_modules/lodash
└── .pnpm/
    ├── lodash@4/node_modules/{lodash, ms}
    └── ms@2/node_modules/ms

→ import 'ms' 直接报「找不到模块」，问题被暴露
```

### 问题 2：重复依赖（同一包多个版本）

```
$ npm ls react
my-app
├── react@18.2.0
└── some-lib@1.0.0
    └── react@17.0.2        ← 另一个版本！
```

**后果**：两份 React 实例 → hooks 报错、Context 不通。

**怎么发现**：`npm ls <pkg>` 或 `npm dedupe`（尝试合并兼容版本）。

**怎么避免**：用 `peerDependencies`（库）+ 定期跑 `npm ls`（应用）。

### 问题 3：`npm install` 后的「意外升级」

```
"lodash": "^4.17.0"    → 今天装到 4.17.21
                       → 三个月后新同事 clone，装到 4.17.25
                       → 行为变了
```

**解法**：**锁文件必须提交到 git**。

> **「锁文件要不要提交」这个问题可以这样答**：
> 「必须提交。**锁文件的作用就是让所有人装到同一份依赖树。**如果只有 `package.json`，那每个人的 `^` 浮动范围都会解析出不同版本。**唯一的例外是『库』——库不提交锁文件**（因为使用者不会用你的锁文件，提交了反而是噪音）。所以规则是：**应用提交锁文件，库不提交**。」

---

## 9.8 pnpm 为什么快、为什么省空间

### 硬链接 + 符号链接

```
pnpm：
① 全局 store（~/.pnpm-store）存一份真实文件（内容寻址，按哈希存）
② 项目的 node_modules/.pnpm/<pkg>@<ver>/ 用【硬链接】指向 store
③ node_modules/<pkg> 用【符号链接】指向 .pnpm 里那份
```

| 链接 | 位置 | 作用 |
|---|---|---|
| **硬链接** | `.pnpm/<pkg>@<ver>/node_modules/<pkg>` → 全局 store | **省磁盘**：同一份文件多个目录名指向同一块数据 |
| **符号链接** | `node_modules/<pkg>` → `.pnpm/...` | **隔离依赖**：只有声明过的才在顶层 |

**效果**：

- 10 个项目用同一个 React → **磁盘上只有 1 份**
- 安装速度：省掉复制文件的时间
- 幽灵依赖被暴露

### 三种包管理器对比

| | npm | yarn (classic) | pnpm |
|---|---|---|---|
| 依赖结构 | 扁平化（提升） | 扁平化 | **符号链接 + 硬链接** |
| 磁盘占用 | 每项目一份 | 每项目一份 | **全局共享一份** |
| 幽灵依赖 | ❌ 会掩盖 | ❌ 会掩盖 | ✅ **暴露** |
| 安装速度 | 中 | 较快（有缓存） | **最快** |
| monorepo | workspaces | workspaces | **workspace 更好用** |
| 严格性 | 松 | 松 | **严（默认不允许非法依赖）** |

> **选型建议**：
> 「新项目我默认 pnpm——**省磁盘、装得快、还暴露幽灵依赖**。唯一要注意的是有些老包会硬编码读 `node_modules` 的路径，pnpm 的符号链接结构可能让它找不到，这时候要配 `node-linker=hoisted` 降级成 npm 那种扁平结构。」

---

## 9.9 面试怎么说（2 分钟版）

> 「npm 我会从三个身份说：**命令行工具**、**注册中心**、**依赖规范**。
>
> 但真正容易考的是依赖字段。`dependencies` 是运行时依赖，`devDependencies` 是构建时的，**`peerDependencies` 最容易被误解**——它的意思是『我需要宿主提供』。组件库必须把 React 放这里，否则组件库自己装一份、使用者项目装一份，就出现两个 React 实例，hooks 会报 `Invalid hook call`。
>
> 然后是 semver。`~1.2.3` 只允许 patch 升级，`^1.2.3` 允许 minor。但有个特殊规则：**`^0.x` 等价于 `~0.x`**——因为 semver 规定 0.x 是开发阶段、API 不稳定。
>
> 锁文件必须提交。**CI 里必须用 `npm ci` 而不是 `npm install`**——因为 `npm install` 会在锁文件和 package.json 不一致时悄悄改锁文件，那构建就不可复现了。`npm ci` 遇到不一致直接报错。
>
> 发布这块我有一个习惯：**`npm publish` 之前先跑 `npm pack --dry-run`**。它会把要发的文件全列出来。我实测过 `files` 字段是白名单——写了 `["dist"]` 之后，`src/` 和 `.env` 都不会被打包。**一旦发布就无法彻底删除，所以这一步不能省。**
>
> 最后是选型。新项目我默认 pnpm，原因是 **`node_modules` 用符号链接而不是扁平化**——好处是省磁盘（全局 store + 硬链接）、装得快、**还顺带暴露了幽灵依赖**（`import` 一个没声明的包会直接报错，而不是靠提升碰巧能跑）。」

---

## 9.10 追问总表

| 问题 | 答法 |
|---|---|
| npm 三个身份？ | 命令行工具 / 注册中心 / 依赖规范 |
| `dependencies` 和 `devDependencies`？ | 运行时 vs 构建时。生产安装用 `--production` 跳过 dev |
| `peerDependencies` 是什么？ | 「需要宿主提供」，避免依赖被装两份 |
| 为什么组件库要用 peer？ | 两份 React 实例会导致 hooks 报错、Context 不通 |
| peer 在 npm 7+ 有什么变化？ | 会自动安装，但版本冲突会 `ERESOLVE` 失败 |
| `^` 和 `~` 区别？ | `~` 只升 patch，`^` 升 minor+patch |
| `^0.2.3` 升到哪？ | `<0.3.0`（0.x 时 `^` 等价于 `~`） |
| 锁文件为什么要提交？ | 保证所有人装到同一份依赖树 |
| 库要提交锁文件吗？ | **不要**（使用者不会用你的锁文件） |
| `npm ci` 和 `install` 区别？ | ci 严格按锁文件、先删 node_modules、不一致就报错 |
| `files` 字段是什么模式？ | **白名单**，只发布列出的是配合 |
| 哪些文件总会被包含？ | `package.json`、`README.md`、`LICENSE` |
| 发布前必做什么？ | `npm pack --dry-run` 看文件清单 |
| 入口字段优先级？ | `exports` > `module` > `main` |
| `types` 条件为什么放第一？ | TS 按顺序匹配，先命中就停 |
| 幽灵依赖是什么？ | `import` 了没声明的包，靠提升碰巧能跑 |
| pnpm 怎么解决幽灵依赖？ | 符号链接，只有声明过的才在顶层 |
| pnpm 两种链接各干什么？ | 硬链接省磁盘，符号链接隔离依赖 |
| 同一包多个版本怎么办？ | `npm ls` 查、`npm dedupe` 合、库用 peer 避免 |

---

## 9.11 速记卡

```
【npm 三个身份】
命令行工具 / 注册中心 / 依赖规范

【五个依赖字段】
dependencies            运行时，会被装
devDependencies         构建时，生产安装跳过
peerDependencies        「需要宿主提供」，不自动装（npm7+ 自动装但冲突报错）
optionalDependencies    装失败不报错
bundledDependencies     打进 tarball

★ peer 的价值：避免依赖装两份
  两份 React → Invalid hook call / Context 取不到
  peerDependenciesMeta.optional 可标记为可选

【semver】
1.2.3   精确
~1.2.3  >=1.2.3 <1.3.0    只允许 patch
^1.2.3  >=1.2.3 <2.0.0    允许 minor+patch
★ ^0.2.3 >=0.2.3 <0.3.0   0.x 时 ^ 等价于 ~（API 不稳定）

【锁文件】
作用：锁定精确版本 + 完整依赖树 + integrity 哈希
★ 应用提交，库不提交
★ CI 用 npm ci：
   install 会悄悄改锁文件 → 构建不可复现
   ci 严格按锁文件 + 先删 node_modules + 不改文件 + 更快

【发布】
★ npm publish 前必跑 npm pack --dry-run
实测：files:["dist","README.md"] → 只打 6 个文件
     src/secret.js、.env 全部被排除
files 是白名单（优先级高于 .npmignore）
package.json / README.md / LICENSE 总会被包含

入口优先级：exports > module > main
双格式包：
  exports: { ".": { "types": ..., "import": ..., "require": ... } }
  ★ types 必须第一个（TS 按顺序匹配）

【三个依赖问题】
幽灵依赖   import 了没声明的包，npm 提升掩盖，pnpm 暴露
重复版本   npm ls 查、npm dedupe 合、库用 peer 避免
意外升级   ^ 浮动 + 无锁文件 → 交锁文件 + CI 用 ci

【pnpm 两种链接】
硬链接：.pnpm/<pkg> → 全局 store    → 省磁盘（同一份数据多个名字）
符号链接：node_modules/<pkg> → .pnpm → 隔离依赖（暴露幽灵依赖）
效果：10 个项目共用 1 份 React / 装得快 / 幽灵依赖报错

【三种包管理器】
npm     扁平提升，掩盖幽灵依赖，每项目一份
yarn    类似 npm，缓存好
pnpm    符号链接 + 硬链接，最省最快最严格
老包硬编码读 node_modules → 配 node-linker=hoisted
```

---

## 9.12 自测

```
□ 能说出 npm 的三个身份
□ 能区分五个依赖字段
□ 能解释 peerDependencies 解决什么问题（两份实例的危害）
□ 能说出 peer 在 npm 7 前后的行为差异
□ 能默写 semver 的四种范围写法
□ 能说出 ^0.x 的特殊规则和原因
□ 能说出锁文件的三个作用
□ 能说出 npm ci 和 npm install 的四个区别
□ 能说出为什么库不提交锁文件
□ 能说出 files 字段是白名单、以及哪些文件总被包含
□ 能说出发布前必须先跑什么命令、为什么
□ 能说出入口字段的优先级和 types 为什么放第一
□ 能写出双格式包的 exports 配置
□ 能解释幽灵依赖的成因和危害
□ 能说出 pnpm 两种链接各解决什么问题
□ 能说出 pnpm 在老包兼容上的坑和解法
□ 能说出发现重复依赖的命令
```
