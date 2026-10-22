# React 03｜生命周期与 useEffect

> 覆盖原题：2、6、24、41、46、53、59、61、63、66、77、79、83（13 题 → **4 个考点**）
> 「生命周期」是这份题单里被转发次数最多的一题（2、41、53、61、77 五处指向同一题），说明它出现频率极高——但**高频不等于难，答错顺序才是真的丢分**。

---

## 本册速查

| 考点 | 合并自 | 一句话答案 |
|---|---|---|
| 3.1 类组件生命周期与执行顺序 | 2、41、53、61、77 | 挂载 3 步、更新 4 步、卸载 1 步；**子先于父**挂载与更新，**父先于子**卸载 |
| 3.2 useEffect 依赖数组与执行时机 | 24、66、63、83、46 | 不传 = 每次渲染后跑；`[]` = 仅挂载后跑一次；`[a]` = a 变才跑 |
| 3.3 useEffect 的清理函数 | 79 | 依赖变化前 + 卸载时执行，先清理旧的再跑新的 |
| 3.4 useEffect vs useLayoutEffect | 6、59 | 都在 DOM 更新后；一个绘制前同步，一个绘制后异步 |

---

## 3.1 React 的生命周期是怎样的？调用顺序是什么？

> 原题：**2.**、**41.**、**53.**、**61.**、**77.** 五题同义。原答案：
> 「挂载：constructor → render → componentDidMount；更新：render → componentDidUpdate；卸载：componentWillUnmount。函数组件：useState/useEffect，等价于 componentDidMount + componentDidUpdate + componentWillUnmount。」

原答案**结构对，但少了三样东西**：被废弃的三个 `will` 钩子（面试官很爱问"为什么废弃"）、`getDerivedStateFromProps` / `getSnapshotBeforeUpdate` 这两个"新"钩子、以及**父子组件的执行顺序**（第 77 题问的就是"调用顺序"，很多人只答了单组件的顺序）。

### 核心原理

**① 单组件全景**

```
                 ┌──────────── 挂载 Mount ────────────┐
constructor
   ↓
static getDerivedStateFromProps(props, state)   ← 每次 render 前都会调
   ↓
render()
   ↓
─────── React 更新真实 DOM（commit mutation）───────
   ↓
componentDidMount()                              ← DOM 可用，可发请求/订阅/取尺寸

                 ┌──────────── 更新 Update ───────────┐
static getDerivedStateFromProps
   ↓
shouldComponentUpdate(nextProps, nextState)      ← 返回 false 则跳过后面全部
   ↓
render()
   ↓
getSnapshotBeforeUpdate(prevProps, prevState)    ← DOM 还是旧的，可读滚动位置
   ↓
─────── React 更新真实 DOM ───────
   ↓
componentDidUpdate(prevProps, prevState, snapshot)

                 ┌──────────── 卸载 Unmount ──────────┐
componentWillUnmount()                           ← 清理定时器/订阅/请求
```

**② 三个被废弃的生命周期（必答）**

| 废弃钩子 | 替代方案 | 废弃原因 |
|---|---|---|
| `componentWillMount` | `constructor` / `componentDidMount` | Fiber 可中断 → render 前的钩子**可能被执行多次**，在里面发请求会重复 |
| `componentWillReceiveProps` | `getDerivedStateFromProps` | 同上；且它是"命令式"地在 props 变化时改 state，容易产生多数据源 |
| `componentWillUpdate` | `getSnapshotBeforeUpdate` | 同上（可能重复执行） |

现名 `UNSAFE_componentWillMount` 等——`UNSAFE` 不是"不安全"，而是"**不推荐在并发模式下使用**"。

**③ 两个"新"钩子的定位**

- `getDerivedStateFromProps`：**static**，不能访问 `this`，只能靠入参算 state。设计意图是"把 props 映射成 state"这件事做**纯**、做**可预测**。绝大多数场景其实不需要它（能用"受控 + 派生值直接算"解决）。
- `getSnapshotBeforeUpdate`：在 DOM 变更**前**读旧布局，返回值作为 `componentDidUpdate` 第三个参数。典型用途：聊天窗口"保持在底部"、图片列表插入时保持滚动位置。

**④ 父子执行顺序（第 77 题的真正考点）**

```
挂载：  父 constructor → 父 render → 子 constructor → 子 render
        → 子 componentDidMount → 父 componentDidMount
        ★ 口诀：render 自上而下，didMount 自下而上

更新：  父 SCU → 父 render → 子 SCU → 子 render
        → 子 getSnapshotBeforeUpdate → 子 componentDidUpdate
        → 父 getSnapshotBeforeUpdate → 父 componentDidUpdate
        ★ 同上：子先完成

卸载：  父 componentWillUnmount → 子 componentWillUnmount
        ★ 卸载是自上而下（父先）
```

**为什么挂载是子先**：父的 `componentDidMount` 语义是"我的子树已就绪"，必须等子先挂完。**为什么卸载是父先**：父先"退出"，再逐层拆子树（避免子在父之后还去访问父的状态）。

### 答题思路与要点顺序

1. **三阶段**：挂载 / 更新 / 卸载，各列 2–4 个钩子。（25 秒）
2. **补废弃钩子**：三个 `will` 及其替代，一句"因为 Fiber 可中断可能重复执行"。（25 秒，**这是最常被追问的点**）
3. **补两个新钩子**：`getDerivedStateFromProps`（纯、静态）、`getSnapshotBeforeUpdate`（读旧布局）。（20 秒）
4. **父子顺序**：挂载/更新子先，卸载父先。（20 秒，直接命中第 77 题）
5. **映射到函数组件**：`useState` ≈ state + setState；`useEffect(fn, [])` ≈ didMount + willUnmount；`useEffect(fn)` ≈ didMount + didUpdate。并补一句"但语义不同：useEffect 是同步外部系统，不是时间点回调"。

### 口述参考

> 类组件的生命周期分三个阶段。挂载是 constructor、getDerivedStateFromProps、render，DOM 更新完之后执行 componentDidMount，在这里取尺寸、发请求、做订阅都可以。更新是 getDerivedStateFromProps、shouldComponentUpdate、render，然后 getSnapshotBeforeUpdate 在 DOM 变更前读旧布局，变更后进 componentDidUpdate，它的第三个参数就是快照的返回值。卸载是 componentWillUnmount，做清理。
>
> 这里要补一句，以前那三个 will 钩子都被废弃了，改成了 UNSAFE_ 前缀，原因是 Fiber 的 render 阶段可中断、可能重复执行，放在 render 之前的副作用会跑多次。它们的替代分别是 constructor 或 didMount、getDerivedStateFromProps、getSnapshotBeforeUpdate。
>
> 还有一个高频追问是父子顺序。render 是自上而下，但 componentDidMount 是自下而上，子的先执行完父的才执行，因为父的 didMount 语义是"子树已就绪"。卸载反过来，父的 willUnmount 先执行。
>
> 函数组件里，useState 相当于 state 加 setState，useEffect 空依赖相当于 didMount 加 willUnmount，不传依赖相当于 didMount 加 didUpdate。但要注意语义差别，useEffect 不是"在某个时间点执行"，而是"同步外部系统"。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 为什么三个 will 被废弃？ | 核心是 Fiber 可中断：render 前的钩子可能执行多次，副作用会重复（例如发两次请求）。另外 `componentWillReceiveProps` 容易造成 state 与 props 双数据源 |
| `getDerivedStateFromProps` 为什么必须是 static？ | 设计上要求它是**纯函数**，不能读实例（避免 `this.props` 与入参 props 不一致）；也防止在里面做副作用 |
| 在 `render` 里能发请求吗？ | 不能。render 必须纯，且并发下会被多次执行。请求放 `componentDidMount` / `useEffect` |
| 在 `componentWillMount` 里发请求有什么问题？ | SSR 时它会在服务端执行（请求可能拿不到结果），客户端又执行一次；并发下还可能重复 |
| `shouldComponentUpdate` 返回 false 后还会走哪些钩子？ | `render`、`getSnapshotBeforeUpdate`、`componentDidUpdate` 都不执行；但 state 已经更新（在实例上） |
| `useEffect` 真的等价于三个生命周期吗？ | 行为上近似，语义不同：`useEffect` 是"订阅-清理"模型，关注"同步外部系统"，不是"在挂载时干某事" |
| 为什么挂载子先、卸载父先？ | 挂载时父的 didMount 需要子树就绪；卸载时父先"退出"，再逐层拆子树，避免子访问已卸载的父 |

### 加分点与易错点

- ✅ **加分**：主动区分"废弃"与"改名"（`UNSAFE_` 的含义）；说出 `getSnapshotBeforeUpdate` 的真实场景（保持滚动位置）。
- ⚠️ **易错**：把父子顺序答反。**挂载/更新：子先父后；卸载：父先子后**。
- ⚠️ **易错**：说"函数组件没有生命周期"。它有，只是表达方式不同。
- ⚠️ **易错**：把 `getDerivedStateFromProps` 说成"props 变化时才调用"——它在**每次 render 前**都会调用（包括 setState 引起的更新）。

---

## 3.2 useEffect 的依赖数组怎么用？怎么模拟 componentDidMount？

> 原题：**24.**「空数组：只执行一次（mount）。不写：每次渲染都执行。」
> **66.**「控制 effect 何时重新执行。空数组只执行一次。」
> **63 / 83.**「`useEffect(() => {}, [])`」——只给了一行代码。
> **46.**「useState 和 useEffect」——指向第 2、7 题（**多义转发**，本册与 [04 册 4.3](/doc/react-hooks-principles) 各承担一半）。

### 核心原理

**① 三种写法的准确语义**

| 写法 | 执行时机 | 清理时机 | 常见误用 |
|---|---|---|---|
| `useEffect(fn)` **不传** | 每次渲染后都执行 | 每次重跑前 + 卸载 | 在里面 setState → 无限循环 |
| `useEffect(fn, [])` | **仅挂载后一次**（StrictMode 开发期两次） | 仅卸载时 | 以为"只跑一次"就可以不写清理（其实要） |
| `useEffect(fn, [a, b])` | 挂载后一次 + **a 或 b 变化**时 | 依赖变化前 + 卸载 | 依赖写不全 → 闭包读到旧值 |

**依赖比较用的是 `Object.is`**（逐项比较），不是深比较：

```js
Object.is(NaN, NaN)   // true（setState 的 bail out 也用它）
Object.is({}, {})     // false ← 所以对象/数组/函数字面量每次都是"变了"
```

**② 模拟三个生命周期（第 63/83 题的完整答案）**

```jsx
// componentDidMount
useEffect(() => { init(); }, []);

// componentDidUpdate（跳过首次）
const isFirst = useRef(true);
useEffect(() => {
  if (isFirst.current) { isFirst.current = false; return; }
  onUpdate();
}, [dep]);

// componentWillUnmount
useEffect(() => () => cleanup(), []);

// componentDidMount + componentDidUpdate（不传依赖，但要防首次重复）
useEffect(() => { track(); });   // 每次渲染后都跑
```

**③ 三个高频坑**

```jsx
// 坑 1：对象依赖 → 每次都"变了" → 无限循环
useEffect(() => {...}, [{ id }]);       // ❌ 每次渲染新建对象
useEffect(() => {...}, [id]);           // ✅ 依赖原始值

// 坑 2：函数依赖 → 同上
useEffect(() => {...}, [onChange]);     // ❌ 父组件内联函数每次新建
// 解法：父组件用 useCallback 稳定引用，或把函数体搬进 effect 内部

// 坑 3：闭包读到旧值
useEffect(() => {
  const t = setInterval(() => setCount(count + 1), 1000); // count 永远是 0
  return () => clearInterval(t);
}, []);                                  // ❌ 依赖漏了 count
// 解法 A：setCount(c => c + 1)  解法 B：依赖里加 count（但要清定时器）
```

**④ 该不该无脑相信 `exhaustive-deps`**

`eslint-plugin-react-hooks` 会强制你把用到的值都放进依赖。多数情况应该听它的；少数情况（只想在某个值变化时"重新订阅"，而不想每次值变都重建连接）可以用 `useRef` 存最新值 + 空依赖，但要写注释说明意图。**不要用 `// eslint-disable-next-line` 掩盖没想清楚**。

### 答题思路与要点顺序

1. **三种写法**：不传 / `[]` / `[deps]`，各配"执行时机"。（25 秒）
2. **比较方式**：`Object.is` 逐项比较，所以对象与函数字面量是陷阱。（15 秒，深度分）
3. **模拟 didMount / didUpdate / willUnmount**：给出三行代码。（20 秒，直接命中 63/83）
4. **两个坑**：依赖爆炸（对象/函数）与闭包旧值，各给一个修法。（25 秒）
5. **收尾**：依赖数组本质是"声明这个 effect 依赖哪些响应式值"，写全了才对；用 lint 兜底。

### 口述参考

> 依赖数组控制的是"这个 effect 什么时候需要重新执行"。三种写法：不传，每次渲染后都执行；传空数组，只在挂载后执行一次，卸载时执行清理；传依赖项，挂载后执行一次，之后任意一项变化就重跑，重跑前先执行上一次的清理。
>
> 模拟生命周期很简单：空依赖就是 componentDidMount；返回一个函数就是 componentWillUnmount；不传依赖就是 didMount 加 didUpdate；如果要模拟"只在更新时执行、跳过首次"，用一个 ref 标记一下就行。
>
> 有两个坑必须注意。第一是比较方式是 Object.is，逐项比，所以依赖里写对象或者内联函数的话，每次渲染引用都是新的，effect 每次都跑，很容易无限循环，应该依赖原始值，或者用 useCallback、useMemo 把引用稳住。第二是闭包，空依赖的 effect 里读到的 state 永远是第一次渲染的那个值，定时器里 setCount(count+1) 永远加一，得改成函数式更新或者把值放进依赖。
>
> 我的习惯是让 exhaustive-deps 这个 lint 规则把依赖补齐，如果确实要偏离，就用 ref 存最新值并写注释说明，而不是直接 disable。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 依赖数组是深比较吗？ | 不是，`Object.is` 逐项浅比较。对象/数组/函数看引用 |
| 为什么空依赖下请求还是发了两次？ | 开发期 StrictMode 的 effect 双调用；生产不会 |
| 想让 effect "只在某个值变化时"执行，但不要首次执行？ | `useRef` 标记首次 + 依赖该值；或用 `useUpdateEffect` 自定义 Hook |
| 依赖里能写 `props.onChange` 吗？ | 能，但要保证父组件用 `useCallback` 稳定它；否则等于每次渲染都变 |
| `useEffect` 里能直接 `async` 吗？ | 不能，回调必须返回清理函数或 undefined。写成内部 async 函数再调用 |
| 多个 effect 的执行顺序？ | 按声明顺序依次执行（同一组件内）；不同组件按 commit 的 layout/mutation 顺序，子组件先于父组件 |
| 空依赖就一定只执行一次吗？ | 逻辑上一次；但组件被 key 重建、或 StrictMode 双调用时会多次。语义上应理解为"随组件生命周期" |

### 加分点与易错点

- ✅ **加分**：说出 `Object.is`；说出"依赖是声明式的，不是控制流"；提到 `useUpdateEffect` 这类封装。
- ⚠️ **易错**：说"空数组就是只执行一次，和生命周期无关"——它绑的是**组件生命周期**，key 变化会重建。
- ⚠️ **易错**：用 `JSON.stringify(deps)` 规避对象依赖——能跑但会丢类型、性能差、循环引用会崩，不推荐。

---

## 3.3 useEffect 的返回值（清理函数）有什么用？

> 原题：**79.**「清理函数，组件卸载或依赖变化前执行，清除副作用（定时器、订阅）。」
> 这题答案已经比较准。要补的是**执行顺序**和**异步副作用的清理方式**。

### 核心原理

**① 两个触发时机**

```
挂载：  setup①
依赖变化：cleanup① → setup②        ← 先清理旧的，再执行新的
卸载：  cleanup②
```

严格模式下（开发期）额外走一遍 `setup → cleanup → setup`。

**② 它解决的是"资源泄漏"这一类问题**

| 副作用 | 清理方式 |
|---|---|
| 定时器 | `clearInterval` / `clearTimeout` |
| 事件监听 | `removeEventListener`（注意引用要一致） |
| WebSocket / SSE | `socket.close()` |
| 请求 | `AbortController` → `controller.abort()` |
| IntersectionObserver / ResizeObserver | `observer.disconnect()` |
| Redux / 第三方 store 订阅 | `unsubscribe()` |
| 全局状态/单例 | 恢复现场 |

```jsx
useEffect(() => {
  const controller = new AbortController();
  fetch('/api/list', { signal: controller.signal })
    .then(r => r.json())
    .then(setList)
    .catch(e => { if (e.name !== 'AbortError') throw e; });
  return () => controller.abort();       // 卸载或依赖变化时取消
}, [page]);
```

**③ 三个易错点**

1. **不能 return Promise**：`useEffect` 只接受"返回函数或 undefined"。写成 `useEffect(async () => {...})` 会报错，因为 async 函数返回 Promise，React 会试图把它当 cleanup 调用。
2. **cleanup 的引用一致性**：`addEventListener('resize', handler)` 的 handler 必须是同一个引用才能被移除；用内联箭头函数就删不掉。
3. **异步 setup 的清理**：如果 setup 里 `await` 之后才产生资源，cleanup 可能先于资源创建执行。解法：用标志位或 `AbortController`，并在 cleanup 里先置标志。

```jsx
useEffect(() => {
  let cancelled = false;
  (async () => {
    const data = await fetchData();
    if (!cancelled) setData(data);      // 卸载后不再 setState
  })();
  return () => { cancelled = true; };
}, []);
```

### 答题思路与要点顺序

1. **定义**：effect 的返回值是清理函数，在**依赖变化前**和**卸载时**执行。（15 秒）
2. **顺序**：先 cleanup 旧的再 setup 新的——这是"幂等"的保证。（15 秒）
3. **列场景**：定时器、事件、订阅、请求、Observer。（20 秒）
4. **给代码**：AbortController 取消请求（最实用）。（20 秒）
5. **补易错**：不能返回 Promise；handler 引用要一致；异步 setup 用标志位。

### 口述参考

> useEffect 的返回值是一个清理函数，它会在两个时机执行：依赖变化、effect 要重跑之前，以及组件卸载时。执行顺序是先跑上一次的 cleanup，再跑新的 setup，所以每次 effect 执行时，外部状态都是干净的。
>
> 它解决的是资源泄漏。典型的是定时器要 clear、事件监听要 remove、WebSocket 要 close、Observer 要 disconnect、请求要 abort。请求这块我一般用 AbortController，在 cleanup 里 abort，这样组件卸载或者页码变了之后，旧请求回来也不会再把数据写进已经卸载的组件，顺带解决竞态。
>
> 有三个容易出错的点。第一，effect 回调不能是 async 函数，因为 async 返回 Promise，React 会把它当成清理函数去调用，正确写法是里面再包一个 async 函数。第二，removeEventListener 的 handler 必须和 add 时是同一个引用，内联函数删不掉。第三，如果 setup 里 await 之后才创建资源，cleanup 可能先执行，要用一个 cancelled 标志位或者 AbortController 判断。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| cleanup 在什么时候执行？ | 依赖变化后、下一次 setup 之前；以及组件卸载时。**不是**每次渲染后都执行（只有依赖变了才） |
| 卸载后 setState 会报警告吗？ | React 18 已移除该警告，但仍是内存/逻辑泄漏，应取消请求 |
| 为什么不能返回 Promise？ | React 需要同步拿到"清理函数"，Promise 不可调用；会报 "An effect function must not return anything besides a function" |
| 清理函数能是 async 吗？ | 不能直接返回 async 函数的调用结果；可以在 cleanup 里调用异步函数但不 await |
| 多个 effect 的 cleanup 顺序？ | 与 setup 相反？——**不是**。同一组件内按声明顺序执行 cleanup（React 按顺序遍历 effect 链表），不要依赖这个顺序做业务 |
| `useLayoutEffect` 的清理时机？ | 在 commit 的 mutation 阶段、DOM 变更之后同步执行（比 useEffect 更早） |

### 加分点与易错点

- ✅ **加分**：用 AbortController 一次解决"取消请求 + 竞态 + 卸载后 setState"三个问题。
- ⚠️ **易错**：认为 cleanup 只在卸载时执行。依赖变化时也会执行，这是最常见的理解偏差。
- ⚠️ **易错**：在 cleanup 里做"需要 props 的逻辑"却漏了依赖，导致读到旧值。

---

## 3.4 useEffect 和 useLayoutEffect 有什么区别？

> 原题：**6.**「useEffect：异步渲染后执行，不阻塞绘制；useLayoutEffect：同步渲染前执行，阻塞绘制（测量 DOM 用）。」
> **59.**「同第 6 题。」

### 原答案的问题

「**异步渲染后**」「**同步渲染前**」这两个表述都**错位了**。准确说法是：

> 两者都在 **DOM 已经更新之后**（commit 的 mutation 阶段完成后）。
> `useLayoutEffect` 在 **layout 子阶段同步执行**——此时尚未 paint；
> `useEffect` 在 **paint 之后异步执行**——由 Scheduler 调度。

所以不是"渲染前/渲染后"的区别，而是"**绘制前/绘制后**"的区别。

### 核心原理

```
render 阶段  →  commit: beforeMutation  →  mutation（改 DOM）  →  layout  →  paint  →  被动 effect
                                                    ↑                          ↑              ↑
                                          cleanup(useLayoutEffect)      useLayoutEffect   useEffect
```

| 维度 | `useLayoutEffect` | `useEffect` |
|---|---|---|
| **执行时机** | commit 的 layout 阶段，**同步**，paint 之前 | paint 之后，**异步**（Scheduler 调度） |
| **是否阻塞绘制** | ✅ 阻塞（回调里的耗时会直接拖慢首屏） | ❌ 不阻塞 |
| **典型用途** | 读布局（`offsetWidth`、`scrollHeight`、`getBoundingClientRect`）、在 paint 前修改 DOM 防闪烁 | 请求、订阅、日志、非视觉相关副作用 |
| **SSR** | ⚠️ 不执行，会打印 warning（服务端没有 DOM/布局） | 不执行，但不报警 |
| **执行顺序** | 先（子 → 父） | 后（子 → 父，且在所有 layout effect 之后） |

**什么时候必须用 `useLayoutEffect`**——判断标准只有一条：**"如果这段逻辑放到 paint 之后执行，用户会看到闪烁或错位吗？"**

```jsx
// 经典场景：tooltip 位置测量，必须在 paint 前定好位置，否则会看到它从角落"跳"过去
useLayoutEffect(() => {
  const { height } = ref.current.getBoundingClientRect();
  setTop(-height - 8);
}, [content]);
```

**为什么 SSR 会警告**：`useLayoutEffect` 依赖 DOM 布局，服务端渲染没有布局引擎，所以 React 在 SSR 时会跳过它并打印警告（避免"服务端执行了、客户端又执行"的不一致）。如果组件确定只在客户端渲染，可以用 `useIsomorphicLayoutEffect` 兼容：

```js
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;
```

### 答题思路与要点顺序

1. **先纠正**：都在 DOM 更新之后，区别是"paint 前同步" vs "paint 后异步"。（15 秒，**开头就说对，直接建立信任**）
2. **讲机制**：分别挂在 commit 的 layout 阶段和绘制后的被动 effect 队列。（20 秒）
3. **讲影响**：layout 阻塞绘制，耗时长会白屏/掉帧；effect 不阻塞，但可能闪一下。（20 秒）
4. **讲选择标准**："这段逻辑放到绘制后会闪烁吗？会 → layout，否则 → effect"。（20 秒）
5. **补 SSR**：`useLayoutEffect` 在 SSR 不执行且有 warning，需要 isomorphic 写法。

### 口述参考

> 先说一个常见误解，它们不是"渲染前和渲染后"的区别，两者都在 DOM 已经更新之后执行，区别在绘制前后。commit 阶段改完 DOM 之后，layout 子阶段会同步执行 useLayoutEffect 的回调，这时候浏览器还没画，所以它能读到最新的布局，改 DOM 也不会闪烁；useEffect 是在浏览器绘制完之后，由调度器异步执行的。
>
> 所以影响不同：useLayoutEffect 会阻塞绘制，如果里面做重活，用户看到的就是白屏或者掉帧；useEffect 不阻塞，但如果你在里面改 DOM 影响视觉，用户可能先看到旧画面再跳变。
>
> 选择标准就一句话：这段逻辑如果放到绘制之后执行，用户会不会看到闪烁或错位。会，就用 useLayoutEffect，典型的是 tooltip 定位、测量元素尺寸、滚动位置恢复；不会，就用 useEffect，比如请求、订阅、埋点。
>
> 还有一个坑是 SSR，useLayoutEffect 在服务端不执行还会打 warning，因为它依赖布局，所以通常会写一个 isomorphic 的版本，在 window 不存在时退回 useEffect。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 为什么 `useLayoutEffect` 会阻塞绘制？ | 它在 commit 的 layout 阶段同步执行，属于同一个宏任务的一部分，执行完才会继续 paint |
| 只用 `useEffect` 会有什么问题？ | 涉及"读布局 + 改 DOM"的场景会闪烁（先画错误位置，再修正） |
| 全都用 `useLayoutEffect` 行吗？ | 不行：阻塞绘制、SSR 警告、无谓拖慢首屏。默认应该用 `useEffect` |
| `useLayoutEffect` 能拿到更新后的 DOM 吗？ | 能，mutation 阶段已经改完 DOM |
| 它在 SSR 里真的不执行吗？ | 是，服务端直接跳过并 warn。`useInsertionEffect`（CSS-in-JS 用）也在更早的时机 |
| 和 `componentDidMount` 的时机关系？ | `useLayoutEffect` 与 `componentDidMount` 同一子阶段（layout），都在 paint 前；`useEffect` 在 paint 后 |

### 加分点与易错点

- ✅ **加分**：一开口就纠正"渲染前/渲染后"的表述；给出 `useIsomorphicLayoutEffect` 这个工程写法。
- ⚠️ **易错**：说 `useLayoutEffect` 在"render 阶段"执行——render 阶段不能碰 DOM。
- ⚠️ **易错**：说 `useEffect` 是"同步/异步"取决于是否传依赖——无关。

---

## 本册自测

1. 父子组件挂载时，`componentDidMount` 谁先执行？卸载时 `componentWillUnmount` 谁先？
2. 三个 `componentWillXxx` 为什么被废弃？各自的替代是什么？
3. `useEffect(fn, [])` 里的 `fn` 在 StrictMode 开发环境执行几次？为什么？
4. 依赖数组里写 `[{ id }]` 会发生什么？为什么？
5. 什么情况下必须用 `useLayoutEffect`？给出一个具体场景。
6. `useEffect` 的 cleanup 在"依赖变化"时执行吗？执行顺序是什么？
7. 为什么 `useEffect(async () => {})` 会报错？

<details>
<summary>自测参考答案要点</summary>

1. 挂载 `componentDidMount` 子先父后（render 父先子后）；卸载 `componentWillUnmount` 父先子后。
2. Fiber 可中断 → render 前钩子可能重复执行，副作用会跑多次；另外 `componentWillReceiveProps` 容易造成 props/state 双数据源。替代依次为 constructor 或 didMount、getDerivedStateFromProps、getSnapshotBeforeUpdate。
3. 两次（mount → unmount → mount），用于暴露缺失的清理函数。
4. 每次渲染都新建对象，`Object.is` 比较恒为 false → effect 每次执行，若内部 setState 则无限循环。
5. 逻辑必须在 paint 前完成、否则会闪烁：tooltip 定位、读 `getBoundingClientRect` 后设置位置、滚动位置恢复。
6. 会。顺序是 cleanup(旧) → setup(新)，即"先清理再重建"。
7. async 函数返回 Promise，React 期望返回 cleanup 函数或 undefined；需在内部定义 async 函数再调用。
</details>
