// deno-lint-ignore-file no-explicit-any
import { Method } from "./types.ts";
import { container } from "./container.ts";
const camelCase = (v: string) => v.charAt(0).toLowerCase() + v.slice(1);

// ClassDecorator
export function Bootstrap(target: any) {
    container.register(target, {
        name: "@Bootstrap",
    });
}

// ClassDecorator
export function Interceptor(target: any) {
    container.register(target, {
        name: "@Interceptor",
    });
}

// ClassDecorator
export function Component(target: any) {
    container.register(target, {
        name: "@Component",
        param: camelCase(target.name),
    });
}

// ClassDecorator(prefix)
export function Controller(prefix?: string): ClassDecorator {
    return (constructor) => {
        container.register(constructor, {
            name: "@Controller",
            param: prefix || "",
        });
    };
}

// PropertyDecorator
export function Autowired(target: any, relname: string) {
    container.register(target.constructor, {
        name: "@Autowired",
        relname,
    });
}

// MethodDecorator
export function ErrorHandler(target: any, relname: string) {
    container.register(target.constructor, {
        name: "@ErrorHandler",
        relname,
    });
}

// MethodDecorator(path)
export function View(path: string): MethodDecorator {
    return (target, relname) => {
        container.register(target.constructor, {
            name: "@View",
            param: path,
            relname,
        });
    };
}

// MethodDecorator(path)
const Request = (method: string) => (path: string): MethodDecorator => {
    return (target, relname) => {
        container.register(target.constructor, {
            name: "@Request",
            value: method,
            param: path,
            relname,
        });
    };
};

/**
 * Route decorators
 * @returns
 */
export const Get = Request(Method.GET);
export const Post = Request(Method.POST);
export const Put = Request(Method.PUT);
export const Delete = Request(Method.DELETE);
export const Patch = Request(Method.PATCH);
export const Head = Request(Method.HEAD);
export const Options = Request(Method.OPTIONS);
