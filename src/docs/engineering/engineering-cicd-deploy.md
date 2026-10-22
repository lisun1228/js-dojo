# 工程化 07｜CI/CD、Docker 与部署

> 覆盖题号：3（CI/CD 是什么）、19（什么是 CICD）、25（如何实现自动发布）、27（常用平台）、4（docker 核心概念）、33（SPA 路由刷新 404）
> 去重后：**3 个考点**

---

## 7.1 题单答案的问题

> **3.** 持续集成（CI）：代码提交自动跑测试。持续部署（CD）：自动部署到生产。工具：GitHub Actions、GitLab CI、Jenkins。
>
> **4.** 镜像：模板。容器：运行实例。Dockerfile：构建镜像的脚本。仓库：存镜像。
>
> **33.** `devServer.historyApiFallback: true`。生产 Nginx `try_files $uri /index.html`。

**这三条都是「名词解释」级别的答案**。问题在于：

1. **CI 和 CD 的第二个 D 有两个意思**（Delivery vs Deployment），这在面试里是必问的辨析点，题单只写了一个
2. **没有流水线**——面试官问「你们 CI 跑什么」，你答不上来
3. Docker 只说了四个名词，**没说「为什么前端要用 Docker」**
4. 题 33 的答案正确但**没说这个配置的副作用**（下面有实测）

---

## 7.2 CI/CD 是什么（题 3 / 19）

### 一句话结论

> **CI 是「每次提交都验证」，CD 是「验证通过就上线」。**

### 必须辨析：两个 CD

这是这道题**最高频的追问**，题单没有区分：

| 缩写 | 全称 | 含义 | 人工介入 |
|---|---|---|---|
| **CI** | Continuous Integration | 持续集成：代码合并前自动跑 lint / test / build，**保证主干一直可用** | 无 |
| **CD** | Continuous **Delivery** | 持续**交付**：构建出可部署的产物，**但上线要人点一下** | **有（一个按钮）** |
| **CD** | Continuous **Deployment** | 持续**部署**：测试通过**直接上生产**，全自动 | 无 |

**区别只在最后一步**：

```
CI:      commit → lint → test → build          （到此为止）
Delivery: ... → build → 部署到 staging → [人工确认] → 生产
Deployment: ... → build → 部署到 staging → 自动 → 生产
```

> **面试时的标准答法**：
> 「CD 有两个意思，容易混。**Continuous Delivery 是『随时可以发布』——产物一直处于可上线状态，但按不按那个按钮由人决定。Continuous Deployment 是『自动发布』——测试过了就直接上生产。**
>
> 大部分公司做的是 Delivery，不是 Deployment。因为业务上需要『什么时候上线』的决定权——比如大促前冻结发布，或者要配合运营节奏。」

### 为什么需要 CI

没有 CI 的世界：

```
A 同学：本地跑通了，push
B 同学：本地跑通了，push
合并 → 冲突 / 类型错误 / 测试挂了 → 主干坏了三天没人发现
```

**CI 的价值不是「发现问题」，是「把发现问题的时机提前」**：

| 问题发现时机 | 修复成本 |
|---|---|
| 本地（编辑器里） | 几分钟 |
| CI（提交后 5 分钟） | 十几分钟 |
| Code Review | 半小时 + 一次沟通 |
| 测试环境 | 几小时 |
| **生产环境** | **几小时 + 用户影响 + 事故复盘** |

> 「CI 的本质是**把反馈环缩短**。左移（shift left）说的就是这个——能越早发现的错误，越不要留到后面。」

### 一条完整的流水线（能直接抄）

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

# 同一个分支的新提交，取消旧的运行（省钱 + 避免旧结果覆盖）
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ① 快检查：能在 1 分钟内失败的，放最前面
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck

  # ② 测试：和 lint 并行，别串行
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test -- --coverage
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage
          path: coverage/

  # ③ 构建：依赖前两步都通过
  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
        env:
          NODE_ENV: production
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
          retention-days: 7
```

### 流水线设计的四个原则

| 原则 | 说明 | 反例 |
|---|---|---|
| **快失败放前面** | lint 30 秒能过就绝不放在 build 后面 | 先跑 5 分钟 build 再跑 lint |
| **能并行就并行** | lint 和 test 互不依赖，串行是浪费 | `needs: lint` 挂在 test 上 |
| **缓存依赖** | `cache: pnpm` 省掉每次的 install | 每次 `pnpm install` 从零下载 |
| **可复现** | 用 `--frozen-lockfile`，不更新锁文件 | CI 里跑 `npm install` 会改锁文件 |

> **`--frozen-lockfile` 那一条值得强调**：
> 「CI 里必须用 `--frozen-lockfile`（npm 是 `npm ci`）。如果 CI 里跑 `npm install`，它可能悄悄升级了某个依赖的次要版本，导致**这次构建和上次的依赖树不一样**——这就是「构建不可复现」。排查线上问题时发现『本地和线上依赖版本不同』，根因往往在这。」

### 平台对比

| 平台 | 特点 | 适合 |
|---|---|---|
| **GitHub Actions** | 生态最大（Marketplace 有上万个 action）、公开仓库免费、YAML 配置 | 开源项目、已用 GitHub 的团队 |
| **GitLab CI** | 和 GitLab 深度集成、`.gitlab-ci.yml`、自建 Runner 方便 | 用 GitLab 自建的公司（国内很多） |
| **Jenkins** | 最老、最灵活、插件无敌，但**配置靠界面点，难版本化** | 传统企业、需要和内部系统深度集成 |
| **CircleCI** | 配置简洁、Docker 支持好 | 中小团队 |
| **Travis CI** | 曾经最流行，现在**开源项目免费额度取消后基本没落** | 遗留项目 |

> **面试时不要只报名字**。加一句评价：
> 「**新项目我会选 GitHub Actions 或 GitLab CI**，因为配置在仓库里、能版本化、能 code review。Jenkins 插件最强，但它的 Job 配置在界面上，很难复制到另一个环境——我见过『只有某个人知道怎么配这个 Job』的情况，这是很大的维护风险。」

### 追问链

| 追问 | 答法 |
|---|---|
| CI 里放过哪些步骤？顺序怎么定？ | 按「失败速度」和「依赖关系」排：**lint → typecheck → test → build → 部署**。快且能早失败的在前 |
| 怎么保证 CI 和本地一致？ | ① 锁 Node 版本（`.nvmrc` + `engines`）；② 锁依赖（锁文件 + `--frozen-lockfile`）；③ **用 Docker 镜像统一环境**；④ 共享 lint/test 配置（不要 CI 里另写一套） |
| CI 太慢怎么办？ | 三个方向：**缓存**（依赖、构建产物）、**并行**（拆 job）、**只跑受影响的**（monorepo 用 Turborepo/Nx，单仓库用 `git diff` 过滤） |
| 怎么防止「有人跳过 CI 直接合」？ | 分支保护规则（required status checks）+ 禁止直接 push main |
| 部署失败怎么回滚？ | 见 7.5 节。核心是**产物要能重放**——保存每次的产物 + 版本号，回滚 = 切回上一个产物 |
| CD 到生产要审批吗？ | 大部分公司要。GitHub Actions 用 `environment` + required reviewers 实现 |
| 怎么处理环境变量/密钥？ | **绝不写进仓库**。用 GitHub Secrets / GitLab CI Variables / Vault。**注意：构建时注入的环境变量会被打进产物，前端没有秘密** |
| 前端有「秘密」吗？ | **没有**。所有打进 bundle 的变量用户都能看到。**API key 必须放后端**。前端只能有「公开配置」（如 CDN 地址、Sentry DSN） |

> 最后两条特别重要。**「前端没有秘密」这个认知**，能答出来说明你懂安全边界。

---

## 7.3 Docker 的核心概念（题 4）

### 一句话结论

> **Docker 把「应用 + 运行环境」打成一个不可变的镜像，用容器跑起来。解决的问题是「在我机器上是好的」。**

### 四个核心概念（题单给了，但要补「关系」）

| 概念 | 类比 | 说明 |
|---|---|---|
| **Dockerfile** | 菜谱 | 描述「怎么构建镜像」的指令文件 |
| **Image（镜像）** | 做好的一道菜（冻结的） | **只读**的层叠文件系统，不可修改 |
| **Container（容器）** | 端上桌的那一份 | 镜像的**运行实例**，在镜像顶层加一个可写层 |
| **Registry（仓库）** | 菜谱库 | 存镜像的地方（Docker Hub / 阿里云 ACR / Harbor） |

**关系链**：

```
Dockerfile  --build-->  Image  --run-->  Container
                          ↓ push/pull
                       Registry
```

**一个容易答错的点**：

> 「容器不是『轻量级虚拟机』。**虚拟机虚拟的是硬件，容器共享宿主机内核**。所以容器启动是毫秒级，虚拟机是分钟级。」

### Dockerfile 的分层与缓存（最重要的一点）

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile     # ← 这一层会被缓存
COPY . .
RUN pnpm build
CMD ["node", "server.js"]
```

**关键机制**：**每条指令生成一层，某一层变了，它和它之后的所有层都要重建。**

所以顺序至关重要：

```dockerfile
# ❌ 错误顺序：改一个源码文件，就要重新 install
COPY . .
RUN pnpm install

# ✅ 正确顺序：先 copy 依赖清单（很少变），再 install，最后 copy 源码
COPY package.json pnpm-lock.yaml ./
RUN pnpm install
COPY . .
```

**实测意义上的收益**：改业务代码重新构建时，`pnpm install` 那层直接命中缓存，**构建从几分钟降到几十秒**。

> **面试时这句最能体现水平**：
> 「Dockerfile 的指令顺序不是随意的，它决定了缓存命中率。**变化频率越低的东西越要放前面**。所以依赖清单在源码之前、`apt-get install` 在 `COPY .` 之前。」

### 前端的 Docker 镜像该怎么做

**关键认知：前端产物是静态文件，不需要 Node 运行时。**

```dockerfile
# ============ 阶段 1：构建 ============
FROM node:20-alpine AS builder
WORKDIR /app

# ① 先只 copy 依赖清单 → 单独一层，最大化缓存
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

# ② 再 copy 源码（这层经常变，但前面已缓存）
COPY . .
RUN pnpm build

# ============ 阶段 2：运行 ============
FROM nginx:alpine AS runner

# ③ 只拿构建产物，不带 node_modules 和源码
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**这就是「多阶段构建」**。体积对比：

| 方案 | 镜像体积 | 内容 |
|---|---|---|
| 单阶段（`FROM node` + 跑 build + 用 node 服务） | **~1 GB** | node + node_modules + 源码 + 产物 |
| 多阶段（build 阶段丢弃，只留 nginx + dist） | **~25 MB** | nginx + 静态文件 |

**40 倍差距。** 而且多阶段的好处不只是小：

1. **攻击面小**——镜像里没有 Node、没有源码、没有 `node_modules`
2. **启动快**——nginx 比 node 服务轻
3. **职责单一**——静态文件就该用静态服务器

> **面试时的关键句**：
> 「前端镜像我用多阶段构建。**因为前端产物是静态文件，运行时不需要 Node**。所以 build 阶段的 node 和 node_modules 全部丢弃，最终镜像只有 nginx + dist，从 1 GB 降到 25 MB。
>
> 这不只是体积问题——**镜像里没有源码和依赖，安全性也好得多**。而且如果只用 node 起个静态服务，性能还不如 nginx（nginx 有 sendfile、gzip、缓存头这些现成能力）。」

### `.dockerignore` 不能忘

```
node_modules
dist
.git
*.log
.env*
coverage
```

**不写会怎样**：`COPY . .` 会把本地的 `node_modules`（几百 MB、还可能是 macOS 架构的二进制）复制进镜像，然后被 `RUN pnpm install` 覆盖——**白白让构建慢几分钟，还可能导致原生模块架构不匹配的诡异错误**。

### 追问链

| 追问 | 答法 |
|---|---|
| 镜像为什么比 Dockerfile 大很多？ | 镜像含基础镜像（`node:20-alpine` 本身 ~130 MB）+ 每层的文件。`node:20`（非 alpine）有 ~1 GB |
| `alpine` 有什么坑？ | 用 musl libc 而不是 glibc。**某些原生模块（node-sass、sharp 的旧版）在 alpine 上要重新编译甚至编不过**。遇到就换 `-slim` 版本（Debian 基底） |
| 容器里怎么传环境变量？ | `docker run -e KEY=VALUE` 或 compose 的 `environment`。**前端要注意：构建时注入的变量会打进产物，不是秘密** |
| 容器数据会丢吗？ | **会**。容器删除时其可写层一起删。要持久化用 `volume` 或 `bind mount` |
| 容器时区不对怎么办？ | 默认 UTC。设 `TZ=Asia/Shanghai` 环境变量，或镜像里装 `tzdata`。**这是「日志时间差 8 小时」的经典原因** |
| 怎么减小镜像？ | ① 多阶段构建；② alpine/slim 基础镜像；③ `.dockerignore`；④ 合并 RUN 减少层数；⑤ 清理缓存（`rm -rf /var/lib/apt/lists/*` 要**在同一条 RUN 里**） |
| 为什么清理要写在同一层？ | 因为分两条 RUN 的话，第一条产生的文件在第二条删除后，**中间层仍然存在镜像里**——体积不会减。这是最反直觉的一点 |
| Docker 和 k8s 什么关系？ | Docker 是容器运行时（造和跑单个容器）；k8s 是编排系统（管几百个容器的调度、扩缩、服务发现）。**k8s 早期依赖 Docker，现在通过 CRI 支持 containerd 等** |

---

## 7.4 如何实现自动发布（题 25）

### 一句话结论

> 推代码 → CI 验证 → 构建产物 → 上传 CDN/服务器 → 切换流量。

### 完整链路

```
① 开发提交 → PR
② CI 跑 lint/test/build（7.2 的流水线）
③ 合并到 main
④ CI 构建生产产物（带 contenthash）
⑤ 上传到 CDN（先传静态资源，后传 index.html）
⑥ 刷新 CDN 缓存（只刷 index.html）
⑦ 通知（钉钉/企微）
```

### ⑤⑥ 的顺序是关键（这是最容易出错的地方）

**必须「先传资源，后传 index.html」**，原因：

```
index.html 里引用的是  main.a1b2c3.js
如果先传新的 index.html，而 main.a1b2c3.js 还没传完
→ 用户拿到新 HTML，去请求不存在的 JS → 白屏
```

**正确顺序**：

```
1. 上传所有 assets/*.js、*.css（文件名带 hash，不会冲突）
2. 上传新的 index.html（覆盖旧的）
3. 只刷新 index.html 的 CDN 缓存
```

> **「只刷 index.html」也是关键**：
> 「带 hash 的文件内容变了文件名就变了，**天然不需要刷缓存**。真正需要刷的只有 `index.html`——它的文件名不变，内容变了。所以 CDN 刷新只刷这一个文件，几秒钟搞定。**如果全站刷新，要几分钟到几十分钟，这段时间用户可能拿到新旧混合的版本。**」

### index.html 为什么绝对不能强缓存

```nginx
# index.html：协商缓存或不缓存
location = /index.html {
    add_header Cache-Control "no-cache, must-revalidate";
}

# 带 hash 的静态资源：强缓存一年
location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
}
```

**原因**：`index.html` 是「入口」。它里面写着「这次该加载哪个 hash 的 js」。如果它被强缓存，用户会一直用旧的 HTML → 一直加载旧的 JS → **永远看不到新版本**。

**而带 hash 的 JS/CSS 可以放心缓存一年**——因为内容变则文件名变，不存在「拿到旧版本」的问题。

> 这个「**缓存分层策略**」是前端部署的核心知识：
> 「**文件名不变的不缓存，文件名变了的长缓存。** 一句话概括：把缓存问题转成命名问题。」

### 灰度/回滚

| 手段 | 做法 | 代价 |
|---|---|---|
| **全量发布** | 直接替换 | 出问题影响所有用户 |
| **灰度（按比例）** | 负载均衡把 5% 流量切到新版本 | 需要两套部署并存 |
| **灰度（按用户）** | 用 cookie/userId 哈希决定走哪个版本 | 需要网关支持 |
| **蓝绿部署** | 两套环境，切流量 | 资源翻倍 |
| **回滚** | 把 index.html 切回上一版 | **最快**（1 分钟） |

**回滚为什么最快**：因为**只需要把 `index.html` 换回上一个版本**。旧版本的 JS 文件还在 CDN 上（没人删），所以立刻可用。

> 「所以**每次发布都要保留历史产物**。我的做法是保留最近 10 个版本的 dist，回滚就是「重新上传上一版的 index.html」。**1 分钟能回滚，比任何预案都有效。**」

---

## 7.5 SPA 路由刷新 404（题 33）

### 一句话结论

> 因为 `/users/123` 这个路径**在服务器上不存在**，服务器返回 404。修法是「找不到文件就返回 index.html，交给前端路由处理」。

### 原因（用实测说服）

SPA 的两种路由模式：

| 模式 | URL | 刷新时会请求服务器吗 |
|---|---|---|
| **hash**（`#/users/123`） | `example.com/#/users/123` | ❌ **不会**。`#` 之后不发给服务器 |
| **history**（`/users/123`） | `example.com/users/123` | ✅ **会**。服务器要处理 `/users/123` 这个路径 |

**所以只有 history 模式会 404**。而 hash 模式因为丑（带 `#`），现在基本都用 history。

### 实测：两个静态服务器的对比

我起了两个最小 HTTP 服务：一个普通的、一个带 fallback 的。

```
Path                  strict                  try_files
------------------------------------------------------------------
/                     200 <!DOCTYPE html      200 <!DOCTYP
/about.html           200 <html><body>AB      200 <html><b
/assets/app.js        200 console.log("a      200 console.
/users/123            404                     200 [fallback] <!DOCTYP
/settings/profile     404                     200 [fallback] <!DOCTYP
/assets/missing.js    404                     200 [fallback] <!DOCTYP
```

**前四行说明了问题和解法**：

- `/users/123` 在 strict 下是 **404**——这就是「刷新 404」
- 带 fallback 后返回 `index.html`，前端路由拿到 URL 后自己渲染

**但第五行暴露了一个副作用**（下面讲）。

### 开发环境

**webpack**：

```js
// webpack.config.js
module.exports = {
  devServer: {
    historyApiFallback: true,
    // 更精细：只对「非静态资源」的请求回退
    historyApiFallback: {
      rewrites: [
        { from: /^\/(api|assets)\//, to: (ctx) => ctx.parsedUrl.pathname },
        { from: /./, to: '/index.html' },
      ],
    },
  },
};
```

**Vite**：默认就支持，不需要配（`appType: 'spa'` 是默认值）。如果要做 MPA 或 SSR 才需要改 `appType`。

### 生产环境（Nginx）

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # ① 静态资源：找不到就真 404，不要 fallback
    location /assets/ {
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # ② 前端路由：找不到就回 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # ③ index.html 不缓存
    location = /index.html {
        add_header Cache-Control "no-cache, must-revalidate";
    }

    # ④ 接口反向代理（避免跨域）
    location /api/ {
        proxy_pass http://backend:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### ⚠️ `try_files` 的副作用（实测发现的）

看实测表格最后一行：

```
/assets/missing.js    404                     200 [fallback] <!DOCTYP
```

**一个不存在的 JS 文件，也被 fallback 成了 `index.html`。**

浏览器拿到 `<html>...` 却当成 JS 解析，控制台会报：

```
Uncaught SyntaxError: Unexpected token '<'
```

**这个错误信息非常误导人**——你会以为是 JS 语法错误，实际上是「文件不存在，返回了 HTML」。

**根因**：`try_files $uri $uri/ /index.html` 对**所有路径**都做了 fallback，包括 `/assets/` 下不存在的文件。

**修法**（就是上面配置里的 ①）：

```nginx
location /assets/ {
    try_files $uri =404;      # ← 找不到就返回 404，不要回 index.html
}
```

> **这条能说出来，说明你不是抄的配置**：
> 「`try_files` 有个副作用：它会连**不存在的 JS/CSS** 也 fallback 成 index.html。浏览器把 HTML 当 JS 解析，报 `Unexpected token '<'`。所以静态资源目录要单独一个 `location`，用 `try_files $uri =404` 阻止 fallback。」

### 其他部署方式

| 方式 | 怎么做 | 注意 |
|---|---|---|
| **Nginx** | 上面的配置 | 最主流 |
| **Nginx + CDN** | 源站 Nginx，CDN 回源 | CDN 也要配「404 不回源」或者源站正确处理 |
| **Netlify / Vercel** | 加 `_redirects` 或 `vercel.json` | `/* /index.html 200` |
| **OSS/COS 静态托管** | 配「404 页面 → index.html」 | **注意状态码要配成 200**，否则搜索引擎会认为页面不存在 |
| **Node 服务（Express）** | `app.get('*', (req,res) => res.sendFile('index.html'))` | 注意排除 `/api` 路由 |

**OSS 那条要注意**：

```
错误配法：404 页面设为 index.html，状态码 404
→ 用户能看到页面，但搜索引擎认为「这个 URL 不存在」，不收录
→ 而且 CDN 可能缓存这个 404 状态

正确配法：状态码返回 200，内容为 index.html
```

---

## 7.6 面试怎么说（2 分钟版）

### CI/CD

> 「CI/CD 我习惯拆成三个词说清：**CI 是每次提交自动验证**，保证主干一直可用；**CD 有两个意思**——Continuous Delivery 是「随时可发布但人点按钮」，Continuous Deployment 是「自动发到生产」。**大部分公司做的是 Delivery**，因为业务上需要发布时机的决定权。
>
> 我们的流水线顺序是：**lint → typecheck → test → build → 部署**。排序原则是「快失败放前面、能并行就并行」——lint 和 test 并行跑，build 依赖它们都通过。
>
> 有两个细节我认为很重要：一是 **CI 里必须用 `--frozen-lockfile`**，否则 CI 可能悄悄升级依赖，导致构建不可复现；二是**前端没有秘密**——所有注入到产物的环境变量用户都能看到，API key 必须放后端。」

### Docker

> 「Docker 解决的问题是『在我机器上是好的』——把应用和运行环境打成一个不可变镜像。
>
> 前端镜像的关键认知是：**产物是静态文件，运行时不需要 Node**。所以用多阶段构建：第一阶段 `node` 镜像里装依赖、跑 build，第二阶段只把 `dist` 拷进 `nginx:alpine`。**镜像从 1 GB 降到 25 MB**，而且镜像里没有源码和 node_modules，攻击面也小。
>
> Dockerfile 的指令顺序不是随意的——**变化频率越低的越放前面**。所以先 `COPY package.json` 再 `install`，最后才 `COPY .`。这样改业务代码时 install 那层能命中缓存，构建从几分钟到几十秒。」

### SPA 404

> 「history 模式下刷新 404，是因为 `/users/123` 这个路径在服务器上不存在。
>
> 开发环境配 `devServer.historyApiFallback`（Vite 默认就支持）；生产用 Nginx 的 `try_files $uri $uri/ /index.html`。
>
> 但这里有个坑我踩过：**`try_files` 会把不存在的 JS 也 fallback 成 index.html**。浏览器把 HTML 当 JS 解析，报 `Unexpected token '<'`——这个错误信息极具误导性，看起来像语法错误。所以静态资源目录要单独一个 `location`，用 `try_files $uri =404` 阻止 fallback。」

---

## 7.7 追问链（跨题）

| 问题 | 答法 |
|---|---|
| 发布流程怎么保证不出事？ | 四道关：CI 拦截 + 灰度验证 + 产物保留可回滚 + 监控告警。**最关键的是「能 1 分钟回滚」** |
| 为什么回滚只需要换 index.html？ | 因为带 hash 的 JS/CSS 文件名变了就不冲突，旧文件还在 CDN 上。回滚 = 把 index.html 指回旧版本 |
| CDN 缓存怎么刷？ | 只刷 `index.html`。带 hash 的资源天然不需要刷 |
| 怎么保证「新旧版本不混」？ | 先传资源后传 HTML。如果顺序反了，用户会拿到「引用不存在 JS 的新 HTML」→ 白屏 |
| 前端怎么处理多环境配置？ | ① 构建时注入（`VITE_API_URL`）；② **运行时注入**（容器启动时生成 `/config.js`）。**前者简单但不能「一次构建多处部署」** |
| 为什么推荐运行时注入？ | 因为「同一份产物部署到测试/预发/生产」才是真正的「构建一次、部署多次」。做法是入口 HTML 里引 `<script src="/config.js">`，容器启动时用 envsubst 生成 |
| k8s 里前端怎么部署？ | 一般是 nginx 镜像 + Deployment + Service + Ingress。**前端不需要 HPA 自动扩缩（静态文件用 CDN 更合适）** |
| 怎么做预发布（staging）？ | 独立环境 + 独立域名/路径 + 和生产同构的配置。**关键是数据要隔离，别连生产数据库** |

> **「构建一次、部署多次」这个点很值钱**：
> 「很多团队的做法是每个环境构建一次，`VITE_API_URL` 在构建时注入。问题是**测试环境验证过的产物，和生产实际跑的产物不是同一个**——构建时间不同、依赖可能微变。
>
> 更严谨的做法是**构建一次、部署多次**：产物里不写死环境配置，而是在容器启动时读环境变量生成一个 `/config.js`，页面先加载它。这样测试环境验证的就是生产要跑的那份文件。」

---

## 7.8 速记卡

```
【CI/CD】
CI = 每次提交自动验证
CD = Delivery（人点按钮，主流）/ Deployment（全自动）
CD 的区别只在最后一步有没有人

【流水线四原则】
快失败放前面：lint → typecheck → test → build
能并行就并行：lint 和 test 并行，build 依赖两者
缓存依赖：cache: pnpm
可复现：--frozen-lockfile（或 npm ci）

【前端没有秘密】
构建时注入的环境变量会打进产物 → 用户全能看到
API key 必须放后端，前端只能有公开配置

【Docker】
Dockerfile → Image（只读层）→ Container（+可写层）
容器共享宿主机内核 ≠ 轻量虚拟机（所以毫秒级启动）
★ 分层缓存：变化频率低的放前面
  COPY package.json → install → COPY . → build
★ 多阶段构建：前端产物是静态文件，不需要 Node
  node 阶段构建 + nginx 阶段只拷 dist → 1GB 降到 25MB
★ .dockerignore 必写，否则本地 node_modules 被拷进去
★ 清理缓存要写在同一层 RUN 里，否则中间层还在

【SPA 404】
原因：history 模式刷新时 /users/123 在服务器上不存在
开发：devServer.historyApiFallback / Vite 默认支持
生产：try_files $uri $uri/ /index.html
★ 副作用：不存在的 JS 也 fallback 成 HTML
  → 浏览器报 Unexpected token '<'
  → 静态资源单独 location：try_files $uri =404

【部署缓存策略】
文件名不变的不缓存（index.html）
文件名会变的长缓存（带 hash 的 assets，max-age=1年 immutable）
→ 把缓存问题转成命名问题

【发布顺序】
先传 assets（hash 文件名不冲突）→ 再传 index.html → 只刷 index.html 缓存
反了会白屏

【回滚】
换回上一版 index.html 即可（旧 JS 还在 CDN）
→ 所以每次发布要保留历史产物

【构建一次部署多次】
运行时注入 config.js（容器启动时 envsubst 生成）
而不是构建时写死 VITE_API_URL
```

---

## 7.9 自测

```
□ 能说清 CI / Continuous Delivery / Continuous Deployment 三者区别
□ 能说出大部分公司做的是 Delivery 而不是 Deployment 的原因
□ 能背出流水线的步骤顺序和排序原则
□ 能说出 --frozen-lockfile 的作用和「构建不可复现」的关系
□ 能说出「前端没有秘密」的含义
□ 能说出容器和虚拟机的本质区别
□ 能解释 Dockerfile 分层缓存、为什么依赖清单要放源码前面
□ 能说出多阶段构建的体积差（1GB → 25MB）和三个好处
□ 能说出 .dockerignore 不写的后果
□ 能解释「清理缓存必须写在同一层 RUN 里」
□ 能说出 SPA 404 的根因（hash 模式为什么不 404）
□ 能写出 Nginx 的 try_files 配置
□ 能说出 try_files 会把不存在的 JS fallback 成 HTML 这个坑
□ 能说出 Unexpected token '<' 的真实原因
□ 能解释 index.html 为什么不能强缓存、assets 为什么能缓存一年
□ 能说出为什么发布要先传资源后传 HTML
□ 能解释为什么回滚只需要换 index.html
□ 能说出「构建一次、部署多次」怎么做、为什么重要
```
