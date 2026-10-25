import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { CATEGORIES } from './consts';

const categorySlugs = CATEGORIES.map((category) => category.slug);

// CATEGORIES 为空时（清场阶段）不限制 category，等你定义了分类再收紧
const categorySchema =
	categorySlugs.length > 0
		? z
				.string()
				.refine((value) => categorySlugs.includes(value), {
					message: `category 必须是以下之一：${categorySlugs.join(' / ')}（在 src/consts.ts 的 CATEGORIES 里定义）`,
				})
		: z.string();

const blog = defineCollection({
	// 文章放在 src/content/blog/，支持 .md 和 .mdx
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// frontmatter 的类型校验：写错字段名/类型，构建时直接报错（比运行时白屏好排查）
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			// 字符串会自动转成 Date
			pubDate: z.coerce.date(),
			updatedDate: z.coerce.date().optional(),
			// 文章所属分类：必须是 consts.ts 里 CATEGORIES 的 slug
			category: categorySchema,
			// 同一分类内想固定阅读顺序时填 order（1、2、3…），不填按时间倒序
			order: z.number().optional(),
			heroImage: image().optional(),
			// 标签：用小写英文/连字符，会生成 /tags/<tag>/ 页面
			tags: z.array(z.string()).default([]),
			// draft: true 只在本地 dev 可见，build 时不会输出
			draft: z.boolean().default(false),
		}),
});

export const collections = { blog };
