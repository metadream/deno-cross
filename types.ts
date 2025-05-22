/** Route handler */
export type RouteHandler = (...args: any[])
    => BodyInit | null | undefined | Promise<BodyInit | null | undefined>

/** Session object */
export type Session = {
    data: Record<string, unknown>;
    expires: number;
}

/** Route handler parameter */
export type Parameter = {
    index: number;
    name: string;
    type: unknown;
    decorator?: string;
}

/** Base route */
export interface BaseRoute {
    handler: RouteHandler;
    parameters: Parameter[];
}

/** Dynamic route */
export interface DynamicRoute extends BaseRoute {
    method: string;
    path: string;
    template?: string;
    pattern?: RegExp;
    params?: Record<string, string>;
}

/** Interceptor route */
export interface InterceptorRoute extends BaseRoute {
    order: number;
}

/** Error route */
export interface ErrorRoute extends BaseRoute {
    template?: string;
}

/** Classes that can be created by `new` */
export interface Constructor<T = object> {
    new(...args: any[]): T;
}

/** Config class that can be injected. */
export class Config {
    [index: string]: any;
}