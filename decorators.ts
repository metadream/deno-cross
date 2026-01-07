import { Constructor, Parameter } from "./types.ts";
import { Application, Registry } from "./mod.ts";
import { defineMetadata, getMetadata, getAllMetadata, isClassConstructor } from "./reflection.ts";

const app = new Application();

/**
 * Class Decorator: Main application bootstrap
 * @example `@Cross`
 */
export function Cross(Cross: Constructor) {
    new Cross(app);  // Create a main application startup container
    app.interceptors.sort((a, b) => a.order - b.order);  // Interceptor execution order

    // All member instances are centrally injected after all decorators have been executed.
    for (const [target, map] of getAllMetadata()) {
        for (const [propertyKey, metadata] of map as Map<PropertyKey, any>) {
            // Ignore the constructor
            if (propertyKey == "constructor") continue;

            // Inject instances for property members of Class type
            const propertyType = metadata["design:type"];
            if (isClassConstructor(propertyType)) {
                const instance = Registry.get(target);
                const injected = Registry.get(propertyType);
                instance[propertyKey] = injected;
            }
        }
    }
}

/**
 * Class Decorator: Middleware
 * @example `@Middleware`
 */
export function Middleware(target: Constructor) {
    const middleware = Registry.register(target);

    // Add middleware routing method
    const map = getMetadata(target);
    for (const [_propertyKey, metadata] of map as Map<PropertyKey, any>) {
        // Ignore class members without descriptor property
        // (only process metadata with handler)
        if (!metadata.descriptor) continue;

        // Only one global error-handling route allowed
        if (metadata.isErrorRoute && app.errorRoute) {
            throw new Error("Only a unique @ErrorHandler decorator can be defined.");
        }

        // Build route entity
        // The current instance must be bound to call other properties or methods within the instance.
        const route = {
            order: metadata.order,  // Specific property of @Interceptor
            template: metadata.template,  // Specific property of @ErrorHandler
            handler: metadata.descriptor.bind(middleware),
            parameters: getFuncParameters(metadata),
        };

        // Pass the middleware back to the main application
        if (metadata.isErrorRoute) {
            app.errorRoute = route;
        } else {
            app.interceptors.push(route);
        }
    }
}

/**
 * Class Decorator: Controller
 * @example `@Controller("/base-path")`
 */
export function Controller(basePath: string = ""): Function {
    return (target: Constructor) => {
        const controller = Registry.register(target);

        // Add all dynamic routes within the controller
        const map = getMetadata(target);
        for (const [_propertyKey, metadata] of map as Map<PropertyKey, any>) {
            // Ignore class members without descriptor property
            // (only process metadata with handler)
            if (!metadata.descriptor) continue;

            // Add routes to the main application
            // The current instance must be bound to call other properties or methods within the instance.
            app.router.add({
                path: basePath + metadata.path,
                method: metadata.method,
                template: metadata.template,
                handler: metadata.descriptor.bind(controller),
                parameters: getFuncParameters(metadata),
            });
        }
    };
}

/**
 * Class Decorator: Injectable components
 * @example `@Component`
 */
export function Component(target: Constructor) {
    Registry.register(target);
}

/**
 * Property Decorator: Inject component instances for properties
 * @example `@Autowired()`
 */
export function Autowired(target: object, propertyKey: PropertyKey) {
    // Do nothing
}

/**
 * Method Decorator: Page template
 * @example `@Template("index.html")`
 */
export function Template(path: string): MethodDecorator {
    return (target: object, propertyKey: PropertyKey, _: PropertyDescriptor) => {
        defineMetadata(target.constructor, propertyKey, { template: path });
    };
}

/**
 * Method Decorator: Interceptor
 * @example `@Interceptor(1)`
 */
export function Interceptor(order: number = 0): MethodDecorator {
    return (target: object, propertyKey: PropertyKey, descriptor: PropertyDescriptor) => {
        defineMetadata(target.constructor, propertyKey, {
            descriptor: descriptor.value, order, decoratedParams: []
        });
    };
}

/**
 * Method Decorator: Global error handler
 * @example `@ErrorHandler("error.html")`
 */
export function ErrorHandler(template?: string): MethodDecorator {
    return (target: object, propertyKey: PropertyKey, descriptor: PropertyDescriptor) => {
        defineMetadata(target.constructor, propertyKey, {
            descriptor: descriptor.value, template, decoratedParams: [], isErrorRoute: true
        });
    };
}

/** Create HTTP request method decorators */
const createRequestMethod = (method: string) => (path: string = ""): MethodDecorator => {
    return (target: object, propertyKey: PropertyKey, descriptor: PropertyDescriptor) => {
        defineMetadata(target.constructor, propertyKey, {
            method, path, descriptor: descriptor.value
        });
    };
};

/** Create request parameter decorators for routing methods */
const createParamDecorator = (decorator: string): ParameterDecorator => {
    return (target: Object, propertyKey: PropertyKey | undefined, index: number) => {
        if (!propertyKey) return;
        defineMetadata(target.constructor, propertyKey, {
            // Define metadata: Decorated parameter indices and decorator names
            decoratedParams: [{ index, decorator }]
        });
    };
};

/** Get the parameter list defined in the method */
function getFuncParameters(metadata: any): Parameter[] {
    // Retrieve parameter types from metadata and parse parameter names
    const paramTypes = metadata["design:paramtypes"];
    const paramNames = parseParameterNames(metadata.descriptor);

    // Merge parameters with decorators
    return paramTypes.map((type: any, index: number): Parameter => {
        let parameter: Partial<Parameter> = metadata?.decoratedParams?.find((v: any) => v.index === index);
        parameter ? parameter.type = type : parameter = { index, type };
        parameter.name = paramNames[index];
        return parameter as Parameter;
    });
}

/** Parse parameter names defined in the method (some special cases may not be parsed) */
function parseParameterNames(func: Function): string[] {
    const fnStr = func.toString();
    const paramSection = fnStr.slice(fnStr.indexOf("(") + 1, fnStr.indexOf(")"));
    return paramSection.split(",").map(p => p.trim().split("=")[0].trim());
}

/**
 * Parameter Decorator: Parse parameters defined in the pathname
 * @example `@Param id:number`
 */
export const Param: Function = createParamDecorator("Param");

/**
 * Parameter Decorator: Parse parameters defined in the query string
 * @example `@Query id:number`
 */
export const Query: Function = createParamDecorator("Query");

/**
 * Parameter Decorator: Parse request body
 * @example `@Body body:object`
 */
export const Body: Function = createParamDecorator("Body");

/**
 * Method decorator: Create a GET route request
 * @example `@Get("/path/:param?query=keyword")`
 */
export const Get: Function = createRequestMethod("GET");

/**
 * Method decorator: Create a POST route request
 * @example `@Post("/path/:param")`
 */
export const Post: Function = createRequestMethod("POST");

/**
 * Method decorator: Create a PUT route request
 * @example `@Put("/path/:param")`
 */
export const Put: Function = createRequestMethod("PUT");

/**
 * Method decorator: Create a DELETE route request
 * @example `@Delete("/path/:param")`
 */
export const Delete: Function = createRequestMethod("DELETE");

/**
 * Method decorator: Create a PATCH route request
 * @example `@Patch("/path/:param")`
 */
export const Patch: Function = createRequestMethod("PATCH");

/**
 * Method decorator: Create a HEAD route request
 * @example `@Head("/path/:param")`
 */
export const Head: Function = createRequestMethod("HEAD");

/**
 * Method decorator: Create a OPTIONS route request
 * @example `@Options("/path/:param")`
 */
export const Options: Function = createRequestMethod("OPTIONS");