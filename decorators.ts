import { Method } from "./types.ts";
import { container } from "./container.ts";
const camelCase = (v: string) => v.charAt(0).toLowerCase() + v.slice(1);

export function Bootstrap(): ClassDecorator {
    return (constructor) => {
        container.register(constructor, { type: "app", name: ":Bootstrap" });
    };
}

export function Interceptor(): ClassDecorator {
    return (constructor) => {
        container.register(constructor, { type: "class", name: ":Interceptor" });
    };
}

export function Component(alias?: string): ClassDecorator {
    return (constructor) => {
        const param = camelCase(alias || constructor.name);
        container.register(constructor, { type: "class", name: ":Component", param });
    };
}

export function Controller(prefix?: string): ClassDecorator {
    return (constructor) => {
        const param = prefix || "";
        container.register(constructor, { type: "class", name: ":Controller", param });
    };
}

export function Autowired(): PropertyDecorator {
    return (target, relname) => {
        container.register(target.constructor, { type: "property", name: ":Autowired", relname });
    };
}

export function ErrorHandler(): MethodDecorator {
    return (target, relname) => {
        container.register(target.constructor, { type: "method", name: ":ErrorHandler", relname });
    };
}

export function View(path: string): MethodDecorator {
    return (target, relname) => {
        container.register(target.constructor, { type: "method", name: ":View", param: path, relname });
    };
}

const Request = (method: string) => (path: string): MethodDecorator => {
    return (target, relname) => {
        container.register(target.constructor, {
            type: "method",
            name: ":Request",
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
