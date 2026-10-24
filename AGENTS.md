# AGENTS.md — 给编码助手/未来自己的项目约定

## 先读这个

**`PROJECT.md` 是本项目的唯一入口文档**（结构、命令、写作规范、踩坑记录、决策记录）。
动手前先读它；**任何改动完成后，必须在它的「变更日志」追加一条**，并更新「当前状态」。

## 硬性约定

1. **站内链接一律用 `src/utils/url.ts` 的 `withBase()` / `postUrl()` / `tagUrl()`**
   站点部署在 `https://<user>.github.io/blog`，硬写 `/blog/xxx` 在换域名或改 base 时会全部失效。
   页面内相对引用 `Astro.url.pathname` 时不要再套 `withBase()`——pathname 已含 base，会变成 `/blog/blog/`。
2. **站点元信息只在 `src/consts.ts` 改**（标题、描述、作者、域名、base、导航、社交链接）。
   `astro.config.mjs` 从那里读，不要在两处各写一份。
3. **文章路由是 `/posts/<slug>/`**，不是 `/blog/<slug>/`（避免 `/blog/blog/` 双重嵌套）。
4. **新增页面时，文章查询必须带草稿过滤**：`getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft)`。
5. frontmatter 字段定义在 `src/content.config.ts`，新增字段先改 schema。
6. 标签用小写英文/连字符（会进 URL），别用中文。
7. 日期显示固定 `Asia/Shanghai`，见 `FormattedDate.astro`。

## 开发与验证

启动开发服务器用后台模式：

```
astro dev --background
```

用 `astro dev stop`、`astro dev status`、`astro dev logs` 管理。
**注意**：dev 和 preview 的站点根路径都是 `http://localhost:4321/blog/`，访问 `/` 是 404，不是 bug。

改完必须验证：

```bash
npm run build     # 必须通过（content schema 会在这一步校验 frontmatter）
npm run preview   # 抽查 /blog/、/blog/posts/、/blog/tags/、文章页
```

重点核对构建产物里的链接前缀：

```bash
grep -oE '(href|src)="[^"]*"' dist/index.html | grep -v https:// | sort -u   # 不应出现 /blog/blog/
```

## 文档

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
