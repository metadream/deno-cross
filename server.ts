import { extname, resolve } from "./deps.ts";
import { HttpError, HttpStatus, Method, Mime, RouteHandler } from "./types.ts";
import { Context } from "./context.ts";
import { Engine } from "./engine.ts";
import { Router } from "./router.ts";
import { container } from "./container.ts";

/**
 * Web application server
 * to handle requests and static resources
 */
export class Server {
    engine = new Engine();

    private router = new Router();
    private opts: Deno.ServeOptions = {
        hostname: "0.0.0.0",
        port: 3000,
        onListen: this.onListen.bind(this),
        onError: this.onError.bind(this),
    };

    // Run web server
    run(): Server {
        this.engine.import(container.attributes);
        container.routes.forEach((route) => this.router.add(route));
        Deno.serve(this.opts, this.handleRequest.bind(this));
        return this;
    }

    // Set listen hostname
    hostname(hostname: string): Server {
        this.opts.hostname = hostname;
        return this;
    }

    // Set listen port
    port(port: number): Server {
        this.opts.port = port;
        return this;
    }

    // Set root directory of template files
    views(tmplRoot: string): Server {
        this.engine.init(tmplRoot);
        return this;
    }

    // Set paths of static resources
    assets(...assets: string[]): Server {
        for (const path of assets) {
            this.router.add({ method: Method.GET, path, handler: this.handleResource });
        }
        return this;
    }

    // Inject application modules
    modules(...modules: object[]): Server {
        for (const module of modules) {
            container.inject(module);
        }
        return this;
    }

    // Handle static resources
    async handleResource(ctx: Context): Promise<ArrayBuffer | undefined> {
        // Removes the leading slash and converts relative path to absolute path
        let file = resolve(ctx.path.replace(/^\/+/, ""));

        try {
            // If it is a directory, return the index.html file
            const stat = await Deno.stat(file);
            if (stat.isDirectory) {
                file += "/index.html";
            }

            // Set content-type based on file type
            const mime = Mime[extname(file)];
            if (mime) {
                ctx.set("Content-Type", mime);
            }

            // Handling 304 status with negotiation cache
            // if-modified-since and Last-Modified
            if (stat.mtime) {
                const lastModified = stat.mtime.toUTCString();
                if (ctx.get("if-modified-since") === lastModified) {
                    ctx.status = 304;
                    ctx.statusText = "Not Modified";
                    return;
                }
                ctx.set("Last-Modified", lastModified);
            }
            return await Deno.readFile(file);
        } catch (e) {
            if (e instanceof Deno.errors.NotFound) {
                throw new HttpError("File not found: " + ctx.path, HttpStatus.NOT_FOUND);
            } else {
                throw e;
            }
        }
    }

    // Handle requests
    private async handleRequest(req: Request, info: Deno.ServeHandlerInfo): Promise<Response> {
        const ctx = new Context(this, req, info);
        let body = null;

        try {
            const route = this.router.find(ctx.method, ctx.path);
            if (!route) {
                throw new HttpError("Route not found: " + ctx.path, HttpStatus.NOT_FOUND);
            }

            // Set template and params
            ctx.route = route;
            // Set the path is static or not
            if (route.handler === this.handleResource) {
                ctx.isStaticPath = true;
            }

            // Execute methods of interceptors
            let intercepted = false;
            for (const interceptor of container.interceptors) {
                intercepted = await interceptor(ctx);
                if (intercepted) break;
            }

            // Execute handler of route
            if (!intercepted) {
                body = await route.handler(ctx);
                if (route.template) { // Render if there is a template
                    body = await ctx.view(route.template, body);
                }
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

    // Listen event
    private onListen(params: { hostname: string; port: number }): void {
        console.log(`\x1b[90m[Spring] ${this.version()}\x1b[0m`);
        console.log(`\x1b[90m[Spring] Repository: https://github.com/metadream/deno-spring\x1b[0m`);
        console.log(`[Spring] Server is running at \x1b[4m\x1b[36mhttp://${params.hostname}:${params.port}\x1b[0m`);
    }

    // Error event
    private onError(error: unknown): Response | Promise<Response> {
        console.error("\x1b[31m[Spring]", error, "\x1b[0m");
        return new Response((error as Error).message, { status: HttpStatus.INTERNAL_SERVER_ERROR });
    }

    // Format deno version
    private version() {
        const vers = JSON.stringify(Deno.version);
        return vers ? vers.replace(/(\"|{|})/g, "").replace(/(:|,)/g, "$1 ") : "Unable to get deno version";
    }

    // Create shortcut methods for request
    private shortcut(method: string) {
        return (path: string, handler: RouteHandler) => {
            this.router.add({ method, path, handler });
            return this;
        };
    }

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
