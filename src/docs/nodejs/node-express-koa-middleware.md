# Node 05｜Express 与 Koa 中间件

> 覆盖题号：8（中间件概念与封装）、19（不调 await next() 会怎样）、20（无 async 时怎么实现洋葱模型）、21（Koa 中间件异常）、23（洋葱模型）、25（koa vs express）、18（body-parser）
> 去重后：**5 个考点**
>
> ⚠️ 这 5 道题（19/20/21/23/25）**讲的是同一件事的不同侧面**。面试官连着问的话，一套准备就能答完。

---

## 5.1 题单答案的问题

> **19.** 「不会。Koa 洋葱模型靠 `await next()` 驱动，不调用就停在这里。」
> **20.** 「Koa 1 用 generator + co 库，`yield next` 等价于 `await next()`。Koa 2 改成 async/await。」
> **23.** 「中间件像洋葱层层包裹……每层可以在 `await next()` 前后做处理。」
> **25.** 「Express：回调风格，内置 router/中间件，大而全。Koa：async/await 洋葱模型，轻量，router/body-parser 都是中间件需要自己装。」
> **8.** 「中间件是请求-响应循环中的处理函数，接收 `(req, res, next)`……调用 `next()` 进入下一个。」

**这五条的结论全对**，是我看过的题单里最靠得住的一组。但**全部停留在「描述现象」**，没有一个解释**「怎么做出来的」**。

而这道题真正的考点恰恰是「怎么做出来的」：

| 题单没答的 | 为什么这是真正的考点 |
|---|---|
| **洋葱模型怎么实现的** | `compose` 那 15 行代码才是答案。**能默写 `dispatch(i)` 的人才算真懂** |
| **`next()` 调两次为什么报错** | 说明实现里有 `index` 守卫。这个细节题单没提 |
| **异常为什么能「冒泡」回来** | 因为洋葱模型本质是 `Promise` 链，`catch` 会沿链反向传播 |
| **Express 的中间件为什么不是洋葱** | Express 是「数组 + 游标」，`next()` 之后**回不来**了 |

---

## 5.2 一句话结论

> **Koa 的洋葱模型 = 一个递归的 `dispatch(i)` 函数 + `Promise` 链。**
>
> **Express 的中间件 = 一个数组 + 一个游标，`next()` 只能往后走，回不来。**

---

## 5.3 洋葱模型（题 23 + 19 + 20，一次讲透）

### 什么是洋葱模型

```
      请求
       ↓
  ┌─────────────┐
  │  mw1 前      │
  │  ┌─────────┐ │
  │  │ mw2 前   │ │
  │  │ ┌─────┐ │ │
  │  │ │ mw3 │ │ │
  │  │ └─────┘ │ │
  │  │ mw2 后   │ │
  │  └─────────┘ │
  │  mw1 后      │
  └─────────────┘
       ↓
      响应
```

**关键**：`await next()` **之前**的代码正序执行，**之后**的代码逆序执行。

### 实测：执行顺序

我手写了一个 mini Koa（下面有完整代码），三个中间件，实测输出：

```
mw1 前 → mw2 前 → mw3（最内层） → mw2 后 → mw1 后
```

**前一半正序（1→2→3），后一半逆序（3→2→1）。** 这就是洋葱。

### 核心实现：15 行 `compose`

**这段代码是这道题的全部答案。**

```js
function compose(middlewares) {
  return function (ctx, next) {
    let index = -1;                     // ★ 记录「已经执行到第几个」

    function dispatch(i) {
      // ★★ 关键守卫：next() 被调用两次会撞到这里
      if (i <= index) {
        return Promise.reject(new Error('next() called multiple times'));
      }
      index = i;

      let fn = middlewares[i];
      if (i === middlewares.length) fn = next;   // 全部走完了，调外部的 next
      if (!fn) return Promise.resolve();

      try {
        // ★ 把「下一个」包成函数传进去 —— 这就是 next
        return Promise.resolve(fn(ctx, () => dispatch(i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    }

    return dispatch(0);
  };
}
```

### 逐行拆解（这段必须能讲）

#### ① 为什么 `dispatch` 要返回 Promise

因为 `await next()` 要能「等」。`next` 是 `() => dispatch(i + 1)`，它返回的是 **第 i+1 层的完整执行结果的 Promise**（包括它后面所有层的）。

```
dispatch(0) 返回的 Promise
  = mw1 的 fn 执行完的 Promise
  = mw1 整个函数（含 await next() 之后的部分）执行完

所以 await next() 等的是「内层全部完成」——包括内层的「后半段」。
```

**这就是洋葱能成立的原因**：`await next()` 挂起当前中间件，让内层跑完（含内层的后半段），才回到当前继续。

#### ② `index` 守卫的作用

```js
if (i <= index) return Promise.reject(new Error('next() called multiple times'));
```

如果没有这个守卫，`next()` 调两次会怎样？

```
第一次 next() → dispatch(1) → mw2 执行
第二次 next() → dispatch(1) → mw2 又执行一遍
```

**中间件被重复执行**——可能重复写响应、重复扣款。**这个守卫是防止这种错误的。**

实测：

```js
app.use(async (ctx, next) => { await next(); await next(); });
// → ctx.body.error = "next() called multiple times"
```

#### ③ `i === middlewares.length` 时的 `next`

```js
let fn = middlewares[i];
if (i === middlewares.length) fn = next;   // 交给外部
```

当所有中间件都执行完，`dispatch` 会拿到外部的 `next`（用于 Koa 集成到 http server 时收尾）。如果外部也没传，`fn` 就是 `undefined`，`return Promise.resolve()` 直接结束。

#### ④ `Promise.resolve(fn(...))` 包一层

因为中间件可能是**同步函数**（不返回 Promise）。包一层保证 `dispatch` 永远返回 Promise，`await` 永远能工作。

### 不调 `await next()` 会怎样（题 19）

**实测**：

```js
app.use(async (ctx, next) => { log.push('mw1'); /* 故意不调 next */ });
app.use(async (ctx) => { log.push('mw2'); });

// 输出：mw1        ← mw2 完全没执行
```

**原因**：`dispatch(0)` 执行 mw1，mw1 里没有调用 `next()`（也就是没调用 `dispatch(1)`），所以 mw2 永远不会被调用。

**这就是「短路」**——用在：

- **鉴权中间件**：token 无效就直接返回 401，不往下走
- **限流中间件**：超限直接返回 429
- **缓存中间件**：命中缓存直接返回，不查数据库

```js
// 鉴权短路
app.use(async (ctx, next) => {
  if (!ctx.headers.authorization) {
    ctx.status = 401;
    ctx.body = { error: '未登录' };
    return;                     // ← 不调 next()，后续中间件不执行
  }
  await next();
});
```

> **注意 `return` 之后要 `return`**——如果写了 `ctx.body = ...` 但没 `return`，代码会继续往下执行（因为没 `await next()` 也只是跳过，不是退出函数）。实际上不调 `next()` 就已经短路了，但显式 `return` 更清晰。

### ⚠️ 一个容易忽略的点：响应会在什么时候发

```js
app.use(async (ctx, next) => {
  await next();          // ← 内层全部执行完
  ctx.body = 'outer';    // ← 这里还能改 body！
});
```

**因为 `ctx.body` 的赋值是通过 setter 触发的**，而 Koa 在 `respond()` 时才真正写响应。所以**外层中间件可以覆盖内层设置的 body**。

**这也解释了洋葱模型的价值**：外层可以在内层处理完之后**统一加工响应**（加 header、统计耗时、格式化错误）。

```js
// 统计耗时（只有洋葱模型能做到）
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  ctx.set('X-Response-Time', `${Date.now() - start}ms`);
});
```

> **如果用 Express 实现这个，会很难**——因为 Express 的 `next()` 之后回不来，你没法在「响应完成时」插入逻辑。**这是 Koa 相比 Express 最大的优势之一。**

---

## 5.4 没有 async/await 时怎么实现（题 20）

### 题单答案

> 「Koa 1 用 generator + co 库，`yield next` 等价于 `await next()`。Koa 2 改成 async/await。」

**对，但不够**。面试官会追问：「`co` 是怎么做到的？」

### 答案：`co` 是一个「自动执行器」

Generator 函数有个特点：**调用它不会执行函数体**，只返回一个迭代器。

```js
function* gen() {
  console.log('这行不会立刻执行');
  yield 1;
}
const it = gen();       // ← 什么都没打印！
it.next();              // ← 现在才执行到第一个 yield
```

所以需要有人「驱动」它：不断调 `it.next(value)`，把 `yield` 出来的值处理完再送回去。

**`co` 就是干这个的**：

```js
function co(genFn) {
  return function (...args) {
    const gen = genFn.apply(this, args);
    return new Promise((resolve, reject) => {
      function step(key, arg) {
        let res;
        try {
          res = gen[key](arg);          // 调 next() 或 throw()
        } catch (e) {
          return reject(e);
        }
        if (res.done) return resolve(res.value);
        // ★ yield 出来的值如果是 Promise，等它，然后 step('next', value)
        Promise.resolve(res.value).then(
          v => step('next', v),
          e => step('throw', e),        // ★ 出错就往 generator 里 throw
        );
      }
      step('next');
    });
  };
}
```

**核心就三行**：

1. `gen.next()` 拿到 `{ value, done }`
2. `Promise.resolve(value).then(...)` 等 `yield` 的值
3. 拿到结果后 `step('next', value)` 继续；出错则 `step('throw', e)`

### Koa 1 的 generator 版洋葱模型

```js
function composeGen(middlewares) {
  return co(function* (ctx, next) {
    let index = -1;

    function* dispatch(i) {
      if (i <= index) throw new Error('next() called multiple times');
      index = i;
      const fn = i === middlewares.length ? next : middlewares[i];
      if (!fn) return;

      // ★ 关键：next 必须返回 Promise，不能返回 generator 对象
      yield co(fn)(ctx, function () {
        return co(function* () { yield* dispatch(i + 1); })();
      });
    }

    yield* dispatch(0);
  });
}
```

**实测输出**：

```
执行顺序: g1 前 → g2 前 → g3（最内层） → g2 后 → g1 后
body = ok
```

和 async 版完全一致。

### ⚠️ 我写这段时踩的坑（值得讲）

**第一版**我这样写：

```js
function* dispatch(i) {
  ...
  yield fn(ctx, () => co(dispatch)(ctx, i + 1));   // ❌
}
```

结果：

```
执行顺序: g1 前 → g1 后        ← g2 完全没执行
```

**两个错误**：

1. `fn` 是 generator 函数，`fn(ctx, ...)` 返回的是**未启动的 generator 对象**，不是 Promise。`co` 遇到它会当成普通值 `resolve` 掉，**不会去驱动它**。必须 `co(fn)(ctx, ...)`。
2. `next` 返回的也必须是 **Promise**，不能是 generator 对象。所以要用 `co(function*(){...})()`。

**修正后**：

```js
yield co(fn)(ctx, function () {
  return co(function* () { yield* dispatch(i + 1); })();   // ← 返回 Promise
});
```

> **这个坑恰好是 `co` 的核心难点**：
> 「`co` 只驱动 **generator 和 Promise** 两种东西。如果你 `yield` 一个**未启动的 generator 对象**，它会当成普通值处理，什么都不发生——**静默失败，最难排查。** 所以 Koa 1 的中间件必须写成 `yield co(fn)(ctx)` 而不是 `yield fn(ctx)`。」

### 三者的对应关系

| Koa 1（generator） | Koa 2（async） |
|---|---|
| `function* (ctx, next) {}` | `async (ctx, next) => {}` |
| `yield next()` | `await next()` |
| `yield Promise` | `await Promise` |
| `co(fn)(ctx)` | `fn(ctx)` |
| `yield* dispatch(i)` | `return dispatch(i)` |

**本质**：`async/await` 就是「语言内置的 co」。V8 直接帮你做了「挂起 / 恢复」这件事。

---

## 5.5 Koa 的异常处理（题 21）

### 题单答案

> 「最外层加 try/catch：
> ```js
> app.use(async (ctx, next) => {
>   try { await next(); }
>   catch (err) { ctx.body = { error: err.message }; ctx.status = 500; }
> });
> ```
> 」

**这个答案是对的，而且是最佳实践**。但缺三点解释：

1. **为什么放在最外层就行**——因为洋葱模型的错误会「反向冒泡」
2. **`app.on('error')` 是干什么的**——它捕获的是「没被中间件捕获的」
3. **`ctx.throw` 是什么**——Koa 提供的语法糖

### 实测：异常会一路冒泡回来

```js
app.use(async (ctx, next) => {
  try { await next(); }
  catch (e) { ctx.status = 500; ctx.body = { error: e.message }; }
});
app.use(async () => { throw new Error('内层炸了'); });
```

**实测输出**：

```
status = 500  body = {"error":"内层炸了"}
```

**为什么**？因为洋葱模型本质是 **Promise 链**：

```
dispatch(0) → Promise.resolve(mw1(ctx, () => dispatch(1)))
                                          ↓
                              dispatch(1) → 内层 throw
                                          ↓
                              Promise rejected
                                          ↓
                              mw1 的 await next() 抛错
                                          ↓
                              mw1 的 try/catch 捕获
```

**错误沿着 `await next()` 反向传回来**，所以最外层的 `catch` 能兜住所有内层的错误。

> **这是洋葱模型的第二个价值**（第一个是「能在响应后加工」）：
> **「统一错误处理只需要写一次，放在最外层。所有内层的错误都会冒泡回来。」**
>
> 而在 Express 里也可以做到（用 `(err, req, res, next)` 四参中间件），但需要**每个** `next(err)` 都正确传递，容易漏。

### `app.on('error')` 捕获什么

```js
app.on('error', (err, ctx) => {
  console.error('未捕获的错误', err);
});
```

**它捕获的是「所有没被中间件 catch 的异常」**，包括：

- 中间件抛错且没有 try/catch
- Koa 内部错误
- **`ctx.body` 序列化失败**

**重要区别**：

| 方式 | 捕获范围 | 能否改响应 |
|---|---|---|
| 中间件 `try/catch` | 内层所有错误 | ✅ 能改 status/body |
| `app.on('error')` | 兜底 | ❌ **响应已经发出去了，只能记日志** |

> **所以两个都要有**：
> 「中间件的 try/catch 负责**返回友好的错误响应**；`app.on('error')` 负责**兜底记录日志和上报**——因为有些错误发生在响应已经开始发送之后，那时候改不了响应，只能记下来。」

### 生产级错误处理中间件

```js
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    // ① 业务错误（可预期）→ 用 err.status
    const status = err.status || err.statusCode || 500;
    ctx.status = status;
    ctx.body = {
      code: status,
      message: status < 500 ? err.message : '服务器内部错误',
      // ② 生产环境不要暴露 stack
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    };

    // ③ 5xx 才上报（4xx 是客户端问题，不用告警）
    if (status >= 500) {
      ctx.app.emit('error', err, ctx);   // 交给 app.on('error')
    }
  }
});
```

**三个细节**：

1. **4xx 和 5xx 区分对待**——4xx 是用户的问题（不该告警），5xx 才是服务的问题
2. **生产不暴露 stack**——泄露路径和代码结构
3. **用 `ctx.app.emit('error')` 转发**——让统一的上报逻辑在一个地方

### `ctx.throw` 语法糖

```js
ctx.throw(401, '未登录');
// 等价于
const err = new Error('未登录');
err.status = 401;
err.expose = true;      // ← 表示「这条消息可以给用户看」
throw err;
```

`expose: true` 是关键：它标记「这个错误消息对用户是安全的」，所以上面的中间件可以直接 `err.message` 返回。

> **`expose` 是 Koa 很贴心的设计**：区分「用户能看的错」（账号密码错）和「用户不该看的错」（数据库连接失败）。

---

## 5.6 Koa vs Express（题 25）

### 题单答案

> 「Express：回调风格，内置 router/中间件，大而全。Koa：async/await 洋葱模型，轻量，router/body-parser 都是中间件需要自己装。Koa 用 Promise 避免回调地狱，错误处理更优雅。」

**基本对，但有两处需要修正**：

| 题单说 | 更准确的说法 |
|---|---|
| 「Express 回调风格」 | **Express 4 也支持 async 中间件，但错误不会自动捕获**（这是最大的坑） |
| 「Koa 避免回调地狱」 | Koa 2 用的是 **async/await**，不是 Promise 链。而且**Express 里也能用 async/await** |

### 十项对比

| 维度 | Express | Koa |
|---|---|---|
| **中间件模型** | 数组 + 游标，`next()` **单向** | **洋葱模型**，`await next()` 可双向 |
| **`next()` 之后** | 回不来（只能注册 `res.on('finish')`） | ✅ 能回来，可加工响应 |
| **错误处理** | 四参中间件 `(err, req, res, next)`，**async 中间件的错误要手动 `next(err)`** | 最外层 `try/catch` 一次搞定 |
| **`ctx` 对象** | `req` / `res` 分离（原生对象） | **`ctx` 合一**，有 `ctx.state` / `ctx.throw` / `ctx.body` |
| **内置功能** | Router / body-parser / static 都内置 | **全都要装**（`@koa/router`、`koa-bodyparser`、`koa-static`） |
| **体积** | 较大 | 极轻（核心只有几百行） |
| **生态** | **最庞大**（十几年的积累） | 较小，但够用 |
| **学习曲线** | 平缓 | 略高（要先理解洋葱） |
| **性能** | 略低（中间件是回调链） | 略高（实测差距不大，都在微秒级） |
| **适合** | 老项目、需要大量现成中间件 | 新项目、需要精细控制流程 |

### 最关键的一个差异：Express 的 async 错误不会自动捕获

```js
// Express 4
app.get('/user', async (req, res, next) => {
  const user = await db.find();     // ← 如果这里抛错
  res.json(user);
});
```

**这个错误不会被 Express 捕获**！会导致 **unhandledRejection**，请求永远挂起（客户端超时）。

**必须手动包**：

```js
// 方案 A：每个 handler 都 try/catch
app.get('/user', async (req, res, next) => {
  try { res.json(await db.find()); }
  catch (e) { next(e); }             // ← 必须手动 next(err)
});

// 方案 B：包一层工具函数
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
app.get('/user', wrap(async (req, res) => { res.json(await db.find()); }));

// 方案 C：用 express-async-errors（打补丁）
require('express-async-errors');
```

> **Express 5 修复了这个问题**（2024 年发布，终于原生支持 async 错误的自动转发）。但**线上大量项目还在 Express 4**，所以这个坑依然存在。
>
> **面试时这句话很有价值**：
> 「Express 4 用 async 中间件有个隐藏坑：**抛错不会自动传给错误处理中间件**，会变成 unhandledRejection，请求挂住直到超时。必须手动 `try/catch` + `next(err)`，或者用 `express-async-errors`。这是我从 Express 迁到 Koa 的主要原因之一。」

### Koa 的 `ctx` 为什么更好用

```js
// Express：req 和 res 分开
app.get('/x', (req, res) => {
  res.status(200).json({ ok: true });
});

// Koa：ctx 合一，直接赋值
app.use(async (ctx) => {
  ctx.status = 200;
  ctx.body = { ok: true };      // ← 自动序列化 JSON（根据 Accept）
});
```

**`ctx.body` 的好处**：

| 赋值的类型 | Koa 自动做什么 |
|---|---|
| 对象/数组 | `JSON.stringify` + `Content-Type: application/json` |
| string | 直接发送 + `text/plain` |
| Buffer/Stream | 直接 pipe |
| `null` | 204 No Content |

**这就是「约定优于配置」**：不用记 `res.json` / `res.send` / `res.end` 的区别。

### 选型建议（说取舍才有分）

> 「我的判断是：
>
> **新项目我倾向 Koa**——洋葱模型让「统一错误处理」「耗时统计」「响应加工」都只需要一个中间件，代码更清晰；`ctx` 比 `req`/`res` 分离好用；async 错误天然被捕获。
>
> **但老项目我不会迁**——Express 的生态太成熟了，`passport`、`multer`、各种现成中间件，迁过去要重写一堆。而且 Express 5 已经修了 async 错误的问题。
>
> **规模上去了两者都不够**——如果要做几十个接口、需要 DI 和模块化，会用 NestJS；如果追求极致性能，会考虑 Fastify（它的 schema 编译能快 2-3 倍）。」

---

## 5.7 中间件的概念与封装（题 8）

### 题单答案

> 「中间件是请求-响应循环中的处理函数，接收 `(req, res, next)`，可以修改请求/响应、做鉴权、日志、错误处理，然后调用 `next()` 进入下一个。
> ```js
> function logger(req, res, next) {
>   console.log(`${req.method} ${req.url}`);
>   next();
> }
> ```」

**这是 Express 的签名**。Koa 的签名是 `(ctx, next)` —— **题单混了**。

### 两种签名

```js
// Express：三个参数（req, res, next）
function logger(req, res, next) {
  console.log(req.method, req.url);
  next();
}

// Koa：两个参数（ctx, next）
async function logger(ctx, next) {
  console.log(ctx.method, ctx.url);
  await next();
}
```

### 中间件的本质

> **中间件 = 「在请求到达业务逻辑之前/之后，插入一段通用处理」的机制。**

没有中间件会怎样：

```js
app.get('/a', (req, res) => {
  console.log('log');           // 重复
  if (!auth(req)) return res.status(401).end();   // 重复
  // 业务
});
app.get('/b', (req, res) => {
  console.log('log');           // 重复
  if (!auth(req)) return res.status(401).end();   // 重复
  // 业务
});
```

**中间件把「横切关注点」抽出来了**：日志、鉴权、限流、CORS、压缩、错误处理——这些跟具体业务无关，但每个接口都要。

### 封装一个生产级中间件

「如何封装中间件」这个问题的答案，我建议用**一个真实有用的例子**：请求 ID + 耗时统计。

```js
const { randomUUID } = require('node:crypto');

function requestContext({ headerName = 'x-request-id' } = {}) {
  return async function requestContextMiddleware(ctx, next) {
    // ① 生成或继承请求 ID（支持上游链路追踪）
    const reqId = ctx.get(headerName) || randomUUID();
    ctx.state.reqId = reqId;
    ctx.set(headerName, reqId);           // 响应里也带上，方便前后端对账

    // ② 记录开始时间
    const start = process.hrtime.bigint();

    try {
      await next();
    } finally {
      // ③ 无论成功失败都记录（★ finally 是关键）
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const log = {
        reqId,
        method: ctx.method,
        url: ctx.url,
        status: ctx.status,
        ms: +ms.toFixed(2),
        ip: ctx.ip,
      };
      console.log(JSON.stringify(log));

      ctx.set('X-Response-Time', `${ms.toFixed(0)}ms`);
    }
  };
}

app.use(requestContext());
```

**四个设计要点**：

| 要点 | 为什么 |
|---|---|
| `ctx.state.reqId` | 让后续中间件和业务能拿到同一个 ID，日志才能串起来 |
| `ctx.get(headerName)` 继承上游 | 微服务链路追踪需要传递同一个 traceId |
| **`finally` 而不是 `try/catch`** | 无论成功失败都要记录。**用 `catch` 会吞掉错误**（除非 rethrow） |
| `process.hrtime.bigint()` | 纳秒精度且**单调递增**（不受系统时间调整影响）。`Date.now()` 会被 NTP 调整影响 |

> **最后一条是细节但很值钱**：
> 「统计耗时不要用 `Date.now()`——系统时间被 NTP 校正时会跳变，可能出现负数。用 `process.hrtime.bigint()`，它是单调时钟。」

### 中间件的注册顺序很重要

```js
app.use(errorHandler());     // ① 错误处理放最外层（要第一个注册）
app.use(requestContext());   // ② 请求上下文
app.use(logger());           // ③ 日志
app.use(cors());             // ④ 跨域（要在鉴权之前，否则预检请求会被拦）
app.use(bodyParser());       // ⑤ body 解析（要在业务之前）
app.use(router.routes());    // ⑥ 业务路由
```

**为什么 CORS 要在鉴权之前**：`OPTIONS` 预检请求**不带 Authorization 头**，如果鉴权中间件在前，预检会被 401 拦掉，跨域直接失败。

> **这是个真实踩过的坑**：
> 「`OPTIONS` 预检请求不带认证头。如果鉴权中间件注册在 CORS 之前，预检就会被 401，前端连真正的请求都发不出去，控制台只报 CORS 错误——**看起来像跨域配置问题，实际是中间件顺序问题。**」

---

## 5.8 body-parser 是什么（题 18）

### 题单答案

> 「解析 HTTP 请求体，把 `req.body` 填成对象。支持 JSON、urlencoded、文本。Express 内置了。」

**基本对，但有一处重要修正：Express 4.16+ 才内置，之前要单独装。而且「为什么需要它」才是考点。**

### 为什么需要它

原生 http 的请求体是**流**，要自己拼：

```js
// 原生写法
let body = '';
req.on('data', chunk => body += chunk);
req.on('end', () => {
  const data = JSON.parse(body);   // ← 要自己处理编码、大小限制、解析失败
});
```

**四个麻烦**：

1. **编码**：`data` 事件给的是 Buffer，拼接要注意多字节字符（前面 Buffer 那节讲过）
2. **大小限制**：如果不限制，一个 1GB 的请求体会把内存打爆（**DoS 攻击向量**）
3. **Content-Type**：要根据类型选解析方式（JSON / urlencoded / multipart）
4. **错误处理**：JSON 格式错了要返回 400，不是 500

**`body-parser` 就是把这四件事做好**。

### 实际用法（Express）

```js
// Express 4.16+ 内置
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
```

| 参数 | 作用 |
|---|---|
| `limit` | **请求体大小上限**（默认 100kb）。**必须显式设置合理值**，防 DoS |
| `extended` | urlencoded 用 `qs` 库（支持嵌套）还是 `querystring`（只支持扁平） |
| `type` | 匹配哪些 Content-Type（默认 `application/json`） |
| `verify` | 自定义校验（比如校验 webhook 签名，需要**原始 body**） |

### 三个坑

#### 坑 1：`limit` 默认只有 100kb

```js
// 上传一个 200kb 的 JSON → 413 Payload Too Large
```

**这个「坑」其实是保护**。但很多人不知道默认值，调试半天。

#### 坑 2：上传文件不能用 body-parser

`body-parser` **只处理文本类**（JSON / urlencoded / text）。`multipart/form-data` 要用 `multer` 或 `busboy`。

**为什么**？因为 multipart 是二进制 + 边界分隔，不能整体读进内存再解析——**必须流式处理**（大文件可能几个 GB）。

#### 坑 3：webhook 签名校验需要原始 body

```js
// ❌ 错：body 已经被 JSON.parse 了，重新 stringify 顺序可能不同
app.use(express.json());
app.post('/webhook', (req, res) => {
  const sig = crypto.createHmac('sha256', secret)
    .update(JSON.stringify(req.body))   // ← 顺序和原始的不一定一样！
    .digest('hex');
});
```

**正确做法**：用 `verify` 保留原始 Buffer。

```js
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;      // 保留原始字节
  },
}));

app.post('/webhook', (req, res) => {
  const sig = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');
});
```

> **这个坑很值钱**：
> 「做支付/微信回调的 webhook 校验时，**签名必须对原始字节算**，不能对 `JSON.stringify(req.body)` 算——因为 parse + 重新序列化后，key 的顺序、空格、数字格式都可能变。要用 `verify` 保留原始 Buffer。」

### Koa 里怎么用

```js
const bodyParser = require('koa-bodyparser');
app.use(bodyParser({ jsonLimit: '1mb' }));
// → ctx.request.body
```

**注意 Koa 里是 `ctx.request.body`，不是 `ctx.body`**（`ctx.body` 是**响应**体）。

> **这个区分是 Koa 新手最常犯的错**：`ctx.body` 是「我要返回什么」，`ctx.request.body` 是「收到的请求体」。

---

## 5.9 面试怎么说（2 分钟版）

> 「Koa 中间件的核心是洋葱模型，我一般直接从实现讲，因为**描述现象谁都会，能说清怎么做才是区分度**。
>
> 洋葱模型就是一个 `compose` 函数，核心 15 行：一个 `dispatch(i)` 递归，把 `() => dispatch(i + 1)` 作为 `next` 传给当前中间件。**因为 `dispatch` 返回 Promise，所以 `await next()` 等于等内层全部执行完——包括内层的后半段。** 这就是为什么外层能在 `await next()` 之后继续执行。
>
> 这个设计带来两个能力：
>
> **第一，统一错误处理**。最外层一个 `try/catch` 就能兜住所有内层的错误，因为错误会沿 Promise 链反向冒泡。
>
> **第二，响应加工**。外层可以在内层处理完之后改 `ctx.body`、加 header、统计耗时。**这个在 Express 里很难做**，因为 Express 的 `next()` 是单向的，回不来。
>
> 还有一个守卫细节：`compose` 里有个 `index` 变量，作用是**检测 `next()` 被调用两次**——重复执行中间件会导致重复写响应、重复扣款，所以直接报错。
>
> 至于没有 async/await 的时代，Koa 1 用 generator + co。**co 的本质是一个自动执行器**：不断调 `gen.next()`，把 `yield` 出来的 Promise 等完再送回去。我手写过这个版本，踩过一个坑——**`yield` 一个未启动的 generator 对象，co 会当成普通值处理，静默什么都不做**。所以 Koa 1 必须写 `yield co(fn)(ctx)` 而不是 `yield fn(ctx)`。」

---

## 5.10 追问总表

| 问题 | 答法 |
|---|---|
| 洋葱模型一句话？ | 递归 dispatch + Promise 链，`await next()` 等内层全部完成 |
| `compose` 的核心是什么？ | `dispatch(i)` + 把 `() => dispatch(i+1)` 当 next 传进去 |
| 为什么要返回 Promise？ | 让 `await next()` 能等内层完成（含内层后半段） |
| `index` 守卫干什么？ | 检测 `next()` 调两次，防中间件重复执行 |
| 不调 `next()` 会怎样？ | 短路，后续中间件不执行（鉴权/限流/缓存用） |
| 外层能改内层设置的 body 吗？ | ✅ 能，因为响应在 `respond()` 时才真正发出 |
| 错误怎么冒泡回来？ | 洋葱本质是 Promise 链，reject 会沿 `await next()` 反向传播 |
| `app.on('error')` 捕获什么？ | 没被中间件 catch 的（此时改不了响应，只能记日志） |
| `ctx.throw` 是什么？ | 语法糖，`ctx.throw(401, 'msg')`，会设 `expose: true` |
| Koa 1 怎么实现洋葱？ | generator + co，`yield next()` 等价 `await next()` |
| co 的本质？ | 自动执行器：`gen.next()` + `Promise.resolve(yield的值)` |
| `yield` 一个 generator 对象会怎样？ | **静默不执行**（co 只驱动 generator 函数调用和 Promise） |
| Express 的中间件为什么不是洋葱？ | 数组 + 游标，`next()` 单向，回不来 |
| Express 4 用 async 中间件的坑？ | 错误不会自动传给错误中间件，变 unhandledRejection |
| Express 5 修了吗？ | 修了，但线上大量项目还在 4 |
| Koa 的 `ctx.body` 和 `ctx.request.body`？ | 前者是响应体，后者是请求体（**新手最常混**） |
| 中间件顺序有什么讲究？ | CORS 必须在鉴权之前（预检请求不带 Authorization） |
| body-parser 默认 limit？ | 100kb，超了 413 |
| 为什么上传文件不能用 body-parser？ | multipart 是二进制 + 边界，必须流式处理 |
| webhook 签名为什么不能用 `JSON.stringify(req.body)`？ | 重新序列化后 key 顺序/格式会变，要用 `verify` 保留原始 Buffer |

---

## 5.11 速记卡

```
【洋葱模型核心 15 行】
function compose(mws) {
  return (ctx, next) => {
    let index = -1
    function dispatch(i) {
      if (i <= index) return Promise.reject(new Error('next() called multiple times'))  ★守卫
      index = i
      let fn = i === mws.length ? next : mws[i]
      if (!fn) return Promise.resolve()
      try { return Promise.resolve(fn(ctx, () => dispatch(i + 1))) }   ★next 就是 dispatch(i+1)
      catch (e) { return Promise.reject(e) }
    }
    return dispatch(0)
  }
}

【实测顺序】
mw1 前 → mw2 前 → mw3 → mw2 后 → mw1 后
前半正序，后半逆序

【为什么能「回来」】
dispatch 返回 Promise
await next() = 等内层全部执行完（含内层后半段）

【两个能力】
① 统一错误处理：最外层 try/catch 兜住全部（错误沿 Promise 链反向冒泡）
② 响应加工：await next() 之后能改 ctx.body / 加 header / 算耗时
   ← Express 做不到（next 单向）

【不调 next】短路
鉴权 401 / 限流 429 / 缓存命中 → 直接 return，后续不执行

【实测：next() 两次】
→ "next() called multiple times"（index 守卫拦的）

【co 版】
co = 自动执行器：gen.next() + Promise.resolve(yield值) + step('next'/'throw')
yield next() ⇔ await next()
★ 坑：yield 未启动的 generator 对象 → co 当普通值，静默不执行
  必须 yield co(fn)(ctx) 而不是 yield fn(ctx)
  next 必须返回 Promise

【Koa vs Express】
模型    洋葱(双向)          数组+游标(单向)
错误    try/catch 一次      四参中间件 / async 要手动 next(err)
ctx     合一，有 throw      req/res 分离
内置    几乎没有             全都有
体积    极轻                 较大
生态    小                   最大

★ Express 4 的 async 坑
async handler 抛错不会自动传给错误中间件 → unhandledRejection + 请求挂起
解法：try/catch + next(err) / wrap 函数 / express-async-errors
Express 5 已修复

【中间件顺序】
errorHandler → context → logger → CORS → bodyParser → router
★ CORS 必须在鉴权前（OPTIONS 预检不带 Authorization）

【body-parser】
解决四件事：编码 / 大小限制 / Content-Type / 解析错误
默认 limit 100kb（超了 413）
multipart 不能用它（要 multer，流式）
★ webhook 签名要用 verify 保留 rawBody（不能 JSON.stringify 重算）

【耗时统计用 process.hrtime.bigint()】
单调时钟，不受 NTP 校正影响（Date.now 可能跳成负数）
```

---

## 5.12 自测

```
□ 能默写 compose 的 15 行核心代码
□ 能解释为什么 dispatch 要返回 Promise
□ 能解释 index 守卫的作用和没有它会怎样
□ 能说出「不调 next」的三种实际用途
□ 能解释外层为什么能改内层设置的 body
□ 能说出洋葱模型带来的两个能力
□ 能解释错误为什么能冒泡回最外层
□ 能说出 app.on('error') 和 try/catch 的分工
□ 能说出 ctx.throw 做了什么（含 expose）
□ 能写出 co 的核心三行
□ 能说出「yield 未启动 generator」会发生什么
□ 能列出 Express 与 Koa 的至少五项差异
□ 能说出 Express 4 async 中间件的坑和三种解法
□ 能说出 ctx.body 和 ctx.request.body 的区别
□ 能说出中间件的推荐注册顺序和 CORS 的位置原因
□ 能说出 body-parser 解决的四个问题和默认 limit
□ 能说出 webhook 签名为什么不能用 JSON.stringify
□ 能说出耗时统计为什么不用 Date.now()
```
