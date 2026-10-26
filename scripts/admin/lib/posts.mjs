/**
 * 文章：列表 / 读取 / 保存 / 软删除 / 恢复。
 *
 * 删除不直接 unlink，而是挪到 .trash/，文件名前面加时间戳。
 * 这样误删还能撤销，也让 git 里少一堆"文件消失"的 diff。
 */
import { readFile, writeFile, readdir, mkdir, rename, unlink, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseMarkdown, buildMarkdown } from './frontmatter.mjs';
import { HttpError } from './errors.mjs';

const TRASH_DIRNAME = '.trash';

const slugify = (text) =>
	String(text)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,60}$/;

export class PostStore {
	constructor(postsDir, trashDir) {
		this.dir = postsDir;
		this.trash = trashDir ?? join(postsDir, TRASH_DIRNAME);
	}

	async ensure() {
		if (!existsSync(this.dir)) await mkdir(this.dir, { recursive: true });
		if (!existsSync(this.trash)) await mkdir(this.trash, { recursive: true });
	}

	path(slug) {
		return join(this.dir, `${slug}.md`);
	}

	async list() {
		await this.ensure();
		const files = (await readdir(this.dir)).filter((f) => f.endsWith('.md'));
		const posts = [];
		for (const file of files) {
			const raw = await readFile(join(this.dir, file), 'utf8');
			const { data } = parseMarkdown(raw);
			posts.push({ slug: file.replace(/\.md$/, ''), ...data });
		}
		return posts.sort((a, b) => (String(a.pubDate) < String(b.pubDate) ? 1 : -1));
	}

	async get(slug) {
		const file = this.path(slug);
		if (!existsSync(file)) return null;
		const raw = await readFile(file, 'utf8');
		const { data, body } = parseMarkdown(raw);
		return { slug, ...data, body };
	}

	/** 新建或覆盖；改 slug 时把旧文件挪进 trash 而不是删掉 */
	async save(input) {
		await this.ensure();

		const title = String(input.title ?? '').trim();
		if (!title) throw new HttpError(400, '标题不能为空');

		const slug = (input.slug ? slugify(input.slug) : '') || slugify(title);
		if (!SLUG_RE.test(slug)) throw new HttpError(400, `文件名不合法：${slug}`);

		const target = this.path(slug);
		const original = input.originalSlug ? slugify(input.originalSlug) : '';
		const renaming = original && original !== slug;

		if (!renaming && original !== slug && existsSync(target) && input.create) {
			throw new HttpError(409, `${slug}.md 已存在，换个文件名`);
		}

		const markdown = buildMarkdown({
			title,
			description: input.description ?? '',
			pubDate: input.pubDate || new Date().toISOString().slice(0, 10),
			category: input.category ?? '',
			tags: Array.isArray(input.tags) ? input.tags : [],
			order: input.order,
			draft: !!input.draft,
			body: input.body ?? '',
		});

		// 先写临时文件再改名，避免中断时留下半个文件
		const tmp = `${target}.tmp`;
		await writeFile(tmp, markdown, 'utf8');
		await rename(tmp, target);

		if (renaming && existsSync(this.path(original))) {
			await this.trashFile(original);
		}

		return { slug, renamedFrom: renaming ? original : null };
	}

	/** 软删除：挪进 .trash，返回可撤销的 id */
	async remove(slug) {
		if (!existsSync(this.path(slug))) throw new HttpError(404, `${slug}.md 不存在`);
		const id = await this.trashFile(slug);
		return { slug, trashId: id };
	}

	async trashFile(slug) {
		await this.ensure();
		const stamp = new Date().toISOString().replace(/[:.]/g, '-');
		const id = `${stamp}__${slug}.md`;
		await rename(this.path(slug), join(this.trash, id));
		return id;
	}

	async listTrash() {
		await this.ensure();
		const files = (await readdir(this.trash)).filter((f) => f.endsWith('.md'));
		const out = [];
		for (const file of files) {
			const info = await stat(join(this.trash, file));
			out.push({ id: file, at: info.mtime.toISOString() });
		}
		return out.sort((a, b) => (a.at < b.at ? 1 : -1));
	}

	/** 从 trash 恢复；同名文件已存在时加 -restored 后缀，绝不覆盖 */
	async restore(id) {
		if (!id || id.includes('/') || id.includes('..')) throw new HttpError(400, '无效的回收站条目');
		const src = join(this.trash, id);
		if (!existsSync(src)) throw new HttpError(404, '回收站里没有这一条');

		let slug = id.replace(/^[^_]*__/, '').replace(/\.md$/, '');
		if (existsSync(this.path(slug))) slug = `${slug}-restored`;
		await rename(src, this.path(slug));
		return { slug };
	}

	async purge(id) {
		const src = join(this.trash, id);
		if (!existsSync(src)) throw new HttpError(404, '回收站里没有这一条');
		await unlink(src);
		return { ok: true };
	}
}

