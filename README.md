# JS 道场 · js-dojo

一个用来沉淀前端知识点的学习型项目：**教程正文用 Markdown 写，页面负责渲染，并配一个可运行的交互演示**。

- 正文与样式解耦：新增教程只需写 `.md`，不用手写模板和 CSS
- 每个教程配独立的可运行 Demo，点按钮即可看到实际输出
- 教程分类、菜单、路由由同一份配置驱动

## 技术栈

| 依赖 | 版本 | 用途 |
| --- | --- | --- |
| Vue | ^3.5 | 框架（`<script setup>` SFC，Vue 3.5 的 `useTemplateRef` 等新 API） |
| Vue Router | ^4.6 | 路由（history 模式 + 懒加载） |
| TypeScript | ~6.0 | 类型检查 |
| Vite | ^8.3 | 开发与构建 |
| markdown-it | ^15 | Markdown → HTML |
| highlight.js | ^11 | 代码块语法高亮 |

## 快速开始

```bash
npm install

npm run dev       # 启动开发服务器（默认 http://localhost:5173）
npm run build     # 类型检查 + 构建产物（vue-tsc -b && vite build）
npm run preview   # 本地预览构建产物
```

环境要求：Node.js 20+（建议使用 LTS 版本）。

## 目录结构

```
src/
├── docs/                    # 教程正文
│   ├── index.ts             # 装配层：按清单加载 md 与演示组件
│   └── *.md                 # 每篇教程一个文件
├── components/
│   ├── MarkdownView.vue     # Markdown 渲染组件（markdown-it + highlight.js）
│   └── demos/               # 各教程的交互演示
│       ├── DemoPanel.vue    # 统一的「按钮 + 运行日志」外壳
│       ├── useDemoLog.ts    # 日志收集 composable
│       └── *Demo.vue
├── router/
│   ├── tutorials.ts         # ★ 教程分类与清单（唯一数据源）
│   └── index.ts             # 路由表
├── views/
│   ├── DocView.vue          # 通用教程页：按 /doc/:id 渲染正文 + 演示
│   ├── HomeView.vue         # 首页（占位）
│   └── NotFound.vue         # 404 兜底
├── App.vue                  # 布局：页头 + 左侧分类导航 + 内容区
├── main.ts                  # 入口
└── style.css                # 全局样式与主题变量（含深色模式）
```

## 教程体系

### 数据流

[`src/router/tutorials.ts`](src/router/tutorials.ts) 是**唯一数据源**，一份清单同时驱动三处：

```
tutorials.ts（分类 + 教程清单）
   ├─ tutorialMenus  →  App.vue 左侧导航
   ├─ /doc/:id       →  DocView.vue 按 id 取内容
   └─ tutorials      →  docs/index.ts 装配 md 正文 + 演示组件
```

分类（标题、顺序、归属）只在这个文件里定义一次，改分类名只需改一处。

### 现有教程

| 分类 | 教程 | 路由 |
| --- | --- | --- |
| 设计模式 | 装饰器 + @语法糖 | `/doc/decorator` |
| 设计模式 | 适配器模式 | `/doc/adapter` |
| 设计模式 | 策略模式 | `/doc/strategy` |
| 设计模式 | 单例模式 | `/doc/singleton` |
| Vue | Props / 插槽 / $attrs | `/doc/props-slots` |
| Vue | Proxy 与响应式 | `/doc/proxy-reactive` |
| Vue | 响应式原理 effect | `/doc/reactive-effect` |
| JS 原理 | 事件传播与停止 | `/doc/event-propagation` |
| JS 原理 | 手写 call / bind | `/doc/call-bind` |
| JS 原理 | 原型与原型链 | `/doc/prototype-chain` |

### 新增一篇教程

1. 在 `src/docs/` 下新建 `<id>.md` 作为正文（首行用 `# 标题`）
2. 需要交互演示的话，在 `src/components/demos/` 下新建 `<Xxx>Demo.vue`
3. 在 `src/router/tutorials.ts` 对应分类里加一条记录：

```ts
{ id: 'xxx', title: '菜单标题', demo: 'XxxDemo' }
```

侧边栏、路由、正文渲染都会自动跟随，不需要改其他地方。

### 写一个演示组件

演示统一用 `DemoPanel` 承载「按钮 + 运行日志」，样式由它提供，业务组件只关心逻辑：

```vue
<template>
  <DemoPanel :logs="logs" hint="操作提示" @clear="clear">
    <button class="run" @click="run">运行</button>

    <!-- 需要可视化交互的元素（可点击的 DOM 结构等）放 body 插槽 -->
    <template #body>
      <div ref="boxEl">点我</div>
    </template>
  </DemoPanel>
</template>

<script setup lang="ts">
import DemoPanel from './DemoPanel.vue'
import { useDemoLog } from './useDemoLog'

const { logs, push, clear } = useDemoLog()

const run = () => push('输出一行日志')
</script>
```

按钮加 `.run` 类即可获得统一样式（`DemoPanel` 通过 `:slotted()` 提供）。

## 路由

| 路径 | 说明 |
| --- | --- |
| `/` | 首页（占位） |
| `/doc/:id` | 通用教程页，`id` 对应 `src/docs/<id>.md` |
| `/:pathMatch(.*)*` | 404 兜底，展示请求的路径 |

## 实现要点

- **Markdown 渲染**：用 Vite 的 `?raw` 把 `.md` 当字符串导入，交给 `markdown-it` 渲染；`highlight.js` 只按需注册 `ts / js / json / bash / sh / html / xml / vue / css / md`，避免整个语言包进 bundle。
- **代码分割**：md 正文与演示组件都随 `DocView` 懒加载，主包保持精简。
- **代码块换行**：全局 `style.css` 给 `code` 设了 `display: inline-flex`，会把高亮产生的每个 `<span>` 当成 flex item 横排、丢掉换行，因此 `MarkdownView` 里把 `pre code` 重置为 `display: block`。
- **左侧导航吸附**：`.sidebar-inner` 用 `position: sticky; top: 0`，页头滚出视口后导航停住不再跟随滚动；`.sidebar` 自身保持撑满全高，保证右侧分隔竖线完整。
- **装饰器教程**：`tsconfig.app.json` 开启了 `experimentalDecorators`。
- **TS 6.0 注意点**：不再允许对普通函数声明使用 `new`（TS7009），示例里改用 `class` 或 `Object.create(X.prototype)`。
