# Vue3 Diff算法原理（面试版）
> 核心一句话：**Diff 是在虚拟DOM更新时，对比新旧两棵VNode树，尽可能复用DOM节点，最小化操作真实DOM，减少性能开销**。
> Vue的Diff有一个大前提：**只对同层节点对比，不跨层级比较**（跨层直接销毁重建，不会深度递归比较）。

---

## 目录

- [一、为什么需要Diff](#一为什么需要diff)
- [二、Vue2 Diff 和 Vue3 Diff 的区别](#二vue2-diff-和-vue3-diff-的区别)
- [三、Vue3 快速 Diff 完整流程（重点）](#三vue3-快速-diff-完整流程重点)
- [四、最长递增子序列（LIS）详解](#四最长递增子序列lis详解)
- [五、key的作用（和前面v-for知识点联动）](#五key的作用和前面v-for知识点联动)
- [六、简单伪代码思路（面试口述加分）](#六简单伪代码思路面试口述加分)
- [七、高频面试坑点](#七高频面试坑点)
- [八、整体链路](#八整体链路)
- [简易 Vue3 快速Diff Demo（包含最长递增子序列 LIS）](#简易-vue3-快速diff-demo包含最长递增子序列-lis)
- [运行输出](#运行输出)
- [面试重点解读](#面试重点解读)

---

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
3. 这个数组记录**新位置上的节点在旧数组中的下标**
   > 关键：**最长递增子序列**（下一节详细展开）
   - 递增子序列：代表节点**相对顺序不变，不需要移动，可以直接复用**
   - 不在最长递增子序列里的节点：**需要移动**

> 为什么最长递增子序列？
> 只移动最少的节点，保证DOM移动次数最小。

### 4. 最后一步：遍历新节点，执行增删改移
从后往前遍历新的中间节点：
- 不存在：创建新节点
- 存在但不在递增序列：移动节点
- 旧节点多余：删除

## 四、最长递增子序列（LIS）详解

> Vue3 快速 diff 的核心就是 LIS：**找出一组节点里，哪些节点相对顺序不变、不需要移动 DOM**。

### 1. 子序列 ≠ 子数组

- 子数组：连续的一段
- 子序列：不要求连续，只要保持原有先后顺序即可

### 2. 基础定义

给定一个数字数组，找出**最长**的子序列，满足后面的数字 > 前面的数字（严格递增）。

示例：`arr = [3, 2, 7, 4, 5, 6]`

- 可选的递增子序列：`[3, 7]`、`[2, 4, 5, 6]`
- **最长递增子序列：`[2, 4, 5, 6]`，长度 4**

放到 Vue3 diff 里，数组里存的是**旧节点在新数组中的下标**：下标递增，说明这些节点在旧序列里的先后顺序，在新序列里依然保持不变，**不需要移动 DOM**；不在 LIS 里的节点才需要移动。

### 3. 两种解法

| 解法        | 复杂度     | 说明                         |
| ----------- | ---------- | ---------------------------- |
| 动态规划 DP | O(n²)      | 好理解，但双重循环，Vue 不用 |
| 贪心 + 二分 | O(n log n) | Vue3 源码采用                |

#### ① DP 版本（方便理解原理）

`dp[i]` 表示以第 i 个元素结尾的最长递增子序列长度：

```js
function lisDP(arr) {
  const dp = new Array(arr.length).fill(1)
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < i; j++) {
      if (arr[i] > arr[j]) {
        dp[i] = Math.max(dp[i], dp[j] + 1)
      }
    }
  }
  return dp
}
```

缺点：n 很大时是双重循环，性能差。Vue 的列表可能很长，所以不用。

#### ② 贪心 + 二分（Vue 源码同款）

> 核心思想：维护一个 `tails` 数组，`tails[k]` 表示**长度为 k+1 的递增子序列里末尾最小的数字**。末尾越小，后面越容易接上更大的数字。

遍历每一项 x：

1. x > tails 最后一个元素 → 直接追加到末尾（子序列变长）
2. x ≤ tails 最后一个元素 → 在 tails 里找到**第一个 ≥ x 的位置**，替换成 x（贪心，让末尾更小）
3. 遍历结束，`tails` 的长度就是 LIS 的**长度**

示例 `arr = [3, 2, 7, 4, 5, 6]`：

- x=3 → tails=`[3]`
- x=2 → 第一个 ≥2 的是 3，替换 → tails=`[2]`
- x=7 → 7>2，追加 → tails=`[2, 7]`
- x=4 → 第一个 ≥4 的是 7，替换 → tails=`[2, 4]`
- x=5 → 追加 → tails=`[2, 4, 5]`
- x=6 → 追加 → tails=`[2, 4, 5, 6]`

最终 tails 长度为 4，LIS 长度为 4。

> ⚠️ `tails` **本身不是 LIS 结果**，它只能求长度。要拿到原始数组中哪些下标属于 LIS，还需要额外回溯（记录每个元素的前驱）。

### 4. 在 diff 里怎么用

旧子节点 `[a, b, c, d]` → 新子节点 `[a, d, b, c]`：

1. 头尾预处理：头部 a 匹配，剩旧 `[b, c, d]`、新 `[d, b, c]`
2. 建立 key → 新下标映射，遍历旧节点，得到 `newIndexToOldIndex = [3, 1, 2]`（新位置上的节点在旧数组里的下标）
3. 对 `[3, 1, 2]` 求 LIS 得 `[1, 2]`，对应 b、c
4. b、c 在新旧序列里相对顺序没变 → **不移动**；d 不在 LIS 里 → **移动**

> 为什么这么做：DOM 移动开销大，我们希望**移动的节点数量尽可能少**。最长递增子序列，就是能保持不动的最多节点集合。

### 5. Vue 同款 getLIS（带回溯，返回标记数组）

```js
/**
 * 最长递增子序列（LIS），Vue3 用的 O(n log n) 算法
 * @param {number[]} arr newIndexToOldIndex 数组
 * @returns {boolean[]} 标记每个位置是否属于 LIS，true = 不需要移动
 */
function getLIS(arr) {
  const tails = [] // tails[k]：长度为 k+1 的递增子序列，末尾元素在 arr 里的下标
  const prev = new Array(arr.length).fill(-1) // prev[i]：arr[i] 在 LIS 中的前驱下标

  for (let i = 0; i < arr.length; i++) {
    const val = arr[i]
    if (val === -1) continue // -1 代表新增节点，不参与 LIS

    // 二分查找第一个 >= val 的位置
    let left = 0
    let right = tails.length
    while (left < right) {
      const mid = (left + right) >> 1
      if (arr[tails[mid]] < val) left = mid + 1
      else right = mid
    }

    // 记录前驱：接在长度为 left 的子序列后面
    if (left > 0) prev[i] = tails[left - 1]
    if (left === tails.length) tails.push(i)
    else tails[left] = i
  }

  // 回溯：从 LIS 末尾元素沿 prev 链标记
  const res = new Array(arr.length).fill(false)
  let p = tails.length ? tails[tails.length - 1] : -1
  while (p !== -1) {
    res[p] = true
    p = prev[p]
  }
  return res
}
```

```js
// 测试
const arr = [3, 1, 2]
console.log(getLIS(arr)) // [false, true, true]
// 索引 0：false，d 需要移动；索引 1、2：true，b、c 原地不动
```

### 6. 高频追问

**Q：为什么要用 LIS，而不是别的？**

A：目标是让**尽可能多的节点保持原有相对顺序不移动**。LIS 就是能找出最多这样的节点，剩下的移动，移动次数最小。

**Q：数组里明明是数字递增，为什么就代表 DOM 顺序不变？**

A：数组元素是**旧数组的下标**。新序列里这些旧下标保持递增，说明旧 DOM 里 b 在 c 前面，新 DOM 里 b 依然在 c 前面，相对顺序没变，不用移动。

**Q：LIS 只解决节点移动，那新增和删除谁处理？**

A：新增、删除在求 LIS 之前就标记好了（`newIndexToOldIndex` 里的 `-1` 就是新增节点）。LIS **只管可复用节点里哪些需要移动**。

**Q：Vue2 双端 diff 和 Vue3 快速 diff 的区别？**

Vue2：双端比较，最多 4 个端点逐个比对，遇到需要移动的节点直接移动。

Vue3：头尾预处理后，剩下的节点用 LIS 算出最少移动节点，**移动次数更少，性能更好**。

### 7. 一句话总结

> Vue3 快速 diff 拿到 `newIndexToOldIndex` 数组（存的是新节点对应的旧节点下标），对它求最长递增子序列：序列里的节点相对顺序不变，不需要移动 DOM；其余节点执行移动。用贪心 + 二分把复杂度降到 O(n log n)。

## 五、key的作用（和前面v-for知识点联动）
`key`是节点唯一标识：
1. Diff依靠key判断**是不是同一个节点**，key相同才尝试复用DOM；
2. 不用key，或者用index当key：会出现节点复用错误，状态错乱（输入框内容串位）。

> ❌ index当key风险：数组中间删除/插入元素，后面index全部变化，diff会误判节点，错误复用DOM。

## 六、简单伪代码思路（面试口述加分）
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

## 七、高频面试坑点
1. Diff**不会跨层级对比**，如果节点层级变了，直接销毁重建；
2. Diff是**虚拟DOM之间的对比**，不是对比真实DOM；
3. Vue3不是全部场景都要算最长递增子序列，头尾预处理已经覆盖大部分场景；
4. 最长递增子序列只解决**节点移动**，不处理节点属性修改（属性在patch阶段处理）。

## 八、整体链路
数据更新 → 触发effect → 执行render生成新VNode → `patch`打补丁 → 内部调用diff对比子节点 → 执行真实DOM增删改。

---

## 简易 Vue3 快速Diff Demo（包含最长递增子序列 LIS）
> 说明：简化核心逻辑，只实现**子节点数组diff**，不做完整VNode、patch属性、DOM操作，只模拟Vue3快速diff的核心流程：头尾预处理 + key映射 + LIS最长递增子序列，面试可以直接讲。

```js
/**
 * 最长递增子序列（LIS），Vue3 用的 O(n log n) 算法
 * @param {number[]} arr newIndexToOldIndex 数组
 * @returns {boolean[]} 标记每个位置是否属于 LIS，true = 不需要移动
 */
function getLIS(arr) {
  const tails = [] // tails[k]：长度为 k+1 的递增子序列，末尾元素在 arr 里的下标
  const prev = new Array(arr.length).fill(-1) // prev[i]：arr[i] 在 LIS 中的前驱下标

  for (let i = 0; i < arr.length; i++) {
    const val = arr[i]
    if (val === -1) continue // -1 代表新增节点，不参与 LIS

    // 二分查找第一个 >= val 的位置
    let left = 0
    let right = tails.length
    while (left < right) {
      const mid = (left + right) >> 1
      if (arr[tails[mid]] < val) left = mid + 1
      else right = mid
    }

    // 记录前驱：接在长度为 left 的子序列后面
    if (left > 0) prev[i] = tails[left - 1]
    if (left === tails.length) tails.push(i)
    else tails[left] = i
  }

  // 回溯：从 LIS 末尾元素沿 prev 链标记
  const res = new Array(arr.length).fill(false)
  let p = tails.length ? tails[tails.length - 1] : -1
  while (p !== -1) {
    res[p] = true
    p = prev[p]
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

> 中间区域是从后往前遍历新节点的，所以移动场景的日志顺序也是倒序。

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
【原地复用，无需移动】key:c
【原地复用，无需移动】key:b
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
