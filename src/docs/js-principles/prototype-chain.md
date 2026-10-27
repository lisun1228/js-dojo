# 原型与原型链

![原型与原型链示意图](/yuanxinglian.png)
两条最基础、也最容易绕晕的规则：

- 对象的 `[[Prototype]]` 内部槽指向它的**原型对象**；`__proto__` 只是 `Object.prototype` 上的访问器，读写的就是这个槽，标准读法是 `Object.getPrototypeOf`
- 由 `function` 声明或 `class` 定义的构造函数才有显式属性 `prototype`；箭头函数、对象方法、`bind` 返回的函数都没有

```js
function Person() {}
const p = new Person()

// 实例的 __proto__（等价于 Object.getPrototypeOf(p)）指向构造函数的 prototype
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
```

```text
Person  →  Function.prototype  →  Object.prototype  →  null
```

> 记忆点：`Function.__proto__ === Function.prototype`——**Function 是自己的实例**，这是原型链里唯一的「自指」特例。
