#!/usr/bin/env node
/**
 * 新建文章：从模板生成一个 md 文件，frontmatter 一次填好。
 *
 *   npm run new -- "栈溢出的偏移是怎么算出来的" --cat pwn --tags stack,ret2text
 *   npm run new -- "标题" --cat pwn --slug ret2text --draft
 *
 * 不写 --slug 时：标题里的 ASCII 会被转成 kebab-case；全是中文则用日期兜底。
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const postsDir = join(root, 'src/content/blog');

// 从 consts.ts 里读分类，避免两处维护
const consts = readFileSync(join(root, 'src/consts.ts'), 'utf8');
const categories = [...consts.matchAll(/slug: '([^']+)',\s*\n\s*name: '([^']+)'/g)].map((m) => ({
	slug: m[1],
	name: m[2],
}));

const argv = process.argv.slice(2);
const flags = {};
const words = [];
for (let i = 0; i < argv.length; i += 1) {
	const arg = argv[i];
	if (arg.startsWith('--')) {
		const key = arg.slice(2);
		const next = argv[i + 1];
		if (next && !next.startsWith('--')) {
			flags[key] = next;
			i += 1;
		} else {
			flags[key] = true;
		}
	} else {
		words.push(arg);
	}
}

const title = words.join(' ').trim();
if (!title) {
	console.error('用法：npm run new -- "文章标题" --cat pwn [--tags a,b] [--slug xxx] [--draft]');
	console.error(`可选分类：${categories.map((c) => `${c.slug}（${c.name}）`).join(' / ')}`);
	process.exit(1);
}

const category = flags.cat ?? categories[0]?.slug;
if (!categories.some((c) => c.slug === category)) {
	console.error(`分类 "${category}" 不存在。可选：${categories.map((c) => c.slug).join(', ')}`);
	process.exit(1);
}

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date());
const slugify = (text) =>
	text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
const ascii = slugify(title);
const hasCJK = /[\u3400-\u9fff]/.test(title);
// 中文标题转完只剩零星英文时，补上日期，免得几篇都撞成同一个 slug
const slug =
	(flags.slug && String(flags.slug)) ||
	(hasCJK ? (ascii ? `${ascii}-${today.replaceAll('-', '')}` : `post-${today.replaceAll('-', '')}`) : ascii);

const file = join(postsDir, `${slug}.md`);
if (existsSync(file)) {
	console.error(`已存在：${file}`);
	process.exit(1);
}

const tags = flags.tags ? String(flags.tags).split(',').map((t) => t.trim()).filter(Boolean) : [];

const front = [
	'---',
	`title: "${title.replaceAll('"', '\\"')}"`,
	'description: ""',
	`pubDate: ${today}`,
	`category: ${category}`,
	tags.length > 0 ? `tags: [${tags.join(', ')}]` : null,
	flags.draft ? 'draft: true' : null,
	'---',
]
	.filter(Boolean)
	.join('\n');

const body = `
## 环境

\`\`\`bash
# 版本、镜像、命令，写清楚是哪一套，三个月后还能照着跑
\`\`\`

## 保护与信息

| 项 | 值 |
| --- | --- |
| 架构 |  |
| 保护 |  |

## 漏洞点

## 利用

\`\`\`python
from pwn import *
\`\`\`

## 踩到的坑

## 小结
`;

writeFileSync(file, `${front}\n${body}`, 'utf8');

const existing = readdirSync(postsDir).filter((f) => f.endsWith('.md')).length;
console.log(`已创建 src/content/blog/${slug}.md（${categories.find((c) => c.slug === category)?.name}，共 ${existing} 篇）`);
console.log('预览：http://localhost:4321/blog/posts/' + slug + '/');
