# PROJECT.md

这个仓库的**计划与约定**。日常用法看 [`README.md`](./README.md)，给编码助手的硬性规则看 [`AGENTS.md`](./AGENTS.md)。

## 一、这是什么

个人技术博客：内容以二进制漏洞（pwn）为主，另有嵌入式 / IoT、工具笔记与比赛题解。设计走「纸感简约」——暖白纸底、衬线标题、发丝线、墨绿单一强调色，不看图不靠动画。

- 线上：<https://find-key.github.io/>（GitHub 用户站，根路径）
- 文章 16 篇，分类 5 个（pwn / WP / V8 / 嵌入式与 IoT / 工具与笔记）

## 二、技术栈与硬约束

| 项 | 选择 | 原因 |
| --- | --- | --- |
| 框架 | Astro 7，静态输出 | 零 JS 运行时，构建快 |
| 样式 | 手写 CSS + 自定义属性 | 视觉是定制的，不引 UI 框架 |
| 公式 | remark-math + rehype-katex | 构建期渲染成 HTML |
| 代码高亮 | Shiki（github-light） | 与纸感配色最贴 |
| 字体 | 系统字体栈 | 不加载 webfont，避免闪烁 |
| 部署 | gh-pages 分支 | 见第六节 |

## 三、目录

```
src/consts.ts          站点信息 / 导航 / 分类 / 友链  ← 唯一配置源
src/content/blog/      文章（.md）
src/content.config.ts  frontmatter schema（构建时校验）
src/components/        Header Footer PostList Toc BaseHead CodeTools
src/layouts/BlogPost  文章页（引入 KaTeX 样式、目录、代码块增强）
src/pages/            index posts categories tags links 404
src/utils/url.ts      withBase() / postUrl() / categoryUrl() / tagUrl()
scripts/              new-post / deploy-pages / admin(已下线)
```

## 四、约定

1. **站内链接**一律用 `src/utils/url.ts` 的函数。硬写 `/posts/x/` 在换部署路径时会全站失效。
2. **元信息只改 `src/consts.ts`**：标题、描述、域名、base、导航、分类、友链。
3. **文章路由** `/posts/<slug>/`；分类 `/categories/<slug>/`；标签 `/tags/<tag>/`。
4. **新增页面查询文章必须过滤草稿**：`getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft)`。
5. **frontmatter 新字段**先改 `src/content.config.ts`。
6. **标签**用小写英文 / 连字符（会进 URL）。
7. 日期显示固定 `Asia/Shanghai`。
8. 块级链接 hover 只变字色 / 细下划线；墨绿只用于站头当前栏目和正文行内链接。

## 五、写作与排版

- 标题最多 3 级（`##` / `###` / `####`），小标题过多时目录只列 `##`
- 中文里用全角标点，数字与代码不受影响
- 代码块 4 空格缩进；超过 26 行自动折叠，右上角可复制
- 伪代码 / 反编译代码的注释对齐到同一列
- 参考文献放文末列表，不用脚注

## 六、部署现状

```
仓库     Find-key.github.io（public，用户站）
地址     https://find-key.github.io/
base     ''        ← 用户站在根路径
发布     npm run deploy → 强推 gh-pages → Pages「Deploy from a branch」
```

**为什么不走 GitHub Actions**：账号 billing 被锁，workflow 的 job 起不来（日志原文 *The job was not started because your account is locked due to a billing issue*）。Pages 自己的 `pages-build-deployment` 不受影响，所以改成「本地构建 + 推分支」。

**要切回 Actions**：`github.com/settings/billing` 解锁 → Settings → Pages → Source 改 **GitHub Actions** → 之后 push `main` 即自动部署，`gh-pages` 分支可删。

## 七、路线图

- [x] 站点骨架、纸感视觉、首页 / 归档 / 分类 / 标签 / 友链
- [x] 旧站 16 篇文章迁移、友链 14 条与本地头像
- [x] KaTeX 公式、代码块复制与长块折叠、伪代码对齐
- [x] 全站措辞与格式两轮审校（补机制说明、修事实错误）
- [x] 部署到 GitHub Pages（gh-pages 分支模式）
- [ ] **写作后台重写**：原 `npm run admin`（127.0.0.1:4322，四视图 + 软删除）已清空，只留入口占位，以后重新设计
- [ ] billing 解锁后切回 GitHub Actions 自动部署
- [ ] 新文章：还在写 pwn，方向是 kernel / V8

## 八、踩过的坑

| 现象 | 原因 |
| --- | --- |
| 全站 404 / 链接多一层前缀 | 手写了带 base 的绝对路径；改用 `withBase()` |
| `[hidden]` 不生效 | 作者样式里的 `display: flex` 盖过了 UA 的 `display: none` |
| 表格渲染成一坨 | 分隔行写成 `\| - \| - \|`，必须是 `\| --- \|` |
| Shiki 的背景改不动 | `<pre>` 上是内联 `background-color`，要 `!important` |
| 中文断行很怪 | 从旧站复制来的 NBSP（U+00A0），全局替换成普通空格 |
| 站点打不开，GitHub 返回 "Site not found" | Pages 没发布：私有仓库无 Pages 权限，或 Source 选错 |
