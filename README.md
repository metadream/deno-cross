# Deno-Core

A compact, high-performance and full-featured web server framework in Deno.

## Shortcut mode

```ts
import { core } from "https://deno.land/x/core/mod.ts";

core
  .get("/:user", (ctx) => ctx.params.user)
  .listen();
```

Note that features such as plugins, middlewares, template engine and unified
error handling cannot be used in shortcut mode, you must solve them in other
ways.

## Decorator mode

Importing a ts/tsx file containing any decorators to use its features. Shortcut
mode and decorator mode do not conflict and can be used together. The only
difference in performance between the two is that the latter needs to parse all
decorators at startup, it is almost the same in runtime.

```ts
// main.ts
import { core } from "https://deno.land/x/core/mod.ts";
import "./controllers/MyController.ts"; // Do not forget import the controllers

core.listen();
```

### 1. Controllers

```ts
// controller.ts
import { Context, Controller, Get } from "https://deno.land/x/core/mod.ts";

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
// middleware.ts
import { Context, Middleware } from "https://deno.land/x/core/mod.ts";

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
// plugin.ts
import { Plugin } from "https://deno.land/x/core/mod.ts";

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

### 4. Templates

Template decorators are used to decorate controller methods, and its parameter
is the template file path. After adding it the built-in template engine will be
used for rendering automatically. The built-in engine is based on
[tmplet](https://github.com/metadream/tmplet), You can go to the repo to see the
template syntax.

```ts
// main.ts
core.engine({ // Engine options, not necessary
  root: "", // The root of template files
  imports: {} // Global imports for template
})
.listen();

// controller.ts
import { Context, Controller, Get, Template } from "https://deno.land/x/core/mod.ts";

@Controller("/prefix")
export class MyController {
  @Get("/:user")
  @Template("index.html") // or @Template("root/path/index.html") if engine not initialized
  getUser(ctx: Context) {
    return { name: ctx.params.user };
  }
}

// index.html
<h1>Hello, {{= name }}</h1>
```

### 5. JSX

```ts
// controller.ts
/** @jsx h */
import { Context, Controller, Get, h } from "https://deno.land/x/core/mod.ts";

const Homepage = ({ props }: any) => (
  <div>
    <h1>Hello, {props.name}</h1>
  </div>
);

@Controller()
export class JsxController {
  @Get("/jsx")
  jsx(ctx: Context) {
    const data = { name: "jsx" };
    return <Homepage props={data} />;
  }
}
```

### 6. ErrorHandler

If an error handler decorator is defined, all errors within the framework will
be handled by it. Like middleware, you can define it in any class method but
only once. This decorator has no parameters.

```ts
// error.ts
import { Context, ErrorHandler } from "https://deno.land/x/core/mod.ts";

export class AnyClass {
  @ErrorHandler()
  error(ctx: Context) {
    console.log(ctx.error);
  }
}
```

## API Reference

### Constructor

To start the web server, you simply write a single line of code `core.listen()`.
The instance of `core` has three main methods as follow:

- `serve(path)` `path` is the relative path of static resources directory.
  `serve` method is the syntactic sugar for `get` routing, so the `path` must
  starts with "/".
- `engine(options)` Initialize the built-in template engine. The default value
  of `options` is `{ root: "", imports: {} }`.
- `listen(port)` HTTP server listening port, default 3000.

### Routes

The route methods including `all`,`get`,`post`,`put`,`del`,`patch`,`head`,`opt`,
and all methods have the same parameters. The internal router is based on radix
tree, so you don't need to consider the order of route. For more usage, please
refer to: https://github.com/zhmushan/router.

- `path` Route path.
- `callback` Request handle function.

### Decorators

| Name           | Type            | Parameters | Parameter description         |
| -------------- | --------------- | ---------- | ----------------------------- |
| @Controller    | ClassDecorator  | string     | Prefix for request route      |
| @Plugin        | ClassDecorator  | string     | Plugin name with context      |
| @All           | MethodDecorator | string     | Route path                    |
| @Get           | MethodDecorator | string     | Route path                    |
| @Post          | MethodDecorator | string     | Route path                    |
| @Put           | MethodDecorator | string     | Route path                    |
| @Delete        | MethodDecorator | string     | Route path                    |
| @Patch         | MethodDecorator | string     | Route path                    |
| @Head          | MethodDecorator | string     | Route path                    |
| @Options       | MethodDecorator | string     | Route path                    |
| @Template      | MethodDecorator | string     | Template file path            |
| @Middleware    | MethodDecorator | number     | Middleware execution priority |
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
- `ctx.headers` Refer to https://deno.com/deploy/docs/runtime-headers
- `ctx.cookies` Including one method to get request cookie:
  `ctx.cookies.get(name)`
- `ctx.body` Including five promised methods to parse request body: `text()`,
  `json()`, `form()`, `blob()`, `buffer()`.
- `ctx.request` Native request instance.

#### Response Properties

- `ctx.status`
- `ctx.status=`
- `ctx.statusText`
- `ctx.statusText=`
- `ctx.cookies` Including two methods to operate response cookie:
  `set(name, value)`,`delete(name)`

#### Response Methods

- `ctx.has(name)` The following 5 methods are used to manipulate response
  headers
- `ctx.get(name)`
- `ctx.set(name, value)`
- `ctx.append(name, value)`
- `ctx.delete(name)`
- `ctx.redirect(url[, status])` Redirect url with default status code 308.

#### Others

- `ctx.view(tmplFile, data)` If the controller method does not add a `@Template`
  decorator, you can call this method to return the rendered text content.
- `ctx.render(tmplText, data)` Render template text, usually not needed.
- `ctx.renderJsx(node)` Render template node, usually not needed.
- `ctx.error`
- `ctx.throw(message[, status])`

#### Return types

Controller methods are allowed to return the following object types：

- `BodyInit`: Blob, BufferSource, FormData, ReadableStream, URLSearchParams, or
  USVString
- `Response`: Native response instance.
