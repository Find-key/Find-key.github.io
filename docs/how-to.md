# 日常操作：写文章 / 加分类 / 加友链

改完任何东西，先跑一次：

```bash
npm run build     # 校验 frontmatter + 生成静态页
```

---

## 一、写一篇文章

### 1. 新建

```bash
npm run new -- "栈溢出的偏移是怎么算出来的" --cat pwn --tags stack,ret2text
```

参数：

| 参数 | 说明 |
| --- | --- |
| 第一个位置参数 | 标题，会写进 `title`，同时生成 slug |
| `--cat` | 分类 slug，省略时用 `CATEGORIES` 第一项 |
| `--tags` | 逗号分隔，小写英文 / 连字符 |
| `--slug` | 想指定 URL 时用（如 `--slug offset`），否则按标题生成 |
| `--draft` | 加 `draft: true`：dev 能看，线上不出现 |

生成的文件在 `src/content/blog/<slug>.md`，URL 是 `/posts/<slug>/`。

### 2. 填 frontmatter

```yaml
---
title: "栈溢出的偏移是怎么算出来的"   # 必填
description: "用 pattern 找偏移的完整流程"  # 会出现在首页列表和 SEO
pubDate: 2026-10-25                  # 必填，YYYY-MM-DD
category: pwn                        # 必填，必须是 CATEGORIES 里的 slug
tags: [stack, ret2text]              # 可选
# order: 1                           # 可选：同分类内的阅读顺序（系列文章）
# updatedDate: 2026-10-26            # 可选：改动较大时填，文章页显示"更新于"
# draft: true                        # 可选：草稿
---
```

### 3. 正文

- **从 `##` 开始写**，不要写 `#` —— 一级标题由 `title` 渲染
- **`##` / `###` 会自动进左侧目录**（滚动时高亮），所以标题写成有信息量的短语，不要写"一、二、三"
- 代码块标语言：```` ```c ```` / ```` ```python ```` / ```` ```bash ````
- 图片放 `public/images/`，正文里写 `![说明](/blog/images/xxx.png)`（含 base，markdown 里没法调 `withBase()`；将来换域名要全局替换这一处）
- 表格、引用块都直接写，样式已有

### 4. 预览与发布

```bash
npx astro dev            # http://localhost:4321/blog/ 热更新
npm run build            # 构建；frontmatter 写错会在这里报错
```

---

## 二、加一个分类

编辑 `src/consts.ts` 的 `CATEGORIES`：

```ts
export const CATEGORIES = [
	// …
	{
		slug: 'web',                 // 会进 URL：/categories/web/
		name: 'Web 安全',            // 页面上显示的名字
		description: '一句话说明这个分类收什么',  // 用于分类页
	},
] as const;
```

规则：

- `slug` 用小写英文 + 连字符（会进 URL），`name` 用中文
- 顺序就是首页分组的顺序
- **空分类**在首页显示「还没有文章」，不会生成 `/categories/<slug>/` 页面；写进第一篇后自动出现
- 文章的 `category` 必须是这里已有的 slug，否则 `npm run build` 报错并列出现有可选项
- **改完 `consts.ts` 如果页面没变化**：`npx astro dev stop` 再 `npx astro dev`（Astro 对 consts 的热更新不稳定）

---

## 三、加一个友链

编辑 `src/consts.ts` 的 `FRIENDS`：

```ts
export const FRIENDS: Friend[] = [
	{ name: '某某的博客', url: 'https://example.com', note: '一句话介绍（可省略）' },
];
```

- 渲染在 `/links`：名字（衬线）+ 域名（等宽，右对齐）+ 一句灰字说明
- 数组为空时显示空状态，不会空白页
- 站头「友链」的链接来自 `NAV`，不需要改

---

## 四、改站点信息 / 导航

全部在 `src/consts.ts`：

| 字段 | 作用 |
| --- | --- |
| `title` | 站名（浏览器标签、站头字标、分享卡） |
| `description` | SEO 描述 |
| `quote` | 首页 hero 的题记（`text` + `by`，置空则不显示） |
| `author` | 页脚与文章页署名 |
| `url` / `base` | 部署地址；项目站是 `https://<用户名>.github.io` + `/blog` |
| `github` / `email` / `qq` | 联系方式；`github` 里还有 `USERNAME` 时不渲染 |
| `NAV` | 站头右侧链接（现在是 归档 / 友链） |

---

## 五、常见报错

| 现象 | 原因 / 处理 |
| --- | --- |
| `category` 报错，列出可选项 | frontmatter 的 `category` 不在 `CATEGORIES` 里 |
| YAML 解析失败 | 值里有 `: ` 或以 `%`、`@` 开头时，整个值要用双引号包起来 |
| 首页分类是旧的 | `consts.ts` 热更新失效，重启 dev |
| 链接 404 / 变成 `/blog/blog/` | 手写了 `/blog/...`；站内路径一律用 `withBase()` / `postUrl()` |
| 文章不出现 | 看是不是 `draft: true`，或者日期在未来（未来日期不会自动隐藏，但排序会靠前） |
