---
title: 堆利用：fastbin dup 与 tcache 的差别
description: "glibc 2.31 之后 tcache 的检查变严，同一份 dup 思路要跟着改。"
pubDate: 2026-10-15
category: pwn
tags: [heap, tcache]
---

> 占位：这篇还没写，先占个位置看版面效果。要删就删掉这个文件。

## 想写什么

- 复现步骤（命令、版本、环境）
- 当时卡住的地方
- 最后怎么绕过去的
