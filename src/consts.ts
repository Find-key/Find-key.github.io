/**
 * 站点全局配置 —— 唯一可信来源（Single Source of Truth）
 *
 * 改站点名 / 作者 / 域名 / base 路径，只需要改这个文件：
 * astro.config.mjs、Header、Footer、RSS、SEO 全部从这里读。
 *
 * ⚠️ 首次上线前必须改：url、base、github 里的 USERNAME 占位符。
 *    详见项目根目录 PROJECT.md 的「上线前检查清单」。
 */
export const SITE = {
	/** 站点名（浏览器标签、刊头、RSS 标题都用它）。只留名字，别加"的博客"这类后缀 */
	title: 'Findkey',
	/** 一句话简介，用于 SEO description、刊头下方、RSS 描述 */
	description: '嵌入式 Linux、QEMU 与工具链的实践记录',
	/** 作者名，显示在页脚和文章页 */
	author: 'Findkey',
	/** 正式域名：项目站写 https://<用户名>.github.io（不要带 /blog） */
	url: 'https://USERNAME.github.io',
	/** 站点根路径：项目站写 '/blog'；用户主页站（<用户名>.github.io）改成 '/' */
	base: '/blog',
	/** html lang 属性 */
	lang: 'zh-CN',
	/** 日期显示时区 */
	timeZone: 'Asia/Shanghai',
	/** 社交链接，改成你自己的；留空字符串则不显示该图标 */
	github: 'https://github.com/USERNAME',
	email: 'find_key@foxmail.com',
} as const;

/**
 * 目次覆盖层里的次级链接（分类本身由 CATEGORIES + 文章自动生成，不在这里）
 */
export const NAV = [
	{ href: '/posts', label: '全部文章' },
	{ href: '/tags', label: '标签' },
	{ href: '/about', label: '关于' },
] as const;

/**
 * 分类体系 —— 文章按分类组织，而不是按时间堆在一条流里。
 *
 * 规则：
 * - slug 用小写英文/连字符，会进 URL（/categories/<slug>/），定了就别改
 * - 新增分类：在这里加一项，然后文章 frontmatter 的 category 填 slug
 * - 没有任何文章的分类不会显示在页面上，可以先把分类列全
 */
export const CATEGORIES = [
	{
		slug: 'embedded',
		name: '嵌入式 Linux',
		description: '内核、启动流程、设备树、Buildroot 与 QEMU 实验记录。',
	},
	{
		slug: 'site',
		name: '建站与工具',
		description: '这个站本身是怎么搭的，以及日常开发用的工具与工作流。',
	},
	{
		slug: 'notes',
		name: '随笔',
		description: '不属于上面两类的零散记录。',
	},
] as const;

export type Category = (typeof CATEGORIES)[number];
export type CategorySlug = Category['slug'];
