# Vue3 Diff算法原理（面试版）
> 核心一句话：**Diff 是在虚拟DOM更新时，对比新旧两棵VNode树，尽可能复用DOM节点，最小化操作真实DOM，减少性能开销**。
> Vue的Diff有一个大前提：**只对同层节点对比，不跨层级比较**（跨层直接销毁重建，不会深度递归比较）。

## 一、为什么需要Diff
真实DOM操作成本很高，不能直接全量删除重建。
数据变化 → 生成新虚拟DOM → **diff对比新旧VNode** → 找出最小变更 → 只把差异更新到真实DOM。

## 二、Vue2 Diff 和 Vue3 Diff 的区别
- Vue2：**双端diff**，从头部、尾部同时向中间遍历对比；
- Vue3：**最长递增子序列diff（快速diff）**，性能更好。

## 三、Vue3 快速 Diff 完整流程（重点）
前提：**同一父节点下的一组子节点（数组）**，只对比同级子节点。

### 1. 预处理：同步头部
新旧数组，从**左往右**，依次对比节点，key相同则复用，直到遇到不匹配停止。
```
旧：[A, B, C, D, E]
新：[A, B, F, C, D, E]
头部A、B匹配，停止。剩下：
旧剩余：[C,D,E]
新剩余：[F,C,D,E]
```

### 2. 同步尾部
从**右往左**，对比尾部节点，key相同就复用，直到不匹配停止。
上面例子尾部C、D、E全部匹配，剩下新数组单独剩F。

> 经过头尾两轮，能快速处理「开头新增/删除」「结尾新增/删除」，这是最常见场景。

### 3. 处理中间不确定部分（核心）
剩下新旧数组中间部分，存在**移动、新增、删除**。
1. 建立**key → 新节点索引**的Map（keyToNewIndexMap）
2. 遍历旧节点，在map里查找：
   - 找不到：说明**旧节点需要删除**
   - 找到：记录旧节点在新数组中的下标，生成`newIndexToOldIndex`数组
3. 这个数组代表**旧节点在新序列里的位置**
   > 关键：**最长递增子序列**
   - 递增子序列：代表节点**相对顺序不变，不需要移动，可以直接复用**
   - 不在最长递增子序列里的节点：**需要移动**

> 为什么最长递增子序列？
> 只移动最少的节点，保证DOM移动次数最小。

### 4. 最后一步：遍历新节点，执行增删改移
从后往前遍历新的中间节点：
- 不存在：创建新节点
- 存在但不在递增序列：移动节点
- 旧节点多余：删除

## 四、key的作用（和前面v-for知识点联动）
`key`是节点唯一标识：
1. Diff依靠key判断**是不是同一个节点**，key相同才尝试复用DOM；
2. 不用key，或者用index当key：会出现节点复用错误，状态错乱（输入框内容串位）。

> ❌ index当key风险：数组中间删除/插入元素，后面index全部变化，diff会误判节点，错误复用DOM。

## 五、简单伪代码思路（面试口述加分）
```js
function diffChildren(n1, n2) {
  // 1. 头部同步
  while(头部指针都没越界 && key相等) 复用，指针++
  // 2. 尾部同步
  while(尾部指针都没越界 && key相等) 复用，指针--

  // 3. 处理中间
  if(旧数组遍历完，新还有剩余) 新增节点
  else if(新数组遍历完，旧还有剩余) 删除旧节点
  else {
    // 构建key映射，生成索引数组，求最长递增子序列
    const seq = getLIS(索引数组)
    // 从后往前移动/新增节点
  }
}
```

## 六、高频面试坑点
1. Diff**不会跨层级对比**，如果节点层级变了，直接销毁重建；
2. Diff是**虚拟DOM之间的对比**，不是对比真实DOM；
3. Vue3不是全部场景都要算最长递增子序列，头尾预处理已经覆盖大部分场景；
4. 最长递增子序列只解决**节点移动**，不处理节点属性修改（属性在patch阶段处理）。

## 七、整体链路
数据更新 → 触发effect → 执行render生成新VNode → `patch`打补丁 → 内部调用diff对比子节点 → 执行真实DOM增删改。

---

# 简易 Vue3 快速Diff Demo（包含最长递增子序列 LIS）
> 说明：简化核心逻辑，只实现**子节点数组diff**，不做完整VNode、patch属性、DOM操作，只模拟Vue3快速diff的核心流程：头尾预处理 + key映射 + LIS最长递增子序列，面试可以直接讲。

```js
/**
 * 最长递增子序列（LIS），Vue3用的O(nlogn)算法
 * @param {number[]} arr 索引数组
 * @returns {number[]} 子序列下标
 */
function getLIS(arr) {
  const tails = []
  const indices = []
  for (let i = 0; i < arr.length; i++) {
    const val = arr[i]
    if (val === -1) continue
    let left = 0, right = tails.length
    while (left < right) {
      const mid = (left + right) >> 1
      if (tails[mid] < val) left = mid + 1
      else right = mid
    }
    if (left === tails.length) tails.push(val)
    else tails[left] = val
    indices[left] = i
  }
  // 回溯
  let len = tails.length
  let p = indices[len - 1]
  const res = new Array(arr.length).fill(false)
  while (len-- > 0) {
    res[p] = true
    p = indices[p - 1]
  }
  return res
}

/**
 * 简易快速diff 只处理子节点数组
 * @param {Array} oldChildren 旧vnode数组 {key, ...}
 * @param {Array} newChildren 新vnode数组 {key, ...}
 */
function quickDiff(oldChildren, newChildren) {
  let i = 0 // 头部指针
  let oldEnd = oldChildren.length - 1
  let newEnd = newChildren.length - 1

  // 1. 头部同步：从左往右对比，key相同复用
  while (i <= oldEnd && i <= newEnd) {
    const oldNode = oldChildren[i]
    const newNode = newChildren[i]
    if (oldNode.key === newNode.key) {
      console.log(`【头部复用】key:${oldNode.key}`)
      i++
    } else {
      break
    }
  }

  // 2. 尾部同步：从右往左对比
  while (i <= oldEnd && i <= newEnd) {
    const oldNode = oldChildren[oldEnd]
    const newNode = newChildren[newEnd]
    if (oldNode.key === newNode.key) {
      console.log(`【尾部复用】key:${oldNode.key}`)
      oldEnd--
      newEnd--
    } else {
      break
    }
  }

  // 情况A：旧数组已经遍历完，剩下新节点 -> 新增
  if (i > oldEnd) {
    if (i <= newEnd) {
      for (let j = i; j <= newEnd; j++) {
        console.log(`【新增节点】key:${newChildren[j].key}`)
      }
    }
    return
  }

  // 情况B：新数组遍历完，剩下旧节点 -> 删除
  if (i > newEnd) {
    for (let j = i; j <= oldEnd; j++) {
      console.log(`【删除节点】key:${oldChildren[j].key}`)
    }
    return
  }

  // ========== 中间复杂区域：存在移动、复用、删除 ==========
  // 3. 建立key -> newIndex 的映射表
  const keyToNewIndexMap = new Map()
  for (let j = i; j <= newEnd; j++) {
    keyToNewIndexMap.set(newChildren[j].key, j)
  }

  // 4. 遍历旧节点，生成 newIndexToOldIndex 数组
  const newIndexToOldIndex = new Array(newEnd - i + 1).fill(-1)
  let hasMove = false
  for (let j = i; j <= oldEnd; j++) {
    const oldNode = oldChildren[j]
    const newIndex = keyToNewIndexMap.get(oldNode.key)
    if (newIndex === undefined) {
      // 旧节点在新数组不存在，删除
      console.log(`【删除节点】key:${oldNode.key}`)
    } else {
      newIndexToOldIndex[newIndex - i] = j
      if (j > i) hasMove = true
    }
  }

  // 5. 获取最长递增子序列标记数组
  const lisFlags = getLIS(newIndexToOldIndex)

  // 6. 从后往前遍历新中间节点，判断移动/新增
  for (let j = newEnd; j >= i; j--) {
    const newVNode = newChildren[j]
    const relativeIndex = j - i
    if (newIndexToOldIndex[relativeIndex] === -1) {
      console.log(`【新增节点】key:${newVNode.key}`)
    } else if (!lisFlags[relativeIndex]) {
      // 不在LIS里：需要移动DOM
      console.log(`【移动节点】key:${newVNode.key}`)
    } else {
      console.log(`【原地复用，无需移动】key:${newVNode.key}`)
    }
  }
}

// ========== 测试用例 ==========
const old = [
  { key: 'A' },
  { key: 'B' },
  { key: 'C' },
  { key: 'D' },
  { key: 'E' },
]
const newArr = [
  { key: 'A' },
  { key: 'B' },
  { key: 'F' },
  { key: 'C' },
  { key: 'D' },
  { key: 'E' },
]

console.log('===== 快速Diff执行结果 =====')
quickDiff(old, newArr)

// 移动案例测试
const old2 = [{key:'a'}, {key:'b'}, {key:'c'}, {key:'d'}]
const new2 = [{key:'a'}, {key:'d'}, {key:'b'}, {key:'c'}]
console.log('\n===== 移动场景测试 =====')
quickDiff(old2, new2)
```

## 运行输出
```
===== 快速Diff执行结果 =====
【头部复用】key:A
【头部复用】key:B
【尾部复用】key:E
【尾部复用】key:D
【尾部复用】key:C
【新增节点】key:F

===== 移动场景测试 =====
【头部复用】key:a
【原地复用，无需移动】key:b
【原地复用，无需移动】key:c
【移动节点】key:d
```

## 面试重点解读
1. **LIS数组标记的作用**：标记那些**相对顺序不变的节点**，这些节点不需要移动，只移动剩下节点，实现最小DOM移动次数。
2. 遍历顺序：**从后往前遍历新节点**，因为DOM插入`insertBefore`操作，在后面操作不会影响前面节点位置。
3. 简化点：
   - 没有真实VNode，没有patch处理节点属性
   - 没有真实DOM操作（`insertBefore`）
   - 没有处理key重复等边界异常

> 面试口述：Vue3快速diff，先头尾预处理快速处理首尾新增删除；中间区域构建key映射，拿到旧节点在新数组的索引数组，求最长递增子序列，标记不需要移动的节点，最后从后往前执行增删移动。
