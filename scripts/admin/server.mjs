/**
 * 写作后台的 HTTP 层：路由 + 静态文件。
 *
 * 只监听 127.0.0.1。所有写操作都走 lib/ 里的 store，
 * 这里只做参数校验、状态码和 JSON 包装。
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { execFile } from 'node:child_process';
import { PostStore } from './lib/posts.mjs';
import { CategoryStore, usageOf } from './lib/categories.mjs';
import { HttpError } from './lib/errors.mjs';

const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.svg': 'image/svg+xml',
};

export function startServer({ root, uiDir, postsDir, trashDir, constsPath, port, siteDev }) {
	const posts = new PostStore(postsDir, trashDir);
	const categories = new CategoryStore(constsPath);

	const json = (res, status, data) => {
		res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
		res.end(JSON.stringify(data));
	};

	const readJson = (req) =>
		new Promise((resolve, reject) => {
			let raw = '';
			req.on('data', (chunk) => {
				raw += chunk;
				if (raw.length > 4_000_000) {
					req.destroy();
					reject(new HttpError(413, '请求体太大'));
				}
			});
			req.on('end', () => {
				if (!raw) return resolve({});
				try {
					resolve(JSON.parse(raw));
				} catch {
					reject(new HttpError(400, 'JSON 解析失败'));
				}
			});
			req.on('error', reject);
		});

	/** 改分类后 dev server 需要重启才会生效 */
	const restartDev = () =>
		new Promise((resolve) => {
			execFile('npx', ['astro', 'dev', 'stop'], { cwd: root }, () => {
				execFile('npx', ['astro', 'dev', '--background'], { cwd: root }, () => resolve());
			});
		});

	const state = async () => {
		const [list, cats] = await Promise.all([posts.list(), categories.read()]);
		const usage = usageOf(list);
		return {
			posts: list,
			categories: cats.map((c) => ({ ...c, count: usage.get(c.slug) ?? 0 })),
			orphans: list.filter((p) => p.category && !cats.some((c) => c.slug === p.category)).map((p) => p.slug),
			siteDev,
		};
	};

	const routes = [
		['GET', /^\/api\/state$/, async () => state()],

		[
			'GET',
			/^\/api\/post$/,
			async (_req, url) => {
				const slug = url.searchParams.get('slug') ?? '';
				const post = await posts.get(slug);
				if (!post) throw new HttpError(404, '读不到这篇文章');
				return post;
			},
		],

		[
			'POST',
			/^\/api\/post$/,
			async (req) => {
				const body = await readJson(req);
				return posts.save(body);
			},
		],

		[
			'DELETE',
			/^\/api\/post$/,
			async (_req, url) => posts.remove(url.searchParams.get('slug') ?? ''),
		],

		['GET', /^\/api\/trash$/, async () => ({ items: await posts.listTrash() })],

		[
			'POST',
			/^\/api\/trash\/restore$/,
			async (req) => {
				const { id } = await readJson(req);
				return posts.restore(id);
			},
		],

		[
			'DELETE',
			/^\/api\/trash$/,
			async (_req, url) => posts.purge(url.searchParams.get('id') ?? ''),
		],

		[
			'POST',
			/^\/api\/categories$/,
			async (req) => {
				const { categories: next, force = false } = await readJson(req);
				if (!Array.isArray(next)) throw new HttpError(400, 'categories 必须是数组');

				const before = await categories.read();
				const after = new Set(next.map((c) => String(c.slug ?? '').toLowerCase()));
				const removed = before.filter((c) => !after.has(c.slug));

				if (removed.length && !force) {
					// 还有文章在用的分类不许悄悄删掉
					const list = await posts.list();
					const usage = usageOf(list);
					const inUse = removed
						.map((c) => ({ slug: c.slug, name: c.name, count: usage.get(c.slug) ?? 0 }))
						.filter((c) => c.count > 0);
					if (inUse.length) {
						throw new HttpError(
							409,
							`这些分类下还有文章，先改文章再删：${inUse.map((c) => `${c.name}(${c.count})`).join('、')}`,
						);
					}
				}

				const saved = await categories.write(next);
				if (removed.length) await restartDev();
				return { categories: saved, restarted: removed.length > 0 };
			},
		],
	];

	const server = createServer(async (req, res) => {
		const url = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`);

		// 静态资源
		if (req.method === 'GET' && !url.pathname.startsWith('/api/')) {
			const rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
			const file = normalize(join(uiDir, rel));
			if (!file.startsWith(uiDir) || !existsSync(file)) {
				res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
				return res.end('404');
			}
			res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
			return res.end(await readFile(file));
		}

		try {
			for (const [method, pattern, handler] of routes) {
				if (req.method !== method || !pattern.test(url.pathname)) continue;
				const data = await handler(req, url);
				return json(res, 200, data ?? { ok: true });
			}
			throw new HttpError(404, `没有这个接口：${req.method} ${url.pathname}`);
		} catch (error) {
			const status = error instanceof HttpError ? error.status : 500;
			if (status === 500) console.error(error);
			json(res, status, { error: error?.message ?? String(error) });
		}
	});

	server.on('error', (error) => {
		if (error.code === 'EADDRINUSE') {
			console.error(`端口 ${port} 已被占用——可能已经有一个后台在跑了。先 pkill -x -f "node scripts/admin.mjs" 再启动。`);
		} else {
			console.error(error);
		}
		process.exit(1);
	});

	server.listen(port, '127.0.0.1', () => {
		console.log(`写作后台已启动：http://127.0.0.1:${port}`);
		console.log(`文章目录：${postsDir}`);
		console.log(`删除的文章会进 ${trashDir}，可在界面里撤销`);
	});

	return server;
}
