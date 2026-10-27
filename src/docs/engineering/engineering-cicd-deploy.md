# 工程化 07｜CI/CD、Docker 与部署

> 覆盖题号：3、19（CI/CD 是什么）、25（如何实现自动发布）、27（常用平台）、4（Docker 核心概念）、33（SPA 路由刷新 404）
> 去重后：**3 个考点**

---

## 目录

- [7.1 题单答案的问题](#71-题单答案的问题)
- [7.2 CI/CD 是什么](#72-cicd-是什么)
- [7.3 Docker 的核心概念](#73-docker-的核心概念)
- [7.4 如何实现自动发布](#74-如何实现自动发布)
- [7.5 SPA 路由刷新 404](#75-spa-路由刷新-404)
- [7.6 面试怎么说（2 分钟版）](#76-面试怎么说2-分钟版)
- [7.7 追问链（跨题）](#77-追问链跨题)
- [7.8 速记卡](#78-速记卡)
- [7.9 自测](#79-自测)

---

## 7.1 题单答案的问题

| 题号 | 题单答案 | 缺口 |
|---|---|---|
| 3 / 19 / 25 | CI：提交后自动跑测试；CD：自动部署到生产 | `CD` 有 Delivery / Deployment 两种含义；没有流水线步骤 |
| 27 | GitHub Actions、GitLab CI、Jenkins | 只列名字，没有选型依据 |
| 4 | 镜像模板、容器运行实例、Dockerfile 构建脚本、仓库存镜像 | 没有回答「前端为什么用 Docker」 |
| 33 | `devServer.historyApiFallback`、Nginx `try_files` | 没有说明 `try_files` 对静态资源的副作用 |

---

## 7.2 CI/CD 是什么

### 一句话结论

> **CI 是每次提交都验证；CD 是验证通过后交付或上线。**

### 两个 CD

| 缩写 | 全称 | 含义 | 人工介入 |
|---|---|---|---|
| **CI** | Continuous Integration | 合并前自动跑 lint / test / build，保证主干可用 | 无 |
| **CD** | Continuous **Delivery** | 构建出可部署产物，上线由人确认 | 有 |
| **CD** | Continuous **Deployment** | 验证通过后直接发生产 | 无 |

```
CI:         commit → lint → test → build
Delivery:   ... → build → staging → [人工确认] → 生产
Deployment: ... → build → staging → 自动 → 生产
```

区别只在最后一步是否有人确认。Delivery 保留发布时机的决定权（发布冻结、运营节奏），Deployment 要求流水线本身足够可信。

### 为什么需要 CI

```
A：本地跑通，push
B：本地跑通，push
合并 → 冲突 / 类型错误 / 测试挂 → 主干坏了没人发现
```

CI 的作用是把发现问题的时机提前，而不是事后救火。发现越晚，修复成本越高：本地 → CI → Code Review → 测试环境 → 生产（含用户影响与复盘）。

### 本仓库的流水线

`.github/workflows/ci.yml` 的实际内容：

```yaml
name: CI

on:
  push:
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    env:
      # Mermaid 在构建期用本机 Chrome 渲染，runner 上走系统安装位置
      CHROME_PATH: /usr/bin/google-chrome

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci

      - name: Ensure Chrome for Mermaid
        run: |
          if [ ! -x "$CHROME_PATH" ]; then
            sudo apt-get update
            sudo apt-get install -y google-chrome-stable
          fi

      - run: npm run lint
      - run: npm run format:check
      - run: npm run check:docs
      - run: npm run check:graph
      - run: npm run build
```

- 单个 `verify` job，步骤串行：`lint` → `format:check` → `check:docs` → `check:graph` → `build`
- `npm ci` 按 `package-lock.json` 安装，依赖树与锁文件一致
- `build` 脚本内部包含 `vue-tsc -b`，没有单独的 `typecheck` 命令
- 当前所有检查放在一个 job；步骤增多后再按「lint / test 并行、build 依赖两者」拆分

### 流水线设计原则

| 原则 | 做法 | 反例 |
|---|---|---|
| 快失败放前面 | lint、格式检查放在 build 前 | 先跑完整构建再跑 lint |
| 能并行就并行 | 无依赖的 job 拆开（如 lint 与 test） | 用 `needs` 串成一条链 |
| 缓存依赖 | `actions/setup-node` 的 `cache: npm` | 每次从零下载 |
| 可复现 | `npm ci`；pnpm 用 `--frozen-lockfile` | CI 里跑 `npm install`，锁文件被改写 |

`npm install` 可能更新锁文件里的次要版本，导致本次构建与上次的依赖树不同。排查「本地和线上依赖版本不一致」时，先看 CI 用的是 `npm ci` 还是 `npm install`。

跨 job 复用构建产物时，用 `actions/upload-artifact` 上传、`actions/download-artifact` 下载，避免每个 job 重复构建。

### 平台对比

| 平台 | 特点 | 适合 |
|---|---|---|
| **GitHub Actions** | 配置在仓库的 `.github/workflows/`，Marketplace 提供现成 action | 开源项目、已用 GitHub 的团队 |
| **GitLab CI** | `.gitlab-ci.yml`，与 GitLab 仓库、Runner 深度集成 | 自建 GitLab 的团队 |
| **Jenkins** | 插件生态最广；流水线可用 `Jenkinsfile` 版本化，历史 Job 配置仍可能留在界面里 | 需要对接内部系统的传统企业 |
| **CircleCI** | `.circleci/config.yml`，Docker 执行环境支持好 | 中小团队 |

选型看两点：配置能否随仓库版本化、Runner 能否自建。Jenkins 的能力来自插件，维护成本也来自插件。

### 追问链

| 追问 | 答法 |
|---|---|
| CI 里放哪些步骤？顺序怎么定？ | 按「失败速度」和「依赖关系」排：lint → 类型检查 → test → build → 部署 |
| 怎么保证 CI 和本地一致？ | 锁 Node 版本（`.nvmrc` + `engines`）；锁依赖（`npm ci` / `--frozen-lockfile`）；共享 lint / test 配置 |
| CI 太慢怎么办？ | 缓存依赖与构建产物；拆 job 并行；只跑受影响的包（monorepo 用 Turborepo / Nx） |
| 怎么防止跳过 CI 直接合？ | 分支保护规则（required status checks）+ 禁止直接 push main |
| 怎么处理环境变量和密钥？ | 用 GitHub Secrets / GitLab Variables / Vault；构建时注入的变量会被打进产物，前端没有秘密 |
| CD 到生产要审批吗？ | GitHub Actions 用 `environment` + required reviewers 控制 |

---

## 7.3 Docker 的核心概念

### 一句话结论

> Docker 把应用和运行环境打成不可变镜像，用容器运行，解决环境不一致的问题。

### 四个核心概念

| 概念 | 说明 |
|---|---|
| **Dockerfile** | 描述如何构建镜像的指令文件 |
| **Image（镜像）** | 只读的层叠文件系统，不可修改 |
| **Container（容器）** | 镜像的运行实例，在镜像顶层加一个可写层 |
| **Registry（仓库）** | 存放镜像的地方（Docker Hub / 阿里云 ACR / Harbor） |

```
Dockerfile  --build-->  Image  --run-->  Container
                          ↓ push/pull
                       Registry
```

容器不是轻量级虚拟机：虚拟机虚拟硬件并启动完整操作系统，容器共享宿主机内核，所以启动不需要系统引导。

### Dockerfile 的分层与缓存

每条指令生成一层；某一层变了，它和之后的所有层都要重建。因此变化频率低的指令放前面。

```dockerfile
# 仓库内没有 Dockerfile，以下是前端静态站的通用写法
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./   # 依赖清单，很少变
RUN npm ci                               # 命中缓存
COPY . .                                 # 源码，经常变
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

反例：`COPY . .` 写在 `npm ci` 之前，改一个源码文件就要重新安装依赖。

多阶段构建的收益：

1. 运行镜像只有 nginx 和 dist，不含 Node、源码、`node_modules`
2. 镜像内容少，攻击面小
3. 静态文件由 nginx 提供，不需要 Node 常驻进程

### .dockerignore

```
node_modules
dist
.git
*.log
.env*
coverage
```

不写时 `COPY . .` 会把本地 `node_modules` 拷进构建上下文，再被安装步骤覆盖；与构建机架构不一致的二进制也会被带进镜像。

### 追问链

| 追问 | 答法 |
|---|---|
| 镜像体积由什么决定？ | 基础镜像大小 + 各层新增的文件；`alpine` / `slim` 变体比默认镜像小 |
| `alpine` 有什么坑？ | 用 musl libc 而非 glibc，部分原生模块（旧版 `node-sass`、`sharp`）需要重新编译；编不过就换 `-slim` |
| 容器里怎么传环境变量？ | `docker run -e KEY=VALUE` 或 compose 的 `environment`；构建时注入的变量会进入产物 |
| 容器数据会丢吗？ | 会。容器删除时可写层一起删，要持久化用 volume 或 bind mount |
| 容器时区不对怎么办？ | 默认 UTC，设 `TZ=Asia/Shanghai`，或在镜像里装 `tzdata` |
| 怎么减小镜像？ | 多阶段构建；换 alpine / slim 基础镜像；`.dockerignore`；合并 RUN；清理缓存 |
| 为什么清理要写在同一层？ | 分两条 RUN 时，第一条产生的文件在第二条删除后仍留在中间层，体积不减 |
| Docker 和 k8s 什么关系？ | Docker 负责造和跑单个容器；k8s 负责调度、扩缩、服务发现，通过 CRI 支持 containerd 等运行时 |

---

## 7.4 如何实现自动发布

### 一句话结论

> 提交 → CI 验证 → 构建产物 → 上传静态资源 → 切换 `index.html`。

### 发布链路

```
① 提交 → PR
② CI 跑 7.2 的流水线
③ 合并到 main
④ 构建生产产物（文件名带 contenthash）
⑤ 上传 assets/*.js、*.css（先）
⑥ 上传 index.html（后）
⑦ 只刷新 index.html 的 CDN 缓存
```

### 顺序：先资源，后 HTML

`index.html` 引用 `main.a1b2c3.js`。若先上传新的 `index.html`，而该 JS 还没传完，用户会拿到引用不存在文件的 HTML，结果白屏。

带 hash 的资源文件名随内容变化，不会互相覆盖；`index.html` 文件名固定，必须最后上传并刷新缓存。全站刷新会让用户在刷新窗口内拿到新旧混合的版本，所以只刷 `index.html`。

### index.html 不能强缓存

```nginx
location = /index.html {
    add_header Cache-Control "no-cache, must-revalidate";
}

location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
}
```

`index.html` 是入口，决定加载哪个 hash 的 JS；被强缓存后用户会一直加载旧版本。带 hash 的文件内容变则文件名变，可以长期强缓存。规则：文件名不变的不缓存，文件名变了的长缓存。

### 灰度与回滚

| 手段 | 做法 | 代价 |
|---|---|---|
| **全量发布** | 直接替换 | 出问题影响全部用户 |
| **灰度（按比例）** | 负载均衡按权重把一部分流量切到新版本 | 两套版本并存 |
| **灰度（按用户）** | 按 cookie / userId 哈希分流 | 需要网关支持 |
| **蓝绿部署** | 两套环境，切换流量 | 资源翻倍 |
| **回滚** | 把 `index.html` 换回上一版 | 依赖旧产物仍可访问 |

回滚只需替换 `index.html`，旧 hash 的 JS/CSS 还在 CDN 上。前提是每次发布保留历史 dist。

---

## 7.5 SPA 路由刷新 404

### 一句话结论

> `/users/123` 在服务器上不存在，服务器返回 404；修法是找不到文件时返回 `index.html`，交给前端路由。

### 原因

| 模式 | URL | 刷新时请求服务器 |
|---|---|---|
| **hash** | `example.com/#/users/123` | 否，`#` 之后不发送 |
| **history** | `example.com/users/123` | 是，服务器要处理该路径 |

只有 history 模式会 404。

### 现象

- 无 fallback：`/users/123` → 404
- 有 fallback：返回 `index.html`，前端路由按 URL 渲染
- 副作用：`/assets/missing.js` 也返回 `index.html`

### 开发环境

**webpack**：

```js
module.exports = {
  devServer: {
    historyApiFallback: {
      rewrites: [
        { from: /^\/(api|assets)\//, to: (ctx) => ctx.parsedUrl.pathname },
        { from: /./, to: '/index.html' },
      ],
    },
  },
};
```

**Vite**：`appType` 默认 `'spa'`，自带 history fallback，不需要额外配置。

### 生产环境（Nginx）

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # 静态资源：找不到就真 404
    location /assets/ {
        try_files $uri =404;
    }

    # 前端路由：找不到就回 index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 接口反向代理
    location /api/ {
        proxy_pass http://backend:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

缓存头见 7.4，这里不重复。

### try_files 的副作用

`try_files $uri $uri/ /index.html` 对 `/assets/` 下不存在的文件同样回退到 `index.html`。浏览器把 HTML 当 JS 解析，控制台报：

```
Uncaught SyntaxError: Unexpected token '<'
```

错误信息指向语法，真实原因是文件不存在、返回了 HTML。修法是给静态资源单独一个 `location`，用 `try_files $uri =404` 阻止回退（见上面的配置）。

### 其他部署方式

| 方式 | 做法 | 注意 |
|---|---|---|
| **Nginx** | 上述配置 | 最常用 |
| **Nginx + CDN** | 源站 Nginx，CDN 回源 | 源站对缺失资源返回 404，避免 CDN 缓存错误响应 |
| **Netlify / Vercel** | `_redirects` 或 `vercel.json` | `/* /index.html 200` |
| **OSS / COS 静态托管** | 404 页面指向 `index.html` | 回退响应尽量返回 200；平台固定返回 404 时需在 CDN 改写状态码 |
| **Node（Express）** | 兜底中间件返回 `index.html` | 注册在 `/api` 路由之后；Express 5 的 `app.get('*')` 需写成 `/{*splat}` |

OSS 配成「404 页面 = index.html」但状态码仍是 404 时：页面能显示，搜索引擎判为不存在，CDN 也可能缓存这个 404。

---

## 7.6 面试怎么说（2 分钟版）

- **CI/CD**：CI 保证每次提交都验证；CD 的 Delivery 与 Deployment 区别只在最后一步是否有人确认。
- **流水线**：按「快失败在前」排（lint → 类型检查 → 构建），无依赖的步骤拆 job 并行；依赖安装用 `npm ci` / `--frozen-lockfile` 保证可复现。
- **Docker**：容器共享宿主机内核，不是轻量虚拟机；镜像按 Dockerfile 分层构建，变化频率低的层放前面；前端产物是静态文件，多阶段构建后只留 nginx 和 dist。
- **SPA 404**：history 模式刷新时服务器要处理前端路径；开发用 `historyApiFallback`（Vite 默认支持），生产用 `try_files $uri $uri/ /index.html`。
- **副作用**：`try_files` 会把缺失的静态资源也回退成 HTML，报 `Unexpected token '<'`；静态资源目录用 `try_files $uri =404`。

---

## 7.7 追问链（跨题）

| 问题 | 答法 |
|---|---|
| 发布流程怎么保证不出事？ | CI 拦截 + 灰度验证 + 产物保留可回滚 + 监控告警 |
| 前端怎么处理多环境配置？ | 构建时注入（`VITE_*`）简单，但同一份产物不能跨环境复用 |
| 为什么要「构建一次、部署多次」？ | 测试环境验证的产物应与生产运行的产物一致，环境差异放到运行时 |
| 运行时注入怎么做？ | 入口 HTML 先加载 `/config.js`，容器启动时用 `envsubst` 从环境变量生成 |
| k8s 里前端怎么部署？ | nginx 镜像 + Deployment + Service + Ingress；静态资源的扩容主要交给 CDN |
| 怎么做预发布？ | 独立环境与域名，配置和生产同构，数据隔离 |

---

## 7.8 速记卡

```
【CI/CD】
CI = 每次提交自动验证
CD = Delivery（人工确认）/ Deployment（自动发布）
区别只在最后一步

【流水线】
本仓库：npm ci → lint → format:check → check:docs → check:graph → build
原则：快失败在前、无依赖就并行、缓存依赖、npm ci 保证可复现

【前端没有秘密】
构建时注入的变量会进入产物 → 用户可见
API key 放后端，前端只放公开配置

【Docker】
Dockerfile → Image（只读层）→ Container（+可写层）
容器共享宿主机内核，不是轻量虚拟机
分层缓存：变化频率低的放前面
多阶段构建：node 阶段构建 + nginx 阶段只拷 dist
.dockerignore 必写；清理缓存与安装写在同一层 RUN

【SPA 404】
history 模式刷新时 /users/123 在服务器上不存在
开发：historyApiFallback / Vite 默认支持
生产：try_files $uri $uri/ /index.html
副作用：不存在的 JS 也回退 HTML → Unexpected token '<'
修法：静态资源单独 location，try_files $uri =404

【缓存策略】
文件名不变的不缓存（index.html）
文件名会变的长缓存（assets，max-age=31536000 immutable）

【发布顺序】
先传 assets → 再传 index.html → 只刷 index.html 缓存

【回滚】
换回上一版 index.html，旧 hash 资源仍在 CDN
前提：保留历史产物

【构建一次、部署多次】
运行时注入 config.js（envsubst），不在构建时写死 VITE_*
```

---

## 7.9 自测

```
□ 能说清 CI / Continuous Delivery / Continuous Deployment 的区别
□ 能说出本仓库流水线的步骤，以及为什么用 npm ci
□ 能说出流水线排序原则和一个并行化的例子
□ 能说出「前端没有秘密」的含义
□ 能说出容器和虚拟机的本质区别
□ 能解释 Dockerfile 分层缓存，以及依赖清单为什么放源码前
□ 能说出多阶段构建的三个收益
□ 能说出 .dockerignore 不写的后果
□ 能解释「清理缓存必须写在同一层 RUN 里」
□ 能说出 SPA 404 的根因，以及 hash 模式为什么不 404
□ 能写出 Nginx 的 try_files 配置和静态资源 =404 的写法
□ 能说出 Unexpected token '<' 的真实原因
□ 能解释 index.html 与 assets 的缓存策略差异
□ 能说出发布顺序、回滚步骤及其前提
□ 能说出「构建一次、部署多次」怎么做
```
