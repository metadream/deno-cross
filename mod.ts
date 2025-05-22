import { STATUS_CODE } from "@std/http/status";
import { contentType } from "@std/media-types";
import { resolve, normalize, extname } from "@std/path";
import { parse as parseYaml } from "@std/yaml";
import { Config, Constructor, BaseRoute, DynamicRoute, ErrorRoute, InterceptorRoute, RouteHandler } from "./types.ts";
import { HttpContext, HttpCookie, HttpError, HttpRequest, HttpResponse, HttpSession } from "./context.ts";
import { Router } from "./router.ts";
import { Engine } from "./engine.ts";

/**
 * Cross Framework Application
 *
 * @Author Marco
 * @Repository https://github.com/metadream/deno-cross
 * @Since 2025-05-12
 */
export class Application {

    router: Router = new Router();
    engine: Engine = new Engine();
    interceptors: InterceptorRoute[] = [];
    errorRoute?: ErrorRoute;

    private serveOptions = {
        hostname: "0.0.0.0",
        port: 3000
    }
    private resourceOptions = {
        fsPath: null as string | null,
        fsRoot: null as string | null
    }

    /** Start the built-in Deno web server. */
    run(hostOrPort?: string | number, port?: number): void {
        // Start parameters override.
        const options = {
            hostname: typeof hostOrPort === "string" ? hostOrPort : this.serveOptions.hostname,
            port: typeof hostOrPort === "number" ? hostOrPort : (port ?? this.serveOptions.port),
            onListen: this.onListen.bind(this)
        };
        // Handle static resources and route requests.
        Deno.serve(options, (req: Request, info: Deno.ServeHandlerInfo) => {
            const ctx = new HttpContext(req, info);
            return this.isResourceRequest(ctx.request.pathname)
                ? this.handleResource(ctx.request) : this.handleRequest(ctx);
        });
    }

    get(path: string, handler: Function) {
        this.addSimpleRoute("GET", path, handler);
    }

    post(path: string, handler: Function) {
        this.addSimpleRoute("POST", path, handler);
    }

    put(path: string, handler: Function) {
        this.addSimpleRoute("PUT", path, handler);
    }

    delete(path: string, handler: Function) {
        this.addSimpleRoute("DELETE", path, handler);
    }

    patch(path: string, handler: Function) {
        this.addSimpleRoute("PATCH", path, handler);
    }

    head(path: string, handler: Function) {
        this.addSimpleRoute("HEAD", path, handler);
    }

    options(path: string, handler: Function) {
        this.addSimpleRoute("OPTIONS", path, handler);
    }

    /** Load configuration file as injectable component. */
    config(path: string) {
        const content = Deno.readTextFileSync(resolve(path));
        const data: any = parseYaml(content);

        // Dynamically add all configuration properties.
        const config = Registry.register(Config);
        for (const [key, value] of Object.entries(data)) {
            // Convert property key from snake_case to camelCase.
            const camelCaseKey = key.replace(/(_\w)/g, (match) => match[1].toUpperCase())
            config[camelCaseKey] = value;
        }
    }

    /** Set the template root directory and global properties available in templates. */
    templates(basePath: string, attributes?: any) {
        this.engine.init(basePath);
        this.engine.import(attributes);
    }

    /** Set static resource route and real directory. */
    resources(fsPath: string, fsRoot: string) {
        this.resourceOptions.fsPath = fsPath.endsWith("/") ? fsPath : fsPath + "/";
        this.resourceOptions.fsRoot = normalize(fsRoot);
    }

    /** Quickly add simple route */
    private addSimpleRoute(method: string, path: string, handler: Function) {
        this.router.add({
            method, path,
            handler: handler as RouteHandler,
            parameters: [{
                index: 0, name: "_", // Ignores name
                type: HttpContext
            }]
        });
    }

    /** Handle dynamic route requests. */
    private async handleRequest(ctx: HttpContext): Promise<Response> {
        const { request, response } = ctx;
        const { method, pathname } = request;

        try {
            // Find route by request method and pathname.
            const route = this.router.find(method, pathname);
            if (!route) {
                throw new HttpError(STATUS_CODE.NotFound, "Route not found: " + pathname);
            }

            // Set response header in advance for subsequent routes to access.
            if (route.template) {
                response.headers.set("Content-Type", "text/html; charset=utf-8");
            }

            // Inject interceptor actual parameters and execute.
            // Interceptors have no return value - throwing an error means preventing further execution.
            for (const interceptor of this.interceptors) {
                const args = await this.injectArguments(ctx, interceptor);
                await interceptor.handler(...args);
            }

            // Inject actual parameters into controller route method and obtain execution results.
            const args = await this.injectArguments(ctx, route);
            response.body = await route.handler(...args);

            // If a template decorator exists, render the template file with the returned data.
            if (route.template) {
                response.body = await this.engine.view(route.template, response.body);
            }
        } catch (_err: any) {
            console.error("\x1b[31m[CROSS ERROR]\x1b[0m", _err);
            const err = this.buildHttpError(_err);
            response.status = err.status;

            // Check if a custom unified error handling method exists.
            if (this.errorRoute) {
                const contentType = response.headers.get("Content-Type");
                const args = await this.injectArguments(ctx, this.errorRoute, err);
                response.body = await this.errorRoute.handler(...args);

                // If the response type is 'text/html' and the error route has a template file,
                // render the specified error message template.
                if (this.errorRoute.template && contentType?.includes("text/html")) {
                    response.body = await this.engine.view(this.errorRoute.template, response.body);
                }
            } else {
                response.body = JSON.stringify(err);
            }
        }

        // Unified output response body.
        return response.build();
    }

    /** Handle static resource requests */
    private async handleResource(request: HttpRequest): Promise<Response> {
        const { pathname } = request;
        const { fsPath, fsRoot } = this.resourceOptions;
        const filePath = resolve(fsRoot!, pathname.slice(fsPath!.length));
        const threshold = 500 * 1024; // File size threshold: 500KB.

        try {
            const stat = await Deno.stat(filePath);
            if (!stat.isFile) {
                return new Response("Resource is not a file", { status: STATUS_CODE.BadRequest });
            }

            const lastModified = stat.mtime;
            const ifModifiedSince = request.headers.get("If-Modified-Since");
            const headers = new Headers();

            // Handle conditional caching (304 status).
            if (lastModified && ifModifiedSince) {
                const ifModifiedSinceTime = new Date(ifModifiedSince);
                if (lastModified.getTime() <= ifModifiedSinceTime.getTime()) {
                    return new Response(null, { status: STATUS_CODE.NotModified });
                }
                headers.set("Last-Modified", lastModified.toUTCString());
            }

            // Set Content-Type response header.
            const mimeType = contentType(extname(filePath)) || "application/octet-stream";
            headers.set("Content-Type", mimeType);

            // Choose different file reading methods based on file size:
            // read small files directly, and stream large files for output.
            if (stat.size <= threshold) {
                const data = await Deno.readFile(filePath);
                return new Response(data, { headers });
            } else {
                const file = await Deno.open(filePath, { read: true });
                return new Response(file.readable, { headers });
            }
        } catch (err: any) {
            if (err instanceof Deno.errors.NotFound) {
                return new Response("Resource Not Found: " + pathname, {
                    status: STATUS_CODE.NotFound
                });
            }
            console.error(err);
            return new Response("Internal Server Error: " + err.message, {
                status: STATUS_CODE.InternalServerError
            });
        }
    }

    /** Inject real arguments into route callback method. */
    private async injectArguments(context: HttpContext, route: BaseRoute, error?: HttpError): Promise<any[]> {
        const { request, response, cookie, session } = context;
        request.params = (route as DynamicRoute).params || {};
        const args: any[] = [];

        for (const arg of route.parameters || []) {
            const { index, type, name } = arg;

            switch (arg.decorator) {
                case "Param":
                    // @Param Retrieve argument from the route path.
                    args[index] = request.params[name];
                    break;
                case "Query":
                    // @Query If the type is an object, pass the query object;
                    // otherwise pass the specific property value.
                    args[index] = type === Object ? request.query : request.query[name];
                    break;
                case "Body":
                    // @Body Pass the JSON object from the request body.
                    args[index] = await request.json();
                    break;
                default:
                    // For other cases without decorators, automatically inject based on parameter types.
                    // @formatter:off
                    switch (type) {
                        case Engine:        args[index] = this.engine;  break;
                        case HttpContext:   args[index] = context;      break;
                        case HttpRequest:   args[index] = request;      break;
                        case HttpResponse:  args[index] = response;     break;
                        case HttpCookie:    args[index] = cookie;       break;
                        case HttpSession:   args[index] = session;      break;
                        case HttpError:     args[index] = error;        break;
                        default:            args[index] = undefined;    break;
                    }
                    // @formatter:on
            }
        }
        return args;
    }

    /** Determine if it is a static resource request. */
    private isResourceRequest(pathname: string) {
        const { fsPath } = this.resourceOptions;
        return fsPath && pathname.startsWith(fsPath);
    }

    /** Build HTTP error */
    private buildHttpError(err: any): HttpError {
        if (err instanceof HttpError) {
            return err;
        }
        if (err.status && err.message) {
            return new HttpError(err.status, err.message);
        }
        const status = STATUS_CODE.InternalServerError;
        const message = err instanceof Error ? err.message : String(err);
        return new HttpError(status, message);
    }

    /** Format version information */
    private version() {
        const v = JSON.stringify(Deno.version);
        return v ? v.replace(/(\"|{|})/g, "").replace(/(:|,)/g, "$1 ") : "Unable to get deno version";
    }

    /** Listen for service startup events. */
    private onListen(localAddr: Deno.NetAddr): void {
        const { hostname, port } = localAddr;
        console.log(`\x1b[90mCross Versions: ${this.version()}\x1b[0m`);
        console.log(`\x1b[90mCross Repository: https://github.com/metadream/deno-cross\x1b[0m`);
        console.log(`\x1b[32mCross is listening on \x1b[0m\x1b[4m\x1b[36mhttp://${hostname}:${port}\x1b[0m`);
    }

}

/** Dependency injection component registry. */
export const Registry: { beans: Map<Constructor, any>, register: any, get: any } = {
    beans: new Map<Constructor, any>(),

    register(key: Constructor) {
        let singleton = this.get(key);
        if (!singleton) {
            singleton = new key();
            this.beans.set(key, singleton);
        }
        return singleton;
    },

    get(key: Constructor) {
        return this.beans.get(key);
    }
}