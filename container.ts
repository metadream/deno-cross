// deno-lint-ignore-file no-explicit-any
import { Decorator, Route, RouteHandler, Singleton } from "./types.ts";
const pascalCase = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

export const container = new class Container {
    private singletons = new Map<string, Singleton>();

    errorHandler?: RouteHandler;
    interceptors: RouteHandler[] = [];
    routes: Route[] = [];

    // Register decorators and create singletons for every module
    register(constructor: any, decorator: Decorator) {
        let singleton = this.singletons.get(constructor.name);
        if (!singleton) {
            singleton = { constructor, instance: new constructor(), decorators: [] };
            this.singletons.set(constructor.name, singleton);
        }
        singleton.decorators.push(decorator);
    }

    // Inject module and compose modules
    inject(module: any) {
        const singleton = this.singletons.get(module.name);
        if (!singleton) {
            throw "Undefined module '" + module.name + "', the class may not be annotated.";
        }

        let prefix = "";
        for (const decorator of singleton.decorators) {
            // Get all methods of Interceptor class
            if (decorator.name === "Interceptor") {
                const members = Object.getOwnPropertyNames(singleton.constructor.prototype);
                for (const member of members) {
                    if (member !== "constructor") {
                        this.interceptors.push(singleton.instance[member]);
                    }
                }
                continue;
            }

            // Initialize property of Autowired
            if (decorator.name === "Autowired" && decorator.value) {
                const prop = pascalCase(decorator.value);
                const object: any = this.singletons.get(prop);
                if (!object) {
                    throw "Undefined module '" + prop + "', the class may not be annotated.";
                }
                singleton.instance[decorator.value] = object.instance;
                continue;
            }

            // Initialize error handler
            if (decorator.name === "ErrorHandler" && decorator.fn) {
                if (this.errorHandler) {
                    throw "Duplicated error handler.";
                }
                this.errorHandler = singleton.instance[decorator.fn].bind(singleton.instance);
                continue;
            }

            // Parse root of route
            if (decorator.name === "Controller") {
                prefix = decorator.value || "";
                continue;
            }

            // Ignores
            if (decorator.name === "View" || decorator.name === "Component") {
                continue;
            }

            // Parse route
            if (decorator.fn) {
                const path = ("/" + prefix + decorator.value || "").replace(/[\/]+/g, "/");
                const handler = singleton.instance[decorator.fn].bind(singleton.instance);
                const view: Decorator | undefined = singleton.decorators.find((v) =>
                    v.name === "View" && v.fn === decorator.fn
                );
                const template = view ? view.value : undefined;
                this.routes.push({ method: decorator.name, path, handler, template });
            }
        }
    }
}();
