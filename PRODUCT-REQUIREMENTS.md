# js-dojo 产品改进需求（评审稿）

> 视角：产品经理 · 状态：待评审 · 范围：本轮只出文档，不写实现代码
>
> 结论先行：这个项目缺的不是内容，而是「从一篇走到下一篇」的链路没有闭合。优先修可用性与闭环，不加分类、不加题量。

## 0. 先把题目改小

### 0.1 原题的真实意图

不是「列尽可能多的点子」，而是：在现有内容资产上判断哪几件事最值得做，并让这个判断可以被别人复核。

### 0.2 四问

**1. 该领域的顶尖专家会做、但原题没要求的事**

- 先定义用户与场景（面试复习者 / 团队新人），再谈功能；[README.md](file:///Users/wangli/projects/demo/js-dojo/README.md) 只写了「学习型项目」，没有目标用户。
- 给每个需求写清失败模式，而不是只写收益：移动端正文约 103px、154 个代码块没有高亮、65KB 长文没有大纲。
- 每条需求配可执行验收：`npm run check:docs`、375px 实机点击、Lighthouse / axe 报告。
- 显式写出「不做什么」（第 4 节），防止用扩范围换「完整感」。
- 找 5 个真实学习者做任务测试，而不是作者自己点一遍。

**2. 最原始的素材，而不是已整理好的结论**

- 仓库一手事实：[tutorials.ts](file:///Users/wangli/projects/demo/js-dojo/src/router/tutorials.ts)（17 分类 / 148 篇 / 13 个已登记 Demo）、`src/docs/**`（约 2.4M 字符）、[MarkdownView.vue](file:///Users/wangli/projects/demo/js-dojo/src/components/MarkdownView.vue#L25-L51) 的语言注册表、[index.html](file:///Users/wangli/projects/demo/js-dojo/index.html#L2-L14)、[router/index.ts](file:///Users/wangli/projects/demo/js-dojo/src/router/index.ts#L36-L73)、[doc-check.ts](file:///Users/wangli/projects/demo/js-dojo/build/doc-check.ts)。
- 运行结果：`npm run check:docs` 的真实输出、`npm run build` 是否通过、Lighthouse 报告、任务测试记录。
- 缺什么：项目没有埋点也没有后端，拿不到真实访问数据。因此本文只使用代理指标，风险是「自己觉得好用」，用 5 人任务测试补足。

**3. 使用的具体方法和工具**

- 只读统计：按代码块首行的语言标记统计 `src/docs`（命令见第 6 节），得到未注册语言共 154 个代码块。
- 契约检查：`npm run check:docs`、`npm run check:graph`、`npm run build`。
- 真实浏览器：375×667 与 1440×900 各走一篇长文；Lighthouse mobile；axe DevTools。
- 对照证据：改前 / 改后截图，以及同一组 10 个搜索词的前 3 条结果。

**4. 除你我之外，什么能证明结果正确**

- 可执行检查：`check:docs` 输出「148 篇 / 17 个分类 / 13 个演示」，`build` / `lint` / `format:check` 通过。
- 可复现产物：Lighthouse 与 axe 报告、CI 运行链接、操作录屏。
- 一致性与可复现性：同一份 5 人任务脚本（冷启动、不提示）得到的完成率。
- 公认标准：WCAG 2.2 的 1.4.10（回流）、2.4.1（跳过区块）、2.4.7（焦点可见）。

### 0.3 原题 → 新题（diff）

```diff
- 给这个项目提需求或优化
+ 在 148 篇 / 17 分类 / 13 Demo 的现状上，提出 ≤8 条带证据、带验收、带边界的改进，并明确不做什么

- 需求清单即可
+ 每条需求必须回答：谁的问题、证据在哪、怎么验收、失败模式是什么、不做什么

- 尽量全面
+ 只覆盖「找到 → 读懂 → 练手 → 继续」链路上最断的三处，加两处可信度守卫

- 产品视角泛谈
+ 以「一次会话内完成一篇到下一篇」为北极星，功能必须服务它
```

每处改动对应：四问 1（失败模式与验收）、四问 2（仓库事实）、四问 3（方法）、四问 4（证据）。

### 0.4 本轮边界

- 只产出本文件，不改任何 `.vue` / `.ts` / 教程正文，不新增依赖。
- 不用「更多分类、更多题、全量补 Demo」来换规模。

## 1. 现状：只用可复核的事实

| 维度     | 现状                                                                                                                                                                                  | 证据                                                                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 内容规模 | 17 分类 / 148 篇 / 约 2.4M 字符，最长单篇 65.7KB                                                                                                                                      | 文档统计；[vue3-interview.md](file:///Users/wangli/projects/demo/js-dojo/src/docs/vue/vue3-interview.md)                                                      |
| 练手覆盖 | 13 篇有 Demo，占 8.8%，集中在 JS 原理 / Vue / 设计模式                                                                                                                                | [tutorials.ts](file:///Users/wangli/projects/demo/js-dojo/src/router/tutorials.ts)                                                                            |
| 发现     | 菜单搜索 + 正文索引 + 知识图谱；搜索上限 5 条菜单 + 8 条正文，无快捷键、无排序                                                                                                        | [DocSearch.vue](file:///Users/wangli/projects/demo/js-dojo/src/components/DocSearch.vue#L179-L180)                                                            |
| 阅读     | 5 套主题、沉浸模式、图片预览、回到顶部、锚点；滚动位置只存在内存                                                                                                                      | [router/index.ts](file:///Users/wangli/projects/demo/js-dojo/src/router/index.ts#L36-L60)                                                                     |
| 移动端   | 侧栏默认 240px；≤860px 只把搜索挪一行；375px 下正文约 103px                                                                                                                           | [App.vue](file:///Users/wangli/projects/demo/js-dojo/src/App.vue#L166-L167)、[App.vue](file:///Users/wangli/projects/demo/js-dojo/src/App.vue#L351-L361)      |
| 代码呈现 | 只注册 7 种语言（js / ts / json / bash / xml / css / markdown）；154 个代码块（jsx / http / nginx / sql / scss / yaml / dockerfile 等）无高亮                                         | [MarkdownView.vue](file:///Users/wangli/projects/demo/js-dojo/src/components/MarkdownView.vue#L25-L51) + fence 统计                                           |
| 页面身份 | `lang="en"`、无 description、标题恒为「JS 道场」                                                                                                                                      | [index.html](file:///Users/wangli/projects/demo/js-dojo/index.html#L2-L14)、[router/index.ts](file:///Users/wangli/projects/demo/js-dojo/src/router/index.ts) |
| 质量门禁 | `check:docs` / `check:graph` 存在，但无 CI、无测试；README 仍写「首页（占位）」，[docs/index.ts](file:///Users/wangli/projects/demo/js-dojo/src/docs/index.ts#L9-L10) 注释仍写 146 篇 | [package.json](file:///Users/wangli/projects/demo/js-dojo/package.json#L6-L17)；仓库无 `.github`                                                              |

三个断裂带：

1. **读懂断点**：65KB 长文只有顶部目录，滚到中部后失去定位。
2. **继续断点**：文末没有上一篇 / 下一篇，刷新后阅读位置与进度都丢失。
3. **门槛断点**：移动端正文被侧栏挤到约 103px；154 个代码块无高亮；分享出去的链接没有文章级标题。

## 2. 目标与衡量

北极星（代理指标）：**新会话中，读者从当前文成功进入下一篇或关联文的比例 ≥ 60%**。用 5 人任务测试、每人 3 次机会测量，因为项目没有埋点。

| 指标               | 现状     | 目标                     | 怎么测              |
| ------------------ | -------- | ------------------------ | ------------------- |
| 375px 正文可读宽度 | 约 103px | ≥ 320px 且无横向滚动     | DevTools 截图       |
| 未高亮代码块       | 154      | 0（`text` 除外）         | 统计命令 + 新增检查 |
| 长文大纲           | 无       | >20KB 文档有 sticky 大纲 | 实机点击            |
| 到达下一篇         | 3 次点击 | 1 次                     | 任务测试            |
| 搜索任务成功       | 未测     | ≥ 4/5                    | 固定 10 个查询词    |
| 文档契约           | 本地通过 | 通过且 CI 强制           | Actions 运行记录    |

## 3. 需求清单

### P0-1 移动端先能读，再谈学

**问题证据**：侧栏初始 240px 且无移动端断点，375px 视口下正文只剩约 103px；开关只有 16px 宽，触控几乎点不中。

**需求**：≤860px 默认收起侧栏，改为带遮罩的抽屉，点击条目后自动关闭；开关触控区 ≥44×44；正文最小可读宽度不被挤压；代码块与表格只在自身内部横向滚动。

**不做什么**：不做底部 Tab、不做独立移动端布局、不改分类结构。

**验收**：375×667 打开 `/doc/vue3-interview`，正文宽度 ≥320px、页面无横向滚动；Tab 可聚焦开关并展开抽屉；Esc 可关闭；Lighthouse mobile 不再报内容溢出。

**证据**：改前 / 改后截图 + Lighthouse JSON。

### P0-2 代码块从「能看」到「能用」

**问题证据**：`MarkdownView` 只注册了 js / ts / json / bash / xml / css / markdown；实际正文中 jsx 47、http 60、nginx 22、sql 3、scss / sass 3、yaml 1、dockerfile 3、java / python / apache 3、text 12，共 154 个代码块没有配色（其中 12 个标记为 `text`，属于有意为之）。代码块也没有复制入口。

**需求**：补齐上述语言的注册（`text` 保持纯文本但显示语言角标）；代码块右上角提供「复制」并在成功 / 失败时给出可见反馈。

**不做什么**：不引入 shiki 或在线代码编辑器，不做「在浏览器里运行示例」。

**验收**：`npm run check:docs` 新增规则「fence 语言必须在白名单内」，当前 154 个告警降为 0；随机抽 3 篇点击复制，剪贴板内容与代码块逐字一致；未知语言显示角标而不是报错。

**证据**：`check:docs` 输出 + 复制后剪贴板截图。

### P0-3 页面身份与可分享性

**问题证据**：[index.html](file:///Users/wangli/projects/demo/js-dojo/index.html#L2) 是 `lang="en"`，无 description；[router/index.ts](file:///Users/wangli/projects/demo/js-dojo/src/router/index.ts) 没有任何标题逻辑，148 篇共用「JS 道场」一个标题。

**需求**：改为 `zh-CN`；每篇标题为「文档标题 · JS 道场」，首页为「JS 道场 · 前端知识地图」，404 也有标题；description 优先取正文首段，缺少时用分类 + 标题兜底；切换文章时同步更新。

**不做什么**：不做 SSR / 预渲染、不生成 OG 图片、不做多语言。

**验收**：直接打开 `/doc/this-binding`，标签页标题包含「this 指向」；查看源码 `lang="zh-CN"` 且有 description；从搜索跳转另一篇后标题随之变化；`/doc/不存在` 显示专用标题。

**证据**：浏览器标签页截图 + 页面源码。

### P1-1 长文大纲：让 65KB 的文章可定位

**问题证据**：3 篇超过 33KB（最大 65.7KB），正文只有顶部 `## 目录`；滚到中部后没有任何常驻定位，回到顶部按钮只能救急。

**需求**：≥1280px 显示右侧 sticky 大纲（`h2`，必要时含 `h3`），当前可视小节高亮；点击跳转并更新 hash；≤1200px 隐藏，不占用正文宽度。锚点必须复用现有 [slugify.ts](file:///Users/wangli/projects/demo/js-dojo/src/utils/slugify.ts)，与正文目录、搜索跳转保持一致。

**不做什么**：不改教程正文里的 `## 目录`；不引入滚动监听库；不做多层折叠树。

**验收**：打开 `/doc/vue3-interview`，滚到中部时高亮项与当前小节一致；点击任一项，URL hash 变化且标题贴顶；1200px 宽下大纲消失且无横向滚动。

**证据**：截图 + 地址栏 hash。

### P1-2 学习闭环：从「读完」到「下一篇」

**问题证据**：[DocView.vue](file:///Users/wangli/projects/demo/js-dojo/src/views/DocView.vue#L1-L15) 只渲染正文、Demo、关联知识，没有分类归属与上下游；滚动位置只存在内存 Map，刷新即丢；侧栏没有任何进度。

**需求**：文末显示「所属分类 + 上一篇 / 下一篇」；侧栏分类标题显示「已读 / 总数」；已读以手动「标记已读」为准，滚动到 90% 只做提示不自动写入；进度写入 localStorage，并提供一键清除。

**不做什么**：不做账号、云同步、连续打卡、积分与排行榜。

**验收**：标记 3 篇后刷新，侧栏计数保持；首尾两篇的上一篇 / 下一篇只有一个方向；顺序与 `tutorials.ts` 一致；清除后归零；localStorage key 不与主题的 `js-dojo-theme` 冲突。

**证据**：操作录屏 + localStorage 截图。

### P1-3 搜索：既支持「知道名字」，也支持「只记得一句话」

**问题证据**：结果硬上限 5 条菜单 + 8 条正文；按文档顺序命中，标题命中与正文命中同权；没有快捷键、没有分类过滤、没有最近搜索。

**需求**：`Cmd/Ctrl + K` 聚焦并全选；标题命中排在仅正文命中之前；显示结果总数；支持按 `categories` 过滤；保留最近 5 条本地记录；首次加载索引时显示明确的加载态。

**不做什么**：不做向量检索、拼音搜索、后端搜索；不把索引改为常驻加载。

**验收**：任意页面按 `Cmd/Ctrl + K` 能聚焦；搜「原型」时标题含该词的结果排在仅正文命中的前面；筛选「Vue」后结果全部来自 vue 分类；最近记录可点击复现；清空后不残留。

**证据**：固定 10 个查询词的前 3 条结果对照表 + 截图。

### P2-1 无障碍与动效偏好

**问题证据**：[SideNav.vue](file:///Users/wangli/projects/demo/js-dojo/src/components/SideNav.vue#L2-L7) 在收起时只设置 `aria-hidden`，内部链接仍可通过 Tab 聚焦；全站没有「跳到正文」；[style.css](file:///Users/wangli/projects/demo/js-dojo/src/style.css) 没有 `prefers-reduced-motion` 处理。

**需求**：侧栏收起时同时移出焦点顺序；补「跳到正文」；系统偏好减少动效时关闭过渡与平滑滚动；所有图标按钮有可见焦点样式。

**不做什么**：不追求 WCAG 全量认证，不做读屏全量回归。

**验收**：收起侧栏后连续 Tab，焦点不进入隐藏链接；axe DevTools 无 serious 级问题；开启系统「减少动态效果」后切换主题、跳转锚点无动画。

**证据**：axe 报告 + 键盘操作截图。

### P2-2 让检查不只活在本地

**问题证据**：`check:docs` / `check:graph` 已能拦住锚点、互链、图谱问题，但仓库没有 `.github`，也没有测试框架；Husky 可被 `--no-verify` 绕过。README 写「首页（占位）」而首页已完整实现，注释写 146 篇而实际 148 篇，已经出现文档漂移。

**需求**：在 PR 上跑 `lint`、`format:check`、`check:docs`、`check:graph`、`build`；把 README 里的教程数量、演示数量改为引用 `check:docs` 的输出或直接删掉硬编码数字；P0 / P1 的验收项逐步固化为检查。

**不做什么**：不引入 Playwright / E2E 大套件，不设覆盖率门槛。

**验收**：新 PR 触发 3 个以上检查且全绿；故意改坏一个目录锚点，CI 失败并指出文件行号；README 不再出现与 `check:docs` 输出不一致的数字。

**证据**：Actions 运行链接 + 一次故意失败的日志。

## 4. 明确不做

| 想法                        | 为什么不做                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------- |
| 账号、评论、收藏云同步      | 没有后端，维护成本远大于收益；与静态知识库定位冲突                                 |
| 内置 AI 问答                | 已有划词跳转豆包 / DeepSeek / 智谱；自建问答需要内容质量评估与持续成本，收益未验证 |
| 新增分类、批量补教程        | 已有 148 篇覆盖 17 类；当前问题是「读完用不上」，不是「题不够」                    |
| 给 148 篇都补 Demo          | 只增加成本；先把 13 个 Demo 的「预期 → 运行 → 对照」做扎实                         |
| SSR、预渲染、国际化         | 目标是个人 / 团队知识库，SEO 收益小于改造风险                                      |
| 迁移到 VitePress / VuePress | MarkdownView、知识图谱、构建期校验是差异化能力，迁移等于重写                       |
| 打卡、积分、排行榜          | 没有真实用户基数，先验证已读与跳转闭环                                             |
| 全站埋点上报                | 隐私与后端成本高；先用本地记录 + 5 人任务测试拿证据                                |

## 5. 顺序与规模

规模只按涉及文件与是否引入依赖估算：S（1–2 个文件）、M（3–6 个文件）、L（跨构建与页面，需拆期）。

| 顺序 | 需求          | 规模 | 依赖 / 理由                                          |
| ---- | ------------- | ---- | ---------------------------------------------------- |
| 1    | P0-2 代码块   | M    | 先建立语言白名单检查，后续新增教程不再漏             |
| 2    | P0-1 移动端   | M    | 不依赖其他需求，但影响所有后续验收的截图口径         |
| 3    | P0-3 页面身份 | S    | 独立，可并行                                         |
| 4    | P1-1 长文大纲 | M    | 复用 slugify 与标题锚点，是 P1-2 的前置              |
| 5    | P1-2 学习闭环 | M    | 依赖 `tutorials.ts` 的稳定顺序；大纲先落地，跳转才顺 |
| 6    | P1-3 搜索     | M    | 可独立；排序规则要先定，避免反复改                   |
| 7    | P2-1 无障碍   | S    | 与移动端同改侧栏，合并做更省                         |
| 8    | P2-2 CI       | S/M  | 最后把前 7 条的验收固化，避免边改边漂                |

## 6. 怎么证明改对了

**一键检查**

```bash
npm run lint && npm run format:check && npm run check:docs && npm run check:graph && npm run build
```

**只读统计（代码块语言分布）**

````bash
rg -o '^```[a-z]+' src/docs | sed 's/.*```//' | sort | uniq -c | sort -rn
````

**浏览器验收路径**

- 375×667：`/doc/vue3-interview` 读 3 屏，检查正文宽度、抽屉开合、无横向滚动。
- 1440×900：`/doc/vue3-interview` 滚动到中部，检查大纲高亮与跳转。
- `/doc/this-binding`：检查标题、上一篇 / 下一篇、已读计数刷新保持。
- 任意页按 `Cmd/Ctrl + K`，搜「原型」「属性枚举」「CORS」，对照前 3 条结果。

**5 人任务测试脚本（每项只记录，不提示）**

1. 在你手机上读完「this 指向」并告诉我下一篇是什么。
2. 在「Vue 3 高频面试题」里找到「Diff 算法」相关小节。
3. 搜到「属性枚举」并打开它。

记录：是否完成、卡在哪一步、是否用到侧栏、是否发现复制按钮。

**反向指标（防止越做越大）**

- 首包 gzip 不得因本轮需求净增超过 10KB；提 PR 时给出改前 / 改后数值。
- 每新增一个常驻 UI 入口，必须合并或移除一个现有入口。
- 新依赖必须写明「为什么现有能力不够」，否则默认不加。
- 新增文档只允许是教程或本文件，不为单个需求再开设计文档。

## 附录：本文数字的来源

- 148 篇 / 17 分类 / 13 个已登记 Demo：`npm run check:docs` 输出与 [tutorials.ts](file:///Users/wangli/projects/demo/js-dojo/src/router/tutorials.ts) 统计（2026-10-27）。
- 约 2.4M 字符、最长 65.7KB：对 `src/docs/**/*.md` 的字符数统计。
- 154 个未注册语言代码块：第 6 节的 `rg` 统计减去已注册语言与 `mermaid`。
- 375px 下正文约 103px：375 − 240（侧栏）− 32（左右内边距）。
