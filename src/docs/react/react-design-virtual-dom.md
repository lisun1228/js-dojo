# React 01｜设计思想与虚拟 DOM

> 覆盖原题：1、17、45、47、49、52、57、74、78（9 题 → **4 个考点**）

---

## 目录

- [本册速查](#本册速查)
- [1.1 谈谈你对 React 的理解 / React 的设计思路](#11-谈谈你对-react-的理解--react-的设计思路)
- [1.2 虚拟 DOM 是什么？React 为什么要用它？](#12-虚拟-dom-是什么react-为什么要用它)
- [1.3 函数组件和类组件有什么区别？](#13-函数组件和类组件有什么区别)
- [1.4 React 和 Vue 有什么区别？](#14-react-和-vue-有什么区别)
- [本册自测](#本册自测)

---

## 本册速查

| 考点 | 合并自 | 一句话答案 |
|---|---|---|
| 1.1 对 React 的理解 / 设计思想 | 45、52 | `UI = f(state)` 的声明式视图库，三根支柱是声明式、组件化、单向数据流 |
| 1.2 虚拟 DOM | 1、47、57 | 用 JS 对象描述 UI 的中间层，把「怎么改 DOM」交给协调器，换来声明式与跨平台 |
| 1.3 函数组件 vs 类组件 | 17、49 | 类是「实例 + 生命周期」，函数是「每次渲染一个闭包快照」；Hooks 让函数组件能力追平 |
| 1.4 React vs Vue | 74、78 | 取舍不同：不可变 + 显式更新 vs 响应式 + 依赖追踪 |

---

## 1.1 谈谈你对 React 的理解 / React 的设计思路

> 原题：**45.**「组件化、虚拟 DOM、单向数据流。」**52.**「声明式、组件化、单向数据流。」

### 核心原理

React 官方定义是**「用于构建用户界面的 JavaScript 库」**——library，不是 framework。它只负责视图层（View），路由、状态、请求交给生态。设计可以收敛成一个公式和三个决策：

```
UI = f(state)
```

| 决策 | 具体做法 | 解决的问题 |
|---|---|---|
| **声明式** | 描述「目标状态长什么样」，React 计算「从当前到目标要改哪些 DOM」 | 不再手写 `createElement/appendChild/removeChild` 的步骤序列，消除中间态不一致 |
| **组件化** | 组件是可组合、自包含的 UI 单元，数据通过 props 向下流 | 复用靠**组合**而非继承；状态与视图放在一起，内聚性高 |
| **单向数据流** | props 只读，子组件不能改父状态，只能通过回调上报 | 数据流向可追踪，状态变化有唯一入口 |

这三点落到运行时：JSX 编译成 ReactElement 树，Reconciler 比较新旧树算出变更，Renderer 落到宿主环境；Scheduler 只决定「什么时候算」，属于调度实现，见 [02 册 2.2](/doc/react-rendering-fiber-diff)。

### 口述参考

- 定性：视图层库，核心公式是 `UI = f(state)`。
- 三个设计决策分别解决一个问题：声明式消除手工 DOM 步骤，组件化提供组合复用，单向数据流保证状态可追踪。
- 再下沉一层：Element（描述）→ Reconciler（diff）→ Renderer（落地），Scheduler 只负责时机。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| React 是框架还是库？ | 官方定位是库，只管视图层；路由、状态、请求由生态提供，选型成本落在团队 |
| 声明式到底「声明」了什么？ | 声明「状态 → UI」的映射，不是操作步骤；请求、订阅、DOM 操作要通过 `useEffect` 显式声明 |
| 单向数据流是绝对的么？ | 不是。子改父靠回调，跨层级靠 Context；受控组件的「双向」是 `value + onChange` 的闭环，数据仍经 state 单向流动 |
| React 的「不可变」指什么？ | state 更新要产生新引用（`{...state, a: 1}`），React 靠引用比较判断是否变化，这也是 `memo` / `PureComponent` 生效的前提 |

---

## 1.2 虚拟 DOM 是什么？React 为什么要用它？

> 原题：**1.**、**47.**、**57.** 三题同义：用 JS 对象描述 UI，状态变化先 diff，最小化真实 DOM 操作。

常见答法暗示「虚拟 DOM 比真实 DOM 快」，这不成立——结论取决于对比对象：

| 对比对象 | 谁快 | 原因 |
|---|---|---|
| 虚拟 DOM vs **全量重渲染**（innerHTML 重刷） | 虚拟 DOM | 只更新差异，避免整树重建与样式重算 |
| 虚拟 DOM vs **手写最优 DOM 操作** | 手写 | 多出建树 + diff 的 CPU 开销，也无法利用业务先验跳过比较 |

因此价值次序是**声明式抽象 > 跨平台 > 性能兜底**：性能只保证下限，不保证上限。

### 核心原理

虚拟 DOM 是用普通 JS 对象描述 UI 的树。JSX 编译产物（React 19，简化，省略 `_owner`）：

```js
// <div id="a">hi</div>
{
  // React 19 的 jsx() 与 createElement() 都用这个 Symbol；18 及更早是 Symbol.for('react.element')
  $$typeof: Symbol.for('react.transitional.element'),
  type: 'div',
  key: null,                          // key 不放进 props，也不会传给子组件
  ref: null,                          // 兼容字段（已废弃）；React 19 起 ref 是普通 prop，读 props.ref
  props: { id: 'a', children: 'hi' },
}
```

**完整链路**：

```
① 编写     JSX
② 编译     自动运行时（React 17 引入，React 19 起必需）：生产用 jsx() / jsxs()
           （react/jsx-runtime），开发用 jsxDEV()（react/jsx-dev-runtime），无需 import React；
           旧转换为 React.createElement()
③ 生成     ReactElement 树（不可变的普通对象）
④ 转换     Reconciler：ReactElement → Fiber 树（可变、可中断的工作单元）
⑤ 比较     diff：新旧 Fiber 树对比，标记 flags（Placement / Update / Deletion）
⑥ 提交     commit：一次性把变更打到真实 DOM
```

**为什么要这一层**（按重要性排）：

1. **声明式**：中间表示是「描述结果、由框架算过程」的前提（见 1.1）。
2. **跨平台**：协调逻辑与宿主环境解耦，同一棵树可交给 `react-dom`、`react-native`、`react-pdf`、`react-three-fiber`。
3. **性能兜底**：diff 让更新成本与 UI 规模解耦，避免「改一个字段重刷整个列表」。
4. **可编程性**：树是可序列化对象，支撑 SSR、时间旅行调试、快照测试与 React DevTools 的组件树。

### 口述参考

- 定义：JS 对象的 UI 描述，是 React 代码与真实 DOM 之间的中间层。
- 链路：JSX → `jsx()` / `createElement()` → ReactElement → Fiber → diff → commit → DOM。
- 存在理由：声明式、跨平台、性能兜底、可序列化（SSR / DevTools）。
- 性能边界：快于全量重渲染，慢于手写最优 DOM 操作。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 虚拟 DOM 一定比真实 DOM 快吗？ | 不一定。快于全量重渲染，慢于手写最优更新；框架保证的是下限与可维护性 |
| ReactElement 和 Fiber 什么关系？ | Element 是不可变描述（每次渲染新建）；Fiber 是可变的、带指针的工作单元，中断后可恢复。前者是输入，后者是运行时状态载体（见 02 册 2.2） |
| diff 复杂度为什么是 O(n)？ | 三个假设：同层比较、类型不同直接替换、key 标识身份；放弃 O(n³) 的最小编辑距离，见 [02 册 2.3](/doc/react-rendering-fiber-diff) |
| 为什么 `$$typeof` 用 Symbol？ | 服务端 JSON 无法序列化 Symbol，伪造的 `{type, props}` 不会被当作 React 元素；React 19 起元素类型是 `Symbol.for('react.transitional.element')`，不能只认 `react.element` |
| JSX 是模板引擎吗？ | 不是，是函数调用的语法糖：编译期变成 `jsx()`（或 `createElement()`），运行时没有模板解析开销，表达力来自 JS 本身 |
| 不用虚拟 DOM 行不行？ | 行。Svelte 编译期生成精确 DOM 操作，Vue 3 用 `patchFlag` 减少运行时比较；取舍在静态分析能力与动态性 |

---

## 1.3 函数组件和类组件有什么区别？

> 原题：**17.**「函数组件：简洁、Hooks、无 this。class 组件：生命周期、this。现在推荐函数组件。」**49.**「同第 17 题。」

### 核心原理

| 维度 | 类组件 | 函数组件 |
|---|---|---|
| **心智模型** | 一个**实例**，有 `this`，状态挂在实例上，生命周期沿时间轴调用 | 一次**函数调用**，每次渲染是独立闭包快照，状态由 React 托管在 fiber 上 |
| **状态载体** | `this.state`（可变对象） | `useState` 返回的 `[value, setter]`（value 是常量快照） |
| **副作用组织** | 按生命周期分散：请求、订阅、埋点散落在不同方法 | 按**关注点**聚合：多个 `useEffect`，一个 effect 一件事 |
| **逻辑复用** | HOC / render props（嵌套、props 来源不明） | 自定义 Hook（普通函数调用，无嵌套） |
| **this 问题** | 需要 `bind` 或箭头函数属性 | 没有 `this` |
| **能力盲区** | 全部能力 | 不能写 ErrorBoundary（`componentDidCatch` / `getDerivedStateFromError`），没有 `getSnapshotBeforeUpdate` |

差异的核心：类组件的 `this.state` 指向**最新值**；函数组件的 `state` 是**那次渲染的快照**。

```js
function Counter() {
  const [count, setCount] = useState(0);

  const handle = () => {
    setTimeout(() => {
      // 读到的是本次渲染闭包里的 count，不是 3 秒后的最新值
      alert(count);
    }, 3000);
  };
}
```

这就是 stale closure（闭包陷阱）：每次渲染生成独立闭包，异步回调只能看到创建时的值。

### 口述参考

- 心智模型：类是实例 + 生命周期，函数是每次渲染一个闭包快照。
- 状态：`this.state` 永远最新；`useState` 的值属于某次渲染，存放在 fiber 的 hook 链表上。
- 组织方式：类按生命周期分散，函数按关注点聚合；复用从 HOC / render props 变成自定义 Hook。
- 边界：ErrorBoundary、`getSnapshotBeforeUpdate` 仍只能写在 class 里。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 函数组件每次渲染都重新创建函数，性能差吗？ | 函数创建成本极低；真正的成本是**子组件重渲染**。优化点是 `memo` / `useCallback`，不是避免函数重建 |
| Hooks 能完全替代 class 吗？ | 不能。ErrorBoundary（`componentDidCatch`）、`getSnapshotBeforeUpdate` 仍需要 class；老代码不必重写 |
| 为什么推荐函数组件？ | 逻辑复用更自然、副作用按关注点聚合、无 `this`、便于编译期优化（React Compiler 主要面向函数组件与 Hooks） |
| 函数组件没有生命周期吗？ | 有，用 `useEffect` 表达；语义是「同步外部系统」，不是「在某个时刻执行」 |
| 函数组件的 state 存在哪？ | 在 `fiber.memoizedState` 的 hook 链表上；闭包只是读到那次渲染的值，见 [04 册 4.3](/doc/react-hooks-principles) |
| 怎么解决 stale closure？ | ① 函数式更新 `setX(v => v + 1)` ② 依赖数组 ③ `useRef` 存最新值 ④ `useEffectEvent`（React 19.2 起）/ 自定义 `useLatest` |

---

## 1.4 React 和 Vue 有什么区别？

> 原题：**74.**「React：JSX、灵活、生态大。Vue：模板、约定、上手快。」**78.**「同第 74 题。」

差异集中在视图描述、更新触发、diff 策略、生态与跨端。

### 核心原理（维度对比）

| 维度 | React | Vue |
|---|---|---|
| **视图描述** | JSX：JS 的完整表达力，本质是 `jsx()` / `createElement()` 调用 | SFC 模板：受限 DSL，编译期可静态分析；也支持 JSX |
| **更新触发** | **显式**：`setState` / `dispatch`，靠**不可变 + 引用比较**决定是否跳过更新 | **隐式**：Proxy 拦截读写，**自动依赖收集** |
| **diff 策略** | 纯**运行时** diff（同层 + key，O(n)） | **编译时 + 运行时**：`patchFlag`、静态提升、Block Tree，跳过静态节点 |
| **逻辑复用** | Hooks（函数式）；HOC / render props（历史方案） | Composables（`useXxx`，本质相同）；mixin（仍支持但不推荐） |
| **生态形态** | 只做视图层，路由/状态/请求由社区提供（React Router、Redux/Zustand、TanStack Query） | 官方全家桶（vue-router、pinia），约定统一，选型成本低 |
| **跨端** | React Native（成熟）、react-three-fiber、小程序（Taro） | uni-app、Weex（已边缘化） |

**更新机制的差异**：

```
React：setState(newObj) → 引用变了 → 标记 fiber 需要更新 → 重新执行组件函数 → diff 出变更
       （原地改 obj.a，引用没变 → memo/SCU 的浅比较认为没变 → 跳过更新）

Vue：  state.a = 1 → Proxy 的 set 拦截 → 触发依赖 → 精确通知用到 a 的渲染 effect
       （粒度是属性级，不需要 diff 全树，也不需要手动不可变）
```

- React：把「哪些更新可以跳过」的优化责任交给开发者（不可变 + 显式 set），运行时更简单、可预测。
- Vue：把**变更检测**交给框架（Proxy + 依赖收集），开发体验更顺；代理不友好的场景（大数据量、频繁创建对象）有额外开销。

### 口述参考

- 视图描述：JSX 是 JS，表达力完整；Vue 模板是受限 DSL，换编译期静态分析。
- 更新触发：React 显式 `setState` + 不可变引用比较；Vue 隐式 Proxy 依赖收集。
- diff：React 纯运行时同层 + key；Vue 3 编译期 `patchFlag`、静态提升。
- 生态：React 只做视图层，选型自由但成本在团队；Vue 官方全家桶，约定统一。
- 选型依据：跨端需求、团队背景、生态成熟度、招聘难度、是否已有设计系统。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 为什么 React 必须不可变，Vue 不用？ | React 用 `===` 做跳过更新的判断（`memo` / `PureComponent` / 依赖数组），原地修改引用不变会被判为无变化；普通 `setState` 仍会触发渲染。Vue 靠 Proxy 赋值触发，不需要手动不可变。代价是 React 每次更新复制对象，Vue 维护代理与依赖表 |
| Vue 的响应式比 React 性能好吗？ | 更新粒度更细（属性级），但 React 18 的并发与时间切片在「长任务不阻塞交互」上更强；场景不同，不能一概而论 |
| React 的 diff 比 Vue 慢吗？ | 单次 diff 通常 Vue 更快（静态节点被编译期跳过）；React 的瓶颈通常在组件函数重执行，而不是 diff 本身 |
| 你会怎么选型？ | 看跨端需求、团队背景、生态成熟度、招聘难度、是否已有设计系统 |
| Vue 的 mixin 和 React 的 HOC 有什么共同问题？ | 都是隐式注入：数据来源不透明、命名冲突、嵌套层级深；两边都转向组合式 API / Hooks |

---

## 本册自测

1. 「虚拟 DOM 比直接操作 DOM 快」这句话错在哪？
2. ReactElement 和 Fiber 的本质区别是什么？为什么需要两个东西？
3. 函数组件里 `setTimeout` 读到旧 state，根因是什么？三种解法是什么？
4. 如果面试官说「Vue 的响应式比 React 先进」，怎么接？
5. `$$typeof` 是干什么用的？去掉会失去哪一层保护？
6. 「React 是框架吗」，从哪三个角度回答？

<details>
<summary>自测参考答案要点</summary>

1. 只快于全量重渲染，慢于手写最优更新；价值在声明式抽象与跨平台，性能只是下限。
2. Element 是不可变描述（每次渲染新建），Fiber 是可变的、带 `return/child/sibling` 指针的工作单元，可中断恢复；前者是输入，后者是运行时状态载体（hooks 链表、优先级、flags）。
3. 闭包快照：每次渲染生成独立闭包，读的是那一次的值。解法：函数式更新、依赖数组、`useRef` 存最新值。
4. 不比较优劣：Vue 更新粒度更细（属性级 + 编译期跳过静态节点），React 的并发能力在「长任务不阻塞交互」上更强。
5. 服务端 JSON 无法序列化 Symbol，伪造的元素不会被 React 识别；这是纵深防御，文本内容仍由 React 转义。
6. 官方定位是 library；只管视图层，路由/状态/请求交给生态；跨端靠 Renderer 抽象。
</details>
