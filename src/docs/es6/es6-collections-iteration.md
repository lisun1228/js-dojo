# 分册 06 · 集合、迭代与数组扩展

> 覆盖题号：**17**（Set 数据结构）、**18**（`WeakMap` 与 `Map`）、**16**（Set 与数组互转）、**22**（`for...in` 与 `for...of`）、**7**（ES6 新增的数组方法）
> 共 **5 题**，题单给的答案都只有两三行，实际每一题都有能深挖的点

---

## 目录

- [6.1 Set 数据结构（题 17）](#61-set-数据结构题-17)
- [6.2 Set 与数组互转（题 16）](#62-set-与数组互转题-16)
- [6.3 Map 与 Object 的选型](#63-map-与-object-的选型)
- [6.4 Map 与 WeakMap（题 18）](#64-map-与-weakmap题-18)
- [6.5 for...in 与 for...of（题 22）](#65-forin-与-forof题-22)
- [6.6 ES6 新增的数组方法（题 7）](#66-es6-新增的数组方法题-7)
- [6.7 本册答题模板汇总](#67-本册答题模板汇总)
- [6.8 速记卡与连环追问](#68-速记卡与连环追问)

---

## 6.1 Set 数据结构（题 17）

### 6.1.0 一句话结论

> `Set` 是**成员唯一**的集合，底层是哈希表，查找/插入/删除平均 **O(1)**。它会自动去重，判等用的是 **SameValueZero** 算法（`NaN` 被视为相等，`+0` 与 `-0` 相等），并**保持插入顺序**。常用场景是**去重**和**集合运算**（并、交、差）。

### 6.1.1 基本 API

```js
const s = new Set([1, 2, 2, 3]);
console.log(s);          // Set(3) { 1, 2, 3 }
console.log(s.size);     // 3        ← 注意是【属性】，不是方法（不是 size()）

s.add(4);                // 返回 Set 本身（可链式）
s.has(2);                // true
s.delete(2);             // true（删除成功）/ false（不存在）
s.clear();               // 清空

// 遍历：插入顺序
for (const v of s) console.log(v);
s.forEach((v, k) => console.log(v, k));   // Set 的 forEach 里 key === value
```

> **一个常见的记错点**：`Set.size` 是**属性**，`Map.size` 也是属性，但 `Array.length` 也是属性——而 `Object` 没有 `size`（要用 `Object.keys(obj).length`）。

### 6.1.2 判等规则：SameValueZero（高频追问）

```js
// ① NaN 会被去重（SameValueZero 认为 NaN === NaN）
console.log(new Set([NaN, NaN]).size);        // 1

// 但对比例外：indexOf 找不到 NaN
console.log([NaN].indexOf(NaN));              // -1
console.log([NaN].includes(NaN));             // true  ← includes 用的也是 SameValueZero

// ② +0 和 -0 视为相等
console.log(new Set([0, -0]).size);           // 1

// ③ 对象按引用比较，内容相同也不去重
console.log(new Set([{ a: 1 }, { a: 1 }]).size);   // 2  ← 两个不同引用
const obj = { a: 1 };
console.log(new Set([obj, obj]).size);             // 1  ← 同一个引用
```

**三种"相等"算法的对比（这是加分项）**：

| 算法 | 用在 | `NaN` vs `NaN` | `+0` vs `-0` |
|---|---|---|---|
| `===`（严格相等） | 普通比较 | ❌ `false` | ✅ `true` |
| `Object.is`（同值相等） | `Object.is()` | ✅ `true` | ❌ `false` |
| **SameValueZero** | `Set`/`Map`/`includes` | ✅ `true` | ✅ `true` |

> **一句话记忆**：SameValueZero = `Object.is` 但把 `+0/-0` 当成相等。

### 6.1.3 去重的三个坑

```js
// 坑 1：对象去重无效（引用不同）
const arr1 = [{ id: 1 }, { id: 1 }];
console.log([...new Set(arr1)].length);   // 2

// 解决：按某个字段去重
const uniqueById = [...new Map(arr1.map((o) => [o.id, o])).values()];

// 坑 2：NaN 能去重，但 undefined / null 也各算一个
console.log([...new Set([NaN, NaN, undefined, null, null])]);  // [NaN, undefined, null]

// 坑 3：字符串和数字不相等
console.log(new Set([1, '1']).size);   // 2
```

### 6.1.4 集合运算（ES2025 原生支持前，自己写）

```js
const a = new Set([1, 2, 3]);
const b = new Set([2, 3, 4]);

// 并集
const union = new Set([...a, ...b]);                       // {1,2,3,4}
// 交集
const inter = new Set([...a].filter((x) => b.has(x)));     // {2,3}
// 差集（a 有 b 没有）
const diff = new Set([...a].filter((x) => !b.has(x)));     // {1}
// 对称差（只在一个里）
const symDiff = new Set([...[...a].filter((x) => !b.has(x)), ...[...b].filter((x) => !a.has(x))]);
```

**ES2025 已经把这些做成原生方法**：

```js
a.union(b);              // 并集
a.intersection(b);       // 交集
a.difference(b);         // 差集
a.symmetricDifference(b);// 对称差
a.isSubsetOf(b);         // 子集
a.isSupersetOf(b);       // 超集
a.isDisjointFrom(b);     // 无交集
```

> **面试话术**：「ES2025 已经把集合运算做成原生方法了，之前得自己用 `filter` + `has` 写。不过考虑到兼容性，项目里通常还是手写或引 `lodash`。」

### 6.1.5 Set 的性能与选型

| 操作 | `Set` | `Array` |
|---|---|---|
| 查找 `has` / `includes` | **O(1)** 平均 | O(n) |
| 插入 `add` / `push` | O(1) | O(1)（尾部） |
| 删除 `delete` / `splice` | **O(1)** | O(n) |
| 按索引访问 | ❌ 不支持 | ✅ O(1) |
| 去重 | 天然支持 | 要额外处理 |
| 内存 | 略高（哈希表开销） | 低 |

**典型场景**：

```js
// ① 数组去重（最常见）
const unique = [...new Set(list)];

// ② 频繁 has 判断（用数组是 O(n)，用 Set 是 O(1)）
// ❌ 权限判断写在循环里，数组每次都要 O(n)
const permissions = ['read', 'write', 'delete'];
permissions.includes('write');   // O(n)

// ✅ 换成 Set
const permissionSet = new Set(permissions);
permissionSet.has('write');      // O(1)
// ⚠️ 注意：Set 只适合"一次性构建、多次查询"，频繁增删反而要重建数组

// ③ 记录已处理过的 id（去重 + 判断）
const seen = new Set();
for (const item of list) {
  if (seen.has(item.id)) continue;
  seen.add(item.id);
  process(item);
}
```

### 6.1.6 答题模板

**30 秒版：**

> "`Set` 是成员唯一的集合，底层是哈希表，查找和删除是 O(1)。它会自动去重，判等用的是 **SameValueZero** 算法，所以 `NaN` 会被去重、`+0` 和 `-0` 视为相等，但对象是按引用比较的，内容相同也不去重。
> 常用 API 是 `add`/`has`/`delete`/`size`，遍历保持插入顺序。典型场景是数组去重、频繁的 `has` 判断，以及并集交集差集这类集合运算。"

**2 分钟版补充：**

> "两个细节：
> 一是**判等算法**要能说清。`Set` 和 `Array.includes` 用的都是 SameValueZero，它比 `===` 多认了 `NaN === NaN`，比 `Object.is` 少了 `+0/-0` 的区分。所以 `[NaN].indexOf(NaN)` 是 `-1`，但 `[NaN].includes(NaN)` 是 `true`。
> 二是**选型**。`Set` 适合"一次性构建、多次查询"，因为它的 `has` 是 O(1)；但需要按索引访问、或者频繁增删后还要遍历，还是用数组。而且 `Set` 转数组每次都要 `[...set]`，这个开销要考虑。"

### 6.1.7 追问表

| 追问 | 答题要点 |
|---|---|
| `Set` 判重用的什么算法？ | SameValueZero |
| `NaN` 会重复吗？ | 不会，只留一个 |
| `{a:1}` 和 `{a:1}` 会去重吗？ | 不会，按引用 |
| `size` 是属性还是方法？ | **属性**（`s.size`，不是 `s.size()`） |
| `Set` 保持顺序吗？ | 保持插入顺序 |
| `Set` 能按索引访问吗？ | 不能，要转数组 |
| `Set` 的时间复杂度？ | `has`/`add`/`delete` 平均 O(1) |
| `Set` 怎么转数组？ | `[...set]` 或 `Array.from(set)` |
| 怎么对对象数组去重？ | `new Map(arr.map(o => [o.id, o])).values()` |
| `Set` 有 `map`/`filter` 吗？ | 没有，要先转数组 |
| 集合运算原生支持吗？ | ES2025 有 `union`/`intersection` 等方法 |
| `WeakSet` 和 `Set` 区别？ | 成员只能是对象、弱引用、不可枚举 |

---

## 6.2 Set 与数组互转（题 16）

### 6.2.0 一句话结论

> **数组 → Set**：`new Set(arr)`；**Set → 数组**：`[...set]` 或 `Array.from(set)`。两个方向都能"顺手"做额外处理：`new Set(arr)` 天然去重，`Array.from(set, mapFn)` 可以在转换时映射。

### 6.2.1 四个方向的写法

```js
const arr = [1, 2, 2, 3];

// 数组 → Set
const set = new Set(arr);                 // Set(3) {1,2,3}

// Set → 数组
const back1 = [...set];                   // [1,2,3]
const back2 = Array.from(set);            // [1,2,3]

// Set → 数组（带映射）
const doubled = Array.from(set, (x) => x * 2);   // [2,4,6]
// 注意：[...set].map(...) 也可以，但 Array.from 只遍历一次

// 数组 → Set（从类数组）
const fromLike = new Set(Array.from({ length: 3 }, (_, i) => i));   // {0,1,2}
```

### 6.2.2 去重的完整写法对照

```js
// ① 最常用
const unique1 = [...new Set(arr)];

// ② 兼容性更好的写法（老环境）
const unique2 = Array.from(new Set(arr));

// ③ 需要保持原顺序 + 支持 NaN
const unique3 = arr.filter((item, index) => arr.indexOf(item) === index);
// ⚠️ 这个写法有两个问题：indexOf 找不到 NaN（会被全部过滤掉）+ O(n²)

// ④ 手写（能处理 NaN）
const unique4 = arr.filter((item, index, self) =>
  self.findIndex((x) => Object.is(x, item)) === index
);
```

**性能对比（10 万元素）**：

| 方式 | 耗时 | 说明 |
|---|---|---|
| `[...new Set(arr)]` | 最快 | O(n) |
| `Array.from(new Set(arr))` | 接近 | O(n) |
| `filter + indexOf` | 慢 100 倍以上 | O(n²) |
| `reduce + includes` | 同上 | O(n²) |

> **面试提醒**：如果被问"怎么去重"，答 `[...new Set(arr)]` 是标配，但要补一句「`filter + indexOf` 虽然常见，但是 O(n²)，而且处理不了 `NaN`」。

### 6.2.3 `Array.from` 与扩展运算符的差异（常被追问）

```js
// ① Array.from 能处理【类数组】（有 length 和索引，但不可迭代）
const like = { 0: 'a', 1: 'b', length: 2 };
console.log(Array.from(like));    // ['a', 'b']
// console.log([...like]);        // ❌ TypeError: not iterable

// ② 扩展运算符要求【可迭代】（有 Symbol.iterator）
console.log([...'abc']);          // ['a','b','c']
console.log([...new Set([1,2])]); // [1,2]
console.log([...document.querySelectorAll('div')]);  // ✅ NodeList 是可迭代的

// ③ Array.from 有第二个参数（映射函数），只遍历一次
Array.from([1,2,3], (x) => x * 2);      // [2,4,6]
[...[1,2,3]].map((x) => x * 2);          // 效果一样，但多一次遍历

// ④ Array.from 还能从 Map 的 entries 构造
Array.from(new Map([['a', 1]]));         // [['a', 1]]
```

**一句话区分**：

> `Array.from` 认「**类数组 + 可迭代**」两种，`...` 只认「**可迭代**」。

### 6.2.4 其他集合的互转

```js
// Map → 数组
const m = new Map([['a', 1], ['b', 2]]);
[...m];                    // [['a',1], ['b',2]]
[...m.keys()];             // ['a','b']
[...m.values()];           // [1,2]
Object.fromEntries(m);     // {a:1, b:2}  ← ES2019

// 对象 → Map
new Map(Object.entries({ a: 1, b: 2 }));

// 数组 → Map（键值对数组）
new Map([[1, 'a'], [2, 'b']]);
```

### 6.2.5 答题模板

**30 秒版：**

> "数组转 Set 用 `new Set(arr)`，Set 转数组用 `[...set]` 或者 `Array.from(set)`。
> 两个额外点：`new Set` 天生去重，是最常用的去重写法；`Array.from` 可以接第二个参数做映射，而且它比扩展运算符兼容性更广——`Array.from` 既能处理**类数组**也能处理**可迭代对象**，扩展运算符只能处理可迭代的。"

**2 分钟版补充：**

> "补充一个对比：去重还有种常见写法是 `filter + indexOf`，但它有两个问题——O(n²) 的性能，以及 `indexOf` 找不到 `NaN` 会导致 `NaN` 被误删。所以标准答案还是 `[...new Set(arr)]`。
> 如果需要按对象某个字段去重，可以用 `new Map(arr.map(o => [o.id, o])).values()`，借 Map 的键唯一性来做。"

### 6.2.6 追问表

| 追问 | 答题要点 |
|---|---|
| 数组转 Set？ | `new Set(arr)` |
| Set 转数组？ | `[...set]` / `Array.from(set)` |
| `Array.from` 和 `...` 区别？ | 前者支持类数组 + 可迭代 + 映射函数 |
| 类数组能直接 `...` 吗？ | 不能，除非它实现了 `Symbol.iterator` |
| 去重最优写法？ | `[...new Set(arr)]`，O(n) |
| `filter + indexOf` 有什么问题？ | O(n²) + `NaN` 会被误删 |
| Map 转对象？ | `Object.fromEntries(map)` |
| 对象转 Map？ | `new Map(Object.entries(obj))` |
| Set 转数组会保持顺序吗？ | 会，按插入顺序 |

---

## 6.3 Map 与 Object 的选型

> 原题单没单独出这题，但第 18 题（`WeakMap` vs `Map`）必然会带出来。这一节算是补漏。

### 6.3.1 六个差异

| 维度 | `Object` | `Map` |
|---|---|---|
| **键的类型** | 只能是 **string / symbol**（其他类型会被转字符串） | **任意类型**（对象、函数、`NaN` 都行） |
| **键的顺序** | 整数键升序 → 字符串键插入顺序 | **纯插入顺序** |
| **大小** | `Object.keys(o).length`（O(n)） | `map.size`（O(1)） |
| **原型污染** | 有（`toString`、`constructor` 等） | 无 |
| **迭代** | 要 `Object.entries` 转 | 原生可迭代 |
| **频繁增删** | 性能差（V8 会退化为字典模式） | 优化过，稳定 |

```js
// ① 键类型：Object 会把键转成字符串
const o = {};
const key = { id: 1 };
o[key] = 'value';
console.log(o);          // { '[object Object]': 'value' }  ← 键被转了！

const m = new Map();
m.set(key, 'value');
console.log(m.get(key)); // 'value'  ← 真正的对象键

// ② 顺序：Object 的整数键会被"提前"
const o2 = { b: 1, 2: 2, a: 3, 1: 4 };
console.log(Object.keys(o2));   // ['1', '2', 'b', 'a']  ← 整数键按升序排前面

const m2 = new Map([['b', 1], [2, 2], ['a', 3], [1, 4]]);
console.log([...m2.keys()]);    // ['b', 2, 'a', 1]  ← 严格插入顺序

// ③ 原型污染
const o3 = {};
console.log(o3['toString']);    // [Function] ← 不是 undefined！
const m3 = new Map();
console.log(m3.get('toString'));// undefined  ← 干净
```

### 6.3.2 选型建议

```
键是字符串 / 固定结构，需要 JSON 序列化 → Object
键是对象 / 数字 / 需要频繁增删 / 需要 size → Map
只需要"临时缓存、不影响 GC" → WeakMap
```

### 6.3.3 一个实战：用 Map 做请求缓存

```js
const cache = new Map();

async function request(url, options = {}) {
  const key = `${options.method || 'GET'}:${url}`;
  if (cache.has(key)) return cache.get(key);

  const promise = fetch(url, options).then((r) => r.json());
  cache.set(key, promise);        // 缓存 Promise 而不是结果，能去重并发请求
  try {
    return await promise;
  } catch (e) {
    cache.delete(key);            // 失败要清缓存
    throw e;
  }
}
```

> **这个技巧叫「请求去重」**：缓存 Promise 而不是结果，这样同时发起的多个相同请求只会真正发出一次。

---

## 6.4 Map 与 WeakMap（题 18）

### 6.4.0 一句话结论

> `Map` 的键可以是**任意类型**、对键是**强引用**、可枚举、有 `size`；`WeakMap` 的键**只能是对象**、对键是**弱引用**（键被 GC 回收时条目自动消失）、**不可枚举**、**没有 `size`**。所以 `WeakMap` 天然适合做「**跟对象生命周期绑定的附属数据**」——比如私有数据、DOM 关联数据、缓存，不会造成内存泄漏。

### 6.4.1 五个差异

| 维度 | `Map` | `WeakMap` |
|---|---|---|
| **键的类型** | 任意类型 | **只能是对象**（`null` 也不行） |
| **引用强度** | **强引用**（阻止 GC） | **弱引用**（不阻止 GC） |
| **可枚举** | ✅ `keys()`/`values()`/`entries()`/`forEach` | ❌ **完全不可枚举** |
| **`size`** | ✅ | ❌ 没有（因为随时可能变） |
| **`clear`** | ✅ | ❌ 没有（无法一次清空，因为不知道有哪些键） |
| **迭代** | ✅ 可迭代 | ❌ 不可迭代 |

```js
const wm = new WeakMap();
wm.set('str', 1);          // ❌ TypeError: Invalid value used as weak map key
wm.set(null, 1);           // ❌ TypeError
wm.set({}, 1);             // ✅

console.log(wm.size);      // undefined（没有这个属性）
```

### 6.4.2 "弱引用"到底意味着什么（核心）

```js
let obj = { id: 1 };
const map = new Map();
const weakMap = new WeakMap();

map.set(obj, 'data in Map');
weakMap.set(obj, 'data in WeakMap');

obj = null;   // 断开外部引用

// 此时 { id: 1 } 这个对象：
//   - Map 仍然强引用它 → 不会被 GC → map 里还有这一条，且内存不释放
//   - WeakMap 是弱引用 → 下一轮 GC 会回收这个对象 → weakMap 里这条自动消失
```

**用图理解**：

```
      map ──强引用──→ { id: 1 }        ← 即使外部没人引用，也不回收
weakMap ┈┈弱引用┈┈→ { id: 1 }        ← 外部没人引用就能回收

回收后：
      map  ──→ { id: 1 }（还在，泄漏）
weakMap  ──→ （条目自动消失）
```

**这就是为什么 `WeakMap` "不会内存泄漏"**：它不参与"可达性"判断。GC 判断一个对象是否可回收时，**只看强引用**，弱引用不算。

### 6.4.3 四个经典用途

```js
// ① 给对象挂"私有数据"（ES2022 的 #field 之前的标准做法）
const _private = new WeakMap();

class Person {
  constructor(name) {
    _private.set(this, { name });
  }
  getName() {
    return _private.get(this).name;   // 外部拿不到 _private 里的内容
  }
}

// ② 给 DOM 节点挂关联数据（节点移除后数据自动释放）
const listeners = new WeakMap();

function bind(el, handler) {
  listeners.set(el, handler);
  el.addEventListener('click', handler);
}
function unbind(el) {
  const handler = listeners.get(el);
  if (handler) {
    el.removeEventListener('click', handler);
    listeners.delete(el);
  }
}
// 即使忘了 unbind，el 被移除并被回收后，WeakMap 里那条也会自动消失

// ③ 缓存（键是对象，对象不用了就自动清）
const cache = new WeakMap();

function process(obj) {
  if (cache.has(obj)) return cache.get(obj);
  const result = heavyCompute(obj);
  cache.set(obj, result);
  return result;
}

// ④ Vue3 的依赖存储（这是最好的例子）
// 源码大致结构：
const targetMap = new WeakMap();   // target → depsMap
// targetMap: WeakMap<target, Map<key, Set<effect>>>
// target 是响应式对象，对象被回收时，它对应的整个依赖表也自动释放
```

**Vue3 为什么用 `WeakMap`？** 因为组件销毁后，如果 `target` 是普通对象且已经没人引用，用 `WeakMap` 能让整棵依赖树被回收；用 `Map` 就会永久泄漏。

### 6.4.4 `WeakSet` 与 `WeakRef`

```js
// WeakSet：成员只能是对象，弱引用，不可枚举
const ws = new WeakSet();
const el = document.querySelector('#x');
ws.add(el);
ws.has(el);              // true
// 用途：标记"已处理过的对象"，不阻止回收

// WeakRef（ES2021）：创建一个对对象的弱引用
let target = { big: 'data' };
const ref = new WeakRef(target);
target = null;
ref.deref();             // 可能返回对象，也可能返回 undefined（已被回收）

// FinalizationRegistry（ES2021）：对象被回收时收到通知
const registry = new FinalizationRegistry((heldValue) => {
  console.log(`${heldValue} 被回收了`);
});
registry.register(target, 'some-id');
```

> ⚠️ **`WeakRef` 和 `FinalizationRegistry` 不要滥用**。GC 的时机不确定，依赖它们做业务逻辑会出 bug。它们只适合做缓存清理、诊断工具这类"尽力而为"的场景。

### 6.4.5 `Map` 的迭代与 `Object` 的转换

```js
const m = new Map([['a', 1], ['b', 2]]);

// 遍历
for (const [k, v] of m) console.log(k, v);
m.forEach((v, k) => console.log(k, v));   // 注意参数顺序是 (value, key)

// 转数组
[...m];                // [['a',1], ['b',2]]
[...m.keys()];         // ['a','b']
[...m.values()];       // [1,2]

// 转对象（ES2019）
Object.fromEntries(m); // {a:1, b:2}

// 从对象来
new Map(Object.entries({ a: 1 }));

// 链式：Map 的 set 返回自身
new Map().set('a', 1).set('b', 2);
```

### 6.4.6 答题模板

**30 秒版：**

> "`Map` 的键可以是任意类型、对键是**强引用**、可枚举、有 `size`；`WeakMap` 的键**只能是对象**、是**弱引用**、**不可枚举**、没有 `size` 和 `clear`。
> 弱引用的意义是：**它不阻止 GC**。键对象被回收后，这条记录自动消失。所以 `WeakMap` 适合做「跟对象生命周期绑定的附属数据」——私有属性、DOM 关联数据、缓存，不会造成泄漏。"

**2 分钟版补充：**

> "举个最好的例子：**Vue3 的响应式依赖就是用 `WeakMap` 存的**，结构是 `WeakMap<target, Map<key, Set<effect>>>`。因为组件销毁后响应式对象如果没人引用了，用 `WeakMap` 能让整棵依赖树一起被回收；用 `Map` 就会永久泄漏。
>
> 另外 `WeakMap` 没有 `size` 和 `clear` 不是设计缺陷，而是**逻辑必然**——它的内容随时可能被 GC 改变，所以"数量"和"全部清空"这两个操作根本无法保证。"

### 6.4.7 追问表

| 追问 | 答题要点 |
|---|---|
| `Map` 和 `WeakMap` 最大的区别？ | 键的类型 + 引用强度 |
| `WeakMap` 的键能是字符串吗？ | 不能，只能对象 |
| `WeakMap` 有 `size` 吗？ | 没有，因为内容随时被 GC 改变 |
| `WeakMap` 能遍历吗？ | 不能，不可枚举 |
| 弱引用是什么意思？ | 不阻止 GC 回收对象 |
| `WeakMap` 为什么不会泄漏？ | 不参与可达性判断 |
| 什么场景用 `WeakMap`？ | 私有数据、DOM 关联、缓存、依赖存储 |
| Vue3 哪里用了 `WeakMap`？ | `targetMap`，`target → depsMap` |
| `Map` 和 `Object` 区别？ | 键类型、顺序、`size`、原型污染 |
| `WeakSet` 有什么用？ | 标记对象，不阻止回收 |
| `WeakRef` 是什么？ | ES2021，弱引用，`deref()` 取值 |
| `WeakMap` 能一次清空吗？ | 不能，没有 `clear` |
| `Map` 的 `forEach` 参数顺序？ | `(value, key, map)`，和数组相反 |

---

## 6.5 for...in 与 for...of（题 22）

### 6.5.0 一句话结论

> **`for...in` 遍历的是"键"**，而且会**沿原型链**遍历所有**可枚举**属性（包括继承来的），所以它本来是给**对象**用的；**`for...of` 遍历的是"值"**，依赖**迭代协议**（`Symbol.iterator`），能给数组、`Map`、`Set`、字符串用，但**不能直接遍历普通对象**。

### 6.5.1 五个差异

| 维度 | `for...in` | `for...of` |
|---|---|---|
| **遍历什么** | **键**（字符串） | **值** |
| **依赖什么** | 属性的 `enumerable` 标记 | `Symbol.iterator` 方法 |
| **原型链** | ✅ **会遍历继承来的可枚举属性** | ❌ 只遍历迭代器产出的值 |
| **适用对象** | 普通对象（数组也能用，但拿到的是索引） | 可迭代对象（数组/`Map`/`Set`/字符串/`arguments`/`NodeList`） |
| **普通对象** | ✅ 能用 | ❌ `TypeError: not iterable` |
| **顺序** | 整数键升序 → 字符串插入顺序 | 由迭代器决定（数组是索引序） |

```js
const arr = ['a', 'b'];

for (const k in arr) console.log(k, typeof k);   // '0' string, '1' string  ← 键是字符串！
for (const v of arr) console.log(v);             // 'a', 'b'

const obj = { x: 1, y: 2 };
for (const k in obj) console.log(k);             // 'x', 'y'
// for (const v of obj) {}                       // ❌ TypeError: obj is not iterable
```

### 6.5.2 `for...in` 的三个坑（必须说清）

```js
// 坑 1：会遍历原型链上的可枚举属性
Object.prototype.polluted = 'bad';     // 模拟第三方库污染
const o = { a: 1 };
for (const k in o) console.log(k);     // 'a', 'polluted'  ← 污染也遍历出来了
delete Object.prototype.polluted;

// ✅ 解决：加 hasOwn 判断
for (const k in o) {
  if (Object.hasOwn(o, k)) console.log(k);   // 只有 'a'
}

// 坑 2：数组也能用，但拿到的是字符串索引
const arr2 = [10, 20];
for (const i in arr2) {
  console.log(i + 1);      // '01', '11'  ← 字符串拼接！
}
// 要做数学运算得 Number(i)

// 坑 3：顺序不完全可靠（虽然现代引擎已规范）
// 整数键按升序，字符串键按插入序，Symbol 键不遍历
const o2 = { 2: 'b', 1: 'a', z: 'z' };
for (const k in o2) console.log(k);   // '1', '2', 'z'
```

### 6.5.3 `for...of` 的底层：迭代协议

`for...of` 只做一件事：**调用对象的 `[Symbol.iterator]()` 拿到迭代器，然后反复调 `next()` 直到 `done: true`**。

```js
// 手动模拟 for...of
const arr = [1, 2];
const it = arr[Symbol.iterator]();
let r = it.next();
while (!r.done) {
  console.log(r.value);
  r = it.next();
}

// 等价于
for (const v of arr) console.log(v);
```

**自己实现一个可迭代对象**（这是常考题）：

```js
const range = {
  from: 1,
  to: 5,
  [Symbol.iterator]() {
    let current = this.from;
    const last = this.to;
    return {
      next() {
        return current <= last
          ? { value: current++, done: false }
          : { value: undefined, done: true };
      },
      // 可选：让迭代器本身也可迭代（支持 for...of 多次、展开等）
      [Symbol.iterator]() { return this; },
    };
  },
};

console.log([...range]);        // [1,2,3,4,5]
for (const n of range) console.log(n);

// 更好的写法：用 Generator（自动实现迭代协议）
const range2 = {
  from: 1,
  to: 5,
  *[Symbol.iterator]() {
    for (let i = this.from; i <= this.to; i++) yield i;
  },
};
```

**为什么普通对象不能 `for...of`？**

因为它没有 `Symbol.iterator`。加上就行：

```js
const obj = { a: 1, b: 2 };
obj[Symbol.iterator] = function* () {
  for (const k of Object.keys(this)) yield [k, this[k]];
};
for (const [k, v] of obj) console.log(k, v);   // 'a' 1, 'b' 2
```

> ⚠️ 但**不要真这么干**——给普通对象加迭代器会改变它的语义（比如 `[...obj]` 突然能用了），容易踩坑。要遍历对象用 `Object.entries(obj)`。

### 6.5.4 该用哪个：决策表

| 需求 | 用什么 |
|---|---|
| 遍历数组的值 | `for...of`（或 `forEach`/`map`） |
| 遍历对象的键值对 | `Object.entries(obj)` + `for...of` |
| 只遍历对象自身的键 | `Object.keys(obj)` + `for...of` |
| 需要 `break`/`continue`/`return` | `for...of`（`forEach` 不支持 `break`） |
| 遍历 `Map`/`Set` | `for...of`（天然支持） |
| 需要索引 | `for (let i = 0; ...)` 或 `entries()` |
| 遍历原型链（很少见） | `for...in` + `hasOwn` 过滤 |
| 异步串行遍历 | `for await...of` |

```js
// 一个能体现差异的场景：forEach 不能 break
[1, 2, 3].forEach((n) => {
  if (n === 2) return;    // ← 只是跳过本次，不是 break
  console.log(n);         // 1, 3
});

for (const n of [1, 2, 3]) {
  if (n === 2) break;     // ← 真的能跳出
  console.log(n);         // 1
}
```

### 6.5.5 `for await...of`（ES2018）

```js
// 遍历异步迭代器
async function* gen() {
  yield 1;
  await new Promise((r) => setTimeout(r, 100));
  yield 2;
}

for await (const v of gen()) {
  console.log(v);   // 1（等 100ms）2
}

// 实战：流式读取
for await (const chunk of readStream) {
  process(chunk);
}
```

### 6.5.6 答题模板

**30 秒版：**

> "`for...in` 遍历的是**键**，而且会沿**原型链**遍历所有可枚举属性，原本是给对象用的；`for...of` 遍历的是**值**，依赖**迭代协议**，也就是对象要有 `Symbol.iterator` 方法。
> 所以数组用 `for...in` 拿到的是字符串索引，用 `for...of` 拿到的是值；普通对象能用 `for...in`，但不能用 `for...of`，除非手动实现迭代器。"

**2 分钟版补充：**

> "`for...in` 有两个坑要提：一是**会遍历原型链上的可枚举属性**，所以第三方库污染 `Object.prototype` 时会把脏数据也遍历出来，要配合 `Object.hasOwn` 过滤；二是拿到的是**字符串**索引，直接做数学运算会变成字符串拼接。
> `for...of` 的底层就是反复调 `next()` 直到 `done: true`，所以任何实现了 `Symbol.iterator` 的对象都能用，包括 Generator 生成的对象。另外它支持 `break`/`continue`/`return`，而 `forEach` 不行。"

### 6.5.7 追问表

| 追问 | 答题要点 |
|---|---|
| 两者遍历什么？ | 键 vs 值 |
| `for...in` 会遍历原型链吗？ | 会（可枚举属性） |
| 怎么只遍历自身属性？ | `Object.hasOwn` 过滤 / `Object.keys` |
| 数组用 `for...in` 拿到什么？ | 字符串索引 |
| 普通对象能 `for...of` 吗？ | 不能，除非实现 `Symbol.iterator` |
| `for...of` 依赖什么？ | 迭代协议（`Symbol.iterator`） |
| 迭代器必须有什么方法？ | `next()`，返回 `{value, done}` |
| 怎么让对象可迭代？ | 实现 `[Symbol.iterator]`，或用 Generator |
| `forEach` 能 `break` 吗？ | 不能，用 `for...of` 或 `some`/`every` |
| `for await...of` 用什么场景？ | 异步迭代器、流式读取 |
| `Map` 能 `for...in` 吗？ | 不能（没有可枚举属性），要用 `for...of` |
| `for...in` 遍历 `Symbol` 键吗？ | 不遍历 |

---

## 6.6 ES6 新增的数组方法（题 7）

### 6.6.0 一句话结论

> ES6 给数组加的不只是几个方法，而是**一整套"可迭代"能力**：`Array.from`（从类数组/可迭代构造）、`Array.of`（修掉 `new Array(n)` 的歧义）、`find`/`findIndex`（按条件查找）、`fill`/`copyWithin`（原地填充）、`entries`/`keys`/`values`（迭代器）。后续版本还陆续加了 `includes`（ES2016）、`flat`/`flatMap`（ES2019）、`at`（ES2022）、`findLast`/`toSorted`（ES2023）。

### 6.6.1 完整方法表（按版本）

| 版本 | 方法 | 作用 | 备注 |
|---|---|---|---|
| **ES6** | `Array.from(like, mapFn?)` | 类数组 / 可迭代 → 数组 | 支持映射函数 |
| **ES6** | `Array.of(...items)` | 参数 → 数组 | 修掉 `new Array(3)` 的歧义 |
| **ES6** | `find(fn)` | 找第一个满足条件的**值** | 找不到返回 `undefined` |
| **ES6** | `findIndex(fn)` | 找第一个满足条件的**索引** | 找不到返回 `-1` |
| **ES6** | `fill(value, start?, end?)` | 原地填充 | **会修改原数组** |
| **ES6** | `copyWithin(target, start?, end?)` | 原地复制片段 | **会修改原数组** |
| **ES6** | `entries()` / `keys()` / `values()` | 返回迭代器 | 配合 `for...of` |
| **ES2016** | `includes(x)` | 是否包含 | 能找 `NaN` |
| **ES2019** | `flat(depth?)` | 拍平 | `depth` 默认 1，可 `Infinity` |
| **ES2019** | `flatMap(fn)` | `map` + `flat(1)` | 效率高于分开写 |
| **ES2022** | `at(i)` | 支持负索引 | `arr.at(-1)` |
| **ES2023** | `findLast` / `findLastIndex` | 从后往前找 | |
| **ES2023** | `toSorted` / `toReversed` / `toSpliced` / `with` | **不改原数组**的版本 | 函数式编程友好 |

### 6.6.2 `Array.from` 与 `Array.of`

```js
// Array.from：三种用法
Array.from('abc');                      // ['a','b','c']（字符串可迭代）
Array.from(new Set([1,2]));             // [1,2]
Array.from({ length: 3 }, (_, i) => i); // [0,1,2]  ← 生成序列的常用写法
Array.from({ 0: 'a', 1: 'b', length: 2 });  // ['a','b']  （类数组）
Array.from(new Map([[1,'a']]));         // [[1,'a']]

// Array.of：解决 new Array 的歧义
new Array(3);        // [ <3 empty items> ]  ← 长度 3 的空数组！
new Array(3, 4);     // [3, 4]
Array.of(3);         // [3]  ← 只有一个元素 3
Array.of(3, 4);      // [3, 4]
```

> **`Array.of` 的存在意义**：`new Array(3)` 到底是"长度 3"还是"元素 3"？规范选了前者，这导致"想用单个数字创建数组"变得别扭。`Array.of` 就是补这个坑。

### 6.6.3 `find` / `findIndex` vs `filter` / `indexOf`

```js
const users = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];

// find 找到就停（短路），filter 会遍历全部
users.find((u) => u.id === 2);          // { id: 2, name: 'B' }
users.filter((u) => u.id === 2);        // [{ id: 2 }]  ← 返回数组
users.findIndex((u) => u.id === 2);     // 1
users.find((u) => u.id === 99);         // undefined

// indexOf 只能找原始值，对象要找引用
users.indexOf({ id: 2 });               // -1  ← 不同引用
```

| 需求 | 用 |
|---|---|
| 找一个**对象** | `find` |
| 找**全部**符合条件的 | `filter` |
| 找**索引** | `findIndex` |
| 判断**是否存在** | `some`（有就短路）/ `includes`（原始值） |
| 找 `NaN` | `findIndex(Number.isNaN)` 或 `includes(NaN)` |

### 6.6.4 `flat` / `flatMap`

```js
// flat：拍平，注意 depth
[1, [2, [3, [4]]]].flat();          // [1, 2, [3, [4]]]     默认 depth = 1
[1, [2, [3, [4]]]].flat(2);         // [1, 2, 3, [4]]
[1, [2, [3, [4]]]].flat(Infinity);  // [1, 2, 3, 4]

// flat 会移除空位（hole）
[1, , 3].flat();                    // [1, 3]

// flatMap = map + flat(1)
[1, 2, 3].flatMap((n) => [n, n * 2]);   // [1,2, 2,4, 3,6]
// 等价于但更高效：
[1, 2, 3].map((n) => [n, n * 2]).flat();

// 实战：把嵌套的标签数组拍平并去重
const tags = [['a', 'b'], ['b', 'c']].flat();   // ['a','b','b','c']
const unique = [...new Set(tags)];               // ['a','b','c']

// 实战：一对多映射
const orders = [{ items: ['x', 'y'] }, { items: ['z'] }];
orders.flatMap((o) => o.items);   // ['x','y','z']
```

> **注意**：`flatMap` 只能拍平**一层**，而且它比 `map().flat()` 高效（只遍历一次，不创建中间数组）。

### 6.6.5 `includes` vs `indexOf`（必考）

```js
const arr = [1, 2, NaN];

console.log(arr.indexOf(NaN));      // -1   ← 找不到
console.log(arr.includes(NaN));     // true ← 能找到

console.log(arr.indexOf(null));     // -1
console.log(arr.includes(undefined));  // false
// 注意：includes 会把"空位"当作 undefined
console.log([,].includes(undefined));  // true  ← 而 indexOf 返回 -1
```

**为什么不同？**

- `indexOf` 用 **`===`** 比较 → `NaN !== NaN`
- `includes` 用 **SameValueZero** → `NaN` 相等

### 6.6.6 三个不可变方法（ES2023，值得知道）

```js
const arr = [3, 1, 2];

// 旧写法会改原数组
// arr.sort();           → 原数组被改

// 新写法：返回新数组，原数组不变
const sorted = arr.toSorted();          // [1,2,3]，arr 仍是 [3,1,2]
const reversed = arr.toReversed();      // [2,1,3]
const spliced = arr.toSpliced(0, 1);    // [1,2]
const replaced = arr.with(0, 99);       // [99,1,2]  ← 替代 arr[0] = 99

// 配合 React/Vue 的不可变更新很好用
setState((prev) => prev.with(index, newValue));
```

### 6.6.7 答题模板

**30 秒版：**

> "ES6 的数组方法主要分四类：**构造类**有 `Array.from`（类数组/可迭代转数组，还能带映射函数）和 `Array.of`（修掉 `new Array(3)` 的歧义）；**查找类**有 `find`/`findIndex`，找到就短路；**原地操作**有 `fill` 和 `copyWithin`；**迭代器**有 `entries`/`keys`/`values`。
> 后续版本还加了 `includes`（ES2016，能找 `NaN`）、`flat`/`flatMap`（ES2019）、`at`（ES2022，支持负索引）、以及 `toSorted`/`with` 这些不改原数组的方法（ES2023）。"

**2 分钟版补充：**

> "两个对比点：
> 一是 **`includes` 和 `indexOf`**。`indexOf` 用 `===`，所以找不到 `NaN`；`includes` 用 SameValueZero，能找到。而且 `includes` 对空位按 `undefined` 处理，`indexOf` 会跳过空位。
> 二是 **`flat` 的 depth**。默认只拍一层，深嵌套要显式传 `Infinity`，而且它会移除空位。`flatMap` 是 `map` + `flat(1)` 的合体，只遍历一次，比分开写高效。"

### 6.6.8 追问表

| 追问 | 答题要点 |
|---|---|
| `Array.from` 和 `...` 区别？ | 前者支持类数组 + 映射函数 |
| `Array.of(3)` 和 `new Array(3)`？ | `[3]` vs 长度 3 的空数组 |
| `find` 和 `filter` 区别？ | 找到就停 vs 遍历全部 |
| `find` 找不到返回？ | `undefined`（`findIndex` 是 `-1`） |
| `includes` 和 `indexOf` 区别？ | `NaN` 处理不同（SameValueZero vs `===`） |
| `flat` 默认深度？ | 1 |
| `flat` 会移除空位吗？ | 会 |
| `flatMap` 能拍几层？ | 只能一层 |
| `flatMap` 比 `map().flat()` 好在哪？ | 只遍历一次，不产生中间数组 |
| `at(-1)` 干什么？ | 取最后一个元素 |
| `toSorted` 和 `sort` 区别？ | 前者返回新数组，不改原数组 |
| `copyWithin` 会改原数组吗？ | 会 |
| `fill` 会改原数组吗？ | 会 |
| `entries()` 返回什么？ | 迭代器，产出 `[index, value]` |

---

## 6.7 本册答题模板汇总

### 6.7.1 一句话版

```
⑰ Set          → 成员唯一，SameValueZero，O(1) 查找，去重/集合运算
⑯ Set ↔ 数组    → new Set(arr) / [...set] / Array.from(set, mapFn)
⑱ Map/WeakMap  → 键类型 + 强/弱引用 + 可枚举 + size
㉒ for-in/of    → 键（含原型链） vs 值（迭代协议）
⑦ 数组方法      → from/of、find/findIndex、fill/copyWithin、entries/keys/values
                 + includes(2016)、flat/flatMap(2019)、at(2022)、toSorted(2023)
```

### 6.7.2 把五题串起来

> "这五题其实围绕两个字：**「唯一」和「可迭代」**。
> `Set`/`Map` 解决"怎么高效地判断唯一、怎么用对象当键"；`WeakMap` 解决"怎么让数据跟着对象一起死"；`for...of` 和 `Array.from` 都是**迭代协议**的应用；而数组方法里最容易被追问的 `includes`，也是同一个 `SameValueZero` 判等规则。
>
> 一句话：**记住 SameValueZero 和迭代协议这两条，这一册的题就串成一条线了。**

---

## 6.8 速记卡与连环追问

### 6.8.1 速记卡

```
【判等三算法】
  ===               NaN≠NaN   +0===-0
  Object.is         NaN===NaN +0!==-0
  SameValueZero     NaN===NaN +0===-0   ← Set/Map/includes 用这个

【Set】
  add/has/delete/clear，size 是【属性】
  保持插入顺序，不能按索引访问
  去重：[...new Set(arr)]  O(n)
  集合运算：ES2025 原生 union/intersection/difference

【Object vs Map】
  键类型   string/symbol  vs  任意
  顺序     整数升序在前   vs  纯插入
  size     Object.keys().length  vs  map.size
  原型污染 有  vs  无

【Map vs WeakMap】
  键     任意   vs  只能是对象
  引用   强     vs  弱（不阻止 GC）
  枚举   ✅     vs  ❌
  size   ✅     vs  ❌
  clear  ✅     vs  ❌
  用途   —      vs  私有数据 / DOM 关联 / 缓存 / Vue3 targetMap

【for...in vs for...of】
  in：键（字符串）、含原型链可枚举、对象可用、数组拿到索引字符串
  of：值、依赖 Symbol.iterator、普通对象不行、支持 break/continue
  自身属性：for...in + Object.hasOwn
  对象键值：Object.entries + for...of

【数组方法】
  from（类数组+可迭代+mapFn）/ of（修掉 new Array(3) 歧义）
  find/findIndex（短路）/ filter（全遍历）
  fill/copyWithin（改原数组）
  includes（SameValueZero）/ indexOf（===，找不到 NaN）
  flat(depth=1, 去空位) / flatMap（= map+flat(1)，只遍历一次）
  at(-1) / toSorted / toReversed / with（不改原数组）
```

### 6.8.2 连环追问

| # | 追问 | 关键答点 |
|---|---|---|
| 1 | `Set` 判重用什么算法？ | SameValueZero |
| 2 | `NaN` 在 `Set` 里会重复吗？ | 不会 |
| 3 | `{a:1}` 两次会去重吗？ | 不会，按引用 |
| 4 | `size` 是属性还是方法？ | 属性 |
| 5 | `Set` 怎么转数组？ | `[...set]` / `Array.from(set)` |
| 6 | `Array.from` 和 `...` 区别？ | 前者支持类数组 + mapFn |
| 7 | 去重最优写法？ | `[...new Set(arr)]` |
| 8 | `filter + indexOf` 什么问题？ | O(n²) + `NaN` 误删 |
| 9 | 对象数组怎么去重？ | `new Map(arr.map(o => [o.id, o]))` |
| 10 | `Map` 和 `Object` 区别？ | 键类型、顺序、`size`、原型污染 |
| 11 | `Map` 的 `forEach` 参数顺序？ | `(value, key)`，和数组相反 |
| 12 | `Map` 和 `WeakMap` 区别？ | 键类型 + 引用强度 |
| 13 | `WeakMap` 为什么没有 `size`？ | 内容随时被 GC 改变 |
| 14 | 弱引用是什么意思？ | 不阻止 GC |
| 15 | `WeakMap` 用在哪？ | 私有数据、DOM 关联、缓存、Vue3 依赖 |
| 16 | Vue3 为什么用 `WeakMap`？ | 对象回收时依赖树一起释放 |
| 17 | `WeakSet` 有什么用？ | 标记对象，不影响回收 |
| 18 | `WeakRef` 是什么？ | ES2021，`deref()` 取弱引用 |
| 19 | `for...in` 遍历什么？ | 键，含原型链可枚举 |
| 20 | 怎么只遍历自身属性？ | `Object.hasOwn` 过滤 |
| 21 | 数组用 `for...in` 拿到什么？ | 字符串索引 |
| 22 | 普通对象能 `for...of` 吗？ | 不能，除非实现迭代器 |
| 23 | `for...of` 底层？ | 反复调 `next()` 直到 `done` |
| 24 | 怎么让对象可迭代？ | 实现 `[Symbol.iterator]` |
| 25 | `forEach` 能 `break` 吗？ | 不能 |
| 26 | `for await...of` 用在哪？ | 异步迭代器、流 |
| 27 | `Array.of(3)` 是什么？ | `[3]`，不是长度 3 |
| 28 | `find` 和 `filter` 区别？ | 找到就停 vs 全部遍历 |
| 29 | `includes` 和 `indexOf` 区别？ | `NaN` 处理不同 |
| 30 | `flat` 默认深度？ | 1，深嵌套用 `Infinity` |
| 31 | `flatMap` 能拍几层？ | 一层 |
| 32 | `toSorted` 和 `sort` 区别？ | 前者不改原数组 |
