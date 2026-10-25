/**
 * 本机写作后台（只监听 127.0.0.1，不要暴露到公网）
 *
 *   npm run admin        → http://127.0.0.1:4322
 *
 * 能做的事：
 *   - 列出 / 新建 / 编辑 / 删除 src/content/blog/*.md（frontmatter 由它生成，不用手写）
 *   - 增删 src/consts.ts 里 #region categories 之间的分类
 *   - 保存后在右侧给出本地预览地址
 *
 * 没有依赖，只用 node 内置模块。改的是磁盘上的真实文件，写完记得 git commit。
 */
import { createServer } from 'node:http';
import { readFile, writeFile, readdir, unlink, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const POSTS_DIR = join(ROOT, 'src/content/blog');
const CONSTS = join(ROOT, 'src/consts.ts');
const PORT = Number(process.env.ADMIN_PORT ?? 4322);
const SITE_DEV = process.env.SITE_DEV ?? 'http://localhost:4321/blog';

/* ---------------- 分类：读写 consts.ts 的 #region categories ---------------- */

async function readCategories() {
	const text = await readFile(CONSTS, 'utf8');
	const block = text.match(/#region categories([\s\S]*?)#endregion/);
	if (!block) return [];
	const out = [];
	const re = /\{\s*slug:\s*'([^']+)',\s*name:\s*'([^']+)',\s*description:\s*'([^']*)'\s*\}/g;
	let m;
	while ((m = re.exec(block[1]))) out.push({ slug: m[1], name: m[2], description: m[3] });
	return out;
}

async function writeCategories(list) {
	const text = await readFile(CONSTS, 'utf8');
	const lines = list
		.map(
			(c) =>
				`\t{ slug: '${c.slug}', name: '${c.name}', description: '${c.description.replaceAll("'", "\\'")}' },`,
		)
		.join('\n');
	const block = `#region categories\n// 这一段由 scripts/admin.mjs 维护；手写也可以，保持格式即可\nexport const CATEGORIES: CategoryItem[] = [\n${lines}${lines ? '\n' : ''}];\n// #endregion`;
	const next = text.replace(/#region categories[\s\S]*?#endregion/, block);
	await writeFile(CONSTS, next, 'utf8');
}

/* ---------------- 文章：frontmatter 解析 / 生成 ---------------- */

function parsePost(raw) {
	const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	const fm = m ? m[1] : '';
	const body = m ? m[2] : raw;
	const get = (key) => {
		const line = fm.split(/\r?\n/).find((l) => l.startsWith(`${key}:`));
		if (!line) return undefined;
		return line.slice(key.length + 1).trim().replace(/^['"]|['"]$/g, '');
	};
	const tagsRaw = get('tags');
	return {
		title: get('title') ?? '',
		description: get('description') ?? '',
		pubDate: get('pubDate') ?? '',
		category: get('category') ?? '',
		order: get('order'),
		draft: get('draft') === 'true',
		tags: tagsRaw
			? tagsRaw
					.replace(/^\[|\]$/g, '')
					.split(',')
					.map((t) => t.trim().replace(/^['"]|['"]$/g, ''))
					.filter(Boolean)
			: [],
		body: body.trimStart(),
	};
}

function buildPost(post) {
	const q = (v) => `"${String(v).replaceAll('"', '\\"')}"`;
	const lines = ['---', `title: ${q(post.title)}`, `description: ${q(post.description ?? '')}`];
	lines.push(`pubDate: ${post.pubDate}`);
	if (post.category) lines.push(`category: ${post.category}`);
	if (post.tags?.length) lines.push(`tags: [${post.tags.join(', ')}]`);
	if (post.order) lines.push(`order: ${post.order}`);
	if (post.draft) lines.push('draft: true');
	lines.push('---', '');
	return `${lines.join('\n')}\n${post.body ?? ''}\n`;
}

const slugify = (text) =>
	String(text)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);

async function listPosts() {
	if (!existsSync(POSTS_DIR)) await mkdir(POSTS_DIR, { recursive: true });
	const files = (await readdir(POSTS_DIR)).filter((f) => f.endsWith('.md'));
	const posts = [];
	for (const file of files) {
		const raw = await readFile(join(POSTS_DIR, file), 'utf8');
		const data = parsePost(raw);
		posts.push({ slug: file.replace(/\.md$/, ''), ...data, body: undefined });
	}
	posts.sort((a, b) => (a.pubDate < b.pubDate ? 1 : -1));
	return posts;
}

/* ---------------- HTTP ---------------- */

const json = (res, code, data) => {
	res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
	res.end(JSON.stringify(data));
};

const readBody = (req) =>
	new Promise((resolve) => {
		let raw = '';
		req.on('data', (chunk) => {
			raw += chunk;
			if (raw.length > 2_000_000) req.destroy();
		});
		req.on('end', () => {
			try {
				resolve(JSON.parse(raw || '{}'));
			} catch {
				resolve({});
			}
		});
	});

function restartDev() {
	execFile('npx', ['astro', 'dev', 'stop'], { cwd: ROOT }, () => {
		execFile('npx', ['astro', 'dev', '--background'], { cwd: ROOT }, () => {});
	});
}

const server = createServer(async (req, res) => {
	const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

	try {
		if (url.pathname === '/' && req.method === 'GET') {
			res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
			res.end(PAGE);
			return;
		}

		if (url.pathname === '/api/state') {
			json(res, 200, { posts: await listPosts(), categories: await readCategories(), siteDev: SITE_DEV });
			return;
		}

		if (url.pathname === '/api/post' && req.method === 'GET') {
			const slug = url.searchParams.get('slug') ?? '';
			const file = join(POSTS_DIR, `${slug}.md`);
			if (!slug || !existsSync(file)) return json(res, 404, { error: 'not found' });
			const raw = await readFile(file, 'utf8');
			return json(res, 200, { slug, ...parsePost(raw) });
		}

		if (url.pathname === '/api/post' && req.method === 'POST') {
			const data = await readBody(req);
			if (!data.title?.trim()) return json(res, 400, { error: '标题不能为空' });
			const slug =
				(data.slug && String(data.slug)) ||
				slugify(data.title) ||
				`post-${data.pubDate || new Date().toISOString().slice(0, 10)}`;
			await writeFile(join(POSTS_DIR, `${slug}.md`), buildPost({ ...data, slug }), 'utf8');
			// 改了文件名：删掉旧的那份，否则同一条内容会有两个文件
			const original = String(data.originalSlug ?? '');
			if (original && original !== slug && existsSync(join(POSTS_DIR, `${original}.md`))) {
				await unlink(join(POSTS_DIR, `${original}.md`));
			}
			return json(res, 200, { slug, url: `${SITE_DEV}/posts/${slug}/` });
		}

		if (url.pathname === '/api/post' && req.method === 'DELETE') {
			const slug = url.searchParams.get('slug') ?? '';
			const file = join(POSTS_DIR, `${slug}.md`);
			if (!slug || !existsSync(file)) return json(res, 404, { error: 'not found' });
			await unlink(file);
			return json(res, 200, { ok: true });
		}

		if (url.pathname === '/api/categories' && req.method === 'POST') {
			const data = await readBody(req);
			const list = Array.isArray(data.categories) ? data.categories : [];
			for (const c of list) {
				if (!/^[a-z0-9-]+$/.test(c.slug ?? '')) {
					return json(res, 400, { error: `slug 只能用小写英文/数字/连字符：${c.slug}` });
				}
				if (!c.name?.trim()) return json(res, 400, { error: '分类名不能为空' });
			}
			await writeCategories(list);
			restartDev();
			return json(res, 200, { ok: true, categories: list });
		}

		json(res, 404, { error: 'not found' });
	} catch (error) {
		json(res, 500, { error: String(error?.message ?? error) });
	}
});

server.on('error', (error) => {
	if (error.code === 'EADDRINUSE') {
		console.error(`端口 ${PORT} 已被占用——可能已经有一个后台在跑了。先关掉旧的（pkill -f scripts/admin.mjs）再启动。`);
	} else {
		console.error(error);
	}
	process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
	console.log(`写作后台已启动：http://127.0.0.1:${PORT}`);
	console.log(`它会把文章写进 ${POSTS_DIR}`);
});

/* ---------------- 单页界面 ---------------- */

const PAGE = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>写作后台</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root{--bg:#fbf9f5;--text:#262220;--muted:#736d64;--line:#e7e2d8;--soft:#f2ede4;--accent:#1f6f5c}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--text);font:14px/1.7 -apple-system,"PingFang SC","Noto Sans CJK SC",sans-serif}
  header{display:flex;align-items:baseline;gap:12px;padding:18px 26px;border-bottom:1px solid var(--line)}
  header h1{font:600 19px/1 -apple-system,Georgia,serif;margin:0}
  header span{color:var(--muted);font-size:12px}
  main{display:grid;grid-template-columns:300px 1fr;gap:0;min-height:calc(100vh - 58px)}
  aside{border-right:1px solid var(--line);padding:16px 18px;overflow:auto}
  .label{font:11px/1 ui-monospace,monospace;letter-spacing:.12em;color:var(--muted);text-transform:uppercase}
  ul{list-style:none;margin:10px 0 22px;padding:0}
  li{padding:7px 8px;border-radius:4px;cursor:pointer;display:flex;justify-content:space-between;gap:8px;align-items:baseline}
  li:hover{background:var(--soft)}
  li.active{background:var(--soft)}
  li .t{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  li .m{font:11px/1 ui-monospace,monospace;color:var(--muted);flex:none}
  .draft{color:#b06a2c}
  section.editor{padding:18px 26px 60px;max-width:860px}
  .row{display:grid;grid-template-columns:120px 1fr;gap:10px 14px;align-items:center;margin-bottom:10px}
  .row.col{grid-template-columns:1fr}
  label{color:var(--muted);font-size:12.5px}
  input,select,textarea{width:100%;padding:7px 9px;border:1px solid var(--line);border-radius:4px;background:#fff;color:inherit;font:inherit}
  textarea{min-height:340px;font:13px/1.75 ui-monospace,"Liberation Mono",monospace;resize:vertical}
  .actions{display:flex;gap:10px;align-items:center;margin:16px 0 0}
  button{padding:8px 14px;border:1px solid var(--line);border-radius:4px;background:#fff;cursor:pointer;font:inherit}
  button.primary{background:var(--text);color:var(--bg);border-color:var(--text)}
  button.danger{color:#a33}
  .hint{color:var(--muted);font-size:12px}
  .status{margin-left:auto;font-size:12.5px;color:var(--accent);min-height:1.2em}
  .cat{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--soft)}
  .cat .slug{font:11px/1 ui-monospace,monospace;color:var(--muted)}
  .cat button{padding:2px 7px;font-size:12px}
  .cat-add{display:grid;grid-template-columns:1fr 1fr auto;gap:6px;margin-top:8px}
  .cat-add input{padding:5px 7px;font-size:12.5px}
  @media(max-width:760px){main{grid-template-columns:1fr}aside{border-right:0;border-bottom:1px solid var(--line)}.row{grid-template-columns:1fr}}
</style></head>
<body>
<header><h1>写作后台</h1><span>只在本机运行 · 写的是仓库里的真实文件 · 完成后记得 git commit</span></header>
<main>
  <aside>
    <div class="label">文章 <button id="new" style="float:right;padding:2px 8px;font-size:11px">+ 新建</button></div>
    <ul id="list"></ul>
    <div class="label">分类</div>
    <div id="cats"></div>
    <div class="cat-add">
      <input id="cSlug" placeholder="slug（小写英文）">
      <input id="cName" placeholder="显示名">
      <button id="cAdd">加</button>
    </div>
    <p class="hint" style="margin-top:10px">改分类会重写 consts.ts 并重启 dev。</p>
  </aside>
  <section class="editor">
    <div class="row"><label>标题</label><input id="title" placeholder="文章标题"></div>
    <div class="row"><label>摘要</label><input id="description" placeholder="一句话说清写了什么（会出现在列表和 SEO）"></div>
    <div class="row"><label>分类</label><select id="category"></select></div>
    <div class="row"><label>日期</label><input id="pubDate" type="date"></div>
    <div class="row"><label>标签</label><input id="tags" placeholder="逗号分隔，小写英文：stack, ret2text"></div>
    <div class="row"><label>文件名</label><input id="slug" placeholder="留空按标题生成"></div>
    <div class="row"><label>草稿</label><label style="color:var(--text)"><input id="draft" type="checkbox" style="width:auto"> 只在本地可见</label></div>
    <div class="row col"><label>正文（Markdown，从 ## 开始）</label><textarea id="body" placeholder="## 环境&#10;&#10;..."></textarea></div>
    <div class="actions">
      <button class="primary" id="save">保存</button>
      <button id="preview">打开预览</button>
      <button class="danger" id="del">删除</button>
      <span class="status" id="status"></span>
    </div>
  </section>
</main>
<script>
const $ = (id) => document.getElementById(id);
let state = { posts: [], categories: [], siteDev: '' };
let current = null;

const stamp = () => new Date().toISOString().slice(0, 10);
const say = (msg, ok = true) => { $('status').textContent = msg; $('status').style.color = ok ? 'var(--accent)' : '#a33'; setTimeout(() => { if ($('status').textContent === msg) $('status').textContent = ''; }, 2600); };

function renderCats() {
  const wrap = $('cats');
  wrap.innerHTML = '';
  if (!state.categories.length) {
    wrap.innerHTML = '<p class="hint" style="margin:6px 0">还没有分类，下面加一个。</p>';
  }
  for (const c of state.categories) {
    const row = document.createElement('div');
    row.className = 'cat';
    row.innerHTML = '<span>' + c.name + '</span>' + (c.slug === c.name ? '' : '<span class="slug">' + c.slug + '</span>');
    const btn = document.createElement('button');
    btn.textContent = '删';
    btn.style.marginLeft = 'auto';
    btn.onclick = async () => {
      const next = state.categories.filter((x) => x.slug !== c.slug);
      await fetch('/api/categories', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ categories: next }) });
      await load();
      say('分类已删除');
    };
    row.appendChild(btn);
    wrap.appendChild(row);
  }
  const sel = $('category');
  sel.innerHTML = '<option value="">（不设分类）</option>' + state.categories.map((c) => '<option value="' + c.slug + '">' + c.name + '（' + c.slug + '）</option>').join('');
}

function renderList() {
  const ul = $('list');
  ul.innerHTML = '';
  if (!state.posts.length) ul.innerHTML = '<li class="hint" style="cursor:default">还没有文章</li>';
  for (const p of state.posts) {
    const li = document.createElement('li');
    if (current === p.slug) li.className = 'active';
    li.innerHTML = '<span class="t">' + (p.title || p.slug) + '</span><span class="m' + (p.draft ? ' draft' : '') + '">' + (p.draft ? '草稿' : p.pubDate) + '</span>';
    li.onclick = () => openPost(p.slug);
    ul.appendChild(li);
  }
}

function fillForm(p) {
  $('title').value = p.title || '';
  $('description').value = p.description || '';
  $('category').value = p.category || '';
  $('pubDate').value = p.pubDate || stamp();
  $('tags').value = (p.tags || []).join(', ');
  $('slug').value = p.slug || '';
  $('draft').checked = !!p.draft;
  $('body').value = p.body || '## 环境\\n\\n';
}

async function openPost(slug) {
  const r = await fetch('/api/post?slug=' + encodeURIComponent(slug));
  if (!r.ok) return say('读不到这篇文章', false);
  const data = await r.json();
  current = slug;
  fillForm(data);
  renderList();
}

function newPost() {
  current = null;
  fillForm({ pubDate: stamp(), body: '## 环境\\n\\n', category: state.categories[0]?.slug || '' });
  renderList();
  $('title').focus();
}

async function load() {
  const r = await fetch('/api/state');
  state = await r.json();
  renderCats();
  renderList();
}

$('new').onclick = newPost;

$('save').onclick = async () => {
  const payload = {
    slug: $('slug').value.trim().replace(/\\.md$/, '') || undefined,
    title: $('title').value,
    description: $('description').value,
    category: $('category').value,
    pubDate: $('pubDate').value || stamp(),
    tags: $('tags').value.split(',').map((t) => t.trim()).filter(Boolean),
    draft: $('draft').checked,
    body: $('body').value,
  };
  const r = await fetch('/api/post', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const data = await r.json();
  if (!r.ok) return say(data.error || '保存失败', false);
  current = data.slug;
  $('slug').value = data.slug;
  await load();
  say('已保存 ' + data.slug + '.md');
};

$('preview').onclick = () => {
  const slug = $('slug').value.trim();
  if (!slug) return say('先保存一次', false);
  window.open(state.siteDev + '/posts/' + slug + '/', '_blank');
};

$('del').onclick = async () => {
  const slug = $('slug').value.trim();
  if (!slug) return say('先选中一篇文章', false);
  if (!confirm('删除 ' + slug + '.md ？')) return;
  const r = await fetch('/api/post?slug=' + encodeURIComponent(slug), { method: 'DELETE' });
  if (!r.ok) return say('删除失败', false);
  current = null;
  newPost();
  await load();
  say('已删除');
};

$('cAdd').onclick = async () => {
  const slug = $('cSlug').value.trim();
  const name = $('cName').value.trim();
  if (!slug || !name) return say('slug 和显示名都要填', false);
  const next = [...state.categories, { slug, name, description: '' }];
  const r = await fetch('/api/categories', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ categories: next }) });
  const data = await r.json();
  if (!r.ok) return say(data.error || '加分类失败', false);
  $('cSlug').value = '';
  $('cName').value = '';
  await load();
  say('分类已加，dev 正在重启');
};

load().then(newPost);
</script>
</body></html>`;
