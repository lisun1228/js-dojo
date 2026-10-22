# 单例模式（Singleton）

保证一个类**全局只有一个实例**，并提供一个访问它的统一入口。常见于：全局状态、配置管理、日志器、弹窗管理器等。

---

## 目录

- [关键点](#关键点)
- [实现](#实现)
- [测试](#测试)

---

## 关键点

1. 用**静态属性**保存唯一实例
2. **私有化构造**（JS 没有真正的私有构造，用判断兜底）——外部 `new` 时直接返回已有实例
3. 提供 `getInstance()` 作为统一入口

## 实现

```js
class Singleton {
  // 静态变量保存唯一实例
  static instance

  constructor() {
    // 已经创建过就直接返回旧实例
    if (Singleton.instance) {
      return Singleton.instance
    }
    Singleton.instance = this
  }

  // 对外获取实例的方法
  static getInstance() {
    if (!Singleton.instance) {
      Singleton.instance = new Singleton()
    }
    return Singleton.instance
  }

  sayHello() {
    console.log('我是单例')
  }
}
```

## 测试

```js
const s1 = Singleton.getInstance()
const s2 = Singleton.getInstance()

console.log(s1 === s2) // true，同一个引用
```

> `constructor` 里 `return` 一个对象时，`new` 的结果就是这个被返回的对象——这是「**构造函数返回值覆盖默认实例**」的特性，也是单例能拦住外部 `new` 的原因。
