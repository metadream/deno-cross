// deno-lint-ignore-file no-this-alias
import type { Route, Callback } from "./defs.ts";

/**
 * Router for Adding and Finding routes
 * based on radix tree.
 */
export class Router {

    // In view of the fact that x/router does not implement the
    // parsing function of the request method, this framework
    // adds the grouping of routers according to request method
    #radixGroup: Record<string, Radix> = {};

    // Since the route has other properties (such as template),
    // it is necessary to cache all routes for finding later
    #routes: Route[] = [];
    get routes() { return this.#routes; }

    /**
     * Add a route
     * @param route Route
     */
    add(route: Route) {
        let radix = this.#radixGroup[route.method];
        if (!radix) {
            radix = new Radix();
            this.#radixGroup[route.method] = radix;
        }
        radix.add(route.path, route.callback);
        this.#routes.push(route);
    }

    /**
     * Find a route
     * @param method
     * @param path
     * @returns Route
     */
    find(method: string, path: string): Route | undefined {
        const radix = this.#radixGroup[method];
        if (radix) {
            const [callback, params] = radix.find(path);
            if (callback) {

                // Since the route has other properties (such as template),
                // it is necessary to re-find the complete route according to the callback
                const route = this.#routes.find(v => v.callback === callback);
                if (route) {
                    route.params = {};
                    for (const [k, v] of params) route.params[k] = v;
                    return route;
                }
            }
        }
    }

}

/**
 * Radix tree modified version (the return parameters type modified)
 * @author https://github.com/zhmushan/router
 * @import https://deno.land/x/router@v2.0.1/mod.ts
 */
class Radix {

    path = "";
    children = new Map<string, Radix>();
    handler?: Callback;

    constructor(node?: Partial<Radix>) {
        if (node) Object.assign(this, node);
    }

    add(path: string, handler: Callback): void {
        let n: Radix = this;

        let i = 0;
        for (; i < path.length && !isWildcard(path[i]); ++i);
        n = n.#merge(path.slice(0, i));

        let j = i;
        for (; i < path.length; ++i) {
            if (isWildcard(path[i])) {
                if (j !== i) {
                    // insert static route
                    n = n.#insert(path.slice(j, i));
                    j = i;
                }

                ++i;

                for (; i < path.length && path[i] !== "/"; ++i) {
                    if (isWildcard(path[i])) {
                        throw new Error(
                            `only one wildcard per path segment is allowed, has: "${path.slice(
                                j, i)}" in path "${path}"`,
                        );
                    }
                }

                if (path[j] === ":" && i - j === 1) {
                    throw new Error(
                        `param must be named with a non-empty name in path "${path}"`,
                    );
                }

                // insert wildcard route
                n = n.#insert(path.slice(j, i));
                j = i;
            }
        }

        if (j === path.length) {
            n.#merge("", handler);
        } else {
            n.#insert(path.slice(j), handler);
        }
    }

    find(path: string): [handler: Callback | undefined, params: Map<string, string>] {
        let handler: Callback | undefined;
        const params = new Map<string, string>();
        const stack: [node: Radix, path: string, vis: boolean][] = [
            [this, path, false],
        ];

        for (let i = 0; i >= 0;) {
            const [n, p, v] = stack[i];
            let np: string | undefined; // next path

            if (v) {
                --i;
                if (n.path[0] === ":") { // assert not "*"
                    params.delete(n.path.slice(1));
                }
                continue;
            } else {
                stack[i][2] = true; // vis = true
            }

            if (n.path[0] === "*") {
                if (n.path.length > 1) {
                    params.set(n.path.slice(1), p);
                }
                np = undefined;
            } else if (n.path[0] === ":") {
                const [_cp, _np] = splitFromFirstSlash(p);
                params.set(n.path.slice(1), _cp);
                np = _np === "" ? undefined : _np;
            } else if (n.path === p) {
                if (n.handler === undefined) {
                    if (n.children.has("*")) {
                        np = "";
                    } else {
                        --i;
                        continue;
                    }
                } else {
                    np = undefined;
                }
            } else {
                const lcp = longestCommonPrefix(n.path, p);
                if (lcp !== n.path.length) {
                    --i;
                    continue;
                } else {
                    np = p.slice(lcp);
                }
            }

            if (np === undefined) {
                handler = n.handler;
                break;
            }

            let c = n.children.get("*");
            if (c) {
                stack[++i] = [c, np, false];
            }

            if (np === "") {
                continue;
            }

            c = n.children.get(":");
            if (c) {
                stack[++i] = [c, np, false];
            }

            c = n.children.get(np[0]);
            if (c) {
                stack[++i] = [c, np, false];
            }
        }

        return [handler, params];
    }

    #merge = (path: string, handler?: Callback): Radix => {
        let n: Radix = this;

        if (n.path === "" && n.children.size === 0) {
            n.path = path;
            n.handler = handler;
            return n;
        }

        if (path === "") {
            if (n.handler) {
                throw new Error(
                    `a handler is already registered for path "${n.path}"`,
                );
            }
            n.handler = handler;
            return n;
        }

        for (; ;) {
            const i = longestCommonPrefix(path, n.path);

            if (i < n.path.length) {
                const c = new Radix({
                    path: n.path.slice(i),
                    children: n.children,
                    handler: n.handler,
                });

                n.children = new Map([[c.path[0], c]]);
                n.path = path.slice(0, i);
                n.handler = undefined;
            }

            if (i < path.length) {
                path = path.slice(i);
                let c = n.children.get(path[0]);

                if (c) {
                    n = c;
                    continue;
                }

                c = new Radix({ path, handler });
                n.children.set(path[0], c);
                n = c;
            } else if (handler) {
                if (n.handler) {
                    throw new Error(
                        `a handler is already registered for path "${path}"`,
                    );
                }
                n.handler = handler;
            }
            break;
        }
        return n;
    };

    #insert = (path: string, handler?: Callback): Radix => {
        let n: Radix = this;
        let c = n.children.get(path[0]);

        if (c) {
            n = c.#merge(path, handler);
        } else {
            c = new Radix({ path, handler });
            n.children.set(path[0], c);
            n = c;
        }
        return n;
    };
}

function isWildcard(c: string): boolean {
    if (c.length !== 1) throw new Error("Wildcard parse error");
    return c === ":" || c === "*";
}

function longestCommonPrefix(a: string, b: string): number {
    let i = 0;
    const len = Math.min(a.length, b.length);
    for (; i < len && a[i] === b[i]; ++i);
    return i;
}

function splitFromFirstSlash(path: string): [cp: string, np: string] {
    let i = 0;
    for (; i < path.length && path[i] !== "/"; ++i);
    return [path.slice(0, i), path.slice(i)];
}