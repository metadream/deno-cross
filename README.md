# Cross Web Framework

Cross is a compact, high-performance and full-featured web server framework based on Deno. It is designed with
ease of use in mind and centered around decorators, it provides essential functionalities required by a foundational
framework, including a template engine, route control, interceptors, error handling, dependency injection, and more.

## Installation

Enter your project root directory and add Cross framework dependencies:

```bash
deno add jsr:@focal/cross
```

Although TypeScript 5.0+ supports ECMAScript standard decorators (Stage 3 proposal), the new decorators are currently
incompatible with `--emitDecoratorMetadata` and do not support parameter decorators. Therefore, this framework still
uses the legacy decorator syntax, and requires additional compilation options in `deon.json`. The final complete
configuration is as follows:

```json
{
    "compilerOptions": {
        "experimentalDecorators": true,
        "emitDecoratorMetadata": true
    },
    "imports": {
        "@focal/cross": "jsr:@focal/cross@^1.0.0"
    }
}
```

## Get Started

1. Create `main.ts` (or any other file) as the application entry point. Controllers must be imported in the entry file
   to activate decorators  (Note: There's no need to manually import other decorator-dependent modules)

```typescript
import { Application } from "@focal/cross";
import { Cross } from "@focal/cross/decorators";
import "./controller.ts";

@Cross
export default class {
    constructor(app: Application) {
        app.run();
    }
}
```

2. Create `controller.ts` and `service.ts`. Parameters on route methods are optional and order-independent, with details
   as follows:

```typescript
import { UserService } from "./service.ts";

@Controller("/user")
export class UserController {
    @Autowired                  // Injects UserService instance
    private userService!: UserService;
    
    @Get("/:id")                // Route path
    @Template("user.html")      // Template path (if set, automatically renders template with return value; otherwise returns JSON)
    getUser(
        @Param id: number,      // Injects route parameter
        @Query name: string,    // Injects query parameter
        @Body user: User,       // Injects request body
        request: HttpRequest,   // Injects request object
        response: HttpResponse, // Injects response object
        cookie: HttpCookie,     // Injects cookies
        session: HttpSession    // Injects session
    ): User {
        return this.userService.getUser(id);
    }
}
```

```typescript
@Component
export class UserService {
    getUser(id: number): User {
        return { id, name: "Marco" }
    }
}
```

3. Start the application with `deno run --allow-all main.ts`.

## Advanced Usage

1. Loading Configuration Files: Add the following line in the main file constructor, then you can inject the Config
   instance in other modules:

```typescript
// main.ts
app.config("./config.yaml");
```

```typescript
// service.ts
@Autowired
private config!: Config;
```

2. Setting Template Options: Add the following line in the main file constructor. The first parameter is the root
   directory of templates (after setting this, the @Template decorator only needs a relative path). The second parameter
   injects global properties or methods into templates, which can be accessed in all templates.

```typescript
// main.ts
app.templates("./example/templates", {});
```

3. Serving Static Resources: Add the following line in the main file constructor. The first parameter is the request
   path for resources, and the second is the actual file path.

```typescript
// main.ts
app.resources("/assets", "./example/assets");
```

4. Setting Interceptors & Global Error Handling: Create a `midware.ts` file. Both @Interceptor and @ErrorHandler
   decorators must be inside an @Middleware module to take effect:

```typescript
@Middleware
export class Midware {

    // Multiple interceptors can be defined - execution order follows numerical value (smallest first)
    @Interceptor()  
    auth(request: HttpRequest, session: HttpSession) {  // 可注入参数除了没有装饰器参数外，和控制器路由一致
        if (request.pathname != "/user/login") {
            const user = session.get("principal");
            Assert.isTrue(user, STATUS_CODE.Unauthorized);
        }
    }

    // The single global error handler. Parameter meaning:
    // If response content-type is text/html, renders the error.html template
    @ErrorHandler("error.html")  
    error(error: HttpError) {  // // Parameters match controller routes (plus HttpError)
        const err: any = error.toJSON();
        err.timestamp = Date.now();
        return err;
    }
}
```

## API References

### Application
- `app.config(path:string)`
- `app.resources(fsPath: string, fsRoot: string)`
- `app.templates(path:string, attributes?:any)`
- `app.run(hostOrPort?: string | number, port?: number)`

### Decorators
| name           | type              | parameters | parameter description    |
|----------------|-------------------|------------|--------------------------|
| @Cross         | ClassDecorator    | none       |                          |
| @Middleware    | ClassDecorator    | none       |                          |
| @Controller    | ClassDecorator    | string     | The prefix of route path |
| @Component     | ClassDecorator    | none       |                          |
| @Autowired     | PropertyDecorator | none       |                          |
| @Get           | MethodDecorator   | string     | Route path               |
| @Post          | MethodDecorator   | string     | Route path               |
| @Put           | MethodDecorator   | string     | Route path               |
| @Delete        | MethodDecorator   | string     | Route path               |
| @Patch         | MethodDecorator   | string     | Route path               |
| @Head          | MethodDecorator   | string     | Route path               |
| @Options       | MethodDecorator   | string     | Route path               |
| @Template      | MethodDecorator   | string     | Template file path       |
| @Interceptor   | MethodDecorator   | number     | Execution order          |
| @ErrorHandler  | MethodDecorator   | none       |                          |

### HttpRequest
In addition to inheriting all properties and methods from the native Request object, the following three extended
properties are provided for convenient access:
- `uri: URL`
- `pathname: string`
- `query: {}`

### HttpResponse
Extending the native ResponseInit, the framework provides the following additional configurable properties:
- `headers?: HeadersInit`
- `status?: number`
- `statusText?: string`
- `body?: BodyInit | Response | null | undefined`

### HttpCookie
- `get(name?: string)`
- `set(name: string, value: string, options?: Cookie)`
- `delete(name: string, attributes?: { path?: string; domain?: string })`

### HttpSession
- `get<T>(key: string)`
- `set(key: string, value: unknown)`
- `delete(key: string)`

## Template Syntax

- `{{= }}` Interpolation.

- `{{ }}` Evaluate code snippet in javascript. Note that the variables do not need to be declared.
```
{{ result = 60*60; }}
<div>{{= result }}</div>
```

- `{{? }} {{?? }} {{? }}` Conditional statement.

```
{{? gender == 0 }}
  <div>Female</div>
{{?? gender == 1 }}
  <div>Male</div>
{{?? }}
  <div>Unknown</div>
{{? }}
```

- `{{~ }} {{~ }}` Iterative statement.

```
<ul>
{{~ users:user:index }}
  <li>{{= index+1 }} - {{= user.name }}<li>
{{~ }}
</ul>
```

- `{{> }}` Block placeholder.
- `{{< }}` Block content definition.

The above two syntaxes can belong to two different files and only need to be included.
```
{{> content }}

{{< content }}
  <h1>Hello spring.</h1>
{{< }}
```

- `{{@ }}` Partial including in layout mode.

```
// header.html
<h1>Hello spring.</h1>

// index.html
{{@ header.html }}
```