# ES 装饰器（Decorator）

装饰器是**在不修改原类 / 方法 / 属性代码**的前提下，动态叠加行为（日志、校验、缓存、元数据）的语法。本质是一个**函数**，`@` 只是语法糖，由 TypeScript 在编译期展开成普通函数调用（旧版需开启 `experimentalDecorators`）。

```ts
@log
class User {}
// 等价于：User = log(User)
```

> 两套标准的签名差异见 [07｜装饰器与 mixin](/doc/typescript-decorator-mixin)；本文只讲封装手法与设计模式本身。

---

## 目录

- [1. 类装饰器](#1-类装饰器)
- [2. 方法装饰器](#2-方法装饰器)
- [3. 属性装饰器](#3-属性装饰器)
- [4. 访问器装饰器](#4-访问器装饰器)
- [5. 参数装饰器](#5-参数装饰器)
- [6. 多个装饰器的执行顺序](#6-多个装饰器的执行顺序)
- [7. 用装饰器理解「装饰器模式」](#7-用装饰器理解装饰器模式)

---

## 1. 类装饰器

作用于类本身，接收**一个参数：类的构造函数**。返回值会替换原类，因此既能扩展静态成员，也能整体替换。

```ts
function entity(target: any) {
  target.tableName = 't_' + target.name.toLowerCase()
}

@entity
class Article {}

console.log(Article.tableName) // t_article
```

## 2. 方法装饰器

作用于实例方法，接收 **`target`、方法名、属性描述符**。改写 `descriptor.value` 就能在原方法前后追加逻辑，是日志、埋点、防抖等功能最常用的落点。

```ts
function log(target: any, key: string, descriptor: PropertyDescriptor) {
  const fn = descriptor.value              // 原方法
  descriptor.value = function (...args: any[]) {
    console.log('before')                  // 前置增强
    const result = fn.apply(this, args)
    console.log('after')                   // 后置增强
    return result
  }
  return descriptor
}

class User {
  @log
  say() {
    console.log('hello world')
  }
}

new User().say()
// 输出：before → hello world → after
```

- **包装而非改写**：`fn` 保存原方法引用，只替换 `descriptor.value`；`apply(this, args)` 透传调用现场的 `this`，原方法的返回值由包装函数带回。
- **写回描述符**：`return descriptor` 供 `__decorate` 用新描述符重新定义属性。

## 3. 属性装饰器

作用于普通属性，接收 **`target`、属性名**。属性此时还没有值，所以**没有描述符参数**；`target` 是 prototype（实例属性）或构造函数（静态属性），实例还不存在，只能登记元数据。

```ts
const meta: Record<string, string[]> = {}

function Column(label: string) {
  return function (target: any, key: string) {
    if (!meta[label]) meta[label] = []
    meta[label].push(key)                  // 收集字段元数据
  }
}

class Product {
  @Column('basic')
  name!: string

  @Column('basic')
  price!: number
}

// meta.basic = ['name', 'price']
```

## 4. 访问器装饰器

作用于 `get / set`，参数与方法装饰器一致（含描述符），可以修改 `enumerable`、`configurable` 等特性。

```ts
function enumerable(value: boolean) {
  return function (target: any, key: string, descriptor: PropertyDescriptor) {
    descriptor.enumerable = value
  }
}

class Point {
  private _x = 3

  @enumerable(false)
  get x() {
    return this._x
  }
}

const p = new Point()
p.x                // 3
Object.keys(p)     // ['_x']：_x 是实例字段，get x 已不可枚举
```

## 5. 参数装饰器

作用于方法（或构造函数）的**参数**，接收 **`target`、方法名、参数下标**。它无法改变参数值，只用于登记信息，常配合依赖注入使用。

```ts
function Inject(target: any, key: string, index: number) {
  console.log('方法 ' + key + ' 的第 ' + index + ' 个参数需要注入')
}

class Service {
  find(@Inject id: number, @Inject type: string) {
    // ...
  }
}

// 输出：第 1 个 → 第 0 个（参数装饰器从后往前执行）
```

## 6. 多个装饰器的执行顺序

同一目标上叠加多个装饰器时，**表达式自上而下求值，包装函数自下而上执行**。

```ts
@a
@b
class Demo {}

// 求值：a → b
// 执行：b → a，等价于 Demo = a(b(Demo))
```

## 7. 用装饰器理解「装饰器模式」

设计模式中的 **Decorator Pattern** 与 ES 装饰器同名，思想一致：**通过包装，在不改动原有对象的前提下动态增强功能**。区别只在表现形式：设计模式用**对象层层包装**，ES 装饰器把「取原方法 → 包一层 → 写回」交给编译期。

```ts
interface Coffee {
  cost(): number
  desc(): string
}

// 被装饰的原始对象
class Espresso implements Coffee {
  cost() { return 15 }
  desc() { return '浓缩咖啡' }
}

// 装饰器：持有被装饰对象，在其基础上扩展
class MilkDecorator implements Coffee {
  inner: Coffee

  constructor(inner: Coffee) {
    this.inner = inner
  }

  cost() { return this.inner.cost() + 3 }          // 增强：加价
  desc() { return this.inner.desc() + ' + 牛奶' }   // 增强：加描述
}

let coffee: Coffee = new Espresso()
coffee = new MilkDecorator(coffee)   // 加一份牛奶
coffee = new MilkDecorator(coffee)   // 再加一份牛奶
coffee.desc() // 浓缩咖啡 + 牛奶 + 牛奶
coffee.cost() // 21
```

- **同名同思想**：`@log` 做的就是「取出原方法 → 包一层新函数 → 写回」；`MilkDecorator` 做的是「持有原对象 → 转发并追加」。
- **接口不变**：两者都实现同一个 `Coffee` / 方法签名，调用方无需感知包了几层。
- **可以叠加**：包装顺序决定增强顺序，重复包装即重复增强（两份牛奶 +6）。
