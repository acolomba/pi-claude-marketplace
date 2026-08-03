// bridges/mcp/safe-set.ts
//
// Assign an attacker-influenced string key onto a fresh accumulator as an own
// data property. A literal `__proto__` key -- which `JSON.parse` materializes
// as a real own-enumerable property -- must NOT be written via `out[key] =
// value`: that routes it through the inherited `Object.prototype` `__proto__`
// setter, reparenting the accumulator and dropping the entry. Both the deep
// value walk (substitute.ts) and the server-name accumulator loops (stage.ts)
// copy `JSON.parse`d keys verbatim and share this guard so they cannot drift
// (WR-01).

/** Copy `value` onto `out` under `key`, treating a literal `__proto__` key as an own data property. */
export function safeSet(out: Record<string, unknown>, key: string, value: unknown): void {
  if (key === "__proto__") {
    Object.defineProperty(out, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true,
    });
  } else {
    out[key] = value;
  }
}
