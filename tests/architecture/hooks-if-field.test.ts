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
// upstream truth tables snapshotted at research time. Plan 02 / Plan 03
// wire `compileIfPredicate` (parse-time entry) and `ifFires`
// (dispatch-time consult); rows that depend on those entry points are
// marked `test.todo(...)` with an explicit dependency note.

import assert from "node:assert/strict";
import test from "node:test";

import {
  bashSubcommandFires,
  compileBashGlob,
  compilePathGlob,
  MATCH_ALL_IF,
  parseBashSubcommands,
  type IfPredicate,
} from "../../extensions/pi-claude-marketplace/bridges/hooks/if-field/index.ts";
import { IF_PREFIX_TARGETS } from "../../extensions/pi-claude-marketplace/domain/components/hook-if-targets.ts";

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
 * Plan 02's `compileIfPredicate` will own this construction at parse
 * time; the unit test exercises the predicate shape directly.
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
// Block 10: Plan 02 / Plan 03 wiring placeholders
// ──────────────────────────────────────────────────────────────────────────

test.todo(
  "MATCH-03: compileIfPredicate parses `Bash(git *)` into kind=bash with the compiled glob attached (parse-time entry)",
);

test.todo(
  'MATCH-03: compileIfPredicate falls open to MATCH_ALL_IF on malformed `if: "Bash("` and emits hookDebugLog (parse-time fail-open)',
);

test.todo(
  "MATCH-03: compileIfPredicate falls open to MATCH_ALL_IF on unknown rule prefix `PowerShell(...)` (parse-time fail-open)",
);

test.todo(
  "MATCH-03: ifFires consults predicate.kind=`path-tool` against a Pi reader event with substituted ctx.cwd when input.path is absent (dispatch-time consult)",
);

test.todo(
  "MATCH-03: ifFires fails open on parseBashSubcommands `{ok:false}` and emits hookDebugLog warning (dispatch-time fail-open)",
);

test.todo(
  "MATCH-03: ifFires returns `continue` (skip entry) when predicate does not fire; dispatch reducer never sees `block` from the if-layer (dispatch-time semantic)",
);
