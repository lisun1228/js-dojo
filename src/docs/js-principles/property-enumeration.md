# 属性枚举：Object.keys / for...in / getOwnPropertyNames / Reflect.ownKeys

四个 API 都能「拿到键」，但它们回答的不是同一个问题：**要不要沿原型链、要不要不可枚举、带不带 Symbol**。同一个对象同时包含整数键、字符串键、Symbol、不可枚举键与继承键（Node 22 实测）：

```js
const sym = Symbol('s')
const proto = { inherited: 1 }

const obj = Object.create(proto)
obj.b = 1
obj[2] = 'two'
obj.a = 2
obj[1] = 'one'
obj[sym] = 'sym'
Object.defineProperty(obj, 'hidden', { value: 1, enumerable: false })

Object.keys(obj) // ['1', '2', 'b', 'a']
Object.getOwnPropertyNames(obj) // ['1', '2', 'b', 'a', 'hidden']
Reflect.ownKeys(obj) // ['1', '2', 'b', 'a', 'hidden', Symbol(s)]
// for...in：'1' '2' 'b' 'a' 'inherited'
```

---

## 目录

- [一句话结论](#一句话结论)
- [判定矩阵：三种开关](#判定矩阵三种开关)
- [顺序规则：整数键为什么插队](#顺序规则整数键为什么插队)
- [可枚举性从哪来](#可枚举性从哪来)
- [与其他遍历和复制 API 的关系](#与其他遍历和复制-api-的关系)
- [Proxy 场景：谁触发了哪些陷阱](#proxy-场景谁触发了哪些陷阱)
- [常见坑](#常见坑)
- [答题模板](#答题模板)

---

## 一句话结论

- `Object.keys`：**自有 + 可枚举 + 字符串键**，返回数组
- `for...in`：**自有 + 原型链 + 可枚举 + 字符串键**，逐个产出、不建数组
- `Object.getOwnPropertyNames`：**自有 + 全部 + 字符串键**，返回数组
- `Reflect.ownKeys`：**自有 + 全部 + 字符串键 + Symbol**，返回数组

选型按用途对应：

- 取业务数据 → `Object.keys`
- 调试、元编程、检查对象真实结构 → `Reflect.ownKeys`（信息最全）
- 只想要字符串形式的属性名 → `Object.getOwnPropertyNames`
- 确实需要继承属性、又不想创建数组 → `for...in`，配合 `Object.hasOwn` 过滤

## 判定矩阵：三种开关

| API                          | 继承属性 | 不可枚举 | Symbol | 返回值         | 非对象参数                               |
| ---------------------------- | -------- | -------- | ------ | -------------- | ---------------------------------------- |
| `Object.keys`                | ❌       | ❌       | ❌     | `string[]`     | `'ab'` → `['0','1']`；`5` → `[]`；`null` → TypeError |
| `for...in`                   | ✅       | ❌       | ❌     | 逐个产出       | `'ab'` 可遍历索引；`null / undefined` 静默跳过 |
| `Object.getOwnPropertyNames` | ❌       | ✅       | ❌     | `string[]`     | `'ab'` → `['0','1','length']`；`null` → TypeError |
| `Reflect.ownKeys`            | ❌       | ✅       | ✅     | `(string\|symbol)[]` | 必须是对象，`'ab'` / `5` → TypeError |

**`Object.keys` 会先 `ToObject`，`Reflect.ownKeys` 不会。** `Object.keys('ab')` 合法，`Reflect.ownKeys('ab')` 抛 `TypeError`；`null / undefined` 两者都抛。

**四个 API 都不触发 getter**，只读属性描述符；`Object.values`、`Object.entries`、`Object.assign`、展开和 `JSON.stringify` 才取值。

## 顺序规则：整数键为什么插队

规范里的 `[[OwnPropertyKeys]]` 固定按三段输出：

```
数组索引（升序） → 其他字符串键（插入顺序） → Symbol 键（插入顺序）
```

「数组索引」指的是 **canonical numeric string**，且范围是 `0 ≤ n < 2^32 - 1`。超出范围的数字字符串、带前导零的、小数的、负数的，都按普通字符串处理：

```js
const o = {}
o['4294967295'] = 1
o['1.5'] = 1
o['-1'] = 1
o['01'] = 1
o[10] = 1
o[2] = 1
o.b = 1
o.a = 1

Reflect.ownKeys(o)
// ['2', '10', '4294967295', '1.5', '-1', '01', 'b', 'a']
// 只有 2、10 被当成索引排到前面，其余保持插入顺序
```

经 `JSON.parse` 传入的字段同样按此重排：

```js
Object.keys(JSON.parse('{"b":1,"2":2,"a":3}')) // ['2', 'b', 'a']
```

`for...in` 的顺序是**分层**的，不是全局排序：先按上面的规则遍历自有键，再按同样的规则遍历原型上的键：

```js
const proto = { 1: 'p1', a: 'pa' }
const o = Object.create(proto)
o.b = 1
o[2] = 1

// for...in 顺序：'2' 'b' '1' 'a'
```

原型的整数键 `'1'` 排在自有的字符串键 `'b'` 之后——因为「整数优先」只在每一层内部生效。

## 可枚举性从哪来

`enumerable` 不是「能不能访问」，而是「会不会出现在枚举里」。常见来源：

| 写法                                        | 默认可枚举 |
| ------------------------------------------- | ---------- |
| 字面量、赋值 `obj.x = 1`                    | ✅         |
| `Object.defineProperty` 不写 `enumerable`   | ❌         |
| `class` 原型上的方法                        | ❌         |
| 数组的 `length`                             | ❌         |
| 内置原型方法（`toString`、`hasOwnProperty`） | ❌         |
| Symbol 键                                   | 独立设置，但与能否被 `Object.keys` 看到无关 |

```js
class C {
  m() {}
}
Object.keys(C.prototype) // []
Reflect.ownKeys(C.prototype) // ['constructor', 'm']

Object.keys([1, 2]) // ['0', '1']
Reflect.ownKeys([1, 2]) // ['0', '1', 'length']

const o = { [Symbol('x')]: 1 }
Object.keys(o) // []
Reflect.ownKeys(o) // [Symbol(x)]
```

**Symbol 键被 `Object.keys` / `for...in` / `getOwnPropertyNames` 忽略，跟可枚举性无关**：这些 API 只处理字符串键。

`propertyIsEnumerable` 只检查自有属性，而 `for...in` 看到的是「整条原型链上可枚举」：

```js
obj.propertyIsEnumerable('hidden') // false，只检查自有
for (const k in obj) {
  // 看不到 hidden，但能看到原型上的 inherited
}
```

「把属性设成不可枚举就是私有」是错的：`Reflect.ownKeys` 和 `getOwnPropertyNames` 照样能看到，它只挡得住 `Object.keys`、`for...in`、`JSON.stringify`、展开和 `Object.assign`。真正的私有要用 `#field`、闭包或 `WeakMap`。

## 与其他遍历和复制 API 的关系

| API                        | 收集范围                             | 触发 getter |
| -------------------------- | ------------------------------------ | ----------- |
| `Object.values` / `entries` | 自有 + 可枚举 + 字符串               | ✅          |
| `Object.assign` / 展开      | 自有 + 可枚举 + 字符串 + **Symbol**  | ✅          |
| `JSON.stringify`            | 自有 + 可枚举 + 字符串（跳过 Symbol） | ✅          |

两个恒等式：

```js
Reflect.ownKeys(obj)
// 等价于：Object.getOwnPropertyNames(obj).concat(Object.getOwnPropertySymbols(obj))

Object.keys(obj)
// 等价于：Object.getOwnPropertyNames(obj).filter((k) => obj.propertyIsEnumerable(k))
```

如果需要「连同原型链上的全部键」：

```js
function allKeysInChain(obj) {
  const keys = []
  for (let cur = Object(obj); cur !== null; cur = Object.getPrototypeOf(cur)) {
    for (const key of Reflect.ownKeys(cur)) {
      if (!keys.includes(key)) keys.push(key)
    }
  }
  return keys
}
```

它会一直走到 `Object.prototype`，所以结果里会包含 `constructor`、`toString` 这些内置键——这正是 `for...in` 不包含它们的原因（它们不可枚举）。

## Proxy 场景：谁触发了哪些陷阱

把 target 设为 `{ a: 1, [Symbol('s')]: 2 }` 再加一个不可枚举的 `hidden`，用 Proxy 记录陷阱调用顺序（Node 22 实测）：

| 操作                        | 触发的陷阱                                                    |
| --------------------------- | ------------------------------------------------------------- |
| `Reflect.ownKeys`           | `ownKeys`                                                     |
| `Object.getOwnPropertyNames` | `ownKeys`                                                     |
| `Object.keys`               | `ownKeys` → `getOwnPropertyDescriptor`（逐个字符串键）        |
| `for...in`                  | `ownKeys` → `getOwnPropertyDescriptor`（逐个字符串键，跳过 Symbol 且不查其描述符） |
| `Object.assign` / 展开      | `ownKeys` → `getOwnPropertyDescriptor` → `get`（含 Symbol 键） |
| `JSON.stringify`            | `get('toJSON')` → `ownKeys` → `getOwnPropertyDescriptor` → `get` |

原型本身是 Proxy 时，`for...in` 还会对原型再走一遍 `ownKeys` + `getOwnPropertyDescriptor`：

```js
const protoProxy = new Proxy({ inherited: 1 }, {
  ownKeys(t) {
    console.log('proto ownKeys')
    return Reflect.ownKeys(t)
  },
  getOwnPropertyDescriptor(t, k) {
    console.log('proto gopd:' + String(k))
    return Reflect.getOwnPropertyDescriptor(t, k)
  },
})

const child = Object.create(protoProxy)
child.own = 2
for (const k in child) {
  // 输出：proto ownKeys → proto gopd:inherited
}
```

还有一个不变量（invariant）约束：如果 `getOwnPropertyDescriptor` 把 target 上**不可配置且不可枚举**的属性报成 `enumerable: true`，`Object.keys` 会直接抛错：

```
TypeError: 'getOwnPropertyDescriptor' on proxy: trap returned descriptor for property 'locked' that is incompatible with the existing property in the proxy target
```

所以响应式代理不能随意伪造描述符——`ownKeys` 的结果必须包含 target 上所有不可配置属性，`getOwnPropertyDescriptor` 也不能和不可配置属性的事实冲突。

## 常见坑

1. **用 `for...in` 遍历数组。** 拿到的是字符串索引，还会把原型上的可枚举扩展一起遍历出来。遍历值用 `for...of`，遍历索引用 `Object.keys`。
2. **`for...in` 不过滤继承属性。** 用 `Object.hasOwn(obj, key)`（ES2022）比 `Object.prototype.hasOwnProperty.call` 更稳，因为对象可能自定义 `hasOwnProperty`，也可能是 `Object.create(null)`。
3. **把 `Object.keys` 当成「对象全部属性」。** 会漏掉不可枚举键和 Symbol 键。
4. **误判 `Object.keys` 的容错。** 非对象参数行为不一致（见判定矩阵最后一列）；入口处先判空，别用 try/catch 兜。
5. **边遍历边增删。** 删除还没访问的键不会再被访问；新增的键不保证被访问；删掉再加回，规范允许访问两次（V8 实测一次）。
6. **依赖键顺序做业务。** 整数键会被提前排序，`JSON.parse` 和接口返回的字段顺序也不可控。需要稳定顺序就存数组或改用 `Map`。

## 答题模板

**30 秒版：**

> 四个 API 的区别就是三个开关：是否沿原型链、是否包含不可枚举、是否包含 Symbol。`Object.keys` 只要自有可枚举字符串键；`for...in` 会沿原型链但同样只要可枚举字符串键；`getOwnPropertyNames` 包含不可枚举但仍只要字符串键；`Reflect.ownKeys` 最全，字符串键和 Symbol 都返回。顺序上整数键会升序排到最前面，Symbol 永远在最后。

**追问表：**

| 追问                             | 回答                                                                 |
| -------------------------------- | -------------------------------------------------------------------- |
| 哪个能看到 Symbol 键             | `Reflect.ownKeys`，或 `Object.getOwnPropertySymbols`                  |
| 哪个会走原型链                   | 只有 `for...in`                                                      |
| 不可枚举属性怎么造               | `defineProperty` 不写 `enumerable`、`class` 方法、数组 `length`      |
| 哪个会触发 getter                | 四个都不触发；`values / entries / assign / 展开 / JSON.stringify` 才触发 |
| `for...in` 为什么不适合数组      | 字符串索引、继承扩展、顺序受整数键规则影响                           |
| 与 Proxy 的关系                  | `Object.keys` 走 `ownKeys` + `getOwnPropertyDescriptor`；`Reflect.ownKeys` 只走 `ownKeys` |

> 相关教程：[集合与元编程](/doc/js-collections-metaprogramming)、[原型与原型链](/doc/prototype-chain)、[对象、原型与继承](/doc/es6-object-prototype-inheritance)。
