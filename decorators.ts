// deno-lint-ignore-file no-explicit-any

import { Server } from "./server.ts";

export function Bootstrap(): ClassDecorator {
    return (Application: any) => {
        const server = new Server().run();
        new Application(server);
    };
}
