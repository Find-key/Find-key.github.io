# 项目总述 · Findkey

> **这份文件是本仓库的唯一入口文档。**
> 规则：每次改动（改配置、加页面、调样式、修 bug、踩坑）**都必须在文末「变更日志」追加一条**，
> 并同步更新「当前状态」和「目录结构」。这样三个月后回来不用重新考古。

| 项 | 值 |
| --- | --- |
| 本地路径 | `/home/key/Work/blog` |
| 线上地址 | `https://USERNAME.github.io/blog/`（待填用户名） |
| 技术栈 | Astro 7（静态输出）+ Markdown 内容集合 |
| 组织方式 | **按分类组织**（不是按时间流） |
| 视觉风格 | 纸感简约：暖白底、衬线标题、无衬线正文、等宽小标签、单一强调色（墨绿） |
| 托管 | GitHub Pages，GitHub Actions 自动构建部署 |
| 语言 | 简体中文（`zh-CN`），日期时区 `Asia/Shanghai` |
| 依赖 | Node ≥ 22.23.4，npm |

---

## 1. 这是什么

一个纯静态的个人技术博客：没有后端、没有数据库、没有评论服务、没有统计脚本。
所有文章是 `src/content/blog/` 下的 Markdown 文件，`git push` 到 `main` 后由 GitHub Actions 构建成静态 HTML 并发布。

两条贯穿全站的原则：

1. **分类优先**：文章先归到分类，分类内部再排序。首页、分类页、文章页左侧目录都围绕分类展开；
   标签只是分类之外的横向索引。
2. **正文优先**：页面装饰能删就删。没有封面大图、没有渐变背景、没有卡片阴影、不加载 webfont。

---

## 2. 当前状态

本地已验证可构建、可预览；内容已清空到「可以开始写」的状态。

**页面结构**

- 首页 = hero（圆形头像 + 名字 + 一句题记 + 一行十六进制 dump + 联系方式）+「文章」分类列表
  - 分类双栏排列，每类最多列 3 篇（标题 / 日期），超过 3 篇给「全部 N 篇 →」
  - 空分类显示「还没有文章」，不可点（不生成分类页）；分组数为奇数时最后一格横跨两栏
- `/categories/<slug>`：面包屑「首页 / 分类名」+ 该分类全部文章 + 「← 返回首页」
- `/posts` **归档**：按年份倒序的紧凑列表（标题 + 日期），和首页的分类视图互补
- 文章页：面包屑 → 标题 / 日期 / 约读时长 / 标签 → 左侧**正文目录**（h2/h3，滚动高亮；<900px 变成正文顶部的可折叠目录）→ 正文 → 同分类上下篇
- `/links` 友链、`/tags` 与 `/tags/<tag>`、404、`robots.txt`、`sitemap`

**基础设施**

- [x] Astro 静态站，内容集合 + frontmatter 类型校验，构建时校验分类
- [x] 元信息 / 导航 / 分类 / 友链集中在 `src/consts.ts`；站内链接统一走 `utils/url.ts`
- [x] 站头：左字标 `Findkey’s Blog` + 右「归档 / 友链」；页脚：版权页（归档 / 标签 / 邮箱纯文本 / 署名）
- [x] 草稿机制（`draft`）、`npm run new` 生成文章骨架、`docs/how-to.md` 日常操作
- [x] 本机写作后台 `npm run admin`（零依赖 Node 服务，127.0.0.1:4322）：文章增删改 + 分类增删，改写真实文件；分类变化后自动重启 dev
- [x] Open Graph 分享卡（`public/og.png`）、favicon 三档（svg / 32 png / apple-touch）
- [x] GitHub Actions 部署工作流、base 路径（`/blog`）全链路核对

**内容现状**：17 篇文章、4 个分类、16 条友链（从旧 Hexo 站 `../Saved-blog-doc` 迁入）。

- 分类：`pwn`（6）、`WP`（4）、`V8`（3）、`嵌入式与 IoT`（1）、`工具与笔记`（2）
  - `pwn` 收二进制本身（glibc 堆栈、IO_FILE、ret2dl、调用链、PHP PWN）
  - `WP` 单独收比赛题解（羊城杯、XYCTF、校赛、HGAME）
- 友链：16 条，来自旧站 `source/_data/links.yml`；头像已下载到 `public/friends/`（96px webp，约 50K），防盗链的站点自动退回首字母
- 迁移时统一了 frontmatter（`date`→`pubDate`、`tags` 单串→数组并转小写连字符、`excerpt`→`description`），
  正文若以 `###` 开头则整体提一级标题，保证目录层级从 h2 起

**待用户操作**

- [ ] `src/consts.ts` 里的 `USERNAME` 换成真实 GitHub 用户名（`url`、`github`）
- [ ] 建仓库 `blog` → `git remote add` → `git branch -M main` → push
- [ ] 仓库 Settings → Pages → Source 选 **GitHub Actions**
- [ ] 换头像照片（`public/avatar.svg` 目前是 F 占位）

---

## 3. 技术选型

### 为什么是 Astro

| 候选 | 优点 | 为什么没选 |
| --- | --- | --- |
| **Astro** ✅ | Markdown 内容集合自带 frontmatter 类型校验；默认零 JS；要交互时可按需加 React/Vue/Svelte 组件；官方 Pages 方案成熟 | — |
| Hexo | 中文主题多（NexT/Butterfly），配置即用 | 主题魔改要跟一堆 EJS/pug 插件搏斗；生态偏旧，构建慢 |
| Hugo | 构建最快，单二进制无 Node 依赖 | 要学 Go template 语法；图片处理弱于 Astro |
| Jekyll | Pages 原生支持，不用写 Actions | 本机没有 Ruby；依赖 GitHub 端构建，本地/线上行为不一致，调试困难 |

### 为什么是「项目站」而不是「用户主页站」

- 项目站：仓库名 `blog`，地址 `https://USERNAME.github.io/blog/`，需要 `base: '/blog'`
- 用户主页站：仓库必须叫 `USERNAME.github.io`，地址是根路径，配置简单

选项目站是为了以后能并置别的站点。代价是**所有站内链接必须过 `withBase()`**，见第 10 节 FAQ。

### 为什么文章路由是 `/posts/` 而不是 `/blog/`

站点本身已经在 `/blog` 子路径下，文章路由若也叫 `/blog`，URL 会变成 `/blog/blog/xxx/`。所以：

- 文章详情：`/blog/posts/<文章文件名>/`
- 分类：`/blog/categories/<slug>/`
- 标签：`/blog/tags/<tag>/`

### 为什么不加载 webfont

上一版用 Atkinson 这类拉丁字体，中文只能回落到系统字体，中英混排时字重/字宽不一致，长时间阅读很别扭；
而且 webfont 会带来首屏字体闪烁。现在统一用系统字体栈（苹方 / 思源黑体 / Noto Sans CJK / 雅黑），
零请求、零闪烁，跨平台观感一致。

---

## 4. 视觉规范（改样式前先看这节）

简约不是"少写样式"，而是**只有一套规则**。当前 token 定义在 `src/styles/global.css` 的 `:root`：

| Token | 值 | 用途 |
| --- | --- | --- |
| `--bg` | `#fbf9f5` | 全站唯一背景色（暖白"纸"色，页头/正文/页脚都是它） |
| `--bg-raised` | `#ffffff` | 卡片等"压在纸上"的层（实际用 55% 白叠加） |
| `--text` | `#1c1a17` | 正文（暖黑，不是纯黑） |
| `--muted` | `#736d64` | 次要文字：日期、描述、页脚 |
| `--line` | `#e7e2d8` | 发丝分隔线（列表、表格、页脚上边框） |
| `--line-strong` | `#d6cfc2` | 需要稍强的分隔 |
| `--accent` | `#1f6f5c` | 墨绿：链接、当前位置、悬停，全站只用一个强调色 |
| `--code-bg` | `#f2eee6` | 行内代码与代码块底色（比纸色略深，仍是浅色） |

字体三件套（都不加载 webfont）：

| 变量 | 用途 | 栈 |
| --- | --- | --- |
| `--font-serif` | 标题、站点名、文章列表标题 | Iowan Old Style / Palatino / Songti SC / Noto Serif CJK SC / Georgia |
| `--font-sans` | 正文、导航、说明文字 | system-ui / Noto Sans CJK SC / 苹方 / 雅黑 |
| `--font-mono` | 小标签、日期、面包屑、标签云 | ui-monospace / SF Mono / Menlo / Consolas |

排版基准：

- 正文 17px / 行高 1.9 / 字距 0.008em，正文列宽 `--content-width: 700px`（中文约 40 字/行）
- 页面主栏 `--page-width: 1000px`（左右各 20px padding → 实际内容区 960px）。页头、列表页、文章页都对齐这一条竖线：
  文章页 = 侧栏 208 + 间距 48 + 正文 704 = 960
- 段间距 1.6em（**必须明显大于行距**，否则整篇像一堵墙；行距 1.9 × 17px ≈ 32px）
- 标题：h1（页面/文章）1.9–2.05rem，h2 1.3–1.4rem，全部衬线、字重 600；首页没有独立 h1，站头字标就是 h1
- 小标签用 `.label`（等宽、0.72rem、字距 0.14em、大写）——印刷品小字的感觉
- 站头（58px，sticky，纸色半透明 + 模糊，底部 1px 分隔线）：
  - 左：**字标**（首页渲染为 `<h1>`，保证每页只有一个 h1；内页是普通链接）
  - 右：两项链接「归档 / 友链」，当前栏目加 1px 墨绿短下划线（首页本身就是分类目录，所以「分类」不放导航，放在版权页）
  - 首页**没有居中大名字**——名字就是左上那个字标
- 首页结构（参考 paco.me / arp242.net）：
  - 顶部 hero（参考 baozongwi 的 hero 结构）：**圆形头像 96px（手机 64）在左**，右边竖排 `名字（衬线 2.25rem）→ 一句题记（衬线 1.06rem + 行末 mono 署名，`SITE.quote`）→ 一行十六进制 dump → 图标行（邮箱 / RSS / GitHub，GitHub 是占位符时不显示）`
  - 那行 dump 由 `hexdump()` 在构建时生成（0.72rem 等宽、50% 墨色、窄屏隐藏），内容是 `pwn@findkey:~>`——ASCII 列是一个 shell 提示符，读得懂的人会心一笑，读不懂只是一层纹理
  - 改 dump 内容：动 `index.astro` 里的 `const rodata = ...`（会自动按真字节重算偏移）+ **右上角 84px 方形小照片**（手机 56px）。照片的职责是"这个说话的人"，和文字同处一屏才不显得多余
  - 中间：`文章` 标签 + **双栏**分类分组。每组 = 编号 + 小号 muted 分类名（点击进分类页，0.9rem）+ 右侧篇数 + 一道发丝线；每篇文章**只有标题（衬线 1.06rem）+ 日期**，行间一条发丝线，**不显示摘要**
  - 题记用**真话 + 出处**（现在引 Dijkstra 论测试的那句），不自己写格言——自写的"金句"读着尬，引文有名有姓就成立了；不想要题记把 `SITE.quote.text` 设成空字符串即可
- 分类按 `CATEGORIES` **全部列出**，空分类标「还没有文章」（不可点，因为不生成分类页），保证新建分类立刻可见
- 当前分类（5 个）：**pwn / 终端安全 / 反病毒 / 内核与嵌入式 / 站务**；分组数是奇数时最后一格 `grid-column: 1 / -1` 横跨两栏，不留半格空白
- **悬浮 = 1px 发丝下划线**（`text-decoration-color: var(--line-strong)`、`offset 0.22em`），标题/分类名/「全部 N 篇」都一样；**不要用墨绿做悬浮色**——强调色只留给"当前位置"标记和正文行内链接
- 分隔线分两档：`--line`（0.9rem，分组与区块之间）和 `--line-soft`（条目之间，更淡），避免整页被横线切碎
- 页脚 = **版权页 colophon**：**窄栏 30rem**（连分隔线也收在同一栏里），两行 —— 小链接（归档 · 标签 · 邮箱 · RSS）+ 署名 `Findkey · 二〇二六`
- 页脚只有顶部 1px 分隔线，直接躺在纸底上；`main { flex: 1 0 auto }`，内容不足一屏时页脚贴住视口底部
- 代码高亮用 Shiki 的 `github-light`（注释对比度够；`min-light` 注释太淡，`github-dark` 和浅色风格打架）

**禁止事项**（这些是历次返工踩出来的）：

- ❌ 不要在 `body` 或页脚加渐变背景。旧版 `body` 有 600px 高的渐变、页脚又有自己的渐变，
  两者交界处就形成了那条"半隐藏的栏"
- ❌ 不要用 `box-shadow` 堆卡片。层级用 1px 分隔线、留白、以及"白 55%"的纸面叠加表达
- ❌ 不要引入第二个强调色（分类色、标签色都用灰阶或 muted）
- ❌ 不要引入第三种字体：衬线只用于标题，无衬线只用于正文，等宽只用于小标签
- ❌ 不要加载 webfont，也不要给中文正文用小于 16px 的字号
- ❌ 不要把正文宽度拉到 900px 以上，中文长行读起来会串行
- ❌ 不要用深色代码块（和纸感风格打架），也不要用彩色标签胶囊
- ❌ 不要把顶部导航恢复成一排横排链接；导航只走「目录」覆盖层，页脚只留版权页

---

## 5. 目录结构

```
blog/
├── PROJECT.md              ← 本文件，唯一入口文档
├── README.md               ← GitHub 首页展示，指回本文件
├── AGENTS.md               ← 给编码助手的硬性约定
├── astro.config.mjs        ← Astro 配置（site/base 从 consts.ts 读）
├── .github/workflows/deploy.yml
├── docs/how-to.md          ← ★ 日常操作：写文章 / 加分类 / 加友链
├── public/favicon.svg
└── src/
    ├── consts.ts           ← ★ 站点信息、NAV 导航、CATEGORIES 分类
    ├── content.config.ts   ← 文章 frontmatter schema（category 会校验是否存在）
    ├── content/blog/       ← ★ 所有文章（.md / .mdx）
    ├── components/
    │   ├── BaseHead.astro  ← <head>：SEO / OG / RSS / canonical
    │   ├── Header.astro    ← ★ 站头：左字标 + 右「归档/友链」
    │   ├── Footer.astro    ← ★ 版权页 colophon（装饰符 + 排印说明 + 小链接）
    │   ├── PostList.astro  ← 文章行列表（发丝分隔，标题左 / 日期右）
    │   ├── Toc.astro        ← ★ 文章页左侧目录（由正文 h2/h3 生成，滚动高亮）
    │   └── FormattedDate.astro
    ├── layouts/BlogPost.astro ← 文章页：左目录 + 右正文 + 上下篇
    ├── pages/
    │   ├── index.astro          ← 首页：分类目录跨页（2×2 网格）
    │   ├── posts/index.astro    ← 归档（按年份倒序，紧凑列表）
    │   ├── posts/[...slug].astro← 文章详情
    │   ├── categories/[category].astro ← 分类详情（面包屑回首页 #slug）
    │   ├── tags/index.astro / tags/[tag].astro
    │   ├── 404.astro
    │   ├── links.astro                 ← 友链（数据来自 FRIENDS）
    │   └── rss.xml.js / robots.txt.ts
    ├── styles/global.css   ← ★ 设计 token + 正文排版 + 通用容器
    └── utils/
        ├── posts.ts        ← ★ 查询、分类分组、分类内排序、阅读时长
        └── url.ts          ← ★ withBase() 等路径工具，站内链接必用
```

产出目录 `dist/`、缓存 `.astro/`、`node_modules/` 都不进 git。

---

## 6. 快速开始

```bash
cd /home/key/Work/blog
npm install            # 首次或依赖变更后

npm run dev            # 开发服务器，热更新
# → http://localhost:4321/blog/     ⚠️ 根路径 / 是 404，一定要带 /blog/

npm run build          # 生产构建，输出 dist/（约 0.7s，13 个页面）
npm run preview        # 预览 dist/，路径行为与 Pages 一致
```

后台跑 dev：`npx astro dev --background`，管理用 `npx astro dev status|logs|stop`。

---

## 7. 写作流程

### 新建一篇

```bash
npm run new -- "文章标题" --cat pwn --tags stack
# 编辑 frontmatter（category 必填！）和正文
npm run dev
```

文件名就是 URL（去扩展名），用英文小写 + 连字符：`buildroot-qemu-audio.md` → `/blog/posts/buildroot-qemu-audio/`。
改了文件名等于改 URL，已发布的文章别随便改名。

### frontmatter 字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `title` | ✅ | 标题 |
| `description` | ✅ | 摘要，用于列表、SEO、RSS |
| `category` | ✅ | **分类 slug**，必须是 `src/consts.ts` 里 `CATEGORIES` 的某一项；写错构建直接报错 |
| `pubDate` | ✅ | 发布日期，写 `2026-10-24` 即可（自动转 Date） |
| `updatedDate` | ❌ | 更新日期，填了文章页会显示「更新于」 |
| `order` | ❌ | 同分类内的阅读顺序（1、2、3…）。不填则按时间倒序 |
| `tags` | ❌ | 字符串数组，如 `[qemu, buildroot]`，默认空 |
| `heroImage` | ❌ | 封面图（当前布局不再展示，保留字段备用） |
| `draft` | ❌ | `true` 时只在 `npm run dev` 可见，`npm run build` 不输出 |

**阅读时长**不用填，构建时按正文字数自动算（约 400 字/分钟）。

### 分类 vs 标签

- **分类（category）**：一篇只能属于一个，决定文章出现在哪个目录树里，是站点的主结构
- **标签（tags）**：一篇可以有多个，是横向索引，用于串起同一技术点的零散文章

分类内排序规则（`src/utils/posts.ts` 的 `sortForReading`）：

1. 两边都填了 `order` → 按 `order` 升序（适合系列文章）
2. 只有一边填了 → 填了的排前面
3. 都没填 → 按 `pubDate` 倒序

### 新增一个分类

0. 新建文章：`npm run new -- "标题" --cat pwn --tags stack,ret2text`（自动填 frontmatter 和「环境 / 保护 / 漏洞点 / 利用 / 坑 / 小结」骨架；`--draft` 表示先不发布）
1. 打开 `src/consts.ts`，在 `CATEGORIES` 里加一项（`slug` 用英文小写，`name` 是中文显示名，`description` 一句话）
2. 新建/修改文章，frontmatter 的 `category` 填新 slug
3. 空分类不会出现在页面上，所以可以先把分类列全

### 图片

- 需要优化（压缩、转 webp、响应式）的图放 `src/assets/`，正文用相对路径引用
- 原样输出的（favicon 等）放 `public/`
- 不要在正文写 `/images/xxx.png` 这种根路径，项目站会 404

---

## 8. 上线部署

### 一次性配置（只做一次）

1. GitHub 创建仓库 `blog`（**不要**勾 README/gitignore 初始化，避免首次推送冲突）
2. 本地关联并推送：
   ```bash
   cd /home/key/Work/blog
   git remote add origin https://github.com/USERNAME/blog.git
   git branch -M main
   git push -u origin main
   ```
   HTTPS 推送需要 Personal Access Token（`repo` 权限）；或配 SSH key 后用 `git@github.com:USERNAME/blog.git`
3. 仓库 Settings → **Pages** → Source 选 **GitHub Actions**
4. 改 `src/consts.ts` 里的占位符（见第 9 节），提交推送

### 日常发布

```bash
npm run build      # 可选，本地先确认能构建
git add -A
git commit -m "post: 文章标题"
git push
```

Actions 自动 `build` → `deploy`，约 1 分钟。进度看仓库 Actions 页面。

### 回滚

```bash
git revert HEAD
git push
```

### 验证线上是否更新

打开 `https://USERNAME.github.io/blog/?v=$(date +%s)` 绕过缓存，或看 Actions 里最新 `deploy` 是否绿色。

---

## 9. 上线前检查清单

- [ ] `src/consts.ts` → `url`：`https://你的用户名.github.io`（**不要**带 `/blog`）
- [ ] `src/consts.ts` → `base`：项目站保持 `/blog`；改用户主页站则改成 `/`
- [ ] `src/consts.ts` → `github`：你的 GitHub 主页地址
- [ ] `src/consts.ts` → `title` / `description` / `author`
- [ ] `src/consts.ts` → `CATEGORIES`：按你的写作方向调整分类（空分类不会显示）
- [ ] 删掉示例文章 `hello-world.md`、`astro-github-pages-notes.md`（或保留作为参考）
- [ ] 草稿 `qemu-buildroot-vexpress-a9.md` 补完实测后去掉 `draft: true`

改完 `base` 后务必 `npm run build` + `npm run preview`，确认链接里没有 `/blog/blog`。

---

## 10. 常见问题（踩过的坑都在这）

**1. 本地打开 `http://localhost:4321/` 是 404**
正常。配置了 `base: '/blog'`，所有页面都在 `/blog/` 下，dev 和 preview 都一样。

**2. 线上点某个链接 → 404，或地址里出现 `/blog/blog/...`**
链接被拼了两次 base。检查：
- 页面里是否硬写了 `/blog/xxx` → 改成 `withBase('/xxx')`
- 是否对 `Astro.url.pathname` 又套了一层 `withBase()` → pathname 本身就含 base，不要再加

**3. 样式全部丢失、页面像纯文本**
CSS 没加载。全局样式与组件样式会被 Astro 打包成一个 `dist/_astro/*.css`（约 5KB），
路径同样是带 base 的绝对路径。出现这种情况通常是该文件 404（`base` 与部署路径不一致），
用 DevTools 的 Network 面板确认。注意：不要手写 `/styles/global.css` 这类根路径引用。

**4. 部署成功但线上还是旧内容**
Pages 有缓存（加 `?v=时间戳` 验证），或 Settings → Pages 的 Source 还停在 "Deploy from a branch"（必须选 GitHub Actions）。

**5. Actions 里 deploy 步骤报权限/认证错误**
`permissions` 少了 `id-token: write`。三个权限缺一不可：`contents: read`、`pages: write`、`id-token: write`。

**6. 新文章没出现在任何分类里 / 构建报 category 错误**
`category` 写的 slug 不在 `CATEGORIES` 里。schema 会直接报错并列出可选值，按提示改。

**7. 想让系列文章按固定顺序读**
在 frontmatter 加 `order: 1/2/3`。填了 order 的会排在没填的前面，同一分类内按 order 升序。

**8. 草稿文章上线了**
`draft: true` 依赖查询时的过滤条件。新增页面时必须用 `src/utils/posts.ts` 的 `allPosts()` / `isVisible`，
不要直接 `getCollection('blog')`。

**9. 日期显示差一天**
构建机是 UTC。`FormattedDate.astro` 固定了 `timeZone: 'Asia/Shanghai'`，不要删。

**10. 想换域名（比如自己的 .com）**
① `public/` 放 `CNAME`（一行域名）；② 改 `src/consts.ts` 的 `url` 为新域名、`base` 改 `/`。全站链接都是 `withBase()` 生成的，会自动跟着变。

**11. 改了样式后出现"一条奇怪的色带"**
见第 4 节「禁止事项」：多半是在 `body` 或页脚加了渐变/阴影，和纸色区块交界。保持全站只有一个 `--bg`。

**12. 页面底部那个黑色/灰色的 Astro 工具条是什么？**
Astro 的 dev toolbar，**只在 `npm run dev` 时出现**，`build` / `preview` / 线上的产物里没有。
本项目已在 `astro.config.mjs` 里 `devToolbar: { enabled: false }` 关掉。看到它说明你在看开发服务器。

**13. 想分享首页里某个分类的展开状态怎么办？**
首页每个分类都有 `id`（等于分类 slug），用锚点直达即可自动展开：
`https://USERNAME.github.io/blog/#pwn`。分类页面本身的固定地址是 `/categories/pwn/`。

**14. 想加/改导航项怎么办？**
站头右侧的「归档 / 友链」来自 `src/consts.ts` 的 `NAV`（顺序即显示顺序），加一项写个 href 和 label 即可。
首页本身就是分类目录，所以「分类」不放导航，放在版权页。
友链页的数据是另一份：`FRIENDS` 数组，加 `{ name, url, note }` 即可（`/links` 按顺序渲染）。
RSS / GitHub / 邮箱在版权页，来自 `SITE` 字段（留空就不显示）。

**15. 改了 `src/consts.ts`（分类/导航/标题）后页面没变？**
`astro dev` 对 `consts.ts` 这类模块的热更新不稳定，会出现"分类还是旧的、新分类不显示"。
`npx astro dev stop` 再 `npx astro dev --background` 就正常。`npm run build` 的产物始终是最新的。

---

## 11. 待办 / 可选增强

按性价比排序。每加一个功能就多一份维护成本，先想清楚是否真需要：

- [ ] **暗色模式**：`prefers-color-scheme` + 把 `:root` token 换成 `light-dark()`；结构已就绪，成本低
- [ ] **文章目录（TOC）**：从 `render()` 的 `headings` 取，可放右侧或折叠在正文上方
- [ ] **评论**：giscus（GitHub Discussions，无后端无广告）
- [ ] **站内搜索**：pagefind（构建后生成索引，纯静态）
- [ ] **OG 图自动生成**：`astro-og-canvas`，省得每篇手画封面
- [ ] **统计**：若需要，选无 cookie 的（Cloudflare Web Analytics），不要 Google Analytics
- [ ] 移动端文章页补一个「本分类文章」折叠目录（小屏现在只靠面包屑回分类页）
- [ ] 首页分类分区的折叠/展开（文章多了以后）

---

## 12. 决策记录（ADR）

| 日期 | 决策 | 理由 |
| --- | --- | --- |
| 2026-10-24 | 用 Astro 而非 Hexo/Hugo/Jekyll | 内容集合有类型校验、零 JS 默认、可渐进加交互组件；本机已有 Node |
| 2026-10-24 | 用项目站 `USERNAME.github.io/blog` | 以后可并置多个站点；代价是所有链接必须走 `withBase()` |
| 2026-10-24 | 文章路由用 `/posts/` 而非 `/blog/` | 避免 `/blog/blog/xxx` 的双重嵌套 |
| 2026-10-24 | 部署用 GitHub Actions + artifact | 构建与内容分离，不污染 git 历史 |
| 2026-10-24 | 站点信息集中到 `src/consts.ts` | 换域名/改标题只改一处 |
| 2026-10-24 | **信息架构改为分类优先** | 用户反馈：想要"分类式"而不是时间流。首页、分类页、文章页侧栏都按分类组织，标签降为横向索引 |
| 2026-10-24 | **视觉改为简约排版优先** | 用户反馈：喜欢简约，且旧版页面底部有色带、正文读着累。改为单色背景 + 系统字体 + 700px 正文 + 发丝分隔线 |
| 2026-10-24 | 去掉封面大图与 webfont | 装饰性元素对阅读无帮助，还会造成中英混排字重不一致和字体闪烁 |
| 2026-10-24 | 文章页加分类侧栏 + 上下篇 | 「分类式」的核心体验：读完一篇顺着目录往下点 |
| 2026-10-24 | 视觉方向定为「纸感简约」（参考 leerob.com / paco.me） | 纯灰白太冷、没有辨识度。暖白底 + 衬线标题 + 发丝线，质感好又不喧哗；中文衬线直接用系统 Noto Serif CJK，仍然零 webfont |
| 2026-10-24 | 强调色从蓝改墨绿 `#1f6f5c` | 蓝在米色纸底上发灰发脏，墨绿压得住暖白，也更适合长文阅读 |
| 2026-10-24 | 字体分工：衬线=标题 / 无衬线=正文 / 等宽=小标签 | 中文正文用衬线在小字号下偏糊；标题用衬线有书卷气；等宽只做印刷品式的小字标签 |
| 2026-10-24 | 关闭 Astro dev toolbar | 用户误以为它是站点的一部分（它只出现在 dev），本项目也用不到 |
| 2026-10-24 | 首页用原生 `<details>` 做可展开目录 | 零 JS 依赖、键盘可操作、无 JS 也能用；不用自己写手风琴状态管理。唯一的小脚本负责「展开全部」和 `#slug` 锚点自动展开 |
| 2026-10-24 | 顶部导航改为「44px 细条 + 目次覆盖层」 | 用户要求换掉首页/分类/关于/RSS 那排导航。覆盖层把导航变成一页目录，平时不占视觉，正文页更干净；`<dialog>` 自带 Esc 与焦点管理 |
| 2026-10-24 | 页脚改为版权页 colophon | 原来的多列链接堆像模板站的做法。colophon 是印刷品的收尾方式：只留装饰符、排印说明和 4 个小链接 |
| 2026-10-24 | 站点名只留 `Findkey`，去掉「的博客」后缀 | 用户觉得「某某的博客」像模板站的自称。名字本身当标识更干净；简介也去掉「笔记」二字，因为定位不只是笔记 |
| 2026-10-24 | 刊头第二行改成纯事实：`更新于 … · 共 N 篇` | 原来写「个人笔记」是在替用户定义这个站是什么，容易违和。日期和篇数是客观信息，不需要认同 |
| 2026-10-24 | 刊头去掉时间与篇数，改为「名字 + 40px 饰线 + 简介」 | 用户反馈：时间和篇数多余，单放名字又显得孤零零。加一条短饰线把名字和简介锁成一个字标组合 |
| 2026-10-24 | RSS 从顶栏移到版权页；目次主条目改为分类 | 顶栏只留「目录」一个动作更干净；目次本来就是这本"刊物"的目录，列分类比列「首页/关于」有用 |
| 2026-10-24 | **取消目次覆盖层，回到「左字标 + 右链接」的站头** | 用户反馈：左上应该放字标，右上要有友链、关于。覆盖层虽然新颖，但把最常用的入口藏进了弹层；常规站头更好用，个性靠排版和配色承担 |
| 2026-10-24 | 首页去掉居中大名字 | 用户觉得"居中大名"奇怪。名字回归左上字标，首页直接以简介 + 分类目录开场，信息密度更实在 |
| 2026-10-24 | 新增 `/links` 友链页 | 用户希望在站头放友链。数据集中在 `FRIENDS`，空状态也做成设计过的一屏，而不是空白 |
| 2026-10-25 | 站点定位改为二进制漏洞 / pwn | 用户说明内容主要是 pwn（二进制漏洞与利用），其他方向未定、纯兴趣驱动。简介、分类（pwn / 内核与嵌入式 / 站务与工具 / 随笔）、关于页、示例文章同步调整 |

---

## 13. 变更日志

> 每次改动都往下加一行。日期用本地时间（CST）。

| 日期 | 改动 |
| --- | --- |
| 2026-10-24 | 初始化项目：Astro 7 blog 模板，改为中文站点（consts.ts 集中配置、中文导航/页脚/关于页/404） |
| 2026-10-24 | 加 `src/utils/url.ts`（withBase/absoluteUrl/postUrl/tagUrl），全站站内链接改为 base 安全写法 |
| 2026-10-24 | 文章路由 `/blog` → `/posts`，修复 canonical/og:image 重复拼 base，RSS 频道链接补 base |
| 2026-10-24 | 新增标签系统、草稿机制、robots.txt、sitemap 校验 |
| 2026-10-24 | 中文排版：日期本地化（Asia/Shanghai）、代码块/表格/引用样式 |
| 2026-10-24 | 加 GitHub Actions 部署工作流；示例文章 3 篇（1 篇草稿）；写 PROJECT.md / README.md / docs/post-template.md |
| 2026-10-24 | 修复导航高亮：`HeaderLink` 比较前归一化 base 与尾部斜杠 |
| 2026-10-24 | **重做信息架构**：新增 `CATEGORIES`（consts.ts）+ `utils/posts.ts`；首页改为分类分区；新增 `/categories`、`/categories/[category]`；`/posts` 改为按分类分组；文章页加分类侧栏与同分类上下篇；schema 增加 `category`（校验存在性）与 `order` |
| 2026-10-24 | **重做视觉**：全站改为简约排版优先——单色背景、系统字体栈（删掉 Atkinson webfont 与 `fonts` 配置）、700px 正文列、发丝分隔线、sticky 页头、纯白页脚（修掉底部那条渐变"半隐藏的栏"）、浅色代码块；正文 17px/1.9 行高 |
| 2026-10-24 | 新增文章页元信息：约读时长（按字数估算）、更新于、标签；导航精简为 首页 / 分类 / 关于（标签与全部文章入口移到页脚） |
| 2026-10-24 | 视觉返工（截图核对后）：代码块改用 Shiki `github-light`（原来继承 default dark，与浅色站冲突）并把底色压回 `--code-bg`；补 `box-sizing: border-box`（修掉手机端 40px 横向溢出）；`body` 改 flex 列布局让页脚贴底（短页面不再浮在中间）；全站竖线统一到 1000px 主栏（页头/列表/文章页 208+48+704 对齐）；首页 h1 改为作者名（不再和页头标题重复）；段间距 1.4em → 1.6em；无上下篇时不再渲染空的分隔线 |
| 2026-10-24 | **视觉第三版「纸感」**：暖白底 `#fbf9f5` + 暖黑文字 + 墨绿强调色；引入衬线标题（系统 Noto Serif CJK）、等宽小标签；首页加分类序号 01/02、日期与标签改等宽、行条目 hover 出箭头；分类卡片用 55% 白叠加替代阴影；正文 `text-wrap: pretty` 防孤字；关闭 dev toolbar |
| 2026-10-24 | **首页改为可展开的分类目录**：原生 `<details>/<summary>` 手风琴，第一项默认展开；展开后的条目缩进对齐分类名（目录树感）；右上「展开全部 / 收起全部」；支持 `#分类slug` 锚点自动展开；`::details-content` 高度动画（Chrome 131+，其余直接展开） |
| 2026-10-24 | **重构导航与页脚**：顶部导航条 → 44px 细条 + 全屏目次覆盖层（原生 dialog，Esc/点遮罩关闭、锁背景滚动、编号大号衬线链接）；首页新增居中刊头（期号行 + clamp 大标题 + 双细线收口，细条不再重复站点名）；页脚 → colophon 版权页（※ + 排印说明 + mono 小链接）；顺手修掉 `variant="inner"` 与 `.inner` 容器类冲突导致内页页头被压窄的 bug；删除不再使用的 `HeaderLink.astro` |
| 2026-10-24 | 站点改名：`SITE.title` 从「Findkey 的博客」改为「Findkey」，简介去掉「笔记」；刊头第二行改为 `更新于 … · 共 N 篇`；全文（标题/刊头/细条/RSS/README）同步 |
| 2026-10-24 | 刊头去掉「更新于/共 N 篇」，改为「名字 + 饰线 + 简介」；顶栏去掉 RSS（只留「目录」）；目次改为分类驱动（编号 + 分类名 + 篇数），次级链接走 NAV；`NAV` 精简为 全部文章/标签/关于 |
| 2026-10-24 | **站头回归常规结构**：左字标 + 右「分类/友链/关于」（当前栏目加 1px 墨绿短下划线）；删除目次覆盖层（`<dialog>`）与相关脚本；首页去掉居中刊头，改为一行简介 + 分类目录开场；新增 `/links` 友链页（数据在 `FRIENDS`，含空状态）；版权页补「全部文章 / 标签」 |
| 2026-10-25 | 导航精简为「友链 / 关于」：首页本身就是分类目录，站头不再重复「分类」；分类入口移到版权页。同时修复上一轮补丁误删 `Friend` 接口与 `FRIENDS` 数组导致 `/links` 构建失败的问题（已从 git 恢复 links.astro） |
| 2026-10-25 | 站名改为 `Findkey’s Blog`（弯撇号 `’`；ASCII 直引号在衬线里太丑）。同步调整 `--font-serif`：拉丁字体排到 `Noto Serif CJK` 之前，否则 CJK 字体的全角 `’` 会把 "Findkey’s" 拉出一个空格 |
| 2026-10-25 | 修内页字标变墨绿的 bug：内页字标本身就是 `<a class="brand">`，原来只写了 `.brand a` 的颜色，`<a>` 继承了全站链接色。改为颜色写在 `.brand` 上、内部 `a` 用 `inherit` |
| 2026-10-25 | 站头加「归档」；`/posts` 从"按分类分组的全部文章"改为**按年份倒序的归档**（紧凑列表，隐藏摘要，年份按站点时区计算）；全站去掉「全部文章」这种说法，统一叫「归档」 |
| 2026-10-25 | 理顺分类层级：删除 `/categories` 分类总览页（首页本身就是目录）；首页每分类只列最近 4 篇，多了才给「该分类共 N 篇 →」；分类页面包屑改「首页 / 分类名」、底部「← 返回首页」（带 `#slug`，回去时手风琴自动展开）；文章页面包屑同步；版权页去掉「分类」；404 的「看分类」改为「看归档」 |
| 2026-10-25 | 首页顶部改为「刊首语」：简介从一行灰字改成大号衬线（正文色、clamp 1.28–1.6rem），下方 48×2px 短饰线收口；加 `text-wrap: balance` 让手机上折行的两行长度均衡 |
| 2026-10-25 | 内容方向改为 pwn：`SITE.description` → 「二进制漏洞分析与利用（pwn）」；分类重构为 pwn / 内核与嵌入式 / 站务与工具 / 随笔（原 embedded→kernel、site→meta，两篇示例文章 frontmatter 同步）；关于页与示例文章的口吻改成 pwn 视角；注意 pwn 分类暂时为空，**空分类不会出现在首页**，写第一篇后自动出现 |
| 2026-10-25 | 新增 `docs/post-template-pwn.md`：pwn writeup 骨架（环境 / 保护 / 漏洞点 / 思路 / 利用 / 踩坑 / 小结）；补 FAQ「改了 consts.ts 后 dev 没更新」|
| 2026-10-25 | 首页去掉刊首语（"二进制漏洞分析与利用（pwn）"这类一句话放在页面上都显得怪），站头之后直接进分类目录；分类目录改为**列全 CATEGORIES**，空分类显示一行灰色「还没有文章」且不可展开——之前空分类被过滤，pwn 分类配好了却看不见 |
| 2026-10-25 | 首页加「最新一篇」当视觉重心（分类·日期 mono + 大号衬线标题 + 摘要，点进文章）；PostList 标题与日期之间加**印刷品式引导点**；页脚收窄到 30rem（分隔线同行宽）、去掉排印自述与「回到顶部」，占位符 GitHub 链接不再渲染；首页去掉孤立的「归档 →」（页脚已有） |
| 2026-10-25 | **首页改为「分类目录跨页」**：去掉「最新一篇」头条与手风琴（用户反馈：文章不该供在最上面），改成 2×2 网格，每格一个分类（编号 + 1.5rem 衬线名 + 篇数 + 一句简介 + 最近 3 篇标题/日期），窄屏单列；分类名与文章行点击进入；空分类标「还没有文章」。参考 craigmod.com / robinsloan.com 的刊物目录排版。同时修掉块级链接悬停出现整段下划线的问题 |
| 2026-10-25 | 修死链：空分类没有 `/categories/<slug>/` 页面，首页那个分类名改成不可点的灰字（`items.length > 0` 才渲染 `<a>`）|
| 2026-10-25 | 首页分类块**去掉简介**（只留编号/名字/篇数/最近 3 篇）；超过 3 篇时链接文字改「全部 N 篇 →」；页脚再收紧：去掉装饰符、两行（链接 + 署名）、`margin-top` 2.75rem，并把 `main` 的 `flex: 1` 改成 `flex: 0`，不再把页脚推到视口底部 |
| 2026-10-25 | 首页顶部加「头像 + 一言」：`public/avatar.svg`（F 字标占位）+ hitokoto（`v1.hitokoto.cn`，构建时渲染 Knuth 兜底句，客户端 fetch 成功后替换，失败静默保留兜底）；页脚恢复 `main { flex: 1 0 auto }`，内容短时贴视口底部 |
| 2026-10-25 | 一言块重构：头像 64px、引文 1.1rem、出处右对齐（加 `— ` 前缀，空出处则整行隐藏），窄屏出处下移；首页标签「分类目录」改为「文章」 |
| 2026-10-25 | 一言块改为**居中题记**：头像 72px（手机 60）+ 引文 1.28rem 居中 + 出处 mono 居中；删掉「」装饰与头像里的斜线；出处去重（`from_who === from` 只显示一次）；手机端字号/头像降档 |
| 2026-10-25 | 首页按 paco.me 结构重做：顶部两行第一人称（`SITE.intro`）+ 右上 84px 方形照片（占位 `public/avatar.svg`，换真人照直接替换文件）；文章分组里每条补回一句 description；一言从顶部挪到页面底部当收尾。彻底放弃「头像 + 引文」凑在一起的方案（头像说的是人、引文说的是话，没有关系） |
| 2026-10-25 | 首页定稿：分组恢复双栏（用户比较后选双栏）；删除一言（含 hitokoto 脚本）；自述改为三行「主要研究 pwn。/ 其余凭兴趣：终端安全、反病毒…… / 这里只写过程」；补 6 篇占位文章（pwn 4、随笔 2）并把 QEMU 那篇撤掉 draft，让双栏有内容 |
| 2026-10-25 | 整体降一档对比度：`--text` #1c1a17→#262220、`--line-strong` #d6cfc2→#e0dacd、`--line` #e7e2d8→#ede8de、条目线用新的 `--line-soft` #f2ede4；线做三级（区块 > 分组 > 条目）。另测超长标题：列表里折 3 行、日期仍在首行右侧、行高自动撑开；文章页 h1 在 704px 栏内折 3 行，不压左侧目录 |
| 2026-10-25 | 重新分类：pwn / 终端安全 / 反病毒 / 内核与嵌入式 / 站务（原 内核与嵌入式 / 站务与工具 / 随笔）；占位文章标题改为正常写法（去掉「主题：副题」的模板感）；奇数个分组时最后一格横跨两栏 |
| 2026-10-25 | 重构关于页：`h1 → 一句 lead（衬线 1.16rem）→ 三组定义列表（现在 / 站点 / 联系）`；小标题用等宽 0.72rem + 字距 0.14em，条目是 `dt(mono) + dd` 两栏网格，窄屏自动改为上下排列；分类名从 `CATEGORIES` 动态拼，改分类不用动这页 |
| 2026-10-25 | 关于页再简化：三段短话（我是谁 / 写什么 / 怎么联系），复用 `.prose` 排版，去掉定义列表与分节——上一版信息结构过重，读着乱 |
| 2026-10-25 | 关于页按真实情况重写（JNU 本科在读 / glibc 堆栈与 IO_FILE / 正往 kernel 走、想自己写内核 / 对 V8 有兴趣 / 在碰 Zig、Rust 读过一点 / 为找工作补终端安全、病毒与免杀）；刻意不写成"研究"，用"在看""刚入门""写不利索"这类实话 |
| 2026-10-25 | 关于页措辞再修：把短句罗列改成有过渡的长句（"主要的精力放在…完整走过一遍…正慢慢转向…"），自我评价从"写不利索"改为"属于能读懂、写起来还吃力的阶段"，结尾改成邀请式（"想聊技术、换题目，或者只是打个招呼"） |
| 2026-10-25 | **删除关于页**（`src/pages/about.astro` 与 `NAV` 里的「关于」）：用户认为怎么写都不优雅，联系方式放版权页的邮箱即可；站头导航变为「归档 / 友链」 |
| 2026-10-25 | 删除 RSS：移除页脚链接、hero 图标、`<head>` 的 alternate 与 `src/pages/rss.xml.js` 路由（要恢复就 `git show` 拿回该文件并重加这三处）；同时全站去掉 `mailto:`——页脚与友链页显示纯文本邮箱，hero 的邮箱图标改为**点击复制到剪贴板** |
| 2026-10-25 | 邮箱改为「展开式联系条」（按用户指定的方案）：默认只显示信封图标，图标是 `mailto:` 链接（点击发信）；hover / focus 时整条横向展开（max-width 过渡 0.3s）露出完整地址，右侧跟复制按钮；点复制在展开条下方淡入「已复制」1.6s；触屏（<760px）无 hover，地址与复制按钮常显 |
| 2026-10-25 | 文章页左侧从「本分类的文章列表」改为**文章目录**：`render(post)` 取 `headings`，过滤 h2/h3 生成锚点列表，sticky 且用 IntersectionObserver 高亮当前小节（左侧 1px 竖线）；<900px 隐藏；删除 `CategoryNav.astro`（分类入口仍在面包屑与底部上下篇） |
| 2026-10-25 | 目录收尾：侧栏长标题 `line-clamp: 2` 截断；<900px 时侧栏隐藏、改为正文顶部的 `<details>` 可折叠目录（点击条目后自动收起）；两套目录共用同一份 `headings` 与同一段高亮脚本 |
| 2026-10-25 | 加 `npm run new -- "标题" --cat pwn [--tags a,b] [--slug x] [--draft]`：读 `consts.ts` 校验分类、按标题生成 slug（中文标题补日期防撞）、生成带 pwn 骨架的 md；不做主题化重构（用户确认只给自己用） |
| 2026-10-25 | 文档与资源收拾：新增 `docs/how-to.md`（写文章 / 加分类 / 加友链 / 改站点信息 / 常见报错），合并并删除两份重复的文章模板（`npm run new` 已覆盖）；生成 `public/og.png`（1200×630 纸感分享卡，站名 + 题记 + dump），`BaseHead` 默认用它，删掉模板自带的 `src/assets/blog-placeholder-1.jpg`（32K）|
| 2026-10-25 | 站名改为 `Findkey`（原来 `Findkey’s Blog`）：标签页更短、更易认；文章页 title 统一为「标题 · Findkey」。favicon 从模板的蓝底 F 换成**墨色实底 + 纸色衬线 F**（16px 下最清楚，也和纸感配色一致）；`public/og.png` 同步用新站名重做 |
| 2026-10-25 | 站名拆成三个字段：`title`（标签页/SEO，`Findkey · pwn`）、`shortTitle`（内页后缀，`Findkey`，避免「友链 · Findkey · pwn」三段）、`wordmark`（站头字标，`Findkey’s Blog`）；`og.png` 用 wordmark 重做 |
| 2026-10-25 | 标签页名定为 `0xFindkey`（短、十六进制味、不锁死写作方向）；因为已经够短，去掉 `shortTitle`，内页统一「归档 · 0xFindkey」；站头字标仍是 `Findkey’s Blog`，分享卡与之保持一致 |
| 2026-10-25 | 标签页名改回 `Findkey’s Blog`（试过 `0xFindkey` 后否掉）：标签页、站头字标、分享卡三处统一成同一个名字，不再分叉 |
| 2026-10-25 | favicon 换成 Grapple（`public/Grapple.svg`，Lorc / game-icons.net，CC BY 3.0）：原图 512 渐变 + 细笔画，16px 下是红色涂鸦；改为**单色纸色 + 墨色圆角底 + 描边加粗 16**，并补齐 `favicon-32.png`、`apple-touch-icon.png` 与 `<link>`（svg / 32 / apple-touch 三档）。署名写在 SVG 注释与本文档，若要在页面上可见再加一行 |
| 2026-10-25 | favicon 回退到 F 字标（Grapple 试过一版后放弃）：`public/favicon.svg` = 墨色圆角底 + 纸色衬线 F（x 微调到 16.5 做视觉居中），`favicon-32.png` / `apple-touch-icon.png` 由它重新导出；删除 `public/Grapple.svg`（需要时 `git show 1afd715:public/Grapple.svg` 可取回） |
| 2026-10-25 | 清场准备写作：删除 6 篇占位文章与早期填充的 `hello-world.md`（保留 `astro-github-pages-notes.md` 与 QEMU 草稿）；移除已不再使用的 `@astrojs/rss` 依赖；清掉 4 个未使用的 CSS token（`--accent-soft`、`--bg-raised`、`--content-width`、`--radius`）；重写「当前状态」一节使其与现状一致（构建从 35 页降到 14 页）|
| 2026-10-25 | 彻底清空内容与分类：删掉最后 2 篇文章、`CATEGORIES = []`；`content.config.ts` 的 category 校验改为「有分类时才 refine，空分类时接受任意字符串」，否则清场阶段写第一篇就会被 schema 拒掉；首页/归档/标签的空状态补齐（首页给出「先定分类、再 npm run new」的指引，归档不再显示「共 0 篇」） |
| 2026-10-25 | 新增本机写作后台 `scripts/admin.mjs`（`npm run admin` → 127.0.0.1:4322）：零依赖 Node 服务 + 单页界面，可增删改文章（frontmatter 自动生成、改名自动删旧文件）、增删分类（重写 `consts.ts` 的 `#region categories` 并自动重启 dev）；`consts.ts` 的分类块改用 `#region` 标记 + `CategoryItem` 接口以便程序改写；补端口占用提示 |
| 2026-10-25 | 从旧 Hexo 站 `../Saved-blog-doc` 迁入内容（只要内容，不要主题/构建配置）：16 篇文章 → `src/content/blog/`（保留原 slug；`date`→`pubDate`、`excerpt`→`description`、`tags` 转小写连字符数组；v8 三篇加 `order: 1/2/3`；`orange` 以 `###` 开头，整体提一级）；分类定为 pwn / V8 / 嵌入式与 IoT / 工具与笔记；16 条友链从 `source/_data/links.yml` 写入 `FRIENDS`；顺手把新 stub 的 `tags: [V8]` 改成小写避免重复标签页 |
| 2026-10-25 | 分类再分：`WP` 独立（4 篇比赛题解从 pwn 拆出），pwn 只留二进制本身；删除重复的 V8 stub（`v8-pwn-0x00-20261025.md`，内容与 `v8-learn-0` 重复）；友链加回头像（`Friend.avatar`，96px 本地 webp，防盗链/失效时用首字母兜底，`onerror` 移除 img 避免破图），列表改双栏；`public/friends/` 约 50K |
| 2026-10-25 | 友链删掉 wuye、yuoooka、s0lowalker 三条（16 → 13），同步删除 `public/friends/wuye-s.webp` |
| 2026-10-25 | 友链 Yolo 链接改为 `https://docs.yo1o.top/`，头像取其站点 apple-touch-icon 存为 `public/friends/yolo-s.webp`（原来的头像地址已失效）|
| 2026-10-25 | 友链头像补齐：Nick（`/_astro/avatar.CHzblvB9_Zr23Yv.webp`）与 Lochad（`/api/media?hash=622a…`）下载为本地 96px webp；wele 改名 wsh，头像指向其站 `/avatar.jpg`（该站拒绝非浏览器请求，只能远程引用，失败时退回首字母）；Lochad 链接改 https |
| 2026-10-25 | 友链 desc 更新：Eleven. → `Make that move you're afraid of making.`，Sally → `一个pwn手的blog`，Kamiya → `近在咫尺，却邈以山河`；`.note` 从单行省略改为最多两行（`line-clamp: 2`），英文长句不再被截断 |
| 2026-10-25 | 友链：删除 wsh（12 条），Yolo → `to be continued`，Lochad → `more what, more why.` |
| 2026-10-25 | 友链：wsh 加回（desc 改 `wsh 的 web 笔记`，位置在 Nick 之后），新增 Fa1lSnow（`blog.fa1lsnow.com`，desc `林雪落的小玩意`，头像取自其站 `/uploads/avatar.jpg` 存为 96px webp）；共 14 条 |
| 2026-10-25 | WP 分类四篇改标题：羊城杯-PWN-部分WP → 羊城杯 部分；XYCTF2024 复现 → XYCTF 2024 复现；jnctf_wp → JNCTF 2025；HGAME2025_WP → HGAMECTF 2025 |
| 2026-10-25 | 支持数学公式：`remark-math` + `rehype-katex`（构建时渲染成静态 HTML，前端零 JS）；Astro 7 默认用 Sätteri，需额外安装 `@astrojs/markdown-remark` 才能用 remark/rehype 插件；文章页引入 `katex.min.css`（字体随构建进 dist/_astro）；`.katex-display` 窄屏可横向滚动 |
| 2026-10-25 | 审校最后两篇（xyctf 16 题、test_of_record 15 题）：把「分析 / exp」之间的碎句合成句子、"数组越位"统一为"数组越界"、错字（"为对指针置空"→"未置空"、"feedbacl_list"→"feedback_list"、"execvat"→"execveat"）；Toc 增加规则：h2 超过 8 个时只列 h2，避免题解合集出现几十条重复的「分析 / exp」 |
| 2026-10-25 | 代码块交互（`components/CodeTools.astro`）：右上角「复制」（`navigator.clipboard`，失败显示"复制失败"）；超过 26 行的块默认折叠成 14 行 + 底部渐隐 + 「展开（共 N 行）／收起」。注意 JS 动态创建的元素拿不到 Astro 的 scoped 样式，样式必须写在 `<style is:global>` 里。另：全站 52 个代码块做了空白整理（tab→4 空格、去行尾空格、连续空行压一行），C/汇编类块的注释列对齐到同一列 |
| 2026-10-25 | 修正代码块工具栏的三处渲染问题：① 工具行改为真实占位（原来 absolute 悬浮，会压住首行代码）；② Shiki 给 `<pre>` 写了内联 `background-color`，且 `.prose pre` 自带 1px 边框 + 8px 圆角，导致工具栏和代码区看起来是两块——统一改成 `background: transparent !important; border: 0 !important`，让外层 `.code-block` 的米色底成为唯一背景；③ 按钮改成无边框小字（原来是纸色小方块，在米色底上像浮着的补丁） |
| 2026-10-25 | 全站措辞第二轮（补机制，不只是改标点）：orange 补 House of Orange 因果链与 FSOP 遍历、v8 0x01/0x02 补推导与 0x20 算式、YCB 三题补假堆/3 次机会/opcode 分发、proto 补字段描述符读法、dir-815 补调用链与 haystack 来源、ret2dl 补 reloc_index 为何是字节偏移、php-pwn 补 emalloc 绕开 glibc 的后果、两篇合集各补关键机制 |
| 2026-10-25 | hero 联系方式拆成两个独立 `.item`：hover 只展开自己那项（之前悬停 QQ 会把邮箱地址也撑开）。favicon 换成几何绘制的「0x」（描边 0 + 交叉 x，不依赖字体），并重新导出 favicon-32.png / apple-touch-icon.png |
| 2026-10-25 | hero 的 QQ 图标由气泡换成字母 Q（圆 + 斜穿出圈的短尾）；对齐用"墨迹包围盒中心"量化校准：信封与 Q 的 bbox 中心都落在 (9.95, 9.95)，尺寸 16.1×12.1 vs 12.5×12.5 |
| 2026-10-25 | 写作后台改版：纸感配色与站点一致（衬线字标 `0xFindkey` + WRITING DESK 标签、发丝线、等宽小标签）；侧栏文章列表可独立滚动、分类固定在底部；列表项显示「分类 · 日期」或「草稿」；顶部常驻状态（未保存 / 已保存）、正文字数、⌘/Ctrl+S 保存 |
| 2026-10-25 | 写作后台重构成模块：`scripts/admin/{lib/frontmatter,lib/posts,lib/categories,server}.mjs` + `ui/{index.html,app.css,app.js}`，`scripts/admin.mjs` 只剩入口。新增：删除文章改为软删除（挪到仓库根 `.trash/`，界面一键撤销）、分类带文章计数且"有文章不删"（force 才允许）、改名旧文件进回收站、写文件先写 tmp 再 rename。修复：误点分类 × 把 `pwn` 删掉导致 6 篇文章失去分类（已从 git 恢复） |
| 2026-10-25 | 写作后台 UI 完全重做（参考 Notion 的文档式编辑 + Sanity 的内容优先）：无框衬线大标题、摘要行、单行 meta（分类/日期/标签/文件/草稿，只靠虚线下划线提示可编辑）、发丝线以下就是正文；左侧栏加搜索与分类 chip（带篇数），底部固定操作条（保存/预览/删除 + 字数）。⌘K 聚焦搜索 |
| 2026-10-25 | 写作后台改成多视图（hash 路由）：`#/` 文章列表（表格 + 分类 chip 筛选 + 搜索）、`#/edit/<slug>` 编辑（无侧栏，默认只显示标题与正文，meta 折在「信息」按钮里）、`#/categories` 分类管理、`#/trash` 回收站。README：一屏只干一件事 |
| 2026-10-25 | 后台二次重构：左侧固定导航（文章/分类/回收站，各带计数）+ 右侧内容区，每个视图一个页面。分类页改为行内可编辑表格（名称 / slug / 描述 / 文章数），desc 失焦即保存 |
