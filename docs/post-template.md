---
title: 文章标题（不用带日期，也不用带引号）
description: 一句话摘要，会出现在列表、SEO description、RSS 里，建议 40-80 字。
pubDate: 2026-10-24
# updatedDate: 2026-10-26   # 可选：改过内容就填，文章页会显示「最后更新」
tags: [qemu, buildroot]     # 可选：小写英文/连字符，别用中文
# heroImage: ../../assets/cover.jpg  # 可选：封面图，图片放 src/assets/
# draft: true               # 可选：草稿，只在 npm run dev 时可见
---

正文从这里开始。一级标题（`#`）不要写——文章标题已经由 frontmatter 的 `title` 渲染，
正文从二级标题开始。

## 二级标题

普通段落。行内代码用反引号：`ls -l`。

```bash
# 代码块建议写清楚语言，方便高亮
make qemu_arm_vexpress_defconfig
```

### 三级标题

- 列表项
- 列表项

> 引用块，用来放「结论」或「注意」。

表格也可以：

| 参数 | 含义 |
| --- | --- |
| `-M` | 机器类型 |
| `-sd` | 挂到 SD 控制器 |

---

写作习惯建议：

1. 每篇尽量带上**可复现的命令**和**当时的报错原文**
2. 结尾留一句「这次学到什么」，三个月后回看最有用
3. 写完在本地 `npm run dev` 里过一遍，重点看代码块和表格有没有溢出
