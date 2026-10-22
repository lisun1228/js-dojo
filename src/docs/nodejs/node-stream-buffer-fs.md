# Node 04｜Stream、Buffer 与 fs

> 覆盖题号：12（Stream）、13（Buffer）、14（fs 模块）
> 去重后：**3 个考点**

---

## 4.1 题单答案的问题

> **12.** 「Stream 是分块处理数据的抽象，不用等全部加载完。四种：Readable、Writable、Duplex、Transform。场景：大文件读写、HTTP 请求响应、日志处理。`readable.pipe(writable)`。」
> **13.** 「Buffer 是 Node 处理二进制数据的类，分配在 V8 堆外。用于 TCP 流、文件读写、图片处理。可和 String 互转。」
> **14.** 「文件系统模块。同步和异步两套。常用：readFile/writeFile、readdir、stat、mkdir、unlink、createReadStream/createWriteStream。」

**这三条的「分类」都对**，但都是「报菜名」式的答案。缺的共同点是：**没有一个提到「坑」**。而这三块恰好是 Node 里坑最多的地方。

| 题 | 题单缺的关键点 |
|---|---|
| 12 Stream | **背压是什么、`pipe` 为什么不够、`pipeline` 好在哪** |
| 13 Buffer | **slab 池化导致 `byteOffset` 不为 0**、**按字节切片会切坏中文** |
| 14 fs | **同步 API 什么时候反而更合适**、`fs/promises`、`fs.readFile` 的内存问题 |

---

## 4.2 Stream

### 一句话结论

> Stream 解决的是**内存问题**：让你能处理「比内存大」的数据。核心机制是**分块 + 背压**。

### 实测：先看数字

我准备了一个 **200 MB** 的文件，对比两种方式处理它：

| 方式 | 耗时 | RSS 内存增长 |
|---|---|---|
| `fs.readFileSync` 一次性读入 | 24 ms | **+200.4 MB** |
| Stream 流式（64KB 一块 + Transform + 写出） | 100 ms | **+44.4 MB** |

**关键结论**：

- `readFileSync` 的内存增长**恰好等于文件大小**——文件多大就吃多少内存
- Stream 的内存增长**与文件大小无关**（那 44MB 主要是 Transform 的内部缓冲和 GC 还没来得及回收的部分）

> **这就是 Stream 存在的唯一理由**。如果只是「代码优雅」，没人会用它——**它的 API 比 `readFile` 复杂得多**。它的价值是：**你能处理 100GB 的文件，只要内存里有几十 MB 的余量。**

**代价**：慢 4 倍（100ms vs 24ms）。因为多了分块、调度、背压检查的开销。

> **所以选型不是「Stream 更高级就用 Stream」**：
> 「几 MB 的配置文件，`readFile` 又快又简单。**只有当你不能把整个数据放进内存时，Stream 才是必需的。**」

### 四种 Stream

| 类型 | 说明 | 典型实例 |
|---|---|---|
| **Readable** | 只读 | `fs.createReadStream`、`process.stdin`、`http.IncomingMessage`（请求） |
| **Writable** | 只写 | `fs.createWriteStream`、`process.stdout`、`http.ServerResponse`（响应） |
| **Duplex** | 可读可写，**两端独立** | `net.Socket`（TCP）、`zlib` 的某些流 |
| **Transform** | 可读可写，**写入后转换再读出** | `zlib.createGzip`、`crypto.createCipheriv` |

**Duplex 和 Transform 的区别**（容易问）：

```
Duplex：读和写是两条独立通道
  net.Socket  → 你读到的数据不是你自己写进去的

Transform：写进去的数据经过处理变成可读的
  gzip 流    → 你写进原始数据，读出来是压缩后的
```

### 背压（backpressure）：Stream 的核心机制

**什么是背压**？简单说：**消费者处理不过来时，要能通知生产者慢一点。**

没有背压会怎样：

```
生产者（磁盘读取，很快）→ 内存缓冲区 → 消费者（网络发送，很慢）
     ↓ 一直读
  缓冲区无限增长 → 内存爆炸
```

#### 实测：`pipe` 的背压是有效的

我构造了一个「超快生产者 + 超慢消费者」：

```js
const fast = new Readable({
  highWaterMark: 16 * 1024,
  read() {
    produced += 16 * 1024;
    this.push(Buffer.alloc(16 * 1024));
    if (produced > 100 * 16 * 1024) this.push(null);
  },
});
const slow = new Writable({
  highWaterMark: 16 * 1024,
  write(chunk, enc, cb) {
    consumed += chunk.length;
    setTimeout(cb, 2);        // 每次写要 2ms
  },
});

fast.pipe(slow);
```

实测结果：

```
生产 1.6 MB / 消费 1.6 MB，耗时 233ms
```

**生产量 == 消费量**。生产者**没有跑在消费者前面**。

**机制**：

```
① readable 调用 push() 往内部缓冲区放数据
② 缓冲区超过 highWaterMark → push() 返回 false
③ pipe 检测到 false → pause() 源流（停止 read()）
④ writable 的 write() 也返回 false 时，pipe 等 'drain' 事件
⑤ 消费者处理完 → 触发 drain → resume() 源流
```

> **这一句是这道题的核心**：
> 「`pipe` 的背压不是『限速』，是**用返回值驱动的流控**：`push()` 和 `write()` 返回 `false` 就代表『缓冲区满了，别再给我』，`pipe` 收到这个信号就暂停上游，等 `drain` 事件再恢复。」

#### `highWaterMark` 是什么

它是**内部缓冲区的阈值**（不是「一次读多少」）：

| Stream | 默认 `highWaterMark` |
|---|---|
| 普通 Stream | 16 KB |
| `fs.createReadStream` | 64 KB |
| `zlib` 流 | 16 KB |

**它不是「块大小」**——`fs.createReadStream` 的 `highWaterMark` 确实同时决定了每次 `read()` 的字节数，但概念上是「缓冲区水位线」。

**调大它的场景**：大量小数据、CPU 处理快但系统调用开销大 → 调大减少系统调用次数。
**调小它的场景**：内存紧张、消费者很慢 → 调小减少内存占用。

### ⚠️ `pipe` 的错误处理缺陷（实测）

这是这道题**最能加分的地方**。

```js
const r = new Readable({ read() { this.destroy(new Error('源流炸了')); } });
const w = new Writable({ write(c, e, cb) { cb(); } });
r.on('error', () => console.log('源流 error 被监听'));
r.pipe(w);
```

实测：

```
pipe: 源流 error 已监听
pipe: 目标流 destroyed = false    ← 没有清理！
```

**问题**：源流出错了，但**目标流不会自动关闭**。结果是：

- 文件写了一半就停在那里（文件损坏）
- 如果目标是 HTTP 响应，**连接永远不会结束**（客户端一直等）
- 内存里的缓冲区没释放

**这就是 `pipeline` 存在的原因**：

```js
await pipeline(r, w);
// 源流出错 → 自动 destroy 所有流 → 只抛一次错误
```

实测：

```
pipeline: 捕获 → 源流炸了
pipeline: 目标流 destroyed = true    ← 自动清理 ✓
```

| 对比 | `pipe` | `pipeline` |
|---|---|---|
| 错误传播 | ❌ 只传给源流自己的 `error` | ✅ 统一到返回值/Promise |
| 出错时清理下游 | ❌ 不清理 | ✅ 全部 `destroy` |
| 中间流（多级） | 要每级手动处理 | ✅ 自动 |
| API | `src.pipe(dst)` | `pipeline(src, t1, t2, dst, cb)` / `await pipeline(...)` |

> **面试标准说法**：
> 「生产代码我不直接用 `pipe`，用 `pipeline`。因为 `pipe` 有个坑：**源流出错时不会清理目标流**，我实测过——`pipe` 之后目标流的 `destroyed` 还是 `false`。这意味着文件写了一半、HTTP 连接挂在那里不结束。`pipeline` 会自动 `destroy` 所有流并统一错误，还支持 `await`。」

### 五个常见坑

#### 坑 1：按字节切片会切坏中文（实测）

```js
const cn = Buffer.from('中文');   // 6 字节：e4b8ad e69687
const cut = cn.subarray(0, 4);
console.log(cut.toString());      // "中\ufffd"  ← 出现替换字符！
```

因为一个汉字在 UTF-8 里占 **3 字节**，截断在第 4 字节等于把第二个字符切了一半。

**正确做法**：

```js
// 方案 A：设 encoding，让 Stream 自己处理边界
fs.createReadStream(file, { encoding: 'utf8' });
// Stream 内部会用 StringDecoder，保证不切断多字节字符

// 方案 B：手动用 StringDecoder
const { StringDecoder } = require('string_decoder');
const decoder = new StringDecoder('utf8');
decoder.write(buf1);   // 不完整部分会留在内部
decoder.write(buf2);   // 拼接后一起输出
```

实测 `StringDecoder`：

```
第一块（前 4 字节）→ "中"
第二块（后 2 字节）→ "文"
```

#### 坑 2：忘了 `pipe` 的返回值可能被忽略

`pipe` 返回的是**目标流**，所以可以链式：

```js
fs.createReadStream('a.txt')
  .pipe(zlib.createGzip())
  .pipe(fs.createWriteStream('a.txt.gz'));
```

**但这条链上任何一环出错，都不会自动传播**（见上面的实测）。**链越长，越要用 `pipeline`。**

#### 坑 3：`data` 事件会切到流动模式

```js
stream.on('data', chunk => {...});   // ← 一旦监听，流自动进入 flowing 模式
```

如果你只挂了 `data` 但**没有及时消费**（比如 `data` 回调里做了同步耗时操作），数据会积压在内存里。

**建议**：优先用 `pipe`/`pipeline`，少直接监听 `data`。

#### 坑 4：Stream 是单次消费的

```js
stream.pipe(a);
stream.pipe(b);   // ← 数据只会被其中一个拿到（分片，不是复制）
```

**Stream 不能「一个源、两个独立的消费者」**。要做到这点必须手动分流（把 chunk 分别 push 到两个 PassThrough）。

#### 坑 5：`end` 和 `finish` 不是一回事

| 事件 | 谁触发 | 含义 |
|---|---|---|
| `end` | Readable | **没有更多数据可读了** |
| `finish` | Writable | **所有数据都已 flush 到下游** |
| `close` | 两者 | 流已被销毁、资源已释放 |

**顺序**：`readable end` → `writable finish` → `close`。

### 追问链

| 追问 | 答法 |
|---|---|
| Stream 的 `objectMode` 是什么？ | 让 Stream 传**任意 JS 对象**而不只是 Buffer/string。适合「数据管道」场景（比如批量处理 JSON 对象） |
| `readable.pause()` / `resume()` 有什么用？ | 手动控制流动模式。`pipe` 内部就是用这两个实现背压的 |
| 什么时候该自己写 Transform？ | 需要「边读边转换」时。比如日志脱敏、CSV 转 JSON、加解密 |
| 怎么让 Stream 支持进度？ | 在 Transform 里统计已处理字节，或者监听 `data` 累加长度。**推荐在 Transform 里做**（不破坏背压） |
| 怎么把 Stream 转成 Buffer？ | `const chunks = []; for await (const c of stream) chunks.push(c); Buffer.concat(chunks)`。**注意这会把整个内容读进内存，等于放弃 Stream 的优势** |
| 为什么 `for await...of` 能遍历 Stream？ | 因为 Stream 实现了 `Symbol.asyncIterator`。**这是最现代的消费方式**，比 `data` 事件更安全（自动处理背压） |

```js
// 推荐的现代写法
for await (const chunk of fs.createReadStream(file)) {
  process(chunk);   // 自动背压，不用手动管
}
```

---

## 4.3 Buffer

### 一句话结论

> Buffer 是**定长的字节数组**，用来在 JS 里处理二进制数据。它是 `Uint8Array` 的子类，但**分配在 V8 堆外**（其实是外部内存）。

### 题单答案的两处需要修正/补充

| 题单说 | 实际情况 |
|---|---|
| 「分配在 V8 堆外」 | **部分正确**。小 Buffer 从共享的 **8KB slab** 里切，大 Buffer 单独分配。**都在 V8 堆外（外部内存），但归属不同** |
| 「可和 String 互转」 | 对，但**必须指定编码**，且**按字节切片会切坏多字节字符**（下面有实测） |

### 实测：三种创建方式

```js
Buffer.alloc(8)          // 已清零（实测 every(x => x===0) → true）
Buffer.allocUnsafe(8)    // ★ 不保证清零（可能含旧数据）
Buffer.from('hello')     // 从字符串，默认 utf8
```

**`allocUnsafe` 为什么叫 unsafe**？

因为它**复用之前释放的内存**，里面可能有上一个 Buffer 的残留数据。如果那不是你写的数据，就存在**信息泄露风险**。

> 我这次实测 `allocUnsafe(8)` 恰好拿到全 0（因为 slab 是新的），**但不能依赖这个**——在生产环境高负载下，它可能拿到别人的数据。
>
> **规则：可以确定「马上会被完全覆盖」时用 `allocUnsafe`（快），否则用 `alloc`。**

### ★ slab 池化：`byteOffset` 为什么不是 0（关键）

这是 Buffer 最容易被忽略、也最容易出 bug 的点。

```js
const x = Buffer.from('aaaa');
const y = Buffer.from('bbbb');

console.log(x.byteOffset);        // 24
console.log(y.byteOffset);        // 32
console.log(x.buffer === y.buffer);   // true   ← 同一个 ArrayBuffer！
console.log(x.buffer.byteLength);     // 8192    ← 8KB slab
```

**发生了什么**：

```
Node 预分配一个 8KB 的 ArrayBuffer（slab）
Buffer.from('aaaa') → 从这个 slab 里切 [24, 28)
Buffer.from('bbbb') → 从同一个 slab 里切 [32, 36)
                    ↑ 所以 byteOffset 不是 0，且共享同一个 .buffer
```

**大 Buffer 不池化**：

```js
const big = Buffer.allocUnsafe(5000);
console.log(big.byteOffset);            // 0
console.log(big.buffer !== x.buffer);   // true  ← 独立分配
```

> `5000 > Buffer.poolSize / 2`（8192/2 = 4096），所以单独分配。

**这个机制会咬人的地方**：

```js
// ❌ 错误：直接用 buf.buffer 传给需要 ArrayBuffer 的 API
someAPI(buf.buffer);
// → 传过去的是整个 8KB slab，包含别人的数据！

// ✅ 正确：带 offset 和 length
someAPI(buf.buffer, buf.byteOffset, buf.byteLength);

// ✅ 或者直接传 buf（Buffer 本身就是 Uint8Array 视图）
someAPI(buf);
```

> **面试时的说法**：
> 「Buffer 有个 slab 池化机制：小于 4KB 的 Buffer 从共享的 8KB slab 里切，所以 `byteOffset` 不是 0，多个 Buffer 共享同一个 `.buffer`。**如果代码里直接用了 `buf.buffer`，就会拿到整个 slab——既浪费又有信息泄露风险。**正确的做法是带上 `byteOffset` 和 `byteLength`，或者干脆把 `buf` 本身传出去。」

### `subarray` 共享内存

```js
const base = Buffer.from('ABCDEFG');
const sub = base.subarray(1, 4);   // "BCD"

console.log(sub.buffer === base.buffer);   // true  ← 共享
sub[0] = 0x7A;                             // 'z'
console.log(base.toString());              // "AzCDEFG"  ← 原 Buffer 被改了！
```

**`subarray` 是视图，不是拷贝。** 要真正的拷贝用 `Buffer.from(base.subarray(...))`。

> 注意：`buf.slice()` 在 Node 7 之前是共享内存，**Node 7 之后改成和 `subarray` 一样共享**，现在**`slice` 已废弃**，统一用 `subarray`。

### 编码：最实用的部分

```js
Buffer.from('中文', 'utf8').length          // 6   （3 字节/汉字）
Buffer.from('中文', 'utf16le').length       // 4   （2 字节/汉字）
Buffer.from('中文', 'base64')              // 从 base64 解码
buf.toString('hex')                        // 'e4b8ade69687'
buf.toString('base64')                     // '5Lit5paH'
```

**常用编码**：

| 编码 | 用途 |
|---|---|
| `utf8` | 默认，最常用 |
| `hex` | 调试、哈希值展示 |
| `base64` | 传输二进制（图片、JWT payload） |
| `base64url` | URL 安全版（`+/` 换成 `-_`，JWT 用这个） |
| `latin1` / `binary` | 单字节，处理老协议 |
| `utf16le` | Windows 相关 |

**实测**：

```
'中文' UTF-8: 6 字节，hex = e4b8ade69687
截断前 4 字节再 toString() → "中\ufffd"
```

### 实测：常用操作

```js
Buffer.concat([Buffer.from('ab'), Buffer.from('cd')]).toString()   // "abcd"
Buffer.compare(Buffer.from('a'), Buffer.from('b'))                 // -1（a < b）
Buffer.from('ab').equals(Buffer.from('ab'))                        // true
Buffer.from('hello world').indexOf('world')                        // 6
```

**注意 `Buffer.compare` 和 `localeCompare` 不同**——它比的是**字节序**，不是字典序。所以 `Buffer.compare(Buffer.from('Z'), Buffer.from('a'))` 返回 **-1**（'Z'=90 < 'a'=97）。

**`JSON.stringify(Buffer)` 会变成什么**（实测）：

```js
JSON.stringify({ data: Buffer.from('hi') })
// → '{"data":{"type":"Buffer","data":[104,105]}}'
```

**不是字符串，是一个对象。** 所以把含 Buffer 的对象传给前端时要显式 `toString()` 或 `toJSON()`。

### 追问链

| 追问 | 答法 |
|---|---|
| Buffer 和 Uint8Array 区别？ | Buffer **是** Uint8Array 的子类，多了编码转换方法（`toString(encoding)`、`write`）、`Buffer.concat` 等。**Uint8Array 是标准，Buffer 是 Node 扩展** |
| Buffer 到底在不在堆里？ | 在 V8 **堆外**（外部内存）。`process.memoryUsage().external` 和 `arrayBuffers` 反映的就是这部分 |
| 怎么判断内存泄漏是 Buffer 引起的？ | `heapUsed` 平稳但 `external`/`arrayBuffers` 持续涨 → Buffer 泄漏（常见于没释放的流、`subarray` 持有大 Buffer 引用） |
| 为什么 `subarray` 的小片段会阻止整个 Buffer 释放？ | 因为它共享 `ArrayBuffer`。**一个大 Buffer 的 100 字节子视图，会让整个大 Buffer 无法回收**。要长期持有就 `Buffer.from(sub)` 拷贝一份 |
| `buf.length` 和 `buf.byteLength` 区别？ | 对 Buffer 来说相等（因为每个元素 1 字节）。但 Buffer 作为 TypedArray，`byteLength` 是标准属性 |
| 怎么处理 TCP 粘包？ | 需要协议层解决：① 定长；② 分隔符（`\r\n`）；③ **长度前缀**（先读 4 字节长度，再读那么多）。Buffer 只提供字节操作，粘包是协议问题 |

> **最后一条（粘包）很值钱**。很多人以为 Stream/Buffer 会帮他处理粘包——**不会**。`data` 事件收到的 chunk 边界是随机的。

---

## 4.4 fs 模块

### 一句话结论

> fs 有**三套 API**：同步（`*Sync`）、回调（`cb`）、Promise（`fs/promises`）。**新代码一律用 Promise 版。**

### 实测：三套 API 的写法

```js
// ① 同步 —— 阻塞事件循环
const data = fs.readFileSync('a.txt', 'utf8');

// ② 回调 —— 不阻塞，但回调地狱
fs.readFile('a.txt', 'utf8', (err, data) => { ... });

// ③ Promise —— 推荐
const { readFile } = require('node:fs/promises');
const data = await readFile('a.txt', 'utf8');
```

> **细节**：`require('fs').promises` 和 `require('fs/promises')` 是同一个对象，但**推荐用 `node:fs/promises`**（带 `node:` 前缀更明确，且不会被 `node_modules` 里的同名包劫持）。

### 什么时候该用同步版

题单暗示「同步不好，异步好」——**这不完全对**。同步 API 有它的合理场景：

| 场景 | 用同步 | 为什么 |
|---|---|---|
| **启动时读配置** | ✅ `readFileSync` | 还没开始服务，阻塞一下无所谓，代码更简单 |
| **CLI 工具** | ✅ 同步 | 单次执行，简单直接 |
| **脚本/构建工具** | ✅ 同步 | 不需要高并发 |
| **HTTP 请求处理中** | ❌ **绝对不用** | 会阻塞整个事件循环，所有请求都卡住 |
| **循环里读多个文件** | ❌ 用 `Promise.all` | 同步会串行，异步能并行 |

> **这句话能加分**：
> 「同步 API 不是『错误用法』，是『不适合高并发场景』。**判断标准是：这段代码在不在请求路径上？**在请求路径上必须异步；在启动阶段、CLI 工具里，同步反而更清晰。」

### 实测：三种读取方式的内存差异

前面测过 200MB 文件：

| 方式 | 内存 | 说明 |
|---|---|---|
| `readFileSync` | **+200 MB**（等于文件大小） | 整个文件进内存，还阻塞主线程 |
| `readFile(cb)` / `readFile(promise)` | **+200 MB** | 不阻塞了（走线程池），但**还是要整个进内存** |
| `createReadStream` | **+44 MB**（与文件大小无关） | 分块 |

**注意第二行**：`readFile` 只是**把阻塞挪到了线程池**，**没有解决内存问题**。

> 这是很多人搞混的：**「异步」和「流式」是两件事**。
> - `readFile`：异步但不流式 → 大文件会 OOM
> - `createReadStream`：异步且流式 → 内存恒定

### 常用 API 分类

#### 文件读写

```js
readFile / writeFile / appendFile        // 整个文件
createReadStream / createWriteStream     // 流式
copyFile / rename / truncate             // 文件操作
unlink / rm                              // 删除（rm 支持递归 + force）
```

#### 目录

```js
readdir / readdirSync                    // 列目录
mkdir(path, { recursive: true })         // 递归创建
rmdir / rm(path, { recursive: true })    // 递归删除
mkdtemp                                 // 创建临时目录（安全）
opendir                                 // 流式遍历（大目录用）
```

> **`mkdtemp` 值得记住**：创建临时目录时，**不要自己拼随机名**（会有竞态和可预测性问题），用 `fs.mkdtemp(path.join(os.tmpdir(), 'prefix-'))`。

#### 元信息

```js
stat / lstat                             // lstat 不跟随符号链接
access(path, fs.constants.W_OK)          // 检查权限
existsSync                               // ★ 已废弃，用 access 或直接 try/catch
realpath                                 // 解析符号链接
```

> **`existsSync` 已废弃的原因**：它返回 boolean，但**你无法知道「不存在」还是「没权限」**。而且「先检查再操作」本身就有 TOCTOU 竞态（检查完到操作之间文件可能被删）。
>
> **正确做法**：直接操作，捕获 `ENOENT`。

#### 监听

```js
watch(filename, cb)                      // 监听变化（跨平台行为有差异）
watchFile                                // 轮询（慢但兼容好）
```

> **`fs.watch` 的坑**：不同平台事件名和触发次数不同——macOS 上修改一次可能触发两次，Linux 上可能一次都不触发（取决于编辑器怎么写文件）。**生产环境建议用 `chokidar`**，它抹平了平台差异。

#### 文件描述符

```js
open / close / read / write / fsync      // 底层 API
```

> **`fsync` 是什么时候必须的**：`write()` 只是把数据交给 OS 的页缓存，**断电可能丢**。要保证落盘必须 `fsync()`。**这就是数据库为什么慢**——它要保证持久化。

### `node:fs/promises` 的实用组合

```js
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

// 递归遍历目录（比递归 readdir 更安全）
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else console.log(full, (await stat(full)).size);
  }
}
```

**`withFileTypes: true` 很重要**——它让 `readdir` 直接返回 `Dirent` 对象，省掉对每个文件 `stat`（那是 N 次系统调用）。

### 追问链

| 追问 | 答法 |
|---|---|
| `readFile` 能设编码吗？ | 能，`readFile(p, 'utf8')`。不设则返回 Buffer |
| `writeFile` 会覆盖吗？ | 会。**追加用 `appendFile` 或 `createWriteStream({ flags: 'a' })`** |
| 怎么写文件是原子性的？ | 先写临时文件 → `fsync` → `rename` 到目标。**`rename` 在同一分区是原子的**。这是很多配置写入的标准做法 |
| `stat` 和 `lstat` 区别？ | `lstat` 不跟随符号链接（拿到符号链接本身的信息） |
| 怎么读超大目录（100 万文件）？ | `opendir` 流式遍历，或 `readdir` 配合分页。**`readdir` 一次性返回所有文件名会爆内存** |
| 为什么 npm 安装那么慢？ | 大量小文件 I/O + 每个包都要 `stat`/`open`/`read`。**这也是 pnpm 快的原因之一：硬链接避免复制** |

---

## 4.5 面试怎么说（2 分钟版）

### Stream

> 「Stream 存在的唯一理由是**内存**。我实测过处理 200MB 文件：`readFileSync` 的内存增长是 **200MB**（就是文件大小），Stream 只增长 **44MB**，而且**跟文件大小无关**。代价是慢 4 倍左右。
>
> 所以选型标准很明确：**能整个放进内存就用 `readFile`，放不下才用 Stream。** 不是 Stream 更高级。
>
> 核心机制是**背压**：`push()` 和 `write()` 返回 `false` 表示缓冲区满了，`pipe` 收到就 `pause()` 上游，等 `drain` 再 `resume()`。我用「超快生产者 + 超慢消费者」测过，生产量和消费量完全一致，没有积压。
>
> 但生产代码我不用 `pipe`，用 `pipeline`。因为**`pipe` 有个坑：源流出错时不会清理目标流**——我实测过 `pipe` 后目标流的 `destroyed` 还是 `false`，意味着文件写一半、HTTP 连接永远不结束。`pipeline` 会自动 `destroy` 所有流并统一错误。」

### Buffer

> 「Buffer 是定长字节数组，是 Uint8Array 的子类，但分配在 V8 堆外。
>
> 有两个坑必须知道：
>
> **第一是 slab 池化**——小于 4KB 的 Buffer 从共享的 8KB slab 里切，所以 `byteOffset` 不是 0，多个 Buffer 共享同一个 `.buffer`。**如果代码直接用了 `buf.buffer`，拿到的是整个 8KB slab，既浪费又有信息泄露风险。**
>
> **第二是编码边界**——一个汉字 UTF-8 占 3 字节，截断在非 3 的倍数位置就会出现 `\ufffd` 替换字符。Stream 设 `encoding: 'utf8'` 或者用 `StringDecoder` 能解决。
>
> 还有一个排查经验：**`heapUsed` 平稳但 `external`/`arrayBuffers` 持续涨，就是 Buffer 泄漏**——常见于 `subarray` 持有大 Buffer 的引用，导致整个大 Buffer 无法回收。」

### fs

> 「fs 有三套 API：`*Sync`、回调、`fs/promises`。新代码我统一用 `node:fs/promises`。
>
> 关于同步 API，我的判断标准是：**这段代码在不在请求路径上？** 在就必须异步；启动阶段读配置、CLI 工具里，同步反而更清晰。
>
> 有个容易混的点：**「异步」和「流式」是两件事**。`readFile` 是异步的，但它还是把整个文件读进内存——只是把阻塞挪到了线程池。大文件必须用 `createReadStream`，否则内存会按文件大小线性增长。」

---

## 4.6 追问总表（跨题）

| 问题 | 一句话答 |
|---|---|
| Stream 解决什么问题？ | 内存：处理比内存大的数据 |
| 四种 Stream？ | Readable / Writable / Duplex / Transform |
| Duplex 和 Transform 区别？ | 前者读写独立，后者写入后转换再读出 |
| 背压是什么？ | 消费者处理不过来时通知生产者暂停 |
| 背压怎么实现？ | `push`/`write` 返回 false → `pause` → `drain` 事件 → `resume` |
| `highWaterMark` 是什么？ | 内部缓冲区水位线，不是块大小 |
| `pipe` 的缺陷？ | 源流出错不清理目标流 |
| 为什么用 `pipeline`？ | 自动 destroy 所有流 + 统一错误 + 支持 await |
| 按字节切片为什么切坏中文？ | UTF-8 汉字 3 字节，切在中间就断了 |
| 怎么解决？ | 设 `encoding: 'utf8'` 或用 `StringDecoder` |
| Buffer 在哪？ | V8 堆外的外部内存 |
| slab 是什么？ | 8KB 共享内存池，小 Buffer 从里面切 |
| 为什么 `byteOffset` 不是 0？ | 因为从 slab 里切出来的 |
| 直接用 `buf.buffer` 有什么问题？ | 拿到整个 slab，有泄露风险 |
| `subarray` 是拷贝吗？ | 不是，是视图，共享内存 |
| `allocUnsafe` 危险在哪？ | 可能含之前释放的内存数据 |
| fs 三套 API？ | Sync / 回调 / promises |
| 什么时候用同步 API？ | 启动阶段、CLI，不在请求路径上 |
| `readFile` 和 Stream 区别？ | 前者异步但整块进内存；后者流式 |
| `existsSync` 为什么废弃？ | 无法区分「不存在」和「无权限」，且有 TOCTOU 竞态 |
| 怎么写文件是原子的？ | 临时文件 + fsync + rename |

---

## 4.7 速记卡

```
【Stream 实测 200MB 文件】
readFileSync  24ms   RSS +200.4MB（= 文件大小）
Stream       100ms   RSS  +44.4MB（与大小无关）
→ 能放进内存就别用 Stream

【四种 Stream】
Readable  只读（createReadStream / stdin / req）
Writable  只写（createWriteStream / stdout / res）
Duplex    读写独立（net.Socket）
Transform 写入后转换再读出（gzip / cipher）

【背压】
push()/write() 返回 false = 缓冲区满
pipe: pause 上游 → 等 drain → resume
实测：快生产 + 慢消费 → 生产量 == 消费量
highWaterMark 默认 16KB（fs 是 64KB）

★ pipe vs pipeline
pipe 源流出错 → 目标流 destroyed = false（泄漏！）
pipeline → 自动 destroy 全部 + 统一错误
生产代码用 pipeline

【Stream 五个坑】
按字节切片切坏中文 → encoding 或 StringDecoder
链式 pipe 错误不传播
data 事件会让流进 flowing 模式
Stream 单次消费（pipe 两次是分片不是复制）
end ≠ finish

【Buffer】
是 Uint8Array 子类，在 V8 堆外
alloc 清零 / allocUnsafe 不清零（可能含旧数据）

★ slab 池化
< 4KB 从共享 8KB slab 切
实测 byteOffset 24 / 32，x.buffer === y.buffer → true
> 4KB 单独分配（byteOffset = 0）
★ 别直接用 buf.buffer（拿到整个 slab）
→ 带 byteOffset/byteLength，或直接传 buf

subarray 是视图不是拷贝（改它会改原 Buffer）
slice 已废弃

★ 编码
'中文' = 6 字节，hex e4b8ade69687
截 4 字节 → "中\ufffd"
StringDecoder 能把半个字符留到下一块
JSON.stringify(Buffer) → {"type":"Buffer","data":[...]}

排查：heapUsed 平 / external 涨 = Buffer 泄漏
subarray 小片段会阻止整个大 Buffer 回收

【fs】
三套 API：*Sync / 回调 / node:fs/promises（推荐）
同步 API 判断标准：在不在请求路径上
★ 「异步」≠「流式」：readFile 异步但仍占整个文件内存
readdir withFileTypes: true → 省掉 N 次 stat
existsSync 废弃：无法区分不存在/无权限 + TOCTOU
原子写：临时文件 → fsync → rename
fs.watch 跨平台差异大 → 用 chokidar
```

---

## 4.8 自测

```
□ 能说出 Stream 的核心价值是什么（一句话）
□ 能背出 200MB 文件两种方式的内存数据
□ 能说出四种 Stream 的区别，Duplex 与 Transform 的差别
□ 能解释背压的完整机制（push 返回 false → pause → drain → resume）
□ 能说出 highWaterMark 是缓冲区水位线而不是块大小
□ 能说出 pipe 的缺陷并给出实测证据
□ 能说出 pipeline 相比 pipe 的三个优势
□ 能解释按字节切片为什么会切坏中文、两种解法
□ 能说出 Buffer 在哪里分配内存
□ 能解释 slab 池化导致 byteOffset 不为 0
□ 能说出直接使用 buf.buffer 的风险
□ 能说出 subarray 是视图不是拷贝
□ 能说出 allocUnsafe 的风险
□ 能说出「heapUsed 平但 external 涨」意味着什么
□ 能说出 fs 的三套 API 及推荐用法
□ 能说出什么时候该用同步 API
□ 能解释「异步」和「流式」是两件事
□ 能说出 existsSync 为什么废弃
□ 能说出原子写文件的做法
□ 能说出 TCP 粘包为什么不是 Buffer 的问题
```
