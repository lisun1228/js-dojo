# ES6 三十二题 · 分册索引与「新特性」总览

> 原始题单：`13. ES6（32题）.md`（飞书导出）
> 拆分为 8 份文档，每份内部统一结构：**一句话结论 → 原理展开（含代码）→ 常见坑 → 面试怎么答（30 秒 / 2 分钟）→ 追问**
> 使用方法：先读本文的「分类地图」建立全局，再按你的薄弱域挑分册精读；考前只看本文的速记卡

---

## 目录

- [一、32 题分类地图](#一32-题分类地图)
- [二、本题单的 4 个结构问题（先说清楚）](#二本题单的-4-个结构问题先说清楚)
- [三、第 3 题：ES6 有什么新特性（本文详讲）](#三第-3-题es6-有什么新特性本文详讲)
- [四、ES 版本演进速查表（ES2015 → ES2025）](#四es-版本演进速查表es2015--es2025)
- [五、这道题的 5 种答法（按面试官意图选）](#五这道题的-5-种答法按面试官意图选)
- [六、一页速记卡](#六一页速记卡)
- [七、全局自测清单](#七全局自测清单)

---

## 一、32 题分类地图

题单是按「别人整理的顺序」排的，不是按知识依赖排的。下面按**知识域**重新归类，共 7 个域 + 1 个总览：

| 分册 | 知识域 | 覆盖题号 | 题数 | 核心考点 |
|---|---|---|---|---|
| **00**（本文） | 新特性总览 | 3 | 1 | 版本演进、分层表达 |
| **01** | 变量 / 作用域 / 闭包 / this | 1、19、24、25、29、31、23、27、28 | 9 | 执行上下文、作用域链、绑定规则 |
| **02** | 对象 / 原型 / 继承 | 9、32、5、14 | 4 | `new` 四步、原型链、class 本质、深浅拷贝 |
| **03** | 响应式原理：Proxy 与 defineProperty | 13、15、4 | 3 | 数据劫持两种方案、13 个 trap |
| **04** | 异步 / Promise / 事件循环 | 10、8、26、11、12、21 | 6 | 三态、并发控制、微任务时机 |
| **05** | 模块与工程化 | 6、2 | 2 | ESM vs CJS、HMR 机制 |
| **06** | 集合 / 迭代 / 数组扩展 | 17、18、16、22、7 | 5 | SameValueZero、弱引用、迭代协议 |
| **07** | 类型转换与隐式规则 | 30、20 | 2 | ToPrimitive、`==` 规则表 |

> **合计 32 题**（含 3 组重复题，去重后实际独立考点约 **26 个**）

### 按「面试出现频率」排序（建议投入时间）

```
★★★★★  1/19  let-const-var、29 this、31 闭包、32 原型链、21 事件循环、10/11/12 Promise
★★★★   23/27/28 箭头函数、15 defineProperty vs Proxy、30 ==/===、6 ESM vs CJS、9 new
★★★    5 class、14 浅拷贝、18 WeakMap、22 for-in/of、26 并发 vs 串行、8 all/race
★★      4 Proxy 场景、13 监听方案、24/25 作用域与调用栈、7 数组方法、16/17 Set
★       2 HMR、3 新特性、20 a==1&&a==2（偏趣味题）
```

### 推荐学习顺序

```
01（作用域与 this）→ 02（原型与对象）→ 03（响应式）→ 04（异步）→ 06（集合）→ 07（类型转换）→ 05（模块）
```

原因：`02 原型链`是 `05 class` 的前提；`03 Proxy` 依赖 `02 对象`；`04 Promise` 依赖 `01 闭包`；`07 隐式转换`依赖 `02 ToPrimitive`（对象转原始值走 `valueOf`）。

---

## 二、本题单的 4 个结构问题（先说清楚）

### 2.1 有三组重复题

| 重复组 | 处理方式 |
|---|---|
| **1 / 19**：let、const、var 的区别 | 合并进分册 01，第 19 题标注「见 1.1」 |
| **23 / 27**：箭头函数和普通函数的区别 | 合并进分册 01，第 27 题标注「见 1.6」 |
| **23 / 28**：箭头函数的 this | 28 是 23 的**子集**，但在面试里是独立追问，单独给一段「this 指向」作答模板 |

### 2.2 有三道题严格说不属于 ES6

| 题号 | 实际归属 | 说明 |
|---|---|---|
| **2. ES6 怎么热更新的** | **构建工具（Webpack/Vite）** | HMR 与 ES6 规范毫无关系。这题大概率是题库作者把「模块化 → 热更新」串在一起了 |
| **21. 事件循环** | **JS 运行时（HTML 规范 + Node）** | 属 JS 基础，不是 ES6 语法 |
| **13. 监听对象属性变化** | **响应式原理** | 横跨 `defineProperty`（ES5）和 `Proxy`（ES6） |

> **面试遇到这种「题不达意」的情况怎么办**：不要纠正面试官，先答，答完补一句「严格来说这块属于 XX，不是 ES6 语法本身，但工程里确实常放在一起问」——这句话本身就是加分项，说明你对知识边界清楚。

### 2.3 有三道题只给了「结论」没给「为什么」

题单里第 5、15、32 题的参考答案都是一句话概括，而这些恰好是面试最爱深挖的。分册 02、03 会把它们展开到源码/规范层面（比如 `class` 的 `[[ConstructorKind]]`、Proxy 的 `receiver` 参数为什么要传）。

### 2.4 第 20 题是「趣味题」，但考的是真知识

`(a==1 && a==2 && a==3)` 看似脑筋急转弯，实际考的是 **`ToPrimitive` 抽象操作 + `valueOf` 优先级**。能答出来不算厉害，能顺带说清「`==` 在对象 vs 原始值时先走哪条路径、hint 是什么」才是加分。详见分册 07。

---

## 三、第 3 题：ES6 有什么新特性（本文详讲）

### 3.0 一句话结论

> ES6（ES2015）是 JS 诞生以来最大的一次语言升级，一次性引入了 **块级作用域、箭头函数、类、模块、Promise、解构、迭代器/生成器、Proxy/Reflect、Symbol、Set/Map** 等一整套能力，把 JS 从「脚本语言」推到了「可以写大型工程的语言」。
> 面试回答的关键**不是报菜名，而是分层**——按「语法 → 数据 → 异步 → 模块 → 元编程」五层说，每层举 1 个你实际用过的例子。

### 3.1 为什么这题最容易答砸

大部分人的答法是背清单：

> "let const、箭头函数、模板字符串、解构、扩展运算符、默认参数、Promise、Class、Module、Generator、Set/Map、Symbol、Proxy/Reflect、可选链、空值合并……"

**问题有三**：

1. **混杂了版本**：`可选链`、`空值合并` 是 **ES2020**，不是 ES6。被追问「这是 ES6 吗」就露馅了。
2. **没有结构**：面试官听完记不住，也无法顺着问。
3. **没有体感**：全是名词，没有一个「解决了我什么实际问题」。

**正确做法**：先说一句「ES6 的新特性我一般按五层来看」，然后每层点名 2-3 个最关键的，最后落到「其中对我影响最大的是 X，因为……」

### 3.2 五层结构（推荐答题框架）

#### 第一层：语法糖 —— 让代码更短更安全

| 特性 | 解决的问题 | 一句话记忆 |
|---|---|---|
| `let` / `const` | `var` 的变量提升 + 函数作用域 + 循环捕获问题 | **块级作用域**，TDZ 兜住误用 |
| 箭头函数 | 回调里 `this` 丢失、`var that = this` | **词法 this**，写的时候定死 |
| 模板字符串 | 字符串拼接、多行文本 | 反引号 + `${}` |
| 解构赋值 | 从对象/数组取值要写好几行 | **按形状取值**，可设默认值、可重命名 |
| 默认参数 | `x = x \|\| 1` 的假值 bug（`0`/`''` 被误判） | 只在 `undefined` 时生效 |
| rest / spread | `arguments`、`apply`、数组合并 | `...` 一个符号两种语义（收集 / 展开） |
| `class` | 原型继承写法丑陋、易错 | **语法糖**，本质仍是原型 |
| 对象字面量增强 | `{a: a}` 冗余 | 属性简写、方法简写、计算属性名 |

```js
// 一眼看出「糖」有多甜：ES5 vs ES6
// ES5
var self = this;
function sum() {
  var nums = Array.prototype.slice.call(arguments);
  return nums.reduce(function (a, b) { return a + b; }, 0);
}
var obj = { name: name, sum: sum };

// ES6
const sum = (...nums) => nums.reduce((a, b) => a + b, 0);
const obj = { name, sum };
```

#### 第二层：数据能力 —— 原生就有合适的数据结构

| 特性 | 关键点 |
|---|---|
| `Set` / `Map` | `Set` 成员唯一（SameValueZero）；`Map` 键可以是任意类型、保持插入顺序、有 `size` |
| `WeakMap` / `WeakSet` | 键必须是对象、**弱引用**、不可枚举 → 天然适合做缓存和私有数据，不阻碍 GC |
| `Symbol` | 唯一且不可变的值，用作「不会冲突的属性键」；`Symbol.iterator` 是迭代协议的入口 |
| 数组扩展 | `Array.from`、`Array.of`、`find`、`findIndex`、`fill`、`copyWithin`、`entries/keys/values` |
| `Object` 静态方法 | `Object.assign`、`Object.is`（修掉 `NaN !== NaN` 和 `+0 === -0`） |
| 二进制与字符串 | `ArrayBuffer`/`TypedArray`、`String.prototype.includes/startsWith/endsWith/repeat` |

> **能加分的细节**：`Set` 判重的相等算法是 **SameValueZero**，所以 `new Set([NaN, NaN])` 只剩一个（这点和 `indexOf` 不同，`indexOf` 找不到 `NaN`）。详见分册 06。

#### 第三层：异步 —— 从回调到「同步写法」

这是 ES6 对工程影响**最大**的一层，必须重点讲：

```
回调函数（ES5）→ Promise（ES6）→ Generator + 执行器（ES6）→ async/await（ES2017）
```

| 特性 | 作用 |
|---|---|
| `Promise` | 三态不可逆；`.then` 解决「回调地狱」的**纵向嵌套**和**错误无法统一捕获** |
| `Generator` | `function*` + `yield`，可暂停/恢复的函数；`co` 库用它模拟 `await` |
| 迭代协议 | `for...of` 能遍历任何实现了 `Symbol.iterator` 的对象 |

> **面试话术**：「`async/await` 不是 ES6，是 ES2017。但它的底层就是 **Generator + 自动执行器 + Promise**，所以讲 ES6 的异步绕不开 Generator。」——把版本边界说清，同时展示你知道实现原理。

#### 第四层：模块化 —— JS 终于有了语言级模块

| 对比项 | ES Module（ES6） | CommonJS |
|---|---|---|
| 加载时机 | **编译时**静态分析 | 运行时 |
| 加载方式 | 异步 | 同步 |
| 导出值 | **值的引用**（活绑定） | 值的拷贝 |
| Tree-shaking | 支持 | 不支持 |
| 顶层 `this` | `undefined` | `module.exports` |

> 这是分册 05 的核心，这里只需一句带过：「ESM 是**静态**的，所以打包工具能做 tree-shaking，这是 ES6 对现代前端工程最大的贡献之一。」

#### 第五层：元编程 —— 能改写语言默认行为

| 特性 | 作用 |
|---|---|
| `Proxy` | 拦截对象的 13 种内部操作（`get`/`set`/`has`/`deleteProperty`/`apply`/`construct`…） |
| `Reflect` | 把 `Object` 上的内部方法搬到统一命名空间，**与 Proxy trap 一一对应**，作为「默认行为」的兜底 |
| `Symbol.toPrimitive`、`Symbol.iterator` 等 | 用 well-known symbol 定制对象在语言内部的行为 |

> 这是 Vue3 响应式的基石。`Proxy` 相比 `Object.defineProperty` 的核心优势：**能监听新增/删除属性、能直接监听数组、惰性劫持**。详见分册 03。

### 3.3 一个完整的代码对照（讲的时候可以直接写在纸上）

```js
// ============ ES5 时代 ============
function User(name, age) {
  this.name = name;
  this.age = age;
}
User.prototype.greet = function () {
  return 'Hi, ' + this.name;
};

var list = [1, 2, 3];
var doubled = list.map(function (n) { return n * 2; });

getUser(function (err, user) {
  if (err) return handle(err);
  getOrders(user.id, function (err, orders) {
    if (err) return handle(err);
    render(orders);   // 再深一层就成金字塔了
  });
});

// ============ ES6+ 时代 ============
class User {
  constructor(name, age) {
    this.name = name;
    this.age = age;
  }
  greet() {
    return `Hi, ${this.name}`;
  }
}

const doubled = [1, 2, 3].map((n) => n * 2);

try {
  const user = await getUser();
  const orders = await getOrders(user.id);
  render(orders);
} catch (e) {
  handle(e);
}
```

---

## 四、ES 版本演进速查表（ES2015 → ES2025）

> **背这张表的价值**：面试官问「你说的可选链是 ES6 吗」，你能立刻纠正并给出正确版本，可信度会明显上升。

| 版本 | 年份 | 关键新增（只列面试常问） |
|---|---|---|
| **ES2015（ES6）** | 2015 | `let/const`、箭头函数、模板字符串、解构、默认参数、rest/spread、`class`、`Promise`、`Generator`、`Module`、`Set/Map/WeakMap/WeakSet`、`Symbol`、`Proxy/Reflect`、`for...of`、`Object.assign`、`Array.from/of`、`String.includes` |
| ES2016 | 2016 | `Array.prototype.includes`、`**` 指数运算符 |
| ES2017 | 2017 | **`async/await`**、`Object.values/entries`、`String.padStart/padEnd`、`Object.getOwnPropertyDescriptors` |
| ES2018 | 2018 | 对象 rest/spread `{...obj}`、**`for await...of`**、`Promise.prototype.finally`、正则命名捕获/后行断言/`s` 标志 |
| ES2019 | 2019 | `Array.flat/flatMap`、`Object.fromEntries`、`String.trimStart/trimEnd`、可选 `catch` 绑定 `catch {}` |
| ES2020 | 2020 | **可选链 `?.`**、**空值合并 `??`**、`BigInt`、**动态 `import()`**、`Promise.allSettled`、`globalThis`、`import.meta` |
| ES2021 | 2021 | 逻辑赋值 `\|\|=` `&&=` `??=`、数字分隔符 `1_000_000`、`Promise.any`、`String.replaceAll`、`WeakRef` |
| ES2022 | 2022 | **class 字段 / 私有字段 `#x` / 静态块 `static {}`**、`Array.at`、`Object.hasOwn`、**顶层 await**、`Error.cause` |
| ES2023 | 2023 | `findLast/findLastIndex`、`toSorted/toReversed/toSpliced/with`（**不改原数组版**）、Hashbang |
| ES2024 | 2024 | `Object.groupBy`/`Map.groupBy`、`Promise.withResolvers`、正则 `v` 标志 |
| ES2025 | 2025 | `Set` 集合运算（`union/intersection/difference`）、`Promise.try`、迭代器助手（`map/filter/take`）、`RegExp.escape` |

> ⚠️ **注意**：`??` 和 `?.` 常被误认为是 ES6，实际是 **ES2020**。这是本题最高频的扣分点。

---

## 五、这道题的 5 种答法（按面试官意图选）

### 5.1 30 秒版（初面 / 电话面）

> "ES6 是 2015 年的版本，是 JS 最大的一次升级。我一般分五块看：
> **语法上**有 `let/const` 的块级作用域、箭头函数、模板字符串、解构和 `class`；
> **数据上**有 `Set/Map`、`WeakMap` 和 `Symbol`；
> **异步上**有 `Promise` 和 `Generator`；
> **模块上**有了语言级的 `import/export`，这是 tree-shaking 的前提；
> **元编程上**有 `Proxy/Reflect`，Vue3 的响应式就是基于它重写的。
> 对我影响最大的是 `Promise` 和 `模块化`，前者终结了回调地狱，后者让前端能真正做工程化拆分。"

**30 秒版的要点**：五层 + 每层 2-3 个 + 一句「影响最大的是什么」。**不要超过 8 个名词**。

### 5.2 2 分钟版（技术面，需要展开 2-3 个点）

结构：**定位（10 秒）→ 五层（60 秒）→ 深挖 2 个（40 秒）→ 收尾（10 秒）**

深挖建议挑这两个（最容易接着问，且你能答）：
1. **块级作用域**：讲 `var` 在 `for` 循环 + `setTimeout` 的经典问题，以及 `let` 的**每轮迭代新建绑定**
2. **Proxy 相比 defineProperty**：讲 Vue2 为什么需要 `$set`、Vue3 为什么能直接监听数组

### 5.3 如果面试官是 Vue/React 方向

**主动往框架上挂**，这是最好的加分方式：

| ES6 特性 | 框架里的体现 |
|---|---|
| `Proxy` | Vue3 响应式核心 |
| `defineProperty`（ES5） | Vue2 响应式核心，需 `$set` 补丁 |
| `WeakMap` | Vue3 的 `targetMap` 用 `WeakMap` 存 `target → depsMap`，target 被回收时依赖自动释放 |
| 模块化 | 组件按需加载、tree-shaking、`import()` 路由懒加载 |
| `Promise` | 路由守卫的异步鉴权、`async setup` |
| 解构 + 默认值 | `const { data = [] } = res` |
| `Symbol` | `Symbol.iterator` 让自定义对象可 `for...of`；Vue 内部用 `Symbol` 做标记位 |
| `class` | 早期 Vue2 的 `Vue.extend`、装饰器写法 |

### 5.4 如果面试官追问「你实际用过哪些」

**千万别再罗列**，改说场景：

> "用得最多的是三块：
> 一是**解构 + 默认值**做接口数据的兜底，避免 `a && a.b && a.b.c`；
> 二是 **`Promise.all` + 解构**处理无依赖的并发请求，比 `await` 串行快很多；
> 三是 **`Map` 替代对象做字典**，因为 `Map` 的键可以是对象、有序、有 `size`，而且不会像对象那样被原型链上的 `toString` 之类污染。"

### 5.5 如果面试官问「ES6 有什么缺点」

这是压力测试，答得出说明你有判断力：

| 问题 | 说明 |
|---|---|
| **兼容性** | ES6 需要 Babel 转译 + polyfill（`Promise`、`Set/Map`、`Symbol` 无法完全 polyfill，只能降级或引入 core-js） |
| **`Proxy` 无法 polyfill** | 这是 Vue3 不支持 IE11 的**根本原因**，不是「不想支持」 |
| **`class` 的误解成本** | 看着像 Java，实际仍是原型；`this` 绑定问题在 `class` 里更容易踩（方法传给回调就丢 `this`） |
| **新语法增加编译产物** | 转译后代码体积变大，`async/await` 在低版本需要 `regeneratorRuntime` |
| **`let` 的 TDZ 反而更"严厉"** | `typeof undeclaredVar` 返回 `'undefined'`，但 `typeof tdzVar` 直接抛 `ReferenceError` |

---

## 六、一页速记卡

```
【定位】ES2015，JS 史上最大升级，从脚本语言 → 工程语言

【五层】
 语法  let/const（块级+TDZ）、箭头函数（词法 this）、模板字符串、解构、默认参数、rest/spread、class（语法糖）
 数据  Set/Map（唯一/任意键）、WeakMap（弱引用、不阻碍 GC）、Symbol（唯一键）、Array.from/of、Object.assign/is
 异步  Promise（三态不可逆）、Generator（可暂停函数，async 的前身）
 模块  import/export（静态、异步、活绑定）→ tree-shaking 的前提
 元编程 Proxy（13 trap）、Reflect（默认行为兜底）→ Vue3 响应式基石

【版本红线】
  ES6=2015   async/await=ES2017    ?. 和 ??=ES2020    顶层 await=ES2022
  class 私有字段 #x=ES2022          Set 集合运算=ES2025

【高频追问】
  var vs let  → 作用域 + 提升 + 重复声明 + 全局挂载 + 循环绑定
  class 本质  → 原型继承 + 不可调用 + 方法不可枚举 + 严格模式
  Proxy 优势  → 增删属性可监听 + 数组直接监听 + 惰性劫持 + 无法 polyfill
  ESM 优势    → 静态分析 + 活绑定 + tree-shaking
```

---

## 七、全局自测清单

### 7.1 变量与作用域（分册 01）

- [ ] 说出 `var` / `let` / `const` 的 5 个差异（作用域、提升、重复声明、全局挂载、初始化）
- [ ] 解释 TDZ 是什么，`typeof tdzVar` 会怎样
- [ ] 解释为什么 `for (let i...)` + `setTimeout` 能输出 0/1/2，而 `var` 不行
- [ ] 说清 `const` 到底"不能改"的是什么
- [ ] 画出作用域链，并说明它与调用栈的区别
- [ ] 说出执行上下文的两个阶段、三个组成部分
- [ ] 说出 `this` 的 5 种绑定规则**及其优先级**
- [ ] 举 3 个「隐式丢失」的场景
- [ ] 说清箭头函数 5 个"没有"，以及 4 个不该用的场景
- [ ] 用一个例子解释闭包，并说明它为什么可能导致内存占用

### 7.2 对象与原型（分册 02）

- [ ] 完整说出 `new` 的 4 个步骤，并手写 `myNew`
- [ ] 区分 `prototype` / `__proto__` / `[[Prototype]]`
- [ ] 画出 `Function` 和 `Object` 互相指向的那两条"环"
- [ ] 说清 `class` 和 `function` 的 5 个差异
- [ ] 说清 `class extends` 用原型怎么表达（两条链）
- [ ] 说清 `Object.assign` 是浅拷贝，以及它 4 个"反直觉"的行为
- [ ] 说出 3 种深拷贝方案的优缺点（`structuredClone` / JSON / 手写）
- [ ] 手写深拷贝，处理循环引用 + `Date`/`RegExp`/`Map`/`Set`

### 7.3 响应式与元编程（分册 03）

- [ ] 说出 4 种「监听对象属性变化」的方案及代表框架
- [ ] 说清 `defineProperty` 的 3 个致命缺陷
- [ ] 说清 `Proxy` 的 3 个优势 + 2 个局限
- [ ] 说出至少 8 个 Proxy trap
- [ ] 解释 Proxy 里 `receiver` 参数的作用，以及 `Reflect.get` 为什么要传它
- [ ] 用 `Proxy` 写一个「访问不存在属性时返回默认值」的代理

### 7.4 异步（分册 04）

- [ ] 说出 Promise 三态与两条"不可逆"规则
- [ ] 说清 `then` 的返回值规则（值穿透、错误冒泡、返回 Promise 会展开）
- [ ] 区分 `all` / `allSettled` / `race` / `any`
- [ ] 手写 `Promise.all`（含非 Promise 值、空数组边界）
- [ ] 说清 `async` 函数的返回值被怎么处理
- [ ] 说清 `await` 后面跟**非 Promise 值**时会发生什么（仍会让出一次）
- [ ] 解释 `await` 为什么"不阻塞主线程"
- [ ] 画出浏览器事件循环的一轮，说出宏任务/微任务各 4 个例子
- [ ] 说出 Node 事件循环 6 个阶段的名字
- [ ] 说清 `for` 循环里 `await` 与 `Promise.all` 的性能差异，并写出并发控制

### 7.5 模块与工程化（分册 05）

- [ ] 说出 ESM 与 CJS 的 6 个差异
- [ ] 解释"活绑定"是什么意思，举一个 CJS 拷贝值导致的问题
- [ ] 说清为什么 ESM 能做 tree-shaking，CJS 不能
- [ ] 说出 HMR 的完整流程（watch → 编译 → WebSocket → 替换 → 冒泡）
- [ ] 区分 HMR 与 Live Reload
- [ ] 说清 Vite 的 HMR 为什么比 Webpack 快

### 7.6 集合与迭代（分册 06）

- [ ] `Set` 判重用的相等算法是什么，`NaN` 和 `+0/-0` 分别怎么处理
- [ ] 说出 `Set` 的 4 个常用 API + 3 种集合运算写法
- [ ] 说清 `Map` 相比 `Object` 的 4 个优势
- [ ] 说清 `WeakMap` 的 3 个限制，以及它为什么不会内存泄漏
- [ ] 说清 `for...in` / `for...of` 的 5 个差异
- [ ] 说出 `Array.from` 与扩展运算符的差异（类数组 vs 可迭代）
- [ ] 说出 `Array.prototype.includes` 与 `indexOf` 的差异（`NaN`）

### 7.7 类型转换（分册 07）

- [ ] 说出 `==` 比较的 5 条核心规则
- [ ] 解释 `[] == false`、`[] == ![]`、`null == 0` 分别为什么
- [ ] 说清 `ToPrimitive` 的 `hint` 有哪三种，`valueOf` 和 `toString` 谁优先
- [ ] 解释 `==` 为什么会让 `a==1 && a==2 && a==3` 成立，写出 3 种实现
- [ ] 说出 `Object.is` 与 `===` 的 2 个差异
- [ ] 说出 `NaN` 的判断方式（`Number.isNaN` vs 全局 `isNaN`）

---

## 附：分册文件清单

```
ES6-32题/
├── ES6-00-新特性总览与索引.md            ← 你在这里
├── ES6-01-变量-作用域-闭包-this.md       （题 1/19/24/25/29/31/23/27/28）
├── ES6-02-对象-原型-继承.md              （题 9/32/5/14）
├── ES6-03-响应式原理-Proxy与defineProperty.md  （题 13/15/4）
├── ES6-04-异步-Promise-async与事件循环.md  （题 10/8/26/11/12/21）
├── ES6-05-模块与工程化.md                 （题 6/2）
├── ES6-06-集合-迭代-数组.md               （题 17/18/16/22/7）
└── ES6-07-类型转换与隐式规则.md            （题 30/20）
```
