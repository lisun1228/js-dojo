# JS · 07 集合与元编程

> 本册覆盖：Map vs Object、Set、WeakMap/WeakSet、Symbol、Reflect、Proxy、`defineProperty`、装饰器、迭代器
> 题单：题 43 给了 3 条对比（键任意/插入顺序/size），题 45「同 ES6 文档第 18 题」（不存在），题 48「和 Proxy 拦截器一一对应」（太简），题 49/50「同 ES6 文档」（不存在）。
> 本册的核心是 **Proxy vs defineProperty 的四个缺陷**——这是「为什么 Vue 3 换 Proxy」的标准答案，也是元编程这块唯一的高频考点。

---

## 7.1 一句话结论

**`Map`/`Set` 是「真正的集合」**（键可以是任意类型、保持插入顺序、可迭代），`Object`/`Array` 是为了性能放弃了一部分语义。
**`WeakMap`/`WeakSet` 是「弱引用版」**——不阻止 GC，所以**不能迭代、没有 `size`**。
**`Proxy` 是「拦截对象所有操作」的元编程工具**（13 个 trap），`Reflect` 是它的「默认行为实现」，**两者必须搭配用**。

---

## 7.2 Map vs Object

### 7.2.1 七个维度对比（全部实测）

| 维度 | `Object` | `Map` |
|---|---|---|
| **键的类型** | **只能是 `string` / `Symbol`**（其他会被转成字符串） | **任意类型**（对象、函数、`NaN` 都行） |
| **插入顺序** | ⚠️ **整数键会被提前并排序** | ✅ **严格保持插入顺序** |
| **元素个数** | 要 `Object.keys(obj).length`（O(n)） | ✅ **`size` 属性（O(1)）** |
| **迭代** | ❌ 不可直接迭代（要 `Object.entries`） | ✅ **本身可迭代** |
| **原型链干扰** | ⚠️ `'toString' in {}` 是 **true** | ✅ 无（`map.has('toString')` 是 false） |
| **序列化** | ✅ `JSON.stringify` 正常 | ❌ **返回 `{}`** |
| **频繁增删性能** | 较差（隐藏类变化） | ✅ **更好**（专为增删设计） |

**逐条实测验证**：

```js
// ① 键的类型
const m = new Map();
m.set(NaN, 'nan-key').set({}, 'obj-key').set(1, 'num');
m.get(NaN);              // 'nan-key'  ✅ NaN 可以作键
m.size;                  // 3

const o = {};
o[NaN] = 'nan'; o[{}] = 'obj';
Object.keys(o);          // ['NaN', '[object Object]']  ← 都被转成字符串了

// ② 顺序（★ 最关键的差异）
[...new Map([[3,'a'], [1,'b'], [2,'c']]).keys()];   // [3, 1, 2]  ✅ 插入顺序
Object.keys({ 3:'a', 1:'b', 2:'c' });               // ['1','2','3']  ⚠️ 被排序了

// ③ size
m.size;                          // 3
Object.keys(o).length;           // 2（O(n) 遍历）

// ④ 迭代
[...m.entries()];                // [['NaN','nan-key'], ...]
for (const x of {}) { }          // TypeError  ← 对象不可迭代

// ⑤ 原型链
'toString' in {};                // true   ⚠️
new Map().has('toString');       // false  ✅

// ⑥ 序列化
JSON.stringify(new Map([['a', 1]]));   // '{}'  ⚠️ 空对象！
JSON.stringify({ a: 1 });             // '{"a":1}'  ✅
```

### 7.2.2 「顺序」这个差异为什么重要

**`Object` 的键顺序规则**（规范定义）：

```
① 整数键（"0"、"1"、"2"…）→ 按数值升序，且【全部提前】
② 字符串键 → 按插入顺序
③ Symbol 键 → 不参与 for...in / Object.keys
```

```js
const o = { b: 1, 2: 'two', a: 2, 1: 'one' };
Object.keys(o);          // ['1', '2', 'b', 'a']  ← 整数键跑到前面了
```

**后果**：用对象当「有序字典」时，如果键是数字（比如 ID、时间戳），**顺序会乱**。

**这就是「统计字符出现次数必须用 `Map` 不能用 `Record`」的硬理由**（不是性能，是语义）：

```js
// ❌ 用对象：数字字符会被提前排序
function firstSingleChar(s) {
  const count = {};
  for (const c of s) count[c] = (count[c] || 0) + 1;
  for (const k in count) if (count[k] === 1) return k;
  return null;
}
firstSingleChar('3a3b1');    // '1'  ❌ 错！原串第一个只出现一次的是 'a'

// ✅ 用 Map：保持插入顺序
function firstSingleChar(s) {
  const count = new Map();
  for (const c of s) count.set(c, (count.get(c) ?? 0) + 1);
  for (const [k, v] of count) if (v === 1) return k;
  return null;
}
firstSingleChar('3a3b1');    // 'a'  ✅
```

**这个例子实测验证过，非常适合面试时举。**

### 7.2.3 「序列化」这个差异为什么重要

```js
JSON.stringify(new Map([['a', 1]]));   // '{}'   ← 完全丢了！
JSON.stringify(new Set([1, 2]));       // '{}'
```

**所以要序列化 Map，必须先转成数组或对象**：

```js
// Map → 数组
JSON.stringify([...map]);              // '[["a",1]]'
JSON.stringify([...map.entries()]);    // 同上
JSON.stringify(Object.fromEntries(map));   // '{"a":1}'（key 必须是字符串）

// 反序列化
new Map(JSON.parse(str));
```

**这就是「Map 不能直接放进 Redux state / localStorage」的原因。**

### 7.2.4 什么时候用哪个

```
需要「非字符串键」？
  → Map

需要「严格插入顺序」（尤其键含数字）？
  → Map

需要「频繁增删」？
  → Map

需要「序列化 / 传给后端 / 存 localStorage」？
  → Object

需要「简单配置对象 / 数据结构固定的记录」？
  → Object（语法更简洁，性能更好）

只是需要「键值查找」且键都是字符串？
  → 两个都行，Object 更轻
```

**一句话**：**`Object` 是「数据结构」，`Map` 是「字典」。**

---

## 7.3 Set

### 7.3.1 核心特性

| 特性 | 说明 |
|---|---|
| **元素唯一** | 按 **`SameValueZero`** 判断（`NaN` 等于自己，`0` 等于 `-0`） |
| **保持插入顺序** | 迭代顺序 = 插入顺序 |
| **可迭代** | `for...of` / `[...set]` |
| **O(1) 的 `has`** | 比数组 `includes`（O(n)）快 |

**实测**：

```js
const s = new Set([1, '1', NaN, NaN, {a:1}, {a:1}, 0, -0]);
[...s];        // [1, '1', NaN, {a:1}, {a:1}, 0]   size = 6
```

**三个细节**：

| 细节 | 说明 |
|---|---|
| **`NaN` 只会留一个** | 因为 `SameValueZero` 认为 `NaN === NaN` |
| **`0` 和 `-0` 合并成一个** | 同上 |
| **两个 `{}` 不会合并** | 因为引用不同（`SameValueZero` 对对象是引用比较） |

### 7.3.2 五个常用操作

```js
const set = new Set([1, 2, 3]);

set.add(4);              // 添加
set.delete(1);           // 删除（返回 boolean）
set.has(2);              // 判断（O(1)）
set.size;                // 3
set.clear();             // 清空
```

**迭代**：

```js
for (const v of set) { }
set.forEach((v, v2) => { });    // 注意：两个参数都是值（为了兼容 Map 的签名）
[...set];                       // 转数组
```

### 7.3.3 交并差（ES6 没有内置，要手写）

```js
const A = new Set([1, 2, 3]);
const B = new Set([2, 3, 4]);

// 并集
new Set([...A, ...B]);                    // {1,2,3,4}

// 交集
new Set([...A].filter(x => B.has(x)));    // {2,3}

// 差集（A 有 B 没有）
new Set([...A].filter(x => !B.has(x)));   // {1}

// 对称差（只在一边的）
new Set([...A, ...B].filter(x => !(A.has(x) && B.has(x))));
```

**ES2025 会加原生方法**（`union` / `intersection` / `difference` / `symmetricDifference` / `isSubsetOf` 等），但目前还要手写。

### 7.3.4 数组去重的四种方式对比

| 方式 | `NaN` 保留？ | `{}` 去重？ | 复杂度 |
|---|---|---|---|
| **`[...new Set(arr)]`** | ✅ | ❌（引用不同） | O(n) |
| `filter + indexOf` | ❌ **全丢** | ❌ | O(n²) |
| `filter + includes` | ✅ | ❌ | O(n²) |
| `reduce + Map`（按 key） | ✅ | ✅（如果指定 key） | O(n) |

**`indexOf` 丢 `NaN` 的原因**：它用 `===`，而 `NaN !== NaN`。

```js
[NaN, NaN].filter((v, i, a) => a.indexOf(v) === i);   // []  ← 空数组！
```

**所以「数组去重」首选 `Set`**（详见 11 册）。

---

## 7.4 WeakMap / WeakSet

### 7.4.1 三个「没有」

| 没有 | 为什么 |
|---|---|
| **没有 `size`** | 元素个数依赖 GC，**随时会变**，无法给出确定值 |
| **没有 `clear()`** | 无法枚举，就没法清空 |
| **不可迭代**（无 `keys`/`values`/`entries`/`Symbol.iterator`） | 同上 |

**实测**：

```js
const wm = new WeakMap();
'size' in wm;              // false
typeof wm.clear;           // 'undefined'
[...wm];                   // TypeError: wm is not iterable
```

**这不是「设计缺陷」，是逻辑必然而非选择**——一旦允许枚举，就等于间接持有强引用，弱引用就失效了。

### 7.4.2 两个限制

```js
// ① key 必须是对象（不能是原始值）
new WeakMap().set(1, 2);      // TypeError: Invalid value used as weak map key
new WeakMap().set(Symbol(), 1);   // TypeError（Symbol 也不行，除了 registered symbol）

// ② 不能遍历，只能 get/has/set/delete
```

### 7.4.3 为什么需要弱引用

**核心用途：「给对象附加数据，但不阻止它被回收」。**

```js
// ❌ 用 Map：只要 map 活着，key 指向的对象就永远不回收
const cache = new Map();
function process(obj) {
  if (cache.has(obj)) return cache.get(obj);
  const result = heavyCompute(obj);
  cache.set(obj, result);        // ← obj 被强引用，即使外部不用了也不回收
  return result;
}

// ✅ 用 WeakMap：obj 被外部丢弃后，缓存条目自动消失
const cache = new WeakMap();
function process(obj) {
  if (cache.has(obj)) return cache.get(obj);
  const result = heavyCompute(obj);
  cache.set(obj, result);        // ← 弱引用，不阻止 GC
  return result;
}
```

### 7.4.4 五个真实应用

**① DOM 节点关联数据**

```js
const nodeData = new WeakMap();
nodeData.set(element, { clicks: 0 });
// element 被移除后，数据自动回收（不会内存泄漏）
```

**② 缓存 / 记忆化**

```js
const memo = new WeakMap();
function getDerived(obj) {
  if (!memo.has(obj)) memo.set(obj, compute(obj));
  return memo.get(obj);
}
```

**③ 私有数据（ES2022 `#x` 之前的实现方式）**

```js
const _private = new WeakMap();

class Counter {
  constructor() {
    _private.set(this, { count: 0 });
  }
  inc() {
    _private.get(this).count++;
  }
}
```

**④ Vue 3 的响应式依赖收集**

Vue 3 用 `WeakMap` 存「对象 → 属性 → 依赖集合」：

```js
// 简化自 Vue 3 源码
const targetMap = new WeakMap();
// targetMap: WeakMap<target, Map<key, Set<effect>>>

function track(target, key) {
  let depsMap = targetMap.get(target);
  if (!depsMap) targetMap.set(target, (depsMap = new Map()));
  let dep = depsMap.get(key);
  if (!dep) depsMap.set(key, (dep = new Set()));
  dep.add(activeEffect);
}
```

**为什么用 `WeakMap`**：组件卸载后，`target`（响应式对象）能被回收，不用手动清理依赖。

**⑤ 给对象打标记（不污染原对象）**

```js
const visited = new WeakSet();
function traverse(node) {
  if (visited.has(node)) return;
  visited.add(node);
  node.children?.forEach(traverse);
}
```

### 7.4.5 WeakMap 的「弱」到底多弱

```js
let key = {};
const wm = new WeakMap();
wm.set(key, 'value');

wm.get(key);        // 'value'

key = null;         // ← 唯一的强引用没了
// 下一轮 GC 后，wm 里的条目会消失（无法观测，因为不能遍历）
```

**⚠️ 注意**：**GC 时机不确定**，所以不能依赖「立即回收」。

---

## 7.5 Symbol

### 7.5.1 三个特性

| 特性 | 说明 |
|---|---|
| **唯一** | 即使描述相同也不相等（除非用 `Symbol.for`） |
| **不可转字符串** | `String(sym)` 可以，但 `sym + ''` 报错（防意外转换） |
| **可作对象键** | 且**不参与 `for...in` / `Object.keys` / `JSON.stringify`** |

**实测**：

```js
Symbol('desc') === Symbol('desc');       // false  ← 描述相同也不同
Symbol.for('x') === Symbol.for('x');     // true   ← 全局注册表

const s = Symbol('k');
const obj = { [s]: 'sym-value', normal: 1 };
Object.keys(obj);          // ['normal']       ← Symbol 键不出现
Reflect.ownKeys(obj);      // [s, 'normal']    ← 这个能看到
JSON.stringify(obj);       // '{"normal":1}'   ← JSON 忽略
```

### 7.5.2 四个用途

**① 避免属性名冲突（最经典）**

```js
// 两个库都想给对象加 `metadata` 属性 → 冲突
// 用 Symbol 就不会
const LIB_A = Symbol('metadata');
const LIB_B = Symbol('metadata');
obj[LIB_A] = {...};
obj[LIB_B] = {...};      // 互不干扰
```

**② 模拟私有属性（`#x` 之前）**

```js
const _count = Symbol('count');
class Counter {
  constructor() { this[_count] = 0; }
  inc() { this[_count]++; }
}
// 外部拿不到 _count 这个 Symbol，除非用 Reflect.ownKeys 硬查
```

**⚠️ 但这不是真私有**——`Reflect.ownKeys` 能拿到。

**③ 定义「协议」（内置 Symbol）**

**这是最重要的用途**，JS 用 Symbol 定义了一组「钩子」：

| Symbol | 作用 | 被谁调用 |
|---|---|---|
| **`Symbol.iterator`** | 定义迭代器 | `for...of`、`[...x]`、`Array.from` |
| **`Symbol.asyncIterator`** | 定义异步迭代器 | `for await...of` |
| **`Symbol.toPrimitive`** | 定义类型转换 | `+x`、`` `${x}` `` |
| **`Symbol.hasInstance`** | 定义 `instanceof` | `x instanceof C` |
| **`Symbol.toStringTag`** | 定义 `[object Xxx]` 里的 Xxx | `Object.prototype.toString.call(x)` |
| **`Symbol.species`** | 定义派生对象构造函数 | `map`/`filter` 返回什么类型 |
| **`Symbol.isConcatSpreadable`** | 定义 `concat` 是否展开 | `[].concat(x)` |
| **`Symbol.match`/`replace`/`search`/`split`** | 定义字符串方法行为 | `'a'.replace(x, ...)` |

**四个实战例子**：

```js
// ① 让对象可迭代
const range = {
  from: 1, to: 3,
  [Symbol.iterator]() {
    let cur = this.from, last = this.to;
    return { next: () => cur <= last ? { value: cur++, done: false } : { done: true } };
  },
};
[...range];      // [1, 2, 3]

// ② 让对象支持 +
const money = {
  amount: 100,
  [Symbol.toPrimitive](hint) { return hint === 'string' ? `¥${this.amount}` : this.amount; },
};
`${money}`;      // '¥100'
+money;          // 100

// ③ 自定义 instanceof
class Even { static [Symbol.hasInstance](n) { return n % 2 === 0; } }
2 instanceof Even;    // true

// ④ 自定义 toString 标签
class MyClass { get [Symbol.toStringTag]() { return 'MyClass'; } }
Object.prototype.toString.call(new MyClass());   // '[object MyClass]'
```

**④ 作为「枚举常量」（避免字符串魔法值）**

```js
const STATUS = {
  IDLE: Symbol('idle'),
  LOADING: Symbol('loading'),
};
// 比字符串安全（不可能拼错、不会冲突）
```

**但现在更推荐 `Object.freeze` + 字符串，或者 TS 的联合类型**——因为 Symbol 不能序列化，调试不友好。

### 7.5.3 `Symbol.for` 全局注册表

```js
Symbol.for('key') === Symbol.for('key');       // true   ← 同一个
Symbol('key') === Symbol('key');               // false

Symbol.keyFor(Symbol.for('x'));                // 'x'  ← 反查
Symbol.keyFor(Symbol('x'));                    // undefined  ← 非全局的没有
```

**用途**：跨模块/跨 iframe 共享 Symbol（比如 polyfill 要保证同一个 Symbol）。

---

## 7.6 Proxy vs defineProperty★ 本册重点

### 7.6.1 `defineProperty` 的用法

```js
const obj = {};
Object.defineProperty(obj, 'a', {
  value: 1,
  writable: false,        // 能否赋值
  enumerable: false,      // 能否被 for...in / Object.keys 枚举
  configurable: false,    // 能否被删除 / 重新定义
});

// 或者用 getter/setter
Object.defineProperty(obj, 'b', {
  get() { return this._b; },
  set(v) { this._b = v * 2; },
});
obj.b = 5;
obj.b;                    // 10  ← 实测
```

### 7.6.2 `defineProperty` 的四个致命缺陷（这就是 Vue 3 换 Proxy 的原因）

| # | 缺陷 | 实测 |
|---|---|---|
| **① 无法监听新增/删除属性** | 必须先用 `defineProperty` 定义好；`obj.newKey = 1` 监听不到 | ✅ 实测 `count === 0` |
| **② 无法监听数组索引和 `length`** | `arr[0] = 1`、`arr.length = 0` 监听不到 | ✅（Vue 2 只能重写 7 个数组方法） |
| **③ 必须递归遍历所有属性** | 初始化时就要 `Object.keys` 递归 `defineProperty`，**深层对象性能差** | ✅ |
| **④ 只能定义一次**（`configurable: false` 时） | 无法重新定义，也无法删除 | ✅ |

**逐条展开**：

**缺陷 ①：新增属性监听不到**

```js
const o = {};
let count = 0;
Object.defineProperty(o, 'x', {
  get() { return 1; },
  set() { count++; },
  configurable: true,
});

o.y = 1;        // 新增属性，完全监听不到
count;          // 0  ← 实测
```

**Vue 2 的解法**：`Vue.set(obj, key, value)` / `Vue.delete`——**手动 API**。

**缺陷 ②：数组索引监听不到**

```js
const arr = [1, 2, 3];
// 用 defineProperty 给 arr[0] 加 setter
Object.defineProperty(arr, 0, { set(v) { console.log('set 0'); } });
arr[0] = 9;         // 能触发（因为显式定义了）
arr[3] = 4;         // ❌ 监听不到（新索引）
arr.length = 0;     // ❌ 监听不到
```

**Vue 2 的解法**：重写 7 个数组方法（`push`/`pop`/`shift`/`unshift`/`splice`/`sort`/`reverse`）+ `Vue.set`。

**缺陷 ③：必须递归**

```js
// Vue 2 的 observe：初始化时递归所有属性
function observe(obj) {
  Object.keys(obj).forEach(key => {
    defineReactive(obj, key, obj[key]);
    if (typeof obj[key] === 'object') observe(obj[key]);   // 递归到底
  });
}
// 一个大对象（几千个属性）初始化就很慢
```

**Proxy 的解法**：**惰性代理**——只在访问到某一层时才返回那一层的 Proxy。

### 7.6.3 Proxy 的优势

```js
const p = new Proxy(target, {
  get(t, k, receiver) { return Reflect.get(t, k, receiver); },
  set(t, k, v, receiver) { return Reflect.set(t, k, v, receiver); },
});
```

| 优势 | 说明 |
|---|---|
| **① 能监听新增/删除** | `set` / `deleteProperty` trap |
| **② 能监听数组索引和 length** | 同上（数组也是对象） |
| **③ 惰性代理** | 只在访问时创建嵌套 Proxy，初始化快 |
| **④ 能拦截 13 种操作** | 见下表 |
| **⑤ 不修改原对象** | 返回一个「代理」，原对象保持干净 |

### 7.6.4 Proxy 的 13 个 trap

| # | trap | 拦截的操作 |
|---|---|---|
| 1 | **`get`** | `obj.a`、`obj['a']` |
| 2 | **`set`** | `obj.a = 1` |
| 3 | **`has`** | `'a' in obj` |
| 4 | **`deleteProperty`** | `delete obj.a` |
| 5 | **`ownKeys`** | `Object.keys`、`Object.getOwnPropertyNames`、`Reflect.ownKeys` |
| 6 | **`getOwnPropertyDescriptor`** | `Object.getOwnPropertyDescriptor` |
| 7 | **`defineProperty`** | `Object.defineProperty` |
| 8 | **`getPrototypeOf`** | `Object.getPrototypeOf`、`instanceof`（部分） |
| 9 | **`setPrototypeOf`** | `Object.setPrototypeOf` |
| 10 | **`isExtensible`** | `Object.isExtensible` |
| 11 | **`preventExtensions`** | `Object.preventExtensions` |
| 12 | **`apply`** | 函数调用 `fn()` |
| 13 | **`construct`** | `new Fn()` |

**实测两个特殊 trap**：

```js
// apply：拦截函数调用
const p3 = new Proxy(function(){}, {
  apply: (t, thisArg, args) => 'applied:' + args.join(','),
});
p3(1, 2);              // 'applied:1,2'  ✅

// construct：拦截 new
const p4 = new Proxy(function(){}, {
  construct: (t, args) => ({ built: args }),
});
new p4(1, 2);          // { built: [1, 2] }  ✅
```

**⚠️ `Object.keys` 不触发 `get`**：

```js
const p = new Proxy(target, { get(t, k) { console.log('get', k); return t[k]; } });
Object.keys(p);        // 不打印任何 get  ← 实测
// 它触发的是 ownKeys + getOwnPropertyDescriptor
```

### 7.6.5 Proxy 拦不住的三个东西

| 拦不住 | 说明 |
|---|---|
| **`typeof`** | `typeof proxy` 永远等于 `typeof target` |
| **`===` / `==`** | 代理对象和原对象**不相等**（`proxy !== target`），且无法拦截 |
| **对象的内部槽**（部分） | 比如 `Map`/`Set`/`Date` 的方法，直接代理会报 `incompatible receiver` |

**第三条是个大坑**：

```js
const map = new Map();
const p = new Proxy(map, {});
p.set('a', 1);         // ❌ TypeError: Method Map.prototype.set called on incompatible receiver
```

**原因**：`Map.prototype.set` 需要 `this` 是「真正的 Map」（有 `[[MapData]]` 内部槽），而 Proxy 不是。

**解法**：在 `get` 里把方法绑回原对象：

```js
const p = new Proxy(map, {
  get(t, k) {
    const v = Reflect.get(t, k);
    return typeof v === 'function' ? v.bind(t) : v;
  },
});
```

### 7.6.6 Vue 2 vs Vue 3 的响应式对比

| 维度 | Vue 2（defineProperty） | Vue 3（Proxy） |
|---|---|---|
| **新增/删除属性** | ❌ 要 `Vue.set` / `Vue.delete` | ✅ 自动 |
| **数组索引/长度** | ❌ 要重写 7 个方法 | ✅ 自动 |
| **初始化性能** | ❌ 递归遍历所有属性 | ✅ 惰性代理 |
| **深层对象** | ❌ 一次递归到底 | ✅ 访问时才代理 |
| **Map/Set** | ❌ 不支持 | ✅ 支持 |
| **`class` 字段** | 部分场景有问题 | ✅ 正常 |
| **兼容性** | ✅ IE11 | ❌ 不支持 IE |
| **`===` 比较** | ✅ 原对象 | ⚠️ 代理对象，`obj === proxy` 为 false |

**最后一行是 Vue 3 的一个实际痛点**：拿到的 `state` 是 Proxy，和原始对象不相等，某些库（比如依赖 `===` 的）会出问题。Vue 3 提供了 `toRaw()` 拿原对象。

---

## 7.7 Reflect

### 7.7.1 为什么需要 Reflect

**核心问题：`Proxy` 的 trap 里怎么「执行默认行为」？**

```js
const p = new Proxy(obj, {
  get(t, k, receiver) {
    // 我想在记录日志后，走「原本的 get 行为」
    // ❌ obj[k] 不行：如果 t 自己也是 Proxy 会递归
    // ❌ t[k] 也不完美：丢失了 receiver
    // ✅ Reflect.get(t, k, receiver)
  },
});
```

**`Reflect` 就是「对象操作的函数式版本」**，和 Proxy 的 13 个 trap **一一对应**。

### 7.7.2 对应关系

| Proxy trap | Reflect 方法 |
|---|---|
| `get` | `Reflect.get(t, k, receiver)` |
| `set` | `Reflect.set(t, k, v, receiver)` |
| `has` | `Reflect.has(t, k)` |
| `deleteProperty` | `Reflect.deleteProperty(t, k)` |
| `ownKeys` | `Reflect.ownKeys(t)` |
| `getOwnPropertyDescriptor` | `Reflect.getOwnPropertyDescriptor(t, k)` |
| `defineProperty` | `Reflect.defineProperty(t, k, desc)` |
| `getPrototypeOf` | `Reflect.getPrototypeOf(t)` |
| `setPrototypeOf` | `Reflect.setPrototypeOf(t, proto)` |
| `isExtensible` | `Reflect.isExtensible(t)` |
| `preventExtensions` | `Reflect.preventExtensions(t)` |
| `apply` | `Reflect.apply(fn, thisArg, args)` |
| `construct` | `Reflect.construct(Ctor, args)` |

### 7.7.3 `Reflect` 相比 Object 的四个优势

| 优势 | 说明 |
|---|---|
| **① 返回值更合理** | `Reflect.defineProperty` 返回 boolean；`Object.defineProperty` 失败时**抛错** |
| **② 不抛错** | `Reflect.deleteProperty` 失败返回 false；`delete obj.x` 严格模式抛错 |
| **③ 支持 `receiver`** | `Reflect.get(t, k, receiver)` 能让 getter 的 `this` 是 receiver（关键！） |
| **④ 函数式** | 可以 `const fn = Reflect.get; fn(...)`（`Object.xxx` 也可以但语义不同） |

**第 ③ 条最重要**——这是「继承场景下 getter 的 `this` 指向正确」的关键：

```js
const proto = {
  get x() { return this.y; },      // this 应该是「谁在访问」
};
const obj = Object.create(proto);
obj.y = 'from-obj';

obj.x;                                        // 'from-obj'  ✅
Reflect.get(proto, 'x', obj);                // 'from-obj'  ✅ 显式传 receiver
Object.getOwnPropertyDescriptor(proto, 'x').get.call(proto);   // undefined  ❌ this 是 proto
```

**实测确认**。**这就是为什么 Proxy 的 `get` trap 里必须用 `Reflect.get(t, k, receiver)`**——把 `receiver`（代理对象）传下去，getter 里的 `this` 才是正确的。

---

## 7.8 常见坑

| 坑 | 正确说法 |
|---|---|
| 用普通对象当「有序字典」 | 整数键会被提前排序，用 `Map` |
| 直接 `JSON.stringify(map)` | 返回 `{}`，要先 `[...map]` 或 `Object.fromEntries` |
| 用 `'key' in obj` 判断字典有没有某个键 | 会被原型链干扰（`'toString' in {}` 是 true），用 `Object.hasOwn` 或 `Object.create(null)` |
| 以为 `WeakMap` 有 `size` | 没有，因为依赖 GC 无法确定 |
| 以为 `WeakMap` 可以遍历 | 不能，逻辑必然而非缺陷 |
| 用 `WeakMap` 存原始值做 key | 报 TypeError，key 必须是对象 |
| 以为 `Symbol` 能真私有 | `Reflect.ownKeys` 能拿到 |
| 用 `Symbol` 做需要序列化的值 | JSON 会忽略 Symbol 键 |
| 以为 Proxy 能拦 `===` | ❌ 拦不住；且 `proxy !== target` |
| 以为 Proxy 能拦 `typeof` | ❌ 永远等于 target 的 typeof |
| 直接代理 `Map`/`Set`/`Date` | 会报 `incompatible receiver`，要在 `get` 里 `bind` |
| Proxy trap 里用 `t[k]` 而不是 `Reflect.get` | 丢失 `receiver`，getter 的 `this` 会错 |
| 以为 `defineProperty` 能监听新增属性 | ❌ 不能，这就是 Vue 2 要 `Vue.set` 的原因 |
| 以为 Vue 3 的 `state === 原对象` | ❌ 是 Proxy，要用 `toRaw()` |

---

## 7.9 答题模板

### 30 秒版（Map vs Object）

> 七个差异，最关键三个：**键的类型**——Map 可以是任意类型（对象、NaN），Object 只能是 string/Symbol；**顺序**——Map 严格保持插入顺序，Object 会把整数键提前并排序；**可迭代和 size**——Map 本身可迭代且有 O(1) 的 size，Object 要 `Object.keys().length`。
> 另外 Map 没有原型链污染（`'toString' in {}` 是 true 但 `map.has('toString')` 是 false），但 Map 不能 `JSON.stringify`（返回 `{}`）。
> 所以：需要非字符串键、严格顺序、频繁增删 → Map；需要序列化/简单配置对象 → Object。

### 30 秒版（Proxy vs defineProperty）

> `defineProperty` 有四个致命缺陷：**无法监听新增和删除属性**（所以要 `Vue.set`）、**无法监听数组索引和 length**（所以要重写 7 个数组方法）、**必须递归遍历所有属性**（初始化慢）、**只能定义一次**。
> Proxy 全都解决了：13 个 trap 能拦 `get`/`set`/`has`/`deleteProperty` 等，而且是**惰性代理**——只在访问到某一层时才代理那一层，初始化很快。Vue 3 就是因此从 `defineProperty` 换成 Proxy。
> 代价是 Proxy 不支持 IE，而且代理对象和原对象 `===` 不相等，Vue 3 要用 `toRaw()` 拿原对象。

### 2 分钟版（把元编程串起来讲，推荐）

> 我分「集合」和「元编程」两块说。
>
> **集合**这边，`Map` 和 `Object` 的关键差异是**键类型**和**顺序**。Object 的键只能是 string/Symbol，其他类型会被转成字符串——`o[{}]` 的键变成 `'[object Object]'`；而且**整数键会被提前并按数值排序**，`{3:'a',1:'b',2:'c'}` 的 `Object.keys` 是 `['1','2','3']`，而 Map 是 `[3,1,2]`。这个差异在实战里会咬人：比如统计字符频次，用对象时数字字符会被排序，导致「找第一个只出现一次的字符」答错。所以我一般说「Object 是数据结构，Map 是字典」。
>
> `WeakMap` 和 `WeakSet` 是弱引用版，所以**不能遍历、没有 size、没有 clear**——这不是设计缺陷，是逻辑必然，因为一旦能枚举就等于间接持有强引用。用途是「给对象附加数据但不阻止回收」，Vue 3 的依赖收集用的就是 `WeakMap`（`targetMap: WeakMap<target, Map<key, Set<effect>>>`）。
>
> **元编程**这边核心是 `Proxy` vs `defineProperty`。`defineProperty` 有四个坑：不能监听新增删除属性、不能监听数组索引和 length、必须递归所有属性、只能定义一次。这正是 Vue 2 需要 `Vue.set` 和重写 7 个数组方法的原因。Proxy 用 13 个 trap 全解决了，而且**惰性代理**——只在访问到某层时才代理那层，所以初始化性能好很多。
>
> 但 Proxy 有三个拦不住的东西：**`typeof`**、**`===`**、以及**对象的内部槽**。最后一条是个大坑——直接代理 `Map`/`Set`/`Date` 会报 `incompatible receiver`，因为它们的方法要求 `this` 是真正的实例，得在 `get` trap 里把方法 `bind` 回原对象。
>
> 最后 `Reflect`，它是「对象操作的函数式版本」，和 Proxy 的 13 个 trap 一一对应。**为什么必须搭配用**：在 trap 里要执行「默认行为」，用 `t[k]` 会丢 `receiver`（导致 getter 的 `this` 错），用 `Reflect.get(t, k, receiver)` 才能把 receiver 传下去。这也是 Proxy 里写 `Reflect.set` 必须返回它的布尔结果的原因——否则 `set` 会静默失败。

### 追问表

| 追问 | 回答要点 |
|---|---|
| Map 和 Object 最关键差异 | 键类型（任意 vs string/Symbol）、顺序（插入 vs 整数键排序） |
| 为什么对象当字典有顺序问题 | 整数键会被提前并按数值排序 |
| Map 能 JSON 序列化吗 | 不能，返回 `{}` |
| `'toString' in {}` 为什么是 true | 继承自 `Object.prototype`，用 `Object.hasOwn` 或 `Object.create(null)` |
| WeakMap 为什么没有 size | 依赖 GC，无法给确定值；能枚举就等于强引用 |
| WeakMap 的 key 可以是原始值吗 | 不能，必须对象 |
| Vue 3 为什么用 WeakMap | 依赖收集，target 卸载后能自动回收 |
| Symbol 能真私有吗 | 不能，`Reflect.ownKeys` 能拿到 |
| Symbol 有什么实际用途 | 避免键冲突、定义协议（`Symbol.iterator` 等）、模拟私有 |
| defineProperty 四个缺陷 | 新增删除、数组索引/length、递归、只能定义一次 |
| Vue 2 怎么绕过数组监听 | 重写 7 个数组方法 + `Vue.set` |
| Proxy 有几个 trap | 13 个 |
| Proxy 拦不住什么 | `typeof`、`===`、内部槽（Map/Set/Date 方法） |
| 代理 Map 为什么报错 | `incompatible receiver`，要 `bind` 回原对象 |
| Reflect 为什么必须搭配 Proxy | trap 里要执行默认行为，且要传 `receiver` |
| `Reflect.get` 的 receiver 有什么用 | 让 getter 里的 `this` 指向正确对象 |
| Vue 3 的 state 是原对象吗 | 不是，是 Proxy，用 `toRaw()` 拿原对象 |

---

## 7.10 速记卡

```
Map vs Object
  键类型：任意 / string+Symbol（其他转字符串）
  ★ 顺序：插入顺序 / 整数键提前并排序（{3,1,2} → '1','2','3'）
  size：O(1) / Object.keys().length（O(n)）
  可迭代：是 / 否
  原型污染：无 / 有（'toString' in {} 是 true）
  序列化：JSON 返回 {} / 正常
  选型：非字符串键/严格顺序/频繁增删 → Map；序列化/配置对象 → Object

Set
  SameValueZero：NaN==自己，0==-0；两个 {} 不合并
  O(1) has；可迭代；保持插入顺序
  交并差要手写（ES2025 才有原生）
  ★ 数组去重首选 [...new Set(arr)]；indexOf 去重会丢掉所有 NaN

WeakMap / WeakSet
  ★ 无 size / 无 clear / 不可迭代 —— 逻辑必然（能枚举就等于强引用）
  key 必须是对象
  用途：DOM 关联数据、memoize、私有数据、★ Vue3 依赖收集、打标记
  注意：GC 时机不确定，不能依赖立刻回收

Symbol
  唯一（Symbol('a') !== Symbol('a')）；Symbol.for 走全局注册表
  作键时：不在 Object.keys / for...in / JSON，但在 Reflect.ownKeys
  用途：避免冲突、协议钩子、模拟私有
  内置：iterator / asyncIterator / toPrimitive / hasInstance / toStringTag / species

Proxy vs defineProperty★
  defineProperty 四缺陷：
    ① 不能监听新增/删除（要 Vue.set）
    ② 不能监听数组索引和 length（要重写 7 个方法）
    ③ 必须递归所有属性（初始化慢）
    ④ 只能定义一次
  Proxy 13 trap：get set has deleteProperty ownKeys getOwnPropertyDescriptor
                defineProperty getPrototypeOf setPrototypeOf isExtensible
                preventExtensions apply construct
  Proxy 优势：全都能拦 + 惰性代理 + 不修改原对象
  Proxy 拦不住：typeof / === / 内部槽（Map/Set/Date 要 bind）
  代价：不支持 IE；proxy !== target（Vue3 用 toRaw）

Reflect
  对象操作的函数式版本，与 13 trap 一一对应
  优势：返回 boolean 不抛错 / 支持 receiver / 函数式
  ★ trap 里必须用 Reflect.get(t, k, receiver)，否则 getter 的 this 会错
  ★ set trap 要 return Reflect.set(...)，否则严格模式抛错
```
