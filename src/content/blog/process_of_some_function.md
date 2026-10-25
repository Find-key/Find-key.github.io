---
title: "调用链"
description: "一些常见的函数/机制调用的过程"
pubDate: 2025-03-13
category: pwn
tags: [glibc]
---

## 前言

对于 glibc 的堆题。
*get shell* 的方法总是用任意地址写达成的。
本文讨论一些常见的调用链，用于任意地址写。

## some of hook

> 适用版本：glibc<2.34
> 本质：函数指针

### __malloc_hook

**简述**：若调用 `malloc()` 函数时，`__malloc_hook` 不为空，则直接调用 `__malloc_hook` 所指向的函数。

以下给出 `glibc2.23` 的 malloc.c 部分源码。
```C
void *
__libc_malloc (size_t bytes)
{
  mstate ar_ptr;
  void *victim;

  void *(*hook) (size_t, const void *)
    = atomic_forced_read (__malloc_hook);
  if (__builtin_expect (hook != NULL, 0))
    return (*hook)(bytes, RETURN_ADDRESS (0));

  arena_get (ar_ptr, bytes);

  victim = _int_malloc (ar_ptr, bytes);
  /* Retry with another arena only if we were able to find a usable arena
     before.  */
  if (!victim && ar_ptr != NULL)
    {
      LIBC_PROBE (memory_malloc_retry, 1, bytes);
      ar_ptr = arena_get_retry (ar_ptr, bytes);
      victim = _int_malloc (ar_ptr, bytes);
    }

  if (ar_ptr != NULL)
    (void) mutex_unlock (&ar_ptr->mutex);

  assert (!victim || chunk_is_mmapped (mem2chunk (victim)) ||
          ar_ptr == arena_for_chunk (mem2chunk (victim)));
  return victim;
}
```
显然注意到在函数调用初期，
若 `__malloc_hook` 不为**NULL**，调用(*__malloc_hook)()，返回值作为 malloc()的返回值。

### __realloc_hook

**简述**：若调用 `realloc()` 函数时，`__realloc_hook` 不为空，则直接调用 `__realloc_hook` 所指向的函数。

```C
void *
__libc_realloc (void *oldmem, size_t bytes)
{
  mstate ar_ptr;
  INTERNAL_SIZE_T nb;         /* padded request size */

  void *newp;             /* chunk to return */

  void *(*hook) (void *, size_t, const void *) =
    atomic_forced_read (__realloc_hook);
  if (__builtin_expect (hook != NULL, 0))
    return (*hook)(oldmem, bytes, RETURN_ADDRESS (0));

#if REALLOC_ZERO_BYTES_FREES
  if (bytes == 0 && oldmem != NULL)
    {
      __libc_free (oldmem); return 0;
    }
#endif

  /* realloc of null is supposed to be same as malloc */
  if (oldmem == 0)
    return __libc_malloc (bytes);

  /* chunk corresponding to oldmem */
  const mchunkptr oldp = mem2chunk (oldmem);
  /* its size */
  const INTERNAL_SIZE_T oldsize = chunksize (oldp);

  if (chunk_is_mmapped (oldp))
    ar_ptr = NULL;
  else
    ar_ptr = arena_for_chunk (oldp);

  /* Little security check which won't hurt performance: the
     allocator never wrapps around at the end of the address space.
     Therefore we can exclude some size values which might appear
     here by accident or by "design" from some intruder.  */
  if (__builtin_expect ((uintptr_t) oldp > (uintptr_t) -oldsize, 0)
      || __builtin_expect (misaligned_chunk (oldp), 0))
    {
      malloc_printerr (check_action, "realloc(): invalid pointer", oldmem,
		       ar_ptr);
      return NULL;
    }

  checked_request2size (bytes, nb);

  if (chunk_is_mmapped (oldp))
    {
      void *newmem;

#if HAVE_MREMAP
      newp = mremap_chunk (oldp, nb);
      if (newp)
        return chunk2mem (newp);
#endif
      /* Note the extra SIZE_SZ overhead. */
      if (oldsize - SIZE_SZ >= nb)
        return oldmem;                         /* do nothing */

      /* Must alloc, copy, free. */
      newmem = __libc_malloc (bytes);
      if (newmem == 0)
        return 0;              /* propagate failure */

      memcpy (newmem, oldmem, oldsize - 2 * SIZE_SZ);
      munmap_chunk (oldp);
      return newmem;
    }

  (void) mutex_lock (&ar_ptr->mutex);

  newp = _int_realloc (ar_ptr, oldp, oldsize, nb);

  (void) mutex_unlock (&ar_ptr->mutex);
  assert (!newp || chunk_is_mmapped (mem2chunk (newp)) ||
          ar_ptr == arena_for_chunk (mem2chunk (newp)));

  if (newp == NULL)
    {
      /* Try harder to allocate memory in other arenas.  */
      LIBC_PROBE (memory_realloc_retry, 2, bytes, oldmem);
      newp = __libc_malloc (bytes);
      if (newp != NULL)
        {
          memcpy (newp, oldmem, oldsize - SIZE_SZ);
          _int_free (ar_ptr, oldp, 0);
        }
    }

  return newp;
}
```

显然注意到在函数调用初期，
若 `__realloc_hook` 不为**NULL**，调用(*__realloc_hook)()，返回值作为 realloc()的返回值。

### __free_hook

**简述**：若调用 `free()` 函数时，`__free_hook` 不为空，则直接调用 `__free_hook` 所指向的函数。

```C
void
__libc_free (void *mem)
{
  mstate ar_ptr;
  mchunkptr p;                          /* chunk corresponding to mem */

  void (*hook) (void *, const void *)
    = atomic_forced_read (__free_hook);
  if (__builtin_expect (hook != NULL, 0))
    {
      (*hook)(mem, RETURN_ADDRESS (0));
      return;
    }

  if (mem == 0)                              /* free(0) has no effect */
    return;

  p = mem2chunk (mem);

  if (chunk_is_mmapped (p))                       /* release mmapped memory. */
    {
      /* see if the dynamic brk/mmap threshold needs adjusting */
      if (!mp_.no_dyn_threshold
          && p->size > mp_.mmap_threshold
          && p->size <= DEFAULT_MMAP_THRESHOLD_MAX)
        {
          mp_.mmap_threshold = chunksize (p);
          mp_.trim_threshold = 2 * mp_.mmap_threshold;
          LIBC_PROBE (memory_mallopt_free_dyn_thresholds, 2,
                      mp_.mmap_threshold, mp_.trim_threshold);
        }
      munmap_chunk (p);
      return;
    }

  ar_ptr = arena_for_chunk (p);
  _int_free (ar_ptr, p, 0);
}
```

同样的，注意到在函数调用初期，
若 `__free_hook` 不为**NULL**，调用(*__free_hook)()，返回值作为 free()的返回值。

### exit_hook

`exit_hook` 并不是官方所提供的，而是 `exit()` 调用链中所会用到的**函数指针**,

glibc 2.23 的 exit.c 源码
```C
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>
#include <sysdep.h>
#include "exit.h"

#include "set-hooks.h"
DEFINE_HOOK(__libc_atexit, (void))

/* Call all functions registered with `atexit' and `on_exit',
   in the reverse of the order in which they were registered
   perform stdio cleanup, and terminate program execution with STATUS.  */
void
	attribute_hidden
	__run_exit_handlers(int status, struct exit_function_list **listp,
						bool run_list_atexit)
{
	/* First, call the TLS destructors.  */
#ifndef SHARED
	if (&__call_tls_dtors != NULL)
#endif
		__call_tls_dtors();

	/* We do it this way to handle recursive calls to exit () made by
	   the functions registered with `atexit' and `on_exit'. We call
	   everyone on the list and use the status value in the last
	   exit (). */
	while (*listp != NULL)
	{
		struct exit_function_list *cur = *listp;

		while (cur->idx > 0)
		{
			const struct exit_function *const f =
				&cur->fns[--cur->idx];
			switch (f->flavor)
			{
				void (*atfct)(void);
				void (*onfct)(int status, void *arg);
				void (*cxafct)(void *arg, int status);

			case ef_free:
			case ef_us:
				break;
			case ef_on:
				onfct = f->func.on.fn;
#ifdef PTR_DEMANGLE
				PTR_DEMANGLE(onfct);
#endif
				onfct(status, f->func.on.arg);
				break;
			case ef_at:
				atfct = f->func.at;
#ifdef PTR_DEMANGLE
				PTR_DEMANGLE(atfct);
#endif
				atfct();
				break;
			case ef_cxa:
				cxafct = f->func.cxa.fn;
#ifdef PTR_DEMANGLE
				PTR_DEMANGLE(cxafct);
#endif
				cxafct(f->func.cxa.arg, status);
				break;
			}
		}

		*listp = cur->next;
		if (*listp != NULL)
			/* Don't free the last element in the chain, this is the statically
			   allocate element.  */
			free(cur);
	}

	if (run_list_atexit)
		RUN_HOOK(__libc_atexit, ());

	_exit(status);
}

void exit(int status)
{
	__run_exit_handlers(status, &__exit_funcs, true);
}
libc_hidden_def(exit)
```

注意到，`exit()` 实际上是调用 `__run_exit_handlers()`
而 `__run_exit_handlers()` 中不断调用 `exit_function_list` 中的函数。

> 其中一种思路是伪造 `exit_func_list` 或者往其中放入 *one_gadget*.

正常执行时，在 `exit_func_list` 会调用 `_dl_fini()` 函数。
```C
void
internal_function
_dl_fini (void)
{
  /* Lots of fun ahead.  We have to call the destructors for all still
     loaded objects, in all namespaces.  The problem is that the ELF
     specification now demands that dependencies between the modules
     are taken into account.  I.e., the destructor for a module is
     called before the ones for any of its dependencies.

     To make things more complicated, we cannot simply use the reverse
     order of the constructors.  Since the user might have loaded objects
     using `dlopen' there are possibly several other modules with its
     dependencies to be taken into account.  Therefore we have to start
     determining the order of the modules once again from the beginning.  */

  /* We run the destructors of the main namespaces last.  As for the
     other namespaces, we pick run the destructors in them in reverse
     order of the namespace ID.  */
#ifdef SHARED
  int do_audit = 0;
 again:
#endif
  for (Lmid_t ns = GL(dl_nns) - 1; ns >= 0; --ns)
    {
      /* Protect against concurrent loads and unloads.  */
      __rtld_lock_lock_recursive (GL(dl_load_lock));

      unsigned int nloaded = GL(dl_ns)[ns]._ns_nloaded;
      /* No need to do anything for empty namespaces or those used for
	 auditing DSOs.  */
      if (nloaded == 0
#ifdef SHARED
	  || GL(dl_ns)[ns]._ns_loaded->l_auditing != do_audit
#endif
	  )
	__rtld_lock_unlock_recursive (GL(dl_load_lock));
      else
	{
	  /* Now we can allocate an array to hold all the pointers and
	     copy the pointers in.  */
	  struct link_map *maps[nloaded];

	  unsigned int i;
	  struct link_map *l;
	  assert (nloaded != 0 || GL(dl_ns)[ns]._ns_loaded == NULL);
	  for (l = GL(dl_ns)[ns]._ns_loaded, i = 0; l != NULL; l = l->l_next)
	    /* Do not handle ld.so in secondary namespaces.  */
	    if (l == l->l_real)
	      {
		assert (i < nloaded);

		maps[i] = l;
		l->l_idx = i;
		++i;

		/* Bump l_direct_opencount of all objects so that they
		   are not dlclose()ed from underneath us.  */
		++l->l_direct_opencount;
	      }
	  assert (ns != LM_ID_BASE || i == nloaded);
	  assert (ns == LM_ID_BASE || i == nloaded || i == nloaded - 1);
	  unsigned int nmaps = i;

	  /* Now we have to do the sorting.  */
	  _dl_sort_fini (maps, nmaps, NULL, ns);

	  /* We do not rely on the linked list of loaded object anymore
	     from this point on.  We have our own list here (maps).  The
	     various members of this list cannot vanish since the open
	     count is too high and will be decremented in this loop.  So
	     we release the lock so that some code which might be called
	     from a destructor can directly or indirectly access the
	     lock.  */
	  __rtld_lock_unlock_recursive (GL(dl_load_lock));

	  /* 'maps' now contains the objects in the right order.  Now
	     call the destructors.  We have to process this array from
	     the front.  */
	  for (i = 0; i < nmaps; ++i)
	    {
	      struct link_map *l = maps[i];

	      if (l->l_init_called)
		{
		  /* Make sure nothing happens if we are called twice.  */
		  l->l_init_called = 0;

		  /* Is there a destructor function?  */
		  if (l->l_info[DT_FINI_ARRAY] != NULL
		      || l->l_info[DT_FINI] != NULL)
		    {
		      /* When debugging print a message first.  */
		      if (__builtin_expect (GLRO(dl_debug_mask)
					    & DL_DEBUG_IMPCALLS, 0))
			_dl_debug_printf ("\ncalling fini: %s [%lu]\n\n",
					  DSO_FILENAME (l->l_name),
					  ns);

		      /* First see whether an array is given.  */
		      if (l->l_info[DT_FINI_ARRAY] != NULL)
			{
			  ElfW(Addr) *array =
			    (ElfW(Addr) *) (l->l_addr
					    + l->l_info[DT_FINI_ARRAY]->d_un.d_ptr);
			  unsigned int i = (l->l_info[DT_FINI_ARRAYSZ]->d_un.d_val
					    / sizeof (ElfW(Addr)));
			  while (i-- > 0)
			    ((fini_t) array[i]) ();
			}

		      /* Next try the old-style destructor.  */
		      if (l->l_info[DT_FINI] != NULL)
			DL_CALL_DT_FINI
			  (l, l->l_addr + l->l_info[DT_FINI]->d_un.d_ptr);
		    }

#ifdef SHARED
		  /* Auditing checkpoint: another object closed.  */
		  if (!do_audit && __builtin_expect (GLRO(dl_naudit) > 0, 0))
		    {
		      struct audit_ifaces *afct = GLRO(dl_audit);
		      for (unsigned int cnt = 0; cnt < GLRO(dl_naudit); ++cnt)
			{
			  if (afct->objclose != NULL)
			    /* Return value is ignored.  */
			    (void) afct->objclose (&l->l_audit[cnt].cookie);

			  afct = afct->next;
			}
		    }
#endif
		}

	      /* Correct the previous increment.  */
	      --l->l_direct_opencount;
	    }
	}
    }

#ifdef SHARED
  if (! do_audit && GLRO(dl_naudit) > 0)
    {
      do_audit = 1;
      goto again;
    }

  if (__glibc_unlikely (GLRO(dl_debug_mask) & DL_DEBUG_STATISTICS))
    _dl_debug_printf ("\nruntime linker statistics:\n"
		      "           final number of relocations: %lu\n"
		      "final number of relocations from cache: %lu\n",
		      GL(dl_num_relocations),
		      GL(dl_num_cache_relocations));
#endif
}
```
在这个函数中调用了 `__rtld_lock_lock_recursive` 和 `__rtld_lock_unlock_recursive`.

二者均位于 `_rtld_global` 结构体中，均为函数指针，名为 `__dl_rtld_lock_recursive` 和 `__dl_rtld_unlock_recursive`.

这就是我们所寻找的"hook"函数指针。

### 综述

显然的，对于上述的几类 `hook` 指针，只要修改具体的值为 `one_gadget` 就可以到达 *get shell* 的效果。
