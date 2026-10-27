# React 03｜生命周期与 useEffect

> 覆盖原题：2、6、24、41、46、53、59、61、63、66、77、79、83 —— **4 个考点**

---

## 目录

- [本册速查](#本册速查)
- [3.1 React 的生命周期是怎样的？调用顺序是什么？](#31-react-的生命周期是怎样的调用顺序是什么)
- [3.2 useEffect 的依赖数组怎么用？怎么模拟 componentDidMount？](#32-useeffect-的依赖数组怎么用怎么模拟-componentdidmount)
- [3.3 useEffect 的返回值（清理函数）有什么用？](#33-useeffect-的返回值清理函数有什么用)
- [3.4 useEffect 和 useLayoutEffect 有什么区别？](#34-useeffect-和-uselayouteffect-有什么区别)
- [本册自测](#本册自测)

---

## 本册速查

| 考点 | 合并自 | 关键词 |
|---|---|---|
| 3.1 类组件生命周期与执行顺序 | 2、41、53、61、77 | 三阶段、废弃钩子、父子顺序 |
| 3.2 useEffect 依赖数组与执行时机 | 24、66、63、83、46 | 三种依赖、Object.is、闭包 |
| 3.3 useEffect 的清理函数 | 79 | 清理时机、资源释放 |
| 3.4 useEffect vs useLayoutEffect | 6、59 | paint 前同步 / 后异步 |

---

## 3.1 React 的生命周期是怎样的？调用顺序是什么？

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

- `getDerivedStateFromProps`：**static**，不能访问 `this`，只能靠入参算 state；每次 render 前都会调用（包括 setState 引起的更新）。设计意图是把"props 映射成 state"做成**纯**、**可预测**的计算；多数场景可以用"受控 + 派生值直接算"替代。
- `getSnapshotBeforeUpdate`：在 DOM 变更**前**读旧布局，返回值作为 `componentDidUpdate` 第三个参数。典型用途：聊天窗口"保持在底部"、图片列表插入时保持滚动位置。

**④ 父子执行顺序**

```
挂载：  父 constructor → 父 render → 子 constructor → 子 render
        → 子 componentDidMount → 父 componentDidMount
        ★ render 自上而下，didMount 自下而上

更新：  父 SCU → 父 render → 子 SCU → 子 render
        → 子 getSnapshotBeforeUpdate → 父 getSnapshotBeforeUpdate
        → DOM 变更 → 子 componentDidUpdate → 父 componentDidUpdate
        ★ 快照与 didUpdate 都是子先父后

卸载：  父 componentWillUnmount → 子 componentWillUnmount
        ★ 卸载是自上而下（父先）
```

### 口述参考

- 三阶段的关键钩子分别是 `componentDidMount`、`componentDidUpdate`、`componentWillUnmount`；前两者在 DOM 变更之后，`getSnapshotBeforeUpdate` 在 DOM 变更之前。
- 三个 `componentWillXxx` 的替代依次为 `constructor` / `componentDidMount`、`getDerivedStateFromProps`、`getSnapshotBeforeUpdate`；废弃的共同原因是 render 阶段可中断、可能重复执行。
- 父子顺序：render 自上而下，`componentDidMount` / `componentDidUpdate` 子先父后，`componentWillUnmount` 父先子后。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| `getDerivedStateFromProps` 为什么必须是 static？ | 要求是纯函数，不能读实例，避免 `this.props` 与入参 props 不一致，也防止在里面做副作用 |
| 在 `render` 里能发请求吗？ | 不能。render 必须纯，并发下可能重复执行；请求放 `componentDidMount` / `useEffect` |
| 在 `componentWillMount` 里发请求有什么问题？ | SSR 时在服务端执行一次、客户端再执行一次；并发下还可能重复 |
| `shouldComponentUpdate` 返回 false 后还会走哪些钩子？ | `render`、`getSnapshotBeforeUpdate`、`componentDidUpdate` 都不执行；但新的 state 已写入实例 |

---

## 3.2 useEffect 的依赖数组怎么用？怎么模拟 componentDidMount？

### 核心原理

**① 三种写法的准确语义**

| 写法 | 执行时机 | 清理时机 | 常见误用 |
|---|---|---|---|
| `useEffect(fn)` **不传** | 每次渲染后都执行 | 每次重跑前 + 卸载 | 在里面 setState → 无限循环 |
| `useEffect(fn, [])` | **仅挂载后一次** | 仅卸载时（StrictMode 开发期会模拟一次卸载，见 3.3） | 以为"只跑一次"就可以不写清理 |
| `useEffect(fn, [a, b])` | 挂载后一次 + **a 或 b 变化**时 | 依赖变化前 + 卸载 | 依赖写不全 → 闭包读到旧值 |

**依赖比较用的是 `Object.is`**（逐项比较），不是深比较：

```js
Object.is(NaN, NaN)   // true（setState 的 bail out 也用它）
Object.is({}, {})     // false ← 所以对象/数组/函数字面量每次都是"变了"
```

**② 模拟三个生命周期**

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

// componentDidMount + componentDidUpdate（不传依赖，首次也会执行）
useEffect(() => { track(); });   // 每次渲染后都跑
```

映射只在行为上近似：`useEffect` 是"订阅-清理"模型，关注同步外部系统，不是"在挂载时间点执行一次"的回调。

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

**④ `exhaustive-deps` 的使用边界**

`eslint-plugin-react-hooks` 会强制把用到的值都放进依赖。多数情况应照做；确需只在某个值变化时重新订阅、又不想每次值变都重建连接时，可以用 `useRef` 存最新值 + 空依赖，并写注释说明意图。不要用 `// eslint-disable-next-line` 掩盖没想清楚；也不要用 `JSON.stringify(deps)` 规避对象依赖——会丢类型、性能差、循环引用会崩。

### 口述参考

- 依赖数组声明的是 effect 依赖哪些响应式值，比较方式是 `Object.is` 逐项浅比较，对象与内联函数每次渲染都是新引用。
- 空依赖闭包读到首次渲染的 state，用函数式更新或补齐依赖；依赖膨胀用 `useCallback` / `useMemo` 稳定引用。
- 默认让 `exhaustive-deps` 补齐依赖，确需偏离时用 ref 存最新值并写注释。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 想让 effect 只在某个值变化时执行，跳过首次？ | `useRef` 标记首次 + 依赖该值；或封装 `useUpdateEffect` |
| 多个 effect 的执行顺序？ | 同一组件内按声明顺序执行；不同组件在 commit 后按子 → 父执行 |
| 空依赖就一定只执行一次吗？ | 组件被 key 重建时会重新挂载并执行；逻辑上一次，不等于实例只创建一次 |

---

## 3.3 useEffect 的返回值（清理函数）有什么用？

### 核心原理

**① 两个触发时机**

```
挂载：  setup①
依赖变化：cleanup① → setup②        ← 先清理旧的，再执行新的
卸载：  cleanup②
```

开发期 StrictMode 会额外执行一轮 `setup → cleanup → setup`，用于暴露缺失的清理逻辑；生产环境不会。

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

1. **不能返回 Promise**：`useEffect` 只接受"返回清理函数或 undefined"。`useEffect(async () => {...})` 返回 Promise，React 会判定为非法返回值并给出错误提示。
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

### 口述参考

- cleanup 在依赖变化后、下一次 setup 前执行，也在卸载时执行；顺序固定为 cleanup(旧) → setup(新)。
- `AbortController` 同时处理取消请求、竞态和卸载后 setState。
- setup 内有 `await` 时，用 `cancelled` 标志或 `AbortController` 防止 cleanup 先于资源创建。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 卸载后 setState 会报警告吗？ | React 18 已移除该警告，但仍应取消请求，避免无效写入 |
| 多个 effect 的 cleanup 顺序？ | 同一组件内按声明顺序执行，不要依赖这个顺序做业务 |

---

## 3.4 useEffect 和 useLayoutEffect 有什么区别？

### 时序定位

两者都在 **DOM 已更新之后**触发，区别是 **paint 前同步**还是 **paint 后异步**：

- `useLayoutEffect`：commit 的 layout 子阶段同步执行，此时尚未 paint。
- `useEffect`：由 Scheduler 在 paint 之后异步执行。

### 核心原理

```
render 阶段  →  commit: beforeMutation  →  mutation（改 DOM）  →  layout  →  paint  →  被动 effect
                                                    ↑                          ↑              ↑
                                          cleanup(useLayoutEffect)      useLayoutEffect   useEffect
```

`useLayoutEffect` 的 cleanup 在 mutation 阶段、DOM 变更之后执行；setup 在随后的 layout 阶段执行。

| 维度 | `useLayoutEffect` | `useEffect` |
|---|---|---|
| **是否阻塞绘制** | ✅ 阻塞（回调里的耗时会直接拖慢首屏） | ❌ 不阻塞 |
| **典型用途** | 读布局（`offsetWidth`、`scrollHeight`、`getBoundingClientRect`）、在 paint 前修改 DOM 防闪烁 | 请求、订阅、日志、非视觉相关副作用 |
| **执行顺序** | 先（子 → 父） | 后（子 → 父，且在所有 layout effect 之后） |

**什么时候必须用 `useLayoutEffect`**——判断标准只有一条：**"如果这段逻辑放到 paint 之后执行，用户会看到闪烁或错位吗？"**

```jsx
// 经典场景：tooltip 位置测量，必须在 paint 前定好位置，否则会看到它从角落"跳"过去
useLayoutEffect(() => {
  const { height } = ref.current.getBoundingClientRect();
  setTop(-height - 8);
}, [content]);
```

`useLayoutEffect` 依赖 DOM 布局，服务端没有布局引擎，React 在 SSR 时会跳过它并打印 warning。SSR 场景下常用 `useIsomorphicLayoutEffect` 兼容：

```js
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;
```

### 口述参考

- `useLayoutEffect` 的回调在 paint 前跑完，会阻塞绘制，耗时会拖慢首屏。
- `useEffect` 不阻塞绘制，但如果在里面改视觉，用户会先看到旧画面再跳变。
- 选择标准：放到 paint 后执行会闪烁或错位 → `useLayoutEffect`；否则默认 `useEffect`；SSR 用 isomorphic 写法。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 全都用 `useLayoutEffect` 行吗？ | 不行：阻塞绘制、SSR 警告、无谓拖慢首屏；默认用 `useEffect` |
| 它在 SSR 里真的不执行吗？ | 是，服务端跳过并 warning；`useInsertionEffect`（CSS-in-JS）更早 |
| 和 `componentDidMount` 的时机关系？ | `useLayoutEffect` 与 `componentDidMount` 同在 layout 子阶段、paint 前；`useEffect` 在 paint 后 |

---

## 本册自测

1. 父子组件挂载时，`componentDidMount` 谁先执行？卸载时 `componentWillUnmount` 谁先？
2. 三个 `componentWillXxx` 为什么被废弃？各自的替代是什么？
3. `useEffect(fn, [])` 里的 `fn` 在 StrictMode 开发环境执行几次？为什么？
4. 依赖数组里写 `[{ id }]` 会发生什么？为什么？
5. 什么情况下必须用 `useLayoutEffect`？给出一个具体场景。
6. `useEffect` 的 cleanup 在"依赖变化"时执行吗？执行顺序是什么？
7. 为什么 `useEffect(async () => {})` 会报错？
