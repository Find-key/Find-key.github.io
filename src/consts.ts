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
	/** 浏览器标签页 / SEO 用（短，标签栏里认得出就行） */
	title: '0xFindkey',
	/** 站头字标（左上那个），可以比 title 长 */
	wordmark: 'Findkey’s Blog',
	/** 一句话简介，用于 SEO description、RSS 描述 */
	description: '二进制漏洞分析与利用（pwn）',
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
	/** QQ 号（纯展示，不生成链接）；留空则不显示 */
	qq: '',
} as const;

/**
 * 站头右侧的固定链接（顺序即显示顺序）。
 * 首页已经是分类目录，所以「分类」不再放站头，改放版权页。
 */
export const NAV = [
	{ href: '/posts', label: '归档' },
	{ href: '/links', label: '友链' },
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
		description: '二进制漏洞与利用：栈、堆、保护绕过、利用链。',
	},
	{
		slug: 'endpoint',
		name: '终端安全',
		description: '终端上的攻与防：进程、持久化、取证式排查。',
	},
	{
		slug: 'av',
		name: '反病毒',
		description: '特征码、启发式、行为检测，以及绕过它们的思路。',
	},
	{
		slug: 'kernel',
		name: '内核与嵌入式',
		description: '内核、启动流程、设备树、Buildroot 与 QEMU。',
	},
	{
		slug: 'meta',
		name: '站务',
		description: '这个站怎么搭的，以及一些零散的记录。',
	},
] as const;

export type Category = (typeof CATEGORIES)[number];
export type CategorySlug = Category['slug'];
