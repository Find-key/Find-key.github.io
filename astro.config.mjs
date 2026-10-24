// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

// 站点域名 / base 路径统一在 src/consts.ts 里改，这里只负责读
import { SITE } from './src/consts.ts';

// https://astro.build/config
export default defineConfig({
	// GitHub Pages 项目站：https://<user>.github.io/blog
	site: SITE.url,
	base: SITE.base,
	// 静态托管环境（GitHub Pages）对 /foo 和 /foo/ 都返回同一份 index.html
	trailingSlash: 'ignore',
	integrations: [mdx(), sitemap()],
	fonts: [
		{
			provider: fontProviders.local(),
			name: 'Atkinson',
			cssVariable: '--font-atkinson',
			fallbacks: ['sans-serif'],
			options: {
				variants: [
					{
						src: ['./src/assets/fonts/atkinson-regular.woff'],
						weight: 400,
						style: 'normal',
						display: 'swap',
					},
					{
						src: ['./src/assets/fonts/atkinson-bold.woff'],
						weight: 700,
						style: 'normal',
						display: 'swap',
					},
				],
			},
		},
	],
});
