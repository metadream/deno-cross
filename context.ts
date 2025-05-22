import { type Cookie, getCookies, setCookie, deleteCookie } from "@std/http/cookie";
import { RedirectStatus, StatusCode, STATUS_CODE } from "@std/http/status";
import { Session } from "./types.ts";

/**
 * Application Context Aggregation Classes
 * Includes request, response, cookie and session.
 *
 * @Author Marco
 * @Repository https://github.com/metadream/deno-cross
 * @Since 2025-05-18
 */
export class HttpContext {

    request: HttpRequest;
    response: HttpResponse;
    cookie: HttpCookie;
    session: HttpSession;

    constructor(input: Request, info: Deno.ServeHandlerInfo) {
        this.request = new HttpRequest(input, info);
        this.response = new HttpResponse();
        this.cookie = new HttpCookie(this.request.headers, this.response.headers);
        this.session = new HttpSession(this.cookie);
    }

}

/**
 * HTTP Request Object
 * Inherit the native Request and extend some properties.
 *
 * @Author Marco
 * @Repository https://github.com/metadream/deno-cross
 * @Since 2025-05-15
 */
export class HttpRequest extends Request {

    // @example
    // ```text
    // uri.href: https://example.com:3000/users?page=1
    // uri.origin: https://example.com:3000
    // uri.protocol: https:
    // uri.host: example.com:3000
    // uri.hostname: example.com
    // uri.port: 3000
    // uri.pathname: /users
    // ```
    uri: URL;

    // The unencoded version of an encoded component of a URI
    pathname: string;

    // The search params of decoded query arguments contained in a URI.
    query: Record<string, string | number | boolean> = {};

    constructor(input: Request, info: Deno.ServeHandlerInfo) {
        super(input);
        if (this.isNetAddr(info.remoteAddr)) {
            this.headers.set("Remote-Addr", info.remoteAddr.hostname);
        }

        // Parse the request url
        this.uri = new URL(input.url);
        this.pathname = decodeURIComponent(this.uri.pathname);
        // Parse the query string
        for (const [k, v] of this.uri.searchParams) {
            this.query[k] = v;
        }
    }

    /** Determines whether the address is a network address */
    private isNetAddr(addr: Deno.Addr): addr is Deno.NetAddr {
        return "hostname" in addr && "port" in addr;
    }

}

/**
 * HTTP Response Object
 * Since the native response cannot be changed if it's created, inherit ResponseInit
 * for route method updating and finally output all at once.
 *
 * @Author Marco
 * @Repository https://github.com/metadream/deno-cross
 * @Since 2025-05-15
 */
export class HttpResponse implements ResponseInit {

    headers: Headers = new Headers();
    status: StatusCode = STATUS_CODE.OK;
    statusText?: string;
    body?: BodyInit | Response | null | undefined;

    /** Forced redirection (supported status code: 301 | 302 | 303 | 307 | 308) */
    redirect(status: RedirectStatus | string, url?: string): void {
        if (typeof status === "number") {
            this.status = status;
            if (!url) throw new HttpError(STATUS_CODE.NotAcceptable, "URL must be provided for redirect");
        } else {
            this.status = STATUS_CODE.TemporaryRedirect;
            url = status;
        }
        this.headers.set("Location", url);
    }

    /** Build a native response */
    build(): Response {
        let { body } = this;
        // If the response body is null or the status code represents an empty value
        if (body === undefined || body === null || this.isEmptyStatus()) {
            return new Response(null, this);
        }
        // If the response body is a native response instance
        if (body instanceof Response) {
            return this.isEmptyStatus() ? new Response(null, body) : body;
        }
        // If no content type is set and the response body is an plain object,
        // output in JSON format
        if (!this.headers.has("Content-Type") && this.isPlainObject()) {
            this.headers.set("Content-Type", "application/json; charset=utf-8")
            body = JSON.stringify(body);
        }
        // Build a native response
        return new Response(body, this);
    }

    /** Determine whether the status represents an empty value */
    isEmptyStatus(): boolean {
        return this.status === STATUS_CODE.NoContent || this.status === STATUS_CODE.NotModified;
    }

    /** Determines whether the response body is a plain object */
    isPlainObject(): boolean {
        const b = this.body;
        return !(
            b instanceof Blob || b instanceof FormData || b instanceof Uint8Array ||
            b instanceof ReadableStream || b instanceof URLSearchParams
        );
    }

}

/**
 * Http Cookie Object
 * A simple wrapper for standard cookies
 *
 * @Author Marco
 * @Repository https://github.com/metadream/deno-cross
 * @Since 2025-05-15
 */
export class HttpCookie {
    private reqHeaders!: Headers;
    private resHeaders!: Headers;

    constructor(reqHeaders: Headers, resHeaders: Headers) {
        this.reqHeaders = reqHeaders;
        this.resHeaders = resHeaders;
    }

    /** Get cookie by name from request headers */
    get(name?: string): string | Record<string, string> {
        const cookies = getCookies(this.reqHeaders);
        return name ? cookies[name] : cookies;
    }

    /** Set cookie to response headers */
    set(name: string, value: string, options?: Cookie): void {
        const cookie = { name, value };
        Object.assign(cookie, options);
        setCookie(this.resHeaders, cookie);
    }

    /** Delete cookie by name in the response headers */
    delete(name: string, attributes?: { path?: string; domain?: string }): void {
        deleteCookie(this.resHeaders, name, attributes);
    }

}

/**
 * Http Session Object
 * Using cookies and memory storage to create sessions
 *
 * @Author Marco
 * @Repository https://github.com/metadream/deno-cross
 * @Since 2025-05-15
 */
export class HttpSession {

    private static MAX_AGE = 3600; // seconds (default expired in 1 hour)
    private static SESS_KEY = "SESSION_ID";
    private static SESS_STORE = new Map<string, Session>();

    private cookie: HttpCookie;
    private readonly id: string;

    /** Automatically clean up expired sessions */
    static {
        setInterval(() => {
            const now = Date.now();
            for (const [id, session] of HttpSession.SESS_STORE.entries()) {
                if (session.expires < now) {
                    HttpSession.SESS_STORE.delete(id);
                }
            }
        }, 1000);
    }

    constructor(cookie: HttpCookie) {
        this.cookie = cookie;
        this.id = cookie.get(HttpSession.SESS_KEY) as string || crypto.randomUUID();
        const expires = Date.now() + HttpSession.MAX_AGE * 1000;

        // Create a new session if it does not exist
        let session = HttpSession.SESS_STORE.get(this.id);
        if (!session) {
            session = { data: {}, expires };
            HttpSession.SESS_STORE.set(this.id, session);
            cookie.set(HttpSession.SESS_KEY, this.id);
        }
        // Refresh the active time
        session.expires = expires;
    }

    get<T>(key: string): T | undefined {
        const session = HttpSession.SESS_STORE.get(this.id);
        return session?.data[key] as T;
    }

    set(key: string, value: unknown): void {
        const session = HttpSession.SESS_STORE.get(this.id);
        if (session) {
            session.data[key] = value;
            session.expires = Date.now() + HttpSession.MAX_AGE * 1000;
        }
    }

    delete(key: string): void {
        const session = HttpSession.SESS_STORE.get(this.id);
        if (session) {
            delete session.data[key];
        }
    }

    destroy(): void {
        HttpSession.SESS_STORE.delete(this.id);
        this.cookie.delete(HttpSession.SESS_KEY);
    }

}

/**
 * HTTP Error Object (extended status code attribute)
 *
 * @Author Marco
 * @Repository https://github.com/metadream/deno-cross
 * @Since 2025-05-15
 */
export class HttpError extends Error {
    status: StatusCode;

    constructor(status: StatusCode | string, message: string = "Internal Server Error") {
        super(message);

        if (typeof status === "number") {
            this.status = status;
        } else {
            this.status = STATUS_CODE.InternalServerError;
            this.message = status;
        }
    }

    /** JSON.stringify() will automatically call this method for serialization. */
    toJSON(): {} {
        return { status: this.status, message: this.message };
    }

}