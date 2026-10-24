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
	/** 站点标题（浏览器标签、页头、RSS 标题） */
	title: 'Findkey 的博客',
	/** 一句话简介，用于 SEO description、RSS 描述 */
	description: '嵌入式 Linux、QEMU 试验与工程笔记。',
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

/** 导航栏。href 写站点内相对路径，渲染时会自动拼上 base 路径 */
export const NAV = [
	{ href: '/', label: '首页' },
	{ href: '/posts', label: '文章' },
	{ href: '/tags', label: '标签' },
	{ href: '/about', label: '关于' },
] as const;
