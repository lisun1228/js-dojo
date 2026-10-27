# 手写 call 与 bind

---

## 目录

- [手写 call](#手写-call)
- [手写 bind](#手写-bind)
- [测试](#测试)

---

## 手写 call

`fn.call(ctx, arg1, arg2)` 会把 `fn` 内部的 `this` 指向 `ctx` 并**立即执行**。思路：

1. `ctx` 为 `null / undefined` 时 `this` 落到 `globalThis`（仅非严格模式；严格模式保持 `null` / `undefined`）
2. `ctx` 是原始值时先装箱，否则挂不上临时属性
3. 给 `ctx` 挂一个临时方法，值就是当前函数（`this`），调用时 `this` 自然指向 `ctx`
4. 删除临时属性，返回执行结果

```js
Function.prototype.myCall = function (ctx, ...args) {
  // 只有 null/undefined 才回退：0、''、false 都是合法 thisArg，
  // 写成 ctx = ctx || globalThis 会把它们误换成 globalThis
  if (ctx === null || ctx === undefined) ctx = globalThis
  else if (typeof ctx !== 'object' && typeof ctx !== 'function') ctx = Object(ctx)

  const key = Symbol('temp') // Symbol 键不会撞上 ctx 已有的字符串键
  ctx[key] = this

  try {
    return ctx[key](...args) // 此时函数内 this 指向 ctx
  } finally {
    delete ctx[key] // 回调抛错也要清掉，不给 ctx 留属性
  }
}
```

临时属性方案只能把对象当 `this`：`null` / `undefined` 一律被换成 `globalThis`，原始值一律被装箱；严格模式函数因此拿不到 `null`，也拿不到原始值（原生 `call` 能原样传）。

## 手写 bind

`fn.bind(ctx, ...)` **不立即执行**，而是返回一个新函数，且：

1. 永久绑定 `this`，还能预设部分参数（柯里化）
2. 用 `new` 调用时绑定的 `this` 失效：构造走 `[[Construct]]`，以原函数为构造目标
3. `new` 出来的实例仍能通过 `instanceof 原函数`

```js
Function.prototype.myBind = function (ctx, ...bindArgs) {
  const originFn = this

  function boundFn(...innerArgs) {
    const allArgs = [...bindArgs, ...innerArgs]
    // new.target 只在 new 调用时有值。用 this instanceof boundFn 判断，
    // 会在普通调用的 this 恰好命中 boundFn.prototype 时误判
    return originFn.apply(new.target ? this : ctx, allArgs)
  }

  // 实例原型指向 originFn.prototype，instanceof 原函数才成立
  boundFn.prototype = Object.create(originFn.prototype)
  boundFn.prototype.constructor = boundFn

  return boundFn
}
```

原生 bound 函数没有自己的 `prototype`，`length` 为 `max(0, 原函数.length - 预设参数数)`，`name` 为 `"bound 原函数名"`；上面这版拿不到这些元信息：`length` 恒为 `0`，`name` 为 `"boundFn"`。

## 测试

```js
const user = { name: '李四' }
function greet(a, b) {
  console.log(this.name, a, b)
}

const bound = greet.myBind(user, 100)
bound(200) // 李四 100 200

const ins = new bound(300) // undefined 100 300：this 是新建的实例
console.log(ins) // boundFn {}
console.log(ins instanceof greet) // true
```
