# React 08｜路由与代码分割

> 覆盖：React Router 的 URL 订阅与匹配渲染、`lazy` / `Suspense` 的挂起机制与分包 —— **2 个考点**

---

## 目录

- [本册速查](#本册速查)
- [8.1 React Router 的原理是什么？怎么手写一个简易路由？](#81-react-router-的原理是什么怎么手写一个简易路由)
- [8.2 React.lazy 和 Suspense 是怎么工作的？](#82-reactlazy-和-suspense-是怎么工作的)
- [本册自测](#本册自测)

---

## 本册速查

| 考点 | 一句话答案 |
|---|---|
| 8.1 React 路由原理 | 封装 `pushState` 并订阅 location 变化，按 path 匹配渲染 |
| 8.2 lazy 与 Suspense | lazy 组件首次渲染时 throw 一个 Promise，Suspense 捕获后显示 fallback，resolve 后重渲染 |

---

## 8.1 React Router 的原理是什么？怎么手写一个简易路由？

### 核心原理

**① 三个基本问题**

| 问题 | 方案 |
|---|---|
| 怎么改 URL 而不刷新页面？ | `history.pushState` / `replaceState`，或改 `location.hash` |
| URL 变了怎么知道？ | `pushState` 不触发任何事件，所以要在封装里手动通知订阅者；`popstate` 只在前进/后退时触发 |
| 怎么根据 URL 渲染组件？ | 用 `matchPath` 比对 `location.pathname` 与路由表，渲染匹配项 |

**② history 层做了什么**

v6.0–6.3 直接用 `history` 包；6.4 起 history 实现并入 `@remix-run/router`，对外接口不变：

```js
const history = createBrowserHistory();
history.listen(({ location, action }) => {...});   // 订阅
history.push('/a');      // window.history.pushState + 手动通知订阅者
history.replace('/b');
history.back();
```

**③ React Router 的渲染链路**

```
<BrowserRouter>                     ← 创建 history，订阅变化，location 存 state
   ↓ RouterContext 向下传 { location, navigator }
<Routes>                            ← 遍历子 <Route>，matchPath 匹配后按 score 取最佳
<Route path="/users/:id" element={<User />} />
   ↓
<User />                            ← useParams / useLocation / useNavigate 读 Context
```

核心是 **Context + useState 的订阅模型**（示意；v6 内部拆成 location / navigation 两个 Context）：

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

location 变 → `setLocation` → Provider value 变 → 消费路由的组件重渲染 → `Routes` 重新匹配。

**④ 三种 history 模式的取舍**

| 模式 | 实现 | 优点 | 缺点 |
|---|---|---|---|
| **BrowserHistory**（history 模式） | `pushState` | URL 干净、可分享、可被服务端与爬虫识别 | 刷新/直连需服务端 fallback 到 `index.html`，否则 404 |
| **HashHistory** | 改 `location.hash` | 不需要服务端配置、兼容性好 | URL 带 `#`、不参与 SEO |
| **MemoryHistory** | 内存栈 | 适合测试与非浏览器环境（RN） | 地址栏不同步、无法分享链接 |

history 模式刷新 404 的原因：`/users/1` 在服务端没有对应的实体文件。Nginx 兜底：

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

**⑤ v6 的关键设计**

| 特性 | 说明 |
|---|---|
| `<Routes>` 替代 `<Switch>` | 按 path 的 specificity 打分选最佳匹配，不依赖书写顺序 |
| 取消 `exact` | `path` 默认只匹配自身层级，子路径要靠嵌套路由或 `*` |
| 嵌套路由用 `<Outlet />` | 父路由渲染 `<Outlet />` 占位，子路由填进去 |
| 相对路径 | `to="detail"` 相对当前路由，`to="../"` 上跳 |
| `useNavigate` 替代 `useHistory` | `navigate('/a', { replace: true, state })` |
| 数据路由（6.4+） | `createBrowserRouter` + `<RouterProvider>`，`loader` / `action` / `errorElement` 把数据获取前移到路由层 |
| `useRoutes` | 用路由对象数组代替 JSX 声明路由表 |

**⑥ 手写一个 30 行的 Router**

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

关键：`pushState` 不触发事件，所以 `navigate` 里必须手动 setState；前进/后退只触发 `popstate`，所以要监听它。

### 答题思路与要点顺序

1. 三个问题：改 URL 不刷新 → 感知变化 → 匹配渲染。
2. history 层：`pushState` 不触发事件，封装后手动 notify；`popstate` 只管前进/后退。
3. React 侧：Context 存 location，`setLocation` 触发重渲染，`Routes` 用 `matchPath` 选最佳匹配。
4. 模式取舍：browser 需服务端 fallback，hash 不需要但 URL 带 `#`，memory 用于测试/非浏览器。
5. v6.4 之后：数据路由用 `createBrowserRouter` + `<RouterProvider>`，数据获取交给 `loader` / `action`。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 路由守卫怎么做？ | 包一层组件：`if (!user) return <Navigate to="/login" replace />`；6.4+ 在 loader 里 `throw redirect('/login')` |
| 为什么用 Context 而不是全局变量？ | Context 变化只重渲染订阅组件，且能支持多 Router 实例（微前端）；全局变量不触发更新 |
| 懒加载路由怎么写？ | `React.lazy` + `<Suspense>`，或路由对象的 `lazy: () => import('./page')`，见 8.2 |

---

## 8.2 React.lazy 和 Suspense 是怎么工作的？

### 适用范围

- **代码分割**：`React.lazy` + `<Suspense>` 是稳定用法。
- **数据获取**：官方推荐交给框架（Next.js / Remix）或 React 19 的 `use()`；手写 `throw promise` 需要自己处理缓存、瀑布流与重试，不建议。

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
② lazy 发现模块未加载 → throw 一个 thenable
      ↓
③ 最近的 <Suspense> 边界捕获
      ↓
④ 渲染 fallback，并给 Promise 注册 then
      ↓
⑤ 模块加载完成 → React 重新渲染该子树，这次拿到真组件
```

挂起靠异常实现，不是 state；Promise resolve 后 React 重试渲染。

**③ 五个必须知道的细节**

| 细节 | 说明 |
|---|---|
| **`lazy` 必须在模块顶层** | 在组件内调用会每次渲染产生新的组件类型，state 与已加载的模块被重置 |
| **必须被 Suspense 包住** | 否则没有 fallback 可渲染，React 直接抛错 |
| **加载失败交给 ErrorBoundary** | `load` 只调用一次，Promise reject 后 `lazy` 把原因抛给最近的 ErrorBoundary；要重试只能自己包一层 `import` 或整页刷新 |
| **fallback 闪烁** | 加载很快时 fallback 一闪而过；用 `startTransition` 包住导航，React 不会隐藏已显示内容 |
| **嵌套 Suspense** | 最近的边界先捕获，可做页面级 + 局部两级骨架 |

**④ 和路由结合的实践**

```jsx
const Home = lazy(() => import('./pages/Home'));
const List = lazy(() => import('./pages/List'));

<BrowserRouter>
  <Suspense fallback={<PageSkeleton />}>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/list" element={<List />} />
    </Routes>
  </Suspense>
</BrowserRouter>
```

- 分包按动态 `import()` 边界完成：webpack 用 `/* webpackChunkName: 'home' */` 命名 chunk；Vite 8 在 `build.rolldownOptions` 配置产物分组（`manualChunks` 对象形式已移除）。
- 数据路由可改用路由对象的 `lazy: () => import('./page')`，模块导出的 `Component` / `loader` 在进入路由时加载（6.4+）。
- 预取：hover 导航项时 `import('./pages/List')` 预热，点进去几乎无等待；首屏关键路由不分割或 `preload`，避免多一次往返。

**⑤ React 19 的变化**

- `use(promise)` 在组件内直接读 Promise 并配合 Suspense；它不是 Hook，可以写在条件或循环里。
- 传给 `use` 的 Promise 必须在渲染外创建并缓存，否则每次渲染都是新实例，一直挂起。

### 答题思路与要点顺序

1. 划边界：代码分割是稳定用法；数据获取交给框架或 `use()`。
2. 用法：`lazy(() => import())` + `<Suspense fallback>`。
3. 原理：首次渲染 throw Promise → 最近的边界捕获 → 渲染 fallback → resolve 后重渲染。
4. 细节：模块顶层、ErrorBoundary 兜底、transition 防闪烁、嵌套边界。
5. 落地：按路由分割 + hover 预取，首屏路由不拆。

### 常见追问

| 追问 | 应答要点 |
|---|---|
| 为什么 lazy 必须放在模块顶层？ | 组件内调用每次渲染都产生新组件类型 → 卸载重建 → state 丢失 |
| lazy 加载失败怎么办？ | `load` 只执行一次，reject 抛给最近的 ErrorBoundary；重试要自己包 `import` 或刷新页面 |
| Suspense 能捕获数据请求吗？ | 能（thenable），但官方推荐框架方案或 `use()`；手写要处理缓存、瀑布流、重试 |
| SSR 下 lazy 怎么工作？ | `renderToPipeableStream` + Suspense 流式输出：先发 fallback，模块就绪后再补内容 |

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

1. history 层在 push 后手动通知订阅者；Router 里的 `setLocation` 触发重渲染。
2. 浏览器前进/后退、`history.back/forward/go`；**管不到** `pushState/replaceState`。
3. 服务端没有对应实体文件；fallback 到 `index.html`（`try_files $uri $uri/ /index.html`）。
4. ① `pushState` 后手动 setState ② 监听 `popstate` 同步前进/后退 ③ 用 Context 把 location / navigate 传给子组件。
5. 模块未加载完 → throw Promise → 最近的 Suspense 捕获 → 渲染 fallback → resolve 后重渲染。
6. 每次渲染新建组件类型 → 卸载重建 → state 丢失。
7. 框架层（loader / RSC）或 React 19 的 `use()`；不推荐手写 throw promise。
</details>
