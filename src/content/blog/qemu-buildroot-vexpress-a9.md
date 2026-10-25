---
title: 用 QEMU 跑 Buildroot 的 vexpress-a9 最小系统
description: 一条 make、一条 qemu-system-arm，把 Buildroot 的镜像塞进 SD 卡控制器启动。附我踩过的几个参数坑。
pubDate: 2026-10-26
category: kernel
order: 1
tags: [qemu, buildroot, embedded]
draft: true
---

> 这是一篇**草稿**（frontmatter 里 `draft: true`）：只在本地 `npm run dev` 能看到，`npm run build` 不会发布。用来演示草稿机制，也留个位置给实测记录。

## 准备

```bash
make qemu_arm_vexpress_defconfig
make            # 首次编译比较久，可以 -j$(nproc)
```

产物在 `output/images/` 下：`zImage`、`vexpress-v2p-ca9.dtb`、`rootfs.ext2`。

## 启动

```bash
qemu-system-arm \
  -M vexpress-a9 \
  -kernel output/images/zImage \
  -dtb output/images/vexpress-v2p-ca9.dtb \
  -sd output/images/rootfs.ext2 \
  -append "root=/dev/mmcblk0 rw console=ttyAMA0" \
  -nographic
```

要点：

- `-sd` 会把镜像挂到 SD 控制器上，内核里看到的是 `/dev/mmcblk0`；如果用 `-drive if=sd` 也是同一回事
- 串口控制台是 `ttyAMA0`（PL011），`-nographic` 之后 `Ctrl-A X` 退出
- 没有 `console=` 的话，启动日志会全部丢掉，看起来像卡死

<!-- TODO: 补上实际启动日志、遇到的报错、以及加 virtio-sound-device 做音频实验的部分 -->
