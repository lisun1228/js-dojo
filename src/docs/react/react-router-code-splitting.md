# React 08｜路由与代码分割

> 覆盖原题：22、26（2 题 → **2 个考点**）
> 第 26 题的答案原文只有一句「同 Vue 文档第 68 题」——**这是整份题单里最需要补齐的一题**，因为 React Router 和 vue-router 的实现细节差别不小，直接套 Vue 的答案会被追问打穿。

---

## 目录

- [本册速查](#本册速查)
- [8.1 React Router 的原理是什么？怎么手写一个简易路由？](#81-react-router-的原理是什么怎么手写一个简易路由)
- [8.2 React.lazy 和 Suspense 是怎么工作的？](#82-reactlazy-和-suspense-是怎么工作的)
- [本册自测](#本册自测)

---

## 本册速查

| 考点 | 合并自 | 一句话答案 |
|---|---|---|
| 8.1 React 路由原理 | 26 | history 对象封装 pushState + 订阅 location 变化 + 按 path 匹配渲染 |
| 8.2 lazy 与 Suspense | 22 | lazy 组件首次渲染时 throw 一个 Promise，Suspense 捕获后显示 fallback，resolve 后重试 |

---

## 8.1 React Router 的原理是什么？怎么手写一个简易路由？

> 原题：**26.**「同 Vue 文档第 68 题：history/pushState + listen。」——**跨文档悬空**，本册补齐。
> 这句话的方向对，但 React Router 有它自己的结构（Provider + Context + 匹配算法），需要按 React 的方式讲。

### 核心原理

**① 三个基本问题**

一个前端路由要解决三件事：

| 问题 | 方案 |
|---|---|
| 怎么改 URL 而不刷新页面？ | `history.pushState` / `replaceState`（或改 `location.hash`） |
| URL 变了怎么知道？ | `pushState` **不会触发任何事件**，所以要自己"包一层"（history 库做的事）；`popstate` 只在前述/后退时触发 |
| 怎么根据 URL 渲染组件？ | 用 `matchPath` 把 `location.pathname` 和路由表比对，渲染匹配项 |

**② `history` 库做了什么**

React Router v6 依赖 `history` 包，它把三种环境统一成一个接口：

```js
const history = createBrowserHistory();
history.listen(({ location, action }) => {...});   // 订阅
history.push('/a');      // 内部：window.history.pushState + 手动通知订阅者
history.replace('/b');
history.back();
```

关键点：**`push` 之后要手动 `notify` 订阅者**，因为 `pushState` 本身不触发事件。`popstate` 只在"前进/后退"时触发，所以监听 `popstate` 就够了。

**③ React Router 的渲染链路**

```
<BrowserRouter>                     ← 创建 history，订阅变化，location 存 state
   ↓ 通过 RouterContext 向下传 { location, navigator }
<Routes>                            ← 拿到 location.pathname
   ↓ 遍历子 <Route>，用 matchPath 匹配，按 score 排序取最佳
<Route path="/users/:id" element={<User />} />
   ↓ 渲染 element
<User />                            ← 内部用 useParams / useLocation / useNavigate 读 Context
```

核心是一个 **Context + useState 的订阅模型**：

```jsx
function BrowserRouter({ children }) {
  const historyRef = useRef();
  if (!historyRef.current) historyRef.current = createBrowserHistory();

  const [location, setLocation] = useState(historyRef.current.location);
  useLayoutEffect(() => {
    const unlisten = historyRef.current.listen(({ location }) => setLocation(location));
    return unlisten;
  }, []);

  return (
    <RouterContext.Provider value={{ location, navigator: historyRef.current }}>
      {children}
    </RouterContext.Provider>
  );
}
```

location 变 → `setLocation` → Provider value 变 → 所有消费路由的组件重渲染 → `Routes` 重新匹配。

**④ 三种 history 模式的取舍**

| 模式 | 实现 | 优点 | 缺点 |
|---|---|---|---|
| **BrowserHistory**（history 模式） | `pushState` | URL 干净、利于 SEO、支持服务端路由 | **刷新/直连需要服务端 fallback 到 index.html**，否则 404 |
| **HashHistory** | 改 `location.hash` | 不需要服务端配置、兼容性最好 | URL 带 `#`、不参与 SEO、有长度限制 |
| **MemoryHistory** | 内存数组 | 适合 SSR、测试、非浏览器环境（RN） | 地址栏不同步、无法分享链接 |

**为什么 history 模式刷新会 404**：`/users/1` 这个路径在服务端不存在实体文件，请求直接打到服务器 → 404。需要 Nginx 配置：

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

**⑤ v6 的关键设计（追问高发）**

| 特性 | 说明 |
|---|---|
| `<Routes>` 替代 `<Switch>` | 自动选"最佳匹配"（按 path 的 specificity 打分，不依赖书写顺序） |
| 取消 `exact` | v6 默认就是精确匹配（除非用 `*` 通配） |
| 嵌套路由用 `<Outlet />` | 父路由渲染 `<Outlet>` 占位，子路由填进去 |
| 相对路径 | `to="detail"` 相对当前路由，`to="../"` 上跳 |
| `useNavigate` 替代 `useHistory` | `navigate('/a', { replace: true, state })` |
| 数据路由（6.4+） | `loader` / `action` / `errorElement`，把数据获取前移到路由层 |
| `useRoutes` | 用配置对象代替 JSX 声明路由表 |

**⑥ 手写一个 30 行的 Router（面试可能让你写）**

```jsx
const RouterCtx = createContext(null);

export function Router({ children }) {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = (to, { replace = false } = {}) => {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', to);
    setPath(to);                       // pushState 不触发 popstate，必须手动同步
  };

  return <RouterCtx.Provider value={{ path, navigate }}>{children}</RouterCtx.Provider>;
}

export const useRouter = () => useContext(RouterCtx);

export function Link({ to, children }) {
  const { navigate } = useRouter();
  return (
    <a href={to} onClick={(e) => { e.preventDefault(); navigate(to); }}>
      {children}
    </a>
  );
}
```

**这段代码的关键**：`pushState` 不触发事件，所以 `navigate` 里必须**手动 setState**；而浏览器的前进/后退只触发 `popstate`，所以要监听它。

### 答题思路与要点顺序

1. **拆三个问题**：改 URL 不刷新、如何感知变化、如何匹配渲染。（15 秒，**结构清晰**）
2. **讲 history**：`pushState` 不触发事件，所以 history 库封装并手动 notify；`popstate` 只管前进后退。（25 秒，**核心**）
3. **讲 React 侧**：Context 存 location + `setLocation` 触发重渲染 + `matchPath` 匹配。（25 秒）
4. **讲模式取舍**：history 需要服务端 fallback，hash 不需要但 URL 丑。（20 秒）
5. **收尾**：v6 的 Routes/Outlet/相对路径；数据路由是新方向。

### 口述参考

> React Router 的原理可以拆成三件事。第一，怎么改 URL 不刷新页面，用 history.pushState；第二，怎么知道 URL 变了，pushState 本身不触发任何事件，只有前进后退才触发 popstate，所以 history 这个库做的是把 pushState 包一层，改完 URL 之后手动通知订阅者；第三，怎么根据 URL 渲染，用 matchPath 把 pathname 和路由表比对。
>
> 在 React 这一侧，BrowserRouter 会创建 history、用 useState 存 location、在 useLayoutEffect 里 listen，location 一变就 setLocation，然后通过 Context 往下传。Routes 拿到新的 pathname，遍历子 Route 做匹配，按路径的具体程度打分选最佳的那个，渲染它的 element。所以本质是"Context + useState 的订阅模型"。
>
> 模式上有三种：browser 模式 URL 干净但要服务端 fallback，否则刷新 404，因为 /users/1 这个路径服务端没有实体文件；hash 模式不需要服务端配置，但 URL 带 #、不利于 SEO；memory 模式适合 SSR 和测试。
>
> v6 还改了几个地方：Switch 换成 Routes 并且自动选最佳匹配，取消了 exact，嵌套路由用 Outlet 占位，导航用 useNavigate。6.4 之后加了 loader 和 action，把数据获取前移到路由层。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 为什么 `pushState` 之后组件能更新？ | 因为 history 库在 push 后手动调用订阅回调；`popstate` 管不到 pushState |
| `popstate` 什么时候触发？ | 浏览器前进/后退、`history.back/forward/go`；**不**在 `pushState/replaceState` 时触发 |
| history 模式刷新 404 怎么解决？ | 服务端把所有未匹配路径 fallback 到 `index.html`（Nginx `try_files`、CDN 配置） |
| 路由守卫怎么做？ | 包一层组件：`if (!user) return <Navigate to="/login" replace />; return children`；v6.4+ 用 loader 里 `redirect()` |
| 为什么用 Context 而不是全局变量？ | Context 变化能触发订阅组件重渲染，全局变量不行；且能支持多 Router 实例（微前端） |
| Link 为什么不用 `<a href>` 直接跳？ | 会整页刷新，丢失 SPA 状态；要 `preventDefault` + pushState |
| 懒加载路由怎么做？ | `const A = lazy(() => import('./A'))` + `<Suspense fallback>`，见 8.2 |

### 加分点与易错点

- ✅ **加分**：说出"`pushState` 不触发事件，所以必须手动 notify"这个关键点；说出 v6 的 score 匹配；能徒手写出 30 行 Router。
- ⚠️ **易错**：说"监听 `popstate` 就能感知所有路由变化"——`pushState` 不会触发它。
- ⚠️ **易错**：把 React Router 说成"基于 hashchange"——它默认用 history API。

---

## 8.2 React.lazy 和 Suspense 是怎么工作的？

> 原题：**22.**「异步加载时显示 fallback，配合 lazy/Suspense for Data Fetching。」

### 原答案的问题

「**Suspense for Data Fetching**」这个说法要小心：

- React 18 里，Suspense 用于**代码分割**是稳定用法；
- 用于**数据获取**，官方已明确"推荐交给框架"（Next.js / Remix）或 React 19 的 `use()`，**不建议手写** `throw promise` 的取数逻辑（容易踩瀑布流、缓存、重试的坑）。

所以稳妥的答法是：**主答代码分割，数据获取作为"演进方向"提一句。**

### 核心原理

**① 用法**

```jsx
const UserPanel = lazy(() => import('./UserPanel'));

<Suspense fallback={<Skeleton />}>
  <UserPanel />
</Suspense>
```

**② 工作机制：throw a Promise**

```
① 首次渲染 <UserPanel />
      ↓
② lazy 组件发现模块还没加载 → throw 一个 thenable（Promise）
      ↓
③ 这个 throw 被最近的 <Suspense> 边界捕获
      ↓
④ Suspense 渲染 fallback，并给 Promise 注册 then 回调
      ↓
⑤ 模块加载完成 → 回调触发 → React 重新渲染该子树（这次能拿到组件了）
```

关键点：**Suspense 的"挂起"是靠异常实现的**，不是靠 state。这也是为什么它被称为"声明式等待"。

**③ 五个必须知道的细节**

| 细节 | 说明 |
|---|---|
| **`lazy` 必须在模块顶层** | 不能在组件内部调用（否则每次渲染都创建新的 lazy 组件，导致无限重挂载） |
| **必须被 Suspense 包住** | 否则会抛错到上层，被 ErrorBoundary 或白屏接住 |
| **加载失败要 ErrorBoundary** | React 18 中 lazy 加载失败会直接抛错（不再重试），需要 ErrorBoundary + 重试按钮（用 key 重建） |
| **fallback 闪烁** | 加载很快时 fallback 一闪而过，体验差；用 `startTransition` 包住导航可避免"已显示内容被 fallback 替换" |
| **嵌套 Suspense** | 内层先捕获，可用多层做"渐进式骨架"（页面骨架 + 局部骨架） |

**④ 和路由结合的实践（最常用）**

```jsx
const routes = [
  { path: '/', element: lazy(() => import('./pages/Home')) },
  { path: '/list', element: lazy(() => import('./pages/List')) },
];

<Suspense fallback={<PageSkeleton />}>
  <Routes>{...}</Routes>
</Suspense>
```

进阶：

- **按路由分包**（webpack 的 `/* webpackChunkName */` 魔法注释可命名 chunk）；
- **hover 预取**：鼠标移到导航项就 `import()` 预热，点进去几乎无等待；
- **首屏关键路由不分割**（或 `preload`），避免首页多一次往返。

**⑤ React 19 的变化**

- `lazy` 支持 `lazy(() => import(...))` 之外的写法更灵活；
- **`use(promise)`** 可以在组件里直接读 Promise（配合 Suspense），且 `use` 可以条件调用；
- Suspense 的边界行为更完善（与 RSC、Actions 配合）。

### 答题思路与要点顺序

1. **分开说**：代码分割是稳定用法，数据获取推荐框架/`use()`。（10 秒，**先划边界**）
2. **用法**：`lazy(() => import())` + `<Suspense fallback>`。（10 秒）
3. **原理**：throw Promise → Suspense 捕获 → 显示 fallback → resolve 后重试渲染。（30 秒，**核心**）
4. **细节**：lazy 要在顶层、失败要 ErrorBoundary、fallback 闪烁用 transition。（25 秒）
5. **落地**：路由级分割 + 预取。

### 口述参考

> 先区分一下场景：lazy 加 Suspense 做代码分割是最稳定、最常用的用法；数据获取这块官方现在更推荐交给框架或者 React 19 的 use，不建议自己手写 throw promise。
>
> 原理上，lazy 返回的是一个特殊组件，首次渲染时如果模块还没加载完，它会 throw 一个 Promise。这个异常被最近的 Suspense 边界捕获，Suspense 就渲染 fallback，同时给 Promise 注册 then；等模块加载完，回调触发 React 重新渲染这棵子树，这次就能拿到真正的组件了。所以 Suspense 的"挂起"其实是靠异常实现的，是一种声明式的等待。
>
> 有几个细节容易踩：lazy 必须写在模块顶层，写在组件里每次渲染都新建一个 lazy 组件，会无限重挂载；必须有 Suspense 包住，否则错误会往上抛；加载失败要 ErrorBoundary 兜底，18 之后失败不会自动重试，需要手动重建；如果加载很快，fallback 会闪一下，用 startTransition 包住导航可以让旧内容留着，避免闪。
>
> 实践里最常用的是路由级分割，按页面拆 chunk，再配合 hover 预取，点进去几乎没等待。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| Suspense 的"挂起"是怎么实现的？ | 组件 throw 一个 thenable，边界捕获后渲染 fallback；promise resolve 后重试渲染 |
| 为什么 lazy 要放在模块顶层？ | 每次渲染新建 lazy 组件会导致组件类型变化 → 卸载重建 → 无限循环 |
| lazy 加载失败怎么办？ | ErrorBoundary 捕获 + 提供重试（改 key 强制重建）；可加 chunk 加载重试逻辑 |
| Suspense 能捕获数据请求吗？ | 能（throw promise），但官方推荐框架层方案或 `use()`，手写易踩瀑布流/缓存/重试问题 |
| fallback 闪一下怎么解决？ | 用 `startTransition` 包住路由切换、加最小展示时长、或预取 chunk |
| 多个 Suspense 嵌套谁生效？ | 最近的边界先捕获；可做多层骨架（页面级 + 局部） |
| SSR 下 lazy 怎么工作？ | 需要 `renderToPipeableStream` + `Suspense` 支持流式输出；否则首屏会缺片段 |

### 加分点与易错点

- ✅ **加分**：主动区分"代码分割"与"数据获取"两个场景；说出 `throw promise` 机制；提到预取与 chunk 命名。
- ⚠️ **易错**：说"Suspense 会等数据加载完再渲染"——它是"先渲染 fallback，再替换"。
- ⚠️ **易错**：在组件内部调用 `lazy()`。

---

## 本册自测

1. `history.pushState` 之后，React 组件为什么能更新？
2. `popstate` 在什么时候触发？它管得到 `pushState` 吗？
3. history 模式为什么刷新会 404？怎么解决？
4. 手写一个 20 行的 Router，最关键的三个点是什么？
5. `lazy` 组件首次渲染时发生了什么？
6. 为什么 `lazy` 必须写在模块顶层？
7. Suspense 用于数据获取，官方现在推荐什么？

<details>
<summary>自测参考答案要点</summary>

1. history 库在 push 后手动调用订阅回调（pushState 本身不触发事件），Router 里的 `setLocation` 触发重渲染。
2. 浏览器前进/后退、`history.back/forward/go`；**管不到** `pushState/replaceState`。
3. 服务端没有对应实体文件；配置 fallback 到 `index.html`（`try_files $uri $uri/ /index.html`）。
4. ① `pushState` 后手动 setState ② 监听 `popstate` 同步前进后退 ③ 用 Context 把 location/navigate 传给子组件。
5. 模块未加载完 → throw 一个 Promise → 最近的 Suspense 捕获 → 渲染 fallback → resolve 后重新渲染。
6. 组件内调用会每次渲染创建新的 lazy 组件（类型变化）→ 卸载重建 → 无限循环。
7. 框架层（Next.js/Remix 的 loader/RSC）或 React 19 的 `use()`；不推荐手写 throw promise。
</details>
