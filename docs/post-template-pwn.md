---
title: 题目/目标名 —— 漏洞点一句话
description: 一句话说清打了什么、卡在哪、最后怎么绕的；会出现在列表和 RSS 里。
category: pwn
pubDate: 2026-10-25
tags: [stack, ret2libc]
# order: 1        # 同一系列（比如某比赛题集）想固定顺序时填
# draft: true     # 还没写完就先标草稿，只在 npm run dev 里可见
---

## 环境

```bash
# 文件、libc、启动命令，能复现的最小信息
file ./chall
./libc.so.6 | head -1
# nc chall.example.com 1337
```

## 保护

```bash
checksec --file=./chall
# Arch:     amd64-64-little
# RELRO:    Partial RELRO
# Stack:    No canary found
# NX:       NX enabled
# PIE:      No PIE
# 写一句这些保护意味着什么：哪些手法被堵了、还剩什么路
```

## 漏洞点

<!-- 反编译片段或伪代码，标明偏移/长度/可控字节数 -->

## 思路

<!-- 利用链的文字描述：泄漏 -> 计算基址 -> 覆写 -> get shell，为什么这么做 -->

## 利用

```python
from pwn import *

context.binary = elf = ELF('./chall')
libc = ELF('./libc.so.6')
p = process('./chall')   # 或 remote('host', port)

# 每一步加注释，写清 payload 的布局
```

## 踩到的坑

<!-- 这类题最容易忘的地方：对齐、栈上残留、one_gadget 约束、字节序、recv 时机 -->

## 小结

<!-- 一句话：这题学到了什么，下次遇到同类怎么下手 -->
