# Findkey 的博客

个人技术博客，Astro + GitHub Pages，纯静态。

- **完整文档（结构、命令、写作规范、踩坑记录、变更日志）：[`PROJECT.md`](./PROJECT.md)**
- 线上地址：`https://USERNAME.github.io/blog/` ← 上线前替换 `USERNAME`

```bash
npm install
npm run dev      # http://localhost:4321/blog/
npm run build    # 输出 dist/
npm run preview  # 本地预览生产构建
```

写文章：`cp docs/post-template.md src/content/blog/新文章名.md`，然后编辑。

> 改任何东西之后，记得在 `PROJECT.md` 的「变更日志」里加一条。
