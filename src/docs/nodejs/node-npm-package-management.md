# Node 09｜npm 与包管理

> 覆盖题号：27（npm 是什么）
> 题单原答案只有一句话，本册按「包的定义 → 依赖 → 锁定 → 发布 → 包管理器的演进」展开

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

这个答案只覆盖「是什么」。面试官问「npm 是什么」通常只是引子，追问在后头：

- `dependencies` / `devDependencies` / `peerDependencies` 什么区别？
- `^1.2.3` 和 `~1.2.3` 什么区别？
- `package-lock.json` 有什么用？为什么要锁？
- 发布 npm 包时 `files` 字段是干什么的？
- 幽灵依赖是什么？
- pnpm 为什么快？

---

## 9.2 一句话结论

> npm 有三个身份：**命令行工具**（`npm install`）、**注册中心**（registry.npmjs.org）、**依赖规范**（`package.json` + semver）。

---

## 9.3 `package.json` 的依赖字段（必问）

| 字段 | 用途 | 是否装进使用者项目 |
|---|---|---|
| **`dependencies`** | 运行时依赖 | ✅ |
| **`devDependencies`** | 开发 / 构建依赖 | ❌（`npm i --omit=dev` 跳过；`--production` 是已弃用别名） |
| **`peerDependencies`** | 由宿主提供 | ⚠️ npm 7+ 默认自动装，版本冲突报 `ERESOLVE` |
| **`optionalDependencies`** | 可选依赖 | ✅（装失败跳过） |
| **`bundledDependencies`** | 打进 tarball | ✅（包内自带） |

### `peerDependencies` 是理解插件生态的关键

组件库的典型写法：

```json
{
  "name": "my-ui-lib",
  "peerDependencies": { "react": "^18.0.0" },
  "devDependencies": { "react": "^18.0.0" }
}
```

- 放 `dependencies`：组件库和使用者项目各装一份 React → 两个实例 → hooks 报 `Invalid hook call`、Context 取不到值
- 放 `peerDependencies`：组件库不带 React，要求**宿主**提供，全局只有一个实例

**三个坑**：

| 坑 | 说明 |
|---|---|
| npm 6 及之前不自动装 | 使用者需自己装，否则运行时报错 |
| npm 7+ 自动装但会冲突 | 宿主版本不满足 `^18` 时 `npm install` 失败（`ERESOLVE`） |
| `peerDependenciesMeta.optional` | 标记为可选：`{"react": {"optional": true}}`，npm 不会自动装 |

---

## 9.4 semver：`^` 和 `~` 的区别（必问）

版本号 `1.2.3` = `主版本.次版本.修订号`（`major.minor.patch`）。`semver.validRange` 展开的实际区间：

| 范围写法 | 实际区间 | 记忆 |
|---|---|---|
| `1.2.3` | `1.2.3` | 精确 |
| `~1.2.3` | `>=1.2.3 <1.3.0-0` | **只允许 patch** |
| `^1.2.3` | `>=1.2.3 <2.0.0-0` | **允许 minor + patch** |
| `^0.2.3` | `>=0.2.3 <0.3.0-0` | `0.x` 时 minor 不升 |
| `^0.0.3` | `>=0.0.3 <0.0.4-0` | 只有这一版 |
| `>=1.2.3 <2` | `>=1.2.3 <2.0.0-0` | 显式区间 |
| `*` | 任意版本 | 危险；`latest` 是 dist-tag，装当时最新 |

### `^0.x` 的边界（容易错）

`^` 在 `0.x` 上分两档：`^0.2.3`（`>=0.2.3 <0.3.0`）与 `~0.2.3` 相同；但 `^0.0.3`（`<0.0.4`）比 `~0.0.3`（`<0.1.0`）更严。

**原因**：semver 把 `0.x` 视为开发阶段，minor 升级按 breaking 处理。

### 那到底该用哪个

| 场景 | 建议 |
|---|---|
| **业务应用** | `^`（方便拿安全修复）+ **锁文件**（保证可复现） |
| **库** | `^`（放宽 peer 兼容性），但要测多个版本 |
| **CI / 生产** | **锁文件 + `npm ci`**（不依赖 `^` 的浮动） |

---

## 9.5 锁文件（`package-lock.json`）为什么必须有

`package.json` 写 `"lodash": "^4.17.0"`，安装时按范围解析到当前最新版；上游发版后，同一份 `package.json` 会装出不同的依赖树。后果是「昨天还好好的，今天突然报错」、本地能跑 CI 失败、回滚代码也修不好。

### 锁文件的三个作用

| 作用 | 说明 |
|---|---|
| **锁定精确版本** | 记录每个包的实际版本（含嵌套依赖） |
| **锁定完整依赖树** | 不只顶层，是整棵树 |
| **记录 integrity（哈希）** | 防篡改，保证下载的是同一个文件 |

### `npm install` vs `npm ci`（CI 必须用后者）

| | `npm install` | `npm ci` |
|---|---|---|
| 读锁文件 | 会，且**可能改写它** | ✅ 严格按锁文件 |
| 锁文件与 `package.json` 不一致 | 更新锁文件 | ❌ **报错退出** |
| 已有 `node_modules` | 复用 | ✅ 先删再装 |
| 写 `package-lock.json` | 会 | ❌ 永不写入 |
| 适用 | 本地开发 | **CI / Docker / 生产** |

npm 10.9.0 实测：缺锁文件直接 `EUSAGE` 退出；已有 `node_modules` 会被整个删除。

---

## 9.6 发布一个包（实操清单）

### `files` 字段是白名单

`package.json` 写 `"files": ["dist", "README.md"]`，目录里另放 `src/secret.js` 和 `.env`，`npm pack --dry-run` 输出：

```
npm notice 📦  @acme/demo-lib@1.2.3
npm notice Tarball Contents
npm notice 7B README.md
npm notice 17B dist/index.cjs
npm notice 31B dist/index.d.ts
npm notice 17B dist/index.mjs
npm notice 17B dist/utils.mjs
npm notice 171B package.json
npm notice Tarball Details
npm notice package size: 365 B
npm notice total files: 6
```

只有 6 个文件，`src/secret.js` 和 `.env` 都没进包。

**规则**：

```
有 files 字段 → 白名单模式，只发布列出的
没有 files    → 黑名单模式，用 .npmignore 排除（没有则用 .gitignore）
```

**两个细节**：

1. `package.json`、`README.md`、`LICENSE` 总会包含，即使不在 `files` 里
2. `files` 的优先级高于 `.npmignore`（实测：`.npmignore` 写了 `dist`、`README.md`，两者仍被打包）

发布前跑 `npm pack --dry-run` 核对清单：同名同版本号 unpublish 后不能复用，整包删除后 24 小时内不能再发同名包。

### 发布清单（13 项）

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

**所以「双格式包」的标准写法**：

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

**现象**：能 `import` 一个**没在 `package.json` 里声明**的包，而且能跑。

```
npm 的 node_modules（扁平化）：
node_modules/
├── lodash/          ← 你声明的
└── ms/              ← 你没声明，lodash 依赖它，被"提升"到顶层
```

**危害**：`lodash` 升级后不再依赖 `ms`，或换用 pnpm，代码立刻挂；别人 clone 也未必装出同一棵依赖树。

**pnpm 的解法**：符号链接，只有声明过的包才出现在顶层，`import 'ms'` 直接报「找不到模块」。

```
pnpm 的 node_modules：
node_modules/<pkg> -> .pnpm/<pkg>@<ver>/node_modules/<pkg>
```

### 问题 2：重复依赖（同一包多个版本）

```
$ npm ls react
my-app
├── react@18.2.0
└── some-lib@1.0.0
    └── react@17.0.2        ← 另一个版本
```

用 `npm ls <pkg>` 查、`npm dedupe` 合并兼容版本；库侧用 `peerDependencies` 避免装出第二份。

### 问题 3：`^` 浮动 + 无锁文件 = 意外升级

`"lodash": "^4.17.0"` 在不同时间 clone 会解析出不同版本。解法：**应用提交锁文件，库不提交**（使用者不会用你的锁文件）。

---

## 9.8 pnpm 为什么快、为什么省空间

### 硬链接 + 符号链接

```
pnpm：
① 全局 store（pnpm store path，本机 macOS 为 ~/Library/pnpm/store/v10）按内容寻址存一份真实文件
② node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg> 用【硬链接】指向 store
③ node_modules/<pkg> 用【符号链接】指向 .pnpm 里那份
```

| 链接 | 位置 | 作用 |
|---|---|---|
| **硬链接** | `.pnpm/<pkg>@<ver>/node_modules/<pkg>` → 全局 store | **省磁盘**：同一份文件多个目录名指向同一块数据 |
| **符号链接** | `node_modules/<pkg>` → `.pnpm/...` | **隔离依赖**：只有声明过的才在顶层 |

**效果**：多个项目共用同一个包时磁盘只有 1 份；安装时不必逐个项目复制文件；幽灵依赖被暴露。

### 三种包管理器对比

| | npm | yarn (classic) | pnpm |
|---|---|---|---|
| 依赖结构 | 扁平化（提升） | 扁平化 | **符号链接 + 硬链接** |
| 磁盘占用 | 每项目一份 | 每项目一份 | **全局 store 共享一份** |
| 幽灵依赖 | ❌ 会掩盖 | ❌ 会掩盖 | ✅ **暴露** |
| 安装方式 | 解析 + 复制 | 解析 + 复制（有缓存） | 硬链接复用 store |
| monorepo | workspaces | workspaces | workspace |
| 严格性 | 松 | 松 | **严（默认不允许非法依赖）** |

老包硬编码读 `node_modules` 路径时，pnpm 的符号链接结构会让它找不到文件，可用 `node-linker=hoisted` 退回扁平结构。

---

## 9.9 面试怎么说（2 分钟版）

- **三个身份**：命令行工具、注册中心、依赖规范（`package.json` + semver）。
- **依赖字段**：`dependencies` 运行时、`devDependencies` 构建时、`peerDependencies` 由宿主提供。组件库把 React 放 `peerDependencies`，否则两份实例导致 `Invalid hook call`。
- **semver**：`~1.2.3` 只升 patch，`^1.2.3` 升 minor + patch；`0.x` 里 `^` 等同 `~`，但 `^0.0.3` 例外，只允许 `<0.0.4`。
- **锁文件**：应用提交、库不提交；CI 用 `npm ci`，锁文件与 `package.json` 不一致直接失败。
- **发布与选型**：发布前用 `npm pack --dry-run` 核对 `files` 白名单；pnpm 用硬链接省磁盘、符号链接暴露幽灵依赖。

---

## 9.10 追问总表

| 问题 | 答法 |
|---|---|
| npm 三个身份？ | 命令行工具 / 注册中心 / 依赖规范 |
| `dependencies` 和 `devDependencies`？ | 运行时 vs 构建时；生产安装用 `--omit=dev` 跳过 dev |
| `peerDependencies` 是什么？ | 「需要宿主提供」，避免依赖被装两份 |
| 为什么组件库要用 peer？ | 两份 React 实例会导致 hooks 报错、Context 不通 |
| peer 在 npm 7+ 有什么变化？ | 默认自动安装，版本冲突报 `ERESOLVE` |
| `^` 和 `~` 区别？ | `~` 只升 patch，`^` 升 minor + patch |
| `^0.2.3` 升到哪？ | `<0.3.0`（`0.x` 时 `^` 与 `~` 相同；`^0.0.3` 例外，`<0.0.4`） |
| 锁文件为什么要提交？ | 保证所有人装到同一份依赖树 |
| 库要提交锁文件吗？ | **不要**（使用者不会用你的锁文件） |
| `npm ci` 和 `install` 区别？ | 严格按锁文件、先删 `node_modules`、不一致报错、不写锁文件 |
| `files` 字段是什么模式？ | **白名单**，只发布列出的文件 |
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
devDependencies         构建时，--omit=dev 跳过
peerDependencies        「需要宿主提供」，npm 7+ 默认自动装但冲突报 ERESOLVE
optionalDependencies    装失败不报错
bundledDependencies     打进 tarball

★ peer 的价值：避免依赖装两份
  两份 React → Invalid hook call / Context 取不到
  peerDependenciesMeta.optional 可标记为可选

【semver】
1.2.3   精确
~1.2.3  >=1.2.3 <1.3.0    只允许 patch
^1.2.3  >=1.2.3 <2.0.0    允许 minor+patch
★ ^0.2.3 >=0.2.3 <0.3.0   0.x 时 ^ 与 ~ 相同
★ ^0.0.3 >=0.0.3 <0.0.4   例外，比 ~0.0.3(<0.1.0) 更严

【锁文件】
作用：锁定精确版本 + 完整依赖树 + integrity 哈希
★ 应用提交，库不提交
★ CI 用 npm ci：
   install 会改写锁文件 → 构建不可复现
   ci 严格按锁文件 + 先删 node_modules + 不一致报错 + 不写锁

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
效果：多项目共用 1 份包 / 少复制 / 幽灵依赖报错

【三种包管理器】
npm     扁平提升，掩盖幽灵依赖，每项目一份
yarn    类似 npm，有缓存
pnpm    硬链接 + 符号链接，省磁盘、暴露幽灵依赖
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
□ 能说出 npm ci 和 npm install 的区别
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
