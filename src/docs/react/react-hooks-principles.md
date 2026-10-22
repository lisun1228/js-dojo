# React 04｜Hooks 原理与规范

> 覆盖原题：5、7、25、32、39、42、43、54、58、62、75、76、81（13 题 → **5 个考点**）
> 这一册是 Hook 的"为什么"和"怎么实现"。`useState` 原理 + 为什么不能条件调用，这两个点合起来构成一条完整的追问链，几乎每次 React 面试都会走到。

---

## 本册速查

| 考点 | 合并自 | 一句话答案 |
|---|---|---|
| 4.1 Hooks 解决了什么问题 | 5、42、62 | 让函数组件拥有状态与副作用，并把"复用有状态逻辑"从 HOC 嵌套变成普通函数调用 |
| 4.2 为什么不能条件/循环调用 Hook | 32、39、75、76 | Hook 状态按**调用顺序**存在 fiber 的链表上，顺序一变就全错位 |
| 4.3 useState 的实现原理 | 7、43、58 | mount 建 hook 链表 + 队列；dispatch 入环形链表 + 调度，渲染时再算 |
| 4.4 useState vs useReducer | 25、81 | 状态迁移逻辑复杂/多字段联动 → useReducer；简单独立 → useState |
| 4.5 常用 Hooks 清单 | 54 | 7 个基础 + 5 个并发/工具 + 3 个冷门 |

---

## 4.1 React Hooks 解决了什么问题？

> 原题：**5.**「函数组件可以用状态和副作用，不用写 class。逻辑复用更优雅（自定义 Hook），代码更简洁。」
> **42.**「同第 5 题。」**62.**「说一下对函数式编程的理解，对hooks的理解」——「纯函数、不可变。Hooks 让函数组件有状态。」

原答案说的是**结果**，不是**动机**。React 官方给出的是三条，能背出这三条，这题的分就稳了。

### 核心原理

**官方三条动机**（来自 Hooks 提案文档）：

| 动机 | 具体痛点 | Hooks 的解法 |
|---|---|---|
| **① 复用有状态逻辑很难** | HOC / render props 会造成"嵌套地狱"（wrapper 一层套一层，DevTools 里一片 `withXxx(withYyy(...))`）、props 来源不明（这个 `data` 是谁传的？） | 自定义 Hook——就是一个普通函数，`use` 开头，内部可以调别的 Hook。**共享的是逻辑，不是状态** |
| **② 复杂组件难以理解** | 生命周期把相关逻辑**拆散**（订阅在 didMount、更新在 didUpdate、清理在 willUnmount），又把不相关逻辑**塞在一起**（didMount 里请求 + 埋点 + 订阅） | 按**关注点**聚合：一个 `useEffect` 只做一件事，订阅的 setup 与 teardown 写在一起 |
| **③ class 对人、对机器都不友好** | 必须理解 `this`（绑定问题）、方法名是字符串难以压缩、热更新容易失效、编译器难以做优化 | 普通函数 + 闭包；无 this；对编译器友好（React Compiler 只针对函数组件） |

**再往上一层：Hooks 让"函数式编程"落地到 UI**

| 函数式特征 | 在 React 里的体现 |
|---|---|
| 纯函数 | 组件就是 `props → JSX` 的纯映射，render 阶段不能有副作用 |
| 不可变 | state 更新返回新引用（`{...state, a: 1}`），靠引用比较判断变化 |
| 组合优于继承 | 组件组合、Hook 组合，都没有继承 |
| 副作用隔离 | 副作用被显式收进 `useEffect`，与纯计算分离 |

**自定义 Hook 的本质（必须说清）**：

```jsx
function useWindowWidth() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    const onResize = () => setW(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return w;
}
// 两个组件各调一次 → 各自独立的 state，不共享
```

> 自定义 Hook **不共享状态**，只共享"逻辑"。要共享状态得用 Context 或状态库。这句话是高频追问的答案。

### 答题思路与要点顺序

1. **先给结论**：Hooks 让函数组件拥有状态、副作用和上下文，同时改变了"逻辑复用"的方式。（10 秒）
2. **三条动机**：复用难 / 逻辑被生命周期拆散 / class 不友好，各配一句痛点。（35 秒，**这是主体**）
3. **讲复用**：自定义 Hook 是普通函数，共享逻辑不共享状态。（20 秒）
4. **讲函数式**：纯函数、不可变、组合、副作用隔离。（20 秒，命中第 62 题）
5. **收尾**：Hooks 不是"给函数组件加生命周期"，而是换了一套"同步外部系统"的模型。

### 口述参考

> Hooks 解决的核心问题不是"让函数组件也能 setState"这么简单，官方给了三条动机。
>
> 第一条是复用有状态逻辑太难。以前只能用 HOC 或者 render props，结果是嵌套一层套一层，DevTools 里看一堆 withXxx，而且 props 到底是谁传的说不清。自定义 Hook 把这件事变成了普通函数调用，共享的是逻辑，不是状态。
>
> 第二条是复杂组件难以理解。类组件里，一个订阅要拆到 didMount 里注册、didUpdate 里更新、willUnmount 里清理，同一个功能散在三个地方；而 didMount 里又塞了请求、埋点、订阅这些不相关的逻辑。Hooks 是按关注点聚合，一个 effect 一件事，setup 和 teardown 写在一起。
>
> 第三条是 class 本身不友好，this 绑定容易错，方法名难以压缩，热更新经常失效，编译器也不好优化。
>
> 再往上看，Hooks 其实是把函数式编程落地到 UI：组件是 props 到 JSX 的纯函数，状态不可变更新，用组合代替继承，副作用被显式收进 useEffect。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 自定义 Hook 会共享状态吗？ | 不会。每次调用都是一份独立的 hook 链表节点，共享的只是"逻辑"。要共享状态用 Context 或状态库 |
| Hook 能替代 HOC 吗？ | 逻辑复用基本能替代；但 HOC 仍适合"注入 props / 权限包裹 / 埋点"这类结构性场景，且 `connect`、`withRouter` 是 HOC 形态 |
| Hooks 有什么缺点？ | ① 依赖数组的心智负担（闭包陷阱）② 无法条件调用，约束较强 ③ 调试时调用栈不直观 ④ 对 class 老代码需要迁移成本 |
| 为什么说 Hooks 更"函数式"？ | 组件是纯函数、state 不可变、副作用隔离、组合代替继承 |
| Hooks 之前怎么复用逻辑？ | mixin（React 不支持）→ HOC → render props → Hooks，演进方向是"减少嵌套、来源更清晰" |
| 为什么 Hooks 不能在 class 里用？ | Hook 依赖 fiber 上的 `memoizedState` 链表和 dispatcher，只在函数组件渲染时被设置 |

### 加分点与易错点

- ✅ **加分**：说清"共享逻辑不共享状态"；能对比 HOC / render props / Hooks 的演进逻辑；提到 React Compiler 只面向函数组件。
- ⚠️ **易错**：把 Hooks 说成"函数组件的生命周期"，这会引出"useEffect 等价于 didMount"的错误类比。
- ⚠️ **易错**：说"自定义 Hook 可以共享状态"——除非内部用了 Context/模块级变量，否则不共享。

---

## 4.2 为什么 Hook 不能写在条件、循环或嵌套函数里？

> 原题：**32.**「Hook 靠调用顺序存储状态，条件调用顺序变了就乱了。」
> **39 / 76.**「同第 32 题。」**75.**「React hooks 的使用规范？」→「顶层调用、只在组件/Hook 中用。」

原答案抓住了核心，但**没讲清"链表怎么错位"**。这题讲清楚"两次渲染的指针怎么跑偏"，就赢了。

### 核心原理

**① Hook 状态的存储结构**

每个函数组件对应的 fiber 上有一个 `memoizedState` 字段，指向一条**单向链表**：

```
fiber.memoizedState
      ↓
   hook① (useState)  →  hook② (useEffect)  →  hook③ (useRef)  → null
   { memoizedState: 0 }   { memoizedState: effect }  { memoizedState: {current} }
```

**没有名字，只有位置。** React 在渲染时靠一个指针 `currentHook` 顺序往后走：第 1 次调 Hook 读第 1 个节点，第 2 次读第 2 个……

**② 条件调用时发生了什么**

```jsx
function Foo({ show }) {
  const [a, setA] = useState(0);       // 第 1 个 hook
  if (show) {
    const [b, setB] = useState('x');   // 第 2 个 hook —— 只在 show 时存在
  }
  const [c, setC] = useState(true);    // show=false 时是第 2 个，show=true 时是第 3 个
}
```

| 渲染 | `show` | hook 链 | `c` 读到的节点 |
|---|---|---|---|
| 第 1 次 | `true` | a → b → c | 第 3 个节点（`true`）✅ |
| 第 2 次 | `false` | a → c | 第 2 个节点（`'x'`）❌ **读到 b 的 state，且类型都不对** |

如果 hook 数量变少，React 还会直接抛错：

```
React has detected a change in the order of Hooks called by Foo.
This will lead to bugs and errors if not fixed.
Rendered fewer hooks than expected. This may be caused by an accidental early return statement.
```

**③ 所以规则是两条**

1. **只在顶层调用**：不在条件、循环、嵌套函数、`try/catch` 里调用。
2. **只在 React 函数组件或自定义 Hook 中调用**（自定义 Hook 名以 `use` 开头，让 lint 能识别）。

> 第三条常被忽略：**不要在普通函数里调用 Hook**，即便它被组件调用——因为 React 靠 `use` 前缀判断"这里允许调 Hook"。

**④ 正确的条件写法**

```jsx
// ❌ 条件调用 Hook
if (isLogin) { const [user, setUser] = useState(null); }

// ✅ 条件放在 Hook 内部
const [user, setUser] = useState(null);
useEffect(() => {
  if (!isLogin) return;      // 条件在 effect 里
  fetchUser().then(setUser);
}, [isLogin]);

// ✅ 或者 early return 必须放在所有 Hook 之后
const [a] = useState(0);
useEffect(() => {...}, []);
if (!data) return <Loading />;   // 所有 Hook 已调用完，安全
```

**⑤ 确实需要"条件性地用一整套逻辑"怎么办**

拆组件 + 用 key 强制重建，或把条件逻辑封装进自定义 Hook（Hook 本身无条件调用，内部判断）：

```jsx
function Panel({ mode }) {
  useSomeFeature(mode === 'advanced');  // Hook 无条件调用，参数控制行为
}
```

### 答题思路与要点顺序

1. **结论先行**：Hook 靠**调用顺序**定位状态，没有名字。（10 秒）
2. **讲结构**：fiber.memoizedState 上的单向链表，渲染时靠指针顺序读。（20 秒）
3. **讲错位**：给出 `show` 从 true 变 false 的例子，说明 `c` 读到了 `b` 的节点；顺带提 React 会报 "Rendered fewer hooks"。 （30 秒，**这是核心**）
4. **讲规则**：只在顶层、只在组件/自定义 Hook 中调用。（15 秒）
5. **给替代方案**：条件放 Hook 内部；early return 放最后；必要时拆组件或改 key。（20 秒）

### 口述参考

> 根本原因是 Hook 的状态是按调用顺序存的，不是按名字。每个函数组件对应的 fiber 上有一条 hook 链表，第一个 useState 对应第一个节点，第二个对应第二个，渲染时 React 用一个指针顺着走。它没有名字，所以只能靠顺序识别。
>
> 如果我在条件里调 Hook，两次渲染的调用顺序就不一样了。比如第一次 show 是 true，有 a、b、c 三个 hook；第二次 show 是 false，只有 a 和 c 两个，那 c 就会去读第二个节点，也就是上次 b 的 state，类型都不对，直接出 bug。hook 数量变少时 React 还会直接报 Rendered fewer hooks than expected。
>
> 所以规则是只在顶层调用，不在条件、循环、嵌套函数里调用，而且只在函数组件或自定义 Hook 里调用，因为 React 是靠 use 前缀识别这是允许调 Hook 的地方。
>
> 正确做法是把条件放到 Hook 内部，比如在 effect 里先判断再执行；early return 要放在所有 Hook 之后；如果真需要整套逻辑有条件地启用，就拆成子组件，或者用 key 强制重建。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| Hook 为什么不用名字索引？ | JS 里拿不到可靠的变量名（压缩会改名、可以解构、可以重复），编译期收集名字成本高且不可靠；顺序是零成本方案 |
| early return 一定不行吗？ | 只要所有 Hook 都在 return 之前调用完，就可以 |
| 循环里调 Hook 为什么不行？ | 循环次数变化会导致 hook 数量变化，同样错位。要循环就用"列表 + 子组件" |
| Hook 放在 `try/catch` 里为什么不行？ | 异常路径可能导致某些 Hook 被跳过，顺序变化 |
| 有 lint 兜底吗？ | `eslint-plugin-react-hooks` 的 `rules-of-hooks` 会静态检查，必须开 |
| 如果顺序真的坏了，React 会怎样？ | 开发期抛错（hook 数量/顺序不一致）；生产期表现是状态错乱，极难排查 |
| 为什么 Hook 必须在 `use` 开头？ | 让 lint 与 React 都能识别"这是自定义 Hook"，从而允许在其内部调用 Hook；也便于阅读时区分 |

### 加分点与易错点

- ✅ **加分**：说出"链表 + 指针 + 无名字"；说出具体的报错文案；给出"条件放 Hook 内部"的正确写法。
- ⚠️ **易错**：说"Hook 存在闭包里"——状态在 fiber 上，闭包只是读到快照。
- ⚠️ **易错**：以为"只要不改变数量就没事"——顺序变化同样致命（比如两个条件分支各调一个 Hook）。

---

## 4.3 useState 的实现原理是什么？

> 原题：**7.**「函数组件用链表存储 hook 状态，每次渲染按顺序调用。所以不能在条件/循环中用 Hook。」
> **43 / 58.**「同第 7 题。」

原答案把"存储结构"讲对了，但 **useState 的核心还有一半没讲：更新是怎么入队、怎么计算的**。这部分才是"原理题"的得分点。

### 核心原理

**① mount 阶段：创建 hook 节点**

```js
// 简化版 mountState
function mountState(initialState) {
  const hook = mountWorkInProgressHook();
  hook.memoizedState = typeof initialState === 'function' ? initialState() : initialState;
  const queue = { pending: null, dispatch: null, lastRenderedReducer: basicStateReducer };
  hook.queue = queue;
  const dispatch = (queue.dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue));
  return [hook.memoizedState, dispatch];
}
```

要点：
- 初始值支持**函数**（惰性初始化）：`useState(() => expensive())` 只算一次。
- `dispatch` 在 mount 时创建，**之后引用永远不变**（所以可以安全地不进依赖数组）。
- hook 节点挂在 `fiber.memoizedState` 链表尾部。

**② update 阶段：读链表 + 处理队列**

```js
function updateState() {
  return updateReducer(basicStateReducer);
}
```

也就是说：**`useState` 本质上是 `useReducer` 的一个特例**，reducer 是：

```js
function basicStateReducer(state, action) {
  return typeof action === 'function' ? action(state) : action;
}
```

这一句直接解释了两件事：
- 为什么 `setX(fn)` 能拿到最新 state（action 是函数时，渲染阶段以最新 state 为入参执行）；
- 为什么 `setX(value)` 会"覆盖"（action 不是函数时，直接替换）。

**③ dispatch 之后发生了什么（关键）**

```js
function dispatchSetState(fiber, queue, action) {
  const update = { lane, action, hasEagerState: false, eagerState: null, next: null };
  // 环形链表入队：queue.pending 指向最后一个 update，pending.next 指向第一个
  enqueueUpdate(queue, update);
  scheduleUpdateOnFiber(fiber, lane);   // ← 只是"调度"，不是立即渲染
}
```

**eagerState 优化**（面试加分）：如果当前没有待处理的更新，可以**提前用 reducer 算出新 state**；若与当前 state 相同（`Object.is`），直接 bail out，**不触发调度**。

```jsx
const [n, setN] = useState(0);
setN(0);   // Object.is(0, 0) → 不重新渲染
```

**④ 环形链表（为什么是环）**

```
queue.pending ──▶ update③ ──▶ update① ──▶ update② ──┐
                    ▲                                │
                    └────────────────────────────────┘
        pending 永远指向"最后一个"，pending.next 就是"第一个"
```

好处：**O(1) 插入**（不用遍历到尾部），并且天然能拿到"第一个"用来遍历。

**⑤ 批处理时，多次 setState 怎么合并**

```jsx
setN(n + 1);   // action = 1（当前快照 0 + 1）
setN(n + 1);   // action = 1
setN(n + 1);   // action = 1
// 三次 action 都是"替换为 1" → 最终 n = 1

setN(p => p + 1);  // action = fn
setN(p => p + 1);  // action = fn
setN(p => p + 1);  // action = fn
// 渲染时依次执行：0 → 1 → 2 → 3
```

**这就是第 36 题「为什么 setState 要传函数」的底层原因**：对象式更新的 action 是"常量"，函数式更新的 action 是"计算"，后者才能在渲染时基于最新 state 累加。

### 答题思路与要点顺序

1. **存储**：状态不在闭包里，在 `fiber.memoizedState` 的 hook 链表上，按顺序索引。（20 秒）
2. **mount**：创建 hook 节点 + queue + 稳定的 dispatch；初始值支持惰性函数。（20 秒）
3. **update**：`useState = useReducer(basicStateReducer)`——这一句是深度分。（20 秒）
4. **dispatch**：入环形链表 + 调度（不是立即更新）；eagerState 相同则跳过。（25 秒）
5. **回扣**：对象式 action 覆盖、函数式 action 累加，所以连续 `+1` 要用函数式。（15 秒）

### 口述参考

> useState 的状态不在闭包里，而在函数组件对应的 fiber 上。fiber.memoizedState 指向一条 hook 单向链表，每个 useState 在链表上有一个节点，渲染时按调用顺序一一对应，这也是为什么 Hook 不能条件调用。
>
> mount 的时候会创建一个 hook 节点，把初始值放进去，同时建一个更新队列 queue，并且生成一个 dispatch 函数。这个 dispatch 在后续渲染里引用是不变的，所以它可以安全地不进依赖数组。初始值如果传函数，只会在 mount 时执行一次，可以做惰性初始化。
>
> update 的时候，useState 其实是 useReducer 的特例，reducer 是 basicStateReducer：action 是函数就用它算，不是函数就直接替换。这一句能解释两件事：为什么 setX(value) 是覆盖，为什么 setX(fn) 能拿到最新值。
>
> 调 dispatch 的时候并不会立刻改 state，而是创建一个 update 挂到 queue 的环形链表上，然后调度一次渲染。这里有个 eagerState 优化：如果没有待处理的更新，React 会提前算出新 state，如果和当前相同，就直接跳过渲染。
>
> 所以连续三次 setN(n+1)，三个 action 都是常量 1，最后只加一；写成函数式才会在渲染时依次累加。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| `useState` 返回数组而不是对象？ | 可以自由重命名（`const [count, setCount]`），且比对象字面量略省；本质是元组 |
| `setState` 的 dispatch 引用稳定吗？ | 稳定。同一 fiber 内不变，因此不需要放进依赖数组 |
| 为什么 `setN(0)` 有时不触发渲染？ | eagerState：新值与当前值 `Object.is` 相等且无 pending 更新 → bail out |
| 同一事件里 `setN(n+1)` 三次为什么只 +1？ | 三个 action 都是"替换为 n+1"（n 是同一快照），渲染时依次执行都被覆盖 |
| 渲染时 state 是怎么算出来的？ | 从 `hook.baseState` 出发，沿 update 环形链表依次执行 action，按 lane 过滤优先级，结果存入 `memoizedState` |
| 为什么 `useState` 能触发重渲染？ | dispatch 里调用 `scheduleUpdateOnFiber`，把 fiber 标记 lane 后交给 Scheduler |
| `useState` 的值是不可变的吗？ | 变量本身是 `const`，是那一次渲染的快照；要改只能通过 setter 产生新值 |

### 加分点与易错点

- ✅ **加分**：说出 `useState = useReducer + basicStateReducer`；说出环形链表与 eagerState。
- ⚠️ **易错**：说"setState 会立即改变 state"——不会，它只是入队并调度。
- ⚠️ **易错**：说"state 存在闭包里"——闭包只是读到快照，真值在 fiber 上。
- ⚠️ **易错**：说"dispatch 每次渲染都新建"——引用稳定，这正是它能省略依赖的原因。

---

## 4.4 useState 有什么不足？什么场景该用 useReducer？

> 原题：**25.**「useReducer 适合复杂状态逻辑，多个 action 操作。useState 简单状态。」
> **81.**「复杂状态用 useState 要写多个 setState，useReducer 集中管理 action。」

方向对，但需要给出**判断标准**，否则回答会很空。面试官真正想听的是"你什么时候会主动选 useReducer"。

### 核心原理

**① useState 的四个不足**

| 不足 | 表现 |
|---|---|
| **状态分散** | 一个表单 6 个字段 → 6 个 useState + 6 个 setter，联动时要在多个 setter 之间传值 |
| **更新逻辑散落** | 校验规则、联动规则散落在各个事件处理函数里，"状态怎么变的"无法一处看清 |
| **易漏函数式更新** | 多个字段依赖彼此的前值，容易写成基于旧快照计算 |
| **难以测试/回放** | 状态迁移没有单一入口，单测只能测组件行为，无法直接测"状态机" |

**② useReducer 的模型**

```js
const [state, dispatch] = useReducer(reducer, initialState);
// reducer: (state, action) => newState  —— 纯函数，无副作用
```

**③ 判断标准（记这张表就够了）**

| 场景 | 选择 |
|---|---|
| 状态之间**互相依赖**（改 A 要连带改 B、C） | `useReducer` |
| 状态字段多（≥4）且属于同一业务实体 | `useReducer`（或用表单库） |
| 有明确的"状态迁移"语义（draft → submitted → approved） | `useReducer`（状态机） |
| 需要**记录/重放**操作序列（撤销、协同、埋点） | `useReducer`（action 天然是日志） |
| 下一个状态依赖上一个状态，且逻辑复杂 | `useReducer` |
| 单个独立布尔/字符串/数字 | `useState` |
| 状态更新逻辑只有一行 | `useState` |

**④ 改写示例（第 81 题要的"如何改写"）**

```jsx
// ❌ useState：三个字段 + 联动，逻辑散落
const [loading, setLoading] = useState(false);
const [data, setData] = useState(null);
const [error, setError] = useState(null);

const load = async () => {
  setLoading(true); setError(null);
  try { setData(await api()); }
  catch (e) { setError(e); }
  finally { setLoading(false); }
};
```

```jsx
// ✅ useReducer：状态迁移集中，非法组合不可能出现
function reducer(state, action) {
  switch (action.type) {
    case 'LOADING': return { status: 'loading', data: null, error: null };
    case 'SUCCESS': return { status: 'success', data: action.data, error: null };
    case 'ERROR':   return { status: 'error', data: null, error: action.error };
    default: throw new Error('unknown action: ' + action.type);
  }
}
const [state, dispatch] = useReducer(reducer, { status: 'idle', data: null, error: null });
```

注意这里的关键收益：`status` 用一个枚举代替了 `loading/data/error` 三个布尔组合，**"loading 且有 data"这种非法状态在类型层面就不存在了**。这是比"少写几个 setState"更重要的理由。

**⑤ 关键副作用：`dispatch` 引用稳定**

`dispatch` 在组件的生命周期内引用不变，可以安全地传给子组件、放进依赖数组，不会导致 `memo` 失效。而回调函数（`load`）每次渲染都新建，需要 `useCallback` 包。这是选 `useReducer` 的一个隐性优势。

### 答题思路与要点顺序

1. **先答"不足"**：状态分散、逻辑散落、易漏函数式更新、难测试。（20 秒）
2. **给判断标准**：状态互相依赖 / 字段多 / 有迁移语义 / 需要日志回放 → useReducer。（25 秒）
3. **给改写示例**：loading/data/error → status 枚举，强调"消除非法状态"。（25 秒）
4. **补一个优势**：dispatch 引用稳定，便于 memo 与依赖管理。
5. **收尾**：两者不是替代关系，useState 本身就是 useReducer 的特例。

### 口述参考

> useState 的不足我觉得主要是四个。一是状态分散，一个表单六七个字段就是六七个 setState，联动的时候要在几个 setter 之间传值；二是更新逻辑散落在各个事件处理里，看代码说不清"状态是怎么变的"；三是容易漏函数式更新；四是没法单独测状态迁移，只能测组件行为。
>
> 我会在几种情况下换成 useReducer：状态之间互相依赖，改一个要连带改别的；字段多且属于同一个业务实体；有明确的迁移语义，比如草稿到已提交到已通过；还有需要记录或重放操作序列的时候，因为 action 本身就是日志。
>
> 举个例子，加载状态我原来用 loading、data、error 三个 useState，会写出 loading 为 true 同时又有 data 这种非法组合。换成 useReducer 之后，用 status 枚举加 data 和 error，非法状态在结构上就不存在了，reducer 里每个 action 对应一个完整的下一状态。
>
> 还有个隐性好处是 dispatch 的引用是稳定的，可以放心传给子组件或者放进依赖数组，不会让 memo 失效。当然简单状态还是 useState，它本来就是 useReducer 的特例。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| useReducer 能替代 Redux 吗？ | 不能。它没有全局 store、没有中间件、没有 DevTools 时间旅行、不能跨组件树共享（除非配 Context，但更新粒度仍粗） |
| useReducer + Context 就是 Redux 吗？ | 差得远：缺中间件、选择器、不可变工具、时间旅行调试；而且 Context 变化会让所有消费者重渲染 |
| reducer 必须是纯函数吗？ | 必须是。并发下会重复执行，且有 StrictMode 双调用；异步逻辑放 effect 或中间件 |
| `dispatch` 稳定有什么实际价值？ | 可以省略 `useCallback`，可以作为 effect 依赖，可以传给 `memo` 子组件而不破坏浅比较 |
| 什么时候两个都用？ | 常见组合：`useReducer` 管核心状态机，`useState` 管 UI 局部开关（如弹窗开合） |
| 状态太多怎么办？ | 拆组件（状态下沉）、用表单库（react-hook-form）、或用状态库；不要把所有状态堆在一个 reducer 里 |

### 加分点与易错点

- ✅ **加分**：用"消除非法状态"论证 useReducer 的价值（而不是"少写代码"）；说出 `dispatch` 稳定这个隐性优势。
- ⚠️ **易错**：说"状态复杂就用 useReducer"——复杂是模糊词，要给具体判据。
- ⚠️ **易错**：在 reducer 里发请求 / 打日志 / 改外部变量（不是纯函数，并发下会出问题）。

---

## 4.5 React 常用的 Hooks 有哪些？

> 原题：**54.**「useState/useEffect/useMemo/useCallback/useRef/useContext/useReducer。」

这题是"送分题"，但也是"分层题"——只答 7 个是及格，能按"基础 / 并发 / 冷门"分层并各给一句用途，才是加分。

### 核心原理

**① 基础 7 个（必须全会）**

| Hook | 用途 | 一句话记忆 |
|---|---|---|
| `useState` | 组件状态 | 最基础的"可变快照" |
| `useEffect` | 副作用（绘制后异步） | 同步外部系统 |
| `useLayoutEffect` | 副作用（绘制前同步） | 读布局、防闪烁 |
| `useRef` | 可变容器 / DOM 引用 | 改了不触发渲染 |
| `useMemo` | 缓存计算结果 | 省计算 |
| `useCallback` | 缓存函数引用 | 稳引用，配合 memo |
| `useContext` | 读取 Context | 跨层级取值 |

**② 进阶（结构相关）**

| Hook | 用途 |
|---|---|
| `useReducer` | 复杂状态迁移 |
| `useImperativeHandle` | 自定义暴露给父组件的命令式句柄 |
| `useId` | SSR 安全的唯一 ID（`aria-*` 关联） |
| `useSyncExternalStore` | 订阅外部 store，避免并发撕裂 |
| `useInsertionEffect` | CSS-in-JS 注入样式（早于 layout effect） |
| `useDebugValue` | 自定义 Hook 在 DevTools 里显示标签 |

**③ 并发相关（React 18+）**

| Hook | 用途 |
|---|---|
| `useTransition` | 把更新标记为非紧急，返回 `[isPending, startTransition]` |
| `useDeferredValue` | 让某个值延迟跟随，先渲染旧值 |
| `useOptimistic`（19） | 乐观更新（提交前先展示结果） |
| `useActionState`（19） | 表单 action 的状态与错误 |
| `use`（19） | 读 Promise / Context，可在条件中调用 |

**④ 选型速查**

```
要存"会触发渲染"的值        → useState / useReducer
要存"不触发渲染"的值        → useRef
要跨层级传值               → useContext
要算派生值且昂贵            → useMemo
要稳定函数引用             → useCallback
要读写 DOM                 → useRef + (forwardRef)
要暴露命令式 API           → useImperativeHandle
要同步外部系统             → useEffect
要在绘制前同步布局          → useLayoutEffect
要让大列表更新不卡输入       → useTransition / useDeferredValue
要订阅外部 store           → useSyncExternalStore
```

### 答题思路与要点顺序

1. **先给 7 个基础**，每个一句话用途（不要展开，面试官会挑着追问）。（25 秒）
2. **按场景归组**：状态 / 引用 / 上下文 / 性能 / 副作用。（20 秒，比逐个背更有结构）
3. **补并发三个**：`useTransition`、`useDeferredValue`、`useSyncExternalStore`，说清各自解决什么。（25 秒）
4. **点两个冷门**：`useImperativeHandle`、`useInsertionEffect`（展示深度，但别恋战）。
5. **收尾**：说"最常用的是 useState + useEffect + useRef 三个，其他按需"。

### 口述参考

> 常用的可以分三层。
>
> 基础七个：useState 管状态，useEffect 处理副作用在绘制后跑，useLayoutEffect 是绘制前同步跑，useRef 存不触发渲染的值或者拿 DOM，useMemo 缓存计算结果，useCallback 缓存函数引用，useContext 读上下文。
>
> 结构相关还有几个：useReducer 管复杂状态迁移，useImperativeHandle 配合 forwardRef 自定义暴露给父组件的命令式方法，useId 生成 SSR 安全的 ID，useSyncExternalStore 给状态库作者用来订阅外部 store 并避免并发撕裂。
>
> React 18 之后还有并发的：useTransition 和 useDeferredValue，把更新降级成非紧急，典型是搜索框过滤大列表；useInsertionEffect 是给 CSS-in-JS 注入样式用的，时机比 layout effect 更早，比较冷门。
>
> 实际项目里最高频的还是 useState、useEffect、useRef 这三个，其他的按场景取用。我自己判断的标准是：这个值要不要触发渲染，决定 useState 还是 useRef；这段逻辑要不要在绘制前完成，决定 layoutEffect 还是 effect。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| `useRef` 和 `useState` 怎么选？ | 是否需要触发渲染。定时器 id、上一次的值、是否首次渲染、DOM 引用 → ref |
| `useMemo` 和 `useCallback` 关系？ | `useCallback(fn, deps)` ≡ `useMemo(() => fn, deps)`，只是缓存的东西不同 |
| `useContext` 会引起重渲染吗？ | 会。Provider 的 `value` 变化时所有消费者都重渲染，所以 value 要用 `useMemo` 稳定 |
| `useSyncExternalStore` 解决什么问题？ | 并发渲染下外部 store 可能在渲染中途变化导致"撕裂"，它用快照保证同一次渲染读到一致的值 |
| `useInsertionEffect` 什么时候用？ | 只在写 CSS-in-JS 库时用；它比 layout effect 更早，避免样式注入引起的额外样式计算 |
| React 19 的 `use` 有什么特别？ | 可以读 Promise 和 Context，且**可以条件调用**（因为它不是靠顺序存状态的 Hook）——这句很加分 |

### 加分点与易错点

- ✅ **加分**：按"要不要触发渲染/要不要在绘制前"给选型标准；说出 `use` 可以条件调用。
- ⚠️ **易错**：把 `useContext` 说成"状态管理方案"——它只是读取机制，不含写入/订阅优化。
- ⚠️ **易错**：背完清单就停，不给任何使用场景。

---

## 本册自测

1. 不看文档，说出 Hooks 的三条官方动机。
2. 画出 fiber 上的 hook 链表，并解释条件调用为什么会错位。
3. `useState` 和 `useReducer` 的底层关系是什么？
4. 连续三次 `setN(n + 1)` 和三次 `setN(p => p + 1)` 结果分别是什么？为什么？
5. `dispatch` 为什么可以省略依赖数组？
6. 什么信号出现时，你会把 `useState` 改成 `useReducer`？
7. 自定义 Hook 会共享状态吗？给一个反例说明。

<details>
<summary>自测参考答案要点</summary>

1. 复用有状态逻辑难（HOC 嵌套）；生命周期把相关逻辑拆散又混入不相关逻辑；class 对人和机器都不友好。
2. `fiber.memoizedState` 是单向链表，每个 hook 一个节点，靠调用顺序 + 指针索引；条件调用导致某次渲染跳过一个节点，后续 hook 读到前一个节点的 state，数量变化时报 "Rendered fewer hooks than expected"。
3. `useState` 是 `useReducer` 的特例，reducer 为 `basicStateReducer`（action 是函数则执行，否则替换）。
4. 前者结果为 1（三个 action 都是常量「当前快照 n + 1」，互相覆盖），后者为 3（三个函数在渲染时基于最新 state 依次执行）。
5. mount 时创建并绑定到 queue，之后引用不变；它不依赖任何闭包变量。
6. 状态互相依赖、字段多且同属一个实体、有明确状态迁移语义、需要 action 日志/回放。
7. 不共享。两个组件各调一次 `useWindowWidth()`，各自有独立的 state；共享状态需 Context 或外部 store。
</details>
