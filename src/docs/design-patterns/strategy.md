# 策略模式（Strategy Pattern）
## 核心定义
> **定义一系列算法，把每一个算法封装成独立策略类，让它们可以互相替换；算法的变化独立于使用算法的客户。**

一句话记：**把可变的算法抽成一个个策略，外部按需切换策略，不用大量 if/else、switch。**

核心思想：**分离「策略算法」和「调用策略的上下文Context」**
- 策略：各种独立的业务算法、规则
- 上下文Context：负责接收参数，调用对应的策略，**本身不写复杂判断逻辑**

> 原则：开闭原则。新增策略，不用修改原有上下文代码。

## 适用场景
1. 同一业务有**多种分支算法**，需要动态切换（大量 if else / switch 重构首选）
2. 算法逻辑经常变化，需要新增、替换规则
3. 需要把复杂算法独立抽离，方便单独单元测试

## 角色
1. **策略接口（Strategy）**：统一规范，所有策略都实现同一个方法（JS弱类型可以省略）
2. **具体策略（ConcreteStrategy）**：封装具体算法
3. **上下文 Context**：持有策略对象，对外提供统一入口，执行策略

## JS 手写Demo（面试最简版）
### 场景：计算不同会员折扣
普通会员9折，黄金8折，钻石7折
```js
// 【策略集合：各个独立策略】
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

// 【Context 上下文】
function getPrice(memberType, price) {
  return strategy[memberType](price)
}

// 使用
console.log(getPrice('ordinary', 100)) //90
console.log(getPrice('gold', 100)) //80
console.log(getPrice('diamond', 100)) //70

// 新增VIP策略，直接加对象，不用修改getPrice，符合开闭原则
strategy.vip = (price) => price * 0.85
console.log(getPrice('vip',100)) //85
```

对比：如果不用策略模式，会写一长串if else
```js
// 不推荐！大量if else
function getPrice(memberType, price) {
  if(memberType === 'ordinary') return price *0.9
  else if(memberType === 'gold') return price *0.8
  else if(memberType === 'diamond') return price *0.7
}
```
缺点：新增折扣，要修改这个函数，违反开闭原则，分支越来越多难以维护。

## Class版本（偏传统面向对象写法，面试备选）
```js
// 策略基类
class DiscountStrategy {
  calc(price){}
}

class OrdinaryStrategy extends DiscountStrategy{
  calc(price){
    return price *0.9
  }
}
class GoldStrategy extends DiscountStrategy{
  calc(price){
    return price *0.8
  }
}

// Context 上下文
class OrderContext {
  constructor(strategy) {
    this.strategy = strategy
  }
  setStrategy(strategy) {
    this.strategy = strategy // 运行时动态替换策略
  }
  getPrice(price) {
    return this.strategy.calc(price)
  }
}

// 使用
const order = new OrderContext(new GoldStrategy())
console.log(order.getPrice(100)) //80
// 动态切换策略
order.setStrategy(new OrdinaryStrategy())
console.log(order.getPrice(100)) //90
```

## 前端实战例子
1. 表单校验（策略模式经典案例！）
不同表单字段校验规则：手机号、邮箱、必填、长度限制，每条规则作为一个策略。
2. 图片上传：不同环境不同上传策略（阿里云、腾讯云、本地）
3. 支付方式：微信、支付宝、银行卡，不同支付策略

### 表单校验小demo
```js
const validateStrategy = {
  required(value) {
    if(!value) return '不能为空'
  },
  phone(value) {
    if(!/^1[3-9]\d{9}$/.test(value)) return '手机号格式错误'
  },
  email(value) {
    if(!/^\w+@\w+\.\w+$/.test(value)) return '邮箱错误'
  }
}

function validate(type, value) {
  return validateStrategy[type](value)
}

console.log(validate('phone','1234')) //手机号格式错误
```

## ✅ 优点
1. 消除大量if else / switch
2. 策略独立，方便单独单元测试
3. 新增策略不改动原有代码，**满足开闭原则**
4. 运行时动态切换策略

## ❌ 缺点
1. 策略多的时候，会产生很多策略对象/类
2. 使用方必须知道所有策略名称，才能选择策略（需要认知成本）

## 面试高频对比：策略模式 vs 状态模式（极易混淆）
> 策略模式：**算法之间互相替换，算法之间互不感知，人为主动切换策略**
> 状态模式：**状态自动流转，状态内部自动切换下一个状态，状态知道其他状态**

举例子：
- 策略：会员折扣，我主动选黄金/钻石会员折扣
- 状态：订单状态（待付款→已付款→已发货），状态自动流转

## 面试口述总结
策略模式把多种算法封装成独立策略，统一接口，通过上下文调用，消除if else；策略可以动态替换，新增策略不用修改上下文，满足开闭原则；适合同一行为有多种不同实现的场景。策略模式是人为主动切换算法，和状态模式的自动流转有本质区别。
