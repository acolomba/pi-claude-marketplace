// shared/own-key.ts
//
// State maps are plain objects keyed by user and manifest names (D-08-07).
// Reads take own keys only, so `constructor` or `toString` names no record.
// Writes define own properties, so a `__proto__` key never runs the inherited
// `Object.prototype` setter, which would reparent the map and drop the record.

/** Returns the value under an own key of `map`, or undefined when `map` or the key is absent. */
export function ownValue<T>(
  map: Readonly<Record<string, T>> | undefined,
  key: string,
): T | undefined {
  return map !== undefined && Object.hasOwn(map, key) ? map[key] : undefined;
}

/** Stores `value` under `key` as an own enumerable data property of `map`. */
export function setOwn<T>(map: Record<string, T>, key: string, value: T): void {
  Object.defineProperty(map, key, { value, enumerable: true, writable: true, configurable: true });
}
