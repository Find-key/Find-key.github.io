import { getCollection } from 'astro:content';
import { SITE } from '../consts';
import { categoryOf, isVisible } from '../utils/posts';
import { absoluteUrl } from '../utils/url';

function escapeXml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

/** 静态端点：构建时生成 dist/rss.xml（标准 RSS 2.0，零额外依赖） */
export async function GET() {
	const posts = (await getCollection('blog', isVisible)).sort(
		(a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
	);

	const siteLink = absoluteUrl('/');
	const feedLink = absoluteUrl('/rss.xml');
	const lastBuild = (posts[0]?.data.pubDate ?? new Date()).toUTCString();

	const items = posts
		.map((post) => {
			const link = absoluteUrl(`/posts/${post.id}/`);
			const category = categoryOf(post.data.category)?.name ?? post.data.category;
			return `		<item>
			<title>${escapeXml(post.data.title)}</title>
			<link>${escapeXml(link)}</link>
			<guid isPermaLink="true">${escapeXml(link)}</guid>
			<pubDate>${post.data.pubDate.toUTCString()}</pubDate>
			<description>${escapeXml(post.data.description)}</description>
			<category>${escapeXml(category)}</category>
		</item>`;
		})
		.join('\n');

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
	<channel>
		<title>${escapeXml(SITE.title)}</title>
		<link>${escapeXml(siteLink)}</link>
		<description>${escapeXml(SITE.description)}</description>
		<language>${escapeXml(SITE.lang)}</language>
		<lastBuildDate>${lastBuild}</lastBuildDate>
		<atom:link href="${escapeXml(feedLink)}" rel="self" type="application/rss+xml" />
${items}
	</channel>
</rss>
`;

	return new Response(xml, {
		headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
	});
}
