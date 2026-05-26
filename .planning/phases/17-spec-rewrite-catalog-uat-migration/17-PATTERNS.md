# Phase 17: Spec Rewrite & Catalog UAT Migration - Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 6 (3 full rewrites, 1 delete, 2 small edits)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File                                  | Role            | Data Flow                  | Closest Analog                                                                        | Match Quality        |
| -------------------------------------------------- | --------------- | -------------------------- | ------------------------------------------------------------------------------------- | -------------------- |
| `docs/messaging-style-guide.md` (v2.0 rewrite)     | documentation   | spec-pointer (read-only)   | `docs/adr/v2-001-structured-notify.md` (thin ADR with type-model section + cross-refs) | role-match (thin doc) |
| `docs/output-catalog.md` (v2.0 rewrite)            | documentation   | spec-fixture (read by UAT) | `docs/output-catalog.md` v1.0 itself (preserve H2 structure + `<!-- catalog-state: STATE -->` marker convention; rewrite expected blocks) | exact (same file)    |
| `tests/architecture/catalog-uat.test.ts` (rewrite) | test            | byte-equality (parser + render + assert) | `tests/architecture/catalog-uat.test.ts` v1 (parser preserved verbatim) + `tests/shared/notify-v2.test.ts` (mock-ctx / mock-pi + notify() invocation pattern) | exact (V1 parser carry-forward) + exact (Phase 16 mock pattern) |
| `tests/architecture/grammar-frontmatter.test.ts` (DELETE) | test            | n/a                        | n/a (deletion only -- `git rm`)                                                       | trivial              |
| `.planning/REQUIREMENTS.md` (traceability edit)    | planning artefact | row edit                   | the table itself (other completed-phase rows: Phase 15/16 entries)                    | exact (same table)   |
| `docs/adr/v2-001-structured-notify.md` (one-line cross-ref edit) | documentation | one-line append            | `docs/adr/v2-001-structured-notify.md` Accepted-status block (Phase 15 reference at line 191) | exact (same file)    |

## Pattern Assignments

### `docs/messaging-style-guide.md` v2.0 (documentation, spec-pointer)

**Analog:** `docs/adr/v2-001-structured-notify.md` (thin doc with type-model section + cross-references) + `extensions/pi-claude-marketplace/shared/notify.ts` (the binding contract the style guide points at)

**No existing project file demonstrates the exact "thin pointer style guide" form** -- v2.0 is a new shape. The closest analog for tone, length, and pointer-at-source-code discipline is the ADR itself (`docs/adr/v2-001-structured-notify.md`, 197 lines, sectioned by Status / Context / Decision / Public surface / Consequences / Alternatives / Migration) -- copy the section-heading rhythm and the "code blocks for type signatures, prose for rationale" tonal balance.

**ADR public-surface excerpt** (`docs/adr/v2-001-structured-notify.md` lines 23-44) -- pattern for v2.0 §"Type Model Reference" type-signature block (option per Claude's Discretion to embed a small TS snippet vs strictly pointer):

```ts
export function notify(ctx: ExtensionContext, pi: ExtensionAPI, message: NotificationMessage): void;
export function notifyUsageError(ctx: ExtensionContext, message: UsageErrorMessage): void;

// Public types (shipped by Phase 15):
export type NotificationMessage;            // { marketplaces: readonly MarketplaceNotificationMessage[] }
export type MarketplaceNotificationMessage; // { name; scope; status?; details?; plugins }
export type PluginNotificationMessage;      // 10-variant discriminated union on `status`
export type PluginStatus;                   // 10 literal strings, derived from PLUGIN_STATUSES tuple
export type MarketplaceStatus;              // 4 literal strings, derived from MARKETPLACE_STATUSES tuple
export type Dependency;                     // "agents" | "mcp", derived from DEPENDENCIES tuple
export interface MarketplaceDetails;        // { autoupdate: boolean; lastUpdatedAt?: string }
export interface UsageErrorMessage;         // { message: string; usage: string }

// Runtime tuples shipped alongside the derived literal-union types (D-15-11):
export const PLUGIN_STATUSES;       // 10 entries
export const MARKETPLACE_STATUSES;  // 4 entries
export const DEPENDENCIES;          // 2 entries
```

**Closed-set source-of-truth** (`extensions/pi-claude-marketplace/shared/notify.ts` lines 181-211) -- the binding closed sets the v2.0 style guide §"Type Model Reference" points at (NEVER duplicated in prose per D-17-01):

```ts
// Line 181-192:
export const PLUGIN_STATUSES = [
  "installed",
  "updated",
  "reinstalled",
  "uninstalled",
  "available",
  "unavailable",
  "upgradable",
  "failed",
  "skipped",
  "manual recovery",
] as const;

// Line 202:
export const MARKETPLACE_STATUSES = ["added", "removed", "updated", "failed"] as const;

// Line 211:
export const DEPENDENCIES = ["agents", "mcp"] as const;

// Lines 218, 224, 230 -- derived literal-union types:
export type PluginStatus = (typeof PLUGIN_STATUSES)[number];
export type MarketplaceStatus = (typeof MARKETPLACE_STATUSES)[number];
export type Dependency = (typeof DEPENDENCIES)[number];
```

**ES-5 Supersession Table (preserve verbatim per D-17-08)** -- from current `docs/messaging-style-guide.md` lines 525-537 (§15). The table is reproduced VERBATIM in v2.0 with a single added one-line annotation:

```markdown
## 15. ES-5 Replacement Table (PRD section 6.12 ES-5 supersession; MSG-04)

This section formally supersedes PRD section 6.12 ES-5 ("stable user-contract strings"). [...full prose paragraph from line 527...]

| ES-5 marker                              | Replacement                                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `pi-subagents is not loaded; …`          | `{requires pi-subagents}` reason on the affected line (see section 6, MSG-SD-1)                               |
| `pi-mcp-adapter is not loaded; …`        | `{requires pi-mcp}` reason on the affected line (see section 6, MSG-SD-1)                                     |
| `Run /reload to <verb> …`                | `/reload to pick up changes` (single canonical trailer, blank line above) (see section 5, MSG-RH-1)           |
| `MANUAL RECOVERY REQUIRED: …`            | `⊘ <resource> (manual recovery) {<reason>}` as a separate top-level line (see section 7, MSG-MR-1 / MSG-MR-2) |
| `(rollback partial: [<phase>] <msg>; …)` | `{rollback partial}` reason on the failed line + per-phase indented children (see section 8, MSG-RP-1)        |

[ADD THIS LINE per D-17-08:]
> Note: The 5 ES-5 legacy markers remain blocked by `tests/architecture/no-legacy-markers.test.ts` and are fully retired alongside V1 wrapper deletion in Phase 21.
```

**ADR Migration block** (`docs/adr/v2-001-structured-notify.md` lines 187-197) -- pattern for v2.0 style guide §"Cross-References" (link out, do not duplicate content):

```markdown
- **Phase 15** (this ADR): land the type model in `shared/notify.ts` [...].
- **Phase 16:** introduce `notify(ctx, NotificationMessage)` [...].
- **Phase 17:** rewrite `docs/messaging-style-guide.md` to v2.0 (SNM-19) [...].
```

**Sections to delete from v1.0 (per D-17-07):**
- YAML frontmatter (lines 1-65): all 4 keys -- `status_tokens`, `reasons`, `markers`, `pattern_classes` -- replaced by const tuples in `shared/notify.ts` per D-17-01.
- §16 Pattern Class Reference (line 543 onward, ~260 lines) -- patterns are now the discriminated-union switches in `shared/notify.ts::renderPluginRow` / `renderMpHeader`.
- §17 Worked Examples Gallery (~100 lines) -- merged into `docs/output-catalog.md` per-command sections.
- §3 Status Tokens, §4 Reasons Enum -- standalone enumeration sections deleted; replaced by one sentence pointing at the const tuples + `tests/architecture/notify-types.test.ts` compile-check.

---

### `docs/output-catalog.md` v2.0 (documentation, spec-fixture)

**Analog:** `docs/output-catalog.md` v1.0 itself -- preserve the structural skeleton (H2 inventory, marker convention, fenced-block convention) and rewrite EVERY per-command section's expected output.

**Per-command H2 + `<!-- catalog-state: STATE -->` marker convention** (verbatim from `docs/output-catalog.md` lines 162-189) -- this is the binding shape the catalog UAT parser walks:

````markdown
## `/claude:plugin list`

Multi-plugin command. Each marketplace renders as a header at column 0; plugins indent 2 spaces beneath.

### Empty

<!-- catalog-state: empty -->

```text
(no plugins)
```

### Single marketplace, mixed plugin statuses (user scope)

<!-- catalog-state: single-mp-mixed -->

```text
● official [user] <autoupdate>
  ● alpha [user] v1.0.0 (installed)
    Short description of alpha.
  ● beta [user] v0.5.0 → v1.0.0 (upgradable)
    [...truncated -- see v1 lines 174-189...]
```
````

**Marker rules** (parser at `tests/architecture/catalog-uat.test.ts` lines 100-101):
- Section regex: `/^## (` `` ``/claude:plugin [^`]+`` ``|Manual recovery anchors)\s*$/` -- matches backtick-wrapped command tokens OR the plain `## Manual recovery anchors` heading.
- State marker regex: `/^<!-- catalog-state: ([a-z0-9-]+) -->\s*$/` -- lowercase + digits + hyphens only.
- The state marker is paired with the NEXT fenced block (triple-backtick fence optionally followed by a language tag).

**Single-plugin command v2 shape** (the headline rewrite per D-17 goal):
- V1 form (current line 286-292, `install` Success state):

  ```text
  ● helper@official [user] v1.0.0 (installed)

  /reload to pick up changes
  ```

- V2 form (always-marketplace-header per D-16-04):

  ```text
  ● official [user]
    ● helper v1.0.0 (installed)

  /reload to pick up changes
  ```

  Plugin row OMITS `[user]` because `plugin.scope == marketplace.scope` (per Phase 16 D-16-17 conditional scope-bracket).

**Orphan-fold v2 form** (Phase 16 D-16-17; catalog must include at least one example):

```text
● official [user]
  ● helper [project] v1.0.0 (installed)
```

  Plugin row CARRIES `[project]` because `plugin.scope ("project") !== marketplace.scope ("user")`.

**Existing orphan-fold catalog state to model on** (`docs/output-catalog.md` lines 211-221, `project-orphan-folded` state under `/claude:plugin list`):

```text
● official [user] <autoupdate>
  ● alpha [project] v0.9.0 (installed)
  ● alpha [user] v1.0.0 (installed)
```

The v2 grammar simplifies this: drop `<autoupdate>` marker for non-list surfaces; emit just the plugin row's scope bracket when it diverges from the header.

**V2 per-command expected output bytes -- authoritative source** (`tests/shared/notify-v2.test.ts`):
- Phase 16 per-variant unit tests at lines 189-1141 contain 32 expected-output strings keyed by `(plugin status × marketplace status × edge case)`.
- Examples lifted verbatim from there into the v2 catalog (D-16-18 SEED):
  - Test 1 (line 189-214): installed plugin, empty deps, mp.status="added":

    ```text
    ● demo [user] (added)
      ● commit-commands v1.0.0 (installed)

    /reload to pick up changes
    ```

  - Test "unavailable" (line 353-377): mp.status undefined; row omits scope bracket per MSG-PL-6:

    ```text
    ● demo [user]
      ⊘ commit-commands (unavailable) {hooks}
    ```

  - Test "skipped + warning" (line 407-435): mp.status="added"; reload-hint fires; severity = warning:

    ```text
    ● demo [user] (added)
      ⊘ commit-commands v1.0.0 (skipped) {up-to-date}

    /reload to pick up changes
    ```

**V2 catalog DROPS per D-17-09 + D-17-10** (V1-only states with no v2 grammar representation):
- `Claude plugin import summary` preamble (top-level free text -- not expressible in `NotificationMessage`).
- `Fix the underlying issue and retry.` retry anchor (top-level free text under `marketplace remove partial`).
- `source-mismatch` diagnostic line (V1 free-text augmentation).
- `install-failure-with-anchor` state (system-level `(manual recovery)` resource paired with failed install row; `PluginManualRecoveryMessage` has no `orphanDetails` field equivalent).

**Sections to keep, prune, or rewrite:**

| v1.0 §                                                             | v2.0 treatment                                                                                       |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Conventions (lines 5-129)                                          | Rewrite: drop "single-plugin commands skip header" carve-out; v2 grammar = always-marketplace-header |
| Severity routing (lines 130-141)                                   | Rewrite as 3-row table (first-match: failed → error; skipped/manual recovery → warning; else info)   |
| Status token reference (lines 142-159)                             | Keep as 10-row table mirroring `PLUGIN_STATUSES`                                                     |
| 14 per-command H2 sections (lines 162-end)                         | Rewrite EVERY expected output block to v2 always-marketplace-header form                              |
| Manual recovery anchors (existing section)                         | Keep section; drop `install-failure-with-anchor` state per D-17-10                                   |
| Empty / no-op surfaces                                             | Keep section; ensure `(no marketplaces)` (D-15-09) + bare-header-alone (D-15-08) examples present     |
| Usage errors                                                       | Keep section; v2 `notifyUsageError(ctx, UsageErrorMessage)` shape                                    |
| `Resolutions to apply to docs/messaging-style-guide.md` (lines 925-967) | Delete (was authoring-time scratchpad in v1.0; v2.0 doesn't need it)                                |

---

### `tests/architecture/catalog-uat.test.ts` (test, byte-equality)

**Analog 1 (parser carry-forward):** Same file's v1 -- lines 1-150 (header + `loadCatalogExamples` function) survive verbatim per D-17-05 / D-17-06.

**Analog 2 (renderer-call site swap):** `tests/shared/notify-v2.test.ts` lines 120-179 -- mock-ctx + mock-pi pattern + `notify(ctx as never, pi as never, msg)` invocation shape.

**Imports pattern (replace V1 composer imports with `notify()` + types):**

V1 imports to DROP (`tests/architecture/catalog-uat.test.ts` lines 44-63):

```typescript
import { pathSource } from "../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  appendReloadHint,
  cascadeSummary,
  renderManualRecovery,
  renderMarketplaceList,
  renderRow,
} from "../../extensions/pi-claude-marketplace/presentation/index.ts";
import { renderPluginList } from "../../extensions/pi-claude-marketplace/presentation/plugin-list.ts";

import type {
  EntityErrorRow,
  ManualRecoveryLine,
  MarketplaceRow,
  PluginCascadeRow,
  PluginInlineRow,
  PluginInlineUninstalledRow,
  SoftDepProbe,
} from "../../extensions/pi-claude-marketplace/presentation/index.ts";
import type { PluginListMarketplaceBlock } from "../../extensions/pi-claude-marketplace/presentation/plugin-list.ts";
```

V2 imports to ADD:

```typescript
import test, { mock } from "node:test";

import {
  notify,
  type NotificationMessage,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";
```

**Parser pattern preserved verbatim** (`tests/architecture/catalog-uat.test.ts` lines 65-150) -- D-17-05 / D-17-06:

```typescript
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG_PATH = path.join(REPO_ROOT, "docs/output-catalog.md");

interface CatalogExample {
  readonly section: string;
  readonly state: string;
  readonly expected: string;
}

function loadCatalogExamples(catalog: string): readonly CatalogExample[] {
  const lines = catalog.split("\n");
  const examples: CatalogExample[] = [];
  let currentSection: string | null = null;
  let pendingState: string | null = null;
  let inFence = false;
  let fenceBody: string[] = [];

  const sectionRe = /^## (`(\/claude:plugin [^`]+)`|Manual recovery anchors)\s*$/;
  const stateRe = /^<!-- catalog-state: ([a-z0-9-]+) -->\s*$/;

  for (const line of lines) {
    if (inFence) {
      if (line.startsWith("```")) {
        if (pendingState !== null && currentSection !== null) {
          examples.push({
            section: currentSection,
            state: pendingState,
            expected: fenceBody.join("\n"),
          });
        }
        pendingState = null;
        fenceBody = [];
        inFence = false;
        continue;
      }
      fenceBody.push(line);
      continue;
    }

    const sectionMatch = sectionRe.exec(line);
    if (sectionMatch !== null) {
      currentSection = sectionMatch[2] ?? "manual-recovery-anchors";
      pendingState = null;
      continue;
    }

    if (line.startsWith("## ")) {
      currentSection = null;
      pendingState = null;
      continue;
    }

    const stateMatch = stateRe.exec(line);
    if (stateMatch !== null) {
      pendingState = stateMatch[1] ?? null;
      continue;
    }

    if (line.startsWith("```")) {
      inFence = true;
      fenceBody = [];
    }
  }

  return examples;
}
```

**Mock-ctx + mock-pi pattern** (`tests/shared/notify-v2.test.ts` lines 130-179) -- D-17-05 lift verbatim:

```typescript
interface MockCtx {
  ui: { notify: ReturnType<typeof mock.fn> };
}

function makeCtx(): MockCtx {
  return { ui: { notify: mock.fn() } };
}

interface MockTool {
  name?: string;
  sourceInfo?: { source?: string };
}

interface MockPi {
  getAllTools: () => MockTool[];
}

/** Probe reports both pi-subagents and pi-mcp-adapter loaded. */
function piWithBothLoaded(): MockPi {
  return { getAllTools: () => [{ name: "subagent" }, { name: "mcp" }] };
}

/** Probe reports pi-subagents loaded, pi-mcp-adapter NOT loaded. */
function piWithSubagentsLoaded(): MockPi {
  return { getAllTools: () => [{ name: "subagent" }] };
}

/** Probe reports pi-mcp-adapter loaded, pi-subagents NOT loaded. */
function piWithMcpLoaded(): MockPi {
  return { getAllTools: () => [{ name: "mcp" }] };
}

/** Probe reports nothing loaded -- both soft-dep markers fire when declared. */
function piWithNothingLoaded(): MockPi {
  return { getAllTools: () => [] };
}
```

**Fixture map shape (REPLACES V1 `FixtureFactory` map)** -- D-17-05 + Pitfall 6 (severity arg assertion):

```typescript
interface CatalogFixture {
  readonly message: NotificationMessage;
  readonly pi: MockPi;
  readonly expectedSeverity?: "warning" | "error";
}

type FixtureMap = Readonly<Record<string, Readonly<Record<string, CatalogFixture>>>>;

const FIXTURES: FixtureMap = {
  "/claude:plugin install <plugin>@<marketplace>": {
    success: {
      pi: piWithNothingLoaded(),
      message: {
        marketplaces: [
          {
            name: "official",
            scope: "user",
            plugins: [
              {
                status: "installed",
                name: "helper",
                version: "1.0.0",
                dependencies: [],
              },
            ],
          },
        ],
      },
    },
    // ... rest of states
  },
  // ... rest of sections
};
```

**V2 driver loop** (RESEARCH.md §Code Examples lines 1031-1077 -- ADAPT v1 driver loop at `tests/architecture/catalog-uat.test.ts` lines 1878-1948):

```typescript
test("catalog UAT: every <!-- catalog-state: --> annotation pairs byte-equal with notify()", async () => {
  const catalog = await readFile(CATALOG_PATH, "utf8");
  const examples = loadCatalogExamples(catalog);

  assert.ok(
    examples.length >= 30,
    `Expected at least 30 annotated catalog examples; found ${examples.length}.`,
  );

  interface Failure {
    readonly section: string;
    readonly state: string;
    readonly kind: "missing-fixture" | "byte-mismatch" | "severity-mismatch";
    readonly expected?: string;
    readonly actual?: string;
  }

  const failures: Failure[] = [];

  for (const example of examples) {
    const fixture = FIXTURES[example.section]?.[example.state];
    if (fixture === undefined) {
      failures.push({ section: example.section, state: example.state, kind: "missing-fixture" });
      continue;
    }

    const ctx = makeCtx();
    notify(ctx as never, fixture.pi as never, fixture.message);
    assert.equal(ctx.ui.notify.mock.calls.length, 1);

    const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
    const actual = callArgs[0];

    if (actual !== example.expected) {
      failures.push({
        section: example.section,
        state: example.state,
        kind: "byte-mismatch",
        expected: example.expected,
        actual,
      });
    }

    if (fixture.expectedSeverity !== undefined) {
      if (callArgs[1] !== fixture.expectedSeverity) {
        failures.push({
          section: example.section,
          state: example.state,
          kind: "severity-mismatch",
          expected: fixture.expectedSeverity,
          actual: callArgs[1] ?? "(info)",
        });
      }
    } else {
      if (callArgs.length !== 1) {
        failures.push({
          section: example.section,
          state: example.state,
          kind: "severity-mismatch",
          expected: "(info / no 2nd arg)",
          actual: callArgs[1] ?? "?",
        });
      }
    }
  }

  if (failures.length > 0) {
    // Same [BYTE MISMATCH] / [MISSING FIXTURE] / [SEVERITY MISMATCH] formatting as v1.
    // See tests/architecture/catalog-uat.test.ts:1930-1947 for the v1 formatter.
    assert.fail(`catalog UAT failures (${failures.length}):\n${formatFailures(failures)}`);
  }
});

// Carry-forward parser self-tests (v1 lines 1951-1981) UNCHANGED.
```

**Severity-arg assertion pattern (Pitfall 6 mitigation)** -- mirrors `tests/shared/notify-v2.test.ts` per-test asserts:

```typescript
// info severity: omit 2nd arg, arguments.length === 1
assert.equal(ctx.ui.notify.mock.calls[0]!.arguments.length, 1);
// warning: arguments = [body, "warning"], length === 2
assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [body, "warning"]);
// error: arguments = [body, "error"], length === 2
assert.deepEqual(ctx.ui.notify.mock.calls[0]!.arguments, [body, "error"]);
```

**Discriminated-union shapes referenced by fixtures** (`extensions/pi-claude-marketplace/shared/notify.ts` lines 438-487):

```typescript
// Plugin variant union (line 438):
export type PluginNotificationMessage =
  | PluginInstalledMessage      // status: "installed";     deps required
  | PluginUpdatedMessage         // status: "updated";       deps required; from/to required
  | PluginReinstalledMessage     // status: "reinstalled";   deps required
  | PluginUninstalledMessage     // status: "uninstalled"
  | PluginAvailableMessage       // status: "available";     NO scope (SNM-11)
  | PluginUnavailableMessage     // status: "unavailable";   reasons required; NO scope (SNM-11)
  | PluginUpgradableMessage      // status: "upgradable";    reasons required
  | PluginFailedMessage          // status: "failed";        reasons required; cause?; rollbackPartial?
  | PluginSkippedMessage         // status: "skipped";       reasons required
  | PluginManualRecoveryMessage; // status: "manual recovery"; reasons required; cause?

// Marketplace block (line 464):
export interface MarketplaceNotificationMessage {
  readonly name: string;
  readonly scope: Scope;
  readonly status?: MarketplaceStatus;   // "added" | "removed" | "updated" | "failed"
  readonly details?: MarketplaceDetails; // { autoupdate; lastUpdatedAt? }
  readonly plugins: readonly PluginNotificationMessage[];
}

// Top-level (line 485):
export interface NotificationMessage {
  readonly marketplaces: readonly MarketplaceNotificationMessage[];
}
```

**`notify()` public signature** (`extensions/pi-claude-marketplace/shared/notify.ts` lines 1034-1064):

```typescript
export function notify(
  ctx: ExtensionContext,
  pi: ExtensionAPI,
  message: NotificationMessage,
): void {
  const probe = softDepStatus(pi);

  const blocks = message.marketplaces.map((mp) => composeMarketplaceBlock(mp, probe));
  const body = blocks.length === 0 ? "(no marketplaces)" : blocks.join("\n\n");

  const hint = shouldEmitReloadHint(message) ? RELOAD_HINT_TRAILER : "";
  const withHint = hint === "" ? body : `${body}\n\n${hint}`;

  const severity = computeSeverity(message);
  if (severity === undefined) {
    ctx.ui.notify(withHint);
  } else {
    ctx.ui.notify(withHint, severity);
  }
}
```

---

### `tests/architecture/grammar-frontmatter.test.ts` (test, DELETE)

**Analog:** none needed -- this is `git rm tests/architecture/grammar-frontmatter.test.ts` per D-17-02.

**Pre-deletion verification** -- the 91-line test imports from `tests/lint-rules/lib/frontmatter.js` (loader) and the four `shared/grammar/*.ts` const arrays. After deletion:
- The loader file (`tests/lint-rules/lib/frontmatter.js`) survives until Phase 21 SNM-24 deletes the entire `tests/lint-rules/` directory (verified by RESEARCH.md Assumption A5).
- The loader's module-load-time `parseStyleGuideFrontmatter` call against `docs/messaging-style-guide.md` would THROW after Plan A removes the YAML frontmatter -- this is the coupling between Plan A and Plan D (RESEARCH.md Risk 1). Land both in same commit OR run Plan D first.

**Verification** that no other test imports the loader's frontmatter exports (RESEARCH.md Assumption A5): a project-wide search for the loader's frontmatter export names (`MARKERS_FRONTMATTER`, `REASONS_FRONTMATTER`, `STATUS_TOKENS_FRONTMATTER`, `PATTERN_CLASSES_FRONTMATTER`, `parseStyleGuideFrontmatter`) returns only `tests/architecture/grammar-frontmatter.test.ts` (the file being deleted) and `tests/lint-rules/lib/frontmatter.js` (the loader itself, which Phase 21 retires).

---

### `.planning/REQUIREMENTS.md` (traceability edit)

**Analog:** the table itself -- other completed-phase rows (Phase 15 / Phase 16 entries) demonstrate the row shape.

**Existing row pattern** (`.planning/REQUIREMENTS.md` lines 78-109):

```markdown
| Requirement | Phase | Status |
| ----------- | ----- | ------ |
| SNM-01 | Phase 15 | Complete |
| SNM-02 | Phase 15 | Complete |
[... SNM-12..18, 30 are "Phase 16 | Complete" ...]
| SNM-19 | Phase 17 | Pending |
| SNM-20 | Phase 17 | Pending |
[...]
| SNM-26 | Phase 21 | Pending |  ← EDIT THIS ROW
[...]
| SNM-31 | Phase 17 | Pending |
```

**Edit per D-17-02:**

```markdown
| SNM-26 | Phase 17 | Pending |
```

(Phase 21 → Phase 17; keep status `Pending` until phase completion -- the row flips to `Complete` alongside SNM-19, SNM-20, SNM-31 when this phase lands.)

**Per-phase distribution line edit** (line 116):

V1.0 line:
```markdown
- Per-phase distribution: Phase 15 (12: SNM-01..11, SNM-21); Phase 16 (8: SNM-12..18, SNM-30); Phase 17 (3: SNM-19, SNM-20, SNM-31); Phase 18 (0: execution phase); Phase 19 (0: execution phase); Phase 20 (1: SNM-23); Phase 21 (8: SNM-22, SNM-24, SNM-25, SNM-26, SNM-27, SNM-28, SNM-29, SNM-32)
```

Edit to (Phase 17: 3 → 4, +SNM-26; Phase 21: 8 → 7, -SNM-26):
```markdown
- Per-phase distribution: Phase 15 (12: SNM-01..11, SNM-21); Phase 16 (8: SNM-12..18, SNM-30); Phase 17 (4: SNM-19, SNM-20, SNM-26, SNM-31); Phase 18 (0: execution phase); Phase 19 (0: execution phase); Phase 20 (1: SNM-23); Phase 21 (7: SNM-22, SNM-24, SNM-25, SNM-27, SNM-28, SNM-29, SNM-32)
```

**At phase completion** (after all plans land + `npm run check` GREEN), flip the status column for SNM-19, SNM-20, SNM-26, SNM-31:

```markdown
| SNM-19 | Phase 17 | Complete |
| SNM-20 | Phase 17 | Complete |
| SNM-26 | Phase 17 | Complete |
| SNM-31 | Phase 17 | Complete |
```

---

### `docs/adr/v2-001-structured-notify.md` (one-line cross-ref edit)

**Analog:** the existing Accepted-status header block at `docs/adr/v2-001-structured-notify.md` lines 1-5, and the Phase 15 cross-ref already inside it.

**Existing block** (lines 1-5):

```markdown
# ADR-v2-001: Structured `notify` payload with typed wrappers

- **Status:** Accepted (Phase 15, 2026-05-25)
- **Date:** 2026-05-25
- **Supersedes:** D-CMC-11 (no structured-payload arg)
```

**Edit per Phase 17 success criterion #5** -- one-line append inside the Accepted-status block (planner picks exact phrasing):

```markdown
# ADR-v2-001: Structured `notify` payload with typed wrappers

- **Status:** Accepted (Phase 15, 2026-05-25); landed via Phase 17 -- spec + catalog UAT migration (2026-05-26)
- **Date:** 2026-05-25
- **Supersedes:** D-CMC-11 (no structured-payload arg)
```

OR (alternative phrasing -- a separate bullet):

```markdown
- **Status:** Accepted (Phase 15, 2026-05-25)
- **Landed via:** Phase 17 -- spec rewrite + catalog UAT migration (2026-05-26)
- **Date:** 2026-05-25
- **Supersedes:** D-CMC-11 (no structured-payload arg)
```

**No existing precedent** for a "Phase 16 landed via" or similar cross-reference inside this ADR -- the Migration block at lines 187-197 narratively walks every phase but the Accepted-status block has only the original Phase 15 reference. Phase 17 establishes the precedent.

---

## Shared Patterns

### Mock-ctx pattern (test composition)

**Source:** `tests/shared/notify-v2.test.ts` lines 136-142 (and identical to V1 wrapper test pattern at `tests/shared/notify.test.ts` lines 17-23 per RESEARCH.md).

**Apply to:** `tests/architecture/catalog-uat.test.ts` rewrite.

```typescript
interface MockCtx {
  ui: { notify: ReturnType<typeof mock.fn> };
}

function makeCtx(): MockCtx {
  return { ui: { notify: mock.fn() } };
}
```

No third-party mocking framework -- `node:test`'s `mock.fn()` is the established project pattern.

### Mock-pi pattern (soft-dep probe injection)

**Source:** `tests/shared/notify-v2.test.ts` lines 144-179.

**Apply to:** `tests/architecture/catalog-uat.test.ts` rewrite.

```typescript
interface MockTool {
  name?: string;
  sourceInfo?: { source?: string };
}

interface MockPi {
  getAllTools: () => MockTool[];
}

function piWithBothLoaded(): MockPi {
  return { getAllTools: () => [{ name: "subagent" }, { name: "mcp" }] };
}
// ... + 3 more factories: piWithSubagentsLoaded, piWithMcpLoaded, piWithNothingLoaded
```

Per fixture, pick the mock-pi factory that matches the catalog's intended soft-dep state.

### Byte-equality assertion shape

**Source:** `tests/architecture/catalog-uat.test.ts` v1 lines 1918-1927 (V1 form) + `tests/shared/notify-v2.test.ts` per-test asserts.

**Apply to:** Catalog UAT driver loop (test file rewrite).

```typescript
const callArgs = ctx.ui.notify.mock.calls[0]!.arguments as [string, string?];
const actual = callArgs[0];
if (actual !== example.expected) {
  failures.push({ /* [BYTE MISMATCH] */ });
}
```

The catalog text is the SOLE source of expected bytes (D-13-30 in V1; preserved in Phase 17 per D-17-05). The test never duplicates rendered examples in TS code.

### D-11 layering discipline

**Source:** `extensions/pi-claude-marketplace/shared/notify.ts` (the lowest layer; no upward imports).

**Apply to:** `tests/architecture/catalog-uat.test.ts` rewrite -- imports ONLY from `shared/notify.ts`. NO imports from `presentation/*` (V1 composers retire-via-exclusion per D-17-03).

```typescript
import {
  notify,
  type NotificationMessage,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";
```

### Closed-set authority hierarchy (style guide)

**Source:** `extensions/pi-claude-marketplace/shared/notify.ts` lines 181-211 (const tuples) + `tests/architecture/notify-types.test.ts` (compile-check).

**Apply to:** `docs/messaging-style-guide.md` v2.0 §"Type Model Reference".

Pattern: prose NEVER duplicates closed-set membership. Pointer-only:

> Closed-set authority lives in `extensions/pi-claude-marketplace/shared/notify.ts`:
> - `PLUGIN_STATUSES` (10 entries) + derived `PluginStatus` literal-union type.
> - `MARKETPLACE_STATUSES` (4 entries) + derived `MarketplaceStatus` literal-union type.
> - `DEPENDENCIES` (2 entries) + derived `Dependency` literal-union type.
> - `REASONS` (in `shared/grammar/reasons.ts`) + derived `Reason` type (still imported per Phase 15 D-15-03).
>
> Compile-time membership proof: `tests/architecture/notify-types.test.ts`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | n/a | n/a | All 6 Phase 17 files have strong analogs. The closest "no analog" case is the v2.0 style guide's overall shape -- there's no existing thin-pointer doc in this project -- but the ADR (`docs/adr/v2-001-structured-notify.md`) is a close-enough analog for the tonal balance and the structural rhythm of "code blocks for type signatures, prose for rationale, cross-references for navigation." |

## Metadata

**Analog search scope:**
- `docs/` (style guide v1.0, catalog v1.0, ADR, PRD directory listing)
- `tests/architecture/` (catalog-uat v1, grammar-frontmatter, notify-types referenced but not modified)
- `tests/shared/` (notify-v2 -- the Phase 16 binding mini-spec)
- `extensions/pi-claude-marketplace/shared/` (notify.ts public surface + const tuples)
- `.planning/` (REQUIREMENTS.md table rows)

**Files scanned:**
- `docs/messaging-style-guide.md` (954 lines; v1.0 frontmatter + §15 ES-5 table + §16 inventory)
- `docs/output-catalog.md` (971 lines; Conventions + 14 H2 command sections + Manual recovery + Empty + Usage errors)
- `docs/adr/v2-001-structured-notify.md` (197 lines; full)
- `tests/architecture/catalog-uat.test.ts` (1981 lines; parser lines 65-150 + driver lines 1878-1948 + final 30 lines of self-tests)
- `tests/shared/notify-v2.test.ts` (1141 lines; mini-spec header lines 1-118 + mock setup 120-179 + per-variant tests 189+)
- `tests/architecture/grammar-frontmatter.test.ts` (91 lines; full)
- `extensions/pi-claude-marketplace/shared/notify.ts` (1065 lines; types lines 181-487 + `notify()` lines 1034-1064)
- `.planning/REQUIREMENTS.md` (128 lines; full)

**Pattern extraction date:** 2026-05-26

## PATTERN MAPPING COMPLETE

**Phase:** 17 - Spec Rewrite & Catalog UAT Migration
**Files classified:** 6 (3 full rewrites, 1 delete, 2 small edits)
**Analogs found:** 6 / 6

### Coverage
- Files with exact analog: 5 (catalog v1 → v2 self-analog; catalog-uat v1 parser + notify-v2 mock pattern; REQUIREMENTS.md table; ADR Accepted-status block; grammar-frontmatter.test.ts trivial delete)
- Files with role-match analog: 1 (style guide v2.0 -- ADR is closest "thin doc" shape match in the project)
- Files with no analog: 0

### Key Patterns Identified
- **Catalog parser walks per-command H2 + `<!-- catalog-state: STATE -->` markers** -- preserved verbatim from `tests/architecture/catalog-uat.test.ts` lines 65-150 per D-17-05 / D-17-06; the section regex matches backtick-wrapped `/claude:plugin ...` commands OR `## Manual recovery anchors`.
- **Mock-ctx + mock-pi pattern via `node:test`'s `mock.fn()`** -- established by Phase 16 at `tests/shared/notify-v2.test.ts` lines 130-179; no third-party mocking framework; mock-pi shape is `{ getAllTools: () => MockTool[] }`.
- **`notify(ctx, pi, message)` is the SOLE renderer call** -- replaces V1's seven-composer fan-out (`renderRow` / `cascadeSummary` / `renderManualRecovery` / `renderRollbackPartial` / `renderPluginList` / `renderMarketplaceList` / `appendReloadHint`); D-11 layering forbids `presentation/*` imports per D-17-03.
- **Severity arg is structural** (`info` → omit 2nd arg; `warning`/`error` → 2nd arg present) -- the catalog text carries NO severity info, so fixture entries must carry `expectedSeverity?` field and the driver asserts via `mock.calls[0]!.arguments.length` + value.
- **Closed-set authority points at const tuples in `shared/notify.ts`** -- v2.0 style guide §"Type Model Reference" NEVER enumerates membership in prose per D-17-01; the const tuples `PLUGIN_STATUSES` / `MARKETPLACE_STATUSES` / `DEPENDENCIES` + `REASONS` in `shared/grammar/reasons.ts` are the binding contract.
- **ES-5 Supersession Table preserved verbatim** with a one-line "fully retired Phase 21" annotation per D-17-08; the table itself is at v1.0 lines 525-537.
- **REQUIREMENTS.md edit pattern**: traceability table row column edit (Phase 21 → Phase 17, Pending → Complete) + per-phase distribution line edit (Phase 17: 3 → 4 inc. SNM-26; Phase 21: 8 → 7 exc. SNM-26).
- **ADR cross-reference pattern**: one-line append inside the Accepted-status block at `docs/adr/v2-001-structured-notify.md` lines 1-5; no existing project precedent for "Landed via Phase X" sub-bullet -- Phase 17 establishes the pattern.

### File Created
`/home/acolomba/pi-claude-marketplace/.planning/phases/17-spec-rewrite-catalog-uat-migration/17-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns + concrete code excerpts in PLAN.md files.
