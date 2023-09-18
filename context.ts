import { Cookie, deleteCookie, getCookies, setCookie } from "./deps.ts";
import { Route } from "./types.ts";
import { Server } from "./server.ts";

/**
 * Spring Application Context
 * enhance native request and response
 * @Author metadream
 * @Since 2022-11-09
 */
export class Context {
    // Allow adding custom properties
    [index: string]: unknown;

    json: () => Promise<unknown>;
    text: () => Promise<string>;
    blob: () => Promise<Blob>;
    form: () => Promise<FormData>;
    buffer: () => Promise<ArrayBuffer>;

    addr: Deno.NetAddr;
    method: string;
    url: string;
    origin: string;
    protocol: string;
    host: string;
    hostname: string;
    port: string;
    path: string;

    query: Record<string, string | number | boolean> = {};
    params: Record<string, string | number | boolean> = {};
    serve: (ctx: Context) => Promise<ArrayBuffer | undefined>;
    render: (tmpl: string, data: unknown) => Promise<string>;
    view: (file: string, data: unknown) => Promise<string>;
    template?: string;
    isStaticPath?: boolean;

    private req: Request;
    private res: {
        headers: Headers;
        status?: number;
        statusText?: string;
    };

    // REQUEST ////////////////////////////////////////////////////////////////

    // Creates context instance for each request
    constructor(server: Server, req: Request, info: Deno.ServeHandlerInfo) {
        this.req = req;
        this.res = { headers: new Headers() };
        this.serve = server.handleResource;
        this.render = server.engine.render.bind(server.engine);
        this.view = server.engine.view.bind(server.engine);

        this.addr = info.remoteAddr;
        this.method = req.method;
        this.json = () => req.json();
        this.text = () => req.text();
        this.blob = () => req.blob();
        this.form = () => req.formData();
        this.buffer = () => req.arrayBuffer();

        const url = new URL(req.url);
        this.url = url.href; // ex. https://example.com:3000/users?page=1
        this.origin = url.origin; //ex. https://example.com:3000
        this.protocol = url.protocol; //ex. https:
        this.host = url.host; // ex. example.com:3000
        this.hostname = url.hostname; //ex. example.com
        this.port = url.port; // ex. 3000
        this.path = url.pathname; // ex. /users

        // Set query string parameters
        for (const [k, v] of url.searchParams) { // ex. ?page=1
            this.query[k] = v;
        }
    }

    set route(route: Route) {
        this.template = route.template;
        this.params = route.params || {};
    }

    has(name: string): boolean {
        return this.req.headers.has(name);
    }

    get(name: string): string | null {
        return this.req.headers.get(name);
    }

    set(name: string, value: string): void {
        this.res.headers.set(name, value);
    }

    get cookies() {
        const reqHeaders = this.req.headers;
        const resHeaders = this.res.headers;

        return {
            get(name?: string): string | Record<string, string> {
                const cookies = getCookies(reqHeaders);
                return name ? cookies[name] : cookies;
            },
            set(name: string, value: string, options?: Cookie): void {
                const cookie = { name, value };
                Object.assign(cookie, options);
                setCookie(resHeaders, cookie);
            },
            delete(name: string, attributes?: { path?: string; domain?: string }): void {
                deleteCookie(resHeaders, name, attributes);
            },
        };
    }

    // RESPONSE ///////////////////////////////////////////////////////////////

    set status(status: number) {
        this.res.status = status;
    }

    get status() {
        return this.res.status || 0;
    }

    set statusText(text: string) {
        this.res.statusText = text;
    }

    get statusText() {
        return this.res.statusText || "";
    }

    // Permanent redirect codes: 301, 308
    // Temporary redirect codes: 302，303，307 (default)
    redirect(url: string, status: 301 | 302 | 303 | 307 | 308 = 307): void {
        this.res.status = status;
        this.res.headers.set("Location", url);
    }

    // Build the response instance
    // BodyInit: Blob, BufferSource, FormData, ReadableStream, URLSearchParams, or USVString
    respond(body: BodyInit | Response | null | undefined): Response {
        if (body === undefined || body === null || this.status === 204 || this.status === 304) {
            return new Response(null, this.res);
        }

        // It's a complete native response
        if (body instanceof Response) {
            return body.status === 204 || body.status === 304 ? new Response(null, body) : body;
        }

        let contentType = null;
        if (typeof body === "string") {
            contentType = /^\s*</.test(body) ? "text/html" : "text/plain";
        } else if (
            !(body instanceof Blob) && !(body instanceof Uint8Array) &&
            !(body instanceof FormData) && !(body instanceof ReadableStream) &&
            !(body instanceof URLSearchParams)
        ) {
            contentType = "application/json";
            body = JSON.stringify(body);
        }

        if (contentType && !this.res.headers.has("content-type")) {
            this.res.headers.set("content-type", `${contentType}; charset=utf-8`);
        }
        return new Response(body, this.res);
    }
}
