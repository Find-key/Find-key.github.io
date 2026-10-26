/**
 * 本机写作后台的入口。真正的实现在 scripts/admin/ 下：
 *
 *   lib/frontmatter.mjs   frontmatter 解析 / 生成
 *   lib/posts.mjs         文章读写、软删除、回收站
 *   lib/categories.mjs    分类读写与校验
 *   server.mjs            路由、静态文件、错误处理
 *   ui/                   页面（html / css / js 分离）
 *
 *   npm run admin   →  http://127.0.0.1:4322
 *
 * 只监听 127.0.0.1。写的是仓库里的真实文件，没有鉴权，别往外网暴露。
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './admin/server.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');

startServer({
	root: ROOT,
	uiDir: join(HERE, 'admin/ui'),
	postsDir: join(ROOT, 'src/content/blog'),
	trashDir: join(ROOT, '.trash'),
	constsPath: join(ROOT, 'src/consts.ts'),
	port: Number(process.env.ADMIN_PORT ?? 4322),
	siteDev: process.env.SITE_DEV ?? 'http://localhost:4321',
});
