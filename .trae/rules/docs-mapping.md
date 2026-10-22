---
alwaysApply: true
---

# 教程文档目录规范

## 唯一映射源

[`src/router/tutorials.ts`](../../src/router/tutorials.ts) 的 `categories` 是教程分类与文档位置的**唯一数据源**，禁止在别处再维护一份清单或硬编码文档路径。

| 字段            | 含义                                                         |
| --------------- | ------------------------------------------------------------ |
| `dir`           | 分类子目录名（英文 kebab-case），决定文档位置                |
| `title`         | 分类中文名，作为侧边栏分组标题                               |
| `items[].id`    | 教程 id（英文 kebab-case，全局唯一），同时是文件名与路由参数 |
| `items[].title` | 教程中文标题                                                 |
| `items[].demo`  | 演示组件名（可选，不含 `.vue`）                              |

映射关系固定为：

```
分类 dir  +  教程 id   →   src/docs/<dir>/<id>.md
                          src/components/demos/<demo>.vue
                          /doc/<id>
```

## 目录约定

```
src/docs/
├── index.ts              # 装配层：按 categories 统一加载，不为单个文档开特例
├── design-patterns/      # 设计模式
├── vue/                  # Vue
└── js-principles/        # JS 原理
```

- 文档**必须**放在对应分类目录下，不允许在 `src/docs/` 根目录散落 `.md`
- 目录名必须与 `categories[].dir` 完全一致；新增分类时两处同时创建
- 目录下只放该分类的正文，不放图片等资源
- `src/docs/index.ts` 按 `./<dir>/<id>.md` 统一加载，缺少文件会在应用启动时直接抛错

## 新增 / 修改教程

1. 在 `src/docs/<dir>/` 下新增或修改 `<id>.md`
2. 需要交互演示时，在 `src/components/demos/` 下新增 `<PascalCase>Demo.vue`，用 `DemoPanel` 承载按钮与日志
3. 在 `categories` 对应分类的 `items` 里登记 `{ id, title, demo? }`
4. 同步更新 README 的「目录结构」与「现有教程」相关说明

新增分类：在 `categories` 里增加 `{ dir, title, items: [] }`，并在 `src/docs/` 下建同名目录。

## 命名与内容

- `dir`、`id` 一律英文 kebab-case，不用中文、空格、下划线
- 文档首行固定为 `# 中文标题`，与 `items[].title` 保持一致
- 正文图片放 `public/`，用根路径引用（`![说明](/xxx.png)`）；`src/assets` 相对路径在 `?raw` 渲染链路下必然 404
- 需要流程图时直接用 `mermaid` 代码块，构建期会渲染成内联 SVG（明暗主题各一份），不要手写 ASCII 流程图或再引入图表库

## 文档目录（TOC）

除总览与索引页（`src/docs/**/*-overview.md`）外，每篇正文都必须在第一个二级标题前提供 `## 目录`：

```md
---

## 目录

- [6.1 Set 数据结构](#61-set-数据结构)
- [6.2 Set 与数组互转](#62-set-与数组互转)

---

## 6.1 Set 数据结构
```

- 只收录 `##` 二级标题，按正文顺序排列；总览页本身承担索引职责，不再重复加目录
- 链接文字与标题原文一致；锚点遵循 GitHub 风格：转小写、去掉标点、空格换成 `-`，与 `MarkdownView.vue` 的 `slugify` 保持一致
- 目录放在开头说明块之后、第一个二级标题之前，前后各用一条 `---` 与正文分隔
- 新增、删除或重命名二级标题时，同步更新目录文字与锚点

## 提交前自检

- `npm run lint`、`npm run format:check`、`npm run build` 全部通过
- 每个 `categories` 条目都能在磁盘上找到对应的 `.md`（有 `demo` 的还要能找到 `.vue`）
- 除 `*-overview.md` 外，每篇文档都有 `## 目录`，且目录锚点能跳到对应标题
- 没有绕过映射、直接按文件名猜路径的代码
