// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

// 站点域名 / base 路径统一在 src/consts.ts 里改，这里只负责读
import { SITE } from './src/consts.ts';

// https://astro.build/config
export default defineConfig({
	// GitHub Pages 项目站：https://<user>.github.io/blog
	site: SITE.url,
	base: SITE.base,
	// 静态托管环境（GitHub Pages）对 /foo 和 /foo/ 都返回同一份 index.html
	trailingSlash: 'ignore',
	// 不加载 webfont：中文用系统字体栈，首屏没有字体闪烁，也少两个请求
	integrations: [mdx(), sitemap()],
	// 关掉开发工具条：它只出现在 npm run dev，容易让人以为是站点的一部分
	devToolbar: { enabled: false },
	markdown: {
		// 数学公式：$...$ 行内、$$...$$ 块级，由 KaTeX 在构建时渲染成 HTML（前端零 JS）
		remarkPlugins: [remarkMath],
		rehypePlugins: [[rehypeKatex, { throwOnError: false, strict: false }]],
		// 代码高亮用 github-light：注释对比度够（min-light 的注释是 #c2c3c7，太淡看不清）
		shikiConfig: { theme: 'github-light' },
	},
});
