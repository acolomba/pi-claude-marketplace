// Strict-mode resolver coverage. 1:1 mapping between PR-2 cases and tests
// (9 tests for the 9 cases). Plus PR-3 multi, PR-4 implicit-by-convention
// (positive + negative), PR-5 dependencies, PR-6 requireInstallable
// narrowing/throwing, and one MM-5 happy path.

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  type GitPluginRootResult,
  type MaterializablePlugin,
  type ResolveContext,
  type ResolvedPlugin,
  type ResolvedPluginInstallable,
  type ResolvedPluginPartiallyAvailable,
  type ResolvedPluginUnavailable,
  rowClaimsInstallDisabled,
  resolveLoose,
  requirePartialInstallable,
  requireInstallable,
  resolveStrict,
} from "../../extensions/pi-claude-marketplace/domain/resolver.ts";
import { PluginShapeError } from "../../extensions/pi-claude-marketplace/shared/errors.ts";

import type { PluginEntry } from "../../extensions/pi-claude-marketplace/domain/components/plugin.ts";

/**
 * Build an in-memory ResolveContext. `files` maps absolute paths to either:
 *   - "dir"           -> directory exists
 *   - "file"          -> file exists, but readFileText is not stubbed (will throw)
 *   - { contents: s } -> file exists with given contents
 * Anything not in the map -> null (does not exist).
 */
function resolveContext(
  marketplaceRoot: string,
  files: Record<string, "dir" | "file" | { contents: string }>,
): ResolveContext {
  return {
    marketplaceRoot,
    statKind(p: string): Promise<"file" | "dir" | null> {
      const v = files[p];

      if (v === undefined) {
        return Promise.resolve(null);
      }

      if (v === "dir") {
        return Promise.resolve("dir");
      }

      return Promise.resolve("file");
    },
    readFileText(p: string): Promise<string> {
      const v = files[p];

      if (v && typeof v === "object" && "contents" in v) {
        return Promise.resolve(v.contents);
      }

      return Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    },
  };
}

const marketplaceRoot = "/abs/marketplace";
const pathUnderMarketplace = (rel: string): string => path.resolve(marketplaceRoot, rel);

const FIXTURE_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Load a `tests/fixtures/<name>.json` payload as a raw string. */
function fixture(name: string): Promise<string> {
  return readFile(path.resolve(FIXTURE_DIR, "../fixtures", `${name}.json`), "utf8");
}

/**
 * Test entries are intentionally typed as `Record<string, unknown>` (the third-party
 * boundary -- a marketplace.json author can put any garbage here). The resolver's
 * job is to classify it; tests must therefore be free to construct shapes that
 * violate PluginEntry's type. We assert-cast at the resolver boundary.
 */
type LooseEntry = Record<string, unknown>;

function pluginEntry(over: LooseEntry = {}): PluginEntry {
  return { name: "p1", source: "./local", ...over };
}

const unsupportedConventionScenarios = [
  { kind: "lspServers", relativePath: ".lsp.json", stat: { contents: "{}" } },
  {
    kind: "monitors",
    relativePath: path.join("monitors", "monitors.json"),
    stat: { contents: "[]" },
  },
  { kind: "themes", relativePath: "themes", stat: "dir" },
  { kind: "outputStyles", relativePath: "output-styles", stat: "dir" },
  { kind: "settings", relativePath: "settings.json", stat: { contents: "{}" } },
] as const;

// ──────────────────────────────────────────────────────────────────────────
// PR-2: nine non-installable cases (1 test per case)
// ──────────────────────────────────────────────────────────────────────────

// PURL-01: a github source is no longer rejected as an unsupported kind. With
// NO resolveGitPluginRoot injected (the pure path-only caller), it resolves
// `unavailable` because git sources require a clone-cache resolver -- the
// path-only back-compat arm, NOT the old "unsupported source kind" rejection.
test("PR-2(1) github source with no clone resolver -> unavailable (requires clone resolver)", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, {});

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "owner/repo" }), context);

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("clone")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

// PURL-01: same for an object-form url source -- no longer "unsupported source
// kind: url"; without an injected callback it needs a clone resolver.
test("PR-2(1) url source with no clone resolver -> unavailable (requires clone resolver)", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, {});

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: { source: "url", url: "https://gitlab.com/obra/superpowers.git" } }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("clone")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

test("PR-2(2) source path escape -> notInstallable", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, {});

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "../escape" }), context);

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("escapes marketplace root")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

test("PR-2(3) source dir does not exist -> notInstallable", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, {}); // no entries -> statKind returns null

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./missing" }), context);

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("source dir does not exist")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

test("PR-2(4) malformed plugin.json -> notInstallable", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, {
    [pathUnderMarketplace("./local")]: "dir",
    [path.join(pathUnderMarketplace("./local"), ".claude-plugin", "plugin.json")]: {
      contents: "{ not json",
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("malformed plugin.json")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

// HOOK-01: hooks moved from UNSUPPORTED to SUPPORTED. A plugin declaring
// `hooks` at the entry level with NO hooks/hooks.json on disk is no longer
// rejected with "contains hooks" -- the resolver only owns convention-file
// discovery; entry/manifest-level hooks-field semantics are deferred to
// future dispatch work.
test("HOOK-01: entry declares hooks field but no hooks/hooks.json on disk -> installable WITHOUT hooks in supported", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", hooks: { onLoad: "x" } }),
    context,
  );

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );

  if (resolvedPlugin.state === "installable") {
    assert.ok(!resolvedPlugin.supported.includes("hooks"));
    assert.ok(
      !resolvedPlugin.notes.some((n) => n.includes("contains hooks")),
      `notes must no longer contain "contains hooks": ${resolvedPlugin.notes.join(" / ")}`,
    );
  }
});

// HOOK-01 / D-57-04: a parseable hooks/hooks.json on disk admits the plugin
// with hooks added to the supported set (mirrors the supported-side
// implicit-by-convention pattern used for skills/commands/agents).
test("HOOK-01: hooks/hooks.json present + parseable -> installable WITH hooks in supported", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo hi" }] }],
      }),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );

  if (resolvedPlugin.state === "installable") {
    assert.ok(resolvedPlugin.supported.includes("hooks"));
    assert.ok(
      !resolvedPlugin.notes.some((n) => n.includes("contains hooks")),
      `notes must no longer contain "contains hooks": ${resolvedPlugin.notes.join(" / ")}`,
    );
  }
});

// D-90-06: bin moved out of UNSUPPORTED_COMPONENT_KINDS. A plugin whose only
// on-disk payload is a `bin/` directory resolves installable (its bin/ is
// honored at runtime by the PENV-01 PATH ledger, not staged as a component),
// with no `contains bin` note and bin absent from unsupported.
test("D-90-06: bin/ dir on disk -> installable, no bin contains-note, bin not in unsupported", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "bin")]: "dir",
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );

  assert.ok(
    !resolvedPlugin.notes.some((n) => n.includes("contains bin")),
    `notes must not contain "contains bin": ${resolvedPlugin.notes.join(" / ")}`,
  );
});

// D-90-06: a `bin` field declared in the entry likewise resolves installable
// with no `contains bin` note.
test("D-90-06: entry declares a bin field -> installable, no bin contains-note", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", bin: "bin" }),
    context,
  );

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );
  assert.ok(
    !resolvedPlugin.notes.some((n) => n.includes("contains bin")),
    `notes must not contain "contains bin": ${resolvedPlugin.notes.join(" / ")}`,
  );
});

// ADMIT-01: a plugin declaring a `Stop` group (match-all matcher) alongside
// a supported bucket-A event resolves fully `installable` -- Stop is admitted
// (match-all is always supportable, and Stop carries the null no-matcher
// sentinel), so there is no `{unsupported hooks}` partition drop. This is the
// end-to-end admission proof: config -> partitionHooks -> resolver verdict.
test("ADMIT-01: hooks.json with a match-all Stop group + a supported event -> installable, no Stop drop", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo hi" }] }],
        Stop: [{ matcher: "", hooks: [{ type: "command", command: "echo stop" }] }],
      }),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );

  if (resolvedPlugin.state === "installable") {
    assert.ok(resolvedPlugin.supported.includes("hooks"));
    assert.ok(
      !resolvedPlugin.notes.some((n) => n.includes("unsupported hooks")),
      `notes must not report unsupported hooks: ${resolvedPlugin.notes.join(" / ")}`,
    );
  }
});

// ADMIT-02 (edge: adjacency): the real hookify wire bytes declare `Stop`
// ALONGSIDE already-supported bucket-A events (PreToolUse, PostToolUse,
// UserPromptSubmit). Every arm sits in the SAME supported partition -- Stop is
// not carved into an `{unsupported hooks}` drop -- so the plugin resolves fully
// `installable` with `hooks` supported and no droppedHooks. Fixture-backed proof
// (real claude-plugins-official bytes) that growing BUCKET_A_MEMBERS admits Stop
// with zero new admission code.
test("ADMIT-02: hookify fixture (Stop + bucket-A events) -> installable, no Stop/StopFailure drop", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: await fixture("hookify-hooks"),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );

  if (resolvedPlugin.state === "installable") {
    assert.ok(
      resolvedPlugin.supported.includes("hooks"),
      `supported: ${resolvedPlugin.supported.join(" / ")}`,
    );
    assert.strictEqual(resolvedPlugin.hooksConfigPath, path.join("hooks", "hooks.json"));
    // No partition drop for Stop (or any arm): the supported subset retained
    // everything, so the installable variant carries no droppedHooks.
    assert.strictEqual(resolvedPlugin.droppedHooks, undefined);
    assert.ok(
      !resolvedPlugin.notes.some((n) => n.includes("unsupported hooks")),
      `notes must not report unsupported hooks: ${resolvedPlugin.notes.join(" / ")}`,
    );
  }
});

// ADMIT-02 (edge: empty): a Stop-only plugin (ralph-wiggum fixture, no other
// bucket-A event) resolves fully `installable` with a NON-empty supported
// subset -- `hooks` in supported, hooksConfigPath recorded. This is the
// counterpoint to the Notification-only empty-subset case below (which drops to
// `partially-available` with no hooksConfigPath): a Stop-only config is admitted
// because Stop IS bucket-A, so its subset is non-empty.
test("ADMIT-02: ralph-wiggum fixture (Stop-only) -> installable with a non-empty supported subset", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: await fixture("ralph-wiggum-hooks"),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );

  if (resolvedPlugin.state === "installable") {
    assert.ok(
      resolvedPlugin.supported.includes("hooks"),
      `supported: ${resolvedPlugin.supported.join(" / ")}`,
    );
    assert.strictEqual(resolvedPlugin.hooksConfigPath, path.join("hooks", "hooks.json"));
    assert.strictEqual(resolvedPlugin.droppedHooks, undefined);
    assert.ok(
      !resolvedPlugin.notes.some((n) => n.includes("unsupported hooks")),
      `notes must not report unsupported hooks: ${resolvedPlugin.notes.join(" / ")}`,
    );
  }
});

// D-57-04: structurally-malformed hooks/hooks.json flips installable: false
// with the parse-failure detail surfaced in notes.
test("D-57-04: hooks/hooks.json present + parse-fails -> notInstallable + parse-detail note", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: { contents: "not-valid-json" },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some(
      (n) => n.includes("malformed hooks.json") || n.includes("hooks.json"),
    ),
    `notes must mention hooks.json parse failure: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

// D-57-04 parse-fail second arm: structurally-malformed JSON (valid syntax,
// wrong shape per HOOKS_VALIDATOR) also flips installable: false.
test("D-57-04: hooks/hooks.json with structural-shape mismatch -> notInstallable", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    // Top-level value not an array -> HOOKS_VALIDATOR rejects.
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({ PreToolUse: "not-an-array" }),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("hooks.json")),
    `notes must mention hooks.json: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

// PHOOK-02 / D-71-03: a hooks.json that PARSES but drops a non-bucket-A
// event (here `Notification`) while keeping a supported group resolves the
// force-degradable `unsupported` arm, NOT `unavailable`. The kept group still
// materializes (hooksConfigPath recorded, `"hooks"` in supported) and the
// dropped `Notification` is enumerated in droppedHooks. `"hooks"` is
// intentionally a member of BOTH supported and unsupported (dual membership).
test("PHOOK-02 / D-71-03: hooks.json with a kept group + dropped Notification event -> unsupported", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: await fixture("hooks-posttooluse-and-notification"),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "partially-available",
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );

  if (resolvedPlugin.state === "partially-available") {
    assert.ok(
      resolvedPlugin.unsupported.includes("hooks"),
      `unsupported: ${resolvedPlugin.unsupported.join(" / ")}`,
    );
    assert.ok(
      resolvedPlugin.supported.includes("hooks"),
      `supported: ${resolvedPlugin.supported.join(" / ")}`,
    );
    assert.strictEqual(resolvedPlugin.hooksConfigPath, path.join("hooks", "hooks.json"));
    assert.deepStrictEqual(resolvedPlugin.droppedHooks, [{ kind: "event", event: "Notification" }]);
  }
});

// D-71-02 / PHOOK-02: an intra-event matcher mix keeps the clean group and
// drops only the unsupportable (regex) group. The event survives partially:
// `unsupported` with hooksConfigPath recorded and the regex group enumerated.
test("D-71-02: intra-event matcher mix keeps the clean group, drops the regex group -> unsupported", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: await fixture("hooks-pretooluse-matcher-mix"),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "partially-available",
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );

  if (resolvedPlugin.state === "partially-available") {
    assert.ok(
      resolvedPlugin.unsupported.includes("hooks"),
      `unsupported: ${resolvedPlugin.unsupported.join(" / ")}`,
    );
    assert.ok(
      resolvedPlugin.supported.includes("hooks"),
      `supported: ${resolvedPlugin.supported.join(" / ")}`,
    );
    assert.strictEqual(resolvedPlugin.hooksConfigPath, path.join("hooks", "hooks.json"));
    assert.deepStrictEqual(resolvedPlugin.droppedHooks, [
      { kind: "group", event: "PreToolUse", matcher: ".*", cond: "regex" },
    ]);
  }
});

// D-71-03 / Q2: a Notification-only config filters to the EMPTY subset. It
// still resolves `unsupported` (droppedHooks recorded) but stages nothing: no
// hooksConfigPath and `"hooks"` is absent from supported (mirrors the
// LSP-only precedent where force installs nothing).
test("D-71-03 / Q2: Notification-only config (empty subset) -> unsupported, no hooksConfigPath, hooks absent from supported", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: await fixture("hooks-notification-only"),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "partially-available",
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );

  if (resolvedPlugin.state === "partially-available") {
    assert.ok(
      resolvedPlugin.unsupported.includes("hooks"),
      `unsupported: ${resolvedPlugin.unsupported.join(" / ")}`,
    );
    assert.ok(
      !resolvedPlugin.supported.includes("hooks"),
      `supported must omit hooks: ${resolvedPlugin.supported.join(" / ")}`,
    );
    assert.strictEqual(resolvedPlugin.hooksConfigPath, undefined);
    assert.deepStrictEqual(resolvedPlugin.droppedHooks, [{ kind: "event", event: "Notification" }]);
  }
});

// WR-02 (D-58 review): an I/O failure reading hooks/hooks.json
// PROPAGATES out of resolveStrict instead of being wrapped with the
// `malformed hooks.json:` prefix and lumped into the `{unsupported hooks}`
// bucket. The outer `narrowProbeError` ladder (used by list / info)
// classifies the thrown error by `.code` so the row reports the truthful
// failure class (e.g. `{permission denied}` for EACCES).
test("WR-02: hooks/hooks.json EACCES propagates out of resolveStrict (not wrapped as malformed)", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const hooksPath = path.join(localRoot, "hooks", "hooks.json");
  // Custom context: statKind reports the file exists, readFileText
  // throws EACCES (the file is readable to stat but not to read).
  const context: ResolveContext = {
    marketplaceRoot: marketplaceRoot,
    statKind(p: string): Promise<"file" | "dir" | null> {
      if (p === localRoot) {
        return Promise.resolve("dir");
      }

      if (p === hooksPath) {
        return Promise.resolve("file");
      }

      return Promise.resolve(null);
    },
    readFileText(p: string): Promise<string> {
      if (p === hooksPath) {
        return Promise.reject(Object.assign(new Error("EACCES"), { code: "EACCES" }));
      }

      return Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    },
  };

  // act & assert
  await assert.rejects(
    () => resolveStrict(pluginEntry({ source: "./local" }), context),
    (error: unknown) => {
      assert.ok(error instanceof Error, "rejection must be an Error");
      assert.strictEqual(
        (error as NodeJS.ErrnoException).code,
        "EACCES",
        "EACCES must propagate unchanged for narrowProbeError to classify",
      );
      return true;
    },
  );
});

// SURF-05 / D-63-08: a handler with `rewakeMessage` and NO `asyncRewake: true`
// flips `partial.orphanRewake = true`. One-per-plugin invariant -- a single
// orphan handler is enough.
test("SURF-05 / D-63-08: rewakeMessage without asyncRewake -> orphanRewake === true", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [{ type: "command", command: "echo orphan", rewakeMessage: "follow up please" }],
          },
        ],
      }),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );
  if (resolvedPlugin.state === "installable") {
    assert.strictEqual(resolvedPlugin.orphanRewake, true);
  }
});

// SURF-05 / D-63-08: the SAME handler with `asyncRewake: true` is no longer
// orphan -- the companion field has its required parent. Resolver leaves
// `orphanRewake` absent (absence-or-false invariant).
test("SURF-05 / D-63-08: rewakeMessage WITH asyncRewake: true -> orphanRewake absent (no warning)", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [
              {
                type: "command",
                command: "echo paired",
                asyncRewake: true,
                rewakeMessage: "follow up please",
              },
            ],
          },
        ],
      }),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );
  if (resolvedPlugin.state === "installable") {
    assert.strictEqual(resolvedPlugin.orphanRewake, undefined);
  }
});

// SURF-05 / D-63-08: `rewakeSummary` is the second orphan-bearing companion
// field; absence of `asyncRewake: true` ALSO flips the flag (covers both
// fields in the family).
test("SURF-05 / D-63-08: rewakeSummary without asyncRewake -> orphanRewake === true", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({
        PostToolUse: [
          {
            matcher: "Edit",
            hooks: [{ type: "command", command: "echo summary", rewakeSummary: "what happened" }],
          },
        ],
      }),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );
  if (resolvedPlugin.state === "installable") {
    assert.strictEqual(resolvedPlugin.orphanRewake, true);
  }
});

// SURF-05 / D-63-08: one-per-plugin invariant -- multiple groups across
// multiple events with ONLY ONE orphan handler still emit a single
// plugin-level flag (no per-handler aggregation).
test("SURF-05 / D-63-08: multi-event / multi-group config with ONE orphan -> orphanRewake === true (one-per-plugin)", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [{ type: "command", command: "echo ok" }],
          },
        ],
        PostToolUse: [
          {
            matcher: "Edit",
            hooks: [
              { type: "command", command: "echo first" },
              {
                type: "command",
                command: "echo second",
                rewakeMessage: "orphan #1",
              },
            ],
          },
          {
            matcher: "Write",
            hooks: [{ type: "command", command: "echo write" }],
          },
        ],
        SessionStart: [{ hooks: [{ type: "command", command: "echo start" }] }],
      }),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );
  if (resolvedPlugin.state === "installable") {
    // boolean flag -- no count of N orphan handlers, just the single bit.
    assert.strictEqual(resolvedPlugin.orphanRewake, true);
  }
});

// SURF-05 / D-63-08: a hooks.json that exists and parses but contains NO
// rewake companion fields at all leaves `orphanRewake` absent. Regression
// guard for the no-op happy path.
test("SURF-05 / D-63-08: hooks.json without any rewake fields -> orphanRewake absent", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo ok" }] }],
      }),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );
  if (resolvedPlugin.state === "installable") {
    assert.strictEqual(resolvedPlugin.orphanRewake, undefined);
  }
});

// HOOK-01 regression guard: absent hooks/hooks.json + no entry/manifest
// declaration -> installable: true and hooks NOT in supported. This is the
// no-hooks happy path; the supported-side convention probe must not invent
// a hooks entry where none exists on disk.
test("HOOK-01: no hooks declared and no hooks/hooks.json -> installable WITHOUT hooks in supported", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(resolvedPlugin.state, "installable");

  if (resolvedPlugin.state === "installable") {
    assert.ok(!resolvedPlugin.supported.includes("hooks"));
  }
});

for (const scenario of unsupportedConventionScenarios) {
  test(`PR-4 discovers the unsupported ${scenario.kind} default location`, async () => {
    // arrange
    const localRoot = pathUnderMarketplace(`./local-${scenario.kind}`);
    const context = resolveContext(marketplaceRoot, {
      [localRoot]: "dir",
      [path.join(localRoot, scenario.relativePath)]: scenario.stat,
    });

    // act
    const resolvedPlugin = await resolveStrict(
      pluginEntry({ source: `./local-${scenario.kind}` }),
      context,
    );

    // assert
    assert.strictEqual(
      resolvedPlugin.state,
      "partially-available",
      `${scenario.kind} should be unsupported`,
    );
    assert.ok(
      resolvedPlugin.notes.includes(`contains ${scenario.kind}`),
      `notes: ${resolvedPlugin.notes.join(" / ")}`,
    );
    if (resolvedPlugin.state === "partially-available") {
      assert.ok(
        resolvedPlugin.unsupported.includes(scenario.kind),
        `unsupported: ${resolvedPlugin.unsupported.join(" / ")}`,
      );
    }
  });
}

test("PR-3 experimental themes/monitors declarations are unsupported", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [manifestPath]: {
      contents: JSON.stringify({
        name: "p1",
        experimental: { themes: "./themes", monitors: "./monitors.json" },
      }),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);
  // D-64-06: unsupported component kinds, no structural defect -> unsupported.

  // assert
  assert.strictEqual(resolvedPlugin.state, "partially-available");
  assert.ok(
    resolvedPlugin.notes.includes("contains themes"),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
  assert.ok(
    resolvedPlugin.notes.includes("contains monitors"),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

test("PR-2(6) malformed mcpServers (array form) -> notInstallable", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", mcpServers: [1, 2, 3] }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("malformed mcpServers")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

// ──────────────────────────────────────────────────────────────────────────
// DFEN-01 / DFEN-02: install-time enablement -- the precedence truth table
//
// The marketplace entry wins over `plugin.json` in BOTH directions; absent at
// both declaration sites is `true`. The whole table lives here so a reader
// meets every cell at once rather than inferring the unstated ones.
// ──────────────────────────────────────────────────────────────────────────

test("DFEN-02 entry false + manifest true -> installable carrying false (entry wins)", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, {
    [pathUnderMarketplace("./local")]: "dir",
    [path.join(pathUnderMarketplace("./local"), ".claude-plugin", "plugin.json")]: {
      contents: JSON.stringify({ name: "p1", defaultEnabled: true }),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", defaultEnabled: false }),
    context,
  );

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );
  requireInstallable(resolvedPlugin);
  assert.strictEqual(resolvedPlugin.defaultEnabled, false);
});

// D-101-07: the direction a reader is most likely to guess wrong. Nothing about
// the false-wins case implies this one, so it is pinned separately.
test("DFEN-02 entry true + manifest false -> installable carrying true (entry wins both ways)", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, {
    [pathUnderMarketplace("./local")]: "dir",
    [path.join(pathUnderMarketplace("./local"), ".claude-plugin", "plugin.json")]: {
      contents: JSON.stringify({ name: "p1", defaultEnabled: false }),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", defaultEnabled: true }),
    context,
  );

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );
  requireInstallable(resolvedPlugin);
  assert.strictEqual(resolvedPlugin.defaultEnabled, true);
});

// Agreement between the two declaration sites is not a conflict and not a
// redundancy worth reporting: the resolved value carries, and nothing about the
// field reaches `notes`. Asserting the value alone would not catch a diagnostic.
test("DFEN-02 entry false + manifest false -> installable carrying false, no diagnostic", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, {
    [pathUnderMarketplace("./local")]: "dir",
    [path.join(pathUnderMarketplace("./local"), ".claude-plugin", "plugin.json")]: {
      contents: JSON.stringify({ name: "p1", defaultEnabled: false }),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", defaultEnabled: false }),
    context,
  );

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );
  assert.ok(
    !resolvedPlugin.notes.some((n) => n.includes("defaultEnabled")),
    `agreement must emit no note, notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
  requireInstallable(resolvedPlugin);
  assert.strictEqual(resolvedPlugin.defaultEnabled, false);
});

test("DFEN-02 entry true + manifest true -> installable carrying true, no diagnostic", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, {
    [pathUnderMarketplace("./local")]: "dir",
    [path.join(pathUnderMarketplace("./local"), ".claude-plugin", "plugin.json")]: {
      contents: JSON.stringify({ name: "p1", defaultEnabled: true }),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", defaultEnabled: true }),
    context,
  );

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );
  assert.ok(
    !resolvedPlugin.notes.some((n) => n.includes("defaultEnabled")),
    `agreement must emit no note, notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
  requireInstallable(resolvedPlugin);
  assert.strictEqual(resolvedPlugin.defaultEnabled, true);
});

test("DFEN-02 entry silent + manifest false -> installable carrying false", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, {
    [pathUnderMarketplace("./local")]: "dir",
    [path.join(pathUnderMarketplace("./local"), ".claude-plugin", "plugin.json")]: {
      contents: JSON.stringify({ name: "p1", defaultEnabled: false }),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );
  requireInstallable(resolvedPlugin);
  assert.strictEqual(resolvedPlugin.defaultEnabled, false);
});

// A `plugin.json` that exists but declares nothing is a DIFFERENT code path from
// no `plugin.json` at all (the next test): this one reaches the precedence rule
// with a parsed manifest object, that one with `manifest: null`. Both must
// answer `true`, so both are pinned.
test("DFEN-02 entry silent + manifest present but silent -> installable carrying true", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, {
    [pathUnderMarketplace("./local")]: "dir",
    [path.join(pathUnderMarketplace("./local"), ".claude-plugin", "plugin.json")]: {
      contents: JSON.stringify({ name: "p1" }),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );
  requireInstallable(resolvedPlugin);
  assert.strictEqual(resolvedPlugin.defaultEnabled, true);
});

// D-101-09: no `plugin.json` on disk -- `readManifest` reports `manifest: null`
// as a normal non-failing outcome, and the fallback chain runs to its end.
test("DFEN-02 entry silent + no plugin.json on disk -> installable carrying true", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );
  requireInstallable(resolvedPlugin);
  assert.strictEqual(resolvedPlugin.defaultEnabled, true);
});

// DFEN-02 / DFEN-03: the entry-declared value survives the whole resolution
// path -- schema acceptance, the precedence helper, and the materializable arm
// -- and declaring it false does NOT make the plugin non-installable.
test("DFEN-02 entry declares defaultEnabled false with no plugin.json -> installable carrying false", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", defaultEnabled: false }),
    context,
  );

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );
  requireInstallable(resolvedPlugin);
  assert.strictEqual(resolvedPlugin.defaultEnabled, false);
});

// D-101-01: the resolved value lives in `MATERIALIZABLE_FIELDS`, so it has to
// carry on the `partially-available` arm exactly as it does on `installable`.
// Declaring an unsupported component kind reaches that arm with NO structural
// defect, which is the shape a `--partial` consumer narrows to -- and it is the
// only arm whose carried value nothing else asserts, so hardcoding the argument
// at the `partiallyAvailable()` call site would otherwise go unnoticed.
test("DFEN-02 partially-available arm carries the entry-resolved defaultEnabled", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", defaultEnabled: false, themes: "./themes" }),
    context,
  );

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "partially-available",
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
  requirePartialInstallable(resolvedPlugin);
  assert.strictEqual(resolvedPlugin.defaultEnabled, false);
});

// D-101-10: a non-boolean is an ordinary schema violation caught by
// PLUGIN_MANIFEST_VALIDATOR inside readManifest -- no bespoke error class, no
// coercion, and precedence is never consulted. Assert only the note PREFIX:
// the trailing detail is validator-generated and would make this brittle.
test("DFEN-01 non-boolean defaultEnabled in plugin.json -> unavailable + malformed plugin.json", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, {
    [pathUnderMarketplace("./local")]: "dir",
    [path.join(pathUnderMarketplace("./local"), ".claude-plugin", "plugin.json")]: {
      contents: JSON.stringify({ name: "p1", defaultEnabled: "yes" }),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("malformed plugin.json")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

// D-101-13 / D-09 -- that adding a named optional property did not narrow the
// lenient unknown-key posture is pinned in `tests/domain/manifest.test.ts`,
// which runs PLUGIN_ENTRY_VALIDATOR / PLUGIN_MANIFEST_VALIDATOR directly. The
// resolver never calls either validator on the entry (it reads named fields and
// casts the rest to `Record<string, unknown>`), so a resolver-level test cannot
// observe schema leniency and would pass even under `additionalProperties: false`.

// ──────────────────────────────────────────────────────────────────────────
// MCPR-01..04: string mcpServers references (wrapped .mcp.json, D-01/D-04)
// ──────────────────────────────────────────────────────────────────────────

const WRAPPED_MCP = JSON.stringify({ mcpServers: { srv: { command: "node" } } });

test("MCPR-01 marketplace-entry string mcpServers reference resolves at inline parity", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const refCtx = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "x.mcp.json")]: { contents: WRAPPED_MCP },
  });

  // act
  const referenced = await resolveStrict(
    pluginEntry({ source: "./local", mcpServers: "x.mcp.json" }),
    refCtx,
  );

  const inlineCtx = resolveContext(marketplaceRoot, { [localRoot]: "dir" });
  const inline = await resolveStrict(
    pluginEntry({ source: "./local", mcpServers: { srv: { command: "node" } } }),
    inlineCtx,
  );

  // assert
  assert.strictEqual(referenced.state, "installable", `notes: ${referenced.notes.join(" / ")}`);
  assert.strictEqual(inline.state, "installable", `notes: ${inline.notes.join(" / ")}`);
  if (referenced.state === "installable" && inline.state === "installable") {
    // Byte-for-byte parity with the inline-object form.
    assert.deepStrictEqual(referenced.mcpServers, inline.mcpServers);
    assert.deepStrictEqual(referenced.mcpServers, { srv: { command: "node" } });
  }
});

test("MCPR-02 plugin.json string mcpServers reference resolves at parity (via readManifest)", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, ".claude-plugin", "plugin.json")]: {
      contents: JSON.stringify({ name: "p1", mcpServers: "x.mcp.json" }),
    },
    [path.join(localRoot, "x.mcp.json")]: { contents: WRAPPED_MCP },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
  if (resolvedPlugin.state === "installable") {
    assert.deepStrictEqual(resolvedPlugin.mcpServers, { srv: { command: "node" } });
  }
});

test("MCPR-03 missing reference file -> unavailable + malformed mcp reference note", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", mcpServers: "x.mcp.json" }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("malformed mcp reference")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

test("MCPR-03 malformed-JSON reference file -> unavailable + malformed mcp reference note", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "x.mcp.json")]: { contents: "{ not json" },
  });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", mcpServers: "x.mcp.json" }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("malformed mcp reference")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

test("MCPR-03 wrapper-less reference file (bare map) -> unavailable + malformed mcp reference note", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    // D-04: a string reference MUST be wrapped; a bare server map degrades.
    [path.join(localRoot, "x.mcp.json")]: {
      contents: JSON.stringify({ srv: { command: "node" } }),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", mcpServers: "x.mcp.json" }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("malformed mcp reference")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

test("WR-03: unreadable reference file (EACCES) propagates out of resolveStrict (not swallowed as malformed mcp)", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const refPath = path.join(localRoot, "x.mcp.json");
  // statKind reports the reference file exists, but readFileText throws EACCES
  // (readable to stat, not to read). The read sits OUTSIDE the malformed-note
  // try, so the I/O error must propagate for narrowProbeError to classify it as
  // {permission denied} -- NOT be conflated into a `malformed mcp reference` note.
  const context: ResolveContext = {
    marketplaceRoot: marketplaceRoot,
    statKind(p: string): Promise<"file" | "dir" | null> {
      if (p === localRoot) {
        return Promise.resolve("dir");
      }

      if (p === refPath) {
        return Promise.resolve("file");
      }

      return Promise.resolve(null);
    },
    readFileText(p: string): Promise<string> {
      if (p === refPath) {
        return Promise.reject(Object.assign(new Error("EACCES"), { code: "EACCES" }));
      }

      return Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    },
  };

  // act & assert
  await assert.rejects(
    () => resolveStrict(pluginEntry({ source: "./local", mcpServers: "x.mcp.json" }), context),
    (error: unknown) => {
      assert.ok(error instanceof Error, "rejection must be an Error");
      assert.strictEqual(
        (error as NodeJS.ErrnoException).code,
        "EACCES",
        "EACCES must propagate unchanged for narrowProbeError to classify",
      );
      return true;
    },
  );
});

test("MCPR-04 ../ traversal reference -> unavailable + escape note (no read outside pluginRoot)", async () => {
  // arrange
  // The string-level containment check fires BEFORE any read: the escape
  // target is never registered in the mock, proving no out-of-root read.
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", mcpServers: "../escape.mcp.json" }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("malformed mcp reference")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

// MCPR-04 / D-14: assertPathInside does a real per-segment lstat, so the
// symlink case needs a real filesystem fixture (resolveContext cannot fake a link).
// A real-fs ResolveContext (no injected readers) uses the default fs helpers.
test("MCPR-04 symlink reference (D-14) -> unavailable + note; never reads outside pluginRoot", async () => {
  // arrange
  const mpRoot = await mkdtemp(path.join(os.tmpdir(), "pi-cm-mcpref-"));
  const externalDir = await mkdtemp(path.join(os.tmpdir(), "pi-cm-external-"));
  try {
    const pluginRoot = path.join(mpRoot, "local");
    await mkdir(pluginRoot, { recursive: true });
    // A wrapped file lives OUTSIDE the plugin root; the in-root reference is
    // a symlink pointing at it. D-14 refuses the link before any read.
    await writeFile(path.join(externalDir, "secret.mcp.json"), WRAPPED_MCP, "utf8");
    await symlink(path.join(externalDir, "secret.mcp.json"), path.join(pluginRoot, "x.mcp.json"));

    const context: ResolveContext = { marketplaceRoot: mpRoot };

    // act
    const resolvedPlugin = await resolveStrict(
      pluginEntry({ source: "./local", mcpServers: "x.mcp.json" }),
      context,
    );

    // assert
    assert.strictEqual(resolvedPlugin.state, "unavailable");
    assert.ok(
      resolvedPlugin.notes.some((n) => n.includes("malformed mcp reference")),
      `notes: ${resolvedPlugin.notes.join(" / ")}`,
    );
  } finally {
    await rm(mpRoot, { recursive: true, force: true });
    await rm(externalDir, { recursive: true, force: true });
  }
});

test("MCPR-04 reference path traversing a non-directory (ENOTDIR) propagates out of resolveStrict", async () => {
  // arrange
  const mpRoot = await mkdtemp(path.join(os.tmpdir(), "pi-cm-mcpref-notdir-"));
  try {
    const pluginRoot = path.join(mpRoot, "local");
    await mkdir(pluginRoot, { recursive: true });
    // A regular file sits where the reference path expects a directory, so the
    // per-segment lstat in assertPathInside throws ENOTDIR (not a
    // PathContainmentError). validateReferencePath re-throws it, and it must
    // propagate for the outer probe classifier to key on `.code`.
    await writeFile(path.join(pluginRoot, "afile"), "x", "utf8");
    const context: ResolveContext = { marketplaceRoot: mpRoot };

    // act & assert
    await assert.rejects(
      () =>
        resolveStrict(pluginEntry({ source: "./local", mcpServers: "afile/x.mcp.json" }), context),
      (error: unknown) => {
        assert.ok(error instanceof Error, "rejection must be an Error");
        assert.strictEqual((error as NodeJS.ErrnoException).code, "ENOTDIR");
        return true;
      },
    );
  } finally {
    await rm(mpRoot, { recursive: true, force: true });
  }
});

test("MCPR malformed standalone .mcp.json (no entry mcpServers) -> unavailable + malformed mcpServers note", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, ".mcp.json")]: { contents: "{ not json" },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("malformed mcpServers")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

test("MCPR-04 absolute-path reference -> unavailable + malformed mcp reference note (no read)", async () => {
  // arrange
  // `validateReferencePath` rejects an absolute path BEFORE any read: the
  // absolute target is never registered in the mock, proving no read occurs.
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", mcpServers: "/etc/x.mcp.json" }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("malformed mcp reference")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

test("MCPR-03 wrapped reference with malformed INNER map -> unavailable (inline parity)", async () => {
  // arrange
  // Valid JSON with a present `mcpServers` wrapper but an inner map that fails
  // the server-map schema: `readReferencedMcp` succeeds (wrapper present) and
  // delegates to the inline `applyMcpValue`, which emits `malformed mcpServers`
  // (NOT `malformed mcp reference`) -- the intended inline-parity boundary.
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "x.mcp.json")]: {
      contents: JSON.stringify({ mcpServers: [1, 2, 3] }),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", mcpServers: "x.mcp.json" }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("malformed mcpServers")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
  assert.ok(
    !resolvedPlugin.notes.some((n) => n.includes("malformed mcp reference")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

// Criterion 5 regression: an UNDECLARED conventional <pluginRoot>/.mcp.json in
// the UNWRAPPED bare-server-map form still resolves installable. The
// wrapped-only rule applies ONLY to the declared string reference;
// readStandaloneMcp's unwrapped tolerance is unchanged.
test("criterion 5: undeclared unwrapped standalone .mcp.json still resolves installable", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, ".mcp.json")]: {
      contents: JSON.stringify({ srv: { command: "node" } }),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
  if (resolvedPlugin.state === "installable") {
    assert.deepStrictEqual(resolvedPlugin.mcpServers, { srv: { command: "node" } });
    assert.ok(!resolvedPlugin.notes.some((n) => n.includes("malformed mcp reference")));
  }
});

// Backstop: entry-string vs manifest-object precedence follows the existing
// entry.mcpServers ?? manifest.mcpServers rule -- a string entry wins over an
// object manifest declaration.
test("MCPR-01 backstop: string entry.mcpServers shadows an object manifest.mcpServers (entry wins)", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, ".claude-plugin", "plugin.json")]: {
      contents: JSON.stringify({ name: "p1", mcpServers: { other: { command: "python" } } }),
    },
    [path.join(localRoot, "x.mcp.json")]: { contents: WRAPPED_MCP },
  });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", mcpServers: "x.mcp.json" }),
    context,
  );

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
  if (resolvedPlugin.state === "installable") {
    // Entry string wins; the manifest object is shadowed.
    assert.deepStrictEqual(resolvedPlugin.mcpServers, { srv: { command: "node" } });
  }
});

test("PR-2(7) non-string component path (skills: 42) -> notInstallable", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", skills: 42 }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("is not a string")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

test("PR-2(8) escaping component path (skills: '../outside') -> notInstallable", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", skills: "../outside" }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("escapes plugin root")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

// D-07 (COMP-01) narrows PR-2(9): top-level arrays of strings are LEGAL.
// Only non-string elements (or nested arrays) inside the array are rejected
// at the element level. The error note reads "is not a string" (from
// PR-2 case 7) or "contains nested array element".
test("PR-2(9) [D-07 narrowed] array containing non-string element -> notInstallable", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", skills: [42] }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("is not a string")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

test("PR-2(9) [D-07 narrowed] nested array element -> notInstallable with descriptive note", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", skills: [["skills"]] }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("nested array element")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

// ──────────────────────────────────────────────────────────────────────────
// PR-3 multi: two unsupported components both surface
// ──────────────────────────────────────────────────────────────────────────

test("PR-3 multiple unsupported components both surface as notes", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", themes: { dark: {} }, monitors: { m: "x" } }),
    context,
  );
  // D-64-06: multiple unsupported kinds, no structural defect -> unsupported.

  // assert
  assert.strictEqual(resolvedPlugin.state, "partially-available");
  assert.ok(
    resolvedPlugin.notes.includes("contains themes"),
    `themes note missing; got: ${resolvedPlugin.notes.join(" / ")}`,
  );
  assert.ok(
    resolvedPlugin.notes.includes("contains monitors"),
    `monitors note missing; got: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

// ──────────────────────────────────────────────────────────────────────────
// PR-4 [D-07/COMP-01]: implicit-by-convention SUPPLEMENTS declared paths.
// The strict-resolver Step 7 computes the UNION of declared + implicit;
// first-wins dedup preserves declared-first ordering.
// ──────────────────────────────────────────────────────────────────────────

test("PR-4 implicit-by-convention populates componentPaths.skills when neither entry nor manifest declares it", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, {
    [pathUnderMarketplace("./local")]: "dir",
    [path.join(pathUnderMarketplace("./local"), "skills")]: "dir",
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not: ${resolvedPlugin.notes.join(" / ")}`,
  );

  if (resolvedPlugin.state === "installable") {
    assert.deepStrictEqual(resolvedPlugin.componentPaths.skills, ["skills"]);
    assert.ok(resolvedPlugin.supported.includes("skills"));
  }
});

// D-07 corollary: entry declares "custom" AND implicit "skills/" exists ->
// UNION (declared-first ordering), NOT a short-circuit on the declared path.
test("D-07 entry-declared path UNIONs with implicit-by-convention (was: PR-4 short-circuit)", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, {
    [pathUnderMarketplace("./local")]: "dir",
    [path.join(pathUnderMarketplace("./local"), "skills")]: "dir",
    [path.join(pathUnderMarketplace("./local"), "custom")]: "dir",
  });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", skills: "custom" }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "installable");

  if (resolvedPlugin.state === "installable") {
    // Declared first, implicit-by-convention appended after.
    assert.deepStrictEqual(resolvedPlugin.componentPaths.skills, ["custom", "skills"]);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// PR-5: dependencies stay installable but get a note
// ──────────────────────────────────────────────────────────────────────────

test("PR-5 entry.dependencies present -> installable: true with manual-install note", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", dependencies: { other: "1.0" } }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "installable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("must be installed manually")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

// ──────────────────────────────────────────────────────────────────────────
// PR-6: requireInstallable
// ──────────────────────────────────────────────────────────────────────────

test("PR-6 requireInstallable on installable narrows to installable variant", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin: ResolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local" }),
    context,
  );
  requireInstallable(resolvedPlugin);
  // After the assertion, TypeScript narrows resolvedPlugin to ResolvedPluginInstallable

  // assert
  assert.strictEqual(typeof resolvedPlugin.pluginRoot, "string");
});

test("PR-6 requireInstallable on not-installable throws with 'is not installable' + notes", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, {});

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./missing" }), context);

  // assert
  assert.throws(
    () => {
      requireInstallable(resolvedPlugin);
    },
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes('Plugin "p1" is not installable') &&
      error.message.includes("source dir does not exist"),
  );
});

test("PR-6 requireInstallable(resolvedPlugin, 'update') throws with 'is no longer installable'", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, {});

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./missing" }), context);

  // assert
  assert.throws(
    () => {
      requireInstallable(resolvedPlugin, "update");
    },
    (error: unknown) =>
      error instanceof Error && error.message.includes("is no longer installable"),
  );
});

// ──────────────────────────────────────────────────────────────────────────
// MM-5 happy path
// ──────────────────────────────────────────────────────────────────────────

test("MM-5 happy path: valid entry + manifest with skills -> installable with skills supported", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [manifestPath]: { contents: JSON.stringify({ name: "p1", skills: "skills" }) },
    [path.join(localRoot, "skills")]: "dir",
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );

  if (resolvedPlugin.state === "installable") {
    assert.strictEqual(resolvedPlugin.pluginRoot, localRoot);
    assert.ok(resolvedPlugin.supported.includes("skills"));
    // D-07: manifest declares "skills" AND implicit "skills/" exists; UNION
    // applies first-wins dedup so the result is a single-element ["skills"].
    assert.deepStrictEqual(resolvedPlugin.componentPaths.skills, ["skills"]);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// RSTATE-02 / D-64-07: structural precedence
// ──────────────────────────────────────────────────────────────────────────

// A plugin that is BOTH structurally broken (malformed mcpServers) AND
// declares an unsupported component kind (themes) resolves `unavailable` --
// the structural defect wins, so `pluginRoot` never leaks through the
// `unsupported` arm. Both reasons are still present in `notes`.
test("RSTATE-02: structural defect + unsupported kind -> unavailable (structural precedence)", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", mcpServers: [1, 2, 3], themes: { dark: {} } }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("malformed mcpServers")),
    `structural note missing; got: ${resolvedPlugin.notes.join(" / ")}`,
  );
  assert.ok(
    resolvedPlugin.notes.includes("contains themes"),
    `unsupported note missing; got: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

// ──────────────────────────────────────────────────────────────────────────
// RSTATE-04 / D-64-04: requirePartialInstallable gate
// ──────────────────────────────────────────────────────────────────────────

test("RSTATE-04 requirePartialInstallable admits installable and exposes pluginRoot", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin: ResolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local" }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "installable");
  requirePartialInstallable(resolvedPlugin);
  // After the assertion resolvedPlugin is ResolvedPluginInstallable | ResolvedPluginPartiallyAvailable.
  assert.strictEqual(typeof resolvedPlugin.pluginRoot, "string");
});

test("RSTATE-04 requirePartialInstallable admits unsupported and exposes pluginRoot", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin: ResolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", themes: { dark: {} } }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "partially-available");
  requirePartialInstallable(resolvedPlugin);
  // D-64-06: the unsupported arm keeps pluginRoot, so force can degrade it.
  assert.strictEqual(typeof resolvedPlugin.pluginRoot, "string");
});

test("RSTATE-04 requirePartialInstallable throws on unavailable with 'is not installable'", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, {});

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./missing" }), context);

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.throws(
    () => {
      requirePartialInstallable(resolvedPlugin);
    },
    (error: unknown) =>
      error instanceof Error &&
      error.message.includes('Plugin "p1" is not installable') &&
      error.message.includes("source dir does not exist"),
  );
});

test("RSTATE-04 requirePartialInstallable(resolvedPlugin, 'update') throws with 'is no longer installable'", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, {});

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./missing" }), context);

  // assert
  assert.throws(
    () => {
      requirePartialInstallable(resolvedPlugin, "update");
    },
    (error: unknown) =>
      error instanceof Error && error.message.includes("is no longer installable"),
  );
});

// ──────────────────────────────────────────────────────────────────────────
// SEV-02 / IN-02 / D-69-03 / RSTATE-05: requireInstallable on the `unsupported`
// arm carries the force hint + typed unsupported-kind list
// ──────────────────────────────────────────────────────────────────────────

// requireInstallable throws on an `unsupported` (force-degradable) plugin, and
// the thrown PluginShapeError pins the force-hint ternaries:
// `partialable: resolvedPlugin.state === "partially-available"` (true here) and
// `unsupportedKinds: resolvedPlugin.state === "partially-available" ? resolvedPlugin.unsupported : []` (the typed
// component-kind list, NOT the empty structural default). A regression that
// dropped either would silently suppress the `--force` hint on the render row.
test("SEV-02 / IN-02: requireInstallable on unsupported throws partialable with the typed unsupportedKinds", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", themes: { dark: {} } }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "partially-available");
  assert.throws(
    () => {
      requireInstallable(resolvedPlugin);
    },
    (error: unknown) => {
      assert.ok(error instanceof PluginShapeError, "must throw PluginShapeError");
      assert.strictEqual(error.shape.kind, "not-installable");
      if (error.shape.kind === "not-installable") {
        assert.strictEqual(error.shape.partialable, true);
        assert.deepStrictEqual(error.shape.unsupportedKinds, ["themes"]);
      }

      return true;
    },
  );
});

// ──────────────────────────────────────────────────────────────────────────
// SURF-05 / D-63-08 / D-71-03: detectOrphanRewake runs over the FILTERED kept
// subset, so a DROPPED group's orphan-rewake field cannot raise a false marker
// ──────────────────────────────────────────────────────────────────────────

// A hooks config with one KEPT supported group (matcher "Bash") and one DROPPED
// unsupportable group (regex matcher ".*") whose only handler declares
// `rewakeMessage` WITHOUT `asyncRewake:true`. The orphan lives in the dropped
// group, so it never enters the filtered subset `detectOrphanRewake` scans ->
// `orphanRewake` stays absent even though the plugin resolves `unsupported`.
test("SURF-05 / D-71-03: orphan in a DROPPED group does not flag orphanRewake -> unsupported, orphanRewake absent", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({
        PreToolUse: [
          { matcher: "Bash", hooks: [{ type: "command", command: "echo ok" }] },
          {
            matcher: ".*",
            hooks: [{ type: "command", command: "echo orphan", rewakeMessage: "later" }],
          },
        ],
      }),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "partially-available",
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
  if (resolvedPlugin.state === "partially-available") {
    assert.strictEqual(resolvedPlugin.orphanRewake, undefined);
    assert.ok(
      resolvedPlugin.supported.includes("hooks"),
      `supported: ${resolvedPlugin.supported.join(" / ")}`,
    );
    assert.deepStrictEqual(resolvedPlugin.droppedHooks, [
      { kind: "group", event: "PreToolUse", matcher: ".*", cond: "regex" },
    ]);
  }
});

// Converse: the orphan lives in the KEPT group (matcher "Bash") while the regex
// group drops. The kept group IS in the filtered subset, so `orphanRewake`
// still flags true even though the plugin resolves `unsupported`.
test("SURF-05 / D-71-03: orphan in the KEPT group still flags orphanRewake -> unsupported, orphanRewake true", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [{ type: "command", command: "echo orphan", rewakeMessage: "later" }],
          },
          { matcher: ".*", hooks: [{ type: "command", command: "echo drop" }] },
        ],
      }),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "partially-available",
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
  if (resolvedPlugin.state === "partially-available") {
    assert.strictEqual(resolvedPlugin.orphanRewake, true);
    assert.deepStrictEqual(resolvedPlugin.droppedHooks, [
      { kind: "group", event: "PreToolUse", matcher: ".*", cond: "regex" },
    ]);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// PHOOK-01 / D-71-01: droppedHooks carries the `kind:"handler"` and non-regex
// `cond` group shapes
// ──────────────────────────────────────────────────────────────────────────

// A `kind:"handler"` drop: a non-`command` handler in an otherwise-supportable
// group. The `command` handler survives (group + event kept, "hooks" supported),
// and the dropped handler is enumerated at HANDLER granularity.
test("PHOOK-01: a non-command handler in a kept group drops at handler granularity -> unsupported", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [{ type: "command", command: "echo ok" }, { type: "notification" }],
          },
        ],
      }),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "partially-available",
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
  if (resolvedPlugin.state === "partially-available") {
    assert.ok(
      resolvedPlugin.supported.includes("hooks"),
      `supported: ${resolvedPlugin.supported.join(" / ")}`,
    );
    assert.deepStrictEqual(resolvedPlugin.droppedHooks, [
      { kind: "handler", event: "PreToolUse", matcher: "Bash", handlerType: "notification" },
    ]);
  }
});

// A non-regex `cond`: an unmapped Claude tool (`MultiEdit`) has no Pi TOOL-01
// reverse-map entry, so its matcher group drops with `cond:"unmapped-tool"`.
test("PHOOK-01: an unmapped-tool matcher drops the group with cond unmapped-tool -> unsupported", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({
        PreToolUse: [{ matcher: "MultiEdit", hooks: [{ type: "command", command: "echo x" }] }],
      }),
    },
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "partially-available",
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
  if (resolvedPlugin.state === "partially-available") {
    assert.deepStrictEqual(resolvedPlugin.droppedHooks, [
      { kind: "group", event: "PreToolUse", matcher: "MultiEdit", cond: "unmapped-tool" },
    ]);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// PURL-01 / PURL-03: git plugin sources (url / git-subdir / github-object) are
// installable when a `resolveGitPluginRoot` callback materializes their clone
// root. The resolver stays network-free: the clone-vs-probe policy is injected.
// ──────────────────────────────────────────────────────────────────────────

// A materialized clone root that `resolveContext`'s file map treats as an existing
// directory. Its `.claude-plugin/plugin.json` is deliberately absent (best-effort
// per PR-2 case 4) so the plugin resolves installable with an empty component set.
const CLONE_ROOT = "/abs/plugin-clones/deadbeef00-cafef00dba/";

/**
 * Build a ResolveContext whose `resolveGitPluginRoot` returns a fixed result and
 * whose file map treats `CLONE_ROOT` (and any component dirs) as present. The
 * marketplaceRoot is still `marketplaceRoot`, but git sources never touch it -- their
 * pluginRoot comes from the injected callback.
 */
function gitCtx(
  result: GitPluginRootResult,
  files: Record<string, "dir" | "file" | { contents: string }> = { [CLONE_ROOT]: "dir" },
): ResolveContext {
  return {
    ...resolveContext(marketplaceRoot, files),
    resolveGitPluginRoot(): Promise<GitPluginRootResult> {
      return Promise.resolve(result);
    },
  };
}

test("PURL-01: url source + materialized callback -> installable carrying the clone pluginRoot", async () => {
  // arrange
  const context = gitCtx({
    kind: "materialized",
    pluginRoot: CLONE_ROOT,
    resolvedSha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
  });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: { source: "url", url: "https://gitlab.com/o/p.git" } }),
    context,
  );

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );
  if (resolvedPlugin.state === "installable") {
    assert.strictEqual(resolvedPlugin.pluginRoot, CLONE_ROOT);
  }
});

test("PURL-01: git-subdir source + materialized callback -> installable carrying the clone pluginRoot", async () => {
  // arrange
  const subRoot = path.join(CLONE_ROOT, "packages", "plug");
  const context = gitCtx(
    {
      kind: "materialized",
      pluginRoot: subRoot,
      resolvedSha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    },
    { [subRoot]: "dir" },
  );

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({
      source: { source: "git-subdir", url: "https://gitlab.com/o/p", path: "packages/plug" },
    }),
    context,
  );

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );
  if (resolvedPlugin.state === "installable") {
    assert.strictEqual(resolvedPlugin.pluginRoot, subRoot);
  }
});

test("PURL-01: github-object source + materialized callback -> installable carrying the clone pluginRoot", async () => {
  // arrange
  const context = gitCtx({
    kind: "materialized",
    pluginRoot: CLONE_ROOT,
    resolvedSha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
  });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: { source: "github", repo: "owner/repo" } }),
    context,
  );

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );
  if (resolvedPlugin.state === "installable") {
    assert.strictEqual(resolvedPlugin.pluginRoot, CLONE_ROOT);
  }
});

test("PURL-01: npm source stays unavailable with unsupported-source note", async () => {
  // arrange
  const context = gitCtx({
    kind: "materialized",
    pluginRoot: CLONE_ROOT,
    resolvedSha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
  });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: { source: "npm", package: "some-plugin" } }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.includes("unsupported source kind: npm"),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

test("PURL-01: url source with NO resolveGitPluginRoot injected -> unavailable (path-only back-compat)", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, {});

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: { source: "url", url: "https://gitlab.com/o/p.git" } }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  // No pluginRoot leaks (NFR-7); a note explains the missing clone resolver.
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("clone")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

test("PURL-01: path source is unchanged -- marketplaceRoot escape check still fires (regression)", async () => {
  // arrange
  // Even with a git callback present, a path source uses the marketplaceRoot
  // derivation + escape check, never the callback.
  const context = gitCtx({
    kind: "materialized",
    pluginRoot: CLONE_ROOT,
    resolvedSha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "../escape" }), context);

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("escapes marketplace root")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

test("PURL-03: escapes result -> unavailable carrying the escape detail", async () => {
  // arrange
  const detail = "source path escapes clone root: ../../etc";
  const context = gitCtx({ kind: "escapes", detail });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({
      source: { source: "git-subdir", url: "https://gitlab.com/o/p", path: "../../etc" },
    }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(resolvedPlugin.notes.includes(detail), `notes: ${resolvedPlugin.notes.join(" / ")}`);
});

test("PURL-03: missing-subdir result -> unavailable carrying the missing detail", async () => {
  // arrange
  const detail = "source missing: packages/absent";
  const context = gitCtx({ kind: "missing-subdir", detail });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({
      source: { source: "git-subdir", url: "https://gitlab.com/o/p", path: "packages/absent" },
    }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(resolvedPlugin.notes.includes(detail), `notes: ${resolvedPlugin.notes.join(" / ")}`);
});

test("PURL-01: not-cached result -> unavailable (never carries pluginRoot)", async () => {
  // arrange
  const context = gitCtx({ kind: "not-cached" });

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: { source: "url", url: "https://gitlab.com/o/p.git" } }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  // NFR-7: the unavailable arm structurally omits pluginRoot.
  assert.ok(!("pluginRoot" in resolvedPlugin), "unavailable arm must not carry pluginRoot");
});

// PURL-01: a materialized git clone feeds the SAME downstream stages as a path
// source. A malformed plugin.json at the returned clone root still trips the
// existing structural note (the git branch does not bypass manifest reading).
test("PURL-01: materialized clone with malformed plugin.json -> unavailable with the manifest note", async () => {
  // arrange
  const manifestPath = path.join(CLONE_ROOT, ".claude-plugin", "plugin.json");
  const context = gitCtx(
    {
      kind: "materialized",
      pluginRoot: CLONE_ROOT,
      resolvedSha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    },
    { [CLONE_ROOT]: "dir", [manifestPath]: { contents: "{ not json" } },
  );

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: { source: "url", url: "https://gitlab.com/o/p.git" } }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("malformed plugin.json")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

// PURL-01: a materialized clone whose directory does not exist on disk still
// trips PR-2 case 3 (source dir does not exist) -- the git branch does not skip
// the dir-existence check.
test("PURL-01: materialized clone whose dir is absent -> unavailable (source dir does not exist)", async () => {
  // arrange
  // The callback claims materialized, but the file map has no CLONE_ROOT dir.
  const context = gitCtx(
    {
      kind: "materialized",
      pluginRoot: CLONE_ROOT,
      resolvedSha: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    },
    {},
  );

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: { source: "url", url: "https://gitlab.com/o/p.git" } }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("source dir does not exist")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

test("PR-2(1) unclassifiable source (non-string/non-object) -> unavailable with the unknown-kind reason", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, {});

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: 42 }), context);

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) =>
      n.includes("unsupported source kind: unknown (source must be a string or object)"),
    ),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

test("PR-2(1) object source with an unrecognized discriminator -> unavailable, reason carries the parser detail", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, {});

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: { source: "weird" } }), context);

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) =>
      n.includes("unsupported source kind: unknown (unrecognized source kind: weird)"),
    ),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

// Component-path union, default-enabled, loose-mode, and type-boundary contracts.

test("COMP-01 (a) default skills/ only, no manifest field -> ['skills']", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "skills")]: "dir",
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
  if (resolvedPlugin.state === "installable") {
    assert.deepStrictEqual(resolvedPlugin.componentPaths.skills, ["skills"]);
    assert.ok(resolvedPlugin.supported.includes("skills"));
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Fixture (b): custom-only -- manifest declares custom path, default absent.
// ──────────────────────────────────────────────────────────────────────────

test("COMP-01 (b) manifest declares ['custom/skills']; default skills/ absent -> ['custom/skills']", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [manifestPath]: { contents: JSON.stringify({ name: "p1", skills: ["custom/skills"] }) },
    [path.join(localRoot, "custom", "skills")]: "dir",
    // NOTE: /local/skills is intentionally absent.
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
  if (resolvedPlugin.state === "installable") {
    assert.deepStrictEqual(resolvedPlugin.componentPaths.skills, ["custom/skills"]);
    assert.ok(resolvedPlugin.supported.includes("skills"));
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Fixture (c): BOTH manifest ['custom/skills'] AND default skills/ exist ->
// UNION (declared-first ordering, implicit appended; first-wins dedup).
// ──────────────────────────────────────────────────────────────────────────

test("COMP-01 (c) BOTH manifest ['custom/skills'] AND default skills/ -> UNION ['custom/skills', 'skills']", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [manifestPath]: { contents: JSON.stringify({ name: "p1", skills: ["custom/skills"] }) },
    [path.join(localRoot, "custom", "skills")]: "dir",
    [path.join(localRoot, "skills")]: "dir", // default ALSO exists
  });

  // act
  const resolvedPlugin = await resolveStrict(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
  if (resolvedPlugin.state === "installable") {
    // Declared first, implicit appended after, deduplicated.
    assert.deepStrictEqual(resolvedPlugin.componentPaths.skills, ["custom/skills", "skills"]);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// Bonus: entry overrides manifest order; declared-first wins; dedup applies.
// ──────────────────────────────────────────────────────────────────────────

test("COMP-01 entry > manifest declared order; first-wins dedup across both", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [manifestPath]: {
      // manifest declares "shared" AND "manifest-only"
      contents: JSON.stringify({ name: "p1", skills: ["shared", "manifest-only"] }),
    },
    [path.join(localRoot, "entry-only")]: "dir",
    [path.join(localRoot, "shared")]: "dir",
    [path.join(localRoot, "manifest-only")]: "dir",
  });
  // entry declares "entry-only" AND "shared"

  // act
  const resolvedPlugin = await resolveStrict(
    pluginEntry({ source: "./local", skills: ["entry-only", "shared"] }),
    context,
  );

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
  if (resolvedPlugin.state === "installable") {
    // Order: entry first ("entry-only", "shared"), then manifest's unique
    // contribution ("manifest-only"); "shared" deduped on second occurrence.
    // Implicit-by-convention "skills" is NOT present here because the conventional
    // dir <pluginRoot>/skills was not registered in the statMap.
    assert.deepStrictEqual(resolvedPlugin.componentPaths.skills, [
      "entry-only",
      "shared",
      "manifest-only",
    ]);
  }
});

for (const { defaultEnabled, installsDisabled } of [
  { defaultEnabled: false, installsDisabled: true },
  { defaultEnabled: true, installsDisabled: false },
  { defaultEnabled: undefined, installsDisabled: false },
] as const) {
  test(`rowClaimsInstallDisabled treats entry default ${String(defaultEnabled)} as ${String(installsDisabled)}`, () => {
    // arrange
    const entry: PluginEntry = {
      name: "alpha",
      source: "./alpha",
      ...(defaultEnabled !== undefined && { defaultEnabled }),
    };

    // act
    const claimedDisabled = rowClaimsInstallDisabled(entry, undefined);

    // assert
    assert.strictEqual(claimedDisabled, installsDisabled);
  });
}

test("rowClaimsInstallDisabled treats an invalid entry default as silent", () => {
  // arrange
  const entry: PluginEntry = { name: "alpha", source: "./alpha" };
  Object.defineProperty(entry, "defaultEnabled", { value: "false" });

  // act
  const claimedDisabled = rowClaimsInstallDisabled(entry, undefined);

  // assert
  assert.strictEqual(claimedDisabled, false);
});

for (const { declaredEnabled, installsDisabled } of [
  { declaredEnabled: undefined, installsDisabled: true },
  { declaredEnabled: true, installsDisabled: false },
  { declaredEnabled: false, installsDisabled: false },
] as const) {
  test(`rowClaimsInstallDisabled gives a user declaration ${String(declaredEnabled)} precedence over an entry default`, () => {
    // arrange
    const entry: PluginEntry = { name: "alpha", source: "./alpha", defaultEnabled: false };

    // act
    const claimedDisabled = rowClaimsInstallDisabled(entry, declaredEnabled);

    // assert
    assert.strictEqual(claimedDisabled, installsDisabled);
  });
}

for (const declaredEnabled of [undefined, true, false] as const) {
  test(`rowClaimsInstallDisabled keeps a silent entry silent for user declaration ${String(declaredEnabled)}`, () => {
    // arrange
    const entry: PluginEntry = { name: "alpha", source: "./alpha" };

    // act
    const claimedDisabled = rowClaimsInstallDisabled(entry, declaredEnabled);

    // assert
    assert.strictEqual(claimedDisabled, false);
  });
}

test("MM-6 entry.skills declared -> installable with skills", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "skills")]: "dir",
  });

  // act
  const resolvedPlugin = await resolveLoose(
    pluginEntry({ source: "./local", skills: "skills" }),
    context,
  );

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not: ${resolvedPlugin.notes.join(" / ")}`,
  );

  if (resolvedPlugin.state === "installable") {
    // D-07 array shape (loose mode is entry-only with no convention probe).
    assert.deepStrictEqual(resolvedPlugin.componentPaths.skills, ["skills"]);
    assert.ok(resolvedPlugin.supported.includes("skills"));
  }
});

test("MM-6 entry.skills absent but manifest declares skills -> conflict notInstallable", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [manifestPath]: { contents: JSON.stringify({ name: "p1", skills: "skills" }) },
    [path.join(localRoot, "skills")]: "dir",
  });

  // act
  const resolvedPlugin = await resolveLoose(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some(
      (n) => n.includes("component declarations conflict") && n.includes("skills"),
    ),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

test("MM-6 entry + manifest both absent + <pluginRoot>/skills exists -> installable WITHOUT skills (no implicit-by-convention in loose)", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "skills")]: "dir",
  });

  // act
  const resolvedPlugin = await resolveLoose(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );

  if (resolvedPlugin.state === "installable") {
    // D-07 array shape: empty array (no implicit-by-convention in loose mode).
    assert.deepStrictEqual(
      resolvedPlugin.componentPaths.skills,
      [],
      "no implicit-by-convention in loose mode",
    );
    assert.ok(!resolvedPlugin.supported.includes("skills"));
  }
});

// ──────────────────────────────────────────────────────────────────────────
// DFEN-02: install-time enablement in loose mode
// ──────────────────────────────────────────────────────────────────────────

// D-101-08: structurally the same shape as the MM-6 conflict test above -- a
// manifest declaration with a silent entry -- but the outcome inverts, because
// the loose-mode conflict rule is closed-set by construction. It iterates the
// three supported component-path kinds plus `mcpServers`; `defaultEnabled` is
// metadata and belongs to none of those sets, exactly as `description` and
// `version` have never been conflict material. Nothing in the code special-cases
// this, so this test is the only thing that would notice if a later edit widened
// the conflict machinery to iterate keys instead of a closed tuple.
test("DFEN-02 manifest-only defaultEnabled with a silent entry -> resolves carrying false, not a conflict", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [manifestPath]: { contents: JSON.stringify({ name: "p1", defaultEnabled: false }) },
  });

  // act
  const resolvedPlugin = await resolveLoose(pluginEntry({ source: "./local" }), context);

  // assert
  assert.notStrictEqual(
    resolvedPlugin.state,
    "unavailable",
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
  assert.ok(
    !resolvedPlugin.notes.some((n) => n.includes("declarations conflict")),
    `metadata must not be conflict material, notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
  requirePartialInstallable(resolvedPlugin);
  assert.strictEqual(resolvedPlugin.defaultEnabled, false);
});

// D-101-04: the four precedence shapes, each asserted against the literal the
// strict-mode suite asserts for the same inputs. The expected value is spelled
// out rather than obtained by cross-calling the other mode, so a divergence
// reads directly in the failure output. Both modes take the value from the one
// shared computation, so the evaluation order is mode-independent.
test("DFEN-02 loose: entry false + manifest true -> carries false (entry wins)", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [manifestPath]: { contents: JSON.stringify({ name: "p1", defaultEnabled: true }) },
  });

  // act
  const resolvedPlugin = await resolveLoose(
    pluginEntry({ source: "./local", defaultEnabled: false }),
    context,
  );
  requirePartialInstallable(resolvedPlugin);

  // assert
  assert.strictEqual(resolvedPlugin.defaultEnabled, false);
});

test("DFEN-02 loose: entry true + manifest false -> carries true (entry wins both ways)", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [manifestPath]: { contents: JSON.stringify({ name: "p1", defaultEnabled: false }) },
  });

  // act
  const resolvedPlugin = await resolveLoose(
    pluginEntry({ source: "./local", defaultEnabled: true }),
    context,
  );
  requirePartialInstallable(resolvedPlugin);

  // assert
  assert.strictEqual(resolvedPlugin.defaultEnabled, true);
});

test("DFEN-02 loose: absent at both declaration sites -> carries true", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveLoose(pluginEntry({ source: "./local" }), context);
  requirePartialInstallable(resolvedPlugin);

  // assert
  assert.strictEqual(resolvedPlugin.defaultEnabled, true);
});

// The manifest-only cell again, read as a parity row rather than as the
// non-conflict proof above: the value the entry never declared still carries.
test("DFEN-02 loose: manifest-only declaration -> carries the manifest value", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [manifestPath]: { contents: JSON.stringify({ name: "p1", defaultEnabled: false }) },
    [path.join(localRoot, "skills")]: "dir",
  });

  // act
  const resolvedPlugin = await resolveLoose(
    pluginEntry({ source: "./local", skills: "skills" }),
    context,
  );
  requirePartialInstallable(resolvedPlugin);

  // assert
  assert.strictEqual(resolvedPlugin.defaultEnabled, false);
});

// D-101-01 / D-101-04: the partial arm in loose mode, with the value coming
// from the manifest fallback rather than the entry -- the strict-mode sibling
// covers the entry side. `themes` is an unsupported kind, so it degrades the
// plugin without a structural defect; it is not a component-path kind, so it is
// not loose-mode conflict material either.
test("DFEN-02 loose: partially-available arm carries the manifest-resolved defaultEnabled", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [manifestPath]: { contents: JSON.stringify({ name: "p1", defaultEnabled: false }) },
  });

  // act
  const resolvedPlugin = await resolveLoose(
    pluginEntry({ source: "./local", themes: "./themes" }),
    context,
  );

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "partially-available",
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
  requirePartialInstallable(resolvedPlugin);
  assert.strictEqual(resolvedPlugin.defaultEnabled, false);
});

// ──────────────────────────────────────────────────────────────────────────
// MM-7: mcpServers entry-only
// ──────────────────────────────────────────────────────────────────────────

test("MM-7 entry.mcpServers absent + manifest.mcpServers present -> conflict notInstallable", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [manifestPath]: {
      contents: JSON.stringify({ name: "p1", mcpServers: { srv: { command: "x" } } }),
    },
  });

  // act
  const resolvedPlugin = await resolveLoose(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("mcpServers") && n.includes("conflict")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

test("MM-7 entry.mcpServers absent + standalone .mcp.json present -> conflict notInstallable", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, ".mcp.json")]: { contents: JSON.stringify({ srv: {} }) },
  });

  // act
  const resolvedPlugin = await resolveLoose(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("mcpServers") && n.includes("conflict")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

test("MM-7 entry.mcpServers present + valid -> installable with mcpServers populated", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, { [localRoot]: "dir" });

  // act
  const resolvedPlugin = await resolveLoose(
    pluginEntry({ source: "./local", mcpServers: { srv1: { command: "node" } } }),
    context,
  );

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );

  if (resolvedPlugin.state === "installable") {
    assert.deepStrictEqual(Object.keys(resolvedPlugin.mcpServers), ["srv1"]);
  }
});

test("D-03 entry.mcpServers string reference in loose mode -> unavailable (not resolved, not malformed)", async () => {
  // arrange
  // Loose mode does not resolve the strict-mode string-reference feature; it
  // degrades honestly rather than mislabeling the string as a malformed map.
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveLoose(
    pluginEntry({ source: "./local", mcpServers: "./x.mcp.json" }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("string reference") && n.includes("loose mode")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

test("MM-7 entry.mcpServers malformed (non-object) in loose mode -> unavailable + malformed mcpServers note", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveLoose(
    pluginEntry({ source: "./local", mcpServers: 42 }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("malformed mcpServers")),
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

// ──────────────────────────────────────────────────────────────────────────
// PR-3 + PR-5 in loose mode (same semantics as strict)
// ──────────────────────────────────────────────────────────────────────────

test("PR-3 loose: entry declares unsupported component -> notInstallable", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveLoose(
    pluginEntry({ source: "./local", themes: ["dark"] }),
    context,
  );
  // D-64-06: unsupported component kind, no structural defect -> unsupported.

  // assert
  assert.strictEqual(resolvedPlugin.state, "partially-available");
  assert.ok(resolvedPlugin.notes.some((n) => n === "contains themes"));
});

// HOOK-01 loose: hooks/hooks.json present + parseable -> installable with
// hooks supported. Mirrors the strict-mode admission path because the
// convention-file discovery is mode-agnostic (it does not depend on
// entry-vs-manifest declaration semantics).
test("HOOK-01 loose: hooks/hooks.json present + parseable -> installable WITH hooks in supported", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: {
      contents: JSON.stringify({
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo hi" }] }],
      }),
    },
  });

  // act
  const resolvedPlugin = await resolveLoose(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );

  if (resolvedPlugin.state === "installable") {
    assert.ok(resolvedPlugin.supported.includes("hooks"));
    assert.ok(!resolvedPlugin.notes.some((n) => n.includes("contains hooks")));
  }
});

// D-57-04 loose: malformed hooks/hooks.json flips installable: false with
// parse-failure detail.
test("D-57-04 loose: hooks/hooks.json present + parse-fails -> notInstallable + parse-detail note", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "hooks", "hooks.json")]: { contents: "not-valid-json" },
  });

  // act
  const resolvedPlugin = await resolveLoose(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("hooks.json")),
    `notes must mention hooks.json: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

// HOOK-01 loose regression guard: no declaration + no convention file ->
// installable: true and hooks NOT in supported.
test("HOOK-01 loose: no hooks declared and no hooks/hooks.json -> installable WITHOUT hooks in supported", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveLoose(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(resolvedPlugin.state, "installable");

  if (resolvedPlugin.state === "installable") {
    assert.ok(!resolvedPlugin.supported.includes("hooks"));
  }
});

for (const scenario of unsupportedConventionScenarios) {
  test(`PR-4 loose discovers the unsupported ${scenario.kind} default location`, async () => {
    // arrange
    const localRoot = pathUnderMarketplace(`./local-${scenario.kind}`);
    const context = resolveContext(marketplaceRoot, {
      [localRoot]: "dir",
      [path.join(localRoot, scenario.relativePath)]: scenario.stat,
    });

    // act
    const resolvedPlugin = await resolveLoose(
      pluginEntry({ source: `./local-${scenario.kind}` }),
      context,
    );

    // assert
    assert.strictEqual(
      resolvedPlugin.state,
      "partially-available",
      `${scenario.kind} should be unsupported`,
    );
    assert.ok(
      resolvedPlugin.notes.includes(`contains ${scenario.kind}`),
      `notes: ${resolvedPlugin.notes.join(" / ")}`,
    );
  });
}

// D-90-06 loose: a bin/ dir on disk resolves installable (runtime-honored via
// the PENV-01 PATH ledger), not partially-available.
test("D-90-06 loose: bin/ dir on disk -> installable, no bin contains-note", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "bin")]: "dir",
  });

  // act
  const resolvedPlugin = await resolveLoose(pluginEntry({ source: "./local" }), context);

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes if not installable: ${resolvedPlugin.notes.join(" / ")}`,
  );
  assert.ok(
    !resolvedPlugin.notes.some((n) => n.includes("contains bin")),
    `notes must not contain "contains bin": ${resolvedPlugin.notes.join(" / ")}`,
  );
});

test("PR-5 loose: entry.dependencies -> installable with manual-install note", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin = await resolveLoose(
    pluginEntry({ source: "./local", dependencies: { other: "1.0" } }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "installable");
  assert.ok(resolvedPlugin.notes.some((n) => n.includes("must be installed manually")));
});

// ──────────────────────────────────────────────────────────────────────────
// MM-6 happy path (loose)
// ──────────────────────────────────────────────────────────────────────────

test("MM-6 loose happy path: entry declares skills and commands -> installable with both supported", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "skills")]: "dir",
    [path.join(localRoot, "commands")]: "dir",
  });

  // act
  const resolvedPlugin = await resolveLoose(
    pluginEntry({ source: "./local", skills: "skills", commands: "commands" }),
    context,
  );

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );

  if (resolvedPlugin.state === "installable") {
    // D-07 array shape.
    assert.deepStrictEqual(resolvedPlugin.componentPaths.skills, ["skills"]);
    assert.deepStrictEqual(resolvedPlugin.componentPaths.commands, ["commands"]);
    assert.deepStrictEqual(resolvedPlugin.supported.sort(), ["commands", "skills"]);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// D-07: loose mode accepts top-level arrays in entry-only fields with first-
// wins dedup; no implicit-by-convention probing.
// ──────────────────────────────────────────────────────────────────────────

test("D-07 loose: entry.skills as multi-element array preserves declared order with dedup", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [path.join(localRoot, "a")]: "dir",
    [path.join(localRoot, "b")]: "dir",
  });

  // act
  const resolvedPlugin = await resolveLoose(
    pluginEntry({ source: "./local", skills: ["a", "b", "a"] }),
    context,
  );

  // assert
  assert.strictEqual(
    resolvedPlugin.state,
    "installable",
    `notes: ${resolvedPlugin.notes.join(" / ")}`,
  );

  if (resolvedPlugin.state === "installable") {
    // First-wins dedup; declared order preserved.
    assert.deepStrictEqual(resolvedPlugin.componentPaths.skills, ["a", "b"]);
  }
});

// ──────────────────────────────────────────────────────────────────────────
// RSTATE-02 / D-64-07: structural precedence (loose mode)
// ──────────────────────────────────────────────────────────────────────────

// Loose mode: a manifest/standalone mcpServers conflict (structural) plus an
// entry-declared unsupported kind (themes) resolves `unavailable` -- the
// structural defect wins over the unsupported-component signal.
test("RSTATE-02 loose: structural conflict + unsupported kind -> unavailable (structural precedence)", async () => {
  // arrange
  const localRoot = pathUnderMarketplace("./local");
  const manifestPath = path.join(localRoot, ".claude-plugin", "plugin.json");
  const context = resolveContext(marketplaceRoot, {
    [localRoot]: "dir",
    [manifestPath]: {
      contents: JSON.stringify({ name: "p1", mcpServers: { srv: { command: "x" } } }),
    },
  });

  // act
  const resolvedPlugin = await resolveLoose(
    pluginEntry({ source: "./local", themes: ["dark"] }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.ok(
    resolvedPlugin.notes.some((n) => n.includes("mcpServers") && n.includes("conflict")),
    `structural note missing; got: ${resolvedPlugin.notes.join(" / ")}`,
  );
  assert.ok(
    resolvedPlugin.notes.includes("contains themes"),
    `unsupported note missing; got: ${resolvedPlugin.notes.join(" / ")}`,
  );
});

// ──────────────────────────────────────────────────────────────────────────
// RSTATE-04 / D-64-04: requirePartialInstallable gate (loose mode)
// ──────────────────────────────────────────────────────────────────────────

test("RSTATE-04 loose: requirePartialInstallable admits installable and exposes pluginRoot", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin: ResolvedPlugin = await resolveLoose(
    pluginEntry({ source: "./local" }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "installable");
  requirePartialInstallable(resolvedPlugin);
  assert.strictEqual(typeof resolvedPlugin.pluginRoot, "string");
});

test("RSTATE-04 loose: requirePartialInstallable admits unsupported and exposes pluginRoot", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, { [pathUnderMarketplace("./local")]: "dir" });

  // act
  const resolvedPlugin: ResolvedPlugin = await resolveLoose(
    pluginEntry({ source: "./local", themes: ["dark"] }),
    context,
  );

  // assert
  assert.strictEqual(resolvedPlugin.state, "partially-available");
  requirePartialInstallable(resolvedPlugin);
  assert.strictEqual(typeof resolvedPlugin.pluginRoot, "string");
});

test("RSTATE-04 loose: requirePartialInstallable throws on unavailable", async () => {
  // arrange
  const context = resolveContext(marketplaceRoot, {});

  // act
  const resolvedPlugin = await resolveLoose(pluginEntry({ source: "./missing" }), context);

  // assert
  assert.strictEqual(resolvedPlugin.state, "unavailable");
  assert.throws(
    () => {
      requirePartialInstallable(resolvedPlugin);
    },
    (error: unknown) =>
      error instanceof Error && error.message.includes('Plugin "p1" is not installable'),
  );
});

declare const resolvedPluginContract: ResolvedPlugin;
declare const installablePluginContract: ResolvedPluginInstallable;
declare const partiallyAvailablePluginContract: ResolvedPluginPartiallyAvailable;
declare const unavailablePluginContract: ResolvedPluginUnavailable;
declare const materializable: MaterializablePlugin;

function proveExactDiscriminants(): void {
  void (installablePluginContract.installable satisfies true);
  void (partiallyAvailablePluginContract.installable satisfies true);
  void (unavailablePluginContract.installable satisfies false);
  void (installablePluginContract.state satisfies "installable");
  void (partiallyAvailablePluginContract.state satisfies "partially-available");
  void (unavailablePluginContract.state satisfies "unavailable");
}

// ──────────────────────────────────────────────────────────────────────────
// Positive narrowing: pluginRoot is readable on installable + unsupported
// (D-64-06: `unsupported` is the force-degradable arm and keeps pluginRoot).
// ──────────────────────────────────────────────────────────────────────────

function consumeInstallable(): string {
  return installablePluginContract.pluginRoot;
}

function consumeUnsupported(): string {
  return partiallyAvailablePluginContract.pluginRoot;
}

function narrowOnMaterializability(): string | undefined {
  if (resolvedPluginContract.installable) {
    return resolvedPluginContract.pluginRoot;
  }

  return undefined;
}

// ──────────────────────────────────────────────────────────────────────────
// NEGATIVE narrowing -- the load-bearing NFR-7 assertions (D-64-05).
// ──────────────────────────────────────────────────────────────────────────

function consumeUnavailable(): void {
  // @ts-expect-error -- NFR-7: pluginRoot must NOT be accessible on the unavailable variant.
  void unavailablePluginContract.pluginRoot;
}

function narrowOnMaterializabilityNegative(): void {
  if (!resolvedPluginContract.installable) {
    // @ts-expect-error -- the false arm cannot expose pluginRoot.
    void resolvedPluginContract.pluginRoot;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// RSTATE-04 / D-64-04: requirePartialInstallable narrows to
// installable | unsupported and can NEVER admit the unavailable arm.
// ──────────────────────────────────────────────────────────────────────────

function gateNarrowsForce(): string {
  requirePartialInstallable(resolvedPluginContract);
  return resolvedPluginContract.pluginRoot;
}

function gateExcludesUnavailable(): void {
  requirePartialInstallable(resolvedPluginContract);
  // @ts-expect-error -- the gate cannot leave the unavailable arm.
  const bad: ResolvedPluginUnavailable = resolvedPluginContract;
  void bad;
}

// ──────────────────────────────────────────────────────────────────────────
// NFR-7 / FORCE-05: MaterializablePlugin admits installable + unsupported and
// EXCLUDES the unavailable arm. The force install/update holders widen to this
// union; the negative assertion proves no widened holder can ever carry an
// `unavailable` plugin (and therefore can never read `pluginRoot` off one).
// ──────────────────────────────────────────────────────────────────────────

function materializableAdmitsInstallable(): MaterializablePlugin {
  return installablePluginContract;
}

function materializableAdmitsUnsupported(): MaterializablePlugin {
  return partiallyAvailablePluginContract;
}

function materializableExposesPluginRoot(): string {
  return materializable.pluginRoot; // OK -- both arms carry pluginRoot (NFR-7).
}

function materializableExcludesUnavailable(): void {
  // @ts-expect-error -- NFR-7 / FORCE-05: the unavailable arm is not assignable to MaterializablePlugin.
  const bad: MaterializablePlugin = unavailablePluginContract;
  void bad;
}

function materializableExposesDefaultEnabled(): boolean {
  // DFEN-03: readable off the union with no narrowing, which is exactly what
  // the install path does once it widens `resolved` to MaterializablePlugin.
  return materializable.defaultEnabled;
}

function unavailableHasNoDefaultEnabled(): void {
  // @ts-expect-error -- D-64-05: the arm that cannot be installed carries no install-time enablement answer.
  void unavailablePluginContract.defaultEnabled;
}

// Reference the helpers so tsc doesn't flag them as unused (they're not
// exported -- keeping them tree-shake-safe).
void proveExactDiscriminants;
void consumeInstallable;
void consumeUnsupported;
void narrowOnMaterializability;
void consumeUnavailable;
void narrowOnMaterializabilityNegative;
void gateNarrowsForce;
void gateExcludesUnavailable;
void materializableAdmitsInstallable;
void materializableAdmitsUnsupported;
void materializableExposesPluginRoot;
void materializableExcludesUnavailable;
void materializableExposesDefaultEnabled;
void unavailableHasNoDefaultEnabled;
