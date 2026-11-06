# AGENTS.md — 给编码助手的约定

动手前先读 [`PROJECT.md`](./PROJECT.md)（计划、结构、约定、部署）。

> 部署 / 推送的操作手册是本地 `README.md`（不进仓库，已 gitignore）。

## 硬性规则

1. **站内链接一律用 `src/utils/url.ts`** 的 `withBase()` / `postUrl()` / `categoryUrl()` / `tagUrl()`。
   站点部署在用户站根路径（`base: ''`），但硬写 `/posts/x/` 这类绝对路径在换部署方式时会全站失效。
   从 `Astro.url.pathname` 取到的路径**已经含 base**，不要再套一层 `withBase()`。
2. **站点元信息只在 `src/consts.ts` 改**（标题、描述、作者、域名、base、导航、分类、友链）。
   `astro.config.mjs` 从这里读，不要两处各写一份。
3. **frontmatter 字段以 `src/content.config.ts` 为准**；加字段先改 schema。
4. **新增页面查询文章必须带草稿过滤**：`getCollection('blog', ({ data }) => import.meta.env.DEV || !data.draft)`。
5. **分类 slug 用小写英文 / 连字符**，标签同理（都会进 URL）。
6. 日期显示固定 `Asia/Shanghai`（见 `FormattedDate.astro`）。

## 当前状态

- 部署：`npm run deploy` → 构建 + 推 `gh-pages`；改代码只 push main 不会更新线上。
- 写作后台：`scripts/admin.mjs` 只剩入口占位，实现已清空，等重写。
- 不要新增依赖除非确有需要；本站刻意保持零 JS 运行时（代码块交互那几个脚本除外）。

## 验证

```bash
npm run build     # 必须通过（content schema 会校验 frontmatter）
npm run preview   # 抽查 /、/posts/、/tags/、文章页
npm run deploy    # 需要上线时再跑
```

构建产物里不应出现重复前缀的链接：

```bash
grep -oE '(href|src)="[^"]*"' dist/index.html | grep -v 'https://' | sort -u
```
