# React 07｜性能优化

> 覆盖原题：9、14、18、30、48、56、71、80（8 题 → **4 个考点**）
> 「React 性能优化」是被转发最多的三个考点之一（9/56/80 同题）。原答案是一串名词，**这题真正的分在"分层"和"先度量再优化"**。

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
| 7.2 React.memo | 30 | 浅比较 props，相同则跳过子树渲染；state/context 变化照样渲染 |
| 7.3 shouldComponentUpdate / PureComponent | 14 | 在 render 前剪枝；PureComponent 自动浅比较，要求不可变数据 |
| 7.4 useMemo / useCallback | 18、48、71 | 缓存值 vs 缓存函数引用；本质是"稳定引用"，不是"更快" |

---

## 7.1 React 应用有哪些性能优化手段？

> 原题：**9.**「useMemo/useCallback、React.memo、列表 key、懒加载、虚拟列表。」
> **56 / 80.**「同第 9 题。」

原答案是一份"工具清单"。面试官听完会想：「你知道这些钩子，但你知道**什么时候不该用**吗？」所以这题的正确结构是**分层 + 判据**。

### 核心原理：五层漏斗

```
① 少渲染      —— 让组件不执行（memo / 状态下沉 / 拆分 / 稳定 props）
② 少计算      —— 让每次渲染更便宜（useMemo / 虚拟列表 / 避免 render 内重活）
③ 少下载      —— 让首屏更快（代码分割 / 路由懒加载 / tree-shaking / SSR）
④ 不阻塞交互  —— 让长任务让路（transition / deferredValue / 防抖 / Worker）
⑤ 度量        —— 先测再改（Profiler / why-did-you-render / Web Vitals）
```

**每层给 2–3 个手段 + 一句判据**，比报十个名词强得多。

### ① 少渲染（收益最大，优先级最高）

| 手段 | 说明 | 适用判据 |
|---|---|---|
| **状态下沉 / 拆分组件** | 把 state 移到真正使用它的子组件，缩窄重渲染范围 | 父组件状态变化导致大量无关子组件重渲染 |
| **`React.memo`** | props 浅比较，相同跳过 | 纯展示组件、props 稳定、渲染成本高 |
| **`useMemo` / `useCallback` 稳定 props** | 避免"每次渲染都传新对象/新函数"导致 memo 失效 | 配合 memo 使用才有意义 |
| **Context 拆分 + value memo** | 读写分离，减少消费者数量 | 全局状态导致大面积重渲染 |
| **`key` 正确** | 避免不必要的卸载重建 | 列表增删排序 |
| **状态下沉到 URL / 表单库** | 减少 React 管理的状态量 | 输入频繁、表单巨大 |

### ② 少计算

| 手段 | 说明 |
|---|---|
| **`useMemo` 缓存昂贵计算** | 排序、过滤、大数组 map、正则匹配 |
| **虚拟列表**（react-window / TanStack Virtual） | 只渲染可视区 + 缓冲区，DOM 数量从 1 万降到几十 |
| **避免在 render 里做重活** | 在 render 里 `new Date()`、深拷贝、`JSON.parse`、创建大对象 |
| **减少 DOM 节点数 / 嵌套深度** | 布局与样式计算成本与节点数相关 |
| **`content-visibility: auto`** | CSS 层面的"跳过屏幕外渲染" |
| **Web Worker** | 把大计算移出主线程（搜索索引、图片处理、加密） |

**虚拟列表原理**（高频追问）：容器固定高度 + `total * itemHeight` 撑开滚动条 + 只渲染 `[start, end]` 区间 + 用 `transform: translateY` 或 padding 占位。核心是"滚动位置 → 可见区间"的映射。

### ③ 少下载（首屏）

| 手段 | 说明 |
|---|---|
| **路由级代码分割** | `React.lazy` + `Suspense`，见 [08 册](/doc/react-router-code-splitting) |
| **组件级分割** | 弹窗、富文本、图表库按需加载 |
| **Tree-shaking** | ESM + `sideEffects: false`；按需引入（`lodash/es`、`import { x } from 'antd'`） |
| **SSR / SSG / RSC** | 减少首屏 JS 与白屏时间（见 [09 册](/doc/react-ecosystem-engineering)） |
| **图片/字体优化** | 响应式图片、`loading="lazy"`、字体子集化、`font-display: swap` |
| **预加载** | `prefetch` / `preload` / 路由 hover 预取 |

### ④ 不阻塞交互

| 手段 | 说明 |
|---|---|
| **`useTransition` / `startTransition`** | 把"过滤大列表"这类更新降级，输入保持流畅 |
| **`useDeferredValue`** | 让某个值延迟跟随（无法包 setState 时） |
| **防抖 / 节流** | 搜索输入、resize、scroll |
| **`requestIdleCallback` / 分片** | 非紧急任务切片执行 |
| **骨架屏 / 乐观更新** | 改善"感知性能"（往往比真实性能更有效） |

### ⑤ 度量（这一段最加分）

| 工具 | 看什么 |
|---|---|
| **React DevTools Profiler** | 哪次 commit 慢、哪个组件渲染次数多、"Why did this render?" |
| **`why-did-you-render`** | 找出"props 没变却重渲染"的组件 |
| **Chrome Performance** | 长任务、强制同步布局（layout thrashing）、主线程阻塞 |
| **Lighthouse / Web Vitals** | LCP、INP、CLS；INP 是交互响应性的核心指标 |
| **`performance.mark/measure`** | 自定义埋点，定位具体环节 |

> **一句必须说的话**：不要凭感觉加 `memo` / `useMemo`。它们本身有成本（比较、缓存、内存），滥用会让代码更难维护、性能更差。**先测，找到瓶颈，再针对性优化。**

### 答题思路与要点顺序

1. **先给结构**：五层漏斗（少渲染 / 少计算 / 少下载 / 不阻塞交互 / 度量）。（15 秒，**结构感 > 名词量**）
2. **每层 2 个具体手段**，挑最常用的说。（40 秒）
3. **重点讲一层**：选"少渲染"，讲"状态下沉 + memo + 稳定 props"的组合拳。（25 秒）
4. **讲虚拟列表**：如果面试官问"万级列表怎么优化"，这是标准答案。（20 秒）
5. **收尾**：先度量再优化，别盲目 memo。（15 秒，**这句最能体现工程素养**）

### 口述参考

> 我会分五层来看。
>
> 第一层是少渲染，收益最大。核心手段是把状态下沉到真正用它的组件、拆分组件缩窄重渲染范围，配合 React.memo 和 useMemo、useCallback 稳定 props。注意 memo 只有在 props 稳定时才有效，父组件每次传新对象或内联函数，memo 就白加了。
>
> 第二层是少计算。昂贵计算用 useMemo 缓存；长列表用虚拟列表，只渲染可视区加缓冲区；还有别在 render 里做重活，比如深拷贝、JSON.parse、创建大对象。
>
> 第三层是少下载，主要是首屏：路由级代码分割加 lazy、Suspense，组件库按需引入，确保 tree-shaking 生效，再配合 SSR 或 SSG 减少白屏。
>
> 第四层是不阻塞交互。输入过滤大列表用 useTransition 把更新降级，或者 useDeferredValue；搜索做防抖；大计算放 Web Worker。
>
> 第五层也是我觉得最重要的一层：先度量。用 DevTools Profiler 看是哪次 commit 慢、哪个组件渲染次数多，用 why-did-you-render 找 props 没变却重渲染的组件，用 Performance 面板看长任务。memo 和 useMemo 本身是有成本的，盲目加反而更慢、更难维护。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 万级列表怎么优化？ | 虚拟列表（只渲染可视区 + 缓冲区、transform 位移）+ 稳定 key + memo 行组件 + 避免行内联函数；再不行用 Web Worker 预计算 |
| 加了 memo 还是重渲染，为什么？ | ① props 是新对象/新函数 ② context 变化（memo 挡不住）③ 自身 state 变化 ④ 父组件用 `{...props}` 展开导致引用变 |
| 为什么说不要滥用 useMemo？ | 缓存本身有开销（依赖比较、内存），且 React 可能丢弃缓存；简单计算用 memo 反而更慢 |
| 性能优化怎么验证有效？ | Profiler 对比 commit 耗时与渲染次数、Lighthouse/Web Vitals 对比 INP/LCP、生产环境 RUM 埋点 |
| 首屏白屏怎么优化？ | 代码分割 + 预加载关键路由、SSR/SSG、骨架屏、减少首屏 JS（按需引入大库）、`defer` 脚本 |
| 什么是 INP？为什么比 FID 重要？ | Interaction to Next Paint，衡量所有交互的响应延迟（而非仅首次输入），更贴近真实体验 |

### 加分点与易错点

- ✅ **加分**：用"漏斗/分层"组织答案；强调"先度量再优化"；提到 INP、`content-visibility`、Web Worker 这些超出 React 范畴的手段。
- ⚠️ **易错**：把优化等同于"背 hooks 名字"，没有一个判据。
- ⚠️ **易错**：说"memo 一定能提升性能"——比较成本可能超过收益，且 props 不稳定时完全无效。

---

## 7.2 React.memo 有什么用？为什么有时不生效？

> 原题：**30.**「高阶组件，props 不变跳过重渲染（浅比较）。」

### 核心原理

```js
const MemoComp = React.memo(Comp, areEqual?);
```

- **浅比较 props**：逐 key 用 `Object.is` 比较（不是深比较）。
- 相同 → **跳过该组件及其子树的重新渲染**，复用上一次的结果（bail out）。
- 只对 **props** 生效。

**① 三个"挡不住"**

| 情况 | 是否会重渲染 | 原因 |
|---|---|---|
| 自身 `useState` / `useReducer` 更新 | ✅ 会 | memo 只管 props |
| 消费的 Context 变化 | ✅ 会 | Context 更新直接标记消费者，绕过 memo |
| 父组件传了新引用（对象/数组/内联函数/`{...props}`） | ✅ 会 | 浅比较失败 |

**② 为什么不生效（实战排查顺序）**

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

**③ `areEqual` 自定义比较**

```jsx
React.memo(Comp, (prev, next) => prev.id === next.id);
```

⚠️ 慎用：返回 `true` 表示"相等、跳过渲染"，如果比较逻辑漏了某个 prop，会出现 **UI 不更新**的诡异 bug。默认浅比较在 99% 场景够用。

**④ 什么时候不该用 memo**

| 情况 | 原因 |
|---|---|
| 组件渲染成本很低（一个 `<span>`） | 比较 props 的成本 > 渲染成本 |
| props 必然每次都变 | 比较纯属浪费 |
| 组件很少重渲染 | 没有收益 |
| 用 React Compiler 的项目 | 编译器会自动做等价优化，手写 memo 可能冗余 |

**⑤ 与其他 API 的关系**

```
React.memo      → 组件级：props 相同则跳过
useMemo         → 值级：缓存计算结果
useCallback     → 函数级：缓存函数引用（= useMemo 返回函数）
PureComponent   → class 版 memo（浅比较 props + state）
shouldComponentUpdate → 手写比较逻辑（class 版自定义）
```

注意 `memo` 与 `forwardRef` 的组合顺序：

```jsx
const Comp = React.memo(React.forwardRef((props, ref) => ...));  // ✅ memo 在外层
```

### 答题思路与要点顺序

1. **定义**：HOC，浅比较 props，相同则跳过渲染（bail out）。（10 秒）
2. **只管 props**：自身 state、Context 变化照样渲染。（15 秒，**这是第一个追问**）
3. **为什么不生效**：新对象/新函数/展开 props；给出 `useMemo`/`useCallback` 的修法。（30 秒，**核心分**）
4. **什么时候不该用**：渲染便宜、props 常变、有 Compiler。（20 秒，体现判断力）
5. **对比**：memo / PureComponent / SCU / useMemo 的区别。

### 口述参考

> React.memo 是一个高阶组件，它浅比较 props，如果 props 没变就跳过这个组件以及它子树的重新渲染，直接复用上一次的结果。
>
> 但它只管 props。组件自己的 state 变了、或者它消费的 Context 变了，还是会重渲染，因为 Context 更新是绕过 memo 的。
>
> 实际项目里 memo 不生效，九成是 props 引用不稳定。父组件每次渲染都写 style={{...}}、onClick={() => ...}、list={data.filter(...)}，每次都是新引用，浅比较必然失败。解法是用 useMemo 缓存对象和数组、useCallback 缓存函数；另外用展开 {...rest} 也可能引入不稳定引用，要检查。
>
> 反过来也要注意别滥用。如果组件渲染本身很便宜，比较 props 的成本可能超过渲染成本；props 每次都变的话比较也是纯浪费。所以我会先用 Profiler 确认这个组件确实是热点，再加 memo。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 浅比较是怎么比的？ | 遍历 props 的 key，用 `Object.is` 比较每个值；引用类型只比引用 |
| memo 和 useMemo 区别？ | memo 控制"组件要不要渲染"；useMemo 缓存"一个值" |
| memo 和 PureComponent 区别？ | 函数组件 vs class 组件；PureComponent 还比较 state |
| memo 能阻止 context 更新吗？ | 不能 |
| 自定义 `areEqual` 有什么风险？ | 漏比较某个 prop → UI 不更新且极难排查；返回 true 表示"相等"容易写反 |
| 用了 React Compiler 还需要 memo 吗？ | 大多数情况不需要，编译器会自动插入等价优化；迁移期可保留 |

### 加分点与易错点

- ✅ **加分**：给出"排查 memo 失效"的顺序；说出 `areEqual` 返回值的语义容易写反。
- ⚠️ **易错**：说"memo 是深比较"。
- ⚠️ **易错**：以为 memo 能优化"组件内部的复杂计算"——那要用 useMemo。

---

## 7.3 shouldComponentUpdate 和 PureComponent 有什么用？

> 原题：**14.**「class 组件性能优化，返回 false 跳过渲染。PureComponent 自动浅比较。」

### 核心原理

**① `shouldComponentUpdate(nextProps, nextState)`**

```jsx
shouldComponentUpdate(nextProps, nextState) {
  return nextProps.id !== this.props.id;   // false → 跳过 render 及之后
}
```

返回 `false` 的效果：

| 会执行 | 不会执行 |
|---|---|
| `shouldComponentUpdate` 本身 | `render` |
| state 已在实例上更新 | `getSnapshotBeforeUpdate` / `componentDidUpdate` |
| — | DOM 更新 |

**② `PureComponent`**

```jsx
class Foo extends React.PureComponent { ... }
```

它内置了一个浅比较的 `shouldComponentUpdate`：比较 `props` 和 `state` 的**每个 key（`Object.is`）**，全相等就跳过。

**③ 最大的坑：原地修改**

```jsx
// ❌ PureComponent 认为"没变"，不更新
this.state.list.push(item);
this.setState({ list: this.state.list });

// ✅ 新引用
this.setState({ list: [...this.state.list, item] });
```

同理，父组件传下来的对象如果被原地改，子组件的 PureComponent 也不会更新。**这就是"不可变数据"在 class 时代这么重要的原因。**

**④ SCU 与 diff 的分工**

```
SCU  → render 之前剪枝：根本不执行 render（省掉组件函数执行 + 子树遍历）
diff → render 之后比较：已经生成了新 element 树，只是不落 DOM
```

所以 `SCU` 的收益**大于**"diff 变快"，它省的是"执行组件"的成本。

**⑤ 四者对照**

| API | 组件类型 | 比较对象 | 粒度 |
|---|---|---|---|
| `shouldComponentUpdate` | class | 自定义 | 手写 |
| `PureComponent` | class | props + state（浅比较） | 自动 |
| `React.memo` | 函数 | props（浅比较） | 自动 |
| `useMemo` | 函数 | 依赖数组 | 值级 |

### 答题思路与要点顺序

1. **SCU**：render 前的闸门，返回 false 跳过 render 与 didUpdate。（20 秒）
2. **PureComponent**：内置浅比较 SCU，比较 props + state。（15 秒）
3. **最大的坑**：原地修改导致"比较相等 → 不更新"，必须不可变。（25 秒，**核心分**）
4. **SCU vs diff**：SCU 在 render 前剪枝（省组件执行），diff 在 render 后（省 DOM 操作）。（20 秒，深度分）
5. **函数组件对应物**：`React.memo`。（10 秒）

### 口述参考

> shouldComponentUpdate 是 render 之前的一道闸门，它拿到 nextProps 和 nextState，返回 false 就跳过 render，也不会执行 getSnapshotBeforeUpdate 和 componentDidUpdate，DOM 自然不更新。要注意 state 其实已经更新到实例上了，只是没渲染。
>
> PureComponent 相当于内置了一个浅比较的 shouldComponentUpdate，会自动比较 props 和 state 的每个 key。
>
> 它最大的坑是原地修改。如果你 this.state.list.push 之后 setState 同一个数组，浅比较认为引用没变，就不会更新，页面看起来"卡住了"。所以 class 时代必须坚持不可变更新，返回新数组、新对象。
>
> 还有一个容易混的点：SCU 和 diff 的位置不同。SCU 在 render 之前剪枝，省掉的是"执行组件函数 + 遍历子树"的成本；diff 在 render 之后，省的是 DOM 操作。所以 SCU 的价值其实比"让 diff 更快"更大。
>
> 函数组件里对应的就是 React.memo。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| SCU 返回 false 后 state 变了吗？ | 变了（在实例上），只是没触发渲染，UI 与 state 会不一致——慎用 |
| PureComponent 是深比较吗？ | 不是，浅比较（每个 key 用 `Object.is`），嵌套对象变了但引用没变会漏更新 |
| 为什么不推荐手写 SCU？ | 容易漏字段导致 bug；维护成本高；收益通常不如"把组件拆小 + memo" |
| `memo` 和 `PureComponent` 能混用吗？ | 可以，但分别作用于函数/类组件，不要叠在同一组件上 |
| 深层嵌套数据怎么优化？ | 不可变更新（展开/Immer）+ 拆分组件，让变化粒度变细；或把比较下沉到叶子组件 |

### 加分点与易错点

- ✅ **加分**：说清"SCU 省的是组件执行，不是 DOM 操作"；说出"state 已变但 UI 未变"这个副作用。
- ⚠️ **易错**：以为 PureComponent 是深比较。
- ⚠️ **易错**：在 SCU 里做副作用（它是会被频繁调用的纯判断）。

---

## 7.4 useMemo 和 useCallback 有什么区别？

> 原题：**18.**「useMemo：缓存值；useCallback：缓存函数引用。」
> **48 / 71.**「同第 18 题。」

答案对，但缺两个关键点：**等价关系**（`useCallback(fn)` ≡ `useMemo(() => fn)`）和**"它们不保证缓存"**。

### 核心原理

**① 定义**

```js
const memoizedValue = useMemo(() => compute(a, b), [a, b]);
const memoizedFn    = useCallback((x) => doSomething(x, a), [a]);
```

**等价关系**：

```js
useCallback(fn, deps)  ===  useMemo(() => fn, deps)
```

`useCallback` 只是"缓存函数"这个特殊场景的语法糖。

**② 用来干什么（按价值排序）**

| 用途 | 说明 | 需要配合 |
|---|---|---|
| **稳定引用，避免 memo 子组件重渲染** | 父组件把 `onClick` 传给 `memo` 子组件 | `React.memo` |
| **避免 effect 反复执行** | effect 依赖某个函数，函数引用不稳 → effect 每次都跑 | `useEffect` |
| **缓存昂贵计算** | 排序/过滤/大数组转换 | 只 `useMemo` |
| **稳定 Context value** | `<Ctx.Provider value={...}>` | 只 `useMemo` |

**③ 不需要用的场景（很关键）**

```jsx
// ❌ 无意义的 useCallback：没有 memo 子组件，也没有依赖它的 effect
const onClick = useCallback(() => setCount(c => c + 1), []);

// ❌ 无意义的 useMemo：计算只有一行加法
const total = useMemo(() => a + b, [a, b]);
```

判断标准：

> **"这个引用会被别人用来做比较吗？"**
> 会（传给 `memo` 组件、作为 effect 依赖、作为 Context value）→ 值得缓存。
> 不会 → 缓存只是增加开销和噪音。

**④ 一个必须知道的语义**

`useMemo` **不是缓存保证**。React 官方明确说：

> You may rely on useMemo as a performance optimization, **not as a semantic guarantee**. React may choose to "forget" some previously memoized values.

也就是说：内存压力大、组件被卸载重挂、并发渲染中断等情况下，缓存可能被丢弃并重算。所以：

- ✅ 可以用来省计算；
- ❌ 不能用它保证"只执行一次"（那要用 `useRef`）；
- ❌ 不能用它做副作用（那要用 `useEffect`）。

**⑤ 依赖数组的坑（同 [03 册 3.2](/doc/react-lifecycle-useeffect)）**

```jsx
useMemo(() => compute(obj), [obj]);        // ❌ obj 每次新引用
useMemo(() => compute(obj.id), [obj.id]);  // ✅ 依赖原始值
useCallback(() => save(id), [id]);         // ✅ 只依赖真正用到的值
```

### 答题思路与要点顺序

1. **一句话**：`useMemo` 缓存值，`useCallback` 缓存函数；后者是前者的语法糖。（10 秒）
2. **等价关系**：`useCallback(fn, deps) ≡ useMemo(() => fn, deps)`。（10 秒，**立刻显专业**）
3. **用途**：省计算 / 稳引用（配合 memo、effect、Context）。（25 秒）
4. **不该用的场景**：没有比较方就不要缓存。（20 秒，**这是判断力**）
5. **语义**：不保证缓存，不能当"只执行一次"或副作用用。（20 秒，深度分）

### 口述参考

> useMemo 缓存的是值，useCallback 缓存的是函数引用，后者其实等价于 useMemo 返回一个函数，useCallback(fn, deps) 就是 useMemo(() => fn, deps)。
>
> 它们的用途分两类。一类是省计算，比如排序、过滤大数组，用 useMemo。另一类是稳引用，这个更像 useCallback 的主场：如果父组件把一个内联函数传给 memo 子组件，每次渲染都是新引用，memo 就失效了，用 useCallback 稳住；同样，如果这个函数是某个 effect 的依赖，不稳住 effect 就会每次都跑。
>
> 但我不建议无脑加。判断标准是"这个引用会不会被别人拿去做比较"，没有 memo 子组件、也没有依赖它的 effect，那缓存只是增加开销。一行加法用 useMemo 反而更慢。
>
> 还有一个语义上的点：useMemo 不保证一定缓存，官方说它只是性能优化，React 在内存压力下可以丢弃重算。所以不能拿它当"只执行一次"来用，也不能在里面做副作用，那些应该用 useRef 和 useEffect。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| useCallback 一定提升性能吗？ | 不一定。它有创建与依赖比较的开销；只有"配合 memo / 作为 effect 依赖"时才有收益 |
| useMemo 能替代 shouldComponentUpdate 吗？ | 不能。它缓存值，不控制渲染；控制渲染用 `memo` |
| 依赖里放函数会怎样？ | 父组件内联函数每次新引用 → 缓存失效。要么 `useCallback` 稳定，要么把函数体搬进内部 |
| useMemo 里能发请求吗？ | 不能。它会执行多次（可能被丢弃重算），副作用放 `useEffect` |
| useMemo 一定只算一次吗？ | 不一定，见"不保证缓存"；要"只算一次"用 `useRef` 或惰性 `useState` |
| `useMemo` 和 `useState` 惰性初始化怎么选？ | 只算一次并存住 → `useState(() => compute())` 或 `useRef`；跟着依赖变 → `useMemo` |

### 加分点与易错点

- ✅ **加分**：说出等价关系；说出"不保证缓存"这条官方语义；给出"什么时候不该用"的判据。
- ⚠️ **易错**：以为 `useMemo` 能阻止子组件重渲染（那是 memo 的事）。
- ⚠️ **易错**：把 `useMemo` 当成"缓存 API 返回值"（应该用 TanStack Query / SWR）。

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
2. props 引用变了（对象/函数/展开）；消费的 Context 变了；自身 state 变了；父组件根本没被 memo 住（父重渲染导致子被重新创建）。
3. 原地修改 state/props（`push`、`obj.a = 1`），浅比较认为引用未变 → 不更新。
4. `render`、`getSnapshotBeforeUpdate`、`componentDidUpdate` 不执行；state 已经在实例上更新。
5. `useMemo(() => fn, deps)`。
6. 它不保证缓存（React 可丢弃重算），可能执行多次；"只执行一次"用 `useState(() => compute())` 或 `useRef`。
7. 容器固定高度 + 用总高度撑开滚动条 + 只渲染可见区间（含缓冲区）+ 用 `transform`/padding 占位，滚动时按 `scrollTop` 重算区间。
</details>
