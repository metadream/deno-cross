// Embeddable Javascript (XML-like) Syntax Extension
declare global {
    namespace JSX {
        // deno-lint-ignore no-explicit-any
        type Element = any;
        type IntrinsicElements = { [tag: string]: unknown; }
        type ElementChildrenAttribute = { children: []; }
    }
}

type Litaral = string | number;
type NodeSet = Node | Litaral | false | null | (Node | Litaral | false | null)[];

type Component<P = unknown> = {
    (props: P): NodeSet;
}

// deno-lint-ignore no-explicit-any
export type Node<P = any> = {
    tag: Component<P>;
    props: P & Children;
}

type Children = {
    children?: (Node | Litaral | false | null)[];
}

export const h = (
    tag: Component | string,
    props?: { [prop: string]: unknown },
    ...children: (Node | Litaral | false | null)[]
) => {
    return { tag, props: { ...props, children } };
}

export const Fragment = ({ children }: Children) => {
    return children;
}

export const renderJsx = (jsx: Node) => {
    if (typeof jsx.tag === "function") {
        return renderToString(jsx.tag(jsx.props));
    }

    // Render props
    const props = Object.entries(jsx.props).map((
        [prop, value]: [string, unknown],
    ): string => {
        switch (prop) {
            case "dangerouslySetInnerHTML":
            case "children": return "";
            case "style":
                return ` style="${renderCss(value as string | [string, Litaral])}"`;
            default:
                return ` ${prop}="${"".concat(value as string).replace(/\"/g, '\\"')}"`;
        }
    }).join("");

    // Render inner HTML
    const children = jsx.props?.children ?? [];
    let innerHTML = "";
    if (jsx.props.dangerouslySetInnerHTML != null) {
        innerHTML = jsx.props.dangerouslySetInnerHTML?.__html ?? "";
    } else {
        innerHTML = jsx.tag === "script" ? children : renderToString(children);
    }

    // Render HTML tag
    switch (jsx.tag) {
        case "area":
        case "base":
        case "basefont":
        case "br":
        case "col":
        case "embed":
        case "hr":
        case "img":
        case "input":
        case "keygen":
        case "link":
        case "meta":
        case "param":
        case "source":
        case "spacer":
        case "track":
        case "wbr":
            return `<${jsx.tag}${props} />`;
        default:
            return `<${jsx.tag}${props}>${innerHTML}</${jsx.tag}>`;
    }
}

const renderToString = (nodes: NodeSet): string => {
    if (nodes === undefined || nodes === null) { // not ZERO
        return "";
    }
    if (typeof nodes !== "object") {
        return escape(`${nodes}`);
    }
    if (Array.isArray(nodes)) {
        return (nodes.map((child: NodeSet): string => renderToString(child))).join("");
    }
    return renderJsx(nodes);
}

const renderCss = (props: string | [string, Litaral]) => {
    if (typeof props === "string") return props;
    return Object.entries(props).map(([prop, value]) => (
        `${toKebabCase(prop)}: ${value}`
    )).join("; ");
}

// Convert camelCase to kebab-case
const toKebabCase = (str: string) => {
    return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}

const escape = (html: string): string => {
    const HTML_ENTITIES: { [char: string]: string } = {
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&#39;",
        '"': "&#34;",
    };
    return html.replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
}