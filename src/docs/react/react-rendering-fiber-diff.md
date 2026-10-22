# React 02｜渲染机制：Fiber 与 Diff

> 覆盖原题：4、15、19、20、21、27、33、37、40、44、50、51、55、64、68、69（16 题 → **6 个考点**）
> 这一册是 React 面试的**深水区**。6 个考点几乎构成一条完整的追问链：
> 渲染发生在哪两个阶段 → 为什么能中断 → Fiber 长什么样 → 怎么比出差异 → key 为什么重要 → 并发与 StrictMode 怎么影响这一切

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

| 考点 | 合并自 | 一句话答案 |
|---|---|---|
| 2.1 渲染流程 | 37 | render 阶段可中断（算差异），commit 阶段同步不可中断（改 DOM） |
| 2.2 Fiber 架构 | 19、44、50、64、68 | 把递归不可中断的协调过程改造成链表遍历 + 双缓存，实现"断点续跑" |
| 2.3 Diff 算法 | 4、55 | 三个假设降到 O(n)；多节点两轮遍历 + map 索引 + lastPlacedIndex 决定是否移动 |
| 2.4 key 的作用 | 15、27、40、51、69 | 同层节点在多次渲染间的**身份标识**，决定复用还是重建 |
| 2.5 并发与 React 18 | 20、33 | 没有"Concurrent Mode"开关了，`createRoot` 下并发是默认能力：可中断 + 优先级 + 自动批处理 |
| 2.6 StrictMode | 21 | 开发期检查器：双调用组件体与 effect，逼你暴露不纯的副作用 |

---

## 2.1 React 的渲染流程是怎样的？

> 原题：**37.**「render 阶段（可中断）→ commit 阶段（不可中断）。」
> 一句话是对的，但只有骨架。这题的价值在于"能不能把三个阶段的名词、时机、副作用对上"。

### 核心原理

一次更新的完整链路（以 `setState` 为例）：

```
① 触发    setState → dispatchSetState → enqueueUpdate（环形链表入队）
          → scheduleUpdateOnFiber → ensureRootIsScheduled（按 lane 排优先级）
                                  ↓
② render 阶段（可中断、可被打断、可能执行多次、不产生任何用户可见副作用）
          performConcurrentWorkOnRoot
            └─ workLoop：while (workInProgress !== null && !shouldYield())
                 beginWork（向下，创建/复用子 fiber、执行组件函数、diff）
                 completeWork（向上，创建 DOM 实例、收集 flags）
          产物：一棵完整的 workInProgress 树 + 副作用标记（flags / subtreeFlags）
                                  ↓
③ commit 阶段（同步、不可中断、一次性完成）
          commitRoot 三个子阶段：
            ① beforeMutation  —— 读快照：getSnapshotBeforeUpdate
            ② mutation        —— 改 DOM：插入/更新/删除；执行 useLayoutEffect 的 cleanup
            ③ layout          —— DOM 已改完：useLayoutEffect 回调、componentDidMount/Update、ref 赋值
          → root.current = finishedWork（切换 current 指针，双缓存落地）
                                  ↓
④ 浏览器绘制（paint）
                                  ↓
⑤ 被动 effect（异步，下一个宏任务/帧空闲）useEffect 回调 flush
```

**关键记忆点**：

| 阶段 | 是否可中断 | 做什么 | 常见误区 |
|---|---|---|---|
| render（协调） | ✅ 可中断、可重做 | 执行组件函数、diff、标记 flags | 以为这里能改 DOM —— 不能，所以 render 必须纯 |
| commit | ❌ 同步不可中断 | 真正改 DOM、跑 layout effect、切 current | 以为 `useEffect` 在这里跑 —— 不在，是绘制后 |
| 被动 effect | 异步 | `useEffect` 回调 | 以为 `useEffect` 是同步的 |

**双缓存**：内存里同时存在两棵树——`current`（屏幕上显示的）和 `workInProgress`（正在构建的）。commit 完成后 `root.current` 指向新树。好处：构建过程中屏幕不变，用户永远看不到"半成品 UI"；中断时直接丢弃 workInProgress 即可，`current` 完好无损。

### 答题思路与要点顺序

1. **一句话骨架**：触发 → render（可中断）→ commit（不可中断）→ 绘制 → 被动 effect。（10 秒）
2. **render 阶段干什么**：`beginWork` 向下 + `completeWork` 向上，产出带 flags 的新树；强调"不碰 DOM"。（25 秒）
3. **commit 三阶段**：beforeMutation / mutation / layout，把「getSnapshotBeforeUpdate / 改 DOM / useLayoutEffect + ref」对上去。（30 秒，**这是最能体现细节的一段**）
4. **时机归属**：`useLayoutEffect` 在 layout 阶段同步；`useEffect` 在绘制后异步。（15 秒）
5. **为什么这么切**：render 可中断才能做并发；commit 必须一气呵成，否则用户会看到不一致的界面。

### 口述参考

> 一次更新可以拆成两大阶段。触发之后先进入 render 阶段，也叫协调阶段，它做的是执行组件函数、做 diff、给需要变化的节点打上标记。这个阶段是可中断的，React 会一边算一边看有没有更高优先级的任务、有没有超过时间片，如果被打断就丢掉这棵正在构建的树重来。所以这个阶段不能有副作用，render 必须是纯的。
>
> render 完成后进入 commit 阶段，这个阶段是同步的、不能中断的，因为它要真正改 DOM。它内部又分三个子阶段：beforeMutation 里执行 getSnapshotBeforeUpdate 读快照；mutation 里真正插入、更新、删除 DOM，同时执行 useLayoutEffect 的清理函数；layout 阶段 DOM 已经改完了，执行 useLayoutEffect 的回调和 componentDidMount、componentDidUpdate，还有 ref 赋值。
>
> commit 结束时会把 root.current 指向新树，这是双缓存的切换点。之后浏览器绘制，再之后才异步执行 useEffect 的回调。所以 useLayoutEffect 和 useEffect 的差别，本质就是它们分别挂在了 commit 的 layout 子阶段和绘制之后。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 为什么 render 阶段可以中断，commit 不行？ | render 只计算不落地，中断了丢弃 workInProgress 即可；commit 已经在改真实 DOM，中断会导致界面处于"改了一半"的不一致状态 |
| `useEffect` 到底什么时候执行？ | commit 完成后，由 Scheduler 以普通优先级调度，通常在当前帧绘制之后、下一个宏任务里。所以它不阻塞绘制 |
| 一次 setState 到 DOM 更新，同步还是异步？ | 调用是同步的，生效是异步的（进调度）。React 18 里默认批处理；`flushSync` 可以强制同步走完 commit，见 [05 册 5.1](/doc/react-state-management-data-flow) |
| 为什么 `getSnapshotBeforeUpdate` 要在 beforeMutation？ | 它需要在 DOM 变更**之前**读取旧布局（如滚动高度），变更后才能正确恢复 |
| 双缓存有什么好处？ | ① 构建期屏幕不变，用户看不到中间态 ② 支持中断后丢弃重来 ③ 便于复用（alternate 指针互指，下次直接复用节点对象） |
| 并发下 render 会执行多次，会不会重复请求？ | 会。所以请求不能放在 render 或组件体顶层；`useEffect` 在 commit 后才跑，但依赖变化也可能重复，需要 AbortController 取消 |

### 加分点与易错点

- ✅ **加分**：准确说出 commit 三个子阶段的名字与各自的副作用；说出 `root.current` 切换点；把 `useLayoutEffect` / `useEffect` 精确挂到时间轴上。
- ⚠️ **易错**：说"render 阶段生成真实 DOM"——DOM 在 `completeWork` 里只是**创建实例**（`createInstance`），真正插入到文档在 commit 的 mutation 阶段。
- ⚠️ **易错**：把 `useEffect` 说成"渲染后立即执行"。准确说是"commit 完成 + 浏览器绘制后，异步调度执行"。

---

## 2.2 什么是 Fiber？为什么要引入 Fiber？

> 原题：**19.**「React16 重写的协调引擎，把渲染拆成可中断的单元，时间切片，避免长任务阻塞。」
> **44 / 50 / 64 / 68** 全是「同第 19 题」。

原答案的**方向对，但漏了"为什么"**。这题的高分点全在"为什么 Stack Reconciler 做不到可中断"。

### 核心原理

**① 问题：旧架构（Stack Reconciler）为什么不能中断**

React 15 的协调是**递归**：`reconcileChildren` 一路递归下去，调用栈由 JS 引擎维护。

```
render() ─┬─ ChildA.render() ─┬─ A1.render()
          │                   └─ A2.render()
          └─ ChildB.render() ...
```

递归的问题：**调用栈一旦展开，你无法"暂停"它**。JS 没有"保存当前调用栈到内存、稍后恢复"的能力（generator 可以，但见下）。如果一棵大树 diff 需要 200ms，主线程就被占满 200ms，期间用户输入、动画全部卡住。

**② Fiber 的答案：把递归换成"链表遍历 + 自己维护的栈"**

Fiber 节点是一个普通 JS 对象，关键字段：

```js
{
  tag,          // 节点类型：FunctionComponent / ClassComponent / HostComponent...
  key,          // 同层身份标识
  type,         // 函数组件对应函数本身、div 对应 'div'
  stateNode,    // 宿主实例（真实 DOM）或组件实例
  return,       // 父 fiber  ← 代替"调用栈"
  child,        // 第一个子 fiber
  sibling,      // 下一个兄弟 fiber
  alternate,    // 指向另一棵树上的自己（双缓存）
  memoizedState,// hooks 链表（函数组件）/ class 的 state
  updateQueue,  // 更新队列
  flags,        // 本节点副作用：Placement / Update / Deletion
  subtreeFlags, // 子树副作用聚合，用于快速跳过整棵干净的子树
  lanes,        // 优先级
}
```

`return / child / sibling` 三个指针把树变成**可以随时停下来、随时接着走**的链表：

```
        root
         │ child
        App ──sibling──▶ ...
         │ child
        div
       ╱     ╲
    h1       ul
    (child)   ↑sibling
                              return 指针一路指回父节点
```

遍历规则（这就是 `workLoop` 的本质）：

```
down：有 child → 进 child（beginWork）
up  ：没 child → completeWork → 有 sibling 就去 sibling（beginWork）
      没 sibling → 一路 return 往上 completeWork，直到回到 root
```

`completeWork` 结束意味着"这棵子树干完了"，此时可以检查 `shouldYield()`，**随时返回**。下次进来从 `workInProgress` 指针接着走——因为遍历状态全在对象字段里，不在 JS 调用栈里。

**③ 架构三件套**

| 模块 | 职责 | 关键词 |
|---|---|---|
| **Scheduler** | 决定"什么时候执行"：时间切片、优先级队列 | `MessageChannel`、`shouldYield`、5ms |
| **Reconciler** | 决定"要做什么"：`beginWork` / `completeWork`、diff、打 flags | 可中断、双缓存 |
| **Renderer** | 决定"怎么落地"：`react-dom` / `react-native` | 可插拔 |

**④ 时间切片为什么用 MessageChannel，不用 setTimeout / requestIdleCallback**

| 方案 | 问题 |
|---|---|
| `setTimeout(fn, 0)` | 嵌套调用超过 5 层会被浏览器强制 4ms 起，切片精度崩坏 |
| `requestIdleCallback` | 兼容性差、触发频率不稳定（空闲才触发），React 需要"主动让出后尽快回来" |
| **`MessageChannel`** | 宏任务，无 4ms 节流，优先级高于 `setTimeout`，稳定可靠 |

### 答题思路与要点顺序

1. **一句话**：Fiber 是 React 16 重写的协调引擎，把不可中断的递归改造成可中断的链表遍历。（10 秒）
2. **讲"为什么"**：Stack Reconciler 是递归，调用栈无法保存/恢复，长任务必然阻塞主线程。（25 秒，**这是关键分**）
3. **讲"怎么做"**：`return/child/sibling` 三指针 + `workInProgress` 全局指针 + 双缓存，实现断点续跑。（30 秒）
4. **讲"配套"**：Scheduler 用 MessageChannel 做时间切片，lane 做优先级。（20 秒）
5. **讲"收益与代价"**：收益是交互不卡、可做并发；代价是内存翻倍（两棵树）、实现复杂度高、render 可能重复执行（所以必须纯）。

### 口述参考

> Fiber 是 React 16 重写的协调引擎。它要解决的核心问题是：旧架构的协调是递归的，调用栈展开之后 JS 没办法把它暂停、存到内存里稍后恢复，所以一棵大树的 diff 如果耗时 200 毫秒，主线程就被占满 200 毫秒，用户的输入和动画全卡住。
>
> Fiber 的做法是把递归换成链表遍历。它把每个节点变成一个普通对象，用 return 指向父、child 指向第一个子、sibling 指向兄弟，同时用一个全局的 workInProgress 指针记录"当前干到哪了"。遍历规则是：有 child 就往下 beginWork，没有就 completeWork 然后找 sibling，没有 sibling 就一路 return 往上收。因为遍历状态全在对象字段里，不在调用栈里，所以随时可以停下来、下次接着走。
>
> 配合的还有两个东西：Scheduler 用 MessageChannel 做时间切片，每 5 毫秒检查一次要不要让出主线程；lane 模型给更新分优先级，输入这种高优更新可以插队，甚至打断正在进行的低优渲染。渲染在内存里的两棵树之间切换，叫双缓存，所以用户永远看不到半成品。
>
> 代价是内存翻倍、实现复杂，而且 render 可能被重复执行，所以 render 必须写成纯函数。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| Fiber 是什么？数据结构还是架构？ | 都是。单个 Fiber 是"工作单元"这个数据结构；Fiber 架构指 Scheduler + Reconciler + Renderer 这套可中断的体系 |
| 为什么不用 generator 实现中断？ | generator 有自己的执行上下文开销，且无法中途修改优先级/复用中间结果；链表方案更轻、更可控，还能配合双缓存复用节点 |
| 时间切片是多长时间？ | 5ms（`frameInterval`）。含义是"每执行 5ms 检查一次是否该让出"，不是"每次只执行 5ms" |
| lane 是什么？ | 31 位二进制表示的优先级（`SyncLane`、`InputContinuousLane`、`DefaultLane`、`TransitionLane`…），用位运算做合并/包含判断，比数字优先级更灵活 |
| 中断后会丢弃已做的工作吗？ | 会丢弃 workInProgress，从头再算（但复用了 `alternate` 上的节点对象）。这就是 render 必须纯的根本原因 |
| Fiber 一定更快吗？ | 不一定。它提升的是**可响应性**（不阻塞输入），单次渲染可能比递归更慢（多了指针跳转与调度开销） |

### 加分点与易错点

- ✅ **加分**：说清"调用栈不可保存"这个根因；说出 5ms 与 `MessageChannel` 的选择理由；说出中断会丢弃 workInProgress。
- ⚠️ **易错**：说"Fiber 让 React 变快了"——它让 React **不卡了**（可响应性），不是吞吐更高。
- ⚠️ **易错**：把 Fiber 节点和 ReactElement 混为一谈（见 [01 册 1.2](/doc/react-design-virtual-dom)）。
- ⚠️ **易错**：说"commit 阶段也可以被高优任务打断"——不能，commit 必须同步完成。

---

## 2.3 React 的 Diff 算法是怎么工作的？

> 原题：**4.**「同层比较，key 复用。先比类型，不同直接替换。」**55.**「同第 4 题。」
> 原答案只覆盖了**单节点的第一条规则**。多节点的两轮遍历才是真正的考点。

### 核心原理

**① 为什么是 O(n)：三个假设**

树的"最小编辑距离"是 O(n³)，React 用三个工程假设把它降到 O(n)：

| 假设 | 推论 |
|---|---|
| 类型不同 → 直接替换整棵子树 | 不再深入比较，剪掉大量分支 |
| 只做**同层**比较，不跨层移动 | 把"树 diff"变成"数组 diff" |
| 用 **key** 标识同层元素身份 | 不管位置怎么变，都能找回同一个节点 |

代价：跨层移动的节点会被"删除 + 新建"（丢失 state）。这是有意的取舍——真实业务里跨层移动极少。

**② 单节点 diff（`reconcileSingleElement`）**

```
新 child 是单个元素：
  遍历旧 children
    若 key 相同 且 type 相同 → 复用（打 Update）
    若 key 相同 但 type 不同 → 删掉旧的，新建（后面的 key 都不同了，直接 break）
    若 key 不同 → 删掉旧的，继续看下一个
```

**③ 多节点 diff（`reconcileChildrenArray`）—— 两轮遍历**

**第一轮：处理"公共前缀"**，只处理"能按位置+key 对上"的情况。

```
旧: [A, B, C, D]
新: [A, B, E, D]     ← 走到 index 2，C vs E 对不上 → break，进入第二轮
```

- 匹配条件：`oldFiber.key === newChild.key && oldFiber.type === newChild.type`
- 一旦不匹配立刻 break（不继续往后找），因为"后面很可能整体错位了"。

**第二轮：把剩余旧节点放进 Map，用 key 索引。**

```
oldMap = { key → fiber }   // 只装第一轮没处理完的旧节点，同时标记 DELETION
遍历剩余新节点：
  - 有 key 且 oldMap 里有 → 判断 type 是否相同，相同则复用（打 Update），并从 map 删除
  - 找不到 → 新建（Placement）
最后一轮：oldMap 里剩下的 → 全部标记删除
```

**`lastPlacedIndex`：判断"要不要移动"**

```js
let lastPlacedIndex = 0;              // 上一个不用移动的旧节点索引
// 复用一个旧 fiber 时（旧索引 oldIndex）：
if (oldIndex < lastPlacedIndex) {
  // 这个节点在新序列里"往左挪了"，需要移动
  fiber.flags |= Placement;
} else {
  lastPlacedIndex = oldIndex;          // 不用动，更新基准
}
```

直觉：从左往右扫，只要旧索引一直递增，说明相对顺序没变，不用移动；一旦出现"旧索引比基准小"，说明这个节点需要被 move（React 用 `insertBefore` 移动 DOM）。

```
旧: [A, B, C]      新: [C, A, B]
C：oldIndex 2 ≥ 0 → lastPlacedIndex = 2，不动
A：oldIndex 0 < 2  → 标记移动
B：oldIndex 1 < 2  → 标记移动
→ 1 次不动 + 2 次移动

反过来 旧 [A,B,C] → 新 [B,C,A]：B(1)→基准1; C(2)→基准2; A(0)<2 → 只移动 1 次
```

**这就是为什么"把列表项移到末尾"比"移到开头"便宜**——`lastPlacedIndex` 的贪心策略偏爱"从左往右保持递增"。

### 答题思路与要点顺序

1. **先讲复杂度前提**：三个假设把 O(n³) 降到 O(n)，代价是跨层移动会重建。（25 秒）
2. **单节点**：key + type 双条件判断复用/替换。（15 秒）
3. **多节点两轮**：第一轮公共前缀、第二轮 Map 索引找到就复用找不到就新建、最后清理残留。（40 秒，**这是核心**）
4. **lastPlacedIndex**：解释"什么时候需要移动"，并给出 `[A,B,C] → [C,A,B]` 的例子。（25 秒，**这是深度分**）
5. **收尾**：React 的 diff 是"运行时兜底"，Vue 3 在编译期用 patchFlag 减少比较；两边的目标都是"少比较"。

### 口述参考

> React 的 diff 建立在三个假设上：类型不同直接整棵替换、只做同层比较不跨层移动、用 key 标识同层元素身份。这三个假设把树的编辑距离从 O(n³) 降到 O(n)，代价是跨层移动的节点会被删掉重建、丢掉 state。
>
> 具体分两种情况。单节点比较简单，key 和 type 都对上就复用，type 不同就替换。
>
> 多节点是两轮遍历。第一轮从头开始按位置比，key 和 type 都匹配就继续，一旦对不上立刻 break，不往后找了。第二轮把剩下的旧节点按 key 放进一个 Map，然后遍历剩下的新节点，能在 Map 里找到就复用并打上更新标记，找不到就新建，同时第一轮没匹配上的旧节点会被标记删除，最后 Map 里还剩的一并删掉。
>
> 还有一个细节是 lastPlacedIndex，用来决定节点要不要移动。它记录上一个不需要移动的旧节点索引，如果当前复用的节点旧索引比它小，说明相对顺序乱了，需要移动。所以把一项从开头移到末尾要移动很多次，从末尾移到开头反而只移动一次，这个贪心策略是偏爱从左往右递增的。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 为什么第一轮遇到不匹配就 break，不继续找？ | 因为一旦错位，后面的 key 很可能整体偏移，继续按位置比会做大量无效比较；直接交给第二轮用 Map 精确查找更划算 |
| diff 出差异后怎么应用到 DOM？ | 差异记在 fiber 的 `flags` 上（Placement/Update/Deletion），commit 阶段统一执行；删除用 parentDOM.removeChild，移动用 insertBefore |
| 为什么不用最长递增子序列（LIS）减少移动？ | Vue 3 用了 LIS 求最小移动集；React 用 `lastPlacedIndex` 贪心，不保证全局最优，但实现更简单、配合可中断渲染足够 |
| 跨层移动会怎样？ | 父节点不同 → 整棵子树卸载重建，子组件 state 丢失、effect 重新执行。所以"保持组件树结构稳定"是一条性能与正确性建议 |
| 同时有 key 相同但 type 不同的情况？ | 视为不同节点：删除旧的、新建新的。key 只在"同层 + 同 type"内表示身份 |
| React 的 diff 和 Vue3 的 diff 最大区别？ | React 纯运行时；Vue3 编译期给动态节点打 patchFlag，并在同层用 LIS 做最小移动，运行时比较量更小 |

### 加分点与易错点

- ✅ **加分**：说出两轮遍历的 break 逻辑；说出 `lastPlacedIndex` 的贪心含义；能对比 LIS。
- ⚠️ **易错**：说"React 用最长公共子序列"——那是通用 diff 的思路，React 用的是"key 索引 + 贪心位置判断"。
- ⚠️ **易错**：说"diff 只比较同层节点，所以性能是 O(n)"——准确说是"同层数组比较"，复杂度与同层子节点数量线性相关，整体 O(n)。

---

## 2.4 key 的作用是什么？为什么不能用 index？

> 原题：**15.**「同 Vue 文档第 5 题。」（**跨文档悬空**）
> **27 / 40 / 51 / 69** 全是「同第 15 题」，**没有任何一处给出实质答案**。这题必须在本册补齐。

### 核心原理

key 是**同层兄弟节点在多次渲染之间的身份标识**。React 用它回答一个问题："这一次渲染的这个元素，和上一次渲染的哪个元素是同一个？"

**作用一：提高 diff 复用率**

没有 key 时只能按"位置"匹配，一旦列表顺序变化，位置上的所有节点都要重建；有 key 就能"跟着数据走"。

**作用二：保证组件状态归属正确**（这才是关键，比性能重要得多）

```jsx
// ❌ index 作 key
{items.map((item, i) => <Row key={i} data={item} />)}

// 初始 [A, B, C]，删除 A 后变成 [B, C]
// 新 index 0 匹配旧 index 0 → 复用了 A 的 Row 实例，只是把 data 换成了 B
// 结果：B 那一行继承了 A 的内部状态（展开态、输入内容、动画进度、focus）
```

**用 index 当 key 的三个具体 bug**：

| 场景 | 现象 |
|---|---|
| 删除中间项 | 后面所有项的状态"整体上移"，非受控输入框内容错位、勾选状态串行 |
| 列表插入到头部 | 全部重建，动画重放、图片重新加载、组件挂载开销翻倍 |
| 排序/筛选 | 状态跟随位置而不是数据，出现"删了 A 却显示 B 的选中态" |

**什么时候 index 是安全的**：列表**纯静态**（不增删、不排序、不筛选）且项内无状态。满足这三条时可以用，但通常不值得为这点便利引入风险。

### 答题思路与要点顺序

1. **定义**：同层身份标识，用来判断"新旧两次渲染中哪些是同一个节点"。（10 秒）
2. **两个作用**：少重建（性能）+ 状态归属正确（正确性），**强调后者更重要**。（25 秒）
3. **反例**：index 作 key，删除中间项 → 状态错位，最好给"非受控输入框内容串了"这种具体场景。（30 秒）
4. **正例**：稳定唯一 id（后端 id / uuid）；没有 id 就生成一次并存住（`useMemo` 或数据创建时生成）。（15 秒）
5. **边界**：key 只需兄弟间唯一；不会作为 prop 传给子组件。

### 口述参考

> key 是 React 用来判断"同层节点在两次渲染之间是不是同一个"的身份标识。它有两个作用，性能只是第二个。
>
> 第一个是正确性。React 复用节点时，复用的是一个组件实例，它的 state、effect、动画进度都跟着实例走。如果我用 index 当 key，删掉列表第一项之后，原来第二项就"坐"到了 index 0 的位置，复用第一项的实例，于是第一项的输入内容、展开状态会显示到第二项的数据上。这个 bug 在非受控输入框里特别明显。
>
> 第二个才是性能。没有稳定 key 时只能按位置匹配，顺序一变就整片重建，挂载开销、图片重载、动画重放都来了。
>
> 所以正确做法是用业务 id 这种稳定且唯一的标识；实在没有，就在数据生成时一次性建一个 id 存住。只有列表完全静态、不增删不排序、项内也没有状态时，用 index 才没问题。另外 key 只需要在兄弟之间唯一，而且不会传给子组件，子组件要用得另外传一个 prop。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| key 需要全局唯一吗？ | 不需要，只要在同一层兄弟节点之间唯一 |
| key 会传给子组件吗？ | 不会。key 和 ref 是 React 保留字段，需要的话显式再传一个 prop（React 19 起 ref 可作为普通 prop） |
| 随机数当 key 可以吗？ | 不行。每次渲染 key 都变 → 全部卸载重建，比 index 更差（每次渲染都丢状态 + 重跑 effect） |
| 用 id 但 id 会变（如后端重新排序）怎么办？ | 说明这个 id 不适合做身份；应使用稳定的业务主键，或者接受重建 |
| 想强制重置一个组件的 state 怎么做？ | 改它的 key：`<Editor key={userId} />`，key 变即卸载重建。这是 key 的合法"非常规"用法 |
| key 影响 Context / 事件吗？ | 影响的是实例生命周期：卸载重建会重新挂载 effect、重新订阅。事件因为走委托，不受影响 |

### 加分点与易错点

- ✅ **加分**：说清"复用实例 → 状态跟着实例走"这条因果链；给出"非受控输入框内容错位"的具体 bug；知道"改 key 强制重建"这个技巧。
- ⚠️ **易错**：把 key 的作用只答成"性能优化"。正确性才是主因。
- ⚠️ **易错**：说"key 会作为 props.key 传下去"——`props.key` 永远是 undefined。

---

## 2.5 什么是并发（Concurrent）？React 18 有哪些新特性？

> 原题：**20.**「React 18 的并发特性，渲染可中断/恢复，优先级调度。startTransition。」
> **33.**「自动批处理、Suspense、Concurrent、Transition、useId。」

### 原答案的问题

「**Concurrent Mode**」这个术语在 React 18 里**已经不存在了**。历史上（16.x–17 的实验版）确实有 `<React.unstable_ConcurrentMode>` 这个开关；18 之后官方的说法是：

> 并发不是一种"模式"，而是 `createRoot` 下**默认开启的一组能力**。

如果你在面试里说 "Concurrent Mode"，熟悉 React 的面试官会立刻判断你在看几年前的资料。正确表述是：**并发特性（Concurrent Features）**。

### 核心原理

**① 并发到底"并发"了什么**

不是多线程，JS 还是单线程。并发的含义是：**渲染工作可以被中断、被丢弃、被更高优先级的更新插队**。

```
            高优更新（输入）
                  ↓ 插队
低优渲染 ▓▓▓░░░░░░░▓▓▓▓▓▓▓  → 完成
             ↑ 被打断，丢弃 workInProgress，稍后重来
```

**② 三个基础能力**

| 能力 | 实现 | 效果 |
|---|---|---|
| **可中断渲染** | Fiber + 时间切片（5ms） | 长渲染不阻塞输入 |
| **优先级调度** | lanes（31 位二进制） | 输入 > 默认 > Transition > Idle |
| **双缓存** | `current` / `workInProgress` | 中断时屏幕保持旧 UI，不出现半成品 |

**③ React 18 的新特性清单（按面试价值排序）**

| 特性 | 说明 | 加分点 |
|---|---|---|
| **`createRoot` / `hydrateRoot`** | 新的 root API，并发能力的**开关** | 老 `ReactDOM.render` 跑在 legacy 模式下，没有并发 |
| **自动批处理（Automatic Batching）** | `setTimeout`、Promise、原生事件里的多次 setState 也合并成一次渲染 | 17 及以前只批处理 React 事件内 |
| **`useTransition` / `startTransition`** | 把更新标记为"非紧急"，可被打断 | 适合"输入框过滤大列表" |
| **`useDeferredValue`** | 让某个值"延迟跟随"，先渲染旧值 | 适合无法包 setState 的场景（值来自 props） |
| **Suspense（含 SSR）** | 组件树"等待"期间显示 fallback；`renderToPipeableStream` 支持流式 SSR + 选择性 hydration | 数据获取场景官方推荐走框架 |
| **`useId`** | SSR 友好的唯一 ID，解决 hydration 不匹配 | 用于 `aria-labelledby` 等 |
| **`useSyncExternalStore`** | 订阅外部 store 的官方 Hook，避免撕裂（tearing） | 状态库作者必备 |
| **`useInsertionEffect`** | CSS-in-JS 注入样式的时机（早于 layout） | 冷门但显深度 |
| **StrictMode 更严格** | 开发期 effect 双调用 | 见 2.6 |

**④ `useTransition` vs `useDeferredValue`**

```jsx
// A. 能包住 setState → useTransition
const [isPending, startTransition] = useTransition();
const onChange = (e) => {
  setKeyword(e.target.value);                  // 紧急：保证输入不卡
  startTransition(() => setList(filter(e.target.value))); // 非紧急：可被打断
};

// B. 值来自 props、包不住 setState → useDeferredValue
const deferredKeyword = useDeferredValue(keyword);
```

两者本质相同（都是打 TransitionLane），区别在**控制粒度**：`useTransition` 控制"更新"，`useDeferredValue` 控制"值"，后者还能拿到"当前是不是旧值"（`deferred !== value` 即正在追赶）。

### 答题思路与要点顺序

1. **先纠正术语**：18 之后没有 Concurrent Mode，是 `createRoot` 默认开启的并发特性。（10 秒，先立专业感）
2. **解释"并发"是什么**：单线程下渲染可中断 + 优先级插队，不是多线程。（20 秒）
3. **三个基础**：时间切片、lanes、双缓存。（20 秒）
4. **特性清单**：按"root API / 自动批处理 / Transition / Suspense / useId"讲，每个一句用途。（40 秒）
5. **给一个实战例子**：搜索框过滤大列表，用 `useTransition` 保证输入流畅。（20 秒，落地感）

### 口述参考

> 先说一个术语，React 18 之后其实没有 Concurrent Mode 这个东西了。以前实验版有个 ConcurrentMode 组件，18 里并发是 createRoot 下默认开启的一组能力，不需要开关。
>
> 并发的意思不是多线程，JS 还是单线程。它的意思是渲染工作可以被中断、被丢弃、被更高优先级的更新插队。基础是三样东西：Fiber 让渲染能中断，时间切片每 5 毫秒让一次主线程，lane 用二进制位给更新分优先级，输入这种高优更新可以打断正在进行的低优渲染，而双缓存保证被打断时屏幕上还是完整的旧界面。
>
> 18 的具体新特性里，我觉得最该说的是这几个：createRoot 是并发的入口，老的 ReactDOM.render 跑在 legacy 模式没有并发；自动批处理，setTimeout 和 Promise 里的多次 setState 也会合并；useTransition 和 useDeferredValue，把更新标记成非紧急；还有 Suspense 支持流式 SSR 和选择性 hydration，useId 解决 SSR 的 ID 不匹配，useSyncExternalStore 给状态库作者用，避免撕裂。
>
> 典型用法是搜索框过滤大列表：输入的值用紧急更新保证不卡，过滤后的列表包在 startTransition 里，用户继续打字时可以把它打断。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 并发渲染会不会导致 UI 不一致（撕裂）？ | 不会出现在 DOM 上：render 可中断，但 commit 是同步的，一次 commit 是原子的。真正要防的是"外部 store 在渲染期间被改"，所以有 `useSyncExternalStore` |
| `startTransition` 的更新会被丢弃吗？ | 会被打断并重算，最终一定提交（除非被更高优更新取代）。所以在 transition 里做请求是危险的 |
| 为什么 `useTransition` 不能包住输入框的 value 更新？ | value 更新被降级后，输入框会"回退/卡顿"，因为受控组件的 value 依赖 state 立即更新。紧急更新必须留给输入本身 |
| 自动批处理是好事吗？需要同步读 DOM 怎么办？ | 是（减少渲染次数）。要同步拿更新后的 DOM 用 `flushSync`，但会破坏批处理、可能触发额外渲染，慎用 |
| 并发下 useEffect 会不会执行两次？ | 会。渲染被中断重启时，若已经 commit 过则可能重跑；开发期 StrictMode 也会双调用 |
| `useDeferredValue` 和防抖有什么区别？ | 防抖是"固定延迟"，会丢中间值；`useDeferredValue` 是"让出主线程、尽快跟上"，不丢数据、自适应设备性能 |

### 加分点与易错点

- ✅ **加分**：主动纠正 "Concurrent Mode" 这个过时术语；区分 `useTransition` / `useDeferredValue` 的适用边界；提到 `useSyncExternalStore` 与撕裂。
- ⚠️ **易错**：把并发说成"多线程/Web Worker"——完全不同的东西。
- ⚠️ **易错**：说"并发让渲染更快"——它让**交互更流畅**，总渲染量可能更多（因为要重做）。
- ⚠️ **易错**：以为 `ReactDOM.render` 也有并发能力。没有，必须 `createRoot`。

---

## 2.6 StrictMode 有什么作用？

> 原题：**21.**「开发模式下检测副作用问题，双重调用 effects 帮你发现 bug。」

答案正确但太薄。这题的判断点在于：**你知不知道"为什么要双调用"，以及双调用暴露的到底是什么问题**。

### 核心原理

`<StrictMode>` 是**开发期**的检查器，生产构建里完全无效（零运行时开销）。它做四类检查：

| 检查 | 行为 | 想暴露的问题 |
|---|---|---|
| **组件体双调用** | 函数组件体执行两次（结果丢弃一次） | render 不纯（在 render 里改外部变量、发请求、用 `Math.random()`/`Date.now()` 生成 key） |
| **Effect 双调用** | mount → unmount → mount（cleanup 会被调用一次） | **effect 缺少清理函数**：订阅没解绑、定时器没清、请求没取消 |
| **ref 回调双调用** | React 19 中对 ref callback 也做双调用 | ref 里做了一次性副作用 |
| **废弃 API 警告** | 字符串 ref、legacy Context、`findDOMNode`、`UNSAFE_` 生命周期 | 引导迁移 |

**为什么 effect 要跑两次**（这是最能加分的部分）：

React 未来的方向是"组件可以被复用/预渲染/在后台先挂载再丢弃"（Offscreen、Activity、预 hydration）。一个组件可能**挂载了又立刻卸载**。如果你的 effect 没有清理函数，这种"挂载-卸载"就会泄漏资源。

双调用本质是**提前把这种场景强加给你**：如果两次挂载两次卸载之后你的组件还能正常工作，说明它"可重复挂载"。

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

**常见"假 bug"**：StrictMode 下请求发了两次、埋点打了两次、控制台打印两次。这些**不是你代码错了**，而是检查器在提醒你"这个副作用不可重入"。修法不是关掉 StrictMode，而是补清理 / 把一次性逻辑移出 effect（比如用 ref 标记）。

### 答题思路与要点顺序

1. **定位**：开发期检查器，生产无效。（10 秒）
2. **三件套**：组件体双调用、effect 双调用（含 cleanup）、废弃 API 警告。（30 秒）
3. **讲动机**：为"组件可被反复挂载/预渲染"的未来做准备，逼你写可重入的副作用。（25 秒）
4. **给现象与修法**：请求发两次 / 埋点两次 → 不是关掉它，而是补 cleanup 或移出 effect。（25 秒）
5. **收尾**：`createRoot` 下推荐用 `<StrictMode>` 包裹，但要知道它不检查"逻辑错误"，只检查"副作用纯度"。

### 口述参考

> StrictMode 是开发环境的检查器，生产构建里会被完全去掉，没有运行时开销。它主要做三件事。
>
> 第一是双调用组件体，用来发现 render 不纯，比如在渲染过程中改外部变量、发请求、用随机数生成 key。第二是 effect 的双调用，它会 mount、unmount、再 mount，中间的 cleanup 会被执行一次。这不是 bug，而是在模拟未来组件被提前挂载又丢弃的场景，比如 Offscreen 预渲染。如果你的 effect 没写清理函数，订阅、定时器、请求就会泄漏，双调用正好把这个问题暴露出来。第三是提示废弃 API，比如字符串 ref、findDOMNode、UNSAFE_ 生命周期。
>
> 实际开发里最常见的现象是接口请求发了两次、埋点打了两次。正确的做法不是关掉 StrictMode，而是补 cleanup 或者把一次性逻辑移出 effect。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| StrictMode 会影响生产环境吗？ | 不会。所有检查都在 DEV 分支里，production build 中直接被 tree-shake 掉 |
| effect 为什么必须执行两次而不是只检查一次？ | 因为只有真正执行"挂载-卸载-挂载"，才能验证 cleanup 是否完整；静态检查做不到 |
| 请求发两次怎么处理最优雅？ | ① `AbortController` 在 cleanup 里 abort ② 用请求库的取消能力（axios `signal`、TanStack Query 自带去重） ③ 幂等接口无所谓 |
| 双调用会不会引起真实 bug？ | 会——如果你的代码依赖"只执行一次"（如全局单例初始化），必须改成幂等或放到模块作用域 |
| 可以局部开启吗？ | 可以，`<StrictMode>` 嵌套生效，只包住想检查的子树 |
| React 19 有变化吗？ | ref callback 也做双调用检查；`use` 与 Actions 相关的新 API 同样受检查 |

### 加分点与易错点

- ✅ **加分**：说出"为 Offscreen / 可重复挂载的未来做准备"这个动机；给出 AbortController 的修法。
- ⚠️ **易错**：说"StrictMode 会让组件渲染两次所以性能差"——只在开发期，且这正是目的。
- ⚠️ **易错**：把 StrictMode 当成"语法检查/类型检查"，它是**运行时副作用检查**。

---

## 本册自测

1. 不看文档，画出一次 `setState` 到 DOM 更新的完整时间轴，标出 `useLayoutEffect` 与 `useEffect` 的位置。
2. 为什么 Stack Reconciler 不能中断？Fiber 用什么替代了"调用栈"？
3. `[A,B,C,D]` → `[B,C,D,A]` 和 `[A,B,C,D]` → `[D,A,B,C]`，哪种移动次数更少？为什么？
4. 多节点 diff 的第一轮为什么要 `break`？
5. 面试官说"React 18 的 Concurrent Mode 怎么开"，你怎么回？
6. StrictMode 下接口请求发了两次，你的处理顺序是什么？
7. `lastPlacedIndex` 的初值是多少？它在什么条件下被更新？

<details>
<summary>自测参考答案要点</summary>

1. 触发 → 调度（lane）→ render（beginWork/completeWork，可中断）→ commit（beforeMutation：getSnapshotBeforeUpdate；mutation：改 DOM + layout effect cleanup；layout：useLayoutEffect + componentDidMount + ref）→ 切 current → 绘制 → 异步 flush useEffect。
2. 递归的调用栈由引擎维护，JS 无法保存/恢复；Fiber 用 `return/child/sibling` 三指针把树变成显式链表，遍历状态存在对象字段里，配合 `workInProgress` 全局指针实现断点续跑。
3. `[A,B,C,D] → [B,C,D,A]`：B(旧 1) 基准=1 → C(旧 2) 基准=2 → D(旧 3) 基准=3 → A(旧 0) < 3，只移动 1 次；`[A,B,C,D] → [D,A,B,C]`：D(旧 3) 基准=3 → A(0)<3 移动 → B(1)<3 移动 → C(2)<3 移动，共 3 次。所以"移到末尾"便宜，"移到开头"贵。
4. 一旦位置上的 key/type 对不上，说明后续大概率整体错位，继续按位置比较会产生大量无效匹配；交给第二轮用 Map 精确查找更高效。
5. React 18 已无 Concurrent Mode 这个开关，`createRoot` 即启用并发特性；老的 `ReactDOM.render` 是 legacy 模式。
6. 先判断是否幂等；不幂等则加 `AbortController` 在 cleanup 中取消，或用支持去重的请求库；不要关 StrictMode。
7. 初值 0；只在"复用的旧 fiber 索引 ≥ lastPlacedIndex"时被更新为那个旧索引。
</details>
