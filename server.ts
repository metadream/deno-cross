import { extname, resolve } from "./deps.ts";
import { EngineOptions, HttpError, HttpStatus, Method, Mime, RouteHandler, ServerOptions } from "./types.ts";
import { Context } from "./context.ts";
import { Engine } from "./engine.ts";
import { Router } from "./router.ts";
import { container } from "./container.ts";

/**
 * Web Application Server
 * to handle requests and static resources
 */
export class Server {
    private router = new Router();
    private engine = new Engine();

    private serverOptions: ServerOptions = {
        port: 3000,
        hostname: "0.0.0.0",
        onListen: this.onListen.bind(this),
        onError: this.onError.bind(this),
    };

    private engineOptions: EngineOptions = {
        viewRoot: "",
        imports: {},
    };

    // Run web server
    run(): Server {
        container.routes.forEach((route) => this.router.add(route));
        this.engine.init(this.engineOptions);
        Deno.serve(this.serverOptions, this.handleRequest.bind(this));
        return this;
    }

    // Set listen port
    port(port: number) {
        this.serverOptions.port = port;
        return this;
    }

    // Set listen hostname
    hostname(hostname: string) {
        if (hostname) this.serverOptions.hostname = hostname;
        return this;
    }

    // Set views root of template engine
    views(viewRoot: string) {
        if (viewRoot) this.engineOptions.viewRoot = viewRoot;
        return this;
    }

    // Set imports of template engine
    imports(imports: object) {
        if (imports) this.engineOptions.imports = imports;
        return this;
    }

    // Set static resources paths
    assets(...assets: string[]) {
        for (const path of assets) {
            this.router.add({ method: Method.GET, path, handler: this.handleResource });
        }
        return this;
    }

    // Inject modules
    modules(...modules: object[]) {
        for (const module of modules) {
            container.inject(module);
        }
    }

    // Handle request
    private async handleRequest(req: Request, info: Deno.ServeHandlerInfo) {
        const ctx = new Context(req, info, this.engine);
        let body = null;

        try {
            const route = this.router.find(ctx.method, ctx.path);
            if (route) {
                ctx.route = route;

                // Run interceptors
                let intercepted = false;
                for (const interceptor of container.interceptors) {
                    intercepted = await interceptor(ctx);
                    if (intercepted) break;
                }
                // Run route handler
                if (!intercepted) {
                    body = await route.handler(ctx);
                    if (route.template) {
                        body = await ctx.view(route.template, body);
                    }
                }
            } else {
                throw new HttpError("Route not found: " + ctx.path, HttpStatus.NOT_FOUND);
            }
        } catch (err) {
            console.error("\x1b[31m[Spring]", err, "\x1b[0m");
            ctx.status = err.status || HttpStatus.INTERNAL_SERVER_ERROR;

            if (container.errorHandler) {
                body = await container.errorHandler(ctx, err);
            } else {
                body = err.message || "Internal Server Error";
            }
        }
        return ctx.respond(body);
    }

    // Handle static resource
    private async handleResource(ctx: Context): Promise<ArrayBuffer | undefined> {
        // Removes the leading slash and converts relative path to absolute path
        let file = resolve(ctx.path.replace(/^\/+/, ""));

        try {
            const stat = await Deno.stat(file);
            if (stat.isDirectory) {
                file += "/index.html";
            }
            const mime = Mime[extname(file)];
            if (mime) {
                ctx.set("Content-Type", mime);
            }
            if (!stat.mtime) {
                return await Deno.readFile(file);
            }

            // Handling 304 status with negotiation cache
            // if-modified-since and Last-Modified
            const lastModified = stat.mtime.toUTCString();
            if (ctx.get("if-modified-since") === lastModified) {
                ctx.status = 304;
                ctx.statusText = "Not Modified";
            } else {
                ctx.set("Last-Modified", lastModified);
                return await Deno.readFile(file);
            }
        } catch (e) {
            if (e instanceof Deno.errors.NotFound) {
                throw new HttpError("File not found", HttpStatus.NOT_FOUND);
            } else {
                throw e;
            }
        }
    }

    // Listen event
    private onListen(params: { hostname: string; port: number }) {
        console.log(`\x1b[90m[Spring] ${this.version()}\x1b[0m`);
        console.log(`\x1b[90m[Spring] Repository: https://github.com/metadream/deno-spring\x1b[0m`);
        console.log(`[Spring] Server is running at \x1b[4m\x1b[36mhttp://${params.hostname}:${params.port}\x1b[0m`);
    }

    // Error event
    private onError(error: unknown): Response | Promise<Response> {
        console.error("\x1b[31m[Spring]", error, "\x1b[0m");
        return new Response((error as Error).message, { status: HttpStatus.INTERNAL_SERVER_ERROR });
    }

    // Format deno version object
    private version() {
        const vers = JSON.stringify(Deno.version);
        return vers ? vers.replace(/(\"|{|})/g, "").replace(/(:|,)/g, "$1 ") : "Unable to get deno version";
    }

    // Create shortcut methods
    private shortcut(method: string) {
        return (path: string, handler: RouteHandler) => {
            this.router.add({ method, path, handler });
            return this;
        };
    }

    // Create routes in shortcuts
    get(path: string, handler: RouteHandler) {
        return this.shortcut(Method.GET)(path, handler);
    }
    post(path: string, handler: RouteHandler) {
        return this.shortcut(Method.POST)(path, handler);
    }
    put(path: string, handler: RouteHandler) {
        return this.shortcut(Method.PUT)(path, handler);
    }
    delete(path: string, handler: RouteHandler) {
        return this.shortcut(Method.DELETE)(path, handler);
    }
    patch(path: string, handler: RouteHandler) {
        return this.shortcut(Method.PATCH)(path, handler);
    }
    head(path: string, handler: RouteHandler) {
        return this.shortcut(Method.HEAD)(path, handler);
    }
    options(path: string, handler: RouteHandler) {
        return this.shortcut(Method.OPTIONS)(path, handler);
    }
}
