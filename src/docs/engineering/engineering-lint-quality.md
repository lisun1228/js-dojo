# 工程化 06｜规范与质量保障

> 覆盖题号：5（ESLint 和 Prettier 区别）、13（Lint 工具为什么能检查错误）、26（前端怎么做单元测试）
> 去重后：**3 个考点**

---

## 6.1 ESLint 和 Prettier 的区别（题 5）

### 题单答案的问题

> 「ESLint：检查代码质量 + 格式。Prettier：只做格式（统一风格）。配合用：ESLint 管质量，Prettier 管格式，eslint-config-prettier 关闭冲突规则。」

**这个答案框架是对的**，是这份题单里质量较高的一条。但缺两个关键：

1. **没说清「为什么它们会冲突」**（根因是它们对同一件事有两套标准）
2. **没给实际配置**（面试官会问「你项目里怎么配的」）

### 一句话结论

> **ESLint 管「这段代码有没有问题」，Prettier 管「这段代码长什么样」。**
>
> 冲突的根因是：**ESLint 历史上也管格式**，所以两者对「引号用单还是双」有两套互相矛盾的答案。

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

这是最能体现理解深度的一点：

```
Prettier：改的是「空白和符号的排列」，语义 100% 等价
          const a = {b:1}  →  const a = { b: 1 };
          这两行的 AST 完全一样

ESLint：  --fix 可能真的改语义
          var a = 1;  →  const a = 1;    （prefer-const）
          删掉未使用变量 → 副作用可能被删
```

> **所以顺序很重要**：**先跑 ESLint 的 `--fix`（可能改语义），再跑 Prettier（只改格式）。** 反过来会白跑一遍。

### 实测：冲突到底长什么样

我用 ESLint 10.13.0 + Prettier 3.9.10 做了一组对照。

#### 准备：一个格式和质量都有问题的文件

```js
const a=1
const b  =  "x";
if(a==1){console.log(b)}
```

#### ① 只用 ESLint（开了格式规则）

配置里同时开了质量规则和格式规则：

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
```

**4 个问题，全是「可自动修」。**

#### ② 只用 Prettier

```
[warn] src/bad.js
[warn] Code style issues found in the above file.
```

Prettier 说「格式有问题」，但不告诉你具体哪里——**它不报错，它只重写。**

#### ③ 先跑 Prettier，再跑 ESLint ← 冲突在这里

Prettier 格式化后：

```js
const a = 1;
const b = "x";          // ← Prettier 默认用双引号！
if (a == 1) {
  console.log(b);
}
```

再跑 ESLint：

```
2:11  error  Strings must use singlequote         quotes     ← 冲突！
3:7   error  Expected '===' and instead saw '=='  eqeqeq
```

**注意第一条**：Prettier 刚把它改成双引号，ESLint 立刻说「必须用单引号」。

**这就是两个工具在打架**——如果配了 `lint-staged` 让两者都跑，会陷入「改完又被改回去」的死循环。

> **冲突的根因**：ESLint 早期把自己定位成「代码质量 + 代码风格」的工具，所以内置了 `quotes`、`semi`、`indent` 这些规则。Prettier 出现后，这些规则变成了重复职责。**而两者的默认风格恰好相反**（Prettier 默认双引号，ESLint 社区默认单引号）。

#### ④ 加 `eslint-config-prettier` 解决

配置：

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
  prettierConfig,   // ← 必须放最后
];
```

再跑：

```
3:7  error  Expected '===' and instead saw '=='  eqeqeq
```

**只剩 1 个错，而且是真正的质量问题。冲突消失了。**

#### ⑤ 修完质量问题，两边都通过

```
ESLint: （无输出）
Prettier: All matched files use Prettier code style!
```

### 三种配合方案对比

| 方案 | 配置 | 优点 | 缺点 | 推荐度 |
|---|---|---|---|---|
| **分权**（ESLint 管质量 + Prettier 管格式 + `eslint-config-prettier`） | 两个工具各跑各的 | 职责清晰、各用各的编辑器插件、报错来源明确 | 要跑两个命令 | ⭐⭐⭐⭐⭐ **主流** |
| **一体化**（`eslint-plugin-prettier`，把 Prettier 当 ESLint 规则） | 只跑 ESLint | 一个命令、一个 IDE 面板 | **慢**（Prettier 在 ESLint 里跑，无法并行）、报错信息是 Prettier 的格式（不好定位）、无法用 Prettier 的 CLI 功能 | ⭐⭐ |
| **只 Prettier**（ESLint 完全不管格式） | ESLint 只留质量规则 | 最简单 | 需要自己保证团队都装了 Prettier 插件 | ⭐⭐⭐⭐ |

> **`eslint-plugin-prettier` 为什么不推荐**：
> 「它的思路是『把 Prettier 的差异变成 ESLint 的 error』。听起来很方便，但代价是**每个文件都要在 ESLint 的进程里跑一遍 Prettier**——大项目里 lint 时间翻倍。而且 ESLint 的报错会变成 `Delete ⏎` 这种格式差异，可读性很差。**官方文档现在也建议不要用它，改用 `eslint-config-prettier` + 分开跑。**」

### 实际项目配置（可直接用）

```js
// eslint.config.mjs（ESLint 9+ 的 flat config）
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import prettierConfig from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...vue.configs['flat/recommended'],

  {
    rules: {
      // 质量：必须开
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // 框架相关
      'vue/multi-word-component-names': 'off',   // 允许单词组件名

      // 类型相关
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // ① 忽略目录
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },

  // ② 必须放最后：关闭所有与 Prettier 冲突的规则
  prettierConfig,
];
```

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "trailingComma": "all",
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

**`endOfLine: "lf"` 这个容易被忽略**——Windows 上 git 默认 `autocrlf` 会转成 CRLF，和 Prettier 的默认 `lf` 冲突，导致「本地全绿、CI 全红」。加 `"endOfLine": "lf"` + `.gitattributes` 一起解决。

### 追问链

| 追问 | 答法 |
|---|---|
| 为什么 Prettier 不报具体哪里错？ | 它是「重新打印器」不是「检查器」。它把你的 AST 按自己的规则打印一遍，只是不告诉你差异在哪（`--write` 直接覆盖）。要定位用 `prettier --check` + git diff |
| ESLint 的 `--fix` 有风险吗？ | 有。`prefer-const`、`no-unused-vars` 这类可能改变行为。**建议 fix 完后 review diff**，尤其别在 CI 里对源码跑 `--fix` |
| 团队不想装 Prettier 插件怎么办？ | 用 `lint-staged` + husky 在提交时自动格式化。**把「格式」从「人的习惯」变成「流程的保证」** |
| ESLint 10 还内置格式规则吗？ | **仍然可用**（我实测 `quotes`/`semi`/`indent` 都生效），但官方方向是把格式规则迁到 `@stylistic/eslint-plugin`。**新项目不要再用这内置格式规则** |
| 为什么 ESLint 要用 flat config？ | 旧版 `.eslintrc` 的 `extends`/`overrides` 组合太复杂，无法静态分析「最终生效的规则」。flat config 是一个数组，**从前往后合并，行为可预测** |
| 怎么让 lint 只检查改动的文件？ | `lint-staged` 或 `git diff --name-only --diff-filter=ACMR | xargs eslint` |
| lint 在 CI 里跑多久算合理？ | 中型项目（500 个文件）应该在 30 秒内。超过说明要么规则太多、要么没开缓存。**ESLint 有 `--cache` 参数**，二次跑能快 10 倍 |

---

## 6.2 Lint 工具为什么能检查代码错误（题 13）

### 题单答案的问题

> 「把源码解析成 AST，遍历 AST 检查规则。ESLint 就是这么做的。」

**一句话说对了 80%**。缺的是：**为什么这样做就不会误判**，以及**AST 里的规则长什么样**。

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

用 `espree`（ESLint 的默认 parser）解析 `var a = 1 + 2;`：

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

### 手写一条 Lint 规则（不用 ESLint，40 行）

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

实测输出：

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

**这就是 ESLint 的全部原理。** 它内置的 300 多条规则，本质就是 300 多个这样的「节点匹配 + 报告」。

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
 ↓ @eslint/eslintrc 加载配置
 ↓ parser（默认 espree）解析 → AST
 ↓ eslint-scope 建作用域链
 ↓ SourceCode 包装 AST（提供 getText / getTokenBefore 等工具）
 ↓ 遍历 AST：对每个节点，把「所有在乎这个节点的规则」的回调都调用一遍
 ↓ 收集 messages（含 ruleId / severity / message / line / column / fix）
 ↓ 输出格式化
```

**注意第 5 步的机制**：ESLint **只遍历一次**，把每个节点分发给所有关心它的规则。所以 300 条规则的耗时不是 300 次遍历。

### 追问链

| 追问 | 答法 |
|---|---|
| ESLint 用什么 parser？ | 默认 `espree`（基于 acorn）。**TS 项目要换 `@typescript-eslint/parser`**，Vue 要换 `vue-eslint-parser` |
| parser 换了，规则还能用吗？ | 质量规则能用（因为 TS 的 AST 是 ESTree 的超集）。**但纯 JS 的某些规则在 TS 上会误报**，所以 TS 项目要用 `@typescript-eslint/*` 版本的规则 |
| 为什么 Lint 不会误报字符串里的代码？ | 因为字符串在 AST 里是 `Literal` 节点，不是 `BinaryExpression`。**它看结构不看字符** |
| 注释里的代码会被检查吗？ | 默认不会（注释不进 AST）。但 `eslint-plugin-jsdoc` 这类插件会用 `sourceCode.getAllComments()` 单独处理注释 |
| ESLint 为什么比正则慢？ | 要解析完整 AST + 建作用域。但换来的是**零误报**。**正则只适合「找某个固定模式」，不适合「判断代码结构」** |
| 那为什么有的工具用正则？ | 因为快，且场景简单。比如 `grep` 搜 `console.log` 是合理需求。**但只要涉及「这个 console.log 是不是在注释里」，正则就不够了** |
| 自定义规则怎么发布？ | 做成 `eslint-plugin-xxx` 包，用 `RuleTester` 写测试 |

---

## 6.3 前端怎么做单元测试（题 26）

### 题单答案的问题

> 「Jest + Vue Test Library / React Testing Library。写用例测函数和组件。覆盖率工具 istanbul。」

**工具名对了，但「怎么做」只说了一句「写用例」**。缺的是：

1. **测什么、不测什么**（这是最容易答错的）
2. **覆盖率为什么不能当 KPI**
3. **单元测试 / 组件测试 / E2E 的分层**

### 一句话结论

> 单元测试的价值不是「证明代码对」，是**「让你敢改」**。

> 这句话说出来，面试官会认为你理解测试的意义，而不是完成任务。

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

### 不该测什么（这段最能体现经验）

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

**区别**：前者测「怎么实现的」，后者测「用户看到什么」。**前者会阻碍重构，后者不会。**

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

**更靠谱的指标**：**Mutation Testing（变异测试）**——工具（Stryker）会故意改动你的源码（比如把 `>` 改成 `>=`），看测试能不能发现。**发现不了说明测试是无效的。**

> 面试时可以说：
> 「我不把覆盖率当 KPI。覆盖率能告诉『哪些代码完全没测』，但不能告诉『测得对不对』。要验证测试质量，得用变异测试——故意改坏代码，看测试会不会红。**行覆盖率 60% 但有变异测试把关，比行覆盖率 95% 但全是 `toBeDefined` 有价值得多。**」

### 测试分层（金字塔 vs 奖杯）

```
        传统金字塔                    现代奖杯（Kent C. Dodds）
        /\   E2E 5%                    /\
       /  \                            /  \   E2E 10%
      /    \  集成 15%                /----\
     /      \                        /      \  集成/组件 50%   ← 加厚
    /        \ 单元 80%             /--------\
                                  /          \ 单元 40%
```

**为什么现代实践把「集成」加厚？**

因为**前端的问题大多在「组件之间」**，不在「单个函数里」。一个按钮组件单测 100% 通过，但和表单组合起来的交互可能是错的。

> 「我的分层原则是：**纯逻辑单元测，交互组件集成测，关键路径 E2E 测。** 比例大概 4:5:1。E2E 只测三条链路：登录、核心业务、支付。」

### 工具选型

| 工具 | 定位 | 特点 |
|---|---|---|
| **Vitest** | 测试运行器 | **Vite 原生、极快、API 兼容 Jest**。新项目首选 |
| **Jest** | 测试运行器 | 生态最成熟，但需要 babel/ts-jest 转换，**慢** |
| **@testing-library/react / vue** | 组件测试工具 | 从「用户视角」查询元素，**不鼓励测实现细节** |
| **@vue/test-utils** | Vue 组件测试 | 更底层，能访问组件实例（**容易写成测实现细节**） |
| **MSW** | 网络 mock | **拦截真实 fetch**，比 mock 掉 axios 更接近真实 |
| **Playwright / Cypress** | E2E | Playwright **更快更稳**，Cypress 调试体验好 |

**MSW 这一点值得说**：

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

**区别**：前者测的是「你的代码怎么调 axios」，后者测的是「你的代码处理响应对不对」。**后者不会因为换 HTTP 库就全部报错。**

### 一个真实的测试用例（写完能直接跑）

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

**注意最后两条**：它们不是「主要功能」，但**线上事故往往出在这些地方**。

### 面试怎么说

> 「我做测试的原则是**测试行为不测实现**。
>
> 具体分层：**纯函数和工具函数写单元测试**，要求覆盖主要分支和边界；**组件用 Testing Library 做集成测试**，从用户角度断言「看到什么」而不是「内部状态是什么」；**E2E 只测三条关键链路**，因为 E2E 慢且脆。
>
> 比例大概是 4:5:1——**单元 40%、集成 50%、E2E 10%**。为什么集成比单元多？因为前端的问题大多在组件之间，不在单个函数里。
>
> 覆盖率我不当 KPI。行覆盖率能说明「哪些代码完全没跑过」，但说明不了「测得对不对」。要验证测试本身的质量，我会用变异测试——故意把 `>` 改成 `>=`，看测试能不能红。
>
> 还有一个实践：网络请求我用 MSW 而不是 mock axios。因为 MSW 拦的是真实请求，换 HTTP 库不用改测试。」

### 追问链

| 追问 | 答法 |
|---|---|
| 组件快照测试有用吗？ | **谨慎用**。快照一改就全红，很多人直接 `-u` 更新，等于失去意义。**只对「不该变的稳定结构」用**（比如生成的图标、序列化输出） |
| 怎么测异步？ | `await waitFor(() => expect(...))` 或 `findBy*` 查询。**不要用 `setTimeout` 等待** |
| 怎么测自定义 hook？ | `renderHook`（Testing Library 提供）。**测它的返回值变化，不测内部 state** |
| 怎么测路由跳转？ | 用 `MemoryRouter` 包一层，断言 `location.pathname`。**不要测 window.location** |
| 覆盖率多少算合格？ | 看代码性质。**核心业务逻辑 80%+，UI 组件不设硬指标，工具库 90%+**。一刀切 80% 是最差的做法——会逼着人写无意义测试凑数 |
| CI 里测试跑多久可接受？ | 单元 + 集成应该在 **2 分钟内**。超过就会有人开始跳过测试。E2E 可以更长，但应该并行 |
| 老项目没测试怎么办？ | **不要一次性补**。从「改 bug 时顺手补一条能复现该 bug 的测试」开始。**这叫「防御性补测」，成本最低收益最高** |
| 测试写得慢怎么办？ | 三个原因：① 代码耦合太深（该重构）；② 到处 mock（该改依赖注入）；③ 测了太多实现细节（该换成行为断言） |

---

## 6.4 本册追问总表

| 问题 | 一句话答 |
|---|---|
| ESLint 和 Prettier 一句话分工 | ESLint 管「有没有问题」，Prettier 管「长什么样」 |
| 它们为什么冲突 | 都管格式，且默认风格相反（Prettier 双引号 vs ESLint 社区单引号） |
| 怎么解决冲突 | `eslint-config-prettier` 放最后，关掉所有格式规则 |
| 为什么不推荐 `eslint-plugin-prettier` | 慢（Prettier 在 ESLint 进程里跑）+ 报错信息难读，官方也建议别用 |
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
ESLint：发现问题 / 看语义 / 可能改行为 / 部分能 fix
Prettier：统一排版 / 看形状 / 不改语义 / 全量重写
冲突根因：ESLint 历史上也管格式，两者默认风格相反
解法：eslint-config-prettier 放最后 + 删除所有格式规则

【实测冲突过程】
Prettier 把 'x' → "x"
ESLint quotes:['error','single'] 立刻报错
加 eslint-config-prettier → 只剩 eqeqeq（真问题）
→ 冲突消失，两边通过

【三种方案】
分权（推荐）：ESLint 质量 + Prettier 格式 + config-prettier
一体化（不推荐）：eslint-plugin-prettier → 慢 + 报错难读
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
□ 能复述冲突的实测过程（Prettier 双引号 vs ESLint 单引号）
□ 能说出 eslint-config-prettier 的作用和放置位置
□ 能说出为什么不推荐 eslint-plugin-prettier
□ 能说出 `--fix` 和 Prettier 的正确执行顺序
□ 能解释「Lint 为什么不误报字符串里的代码」
□ 能说出 Lint 看的是 AST 的哪两个字段
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
