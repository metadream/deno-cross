// deno-lint-ignore-file no-explicit-any
import { Reflect } from "./deps.ts";
import { Decorator, Interceptor, Route, RouteHandler } from "./types.ts";
import { Server } from "./server.ts";

export const container = new class Container {
    errorHandler?: RouteHandler;
    attributes: Record<string, any> = {};
    interceptors: Interceptor[] = [];
    routes: Route[] = [];

    private modules: Set<any> = new Set();
    private server = new Server();

    // Register decorators
    register(target: any, decorator: Decorator) {
        // Start the application and trigger all decorators
        if (decorator.name === "@Bootstrap") {
            new target(this.server);
            return this.server.run();
        }

        // If there are parameters, use them to create the instance
        // Otherwise create it by the default constructor
        const paramTypes = Reflect.getMetadata("design:paramtypes", target) as any[];
        if (paramTypes) {
            const params = paramTypes.map((v) => v.instance);
            target.instance = target.instance || new target(...params);
        } else {
            target.instance = target.instance || new target();
        }

        // Define metadata to target
        // and add target to modules
        this.defineMetadata(target, decorator);
        this.modules.add(target);
    }

    // Inject module
    inject(target: any) {
        const found = this.modules.has(target);
        if (!found) throw "The module '" + target.name + "' may not be registered.";

        const interceptor = this.getMetadata(target, "@Interceptor")[0];
        const component = this.getMetadata(target, "@Component")[0];
        const controller = this.getMetadata(target, "@Controller")[0];
        const errorHandler = this.getMetadata(target, "@ErrorHandler")[0];
        const requests = this.getMetadata(target, "@Request");
        const views = this.getMetadata(target, "@View");
        const properties = this.getMetadata(target, "@Autowired");
        const attributes = this.getMetadata(target, "@Attribute");

        // Extract all methods of the interceptor
        if (interceptor) {
            const members = Object.getOwnPropertyNames(target.prototype);
            for (const member of members) {
                if (member !== "constructor") {
                    const handler = target.instance[member].bind(target.instance);
                    this.interceptors.push(handler);
                }
            }
        }

        // Set error handler
        if (errorHandler) {
            if (!component) throw "The module of '" + target.name + "' must be decorated.";
            if (!errorHandler.fn) throw "@ErrorHandler decorator must be added to a method.";
            this.errorHandler = errorHandler.fn.bind(target.instance);
        }

        // Inject autowired properties
        for (const prop of properties) {
            const decorated = component || controller || interceptor;
            const relname = prop.relname as string;
            const reltype = prop.reltype;

            if (!decorated) throw "The module of '" + target.name + "' must be decorated.";
            if (!relname) throw "@Autowired decorator must be added to a property.";
            if (!reltype) throw "@Autowired decorator must declare a type.";
            if (!this.modules.has(reltype)) throw "Undefined module '" + relname + "' in '" + target.name + "'.";
            target.instance[relname] = reltype.instance;
        }

        // Inject attributes for template
        for (const attr of attributes) {
            if (!component) throw "The module of '" + target.name + "' must be decorated.";
            if (!attr.fn) throw "@Attribute decorator must be added to a method.";

            const relname = attr.relname as string;
            this.attributes[relname] = attr.fn.bind(target.instance);
        }

        // Parse request routes
        for (const req of requests) {
            if (!controller) throw "The module '" + target.name + "' must be decorated with @Controller.";
            if (!req.fn) throw "Request decorator must be added to a method.";
            if (!req.method) throw "Request decorator must have a method name.";

            const handler = req.fn.bind(target.instance);
            const path = ("/" + controller.param + req.param).replace(/[\/]+/g, "/");
            const view = views.find((v) => v.fn === req.fn);
            const template = view ? view.param : undefined;
            this.routes.push({ method: req.method, path, handler, template });
        }
    }

    // Define multiple metadata on the same target
    private defineMetadata(target: any, decorator: Decorator): void {
        const key = decorator.name;
        const decorators: Decorator[] = Reflect.getMetadata(key, target) || [];
        decorators.push(decorator);
        Reflect.defineMetadata(key, decorators, target);
    }

    // Get metadata by key
    private getMetadata(target: any, key: string): Decorator[] {
        return Reflect.getMetadata(key, target) || [];
    }
}();
