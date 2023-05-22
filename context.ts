import { getCookies, setCookie, deleteCookie } from "./deps.ts";
import { CookieOptions, HttpError } from "./defs.ts";

/**
 * Spring Application Context
 * extends native request and response
 */
export class Context {

    // Allows add custom properties
    // deno-lint-ignore no-explicit-any
    [index: string]: any;

    // Native request instance
    private _request: Request;
    // Native response instance
    private _response: { headers: Headers; status?: number; statusText?: string } = { headers: new Headers() };

    private _url: URL;
    private _params: Record<string, string> = {};
    private _query: Record<string, string> = {};
    private _error?: HttpError;

    // Creates context instance for each request
    constructor(request: Request) {
        this._request = request;
        this._url = new URL(request.url);

        // Set query string parameters
        for (const [k, v] of this._url.searchParams) {
            this._query[k] = v;
        }
    }

    // REQUEST PART /////////////////////////////////////////////////

    // Set request parameters on the route path
    set params(p: Record<string, string>) {
        Object.assign(this._params, p);
    }

    // Get request parameters on the route path
    get params() {
        return this._params;
    }

    // Get querystring parameters
    get query() {
        return this._query;
    }

    // Get the full href of the request
    // ex. https://example.com:3000/users?page=1
    get url() {
        return this._url.href;
    }

    // ex. https://example.com:3000
    get origin() {
        return this._url.origin;
    }

    // ex. https:
    get protocol() {
        return this._url.protocol;
    }

    // ex. example.com:3000
    get host() {
        return this._url.host;
    }

    // ex. example.com
    get hostname() {
        return this._url.hostname;
    }

    // ex. 3000
    get port() {
        return this._url.port;
    }

    // ex. /users
    get path() {
        return this._url.pathname;
    }

    // Get request method name
    get method() {
        return this._request.method;
    }

    // The following 2 methods are used to manipulate request headers
    // Usage: ctx.has(key)
    has(name: string) {
        return this._request.headers.has(name);
    }

    get(name: string) {
        return name ? this._request.headers.get(name) : this._request.headers;
    }

    // Get parsing functions for request body
    // Usage: await ctx.body.json()
    get body() {
        if (this._request.bodyUsed) {
            this.throw("Request body already consumed");
        }
        return {
            text: () => this._request.text(),
            json: () => this._request.json(),
            blob: () => this._request.blob(),
            form: () => this._request.formData(),
            buffer: () => this._request.arrayBuffer(),
        }
    }

    // Get the native request instance
    get request() {
        return this._request;
    }

    // RESPONSE PART ////////////////////////////////////////////////

    set status(status: number) {
        this._response.status = status;
    }

    get status() {
        return this._response.status || 0;
    }

    set statusText(text: string) {
        this._response.statusText = text;
    }

    get statusText() {
        return this._response.statusText || "";
    }

    // The following 3 methods are used to manipulate response headers
    // Usage: ctx.set("content-type", "")
    set(name: string, value: string) {
        this._response.headers.set(name, value);
    }

    append(name: string, value: string) {
        this._response.headers.append(name, value);
    }

    delete(name: string) {
        this._response.headers.delete(name);
    }

    // Permanent redirect codes: 301, 308 (default)
    // Temporary redirect codes: 302，303，307
    redirect(url: string, status: 301 | 302 | 303 | 307 | 308 = 308) {
        this._response.status = status;
        this.set("Location", url);
    }

    // Build the response instance
    // BodyInit: Blob, BufferSource, FormData, ReadableStream, URLSearchParams, or USVString
    build(body: BodyInit | Response | undefined | null) {
        if (body === undefined || body === null || this.status === 204 || this.status === 304) {
            return new Response(null, this._response);
        }

        // It's a complete native response
        if (body instanceof Response) {
            return body.status === 204 || body.status === 304 ? new Response(null, body) : body;
        }

        let contentType = null;
        if (typeof body === "string") {
            contentType = /^\s*</.test(body) ? "text/html" : "text/plain";

        } else if (!(body instanceof Blob) && !(body instanceof Uint8Array)
            && !(body instanceof FormData) && !(body instanceof ReadableStream)
            && !(body instanceof URLSearchParams)) {
            contentType = "application/json";
            body = JSON.stringify(body);
        }

        if (contentType && !this.has("content-type")) {
            this.set("content-type", `${contentType}; charset=utf-8`);
        }
        return new Response(body, this._response);
    }

    // COOKIES PART /////////////////////////////////////////////////

    get cookies() {
        const reqHeaders = this._request.headers;
        const resHeaders = this._response.headers;

        return {
            get(name?: string) {
                const cookies = getCookies(reqHeaders);
                return name ? cookies[name] : cookies;
            },
            set(name: string, value: string, options?: CookieOptions) {
                const cookie = { name, value };
                Object.assign(cookie, options);
                setCookie(resHeaders, cookie);
            },
            delete(name: string, attributes?: { path?: string; domain?: string }) {
                deleteCookie(resHeaders, name, attributes);
            }
        }
    }

    // ERROR PART ///////////////////////////////////////////////////

    set error(e: HttpError | undefined) {
        this._error = e;
    }

    get error() {
        return this._error;
    }

    throw(message: string, status?: number) {
        throw new HttpError(message, status);
    }

}