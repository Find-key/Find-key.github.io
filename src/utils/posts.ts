/**
 * 文章查询与分组。
 *
 * 站点的组织方式是「分类优先」：文章先归到分类，分类内再排序，
 * 而不是所有文章按时间堆在一条流里。所以这里的排序函数是分类内语义。
 */
import type { CollectionEntry } from 'astro:content';
import { getCollection } from 'astro:content';
import { CATEGORIES } from '../consts';

export type Post = CollectionEntry<'blog'>;

/** 草稿只在本地 dev 可见 */
export const isVisible = ({ data }: Post) => import.meta.env.DEV || !data.draft;

/**
 * 分类内排序：
 * - 两边都填了 order → 按 order 升序（系列文章）
 * - 只有一边填了 → 填了的在前
 * - 都没填 → 按发布时间倒序（新的在上）
 */
export function sortForReading(a: Post, b: Post): number {
	const ao = a.data.order;
	const bo = b.data.order;
	if (ao !== undefined && bo !== undefined) return ao - bo;
	if (ao !== undefined) return -1;
	if (bo !== undefined) return 1;
	return b.data.pubDate.valueOf() - a.data.pubDate.valueOf();
}

/** 全部（可见）文章 */
export async function allPosts(): Promise<Post[]> {
	const posts = await getCollection('blog', isVisible);
	return posts.sort(sortForReading);
}

/** 某个分类下的文章 */
export function postsOfCategory(posts: Post[], slug: string): Post[] {
	return posts.filter((post) => post.data.category === slug).sort(sortForReading);
}

/** 按 CATEGORIES 顺序分组，丢掉空分类 */
export function groupByCategory(posts: Post[]) {
	return CATEGORIES.map((category) => ({
		category,
		posts: postsOfCategory(posts, category.slug),
	})).filter((group) => group.posts.length > 0);
}

/** 找分类定义 */
export function categoryOf(slug: string) {
	return CATEGORIES.find((category) => category.slug === slug);
}

/** 粗略阅读时长：中文按 400 字/分钟，去掉空白 */
export function readingMinutes(body: string | undefined): number {
	if (!body) return 1;
	const chars = body.replace(/\s+/g, '').length;
	return Math.max(1, Math.round(chars / 400));
}
