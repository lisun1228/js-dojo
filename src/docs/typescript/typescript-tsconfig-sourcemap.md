# TS · 09 工程化：tsconfig 与 sourcemap

> 覆盖：tsconfig 的字段与常用编译选项、`strict` 的子开关、sourcemap 的产物与生产处理
> 以下 tsconfig 行为以仓库内 tsc 6.0.3 实测为准，跨版本差异单独标注

---

## 目录

- [9.1 一句话结论](#91-一句话结论)
- [9.2 tsconfig 的整体结构](#92-tsconfig-的整体结构)
- [9.3 核心编译选项（按用途分组）](#93-核心编译选项按用途分组)
- [9.4 sourcemap](#94-sourcemap)
- [9.5 一份完整的现代前端 tsconfig](#95-一份完整的现代前端-tsconfig)
- [9.6 常见坑](#96-常见坑)
- [9.7 答题模板](#97-答题模板)
- [9.8 速记卡](#98-速记卡)

---

## 9.1 一句话结论

**`tsconfig.json` 是编译契约**：决定哪些文件参与编译、输出到哪个 ES 版本与模块格式、严格程度、产物位置。
**sourcemap 是「产物位置 → 源码位置」的映射**，调试时让 DevTools 显示 TS 源码；生产环境直接发布 `.map` 会泄露源码，通行做法是 `hidden-source-map` + 上传监控平台后删除。

---

## 9.2 tsconfig 的整体结构

### 9.2.1 顶层字段

```json
{
  "compilerOptions": { /* 编译选项，绝大多数配置在这里 */ },
  "include": ["src/**/*"],                  // 入口文件（glob）
  "exclude": ["node_modules", "dist"],      // 过滤 include 的结果
  "files": ["src/index.ts"],                // 精确入口，不展开 glob
  "extends": "./tsconfig.base.json",        // 继承另一个配置
  "references": [{ "path": "../shared" }],  // 项目引用（monorepo）
  "compileOnSave": false                    // 仅编辑器读取，tsc 命令行忽略
}
```

### 9.2.2 `include` / `exclude` / `files` 的区别

| 字段 | 写法 | 行为 |
|---|---|---|
| **`include`** | glob：`["src/**/*"]` | 最常用，与 `files` 并集作为入口 |
| **`exclude`** | glob | 只过滤 `include` 的结果，不影响 `files`，也不影响被入口 `import` 的文件 |
| **`files`** | 精确路径列表 | 不展开 glob，始终加入 |

三者都不写时：以当前目录为根，纳入所有 `.ts`/`.tsx`/`.d.ts`（开 `allowJs` 时含 `.js`）；`node_modules`、`bower_components`、`jspm_packages` 与 `outDir` 默认排除。

**两个边界**：

```json
// 1) include 用通配符，会把 src 外的 .ts（构建脚本、测试夹具）一起纳入
{ "include": ["**/*"] }

// 2) exclude 只过滤 include 匹配到的入口；被入口 import 的文件仍会编译
// b.ts import 了 a.ts → exclude a.ts 无效
```

### 9.2.3 `extends`：继承配置

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "lib": ["ES2020", "DOM"]
  }
}

// packages/app/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist" }   // 只写差异
}
```

**规则**：
- 相对路径按 base 文件位置解析；其他情况按模块解析（可继承 npm 包里的配置，如 `@tsconfig/node20`）
- `files` / `include` / `exclude` 整体覆盖，不合并
- `compilerOptions` 逐项覆盖：标量、数组、对象（包括 `paths`）都是替换

```json
// base: lib ["ES2020", "DOM"]；child: lib ["ES2020"] → DOM 类型消失
// base: paths { "@base/*": [...] }；child: paths { "@child/*": [...] } → 只剩 @child
```

---

## 9.3 核心编译选项（按用途分组）

### 9.3.1 目标与模块

| 选项 | 作用 | 常用值 |
|---|---|---|
| **`target`** | 编译到哪个 ES 版本；不写 `lib` 时默认 lib 随 target | `ES2020` / `ES2022` / `ESNext` |
| **`module`** | 输出哪种模块语法 | `ESNext` / `ES2022` / `CommonJS` / `NodeNext` |
| **`moduleResolution`** | 如何解析 import 路径 | `Bundler`（前端）/ `Node16` / `NodeNext`（Node） |
| **`lib`** | 引入哪些内置类型定义 | `["ES2022", "DOM", "DOM.Iterable"]` |

**`target`**：

| target | 结果 |
|---|---|
| `ES5` | class/async/可选链降级为辅助函数；`#x` 私有字段直接报错（要求 target ≥ ES2015）。TS 6 起标记废弃（TS5107），TS 7 移除 |
| `ES2020` | 可选链、空值合并原样输出 |
| `ES2022` | `#x` 原样输出（ES2020 及以下用 WeakMap 辅助）；顶层 await 还需 `module` 为 `ES2022`/`ESNext`/`Node16`+（target ≥ ES2017） |
| `ESNext` | 不降级（配合 bundler） |

`.at()`、`replaceAll` 这类 API 由 `lib` 提供，不由 `target` 提供。

**`moduleResolution`**：
- `Bundler`（TS 5.0+）：读 `package.json` 的 `exports`，允许相对导入省略扩展名，前端项目用
- `Node16` / `NodeNext`：同样读 `exports`；ESM 下相对导入必须写扩展名，否则 TS2835
- `Node10`（旧默认）：忽略 `exports`；TS 6 起标记废弃（TS5107）

### 9.3.2 输出

| 选项 | 作用 |
|---|---|
| **`outDir`** | 输出目录 |
| **`rootDir`** | 源码根目录，决定产物目录结构；配 `outDir` 且源码在 `src` 等子目录时必须显式写（否则 TS5011） |
| **`declaration`** | 生成 `.d.ts`（写库时用） |
| **`declarationMap`** | 生成 `.d.ts.map`；必须同时开 `declaration` 或 `composite`（TS5069） |
| **`sourceMap`** | 生成 `.js.map`，并在 js 末尾写 `//# sourceMappingURL=...` |
| **`noEmit`** | 只做类型检查，不输出文件；类型错误照常报告 |
| **`incremental`** | 增量编译，生成 `.tsbuildinfo` |
| **`removeComments`** | 删除注释 |

`noEmit: true` 是现代前端项目的常见选择：Vite/esbuild 负责转译，`tsc` 只负责类型检查。

### 9.3.3 严格性（本册重点）

#### `strict: true` 到底包含什么

| # | 开关 | 作用 | 不开启的后果 |
|---|---|---|---|
| 1 | **`noImplicitAny`** | 禁止隐式 `any` | 函数参数忘写类型不报错 |
| 2 | **`strictNullChecks`** | `null`/`undefined` 不能赋给其他类型 | `let s: string = null` 合法 |
| 3 | **`strictFunctionTypes`** | 函数类型参数逆变检查 | 函数类型赋值更宽松 |
| 4 | **`strictBindCallApply`** | `bind`/`call`/`apply` 校验参数 | 传错参数不报错 |
| 5 | **`strictPropertyInitialization`** | 类属性必须在声明或构造函数中初始化 | `class A { x: number }` 合法，运行时是 `undefined` |
| 6 | **`noImplicitThis`** | 禁止 `this` 隐式 `any` | `function f() { this.x }` 不报错 |
| 7 | **`alwaysStrict`** | 脚本产物输出 `"use strict"`（ES 模块本身已是严格模式） | 脚本不再处于严格模式 |
| 8 | **`useUnknownInCatchVariables`** | `catch` 变量是 `unknown`（TS 4.4+） | `catch (e) { e.message }` 不报错但可能崩 |
| 9 | **`strictBuiltinIteratorReturn`** | 内置迭代器 `next().value` 是 `T \| undefined`（TS 5.6+） | 越界读取被当成 `T` |

tsc 6.0.3 下 `strict` 默认 `true`；上表是 `strict: true` 展开的 9 个开关，老版本常引用前 8 个。

**`strictNullChecks`**：

```ts
// 关闭：通过编译，运行时崩
let s: string = null;
s.toUpperCase();

// 开启：TS2322
let t: string = null;
let u: string | null = null;
u?.toUpperCase();
```

**`strictPropertyInitialization`**：

```ts
class User {
  name: string;   // TS2564：没有初始化，也未在构造函数中赋值
}

class A { name = ''; }                          // 默认值
class B { name!: string; }                      // 非空断言
class C { constructor(public name: string) {} } // 构造函数赋值
```

**`strictFunctionTypes` 不作用于方法**：

```ts
type Fn = (x: string | number) => void;
const f: Fn = (x: string) => {};          // ❌ TS2322

interface Obj { method(x: string | number): void }
const o: Obj = { method(x: string) {} };  // ✅ 方法参数仍双变
```

方法参数保持双变是为了兼容既有 JS 与数组方法的签名，这是 `strictFunctionTypes` 的已知例外。

#### 其他严格性开关（不属于 `strict`，但建议开）

| 选项 | 作用 |
|---|---|
| **`noUncheckedIndexedAccess`** | `arr[0]` 变成 `T \| undefined` |
| **`noImplicitOverride`** | 重写父类方法必须加 `override` |
| **`noFallthroughCasesInSwitch`** | `switch` 的 case 必须 break/return |
| **`noUnusedLocals`** | 未使用的局部变量报错 |
| **`noUnusedParameters`** | 未使用的参数报错（可用 `_` 前缀忽略） |
| **`exactOptionalPropertyTypes`** | `x?: string` 不允许显式赋 `undefined`（需 `strictNullChecks`） |
| **`noPropertyAccessFromIndexSignature`** | 索引签名只能用 `obj['key']` 访问 |

### 9.3.4 互操作（`esModuleInterop` 那一组）

| 选项 | 作用 | 什么时候开 |
|---|---|---|
| **`esModuleInterop`** | 为 CJS 模块生成默认导入互操作（`__importDefault`） | TS 6 默认 `true`；显式 `false` 已废弃（TS5107） |
| `allowSyntheticDefaultImports` | 只放宽类型检查，不生成互操作代码 | 被 `esModuleInterop` 隐含；单独开时 `foo_1.default` 是 `undefined` |
| **`isolatedModules`** | 保证每个文件能独立转译（禁止类型再导出等写法） | 用 Vite/esbuild/Babel 时开 |
| **`verbatimModuleSyntax`** | 不做类型驱动的 import 消除，类型导入必须写 `type` | ESNext + bundler；CJS 输出下 ESM 语法会报 TS1295 |
| `allowJs` | 允许编译 `.js` | 渐进迁移时开 |
| `checkJs` | 对 `.js` 也做类型检查 | 渐进迁移时开 |
| `resolveJsonModule` | 允许 `import data from './a.json'` | 需要时开 |

**`esModuleInterop` 解决什么问题**：`export =` 的 CJS 模块，不开时只能用 `import * as express`（该命名空间可调用）；开启后才能写 `import express from 'express'`，否则报 TS1259。

`allowSyntheticDefaultImports` 只放宽类型检查，产物不会加 `__importDefault`：

```
esModuleInterop: true
  → const foo_1 = __importDefault(require('./foo'))
interop 关闭，仅 allowSyntheticDefaultImports: true
  → const foo_1 = require('./foo'); foo_1.default()
```

**`isolatedModules` 实际约束的是类型再导出**：

```ts
// types.ts：export interface User { name: string }

// ❌ TS1205：类型再导出必须写 export type
export { User } from './types';
// ✅ 与上面二选一
export type { User } from './types';

// 普通类型导入会被消除，isolatedModules 下不报错
import { User } from './types';
```

要求 `import type` 的是 `verbatimModuleSyntax`：

```ts
// verbatimModuleSyntax: true
import { User } from './types';       // ❌ TS1484
import type { User } from './types';  // ✅ 与上面二选一，产物为 import {} from './types'
```

**`verbatimModuleSyntax`（TS 5.0）与 `isolatedModules` 的区别**：

| 选项 | 行为 |
|---|---|
| `isolatedModules` | 禁止单文件无法处理的写法，但仍会做类型驱动的 import 消除 |
| **`verbatimModuleSyntax`** | 保留 import/export 语句，只剔除 `type` 说明符；类型导入必须显式 `type` |

CommonJS 输出 + ESM 语法在 `verbatimModuleSyntax` 下不兼容（TS1295），`module` 要选 ESM 系列。

### 9.3.5 路径映射 `paths`

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@components/*": ["./src/components/*"],
      "@utils": ["./src/utils/index.ts"]
    }
  }
}
```

```ts
import Button from '@/components/Button';   // ✅ 类型可解析
import { debounce } from '@utils';
```

**规则**：
- TS 4.1 起 `paths` 可以不配 `baseUrl`；此时每个目标值必须是相对路径（`./` 或 `../`，否则 TS5090），相对 tsconfig 所在目录解析
- `baseUrl` 在 TS 6 起标记废弃（TS5101），TS 7 移除
- `paths` 只影响类型解析，不影响运行时/打包

| 工具 | 运行时解析配置 |
|---|---|
| Vite | `resolve.alias['@'] = path.resolve(__dirname, 'src')` |
| webpack | `resolve.alias['@'] = path.resolve(__dirname, 'src')` |

### 9.3.6 其他重要选项

| 选项 | 作用 | 建议 |
|---|---|---|
| **`skipLibCheck`** | 跳过 `.d.ts` 内部的类型检查 | 建议开 |
| **`forceConsistentCasingInFileNames`** | 强制文件名大小写一致 | 开（macOS 不敏感、Linux 敏感，能提前发现） |
| `noErrorTruncation` | 错误信息不截断 | 调试复杂类型时开 |
| `allowImportingTsExtensions` | 允许 `import './a.ts'` | 需 `noEmit`/`emitDeclarationOnly`/`rewriteRelativeImportExtensions`（TS5096） |
| `jsx` | JSX 转换方式 | `react-jsx` / `preserve`（交给 bundler） |
| `experimentalDecorators` | 旧版装饰器 | Angular/NestJS 必开 |
| `emitDecoratorMetadata` | 装饰器元数据 | 配合 DI 用 |

**`skipLibCheck` 的边界**：只跳过 `.d.ts` 内部的声明冲突，自己 `.ts` 照查；`node_modules` 里不同版本的 `@types` 冲突时开它。

---

## 9.4 sourcemap

### 9.4.1 是什么

```js
// dist/app.js（编译后）
var a=function(e){return e*2};console.log(a(21));
//# sourceMappingURL=app.js.map
```

```json
// dist/app.js.map
{
  "version": 3,
  "sources": ["../src/app.ts"],
  "names": [],
  "mappings": "AAAA,SAAS;AACT,..."
}
```

**`mappings` 是核心**：VLQ 编码，记录「产物第 X 行第 Y 列 ← 源码第 A 行第 B 列」。
**`sourcesContent`** 是可选字段：只有同时开 `inlineSources` 与 `sourceMap`（或 `inlineSourceMap`）才会写入，单独开 `inlineSources` 报 TS5051。

### 9.4.2 生成方式与产物

| 配置 | 产物 | 说明 |
|---|---|---|
| **`sourceMap: true`** | 独立 `.js.map` + 末尾 `//# sourceMappingURL=...` | 最常用 |
| **`inlineSourceMap: true`** | map 以 base64 data URI 内联到 js 末尾 | 单文件，体积大 |
| **`inlineSources: true`** | 把源码写入 map 的 `sourcesContent` | 需同时开 `sourceMap` 或 `inlineSourceMap` |
| **`declarationMap: true`** | `.d.ts.map`，跳转定义定位到 `.ts` | 需同时开 `declaration` 或 `composite` |

`noEmit: true` 时以上都不产生文件。

### 9.4.3 打包工具里的 `devtool`

TS 的 `sourceMap` 只管 tsc 这一步；用打包工具时，真正生效的是它的 sourcemap 配置（webpack 叫 `devtool`，Vite 叫 `build.sourcemap`）。

| `devtool` 值 | 质量 | 速度 | 说明 |
|---|---|---|---|
| `eval` | 差 | 最快 | 每个模块包在 `eval` 里，只有行映射 |
| `eval-cheap-module-source-map` | 中 | 快 | 开发常用 |
| `source-map` | 最好 | 慢 | 独立文件，完整映射 |
| `hidden-source-map` | 最好 | 慢 | 生成 map 但不加注释（用于上传监控） |
| `nosources-source-map` | 好 | 中 | 有映射但不含源码内容 |

```js
// webpack
devtool: 'source-map'          // 开发
devtool: 'hidden-source-map'   // 生产

// Vite
build: { sourcemap: true }     // 或 'inline' | 'hidden'
```

### 9.4.4 生产环境的风险

**上线 `.map` 等于公开源码。** 产物目录里的 `.js.map` 可被直接请求，`sourcesContent` 就是完整 TS/TSX。

泄露内容：完整业务源码与注释，以及代码中出现的内部地址、密钥等敏感信息。

**三种处理方式**：

**① `hidden-source-map` + 上传监控后删除（推荐）**

```js
module.exports = {
  devtool: 'hidden-source-map',   // 生成 .map，但不写 //# sourceMappingURL
};
// 构建后把 .map 上传到监控平台，再从产物目录删除
```

没有注释指向，浏览器不会自动请求；但文件名仍可被枚举，所以必须删除，不能留在服务器上。

**② `nosources-source-map`**：保留映射但不含 `sourcesContent`，监控平台能还原文件名/行号/函数名，看不到源码。

**③ 不开**：`build.sourcemap = false`。线上堆栈只剩压缩后的位置（`a is not a function at t.a1b2c3.js:1:2345`），排查困难。

**推荐组合**：

```
开发：eval-cheap-module-source-map
预发：source-map
生产：hidden-source-map + 上传监控 + 删除 .map
```

### 9.4.5 sourcemap 对性能的影响

| 影响 | 说明 |
|---|---|
| **构建时间** | 生成 map 会增加构建时间，`source-map` 模式最慢 |
| **产物体积** | `.map` 通常与 js 同量级或更大；含 `sourcesContent` 时更大 |
| **用户下载** | 独立 `.map` 不影响下载（DevTools 打开时才请求） |
| **`inlineSourceMap`** | map 直接进 js，增大体积、影响下载 |

---

## 9.5 一份完整的现代前端 tsconfig

```json
{
  "compilerOptions": {
    // 目标与模块
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",

    // 严格性
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,

    // 互操作
    "esModuleInterop": true,          // TS 6 默认 true，显式写便于跨版本
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "allowJs": false,

    // 输出
    "noEmit": true,
    "incremental": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.tsbuildinfo",

    // 路径
    "paths": { "@/*": ["./src/*"] },

    // 其他
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "types/**/*.d.ts"],
  "exclude": ["node_modules", "dist"]
}
```

`noEmit: true` 时产物交给 Vite/esbuild；`verbatimModuleSyntax` 要求 `module` 为 ESM 系列；`noUncheckedIndexedAccess` 较严格，老项目迁移时先别开。

---

## 9.6 常见坑

| 坑 | 正确说法 |
|---|---|
| **以为 `strict` 只是一个开关** | 它展开为 **9 个子开关**（tsc 6） |
| **以为 `paths` 配了就能跑** | ❌ 只影响类型解析，**打包工具要单独配 alias** |
| **`include` 通配会扫 `node_modules`** | ❌ 默认排除；但会把 `src` 外的 `.ts` 一起纳入 |
| **`exclude` 能完全排除文件** | ❌ 被其他文件 `import` 的仍会编译；`files` 里的文件也不受影响 |
| **`extends` 会合并数组和对象** | ❌ `files`/`include`/`exclude` 覆盖；`compilerOptions` 逐项覆盖，`paths` 也不合并 |
| **`isolatedModules` 要求所有类型导入写 `import type`** | ❌ 只报类型再导出（TS1205）；`import type` 是 `verbatimModuleSyntax` 的要求 |
| **`verbatimModuleSyntax` 完全不改 import/export** | 保留 import 语句，但剔除 `type` 说明符；CJS 输出下 ESM 语法报 TS1295 |
| **`skipLibCheck` 会跳过自己的检查** | ❌ 只跳过 `.d.ts` 内部检查，自己代码照查 |
| **以为 `sourceMap` 会让用户多下载** | 独立 `.map` 只有 DevTools 打开才请求；**`inlineSourceMap` 才会增大 js** |
| **生产环境直接开 `source-map`** | ⚠️ **源码泄露**；用 `hidden-source-map` + 上传后删除 |
| **`noEmit` 会阻止 `tsc` 检查** | ❌ 它只阻止输出文件，**类型检查照做** |
| **为了省事关掉 `strictPropertyInitialization`** | 它是防「属性忘初始化」的检查；用 `!` 或默认值解决 |
| **`strictFunctionTypes` 对方法也生效** | ❌ 方法参数仍双变（为兼容既有 JS 与数组方法） |

---

## 9.7 答题模板

### 30 秒版（tsconfig）

> `tsconfig.json` 分四块：文件范围（`include`/`exclude`/`files`）、目标与模块（`target`/`module`/`moduleResolution`/`lib`）、严格性（`strict` 及其子开关）、输出（`outDir`/`declaration`/`sourceMap`/`noEmit`）。另有 `extends` 继承、`paths` 别名、`references` 项目引用。
> 现代前端典型组合是 `noEmit: true` + `isolatedModules: true`：转译交给 bundler，`tsc` 只做类型检查。

### 30 秒版（sourcemap）

> `.map` 记录产物位置 → 源码位置，核心是 `mappings`（VLQ）；`sourcesContent` 可选。
> 生产环境不要直接发布 map：用 `hidden-source-map` 生成、上传监控平台后删除；不想暴露源码内容可用 `nosources-source-map`。

### 2 分钟版（串起来讲）

- **文件范围**：`include` 是 glob 入口，`exclude` 只过滤入口，被 `import` 的文件排除不掉；`files` 是精确入口，不受 `exclude` 影响。
- **目标与模块**：`target` 决定降级级别并给 `lib` 提供默认值；`module` 决定输出语法，`moduleResolution` 决定解析策略——前端 `Bundler`，Node `Node16`/`NodeNext`。
- **严格性**：`strict` 是总开关，tsc 6 展开为 9 个；`strictNullChecks` 决定 `null`/`undefined` 能否赋给其他类型，`strictFunctionTypes` 不作用于方法参数。
- **输出与互操作**：`noEmit` 只检查不输出；`isolatedModules` 约束单文件转译；`verbatimModuleSyntax` 要求显式 `type`；`paths` 只影响类型解析，打包工具要另配 alias。
- **sourcemap**：独立 `.map` 不影响用户下载，`inlineSourceMap` 会增大 js；生产用 `hidden-source-map` + 上传后删除。

---

## 9.8 速记卡

```
tsconfig 四块
  文件范围：include / exclude（只过滤 include）/ files（不受 exclude 影响）
  目标模块：target（决定降级与默认 lib）/ module / moduleResolution（前端 Bundler，Node Node16/NodeNext）/ lib
  严格性：strict（tsc 6 展开 9 个）
  输出：outDir / rootDir / noEmit / declaration / sourceMap / paths
  extends：files/include/exclude 覆盖；compilerOptions 逐项覆盖（paths 不合并）

★ strict 9 个
  noImplicitAny / strictNullChecks / strictFunctionTypes
  strictBindCallApply / strictPropertyInitialization / noImplicitThis
  alwaysStrict / useUnknownInCatchVariables / strictBuiltinIteratorReturn
  不在 strict 内但常开：noUncheckedIndexedAccess / noImplicitOverride / noFallthroughCasesInSwitch

现代前端
  noEmit + isolatedModules：tsc 只检查，转译交给 bundler
  verbatimModuleSyntax：类型导入必须写 type；CJS 输出下 ESM 语法报错
  paths：只影响类型解析；无 baseUrl 时目标值用 ./ 相对路径

sourcemap
  mappings（VLQ）→ 位置映射；sourcesContent 需 inlineSources + sourceMap
  sourceMap（独立）/ inlineSourceMap（内联，增大 js）/ declarationMap（需 declaration）
  独立 .map 不影响下载；生产 hidden-source-map + 上传 + 删除，或 nosources-source-map
```
