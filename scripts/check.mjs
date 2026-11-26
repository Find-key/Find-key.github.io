#!/usr/bin/env node
/**
 * 本地一键体检脚本：
 *   npm run check              # 先执行 astro build，再校验 dist/ 与源码内容
 *   npm run check -- --no-build
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const BLOG = join(ROOT, 'src/content/blog');
const noBuild = process.argv.includes('--no-build');

if (!noBuild) {
	console.log('› 构建站点');
	execFileSync('npx', ['astro', 'build'], { cwd: ROOT, stdio: 'inherit' });
}

if (!existsSync(DIST)) {
	console.error('错误：dist/ 不存在，请先运行 npm run build');
	process.exit(1);
}

const consts = readFileSync(join(ROOT, 'src/consts.ts'), 'utf8');
const base = (consts.match(/\bbase:\s*'([^']*)'/)?.[1] ?? '').replace(/\/+$/, '');

function walk(dir) {
	const out = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walk(full));
		else out.push(full);
	}
	return out;
}

const errors = [];
const warnings = [];

// 1. 校验关键产物文件
for (const required of ['rss.xml', 'sitemap-index.xml', 'robots.txt', 'og.png']) {
	if (!existsSync(join(DIST, required))) {
		errors.push(`缺少构建产物：dist/${required}`);
	}
}

// 2. 校验 dist/ HTML 页面
const allDist = walk(DIST);
const htmlFiles = allDist.filter((f) => f.endsWith('.html'));

for (const hf of htmlFiles) {
	const relPage = hf.slice(DIST.length);
	const html = readFileSync(hf, 'utf8');

	const h1Count = (html.match(/<h1[\s>]/g) || []).length;
	if (h1Count !== 1) {
		errors.push(`${relPage}: 期望 1 个 <h1>，实际 ${h1Count} 个`);
	}

	const ids = new Map();
	for (const m of html.matchAll(/\bid="([^"]+)"/g)) {
		ids.set(m[1], (ids.get(m[1]) || 0) + 1);
	}
	for (const [id, count] of ids) {
		if (count > 1) errors.push(`${relPage}: 重复 HTML id="${id}" (${count} 次)`);
	}

	for (const m of html.matchAll(/\b(href|src)="([^"]+)"/g)) {
		const attr = m[1];
		const val = m[2];
		if (/^(https?:|mailto:|#)/.test(val)) {
			if (attr === 'src' && /^https?:/.test(val)) {
				errors.push(`${relPage}: 存在外部图片/资源 src="${val}"`);
			}
			continue;
		}

		if (base && (val === `${base}${base}` || val.startsWith(`${base}${base}/`))) {
			errors.push(`${relPage}: 链接存在重复 base 前缀 "${val}"`);
		} else if (!base && (val === '/blog' || val.startsWith('/blog/'))) {
			errors.push(`${relPage}: 链接残留旧 /blog/ 前缀 "${val}"`);
		}

		let clean = val.split('#')[0].split('?')[0];
		if (!clean) continue;
		if (base && clean.startsWith(`${base}/`)) {
			clean = clean.slice(base.length);
		}
		const rel = clean.replace(/^\/+/, '');
		const candidates = [join(DIST, rel), join(DIST, rel, 'index.html')];
		if (!candidates.some((c) => existsSync(c) && statSync(c).isFile())) {
			errors.push(`${relPage}: 断链或缺失资源 ${attr}="${val}"`);
		}
	}
}

// 3. 扫描文章 Markdown 规范与敏感路径
const mdFiles = readdirSync(BLOG).filter((f) => f.endsWith('.md')).sort();
let unlabeledTotal = 0;
let uppercaseFenceTotal = 0;

for (const f of mdFiles) {
	const raw = readFileSync(join(BLOG, f), 'utf8');
	const body = (raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/)?.[1]) ?? raw;
	const lines = body.split('\n');
	let inCode = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const ln = i + 1;
		if (/\u00a0/.test(line)) {
			errors.push(`src/content/blog/${f}:${ln}: 包含 NBSP (U+00A0)`);
		}
		if (/\/home\/|\/Users\/|\/root\/|[A-Z]:\\\\/.test(line)) {
			errors.push(`src/content/blog/${f}:${ln}: 疑似包含宿主机绝对路径 -> ${line.trim().slice(0, 60)}`);
		}
		if (/^\s*```/.test(line)) {
			if (!inCode) {
				inCode = true;
				const lang = line.trim().slice(3).trim().split(/\s+/)[0] || '';
				if (!lang) unlabeledTotal++;
				else if (/[A-Z]/.test(lang)) uppercaseFenceTotal++;
			} else {
				inCode = false;
			}
		}
	}
}

if (unlabeledTotal > 0) warnings.push(`文章中尚有 ${unlabeledTotal} 处未标注语言的代码块`);
if (uppercaseFenceTotal > 0) warnings.push(`文章中尚有 ${uppercaseFenceTotal} 处含大写字母的代码块语言名`);

// 4. 统计产物体积
const sizes = { html: 0, css: 0, js: 0, fonts: 0, images: 0, other: 0 };
for (const f of allDist) {
	const sz = statSync(f).size;
	if (f.endsWith('.html')) sizes.html += sz;
	else if (f.endsWith('.css')) sizes.css += sz;
	else if (f.endsWith('.js')) sizes.js += sz;
	else if (/\.(woff2?|ttf)$/.test(f)) sizes.fonts += sz;
	else if (/\.(png|webp|svg|jpg|jpeg|ico)$/.test(f)) sizes.images += sz;
	else sizes.other += sz;
}
const totalKb = (Object.values(sizes).reduce((a, b) => a + b, 0) / 1024).toFixed(1);

console.log(
	`\n✓ 已检查 ${htmlFiles.length} 个 HTML 页面、${mdFiles.length} 篇文章，产物总计 ${totalKb} KB（HTML ${(sizes.html / 1024).toFixed(1)}K / CSS ${(sizes.css / 1024).toFixed(1)}K / JS ${(sizes.js / 1024).toFixed(1)}K / 字体 ${(sizes.fonts / 1024).toFixed(1)}K / 图片 ${(sizes.images / 1024).toFixed(1)}K）`,
);

if (warnings.length > 0) {
	console.log('\n提示（非阻断）：');
	for (const w of warnings) console.log(`  - ${w}`);
}

if (errors.length > 0) {
	console.error(`\n✗ 发现 ${errors.length} 处错误：`);
	for (const e of errors) console.error(`  - ${e}`);
	process.exit(1);
}

console.log('✓ 全部校验通过！');
