# 事件传播与 stopPropagation / stopImmediatePropagation

DOM 事件在元素之间传播时，会依次经过三个阶段：

1. **捕获阶段（capture）**：从 `window` 一路向下传到目标元素
2. **目标阶段（target）**：事件到达触发元素本身
3. **冒泡阶段（bubble）**：从目标元素一路向上传回 `window`

`addEventListener(type, handler, useCapture)` 的第三个参数决定监听器挂在哪个阶段：`true` 表示捕获，省略 / `false` 表示冒泡（默认）。

---

## 目录

- [两者区别](#两者区别)
- [示例结构](#示例结构)

---

## 两者区别

| 方法 | 作用 |
| --- | --- |
| `e.stopPropagation()` | 阻止事件继续在 DOM 树上传播（后续的捕获 / 冒泡都不再走），**但当前元素上其他同类型监听器依旧执行** |
| `e.stopImmediatePropagation()` | 更强：既阻止事件继续传播，**也阻止当前元素上后续注册的同类型监听器执行** |

## 示例结构

`parent` 上挂一个冒泡监听，`child` 上先挂捕获监听，再依次挂两个冒泡监听：

```html
<div id="parent">
  parent
  <button id="btn">click</button>
</div>
```

```js
const btn = document.querySelector('#btn')
const parent = document.querySelector('#parent')

// 父元素：冒泡阶段
parent.addEventListener('click', () => console.log('parent click'))

// 子元素：捕获阶段
btn.addEventListener('click', () => console.log('child capture'), true)

// 子元素：冒泡阶段的第一个监听
btn.addEventListener('click', (e) => {
  console.log('child bubble 1')
  // e.stopPropagation()          // 只挡住 parent
  e.stopImmediatePropagation()    // 连 child 后面的监听也挡住
})

// 子元素：冒泡阶段的第二个监听
btn.addEventListener('click', () => console.log('child bubble 2'))
```

点击子元素 `btn`：

- 使用 `stopPropagation()`：`child capture → child bubble 1 → child bubble 2`（`parent` 不再触发）
- 使用 `stopImmediatePropagation()`：`child capture → child bubble 1`（后面的 `child bubble 2` 与 `parent` 都不触发）

> 注意：**同一元素上的多个监听器按注册顺序执行**。`stopPropagation` 拦不住同一元素上后面的监听器，只有 `stopImmediatePropagation` 可以。
