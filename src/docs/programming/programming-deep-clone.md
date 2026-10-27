# 编程 06｜深拷贝与对象处理

> 覆盖题号：3（手写深拷贝）、25、42
> 去重后：**1 个考点，但要处理 10 类边界**

---

## 目录

- [6.1 一句话结论](#61-一句话结论)
- [6.2 原题单答案：6 类对象全部拷错](#62-原题单答案6-类对象全部拷错)
- [6.3 为什么必须用 `WeakMap` 而不是 `Map`](#63-为什么必须用-weakmap-而不是-map)
- [6.4 完整实现（六步）](#64-完整实现六步)
- [6.5 三方对比：手写 vs structuredClone vs JSON](#65-三方对比手写-vs-structuredclone-vs-json)
- [6.6 浅拷贝五种写法](#66-浅拷贝五种写法)
- [6.7 什么时候「不该」深拷贝](#67-什么时候不该深拷贝)
- [6.8 面试怎么说](#68-面试怎么说)
- [6.9 速记卡](#69-速记卡)
- [6.10 自测](#610-自测)

---

## 6.1 一句话结论

> 深拷贝 = **递归复制 + 循环引用处理 + 类型完备性**。第三项是区分度所在。

---

## 6.2 原题单答案：6 类对象全部拷错

```js
function deepClone(obj, map = new WeakMap()) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (map.has(obj)) return map.get(obj);
  const clone = Array.isArray(obj) ? [] : {};
  map.set(obj, clone);
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clone[key] = deepClone(obj[key], map);
    }
  }
  return clone;
}
```

**框架是对的**（循环引用处理正确），但 6 类对象全部拷错，类实例还会丢原型：

| # | 用例 | 期望 | 实际 |
|---|---|---|---|
| 1 | `{ d: new Date() }` | `Date` 实例 | **`{}`** |
| 2 | `{ r: /ab+c/gi }` | `RegExp` 实例 | **`{}`** |
| 3 | `{ m: new Map([['k',1]]) }` | `Map` 实例 | **`{}`** |
| 4 | `{ s: new Set([1,2]) }` | `Set` 实例 | **`{}`** |
| 5 | `{ [Symbol('s')]: 'v' }` | 保留 Symbol 键 | **`undefined`（丢失）** |
| 6 | `Object.create(null)` | 正常拷贝 | **`TypeError: obj.hasOwnProperty is not a function`** |
| 7 | `new Point(1,2)`（类实例） | 保留原型、方法可用 | **原型丢失，`instanceof` 为 false** |
| 8 | 循环引用 | 正确 | ✅ 正确 |

### 为什么会拷成 `{}`

`Date`、`Map`、`Set`、`RegExp` 的**数据不在自有可枚举属性上**：

```js
const d = new Date();
Object.keys(d);                    // []      ← 看不出任何东西
Reflect.ownKeys(d);                // []      ← 连 Symbol 都没有
d.getTime();                       // 时间藏在 [[DateValue]] 内部槽里
```

数据存在**内部槽（internal slot）**里，`for...in` 一个属性都遍历不到，只能得到空对象。唯一的办法是**按类型分别处理**：先判断 `tag`，再用对应的构造函数重建。

### 为什么 `Object.create(null)` 会抛错

`Object.create(null)` 创建的对象**没有原型链**：

```js
const np = Object.create(null);
np.hasOwnProperty;                 // undefined  ← 不在原型链上，也没有
```

`obj.hasOwnProperty(key)` 于是报 `is not a function`。

**正确写法**：`Object.prototype.hasOwnProperty.call(obj, key)`。用 `Object.create(null)` 建的路由表、配置表都会踩到这一点。

---

## 6.3 为什么必须用 `WeakMap` 而不是 `Map`

这道题的必答追问。

```js
function deepClone(obj, map = new WeakMap()) { ... }
```

| | `Map` | `WeakMap` |
|---|---|---|
| 键类型 | 任意 | **只能对象** |
| 键是否强引用 | **是** | 否（弱引用） |
| 可枚举 | 是（`keys()`） | 否 |
| 能否被 GC | 键被引用期间不能 | **键没其他引用时可回收** |

**用 `Map` 的问题**：`map` 会**强引用所有源对象**，直到自己被回收；一旦调用方把同一个 `Map` 复用给多次拷贝，整棵源对象树都跟着泄漏。

`WeakMap` 的语义正好是「**源对象活着的时候才需要它**」——源对象被回收，这条映射也没有意义了。

> **注意一个细节**：默认参数 `map = new WeakMap()` 在**每次顶层调用**时都会创建新的。所以不存在「多次拷贝共享状态」的问题。

---

## 6.4 完整实现（六步）

```js
function deepClone(value, map = new WeakMap()) {
  // ① 原始值 / 函数 → 直接返回
  if (value === null || typeof value !== 'object') return value;

  // ② 循环引用 → 返回已创建的副本
  if (map.has(value)) return map.get(value);

  const tag = Object.prototype.toString.call(value);
  let clone;

  // ③ 按类型创建「壳子」
  switch (tag) {
    case '[object Date]':
      clone = new Date(value.getTime());
      break;
    case '[object RegExp]':
      clone = new RegExp(value.source, value.flags);
      clone.lastIndex = value.lastIndex;        // 保留 lastIndex
      break;
    case '[object Map]':
      clone = new Map();
      break;
    case '[object Set]':
      clone = new Set();
      break;
    case '[object ArrayBuffer]':
      clone = value.slice(0);
      break;
    case '[object Array]':
      clone = new Array(value.length);
      break;
    default:
      // 保留原型链：类实例、Object.create(null) 都靠这行
      clone = Object.create(Object.getPrototypeOf(value));
  }

  // ④ 必须在递归之前登记，否则循环引用会死循环
  map.set(value, clone);

  // ⑤ Map / Set 要单独遍历
  if (tag === '[object Map]') {
    for (const [k, v] of value) {
      clone.set(deepClone(k, map), deepClone(v, map));   // 键也深拷贝
    }
    return clone;
  }
  if (tag === '[object Set]') {
    for (const v of value) clone.add(deepClone(v, map));
    return clone;
  }
  if (tag === '[object Date]' || tag === '[object RegExp]' || tag === '[object ArrayBuffer]') {
    return clone;
  }

  // ⑥ 复制所有自有属性：含 Symbol 键、不可枚举、getter/setter
  for (const key of Reflect.ownKeys(value)) {
    if (key === 'length' && Array.isArray(value)) continue;

    const desc = Object.getOwnPropertyDescriptor(value, key);
    if ('value' in desc) desc.value = deepClone(desc.value, map);
    Object.defineProperty(clone, key, desc);
  }
  return clone;
}
```

### 六步分别在解决什么

| # | 解决 | 关键行 |
|---|---|---|
| ① | 递归终止 + 函数共享 | `typeof value !== 'object'` |
| ② | 循环引用 | `map.has` / `map.get` |
| ③ | 类型完备性 | `switch (tag)` + `Object.create(getPrototypeOf)` |
| ④ | 循环引用（时序） | **`map.set` 在递归之前** |
| ⑤ | Map/Set 的特殊遍历 | `for...of` 而非 `ownKeys` |
| ⑥ | Symbol 键 + 不可枚举 + getter | `Reflect.ownKeys` + 描述符 |

### 实测

```
基础类型
  num/str/bool: 1 a false
  null/undefined: null undefined | 属性存在: true
  NaN/-0: true true

特殊对象
  Date: true | 时间相同: true | 不同引用: true
  RegExp: true | source: ab+c | flags: gi | lastIndex: 2
  Map: true | size: 2 | 值深拷贝: true | 键深拷贝: true | 原键可查: false
  Set: true | size: 2
  ArrayBuffer: true | 内容: hello

原型与类实例
  point instanceof Point: true | dist(): 5 | getter sum: 7
  Object.create(null) 原型: null | x: 1

Symbol / 函数 / 描述符
  Symbol 键: symbol-key
  函数: function | 同一引用: true
  getter: 拷贝阶段 0 次调用 | 读取时 1 次 | 副本仍是 accessor
  不可枚举对象属性: 已深拷贝 | enumerable: false

结构
  循环引用: true | 与源不同引用: true
  嵌套数组不同引用: true true [1,[2,[3]]]
  稀疏数组保留空位: true | length: 3

改副本不影响原对象
  原 arr: [1,[2,[3]]] | 原 point.x: 3 | 原 map.v: 1
```

---

## 6.5 三方对比：手写 vs structuredClone vs JSON

| 能力 | 手写 | `structuredClone` | `JSON.parse(JSON.stringify())` |
|---|---|---|---|
| 普通对象/数组 | ✅ | ✅ | ✅ |
| Date | ✅ | ✅ | ❌ 变字符串 |
| RegExp | ✅ | ✅ | ❌ 变 `{}` |
| Map / Set | ✅ | ✅ | ❌ 变 `{}` |
| 循环引用 | ✅ | ✅ | ❌ 抛 `TypeError` |
| `undefined` 属性 | ✅ | ✅ | ❌ 丢失 |
| `NaN` / `Infinity` | ✅ | ✅ | ❌ 变 `null` |
| `-0` | ✅ | ✅ | ❌ 变 `0` |
| 函数 | ⚠️ 共享引用 | ❌ `DataCloneError` | ❌ 丢失 |
| Symbol 键 / 值 | ✅ 保留 / 共享 | ❌ 键静默丢弃；值抛错 | ❌ 都丢失 |
| 原型链（含 `Object.create(null)`） | ✅ | ❌ 变成 `Object` 原型 | ❌ 同左 |
| getter/setter | ✅ 保留描述符 | ❌ 变成数据属性 | ❌ 变成数据属性 |
| 稀疏数组空位 | ✅ | ✅ | ❌ 变 `null` |
| 性能（纯数据基准） | 慢（反射 + 描述符） | 中（原生实现） | 快 |
| 浏览器支持 | 全 | Chrome 98+ / Safari 15.4+ | 全 |

### 实测对比

```
structuredClone：
  Date/Map/Set/RegExp 实例保留 | 循环引用: OK | undefined/NaN/-0/稀疏空位: 保留
  函数、Symbol 值: DataCloneError
  Symbol 键: 静默丢弃 | 类实例、Object.create(null): 原型变成 Object.prototype

JSON：
  Date → "2023-11-14T22:13:20.000Z" | undefined/函数/Symbol 键: 丢失
  NaN/Infinity → null | -0 → 0 | 稀疏数组空位 → null
  循环引用 → TypeError: Converting circular structure to JSON

性能（Node 22，1000 项对象 × 2000 次）
  JSON 1233ms < structuredClone 1709ms < 手写 5443ms
```

### 三个结论（面试直接说）

1. **绝大多数场景用 `structuredClone`**——标准、原生实现、处理循环引用和大部分类型，比手写快
2. **在可拷贝的类型里，`structuredClone` 的硬伤是不保留原型链**；函数和 Symbol 值会直接抛 `DataCloneError`。要保留类实例方法或 getter 才需要手写
3. **`JSON` 法只适合「纯数据 + 无 undefined + 无 Date + 无循环」**——数据里有 `undefined`、`Date` 或 `NaN` 时，它只会悄悄改值

---

## 6.6 浅拷贝五种写法

深拷贝题经常连着问「那浅拷贝呢」。

```js
const src = { a: 1, b: { c: 2 }, arr: [1, 2] };

const s1 = Object.assign({}, src);          // ⚠️ 有坑
const s2 = { ...src };                      // 同上
const s3 = { ...src, a: 99 };               // 覆盖某个字段
const s4 = src.arr.slice();                 // 只对数组
const s5 = structuredClone(src);            // 这是深拷贝，不是浅的
```

### 必须知道的三个细节

#### ① `Object.assign` / `{...}` 只复制**可枚举的自有属性**

```js
const np = Object.create({ inherited: 1 });
np.own = 2;
const c = { ...np };
c.inherited;    // undefined  ← 原型上的属性不会被复制
```

#### ② 数组的 `slice` / `concat` 是浅拷贝，但 `[...arr]` 也是

```js
const a = [{ x: 1 }];
const b = [...a];
b[0].x = 99;
a[0].x;         // 99   ← 嵌套对象还是共享的
```

#### ③ `Object.assign` 会**触发 getter**

```js
const obj = { get x() { console.log('getter 执行'); return 1; } };
Object.assign({}, obj);      // 打印「getter 执行」
```

`{...obj}` 也一样。而**深拷贝用描述符搬移则不会触发**。

---

## 6.7 什么时候「不该」深拷贝

深拷贝看起来很安全，实际上经常是错的。

### 场景 1：React 状态更新

```js
// 错误：全量深拷贝导致所有子组件重渲染
setState(deepClone(state));

// 正确：只复制要改的路径
setState({ ...state, user: { ...state.user, name: 'new' } });
```

**为什么**：React 的 `memo` / `PureComponent` 靠**引用相等**判断是否重渲染。深拷贝之后所有引用都变了，所有 `memo` 全部失效——**性能比不改还差**。

### 场景 2：包含 DOM 节点 / 组件实例 / 函数的对象

```js
const form = { el: document.querySelector('#x'), submit: () => {} };
deepClone(form);    // el 无法靠递归重建，submit 仍是共享引用
```

递归复制只能复制属性，重建不了宿主对象（DOM 节点）和组件实例。

### 场景 3：大数据（10MB+ 的 JSON）

深拷贝的耗时和内存都是 2 倍。**这种场景应该考虑「不可变数据结构」（Immutable.js / Immer）或者只拷贝变更路径**。

### 场景 4：需要保留引用标识的缓存

```js
// LRU 缓存的 key 是对象引用，深拷贝后就命中不了了
cache.set(userObj, data);
```

> **结论**：能浅拷贝就浅拷贝，只复制变更路径。React/Redux 的不可变更新就是这样——内存更省，还能保住 `memo` 的引用比较。深拷贝只适合「跨边界传递、且对方可能修改」的场景，比如 `postMessage` 前的数据准备、给第三方库传配置。

---

## 6.8 面试怎么说

- **接题先确认范围**：只需要普通对象/数组，还是 Date、RegExp、Map/Set、循环引用、类实例？纯数据直接用 `structuredClone`；要保留原型链或 getter 才值得手写。
- **类型判断用 `Object.prototype.toString`**，不能只看 `Array.isArray`：Date、Map、Set 的数据在内部槽里，`Object.keys` 看不到。
- **`map.set` 必须早于递归**，属性用 `Reflect.ownKeys` + 描述符复制，才能覆盖循环引用、Symbol 键、不可枚举属性和 getter。
- **主动交代取舍**：函数共享引用；原型保留但构造函数不执行；getter 的副作用仍依赖原对象。
- **主动补边界**：Map 的键也会被深拷贝（副本里用原键查不到）；`-0`、`NaN`、稀疏数组空位都保留。

### 追问链

| 追问 | 答法 |
|---|---|
| 怎么拷贝函数？ | 不拷。函数是行为不是数据；`fn.toString()` + `new Function` 会丢闭包 |
| `WeakMap` / `WeakSet` / Promise 怎么处理？ | 前两者不可枚举，只能共享引用；Promise 是状态机，复制没有意义 |
| 怎么处理超深对象（1 万层）？ | 递归会爆栈，要改成显式栈迭代 |
| 手写和 `structuredClone` 差多少？ | 同一份纯数据约慢 3 倍（Node 22）；反射 + 描述符的常数更大 |
| Vue 的 `data` 为什么不需要深拷贝？ | Vue 3 用 Proxy 包装原对象，复制反而会断开响应式关联 |

---

## 6.9 速记卡

```
【原答案 6 个错】
Date/RegExp/Map/Set → 都变 {}     ← 数据在内部槽，for...in 看不到
Symbol 键 → 丢失                  ← for...in 只拿字符串键
Object.create(null) → 抛错        ← 没有 hasOwnProperty
类实例 → 原型丢失

【为什么必须 WeakMap】
Map 强引用键 → 源对象无法 GC → 整棵树泄漏
WeakMap 弱引用 → 源对象回收后映射自动消失

【六步】
① 原始值/函数直接返回
② map.has 查循环
③ switch(tag) 建壳子 + Object.create(getPrototypeOf)
④ map.set 必须在递归之前   ★
⑤ Map/Set 用 for...of，键也深拷贝
⑥ Reflect.ownKeys + 描述符（Symbol / 不可枚举 / getter）

【三方对比】
structuredClone：标准、比手写快、循环引用 OK，但丢原型，函数抛错
JSON：undefined 丢失 / Date 变字符串 / NaN 变 null / 循环引用抛错
手写：三者中唯一能保留原型 + getter 的方案

【什么时候不该深拷贝】
React 状态 → 全量拷贝会让 memo 全部失效
含 DOM/组件实例 → 拷了也没用
大数据 → 用不可变结构或只复制变更路径
```

---

## 6.10 自测

```
□ 能说出为什么 Date 拷出来是空对象
□ 能说出为什么 Object.create(null) 会让原答案抛错
□ 能解释 WeakMap 相比 Map 的必要性
□ 能说出 map.set 为什么必须在递归之前
□ 能说出 Reflect.ownKeys 比 Object.keys 多拿到什么
□ 能说出 structuredClone 的三个优势和两个劣势
□ 能说出 JSON 法的至少四个致命问题
□ 能说出 Object.assign 会触发 getter
□ 能说出「什么时候不该深拷贝」的至少两个场景
□ 能说出类实例深拷贝后构造函数不会执行的影响
□ 能说出 WeakMap / Promise / 函数 各怎么处理
```
