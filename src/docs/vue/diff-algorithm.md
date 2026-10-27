# Vue3 Diff算法原理（面试版）

> 一句话：Diff 在更新时对比新旧两棵 VNode 树，复用同层节点，只把差异落到真实 DOM。
> 前提：只比较同一父节点下的同层子节点；跨层级不复用，直接销毁重建。

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

真实 DOM 操作成本高，不能全量删除重建。
数据变化 → 生成新 VNode → diff 对比新旧 VNode → 只把差异更新到真实 DOM。

## 二、Vue2 Diff 和 Vue3 Diff 的区别

Vue2 的 `updateChildren` 是双端比较，每轮最多四次命中：

| 命中 | 动作 |
| --- | --- |
| `sameVnode(oldStart, newStart)` | 头头复用，`oldStart++`、`newStart++` |
| `sameVnode(oldEnd, newEnd)` | 尾尾复用，`oldEnd--`、`newEnd--` |
| `sameVnode(oldStart, newEnd)` | 旧头移到旧尾之后，`oldStart++`、`newEnd--` |
| `sameVnode(oldEnd, newStart)` | 旧尾移到旧头之前，`oldEnd--`、`newStart++` |

`sameVnode` 比较 key 与节点类型。四次都不命中时，用「旧节点 key → 旧下标」表查当前 `newStart`：查到就移动并把旧位置置空，查不到就新建。循环结束后新数组有剩余则新增，旧数组有剩余则删除。

Vue3 快速 diff：先同步头尾，再对中间区间建「key → 新下标」表、按新位置填旧下标，最后对下标数组求 LIS，按 LIS 标记决定谁移动。

## 三、Vue3 快速 Diff 完整流程（重点）

前提：**同一父节点下的一组子节点（数组）**，只对比同级子节点。

### 1. 预处理：同步头部

新旧数组从**左往右**逐项对比，key 相同就复用，遇到不匹配停止。

```
旧：[A, B, C, D, E]
新：[A, B, F, C, D, E]
头部 A、B 匹配后停止：
旧剩余：[C, D, E]
新剩余：[F, C, D, E]
```

### 2. 同步尾部

从**右往左**对比尾部节点，key 相同就复用，直到不匹配停止。
上例尾部 C、D、E 全部匹配，最后新数组只剩 F。

### 3. 处理中间不确定部分（核心）

1. 建立 `key → 新下标` 的 Map（`keyToNewIndexMap`）。
2. 遍历旧中间节点，在 Map 里查：
   - 查不到：该旧节点直接卸载（删除）。
   - 查到：执行 `newIndexToOldIndex[新下标 - 区间起点] = 旧下标`。
3. 数组**下标是新位置，值是该位置节点在旧数组中的下标**；空位（本示例用 `-1`）表示新增节点。
   - 值递增的一组节点，在旧序列中的先后关系在新序列中保持不变，**不需要移动**。
   - 不在 LIS 里的节点，**需要移动**。

> LIS 取「不移动节点」的最大集合，等价于移动次数最少。

### 4. 最后一步：遍历新节点，执行增删改移

从后往前遍历新中间节点，右邻节点（`newChildren[j + 1]`）或父容器末尾就是 `insertBefore` 的锚点：

- 数组空位：创建新节点，插到锚点前。
- 有旧下标但不在 LIS：移动到锚点前。
- 在 LIS：原地不动。
- 多余的旧节点：在步骤 3 已卸载。

## 四、最长递增子序列（LIS）详解

> Vue3 快速 diff 用 LIS 找出「相对顺序不变、不需要移动 DOM」的最多节点。

### 1. 子序列 ≠ 子数组

- 子数组：连续的一段。
- 子序列：不要求连续，只要保持原有先后顺序即可。

### 2. 基础定义

给定一个数字数组，找出**最长**的子序列，满足后面的数字 > 前面的数字（严格递增）。

示例：`arr = [3, 2, 7, 4, 5, 6]`

- 可选的递增子序列：`[3, 7]`、`[2, 4, 5, 6]`
- **最长递增子序列：`[2, 4, 5, 6]`，长度 4**

放进 diff：旧下标递增，说明这些节点在旧序列中的先后关系在新序列中依然成立，**不需要移动 DOM**；不在 LIS 里的节点才需要移动。

### 3. 两种解法

| 解法 | 复杂度 | 说明 |
| --- | --- | --- |
| 动态规划 DP | O(n²) | 好理解，但双重循环，Vue 不用 |
| 贪心 + 二分 | O(n log n) | Vue3 源码采用 |

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

复杂度 O(n²)，Vue 源码采用下一节的 O(n log n) 版本。

#### ② 贪心 + 二分（Vue 源码同款）

> 维护 `tails` 数组，`tails[k]` 表示长度为 `k + 1` 的递增子序列里末尾最小的数字。末尾越小，后面越容易接上更大的数字。

遍历每一项 x：

1. x > `tails` 最后一个元素 → 追加到末尾（子序列变长）。
2. x ≤ `tails` 最后一个元素 → 找到**第一个 ≥ x 的位置**，替换成 x（让末尾更小）。
3. 遍历结束，`tails` 的长度就是 LIS 的长度。

示例 `arr = [3, 2, 7, 4, 5, 6]`：

- x=3 → tails=`[3]`
- x=2 → 第一个 ≥2 的是 3，替换 → tails=`[2]`
- x=7 → 7>2，追加 → tails=`[2, 7]`
- x=4 → 第一个 ≥4 的是 7，替换 → tails=`[2, 4]`
- x=5 → 追加 → tails=`[2, 4, 5]`
- x=6 → 追加 → tails=`[2, 4, 5, 6]`

最终 `tails` 长度为 4，LIS 长度为 4。

> ⚠️ `tails` 本身不保证是 LIS 结果，只能求长度。反例 `[2, 3, 1, 4]` 的 `tails` 是 `[1, 3, 4]`，但 1 在 3 之后，不构成子序列；真实 LIS 是 `[2, 3, 4]`。要还原下标，必须记录每个元素的前驱再回溯。

### 4. 在 diff 里怎么用

旧子节点 `[a, b, c, d]` → 新子节点 `[a, d, b, c]`：

1. 头部 a 匹配，剩旧 `[b, c, d]`、新 `[d, b, c]`。
2. 建 key → 新下标映射，遍历旧节点，得到 `newIndexToOldIndex = [3, 1, 2]`（新位置 d、b、c 对应的旧下标）。
3. 对 `[3, 1, 2]` 求 LIS 得下标 `[1, 2]`，对应 b、c。
4. b、c 相对顺序没变 → **不移动**；d 不在 LIS 里 → **移动**。

### 5. getLIS 实现（贪心 + 二分 + 回溯）

```js
/**
 * 最长递增子序列（LIS），O(n log n)
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

`getLIS([3, 1, 2])` → `[false, true, true]`，索引 0 的 d 移动，索引 1、2 的 b、c 不动。

> 与 Vue 源码 `getSequence` 同思路，两处差异：源码用 `0` 标记新增并返回 LIS 下标数组，这里用 `-1` 标记新增并返回布尔标记。

### 6. 高频追问

**Q：为什么要用 LIS，而不是别的？**

A：目标是让**尽可能多的节点保持原有相对顺序不移动**。LIS 就是这样的最大集合，其余节点移动，移动次数最少。

### 7. 一句话总结

> Vue3 快速 diff 先头尾预处理，再对中间区间生成 `newIndexToOldIndex`（下标是新位置、值是旧下标），对它求最长递增子序列：序列内的节点不移动 DOM，其余节点移动；贪心 + 二分让复杂度为 O(n log n)。

## 五、key的作用（和前面v-for知识点联动）

`key` 是节点身份。Vue3 的 `isSameVNodeType` 比较 `type + key`，key 不同就卸载重建，不会尝试复用。

- **不写 key**：编译产物走 `patchUnkeyedChildren`，按 `min(oldLen, newLen)` 逐个位置 patch，尾部多退少补；运行时数组在 keyed 流程里也只能按 `type` 顺序找一个未占用的新位置。两者都不按内容匹配。
- **用 index 当 key**：等价于按位置匹配。数组中间删除/插入后，同一位置换了数据，节点被复用，组件内部状态（输入框内容、子组件 state）留在了原位置，出现串位。

## 六、简单伪代码思路（面试口述加分）

```js
function diffChildren(n1, n2) {
  // 1. 头部同步
  while (头部指针都没越界 && key 相等) 复用，指针++
  // 2. 尾部同步
  while (尾部指针都没越界 && key 相等) 复用，指针--

  // 3. 处理中间
  if (旧数组遍历完，新还有剩余) 新增节点
  else if (新数组遍历完，旧还有剩余) 删除旧节点
  else {
    // 建 key → 新下标映射，按新位置填旧下标，求 LIS 标记
    const seq = getLIS(索引数组)
    // 从后往前，以右邻节点为锚点新增/移动
  }
}
```

## 七、高频面试坑点

1. Diff **不会跨层级对比**，节点层级变了直接销毁重建。
2. Diff 比的是 **VNode**，不是真实 DOM；属性更新在 patch 阶段完成，不归 LIS 管。
3. LIS 只在中间区间检测到移动（源码里的 `moved`）时才求；头尾预处理覆盖的部分不进入。
4. 新增和删除不靠 LIS：删除在填表阶段直接卸载，新增靠下标数组的空位。

## 八、整体链路

数据更新 → 触发 effect → 执行 render 生成新 VNode → `patch` 打补丁 → 对比子节点执行 diff → 对真实 DOM 增删改。

---

## 简易 Vue3 快速Diff Demo（包含最长递增子序列 LIS）

> 只实现**子节点数组 diff**，不建完整 VNode、不 patch 属性、不操作真实 DOM；`getLIS` 复用第四节实现。

```js
/**
 * 简易快速 diff：只处理子节点数组
 * @param {Array} oldChildren 旧 vnode 数组 { key }
 * @param {Array} newChildren 新 vnode 数组 { key }
 */
function quickDiff(oldChildren, newChildren) {
  let i = 0 // 头部指针
  let oldEnd = oldChildren.length - 1
  let newEnd = newChildren.length - 1

  // 1. 头部同步：从左往右，key 相同就复用
  while (i <= oldEnd && i <= newEnd) {
    if (oldChildren[i].key !== newChildren[i].key) break
    console.log(`【头部复用】key:${oldChildren[i].key}`)
    i++
  }

  // 2. 尾部同步：从右往左，key 相同就复用
  while (i <= oldEnd && i <= newEnd) {
    if (oldChildren[oldEnd].key !== newChildren[newEnd].key) break
    console.log(`【尾部复用】key:${oldChildren[oldEnd].key}`)
    oldEnd--
    newEnd--
  }

  // 3. 旧数组先遍历完：剩余新节点全部新增
  if (i > oldEnd) {
    for (let j = i; j <= newEnd; j++) console.log(`【新增节点】key:${newChildren[j].key}`)
    return
  }

  // 4. 新数组先遍历完：剩余旧节点全部删除
  if (i > newEnd) {
    for (let j = i; j <= oldEnd; j++) console.log(`【删除节点】key:${oldChildren[j].key}`)
    return
  }

  // 5. 中间区间：key → 新下标
  const keyToNewIndexMap = new Map()
  for (let j = i; j <= newEnd; j++) keyToNewIndexMap.set(newChildren[j].key, j)

  // 6. 按新位置填旧下标；查不到的旧节点直接删除
  const newIndexToOldIndex = new Array(newEnd - i + 1).fill(-1)
  for (let j = i; j <= oldEnd; j++) {
    const newIndex = keyToNewIndexMap.get(oldChildren[j].key)
    if (newIndex === undefined) console.log(`【删除节点】key:${oldChildren[j].key}`)
    else newIndexToOldIndex[newIndex - i] = j
  }

  // 7. LIS 标记：true = 相对顺序不变，不移动
  const lisFlags = getLIS(newIndexToOldIndex)

  // 8. 从后往前，以右邻节点/末尾为锚点处理中间区间
  for (let j = newEnd; j >= i; j--) {
    const relativeIndex = j - i
    if (newIndexToOldIndex[relativeIndex] === -1) {
      console.log(`【新增节点】key:${newChildren[j].key}`)
    } else if (!lisFlags[relativeIndex]) {
      console.log(`【移动节点】key:${newChildren[j].key}`)
    } else {
      console.log(`【原地复用，无需移动】key:${newChildren[j].key}`)
    }
  }
}

// ========== 测试用例 ==========
const old = [{ key: 'A' }, { key: 'B' }, { key: 'C' }, { key: 'D' }, { key: 'E' }]
const newArr = [{ key: 'A' }, { key: 'B' }, { key: 'F' }, { key: 'C' }, { key: 'D' }, { key: 'E' }]

console.log('===== 快速Diff执行结果 =====')
quickDiff(old, newArr)

const old2 = [{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }]
const new2 = [{ key: 'a' }, { key: 'd' }, { key: 'b' }, { key: 'c' }]
console.log('\n===== 移动场景测试 =====')
quickDiff(old2, new2)
```

## 运行输出

> 中间区间从后往前遍历，移动场景的日志顺序也是倒序。

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

1. **LIS 标记的作用**：标记相对顺序不变的节点，这些节点不移动，只移动其余节点，DOM 移动次数最少。
2. **为什么从后往前**：右邻节点已经就位，`insertBefore(node, anchor)` 不会影响左侧待处理节点。
3. **示例的简化边界**：没有完整 VNode 与属性 patch，没有真实 DOM 操作，也没有重复 key 校验（源码遇到重复 key 会告警）。
