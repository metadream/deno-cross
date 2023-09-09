# Deno-Spring

A compact, high-performance and full-featured web server framework in Deno.

## Shortcut mode

Create a `mod.ts` file and write the following content, then run `deno run --allow-all mod.ts`.

```ts
import { Bootstrap, Server } from "https://deno.land/x/spring/mod.ts";

@Bootstrap()
export default class {
    constructor(app: Server) {
        app.get("/:id", (ctx) => {
            return "hello " + ctx.params.id;
        });
    }
}
```

Note that features such as components, template engine and unified error handling
 cannot be used in shortcut mode, you must solve them in other ways.

## Decorator mode

Decorator mode and shortcut mode do not conflict and can be used together. The only
difference in performance between the two is that the latter needs to parse all
decorators at startup, it is almost the same in runtime. Modify the content of `mod.ts`
 as follows.

```ts
@Bootstrap()
export default class {
    constructor(app: Server) {
        app.modules(Authenticator, ErrorController, UserController, UserService);
        app.assets("/assets/*", "/cover/*");
    }
}
```

### 1. Controllers

```ts
// UserController.ts
@Controller("/prefix")
export class UserController {
    @Get("/:id")
    getUser(ctx: Context) {
        return ctx.params.id;
    }
}
```

### 2. Interceptor

The interceptor is not required, but if there is one, the methods in it will be executed in order.

```ts
// MyInterceptor.ts
@Interceptor()
export class MyInterceptor {
    cors(ctx: Context) {
        // do something first
    }
    auth(ctx: Context) {
        // do something second
    }
}
```

### 3. Component

```ts
// UserService.ts
@Component()
export class UserService {
    getUser(id: string) {
        // do something
    }
}
```

### 4. Autowired

Inject service in controller. Note that the property name must be consistent with the class name
, with the first letter lowercase.

```ts
// UserController.ts
@Controller("/prefix")
export class UserController {
    @Autowired()
    userService!: UserService;

    @Get("/:id")
    getUser(ctx: Context) {
        return this.userService.getUser(ctx.params.id);
    }
}
```

### 5. View

View decorators are used to decorate controller methods, and its parameter is
the template file path. After adding it the built-in template engine will be
used for rendering automatically. The built-in engine syntax see [SYNTAX.md](/SYNTAX.md)

```ts
// mod.ts
@Bootstrap()
export default class {
    constructor(app: Server) {
        app.modules(Authenticator, ErrorController, UserController, UserService);
        app.assets("/assets/*", "/cover/*");

        // Add the following code for template engine
        app.views("./views");
        app.imports({ formatDate });
    }
}

// UserController.ts
@Controller("/prefix")
export class UserController {
    @Autowired()
    userService!: UserService;

    @Get("/:id")
    @View("index.html") // or @View("./project/path/index.html") if options not initialized
    getUser(ctx: Context) {
        return this.userService.getUser(ctx.params.id);
    }
}

// index.html
<h1>Hello, {{= name }} {{= formatDate(birthdate) }}</h1>
```

### 6. ErrorHandler

If an error handler decorator is defined, all errors within the framework will
be handled by it.

```ts
// ErrorController.ts
export class ErrorController {
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

- `port` HTTP server listening port, default 3000.
- `hostname` HTTP server hostname, default "0.0.0.0"
- `views` The root of template files, default ""
- `imports` Global imports for template, default {}
- `assets` The paths of static resources
- `modules` Load classes that need to use decorator in the application
- `get`, `post`, `put`... Request methods with `(path, handler)` parameters

### Decorators

| Name          | Type            | Parameters | Parameter description         |
| ------------- | --------------- | ---------- | ----------------------------- |
| @Bootstrap    | ClassDecorator  |            | Application startup class     |
| @Controller   | ClassDecorator  | string     | Prefix for request route      |
| @Component    | ClassDecorator  |            | Define a component            |
| @Interceptor   | ClassDecorator |            | Define a interceptor          |
| @ErrorHandler | MethodDecorator |            |                               |
| @Autowired    | PropertyDecorator |          | Inject components             |
| @Get          | MethodDecorator | string     | Route path                    |
| @Post         | MethodDecorator | string     | Route path                    |
| @Put          | MethodDecorator | string     | Route path                    |
| @Delete       | MethodDecorator | string     | Route path                    |
| @Patch        | MethodDecorator | string     | Route path                    |
| @Head         | MethodDecorator | string     | Route path                    |
| @Options      | MethodDecorator | string     | Route path                    |
| @View         | MethodDecorator | string     | Template file path            |

### Context

Context is an instance passed to controllers, Interceptors and error handler, it
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
