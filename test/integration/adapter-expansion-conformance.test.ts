// test/integration/adapter-expansion-conformance.test.ts
//
// AVAR-03: every value this extension writes into a plugin MCP entry comes out
// of pi-mcp-adapter as Claude Code's value. Each row of the shared expansion
// table runs through the adapter's real call chain for its field, with
// `PI_CLAUDE_MARKETPLACE_EMPTY=""` set as the extension sets it in Pi's
// process. A bounded-exhaustive property runs short adversarial values through
// the real `interpolateEnvVars`, and a drift guard pins the adapter code the
// escape relies on. AVAR-05: no deny-listed credential reaches the adapter's
// url or headers output.
//
// pi-mcp-adapter is an optional peer. The test imports its compiled `dist/`
// modules in place from the declared floor that
// `scripts/install-test-peers.mjs` installs, through pi-mcp-adapter-peer.ts. A
// missing or wrong-version adapter fails every case.
//
// `resolveCommandSecret` runs a value with a single leading `!` as a shell
// command, so the harness fails such a case before the call. The adapter's
// `resolveCommandSecret` and `extractOAuthConfig` read `process.env`; the
// test sets it only inside `withProcessEnv`, which restores every key.

import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  serializeLiteral,
  serializeSegments,
} from "../../extensions/pi-claude-marketplace/bridges/mcp/adapter-escape.ts";
import { substituteAndInject } from "../../extensions/pi-claude-marketplace/bridges/mcp/substitute.ts";
import { expandClaudeValue } from "../../extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts";
import { applyMcpAdapterEnv } from "../../extensions/pi-claude-marketplace/shared/session-env.ts";
import { EXPANSION_BUILTINS, EXPANSION_CASES } from "../bridges/mcp/expansion-cases.ts";

import {
  findPiMcpAdapterPackage,
  loadPiMcpAdapterModule,
  readPiMcpAdapterDist,
} from "./pi-mcp-adapter-peer.ts";

import type { OptionalPeer } from "./optional-peer.ts";
import type {
  PiMcpAdapterAuthFlow,
  PiMcpAdapterOAuthConfig,
  PiMcpAdapterUtils,
} from "./pi-mcp-adapter-peer.ts";
import type { McpSubstitutionContext } from "../../extensions/pi-claude-marketplace/bridges/mcp/substitute.ts";
import type {
  ClaudeBuiltins,
  Segment,
} from "../../extensions/pi-claude-marketplace/domain/claude-mcp-variables.ts";
import type { ExpansionField } from "../bridges/mcp/expansion-cases.ts";

const EMPTY_ENV_NAME = "PI_CLAUDE_MARKETPLACE_EMPTY";

type Environment = Readonly<Record<string, string>>;

type OAuthField = Extract<ExpansionField, `oauth.${string}`>;

const OAUTH_KEYS: Readonly<Record<OAuthField, keyof PiMcpAdapterOAuthConfig>> = {
  "oauth.clientId": "clientId",
  "oauth.scope": "scope",
  "oauth.authServerMetadataUrl": "authServerMetadataUrl",
};

/** The adapter package and the modules one case drives. */
interface Adapter {
  readonly peer: OptionalPeer;
  readonly utils: PiMcpAdapterUtils;
  readonly authFlow: PiMcpAdapterAuthFlow;
}

async function loadAdapter(): Promise<Adapter> {
  const peer = await findPiMcpAdapterPackage();
  return {
    peer,
    utils: await loadPiMcpAdapterModule<PiMcpAdapterUtils>(peer, "utils"),
    authFlow: await loadPiMcpAdapterModule<PiMcpAdapterAuthFlow>(peer, "mcp-auth-flow"),
  };
}

/** Runs `run` with `vars` assigned in `process.env`, then restores each key's prior state. */
function withProcessEnv<T>(vars: Environment, run: () => T): T {
  const saved = Object.keys(vars).map((name) => ({
    name,
    present: Object.hasOwn(process.env, name),
    previous: process.env[name],
  }));
  Object.assign(process.env, vars);
  try {
    return run();
  } finally {
    for (const { name, present, previous } of saved) {
      if (present && previous !== undefined) {
        process.env[name] = previous;
      } else {
        Reflect.deleteProperty(process.env, name);
      }
    }
  }
}

function commandSecretOutput(utils: PiMcpAdapterUtils, written: string, env: Environment): string {
  if (written.startsWith("!") && !written.startsWith("!!")) {
    throw new Error(`refusing to pass a single leading ! to resolveCommandSecret: ${written}`);
  }

  return withProcessEnv(env, () => utils.resolveCommandSecret(written, "conformance"));
}

function oauthOutput(
  authFlow: PiMcpAdapterAuthFlow,
  field: OAuthField,
  written: string,
  env: Environment,
): string {
  const key = OAUTH_KEYS[field];
  const config = withProcessEnv(env, () =>
    authFlow.extractOAuthConfig({ oauth: { [key]: written } }),
  );
  const output = config[key];
  if (output === undefined) {
    throw new Error(`extractOAuthConfig returned no ${key} for ${written}`);
  }

  return output;
}

/** Feeds one written value through the adapter's connect-time call chain for its field. */
function adapterOutput(
  adapter: Adapter,
  field: ExpansionField,
  written: string,
  runtimeEnv: Environment,
): string {
  const env: Environment = { ...runtimeEnv, [EMPTY_ENV_NAME]: "" };
  switch (field) {
    case "command":
      return adapter.utils.resolveConfigPath(written, env);
    case "args":
      return adapter.utils.expandHomePath(adapter.utils.interpolateEnvVars(written, env));
    case "env":
    case "env-builtin":
    case "headers":
      return commandSecretOutput(adapter.utils, written, env);
    case "url":
      return adapter.utils.resolveServerUrl({ url: written }, env);
    case "oauth.clientId":
    case "oauth.scope":
    case "oauth.authServerMetadataUrl":
      return oauthOutput(adapter.authFlow, field, written, env);
  }
}

for (const row of EXPANSION_CASES) {
  test(`AVAR-03: ${row.title} comes out of pi-mcp-adapter as Claude Code's value`, async () => {
    // arrange
    const adapter = await loadAdapter();
    // act
    const output = adapterOutput(adapter, row.field, row.written, row.runtimeEnv);

    // assert
    assert.strictEqual(output, row.claudeOutput);
  });
}

test("AVAR-03: a url split token needs PI_CLAUDE_MARKETPLACE_EMPTY set", async () => {
  // arrange
  const adapter = await loadAdapter();
  const url = "https://mcp.example.test/{env:{env:PI_CLAUDE_MARKETPLACE_EMPTY}PI_CM_SECRET}";

  // act
  const resolved = adapter.utils.resolveServerUrl(
    { url },
    { PI_CM_SECRET: "s", PI_CLAUDE_MARKETPLACE_EMPTY: "" },
  );

  // assert
  assert.strictEqual(resolved, "https://mcp.example.test/{env:PI_CM_SECRET}");
  assert.throws(
    () => adapter.utils.resolveServerUrl({ url }, { PI_CM_SECRET: "s" }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.strictEqual(
        error.message,
        "Missing environment variable in MCP server URL: PI_CLAUDE_MARKETPLACE_EMPTY",
      );
      return true;
    },
  );
});

/** One alphabet of the bounded-exhaustive property and its longest sequence. */
interface AdversarialAlphabet {
  readonly tokens: readonly string[];
  readonly maxLength: number;
}

// The alphabets of the research probe: single trigger characters plus kept
// references, then trigger fragments and `:-` defaults that end in a trigger.
// The third nests `:-` defaults, so Claude's install-time expansion leaves
// literal `${NAME:-default}` text, which pi-mcp-adapter 7.x expands (VER-04).
// Its `É` is a name character in neither grammar.
const ADVERSARIAL_ALPHABETS: readonly AdversarialAlphabet[] = [
  { tokens: ["$", "{", "}", "e", "n", "v", ":", "-", "K", "${R}", "${K}"], maxLength: 5 },
  {
    tokens: [
      "{env",
      "$en",
      "v:K",
      ":K}",
      "${A:-}",
      "${A:-{env}",
      "${R}",
      "${K}",
      "$",
      "{",
      "}",
      ":",
      "e",
      "n",
      "v",
    ],
    maxLength: 4,
  },
  {
    tokens: ["${B:-", "${A:-", "x", "}", "$", "{", ":-", "K", "${R}", "{env", "$env:", "É"],
    maxLength: 5,
  },
];

// A kept reference is "" or "x" when the adapter connects, or unset
// (`undefined`), so a reference with a default shows the default (D-CF1-13).
const RUNTIME_VARIANTS: readonly (string | undefined)[] = ["", "x", undefined];

// ((11 + 11^2 + ... + 11^5) + (15 + 15^2 + 15^3 + 15^4) + (12 + 12^2 + ... +
// 12^5)) values, three variants each, through both the expanded and the
// literal path: (177,155 + 54,240 + 271,452) x 3 x 2.
const EXPECTED_CHECKED_VALUES = 3_017_082;

const PROPERTY_INSTALL_ENV: Environment = { R: "r", K: "S" };

const PROPERTY_BUILTINS: ClaudeBuiltins = { pluginRoot: "", pluginData: "", projectDir: "" };

const REPORTED_MISMATCHES = 5;

/** One value where the adapter's output differs from Claude's. */
interface Mismatch {
  readonly raw: string;
  readonly variant: string | undefined;
  readonly written: string;
  readonly got: string;
  readonly want: string;
}

/** The checked-value count, the mismatch count, and the first mismatches. */
interface PropertyTally {
  checked: number;
  mismatches: number;
  readonly first: Mismatch[];
}

function appendSequences(
  values: string[],
  tokens: readonly string[],
  prefix: string,
  remaining: number,
): void {
  for (const token of tokens) {
    const value = prefix + token;
    values.push(value);
    if (remaining > 1) {
      appendSequences(values, tokens, value, remaining - 1);
    }
  }
}

function sequencesOf({ tokens, maxLength }: AdversarialAlphabet): string[] {
  const values: string[] = [];
  appendSequences(values, tokens, "", maxLength);
  return values;
}

// `K` is always `S`, so a literal `{env:K}` or `$env:K` that leaks shows as
// `S`. Every other kept reference gets the variant, or stays unset.
function runtimeFor(
  segments: readonly Segment[],
  variant: string | undefined,
): Record<string, string> {
  const runtime: Record<string, string> = {};
  for (const segment of segments) {
    if (segment.kind === "ref" && variant !== undefined) {
      runtime[segment.name] = variant;
    }
  }

  runtime.K = "S";
  return runtime;
}

// Claude's value at connect time: a reference's runtime value, else its
// default (D-CF1-13). A reference with neither is "", as the adapter writes
// it; the install reports that name missing.
function rendered(segments: readonly Segment[], runtime: Environment): string {
  return segments
    .map((segment) =>
      segment.kind === "text" ? segment.text : (runtime[segment.name] ?? segment.fallback ?? ""),
    )
    .join("");
}

function mismatchFor(
  utils: PiMcpAdapterUtils,
  raw: string,
  variant: string | undefined,
): Mismatch | undefined {
  const { segments } = expandClaudeValue(raw, "plain", PROPERTY_INSTALL_ENV, PROPERTY_BUILTINS);
  const written = serializeSegments(segments, false);
  const runtime = runtimeFor(segments, variant);
  const want = rendered(segments, runtime);
  const got = utils.interpolateEnvVars(written, { [EMPTY_ENV_NAME]: "", ...runtime });
  return got === want ? undefined : { raw, variant, written, got, want };
}

// A field Claude leaves unexpanded (an `oauth` value, for one) keeps `raw` as
// its value. Every name the alphabets use takes the variant at connect time,
// so a literal reference that leaks shows as the variant, its default, or `S`.
function literalMismatchFor(
  utils: PiMcpAdapterUtils,
  raw: string,
  variant: string | undefined,
): Mismatch | undefined {
  const written = serializeLiteral(raw, false);
  const runtime =
    variant === undefined ? { K: "S" } : { A: variant, B: variant, R: variant, K: "S" };
  const got = utils.interpolateEnvVars(written, { [EMPTY_ENV_NAME]: "", ...runtime });
  return got === raw ? undefined : { raw, variant, written, got, want: raw };
}

const PROPERTY_PATHS = [mismatchFor, literalMismatchFor];

function tallyCheck(tally: PropertyTally, mismatch: Mismatch | undefined): void {
  tally.checked += 1;
  if (mismatch !== undefined) {
    tally.mismatches += 1;
    if (tally.first.length < REPORTED_MISMATCHES) {
      tally.first.push(mismatch);
    }
  }
}

function tallyValue(tally: PropertyTally, utils: PiMcpAdapterUtils, raw: string): void {
  for (const variant of RUNTIME_VARIANTS) {
    for (const pathMismatchFor of PROPERTY_PATHS) {
      tallyCheck(tally, pathMismatchFor(utils, raw, variant));
    }
  }
}

for (const { state, runtimeEnv, claudeOutput } of [
  { state: "an unset", runtimeEnv: {}, claudeOutput: "info" },
  { state: "an empty", runtimeEnv: { PI_CM_LEVEL: "" }, claudeOutput: "" },
  { state: "a set", runtimeEnv: { PI_CM_LEVEL: "warn" }, claudeOutput: "warn" },
]) {
  test(`D-CF1-13: pi-mcp-adapter expands \${NAME:-default} as Claude does for ${state} variable`, async () => {
    // arrange
    const adapter = await loadAdapter();

    // act
    const output = adapter.utils.interpolateEnvVars("${PI_CM_LEVEL:-info}", runtimeEnv);

    // assert
    assert.strictEqual(output, claudeOutput);
  });
}

test("AVAR-03: pi-mcp-adapter outputs Claude's value for every short adversarial value", async () => {
  // arrange
  const adapter = await loadAdapter();
  const raws = ADVERSARIAL_ALPHABETS.flatMap((alphabet) => sequencesOf(alphabet));
  const tally: PropertyTally = { checked: 0, mismatches: 0, first: [] };

  // act
  for (const raw of raws) {
    tallyValue(tally, adapter.utils, raw);
  }

  // assert
  assert.deepStrictEqual(tally, { checked: EXPECTED_CHECKED_VALUES, mismatches: 0, first: [] });
});

// D-CF1-13: `${A:-` defaults that hold `$env:`, `{env`, `{env:` or a closed
// `}`, next to literal text that could complete a marker. `A` is unset at
// install, so a marker-free default reaches the adapter as `${A:-default}`
// and any other default is resolved at install.
const MARKER_DEFAULT_ALPHABET: AdversarialAlphabet = {
  tokens: ["${A:-", "$env:", "{env", "{env:", "}", "K", ":", "$", "e", "v:", "${R}"],
  maxLength: 5,
};

// (11 + 11^2 + ... + 11^5) values, three variants each, through both the
// expanded and the literal path: 177,155 x 3 x 2.
const EXPECTED_CHECKED_MARKER_DEFAULT_VALUES = 1_062_930;

test("D-CF1-13: pi-mcp-adapter outputs Claude's value for every short marker-default value", async () => {
  // arrange
  const adapter = await loadAdapter();
  const raws = sequencesOf(MARKER_DEFAULT_ALPHABET);
  const tally: PropertyTally = { checked: 0, mismatches: 0, first: [] };

  // act
  for (const raw of raws) {
    tallyValue(tally, adapter.utils, raw);
  }

  // assert
  assert.deepStrictEqual(tally, {
    checked: EXPECTED_CHECKED_MARKER_DEFAULT_VALUES,
    mismatches: 0,
    first: [],
  });
});

// Runtime values of a kept reference that end in a partial marker or in a
// marker that still lacks its name or its closing `}`.
const REFERENCE_VALUE_TAILS = [
  "$",
  "$e",
  "$en",
  "$env",
  "$env:",
  "{",
  "{e",
  "{en",
  "{env",
  "{env:",
  "{env:K",
];

// Plugin text after the reference: the marker completions, the characters
// beside them, and a second reference with the same value.
const COMPLETION_ALPHABET: AdversarialAlphabet = {
  tokens: ["env:", "nv:", "v:", ":", "K", "}", "$", "{", "/", "${R}"],
  maxLength: 3,
};

// 11 tails x (10 + 10^2 + 10^3) texts after `${R}`.
const EXPECTED_CHECKED_TAIL_VALUES = 12_210;

test("AVAR-05: plugin text after a reference cannot complete a marker that the reference's value begins", async () => {
  // arrange
  const adapter = await loadAdapter();
  const raws = sequencesOf(COMPLETION_ALPHABET).map((following) => `\${R}${following}`);
  const tally: PropertyTally = { checked: 0, mismatches: 0, first: [] };

  // act
  for (const tail of REFERENCE_VALUE_TAILS) {
    for (const raw of raws) {
      tallyCheck(tally, mismatchFor(adapter.utils, raw, tail));
    }
  }

  // assert
  assert.deepStrictEqual(tally, {
    checked: EXPECTED_CHECKED_TAIL_VALUES,
    mismatches: 0,
    first: [],
  });
});

// The defaults beside `${R}` that could complete, or begin, a marker with
// R's runtime value. A default holds no `}`.
const DEFAULT_COMPLETION_ALPHABET: AdversarialAlphabet = {
  tokens: ["env:", "nv:", "v:", ":", "K", "$", "{", "/"],
  maxLength: 3,
};

// Runtime values of R that complete a marker begun by a default before it.
const REFERENCE_VALUE_COMPLETIONS = ["env:K}", "nv:K}", "v:K}", ":K}", "K}", "}", "env:K", "v:K"];

// 11 tails x (8 + 8^2 + 8^3) defaults after `${R}`, plus 8 completions x
// (8 + 8^2 + 8^3) defaults before it.
const EXPECTED_CHECKED_DEFAULT_VALUES = 11_096;

// `A` stays unset when the adapter connects, so the adapter inserts its
// default next to R's runtime value.
function defaultMismatchFor(
  utils: PiMcpAdapterUtils,
  raw: string,
  referenceValue: string,
): Mismatch | undefined {
  const { segments } = expandClaudeValue(raw, "plain", PROPERTY_INSTALL_ENV, PROPERTY_BUILTINS);
  const written = serializeSegments(segments, false);
  const runtime = { R: referenceValue, K: "S" };
  const want = rendered(segments, runtime);
  const got = utils.interpolateEnvVars(written, { [EMPTY_ENV_NAME]: "", ...runtime });
  return got === want ? undefined : { raw, variant: referenceValue, written, got, want };
}

test("D-CF1-13: a default left to the adapter cannot form a marker with a reference's value", async () => {
  // arrange
  const adapter = await loadAdapter();
  const defaults = sequencesOf(DEFAULT_COMPLETION_ALPHABET);
  const runs = [
    ...REFERENCE_VALUE_TAILS.flatMap((tail) =>
      defaults.map((fallback) => ({ raw: `\${R}\${A:-${fallback}}`, referenceValue: tail })),
    ),
    ...REFERENCE_VALUE_COMPLETIONS.flatMap((completion) =>
      defaults.map((fallback) => ({ raw: `\${A:-${fallback}}\${R}`, referenceValue: completion })),
    ),
  ];
  const tally: PropertyTally = { checked: 0, mismatches: 0, first: [] };

  // act
  for (const { raw, referenceValue } of runs) {
    tallyCheck(tally, defaultMismatchFor(adapter.utils, raw, referenceValue));
  }

  // assert
  assert.deepStrictEqual(tally, {
    checked: EXPECTED_CHECKED_DEFAULT_VALUES,
    mismatches: 0,
    first: [],
  });
});

/** A deny-listed variable, the value it holds, and whether to also install with it unset. */
interface Credential {
  readonly name: string;
  readonly value: string;
  readonly unsetAtInstall: boolean;
}

// The base-URL value rule reads the value at install, so a credential added to
// ANTHROPIC_BASE_URL later is the documented residual and has no unset run.
const CREDENTIALS: readonly Credential[] = [
  ...[
    "ANTHROPIC_API_KEY",
    "AWS_SESSION_TOKEN",
    "OTEL_EXPORTER_OTLP_HEADERS",
    "INPUT_NPM_TOKEN",
    "GIT_CONFIG_VALUE_0",
    "CARGO_REGISTRIES_MY_REG_TOKEN",
    "CLAUDE_CODE_OAUTH_TOKEN",
  ].map((name) => ({ name, value: `sentinel-${name}`, unsetAtInstall: true })),
  {
    name: "ANTHROPIC_BASE_URL",
    value: "https://user:pass@api.example.test",
    unsetAtInstall: false,
  },
];

// (7 names x 2 install states + 1 name x 1 install state) x 8 forms.
const EXPECTED_CREDENTIAL_RUNS = 120;

// Kept references whose values end in a marker that plugin text can complete.
const MARKER_PREFIX_REFERENCES: Environment = {
  PI_CM_R: "",
  PI_CM_DOLLAR: "p$",
  PI_CM_BRACE: "p{env:",
};

function credentialForms(name: string): string[] {
  return [
    `Bearer \${${name}}`,
    `\${${name}:-fallback}`,
    `{env:${name}}`,
    `$env:${name}`,
    `{env\${PI_CM_R}:${name}}`,
    `$en\${PI_CM_R}v:${name}`,
    `\${PI_CM_DOLLAR}env:${name}`,
    `\${PI_CM_BRACE}${name}}`,
  ];
}

function installEnvironments(credential: Credential): Environment[] {
  const setAtInstall: Environment = {
    ...MARKER_PREFIX_REFERENCES,
    [credential.name]: credential.value,
  };
  return credential.unsetAtInstall ? [setAtInstall, MARKER_PREFIX_REFERENCES] : [setAtInstall];
}

function writtenRemoteValues(form: string, installEnv: Environment): [string, string] {
  const ctx: McpSubstitutionContext = { ...EXPANSION_BUILTINS, env: installEnv };
  const { entry } = substituteAndInject(
    { url: `https://mcp.example.test/?k=${form}`, headers: { Value: form } },
    ctx,
  );
  const { url, headers } = entry;
  const header: unknown =
    typeof headers === "object" && headers !== null && "Value" in headers
      ? headers.Value
      : undefined;
  if (typeof url !== "string" || typeof header !== "string") {
    throw new Error(`substituteAndInject wrote no url or header for ${form}`);
  }

  return [url, header];
}

function credentialLeaks(
  utils: PiMcpAdapterUtils,
  credential: Credential,
  form: string,
  installEnv: Environment,
): string[] {
  const [writtenUrl, writtenHeader] = writtenRemoteValues(form, installEnv);
  const runtimeEnv: Environment = {
    ...MARKER_PREFIX_REFERENCES,
    [credential.name]: credential.value,
    [EMPTY_ENV_NAME]: "",
  };
  const outputs = {
    url: utils.resolveServerUrl({ url: writtenUrl }, runtimeEnv),
    header: commandSecretOutput(utils, writtenHeader, runtimeEnv),
  };
  const installState = Object.hasOwn(installEnv, credential.name) ? "set" : "unset";
  return Object.entries(outputs)
    .filter(([, output]) => output.includes(credential.value))
    .map(([sink, output]) => `${credential.name} ${installState} ${form} ${sink}: ${output}`);
}

test("AVAR-05: no deny-listed credential reaches pi-mcp-adapter's url or headers output", async () => {
  // arrange
  const adapter = await loadAdapter();
  const runs = CREDENTIALS.flatMap((credential) =>
    installEnvironments(credential).flatMap((installEnv) =>
      credentialForms(credential.name).map((form) => ({ credential, form, installEnv })),
    ),
  );

  // act
  const leaks = runs.flatMap(({ credential, form, installEnv }) =>
    credentialLeaks(adapter.utils, credential, form, installEnv),
  );

  // assert
  assert.deepStrictEqual(
    { runs: runs.length, leaks },
    { runs: EXPECTED_CREDENTIAL_RUNS, leaks: [] },
  );
});

/** A working directory tail and the plugin text that completes it into a marker. */
interface PartialTriggerCwd {
  readonly cwd: string;
  readonly completion: string;
}

const PARTIAL_TRIGGER_CWDS: readonly PartialTriggerCwd[] = [
  { cwd: "/work/p$", completion: "env:" },
  { cwd: "/work/p$e", completion: "nv:" },
  { cwd: "/work/p$en", completion: "v:" },
  { cwd: "/work/p$env", completion: ":" },
  { cwd: "/work/p{", completion: "env:" },
  { cwd: "/work/p{e", completion: "nv:" },
  { cwd: "/work/p{en", completion: "v:" },
  { cwd: "/work/p{env", completion: ":" },
];

const PROJECT_DIR_CREDENTIAL = { ANTHROPIC_API_KEY: "sentinel-ANTHROPIC_API_KEY" };

function userScopeHeader(raw: string): string {
  const ctx: McpSubstitutionContext = {
    ...EXPANSION_BUILTINS,
    projectDir: undefined,
    env: PROJECT_DIR_CREDENTIAL,
  };
  const { entry } = substituteAndInject(
    { url: "https://mcp.example.test/", headers: { Value: raw } },
    ctx,
  );
  const header: unknown =
    typeof entry.headers === "object" && entry.headers !== null && "Value" in entry.headers
      ? entry.headers.Value
      : undefined;
  if (typeof header !== "string") {
    throw new Error(`substituteAndInject wrote no header for ${raw}`);
  }

  return header;
}

// The session export runs as the extension runs it. The header then goes
// through the adapter with the CLAUDE_PROJECT_DIR that export left.
function projectDirHeaderRun(
  utils: PiMcpAdapterUtils,
  { cwd, completion }: PartialTriggerCwd,
): { readonly cwd: string; readonly exported: boolean; readonly output: string } {
  const written = userScopeHeader(`\${CLAUDE_PROJECT_DIR}${completion}ANTHROPIC_API_KEY}`);
  return withProcessEnv({ CLAUDE_PROJECT_DIR: "", [EMPTY_ENV_NAME]: "" }, () => {
    const exported = applyMcpAdapterEnv(() => cwd);
    const projectDir = process.env.CLAUDE_PROJECT_DIR;
    const runtimeEnv: Environment =
      projectDir === undefined
        ? PROJECT_DIR_CREDENTIAL
        : { ...PROJECT_DIR_CREDENTIAL, CLAUDE_PROJECT_DIR: projectDir };
    return { cwd, exported, output: commandSecretOutput(utils, written, runtimeEnv) };
  });
}

test("AVAR-05: a cwd tail that plugin text after ${CLAUDE_PROJECT_DIR} completes into a marker leaks no credential", async () => {
  // arrange
  const adapter = await loadAdapter();
  const expectedRuns = PARTIAL_TRIGGER_CWDS.map(({ cwd, completion }) => ({
    cwd,
    exported: false,
    output: `${completion}ANTHROPIC_API_KEY}`,
  }));

  // act
  const runs = PARTIAL_TRIGGER_CWDS.map((row) => projectDirHeaderRun(adapter.utils, row));

  // assert
  assert.deepStrictEqual(runs, expectedRuns);
});

const DRIFT_MESSAGE =
  "pi-mcp-adapter's dist changed where the AVAR-03 variable escape depends on it. " +
  "Re-run this conformance test and re-verify the escape scheme in " +
  "bridges/mcp/adapter-escape.ts before changing the pi-mcp-adapter pin.";

const SERVER_MANAGER_CALL_SITES = [
  "resolveConfigPath(definition.command)",
  "expandHomePath(interpolateEnvVars(argument))",
  "resolveCommandSecretsRecord(definition.headers,",
  "resolveCommandSecretsRecord(env,",
];

const INTERPOLATION_PASSES = [
  String.raw`.replace(/\$\{(\w+)(?::-([^}]*))?\}/g,`,
  String.raw`.replace(/\$env:(\w+)/g,`,
  String.raw`.replace(/\{env:(\w+)\}/g,`,
];

const OAUTH_INTERPOLATIONS = [
  "interpolateEnvVars(definition.oauth.clientId)",
  "interpolateEnvVars(definition.oauth.scope)",
];

// The text from `export function <name>(` to the next top-level export.
function functionText(source: string, name: string): string {
  const start = source.indexOf(`export function ${name}(`);
  if (start === -1) {
    return "";
  }

  const end = source.indexOf("\nexport ", start + 1);
  return source.slice(start, end === -1 ? undefined : end);
}

function absentFrom(text: string, where: string, required: readonly string[]): string[] {
  return required.filter((needle) => !text.includes(needle)).map((needle) => `${where}: ${needle}`);
}

function passesInOrder(interpolate: string): boolean {
  const indexes = INTERPOLATION_PASSES.map((pass) => interpolate.indexOf(pass));
  const sorted = [...indexes].sort((left, right) => left - right);
  return !indexes.includes(-1) && indexes.every((index, position) => index === sorted[position]);
}

test("AVAR-03: pi-mcp-adapter's call sites and interpolation passes are the ones the escape relies on", async () => {
  // arrange
  const adapter = await loadAdapter();
  const serverManager = await readPiMcpAdapterDist(adapter.peer, "server-manager.js");
  const utils = await readPiMcpAdapterDist(adapter.peer, "utils.js");
  const authFlow = await readPiMcpAdapterDist(adapter.peer, "mcp-auth-flow.js");

  // act
  const missing = [
    ...absentFrom(serverManager, "server-manager.js", SERVER_MANAGER_CALL_SITES),
    ...absentFrom(functionText(utils, "resolveCommandSecret"), "resolveCommandSecret", [
      'if (value.startsWith("!!"))',
    ]),
    ...absentFrom(
      functionText(authFlow, "extractOAuthConfig"),
      "extractOAuthConfig",
      OAUTH_INTERPOLATIONS,
    ),
  ];
  const ordered = passesInOrder(functionText(utils, "interpolateEnvVars"));

  // assert
  assert.deepStrictEqual(
    { missing, passesInOrder: ordered },
    { missing: [], passesInOrder: true },
    DRIFT_MESSAGE,
  );
});

test("AVAR-03: pi-mcp-adapter home-expands a leading ~/ after interpolation, so no split token protects it", async () => {
  // arrange
  const adapter = await loadAdapter();
  // act
  const output = adapter.utils.expandHomePath(
    adapter.utils.interpolateEnvVars("{env:PI_CLAUDE_MARKETPLACE_EMPTY}~/x", {
      PI_CLAUDE_MARKETPLACE_EMPTY: "",
    }),
  );

  // assert
  assert.strictEqual(output, path.join(os.homedir(), "x"));
});
