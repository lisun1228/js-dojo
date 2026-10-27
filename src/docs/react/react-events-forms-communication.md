# React 06｜事件、表单与组件通信

> 覆盖原题：8、10、11、16、23、28、29、34、35、38、72、73、82（13 题 → **5 个考点**）
> 高频追问集中在两处：合成事件的委托位置、ref 三件套的链条关系。

---

## 目录

- [本册速查](#本册速查)
- [6.1 React 的合成事件是什么？](#61-react-的合成事件是什么)
- [6.2 受控组件和非受控组件有什么区别？](#62-受控组件和非受控组件有什么区别)
- [6.3 什么是高阶组件（HOC）？](#63-什么是高阶组件hoc)
- [6.4 Portal 有什么用？](#64-portal-有什么用)
- [6.5 useRef、forwardRef、useImperativeHandle 分别有什么用？](#65-userefforwardrefuseimperativehandle-分别有什么用)
- [本册自测](#本册自测)

---

## 本册速查

| 考点 | 合并自 | 一句话答案 |
|---|---|---|
| 6.1 合成事件与事件系统 | 16、23、73 | 包装原生事件，多数事件委托到根容器（React 17+） |
| 6.2 受控组件与非受控组件 | 8、35、82 | 值由 state 驱动 vs 值由 DOM 自己管，靠 ref 读 |
| 6.3 高阶组件 HOC | 10、38 | 接收组件返回新组件的函数，用组合复用逻辑 |
| 6.4 Portal | 11 | 把 DOM 渲染到别处，但 React 树位置不变（事件、Context 照常） |
| 6.5 ref 三件套 | 28、29、34、72 | useRef 存值、forwardRef 转发、useImperativeHandle 收窄暴露面 |

---

## 6.1 React 的合成事件是什么？

> 原题：**16.**「React 把事件委托到 root，统一封装（跨浏览器），批处理。不是原生事件。」
> **23 / 73.**「同第 16 题。」

### 核心原理

**① 什么是合成事件（SyntheticEvent）**

React 自己实现的事件对象，包装原生事件：

```js
{
  nativeEvent,          // 原生事件对象
  type, target, currentTarget,
  preventDefault(), stopPropagation(),
}
```

目的：

| 目的 | 说明 |
|---|---|
| **跨浏览器一致性** | 抹平不同浏览器在 `event.target`、`preventDefault` 等上的差异 |
| **减少监听器数量** | 同类事件只在根容器挂一个监听器，不逐节点绑定；官方将其列为大树的性能收益 |
| **接入调度** | 回调在 React 的调度上下文中执行，可参与批处理与优先级标记 |

**② 事件委托：绑在哪里**

| 版本 | 绑定位置 | 原因 |
|---|---|---|
| React 16 及以前 | `document` | 一处监听全部 |
| **React 17+** | **根容器**（`ReactDOM.render` / `createRoot` 的 container） | 多版本 React 共存时，`document` 上的监听会互相干扰；嵌套树调用 `stopPropagation` 也会影响外层树 |

```
React 17+：
  <div id="root">   ← 事件监听器挂在这里
    <button onClick={...}>
  </div>
```

**事件流**：点击 button → 原生事件冒泡到根容器 → React 用 `event.target` 找到对应 fiber → 沿 `return` 指针向上收集所有 `onClick` → 按捕获/冒泡顺序执行 → 返回合成事件对象。

边界：Portal 容器也会单独挂监听器，所以 Portal 内的事件仍按 React 树冒泡；`onScroll` 不冒泡，不能依赖父级监听子元素的滚动。

**③ 和原生事件混用时的顺序**

```jsx
useEffect(() => {
  document.addEventListener('click', nativeHandler);   // 原生：绑在 document
}, []);

<div onClick={reactHandler}>                            // React：委托在 root
```

点击后顺序：

```
① 原生事件冒泡到 root → React 监听器触发 → reactHandler
② 继续冒泡到 document → nativeHandler
```

**结论**：React 17+ 下 root 在 document 内层，document 冒泡阶段的原生监听晚于 React 回调；在 React 回调里调用 `e.stopPropagation()` 会阻止事件继续到达 document。React 16 及以前 React 监听器也在 document，顺序取决于监听器注册顺序，且 `stopPropagation()` 无法阻止 document 上的其他监听。

**④ 三个版本行为**

| 项 | 变化 |
|---|---|
| **事件池（Event Pooling）** | 16 及以前复用事件对象，异步访问需要 `event.persist()`；React 17 起移除事件池，`event.persist()` 仍存在但为空操作 |
| **`onScroll` 不冒泡** | React 17 起对齐浏览器行为，子元素滚动不会触发父级 `onScroll` |
| **`onFocus` / `onBlur`** | React 中一直会冒泡（原生 `focus` / `blur` 不冒泡）；React 17 起底层改用 `focusin` / `focusout` |

### 口述参考

- 合成事件是 React 包装原生事件后的事件对象，用来抹平浏览器差异。
- 大多数事件不在元素上单独绑定，而由根容器上的监听器统一接收；React 17 起监听位置从 `document` 移到根容器，目的是隔离多版本 React / 微前端。
- 原生事件冒泡到根容器后，React 用 `target` 找到 fiber，沿 `return` 链收集 handler，再按 React 树的捕获/冒泡顺序执行。
- 与原生混用：17+ 下 document 冒泡监听到得更晚；React 回调里的 `stopPropagation()` 会阻断它。
- 版本差异：17 移除事件池；`onScroll` 不再冒泡；`onFocus` / `onBlur` 一直冒泡，底层改为 `focusin` / `focusout`。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 为什么 17 要从 document 改到 root？ | 多版本 React 共存时 document 上的监听会互相触发；嵌套树调用 `stopPropagation` 也无法只作用于自身 |
| React 事件和原生事件谁先执行？ | 17+：document 冒泡阶段监听晚于 root 上的 React 回调；16 及以前两者都在 document，顺序取决于注册顺序 |
| 能在 React 事件里拿到原生事件吗？ | `e.nativeEvent`；也能拿 `e.target`（DOM 节点） |
| 事件池是什么？现在还有吗？ | 16 复用事件对象，异步访问需 `persist()`；17 起移除事件池，`persist()` 保留但为空操作 |
| 为什么 `onScroll` 不冒泡？ | React 17 起对齐浏览器行为，避免嵌套滚动元素在远端父级触发回调 |
| `e.stopPropagation()` 能阻止 document 上的原生监听吗？ | 能。React 17+ 的事件已冒泡到 root，继续调用原生 `stopPropagation` 会阻止到 document |
| 自定义组件上的 `onClick` 会生效吗？ | 不会自动生效，必须由组件内部把它透传到某个 DOM 元素上 |
| 合成事件比原生事件快吗？ | 不能这样断言。React 17 移除事件池的理由正是它在现代浏览器中不再提升性能；合成事件的价值是一致性与调度接入 |

---

## 6.2 受控组件和非受控组件有什么区别？

> 原题：**8.**「受控组件：表单值由 state 控制，onChange 更新。非受控组件：DOM 自己管值，ref 取。推荐受控组件。」
> **35 / 82.**「同第 8 题。」

### 核心原理

**① 对比表**

| 维度 | 受控组件 | 非受控组件 |
|---|---|---|
| **数据源** | React state（唯一真相） | DOM 节点自身 |
| **写法** | `value` + `onChange` | `defaultValue` + `ref` |
| **取值时机** | 每次输入都在 state 里 | 提交时 `ref.current.value` |
| **能否实时校验/联动/格式化** | ✅ 天然支持 | ❌ 需要手动读 DOM |
| **性能** | 每次输入触发渲染 | 不触发渲染 |
| **外部改值/重置** | 改 state 即可 | 改 DOM 或 `form.reset()` |

```jsx
// 受控
<input value={name} onChange={e => setName(e.target.value)} />

// 非受控
const ref = useRef(null);
<input defaultValue="Tom" ref={ref} />
// 提交时：ref.current.value
```

**② 什么时候必须/适合用非受控**

| 场景 | 原因 |
|---|---|
| **`<input type="file">`** | 出于安全，`value` 是只读的，只能非受控 |
| 大表单、性能敏感 | 每次输入都重渲染整棵表单树代价高（react-hook-form 就是非受控思路 + 局部订阅） |
| 与第三方非 React 库集成 | 如富文本编辑器、日期选择器、地图，它们自己管理 DOM |
| 一次性读取（提交时取值） | 不需要实时同步到 state |
| 表单需要被命令式重置 | 用 `ref.current.reset()` 或改 `key` |

**③ 常见错误**

```jsx
// ❌ 有 value 没有 onChange → 只读，控制台警告
<input value={name} />

// ❌ 同时给 value 和 defaultValue → defaultValue 被忽略
<input value={name} defaultValue="x" onChange={...} />

// ❌ 受控值初始为 undefined → 从非受控变受控（警告）
const [v, setV] = useState();       // 用 useState('') 或 ?? ''
```

**④ 受控组件的性能优化**

- 把输入框拆成独立子组件，`value` 只影响它自己；
- 用 `useRef` 存值 + `onBlur` 提交（社区常说的“半受控”）；
- 用 `react-hook-form` 这类非受控 + 订阅的方案；
- 大列表联动时用 `useDeferredValue` 降级非紧急更新。

### 口述参考

- 区别在于值是否由 React state 驱动：受控写 `value` + `onChange`，state 是唯一真相；非受控写 `defaultValue`，值由 DOM 维护，需要时用 `ref` 读。
- 受控能实时校验、格式化、联动，也能从外部重置；代价是每次输入都 setState、触发渲染。
- 非受控不触发渲染，适合一次性取值的大表单和自管 DOM 的第三方库；`<input type="file">` 只能非受控，因为 `value` 只读。
- 默认选受控；字段很多或性能敏感时用非受控 + ref（react-hook-form 即此模式）。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 为什么 file input 必须非受控？ | `value` 出于安全是只读的，只能设置空字符串；文件只能通过 `ref.current.files` 读 |
| 受控组件性能差怎么优化？ | 拆子组件缩小渲染范围、`onBlur` 提交、非受控 + 订阅（react-hook-form）、`useDeferredValue` |
| 受控输入框光标跳到末尾是怎么回事？ | 异步 setState 导致 value 回退（如格式化后长度变化），或 value 与实际输入不同步；可用 `useLayoutEffect` 修正光标 |
| 怎么重置表单？ | 受控：`setState(initial)`；非受控：`formRef.current.reset()` 或改 `key` 强制重建 |
| 半受控是什么？ | 社区说法：输入过程不逐字符写 state，用 `ref` / 非受控存值，提交或失焦时再同步 |
| 受控一定更好吗？ | 不是。大表单下每次输入触发渲染可能是负优化；按是否需要实时控制来选 |
| 非受控组件不能用 state 吗？ | 可以，只是不用 state 驱动值，state 仍可存提交结果或其他派生数据 |

---

## 6.3 什么是高阶组件（HOC）？

> 原题：**10.**「函数接收组件返回新组件，复用逻辑。如 withRouter、connect。」
> **38.**「同第 10 题。」

### 核心原理

**① 定义**

```js
const Enhanced = withSomething(WrappedComponent);
// withSomething: (Component) => Component
```

它**不是组件**，是**函数**；它**不修改**原组件，而是**包装**（组合）。

**② 三类用途**

| 用途 | 例子 |
|---|---|
| **注入 props** | `connect(mapState)(Comp)`、`withRouter(Comp)` |
| **横切关注点** | 权限校验 `withAuth`、埋点 `withTracking`、错误边界 `withErrorBoundary`、加载态 `withLoading` |
| **渲染控制** | `memo`、`forwardRef` 本质也是 HOC 思想 |

```jsx
function withAuth(Wrapped) {
  return function AuthWrapper(props) {
    const user = useUser();
    if (!user) return <Login />;
    return <Wrapped {...props} user={user} />;
  };
}
```

**③ 五条约定**

1. **透传无关 props**：`<Wrapped {...props} />`，否则原组件的 props 会丢。
2. **不要修改原组件**：不要 `Wrapped.prototype.xxx = ...`，用组合。
3. **`displayName`**：`AuthWrapper.displayName = \`withAuth(${getDisplayName(Wrapped)})\``，否则 DevTools 里全是 `AuthWrapper`。
4. **静态方法会丢**：需要 `hoist-non-react-statics` 提升。
5. **`ref` 不会透传**：HOC 包了一层，`ref` 指向包装组件；需要 `forwardRef` 转进去。

**④ 缺点**

| 缺点 | 说明 |
|---|---|
| 嵌套地狱 | `withA(withB(withC(Comp)))`，DevTools 里层层包裹 |
| props 命名冲突 | 两个 HOC 都注入 `data`，后者覆盖前者 |
| 来源不透明 | 组件里的 `user` 从哪来的？要一层层翻 |
| 额外层级 | 每次渲染多一层组件 |
| 静态类型难写 | TS 下 HOC 的类型推导很痛苦 |

### 口述参考

- HOC 是接收组件、返回新组件的函数，本身不是组件，也不修改原组件，而是组合包装。
- 主要用途：注入 props（`connect`、`withRouter`）和处理横切关注点（权限、埋点、错误边界、加载态）。
- 必须透传无关 props、设置 `displayName`；静态方法要靠 `hoist-non-react-statics` 提升，`ref` 要靠 `forwardRef` 转发。
- 缺点是嵌套多、props 易冲突、数据来源不透明；逻辑复用优先用自定义 Hook，需要包裹渲染时仍可用 HOC。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| HOC 和 Hook 怎么选？ | 需要"包裹渲染"（权限、错误边界、Suspense）→ HOC/组件；只需要"复用逻辑"→ Hook |
| HOC 和 render props 区别？ | HOC 返回组件（组合在外部），render props 把渲染函数作为 prop（组合在内部）；Hook 是两者之后的最优解 |
| 为什么 `connect` 是 HOC 而不是 Hook？ | 历史原因（Hooks 在 16.8 才出现）；现在有 `useSelector/useDispatch` 替代 |
| HOC 怎么透传 ref？ | 外层包 `forwardRef`，把 ref 转给内层 `Wrapped` |
| HOC 会导致重复渲染吗？ | 会多一层组件，但本身不额外渲染子树；注意不要在 HOC 里创建内联对象 props |
| 多个 HOC 的执行顺序？ | 表达式求值由内向外，`withA(withB(C))` 先执行 `withB(C)`；渲染由外向内，A 的包装组件先渲染，B 次之，C 最后 |

---

## 6.4 Portal 有什么用？

> 原题：**11.**「把组件渲染到 DOM 其他节点（如 body），常用于模态框、tooltip。」

### 核心原理

```jsx
import { createPortal } from 'react-dom';

createPortal(children, container, key?)
```

**① 它改的是"DOM 位置"，不是"React 树位置"**

```
React 树：          App → Modal（逻辑上仍是 App 的子节点）
                          ↓ createPortal
真实 DOM：  body → #modal-root → 弹窗内容
```

由此推出三个"照常"：

| 行为 | 是否照常 |
|---|---|
| **Context** | ✅ 照常穿透（按 React 树） |
| **合成事件冒泡** | ✅ 照常冒泡到 React 父组件（按 React 树，不按 DOM 树） |
| **React DevTools 组件树** | ✅ 位置不变 |

**② 为什么需要它**

| 问题 | Portal 的解法 |
|---|---|
| 父级 `overflow: hidden` 裁剪弹窗 | 挂到 body 下，脱离裁剪上下文 |
| 父级 `transform` / `filter` 创建新的包含块，导致 `position: fixed` 失效 | 挂到 body 下，恢复以视口定位 |
| 父级 `z-index` 层叠上下文限制 | 挂到 body 下，与控制层同层 |
| 弹窗被父组件的 `onClick` 误捕获 | 用 `e.stopPropagation()` 或挂到独立容器（**注意事件仍会冒泡**） |

**③ 三个实践要点**

1. **容器要自己建**：`document.body` 直接用可以，但更推荐单独建一个 `#modal-root`，便于控制层叠与清理。
2. **SSR 要判断**：`document` 在服务端不存在，需要 `typeof document !== 'undefined'` 或 `useEffect` 后再渲染。
3. **可访问性要做**：Portal 只解决"渲染到哪"，焦点陷阱（focus trap）、`aria-modal`、`Esc` 关闭、滚动锁定都要自己做；或者用原生 `<dialog>`。

### 口述参考

- Portal 把子节点渲染到 DOM 树的其他位置（通常是 body），但它在 React 树里的位置不变。
- 三个"照常"：Context 照常穿透、合成事件照常按 React 树冒泡、DevTools 里位置不变。
- 用途是模态框、抽屉、tooltip、toast，用来绕开父级的 `overflow: hidden`、`transform` 包含块和 `z-index` 层叠上下文。
- 实践上：自建 `#modal-root`、SSR 判断 `document`、自行处理焦点陷阱 / `aria` / `Esc` / 滚动锁定，或直接用原生 `<dialog>`。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| Portal 里的事件会冒泡到 React 父组件吗？ | 会。合成事件按 React 树传播，不按 DOM 树。不想触发就 `stopPropagation` |
| CSS 继承按哪个树？ | 按真实 DOM 树（DOM 位置变了，样式继承关系也变了） |
| Portal 能解决 z-index 问题吗？ | 只能绕开父级层叠上下文；同级之间仍要比 z-index，建议统一用设计系统的层级变量 |
| 用 `document.body` 还是自建容器？ | 自建 `#modal-root`，便于清理、层级管理与多实例隔离 |
| Portal 和 `position: fixed` 的关系？ | 父级有 `transform` 会让 `fixed` 相对父级定位，Portal 到 body 可恢复视口定位 |
| 多个 Portal 层级怎么管？ | 用递增的 z-index 或渲染顺序（后渲染的在上），配合统一的 ModalManager |

---

## 6.5 useRef、forwardRef、useImperativeHandle 分别有什么用？

> 原题：**29.**「存可变值（不触发渲染）、获取 DOM。」**72.**「同第 29 题。」
> **28.**「把子组件 ref 转发到内部 DOM 或组件。」**34.**「配合 forwardRef，自定义暴露给父组件的实例值。」
>
> 三个 Hook 是一条链：**`useRef` 造引用 → `forwardRef` 把引用传进去 → `useImperativeHandle` 决定暴露什么**。

### 核心原理

**① `useRef`：一个跨渲染稳定的盒子**

```js
const ref = useRef(initialValue);   // 返回 { current: initialValue }
```

两个特性：
- **引用永不变**（每次渲染拿到同一个对象）；
- **改 `current` 不触发渲染**（它不是 state）。

三类用法：

```js
// 1. DOM 引用
const inputRef = useRef(null);
<input ref={inputRef} />;  inputRef.current.focus();

// 2. 存"不需要渲染"的可变值
const timerRef = useRef(null);       // 定时器 id
const prevValueRef = useRef();       // 上一次的值
const isFirstRender = useRef(true);  // 是否首次渲染

// 3. 在 effect 里存最新值，绕过闭包
const latestCb = useRef(cb);
useEffect(() => { latestCb.current = cb; });
```

**② `forwardRef`：函数组件接收 ref**

函数组件没有实例，`ref` 不能像 class 那样指到 `this`。所以默认情况下：

```jsx
<MyInput ref={r} />   // ❌ 警告：Function components cannot be given refs
```

需要显式转发：

```jsx
const MyInput = forwardRef((props, ref) => (
  <input ref={ref} {...props} />
));
```

> **React 19 变化**：`ref` 成为普通 prop，函数组件可以直接 `function MyInput({ ref, ...props })`；`forwardRef` 变为可选，未来版本会废弃并移除。

**③ `useImperativeHandle`：只暴露你愿意暴露的**

```jsx
const FancyInput = forwardRef((props, ref) => {
  const inputRef = useRef(null);
  const focus = () => inputRef.current.focus();

  useImperativeHandle(ref, () => ({
    focus,
    // 不暴露 inputRef.current 这个原始 DOM
  }), []);

  return <input ref={inputRef} {...props} />;
});
```

对比：

| 方式 | 父组件拿到的 |
|---|---|
| 不用 `useImperativeHandle` | 整个 DOM 节点（可以随便改 `value`、`style`、`parentNode`） |
| 用 `useImperativeHandle` | 只有 `{ focus }`，**封装边界清晰** |

它的价值：**把"命令式 API"当成组件的公开接口来设计**，而不是把 DOM 泄漏出去。

**④ 什么时候不该用 ref**

| 不该用的场景 | 更好的做法 |
|---|---|
| 父组件改子组件状态，或兄弟组件传数据 | 状态提升、受控 props 或 Context |
| 想在 render 里读 ref 做渲染决策 | 用 state（并发下 render 可能被丢弃，ref 读写不安全） |
| 想"直接操作 DOM 提高性能" | 先确认真的有必要（虚拟列表、动画库是合理场景） |

### 口述参考

- 三者是一条链：`useRef` 创建稳定引用，`forwardRef` 把引用传进函数组件，`useImperativeHandle` 决定对外暴露什么。
- `useRef` 返回带 `current` 的盒子，引用跨渲染不变，改 `current` 不触发渲染；常用于 DOM、定时器 id、上一次的值和绕过闭包的最新回调。
- `forwardRef` 解决函数组件没有实例、不能直接接收 `ref` 的问题；React 19 起 `ref` 是普通 prop，`forwardRef` 变为可选。
- `useImperativeHandle` 只暴露必要方法（如 `focus`），避免把整个 DOM 泄漏给父组件。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| `useRef` 和 `createRef` 区别？ | `createRef` 每次渲染新建对象（class 里配 `this.ref` 用）；`useRef` 引用稳定 |
| `useRef` 和 `useState` 怎么选？ | 是否要触发渲染。定时器、DOM、上一次值 → ref |
| 为什么不能在 render 里读写 ref？ | 并发下 render 可能被中断/丢弃，ref 的读写会重复或读到不一致的值；应该在 effect 或事件里操作 |
| `forwardRef` 能转发给另一个函数组件吗？ | 可以，但那个组件也必须能接收 ref（`forwardRef` 或 React 19 的 ref prop） |
| `useImperativeHandle` 的依赖数组？ | 第三个参数，方法里用到的外部值时必须写，否则闭包过期 |
| ref 能拿到函数组件的实例吗？ | 不能，函数组件没有实例；只能通过 `useImperativeHandle` 暴露自定义句柄 |
| 多个 ref 怎么合并？ | 写一个 `mergeRefs` 或 `useComposedRefs`（Radix 有实现） |

---

## 本册自测

- [ ] React 17 之后事件委托绑在哪里？为什么改？
- [ ] 合成事件和绑在 `document` 上的原生监听，谁先执行？
- [ ] 为什么 `<input type="file">` 必须用非受控？
- [ ] HOC 会丢失什么？怎么补？
- [ ] Portal 里渲染的元素，事件会冒泡到 React 父组件吗？
- [ ] `useRef`、`forwardRef`、`useImperativeHandle` 三者的关系是什么？
- [ ] 什么时候不该用 ref？
