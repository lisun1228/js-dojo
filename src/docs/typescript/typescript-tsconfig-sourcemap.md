# TS · 09 工程化：tsconfig 与 sourcemap（题 24、29）

> 本册覆盖：tsconfig.json 的作用与常用配置（原题 24）、sourcemap 映射文件（题 29）
> 题单只列了 6 个配置项，**没提 `strict` 到底包含哪几个开关**——而这恰恰是最高频的追问。
> sourcemap 那题只说「调试时能看到 TS 源码」，没说**生产环境的安全风险**和 `hidden-source-map` 的正确用法。

---

## 9.1 一句话结论

**`tsconfig.json` 是 TS 项目的「编译契约」**：决定哪些文件参与编译、编译成什么目标、有多严格、输出到哪。
**sourcemap 是「编译后代码 → 源码」的位置映射**，让调试时看到 TS 而不是编译产物。**生产环境开了会泄露源码，正确做法是 `hidden-source-map` + 上传监控平台后删除。**

---

## 9.2 tsconfig 的整体结构

### 9.2.1 顶层字段

```json
{
  "compilerOptions": { /* 编译选项，99% 的配置在这里 */ },
  "include": ["src/**/*"],           // 包含哪些文件
  "exclude": ["node_modules", "dist"], // 排除哪些
  "files": ["src/index.ts"],         // 精确列出（极少用）
  "extends": "./tsconfig.base.json", // 继承另一个配置
  "references": [{ "path": "../shared" }], // 项目引用（monorepo）
  "compileOnSave": false             // 编辑器保存时编译（已废弃）
}
```

### 9.2.2 `include` / `exclude` / `files` 的区别

| 字段 | 写法 | 特点 |
|---|---|---|
| **`include`** | 支持 glob：`["src/**/*"]` | 最常用 |
| **`exclude`** | 支持 glob | 只对 `include` 生效，**不影响 `files`** |
| **`files`** | 精确路径列表 | 不展开 glob，**优先级最高** |

**默认行为**（三个都不写）：编译当前目录及子目录下所有 `.ts`/`.tsx`/`.d.ts`（排除 `node_modules`、`bower_components`、`jspm_packages`、`outDir`）。

**⚠️ 两个坑**：

```json
// 坑 1：只写 include 不写 exclude，node_modules 里的 .d.ts 也会被扫
{ "include": ["**/*"] }   // 会很慢

// 坑 2：exclude 不影响被 include 的文件 import 进来的文件
// a.ts 被 exclude 了，但 b.ts import 了它 → a.ts 还是会被编译
```

### 9.2.3 `extends`：继承配置

```json
// tsconfig.base.json（共享配置）
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "moduleResolution": "bundler"
  }
}

// packages/app/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist"          // 只写差异
  }
}
```

**规则**：
- 相对路径（`./` 或 `../`）按**文件位置**解析
- 其他情况按**模块解析**（可以 `extends` 一个 npm 包里的配置，如 `@tsconfig/node20`）
- **`files`/`include`/`exclude` 会被覆盖**（不是合并）
- `compilerOptions` 里的**对象类型字段会被合并**（如 `paths`），**数组和标量会被覆盖**

**这个「数组合并被覆盖」的区别很重要**：

```json
// base: { "lib": ["ES2020", "DOM"] }
// child: { "lib": ["ES2020"] }   → 最终只有 ES2020，DOM 没了
```

---

## 9.3 核心编译选项（按用途分组）

### 9.3.1 目标与模块

| 选项 | 作用 | 常用值 |
|---|---|---|
| **`target`** | 编译成哪个 ES 版本 | `ES2020` / `ES2022` / `ESNext` |
| **`module`** | 用什么模块语法输出 | `ESNext` / `ES2022` / `CommonJS` / `NodeNext` |
| **`moduleResolution`** | 怎么解析 import 路径 | `bundler`（前端）/ `node16` / `nodenext`（Node） |
| **`lib`** | 引入哪些内置类型定义 | `["ES2022", "DOM", "DOM.Iterable"]` |

**`target` 怎么选**：

| target | 影响 |
|---|---|
| `ES5` | 所有新语法都降级（class → `__extends`、async → `__awaiter`），产物体积大 |
| `ES2020` | 支持可选链/空值合并原生输出，**现代项目推荐起点** |
| `ES2022` | 支持 `#x` 私有字段、顶层 await、`.at()` |
| `ESNext` | 不降级（配合 bundler 用） |

**`moduleResolution: "bundler"`（TS 5.0）**：前端项目的现代选择。它支持 `package.json` 的 `exports` 字段、允许省略扩展名（因为打包器会处理）。

### 9.3.2 输出

| 选项 | 作用 |
|---|---|
| **`outDir`** | 输出目录 |
| **`rootDir`** | 源码根目录（决定输出目录结构） |
| **`declaration`** | 生成 `.d.ts`（写库必开） |
| **`declarationMap`** | 生成 `.d.ts.map`（让「跳转到定义」能定位到 `.ts` 源码） |
| **`sourceMap`** | 生成 `.js.map` |
| **`noEmit`** | **只做类型检查，不输出文件**（配合 bundler 时必开） |
| **`incremental`** | 增量编译，生成 `.tsbuildinfo` |
| **`removeComments`** | 删注释 |

**现代前端项目的典型配置**：

```json
{
  "compilerOptions": {
    "noEmit": true,                          // ★ 只检查，产物交给 Vite/esbuild
    "declaration": false,
    "incremental": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.tsbuildinfo"
  }
}
```

**为什么 `noEmit: true`**：因为 Vite/esbuild 负责转译（快 10~100 倍），`tsc` 只负责类型检查。**这是目前的主流分工。**

### 9.3.3 严格性（本册重点）

#### `strict: true` 到底包含什么（8 个）

| # | 开关 | 作用 | 不开启的后果 |
|---|---|---|---|
| 1 | **`noImplicitAny`** | 禁止隐式 `any` | 函数参数忘写类型不报错 |
| 2 | **`strictNullChecks`** | `null`/`undefined` 不能赋给其他类型 | `let s: string = null` 合法（**最危险**） |
| 3 | **`strictFunctionTypes`** | 函数参数**逆变**检查 | 函数类型赋值更宽松（不安全） |
| 4 | **`strictBindCallApply`** | `bind`/`call`/`apply` 严格检查参数 | 传错参数不报错 |
| 5 | **`strictPropertyInitialization`** | 类属性必须在声明或构造函数中初始化 | `class A { x: number }` 合法（运行时是 undefined） |
| 6 | **`noImplicitThis`** | 禁止 `this` 隐式 `any` | `function f() { this.x }` 不报错 |
| 7 | **`alwaysStrict`** | 输出 `"use strict"` | 非严格模式的怪异行为 |
| 8 | **`useUnknownInCatchVariables`** | `catch` 变量是 `unknown`（TS 4.4） | `catch (e) { e.message }` 不报错但可能崩 |

> TS 5.6 起还多了 `strictBuiltinIteratorReturn`，所以严格说现在是 9 个。面试说「8 个主要的」即可。

**面试时的标准答法**：

> 「`strict` 是个总开关，打开它会同时开启 8 个子开关：`noImplicitAny`、`strictNullChecks`、`strictFunctionTypes`、`strictBindCallApply`、`strictPropertyInitialization`、`noImplicitThis`、`alwaysStrict`、`useUnknownInCatchVariables`。其中**最关键的是 `strictNullChecks`**——不开的话 null 能赋给任何类型，等于白用 TS。」

#### 几个值得单独说的

**`strictNullChecks`**（最重要）：

```ts
// 关闭时
let s: string = null;         // ✅
s.toUpperCase();              // 💥 运行时崩

// 开启时
let s: string = null;         // ❌ 报错
let t: string | null = null;  // ✅
t?.toUpperCase();             // ✅
```

**`strictPropertyInitialization`**：

```ts
class User {
  name: string;     // ❌ 报错：属性 'name' 没有初始化表达式，且未在构造函数中明确赋值

  // 三种解法
  name: string = '';                    // ① 给默认值
  name!: string;                        // ② 非空断言（告诉编译器「别管」）
  constructor(name: string) { this.name = name; }  // ③ 构造函数里赋值
}
```

**这个开关在 Vue/React 类组件时代很烦**，但能防止「属性忘初始化」的 bug。

**`strictFunctionTypes` 的一个特例**：

```ts
// 函数类型：参数逆变 ✅ 会检查
type Fn = (x: string | number) => void;
const f: Fn = (x: string) => {};      // ❌ 报错（参数更窄）

// 方法：参数双变（不检查）
interface Obj {
  method(x: string | number): void;
}
const o: Obj = {
  method(x: string) {},               // ✅ 不报错！
};
```

**原因**：为了兼容 JS 的数组方法（`Array<T>` 的 `push` 等），TS 故意让**方法**参数保持双变。**这是 TS 的一个已知不健全之处。**

#### 其他严格性开关（不属于 `strict`，但建议开）

| 选项 | 作用 |
|---|---|
| **`noUncheckedIndexedAccess`** | `arr[0]` 变成 `T \| undefined`（防止越界） |
| **`noImplicitOverride`** | 重写父类方法必须加 `override` |
| **`noFallthroughCasesInSwitch`** | `switch` 的 case 必须 break/return |
| **`noUnusedLocals`** | 未使用的局部变量报错 |
| **`noUnusedParameters`** | 未使用的参数报错（可用 `_` 前缀忽略） |
| **`exactOptionalPropertyTypes`** | `x?: string` 不允许显式赋 `undefined`（更严格） |
| **`noPropertyAccessFromIndexSignature`** | 索引签名只能用 `obj['key']` 访问 |

### 9.3.4 互操作（`esModuleInterop` 那一组）

| 选项 | 作用 | 什么时候开 |
|---|---|---|
| **`esModuleInterop`** | 允许 `import React from 'react'`（CJS 模块的默认导入） | ✅ **几乎必开** |
| `allowSyntheticDefaultImports` | 只影响类型检查，不生成 `__importDefault` | 被 `esModuleInterop` 隐含 |
| **`isolatedModules`** | 保证每个文件能独立转译（不依赖跨文件类型信息） | ✅ **用 Vite/esbuild/Babel 必开** |
| **`verbatimModuleSyntax`** | 更严格：`import`/`export` 原样保留，**只用于类型的必须写 `type`** | ✅ **TS 5.0 推荐** |
| `allowJs` | 允许编译 `.js` | 渐进迁移时开 |
| `checkJs` | 对 `.js` 也做类型检查 | 渐进迁移时开 |
| `resolveJsonModule` | 允许 `import data from './a.json'` | 需要时开 |

**`esModuleInterop` 解决什么问题**：

```ts
// CommonJS 模块（比如 express）
// 编译前（没有 esModuleInterop）
import * as express from 'express';    // 必须这样写

// 有 esModuleInterop 后
import express from 'express';          // ✅ 更自然
```

**`isolatedModules` 为什么必开**：

单文件转译器（esbuild/swc/Babel）**看不到其他文件的类型信息**，所以有几类写法它无法处理：

```ts
// ❌ isolatedModules 下报错：Re-exporting a type when 'isolatedModules' is enabled
//    requires using 'export type'
export { User } from './types';        // User 是 interface

// ✅ 必须明确
export type { User } from './types';
```

**同类问题**：

```ts
// ❌ 报错：'Foo' is a type and must be imported using a type-only import
import { Foo } from './foo';
let x: Foo;

// ✅
import type { Foo } from './foo';
```

**`verbatimModuleSyntax`（TS 5.0）比 `isolatedModules` 更严格**：

| 选项 | 行为 |
|---|---|
| `isolatedModules` | 禁止「单文件无法处理的写法」，但**仍然会做 import 消除** |
| **`verbatimModuleSyntax`** | **完全不改 import/export**，你写什么就输出什么；只用于类型的**必须**标 `type` |

```ts
// verbatimModuleSyntax: true
import { Foo } from './foo';      // ❌ 如果 Foo 只是类型，报错
import type { Foo } from './foo'; // ✅
```

### 9.3.5 路径映射 `paths`（最常见也最容易配错的）

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@utils": ["src/utils/index.ts"]
    }
  }
}
```

```ts
import Button from '@/components/Button';    // ✅ 有类型提示
import { debounce } from '@utils';
```

**⚠️ 最大的坑：`paths` 只影响「类型解析」，不影响「运行时/打包」**

```
tsconfig 的 paths  → 只告诉 tsc「@/ 去哪儿找类型」
打包工具           → 需要单独配一遍，否则运行时找不到模块
```

**所以必须同时配**：

```js
// Vite
import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
```

```js
// webpack
module.exports = {
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
    extensions: ['.ts', '.tsx', '.js'],
  },
};
```

**另一个坑：`baseUrl` 的废弃趋势**。TS 5.0 起，`paths` **可以不用 `baseUrl`**（路径相对于 tsconfig 文件）。但很多老配置还依赖 `baseUrl`，混用会出问题。

### 9.3.6 其他重要选项

| 选项 | 作用 | 建议 |
|---|---|---|
| **`skipLibCheck`** | 跳过 `.d.ts` 的类型检查 | ✅ **建议开**（不然第三方库的类型冲突会让你抓狂） |
| **`forceConsistentCasingInFileNames`** | 强制文件名大小写一致 | ✅ 开（macOS 上不敏感、Linux 敏感，能提前发现） |
| `noErrorTruncation` | 错误信息不截断 | 调试复杂类型时开 |
| `allowImportingTsExtensions` | 允许 `import './a.ts'` | 配合 `noEmit` 用 |
| `jsx` | JSX 转换方式 | `react-jsx`（现代）/ `preserve`（交给 bundler）|
| `experimentalDecorators` | 旧版装饰器 | Angular/NestJS 必开 |
| `emitDecoratorMetadata` | 装饰器元数据 | 配合 DI 用 |

**`skipLibCheck` 为什么建议开**：

它只跳过 `.d.ts` 内部的检查，**不会跳过你自己代码的类型检查**。而 `node_modules` 里不同库的 `.d.ts` 经常互相冲突（同一个 `@types/node` 被不同版本引用），不开的话光报错就能堆满屏幕。

---

## 9.4 sourcemap（题 29）

### 9.4.1 是什么

```js
// dist/app.js（编译后，几乎不可读）
var a=function(e){return e*2};console.log(a(21));
//# sourceMappingURL=app.js.map
```

```json
// dist/app.js.map
{
  "version": 3,
  "sources": ["../src/app.ts"],
  "names": ["double", "n"],
  "mappings": "AAAA,SAASA,...",
  "sourcesContent": ["const double = (n: number) => n * 2;\nconsole.log(double(21));"]
}
```

**`.map` 的核心是 `mappings` 字段**——一串 VLQ 编码，记录「生成代码的第 X 行第 Y 列 ← 源码的第 A 行第 B 列」。

**`sourcesContent`** 是可选字段：开启 `inlineSources: true` 时会把**源码原文**也塞进 map 里（体积大，但离线可调试）。

### 9.4.2 三种生成方式

| 配置 | 产物 | 特点 |
|---|---|---|
| **`sourceMap: true`** | 独立的 `app.js.map` + 末尾注释 `//# sourceMappingURL=...` | 最常用 |
| **`inlineSourceMap: true`** | map 内容 base64 内联到 js 末尾 | 单文件，体积大 |
| **`inlineSources: true`** | 把**源码**也放进 map | 便于离线调试，体积更大 |

**配合 `declarationMap`**：生成 `.d.ts.map`，让「跳转到定义」能定位到 `.ts` 源码而不是 `.d.ts`（写库必开）。

### 9.4.3 打包工具里的 `devtool`

**TS 的 `sourceMap` 只管 tsc 那一步**；如果用 Vite/webpack，真正生效的是它们的 `devtool` 配置。

```js
// webpack
module.exports = {
  devtool: 'source-map',   // 开发用
  // 生产用
  // devtool: 'hidden-source-map',
};
```

| `devtool` 值 | 质量 | 速度 | 说明 |
|---|---|---|---|
| `eval` | 差 | **最快** | 每个模块包在 `eval` 里，只有行映射 |
| `eval-cheap-module-source-map` | 中 | 快 | **开发推荐** |
| `source-map` | **最好** | 慢 | 独立文件，完整映射 |
| `hidden-source-map` | 最好 | 慢 | **生成 map 但不加注释**（用于上传监控） |
| `nosources-source-map` | 好 | 中 | 有映射但**不含源码内容**（防泄露） |

```js
// Vite
export default defineConfig({
  build: {
    sourcemap: true,          // 或 'inline' | 'hidden'
  },
});
```

### 9.4.4 生产环境的风险（这是这题的重点）

**⚠️ 上线 `.map` 等于把源码公开。**

```bash
# 任何人都能这样拿到你的源码
curl https://yoursite.com/assets/app.a1b2c3.js.map
# → 里面 sourcesContent 就是完整的 TS/TSX 源码
```

**泄露什么**：

| 泄露内容 | 后果 |
|---|---|
| **完整业务源码** | 竞品直接抄 |
| **注释** | `// TODO: 这里 auth 有漏洞` |
| **API 地址、内部域名** | 攻击面暴露 |
| **硬编码的密钥/测试账号** | ⚠️ **安全事故** |
| **目录结构、模块划分** | 架构情报 |

**三种正确的处理方式**：

**① `hidden-source-map` + 上传监控后删除（推荐）**

```js
// webpack 生产配置
module.exports = {
  devtool: 'hidden-source-map',    // 生成 map，但不加 //# sourceMappingURL 注释
  plugins: [
    new SentryWebpackPlugin({
      include: './dist',
      urlPrefix: '~/assets',
      // 上传后自动删除本地 .map（Sentry 默认行为可用 sourceMapFilename 控制）
    }),
  ],
};
```

**为什么 `hidden`**：普通用户访问不到 map（没有注释指向），但监控平台能用它还原堆栈。

**② `nosources-source-map`**

有映射，但**不含 `sourcesContent`**——监控平台能还原「文件名 + 行号 + 函数名」，但看不到源码内容。**泄露风险最小。**

**③ 干脆不开**

```js
build: { sourcemap: false }
```

**代价**：线上报错只有压缩后的堆栈（`a is not a function at t.a1b2c3.js:1:2345`），几乎没法排查。

**所以推荐组合**：

```
开发环境：eval-cheap-module-source-map（快，够用）
预发环境：source-map（完整，方便调试）
生产环境：hidden-source-map + 上传 Sentry + 删除 .map
```

### 9.4.5 sourcemap 对性能的影响

| 影响 | 说明 |
|---|---|
| **构建时间** | 生成 map 会显著变慢（尤其是 `source-map` 模式） |
| **产物体积** | `.map` 通常和 js 差不多大甚至更大（含 `sourcesContent` 时） |
| **用户下载** | **0 影响**（浏览器只在 DevTools 打开时才请求 map） |
| **⚠️ 但如果是 `inlineSourceMap`** | **会增大 js 体积**，直接影响用户下载 |

**所以：独立 `.map` 文件对用户性能无影响；内联 map 有影响。**

---

## 9.5 一份完整的现代前端 tsconfig

```json
{
  "compilerOptions": {
    // ── 目标与模块 ──
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",

    // ── 严格性 ──
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,

    // ── 互操作 ──
    "esModuleInterop": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "resolveJsonModule": true,
    "allowJs": false,

    // ── 输出 ──
    "noEmit": true,
    "incremental": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.tsbuildinfo",

    // ── 路径 ──
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },

    // ── 其他 ──
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "types/**/*.d.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**注意几点**：
- `noEmit: true` + `isolatedModules: true`：产物交给 Vite，`tsc` 只做类型检查
- `verbatimModuleSyntax: true`：强制 `import type`，避免「误删有副作用的 import」
- `skipLibCheck: true`：避免第三方 `.d.ts` 冲突
- `noUncheckedIndexedAccess` 比较严格，**老项目迁移时先别开**

---

## 9.6 常见坑

| 坑 | 正确说法 |
|---|---|
| **以为 `strict` 只是一个开关** | 它包含 **8 个子开关**，面试必问 |
| **以为 `paths` 配了就能跑** | ❌ 只影响类型解析，**打包工具要单独配 alias** |
| **`exclude` 能完全排除文件** | ❌ 被其他文件 `import` 的仍会被编译 |
| **`extends` 会合并数组** | ❌ 数组和标量是**覆盖**，只有对象类型字段才合并 |
| **`isolatedModules` 可有可无** | 用 Vite/esbuild/Babel **必开**，否则类型导入会出问题 |
| **`verbatimModuleSyntax` 和 `isolatedModules` 一样** | 前者更严格：**完全不改 import/export** |
| **`skipLibCheck` 会跳过自己的检查** | ❌ 只跳过 `.d.ts` 内部检查，自己代码照查 |
| **以为 `sourceMap` 会让用户多下载** | 独立 `.map` 只有 DevTools 打开才请求；**`inlineSourceMap` 才会增大 js** |
| **生产环境直接开 `source-map`** | ⚠️ **源码泄露**；用 `hidden-source-map` + 上传后删除 |
| **`noEmit` 会阻止 `tsc` 检查** | ❌ 它只阻止输出文件，**类型检查照做** |
| **`strictPropertyInitialization` 很烦就关掉** | 它是防「属性忘初始化」的关键；用 `!` 或默认值解决 |
| **`strictFunctionTypes` 对方法也生效** | ❌ 方法参数仍双变（为兼容数组方法） |

---

## 9.7 答题模板

### 30 秒版（题 24：tsconfig）

> `tsconfig.json` 是 TS 项目的编译配置，分四块：**文件范围**（`include`/`exclude`/`files`）、**目标与模块**（`target`/`module`/`moduleResolution`/`lib`）、**严格性**（`strict` 及其子开关）、**输出**（`outDir`/`declaration`/`sourceMap`/`noEmit`）。还有 `extends` 继承、`paths` 路径别名、`references` 项目引用。
> 现代前端项目的一个典型特征是 **`noEmit: true`**——因为转译交给 Vite/esbuild，`tsc` 只负责类型检查，这样快很多。另外 `isolatedModules: true` 也是必开的，因为单文件转译器看不到跨文件类型信息。

### 30 秒版（题 29：sourcemap）

> sourcemap 是 `.map` 文件，记录「编译后代码位置 → 源码位置」的映射，让浏览器 DevTools 里能直接看 TS 源码、打断点、看错误堆栈指向原始行。
> 核心字段是 `mappings`（VLQ 编码的位置映射），可选的 `sourcesContent` 会带上源码原文。
> **生产环境要注意**：上线 `.map` 等于公开源码，注释、API 地址、甚至硬编码的密钥都可能泄露。正确做法是用 `hidden-source-map` 生成但不加引用注释，上传到 Sentry 这类监控平台后把 `.map` 文件删掉。

### 2 分钟版（串起来讲）

> 我分「tsconfig 的四个维度」和「sourcemap 的生产实践」讲。
>
> **tsconfig** 我一般按四块理解。第一是**文件范围**：`include` 支持 glob，`exclude` 只对 include 生效，被 import 的文件排除不掉。第二是**目标与模块**：`target` 决定降级到哪个 ES 版本，`module` 决定输出什么模块语法，`moduleResolution` 决定怎么解析 import 路径——前端用 `bundler`（TS 5.0 新增，支持 exports 字段和省略扩展名），Node 用 `node16`/`nodenext`。
>
> 第三是**严格性**，这里最容易被追问 `strict` 到底包含什么。它是 8 个开关的总开关：`noImplicitAny`、`strictNullChecks`、`strictFunctionTypes`、`strictBindCallApply`、`strictPropertyInitialization`、`noImplicitThis`、`alwaysStrict`、`useUnknownInCatchVariables`。其中**最关键的是 `strictNullChecks`**——不开的话 null 能赋给任何类型，等于白用 TS。另外还有几个不属于 strict 但建议开的：`noUncheckedIndexedAccess`（数组越界变 undefined）、`noImplicitOverride`、`noFallthroughCasesInSwitch`。
>
> 第四是**输出和互操作**。现代项目的典型特征是 `noEmit: true`——转译交给 Vite/esbuild，`tsc` 只做类型检查，因为 esbuild 快一两个数量级。配合这个必须开 `isolatedModules`，因为单文件转译器看不到跨文件类型信息，所以 `export { User }` 里如果 User 是类型就会报错，必须写 `export type`。TS 5.0 还加了更严格的 `verbatimModuleSyntax`，完全不改动 import/export。还有 `paths` 别名有个大坑：**它只影响类型解析，打包工具必须单独配一遍 alias**，否则运行时找不到模块。
>
> **sourcemap** 这边，`.map` 的核心是 `mappings` 字段，一串 VLQ 编码记录位置映射。配置上有三种：独立文件、`inlineSourceMap`（内联 base64）、`inlineSources`（把源码也放进去）。注意**独立 `.map` 对用户性能没影响**，浏览器只在 DevTools 打开时才请求；但 `inlineSourceMap` 会增大 js 体积，直接影响下载。
>
> 生产环境的关键是安全：**上线 `.map` 等于公开源码**，注释里的 TODO、内部 API 地址、甚至硬编码的测试密钥都会泄露。正确做法是 `hidden-source-map`——生成 map 但不加 `//# sourceMappingURL` 注释，用户拿不到，然后上传到 Sentry 这类平台还原堆栈，最后把 `.map` 从服务器删掉。如果连源码内容都不想给监控平台，用 `nosources-source-map`。

### 追问表

| 追问 | 回答要点 |
|---|---|
| `strict` 包含哪几个 | 8 个：noImplicitAny / strictNullChecks / strictFunctionTypes / strictBindCallApply / strictPropertyInitialization / noImplicitThis / alwaysStrict / useUnknownInCatchVariables |
| 哪个最关键 | `strictNullChecks`，不开等于白用 TS |
| `exclude` 能排除所有文件吗 | 不能，被 import 的仍会编译 |
| `extends` 怎么合并 | 对象字段合并，数组和标量覆盖 |
| `paths` 为什么要配两遍 | tsc 只管类型解析，运行时靠打包工具 alias |
| `noEmit` 有什么用 | 只类型检查不输出，配合 Vite/esbuild |
| `isolatedModules` 为什么必开 | 单文件转译看不到跨文件类型，要求 `import type`/`export type` |
| `verbatimModuleSyntax` 和上面区别 | 更严格，完全不改 import/export |
| `skipLibCheck` 会跳过自己的检查吗 | 不会，只跳过 `.d.ts` |
| `moduleResolution: bundler` 是什么 | TS 5.0 新增，支持 exports 字段、可省略扩展名 |
| sourcemap 的核心字段 | `mappings`（VLQ 编码）；`sourcesContent` 可选带源码 |
| 独立 map 会影响性能吗 | 不会，DevTools 打开才请求；`inlineSourceMap` 会 |
| 生产环境怎么配 sourcemap | `hidden-source-map` + 上传监控 + 删除 `.map` |
| 上线 `.map` 有什么风险 | 完整源码泄露（注释、API、密钥） |
| `nosources-source-map` 是什么 | 有映射但不含源码内容，泄露风险最小 |
| `declarationMap` 有什么用 | 让「跳转到定义」定位到 `.ts` 而不是 `.d.ts` |

---

## 9.8 速记卡

```
tsconfig 四块
  文件范围：include / exclude（对 include 生效）/ files
  目标模块：target / module / moduleResolution（前端 bundler，Node nodenext）/ lib
  严格性：strict + 其他
  输出互操作：outDir / noEmit / declaration / sourceMap / isolatedModules / paths
  extends：对象合并，数组标量覆盖

★ strict 的 8 个子开关
  noImplicitAny / strictNullChecks（最关键）/ strictFunctionTypes
  strictBindCallApply / strictPropertyInitialization / noImplicitThis
  alwaysStrict / useUnknownInCatchVariables
  不入 strict 但建议开：noUncheckedIndexedAccess / noImplicitOverride / noFallthroughCasesInSwitch

现代前端典型配置
  noEmit: true（转译交给 Vite/esbuild，tsc 只检查）
  isolatedModules: true（单文件转译要求 import type / export type）
  verbatimModuleSyntax: true（更严格，完全不改 import）
  skipLibCheck: true（避免三方 .d.ts 冲突）
  ★ paths 只影响类型解析 → 打包工具必须单独配 alias

sourcemap（题 29）
  核心字段 mappings（VLQ）；sourcesContent 可选带源码
  三种：sourceMap（独立）/ inlineSourceMap（内联，增大 js）/ inlineSources（含源码）
  ★ 独立 .map 不影响用户下载（DevTools 才请求）
  ★ 生产环境风险：完整源码泄露 → hidden-source-map + 上传监控 + 删除
  更保守：nosources-source-map（不含源码内容）
  webpack devtool：开发 eval-cheap-module-source-map / 生产 hidden-source-map
```
