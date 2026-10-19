# Proxy 与响应式：为什么深层属性会「失效」

`Proxy` 可以拦截对象的读取（`get`）与赋值（`set`），Vue 3 的响应式就是基于它实现的。

## 只代理最外层

```js
function reactive(target) {
  return new Proxy(target, {
    get(target, key) {
      console.log('get', key)
      return Reflect.get(target, key)
    },
    set(target, key, value) {
      console.log('set', key, value)
      return Reflect.set(target, key, value)
    },
  })
}
```

```js
const obj = { a: 1, inner: { b: 2 } }
const p = reactive(obj)

p.a = 10          // ✅ 触发 set a
p.inner.b = 20    // ❗ 不会触发 set b
```

原因：`p.inner` 走的是 **get 陷阱**，返回的是**没有被代理的原始对象** `{ b: 2 }`；
之后 `p.inner.b = 20` 只是在这个原始对象上赋值，自然绕过了 `set` 陷阱。

## 修复：get 时把嵌套对象也代理掉

```js
function reactive(target) {
  return new Proxy(target, {
    get(target, key) {
      const val = Reflect.get(target, key)
      // 取出来还是对象，就递归包一层 Proxy
      if (typeof val === 'object' && val !== null) {
        return reactive(val)
      }
      console.log('get', key)
      return val
    },
    set(target, key, value) {
      console.log('set', key, value)
      return Reflect.set(target, key, value)
    },
  })
}
```

此时 `p.inner.b = 20` 会先经过 get 拿到**被代理的 inner**，再经过 set 打出 `set b 20`。

## 真正的坑

上面这个写法虽然「能用」，但有两个问题：

1. **每次访问都新建代理**：`p.inner === p.inner` 为 `false`，破坏了对象身份判断，也会反复创建代理。
2. **应当惰性递归 + 缓存**：用 `WeakMap` 缓存「原始对象 → 代理对象」，`get` 时命中缓存直接返回，避免重复包装。

```js
const cache = new WeakMap()

function reactive(target) {
  if (target === null || typeof target !== 'object') return target
  if (cache.has(target)) return cache.get(target)

  const proxy = new Proxy(target, {
    get(t, key) {
      return reactive(Reflect.get(t, key))   // 取值时惰性代理
    },
    set(t, key, value) {
      console.log('set', key, value)
      return Reflect.set(t, key, value)
    },
  })

  cache.set(target, proxy)                 // 缓存，保证同一对象始终同一个代理
  return proxy
}
```

> Vue 3 的 `reactive` 正是「**惰性递归 + WeakMap 缓存**」的实现方式：只在你真正访问到某个嵌套对象时，才为它创建代理。
