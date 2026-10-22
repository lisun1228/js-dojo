# React 09｜生态与工程化（延伸补充）

> ⚠️ **本册不是原题内容**。原 83 题里没有生态与工程化相关题目，但真实面试（尤其 3 年以上岗位）几乎必问。
> 本册按"最常被追问的四个方向"补充：**状态库选型 / 渲染模式（SSR·RSC）/ React 19 / 工程化落地**。
> 每节只保留"能答出判断力"的部分，不复述文档。

---

## 目录

- [本册速查](#本册速查)
- [9.1 状态管理怎么选型？](#91-状态管理怎么选型)
- [9.2 SSR、SSG、RSC 分别解决什么问题？](#92-ssrssgrsc-分别解决什么问题)
- [9.3 React 19 有哪些值得关注的变化？](#93-react-19-有哪些值得关注的变化)
- [9.4 React 工程化要关注什么？](#94-react-工程化要关注什么)
- [本册自测](#本册自测)

---

## 本册速查

| 专题 | 一句话答案 |
|---|---|
| 9.1 状态管理选型 | 客户端状态按"共享范围 × 更新频率"选；服务端状态交给 TanStack Query |
| 9.2 SSR / SSG / RSC | 三者解决的是"首屏内容从哪来"，代价在服务端复杂度与心智负担 |
| 9.3 React 19 | Actions/use()/useOptimistic/ref as prop/Compiler，方向是"把异步与表单交给框架" |
| 9.4 工程化 | 构建、规范、测试、错误监控、微前端，重点在"可维护的约束" |

---

## 9.1 状态管理怎么选型？

### 核心原理

**第一步：分清两类"状态"**（这是最能体现判断力的一步）

| 类型 | 例子 | 归属 |
|---|---|---|
| **服务端状态** | 列表数据、详情、用户信息 | 有缓存、有失效、要重新拉取 → **TanStack Query / SWR / RTK Query** |
| **客户端状态** | 弹窗开关、主题、表单草稿、选中项 | 本地 `useState` → Context → 状态库 |

> 大多数"我需要 Redux"的诉求，其实是"我需要一个服务端状态缓存"。这一句说出来，面试官会认为你真的做过项目。

**第二步：客户端状态按规模选**

| 方案 | 适用 | 代价 |
|---|---|---|
| `useState` / `useReducer` | 组件内、单页面 | 跨组件共享困难 |
| **Context + useReducer** | 主题、locale、用户、低频全局值 | value 变化全量重渲染，无选择器 |
| **Zustand** | 中小项目、需要选择器、想少写样板 | 生态比 Redux 小（但够用） |
| **Jotai / Recoil** | 原子化、细粒度依赖、派生状态多 | 心智模型不同，调试稍复杂 |
| **Redux Toolkit** | 大团队、强约束、需 DevTools 时间旅行、复杂中间件 | 样板多、概念重 |
| **MobX** | 习惯 OOP/响应式、表单/图形编辑类 | 隐式依赖，团队需统一认知 |
| **Valtio** | 想要"可变写法 + 响应式" | 规模小，团队接受度 |

**Zustand 为什么这几年流行**（可以主动说）：无 Provider、选择器天然细粒度、不需要 action/reducer 样板、支持 `subscribe` 在组件外读写。

```js
const useStore = create((set) => ({
  count: 0,
  inc: () => set((s) => ({ count: s.count + 1 })),
}));
const count = useStore((s) => s.count);   // 只订阅 count，别的字段变了不重渲染
```

### 答题思路与要点顺序

1. **先分服务端/客户端状态**（10 秒，定调）。
2. **服务端**：TanStack Query / SWR，解决缓存、去重、失效、重试。
3. **客户端**：按规模给三档（useState → Context → Zustand/Redux）。
4. **给判据**：团队规模、是否需要强约束/可追溯、更新粒度、生态。
5. **收尾**：不要用"全局状态"解决"局部共享"。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| Context 为什么不够用？ | 无选择器（一变全变）、无中间件、无时间旅行；适合低频全局值 |
| Redux 过时了吗？ | 没有，但"手写 Redux 样板"过时了；RTK 仍是大型团队的主流选择 |
| Zustand 和 Redux 的本质差异？ | Redux 强调"单向数据流 + 纯 reducer + 可追溯"；Zustand 是"可订阅的外部 store"，更轻 |
| 状态该放 URL 吗？ | 筛选、分页、Tab 这类"要分享/刷新保留"的状态放 URL（`useSearchParams`），比全局状态更合适 |
| 多个状态库能混用吗？ | 能但别乱；常见组合：TanStack Query（服务端）+ Zustand（客户端） |

---

## 9.2 SSR、SSG、RSC 分别解决什么问题？

### 核心原理

**① 四种渲染模式**

| 模式 | HTML 何时生成 | 首屏 | 数据新鲜度 | 典型场景 |
|---|---|---|---|---|
| **CSR** | 浏览器里 JS 生成 | 慢（白屏） | 实时 | 后台系统、登录后页面 |
| **SSR** | 每次请求时服务端渲染 | 快（有内容） | 实时 | 商品详情、需要 SEO 的动态页 |
| **SSG** | 构建时生成 | 最快（可 CDN） | 构建时 | 博客、文档、营销页 |
| **ISR** | 构建 + 定时/按需再生成 | 最快 | 准实时 | 内容站、电商列表 |
| **RSC** | 服务端渲染"组件树的一部分" | 快 | 实时 | Next.js App Router |

**② SSR 的两个阶段与" hydration"**

```
服务端：renderToString / renderToPipeableStream → 得到 HTML 字符串
        ↓ 浏览器收到 HTML → 立刻可见（FCP 改善）
客户端：下载 JS → hydrate：把事件监听挂到已有 DOM 上，而不是重建
        ↓ 之后才是可交互（TTI/INP 改善取决于 JS 体积）
```

**hydration mismatch** 是最常见的 SSR bug：服务端与客户端首次渲染结果不一致（`Date.now()`、`Math.random()`、`window` 判断、浏览器扩展改 DOM）。React 18 会警告并尝试修补，`useId` 就是为了解决 `id` 不一致。

**③ RSC（React Server Components）的核心思想**

| | 传统 SSR | RSC |
|---|---|---|
| 组件在哪执行 | 服务端渲染一次 + 客户端 hydrate 全部 | 服务端组件**只在服务端执行**，不下发 JS |
| 传输内容 | HTML + 全部组件 JS | HTML/RSC Payload + 只有客户端组件的 JS |
| 能否用 hooks/状态 | 能 | 服务端组件**不能**用 `useState`/`useEffect` |
| 数据获取 | 客户端 effect 或用 `getServerSideProps` | 组件内直接 `await db.query()` |

一句话：**RSC 把"渲染"和"交互"拆开**——不需要交互的部分留在服务端，JS 体积大幅下降。

**④ 怎么选（面试官最爱问的判断）**

```
需要 SEO + 内容实时 → SSR（或 RSC）
内容稳定、可预生成 → SSG / ISR
登录后的管理后台 → CSR 就够（SSR 反而增加复杂度）
```

**代价必须说**：SSR 要维护 Node 服务/BFF、要处理缓存与降级、`window` 相关代码要隔离、第三方库可能不支持 SSR、调试链路变长。**不是所有项目都值得上 SSR。**

### 答题思路与要点顺序

1. **按"HTML 何时生成"区分**四种模式（CSR/SSR/SSG/ISR）。（20 秒）
2. **讲 SSR 两阶段**：服务端出 HTML → 客户端 hydrate。（20 秒）
3. **讲代价**：服务端复杂度、hydration mismatch、第三方库兼容。（20 秒）
4. **讲 RSC**：服务端组件不下发 JS，把"渲染"和"交互"拆开。（20 秒）
5. **给选型判据**：SEO/首屏需求 vs 复杂度成本。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| SSR 一定比 CSR 快吗？ | 首屏内容更快，但 TTI 取决于 JS 体积；hydration 期间页面"看得见点不动" |
| hydration mismatch 怎么排查？ | 检查首屏是否用了时间/随机/浏览器 API；用 `useId`；必要时 `suppressHydrationWarning` |
| SSR 里能用 `useLayoutEffect` 吗？ | 不能（有 warning），用 `useEffect` 或 isomorphic 写法 |
| RSC 能用 hooks 吗？ | 服务端组件不能；需要交互的部分写成客户端组件（`'use client'`） |
| Next.js 的 App Router 和 Pages Router 区别？ | App Router 默认 RSC、支持嵌套布局与流式渲染；Pages Router 是传统 SSR/SSG 模型 |
| 流式渲染解决什么？ | 让慢的部分后到，快的先展示，避免整体 TTFB 被最慢的请求拖住 |

---

## 9.3 React 19 有哪些值得关注的变化？

### 核心原理

按"对你的代码有什么影响"排序：

| 特性 | 说明 | 影响 |
|---|---|---|
| **Actions** | 表单 `action` 可以直接传 async 函数，自动管理 pending/error/乐观更新 | 表单与提交逻辑大幅简化 |
| **`useActionState`** | 管理 action 的返回值、错误、pending | 替代手写 loading/error 状态 |
| **`useOptimistic`** | 乐观更新：提交前先展示预期结果 | 聊天、点赞、待办体验提升 |
| **`use()`** | 读 Promise / Context，**可以条件调用** | 与 Suspense 配合取数更自然 |
| **`ref` 作为普通 prop** | 函数组件不再必须 `forwardRef` | 少一层包装 |
| **`useFormStatus`** | 子组件读父表单的提交状态 | 拆分提交按钮更方便 |
| **React Compiler** | 编译期自动插入 memo 化，减少手写 `useMemo/useCallback` | 性能优化负担下降，但需要构建接入 |
| **清理函数支持 async**（部分场景） | effect cleanup 可返回 Promise | 异步资源释放更自然 |
| **`<Context>` 直接作为 Provider** | `<Context value={...}>` 代替 `<Context.Provider>` | 写法简化 |
| **文档元数据** | 组件内直接写 `<title>`/`<meta>`，自动提升到 head | 不再需要 Helmet（框架支持下） |

**面试怎么答**：不要罗列全部，挑 3 个和你项目相关的说，并给出"为什么这个变化重要"。

推荐组合：**Actions + `useActionState`（表单）→ `use()`（取数）→ Compiler（性能）**。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| `use()` 为什么能条件调用？ | 它不是靠 hook 链表顺序存状态的"状态型 Hook"，实现上是读 thenable/context，因此不受调用顺序约束 |
| React Compiler 会取代 memo 吗？ | 大多数场景会；但对外暴露的库、需要精确控制的场景仍可能需要手写 |
| Actions 和 react-hook-form 冲突吗？ | 不冲突，前者是原生表单提交模型，后者是受控/非受控表单管理；可以组合 |
| 升级 19 有什么风险？ | 依赖库兼容（尤其依赖内部 API 的库）、`ref` 行为变化、StrictMode 更严格、Compiler 需要构建改造 |

---

## 9.4 React 工程化要关注什么？

### 核心原理（六个抓手）

| 抓手 | 关键点 |
|---|---|
| **构建** | Vite（开发快、ESM）为主；需要极致产物优化时看 Rspack/webpack；`React.lazy` + 手动 chunk 拆分 vendor |
| **规范** | ESLint（`eslint-plugin-react-hooks` 必开、`react/jsx-key`）、Prettier、TS `strict`、commitlint + husky |
| **测试** | React Testing Library（测行为不测实现）+ Vitest/Jest；MSW mock 接口；关键路径 E2E（Playwright） |
| **错误处理** | ErrorBoundary（路由级 + 组件级）+ `window.onerror` / `unhandledrejection` + Sentry sourcemap 上传 |
| **性能监控** | Web Vitals 上报（LCP/INP/CLS）、React Profiler 生产采样、慢接口埋点 |
| **架构约束** | 目录按"功能域"而非"文件类型"；组件分层（ui / features / pages）；微前端用 Module Federation 或 qiankun |

**几个高频追问的标准答案：**

- **ErrorBoundary 只能捕获什么？** 只能捕获**子树渲染期间**的错误（render、生命周期、constructor）。**捕获不到**：事件处理函数、异步回调（`setTimeout`/Promise）、SSR、自身抛出的错误。所以还需要全局 `onerror` 兜底。
- **为什么测试要用 RTL 而不是 Enzyme？** RTL 从用户视角查询（`getByRole`），不依赖组件内部实现，重构不破测试；Enzyme 依赖 `instance()`/`state()`，与实现强耦合，且不支持 React 18 并发。
- **微前端值不值得？** 组织问题（多团队独立发布）才值得；技术成本高（样式隔离、路由冲突、依赖共享、通信）。能用 monorepo 解决就别上微前端。

### 答题思路与要点顺序

1. **六抓手**：构建 / 规范 / 测试 / 错误 / 监控 / 架构。（20 秒）
2. **挑两个讲深**：ErrorBoundary 的边界 + RTL 的测试哲学。（30 秒）
3. **给判断**：微前端、SSR 这类"重方案"只在组织/业务真需要时上。（15 秒）

### 常见追问

| 追问 | 应答要点 |
|---|---|
| ErrorBoundary 捕获不到什么？ | 事件回调、异步代码、SSR、自身错误；需全局监听兜底 |
| 生产环境怎么定位 React 报错？ | sourcemap + Sentry，把压缩后的堆栈还原；组件 `displayName` 有助于定位 |
| 组件目录怎么组织？ | 按功能域（feature）切分，内部再分 ui/hooks/api；避免"components 目录塞 300 个文件" |
| 怎么保证 Hook 规范不被破坏？ | ESLint 插件 + CI 卡口 + Code Review checklist |
| 首屏性能怎么持续保障？ | 性能预算（bundle size 阈值）+ CI 中 Lighthouse 检查 + 线上 RUM |

---

## 本册自测

1. "我需要 Redux" 这个诉求，多数情况下真正的需求是什么？
2. SSR 的首屏更快，为什么 TTI 可能更差？
3. RSC 和 SSR 的本质区别是什么？
4. `use()` 为什么可以条件调用？
5. ErrorBoundary 捕获不到哪四类错误？
6. 什么时候才值得上微前端？

<details>
<summary>自测参考答案要点</summary>

1. 多半是"需要一个服务端状态缓存"（TanStack Query / SWR / RTK Query），而不是全局客户端状态。
2. 因为还要下载并执行 JS 完成 hydration，hydration 期间页面可见但不可交互。
3. SSR 是"服务端渲染一次 + 客户端 hydrate 全部组件"；RSC 是"部分组件只在服务端执行、不下发 JS"，把渲染与交互拆开。
4. 它不是靠 hook 链表顺序存状态的状态型 Hook，实现上是读 thenable/context，与调用顺序无关。
5. 事件处理函数、异步回调（setTimeout/Promise）、SSR 期间、ErrorBoundary 自身抛出的错误。
6. 组织层面确有多团队独立发布诉求时；纯技术复杂度用 monorepo 更划算。
</details>
