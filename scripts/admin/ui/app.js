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
	document.querySelectorAll('.sitebar-nav a[data-nav]').forEach((a) => {
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
		renderGroups();
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

/* ---------- 计数 ---------- */

function renderCounts() {
	$('totalCount').textContent = state.posts.length ? `共 ${state.posts.length} 篇` : '';
	$('catTotal').textContent = state.categories.length ? `${state.categories.length} 个` : '';
	$('trashTotal').textContent = state.trash.length ? `${state.trash.length} 条` : '';
}

/* ---------- 列表：按分类分组 ---------- */

function matchesQuery(post) {
	const q = state.query.trim().toLowerCase();
	if (!q) return true;
	return (
		(post.title || '').toLowerCase().includes(q) ||
		(post.slug || '').toLowerCase().includes(q) ||
		(post.tags || []).join(' ').toLowerCase().includes(q)
	);
}

function renderGroups() {
	const box = $('groups');
	box.innerHTML = '';

	const posts = state.posts.filter(matchesQuery);
	$('listEmpty').hidden = posts.length > 0;
	renderCounts();

	const buckets = state.categories.map((cat) => ({
		slug: cat.slug,
		name: cat.name,
		description: cat.description,
		posts: posts.filter((p) => p.category === cat.slug),
	}));

	const orphans = posts.filter((p) => !state.categories.some((c) => c.slug === p.category));
	if (orphans.length) buckets.push({ slug: '', name: '未分类', description: '', posts: orphans });

	for (const bucket of buckets) {
		if (!bucket.posts.length) continue;

		const group = document.createElement('section');
		group.className = 'group';
		group.innerHTML = `
			<div class="group-head"><h2></h2><span class="n">${bucket.posts.length}</span></div>
			${bucket.description ? '<p class="group-desc"></p>' : ''}
			<ul class="entries"></ul>`;
		group.querySelector('h2').textContent = bucket.name;
		if (bucket.description) group.querySelector('.group-desc').textContent = bucket.description;

		const ul = group.querySelector('.entries');
		for (const post of bucket.posts) {
			const li = document.createElement('li');
			li.innerHTML = `<span class="t"></span>${post.draft ? '<span class="draft">草稿</span>' : ''}<time></time>`;
			li.querySelector('.t').textContent = post.title || post.slug;
			li.querySelector('time').textContent = post.draft ? '' : post.pubDate || '';
			li.onclick = () => {
				location.hash = `#/edit/${encodeURIComponent(post.slug)}`;
			};
			ul.appendChild(li);
		}
		box.appendChild(group);
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
	renderCounts();
	fillCategoriesSelect();
	if (!silent) setState('分类已保存，dev 已重启');
	return saved;
}

function renderCategories() {
	const box = $('catRows');
	box.innerHTML = '';
	renderCounts();

	for (const cat of state.categories) {
		const row = document.createElement('div');
		row.className = 'cat-row';

		const name = document.createElement('input');
		name.className = 'name';
		name.value = cat.name;
		name.setAttribute('aria-label', '显示名');

		const slug = document.createElement('span');
		slug.className = 'slug';
		slug.textContent = cat.slug;

		const n = document.createElement('span');
		n.className = 'n';
		n.textContent = cat.count ? `${cat.count} 篇` : '—';

		const desc = document.createElement('input');
		desc.className = 'desc';
		desc.value = cat.description ?? '';
		desc.placeholder = '点这里写一句描述（会显示在首页）';
		desc.setAttribute('aria-label', '分类描述');

		const acts = document.createElement('span');
		acts.className = 'acts';
		const del = document.createElement('button');
		del.className = 'quiet danger';
		del.textContent = '删除';
		del.disabled = !!cat.count;
		del.title = cat.count ? `还有 ${cat.count} 篇在用` : '';
		del.onclick = async () => {
			const ok = await confirmDialog(`删除分类 <b>${cat.name}</b>（${cat.slug}）？`, { ok: '删除', danger: true });
			if (!ok) return;
			await saveCategories(state.categories.filter((c) => c.slug !== cat.slug));
			renderCategories();
		};
		acts.appendChild(del);

		const commit = async () => {
			const nextName = name.value.trim() || cat.name;
			const nextDesc = desc.value;
			if (nextName === cat.name && nextDesc === (cat.description ?? '')) return;
			const next = state.categories.map((c) =>
				c.slug === cat.slug ? { ...c, name: nextName, description: nextDesc } : c,
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

		row.append(name, slug, n, desc, acts);
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
	renderCounts();
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
	renderCounts();
}

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
	renderGroups();
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
