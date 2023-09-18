# Built-in Template Engine

A compact, high-performance and full-featured template engine. References and
thanks [doT](https://github.com/olado/doT),
[EasyTemplateJS](https://github.com/ushelp/EasyTemplateJS).

## Syntax

- `{{ }}` Evaluate code snippet in javascript. Note that the variables do not
  need to be declared. ex. `{{ result = 60*60; }}`

- `{{= }}` Interpolation. ex. `{{= username }}`

- `{{? }} {{?? }} {{? }}` Conditional statement. ex.

```
{{? gender == 0 }}
  <div>Female</div>
{{?? gender == 1 }}
  <div>Male</div>
{{?? }}
  <div>Unknown</div>
{{? }}
```

- `{{~ }} {{~ }}` Iterative statement. ex.

```
<ul>
{{~ users:user:index }}
  <li>{{= index+1 }} - {{= user.name }}<li>
{{~ }}
</ul>
```

- `{{> }}` Block placeholder.
- `{{< }}` Block content definition.

```
{{> content }}

{{< content }}
  <h1>Hello tmplet.</h1>
{{< }}
```

- `{{@ }}` Partial including in layout mode. You must be rendered by
  `view(file, data)` method.

```
// index.html
{{@ header.html }}

// header.html
<h1>Hello tmplet.</h1>
```

## Reserved

- `{{! }}`
- `{{# }}`
- `{{$ }}`
- `{{% }}`
- `{{^ }}`
- `{{& }}`
- `{{+ }}`
- `{{- }}`
- `{{* }}`

## Methods

- `init(templateRootPath: string)` Initialize custom options（not necessary). relative to the project root, default ""
- `import(attribute: object)` Custom global properties or functions, default {}
- `compile(tmpl)` Compile the specify template text to a function.
- `render(tmpl, data)` Compile and render the template with data.
- `view(file, data)` Render the template file with data (using cache).
