# 工程化 08｜Git 工作流

> 覆盖题号：6（merge vs rebase）、8（如何选择）、7（rebase 冲突）、34（常见 rebase 冲突）、9（常用命令）
> 去重后：**3 个考点**（8→6、34→7，都是纯重复）

---

## 8.1 题单答案的问题

> **6.** merge：保留分叉历史，生成 merge commit。rebase：把提交"搬"到目标分支顶端，历史线性。推荐：公共分支用 merge，个人分支用 rebase。
>
> **7.** 解决冲突后 `git add`，然后 `git rebase --continue`，放弃用 `--abort`。

**这两条都是「结论正确但缺少为什么」**：

1. 「把提交**搬**到目标分支顶端」——**「搬」这个字是错的**。rebase 不是搬，是**重新创建**。这个区别决定了「为什么不能 rebase 公共分支」
2. 没说 rebase 冲突时 `HEAD` 指向谁（这跟 merge 完全相反，是最大的坑）
3. 常用命令只列了 12 个名字，没有任何场景

---

## 8.2 merge vs rebase

### 一句话结论

> **merge 保留分叉，rebase 抹平分叉。**
>
> 但更准确的说法是：**merge 生成一个新提交，rebase 重写你的提交。**

### 实测：同一个分叉，两种处理

初始状态（我建的真实仓库）：

```
* 2d3e657 (feature) C: feature 2
* e64fdec B: feature 1
| * 24a4394 (HEAD -> main) E: main 2
| * d31174f D: main 1
|/
* c380f79 A: base
```

`merge-base` = `c380f79`（共同祖先）

#### 方案 A：`git merge --no-ff feature`

```
*   14045c8 merge feature into main      ← 新增的 merge commit
|\
| * 2d3e657 C: feature 2
| * e64fdec B: feature 1
* | 24a4394 E: main 2
* | d31174f D: main 1
|/
* c380f79 A: base
```

**结果**：

- commit 数量：**6 个**（原来 5 个 + 1 个 merge commit）
- 历史有分叉
- **B、C 的 hash 不变**（`e64fdec`、`2d3e657`）

#### 方案 B：`git rebase main`（在 feature 分支上）

```
* 81c9f59 (HEAD -> feature) C: feature 2
* 4d4a95c B: feature 1
* 0223a44 (main) E: main 2
* d7d1fa1 D: main 1
* 742846f A: base
```

**结果**：

- commit 数量：**5 个**（没有 merge commit）
- 历史完全线性
- **B、C 的 hash 变了**：`e64fdec → 4d4a95c`、`2d3e657 → 81c9f59`

### ⚠️ 最关键的一点：hash 为什么变了

这是这道题的**分水岭**。90% 的人只会说「rebase 让历史变线性」，但说不清 hash 为什么变。

**Git 的 commit 是一个对象，它的 hash 由两部分算出**：

```
commit hash = SHA1(
  树的 hash（这次提交的文件快照）
  + 父提交的 hash          ← 关键！
  + 作者/提交者
  + 时间戳
  + commit message
)
```

**父提交变了，hash 一定变。**

- `B` 原来的父是 `A`（`c380f79`）
- rebase 之后 `B'` 的父变成了 `E`（`0223a44`）
- 所以 `B'` 是一个**全新的 commit 对象**，只是内容相同

> **所以「rebase 是把提交搬到新位置」这个说法是错的。准确说法是：**
> **「rebase 是把每个提交的『变更』重新应用一遍，产生一批全新的提交。」**
>
> 原来的 `B`、`C` 并没有被移动，它们**还在仓库里**（reflog 能找到），只是没有分支指向它们了。

### 这个事实推出「rebase 的黄金法则」

> **永远不要 rebase 已经推送到公共分支的提交。**

**为什么**？举个例子：

```
① 你 rebase 了 feature 分支，B、C 变成了 B'、C'
② 但 B、C 已经被推送到远端了
③ 同事小王的本地分支还指向 B、C
④ 他下次 pull 时：
   - merge：会把 B、C 和 B'、C' 都合进来 → 同一份改动出现两次
   - rebase：Git 会认为「你的和有我的不同」，产生大量莫名其妙的冲突
⑤ 结果是「同一段代码在历史里存在两遍」，而且冲突解决起来极其痛苦
```

**判断标准**：

| 情况 | 能不能 rebase |
|---|---|
| 只有你本地有这些提交（没 push） | ✅ 随便 rebase |
| 已经 push 但只有你一个人用这个分支 | 🟡 可以，但要 `--force-with-lease` |
| **已 push 且别人也基于它开发** | ❌ **绝对不行** |
| **main / develop 等公共分支** | ❌ **绝对不行** |

### `--force` 和 `--force-with-lease` 的区别（必问）

rebase 之后推送必须强制，因为远端有「你本地没有的」提交（原来的 B、C）。

```bash
git push --force                 # ❌ 危险
git push --force-with-lease      # ✅ 安全
```

| 参数 | 行为 | 风险 |
|---|---|---|
| `--force` | **无条件覆盖**远端分支 | 如果同事刚推了新提交，**会被你直接删掉** |
| `--force-with-lease` | 只有当「远端的提交和我上次看到的一样」时才覆盖 | 如果远端变了，**推送被拒绝**，你能先拉下来看看 |

> **`--force-with-lease` 是保命的**。它检查的是「远端分支的当前值是否等于我本地记录的 remote-tracking 值」——如果同事推了东西，你本地的 `origin/feature` 还是旧的，检查就会失败，从而保护了同事的提交。

### 选择策略（答案）

| 场景 | 用哪个 | 理由 |
|---|---|---|
| **个人 feature 分支同步 main 的更新** | **rebase** | 保持自己的提交线性，PR 里只看到自己的改动 |
| **把 feature 合进 main** | **merge**（或 squash merge） | main 是公共分支，历史不能重写 |
| **紧急 hotfix 合回 main** | merge | 同上 |
| **本地整理提交（合并、改 message、删提交）** | `rebase -i` | 只有本地，随便改 |
| **想保留「这个功能是一个整体」的信息** | `merge --no-ff` | 能看出功能的边界 |
| **团队要求线性历史** | rebase + merge（快进） | 代价是每次都要处理冲突 |

**两种主流团队约定**：

```
约定 A（feature 分支用 rebase，main 用 merge）
  ① git checkout feature
  ② git rebase main          ← 把自己的提交挪到 main 最新之上
  ③ 提 PR，main 上点 merge    ← main 保留一个 merge commit
  → PR 里只有自己的改动，干净；main 上有功能边界

约定 B（全线 rebase，线性历史）
  ① git checkout feature
  ② git rebase main
  ③ main 上快进合并（ff-only）
  → 历史一条线，`git log` 很好看
  → 代价：每次合并前都要解决冲突，且没有「功能边界」
```

> **我推荐约定 A**。原因：
> 「约定 B 的线性历史看起来很美，但**失去了『这个功能包含哪些提交』的信息**。出问题时想 revert 一个功能，约定 A 只要 revert 那个 merge commit，约定 B 要一个个找。**历史首先是给人看的，好看是次要的。**」

### 追问链

| 追问 | 答法 |
|---|---|
| rebase 时多个提交怎么处理？ | Git 会**逐个重放**。第 2 个提交冲突了，解决后 `--continue`，继续重放第 3 个。所以**一个 rebase 可能冲突好几次** |
| rebase 会不会丢代码？ | 一般不会（同内容变了父）。但**如果某个提交变成空提交**（改动已经被目标分支包含了），rebase 会**跳过它**。这时要加 `--empty=keep` 保留 |
| `merge --no-ff` 和普通 merge 区别？ | 如果 main 没有新提交，普通 merge 是**快进**（fast-forward，不产生 merge commit）；`--no-ff` **强制**产生 merge commit，保留功能边界 |
| `git pull` 默认是什么？ | 取决于配置。默认可能是 `merge`。**强烈建议改成 rebase**：`git config --global pull.rebase true`，否则每次 pull 都会产生一堆无意义的 merge commit |
| `git pull --rebase` 和 `git rebase origin/main` 一样吗？ | 本质一样。前者 = fetch + rebase |
| 为什么我的 PR 里出现了一堆别人的提交？ | 因为你的分支是从旧的 main 切出来的，且没 rebase。**rebase main 之后就只剩自己的了** |
| squash merge 是什么？ | 把整个 PR 的所有提交**压成一个**合进 main。优点是 main 干净；**缺点是完全丢失了开发过程的提交信息**。适合「一个 PR 就是一个功能」的团队 |
| 怎么撤销一次 merge？ | 未推送：`git reset --hard HEAD~1`。已推送：`git revert -m 1 <merge-commit>`。**注意 `-m 1` 指定保留哪个父** |

---

## 8.3 rebase 冲突怎么解决

### 题单答案的问题

> 「解决冲突后 `git add`，然后 `git rebase --continue`，放弃用 `--abort`。」

**流程对了，但漏掉了最关键的认知**：**rebase 冲突时 `HEAD` 指向谁。**

### ⚠️ 最重要的一个坑：`<<<<<<< HEAD` 是谁

我制造了一个真实的 rebase 冲突。冲突标记：

```
line1
<<<<<<< HEAD
MAIN
=======
FEATURE
>>>>>>> 07a0edf (B: 改成 FEATURE)
line3
```

**`HEAD` 指向的是 `main`（目标分支），不是你的分支 `feat`！**

对比一下：

| 场景 | `<<<<<<< HEAD` 是 | `>>>>>>>` 是 |
|---|---|---|
| **merge 冲突** | **你当前所在的分支** | 被合并进来的分支 |
| **rebase 冲突** | **target（你 rebase 到的分支）** | **你正在重放的那个提交** |

> **为什么**？因为 rebase 的机制是「**先切到 target 分支的最新提交，然后逐个把你的提交应用上去**」。所以任何时刻 `HEAD` 都是 target。
>
> **这个反直觉点是最容易出错的地方**：习惯 merge 的人会本能地认为 `HEAD` 是自己的代码，然后选错了。

**记忆口诀**：

> **merge：HEAD 是我。rebase：HEAD 是对方。**

### 冲突时的完整现场

实测 `git status`：

```
interactive rebase in progress; onto bcde06a
You are currently rebasing branch 'feat' on 'bcde06a'.
  (fix conflicts and then run "git rebase --continue")
  (use "git rebase --skip" to skip this patch)
  (use "git rebase --abort" to check out the original branch)

Unmerged paths:
  (use "git add <file>..." to mark resolution)
	both modified:   f.txt
```

**三个关键信息**：

1. `rebase in progress; onto bcde06a` —— 正在 rebase 到 `bcde06a`
2. `both modified` —— 双方都改了
3. 提示的三个命令：`--continue` / `--skip` / `--abort`

还有 `.git/rebase-merge/` 目录（rebase 进行中的状态）：

```
author-script
done
drop_redundant_commits
end
git-rebase-todo        ← 还剩哪些提交要重放
git-rebase-todo.backup
head-name
```

**`git-rebase-todo` 就是「待办清单」**——能看到还剩几个提交没重放。`rebase -i` 编辑的就是这个文件。

### 完整流程

```bash
# ① 触发 rebase
git checkout feature
git rebase main
# → 冲突，中断

# ② 看是哪个文件冲突
git status

# ③ 打开冲突文件，解决冲突
#    删掉 <<<<<<< / ======= / >>>>>>> 标记，留下想要的内容
#    ★ 注意：HEAD 是 main，不是你的分支

# ④ 标记为已解决（不是 git commit！）
git add <冲突文件>

# ⑤ 继续重放下一个提交
git rebase --continue
#    ★ 会打开编辑器让你确认 commit message
#    想跳过编辑：GIT_EDITOR=true git rebase --continue

# ⑥ 如果还有冲突，重复 ③~⑤

# ⑦ 完成后推送
git push --force-with-lease
```

### 三个逃生命令

| 命令 | 作用 | 什么时候用 |
|---|---|---|
| `git rebase --continue` | 继续重放下一个提交 | 冲突已解决 |
| `git rebase --skip` | **丢弃当前这个提交**，继续下一个 | 这个提交的改动已经不需要了（比如已经被别人合进去了） |
| `git rebase --abort` | **完全放弃**，回到 rebase 之前的状态 | 搞乱了 / 冲突太多不想弄了 |

> **`--abort` 是安全的**——它会把你恢复到 `git rebase` 执行之前的状态（`head-name` 文件里记录着原分支）。所以**任何情况下都不要慌，`--abort` 总能重来。**

### 实测：解决完继续

我选了「两边都要」：

```bash
printf 'line1\nBOTH\nline3\n' > f.txt
git add f.txt
GIT_EDITOR=true git rebase --continue
```

输出：

```
 1 file changed, 1 insertion(+), 1 deletion(-)
Successfully rebased and updated refs/heads/feat.
```

最终历史：

```
* 19789b7 B: 改成 FEATURE
* bcde06a C: 改成 MAIN
* d0f062e A
```

**线性，没有分叉。**

> 注意 `GIT_EDITOR=true` 这个技巧：`--continue` 会打开编辑器让你改 commit message，在脚本/CI 里会卡住。`GIT_EDITOR=true` 表示「用 `true` 命令当编辑器」（它什么都不做，直接成功退出），于是保留原 message。

### 减少冲突的三个实践

| 实践 | 效果 |
|---|---|
| **小步提交 + 频繁 rebase** | 一次 rebase 只处理 1-2 个提交的冲突，比积攒 20 个提交再 rebase 轻松得多 |
| **`git rerere`** | 记住你解决过的冲突，下次遇到**同样的冲突自动解决**。`git config --global rerere.enabled true` |
| **拆分文件** | 冲突的本质是「两个人改了同一块」。**大文件、巨型组件是冲突的重灾区**。拆分本身就是一种工程化改进 |

**`rerere` 值得展开**（这题的高分点）：

> 「`rerere` 是 **re**use **re**corded **re**solution 的缩写。开启后，Git 会记录『这个冲突我是怎么解的』，下次遇到**完全相同的冲突**（同样的两边内容）自动套用。
>
> 最适合的场景是：**你长期维护一个 feature 分支，反复 rebase main**。同一个冲突你可能要解十几次，`rerere` 能全部自动处理。」

---

## 8.4 Git 常用命令

题单只列了 12 个名字。这里按「你会遇到什么问题」重新组织。

### 分组速查

#### ① 日常提交

```bash
git status                    # 看当前状态（最常用，养成习惯）
git diff                      # 看未暂存的改动
git diff --staged             # 看已暂存的改动
git add -p                    # ★ 交互式选择要提交的片段（强烈推荐）
git commit -m "msg"
git commit --amend            # 修改上一条提交（message 或内容）
git commit --amend --no-edit  # 只改内容不改 message
```

> **`git add -p` 是被严重低估的命令**。它让你逐个 hunk 决定「这次提交要不要包含这块」，从而做出**语义完整的小提交**。写代码时顺手改了个 typo、加了个 console.log，都可以在 `add -p` 时排除掉。

#### ② 分支操作

```bash
git branch                    # 列本地分支
git branch -a                 # 含远程
git branch -d feat            # 删除（已合并的）
git branch -D feat            # 强制删除（未合并的）
git checkout -b feat          # 新建并切换（老写法）
git switch -c feat            # 新建并切换（新写法，语义更清晰）
git switch main               # 切分支（新写法）
```

> **`checkout` 被拆成了 `switch`（切分支）和 `restore`（恢复文件）**。因为 `checkout` 一件事干两件事，很容易搞错（`git checkout main` 是切分支，`git checkout main -- file` 是恢复文件）。

#### ③ 查看历史

```bash
git log --oneline --graph --all --decorate    # ★ 最有用的一条
git log -p -2                                 # 看最近 2 次提交的 diff
git log --author="xxx"
git log --grep="fix"                          # 按 message 搜
git log -S "functionName"                     # ★ 搜「哪个提交引入了这个字符串」
git blame file                                # 每一行是谁改的
git show <commit>                             # 看某个提交的完整改动
```

> **`git log -S`（pickaxe）是排查问题的神器**：
> 「想找『这个方法是什么时候被删掉的』，`grep` 历史版本很痛苦。`git log -S "methodName"` 直接列出所有『新增或删除了这个字符串』的提交。**排查『这行代码谁加的、为什么加』时，比 blame 更进一步。**」

#### ④ 撤销：最容易混的一组

这是面试最爱问的。**先记住这张表**：

| 想要什么 | 命令 | 影响提交历史 | 影响工作区 |
|---|---|---|---|
| 撤销**工作区**改动（还没 add） | `git restore file` | 否 | ✅ 丢弃 |
| 撤销**暂存**（add 了但不想提交） | `git restore --staged file` | 否 | 否（改动还在） |
| 撤销**最近一次提交**，改动留在工作区 | `git reset --soft HEAD~1` | ✅ 删提交 | 否 |
| 撤销**最近一次提交**，改动取消暂存 | `git reset HEAD~1`（= `--mixed`） | ✅ 删提交 | 否（改动还在，未暂存） |
| 撤销**最近一次提交**，改动全丢 | `git reset --hard HEAD~1` | ✅ 删提交 | ✅ **丢弃** |
| **安全地**撤销一次已推送的提交 | `git revert <commit>` | ✅ **新增一个反向提交** | 否 |

### 实测：reset 三兄弟

初始：3 个 commit，工作区 `a.txt` 内容为 `3`。

#### `reset --soft HEAD~1`

```
commits = 2        暂存区 = [a.txt]        工作区 a.txt = 3
```

**提交没了，但改动**（`a.txt` = 3）**还在暂存区**。

> 用途：**「我刚才提交早了，想再加点东西重新提交」**。`--soft` 之后改动都在暂存区，直接 `git commit --amend` 或继续 `add` 就行。

#### `reset --mixed HEAD~1`（默认）

```
commits = 1        暂存区 = []        工作区 a.txt = 3        status: " M a.txt"
```

**提交没了，暂存区也清空了，但工作区文件还是新的**。

> 用途：**「我想重新组织这次提交的内容」**。改动都还在，但要重新 `add`。

#### `reset --hard HEAD~1`

```
commits = 1        工作区 a.txt = 1        status: 空
```

**提交没了，工作区文件也回到旧内容（`1`）。**

> ⚠️ **这是唯一会丢代码的**。执行前确认真的不要了。

**三个参数的本质**（这张图记住就不会混）：

```
                    HEAD    Index(暂存区)    Worktree(工作区)
reset --soft        移动     不动              不动
reset --mixed       移动     重置              不动
reset --hard        移动     重置              重置
                    ↑        ↑                 ↑
                 三者都移动 HEAD，区别在后面两列
```

### 实测：`reset` 之后还能救回来吗

**能。用 `reflog`。**

```
$ git reflog --format="%h %gs" | head -5
6f9b6e5 reset: moving to HEAD
6f9b6e5 reset: moving to HEAD~0
6f9b6e5 reset: moving to HEAD~1
1338518 reset: moving to HEAD~1
70e436b commit: c3          ← 被 reset 掉的那个提交还在！
```

**`git reflog` 记录了 HEAD 的每一次移动**，包括 reset、rebase、checkout、merge。默认保留 90 天。

**救人步骤**：

```bash
git reflog                          # 找到丢失提交的 hash
git reset --hard 70e436b            # 或者 git cherry-pick 70e436b
```

> **这是 Git 最重要的一条「后悔药」**：
> 「`reset --hard` 删掉的提交，只要没被 GC（默认 30 天后才可能被清理），`reflog` 都能找回来。**所以『误删分支』『reset 错了』基本都不是灾难**，除非你连 reflog 都清了（`git reflog expire --expire=now --all` + `gc --prune=now`）。」

### 实测：`revert` 和 `reset` 的本质区别

**`reset` 是「删掉历史」，`revert` 是「新增一个反向提交」。**

实测 `revert HEAD`（撤销最新提交）：

```
1 file changed, 1 deletion(-)
f 内容: a b
历史: 4e0f813 Revert "c3"  c253c80 c3  694a807 c2  31b7da7 c1
```

**注意历史里多了 `Revert "c3"`**，原来的 `c3` 还在。**这就是「安全」的含义**——别人拉代码不会出现「历史不一致」。

#### ⚠️ 实测：revert 中间提交会冲突

我试着 `revert` 一个**非最新**的提交（`c2`，它后面还有 `c3`），结果冲突了：

```
<<<<<<< HEAD
b
c
=======
>>>>>>> parent of 694a807 (c2)
```

**为什么**？因为 `revert` 是「把那个提交的 patch **反向**应用」。但 `c3` 已经改了同一块内容，反向 patch 套不上去。

> **这个细节很实用**：
> 「`revert` 一个**最新提交**通常很干净，因为改动在末尾。但 `revert` 一个**中间提交**经常会冲突，因为它后面的提交已经动了同一块代码。所以**回滚要尽量回滚最新的，或者用 `revert` 多个提交**。」

### 实测：`cherry-pick`

把一个分支上的某个提交「摘」到另一个分支。

```
原始：
* 2adebbc C: add h          ← 想摘这个
* e49b2fb B: add g
| * 6bcd67b D: add i
|/
* 327c057 A: init

执行 git cherry-pick 2adebbc
```

结果：

```
* ec3ed8c C: add h          ← hash 变了！
* 6bcd67b D: add i
* 327c057 A: init
```

**`2adebbc` 变成了 `ec3ed8c`** —— 和 rebase 一样，**父提交不同 → hash 不同**。

> **`cherry-pick` 和 `rebase` 的共性**：它们都是「**把变更重新应用一遍**」，所以都产生新 hash。区别是 rebase 批量重放一串，cherry-pick 只挑一个（或几个）。

**用途**：

- 把 hotfix 从 release 分支摘到 main
- 从同事的分支摘一个有用的提交（不想合整个分支）

### 实测：`rebase -i` 合并提交（squash）

场景：本地有 4 个凌乱的提交，提交前想合并成 1 个。

```
59845c1 再改一下
2e795ba fix typo
753cf7e wip
fc32143 feat: 第一步
```

执行 `git rebase -i HEAD~3`，把后 3 个标成 `squash`：

结果：

```
提交数: 2
1751f53 wip                 ← 3 个被压成了 1 个
fc32143 feat: 第一步

f 的最终内容: 4              ← 所有改动都保留了
```

**4 个 → 2 个，内容和改动全部保留。**

`rebase -i` 的六个动作（记住前三个就够）：

| 动作 | 作用 |
|---|---|
| `pick` | 保留这个提交（默认） |
| `squash` | **合并到上一个提交**，message 也合并 |
| `fixup` | 合并到上一个提交，**丢弃这个的 message** |
| `reword` | 只改 message |
| `edit` | 停下来让你改内容 |
| `drop` | 删掉这个提交 |

> **`squash` 和 `fixup` 的区别**：`squash` 会让你编辑合并后的 message（把两条信息拼一起），`fixup` 直接用前一条的 message。**「wip」「fix typo」这种提交用 `fixup` 更干净。**

### 实测：`stash`

```
初始状态：
 M f          ← 已修改未暂存
A  g          ← 已暂存的新文件

git stash 后：
（工作区干净）

git stash pop 后：
 M f
A  g          ← 完整恢复，连「暂存/未暂存」的状态都保留了
```

**`stash` 会保留暂存状态**（新版 Git），这是它比 `git diff > patch` 强的地方。

| 命令 | 作用 |
|---|---|
| `git stash` | 存起来（默认只存已跟踪文件的改动） |
| `git stash -u` | **连未跟踪的新文件一起存**（不加 `-u` 新文件不会被存！） |
| `git stash -a` | 连 `.gitignore` 忽略的文件也存 |
| `git stash list` | 看列表 |
| `git stash pop` | 恢复并**删除**这条 stash |
| `git stash apply` | 恢复但**保留**这条 stash |
| `git stash drop` | 删掉某条 |
| `git stash branch xxx` | 从 stash 建新分支 |

> **`-u` 这个坑**：`git stash` 默认不存「新建但没 add 的文件」。所以 stash 完发现新文件还在——**因为它压根没被存**。要加 `-u`。

### 追问链

| 追问 | 答法 |
|---|---|
| `git restore` 和 `git checkout --` 关系？ | 前者是后者的**语义化替代**。`git checkout -- file` 现在是 deprecated 写法 |
| `git reset` 和 `git restore` 都能撤销，怎么选？ | `restore` 只动文件不动历史；`reset` **动 HEAD**（删提交）。**「只想撤销文件改动」用 restore，「想撤销提交」用 reset** |
| `reset --hard` 后还能恢复吗？ | 能，`git reflog` 找到 hash 再 reset。**只要没 GC** |
| `commit --amend` 之后能推吗？ | 如果已经 push 过，必须 `--force-with-lease`。因为 amend 产生了新 hash |
| 怎么找「哪次提交删了这个文件」？ | `git log --diff-filter=D --summary -- <path>` |
| 怎么只提交某个文件的部分改动？ | `git add -p` |
| 怎么把一个文件恢复到某个历史版本？ | `git restore --source=<commit> -- file` |
| `git blame` 看到的是「最后修改」还是「引入」？ | 最后修改。要看引入用 `git log -S` 或 `git log -L :func:file` |
| `git log -L` 是什么？ | 追踪某个函数/代码块的历史：`git log -L :functionName:file.js`。**排查「这段逻辑为什么是这样」的终极工具** |

---

## 8.5 分支模型（面试常连着问）

| 模型 | 分支 | 适合 |
|---|---|---|
| **Git Flow** | `main` + `develop` + `feature/*` + `release/*` + `hotfix/*` | 有明确版本节奏的（客户端、SDK） |
| **GitHub Flow** | `main` + `feature/*`，PR 合并即发布 | **Web 应用的主流** |
| **Trunk Based** | 只有 `main`，靠 feature flag 控制 | 高频发布的团队（Google、Facebook） |

**为什么 Web 应用不用 Git Flow**：

> 「Git Flow 是为**有版本号、需要同时维护多个版本**的场景设计的（比如 iOS App 在维护 v1.2 时还要发 v1.3）。**Web 应用只有一个线上版本，随时可以发**，所以 `develop`、`release` 这些分支是纯负担——多一层合并就多一层冲突。」

**Trunk Based 的关键是 feature flag**：

```
不开 flag：代码合进 main 就等于上线 → 没写完的功能不能合
开 flag：代码可以随时合，用开关控制「用户能不能看到」
  → 好处：避免长期分支（长期分支 = 冲突地狱）
  → 代价：代码里有大量 if (flag)，需要定期清理已上线的 flag
```

---

## 8.6 面试怎么说（2 分钟版）

> 「merge 和 rebase 的区别，我会从**「它们对提交做了什么」**说起。
>
> **merge 生成一个新提交**，把两条历史连起来。原来的提交一个不动，hash 不变，历史保留分叉。
>
> **rebase 是把每个提交的变更重新应用一遍**，产生一批**全新的提交**。我实测过：同一个分叉 rebase 之后，`B` 的 hash 从 `e64fdec` 变成了 `4d4a95c`。**因为 commit 的 hash 包含父提交的 hash，父变了 hash 必变。**
>
> 这个事实直接推出黄金法则：**不能 rebase 公共分支**。因为别人本地的分支还指向旧提交，你一 rebase，他会看到「同一份改动在历史里存在两遍」，冲突极其痛苦。
>
> 选择上我是这么用的：**个人分支同步 main 用 rebase**（这样 PR 里只有自己的改动），**合进 main 用 merge**（公共历史不能重写）。
>
> 有一个细节必须说清：**rebase 冲突时 `<<<<<<< HEAD` 指的是 target 分支，不是你的分支**。这跟 merge 完全相反——merge 时 HEAD 是你自己。**记法：merge 时 HEAD 是我，rebase 时 HEAD 是对方。** 我第一次遇到就选错了。
>
> 还有一个小技巧：`git config --global rerere.enabled true`。它会记住你解决过的冲突，反复 rebase 同一个分支时能自动套用。**长期维护 feature 分支的人一定要开。**」

---

## 8.7 速记卡

```
【merge vs rebase 本质】
merge：新增一个 merge commit，原提交 hash 不变，保留分叉
rebase：重新应用变更，产生全新提交，hash 全变，历史线性

【hash 为什么变】
commit hash = 树hash + 父提交hash + 作者/时间 + message
父变了 → hash 必变
→ 所以「rebase 是搬提交」是错的，是「重建提交」

【黄金法则】
不要 rebase 已推送的公共分支
个人分支 rebase + --force-with-lease（不是 --force）

【--force vs --force-with-lease】
--force：无条件覆盖，会删掉同事的新提交
--force-with-lease：远端变了就拒绝，保命

【选择策略】
个人分支同步 main → rebase
合进 main → merge（或 squash merge）
本地整理 → rebase -i
git config --global pull.rebase true

【rebase 冲突 ★ 最大坑】
<<<<<<< HEAD  = target 分支（不是你的分支！）
>>>>>>> xxx   = 你正在重放的那个提交
merge 时相反：HEAD 是我
口诀：merge 是我，rebase 是对方

【冲突流程】
git status → 改文件 → git add（不是 commit）→ git rebase --continue
逃生：--skip（跳过这个提交）/ --abort（完全放弃，安全）
GIT_EDITOR=true git rebase --continue  ← 免得卡在编辑器

【rerere】
记住解决过的冲突，重复 rebase 自动套用
git config --global rerere.enabled true

【reset 三兄弟】
              HEAD  Index  Worktree
--soft         移动   不动    不动
--mixed(默认)  移动   重置    不动
--hard         移动   重置    重置   ← 唯一会丢代码的

【reset vs revert】
reset：删历史（只适合未推送）
revert：新增一个反向提交（已推送唯一安全选择）
revert 中间提交会冲突（后面提交已改同一块）

【reflog 救命】
记录 HEAD 每次移动，默认 90 天
reset --hard 删的提交都能找回

【cherry-pick】
摘单个提交，父不同 → 新 hash
和 rebase 本质相同：重新应用变更

【rebase -i 六动作】
pick 保留 / squash 合并且编辑 message / fixup 合并丢弃 message
reword 改 message / edit 停下改内容 / drop 删掉

【stash】
默认不存未跟踪文件 → 要 git stash -u
pop 删除、apply 保留
保留暂存/未暂存的原始状态

【分支模型】
Git Flow：有版本节奏的客户端
GitHub Flow：Web 应用主流
Trunk Based：高频发布 + feature flag
```

---

## 8.8 自测

```
□ 能说出 merge 和 rebase 对提交做了什么（一个新提交 vs 一批新提交）
□ 能解释 commit hash 由什么决定，为什么 rebase 后 hash 全变
□ 能说出「不能 rebase 公共分支」的两个具体后果
□ 能说出 --force 和 --force-with-lease 的区别
□ 能说出个人分支和 main 各自该用什么，以及理由
□ 能背出「merge 是我，rebase 是对方」这个口诀
□ 能说出 rebase 冲突时 <<<<<<< HEAD 指的是谁
□ 能完整说出 rebase 冲突的解决流程（add 不是 commit）
□ 能说出 --skip / --abort 各自的作用
□ 能说出 rerere 是什么、什么场景最有用
□ 能画出 reset 三兄弟对 HEAD/Index/Worktree 的影响表
□ 能说出 reset 和 revert 的本质区别、各自适用场景
□ 能说出 revert 中间提交为什么会冲突
□ 能说出 reflog 能救回什么、默认保留多久
□ 能解释 cherry-pick 和 rebase 的共同点
□ 能说出 squash 和 fixup 的区别
□ 能说出 git stash 默认不存什么、要加什么参数
□ 能说出 Git Flow 为什么不适合 Web 应用
```
