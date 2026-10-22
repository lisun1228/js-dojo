# React 05｜状态管理与数据流

> 覆盖原题：3、12、13、31、36、60、65、67、70（9 题 → **6 个考点**）
> 这一册的主线是一条：**状态放在哪 → 怎么改 → 怎么跨组件共享 → 怎么在大型应用里管住它**。
> `setState 同步还是异步` 是这里最高频的一题，也是**原答案最容易过时**的一题。

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
| 5.1 setState 是同步还是异步 | 3、60、70 | 调用同步、生效异步；React 18 起所有场景自动批处理 |
| 5.2 setState 为什么传函数 | 36 | 对象式是"替换"，函数式是"基于最新值计算"，批处理下才不丢更新 |
| 5.3 状态提升 | 65 | 把共享状态提到最近公共父组件，props 下行 + 回调上行 |
| 5.4 Context | 12 | 跨层级传值，跳过中间层；不是状态管理方案 |
| 5.5 Redux 原理与单向数据流 | 13、67 | 单一 store + 纯 reducer + 订阅通知，数据永远单向流动 |
| 5.6 Redux 中间件原理 | 31 | 用 compose 把 dispatch 串成函数链，每层可以改写/延迟/吞掉 action |

---

## 5.1 setState 是同步还是异步？

> 原题：**3.**「合成事件和生命周期中是异步的（批处理），原生事件和 setTimeout 中是同步的。React 18 自动批处理。」
> **60 / 70.**「同第 3 题。」

### 原答案的问题

「**原生事件和 setTimeout 中是同步的**」这句话：

- 在 **React 17 及以前**（`ReactDOM.render`）成立；
- 在 **React 18+（`createRoot`）不成立** —— 自动批处理覆盖了 `setTimeout`、`Promise`、原生事件、甚至 `await` 之后。

而且"同步/异步"这个说法本身就不准确。更严谨的表述是：

> **`setState` 的调用是同步的，但它不立即修改 `this.state`；它把更新入队并触发一次调度。"是否批量"决定了"调度几次"，而不是"同步还是异步"。**

### 核心原理

**① 拆成三个问题，分别回答**

| 问题 | 答案 |
|---|---|
| `setState` 调用本身是同步的吗？ | 是。函数立刻返回，更新对象立刻入队 |
| `this.state` / state 变量会立刻变吗？ | 不会。它是那次渲染的快照，要等下一次 render 才更新 |
| 多次 `setState` 会渲染几次？ | React 18 起：**一次**（自动批处理）；17 及以前：合成事件/生命周期内一次，其他场景多次 |

**② 为什么"看起来像异步"**

```
setState(x) ──▶ 入队 update ──▶ scheduleUpdateOnFiber ──▶ Scheduler 安排
                                                          ↓
                                            下一次 render 时才计算新 state
```

因为中间隔着"调度"，所以你在 `setState` 下一行读 `this.state` 拿到的是旧值。**这叫"延迟生效"，不叫"异步"**。

**③ React 17 vs 18 的差异（必须讲清，这是本题的深度分）**

```jsx
// React 17（ReactDOM.render）
setTimeout(() => {
  setCount(c => c + 1);
  setCount(c => c + 1);
  // → 渲染 2 次（不在 React 事件上下文中，不批处理）
}, 0);

// React 18（createRoot）
setTimeout(() => {
  setCount(c => c + 1);
  setCount(c => c + 1);
  // → 渲染 1 次（自动批处理）
}, 0);
```

**为什么 17 之前做不到**：批处理依赖一个"我正在处理 React 事件"的全局标记（`isBatchingUpdates`）。`setTimeout` 的回调执行时，这个标记已经是 false，所以每次 `setState` 都直接 flush。

**React 18 怎么做到的**：改成"微任务里统一 flush"——所有更新先入队，然后在一个微任务里一次性处理，与"是否在 React 事件中"解耦。

**④ 批处理为什么是好事**

- 减少渲染次数（性能）；
- **保证同一次渲染内的 state 一致**：避免"第一行改了，界面先渲染一次半成品，第二行又改"的中间态。

**⑤ 需要立刻拿到更新后的 DOM 怎么办**

```jsx
import { flushSync } from 'react-dom';

flushSync(() => {
  setCount(c => c + 1);
});
// 这里 DOM 已经更新
```

`flushSync` 会放弃批处理、同步走完 render + commit。代价是可能触发额外渲染、破坏并发特性，**只在必须同步读 DOM 的场景用**（如测量、与第三方非 React 库交互）。

### 答题思路与要点顺序

1. **先纠正问法**：不是"同步/异步"，而是"调用同步、生效异步、是否批处理"。（15 秒，**开场就立住**）
2. **讲机制**：入队 → 调度 → 下次 render 才计算。（20 秒）
3. **讲 17 vs 18**：17 靠 `isBatchingUpdates` 标记，所以 setTimeout 里不批；18 改成微任务统一 flush，全覆盖。（30 秒，**这是最能区分水平的点**）
4. **讲收益**：减少渲染 + 避免中间态。（15 秒）
5. **讲逃生舱**：`flushSync`，以及它的代价。（15 秒）

### 口述参考

> 这个问题我觉得问法可以更精确一点：setState 的调用是同步的，函数立刻返回、update 立刻入队，但它不会立刻改 this.state，所以你在下一行读到的还是旧值。真正决定行为的是"要不要批处理"。
>
> React 17 及以前，批处理依赖一个全局标记 isBatchingUpdates，只有 React 的合成事件和生命周期里这个标记是 true，所以在 setTimeout、Promise 或者原生事件里连续调用会渲染多次。React 18 之后改成在微任务里统一 flush，跟"是不是在 React 事件里"解耦了，所以 setTimeout 里连续 setState 也只渲染一次，这叫自动批处理。
>
> 批处理的好处不只是少渲染，更重要的是保证一次渲染内的 state 是一致的，不会出现"第一行改了界面先渲染一次半成品"的中间态。
>
> 如果确实需要同步拿到更新后的 DOM，可以用 flushSync 包住，它会放弃批处理直接走完 render 和 commit，但会破坏并发、可能多渲染一次，所以要慎用。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 为什么 `setState` 之后马上读 `this.state` 是旧值？ | 更新入队，render 时才计算；实例上的 state 要等这次渲染完成才换 |
| class 的 `setState` 第二个参数是什么？ | 回调，在更新应用、DOM 更新后执行；函数组件用 `useEffect` 达到同样效果 |
| React 18 的自动批处理是"任何情况"都批吗？ | 基本是，但 `flushSync` 内部、以及某些脱离 React 调度的事件（如 `unstable_batchedUpdates` 之外的第三方调度器）例外 |
| 不想要批处理怎么办？ | `flushSync`；或者拆到两个不同的宏任务里（不推荐） |
| 为什么并发模式下"批处理"更重要？ | 每次渲染都可能被中断重做，渲染次数越多，浪费越大 |
| `this.setState({})` 空对象会渲染吗？ | 会触发一次调度，但若 state 无变化且组件是 PureComponent/memo，可能被剪枝 |

### 加分点与易错点

- ✅ **加分**：把"同步/异步"重新定义为"批处理"，并说清 17/18 的实现差异（`isBatchingUpdates` vs 微任务 flush）。
- ⚠️ **易错**：直接答"React 里 setState 是异步的"——不严谨，会被追问"那 setTimeout 里呢"。
- ⚠️ **易错**：以为 `setState` 是"延迟执行函数"——它是"入队 + 调度"，函数体（如果是函数式更新）在 render 时执行。

---

## 5.2 为什么 setState 要传函数？什么时候必须传函数？

> 原题：**36.**「state 依赖前一个 state 时用函数形式，保证正确。`setCount(prev => prev + 1)`。」

答案正确，但**没解释"为什么对象式会丢更新"**。这题讲清"action 是常量还是计算"，就通了。

### 核心原理

**① 一句话：对象式传的是"值"，函数式传的是"计算"**

```js
setCount(count + 1);      // action = 数字（常量），渲染时"替换"
setCount(prev => prev + 1); // action = 函数，渲染时"以最新 state 为入参执行"
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

关键：**`count` 是那次渲染的闭包常量，三次调用读到的是同一个值**。而 `p` 是 React 在渲染时传进来的最新值。

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

判断标准：**"我要设成什么"还是"在原来基础上改"**，后者用函数式。

**⑤ 底层原因（回扣 4.3）**

`useState` 本质是 `useReducer(basicStateReducer)`：

```js
function basicStateReducer(state, action) {
  return typeof action === 'function' ? action(state) : action;
}
```

对象（非函数）action → 直接替换；函数 action → 用最新 state 执行。**这就是"函数式更新能拿到最新值"的全部秘密。**

### 答题思路与要点顺序

1. **一句话**：对象式是"替换常量"，函数式是"基于最新值计算"。（10 秒）
2. **讲丢更新**：三次 `count + 1` 都得 1，因为 `count` 是同一快照。（25 秒）
3. **讲底层**：`basicStateReducer`——是函数就执行，不是就替换。（20 秒，深度分）
4. **给四种必须用的场景**：依赖旧值 / 多次更新 / 异步回调 / 空依赖 effect。（20 秒）
5. **给判断口诀**：「设成什么 → 直接传；在原来基础上改 → 传函数」。

### 口述参考

> 因为对象式传的是"值"，函数式传的是"计算"。setState 之后 state 不会立刻变，所以同一个事件里连续三次 setCount(count + 1)，三次读到的 count 都是这次渲染的快照，比如 0，那三个 action 都是"替换成 1"，最后结果还是 1，后两次被覆盖了。
>
> 换成 setCount(p => p + 1)，action 是函数，React 在渲染时会依次执行这三个函数，以上一次的结果作为入参，0 变 1、1 变 2、2 变 3，最后是 3。
>
> 底层的实现是 useState 其实是 useReducer 的特例，reducer 判断 action 是不是函数，是函数就执行，不是就直接替换。这就是为什么函数式能拿到最新值。
>
> 所以我的判断标准是：如果我只是想设成某个值，直接传；如果要基于原来改，就传函数。特别要注意异步回调和空依赖的 effect，里面的闭包一定是过期的，必须用函数式。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| class 组件里也有这个问题吗？ | 有。`this.setState({ n: this.state.n + 1 })` 同样丢更新，改 `this.setState(s => ({ n: s.n + 1 }))` |
| 函数式更新会不会执行多次？ | 会。渲染被中断重启时会重新执行，所以 updater **必须是纯函数**（不能有副作用） |
| 对象式更新一定是"覆盖"吗？ | class 的 `setState` 是**浅合并**（`Object.assign`），不是整体替换；`useState` 才是整体替换 |
| 为什么函数式更新是"幂等安全"的？ | 它只依赖入参、不依赖外部快照，重复执行结果一致（前提是纯函数） |
| `setX(prev => { prev.a = 1; return prev })` 可以吗？ | 不行，原地修改会让引用不变，可能被 bail out（并且违反不可变原则） |

### 加分点与易错点

- ✅ **加分**：区分 class 的"浅合并"与 `useState` 的"整体替换"；强调 updater 必须纯。
- ⚠️ **易错**：说"函数式更新是异步的所以能拿到最新值"——因果反了，是"渲染时才计算"所以能拿到最新值。

---

## 5.3 什么是状态提升？

> 原题：**65.**「把共享状态放到共同父组件，子组件通过 props 通信。」

### 核心原理

**定义**：当两个兄弟组件需要共享同一份状态时，把这份状态从子组件"提"到它们最近的公共父组件，父组件通过 props 下发数据、通过回调接收变更请求。

```jsx
// 提升前：两个输入框各自为政，下面的"合计"拿不到值
// 提升后：
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
| 兄弟通信不需要事件总线 | 状态被"放大"，职责可能变模糊 |

**"状态该放哪"的三条判据**（这是加分点）：

1. **能放在组件内部就放内部**（状态下沉，最小作用域）；
2. **需要被多个兄弟共享时，提到最近公共父级**；
3. **需要跨多层/全局共享时，才用 Context 或状态库**。

### 答题思路与要点顺序

1. **定义 + 场景**：兄弟组件共享数据 → 提到公共父级。（15 秒）
2. **数据流**：props 下行 + 回调上行，父组件是唯一数据源。（20 秒）
3. **收益**：单一数据源、避免副本不一致。（15 秒）
4. **代价**：props drilling、父级重渲染；引出 Context / 状态库作为后续方案。（25 秒）
5. **判据**：能下沉就下沉，需要共享才提升。（10 秒）

### 口述参考

> 状态提升是指，当两个兄弟组件需要共享同一份状态时，把这份状态从子组件挪到它们最近的公共父组件里，父组件通过 props 把值传下去，通过回调把变更请求收上来。这样父组件就是唯一数据源，不会出现两份副本不一致。
>
> 它的代价有两个。一是 props drilling，层级一深就要一路透传；二是父组件状态一变，整棵子树都要重新渲染，需要用 memo 或者拆 Context 来收窄影响范围。
>
> 但我一般会强调一个前提：状态应该尽量放在最小作用域。能放组件内部就别提升，真的需要兄弟共享才提升，需要跨很多层或者全局共享，才考虑 Context 或者状态库。因为提升本身是有成本的，提升得越高，重渲染的范围越大。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 提升到多高？ | 最近公共父级（LCA）。再高就是过度提升 |
| 和 Context 怎么选？ | 层级 ≤2 层、共享范围小 → 提升；跨多层、多组件消费 → Context；高频更新、需要选择器 → 状态库 |
| 提升后父组件重渲染怎么办？ | 拆分子组件 + `memo`；把状态下沉到真正使用它的子树；或用 Context 分片 |
| 什么时候不该提升？ | 状态只属于某个组件（如输入框草稿）、提升会导致无关组件重渲染、提升后父组件职责混乱 |
| 状态提升 vs 状态机（Redux）？ | 前者是组件内数据流，后者是应用级单一 store；规模不同，前者适合局部共享 |

### 加分点与易错点

- ✅ **加分**：主动说"能下沉就下沉"，体现你有"状态最小化"的意识。
- ⚠️ **易错**：把所有状态都往上提（"状态全放 App"），导致根组件重渲染、代码耦合。

---

## 5.4 Context 有什么用？能替代 Redux 吗？

> 原题：**12.**「跨层级传值，避免 prop drilling。」

### 核心原理

**① 三件套**

```jsx
const ThemeContext = createContext('light');   // 1. 创建（默认值只在没有 Provider 时生效）

<ThemeContext.Provider value={theme}>          {/* 2. 提供 */}
  <DeepChild />
</ThemeContext.Provider>

const theme = useContext(ThemeContext);        {/* 3. 消费 */}
```

**② 它解决的到底是什么**

不是"状态管理"，而是**"跨层级传值"**。它把"数据"和"组件层级"解耦：中间的组件不需要知道这个值存在。

```
props drilling:  App → Layout → Sidebar → Menu → Item（每层都要写 props）
Context:         App ─Provider─→ ... → Item（直接取）
```

**③ 更新机制与性能陷阱**

Provider 的 `value` 变化时，**所有消费该 Context 的组件都会重渲染**，无论层级多深，也**不受 `memo` 阻挡**。

```jsx
// ❌ 每次渲染都新建对象 → 所有消费者重渲染
<Ctx.Provider value={{ user, setUser }}>

// ✅ 稳定引用
const value = useMemo(() => ({ user, setUser }), [user]);
<Ctx.Provider value={value}>
```

常见优化手段：

| 手段 | 说明 |
|---|---|
| `useMemo` 包 value | 避免"对象字面量每次都变" |
| **拆分 Context** | 读的值和写的方法分两个 Context，只读组件不会因为方法变化而重渲染 |
| 状态下沉 | Provider 尽量靠近消费者，缩小影响范围 |
| 配 `useReducer` | `dispatch` 引用稳定，可以单独放一个 Context |

**④ Context 不能替代 Redux 的四个理由**

| 能力 | Context | Redux |
|---|---|---|
| 中间件（异步/日志） | ❌ | ✅ |
| 选择器（只订阅部分 state） | ❌（一变全变） | ✅（`useSelector` + 浅比较） |
| DevTools 时间旅行 | ❌ | ✅ |
| 更新粒度 | Provider 级 | action + selector 级 |
| 跨组件写操作的组织 | 要自己传 setter | dispatch 统一入口 |

准确说法：**Context 是"依赖注入"，Redux 是"状态管理 + 数据流约束"**。Redux 内部也常用 Context 来传 store。

### 答题思路与要点顺序

1. **定义**：跨层级传值，跳过中间层，解决 prop drilling。（10 秒）
2. **用法**：`createContext` / `Provider` / `useContext` 三件套。（15 秒）
3. **性能**：value 变化 → 所有消费者重渲染，memo 挡不住；给出 `useMemo` + 拆分 Context 的解法。（30 秒，**这是深度分**）
4. **对比 Redux**：缺中间件、缺选择器、粒度粗、无时间旅行。（25 秒）
5. **定位**：Context 是依赖注入，不是状态管理。（10 秒）

### 口述参考

> Context 解决的是跨层级传值，避免 prop drilling。用法是三件套：createContext 创建，Provider 提供 value，useContext 在任意深度的子组件里读取，中间的组件完全不需要知道这个值存在。
>
> 但有个性能陷阱：Provider 的 value 一变，所有消费这个 Context 的组件都会重渲染，而且 React.memo 是挡不住的，因为 context 更新是绕过 memo 的。所以 value 是对象的时候要用 useMemo 稳住引用；更好的做法是拆 Context，把只读的数据和写的方法分成两个，这样只关心数据的组件不会因为方法变化而重渲染。Provider 也应该尽量靠近消费者，缩小影响范围。
>
> 至于能不能替代 Redux，我觉得不能。Context 是依赖注入，不是状态管理。它没有中间件，没有选择器，state 一变所有消费者全重渲染，也没有 DevTools 的时间旅行。Redux 内部其实也用 Context 来传 store，它真正的价值是数据流约束和那套生态。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| `memo` 能阻止 Context 变化引起的重渲染吗？ | 不能。Context 更新会直接穿透 memo，标记消费者更新 |
| Context 的默认值什么时候生效？ | 上层没有对应 Provider 时 |
| 多个 Provider 嵌套顺序？ | 内层覆盖外层；可以嵌套多个不同 Context |
| Context + useReducer 等于 Redux 吗？ | 差得远：缺中间件、选择器、不可变工具、时间旅行；且更新粒度仍是 Provider 级 |
| 为什么 `value` 要 `useMemo`？ | 对象字面量每次渲染都是新引用，`Object.is` 判定为变化 → 所有消费者重渲染 |
| Context 适合放什么？ | 主题、locale、当前用户、dispatch、全局配置——**变化频率低**的值 |

### 加分点与易错点

- ✅ **加分**：说清"memo 挡不住 context"；给出"拆分读写 Context"的工程实践；准确定位"依赖注入 vs 状态管理"。
- ⚠️ **易错**：把 Context 当作全局状态管理方案推荐给大型项目（更新粒度过粗）。
- ⚠️ **易错**：在 Provider 上直接写 `value={{a, b}}` 而不 memo。

---

## 5.5 Redux 的原理是什么？单向数据流是怎样的？

> 原题：**13.**「单一 store，dispatch action → reducer 纯函数返回新 state，subscribe 通知视图。单向数据流。」
> **67.**「同第 13 题。」

### 核心原理

**① 三个原则**

| 原则 | 含义 |
|---|---|
| **单一数据源** | 整个应用一个 store，一个 state 树 |
| **state 只读** | 唯一改法是 dispatch action；不能直接赋值 |
| **用纯函数修改** | reducer 输入旧 state + action，输出新 state，无副作用 |

**② 数据流（一张图讲完）**

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

**关键点**：数据永远是"单向"的——UI 只能通过 action 表达"发生了什么"，不能直接改 state。

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

**④ 为什么必须不可变**

```js
// ❌ 原地改
state.todos.push(item);  return state;

// ✅ 新引用
return { ...state, todos: [...state.todos, item] };
```

原因：`react-redux` 用 `===` 判断"选中值变没变"（`useSelector` 的默认比较是引用比较）。原地改 → 引用不变 → 组件不更新。**这也是 Redux 与 React 的耦合点：不是 Redux 要求不可变，是"引用比较"要求不可变。**

**⑤ Redux Toolkit（RTK）解决了什么**

| 痛点 | RTK 的方案 |
|---|---|
| action type / action creator / switch 样板代码多 | `createSlice` 自动生成 |
| 手写不可变更新麻烦 | 内置 Immer，可以"看起来在改" |
| store 配置繁琐 | `configureStore` 默认带 devtools、thunk |
| 异步处理零散 | `createAsyncThunk` |

现在的标准答法是：**新项目用 RTK，不要手写 `createStore`。**

### 答题思路与要点顺序

1. **三原则**：单一数据源、state 只读、纯 reducer。（20 秒）
2. **数据流**：dispatch → reducer → 新 state → 通知 → 视图。（25 秒）
3. **实现骨架**：`getState / dispatch / subscribe` 三个方法，dispatch 里算 + 通知。（25 秒，深度分）
4. **不可变的必要性**：引用比较 → 原地改不更新。（20 秒）
5. **收尾**：现在用 RTK；Redux 适合"状态复杂、多人协作、需要可追溯"的场景。

### 口述参考

> Redux 有三个原则：单一数据源，整个应用一个 store；state 只读，唯一改法是 dispatch action；修改必须走纯函数 reducer。
>
> 数据流是单向的：组件 dispatch 一个 action，store 把当前 state 和 action 交给 reducer，reducer 返回新 state，store 保存后通知所有订阅者，react-redux 的 useSelector 比较选中的值有没有变，变了就触发组件重渲染。所以 UI 永远只能"表达发生了什么"，不能直接改 state。
>
> 它的实现其实很轻，核心就是 getState、dispatch、subscribe 三个方法。dispatch 里做两件事：调 reducer 算出新 state，然后遍历订阅者通知。区别在于 Redux 加了中间件、devtools、选择器这些东西，把它变成了一个生态。
>
> 还有一点必须提：reducer 里必须返回新对象，因为 react-redux 是靠引用比较判断变化的，原地 push 的话引用没变，组件就不会更新。所以现在一般用 Redux Toolkit，它内置了 Immer，可以写得像原地修改，同时默认带 devtools 和 thunk。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| Redux 和 React 有关系吗？ | 没有强绑定。Redux 是独立库，`react-redux` 才把它接到 React 上 |
| 为什么 reducer 必须是纯函数？ | ① 可预测、可重放（时间旅行）② 并发/StrictMode 下可能重复执行 ③ 同一个 action 序列必然得到同一个 state |
| 为什么 state 要不可变？ | `useSelector` 用引用比较判断变化；原地改会导致组件不更新，也破坏时间旅行 |
| Redux 会不会过度设计？ | 会。中小项目用 `useState` / `useReducer` / Zustand 更轻；Redux 适合状态复杂、多人协作、需要严格数据流和调试能力的场景 |
| `useSelector` 怎么避免多余重渲染？ | 选最小切片、用 `shallowEqual`、用 `reselect` 做记忆化选择器 |
| Redux 的 state 能放非序列化值吗？ | 不建议（函数、Promise、DOM）。会破坏 devtools 时间旅行与持久化 |

### 加分点与易错点

- ✅ **加分**：手写 `createStore` 骨架；说清"不可变是引用比较的要求"；主动提 RTK。
- ⚠️ **易错**：说"Redux 是 React 的状态管理库"——它是通用状态容器。
- ⚠️ **易错**：把 reducer 写成有副作用（发请求、打日志）。

---

## 5.6 Redux 中间件的原理是什么？

> 原题：**31.**「改造 dispatch，在 action 到达 reducer 前做日志、异步。如 redux-thunk、redux-saga。」

方向对，但"改造 dispatch"这四个字**没有信息量**。面试官会接着问"怎么改造的"。答案是一个柯里化链 + `compose`。

### 核心原理

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
| 第 2 层 | `next` | 拿到"链上的下一环"，实现串联 |
| 第 3 层 | `action` | 真正拦截每次 dispatch |

**② `applyMiddleware` 怎么串起来**

```js
function applyMiddleware(...middlewares) {
  return (createStore) => (reducer, preloadedState) => {
    const store = createStore(reducer, preloadedState);

    let dispatch = () => { throw new Error('Dispatching while constructing middleware'); };

    const middlewareAPI = {
      getState: store.getState,
      dispatch: (...args) => dispatch(...args),   // 注意：这里用闭包引用最终的 dispatch
    };

    const chain = middlewares.map(m => m(middlewareAPI));  // [next => action => {}, ...]
    dispatch = compose(...chain)(store.dispatch);          // 串成一条链

    return { ...store, dispatch };
  };
}
```

`compose` 就是 `reduce` 右结合：

```js
const compose = (...fns) => fns.reduce((a, b) => (...args) => a(b(...args)));
// compose(f, g, h)(x) === f(g(h(x)))
```

结果：

```
dispatch(action)
   → mw1 → mw2 → mw3 → store.dispatch（真正的 reducer 调用）
```

**③ 因为 dispatch 被"换掉"了，中间件才能做这些事**

| 能力 | 实现方式 |
|---|---|
| 日志 | `next` 前后各打一次，对比 state |
| 延迟 / 节流 | 不立即 `next`，攒一批再发 |
| **处理函数 action（thunk）** | 判断 `typeof action === 'function'`，是就执行它并传入 `dispatch/getState`，**不往下传** |
| 改写 action | 改完再 `next(newAction)` |
| 吞掉 action | 直接 `return`，不调 `next` |
| 异步流程编排（saga） | 拦截 action，用 generator 管理副作用 |

**④ redux-thunk 的全部源码（真的只有几行）**

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
| 可测试性 | 需要 mock dispatch | effect 是纯描述，`expectSaga` 易测 |
| 学习成本 | 极低 | 较高 |

（现在更常见的是 **RTK Query / TanStack Query** 接管服务端状态，中间件主要用于日志、持久化、埋点。）

### 答题思路与要点顺序

1. **一句话**：中间件是"可组合的 dispatch 增强器"，用柯里化 + compose 串成链。（15 秒）
2. **讲形状**：`({getState, dispatch}) => next => action => {...}`，三层各拿什么。（30 秒，**这是核心**）
3. **讲串联**：`applyMiddleware` 里 `compose(...chain)(store.dispatch)`，最终 `next` 指向真正的 dispatch。（25 秒）
4. **讲能力**：日志、异步、改写、吞掉，用 thunk 举例。（20 秒）
5. **收尾**：说清 thunk 与 saga 的取舍，提一下 RTK Query 接管服务端状态。

### 口述参考

> 中间件本质上是"可组合的 dispatch 增强器"。它的形状是三层柯里化：第一层接收 store 的 getState 和 dispatch，第二层接收 next 也就是链上的下一环，第三层接收 action。因为拿到了这三样东西，它就能读 state、派发新 action、决定要不要把 action 传给 next。
>
> applyMiddleware 做的事是把所有中间件先注入 middlewareAPI，得到一个 next 到 action 的函数数组，然后用 compose 把它们和 store.dispatch 串起来，形成 mw1 → mw2 → mw3 → 真正的 dispatch 这样一条链。所以中间件不是在 reducer 里做事，而是把 dispatch 换掉了。
>
> 因为 dispatch 被换掉，能做的事就很多：日志是 next 前后各打一次；延迟是不立刻调 next；改写是改完再 next；吞掉是直接 return。最典型的是 redux-thunk，源码就几行：判断 action 是不是函数，是就执行它并把 dispatch 和 getState 传进去，不往下传，这样就支持了函数式 action，也就支持了异步。
>
> thunk 简单，适合一次性异步；saga 用 generator 管副作用，适合竞态、取消、并发编排，但学习成本高。现在服务端状态更多交给 RTK Query 或 TanStack Query，中间件主要用来做日志、持久化和埋点。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 为什么是三层而不是两层？ | 第一层注入 store（中间件需要 getState/dispatch），第二层拿 next 做串联，第三层才是每次 dispatch 的拦截点 |
| `compose` 怎么实现？ | `fns.reduce((a, b) => (...args) => a(b(...args)))`，右结合 |
| 中间件能调 `dispatch` 吗？为什么不会死循环？ | 能，拿到的是"最终的 dispatch"（重新走整条链）。会不会死循环取决于你的逻辑，所以要有终止条件 |
| 中间件顺序有影响吗？ | 有。`applyMiddleware(a, b)` 中 a 在最外层，先收到 action；日志中间件通常放最后，才能看到其他中间件处理后的结果 |
| saga 的 `takeLatest` 怎么实现取消？ | 新 action 到来时 cancel 上一个 task，generator 的返回/`cancelled()` 让副作用可中断 |
| 能不用中间件做异步吗？ | 可以，把异步放在组件（effect）或 thunk 之外的服务层；中间件是为了让"异步也能走 dispatch 这条统一入口" |

### 加分点与易错点

- ✅ **加分**：手写 `applyMiddleware` 的 compose 部分；说清"`next` 是链上的下一环，末端的 next 就是 store.dispatch"。
- ⚠️ **易错**：说"中间件在 reducer 之前执行修改 state"——中间件不碰 state，它只处理 action。
- ⚠️ **易错**：把 saga 说成"拦截器"就结束，不提 generator / effect 的可测试性。

---

## 本册自测

1. React 18 里 `setTimeout` 中连续两次 `setState` 会渲染几次？为什么和 17 不同？
2. `flushSync` 解决什么问题？代价是什么？
3. 连续三次 `setN(n+1)`，结果是几？三次 `setN(p=>p+1)` 呢？底层原因是什么？
4. `memo` 能阻止 Context 变化导致的重渲染吗？
5. 手写 `createStore` 的三个方法，并说明 `subscribe` 为什么要返回取消订阅函数。
6. 为什么 reducer 必须返回新对象？这和 `useSelector` 有什么关系？
7. 中间件的三层柯里化分别拿到了什么？为什么需要 `next`？
8. `applyMiddleware(a, b)` 里，哪个中间件先收到 action？

<details>
<summary>自测参考答案要点</summary>

1. 1 次（自动批处理）。17 靠 `isBatchingUpdates` 标记，`setTimeout` 中标记为 false，每次 setState 直接 flush。
2. 需要同步读取更新后的 DOM 时使用；代价是放弃批处理、可能额外渲染、破坏并发特性。
3. 前者 1（三个常量 action 互相覆盖），后者 3（渲染时依次基于最新值执行）。底层是 `basicStateReducer`：函数则执行，非函数则替换。
4. 不能。Context 更新会直接标记消费者更新，绕过 `memo`。
5. `getState` 返回 state；`dispatch` 调 reducer 并通知订阅者；`subscribe` 注册监听。返回取消函数是为了避免内存泄漏与重复通知。
6. `react-redux` 用引用比较（`===`）判断选中值是否变化；原地修改引用不变 → 组件不更新，时间旅行也失效。
7. 第 1 层 `{getState, dispatch}`，第 2 层 `next`，第 3 层 `action`。`next` 是链上的下一环，末端即 `store.dispatch`，靠它把控制权交给下一个中间件。
8. `a` 在最外层，先收到 action；`b` 更靠近 `store.dispatch`。
</details>
