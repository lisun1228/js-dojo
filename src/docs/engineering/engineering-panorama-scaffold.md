# 工程化 01｜工程化全景与脚手架

> 覆盖题号：24（前端工程化指什么）、1（如何写 CLI 脚手架）
> 去重后：**2 个考点** + 补充 Monorepo

---

## 目录

- [1.1 前端工程化指的是什么](#11-前端工程化指的是什么)
- [1.2 如何写一个 CLI 脚手架](#12-如何写一个-cli-脚手架)
- [1.3 补充：Monorepo（题单完全没提，但高频）](#13-补充monorepo题单完全没提但高频)
- [1.4 本册追问总表](#14-本册追问总表)
- [1.5 速记卡](#15-速记卡)
- [1.6 自测](#16-自测)

---

## 1.1 前端工程化指的是什么

### 题单答案的问题

> 「用工程化手段提升开发效率：规范、脚手架、构建工具、CI/CD、监控、自动化测试。」

6 个名词并列，缺三件事：

- 这些手段**为什么出现**
- 它们之间的**层次关系**
- 「工程化」与「工具链」的边界：**工程化是约束和流程，工具只是载体**

### 一句话结论

> 前端工程化 = **把「多人、长期、可交付」这三个约束，变成自动化流程**。

| 约束 | 没有工程化会怎样 | 工程化的手段 |
|---|---|---|
| **多人** | 代码风格不一、命名冲突、互相踩脚 | 规范约束、Git 工作流、代码评审 |
| **长期** | 改一处崩一片、不敢重构、新人上手慢 | 类型系统、单元测试、模块化 |
| **可交付** | 上线靠手工、环境不一致、回滚困难 | 构建、CI/CD、容器化、灰度 |

任何工程化问题都能归到这三个约束；用约束解释选型（「长期维护，所以需要 TypeScript 作为多人改代码的契约」）比罗列工具更准确。

### 六层模型

```
第 6 层  监控与度量     Sentry / 性能监控 / 埋点 / 告警 / 灰度观测
第 5 层  部署与交付     CI/CD / Docker / Nginx / CDN / 灰度发布 / 回滚
第 4 层  测试与质量     单元测试 / 组件测试 / E2E / 覆盖率 / 质量门禁
第 3 层  规范与约束     ESLint / Prettier / commitlint / husky / TS
第 2 层  构建与编译     Webpack / Vite / Babel / Tree Shaking / 产物优化
第 1 层  开发与协作     目录规范 / Git 工作流 / 脚手架 / Monorepo / 包管理
```

**每一层解决的核心问题**：

| 层 | 核心问题 | 一句话 |
|---|---|---|
| 1 开发协作 | 人怎么配合 | 「不打架」 |
| 2 构建编译 | 代码怎么变成能运行的东西 | 「跑得起来」 |
| 3 规范约束 | 代码长什么样 | 「看起来像一个人写的」 |
| 4 测试质量 | 改坏了怎么知道 | 「敢改」 |
| 5 部署交付 | 怎么上线 | 「上得去、退得回」 |
| 6 监控度量 | 线上出问题怎么发现 | 「看得见」 |

### 面试怎么说（要点版）

- 定义：把「多人、长期、可交付」三个约束固化成自动化流程，不是工具集合。
- 骨架：协作 → 构建 → 规范 → 测试 → 部署 → 监控，按「解决谁的问题」分层，不按工具分层。
- 难度：越低层越难补——构建工具可以换，目录规范和 Git 流程失控后是全员成本。
- 被追问具体实践时，按层各给一个项目里的真实例子，而不是继续罗列名词。

### 工程化追问链

| 追问 | 答法 |
|---|---|
| 工程化和工具链的区别？ | 工程化是**流程和约束**，工具链是**实现手段**。举个例子：「所有提交必须过 lint」是工程化，「装了 ESLint」只是工具 |
| 小项目需要工程化吗？ | 需要，但要**从简**。1-2 人的项目至少要三样：ESLint + Prettier（省掉 code review 的格式争论）、Git 分支约定、一条构建命令。**不要一上来就上 Monorepo 和微前端** |
| 工程化做过头会怎样？ | 会拖慢迭代：改一行代码也要等完整 CI、加一个依赖要走多层审批、本地启动要等很久。**工程化的目标是减少摩擦，不是增加流程** |
| 怎么衡量工程化的效果？ | 四个指标：**构建时长**、**CI 通过率**、**线上故障恢复时长（MTTR）**、**新人从 clone 到跑起来的时间**。最后一个最直观 |
| 你们项目工程化最大的痛点是什么？ | 典型痛点是**构建慢**：先用 webpack 的 `--profile` 或 `speed-measure-webpack-plugin` 量化，再针对缓存、loader 范围、SWC 等手段优化 |

---

## 1.2 如何写一个 CLI 脚手架

### 六步骨架的缺口

> 「1. Node.js 写入口，`#!/usr/bin/env node` 2. 用 commander/yargs 解析参数 3. 用 inquirer 交互式提问 4. 用 download-git-repo 下载模板 5. 用 fs 渲染模板、写文件 6. npm link 本地调试，发布 npm」

6 步骨架正确，缺三点：

1. **没有代码**：无法验证每条步骤
2. **没提 `package.json` 的 `bin` 字段**：这是「为什么能当命令跑」的关键
3. **没说模板来源的选择**：远程仓库与内置模板的代价不同

### 脚手架的定义

> 脚手架 = **参数解析 + 交互收集 + 模板拷贝渲染 + bin 注册**。

### 完整实现（最小版）

`ask` 是 `readline/promises` 的封装，这里省略。

#### 目录结构

```
my-cli/
├── package.json
├── bin/
│   └── index.js          ← 入口，必须有 shebang
└── templates/
    └── app/              ← 内置模板
        ├── package.json.tpl
        └── README.md.tpl
```

#### ① `package.json` 的 `bin` 字段（最关键的一步）

```json
{
  "name": "create-my-app",
  "version": "1.0.0",
  "bin": {
    "create-app": "./bin/index.js"
  },
  "files": ["bin", "templates"]
}
```

**`bin` 字段做了两件事**：

1. `npm install -g` 时，npm 会在全局 `bin` 目录创建一个软链接 `create-app → ./bin/index.js`（Windows 下生成 shim）
2. 在 Unix 下链接时会**自动给文件加执行权限**（`chmod +x`），所以不需要手动 chmod

`#!/usr/bin/env node` 让操作系统通过 PATH 查找 node；用 `env` 而不是写死 `/usr/bin/node`，是为了兼容 nvm 这类多版本管理场景——写死路径在别人机器上很可能不存在。

#### ② 入口：参数解析 + 交互 + 渲染

```js
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// ---------- 1. 解析参数 ----------
// 真实项目用 commander / cac，这里手写演示原理
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      out[k] = v === undefined ? true : v;
    } else {
      out._.push(a);
    }
  }
  return out;
}

// ---------- 2. 模板渲染 ----------
function render(tpl, data) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in data)) throw new Error(`模板变量缺失: ${key}`);
    return data[key];
  });
}

// ---------- 3. 递归复制 + 渲染 ----------
function copyDir(src, dest, data) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const isTpl = entry.name.endsWith('.tpl');
    // 关键：.tpl 后缀要在这个环节去掉
    const d = path.join(dest, isTpl ? entry.name.slice(0, -4) : entry.name);

    if (entry.isDirectory()) copyDir(s, d, data);
    else if (isTpl) fs.writeFileSync(d, render(fs.readFileSync(s, 'utf8'), data));
    else fs.copyFileSync(s, d);
  }
}

// ---------- 4. 主流程 ----------
(async () => {
  const args = parseArgs(process.argv.slice(2));
  const target = args._[0];

  // 边界 1：没给目录名
  if (!target) {
    console.error('用法: create-app <dir> [--force]');
    process.exit(1);
  }

  const dest = path.resolve(process.cwd(), target);

  // 边界 2：目录已存在
  if (fs.existsSync(dest) && !args.force) {
    console.error(`目录已存在: ${target}（加 --force 覆盖）`);
    process.exit(1);
  }

  // 边界 3：非交互环境（CI）不能卡住等输入
  const canAsk = Boolean(process.stdin.isTTY);
  const name = args.name || (canAsk ? await ask('项目名', path.basename(dest)) : path.basename(dest));
  const author = args.author || (canAsk ? await ask('作者', 'anonymous') : 'anonymous');

  const data = {
    name,
    author,
    date: new Date().toISOString().slice(0, 10),
    devCmd: 'vite',
  };

  copyDir(path.join(__dirname, '../templates/app'), dest, data);

  console.log(`✓ 已创建 ${target}`);
  console.log('  下一步: cd ' + target + ' && npm i && npm run dev');
})();
```

### 输出示例

模板：

```
package.json.tpl  →  { "name": "{{name}}", "version": "0.1.0", "scripts": { "dev": "{{devCmd}}" } }
README.md.tpl     →  # {{name}}\n\nCreated by {{author}} at {{date}}.
```

以 `create-app demo-app --name=@acme/app --author=alice` 为例：

```
✓ 已创建 demo-app
  下一步: cd demo-app && npm i && npm run dev
```

生成的文件（**`.tpl` 后缀已被去掉**）：

```
demo-app/README.md
demo-app/package.json
```

`package.json`（变量已替换）：

```json
{
  "name": "@acme/app",
  "version": "0.1.0",
  "scripts": { "dev": "vite" }
}
```

`README.md`（日期取自运行时 `new Date()`）：

```markdown
# @acme/app

Created by alice at 2026-10-22.
```

**边界行为**：

```
重复创建（无 --force） → 目录已存在: demo-app（加 --force 覆盖）
不带参数              → 用法: create-app <dir> [--force]
```

### 三个必须处理的边界

| 边界 | 不处理会怎样 |
|---|---|
| **目录已存在** | 覆盖用户已有代码，且不可恢复 |
| **非交互环境** | CI 里跑脚手架时卡在 `readline` 等输入，直到超时。必须判 `process.stdin.isTTY` |
| **模板变量缺失** | 生成出 `{{name}}` 字面量的文件，用户跑半天才发现。要显式抛错 |

### 模板的两种来源：各有代价

| 方式 | 实现 | 优点 | 缺点 |
|---|---|---|---|
| **内置模板**（不推荐给开源） | 模板文件打进 npm 包 | 快、离线可用、版本可控 | **包体积大**；改模板要发包 |
| **远程仓库** | `download-git-repo` 拉 GitHub | 模板可独立迭代 | 依赖网络；**GitHub 挂了就废**；私有仓库要配 token |
| **混合**（Vue CLI / CRA 的做法） | 内置默认 + 参数切换模板（CRA 的 `--template`、Vue CLI 的 preset） | 兼顾 | 代码复杂 |

### 脚手架追问链

| 追问 | 答法 |
|---|---|
| `commander` / `yargs` / `cac` 怎么选？ | 功能都够。**Vite 的依赖里就是 `cac`**，commander 生态最广，yargs 适合复杂子命令。手写也行，但子命令和 help 要自己维护 |
| 交互式提问用什么？ | `inquirer`（经典）或 `prompts`，两者都够用 |
| 怎么支持「选 Vue 还是 React」？ | 交互里选完后，从不同的模板目录复制。要读 `templates/vue` 还是 `templates/react` |
| 模板里怎么处理 `.gitignore`？ | **npm 发布时把 `.gitignore` 当作 `.npmignore` 处理**，文件不会进包。模板里命名成 `_gitignore` 或 `gitignore`，生成时再改名。**这是脚手架的常见坑** |
| 怎么做得像 `create-vue` 那样 `npm create vue@latest`？ | 靠 `npm create` 的约定：`npm create xxx` 等价于 `npx create-xxx`。所以包名必须是 `create-xxx` |
| 怎么在脚手架里装依赖？ | 用 `execa` 或 `child_process.spawn` 跑 `npm install`。**注意不要用 `exec`**（有 shell 注入风险，且不好处理输出流） |
| 怎么检测包管理器？ | 读 `npm_config_user_agent` 环境变量，里面会带 `npm/9.x` 或 `pnpm/8.x`。**或者看 `package-lock.json` / `pnpm-lock.yaml` 是否存在** |
| 发布前要注意什么？ | ① `files` 字段只发必要文件；② 版本号语义化；③ **先 `npm pack --dry-run` 看包内容**；④ 加 `engines` 声明 Node 版本 |

### 生成后能否直接运行

模板生成的文件能装上依赖并跑起来，脚手架才算可用。常见失败是依赖版本范围过宽，安装时拉到不兼容的新版本。

1. 模板的 `package.json` 写明确版本号，不用 `latest` 或过宽的 `^` 范围
2. 发版前在 CI 里跑一遍「生成 → 安装 → 构建」

---

## 1.3 补充：Monorepo（题单完全没提，但高频）

### Monorepo 的定义

> Monorepo = **多个包放在一个仓库里，共享一套工具链和依赖**。

### 为什么会出现

多包项目的两种管法：

| 方式 | 结构 | 问题 |
|---|---|---|
| **Multi-repo** | 每个包一个仓库 | 改一个跨包需求要提 3 个 PR、发 3 次版、等 3 次 CI |
| **Monorepo** | 一个仓库多个包 | 要解决「依赖提升」「增量构建」「发布」 |

**Monorepo 解决的核心痛点是「跨包改动的一致性」**：改 `utils` 的同时改 `ui`，一个 PR 就能评审、一次 CI 就能验证。

### 三种主流方案

| 方案 | 依赖管理 | 构建加速 | 适合 |
|---|---|---|---|
| **npm/yarn workspaces** | 依赖提升到根 | ❌ 无 | 包少、简单 |
| **pnpm workspace** | 符号链接 + 硬链接 | ❌ 无（要配 Turborepo） | **目前主流** |
| **Nx / Turborepo** | 配合上面任一 | ✅ 任务图 + 缓存 | 包多、构建慢 |

### pnpm 为什么快、为什么省空间

```
npm：每个项目的 node_modules 都有一份完整拷贝
     → 10 个项目 = 10 份 React

pnpm：全局 store（路径见 pnpm store path）存一份真实文件
     项目 node_modules 里是「硬链接」指向 store
     → 10 个项目 = 1 份磁盘占用
```

**两种链接的分工**：

| 链接类型 | 用在哪 | 作用 |
|---|---|---|
| **硬链接（hard link）** | `node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>` → 全局 store | **省磁盘**。同一份文件多个目录名指向同一块数据 |
| **符号链接（symlink）** | `node_modules/<pkg>` → `.pnpm/<pkg>@<ver>/node_modules/<pkg>` | **隔离依赖**。只有 `package.json` 里声明的包才会被链接进来 |

> **符号链接这一层是 pnpm 解决「幽灵依赖」的关键**。npm 尽量把依赖提升到顶层 `node_modules`，导致你能 `import` 一个没在 `package.json` 里声明的包——这就是幽灵依赖（phantom dependency）。换包管理器或删依赖时立刻炸。

### 幽灵依赖对照

```
npm 的 node_modules（扁平化，全部提升）
node_modules/
├── lodash/            ← 你声明的
├── ms/                ← 你没声明，但 lodash 依赖它，被提升了
└── debug/             ← 同上

→ 你的代码可以 import 'ms'，但 package.json 里没有 → 幽灵依赖

pnpm 的 node_modules（只有声明的才在顶层）
node_modules/
├── lodash -> .pnpm/lodash@4/node_modules/lodash
└── .pnpm/
    ├── lodash@4/node_modules/{lodash, ms}
    └── ms@2/node_modules/ms

→ 你的代码 import 'ms' 直接报「找不到模块」→ 幽灵依赖被暴露
```

### Monorepo 追问链

| 追问 | 答法 |
|---|---|
| Monorepo 的成本是什么？ | ① **仓库变大**，clone 慢；② **CI 时间变长**——要精准判断「哪些包受影响」；③ **权限粒度粗**（一个仓库的权限要管所有人）；④ 工具链复杂（增量构建、版本管理） |
| 怎么只构建受影响的包？ | 靠**依赖图 + 文件变更**。Turborepo/Nx 会分析 `git diff` 命中的文件属于哪个包，再找出所有依赖它的包。**关键概念：`^build` 表示「先构建所有依赖项」** |
| 版本管理怎么做？ | 两种模式：**fixed**（所有包同一版本，如 Vue 生态）和 **independent**（各包独立版本）。工具用 `changesets` 或 `lerna` |
| pnpm 和 yarn PnP 的区别？ | PnP 干脆不要 `node_modules`，改成从 `.pnp.cjs` 解析。**省空间更彻底，但生态兼容性差**（有些包会硬编码读 `node_modules`） |
| `workspace:*` 是什么？ | pnpm 的协议，表示「用本地工作区的这个包」。**发布时会被替换成真实版本号**。比手写 `"@acme/utils": "1.0.0"` 好在：本地开发直接走源码/产物，不用 link |
| 前端项目什么时候该上 Monorepo？ | 三个信号：① 有 2 个以上包需要一起改；② 组件库和业务代码要同步迭代；③ 想统一 ESLint/TS 配置。**如果只有一个应用，别上** |

---

## 1.4 本册追问总表

| 问题 | 一句话答 |
|---|---|
| 工程化一句话是什么？ | 把「多人、长期、可交付」三个约束变成自动化流程 |
| 工程化分几层？ | 六层：协作 → 构建 → 规范 → 测试 → 部署 → 监控 |
| 哪层最难补？ | 最底层（目录规范和 Git 流），因为改它要全组配合 |
| 脚手架的核心是什么？ | 参数解析 + 交互 + 模板渲染 + `bin` 注册 |
| shebang 为什么要用 `env`？ | 兼容 nvm 这类多版本管理，不写死 node 路径 |
| `.gitignore` 模板的坑？ | npm 发布时把 `.gitignore` 当 `.npmignore` 处理，要改名成 `_gitignore` 再在生成时改回来 |
| Monorepo 解决什么？ | 跨包改动的一致性——一个 PR 一次 CI |
| pnpm 为什么省空间？ | 全局 store + 硬链接，同一份文件不重复存 |
| 幽灵依赖是什么？ | `import` 了没在 `package.json` 声明的包，靠依赖提升碰巧能跑 |

---

## 1.5 速记卡

```
【工程化定义】
三个约束：多人 / 长期 / 可交付
六层模型：协作 → 构建 → 规范 → 测试 → 部署 → 监控
越高层越容易换，越低层越难补

【CLI 脚手架】
bin 字段 → npm 建软链接 + 自动 chmod
#!/usr/bin/env node → 兼容 nvm
四步：解析参数 / 交互提问 / 模板渲染 / 复制文件
三个边界：目录已存在 / 非 TTY 环境 / 模板变量缺失
模板坑：.gitignore 会被 npm 当 .npmignore → 改名 _gitignore

【Monorepo】
解决「跨包改动一致性」
pnpm = 全局 store + 硬链接（省空间）+ 符号链接（隔离依赖）
符号链接暴露幽灵依赖（npm 的提升会掩盖它）
只构建受影响的包：依赖图 + git diff
```

---

## 1.6 自测

```
□ 能用「三个约束」解释工程化，而不是罗列工具
□ 能画出六层模型并说出每层的核心问题
□ 能说出工程化的四个衡量指标
□ 能说出 bin 字段做了哪两件事
□ 能解释 shebang 为什么用 env 而不是绝对路径
□ 能写出模板渲染的核心逻辑（含 .tpl 去后缀）
□ 能说出脚手架的三个边界
□ 能说出 .gitignore 模板的坑
□ 能说出内置模板和远程模板的取舍
□ 能解释 pnpm 的两种链接分别解决什么
□ 能举例说明幽灵依赖
□ 能说出 Monorepo 的好处与成本
```
