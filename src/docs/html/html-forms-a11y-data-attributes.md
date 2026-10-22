# HTML · 03 表单、无障碍与自定义属性

> 本册覆盖：label 的作用（重复 2 次）、`data-*` 的作用、`href="javascript:;"`
> 这四道题题单的答案都只有一句话。但它们背后各有一个**能问 10 分钟的深水区**：
> `label` → 无障碍与「可点击区域」；`data-*` → `dataset` 的命名转换规则；`javascript:;` → 三种伪链接的真实差异（题单这里说错了一半）。

---

## 3.1 一句话结论

**`label` 是把「文字」和「表单控件」绑定起来的元素**，让点击文字等于点击控件（扩大点击热区），并且**让屏幕阅读器知道这个输入框是干什么的**；**`data-*` 是给元素挂自定义数据的标准方式**，JS 通过 `dataset` 读写，**不是给用户看的、不是给 CSS 传值的正规通道、更不是状态管理的替代品**；**`href="javascript:;"` 是一个「什么都不做」的伪协议**，用来阻止 `<a>` 的默认跳转——**但正确做法是用 `<button>`**。

---

## 3.2 label 的作用

### 3.2.1 一句话回答

`label` **把描述性文字和表单控件关联**，产生两个效果：**① 点击文字等于点击控件（扩大可点击区域）；② 屏幕阅读器把 label 文本读作该控件的名称**。

### 3.2.2 两种绑定方式

```html
<!-- ① 显式关联：for 指向控件的 id（推荐） -->
<label for="username">用户名</label>
<input id="username" type="text">

<!-- ② 隐式关联：控件嵌在 label 内部 -->
<label>
  用户名
  <input type="text">
</label>
```

| 方式 | 优点 | 缺点 |
|---|---|---|
| **`for` + `id`** | 结构和样式更灵活（label 可以远离控件）；可以用多行样式 | 需要维护 `id` 唯一 |
| **包裹式** | 不用维护 id；写起来快 | 布局受限；**多个控件时无法指定绑谁**（会绑第一个可标注控件） |

**⚠️ 两条硬规则**：

1. **`for` 的值必须等于目标控件的 `id`**（不是 `name`，不是 `class`）。写错了完全没效果，但**不会有任何报错**——这是最常见的「label 不生效」原因。
2. **`label` 不能嵌套 `label`**。规范禁止（`label` 的内容模型排除 `label`），嵌套会导致点击行为不可预测。

### 3.2.3 为什么它对无障碍（a11y）特别重要

```html
<!-- ❌ 读屏器读出来是「编辑框，空白」——用户不知道要输什么 -->
<input type="text" placeholder="用户名">

<!-- ✅ 读屏器读「用户名，编辑框」 -->
<label for="u">用户名</label>
<input id="u" type="text">
```

**关键点**：**`placeholder` 不能替代 `label`**。

| 对比 | `label` | `placeholder` |
|---|---|---|
| 读屏器读作控件名称 | ✅ | ❌（多数实现不读，或只读一次） |
| 输入后是否消失 | 不消失 | **消失**，用户忘了要输什么 |
| 对比度 | 可控 | **浏览器默认极低**（常不满足 WCAG 4.5:1） |
| 是否可被翻译/自动填充识别 | ✅ | 不稳定 |

> **面试时能说出「placeholder 不能替代 label」这一条，就已经超过大多数候选人。**

### 3.2.4 什么控件需要 label（一个容易漏的点）

**所有「可标注表单控件」都需要**：`button`、`input`（除 `hidden`）、`meter`、`output`、`progress`、`select`、`textarea`。

**但有几个控件的 `label` 意义不大**：

```html
<!-- checkbox / radio：label 是刚需，因为点击区域太小 -->
<input type="checkbox" id="agree">
<label for="agree">我已阅读并同意《用户协议》</label>
<!-- 尤其是在移动端，没有 label 的话用户根本点不准 -->

<!-- 一组 radio：每个 label 绑一个，同时整组要有「组名」 -->
<fieldset>
  <legend>性别</legend>
  <input type="radio" name="gender" id="g1" value="m">
  <label for="g1">男</label>
  <input type="radio" name="gender" id="g2" value="f">
  <label for="g2">女</label>
</fieldset>
<!-- fieldset + legend 给整组一个可访问名称，读屏器会念「性别 分组」 -->
```

### 3.2.5 label 的边界与坑

| 坑 | 说明 | 解法 |
|---|---|---|
| **点击 label 触发两次** | 如果 label 内部既包了 input，又写了 `for`，某些情况下会触发两次 change | 二选一，别混用 |
| **label 里的链接** | `label` 内不能有 `<a>`/`<button>` 等交互元素（会抢走 label 的点击） | 挪到 label 外面 |
| **label 触发了不该触发的控件** | 包裹式 label 内有多个控件时，会标注**第一个** | 用 `for` 显式指定 |
| **`for` 指向 `id` 但 id 重复** | 页面有重复 id 时，`for` 只匹配第一个 | 保证 id 唯一 |
| **label 点击后聚焦但没滚动到可见区** | 长表单里会「跳一下」 | 用 `scroll-margin-top` 处理固定头部 |
| **checkbox 点击 label 后 change 不触发** | 极少见，通常是 `pointer-events` 或事件被 stopPropagation | 检查事件流 |

### 3.2.6 不用 label 的替代方案（知道就行）

```html
<!-- 方案 B：aria-label（控件没有可见文字标签时用） -->
<input type="search" aria-label="搜索商品">

<!-- 方案 C：aria-labelledby（复用页面上已有的文字） -->
<h2 id="ship-title">收货信息</h2>
<form aria-labelledby="ship-title">...</form>

<!-- 方案 D：title 属性（不推荐，触摸设备无效、样式不可控） -->
<input type="text" title="用户名">
```

**优先级**：`<label for>` > `aria-labelledby` > `aria-label` > `title`。

### 3.2.7 顺带：表单提交的三个经典坑（很实用）

```html
<form>
  <input type="text">
  <button>提交</button>     <!-- ⚠️ 默认 type="submit" -->
</form>
```

| 坑 | 现象 | 原因 |
|---|---|---|
| **表单内的 button 会自动提交** | 点「取消」「获取验证码」按钮，表单直接提交了 | `<button>` 的**默认 `type` 是 `submit`**，不是 `button`。必须显式写 `type="button"` |
| **输入框里按回车会提交** | 用户按回车，页面刷新了 | 表单内存在 `submit` 按钮（或只有一个 input）时，回车触发隐式提交 |
| **提交后页面跳走** | SPA 里想用 fetch 提交，结果刷新了 | 必须 `e.preventDefault()` |

```html
<!-- 正确写法 -->
<form id="f">
  <input name="q" type="text">
  <button type="button" id="send">获取验证码</button>
  <button type="submit">搜索</button>
</form>
<script>
f.addEventListener('submit', (e) => {
  e.preventDefault();                 // ★ 必须
  const data = new FormData(f);       // 或者 new URLSearchParams
  fetch('/api', { method: 'POST', body: data });
});
</script>
```

**另外两个表单属性值一提**：

| 属性 | 作用 |
|---|---|
| `novalidate`（表单）/ `formnovalidate`（按钮） | 关掉浏览器原生校验（想自己写校验时用） |
| `autocomplete="off"` / `autocomplete="one-time-code"` | 控制自动填充；验证码用 `one-time-code` 能触发 iOS 短信验证码自动填充 |

### 3.2.8 面试怎么答

**30 秒版**

> `label` 用来把文字和表单控件绑定，通过 `for` 指向控件的 `id`，或者把控件包在 label 里面。效果有两个：一是点击文字等于点击控件，扩大了点击热区，对 checkbox 和 radio 特别重要；二是屏幕阅读器会把 label 文本当作控件的名称读出来，这是无障碍的基础。所以 `placeholder` 不能替代 label——它输入后就消失了，而且对比度低、读屏器支持不好。

**追问表**

| 追问 | 回答要点 |
|---|---|
| `for` 对应什么 | 控件的 `id`（不是 name） |
| 两种绑定方式 | `for`+`id` / 包裹式；不能嵌套 label |
| `placeholder` 能替代 label 吗 | **不能**，输入后消失、对比度低、读屏器不读 |
| 一组 radio 怎么写 | 每个 radio 一个 label + `fieldset`/`legend` 给整组名称 |
| label 能包链接吗 | 不建议，交互元素会抢走 label 的点击 |
| 没有可见文字标签怎么办 | `aria-label` 或 `aria-labelledby` |
| `<button>` 默认 type 是什么 | **`submit`**，所以工具栏按钮必须写 `type="button"` |

---

## 3.3 `data-*` 自定义数据属性

### 3.3.1 一句话回答

`data-*` 是 HTML5 提供的**标准化的「给元素挂自定义数据」的方式**：属性名以 `data-` 开头，值只能是字符串，JS 通过 `element.dataset` 读写，也可以用 `getAttribute`/`setAttribute`。它解决了「以前往元素上乱挂属性（如 `data-id`、`jq-id`）没有规范」的问题。

### 3.3.2 基本用法

```html
<div
  id="user"
  data-user-id="123"
  data-user-name="张三"
  data-role="admin"
  data-is-active="true"
></div>
```

```js
const el = document.getElementById('user');

// 读
el.dataset.userId;              // "123"
el.dataset.role;                // "admin"
el.dataset.isActive;            // "true"   ← 注意是字符串 "true"，不是布尔

// 写
el.dataset.userId = '456';      // 会同步到 HTML 属性 data-user-id="456"
el.dataset.newField = 'x';      // 新增 data-new-field="x"

// 删
delete el.dataset.role;

// 遍历
Object.keys(el.dataset);        // ["userId", "userName", "isActive", ...]
```

### 3.3.3 ★ 命名转换规则（最容易翻车的点）

```
HTML 属性名                          dataset 属性名
data-user-id          →             userId
data-user-name        →             userName
data-role             →             role
data-is-active        →             isActive
data-user--id         →             user-Id      ← 坑！只有一个连字符被吃掉
data-user-2           →             user-2       ← 坑！后面不是字母，连字符保留
```

**转换算法（HTML 规范原文逻辑）**：

> 去掉 `data-` 前缀，然后**只把「连字符 + 小写字母」这一对**替换成「大写字母」。**连字符后面不是小写字母的，连字符原样保留。**

所以：

| HTML | 中间过程 | `dataset` key |
|---|---|---|
| `data-user-id` | `-i` → `I` | `userId` |
| `data-user--id` | 第一个 `-` 后面是 `-`（不是小写字母）→ **保留**；第二个 `-i` → `I` | `user-Id` |
| `data-user-2id` | `-2` 后面是数字 → **保留** | `user-2id` |
| `data-userId`（HTML 里写了大写） | HTML 属性名**大小写不敏感**，被归一化成 `data-userid` | `userid` |

> **实战建议**：**只用「小写字母 + 单个连字符」的命名**，别用连续连字符、别用数字紧跟连字符、别在 HTML 里写大写。这样 `dataset` 的行为才符合直觉。

**另一种读法（不做转换，保留原始名）**：

```js
el.getAttribute('data-user-id');    // "123"   属性名原样
el.dataset.userId;                  // "123"   驼峰化
```

**什么时候必须用 `getAttribute`**：

| 场景 | 原因 |
|---|---|
| 属性名里有连续连字符/数字 | `dataset` 的 key 反直觉 |
| 需要读**原始属性名字符串**（比如做通用组件扫描 `[data-*]`） | `dataset` 已经转换过了 |
| 需要兼容非常老的浏览器（IE10 及以下没有 `dataset`） | `getAttribute` 一直有 |

### 3.3.4 五个必须知道的限制

| 限制 | 说明 | 后果 |
|---|---|---|
| **值永远是字符串** | 写 `dataset.count = 1`，读出来是 `"1"` | `if (el.dataset.count)` 对 `"0"` 和 `"false"` 都是 **truthy** |
| **不能存对象** | 只能存字符串 | 存对象要 `JSON.stringify`，大对象会很丑 |
| **会出现在 HTML 里** | 用户 F12 就能看到、能改 | **绝对不能存敏感数据**（token、权限、价格） |
| **会参与序列化** | SSR 时会被打进 HTML，增加体积 | 别塞大 JSON（如整个列表数据） |
| **HTML 属性名大小写不敏感** | `data-userId` 会被归一化成 `data-userid` | 必须全小写 |

```js
// 类型坑的经典写法
if (el.dataset.enabled === 'true') { }        // ✅
if (el.dataset.enabled) { }                   // ❌ 字符串 "false" 也是 truthy
```

### 3.3.5 `data-*` 该用在哪、不该用在哪

| 场景 | 用 `data-*`？ | 更好的方案 |
|---|---|---|
| **给元素打业务标识**（id、type、index） | ✅ 很合适 | — |
| **事件委托时从 `e.target` 反查数据** | ✅ 最典型用法 | — |
| **给 CSS 传状态**（`[data-state="open"]`） | ✅ 合适 | — |
| **给测试用定位锚点**（`data-testid`） | ✅ 合适 | — |
| **存复杂对象 / 列表数据** | ❌ 不适合 | `Map` / `WeakMap` / 全局 store |
| **存状态并频繁读写（每帧）** | ❌ 性能差 | 实例属性 / `WeakMap` |
| **存敏感信息** | ❌ **禁止** | 服务端校验 |
| **替代 class 表达样式** | ❌ 不必要 | 直接用 class |

**事件委托的经典用法**：

```html
<ul id="list">
  <li data-id="1" data-type="video">视频 A</li>
  <li data-id="2" data-type="article">文章 B</li>
</ul>
```

```js
list.addEventListener('click', (e) => {
  const li = e.target.closest('li[data-id]');
  if (!li) return;
  const { id, type } = li.dataset;      // ✓ 解构直接用
  open(type, Number(id));
});
```

**性能上的一点实话**：`dataset` 是一个 `DOMStringMap` 代理，**每次读写都要走一次属性访问**。在「几千个元素 × 每帧访问」的热路径上，会有可测量的开销。此时把数据在初始化时**一次性读出来存进 `Map`/实例属性**更快：

```js
// 热路径优化：初始化时读一次
const cache = new WeakMap();
document.querySelectorAll('[data-id]').forEach((el) => {
  cache.set(el, { id: Number(el.dataset.id) });
});
// 之后用 cache.get(el)，不再碰 DOM
```

### 3.3.6 面试怎么答

**30 秒版**

> `data-*` 是 HTML5 标准化的自定义数据属性，用来给元素挂业务数据。JS 通过 `element.dataset` 读写，属性名会驼峰化，比如 `data-user-id` 对应 `dataset.userId`，也可以用 `getAttribute` 拿原始名。有三个限制要知道：值永远是字符串，所以 `"false"` 也是 truthy；它会出现在 HTML 里，不能存敏感数据；HTML 属性名大小写不敏感，所以必须全小写。最典型的用法是事件委托时从 `e.target.closest('[data-id]')` 反查数据。

**2 分钟版**

> 我讲用法、转换规则、边界三点。
>
> **用法**上，它解决的问题是：以前想给元素挂点数据，只能随便编个属性名，比如 `jq-id`，不规范也可能和未来的标准冲突。HTML5 定了 `data-*` 这个命名空间，保证永远不会和标准属性撞车。读写有两个 API：`dataset` 和 `getAttribute`。
>
> **转换规则**是重点。`dataset` 的 key 是属性名去掉 `data-` 之后驼峰化，但算法有个容易翻车的地方：**只有「连字符 + 小写字母」这一对才会被替换成大写字母**。所以 `data-user-id` 是 `userId`，但 `data-user--id` 是 `user-Id`——第一个连字符后面还是连字符，不满足条件就保留了。同理 `data-user-2` 是 `user-2`。另外 HTML 属性名大小写不敏感，你在 HTML 里写 `data-userId` 会被归一化成全小写，`dataset` 拿到的是 `userid`。所以实践上就用「小写 + 单个连字符」。
>
> **边界**上有三条。第一，**值永远是字符串**，`dataset.enabled` 拿到的是 `"true"`，如果要判断得写 `=== 'true'`，直接写 `if` 会把 `"false"` 判成真。第二，**它会出现在 HTML 里**，F12 能看能改，所以绝对不能存 token、权限、价格这类东西，也不能存大 JSON 否则 HTML 体积爆炸。第三，**热路径上 `dataset` 有开销**，它是 DOMStringMap 代理，每次访问都是一次属性查找，几千个元素每帧读的话应该初始化时读一次存进 WeakMap。

**追问表**

| 追问 | 回答要点 |
|---|---|
| `data-user-id` 对应 dataset 的什么 | `userId` |
| `data-user--id` 呢 | `user-Id`（只有「连字符+小写字母」才转大写） |
| dataset 值是什么类型 | 永远字符串 |
| `dataset.count = 1` 读出来是什么 | `"1"`（字符串） |
| 能存对象吗 | 不能，要 `JSON.stringify` |
| 能存敏感数据吗 | **不能**，用户在 DevTools 里能看能改 |
| 和 `getAttribute` 区别 | `dataset` 驼峰化；`getAttribute` 原名；老浏览器只支持后者 |
| 和 class 的区别 | class 表达样式，data-* 表达数据/状态；`[data-state=open]` 是合法用法 |
| 性能有问题吗 | 热路径上有，建议初始化时读一次存 WeakMap |
| 还能用什么替代 | `WeakMap`（不污染 DOM、能存对象）、实例属性、状态管理库 |

---

## 3.4 `href="javascript:;"` 是什么

### 3.4.1 一句话回答

`href="javascript:;"` 表示「**点击时执行一段 JS，这段 JS 是空的（一个分号），什么都不做**」。因为 `href` 里是 `javascript:` 伪协议而不是 URL，浏览器**不会跳转**——所以常被拿来当「点了我什么都不做」的伪链接。

> 题单说「等价于 `javascript:void(0)`」——**在「不跳转」这个效果上等价**，但真正的坑不在这里，在 `href="#"`。

### 3.4.2 四种写法的真实差异（★ 核心）

```html
<a href="#">A</a>
<a href="javascript:;">B</a>
<a href="javascript:void(0)">C</a>
<a href="" >D</a>          <!-- 空字符串 -->
<a>E</a>                   <!-- 没有 href -->
```

| 写法 | 是否跳转 | 是否改 URL | 是否加历史记录 | 是否滚到顶部 | 说明 |
|---|---|---|---|---|---|
| `href="#"` | 不离开页面 | **URL 末尾加 `#`** | **会加一条历史** | **会滚到顶部** | 最坑：点几次要按几次返回；单页应用里还会触发 `hashchange` |
| `href="javascript:;"` | **不跳转** | 不变 | **不加** | 不滚 | 返回 `undefined`，什么也不做 |
| `href="javascript:void(0)"` | 不跳转 | 不变 | 不加 | 不滚 | `void 0` 显式返回 `undefined`，语义更明确 |
| `href=""` | **会刷新/跳转到当前 URL** | 可能变 | 可能加 | — | 非常坑，等于重新加载页面 |
| **无 `href`** | 不跳转 | 不变 | 不加 | 不滚 | `<a>` 没有 href 就**不是链接**，**不可 Tab 聚焦、没有 `:link` 样式、鼠标不变手型** |

**关键结论**：

```
href="#"         →  跳锚点 + 加历史 + 滚顶部    ← 三重副作用
javascript:;     →  什么都不做
javascript:void(0) → 什么都不做（语义更清楚）
没有 href        →  什么都不做，但也失去了「链接」的所有行为（不可聚焦）
```

### 3.4.3 为什么说「正确做法是用 `<button>`」

```html
<!-- ❌ 反模式：用 a 当按钮 -->
<a href="javascript:;" onclick="del()">删除</a>

<!-- ✅ 正确：这是「执行一个动作」，不是「跳转到一个地址」 -->
<button type="button" onclick="del()">删除</button>
```

**`<button>` 免费给你的东西**（用 `<a href="javascript:;">` 全都没有）：

| 能力 | `<button>` | `<a href="javascript:;">` |
|---|---|---|
| **可 Tab 聚焦** | ✅ 原生 | ✅（有 href 才可聚焦） |
| **空格键触发** | ✅ 原生 | ❌（a 只响应回车） |
| **`role="button"`** | ✅ 自带 | ❌ 读屏器读作「链接」 |
| **禁用状态** | `disabled` | ❌ 没有（要自己加 class + 拦事件） |
| **表单提交** | `type="submit"` 即可 | ❌ |
| **`aria-disabled` / `:disabled`** | ✅ | ❌ |
| **读屏器的操作提示** | 「按钮，按下」 | 「链接」→ 用户会以为要跳转 |

> **一句话**：**`<a>` 的语义是「导航到某个地址」，`<button>` 的语义是「执行一个动作」。用错元素，视觉上没差别，但键盘用户和读屏器用户会直接懵。**

### 3.4.4 如果非要用 `<a>`（必须知道的三个补丁）

```html
<a href="#" role="button" tabindex="0"
   onclick="del(event)"
   onkeydown="if(event.key==='Enter'||event.key===' ')del(event)">
  删除
</a>
```

```js
function del(e) {
  e.preventDefault();        // ★ 必须：阻止 # 的跳转/加历史
  // ...
}
```

三个补丁：`role="button"`（让读屏器读成按钮）、`preventDefault()`（阻止 `#` 的副作用）、**键盘事件**（空格键）。**能看到这三步，说明你真的在意无障碍。**

### 3.4.5 顺带：`javascript:` 伪协议的其它用法（了解即可）

```html
<!-- 老式写法，已被 CSP 禁止 -->
<a href="javascript:alert(1)">点我</a>
<a href="javascript:void(document.title='x')">改标题</a>
```

**注意**：`javascript:` URL **会被 CSP 的 `script-src` 拦截**（没有 `unsafe-inline` 就不能用），所以现代项目里基本见不到，除了 `javascript:;` 这种「空操作」的用法（它不执行实际代码，但仍属于 inline script，某些严格 CSP 下也会被拦）。

**替代方案**：直接 `<button>`，或者 `href="#!"`（不推荐，仍然是 hack），或者 `href="javascript:void(0)"`（仍是 hack）。

### 3.4.6 面试怎么答

**30 秒版**

> `href="javascript:;"` 是 `javascript:` 伪协议加一个空语句，效果是点击时什么都不做，所以常被当伪链接用。它和 `javascript:void(0)` 在「不跳转」这个效果上等价，`void 0` 语义更明确一点。真正要注意的是 `href="#"`——它会在 URL 上加一个 `#`、加一条历史记录、还要滚到页面顶部，点几次就得按几次返回键。所以如果这个元素是「执行动作」而不是「跳转」，正确做法是用 `<button>`，它能原生 Tab 聚焦、空格触发、支持 disabled，读屏器也会读成按钮。

**追问表**

| 追问 | 回答要点 |
|---|---|
| `href="#"` 有什么问题 | 加 `#` 到 URL、加历史记录、滚到顶部 |
| `javascript:;` 和 `void(0)` 区别 | 效果相同，`void(0)` 显式返回 undefined，语义更清晰 |
| 没有 href 的 `<a>` 会怎样 | 不是链接，不可聚焦、没有链接样式、鼠标不变手型 |
| `href=""` 会怎样 | 跳转到当前 URL（等于刷新） |
| 为什么推荐 `<button>` | 原生可聚焦、空格触发、`disabled`、`role=button` |
| 非要用 `<a>` 怎么做 | `role="button"` + `tabindex="0"` + `preventDefault()` + 键盘事件 |
| `javascript:` 会被 CSP 拦吗 | 会，属于 inline script，`script-src` 不含 `unsafe-inline` 时被拦 |
| 怎么阻止 a 的跳转 | `e.preventDefault()`；`return false` 只在 jQuery/内联 handler 里有效 |

---

## 3.5 补充：无障碍（a11y）速查

HTML 题里最爱用「无障碍」当加分点，这里给一份能直接背的最小集。

### 3.5.1 ARIA 的五条规则（记住第一条就够面试用）

| # | 规则 | 含义 |
|---|---|---|
| **1** | **优先用原生语义，不要用 ARIA 替代** | `<button>` 比 `<div role="button">` 好；原生自带行为，ARIA 只加「说明」不加「能力」 |
| 2 | 不要改变原生语义 | 别给 `h1` 加 `role="button"` |
| 3 | 所有 ARIA 交互控件必须键盘可用 | 加了 `role="button"` 就得自己实现 Tab/Enter/Space |
| 4 | 不要给可见元素加 `aria-hidden="true"` | 会让「看得见但读不到」 |
| 5 | 所有交互元素必须有可访问名称 | `aria-label` / `aria-labelledby` / 文本内容 |

### 3.5.2 最高频的 6 个 ARIA 属性

| 属性 | 用在哪 | 例子 |
|---|---|---|
| `aria-label` | 元素没有可见文字标签时，直接给个名字 | `<input aria-label="搜索">` |
| `aria-labelledby` | 用页面上已有元素的 id 当名字 | `<form aria-labelledby="title">` |
| `aria-describedby` | 补充说明（错误提示、格式说明） | `<input aria-describedby="err">` |
| `aria-hidden="true"` | 纯装饰内容，读屏器跳过 | 装饰性图标 `<svg aria-hidden="true">` |
| `aria-live` | 动态区域，内容变化时读屏器主动播报 | `aria-live="polite"` 用于 toast、`assertive` 用于错误 |
| `aria-expanded` / `aria-controls` | 折叠面板、下拉菜单 | `<button aria-expanded="false" aria-controls="panel">` |

### 3.5.3 `tabindex` 三个值的含义

| 值 | 含义 | 用在哪 |
|---|---|---|
| `tabindex="0"` | **加入** Tab 顺序，按 DOM 顺序 | 自定义控件（`div` 当按钮） |
| `tabindex="-1"` | **可被 JS `.focus()` 聚焦**，但**不在 Tab 顺序里** | 弹窗容器、错误摘要、跳转锚点 |
| `tabindex="1"` 及以上 | **正整数是反模式**，会打乱 Tab 顺序 | **别用** |

### 3.5.4 三个最常被问的无障碍场景

| 场景 | 做法 |
|---|---|
| **模态弹窗** | 打开时把焦点移到弹窗内（`tabindex="-1"` + `focus()`）、**焦点陷阱**（Tab 循环在弹窗内）、`aria-modal="true"`、背景 `aria-hidden="true"`、Esc 关闭、关闭后**焦点还给触发元素**（原生 `<dialog>` + `showModal()` 全都有） |
| **表单错误** | 错误文案用 `aria-describedby` 关联到输入框，同时 `aria-invalid="true"`；提交失败时把焦点移到第一个错误项或错误摘要 |
| **动态内容**（toast、搜索联想、加载状态） | `role="status"`（等价 `aria-live="polite"`）或 `aria-live="assertive"`；注意**容器要先存在于 DOM**，再改内容，否则不播报 |

> **面试话术**：「无障碍这块我主要抓三件事：一是原生语义优先，`button` 而不是 `div role=button`；二是键盘可达，所有交互元素能 Tab 到、能回车/空格触发、焦点可见；三是动态内容要让读屏器知道，用 `aria-live` 或者 `role=status`。弹窗用原生 `dialog` + `showModal()` 能省掉焦点陷阱和背景 inert 的一大堆活。」

---

## 3.6 速记卡

```
label
  for → 控件的 id（不是 name）
  两种：显式 for+id / 隐式包裹；不能嵌套 label
  两个收益：① 点击文字=点击控件（checkbox/radio 刚需）② 读屏器读作控件名
  ★ placeholder 不能替代 label：输入后消失、对比度低、读屏器不读
  一组 radio：每个 label + fieldset/legend
  名称优先级：label > aria-labelledby > aria-label > title

表单提交坑
  <button> 默认 type="submit"  ← 工具栏按钮必须写 type="button"
  表单内回车会隐式提交
  SPA 提交必须 e.preventDefault()
  novalidate / autocomplete="one-time-code"

data-*
  读写：el.dataset.userId  |  el.getAttribute('data-user-id')
  转换：只有「连字符 + 小写字母」→ 大写
    data-user-id   → userId
    data-user--id  → user-Id      ← 坑
    data-user-2    → user-2       ← 坑
    HTML 里写大写 → 归一化成小写 → userid ← 坑
  三条边界：
    ① 值永远字符串（"false" 是 truthy）
    ② 出现在 HTML 里 → 不能存敏感数据、不能塞大 JSON
    ③ 热路径有开销 → 初始化读一次存 WeakMap
  典型用法：事件委托 e.target.closest('[data-id]').dataset

href 伪链接
  href="#"            跳锚点 + 加历史 + 滚顶部  ← 三重副作用
  href="javascript:;" 什么都不做
  href="javascript:void(0)" 什么都不做（语义更清楚）
  href=""             跳当前 URL（等于刷新）
  无 href             不是链接：不可聚焦、无链接样式
  ★ 执行动作就用 <button>：可聚焦 / 空格触发 / disabled / role=button
  非要用 a：role="button" + tabindex="0" + preventDefault + 键盘事件

a11y 最小集
  原生优先（button > div role=button）
  键盘可达（Tab 到、回车/空格触发、focus 可见）
  aria-label / aria-labelledby / aria-describedby / aria-hidden / aria-live
  tabindex: 0 加入顺序 | -1 仅可 JS 聚焦 | 正整数别用
  弹窗：原生 <dialog> + showModal()
```
