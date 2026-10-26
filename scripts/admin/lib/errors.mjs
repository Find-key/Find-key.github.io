/** 带状态码的错误：server 统一转成 { error } 返回 */
export class HttpError extends Error {
	constructor(status, message) {
		super(message);
		this.status = status;
	}
}
