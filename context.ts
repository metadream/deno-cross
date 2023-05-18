import { getCookies, setCookie, deleteCookie } from "./deps.ts";
import { CookieOptions, HttpError } from "./defs.ts";

/**
 * Web Application Context
 * extends native request and response
 */
export class Context {

    // Custom properties
    // deno-lint-ignore no-explicit-any
    [index: string]: any;

    #request: Request;
    #response: { headers: Headers; status?: number; statusText?: string }
        = { headers: new Headers() };

    #url: URL;
    #params: Record<string, string> = {};
    #query: Record<string, string> = {};
    #error?: HttpError;

    // Creates new context for each request
    constructor(request: Request) {
        this.#request = request;
        this.#url = new URL(request.url);

        // Set query string parameters
        for (const [k, v] of this.#url.searchParams) {
            this.#query[k] = v;
        }
    }

    // REQUEST PART /////////////////////////////////////////////////

    // Set request parameters on the route path
    set params(p: Record<string, string>) {
        Object.assign(this.#params, p);
    }

    // Get request parameters on the route path
    get params() {
        return this.#params;
    }

    // Get querystring parameters
    get query() {
        return this.#query;
    }

    // Get the full href of the request
    // ex. https://example.com:3000/users?page=1
    get url() {
        return this.#request.url; // the same as this.#url.href
    }

    // ex. https://example.com:3000
    get origin() {
        return this.#url.origin;
    }

    // ex. https:
    get protocol() {
        return this.#url.protocol;
    }

    // ex. example.com:3000
    get host() {
        return this.#url.host;
    }

    // ex. example.com
    get hostname() {
        return this.#url.hostname;
    }

    // ex. 3000
    get port() {
        return this.#url.port;
    }

    // ex. /users
    get path() {
        return this.#url.pathname;
    }

    // Get request method name
    get method() {
        return this.#request.method;
    }

    // Get request headers.
    // Usage: ctx.headers.get(key)
    get headers() {
        return this.#request.headers;
    }

    // Get parsing functions for request body
    // Usage: await ctx.body.json()
    get body() {
        const req = this.#request;
        if (req.bodyUsed) {
            this.throw("Request body already consumed");
        }
        return {
            text: () => req.text(),
            json: () => req.json(),
            blob: () => req.blob(),
            form: () => req.formData(),
            buffer: () => req.arrayBuffer(),
        }
    }

    // Get the native request instance
    get request() {
        return this.#request;
    }

    // RESPONSE PART ////////////////////////////////////////////////

    set status(status: number) {
        this.#response.status = status;
    }

    get status() {
        return this.#response.status || 0;
    }

    set statusText(statusText: string) {
        this.#response.statusText = statusText;
    }

    get statusText() {
        return this.#response.statusText || "";
    }

    // The following 5 methods are used to manipulate response headers
    // Usage: ctx.has("content-type")
    has(name: string) {
        return this.#response.headers.has(name);
    }

    get(name: string) {
        return name ? this.#response.headers.get(name) : this.#response.headers;
    }

    set(name: string, value: string) {
        this.#response.headers.set(name, value);
    }

    append(name: string, value: string) {
        this.#response.headers.append(name, value);
    }

    delete(name: string) {
        this.#response.headers.delete(name);
    }

    // Permanent redirect codes: 301, 308 (default)
    // Temporary redirect codes: 302，303，307
    redirect(url: string, status: 301 | 302 | 303 | 307 | 308 = 308) {
        this.#response.status = status;
        this.set("Location", url);
    }

    // Build the response instance
    // BodyInit: Blob, BufferSource, FormData, ReadableStream, URLSearchParams, or USVString
    build(body: BodyInit | Response | undefined | null) {
        if (body === undefined || body === null ||
            this.status === 204 || this.status === 304) {
            return new Response(null, this.#response);
        }

        // It's a complete native response
        if (body instanceof Response) {
            return body.status === 204 || body.status === 304
                ? new Response(null, body) : body;
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
        return new Response(body, this.#response);
    }

    // COMMON PART //////////////////////////////////////////////////

    // Operate cookies. Usage: ctx.cookies.get(name)
    get cookies() {
        const reqHeaders = this.#request.headers;
        const resHeaders = this.#response.headers;

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

    set error(e: HttpError | undefined) {
        this.#error = e;
    }

    get error() {
        return this.#error;
    }

    throw(message: string, status?: number) {
        throw new HttpError(message, status);
    }

}