// shared/command-map-key.ts
//
// D-CF3-03: the rules that decide whether a key of an object-map `commands`
// declaration can name a command. The commands bridge names the command from
// the key and the skills bridge hides a skill behind it (D-CF2-03), so both
// read one copy of the rules.

// Claude Code 2.1.316 refuses a command name that ends in `:` or holds `<`,
// `>`, a blank, or a hidden or direction-changing character. `\p{Cf}` is the
// Unicode class of those format characters.
const MAP_KEY_RULES: readonly { readonly pattern: RegExp; readonly reason: string }[] = [
  { pattern: /:$/u, reason: 'ends with ":"' },
  { pattern: /[<>]/u, reason: 'holds "<" or ">"' },
  { pattern: /\s/u, reason: "holds whitespace" },
  { pattern: /\p{Cf}/u, reason: "holds a hidden or direction-changing character" },
];

/** Why `key` cannot name a command, or `undefined` when these rules accept it. */
export function commandMapKeyRefusal(key: string): string | undefined {
  return MAP_KEY_RULES.find(({ pattern }) => pattern.test(key))?.reason;
}
