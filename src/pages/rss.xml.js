import { getCollection } from 'astro:content';
import rss from '@astrojs/rss';
import { SITE } from '../consts';
import { absoluteUrl, postUrl } from '../utils/url';

export async function GET() {
	const posts = (await getCollection('blog', ({ data }) => !data.draft)).sort(
		(a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
	);

	return rss({
		title: SITE.title,
		description: SITE.description,
		site: absoluteUrl('/'),
		// ⚠️ rss 的 link 必须是站点内完整路径（含 base），所以走 postUrl()
		items: posts.map((post) => ({
			title: post.data.title,
			description: post.data.description,
			pubDate: post.data.pubDate,
			link: postUrl(post.id),
			categories: post.data.tags,
		})),
		customData: `<language>zh-cn</language>`,
	});
}
