# 性能 · 05 图片与资源优化：懒加载

> 覆盖题号：**13、15**
> 对应原题：《懒加载是什么，有什么用》《图片优化的方案有哪些》
> 图片通常占页面**总字节的 60%~70%**，是性价比最高的优化对象。这一册把图片从"格式、尺寸、加载时机、优先级、占位"五个维度讲全。

---

## 目录

- [1. 懒加载](#1-懒加载)
- [2. 图片懒加载的三种实现](#2-图片懒加载的三种实现)
- [3. 懒加载的边界：什么该懒、什么绝对不能懒](#3-懒加载的边界什么该懒什么绝对不能懒)
- [4. 图片格式选择（核心）](#4-图片格式选择核心)
- [5. 响应式图片：srcset / sizes / picture](#5-响应式图片srcset--sizes--picture)
- [6. CDN 图片处理](#6-cdn-图片处理)
- [7. 占位与渐进加载](#7-占位与渐进加载)
- [8. 图标方案怎么选](#8-图标方案怎么选)
- [9. 图片优化的完整清单（可直接抄）](#9-图片优化的完整清单可直接抄)
- [10. 视频与字体资源优化](#10-视频与字体资源优化)
- [11. 常见坑](#11-常见坑)
- [12. 答题模板](#12-答题模板)
- [13. 追问表](#13-追问表)
- [14. 速记卡](#14-速记卡)

---

## 1. 懒加载

### 1.1 一句话结论

**懒加载 = 把"现在不需要的资源"推迟到"真正需要时"再加载。** 对图片是"进入视口才下载"，对组件是"路由/交互触发才 import"。

### 1.2 解决什么问题（四个收益）

| 收益 | 说明 |
|---|---|
| **减少首屏字节** | 首屏只加载首屏图，长页面的下方图片全部延后 |
| **加快首屏渲染** | 带宽不被无关图片抢占，LCP 图下载更快 |
| **节省用户流量** | 用户可能根本不往下滚，那些图不用下 |
| **节省服务器成本** | CDN 流量显著下降（大站能省几十万/月） |

**一个具体数字**：一个 50 张图的商品列表页，首屏只加载 6 张，首屏字节从 8MB 降到 900KB，LCP 从 5.2s 降到 1.9s。

### 1.3 懒加载的三种"层次"（答题要有层次感）

| 层次 | 对象 | 手段 |
|---|---|---|
| **资源级** | 图片、视频、iframe | `loading="lazy"` / IntersectionObserver |
| **模块级** | 路由、组件、第三方库 | `import()` 动态导入 |
| **数据级** | 列表数据、分页 | 分页 / 无限滚动 / 虚拟列表 |

> 面试时先说这三个层次，再挑一个展开，比只讲"图片懒加载"完整得多。

---

## 2. 图片懒加载的三种实现

### 2.1 方案一：原生 `loading="lazy"`（最省事）

```html
<img src="/photo.webp" loading="lazy" width="800" height="600" alt="...">
<iframe src="..." loading="lazy"></iframe>
```

**浏览器行为**：Chrome 会在图片距离视口约 1250px（4G 网络）时开始加载，具体距离由浏览器根据网络状况决定。

| 优点 | 缺点 |
|---|---|
| 零 JS、零成本 | 阈值不可控（不能自定义 rootMargin） |
| 浏览器可感知网络状况动态调整 | 老浏览器不支持（Safari 16.4 才支持，2023） |
| 不占主线程 | 无法做淡入等过渡效果 |

**⚠️ 绝对不能用的地方**：**首屏 LCP 图**。用了 `loading="lazy"` 会让 LCP 元素延后 1~2s 才被发现，直接劣化 LCP。

### 2.2 方案二：IntersectionObserver（推荐，可控）

```js
// 通用懒加载器：支持自定义提前量、淡入、失败重试
function lazyLoad({ rootMargin = '200px', fade = true } = {}) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        const el = entry.target
        const src = el.dataset.src
        const srcset = el.dataset.srcset

        if (srcset) el.srcset = srcset
        if (src) el.src = src

        if (fade) {
          el.style.opacity = '0'
          el.style.transition = 'opacity .3s'
          el.addEventListener('load', () => { el.style.opacity = '1' }, { once: true })
        }

        // 加载完就取消观察，避免重复触发
        observer.unobserve(el)
      })
    },
    { rootMargin, threshold: 0.01 }
  )

  document.querySelectorAll('img[data-src]').forEach((el) => observer.observe(el))
  return observer
}

lazyLoad({ rootMargin: '300px' })   // 提前 300px 开始加载，减少"滚到才闪"
```

**关键参数：**

| 参数 | 作用 | 建议 |
|---|---|---|
| `rootMargin` | 提前多少距离触发 | `200px~400px`，让图片在滚到前就开始下载 |
| `threshold` | 可见比例阈值 | `0.01` 即可（只要露一点就加载） |
| `root` | 滚动容器 | 默认视口；滚动容器内懒加载要指定 |

### 2.3 方案三：scroll + getBoundingClientRect（老方案，了解即可）

```js
// 不推荐：每次 scroll 都要读 getBoundingClientRect，容易触发强制布局
function checkVisible() {
  const imgs = document.querySelectorAll('img[data-src]')
  imgs.forEach((img) => {
    const rect = img.getBoundingClientRect()
    if (rect.top < window.innerHeight + 200) {
      img.src = img.dataset.src
      img.removeAttribute('data-src')
    }
  })
}
window.addEventListener('scroll', throttle(checkVisible, 200))
```

**为什么被淘汰：**

| 问题 | 说明 |
|---|---|
| 强制同步布局 | 每次读 `getBoundingClientRect` 都可能触发布局 |
| 需要手动节流 | 不节流直接卡死 |
| 无法感知容器滚动 | 需要额外处理 |
| 代码量大 | 边界情况多 |

### 2.4 三种方案对比

| | 原生 `loading=lazy` | IntersectionObserver | scroll + rect |
|---|---|---|---|
| 代码量 | 0 | 20 行 | 40 行 |
| 性能 | 最好（浏览器内部实现） | 好（异步回调） | 差（强制布局） |
| 可控性 | 差 | **好** | 好 |
| 兼容性 | Safari 16.4+ | 全现代浏览器 | 全兼容 |
| 推荐度 | 简单场景首选 | **需要控制时首选** | 不推荐 |

> **实战组合**：`<img loading="lazy">` 做兜底 + IntersectionObserver 做增强（淡入、占位、错误重试）。两者不冲突，IntersectionObserver 先触发就自己处理。

### 2.5 一个生产级的 Vue 组件

```vue
<template>
  <div class="lazy-img" :style="{ aspectRatio: ratio }">
    <img
      v-if="shouldLoad"
      :src="src"
      :srcset="srcset"
      :sizes="sizes"
      :alt="alt"
      :width="width"
      :height="height"
      :fetchpriority="priority"
      decoding="async"
      @load="onLoad"
      @error="onError"
      :class="{ loaded }"
    >
    <div v-else class="placeholder" :style="{ background: placeholderColor }"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  src: String,
  srcset: String,
  sizes: String,
  alt: { type: String, default: '' },
  width: [Number, String],
  height: [Number, String],
  ratio: { type: String, default: '16 / 9' },
  priority: { type: String, default: 'auto' },   // 'high' 用于首屏 LCP 图
  placeholderColor: { type: String, default: '#f0f0f0' },
  rootMargin: { type: String, default: '300px' },
})

const emit = defineEmits(['load', 'error'])
const shouldLoad = ref(false)
const loaded = ref(false)
const el = ref(null)
let observer = null

onMounted(() => {
  // 高优先级图（首屏）立即加载，不走懒加载
  if (props.priority === 'high') {
    shouldLoad.value = true
    return
  }
  if (!('IntersectionObserver' in window)) {
    shouldLoad.value = true
    return
  }
  observer = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        shouldLoad.value = true
        observer.disconnect()
      }
    },
    { rootMargin: props.rootMargin }
  )
  observer.observe(el.value)
})

onUnmounted(() => observer?.disconnect())

function onLoad() { loaded.value = true; emit('load') }
function onError(e) { emit('error', e) }
</script>

<style scoped>
.lazy-img { position: relative; overflow: hidden; width: 100%; }
.lazy-img img { width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity .3s; }
.lazy-img img.loaded { opacity: 1; }
.placeholder { width: 100%; height: 100%; }
</style>
```

> 这个组件的三个关键设计：**① `priority="high"` 时跳过懒加载**（首屏图专用）；**② `aspectRatio` 预留空间**（防止 CLS）；**③ `decoding="async"`**（不阻塞主线程解码）。

---

## 3. 懒加载的边界：什么该懒、什么绝对不能懒

| 资源 | 是否懒加载 | 原因 |
|---|---|---|
| 首屏 LCP 图 | ❌ **绝对不懒** | 会延后 LCP 元素发现，劣化 1~2s |
| 首屏轮播图第 2 张之后 | ✅ 可懒 | 但第 1 张要立即加载 |
| 首屏内的头像、图标 | ⚠️ 视情况 | 小图可内联或直接加载 |
| 视口下方的图片 | ✅ 懒 | 主要收益来源 |
| 长列表图片 | ✅ 懒 | 配合虚拟列表 |
| iframe（地图、视频） | ✅ 懒 | iframe 很重，必须懒 |
| 弹窗内的图片 | ✅ 懒（打开弹窗时加载） | — |
| 路由懒加载 | ✅ | 见分册 03 |
| 字体 | ❌ 不懒 | 文本依赖，懒加载会更晚才可读 |
| 关键 CSS | ❌ 不懒 | 见分册 03 |

---

## 4. 图片格式选择（核心）

### 4.1 五种格式对比

| 格式 | 压缩率（相对 JPEG） | 透明 | 动画 | 无损 | 浏览器支持 | 适合 |
|---|---|---|---|---|---|---|
| **JPEG** | 基线 | ❌ | ❌ | 否 | 全 | 照片（老兜底） |
| **PNG** | 大（3~5 倍） | ✅ | ❌ | ✅ | 全 | 需要透明的图、截图（老） |
| **WebP** | **-25%~35%** | ✅ | ✅ | ✅ | 全现代浏览器（含 Safari 14+） | **通用首选** |
| **AVIF** | **-50%**（相对 JPEG） | ✅ | ✅ | ✅ | Chrome 85+、Safari 16.4+、Firefox 93+ | **最优，需兜底** |
| **SVG** | 极小（矢量） | ✅ | ✅ | ✅ | 全 | 图标、logo、图表 |
| GIF | 大 | 支持 1 位 | ✅ | ✅ | 全 | **已淘汰**，用视频/WebP 替代 |

> **一句话结论**：**照片类优先 AVIF，用 WebP 兜底，JPEG 保底；需要透明的图优先 WebP/AVIF；图标用 SVG。**

### 4.2 三层兜底写法

```html
<picture>
  <!-- 第一优先：AVIF，体积最小 -->
  <source type="image/avif" srcset="hero-800.avif 800w, hero-1600.avif 1600w" sizes="100vw">
  <!-- 第二优先：WebP，兼容性好 -->
  <source type="image/webp" srcset="hero-800.webp 800w, hero-1600.webp 1600w" sizes="100vw">
  <!-- 兜底：JPEG -->
  <img src="hero-800.jpg" srcset="hero-800.jpg 800w, hero-1600.jpg 1600w"
       sizes="100vw" width="1600" height="900" alt="首屏主图"
       fetchpriority="high" decoding="async">
</picture>
```

> **注意**：`<picture>` 的 `<source>` 是**按顺序匹配**的，浏览器选第一个支持的 `type`。所以要把**压缩率最好的放前面**。

### 4.3 什么时候用什么格式（决策表）

| 图片内容 | 推荐 |
|---|---|
| 摄影照片（商品图、banner） | **AVIF → WebP → JPEG** |
| 带透明的图形（logo、图标） | **SVG**（如果是矢量源）；否则 WebP/AVIF |
| 截图/文字图 | **WebP/AVIF**（PNG 太大） |
| 简单几何图形 | **SVG**（几 KB 搞定） |
| 渐变/纯色背景 | **CSS 渐变**（0 字节） |
| 需要动画的小图 | **WebP 动图 / 视频（mp4/webm）** |
| 需要放大缩小的图形 | **SVG** |

> **加分点**："能用 CSS 画的绝不用图片"——渐变、圆角、阴影、简单图形都可以纯 CSS，省一个请求和几十 KB。这是很多候选人想不到的。

### 4.4 格式转换怎么做

| 阶段 | 工具 |
|---|---|
| **构建时**（推荐） | `vite-imagetools`、`sharp`、`image-minimizer-webpack-plugin` |
| **上传时** | 后端/OSS 自动转码（阿里云 OSS、腾讯云 COS 支持） |
| **运行时** | CDN 动态转码（`?fm=webp`、`?format=auto`） |
| **手动** | squoosh.app（Google 出的在线工具） |

```js
// vite-imagetools：构建时自动生成多格式多尺寸
import heroAvif from './hero.jpg?w=800;1600&format=avif&as=srcset'
import heroWebp from './hero.jpg?w=800;1600&format=webp&as=srcset'
```

---

## 5. 响应式图片：srcset / sizes / picture

### 5.1 为什么需要

一张 2000×1200 的图，在 375px 宽的手机上显示——浪费了 **96% 的像素**。响应式图的目的是**按设备选合适尺寸**。

### 5.2 `srcset` + `sizes` 的完整写法

```html
<img
  src="photo-800.jpg"
  srcset="photo-400.jpg 400w,
          photo-800.jpg 800w,
          photo-1200.jpg 1200w,
          photo-1600.jpg 1600w"
  sizes="(max-width: 600px) 100vw,
         (max-width: 1200px) 50vw,
         600px"
  width="800" height="500"
  alt="..."
>
```

**两个属性各自的作用：**

| 属性 | 作用 |
|---|---|
| `srcset` + `w` 描述符 | 告诉浏览器**有哪些候选**，各自的**真实宽度** |
| `sizes` | 告诉浏览器**这个图在不同视口下会显示多宽** |

**浏览器选择逻辑：**

```
1. 按 sizes 算出当前视口下的"槽位宽度"（如 375px 手机 → 375px）
2. 乘以 DPR（如 DPR=2 → 750px）
3. 从 srcset 里挑 ≥750px 的最小候选（800w）
```

> **最常见的错误**：只写 `srcset` 不写 `sizes`。此时 `sizes` 默认 `100vw`，浏览器会以为图永远占满屏幕宽度，在桌面端会选过大的图。

### 5.3 `x` 描述符（用于固定尺寸）

```html
<!-- 固定显示的图标：按 DPR 选 -->
<img src="logo.png"
     srcset="logo.png 1x, logo@2x.png 2x, logo@3x.png 3x"
     width="100" height="30" alt="logo">
```

| 描述符 | 用途 |
|---|---|
| `w`（宽度） | 自适应布局（配 `sizes`） |
| `x`（像素密度） | 固定尺寸元素（配 DPR） |

### 5.4 `<picture>` 的两种用途

**用途一：格式兜底**（见 4.2）

**用途二：艺术方向（Art Direction）** —— 不同屏幕裁剪不同内容

```html
<picture>
  <!-- 手机上用竖版裁剪，主体更突出 -->
  <source media="(max-width: 600px)" srcset="hero-portrait.webp">
  <!-- 桌面上用横版 -->
  <source media="(min-width: 601px)" srcset="hero-landscape.webp">
  <img src="hero-landscape.jpg" width="1600" height="900" alt="...">
</picture>
```

### 5.5 响应式图的配套设置

```html
<img
  src="..."
  srcset="..."
  sizes="..."
  width="800" height="500"          <!-- ① 防 CLS：解析时就预留空间 -->
  loading="lazy"                     <!-- ② 非首屏懒加载 -->
  decoding="async"                   <!-- ③ 异步解码，不阻塞主线程 -->
  fetchpriority="high"               <!-- ④ 仅首屏 LCP 图 -->
  alt="..."
>
```

> `decoding="async"` 的价值很多人不知道：图片解码（JPEG → 位图）是 CPU 密集的，同步解码会阻塞主线程导致掉帧。`async` 让浏览器在后台解码。

---

## 6. CDN 图片处理

### 6.1 为什么用 CDN 处理而不是构建时处理

| | 构建时 | CDN 动态 |
|---|---|---|
| 灵活性 | 需要预先定义所有尺寸 | 任意尺寸/格式，URL 参数控制 |
| 存储 | 每种尺寸都要存一份 | 只存原图 |
| 成本 | 存储成本高 | 计算成本（有缓存后很低） |
| 适合 | 图片数量固定、尺寸固定 | 用户上传图、多端复用 |

### 6.2 各家的 URL 参数

```html
<!-- 阿里云 OSS -->
<img src="https://bucket.oss-cn-hangzhou.aliyuncs.com/a.jpg?x-oss-process=image/resize,w_800/format,webp/quality,q_80">

<!-- 腾讯云 COS（数据万象） -->
<img src="https://bucket.cos.ap-guangzhou.myqcloud.com/a.jpg?imageMogr2/thumbnail/800x/format/webp/quality/80">

<!-- Cloudinary -->
<img src="https://res.cloudinary.com/demo/image/upload/w_800,f_auto,q_auto/sample.jpg">

<!-- imgix -->
<img src="https://demo.imgix.net/a.jpg?w=800&auto=format,compress&q=75">
```

> **`f_auto` / `auto=format`** 是自动按 `Accept` 头返回 AVIF/WebP/JPEG 的能力，最省事。面试提到这个是加分项。

### 6.3 CDN 图片处理的最佳实践

| 实践 | 说明 |
|---|---|
| **按展示尺寸的 2 倍出图**（适配 DPR=2） | 别传 4000px 原图给 400px 的容器 |
| **自动格式**（`f_auto`） | 一次配置，全端最优 |
| **质量参数 75~82** | 再高肉眼看不出，体积却翻倍 |
| **WebP/AVIF 有损压缩** | 大部分场景质量足够 |
| **开缓存** | CDN 处理结果也要缓存（`Cache-Control`） |
| **避免"处理参数"污染缓存 key** | 同一张图不同参数会各存一份，注意命中率 |

---

## 7. 占位与渐进加载

### 7.1 四种占位方案

| 方案 | 原理 | 体积 | 效果 |
|---|---|---|---|
| **纯色块** | 取图片主色做背景 | 0 | 简单，体验一般 |
| **LQIP**（低质量图占位） | 20~30px 的模糊小图，base64 内联 | 约 400B~1KB | 好，能看出大致构图 |
| **BlurHash** | 用一段字符串编码模糊图，客户端解码 | 约 30 字节 | 好，极省体积 |
| **SQIP** | SVG 形状占位 | 约 1KB | 有设计感 |
| **骨架屏** | 灰色块 + 微光动画 | 0 | 适合列表、卡片 |

```html
<!-- LQIP：内联 base64 小图 + CSS 模糊 -->
<img src="data:image/jpeg;base64,/9j/4AAQ..." 
     data-src="/hero.webp"
     style="filter: blur(20px); transform: scale(1.1)"
     class="lqip" width="800" height="500" alt="">
```

```js
// BlurHash：服务端存 hash，前端解码成占位
import { decode } from 'blurhash'
const pixels = decode(hash, 32, 32)   // 32×32 的 RGBA
// 画到 canvas 上作为占位
```

### 7.2 渐进式 JPEG（了解即可）

PJPEG（Progressive JPEG）分多次扫描，先出模糊全图再逐层清晰。比基线 JPEG 体验好但体积略大。

**现在一般不用**——用 LQIP + WebP 的组合效果更好且更可控。

---

## 8. 图标方案怎么选

| 方案 | 体积 | 灵活性 | 多色 | 适合 |
|---|---|---|---|---|
| **SVG Symbol Sprite** | 一个 svg 文件，按需引用 | 高（改色/改大小） | ✅ | **图标系统首选** |
| **内联 SVG** | 单图标几 KB | 最高 | ✅ | 少量关键图标 |
| **iconfont** | 一个字体文件（几十 KB） | 中（改色靠 `color`） | ❌ 单色 | 大量单色图标（老方案） |
| **位图雪碧图** | 一张大图 | 低 | ✅ | **基本淘汰**（HTTP/2 后无收益） |
| **PNG 单图** | 每图一个请求 | 低 | ✅ | 不推荐 |

```html
<!-- SVG Symbol 用法 -->
<svg style="display:none">
  <symbol id="icon-search" viewBox="0 0 24 24">
    <path d="M10 2a8 8 0 015.29 13.97l5.37 5.36-1.42 1.42-5.36-5.37A8 8 0 1110 2z"/>
  </symbol>
</svg>

<svg class="icon" width="24" height="24">
  <use href="#icon-search"></use>
</svg>
```

```css
.icon { fill: currentColor; }          /* 自动继承文字颜色 */
```

> **为什么雪碧图不行了**：HTTP/2 多路复用后"减少请求数"不再关键；而雪碧图有三大问题——改一个图标要重新生成整张、无法按需加载、单张图变大。**这是答"图片优化"时能体现时代感的点**（见分册 00 的题单问题 #4）。

---

## 9. 图片优化的完整清单（可直接抄）

按"上传 → 构建 → 运行"三个阶段：

### 9.1 上传/生成阶段

- [ ] 源图分辨率不超过实际展示的 2 倍
- [ ] 统一转 AVIF + WebP
- [ ] 质量参数 75~82
- [ ] 去除 EXIF（省 10~50KB，也保护隐私）
- [ ] 大图生成多个尺寸（400/800/1200/1600）
- [ ] 生成 LQIP / BlurHash 占位数据

### 9.2 构建/引用阶段

- [ ] 用 `<picture>` 做格式兜底，AVIF 优先
- [ ] `srcset` + `sizes` 按设备选尺寸（**别忘了 `sizes`**）
- [ ] 必须写 `width`/`height` 或 `aspect-ratio`（防 CLS）
- [ ] 首屏图 `fetchpriority="high"` + `<link rel="preload">`
- [ ] 非首屏图 `loading="lazy"`（配 IntersectionObserver 增强）
- [ ] `decoding="async"`
- [ ] 小于 2~4KB 的图考虑 base64 内联
- [ ] 能用 CSS 实现的不用图片（渐变/圆角/阴影）
- [ ] 图标用 SVG Symbol

### 9.3 运行/CDN 阶段

- [ ] CDN 开自动格式转换（`f_auto`）
- [ ] CDN 开按需缩放
- [ ] 图片域名单独（避免 cookie，且便于独立缓存策略）
- [ ] `Cache-Control: public, max-age=31536000, immutable`（带 hash 的）
- [ ] 用户上传图用固定 URL → `max-age=86400` + `stale-while-revalidate`

---

## 10. 视频与字体资源优化

### 10.1 视频

| 手段 | 说明 |
|---|---|
| `preload="none"` + `poster` | 不预加载视频，只显示封面图 |
| `playsinline` | iOS 内联播放（不自动全屏） |
| **首帧做 LCP 图** | 用 `poster` 而不是靠视频加载 |
| **HLS / DASH 分片** | 按需加载分片，不下载整个文件 |
| **WebM/AV1** | 比 MP4/H.264 小 30%~50% |
| **短视频代替 GIF** | 一段 3s GIF 可能 5MB，同内容 MP4 只要 200KB |
| `muted` + `autoplay` | 移动端自动播放的前提 |

```html
<video
  src="/demo.webm"
  poster="/demo-poster.webp"
  preload="none"
  playsinline
  muted
  loop
  width="1280" height="720"
></video>
```

### 10.2 字体

| 手段 | 收益 |
|---|---|
| **子集化** | 中文字体 5MB → 200KB（只留用到的字） |
| **`unicode-range` 分片** | 按字符集切片，按需加载 |
| **`font-display: swap/optional`** | 避免白屏/减少 CLS |
| **`preload` + `crossorigin`** | 提前加载首屏字体 |
| **`size-adjust`** | 与系统字体度量对齐，减小切换抖动 |
| **woff2 优先** | 比 woff 小 30% |
| **系统字体优先** | `font-family: system-ui, -apple-system, ...` 零下载 |

---

## 11. 常见坑

| # | 坑 | 后果 | 纠正 |
|---|---|---|---|
| 1 | 首屏 LCP 图加 `loading="lazy"` | LCP 劣化 1~2s | 首屏图不懒 + `fetchpriority=high` |
| 2 | 图片不写 `width/height` | CLS 差（图片加载完顶下去） | 写属性或 `aspect-ratio` |
| 3 | 只写 `srcset` 不写 `sizes` | 桌面端下载过大图 | 配 `sizes` |
| 4 | 所有图都 `loading="lazy"` | 首屏图被延后 | 只给视口下方加 |
| 5 | 用 PNG 存照片 | 体积是 JPEG 的 3~5 倍 | 用 WebP/AVIF |
| 6 | 用 GIF 存动画 | 体积巨大 | 用视频或 WebP 动图 |
| 7 | CDN 图不加质量参数 | 传原图，浪费带宽 | `q=75~82` |
| 8 | 忘了 `decoding="async"` | 大图解码阻塞主线程 | 加上 |
| 9 | `IntersectionObserver` 忘了 `unobserve` | 重复触发、内存泄漏 | 加载后立即 disconnect/unobserve |
| 10 | base64 内联大图 | HTML 膨胀、无法缓存 | 只内联 < 2~4KB |
| 11 | 雪碧图用在 HTTP/2 站点 | 无收益还有维护成本 | 用 SVG Symbol |
| 12 | 图片域名带 cookie | 每个请求多带 cookie 头 | 图片域名独立、无 cookie |
| 13 | `object-fit` 忘了写导致拉伸 | 视觉变形 | `object-fit: cover` |
| 14 | 懒加载容器内滚动不生效 | root 没指定 | `root: 滚动容器` |

---

## 12. 答题模板

### 12.1 「懒加载是什么，有什么用」——30 秒

> "懒加载是把当前不需要的资源推迟到需要时再加载。分三个层次：资源级比如图片进入视口才下载、模块级比如路由 `import()` 动态导入、数据级比如分页和虚拟列表。收益是减少首屏字节、加快首屏、省用户流量和 CDN 成本。图片实现上现在首选原生 `loading=lazy`，需要控制提前量或做淡入就用 IntersectionObserver。**但首屏 LCP 图绝对不能懒加载**。"

### 12.2 「懒加载」——2 分钟

> "懒加载本质是'把加载时机从页面打开推迟到真正需要'，我一般按三个层次讲。
>
> **资源级**最常见的是图片。有两种实现：原生 `loading=lazy` 零代码，浏览器会根据网络状况自动决定提前多少距离开始加载，缺点是不能控制阈值；需要控制就用 IntersectionObserver，设 `rootMargin` 提前 200 到 400 像素开始下载，加载完取消观察。老方案是 scroll 加 `getBoundingClientRect`，但它每次都读布局属性会强制同步布局，已经不推荐了。
>
> **模块级**是路由和组件，用 `import()` 动态导入，配合 prefetch 预取，避免把等待转移到路由切换。
>
> **数据级**是分页、无限滚动、虚拟列表。
>
> 最重要的一个边界是：**首屏 LCP 图不能懒加载**。因为浏览器会等布局完成才判断是否在视口内，这会把 LCP 元素发现时间推后一到两秒，反而把首屏指标做坏了。首屏图应该是 `fetchpriority=high` 加 preload。
>
> 实现细节上还要注意三点：容器内滚动要指定 `root`；加载完要 `unobserve` 否则重复触发；图片要有占位尺寸，不然懒加载会把 CLS 做差。"

### 12.3 「图片优化方案」——30 秒

> "五个维度：**格式**用 AVIF 优先、WebP 兜底、JPEG 保底，图标用 SVG；**尺寸**用 `srcset` + `sizes` 按设备选，源图不超过展示尺寸的两倍；**加载时机**非首屏懒加载、首屏 `fetchpriority=high` + preload；**占位**用 LQIP 或 BlurHash 加 `aspect-ratio` 防抖动；**处理**交给 CDN 做自动格式转换和按需缩放。"

### 12.4 「图片优化方案」——2 分钟

> "我按五个维度讲，每个维度给一个最有代表性的手段。
>
> **第一是格式。** 现在 AVIF 比 JPEG 小一半左右，WebP 小三成，所以最优解是 `<picture>` 三层兜底：AVIF 放第一个、WebP 第二、JPEG 的 `img` 兜底。浏览器按顺序匹配它支持的 type。另外图标一定用 SVG，能用 CSS 画的（渐变、圆角、阴影）就别用图片。
>
> **第二是尺寸。** 一张 2000 像素的图在 375 的手机上显示，浪费了 96% 的像素。用 `srcset` 给多个候选、`sizes` 告诉浏览器显示宽度，浏览器会按 DPR 自动选。这里最常见的错误是只写 `srcset` 不写 `sizes`，那浏览器会以为图永远占满屏幕，桌面端就下载了过大的图。
>
> **第三是加载时机。** 视口下方的图懒加载，首屏图绝对不能懒，要 `fetchpriority=high` 加 preload。
>
> **第四是占位。** 图片必须写 `width` 和 `height` 或者 `aspect-ratio`，否则加载完会把下面内容顶下去，CLS 直接爆。更进一步可以加 LQIP 或 BlurHash 做模糊占位。
>
> **第五是处理链路。** 交给 CDN 做 `f_auto` 自动格式和按需缩放，质量参数 75 到 82，上传时就转好格式、去掉 EXIF、生成多尺寸。
>
> 最后补一句：所有这些的前提是**别让首屏图被懒加载**，这是最常见的自伤操作。"

---

## 13. 追问表

| # | 追问 | 要点 |
|---|---|---|
| 1 | 首屏图能懒加载吗？ | 不能。会延后 LCP 元素发现，劣化 1~2s |
| 2 | `loading="lazy"` 的触发距离是多少？ | Chrome 约 1250px（4G），浏览器按网络状况动态调整，不可控 |
| 3 | IntersectionObserver 有什么优势？ | 异步回调、不触发同步布局、可设 rootMargin/root |
| 4 | 懒加载会导致 CLS 吗？ | 会，如果没预留尺寸；必须写 `width/height` 或 `aspect-ratio` |
| 5 | `srcset` 的 `w` 和 `x` 区别？ | `w` 用于自适应（配 `sizes`）；`x` 用于固定尺寸（配 DPR） |
| 6 | 只写 `srcset` 不写 `sizes` 会怎样？ | `sizes` 默认 `100vw`，桌面端会选过大图 |
| 7 | AVIF 兼容性怎么办？ | `<picture>` 三层兜底；或 CDN `f_auto` 按 Accept 返回 |
| 8 | WebP 比 JPEG 小多少？ | 约 25%~35%（同等质量） |
| 9 | AVIF 比 JPEG 小多少？ | 约 50%，但编码慢、部分老设备解码慢 |
| 10 | 为什么 GIF 该淘汰？ | 体积巨大、只有 1 位透明；用视频/WebP 动图替代 |
| 11 | 雪碧图还有用吗？ | HTTP/2 下基本无用；仅精灵动画场景 |
| 12 | base64 内联的阈值？ | 2~4KB；再大就得不偿失（HTML 膨胀、无法缓存） |
| 13 | `decoding="async"` 有什么用？ | 异步解码，避免大图解码阻塞主线程 |
| 14 | 图片怎么做缓存？ | 带 hash → `immutable` 长缓存；用户上传图 → 短缓存 + SWR |
| 15 | 图片域名为什么要独立？ | 避免带 cookie、便于独立缓存与并发策略 |
| 16 | LQIP 和 BlurHash 区别？ | LQIP 是模糊小图（约 1KB）；BlurHash 是几十字节的编码串，客户端解码 |
| 17 | 视频怎么优化？ | `preload=none` + poster + 分片（HLS）+ WebM/AV1；GIF 换视频 |
| 18 | 中文字体怎么优化？ | 子集化 + `unicode-range` 分片 + `font-display: swap` + preload |
| 19 | 图片压缩会失真吗？ | 会，但质量 75~82 肉眼几乎看不出；AVIF/WebP 同质量下体积更小 |
| 20 | 怎么量化图片优化的收益？ | 首屏字节数、LCP、CDN 流量成本、移动端流量消耗 |

---

## 14. 速记卡

```
【懒加载三层】
资源级（图片/iframe）｜模块级（import()）｜数据级（分页/虚拟列表）

【三种实现】
loading="lazy"       零代码，阈值不可控
IntersectionObserver 可控（rootMargin 200~400px），推荐
scroll + rect        已淘汰（强制同步布局）

【绝对不懒】
首屏 LCP 图 / 字体 / 关键 CSS
首屏图 = fetchpriority=high + preload + 不 lazy

【格式】
AVIF（-50%）> WebP（-30%）> JPEG
<picture> 三层兜底：AVIF → WebP → JPEG
图标用 SVG；能用 CSS 画的别用图

【尺寸】
srcset + sizes 必须成对；w 配 sizes，x 配 DPR
源图 ≤ 展示尺寸 × 2

【防抖三件套】
width/height（或 aspect-ratio）→ 防 CLS
decoding="async"                → 不阻塞解码
loading="lazy"                  → 非首屏

【占位】
纯色 / LQIP（~1KB）/ BlurHash（~30B）/ 骨架屏

【CDN】
f_auto 自动格式 + 按需缩放 + q=75~82 + 开缓存
```
