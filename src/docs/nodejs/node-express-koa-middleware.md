# Node 05｜Express 与 Koa 中间件

> 覆盖题号：8（中间件概念与封装）、19（不调 await next() 会怎样）、20（无 async 时怎么实现洋葱模型）、21（Koa 中间件异常）、23（洋葱模型）、25（koa vs express）、18（body-parser）
> 去重后：**5 个考点**
>
> 19/20/21/23/25 是同一机制的不同侧面，一套 `compose` + `ctx` 就能答完。
>
> 实测环境：Node 22.12，Koa 2.16.4 / Koa 1.7.1，Express 4.22.3 / 5.3.0，co 4.6.0。

---

## 目录

- [5.1 题单答案的问题](#51-题单答案的问题)
- [5.2 一句话结论](#52-一句话结论)
- [5.3 洋葱模型（一次讲透）](#53-洋葱模型一次讲透)
- [5.4 没有 async/await 时怎么实现](#54-没有-asyncawait-时怎么实现)
- [5.5 Koa 的异常处理](#55-koa-的异常处理)
- [5.6 Koa vs Express](#56-koa-vs-express)
- [5.7 中间件的概念与封装](#57-中间件的概念与封装)
- [5.8 body-parser 是什么](#58-body-parser-是什么)
- [5.9 面试怎么说（2 分钟版）](#59-面试怎么说2-分钟版)
- [5.10 追问总表](#510-追问总表)
- [5.11 速记卡](#511-速记卡)
- [5.12 自测](#512-自测)

---

## 5.1 题单答案的问题

题单的结论都成立，缺的是实现机制：

| 题单结论 | 缺的机制 |
|---|---|
| 19 不调 `await next()` 就停在这里 | `dispatch(i)` 递归 + `index` 守卫 |
| 20 Koa 1 用 generator + co，`yield next` 等价 `await next()` | co 如何驱动 generator；`yield next` 为什么不能写成 `yield next()` |
| 21 最外层 try/catch 兜住异常 | 错误沿 Promise 链反向传播的原因 |
| 23 每层在 `await next()` 前后处理 | `await next()` 等的为什么是「内层完整执行」 |
| 25 Express 回调风格、Koa 洋葱模型 | Express 的数组 + 游标模型，`next()` 无返回值意味着什么 |
| 8 中间件是 `(req, res, next)` | Koa 的签名是 `(ctx, next)`，两套不能混用 |

---

## 5.2 一句话结论

> **Koa 的洋葱模型 = 递归的 `dispatch(i)` + Promise 链。**
>
> **Express 的中间件 = 数组 + 游标，`next()` 只能往后走，且没有返回值。**

---

## 5.3 洋葱模型（一次讲透）

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

`await next()` 之前的代码正序执行，之后的代码逆序执行。

### 实测：执行顺序

Koa 2.16 + 三个中间件：

```
mw1 前 → mw2 前 → mw3（最内层） → mw2 后 → mw1 后
```

前一半正序（1→2→3），后一半逆序（3→2→1）。

### 核心实现：compose

```js
function compose(middlewares) {
  return function (ctx, next) {
    let index = -1; // 已执行到第几个中间件

    function dispatch(i) {
      // 守卫：同一个 next 被调用两次
      if (i <= index) {
        return Promise.reject(new Error('next() called multiple times'));
      }
      index = i;

      let fn = middlewares[i];
      if (i === middlewares.length) fn = next; // 全部走完，调外部 next
      if (!fn) return Promise.resolve();

      try {
        // 把「下一个」包成函数传进去，这就是 next
        return Promise.resolve(fn(ctx, () => dispatch(i + 1)));
      } catch (err) {
        return Promise.reject(err);
      }
    }

    return dispatch(0);
  };
}
```

- **`dispatch` 返回 Promise**：`next` 是 `() => dispatch(i + 1)`，返回的是第 i+1 层连同其后半段的完成状态，所以 `await next()` 等的是内层全部完成。
- **`index` 守卫**：`i <= index` 说明同一个 `next` 被调了第二次，直接 reject。实测 Koa 2 返回 500 `Internal Server Error`，`next() called multiple times` 只能从 `app.on('error')` 拿到。没有守卫时内层会被执行两遍。
- **`i === middlewares.length`**：取外部的 `next`；外部没传则 `fn` 为 `undefined`，`Promise.resolve()` 结束。
- **`Promise.resolve(fn(...))`**：只保证 `dispatch` 始终返回 Promise。同步中间件不 `return next()` 时 `dispatch` 立即 resolve，后半段顺序会变成 `a → c → b`（实测），洋葱失效。

### 不调 `await next()` 会怎样

实测：

```js
app.use(async (ctx) => { log.push('mw1'); ctx.status = 401; ctx.body = 'stop'; });
app.use(async (ctx) => { log.push('mw2'); });
// log: ['mw1']，响应 401
```

不调 `next()` 就没有 `dispatch(1)`，后续中间件不执行。用途：

- 鉴权：token 无效直接 401
- 限流：超限直接 429
- 缓存：命中直接返回，不查库

```js
app.use(async (ctx, next) => {
  if (!ctx.headers.authorization) {
    ctx.status = 401;
    ctx.body = { error: '未登录' };
    return;
  }
  await next();
});
```

### 响应什么时候发出

`ctx.body` 的 setter 只把值存进 `_body` 并设置状态，真正写响应发生在中间件链 resolve 之后的 `respond(ctx)`。实测外层在 `await next()` 之后赋 `ctx.body = 'outer'`，客户端收到 `outer`；外层 `ctx.set()` 设置的响应头同样生效。

```js
app.use(async (ctx, next) => {
  const start = process.hrtime.bigint();
  await next();
  ctx.set('X-Response-Time', `${Number(process.hrtime.bigint() - start) / 1e6}ms`);
});
```

Express 没有等价写法：`next()` 没有返回值，拿不到内层完成时机，只能在 `res.on('finish')` 里补。

---

## 5.4 没有 async/await 时怎么实现

### 题单答案：generator + co

Koa 1 用 generator + co，`yield next` 等价 `await next()`；Koa 2 改成 async/await。结论成立，缺的是 co 的驱动方式。

### co 是自动执行器

Generator 调用不会执行函数体，只返回迭代器：

```js
function* gen() {
  console.log('不会立刻执行');
  yield 1;
}
const it = gen(); // 无输出
it.next();        // 执行到第一个 yield
```

co 负责反复调 `gen.next(value)`：

```js
function co(genFn) {
  return function (...args) {
    const gen = genFn.apply(this, args);
    return new Promise((resolve, reject) => {
      function step(key, arg) {
        let res;
        try {
          res = gen[key](arg); // next() 或 throw()
        } catch (e) {
          return reject(e);
        }
        if (res.done) return resolve(res.value);
        Promise.resolve(res.value).then(
          (v) => step('next', v),
          (e) => step('throw', e), // 出错往 generator 里 throw
        );
      }
      step('next');
    });
  };
}
```

三步：`gen.next()` 拿 `{ value, done }`；`Promise.resolve(value)` 等 yield 出来的值；拿到结果 `step('next', v)`，出错 `step('throw', e)`。

上面的实现只处理 Promise。co 4.6 的 `toPromise` 按类型分派 function（thunk）、promise、generator、array、object，其他值直接抛 `TypeError`（实测 `yield 42` 报 `You may only yield a function, promise, generator, array, or object`）。

### Koa 1 的 generator 版洋葱模型

koa-compose 2.x 不递归，从后往前把中间件包成 generator 链：

```js
function compose(middleware) {
  return function* (next) {
    if (!next) next = noop();

    let i = middleware.length;
    while (i--) {
      next = middleware[i].call(this, next);
    }

    return yield* next;
  };
  function* noop() {}
}
```

中间件签名是 `function* (next)`，`next` 是下游 generator，`this` 是 ctx；`yield* next` 从链头开始执行。

### 三者的对应关系

| Koa 1（generator） | Koa 2（async） |
|---|---|
| `function* (next) {}`，`this` 是 ctx | `async (ctx, next) => {}` |
| `yield next`（next 是 generator，不能调用） | `await next()` |
| `yield Promise` | `await Promise` |
| `compose(...).call(ctx, next)` | `fn(ctx, next)` |

实测 Koa 1.7：`yield next` 的顺序与 Koa 2 一致；写成 `yield next()` 报 `TypeError: next is not a function`，客户端 500。async/await 相当于语言内置的自动执行器，挂起与恢复由引擎完成。

---

## 5.5 Koa 的异常处理

### 题单答案：最外层 try/catch

```js
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.body = { error: err.message };
    ctx.status = 500;
  }
});
```

这是标准做法，需要补充三点：为什么最外层就够、`app.on('error')` 的角色、`ctx.throw` 做了什么。

### 错误为什么能冒泡回最外层

```js
app.use(async (ctx, next) => {
  try { await next(); }
  catch (e) { ctx.status = 500; ctx.body = { error: e.message }; }
});
app.use(async () => { throw new Error('内层炸了'); });
// 实测：500 {"error":"内层炸了"}
```

`dispatch(0)` 返回的是 mw1 返回的 Promise。内层 reject 会让 mw1 的 `await next()` 抛出，由它自己的 catch 捕获。Express 的等价物是四参错误中间件，但每个异步 handler 都要自己 `next(err)`。

### `app.on('error')` 捕获什么

| 方式 | 触发范围 | 作用 |
|---|---|---|
| 中间件 try/catch | 内层抛出的错误 | 决定 status / body |
| `app.on('error')` | 没被中间件捕获的错误 | 事件回调，用于日志与上报 |

`app.on('error')` 不生成响应，响应由 Koa 的 `ctx.onerror` 处理（实测未捕获时客户端收到 500 `Internal Server Error`）。实测最外层有 try/catch 时该事件不触发；去掉 try/catch 后触发一次。

两者分工：try/catch 返回可控的错误响应；`app.on('error')` 兜底记录，包括 headers 已发出、无法再改响应的错误。

### 生产级错误处理中间件

```js
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    const status = err.status || err.statusCode || 500;
    ctx.status = status;
    ctx.body = {
      code: status,
      message: status < 500 ? err.message : '服务器内部错误',
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    };

    if (status >= 500) {
      ctx.app.emit('error', err, ctx); // 交给 app.on('error') 统一上报
    }
  }
});
```

三个细节：

1. 4xx 是客户端问题，不告警；5xx 才上报
2. 生产环境不返回 stack，避免泄露路径与代码结构
3. `ctx.app.emit('error', err, ctx)` 把上报集中到一处

### `ctx.throw` 语法糖

```js
ctx.throw(401, '未登录');
// 等价于
const err = new Error('未登录');
err.status = 401;
err.expose = true;
throw err;
```

`expose` 由 http-errors 按 status 决定：4xx 为 true，5xx 为 false（实测 401 → `expose=true`，500 → `expose=false`）。它标记「消息可以直接给用户看」，所以上面对 4xx 用 `err.message`、5xx 用固定文案。

---

## 5.6 Koa vs Express

### 题单答案：两处修正

「Express：回调风格，内置 router/中间件，大而全。Koa：async/await 洋葱模型，轻量，router/body-parser 都要自己装。」基本对，两处要补：

- Express 4 也支持 async 中间件，但 async 抛错不会被自动捕获
- Koa 2 用 async/await，Express 同样能用 async/await

### 对比

| 维度 | Express | Koa |
|---|---|---|
| 中间件模型 | 数组 + 游标，`next()` 无返回值 | compose + Promise，`await next()` 等内层 |
| `next()` 之后 | 同步代码仍会执行（实测 `h1前 → h2 → h1后`），但没有等待内层完成的机制 | 能拿到内层完成时机，可加工响应 |
| 错误处理 | 四参中间件 `(err, req, res, next)`；async 错误要手动 `next(err)` | 最外层 try/catch |
| 上下文 | `req` / `res` 分离 | `ctx` 合一，含 `state` / `throw` / `body` |
| 内置能力 | Router、json/urlencoded、static 都内置 | 路由、body 解析、静态文件都要装 |
| 体积 | 依赖较多 | 核心 4 个源文件（application/context/request/response） |
| 生态 | 现成中间件最多（passport、multer 等） | 较小 |
| 适用 | 存量项目、依赖现成中间件 | 需要精细控制流程 |

### Express 4 的 async 错误

```js
app.get('/user', async (req, res, next) => {
  const user = await db.find(); // 这里抛错不会进入错误中间件
  res.json(user);
});
```

实测 Express 4.22（注册全局 `unhandledRejection` 监听以观察）：请求挂起直到客户端超时，同时产生一次 `unhandledRejection`。Node 15+ 默认把未处理的 rejection 当未捕获异常（`node -e "Promise.reject(new Error('x'))"` 退出码 1），没注册全局 handler 时进程会退出。

三种修法：

```js
// A. 每个 handler 自己 try/catch
app.get('/user', async (req, res, next) => {
  try { res.json(await db.find()); }
  catch (e) { next(e); }
});

// B. 包一层
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// C. express-async-errors 打补丁
require('express-async-errors');
```

B、C 实测都能让错误进入四参中间件（C 返回 500 与原始 message）。Express 5 已原生支持自动转发（实测 async throw → 四参中间件返回 500；5.0.0 发布于 2024-09-10，当前 latest 5.3.0，4.x 仍在维护 latest-4 4.22.3）。

### Koa 的 ctx

```js
app.use(async (ctx) => {
  ctx.status = 200;
  ctx.body = { ok: true };
});
```

实测 `ctx.body` 的类型分派：

| 赋值 | 响应 |
|---|---|
| 对象 / 数组 | `JSON.stringify`，`application/json` |
| 字符串 | `text/plain`；以 `<` 开头则为 `text/html` |
| Buffer / Stream | 直接发送（`application/octet-stream`）或 pipe |
| `null` | 204 No Content |

### 选型

- 新项目、需要统一错误处理、耗时统计、响应加工：Koa 的模型更直接
- 存量项目、依赖 passport / multer 等现成中间件：留在 Express

---

## 5.7 中间件的概念与封装

### 两种签名

```js
// Express：三个参数
function logger(req, res, next) {
  console.log(req.method, req.url);
  next();
}

// Koa：两个参数
async function logger(ctx, next) {
  console.log(ctx.method, ctx.url);
  await next();
}
```

题单里的 `(req, res, next)` 是 Express 签名，Koa 是 `(ctx, next)`，两套不能混用。

### 中间件的本质

> 在请求到达业务逻辑之前 / 之后插入通用处理的机制。

没有中间件时，日志、鉴权这类横切逻辑要在每个 handler 里重复。中间件把它们抽出来：日志、鉴权、限流、CORS、压缩、错误处理——与具体业务无关，但每个接口都要。

### 封装：请求 ID + 耗时

```js
const { randomUUID } = require('node:crypto');

function requestContext({ headerName = 'x-request-id' } = {}) {
  return async function requestContextMiddleware(ctx, next) {
    // 生成或继承请求 ID，支持上游链路追踪
    const reqId = ctx.get(headerName) || randomUUID();
    ctx.state.reqId = reqId;
    ctx.set(headerName, reqId);

    const start = process.hrtime.bigint();
    try {
      await next();
    } finally {
      // 成功失败都记录，finally 不会吞错
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      console.log(JSON.stringify({
        reqId,
        method: ctx.method,
        url: ctx.url,
        status: ctx.status,
        ms: +ms.toFixed(2),
        ip: ctx.ip,
      }));
      ctx.set('X-Response-Time', `${ms.toFixed(0)}ms`);
    }
  };
}

app.use(requestContext());
```

| 设计点 | 原因 |
|---|---|
| `ctx.state.reqId` | 后续中间件与业务共享同一个 ID，日志才能串起来 |
| 继承上游 header | 链路追踪要传递同一个 traceId |
| `finally` 而不是 `catch` | 成功失败都要记录，`catch` 会吞掉错误 |
| `process.hrtime.bigint()` | 单调时钟，不受系统时间校正影响 |

### 注册顺序

```js
app.use(errorHandler());     // 最外层，捕获后续所有错误
app.use(requestContext());   // 请求上下文
app.use(logger());           // 日志
app.use(cors());             // 必须在鉴权之前
app.use(bodyParser());       // body 解析，在业务之前
app.use(router.routes());    // 业务路由
```

`OPTIONS` 预检请求不携带 `Authorization`。鉴权中间件注册在 CORS 之前时，预检会被拦成 401，浏览器只报 CORS 错误，看起来像跨域配置问题。

---

## 5.8 body-parser 是什么

### 题单答案：四件事

解析请求体，把 `req.body` 填成对象，支持 JSON、urlencoded、text。Express 4.16+ 内置（`express.json` / `express.urlencoded`），之前要单独装。

### 为什么需要

原生 http 的请求体是流，要自己拼：

```js
let body = '';
req.on('data', (chunk) => (body += chunk));
req.on('end', () => {
  const data = JSON.parse(body);
});
```

这段代码要自己处理四件事：

1. **编码**：`data` 事件给的是 Buffer，拼接要注意多字节字符
2. **大小限制**：不限制时，一个 1GB 请求体会打爆内存（DoS 向量）
3. **Content-Type**：按类型选解析方式（JSON / urlencoded / multipart）
4. **错误处理**：JSON 格式错误要返回 400，不是 500

### 用法与参数

```js
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
```

| 参数 | 作用 |
|---|---|
| `limit` | 请求体大小上限（默认 100kb） |
| `extended` | urlencoded 用 `qs` 库（支持嵌套）还是 `querystring`（只支持扁平） |
| `type` | 匹配哪些 Content-Type（默认 `application/json`） |
| `verify` | 自定义校验，能拿到原始 Buffer |

### 三个边界

#### ① 默认 limit 100kb

实测 Express 4.22：50kb JSON → 200；200kb → 413 `PayloadTooLargeError`。

#### ② 上传文件不能用

只处理文本类（JSON / urlencoded / text）。`multipart/form-data` 要用 multer 或 busboy，因为它由二进制与边界分隔组成，必须流式处理，不能整体读进内存。

#### ③ webhook 签名需要原始字节

```js
// 错：body 已被 JSON.parse，重新 stringify 后 key 顺序、空格、数字格式都可能变
crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('hex');
```

```js
// 对：verify 里保留原始 Buffer
app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
```

### Koa 里怎么用

```js
const bodyParser = require('koa-bodyparser');
app.use(bodyParser({ jsonLimit: '1mb' })); // → ctx.request.body
```

`ctx.request.body` 是请求体，`ctx.body` 是响应体。

---

## 5.9 面试怎么说（2 分钟版）

- 洋葱模型 = `compose` 的 `dispatch(i)` 递归 + Promise 链。`next` 是 `() => dispatch(i + 1)`，`dispatch` 返回 Promise，所以 `await next()` 等的是内层连同后半段执行完。
- 两个能力：最外层 try/catch 统一错误处理（错误沿 Promise 链反向传播）；`await next()` 之后加工响应（改 body、加 header、计时）。Express 的 `next()` 没有返回值，拿不到内层完成时机。
- `index` 守卫拦截 `next()` 重复调用；不调 `next()` 即短路（鉴权 401、限流 429、缓存命中）。
- Koa 1 用 generator + co：中间件 `function* (next)`，`yield next`（不调用），`this` 是 ctx。Express 4 的 async 抛错不会自动进入错误中间件。

---

## 5.10 追问总表

| 问题 | 答法 |
|---|---|
| 洋葱模型一句话？ | 递归 dispatch + Promise 链，`await next()` 等内层完成 |
| `compose` 的核心？ | `dispatch(i)`，把 `() => dispatch(i + 1)` 作为 next 传入 |
| 为什么要返回 Promise？ | 让 `await next()` 能等内层（含后半段）完成 |
| `index` 守卫干什么？ | 拦截 `next()` 调两次，防中间件重复执行 |
| 不调 `next()` 会怎样？ | 短路，后续中间件不执行 |
| 外层能改内层设置的 body 吗？ | 能，响应在 `respond()` 时才发出 |
| 错误怎么冒泡回来？ | Promise 链 reject，沿 `await next()` 回到外层 catch |
| `app.on('error')` 捕获什么？ | 未被中间件捕获的错误，只负责记录，不生成响应 |
| `ctx.throw` 是什么？ | 语法糖，设置 status 与 expose（4xx 为 true） |
| Koa 1 怎么实现洋葱？ | koa-compose 2.x 反向包成 generator 链，`yield next` |
| co 的本质？ | 自动执行器：`gen.next()` + 等 yield 的值 + `step('next'/'throw')` |
| co 支持哪些 yield 值？ | function（thunk）、promise、generator、array、object |
| Express 为什么不是洋葱？ | 数组 + 游标，`next()` 无返回值 |
| Express 4 async 中间件的问题？ | 抛错不自动转发，变成 unhandledRejection |
| Express 5 修了吗？ | 修了，5.0.0 起自动转发 |
| `ctx.body` 和 `ctx.request.body`？ | 响应体 / 请求体 |
| 中间件顺序有什么讲究？ | CORS 必须在鉴权之前（预检不带 Authorization） |
| body-parser 默认 limit？ | 100kb，超了 413 |
| 为什么上传文件不能用 body-parser？ | multipart 必须流式处理 |
| webhook 签名为什么不能用 `JSON.stringify(req.body)`？ | 重新序列化会改变字节，要用 `verify` 保留原始 Buffer |

---

## 5.11 速记卡

```
【compose】
dispatch(i) 返回 Promise；next = () => dispatch(i+1)
await next() = 等内层（含后半段）完成
index 守卫：i <= index → 'next() called multiple times'
i === length → 用外部 next；Promise.resolve() 兜底
同步中间件必须 return next()，否则后半段顺序错乱

【顺序】mw1 前 → mw2 前 → mw3 → mw2 后 → mw1 后

【两个能力】
统一错误处理：最外层 try/catch，错误沿 Promise 链反向冒泡
响应加工：await next() 之后改 ctx.body / header / 计时

【不调 next】短路：鉴权 401 / 限流 429 / 缓存命中

【异常】
ctx.throw(401) → status=401，expose=true；5xx expose=false
app.on('error')：只记日志，响应由 ctx.onerror 生成

【Koa 1】
中间件 function* (next)，this 是 ctx
yield next（不能写 next()）；compose 2.x 反向包链 + yield* next

【Koa vs Express】
模型    洋葱，双向            数组 + 游标，单向
next    返回 Promise          undefined
错误    try/catch 一次        四参中间件；async 需手动 next(err)
ctx     合一带 state           req / res 分离

【Express 4 async】
抛错 → unhandledRejection（Node 15+ 默认退出），请求挂起
解法：try/catch + next(err) / wrap / express-async-errors
Express 5 已自动转发

【中间件顺序】
errorHandler → context → logger → CORS → bodyParser → router

【body-parser】
编码 / 大小限制 / Content-Type / 解析错误
默认 limit 100kb（超了 413）
multipart 用 multer（流式）
webhook 签名用 verify 保留 rawBody

【耗时】process.hrtime.bigint()，单调时钟
```

---

## 5.12 自测

```
□ 能默写 compose 的核心代码
□ 能解释 dispatch 为什么返回 Promise
□ 能说出 index 守卫的作用
□ 能说出不调 next 的三种用途
□ 能解释外层为什么能改内层 body
□ 能解释错误为什么能冒泡到最外层
□ 能说出 app.on('error') 与 try/catch 的分工
□ 能说出 ctx.throw 的 status / expose
□ 能说出 Koa 1 的中间件签名与 yield next 的写法
□ 能说出 co 支持哪些 yield 值
□ 能列出 Express 与 Koa 的四项差异
□ 能说出 Express 4 async 错误的转发问题和三种解法
□ 能说出 ctx.body 与 ctx.request.body 的区别
□ 能说出 CORS 为什么在鉴权之前
□ 能说出 body-parser 的四个职责和默认 limit
□ 能说出 webhook 签名为什么要原始 body
```
