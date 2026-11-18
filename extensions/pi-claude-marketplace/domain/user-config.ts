// domain/user-config.ts
//
// The parser and resolver for a plugin's `userConfig` field (PG-CORE-03). The
// manifest schema keeps that field `Type.Unknown()`, so any shape can arrive
// and the parser accepts `unknown` at its boundary.
//
// D-PG10-05: the field is parsed against Claude Code 2.1.323's own schema,
// strict and whole. A value that does not parse is malformed, and the detail
// names the first bad key or field. A `default` of any of the four upstream
// value types is accepted whatever the option's `type` says (D-PG10-20).
//
// D-PG10-19: the resolver keeps the values that hooks and content read apart
// from the values that MCP fields read, because Claude Code 2.1.323 applies a
// default to MCP config only.
//
// The module is in `domain/` because it is pure: no I/O, no clock, and no
// `process.env`. Option keys can be `__proto__` or `constructor`, so input is
// read with `Object.entries` and every map it returns is a `Map` or a `Set`.

import { createHash } from "node:crypto";

import Type from "typebox";
import { Compile } from "typebox/compile";

import type { Scope } from "../shared/types.ts";

const OPTION_SCHEMA = Type.Object(
  {
    type: Type.Union([
      Type.Literal("string"),
      Type.Literal("number"),
      Type.Literal("boolean"),
      Type.Literal("directory"),
      Type.Literal("file"),
    ]),
    title: Type.String(),
    description: Type.String(),
    required: Type.Optional(Type.Boolean()),
    default: Type.Optional(
      Type.Union([Type.String(), Type.Number(), Type.Boolean(), Type.Array(Type.String())]),
    ),
    multiple: Type.Optional(Type.Boolean()),
    sensitive: Type.Optional(Type.Boolean()),
    min: Type.Optional(Type.Number()),
    max: Type.Optional(Type.Number()),
    options: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

const OPTION_VALIDATOR = Compile(OPTION_SCHEMA);

const KNOWN_FIELDS: ReadonlySet<string> = new Set(Object.keys(OPTION_SCHEMA.properties));

const REQUIRED_FIELDS = ["type", "title", "description"] as const;

/** One declared option, as Claude Code 2.1.323's schema admits it. */
export type UserConfigOption = Type.Static<typeof OPTION_SCHEMA>;

/** A parsed `userConfig`: plain JSON data, safe to store on a record. */
export type UserConfigSchema = Readonly<Record<string, UserConfigOption>>;

export type UserConfigParse =
  | { readonly kind: "ok"; readonly schema: UserConfigSchema }
  | { readonly kind: "malformed"; readonly detail: string };

/** The options of one plugin, resolved from its declared defaults. */
export interface ResolvedOptions {
  /** False for a plugin that declares no `userConfig`. */
  readonly declared: boolean;
  /**
   * What hooks and content read: each declared default, as text. Claude Code
   * 2.1.323 gives hooks and content saved values only. Treating a declared
   * default as a saved value here is this project's rule under D-PG10-19.
   */
  readonly values: ReadonlyMap<string, string>;
  /**
   * What MCP fields read, as Claude Code 2.1.323 builds it: each declared
   * default, and the empty string for an option that is not required and has
   * no default (D-PG10-21).
   */
  readonly mcpValues: ReadonlyMap<string, string>;
  /** Keys with `required: true` and no default, in declaration order (D-PG10-06). */
  readonly unsetRequired: readonly string[];
  readonly sensitive: ReadonlySet<string>;
  /**
   * D-PG10-25: set only on the options of an install record whose stored
   * `userConfig` does not parse. They declare options with no values, so
   * every pass that names an option refuses it, and a hook says why.
   */
  readonly unreadable?: true;
}

/** The four strings that name one option's process variable (D-PG10-23). */
export interface OwnedOptionAddress {
  readonly scope: Scope;
  readonly marketplace: string;
  readonly plugin: string;
  readonly key: string;
}

/** The option key pattern, verbatim from the Claude Code 2.1.323 binary. */
const OPTION_KEY = /^[A-Za-z_]\w*$/;

/** The reference pattern, verbatim from the Claude Code 2.1.323 binary. */
const USER_CONFIG_REFERENCE = /\$\{user_config\.([^}]+)\}/g;

// The hook variable's unsafe characters, verbatim from the Claude Code 2.1.323
// binary.
// eslint-disable-next-line sonarjs/concise-regex -- kept verbatim from Claude Code
const HOOK_NAME_UNSAFE = /[^A-Za-z0-9_]/g;

/**
 * The characters an `options` value may not hold, verbatim from the Claude
 * Code 2.1.323 binary. Upstream also drops a lone surrogate before it compares.
 */
const HIDDEN_CHARACTER =
  /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}\u2800]|(?!\u0020)\p{Zs}/u;

const LONE_SURROGATE = /[\uD800-\uDFFF]/u;

const OPTION_VALUE_LIMIT = 64;

const HOOK_VARIABLE_PREFIX = "CLAUDE_PLUGIN_OPTION_";

/** The start of every process variable name this extension owns for an option (D-PG10-23). */
export const OWNED_VARIABLE_PREFIX = "PI_CLAUDE_MARKETPLACE_OPTION_";

const OWNED_HASH_LENGTH = 16;

interface ValueRule {
  readonly fails: (value: string) => boolean;
  readonly message: string;
}

// Claude Code 2.1.323's rules for one `options` value, in its order.
const OPTION_VALUE_RULES: readonly ValueRule[] = [
  { fails: (value) => value.length === 0, message: "An option cannot be empty" },
  {
    fails: (value) => value.length > OPTION_VALUE_LIMIT,
    message: "An option can be at most 64 characters",
  },
  {
    fails: (value) => HIDDEN_CHARACTER.test(value) || LONE_SURROGATE.test(value),
    message: "An option cannot contain control, invisible or bidirectional-formatting characters",
  },
  {
    fails: (value) => value.trim() !== value,
    message: "An option cannot start or end with a space",
  },
];

type OptionCheck =
  | { readonly kind: "ok"; readonly option: UserConfigOption }
  | { readonly kind: "malformed"; readonly detail: string };

function isObjectMap(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function quoted(text: string): string {
  return JSON.stringify(text);
}

function malformedOption(key: string, problems: readonly string[]): OptionCheck {
  return { kind: "malformed", detail: `userConfig option ${quoted(key)}: ${problems.join(", ")}` };
}

function declaredFieldProblems(field: string, invalid: ReadonlySet<string>): string[] {
  if (!KNOWN_FIELDS.has(field)) {
    return [`field ${quoted(field)} is not a known field`];
  }

  return invalid.has(field) ? [`field ${quoted(field)} is not valid`] : [];
}

/** Every field problem of an option the schema refuses, in declaration order. */
function fieldProblems(option: Readonly<Record<string, unknown>>): string[] {
  const invalid = new Set<string>();
  for (const error of OPTION_VALIDATOR.Errors(option)) {
    invalid.add(error.instancePath.split("/")[1] ?? "");
  }

  return [
    ...Object.keys(option).flatMap((field) => declaredFieldProblems(field, invalid)),
    ...REQUIRED_FIELDS.filter((field) => !Object.hasOwn(option, field)).map(
      (field) => `field ${quoted(field)} is missing`,
    ),
  ];
}

function optionValueProblems(options: readonly string[]): string[] {
  const problems = options.flatMap((value, index) =>
    OPTION_VALUE_RULES.filter((rule) => rule.fails(value)).map(
      (rule) => `field "options" value ${index}: ${rule.message}`,
    ),
  );
  if (options.length === 0) {
    problems.unshift('field "options": options needs at least one value');
  }

  if (new Set(options.map((value) => value.toLowerCase())).size !== options.length) {
    problems.push('field "options": options cannot repeat a value (in any letter case)');
  }

  return problems;
}

function optionUseProblems(option: UserConfigOption, options: readonly string[]): string[] {
  if (option.type !== "string" || option.multiple === true || option.sensitive === true) {
    return [
      'field "options": options is only for a field of type "string" that is neither multiple nor sensitive',
    ];
  }

  if (option.default === undefined) {
    return option.required === true
      ? []
      : ['field "default": a field with options needs a default among them, or required: true'];
  }

  return typeof option.default === "string" && options.includes(option.default)
    ? []
    : [`field "default": default must be one of the options: ${options.join(", ")}`];
}

function checkOption(key: string, option: unknown): OptionCheck {
  if (!isObjectMap(option)) {
    return { kind: "malformed", detail: `userConfig option ${quoted(key)} is not an object` };
  }

  if (!OPTION_VALIDATOR.Check(option)) {
    return malformedOption(key, fieldProblems(option));
  }

  const problems =
    option.options === undefined
      ? []
      : [...optionValueProblems(option.options), ...optionUseProblems(option, option.options)];

  return problems.length > 0 ? malformedOption(key, problems) : { kind: "ok", option };
}

/** Parses a declared `userConfig` value, strict and whole (D-PG10-05, D-PG10-20). */
export function parseUserConfig(value: unknown): UserConfigParse {
  if (!isObjectMap(value)) {
    return { kind: "malformed", detail: "userConfig is not an object" };
  }

  const entries: [string, UserConfigOption][] = [];
  for (const [key, option] of Object.entries(value)) {
    if (!OPTION_KEY.test(key)) {
      return { kind: "malformed", detail: `userConfig key ${quoted(key)} is not an identifier` };
    }

    const checked = checkOption(key, option);
    if (checked.kind === "malformed") {
      return checked;
    }

    entries.push([key, checked.option]);
  }

  // `Object.fromEntries` defines each key as an own property, so an option
  // named `__proto__` stays an option.
  return { kind: "ok", schema: Object.fromEntries(entries) };
}

/** Resolves each option of a parsed `userConfig` to its default (D-PG10-06, D-PG10-07). */
export function resolveOptions(schema: UserConfigSchema | undefined): ResolvedOptions {
  const values = new Map<string, string>();
  const mcpValues = new Map<string, string>();
  const unsetRequired: string[] = [];
  const sensitive = new Set<string>();
  for (const [key, option] of Object.entries(schema ?? {})) {
    if (option.sensitive === true) {
      sensitive.add(key);
    }

    if (option.default !== undefined) {
      values.set(key, String(option.default));
      mcpValues.set(key, String(option.default));
    } else if (option.required === true) {
      unsetRequired.push(key);
    } else {
      mcpValues.set(key, "");
    }
  }

  return { declared: schema !== undefined, values, mcpValues, unsetRequired, sensitive };
}

/**
 * The options a content or MCP pass reads, or `undefined` for a plugin that
 * declares no `userConfig`. Claude Code runs no option pass for such a plugin,
 * so its references stay as written (D-PG10-21).
 */
export function declaredOptions(options: ResolvedOptions): ResolvedOptions | undefined {
  return options.declared ? options : undefined;
}

/**
 * Replaces each `${user_config.KEY}` in one pass. Text that `replace` returns
 * is not scanned again.
 */
export function replaceUserConfigReferences(
  text: string,
  replace: (key: string, matched: string) => string,
): string {
  return text.replaceAll(USER_CONFIG_REFERENCE, (matched, key: string) => replace(key, matched));
}

/** The hook variable of an option key, as Claude Code 2.1.323 names it. */
export function hookOptionVariableName(key: string): string {
  return `${HOOK_VARIABLE_PREFIX}${key.replaceAll(HOOK_NAME_UNSAFE, "_").toUpperCase()}`;
}

/** The process variable this extension sets for one option (D-PG10-23). */
export function ownedOptionVariableName(address: OwnedOptionAddress): string {
  const joined = [address.scope, address.marketplace, address.plugin, address.key].join("\0");
  const hex = createHash("sha256").update(joined).digest("hex").slice(0, OWNED_HASH_LENGTH);
  return `${OWNED_VARIABLE_PREFIX}${hex}`;
}
