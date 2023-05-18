import { Context } from "./context.ts";

// Request methods
export const enum Method {
    ALL = "ALL",
    GET = "GET",
    POST = "POST",
    PUT = "PUT",
    DELETE = "DELETE",
    PATCH = "PATCH",
    HEAD = "HEAD",
    OPTIONS = "OPTIONS",
}

// Common HTTP status codes
export const enum HttpStatus {
    SUCCESS = 200,
    NO_CONTENT = 204,

    BAD_REQUEST = 400,
    UNAUTHORIZED = 401,
    FORBIDDEN = 403,
    NOT_FOUND = 404,
    METHOD_NOT_ALLOWED = 405,
    NOT_ACCEPTABLE = 406,
    REQUEST_TIMEOUT = 408,
    PAYLOAD_TOO_LARGE = 413,
    UNSUPPORTED_MEDIA_TYPE = 415,
    TOO_MANY_REQUESTS = 429,

    INTERNAL_SERVER_ERROR = 500,
}

// Common mimetypes
export const Mime: Record<string, string> = {
    ".htm": "text/html; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".xml": "text/xml; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".log": "text/plain; charset=utf-8",
    ".ini": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".yaml": "text/yaml; charset=utf-8",
    ".yml": "text/yaml; charset=utf-8",
    ".conf": "text/plain; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".jsx": "text/jsx; charset=utf-8",
    ".ts": "text/typescript; charset=utf-8",
    ".tsx": "text/tsx; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".tif": "image/tiff",
    ".heic": "image/heic",
    ".heif": "image/heif",
    ".mid": "audio/midi",
    ".midi": "audio/midi",
    ".mp3": "audio/mp3",
    ".mp4a": "audio/mp4",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
    ".wav": "audio/wav",
    ".webm": "audio/webm",
    ".aac": "audio/x-aac",
    ".flac": "audio/x-flac",
    ".mp4": "video/mp4",
    ".mp4v": "video/mp4",
    ".mkv": "video/x-matroska",
    ".mov": "video/quicktime",
    ".otf": "font/otf",
    ".ttf": "font/ttf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".jar": "application/java-archive",
    ".war": "application/java-archive",
    ".gz": "application/gzip",
    ".zip": "application/zip",
}

// Route callback function in the controller
export type Callback = (ctx: Context) => void;

// Decorator entity
export type Decorator = {
    type: "class" | "method";
    name: string;
    value?: string | number;
    fn?: string | symbol;
}

// Route entity
export type Route = {
    method: string;
    path: string;
    callback: Callback;
    template?: string;
    params?: Record<string, string>;
}

// Middleware entity
export type Middleware = {
    priority: number;
    callback: Callback;
}

// Cookie options
export type CookieOptions = {
    /** Expiration date of the cookie. */
    expires?: Date;
    /** Max-Age of the Cookie. Max-Age must be an integer superior or equal to 0. */
    maxAge?: number;
    /** Specifies those hosts to which the cookie will be sent. */
    domain?: string;
    /** Indicates a URL path that must exist in the request. */
    path?: string;
    /** Indicates if the cookie is made using SSL & HTTPS. */
    secure?: boolean;
    /** Indicates that cookie is not accessible via JavaScript. */
    httpOnly?: boolean;
    /**
     * Allows servers to assert that a cookie ought not to
     * be sent along with cross-site requests.
     */
    sameSite?: "Strict" | "Lax" | "None";
    /** Additional key value pairs with the form "key=value" */
    unparsed?: string[];
}

/**
 * Custom Http Error
 * Add HTTP status code field
 */
export class HttpError extends Error {
    status: number;

    constructor(message: string, status?: number) {
        super(message);
        this.status = !status || status < 400 || status > 511
            ? HttpStatus.INTERNAL_SERVER_ERROR : status;
    }

}