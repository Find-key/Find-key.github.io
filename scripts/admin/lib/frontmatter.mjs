/**
 * frontmatter 的读写。
 *
 * 只处理我们自己的字段（title / description / pubDate / category / tags /
 * draft / order），够用且可控：不引 yaml 库，也不去猜别人的写法。
 */

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

const unquote = (value) => value.trim().replace(/^['"]|['"]$/g, '');

/** 把 .md 文本拆成 { data, body } */
export function parseMarkdown(raw) {
	const match = raw.match(FENCE);
	const head = match ? match[1] : '';
	const body = match ? match[2] : raw;

	const field = (key) => {
		const line = head.split(/\r?\n/).find((l) => l.startsWith(`${key}:`));
		return line ? line.slice(key.length + 1) : undefined;
	};

	const tagsRaw = field('tags');
	const tags = tagsRaw
		? unquote(tagsRaw)
				.replace(/^\[|\]$/g, '')
				.split(',')
				.map((t) => unquote(t))
				.filter(Boolean)
		: [];

	return {
		data: {
			title: unquote(field('title') ?? ''),
			description: unquote(field('description') ?? ''),
			pubDate: unquote(field('pubDate') ?? ''),
			category: unquote(field('category') ?? ''),
			order: field('order') ? Number(unquote(field('order'))) : undefined,
			draft: unquote(field('draft') ?? '') === 'true',
			tags,
		},
		body: body.replace(/^\r?\n/, ''),
	};
}

/** 用我们的字段顺序拼回 .md 文本 */
export function buildMarkdown(post) {
	const quote = (v) => `"${String(v ?? '').replaceAll('"', '\\"')}"`;
	const lines = ['---', `title: ${quote(post.title)}`, `description: ${quote(post.description)}`];

	lines.push(`pubDate: ${post.pubDate}`);
	if (post.category) lines.push(`category: ${post.category}`);
	if (post.tags?.length) lines.push(`tags: [${post.tags.join(', ')}]`);
	if (post.order) lines.push(`order: ${post.order}`);
	if (post.draft) lines.push('draft: true');
	lines.push('---', '');

	const body = String(post.body ?? '').replace(/\s+$/, '');
	return `${lines.join('\n')}${body ? `\n${body}\n` : ''}`;
}
