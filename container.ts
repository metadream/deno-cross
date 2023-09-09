// deno-lint-ignore-file no-explicit-any
import { Reflect } from "./deps.ts";
import { Decorator, Route, RouteHandler } from "./types.ts";
const camelCase = (v: string) => v.charAt(0).toLowerCase() + v.slice(1);

export const container = new class Container {
    errorHandler?: RouteHandler;
    interceptors: RouteHandler[] = [];
    routes: Route[] = [];

    private singletons: Set<any> = new Set();
    private components = new Map<string, any>();

    // Register decorators
    register(target: any, decorator: Decorator) {
        target.instance = target.instance || new target();
        this.singletons.add(target);

        const decorators: Decorator[] = Reflect.getMetadata("spring:decorators", target) || [];
        decorators.push(decorator);
        Reflect.defineMetadata("spring:decorators", decorators, target);

        if (decorator.name === "Component") {
            const key = camelCase(decorator.value || target.name);
            if (!this.components.has(key)) {
                this.components.set(key, target);
            }
        }
    }

    // Inject modules
    inject(target: any) {
        const exists = this.singletons.has(target);
        if (!exists) {
            throw "Undefined module '" + target.name + "', the class may not be annotated.";
        }

        let prefix = "";
        const decorators: Decorator[] = Reflect.getMetadata("spring:decorators", target) || [];

        for (const decorator of decorators) {
            // Ignores
            if (decorator.name === "View" || decorator.name === "Component") {
                continue;
            }

            // Get all methods of Interceptor class
            if (decorator.name === "Interceptor") {
                const members = Object.getOwnPropertyNames(target.prototype);
                for (const member of members) {
                    if (member !== "constructor") {
                        this.interceptors.push(target.instance[member]);
                    }
                }
                continue;
            }

            // Initialize property of Autowired
            if (decorator.name === "Autowired" && decorator.value) {
                const object: any = this.components.get(decorator.value);
                if (!object) {
                    throw "Undefined module '" + decorator.value + "', the class may not be annotated.";
                }
                target.instance[decorator.value] = object.instance;
                continue;
            }

            // Parse root of route
            if (decorator.name === "Controller") {
                prefix = decorator.value || "";
                continue;
            }

            // Parse routes and error handler
            if (decorator.fn) {
                const handler = target.instance[decorator.fn].bind(target.instance);
                if (decorator.name === "ErrorHandler") {
                    if (this.errorHandler) {
                        throw "Duplicated error handler.";
                    }
                    this.errorHandler = handler;
                    continue;
                }

                const path = ("/" + prefix + decorator.value || "").replace(/[\/]+/g, "/");
                const view = decorators.find((v) => v.name === "View" && v.fn === decorator.fn);
                const template = view ? view.value : undefined;
                this.routes.push({ method: decorator.name, path, handler, template });
            }
        }
    }
}();
