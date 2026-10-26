/**
 * 写作台前端：渲染 + 调用 /api/*。校验都在服务端，这里只管交互。
 */
const $ = (id) => document.getElementById(id);

const state = {
	posts: [],
	categories: [],
	current: null,
	originalSlug: null,
	dirty: false,
	filter: 'all', // 分类 chip 选中项
	query: '',
};

const stamp = () => new Date().toISOString().slice(0, 10);

/* ---------- 状态与提示 ---------- */

function setState(text, kind = '') {
	const el = $('status');
	el.textContent = text;
	el.className = 'state' + (kind ? ' ' + kind : '');
}

let toastTimer;
function toast(text, action) {
	$('toastText').textContent = text;
	const btn = $('toastAction');
	if (action) {
		btn.hidden = false;
		btn.textContent = action.label;
		btn.onclick = async () => {
			hideToast();
			await action.run();
		};
	} else {
		btn.hidden = true;
		btn.onclick = null;
	}
	$('toast').classList.add('show');
	clearTimeout(toastTimer);
	toastTimer = setTimeout(hideToast, action ? 9000 : 2600);
}
const hideToast = () => $('toast').classList.remove('show');

function confirmDialog(message, { ok = '确定', danger = false } = {}) {
	const modal = $('modal');
	$('modalText').innerHTML = message;
	$('modalOk').textContent = ok;
	$('modalOk').classList.toggle('danger', danger);
	modal.hidden = false;
	$('modalCancel').focus?.();

	return new Promise((resolve) => {
		const finish = (value) => {
			modal.hidden = true;
			$('modalOk').onclick = null;
			$('modalCancel').onclick = null;
			document.removeEventListener('keydown', onKey);
			resolve(value);
		};
		const onKey = (e) => {
			if (e.key === 'Escape') finish(false);
			if (e.key === 'Enter') finish(true);
		};
		$('modalOk').onclick = () => finish(true);
		$('modalCancel').onclick = () => finish(false);
		document.addEventListener('keydown', onKey);
	});
}

async function api(path, options = {}) {
	const res = await fetch(path, {
		headers: options.body ? { 'content-type': 'application/json' } : undefined,
		...options,
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error || `请求失败（${res.status}）`);
	return data;
}

/* ---------- 渲染 ---------- */

function visiblePosts() {
	const q = state.query.trim().toLowerCase();
	return state.posts.filter((p) => {
		if (state.filter !== 'all' && (p.category || '') !== state.filter) return false;
		if (!q) return true;
		return (
			(p.title || '').toLowerCase().includes(q) ||
			(p.slug || '').toLowerCase().includes(q) ||
			(p.tags || []).join(' ').toLowerCase().includes(q)
		);
	});
}

function renderChips() {
	const box = $('chips');
	const total = state.posts.length;
	const chips = [{ slug: 'all', name: '全部', count: total }, ...state.categories];

	box.innerHTML = '';
	for (const chip of chips) {
		const b = document.createElement('button');
		b.className = 'chip';
		b.textContent = chip.slug === 'all' ? `全部 ${total}` : `${chip.name} ${chip.count ?? ''}`.trim();
		b.setAttribute('aria-pressed', String(state.filter === chip.slug));
		b.onclick = () => {
			state.filter = chip.slug;
			renderChips();
			renderList();
		};
		box.appendChild(b);
	}
}

function renderList() {
	const ul = $('list');
	ul.innerHTML = '';
	const posts = visiblePosts();

	if (!posts.length) {
		const li = document.createElement('li');
		li.className = 'item';
		li.innerHTML = '<span class="item-title" style="color:var(--faint)">没有匹配的文章</span>';
		ul.appendChild(li);
		return;
	}

	for (const post of posts) {
		const li = document.createElement('li');
		li.className = 'item';
		if (state.current === post.slug) li.setAttribute('aria-current', 'true');

		const meta = [post.category || '未分类', post.draft ? '<span class="draft">草稿</span>' : post.pubDate];
		li.innerHTML = `<span class="item-title"></span><span class="item-meta">${meta.filter(Boolean).join(' · ')}</span>`;
		li.querySelector('.item-title').textContent = post.title || post.slug;
		li.onclick = () => openPost(post.slug);
		ul.appendChild(li);
	}
}

function renderCategories() {
	const box = $('cats');
	box.innerHTML = '';

	for (const cat of state.categories) {
		const row = document.createElement('div');
		row.className = 'cat';
		row.innerHTML = `<span class="name"></span>${cat.slug === cat.name ? '' : '<span class="slug"></span>'}<span class="count">${cat.count || 0}</span>`;
		row.querySelector('.name').textContent = cat.name;
		if (cat.slug !== cat.name) row.querySelector('.slug').textContent = cat.slug;

		const del = document.createElement('button');
		del.className = 'del';
		del.textContent = '×';
		del.title = cat.count ? `还有 ${cat.count} 篇在用` : '删除分类';
		del.onclick = (e) => {
			e.stopPropagation();
			removeCategory(cat);
		};
		row.appendChild(del);
		box.appendChild(row);
	}

	const select = $('category');
	const keep = select.value;
	select.innerHTML =
		'<option value="">未分类</option>' +
		state.categories.map((c) => `<option value="${c.slug}">${c.name}</option>`).join('');
	select.value = keep;
}

async function renderTrash() {
	const { items } = await api('/api/trash');
	$('trashCount').textContent = items.length ? ` ${items.length}` : ' 空';
	const box = $('trashList');
	box.innerHTML = '';

	for (const item of items) {
		const row = document.createElement('div');
		row.className = 'row';
		row.innerHTML = '<span></span>';
		row.querySelector('span').textContent = item.id.replace(/^[^_]*__/, '').replace(/\.md$/, '');
		const btn = document.createElement('button');
		btn.textContent = '恢复';
		btn.onclick = async () => {
			const r = await api('/api/trash/restore', { method: 'POST', body: JSON.stringify({ id: item.id }) });
			await refresh();
			toast(`已恢复 ${r.slug}.md`);
		};
		row.appendChild(btn);
		box.appendChild(row);
	}
}

/* ---------- 表单 ---------- */

function fillForm(post) {
	$('title').value = post.title ?? '';
	$('description').value = post.description ?? '';
	$('category').value = post.category ?? '';
	$('pubDate').value = post.pubDate || stamp();
	$('tags').value = (post.tags ?? []).join(', ');
	$('slug').value = post.slug ?? '';
	$('draft').checked = !!post.draft;
	$('body').value = post.body ?? '## 环境\n\n';
	countWords();
	state.dirty = false;
	setState('');
}

function readForm() {
	return {
		title: $('title').value,
		description: $('description').value,
		category: $('category').value,
		pubDate: $('pubDate').value || stamp(),
		tags: $('tags')
			.value.split(',')
			.map((t) => t.trim())
			.filter(Boolean),
		slug: $('slug').value.trim(),
		originalSlug: state.originalSlug ?? undefined,
		draft: $('draft').checked,
		body: $('body').value,
	};
}

function countWords() {
	const n = $('body').value.replace(/\s/g, '').length;
	$('wc').textContent = n ? `${n} 字` : '';
}

/* ---------- 动作 ---------- */

async function refresh() {
	const data = await api('/api/state');
	state.posts = data.posts;
	state.categories = data.categories;
	renderChips();
	renderList();
	renderCategories();
	await renderTrash();
}

async function openPost(slug) {
	if (slug === state.current) return;
	if (state.dirty && !(await confirmDialog('当前改动还没保存，确定切走？', { ok: '切走' }))) return;
	const post = await api(`/api/post?slug=${encodeURIComponent(slug)}`);
	state.current = slug;
	state.originalSlug = slug;
	fillForm(post);
	renderList();
}

function newPost() {
	state.current = null;
	state.originalSlug = null;
	fillForm({ pubDate: stamp(), category: state.filter === 'all' ? '' : state.filter, body: '## 环境\n\n' });
	$('slug').value = '';
	renderList();
	$('title').focus();
}

async function save() {
	try {
		const result = await api('/api/post', { method: 'POST', body: JSON.stringify(readForm()) });
		state.current = result.slug;
		state.originalSlug = result.slug;
		$('slug').value = result.slug;
		state.dirty = false;
		await refresh();
		setState(`已保存 ${result.slug}.md`);
		setTimeout(() => setState(''), 4000);
		if (result.renamedFrom) toast(`改名完成，旧文件进了回收站`);
	} catch (error) {
		setState(error.message, 'error');
		toast(error.message);
	}
}

async function removePost() {
	if (!state.current) return toast('还没保存过，没法删');
	const ok = await confirmDialog(
		`把 <b>${state.current}.md</b> 挪进回收站？<br><span style="color:var(--muted)">之后可以在左下角回收站恢复。</span>`,
		{ ok: '挪进回收站', danger: true },
	);
	if (!ok) return;

	const { trashId } = await api(`/api/post?slug=${encodeURIComponent(state.current)}`, { method: 'DELETE' });
	state.current = null;
	state.originalSlug = null;
	fillForm({ pubDate: stamp(), body: '## 环境\n\n' });
	await refresh();
	toast('已挪进回收站', {
		label: '撤销',
		run: async () => {
			await api('/api/trash/restore', { method: 'POST', body: JSON.stringify({ id: trashId }) });
			await refresh();
			toast('已恢复');
		},
	});
}

async function removeCategory(cat) {
	if (cat.count) return toast(`「${cat.name}」下还有 ${cat.count} 篇，先把它们的分类改掉`);
	const ok = await confirmDialog(`删除分类 <b>${cat.name}</b>（${cat.slug}）？`, { ok: '删除', danger: true });
	if (!ok) return;
	try {
		await api('/api/categories', {
			method: 'POST',
			body: JSON.stringify({ categories: state.categories.filter((c) => c.slug !== cat.slug) }),
		});
		if (state.filter === cat.slug) state.filter = 'all';
		await refresh();
		setState('分类已删除，dev 已重启');
	} catch (error) {
		setState(error.message, 'error');
		toast(error.message);
	}
}

async function addCategory(event) {
	event.preventDefault();
	const slug = $('cSlug').value.trim().toLowerCase();
	const name = $('cName').value.trim() || slug;
	if (!slug) return toast('先填 slug');
	try {
		await api('/api/categories', {
			method: 'POST',
			body: JSON.stringify({ categories: [...state.categories, { slug, name, description: '' }] }),
		});
		$('cSlug').value = '';
		$('cName').value = '';
		await refresh();
		setState(`分类 ${name} 已添加，dev 已重启`);
	} catch (error) {
		setState(error.message, 'error');
		toast(error.message);
	}
}

function preview() {
	const slug = $('slug').value.trim() || state.current;
	if (!slug) return toast('先保存一次再预览');
	const base = document.body.dataset.site || '';
	window.open(`${base}/posts/${slug}/`, '_blank', 'noopener');
}

/* ---------- 绑定 ---------- */

$('new').onclick = newPost;
$('save').onclick = save;
$('del').onclick = removePost;
$('preview').onclick = preview;
$('catForm').addEventListener('submit', addCategory);
$('body').addEventListener('input', countWords);

$('search').addEventListener('input', (e) => {
	state.query = e.target.value;
	renderList();
});

for (const id of ['title', 'description', 'category', 'pubDate', 'tags', 'slug', 'body', 'draft']) {
	const el = $(id);
	const mark = () => {
		if (state.dirty) return;
		state.dirty = true;
		setState('未保存', 'dirty');
	};
	el.addEventListener('input', mark);
	el.addEventListener('change', mark);
}

document.addEventListener('keydown', (e) => {
	const meta = e.metaKey || e.ctrlKey;
	if (meta && e.key.toLowerCase() === 's') {
		e.preventDefault();
		save();
	}
	if (meta && e.key.toLowerCase() === 'k') {
		e.preventDefault();
		$('search').focus();
		$('search').select?.();
	}
});

window.addEventListener('beforeunload', (e) => {
	if (!state.dirty) return;
	e.preventDefault();
	e.returnValue = '';
});

const initial = await api('/api/state');
document.body.dataset.site = initial.siteDev;
await refresh();
if (!state.posts.length) newPost();
else await openPost(state.posts[0].slug);
