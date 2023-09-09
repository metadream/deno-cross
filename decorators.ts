import { Method } from "./types.ts";
import { Server } from "./server.ts";
import { container } from "./container.ts";

export function Bootstrap(): ClassDecorator {
    // deno-lint-ignore no-explicit-any
    return (Application: any) => {
        const server = new Server();
        new Application(server);
        server.run();
    };
}

export function Interceptor(): ClassDecorator {
    return (constructor) => {
        container.register(constructor, {
            name: "Interceptor",
        });
    };
}

export function Component(alias?: string): ClassDecorator {
    return (constructor) => {
        container.register(constructor, {
            name: "Component",
            value: alias,
        });
    };
}

export function Controller(prefix?: string): ClassDecorator {
    return (constructor) => {
        container.register(constructor, {
            name: "Controller",
            value: prefix,
        });
    };
}

export function Autowired(): PropertyDecorator {
    return (target, name) => {
        container.register(target.constructor, {
            name: "Autowired",
            value: name as string,
        });
    };
}

export function ErrorHandler(): MethodDecorator {
    return (target, name) => {
        container.register(target.constructor, {
            name: "ErrorHandler",
            fn: name,
        });
    };
}

export function View(path: string): MethodDecorator {
    return (target, name) => {
        container.register(target.constructor, {
            name: "View",
            value: path,
            fn: name,
        });
    };
}

const Request = (method: string) => (path: string): MethodDecorator => {
    return (target, name) => {
        container.register(target.constructor, {
            name: method,
            value: path,
            fn: name,
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
