# 适配器模式（Adapter Pattern）
---

## 目录

- [核心定义](#核心定义)
- [角色](#角色)
- [适用场景](#适用场景)
- [JS Demo（对象适配器，前端最常用）](#js-demo对象适配器前端最常用)
- [Class版本（类适配器，了解即可，JS很少用）](#class版本类适配器了解即可js很少用)
- [前端真实业务例子](#前端真实业务例子)
- [🔥面试重点区分（高频对比题）](#面试重点区分高频对比题)
- [✅优点](#优点)
- [❌缺点](#缺点)
- [面试口述总结](#面试口述总结)

---

## 核心定义

> **将一个类/对象的接口，转换成客户期望的另一个接口，让原本因为接口不兼容而不能一起工作的类可以协同工作。**

## 角色

1. **目标接口 Target**：客户希望使用的接口，即业务层依赖的统一格式。
2. **被适配者 Adaptee**：接口格式不匹配的原有对象或旧接口。
3. **适配器 Adapter**：实现 Target，内部调用 Adaptee，完成参数与返回值转换。

## 适用场景

1. 第三方库或遗留接口的参数、返回值与项目规范不一致，且不能修改其源码。
2. 需要把多个来源的返回结构统一成一种格式。

## JS Demo（对象适配器，前端最常用）

> 旧接口返回 `{code:0, msg:'ok', data:{userName:'张三'}}`
> 目标格式为 `{success:true, message:'ok', result:{name:'张三'}}`
> 用适配器做字段映射。

```js
// 被适配者 Adaptee：旧接口（不能改动）
const oldApi = {
  request() {
    return { code: 0, msg: 'ok', data: { userName: '张三' } }
  },
}

// 适配器 Adapter：包装旧接口，转换成目标格式
const apiAdapter = {
  fetch() {
    const oldRes = oldApi.request()
    return {
      success: oldRes.code === 0,
      message: oldRes.msg,
      result: { name: oldRes.data.userName },
    }
  },
}

console.log(oldApi.request())
// { code: 0, msg: 'ok', data: { userName: '张三' } }
console.log(apiAdapter.fetch())
// { success: true, message: 'ok', result: { name: '张三' } }
```

## Class版本（类适配器，了解即可，JS很少用）

```js
// 目标接口 Target
class Target {
  getInfo() {}
}

// 被适配者 Adaptee
class OldService {
  oldGet() {
    return { userName: '李四' }
  }
}

// 适配器 Adapter：继承 OldService，对外暴露 Target 的 getInfo()
class Adapter extends OldService {
  getInfo() {
    const oldData = this.oldGet()
    return { name: oldData.userName }
  }
}

const adapter = new Adapter()
console.log(adapter.getInfo())
// { name: '李四' }
```

## 前端真实业务例子

1. 多个微服务返回结构不一致，封装适配器统一成一种结构。
2. 第三方 SDK 的方法名、参数与项目规范不同，包一层适配器。
3. 浏览器 API 存在差异，适配成同一套调用方式。

## 🔥面试重点区分（高频对比题）

### 适配器 vs 装饰器模式

- **适配器**：转换接口，对外方法/参数格式改变，目的是**兼容**。
- **装饰器**：接口保持不变，在前后加逻辑，目的是**增强**。

> 适配器：三孔插头配两孔插座，加转换头（接口变了）；装饰器：杯子套保温套，杯子与喝水方式不变，多了保温能力。

### 适配器 vs 代理模式

- **适配器**：转换接口，为了兼容旧代码。
- **代理**：接口不变，控制访问、预处理或缓存。

### 适配器 vs 策略模式

- **适配器**：包装已有对象，**改变接口**，解决兼容问题。
- **策略**：多个平等算法**接口一致**，运行时切换算法。

## ✅优点

1. 复用旧代码，**不修改原有对象源码**，符合开闭原则。
2. 隔离新旧代码，业务层不关心底层数据差异。
3. 对外接口统一，上层业务代码更简单。

## ❌缺点

- 多一层包装，代码复杂度上升；适配器过多会增加维护成本。
- 多一层调用，有轻微性能损耗。

## 面试口述总结

- 适配器由 Target、Adaptee、Adapter 三部分组成，业务层只依赖 Target。
- 适配器只做接口转换：不增强功能、不控制访问、不切换算法。
- 适用前提：接口格式不兼容、被适配者源码不能改，但两者需要协同工作。
