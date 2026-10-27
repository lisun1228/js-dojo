# 工程化 08｜Git 工作流

> 覆盖题单 6、7、8、9、34：merge vs rebase、rebase 冲突、常用命令、分支模型

---

## 目录

- [8.1 题单答案的问题](#81-题单答案的问题)
- [8.2 merge vs rebase](#82-merge-vs-rebase)
- [8.3 rebase 冲突怎么解决](#83-rebase-冲突怎么解决)
- [8.4 Git 常用命令](#84-git-常用命令)
- [8.5 分支模型（面试常连着问）](#85-分支模型面试常连着问)
- [8.6 面试怎么说（2 分钟版）](#86-面试怎么说2-分钟版)
- [8.7 速记卡](#87-速记卡)
- [8.8 自测](#88-自测)

---

## 8.1 题单答案的问题

> **6.** merge：保留分叉历史，生成 merge commit。rebase：把提交"搬"到目标分支顶端，历史线性。推荐：公共分支用 merge，个人分支用 rebase。
>
> **7.** 解决冲突后 `git add`，然后 `git rebase --continue`，放弃用 `--abort`。

两条结论都对，但缺三件事：

1. 「搬」是错的：rebase 不移动提交，而是重放变更、新建提交。这决定了「为什么不能 rebase 公共分支」
2. 没说 rebase 冲突时 `HEAD` 指向谁——它和 merge 完全相反，是最容易选错的一处
3. 常用命令只列了 12 个名字，没有任何场景

---

## 8.2 merge vs rebase

### 一句话结论

> **merge 生成一个新提交，rebase 重写你的提交。** 前者保留分叉，后者抹平分叉。

### 实测：同一个分叉，两种处理

初始状态（A 是共同祖先，feature 上有 B、C，main 上有 D、E）：

```
* (feature) C: feature 2
* B: feature 1
| * (main) E: main 2
| * D: main 1
|/
* A: base
```

#### 方案 A：`git merge --no-ff feature`

```
*   merge feature into main      ← 新增的 merge commit
|\
| * C: feature 2
| * B: feature 1
* | E: main 2
* | D: main 1
|/
* A: base
```

- 提交数 **6**（原 5 个 + 1 个 merge commit）
- 历史保留分叉
- **B、C 的 hash 不变**

#### 方案 B：`git rebase main`（在 feature 分支上）

```
* C' (feature)     ← 新对象
* B'
* E (main)
* D
* A
```

- 提交数 **5**，没有 merge commit
- 历史完全线性
- **B、C 的 hash 变了**

### hash 为什么变

commit 的 hash 由对象内容算出（默认 SHA-1）：

```
commit hash = 内容树 hash + 父提交 hash + 作者/提交者 + 时间戳 + message
```

```
$ git cat-file -p <rebase 后的 B>
tree   <内容树，与原来相同>
parent <E>          ← 原 B 的 parent 是 <A>
```

**父提交变，hash 必变。** 所以 rebase 不是「把提交搬到新位置」，而是「把每个提交的变更重新应用一遍，产生一批全新的提交」。原来的 B、C 仍在仓库里（reflog 能找到），只是没有分支指向它们。

### 黄金法则

> **永远不要 rebase 已经推送到公共分支的提交。**

后果：同事本地仍指向 B、C。他 merge 会把 B、C 和 B'、C' 都合进来（同一份改动出现两次）；他 rebase 则会把两边不同的提交逐一重放，产生大量冲突。

| 情况 | 能否 rebase |
|---|---|
| 只有本地有这些提交（没 push） | ✅ |
| 已 push，但只有自己用这个分支 | 🟡 可以，但要 `--force-with-lease` |
| 已 push 且别人也基于它开发 | ❌ |
| main / develop 等公共分支 | ❌ |

### `--force` 和 `--force-with-lease` 的区别

rebase 后推送必须强制，因为远端还留着被重写掉的旧提交（原来的 B、C）。

```bash
git push --force                 # 无条件覆盖
git push --force-with-lease      # 远端变了就拒绝
```

| 参数 | 行为 | 风险 |
|---|---|---|
| `--force` | 无条件覆盖远端分支 | 同事刚推的新提交会被直接删掉 |
| `--force-with-lease` | 远端当前值等于本地 remote-tracking 值时才覆盖 | 远端变了就拒绝推送，可以先 fetch 再看 |

### 选择策略

| 场景 | 用哪个 | 理由 |
|---|---|---|
| **个人 feature 分支同步 main 的更新** | **rebase** | 保持自己的提交线性，PR 里只看到自己的改动 |
| **把 feature 合进 main** | **merge**（或 squash merge） | main 是公共分支，历史不能重写 |
| **紧急 hotfix 合回 main** | merge | 同上 |
| **本地整理提交（合并、改 message、删提交）** | `rebase -i` | 只有本地，随便改 |
| **想保留「这个功能是一个整体」的信息** | `merge --no-ff` | 能看出功能的边界 |
| **团队要求线性历史** | rebase + 快进合并 | 代价是每次都要处理冲突 |

两种主流团队约定：

```
约定 A（feature 上 rebase，main 上 merge）
  git checkout feature && git rebase main
  提 PR，main 上点 merge          → PR 干净，main 保留功能边界

约定 B（全线 rebase，线性历史）
  git checkout feature && git rebase main
  main 上 ff-only 合并            → 历史一条线，但失去功能边界
```

默认选 A：回滚一个功能只需 revert 那个 merge commit；约定 B 要逐个找该功能的提交。

### 追问：分支与合并

| 追问 | 答法 |
|---|---|
| rebase 时多个提交怎么处理？ | 逐个重放。第 2 个提交冲突了，解决后 `--continue`，再重放第 3 个，所以**一次 rebase 可能冲突多次** |
| rebase 会不会丢代码？ | 内容相同、只换父提交，通常不丢。但某个提交变成空提交（改动已被目标分支包含）时会被跳过，可用 `--empty=keep` 保留 |
| `merge --no-ff` 和普通 merge 区别？ | 目标分支没有新提交时普通 merge 是快进，不产生 merge commit；`--no-ff` 强制执行 merge commit，保留功能边界 |
| `git pull` 默认是什么？ | 取决于 `pull.rebase`，默认 merge。建议 `git config --global pull.rebase true`，否则每次 pull 都会留下无意义的 merge commit |
| `git pull --rebase` 和 `git rebase origin/main` 一样吗？ | 本质一样，前者 = fetch + rebase |
| 为什么我的 PR 里出现了一堆别人的提交？ | 分支从旧 main 切出且没 rebase；rebase main 后只剩自己的 |
| squash merge 是什么？ | 把整个 PR 的提交压成一个合进 main；main 干净，但丢失开发过程的提交信息 |
| 怎么撤销一次 merge？ | 未推送：`git reset --hard HEAD~1`。已推送：`git revert -m 1 <merge-commit>`，`-m 1` 指定保留哪个父 |

---

## 8.3 rebase 冲突怎么解决

### 冲突时 `<<<<<<< HEAD` 指向谁

```
line1
<<<<<<< HEAD
MAIN
=======
FEATURE
>>>>>>> <正在重放的那个提交>
line3
```

**`HEAD` 指向 target（你 rebase 到的分支），不是你的分支。**

| 场景 | `<<<<<<< HEAD` 是 | `>>>>>>>` 是 |
|---|---|---|
| **merge 冲突** | 你当前所在的分支 | 被合并进来的分支 |
| **rebase 冲突** | **target（你 rebase 到的分支）** | **正在重放的那个提交** |

机制：rebase 先切到 target 的最新提交，再逐个把你的提交应用上去，所以任何时刻 `HEAD` 都是 target。

> 口诀：**merge 时 HEAD 是我，rebase 时 HEAD 是对方。**

### 冲突现场

```
$ git status
interactive rebase in progress; onto <target>
You are currently rebasing branch 'feat' on '<target>'.
  (fix conflicts and then run "git rebase --continue")
  (use "git rebase --skip" to skip this patch)
  (use "git rebase --abort" to check out the original branch)

Unmerged paths:
	both modified:   f.txt
```

`.git/rebase-merge/` 保存进行中的状态，其中：

- `git-rebase-todo`：还剩哪些提交要重放（`rebase -i` 编辑的就是它）
- `head-name`：原分支，`--abort` 靠它恢复

### 完整流程

```bash
# ① 触发 rebase
git checkout feature
git rebase main
# → 冲突，中断

# ② 看是哪个文件冲突
git status

# ③ 打开冲突文件，删掉 <<<<<<< / ======= / >>>>>>> 标记，留下想要的内容
#    ★ HEAD 是 main，不是你的分支

# ④ 标记为已解决（不是 git commit）
git add <冲突文件>

# ⑤ 继续重放下一个提交（会打开编辑器确认 message）
git rebase --continue
# 不想编辑 message：
GIT_EDITOR=true git rebase --continue

# ⑥ 如果还有冲突，重复 ③~⑤
# ⑦ 完成后推送
git push --force-with-lease
```

### 三个逃生命令

| 命令 | 作用 | 什么时候用 |
|---|---|---|
| `git rebase --continue` | 继续重放下一个提交 | 冲突已解决 |
| `git rebase --skip` | **丢弃当前这个提交**，继续下一个 | 这个提交的改动已经不需要了（比如已被别人合入） |
| `git rebase --abort` | **完全放弃**，回到 rebase 之前的状态 | 搞乱了 / 冲突太多不想弄了 |

`--abort` 是安全的：它按 `head-name` 恢复到 `git rebase` 执行之前的状态，任何情况下都能重来。

### 解决冲突后继续

选「两边都要」后：

```bash
printf 'line1\nBOTH\nline3\n' > f.txt
git add f.txt
GIT_EDITOR=true git rebase --continue
```

```
 1 file changed, 1 insertion(+), 1 deletion(-)
Successfully rebased and updated refs/heads/feat.
```

`GIT_EDITOR=true` 用 `true` 命令当编辑器（什么都不做、直接成功退出），保留原 message；脚本/CI 里不加会卡在编辑器。

### 减少冲突的三个实践

| 实践 | 效果 |
|---|---|
| **小步提交 + 频繁 rebase** | 一次只处理 1-2 个提交的冲突，比积攒 20 个再 rebase 轻松 |
| **`git rerere`** | 记录解决过的冲突，下次遇到同样的两边内容自动套用。`git config --global rerere.enabled true` |
| **拆分文件** | 冲突本质是两个人改同一块，大文件、巨型组件是重灾区 |

`rerere` = **re**use **re**corded **re**solution，最适合长期维护 feature 分支、反复 rebase main 的场景——同一个冲突要解十几次，它能全部自动处理。

---

## 8.4 Git 常用命令

按使用场景分组：

### 分组速查

#### ① 日常提交

```bash
git status                    # 看当前状态
git diff                      # 看未暂存的改动
git diff --staged             # 看已暂存的改动
git add -p                    # 交互式选择要提交的片段
git commit -m "msg"
git commit --amend            # 修改上一条提交（message 或内容）
git commit --amend --no-edit  # 只改内容不改 message
```

`git add -p` 逐个 hunk 决定是否包含，能把顺手改的 typo、调试用的 `console.log` 排除在外，做出语义完整的小提交。

#### ② 分支操作

```bash
git branch                    # 列本地分支
git branch -a                 # 含远程
git branch -d feat            # 删除（已合并的）
git branch -D feat            # 强制删除（未合并的）
git checkout -b feat          # 新建并切换（老写法）
git switch -c feat            # 新建并切换（新写法）
git switch main               # 切分支
```

`checkout` 同时负责切分支和恢复文件（`git checkout main` vs `git checkout main -- file`），容易被搞错，所以拆成语义更明确的 `switch` 和 `restore`。

#### ③ 查看历史

```bash
git log --oneline --graph --all --decorate    # 一条命令看全部分叉
git log -p -2                                 # 看最近 2 次提交的 diff
git log --author="xxx"
git log --grep="fix"                          # 按 message 搜
git log -S "functionName"                     # 搜「哪个提交增删了这个字符串」
git blame file                                # 每一行最后是谁改的
git show <commit>                             # 看某个提交的完整改动
```

`git log -S`（pickaxe）直接列出所有「新增或删除了这个字符串」的提交，排查「这行代码谁加的、什么时候删的」比逐版本 grep 快。

#### ④ 撤销：最容易混的一组

| 想要什么 | 命令 | 影响提交历史 | 影响工作区 |
|---|---|---|---|
| 撤销**工作区**改动（还没 add） | `git restore file` | 否 | ✅ 丢弃 |
| 撤销**暂存**（add 了但不想提交） | `git restore --staged file` | 否 | 否（改动还在） |
| 撤销**最近一次提交**，改动留在暂存区 | `git reset --soft HEAD~1` | ✅ 删提交 | 否 |
| 撤销**最近一次提交**，改动取消暂存 | `git reset HEAD~1`（= `--mixed`） | ✅ 删提交 | 否（改动还在，未暂存） |
| 撤销**最近一次提交**，改动全丢 | `git reset --hard HEAD~1` | ✅ 删提交 | ✅ **丢弃** |
| **安全地**撤销一次已推送的提交 | `git revert <commit>` | ✅ **新增一个反向提交** | 否 |

### reset 三种模式

初始 3 个提交，工作区 `a.txt` 为 `3`：

| 命令 | HEAD | 暂存区 | 工作区 |
|---|---|---|---|
| `--soft HEAD~1` | 移到 c2 | 保留 c3 的改动（`M  a.txt`） | 不动（`3`） |
| `--mixed HEAD~1`（默认） | 移到 c2 | 清空（` M a.txt`） | 不动（`3`） |
| `--hard HEAD~1` | 移到 c2 | 清空 | 回到 c2 的内容（`2`），status 干净 |

三个参数只有后两列不同：

```
                    HEAD    Index(暂存区)    Worktree(工作区)
reset --soft        移动     不动              不动
reset --mixed       移动     重置              不动
reset --hard        移动     重置              重置   ← 唯一会丢代码的
```

用途：`--soft` 适合「提交早了想补内容再提交」；`--mixed` 适合「重新组织这次提交」；`--hard` 执行前确认改动真的不要了。

### reset 之后怎么找回

**用 `reflog`。**

```
$ git reflog --format="%h %gs" | head -4
b46b63d reset: moving to HEAD~1
37bcc3b commit: c3          ← 被 reset 掉的提交还在
b46b63d commit: c2
4969f52 commit (initial): c1
```

`git reflog` 记录 HEAD 的每次移动（reset、rebase、checkout、merge），默认保留 90 天（`gc.reflogExpire`）；reflog 过期后再经 `gc` 才会真正清理。

```bash
git reflog                          # 找到丢失提交的 hash
git reset --hard 37bcc3b            # 或 git cherry-pick 37bcc3b
```

所以「误删分支」「reset 错了」基本都能救回，除非手动执行过 `git reflog expire --expire=now --all` + `git gc --prune=now`。

### `revert` 和 `reset` 的区别

**`reset` 删掉历史，`revert` 新增一个反向提交。**

```
$ git revert HEAD
1 file changed, 1 deletion(-)
历史：Revert "c3"  c3  c2  c1
```

历史里多了 `Revert "c3"`，原来的 `c3` 还在，别人拉代码不会出现历史不一致——这就是「安全」的含义。

#### revert 中间提交会冲突

`revert` 非最新提交（`c2`，它后面还有 `c3`）时：

```
<<<<<<< HEAD
b
c
=======
>>>>>>> parent of <c2>
```

因为 `revert` 是把那个提交的 patch **反向**应用，而 `c3` 已经改了同一块，反向 patch 套不上去。所以回滚尽量回滚最新提交，或用 `revert` 多个提交。

### `cherry-pick`

把另一个分支上的某个提交摘过来：

```
原始：
* C: add h          ← 想摘这个
* B: add g
| * D: add i
|/
* A: init

执行 git cherry-pick C 后：
* C': add h         ← hash 变了
* D: add i
* A: init
```

和 rebase 一样：**父提交不同 → hash 不同**。区别是 rebase 批量重放一串，cherry-pick 只挑一个（或几个）。

用途：把 hotfix 从 release 分支摘到 main；从同事分支摘一个提交而不合整个分支。

### `rebase -i` 合并提交

本地 4 个凌乱提交（最新在上）：

```
再改一下
fix typo
wip
feat: 第一步
```

`git rebase -i HEAD~3`，把 `wip`、`fix typo`、`再改一下` 标成 `squash`：提交数变成 2，改动全部保留。

| 动作 | 作用 |
|---|---|
| `pick` | 保留这个提交（默认） |
| `squash` | **合并到上一个提交**，message 也合并 |
| `fixup` | 合并到上一个提交，**丢弃这个的 message** |
| `reword` | 只改 message |
| `edit` | 停下来让你改内容 |
| `drop` | 删掉这个提交 |

`squash` 会打开编辑器让你编辑合并后的 message，`fixup` 直接用前一条的 message。「wip」「fix typo」这类提交用 `fixup` 更干净。

### `stash`

| 命令 | 作用 |
|---|---|
| `git stash` | 存起来（默认只存已跟踪文件的改动） |
| `git stash -u` | **连未跟踪的新文件一起存**（不加 `-u` 新文件不会被存） |
| `git stash -a` | 连 `.gitignore` 忽略的文件也存 |
| `git stash list` | 看列表 |
| `git stash pop` | 恢复并**删除**这条 stash |
| `git stash apply` | 恢复但**保留**这条 stash |
| `git stash drop` | 删掉某条 |
| `git stash branch xxx` | 从 stash 建新分支 |

两个容易踩的点：

- 新建但没 add 的文件不在 stash 里，stash 完它还在原地，要加 `-u`
- `pop` / `apply` **默认不恢复暂存状态**：staged 的修改恢复后变成未暂存（` M f`），要原样恢复得加 `--index`

### 追问链

| 追问 | 答法 |
|---|---|
| `git restore` 和 `git checkout --` 关系？ | 前者是后者的语义化替代，`git checkout -- file` 属于老写法 |
| `git reset` 和 `git restore` 都能撤销，怎么选？ | `restore` 只动文件不动历史；`reset` **动 HEAD**（删提交） |
| `reset --hard` 后还能恢复吗？ | 能，`git reflog` 找到 hash 再 reset，只要没被 GC |
| `commit --amend` 之后能推吗？ | 已 push 过就必须 `--force-with-lease`，因为 amend 产生了新 hash |
| 怎么找「哪次提交删了这个文件」？ | `git log --diff-filter=D --summary -- <path>` |
| 怎么只提交某个文件的部分改动？ | `git add -p` |
| 怎么把一个文件恢复到某个历史版本？ | `git restore --source=<commit> -- file` |
| `git blame` 看到的是「最后修改」还是「引入」？ | 最后修改。要看引入用 `git log -S` 或 `git log -L` |
| `git log -L` 是什么？ | 追踪某个函数/代码块的历史：`git log -L :functionName:file.js`，排查「这段逻辑为什么是这样」的终极工具 |

---

## 8.5 分支模型（面试常连着问）

| 模型 | 分支 | 适合 |
|---|---|---|
| **Git Flow** | `main` + `develop` + `feature/*` + `release/*` + `hotfix/*` | 有明确版本节奏、需并行维护多个版本（客户端、SDK） |
| **GitHub Flow** | `main` + `feature/*`，PR 合并即发布 | **Web 应用的主流** |
| **Trunk Based** | 只有 `main`，靠 feature flag 控制上线 | 高频发布的团队（Google、Facebook） |

- Web 应用只有一个线上版本、随时可以发，`develop`、`release` 是纯负担——多一层合并就多一层冲突。
- Trunk Based 的关键是 feature flag：代码可以随时合入 main，用开关控制「用户能不能看到」，避免长期分支；代价是代码里积累 `if (flag)`，需要定期清理已上线的 flag。

---

## 8.6 面试怎么说（2 分钟版）

- **本质**：merge 生成一个新提交，原提交 hash 不变，历史保留分叉；rebase 把每个提交的变更重新应用一遍，产生一批全新提交，历史线性。
- **hash 为什么变**：commit hash 包含父提交的 hash，父提交从 A 变成 E，hash 必变。所以「rebase 是搬提交」是错的。
- **黄金法则**：不能 rebase 公共分支。别人本地仍指向旧提交，merge 会让同一份改动在历史里出现两遍，rebase 会产生大量冲突。
- **选择**：个人分支同步 main 用 rebase（PR 里只有自己的改动），合进 main 用 merge（公共历史不能重写）。
- **冲突细节**：rebase 时 `<<<<<<< HEAD` 是 target 分支，merge 时是自己；口诀「merge 是我，rebase 是对方」。可选加分项：`rerere.enabled=true` 记住解决过的冲突。

---

## 8.7 速记卡

```
【本质】
merge：新增 merge commit，原 hash 不变，保留分叉
rebase：重放变更生成新提交，hash 全变，历史线性
        hash = 树 + 父 hash + 作者/时间 + message → 父变则变

【黄金法则】不 rebase 已推送的公共分支
个人分支 rebase 后推 → --force-with-lease（不是 --force）

【选择】个人分支同步 main → rebase；合进 main → merge / squash merge
本地整理 → rebase -i；pull.rebase true

【冲突】<<<<<<< HEAD = target；>>>>>>> = 正在重放的提交
merge 时相反 → merge 是我，rebase 是对方
流程：status → 改文件 → add（不是 commit）→ rebase --continue
逃生：--skip（丢当前提交）/ --abort（完全放弃）
GIT_EDITOR=true 避免卡在编辑器

【reset】          HEAD  Index  Worktree
--soft             移     不动    不动
--mixed（默认）     移     重置    不动
--hard             移     重置    重置  ← 唯一丢代码
reset 删历史（未推送）｜revert 反向提交（已推送）
revert 中间提交易冲突
reflog 记录 HEAD 每次移动，能救回 reset --hard

【cherry-pick】摘单个提交，父不同 → 新 hash（与 rebase 同理）
【rebase -i】pick / squash（编辑 message）/ fixup（丢弃 message）
             reword / edit / drop
【stash】默认不存未跟踪文件 → -u；pop 删、apply 留
        默认不恢复暂存状态 → --index
【分支模型】Git Flow 版本节奏｜GitHub Flow Web｜Trunk Based + flag
```

---

## 8.8 自测

```
□ merge 和 rebase 对提交做了什么（一个新提交 vs 一批新提交）
□ commit hash 由什么决定，rebase 后为什么全变
□ 「不能 rebase 公共分支」的两个具体后果
□ --force 和 --force-with-lease 的区别
□ 个人分支和 main 各该用什么，理由是什么
□ merge / rebase 冲突时 <<<<<<< HEAD 各是谁
□ rebase 冲突的完整流程（add 不是 commit）
□ --skip / --abort 各自的作用
□ rerere 是什么、什么场景最有用
□ reset 三兄弟对 HEAD / Index / Worktree 的影响
□ reset 和 revert 的本质区别与适用场景
□ revert 中间提交为什么冲突
□ reflog 能救回什么
□ cherry-pick 和 rebase 的共同点
□ squash 和 fixup 的区别
□ git stash 默认不存什么、要加什么参数
□ Git Flow 为什么不适合 Web 应用
```
