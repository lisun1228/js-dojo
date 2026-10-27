# React 04｜Hooks 原理与规范

> 覆盖原题：5、7、25、32、39、42、43、54、58、62、75、76、81（13 题 → **5 个考点**）
> 主线：Hook 的存储结构决定调用规则；`useState` 是 `useReducer` 的特例。

---

## 目录

- [本册速查](#本册速查)
- [4.1 React Hooks 解决了什么问题？](#41-react-hooks-解决了什么问题)
- [4.2 为什么 Hook 不能写在条件、循环或嵌套函数里？](#42-为什么-hook-不能写在条件循环或嵌套函数里)
- [4.3 useState 的实现原理是什么？](#43-usestate-的实现原理是什么)
- [4.4 useState 有什么不足？什么场景该用 useReducer？](#44-usestate-有什么不足什么场景该用-usereducer)
- [4.5 React 常用的 Hooks 有哪些？](#45-react-常用的-hooks-有哪些)
- [本册自测](#本册自测)

---

## 本册速查

| 考点 | 合并自 | 一句话答案 |
|---|---|---|
| 4.1 Hooks 解决了什么问题 | 5、42、62 | 让函数组件拥有状态与副作用，并把"复用有状态逻辑"从 HOC 嵌套变成普通函数调用 |
| 4.2 为什么不能条件/循环调用 Hook | 32、39、75、76 | Hook 状态按**调用顺序**存在 fiber 的链表上，顺序一变就全错位 |
| 4.3 useState 的实现原理 | 7、43、58 | mount 建 hook 链表 + 队列；dispatch 入环形链表 + 调度，渲染时再算 |
| 4.4 useState vs useReducer | 25、81 | 状态迁移逻辑复杂/多字段联动 → useReducer；简单独立 → useState |
| 4.5 常用 Hooks 清单 | 54 | 7 个基础 + 6 个结构与工具 + 5 个并发/React 19 |

---

## 4.1 React Hooks 解决了什么问题？

### 三条官方动机

Hooks 的官方动机共三条：

| 动机 | 痛点 | Hooks 的解法 |
|---|---|---|
| **① 复用有状态逻辑很难** | HOC / render props 层层嵌套，DevTools 里是一串 `withXxx(withYyy(...))`，props 来源不清晰 | 自定义 Hook：普通函数，内部可调用其他 Hook，**共享逻辑不共享状态** |
| **② 复杂组件难以理解** | 生命周期按时间拆分同一功能（订阅注册在 didMount、更新在 didUpdate、清理在 willUnmount），又把无关逻辑塞进同一个生命周期 | 按**关注点**聚合：一个 `useEffect` 只做一件事，setup 与 teardown 写在一起 |
| **③ class 对人和机器都不友好** | 需要理解 `this` 绑定；方法名是字符串，难以压缩；HMR 不稳定；编译器难优化 | 普通函数 + 闭包，无 `this`；React Compiler 不支持 class 组件 |

### 函数式特征

| 特征 | 在 React 中的体现 |
|---|---|
| 纯函数 | 组件是 `props → JSX` 的映射，render 阶段不能有副作用 |
| 不可变 | state 更新返回新引用，靠引用比较判断变化 |
| 组合优于继承 | 组件与 Hook 都通过组合复用，没有继承 |
| 副作用隔离 | 副作用显式收进 `useEffect`，与纯计算分离 |

### 自定义 Hook 的边界

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
```

两个组件各调用一次，各自拥有独立的 state。自定义 Hook 复用的是**逻辑**，不是状态；要共享状态得用 Context 或外部 store。

### 追问：动机与复用

| 追问 | 应答要点 |
|---|---|
| Hook 能替代 HOC 吗？ | 逻辑复用基本能替代；HOC 仍适合注入 props、权限包裹、埋点等结构性场景 |
| Hooks 有什么缺点？ | 依赖数组的心智负担、不能条件调用、class 迁移成本 |
| Hooks 之前怎么复用逻辑？ | mixin（React 不支持）→ HOC → render props → Hooks |
| 为什么 Hooks 不能在 class 里用？ | Hook 依赖渲染期设置的 dispatcher 和 fiber 上的 hook 链表，class 组件没有这两个前提 |
| 为什么自定义 Hook 要以 `use` 开头？ | 官方约定，`eslint-plugin-react-hooks` 靠它识别并检查调用位置 |

---

## 4.2 为什么 Hook 不能写在条件、循环或嵌套函数里？

### hook 链表与指针

函数组件的 fiber 用 `memoizedState` 指向一条单向 hook 链表：

```
fiber.memoizedState
      ↓
hook① (useState) → hook② (useEffect) → hook③ (useRef) → null
```

节点没有名字，React 渲染时用 `currentHook` 指针按调用顺序读取：第 n 次调用读第 n 个节点。

### 条件调用为什么错位

```jsx
function Foo({ show }) {
  const [a] = useState(0);          // hook 1
  if (show) {
    const [b] = useState('x');      // show=true 时是 hook 2
  }
  const [c] = useState(true);       // show=false 时是 hook 2
}
```

| 渲染 | `show` | 实际调用链 | `c` 读到的节点 |
|---|---|---|---|
| 第 1 次 | `true` | a → b → c | 第 3 个（`true`） |
| 第 2 次 | `false` | a → c | 第 2 个（`'x'`），即上次 `b` 的 state |

hook 顺序或数量变化时，React 开发期会报错，关键信息如下：

```
React has detected a change in the order of Hooks called by Foo.
This will lead to bugs and errors if not fixed.
Rendered fewer hooks than expected. This may be caused by an accidental early return statement.
```

### 两条规则

1. **只在顶层调用**：不在条件、循环、嵌套函数、`try/catch/finally` 中调用，也不在提前 return 之后调用。
2. **只在函数组件或自定义 Hook 中调用**：自定义 Hook 以 `use` 开头，便于 lint 识别。

提前 return 只要发生在所有 Hook 之后是安全的。

### 正确写法

```jsx
// ❌ 条件调用 Hook
if (isLogin) {
  const [user, setUser] = useState(null);
}

// ✅ 条件放进 Hook 内部
const [user, setUser] = useState(null);
useEffect(() => {
  if (!isLogin) return;
  fetchUser().then(setUser);
}, [isLogin]);

// ✅ early return 放在所有 Hook 之后
const [a] = useState(0);
useEffect(() => {}, []);
if (!data) return <Loading />;

// ✅ 整套逻辑有条件启用：Hook 无条件调用，参数控制行为
function Panel({ mode }) {
  useSomeFeature(mode === 'advanced');
}
```

### 追问：调用规则

| 追问 | 应答要点 |
|---|---|
| Hook 为什么不用名字索引？ | 变量名在压缩、解构、重复命名后都不可靠，顺序索引不依赖名字 |
| early return 一定不行吗？ | 只要所有 Hook 都在 return 之前调用完即可 |
| 循环里调 Hook 为什么不行？ | 循环次数变化会改变 hook 数量，导致错位；循环场景用「列表 + 子组件」 |
| 两个条件分支各调一个 Hook、数量不变可以吗？ | 不行。节点身份仍会错位，顺序变化同样致命 |
| 放在 `try/catch` 里为什么不行？ | 异常路径可能跳过部分 Hook，调用顺序改变 |
| 有 lint 兜底吗？ | `eslint-plugin-react-hooks` 的 `rules-of-hooks` 做静态检查 |
| 顺序坏了 React 会怎样？ | 开发期报错；这些检查只在开发期执行 |

---

## 4.3 useState 的实现原理是什么？

### mount：建节点与队列

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

- state 存在 hook 节点的 `memoizedState` 上；闭包读到的是那次渲染的快照。
- 初始值传函数时，只在初始化阶段用它计算 state；StrictMode 开发期会调用两次。
- `dispatch` 在 mount 时创建，并绑定到 `queue`。
- 新节点挂在链表尾部。

### update：useReducer 的特例

```js
function updateState(initialState) {
  return updateReducer(basicStateReducer, initialState);
}

function basicStateReducer(state, action) {
  return typeof action === 'function' ? action(state) : action;
}
```

`useState` 就是 reducer 为 `basicStateReducer` 的 `useReducer`：

- `setX(fn)`：action 是函数，渲染时以最新 state 为入参执行；
- `setX(value)`：action 不是函数，直接替换。

### dispatch：入队与调度

```js
function dispatchSetState(fiber, queue, action) {
  const update = { lane, action, hasEagerState: false, eagerState: null, next: null };
  // 环形链表入队：queue.pending 指向最后一个 update，pending.next 指向第一个
  enqueueUpdate(queue, update);
  scheduleUpdateOnFiber(fiber, lane);   // 只调度，不立即渲染
}
```

eagerState：没有待处理的更新时，React 先用 reducer 算出新 state；若与当前 state `Object.is` 相等，则 bail out，跳过调度。官方文档补充：某些情况下 React 仍可能先调用一次组件，再跳过子组件渲染与 effect。

```jsx
const [n, setN] = useState(0);
setN(0);   // 与当前值相同，通常不会产生可见更新
```

### 环形链表

```
queue.pending ──▶ update③ ──▶ update① ──▶ update② ──┐
                    ▲                                │
                    └────────────────────────────────┘
        pending 始终指向最后一个，pending.next 是第一个
```

插入是 O(1)，同时能直接拿到第一个节点开始遍历。

### 批处理下的合并

```jsx
setN(n + 1);   // action = 1（基于同一次渲染的快照 n = 0）
setN(n + 1);   // action = 1
setN(n + 1);   // action = 1
// 三个 action 都是「替换为 1」→ 最终 n = 1

setN(p => p + 1);
setN(p => p + 1);
setN(p => p + 1);
// 渲染时依次执行：0 → 1 → 2 → 3
```

对象式 action 是常量，函数式 action 是计算；连续更新依赖前一次结果时必须用函数式。

### 追问：useState 实现

| 追问 | 应答要点 |
|---|---|
| `useState` 返回数组而不是对象？ | 可以自由重命名；返回的是两项数组 |
| `dispatch` 引用稳定吗？ | 稳定，同一 fiber 内不变，因此不必放进依赖数组 |
| `setX` 会立即改变 state 吗？ | 不会，只是入队并调度，渲染时才计算新值 |
| 为什么 `setN(0)` 有时不触发渲染？ | eagerState 与当前值 `Object.is` 相等且无 pending 更新 → bail out |
| 同一事件里三次 `setN(n + 1)` 为什么只加 1？ | 三个 action 都基于同一个快照，最终都是「替换为 1」 |
| 渲染时 state 怎么算出来？ | 从 `hook.baseState` 出发，沿 update 环形链表执行 action，按 lane 过滤优先级，结果写入 `memoizedState` |
| 为什么能触发重渲染？ | dispatch 调 `scheduleUpdateOnFiber`，标记 lane 后交给 Scheduler |

---

## 4.4 useState 有什么不足？什么场景该用 useReducer？

### useState 的四个不足

| 不足 | 表现 |
|---|---|
| **状态分散** | 一个表单 6 个字段 → 6 个 `useState` + 6 个 setter，联动时要在 setter 之间传值 |
| **更新逻辑散落** | 校验、联动规则散落在事件处理函数里，状态迁移无法集中查看 |
| **易漏函数式更新** | 多字段依赖前值时，容易基于旧快照计算 |
| **难以测试/回放** | 没有单一的状态迁移入口，只能测组件行为 |

### useReducer 模型

```js
const [state, dispatch] = useReducer(reducer, initialState);
// reducer: (state, action) => newState，纯函数
```

### 选择判据

| 场景 | 选择 |
|---|---|
| 状态互相依赖（改 A 要连带改 B、C） | `useReducer` |
| 字段多（≥4）且属于同一业务实体 | `useReducer`（或用表单库） |
| 有明确的状态迁移（draft → submitted → approved） | `useReducer` |
| 需要记录/重放操作序列（撤销、协同、埋点） | `useReducer`（action 即日志） |
| 单个独立布尔/字符串/数字，或更新只有一行 | `useState` |

`dispatch` 可以直接作为 effect 依赖，或传给 `memo` 子组件而不破坏浅比较，不需要再包一层 `useCallback`。

### 改写：用 status 枚举消除非法状态

```jsx
// ❌ 三个独立 state，可能出现 loading=true 且 data 非空
const [loading, setLoading] = useState(false);
const [data, setData] = useState(null);
const [error, setError] = useState(null);

const load = async () => {
  setLoading(true);
  setError(null);
  try { setData(await api()); }
  catch (e) { setError(e); }
  finally { setLoading(false); }
};

// ✅ 一个 status 枚举，非法组合在结构上不存在
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

`status` 用一个枚举代替 `loading/data/error` 的组合，"loading 且有 data"这类非法状态在结构上就不存在。

### 追问：useState vs useReducer

| 追问 | 应答要点 |
|---|---|
| useReducer 能替代 Redux 吗？ | 不能：没有全局 store、中间件、DevTools 时间旅行；跨组件树共享需配 Context，更新粒度仍粗 |
| useReducer + Context 等于 Redux 吗？ | 不等：缺中间件、选择器、不可变工具、时间旅行；Context 变化会让所有消费者重渲染 |
| reducer 必须是纯函数吗？ | 必须。StrictMode 开发期会把 reducer 调用两次；请求、日志、改外部变量都会重复执行 |
| 什么时候两个都用？ | `useReducer` 管核心状态机，`useState` 管 UI 局部开关 |
| 状态太多怎么办？ | 拆组件（状态下沉）、用表单库或状态库，不要把全部状态堆进一个 reducer |

---

## 4.5 React 常用的 Hooks 有哪些？

### 基础 7 个

| Hook | 用途 | 记忆点 |
|---|---|---|
| `useState` | 组件状态 | 可变快照 |
| `useEffect` | 副作用，通常在绘制后异步执行 | 同步外部系统 |
| `useLayoutEffect` | 副作用，绘制前同步执行 | 读布局、防闪烁 |
| `useRef` | 可变容器 / DOM 引用 | 改了不触发渲染 |
| `useMemo` | 缓存计算结果 | 省计算 |
| `useCallback` | 缓存函数引用 | 稳引用，配合 memo |
| `useContext` | 读取 Context | 跨层级取值 |

### 结构与工具

| Hook | 用途 |
|---|---|
| `useReducer` | 复杂状态迁移 |
| `useImperativeHandle` | 自定义暴露给父组件的命令式句柄 |
| `useId` | SSR 安全的唯一 ID（`aria-*` 关联） |
| `useSyncExternalStore` | 订阅外部 store |
| `useInsertionEffect` | CSS-in-JS 注入样式（写库时用） |
| `useDebugValue` | 自定义 Hook 在 DevTools 里显示标签 |

### 并发与 React 19

| Hook | 用途 |
|---|---|
| `useTransition` | 把更新标记为非紧急，返回 `[isPending, startTransition]` |
| `useDeferredValue` | 让某个值延迟跟随，先渲染旧值 |
| `useOptimistic`（19） | 乐观更新（提交前先展示结果） |
| `useActionState`（19） | 表单 action 的状态与错误 |
| `use`（19） | 读 Promise / Context；不是 Hook |

### 选型速查

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

选型先问两件事：这个值要不要触发渲染（决定 `useState` 还是 `useRef`）；这段逻辑要不要在绘制前完成（决定 `useLayoutEffect` 还是 `useEffect`）。

### 追问：Hooks 清单

| 追问 | 应答要点 |
|---|---|
| `useRef` 和 `useState` 怎么选？ | 是否需要触发渲染：定时器 id、上一次的值、DOM 引用 → ref |
| `useMemo` 和 `useCallback` 关系？ | `useCallback(fn, deps)` 等价于 `useMemo(() => fn, deps)` |
| `useContext` 会引起重渲染吗？ | 会；Provider 的 `value` 变化时所有消费者重渲染，value 常用 `useMemo` 稳定 |
| `useSyncExternalStore` 解决什么？ | 并发渲染下外部 store 可能在渲染中途变化导致撕裂；它用快照保证同一次渲染读到一致的值 |
| `useInsertionEffect` 何时用？ | 写 CSS-in-JS 库时；它在 DOM 变更前注入样式，早于 layout effect |
| React 19 的 `use` 有什么特别？ | 可读 Promise 与 Context；官方明确它不是 Hook，可以条件调用、可在循环里调用 |

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
2. `fiber.memoizedState` 是单向链表，每个 hook 一个节点，靠调用顺序 + 指针索引；条件调用导致某次渲染跳过一个节点，后续 hook 读到前一个节点的 state；数量减少时报 "Rendered fewer hooks than expected"。
3. `useState` 是 `useReducer` 的特例，reducer 为 `basicStateReducer`（action 是函数则执行，否则替换）。
4. 前者为 1（三个 action 都是常量「当前快照 n + 1」，互相覆盖），后者为 3（三个函数在渲染时基于最新 state 依次执行）。
5. mount 时创建并绑定到 queue，之后引用不变；它不依赖任何闭包变量。
6. 状态互相依赖、字段多且同属一个实体、有明确状态迁移语义、需要 action 日志/回放。
7. 不共享。两个组件各调一次 `useWindowWidth()`，各自有独立的 state；共享状态需 Context 或外部 store。
</details>
