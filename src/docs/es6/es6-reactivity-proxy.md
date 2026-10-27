# 分册 03 · 响应式原理：Proxy 与 Object.defineProperty

> 覆盖题号：**13**（JS 监听对象属性变化有哪些方法）、**15**（`defineProperty` 和 `Proxy` 的区别）、**4**（`Proxy` 可以实现什么）
> 共 **3 题**，是 Vue2 / Vue3 响应式差异的底层依据

---

## 目录

- [3.1 监听对象属性变化的四种方案](#31-监听对象属性变化的四种方案)
- [3.2 defineProperty 与 Proxy 的本质差异](#32-defineproperty-与-proxy-的本质差异)
- [3.3 Proxy 能做什么：13 个 trap 与实战场景](#33-proxy-能做什么13-个-trap-与实战场景)
- [3.4 本册答题模板汇总](#34-本册答题模板汇总)
- [3.5 速记卡与连环追问](#35-速记卡与连环追问)

---

## 3.1 监听对象属性变化的四种方案

### 3.1.0 一句话结论

> 主流只有两条：**`Object.defineProperty` 劫持属性的 `getter/setter`**（Vue2）和 **`Proxy` 代理整个对象**（Vue3）。另外两条是旁路方案：**脏检查**（AngularJS，对比新旧值）和**手动通知 / 不可变数据**（React、Redux）。`Object.observe` 曾尝试原生监听，已废弃；`MutationObserver` 只能监听 DOM。

### 3.1.1 四种方案对照

| 方案 | 代表 | 原理 | 新增属性 | 数组索引 / length | 性能特征 |
|---|---|---|---|---|---|
| **`Object.defineProperty`** | Vue2 | 递归遍历，为每个属性定义 `get/set` | ❌ 需要 `$set` | ❌ 需要重写方法 | 初始化时全量递归 |
| **`Proxy`** | Vue3 | 代理整个对象，拦截 13 种操作 | ✅ | ✅ | 只包第一层，嵌套按需再代理 |
| **脏检查** | AngularJS | 每轮 `$digest` 遍历所有 `watcher` 对比新旧值 | ✅ | ✅ | 每轮 O(n)，watcher 多时慢 |
| **手动通知 / 不可变** | React、Redux | 每次 `setState` 创建新对象，靠引用变化判断 | ✅ | ✅ | 依赖浅比较 |

### 3.1.2 方案一：`Object.defineProperty`（Vue2 的思路）

```js
const data = {};
let _value = 1;

Object.defineProperty(data, 'count', {
  enumerable: true,
  configurable: true,
  get() {
    console.log('读取 count');
    return _value;
  },
  set(newVal) {
    console.log('设置 count:', newVal);
    _value = newVal;
    // 这里是"通知依赖更新"的钩子 → Vue 的 dep.notify()
  },
});

data.count;      // 打印"读取 count"
data.count = 2;  // 打印"设置 count: 2"
```

**Vue2 的完整流程（简化）**：

```js
function observe(obj) {
  if (typeof obj !== 'object' || obj === null) return;
  Object.keys(obj).forEach((key) => defineReactive(obj, key, obj[key]));
}

function defineReactive(obj, key, val) {
  observe(val);                    // 递归子对象
  const dep = new Dep();           // 每个属性一个依赖收集器
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get() {
      if (Dep.target) dep.depend();  // 收集当前 watcher
      return val;
    },
    set(next) {
      if (next === val) return;
      val = next;
      observe(next);                 // 新值是对象也要递归
      dep.notify();                  // 通知所有 watcher 更新
    },
  });
}
```

**三个绕不过去的缺陷**：

```js
const vm = { obj: { a: 1 } };
observe(vm.obj);
vm.obj.b = 2;      // 不触发：b 上没有 getter/setter，必须 Vue.set
delete vm.obj.a;   // 不触发，必须 Vue.delete

const arr = [1, 2, 3];
observe(arr);
arr[0] = 100;      // 不触发
arr.length = 1;    // 不触发
arr.push(4);       // 在 Vue2 中触发（它重写了 7 个方法；上面的简化 observe 不含这步）
```

数组索引逐个 `defineProperty` 成本高；`length` 的 `configurable` 为 `false`，不能改成访问器（实测 `Object.defineProperty([], 'length', { get() {} })` 抛 `TypeError: Cannot redefine property: length`）。Vue2 因此改为**拦截会修改数组的方法**：

```js
const arrayProto = Object.create(Array.prototype);

['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'].forEach((method) => {
  const original = Array.prototype[method];
  Object.defineProperty(arrayProto, method, {
    value(...args) {
      const result = original.apply(this, args);
      notify(this, method, args);   // Vue2 里是 this.__ob__.dep.notify()
      return result;
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });
});
```

把被 observe 过的数组的 `__proto__` 指向 `arrayProto`，只影响这些实例，不改全局 `Array.prototype`。

### 3.1.3 方案二：`Proxy`（Vue3 的思路）

```js
function reactive(target) {
  return new Proxy(target, {
    get(target, key, receiver) {
      track(target, key);                        // 收集依赖
      return Reflect.get(target, key, receiver);
    },
    set(target, key, value, receiver) {
      const old = target[key];
      const result = Reflect.set(target, key, value, receiver);
      if (old !== value) trigger(target, key);    // 触发更新
      return result;
    },
    deleteProperty(target, key) {
      const had = Object.hasOwn(target, key);
      const result = Reflect.deleteProperty(target, key);
      if (had) trigger(target, key);
      return result;
    },
  });
}
```

**三个"天生"的优势**：

1. **新增 / 删除属性可检测**——拦截的是对象操作，不是属性
2. **数组直接可监听**——`arr[0] = 1`、`arr.length = 0` 都能拦到
3. **嵌套对象按需代理**——`Proxy` 本身只包第一层，Vue3 在 `get` 里把对象返回值再包一层并缓存

```js
const state = reactive({ a: { b: { c: 1 } } });
// 此时只有 state 是代理，a、b 仍是普通对象

state.a;        // get('a') 触发，返回值被 reactive() 包一层
state.a.b;      // 再包一层
```

### 3.1.4 方案三：脏检查（AngularJS）

```js
function digest(watchers) {
  let dirty = true;
  let ttl = 10;                     // 最多循环 10 次，防止死循环
  while (dirty && ttl-- > 0) {
    dirty = false;
    for (const w of watchers) {
      const next = w.getter();
      if (next !== w.last) {
        const prev = w.last;
        w.last = next;
        w.listener(next, prev);
        dirty = true;               // 有变化就再跑一轮
      }
    }
  }
}
```

**特点**：

- ✅ 不入侵数据，任何赋值都能检测（包括 `arr[0] = x`）
- ❌ 每轮 `$digest` 要遍历**所有** watcher，watcher 越多越慢
- ❌ 必须手动触发一轮 digest（`setTimeout` 里改数据不会自动更新）
- ❌ 只知道"这一轮有变化"，不知道是哪个数据变了

> 脏检查是"**穷举对比**"，用算力换实现简单；`getter/setter` 是"**精准通知**"，用内存换性能。

### 3.1.5 方案四：手动通知 / 不可变数据（React 路线）

```js
// React：靠 setState 显式触发，靠引用比较判断是否变化
setState({ count: 1 });

// Redux：reducer 返回新对象，靠引用变化判断
const next = { ...state, count: state.count + 1 };
// next !== state → 需要更新
```

**特点**：

- ✅ 数据是普通对象，没有代理开销
- ✅ 变化可预测、可回溯（时间旅行调试）
- ❌ 深层嵌套的不可变更新很啰嗦
- ❌ 依赖浅比较，层级深时容易漏更新（需要 `memo` / `useMemo`）

### 3.1.6 还有个"民间方案"：自己写 getter/setter

```js
const data = {
  _count: 0,
  get count() { return this._count; },
  set count(v) {
    this._count = v;
    render();     // 手动通知
  },
};
```

每个属性都要手写一对访问器，新增属性仍需手动补。框架用 `defineProperty` 自动生成，就是为了消掉这份重复。

### 3.1.7 答题模板

- 主流两套：`defineProperty` 是**属性级**劫持，`Proxy` 是**对象级**代理。
- `defineProperty` 三处检测不到：新增属性、删除属性、数组索引 / `length`；Vue2 用 `$set` / `$delete` 和重写 7 个数组方法补齐。
- 脏检查每轮遍历所有 watcher 对比新旧值，慢但不入侵数据；React 靠 `setState` + 不可变引用。
- 性能模型不同：Vue2 初始化时递归整棵对象树；Vue3 只代理第一层，在 `get` 里按需代理嵌套对象。

### 3.1.8 追问表

| 追问 | 答题要点 |
|---|---|
| 一共几种方案？ | 4 种：`defineProperty`、`Proxy`、脏检查、手动通知 |
| Vue2 为什么不用 `Proxy`？ | 当时浏览器支持不全，且 `Proxy` 无法 polyfill，需要兼容 IE |
| Vue3 为什么不用 `defineProperty`？ | 新增 / 删除属性、数组索引都检测不到，且初始化要全量递归 |
| Vue2 的 `$set` 做了什么？ | 对新增属性调用 `defineReactive` 补上 `get/set`，再 `notify` |
| Vue2 重写了哪些数组方法？ | 7 个：`push/pop/shift/unshift/splice/sort/reverse` |
| Vue2 为什么能监听 `push`？ | 改的是数组**实例的原型**，不是全局 `Array.prototype` |
| 脏检查为什么慢？ | 每轮遍历所有 watcher，O(n)，且无法定位变化源 |
| React 为什么不需要 `Proxy`？ | 它靠显式 `setState` 触发，不需要自动追踪 |
| `Proxy` 能完全替代 `defineProperty` 吗？ | 功能上可以，兼容性不行（无法 polyfill） |
| 还有别的方案吗？ | `Object.observe`（已废弃）、`MutationObserver`（只能监听 DOM） |

---

## 3.2 defineProperty 与 Proxy 的本质差异

### 3.2.0 一句话结论

> **`Object.defineProperty` 是"改属性"，`Proxy` 是"换对象"。** 前者**逐个属性**定义 `getter/setter`，只覆盖被定义过的那几个属性；后者创建**代理对象**，拦截对这个对象的所有操作。前者静态、逐个，后者动态、整体。其他差异都由这一条推出。

### 3.2.1 差异对照

| 维度 | `Object.defineProperty` | `Proxy` |
|---|---|---|
| **拦截粒度** | **属性级**：给每个属性单独定义描述符 | **对象级**：拦截 13 种内部操作 |
| **新增属性** | ❌ 检测不到（属性还没被定义过） | ✅ 自动拦截 `set` |
| **删除属性** | ❌ 检测不到 | ✅ 拦截 `deleteProperty` |
| **数组** | 索引逐个定义成本高，`length` 不能改成访问器，只能重写方法 | ✅ 直接拦截索引和 `length` |
| **拦截范围** | 只有 `get`/`set`（本质是 2 种） | 13 种：`get/set/has/deleteProperty/ownKeys/...` |
| **初始化成本** | 高：要递归整棵对象树 | 低：只包第一层，嵌套按需代理 |
| **返回值** | 返回**原对象** | 返回**新代理对象**（`proxy !== target`） |
| **兼容性** | ES5，IE9+ | ES6，**无法 polyfill** |
| **单次访问开销** | 无 trap 调用 | 每次操作过一层 trap |

### 3.2.2 差异的根源：为什么 `defineProperty` 检测不到新增属性

```js
const obj = { a: 1 };

Object.defineProperty(obj, 'a', {
  get() { console.log('read a'); return 1; },
  set(v) { console.log('write a'); },
});

obj.a = 2;   // 'write a'
obj.b = 3;   // 无输出：b 上根本没有陷阱
```

`defineProperty` 是"在属性上动手脚"，新增属性时属性还不存在，无从下手。

```js
// Proxy 是"在对象外面装门卫"，任何操作都要过门卫
const proxy = new Proxy(obj, {
  set(target, key, value) {
    console.log('write', key);
    target[key] = value;
    return true;
  },
});

proxy.b = 3;   // 'write b'
```

**一句话记忆**：

> `defineProperty` 给每个房间装门锁，新盖的房间（新属性）没有锁；
> `Proxy` 在大门口设岗，无论进哪个房间都得过岗。

### 3.2.3 数组：差距最明显的地方

```js
// ===== defineProperty 处理数组 =====
const arr = [1, 2, 3];
arr.forEach((value, i) => {
  let current = value;
  Object.defineProperty(arr, i, {
    configurable: true,
    enumerable: true,
    get() { return current; },
    set(next) { current = next; },
  });
});
// 问题 1：大数组要定义 N 次
// 问题 2：arr.length = 1 拦不到（length 不是访问器）
// 问题 3：arr.push(4) 新增的索引 3 没有陷阱
```

```js
// ===== Proxy 处理数组 =====
const arrProxy = new Proxy([1, 2, 3], {
  get(t, k, r) { console.log('get', String(k)); return Reflect.get(t, k, r); },
  set(t, k, v, r) { console.log('set', String(k), '=', v); return Reflect.set(t, k, v, r); },
});

arrProxy[0] = 100;    // set 0 = 100
arrProxy.length = 1;  // set length = 1
arrProxy.push(4);     // get push → get length → set 1 = 4 → set length = 2
```

`push` 先读到原型上的方法，再走"索引赋值 + `length` 赋值"两步，所以两步都能拦到。Vue3 因此不需要重写数组方法；Vue2 只能靠方法拦截。

### 3.2.4 三个必须讲的实现细节

#### 细节 1：`receiver`、`Reflect` 与 `set` / `defineProperty` 的分工

```js
const target = {
  _private: 1,
  get value() { return this._private; },
};

const bad = new Proxy(target, {
  get(t, k) { return t[k]; },                    // getter 里 this === target
});

const good = new Proxy(target, {
  get(t, k, r) { return Reflect.get(t, k, r); }, // getter 里 this === good
});
```

实测 `bad.value` 只经过一次 `get` trap；`good.value` 会再经过一次 `_private` 的 `get` trap。**不传 `receiver`，getter 内部的属性访问会绕过代理**，依赖收集就会漏。

赋值和 `Object.defineProperty` 走的是两条不同的内部方法：

```js
p.x = 1;                                       // [[Set]]              → set trap
Object.defineProperty(p, 'x', { value: 1 });   // [[DefineOwnProperty]] → defineProperty trap
```

如果 target 自身或原型上有 setter，赋值会调用 setter；`Object.defineProperty` 直接替换属性描述符，不经过 setter（实测 setter 调用次数不变）。

`set` trap 里转发时还有一个容易忽略的点：

```js
const p = new Proxy({}, {
  set(t, k, v, r) { return Reflect.set(t, k, v, r); },        // receiver 是代理
  defineProperty(t, k, d) { return Reflect.defineProperty(t, k, d); },
});

p.x = 1;   // set → defineProperty
```

`Reflect.set` 收到 `receiver = 代理` 时，会以代理为 receiver 定义属性，于是再进一次 `defineProperty` trap；写成 `Reflect.set(t, k, v)`（receiver 默认是 target）或 `t[k] = v` 时只触发 `set`。

#### 细节 2：`Proxy` 的 trap 必须遵守"不变量"

```js
const frozen = Object.freeze({ a: 1 });
const bad = new Proxy(frozen, {
  get() { return 999; },
});

bad.a;
// TypeError: 'get' on proxy: property 'a' is a read-only and non-configurable data property
// on the proxy target but the proxy did not return its actual value (expected '1' but got '999')
```

实测会抛错的几类不变量：

- **不可配置 + 不可写**：`get` 必须返回原值；`set` 不能改成不同值。
- **不可配置**：`has` 不能报 `false`，`ownKeys` 必须包含该键，`deleteProperty` 不能返回成功。
- **目标不可扩展**：`ownKeys` 不能多报键，`has` 不能把已有属性报 `false`，`defineProperty` 不能加新属性。

这是为了保证代理的透明性——不能让代理凭空改写目标对象的锁定状态。

#### 细节 3：`Proxy` 代理内置对象时的内部槽问题

```js
const map = new Map([['a', 1]]);
const p = new Proxy(map, {});

p.get('a');
// TypeError: Method Map.prototype.get called on incompatible receiver #<Map>
```

`map.get` 内部的 `this` 是 proxy，而 proxy 没有 `[[MapData]]` 内部槽。`Set` 同理（`Set.prototype.has` 报同样的错）。

**修复方式**：`get` 时把 `this` 绑回 `target`；返回值是对象时同样按需再代理（下面只演示方法绑定）：

```js
const p2 = new Proxy(map, {
  get(target, key) {
    const value = Reflect.get(target, key, target);   // ← this 用 target
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
p2.get('a');   // 1
```

### 3.2.5 手写两个版本的"响应式"（对比最直观）

```js
// ========== 版本 A：defineProperty 版 ==========
function defineReactive(obj, key, val, onUpdate) {
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get() { return val; },
    set(next) {
      if (next === val) return;
      val = next;
      onUpdate(key, next);
    },
  });
}

function observeV2(obj, onUpdate) {
  Object.keys(obj).forEach((key) => {
    const val = obj[key];
    defineReactive(obj, key, val, onUpdate);
    if (typeof val === 'object' && val !== null) observeV2(val, onUpdate);  // 立即递归
  });
}

const dataA = { user: { name: 'Tom' } };
observeV2(dataA, (k, v) => console.log('更新:', k, v));
dataA.user.name = 'Jerry';   // 触发（已经递归过）
dataA.user.age = 18;         // 不触发（新增属性）
```

```js
// ========== 版本 B：Proxy 版 ==========
const cache = new WeakMap();

function observeV3(obj, onUpdate) {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (cache.has(obj)) return cache.get(obj);      // 避免重复代理

  const proxy = new Proxy(obj, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      return typeof value === 'object' && value !== null
        ? observeV3(value, onUpdate)               // 惰性：访问时才代理
        : value;
    },
    set(target, key, value, receiver) {
      const old = target[key];
      const ok = Reflect.set(target, key, value, receiver);
      if (old !== value) onUpdate(key, value);
      return ok;
    },
    deleteProperty(target, key) {
      const had = Object.hasOwn(target, key);
      const ok = Reflect.deleteProperty(target, key);
      if (had) onUpdate(key, undefined);
      return ok;
    },
  });

  cache.set(obj, proxy);
  return proxy;
}

const dataB = observeV3({ user: { name: 'Tom' } }, (k, v) => console.log('更新:', k, v));
dataB.user.name = 'Jerry';   // 触发
dataB.user.age = 18;         // 新增也能触发
delete dataB.user.name;      // 删除也能触发
```

### 3.2.6 Proxy 的局限

| 局限 | 说明 |
|---|---|
| **无法 polyfill** | ES5 没有 API 能拦截任意属性访问；需要兼容 IE 的项目不能用 `Proxy` |
| **`===` 失效** | `proxy !== target` 永远成立；`if (obj === someRef)` 传入代理会判断失败 |
| **私有字段不受拦截** | `#x` 不经过 `get` trap；方法以代理为 `this` 时读 `#x` 抛 `TypeError: Cannot read private member #x ...` |
| **内置对象需特殊处理** | `Map`/`Set`/`RegExp` 的方法依赖内部槽，`this` 是代理会报 `incompatible receiver`；`Date` 报 `this is not a Date object` |
| **trap 开销** | 每次属性访问都过一层函数调用，高频读写比原生对象慢（可用浅层代理或 `markRaw` 跳过） |

### 3.2.7 答题模板

- 最本质区别是**粒度**：`defineProperty` 给属性装 `getter/setter`，`Proxy` 给整个对象装代理。
- 三个直接后果：检测不到新增 / 删除属性（Vue2 需要 `$set`/`$delete`）；数组要重写 7 个方法；`Proxy` 能直接拦 `set`/`deleteProperty`。
- `Proxy` 只包第一层，嵌套对象在 `get` 里按需代理，初始化比全量递归快。
- 实现上 `get` 必须传 `receiver`；`Map`/`Set` 要把 `this` 绑回 target；代价是无法 polyfill。

### 3.2.8 追问表

| 追问 | 答题要点 |
|---|---|
| 最本质的区别？ | 属性级 vs 对象级 |
| `defineProperty` 为什么检测不到新增属性？ | 陷阱装在已存在的属性上，新属性没有 |
| Vue2 怎么解决新增属性？ | `Vue.set` 内部补 `defineReactive` |
| Vue2 为什么重写数组方法？ | 索引劫持性能差 + `length` 不可配置 |
| `Proxy` 为什么能监听数组？ | 拦截 `set`，`push` 内部就是索引赋值 + `length` 赋值 |
| `Proxy` 的性能优势在哪？ | 只代理第一层，嵌套对象访问时才继续代理 |
| `Proxy` 的性能劣势在哪？ | 每次读写都有 trap 开销 |
| `Reflect` 有什么用？ | 提供 trap 对应的默认行为，且能显式传递 `receiver` |
| 为什么 `get` 里要传 `receiver`？ | 让 getter 的 `this` 指向代理，否则 getter 内部访问绕过代理 |
| `Proxy` 能代理 `Map` 吗？ | 能，但方法要把 `this` 绑回 target |
| `Proxy` 不能拦截什么？ | `===`、私有字段 `#x`、内置对象的内部槽 |
| `defineProperty` 还有什么用途？ | 定义不可枚举属性、getter/setter、`Object.freeze` 的底层 |

---

## 3.3 Proxy 能做什么：13 个 trap 与实战场景

### 3.3.0 一句话结论

> `Proxy` 能**拦截并自定义对象的所有基本操作**——读写属性、判断存在、删除、枚举、函数调用、`new`、原型操作等共 **13 种**。典型用途：**响应式系统**、**数据校验**、**默认值 / 负索引**、**私有属性**、**日志埋点**、**不可变数据**、**懒加载**、**Mock**。配套的 `Reflect` 提供每种操作的默认行为。

### 3.3.1 13 个 trap 全表

| # | trap | 拦截的操作 | 对应 `Reflect` |
|---|---|---|---|
| 1 | `get` | `obj.key`、`obj[key]`、`Reflect.get` | `Reflect.get` |
| 2 | `set` | `obj.key = v`、`Reflect.set` | `Reflect.set` |
| 3 | `has` | `'key' in obj` | `Reflect.has` |
| 4 | `deleteProperty` | `delete obj.key` | `Reflect.deleteProperty` |
| 5 | `ownKeys` | `Object.keys`、`Object.getOwnPropertyNames`、`for...in`、`JSON.stringify` | `Reflect.ownKeys` |
| 6 | `getOwnPropertyDescriptor` | `Object.getOwnPropertyDescriptor`、`Object.keys` / `for...in` 的可枚举过滤 | `Reflect.getOwnPropertyDescriptor` |
| 7 | `defineProperty` | `Object.defineProperty` | `Reflect.defineProperty` |
| 8 | `getPrototypeOf` | `Object.getPrototypeOf`、`obj.__proto__`、`proxy instanceof F`（代理在左侧） | `Reflect.getPrototypeOf` |
| 9 | `setPrototypeOf` | `Object.setPrototypeOf` | `Reflect.setPrototypeOf` |
| 10 | `isExtensible` | `Object.isExtensible` | `Reflect.isExtensible` |
| 11 | `preventExtensions` | `Object.preventExtensions` | `Reflect.preventExtensions` |
| 12 | `apply` | `fn()`、`fn.apply`、`fn.call` | `Reflect.apply` |
| 13 | `construct` | `new fn()` | `Reflect.construct` |

实测触发顺序：

```
Object.keys(p)       → ownKeys → getOwnPropertyDescriptor
for...in             → ownKeys → getPrototypeOf → getOwnPropertyDescriptor
JSON.stringify(p)    → get('toJSON') → ownKeys → getOwnPropertyDescriptor → get
p instanceof F       → getPrototypeOf（p 是代理）
new Proxy(Fn)()      → construct → get('prototype')（构造器是代理时，instanceof 走 get）
```

### 3.3.2 `Reflect` 存在的意义（常被追问）

```js
// ① 语义统一：把零散的内部方法归到一个命名空间
//    Reflect.get / Reflect.set / Reflect.has / Reflect.deleteProperty / ...

// ② 返回值更合理
Object.defineProperty(obj, 'x', { value: 1 });   // 成功返回 obj，失败抛 TypeError
Reflect.defineProperty(obj, 'x', { value: 1 });  // 返回 boolean

// ③ 可以显式传 receiver，obj[key] 做不到
Reflect.get(target, key, receiver)

// ④ 与 Proxy trap 一一对应，写 trap 时的默认行为就是 Reflect 同名方法
const p = new Proxy(t, {
  get: (t, k, r) => Reflect.get(t, k, r),   // 透明代理
});
```

### 3.3.3 八个实战场景

#### 场景 1：响应式（Vue3 的核心）

骨架与 3.1.3 相同，关键是在 `get` 里对对象返回值继续代理：

```js
function reactive(target) {
  return new Proxy(target, {
    get(t, k, r) {
      track(t, k);
      const value = Reflect.get(t, k, r);
      return typeof value === 'object' && value !== null ? reactive(value) : value;
    },
    set(t, k, v, r) {
      const old = t[k];
      const ok = Reflect.set(t, k, v, r);
      if (old !== v) trigger(t, k);
      return ok;
    },
  });
}
```

没有缓存时 `state.a !== state.a`（每次读到新代理），生产实现要用 `WeakMap` 缓存。

#### 场景 2：数据校验（表单 / API 入参）

```js
function validated(schema) {
  return (target) =>
    new Proxy(target, {
      set(t, k, v) {
        const rule = schema[k];
        if (rule && !rule(v)) {
          throw new TypeError(`字段 ${k} 不合法: ${v}`);
        }
        t[k] = v;
        return true;
      },
    });
}

const user = validated({
  age: (v) => Number.isInteger(v) && v >= 0 && v <= 150,
  name: (v) => typeof v === 'string' && v.length > 0,
})({});

user.age = 18;    // ok
user.age = -1;    // TypeError: 字段 age 不合法: -1
```

#### 场景 3：默认值 / 负索引

```js
function withDefault(target, defaultValue) {
  return new Proxy(target, {
    get(t, k, r) {
      return k in t ? Reflect.get(t, k, r) : defaultValue;
    },
  });
}
const config = withDefault({ timeout: 3000 }, 0);
config.timeout;   // 3000
config.retries;   // 0
// 注意：已有属性的值为 undefined 时返回 undefined，不会落到默认值

function negativeIndex(arr) {
  return new Proxy(arr, {
    get(t, k, r) {
      const i = Number(k);
      if (Number.isInteger(i) && i < 0) return t[t.length + i];
      return Reflect.get(t, k, r);
    },
  });
}
const a = negativeIndex([1, 2, 3]);
a[-1];   // 3
```

#### 场景 4：私有属性保护

```js
function protect(target, privateKeys) {
  const blocked = new Set(privateKeys);
  return new Proxy(target, {
    get(t, k, r) {
      if (blocked.has(k)) throw new Error(`不允许访问私有属性: ${String(k)}`);
      return Reflect.get(t, k, r);
    },
    has(t, k) {
      if (blocked.has(k)) return false;
      return Reflect.has(t, k);
    },
    ownKeys(t) {
      return Reflect.ownKeys(t).filter((k) => !blocked.has(k));
    },
  });
}

const api = protect({ _secret: 'x', name: 'api' }, ['_secret']);
api.name;                 // 'api'
api._secret;              // Error: 不允许访问私有属性: _secret
Object.keys(api);         // ['name']
```

`ownKeys` 不能隐藏不可配置的属性，否则会抛 `TypeError: 'ownKeys' on proxy: trap result did not include 'a'`。

#### 场景 5：日志 / 埋点 / 调试

```js
function logged(target, label = 'obj') {
  return new Proxy(target, {
    get(t, k, r) {
      console.log(`[${label}] 读 ${String(k)}`);
      return Reflect.get(t, k, r);
    },
    set(t, k, v, r) {
      console.log(`[${label}] 写 ${String(k)} = ${v}`);
      return Reflect.set(t, k, v, r);
    },
    apply(t, thisArg, args) {
      console.log(`[${label}] 调用，参数:`, args);
      return Reflect.apply(t, thisArg, args);
    },
  });
}

function timed(fn) {
  return new Proxy(fn, {
    apply(t, thisArg, args) {
      const start = performance.now();
      try {
        return Reflect.apply(t, thisArg, args);
      } finally {
        console.log(`${t.name} 耗时 ${performance.now() - start}ms`);
      }
    },
  });
}
```

#### 场景 6：不可变数据（函数式风格）

```js
function immutable(target) {
  return new Proxy(target, {
    set() { throw new Error('不可修改'); },
    deleteProperty() { throw new Error('不可删除'); },
  });
}

const state = immutable({ count: 0 });
state.count = 1;   // Error: 不可修改
```

对比 `Object.freeze`：`freeze` 是**浅冻结**（嵌套对象仍可改），非严格模式赋值静默失败，严格模式才抛 `TypeError`；`Proxy` 可以显式抛错，也可以只拦一层。

#### 场景 7：懒加载 / 虚拟模块

```js
function lazy(target, compute) {
  const cache = new Map();
  return new Proxy(target, {
    get(t, k, r) {
      if (cache.has(k)) return cache.get(k);
      if (k in t) return Reflect.get(t, k, r);
      const value = compute(k);
      cache.set(k, value);
      return value;
    },
  });
}
```

首次访问触发 `compute`，之后命中 `cache`。模块懒加载也能用 `get` 拦截，但首个访问前拿不到同步值，通常还是用 `import()`。

#### 场景 8：Mock 数据 / 链式 API

```js
function mock() {
  const fn = () => mock();
  return new Proxy(fn, {
    get(t, k) {
      if (k === 'then') return undefined;   // 避免被 await 当成 thenable
      return mock();
    },
    apply() {
      return mock();
    },
  });
}

const api = mock();
typeof api.user.get(1).name;   // 'function'
```

### 3.3.4 `apply` 与 `construct`：代理函数

```js
function withLogging(fn) {
  return new Proxy(fn, {
    apply(target, thisArg, args) {
      console.log(`调用 ${target.name}(${args})`);
      return Reflect.apply(target, thisArg, args);
    },
    construct(target, args, newTarget) {
      console.log(`new ${target.name}(${args})`);
      return Reflect.construct(target, args, newTarget);
    },
  });
}

function add(a, b) { return a + b; }
const proxyAdd = withLogging(add);
proxyAdd(1, 2);      // 打印日志 + 返回 3

class Person { constructor(name) { this.name = name; } }
const ProxyPerson = withLogging(Person);
new ProxyPerson('A') instanceof Person;   // true

class Sub extends ProxyPerson {}
new Sub() instanceof Sub;                 // true（construct 里转发了 newTarget）
```

`newTarget` 是 `new` 表达式里实际被 new 的构造器。省略它时 `Reflect.construct` 会回退到 `target`：

```js
const P = new Proxy(Person, {
  construct(t, args) { return Reflect.construct(t, args); },  // 不转发 newTarget
});
class Sub2 extends P {}
new Sub2() instanceof Sub2;   // false：实例原型回退到 Person.prototype
```

### 3.3.5 答题模板

- `Proxy` 能拦截 **13 种**基本操作：`get`、`set`、`has`、`deleteProperty`、`ownKeys`、`getOwnPropertyDescriptor`、`defineProperty`、原型操作、`apply`、`construct` 等。
- 典型用途：响应式、数据校验、默认值 / 负索引、私有属性、日志埋点、不可变数据、懒加载、Mock。
- 配套 `Reflect` 提供每个 trap 的默认行为，并能正确传递 `receiver`。
- 实现注意：`Map`/`Set` 要把 `this` 绑回 target，trap 不能违反不变量。

### 3.3.6 追问表

| 追问 | 答题要点 |
|---|---|
| `Proxy` 有几个 trap？ | 13 个 |
| `in` 走哪个 trap？ | `has` |
| `for...in` 走哪些 trap？ | `ownKeys` + `getPrototypeOf` + `getOwnPropertyDescriptor` |
| `instanceof` 走哪个 trap？ | 代理在左侧走 `getPrototypeOf`；构造器是代理时走 `get('prototype')` |
| `JSON.stringify` 走哪些？ | `get('toJSON')` + `ownKeys` + `getOwnPropertyDescriptor` + `get` |
| `Reflect` 存在的意义？ | 提供 trap 的默认行为；统一 API；支持 `receiver` |
| 为什么 trap 里要用 `Reflect` 而不是直接操作 target？ | 能正确处理 `receiver` 和返回值语义 |
| `Proxy` 能代理函数 / class 吗？ | 能，用 `apply` 和 `construct`；class 要注意转发 `newTarget` |
| `Proxy` 能拦截 `===` 吗？ | 不能，`proxy !== target` |
| `Proxy` 能拦截私有字段吗？ | 不能，`#x` 不经过 trap；以代理为 this 访问会抛 TypeError |
| `Proxy.revocable` 是什么？ | 创建可撤销代理，`revoke()` 后所有操作抛错（可用于临时授权） |
| 代理套代理有问题吗？ | 有，trap 逐层叠加，性能下降；同一对象应复用代理 |
| trap 必须遵守什么？ | 不变量（如不可配置属性不能报告为不存在） |

---

## 3.4 本册答题模板汇总

### 3.4.1 一句话版

```
⑬ 监听方案     → defineProperty(Vue2) / Proxy(Vue3) / 脏检查(Angular) / 手动通知(React)
⑮ 两者区别     → 属性级 vs 对象级；新增删除数组能否监听；初始化成本；能否 polyfill
④ Proxy 场景   → 13 trap；响应式、校验、默认值、私有、日志、不可变、懒加载、Mock
```

### 3.4.2 把三题串起来（面试收尾用）

- **第 13 题问"有几种办法"**：四条路，各有取舍。
- **第 15 题问"最好的两条路差在哪"**：本质是"改属性"还是"换对象"，粒度差异推导出所有行为差异。
- **第 4 题问"Proxy 还能干什么"**：它拦的是语言层面的操作，凡是要在对象操作前后插一脚的场景都能用。

---

## 3.5 速记卡与连环追问

### 3.5.1 速记卡

```
【四种监听方案】
  defineProperty  Vue2   递归装 get/set   新增/删除/数组索引 ❌
  Proxy           Vue3   代理整个对象      全部 ✅，嵌套按需代理
  脏检查          AngularJS  $digest 遍历 watcher 对比    慢但无入侵
  手动通知        React      setState + 不可变引用比较

【Vue2 三个硬伤】
  新增属性 ❌ → Vue.set
  删除属性 ❌ → Vue.delete
  数组索引/length ❌ → 重写 7 个方法 push/pop/shift/unshift/splice/sort/reverse

【defineProperty vs Proxy】
  粒度      属性  vs  对象
  拦截数    get/set  vs  13
  新增/删除  ❌  vs  ✅
  数组      ❌  vs  ✅
  初始化    全量递归  vs  按需代理
  返回值    原对象  vs  新代理
  兼容      ES5 / IE9+  vs  ES6 / 无法 polyfill

【Proxy 实现要点】
  ① get 里用 Reflect.get(target, key, receiver)
  ② set 转发时注意 receiver 会再触发 defineProperty
  ③ Map/Set 方法把 this 绑回 target
  ④ trap 必须遵守不变量

【Proxy 局限】不能拦 ===、#私有字段、无法 polyfill、有 trap 开销

【13 trap 高频】get / set / has / deleteProperty / ownKeys / getOwnPropertyDescriptor / apply / construct
```

### 3.5.2 连环追问

| # | 追问 | 关键答点 |
|---|---|---|
| 1 | `Proxy.revocable` 怎么用？ | `const { proxy, revoke } = Proxy.revocable(t, h)`；`revoke()` 后任何操作抛 `TypeError: Cannot perform 'get' on a proxy that has been revoked` |
| 2 | 代理套代理有问题吗？ | trap 逐层叠加，性能下降；同一对象要用 `WeakMap` 缓存复用代理 |
| 3 | `shallowRef` / `markRaw` 和 Proxy 什么关系？ | `shallowRef` 只追踪 `.value` 整体替换；`markRaw` 标记对象跳过代理 |
| 4 | 不可变数据用 Proxy 还是 freeze？ | Proxy 能显式抛错、只拦一层；`freeze` 是浅冻结，非严格模式静默失败 |
| 5 | `Proxy` 能做 AOP 吗？ | 能，`apply` trap 加前后置逻辑 |
