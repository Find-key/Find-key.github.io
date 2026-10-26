/**
 * 写作台：hash 路由 + 四视图
 *   #/              文章列表
 *   #/edit/<slug>   编辑（#/edit/new 新建）
 *   #/categories    分类（行内可编辑 name / desc）
 *   #/trash         回收站
 */
const $ = (id) => document.getElementById(id);

const state = {
	posts: [],
	categories: [],
	current: null,
	originalSlug: null,
	dirty: false,
	filter: 'all',
	query: '',
	site: '',
	trash: [],
};

const stamp = () => new Date().toISOString().slice(0, 10);

/* ---------- 状态 / 提示 / 确认 ---------- */

function setState(text, kind = '') {
	const el = $('status');
	el.textContent = text ?? '';
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
	toastTimer = setTimeout(hideToast, action ? 9000 : 2400);
}
const hideToast = () => $('toast').classList.remove('show');

function confirmDialog(message, { ok = '确定', danger = false } = {}) {
	const modal = $('modal');
	$('modalText').innerHTML = message;
	$('modalOk').textContent = ok;
	$('modalOk').classList.toggle('danger', danger);
	modal.hidden = false;

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

/* ---------- 路由 ---------- */

const VIEWS = ['list', 'edit', 'categories', 'trash'];

function showView(name) {
	for (const view of VIEWS) $(`view-${view}`).hidden = view !== name;
	document.body.dataset.view = name;
	document.querySelectorAll('.rail-nav a').forEach((a) => {
		const nav = a.dataset.nav;
		a.classList.toggle('active', nav === name || (name === 'edit' && nav === 'list'));
	});
}

function parseRoute() {
	const hash = location.hash.replace(/^#\/?/, '');
	if (hash.startsWith('edit/')) return { view: 'edit', slug: decodeURIComponent(hash.slice(5)) };
	if (hash === 'categories') return { view: 'categories' };
	if (hash === 'trash') return { view: 'trash' };
	return { view: 'list' };
}

async function route() {
	const { view, slug } = parseRoute();
	showView(view);
	if (view === 'list') {
		renderChips();
		renderRows();
		return;
	}
	if (view === 'edit') {
		if (slug === 'new') await startNewPost();
		else await openPost(slug);
		return;
	}
	if (view === 'categories') {
		renderCategories();
		return;
	}
	if (view === 'trash') return renderTrash();
}

/* ---------- 导航计数 ---------- */

function renderNav() {
	$('navPosts').textContent = state.posts.length || '';
	$('navCats').textContent = state.categories.length || '';
	$('navTrash').textContent = state.trash.length || '';
}

/* ---------- 列表 ---------- */

function visiblePosts() {
	const q = state.query.trim().toLowerCase();
	return state.posts.filter((post) => {
		if (state.filter !== 'all' && (post.category || '') !== state.filter) return false;
		if (!q) return true;
		return (
			(post.title || '').toLowerCase().includes(q) ||
			(post.slug || '').toLowerCase().includes(q) ||
			(post.tags || []).join(' ').toLowerCase().includes(q)
		);
	});
}

function renderChips() {
	const box = $('chips');
	box.innerHTML = '';
	const chips = [{ slug: 'all', name: '全部', count: state.posts.length }, ...state.categories];

	for (const chip of chips) {
		const b = document.createElement('button');
		b.className = 'chip';
		b.textContent = `${chip.name} ${chip.count ?? 0}`;
		b.setAttribute('aria-pressed', String(state.filter === chip.slug));
		b.onclick = () => {
			state.filter = chip.slug;
			renderChips();
			renderRows();
		};
		box.appendChild(b);
	}
}

function renderRows() {
	const tbody = $('rows');
	const posts = visiblePosts();
	tbody.innerHTML = '';
	$('listEmpty').hidden = posts.length > 0;

	for (const post of posts) {
		const tr = document.createElement('tr');
		tr.innerHTML = `
			<td><span class="row-title"></span></td>
			<td class="c-cat"></td>
			<td class="c-date">${post.draft ? '—' : post.pubDate || '—'}</td>
			<td class="c-state">${post.draft ? '<span class="tag-draft">草稿</span>' : ''}</td>`;
		tr.querySelector('.row-title').textContent = post.title || post.slug;
		tr.querySelector('.c-cat').textContent = post.category || '未分类';
		tr.onclick = () => {
			location.hash = `#/edit/${encodeURIComponent(post.slug)}`;
		};
		tbody.appendChild(tr);
	}
}

/* ---------- 编辑 ---------- */

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
	updatePreview();
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

function updatePreview() {
	const slug = $('slug').value.trim() || state.current;
	const link = $('preview');
	if (!slug) {
		link.removeAttribute('href');
		link.style.opacity = '0.5';
		return;
	}
	link.href = `${state.site}/posts/${slug}/`;
	link.style.opacity = '';
}

async function startNewPost() {
	state.current = null;
	state.originalSlug = null;
	fillCategoriesSelect();
	fillForm({ pubDate: stamp(), body: '## 环境\n\n', category: '' });
	$('editFile').textContent = '新文章 · 尚未保存';
	$('title').focus();
}

async function openPost(slug) {
	if (state.dirty && slug !== state.current && !(await confirmDialog('当前改动还没保存，确定切走？', { ok: '切走' }))) {
		location.hash = state.current ? `#/edit/${state.current}` : '#/';
		return;
	}
	try {
		const post = await api(`/api/post?slug=${encodeURIComponent(slug)}`);
		state.current = slug;
		state.originalSlug = slug;
		fillCategoriesSelect();
		fillForm(post);
		$('editFile').textContent = `${slug}.md`;
		document.title = `${post.title || slug} · 写作台`;
	} catch (error) {
		toast(error.message);
		location.hash = '#/';
	}
}

function fillCategoriesSelect() {
	const select = $('category');
	const keep = select.value;
	select.innerHTML =
		'<option value="">未分类</option>' +
		state.categories.map((c) => `<option value="${c.slug}">${c.name}</option>`).join('');
	select.value = keep;
}

async function save() {
	try {
		const result = await api('/api/post', { method: 'POST', body: JSON.stringify(readForm()) });
		state.current = result.slug;
		state.originalSlug = result.slug;
		state.dirty = false;
		$('slug').value = result.slug;
		$('editFile').textContent = `${result.slug}.md`;
		updatePreview();
		setState('已保存');
		setTimeout(() => setState(''), 3000);
		await refreshState();
		if (result.renamedFrom) toast('改名完成，旧文件进了回收站');
	} catch (error) {
		setState(error.message, 'error');
		toast(error.message);
	}
}

async function removePost() {
	if (!state.current) return toast('还没保存过，没法删');
	const ok = await confirmDialog(
		`把 <b>${state.current}.md</b> 挪进回收站？<br><span style="color:var(--muted)">之后可以在「回收站」里恢复。</span>`,
		{ ok: '挪进回收站', danger: true },
	);
	if (!ok) return;

	const { trashId } = await api(`/api/post?slug=${encodeURIComponent(state.current)}`, { method: 'DELETE' });
	state.current = null;
	state.originalSlug = null;
	state.dirty = false;
	await refreshState();
	location.hash = '#/';
	toast('已挪进回收站', {
		label: '撤销',
		run: async () => {
			await api('/api/trash/restore', { method: 'POST', body: JSON.stringify({ id: trashId }) });
			await refreshState();
			toast('已恢复');
		},
	});
}

/* ---------- 分类：行内可编辑 ---------- */

async function saveCategories(next, { silent = false } = {}) {
	const saved = await api('/api/categories', {
		method: 'POST',
		body: JSON.stringify({ categories: next }),
	});
	state.categories = saved.categories.map((c) => ({
		...c,
		count: state.categories.find((old) => old.slug === c.slug)?.count ?? 0,
	}));
	renderNav();
	renderChips();
	fillCategoriesSelect();
	if (!silent) setState('分类已保存，dev 已重启');
	return saved;
}

function renderCategories() {
	const box = $('catRows');
	box.innerHTML = '';

	const head = document.createElement('div');
	head.className = 'cat-head';
	head.innerHTML = '<span>名称</span><span>slug</span><span>描述（显示在首页）</span><span>文章</span><span></span>';
	box.appendChild(head);

	for (const cat of state.categories) {
		const row = document.createElement('div');
		row.className = 'cat-row';

		const name = document.createElement('input');
		name.value = cat.name;
		name.setAttribute('aria-label', '显示名');

		const slug = document.createElement('span');
		slug.className = 'slug';
		slug.textContent = cat.slug;
		slug.title = cat.slug;

		const desc = document.createElement('input');
		desc.className = 'desc';
		desc.value = cat.description ?? '';
		desc.placeholder = '没有描述';
		desc.setAttribute('aria-label', '分类描述');

		const count = document.createElement('span');
		count.className = 'count';
		count.textContent = cat.count ? `${cat.count} 篇` : '—';

		const acts = document.createElement('span');
		acts.className = 'acts';
		const del = document.createElement('button');
		del.className = 'ghost danger';
		del.textContent = '删除';
		del.disabled = !!cat.count;
		del.title = cat.count ? `还有 ${cat.count} 篇文章在用` : '';
		del.onclick = async () => {
			const ok = await confirmDialog(`删除分类 <b>${cat.name}</b>（${cat.slug}）？`, { ok: '删除', danger: true });
			if (!ok) return;
			await saveCategories(state.categories.filter((c) => c.slug !== cat.slug));
			renderCategories();
		};
		acts.appendChild(del);

		const commit = async () => {
			const next = state.categories.map((c) =>
				c.slug === cat.slug ? { ...c, name: name.value.trim() || c.name, description: desc.value } : c,
			);
			try {
				await saveCategories(next, { silent: true });
				setState('已保存');
				setTimeout(() => setState(''), 2000);
			} catch (error) {
				setState(error.message, 'error');
				toast(error.message);
			}
		};
		for (const el of [name, desc]) {
			el.addEventListener('blur', commit);
			el.addEventListener('keydown', (e) => {
				if (e.key === 'Enter') el.blur();
			});
		}

		row.append(name, slug, desc, count, acts);
		box.appendChild(row);
	}
}

async function addCategory(event) {
	event.preventDefault();
	const slug = $('cSlug').value.trim().toLowerCase();
	const name = $('cName').value.trim() || slug;
	const description = $('cDesc').value.trim();
	if (!slug) return toast('先填 slug');
	try {
		await saveCategories([...state.categories, { slug, name, description }]);
		$('cSlug').value = '';
		$('cName').value = '';
		$('cDesc').value = '';
		renderCategories();
	} catch (error) {
		setState(error.message, 'error');
		toast(error.message);
	}
}

/* ---------- 回收站 ---------- */

async function renderTrash() {
	const { items } = await api('/api/trash');
	state.trash = items;
	renderNav();
	const list = $('trashList');
	list.innerHTML = '';

	if (!items.length) {
		list.innerHTML = '<li><span class="name" style="color:var(--muted)">空的。</span></li>';
		return;
	}

	for (const item of items) {
		const li = document.createElement('li');
		li.innerHTML = '<span class="name"></span><time></time><span class="acts"></span>';
		li.querySelector('.name').textContent = item.id.replace(/^[^_]*__/, '');
		li.querySelector('time').textContent = item.at.slice(0, 10);

		const restore = document.createElement('button');
		restore.className = 'ghost';
		restore.textContent = '恢复';
		restore.onclick = async () => {
			const r = await api('/api/trash/restore', { method: 'POST', body: JSON.stringify({ id: item.id }) });
			await refreshState();
			renderTrash();
			toast(`已恢复 ${r.slug}.md`);
		};

		const purge = document.createElement('button');
		purge.className = 'ghost danger';
		purge.textContent = '彻底删除';
		purge.onclick = async () => {
			const ok = await confirmDialog('彻底删除这条？文件会真的消失。', { ok: '彻底删除', danger: true });
			if (!ok) return;
			await api(`/api/trash?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' });
			renderTrash();
			toast('已彻底删除');
		};

		li.querySelector('.acts').append(restore, purge);
		list.appendChild(li);
	}
}

/* ---------- 全局 ---------- */

async function refreshState() {
	const [data, trash] = await Promise.all([api('/api/state'), api('/api/trash')]);
	state.posts = data.posts;
	state.categories = data.categories;
	state.site = data.siteDev;
	state.trash = trash.items;
	renderNav();
}

$('new').onclick = () => {
	location.hash = '#/edit/new';
};
$('save').onclick = save;
$('del').onclick = removePost;
$('catForm').addEventListener('submit', addCategory);
$('body').addEventListener('input', () => {
	countWords();
	updatePreview();
});

$('metaToggle').onclick = () => {
	const meta = $('meta');
	const open = meta.hidden;
	meta.hidden = !open;
	$('metaToggle').setAttribute('aria-expanded', String(open));
};

$('search').addEventListener('input', (e) => {
	state.query = e.target.value;
	renderRows();
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
		if (document.body.dataset.view === 'edit') save();
	}
	if (meta && e.key.toLowerCase() === 'k') {
		e.preventDefault();
		location.hash = '#/';
		setTimeout(() => $('search').focus(), 60);
	}
});

window.addEventListener('beforeunload', (e) => {
	if (!state.dirty) return;
	e.preventDefault();
	e.returnValue = '';
});

window.addEventListener('hashchange', route);

await refreshState();
await route();
