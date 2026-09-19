// Architecture-level invariant pins for the HOOK-01 / HOOK-02 / HOOK-03 /
// D-57-01 / D-57-02 / D-57-04 / NFR-7 leaf-foundation contract.
//
// Each runtime or compile-time assertion pins a locked foundation contract.
//
// Exact public types pin state versions and required resource arrays.
// Runtime parse round-trips exercise HOOK-03 lenience at every nesting level. A type-level
// `@ts-expect-error` directive locks the NFR-7 discriminated contract --
// `npm run typecheck` is the load-bearing assertion for that block.

import assert from "node:assert/strict";
import test from "node:test";

import { parseHooksConfig } from "../../extensions/pi-claude-marketplace/domain/components/hooks.ts";
import { resolveStrict } from "../../extensions/pi-claude-marketplace/domain/plugin-resolver.ts";

import type { PluginEntry } from "../../extensions/pi-claude-marketplace/domain/components/plugin.ts";
import type {
  ResolveContext,
  ResolvedPluginUnavailable,
} from "../../extensions/pi-claude-marketplace/domain/resolver-types.ts";
import type {
  ExtensionState,
  PluginInstallRecord,
} from "../../extensions/pi-claude-marketplace/persistence/state-io.ts";

// The actual public state contract keeps exactly both accepted schema versions
// and requires all five resource arrays. Persistence owner tests exercise these
// same fields through loadState/saveState, including invalid records and bytes.
type IsExact<Actual, Expected> = [Actual] extends [Expected]
  ? [Expected] extends [Actual]
    ? true
    : false
  : false;

void (true satisfies IsExact<ExtensionState["schemaVersion"], 1 | 2>);
void (true satisfies IsExact<
  PluginInstallRecord["resources"],
  {
    skills: string[];
    prompts: string[];
    agents: string[];
    mcpServers: string[];
    hooks: string[];
  }
>);

// ──────────────────────────────────────────────────────────────────────────
// Block 3: HOOK-03 -- public hook resolution accepts unknown fields at every
// nesting level (lenient stance).
// ──────────────────────────────────────────────────────────────────────────

for (const { label, raw, expectedValue, expectedDropped } of [
  {
    label: "handler extension",
    raw: '{"PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"echo hi","futureHandlerField":"ignored"}]}]}',
    expectedValue: {
      PreToolUse: [
        {
          matcher: "Bash",
          hooks: [{ type: "command", command: "echo hi", futureHandlerField: "ignored" }],
        },
      ],
    },
    expectedDropped: [],
  },
  {
    label: "group extension",
    raw: '{"PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"echo hi"}],"futureEntryField":"ignored"}]}',
    expectedValue: {
      PreToolUse: [
        {
          matcher: "Bash",
          hooks: [{ type: "command", command: "echo hi" }],
          futureEntryField: "ignored",
        },
      ],
    },
    expectedDropped: [],
  },
  {
    label: "future event",
    raw: '{"FutureEventX":[{"matcher":"Bash","hooks":[{"type":"command","command":"echo hi"}]}]}',
    expectedValue: {},
    expectedDropped: [{ kind: "event", event: "FutureEventX" }],
  },
]) {
  test(`HOOK-03: public hook resolution preserves ${label} lenience`, () => {
    // arrange
    const anchors = { homedir: "/home/u", cwd: "/plugins/alpha", projectRoot: "/plugins/alpha" };

    // act
    const resolvedHooks = parseHooksConfig(raw, anchors, () => null);

    // assert
    assert.deepStrictEqual(resolvedHooks, {
      ok: true,
      value: expectedValue,
      dropped: expectedDropped,
      ifPredicates: new Map(),
    });
  });
}

// ──────────────────────────────────────────────────────────────────────────
// Block 5: NFR-7 + HOOK-01 -- resolveStrict admits a
// hook-only plugin with a parseable hooks/hooks.json. The discriminated
// installable: true | false contract is enforced both at runtime (these
// assertions) and at compile time (the @ts-expect-error directive below).
// ──────────────────────────────────────────────────────────────────────────

/**
 * Build a ResolveContext where:
 *   - the plugin root exists as a directory
 *   - hooks/hooks.json is present + parseable
 *   - plugin.json is absent (no manifest)
 *   - everything else returns null
 */
function hookOnlyCtx(pluginRoot: string): ResolveContext {
  const hooksPath = `${pluginRoot}/hooks/hooks.json`;
  const validHooks = JSON.stringify({
    PreToolUse: [{ matcher: "Edit", hooks: [{ type: "command", command: "/bin/true" }] }],
  });

  return {
    marketplaceRoot: "/abs/marketplace",
    statKind(p: string): Promise<"file" | "dir" | null> {
      if (p === pluginRoot) {
        return Promise.resolve("dir");
      }

      if (p === hooksPath) {
        return Promise.resolve("file");
      }

      return Promise.resolve(null);
    },
    readFileText(p: string): Promise<string> {
      if (p === hooksPath) {
        return Promise.resolve(validHooks);
      }

      return Promise.reject(Object.assign(new Error("ENOENT"), { code: "ENOENT" }));
    },
  };
}

test("NFR-7 + HOOK-01: resolveStrict admits a hook-only plugin (installable: true with hooks supported)", async () => {
  // arrange
  const entry: PluginEntry = { name: "hookplug", source: "./hookplug" };
  const ctx = hookOnlyCtx("/abs/marketplace/hookplug");

  // act
  const r = await resolveStrict(entry, ctx);

  // assert
  assert.deepStrictEqual(r, {
    state: "installable",
    installable: true,
    name: "hookplug",
    pluginRoot: "/abs/marketplace/hookplug",
    supported: ["hooks"],
    unsupported: [],
    notes: [],
    componentPaths: { skills: [], commands: [], agents: [] },
    mcpServers: {},
    hooksConfigPath: "hooks/hooks.json",
    defaultEnabled: true,
  });
});

// NFR-7 type-level check. The load-bearing assertion is the
// `@ts-expect-error` directive: TypeScript MUST refuse to compile a read of
// `pluginRoot` from the `unavailable` arm. If the discriminated contract
// regresses (e.g. someone adds `pluginRoot` to the `unavailable` variant),
// the @ts-expect-error becomes "Unused" and `npm run typecheck` fails.
function nfr7TypeLevelGuard(notInst: ResolvedPluginUnavailable): void {
  // @ts-expect-error -- NFR-7: pluginRoot must NOT be accessible on the unavailable variant.
  void notInst.pluginRoot;
}

void nfr7TypeLevelGuard;
