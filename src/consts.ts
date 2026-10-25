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
	/** 站点名（浏览器标签、站头字标、RSS 标题都用它） */
	title: 'Findkey’s Blog',
	/** 一句话简介，用于 SEO description、RSS 描述 */
	description: '二进制漏洞分析与利用（pwn）',
	/**
	 * 首页顶部那两行自述（每项一行）。用第一人称，别写成"某某的网站"，
	 * 也别写成分类标签。想改自我介绍只动这里。
	 */
	/**
	 * hero 里的题记：引一句真话 + 出处，比自己写格言稳。
	 * 想换成别的引言，改这两行即可；不想要题记就把它设成空字符串。
	 */
	quote: {
		text: '测试能证明缺陷存在，却不能证明缺陷不存在。',
		by: 'Edsger W. Dijkstra',
	},
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
 * 站头右侧的固定链接（顺序即显示顺序）。
 * 首页已经是分类目录，所以「分类」不再放站头，改放版权页。
 */
export const NAV = [
	{ href: '/posts', label: '归档' },
	{ href: '/links', label: '友链' },
	{ href: '/about', label: '关于' },
] as const;

export interface Friend {
	/** 站点名 */
	name: string;
	/** 完整 URL（带 https://） */
	url: string;
	/** 一句话介绍，显示在名字下面 */
	note?: string;
}

/**
 * 友链。/links 页面按这个数组的顺序渲染。
 * 加一条就是补一项：{ name: '站点名', url: 'https://…', note: '一句话' }
 */
export const FRIENDS: Friend[] = [];

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
		slug: 'pwn',
		name: 'pwn',
		description: '二进制漏洞与利用：栈/堆题、保护绕过、利用链，以及调试过程中的发现。',
	},
	{
		slug: 'kernel',
		name: '内核与嵌入式',
		description: '内核、启动流程、设备树、Buildroot 与 QEMU 里的实验。',
	},
	{
		slug: 'meta',
		name: '站务与工具',
		description: '这个站是怎么搭的，以及日常用的工具和工作流。',
	},
	{
		slug: 'notes',
		name: '随笔',
		description: '不属于上面几类的零散记录。',
	},
] as const;

export type Category = (typeof CATEGORIES)[number];
export type CategorySlug = Category['slug'];
