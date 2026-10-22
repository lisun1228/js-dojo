# React 06｜事件、表单与组件通信

> 覆盖原题：8、10、11、16、23、28、29、34、35、38、72、73、82（13 题 → **5 个考点**）
> 这一册都是"用过就会、说清才加分"的点。最容易拉开差距的是 **ref 三件套**和**合成事件的事件委托细节**。

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
| 6.1 合成事件与事件系统 | 16、23、73 | 事件委托到根容器 + 统一封装，不是原生事件，但走的是原生事件冒泡 |
| 6.2 受控组件与非受控组件 | 8、35、82 | 值由 state 驱动 vs 值由 DOM 自己管，靠 ref 读 |
| 6.3 高阶组件 HOC | 10、38 | 接收组件返回新组件的函数，用组合复用逻辑 |
| 6.4 Portal | 11 | 把 DOM 渲染到别处，但 React 树位置不变（事件、Context 照常） |
| 6.5 ref 三件套 | 28、29、34、72 | useRef 存值、forwardRef 转发、useImperativeHandle 收窄暴露面 |

---

## 6.1 React 的合成事件是什么？

> 原题：**16.**「React 把事件委托到 root，统一封装（跨浏览器），批处理。不是原生事件。」
> **23 / 73.**「同第 16 题。」

原答案的三个关键词都在，但**"委托到 root"在 React 17 变了**（以前是 `document`），这一点能说出来就是深度分。

### 核心原理

**① 什么是合成事件（SyntheticEvent）**

React 自己实现的一套事件对象，包装了原生事件：

```js
{
  nativeEvent,          // 原生事件对象
  type, target, currentTarget,
  preventDefault(), stopPropagation(),
  _reactName: 'onClick',
  // React 17 之前还有 event.persist()（事件池）
}
```

目的：

| 目的 | 说明 |
|---|---|
| **跨浏览器一致性** | 抹平 IE/Chrome/Safari 在 `event.target`、`preventDefault` 等上的差异 |
| **减少事件监听器数量** | 不在每个 DOM 上绑，而是统一委托，内存与初始化成本更低 |
| **统一接入调度** | 事件回调里能直接做批处理、优先级标记（离散事件优先） |
| **跨平台** | 事件系统与 Renderer 解耦，RN 里同一套 `onPress` 语义 |

**② 事件委托：绑在哪里**

| 版本 | 绑定位置 | 原因 |
|---|---|---|
| React 16 及以前 | `document` | 简单，一处监听全部 |
| **React 17+** | **根容器**（`createRoot(container)` 的 container） | 多版本 React 共存时，`document` 上的监听会互相干扰；微前端、渐进式升级场景需要隔离 |

```
React 17+：
  <div id="root">   ← 所有事件监听器挂在这里
    <button onClick={...}>
  </div>
```

**事件流**：点击 button → 原生事件冒泡到 root → React 在 root 的监听器里，用 `event.target` 找到对应的 fiber → 从该 fiber 沿 `return` 指针向上收集所有 `onClick`（**模拟捕获/冒泡两个阶段**）→ 依次执行 → 返回合成事件对象。

**③ 和原生事件混用时的顺序（高频追问）**

```jsx
useEffect(() => {
  document.addEventListener('click', nativeHandler);   // 原生：绑在 document
}, []);

<div onClick={reactHandler}>                            // React：委托在 root
```

点击后顺序：

```
① root 上的 React 监听器先触发 → 执行 reactHandler（因为 root 比 document 更内层）
② 继续冒泡到 document → 执行 nativeHandler
```

**结论：React 17 起，React 事件回调比绑在 `document` 上的原生监听更早执行。**（16 及以前相反。）

**④ 三个必须知道的变化**

| 项 | 变化 |
|---|---|
| **事件池（Event Pooling）** | React 16 会复用事件对象，异步访问需要 `event.persist()`；**React 17 起取消事件池**，可以安全地在异步里访问 `event.target` |
| **`onScroll` 不冒泡** | 它在 React 里也不走委托（直接绑在元素上），所以 `onScroll` 不会像其他事件那样"自动冒泡到父级" |
| **`onFocus` / `onBlur`** | React 用 `focusin` / `focusout` 模拟，所以它们**能冒泡** |

### 答题思路与要点顺序

1. **定义**：React 自己实现的事件系统，包装原生事件，保证跨浏览器/跨平台一致。（15 秒）
2. **委托**：所有事件委托到根容器（17 之前是 document），用 `event.target` 反查 fiber，再沿 return 链模拟冒泡。（30 秒，**核心**）
3. **收益**：少监听器、跨浏览器、能接入调度与批处理。（20 秒）
4. **差异**：17 起取消事件池、监听位置从 document 改为 root；`onScroll` 不委托、`focus/blur` 用 focusin/focusout 模拟。（25 秒，深度分）
5. **和原生混用**：React 回调早于 document 上的原生监听。

### 口述参考

> 合成事件是 React 自己实现的一套事件系统，它包装了原生事件对象，抹平浏览器差异，同时把事件委托到根容器上，而不是每个元素单独绑。
>
> 具体流程是：点击一个按钮，原生事件冒泡到根容器，React 在根容器的监听器里通过 event.target 找到对应的 fiber 节点，然后沿着 fiber 的 return 指针往上收集所有绑了 onClick 的组件，模拟出捕获和冒泡两个阶段依次执行。所以你在 React 里写的 onClick 其实是"被 root 上的一个监听器统一调度"的。
>
> 这样做的好处是监听器数量少、跨浏览器一致，而且事件回调天然处在 React 的调度上下文里，可以做批处理和优先级标记，输入类事件会被当作离散事件优先处理。
>
> 有几个版本差异值得说：React 17 把委托位置从 document 改到了根容器，主要是为了多版本共存和微前端隔离；同版本还取消了事件池，所以异步里访问 event 不用再 persist 了。另外 onScroll 在 React 里不走委托，onFocus/onBlur 是用 focusin/focusout 模拟的，所以它们能冒泡。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 为什么 17 要从 document 改到 root？ | 多版本 React 共存时 document 上的监听会互相触发；微前端、渐进式升级需要事件隔离 |
| React 事件和原生事件谁先执行？ | 17+：React 先（root 在内层）；16：原生先（都在 document，按绑定顺序） |
| 能在 React 事件里拿到原生事件吗？ | `e.nativeEvent`；也能拿 `e.target`（DOM 节点） |
| 事件池是什么？现在还有吗？ | 16 复用事件对象，异步访问会失效，需 `persist()`；17 起取消 |
| 为什么 `onScroll` 不冒泡？ | 它不参与委托，直接绑在元素上 |
| `e.stopPropagation()` 能阻止 document 上的原生监听吗？ | 能。React 的合成事件最终调用的是原生 `stopPropagation`，会阻止继续冒泡到 document |
| 自定义组件上的 `onClick` 会生效吗？ | 不会自动生效，必须由组件内部把它透传到某个 DOM 元素上 |

### 加分点与易错点

- ✅ **加分**：说清"root 监听器 + 沿 fiber return 链模拟冒泡"这个机制；说出 17 的两个变化（委托位置、事件池）。
- ⚠️ **易错**：说"合成事件比原生事件快"——它的价值是一致性与调度接入，本身有一层包装开销。
- ⚠️ **易错**：说"React 事件绑定在 document 上"——17 之后不是了。

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
| **受 React 并发/状态控制** | ✅ 完全可控（可用于受控重置、联动） | ❌ 无法从外部直接改值（要改 DOM） |

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
- 用 `useRef` 存值 + `onBlur` 提交（半受控）；
- 用 `react-hook-form` 这类非受控 + 订阅的方案；
- 大列表联动时用 `useDeferredValue` 降级非紧急更新。

### 答题思路与要点顺序

1. **一句话区分**：值由 state 驱动，还是由 DOM 自己管。（10 秒）
2. **写法对照**：`value + onChange` vs `defaultValue + ref`。（15 秒）
3. **取舍**：受控 = 可控、可校验、可联动，代价是渲染次数；非受控 = 轻、快，代价是失去实时控制。（30 秒）
4. **必须非受控的场景**：file input（重点，很多人不知道）。（15 秒）
5. **收尾**：默认用受控；大表单/文件/第三方库用非受控。

### 口述参考

> 区别就一句话：值是不是由 React 的 state 驱动。受控组件写 value 加 onChange，输入的值存在 state 里，state 是唯一真相；非受控组件写 defaultValue，值由 DOM 自己维护，需要的时候用 ref 去读。
>
> 受控的好处是完全可控：能做实时校验、输入格式化、和别的字段联动、也能从外部重置值。代价是每次输入都要 setState、触发渲染，表单大的时候开销明显。
>
> 非受控轻，不触发渲染，适合一次性取值的大表单，也适合和第三方库集成，比如富文本编辑器、日期选择器，它们自己管 DOM。还有一个必须用非受控的场景是 file input，因为出于安全 value 是只读的，只能通过 ref 读 files。
>
> 所以我的默认选择是受控，但表单字段很多、或者有性能问题时，会用非受控加 ref 的思路，react-hook-form 就是这个模式。
>
> 另外有两个常见错误：给了 value 不给 onChange 会变成只读；value 初始是 undefined 也会警告，要先给空字符串。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 为什么 file input 必须非受控？ | `value` 出于安全是只读的，只能设置空字符串；文件只能通过 `ref.current.files` 读 |
| 受控组件性能差怎么优化？ | 拆子组件缩小渲染范围、`onBlur` 提交、非受控 + 订阅（react-hook-form）、`useDeferredValue` |
| 受控输入框光标跳到末尾是怎么回事？ | 异步 setState 导致 value 回退（如格式化后长度变化），或 value 与实际输入不同步；可用 `useLayoutEffect` 修正光标 |
| 怎么重置表单？ | 受控：`setState(initial)`；非受控：`formRef.current.reset()` 或改 `key` 强制重建 |
| 半受控是什么？ | `value` 受控但只在必要时更新（如 `defaultValue` + `onChange` 存 ref），兼顾可控与性能 |

### 加分点与易错点

- ✅ **加分**：说出 file input 的限制；说出 react-hook-form 的非受控思路；提到光标位置这个真实坑。
- ⚠️ **易错**：说"非受控组件不能用 state"——可以用，只是不用 state 驱动值。
- ⚠️ **易错**：认为"受控一定更好"——大表单场景下是负优化。

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

**③ 五条约定（面试加分）**

1. **透传无关 props**：`<Wrapped {...props} />`，否则原组件的 props 会丢。
2. **不要修改原组件**：不要 `Wrapped.prototype.xxx = ...`，用组合。
3. **`displayName`**：`AuthWrapper.displayName = \`withAuth(${getDisplayName(Wrapped)})\``，否则 DevTools 里全是 `AuthWrapper`。
4. **静态方法会丢**：需要 `hoist-non-react-statics` 提升。
5. **`ref` 不会透传**：HOC 包了一层，`ref` 指向包装组件；需要 `forwardRef` 转进去。

**④ 缺点（这也是 Hooks 取代它的原因）**

| 缺点 | 说明 |
|---|---|
| 嵌套地狱 | `withA(withB(withC(Comp)))`，DevTools 里层层包裹 |
| props 命名冲突 | 两个 HOC 都注入 `data`，后者覆盖前者 |
| 来源不透明 | 组件里的 `user` 从哪来的？要一层层翻 |
| 额外层级 | 每次渲染多一层组件 |
| 静态类型难写 | TS 下 HOC 的类型推导很痛苦 |

### 答题思路与要点顺序

1. **定义**：参数是组件、返回新组件的**函数**（不是组件）。（10 秒）
2. **用途**：注入 props、横切关注点（权限/埋点/错误边界）。（20 秒）
3. **约定**：透传 props、不改原组件、displayName、静态方法、ref 转发。（30 秒，**这是深度分**）
4. **缺点**：嵌套、命名冲突、来源不明；引出 Hooks。（20 秒）
5. **收尾**：逻辑复用首选自定义 Hook，HOC 仍适合"结构性包裹"（权限、错误边界）。

### 口述参考

> 高阶组件是一个函数，接收一个组件作为参数，返回一个新的组件，形式是 Enhanced = withXxx(Wrapped)。注意它本身不是组件，是一个函数，而且它不修改原组件，是包装。
>
> 它的用途主要是两类：一是注入 props，比如 connect、withRouter；二是横切关注点，比如权限校验、埋点、错误边界、加载态。
>
> 写的时候有几个约定必须遵守：一定要把无关的 props 透传下去，否则原组件收不到；不要修改原组件，用组合；要设置 displayName，不然 DevTools 里全是 Wrapper；原组件的静态方法会丢，需要 hoist-non-react-statics 提升；ref 也不会自动透传，要配合 forwardRef。
>
> 它的缺点也很明显：嵌套层数多、props 可能命名冲突、数据来源不透明，而且 TS 下类型很难写。所以现在逻辑复用首选自定义 Hook，HOC 更多用在"必须包一层组件"的场景，比如权限和错误边界。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| HOC 和 Hook 怎么选？ | 需要"包裹渲染"（权限、错误边界、Suspense）→ HOC/组件；只需要"复用逻辑"→ Hook |
| HOC 和 render props 区别？ | HOC 返回组件（组合在外部），render props 把渲染函数作为 prop（组合在内部）；Hook 是两者之后的最优解 |
| 为什么 `connect` 是 HOC 而不是 Hook？ | 历史原因（Hooks 在 16.8 才出现）；现在有 `useSelector/useDispatch` 替代 |
| HOC 怎么透传 ref？ | 外层包 `forwardRef`，把 ref 转给内层 `Wrapped` |
| HOC 会导致重复渲染吗？ | 会多一层组件，但本身不额外渲染子树；注意不要在 HOC 里创建内联对象 props |
| 多个 HOC 的执行顺序？ | 由外到内：`withA(withB(C))` 中 A 先执行（包装在最外层） |

### 加分点与易错点

- ✅ **加分**：说出"静态方法丢失 / ref 不透传"这两个实战坑；说出 `memo`、`forwardRef` 也是 HOC 思想。
- ⚠️ **易错**：说"HOC 是组件"——它是函数。
- ⚠️ **易错**：在 HOC 里 `return <Wrapped />` 忘了 `{...props}`。

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

### 答题思路与要点顺序

1. **一句话**：把子节点渲染到 DOM 树的其他位置，但 React 树位置不变。（10 秒）
2. **用途**：Modal / Drawer / Tooltip / Toast，解决 overflow、transform、z-index 三类问题。（25 秒）
3. **三个"照常"**：Context、事件冒泡、DevTools。（20 秒，**这是追问高发区**）
4. **实践**：独立容器、SSR 判断、可访问性。（20 秒）
5. **收尾**：Portal 只解决定位问题，不解决交互问题。

### 口述参考

> Portal 是把子节点渲染到 DOM 树的其他位置，通常是 body 下面，但它在 React 树里的位置不变。所以它改变的只是"渲染到哪"，不是"逻辑上属于谁"。
>
> 这带来三个"照常"：Context 照常能穿透，因为按 React 树算；合成事件照常冒泡到 React 父组件，也是按 React 树，不按 DOM 树；DevTools 里位置也不变。
>
> 用到它的场景主要是模态框、抽屉、tooltip、toast。因为父级经常有 overflow: hidden 会裁掉弹窗，或者有 transform 创建了新的包含块让 position: fixed 失效，或者 z-index 被父级的层叠上下文限制住，挂到 body 下就都绕开了。
>
> 实践上有三点注意：最好单独建一个 modal-root 容器而不是直接用 body；SSR 下要判断 document 是否存在；还有 Portal 只解决渲染位置，焦点陷阱、aria 属性、Esc 关闭、滚动锁定这些可访问性的事还得自己做，或者直接用原生 dialog。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| Portal 里的事件会冒泡到 React 父组件吗？ | 会。合成事件按 React 树传播，不按 DOM 树。不想触发就 `stopPropagation` |
| CSS 继承按哪个树？ | 按真实 DOM 树（DOM 位置变了，样式继承关系也变了） |
| Portal 能解决 z-index 问题吗？ | 只能绕开父级层叠上下文；同级之间仍要比 z-index，建议统一用设计系统的层级变量 |
| 用 `document.body` 还是自建容器？ | 自建 `#modal-root`，便于清理、层级管理与多实例隔离 |
| Portal 和 `position: fixed` 的关系？ | 父级有 `transform` 会让 `fixed` 相对父级定位，Portal 到 body 可恢复视口定位 |
| 多个 Portal 层级怎么管？ | 用递增的 z-index 或渲染顺序（后渲染的在上），配合统一的 ModalManager |

### 加分点与易错点

- ✅ **加分**：说清"事件按 React 树冒泡"；提到 `transform` 会让 `fixed` 失效这个真实坑；提到可访问性。
- ⚠️ **易错**：以为 Portal 渲染的元素在 React 里"脱离"了父组件（Context、事件都还在）。

---

## 6.5 useRef、forwardRef、useImperativeHandle 分别有什么用？

> 原题：**29.**「存可变值（不触发渲染）、获取 DOM。」**72.**「同第 29 题。」
> **28.**「把子组件 ref 转发到内部 DOM 或组件。」**34.**「配合 forwardRef，自定义暴露给父组件的实例值。」

四个题号对应三个 Hook，必须放在一起讲——它们是一条链：**`useRef` 造引用 → `forwardRef` 把引用传进去 → `useImperativeHandle` 决定暴露什么**。

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

> **React 19 变化**：`ref` 成为普通 prop，函数组件可以直接 `function MyInput({ ref, ...props })`，`forwardRef` 变成可选（仍兼容）。这句话说出来很加分。

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

这就是它的价值：**把"命令式 API"当成组件的公开接口来设计**，而不是把 DOM 泄漏出去。

**④ 什么时候不该用 ref**

| 不该用的场景 | 更好的做法 |
|---|---|
| 想让父组件改子组件状态 | 状态提升 / 受控 props |
| 想在兄弟组件间传数据 | 提升状态 / Context |
| 想在 render 里读 ref 做渲染决策 | 用 state（并发下 render 可能被丢弃，ref 读写不安全） |
| 想"直接操作 DOM 提高性能" | 先确认真的有必要（虚拟列表、动画库是合理场景） |

### 答题思路与要点顺序

1. **先串成一条链**：`useRef` 造引用 → `forwardRef` 传进去 → `useImperativeHandle` 收窄暴露面。（15 秒，**先给结构，比逐个背强**）
2. **`useRef`**：引用稳定 + 改 current 不渲染；三类用途（DOM、可变值、绕过闭包）。（30 秒）
3. **`forwardRef`**：函数组件没有实例，需要显式转发；提 React 19 的 `ref as prop`。（20 秒）
4. **`useImperativeHandle`**：只暴露必要方法，避免泄漏 DOM。（20 秒）
5. **反向说明**：什么时候**不**该用 ref（状态提升、受控）。（15 秒，体现判断力）

### 口述参考

> 这三个其实是一条链：useRef 创建引用，forwardRef 把引用传进函数组件，useImperativeHandle 决定对外暴露什么。
>
> useRef 返回一个带 current 的盒子，引用在多次渲染之间不变，改 current 不会触发渲染。三个典型用法：拿 DOM、存不需要渲染的值比如定时器 id 和上一次的值、以及在 effect 里存最新回调来绕开闭包。
>
> forwardRef 是因为函数组件没有实例，直接传 ref 会警告，所以要显式转发到内部的 DOM 上。React 19 之后 ref 变成普通 prop 了，可以不解构 forwardRef，不过老代码还是这个写法。
>
> useImperativeHandle 是配合 forwardRef 用的，它让你决定父组件能拿到什么。比如只暴露一个 focus 方法，而不是把整个 input DOM 泄漏出去，父组件就没法乱改 value 和 style。我觉得它的价值是把命令式 API 当成组件的公开接口来设计。
>
> 反过来，如果我是想让父组件改子组件状态，或者兄弟之间传数据，那不该用 ref，应该用状态提升或者 Context。

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

### 加分点与易错点

- ✅ **加分**：说清三者的"链条"关系；提到 React 19 的 `ref as prop`；说出"把命令式 API 当公开接口设计"这个理念。
- ⚠️ **易错**：说"useRef 存的值变了组件会更新"——不会。
- ⚠️ **易错**：在 render 期间直接 `ref.current = x`（并发不安全）。

---

## 本册自测

1. React 17 之后事件委托绑在哪里？为什么改？
2. 合成事件和绑在 `document` 上的原生监听，谁先执行？
3. 为什么 `<input type="file">` 必须用非受控？
4. HOC 会丢失什么？怎么补？
5. Portal 里渲染的元素，事件会冒泡到 React 父组件吗？
6. `useRef`、`forwardRef`、`useImperativeHandle` 三者的关系是什么？
7. 什么时候不该用 ref？

<details>
<summary>自测参考答案要点</summary>

1. 根容器（`createRoot` 的 container）。为多版本 React 共存、微前端、渐进式升级提供事件隔离。
2. React 先（root 在 document 内层），然后才冒泡到 document。
3. 出于安全 `value` 只读，只能设空字符串；文件内容只能通过 `ref.current.files` 读取。
4. 静态方法（`hoist-non-react-statics`）、`ref`（需 `forwardRef`）、`displayName`（需手动设置）。
5. 会。合成事件按 React 树传播，与 DOM 位置无关。
6. `useRef` 创建稳定引用 → `forwardRef` 把 ref 转发进函数组件 → `useImperativeHandle` 收窄对外暴露的方法。
7. 想改子组件状态（用状态提升/受控）、兄弟通信（用 Context/提升）、在 render 里做渲染决策（用 state）。
</details>
