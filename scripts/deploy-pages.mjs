/**
 * 发布到 GitHub Pages（gh-pages 分支模式）
 *
 *   npm run deploy
 *
 * 做的事：
 *   1. astro build → dist/
 *   2. 把 dist/ 复制到临时目录，加 .nojekyll
 *   3. 在临时目录里 git init + commit，强推到一个 orphan 分支 gh-pages
 *
 * 为什么用分支模式而不是 GitHub Actions：
 *   Actions 需要账号有可用的 billing 与配额；gh-pages 分支由 Pages 自己的
 *   发布通道构建，不受账号 Actions 限制影响。代价是每次要手动跑这个脚本。
 *
 * 不会动当前工作区和 main 分支的历史。
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BRANCH = 'gh-pages';

const run = (cmd, args, cwd, opts = {}) =>
	execFileSync(cmd, args, { cwd, stdio: 'inherit', ...opts });

const git = (args, cwd) => run('git', args, cwd, {});

const remote = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: ROOT, encoding: 'utf8' }).trim();
const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const subject = execFileSync('git', ['log', '-1', '--pretty=%s'], { cwd: ROOT, encoding: 'utf8' }).trim();

console.log('› 构建');
run('npx', ['astro', 'build'], ROOT);

const out = join(ROOT, 'dist');
const tmp = mkdtempSync(join(tmpdir(), 'blog-deploy-'));

try {
	console.log('› 准备发布目录');
	cpSync(out, tmp, { recursive: true });
	writeFileSync(join(tmp, '.nojekyll'), '');

	git(['init', '-q'], tmp);
	git(['checkout', '-q', '-b', BRANCH], tmp);
	git(['add', '-A'], tmp);
	git(
		['-c', 'user.name=Findkey', '-c', 'user.email=find_key@foxmail.com', 'commit', '-q', '-m', `deploy: ${sha} ${subject}`],
		tmp,
	);
	git(['remote', 'add', 'origin', remote], tmp);

	console.log(`› 推送到 ${BRANCH}`);
	git(['push', '-q', '-f', 'origin', `HEAD:refs/heads/${BRANCH}`], tmp);

	console.log(`\n完成。Pages 大约 1–2 分钟后更新。\n  https://find-key.github.io/\n`);
} finally {
	rmSync(tmp, { recursive: true, force: true });
}
