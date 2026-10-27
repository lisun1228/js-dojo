# 策略模式（Strategy Pattern）
---

## 目录

- [核心定义](#核心定义)
- [适用场景](#适用场景)
- [角色](#角色)
- [JS 手写Demo（面试最简版）](#js-手写demo面试最简版)
- [Class版本（偏传统面向对象写法，面试备选）](#class版本偏传统面向对象写法面试备选)
- [前端实战例子](#前端实战例子)
- [✅ 优点](#-优点)
- [❌ 缺点](#-缺点)
- [面试高频对比：策略模式 vs 状态模式（极易混淆）](#面试高频对比策略模式-vs-状态模式极易混淆)
- [面试口述总结](#面试口述总结)

---

## 核心定义
> **定义一系列算法，把每一个算法封装成独立策略类，让它们可以互相替换；算法的变化独立于使用算法的客户。**

可变的算法抽成独立策略，由外部按需切换，替代大量 `if/else`、`switch`。

- 策略：独立的业务算法、规则
- 上下文 Context：接收参数并调用对应策略，本身不写判断逻辑

## 适用场景
1. 同一业务有**多种分支算法**，需要动态切换（大量 `if/else`、`switch` 的重构场景）
2. 算法逻辑经常变化，需要新增、替换规则
3. 算法需要独立抽离，便于单独单元测试

## 角色
1. **策略接口（Strategy）**：统一规范，所有策略实现同一个方法（JS 弱类型可以省略）
2. **具体策略（ConcreteStrategy）**：封装具体算法
3. **上下文 Context**：持有策略对象，对外提供统一入口

## JS 手写Demo（面试最简版）
### 场景：计算不同会员折扣
普通会员 9 折，黄金 8 折，钻石 7 折。
```js
// 策略集合：每个键对应一个独立算法
const strategy = {
  ordinary(price) {
    return price * 0.9
  },
  gold(price) {
    return price * 0.8
  },
  diamond(price) {
    return price * 0.7
  }
}

// Context：按策略名取函数并调用
function getPrice(memberType, price) {
  return strategy[memberType](price)
}

console.log(getPrice('ordinary', 100)) // 90
console.log(getPrice('gold', 100)) // 80
console.log(getPrice('diamond', 100)) // 70

// 新增 VIP 策略只扩展集合，getPrice 不变
strategy.vip = (price) => price * 0.85
console.log(getPrice('vip', 100)) // 85
```

等价的 `if/else` 写法：
```js
function getPrice(memberType, price) {
  if (memberType === 'ordinary') return price * 0.9
  else if (memberType === 'gold') return price * 0.8
  else if (memberType === 'diamond') return price * 0.7
}
```
新增折扣要改函数体，分支随折扣种类增长；策略集合把改动收敛为一次赋值。

## Class版本（偏传统面向对象写法，面试备选）
```js
// 策略基类
class DiscountStrategy {
  calc(price) {}
}

class OrdinaryStrategy extends DiscountStrategy {
  calc(price) {
    return price * 0.9
  }
}

class GoldStrategy extends DiscountStrategy {
  calc(price) {
    return price * 0.8
  }
}

// Context
class OrderContext {
  constructor(strategy) {
    this.strategy = strategy
  }
  setStrategy(strategy) {
    this.strategy = strategy // 运行时替换
  }
  getPrice(price) {
    return this.strategy.calc(price)
  }
}

const order = new OrderContext(new GoldStrategy())
console.log(order.getPrice(100)) // 80
order.setStrategy(new OrdinaryStrategy())
console.log(order.getPrice(100)) // 90
```

## 前端实战例子
1. 表单校验：手机号、邮箱、必填、长度限制，每条规则是一个策略
2. 图片上传：不同环境使用不同上传策略（阿里云、腾讯云、本地）
3. 支付方式：微信、支付宝、银行卡，每种支付方式一个策略

### 表单校验小demo
```js
const validateStrategy = {
  required(value) {
    if (!value) return '不能为空'
  },
  phone(value) {
    if (!/^1[3-9]\d{9}$/.test(value)) return '手机号格式错误'
  },
  email(value) {
    if (!/^\w+@\w+\.\w+$/.test(value)) return '邮箱错误'
  }
}

function validate(type, value) {
  return validateStrategy[type](value) ?? '校验通过'
}

console.log(validate('phone', '1234')) // 手机号格式错误
console.log(validate('phone', '13800138000')) // 校验通过
```

## ✅ 优点
1. 消除大量 `if/else`、`switch`
2. 策略独立，便于单独单元测试
3. 新增策略不改原有代码（开闭原则）
4. 运行时动态切换策略

## ❌ 缺点
1. 策略增多会产生大量策略对象或类
2. 调用方必须知道策略名；传入不存在的键时 `strategy[memberType]` 为 `undefined`，调用抛 `TypeError`

## 面试高频对比：策略模式 vs 状态模式（极易混淆）
- 策略模式：算法之间互相替换、互不感知，由调用方主动切换（会员折扣由调用方选择档位）
- 状态模式：状态自动流转，状态内部切换下一个状态，状态知道其他状态（订单：待付款 → 已付款 → 已发货）

## 面试口述总结
- 结构：策略集合封装算法，Context 只按名分发，不写分支。
- 切换：由调用方主动选择策略，运行时替换。
- 代价：策略名是隐式契约，未知键直接抛 `TypeError`。
- 与状态模式的区别：切换由调用方发起，而非状态内部自动流转。

> 相关：[适配器模式](/doc/adapter) · [装饰器与 @ 语法糖](/doc/decorator)
