# React 07｜性能优化

> 覆盖原题：9、14、18、30、48、56、71、80（8 题 → **4 个考点**）
> 主线：先分层定位瓶颈，再收窄重渲染范围；`memo` / `useMemo` 有比较与缓存成本，只在存在比较方时使用

---

## 目录

- [本册速查](#本册速查)
- [7.1 React 应用有哪些性能优化手段？](#71-react-应用有哪些性能优化手段)
- [7.2 React.memo 有什么用？为什么有时不生效？](#72-reactmemo-有什么用为什么有时不生效)
- [7.3 shouldComponentUpdate 和 PureComponent 有什么用？](#73-shouldcomponentupdate-和-purecomponent-有什么用)
- [7.4 useMemo 和 useCallback 有什么区别？](#74-usememo-和-usecallback-有什么区别)
- [本册自测](#本册自测)

---

## 本册速查

| 考点 | 合并自 | 一句话答案 |
|---|---|---|
| 7.1 性能优化总览 | 9、56、80 | 五层：少渲染 → 少算 → 少下载 → 不阻塞交互 → 度量先行 |
| 7.2 React.memo | 30 | 浅比较 props，相同则跳过渲染；state/context 变化照样渲染 |
| 7.3 shouldComponentUpdate / PureComponent | 14 | 在 render 前剪枝；PureComponent 自动浅比较，要求不可变数据 |
| 7.4 useMemo / useCallback | 18、48、71 | 缓存值 vs 缓存函数引用；本质是"稳定引用"，不是"更快" |

---

## 7.1 React 应用有哪些性能优化手段？

> 原题：**9.**「useMemo/useCallback、React.memo、列表 key、懒加载、虚拟列表。」
> **56 / 80.**「同第 9 题。」
> 一句话结论：按「少渲染 → 少计算 → 少下载 → 不阻塞交互」四层收窄成本，再用度量确认收益；每层给手段 + 判据，而不是罗列名词。

### 五层漏斗

```
① 少渲染      —— 让组件不执行（memo / 状态下沉 / 拆分 / 稳定 props）
② 少计算      —— 让每次渲染更便宜（useMemo / 虚拟列表 / 避免 render 内重活）
③ 少下载      —— 让首屏更快（代码分割 / 路由懒加载 / tree-shaking / SSR）
④ 不阻塞交互  —— 让长任务让路（transition / deferredValue / 防抖 / Worker）
⑤ 度量        —— 先测再改（Profiler / why-did-you-render / Web Vitals）
```

### 少渲染

| 手段 | 说明 | 适用判据 |
|---|---|---|
| **状态下沉 / 拆分组件** | 把 state 移到真正使用它的子组件，缩窄重渲染范围 | 父组件状态变化导致大量无关子组件重渲染 |
| **`React.memo`** | props 浅比较，相同跳过 | 纯展示组件、props 稳定、渲染成本高 |
| **`useMemo` / `useCallback` 稳定 props** | 避免"每次渲染都传新对象/新函数"导致 memo 失效 | 引用需要跨渲染保持稳定 |
| **Context 拆分 + value memo** | 读写分离，减少消费者数量 | 全局状态导致大面积重渲染 |
| **`key` 正确** | 避免不必要的卸载重建 | 列表增删排序 |
| **状态下沉到 URL / 表单库** | 减少 React 管理的状态量 | 输入频繁、表单巨大 |

### 少计算

| 手段 | 说明 |
|---|---|
| **`useMemo` 缓存昂贵计算** | 排序、过滤、大数组 map、正则匹配 |
| **虚拟列表**（react-window / TanStack Virtual） | 只渲染可视区 + 缓冲区，DOM 数量只与可视区行数相关 |
| **避免在 render 里做重活** | 在 render 里 `new Date()`、深拷贝、`JSON.parse`、创建大对象 |
| **减少 DOM 节点数 / 嵌套深度** | 布局与样式计算成本与节点数相关 |
| **`content-visibility: auto`** | CSS 层面的"跳过屏幕外渲染" |
| **Web Worker** | 把大计算移出主线程（搜索索引、图片处理、加密） |

**虚拟列表原理**（高频追问）：容器固定高度 + `total * itemHeight` 撑开滚动条 + 只渲染 `[start, end]` 区间 + 用 `transform: translateY` 或 padding 占位。核心是"滚动位置 → 可见区间"的映射，滚动时按 `scrollTop` 重算。

### 少下载

| 手段 | 说明 |
|---|---|
| **路由级代码分割** | `React.lazy` + `Suspense`，见 [08 册](/doc/react-router-code-splitting) |
| **组件级分割** | 弹窗、富文本、图表库按需加载 |
| **Tree-shaking** | ESM + `sideEffects: false`；按需引入（`lodash/es`、`import { x } from 'antd'`） |
| **SSR / SSG / RSC** | 减少首屏 JS 与白屏时间（见 [09 册](/doc/react-ecosystem-engineering)） |
| **图片/字体优化** | 响应式图片、`loading="lazy"`、字体子集化、`font-display: swap` |
| **预加载** | `prefetch` / `preload` / 路由 hover 预取 |

### 不阻塞交互

| 手段 | 说明 |
|---|---|
| **`useTransition` / `startTransition`** | 把"过滤大列表"这类更新降级，输入保持流畅 |
| **`useDeferredValue`** | 让某个值延迟跟随（无法包 setState 时） |
| **防抖 / 节流** | 搜索输入、resize、scroll |
| **`requestIdleCallback` / 分片** | 非紧急任务切片执行 |
| **骨架屏 / 乐观更新** | 改善"感知性能"（往往比真实性能更有效） |

### 度量

| 工具 | 看什么 |
|---|---|
| **React DevTools Profiler** | 哪次 commit 慢、哪个组件渲染次数多、"Why did this render?" |
| **`why-did-you-render`** | 找出"props 没变却重渲染"的组件 |
| **Chrome Performance** | 长任务、强制同步布局（layout thrashing）、主线程阻塞 |
| **Lighthouse / Web Vitals** | LCP、INP、CLS；INP 是交互响应性的核心指标 |
| **`performance.mark/measure`** | 自定义埋点，定位具体环节 |

判断一项优化是否保留，依据是 Profiler 的 commit 耗时与组件渲染次数，以及 Web Vitals 的前后对比。优化项本身有比较与缓存成本，没有度量数据无法判断净收益。

### 答题要点

- 结构：四层收窄 + 度量，每层 2 个手段 + 一句判据。
- 少渲染优先：状态下沉/拆分组件 → memo + 稳定 props → 正确 key。
- 万级列表：虚拟列表（可视区 + 缓冲区 + 占位偏移）+ 行组件 memo。
- 首屏：路由级 `React.lazy` + `Suspense`、按需引入、SSR/SSG。
- 交互：`useTransition` / `useDeferredValue` 降级更新，重计算放 Worker；用 Profiler / Web Vitals 验收。

### 追问

| 追问 | 应答要点 |
|---|---|
| 万级列表怎么优化？ | 虚拟列表（只渲染可视区 + 缓冲区、transform 位移）+ 行组件 memo + 避免行内联函数；再不行用 Web Worker 预计算 |
| 性能优化怎么验证有效？ | Profiler 对比 commit 耗时与渲染次数、Lighthouse/Web Vitals 对比 INP/LCP、生产环境 RUM 埋点 |
| 首屏白屏怎么优化？ | 代码分割 + 预加载关键路由、SSR/SSG、骨架屏、减少首屏 JS（按需引入大库）、`defer` 脚本 |
| 什么是 INP？为什么比 FID 重要？ | Interaction to Next Paint，衡量所有交互的响应延迟（而非仅首次输入）；FID 已从核心指标中移除 |

---

## 7.2 React.memo 有什么用？为什么有时不生效？

> 原题：**30.**「高阶组件，props 不变跳过重渲染（浅比较）。」
> 一句话结论：`React.memo` 对 props 做逐 key 的 `Object.is` 比较，相同则复用上次渲染结果，它只管 props。

### memo 的比较规则

```js
const MemoComp = React.memo(Comp, areEqual?);
```

- **浅比较 props**：遍历 key 逐个用 `Object.is` 比较；对象/数组/函数只比引用，不是深比较。
- props 相同 → **跳过本次渲染**，复用上一次的结果，其子树也随之不渲染。
- props 不同或未传 → 正常渲染。

### 生效范围：只管 props

| 变化来源 | 是否重渲染 | 原因 |
|---|---|---|
| 自身 `useState` / `useReducer` 更新 | ✅ 会 | memo 不参与，只比较 props |
| 消费的 Context 变化 | ✅ 会 | Context 更新直接通知消费者，不经 memo |
| 父组件传了新引用（对象/数组/内联函数/`{...props}`） | ✅ 会 | 浅比较失败，等价于 props 变了 |
| 父组件重渲染但 props 值未变 | ❌ 不会 | 浅比较相等，bail out |

所以 memo 能挡住的只有最后一行：父组件重渲染而 props 未变。

### memo 失效的排查顺序

```jsx
// 父组件每次渲染都新建这些 → memo 白加
<MemoChild
  style={{ color: 'red' }}        // ❌ 新对象
  onClick={() => doSomething()}    // ❌ 新函数
  list={data.filter(...)}          // ❌ 新数组
  {...rest}                        // ⚠️ 展开也可能产生新引用
/>
```

修法：

```jsx
const style = useMemo(() => ({ color: 'red' }), []);
const onClick = useCallback(() => doSomething(), []);
const list = useMemo(() => data.filter(...), [data]);
```

这组修法只做一件事：让 props 的引用在依赖不变时保持不变。什么时候值得付这份成本，见 7.4。

### areEqual 自定义比较

```jsx
React.memo(Comp, (prev, next) => prev.id === next.id);
```

返回 `true` 表示"相等、跳过渲染"。若比较逻辑漏掉某个 prop，该 prop 变化时 UI 不会更新，而且不会报错，排查成本很高；默认浅比较在 props 结构稳定的组件上已经够用。

### 不该用 memo 的场景

| 情况 | 原因 |
|---|---|
| 组件渲染成本很低（一个 `<span>`） | 比较 props 的成本 > 渲染成本 |
| props 必然每次都变 | 比较纯属浪费 |
| 组件很少重渲染 | 没有收益 |
| 用 React Compiler 的项目 | 编译器会自动插入等价的记忆化，手写 memo 可能冗余 |

### memo 与 forwardRef

`memo` / `useMemo` / `useCallback` / `PureComponent` / `SCU` 的完整分工见 [四者对照](#四者对照)。两者组合时 `memo` 放在外层：

```jsx
const Comp = React.memo(React.forwardRef((props, ref) => ...));  // ✅ memo 在外层
```

### memo 答题要点

- 定义：HOC，浅比较 props，相同则跳过渲染（bail out）。
- 边界：只管 props；自身 state、Context 变化照样渲染。
- 失效：父组件传新对象/新函数/展开 props，用 `useMemo`/`useCallback` 稳定引用。
- 适用：渲染成本高、props 稳定、父组件频繁重渲染。
- 慎用：渲染很便宜、props 恒变、React Compiler 已自动记忆化。

### memo 追问

| 追问 | 应答要点 |
|---|---|
| memo 和 useMemo 区别？ | memo 控制"组件要不要渲染"；useMemo 缓存"一个值" |
| memo 和 PureComponent 区别？ | 函数组件 vs class 组件；PureComponent 还比较 state |
| 自定义 `areEqual` 有什么风险？ | 返回 true 表示"相等"容易写反；漏比较字段 → UI 不更新 |
| 用了 React Compiler 还需要 memo 吗？ | 大多数情况不需要；迁移期可保留 |

---

## 7.3 shouldComponentUpdate 和 PureComponent 有什么用？

> 原题：**14.**「class 组件性能优化，返回 false 跳过渲染。PureComponent 自动浅比较。」
> 一句话结论：SCU 是 render 前的一道闸门，返回 false 时 render 与其后的生命周期都不执行；PureComponent 内置了 props + state 的浅比较。

### SCU 的作用范围

```jsx
shouldComponentUpdate(nextProps, nextState) {
  return nextProps.id !== this.props.id;   // false → 跳过 render 及之后
}
```

| 会执行 | 不会执行 |
|---|---|
| `shouldComponentUpdate` 本身 | `render` |
| state 更新到实例 | `getSnapshotBeforeUpdate` / `componentDidUpdate` |
| — | DOM 更新 |

state 已经更新到实例上，只是没有渲染，因此 UI 与 state 可能不一致。

### PureComponent 的浅比较

```jsx
class Foo extends React.PureComponent { ... }
```

它内置了浅比较的 `shouldComponentUpdate`：对 `props` 和 `state` 的每个 key 做 `Object.is` 比较，全相等就跳过渲染。

### 原地修改的坑

```jsx
// ❌ PureComponent 认为"没变"，不更新
this.state.list.push(item);
this.setState({ list: this.state.list });

// ✅ 新引用
this.setState({ list: [...this.state.list, item] });
```

浅比较只看引用，嵌套对象变了但引用没变就会漏更新；父组件传下来的对象被原地修改时同理。这就是 class 组件必须坚持不可变更新（返回新引用）的原因。

### SCU 与 diff 的分工

```
SCU  → render 之前剪枝：不执行 render，也不遍历子树
diff → render 之后比较：element 树已生成，只决定是否操作 DOM
```

SCU 省的是"执行组件函数 + 遍历子树"的成本，diff 省的是 DOM 操作。

### 四者对照

| API | 组件类型 | 比较对象 | 粒度 |
|---|---|---|---|
| `shouldComponentUpdate` | class | 自定义 | 手写 |
| `PureComponent` | class | props + state（浅比较） | 自动 |
| `React.memo` | 函数 | props（浅比较） | 自动 |
| `useMemo` | 函数 | 依赖数组 | 值级 |
| `useCallback` | 函数 | 依赖数组 | 函数引用 |

### class 组件答题要点

- SCU：render 前的闸门，返回 false 跳过 render 与 didUpdate。
- PureComponent：内置浅比较 SCU，比较 props + state。
- 最大的坑：原地修改导致"比较相等 → 不更新"，必须返回新引用。
- SCU vs diff：SCU 在 render 前剪枝（省组件执行），diff 在 render 后（省 DOM 操作）。
- 函数组件对应物：`React.memo`（只比 props，不比 state）。

### class 组件追问

| 追问 | 应答要点 |
|---|---|
| SCU 返回 false 后 state 变了吗？ | 变了（在实例上），只是没触发渲染，UI 与 state 会不一致 |
| 为什么不推荐手写 SCU？ | 容易漏字段导致 bug；维护成本高；收益通常不如"把组件拆小 + memo" |
| `memo` 和 `PureComponent` 能混用吗？ | 可以，但分别作用于函数/类组件，不要叠在同一组件上 |
| 深层嵌套数据怎么优化？ | 不可变更新（展开/Immer）+ 拆分组件，让变化粒度变细；或把比较下沉到叶子组件 |

---

## 7.4 useMemo 和 useCallback 有什么区别？

> 原题：**18.**「useMemo：缓存值；useCallback：缓存函数引用。」
> **48 / 71.**「同第 18 题。」
> 一句话结论：`useCallback(fn, deps)` 等价于 `useMemo(() => fn, deps)`；两者的价值是"依赖不变时复用结果或引用"，不是让函数执行更快。

### 定义与等价关系

```js
const memoizedValue = useMemo(() => compute(a, b), [a, b]);
const memoizedFn    = useCallback((x) => doSomething(x, a), [a]);
```

```js
useCallback(fn, deps)  ===  useMemo(() => fn, deps)
```

`useCallback` 只是缓存函数这一特例的写法；两者都在依赖变化时重新计算。

### 用途与配合对象

| 用途 | 说明 | 需要配合 |
|---|---|---|
| **稳定引用，避免 memo 子组件重渲染** | 父组件把 `onClick` 传给 `memo` 子组件 | `React.memo` |
| **避免 effect 反复执行** | effect 依赖某个函数，函数引用不稳 → effect 每次都跑 | `useEffect` |
| **缓存昂贵计算** | 排序/过滤/大数组转换 | 只 `useMemo` |
| **稳定 Context value** | `<Ctx.Provider value={...}>` | 只 `useMemo` |

### 不需要用的场景

```jsx
// ❌ 无意义的 useCallback：没有 memo 子组件，也没有依赖它的 effect
const onClick = useCallback(() => setCount(c => c + 1), []);

// ❌ 无意义的 useMemo：计算只有一行加法
const total = useMemo(() => a + b, [a, b]);
```

判断标准：

> **"这个引用（或结果）会被别人拿去做比较吗？"**
> 会（传给 `memo` 组件、作为 effect 依赖、作为 Context value）→ 值得缓存。
> 不会 → 缓存只增加依赖比较与内存开销。

### useMemo 不是语义保证

React 官方文档的原文：

> You may rely on useMemo as a performance optimization, **not as a semantic guarantee**.

官方文档同时说明，React 未来可能"忘记"部分已记忆的值并在下次渲染时重算（例如为屏幕外组件释放内存）。因此：

- ✅ 可以用来省计算；
- ❌ 不能保证"只执行一次"：初始化用 `useState(() => compute())`；用 `useRef` 需判空后赋值，否则初始值表达式每次渲染都会执行；
- ❌ 不能用来做副作用（请求、订阅放 `useEffect`）。

### 依赖数组的坑（同 [03 册 3.2](/doc/react-lifecycle-useeffect)）

```jsx
useMemo(() => compute(obj), [obj]);        // ❌ obj 每次新引用
useMemo(() => compute(obj.id), [obj.id]);  // ✅ 依赖原始值
useCallback(() => save(id), [id]);         // ✅ 只依赖真正用到的值
```

依赖里放引用类型时，父组件每次新建引用都会让缓存失效；依赖原始值最稳定。

### Hook 答题要点

- 一句话：`useMemo` 缓存值，`useCallback` 缓存函数，后者是前者的特例。
- 等价关系：`useCallback(fn, deps) ≡ useMemo(() => fn, deps)`。
- 两类用途：省计算；稳引用（配合 memo 子组件、effect 依赖、Context value）。
- 不该用：没有比较方时，缓存只增加开销。
- 语义：不保证缓存，不能当"只执行一次"或副作用入口。

### Hook 追问

| 追问 | 应答要点 |
|---|---|
| useMemo 能替代 shouldComponentUpdate 吗？ | 不能。它缓存值，不控制渲染；控制渲染用 `memo` |
| 依赖里放函数会怎样？ | 父组件内联函数每次新引用 → 缓存失效。要么 `useCallback` 稳定，要么把函数体搬进内部 |
| `useMemo` 和 `useState` 惰性初始化怎么选？ | 只算一次并存住 → `useState(() => compute())` 或 `useRef` 判空；跟着依赖变 → `useMemo` |
| 接口返回值适合用 `useMemo` 缓存吗？ | 不适合。它只缓存渲染期计算，请求缓存用 TanStack Query / SWR |

---

## 本册自测

1. 用"五层"结构说出至少 8 个性能优化手段。
2. 加了 `React.memo` 组件还是重渲染，列出四种可能原因。
3. `PureComponent` 最典型的失效场景是什么？
4. SCU 返回 false 时，哪些钩子不执行？state 变了吗？
5. `useCallback(fn, deps)` 和 `useMemo` 的等价写法是什么？
6. 为什么 `useMemo` 不能用来做"只执行一次"的初始化？
7. 虚拟列表的核心原理是什么？

<details>
<summary>自测参考答案要点</summary>

1. 少渲染（状态下沉、memo、稳定 props、Context 拆分、key）、少计算（useMemo、虚拟列表、避免 render 重活、Web Worker）、少下载（路由分割、按需引入、tree-shaking、SSR/SSG）、不阻塞交互（transition、deferredValue、防抖、骨架屏）、度量（Profiler、why-did-you-render、Web Vitals）。
2. props 引用变了（对象/函数/展开）；消费的 Context 变了；自身 state 变了；父组件在 render 内定义子组件（组件类型每次都是新的，导致卸载重建）。
3. 原地修改 state/props（`push`、`obj.a = 1`），浅比较认为引用未变 → 不更新。
4. `render`、`getSnapshotBeforeUpdate`、`componentDidUpdate` 不执行；state 已经在实例上更新。
5. `useMemo(() => fn, deps)`。
6. 它不保证缓存（React 可丢弃重算），可能执行多次；"只执行一次"用 `useState(() => compute())`，`useRef` 需判空后赋值。
7. 容器固定高度 + 用总高度撑开滚动条 + 只渲染可见区间（含缓冲区）+ 用 `transform`/padding 占位，滚动时按 `scrollTop` 重算区间。
</details>
