---
phase: 02-adapter-file-delivery
plan: 10
subsystem: mcp-bridge
status: complete
tags: [gap-closure, mcp-bridge, user-overrides, marker, stub-restore]
requires:
  - phase: 02-adapter-file-delivery
    provides: the adapter-file stage/unstage bridge, overlay absorption (AFILE-06) and the rollback citation cleanup
provides:
  - "`_piClaudeMarketplace.keptOverride`: the user override a plugin entry replaced, kept verbatim and inert"
  - "One write-back rule in `keptServers`: every unstage, and a stage that drops a plugin entry, writes the kept override back marker-less in place"
  - "Executable proof against pinned pi-mcp-adapter 5.0.0 that nothing under the marker applies"
  - "PRD MC-5 states the member and the write-back"
affects: [plan 02-11 install warning, plan 02-12 cross-scope lifecycle, verification gap 1]
actuals:
  tokens: 9850
  tasks: 3
  commits: 1
plan_head_before: b2a84af24f1a44659f8c41e8eb133250f05ad297
plan_head_after: 21fc8a88f0fb16149b6be7222e79d366010ec6ae
tech-stack:
  added: []
  patterns:
    - "A marker member gets a production reader (`keptOverrideOf`) so the unused-type-member gate sees it read"
key-files:
  created:
    - tests/integration/mcp-override-lifecycle.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/mcp/marker.ts
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-doc.ts
    - extensions/pi-claude-marketplace/bridges/mcp/adapter-entry.ts
    - extensions/pi-claude-marketplace/bridges/mcp/stage.ts
    - extensions/pi-claude-marketplace/bridges/mcp/unstage.ts
    - tests/bridges/mcp/marker.test.ts
    - tests/bridges/mcp/adapter-doc.test.ts
    - tests/bridges/mcp/adapter-entry.test.ts
    - tests/bridges/mcp/stage.test.ts
    - tests/bridges/mcp/unstage.test.ts
    - docs/prd/pi-claude-marketplace-prd.md
    - scripts/check-unused-type-members.contracts.json
key-decisions:
  - "keptOverride is the marker's last member and is read only as an own plain-object property; any other value parses as a marker without it"
  - "A kept value is written back only while it is still an override (isOverlay: plain object, no own marker, no string command/url/socket); otherwise it leaves with the entry"
  - "keptOverrides reads only the selected key, so an override is carried into the restaged entry or written back, never both"
requirements-completed: [AFILE-06, AFILE-01, AFILE-03, AFILE-05]
metrics:
  duration: 95min
  completed: 2026-10-04
---

# Phase 2 Plan 10: Keep and Restore User Overrides Summary

**A plugin MCP entry that replaces a marker-less user override now keeps it verbatim in `_piClaudeMarketplace.keptOverride` (only the carried fields active), carries it through restages, and every unstage writes it back marker-less in place. Proven against pinned pi-mcp-adapter 5.0.0.**

## Performance

- **Duration:** about 95 min, of which about 60 min is two full-scope pre-commit runs
- **Tasks:** 3 of 3
- **Commits:** 1 (`21fc8a88`), per the plan's single-commit gate
- **Files:** 13 (5 source, 6 test, PRD, contracts JSON)

## What Changed

- **marker.ts:** `ClaudeMarketplaceMarker.keptOverride?` is new. `readMarker` returns it only when it is an own plain-object member. `buildMarker(plugin, marketplace, keptOverride?)` writes it last and omits it when undefined. The new export `keptOverrideOf(value)` is its production reader. The key string and `plugin` / `marketplace` are unchanged (MC-5).
- **adapter-doc.ts:** `McpServerPartition.keptOverrides` lists, for the plugin's entries under the selected key only, the override each marker keeps while `restorableOverride` accepts it. `keptServers` applies one write-back table through the private `survivingEntry`. A plugin entry restaged in its map is dropped. Any other plugin entry is replaced in place by its restorable kept override, or dropped when it has none. An overlay under a restaged name is dropped. Everything else is kept.
- **adapter-entry.ts:** `StampServersInput.keptOverrides` is new and required. `keptOverrideFor` reads it with `Object.hasOwn` and accepts only a plain object, so a server named `__proto__` never picks up `Object.prototype` (WR-01). Carried fields still come only from `previous`, so no credential-bearing field becomes active.
- **stage.ts:** it passes `keptOverrides: { ...keptOverrides, ...overlays }` to `stampServers`. The doc comment now describes the absorb-and-keep step and the write-back.
- **unstage.ts:** the header comment changed. There is no code change: `withPluginServers(target.config, pluginName, marketplaceName, {})` writes the override back.
- **PRD MC-5:** the row now names `keptOverride` and the write-back on every unstage (AFILE-06, AFILE-01), and states that a marker without the member stays valid.

## Task Results

- **Task 1 (tracer):** the source changes and the mechanical suite updates went in: `keptOverrides: {}` in 10 `stampServers` calls and in 4 whole-partition expectations. In 3 stage byte expectations, `keptOverride` is now the marker's last member. The absorb case was retitled. The new `tests/integration/mcp-override-lifecycle.test.ts` runs a real project install. The entry keeps the stub with only `disabled` active, and `stub-secret` occurs once in the file. A real uninstall restores the original bytes exactly, and no `.pi/mcp.json` is created. The tracer gate re-ran the verify block: 171 pass, 0 fail. Task 2 then went ahead.
- **Task 2 (TDD owner tests):** one case per `<behavior>` row went into the five owner files. All five modules reach 100% direct coverage (see Verification Evidence). The adapter-entry floor-tie message now ends "and re-prove that the adapter applies nothing under _piClaudeMarketplace (keptOverride)". A provenance comment above it lists the five 5.0.0 facts with file:line references. The adapter proof passed (see below).
- **Task 3:** the PRD MC-5 row changed and the contract pins were re-derived. A full pre-commit run passed, and the work went into one commit.

## Adapter Proof (pinned pi-mcp-adapter 5.0.0)

- **ADAPTER_PROOF=ok**, PROOF_EXIT=0. The tarball's sha1 was checked before unpacking: `6c20461d658ec7d7b7e303b067e2ff13a7846d00`. The proof ran in the scratch root `/var/tmp/mcp4-p2-10-adapter-proof`. `strip-json-comments` is a symlink to the repository's 5.0.3. `@typesafe-ai/sdk`, `smol-toml` and `zod` are local ESM stand-ins. Nothing was installed from a registry.
- **APPROVAL_HASH_COVERS_MARKER=true.** pi-mcp-adapter's `hashProjectServerDefinition` hashes the whole entry, `_piClaudeMarketplace.keptOverride` included. This is an identity read only. The kept override is set when the entry is created and carried unchanged, so it adds no approval prompt beyond the install itself. A hand edit inside the marker re-prompts, like any other edit of the entry (T-02-29, accepted).
- Verdicts: (a) the effective entry has `command`, `args` and the injected `env`. It has no `STUB_TOKEN`, no `bearerToken` and no `headers`. It has `disabled: true`, and its marker deep-equals the file's marker. (b) No `console.warn` or `console.error` call was made during the load. (c) `/mcp-adapter` enable and then disable both reported `changed: true`, and the marker stayed deep-equal. (e) After unstage, the file deep-equals the stub document.

Proof script (`/var/tmp/mcp4-p2-10-adapter-proof/proof.mjs`):

```js
// Proof against the pinned pi-mcp-adapter 5.0.0: the adapter applies nothing
// from inside `_piClaudeMarketplace`, keeps the marker through its own
// enable/disable writer, and the bridge's unstage writes the override back.
// Run with HOME and PI_CODING_AGENT_DIR pointing into this scratch root.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REPO = "/home/acolomba/src/pi-claude-marketplace-mcp-4";
const SCRATCH = "/var/tmp/mcp4-p2-10-adapter-proof";
const repoModule = (rel) =>
  import(pathToFileURL(path.join(REPO, "extensions/pi-claude-marketplace", rel)).href);
const adapterModule = (rel) =>
  import(pathToFileURL(path.join(SCRATCH, "node_modules/pi-mcp-adapter/dist", rel)).href);

const { locationsFor } = await repoModule("persistence/locations.ts");
const { prepareStageMcpServers, commitPreparedMcp } = await repoModule("bridges/mcp/stage.ts");
const { unstageMcpServers } = await repoModule("bridges/mcp/unstage.ts");
const { loadMcpConfigWithSources, writeProjectServerDisabledOverride } =
  await adapterModule("config.js");
const { hashProjectServerDefinition } = await adapterModule("project-server-trust.js");

const projectDir = path.join(process.env.HOME, "work", "project");
const locations = locationsFor("project", projectDir);
const filePath = locations.mcpAdapterJsonPath;
const stubDoc = {
  mcpServers: {
    srv: {
      disabled: true,
      env: { STUB_TOKEN: "stub-secret" },
      bearerToken: "!echo stub",
      headers: { Authorization: "Bearer stub" },
    },
  },
};
await mkdir(path.dirname(filePath), { recursive: true });
await writeFile(filePath, `${JSON.stringify(stubDoc, null, 2)}\n`);

await commitPreparedMcp(
  await prepareStageMcpServers({
    locations,
    cwd: projectDir,
    marketplaceName: "mp",
    pluginName: "hello",
    pluginRoot: path.join(projectDir, "plugin-root"),
    pluginData: path.join(projectDir, "plugin-data"),
    servers: { srv: { command: "node", args: ["server.js"] } },
  }),
);
const readSrv = async () => JSON.parse(await readFile(filePath, "utf8")).mcpServers.srv;
const staged = await readSrv();
const fileMarker = staged._piClaudeMarketplace;

// (a) and (b): the adapter's own loader, with console.warn/error recorded.
const consoleCalls = [];
const saved = { warn: console.warn, error: console.error };
console.warn = (...args) => consoleCalls.push(["warn", ...args.map(String)]);
console.error = (...args) => consoleCalls.push(["error", ...args.map(String)]);
let effective;
try {
  effective = loadMcpConfigWithSources(undefined, projectDir).config.mcpServers.srv;
} finally {
  console.warn = saved.warn;
  console.error = saved.error;
}

const has = (obj, key) => Object.hasOwn(obj, key);
const checkA = {
  command: effective.command === "node",
  args: JSON.stringify(effective.args) === JSON.stringify(["server.js"]),
  envWithoutStubToken: !has(effective.env ?? {}, "STUB_TOKEN"),
  noBearerToken: !has(effective, "bearerToken"),
  noHeaders: !has(effective, "headers"),
  disabledCarried: effective.disabled === true,
  markerDeepEqualsFile: (() => {
    try {
      assert.deepStrictEqual(effective._piClaudeMarketplace, fileMarker);
      return true;
    } catch {
      return false;
    }
  })(),
};
const a = Object.values(checkA).every(Boolean);
const b = consoleCalls.length === 0;

// (c) the adapter's enable/disable writer keeps the marker unchanged.
const enable = writeProjectServerDisabledOverride(undefined, projectDir, "srv", false);
const afterEnable = await readSrv();
const disable = writeProjectServerDisabledOverride(undefined, projectDir, "srv", true);
const afterDisable = await readSrv();
const markerKept = (entry) => {
  try {
    assert.deepStrictEqual(entry._piClaudeMarketplace, effective._piClaudeMarketplace);
    return true;
  } catch {
    return false;
  }
};
const c =
  enable.changed === true &&
  disable.changed === true &&
  markerKept(afterEnable) &&
  markerKept(afterDisable);

// (d) recorded only: does the project-approval hash cover the kept override?
const { keptOverride: _omitted, ...markerWithoutKept } = effective._piClaudeMarketplace;
const approvalHashCoversMarker =
  hashProjectServerDefinition(effective) !==
  hashProjectServerDefinition({ ...effective, _piClaudeMarketplace: markerWithoutKept });

// (e) unstage writes the stub back.
const unstage = await unstageMcpServers({ locations, marketplaceName: "mp", pluginName: "hello" });
const restored = JSON.parse(await readFile(filePath, "utf8"));
const e = (() => {
  try {
    assert.deepStrictEqual(restored, stubDoc);
    return true;
  } catch {
    return false;
  }
})();

console.log(
  JSON.stringify(
    {
      stagedEntry: staged,
      effectiveEntry: effective,
      checkA,
      consoleCalls,
      enable,
      afterEnable,
      disable,
      afterDisable,
      unstageRemovedNames: unstage.removedNames,
      restored,
      verdicts: { a, b, c, e },
    },
    null,
    2,
  ),
);
console.log(`APPROVAL_HASH_COVERS_MARKER=${approvalHashCoversMarker}`);
console.log(`ADAPTER_PROOF=${a && b && c && e ? "ok" : "failed"}`);
```

Command: `cd /var/tmp/mcp4-p2-10-adapter-proof && HOME=/var/tmp/mcp4-p2-10-adapter-proof/home PI_CODING_AGENT_DIR=/var/tmp/mcp4-p2-10-adapter-proof/home/.pi/agent node proof.mjs > tmp/p2-10-adapter-proof.log 2>&1; echo "PROOF_EXIT=$?" >> tmp/p2-10-adapter-proof.log` (Node v26.10.0).

`tmp/p2-10-adapter-proof.log`, verbatim:

```text
{
  "stagedEntry": {
    "command": "node",
    "args": [
      "server.js"
    ],
    "env": {
      "CLAUDE_PLUGIN_ROOT": "/var/tmp/mcp4-p2-10-adapter-proof/home/work/project/plugin-root",
      "CLAUDE_PLUGIN_DATA": "/var/tmp/mcp4-p2-10-adapter-proof/home/work/project/plugin-data",
      "CLAUDE_PROJECT_DIR": "/var/tmp/mcp4-p2-10-adapter-proof/home/work/project"
    },
    "disabled": true,
    "_piClaudeMarketplace": {
      "plugin": "hello",
      "marketplace": "mp",
      "keptOverride": {
        "disabled": true,
        "env": {
          "STUB_TOKEN": "stub-secret"
        },
        "bearerToken": "!echo stub",
        "headers": {
          "Authorization": "Bearer stub"
        }
      }
    }
  },
  "effectiveEntry": {
    "command": "node",
    "args": [
      "server.js"
    ],
    "env": {
      "CLAUDE_PLUGIN_ROOT": "/var/tmp/mcp4-p2-10-adapter-proof/home/work/project/plugin-root",
      "CLAUDE_PLUGIN_DATA": "/var/tmp/mcp4-p2-10-adapter-proof/home/work/project/plugin-data",
      "CLAUDE_PROJECT_DIR": "/var/tmp/mcp4-p2-10-adapter-proof/home/work/project"
    },
    "disabled": true,
    "_piClaudeMarketplace": {
      "plugin": "hello",
      "marketplace": "mp",
      "keptOverride": {
        "disabled": true,
        "env": {
          "STUB_TOKEN": "stub-secret"
        },
        "bearerToken": "!echo stub",
        "headers": {
          "Authorization": "Bearer stub"
        }
      }
    }
  },
  "checkA": {
    "command": true,
    "args": true,
    "envWithoutStubToken": true,
    "noBearerToken": true,
    "noHeaders": true,
    "disabledCarried": true,
    "markerDeepEqualsFile": true
  },
  "consoleCalls": [],
  "enable": {
    "path": "/var/tmp/mcp4-p2-10-adapter-proof/home/work/project/.pi/mcp-adapter.json",
    "changed": true
  },
  "afterEnable": {
    "command": "node",
    "args": [
      "server.js"
    ],
    "env": {
      "CLAUDE_PLUGIN_ROOT": "/var/tmp/mcp4-p2-10-adapter-proof/home/work/project/plugin-root",
      "CLAUDE_PLUGIN_DATA": "/var/tmp/mcp4-p2-10-adapter-proof/home/work/project/plugin-data",
      "CLAUDE_PROJECT_DIR": "/var/tmp/mcp4-p2-10-adapter-proof/home/work/project"
    },
    "_piClaudeMarketplace": {
      "plugin": "hello",
      "marketplace": "mp",
      "keptOverride": {
        "disabled": true,
        "env": {
          "STUB_TOKEN": "stub-secret"
        },
        "bearerToken": "!echo stub",
        "headers": {
          "Authorization": "Bearer stub"
        }
      }
    }
  },
  "disable": {
    "path": "/var/tmp/mcp4-p2-10-adapter-proof/home/work/project/.pi/mcp-adapter.json",
    "changed": true
  },
  "afterDisable": {
    "command": "node",
    "args": [
      "server.js"
    ],
    "env": {
      "CLAUDE_PLUGIN_ROOT": "/var/tmp/mcp4-p2-10-adapter-proof/home/work/project/plugin-root",
      "CLAUDE_PLUGIN_DATA": "/var/tmp/mcp4-p2-10-adapter-proof/home/work/project/plugin-data",
      "CLAUDE_PROJECT_DIR": "/var/tmp/mcp4-p2-10-adapter-proof/home/work/project"
    },
    "_piClaudeMarketplace": {
      "plugin": "hello",
      "marketplace": "mp",
      "keptOverride": {
        "disabled": true,
        "env": {
          "STUB_TOKEN": "stub-secret"
        },
        "bearerToken": "!echo stub",
        "headers": {
          "Authorization": "Bearer stub"
        }
      }
    },
    "disabled": true
  },
  "unstageRemovedNames": [
    "srv"
  ],
  "restored": {
    "mcpServers": {
      "srv": {
        "disabled": true,
        "env": {
          "STUB_TOKEN": "stub-secret"
        },
        "bearerToken": "!echo stub",
        "headers": {
          "Authorization": "Bearer stub"
        }
      }
    }
  },
  "verdicts": {
    "a": true,
    "b": true,
    "c": true,
    "e": true
  }
}
APPROVAL_HASH_COVERS_MARKER=true
ADAPTER_PROOF=ok
PROOF_EXIT=0
```

## Re-pinned Contract Entries

Only the line numbers moved, because stage.ts grew by 10 lines above both tokens. The columns did not change, and the line-61 pin did not move.

| Entry | Before | After |
|---|---|---|
| `replacement.kind` id / filter | `stage.ts:307:48` / `stage.ts:307:22` | `stage.ts:317:48` / `stage.ts:317:22` |
| `requireMcpReplacementInternals.replacement.kind` id / filter | `stage.ts:352:42` / `stage.ts:352:16` | `stage.ts:362:42` / `stage.ts:362:16` |

`npm run lint:type-members` after the re-pin: "Unused type member gate passed with 4 recorded exception(s)." No new member was reported unread: `keptOverride` is read through `keptOverrideOf`, and `keptOverrides` is read in stage.ts and adapter-entry.ts.

## Measured Complexity

| Function | fallow cyclomatic | fallow cognitive | ESLint sonarjs cognitive |
|---|---|---|---|
| `prepareStageMcpServers` | 7 | 6 | 5 |
| `partitionServers` | 5 | 7 | 6 |
| `keptServers` | 3 | 3 | 3 |
| `survivingEntry` (new helper) | 5 | 5 | 5 |
| `keptOverridesOf` (new helper) | 4 | 5 | - |
| `withPluginServers` | 8 | 9 | 8 |

All values are under the ceilings (cognitive 15, cyclomatic 20). `npx fallow health` exited 0, so it reported no unit-size finding.

## Verification Evidence

- Task 1 verify: `npm run typecheck` exited 0. The six-file `node --test` run gave pass 171, fail 0. The integration file gave pass 1.
- Task 2 verify: the five owner files pass. `npm run test:coverage:direct` printed "Direct coverage passed" for `marker.ts` (32/32 branches, 5/5 functions, 99/99 lines), `adapter-entry.ts` (24/24, 5/5, 143/143), `adapter-doc.ts` (82/82, 19/19, 355/355), `stage.ts` (66/66, 17/17, 382/382) and `unstage.ts` (30/30, 11/11, 179/179). The proof log ends `ADAPTER_PROOF=ok` then `PROOF_EXIT=0`.
- `{ rg -n 'D-02-(19|20|21)' extensions tests; test $? -eq 1; }` exits 0 on the committed tree.
- Pre-commit, run 1 (`tmp/p2-10-precommit-run1.log`): mdformat re-padded the PRD MC-5 table row (as the plan expected), so the run ended `PRECOMMIT_EXIT=1`. Every other hook passed, including `npm changed checks`.
- Pre-commit, run 2 (`tmp/p2-10-precommit.log`), the same 13 files, `SKIP=trufflehog`, `TMPDIR=/var/tmp/mcp4-p2-10`: **`PRECOMMIT_EXIT=0`**. `npm changed checks` is `always_run`. The contracts-JSON change selected the full scope (`npm run check` plus all-pair direct coverage), about 30 minutes each run. Node v26.10.0.
- `npx fallow audit --format json --quiet --explain --gate-marker agent`: verdict **`warn`** (dead code 0, complexity findings 0, 14 clone groups across the branch's diff against origin/main). The verdict is not `fail`.
- focused task verification passed; full phase/PR verification pending

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Integration ctx stub type**
- **Found during:** Task 1
- **Issue:** `{ ui: { notify: (): void => undefined } } as ExtensionContext` failed TS2352 (insufficient overlap).
- **Fix:** I gave `notify` the `(message, severity?)` parameters, as `transaction-lifecycle-cascade.test.ts` does.
- **Files modified:** tests/integration/mcp-override-lifecycle.test.ts
- **Commit:** 21fc8a88

**2. [Rule 3 - Blocking] Floor-tie phrase split across a string concatenation**
- **Found during:** Task 2 acceptance check
- **Issue:** Prettier wrapped the new assertion message, so the acceptance phrase spanned two string literals and `rg` matched nothing.
- **Fix:** I moved the line break so the whole phrase sits in one literal.
- **Files modified:** tests/bridges/mcp/adapter-entry.test.ts
- **Commit:** 21fc8a88

Other notes:
- The tracer integration case uses one act phase (install, then uninstall) followed by one assert phase. This follows the unit-testing skill's phase markers. The plan text described act 1, assert, act 2, assert. The assertions are the ones the plan names.
- In the partition test, `partition.keptOverrides` is asserted as a whole value. The other three partition fields are already pinned by the existing whole-partition cases.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

The mitigations in the threat register are implemented and tested:
- T-02-25: whole-entry compares for an override holding all ten credential-bearing fields, plus the integration count of `stub-secret`.
- T-02-26: `restorableOverride` rejects a full definition, a nested marker and an array, with an owner test for each shape.
- T-02-27: the adapter proof and the floor-tie re-proof message.
- T-02-28: the single write-back table, with owner tests for restage, a dropped server and the key move.
- T-02-SC: the sha1 was checked before unpacking, with no registry install.

## Self-Check: PASSED

- Files: `tests/integration/mcp-override-lifecycle.test.ts` exists, and all 13 `files_modified` paths are in `git show --name-only HEAD`.
- Commit: `21fc8a88` is in `git log`.
