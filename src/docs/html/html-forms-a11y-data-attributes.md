# HTML · 03 表单、无障碍与自定义属性

> 覆盖：`label` 绑定与可访问名称、`data-*` 与 `dataset` 转换、伪链接的导航差异、a11y 最小集
> 行为结论在 Chrome 桌面版实测核对

---

## 目录

- [3.1 一句话结论](#31-一句话结论)
- [3.2 label 的作用](#32-label-的作用)
- [3.3 `data-*` 自定义数据属性](#33-data--自定义数据属性)
- [3.4 `href="javascript:;"` 是什么](#34-hrefjavascript-是什么)
- [3.5 补充：无障碍（a11y）速查](#35-补充无障碍a11y速查)
- [3.6 速记卡](#36-速记卡)

---

## 3.1 一句话结论

| 主题 | 结论 |
| --- | --- |
| `label` | 把文字与表单控件绑定：点击文字激活控件，label 文本成为控件的可访问名称 |
| `data-*` | 标准化的自定义数据属性；值只能是字符串，JS 用 `dataset`（驼峰）或 `getAttribute`（原名）读写 |
| `href="javascript:;"` | 点击执行空语句、不导航；执行动作应改用 `<button>` |

---

## 3.2 label 的作用

`label` 把描述性文字和控件关联，产生两个效果：点击文字等于点击控件，扩大热区；label 文本成为控件的可访问名称。

### 3.2.1 两种绑定方式

```html
<!-- 显式：for 指向控件 id -->
<label for="username">用户名</label>
<input id="username" type="text">

<!-- 隐式：控件包在 label 内 -->
<label>用户名 <input type="text"></label>
```

| 方式 | 特点 |
| --- | --- |
| `for` + `id` | label 可以远离控件；需要维护 id 唯一 |
| 包裹式 | 不用维护 id；布局受 label 结构限制 |

两条硬规则：

1. `for` 必须等于目标控件的 `id`（不是 `name`、`class`）。写错没有效果，也不会报错；实测只有 `name` 的输入框，`label.control` 为 `null`，点击 label 不聚焦。
2. `label` 不能嵌套 `label`（内容模型禁止）。

### 3.2.2 placeholder 不能替代 label

| 维度 | `label` | `placeholder` |
| --- | --- | --- |
| 可访问名称 | 稳定来源 | Chrome 在无其他名称时用它兜底，跨浏览器/读屏器不保证 |
| 输入后 | 保留 | 视觉上消失 |
| 对比度 | 可控制 | Chrome 默认 `#757575` 对白底约 4.61:1，刚过 AA；非白背景可能不足 |

`placeholder` 是提示文本，不是标签；需要可见标签时用 `label`，控件没有可见文字时用 `aria-label` / `aria-labelledby`。

### 3.2.3 哪些控件需要 label

所有可标注控件：`button`、`input`（`type="hidden"` 除外）、`meter`、`output`、`progress`、`select`、`textarea`。

checkbox / radio 尤其需要 label，因为控件本身点击区域小；一组 radio 还要用 `fieldset` + `legend` 给整组命名。

```html
<label><input type="checkbox"> 我已阅读并同意《用户协议》</label>

<fieldset>
  <legend>性别</legend>
  <input type="radio" name="gender" id="g1" value="m">
  <label for="g1">男</label>
  <input type="radio" name="gender" id="g2" value="f">
  <label for="g2">女</label>
</fieldset>
```

### 3.2.4 边界与坑

| 场景 | 行为 | 处理 |
| --- | --- | --- |
| 页面 id 重复 | 关联文档顺序中的第一个 | 保证 id 唯一 |
| 包裹式含多个可标注控件 | 只关联第一个 | 用 `for` 指定 |
| label 内含链接 | 点击被链接接管，控件不激活（实测不切换） | 把链接移出 label |
| label 内含其他可标注控件 | 内容模型禁止 | 移出 label |

### 3.2.5 没有可见文字标签时

```html
<input type="search" aria-label="搜索商品">

<h2 id="ship-title">收货信息</h2>
<form aria-labelledby="ship-title">...</form>
```

多个名称来源同时存在时，按 accname 计算：`aria-labelledby` > `aria-label` > 原生 `label` > `title`（Chrome 实测）。作者应优先原生 `label`，但不要指望它覆盖 ARIA 名称。

### 3.2.6 表单提交

```html
<form id="f">
  <input name="q" type="text">
  <button type="button">获取验证码</button>
  <button type="submit">搜索</button>
</form>
```

| 现象 | 原因 |
| --- | --- |
| 工具栏按钮触发表单提交 | `<button>` 默认 `type="submit"`；不提交的按钮显式写 `type="button"` |
| 输入框回车触发表单提交 | 表单有提交按钮时，回车触发其默认提交；没有提交按钮时，Chrome 仅在单个文本控件时隐式提交（实测 1 个提交、2 个不提交） |
| SPA 里提交后页面刷新 | 没有调用 `e.preventDefault()` |

```js
const form = document.querySelector('#f')
form.addEventListener('submit', (e) => {
  e.preventDefault()
  const data = new FormData(form)
  fetch('/api', { method: 'POST', body: data })
})
```

| 属性 | 作用 |
| --- | --- |
| `novalidate`（表单）/ `formnovalidate`（按钮） | 提交时跳过原生校验；`form.checkValidity()` 仍会返回 `false`（实测） |
| `autocomplete` | 取值是规范 token（`off`、`one-time-code` 等）；Chrome 对非法 token 读回空字符串，是否填充取决于浏览器/系统 |

### 3.2.7 口述要点

- 两种绑定：`for` 指向 `id`，或把控件包进 `label`；`for` 写错不报错。
- 两个收益：扩大点击热区；为控件提供可访问名称。
- `placeholder` 不是标签：视觉上会消失，可访问名称跨浏览器不可靠。
- checkbox / radio 必须配 `label`；一组 radio 用 `fieldset` + `legend`。
- 表单里的 `<button>` 默认是 `submit`。

---

## 3.3 `data-*` 自定义数据属性

`data-*` 是 HTML5 规定的自定义数据属性命名空间：属性名以 `data-` 开头，值只能是字符串。JS 用 `element.dataset` 读写，也可以用 `getAttribute` / `setAttribute`。

### 3.3.1 基本用法

```html
<div id="user" data-user-id="123" data-role="admin" data-is-active="true"></div>
```

```js
const el = document.getElementById('user')

el.dataset.userId // "123"
el.dataset.isActive // "true"（字符串，不是布尔）
el.dataset.userId = '456' // 同步到 data-user-id="456"
el.dataset.newField = 'x' // 新增 data-new-field="x"
delete el.dataset.role // 删除 data-role
Object.keys(el.dataset) // ["userId", "isActive", ...]
```

### 3.3.2 命名转换

去掉 `data-` 前缀后，只把「连字符 + 小写字母」替换成大写字母；连字符后面不是小写字母的，连字符原样保留。

| HTML 属性 | `dataset` key | 原因 |
| --- | --- | --- |
| `data-user-id` | `userId` | `-i` → `I` |
| `data-user--id` | `user-Id` | 第一个 `-` 后仍是 `-`，保留；第二个 `-i` 转换 |
| `data-user-2id` | `user-2id` | `-2` 不是小写字母，保留 |
| `data-userId` | `userid` | HTML 属性名归一化为小写 |

建议只使用「小写字母 + 单个连字符」的命名。

`getAttribute` 按原始属性名读写；需要扫描 `[data-*]`，或处理连续连字符 / 数字导致的反直觉 key 时用它。

### 3.3.3 限制

| 限制 | 后果 |
| --- | --- |
| 值始终是字符串 | `dataset.count = 1` 读出 `"1"`；`"false"` 是 truthy |
| 不能存对象 | 只能 `JSON.stringify`；大对象不适合 |
| 会写进 HTML 与 SSR 输出 | 不能存敏感数据，也不要塞大 JSON |
| HTML 属性名大小写不敏感 | HTML 里写 `data-userId` 得到 `data-userid` / `userid` |

```js
if (el.dataset.enabled === 'true') {
  // 正确
}

if (el.dataset.enabled) {
  // "false" 也会进入
}
```

### 3.3.4 适用场景

| 场景 | 是否适合 | 说明 |
| --- | --- | --- |
| 业务标识（id、type、index） | ✅ | 读写直接 |
| 事件委托反查数据 | ✅ | `e.target.closest('[data-id]')` |
| CSS 状态（`[data-state="open"]`） | ✅ | 属性选择器 |
| 测试定位（`data-testid`） | ✅ | 与样式解耦 |
| 复杂对象 / 列表 | ❌ | `Map` / `WeakMap` / store |
| 敏感信息 | ❌ | 用户在 DevTools 可见可改，服务端校验 |
| 替代 class 表达样式 | ❌ | 直接用 class |

```html
<ul id="list">
  <li data-id="1" data-type="video">视频 A</li>
</ul>
```

```js
list.addEventListener('click', (e) => {
  const li = e.target.closest('li[data-id]')
  if (!li) return
  const { id, type } = li.dataset
  open(type, Number(id))
})
```

`dataset` 每次读写都是一次属性访问和字符串转换；数千元素 × 每帧的热路径，初始化时读一次存入 `Map` / `WeakMap`，后续不再碰 DOM。

### 3.3.5 口述要点

- 定义：`data-*` 是标准命名空间，值只能是字符串。
- 读写：`dataset` 做驼峰转换，`getAttribute` 保留原名。
- 转换只认「连字符 + 小写字母」，所以 `data-user--id` 是 `user-Id`、`data-user-2id` 是 `user-2id`。
- 限制：字符串真值判断有坑；属性会出现在 HTML 里，不能存敏感数据。
- 典型用法：事件委托时从 `e.target.closest('[data-id]')` 反查；热路径不要反复读 DOM。

---

## 3.4 `href="javascript:;"` 是什么

`href="javascript:;"` 的 `href` 是 `javascript:` 伪协议，脚本内容是一个空语句。点击时执行空语句，不产生导航，所以常被当作「什么都不做」的伪链接。

### 3.4.1 五种写法的差异

```html
<a href="#">A</a>
<a href="javascript:;">B</a>
<a href="javascript:void(0)">C</a>
<a href="">D</a>
<a>E</a>
```

| 写法 | 是否导航 | URL / 历史 | 滚动 | 说明 |
| --- | --- | --- | --- | --- |
| `href="#"` | 不离开页面 | URL 增加空片段 `#`；历史 +1；重复点击同一片段不再增加 | 回到顶部 | 三重副作用 |
| `href="javascript:;"` | 不导航 | 不变 | 不变 | 空语句 |
| `href="javascript:void(0)"` | 不导航 | 不变 | 不变 | 显式返回 `undefined` |
| `href=""` | 重新加载当前 URL | 清掉 hash | 页面重新加载 | 等于刷新 |
| 无 `href` | 不导航 | 不变 | 不变 | 不是链接：`:link` 不匹配、`focus()` 无效、鼠标不是手型 |

### 3.4.2 为什么用 `<button>`

```html
<!-- 反模式：用 a 当按钮 -->
<a href="javascript:;" onclick="del()">删除</a>

<!-- 正确：执行动作，不是导航 -->
<button type="button" onclick="del()">删除</button>
```

| 能力 | `<button>` | `<a href="javascript:;">` |
| --- | --- | --- |
| 可聚焦 | ✅ | ✅（有 href 才可聚焦） |
| 空格键触发 | ✅ | ❌（只响应回车） |
| 读屏器角色 | button | link |
| 禁用状态 | `disabled` | 没有原生禁用 |
| 表单提交 | `type="submit"` | ❌ |

`<a>` 的语义是「导航到某个地址」，`<button>` 的语义是「执行一个动作」。

### 3.4.3 非要用 `<a>` 时的补丁

```html
<a href="#" role="button" tabindex="0" id="del">删除</a>
```

```js
const del = (e) => {
  e.preventDefault()
  // ...
}

const el = document.querySelector('#del')
el.addEventListener('click', del)
el.addEventListener('keydown', (e) => {
  if (e.key === ' ') {
    e.preventDefault() // 阻止页面滚动
    del(e)
  }
})
```

- `role="button"`：让读屏器读成按钮。
- `tabindex="0"`：去掉 `href` 后 `a` 不可聚焦，必须显式加入 Tab 顺序。
- 空格键：`a` 原生只响应回车，必须手动绑定；`preventDefault()` 阻止页面滚动。
- 回车已经触发原生 `click`，不要再在 `keydown` 里调用一次，否则一次按键执行两次（实测 `keydown` + `click`）。
- 点击处理里 `preventDefault()`：阻止 `#` 改 URL / 加历史。

### 3.4.4 `javascript:` 的其它用法

`javascript:` URL 属于 inline script；`script-src` 不含 `unsafe-inline` 时会被 CSP 拦截（实测控制台报 `Running the JavaScript URL violates ... The action has been blocked`），现代项目里基本不用。替代方案是 `<button>`。

### 3.4.5 口述要点

- `javascript:;` 是空语句，不导航。
- `href="#"` 会加空片段、加历史、滚到顶部；重复点击同一片段不新增历史。
- `href=""` 重新加载当前 URL；没有 `href` 的 `a` 不是链接，不可聚焦。
- 执行动作就用 `<button>`；非要用 `a`，补 `role="button"`、`tabindex="0"`、空格键和 `preventDefault()`。
- `javascript:` URL 受 CSP `script-src` 限制。

---

## 3.5 补充：无障碍（a11y）速查

### 3.5.1 ARIA 的五条规则

| # | 规则 | 含义 |
| --- | --- | --- |
| 1 | 优先原生语义 | `<button>` 优于 `<div role="button">`；ARIA 只补充语义，不提供行为 |
| 2 | 不要改变原生语义 | 别给 `h1` 加 `role="button"` |
| 3 | ARIA 交互控件必须键盘可用 | 加了 `role="button"` 就要实现 Tab / Enter / Space |
| 4 | 不要给可见元素加 `aria-hidden="true"` | 会造成「看得见但读不到」 |
| 5 | 交互元素必须有可访问名称 | `label` / `aria-label` / `aria-labelledby` / 文本内容 |

### 3.5.2 常用 ARIA 属性

| 属性 | 用途 |
| --- | --- |
| `aria-label` | 直接提供名称 |
| `aria-labelledby` | 引用页面上已有元素的 id 作为名称 |
| `aria-describedby` | 补充说明（错误提示、格式说明） |
| `aria-hidden="true"` | 装饰内容从可访问树移除 |
| `aria-live` | 动态区域播报；`polite` 用于 toast，`assertive` 用于错误 |
| `aria-expanded` / `aria-controls` | 折叠面板、下拉菜单的状态与控制目标 |

### 3.5.3 tabindex

| 值 | 含义 | 用在哪 |
| --- | --- | --- |
| `tabindex="0"` | 加入 Tab 顺序，按 DOM 顺序 | 自定义控件 |
| `tabindex="-1"` | 可被 JS `.focus()` 聚焦，不在 Tab 顺序 | 弹窗容器、错误摘要、跳转锚点 |
| `tabindex="1"` 及以上 | 打乱 Tab 顺序 | 不要用 |

### 3.5.4 三个常见场景

| 场景 | 做法 |
| --- | --- |
| 模态弹窗 | 打开后焦点移入（`tabindex="-1"` + `focus()`）、焦点陷阱、`aria-modal="true"`、背景 `aria-hidden="true"`、Esc 关闭、关闭后焦点还给触发元素；原生 `<dialog>` + `showModal()` 自带大部分行为 |
| 表单错误 | 错误文案用 `aria-describedby` 关联，输入框加 `aria-invalid="true"`；提交失败聚焦第一个错误项或错误摘要 |
| 动态内容 | `role="status"`（隐含 `aria-live="polite"`）或 `aria-live="assertive"`；容器先存在于 DOM，再更新内容 |

---

## 3.6 速记卡

```
label
  for → 控件 id（不是 name）；写错无报错
  两种：for + id / 包裹；包裹多个只关联第一个；不能嵌套 label
  收益：点击文字激活控件；label 文本成为可访问名称
  placeholder 不是 label：视觉消失，名称兜底不可靠
  radio 组：每个 label + fieldset/legend
  名称计算：aria-labelledby > aria-label > label > title

表单
  <button> 默认 type="submit"
  有提交按钮时回车提交；无按钮时 Chrome 仅单文本控件隐式提交
  SPA 提交：e.preventDefault()
  novalidate 跳过提交校验；checkValidity() 仍可用

data-*
  dataset.userId / getAttribute('data-user-id')
  只转换「连字符 + 小写字母」：data-user-id → userId
  data-user--id → user-Id；data-user-2id → user-2id
  HTML 里 data-userId → userid
  值永远字符串（"false" 为 truthy）；会写进 HTML；不存敏感数据

伪链接
  # → 空片段 + 历史 + 滚顶部；重复点击不新增历史
  javascript:; / javascript:void(0) → 不导航
  href="" → 重新加载当前 URL
  无 href → 不是链接，不可聚焦
  执行动作 → <button>；非要用 a：role + tabindex + Space + preventDefault

a11y
  原生优先；键盘可达；交互元素要有名称
  aria-label / labelledby / describedby / hidden / live
  tabindex 0 入序 | -1 仅 JS 聚焦 | 正整数别用
  弹窗用原生 dialog + showModal()
```
