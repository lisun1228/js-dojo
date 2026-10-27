# React 05｜状态管理与数据流

> 覆盖原题：3、12、13、31、36、60、65、67、70（9 题 → **6 个考点**）
> 主线：状态放在哪 → 怎么改 → 怎么跨组件共享 → 怎么在大型应用里管住它。

---

## 目录

- [本册速查](#本册速查)
- [5.1 setState 是同步还是异步？](#51-setstate-是同步还是异步)
- [5.2 为什么 setState 要传函数？什么时候必须传函数？](#52-为什么-setstate-要传函数什么时候必须传函数)
- [5.3 什么是状态提升？](#53-什么是状态提升)
- [5.4 Context 有什么用？能替代 Redux 吗？](#54-context-有什么用能替代-redux-吗)
- [5.5 Redux 的原理是什么？单向数据流是怎样的？](#55-redux-的原理是什么单向数据流是怎样的)
- [5.6 Redux 中间件的原理是什么？](#56-redux-中间件的原理是什么)
- [本册自测](#本册自测)

---

## 本册速查

| 考点 | 合并自 | 一句话答案 |
|---|---|---|
| 5.1 setState 是同步还是异步 | 3、60、70 | 调用同步、渲染时生效；React 18 起默认自动批处理 |
| 5.2 setState 为什么传函数 | 36 | 对象式替换常量，函数式基于最新 state 计算 |
| 5.3 状态提升 | 65 | 提到最近公共父组件，props 下行 + 回调上行 |
| 5.4 Context | 12 | 跨层级传值；value 变化使所有消费者重渲染，不是状态管理方案 |
| 5.5 Redux 原理与单向数据流 | 13、67 | 单一 store + 纯 reducer + 订阅通知，数据单向流动 |
| 5.6 Redux 中间件原理 | 31 | compose 串起 dispatch 链，每层可改写、延迟或吞掉 action |

---

## 5.1 setState 是同步还是异步？

### 原答案的问题

「原生事件和 `setTimeout` 中是同步的」：

- 在 **React 17 及以前**（`ReactDOM.render`）成立；
- 在 **React 18+（`createRoot`）不成立**：自动批处理覆盖 `setTimeout`、Promise、原生事件，以及 `await` 之后的更新。

「同步/异步」的说法本身不准确。准确表述：

> `setState` 的调用是同步的，但不立即修改 `this.state`；更新入队并触发调度。「是否批量」决定调度几次，而不是同步还是异步。

### 核心原理

| 问题 | 答案 |
|---|---|
| `setState` 调用本身同步吗？ | 同步。函数立刻返回，update 立刻入队 |
| `this.state` 会立刻变吗？ | 不会。读到的是本次渲染的快照，下一次 render 才更新 |
| 连续多次 `setState` 渲染几次？ | React 18 起：同一事件/同一 tick 内合并为一次；17 及以前只在 React 事件/生命周期内合并 |

```
setState(x) → 入队 update → scheduleUpdateOnFiber → Scheduler 安排 → 下一次 render 计算新 state
```

中间隔着「调度」，所以 `setState` 的下一行读到的还是旧值：这是「延迟生效」，不是「异步」。

```jsx
// React 17（ReactDOM.render）：渲染 2 次
setTimeout(() => {
  setCount(c => c + 1);
  setCount(c => c + 1);
}, 0);

// React 18（createRoot）：渲染 1 次
setTimeout(() => {
  setCount(c => c + 1);
  setCount(c => c + 1);
}, 0);
```

React 17 的批处理依赖「当前是否在 React 事件/生命周期内」的执行上下文标记（`executionContext` 的 `BatchedContext` 位）。`setTimeout` 回调执行时该标记不在，每次 `setState` 都直接 flush。

React 18 起，批处理不再以「是否在 React 事件上下文中」为条件：更新先入队，由 React 统一调度合并，与更新发生的位置无关。

批处理的作用：

- 减少渲染次数；
- 保证同一次渲染内的 state 一致，避免「第一行改了先渲染一次半成品」的中间态。

### 需要立即读取更新后的 DOM

```jsx
import { flushSync } from 'react-dom';

flushSync(() => {
  setCount(c => c + 1);
});
// 这里 DOM 已更新
```

`flushSync` 放弃批处理，同步走完 render + commit；代价是可能额外渲染、阻塞绘制，只在测量、对接非 React 库等必须同步读 DOM 的场景使用。

**面试口述要点**

- 先纠正问法：不是同步/异步，而是「调用同步、渲染时生效、是否批处理」。
- 机制：更新入队 → 调度 → 下一次 render 才计算新 state。
- 版本差异：17 只在 React 事件/生命周期内批处理；18 默认自动批处理，`setTimeout`、Promise、原生事件都覆盖。
- 逃生舱：`flushSync` 强制同步 render + commit，代价是放弃批处理。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| class 的 `setState` 第二个参数是什么？ | 回调，在更新应用、DOM 更新后执行；函数组件用 `useEffect` 达到同样效果 |
| React 18 的自动批处理有无例外？ | 有：`flushSync` 内部同步刷新；不同 React root 的更新各自调度 |
| 为什么并发模式下批处理更重要？ | 每次渲染都可能被中断重做，渲染次数越多，浪费越大 |
| `this.setState({})` 空对象会渲染吗？ | 会调度一次渲染；`PureComponent` 因浅比较相等会跳过 |

---

## 5.2 为什么 setState 要传函数？什么时候必须传函数？

### 核心原理

**① 两种 action**

```js
setCount(count + 1);        // action = 数字（常量），渲染时「替换」
setCount(prev => prev + 1); // action = 函数，渲染时以最新 state 为入参执行
```

**② 丢更新的全过程**

```jsx
// count = 0，一次点击里连续三次
setCount(count + 1);  // action = 0 + 1 = 1
setCount(count + 1);  // action = 0 + 1 = 1   ← count 还是那次渲染的快照 0
setCount(count + 1);  // action = 0 + 1 = 1
// 渲染时依次执行三个 action：1 → 1 → 1，最终 1
```

```jsx
setCount(p => p + 1);  // 渲染时：0 → 1
setCount(p => p + 1);  // 渲染时：1 → 2
setCount(p => p + 1);  // 渲染时：2 → 3，最终 3
```

关键：**`count` 是那次渲染的闭包常量，三次调用读到的是同一个值**；`p` 是 React 在渲染时传入的最新值。

**③ 必须用函数式的四种场景**

| 场景 | 例子 |
|---|---|
| **新值依赖旧值** | 计数器、累加、toggle 取反（`setOpen(o => !o)`） |
| **同一事件内多次更新同一状态** | 批量 `+1`、批量为列表项打勾 |
| **异步回调里更新** | `setTimeout`、`Promise.then`、事件监听里的闭包已过期 |
| **在 `useEffect` 空依赖里更新** | 闭包永远是首次渲染的值 |

**④ 不需要函数式的场景**

```jsx
setName(e.target.value);  // 完全由输入决定，与旧值无关
setLoading(true);         // 常量
setList(res.data);        // 直接替换
```

判断标准：**「我要设成什么」还是「在原来基础上改」**，后者用函数式。

**⑤ 底层原因**

`useState` 复用 `useReducer(basicStateReducer)`：

```js
function basicStateReducer(state, action) {
  return typeof action === 'function' ? action(state) : action;
}
```

非函数 action → 直接替换；函数 action → 用最新 state 执行。这就是函数式更新能拿到最新值的全部秘密。

**面试口述要点**

- 对象式传「值」，函数式传「计算」。
- 三次 `setCount(count + 1)` 都读到同一快照，结果是 1；函数式依次以最新值执行，结果是 3。
- 底层是 `basicStateReducer`：是函数就执行，不是就替换。
- 判断标准：设成某个值直接传；在原来基础上改就传函数，异步回调和空依赖 effect 尤其如此。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| class 组件里也有这个问题吗？ | 有。`this.setState({ n: this.state.n + 1 })` 同样丢更新，改 `this.setState(s => ({ n: s.n + 1 }))` |
| 函数式更新会不会执行多次？ | 会。StrictMode 开发模式会调用两次以校验纯度；并发渲染也可能重放，所以 updater 必须是纯函数 |
| 对象式更新一定是「覆盖」吗？ | class 的 `setState` 是**浅合并**（`Object.assign`），不是整体替换；`useState` 才是整体替换 |
| 为什么函数式更新是「幂等安全」的？ | 它只依赖入参、不依赖外部快照，重复执行结果一致（前提是纯函数） |
| `setX(prev => { prev.a = 1; return prev })` 可以吗？ | 不行。原地修改让引用不变，可能被 bail out，也违反不可变原则 |

---

## 5.3 什么是状态提升？

### 核心原理

**定义**：两个兄弟组件需要共享同一份状态时，把这份状态提到它们最近的公共父组件，父组件通过 props 下发数据、通过回调接收变更请求。

```jsx
function Parent() {
  const [value, setValue] = useState('');
  return (
    <>
      <Input value={value} onChange={setValue} />
      <Preview value={value} />
    </>
  );
}
```

**收益与代价**：

| 收益 | 代价 |
|---|---|
| 单一数据源，状态不会出现两份不一致的副本 | props drilling（层级深时要一路传） |
| 状态变化路径唯一，易调试 | 父组件重渲染会带动所有子组件（需 memo） |
| 兄弟通信不需要事件总线 | 状态被「放大」，职责可能变模糊 |

**「状态该放哪」的三条判据**：

1. **能放在组件内部就放内部**（最小作用域）；
2. **需要被多个兄弟共享时，提到最近公共父级**；
3. **需要跨多层/全局共享时，才用 Context 或状态库**（见 5.4、5.5）。

**面试口述要点**

- 定义与数据流：兄弟共享 → 提到最近公共父级，props 下行 + 回调上行，父级是唯一数据源。
- 收益：单一数据源，避免副本不一致。
- 代价：props drilling；父级重渲染带动子树，需要 memo 或拆分子组件。
- 判据：能下沉就下沉，需要共享才提升，跨多层才用 Context 或状态库。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 提升到多高？ | 最近公共父级（LCA）。再高就是过度提升 |
| 提升后父组件重渲染怎么办？ | 拆分子组件 + `memo`；把状态下沉到真正使用它的子树；或用 Context 分片 |
| 什么时候不该提升？ | 状态只属于某个组件（如输入框草稿）、提升会导致无关组件重渲染、提升后父组件职责混乱 |
| 状态提升 vs 状态机（Redux）？ | 前者是组件内数据流，后者是应用级单一 store；规模不同，前者适合局部共享 |

---

## 5.4 Context 有什么用？能替代 Redux 吗？

### 核心原理

**① 三件套**

```jsx
const ThemeContext = createContext('light');   // 默认值只在没有 Provider 时生效

<ThemeContext.Provider value={theme}>
  <DeepChild />
</ThemeContext.Provider>

const theme = useContext(ThemeContext);
```

**② 解决的是什么**

不是「状态管理」，而是**「跨层级传值」**：把数据和组件层级解耦，中间组件不需要知道这个值存在。

```
props drilling:  App → Layout → Sidebar → Menu → Item（每层都要写 props）
Context:         App ─Provider─→ ... → Item（直接 useContext）
```

**③ 更新机制与性能陷阱**

Provider 的 `value` 变化时，**所有调用 `useContext` 的消费者都会重渲染**，层级多深都一样，`memo` 挡不住。

```jsx
// ❌ 每次渲染都新建对象，value 引用变化 → 所有消费者重渲染
<Ctx.Provider value={{ user, setUser }}>

// ✅ 稳定引用
const value = useMemo(() => ({ user, setUser }), [user]);
<Ctx.Provider value={value}>
```

常见优化手段：

| 手段 | 说明 |
|---|---|
| `useMemo` 包 value | 避免「对象字面量每次都变」 |
| **拆分 Context** | 读的值和写的方法分两个 Context，只读组件不会因为方法变化而重渲染 |
| 状态下沉 | Provider 尽量靠近消费者，缩小影响范围 |
| 配 `useReducer` | `dispatch` 引用稳定，可以单独放一个 Context |

**④ Context 不能替代 Redux 的五点**

| 能力 | Context | Redux |
|---|---|---|
| 中间件（异步/日志） | ❌ | ✅ |
| 选择器（只订阅部分 state） | ❌（value 一变全变） | ✅（`useSelector` + 比较函数） |
| DevTools 时间旅行 | ❌ | ✅ |
| 更新粒度 | Provider 级 | action + selector 级 |
| 跨组件写操作 | 要自己传 setter | dispatch 统一入口 |

定位：**Context 是「依赖注入」，Redux 是「状态管理 + 数据流约束」**。react-redux 也用 Context 把 store 传给组件树。

**面试口述要点**

- 定义与用法：跨层级传值，跳过中间层；`createContext` / `Provider` / `useContext` 三件套。
- 性能：value 变化 → 所有消费者重渲染，memo 挡不住；用 `useMemo` 稳引用、拆分读写 Context、让 Provider 靠近消费者。
- 不能替代 Redux：缺中间件、缺选择器、缺时间旅行，更新粒度是 Provider 级。
- 定位：依赖注入，不是状态管理；react-redux 内部也用 Context 传 store。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 多个 Provider 嵌套顺序？ | 内层覆盖外层；可以嵌套多个不同 Context |
| Context 适合放什么？ | 主题、locale、当前用户、dispatch、全局配置——**变化频率低**的值 |

---

## 5.5 Redux 的原理是什么？单向数据流是怎样的？

### 核心原理

**① 三个原则**

| 原则 | 含义 |
|---|---|
| **单一数据源** | 整个应用一个 store，一个 state 树 |
| **state 只读** | 唯一改法是 dispatch action；不能直接赋值 |
| **用纯函数修改** | reducer 输入旧 state + action，输出新 state，无副作用 |

**② 数据流**

```
    UI（React 组件）
      │  ① dispatch(action)
      ▼
   ┌──────┐   ② reducer(currentState, action)
   │ store│ ─────────────────────────────▶ 新 state
   └──────┘   ◀─────────────────────────────
      │  ③ 保存新 state，通知所有 subscriber
      ▼
   订阅回调（react-redux 的 useSelector 比较选中值）
      │  ④ 值变了 → 触发组件重渲染
      ▼
    UI 更新
```

关键点：数据永远是「单向」的——UI 只能通过 action 表达「发生了什么」，不能直接改 state。

**③ 30 行实现（面试让你手写时的骨架）**

```js
function createStore(reducer, preloadedState) {
  let state = preloadedState;
  let listeners = [];

  const getState = () => state;

  const dispatch = (action) => {
    state = reducer(state, action);          // 纯函数计算新 state
    listeners.forEach(l => l());             // 通知订阅者
    return action;
  };

  const subscribe = (listener) => {
    listeners.push(listener);
    return () => { listeners = listeners.filter(l => l !== listener); };  // 返回取消订阅
  };

  dispatch({ type: '@@redux/INIT' });        // 初始化，让 reducer 返回初始 state
  return { getState, dispatch, subscribe };
}
```

这是教学简化版：真实签名是 `createStore(reducer, preloadedState?, enhancer?)`；Redux 4.2 起 `createStore` 已标记 deprecated，新项目用 `configureStore`。

**④ 为什么必须不可变**

```js
// ❌ 原地改
state.todos.push(item);  return state;

// ✅ 新引用
return { ...state, todos: [...state.todos, item] };
```

`react-redux` 的 `useSelector` 默认用 `===` 比较选中值。原地改 → 引用不变 → 组件不更新。**不是 Redux 要求不可变，是「引用比较」要求不可变。**

**⑤ Redux Toolkit（RTK）解决了什么**

| 痛点 | RTK 的方案 |
|---|---|
| action type / action creator / switch 样板代码多 | `createSlice` 自动生成 |
| 手写不可变更新麻烦 | 内置 Immer，可以「看起来在改」 |
| store 配置繁琐 | `configureStore` 默认带 devtools、thunk |
| 异步处理零散 | `createAsyncThunk` |

新项目直接用 RTK，不要手写 `createStore`。

**面试口述要点**

- 三原则：单一数据源、state 只读、纯 reducer。
- 数据流：dispatch → reducer → 新 state → 通知订阅者 → `useSelector` 比较选中值 → 重渲染。
- 实现骨架：`getState` / `dispatch` / `subscribe` 三个方法，dispatch 里算新 state 再通知。
- 不可变与 RTK：引用比较决定必须返回新对象；RTK 用 Immer 写不可变更新，`configureStore` 默认带 thunk 和 devtools。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| Redux 和 React 有关系吗？ | 没有强绑定。Redux 是独立库，`react-redux` 才把它接到 React 上 |
| 为什么 reducer 必须是纯函数？ | ① 可预测、可重放（时间旅行）② 并发/StrictMode 下可能重复执行 ③ 同一个 action 序列必然得到同一个 state |
| Redux 会不会过度设计？ | 会。中小项目用 `useState` / `useReducer` / Zustand 更轻；Redux 适合状态复杂、多人协作、需要严格数据流和调试能力的场景 |
| `useSelector` 怎么避免多余重渲染？ | 选最小切片、用 `shallowEqual`、用 `reselect` 做记忆化选择器 |
| Redux 的 state 能放非序列化值吗？ | 不建议（函数、Promise、DOM）。会破坏 devtools 时间旅行与持久化 |

---

## 5.6 Redux 中间件的原理是什么？

### 核心原理

中间件是「可组合的 dispatch 增强器」：用柯里化拿到 store 能力与 `next`，用 `compose` 串成链，在 action 到达 reducer 前拦截。

**① 中间件的形状**

```js
const middleware = ({ getState, dispatch }) => (next) => (action) => {
  // ① 这里可以：读 state、dispatch 别的 action、延迟、改写、吞掉 action
  const result = next(action);   // ② 交给下一个中间件，最终到 reducer
  // ③ 这里可以：拿 result、打日志
  return result;
};
```

三层柯里化的原因：

| 层 | 拿到什么 | 为什么要这一层 |
|---|---|---|
| 第 1 层 | `{ getState, dispatch }` | 注入 store 能力（中间件可以读 state、派发新 action） |
| 第 2 层 | `next` | 拿到「链上的下一环」，实现串联 |
| 第 3 层 | `action` | 真正拦截每次 dispatch |

**② `applyMiddleware` 怎么串起来**

```js
function applyMiddleware(...middlewares) {
  return (createStore) => (reducer, preloadedState) => {
    const store = createStore(reducer, preloadedState);

    let dispatch = () => { throw new Error('Dispatching while constructing middleware'); };

    const middlewareAPI = {
      getState: store.getState,
      dispatch: (...args) => dispatch(...args),   // 闭包引用最终的 dispatch
    };

    const chain = middlewares.map(m => m(middlewareAPI));  // [next => action => {}, ...]
    dispatch = compose(...chain)(store.dispatch);          // 串成一条链

    return { ...store, dispatch };
  };
}
```

`compose` 是 `reduce` 右结合，空链时返回恒等函数：

```js
const compose = (...fns) => fns.reduce((a, b) => (...args) => a(b(...args)), x => x);
// compose(f, g, h)(x) === f(g(h(x)))
```

结果：

```
dispatch(action)
   → mw1 → mw2 → mw3 → store.dispatch（真正的 reducer 调用）
```

**③ 因为 dispatch 被「换掉」了，中间件才能做这些事**

| 能力 | 实现方式 |
|---|---|
| 日志 | `next` 前后各打一次，对比 state |
| 延迟 / 节流 | 不立即 `next`，攒一批再发 |
| **处理函数 action（thunk）** | 判断 `typeof action === 'function'`，是就执行它并传入 `dispatch/getState`，**不往下传** |
| 改写 action | 改完再 `next(newAction)` |
| 吞掉 action | 直接 `return`，不调 `next` |
| 异步流程编排（saga） | 拦截 action，用 generator 管理副作用 |

**④ redux-thunk 的核心逻辑**

```js
const thunk = ({ dispatch, getState }) => (next) => (action) => {
  if (typeof action === 'function') {
    return action(dispatch, getState);
  }
  return next(action);
};
```

**⑤ thunk vs saga**

| | redux-thunk | redux-saga |
|---|---|---|
| 模型 | 函数即 action | generator + effect |
| 适合 | 简单异步、一次性流程 | 复杂流程（竞态、取消、重试、并发编排） |
| 可测试性 | 需要 mock dispatch | effect 是纯描述，易于断言 |
| 学习成本 | 极低 | 较高 |

服务端状态现在更多交给 RTK Query / TanStack Query，中间件主要用于日志、持久化、埋点。

**面试口述要点**

- 本质：可组合的 dispatch 增强器，柯里化 + `compose` 串成链。
- 形状：第一层拿 `{ getState, dispatch }`，第二层拿 `next`，第三层拿 `action`。
- 串联：`applyMiddleware` 注入 middlewareAPI，`compose(...chain)(store.dispatch)`，末端 `next` 就是真正的 dispatch。
- 能力与取舍：日志、异步、改写、吞掉；thunk 简单，saga 适合竞态和并发编排。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 中间件能调 `dispatch` 吗？为什么不会死循环？ | 能，拿到的是「最终的 dispatch」（重新走整条链）。会不会死循环取决于你的逻辑，所以要有终止条件 |
| 中间件顺序有影响吗？ | 有。`applyMiddleware(a, b)` 中 a 在最外层，先收到 action；b 更靠近 `store.dispatch`。日志中间件通常放最后，才能看到外层改写后的 action 和 reducer 之后的 state |
| saga 的 `takeLatest` 怎么实现取消？ | 新 action 到来时 cancel 上一个 task，generator 的返回/`cancelled()` 让副作用可中断 |
| 能不用中间件做异步吗？ | 可以，把异步放在组件（effect）或 thunk 之外的服务层；中间件是为了让「异步也能走 dispatch」这条统一入口 |

---

## 本册自测

```
□ React 18 里 setTimeout 中连续两次 setState 渲染几次？17 为什么不同？
□ flushSync 解决什么问题？代价是什么？
□ 连续三次 setN(n+1) 与三次 setN(p=>p+1) 的结果分别是多少？底层原因？
□ memo 能阻止 Context 变化导致的重渲染吗？
□ 手写 createStore 的三个方法；subscribe 为什么返回取消函数？
□ reducer 为什么必须返回新对象？这和 useSelector 的默认比较方式有什么关系？
□ 中间件三层柯里化分别拿到什么？next 指向哪里？
□ applyMiddleware(a, b) 中谁先收到 action？
```
