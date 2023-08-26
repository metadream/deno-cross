import { ConnInfo, extname, resolve, serve } from "./deps.ts";
import { Callback, EngineOptions, HttpStatus, Method, Mime } from "./defs.ts";
import { App } from "./app.ts";
import { Context } from "./context.ts";
import { Engine } from "./engine.ts";
import { Router } from "./router.ts";

/**
 * Web Application Server
 * to handle requests and static resources
 */
export class Server {

    private router = new Router();
    private engine = new Engine();

    // Create routes in shortcuts
    all(path: string, callback: Callback) {
        return this.shortcut(Method.ALL)(path, callback);
    }

    get(path: string, callback: Callback) {
        return this.shortcut(Method.GET)(path, callback);
    }

    post(path: string, callback: Callback) {
        return this.shortcut(Method.POST)(path, callback);
    }

    put(path: string, callback: Callback) {
        return this.shortcut(Method.PUT)(path, callback);
    }

    delete(path: string, callback: Callback) {
        return this.shortcut(Method.DELETE)(path, callback);
    }

    patch(path: string, callback: Callback) {
        return this.shortcut(Method.PATCH)(path, callback);
    }

    head(path: string, callback: Callback) {
        return this.shortcut(Method.HEAD)(path, callback);
    }

    options(path: string, callback: Callback) {
        return this.shortcut(Method.OPTIONS)(path, callback);
    }

    /**
     * Exports the method of requests handler
     * Used to undertake requests for third-party http server
     */
    get dispatch() {
        this.compose();
        return this.handleRequest.bind(this);
    }

    // Create static resources route
    serve(path: string) {
        this.router.add({
            method: Method.GET, path,
            callback: this.handleStatic.bind(this)
        });
        return this;
    }

    // Init engine options
    init(options: EngineOptions) {
        this.engine.init(options);
        return this;
    }

    /**
     * Create web server
     * @param port default 3000
     */
    listen(port?: number) {
        this.compose();

        if (this.router.routes.length === 0) {
            console.error(`\x1b[31m[Spring] Error: No route found\x1b[0m`);
            console.log(`[Spring] Please make sure you have imported the decorator module`);
        } else {
            port = port || 3000;
            serve(this.handleRequest.bind(this), { port });
            console.log(`\x1b[90m[Spring] ${this.version()}\x1b[0m`);
            console.log(`\x1b[90m[Spring] Repository: https://github.com/metadream/deno-spring\x1b[0m`);
            console.log(`[Spring] Server is running at \x1b[4m\x1b[36mhttp://localhost:${port}\x1b[0m`);
        }
        return this;
    }

    /**
     * Handles dynamic requests
     * @param request
     * @returns
     */
    private async handleRequest(request: Request, connInfo: ConnInfo): Promise<Response> {
        const time = Date.now();
        const ctx = new Context(request);
        ctx.remoteAddr = connInfo.remoteAddr;
        ctx.view = this.engine.view.bind(this.engine);
        ctx.render = this.engine.render.bind(this.engine);
        Object.assign(ctx, App.plugins);

        let body = null;
        try {
            const route = this.router.find(ctx.method, ctx.path)
                || this.router.find(Method.ALL, ctx.path);

            if (route) {
                ctx.params = route.params || {};
                ctx.template = route.template;
                await this.callMiddlewares(ctx);
                body = await route.callback(ctx);
                if (route.template) {
                    body = await ctx.view(route.template, body);
                }
            } else {
                ctx.throw("Route not found: " + ctx.path, HttpStatus.NOT_FOUND);
            }
        } catch (e) {
            console.error("\x1b[31m[Spring]", e, "\x1b[0m");

            if (App.errorHandler) {
                e.status = e.status || HttpStatus.INTERNAL_SERVER_ERROR;
                ctx.status = e.status || HttpStatus.INTERNAL_SERVER_ERROR;
                ctx.error = e;
                body = await App.errorHandler(ctx);
            } else {
                ctx.status = e.status || HttpStatus.INTERNAL_SERVER_ERROR;
                body = e.message || "Internal Server Error";
            }
        }
        ctx.set("x-response-time", (Date.now() - time) + "ms");
        return ctx.build(body);
    }

    /**
     * Handles static resource requests
     * @param ctx
     * @returns
     */
    private async handleStatic(ctx: Context) {
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
                ctx.throw("File not found", HttpStatus.NOT_FOUND);
            } else {
                throw e;
            }
        }
    }

    // Create shortcut methods
    private shortcut(method: string) {
        return (path: string, callback: Callback) => {
            this.router.add({ method, path, callback });
            return this;
        }
    }

    // Call middlewares by priority
    private async callMiddlewares(ctx: Context) {
        for (const middleware of App.middlewares) {
            await middleware.callback(ctx);
        }
    }

    // Compose all routes from application cache
    private compose() {
        App.compose();
        App.routes.forEach(route => this.router.add(route));
    }

    // Format versions
    private version() {
        const vers = JSON.stringify(Deno.version);
        return vers
            ? vers.replace(/(\"|{|})/g, "").replace(/(:|,)/g, "$1 ")
            : "Unable to get deno version";
    }

}