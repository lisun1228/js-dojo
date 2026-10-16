---
alwaysApply: true
scene: git_message
---

# 提交信息规范

生成提交信息时必须符合项目 commitlint 校验（`.husky/commit-msg` → [commitlint.config.js](../../commitlint.config.js)），格式不符的提交会被直接拒绝。

## 格式

```text
<type>(<scope>): <subject>

<body>

<footer>
```

- `type`：必填，只能取下方枚举值，必须小写
- `scope`：可选，改动所在模块，小写，如 `router`、`docs`、`demos`、`deps`
- `subject`：必填，一句话说清本次改动，中文描述即可，结尾不加句号，不要以"更新一下""改了点东西"这类无信息量的说法结尾
- `header`（即 `<type>(<scope>): <subject>` 整行）不超过 100 个字符

## type 枚举

| type       | 用于                         |
| ---------- | ---------------------------- |
| `feat`     | 新功能                       |
| `fix`      | 修复 bug                     |
| `docs`     | 仅文档变更                   |
| `style`    | 代码格式（不影响逻辑）       |
| `refactor` | 重构（既非新功能也非修 bug） |
| `perf`     | 性能优化                     |
| `test`     | 测试相关                     |
| `build`    | 构建或依赖变更               |
| `ci`       | CI 配置变更                  |
| `chore`    | 其他杂项（初始化、配置等）   |
| `revert`   | 回滚提交                     |

## 正文与页脚

- `header` 与 `body` 之间、`body` 与 `footer` 之间都要空一行
- `body` 每行不超过 100 个字符，重点写"为什么这么改"，而不是复述"改了哪些文件"
- 存在破坏性变更时，type 后加 `!`（如 `feat!:`、`fix!:`），并在 footer 写 `BREAKING CHANGE: 具体影响与迁移方式`
- 关联 issue 写在 footer，如 `Closes #12`

## 提交前自检

`.husky/pre-commit` 会对暂存文件跑 eslint 与 Prettier 校验，存在未修复的错误会中断提交：

- 先确认 `npm run lint` 与 `npm run format:check` 通过，有问题执行 `npm run lint:fix` / `npm run format`
- 只暂存与本次改动相关的文件，不要把无关文件一起提交
- 不要生成 `--no-verify` 之类的绕过钩子的命令

## 示例

```
feat: 用户管理增加编辑用户信息能力
```

```
fix(router): 修复 /doc/:id 刷新后落入 404
```

```
docs: 补充事件传播与停止教程
```

```
refactor(demos): 提取 DemoPanel 统一承载按钮与运行日志
```

```
feat(router): 教程清单支持二级分类

分类信息原先散落在菜单与路由两处，改分类名要同步改多个文件。
现在统一由 tutorials.ts 驱动，后续新增分类只需改一处。

Closes #7
```

会被拒绝的写法：

- `更新一下` —— 缺少 type 与 subject
- `Feat: xxx` —— type 必须小写
- `feat: 修复 bug.` —— subject 结尾不能带英文句号（中文的 `。` 不会被 commitlint 拦截，但按约定同样不加）
- `feature: xxx` —— type 不在枚举内
