// Architecture-level invariant pins for the MATCH-03 `if`-field
// permission-rule matcher primitives (D-61-01 / D-61-02 / D-61-03 /
// D-61-04).
//
// Each test in this file pins one load-bearing decision that is a
// single textual diff away from regression:
//
//   - `IF_PREFIX_TARGETS` keys + value shapes are exactly the four
//     upstream-faithful permission-rule prefix entries in locked order.
//     The `as const satisfies Record<string, IfPrefixTarget>` clause is
//     the load-bearing compile-time gate (D-61-03).
//   - `compileBashGlob` word-boundary + colon-sugar semantics match the
//     upstream truth-table rows verbatim.
//   - `parseBashSubcommands` strip / split / recurse contract matches
//     the upstream `code.claude.com/docs/en/permissions` § Process
//     wrappers / Compound commands tables verbatim (D-61-04).
//   - `compilePathGlob` anchor precedence matches the upstream Read /
//     Edit § "Path anchors" table verbatim.
//   - MCP literal / server-prefix kinds compose membership equality and
//     `startsWith` semantics; the truth-table rows are pinned.
//   - `IfPredicate` exhaustiveness pins the closed-set union shape so a
//     sixth `kind` literal red-fails the local switch (NFR-7).
//
// The architecture-test fixture rows are copied verbatim from the
// upstream truth tables snapshotted at research time. End-to-end blocks
// drive every row through `compileIfPredicate` (parse-time entry) and
// `ifFires` (dispatch-time consult), closing the MATCH-03 contract.

import assert from "node:assert/strict";
import test from "node:test";

import {
  bashSubcommandFires,
  compileBashGlob,
  compileIfPredicate,
  compilePathGlob,
  ifFires,
  MATCH_ALL_IF,
  parseBashSubcommands,
  type IfPredicate,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts";
import { IF_PREFIX_TARGETS } from "../../extensions/pi-claude-marketplace/domain/components/hook-if-targets.ts";
import {
  HOOKS_VALIDATOR,
  parseHooksConfig,
  parseMatcher,
} from "../../extensions/pi-claude-marketplace/domain/components/hooks.ts";

import type { BucketAEvent } from "../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
import type { ExtensionContext } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

// MATCH-03: synthetic path-anchor triple for compileIfPredicate /
// parseHooksConfig invocations. Stable across the file.
const TEST_IF_CTX = {
  homedir: "/home/u",
  cwd: "/projects/p",
  projectRoot: "/projects/p",
} as const;

// ──────────────────────────────────────────────────────────────────────────
// Block 1: IF_PREFIX_TARGETS closed-set introspection (D-61-03)
// ──────────────────────────────────────────────────────────────────────────

test("MATCH-03: IF_PREFIX_TARGETS keys are the upstream-faithful prefix closed set in locked order", () => {
  assert.deepEqual(
    Object.keys(IF_PREFIX_TARGETS),
    ["Bash", "Read", "Edit", "Write"],
    "IF_PREFIX_TARGETS keys are the upstream-faithful permission-rule prefix closed set -- shape and order are locked",
  );
});

test("MATCH-03: IF_PREFIX_TARGETS.Bash maps to Pi `bash` with command extraction", () => {
  assert.equal(IF_PREFIX_TARGETS.Bash.extractTarget, "command");
  assert.deepEqual([...IF_PREFIX_TARGETS.Bash.piEvents].sort(), ["bash"]);
});

test("MATCH-03: IF_PREFIX_TARGETS.Read covers Pi readers (read/grep/find/ls) with path extraction", () => {
  assert.equal(IF_PREFIX_TARGETS.Read.extractTarget, "path");
  assert.deepEqual(
    [...IF_PREFIX_TARGETS.Read.piEvents].sort(),
    ["find", "grep", "ls", "read"],
    "Read covers all Pi reader tools per upstream cross-tool semantic",
  );
});

test("MATCH-03: IF_PREFIX_TARGETS.Edit covers Pi editors (edit/write) with path extraction", () => {
  assert.equal(IF_PREFIX_TARGETS.Edit.extractTarget, "path");
  assert.deepEqual([...IF_PREFIX_TARGETS.Edit.piEvents].sort(), ["edit", "write"]);
});

test("MATCH-03: IF_PREFIX_TARGETS.Write narrows to Pi `write` only", () => {
  assert.equal(IF_PREFIX_TARGETS.Write.extractTarget, "path");
  assert.deepEqual([...IF_PREFIX_TARGETS.Write.piEvents].sort(), ["write"]);
});

// ──────────────────────────────────────────────────────────────────────────
// Block 2: compileBashGlob word-boundary truth table
// ──────────────────────────────────────────────────────────────────────────

const BASH_WORD_BOUNDARY_TABLE: ReadonlyArray<{
  readonly ifPattern: string;
  readonly bashCommand: string;
  readonly fires: boolean;
}> = [
  { ifPattern: "Bash(ls *)", bashCommand: "ls -la", fires: true },
  { ifPattern: "Bash(ls *)", bashCommand: "lsof", fires: false },
  { ifPattern: "Bash(ls*)", bashCommand: "ls -la", fires: true },
  { ifPattern: "Bash(ls*)", bashCommand: "lsof", fires: true },
];

function stripBashWrapper(ifPattern: string): string {
  return ifPattern.replace(/^Bash\(/, "").replace(/\)$/, "");
}

test("MATCH-03: compileBashGlob word-boundary table matches upstream", () => {
  for (const row of BASH_WORD_BOUNDARY_TABLE) {
    const pattern = stripBashWrapper(row.ifPattern);
    const glob = compileBashGlob(pattern);
    const actual = glob.test(row.bashCommand);
    assert.equal(
      actual,
      row.fires,
      `${row.ifPattern} vs "${row.bashCommand}" expected fires=${String(row.fires)}`,
    );
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block 3: compileBashGlob `:*` colon-sugar truth table (D-61-04)
// ──────────────────────────────────────────────────────────────────────────

const COLON_SUGAR_TABLE: ReadonlyArray<{
  readonly ifPattern: string;
  readonly bashCommand: string;
  readonly fires: boolean;
}> = [
  { ifPattern: "Bash(ls:*)", bashCommand: "ls -la", fires: true },
  { ifPattern: "Bash(ls:*)", bashCommand: "lsof", fires: false },
  // Mid-pattern `:` is a literal, NOT sugar -- so the resulting glob does
  // not match a plain `git push` because the literal colon never appears
  // in the subcommand.
  { ifPattern: "Bash(git:* push)", bashCommand: "git push", fires: false },
];

test("MATCH-03: compileBashGlob colon-sugar table matches upstream", () => {
  for (const row of COLON_SUGAR_TABLE) {
    const pattern = stripBashWrapper(row.ifPattern);
    const glob = compileBashGlob(pattern);
    const actual = glob.test(row.bashCommand);
    assert.equal(
      actual,
      row.fires,
      `${row.ifPattern} vs "${row.bashCommand}" expected fires=${String(row.fires)}`,
    );
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block 3b: Bash glob `*` MUST consume `/`-bearing arguments (CR-01)
// ──────────────────────────────────────────────────────────────────────────
//
// The shared `matchStar` helper short-circuits at `/` in path-glob mode
// (correct for `Read(*.ts)` which must not match `src/foo.ts`). Bash-glob
// mode passes `crossSegment=true` so `Bash(rm *)` matches `rm -rf /tmp/foo`
// -- path arguments are the most common Bash invocation shape. The fixture
// pins the regression so a future refactor that drops the crossSegment
// flag would red-fail rather than silently regress fail-CLOSED.

const BASH_PATH_ARG_TABLE: ReadonlyArray<{
  readonly ifPattern: string;
  readonly bashCommand: string;
  readonly fires: boolean;
  readonly reason: string;
}> = [
  {
    ifPattern: "Bash(rm *)",
    bashCommand: "rm -rf /tmp/foo",
    fires: true,
    reason: "star must consume `/` in Bash arguments (CR-01)",
  },
  {
    ifPattern: "Bash(cat *)",
    bashCommand: "cat /etc/passwd",
    fires: true,
    reason: "star must consume `/` in Bash arguments (CR-01)",
  },
  {
    ifPattern: "Bash(git push *)",
    bashCommand: "git push origin/main",
    fires: true,
    reason: "star must consume `/` in subcommand args (CR-01)",
  },
  {
    ifPattern: "Bash(find *)",
    bashCommand: "find ./src -name x",
    fires: true,
    reason: "star must consume `/` in Bash arguments (CR-01)",
  },
  {
    ifPattern: "Bash(ls *)",
    bashCommand: "lsof /var/log",
    fires: false,
    reason: "word-boundary preserved even with `/`-bearing args (CR-01)",
  },
];

test("MATCH-03: Bash glob star consumes `/`-bearing arguments (CR-01)", () => {
  for (const row of BASH_PATH_ARG_TABLE) {
    const glob = compileBashGlob(stripBashWrapper(row.ifPattern));
    const actual = glob.test(row.bashCommand);
    assert.equal(
      actual,
      row.fires,
      `${row.ifPattern} vs "${row.bashCommand}" expected fires=${String(row.fires)} -- ${row.reason}`,
    );
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block 4: parseBashSubcommands process-wrapper truth table (D-61-04)
// ──────────────────────────────────────────────────────────────────────────

const WRAPPER_TABLE: ReadonlyArray<{
  readonly ifPattern: string;
  readonly bashCommand: string;
  readonly fires: boolean;
  readonly reason: string;
}> = [
  {
    ifPattern: "Bash(npm test *)",
    bashCommand: "timeout 30 npm test",
    fires: true,
    reason: "timeout stripped",
  },
  {
    ifPattern: "Bash(grep *)",
    bashCommand: "xargs grep pattern",
    fires: true,
    reason: "bare xargs stripped",
  },
  {
    ifPattern: "Bash(grep *)",
    bashCommand: "xargs -n1 grep pattern",
    fires: false,
    reason: "xargs with flags NOT stripped; head is xargs",
  },
  {
    ifPattern: "Bash(find *)",
    bashCommand: "find . -exec rm {} \\;",
    fires: true,
    reason: "find -exec opaque; matches as find",
  },
  {
    ifPattern: "Bash(rm *)",
    bashCommand: "find . -exec rm {} \\;",
    fires: false,
    reason: "find -exec arg NOT recursed",
  },
];

function bashCommandFires(ifPattern: string, bashCommand: string): boolean {
  const glob = compileBashGlob(stripBashWrapper(ifPattern));
  const parsed = parseBashSubcommands(bashCommand);
  if (!parsed.ok) {
    // Fail-open contract: unparseable Bash fires the hook regardless.
    return true;
  }

  for (const subcmd of parsed.subcommands) {
    if (bashSubcommandFires(glob, subcmd, parsed.hasInterpolation)) {
      return true;
    }
  }

  return false;
}

test("MATCH-03: parseBashSubcommands process-wrapper table matches upstream", () => {
  for (const row of WRAPPER_TABLE) {
    const actual = bashCommandFires(row.ifPattern, row.bashCommand);
    assert.equal(
      actual,
      row.fires,
      `${row.ifPattern} vs "${row.bashCommand}" expected fires=${String(row.fires)} -- ${row.reason}`,
    );
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block 5: parseBashSubcommands compound-command truth table (D-61-04)
// ──────────────────────────────────────────────────────────────────────────

const COMPOUND_TABLE: ReadonlyArray<{
  readonly ifPattern: string;
  readonly bashCommand: string;
  readonly fires: boolean;
  readonly reason: string;
}> = [
  {
    ifPattern: "Bash(npm test)",
    bashCommand: "git status && npm test",
    fires: true,
    reason: "compound split on && and each subcommand checked",
  },
  {
    ifPattern: "Bash(safe-cmd *)",
    bashCommand: "safe-cmd && other-cmd",
    fires: true,
    reason: "first subcommand matches; only ONE need match",
  },
  {
    ifPattern: "Bash(other-cmd *)",
    bashCommand: "safe-cmd && other-cmd",
    fires: true,
    reason: "second subcommand matches",
  },
  {
    ifPattern: "Bash(other-cmd *)",
    bashCommand: "'safe-cmd && other-cmd'",
    fires: false,
    reason: "quotes prevent compound separator split",
  },
];

test("MATCH-03: parseBashSubcommands compound-command table matches upstream", () => {
  for (const row of COMPOUND_TABLE) {
    const actual = bashCommandFires(row.ifPattern, row.bashCommand);
    assert.equal(
      actual,
      row.fires,
      `${row.ifPattern} vs "${row.bashCommand}" expected fires=${String(row.fires)} -- ${row.reason}`,
    );
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block 6: hooks-guide truth table (D-61-04 specificity-override)
// ──────────────────────────────────────────────────────────────────────────

const HOOKS_GUIDE_TRUTH_TABLE: ReadonlyArray<{
  readonly ifPattern: string;
  readonly bashCommand: string;
  readonly fires: boolean;
  readonly why: string;
}> = [
  { ifPattern: "Bash(git *)", bashCommand: "git push", fires: true, why: "command name matches" },
  {
    ifPattern: "Bash(git *)",
    bashCommand: "npm test && git push",
    fires: true,
    why: "each subcommand is checked; `git push` matches",
  },
  {
    ifPattern: "Bash(git *)",
    bashCommand: "echo $(git log)",
    fires: true,
    why: "commands inside $() and backticks are checked; `git log` matches",
  },
  {
    ifPattern: "Bash(git *)",
    bashCommand: "echo $(date)",
    fires: false,
    why: "no subcommand matches `git *`",
  },
  {
    ifPattern: "Bash(git push *)",
    bashCommand: "echo $(date)",
    fires: true,
    why: "patterns more specific than `<command> *` fire on $()/backticks/$VAR",
  },
];

test("MATCH-03: upstream hooks-guide truth table fires per documented semantics", () => {
  for (const row of HOOKS_GUIDE_TRUTH_TABLE) {
    const actual = bashCommandFires(row.ifPattern, row.bashCommand);
    assert.equal(
      actual,
      row.fires,
      `${row.ifPattern} vs "${row.bashCommand}" expected fires=${String(row.fires)} -- ${row.why}`,
    );
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block 7: compilePathGlob anchor truth table (D-61-01)
// ──────────────────────────────────────────────────────────────────────────

// Synthetic anchor-context: tokens like `<cwd>` / `<projectRoot>` in the
// fixture rows are substituted before assertion.
const ANCHOR_CTX = {
  homedir: "/home/u",
  cwd: "/projects/p",
  projectRoot: "/projects/p",
} as const;

function resolveFixtureToken(s: string): string {
  return s.replace(/<cwd>/g, ANCHOR_CTX.cwd).replace(/<projectRoot>/g, ANCHOR_CTX.projectRoot);
}

// Path-fixture inputPaths are the upstream-doc shape ("./.env", "deep/.env",
// "../.env"); we materialize an absolute path against the synthetic ctx for
// the unit test. `./.env` -> `<cwd>/.env`; bare relative -> `<cwd>/<rel>`;
// `../.env` -> `<cwd-parent>/.env` (we represent this as a path outside
// the cwd containment to exercise the fail case).
function toAbsoluteForFixture(inputPath: string): string {
  const replaced = resolveFixtureToken(inputPath);
  if (replaced.startsWith("/")) {
    return replaced;
  }

  if (replaced.startsWith("./")) {
    return `${ANCHOR_CTX.cwd}/${replaced.slice(2)}`;
  }

  if (replaced.startsWith("../")) {
    // One level above cwd. Synthetic value -- the matcher should NOT
    // contain this path under the cwd anchor.
    return `/projects/${replaced.slice(3)}`;
  }

  return `${ANCHOR_CTX.cwd}/${replaced}`;
}

function stripReadEditWrapper(ifPattern: string): string {
  return ifPattern.replace(/^(Read|Edit)\(/, "").replace(/\)$/, "");
}

const PATH_ANCHOR_TABLE: ReadonlyArray<{
  readonly ifPattern: string;
  readonly inputPath: string;
  readonly fires: boolean;
  readonly reason?: string;
}> = [
  { ifPattern: "Read(.env)", inputPath: "./.env", fires: true },
  {
    ifPattern: "Read(.env)",
    inputPath: "deep/nested/.env",
    fires: true,
    reason: "bare filename gitignore semantics: any depth",
  },
  {
    ifPattern: "Read(.env)",
    inputPath: "../.env",
    fires: false,
    reason: "anchored to cwd, parent not included",
  },
  {
    ifPattern: "Read(//**/.env)",
    inputPath: "/tmp/.env",
    fires: true,
    reason: "//abs anchor + globstar = anywhere on filesystem",
  },
  {
    ifPattern: "Read(~/.zshrc)",
    inputPath: "/home/u/.zshrc",
    fires: true,
    reason: "~ anchor resolves to homedir at parse time",
  },
  {
    ifPattern: "Edit(/docs/**)",
    inputPath: "/projects/p/docs/x.md",
    fires: true,
    reason: "/<path> = project-root anchored",
  },
  {
    ifPattern: "Edit(/docs/**)",
    inputPath: "/docs/x.md",
    fires: false,
    reason: "NOT absolute; /docs/ is project-root anchored",
  },
  { ifPattern: "Read(src/**)", inputPath: "<cwd>/src/a/b.ts", fires: true },
];

test("MATCH-03: compilePathGlob anchor table matches upstream Read/Edit semantics", () => {
  for (const row of PATH_ANCHOR_TABLE) {
    const pattern = stripReadEditWrapper(row.ifPattern);
    const glob = compilePathGlob(pattern, ANCHOR_CTX);
    const absPath = toAbsoluteForFixture(row.inputPath);
    const actual = glob.testAbsolute(absPath);
    const reason = row.reason ?? "no reason provided";
    assert.equal(
      actual,
      row.fires,
      `${row.ifPattern} vs absolute "${absPath}" expected fires=${String(row.fires)} -- ${reason}`,
    );
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block 8: MCP literal + server-prefix truth table (D-61-03 / upstream)
// ──────────────────────────────────────────────────────────────────────────

const MCP_TABLE: ReadonlyArray<{
  readonly ifPattern: string;
  readonly toolName: string;
  readonly fires: boolean;
  readonly reason: string;
}> = [
  {
    ifPattern: "mcp__puppeteer",
    toolName: "mcp__puppeteer__navigate",
    fires: true,
    reason: "server-prefix bare form",
  },
  {
    ifPattern: "mcp__puppeteer__*",
    toolName: "mcp__puppeteer__navigate",
    fires: true,
    reason: "server-prefix explicit wildcard equivalent",
  },
  {
    ifPattern: "mcp__puppeteer__navigate",
    toolName: "mcp__puppeteer__navigate",
    fires: true,
    reason: "exact tool literal",
  },
  {
    ifPattern: "mcp__puppeteer__navigate",
    toolName: "mcp__puppeteer__click",
    fires: false,
    reason: "literal mismatch",
  },
];

/**
 * Construct the `IfPredicate` from an MCP `if` pattern per the rules
 * upstream documents:
 *   - `mcp__server`              -> server-prefix with `mcp__server__`
 *   - `mcp__server__*`           -> server-prefix with `mcp__server__`
 *   - `mcp__server__tool`        -> mcp-literal with the exact toolName
 *
 * `compileIfPredicate` owns this construction at parse time; this
 * helper exercises the predicate shape directly for the unit-table
 * iteration.
 */
function predicateFromMcpIfPattern(ifPattern: string): IfPredicate {
  if (ifPattern.endsWith("__*")) {
    return { kind: "mcp-server-prefix", serverPrefix: ifPattern.slice(0, -1) };
  }

  // Server bare form has exactly two `__` segments: `mcp__server`.
  const segments = ifPattern.split("__");
  if (segments.length === 2) {
    return { kind: "mcp-server-prefix", serverPrefix: `${ifPattern}__` };
  }

  return { kind: "mcp-literal", toolName: ifPattern };
}

function mcpFires(predicate: IfPredicate, toolName: string): boolean {
  switch (predicate.kind) {
    case "mcp-literal":
      return predicate.toolName === toolName;
    case "mcp-server-prefix":
      return toolName.startsWith(predicate.serverPrefix);
    case "match-all":
    case "bash":
    case "path-tool":
      return false;
  }
}

test("MATCH-03: MCP literal + server-prefix table matches upstream", () => {
  for (const row of MCP_TABLE) {
    const predicate = predicateFromMcpIfPattern(row.ifPattern);
    const actual = mcpFires(predicate, row.toolName);
    assert.equal(
      actual,
      row.fires,
      `${row.ifPattern} vs toolName "${row.toolName}" expected fires=${String(row.fires)} -- ${row.reason}`,
    );
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block 9: IfPredicate exhaustiveness (NFR-7)
// ──────────────────────────────────────────────────────────────────────────

test("NFR-7: IfPredicate union arms are exhaustively switchable", () => {
  const samples: ReadonlyArray<IfPredicate> = [
    MATCH_ALL_IF,
    { kind: "bash", bashGlob: compileBashGlob("git *") },
    {
      kind: "path-tool",
      piEvents: IF_PREFIX_TARGETS.Read.piEvents,
      pathGlob: compilePathGlob("src/**", ANCHOR_CTX),
    },
    { kind: "mcp-literal", toolName: "mcp__a__b" },
    { kind: "mcp-server-prefix", serverPrefix: "mcp__a__" },
  ];

  const labels: string[] = [];
  for (const predicate of samples) {
    switch (predicate.kind) {
      case "match-all":
        labels.push("match-all");
        break;
      case "bash":
        labels.push("bash");
        break;
      case "path-tool":
        labels.push("path-tool");
        break;
      case "mcp-literal":
        labels.push("mcp-literal");
        break;
      case "mcp-server-prefix":
        labels.push("mcp-server-prefix");
        break;
    }
  }

  assert.deepEqual(
    labels,
    ["match-all", "bash", "path-tool", "mcp-literal", "mcp-server-prefix"],
    "IfPredicate union has exactly 5 arms; adding a sixth literal red-fails the local switch (NFR-7 exhaustiveness gate)",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Block 10: compileIfPredicate parse-time entry (D-61-02 fail-open)
// ──────────────────────────────────────────────────────────────────────────

test("MATCH-03: compileIfPredicate parses `Bash(git push *)` into kind=bash with the compiled glob attached", () => {
  const pred = compileIfPredicate("Bash(git push *)", "PreToolUse", TEST_IF_CTX);
  assert.equal(pred.kind, "bash");
  if (pred.kind === "bash") {
    assert.equal(pred.bashGlob.test("git push origin main"), true);
    assert.equal(pred.bashGlob.test("git status"), false);
  }
});

test("MATCH-03: compileIfPredicate parses `Read(src/**)` into kind=path-tool with reader piEvents", () => {
  const pred = compileIfPredicate("Read(src/**)", "PreToolUse", TEST_IF_CTX);
  assert.equal(pred.kind, "path-tool");
  if (pred.kind === "path-tool") {
    assert.deepEqual(
      [...pred.piEvents].sort(),
      ["find", "grep", "ls", "read"],
      "Read covers all Pi reader tools (cross-tool semantic)",
    );
    assert.equal(pred.pathGlob.testAbsolute("/projects/p/src/a/b.ts"), true);
  }
});

test("MATCH-03: compileIfPredicate parses `Edit(*.ts)` into kind=path-tool with editor piEvents", () => {
  const pred = compileIfPredicate("Edit(*.ts)", "PreToolUse", TEST_IF_CTX);
  assert.equal(pred.kind, "path-tool");
  if (pred.kind === "path-tool") {
    assert.deepEqual([...pred.piEvents].sort(), ["edit", "write"]);
  }
});

test("MATCH-03: compileIfPredicate parses `Write(/docs/**)` into kind=path-tool with Pi `write` only", () => {
  const pred = compileIfPredicate("Write(/docs/**)", "PreToolUse", TEST_IF_CTX);
  assert.equal(pred.kind, "path-tool");
  if (pred.kind === "path-tool") {
    assert.deepEqual([...pred.piEvents].sort(), ["write"]);
  }
});

test("MATCH-03: compileIfPredicate parses `mcp__server__tool` into kind=mcp-literal with exact toolName", () => {
  const pred = compileIfPredicate("mcp__server__tool", "PreToolUse", TEST_IF_CTX);
  assert.deepEqual(pred, { kind: "mcp-literal", toolName: "mcp__server__tool" });
});

test("MATCH-03: compileIfPredicate parses `mcp__puppeteer` into kind=mcp-server-prefix with trailing __", () => {
  const pred = compileIfPredicate("mcp__puppeteer", "PreToolUse", TEST_IF_CTX);
  assert.deepEqual(pred, { kind: "mcp-server-prefix", serverPrefix: "mcp__puppeteer__" });
});

test("MATCH-03: compileIfPredicate parses `mcp__puppeteer__*` into kind=mcp-server-prefix (explicit wildcard)", () => {
  const pred = compileIfPredicate("mcp__puppeteer__*", "PreToolUse", TEST_IF_CTX);
  assert.deepEqual(pred, { kind: "mcp-server-prefix", serverPrefix: "mcp__puppeteer__" });
});

test("MATCH-03: compileIfPredicate falls open to MATCH_ALL_IF on unknown prefix `Grep(*.ts)` (D-61-02 / D-61-03)", () => {
  const pred = compileIfPredicate("Grep(*.ts)", "PreToolUse", TEST_IF_CTX);
  assert.equal(pred.kind, "match-all");
});

test("MATCH-03: compileIfPredicate falls open to MATCH_ALL_IF on unknown prefix `PowerShell(...)` (deferred)", () => {
  const pred = compileIfPredicate("PowerShell(Get-Item)", "PreToolUse", TEST_IF_CTX);
  assert.equal(pred.kind, "match-all");
});

test('MATCH-03: compileIfPredicate falls open to MATCH_ALL_IF on malformed `if: "Bash("`', () => {
  const pred = compileIfPredicate("Bash(", "PreToolUse", TEST_IF_CTX);
  assert.equal(pred.kind, "match-all");
});

test("MATCH-03: compileIfPredicate falls open to MATCH_ALL_IF on empty string", () => {
  const pred = compileIfPredicate("", "PreToolUse", TEST_IF_CTX);
  assert.equal(pred.kind, "match-all");
});

test("MATCH-03: compileIfPredicate falls open on whitespace-only input", () => {
  const pred = compileIfPredicate("   \t  ", "PreToolUse", TEST_IF_CTX);
  assert.equal(pred.kind, "match-all");
});

test("MATCH-03: compileIfPredicate falls open on non-tool event `SessionStart` (A5 disposition)", () => {
  const pred = compileIfPredicate("Bash(git push *)", "SessionStart", TEST_IF_CTX);
  assert.equal(pred.kind, "match-all");
});

test("MATCH-03: compileIfPredicate fires Bash predicate on `PostToolUse` (tool event)", () => {
  const pred = compileIfPredicate("Bash(git push *)", "PostToolUse", TEST_IF_CTX);
  assert.equal(pred.kind, "bash");
});

test("MATCH-03: compileIfPredicate fires Bash predicate on `PostToolUseFailure` (tool event)", () => {
  const pred = compileIfPredicate("Bash(git push *)", "PostToolUseFailure", TEST_IF_CTX);
  assert.equal(pred.kind, "bash");
});

test("MATCH-03: compileIfPredicate hookDebugLog fires on fall-open when PI_CLAUDE_MARKETPLACE_DEBUG=1", (t) => {
  const prior = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  const captured: string[] = [];
  t.mock.method(console, "error", (msg: unknown) => {
    captured.push(String(msg));
  });

  try {
    const pred = compileIfPredicate("Grep(foo)", "PreToolUse", TEST_IF_CTX);
    assert.equal(pred.kind, "match-all");
    assert.ok(
      captured.some((line) => line.includes("compileIfPredicate") && line.includes("Grep")),
      `expected debug-log line for unknown prefix, captured: ${JSON.stringify(captured)}`,
    );
  } finally {
    if (prior === undefined) {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    } else {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = prior;
    }
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block 11: HOOK_HANDLER_SCHEMA: `if` is optional (HOOK-03 forward-compat)
// ──────────────────────────────────────────────────────────────────────────

test("MATCH-03: handler without `if` field still passes HOOKS_VALIDATOR.Check (required stays [`type`])", () => {
  // Regression pin: HOOK_HANDLER_SCHEMA.required MUST stay exactly
  // ["type"]. Adding "if" to required would red-fail this fixture.
  const fixture = {
    PreToolUse: [{ hooks: [{ type: "command", command: "echo hi" }] }],
  };
  assert.equal(
    HOOKS_VALIDATOR.Check(fixture),
    true,
    "handler without `if` field MUST still pass validation; HOOK_HANDLER_SCHEMA.required stays [`type`]",
  );
});

test("MATCH-03: handler WITH `if` field passes HOOKS_VALIDATOR.Check (additive property admission)", () => {
  const fixture = {
    PreToolUse: [
      {
        hooks: [
          {
            type: "command",
            command: "echo hi",
            if: "Bash(git push *)",
          },
        ],
      },
    ],
  };
  assert.equal(HOOKS_VALIDATOR.Check(fixture), true);
});

// ──────────────────────────────────────────────────────────────────────────
// Block 12: parseHooksConfig side-Map (MATCH-03 D-61-02)
// ──────────────────────────────────────────────────────────────────────────

test("MATCH-03: parseHooksConfig success arm carries an empty ifPredicates Map when no `if` fields are declared", () => {
  const raw = JSON.stringify({
    PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "echo hi" }] }],
  });
  const result = parseHooksConfig(raw, TEST_IF_CTX, compileIfPredicate);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.ifPredicates.size, 0);
  }
});

test("MATCH-03: parseHooksConfig success arm populates ifPredicates per (event|group|handler) key", () => {
  const raw = JSON.stringify({
    PreToolUse: [
      {
        matcher: "",
        hooks: [
          { type: "command", command: "echo a", if: "Bash(git push *)" },
          { type: "command", command: "echo b" },
        ],
      },
    ],
    PostToolUse: [
      {
        matcher: "",
        hooks: [{ type: "command", command: "echo c", if: "Read(src/**)" }],
      },
    ],
  });
  const result = parseHooksConfig(raw, TEST_IF_CTX, compileIfPredicate);
  assert.equal(result.ok, true);
  if (result.ok) {
    // Two `if`-bearing handlers; one bare handler absent from map.
    assert.equal(result.ifPredicates.size, 2);
    const bashKey = "PreToolUse|0|0";
    const readKey = "PostToolUse|0|0";
    const bashPred = result.ifPredicates.get(bashKey);
    const readPred = result.ifPredicates.get(readKey);
    assert.ok(bashPred?.kind === "bash");
    assert.ok(readPred?.kind === "path-tool");
    // Bare handler at PreToolUse|0|1 has no map entry.
    assert.equal(result.ifPredicates.get("PreToolUse|0|1"), undefined);
  }
});

test("MATCH-03: parseHooksConfig success arm collapses malformed `if` to MATCH_ALL_IF (D-61-02 fail-open)", () => {
  const raw = JSON.stringify({
    PreToolUse: [
      {
        matcher: "",
        hooks: [{ type: "command", command: "echo a", if: "Bash(" }],
      },
    ],
  });
  const result = parseHooksConfig(raw, TEST_IF_CTX, compileIfPredicate);
  assert.equal(result.ok, true);
  if (result.ok) {
    const pred = result.ifPredicates.get("PreToolUse|0|0");
    assert.ok(pred?.kind === "match-all");
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block 13: ifPredicate rides on RoutingEntry (MATCH-03 / D-61-02)
// ──────────────────────────────────────────────────────────────────────────

test("MATCH-03: ifPredicate populates from parser side-Map into RoutingEntry (Bash + path-tool + unknown-prefix + absent)", async () => {
  const router =
    await import("../../extensions/pi-claude-marketplace/bridges/hooks/event-router.ts");

  router._resetForTest();
  const raw = JSON.stringify({
    PreToolUse: [
      {
        matcher: "",
        hooks: [
          // 0: Bash if-field
          { type: "command", command: "echo a", if: "Bash(git *)" },
          // 1: Read path-tool if-field
          { type: "command", command: "echo b", if: "Read(src/**)" },
          // 2: unknown prefix -> fall-open
          { type: "command", command: "echo c", if: "Grep(*.ts)" },
          // 3: absent if-field
          { type: "command", command: "echo d" },
        ],
      },
    ],
  });
  const parsed = parseHooksConfig(raw, TEST_IF_CTX, compileIfPredicate);
  assert.ok(parsed.ok);
  router.addPluginConfigToCache("project", "mp", "p1", parsed.value, parsed.ifPredicates);

  // Synthetic state + locations fixture. The shape mirrors
  // `persistence/state-io.ts` but is constructed in-memory; the cast is
  // load-bearing because the architecture test does not import the
  // full state-io surface. `rebuildRoutingTables` reads only `scope` +
  // `plugins[*].resources.hooks.length` from the state record.
  const stateRecord = {
    schemaVersion: 1 as const,
    marketplaces: {
      mp: {
        name: "mp",
        scope: "project" as const,
        source: { kind: "path", raw: "./src" },
        addedFromCwd: "/projects/p",
        manifestPath: "/projects/p/marketplace.json",
        marketplaceRoot: "/projects/p",
        plugins: {
          p1: {
            installedAt: "2026-06-15T00:00:00Z",
            updatedAt: "2026-06-15T00:00:00Z",
            resolvedSource: "test://",
            compatibility: { installable: true, notes: [], supported: [], unsupported: [] },
            resources: {
              skills: [],
              prompts: [],
              agents: [],
              mcpServers: [],
              hooks: ["p1"],
            },
            version: "1.0.0",
          },
        },
      },
    },
  };
  const loc = {
    scope: "project" as const,
    extensionRoot: "/projects/p/.pi/pi-claude-marketplace",
  };
  router.rebuildRoutingTables(
    stateRecord,
    loc as unknown as Parameters<typeof router.rebuildRoutingTables>[1],
  );

  const bucket = router._routingTableForTest().get("PreToolUse");
  assert.ok(bucket !== undefined);
  assert.equal(bucket.length, 4);

  const [bashRow, readRow, grepRow, bareRow] = bucket;
  assert.ok(bashRow !== undefined);
  assert.ok(readRow !== undefined);
  assert.ok(grepRow !== undefined);
  assert.ok(bareRow !== undefined);

  assert.equal(bashRow.ifPredicate.kind, "bash");
  assert.equal(readRow.ifPredicate.kind, "path-tool");
  assert.equal(grepRow.ifPredicate.kind, "match-all");
  assert.equal(bareRow.ifPredicate.kind, "match-all");

  // Bare-handler row uses the MATCH_ALL_IF sentinel via referential
  // equality (D-61-02 always-present-with-sentinel).
  assert.strictEqual(bareRow.ifPredicate, MATCH_ALL_IF);

  router._resetForTest();
});

// ──────────────────────────────────────────────────────────────────────────
// Block 14: end-to-end ifFires harness (MATCH-03 dispatch-time consult)
// ──────────────────────────────────────────────────────────────────────────

// Synthetic ExtensionContext used across the end-to-end blocks. Only
// `ctx.cwd` is read by ifFires + the per-event extractors; the cast
// elides the rest of the ExtensionContext surface so the architecture
// test does not need the full Pi-API peer-dep mock.
const TEST_CTX = { cwd: "/projects/p" } as unknown as ExtensionContext;

/**
 * Drive the full parse-time -> dispatch-time path: compile the `if`
 * string into a predicate against `TEST_IF_CTX`, then call `ifFires`
 * against a synthetic Bash tool-event. The plumbing mirrors what
 * `reduceBucket` does at runtime.
 */
function fireBashIf(
  ifString: string,
  bashCommand: string,
  claudeEvent: BucketAEvent = "PostToolUse",
): boolean {
  const predicate = compileIfPredicate(ifString, claudeEvent, TEST_IF_CTX);
  return ifFires(
    predicate,
    { toolName: "bash", input: { command: bashCommand } },
    TEST_CTX,
    claudeEvent,
  );
}

test("MATCH-03: end-to-end ifFires against HOOKS_GUIDE_TRUTH_TABLE", () => {
  for (const row of HOOKS_GUIDE_TRUTH_TABLE) {
    const actual = fireBashIf(row.ifPattern, row.bashCommand);
    assert.equal(actual, row.fires, `${row.ifPattern} vs "${row.bashCommand}" -- ${row.why}`);
  }
});

test("MATCH-03: end-to-end ifFires against BASH_WORD_BOUNDARY_TABLE", () => {
  for (const row of BASH_WORD_BOUNDARY_TABLE) {
    const actual = fireBashIf(row.ifPattern, row.bashCommand);
    assert.equal(
      actual,
      row.fires,
      `${row.ifPattern} vs "${row.bashCommand}" expected fires=${String(row.fires)}`,
    );
  }
});

test("MATCH-03: end-to-end ifFires against COLON_SUGAR_TABLE", () => {
  for (const row of COLON_SUGAR_TABLE) {
    const actual = fireBashIf(row.ifPattern, row.bashCommand);
    assert.equal(
      actual,
      row.fires,
      `${row.ifPattern} vs "${row.bashCommand}" expected fires=${String(row.fires)}`,
    );
  }
});

test("MATCH-03: end-to-end ifFires against WRAPPER_TABLE", () => {
  for (const row of WRAPPER_TABLE) {
    const actual = fireBashIf(row.ifPattern, row.bashCommand);
    assert.equal(
      actual,
      row.fires,
      `${row.ifPattern} vs "${row.bashCommand}" expected fires=${String(row.fires)} -- ${row.reason}`,
    );
  }
});

test("MATCH-03: end-to-end ifFires against COMPOUND_TABLE", () => {
  for (const row of COMPOUND_TABLE) {
    const actual = fireBashIf(row.ifPattern, row.bashCommand);
    assert.equal(
      actual,
      row.fires,
      `${row.ifPattern} vs "${row.bashCommand}" expected fires=${String(row.fires)} -- ${row.reason}`,
    );
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block 15: end-to-end ifFires against PATH_ANCHOR_TABLE (D-61-01)
// ──────────────────────────────────────────────────────────────────────────

test("MATCH-03: end-to-end ifFires against PATH_ANCHOR_TABLE", () => {
  for (const row of PATH_ANCHOR_TABLE) {
    const pattern = stripReadEditWrapper(row.ifPattern);
    const isEdit = row.ifPattern.startsWith("Edit(");
    const ifString = isEdit ? `Edit(${pattern})` : `Read(${pattern})`;
    const predicate = compileIfPredicate(ifString, "PreToolUse", TEST_IF_CTX);
    // The predicate must compile to path-tool (D-61-02 fall-open would
    // skip the row; the fixtures are crafted to compile cleanly).
    assert.equal(predicate.kind, "path-tool", `${row.ifPattern} should compile to path-tool`);

    const absPath = toAbsoluteForFixture(row.inputPath);
    // Bind the path tool to a Pi reader / editor event. Read covers
    // grep/find/ls/read; Edit covers edit/write. Choose a representative
    // toolName for the assertion.
    const toolName = isEdit ? "edit" : "read";
    const actual = ifFires(
      predicate,
      { toolName, input: { path: absPath } },
      TEST_CTX,
      "PreToolUse",
    );
    const reason = row.reason ?? "no reason provided";
    assert.equal(
      actual,
      row.fires,
      `${row.ifPattern} vs absolute "${absPath}" expected fires=${String(row.fires)} -- ${reason}`,
    );
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block 16: end-to-end ifFires against MCP_TABLE
// ──────────────────────────────────────────────────────────────────────────

test("MATCH-03: end-to-end ifFires against MCP_TABLE", () => {
  for (const row of MCP_TABLE) {
    const predicate = compileIfPredicate(row.ifPattern, "PreToolUse", TEST_IF_CTX);
    const actual = ifFires(
      predicate,
      { toolName: row.toolName, input: {} },
      TEST_CTX,
      "PreToolUse",
    );
    assert.equal(
      actual,
      row.fires,
      `${row.ifPattern} vs toolName "${row.toolName}" expected fires=${String(row.fires)} -- ${row.reason}`,
    );
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block 17: AND composition with matcher (MATCH-03 §4)
// ──────────────────────────────────────────────────────────────────────────

test("MATCH-03 §4: AND composition with matcher -- both gates required", () => {
  // Simulate the dispatch-loop gate sequence by hand: matcher gate first,
  // then ifFires gate. `reduceBucket` runs them in this order against
  // every entry.
  const matcher = parseMatcher("Bash");
  const predicate = compileIfPredicate("Bash(git push *)", "PostToolUse", TEST_IF_CTX);

  function matcherFiresOnToolEvent(toolName: string): boolean {
    return matcher.kind === "tool-set" ? matcher.piTools.has(toolName as never) : false;
  }

  // Case 1: matcher passes (toolName=bash) + ifFires passes (command
  // matches the glob) -> both gates pass.
  {
    const event = { toolName: "bash", input: { command: "git push origin main" } };
    assert.equal(matcherFiresOnToolEvent(event.toolName), true);
    assert.equal(ifFires(predicate, event, TEST_CTX, "PostToolUse"), true);
  }

  // Case 2: matcher passes (toolName=bash) + ifFires fails (command does
  // not match) -> entry skipped via the if-layer.
  {
    const event = { toolName: "bash", input: { command: "npm test" } };
    assert.equal(matcherFiresOnToolEvent(event.toolName), true);
    assert.equal(ifFires(predicate, event, TEST_CTX, "PostToolUse"), false);
  }

  // Case 3: matcher fails (toolName=edit) -> reduceBucket never reaches
  // the ifFires gate. We assert the matcher-fail outcome directly; the
  // ifFires call below would also return false because the path-extractor
  // would yield undefined for the missing command, but the dispatch loop
  // short-circuits earlier.
  {
    const event = { toolName: "edit", input: { path: "x.ts" } };
    assert.equal(matcherFiresOnToolEvent(event.toolName), false);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block 18: dispatch-time fail-open (MATCH-03 §3 / D-61-04)
// ──────────────────────────────────────────────────────────────────────────

test("MATCH-03 §3: ifFires fails open on unparseable Bash command", () => {
  // Generate a $(...) nest that exceeds the parser's recursion cap
  // (MAX_RECURSION_DEPTH = 8 in bash.ts). The parser surfaces
  // `{ ok: false, reason }`; ifFires fires the hook regardless.
  let nested = "echo";
  for (let i = 0; i < 16; i++) {
    nested = `$(${nested})`;
  }

  const predicate = compileIfPredicate("Bash(git push *)", "PostToolUse", TEST_IF_CTX);
  assert.equal(predicate.kind, "bash");
  const fires = ifFires(
    predicate,
    { toolName: "bash", input: { command: nested } },
    TEST_CTX,
    "PostToolUse",
  );
  assert.equal(fires, true, "ifFires must fail open when parseBashSubcommands returns !ok");
});

test("MATCH-03 §3: ifFires returns false when bash event carries no command", () => {
  const predicate = compileIfPredicate("Bash(git *)", "PostToolUse", TEST_IF_CTX);
  const fires = ifFires(predicate, { toolName: "bash", input: {} }, TEST_CTX, "PostToolUse");
  assert.equal(
    fires,
    false,
    "no command -> nothing to glob against -> entry skipped (matcher already filtered for bash; no payload means no decision)",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Block 19: every compile-failure mode collapses to MATCH_ALL_IF (D-61-02)
// ──────────────────────────────────────────────────────────────────────────

test("D-61-02: every compile-failure mode collapses to MATCH_ALL_IF", () => {
  const failureFixtures: ReadonlyArray<{ rawIf: string; claudeEvent: BucketAEvent; why: string }> =
    [
      { rawIf: "", claudeEvent: "PreToolUse", why: "empty string" },
      { rawIf: "   \t  ", claudeEvent: "PreToolUse", why: "whitespace-only" },
      { rawIf: "Bash(", claudeEvent: "PreToolUse", why: "malformed prefix syntax" },
      {
        rawIf: "Grep(*.ts)",
        claudeEvent: "PreToolUse",
        why: "unsupported prefix (covered by Read)",
      },
      { rawIf: "PowerShell(Get-Item)", claudeEvent: "PreToolUse", why: "non-Pi tool prefix" },
      {
        rawIf: "Bash(git push *)",
        claudeEvent: "SessionStart",
        why: "non-tool event ignores if (A5)",
      },
    ];

  for (const fx of failureFixtures) {
    const pred = compileIfPredicate(fx.rawIf, fx.claudeEvent, TEST_IF_CTX);
    assert.equal(
      pred.kind,
      "match-all",
      `${fx.why}: "${fx.rawIf}" on ${fx.claudeEvent} -> expected MATCH_ALL_IF`,
    );
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Block 20: D-61-03 substitute-cwd (Pi grep/find/ls without input.path)
// ──────────────────────────────────────────────────────────────────────────

test("D-61-03: ifFires substitutes ctx.cwd when path-tool event omits input.path", () => {
  // `Read(src/**)` compiles to a cwd-anchored path glob. Pi `grep` event
  // with no `input.path` should substitute `ctx.cwd` -- the glob's
  // resolved match target becomes ctx.cwd, which does NOT match `src/**`
  // (cwd is `/projects/p`, the glob anchor; `src/**` requires at least
  // one segment under cwd).
  const predicateAtCwd = compileIfPredicate("Read(src/**)", "PreToolUse", TEST_IF_CTX);
  const firesAtCwd = ifFires(
    predicateAtCwd,
    { toolName: "grep", input: {} },
    TEST_CTX,
    "PreToolUse",
  );
  assert.equal(
    firesAtCwd,
    false,
    "substituted cwd (/projects/p) does not match src/** anchored to cwd",
  );

  // Now place ctx.cwd UNDER src so the substitute hits. The synthetic
  // ctx points at /projects/p/src/sub; the glob anchored against the
  // compile-time TEST_IF_CTX (cwd=/projects/p) checks the cwd against
  // /projects/p/src/sub which matches src/**.
  const ctxUnderSrc = { cwd: "/projects/p/src/sub" } as unknown as ExtensionContext;
  const firesUnderSrc = ifFires(
    predicateAtCwd,
    { toolName: "grep", input: {} },
    ctxUnderSrc,
    "PreToolUse",
  );
  assert.equal(
    firesUnderSrc,
    true,
    "substituted cwd /projects/p/src/sub matches src/** anchored to /projects/p",
  );
});

test("D-61-03: ifFires guards toolName against piEvents set", () => {
  // Read(src/**) covers Pi readers (read/grep/find/ls); a bash event
  // should NOT match even when the matcher gate would have admitted it.
  const predicate = compileIfPredicate("Read(src/**)", "PreToolUse", TEST_IF_CTX);
  const fires = ifFires(
    predicate,
    { toolName: "bash", input: { command: "git status" } },
    TEST_CTX,
    "PreToolUse",
  );
  assert.equal(fires, false, "Read predicate does not fire on bash event (cross-tool guard)");
});

// ──────────────────────────────────────────────────────────────────────────
// Block 21: non-tool-event fall-open (A5 disposition)
// ──────────────────────────────────────────────────────────────────────────

test("A5: ifFires fires on SessionStart handler with if field (fall-open per D-61-02)", () => {
  // Upstream Claude's "attaching to other events prevents the hook from
  // running" rule: a SessionStart handler with `if: Bash(...)` is
  // compiled to MATCH_ALL_IF at parse time, and ifFires returns true
  // unconditionally -- the hook runs every SessionStart, the `if`
  // field is silently ignored. Pi-Claude matches this verbatim.
  const predicate = compileIfPredicate("Bash(git push *)", "SessionStart", TEST_IF_CTX);
  assert.equal(predicate.kind, "match-all");

  // ifFires against any synthetic SessionStart event payload fires true.
  const fires = ifFires(predicate, { reason: "startup" }, TEST_CTX, "SessionStart");
  assert.equal(fires, true, "SessionStart handler with if field fires unconditionally per A5");
});

// ──────────────────────────────────────────────────────────────────────────
// Block 22: dispatch-time fail-open emits hookDebugLog
// ──────────────────────────────────────────────────────────────────────────

test("MATCH-03 §3: ifFires fail-open emits hookDebugLog when PI_CLAUDE_MARKETPLACE_DEBUG=1", (t) => {
  const prior = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
  process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
  const captured: string[] = [];
  t.mock.method(console, "error", (msg: unknown) => {
    captured.push(String(msg));
  });

  try {
    let nested = "echo";
    for (let i = 0; i < 16; i++) {
      nested = `$(${nested})`;
    }

    const predicate = compileIfPredicate("Bash(git push *)", "PostToolUse", TEST_IF_CTX);
    const fires = ifFires(
      predicate,
      { toolName: "bash", input: { command: nested } },
      TEST_CTX,
      "PostToolUse",
    );
    assert.equal(fires, true, "fail-open path returns true");
    assert.ok(
      captured.some((line) => line.includes("ifFires") && line.includes("unparseable")),
      `expected hookDebugLog line for parser fail-open, captured: ${JSON.stringify(captured)}`,
    );
  } finally {
    if (prior === undefined) {
      delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    } else {
      process.env.PI_CLAUDE_MARKETPLACE_DEBUG = prior;
    }
  }
});
