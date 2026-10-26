/**
 * base 路径工具
 *
 * 站点现在部署在用户站的根路径（base = ''）。历史上做过 /blog 项目站，
 * 页面里写死的 href="/blog/xxx" 一改 base 就会全部失效。
 * 所以：所有站内链接一律过 withBase()，只写逻辑路径。
 */
import { SITE } from '../consts';

/** 去掉尾部斜杠的 base：'/blog' 或 ''（用户主页站） */
const BASE = SITE.base.replace(/\/+$/, '');

const isExternal = (path: string) =>
	/^(https?:)?\/\//.test(path) || path.startsWith('mailto:') || path.startsWith('#');

/** 站内路径 → 带 base 前缀的路径。外部链接原样返回。 */
export function withBase(path: string): string {
	if (isExternal(path)) return path;
	const clean = `/${path.replace(/^\/+/, '')}`;
	return `${BASE}${clean}` || '/';
}

/** 站内路径 → 绝对 URL（用于 canonical、RSS、OG） */
export function absoluteUrl(path: string): string {
	if (isExternal(path)) return path;
	return new URL(withBase(path), SITE.url).toString();
}

/**
 * 构建产物里的资源路径（如 /blog/_astro/xxx.jpg）→ 绝对 URL。
 * 这类路径已经带 base 了，再拼一次会得到 /blog/blog/...，所以要判断一下。
 */
export function absoluteAssetUrl(path: string): string {
	if (isExternal(path)) return path;
	const alreadyBased = BASE !== '' && (path === BASE || path.startsWith(`${BASE}/`));
	return new URL(alreadyBased ? path : withBase(path), SITE.url).toString();
}

/** 文章路径：/posts/<id>/ */
export function postUrl(id: string): string {
	return withBase(`/posts/${id}/`);
}

/** 分类路径：/categories/<slug>/ */
export function categoryUrl(slug: string): string {
	return withBase(`/categories/${slug}/`);
}

/** 标签路径：/tags/<tag>/ */
export function tagUrl(tag: string): string {
	return withBase(`/tags/${encodeURIComponent(tag)}/`);
}
