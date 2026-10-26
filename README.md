# Findkey

个人技术博客，Astro + GitHub Pages，纯静态。文章按**分类**组织，简约排版优先。

- **完整文档（结构、命令、写作规范、视觉规范、踩坑记录、变更日志）：[`PROJECT.md`](./PROJECT.md)**
- 线上地址：`https://find-key.github.io/`

```bash
npm install
npm run dev      # http://localhost:4321/
npm run build    # 输出 dist/
npm run preview  # 本地预览生产构建
```

写文章：`cp docs/post-template.md src/content/blog/新文章名.md`，frontmatter 里 **`category` 必填**（取值见 `src/consts.ts` 的 `CATEGORIES`）。

> 改任何东西之后，记得在 `PROJECT.md` 的「变更日志」里加一条。

## 日常操作

写文章、加分类、加友链、改站点信息：见 [`docs/how-to.md`](docs/how-to.md)。

项目结构、设计决策、踩坑记录：见 [`PROJECT.md`](PROJECT.md)。
