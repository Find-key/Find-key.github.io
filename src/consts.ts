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
	title: 'Findkey’s Blog',
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
	/** 头像 URL（外链即可）；没有就只显示名字首字 */
	avatar?: string;
}

/**
 * 友链。/links 页面按这个数组的顺序渲染。
 * 加一条就是补一项：{ name: '站点名', url: 'https://…', note: '一句话' }
 */
export const FRIENDS: Friend[] = [
	{ name: 'Gubai', url: 'https://www.gubaiovo.com/', note: '超厉害的顾白', avatar: '/friends/gubai-s.webp' },
	{ name: 'KuLiPai', url: 'https://doc.kulipai.top/', note: '安卓大手子', avatar: '/friends/kulipai-s.webp' },
	{ name: 'Eleven.', url: 'https://imconfident11.github.io/', note: 'Make that move you\'re afraid of making.', avatar: '/friends/eleven-s.webp' },
	{ name: 'Kamiya', url: 'https://blog.kamiya.run/', note: '近在咫尺，却邈以山河', avatar: '/friends/kamiya-s.webp' },
	{ name: 'Sally', url: 'https://sally-0000.github.io/', note: '一个pwn手的blog', avatar: '/friends/sally-s.webp' },
	{ name: 'sadsnowcat', url: 'https://sadsnowcat.github.io/', note: '为了没有泪水的明天', avatar: '/friends/sadsnowcat-s.webp' },
	{ name: 'Nick', url: 'https://nickchen.top/', note: '越平静，越汹涌', avatar: '/friends/nick-s.webp' },
	{ name: 'wsh', url: 'https://wele.vercel.app/', note: 'wsh 的 web 笔记', avatar: 'https://wele.vercel.app/avatar.jpg' },
	{ name: 'yfor', url: 'https://yfor-yfor.github.io/', note: 'yfor, 为什么不是 wifi', avatar: '/friends/yfor-s.webp' },
	{ name: 'Yolo', url: 'https://docs.yo1o.top/', note: 'to be continued', avatar: '/friends/yolo-s.webp' },
	{ name: 'Y&Y', url: 'https://singlehorn.github.io/', note: '保持好奇心', avatar: '/friends/y-y-s.webp' },
	{ name: 'Lochad', url: 'https://lochad.top/', note: 'more what, more why.', avatar: '/friends/lochad-s.webp' },
	{ name: 'sysNow', url: 'https://sysnow.xyz/', note: 'to be a pwn master', avatar: '/friends/sysnow-s.webp' },
	{ name: 'Fa1lSnow', url: 'https://blog.fa1lsnow.com/', note: '林雪落的小玩意', avatar: '/friends/fa1lsnow-s.webp' },
];

/**
 * 分类体系 —— 文章按分类组织，而不是按时间堆在一条流里。
 *
 * 规则：
 * - slug 用小写英文/连字符，会进 URL（/categories/<slug>/），定了就别改
 * - 新增分类：在这里加一项，然后文章 frontmatter 的 category 填 slug
 * - 没有任何文章的分类不会显示在页面上，可以先把分类列全
 */
export interface CategoryItem {
	/** 进 URL：/categories/<slug>/，只能小写英文/数字/连字符 */
	slug: string;
	/** 页面上显示的名字 */
	name: string;
	/** 一句话说明这个分类收什么（分类页用） */
	description: string;
}

// #region categories
// 这一段由 `npm run admin` 的后台维护；手写也可以，保持格式即可
export const CATEGORIES: CategoryItem[] = [
	{ slug: 'pwn', name: 'pwn', description: '二进制本身：glibc 堆与栈、IO_FILE、ret2dl、调用链。' },
	{ slug: 'wp', name: 'WP', description: '比赛题解与复现：羊城杯、HGAME、校赛、XYCTF。' },
	{ slug: 'v8', name: 'V8', description: 'V8 引擎：环境搭建、对象内存布局、OOB 与利用。' },
	{ slug: 'iot', name: '嵌入式与 IoT', description: '路由器等设备的固件与漏洞复现。' },
	{ slug: 'tools', name: '工具与笔记', description: 'GDB 脚本、protobuf 之类的工具笔记。' },
];
// #endregion

export type Category = (typeof CATEGORIES)[number];
export type CategorySlug = Category['slug'];
