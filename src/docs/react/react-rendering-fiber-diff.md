# React 02｜渲染机制：Fiber 与 Diff

> 覆盖 6 个考点：渲染流程、Fiber 架构、Diff 算法、key、并发特性、StrictMode。

---

## 目录

- [本册速查](#本册速查)
- [2.1 React 的渲染流程是怎样的？](#21-react-的渲染流程是怎样的)
- [2.2 什么是 Fiber？为什么要引入 Fiber？](#22-什么是-fiber为什么要引入-fiber)
- [2.3 React 的 Diff 算法是怎么工作的？](#23-react-的-diff-算法是怎么工作的)
- [2.4 key 的作用是什么？为什么不能用 index？](#24-key-的作用是什么为什么不能用-index)
- [2.5 什么是并发（Concurrent）？React 18 有哪些新特性？](#25-什么是并发concurrentreact-18-有哪些新特性)
- [2.6 StrictMode 有什么作用？](#26-strictmode-有什么作用)
- [本册自测](#本册自测)

---

## 本册速查

| 考点 | 一句话答案 |
|---|---|
| 2.1 渲染流程 | render 阶段可中断（算差异），commit 阶段同步不可中断（改 DOM） |
| 2.2 Fiber 架构 | 用链表遍历 + 双缓存替代递归协调，实现可中断的“断点续跑” |
| 2.3 Diff 算法 | 三个假设把比较降到 O(n)；多节点两轮遍历 + key 索引 + `lastPlacedIndex` 判断移动 |
| 2.4 key | 同层节点在多次渲染间的身份标识，决定复用还是重建 |
| 2.5 并发 | `createRoot` 下并发是默认能力：可中断 + 优先级 + 自动批处理 |
| 2.6 StrictMode | 开发期检查器：双调用组件体、effect 与 ref 回调，暴露不纯副作用 |

---

## 2.1 React 的渲染流程是怎样的？

### 2.1 更新链路

以 `setState` 为例，一次更新依次经过：

```text
① 触发：setState → 按 lane 标记优先级 → scheduleUpdateOnFiber → ensureRootIsScheduled
② render（协调）：可中断、可重做、不产生用户可见副作用
     beginWork 向下：创建/复用子 fiber、执行组件函数、diff
     completeWork 向上：创建 DOM 实例、收集 flags
     产物：workInProgress 树 + flags / subtreeFlags
③ commit：同步、不可中断
     beforeMutation：getSnapshotBeforeUpdate
     mutation：插入/更新/删除 DOM；执行 useLayoutEffect 的 cleanup
     root.current = finishedWork（mutation 之后、layout 之前，切换双缓存）
     layout：useLayoutEffect 回调、componentDidMount/Update、ref 赋值
④ 浏览器绘制
⑤ 被动 effect：绘制后由调度器异步 flush useEffect
```

**阶段边界**：

| 阶段 | 是否可中断 | 做什么 | 边界 |
|---|---|---|---|
| render（协调） | 是 | 执行组件函数、diff、标记 flags | 不碰真实 DOM，组件函数必须是纯函数 |
| commit | 否 | 改 DOM、跑 layout effect、切换 `root.current` | 同步完成，保证界面原子更新 |
| 被动 effect | 异步 | `useEffect` 回调 | 在绘制之后，不属于 commit |

双缓存：内存中同时存在 `current`（屏幕上的树）和 `workInProgress`（构建中的树）；`root.current` 切换后新树生效。构建期间屏幕不变，中断时丢弃 `workInProgress` 即可，`current` 不受影响。

### 2.1 口述要点

- render 与 commit 的分界是“是否已经改真实 DOM”：前者只算差异，后者才落地。
- render 可中断的前提是产物都在内存里（`workInProgress` + flags），中断不会污染屏幕。
- commit 必须同步，才能保证一次更新对用户是原子的；layout effect 在 commit 内，`useEffect` 在绘制后。

### 2.1 常见追问

| 追问 | 应答 |
|---|---|
| 一次 `setState` 到 DOM 更新，同步还是异步？ | 调用同步，生效异步（进入调度）。React 18 默认批处理；`flushSync` 可强制同步走完 commit，见 [05 册 5.1](/doc/react-state-management-data-flow) |
| `useEffect` 什么时候执行？ | commit 完成后由调度器异步执行，在浏览器绘制之后，不阻塞绘制 |
| 为什么 `getSnapshotBeforeUpdate` 在 beforeMutation？ | 需要在 DOM 变更前读取旧布局（如滚动高度），变更后才能正确恢复 |
| 并发下 render 执行多次，会不会重复请求？ | 会。请求不能放在 render 或组件体顶层；`useEffect` 依赖变化也可能重复，需要 `AbortController` 取消 |

---

## 2.2 什么是 Fiber？为什么要引入 Fiber？

### 2.2 递归协调的局限

React 15 的协调是递归：`reconcileChildren` 沿调用栈向下，调用栈由 JS 引擎维护。React 16 用 Fiber 重写了协调器。

```text
render() ─┬─ ChildA.render() ─┬─ A1.render()
          │                   └─ A2.render()
          └─ ChildB.render() ...
```

调用栈展开后无法暂停、保存或恢复。一棵大树的 diff 如果长时间占用主线程，用户输入和动画都会被阻塞。

### 2.2 Fiber 节点与遍历

Fiber 节点是普通 JS 对象，关键字段：

```js
{
  tag, key, type, stateNode,   // 节点类型 / 同层身份 / 元素类型 / 实例
  return, child, sibling,      // 父 / 第一个子 / 下一个兄弟
  alternate,                   // 另一棵树上的对应节点（双缓存）
  memoizedState, updateQueue,  // hooks 链表或 class state / 更新队列
  flags, subtreeFlags,         // 本节点副作用 / 子树副作用聚合
  lanes,                       // 优先级
}
```

`return / child / sibling` 把树变成可暂停、可继续的链表：

```text
down：有 child → 进 child（beginWork）
up  ：没 child → completeWork；有 sibling → 进 sibling（beginWork）；
      没 sibling → 沿 return 向上 completeWork，直到 root
```

每个工作单元结束后，`workLoop` 检查 `shouldYield()`，随时可以返回；下次从 `workInProgress` 指针继续。遍历状态保存在对象字段里，不在 JS 调用栈里。

### 2.2 调度三件套

| 模块 | 职责 | 关键实现 |
|---|---|---|
| Scheduler | 决定什么时候执行：时间切片、优先级队列 | `MessageChannel`、`shouldYield` |
| Reconciler | 决定做什么：`beginWork` / `completeWork`、diff、打 flags | 可中断、双缓存 |
| Renderer | 决定怎么落地：`react-dom` / `react-native` | 可插拔 |

时间切片为什么用 `MessageChannel`：

| 方案 | 问题 |
|---|---|
| `setTimeout(fn, 0)` | 嵌套超过 5 层会被浏览器钳制到 4ms 起，切片精度差 |
| `requestIdleCallback` | 兼容性与触发频率不稳定，只在空闲时触发 |
| `MessageChannel` | 宏任务，不受 4ms 钳制，能在主动让出后尽快恢复 |

时间切片的关键是“执行一小段后检查是否该让出”，而不是固定每片只执行多久。

### 2.2 口述要点

- Stack Reconciler 的根因是递归调用栈不可保存/恢复，长任务必然阻塞主线程。
- Fiber 用 `return / child / sibling` 把树变成显式链表，遍历状态存对象字段，配合 `workInProgress` 指针实现断点续跑。
- Scheduler 用 `MessageChannel` 做时间切片，`shouldYield()` 决定何时让出；lane 决定谁先执行。
- 中断时未提交的 `workInProgress` 会被丢弃，但节点对象可通过 `alternate` 复用，因此 render 必须纯。
- 收益是可响应性，不是单次渲染更快；代价是两棵树的内存与实现复杂度。

### 2.2 常见追问

| 追问 | 应答 |
|---|---|
| Fiber 是数据结构还是架构？ | 都是。单个 Fiber 是工作单元；Fiber 架构指 Scheduler + Reconciler + Renderer 这套可中断体系 |
| 为什么不用 generator 实现中断？ | generator 需要额外的执行上下文管理，且中断后不易复用中间结果；显式链表更直接，也能配合双缓存 |
| lane 是什么？ | 位掩码优先级：不同更新类型占用不同位段（同步、输入连续、默认、Transition、Idle 等），用位运算做合并与包含判断 |

---

## 2.3 React 的 Diff 算法是怎么工作的？

### 2.3 三个假设

树的最小编辑距离是 O(n³)，React 用三个工程假设降到 O(n)：

| 假设 | 推论 |
|---|---|
| 类型不同 → 直接替换整棵子树 | 不再深入比较，剪掉大量分支 |
| 只做同层比较，不跨层移动 | 把“树 diff”变成“数组 diff” |
| 用 key 标识同层元素身份 | 位置变化后仍能找回同一节点 |

代价：跨层移动的节点会被删除并重建，组件 state 丢失。

### 2.3 单节点与多节点

单节点：

```text
key 相同 且 type 相同 → 复用，打 Update
key 相同 但 type 不同 → 删除旧的，新建
key 不同 → 删除旧的，继续看下一个
```

多节点分两轮。第一轮按位置匹配公共前缀：

```text
旧: [A, B, C, D]
新: [A, B, E, D]     ← 走到 index 2，C vs E 对不上 → break
```

匹配条件是 `oldFiber.key === newChild.key && oldFiber.type === newChild.type`；一旦不匹配立即 break，不继续向后找。

第二轮把剩余旧节点按 key 放进 Map：

```text
oldMap = { key → fiber }   // 只装第一轮没处理完的旧节点
遍历剩余新节点：
  - Map 命中且 type 相同 → 复用，打 Update，并从 Map 删除
  - Map 未命中 → 新建，打 Placement
最后：Map 中剩余的旧节点 → 标记删除
```

### 2.3 lastPlacedIndex

复用一个旧 fiber 时，用它在旧列表中的索引 `oldIndex` 与基准比较：

```js
let lastPlacedIndex = 0;
if (oldIndex < lastPlacedIndex) {
  fiber.flags |= Placement;    // 相对顺序变了，需要移动
} else {
  lastPlacedIndex = oldIndex;  // 不需要移动，更新基准
}
```

```text
旧 [A, B, C] → 新 [C, A, B]
C：oldIndex 2 ≥ 0 → lastPlacedIndex = 2
A：oldIndex 0 < 2 → 标记移动
B：oldIndex 1 < 2 → 标记移动
→ 1 次不动 + 2 次移动

旧 [A, B, C] → 新 [B, C, A]
B：1 ≥ 0 → 基准 1
C：2 ≥ 1 → 基准 2
A：0 < 2 → 标记移动
→ 只移动 1 次
```

从左往右扫描，旧索引保持递增就不移动；一旦旧索引小于基准，就标记移动。因此把一项移到末尾比移到开头便宜。

### 2.3 口述要点

- 三个假设：类型不同整棵替换、只做同层比较、key 标识同层身份；把 O(n³) 降到 O(n)。
- 单节点看 key + type；多节点两轮：先按位置匹配公共前缀，再用 Map 按 key 找剩余节点。
- 第一轮不匹配立即 break，避免错位后的无效比较。
- `lastPlacedIndex` 用贪心判断是否移动：旧索引小于基准 → Placement，否则更新基准。
- 跨层移动会被卸载重建，state 丢失，这是 O(n) 的代价。

### 2.3 常见追问

| 追问 | 应答 |
|---|---|
| diff 出差异后怎么应用到 DOM？ | 差异记在 fiber 的 `flags` 上（Placement / Update / Deletion），commit 阶段统一执行；删除用 `removeChild`，移动用 `insertBefore` |
| 为什么不用最长递增子序列（LIS）减少移动？ | React 用 `lastPlacedIndex` 贪心，不保证全局最优，但实现更简单；Vue 3 用 LIS 求最小移动集 |
| React 和 Vue 3 的 diff 最大区别？ | React 是纯运行时比较；Vue 3 在编译期给动态节点打 patchFlag，运行时比较量更小 |

---

## 2.4 key 的作用是什么？为什么不能用 index？

### 2.4 身份标识

key 是同层兄弟节点在多次渲染之间的身份标识，用来回答：这一次渲染的元素，和上一次渲染的哪个元素是同一个。

它有两个作用：

- 提高复用率：没有 key 时只能按位置匹配，顺序变化会导致大量重建；有 key 可以跟着数据走。
- 保证状态归属正确：复用组件实例时，state、effect、动画进度都跟着实例走。

### 2.4 index 作为 key 的问题

```jsx
// ❌ index 作 key
{items.map((item, i) => <Row key={i} data={item} />)}

// 初始 [A, B, C]，删除 A 后变成 [B, C]
// 新 index 0 匹配旧 index 0 → 复用 A 的 Row 实例，只把 data 换成 B
// 结果：B 那一行继承了 A 的展开态、输入内容、动画进度、focus
```

| 场景 | 现象 |
|---|---|
| 删除中间项 | 后面所有项的状态整体上移，非受控输入框内容错位、勾选状态串行 |
| 列表头部插入 | 全部重建，动画重放、图片重新加载、挂载开销翻倍 |
| 排序 / 筛选 | 状态跟随位置而不是数据，出现“删了 A 却显示 B 的选中态” |

index 只在列表完全静态（不增删、不排序、不筛选）且项内无状态时安全。

### 2.4 口述要点

- key 决定复用现有实例还是重建；复用时 state、effect、动画进度跟着实例走。
- index 作 key 会在增删或排序时把状态错配到另一条数据，非受控输入框最明显。
- 性能是第二作用：稳定 key 减少重建、图片重载与动画重放。
- 优先用业务 id；没有 id 就在数据创建时生成一次并保存，不要每次渲染生成随机 key。
- key 只需兄弟间唯一，不会出现在 `props` 中。

### 2.4 常见追问

| 追问 | 应答 |
|---|---|
| 用 id 但 id 会变（如后端重新排序）怎么办？ | 说明这个 id 不适合做身份；应使用稳定的业务主键，或接受重建 |
| 想强制重置一个组件的 state 怎么做？ | 改它的 key：`<Editor key={userId} />`，key 变即卸载重建 |
| key 影响 Context / 事件吗？ | 影响实例生命周期：卸载重建会重新挂载 effect、重新订阅；事件走委托，不受影响 |

---

## 2.5 什么是并发（Concurrent）？React 18 有哪些新特性？

### 2.5 术语与机制

React 18 起没有 “Concurrent Mode” 这个开关。历史上 16.x–17 的实验版有 `<React.unstable_ConcurrentMode>`；18 之后并发是 `createRoot` 下默认开启的一组能力，正式说法是并发特性（Concurrent Features）。

并发不是多线程，JS 仍是单线程。它的含义是：渲染工作可以被中断、被丢弃、被更高优先级的更新插队。

```text
            高优更新（输入）
                  ↓ 插队
低优渲染 ▓▓▓░░░░░░░▓▓▓▓▓▓▓  → 完成
             ↑ 被打断，丢弃 workInProgress，稍后重来
```

两个基础能力：

| 能力 | 实现 | 效果 |
|---|---|---|
| 可中断渲染 | Fiber + 时间切片 | 长渲染不阻塞输入 |
| 优先级调度 | lanes | 输入 > 默认 > Transition > Idle |

### 2.5 React 18 新特性

| 特性 | 说明 |
|---|---|
| `createRoot` / `hydrateRoot` | 新的 root API，并发能力的入口；旧的 `ReactDOM.render` 跑在 legacy 模式，没有并发 |
| 自动批处理 | `setTimeout`、Promise、原生事件里的多次 `setState` 也会合并成一次渲染；17 及以前只批处理 React 事件内 |
| `useTransition` / `startTransition` | 把更新标记为非紧急，可被打断 |
| `useDeferredValue` | 让某个值延迟跟随，先渲染旧值 |
| Suspense + 流式 SSR | `renderToPipeableStream` 支持流式 SSR 和选择性 hydration |
| `useId` | SSR 友好的唯一 ID，解决 hydration 不匹配 |
| `useSyncExternalStore` | 订阅外部 store，避免撕裂 |
| `useInsertionEffect` | CSS-in-JS 注入样式的时机，早于 layout effect |

### 2.5 useTransition 与 useDeferredValue

```jsx
// A. 能包住 setState → useTransition
const [isPending, startTransition] = useTransition();
const onChange = (e) => {
  setKeyword(e.target.value);                                // 紧急：保证输入不卡
  startTransition(() => setList(filter(e.target.value)));    // 非紧急：可被打断
};

// B. 值来自 props、包不住 setState → useDeferredValue
const deferredKeyword = useDeferredValue(keyword);
```

两者都把更新的优先级降低，允许被紧急更新打断，区别在控制粒度：

- `useTransition` 控制更新，需要能包住 `setState`。
- `useDeferredValue` 控制值，适合值来自 props 的场景。
- `deferred !== value` 表示当前仍在追赶旧值。

### 2.5 口述要点

- React 18 没有 Concurrent Mode 开关；`createRoot` 下并发能力默认开启。
- 并发是单线程下的可中断渲染 + 优先级插队，不是多线程，也不保证渲染更快。
- 基础是可中断渲染（Fiber + 时间切片）与 lane 优先级。
- React 18 的新 API：`createRoot`、自动批处理、`useTransition` / `startTransition`、`useDeferredValue`、Suspense 流式 SSR、`useId`、`useSyncExternalStore`、`useInsertionEffect`。
- 典型用法：输入框的值走紧急更新，过滤结果包在 `startTransition` 里。

### 2.5 常见追问

| 追问 | 应答 |
|---|---|
| 并发渲染会不会导致 UI 不一致（撕裂）？ | commit 是同步、原子的，DOM 不会停在半成品。撕裂风险来自渲染期间外部 store 变化，官方用 `useSyncExternalStore` 解决 |
| `startTransition` 的更新会被丢弃吗？ | 会被更高优先级的更新打断并重新计算；是否最终提交取决于后续更新与组件是否仍挂载。不要在 transition 里发请求 |
| 为什么 `useTransition` 不能包住输入框的 value 更新？ | 受控输入的 value 必须立即反映用户输入；降级后输入框会回退或卡顿 |
| 自动批处理需要同步读 DOM 怎么办？ | 用 `flushSync` 强制同步提交，但会破坏批处理并可能触发额外渲染 |
| 并发下 `useEffect` 会不会执行两次？ | 不会因为渲染中断而执行：effect 只在 commit 后运行，未提交的 render 不触发 effect。开发期 StrictMode 会额外执行一次 mount → cleanup → mount，生产不会 |
| `useDeferredValue` 和防抖有什么区别？ | 防抖按固定延迟合并调用；`useDeferredValue` 不设固定延迟，由调度器在空闲时追赶，不丢数据、自适应设备性能 |

---

## 2.6 StrictMode 有什么作用？

### 2.6 四类检查

`<StrictMode>` 是开发期检查器，只在开发构建执行额外检查；生产构建不做这些检查。

| 检查 | 行为 | 想暴露的问题 |
|---|---|---|
| 组件体双调用 | 函数组件体执行两次，结果丢弃一次 | render 不纯：在 render 里改外部变量、发请求、用 `Math.random()` / `Date.now()` 生成 key |
| Effect 双调用 | mount → cleanup → mount | effect 缺少清理函数：订阅没解绑、定时器没清、请求没取消 |
| ref 回调双调用 | React 19 中对 ref callback 也做双调用，包括其 cleanup | ref 里做了一次性副作用 |
| 废弃 API 检查 | 已废弃或移除的 API（字符串 ref、`findDOMNode`、`UNSAFE_` 生命周期等） | 引导迁移 |

### 2.6 为什么双调用

React 的方向是让组件可以被复用、预渲染、在后台先挂载再丢弃（如 Activity / Offscreen）。组件可能在挂载后立刻卸载；如果 effect 没有清理函数，就会泄漏资源。

双调用把这种场景提前强加给开发者：经历一次挂载 → 卸载 → 再挂载后仍能正常工作，说明组件可重复挂载。

```jsx
// ❌ 没有清理：StrictMode 下会订阅两次
useEffect(() => {
  socket.on('message', handler);
}, []);

// ✅ 有清理：双调用安全
useEffect(() => {
  socket.on('message', handler);
  return () => socket.off('message', handler);
}, []);
```

StrictMode 下请求发两次、埋点打两次、控制台打印两次，不是让你关掉 StrictMode，而是检查器在提醒这个副作用不可重入。修法是补清理，或把一次性逻辑移出 effect。

### 2.6 口述要点

- StrictMode 是开发期检查器，生产构建不执行这些额外检查。
- 组件体双调用暴露非纯 render；effect 双调用（mount → cleanup → mount）暴露缺失清理。
- React 19 也双调用 ref 回调及其 cleanup，用于检查 ref 清理。
- 动机是让组件可重复挂载，为 Activity / Offscreen 这类可挂起、可复用的 UI 做准备。
- 请求发两次时应补 `AbortController` / cleanup，或把一次性逻辑移出 effect。

### 2.6 常见追问

| 追问 | 应答 |
|---|---|
| 请求发两次怎么处理最优雅？ | 在 cleanup 里 `AbortController.abort()`；或用请求库的取消能力（axios `signal`、TanStack Query 去重）；幂等接口可以忽略 |
| 双调用会不会引起真实 bug？ | 会。依赖“只执行一次”的代码（如全局单例初始化）必须改成幂等，或放到模块作用域 |
| 可以局部开启吗？ | 可以，`<StrictMode>` 嵌套生效，只包住想检查的子树 |
| React 19 有变化吗？ | ref callback 也会被双调用检查；React 19 允许 ref callback 返回 cleanup |

---

## 本册自测

1. 不看文档，画出一次 `setState` 到 DOM 更新的完整时间轴，标出 `useLayoutEffect` 与 `useEffect` 的位置。
2. 为什么 Stack Reconciler 不能中断？Fiber 用什么替代了“调用栈”？
3. `[A,B,C,D]` → `[B,C,D,A]` 和 `[A,B,C,D]` → `[D,A,B,C]`，哪种移动次数更少？为什么？
4. 多节点 diff 的第一轮为什么要 `break`？
5. React 18 的 Concurrent Mode 怎么开？
6. StrictMode 下接口请求发了两次，正确的处理顺序是什么？
7. `lastPlacedIndex` 的初值是多少？它在什么条件下被更新？

<details>
<summary>自测参考答案要点</summary>

1. 触发 → 调度（lane）→ render（beginWork / completeWork，可中断）→ commit（beforeMutation：getSnapshotBeforeUpdate；mutation：改 DOM + layout effect cleanup；切 current；layout：useLayoutEffect + componentDidMount + ref）→ 绘制 → 异步 flush useEffect。
2. 递归的调用栈由引擎维护，JS 无法保存/恢复；Fiber 用 `return / child / sibling` 三指针把树变成显式链表，遍历状态存在对象字段里，配合 `workInProgress` 全局指针实现断点续跑。
3. `[A,B,C,D] → [B,C,D,A]`：B（旧 1）基准 1 → C（旧 2）基准 2 → D（旧 3）基准 3 → A（旧 0）< 3，只移动 1 次；`[A,B,C,D] → [D,A,B,C]`：D（旧 3）基准 3 → A（0）< 3 移动 → B（1）< 3 移动 → C（2）< 3 移动，共 3 次。所以移到末尾便宜，移到开头贵。
4. 一旦位置上的 key / type 对不上，后续大概率整体错位，继续按位置比较会产生大量无效匹配；交给第二轮用 Map 精确查找更高效。
5. React 18 已无 Concurrent Mode 这个开关，`createRoot` 即启用并发特性；旧的 `ReactDOM.render` 是 legacy 模式。
6. 先判断是否幂等；不幂等则加 `AbortController` 在 cleanup 中取消，或用支持去重的请求库；不要关 StrictMode。
7. 初值 0；只在“复用的旧 fiber 索引 ≥ lastPlacedIndex”时被更新为那个旧索引。

</details>
