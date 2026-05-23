# Phase 13: Conformance Refactor & ES-5 Supersession - Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 9 NEW + 24 MODIFIED = 33 files in scope
**Analogs found:** 33 / 33 (every file has at least one strong precedent inside the codebase)

---

## File Classification

| File | New/Modified | Role | Data Flow | Closest Analog | Match Quality |
|------|--------------|------|-----------|----------------|---------------|
| `extensions/pi-claude-marketplace/presentation/compact-line.ts` | **NEW** | composer (presentation) | transform (RowSpec to string) | `presentation/plugin-list.ts` (icons + literal-union + renderer) | exact role + data flow |
| `extensions/pi-claude-marketplace/presentation/cascade-summary.ts` | **NEW** | composer (presentation) | transform (rows to `{message, severity}`) | `presentation/plugin-list.ts::renderPluginList` (payload-driven composer returning string) | role-match (no precedent for `{message, severity}` tuple return, but composer shape identical) |
| `extensions/pi-claude-marketplace/presentation/manual-recovery.ts` | **NEW** | composer (presentation) | transform (line spec to string) | `presentation/reload-hint.ts::appendReloadHint` (file-private literal + single-purpose composer) | exact |
| `extensions/pi-claude-marketplace/presentation/rollback-partial.ts` | **NEW** | composer (presentation) | transform (parent + children to multi-line string) | `presentation/plugin-list.ts::appendMarketplaceBlock` (header + indented children) | exact (parent+children indent shape) |
| `extensions/pi-claude-marketplace/presentation/cause-chain.ts` | **NEW** | composer (presentation) | transform (Error to string trailer) | `orchestrators/marketplace/shared.ts::formatErrorWithCauses` (lines 453-470 -- direct seed) | exact (relocated + reworded) |
| `extensions/pi-claude-marketplace/presentation/sort.ts` (or named export in `compact-line.ts`) | **NEW** | utility (presentation) | pure compare | No exact precedent; closest is the inline `[...].sort((a,b) => a.localeCompare(b))` at `orchestrators/marketplace/remove.ts:257` | role-match (codified into a single helper) |
| `tests/architecture/no-legacy-markers.test.ts` | **NEW** | test (static-audit) | scan-and-assert | `tests/architecture/manifest-read-seam.test.ts` (recursive readdir + per-file substring scan) + `tests/architecture/no-orchestrator-network.test.ts` (allow-list + offenders array pattern) | exact |
| `tests/architecture/catalog-uat.test.ts` | **NEW** | test (architectural / byte-equality) | read MD then extract fenced blocks then assert byte-equal | `tests/architecture/grammar-frontmatter.test.ts` (read MD frontmatter + assert set-equality) + `tests/architecture/markers-snapshot.test.ts::extractEs5MarkerLiterals` (regex-extract literal table from `.md`) | role-match (novel shape: fenced-block extraction instead of frontmatter list) |
| `tests/presentation/compact-line.test.ts` | **NEW** | test (presentation unit) | render-and-assert | `tests/presentation/plugin-list.test.ts` (payload-in then assert.equal/match string) | exact |
| `tests/presentation/cascade-summary.test.ts` | **NEW** | test (presentation unit) | render-and-assert (severity routing) | `tests/presentation/plugin-list.test.ts` | exact role; severity assertion is novel |
| `tests/presentation/cause-chain.test.ts` | **NEW** | test (presentation unit) | walk-and-assert (depth/cycle) | `tests/presentation/plugin-list.test.ts` (parametric inputs at line 70-95) | role-match |
| `tests/presentation/manual-recovery.test.ts` | **NEW** | test (presentation unit) | render-and-assert | `tests/presentation/plugin-list.test.ts` | exact |
| `tests/presentation/rollback-partial.test.ts` | **NEW** | test (presentation unit) | render-and-assert | `tests/presentation/plugin-list.test.ts` | exact |
| `tests/integration/fold-adoption.test.ts` | **NEW** | test (integration) | state mutation + list assertion | `tests/integration/concurrent-install.test.ts` (multi-step state setup + assert via render) | role-match |
| `extensions/pi-claude-marketplace/presentation/plugin-list.ts` | MODIFIED | composer | transform | self (incremental rewrite) | self |
| `extensions/pi-claude-marketplace/presentation/marketplace-list.ts` | MODIFIED | composer | transform | self (incremental rewrite) | self |
| `extensions/pi-claude-marketplace/presentation/reload-hint.ts` | MODIFIED | composer | transform | self (one-line MSG-RH-1 fix at line 56) | self |
| `extensions/pi-claude-marketplace/presentation/soft-dep.ts` | MODIFIED | composer | transform | self (delete or thin) | self |
| `extensions/pi-claude-marketplace/presentation/index.ts` | MODIFIED | barrel | re-export | self (lines 6-15: 3 export blocks today, 6 added) | self |
| `extensions/pi-claude-marketplace/shared/notify.ts` | MODIFIED | wrapper (single notify chokepoint) | request-response | self (Phase 12 D-CMC-12 deferred body rewrite) | self |
| `extensions/pi-claude-marketplace/shared/markers.ts` | MODIFIED (Wave 3) | constants module | static export | self (delete 5 exports atomically) | self |
| `extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts` | MODIFIED | constants module | static export | self (extend 14-tuple to 15-tuple per D-13-20) | self |
| `extensions/pi-claude-marketplace/orchestrators/edge-deps.ts` | MODIFIED (referenced) | orchestrator helper | request-response (probe) | self (consumed unchanged by renderer) | self |
| `extensions/pi-claude-marketplace/orchestrators/plugin/{install,uninstall,update,reinstall,bootstrap,list}.ts` | MODIFIED | orchestrator | event-driven (notify dispatch) | one another (peer migration); seeds at `install.ts:691`, `reinstall.ts:178/202/215/220`, `list.ts:266/268` | exact |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/{add,remove,update,autoupdate,list}.ts` | MODIFIED | orchestrator | event-driven (notify dispatch) | one another; seeds at `add.ts:142`, `list.ts:62`, `remove.ts:245/251/279`, `autoupdate.ts:92/142` | exact |
| `extensions/pi-claude-marketplace/orchestrators/import/execute.ts` | MODIFIED | orchestrator | event-driven (notify dispatch) | seed at `execute.ts:564/570/572/574` (3-way severity branch) | exact |
| `extensions/pi-claude-marketplace/orchestrators/types.ts` | MODIFIED | shared types | type definitions | self (lines 12-42 existing tag-union precedent) | self |
| `extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` | MODIFIED | orchestrator helper | transform (cause walk) | self (lines 443-478 -- `formatErrorWithCauses` relocates to `presentation/cause-chain.ts`) | self |
| `tests/architecture/markers-snapshot.test.ts` | MODIFIED (Wave 3) | test (snapshot) | byte-equality | self (lines 49-55: delete 5 rows from `expected[]`) | self |
| `eslint.config.js` | MODIFIED (Wave 1, then Wave 3) | config | static | self (lines 265-275: BLOCK E `no-restricted-imports` precedent) | self |
| `docs/messaging-style-guide.md` | MODIFIED | docs (binding contract) | static | self (frontmatter line 17 -- add `reinstalled` to closed set) | self |
| `docs/output-catalog.md` | READ-ONLY | docs (binding contract) | static (consumed by UAT) | none -- read-only input | n/a |
| `docs/prd/pi-claude-marketplace-prd.md` Section 6.12 | MODIFIED (Wave 3) | docs (architectural contract) | static | self (rewrite ES-5 row to pointer per D-13-11) | self |

---

## Pattern Assignments

### NEW: `presentation/compact-line.ts` (composer, transform -- Wave 1 keystone)

**Analog:** `extensions/pi-claude-marketplace/presentation/plugin-list.ts` (whole file, 182 lines)
**Why:** plugin-list is the existing payload-driven pure renderer with private icon constants, literal-union status, structural payload interfaces, and a switch-driven icon dispatcher. Phase 13 generalises this exact shape into a single grammar-aware renderer over an explicit `RowSpec` discriminated union.

**Imports + file header pattern** (`presentation/plugin-list.ts:1-10`):

```typescript
// presentation/plugin-list.ts
//
// PL-1..7 top-level plugin list pure formatter. D-06 orchestrator+presentation
// split: orchestrators/plugin/list.ts (Plan 05-08) owns state-reads and
// manifest soft-fail; this file owns rendering only.
//
// Per D-11, presentation/ does NOT import from persistence/. The payload
// interfaces below are declared LOCALLY as structural minima of the
// orchestrator's payload shape -- the orchestrator constructs the payload
// and passes it in.
```

**Diff intent:** Replace the existing header with a MSG-GR-1..5 / MSG-IC-1..3 / MSG-SD-1..3 reference; keep the D-06 / D-11 framing verbatim.

**Private icon constants + literal-union + icon dispatcher** (`presentation/plugin-list.ts:21-95`):

```typescript
// PL-4 icon table (PRD section 5.3.1). Kept PRIVATE; the renderer maps status -> icon.
const ICON_INSTALLED = "●";
const ICON_AVAILABLE = "○";
const ICON_UNINSTALLABLE = "⊘";

// Column-66 description truncation per PRD section 5.3.1.
const MAX_LINE_COLUMN = 66;

function truncateColumn66(s: string): string {
  if (s.length <= MAX_LINE_COLUMN) {
    return s;
  }
  return s.slice(0, MAX_LINE_COLUMN - 3) + "...";
}

export type PluginRenderStatus = "installed" | "available" | "uninstallable";

export interface PluginListEntry {
  readonly name: string;
  readonly status: PluginRenderStatus;
  readonly version?: string;
  readonly upgradable?: boolean;
  readonly description?: string;
  readonly notes?: readonly string[];
}

function iconFor(status: PluginRenderStatus): string {
  switch (status) {
    case "installed":
      return ICON_INSTALLED;
    case "available":
      return ICON_AVAILABLE;
    case "uninstallable":
      return ICON_UNINSTALLABLE;
  }
}
```

**Diff intent (Wave 1):**
1. Move `ICON_INSTALLED` / `ICON_AVAILABLE` / `ICON_UNINSTALLABLE` from `plugin-list.ts:22-24` to `compact-line.ts` as file-private constants (single source for MSG-IC-1..3 across surfaces).
2. Add `MAX_LINE_COLUMN` + `truncateColumn66` ONLY to `compact-line.ts::renderPluginList` variant -- `plugin-list.ts` keeps it private per the comment at line 27-29 ("PRIVATE to this file -- NOT promoted unless a third consumer arrives"); the third consumer arrives only for the list surface (MSG-PL-1 is list-only), so the constant moves with the `PluginListRow` renderer only.
3. Replace the 3-arm literal-union with the 8-variant explicit-`kind` discriminated union per RESEARCH.md section Pattern 1 (lines 256-391).
4. Replace `iconFor` with `iconForPluginRow(status, isTrivialSkip)` per RESEARCH.md MSG-IC-1..3 table (`(skipped) {up-to-date}` to icon dot; `(skipped) {source mismatch}` to icon blocked).
5. Add the `renderRow(row: RowSpec, edgeDeps: SoftDepProbe): string` switch with `assertNever(row)` default -- `assertNever` already exists at `shared/errors.ts:12`. Import path: `import { assertNever } from "../shared/errors.ts";`.

**Soft-dep probe signature precedent** (`platform/pi-api.ts:47-53`):

```typescript
export function hasLoadedPiSubagents(pi: ExtensionAPI): boolean {
  try {
    return pi.getAllTools().some((tool) => tool.name === "subagent");
  } catch {
    return false;
  }
}
```

**Diff intent:** The `SoftDepProbe` injected dependency type that `renderRow(row, edgeDeps)` accepts is structurally `{ piSubagentsLoaded: boolean; piMcpAdapterLoaded: boolean }` -- the existing `SoftDepStatus` type at `platform/pi-api.ts:38-41` IS that shape. Re-export from `presentation/soft-dep.ts` (already exports `softDepStatus`) so `compact-line.ts` consumes it without crossing D-11 (presentation may import platform/ via the existing re-export seam).

---

### NEW: `presentation/cascade-summary.ts` (composer, transform -- Wave 1)

**Analog:** `presentation/plugin-list.ts::renderPluginList` (payload-driven composer returning a string) + `shared/notify.ts:48-55` (severity-named wrapper precedent for the `{message, severity}` shape).
**Why:** The `{message, severity}` return shape is novel but its severity-named consumer pattern is already established -- the orchestrator destructures and dispatches to the matching wrapper, identical to how `subagentWarningIfNeeded(...) -> string` is consumed today at `orchestrators/plugin/install.ts:659-660`.

**Composer body pattern** (RESEARCH.md section `cascadeSeverity` lines 808-867 -- directly usable):

```typescript
// presentation/cascade-summary.ts -- NEW Wave 1.
import type { PluginCascadeRow, MarketplaceRow } from "./compact-line.ts";

export type CascadeSeverity = "success" | "warning";

export function cascadeSeverity(rows: readonly PluginCascadeRow[]): CascadeSeverity {
  for (const r of rows) {
    if (r.status === "failed") return "warning";
    if (r.status === "skipped" && !isTrivialUpToDate(r)) return "warning";
    if (r.status === "unavailable") return "warning";
    if (r.status === "rollback failed") return "warning";
  }
  return "success";
}

function isTrivialUpToDate(r: PluginCascadeRow): boolean {
  return r.reasons !== undefined && r.reasons.length === 1 && r.reasons[0] === "up-to-date";
}
```

**Sort-then-emit pattern precedent** (`presentation/marketplace-list.ts:60-79`):

```typescript
const lines: string[] = [];
for (const scope of ["user", "project"] as const) {
  const entries = byScope[scope];
  if (entries.length === 0) {
    continue;
  }
  if (lines.length > 0) {
    lines.push("");
  }
  lines.push(`${scope} scope marketplaces:`);
  for (const m of entries) {
    const auto = m.autoupdate === true ? " [autoupdate]" : "";
    const logical = sourceLogical(m.source);
    lines.push(`  ${ICON} ${m.name} (${logical})${auto}`);
  }
}
return lines.join("\n");
```

**Diff intent:** Cascade body = `[renderRow(marketplaceHeader)]` + `rows.sort(compareByNameThenScope).map(r => "  " + renderRow(r))` joined with `\n`. Return `{ message, severity: cascadeSeverity(rows) }`.

**Caller dispatch precedent** (`orchestrators/import/execute.ts:568-575`):

```typescript
const summary = formatClaudeImportSummary(result);
if (result.unexpectedPluginFailures.length > 0) {
  notifyError(opts.ctx, summary);
} else if (hasWarnings(result)) {
  notifyWarning(opts.ctx, summary);
} else {
  notifySuccess(opts.ctx, summary);
}
```

**Diff intent (sub-wave 2a):** Replace the manual severity branch with a single destructure: `const { message, severity } = cascadeSummary({ marketplace, rows }); (severity === "warning" ? notifyWarning : notifySuccess)(opts.ctx, message);`. MSG-SR-6 forbids `notifyError` on cascade surfaces -- the helper returns only `success | warning`, structurally preventing the 3-arm import pattern from re-emerging.

---

### NEW: `presentation/manual-recovery.ts` (composer, transform -- Wave 1)

**Analog:** `presentation/reload-hint.ts` (whole file, 57 lines -- same shape: one file-private trailer constant + one composer function with blank-line discipline).

**File-private literal + single-purpose composer** (`presentation/reload-hint.ts:22-40`):

```typescript
/** MSG-RH-1 canonical trailer (D-CMC-07: file-private; see header above). */
const RELOAD_HINT_TRAILER = "/reload to pick up changes";

export function reloadHint(names: readonly string[]): string {
  return names.length > 0 ? RELOAD_HINT_TRAILER : "";
}

export function appendReloadHint(body: string, hint: string): string {
  return hint === "" ? body : `${body}\n${hint}`;
}
```

**Diff intent:** Mirror the structure: file-private literal for the `(manual recovery)` status-token + `{<reason>}` framing comes from `compact-line.ts::renderRow({kind: "manual-recovery", ...})`. The MR-specific composer just consumes a `ManualRecoveryLine` (per RowSpec union at RESEARCH.md line 341-346) and calls `renderRow`, then prepends a blank line for MSG-MR-1 discipline. The MSG-MR-2 contract ("place resource name directly in name slot; no `@<mp>`, no scope brackets") is enforced structurally by the `ManualRecoveryLine` variant having no `marketplace` or `scope` field -- `compact-line.ts::renderRow` for `kind: "manual-recovery"` cannot emit them.

---

### NEW: `presentation/rollback-partial.ts` (composer, transform -- Wave 1)

**Analog:** `presentation/plugin-list.ts::appendMarketplaceBlock` (lines 171-182 -- parent header + indented children pattern).

**Parent header + indented children** (`presentation/plugin-list.ts:171-182`):

```typescript
function appendMarketplaceBlock(out: string[], mp: PluginListMarketplace): void {
  const tag = mp.autoupdate ? " [autoupdate]" : "";
  out.push(`  ${mp.name}${tag}`);
  if (mp.plugins.length === 0) {
    out.push("    (no plugins)");
    return;
  }
  for (const p of mp.plugins) {
    out.push(renderPluginEntry(p));
  }
}
```

**Diff intent:** Same shape -- parent row built via `renderRow(parent)`, then 2-space indented children built via `renderRow(child)` for each `RollbackChild` (RowSpec variant at RESEARCH.md line 349-354). Empty-children case: parent rendered alone (no `(rollback partial)` trailer emitted when phase list is empty). Concatenate `\n`-joined; caller composes with cause-chain trailer AFTER the indented block per MSG-RP-1.

---

### NEW: `presentation/cause-chain.ts` (composer, transform -- Wave 1)

**Analog:** `orchestrators/marketplace/shared.ts::formatErrorWithCauses` (lines 443-478 -- direct seed, relocated and reworded).

**Existing depth-5 walk to relocate** (`orchestrators/marketplace/shared.ts:443-478`):

```typescript
/**
 * ES-4 / Pitfall 10: walk Error.cause up to depth 5 and join the
 * messages with ` -- caused by: `. Phase 4-local; Phase 6 may
 * promote to shared/errors.ts without changing this signature.
 *
 * The depth bound prevents pathological cycles (an Error whose
 * cause is itself or forms a loop). 5 levels matches V1's
 * reference (marketplace/update.ts::formatErrorWithCauses).
 */
// eslint-disable-next-line @typescript-eslint/no-inferrable-types -- explicit `: number = 5` matches the plan's grep-gate done criterion (Plan 04-02 Task 2).
export function formatErrorWithCauses(err: unknown, maxDepth: number = 5): string {
  const parts: string[] = [];
  let current: unknown = err;
  for (let depth = 0; depth < maxDepth && current !== undefined; depth++) {
    const message = errorCauseMessage(current);
    parts.push(message);
    if (current instanceof Error && current.cause !== undefined && current.cause !== current) {
      current = current.cause;
    } else {
      break;
    }
  }
  return parts.join(" -- caused by: ");
}

function errorCauseMessage(current: unknown): string {
  if (current instanceof Error) {
    return current.message;
  }
  return typeof current === "string" ? current : Object.prototype.toString.call(current);
}
```

**Diff intent (Wave 1):**
1. Relocate to `presentation/cause-chain.ts`. The new home is correct per D-11 (presentation may import shared/, and the helper is a pure transform).
2. Rename to `causeChainTrailer(err: unknown): string`.
3. Change the joiner from ` -- caused by: ` to ` -> ` per MSG-CC-1.
4. Prepend `cause: ` lowercase prefix (MSG-CC-1).
5. Add depth-5 truncation `(truncated)` suffix when the walk hits the bound mid-chain. The existing code stops cleanly; the new shape appends ` (truncated)` to the last link iff `current` is still non-null at break time.
6. Return `""` (empty) when `err` is undefined/null so callers can do `body + (trailer === "" ? "" : "\n\n" + trailer)`.
7. Delete the original from `orchestrators/marketplace/shared.ts`. The 7 known callsites (per RESEARCH.md lines 614-616: `orchestrators/plugin/{install,uninstall,update,reinstall}.ts`, `orchestrators/marketplace/{remove,update}.ts`, `orchestrators/import/execute.ts`) migrate to `notifyError(ctx, message, err)` and let `notifyError` itself append the trailer (consolidates per D-CMC-12).

**Body rewrite in `shared/notify.ts`** -- see `shared/notify.ts:70-73` modification section below.

---

### NEW: `presentation/sort.ts` (or named export in `compact-line.ts`) -- Wave 1

**Analog:** No exact precedent for the helper itself, but the call shape is established at `orchestrators/marketplace/remove.ts:257`:

```typescript
const removedSorted = [...removedPlugins].sort((a, b) => a.localeCompare(b));
```

**Diff intent:** Codify `compareByNameThenScope(a: { name: string; scope: "user" | "project" }, b: ...): number` using `localeCompare(b.name, undefined, { sensitivity: 'base' })` as primary; tie-break by `scope === "project" ? -1 : scope === "user" ? 1 : 0` (project before user per MSG-GR-3). Per Claude's-discretion in CONTEXT.md, this can live in `compact-line.ts` as a named export OR a separate `sort.ts`. **Recommendation:** standalone `presentation/sort.ts` -- keeps `compact-line.ts` focused on the renderer; sort is a separate concern reused across surfaces. Single-file extraction has Phase 12 precedent (`reload-hint.ts` and `soft-dep.ts` are single-purpose files).

---

### NEW: `tests/architecture/no-legacy-markers.test.ts` (test, static-audit -- Wave 1)

**Analog:** `tests/architecture/manifest-read-seam.test.ts` (whole file, 57 lines -- recursive readdir + per-file substring scan + offenders aggregation).

**Recursive walk + offenders pattern** (`tests/architecture/manifest-read-seam.test.ts:11-57`):

```typescript
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EXTENSION_ROOT = path.join(REPO_ROOT, "extensions/pi-claude-marketplace");
const ALLOWED_RELATIVE_PATH = "domain/manifest.ts";

async function collectTypeScriptFiles(dir: string): Promise<readonly string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectTypeScriptFiles(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      out.push(fullPath);
    }
  }
  return out;
}

test("NFR-8 manifest read seam: only domain/manifest.ts reads marketplace.json", async () => {
  const offenders: string[] = [];
  const files = await collectTypeScriptFiles(EXTENSION_ROOT);
  for (const filePath of files) {
    const rel = path.relative(EXTENSION_ROOT, filePath).split(path.sep).join("/");
    if (rel === ALLOWED_RELATIVE_PATH) {
      continue;
    }
    const stripped = stripComments(await readFile(filePath, "utf8"));
    if (hasMarketplaceManifestRead(stripped)) {
      offenders.push(`extensions/pi-claude-marketplace/${rel}`);
    }
  }
  assert.deepEqual(offenders, [], `NFR-8 manifest read seam violation: ...`);
});
```

**Allow-list + skip-ENOENT precedent** (`tests/architecture/no-orchestrator-network.test.ts:62-93`):

```typescript
test("NFR-5 + PI-2 + PL-3 + PRL-07: network-free orchestrators have zero gitOps surface", async () => {
  const offenders: string[] = [];
  for (const rel of FORBIDDEN_TARGETS) {
    let src: string;
    try {
      src = await readFile(path.join(REPO_ROOT, rel), "utf8");
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        continue;
      }
      throw err;
    }
    const stripped = stripComments(src);
    for (const { name, pattern } of FORBIDDEN_PATTERNS) {
      if (pattern.test(stripped)) {
        offenders.push(`${rel} matches forbidden ${name}: ${String(pattern)}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `NFR-5 / PI-2 / PL-3 / PRL-07 violation: ...`);
});
```

**Diff intent:** Combine the two patterns. Use the recursive `collectTypeScriptFiles` from `manifest-read-seam.test.ts` (rename `walkTs` per RESEARCH.md section Static-audit test). Use the `ALLOW_LIST` set pattern from `no-orchestrator-network.test.ts`. **Comment-stripping decision per RESEARCH.md line 806:** do NOT strip comments (legitimate ALLOW_LIST entries should cover header-docstring mentions; the test's job is to prove zero refs after Wave 3).

**Key contract from D-13-12 (RESEARCH.md lines 725-803):**

- The 5 legacy strings are **pinned literally** in the test body (NOT imported from `markers.ts`) so the Wave 3 atomic commit can delete the exports while the test keeps gating.
- ALLOW_LIST contains: `shared/markers.ts`, `tests/architecture/markers-snapshot.test.ts`, `tests/architecture/no-legacy-markers.test.ts` (this file pins literals), `docs/prd/pi-claude-marketplace-prd.md`, `docs/messaging-style-guide.md`.
- Scan roots: `extensions/pi-claude-marketplace` and `tests` (covers test fixtures too).
- The 5 strings to pin (per `shared/markers.ts:9-13` byte-for-byte):
  - `"pi-subagents is not loaded; "`
  - `"pi-mcp-adapter is not loaded; "`
  - `"Run /reload to "`
  - `"MANUAL RECOVERY REQUIRED: "`
  - `"(rollback partial: "`

---

### NEW: `tests/architecture/catalog-uat.test.ts` (test, byte-equality -- Wave 3 plan #1)

**Analog (closest):** `tests/architecture/grammar-frontmatter.test.ts:36-60` (regex-extract MD frontmatter block + assert set-equality) + `tests/helpers/prd-extract.ts::extractEs5MarkerLiterals` (regex-extract backtick-literals from a `.md` section heading).

**MD-extraction pattern** (`tests/architecture/grammar-frontmatter.test.ts:36-60`):

```typescript
function extractFrontmatterList(md: string, key: string): string[] {
  // Match the YAML frontmatter block at the head of the file via regex.
  const frontmatterMatch = /^---\n([\s\S]*?)\n---\n/.exec(md);
  if (frontmatterMatch === null) {
    throw new Error("messaging-style-guide.md: no YAML frontmatter found at file head");
  }
  const frontmatter = frontmatterMatch[1]!;
  // Build a regex that matches the named key's bullet list and run it.
  const keyBlockRe = new RegExp(`^${key}:\\n((?:  - .+\\n)+)`, "m");
  const keyBlockMatch = keyBlockRe.exec(frontmatter);
  if (keyBlockMatch === null) {
    throw new Error(`messaging-style-guide.md frontmatter: key "${key}" not found`);
  }
  const items = keyBlockMatch[1]!
    .split("\n")
    .filter((line) => line.startsWith("  - "))
    .map((line) => line.slice("  - ".length));
  return items;
}
```

**Diff intent:** Novel shape -- no precedent for fenced-code-block extraction from MD by section heading. Construct in Wave 3 plan #1 as follows:

1. Read `docs/output-catalog.md`.
2. For each per-command H2 heading (e.g. `## list`, `## install`, `## marketplace add`), find every fenced ` ``` ` block beneath it.
3. Each fenced block is a rendered example. Pair each block with a programmatic state (the orchestrator-side fixture that produces that state).
4. For each block, invoke the renderer with the matching state and `assert.equal(rendered, blockContents)`.

The pairing requires Wave 3 plan #1 to also produce a fixture catalog (one fixture per fenced block). **No analog for this fixture catalog exists** -- Phase 13 is the first phase to assert byte-equality against `docs/output-catalog.md`. Recommendation: define the fixtures inline in the test file, indexed by `(command, exampleIndex)` tuples, so the test is self-contained.

**Per-block assertion** (`tests/presentation/plugin-list.test.ts:8-11` precedent):

```typescript
test("PL-1 empty payload returns the empty-marker sentinel", () => {
  const out = renderPluginList({ marketplaces: [] });
  assert.equal(out, "No plugins configured.");
});
```

---

### NEW: `tests/presentation/{compact-line,cascade-summary,cause-chain,manual-recovery,rollback-partial}.test.ts` (test, unit -- Wave 1)

**Analog:** `tests/presentation/plugin-list.test.ts` (parametric inputs at lines 70-95; assert.equal/assert.match assertion style).

**Test pattern** (`tests/presentation/plugin-list.test.ts:8-36`):

```typescript
import assert from "node:assert/strict";
import test from "node:test";

import { renderPluginList } from "../../extensions/pi-claude-marketplace/presentation/plugin-list.ts";

import type { PluginListPayload } from "../../extensions/pi-claude-marketplace/presentation/plugin-list.ts";

test("PL-1 empty payload returns the empty-marker sentinel", () => {
  const out = renderPluginList({ marketplaces: [] });
  assert.equal(out, "No plugins configured.");
});

test("PL-4 icon + name + (version) renders installed/available/uninstallable correctly", () => {
  const payload: PluginListPayload = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        autoupdate: false,
        plugins: [
          { name: "foo", status: "installed", version: "1.0.0" },
          { name: "bar", status: "available", version: "0.1.0" },
        ],
      },
    ],
  };
  const out = renderPluginList(payload);
  assert.match(out, /● foo \(1\.0\.0\)/);
});
```

**Diff intent:** Each new presentation test follows this exact shape -- import the composer + payload types, build a typed payload, call the composer, assert against the rendered string. Coverage per RESEARCH.md section Phase Requirements to Test Map:

- `compact-line.test.ts`: token order (CMC-01); reasons block (CMC-04); plugin icons (CMC-06); per-row soft-dep emission (CMC-13); MSG-IC-1..3 dispatcher.
- `cascade-summary.test.ts`: severity routing (CMC-20 / MSG-SR-4..6) -- every row class to expected severity.
- `cause-chain.test.ts`: depth 0/1/3/5/6/cycle/non-Error cases (CMC-18 / MSG-CC-1).
- `manual-recovery.test.ts`: shape contract (CMC-16 / MSG-MR-1..2).
- `rollback-partial.test.ts`: parent + indented children (CMC-17 / MSG-RP-1).

---

### NEW: `tests/integration/fold-adoption.test.ts` (test, integration -- sub-wave 2d)

**Analog:** `tests/integration/concurrent-install.test.ts` (multi-step state setup + assert via the rendered output).

**Diff intent:** RESEARCH.md line 1008 contract: run `marketplace add` to create user-scope `<mp>`, then run `list` and assert orphan project-scope plugin folds under the user-scope marketplace header. Then run `marketplace add` to create project-scope `<mp>`, re-run `list`, and assert the orphan now appears under the project-scope header (adoption per D-13-17). Both runs share the same state-mutation harness as `concurrent-install.test.ts` -- fork a child or use a child invoke against a temp `<scopeRoot>` to isolate state.

---

### MODIFIED: `presentation/plugin-list.ts` (sub-wave 2d)

**Self-precedent:** lines 59-66 (`PluginListEntry` interface) and lines 131-169 (`renderPluginList` function).

**Existing `PluginListEntry`** (`presentation/plugin-list.ts:59-66`):

```typescript
export interface PluginListEntry {
  readonly name: string;
  readonly status: PluginRenderStatus;
  readonly version?: string;
  readonly upgradable?: boolean;
  readonly description?: string;
  readonly notes?: readonly string[];
}
```

**Diff intent:** Replace `PluginListEntry` with `PluginListRow` from `compact-line.ts` (or alias it). The status field narrows to `Extract<StatusToken, "installed" | "upgradable" | "available" | "unavailable">`. Add `scope: Scope` field (today implicit in the parent block); add the MSG-PL-6 scope-bracket carve-out (omit `[scope]` when `status === "available" | "unavailable"`). Replace `renderPluginEntry(p: PluginListEntry)` with a call to `renderRow(row, edgeDeps)` from `compact-line.ts`.

**Orphan-fold consumption** -- the orchestrator at `orchestrators/plugin/list.ts` builds the folded `PluginListPayload` per D-13-19 (RESEARCH.md lines 395-445); the renderer just iterates the assembled blocks.

---

### MODIFIED: `presentation/marketplace-list.ts` (sub-wave 2c)

**Self-precedent:** lines 33-38 (`MarketplaceListEntry`) and lines 47-82 (`renderMarketplaceList`).

**Existing renderer body** (`presentation/marketplace-list.ts:47-82` -- full function shown above in cascade-summary section).

**Diff intent:**
1. Replace the hand-formatted `${ICON} ${m.name} (${logical})${auto}` line at `marketplace-list.ts:77` with `renderRow(marketplaceRow, edgeDeps)`.
2. Add the `<marker>` slot per MSG-GR-5 (the existing ` [autoupdate]` is replaced by the closed-set `marker: "autoupdate" | "no autoupdate"` field on `MarketplaceRow`).
3. Add the outcome-class icon dispatch per MSG-IC-3 (`outcomeClass: "ok"` to dot icon; `outcomeClass: "failure"` to blocked icon).
4. Replace the empty case (`No marketplaces configured.`) with `renderRow({kind: "empty", token: "no marketplaces"})` to emit `(no marketplaces)` per MSG-ER-1.

---

### MODIFIED: `presentation/reload-hint.ts` (Wave 1 one-line + sub-wave 2c coexistence)

**Self-precedent:** lines 55-57.

**Existing** (`presentation/reload-hint.ts:55-57`):

```typescript
export function appendReloadHint(body: string, hint: string): string {
  return hint === "" ? body : `${body}\n${hint}`;
}
```

**Diff intent (Wave 1, MSG-RH-1 fix):** Change `${body}\n${hint}` to `${body}\n\n${hint}` per the in-file TODO (lines 47-53). Update `tests/presentation/reload-hint.test.ts:25-29` byte-equality test to expect the double newline.

**Sub-wave 2c coexistence:** Per CMC-15, the reload-hint and recovery-anchor must coexist on `marketplace remove` partial failure (catalog lines 642-651). The composer signature stays unchanged; the orchestrator composes `body + "\n\n" + hint + "\n\n" + recoveryAnchor` (3-line block with blank lines between).

---

### MODIFIED: `presentation/soft-dep.ts` (Wave 1 -- evaluate delete-vs-thin)

**Self-precedent:** lines 1-7 (whole file -- a 7-line re-export shim from `platform/pi-api.ts`).

**Existing** (`presentation/soft-dep.ts:1-7`):

```typescript
export {
  hasLoadedPiMcpAdapter,
  hasLoadedPiSubagents,
  mcpAdapterWarningIfNeeded,
  softDepStatus,
  subagentWarningIfNeeded,
} from "../platform/pi-api.ts";
```

**Diff intent:** Per D-13-07 + RESEARCH.md anti-pattern note (line 454), the aggregated `subagentWarningIfNeeded` / `mcpAdapterWarningIfNeeded` trailer is replaced by per-row markers. The renderer probes companion-loaded state via injected `SoftDepProbe` and emits `{requires pi-subagents}` / `{requires pi-mcp}` per row when `(declares AND companion unloaded)`. **Recommendation (Wave 1):** delete `subagentWarningIfNeeded` + `mcpAdapterWarningIfNeeded` re-exports from `soft-dep.ts`; keep `hasLoadedPiSubagents`, `hasLoadedPiMcpAdapter`, `softDepStatus` as the surface `compact-line.ts` consumes. The 2 plugin orchestrators currently calling the warning helpers (`install.ts:659-660`, `remove.ts:265-266`) migrate to passing `declaresAgents/Mcp` flags into the RowSpec.

---

### MODIFIED: `presentation/index.ts` (Wave 1 barrel update)

**Self-precedent:** whole file (lines 1-15 -- 3 existing re-export blocks).

**Existing** (`presentation/index.ts:1-15`):

```typescript
// presentation/index.ts
//
// Barrel re-export for the presentation layer (Phase 4 first
// populates this directory beyond the placeholder).

export { appendReloadHint, reloadHint } from "./reload-hint.ts";

export {
  hasLoadedPiMcpAdapter,
  hasLoadedPiSubagents,
  mcpAdapterWarningIfNeeded,
  subagentWarningIfNeeded,
} from "./soft-dep.ts";

export { renderMarketplaceList } from "./marketplace-list.ts";
```

**Diff intent:** Add 6 export blocks per D-13-15:

```typescript
export { renderRow } from "./compact-line.ts";
export type {
  RowSpec,
  PluginInlineRow,
  PluginCascadeRow,
  PluginListRow,
  MarketplaceRow,
  EmptyToken,
  ManualRecoveryLine,
  RollbackChild,
  EntityErrorRow,
  Scope,
} from "./compact-line.ts";

export { cascadeSummary, cascadeSeverity } from "./cascade-summary.ts";
export type { CascadeSeverity } from "./cascade-summary.ts";

export { renderManualRecovery } from "./manual-recovery.ts";
export { renderRollbackPartial } from "./rollback-partial.ts";
export { causeChainTrailer } from "./cause-chain.ts";
export { compareByNameThenScope } from "./sort.ts";
```

Drop `mcpAdapterWarningIfNeeded` and `subagentWarningIfNeeded` re-exports per the `soft-dep.ts` rewrite above.

---

### MODIFIED: `shared/notify.ts` (Wave 1 -- body rewrite of `notifyError`)

**Self-precedent:** lines 70-73.

**Existing** (`shared/notify.ts:70-73`):

```typescript
export function notifyError(ctx: ExtensionContext, message: string, cause?: unknown): void {
  const causeText = cause === undefined ? "" : `\nCause: ${errorMessage(cause)}`;
  ctx.ui.notify(`${message}${causeText}`, "error");
}
```

**Diff intent (D-CMC-12 Phase-13 work):** Replace the single-level `\nCause: ${errorMessage(cause)}` with a call to `causeChainTrailer(cause)` from `presentation/cause-chain.ts`. The joiner becomes `\n\n` per MSG-CC-1 blank-line discipline:

```typescript
export function notifyError(ctx: ExtensionContext, message: string, cause?: unknown): void {
  const trailer = causeChainTrailer(cause);
  const body = trailer === "" ? message : `${message}\n\n${trailer}`;
  ctx.ui.notify(body, "error");
}
```

**Import path consideration:** `shared/notify.ts` cannot import from `presentation/` (D-11 `shared/` only to `platform/`). **Resolution:** keep the cause-chain composer in `presentation/cause-chain.ts` BUT also relocate the helper itself to a sub-path that `shared/` may import from -- OR inline the depth-5 walk in `shared/notify.ts` directly and have `presentation/cause-chain.ts` be a thin re-export for catalog UAT use. **Recommendation:** put the depth-5 walk in `shared/errors.ts` (whose `errorMessage` and `assertNever` already live there) and re-export from `presentation/cause-chain.ts` for `presentation/`-layer consumers. This keeps D-11 clean. Phase 13 planner must resolve this; the helper logic is identical either way.

The 4 wrappers themselves (`notifySuccess`, `notifyWarning`, `notifyError`, `notifyUsageError`) remain unchanged per D-CMC-11 four-wrapper minimalism.

---

### MODIFIED: `shared/markers.ts` (Wave 3 atomic commit)

**Self-precedent:** lines 9-13.

**Existing** (`shared/markers.ts:9-13`):

```typescript
export const PI_SUBAGENTS_NOT_LOADED = "pi-subagents is not loaded; ";
export const PI_MCP_ADAPTER_NOT_LOADED = "pi-mcp-adapter is not loaded; ";
export const RELOAD_HINT_PREFIX = "Run /reload to ";
export const MANUAL_RECOVERY_REQUIRED = "MANUAL RECOVERY REQUIRED: ";
export const ROLLBACK_PARTIAL = "(rollback partial: ";
```

**Diff intent (Wave 3 atomic commit only):** Delete these 5 export lines. Keep `RECOVERY_PLUGIN_REINSTALL_PREFIX` (line 26) and `STATE_LOCK_HELD_PREFIX` (line 37) -- both are Phase 5/7 extensions explicitly outside the ES-5 set per D-04 / D-08 file-header notes.

---

### MODIFIED: `shared/grammar/status-tokens.ts` (Wave 1 -- D-13-20)

**Self-precedent:** lines 37-54.

**Existing** (`shared/grammar/status-tokens.ts:37-54`):

```typescript
export const STATUS_TOKENS = [
  "installed",
  "updated",
  "uninstalled",
  "added",
  "removed",
  "available",
  "unavailable",
  "upgradable",
  "skipped",
  "failed",
  "rollback failed",
  "manual recovery",
  "no marketplaces",
  "no plugins",
] as const;

export type StatusToken = (typeof STATUS_TOKENS)[number];
```

**Diff intent:** Add `"reinstalled"` as the 15th entry per D-13-20. Position: after `"updated"` (semantic grouping). Also update the header comment at lines 31-35 ("there is NO 15th user-visible token for the reinstall cascade") -- that reasoning was inverted by D-13-20's reconciliation. New comment: cite D-13-20 and the catalog `(reinstalled)` emission requirement.

**Companion edits** (lock-step under `tests/architecture/grammar-frontmatter.test.ts` set-equality assertion):
- `docs/messaging-style-guide.md` frontmatter `status_tokens:` list (add `  - reinstalled` after `  - updated` at line ~5).
- `docs/messaging-style-guide.md` section 3 status-tokens table (add `reinstalled` row with operator-mental-model "operation just ran: reinstall partition").

---

### MODIFIED: `orchestrators/edge-deps.ts` (consumed unchanged)

**Self-precedent:** lines 47-53 (`hasLoadedPiSubagents` is consumed by the renderer's `SoftDepProbe`).

**Diff intent:** No code changes in Phase 13. The renderer accepts a `SoftDepProbe` injected by orchestrators (per D-13-07 + RESEARCH.md line 450). Each orchestrator that calls `renderRow` first builds the probe via `softDepStatus(pi)` from `platform/pi-api.ts:76-81` and passes it in.

---

### MODIFIED: `orchestrators/plugin/install.ts` (sub-wave 2b -- single-plugin success)

**Existing callsite** (`orchestrators/plugin/install.ts:657-691`):

```typescript
// RH-5 soft-dep probes -- the staged agents/mcp will not actually load
// until /reload, AND not at all if the companion extension is unloaded.
const subagentWarn = subagentWarningIfNeeded(pi, installCtx.stagedAgentNames);
const mcpWarn = mcpAdapterWarningIfNeeded(pi, installCtx.stagedMcpServerNames);

// RH-1 reload-hint gate: emit the hint only if at least one resource
// was actually staged...
const stagedAny = /* ... */;

if (!orchestrated) {
  let body = `Installed plugin "${plugin}" from marketplace "${marketplace}".`;
  if (subagentWarn !== "") {
    body = `${body}\n${subagentWarn}`;
  }
  if (mcpWarn !== "") {
    body = `${body}\n${mcpWarn}`;
  }
  // PI-13 dependencies declaration...
  const depsNote = installCtx.resolved.notes.find(/* ... */);
  if (depsNote !== undefined) {
    body = `${body}\n${depsNote}`;
  }
  const hint = reloadHint(stagedAny ? [plugin] : []);
  notifySuccess(ctx, appendReloadHint(body, hint));
}
```

**Diff intent (sub-wave 2b):** Replace the manual body composition with:

```typescript
const probe = softDepStatus(pi);
const row: PluginInlineRow = {
  kind: "plugin-inline",
  name: plugin,
  marketplace,
  scope,
  version: installCtx.resolved.version,
  status: "installed",
  declaresAgents: installCtx.stagedAgentNames.length > 0,
  declaresMcp: installCtx.stagedMcpServerNames.length > 0,
};
const body = renderRow(row, probe);
const hint = reloadHint(stagedAny ? [plugin] : []);
notifySuccess(ctx, appendReloadHint(body, hint));
```

The per-row soft-dep marker fires automatically inside `renderRow` when `(declares* AND probe.pi*Loaded === false)`. The aggregated `subagentWarn` / `mcpWarn` lines are deleted (D-13-07 retires the aggregated trailer).

---

### MODIFIED: `orchestrators/plugin/reinstall.ts` (sub-wave 2a -- cascade)

**Existing callsites** (`orchestrators/plugin/reinstall.ts:215-220`):

```typescript
let targets: readonly ResolvedReinstallTarget[];
try {
  targets = await enumerateReinstallTargets(opts);
} catch (err) {
  notifyError(ctx, formatErrorWithCauses(err), err);
  return [];
}

if (targets.length === 0) {
  notifySuccess(ctx, "No plugins installed.");
  return [];
}
```

**Diff intent (sub-wave 2a):**
1. `notifyError(ctx, formatErrorWithCauses(err), err)` to `notifyError(ctx, errorMessage(err), err)` -- the trailer is now appended inside `notifyError` itself via `causeChainTrailer`.
2. `notifySuccess(ctx, "No plugins installed.")` to `notifySuccess(ctx, renderRow({kind: "empty", token: "no plugins"}, probe))` -- emits the MSG-ER-1 bare `(no plugins)` token.
3. The cascade body composition at the bottom of `reinstallPlugins` becomes `const { message, severity } = cascadeSummary({ marketplace: mpRow, rows: cascadeRows }); (severity === "warning" ? notifyWarning : notifySuccess)(ctx, appendReloadHint(message, hint));` per the sub-wave 2a pattern.

---

### MODIFIED: `orchestrators/plugin/list.ts` (sub-wave 2d)

**Existing callsite** (`orchestrators/plugin/list.ts:262-270`):

```typescript
export async function listPlugins(opts: ListPluginsOptions): Promise<void> {
  const { ctx } = opts;
  try {
    const { payload, warnings } = await loadPluginListPayload(opts);
    notifySuccess(ctx, renderPluginList(payload, warnings));
  } catch (err) {
    notifyError(ctx, errorMessage(err), err);
  }
}
```

**Diff intent (sub-wave 2d):**
1. Rewrite `loadPluginListPayload` to compute the orphan fold per D-13-19 + RESEARCH.md section Pattern 2 (lines 395-445). The orchestrator reads both scopes' state, computes which project-scoped marketplaces have no project-scope record, and nests their plugins under the matching user-scope marketplace block.
2. The renderer call stays as `renderPluginList(payload, warnings)` (the renderer name is unchanged; only its internal token-construction changes per the `presentation/plugin-list.ts` rewrite above).
3. The `notifyError` call stays -- `errorMessage(err)` already passes the bare message; `notifyError`'s new body adds the cause-chain trailer.

---

### MODIFIED: `orchestrators/marketplace/list.ts` (sub-wave 2c)

**Existing callsite** (`orchestrators/marketplace/list.ts:62`):

```typescript
notifySuccess(opts.ctx, renderMarketplaceList(allRecords));
```

**Diff intent (sub-wave 2c):** No callsite change -- the renderer signature stays. Inside `presentation/marketplace-list.ts` (see modification block above), the empty case routes to `renderRow({kind: "empty", token: "no marketplaces"})` per MSG-ER-1, and each row goes through `renderRow(mpRow)`. The orchestrator's sort happens via `compareByNameThenScope` instead of the implicit user-then-project scope-bucketing currently at `marketplace-list.ts:52-79`.

---

### MODIFIED: `orchestrators/marketplace/add.ts` (sub-wave 2c)

**Existing callsite** (`orchestrators/marketplace/add.ts:135-142`):

```typescript
try {
  await invalidateMarketplaceNames(locations.marketplaceNamesCacheFile, opts.scope);
  await dropMarketplaceCache(/* ... */);
} catch (err) {
  notifyWarning(
    opts.ctx,
    `Marketplace "${recordedName}" added; completion cache refresh deferred: ${errorMessage(err)}`,
  );
}

// MA-11: success -- exact stable string, NO reload hint.
notifySuccess(opts.ctx, `Added marketplace "${recordedName}" in ${opts.scope} scope.`);
```

**Diff intent (sub-wave 2c):** Replace the sentence-form `Added marketplace "${name}" ...` with:

```typescript
const row: MarketplaceRow = {
  kind: "marketplace",
  name: recordedName,
  scope: opts.scope,
  status: "added",
  outcomeClass: "ok",
  ...(opts.source.kind === "github" && { marker: "autoupdate" }),
};
notifySuccess(opts.ctx, renderRow(row, probe));
```

The post-commit cache-leak `notifyWarning` keeps its sentence form (post-commit leak is a soft warning, not an entity outcome -- it stays inline per the existing pattern).

---

### MODIFIED: `orchestrators/marketplace/remove.ts` (sub-wave 2c -- CMC-31 conditional)

**Existing callsites** (`orchestrators/marketplace/remove.ts:245-279`):

```typescript
notifyWarning(opts.ctx, formatErrorWithCauses(aggregated));
// ...
notifyWarning(opts.ctx, failureWarning(opts.name, failedPlugins));
// ...
const subagentWarn = subagentWarningIfNeeded(opts.pi, dropped.agents);
const mcpWarn = mcpAdapterWarningIfNeeded(opts.pi, dropped.mcpServers);
let body = baseBody;
if (subagentWarn !== "") body = `${body}\n${subagentWarn}`;
if (mcpWarn !== "") body = `${body}\n${mcpWarn}`;
const hint = reloadHint(removedSorted);
notifySuccess(opts.ctx, appendReloadHint(body, hint));
```

**Diff intent (sub-wave 2c, CMC-31):**
1. **Clean path:** `MarketplaceRow{outcomeClass:"ok", status:"removed"}` bare row + reload-hint trailer (catalog "clean" form).
2. **Partial path:** `MarketplaceRow{outcomeClass:"failure", status:"failed", reasons:["plugins remain"]}` HEADER + `PluginCascadeRow[]` children for each failed plugin + reload-hint + recovery anchor coexistence per CMC-15 (3-line block, blank lines between).
3. `formatErrorWithCauses(aggregated)` becomes bare `errorMessage(aggregated)` (the trailer comes from `notifyError`'s new body -- but here we're on `notifyWarning` for cache leaks, which keeps its sentence form per RESEARCH.md line 906).
4. Delete the `subagentWarn` / `mcpWarn` aggregated trailer; the per-row markers fire on each `PluginCascadeRow` in the partial path's children.

---

### MODIFIED: `orchestrators/marketplace/update.ts` + `orchestrators/marketplace/autoupdate.ts` (sub-wave 2c)

**Existing callsites** (`orchestrators/marketplace/autoupdate.ts:92, 113, 138, 142`):

```typescript
notifyError(opts.ctx, errorMessage(err), err);          // target not found
notifyError(opts.ctx, errorMessage(first.cause), first.cause);   // single-shot failure
notifySuccess(opts.ctx, "No marketplaces configured.");
notifySuccess(opts.ctx, lines.join("\n"));              // multi-mp result
```

**Diff intent (sub-wave 2c):**
1. `"No marketplaces configured."` becomes `renderRow({kind: "empty", token: "no marketplaces"}, probe)` to emit `(no marketplaces)`.
2. The multi-mp result `lines.join("\n")` is rebuilt as: for each mp, `renderRow({kind: "marketplace", marker: enable ? "autoupdate" : "no autoupdate", outcomeClass: "ok", status: undefined, ...})` per catalog section marketplace autoupdate. Note: **no status token on flip-success rows** per RESEARCH.md line 908; the `MarketplaceRow.status` is optional and omitted here.
3. `notifyError(ctx, errorMessage(err), err)` paths stay as-is -- `notifyError`'s body now appends the cause-chain trailer automatically.

---

### MODIFIED: `orchestrators/import/execute.ts` (sub-wave 2a -- 3-way severity branch)

**Existing callsite** (`orchestrators/import/execute.ts:564-575`):

```typescript
} catch (err) {
  notifyError(opts.ctx, `Import failed: ${errorMessage(err)}`, err);
  return result;
}

const summary = formatClaudeImportSummary(result);
if (result.unexpectedPluginFailures.length > 0) {
  notifyError(opts.ctx, summary);
} else if (hasWarnings(result)) {
  notifyWarning(opts.ctx, summary);
} else {
  notifySuccess(opts.ctx, summary);
}
```

**Diff intent (sub-wave 2a):**
1. Rewrite `formatClaudeImportSummary(result)` to construct one `MarketplaceRow` per imported mp + `PluginCascadeRow[]` per-mp children; route each block through `cascadeSummary`.
2. The 3-way severity branch collapses: `notifyError` is forbidden on cascade surfaces per MSG-SR-6. The new shape: for each `(mp, rows)` pair, `const { message, severity } = cascadeSummary({ marketplace: mp, rows });` and dispatch via `(severity === "warning" ? notifyWarning : notifySuccess)(opts.ctx, message)`.
3. The top-level `Import failed: ${...}` catch-all stays as `notifyError` (it's a setup-failure, not a cascade).

---

### MODIFIED: `orchestrators/types.ts` (Wave 1)

**Self-precedent:** lines 12-42 (existing tag-union discriminated by `partition`).

**Existing** (`orchestrators/types.ts:12, 39-42`):

```typescript
export type ReinstallPluginPartition = "reinstalled" | "skipped" | "failed";
// ...
export type ReinstallPluginOutcome =
  | ReinstallReinstalledOutcome
  | ReinstallSkippedOutcome
  | ReinstallFailedOutcome;
```

**Diff intent (Wave 1):** Per D-13-06, the planner extends with the `RowSpec` discriminated union -- but per RESEARCH.md line 262, **the recommended location is `presentation/compact-line.ts`** (not `orchestrators/types.ts`), because:
- `RowSpec` is consumed primarily by the renderer (presentation/).
- Orchestrators construct `RowSpec` values from their own state types (which already live in `orchestrators/types.ts`).
- D-11 allows `orchestrators/` to import from `presentation/`, so the orchestrator-side construction of `RowSpec` reads from the renderer's exported types.

**No edit to `orchestrators/types.ts`** beyond perhaps renaming `ReinstallPluginPartition` to use the literal-union form for consistency. The `RowSpec` union itself lives in `presentation/compact-line.ts`.

---

### MODIFIED: `orchestrators/marketplace/shared.ts` (Wave 1)

**Self-precedent:** lines 443-478 (`formatErrorWithCauses` -- relocated to `presentation/cause-chain.ts` per the cause-chain block above).

**Diff intent (Wave 1):** Delete `formatErrorWithCauses` (lines 443-478) + its private `errorCauseMessage` helper. The 7 known callsites (per RESEARCH.md lines 614-616) migrate to either:
- Pass the bare `err` through to `notifyError(ctx, errorMessage(err), err)` -- let `notifyError`'s rewritten body call `causeChainTrailer` once.
- For non-`notifyError` callers (e.g. `marketplace/remove.ts:245` uses `notifyWarning(ctx, formatErrorWithCauses(aggregated))`), import `causeChainTrailer` from `presentation/cause-chain.ts` directly and compose `${msg}\n\n${causeChainTrailer(err)}` inline.

---

### MODIFIED: `tests/architecture/markers-snapshot.test.ts` (Wave 3 atomic commit)

**Self-precedent:** lines 49-55.

**Existing** (`tests/architecture/markers-snapshot.test.ts:49-55`):

```typescript
const expected: ReadonlyArray<readonly [string, string]> = [
  ["pi-subagents is not loaded; …", markers.PI_SUBAGENTS_NOT_LOADED],
  ["pi-mcp-adapter is not loaded; …", markers.PI_MCP_ADAPTER_NOT_LOADED],
  ["Run /reload to <verb> …", markers.RELOAD_HINT_PREFIX],
  ["MANUAL RECOVERY REQUIRED: …", markers.MANUAL_RECOVERY_REQUIRED],
  ["(rollback partial: [<phase>] <msg>; …)", markers.ROLLBACK_PARTIAL],
];
```

**Diff intent (Wave 3 atomic commit):** Delete these 5 rows. Also delete the `assert.equal(literals.length, 5, ...)` assertion at line 42-46 -- `extractEs5MarkerLiterals` will return 0 literals once PRD section 6.12 is rewritten to the pointer per D-13-11. The post-Wave-3 file keeps only the AG-5 + PUP-6 + D-08 marker assertions (lines 88-125), which test `bridges/agents/marker.ts` exports + Phase 5/7 extension constants -- those are NOT ES-5 and stay.

---

### MODIFIED: `eslint.config.js` (Wave 1 add, Wave 3 atomic commit delete)

**Self-precedent:** BLOCK E at lines 258-278 (`no-restricted-imports` precedent for Pi peer-imports).

**Existing BLOCK E** (`eslint.config.js:258-278`):

```javascript
{
  // BLOCK E (Phase 7 D-04): Direct Pi peer imports are allowed only in
  // platform/pi-api.ts. All other extension code imports Pi API types from
  // the wrapper so peer-dependency version bumps have a single audit point.
  files: ["extensions/pi-claude-marketplace/**/*.ts"],
  ignores: ["extensions/pi-claude-marketplace/platform/pi-api.ts"],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@earendil-works/pi-coding-agent",
            message:
              "Import Pi API types from extensions/pi-claude-marketplace/platform/pi-api.ts instead.",
          },
        ],
      },
    ],
  },
},
```

**Diff intent (Wave 1):** Per RESEARCH.md lines 618-723, the BLOCK E `no-restricted-imports` rule is **extended** rather than duplicated (because per-rule, the later config block's `paths[]` REPLACES the earlier -- see RESEARCH.md line 649). Add the 5 marker names to the same `paths[]` array, expanding `ignores:` to include `tests/architecture/markers-snapshot.test.ts`:

```javascript
{
  files: ["extensions/pi-claude-marketplace/**/*.ts", "tests/**/*.ts"],
  ignores: [
    "extensions/pi-claude-marketplace/platform/pi-api.ts",
    "extensions/pi-claude-marketplace/shared/markers.ts",
    "tests/architecture/markers-snapshot.test.ts",
    "tests/architecture/no-legacy-markers.test.ts",
  ],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          { name: "@earendil-works/pi-coding-agent", message: "..." },
          // NEW Wave 1 D-13-09 entries -- 3 path variants:
          { name: "../shared/markers.ts", importNames: [/* 5 names */], message: "..." },
          { name: "../../shared/markers.ts", importNames: [/* 5 names */], message: "..." },
          { name: "../../extensions/pi-claude-marketplace/shared/markers.ts", importNames: [/* 5 names */], message: "..." },
        ],
      },
    ],
  },
},
```

**Recommendation (RESEARCH.md line 721):** prefer the `patterns:` form (regex/glob) over `paths:` for the marker restriction -- `paths[].name` is exact-string match against the import specifier, and the codebase uses 3 relative-path variants. Planner should benchmark both forms during Wave 1 against the actual import sites and pick whichever lints cleanly.

**Diff intent (Wave 3 atomic commit):** Remove the 5 marker-name entries from `paths` (or the `patterns` block) and remove the snapshot-test path from `ignores`. The Pi-peer-import restriction stays.

---

### MODIFIED: `docs/messaging-style-guide.md` (Wave 1)

**Self-precedent:** frontmatter lines 1-17.

**Existing** (`docs/messaging-style-guide.md:1-17`):

```yaml
---
version: 1.0
status_tokens:
  - installed
  - updated
  - uninstalled
  - added
  - removed
  - available
  - unavailable
  - upgradable
  - skipped
  - failed
  - rollback failed
  - manual recovery
  - no marketplaces
  - no plugins
```

**Diff intent (Wave 1, D-13-20):**
1. Add `  - reinstalled` to the `status_tokens:` block (recommended position: after `  - updated`, byte-equal ordering to `shared/grammar/status-tokens.ts` after its same edit).
2. Add a `reinstalled` row to the section 3 status-tokens table with the operator-mental-model `"operation just ran: reinstall partition"`.

---

### MODIFIED: `docs/prd/pi-claude-marketplace-prd.md` section 6.12 (Wave 3 atomic commit)

**Diff intent:** Per D-13-11, rewrite the ES-5 row to a brief pointer: `"v1.3 supersedes the V1 ES-5 marker strings; see docs/messaging-style-guide.md section 15 (Supersession of ES-5) for the replacement table."` The PRD-extraction helper `tests/helpers/prd-extract.ts::extractEs5MarkerLiterals` will return 0 literals after this edit -- `markers-snapshot.test.ts` lines 42-46 (the `literals.length === 5` assertion) are deleted in the same commit.

---

## Shared Patterns

### Single-callsite-`ctx.ui.notify` discipline (D-07)

**Source:** `shared/notify.ts:48-90`
**Apply to:** Every new presentation composer and every orchestrator callsite touched in Phase 13.

```typescript
// shared/notify.ts -- the SOLE sanctioned ctx.ui.notify call site (D-07).
export function notifySuccess(ctx: ExtensionContext, message: string): void { /* ... */ }
export function notifyWarning(ctx: ExtensionContext, message: string): void { /* ... */ }
export function notifyError(ctx: ExtensionContext, message: string, cause?: unknown): void { /* ... */ }
export function notifyUsageError(ctx: ExtensionContext, message: string, usageBlock: string): void { /* ... */ }
```

**Apply rule:** Composers return `string` (or `{message, severity}` for `cascadeSummary`). Orchestrators destructure (where applicable) and call the matching wrapper. **Never** call `ctx.ui.notify` from any other file (BLOCK A in `eslint.config.js:86-127` enforces this structurally).

---

### `as const` + literal-union discriminator (D-CMC-03)

**Source:** `shared/grammar/status-tokens.ts:37-54` + `presentation/plugin-list.ts:45`
**Apply to:** `RowSpec` discriminated union in `presentation/compact-line.ts`.

```typescript
// shared/grammar/status-tokens.ts
export const STATUS_TOKENS = [
  "installed",
  "updated",
  // ...
] as const;
export type StatusToken = (typeof STATUS_TOKENS)[number];
```

```typescript
// presentation/plugin-list.ts:45
export type PluginRenderStatus = "installed" | "available" | "uninstallable";
```

**Apply rule:** RowSpec variants use `Extract<StatusToken, "installed" | "updated" | ...>` to narrow the closed status set per variant. Phase 12 `STATUS_TOKENS` provides the master closed set; `Extract<>` narrows it per row kind. The discriminant `kind` field is explicit per RESEARCH.md line 262 (vs. the inferred-union shape at `plugin-list.ts:45`).

---

### `assertNever` exhaustiveness check

**Source:** `shared/errors.ts:12`
**Apply to:** Every `switch` over `RowSpec.kind` and every `switch` over the existing `partition` discriminators.

```typescript
export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${String(x)}`);
}
```

**Apply rule:** `renderRow(row: RowSpec): string` ends with `default: return assertNever(row);` -- Phase 12 ESLint `strictTypeChecked` catches missing variants at compile time; `assertNever` is the runtime safety net.

---

### File-private literals for one-consumer constants (D-CMC-07)

**Source:** `presentation/reload-hint.ts:23` + `presentation/plugin-list.ts:22-30`

```typescript
// presentation/reload-hint.ts:23
const RELOAD_HINT_TRAILER = "/reload to pick up changes";

// presentation/plugin-list.ts:22-30 -- icons stay PRIVATE per the comment:
//   "Kept PRIVATE; the renderer maps status -> icon."
const ICON_INSTALLED = "●";
const ICON_AVAILABLE = "○";
const ICON_UNINSTALLABLE = "⊘";
const MAX_LINE_COLUMN = 66;
```

**Apply rule:** New presentation/ files declare their literals file-private (no export, no shared-grammar promotion) unless a SECOND consumer arrives. Phase 13 moves `ICON_*` from `plugin-list.ts` to `compact-line.ts` BECAUSE the second consumer arrives -- they now drive every plugin row across all surfaces.

---

### Static-audit test scaffolding (D-13-12)

**Source:** `tests/architecture/manifest-read-seam.test.ts` (whole file) + `tests/architecture/no-orchestrator-network.test.ts:62-93`

**Apply rule:** Wave 1 lands `tests/architecture/no-legacy-markers.test.ts` using:
1. `REPO_ROOT` constant via `fileURLToPath(import.meta.url)` + `path.resolve`.
2. `collectTypeScriptFiles` recursive `readdir` (rename to `walkTs` per RESEARCH.md naming).
3. Pinned-literal array (NOT imported from `markers.ts`) so Wave 3 deletion doesn't break the gate.
4. `ALLOW_LIST` Set with the 5 known-legitimate consumers.
5. `offenders` array + final `assert.deepEqual(offenders, [], ...)` pattern.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `tests/architecture/catalog-uat.test.ts` | byte-equality runner | extract fenced MD blocks then assert | No precedent for fenced-code-block extraction from `docs/output-catalog.md`. The closest analog (`tests/architecture/grammar-frontmatter.test.ts`) extracts a YAML frontmatter list. The catalog UAT must extract fenced ` ``` ` blocks beneath per-command H2 headings, pair each block with a programmatic fixture, and assert byte-equal. Planner / Wave 3 plan #1 must produce a fixture catalog (one fixture per fenced block) as a novel test artefact. Use `tests/helpers/prd-extract.ts` (Phase 1) as a structural reference for the regex-extraction style. |

All other files have at least one role-matched precedent in the codebase.

---

## Metadata

**Analog search scope:**
- `extensions/pi-claude-marketplace/presentation/` (renderer precedents)
- `extensions/pi-claude-marketplace/orchestrators/` (callsite precedents)
- `extensions/pi-claude-marketplace/shared/` (notify wrappers + assertNever + grammar)
- `tests/architecture/` (static-audit precedents)
- `tests/presentation/` (unit-test precedents)
- `tests/integration/` (integration-test precedents)
- `eslint.config.js` (rule-extension precedent)

**Files scanned:** ~40 source files + ~15 test files + 1 ESLint config + 2 binding contract MDs = ~58 files reviewed.

**Pattern extraction date:** 2026-05-23.

**Key precedent files for the planner to load (concrete file paths):**

- `/home/acolomba/pi-claude-marketplace/extensions/pi-claude-marketplace/presentation/plugin-list.ts` (lines 1-182 -- the keystone analog for `compact-line.ts`)
- `/home/acolomba/pi-claude-marketplace/extensions/pi-claude-marketplace/presentation/marketplace-list.ts` (lines 1-82 -- analog for marketplace row rendering)
- `/home/acolomba/pi-claude-marketplace/extensions/pi-claude-marketplace/presentation/reload-hint.ts` (lines 1-57 -- Wave 1 one-line edit + composer shape)
- `/home/acolomba/pi-claude-marketplace/extensions/pi-claude-marketplace/presentation/soft-dep.ts` (lines 1-7 -- 7-line shim; soft-dep helper consumer pattern)
- `/home/acolomba/pi-claude-marketplace/extensions/pi-claude-marketplace/presentation/index.ts` (lines 1-15 -- barrel)
- `/home/acolomba/pi-claude-marketplace/extensions/pi-claude-marketplace/shared/notify.ts` (lines 1-90 -- four-wrapper + `notifyError` body to rewrite)
- `/home/acolomba/pi-claude-marketplace/extensions/pi-claude-marketplace/shared/markers.ts` (lines 1-37 -- Wave 3 atomic delete target)
- `/home/acolomba/pi-claude-marketplace/extensions/pi-claude-marketplace/shared/grammar/status-tokens.ts` (lines 1-54 -- Wave 1 add `reinstalled`)
- `/home/acolomba/pi-claude-marketplace/extensions/pi-claude-marketplace/shared/errors.ts` (lines 1-14 -- `errorMessage` + `assertNever`)
- `/home/acolomba/pi-claude-marketplace/extensions/pi-claude-marketplace/platform/pi-api.ts` (lines 40-114 -- soft-dep probes + warning-helper aggregated trailers to retire)
- `/home/acolomba/pi-claude-marketplace/extensions/pi-claude-marketplace/orchestrators/types.ts` (lines 12-87 -- tag-union precedent)
- `/home/acolomba/pi-claude-marketplace/extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts` (lines 443-478 -- `formatErrorWithCauses` to relocate)
- `/home/acolomba/pi-claude-marketplace/extensions/pi-claude-marketplace/orchestrators/plugin/install.ts` (lines 657-691 -- sub-wave 2b single-plugin success callsite)
- `/home/acolomba/pi-claude-marketplace/extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts` (lines 215-220 -- sub-wave 2a cascade callsite)
- `/home/acolomba/pi-claude-marketplace/extensions/pi-claude-marketplace/orchestrators/plugin/list.ts` (lines 262-270 -- sub-wave 2d callsite)
- `/home/acolomba/pi-claude-marketplace/extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts` (lines 135-142 -- sub-wave 2c callsite)
- `/home/acolomba/pi-claude-marketplace/extensions/pi-claude-marketplace/orchestrators/marketplace/remove.ts` (lines 245-279 -- sub-wave 2c CMC-31 conditional)
- `/home/acolomba/pi-claude-marketplace/extensions/pi-claude-marketplace/orchestrators/marketplace/autoupdate.ts` (lines 92-142 -- sub-wave 2c callsite)
- `/home/acolomba/pi-claude-marketplace/extensions/pi-claude-marketplace/orchestrators/import/execute.ts` (lines 555-578 -- sub-wave 2a 3-way severity branch)
- `/home/acolomba/pi-claude-marketplace/tests/architecture/manifest-read-seam.test.ts` (lines 1-57 -- static-audit recursive scan precedent)
- `/home/acolomba/pi-claude-marketplace/tests/architecture/no-orchestrator-network.test.ts` (lines 1-93 -- allow-list + offenders precedent)
- `/home/acolomba/pi-claude-marketplace/tests/architecture/grammar-frontmatter.test.ts` (lines 36-60 -- MD extraction precedent)
- `/home/acolomba/pi-claude-marketplace/tests/architecture/markers-snapshot.test.ts` (lines 49-55 -- Wave 3 atomic delete target)
- `/home/acolomba/pi-claude-marketplace/tests/presentation/plugin-list.test.ts` (lines 1-95 -- presentation unit-test pattern)
- `/home/acolomba/pi-claude-marketplace/tests/presentation/reload-hint.test.ts` (lines 1-30 -- single-purpose presentation unit-test pattern)
- `/home/acolomba/pi-claude-marketplace/eslint.config.js` (lines 258-278 -- BLOCK E `no-restricted-imports` precedent)
- `/home/acolomba/pi-claude-marketplace/docs/messaging-style-guide.md` (lines 1-17 -- frontmatter to extend with `reinstalled`)
