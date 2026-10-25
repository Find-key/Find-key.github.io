---
title: "Astro 部署到 GitHub Pages 项目站的三个坑"
description: "base 路径、Actions 权限、404 页面——项目站（user.github.io/blog）比用户主页站多踩的三脚。"
pubDate: 2026-10-24
category: meta
tags: [astro, github-pages]
---

用 GitHub Pages 托管**项目站**（地址是 `https://<user>.github.io/blog`，而不是 `https://<user>.github.io`）时，站点并不在域名根目录，而是在 `/blog` 子路径下。这三个坑都来自同一件事。

## 坑一：写死 `/blog/xxx` 的链接，换域名就全废

页面里写 `<a href="/blog">` 看着没问题，但只要以后挂自定义域名，或者改成用户主页站，所有链接都会 404。更糟的是本地 `dev` 和线上行为还不一样。

正确做法是只写逻辑路径，让 Astro 拼前缀：

```ts
// src/utils/url.ts
const BASE = import.meta.env.BASE_URL.replace(/\/+$/, ''); // '/blog' 或 ''

export function withBase(path: string): string {
	if (/^(https?:)?\/\//.test(path)) return path; // 外链原样返回
	return `${BASE}/${path.replace(/^\/+/, '')}` || '/';
}
```

然后模板里一律 `withBase('/blog')`。`astro.config.mjs` 里配：

```js
export default defineConfig({
	site: 'https://USERNAME.github.io', // 注意：不带 /blog
	base: '/blog',
});
```

`sitemap()`、`canonical`、`og:image` 都吃这套配置，所以最好把站点标题、域名、base 全部塞进一个 `consts.ts`，只改一处。

## 坑二：Pages 的发布源必须选 GitHub Actions

仓库 Settings → Pages → Build and deployment → Source 选 **GitHub Actions**，不是 "Deploy from a branch"。否则推上去的 artifact 根本不会被发布，Pages 页面一直显示旧内容。

工作流本身很短，官方 action 已经把 install / build / upload 包好了（v6 起默认 Node 24）：

```yaml
permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: withastro/action@v6
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v5
```

`permissions` 少写一个 `id-token: write`，deploy 步骤会报认证失败——这是最容易漏的一行。

## 坑三：404 页面和「以为部署了没生效」

- Astro 构建出的 `dist/404.html` 会被 Pages 自动当作 404 页。项目站的 404 页地址是 `/blog/404.html`，页面里的返回链接同样要走 `withBase('/')`，不然又是一个死链。
- Pages 有缓存，加上 Actions 跑完还要几十秒发布，改完立刻刷新很可能看到旧版本。带个查询串 `?v=2` 验证，或者去 Actions 页面确认最新一次 `deploy` 步骤成功。

## 本地怎么验证

线上问题最好在本地先复现。构建产物是纯静态的，用 `preview` 起个本地服务器，路径行为和 Pages 一致：

```bash
npm run build
npm run preview   # 打开 http://localhost:4321/blog/
```

注意本地 dev server 的地址也是带 base 的 `http://localhost:4321/blog/`，直接访问根路径 `/` 会 404——第一次遇到容易以为站点坏了。
