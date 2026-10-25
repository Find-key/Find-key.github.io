---
title: "V8 学习笔记 0x00"
description: "迈向 V8 的第一步，先搭个环境来，用来编译 V8 源码"
pubDate: 2026-04-20
category: v8
tags: [v8]
order: 1
---

## Docker 环境

先写 Dockerfile：
```bash
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    git python3 python3-pip curl wget unzip clang cmake ninja-build \
    build-essential pkg-config gnupg lsb-release vim gdb

ENV DEPOT_TOOLS=/opt/depot_tools
ENV PATH="$DEPOT_TOOLS:$PATH"

RUN git clone https://chromium.googlesource.com/chromium/tools/depot_tools.git $DEPOT_TOOLS

WORKDIR /work
```

构建镜像：
```bash
docker build -t v8 .
```

挂载源码目录：
```bash
docker run -it \
-v ./V8:/work \
-w /work \
--name finder \
--hostname work \
v8 \
bash
```

## 构建 V8
来到工作目录，拉取源码（`fetch` 来自 depot_tools）：
```bash
fetch v8
```

### debug 构建
```bash
cd v8
tools/dev/v8gen.py x64.debug  
ninja -C out.gn/x64.debug -j2 d8
```

如果对电脑性能有信心，可以把 `-j2` 参数改成 `-j4` 或者直接去掉。

### no_pc 构建
debug 还是太麻烦了，指针压缩也可以暂时关掉
```bash
cd v8
gn gen out/x64.release.no_pc --args='target_os = "linux"
target_cpu = "x64"
is_component_build = false
is_debug = false
v8_monolithic = true
v8_use_external_startup_data = false
symbol_level = 2
v8_enable_i18n_support= false
v8_enable_pointer_compression = false
v8_enable_backtrace = true
v8_enable_disassembler = true
v8_enable_object_print = true
v8_enable_verify_heap = true'
ninja -C out/x64.release.no_pc -j4 d8
```

## GDB 配置

V8 自带两个 gdb 辅助脚本，追加到 `~/.gdbinit` 就能用 `job`、`jsobj` 这类命令：

```bash
echo "source /home/key/Work/Pwn/Knowledges/V8/v8/tools/gdbinit" >> ~/.gdbinit
echo "source /home/key/Work/Pwn/Knowledges/V8/v8/tools/gdb-v8-support.py" >> ~/.gdbinit
```
