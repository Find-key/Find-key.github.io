/**
 * 分类：读写 src/consts.ts 里 #region categories 那一段。
 *
 * 写之前一律校验：slug 合法、不重复、name 不为空。
 * 删分类时默认拒绝"还有文章在用"的分类——必须在 UI 里明确确认（force）。
 */
import { readFile, writeFile, rename } from 'node:fs/promises';
import { HttpError } from './errors.mjs';

const REGION = /#region categories[\s\S]*?#endregion/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;

export class CategoryStore {
	constructor(constsPath) {
		this.path = constsPath;
	}

	async read() {
		const text = await readFile(this.path, 'utf8');
		const block = text.match(REGION);
		if (!block) return [];
		const out = [];
		const re = /\{\s*slug:\s*'([^']+)',\s*name:\s*'([^']+)',\s*description:\s*'([^']*)'\s*\}/g;
		let m;
		while ((m = re.exec(block[0]))) out.push({ slug: m[1], name: m[2], description: m[3] });
		return out;
	}

	async write(list) {
		const clean = [];
		const seen = new Set();

		for (const raw of list) {
			const slug = String(raw.slug ?? '').trim().toLowerCase();
			const name = String(raw.name ?? '').trim();
			const description = String(raw.description ?? '').trim();

			if (!SLUG_RE.test(slug)) throw new HttpError(400, `分类 slug 不合法：${slug || '(空)'}`);
			if (!name) throw new HttpError(400, `分类 ${slug} 缺少显示名`);
			if (seen.has(slug)) throw new HttpError(400, `分类 slug 重复：${slug}`);
			seen.add(slug);
			clean.push({ slug, name, description });
		}

		const body = clean
			.map(
				(c) =>
					`\t{ slug: '${c.slug}', name: '${c.name}', description: '${c.description.replaceAll("'", "\\'")}' },`,
			)
			.join('\n');

		const text = await readFile(this.path, 'utf8');
		const next = `#region categories\n// 这一段由 npm run admin 的后台维护；手写也可以，保持格式即可\nexport const CATEGORIES: CategoryItem[] = [\n${body}${body ? '\n' : ''}];\n// #endregion`;

		const tmp = `${this.path}.tmp`;
		await writeFile(tmp, text.replace(REGION, next), 'utf8');
		await rename(tmp, this.path);

		return clean;
	}
}

/** 每个分类下有多少篇文章（用来拦"删掉还有文章的分类"） */
export function usageOf(posts) {
	const map = new Map();
	for (const post of posts) {
		const key = post.category || '';
		map.set(key, (map.get(key) ?? 0) + 1);
	}
	return map;
}

