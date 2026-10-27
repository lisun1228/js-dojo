# 网络 · 09 HTTPS 与 TLS

> 覆盖：HTTPS 加密流程、证书链验证、TLS 1.2 / 1.3 握手、前向安全、HSTS

---

## 目录

- [9.1 一句话结论](#91-一句话结论)
- [9.2 HTTP 的三个致命问题（答案）](#92-http-的三个致命问题答案)
- [9.3 TLS 解决的三件事](#93-tls-解决的三件事)
- [9.4 为什么必须是混合加密（必问，要说数量级）](#94-为什么必须是混合加密必问要说数量级)
- [9.5 TLS 1.2 完整握手（详细版）](#95-tls-12-完整握手详细版)
- [9.6 TLS 1.3 的改进](#96-tls-13-的改进)
- [9.7 证书与证书链验证（最能体现深度的一块）](#97-证书与证书链验证最能体现深度的一块)
- [9.8 前向安全（Forward Secrecy）](#98-前向安全forward-secrecy)
- [9.9 HSTS：防止 SSL 剥离](#99-hsts防止-ssl-剥离)
- [9.10 HTTPS 的性能成本与优化](#910-https-的性能成本与优化)
- [9.11 HTTP 与 HTTPS 的区别](#911-http-与-https-的区别)
- [9.12 常见坑](#912-常见坑)
- [9.13 答题模板](#913-答题模板)
- [9.14 速记卡](#914-速记卡)

---

## 9.1 一句话结论

HTTPS = **HTTP + TLS**。TLS 解决 HTTP 的三个致命问题：**明文可窃听、内容可篡改、身份可冒充**。

手段是**混合加密**：非对称（实际是 ECDHE 密钥交换 + 证书签名）只负责**协商会话密钥、认证身份**，数据全程用**对称加密**；**证书链**保证对端是可信服务器。

---

## 9.2 HTTP 的三个致命问题（答案）

HTTP 是**纯文本、明文传输**，链路上任何一个节点都能：

| 攻击 | 手段 | 后果 |
|---|---|---|
| **窃听（Eavesdropping）** | 抓包（WiFi 热点、运营商、代理） | 密码、Cookie、身份证号全暴露 |
| **篡改（Tampering）** | 中间人修改响应 | 注入广告、注入恶意 JS、改支付账号 |
| **冒充（Spoofing）** | DNS 劫持、ARP 欺骗、伪造服务器 | 你访问 `bank.com`，实际连到了假服务器 |

公共 WiFi 下的典型链路：

```
用户访问 http://bank.com → 攻击者控制热点并做 DNS 劫持
→ 请求落到攻击者服务器，它反向代理真实站点并原样返回页面
→ 账号密码在明文链路中泄露，响应也可被改成「转账给 B」
```

---

## 9.3 TLS 解决的三件事

| 安全目标 | 手段 | 具体算法 |
|---|---|---|
| **机密性（Confidentiality）** | **对称加密** | AES-128-GCM / AES-256-GCM / ChaCha20-Poly1305 |
| **完整性（Integrity）** | **消息认证码（MAC）** | 现代用 AEAD（GCM 自带 MAC） |
| **身份认证（Authentication）** | **数字证书 + 非对称签名** | RSA / ECDSA |

**完整性独立于机密性**：攻击者虽然看不懂密文，但可以**翻转几个字节**，让解密结果变成垃圾。MAC 用来发现「内容被改过」。

**TLS 1.3 只允许 AEAD**（Authenticated Encryption with Associated Data，如 AES-GCM），一次运算同时完成加密与完整性校验，不需要「先加密再 HMAC」。

---

## 9.4 为什么必须是混合加密（必问，要说数量级）

### 9.4.1 两种加密的特性对比

| | 对称加密 | 非对称加密 |
|---|---|---|
| **密钥** | 加解密用**同一把** | **公钥加密、私钥解密**（或私钥签名、公钥验签） |
| **算法** | AES、ChaCha20、DES | RSA、ECC（ECDSA/ECDHE）、DH |
| **速度** | **快**（AES-NI 硬件加速下可达 GB/s 级） | **慢**（比 AES 慢 3~4 个数量级） |
| **单次处理量** | 任意长度，流式加密 | RSA-2048 单块最多 245 字节（PKCS#1 v1.5） |
| **密钥分发** | ❌ **难题**：怎么把密钥安全地给对方 | ✅ 公钥可以公开传输 |
| **能做什么** | 只加密 | 加密 + **签名（身份认证）** |

### 9.4.2 只用对称：密钥怎么给？

对称密钥本身也要在链路上传，攻击者抓到这个包就拿到 K，之后全程可解密。要安全传密钥，得先有安全通道；要有安全通道，得先有密钥——**死锁**。

### 9.4.3 只用非对称：慢到不可用

RSA-2048 一次只能加密 **245 字节**，传 1 MB 需要分 **4000 多块**，每块做一次模幂运算；私钥解密比公钥加密还要慢一个量级。对称算法吞吐以 GB/s 计，两者相差 **3~4 个数量级**。

### 9.4.4 混合加密：各取所长

```
握手：验证证书 → ECDHE 协商 pre-master → 结合双方 random 导出会话密钥（数据量极小）
传输：HTTP 明文 → 会话密钥 AES-GCM 加密 → 传输 → 解密
```

非对称只承担「安全地协商一把临时密钥」，对称承担「快速传大量数据」。

---

## 9.5 TLS 1.2 完整握手（详细版）

以 ECDHE + RSA 签名套件为例。

### 9.5.1 完整时序（ECDHE + RSA 签名）

```
客户端                                              服务端
  │                                                   │
  │ ① ClientHello                                     │
  │    · 支持的 TLS 版本（1.2/1.3）                     │
  │    · 密码套件列表（cipher suites）                   │
  │    · client_random（32 字节随机数）                 │
  │    · SNI（要访问的域名）                            │
  │    · ALPN（应用层协议协商：h2 / http/1.1）           │
  │ ─────────────────────────────────────────────────>│
  │                                                   │
  │ ② ServerHello                                     │
  │    · 选定的 TLS 版本和密码套件                       │
  │    · server_random（32 字节随机数）                 │
  │                                                   │
  │ ③ Certificate                                     │
  │    · 服务器证书链（服务器证书 + 中间 CA）             │
  │                                                   │
  │ ④ ServerKeyExchange                               │
  │    · ECDHE 参数（椭圆曲线、服务器临时公钥）           │
  │    · 用【证书私钥】对参数签名  ← 证明持有服务器私钥│
  │                                                   │
  │ ⑤ ServerHelloDone                                 │
  │ <─────────────────────────────────────────────────│
  │                                                   │
  │ ★ 客户端此时做三件事：                              │
  │   1. 验证证书链（域名、有效期、签名、吊销）           │
  │   2. 用 ECDHE 算出 pre-master secret              │
  │   3. 用 client_random + server_random + pre-master │
  │      算出 master secret → 再导出会话密钥            │
  │      （这一步叫 PRF，伪随机函数）                    │
  │                                                   │
  │ ⑥ ClientKeyExchange                               │
  │    · 客户端临时公钥（ECDHE）                        │
  │                                                   │
  │ ⑦ ChangeCipherSpec + Finished                     │
  │    · 通知对方：下一条消息开始加密                 │
  │    · Finished = 之前所有握手报文的摘要（加密后发）    │
  │ ─────────────────────────────────────────────────>│
  │                                                   │
  │ ⑧ ChangeCipherSpec + Finished                     │
  │ <─────────────────────────────────────────────────│
  │                                                   │
  │ ══════════ 之后全部用会话密钥对称加密 ══════════      │
```

### 9.5.2 四个关键设计（为什么这么设计）

#### ① 为什么需要 `client_random` 和 `server_random`

保证**每次会话密钥唯一**。只有 ECDHE 参数完全相同时才会导出相同密钥；两个随机数还让录制的握手无法重放——`Finished` 校验覆盖了双方 random。

#### ② 为什么 ECDHE 参数要「用证书私钥签名」

**这是身份认证的关键一步**：攻击者能生成自己的 ECDHE 密钥对，但没有 `example.com` 的证书私钥，签不出可验证的 `ServerKeyExchange`，客户端验签失败后中断连接。

注意区分两对密钥：

| 密钥 | 用途 | 生命周期 |
|---|---|---|
| **证书里的公私钥**（RSA/ECDSA） | 签名 `ServerKeyExchange`；RSA 密钥交换套件下还用于解密 pre-master（TLS 1.3 已删除） | 长期（几个月到几年） |
| **ECDHE 临时密钥对** | 只用于协商会话密钥 | **一次会话**，用完即弃（前向安全的来源） |

#### ③ 为什么 `Finished` 要包含「之前所有报文的摘要」

**防止握手过程被篡改**。摘要覆盖此前全部握手消息（transcript hash），攻击者偷偷改掉密码套件列表（降级到弱算法）或 ECDHE 参数，`Finished` 就对不上。这是防**降级攻击（downgrade attack）**的核心。

#### ④ 为什么需要 `ChangeCipherSpec`

握手前半段是**明文**，需要一个明确信号告诉对方「**下一条消息开始用会话密钥加密**」。

---

## 9.6 TLS 1.3 的改进

### 9.6.1 三个核心变化

| 变化 | 内容 |
|---|---|
| **① 握手从 2-RTT 降到 1-RTT** | 把密钥协商和证书发送**合并到第一轮**；客户端在 `ClientHello` 里就带上 ECDHE 公钥（`key_share`），不用等服务器 |
| **② 只保留安全算法** | 删掉静态 RSA 密钥交换、CBC 模式、RC4、SHA-1、MD5；密码套件只保留 AEAD + HKDF-SHA256/384 |
| **③ 完整握手强制 (EC)DHE** | 会话密钥由临时密钥导出，具备前向安全；0-RTT / 纯 PSK 恢复不在此列 |

### 9.6.2 1-RTT 怎么做到的

```
TLS 1.2：ClientHello → ServerHello + 证书 + ECDHE 参数 → ClientKeyExchange + Finished → Finished
TLS 1.3：ClientHello + key_share → ServerHello + key_share + 证书 + Finished → Finished
```

客户端在 `ClientHello` 里**主动提供 ECDHE 公钥**（`key_share` 扩展，通常会猜几个常见曲线）。服务器接受后第一轮就能算出共享密钥，省掉一整个 RTT。

### 9.6.3 0-RTT 怎么做到的（以及它的代价）

用上次会话的 **PSK（Pre-Shared Key，session ticket）**：

```
首次连接 1-RTT，服务器发 session ticket（加密的会话状态）
下次连接 ClientHello + PSK + 【加密的 HTTP 请求】→ 服务器直接用 PSK 解密 → 0-RTT
```

**0-RTT 的两个问题**：

| 问题 | 说明 |
|---|---|
| **没有前向安全** | 0-RTT 数据用 PSK 加密，PSK 长期存在；PSK 泄露，这段数据就能被解 |
| **可被重放攻击** | 攻击者录下 0-RTT 数据包，可以**原样重放**，服务器会当成新请求 |

所以 0-RTT 只能用于**幂等请求**（通常是 `GET`），不能用于 `POST /transfer` 这类会产生副作用的操作。

---

## 9.7 证书与证书链验证（最能体现深度的一块）

### 9.7.1 证书里有什么

一张 X.509 证书包含：

| 字段 | 内容 | 作用 |
|---|---|---|
| **Subject** | 证书持有者（`CN=example.com`） | 标识身份 |
| **SAN（Subject Alternative Name）** | **实际生效的域名列表** | **浏览器以 SAN 为准** |
| **Issuer** | 签发者（哪个 CA） | 找上级验证 |
| **Validity** | 有效期（`Not Before` / `Not After`） | 防过期 |
| **Public Key** | **服务器的公钥** | 验签、协商 |
| **Signature** | **CA 用自己私钥对上面内容的签名** | 证明「CA 认证过这个证书」 |
| **Key Usage / EKU** | 用途（serverAuth / clientAuth） | 防止「签名证书」被用于服务器 |
| **Serial Number** | 序列号 | 吊销查询 |
| **SCT** | 证书透明度日志的证明 | 防误签 |

Chrome 58 起忽略 CN，只按 SAN 匹配域名；但 OpenSSL / Node 在证书**完全没有 SAN** 时仍会回退到 CN，所以「只看 SAN」是浏览器行为，不是所有客户端行为。

### 9.7.2 三级证书链

```
根 CA（Root CA）
  · 自签名（Issuer == Subject），预装在操作系统/浏览器的信任库
  · 私钥在 CA 的离线 HSM 里，绝不出网
      │ 用根 CA 私钥签名
      ▼
中间 CA（Intermediate CA）
  · 由根 CA 签发，必须由服务器一起下发
      │ 用中间 CA 私钥签名
      ▼
服务器证书（Leaf / End-entity）
  · 由中间 CA 签发，里面是 example.com 的公钥
```

**为什么要有中间 CA**：根 CA 私钥必须离线保存；日常签发用中间 CA，**中间 CA 私钥泄露只需吊销中间证书，根 CA 不受影响**。

### 9.7.3 验证流程（六步）

浏览器拿到服务器证书后：

```
① 域名匹配    SAN 列表是否包含当前域名？
              （通配符 *.example.com 只匹配一级，不匹配 a.b.example.com）

② 有效期      now 是否在 Not Before ~ Not After 之间？

③ 用途正确    EKU 是否包含 serverAuth？

④ 逐级验签    中间 CA 公钥验服务器证书 → 根 CA 公钥验中间证书 → 根在信任库

⑤ 吊销检查    CRL / OCSP / OCSP Stapling / CRLite

⑥ 证书透明度  SCT 是否存在于公开的 CT 日志，防止 CA 偷偷签发
```

**域名、有效期、用途、验签任一失败都会中断连接**；吊销检查存在软失败策略，CT 是否强制取决于浏览器策略。

| 错误 | 原因 |
|---|---|
| `NET::ERR_CERT_DATE_INVALID` | 过期 |
| `NET::ERR_CERT_COMMON_NAME_INVALID` | 域名不匹配 |
| `NET::ERR_CERT_AUTHORITY_INVALID` | 证书链不完整、根 CA 不受信任，或自签名证书 |
| `NET::ERR_CERT_REVOKED` | 被吊销 |

### 9.7.4 为什么证书能防中间人（核心逻辑）

```
攻击者想冒充 example.com
→ 需要一张受信任 CA 签发的 example.com 证书
→ CA 签发前会验证域名所有权，攻击者拿不到这个签名
→ 只能：① 自签名 → 不受信任；② 用自己域名 → 域名不匹配；③ 偷/骗证书 → CT 日志会暴露
```

**信任链的本质**：你信任的不是证书本身，而是**证书背后的 CA**，而 CA 的信任是预装在操作系统里的。「自己签名」等于「自己说自己是好人」，没有第三方为域名所有权背书。

### 9.7.5 一个真实的运维坑：中间证书没配

**现象**：部分客户端能打开，另一部分（安卓 App / 老版本 Java 客户端）报证书错误。

**根因**：服务器只下发了「服务器证书」，**没下发「中间证书」**。只信任根 CA 且不会自动补拉的客户端无法构建完整链，Node / OpenSSL 实测报 `unable to get local issuer certificate`；是否自动补拉取决于客户端实现，不能依赖。

**检查方法**：

```bash
openssl s_client -connect example.com:443 -showcerts
# 正常应看到 2~3 张证书：服务器证书 + 中间证书
```

**修复**：`ssl_certificate` 指向「服务器证书 + 中间证书」拼接的 `fullchain.pem`。

---

## 9.8 前向安全（Forward Secrecy）

### 9.8.1 定义

**即使服务器的长期私钥将来泄露，攻击者也无法解密过去录下的流量。**

### 9.8.2 为什么需要

```
TLS 1.2 + RSA 密钥交换：客户端用证书公钥加密 pre-master，服务器用证书私钥解密。
攻击者录下流量，日后拿到私钥 → 解出 pre-master → 算出会话密钥 → 解密全部历史流量。

ECDHE：双方各生成临时密钥对，交换公钥后各自算出共享密钥；临时私钥用完销毁。
证书私钥只参与签名，泄露也解不开历史流量。
```

前者就是「先录后解」（harvest now, decrypt later）。

### 9.8.3 现状

| 版本 | 前向安全 |
|---|---|
| TLS 1.2 + RSA 密钥交换 | ❌ 没有 |
| TLS 1.2 + ECDHE | ✅ 有（现在的主流配置） |
| **TLS 1.3 完整握手** | ✅ **强制 (EC)DHE**；0-RTT / 纯 PSK 恢复例外 |

---

## 9.9 HSTS：防止 SSL 剥离

### 9.9.1 什么是 SSL Stripping

```
用户输入 example.com（浏览器补全成 http://）
→ 攻击者拦截这个明文请求，自己跟服务器建立 HTTPS
→ 再用明文 HTTP 把内容返回给用户，用户毫无察觉
→ 之后所有「敏感操作」都在明文下进行
```

**问题根源**：第一次访问时用的是 `http://`，第一跳是明文的。

### 9.9.2 HSTS 的解法

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

| 指令 | 作用 |
|---|---|
| `max-age=31536000` | 浏览器记住「这个域名**只走 HTTPS**」，有效期一年 |
| `includeSubDomains` | 所有子域名也适用 |
| `preload` | 申请加入**浏览器内置的 HSTS 预加载列表**（首次访问也强制 HTTPS） |

生效后，浏览器在本地把 `http://example.com` 改成 `https://example.com`（307 Internal Redirect），明文请求根本不会发出去，SSL Stripping 失效。

### 9.9.3 `preload` 的坑（谨慎使用）

进入浏览器内置 preload 列表后，**撤销要等浏览器版本/用户更新，无法即时生效**。如果某个子域名只有 HTTP 服务，会被强制 HTTPS 而无法访问。

上线顺序：先用较短的 `max-age` 验证，稳定后加长，再加 `includeSubDomains`，最后考虑 `preload`。

---

## 9.10 HTTPS 的性能成本与优化

### 9.10.1 成本在哪

主要成本在三处：**握手 RTT**（TLS 1.2 完整握手 2 RTT，1.3 为 1）、**证书吊销查询**（可能多一次 OCSP 往返）、**首次连接无缓存**。加解密本身在现代 CPU 上通常不是瓶颈（AES-NI）。

### 9.10.2 四个优化手段

```nginx
# Nginx 生产配置模板
ssl_protocols TLSv1.2 TLSv1.3;                    # 只留 1.2/1.3
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:...';  # TLS 1.2 及以下的套件
ssl_prefer_server_ciphers off;

ssl_session_cache shared:SSL:10m;                 # 约 4 万会话（1 MB ≈ 4000）
ssl_session_timeout 1d;
ssl_session_tickets on;                           # 会话复用；0-RTT 还需 ssl_early_data

ssl_stapling on;                                  # OCSP Stapling
ssl_stapling_verify on;
resolver 8.8.8.8 valid=300s;
```

| 手段 | 效果 |
|---|---|
| **TLS 1.3** | 握手从 2-RTT → 1-RTT |
| **会话复用**（session id / ticket） | 二次连接省掉证书与密钥交换，仍是 1-RTT；TLS 1.3 带 early data 才是 0-RTT |
| **OCSP Stapling** | 服务器代查并缓存吊销状态，省掉客户端查询往返 |
| **ECDSA 证书** | 签名运算比 RSA 快，证书也更小 |

---

## 9.11 HTTP 与 HTTPS 的区别

| 维度 | HTTP | HTTPS |
|---|---|---|
| **协议** | 应用层直接跑在 TCP 上 | HTTP over **TLS** over TCP |
| **默认端口** | 80 | **443** |
| **加密** | ❌ 明文 | ✅ 加密 |
| **完整性** | ❌ 可被篡改 | ✅ AEAD 校验 |
| **身份认证** | ❌ 无法确认服务器身份 | ✅ 证书链 |
| **证书** | 不需要 | **需要（且要受信任的 CA 签发）** |
| **握手** | TCP 1 RTT | TCP 1 RTT + TLS 1~2 RTT |
| **性能** | 略快 | 略慢（可优化到接近） |
| **SEO** | 无加成 | **Google 有排名加成** |
| **浏览器标记** | **「不安全」警告** | 显示锁图标 |
| **HTTP/2、Service Worker 等** | ❌ 浏览器只在 HTTPS 下启用 h2；SW 等需要 Secure Context | ✅ 支持 |

**Secure Context（HTTPS 或 localhost）是很多现代 API 的前置条件**：Service Worker、Geolocation、Camera、Clipboard、`crypto.subtle`。HTTPS 不只是安全，还是「能不能用新能力」的门槛。

---

## 9.12 常见坑

| 坑 | 正确说法 |
|---|---|
| 说「HTTPS 用非对称加密传数据」 | 数据用**对称**；非对称只用于协商密钥和签名 |
| 说「非对称加密比对称安全」 | 安全性都够，**差别在性能和密钥分发** |
| 说「HTTPS 加密了所有内容，包括域名」 | **SNI（域名）和 IP 在 TLS 握手前是明文**；ECH 可加密 SNI，但部署有限。URL 路径在加密的请求里 |
| 说「证书验证只看域名和有效期」 | 还有**签名链**、**用途（EKU）**、**吊销状态**、**CT 日志** |
| 说「证书的 CN 字段是域名」 | 浏览器以 **SAN** 为准（Chrome 58 起忽略 CN）；OpenSSL/Node 在无 SAN 时才回退 CN |
| 说「自签名证书也能直接用」 | 浏览器报「不受信任」；只能内网/开发用（需手动导入根证书） |
| 说「HTTPS 就没有中间人了」 | 如果**客户端信任了攻击者的根证书**（比如装了抓包工具的证书），照样能中间人 |
| 说「HTTPS 一定安全」 | 只保证**传输安全**；XSS、SQL 注入、越权它都防不了 |
| 说「证书私钥只用于签名」 | ECDHE 套件下如此；RSA 密钥交换套件还用于解密 pre-master（TLS 1.3 已删除） |

---

## 9.13 答题模板

### 30 秒版

- HTTPS = HTTP + TLS：握手用 ECDHE 协商临时会话密钥、用证书链认证服务器，之后数据用对称加密。
- 混合加密的原因：对称密钥无法安全分发；非对称单块只能加密几百字节，且慢 3~4 个数量级。
- 证书由受信任 CA 签发，浏览器验证 SAN、有效期、EKU、签名链、吊销与 CT。

### 2 分钟版

- **为什么需要**：HTTP 明文，可窃听、篡改、冒充；公共 WiFi 下的 SSL Stripping 是典型场景。
- **怎么加密**：对称解决速度，非对称解决密钥分发；ECDHE 只协商会话密钥，数据全程对称加密。
- **TLS 1.2 握手**：ClientHello（套件、client_random、SNI、ALPN）→ ServerHello + 证书 + 用证书私钥签名的 ECDHE 参数 → 客户端验证证书并算出会话密钥 → 双方 Finished（transcript hash 防降级）。两个 random 保证每次密钥唯一。
- **证书链**：根 CA（预装）→ 中间 CA（必须下发）→ 服务器证书；验证 SAN、有效期、EKU、逐级验签、吊销、CT。
- **前向安全与代价**：ECDHE 临时密钥用完销毁，证书私钥泄露也解不开历史流量；代价是握手 RTT，优化靠 TLS 1.3、会话复用、OCSP Stapling、ECDSA 证书。

### 追问表

| 追问 | 回答要点 |
|---|---|
| 为什么用混合加密 | 对称解决不了密钥分发；非对称慢 3~4 个数量级且单块只能加密几百字节 |
| 两个 random 有什么用 | 保证每次会话密钥唯一；录制的握手无法通过 Finished 校验 |
| 为什么 ECDHE 参数要签名 | 身份认证：没有证书私钥就签不出来 |
| 证书私钥用来加密数据吗 | ECDHE 套件下不；只用于签名。RSA 密钥交换套件是例外，已淘汰 |
| 证书链怎么验证 | 域名（SAN）→ 有效期 → EKU → 逐级验签 → 吊销 → CT 日志 |
| 为什么有中间 CA | 根 CA 私钥要离线保存；中间 CA 泄露只吊销它 |
| 中间人为什么伪造不了 | 拿不到受信任 CA 的签名 |
| TLS 1.3 比 1.2 快在哪 | 握手合并成 1-RTT；删掉不安全算法；完整握手强制 (EC)DHE |
| 0-RTT 有什么风险 | 无前向安全 + 可重放，只能用于幂等请求 |
| 什么是前向安全 | 私钥将来泄露也解不开历史流量（会话密钥来自临时 ECDHE） |
| SNI 是加密的吗 | ❌ 握手前明文（ECH 尚未普及） |
| HTTPS 就一定安全吗 | 只保证传输安全，XSS/越权/SQL 注入都防不了 |
| 为什么安卓 App 报证书错 | 常见原因是没下发中间证书 |
| HSTS 有什么用 | 防 SSL Stripping：强制所有请求走 HTTPS |
| HTTPS 对性能影响大吗 | 加解密通常不是瓶颈，主要成本是握手 RTT 和首次连接 |
| 为什么 Service Worker 要 HTTPS | 需要 Secure Context；HTTP 下很多 API 不可用 |

---

## 9.14 速记卡

```
HTTPS = HTTP + TLS，端口 443

三件事
  机密性 → 对称加密（AES-GCM / ChaCha20）
  完整性 → AEAD 的 MAC
  身份认证 → 证书 + 非对称签名

混合加密
  只用对称：密钥没法安全分发
  只用非对称：慢 3~4 个数量级；RSA-2048 单块最多 245 字节
  → 非对称只协商密钥和签名，数据全程对称

TLS 1.2 握手（2-RTT）
  ClientHello（套件 + client_random + SNI + ALPN）
  ServerHello（套件 + server_random）+ Certificate + ServerKeyExchange（ECDHE 参数 + 证书私钥签名）
  ClientKeyExchange（ECDHE 公钥）→ 双方算 pre-master → master → 会话密钥
  ChangeCipherSpec + Finished（含 transcript hash，防降级）
  ★ 两个 random 保证密钥唯一；ECDHE 签名做身份认证

TLS 1.3（1-RTT / 0-RTT）
  key_share 提前给 → 1-RTT
  PSK（session ticket）→ 0-RTT（无前向安全、可重放，只能用于幂等请求）
  删掉静态 RSA 密钥交换 / CBC / RC4 / SHA-1，完整握手强制 (EC)DHE

证书链
  根 CA（预装）→ 中间 CA（必须下发）→ 服务器证书
  验证六步：SAN / 有效期 / EKU / 逐级验签 / 吊销(OCSP) / CT 日志
  ★ Chrome 58+ 只看 SAN；无 SAN 时 OpenSSL/Node 回退 CN
  ★ 忘下发中间证书 → 只信任根 CA 的客户端报 unable to get local issuer certificate

前向安全
  会话密钥来自临时 ECDHE，用完销毁；证书私钥只签名
  TLS1.2+RSA 密钥交换 ❌；TLS1.2+ECDHE ✅；TLS1.3 完整握手 ✅

HSTS
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  防 SSL Stripping；preload 无法即时撤销

性能
  成本在握手 RTT 与首次连接；加解密通常不是瓶颈
  优化：TLS1.3 / 会话复用 / OCSP Stapling / ECDSA 证书

HTTP vs HTTPS
  80 vs 443 / 明文 vs 加密 / 无证书 vs 有证书 / 握手多 1~2 RTT
  ★ HTTPS 还是 Secure Context 门槛（SW、摄像头、地理位置）
```
