import type { AstroIntegration } from 'astro';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * KaTeX 静态资源按需输出集成：
 * - 不通过布局静态 import CSS，避免把 ~35KB 样式打包进不含公式的文章。
 * - 只保留 .woff2 字体声明与文件（剔除老旧 .woff / .ttf），显著减小构建产物。
 * - 同时支持 `astro dev` 中间件直出与 `astro build` 输出到 `dist/katex/`。
 */
export function katexAssets(): AstroIntegration {
	const katexDistDir = join(process.cwd(), 'node_modules/katex/dist');
	const katexFontsDir = join(katexDistDir, 'fonts');
	const strippedCss = readFileSync(join(katexDistDir, 'katex.min.css'), 'utf8').replace(
		/,url\(fonts\/[^)]+\.(?:woff|ttf)\) format\([^)]+\)/g,
		'',
	);

	let base = '';

	return {
		name: 'katex-assets',
		hooks: {
			'astro:config:done': ({ config }) => {
				base = (config.base ?? '').replace(/\/+$/, '');
			},
			'astro:server:setup': ({ server }) => {
				const cssRoute = `${base}/katex/katex.min.css`;
				const fontsPrefix = `${base}/katex/fonts/`;

				server.middlewares.use((req, res, next) => {
					const pathname = (req.url ?? '').split('?')[0];
					if (pathname === cssRoute) {
						res.setHeader('Content-Type', 'text/css; charset=utf-8');
						res.end(strippedCss);
						return;
					}
					if (pathname.startsWith(fontsPrefix) && pathname.endsWith('.woff2')) {
						const filename = pathname.slice(fontsPrefix.length);
						if (!filename || filename.includes('/') || filename.includes('..')) {
							next();
							return;
						}
						const fontPath = join(katexFontsDir, filename);
						if (existsSync(fontPath)) {
							res.setHeader('Content-Type', 'font/woff2');
							res.end(readFileSync(fontPath));
							return;
						}
					}
					next();
				});
			},
			'astro:build:done': ({ dir }) => {
				const outDir = fileURLToPath(dir);
				const outKatex = join(outDir, 'katex');
				const outFonts = join(outKatex, 'fonts');
				mkdirSync(outFonts, { recursive: true });
				writeFileSync(join(outKatex, 'katex.min.css'), strippedCss, 'utf8');
				for (const file of readdirSync(katexFontsDir)) {
					if (file.endsWith('.woff2')) {
						cpSync(join(katexFontsDir, file), join(outFonts, file));
					}
				}
			},
		},
	};
}
