# 原型与原型链

![原型与原型链示意图](/yuanxinglian.png)
两条最基础、也最容易绕晕的规则：

- 每一个**对象**都有一个隐式属性 `__proto__`（标准名 `[[Prototype]]`），指向它的**原型对象**
- 每一个**函数**都有一个显式属性 `prototype`，叫做**原型**

```js
function Person() {}
const p = new Person()

// 实例的 __proto__ 指向构造函数的 prototype
p.__proto__ === Person.prototype                    // true

// prototype 上默认带一个 constructor，指回构造函数
Person.prototype.constructor === Person             // true

// 原型对象自己也是对象，继续往上找
Person.prototype.__proto__ === Object.prototype     // true

// 原型链终点
Object.prototype.__proto__ === null                 // true
```


---

## 目录

- [对象原型链](#对象原型链)
- [函数原型链](#函数原型链)

---

## 对象原型链

```text
p  →  Person.prototype  →  Object.prototype  →  null
```

## 函数原型链

函数本身也是对象，所以函数也有 `__proto__`：

```js
function fn() {}

// 1. 任意普通函数都是 Function 的实例
fn.__proto__ === Function.prototype                 // true

// 2. Function 自己也是函数，所以也是自己的实例
Function.__proto__ === Function.prototype           // true

// 3. 函数原型链再往上还是 Object
Function.prototype.__proto__ === Object.prototype   // true

// 4. 终点依然是 null
Object.prototype.__proto__ === null                 // true
```

```text
Person  →  Function.prototype  →  Object.prototype  →  null
```

> 记忆点：`Function.__proto__ === Function.prototype`——**Function 是自己的实例**，这是原型链里唯一的「自指」特例。
