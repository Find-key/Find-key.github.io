# 项目总述 · Findkey 的博客

> **这份文件是本仓库的唯一入口文档。**
> 规则：每次改动（改配置、加页面、换主题、修 bug、踩坑）**都必须在文末「变更日志」追加一条**，
> 并同步更新「当前状态」和「目录结构」。这样三个月后回来不用重新考古。

| 项 | 值 |
| --- | --- |
| 本地路径 | `/home/key/Work/blog` |
| 线上地址 | `https://USERNAME.github.io/blog/`（待填用户名） |
| 技术栈 | Astro 7（静态输出）+ Markdown 内容集合 |
| 托管 | GitHub Pages，GitHub Actions 自动构建部署 |
| 语言 | 简体中文（`zh-CN`），日期时区 `Asia/Shanghai` |
| 依赖 | Node ≥ 22.23.4，npm |

---

## 1. 这是什么

一个纯静态的个人技术博客：没有后端、没有数据库、没有评论服务、没有统计脚本。
所有文章是 `src/content/blog/` 下的 Markdown 文件，`git push` 到 `main` 后由 GitHub Actions 构建成静态 HTML 并发布。

设计取舍：**内容优先**。宁可功能少，也不要为了一个花哨功能引入需要维护的服务。

---

## 2. 当前状态

已完成（本地已验证可构建、可预览）：

- [x] Astro 项目骨架、内容集合、TypeScript 严格模式
- [x] 站点元信息集中管理（`src/consts.ts`）—— 改标题/域名/作者只改一处
- [x] 首页 / 文章列表 / 文章详情 / 标签总览 / 标签详情 / 关于 / 404
- [x] RSS（`/blog/rss.xml`）、sitemap、robots.txt、Open Graph / Twitter 卡片
- [x] base 路径（`/blog`）正确性：站内链接、canonical、og:image、RSS 全部核对过
- [x] 中文排版：CJK 字体回落、日期本地化、代码块/表格/引用样式
- [x] 草稿机制（frontmatter `draft: true`，只在本地可见）
- [x] GitHub Actions 部署工作流
- [ ] GitHub 仓库创建 + 首次推送（待用户操作，见第 7 节）
- [ ] Pages 发布源切到 GitHub Actions（待用户操作）
- [ ] 替换 `USERNAME` 占位符（域名、GitHub 链接）

未做、也没打算现在做（见第 10 节待办）：评论、搜索、暗色模式、自定义域名。

---

## 3. 技术选型

### 为什么是 Astro

| 候选 | 优点 | 为什么没选 |
| --- | --- | --- |
| **Astro** ✅ | Markdown 内容集合自带 frontmatter 类型校验；默认零 JS，加载快；要交互时可以按需加 React/Vue/Svelte 组件；官方 GitHub Pages 部署方案成熟 | — |
| Hexo | 中文主题多（NexT/Butterfly），配置即用 | 主题魔改要跟一堆 EJS/pug 插件搏斗；生态偏旧，构建慢 |
| Hugo | 构建最快，单二进制无 Node 依赖 | 要学 Go template 语法；图片处理弱于 Astro |
| Jekyll | Pages 原生支持，不用写 Actions | 本机没有 Ruby；依赖 GitHub 端构建，本地/线上行为不一致，调试困难 |

### 为什么是「项目站」而不是「用户主页站」

- 项目站：仓库名 `blog`，地址 `https://USERNAME.github.io/blog/`，需要在配置里写 `base: '/blog'`
- 用户主页站：仓库必须叫 `USERNAME.github.io`，地址是根路径，配置简单

选项目站是因为以后可以再开别的仓库（比如作品集、文档站）互不影响。
代价是**所有站内链接必须过 `withBase()`**，这条是硬规矩，见第 9 节 FAQ。

### 为什么文章路由是 `/posts/` 而不是 `/blog/`

因为站点本身已经在 `/blog` 子路径下。如果文章路由也叫 `/blog`，最终 URL 会变成
`https://USERNAME.github.io/blog/blog/xxx/`，又长又容易看错。所以：

- 文章列表：`/blog/posts/`
- 文章详情：`/blog/posts/<文章文件名>/`
- 标签：`/blog/tags/`、`/blog/tags/<tag>/`

### 为什么用 Actions 部署，而不是 `gh-pages` 分支

Astro 7 对 Node 版本有要求（`>=22.23.4`），`gh-pages` 分支方案需要本地构建再推产物；
Actions 方案让"构建环境"和"仓库内容"分离，也不会有构建产物污染 git 历史。
官方 `withastro/action` 已经把 install/build/upload 包好了，工作流只有 30 行。

---

## 4. 目录结构

```
blog/
├── PROJECT.md              ← 本文件，唯一入口文档
├── README.md               ← GitHub 首页展示，指回本文件
├── astro.config.mjs        ← Astro 配置（site/base 从 consts.ts 读）
├── package.json            ← 依赖与脚本
├── tsconfig.json           ← TypeScript 严格模式
├── .github/workflows/
│   └── deploy.yml          ← GitHub Pages 构建部署
├── docs/
│   └── post-template.md    ← 新建文章的模板
├── public/                 ← 原样拷贝到站点根目录
│   └── favicon.svg
└── src/
    ├── consts.ts           ← ★ 站点信息 + 导航（改标题/域名/作者就这里）
    ├── content.config.ts   ← 文章 frontmatter 的 schema（类型校验）
    ├── content/blog/       ← ★ 所有文章（.md / .mdx）
    ├── assets/             ← 需要被 Astro 优化的图片、字体
    ├── components/
    │   ├── BaseHead.astro  ← <head> 里的一切：SEO、OG、RSS、字体
    │   ├── Header.astro    ← 顶栏导航
    │   ├── Footer.astro    ← 页脚
    │   ├── PostList.astro  ← 文章列表（首页和列表页共用）
    │   ├── FormattedDate.astro
    │   └── HeaderLink.astro ← 导航高亮
    ├── layouts/
    │   └── BlogPost.astro  ← 文章页布局
    ├── pages/
    │   ├── index.astro     ← 首页（最新 5 篇）
    │   ├── about.astro     ← 关于
    │   ├── 404.astro
    │   ├── rss.xml.js
    │   ├── robots.txt.ts
    │   ├── posts/
    │   │   ├── index.astro ← 文章列表 /posts/
    │   │   └── [...slug].astro ← 文章详情
    │   └── tags/
    │       ├── index.astro ← 标签总览
    │       └── [tag].astro ← 单个标签
    ├── styles/global.css   ← 全局样式（Bearly 风格，已改中文字体栈）
    └── utils/url.ts        ← ★ withBase() 等路径工具，站内链接必用
```

产出目录 `dist/` 和缓存 `.astro/`、`node_modules/` 都不进 git。

---

## 5. 快速开始

```bash
cd /home/key/Work/blog
npm install            # 首次或依赖变更后

npm run dev            # 开发服务器，热更新
# → http://localhost:4321/blog/     ⚠️ 根路径 / 是 404，一定要带 /blog/

npm run build          # 生产构建，输出 dist/
npm run preview        # 用本地服务器预览 dist/，路径行为与 Pages 一致
# → http://localhost:4321/blog/
```

改端口：`npm run dev -- --port 4400`。

构建耗时参考（本机）：约 0.7 秒，10 个页面。

---

## 6. 写作流程

### 新建一篇

```bash
cp docs/post-template.md src/content/blog/my-new-post.md
# 编辑 frontmatter（title/description/pubDate/tags）和正文
npm run dev   # 浏览器里看效果
```

文件名就是 URL（去扩展名），用英文小写 + 连字符：`buildroot-qemu-audio.md` → `/blog/posts/buildroot-qemu-audio/`。
改了文件名等于改了 URL，已发出去的文章别随便改名（要改就接受旧链接 404）。

### frontmatter 字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `title` | ✅ | 标题 |
| `description` | ✅ | 摘要，用于列表、SEO、RSS |
| `pubDate` | ✅ | 发布日期，写 `2026-10-24` 即可（自动转 Date） |
| `updatedDate` | ❌ | 更新日期，填了文章页会显示「最后更新」 |
| `tags` | ❌ | 字符串数组，如 `[qemu, buildroot]`，默认空 |
| `heroImage` | ❌ | 封面图，写法 `heroImage: ../../assets/cover.jpg` |
| `draft` | ❌ | `true` 时只在 `npm run dev` 可见，`npm run build` 不输出 |

字段写错（类型不对、拼错名字）时**构建会直接报错**，这是故意的——比上线后发现白屏好。

### 图片

- 需要被优化（压缩、转 webp、生成响应式尺寸）的图放 `src/assets/`，正文里用相对路径引用
- 原样输出、不需要处理的（favicon、机器人验证文件）放 `public/`
- 不要在正文里写 `/images/xxx.png` 这种根路径，项目站会 404

### 标签约定

- **用小写英文或连字符**：`qemu`、`github-pages`。中文标签会进 URL 变成百分号编码，难看且容易出问题
- 标签会出现在文章页底部和 `/blog/tags/`，点进去是自动生成的列表页，不需要手工维护
- 同一概念只用一种写法（别同时用 `qemu` 和 `QEMU`）

---

## 7. 上线部署

### 一次性配置（只做一次）

1. 在 GitHub 创建仓库 `blog`（**不要**勾选 README/gitignore 初始化，避免首次推送冲突）
2. 本地关联远端并推送：
   ```bash
   cd /home/key/Work/blog
   git remote add origin https://github.com/USERNAME/blog.git
   git branch -M main
   git push -u origin main
   ```
   HTTPS 推送需要 Personal Access Token（`repo` 权限）；或者先配 SSH key 再换成 `git@github.com:USERNAME/blog.git`
3. 仓库 Settings → **Pages** → Build and deployment → Source 选 **GitHub Actions**
4. 改 `src/consts.ts` 里的占位符（见第 8 节），提交推送

### 日常发布

```bash
npm run build      # 可选，本地先确认能构建
git add -A
git commit -m "post: 文章标题"
git push
```

推送后 GitHub Actions 自动跑：`build` → `deploy`，大约 1 分钟。进度在仓库 Actions 页面看。

### 回滚

Pages 的每次部署都对应一次运行记录，最快的回滚是把出问题的提交 revert 后重新推送：

```bash
git revert HEAD
git push
```

### 验证线上是否真的更新了

浏览器打开 `https://USERNAME.github.io/blog/?v=$(date +%s)` 强制绕过缓存，或者看 Actions 里最新一次 `deploy` 是否绿色。

---

## 8. 上线前检查清单

- [ ] `src/consts.ts` → `url`：`https://你的用户名.github.io`（**不要**带 `/blog`）
- [ ] `src/consts.ts` → `base`：项目站保持 `/blog`；若改成用户主页站改成 `/`
- [ ] `src/consts.ts` → `github`：你的 GitHub 主页地址
- [ ] `src/consts.ts` → `title` / `description` / `author`
- [ ] `src/pages/about.astro`：里面有一处 `TODO`，换成真实自我介绍
- [ ] 删掉示例文章 `src/content/blog/hello-world.md`、`astro-github-pages-notes.md`（或保留作为参考）
- [ ] 草稿 `qemu-buildroot-vexpress-a9.md` 补完实测后去掉 `draft: true`

改完 `base` 后务必 `npm run build` 再 `npm run preview`，确认没有出现 `/blog/blog` 这种重复前缀的链接。

---

## 9. 常见问题（踩过的坑都在这）

**1. 本地打开 `http://localhost:4321/` 是 404**
正常。站点配置了 `base: '/blog'`，所有页面都在 `/blog/` 下。dev 和 preview 都一样。

**2. 线上点某个链接 → 404，或者地址里出现 `/blog/blog/...`**
说明这个链接被拼接了两次 base。检查：
- 页面里是否直接写了 `/blog/xxx` 的硬链接 → 改成 `withBase('/xxx')`
- 是否对 `Astro.url.pathname` 又套了一层 `withBase()` → pathname 本身就含 base，不要再加

**3. 样式全部丢失、页面像纯文本**
说明 CSS 没加载。本项目 CSS 是内联进 HTML 的，如果出现这种情况通常是资源路径被写成了绝对根路径（`/foo.css`），或者 `astro.config.mjs` 的 `base` 和实际部署路径不一致。

**4. 部署成功但线上还是旧内容**
两个原因：Pages 有缓存（加 `?v=时间戳` 验证），或者 Settings → Pages 的 Source 还停在 "Deploy from a branch"（必须选 GitHub Actions）。

**5. Actions 里 deploy 步骤报权限/认证错误**
`permissions` 少写了 `id-token: write`。三个权限缺一不可：`contents: read`、`pages: write`、`id-token: write`。

**6. 草稿文章上线了**
`draft: true` 只在 `getCollection` 过滤生效，新增页面时必须带上 `import.meta.env.DEV || !data.draft` 这个过滤条件。目前首页、列表页、文章页、RSS、标签页都已带。

**7. 日期显示差一天**
构建机（GitHub CI）是 UTC 时区。`FormattedDate.astro` 里固定了 `timeZone: 'Asia/Shanghai'`，不要删。frontmatter 写 `2026-10-24` 这种纯日期即可。

**8. 中文显示成方块或字体很怪**
`global.css` 的 `font-family` 里 Atkinson 只覆盖拉丁字符，中文回落到系统字体（Noto Sans CJK / 苹方 / 雅黑）。如果整站都成方块，是系统缺中文字体，与站点无关。

**9. 想换域名（比如自己的 .com）**
两步：① 在 `public/` 放 `CNAME` 文件，内容一行域名；② 改 `src/consts.ts` 的 `url` 为 `https://新域名`、`base` 改为 `/`。然后全站链接会自动变，因为都走了 `withBase()`。

**10. `npm run build` 报 content schema 错误**
frontmatter 字段类型不对。报错信息里有文件名和字段名，按 `src/content.config.ts` 里的 schema 改。

---

## 10. 待办 / 可选增强

按性价比排序，做之前先想清楚是否真的需要（每加一个功能就多一份维护成本）：

- [ ] **评论**：giscus（基于 GitHub Discussions，无后端、无广告）。需要在 GitHub 开 Discussions 并装 giscus app
- [ ] **暗色模式**：`prefers-color-scheme` + CSS 变量，`global.css` 里已经有 CSS 变量结构，改造成本低
- [ ] **文章目录（TOC）**：从 Astro 的 `render()` 结果里取 `headings`，右侧固定栏
- [ ] **阅读时长**：构建时按字数估算
- [ ] **OG 图自动生成**：`astro-og-canvas` 之类，省得每篇手画封面
- [ ] **站内搜索**：`pagefind`（构建后生成索引，纯静态）
- [ ] **上一篇/下一篇**导航
- [ ] **统计**：如果用，选无 cookie 的（如 Cloudflare Web Analytics），不要塞 Google Analytics

---

## 11. 决策记录（ADR）

| 日期 | 决策 | 理由 |
| --- | --- | --- |
| 2026-10-24 | 用 Astro 而非 Hexo/Hugo/Jekyll | 内容集合有类型校验、零 JS 默认、可渐进加交互组件；本机已有 Node |
| 2026-10-24 | 用项目站 `USERNAME.github.io/blog` | 以后可并置多个站点；代价是所有链接必须走 `withBase()` |
| 2026-10-24 | 文章路由用 `/posts/` 而非 `/blog/` | 避免 `/blog/blog/xxx` 的双重嵌套 |
| 2026-10-24 | 部署用 GitHub Actions + artifact | 构建与内容分离，不污染 git 历史，无 `gh-pages` 分支维护成本 |
| 2026-10-24 | 站点信息集中到 `src/consts.ts` | 换域名/改标题只改一处，`astro.config.mjs` 也从这里读 |
| 2026-10-24 | 不做评论/统计（暂缓） | 先保证内容产出，功能等真有读者再加 |

---

## 12. 变更日志

> 每次改动都往下加一行。日期用本地时间（CST）。

| 日期 | 改动 |
| --- | --- |
| 2026-10-24 | 初始化项目：Astro 7 blog 模板，改为中文站点（consts.ts 集中配置、中文导航/页脚/关于页/404） |
| 2026-10-24 | 加 `src/utils/url.ts`（withBase/absoluteUrl/postUrl/tagUrl），全站站内链接改为 base 安全写法 |
| 2026-10-24 | 文章路由 `/blog` → `/posts`，修复 canonical/og:image 重复拼 base 的问题，RSS 频道链接补 base |
| 2026-10-24 | 新增标签系统（`/tags`、`/tags/[tag]`）、草稿机制（`draft`）、robots.txt、sitemap 校验 |
| 2026-10-24 | 中文排版：CJK 字体栈、日期本地化（Asia/Shanghai）、代码块/表格/引用样式 |
| 2026-10-24 | 加 GitHub Actions 部署工作流；示例文章 3 篇（其中 1 篇为草稿）；写 PROJECT.md / README.md / docs/post-template.md |
| 2026-10-24 | 修复导航高亮：`HeaderLink` 比较前先归一化 base 与尾部斜杠（否则 `/blog/posts` ≠ `/blog/posts/`，文章页导航不高亮） |
| 2026-10-24 | 本地全量验证：`npm run build` 通过（10 页，0.7s）；dev/preview 下 `/blog/`、`/blog/posts/`、文章页、`/blog/tags/`、`/blog/about` 均 200；`/` 为 404（符合 base 设定）；草稿仅 dev 可见；构建产物无 `/blog/blog` 重复前缀 |
