import { Route } from "./types.ts";

/**
 * Router
 * @example /static
 * @example /:user
 * @example /:users?
 * @example /:user(\\d+)
 * @example /*
 */
export class Router {
    private SORT_RULE = ["", "*", ":"];
    private routes: Route[] = [];
    private sorted = false;

    /**
     * Add a route
     * @param {string} method
     * @param {string|RegExp} path
     * @param {Function} handler
     */
    add(route: Route): void {
        route.pattern = this.parse(route.path);
        this.routes.push(route);
    }

    /**
     * Find a route
     * @param {string} method
     * @param {string} url
     * @returns
     */
    find(method: string, url: string): Route | undefined {
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

    private sortRoutes(): void {
        this.routes.sort((a: Route, b: Route) => {
            const aLen = a.path.length;
            const bLen = b.path.length;
            const maxLen = Math.max(aLen, bLen);

            for (let i = 0; i < maxLen; i++) {
                const aChar = a.path.charAt(i);
                const bChar = b.path.charAt(i);
                if (aChar == bChar) continue;

                const aIndex = this.SORT_RULE.findIndex((v) => v == aChar);
                const bIndex = this.SORT_RULE.findIndex((v) => v == bChar);
                return aIndex - bIndex;
            }
            return 0;
        });
    }

    /**
     * Parse route pattern to regex
     * @param {string|RegExp} pattern
     * @returns
     */
    private parse(pattern: string | RegExp): RegExp {
        return pattern instanceof RegExp ? pattern : new RegExp(
            "^" + pattern
                .replace(/\/\*($|\/)/g, "/(?<wildcard>.*)$1")
                .replace(/:(\w+)(\(\S+\))?/g, (_, k, r) => `(?<${k}>${r ? r : "([^/]+?)"})`) +
                "$",
        );
    }
}
