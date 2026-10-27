# Node 04｜Stream、Buffer 与 fs

> 覆盖题号：12（Stream）、13（Buffer）、14（fs 模块）
> 去重后：**3 个考点**

---

## 目录

- [4.1 题单答案的问题](#41-题单答案的问题)
- [4.2 Stream](#42-stream)
- [4.3 Buffer](#43-buffer)
- [4.4 fs 模块](#44-fs-模块)
- [4.5 面试怎么说（2 分钟版）](#45-面试怎么说2-分钟版)
- [4.6 追问总表（跨题）](#46-追问总表跨题)
- [4.7 速记卡](#47-速记卡)
- [4.8 自测](#48-自测)

---

## 4.1 题单答案的问题

题单三条答案的骨架是：Stream = 四种类型 + `pipe`；Buffer = V8 堆外的定长字节数组、可与 String 互转；fs = 同步与异步两套 API 加一张方法清单。分类都对，缺的是每一块的失效场景：

| 题 | 题单缺的关键点 |
|---|---|
| 12 Stream | 背压是什么、`pipe` 为什么不够、`pipeline` 好在哪 |
| 13 Buffer | slab 池化导致 `byteOffset` 不为 0、按字节切片会切坏中文 |
| 14 fs | 同步 API 什么时候反而更合适、`fs/promises`、`readFile` 的内存问题 |

---

## 4.2 Stream

### 一句话结论：Stream

> 解决的是**内存上限**：能处理比内存大的数据。机制是分块 + 背压，不解决速度问题。

### 实测：200 MB 文件

| 方式 | 耗时 | RSS 增长 |
|---|---|---|
| `fs.readFileSync` 一次性读入 | 21 ms | **+200.5 MB** |
| `createReadStream` 64 KB 一块读 | 55 ms | **+43.0 MB** |

- `readFileSync` 的 `external` 增长正好 200.0 MB，等于文件字节数：文件多大就占多少内存。
- 流式读取的 RSS 增长与文件大小无关，43 MB 来自流内部缓冲与尚未回收的对象。
- 代价是分块与调度开销：此例慢约 2.6 倍（21 ms → 55 ms）。
- 选型：能整个放进内存就用 `readFile`，放不下才用 Stream。

### 四种 Stream

| 类型 | 说明 | 典型实例 |
|---|---|---|
| **Readable** | 只读 | `fs.createReadStream`、`process.stdin`、`http.IncomingMessage` |
| **Writable** | 只写 | `fs.createWriteStream`、`process.stdout`、`http.ServerResponse` |
| **Duplex** | 可读可写，**两端独立** | `net.Socket`（读到的不是自己写进去的） |
| **Transform** | 可读可写，**写入后转换再读出** | `zlib.createGzip`、`crypto.createCipheriv` |

区别一句话：Duplex 的读写是两条独立通道，Transform 的读端产出由写端输入决定。

### 背压（backpressure）

消费者处理不过来时，要能通知生产者慢一点。没有它，缓冲区会按生产速度无上限增长直到 OOM。

#### 实测：超快生产者 + 超慢消费者

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
    setTimeout(cb, 2); // 每块耗时 2ms
  },
});

fast.pipe(slow);
```

实测结果：

```
生产 1.58 MB / 消费 1.58 MB，read() 101 次，耗时 233ms
```

生产量等于消费量：生产者没有跑在消费者前面。

#### 机制：返回值驱动的流控

```
① read() 里 push() 超过 highWaterMark → 返回 false
② pipe 收到 false → pause() 源流，停止调用 read()
③ writable 的 write() 超过 highWaterMark → 返回 false
④ 缓冲区排空 → 触发 'drain' → resume() 上游，继续写
```

写端的返回值可以直接观察：`highWaterMark = 16 KB` 时同步连写 16 KB 块，**第 1 次 `write()` 就返回 `false`，此时 `writableLength = 16384`**；`'drain'` 触发后 `writableLength` 归 0。

> 背压不是「限速」，而是用返回值表达「缓冲区满了」，由 `pipe` 翻译成 `pause` / `resume`。

#### `highWaterMark` 是什么

它是**内部缓冲区的阈值**，不是「一次读多少」。Node 22 实测的默认值：

| Stream | 默认 `highWaterMark` |
|---|---|
| 普通 `Readable` / `Writable` | 64 KB |
| `fs.createReadStream` / `createWriteStream` | 64 KB |
| `zlib` 的流（读写两端） | 64 KB |

`fs.createReadStream` 的 `highWaterMark` 同时决定每次 `read()` 的字节数，但概念仍是水位线。调大减少系统调用次数，适合大量小数据；调小减少内存占用，适合消费者慢、内存紧张。

### `pipe` 的错误处理缺陷

```js
const r = new Readable({ read() { this.destroy(new Error('源流炸了')); } });
const w = new Writable({ write(c, e, cb) { cb(); } });
r.on('error', () => console.log('源流 error 被监听'));
r.pipe(w);
```

实测：

```
[pipe] 源流 error 被监听: 源流炸了
[pipe] 目标流 destroyed = false
```

源流出错后**目标流不会被关闭**：文件写一半停住、HTTP 响应连接不结束、缓冲区不释放。`pipeline` 把错误收拢到一个回调，并销毁链上所有流：

```js
await pipeline(r, w); // 出错 → destroy 全部 → 只抛一次
```

```
[pipeline] 回调收到错误: 源流炸了
[pipeline] 目标流 destroyed = true 源流 destroyed = true
```

| 对比 | `pipe` | `pipeline` |
|---|---|---|
| 错误传播 | 只到源流自己的 `error` 事件 | 统一到一个回调 / Promise |
| 出错时清理下游 | 不清理 | 全部 `destroy` |
| 多级中间流 | 每级手动处理 | 自动 |
| API | `src.pipe(dst)` | `pipeline(src, t1, t2, dst, cb)` / `await pipeline(...)` |

### 五个常见坑

#### 坑 1：按字节切片会切坏中文

```js
const cn = Buffer.from('中文'); // 6 字节：e4b8ad e69687
const cut = cn.subarray(0, 4);
console.log(cut.toString()); // "中\ufffd"  ← 出现替换字符
```

一个汉字在 UTF-8 里占 **3 字节**，截断在第 4 字节等于把第二个字符切了一半。

**正确做法**：

```js
// 方案 A：设 encoding，让 Stream 自己处理边界
fs.createReadStream(file, { encoding: 'utf8' });
// Stream 内部用 StringDecoder，保证不切断多字节字符

// 方案 B：手动用 StringDecoder
const { StringDecoder } = require('node:string_decoder');
const decoder = new StringDecoder('utf8');
decoder.write(buf1); // 不完整部分留在内部
decoder.write(buf2); // 拼接后一起输出
```

实测 `StringDecoder`：前 4 字节输出 `"中"`，后 2 字节输出 `"文"`。

#### 坑 2：链式 `pipe` 的错误不会传播

`pipe` 返回目标流，可以写成 `readable.pipe(gzip).pipe(writable)`，但链上任何一环出错都不会传到链尾（见上一节实测）。链越长，越要用 `pipeline`。

#### 坑 3：`data` 事件会切到 flowing 模式

```js
stream.on('data', chunk => {...}); // 一旦监听，流自动进入 flowing 模式
```

进入 flowing 模式后如果消费不及时（比如回调里做同步耗时操作），数据会积压在内存里。优先用 `pipe` / `pipeline` 或 `for await...of`。

#### 坑 4：Stream 是单次消费的

```js
stream.pipe(a);
stream.pipe(b); // 数据被两个目标分片消费，不是各拿一份完整拷贝
```

**Stream 不能「一个源、两个独立的消费者」**。要复制数据必须手动分流（把 chunk 分别 push 到两个 PassThrough）。

#### 坑 5：`end` 和 `finish` 不是一回事

| 事件 | 谁触发 | 含义 |
|---|---|---|
| `end` | Readable | 没有更多数据可读了 |
| `finish` | Writable | 所有数据都已交给下游 |
| `close` | 两者 | 流已销毁、资源已释放 |

**顺序**：`readable end` → `writable finish` → `close`。

### 追问链（Stream）

| 追问 | 答法 |
|---|---|
| `objectMode` 是什么？ | 让 Stream 传**任意 JS 对象**而不只是 Buffer / string，适合对象级的处理管道 |
| `pause()` / `resume()` 有什么用？ | 手动控制流动模式，`pipe` 内部就是用这两个实现背压 |
| 什么时候该自己写 Transform？ | 需要「边读边转换」时：日志脱敏、CSV 转 JSON、加解密 |
| 怎么让 Stream 支持进度？ | 在 Transform 里累加 chunk 长度；监听 `data` 计数也可以，但会破坏背压 |
| 怎么把 Stream 转成 Buffer？ | `for await` 收集 chunk 后 `Buffer.concat(chunks)`，注意这会放弃 Stream 的内存优势 |
| 为什么 `for await...of` 能遍历 Stream？ | Stream 实现了 `Symbol.asyncIterator`，这是最现代的消费方式 |

```js
for await (const chunk of fs.createReadStream(file)) {
  process(chunk); // 自动处理背压
}
```

---

## 4.3 Buffer

### 一句话结论：Buffer

> **定长的字节数组**，用来在 JS 里处理二进制数据。它是 `Uint8Array` 的子类，内存分配在 V8 堆外（外部内存）。

### 题单答案需要修正的地方

| 题单说 | 实际情况 |
|---|---|
| 「分配在 V8 堆外」 | 对，但小 Buffer 从共享的 8 KB slab 里切、大 Buffer 单独分配，两者都在 V8 堆外 |
| 「可和 String 互转」 | 必须指定编码；按字节切片会切坏多字节字符（见 4.2 坑 1） |

### 三种创建方式

```js
Buffer.alloc(8)       // 已清零（实测 every(x => x === 0) → true）
Buffer.allocUnsafe(8) // 不保证清零，可能含旧数据
Buffer.from('hello')  // 从字符串，默认 utf8
```

`allocUnsafe` 叫 unsafe 是因为它**复用之前释放的内存**，里面可能有上一个 Buffer 的残留数据，构成信息泄露风险。

本例 `allocUnsafe(8)` 恰好拿到全 0（slab 是新的），**不能依赖这个结果**。

> 规则：确定「马上会被完全覆盖」时用 `allocUnsafe`（快），否则用 `alloc`。

### slab 池化：`byteOffset` 为什么不是 0

```js
const x = Buffer.from('aaaa');
const y = Buffer.from('bbbb');

console.log(x.byteOffset);          // 8   ← 具体数值取决于此前分配，不保证固定
console.log(y.byteOffset);          // 16
console.log(x.buffer === y.buffer); // true  ← 同一个 ArrayBuffer
console.log(x.buffer.byteLength);   // 8192  ← 8KB slab
```

发生了什么：

```
Node 预分配一个 8KB 的 ArrayBuffer（slab）
Buffer.from('aaaa') → 从 slab 里切出一段，byteOffset 不为 0
Buffer.from('bbbb') → 从同一 slab 继续切，共享 x.buffer
```

**大 Buffer 不池化**：

```js
const big = Buffer.allocUnsafe(5000);
console.log(big.byteOffset);          // 0
console.log(big.buffer !== x.buffer); // true  ← 独立分配
```

池化条件是 `size < Buffer.poolSize / 2`（默认 `8192 / 2 = 4096`）；恰好 4096 字节已经单独分配。

**会咬人的地方**：

```js
// ❌ 直接用 buf.buffer：传出去的是整个 8KB slab，含别人的数据
someAPI(buf.buffer);

// ✅ 带 offset 和 length
someAPI(buf.buffer, buf.byteOffset, buf.byteLength);

// ✅ 或者直接传 buf（Buffer 本身就是 Uint8Array 视图）
someAPI(buf);
```

### `subarray` 共享内存

```js
const base = Buffer.from('ABCDEFG');
const sub = base.subarray(1, 4); // "BCD"

console.log(sub.buffer === base.buffer); // true  ← 共享
sub[0] = 0x7a;                           // 'z'
console.log(base.toString());            // "AzCDEFG"  ← 原 Buffer 被改了
```

`subarray` 是视图，不是拷贝；要真正拷贝用 `Buffer.from(base.subarray(...))`。`buf.slice()` 与 `subarray` 一样共享内存，但已废弃，统一用 `subarray`。

### 编码

```js
Buffer.from('中文').length                   // 6（UTF-8 每字 3 字节）
Buffer.from('中文', 'utf16le').length        // 4
Buffer.from('5Lit5paH', 'base64').toString() // '中文'
Buffer.from('中文').toString('hex')          // 'e4b8ade69687'
```

| 编码 | 用途 |
|---|---|
| `utf8` | 默认，最常用 |
| `hex` | 调试、哈希值展示 |
| `base64` | 传输二进制（图片、JWT payload） |
| `base64url` | URL 安全版（`+/` 换成 `-_`，JWT 用这个） |
| `latin1` / `binary` | 单字节，处理老协议 |
| `utf16le` | Windows 相关 |

### 常用操作

```js
Buffer.concat([Buffer.from('ab'), Buffer.from('cd')]).toString() // "abcd"
Buffer.compare(Buffer.from('a'), Buffer.from('b'))               // -1（a < b）
Buffer.from('ab').equals(Buffer.from('ab'))                      // true
Buffer.from('hello world').indexOf('world')                      // 6
```

`Buffer.compare` 比的是**字节序**，不是字典序：`Buffer.compare(Buffer.from('Z'), Buffer.from('a'))` 返回 **-1**（'Z' = 90 < 'a' = 97）。

`JSON.stringify(Buffer)` 得到的是对象不是字符串，含 Buffer 的对象传给前端前要显式 `toString()`：

```js
JSON.stringify({ data: Buffer.from('hi') });
// → '{"data":{"type":"Buffer","data":[104,105]}}'
```

### 追问链（Buffer）

| 追问 | 答法 |
|---|---|
| Buffer 和 Uint8Array 区别？ | Buffer **是** Uint8Array 的子类，多了编码转换、`Buffer.concat` 等 Node 扩展 |
| Buffer 到底在不在堆里？ | 在 V8 **堆外**（外部内存），`process.memoryUsage().external` 与 `arrayBuffers` 反映这部分 |
| 怎么判断内存泄漏是 Buffer 引起的？ | `heapUsed` 平稳但 `external` / `arrayBuffers` 持续上涨，常见于没释放的流、`subarray` 持有大 Buffer |
| 为什么 `subarray` 的小片段会阻止整个 Buffer 释放？ | 它共享 `ArrayBuffer`；要长期持有就 `Buffer.from(sub)` 拷贝一份 |
| `buf.length` 和 `buf.byteLength` 区别？ | 对 Buffer 相等（每个元素 1 字节）；`byteLength` 是 TypedArray 的标准属性 |
| 怎么处理 TCP 粘包？ | 协议层解决：定长、分隔符、或长度前缀。`data` 事件收到的 chunk 边界与消息边界无关，Buffer 只提供字节操作 |

---

## 4.4 fs 模块

### 一句话结论：fs

> 三套 API：同步（`*Sync`）、回调、Promise（`fs/promises`）。新代码一律用 Promise 版。

### 三套 API 的写法

```js
// ① 同步 —— 阻塞事件循环
const data = fs.readFileSync('a.txt', 'utf8');

// ② 回调 —— 不阻塞，但要处理回调
fs.readFile('a.txt', 'utf8', (err, data) => { ... });

// ③ Promise —— 推荐
const { readFile } = require('node:fs/promises');
const data = await readFile('a.txt', 'utf8');
```

`require('fs').promises` 与 `require('fs/promises')` 是同一个对象；推荐写成 `node:fs/promises`，`node:` 前缀明确表示这是内置模块。

### 什么时候该用同步版

| 场景 | 用同步 | 原因 |
|---|---|---|
| 启动时读配置 | ✅ `readFileSync` | 还没开始服务，阻塞一下无所谓，代码更简单 |
| CLI 工具 | ✅ 同步 | 单次执行，简单直接 |
| 脚本 / 构建工具 | ✅ 同步 | 不需要高并发 |
| HTTP 请求处理中 | ❌ 不用 | 阻塞整个事件循环，所有请求都卡住 |
| 循环里读多个文件 | ❌ 用 `Promise.all` | 同步会串行，异步能并行 |

判断标准只有一条：**这段代码在不在请求路径上？**

### 三种读取方式的内存差异

| 方式 | 内存 | 阻塞 |
|---|---|---|
| `readFileSync` | ≈ 文件大小 | 阻塞事件循环 |
| `readFile(cb / promise)` | ≈ 文件大小 | 不阻塞（线程池），但仍整份进内存 |
| `createReadStream` | 与文件大小无关 | 不阻塞，分块 |

实测数字见 4.2：200 MB 文件下 `readFileSync` 的 RSS +200.5 MB，`readFile`（Promise）的 RSS +201.9 MB，`createReadStream` 只有 +43.0 MB。

**「异步」和「流式」是两件事**：`readFile` 只是把阻塞挪到了线程池，没有解决内存问题；大文件必须用 `createReadStream`，否则内存按文件大小线性增长。

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

创建临时目录用 `fs.mkdtemp(path.join(os.tmpdir(), 'prefix-'))`，不要自己拼随机名（可预测，且有竞态）。

#### 元信息

```js
stat / lstat                             // lstat 不跟随符号链接
access(path, fs.constants.W_OK)          // 检查权限
existsSync                               // 同步判断是否存在（没废弃，废弃的是 fs.exists()）
realpath                                 // 解析符号链接
```

「先检查再操作」有 TOCTOU 竞态：检查完到操作之间文件可能被删；`existsSync` 返回 boolean 也分不清「不存在」和「没权限」。直接操作并捕获 `ENOENT` 更可靠。

#### 监听

```js
watch(filename, cb)                      // 监听变化（跨平台行为不一致）
watchFile                                // 轮询（慢但兼容好）
```

`fs.watch` 在不同平台的事件名与触发次数不一致，生产环境用 `chokidar` 抹平差异。

#### 文件描述符

```js
open / close / read / write / fsync      // 底层 API
```

`write()` 只是把数据交给 OS 的页缓存，断电可能丢；要保证落盘必须 `fsync()`，这也是数据库写路径的主要开销。

### `node:fs/promises` 的实用组合

```js
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full);
    else console.log(full, (await stat(full)).size);
  }
}
```

`withFileTypes: true` 让 `readdir` 直接返回 `Dirent`，省掉对每个文件再调 `stat`（N 次系统调用）。

### 追问链（fs）

| 追问 | 答法 |
|---|---|
| `readFile` 能设编码吗？ | 能，`readFile(p, 'utf8')`；不设返回 Buffer |
| `writeFile` 会覆盖吗？ | 会。追加用 `appendFile` 或 `createWriteStream({ flags: 'a' })` |
| 怎么写文件是原子性的？ | 先写临时文件 → `fsync` → `rename` 到目标；`rename` 在同一分区是原子的 |
| `stat` 和 `lstat` 区别？ | `lstat` 不跟随符号链接，拿到链接本身的信息 |
| 怎么读超大目录（100 万文件）？ | `opendir` 流式遍历，或 `readdir` 配合分页；`readdir` 一次性返回所有文件名会爆内存 |
| 为什么 npm 安装那么慢？ | 大量小文件 I/O，每个包都要 `stat` / `open` / `read`；pnpm 用硬链接避免复制，所以更快 |

---

## 4.5 面试怎么说（2 分钟版）

- Stream 买的是**内存上限**不是速度：200 MB 文件用 `readFileSync` 的 RSS 增长 200.5 MB，流式只有 43 MB 且与文件大小无关，代价是慢约 2.6 倍。能整份放进内存就用 `readFile`。
- 背压是**返回值驱动的流控**：`push()` / `write()` 超过 `highWaterMark` 返回 `false`，`pipe` 据此暂停上游，等 `'drain'` 再恢复。
- 生产代码用 `pipeline`：`pipe` 在源流出错时不会销毁目标流（实测 `destroyed === false`），`pipeline` 会销毁链上所有流并把错误统一到一个回调 / Promise。
- Buffer 的两个坑：slab 池化让 `byteOffset` 不为 0，直接传 `buf.buffer` 会带出整个 8 KB slab；UTF-8 汉字 3 字节，截在非 3 的倍数处会出现 `\ufffd`，用 `encoding: 'utf8'` 或 `StringDecoder` 解决。
- fs：`readFile` 异步但不流式，大文件仍按文件大小占内存；同步 API 只适合不在请求路径上的启动与 CLI 场景。

---

## 4.6 追问总表（跨题）

| 问题 | 一句话答 |
|---|---|
| Stream 解决什么问题？ | 内存：处理比内存大的数据 |
| 四种 Stream？ | Readable / Writable / Duplex / Transform |
| Duplex 和 Transform 区别？ | 前者读写独立，后者写入后转换再读出 |
| 背压是什么？ | 消费者处理不过来时通知生产者暂停 |
| 背压怎么实现？ | `push` / `write` 返回 `false` → `pause` → `'drain'` → `resume` |
| `highWaterMark` 是什么？ | 内部缓冲区水位线，不是块大小；Node 22 默认 64 KB |
| `pipe` 的缺陷？ | 源流出错时不清理目标流 |
| 为什么用 `pipeline`？ | 自动 destroy 所有流 + 统一错误 + 支持 await |
| 按字节切片为什么切坏中文？ | UTF-8 汉字 3 字节，切在中间就断了 |
| 怎么解决？ | 设 `encoding: 'utf8'` 或用 `StringDecoder` |
| Buffer 在哪分配？ | V8 堆外的外部内存 |
| slab 是什么？ | 8 KB 共享内存池，小于 4 KB 的 Buffer 从里面切 |
| 为什么 `byteOffset` 不是 0？ | 因为切自共享 slab，不是独立分配 |
| 直接用 `buf.buffer` 有什么问题？ | 拿到整个 slab，有信息泄露风险 |
| `subarray` 是拷贝吗？ | 不是，是共享内存的视图 |
| `allocUnsafe` 危险在哪？ | 可能含之前释放的内存数据 |
| fs 三套 API？ | `*Sync` / 回调 / `fs/promises` |
| 什么时候用同步 API？ | 启动阶段、CLI，不在请求路径上 |
| `readFile` 和 Stream 区别？ | 前者异步但整块进内存；后者流式，内存与文件大小无关 |
| 为什么不该先检查再操作？ | 分不清不存在与无权限，且有 TOCTOU 竞态 |
| 怎么写文件是原子的？ | 临时文件 + `fsync` + `rename` |

---

## 4.7 速记卡

```
【Stream vs readFile（200MB 实测）】
readFileSync  21ms   RSS +200.5MB（= 文件大小）
Stream        55ms   RSS  +43.0MB（与文件大小无关）
→ 放不进内存才用 Stream

【四种 Stream】
Readable 只读 / Writable 只写 / Duplex 读写独立 / Transform 写入后转换再读出

【背压】
push()/write() 超过 highWaterMark → false
pipe：pause 上游 → 'drain' → resume
16KB 块 + 16KB HWM：第 1 次 write 返回 false，writableLength = 16384
默认 HWM：Node 22 起 Readable / Writable / fs / zlib 均 64KB

【pipe vs pipeline】
pipe 源流出错 → 目标流 destroyed = false
pipeline → destroy 全部 + 错误统一到回调 / Promise

【Stream 五个坑】
按字节切片切坏中文 → encoding 或 StringDecoder
链式 pipe 错误不传播
data 事件进入 flowing 模式
一个源不能有两个独立消费者（分片，不是复制）
end（读尽）≠ finish（写完）

【Buffer】
Uint8Array 子类，内存在 V8 堆外
alloc 清零 / allocUnsafe 不清零
slab：< Buffer.poolSize/2（4096）从 8KB slab 切，byteOffset ≠ 0
别直接传 buf.buffer（会带出整个 slab）
subarray 是视图；slice 已废弃

【编码】
'中文' = 6 字节，hex e4b8ade69687，base64 5Lit5paH
JSON.stringify(Buffer) → {"type":"Buffer","data":[...]}

【fs】
三套 API：*Sync / 回调 / node:fs/promises（推荐）
同步 API：不在请求路径上才用
readFile 异步但不流式，仍按文件大小占内存
readdir withFileTypes: true → 省掉 N 次 stat
别先 existsSync 再操作（TOCTOU），直接 try/catch 判 ENOENT
原子写：临时文件 → fsync → rename
fs.watch 跨平台不一致 → chokidar
```

---

## 4.8 自测

```
□ 能一句话说清 Stream 的核心价值
□ 能背出 200MB 文件两种读法的内存数据
□ 能说出四种 Stream 的区别，Duplex 与 Transform 的差别
□ 能解释背压的完整机制（push 返回 false → pause → drain → resume）
□ 能说出 highWaterMark 是水位线而不是块大小，以及 Node 22 的默认值
□ 能说出 pipe 的缺陷与 pipeline 的三个优势
□ 能解释按字节切片为什么切坏中文、两种解法
□ 能解释 slab 池化导致 byteOffset 不为 0，以及直接使用 buf.buffer 的风险
□ 能说出 subarray 是视图不是拷贝、allocUnsafe 的风险
□ 能说出「heapUsed 平但 external 涨」意味着什么
□ 能说出 fs 的三套 API 及推荐用法、什么时候该用同步 API
□ 能解释「异步」和「流式」是两件事
□ 能说出先检查再操作的 TOCTOU 问题
□ 能说出原子写文件的做法与 TCP 粘包为什么不是 Buffer 的问题
```
