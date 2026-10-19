# 手写 call 与 bind

## 手写 call

`fn.call(ctx, arg1, arg2)` 会把 `fn` 内部的 `this` 指向 `ctx` 并**立即执行**。思路：

1. `ctx` 为 `null / undefined` 时指向全局 `globalThis`
2. 给 `ctx` 挂一个临时方法，值就是当前函数（`this`）
3. 用 `ctx.临时方法(...args)` 调用，此时函数内 `this` 自然指向 `ctx`
4. 删除临时属性，返回执行结果

```js
Function.prototype.myCall = function (ctx, ...args) {
  // 1. 如果 ctx 是 null/undefined，指向全局 globalThis
  ctx = ctx || globalThis

  // 2. 挂一个临时属性，值就是当前函数
  const key = Symbol('temp')   // 用 Symbol 避免覆盖 ctx 上的同名属性
  ctx[key] = this

  // 3. 调用：此时函数内 this 指向 ctx
  const res = ctx[key](...args)

  // 4. 删除临时属性，返回执行结果
  delete ctx[key]
  return res
}
```

## 手写 bind

`fn.bind(ctx, ...)` **不立即执行**，而是返回一个新函数，且：

1. 永久绑定 `this`，还能预设部分参数（柯里化）
2. 如果返回的新函数被 `new` 调用，**绑定的 `this` 失效**（`new` 优先级高于 `bind`）
3. `new` 出来的实例要能继承原函数的 `prototype`

```js
Function.prototype.myBind = function (ctx, ...bindArgs) {
  const originFn = this

  function boundFn(...innerArgs) {
    // 合并：bind 预设参数 + 调用时传入的参数
    const allArgs = [...bindArgs, ...innerArgs]

    // new 调用时 this 是新实例，this instanceof boundFn 成立
    if (this instanceof boundFn) {
      return originFn.apply(this, allArgs)
    }
    // 普通调用：使用绑定的 ctx
    return originFn.apply(ctx, allArgs)
  }

  // 保留原型链：new boundFn() 生成的实例原型要正确
  boundFn.prototype = Object.create(originFn.prototype)
  boundFn.prototype.constructor = boundFn

  return boundFn
}
```

## 测试

```js
const user = { name: '李四' }
function greet(a, b) {
  console.log(this.name, a, b)
}

const bound = greet.myBind(user, 100)
bound(200)                   // 李四 100 200

const ins = new bound(300)   // this 不再是 user
console.log(ins)             // greet {}（this.name 为 undefined）
```

> 核心结论：**`new` > `bind`**。即使用 `bind` 固定了 `this`，一旦用 `new` 调用，`this` 依然指向新创建的实例。
