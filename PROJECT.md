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

已完成（本地已验证可构建、可预览）：

- [x] Astro 项目骨架、内容集合、TypeScript 严格模式
- [x] 站点元信息与分类体系集中管理（`src/consts.ts`）
- [x] 分类式信息架构：
  - 首页 = **刊头 + 可展开的分类目录**（原生 `<details>` 手风琴，第一项默认展开，右上可「展开全部/收起全部」）
  - `/categories` 分类总览（简介 + 篇数 + 最近 3 篇）
  - `/categories/<slug>` 分类内全部文章
  - `/posts` 全部文章（按分类分组、全部展开，用于一次扫完）
  - 文章页左侧显示**当前分类的全部文章目录**，底部有同分类的上一篇/下一篇
- [x] 站头与页脚：
  - 站头 = 左字标 + 右「分类 / 友链 / 关于」（58px，sticky，当前栏目加 1px 墨绿短下划线）
  - 新增 `/links` 友链页，数据来自 `src/consts.ts` 的 `FRIENDS`；没有友链时显示设计过的空状态（不是空白/报错）
  - 页脚 = 版权页 colophon：装饰符 + 排印说明 + 极简小链接，不再堆链接列表
- [x] 标签系统（`/tags`、`/tags/<tag>`）、草稿机制（`draft`）
- [x] 文章页元信息：发布时间、约读几分钟（按字数估算）、更新时间、标签
- [x] 简约视觉：单色背景、系统字体栈（无 webfont 请求）、发丝分隔线、正文 700px 单栏
- [x] RSS、sitemap、robots.txt、Open Graph / Twitter 卡片
- [x] base 路径（`/blog`）正确性：站内链接、canonical、og:image、RSS 全部核对过
- [x] GitHub Actions 部署工作流
- [ ] GitHub 仓库创建 + 首次推送（待用户操作，见第 7 节）
- [ ] Pages 发布源切到 GitHub Actions（待用户操作）
- [ ] 替换 `USERNAME` 占位符（域名、GitHub 链接）

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
  - 右：三项链接「分类 / 友链 / 关于」，当前栏目加 1px 墨绿短下划线
  - 首页**没有居中大名字**——名字就是左上那个字标，页面直接从简介开始
- 首页开头只有一行简介（`muted`，1rem，max-width 620px），紧接着就是分类目录；不再有刊头、时间、篇数
- 页脚 = **版权页 colophon**（居中）：`※` 装饰符 + 「Findkey · 二〇二六」+ 一句排印说明（字体/无追踪）+ 一行 mono 小链接（RSS / GitHub / 邮箱 / 回到顶部）
- 页脚只有顶部 1px 分隔线，直接躺在纸底上；`body` 是 flex 列布局，内容不足一屏时页脚也贴底
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
├── docs/post-template.md   ← 新建文章模板
├── public/favicon.svg
└── src/
    ├── consts.ts           ← ★ 站点信息、NAV 导航、CATEGORIES 分类、FRIENDS 友链
    ├── content.config.ts   ← 文章 frontmatter schema（category 会校验是否存在）
    ├── content/blog/       ← ★ 所有文章（.md / .mdx）
    ├── assets/             ← 需要 Astro 优化的图片
    ├── components/
    │   ├── BaseHead.astro  ← <head>：SEO / OG / RSS / canonical
    │   ├── Header.astro    ← ★ 站头：左字标 + 右「分类/友链/关于」
    │   ├── Footer.astro    ← ★ 版权页 colophon（装饰符 + 排印说明 + 小链接）
    │   ├── PostList.astro  ← 文章行列表（发丝分隔，标题左 / 日期右）
    │   ├── CategoryNav.astro ← ★ 文章页左侧分类目录（sticky）
    │   └── FormattedDate.astro
    ├── layouts/BlogPost.astro ← 文章页：左目录 + 右正文 + 上下篇
    ├── pages/
    │   ├── index.astro          ← 首页：可展开的分类目录（details 手风琴）
    │   ├── posts/index.astro    ← 全部文章（按分类分组）
    │   ├── posts/[...slug].astro← 文章详情
    │   ├── categories/index.astro      ← 分类总览
    │   ├── categories/[category].astro ← 分类详情
    │   ├── tags/index.astro / tags/[tag].astro
    │   ├── about.astro / 404.astro
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
cp docs/post-template.md src/content/blog/my-new-post.md
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
- [ ] `src/pages/about.astro`：有一处 `TODO`，换成真实自我介绍
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
`https://USERNAME.github.io/blog/#embedded`。分类页面本身的固定地址是 `/categories/embedded/`。

**14. 想加/改导航项怎么办？**
站头右侧的三项来自 `src/consts.ts` 的 `NAV`（顺序即显示顺序），加一项写个 href 和 label 即可。
友链不是导航项，是 `/links` 页面的数据：在 `FRIENDS` 数组里加 `{ name, url, note }`。
RSS / GitHub / 邮箱在版权页，来自 `SITE` 字段（留空就不显示）。

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
