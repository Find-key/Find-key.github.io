/**
 * 写作台前端：只负责渲染与调用 /api/*，所有校验在服务端。
 */
const $ = (id) => document.getElementById(id);

const state = {
	posts: [],
	categories: [],
	orphans: [],
	siteDev: '',
	current: null, // 正在编辑的 slug
	originalSlug: null, // 打开时的 slug：改名时用来挪走旧文件
	dirty: false,
};

/* ---------- 小工具 ---------- */

const stamp = () => new Date().toISOString().slice(0, 10);

function setStatus(text, tone = 'accent') {
	const el = $('status');
	el.textContent = text;
	el.style.color = tone === 'danger' ? 'var(--danger)' : tone === 'muted' ? 'var(--muted)' : 'var(--accent)';
}

let toastTimer;
function toast(text, action) {
	const box = $('toast');
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
	box.classList.add('show');
	clearTimeout(toastTimer);
	toastTimer = setTimeout(hideToast, action ? 8000 : 2600);
}

function hideToast() {
	$('toast').classList.remove('show');
}

/** 自绘确认框，比 window.confirm 好控文案，也能带高危色 */
function confirmDialog(message, { ok = '确定', danger = false } = {}) {
	const modal = $('modal');
	$('modalText').innerHTML = message;
	$('modalOk').textContent = ok;
	$('modalOk').classList.toggle('primary', !danger);
	$('modalOk').classList.toggle('danger', danger);
	modal.hidden = false;

	return new Promise((resolve) => {
		const done = (value) => {
			modal.hidden = true;
			$('modalOk').onclick = null;
			$('modalCancel').onclick = null;
			document.removeEventListener('keydown', onKey);
			resolve(value);
		};
		const onKey = (e) => {
			if (e.key === 'Escape') done(false);
			if (e.key === 'Enter') done(true);
		};
		$('modalOk').onclick = () => done(true);
		$('modalCancel').onclick = () => done(false);
		document.addEventListener('keydown', onKey);
	});
}

const api = async (path, options = {}) => {
	const res = await fetch(path, {
		headers: options.body ? { 'content-type': 'application/json' } : undefined,
		...options,
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error || `请求失败（${res.status}）`);
	return data;
};

/* ---------- 渲染 ---------- */

function renderList() {
	const ul = $('list');
	ul.innerHTML = '';

	if (!state.posts.length) {
		ul.innerHTML = '<li class="post"><span class="t" style="color:var(--muted)">还没有文章</span></li>';
		return;
	}

	for (const post of state.posts) {
		const li = document.createElement('li');
		li.className = 'post' + (state.current === post.slug ? ' active' : '');
		const meta = [post.category || '未分类', post.draft ? '<b>草稿</b>' : post.pubDate].filter(Boolean).join(' · ');
		li.innerHTML = `<span class="t"></span><span class="m">${meta}</span>`;
		li.querySelector('.t').textContent = post.title || post.slug;
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
		row.innerHTML = `<span></span>${cat.slug === cat.name ? '' : '<span class="slug"></span>'}<span class="count">${cat.count || 0}</span>`;
		row.children[0].textContent = cat.name;
		if (cat.slug !== cat.name) row.children[1].textContent = cat.slug;

		const del = document.createElement('button');
		del.textContent = '×';
		del.title = cat.count ? `还有 ${cat.count} 篇在用，删不掉` : '删除这个分类';
		del.onclick = () => removeCategory(cat);
		row.appendChild(del);
		box.appendChild(row);
	}

	const select = $('category');
	const current = select.value;
	select.innerHTML =
		'<option value="">（不设分类）</option>' +
		state.categories.map((c) => `<option value="${c.slug}">${c.name}（${c.slug}）</option>`).join('');
	select.value = current;
}

async function renderTrash() {
	const { items } = await api('/api/trash');
	$('trashCount').textContent = items.length ? `(${items.length})` : '';
	const box = $('trashList');
	box.innerHTML = '';

	if (!items.length) {
		box.innerHTML = '<p class="hint" style="margin:6px 0">空的。</p>';
		return;
	}

	for (const item of items) {
		const row = document.createElement('div');
		row.className = 'item';
		row.innerHTML = '<span></span>';
		row.children[0].textContent = item.id.replace(/^[^_]*__/, '').replace(/\.md$/, '');

		const btn = document.createElement('button');
		btn.textContent = '恢复';
		btn.onclick = async () => {
			const r = await api('/api/trash/restore', { method: 'POST', body: JSON.stringify({ id: item.id }) });
			await refresh();
			toast(`已恢复到 ${r.slug}.md`);
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
	setStatus('');
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
	state.orphans = data.orphans;
	state.siteDev = data.siteDev;
	renderList();
	renderCategories();
	await renderTrash();
}

async function openPost(slug) {
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
	fillForm({
		pubDate: stamp(),
		category: state.categories[0]?.slug ?? '',
		body: '## 环境\n\n',
	});
	renderList();
	$('title').focus();
}

async function save() {
	try {
		const payload = readForm();
		const result = await api('/api/post', { method: 'POST', body: JSON.stringify(payload) });
		state.current = result.slug;
		state.originalSlug = result.slug;
		$('slug').value = result.slug;
		state.dirty = false;
		await refresh();
		setStatus(`已保存 ${result.slug}.md`);
		if (result.renamedFrom) toast(`已改名为 ${result.slug}.md，旧文件进了回收站`);
	} catch (error) {
		setStatus(error.message, 'danger');
		toast(error.message);
	}
}

async function removePost() {
	if (!state.current) return;
	const ok = await confirmDialog(
		`把 <b>${state.current}.md</b> 挪进回收站？<br><span style="color:var(--muted)">之后可以在侧栏回收站里恢复。</span>`,
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
	if (cat.count) {
		toast(`「${cat.name}」下还有 ${cat.count} 篇文章，先改文章再删`);
		return;
	}
	const ok = await confirmDialog(`删除分类 <b>${cat.name}</b>（${cat.slug}）？`, { ok: '删除', danger: true });
	if (!ok) return;

	try {
		await api('/api/categories', {
			method: 'POST',
			body: JSON.stringify({ categories: state.categories.filter((c) => c.slug !== cat.slug) }),
		});
		await refresh();
		setStatus('分类已删除，dev 已重启');
	} catch (error) {
		setStatus(error.message, 'danger');
		toast(error.message);
	}
}

async function addCategory() {
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
		setStatus(`分类 ${name} 已添加，dev 已重启`);
	} catch (error) {
		setStatus(error.message, 'danger');
		toast(error.message);
	}
}

async function preview() {
	const slug = $('slug').value.trim() || state.current;
	if (!slug) return toast('先保存一次再预览');
	window.open(`${state.siteDev}/posts/${slug}/`, '_blank', 'noopener');
}

/* ---------- 事件绑定 ---------- */

$('new').onclick = newPost;
$('save').onclick = save;
$('del').onclick = removePost;
$('preview').onclick = preview;
$('cAdd').onclick = addCategory;
$('body').addEventListener('input', countWords);

for (const id of ['title', 'description', 'category', 'pubDate', 'tags', 'slug', 'body', 'draft']) {
	const el = $(id);
	const mark = () => {
		if (state.dirty) return;
		state.dirty = true;
		setStatus('未保存', 'muted');
	};
	el.addEventListener('input', mark);
	el.addEventListener('change', mark);
}

document.addEventListener('keydown', (e) => {
	if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
		e.preventDefault();
		save();
	}
});

window.addEventListener('beforeunload', (e) => {
	if (!state.dirty) return;
	e.preventDefault();
	e.returnValue = '';
});

await refresh();
if (!state.current) newPost();
