import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  HOOKS_VALIDATOR,
  parseHooksConfig,
  parseMatcher,
  partitionHooks,
} from "../../../extensions/pi-claude-marketplace/domain/components/hooks.ts";

// MATCH-03: synthetic path-anchor triple + no-op compileIf callback
// consumed by parseHooksConfig. Fixture values are stable across every
// parseHooksConfig invocation in this file -- no test exercises an
// `if` field, so the ctx is effectively a no-op here.
const TEST_IF_CTX = {
  homedir: "/home/u",
  cwd: "/projects/p",
  projectRoot: "/projects/p",
} as const;
const TEST_COMPILE_IF = (): null => null;

// ──────────────────────────────────────────────────────────────────────────
// HOOKS_CONFIG_SCHEMA accept matrix
// HOOK-03: additionalProperties: true at every nesting level (lenient).
// D-57-02: top-level event keys accepted as any string.
// ──────────────────────────────────────────────────────────────────────────

test("HOOKS accepts empty object (no events declared)", () => {
  assert.equal(HOOKS_VALIDATOR.Check({}), true);
});

test("HOOKS accepts a known event key with an empty array", () => {
  assert.equal(HOOKS_VALIDATOR.Check({ SessionStart: [] }), true);
});

test("HOOKS accepts the minimum bucket-A command-handler shape", () => {
  assert.equal(
    HOOKS_VALIDATOR.Check({
      PreToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "/bin/false" }] }],
    }),
    true,
  );
});

test("HOOKS accepts all five HOOK-03 additive extensions on a hook entry", () => {
  assert.equal(
    HOOKS_VALIDATOR.Check({
      PreToolUse: [
        {
          matcher: "Edit",
          hooks: [
            {
              type: "command",
              command: "/bin/false",
              statusMessage: "running",
              once: true,
              async: false,
              shell: "/bin/bash",
              args: ["-c", "x"],
            },
          ],
        },
      ],
    }),
    true,
  );
});

test("HOOKS accepts unknown extension field names (HOOK-03 forward-compat)", () => {
  assert.equal(
    HOOKS_VALIDATOR.Check({
      PreToolUse: [
        {
          matcher: "Edit",
          hooks: [
            {
              type: "command",
              command: "/bin/false",
              futureField: 42,
              anotherFuture: { nested: 1 },
            },
          ],
        },
      ],
    }),
    true,
  );
});

test("HOOKS accepts unknown top-level event keys (D-57-02 lenient top-level)", () => {
  assert.equal(
    HOOKS_VALIDATOR.Check({
      FutureEventX: [{ hooks: [{ type: "command", command: "/bin/false" }] }],
    }),
    true,
  );
});

test("HOOKS rejects a type:'command' entry missing the required `command` field", () => {
  assert.equal(
    HOOKS_VALIDATOR.Check({
      PreToolUse: [{ hooks: [{ type: "command" }] }],
    }),
    false,
  );
});

test("HOOKS rejects a top-level value that is not an array", () => {
  assert.equal(HOOKS_VALIDATOR.Check({ PreToolUse: "not-an-array" }), false);
});

test("HOOKS rejects a top-level array (must be an object)", () => {
  assert.equal(HOOKS_VALIDATOR.Check([]), false);
});

test("HOOKS rejects null", () => {
  assert.equal(HOOKS_VALIDATOR.Check(null), false);
});

test("HOOKS accepts an unknown handler-type literal (schema does not gate on handler type)", () => {
  assert.equal(
    HOOKS_VALIDATOR.Check({
      PreToolUse: [
        {
          matcher: "Edit",
          hooks: [{ type: "frobnicate", command: "/bin/false" }],
        },
      ],
    }),
    true,
  );
});

// ──────────────────────────────────────────────────────────────────────────
// parseHooksConfig discriminated result (D-57-04 invalid-parse path)
// ──────────────────────────────────────────────────────────────────────────

test("parseHooksConfig returns {ok:true,value} for a syntactically + structurally valid payload", () => {
  const raw = JSON.stringify({
    PreToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "/bin/false" }] }],
  });
  const result = parseHooksConfig(raw, TEST_IF_CTX, TEST_COMPILE_IF);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, JSON.parse(raw));
  }
});

test("parseHooksConfig returns {ok:false,reason} on invalid JSON", () => {
  const result = parseHooksConfig("not-valid-json", TEST_IF_CTX, TEST_COMPILE_IF);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(typeof result.reason, "string");
    assert.notEqual(result.reason.length, 0);
  }
});

test("parseHooksConfig returns {ok:false,reason} on a structurally-malformed payload", () => {
  const result = parseHooksConfig('{"PreToolUse": "not-an-array"}', TEST_IF_CTX, TEST_COMPILE_IF);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(typeof result.reason, "string");
    assert.notEqual(result.reason.length, 0);
  }
});

test("parseHooksConfig returns {ok:false,reason} when a type:'command' entry is missing the required `command` field", () => {
  const result = parseHooksConfig(
    '{"PreToolUse": [{"hooks": [{"type": "command"}]}]}',
    TEST_IF_CTX,
    TEST_COMPILE_IF,
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(typeof result.reason, "string");
    assert.notEqual(result.reason.length, 0);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// parseMatcher (MATCH-01 / MATCH-02 / TOOL-01 reverse-map at parse time)
// ──────────────────────────────────────────────────────────────────────────

test("parseMatcher: empty/`*` -> match-all", () => {
  assert.deepEqual(parseMatcher(""), { kind: "match-all" });
  assert.deepEqual(parseMatcher("*"), { kind: "match-all" });
});

test("parseMatcher: single Claude tool token -> tool-set with mapped Pi name", () => {
  // Each of the 7 TOOL-01 reverse-map entries.
  const cases: ReadonlyArray<readonly [string, string]> = [
    ["Bash", "bash"],
    ["Read", "read"],
    ["Edit", "edit"],
    ["Write", "write"],
    ["Grep", "grep"],
    ["Glob", "find"],
    ["LS", "ls"],
  ];
  for (const [claudeName, piName] of cases) {
    const result = parseMatcher(claudeName);
    assert.equal(result.kind, "tool-set", `expected tool-set for ${claudeName}`);
    if (result.kind === "tool-set") {
      assert.deepEqual(Array.from(result.piTools).sort(), [piName]);
    }
  }
});

test("parseMatcher: pipe-OR alternation -> tool-set with multiple Pi names", () => {
  const editWrite = parseMatcher("Edit|Write");
  assert.equal(editWrite.kind, "tool-set");
  if (editWrite.kind === "tool-set") {
    assert.deepEqual(Array.from(editWrite.piTools).sort(), ["edit", "write"]);
  }

  const triple = parseMatcher("Read|Write|Grep");
  assert.equal(triple.kind, "tool-set");
  if (triple.kind === "tool-set") {
    assert.deepEqual(Array.from(triple.piTools).sort(), ["grep", "read", "write"]);
  }
});

test("parseMatcher: MCP literal -> mcp-literal", () => {
  const result = parseMatcher("mcp__github__create_issue");
  assert.deepEqual(result, { kind: "mcp-literal", literal: "mcp__github__create_issue" });

  // Server / tool segments tolerate `-` and digits per MCP_LITERAL.
  const dashed = parseMatcher("mcp__my-server-1__some_tool");
  assert.deepEqual(dashed, { kind: "mcp-literal", literal: "mcp__my-server-1__some_tool" });
});

test("parseMatcher: Pi-form lowercase token -> unmapped (Pi-form rejection)", () => {
  // Pi-form rejection: a lowercase token like `edit` is NOT a Claude-form
  // key in the TOOL-01 reverse map; it must NOT silently produce a
  // tool-set arm that would match Pi runtime events. Strict-supportability
  // sentinel test.
  const result = parseMatcher("edit");
  assert.deepEqual(result, { kind: "unmapped", token: "edit" });
  // Strong assertion: definitely NOT a tool-set.
  assert.notEqual(result.kind, "tool-set");

  for (const piForm of ["bash", "read", "write", "grep", "find", "ls"]) {
    const r = parseMatcher(piForm);
    assert.equal(r.kind, "unmapped", `Pi-form "${piForm}" must be unmapped`);
  }
});

test("parseMatcher: Claude-form unmapped tool (MultiEdit, WebFetch, Task) -> unmapped", () => {
  // TOOL-02(b) trip surface: Claude tools with no Pi peer-dep analog.
  for (const token of ["MultiEdit", "WebFetch", "Task"]) {
    assert.deepEqual(parseMatcher(token), { kind: "unmapped", token });
  }
});

test("parseMatcher: regex chars (Edit.*, *bash, .* alone) -> regex (MATCH-02)", () => {
  assert.deepEqual(parseMatcher("Edit.*"), { kind: "regex" });
  // Leading `*` makes the matcher contain a char outside the safe set
  // when paired with letters (the lone `*` shape is reserved as the
  // match-all sentinel; `*bash` is regex).
  assert.deepEqual(parseMatcher("*bash"), { kind: "regex" });
  assert.deepEqual(parseMatcher(".*"), { kind: "regex" });
  assert.deepEqual(parseMatcher("Edit$"), { kind: "regex" });
  assert.deepEqual(parseMatcher("(Edit)"), { kind: "regex" });
});

test("parseMatcher: malformed pipe-OR (lone |, trailing |, leading |) -> regex (strict-supportability)", () => {
  // Strict-supportability loud rejection per D-58-06 -- malformed pipe-OR
  // is NOT silently treated as match-all.
  assert.deepEqual(parseMatcher("|"), { kind: "regex" });
  assert.deepEqual(parseMatcher("Edit|"), { kind: "regex" });
  assert.deepEqual(parseMatcher("|Edit"), { kind: "regex" });
  assert.deepEqual(parseMatcher("Edit||Write"), { kind: "regex" });
});

test("parseMatcher: mixed tool|mcp literal -> regex (mixed-token rejection)", () => {
  // Claude's grammar does not mix tool-name alternation with MCP literals.
  // Pipe-OR carrying an MCP token rejects: the `mcp__a__b` segment fails
  // the per-token `SAFE_TOKEN_CHARS` (no underscores allowed by the strict
  // tool-name shape would be wrong -- actually SAFE_TOKEN_CHARS DOES allow
  // `_`, so the segment passes the charset gate but FAILS the TOOL-01
  // reverse-map lookup, producing `unmapped`). Either outcome is loud
  // rejection; we assert the non-tool-set property explicitly.
  const result = parseMatcher("Edit|mcp__a__b");
  assert.notEqual(result.kind, "tool-set");
  assert.notEqual(result.kind, "mcp-literal");
  assert.notEqual(result.kind, "match-all");
});

// ──────────────────────────────────────────────────────────────────────────
// partitionHooks (PHOOK-01 / D-71-01 accumulating partition) + parseHooksConfig
// structural-vs-supportability split (PHOOK-03 / D-71-03)
// ──────────────────────────────────────────────────────────────────────────

test("PHOOK-01: regex matcher drops the group with cond=regex (a)", () => {
  const partition = partitionHooks({
    PreToolUse: [{ matcher: "Edit.*", hooks: [{ type: "command", command: "/bin/false" }] }],
  });
  assert.deepEqual(partition.supported, {});
  assert.deepEqual(partition.dropped, [
    { kind: "group", event: "PreToolUse", matcher: "Edit.*", cond: "regex" },
  ]);
});

test("PHOOK-01: unmapped tool (MultiEdit) drops the group with cond=unmapped-tool (b)", () => {
  const partition = partitionHooks({
    PreToolUse: [{ matcher: "MultiEdit", hooks: [{ type: "command", command: "/bin/false" }] }],
  });
  assert.deepEqual(partition.supported, {});
  assert.deepEqual(partition.dropped, [
    { kind: "group", event: "PreToolUse", matcher: "MultiEdit", cond: "unmapped-tool" },
  ]);
});

test("PHOOK-01: non-bucket-A event (Stop) drops the whole event (P1)", () => {
  const partition = partitionHooks({
    Stop: [{ matcher: "", hooks: [{ type: "command", command: "/bin/false" }] }],
  });
  assert.deepEqual(partition.supported, {});
  assert.deepEqual(partition.dropped, [{ kind: "event", event: "Stop" }]);
});

test("PHOOK-01: non-empty matcher on UserPromptSubmit drops the group with cond=no-matcher-support (c)", () => {
  // Pi-side / Claude-side disposition: UserPromptSubmit has no upstream
  // matcher support, so any non-empty matcher drops the group per
  // strict-supportability stance (D-58-06).
  const partition = partitionHooks({
    UserPromptSubmit: [
      { matcher: "anything", hooks: [{ type: "command", command: "/bin/false" }] },
    ],
  });
  assert.deepEqual(partition.supported, {});
  assert.deepEqual(partition.dropped, [
    {
      kind: "group",
      event: "UserPromptSubmit",
      matcher: "anything",
      cond: "no-matcher-support",
    },
  ]);
});

test("PHOOK-01: SessionStart source=clear drops the group with cond=closed-set (c)", () => {
  // Pi `SessionStartEvent.reason` does NOT expose `clear` -- strict-
  // supportability trip (D-58-06).
  const partition = partitionHooks({
    SessionStart: [{ matcher: "clear", hooks: [{ type: "command", command: "/bin/false" }] }],
  });
  assert.deepEqual(partition.supported, {});
  assert.deepEqual(partition.dropped, [
    { kind: "group", event: "SessionStart", matcher: "clear", cond: "closed-set" },
  ]);
});

test("PHOOK-01: SessionStart source=startup is admissible (no drop)", () => {
  // Pi-side analog: `startup` IS in the SessionStart closed set.
  const config = {
    SessionStart: [{ matcher: "startup", hooks: [{ type: "command", command: "/bin/false" }] }],
  };
  const partition = partitionHooks(config);
  assert.deepEqual(partition.supported, config);
  assert.deepEqual(partition.dropped, []);
});

test("PHOOK-01: PreCompact trigger=manual drops the group with cond=closed-set (c)", () => {
  // Pi compact events carry no `trigger` field -- empty closed set; every
  // non-empty matcher trips (D-58-06).
  const partition = partitionHooks({
    PreCompact: [{ matcher: "manual", hooks: [{ type: "command", command: "/bin/false" }] }],
  });
  assert.deepEqual(partition.supported, {});
  assert.deepEqual(partition.dropped, [
    { kind: "group", event: "PreCompact", matcher: "manual", cond: "closed-set" },
  ]);
});

test("PHOOK-01: PreCompact empty matcher is admissible (match-all, no drop)", () => {
  // Match-all is always supportable on every bucket-A event per D-58-06.
  const config = {
    PreCompact: [{ matcher: "", hooks: [{ type: "command", command: "/bin/false" }] }],
  };
  const partition = partitionHooks(config);
  assert.deepEqual(partition.supported, config);
  assert.deepEqual(partition.dropped, []);
});

test("PHOOK-01 / Q1: non-command handler (http) drops at HANDLER granularity (d)", () => {
  // HOOK-03 lenient schema accepts unknown handler types; the partition
  // drops the non-command handler at HANDLER granularity (Q1). The group's
  // only handler dropped, so the group and event are omitted entirely.
  const partition = partitionHooks({
    PreToolUse: [{ matcher: "Edit", hooks: [{ type: "http", command: "/bin/false" }] }],
  });
  assert.deepEqual(partition.supported, {});
  assert.deepEqual(partition.dropped, [
    { kind: "handler", event: "PreToolUse", matcher: "Edit", handlerType: "http" },
  ]);
});

test("PHOOK-01: a fully supportable config partitions to itself with no drops", () => {
  const config = {
    PreToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "/bin/false" }] }],
  };
  const partition = partitionHooks(config);
  assert.deepEqual(partition.supported, config);
  assert.deepEqual(partition.dropped, []);
});

test("D-71-02: a mixed event keeps the clean group and drops only the unsupportable group", () => {
  // One PreToolUse event with a clean Edit group and a regex `.*` group --
  // the clean group survives and source group order is preserved.
  const partition = partitionHooks({
    PreToolUse: [
      { matcher: "Edit", hooks: [{ type: "command", command: "/bin/edit" }] },
      { matcher: ".*", hooks: [{ type: "command", command: "/bin/regex" }] },
    ],
  });
  assert.deepEqual(partition.supported, {
    PreToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "/bin/edit" }] }],
  });
  assert.deepEqual(partition.dropped, [
    { kind: "group", event: "PreToolUse", matcher: ".*", cond: "regex" },
  ]);
});

test("D-71-01: a supported event survives while a sibling non-bucket-A event drops", () => {
  const partition = partitionHooks({
    PostToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "/bin/edit" }] }],
    Stop: [{ hooks: [{ type: "command", command: "/bin/stop" }] }],
  });
  assert.deepEqual(partition.supported, {
    PostToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "/bin/edit" }] }],
  });
  assert.deepEqual(partition.dropped, [{ kind: "event", event: "Stop" }]);
});

test("PHOOK-01 / Q1: a group with command + non-command handlers keeps the command handler", () => {
  const partition = partitionHooks({
    PreToolUse: [
      {
        matcher: "Edit",
        hooks: [
          { type: "command", command: "/bin/ok" },
          { type: "http", command: "/bin/nope" },
        ],
      },
    ],
  });
  assert.deepEqual(partition.supported, {
    PreToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "/bin/ok" }] }],
  });
  assert.deepEqual(partition.dropped, [
    { kind: "handler", event: "PreToolUse", matcher: "Edit", handlerType: "http" },
  ]);
});

// PHOOK-03 / D-71-03: parseHooksConfig success arm returns the FILTERED
// subset as `value` plus the `dropped` enumeration; structural S1/S2 still
// fail (asserted in the discriminated-result block above).
test("PHOOK-03: parseHooksConfig success arm returns the filtered subset as value plus dropped", () => {
  const raw = JSON.stringify({
    PostToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "/bin/edit" }] }],
    Stop: [{ hooks: [{ type: "command", command: "/bin/stop" }] }],
  });
  const result = parseHooksConfig(raw, TEST_IF_CTX, TEST_COMPILE_IF);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, {
      PostToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "/bin/edit" }] }],
    });
    assert.deepEqual(result.dropped, [{ kind: "event", event: "Stop" }]);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// HOOK_HANDLER_SCHEMA asyncRewake / rewakeMessage / rewakeSummary admission
// HOOK-06 / EXEC-05: schema-level admission only; runtime narrowing lives
// in the bridges/hooks/async-rewake/ registry per HOOK-03 lenient stance.
// ──────────────────────────────────────────────────────────────────────────

test("HOOK_HANDLER_SCHEMA admits asyncRewake / rewakeMessage / rewakeSummary as optional", () => {
  assert.equal(
    HOOKS_VALIDATOR.Check({
      PreToolUse: [
        {
          matcher: "Edit",
          hooks: [
            {
              type: "command",
              command: "/bin/false",
              asyncRewake: true,
              rewakeMessage: "Security review",
              rewakeSummary: "Background scan ran",
            },
          ],
        },
      ],
    }),
    true,
  );
});

test("HOOK_HANDLER_SCHEMA accepts non-boolean asyncRewake (HOOK-03 lenient)", () => {
  assert.equal(
    HOOKS_VALIDATOR.Check({
      PreToolUse: [
        {
          matcher: "Edit",
          hooks: [{ type: "command", command: "/bin/false", asyncRewake: "yes" }],
        },
      ],
    }),
    true,
  );
});

test("HOOK_HANDLER_SCHEMA accepts non-string rewakeMessage / rewakeSummary (HOOK-03 lenient)", () => {
  assert.equal(
    HOOKS_VALIDATOR.Check({
      PreToolUse: [
        {
          matcher: "Edit",
          hooks: [
            { type: "command", command: "/bin/false", rewakeMessage: 42, rewakeSummary: null },
          ],
        },
      ],
    }),
    true,
  );
});

test("HOOK_HANDLER_SCHEMA still requires `command` on type:'command' when asyncRewake is set", () => {
  assert.equal(
    HOOKS_VALIDATOR.Check({
      PreToolUse: [
        {
          matcher: "Edit",
          hooks: [{ type: "command", asyncRewake: true, rewakeMessage: "x" }],
        },
      ],
    }),
    false,
  );
});

test("HOOK_HANDLER_SCHEMA explicitly lists asyncRewake / rewakeMessage / rewakeSummary in its properties block", async () => {
  // Distinguishes "lenient additionalProperties:true admits the field"
  // from "the schema explicitly names the field". The contract requires the
  // three names to land in the properties block alongside the existing
  // HOOK-03 admissions (statusMessage / once / async / shell / args) so
  // a downstream `additionalProperties:false` audit, plus the
  // documentation surface the schema exposes, both pin the field family
  // as a first-class admission.
  const source = await readFile(
    new URL(
      "../../../extensions/pi-claude-marketplace/domain/components/hooks.ts",
      import.meta.url,
    ),
    "utf8",
  );
  // The properties block should declare each of the three names by
  // literal key. The empty-object JSON Schema value (`asyncRewake: {}`)
  // is the HOOK-03 lenient marker.
  for (const name of ["asyncRewake", "rewakeMessage", "rewakeSummary"]) {
    assert.match(source, new RegExp(`${name}\\s*:\\s*\\{\\s*\\}`));
  }
});

test("parseHooksConfig admits the full asyncRewake field family", () => {
  const raw = JSON.stringify({
    PreToolUse: [
      {
        matcher: "Edit",
        hooks: [
          {
            type: "command",
            command: "/bin/false",
            asyncRewake: true,
            rewakeMessage: "Security review",
            rewakeSummary: "Background scan ran",
          },
        ],
      },
    ],
  });
  const result = parseHooksConfig(raw, TEST_IF_CTX, TEST_COMPILE_IF);
  assert.equal(result.ok, true);
});

// ──────────────────────────────────────────────────────────────────────────
// HOOK-03 / LIFE-01: upstream plugin-format wrapper acceptance (wire-format
// pin). Claude Code's `plugin-dev/skills/hook-development/SKILL.md` mandates
// that plugin `hooks/hooks.json` files use the WRAPPER form
// `{description?, hooks: {<event>: [...]}}`, distinct from user-settings
// `.claude/settings.json` which uses the BARE top-level-event-keys form.
//
// The fixture under `tests/fixtures/hookify-hooks.json` is derived from
// hookify@claude-plugins-official's hooks.json (`tmp/pi-uat/agent/
// pi-claude-marketplace/sources/claude-plugins-official/plugins/hookify/
// hooks/hooks.json`) with one deliberate slim: the upstream `Stop` event arm
// is REMOVED because `Stop` is NOT a member of `BUCKET_A_EVENTS` (see
// `extensions/pi-claude-marketplace/domain/components/hook-events.ts`).
// v1.13's supportability gate `checkMatcherSupportability` trips
// `(c) non-bucket-A event: Stop` before the wrapper-acceptance verdict can
// land. The slim isolates this test to the wire-format wrapper question --
// the only question this plan owns. Stop-event admission is deferred
// (`BUCKET_A_EVENTS` extension is a sibling concern, v1.14+).
//
// The fixture pins the parser's wrapper-detection arm against real upstream
// wire bytes; any future schema change that re-narrows the parser to the
// settings-format shape red-fails here.
// ──────────────────────────────────────────────────────────────────────────

const FIXTURE_DIR = path.dirname(fileURLToPath(import.meta.url));

test("parseHooksConfig accepts the upstream plugin-format wrapper (hookify wire bytes, bucket-A slim)", async () => {
  const fixturePath = path.resolve(FIXTURE_DIR, "../../fixtures/hookify-hooks.json");
  const raw = await readFile(fixturePath, "utf8");

  const result = parseHooksConfig(raw, TEST_IF_CTX, TEST_COMPILE_IF, { skipIfMap: true });

  assert.equal(result.ok, true);
  if (result.ok) {
    // After the wrapper-unwrap arm, the parser's `value` is the bare
    // event-keys record sourced from the upstream wrapper's `hooks` field.
    // Bucket-A event keys hookify ships (Stop arm slimmed to keep the
    // fixture inside v1.13's BUCKET_A_EVENTS scope).
    assert.ok("PreToolUse" in result.value);
    assert.ok("PostToolUse" in result.value);
    assert.ok("UserPromptSubmit" in result.value);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// PHOOK-01 / D-71-02 partial-hook fixtures. Synthetic configs mirroring the
// upstream plugin-format wrapper shape plus an unsupportable element, since
// the live validation-target plugins (hookify / ralph-loop /
// security-guidance) are not in the local checkout.
// ──────────────────────────────────────────────────────────────────────────

test("PHOOK-01: hooks-stop-only fixture partitions to the empty subset (Q2 edge)", async () => {
  const raw = await readFile(
    path.resolve(FIXTURE_DIR, "../../fixtures/hooks-stop-only.json"),
    "utf8",
  );
  const result = parseHooksConfig(raw, TEST_IF_CTX, TEST_COMPILE_IF, { skipIfMap: true });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.value, {});
    assert.deepEqual(result.dropped, [{ kind: "event", event: "Stop" }]);
  }
});

test("PHOOK-01: hooks-posttooluse-and-stop fixture keeps PostToolUse, drops Stop", async () => {
  const raw = await readFile(
    path.resolve(FIXTURE_DIR, "../../fixtures/hooks-posttooluse-and-stop.json"),
    "utf8",
  );
  const result = parseHooksConfig(raw, TEST_IF_CTX, TEST_COMPILE_IF, { skipIfMap: true });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok("PostToolUse" in result.value);
    assert.ok(!("Stop" in result.value));
    assert.deepEqual(result.dropped, [{ kind: "event", event: "Stop" }]);
  }
});

test("D-71-02: hooks-pretooluse-matcher-mix fixture keeps the clean group, drops the regex group", async () => {
  const raw = await readFile(
    path.resolve(FIXTURE_DIR, "../../fixtures/hooks-pretooluse-matcher-mix.json"),
    "utf8",
  );
  const result = parseHooksConfig(raw, TEST_IF_CTX, TEST_COMPILE_IF, { skipIfMap: true });
  assert.equal(result.ok, true);
  if (result.ok) {
    const groups = result.value.PreToolUse;
    assert.ok(groups !== undefined, "PreToolUse must survive the partition");
    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.matcher, "Edit");
    assert.deepEqual(result.dropped, [
      { kind: "group", event: "PreToolUse", matcher: ".*", cond: "regex" },
    ]);
  }
});
