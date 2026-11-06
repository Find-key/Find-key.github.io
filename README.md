# Findkey

个人技术博客：Astro 静态站，部署在 GitHub Pages，纯前端无框架。

**线上：<https://find-key.github.io/>**

## 命令

```bash
npm install
npm run dev        # 本地 http://localhost:4321/
npm run build      # 构建到 dist/
npm run preview    # 本地预览构建产物
npm run deploy     # 构建并发布到 gh-pages（线上生效用这个）
npm run new -- "标题" --cat pwn --tags stack,ret2text   # 新建文章
```

## 写作

文章放 `src/content/blog/<slug>.md`，frontmatter 必填 `title` / `description` / `pubDate` / `category`：

```yaml
---
title: "标题"
description: "一句话摘要（列表与 SEO 用）"
pubDate: 2026-10-25
category: pwn          # 取值见 src/consts.ts 的 CATEGORIES
tags: [stack, ret2text]
draft: false           # 可选，true 只在本地可见
---
```

正文从 `## 二级标题` 开始写，用 Markdown；`$...$` / `$$...$$` 渲染 KaTeX 公式。

**分类、友链、站点信息**都在 `src/consts.ts` 里改，别在别处重复定义。

## 部署

```bash
npm run deploy     # 构建 + 推 gh-pages 分支，1~2 分钟后线上更新
```

Pages 的 Source 是 **Deploy from a branch → gh-pages / (root)**。
账号 billing 目前被锁，GitHub Actions 起不来，所以不走 Actions；解锁后可以把 Source 切回 GitHub Actions，届时 push main 即自动部署（`.github/workflows/deploy.yml` 一直留着）。

改代码只 push main **不会**更新线上，必须再跑 `npm run deploy`。

## 结构

```
src/
  consts.ts            站点信息、导航、分类、友链（唯一配置源）
  content/blog/        文章
  content.config.ts    frontmatter schema
  components/          Header / Footer / PostList / Toc / BaseHead / CodeTools
  layouts/BlogPost.astro
  pages/               index / posts / categories / tags / links / 404
  utils/url.ts         withBase() / postUrl() / categoryUrl() / tagUrl()
scripts/
  new-post.mjs         新建文章
  deploy-pages.mjs     发布到 gh-pages
  admin.mjs            写作后台（已下线，保留入口）
public/                favicon、头像、友链头像
```

## 约定

- 站内链接一律走 `src/utils/url.ts` 的函数，别手写 `/xxx` 绝对路径（改部署路径时全站会失效）
- 站点元信息只改 `src/consts.ts`
- 标签用小写英文 / 连字符，会进 URL
- 改动后在 `PROJECT.md` 的路线图里勾掉对应项
