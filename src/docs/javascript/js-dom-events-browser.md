# JS · 09 DOM 事件与浏览器边界（题 21~30、88~94）

> 本册覆盖：事件委托（题 21）、冒泡捕获（题 22）、阻止冒泡（题 23）、阻止默认行为（题 24）、虚拟列表（题 30）、同源策略（题 25）、跨域（题 26）、JSONP（题 28）、CORS（题 29）、本地存储（题 27）
> 题单这些题都只有一行答案。**跨域那几题在「计算机网络」分册里已经有 765 行的深度版本**，本册只给速查和「JS 视角的边界」，避免重复。
> 本册重点补两块题单讲得很浅的：**事件流的「三个阶段」和 `addEventListener` 的对象参数**、**动态高度的虚拟列表**。

---

## 9.1 一句话结论

**DOM 事件是「捕获 → 目标 → 冒泡」三阶段传播**，`addEventListener` 的第三参数控制在哪一阶段监听。
**事件委托**利用冒泡，把子元素的事件统一绑到父元素上。
**虚拟列表**只渲染可视区的 DOM，是长列表的唯一可行方案。
**存储**要按「容量 / 同步异步 / 生命周期 / 是否随请求发送」四维度选。

---

## 9.2 事件流三个阶段（题 22）

### 9.2.1 题单的答案漏了「目标阶段」

> 原文：「捕获：从外到内。冒泡：从内到外。`addEventListener` 第三参数控制。」

**漏了最关键的第三阶段。** 完整的是：

```
                 ┌─────────────┐
  ① 捕获阶段      │  window     │  ← 从最外层往里
  (Capture)      │    ↓        │
                 │  document   │
                 │    ↓        │
                 │  <html>     │
                 │    ↓        │
                 │  <body>     │
                 │    ↓        │
                 │  <div>      │
                 │    ↓        │
  ② 目标阶段      │  <button>   │  ← 事件到达目标元素
  (Target)       │    ↑        │
                 │  <div>      │
                 │    ↑        │
  ③ 冒泡阶段      │  <body>     │  ← 从目标往外
  (Bubbling)     │    ↑        │
                 │  <html>     │
                 │    ↑        │
                 │  document   │
                 │    ↑        │
                 │  window     │
                 └─────────────┘
```

### 9.2.2 三个阶段的细节（这是追问点）

**① 捕获阶段不包含目标元素**

规范里捕获阶段从 `window` 到**目标的父元素**，目标阶段才是目标元素本身。

**② 目标阶段：捕获和冒泡的监听器都会触发，按注册顺序**

```js
const btn = document.querySelector('button');
btn.addEventListener('click', () => console.log('capture'), true);
btn.addEventListener('click', () => console.log('bubble'), false);
// 点击 button：先 'capture' 后 'bubble'（按注册顺序，不是按 capture 标记）
```

**这是很多人不知道的**——在目标元素上，`capture` 参数**不生效**，只影响注册顺序。

**③ `eventPhase` 可以看当前阶段**

```js
el.addEventListener('click', (e) => {
  e.eventPhase;    // 1 = CAPTURING_PHASE
                   // 2 = AT_TARGET
                   // 3 = BUBBLING_PHASE
});
```

### 9.2.3 完整顺序演示（面试常考输出题）

```html
<div id="outer">
  <div id="inner">
    <button id="btn">click</button>
  </div>
</div>
```

```js
const log = (name, phase) => (e) => console.log(`${phase}: ${name}`);

document.getElementById('outer').addEventListener('click', log('outer', 'capture'), true);
document.getElementById('outer').addEventListener('click', log('outer', 'bubble'), false);
document.getElementById('inner').addEventListener('click', log('inner', 'capture'), true);
document.getElementById('inner').addEventListener('click', log('inner', 'bubble'), false);
document.getElementById('btn').addEventListener('click', log('btn', 'capture'), true);
document.getElementById('btn').addEventListener('click', log('btn', 'bubble'), false);

// 点击 btn，输出顺序：
// capture: outer      ← 捕获，从外往里
// capture: inner
// capture: btn        ← 目标阶段，按注册顺序
// bubble: btn
// bubble: inner       ← 冒泡，从里往外
// bubble: outer
```

**记忆**：**捕获是「外→内」，目标按注册顺序，冒泡是「内→外」。**

### 9.2.4 `addEventListener` 的第三参数（题单没提）

**两种形式**：

```js
// ① 布尔（老写法）
el.addEventListener('click', fn, true);      // true = 捕获阶段
el.addEventListener('click', fn, false);     // false = 冒泡阶段（默认）

// ② 对象（现代写法，功能更全）
el.addEventListener('click', fn, {
  capture: false,      // 是否捕获阶段
  once: true,          // 只触发一次，自动移除
  passive: true,       // 承诺不调 preventDefault（性能优化）
  signal: ac.signal,   // AbortSignal，abort() 时自动移除
});
```

**四个选项的价值**：

| 选项 | 作用 | 典型场景 |
|---|---|---|
| **`once: true`** | 触发一次后自动移除 | 弹窗的「点击外部关闭」、一次性的初始化 |
| **`passive: true`** | 告诉浏览器「我不会 `preventDefault`」，**滚动不等 JS 执行** | `touchstart`/`touchmove`/`wheel`/`scroll` |
| **`signal`** | 传入 `AbortSignal`，`abort()` 一次性移除所有相关监听 | 组件卸载时统一清理 |
| `capture` | 在哪一阶段监听 | 需要在父元素「抢先」处理时 |

**`passive` 为什么能提升滚动性能**（这个点很值钱）：

```
没有 passive：
  用户滚动 → 浏览器必须【等 JS 执行完】，确认没调 preventDefault → 才滚动
  → 如果 JS 很慢，滚动就卡

有 passive: true：
  浏览器【立即滚动】，不用等 JS
  → 滚动流畅
```

**Chrome 从 56 起，对 `window`/`document`/`body` 上的 `touchstart`/`touchmove`/`wheel` 默认就是 `passive: true`。**

**这导致一个坑**：在这些元素上 `preventDefault()` 会失效（控制台警告 `Unable to preventDefault inside passive event listener`）。要恢复得显式传 `{ passive: false }`。

**`signal` 的用法**（现代最佳实践）：

```js
const ac = new AbortController();

window.addEventListener('resize', onResize, { signal: ac.signal });
document.addEventListener('scroll', onScroll, { signal: ac.signal });
el.addEventListener('click', onClick, { signal: ac.signal });

// 一次性清理所有
ac.abort();
```

**这比「保存所有 listener 引用再逐个 remove」优雅得多**，尤其在 React/Vue 组件里。

---

## 9.3 阻止冒泡 vs 阻止默认行为（题 23、24）

### 9.3.1 三个方法的区别

| 方法 | 作用 | 影响范围 |
|---|---|---|
| **`preventDefault()`** | 阻止**默认行为**（表单提交、链接跳转、右键菜单） | 不影响传播 |
| **`stopPropagation()`** | 阻止**继续传播**（后续的捕获/冒泡） | **同元素的其它监听器仍会执行** |
| **`stopImmediatePropagation()`** | 阻止传播 **+ 阻止同元素后续监听器** | 最彻底 |

**逐条演示**：

```js
// ① preventDefault：只阻止默认行为
link.addEventListener('click', (e) => {
  e.preventDefault();       // 不跳转
  console.log('still bubbles');   // ← 仍然会冒泡到父元素
});

// ② stopPropagation：阻止传播，但不阻止同元素其他监听器
btn.addEventListener('click', (e) => {
  e.stopPropagation();
  console.log('listener 1');      // 执行
});
btn.addEventListener('click', () => {
  console.log('listener 2');      // ← 仍然执行！
});

// ③ stopImmediatePropagation：全阻止
btn.addEventListener('click', (e) => {
  e.stopImmediatePropagation();
  console.log('listener 1');      // 执行
});
btn.addEventListener('click', () => {
  console.log('listener 2');      // ← 不执行
});
```

### 9.3.2 三个必须知道的细节

**① `preventDefault` 对 passive 监听器无效**

```js
el.addEventListener('touchmove', (e) => {
  e.preventDefault();        // ⚠️ 无效，控制台警告
}, { passive: true });

// 要生效必须
el.addEventListener('touchmove', (e) => {
  e.preventDefault();        // ✅
}, { passive: false });
```

**② `return false` 只在「DOM0 方式」有效**

```js
// DOM0：return false 等价于 preventDefault + stopPropagation
el.onclick = () => false;

// addEventListener：return false 完全无效！
el.addEventListener('click', () => false);   // ❌ 什么都不做
```

**这是 jQuery 时代留下的坑**——很多人以为 `return false` 通用。

**③ `passive` 和 `preventDefault` 的检查**

```js
e.cancelable;     // 事件是否可以被 preventDefault（有些事件不可取消）
e.defaultPrevented;   // 是否已经被阻止过
```

---

## 9.4 事件委托（题 21）

### 9.4.1 原理与实现

**利用冒泡：把子元素的事件绑到父元素，通过 `e.target` 判断来源。**

```js
// ❌ 传统方式：每个 li 都绑一个
document.querySelectorAll('li').forEach((li) => {
  li.addEventListener('click', handler);       // 1000 个 li = 1000 个监听器
});

// ✅ 事件委托：只在 ul 上绑一个
document.querySelector('ul').addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li || !e.currentTarget.contains(li)) return;
  console.log('clicked:', li.dataset.id);
});
```

**三个关键 API**：

| API | 作用 |
|---|---|
| **`e.target`** | 实际触发的元素（可能是子元素，比如 `<span>`） |
| **`e.currentTarget`** | 绑定监听器的元素（就是 `ul`） |
| **`e.target.closest('li')`** | 从 `target` 往上找最近的 `li`（**比 `e.target.tagName === 'LI'` 可靠**） |

**为什么用 `closest` 而不是直接判断 `tagName`**：

```html
<li><span>文字</span></li>
```

点击 `span` 时 `e.target` 是 `span`，直接判断 `tagName === 'LI'` 会失败。`closest('li')` 能往上找到。

### 9.4.2 三个优点

| 优点 | 说明 |
|---|---|
| **减少监听器数量** | 1000 个 li → 1 个监听器（省内存） |
| **动态元素自动生效** | 新增的 li 不需要重新绑定 |
| **统一管理** | 卸载时只 remove 一个 |

### 9.4.3 ⚠️ 不能委托的事件（这是追问点）

**事件委托依赖冒泡，所以「不冒泡的事件」不能委托**：

| 事件 | 是否冒泡 | 能否委托 |
|---|---|---|
| `focus` / `blur` | ❌ **不冒泡** | ❌ |
| **`focusin` / `focusout`** | ✅ 冒泡 | ✅ **用这两个替代** |
| `mouseenter` / `mouseleave` | ❌ 不冒泡 | ❌ |
| **`mouseover` / `mouseout`** | ✅ 冒泡 | ✅ **用这两个替代** |
| `load` / `unload` / `error` | ❌ 不冒泡 | ❌ |
| `scroll` | ⚠️ 在 document 上不冒泡（元素上冒泡） | 部分可以 |
| `submit` / `reset` | ✅ 冒泡 | ✅ |
| `change` / `input` | ✅ 冒泡 | ✅ |
| `click` / `dblclick` | ✅ 冒泡 | ✅ |

**所以「表单聚焦验证」要用 `focusin` 而不是 `focus`。**

### 9.4.4 事件委托的局限

| 局限 | 说明 |
|---|---|
| **不冒泡的事件不能用** | 见上表 |
| **`stopPropagation` 会破坏委托** | 子元素里阻止冒泡，父元素的委托就收不到 |
| **层级太深时性能** | `closest` 要往上遍历（但通常可忽略） |
| **事件目标判断变复杂** | 要处理「点到了子元素」的情况 |

---

## 9.5 虚拟列表（题 30）

### 9.5.1 题单的答案只说了一半

> 原文：「只渲染可视区的 DOM，滚动时动态替换。大数据量优化。」

**这只说了固定高度的方案。** 真实场景里**动态高度才是主流**（聊天记录、朋友圈、表格）。

### 9.5.2 固定高度版（最简单）

```js
class VirtualList {
  constructor(container, items, itemHeight) {
    this.container = container;
    this.items = items;
    this.itemHeight = itemHeight;
    this.overscan = 3;                    // 上下各多渲染 3 个（防白屏）

    this.viewportHeight = container.clientHeight;
    this.visibleCount = Math.ceil(this.viewportHeight / itemHeight);

    this.render();
    container.addEventListener('scroll', () => this.onScroll(), { passive: true });
  }

  onScroll() {
    const start = Math.floor(this.container.scrollTop / this.itemHeight);
    if (start === this.lastStart) return;
    this.lastStart = start;
    this.render();
    // ★ 用 rAF 节流，避免每次 scroll 都重排
  }

  render() {
    const start = Math.max(0, Math.floor(this.container.scrollTop / this.itemHeight) - this.overscan);
    const end = Math.min(this.items.length, start + this.visibleCount + this.overscan * 2);

    // ① 撑开总高度（占位）
    this.container.style.height = `${this.items.length * this.itemHeight}px`;

    // ② 只渲染可视区
    this.container.innerHTML = this.items
      .slice(start, end)
      .map((item, i) => `<div class="item" style="position:absolute;top:${(start + i) * this.itemHeight}px;height:${this.itemHeight}px">${item}</div>`)
      .join('');
  }
}
```

**核心三件事**：

| 事 | 做法 |
|---|---|
| **撑开总高度** | 容器高度 = `items.length * itemHeight`（让滚动条正确） |
| **只渲染可视区** | 计算 `start` / `end` 索引，只渲染这段 |
| **绝对定位偏移** | 渲染的元素用 `top` 或 `transform` 偏移到正确位置 |

### 9.5.3 动态高度版（难点）

**问题**：不知道每个 item 的高度，无法计算 `start` 索引。

**方案：估算 + 测量 + 缓存 + 修正**

```js
class DynamicVirtualList {
  constructor(container, items) {
    this.container = container;
    this.items = items;
    this.estimatedHeight = 50;                  // 初始估算
    this.heights = new Map();                   // 实测缓存：index → height
    this.positions = [0];                       // 前缀和：positions[i] = 前 i 个的总高

    // ★ 观察渲染出来的 item，测量真实高度
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const index = Number(entry.target.dataset.index);
        const h = entry.target.offsetHeight;
        if (this.heights.get(index) !== h) {
          this.heights.set(index, h);
          this.rebuildPositions();              // 重建前缀和
          this.render();
        }
      }
    });

    this.render();
  }

  getHeight(i) {
    return this.heights.get(i) ?? this.estimatedHeight;   // 没测过就用估算
  }

  rebuildPositions() {
    this.positions = [0];
    for (let i = 0; i < this.items.length; i++) {
      this.positions.push(this.positions[i] + this.getHeight(i));
    }
  }

  // ★ 二分查找：scrollTop 对应的起始索引
  findStartIndex(scrollTop) {
    let lo = 0, hi = this.items.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.positions[mid] <= scrollTop) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }
}
```

**四个关键点**：

| 点 | 说明 |
|---|---|
| **① 估算初始高度** | 先用平均值渲染，别等测量 |
| **② `ResizeObserver` 测量** | 比 `offsetHeight` + 定时更可靠（能监听内容变化） |
| **③ 前缀和 + 二分** | 才能 O(log n) 找到起始索引（否则要 O(n) 累加） |
| **④ 修正后重渲染** | 测出真实高度后要重建 `positions` 并重算 |

### 9.5.4 三个容易忽略的问题

**① 滚动锚定（Scroll Anchoring）**

**问题**：你在看第 100 条，上面的 item 高度被修正了（变大），内容会「跳」。

```
你正在看 item #100
    ↓ 上面某个 item 测出真实高度比估算大 20px
    ↓ 所有内容往下推 20px
    ↓ 你看到的内容突然变了
```

**解决**：修正高度时**同步调整 `scrollTop`**（保持当前可视内容不动）。

```js
const delta = newHeight - oldHeight;
if (index < currentStartIndex) {
  container.scrollTop += delta;      // 上面的元素变高，往下滚相应距离
}
```

**② 滚动事件要用 `rAF` 节流**

```js
let ticking = false;
container.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    render();
    ticking = false;
  });
}, { passive: true });
```

**为什么不用 `setTimeout` 节流**：`rAF` 和浏览器渲染同步，不会出现「渲染了一帧旧数据」的撕裂。

**③ 缓冲区（overscan）**

只渲染「正好可见」的，滚动时会看到白屏（因为渲染有延迟）。所以**上下各多渲染几个**。

**经验值**：`overscan = 3~5`。太多浪费 DOM，太少会闪。

### 9.5.5 什么时候不该用手写虚拟列表

| 场景 | 建议 |
|---|---|
| **列表项高度一致且简单** | 手写（几十行） |
| **需要复杂交互（拖拽、展开）** | 用库（`react-window`、`vue-virtual-scroller`、`@tanstack/virtual`） |
| **不定高度 + 大量图片** | 用库（它们处理了图片加载后的高度修正） |
| **只是几百条** | 不用虚拟列表，分页或 `content-visibility: auto` 更简单 |

**`content-visibility: auto`（CSS 方案）**：

```css
.item {
  content-visibility: auto;
  contain-intrinsic-size: 0 50px;   /* 估算高度，防跳动 */
}
```

**优点**：零 JS，浏览器自己跳过不可见元素的渲染。
**缺点**：不能减少 DOM 节点数（只减少渲染成本），几万个节点还是会占内存。

---

## 9.6 本地存储（题 27）

### 9.6.1 四方案对比

| 维度 | `localStorage` | `sessionStorage` | `cookie` | `IndexedDB` |
|---|---|---|---|---|
| **容量** | 5~10 MB | 5 MB | **4 KB** | **几百 MB ~ GB** |
| **API** | 同步 | 同步 | 同步（`document.cookie`） | **异步** |
| **生命周期** | **永久**（手动清） | **标签页级**（关闭即清） | 可设 `Expires`/`Max-Age` | 永久 |
| **是否随请求发送** | ❌ | ❌ | ✅ **每次同源请求都带** | ❌ |
| **跨标签页** | ✅ 共享 | ❌ **不共享** | ✅ 共享 | ✅ 共享 |
| **数据类型** | **只能字符串** | 只能字符串 | 只能字符串 | **任意结构化数据** |
| **能否被 JS 读** | ✅ | ✅ | ⚠️ `HttpOnly` 时不能 | ✅ |

### 9.6.2 五个必须知道的细节

**① `localStorage` 是同步 API，会阻塞主线程**

```js
// ⚠️ 存 5MB 数据会卡住主线程几百毫秒
localStorage.setItem('bigData', JSON.stringify(hugeObject));
```

**这就是「大容量数据要用 IndexedDB」的原因**——IndexedDB 是异步的，不阻塞。

**② 只能存字符串**

```js
localStorage.setItem('obj', { a: 1 });         // 存进去是 '[object Object]'
localStorage.setItem('obj', JSON.stringify({ a: 1 }));   // ✅
JSON.parse(localStorage.getItem('obj'));       // ✅
```

**③ `sessionStorage` 不跨标签页**

```js
// 标签 A 里设置
sessionStorage.setItem('token', 'x');

// 标签 B（即使是同一个页面）读不到
sessionStorage.getItem('token');    // null
```

**但「同一标签页内的 iframe」共享**（同源的话），「`window.open` 打开的新标签」**不共享**（某些浏览器会复制一份初始值，之后各自独立）。

**④ `storage` 事件做跨标签通信**

```js
// 标签 A
localStorage.setItem('msg', JSON.stringify({ type: 'logout', ts: Date.now() }));

// 标签 B
window.addEventListener('storage', (e) => {
  if (e.key === 'msg') {
    const data = JSON.parse(e.newValue);
    if (data.type === 'logout') location.reload();
  }
});
```

**⚠️ 关键限制**：**`storage` 事件不会在「触发修改的那个标签页」触发**——只通知其他标签页。

**这是很多人踩的坑**（在自己页面 setItem 后等事件，等不到）。

**⑤ `cookie` 的四个安全属性**

```http
Set-Cookie: token=abc; HttpOnly; Secure; SameSite=Lax; Max-Age=3600; Path=/
```

| 属性 | 作用 |
|---|---|
| **`HttpOnly`** | JS **读不到**（防 XSS 窃取） |
| **`Secure`** | 只在 HTTPS 下发送 |
| **`SameSite`** | 跨站是否发送（`Strict` / `Lax` / `None`） |
| **`Max-Age` / `Expires`** | 过期时间（不设就是会话 cookie） |

**⚠️ `cookie` 每次同源请求都会带**——这是它和 localStorage 最大的区别。所以**不要用 cookie 存大对象**（每个请求都传，浪费带宽）。

### 9.6.3 选型决策

```
要存什么？
├─ 登录凭证（需要随请求发送）
│   └─ cookie（HttpOnly + Secure + SameSite）
├─ 用户偏好（主题、语言）→ 永久，小数据
│   └─ localStorage
├─ 表单草稿（关标签就丢）→ 标签页级
│   └─ sessionStorage
├─ 大量数据（离线缓存、文件、日志）→ 大容量，异步
│   └─ IndexedDB
└─ 跨标签通信
    └─ localStorage + storage 事件（或 BroadcastChannel）
```

**`BroadcastChannel`（更现代的跨标签通信）**：

```js
const bc = new BroadcastChannel('app');
bc.postMessage({ type: 'logout' });
bc.onmessage = (e) => console.log(e.data);
```

**比 `storage` 事件好**：不依赖 localStorage、能传结构化数据、语义更清晰。

---

## 9.7 跨域速查（题 25、26、28、29）

> **深度内容在「计算机网络-71题 / 网络-10-跨域与CORS」（765 行）**，这里只给 JS 视角的速查。

### 9.7.1 同源策略限制了什么（一句纠正）

**限制「读取响应」，不限制「发送请求」。**

```js
// 简单请求：请求【已经发出去了】，服务器也处理了，只是 JS 读不到响应
fetch('https://api.other.com/data')
  .then(r => r.json())
  .catch(e => console.log(e));    // TypeError: Failed to fetch（看不到具体原因）
```

**这也是 CSRF 的基础**——攻击者不需要读响应，只要请求被执行就够了。

### 9.7.2 四方案对比

| 方案 | 原理 | 支持方法 | 带 cookie | 现状 |
|---|---|---|---|---|
| **CORS** | 服务端返回 `Access-Control-Allow-Origin` | 全部 | ✅（需配三件套） | **标准方案** |
| **代理** | 同源服务器转发 | 全部 | ✅ 自动 | **开发/生产都常用** |
| **JSONP** | `<script>` 不受 SOP 限制 | **只 GET** | ⚠️ 靠 cookie 自动带 | 已淘汰 |
| **postMessage** | 跨窗口通信 | — | — | iframe 场景 |

### 9.7.3 JSONP 的三个致命缺陷

```js
function jsonp(url, cbName = 'callback') {
  return new Promise((resolve, reject) => {
    const name = `__jsonp_${Date.now()}`;
    window[name] = (data) => { resolve(data); delete window[name]; script.remove(); };
    const script = document.createElement('script');
    script.src = `${url}${url.includes('?') ? '&' : '?'}callback=${name}`;
    script.onerror = () => reject(new Error('jsonp failed'));
    document.body.appendChild(script);
  });
}
```

| 缺陷 | 说明 |
|---|---|
| **只支持 GET** | 因为是 `<script>` 加载 |
| **拿不到错误码** | HTTP 500 时 script 加载失败，无法区分「网络错」和「业务错」 |
| **XSS 风险** | 服务端返回的内容会被**当代码执行** |

**为什么现在不用**：CORS 已全面支持（IE10+），JSONP 没有存在意义。

### 9.7.4 CORS 简单请求的三个条件（必记）

```
① 方法只能是 GET / HEAD / POST
② 头只能是安全列表（Accept / Accept-Language / Content-Language / Content-Type / Range）
③ Content-Type 只能是 application/x-www-form-urlencoded、multipart/form-data、text/plain
```

**所以用 `application/json` 一定会触发 OPTIONS 预检。**

---

## 9.8 常见坑

| 坑 | 正确说法 |
|---|---|
| 说「事件流是捕获和冒泡两阶段」 | **三阶段**：捕获 → 目标 → 冒泡 |
| 以为目标阶段 capture 参数生效 | ❌ 目标元素上捕获/冒泡监听器**都按注册顺序**触发 |
| 用 `return false` 阻止默认行为 | ❌ 只在 DOM0（`onclick`）有效，`addEventListener` 无效 |
| 用 `stopPropagation` 阻止同元素后续监听器 | ❌ 要用 `stopImmediatePropagation` |
| 在 passive 监听器里 `preventDefault` | ❌ 无效（Chrome 56+ 对 window/document 的 touch/wheel 默认 passive） |
| 用 `focus`/`blur` 做事件委托 | ❌ 不冒泡，用 `focusin`/`focusout` |
| 事件委托里判断 `e.target.tagName` | 点到子元素会失败，用 `closest()` |
| 虚拟列表只用固定高度方案 | 真实场景多是动态高度，要估算 + 测量 + 前缀和 + 二分 |
| 滚动事件不节流 | 用 `rAF` 节流（不是 `setTimeout`） |
| 以为 `sessionStorage` 跨标签共享 | ❌ 标签页级，不共享 |
| 在本标签 `setItem` 后等 `storage` 事件 | ❌ 不触发自己的标签，只通知其他 |
| 用 localStorage 存大对象 | 同步 API 会阻塞主线程，大数据用 IndexedDB |
| 用 cookie 存大对象 | 每次请求都带，浪费带宽；容量只有 4KB |
| 以为 `localStorage.setItem` 能存对象 | 会变成 `'[object Object]'`，要先 `JSON.stringify` |

---

## 9.9 答题模板

### 30 秒版（题 22：冒泡捕获）

> DOM 事件流有**三个阶段**：捕获（从 window 往里到目标的父元素）、目标（事件到达目标元素本身）、冒泡（从目标往外回到 window）。
> `addEventListener` 第三参数控制在哪一阶段监听：`true` 是捕获，`false`（默认）是冒泡。
> 一个容易错的细节：**在目标元素上，`capture` 参数不生效**——捕获和冒泡的监听器都按**注册顺序**触发。
> 第三参数还可以传对象：`{ once, passive, signal }`，其中 `passive: true` 能大幅提升滚动性能（告诉浏览器不用等 JS 确认）。

### 30 秒版（题 21：事件委托）

> 利用冒泡，把子元素的事件统一绑到父元素，通过 `e.target` 定位实际触发的元素。
> 三个好处：减少监听器数量（省内存）、动态元素自动生效、统一管理。
> 两个关键点：**不冒泡的事件不能委托**（`focus`/`blur` 要用 `focusin`/`focusout`，`mouseenter`/`mouseleave` 要用 `mouseover`/`mouseout`）；**判断目标要用 `closest()` 而不是 `tagName`**，因为可能点到子元素。

### 2 分钟版（题 30：虚拟列表，讲透动态高度）

> 虚拟列表的核心是「只渲染可视区」，但**固定高度和动态高度是完全不同的两个问题**。
>
> **固定高度**很简单：容器总高 = `items.length × itemHeight` 撑开滚动条，滚动时用 `scrollTop / itemHeight` 算出起始索引，只渲染 `[start, end)` 这段，每个 item 用绝对定位或 `transform` 偏移到正确位置。再加个 `overscan` 缓冲区（上下各多渲染 3~5 个）防白屏。
>
> **动态高度**才是真实场景，难点在「不知道每个 item 多高，算不出起始索引」。解法四步：**① 先用平均高度估算**，让首屏能渲染出来；**② 用 `ResizeObserver` 测量真实高度并缓存**（比 `offsetHeight` + 定时可靠，能感知内容变化）；**③ 维护前缀和数组** `positions[i] = 前 i 个的总高`，这样能用**二分查找** O(log n) 定位起始索引（否则要 O(n) 累加）；**④ 测量修正后重建前缀和并重渲染**。
>
> 这里有三个容易忽略的问题。**第一是滚动锚定**：用户正在看第 100 条，上面某个 item 测出真实高度比估算大，内容会整体下移导致「跳」。解法是修正时同步调整 `scrollTop`——如果被修正的 item 在当前视口上方，就补上高度差。**第二是滚动节流**：要用 `requestAnimationFrame` 而不是 `setTimeout`，因为 rAF 和浏览器渲染同步，不会出现「渲染了一帧旧数据」的撕裂。**第三是图片加载后的高度变化**——图片没加载时高度小，加载完变大，也要走一遍修正流程，所以很多库会先固定图片容器比例。
>
> 如果不想手写，用 `@tanstack/virtual` 或 `vue-virtual-scroller`；如果只是几百条，用 CSS 的 `content-visibility: auto` 更简单（零 JS，但它不减少 DOM 节点数）。

### 追问表

| 追问 | 回答要点 |
|---|---|
| 事件流几个阶段 | 三阶段：捕获 → 目标 → 冒泡 |
| 目标阶段 capture 参数生效吗 | 不生效，按注册顺序 |
| `addEventListener` 第三参数 | 布尔（capture）或对象（`{once, passive, signal}`） |
| `passive` 有什么用 | 滚动不等 JS，提升流畅度；但 `preventDefault` 会失效 |
| `once` 有什么用 | 触发一次自动移除 |
| `signal` 有什么用 | `abort()` 一次性移除所有关联监听 |
| `preventDefault` 和 `stopPropagation` | 前者阻止默认行为，后者阻止传播 |
| `stopPropagation` 和 `stopImmediatePropagation` | 后者还会阻止同元素后续监听器 |
| `return false` 能阻止默认行为吗 | 只在 DOM0 有效，`addEventListener` 无效 |
| 事件委托的原理 | 利用冒泡，绑到父元素 + `e.target` 定位 |
| 哪些事件不能委托 | `focus`/`blur`/`mouseenter`/`mouseleave`/`load`（不冒泡） |
| 替代方案 | `focusin`/`focusout`、`mouseover`/`mouseout` |
| 委托为什么要 `closest` | 可能点到子元素，`tagName` 判断会失效 |
| 虚拟列表核心 | 只渲染可视区 + 撑开总高 + 偏移定位 |
| 动态高度怎么做 | 估算 + `ResizeObserver` 测量 + 前缀和 + 二分 |
| 滚动锚定问题 | 高度修正时同步调 `scrollTop` |
| 为什么用 rAF 节流 | 和渲染同步，避免撕裂 |
| localStorage 容量 | 5~10MB |
| sessionStorage 跨标签吗 | 不跨，标签页级 |
| storage 事件会在本标签触发吗 | 不会，只通知其他标签 |
| cookie 容量和特点 | 4KB，每次同源请求都带 |
| 跨标签通信有哪些方式 | `storage` 事件、`BroadcastChannel` |
| JSONP 为什么淘汰 | 只 GET、拿不到错误码、XSS 风险 |

---

## 9.10 速记卡

```
事件流三阶段（题 22）
  捕获（window → 目标父元素）→ 目标（按注册顺序，capture 不生效）→ 冒泡（目标 → window）
  addEventListener 第三参数：true/false 或 { capture, once, passive, signal }
  ★ passive: true 让滚动不等 JS（Chrome 56+ 对 window/document touch/wheel 默认开）
    代价：preventDefault 失效
  ★ signal: ac.signal，abort() 一次性清所有监听

阻止（题 23、24）
  preventDefault      → 阻止默认行为，不影响传播
  stopPropagation     → 阻止传播，同元素其他监听器仍执行
  stopImmediatePropagation → 全阻止
  ★ return false 只在 DOM0（onclick）有效

事件委托（题 21）
  利用冒泡 + e.target + closest()
  优点：少监听器 / 动态元素自动生效 / 统一管理
  ★ 不能委托：focus blur mouseenter mouseleave load（不冒泡）
    用 focusin focusout mouseover mouseout 替代
  ★ 判断目标用 closest 不用 tagName

虚拟列表（题 30）
  固定高度：总高撑开 + scrollTop/itemHeight 算索引 + 绝对定位 + overscan
  动态高度：估算 → ResizeObserver 测量 → 前缀和 → 二分查找 → 修正重渲染
  ★ 滚动锚定：高度修正时同步调 scrollTop
  ★ 节流用 rAF 不用 setTimeout
  简单方案：CSS content-visibility: auto（但不减少 DOM 节点数）

本地存储（题 27）
             容量     同步   生命周期    随请求发送
  localStorage 5~10MB  同步   永久       否
  sessionStorage 5MB   同步   标签页级   否
  cookie       4KB     同步   可设过期   是（每次同源请求）
  IndexedDB    大       异步   永久       否
  ★ localStorage 同步会阻塞主线程 → 大数据用 IndexedDB
  ★ storage 事件不触发自己的标签
  ★ sessionStorage 不跨标签
  ★ BroadcastChannel 比 storage 事件更好用

跨域（题 25、26、28、29）→ 详见「计算机网络-71题/网络-10」
  ★ SOP 限制「读响应」，不限制「发请求」
  四方案：CORS / 代理 / JSONP(只GET,已淘汰) / postMessage
  简单请求三条件（方法 + 安全列表头 + Content-Type 三种）
```
