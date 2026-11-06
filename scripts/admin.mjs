/**
 * 写作后台（入口占位）
 *
 * 原来的实现（本机 127.0.0.1:4322 的四视图编辑器 + 软删除回收站）已清空，
 * 保留这个入口和 `npm run admin` 的位置，以后再重写。
 *
 * 重写时的注意点：
 *   - 只监听 127.0.0.1，改的是仓库里的真实文件，没有鉴权
 *   - 分类存在 `src/consts.ts` 的 #region categories 段，写入要整段重写
 *   - frontmatter 的字段以 `src/content.config.ts` 为准
 *   - 删除类操作要可撤销（放到仓库外的 .trash/，别直接 unlink）
 */
console.log('写作后台已下线（实现已清空，入口保留）。');
console.log('现在写文章用：npm run new -- "标题" --cat pwn --tags a,b');
console.log('或者直接在 src/content/blog/ 下新建 .md，字段见 README。');
