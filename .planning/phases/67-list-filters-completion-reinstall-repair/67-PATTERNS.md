# Phase 67: List Filters, Completion & Reinstall Repair - Pattern Map

**Mapped:** 2026-06-27
**Files analyzed:** 9 modified (no new files) + 2 cross-cutting test/doc surfaces
**Analogs found:** 9 / 9 (every change has an in-file analog)

This is a Surface/UX phase. Every target file is MODIFIED; the analog for each
is the existing in-file construct the change extends. Code excerpts below are
the exact insertion/modification points with the sibling block to copy from.

---

## File Classification

| Modified File | Role | Data Flow | In-File Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `edge/handlers/plugin/list.ts` | edge handler (flag shim) | request-response | `--available` / `--unavailable` token-switch arm | exact |
| `orchestrators/plugin/list.ts` | orchestrator (filter) | CRUD/read-only | `shouldShow` + `ListPluginsOptions` filter fields | exact (hidden dependency — see §A) |
| `edge/completions/provider.ts` | completion provider | request-response | list-flag block + reinstall `--force` entry + positional special-case | exact |
| `edge/completions/data.ts` | completion data source | CRUD/read-only | `getInstallPluginToMarketplacesMap` status narrowing | role-match (see §C caveat) |
| `edge/handlers/plugin/reinstall.ts` | edge handler (flag shim) | request-response | the `--force` parse loop + `extractLocalFlag([...])` call | exact (removal) |
| `orchestrators/plugin/reinstall.ts` | orchestrator | CRUD | `force?: boolean` option + `replaceAll(handles, force, …)` | exact (removal) |
| `edge/router.ts` | router (usage const) | static | `TOP_LEVEL_USAGE` reinstall line | exact |
| `docs/output-catalog.md` | doc (byte contract) | static | reinstall H2 section | exact |
| `docs/messaging-style-guide.md` | doc (byte contract) | static | reinstall variant rows | exact |
| `tests/edge/handlers/plugin/reinstall.test.ts` + `tests/edge/completions/provider.test.ts` + `tests/architecture/catalog-uat.test.ts` | test | assertion | existing byte/regex assertions | exact |

---

## §A. CRITICAL hidden dependency — the real `--unsupported`/widened-`--installed` logic lives in the ORCHESTRATOR, not the edge handler

CONTEXT names `edge/handlers/plugin/list.ts` (BOOLEAN_FLAGS) but that shim only
TOKENIZES flags and forwards booleans. The realized filter is
`shouldShow()` in `orchestrators/plugin/list.ts`. BOTH files must change in
lockstep, plus `ListPluginsOptions`. The planner MUST allocate both.

### `edge/handlers/plugin/list.ts` (edge flag shim)

**Analog — the `BOOLEAN_FLAGS` set (line 24):**
```typescript
const BOOLEAN_FLAGS = new Set(["--installed", "--available", "--unavailable"]);
```
Insertion: add `"--unsupported"`. (Note: this `BOOLEAN_FLAGS` set is exported at
line 83 "for potential reuse by completions provider" but is NOT currently
imported by provider.ts — verify before relying on it as the single source.)

**Analog — the token switch (lines 44-62):** each boolean has a local `let` + a
switch arm. Copy the `--unavailable` arm verbatim for `--unsupported`:
```typescript
    let installed = false;
    let available = false;
    let unavailable = false;
    const nonFlagPositionals: string[] = [];
    for (const token of parsed.positional) {
      if (token === "--installed") {
        installed = true;
      } else if (token === "--available") {
        available = true;
      } else if (token === "--unavailable") {
        unavailable = true;
      } else if (token.startsWith("--")) {
        notifyUsageError(ctx, { message: `Unknown option: "${token}".`, usage: USAGE });
        return;
      } else {
        nonFlagPositionals.push(token);
      }
    }
```
Add `let unsupported = false;` and an `else if (token === "--unsupported")` arm.

**Analog — the forwarding spread (lines 69-78):**
```typescript
    await listPlugins({
      ...
      ...(installed && { installed: true }),
      ...(available && { available: true }),
      ...(unavailable && { unavailable: true }),
    });
```
Add `...(unsupported && { unsupported: true }),`.

**Analog — the `USAGE` const (lines 21-22):** add `[--unsupported]` to the usage
string to match the new flag (byte-contract: keep ordering consistent with
docs).

### `orchestrators/plugin/list.ts` (where the filter is REALIZED)

**Analog — `ListPluginsOptions` filter fields (lines 137-142):**
```typescript
  /** PL-1 union filter: include installed plugins. */
  readonly installed?: boolean;
  /** PL-1 union filter: include available (not-yet-installed installable) plugins. */
  readonly available?: boolean;
  /** PL-1 union filter: include uninstallable (⊘) plugins. */
  readonly unavailable?: boolean;
```
Add `readonly unsupported?: boolean;`.

**Analog — `filtersPassive` (lines 149-151):**
```typescript
function filtersPassive(opts: ListPluginsOptions): boolean {
  return opts.installed !== true && opts.available !== true && opts.unavailable !== true;
}
```
Widen the conjunction with `&& opts.unsupported !== true`.

**Analog — `shouldShow` (lines 153-174) — THE load-bearing change for D-67-01:**
```typescript
function shouldShow(opts: ListPluginsOptions, status: PluginRenderStatus): boolean {
  if (filtersPassive(opts)) {
    return true;
  }

  if (
    opts.installed === true &&
    (status === "installed" || status === "upgradable" || status === "disabled")
  ) {
    return true;
  }

  if (opts.available === true && status === "available") {
    return true;
  }

  if (opts.unavailable === true && status === "unavailable") {
    return true;
  }

  return false;
}
```
Two D-67-01 edits, both mirroring the existing arms:
1. **Widen `--installed`** to span `force-installed` + `force-upgradable` (the
   Phase 66 derived inventory states; per D-67-01 force-installed is reached by
   `--installed`). Add to the installed-arm disjunction:
   `|| status === "force-installed" || status === "force-upgradable"`.
   Precedent for treating these as installed inventory already exists in the
   fold-carryover filter at lines 798-805.
2. **Add `--unsupported` arm** (copy the `--unavailable` arm shape). Per D-67-01
   it targets `available-but-partial` rows. NOTE the realized-state nuance: on
   the list surface today `availableRowMessage` collapses resolver
   `unsupported` INTO the `(unavailable)` row (lines 449-466, "D-64-01: both
   `unsupported` and `unavailable` map to the `(unavailable)` row this phase").
   There is currently NO distinct `unsupported` not-installed status emitted on
   the list surface. The planner must decide whether D-67-01's `--unsupported`
   filter requires `availableRowMessage` to first split out an `unsupported`
   not-installed status (it likely does — there is no row for the filter to
   select otherwise). This is the single biggest open design point in the phase.

**Reference — `PluginRenderStatus` (lines 103-115)** already enumerates
`force-installed` / `force-upgradable`; its doc comment at lines 109-113 says
"the `--installed` filter spanning them is LIST-01 (a later phase)" — THIS phase
is that later phase; update the comment when the filter lands.

---

## §B. `edge/completions/provider.ts` — three edits, all with in-file analogs

### B1. Remove reinstall `--force` flag entry (D-67-03)

**Analog — `flagCompletions` reinstall block (lines 93-99):**
```typescript
  if (positionalHead === "reinstall") {
    flags.push({
      name: "--force",
      description:
        "Allow overwriting agents that previously had foreign content from this plugin's own install",
    });
  }
```
DELETE this entire block (reinstall no longer accepts `--force`).

### B2. Remove reinstall positional-extraction special-case (D-67-03)

**Analog — the `extractPositionals` reinstall guard (lines 260-261):**
```typescript
  const rawHead = extractPositionals(tokens)[0] ?? "";
  const positionals = extractPositionals(tokens, rawHead === "reinstall" ? ["--force"] : []);
```
Per the integration-point note in CONTEXT, drop the reinstall `["--force"]`
special-case. If no other head needs flag-stripping, this collapses to
`const positionals = extractPositionals(tokens);` — but VERIFY no other caller
relies on `rawHead`. (The install/update `--map-model` and `--scope` are handled
elsewhere; confirm `extractPositionals`'s second arg is only used for reinstall.)

### B3. Add `--force`-gated candidate narrowing for install/update (D-67-02)

**Analog — the install/update `--map-model` block (lines 109-117)** shows the
established pattern for surfacing flags under the install/update heads:
```typescript
  if (positionalHead === "install" || positionalHead === "update") {
    flags.push({
      name: "--map-model",
      description: "Enable model field mapping in generated agents (default: omit)",
    });
  }
```
Add a sibling `--force` flag entry under install/update (Phase 65 owns the
runtime `--force`; this surfaces it in completion). Mirror the
`MARKETPLACE_VERBS_WITH_NAME_ARG` Set idiom (lines 60-67) if a presence-detector
set is wanted.

**Analog — the `--force`-position detection** must reuse the same parse the
install/update handlers use (CONTEXT integration point: "Completion `--force`
detection must align with the install/update `--force` parsing added in Phase
65"). The candidate-set switch happens in `getPluginRefCompletions` /
`pluginRefBranchConfig` (lines 189-245) — the existing `targetScope` threading
through `PluginRefBranchConfig` (lines 183-187) is the analog for threading a
new `force` discriminator into the data layer.

---

## §C. `edge/completions/data.ts` — candidate-set source (D-67-02)

**Analog — `getInstallPluginToMarketplacesMap` status narrowing (lines 297-318):**
```typescript
    for (const row of rows) {
      if (row.status !== "available" || targetInstalled.has(row.name)) {
        continue;
      }
      addMapping(result, row.name, source.marketplace);
    }
```
and the installed-mode sibling (lines 336-342):
```typescript
      for (const row of rows) {
        if (row.status !== "installed") {
          continue;
        }
        addMapping(result, row.name, mp);
      }
```
These two `row.status !== X` guards are the exact narrowing pattern a
`--force`-gated variant would copy: install-force = `available` + `unsupported`;
update-force = `upgradable` + `force-upgradable`.

**CAVEAT — D-67-02's "reuse the SAME Phase 66 classification" is NOT free at this
layer.** The completion index `PluginIndexRow.status` is a 3-value union only:
`completion-cache.ts:96` →
```typescript
  readonly status: "installed" | "available" | "unavailable";
```
and the producer `loadManifestForMarketplace` in
`orchestrators/edge-deps.ts:142-168` collapses resolver `unsupported` INTO
`unavailable` (line 152-154: "D-64-01: both `unsupported` and `unavailable` map
to the `unavailable` completion bucket") and never computes `upgradable` /
`force-upgradable` at all. So sourcing `available + unsupported` and
`upgradable + force-upgradable` candidate sets requires WIDENING that status
union (in `completion-cache.ts:78` TypeBox schema + `:96` type + the
`loadManifestForMarketplace` producer) to carry the derived states — OR
threading the list orchestrator's `installedRowMessage`/`availableRowMessage`
classification (orchestrators/plugin/list.ts:246-497) into the completion path.

The list orchestrator is the ONLY place today that derives `unsupported` /
`upgradable` / `force-upgradable` for not-installed and installed entries
(`availableRowMessage` resolver switch at lines 441-471; `installedRowMessage`
force-state derivation at lines 306-355). D-67-02 ("no independent
classification inside the completion provider") points at reusing THAT logic.
Planner decision required: widen the index status union vs. share the list
classifier. Either way the analog to copy is the resolver `switch
(resolved.state)` at orchestrators/plugin/list.ts:441-471.

---

## §D. `edge/handlers/plugin/reinstall.ts` — remove `--force` (D-67-03)

**Analog — the `extractLocalFlag` pass-through list (lines 31-36):**
```typescript
    // Shared scanner; see edge/handlers/shared.ts. `--force` is
    // downstream-consumed; pass through verbatim.
    const localFlag = extractLocalFlag(args, ctx, USAGE, ["--force"]);
    if (localFlag === undefined) {
      return;
    }
```
Change `["--force"]` → `[]` (or whatever the no-passthrough form is) so `--force`
is no longer recognized as a known flag. Then it falls into the
`token.startsWith("--")` UNKNOWN arm below → "Unknown option" usage error
(exactly D-67-03's "errors as an UNKNOWN flag").

**Analog — the `force` parse loop (lines 46-57):**
```typescript
    let force = false;
    const refs: string[] = [];
    for (const token of parsed.positional) {
      if (token === "--force") {
        force = true;
      } else if (token.startsWith("--")) {
        notifyUsageError(ctx, { message: `Unknown option: "${token}".`, usage: USAGE });
        return;
      } else {
        refs.push(token);
      }
    }
```
DELETE `let force = false;` and the `if (token === "--force")` arm so `--force`
hits the `else if (token.startsWith("--"))` UNKNOWN arm. Resulting loop mirrors
the list.ts non-flag loop shape after its boolean arms.

**Analog — the orchestrator-call spread (lines 69-77):**
```typescript
    await reinstallPlugins({
      ...
      ...(force && { force: true }),
      ...(localFlag.local && { local: true }),
    });
```
DELETE the `...(force && { force: true }),` line.

**Analog — the `USAGE` const (lines 24-25):**
```typescript
const USAGE =
  "Usage: /claude:plugin reinstall [<plugin>@<marketplace> | @<marketplace>] [--scope user|project] [--force] [--local]";
```
DELETE the ` [--force]` token. Header comment at lines 9-11 ("Reinstall
additionally accepts a command-specific `--force` flag…") must also be removed.

---

## §E. `orchestrators/plugin/reinstall.ts` — make overwrite unconditional (D-67-03)

**Analog — `ReinstallPluginOptions.force` (line 149) and
`ReinstallPluginsOptions.force` (line 180):**
```typescript
  readonly force?: boolean;
```
DELETE both option fields.

**Analog — `reinstallPlugins` per-target relay (line 458):**
```typescript
          ...(opts.force === undefined ? {} : { force: opts.force }),
```
DELETE this spread line in the `reinstallPlugin({...})` call.

**Analog — `runLockedReinstall` destructure + `replaceAll` call (lines 1124,
1155-1160):**
```typescript
  const { scope, cwd, marketplace, plugin, force } = opts;
  ...
  const replacements = await replaceAll(handles, force, {
    locations, cwd, plugin, installable,
  });
```
Remove `force` from the destructure; change the `replaceAll` signature/call to
drop the `force` param.

**Analog — `replaceAll` signature + the agents force branch (lines 1329-1343):**
```typescript
async function replaceAll(
  handles: PreparedHandles,
  force: boolean | undefined,
  hooks: HooksReplaceArgs,
): Promise<readonly ReplacementEntry[]> {
  ...
    const agents = await replacePreparedAgents(
      handles.agents,
      force === undefined ? {} : { force },
    );
```
Make overwrite UNCONDITIONAL: drop the `force` param and pass
`{ force: true }` (or the unconditional-overwrite form `replacePreparedAgents`
expects) so reinstall always overwrites collisions + foreign content. VERIFY
`replacePreparedAgents`'s options shape in `bridges/agents/index.ts` — the
`{ force }` object is the foreign-content overwrite gate; the new contract is
"always overwrite". Confirm no other `replacePrepared*` bridge reads a force
flag (only agents does here).

---

## §F. `edge/router.ts` — reinstall help line (D-67-03)

**Analog — `TOP_LEVEL_USAGE` reinstall line (line 93):**
```typescript
  "  reinstall [<plugin>@<marketplace> | @<marketplace>] [--scope user|project] [--force]\n" +
```
DELETE the ` [--force]` token. Adjacent lines (90-99) are the formatting analog —
keep column alignment consistent with the `update` line directly above (line 92,
which has NO `--force`).

---

## §G. Byte-contract surfaces (lockstep, D-67-04)

### Docs — `docs/output-catalog.md`
The reinstall H2 section begins at line 550 (`## /claude:plugin reinstall`).
`--force` is NOT in the cascade fixtures (it was a runtime flag, not rendered),
so the catalog edits are limited to any usage/flag prose mentioning reinstall
`--force`. Add `--unsupported` list-filter coverage if the catalog documents
list filter flags. The list-surface force-state rows are documented around
line 420 (`(force-installed)` glyph). Grep `--force` and `reinstall` across the
file before editing; keep every fenced `<!-- catalog-state: … -->` block
byte-stable unless its rendered output actually changes (it does not for a flag
removal).

### Docs — `docs/messaging-style-guide.md`
Reinstall variant rows at lines 39, 65, 81. No `--force` byte appears in the
rendered grammar; edits are prose-only if the guide references reinstall
`--force` semantics. Mirror how Phases 65.1 / 66 touched this file (per D-67-04).

### Test — `tests/architecture/catalog-uat.test.ts` (the byte-equality runner)
This is the binding gate. It reads `docs/output-catalog.md`, extracts every
`<!-- catalog-state: STATE -->` fenced block per H2 section
(`loadCatalogExamples`, lines 74-90), and asserts byte equality vs `notify()`
output. **Analog assertion structure** (the FIXTURES-map + driver-loop pattern,
documented lines 16-34): each `(section, state)` tuple pairs a catalog block
with a `NotificationMessage` fixture. Because `--force` removal changes NO
rendered bytes (it was never in cascade output), NO new catalog-uat fixtures are
required for D-67-03 — but if D-67-01 introduces a new not-installed
`unsupported` list row, a new `(section, state)` fixture + catalog block pair is
needed. The runner picks up new blocks automatically once both sides agree.

### Test — `tests/edge/handlers/plugin/reinstall.test.ts` (usage byte assertions)
**Analog assertion (regex, NOT literal full-string), line 279:**
```typescript
assert.match(notifications[0]?.message ?? "", /Usage: \/claude:plugin reinstall/, args);
```
The usage assertions are PREFIX regexes, so they survive the `[--force]` removal.
**BUT two tests assert the OLD `--force` SUCCESS behavior and MUST be rewritten
to the new "UNKNOWN flag" contract:**
- `shim :: --force works before and after reinstall ref` (lines 216-269) — both
  `--force` invocations currently expect `(reinstalled)` success
  (lines 251-254, 264-267). Under D-67-03 `--force` must now error as UNKNOWN.
  Rewrite to assert the usage error, OR repurpose to prove unconditional
  overwrite WITHOUT `--force` (the `defaultAttempt` at line 226, currently
  expecting `(failed)`, should now succeed with `(reinstalled)` since overwrite
  is unconditional — this is the positive proof of D-67-03).
- `PRL-01` loop (lines 271-283) already includes `"--force=true"` in its
  UNKNOWN-flag-usage cases (line 274) — `"--force"` (bare) should be ADDED to
  that array as the new canonical UNKNOWN case. **Analog to copy:** the loop body
  at lines 275-281.
- `USAGE string contains [--local]` (line 300-308) asserts `/\[--local\]/`; add a
  companion `assert.doesNotMatch(..., /\[--force\]/)` to lock the removal.

### Test — `tests/edge/completions/provider.test.ts`
**Analog assertions to UPDATE:**
- `PRL-16 :: reinstall flag completion includes --force only for reinstall`
  (lines 343-356) — currently asserts `reinstallItems.some(i => i.label ===
  "--force")` (line 349). MUST flip to assert `--force` is ABSENT for reinstall
  (and the install/update `some(--force)` presence per D-67-02). This is the
  direct inverse of the existing assertion; copy its structure (lines 347-356).
- `PRL-16 :: reinstall --force completion still reaches installed refs`
  (lines 963-983) — drives `getArgumentCompletions("reinstall --force ", …)`
  (line 970) expecting `["reinstall --force solo@mp "]`. Under D-67-03 `--force`
  is no longer a reinstall token; this test must be removed or rewritten (bare
  `reinstall ` already covered at lines 934-961).
- `TC-3 :: - prefix on list head` (lines 243-256) asserts the list flag set
  `["--scope", "--installed", "--available", "--unavailable"]` (line 250) — ADD
  `"--unsupported"` to this expectation (and the ls-alias twin at lines 258-265).
  This is the byte-contract assertion for the new list filter.

---

## Shared Patterns

### Comment / test-title traceability anchors
**Source:** `.claude/rules/typescript-comments.md` + CONTEXT line 126-128.
**Apply to:** every edited file.
Use decision/requirement IDs only — `D-67-01..04`, `LIST-01`, `LIST-02`,
`RINST-01`, `NFR-N`. NEVER `Phase 67` / `Plan NN` / `Wave N`. The existing files
already follow this (e.g. list.ts comments cite `D-66-01`, `FSTAT-02`,
`RLD-04`); match that style exactly.

### Optional-field spread idiom
**Source:** every handler/orchestrator here.
**Apply to:** all flag-forwarding edits.
The repo-wide pattern for optional bag fields is the conditional spread
`...(flag && { flag: true })` (list.ts:75-77, reinstall.ts:74-77). Adding a
field = add a spread; removing one = delete the spread line. Do NOT introduce
`flag: false` defaults.

### `notifyUsageError` UNKNOWN-flag arm
**Source:** list.ts:55-58, reinstall.ts:51-53.
**Apply to:** reinstall `--force` removal.
The canonical "unknown long flag" rejection is:
```typescript
} else if (token.startsWith("--")) {
  notifyUsageError(ctx, { message: `Unknown option: "${token}".`, usage: USAGE });
  return;
}
```
Removing `--force`'s dedicated arm makes it fall through to THIS arm — that IS
the D-67-03 "errors as UNKNOWN flag" behavior. No new error path is written.

---

## No Analog Found

None. Every change extends or deletes an existing in-file construct; this is a
pure surface/flag phase with no novel role or data flow.

---

## Metadata

**Analog search scope:** `extensions/pi-claude-marketplace/edge/`,
`extensions/pi-claude-marketplace/orchestrators/plugin/`,
`extensions/pi-claude-marketplace/shared/`, `tests/edge/`,
`tests/architecture/`, `docs/`.
**Key cross-file dependency surfaced:** the edge `list.ts` flag shim is inert
without the `orchestrators/plugin/list.ts` `shouldShow` change (§A); the
completion `data.ts` candidate-set widening is blocked by the 3-value
`PluginIndexRow.status` union in `completion-cache.ts` + `edge-deps.ts` (§C).
**Pattern extraction date:** 2026-06-27
