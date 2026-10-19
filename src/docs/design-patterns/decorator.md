# ES 装饰器（Decorator）

装饰器是一种**在不修改原类 / 方法 / 属性代码**的前提下，动态为其叠加额外行为（日志、校验、缓存、元数据等）的语法。它本质上就是一个**函数**，通过 `@` 语法糖挂载到目标上，由 TypeScript / 构建工具在编译阶段“展开”成普通的函数调用。

```ts
// 开启装饰器语法（tsconfig.json）
"experimentalDecorators": true

// 装饰器 = 函数，@ 只是语法糖
@log
class User {}

// 等价于：User = log(User)
```

---

## 1. 类装饰器

作用于类本身，接收**一个参数：类的构造函数**。常用于扩展静态属性 / 方法，或替换整个类。

```ts
// 类装饰器：唯一参数是「类的构造函数」
function entity(target: any) {
  // 给类追加静态属性
  target.tableName = 't_' + target.name.toLowerCase()
}

@entity
class Article {}

console.log(Article.tableName) // t_article
```

## 2. 方法装饰器

作用于类的实例方法，接收**三个参数：`target`、方法名、属性描述符**。通过改写 `descriptor.value` 就能在原方法前后追加逻辑，这是最常用的一类装饰器（日志、埋点、防抖等）。

```ts
// 方法装饰器：target / key / descriptor
function log(target: any, key: string, descriptor: PropertyDescriptor) {
  const fn = descriptor.value              // 原方法
  descriptor.value = function (...args: any[]) {
    console.log('before')                  // 前置增强
    const result = fn.apply(this, args)
    console.log('after')                   // 后置增强
    return result
  }
  return descriptor                        // 返回新的描述符
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

## 3. 属性装饰器

作用于类的普通属性，接收**两个参数：`target`、属性名**。因为属性此时还没有值，所以**没有描述符参数**，一般用来收集字段元数据（如 ORM 的列定义、校验规则）。

```ts
// 属性装饰器：target / key（没有 descriptor）
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
```

## 4. 访问器装饰器

作用于 `get / set` 访问器，参数与方法装饰器一致（含描述符）。可以修改 `enumerable`、`configurable` 等特性。

```ts
// 访问器装饰器：作用于 get / set，参数同方法装饰器
function enumerable(value: boolean) {
  return function (target: any, key: string, descriptor: PropertyDescriptor) {
    descriptor.enumerable = value          // 修改描述符特性
  }
}

class Point {
  private _x = 3

  @enumerable(false)
  get x() {
    return this._x
  }
}

// Object.keys(new Point()) 为空 —— get x 不可枚举
```

## 5. 参数装饰器

作用于方法（或构造函数）的**参数**，接收 **`target`、方法名、参数下标** 三个参数。常配合依赖注入使用，本身无法改变值，只用于登记信息。

```ts
// 参数装饰器：target / key / 参数下标
function Inject(target: any, key: string, index: number) {
  console.log('方法 ' + key + ' 的第 ' + index + ' 个参数需要注入')
}

class Service {
  find(@Inject id: number, @Inject type: string) {
    // ...
  }
}

// 输出：方法 find 的第 0 个参数需要注入
//       方法 find 的第 1 个参数需要注入
```

## 6. 多个装饰器的执行顺序

同一声明上叠加多个装饰器时：**求值从下往上**（由近及远），真正**执行（调用返回的包装函数）从上往下**（由远及近）。

```ts
@a
@b
class Demo {}

// 求值（表达式从下往上）：a → b
// 执行（结果从上往下）：b 包装后的结果再交给 a
```

## 7. 用装饰器理解「装饰器模式」

设计模式中的 **Decorator Pattern（装饰器模式）** 与 ES 装饰器**同名，思想也一致**：都是**通过「包装」在不改动原有对象的前提下动态增强功能**。区别只是表现形式——设计模式用**对象层层包装**，ES 装饰器把这个过程**语法化**了。

```ts
// 装饰器模式：通过「包装」动态叠加功能
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
  cost() { return this.inner.cost() + 3 }         // 增强：加价
  desc() { return this.inner.desc() + ' + 牛奶' }  // 增强：加描述
}

let coffee: Coffee = new Espresso()
coffee = new MilkDecorator(coffee)   // 加一份牛奶
coffee = new MilkDecorator(coffee)   // 再加一份牛奶
coffee.desc() // 浓缩咖啡 + 牛奶 + 牛奶
coffee.cost() // 21
```

> **对比着看**：`@log` 本质上就是替我们完成了「取出原方法 → 包一层新函数 → 写回」的动作，正如 `MilkDecorator` 包住 `Espresso` 一样，都属于**对行为的可插拔增强**，且可以**层层叠加**。

---

> 以上各类装饰器的**可运行示例**见下方「交互演示」区域，点击按钮即可查看运行结果。
