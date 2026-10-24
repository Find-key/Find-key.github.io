---
title: 文章标题（不用带日期，也不用带引号）
description: 一句话摘要，会出现在列表、SEO description、RSS 里，建议 40-80 字。
# 必填！必须是 src/consts.ts 里 CATEGORIES 的某个 slug，写错构建会报错
category: embedded
pubDate: 2026-10-24
# updatedDate: 2026-10-26   # 可选：改过内容就填，文章页会显示「更新于」
# order: 1                  # 可选：同分类内的阅读顺序（系列文章用）
tags: [qemu, buildroot]     # 可选：小写英文/连字符，别用中文
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

> 发布前确认：`category` 填了、`draft` 没留 `true`、文件名是英文小写连字符。
