// deno-lint-ignore-file no-explicit-any
import { Tmplet } from "./deps.ts";

/**
 * Built-in Template Engine Based on Tmplet
 * @link https://github.com/metadream/tmplet
 */
export class Engine {

    // Init engine options
    init(options: any) {
        Tmplet.init(options);
    }

    // Compile template text
    compile(tmpl: string) {
        return Tmplet.compile(tmpl);
    }

    // Render template text
    render(tmpl: string, data: any = {}) {
        return Tmplet.render(tmpl, data);
    }

    // Render template file
    view(file: string, data: any = {}) {
        return Tmplet.view(file, data);
    }

}