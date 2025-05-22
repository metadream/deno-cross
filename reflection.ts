const store = new Map<Function, Map<PropertyKey, unknown>>();

/** Define metadata (Deep merge the same keys) */
export function defineMetadata(target: Function, propertyKey: PropertyKey, payload: unknown): void {
    let metadata = store.get(target);
    if (!metadata) {
        metadata = new Map();
        store.set(target, metadata);
    }
    const origin = metadata.get(propertyKey);
    metadata.set(propertyKey, origin ? deepMerge(origin, payload) : payload);
}

/** Get metadata */
export function getMetadata(target: Function, propertyKey?: PropertyKey): unknown {
    const metadata = store.get(target);
    return propertyKey ? metadata?.get(propertyKey) : metadata;
}

/** Get all metadata */
export function getAllMetadata() {
    return store;
}

/** Deep merge multiple objects */
export function deepMerge(...objects: any[]): any {
    return objects.reduce((acc, current) => {
        if (!current) return acc;

        Object.keys(current).forEach((key) => {
            const accValue = acc[key];
            const currentValue = current[key];

            if (isPlainObject(accValue) && isPlainObject(currentValue)) {
                acc[key] = deepMerge(accValue, currentValue);
            } else if (Array.isArray(accValue) && Array.isArray(currentValue)) {
                acc[key] = [...accValue, ...currentValue];
            } else if (currentValue !== undefined) {
                acc[key] = currentValue;
            }
        });

        return acc;
    }, {});
}

/** Determines whether the value is a plain object */
export function isPlainObject(value: unknown) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Determines whether the value is a class constructor */
export function isClassConstructor(value: unknown): boolean {
    if (typeof value !== "function") return false;
    const fnStr = value.toString();
    return (
        (fnStr.startsWith("class ") || /^\s*class\b/.test(fnStr)) &&
        value.prototype?.constructor === value
    );
}

/**
 * Get built-in metadata like design:xxx
 * The premise is to create the `deno.json` file and set the compile options
 * `emitDecoratorMetadata` true.
 */
Object.assign(Reflect, {
    metadata: (metadataKey: string | symbol, metadataValue: unknown) => {
        return (target: any, propertyKey?: PropertyKey): void => {
            propertyKey = propertyKey || "constructor"
            if (isClassConstructor(target.constructor)) {
                target = target.constructor
            }
            // Only the built-in metadata of the class is obtained
            if (isClassConstructor(target) && ["string", "symbol"].includes(typeof propertyKey)) {
                defineMetadata(target, propertyKey, { [metadataKey]: metadataValue })
            }
        };
    }
});