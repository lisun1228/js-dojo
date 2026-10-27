# 工程化 06｜规范与质量保障

> 覆盖题号：5（ESLint 和 Prettier 区别）、13（Lint 工具为什么能检查错误）、26（前端怎么做单元测试）
> 去重后：**3 个考点**

---

## 目录

- [6.1 ESLint 和 Prettier 的区别](#61-eslint-和-prettier-的区别)
- [6.2 Lint 工具为什么能检查代码错误](#62-lint-工具为什么能检查代码错误)
- [6.3 前端怎么做单元测试](#63-前端怎么做单元测试)
- [6.4 本册追问总表](#64-本册追问总表)
- [6.5 速记卡](#65-速记卡)
- [6.6 自测](#66-自测)

---

## 6.1 ESLint 和 Prettier 的区别

### 题单答案的问题

> 「ESLint：检查代码质量 + 格式。Prettier：只做格式（统一风格）。配合用：ESLint 管质量，Prettier 管格式，eslint-config-prettier 关闭冲突规则。」

框架成立，缺两点：**为什么两者会冲突**、**项目里实际怎么配**。

### 一句话结论

> **ESLint 管「这段代码有没有问题」，Prettier 管「这段代码长什么样」。**
>
> 冲突的根因是 ESLint 早期把格式也当成自己的职责，两者对「引号用单还是双」有两套答案，且默认值相反：Prettier 默认双引号，ESLint 社区的 `quotes: ['error', 'single']` 默认单引号。

### 职责划分（边界要背准）

| 维度 | ESLint | Prettier |
|---|---|---|
| **核心目标** | 发现**可能出错**的代码 | 统一**排版** |
| **判断依据** | 语义（AST + 作用域分析） | 纯语法结构（也基于 AST，但只看形状） |
| **典型规则** | `no-unused-vars`、`eqeqeq`、`no-undef`、`react-hooks/exhaustive-deps` | 缩进、引号、分号、换行、括号位置、尾逗号 |
| **能否自动修** | 部分能（`--fix`） | 全部能（它就是在重写） |
| **会不会改变行为** | **可能**（比如删掉未使用的变量） | **不会**（只改空白和符号，语义等价） |
| **配置复杂度** | 高（插件、parser、环境、规则集） | 低（就几个选项） |
| **能否被绕过** | `// eslint-disable-next-line` | `// prettier-ignore` |

### 「会不会改变行为」是关键区别

- Prettier 只重排空白和符号，AST 不变：`const a = {b:1}` → `const a = { b: 1 };`
- ESLint 的 `--fix` 可能改语义：`prefer-const` 把 `var` 换成 `const`；`no-unused-vars` 删变量时可能连带删掉副作用

所以顺序是**先 `eslint --fix`（可能改语义），再 Prettier（只改格式）**，反过来会白跑一遍。

### 冲突然例

#### 准备：一个格式和质量都有问题的文件

```js
const a=1
const b  =  "x";
if(a==1){console.log(b)}
```

#### ① 只用 ESLint（同时开质量规则和格式规则）

```js
rules: {
  eqeqeq: 'error',              // 质量
  quotes: ['error', 'single'],  // 格式
  semi: ['error', 'always'],    // 格式
  indent: ['error', 2],         // 格式
}
```

输出：

```
1:10  error  Missing semicolon                    semi
2:13  error  Strings must use singlequote         quotes
3:5   error  Expected '===' and instead saw '=='  eqeqeq
3:24  error  Missing semicolon                    semi

✖ 4 problems (4 errors, 0 warnings)
  3 errors and 0 warnings potentially fixable with the `--fix` option.
```

4 个问题里只有 3 个可自动修：`eqeqeq` 需要人判断该改成什么。

#### ② 先 Prettier 再 ESLint ← 冲突在这里

Prettier 只报「格式有问题」，不指位置（`--check` 只输出文件名，`--write` 直接覆盖）：

```
[warn] src/bad.js
[warn] Code style issues found in the above file. Run Prettier with --write to fix.
```

格式化后（Prettier 默认 `singleQuote: false`）：

```js
const a = 1;
const b = "x";          // ← 双引号
if (a == 1) {
  console.log(b);
}
```

再跑 ESLint：

```
2:11  error  Strings must use singlequote         quotes     ← 冲突
3:7   error  Expected '===' and instead saw '=='  eqeqeq
```

Prettier 刚把它改成双引号，`quotes: single` 立刻要求改回单引号：同一份文件被两个工具来回改。如果 `lint-staged` 里两者都跑，每次提交都会产生反方向的改动。

本项目 `.prettierrc.json` 设了 `singleQuote: true`，与 ESLint 单引号一致，所以这条冲突不会出现——**冲突只在两边配置不一致时发生**。

#### ③ 加 `eslint-config-prettier` 关闭格式规则

```js
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    files: ['**/*.js'],
    rules: {
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      // 格式规则全部删掉
    },
  },
  prettierConfig,   // ← 必须放最后，它逐条关掉与 Prettier 冲突的规则
];
```

再跑：

```
3:7  error  Expected '===' and instead saw '=='  eqeqeq
```

只剩真正的质量问题，冲突消失。

#### ④ 修完质量问题，两边都通过

```
ESLint: （无输出）
Prettier: All matched files use Prettier code style!
```

### 三种配合方案对比

| 方案 | 配置 | 优点 | 缺点 | 推荐度 |
|---|---|---|---|---|
| **分权**（ESLint 管质量 + Prettier 管格式 + `eslint-config-prettier`） | 两个工具各跑各的 | 职责清晰、各用各的编辑器插件、报错来源明确 | 要跑两个命令 | ⭐⭐⭐⭐⭐ **主流** |
| **一体化**（`eslint-plugin-prettier`，把 Prettier 当 ESLint 规则） | 只跑 ESLint | 一个命令、一个 IDE 面板 | **慢**（Prettier 在 ESLint 进程里逐文件跑）、报错是 Prettier 的格式差异（难定位）、编辑器里大量波浪线 | ⭐⭐ **本项目在用** |
| **只 Prettier**（ESLint 完全不管格式） | ESLint 只留质量规则 | 最简单 | 需要自己保证团队都装了 Prettier 插件 | ⭐⭐⭐⭐ |

`eslint-plugin-prettier` 的代价是具体的：Prettier 在 ESLint 进程内再跑一遍、报错变成 `Delete ⏎` 这类格式差异、多一层可能出问题的间接。Prettier 官方文档把它列为 **generally not recommended**，推荐用 `eslint-config-prettier` 关掉冲突规则后直接跑 `prettier --check .`。

### 本项目配置（节选）

```js
// eslint.config.js（ESLint 9+ flat config）
import js from '@eslint/js'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'public/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  // 内含 eslint-config-prettier（关掉格式规则）+ prettier/prettier 规则
  eslintPluginPrettierRecommended,

  {
    files: ['**/*.{js,mjs,cjs,vue}'],
    languageOptions: { globals: globals.browser },
  },

  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser, extraFileExtensions: ['.vue'] },
    },
  },

  {
    rules: {
      'vue/multi-word-component-names': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
)
```

```json
// .prettierrc.json
{
  "semi": false,
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "trailingComma": "all",
  "arrowParens": "always",
  "singleAttributePerLine": true,
  "endOfLine": "lf"
}
```

两个配置合起来的实际行为：`npm run lint` 一条命令同时报质量与格式问题（`prettier/prettier` 是 error，`quotes`/`semi`/`indent` 被关成 off），`npm run format:check` 仍用 Prettier CLI 复查。注意本项目 `semi` 是 `false`，与 Prettier 默认的 `true` 相反——**读仓库配置，不要背默认值**。

**`endOfLine: "lf"` 这个容易被忽略**——Windows 上 git 的 `core.autocrlf` 会把换行转成 CRLF，和 Prettier 的默认 `lf` 冲突，导致「本地全绿、CI 全红」。加 `"endOfLine": "lf"` + `.gitattributes` 一起解决。

### 追问链

| 追问 | 答法 |
|---|---|
| 为什么 Prettier 不报具体哪里错？ | 它是「重新打印器」不是「检查器」：把 AST 按自己的规则打印一遍，不产出差异位置。要定位用 `prettier --check` + git diff |
| ESLint 的 `--fix` 有风险吗？ | 有。`prefer-const`、`no-unused-vars` 这类可能改变行为。fix 完后 review diff，尤其别在 CI 里对源码跑 `--fix` |
| 团队不想装 Prettier 插件怎么办？ | 用 `lint-staged` + husky：本仓库 `.husky/pre-commit` 执行 `npx lint-staged`，`package.json` 里 `*.{js,mjs,cjs,ts,mts,cts,vue}` 走 `eslint`，`*.{json,md,css,html,yml,yaml}` 走 `prettier --check`。**把「格式」从「人的习惯」变成「流程的保证」** |
| ESLint 9 还内置格式规则吗？ | **还有**：`quotes`/`semi`/`indent` 在 9.39.5 里仍可启用，但已标记 `deprecated`（8.53.0 起，`availableUntil: 11.0.0`），官方方向是把它们迁到 `@stylistic/eslint-plugin`。新项目不要再用内置格式规则 |
| 为什么 ESLint 要用 flat config？ | 旧 `.eslintrc` 的 `extends`/`overrides` 组合难以静态推导最终规则。flat config 是一个数组，**从前往后合并、后项覆盖前项**，行为可预测 |
| 怎么让 lint 只检查改动的文件？ | `lint-staged`，或 `git diff --name-only --diff-filter=ACMR \| xargs eslint` |
| 怎么让 lint 在 CI 里跑得快？ | 开 `--cache`，二次运行只检查改动过的文件；lint 与格式化分开跑，CI 里不对源码执行 `--fix` |

---

## 6.2 Lint 工具为什么能检查代码错误

### 题单答案的问题

> 「把源码解析成 AST，遍历 AST 检查规则。ESLint 就是这么做的。」

方向对，缺两点：**为什么这样做就不会误判**、**AST 里的规则长什么样**。

### 一句话结论

> **因为它看的不是「字符」，是「语法结构」。**

这个区别决定了 Lint 的精度。举例：

```js
// 情况 1：真的有 == 问题
if (a == b) {}

// 情况 2：== 只是一个字符串
const s = "if (a == b) {}";

// 情况 3：== 出现在注释里
// if (a == b) {}
```

**基于正则的检查会把三种都报出来。基于 AST 的检查只报第一种**——因为在 AST 里：

- 情况 1 有 `{ type: 'BinaryExpression', operator: '==' }` 节点
- 情况 2 只有一个 `{ type: 'Literal', value: 'if (a == b) {}' }` 节点
- 情况 3 的注释**根本不在 AST 里**（除非开 `attachComment`）

### AST 长什么样

用 `espree`（ESLint 的默认 parser）解析 `var a = 1 + 2;`（简化）：

```js
{
  type: 'Program',
  body: [{
    type: 'VariableDeclaration',
    kind: 'var',
    declarations: [{
      type: 'VariableDeclarator',
      id: { type: 'Identifier', name: 'a' },
      init: {
        type: 'BinaryExpression',
        operator: '+',
        left:  { type: 'Literal', raw: '1' },
        right: { type: 'Literal', raw: '2' },
      },
    }],
    loc: { start: { line: 1, column: 0 }, end: { line: 1, column: 14 } },
  }],
}
```

**三个关键点**：

1. `type` 决定「这是什么结构」—— 一条规则通常只关心几种 `type`
2. `operator` / `kind` 这些字段是规则的判断依据
3. `loc` 提供报错位置（`1:10` 这种行列号就是从这来的）

### 手写一条 Lint 规则（不用 ESLint）

理解了 AST，「写 Lint 规则」就是「遍历树 + 匹配节点」。

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

const code = 'var a = 1;\nlet b = 2;\nvar c = 3;';
const tree = espree.parse(code, { ecmaVersion: 2022, loc: true });

// 规则 1：禁止 var（等价 no-var）
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

```js
// 规则 2：禁止 ==（等价 eqeqeq）
walk(tree, (n) => {
  if (n.type === 'BinaryExpression' && n.operator === '==') {
    problems.push(`第 ${n.loc.start.line} 行：使用 ==，应为 ===`);
  }
});
```

ESLint 的每条内置规则都是这个形状：遍历树、匹配节点、报告位置。

### ESLint 比手写多做了什么

| 能力 | 手写版 | ESLint |
|---|---|---|
| 遍历 AST | 自己写 walk | 内置，且支持 `enter`/`exit` |
| **作用域分析** | ❌ 没有 | ✅ **`context.sourceCode.getScope()`** 能查变量绑定 |
| 自动修复 | ❌ | ✅ `fixer` API |
| 报错位置 | 手动取 `loc` | ✅ 支持精确到 token |
| 配置/插件 | 无 | ✅ 完整生态 |
| 规则间依赖 | 无 | ✅ 能读其他规则的结果（`getSourceCode`） |

**「作用域分析」是 ESLint 真正的价值**。举两个只有靠作用域才能实现的规则：

```js
// no-undef：这个变量到底有没有声明？
function f() {
  return x;    // ← 报错。要判断 x 在作用域链里找不到
}

// no-shadow：内层变量遮蔽了外层
const a = 1;
function g() {
  const a = 2;   // ← 报错（如果开了 no-shadow）。要看外层有没有同名绑定
}
```

**这不是「看语法结构」能解决的，必须维护作用域链**。ESLint 用 `eslint-scope` 做这件事。

### 执行流程（完整版）

```
源码
 ↓ 读取 eslint.config.js，合并成最终生效的规则集
 ↓ parser（默认 espree）解析 → AST
 ↓ eslint-scope 建作用域链
 ↓ SourceCode 包装 AST（提供 getText / getTokenBefore 等工具）
 ↓ 遍历 AST：对每个节点，把「所有在乎这个节点的规则」的回调都调用一遍
 ↓ 收集 messages（含 ruleId / severity / message / line / column / fix）
 ↓ 输出格式化
```

**注意第 5 步的机制**：ESLint **只遍历一次**，把每个节点分发给所有关心它的规则。所以规则变多不会成倍增加遍历开销。

### 追问链

| 追问 | 答法 |
|---|---|
| ESLint 用什么 parser？ | 默认 `espree`（基于 acorn）。**TS 项目要换 `@typescript-eslint/parser`**，Vue 要换 `vue-eslint-parser`（`<script lang="ts">` 再嵌套 `@typescript-eslint/parser`） |
| parser 换了，规则还能用吗？ | 大部分质量规则能用，因为 TS 的 AST 保留了 ESTree 的主要节点。**但核心规则直接处理 TS 语法会误报或失效**，所以 TS 项目要用 `@typescript-eslint/*` 对应版本 |
| 为什么 Lint 不会误报字符串里的代码？ | 因为字符串在 AST 里是 `Literal` 节点，不是 `BinaryExpression`。**它看结构不看字符** |
| 注释里的代码会被检查吗？ | 默认不会（注释不进 AST）。但 `eslint-plugin-jsdoc` 这类插件会用 `sourceCode.getAllComments()` 单独处理注释 |
| ESLint 为什么比正则慢？ | 要解析完整 AST + 建作用域，换来的是避免这类结构性误报。**正则只适合「找某个固定模式」，不适合「判断代码结构」** |
| 那为什么有的工具用正则？ | 因为快，且场景简单。比如 `grep` 搜 `console.log` 是合理需求。**但只要涉及「这个 console.log 是不是在注释里」，正则就不够了** |
| 自定义规则怎么发布？ | 做成 `eslint-plugin-xxx` 包，用 `RuleTester` 写测试 |

---

## 6.3 前端怎么做单元测试

### 题单答案的问题

> 「Jest + Vue Test Library / React Testing Library。写用例测函数和组件。覆盖率工具 istanbul。」

工具名对了，缺三件事：**测什么、不测什么**、**覆盖率为什么不能当 KPI**、**单元测试 / 组件测试 / E2E 的分层**。

### 一句话结论

> 单元测试的价值不是「证明代码对」，是**「让你敢改」**。

### 测什么（按投入产出排序）

| 优先级 | 测什么 | 为什么 | 覆盖率要求 |
|---|---|---|---|
| ⭐⭐⭐⭐⭐ | **纯函数 / 工具函数** | 输入输出明确、无副作用、最好测 | 90%+ |
| ⭐⭐⭐⭐⭐ | **数据转换 / 格式化逻辑** | 金额、日期、单位换算——错了损失最大 | 90%+ |
| ⭐⭐⭐⭐ | **状态管理（store 的 action / reducer）** | 业务规则集中在这，改得最频繁 | 70%+ |
| ⭐⭐⭐⭐ | **复杂条件的组件渲染** | 权限、多状态组合 | 关键路径 |
| ⭐⭐⭐ | **组件交互（点击、输入）** | 用 Testing Library 从用户视角测 | 关键组件 |
| ⭐ | **UI 样式 / 布局** | 单元测试测不出来，该用视觉回归 | 不测 |
| ❌ | **第三方库的行为** | 你测的是别人的代码 | 不测 |
| ❌ | **实现细节（内部方法名、私有状态）** | 一重构就红，维护成本极高 | 不测 |

### 不该测什么

**三个「看起来该测其实不该测」的东西**：

#### ① 不要测实现细节

```js
// ❌ 测了内部状态
it('点击后 isLoading 为 true', () => {
  const wrapper = mount(Button);
  wrapper.find('button').trigger('click');
  expect(wrapper.vm.isLoading).toBe(true);   // ← 一改用 ref/computed 就红
});
```

```js
// ✅ 测用户能看到的结果
it('点击后按钮显示加载中', async () => {
  render(<Button />);
  await userEvent.click(screen.getByRole('button'));
  expect(screen.getByText('加载中')).toBeInTheDocument();
});
```

前者测「怎么实现的」，后者测「用户看到什么」；前者会阻碍重构。

#### ② 不要为了覆盖率去测 getter / 常量

```js
// ❌ 这种测试提供零信息
it('isVip 默认是 false', () => {
  expect(state.isVip).toBe(false);
});
```

#### ③ 不要用 mock 覆盖掉真正要测的逻辑

```js
// ❌ 这等于什么都没测
jest.mock('./calculatePrice');
it('计算价格', () => {
  calculatePrice.mockReturnValue(100);
  expect(calculatePrice()).toBe(100);   // 测的是 mock 自己
});
```

> **「测试要像用户一样思考，而不是像实现者一样思考」**——这是 Testing Library 的核心理念。

### 覆盖率陷阱

| 覆盖率高 ≠ 质量好 | 说明 |
|---|---|
| `expect(result).toBeDefined()` | 执行到了，但没验证正确性。覆盖率高，价值为零 |
| 只测 happy path | 100% 行覆盖，但所有错误分支都没测 |
| 测了但不测断言 | 跑一遍不断言，覆盖率满的 |

覆盖率只说明「哪些代码完全没跑过」，说明不了「测得对不对」。验证测试本身的质量用**变异测试（Mutation Testing）**：Stryker 故意改动源码（比如把 `>` 改成 `>=`），测试仍然全绿就说明断言无效。

### 测试分层（金字塔 vs 奖杯）

| 层级 | 传统金字塔 | 现代奖杯（Kent C. Dodds） |
|---|---|---|
| 单元 | 80% | 40% |
| 集成 / 组件 | 15% | 50% |
| E2E | 5% | 10% |

**为什么现代实践把「集成」加厚？** 因为**前端的问题大多在「组件之间」**，不在「单个函数里」。一个按钮组件单测 100% 通过，和表单组合起来的交互仍可能是错的。

分层原则：

- 纯逻辑单元测，交互组件集成测，关键路径 E2E 测
- 比例约 4:5:1——单元 40%、集成 50%、E2E 10%
- E2E 只测三条链路：登录、核心业务、支付

### 工具选型

| 工具 | 定位 | 特点 |
|---|---|---|
| **Vitest** | 测试运行器 | **Vite 原生、极快、API 兼容 Jest**。新项目首选 |
| **Jest** | 测试运行器 | 生态最成熟，但需要 babel/ts-jest 转换，**慢** |
| **@testing-library/react / vue** | 组件测试工具 | 从「用户视角」查询元素，**不鼓励测实现细节** |
| **@vue/test-utils** | Vue 组件测试 | 更底层，能访问组件实例（**容易写成测实现细节**） |
| **MSW** | 网络 mock | **拦截真实 fetch**，比 mock 掉 axios 更接近真实 |
| **Playwright / Cypress** | E2E | Playwright **更快更稳**，Cypress 调试体验好 |

MSW 与 mock 掉 HTTP 库的区别：

```js
// ❌ 老做法：mock 掉 axios，测的不是真实链路
jest.mock('axios');
axios.get.mockResolvedValue({ data: { list: [] } });

// ✅ MSW：拦截 Service Worker 层的真实请求
server.use(
  http.get('/api/list', () => HttpResponse.json({ list: [] }))
);
// 组件里真的 fetch('/api/list')，真的走请求流程，只是被拦了
```

前者测的是「你的代码怎么调 axios」，后者测的是「你的代码处理响应对不对」。**后者不会因为换 HTTP 库就全部报错。**

### 测试用例示例（重点在边界）

```js
// src/utils/format.test.js
import { describe, it, expect } from 'vitest';
import { formatAmount } from './format';

describe('formatAmount', () => {
  it('千分位', () => {
    expect(formatAmount(1234567)).toBe('1,234,567');
  });

  it('负数保留符号', () => {
    expect(formatAmount(-1234)).toBe('-1,234');
  });

  it('小数保留两位', () => {
    expect(formatAmount(1234.5)).toBe('1,234.50');
  });

  // ★ 这条是价值最高的：边界
  it('0 不显示为 -0', () => {
    expect(formatAmount(-0)).toBe('0');
  });

  it('非法输入返回占位符而不是抛错', () => {
    expect(formatAmount(null)).toBe('--');
    expect(formatAmount(undefined)).toBe('--');
    expect(formatAmount(NaN)).toBe('--');
  });
});
```

最后两条不是主流程，但**线上事故往往出在这些边界**：`-0` 的显示、非法输入的兜底。

### 追问链

| 追问 | 答法 |
|---|---|
| 组件快照测试有用吗？ | **谨慎用**。快照一改就全红，很多人直接 `-u` 更新，等于失去意义。**只对「不该变的稳定结构」用**（比如生成的图标、序列化输出） |
| 怎么测异步？ | `await waitFor(() => expect(...))` 或 `findBy*` 查询。**不要用 `setTimeout` 等待** |
| 怎么测自定义 hook？ | `renderHook`（Testing Library 提供）。**测它的返回值变化，不测内部 state** |
| 怎么测路由跳转？ | 用 `MemoryRouter` 包一层，断言 `location.pathname`。**不要测 window.location** |
| 覆盖率多少算合格？ | 看代码性质。**核心业务逻辑 80%+，UI 组件不设硬指标，工具库 90%+**。一刀切 80% 会逼着人写无意义测试凑数 |
| CI 里测试要跑多久？ | 单元 + 集成要快到「每次提交都愿意跑」，否则会有人开始跳过测试。E2E 可以更长，但应该并行 |
| 老项目没测试怎么办？ | **不要一次性补**。从「改 bug 时顺手补一条能复现该 bug 的测试」开始。**这叫「防御性补测」，成本最低收益最高** |
| 测试写得慢怎么办？ | 三个原因：① 代码耦合太深（该重构）；② 到处 mock（该改依赖注入）；③ 测了太多实现细节（该换成行为断言） |

---

## 6.4 本册追问总表

| 问题 | 一句话答 |
|---|---|
| ESLint 和 Prettier 一句话分工 | ESLint 管「有没有问题」，Prettier 管「长什么样」 |
| 它们为什么冲突 | 都管格式，且默认风格相反（Prettier 双引号 vs ESLint 社区单引号） |
| 怎么解决冲突 | 关掉 ESLint 的格式规则：`eslint-config-prettier` 放最后，或直接用 `eslint-plugin-prettier/recommended`（内含前者） |
| 为什么不推荐 `eslint-plugin-prettier` | 慢（Prettier 在 ESLint 进程里逐文件跑）+ 报错信息难读，Prettier 官方列为 generally not recommended |
| `--fix` 和 Prettier 谁先跑 | 先 `eslint --fix`（可能改语义），再 Prettier（只改格式） |
| Lint 为什么不会误报字符串里的代码 | 看 AST 结构，字符串是 `Literal` 节点不是 `BinaryExpression` |
| Lint 比手写遍历多什么 | 作用域分析（`no-undef`、`no-shadow` 靠它）、`fixer`、生态 |
| ESLint 遍历几次 | 一次。每个节点分发给所有关心它的规则 |
| 单元测试的价值是什么 | 让你敢改，不是证明代码对 |
| 不该测什么 | 实现细节、第三方库、样式、常量 |
| 覆盖率的问题 | 执行到了 ≠ 验证对了；`toBeDefined` 也能刷满 |
| 怎么验证测试质量 | 变异测试（Stryker）：故意改坏代码看测试会不会红 |
| 为什么要加厚集成测试 | 前端问题大多在组件之间，不在单个函数里 |

---

## 6.5 速记卡

```
【ESLint vs Prettier】
ESLint：发现问题 / 看语义 / 部分能 fix / 可能改行为
Prettier：统一排版 / 看形状 / 全量重写 / 不改语义
冲突根因：ESLint 也管格式，两边默认风格相反（Prettier 双引号 vs quotes: single）
解法：关掉 ESLint 格式规则（eslint-config-prettier，或 eslint-plugin-prettier/recommended 内含）

【三种方案】
分权（主流）：ESLint 质量 + Prettier 格式 + config-prettier
一体化（本项目采用）：eslint-plugin-prettier → 少一个命令，更慢、报错难读
只 Prettier：ESLint 去掉所有格式规则

【执行顺序】
eslint --fix（可能改语义）→ prettier --write（只改格式）

【Lint 原理】
看 AST 不看字符
同一个 if(a==b)：BinaryExpression(operator:'==')
写成字符串：Literal(value:'if(a==b)')  → 不会误报
手写规则 = walk 树 + 匹配 node.type/operator + 读 loc 报位置
ESLint 多出来的核心能力：作用域分析（no-undef / no-shadow 靠它）
一次遍历，所有规则同时收到节点

【单元测试】
价值：让你敢改，不是证明对
该测：纯函数 / 数据转换 / store / 复杂条件渲染
不该测：实现细节 / 第三方库 / 样式 / 常量
覆盖率≠质量：toBeDefined 也能刷满
验证测试：变异测试（改 > 为 >= 看测试红不红）
分层 4:5:1（单元:集成:E2E）
MSW 拦真实请求 > mock axios
```

---

## 6.6 自测

```
□ 能用一句话区分 ESLint 和 Prettier 的职责
□ 能说出「会不会改变行为」这个关键区别
□ 能说出冲突的触发条件（ESLint 开着格式规则 + 两边默认风格相反）
□ 能说出 eslint-config-prettier 的作用和放置位置
□ 能说出为什么不推荐 eslint-plugin-prettier
□ 能说出 `--fix` 和 Prettier 的正确执行顺序
□ 能解释「Lint 为什么不误报字符串里的代码」
□ 能说出 Lint 依赖 AST 的哪些字段（type / operator / loc）
□ 能手写出 no-var 和 eqeqeq 两条规则
□ 能说出 ESLint 相比手写遍历多出的核心能力
□ 能说出单元测试的真正价值
□ 能列出三个「不该测」的东西
□ 能解释覆盖率为什么不能当 KPI
□ 能说出变异测试是什么
□ 能说出单元/集成/E2E 的推荐比例和理由
□ 能解释 MSW 相比 mock axios 的优势
□ 能说出老项目补测试的正确做法
```
