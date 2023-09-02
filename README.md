# Deno-Spring

A compact, high-performance and full-featured web server framework in Deno.

## Shortcut mode

```ts
import { app } from "https://deno.land/x/spring/mod.ts";

app.get("/:user", (ctx) => ctx.params.user);
app.boot();
```

Note that features such as plugins, middlewares, template engine and unified
error handling cannot be used in shortcut mode, you must solve them in other
ways.

## Decorator mode

Importing a `ts` file containing any decorators to use its features. Shortcut
mode and decorator mode do not conflict and can be used together. The only
difference in performance between the two is that the latter needs to parse all
decorators at startup, it is almost the same in runtime.

```ts
// mod.ts
import app from "https://deno.land/x/spring/mod.ts";
import "./controllers/MyController.ts"; // DO NOT forget import the controllers

app.boot();
```

### 1. Controllers

```ts
// MyController.ts
import { Context, Controller, Get } from "https://deno.land/x/spring/mod.ts";

@Controller("/prefix")
export class MyController {
  @Get("/:user")
  getUser(ctx: Context) {
    return ctx.params.user;
  }
}
```

### 2. Middlewares

You can add middleware decorator on any class method, including controllers. The
role of the middleware parameter is to set the execution priority.

```ts
// MyMiddleware.ts
import { Context, Middleware } from "https://deno.land/x/spring/mod.ts";

export class MyMiddleware {
  @Middleware(2)
  cors(ctx: Context) {
    // do something second
  }

  @Middleware(1)
  auth(ctx: Context) {
    // do something first
  }
}
```

### 3. Plugins

Plugin decorators can only be added to classes, and the parameter is the name
bound to the context.

```ts
// MyPlugin.ts
import { Plugin } from "https://deno.land/x/spring/mod.ts";

@Plugin("redis")
export class Redis {
  constructor() {
    // connect to redis server and create a client
  }
  get(key) {
    // do something
  }
  set(key, value) {
    // do something
  }
}
```

Then you can use redis object as singleton instance in any controllers with
`ctx.redis`.

### 4. View

View decorators are used to decorate controller methods, and its parameter is
the template file path. After adding it the built-in template engine will be
used for rendering automatically. The built-in engine syntax see
[SYNTAX.md](/SYNTAX.md)

```ts
// mod.ts
app.boot({  // Engine options, not necessary
  viewRoot: "./pages",   // The root of template files
  imports: {  // Global imports for template
    siteName: "My Blog"
  }
});

// controller.ts
import { Context, Controller, Get, View } from "https://deno.land/x/spring/mod.ts";

@Controller("/prefix")
export class MyController {
  @Get("/:user")
  @View("index.html") // or @View("./project/path/index.html") if options not initialized
  getUser(ctx: Context) {
    return { name: ctx.params.user };
  }
}

// index.html
<h1>Hello, {{= name }}</h1>
```

### 5. ErrorHandler

If an error handler decorator is defined, all errors within the framework will
be handled by it. Like middleware, you can define it in any class method but
only once. This decorator has no parameters.

```ts
// error.ts
import { Context, ErrorHandler } from "https://deno.land/x/spring/mod.ts";

export class AnyClass {
  @ErrorHandler()
  error(ctx: Context, err: Error) {
    return {
      status: ctx.status,
      message: err.message,
    };
  }
}
```

## API Reference

### Bootstrap

To start the web server, you simply write a single line of code `app.boot()`.
The options as follow:

- `port` HTTP server listening port, default 3000.
- `hostname` HTTP server hostname, default "0.0.0.0"
- `viewRoot` The root of template files
- `imports` Global imports for template
- `assets` The array of paths of static resources
- `onListen`
- `onError`

### Routes

The route methods including `get`,`post`,`put`,`del`,`patch`,`head`,`opt`,
and all methods have the same parameters.

- `path` Route path.
- `handler` Request handle function.

### Decorators

| Name          | Type            | Parameters | Parameter description         |
| ------------- | --------------- | ---------- | ----------------------------- |
| @Controller   | ClassDecorator  | string     | Prefix for request route      |
| @Plugin       | ClassDecorator  | string     | Plugin name with context      |
| @Get          | MethodDecorator | string     | Route path                    |
| @Post         | MethodDecorator | string     | Route path                    |
| @Put          | MethodDecorator | string     | Route path                    |
| @Delete       | MethodDecorator | string     | Route path                    |
| @Patch        | MethodDecorator | string     | Route path                    |
| @Head         | MethodDecorator | string     | Route path                    |
| @Options      | MethodDecorator | string     | Route path                    |
| @View         | MethodDecorator | string     | Template file path            |
| @Middleware   | MethodDecorator | number     | Middleware execution priority |
| @ErrorHandler | MethodDecorator | undefined  |                               |

### Context

Context is an instance passed to controllers, middlewares and error handler, it
contains properties and methods related to requests and responses.

#### Request Properties

- `ctx.params` The parameters on route path
- `ctx.query` The parameters on query string
- `ctx.url` ex. https://example.com:3000/users?page=1
- `ctx.origin` ex. https://example.com:3000
- `ctx.protocol` ex. https:
- `ctx.host` ex. example.com:3000
- `ctx.hostname` ex. example.com
- `ctx.port` ex. 3000
- `ctx.path` ex. /users
- `ctx.method` Standard http request methods
- `ctx.has`, `ctx.get` Shortcuts for obtain reqeust headers. Refer to
  https://deno.com/deploy/docs/runtime-headers
- `ctx.cookies` Including one method to get request cookie:
  `ctx.cookies.get(name)`
- `ctx.text`, `ctx.json`, `ctx.form`, `ctx.blob`, `ctx.buffer` Promised methods to parse request body.

#### Response Properties

- `ctx.status`
- `ctx.status=`
- `ctx.statusText`
- `ctx.statusText=`
- `ctx.cookies` Including two methods to operate response cookie:
  `set(name, value)`,`delete(name)`

#### Response Methods

- `ctx.set(name, value)` The following 3 methods are used to manipulate response
  headers
- `ctx.redirect(url[, status])` Redirect url with default status code 308.

#### Others

- `ctx.view(tmplFile, data)` If the controller method does not add a `@View`
  decorator, you can call this method to return the rendered text content.
- `ctx.render(tmplText, data)` Render template text, usually not needed.

#### Return types

Controller methods are allowed to return the following object types:

- `BodyInit`: Blob, BufferSource, FormData, ReadableStream, URLSearchParams, or
  USVString
- `Response`: Native response instance.
