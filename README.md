# Findkey

个人技术博客，Astro + GitHub Pages，纯静态。文章按**分类**组织，简约排版优先。

- **完整文档（结构、命令、写作规范、视觉规范、踩坑记录、变更日志）：[`PROJECT.md`](./PROJECT.md)**
- 线上地址：`https://find-key.github.io/`

```bash
npm install
npm run dev      # http://localhost:4321/
npm run build    # 输出 dist/
npm run preview  # 本地预览生产构建
```

写文章：`cp docs/post-template.md src/content/blog/新文章名.md`，frontmatter 里 **`category` 必填**（取值见 `src/consts.ts` 的 `CATEGORIES`）。
也可以开本机写作后台：`npm run admin` → http://127.0.0.1:4322/

> 改任何东西之后，记得在 `PROJECT.md` 的「变更日志」里加一条。

## 日常操作

写文章、加分类、加友链、改站点信息：见 [`docs/how-to.md`](docs/how-to.md)。

项目结构、设计决策、踩坑记录：见 [`PROJECT.md`](PROJECT.md)。

---

# 部署到 GitHub Pages

站点是 GitHub **用户站**（不是项目站），所以仓库名必须是 `<用户名>.github.io`，站点直接在根路径 `https://<用户名>.github.io/` 上，`base` 为空。

当前配置（`src/consts.ts`）：

```ts
url:  'https://find-key.github.io',
base: '',        // 用户站在根路径；若改回项目站（/blog 之类）这里要跟着填
github: 'https://github.com/Find-key',
```

推送分支 **`main`** 会触发 `.github/workflows/deploy.yml`：`withastro/action` 构建 → `actions/deploy-pages` 发布。

## 一、首次部署

### 1. 建仓库

打开 https://github.com/new

| 项目 | 值 |
| --- | --- |
| Repository name | `Find-key.github.io`（**必须**是「用户名 + .github.io」） |
| 可见性 | Public 或 Private 都行（私有仓库开 Pages 需要 Pro 以上） |
| README / .gitignore / license | **三个都不勾**（勾了会多一次合并冲突） |

### 2. 关联远端并推送

```bash
cd ~/Work/blog
git remote add origin git@github.com:Find-key/Find-key.github.io.git
git branch -M main
git push -u origin main
```

SSH 推送不需要代理；如果还没配密钥：

```bash
ssh-keygen -t ed25519 -C "findkey"
cat ~/.ssh/id_ed25519.pub        # 贴到 GitHub → Settings → SSH and GPG keys → New SSH key
ssh -T git@github.com             # 看到 "Hi Find-key!" 就通了
```

### 3. 打开 Pages

仓库 → **Settings** → 左侧 **Pages** → **Build and deployment** → **Source** 选 **GitHub Actions**。

> 选错成 "Deploy from a branch" 会出事：仓库里存的是 **Astro 源码**，不是构建好的 HTML，Pages 会把 `src/`、`package.json` 当静态文件发出去，站点直接 404。必须是 GitHub Actions。

### 4. 等构建

仓库 **Actions** 标签 → 名为 `Deploy to GitHub Pages` 的 workflow：build 约 40 秒，deploy 十几秒。绿勾后访问：

```
https://find-key.github.io/
```

首次生效可能要 1–2 分钟（CDN 与 DNS）。

## 二、日常更新

改完 → 提交 → 推送，三步：

```bash
cd ~/Work/blog
git status                     # 先看改了什么，避免带上无关文件
git add -A
git commit -m "说明这次改了什么"
git push                       # 触发 Actions，1–2 分钟后线上生效
```

用写作后台（`npm run admin`）时要注意：**后台保存只等于改磁盘文件，不等于上传**。流程是「后台写完保存 → 终端 `git add -A && git commit && git push`」。

常用检查：

```bash
git log --oneline origin/main..HEAD   # 本地还没推的提交（空 = 全推了）
git diff                              # 具体改了哪些行
npm run build                         # 推之前本地先确认构建能过
```

## 三、验证线上

```bash
# 首页是否是新版本（看 last-modified 时间）
curl -sI https://find-key.github.io/ | grep -i last-modified

# 关键路径都应在 200
for u in / /posts/ /links/ /categories/pwn/; do
  printf '%-22s ' "$u"; curl -s -o /dev/null -w '%{http_code}\n' "https://find-key.github.io$u"
done
```

## 四、回滚与备份

- **回滚线上内容**：`git revert <提交号>` 再 `git push`（比 force push 安全，历史保留）
- **旧 Hexo 站**：完整历史在 `legacy-hexo` 分支上，需要时 `git checkout legacy-hexo` 看一眼
- **Pages 历史**：仓库 Actions 里每次部署都有记录，可下载当时的产物

## 五、踩过的坑

| 现象 | 原因 / 处理 |
| --- | --- |
| 站点 404 或直接暴露源码 | Pages Source 还是 "Deploy from a branch"，改成 **GitHub Actions** |
| 推送被拒（`non-fast-forward`） | 远端已有别的历史。先 `git fetch origin main`，确认后再决定合并还是覆盖 |
| 推上去但线上没变 | Actions 还没跑完；去 Actions 看状态，或等 1–2 分钟 |
| 图片/字体 404 | `public/` 下的文件随构建进 `dist/`，路径按根写（如 `/kirito.webp`），不要写 `/blog/...` |
| favicon 不更新 | 浏览器缓存，`Ctrl+Shift+R` 或新开标签页 |
| 改了 `base` 之后全站 404 | 站内链接必须走 `withBase()` / `postUrl()` / `categoryUrl()`，别手写绝对路径 |
| 换仓库名（如改成 `notes`） | 站点会变成项目站 `/notes/`，`src/consts.ts` 的 `base` 必须同步改成 `'/notes'` |
