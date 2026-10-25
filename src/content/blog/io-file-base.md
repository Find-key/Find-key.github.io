---
title: "IO_FILE 浅析"
description: "IO_FILE 的结构、vtable 与几处容易记错的字段"
pubDate: 2025-03-11
category: pwn
tags: [io-file]
---

## 前言

> glibc 2.34 之后 `__malloc_hook` / `__free_hook` 被移除，利用面随之转向 IO_FILE。
> 这篇把 `_IO_FILE` 的结构和几个关键字段整理一遍，方便回头查。

## _IO_FILE

```C
struct _IO_FILE
{
  int _flags;                  /* 高位字为_IO_MAGIC，剩余的部分是flag */
  char *_IO_read_ptr;          /* 正在使用的input缓冲区的input地址 */
  char *_IO_read_end;          /* input缓冲区的结束地址 */
  char *_IO_read_base;         /* input缓冲区的基址 */
  char *_IO_write_base;        /* output缓冲区的基址 */
  char *_IO_write_ptr;         /*  指向还没输出的那个字节 */
  char *_IO_write_end;         /* output缓冲区的结束地址 */
  char *_IO_buf_base;          /* input和output缓冲区的基址 */
  char *_IO_buf_end;           /* input和output缓冲区的结束地址 */

  char *_IO_save_base;         /* Pointer to start of non-current get area. */
  char *_IO_backup_base;       /* Pointer to first valid character of backup area */
  char *_IO_save_end;          /* Pointer to end of non-current get area. */

  struct _IO_marker *_markers;

  struct _IO_FILE *_chain;     /* 存放着一个单链表，用于串联所有的file stream */

  int _fileno;                 /* 与文件相关的文件描述符 */
  int _flags2;
  __off_t _old_offset;         /* This used to be _offset but it's too small.  */

                               /* 1+column number of pbase(); 0 is unknown. */
  unsigned short _cur_column;
  signed char _vtable_offset;  /* 存放虚表(virtual table)的偏移 */
  char _shortbuf[1];

  _IO_lock_t *_lock;
#ifdef _IO_USE_OLD_IO_FILE
};

struct _IO_FILE_complete
{
  struct _IO_FILE _file;
#endif
  __off64_t _offset;           /* 存放当前文件的偏移 */
                               /* Wide character stream stuff.  */
  struct _IO_codecvt *_codecvt;
  struct _IO_wide_data *_wide_data;
  struct _IO_FILE *_freeres_list;
  void *_freeres_buf;
  size_t __pad5;
  int _mode;
                               /* Make sure we don't get into trouble again.  */
  char _unused2[15 * sizeof (int) - 4 * sizeof (void *) - sizeof (size_t)];
};
```

## _IO_FILE_plus
```C
struct _IO_FILE_plus
{
  FILE file;
  const struct _IO_jump_t *vtable;
};
```
这里的 `FILE` 就是 `_IO_FILE`，只是用 typedef 换了个名字：
```C
#ifndef __FILE_defined
#define __FILE_defined 1

struct _IO_FILE;

/* The opaque type of streams.  This is the definition used elsewhere.  */
typedef struct _IO_FILE FILE;

#endif
```

## _IO_jump_t
`_IO_FILE_plus` 的后半部分是一个指向 `_IO_jump_t` 的指针。
所谓 **vtable** 是 **virtual table**（虚函数表）的缩写，这里存放的是一组函数指针，调用 `fread`、`fwrite` 这类函数时会先查这张表。

```C
struct _IO_jump_t
{
    JUMP_FIELD(size_t, __dummy);
    JUMP_FIELD(size_t, __dummy2);
    JUMP_FIELD(_IO_finish_t, __finish);
    JUMP_FIELD(_IO_overflow_t, __overflow);
    JUMP_FIELD(_IO_underflow_t, __underflow);
    JUMP_FIELD(_IO_underflow_t, __uflow);
    JUMP_FIELD(_IO_pbackfail_t, __pbackfail);
    /* showmany */
    JUMP_FIELD(_IO_xsputn_t, __xsputn);
    JUMP_FIELD(_IO_xsgetn_t, __xsgetn);
    JUMP_FIELD(_IO_seekoff_t, __seekoff);
    JUMP_FIELD(_IO_seekpos_t, __seekpos);
    JUMP_FIELD(_IO_setbuf_t, __setbuf);
    JUMP_FIELD(_IO_sync_t, __sync);
    JUMP_FIELD(_IO_doallocate_t, __doallocate);
    JUMP_FIELD(_IO_read_t, __read);
    JUMP_FIELD(_IO_write_t, __write);
    JUMP_FIELD(_IO_seek_t, __seek);
    JUMP_FIELD(_IO_close_t, __close);
    JUMP_FIELD(_IO_stat_t, __stat);
    JUMP_FIELD(_IO_showmanyc_t, __showmanyc);
    JUMP_FIELD(_IO_imbue_t, __imbue);
};
```
