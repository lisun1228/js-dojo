# 分册 06 · 集合、迭代与数组扩展

> 覆盖题号：**17**（Set 数据结构）、**18**（`WeakMap` 与 `Map`）、**16**（Set 与数组互转）、**22**（`for...in` 与 `for...of`）、**7**（ES6 新增的数组方法）

---

## 目录

- [6.1 Set 数据结构](#61-set-数据结构)
- [6.2 Set 与数组互转](#62-set-与数组互转)
- [6.3 Map 与 Object 的选型](#63-map-与-object-的选型)
- [6.4 Map 与 WeakMap](#64-map-与-weakmap)
- [6.5 for...in 与 for...of](#65-forin-与-forof)
- [6.6 ES6 新增的数组方法](#66-es6-新增的数组方法)
- [6.7 本册答题模板汇总](#67-本册答题模板汇总)
- [6.8 速记卡与连环追问](#68-速记卡与连环追问)

---

## 6.1 Set 数据结构

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

// 遍历：插入顺序
for (const v of s) console.log(v);       // 1, 3, 4
s.forEach((v, k) => console.log(v, k));  // Set 的 forEach 里 key === value

s.clear();               // 清空
```

> `Set.size`、`Map.size`、`Array.length` 都是属性；`Object` 没有 `size`，用 `Object.keys(obj).length`。

### 6.1.2 判等规则：SameValueZero

```js
// ① NaN 会被去重；undefined / null 也各算一个
console.log(new Set([NaN, NaN]).size);                          // 1
console.log([...new Set([NaN, NaN, undefined, null, null])]);   // [NaN, undefined, null]

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

**三种相等算法的对比**：

| 算法 | 用在 | `NaN` vs `NaN` | `+0` vs `-0` |
|---|---|---|---|
| `===`（严格相等） | 普通比较 | ❌ `false` | ✅ `true` |
| `Object.is`（同值相等） | `Object.is()` | ✅ `true` | ❌ `false` |
| **SameValueZero** | `Set`/`Map` 键/`includes` | ✅ `true` | ✅ `true` |

> SameValueZero = `Object.is` 但把 `+0` 与 `-0` 当成相等。

### 6.1.3 去重的三个坑

```js
// 坑 1：对象按引用判等，内容相同也保留两条
const arr1 = [{ id: 1 }, { id: 1 }];
console.log([...new Set(arr1)].length);   // 2

// 按字段去重：借 Map 的键唯一性，后出现的覆盖先出现的
const uniqueById = [...new Map(arr1.map((o) => [o.id, o])).values()];
console.log(uniqueById);                  // [{ id: 1 }]

// 坑 2：类型不同不相等
console.log(new Set([1, '1']).size);      // 2

// 坑 3：去重保留首次出现的位置
console.log([...new Set([2, 1, 2, 3])]);  // [2, 1, 3]
```

### 6.1.4 集合运算（手写与原生）

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

> 原生方法接受 set-like 对象（含 `size`、`has`、`keys`），直接传数组会抛 `TypeError`；老运行时仍需手写。

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
// ① 数组去重
const unique = [...new Set(list)];

// ② 频繁 has 判断（用数组是 O(n)，用 Set 是 O(1)）
// ❌ 权限判断写在循环里，数组每次都要 O(n)
const permissions = ['read', 'write', 'delete'];
permissions.includes('write');   // O(n)

// ✅ 换成 Set
const permissionSet = new Set(permissions);
permissionSet.has('write');      // O(1)
// 需要按索引访问、排序或 JSON 序列化时用数组；Set 每次转数组都是 O(n)

// ③ 记录已处理过的 id（去重 + 判断）
const seen = new Set();
for (const item of list) {
  if (seen.has(item.id)) continue;
  seen.add(item.id);
  process(item);
}
```

### 6.1.6 答题模板

- **唯一性**：成员唯一，`add`/`has`/`delete` 平均 O(1)，保持插入顺序，不能按索引访问。
- **判等**：SameValueZero —— `NaN` 视为相等，`+0` 与 `-0` 相等，对象按引用。
- **常用**：`[...new Set(arr)]` 去重、频繁 `has` 判断、并/交/差集。
- **代价**：转数组是 O(n)；需要索引、排序或序列化时用数组。

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
| 怎么对对象数组去重？ | `[...new Map(arr.map((o) => [o.id, o])).values()]` |
| `Set` 有 `map`/`filter` 吗？ | 没有，要先转数组 |
| 集合运算原生支持吗？ | ES2025 有 `union`/`intersection` 等方法 |
| `WeakSet` 和 `Set` 区别？ | 成员只能是对象或非注册 `Symbol`、弱引用、不可迭代 |

---

## 6.2 Set 与数组互转

### 6.2.0 一句话结论

> **数组 → Set**：`new Set(arr)`；**Set → 数组**：`[...set]` 或 `Array.from(set)`。`new Set(arr)` 天然去重；`Array.from(set, mapFn)` 可在转换时映射。

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
const arr = [1, 2, 2, 3];

// ① 标准写法：O(n)，NaN 也能去重
const unique1 = [...new Set(arr)];

// ② 等价写法：Array.from
const unique2 = Array.from(new Set(arr));

// ③ filter + indexOf：O(n²)，且 indexOf 找不到 NaN，会把 NaN 丢掉
const unique3 = arr.filter((item, index) => arr.indexOf(item) === index);

// ④ filter + findIndex + Object.is：能处理 NaN，仍是 O(n²)
const unique4 = arr.filter(
  (item, index, self) => self.findIndex((x) => Object.is(x, item)) === index,
);
```

| 方式 | 复杂度 | 说明 |
|---|---|---|
| `[...new Set(arr)]` | O(n) | 标准写法 |
| `Array.from(new Set(arr))` | O(n) | 与上面等价 |
| `filter + indexOf` | O(n²) | 丢 `NaN` |
| `reduce + includes` | O(n²) | 每次 `includes` 都是 O(n) |

### 6.2.3 `Array.from` 与扩展运算符的差异

```js
// ① Array.from 能处理类数组（有 length 和索引，但不可迭代）
const like = { 0: 'a', 1: 'b', length: 2 };
console.log(Array.from(like));    // ['a', 'b']
console.log([...like]);           // ❌ TypeError: like is not iterable

// ② 扩展运算符只认可迭代对象（有 Symbol.iterator）
console.log([...'abc']);          // ['a','b','c']
console.log([...new Set([1,2])]); // [1,2]

// ③ Array.from 有第二个参数（映射函数），只遍历一次
Array.from([1,2,3], (x) => x * 2);      // [2,4,6]
[...[1,2,3]].map((x) => x * 2);          // 效果一样，但多一次遍历

// ④ Array.from 也能从 Map 的 entries 构造
Array.from(new Map([['a', 1]]));         // [['a', 1]]
```

> `Array.from` 支持**类数组和可迭代对象**两种；`...` 只支持**可迭代对象**。

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

- **方向**：`new Set(arr)` / `[...set]` / `Array.from(set)`。
- **额外能力**：`Array.from` 认类数组且可带 mapFn，`...` 只认可迭代对象。
- **去重**：`[...new Set(arr)]` 是 O(n) 写法；`filter + indexOf` 是 O(n²) 且会丢 `NaN`。
- **按字段去重**：`[...new Map(arr.map((o) => [o.id, o])).values()]`。

### 6.2.6 追问表

| 追问 | 答题要点 |
|---|---|
| 数组转 Set？ | `new Set(arr)` |
| Set 转数组？ | `[...set]` / `Array.from(set)` |
| `Array.from` 和 `...` 区别？ | 前者支持类数组 + 可迭代 + 映射函数 |
| 类数组能直接 `...` 吗？ | 不能，除非它实现了 `Symbol.iterator` |
| 去重常用写法？ | `[...new Set(arr)]`，O(n) |
| `filter + indexOf` 有什么问题？ | O(n²) + `NaN` 会被误删 |
| Map 转对象？ | `Object.fromEntries(map)` |
| 对象转 Map？ | `new Map(Object.entries(obj))` |
| Set 转数组会保持顺序吗？ | 会，按插入顺序 |

---

## 6.3 Map 与 Object 的选型

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
console.log(o3['toString']);    // [Function: toString] ← 不是 undefined！
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

> 请求去重：缓存 Promise 而不是结果，同时发起的相同请求复用同一个 Promise，只会真正发出一次。

---

## 6.4 Map 与 WeakMap

### 6.4.0 一句话结论

> `Map` 的键可以是**任意类型**、对键是**强引用**、可迭代、有 `size`；`WeakMap` 的键**只能是对象或非注册 `Symbol`**、对键是**弱引用**（键被 GC 回收时条目自动消失）、**不可迭代**、**没有 `size`**。所以 `WeakMap` 适合存放「**跟对象生命周期绑定的附属数据**」——私有数据、DOM 关联数据、缓存，不会因为键而阻止回收。

### 6.4.1 五个差异

| 维度 | `Map` | `WeakMap` |
|---|---|---|
| **键的类型** | 任意类型 | **对象或非注册 `Symbol`**（`null`、字符串、数字都抛） |
| **引用强度** | **强引用**（阻止 GC） | **弱引用**（不阻止 GC） |
| **`size`** | ✅ | ❌ 没有（因为随时可能变） |
| **`clear`** | ✅ | ❌ 没有（规范不提供） |
| **迭代** | ✅ `keys()`/`values()`/`entries()`/`forEach` | ❌ 没有任何迭代方法 |

```js
const wm = new WeakMap();
wm.set('str', 1);            // ❌ TypeError: Invalid value used as weak map key
wm.set(null, 1);             // ❌ TypeError
wm.set(Symbol.for('s'), 1);  // ❌ TypeError：注册 Symbol 不能被弱引用
wm.set(Symbol('s'), 1);      // ✅ 未注册 Symbol
wm.set({}, 1);               // ✅

console.log(wm.size);        // undefined（没有这个属性）
```

### 6.4.2 弱引用的含义

```js
let obj = { id: 1 };
const map = new Map();
map.set(obj, 'data in Map');

let obj2 = { id: 2 };
const weakMap = new WeakMap();
weakMap.set(obj2, 'data in WeakMap');

obj = null;    // Map 仍强引用 { id: 1 }，不会被 GC
obj2 = null;   // WeakMap 不阻止回收，{ id: 2 } 下一次 GC 时可能被回收

// Map：条目还在，键对象一直可达
// WeakMap：键对象被回收后，条目随之消失
```

引用关系：

```
      map ──强引用──→ { id: 1 }        ← 即使外部没人引用，也不回收
weakMap ┈┈弱引用┈┈→ { id: 2 }        ← 外部没人引用后可回收（时机不确定）

回收后：
      map  ──→ { id: 1 }（键对象无法回收）
weakMap  ──→ （条目自动消失）
```

`WeakMap` 不参与可达性判断：GC 只把强引用算作可达，弱引用不算。

### 6.4.3 四个用途

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

// ② 给 DOM 节点挂关联数据（节点被回收后条目消失）
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

// ③ 缓存（键对象被回收后自动清）
const cache = new WeakMap();

function process(obj) {
  if (cache.has(obj)) return cache.get(obj);
  const result = heavyCompute(obj);
  cache.set(obj, result);
  return result;
}

// ④ Vue3 的依赖存储
// 3.5 源码：WeakMap<target, Map<key, Dep>>，Dep 内部用链表存订阅者
const targetMap = new WeakMap();   // target → depsMap
// target 不再被引用后整棵依赖表可被回收；换成 Map 会永久持有 target
```

### 6.4.4 `WeakSet` 与 `WeakRef`

```js
// WeakSet：成员只能是对象或非注册 Symbol，弱引用，不可迭代
const ws = new WeakSet();
const el = { id: 'x' };
ws.add(el);
ws.has(el);              // true
// 用途：标记"已处理过的对象"，不阻止回收

// WeakRef（ES2021）：创建一个对对象的弱引用
let target = { big: 'data' };
const ref = new WeakRef(target);
target = null;
ref.deref();             // GC 前返回对象；回收后返回 undefined

// FinalizationRegistry（ES2021）：对象被回收时收到通知
const registry = new FinalizationRegistry((heldValue) => {
  console.log(`${heldValue} 被回收了`);
});
registry.register({ big: 'data' }, 'some-id');
```

> `WeakRef` 和 `FinalizationRegistry` 的 GC 时机不确定，依赖它们做业务逻辑会出 bug；只适合缓存清理、诊断这类不要求确定性的场景。

### 6.4.5 Map 的遍历

```js
const m = new Map([['a', 1], ['b', 2]]);

for (const [k, v] of m) console.log(k, v);
m.forEach((v, k) => console.log(k, v));   // 参数顺序是 (value, key)
console.log(Object.keys(m));              // []：条目不是可枚举属性

new Map().set('a', 1).set('b', 2);        // set 返回自身，可链式
```

### 6.4.6 答题模板

- **键**：`Map` 任意类型；`WeakMap` 只能对象或非注册 `Symbol`。
- **引用**：`Map` 强引用，键不会被 GC；`WeakMap` 弱引用，键被回收后条目消失。
- **能力**：`WeakMap` 不可迭代、无 `size`、无 `clear`——内容随时可能被 GC 改变，数量与清空无法保证。
- **用途**：私有数据、DOM 关联数据、对象缓存、Vue3 `targetMap`。

### 6.4.7 追问表

| 追问 | 答题要点 |
|---|---|
| `Map` 和 `WeakMap` 最大的区别？ | 键的类型 + 引用强度 |
| `WeakMap` 的键有什么限制？ | 只能是对象或非注册 `Symbol`；字符串、`null`、`Symbol.for()` 都抛 |
| `WeakMap` 有 `size` 吗？ | 没有，因为内容随时被 GC 改变 |
| `WeakMap` 能遍历吗？ | 不能，没有任何迭代方法 |
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

## 6.5 for...in 与 for...of

### 6.5.0 一句话结论

> **`for...in` 遍历键**（字符串），会**沿原型链**遍历所有**可枚举**属性（包括继承来的），适用于普通对象；**`for...of` 遍历值**，依赖**迭代协议**（`Symbol.iterator`），适用于数组、`Map`、`Set`、字符串，**不能直接遍历普通对象**。

### 6.5.1 五个差异

| 维度 | `for...in` | `for...of` |
|---|---|---|
| **遍历什么** | **键**（字符串） | **值** |
| **依赖什么** | 属性的 `enumerable` 标记 | `Symbol.iterator` 方法 |
| **原型链** | ✅ **会遍历继承来的可枚举属性** | ❌ 只遍历迭代器产出的值 |
| **适用对象** | 普通对象（数组也能用，但拿到的是索引） | 可迭代对象（数组/`Map`/`Set`/字符串/`arguments`） |
| **顺序** | 整数键升序 → 字符串插入顺序 | 由迭代器决定（数组是索引序） |

```js
const arr = ['a', 'b'];

for (const k in arr) console.log(k, typeof k);   // '0' string, '1' string  ← 键是字符串！
for (const v of arr) console.log(v);             // 'a', 'b'

const obj = { x: 1, y: 2 };
for (const k in obj) console.log(k);             // 'x', 'y'
// for (const v of obj) {}                       // ❌ TypeError: obj is not iterable
```

### 6.5.2 `for...in` 的三个坑

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

// 坑 3：顺序不是纯插入序——整数键升序，字符串键插入序，Symbol 键不遍历
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

提前退出（`break`、`return`、抛出异常）会调用迭代器的 `return()`（若存在），用于释放资源。

**自己实现一个可迭代对象**：

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

// 用 Generator 自动实现迭代协议
const range2 = {
  from: 1,
  to: 5,
  *[Symbol.iterator]() {
    for (let i = this.from; i <= this.to; i++) yield i;
  },
};
```

Generator 对象本身是迭代器：`next(v)` 推进并传值，`return(v)` 提前结束并触发 `finally`，`throw(e)` 在暂停点抛出。

**为什么普通对象不能 `for...of`？**

因为它没有 `Symbol.iterator`；补上即可：

```js
const obj = { a: 1, b: 2 };
obj[Symbol.iterator] = function* () {
  for (const k of Object.keys(this)) yield [k, this[k]];
};
for (const [k, v] of obj) console.log(k, v);   // 'a' 1, 'b' 2
```

> 给普通对象加迭代器会改变 `[...obj]` 等语义；遍历对象优先用 `Object.entries(obj)`。

### 6.5.4 选型决策表

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
// forEach 不能 break
[1, 2, 3].forEach((n) => {
  if (n === 2) return;    // ← 只是跳过本次，不是 break
  console.log(n);         // 1, 3
});

for (const n of [1, 2, 3]) {
  if (n === 2) break;     // ← 跳出循环
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

// 流式读取：readStream 为任意异步可迭代对象
```

### 6.5.6 答题模板

- **`for...in`**：遍历键（字符串），含原型链上的可枚举属性；普通对象可用，数组拿到索引字符串。
- **`for...of`**：遍历值，依赖 `Symbol.iterator` 的 `next()`，支持 `break`/`continue`/`return`。
- **普通对象**：没有 `Symbol.iterator`，不能 `for...of`；用 `Object.entries` + `for...of`。
- **自身属性**：`for...in` 配 `Object.hasOwn` 过滤原型链。
- **异步**：`for await...of` 遍历异步迭代器。

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

## 6.6 ES6 新增的数组方法

### 6.6.0 一句话结论

> ES6 新增的数组能力：`Array.from`（从类数组/可迭代构造）、`Array.of`（修掉 `new Array(n)` 的歧义）、`find`/`findIndex`、`fill`/`copyWithin`、`entries`/`keys`/`values`。后续版本加入 `includes`（ES2016）、`flat`/`flatMap`（ES2019）、`at`（ES2022）、`findLast`/`toSorted`（ES2023）。

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
| **ES2019** | `flatMap(fn)` | `map` + `flat(1)` | 只遍历一次，不产生中间数组 |
| **ES2022** | `at(i)` | 支持负索引 | `arr.at(-1)` |
| **ES2023** | `findLast` / `findLastIndex` | 从后往前找 | |
| **ES2023** | `toSorted` / `toReversed` / `toSpliced` / `with` | **不改原数组**的版本 | 返回新数组 |

### 6.6.2 `Array.from` 与 `Array.of`

```js
// Array.from：三种用法
Array.from('abc');                      // ['a','b','c']（字符串可迭代）
Array.from(new Set([1,2]));             // [1,2]
Array.from({ length: 3 }, (_, i) => i); // [0,1,2]  ← 生成序列的常用写法
Array.from({ 0: 'a', 1: 'b', length: 2 });  // ['a','b']  （类数组）
Array.from(new Map([[1,'a']]));         // [[1,'a']]

// Array.of：解决 new Array 的歧义
new Array(3);        // [ <3 empty items> ]  ← 长度 3 的稀疏数组
new Array(3, 4);     // [3, 4]
Array.of(3);         // [3]  ← 只有一个元素 3
Array.of(3, 4);      // [3, 4]
```

> `new Array(3)` 表示长度 3，而不是元素 3；`Array.of(3)` 明确表示单元素 `[3]`。

### 6.6.3 `find` / `findIndex` vs `filter` / `indexOf`

```js
const users = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];

// find 找到就停（短路），filter 会遍历全部
users.find((u) => u.id === 2);          // { id: 2, name: 'B' }
users.filter((u) => u.id === 2);        // [{ id: 2, name: 'B' }]  ← 返回数组
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
// 等价写法：
[1, 2, 3].map((n) => [n, n * 2]).flat();

// 实战：把嵌套的标签数组拍平并去重
const tags = [['a', 'b'], ['b', 'c']].flat();   // ['a','b','b','c']
const unique = [...new Set(tags)];               // ['a','b','c']

// 实战：一对多映射
const orders = [{ items: ['x', 'y'] }, { items: ['z'] }];
orders.flatMap((o) => o.items);   // ['x','y','z']
```

> `flatMap` 只能拍平**一层**；它只遍历一次，不创建中间数组。

### 6.6.5 `includes` vs `indexOf`

```js
const arr = [1, 2, NaN];

console.log(arr.indexOf(NaN));         // -1：indexOf 用 ===
console.log(arr.includes(NaN));        // true：includes 用 SameValueZero（见 6.1.2）

console.log(arr.indexOf(null));        // -1
console.log(arr.includes(undefined));  // false

// 空位：includes 当作 undefined，indexOf 跳过
console.log([,].includes(undefined));  // true
console.log([,].indexOf(undefined));   // -1
```

### 6.6.6 四个不可变方法（ES2023）

```js
const arr = [3, 1, 2];

// 旧写法会改原数组
// arr.sort();           → 原数组被改

// 新写法：返回新数组，原数组不变
const sorted = arr.toSorted();          // [1,2,3]，arr 仍是 [3,1,2]
const reversed = arr.toReversed();      // [2,1,3]
const spliced = arr.toSpliced(0, 1);    // [1,2]
const replaced = arr.with(0, 99);       // [99,1,2]  ← 替代 arr[0] = 99
```

### 6.6.7 答题模板

- **构造**：`Array.from`（类数组/可迭代 + mapFn）、`Array.of`（修 `new Array(3)` 歧义）。
- **查找**：`find`/`findIndex` 短路；`filter` 全遍历；`includes` 能找 `NaN`。
- **原地**：`fill`、`copyWithin` 修改原数组。
- **迭代器**：`entries`/`keys`/`values`。
- **拍平**：`flat(depth=1)` 移除空位；`flatMap` = `map` + `flat(1)`，只遍历一次。
- **不可变**：`at`、`toSorted`/`toReversed`/`toSpliced`/`with`。

### 6.6.8 追问表

| 追问 | 答题要点 |
|---|---|
| `Array.of(3)` 和 `new Array(3)`？ | `[3]` vs 长度 3 的稀疏数组 |
| `find` 和 `filter` 区别？ | 找到就停 vs 遍历全部 |
| `find` 找不到返回？ | `undefined`（`findIndex` 是 `-1`） |
| `includes` 和 `indexOf` 区别？ | `NaN` 处理不同（SameValueZero vs `===`） |
| `flat` 默认深度？ | 1 |
| `flat` 会移除空位吗？ | 会 |
| `flatMap` 能拍几层？ | 只能一层 |
| `flatMap` 和 `map().flat()` 区别？ | 只遍历一次，不产生中间数组 |
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
⑱ Map/WeakMap  → 键类型 + 强/弱引用 + 可迭代 + size
㉒ for-in/of    → 键（含原型链） vs 值（迭代协议）
⑦ 数组方法      → from/of、find/findIndex、fill/copyWithin、entries/keys/values
                 + includes(2016)、flat/flatMap(2019)、at(2022)、toSorted/with(2023)
```

### 6.7.2 把五题串起来

- 两条主线：**SameValueZero 判等**（`Set`/`Map` 键、`Array.includes`）与**迭代协议**（`for...of`、`Array.from` 的可迭代分支、`entries`/`keys`/`values`）。
- `Set`/`Map` 解决唯一性与对象键；`WeakMap` 用弱引用让附属数据随对象生命周期回收。
- 选型看三件事：要不要对象键、要不要按索引访问、数据要不要跟对象一起释放。

---

## 6.8 速记卡与连环追问

### 6.8.1 速记卡

```
【判等三算法】
  ===               NaN≠NaN   +0===-0
  Object.is         NaN===NaN +0!==-0
  SameValueZero     NaN===NaN +0===-0   ← Set/Map 键/includes 用这个

【Set】
  add/has/delete/clear，size 是【属性】
  保持插入顺序，不能按索引访问
  去重：[...new Set(arr)]  O(n)
  集合运算：ES2025 原生 union/intersection/difference/symmetricDifference

【Object vs Map】
  键类型   string/symbol  vs  任意
  顺序     整数升序在前   vs  纯插入
  size     Object.keys().length  vs  map.size
  原型污染 有  vs  无

【Map vs WeakMap】
  键     任意   vs  只能是对象或非注册 Symbol
  引用   强     vs  弱（不阻止 GC）
  迭代   ✅     vs  ❌
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
  at(-1) / toSorted / toReversed / toSpliced / with（不改原数组）
```

### 6.8.2 连环追问

| # | 链条 | 关键答点 |
|---|---|---|
| 1 | `Set` 判重 → 用什么算法？ | SameValueZero |
| 2 | ↑ → 还有谁用同一算法？ | `Map` 键、`Array.includes`；`indexOf` 用 `===`，找不到 `NaN` |
| 3 | `[...set]` → 和 `Array.from` 差在哪？ | 后者还支持类数组，可带 mapFn |
| 4 | `for...of` → 底层依赖什么？ | `Symbol.iterator` 的 `next()` 直到 `done: true` |
| 5 | ↑ → 提前 `break` 会怎样？ | 调用迭代器的 `return()` 做清理 |
| 6 | `Map` → 为什么能放对象键？ | `Object` 键会字符串化，`Map` 按引用 |
| 7 | `Map` → 换成 `WeakMap` 换来什么？ | 弱引用不阻止 GC；代价是不可迭代、无 `size`/`clear` |
| 8 | ↑ → 键的边界？ | 对象或非注册 `Symbol`；`Symbol.for()` 会抛 |
