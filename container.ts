// deno-lint-ignore-file no-explicit-any
import { Decorator, HttpError, Route, RouteHandler } from "./types.ts";

class Container {
    errorHandler?: RouteHandler;
    interceptors: RouteHandler[] = [];
    routes: Route[] = [];

    // To avoid creating instance repeatedly, use "Set" to automatically deduplicate.
    private constructors: Set<any> = new Set();
    private components = new Map<string, object>();

    register(constructor: any, decorator: Decorator) {
        this.constructors.add(constructor);

        // There may be more than one class decorator on single class
        if (decorator.type === "class") {
            const decorators: Decorator[] = Reflect.getMetadata("class:decorators", constructor) || [];
            decorators.push(decorator);
            Reflect.defineMetadata("class:decorators", decorators, constructor);

            if (decorator.name === "Component") {
                this.components.set(constructor.name, constructor);
            }
        } else if (decorator.type === "property") {
            Reflect.defineMetadata("property:decorators", decorator, constructor);
        } else {
            // There may be also more than one method decorator on single method,
            // so defines method decorators group by method name (which is "fn" in this case)
            const fn = decorator.fn as string;
            const decoratorGroup: Record<string, Decorator[]> = Reflect.getMetadata("method:decorators", constructor) ||
                {};
            const decorators: Decorator[] = decoratorGroup[fn] || [];

            decorators.push(decorator);
            decoratorGroup[fn] = decorators;
            Reflect.defineMetadata("method:decorators", decoratorGroup, constructor);
        }
    }

    compose() {
        // Get and create instances from each constructor
        for (const constructor of this.constructors) {
            // New an instance
            const instance = new constructor();

            // Parse decorators on class
            const classDecorators: Decorator[] = Reflect.getMetadata("class:decorators", constructor) || [];
            let controller: Decorator | undefined;

            for (const decorator of classDecorators) {
                if (decorator.name === "Interceptor") {
                    const members = Object.getOwnPropertyNames(constructor.prototype);
                    for (const member of members) {
                        if (member !== "constructor") {
                            this.interceptors.push(instance[member]);
                        }
                    }
                    continue;
                }
                if (decorator.name === "Controller") {
                    controller = decorator;
                }
            }

            const propDecorator: Decorator | undefined = Reflect.getMetadata("property:decorators", constructor);
            if (propDecorator) {
                const propVarName = propDecorator.value as string;
                const propTypeName = propVarName.charAt(0).toUpperCase() + propVarName.slice(1);
                const propClass: any = this.components.get(propTypeName);
                if (!propClass) {
                    throw new HttpError("Class '" + propTypeName + "' undefined");
                }
                instance[propVarName] = new propClass();
            }

            // Parse decorators on method
            const g: Record<string, Decorator[]> = Reflect.getMetadata("method:decorators", constructor) || {};
            const group = Object.values(g);

            for (const decorators of group) {
                for (const decorator of decorators) {
                    if (!decorator.fn) continue;
                    const handler = instance[decorator.fn].bind(instance);

                    // Parse error handler
                    if (decorator.name === "ErrorHandler") {
                        if (this.errorHandler) {
                            throw new HttpError("Duplicated error handler");
                        }
                        this.errorHandler = handler;
                        continue;
                    }
                    // Ignore template decorator (but will be used later)
                    if (decorator.name === "View") {
                        continue;
                    }
                    // Parse routes such as GET, POST, PUT...
                    if (!controller) {
                        throw new HttpError("The class of route must be annotated with @Controller");
                    }

                    // Find template decorator in the same method scope
                    const tmpl: Decorator | undefined = decorators.find((v) => v.name === "View");
                    const template = tmpl ? tmpl.value as string : undefined;
                    const prefix = controller.value as string || "";
                    const path = decorator.value as string || "";

                    this.routes.push({
                        method: decorator.name,
                        path: ("/" + prefix + path).replace(/[\/]+/g, "/"),
                        handler,
                        template,
                    });
                }
            }
        }
    }
}

export const container = new Container();
