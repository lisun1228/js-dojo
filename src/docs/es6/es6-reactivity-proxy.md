# 分册 03 · 响应式原理：Proxy 与 Object.defineProperty

> 覆盖题号：**13**（JS 监听对象属性变化有哪些方法）、**15**（`defineProperty` 和 `Proxy` 的区别）、**4**（`Proxy` 可以实现什么）
> 共 **3 题**，是 Vue2 / Vue3 差异的底层依据，也是「框架原理」类面试的必考题

---

## 目录

- [3.1 监听对象属性变化的四种方案（题 13）](#31-监听对象属性变化的四种方案题-13)
- [3.2 defineProperty 与 Proxy 的本质差异（题 15）](#32-defineproperty-与-proxy-的本质差异题-15)
- [3.3 Proxy 能做什么：13 个 trap 与实战场景（题 4）](#33-proxy-能做什么13-个-trap-与实战场景题-4)
- [3.4 本册答题模板汇总](#34-本册答题模板汇总)
- [3.5 速记卡与连环追问](#35-速记卡与连环追问)

---

## 3.1 监听对象属性变化的四种方案（题 13）

### 3.1.0 一句话结论

> 主流的只有两条路：**`Object.defineProperty` 劫持属性的 `getter/setter`**（Vue2）和 **`Proxy` 代理整个对象**（Vue3）。另外两条是历史方案：**脏检查**（AngularJS，靠对比新旧值）和**手动通知 / 发布订阅**（React 的 `setState`、Redux）。现代还有 `Proxy` 的变体写法（装饰器、`Object.observe` 已废弃）。

### 3.1.1 四种方案对照

| 方案 | 代表 | 原理 | 能否检测新增属性 | 能否检测数组 | 性能特征 |
|---|---|---|---|---|---|
| **`Object.defineProperty`** | Vue2 | 递归遍历，为每个属性定义 `get/set` | ❌ 需要 `$set` | 需重写 7 个方法 | 初始化时全量递归，开销大 |
| **`Proxy`** | Vue3 | 代理整个对象，拦截 13 种操作 | ✅ | ✅ | 惰性（访问到才代理），初始开销小 |
| **脏检查** | AngularJS | 每轮 `$digest` 遍历所有 `watcher` 对比新旧值 | ✅ | ✅ | O(n) 每轮，watcher 多时卡 |
| **手动通知 / 不可变** | React、Redux | 每次 `setState` 创建新对象，靠引用变化判断 | ✅ | ✅ | 依赖浅比较，大对象浅比较也会慢 |

### 3.1.2 方案一：`Object.defineProperty`（Vue2 的思路）

```js
// 最基础的单个属性劫持
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
    // 这里就是"通知依赖更新"的钩子 → Vue 的 dep.notify()
  },
});

data.count;      // 打印"读取 count"
data.count = 2;  // 打印"设置 count: 2"
```

**Vue2 的完整流程（简化）**：

```js
// 1. 递归遍历 data，为每个属性 defineReactive
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
    set(newVal) {
      if (newVal === val) return;
      val = newVal;
      observe(newVal);               // 新值是对象也要递归
      dep.notify();                  // 通知所有 watcher 更新
    },
  });
}
```

**三个绕不过去的缺陷**：

```js
// ① 新增属性检测不到
const vm = { obj: { a: 1 } };
observe(vm.obj);
vm.obj.b = 2;          // ❌ 没有 getter/setter，视图不更新
// 必须用 Vue.set(vm.obj, 'b', 2) → 内部调用 defineReactive 补上劫持

// ② 删除属性检测不到
delete vm.obj.a;       // ❌ 视图不更新
// 必须用 Vue.delete(vm.obj, 'a')

// ③ 数组的索引和 length 不行
const arr = [1, 2, 3];
observe(arr);
arr[0] = 100;          // ❌ 检测不到（Vue2 故意不劫持索引，性能太差）
arr.length = 1;        // ❌ 检测不到
arr.push(4);           // ✅ 可以（Vue2 重写了 7 个数组方法）
```

**Vue2 为什么重写数组方法？**

因为数组的索引访问（`arr[0]`）如果每个都 `defineProperty`，成本极高（一个大数组几百个元素就崩了），而且 `length` 是**不可配置属性**，根本无法劫持。所以 Vue2 采用"**拦截会修改数组的方法**"的策略：

```js
// Vue2 重写的 7 个方法
const methodsToPatch = [
  'push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse',
];

methodsToPatch.forEach((method) => {
  const original = Array.prototype[method];
  Object.defineProperty(arrayProto, method, {
    value: function mutator(...args) {
      const result = original.apply(this, args);
      const ob = this.__ob__;
      let inserted;
      if (method === 'push' || method === 'unshift') inserted = args;
      else if (method === 'splice') inserted = args.slice(2);
      if (inserted) ob.observeArray(inserted);   // 新插入的元素也要劫持
      ob.dep.notify();                           // 通知更新
      return result;
    },
    enumerable: false,
    writable: true,
    configurable: true,
  });
});
```

> **注意**：这是**修改数组实例的原型链**（`arr.__proto__` 指向一个被改过的 `arrayProto`），不是改 `Array.prototype` 全局。这样只影响被 observe 过的数组。

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

1. **新增 / 删除属性自动可检测**——因为拦截的是对象的操作，不是属性
2. **数组直接可监听**——`arr[0] = 1`、`arr.length = 0` 都能拦到
3. **惰性**——只代理第一层，嵌套对象在**访问时才代理**，初始化开销小

```js
// Vue3 的惰性代理
const state = reactive({ a: { b: { c: 1 } } });
// 此时只有 state 被代理，a 和 b 还是普通对象

state.a;        // ← 读 a 时，返回值被 reactive() 包一层（proxyRefs/reactive 缓存）
state.a.b;      // ← 再包一层
// 每一层只在被访问时才创建代理 → 深层但用不到的数据零开销
```

### 3.1.4 方案三：脏检查（AngularJS）

```js
// 极简脏检查
function digest(watchers) {
  let dirty = true;
  let ttl = 10;                     // 最多循环 10 次，防止死循环
  while (dirty && ttl-- > 0) {
    dirty = false;
    for (const w of watchers) {
      const newVal = w.getter();
      if (newVal !== w.last) {
        w.last = newVal;
        w.listener(newVal, w.last);
        dirty = true;               // 有变化就再跑一轮
      }
    }
  }
}
```

**特点**：

- ✅ 不入侵数据，任何赋值都能检测（包括 `arr[0] = x`）
- ❌ 每轮 `$digest` 要遍历**所有** watcher，watcher 越多越慢
- ❌ 必须手动触发 `$apply()`（`setTimeout` 里改数据不会自动更新）
- ❌ 无法知道"哪个数据变了"，只知道"某一轮有变化"

> **一句话总结脏检查**：它是"**穷举对比**"，用算力换实现简单。Vue 的 `getter/setter` 是"**精准通知**"，用内存换性能。

### 3.1.5 方案四：手动通知 / 不可变数据（React 路线）

```js
// React：靠 setState 显式触发，靠引用比较判断是否变化
setState({ count: 1 });   // 内部合并 + 调度重渲染

// Redux：reducer 返回新对象，靠引用变化判断
const next = { ...state, count: state.count + 1 };
// next !== state → 需要更新
```

**特点**：

- ✅ 数据是普通对象，没有代理开销
- ✅ 变化可预测、可回溯（时间旅行调试）
- ❌ 需要手动处理不可变更新（深层嵌套很啰嗦）
- ❌ 依赖浅比较，对象层级深时容易漏更新（所以要用 `useMemo`/`memo`）

### 3.1.6 还有个"民间方案"：自己写 getter/setter

```js
// Vue2 之前的老做法：手写访问器
const data = {
  _count: 0,
  get count() { return this._count; },
  set count(v) {
    this._count = v;
    render();     // 手动通知
  },
};
```

**问题**：要写两倍代码，且新增属性依然无法自动处理。这就是为什么框架要用 `defineProperty` 自动生成。

### 3.1.7 答题模板

**30 秒版：**

> "主流有四种。**Vue2 用 `Object.defineProperty`** 递归给每个属性定义 `get/set`，读的时候收集依赖、写的时候通知更新；**Vue3 用 `Proxy`** 代理整个对象，能监听新增/删除属性和数组变化；**AngularJS 用脏检查**，每轮 `$digest` 遍历所有 watcher 对比新旧值；**React 是手动通知**，靠 `setState` 显式触发，配合不可变数据做引用比较。
> 现在新项目基本都是 `Proxy` 路线，因为 `defineProperty` 有三个硬伤：新增属性、删除属性、数组索引都检测不到。"

**2 分钟版补充：**

> "可以补两个细节：
> 一是**Vue2 对数组的处理**。它没有劫持数组索引，因为性能太差，而且 `length` 是不可配置属性根本劫持不了。所以它改成**重写 7 个会修改数组的方法**（`push/pop/shift/unshift/splice/sort/reverse`），在方法内部手动 `notify`。这也是为什么 `arr[0] = x` 在 Vue2 里不更新。
> 二是**性能模型不同**。`defineProperty` 是"初始化时全量递归"，一个深层大对象初始化就很慢；`Proxy` 是"惰性代理"，只在访问到某个属性时才代理它的值，深层但没被访问的数据零开销。这是 Vue3 首屏性能提升的一个来源。"

### 3.1.8 追问表

| 追问 | 答题要点 |
|---|---|
| 一共几种方案？ | 4 种：`defineProperty`、`Proxy`、脏检查、手动通知 |
| Vue2 为什么不用 `Proxy`？ | 当时 `Proxy` 刚出（ES6），浏览器支持不全，且无法 polyfill，要兼容 IE |
| Vue3 为什么不用 `defineProperty`？ | 三个硬伤：新增/删除属性、数组；且全量递归初始化慢 |
| Vue2 的 `$set` 做了什么？ | 对新增属性调用 `defineReactive` 补上 `get/set`，再 `notify` |
| Vue2 重写了哪些数组方法？ | 7 个：`push/pop/shift/unshift/splice/sort/reverse` |
| Vue2 为什么能监听 `push`？ | 改的是数组**实例的原型**，不是全局 `Array.prototype` |
| 脏检查为什么慢？ | 每轮遍历所有 watcher，O(n)，且无法定位变化源 |
| React 为什么不需要 `Proxy`？ | 它靠显式 `setState` 触发，不需要自动追踪 |
| `Proxy` 能完全替代 `defineProperty` 吗？ | 功能上可以，但兼容性不行（无法 polyfill） |
| 还有别的方案吗？ | `Object.observe`（已废弃）、`MutationObserver`（只能监听 DOM） |

---

## 3.2 defineProperty 与 Proxy 的本质差异（题 15）

### 3.2.0 一句话结论

> **`Object.defineProperty` 是"改属性"，`Proxy` 是"换对象"。** 前者只能对**已存在的属性**定义 `getter/setter`，是**静态的、逐个的**；后者创建一个**代理对象**，拦截对这个对象的所有操作，是**动态的、整体的**。这一个根本差异，推导出了所有其他区别。

### 3.2.1 五个本质差异

| 维度 | `Object.defineProperty` | `Proxy` |
|---|---|---|
| **拦截粒度** | **属性级**：给每个属性单独定义描述符 | **对象级**：拦截 13 种内部操作 |
| **新增属性** | ❌ 检测不到（属性还没被定义过） | ✅ 自动拦截 `set` |
| **删除属性** | ❌ 检测不到 | ✅ 拦截 `deleteProperty` |
| **数组** | 索引需逐个定义（性能不可接受），`length` 不可配置，只能重写方法 | ✅ 直接拦截索引和 `length` |
| **拦截范围** | 只有 `get`/`set`（本质是 2 种） | 13 种：`get/set/has/deleteProperty/ownKeys/...` |
| **初始化成本** | **高**：必须递归遍历整棵对象树 | **低**：惰性，访问到才代理下一层 |
| **返回值** | 返回**原对象** | 返回**新代理对象**（`proxy !== target`） |
| **兼容性** | ES5，IE9+ | ES6，**无法 polyfill** |
| **性能** | 单次读写略快（原生访问器） | 有 trap 调用开销，但初始化省 |

### 3.2.2 差异的根源：为什么 `defineProperty` 检测不到新增属性

```js
const obj = { a: 1 };

// 只给 a 装上了"陷阱"
Object.defineProperty(obj, 'a', {
  get() { console.log('read a'); return 1; },
  set(v) { console.log('write a'); },
});

obj.a = 2;      // ✅ 打印 'write a'
obj.b = 3;      // ❌ 没有任何输出 —— b 上根本没有陷阱

// 为什么？因为 defineProperty 是"在属性上动手脚"，不是"在对象上装门卫"
// 新增属性这个动作，属性还不存在，无从下手
```

```js
// Proxy 是"在对象外面装门卫"，任何操作都要过门卫
const proxy = new Proxy(obj, {
  set(target, key, value) {
    console.log('write', key);
    target[key] = value;
    return true;
  },
});

proxy.b = 3;    // ✅ 打印 'write b'
```

**一句话记忆**：

> `defineProperty` 是**给每个房间装门锁**，新盖的房间（新属性）没有锁；
> `Proxy` 是**在大门口设岗**，无论进哪个房间都得过岗。

### 3.2.3 数组：差距最明显的地方

```js
// ===== defineProperty 处理数组 =====
const arr = [1, 2, 3];
arr.forEach((_, i) => {
  Object.defineProperty(arr, i, {
    get() { /* ... */ },
    set(v) { /* ... */ },
  });
});
// 问题 1：大数组要定义 N 次，性能崩
// 问题 2：arr.length = 0 完全拦不到
// 问题 3：arr.push(4) 新增的索引没有陷阱
```

```js
// ===== Proxy 处理数组 =====
const arrProxy = new Proxy([1, 2, 3], {
  get(t, k, r) { return Reflect.get(t, k, r); },
  set(t, k, v, r) {
    console.log('set', k, '=', v);
    return Reflect.set(t, k, v, r);
  },
});

arrProxy[0] = 100;    // 打印 'set 0 = 100'
arrProxy.length = 1;  // 打印 'set length = 1'
arrProxy.push(4);     // 内部会 set '3' 和 'length'
```

> **Vue3 为什么能"直接"支持数组？** 因为 `push` 内部就是 `arr[arr.length] = x`，而 `Proxy` 能拦到索引赋值和 `length` 赋值。Vue2 只能靠重写 `push` 方法。

### 3.2.4 三个必须讲的实现细节

#### 细节 1：`receiver` 参数与 `Reflect`

这是 `Proxy` 最容易写错的地方，也是"懂不懂"的分水岭：

```js
// ❌ 错误写法：直接用 target[key]
const bad = new Proxy({}, {
  get(target, key) {
    return target[key];      // 如果 target 有 getter，this 会是 target，不是 proxy
  },
});

// ✅ 正确写法：Reflect + receiver
const good = new Proxy({}, {
  get(target, key, receiver) {
    return Reflect.get(target, key, receiver);   // receiver 让 getter 里的 this 指向 proxy
  },
});
```

**为什么必须传 `receiver`？**

```js
const target = {
  _private: 1,
  get value() {
    return this._private;      // 这里的 this 是谁？
  },
};

const p = new Proxy(target, {
  get(t, k, r) {
    console.log('拦截读取:', k);
    return Reflect.get(t, k, r);
  },
});

p.value;
// 若 get 里写 target[key]  → getter 里 this === target → 读 _private 不经过代理
// 若传 receiver（=p）      → getter 里 this === p     → 读 _private 也经过代理
```

**结论**：不传 `receiver`，**getter 内部的属性访问会绕过代理**，导致依赖收集漏掉、响应式断裂。这就是 Vue3 源码里到处是 `Reflect.get(target, key, receiver)` 的原因。

#### 细节 2：`Proxy` 的 trap 必须遵守"不变量"

```js
const frozen = Object.freeze({ a: 1 });

const bad = new Proxy(frozen, {
  get() { return 999; },     // ❌ 违反不变量：不可配置、不可写属性必须返回真实值
});

bad.a;   // TypeError: 'get' on proxy: property 'a' is a read-only and non-configurable
```

**规则**：对于**不可配置 + 不可写**的属性，`get` 必须返回真实值，否则抛 `TypeError`。这是为了保证代理的透明性——不能让代理"凭空创造"一个已冻结属性的值。

#### 细节 3：`Proxy` 无法代理内置对象的"内部槽"

这是 Vue3 源码里专门处理 `Map`/`Set` 的原因：

```js
const map = new Map([['a', 1]]);
const p = new Proxy(map, {});

p.get('a');
// ❌ TypeError: Method Map.prototype.get called on incompatible receiver #<Map>
// 因为 map.get 内部的 this 是 proxy，而 proxy 不是真正的 Map（没有 [[MapData]] 内部槽）
```

**修复方式**：`get` 时把 `this` 绑回 `target`，并递归代理返回值（Vue3 的 `collectionHandlers` 就是这么做的）：

```js
const p = new Proxy(map, {
  get(target, key, receiver) {
    const value = Reflect.get(target, key, target);   // ← this 用 target
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
p.get('a');   // ✅ 1
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
dataA.user.name = 'Jerry';   // ✅ 触发（因为递归过了）
dataA.user.age = 18;         // ❌ 不触发（新增属性）
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
dataB.user.name = 'Jerry';   // ✅
dataB.user.age = 18;         // ✅ 新增也能触发
delete dataB.user.name;      // ✅ 删除也能触发
```

### 3.2.6 Proxy 的四个局限（答出来显水平）

| 局限 | 说明 |
|---|---|
| **无法 polyfill** | ES5 时代没有任何 API 能拦截任意属性访问，`Object.defineProperty` 只能模拟 `get/set` 一部分。所以 **Vue3 不支持 IE11** 是技术必然，不是选择 |
| **不能拦截严格相等** | `proxy === target` 永远是 `false`，无法拦截。如果代码里有 `if (obj === someRef)` 这种判断，传入 proxy 会失效 |
| **不能拦截私有字段** | `class A { #x }` 里 `this.#x` 的访问完全绕过 `get` trap |
| **内置对象需特殊处理** | `Map`/`Set`/`Date`/`RegExp` 的方法依赖内部槽（`[[MapData]]` 等），`this` 是 proxy 会报错，必须手动绑回 `target` |
| **性能开销** | 每次属性访问都过一层函数调用，高频读写的场景比原生对象慢（Vue3 用 `shallowRef`/`markRaw` 规避） |

### 3.2.7 答题模板

**30 秒版：**

> "最本质的区别是**粒度不同**：`defineProperty` 是给**属性**装 `getter/setter`，`Proxy` 是给**整个对象**装代理。
> 这导致三个直接后果：`defineProperty` **检测不到新增和删除属性**，所以 Vue2 需要 `$set`/`$delete`；**数组要重写 7 个方法**，因为索引逐个劫持性能太差、`length` 又不可配置；而 `Proxy` 能直接拦截 `set`/`deleteProperty`，数组也不用特殊处理。
> 另外 `Proxy` 是**惰性**的，访问到才代理下一层，初始化比 `defineProperty` 的全量递归快得多。代价是 `Proxy` **无法 polyfill**，这也是 Vue3 不支持 IE11 的根本原因。"

**2 分钟版补充：**

> "再补两个实现层面的点：
> 一是 `Proxy` 的 `get` trap 里必须用 `Reflect.get(target, key, receiver)`，**必须传 `receiver`**。因为对象如果有 getter，getter 里的 `this` 默认会指向 `target`，那样 getter 内部的属性访问就绕过代理了，依赖收集会漏。传 `receiver` 才能让 `this` 指向 proxy。
> 二是 `Proxy` 不能直接代理 `Map`/`Set`。因为 `map.get` 依赖内部的 `[[MapData]]` 槽，`this` 是 proxy 时会报 `incompatible receiver`。Vue3 的做法是把 `this` 绑回 `target`，再对返回值单独做响应式处理。"

### 3.2.8 追问表

| 追问 | 答题要点 |
|---|---|
| 最本质的区别？ | 属性级 vs 对象级 |
| `defineProperty` 为什么检测不到新增属性？ | 陷阱装在已存在的属性上，新属性没有 |
| Vue2 怎么解决新增属性？ | `Vue.set` 内部补 `defineReactive` |
| Vue2 为什么重写数组方法？ | 索引劫持性能差 + `length` 不可配置 |
| `Proxy` 为什么能监听数组？ | 拦截 `set`，`push` 内部就是索引赋值 |
| `Proxy` 的性能优势在哪？ | 惰性代理，初始不递归 |
| `Proxy` 的性能劣势在哪？ | 每次读写都有 trap 开销 |
| `Reflect` 有什么用？ | 提供 trap 对应的默认行为，且能正确传递 `receiver` |
| 为什么 `get` 里要传 `receiver`？ | 让 getter 的 `this` 指向 proxy，否则绕过代理 |
| `Proxy` 能代理 `Map` 吗？ | 能但需特殊处理（`this` 绑回 target） |
| `Proxy` 不能拦截什么？ | `===`、私有字段 `#x`、某些内部槽操作 |
| 为什么 Vue3 不支持 IE11？ | `Proxy` 无法 polyfill |
| `defineProperty` 能被 `Proxy` 完全替代吗？ | 功能上可以，兼容性上不行 |
| `defineProperty` 还有什么用途？ | 定义不可枚举属性、getter/setter、`Object.freeze` 的底层 |

---

## 3.3 Proxy 能做什么：13 个 trap 与实战场景（题 4）

### 3.3.0 一句话结论

> `Proxy` 能**拦截并自定义对象的所有基本操作**——读写属性、判断存在、删除、枚举、函数调用、`new`、原型操作等共 **13 种**。典型用途有：**响应式系统**（Vue3）、**数据校验**、**默认值/负索引**、**私有属性**、**日志与埋点**、**不可变数据**、**懒加载**、**Mock**。配套的 `Reflect` 提供每种操作的默认行为。

### 3.3.1 13 个 trap 全表

| # | trap | 拦截的操作 | 对应 `Reflect` |
|---|---|---|---|
| 1 | `get` | `obj.key`、`obj[key]`、`Reflect.get` | `Reflect.get` |
| 2 | `set` | `obj.key = v`、`Reflect.set` | `Reflect.set` |
| 3 | `has` | `'key' in obj` | `Reflect.has` |
| 4 | `deleteProperty` | `delete obj.key` | `Reflect.deleteProperty` |
| 5 | `ownKeys` | `Object.keys`、`for...in`、`JSON.stringify`、`Object.getOwnPropertyNames` | `Reflect.ownKeys` |
| 6 | `getOwnPropertyDescriptor` | `Object.getOwnPropertyDescriptor`、`for...in` 的可枚举判断 | `Reflect.getOwnPropertyDescriptor` |
| 7 | `defineProperty` | `Object.defineProperty` | `Reflect.defineProperty` |
| 8 | `getPrototypeOf` | `Object.getPrototypeOf`、`instanceof`、`obj.__proto__` | `Reflect.getPrototypeOf` |
| 9 | `setPrototypeOf` | `Object.setPrototypeOf` | `Reflect.setPrototypeOf` |
| 10 | `isExtensible` | `Object.isExtensible` | `Reflect.isExtensible` |
| 11 | `preventExtensions` | `Object.preventExtensions` | `Reflect.preventExtensions` |
| 12 | `apply` | `fn()`、`fn.apply`、`fn.call` | `Reflect.apply` |
| 13 | `construct` | `new fn()` | `Reflect.construct` |

> **注意**：`in` 走 `has`，但 `for...in` 走 `ownKeys` + `getOwnPropertyDescriptor` 组合。`instanceof` 会走 `getPrototypeOf`（这是很多人不知道的细节）。

### 3.3.2 `Reflect` 存在的意义（常被追问）

```js
// ① 语义统一：把 Object 上零散的内部方法归到一个命名空间
Reflect.get / Reflect.set / Reflect.has / Reflect.deleteProperty ...
// 之前分散在：obj[key] / obj[key]=v / 'k' in obj / delete obj[k]
// 这些都不是函数，无法作为"默认行为"来调用

// ② 返回值更合理
Object.defineProperty(obj, 'x', { value: 1 });   // 失败抛错或返回 obj
Reflect.defineProperty(obj, 'x', { value: 1 });  // 返回 boolean

// ③ 接收 receiver，能正确传递 this
Reflect.get(target, key, receiver)

// ④ 与 Proxy trap 一一对应 → 写 trap 时的"默认行为"就是 Reflect 同名方法
const p = new Proxy(t, {
  get: (t, k, r) => Reflect.get(t, k, r),   // 完美的透明代理
});

// ⑤ 用 Reflect 替代 `with` 做动态取值
Reflect.get(obj, dynamicKey);   // 比 obj[dynamicKey] 更"函数式"
```

### 3.3.3 八个实战场景（每个都能当项目经验讲）

#### 场景 1：响应式（Vue3 的核心）

```js
function reactive(target) {
  return new Proxy(target, {
    get(t, k, r) {
      track(t, k);
      const v = Reflect.get(t, k, r);
      return typeof v === 'object' && v !== null ? reactive(v) : v;
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

user.age = 18;    // ✅
user.age = -1;    // ❌ TypeError: 字段 age 不合法
```

#### 场景 3：默认值 / 负索引

```js
// 访问不存在的属性返回默认值（配置对象很好用）
function withDefault(target, defaultValue) {
  return new Proxy(target, {
    get(t, k, r) {
      return k in t ? Reflect.get(t, k, r) : defaultValue;
    },
  });
}
const config = withDefault({ timeout: 3000 }, 0);
console.log(config.timeout);   // 3000
console.log(config.retries);   // 0

// 负索引（arr[-1] 取最后一个）—— 类似 Python
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
console.log(a[-1]);   // 3
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
      if (blocked.has(k)) return false;    // 对外隐藏
      return Reflect.has(t, k);
    },
    ownKeys(t) {
      return Reflect.ownKeys(t).filter((k) => !blocked.has(k));
    },
  });
}

const api = protect({ _secret: 'x', name: 'api' }, ['_secret']);
console.log(api.name);      // 'api'
console.log(api._secret);   // ❌ Error
console.log(Object.keys(api));  // ['name']  ← _secret 被隐藏
```

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

// 也可以做成"方法耗时统计"
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
state.count = 1;   // ❌ Error: 不可修改
```

> 对比 `Object.freeze` 的优势：`freeze` 是**静默失败**（非严格模式）且**递归**要手动做，`Proxy` 可以抛错 + 只读一层。

#### 场景 7：懒加载 / 虚拟模块

```js
// 按需加载模块，第一次访问才 import
function lazyModule(loader) {
  let mod = null;
  return new Proxy({}, {
    get(_, key) {
      if (!mod) {
        throw new Error('请先 await 初始化');   // 或者改成同步加载
      }
      return mod[key];
    },
  });
}

// 更实用的：按需计算
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

#### 场景 8：Mock 数据 / 链式 API

```js
// 万能 Mock：任意属性名都返回一个函数，无限链式
function mock() {
  const fn = () => mock();
  return new Proxy(fn, {
    get(t, k) {
      if (k === 'then') return undefined;   // 避免被当成 thenable
      return mock();
    },
    apply() {
      return mock();
    },
  });
}

const api = mock();
api.user.get(1).name;   // 不会报错，返回另一个 mock
```

### 3.3.4 `apply` 与 `construct`：代理函数

```js
// 代理函数调用（AOP 切面）
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
new ProxyPerson('Tom');   // 打印日志 + 返回实例
console.log(new ProxyPerson('A') instanceof Person);   // true（newTarget 保留）
```

> **`construct` 的第三个参数 `newTarget` 很关键**：不传它，`instanceof` 会失效（实例的原型变成 `target.prototype` 但因为用的是 proxy，某些场景会错）。

### 3.3.5 答题模板

**30 秒版：**

> "`Proxy` 能拦截对象的 **13 种基本操作**，包括读（`get`）、写（`set`）、判断存在（`has`）、删除（`deleteProperty`）、枚举（`ownKeys`）、原型操作，以及函数调用（`apply`）和 `new`（`construct`）。
> 典型用途是**响应式**（Vue3 就是用它重写响应式的）、**数据校验**（`set` 里做规则检查）、**默认值/负索引**、**私有属性保护**、**日志埋点**、**不可变数据**。
> 配套的 `Reflect` 提供每种 trap 的默认行为，而且能正确传递 `receiver`，写 trap 时基本都用 `Reflect.xxx(...)` 兜底。"

**2 分钟版补充：**

> "举两个我觉得实用的：
> 一个是**数据校验**，在 `set` trap 里跑 schema，非法值直接抛错，比在每个赋值处写 `if` 干净得多。
> 另一个是**不可变数据**，`set`/`deleteProperty` 直接抛错，比 `Object.freeze` 好在能抛错提醒、也能只冻结一层。
> 要注意 `Proxy` 有三个局限：不能拦截 `===`、不能拦私有字段 `#x`、`Map`/`Set` 这类内置对象的方法依赖内部槽，`this` 是 proxy 会报错，得把 `this` 绑回 target。"

### 3.3.6 追问表

| 追问 | 答题要点 |
|---|---|
| `Proxy` 有几个 trap？ | 13 个 |
| `in` 走哪个 trap？ | `has` |
| `for...in` 走哪些 trap？ | `ownKeys` + `getOwnPropertyDescriptor` |
| `instanceof` 走哪个 trap？ | `getPrototypeOf` |
| `JSON.stringify` 走哪些？ | `ownKeys` + `get` + `getOwnPropertyDescriptor` |
| `Reflect` 存在的意义？ | 提供 trap 的默认行为；统一 API；支持 `receiver` |
| 为什么 trap 里要用 `Reflect` 而不是直接操作 target？ | 能正确处理 `receiver` 和返回值语义 |
| `Proxy` 能代理函数吗？ | 能，用 `apply` 和 `construct` trap |
| `Proxy` 能代理 class 吗？ | 能（class 也是函数），但要处理 `construct` 的 `newTarget` |
| `Proxy` 能拦截 `===` 吗？ | 不能 |
| `Proxy` 能拦截私有字段吗？ | 不能，`#x` 完全绕过 |
| `Proxy.revocable` 是什么？ | 创建一个可撤销的代理，`revoke()` 后所有操作报错（可用于临时授权） |
| 代理套代理有问题吗？ | 有，多层代理性能下降且容易出 bug（Vue3 用 `WeakMap` 缓存避免重复代理） |
| trap 必须遵守什么？ | 不变量（如不可配置属性不能报告为不存在） |
| 为什么 Vue3 用 `WeakMap` 缓存代理？ | 避免同一对象被重复代理，导致 `proxy1 !== proxy2` |

---

## 3.4 本册答题模板汇总

### 3.4.1 一句话版

```
⑬ 监听方案     → defineProperty(Vue2) / Proxy(Vue3) / 脏检查(Angular) / 手动通知(React)
⑮ 两者区别     → 属性级 vs 对象级；新增删除数组能否监听；初始化成本；能否 polyfill
④ Proxy 场景   → 13 trap；响应式、校验、默认值、私有、日志、不可变、懒加载、Mock
```

### 3.4.2 把三题串起来（面试收尾用）

> "这三题其实是一个递进关系：
> **第 13 题问"有几种办法"**——答案是四条路，各有取舍；
> **第 15 题问"最好的两条路差在哪"**——本质是"改属性"还是"换对象"，一个粒度差异推导出所有行为差异；
> **第 4 题问"Proxy 还能干什么"**——因为它拦的是**语言层面的操作**，所以凡是需要"在对象操作前后插一脚"的场景都能用。
>
> 一句话总结：**`defineProperty` 是给属性加钩子，`Proxy` 是给对象换身份。** 前者精确但静态，后者通用但重。"

---

## 3.5 速记卡与连环追问

### 3.5.1 速记卡

```
【四种监听方案】
  defineProperty  Vue2   递归装 get/set   新增/删除/数组索引 ❌
  Proxy           Vue3   代理整个对象      全部 ✅，惰性
  脏检查          AngularJS  $digest 遍历 watcher 对比    慢但无入侵
  手动通知        React      setState + 不可变引用比较

【Vue2 三个硬伤】
  新增属性 ❌ → Vue.set
  删除属性 ❌ → Vue.delete
  数组索引/length ❌ → 重写 7 个方法 push/pop/shift/unshift/splice/sort/reverse

【defineProperty vs Proxy】
  粒度      属性  vs  对象
  拦截数    2（get/set）  vs  13
  新增/删除  ❌  vs  ✅
  数组      ❌  vs  ✅
  初始化    全量递归（慢）  vs  惰性（快）
  返回值    原对象  vs  新代理
  兼容      ES5 / IE9+  vs  ES6 / 无法 polyfill

【Proxy 三个实现要点】
  ① get 里用 Reflect.get(target, key, receiver) —— receiver 不能省
  ② Map/Set/Date 要把 this 绑回 target
  ③ 必须遵守不变量（不可配置属性不能谎报）

【Proxy 局限】不能拦 ===、不能拦 #私有字段、无法 polyfill、有 trap 开销

【13 trap 高频】get / set / has / deleteProperty / ownKeys / apply / construct
```

### 3.5.2 连环追问

| # | 追问 | 关键答点 |
|---|---|---|
| 1 | JS 监听对象变化有几种方式？ | 4 种：`defineProperty`、`Proxy`、脏检查、手动通知 |
| 2 | Vue2 为什么不用 `Proxy`？ | 当年 `Proxy` 支持不全 + 无法 polyfill + 要兼容 IE |
| 3 | Vue3 为什么不用 `defineProperty`？ | 新增/删除/数组三大硬伤 + 全量递归慢 |
| 4 | `Vue.set` 做了什么？ | 补 `defineReactive` + `notify` |
| 5 | Vue2 重写了哪 7 个数组方法？ | `push/pop/shift/unshift/splice/sort/reverse` |
| 6 | Vue2 改的是谁的 `prototype`？ | 数组**实例**的原型，不是全局 `Array.prototype` |
| 7 | 脏检查为什么慢？ | 每轮遍历所有 watcher，O(n) |
| 8 | `defineProperty` 和 `Proxy` 最本质区别？ | 属性级 vs 对象级 |
| 9 | `defineProperty` 为什么检测不到新增？ | 陷阱装在已存在的属性上 |
| 10 | `Proxy` 为什么能监听数组？ | 拦截 `set`，索引赋值也走它 |
| 11 | `Proxy` 性能好在哪？ | 惰性代理，初始不递归 |
| 12 | `Reflect` 有什么用？ | trap 的默认行为 + 正确传 `receiver` |
| 13 | `get` trap 为什么必须传 `receiver`？ | 让 getter 里 `this` 指向 proxy，否则绕过代理 |
| 14 | `Proxy` 能代理 `Map` 吗？ | 需特殊处理，`this` 绑回 `target` |
| 15 | `Proxy` 不能拦截什么？ | `===`、私有字段、内置对象的内部槽 |
| 16 | 为什么 Vue3 不支持 IE11？ | `Proxy` 无法 polyfill |
| 17 | `Proxy` 有几个 trap？ | 13 个 |
| 18 | `in` 走哪个 trap？ | `has` |
| 19 | `instanceof` 走哪个 trap？ | `getPrototypeOf` |
| 20 | `for...in` 走哪些 trap？ | `ownKeys` + `getOwnPropertyDescriptor` |
| 21 | `Proxy` 能代理函数吗？ | 能，`apply` / `construct` |
| 22 | `Proxy.revocable` 有什么用？ | 可撤销代理，用于临时授权 |
| 23 | Vue3 为什么用 `WeakMap` 缓存代理？ | 避免重复代理导致 `p1 !== p2` |
| 24 | `shallowRef` 和 `Proxy` 什么关系？ | 只响应 `.value` 整体替换，不深度代理 |
| 25 | `markRaw` 解决什么问题？ | 标记对象永不被代理（如第三方实例、大组件对象） |
| 26 | 不可变数据用 `Proxy` 还是 `freeze`？ | `Proxy` 能抛错、能只冻结一层；`freeze` 是静默失败 |
| 27 | trap 的"不变量"是什么？ | 代理不能违背目标对象的不可配置属性状态 |
| 28 | `Proxy` 会影响 `JSON.stringify` 吗？ | 会，走 `ownKeys` + `get` |
| 29 | `Proxy` 能做 AOP 吗？ | 能，`apply` trap 加前后置逻辑 |
| 30 | 除了 Vue3，还有什么库用 `Proxy`？ | MobX（部分）、Immer（`produce` 用 Proxy 记录变更）、`vueuse` 的工具函数 |
