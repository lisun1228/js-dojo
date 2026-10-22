# 编程 01｜闭包与高阶函数

> 覆盖题号：1（防抖）、2（节流）、14（柯里化）、41（防抖节流）、45（add(1)(2)(3)）、28（compose）、38（compose）、20（reduce）
> 去重后：**5 个考点**

---

## 目录

- [1.0 这一册的共同内核：闭包](#10-这一册的共同内核闭包)
- [1.1 防抖 debounce](#11-防抖-debounce)
- [1.2 节流 throttle](#12-节流-throttle)
- [1.3 柯里化 curry 与 add(1)(2)(3)](#13-柯里化-curry-与-add123)
- [1.4 compose / pipe](#14-compose--pipe)
- [1.5 手写 reduce](#15-手写-reduce)
- [1.6 本册追问总表](#16-本册追问总表)
- [1.7 速记卡](#17-速记卡)
- [1.8 自测](#18-自测)

---

## 1.0 这一册的共同内核：闭包

这 5 道题看起来毫不相干，其实都在考同一件事：

```js
function outer() {
  let state;              // ← 状态放在外层函数
  return function inner() {
    state = ...;          // ← 内层函数读写它
  };
}
```

| 题 | `state` 是什么 | 为什么必须放外面 |
|---|---|---|
| 防抖 | `timer` | 每次调用要能 `clearTimeout` 上一次的定时器 |
| 节流 | `last` / `timer` | 要记住上次执行时间 |
| 柯里化 | `args`（累积参数） | 每次调用要能累加之前传的 |
| compose | `fns` 数组 | 闭包捕获函数列表 |
| reduce | `acc` / `index` | 遍历状态 |

**面试时这句话可以直接用**：

> 「这类题本质都是闭包——把状态放在外层函数的词法环境里，返回的内层函数通过 `[[Environment]]` 引用它，所以状态在多次调用之间能保留，外部又访问不到。这就是为什么不用全局变量。」

**追问预判**：为什么不用 `this` 存？→ 因为返回的函数会被解构、当回调传出去，`this` 会丢；闭包不受调用方式影响。

---

## 1.1 防抖 debounce

### 一句话结论

> 连续触发时只执行**最后一次**（或第一次），中间的都被取消。

### 场景锚点（说出来会加分）

- 搜索框输入联想：打字过程中不发请求，停 300ms 再发
- 窗口 `resize` / 滚动到底检测
- 表单校验：用户输完再验证
- 按钮防重复提交

### 原题单答案的问题

```js
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
```

**核心逻辑是对的**，实测 `100ms 内连打 10 次 → 执行 1 次`。但缺 4 样东西：

| 缺失 | 现场会怎么翻车 |
|---|---|
| `immediate` 选项 | 面试官问「如果我要第一次立即执行呢」→ 答不上来 |
| `cancel` 方法 | 组件卸载时定时器还在跑，setState 到已卸载组件 |
| 返回值 | `const r = debounced(); // undefined`，拿不到结果 |
| `flush` | 想立刻执行挂起的那次 |

### 正确实现（三档，按面试官反应递进）

#### 第一档：能过面试的最小版

```js
function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, delay);
  };
}
```

**边写边说这三句**：

1. 「`timer` 放在外层，用闭包保存，这样多次调用共享同一个计时器。」
2. 「每次进来先 `clearTimeout`，等于把上一次的倒计时取消。」
3. 「用箭头函数是为了保住外层 `this`——返回的函数被当回调传出去时 `this` 会丢；`apply` 是为了透传参数。」

#### 第二档：加 immediate + cancel + 返回值（面试官点头后再补）

```js
function debounce(fn, delay, { immediate = false } = {}) {
  let timer = null;
  let lastResult;

  function debounced(...args) {
    // immediate 模式下，只有从「空闲」进入时才立即执行
    const callNow = immediate && timer === null;

    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;                             // 重置为空，表示空闲了
      if (!immediate) lastResult = fn.apply(this, args);
    }, delay);

    if (callNow) lastResult = fn.apply(this, args);
    return lastResult;                          // 返回上一次的结果
  }

  debounced.cancel = function () {
    clearTimeout(timer);
    timer = null;
  };

  return debounced;
}
```

**实测输出**：

```
连打 10 次              → 执行 1 次
immediate 连打 3 次      → 执行 1 次   （只在第一次立刻执行）
隔一拍再打               → 累计 2 次
cancel 后                → 执行 0 次
返回值                   → 10          （返回上一次的执行结果）
```

**关键点解释（面试官最爱追问这里）**：

> 「`immediate` 模式判断的是 `timer === null`。因为 `timer` 为 `null` 说明当前没有挂起的倒计时，也就是『这一批的第一次』。执行完之后照样要开一个定时器，但定时器里什么都不做，只负责在 delay 后把 `timer` 置回 `null`，这样下一批才能重新立即执行。」

#### 第三档：返回 Promise 版（高级，面试官说「还能怎么改」时用）

```js
function debounceAsync(fn, delay) {
  let timer = null;
  let pending = [];                    // 收集这一批的所有 resolve

  return function (...args) {
    clearTimeout(timer);
    return new Promise((resolve, reject) => {
      pending.push({ resolve, reject });
      timer = setTimeout(async () => {
        const batch = pending;
        pending = [];
        try {
          const result = await fn.apply(this, args);
          batch.forEach(p => p.resolve(result));
        } catch (e) {
          batch.forEach(p => p.reject(e));
        }
      }, delay);
    });
  };
}
```

> 这段能说出来，基本就锁定了「这个人是真写过」的印象。因为**多处调用的返回值合并**是实际业务里才会遇到的问题（比如三个地方同时触发同一个请求，都想要结果）。

### 面试怎么说（口述脚本）

**接题时**：

> 「防抖我按『核心实现 → 边界 → 扩展』三步来。核心就一句话：**每次触发都重置计时器，只在停下来 delay 之后执行一次**。」

**写的时候**：

> 「用闭包存 `timer`。每次进来先清掉上一次的。这里有两个细节：一是用箭头函数保 `this`，二是用 `apply` 透传参数——如果直接 `fn()` 就会丢 `this` 和参数。」

**写完之后（这段最重要）**：

> 「核心版好了。它现在有四个限制：
> 1. **拿不到返回值**——因为执行是延后的，函数早就 return 了；
> 2. **不能取消**——组件卸载时定时器还在，会 setState 到已卸载组件；
> 3. **不支持首次立即执行**——有些场景（比如按钮防抖）希望第一下就响应；
> 4. **某些场景需要『等待中的也立刻执行』**，就是 `flush`。
>
> 我补一下 `immediate` 和 `cancel`。生产环境直接用 lodash 的 `debounce`，这几个选项它都有。」

### 追问链

| 追问 | 答法 |
|---|---|
| 防抖和节流什么区别？ | 防抖是「等你停下来再执行」，节流是「固定频率执行，不管你多频繁」。一句话记法：**防抖管「最后一次」，节流管「每隔一段」** |
| 为什么用 `apply` 不用 `call`？ | `call` 要一个个列参数，这里参数是数组（`...args`），`apply` 正好接数组 |
| `this` 为什么不会丢？ | 箭头函数没有自己的 `this`，它用的是 `debounced` 被调用时的 `this` |
| 如果 `fn` 是 async 会怎样？ | 会正常执行，但返回值是 Promise；第一档实现里 `lastResult` 拿到的是 Promise，第二档同理。要拿真实结果得用第三档的合并写法 |
| 组件卸载时要注意什么？ | 调 `cancel()`。React 里在 `useEffect` 的 cleanup 里调；Vue 里在 `onUnmounted` 里调 |
| 输入框联想为什么不用防抖而用节流？ | 也可以用防抖，但如果用户持续输入又想看到部分结果，节流体验更好。**关键看业务：要不要「过程中的反馈」** |
| 防抖的 delay 设多少？ | 输入联想 300ms（经验值，超过 500ms 用户感觉卡）；resize 100~200ms；按钮防重 500ms~1s |

### 加分点（这道题面试官在等你说什么）

> **「防抖在 React 函数组件里有个经典坑：闭包捕获了旧的 state。」**

```js
// 错误写法
function Search() {
  const [kw, setKw] = useState('');
  const search = useCallback(debounce(() => {
    fetch(`/api?q=${kw}`);     // ← 永远拿到第一次渲染时的 kw（空字符串）
  }, 300), []);                // ← 依赖数组空，search 永不重建
  ...
}
```

正确做法是 `useRef` 存最新值，或者把 `kw` 加进依赖并 `cancel` 旧的，或者用 `useEvent`。这个坑一说出来，面试官就知道你实战过。

---

## 1.2 节流 throttle

### 一句话结论

> 固定时间窗口内最多执行一次，**不管中间触发了多少次**。

### 原题单答案的问题

```js
function throttle(fn, interval) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= interval) {
      last = now;
      fn.apply(this, args);
    }
  };
}
```

时间戳版。实测：

```
等间隔 10ms 调用 10 次（interval=50）→ 执行 2 次
同步连打 3 次                        → 执行 1 次
```

**问题：最后一次调用被丢弃了。**

想一下这个场景：用户拖动列表，一直拖到松手。最后一次鼠标移动事件发生在两次节流的中间，如果不响应，列表**永远停在倒数第二个位置**——肉眼可见的 bug。

### 三种实现对比（这是这道题的核心考点）

| 版本 | 首次执行 | 末次执行 | 间隔精确性 | 典型问题 |
|---|---|---|---|---|
| **时间戳版** | ✅ 立即 | ❌ **丢失** | 准 | 最后一次不响应 |
| **定时器版** | ❌ 延迟 interval | ✅ 有 | 略偏 | 首次要等 interval |
| **混合版（lodash）** | ✅ | ✅ | 准 | 代码复杂 |

#### 时间戳版

```js
function throttle(fn, interval) {
  let last = 0;
  return function (...args) {
    const now = Date.now();
    if (now - last >= interval) {
      last = now;
      fn.apply(this, args);
    }
  };
}
```

#### 定时器版

```js
function throttle(fn, interval) {
  let timer = null;
  return function (...args) {
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, interval);
  };
}
```

#### 生产级（leading + trailing 都支持）

```js
function throttle(fn, interval, { leading = true, trailing = true } = {}) {
  let last = 0;
  let timer = null;
  let lastArgs = null;

  function throttled(...args) {
    const now = Date.now();
    if (!last && !leading) last = now;          // 处理 leading:false 的首次

    const remaining = interval - (now - last);
    lastArgs = args;

    if (remaining <= 0 || remaining > interval) {
      // 已经超过间隔（或系统时间被改），立即执行
      if (timer) { clearTimeout(timer); timer = null; }
      last = now;
      fn.apply(this, args);
    } else if (!timer && trailing) {
      // 还在间隔内，安排一个尾部调用
      timer = setTimeout(() => {
        last = leading ? Date.now() : 0;
        timer = null;
        fn.apply(this, lastArgs);               // ← 用最后一次的参数
      }, remaining);
    }
  }

  throttled.cancel = () => { clearTimeout(timer); timer = null; last = 0; };
  return throttled;
}
```

**实测对比**：

```
原答案（时间戳版）：
  等间隔 10ms 调用 10 次（interval=50）→ 执行 2 次
  同步连打 3 次                        → 执行 1 次

生产级（leading + trailing）：
  等间隔 10ms 调用 10 次（interval=50）→ 执行 3 次，时间点 0ms / 51ms / 101ms
  同步连打 3 次                        → 执行 2 次（leading 1 + trailing 1）
```

**为什么多出来一次？** 因为尾部补了一次。这多出来的一次，就是「拖动结束后列表停在正确位置」的那一下。

### 面试怎么说

**接题时**：

> 「节流有三种写法，我推荐先说清它们各自的取舍，再写代码。因为**这三种的差别就是这道题的全部考点**。」

**写的时候**：

> 「时间戳版：进来比对 `now - last`，够了就执行并更新 `last`。优点是首次立即执行、间隔准；**缺点是最后一次会被丢掉**。
>
> 定时器版：`timer` 存在就直接 return，否则开一个定时器。优点是保证末次执行；**缺点是首次要等一个 interval**。
>
> 所以生产环境用混合版，两个都补上。」

**写完之后**：

> 「`remaining > interval` 这个判断是防系统时间被修改的——如果用户把系统时间往前调，`now - last` 会变成负数，`remaining` 会超过 interval，这时候应该重新对齐而不是一直不执行。」

### 追问链

| 追问 | 答法 |
|---|---|
| 滚动事件用哪个？ | 节流。而且要配 `passive: true`，否则滚动会被阻塞 |
| 为什么不用 rAF 做节流？ | 视觉更新类（滚动跟随、拖拽）用 rAF 更合适——它跟屏幕刷新对齐，天然 16.7ms 一次，而且页面切到后台时会自动暂停，省电。**但 rAF 只在「需要跟着渲染」时才合适**，纯数据节流还是用时间戳 |
| 节流的间隔设多少？ | 滚动 100ms 左右；拖拽用 rAF；按钮点击 500ms |
| 为什么要 `apply(this, lastArgs)` 而不是 `fn()`？ | 定时器里 `this` 是 `window`/`undefined`，必须用保存的参数和 `this`。这里 `lastArgs` 存最后一次的参数，是因为 trailing 应该用最新数据 |
| 首屏图片懒加载的滚动检测用防抖还是节流？ | 节流。防抖会导致「一直滚就一直不检测」，用户滚到底了还不加载 |
| 搜索框用哪个？ | 防抖。节流的「固定频率请求」在用户打字时依然会产生大量请求 |

### 加分点

> **「防抖和节流的选择，本质是问：你要『过程中的反馈』还是只要『最终结果』。」**

- 只要最终结果（搜索、校验、提交）→ 防抖
- 要过程反馈（滚动位置、拖拽、进度）→ 节流

这一句能直接结束这道题。

---

## 1.3 柯里化 curry 与 add(1)(2)(3)

题单把这两道题分开（14 和 45），但它们是**同一族**：都在考「参数累积 + 延迟执行」。

### 一句话结论

> 柯里化把 `f(a,b,c)` 变成 `f(a)(b)(c)`；`add(1)(2)(3)` 是它的「无限参数 + 隐式求值」变体。

### 原题单答案的问题

```js
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) return fn(...args);
    return (...next) => curried(...args, ...next);
  };
}
```

**核心思路对，但 `fn.length` 有个大坑**。实测：

```js
function fDefault(a, b = 10, c) { return [a,b,c].join('-'); }

fDefault.length                // → 1  ← 只有 a 被计入！
curry(fDefault)(1)             // → "1-10-"   c 直接丢了
```

**根因**：`Function.prototype.length` 的定义是「**第一个有默认值的参数之前**的参数个数」。默认参数之后的参数全部不计入。

| 函数形态 | `.length` |
|---|---|
| `(a, b, c) => {}` | 3 |
| `(a, b = 1, c) => {}` | **1** |
| `(a, ...rest) => {}` | **1** |
| `(...rest) => {}` | **0** |
| `(a, b = 1, ...rest) => {}` | 1 |

### 正确实现

#### 基础版（够面试用）

```js
function curry(fn) {
  const arity = fn.length;
  return function curried(...args) {
    if (args.length >= arity) return fn.apply(this, args);
    return (...next) => curried.apply(this, [...args, ...next]);
  };
}
```

实测：

```
curry(f3)(1)(2)(3)   → "1-2-3"
curry(f3)(1,2)(3)    → "1-2-3"
curry(f3)(1)(2,3)    → "1-2-3"
```

三种调用方式都work，说明「一次传几个都行，凑够就执行」。

#### 加占位符版（高级）

```js
const _ = Symbol('placeholder');

function curry(fn) {
  const arity = fn.length;
  return function curried(...args) {
    const realCount = args.filter(a => a !== _).length;
    if (realCount >= arity) return fn.apply(this, args);

    return (...next) => {
      // 先用 next 填掉 args 里的占位符，剩下的追加到末尾
      const merged = args.slice();
      let ni = 0;
      for (let i = 0; i < merged.length && ni < next.length; i++) {
        if (merged[i] === _) merged[i] = next[ni++];
      }
      while (ni < next.length) merged.push(next[ni++]);
      return curried.apply(this, merged);
    };
  };
}
```

实测：

```
curry(f3)(_, 2)(1)(3)     → "1-2-3"
curry(f3)(_, _, 3)(1)(2)  → "1-2-3"
```

> **注意这里我自己第一版写错过**：一开始我只是把 `next` 直接 append 到 `args` 后面，结果占位符永远留在原位，`f3(_, 2, 1)` 会把 Symbol 转成字符串然后抛 `TypeError: Cannot convert a Symbol value to a string`。**占位符必须在填充时替换，不是追加。**

### add(1)(2)(3)：两种考法

#### 考法 A：固定 3 个（题单给的就是这个）

```js
function add(a) {
  return b => c => a + b + c;
}
```

只能 `add(1)(2)(3)`，`add(1)(2)` 会返回一个函数而不是数值。

#### 考法 B：无限累加（真正的考点）

面试官说「那 `add(1)(2)(3)(4)(5)` 呢」，就是在考这个：

```js
function add(...args) {
  const sum = args.reduce((a, b) => a + b, 0);
  const fn = (...next) => add(sum, ...next);

  fn.valueOf = () => sum;                    // 数学运算时调用
  fn.toString = () => String(sum);           // 字符串拼接时调用
  fn[Symbol.toPrimitive] = () => sum;        // 优先级最高

  return fn;
}
```

实测：

```
add(1)(2)(3)      → [Function: fn]      ← 返回的是函数
+add(1)(2)(3)(4)  → 10
`${add(1)(2)}`    → "3"
+add(1,2,3)       → 6                   ← 也支持一次传多个
+add()            → 0
add(1)(2) == 3    → true                ← 宽松相等触发 toPrimitive
add(1)(2) === 3   → false               ← 严格相等不转换
```

**这一条是这道题的灵魂**：

> 「它返回的**永远是函数**，`add(1)(2)(3)` 单独看是个函数。但只要你把它放进需要原始值的上下文（`+`、模板字符串、`==`），JS 就会调用 `Symbol.toPrimitive` / `valueOf` / `toString` 把它转成数字。所以不是『凑够 3 个就返回数字』，而是**靠类型转换兜底**。」

**优先级**：`Symbol.toPrimitive` > `valueOf` > `toString`。三个都写是为了兼容旧环境（`Symbol.toPrimitive` 是 ES6 的）。

### 追问链

| 追问 | 答法 |
|---|---|
| 柯里化有什么用？ | ① 参数复用（`const add10 = curry(add)(10)`）；② 延迟执行（先攒参数，最后才跑）；③ 配合 compose 做 pipeline；④ 让函数更容易单测 |
| `fn.length` 为什么不可靠？ | 默认参数/rest 参数之后的都不计入。要精确就自己传 arity：`curry(fn, 3)` |
| 柯里化和偏函数（partial）区别？ | 柯里化是把 n 元变 n 个 1 元（严格）；偏函数只是固定前几个参数，剩下的还要一次传完。**柯里化是偏函数的特例** |
| `add(1)(2)` 为什么不会报错？ | 因为返回的是函数，能继续调用；只是它同时具有 `toPrimitive` 能力 |
| 不用 `valueOf` 能实现吗？ | 不能靠隐式转换了，只能约定一个终止符：`add(1)(2)(3)()`，返回时判断 `args.length === 0` |
| 这个在真实项目里用过吗？ | 老实说很少。**柯里化在函数式编程库里常见（Ramda），业务代码里更多是 `partial` 用法**——比如 `const log = curry((level, msg) => ...)` 然后 `const error = log('error')` |

> 最后一个问题的诚实回答会加分。面试官知道大部分人没在生产里用过柯里化，装用途反而扣分。

---

## 1.4 compose / pipe

### 一句话结论

> 把多个函数串起来，前一个的输出是后一个的输入。`compose` 是**右到左**，`pipe` 是**左到右**。

### 原题单答案的问题

```js
function compose(...fns) {
  return fns.reduce((f, g) => (...args) => f(g(...args)));
}
```

实测直接崩：

```
compose()  → TypeError: Reduce of empty array with no initial value
```

`reduce` 不给初始值时，空数组会抛错。**空参数是这道题最经典的边界**——面试官几乎必测。

### 正确实现

```js
function compose(...fns) {
  if (fns.length === 0) return x => x;        // 空：恒等函数
  if (fns.length === 1) return fns[0];        // 单个：原样返回
  return fns.reduce((f, g) => (...args) => f(g(...args)));
}

const pipe = (...fns) => compose(...fns.reverse());
```

实测：

```
compose()(1)              → 1      （恒等）
compose(inc)(1)           → 2
compose(inc, dbl)(3)      → 7      （先 3*2=6，再 6+1）
pipe(inc, dbl)(3)         → 8      （先 3+1=4，再 4*2）
compose(sq, inc, dbl)(3)  → 49     （((3*2)+1)^2）
```

**注意 `compose(sq, inc, dbl)(3) = 49` 这个例子**：它证明了执行顺序是**从右往左**（`dbl` 先跑）。很多人写完不知道自己在写什么顺序，一测就露馅。

#### 异步版（面试官问「函数是 async 呢」）

```js
const composeAsync = (...fns) =>
  fns.length === 0
    ? (x => Promise.resolve(x))
    : fns.reduce((f, g) => (...args) => Promise.resolve(g(...args)).then(f));
```

实测：`composeAsync(aInc, aDbl)(3) → 7`

> 关键点：`Promise.resolve(g(...args)).then(f)` —— `Promise.resolve` 包一层是为了**同时兼容同步和异步函数**。如果 `g` 返回的是普通值，`Promise.resolve` 会包成 resolved；如果 `g` 返回 Promise，直接链下去。

### 面试怎么说

> 「`compose` 的核心是 `reduce`。第一次 `f` 是第一个函数，`g` 是第二个，产出 `f(g(x))`；第二次这个组合函数变成新的 `f`，再接第三个……所以最终是**最右边最先执行**。
>
> 两个边界必须处理：空数组返回恒等函数，单个函数直接返回它自己。原版 `compose()` 会直接抛 TypeError。」

### 追问链

| 追问 | 答法 |
|---|---|
| `compose` 和 `pipe` 区别？ | 只有方向不同。`compose` 右到左（数学写法 `f∘g`），`pipe` 左到右（更符合阅读顺序）。**实际项目里 pipe 用得多，因为好读** |
| 多参数函数放哪？ | 只能放**最右边**，因为它第一个接收参数。中间的函数都是单参数 |
| 中间函数抛错怎么办？ | 直接冒泡，整个组合中断。要容错得每题包 try/catch 或用 `Result` 类型 |
| 和 `reduce` 的初始值有关吗？ | 有关。不给初始值时，`[a,b,c].reduce(fn)` = `fn(fn(a,b),c)`，第一次 `f=a, g=b` 正是我们要的。**但如果给了初始值 `{}`，第一次就变成 `fn({}, a)`，顺序就全错了** |
| 中间件的 `compose`（Koa/Redux）和这个一样吗？ | 名字一样但语义不同。Koa 的 `compose` 是**洋葱模型**——中间件能 `await next()` 后继续执行前一个的后半段；这里的是纯单向管道 |
| 真实项目用在哪？ | 数据处理管道（埋点数据清洗）、Redux 的 `applyMiddleware`、Webpack loader 链（从右往左）、Vue 的编译管线 |

---

## 1.5 手写 reduce

### 一句话结论

> 遍历数组累积成一个值。**三个坑：初始值判断、稀疏数组、空数组报错。**

### 原题单答案的问题

```js
Array.prototype.myReduce = function(fn, init) {
  let acc = init !== undefined ? init : this[0];
  const start = init !== undefined ? 0 : 1;
  for (let i = start; i < this.length; i++) {
    acc = fn(acc, this[i], i, this);
  }
  return acc;
};
```

实测三个问题：

| 用例 | 原生 | 原答案 | 问题 |
|---|---|---|---|
| `[1,2,3].reduce(fn, undefined)` | `NaN` | `6` | 把显式 `undefined` 当成「没传」 |
| `[].reduce(fn)` | `TypeError` | `undefined` | 空数组该报错 |
| `[,,3].reduce(fn)` | `3` | **`NaN`** | 没跳过稀疏空位 |

**稀疏数组那条最隐蔽**：`[,,3]` 的 index 0 和 1 是**空位（hole）**，不是 `undefined`。原生 `reduce` 会跳过它们，原答案直接 `this[0]` 拿到 `undefined`，然后 `undefined + 3 = NaN`。

### 正确实现

```js
function myReduce(fn, ...rest) {
  if (typeof fn !== 'function') {
    throw new TypeError('callback must be a function');
  }

  const hasInit = rest.length > 0;             // ← 用参数个数，不用 !== undefined
  const O = Object(this);
  const len = O.length >>> 0;                  // ← 转无符号整数，防异常 length
  let k = 0;
  let acc;

  if (hasInit) {
    acc = rest[0];
  } else {
    while (k < len && !(k in O)) k++;          // ← 跳过稀疏空位
    if (k >= len) {
      throw new TypeError('Reduce of empty array with no initial value');
    }
    acc = O[k++];
  }

  for (; k < len; k++) {
    if (k in O) acc = fn(acc, O[k], k, O);     // ← 再次跳过空位
  }
  return acc;
}
```

实测：

```
1) [1,2,3] 无初始值        → 6
2) [1,2,3] 初始值 10       → 16
3) 显式 undefined          → NaN       （与原生一致）
4) 稀疏 [,,3]              → 3         （原生也是 3）
5) 空数组无初始值          → TypeError: Reduce of empty array with no initial value
6) 空数组有初始值 0        → 0
7) 非函数                  → TypeError: callback must be a function
8) 类数组 {0:'a',1:'b',len:2} → "ab"
```

### 四个技术点

| 点 | 为什么 |
|---|---|
| `...rest` 而不是 `init` | 只有这样才能区分「没传」和「传了 undefined」 |
| `k in O` | `in` 能区分「空位」和「显式 undefined」，`O[k] !== undefined` 不能 |
| `len >>> 0` | `length` 可能是字符串、负数、`NaN`，`>>> 0` 统一转成合法长度（这招来自规范） |
| `Object(this)` | 让类数组（`{0:'a', length:1}`）、字符串也能用 |

### 追问链

| 追问 | 答法 |
|---|---|
| `reduce` 能实现哪些其他数组方法？ | `map`（`reduce((acc,x)=>[...acc,fn(x)],[])`）、`filter`、`flat`、`groupBy`、`countBy`。**这是「reduce 为什么强」的标准答法** |
| `reduce` 和 `forEach` 区别？ | `reduce` 有累积值且有返回值，可以链式；`forEach` 无返回值，纯粹副作用 |
| `reduce` 能不能提前退出？ | **不能**。原生没有 `break`，`return` 只是跳过当前这一轮。要提前退出得用 `some`/`every`/`find` 或者包一层 try/catch 抛异常（hack） |
| 为什么不用 `for...of`？ | `for...of` 会走迭代器，稀疏数组会**返回 `undefined` 而不是跳过**，语义不对 |
| 空数组为什么要报错而不是返回 undefined？ | 因为「无初始值 + 空数组」不存在合法的累积结果。返回 `undefined` 会把错误藏起来，后续 `NaN` 更难排查 |

---

## 1.6 本册追问总表

| 问题 | 一句话答 |
|---|---|
| 这 5 道题有什么共同点？ | 都用闭包保存状态，状态在多次调用间保留、外部不可访问 |
| 为什么不用 `this` 存状态？ | 返回的函数会当回调传出去，`this` 会丢；闭包不受调用方式影响 |
| 哪个最常考？ | 防抖节流 > 柯里化 > compose > reduce |
| 哪个最容易翻车？ | 节流的「末次丢失」和 `curry` 的 `fn.length` |
| 写不出来怎么办？ | 先说思路和边界（「我需要一个闭包存 timer，每次进来清掉上一次的」），把「知道该怎么做」传递出去，代码能写多少写多少 |
| 生产环境该用库吗？ | 应该。lodash 的 `debounce`/`throttle` 处理了 `maxWait`、`flush`、取消、返回值等十几个边界，手写版只适合面试 |

---

## 1.7 速记卡

```
【防抖】等你停下来 → 只管最后一次
  闭包存 timer；每次 clearTimeout 再 setTimeout
  三扩展：immediate（首次立即）/ cancel（卸载时调）/ 返回值
  坑：React 函数组件里闭包捕获旧 state

【节流】固定频率 → 不管你多频繁
  时间戳版：首次 ✅ 末次 ❌（拖动停不住）
  定时器版：首次 ❌ 末次 ✅
  生产版：leading + trailing 都要
  视觉场景用 rAF，数据节流用时间戳

【柯里化】f(a,b,c) → f(a)(b)(c)
  靠 fn.length 判断凑够没
  坑：默认参数/rest 之后的参数不计入 length
  占位符版要「替换」不是「追加」

【add(1)(2)(3)】返回的永远是函数
  靠 Symbol.toPrimitive / valueOf / toString 隐式转数字
  add(1)(2) == 3 → true；=== 3 → false

【compose】reduce 实现，从右往左
  空 → 恒等函数；单个 → 原样返回
  异步版：Promise.resolve(g(...)).then(f)

【reduce】三个坑
  初始值用 arguments.length 判断，不用 !== undefined
  稀疏数组用 k in O 跳过
  空数组无初始值必须抛 TypeError
```

---

## 1.8 自测

```
□ 能默写防抖，并说出 4 个缺失
□ 能说出时间戳版和定时器版的取舍（哪个丢末次）
□ 能解释为什么 immediate 判断 timer === null
□ 能说出 fn.length 在默认参数下为什么失效
□ 能解释 add(1)(2) 为什么不报错
□ 能说出 Symbol.toPrimitive / valueOf / toString 的优先级
□ 能解释 compose 空参数为什么要返回恒等函数
□ 能说出 myReduce 为什么用 k in O 而不是 !== undefined
□ 能说出 reduce 为什么不能提前退出
```
