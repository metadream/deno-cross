import { Method } from "./types.ts";
import { Global } from "./global.ts";

/**
 * Route decorator
 * @param method
 * @param path
 * @returns
 */
const Request = (method: string) => (path: string): MethodDecorator => {
    return (target, name) => {
        Global.append(target.constructor, {
            type: "method",
            name: method,
            value: path,
            fn: name,
        });
    };
};

/**
 * Middleware decorator
 * @param priority
 * @returns
 */
export const Middleware = (priority: number): MethodDecorator => {
    return (target, name) => {
        Global.append(target.constructor, {
            type: "method",
            name: "Middleware",
            value: priority,
            fn: name,
        });
    };
};

/**
 * View decorator
 * @param path template file path
 * @returns
 */
export const View = (path: string): MethodDecorator => {
    return (target, name) => {
        Global.append(target.constructor, {
            type: "method",
            name: "View",
            value: path,
            fn: name,
        });
    };
};

/**
 * ErrorHandler decorator
 * @returns
 */
export const ErrorHandler = (): MethodDecorator => {
    return (target, name) => {
        Global.append(target.constructor, {
            type: "method",
            name: "ErrorHandler",
            fn: name,
        });
    };
};

/**
 * Controller decorator
 * @param prefix
 * @returns
 */
export const Controller = (prefix?: string): ClassDecorator => {
    return (constructor) => {
        Global.append(constructor, {
            type: "class",
            name: "Controller",
            value: prefix,
        });
    };
};

/**
 * Plugin decorator
 * @param name
 * @returns
 */
export const Plugin = (name: string): ClassDecorator => {
    return (constructor) => {
        Global.append(constructor, {
            type: "class",
            name: "Plugin",
            value: name,
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
