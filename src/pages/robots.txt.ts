import { SITE } from '../consts';
import { absoluteUrl } from '../utils/url';

// 静态端点：构建时生成 dist/robots.txt
export function GET() {
	const body = `User-agent: *
Allow: /

Sitemap: ${absoluteUrl('/sitemap-index.xml')}
`;

	return new Response(body, {
		headers: { 'Content-Type': 'text/plain; charset=utf-8' },
	});
}
