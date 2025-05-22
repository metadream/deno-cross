import { DynamicRoute } from "./types.ts";

/**
 * Core Router
 *
 * @Author Marco
 * @Repository https://github.com/metadream/deno-cross
 * @Since 2022-11-09
 *
 * @example `/literal`
 * @example `/:user`
 * @example `/:users?`
 * @example `/:user(\\d+)`
 * @example `/*`
 */
export class Router {

    private routes: DynamicRoute[] = [];
    private sortRule = ["", "*", ":"];
    private sorted = false;

    /**
     * Add a route
     * @param {string} method
     * @param {string|RegExp} path
     * @param {Function} handler
     */
    add(route: DynamicRoute): void {
        route.pattern = this.parse(route.path);
        this.routes.push(route);
    }

    /**
     * Find a route
     * @param {string} method
     * @param {string} url
     * @returns
     */
    find(method: string, url: string): DynamicRoute | undefined {
        if (!this.sorted) {
            this.sorted = true;
            this.sortRoutes();
        }

        for (const route of this.routes) {
            if (route.method && route.method !== method) continue;
            if (!route.pattern) continue;

            const matches = route.pattern.exec(url);
            if (matches) {
                const g = matches.groups;
                route.params = {};
                if (g) for (const k in g) route.params[k] = g[k];
                return route;
            }
        }
    }

    /** Sort the routes by built-in rule */
    private sortRoutes(): void {
        this.routes.sort((a: DynamicRoute, b: DynamicRoute) => {
            const aLen = a.path.length;
            const bLen = b.path.length;
            const maxLen = Math.max(aLen, bLen);

            for (let i = 0; i < maxLen; i++) {
                const aChar = a.path.charAt(i);
                const bChar = b.path.charAt(i);
                if (aChar == bChar) continue;

                const aIndex = this.sortRule.findIndex((v) => v == aChar);
                const bIndex = this.sortRule.findIndex((v) => v == bChar);
                return aIndex - bIndex;
            }
            return 0;
        });
    }

    /** Parse th pattern to regular expression */
    private parse(pattern: string | RegExp): RegExp {
        return pattern instanceof RegExp ? pattern : new RegExp(
            "^" + pattern
            .replace(/\/\*($|\/)/g, "/(?<wildcard>.*)$1")
            .replace(/:(\w+)(\(\S+\))?/g, (_, k, r) => `(?<${k}>${r ? r : "([^/]+?)"})`) +
            "$",
        );
    }

}