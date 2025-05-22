import { StatusCode, STATUS_CODE, STATUS_TEXT } from "@std/http/status";
import { HttpError } from "./context.ts";

/**
 * Assertion utility class that assists in validating arguments.
 * Useful for identifying programmer errors early and clearly at runtime.
 *
 * @Author Marco
 * @Repository https://github.com/metadream/deno-cross
 * @Since 2025-05-17
 */
export class Assert {

    /** Assert a boolean expression is true or an object is not null and undefined */
    static isTrue(obj: unknown, message: string | StatusCode): void {
        if (!obj) Assert.throwHttpError(message);
    }

    /** Assert that the given string contains valid text content */
    static hasText(str: string, message: string | StatusCode) {
        if (!str || !str.trim()) Assert.throwHttpError(message);
    }

    /** Overload the error message parameter and throw HTTP error */
    private static throwHttpError(message: string | StatusCode) {
        let status: StatusCode = STATUS_CODE.OK;
        if (typeof message === "number") {
            status = message;
            message = STATUS_TEXT[message];
        }
        throw new HttpError(status, message);
    }

}