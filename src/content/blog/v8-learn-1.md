---
title: "V8 学习笔记 0x01"
description: "对象数组与浮点数组在内存里的排布"
pubDate: 2026-04-20
category: v8
tags: [v8]
order: 2
---

## 调试
编译好之后就可以调 exp 了。调试还是用 gdb，只是启动时要把 d8 的参数带上：
```bash
gdb --args /path/to/d8 --allow-natives-syntax exp.js
```
问题是不知道在哪下断点。其实在 JS 层就能断：在 exp.js 里写 `%SystemBreak();`，跑到那儿就会停下来。

例如，
```js
console.log("hello, key");

%SystemBreak();

console.log("bye, key");
```
在 gdb 使用 run 命令后就会停在中间，只看到打印 *hello, key* 而没有 *bye, key*。

要看变量地址用 `%DebugPrint(obj);`，它会把对象的内存布局整个打出来。

## 实验
拿一个数组做样例：
```js
// k.js
arr = [1, 2, 3];

%DebugPrint(arr);
%SystemBreak();
```

```bash
gdb --args /path/to/d8 --allow-natives-syntax k.js
```
然后在 gdb 中直接 `run`，然后看到 arr 对象的一些信息
```
DebugPrint: 0x7b8fb55ab1: [JSArray]
 - map: 0x119adca9d981 <Map[32](PACKED_SMI_ELEMENTS)> [FastProperties]
 - prototype: 0x119adca9d9c9 <JSArray[0]>
 - elements: 0x119adcabdb49 <FixedArray[3]> [PACKED_SMI_ELEMENTS (COW)]
 - length: 3
 - properties: 0x36dda0040e19 <FixedArray[0]>
 - All own properties (excluding elements): {
    0x36dda0041921: [String] in ReadOnlySpace: #length: 0x061b689879c1 <AccessorInfo name= 0x36dda0041921 <String[6]: #length>, data= 0x36dda0040011 <undefined>> (const accessor descriptor, attrs: [W__])
 }
 - elements: 0x119adcabdb49 <FixedArray[3]> {
           0: 1
           1: 2
           2: 3
 }
0x119adca9d981: [Map] in OldSpace
 - map: 0x119adca91559 <MetaMap (0x119adca915e9 <NativeContext[307]>)>
 - type: JS_ARRAY_TYPE
 - instance size: 32
 - inobject properties: 0
 - unused property fields: 0
 - elements kind: PACKED_SMI_ELEMENTS
 - enum length: invalid
 - back pointer: 0x36dda0040011 <undefined>
 - prototype_validity_cell: 0x36dda0041399 <Cell value= [cleared]>
 - instance descriptors #1: 0x119adca9e5f1 <DescriptorArray[1]>
 - transitions #1: 0x119adca9e629 <TransitionArray[5]>
   Transitions #1:
     0x36dda00419f1 <Symbol: (elements_transition_symbol)>: (transition to HOLEY_SMI_ELEMENTS) -> 0x119adca9e661 <Map[32](HOLEY_SMI_ELEMENTS)>
 - prototype: 0x119adca9d9c9 <JSArray[0]>
 - constructor: 0x119adca9d821 <JSFunction Array (sfi = 0x61b68988c99)>
 - dependent code: 0x36dda0040e39 <Other heap object (WEAK_ARRAY_LIST_TYPE)>
 - construction counter: 0
```
注意到 **0x7b8fb55ab1** 这样一串大概是地址的值，可以在 gdb 中用 `job` 命令查看，再配合 `tel` 命令
```
pwndbg> job 0x7b8fb55ab1
0x7b8fb55ab1: [JSArray]
 - map: 0x119adca9d981 <Map[32](PACKED_SMI_ELEMENTS)> [FastProperties]
 - prototype: 0x119adca9d9c9 <JSArray[0]>
 - elements: 0x119adcabdb49 <FixedArray[3]> [PACKED_SMI_ELEMENTS (COW)]
 - length: 3
 - properties: 0x36dda0040e19 <FixedArray[0]>
 - All own properties (excluding elements): {
    0x36dda0041921: [String] in ReadOnlySpace: #length: 0x061b689879c1 <AccessorInfo name= 0x36dda0041921 <String[6]: #length>, data= 0x36dda0040011 <undefined>> (const accessor descriptor, attrs: [W__])
 }
 - elements: 0x119adcabdb49 <FixedArray[3]> {
           0: 1
           1: 2
           2: 3
 }
pwndbg> tel 0x7b8fb55ab0
00:0000│     0x7b8fb55ab0 —▸ 0x119adca9d981 ◂— 0x40000119adca915
01:0008│     0x7b8fb55ab8 —▸ 0x36dda0040e19 ◂— 0x36dda0040a
02:0010│     0x7b8fb55ac0 —▸ 0x119adcabdb49 ◂— 0x36dda0040c
03:0018│     0x7b8fb55ac8 ◂— 0x300000000
04:0020│     0x7b8fb55ad0 ◂— 0
... ↓     3 skipped
```
`job` 的输出和上面一致。而 **0x7b8fb55ab1** 是加了标记位的值，真实地址是 **0x7b8fb55ab0**：地址最低位是标记位，为 1 表示是指针，为 0 表示是 Smi（小整数）。

由此可以推出 JSArray 有四个字段：map、properties、elements、length。
抽象出来，大概是这样：
```C
struct array {
    map* map;
    properties* properties;
    elements* element;
    long long length;
};
```
length 以 Smi 存放，上面打印的原始值是 0x300000000，右移 32 位才是真实的 3。

容易注意到，`elements` 指针和数组对象的地址差得很远。而特别的，不同于整数数组，浮点数数组和对象数组中的 element 和 array 地址是相邻的。对实验代码稍作修改，验证这一点。
```js
arr = [1, 2, 3];
f = [3.0,7.2];
ff = [f, f];

%DebugPrint(arr);
%DebugPrint(f);
%DebugPrint(ff);
%SystemBreak();
```

通过调试，得到下面的内容
```
DebugPrint: 0x3e9c5b995ae9: [JSArray]
 - map: 0x12f3c6e9d981 <Map[32](PACKED_SMI_ELEMENTS)> [FastProperties]
 - prototype: 0x12f3c6e9d9c9 <JSArray[0]>
 - elements: 0x12f3c6ebdb61 <FixedArray[3]> [PACKED_SMI_ELEMENTS (COW)]
 - length: 3
 - properties: 0x082a1ad80e19 <FixedArray[0]>
 - All own properties (excluding elements): {
    0x82a1ad81921: [String] in ReadOnlySpace: #length: 0x2b68715479c1 <AccessorInfo name= 0x082a1ad81921 <String[6]: #length>, data= 0x082a1ad80011 <undefined>> (const accessor descriptor, attrs: [W__])
 }
 - elements: 0x12f3c6ebdb61 <FixedArray[3]> {
           0: 1
           1: 2
           2: 3
 }
0x12f3c6e9d981: [Map] in OldSpace
 - map: 0x12f3c6e91559 <MetaMap (0x12f3c6e915e9 <NativeContext[307]>)>
 - type: JS_ARRAY_TYPE
 - instance size: 32
 - inobject properties: 0
 - unused property fields: 0
 - elements kind: PACKED_SMI_ELEMENTS
 - enum length: invalid
 - back pointer: 0x082a1ad80011 <undefined>
 - prototype_validity_cell: 0x082a1ad81399 <Cell value= [cleared]>
 - instance descriptors #1: 0x12f3c6e9e5f1 <DescriptorArray[1]>
 - transitions #1: 0x12f3c6e9e629 <TransitionArray[5]>
   Transitions #1:
     0x082a1ad819f1 <Symbol: (elements_transition_symbol)>: (transition to HOLEY_SMI_ELEMENTS) -> 0x12f3c6e9e661 <Map[32](HOLEY_SMI_ELEMENTS)>
 - prototype: 0x12f3c6e9d9c9 <JSArray[0]>
 - constructor: 0x12f3c6e9d821 <JSFunction Array (sfi = 0x2b6871548c99)>
 - dependent code: 0x082a1ad80e39 <Other heap object (WEAK_ARRAY_LIST_TYPE)>
 - construction counter: 0

DebugPrint: 0x3e9c5b995b29: [JSArray]
 - map: 0x12f3c6e9e6e1 <Map[32](PACKED_DOUBLE_ELEMENTS)> [FastProperties]
 - prototype: 0x12f3c6e9d9c9 <JSArray[0]>
 - elements: 0x3e9c5b995b09 <FixedDoubleArray[2]> [PACKED_DOUBLE_ELEMENTS]
 - length: 2
 - properties: 0x082a1ad80e19 <FixedArray[0]>
 - All own properties (excluding elements): {
    0x82a1ad81921: [String] in ReadOnlySpace: #length: 0x2b68715479c1 <AccessorInfo name= 0x082a1ad81921 <String[6]: #length>, data= 0x082a1ad80011 <undefined>> (const accessor descriptor, attrs: [W__])
 }
 - elements: 0x3e9c5b995b09 <FixedDoubleArray[2]> {
           0: 3 (0x4008000000000000)
           1: 7.2 (0x401ccccccccccccd)
 }
0x12f3c6e9e6e1: [Map] in OldSpace
 - map: 0x12f3c6e91559 <MetaMap (0x12f3c6e915e9 <NativeContext[307]>)>
 - type: JS_ARRAY_TYPE
 - instance size: 32
 - inobject properties: 0
 - unused property fields: 0
 - elements kind: PACKED_DOUBLE_ELEMENTS
 - enum length: invalid
 - back pointer: 0x12f3c6e9e661 <Map[32](HOLEY_SMI_ELEMENTS)>
 - prototype_validity_cell: 0x082a1ad81399 <Cell value= [cleared]>
 - instance descriptors #1: 0x12f3c6e9e5f1 <DescriptorArray[1]>
 - transitions #1: 0x12f3c6e9e729 <TransitionArray[5]>
   Transitions #1:
     0x082a1ad819f1 <Symbol: (elements_transition_symbol)>: (transition to HOLEY_DOUBLE_ELEMENTS) -> 0x12f3c6e9e761 <Map[32](HOLEY_DOUBLE_ELEMENTS)>
 - prototype: 0x12f3c6e9d9c9 <JSArray[0]>
 - constructor: 0x12f3c6e9d821 <JSFunction Array (sfi = 0x2b6871548c99)>
 - dependent code: 0x082a1ad80e39 <Other heap object (WEAK_ARRAY_LIST_TYPE)>
 - construction counter: 0

DebugPrint: 0x3e9c5b995b69: [JSArray]
 - map: 0x12f3c6e9e7e1 <Map[32](PACKED_ELEMENTS)> [FastProperties]
 - prototype: 0x12f3c6e9d9c9 <JSArray[0]>
 - elements: 0x3e9c5b995b49 <FixedArray[2]> [PACKED_ELEMENTS]
 - length: 2
 - properties: 0x082a1ad80e19 <FixedArray[0]>
 - All own properties (excluding elements): {
    0x82a1ad81921: [String] in ReadOnlySpace: #length: 0x2b68715479c1 <AccessorInfo name= 0x082a1ad81921 <String[6]: #length>, data= 0x082a1ad80011 <undefined>> (const accessor descriptor, attrs: [W__])
 }
 - elements: 0x3e9c5b995b49 <FixedArray[2]> {
         0-1: 0x3e9c5b995b29 <JSArray[2]>
 }
0x12f3c6e9e7e1: [Map] in OldSpace
 - map: 0x12f3c6e91559 <MetaMap (0x12f3c6e915e9 <NativeContext[307]>)>
 - type: JS_ARRAY_TYPE
 - instance size: 32
 - inobject properties: 0
 - unused property fields: 0
 - elements kind: PACKED_ELEMENTS
 - enum length: invalid
 - back pointer: 0x12f3c6e9e761 <Map[32](HOLEY_DOUBLE_ELEMENTS)>
 - prototype_validity_cell: 0x082a1ad81399 <Cell value= [cleared]>
 - instance descriptors #1: 0x12f3c6e9e5f1 <DescriptorArray[1]>
 - transitions #1: 0x12f3c6e9e829 <TransitionArray[5]>
   Transitions #1:
     0x082a1ad819f1 <Symbol: (elements_transition_symbol)>: (transition to HOLEY_ELEMENTS) -> 0x12f3c6e9e861 <Map[32](HOLEY_ELEMENTS)>
 - prototype: 0x12f3c6e9d9c9 <JSArray[0]>
 - constructor: 0x12f3c6e9d821 <JSFunction Array (sfi = 0x2b6871548c99)>
 - dependent code: 0x082a1ad80e39 <Other heap object (WEAK_ARRAY_LIST_TYPE)>
 - construction counter: 0
```

输出有点长，分步看：先是 `arr`。
```
pwndbg> job 0x3e9c5b995ae9
0x3e9c5b995ae9: [JSArray]
 - map: 0x12f3c6e9d981 <Map[32](PACKED_SMI_ELEMENTS)> [FastProperties]
 - prototype: 0x12f3c6e9d9c9 <JSArray[0]>
 - elements: 0x12f3c6ebdb61 <FixedArray[3]> [PACKED_SMI_ELEMENTS (COW)]
 - length: 3
 - properties: 0x082a1ad80e19 <FixedArray[0]>
 - All own properties (excluding elements): {
    0x82a1ad81921: [String] in ReadOnlySpace: #length: 0x2b68715479c1 <AccessorInfo name= 0x082a1ad81921 <String[6]: #length>, data= 0x082a1ad80011 <undefined>> (const accessor descriptor, attrs: [W__])
 }
 - elements: 0x12f3c6ebdb61 <FixedArray[3]> {
           0: 1
           1: 2
           2: 3
 }
```
`elements` 和 `arr` 的地址确实差很远，上一次不是偶然。接着看 `f`：
```
pwndbg> job 0x3e9c5b995b29
0x3e9c5b995b29: [JSArray]
 - map: 0x12f3c6e9e6e1 <Map[32](PACKED_DOUBLE_ELEMENTS)> [FastProperties]
 - prototype: 0x12f3c6e9d9c9 <JSArray[0]>
 - elements: 0x3e9c5b995b09 <FixedDoubleArray[2]> [PACKED_DOUBLE_ELEMENTS]
 - length: 2
 - properties: 0x082a1ad80e19 <FixedArray[0]>
 - All own properties (excluding elements): {
    0x82a1ad81921: [String] in ReadOnlySpace: #length: 0x2b68715479c1 <AccessorInfo name= 0x082a1ad81921 <String[6]: #length>, data= 0x082a1ad80011 <undefined>> (const accessor descriptor, attrs: [W__])
 }
 - elements: 0x3e9c5b995b09 <FixedDoubleArray[2]> {
           0: 3 (0x4008000000000000)
           1: 7.2 (0x401ccccccccccccd)
 }
```
elements 的指针值和 f 的地址相近，仅相差 0x20，而这其实就是相邻，element 两个元素占 0x10，而 map 字段和 length 字段又占 0x10

最后是 ff
```
pwndbg> job 0x3e9c5b995b69
0x3e9c5b995b69: [JSArray]
 - map: 0x12f3c6e9e7e1 <Map[32](PACKED_ELEMENTS)> [FastProperties]
 - prototype: 0x12f3c6e9d9c9 <JSArray[0]>
 - elements: 0x3e9c5b995b49 <FixedArray[2]> [PACKED_ELEMENTS]
 - length: 2
 - properties: 0x082a1ad80e19 <FixedArray[0]>
 - All own properties (excluding elements): {
    0x82a1ad81921: [String] in ReadOnlySpace: #length: 0x2b68715479c1 <AccessorInfo name= 0x082a1ad81921 <String[6]: #length>, data= 0x082a1ad80011 <undefined>> (const accessor descriptor, attrs: [W__])
 }
 - elements: 0x3e9c5b995b49 <FixedArray[2]> {
         0-1: 0x3e9c5b995b29 <JSArray[2]>
 }
```
和 f 一样，`elements` 与数组对象相邻。
