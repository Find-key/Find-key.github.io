---
title: "VM helper"
description: "在分析 VM 题中，运用 gdb 脚本进行 trace 分析 opcode"
pubDate: 2025-12-08
category: tools
tags: [gdb-script]
---

## 前言
在写 DASCTF 2025 下半年赛的 VM 题的时候，觉得分析题目给的 vmcode 很麻烦，就想着能不能 trace 。
本来想用 frida 也试试的，但是遇到了神秘问题，便尝试使用 gdb 脚本了，发现效果还不错。

## 分析
附件给了 vvmm 和 vmcode，就是解释器和代码，之前都是让挑战者自己输入代码然后用解释器执行。
第二次遇到用解释器去跑 vmcode 然后交互的。

### 解释器：vvmm
程序部分
```C
void __fastcall __noreturn main(int a1, char **a2, char **a3)
{
  int fd; // [rsp+Ch] [rbp-14h]
  char *buf; // [rsp+10h] [rbp-10h]
  vm *s; // [rsp+18h] [rbp-8h]

  init();
  s = (vm *)malloc(0x30uLL);
  memset(s, 0, sizeof(vm));
  buf = (char *)mmap(0LL, 0x30000uLL, 7, 34, -1, 0LL);
  s->code = buf;
  fd = open("./vmcode", 0);
  read(fd, &s->ip, 4uLL);
  while ( (unsigned int)read(fd, buf, 0x400uLL) )
    buf += 0x400;
  s->sp = 0x30000;
  run(s);
}

void __fastcall __noreturn run(vm *m)
{
  int type; // eax
  op *opinfo; // [rsp+18h] [rbp-8h]

  opinfo = (op *)malloc(0xCuLL);
  memset(opinfo, 0, 8uLL);
  do
  {
    if ( (unsigned int)GetOpType(m, opinfo) == -1 )
      break;
    type = opinfo->val & 3;
    if ( type == 3 )
    {
      opt3(m, opinfo);
    }
    else if ( (opinfo->val & 3u) <= 3 )
    {
      if ( type == 2 )
      {
        opt2(m, opinfo);
      }
      else if ( (opinfo->val & 3) != 0 )
      {
        opt1(m, opinfo);
      }
      else
      {
        opt0(m, opinfo);
      }
    }
    memset(opinfo, 0, sizeof(op));
    if ( m->sp > 0x30000u )
      break;
  }
  while ( m->ip <= 0x30000u );
  puts("Segment error");
  _exit(0);
}
```
结构体部分
```C
struct vm
{
  char *code;
  int ip;
  int r[6];
  int sp;
  char flag;
};

struct op
{
  char val;
  char type;
  char pad[2];
  int num1;
  int num2;
};
```
逆向解释器部分并非本文的重点，笔者就简单写写了，opt 那几个函数我就不给出了

### 代码：vmcode
hexdump 或者 010 之类的工具可以看到值
```
(Pwn) air@Air-key ~/w/P/M/D/2/d/mvmp> hexdump ./vmcode
0000000 0000 0000 0090 0800 008d 0047 6857 7461
0000010 002b 0004 0000 0047 7327 7920 002b 0004
0000020 0000 0047 756f 2072 002b 0004 0000 0047
0000030 616e 656d 002b 0004 0000 0043 0a3f 0000
0000040 008d 007d 00c0 6601 020e 8d00 0f01 0100
0000050 0000 7d00 7d02 7d01 c000 0000 c08b 0000
0000060 c00c 0000 944c 0000 ec08 0000 9000 0000
0000070 8d06 0f00 0001 0000 0f00 1802 0000 7d00
0000080 7d02 7d01 c000 0000 8d88 0f01 0000 0000
0000090 0f00 5002 0000 7d00 7d02 7d01 c000 0000
00000a0 8d1e 7d01 c001 0000 94a1 0000 ec06 0000
00000b0 0f00 0000 0000 cc00 0000 ec3c 0000 7d00
00000c0 8d05 2b05 0805 0000 3a00 0500 052b 0004
00000d0 0000 013a 2b05 0405 0000 3a00 0502 00d4
00000e0 0000 0581 00ec 0300 057d 058d 052b 0008
00000f0 0000 003a 2b05 0405 0000 3a00 0501 052b
0000100 0004 0000 023a d405 0000 8101 ec05 0000
0000110 7d03 8d05 2b05 0805 0000 3a00 0500 052b
0000120 0004 0000 013a 2b05 0405 0000 3a00 0502
0000130 030f 0000 0000 003e 8501 8500 0603 0203
0000140 80b0 0e00 0581 00ec 0300 057d 058d 052b
0000150 0008 0000 0090 0300 018d 000e 4701 6800
0000160 6c65 2b6c 0400 0000 4300 6f00 0020 0f00
0000170 0100 0000 0f00 0602 0000 7d00 7d02 7d01
0000180 c000 0080 3a9d 0501 017d 00c0 2000 020e
0000190 3a00 0501 000f 0001 0000 027d 017d 007d
00001a0 80c0 bc00 0094 0300 0581 00ec 0100 057d
00001b0 058d 052b 0008 0000 013a 0e05 0100 0232
00001c0 0700 0002 0000 a800 0000 8506 a400 0080
00001d0 2e13 0100 0581 00ec 0100               
00001da
```
但是对着分析还是太要精力了


尝试写 gdb 脚本，思路是当程序运行到 opt0、opt1、opt2、opt3 这些函数的时候，打印出当时的参数

```gdb script
start

python
import gdb

class VmTrace(gdb.Breakpoint):
    def __init__(self, addr):
        super().__init__(addr, temporary=False)

    def stop(self):

        rdi = gdb.parse_and_eval("$rdi")
        rsi = gdb.parse_and_eval("$rsi")

        print(f"rdi: {hex(int(rdi))}",end=", ")
        print(f"rsi: {hex(int(rsi))}")


        return False    # False = 自动 continue

VmTrace(f"*{gdb.parse_and_eval('$rebase(0x14DE)')}")

end

continue
```
像是这样，继承自 gdb 的 Breakpoint 类，在每次经过断点的时候打印了 rdi 和 rsi 的值

使用方法：`gdb -x ./sc --args ./vvmm` ，其中 `./sc` 就是脚本文件。

运行就会发现打印了好多 rdi 和 rsi 信息，然后是输入，输入完又是一大串信息，这样的话感觉不是很好，所以笔者选择让信息输出到 log 文件中，而不是标准输出，防止 trace 的信息妨碍看程序信息，修改后：
```gdb script
start

python
import gdb

f = open("./vm.log", "w")

class VmTrace(gdb.Breakpoint):
    def __init__(self, addr):
        super().__init__(addr, temporary=False)

    def stop(self):

        rdi = gdb.parse_and_eval("$rdi")
        rsi = gdb.parse_and_eval("$rsi")

        print(f"rdi: {hex(int(rdi))}, rsi: {hex(int(rsi))}", file=f)
        f.flush()


        return False    # False = 自动 continue

VmTrace(f"*{gdb.parse_and_eval('$rebase(0x14DE)')}")

end

continue
```
用同样的方法运行，发现成功将 trace 信息写入文件，那么开始下一步，解析参数。

```gdb script
start

python
import gdb

f = open("./vm.log", "w")

def analyse(*args):
    inf = gdb.selected_inferior()   # 获取调试实例

    vm_addr = args[0]
    info_addr = args[1]

    code_ptr = int.from_bytes(inf.read_memory(vm_addr + 0, 8), "little", signed=False)
    ip = int.from_bytes(inf.read_memory(vm_addr + 8, 4), "little", signed=False)
    regs = []
    for i in range(6):
        reg_val = int.from_bytes(inf.read_memory(vm_addr + 12 + i * 4, 4), "little", signed=False)
        regs.append(hex(reg_val))
    sp = int.from_bytes(inf.read_memory(vm_addr + 36, 4),
    "little", signed=False)
    flag = int.from_bytes(inf.read_memory(vm_addr + 40, 1), "little", signed=False)

    val = int.from_bytes(inf.read_memory(info_addr + 0, 1), "little", signed=False)
    val = val >> 2
    type_ = int.from_bytes(inf.read_memory(info_addr + 1, 1), "little", signed=False)
    num1 = int.from_bytes(inf.read_memory(info_addr + 4, 4), "little", signed=False)
    num2 = int.from_bytes(inf.read_memory(info_addr + 8, 4), "little", signed=False)


    print(f"Type: {hex(type_)} | val: {hex(val)} | num1: {hex(num1)} | num2: {hex(num2)} || VM ip: 0x{ip:X} | regs: {regs} | sp: 0x{sp:X} | flag: {flag}", file=f)


class VmTrace(gdb.Breakpoint):
    def __init__(self, addr):
        super().__init__(addr, temporary=False)

    def stop(self):

        rdi = int(gdb.parse_and_eval("$rdi"))
        rsi = int(gdb.parse_and_eval("$rsi"))

        analyse(rdi, rsi)

        return False    # False = 自动 continue

off_list = [0x14DE, 0x1AAC, 0x1C96,0x211D]

for off in off_list:
    addr = gdb.parse_and_eval(f"$rebase({hex(off)})")
    VmTrace(f"*{addr}")

end

continue
```
trace 完成，在 vm.log 文件查看结果。

## 漏洞利用
在 type 为 0 ，val >> 2 为 0x35 时，程序调用系统调用，对应的 nr 是 num1 
在 type 为 0 ，val >> 2 为 0x3b 时，对应的操作为 ret

在 vm.log 找到
```
Type: 0x0 | val: 0x35 | num1: 0x1 | num2: 0x0 || VM ip: 0x107 | regs: ['0x1', '0x2ffe0', '0x12', '0x0', '0x0', '0x2ffdc'] | sp: 0x2FFCC | flag: 0
···
Type: 0x0 | val: 0x35 | num1: 0x0 | num2: 0x0 || VM ip: 0xDE | regs: ['0x0', '0x2ffc4', '0x50', '0x18', '0x0', '0x2ffc0'] | sp: 0x2FFB0 | flag: 0
···
Type: 0x0 | val: 0x35 | num1: 0x1 | num2: 0x0 || VM ip: 0x107 | regs: ['0x1', '0x2ffac', '0x6', '0x18', '0x0', '0x2ffa8'] | sp: 0x2FF98 | flag: 0
···
Type: 0x0 | val: 0x35 | num1: 0x1 | num2: 0x0 || VM ip: 0x107 | regs: ['0x1', '0x2ffc4', '0x9', '0x18', '0x0', '0x2ffa8'] | sp: 0x2FF98 | flag: 0
···
Type: 0x0 | val: 0x3b | num1: 0x0 | num2: 0x0 || VM ip: 0xAD | regs: ['0x5555a2ac', '0x2ffc4', '0x9', '0x18', '0x0', '0x0'] | sp: 0x2FFDC | flag: 0
```

对应的伪代码也就是
```
write(1, 0x2ffe0, 0x12);
len = read(0, 0x2ffc4, 0x50);
write(1, 0x2ffac, 0x6);
write(1, 0x2ffc4, len);

ret     # rsp = 0x2FFDC
```
这个 len 是多次 trace 得出的，

然后就是漏洞点，0x2FFDC 显然是在 0x2ffc4 与 0x2ffc4+0x50 中的，也就是可以用 read 覆盖控制执行流。


read 的长度足够，可以尝试让解释器执行写入的 payload，思路：控制各个寄存器，然后通过 syscall 拿 shell。
本文重点在于分析 WP 可以查看 [这里](https://yfor-yfor.github.io/2025/12/07/2025dasctf-wp/#pwn3)


## 模板
最后给出模板 VM helper ，欢迎各位师傅来交流。
```gdb script
start

python
import gdb

f = open("./vm.log", "w")

def analyse(*args):
    inf = gdb.selected_inferior()   # 获取调试实例

    ...


class MyBreakPoint(gdb.Breakpoint):
    def __init__(self, addr):
        super().__init__(addr, temporary=False)

    def stop(self):
        ...

        return False    # False = 自动 continue

# 断点自填
off_list = []

is_pie = 1

for off in off_list:
    if is_pie:
        addr = gdb.parse_and_eval(f"$rebase({hex(off)})")
    else:
        addr = gdb.parse_and_eval(f"{hex(off)}")
    MyBreakPoint(f"*{addr}")

end

continue
```
