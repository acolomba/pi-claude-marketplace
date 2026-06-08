# Phase 50: Notification Summary-Line Grammar - Research

**Researched:** 2026-06-08
**Domain:** Surgical correctness fix to an existing, mature, single-file notification module (`shared/notify.ts`) plus a lockstep catalog/fixture byte-rewrite.
**Confidence:** HIGH (the entire defect, its fix seam, and every emission/catalog/test touchpoint were read in source this session — no library research or external version checks are relevant).

## Summary

The v1.10 milestone added a dedicated `MarketplaceNotAddedMessage` variant (`kind: "marketplace-not-added"`) and routed every marketplace-absent precondition across the full op matrix (install / uninstall / reinstall / update / marketplace update / marketplace remove / autoupdate) through it, plus a failed `plugin-info` surface (`{invalid manifest}` / `{not in manifest}` / `{unreadable}`). All of these route through `notify()`'s `isInfoKind` early-dispatch into `dispatchInfoMessage`, which emits **body-only** — it computes severity (`"error"` for these kinds) and calls `ctx.ui.notify(body, severity)` with `body` being the bare rendered row, never prepending a summary line. The cascade arm of `notify()` (the other branch) DOES prepend a summary: `${buildSummaryLine(message, severity)}\n\n${withHint}`. This divergence is the defect: the host's `Error:`/`Warning:` label glues directly onto the cascade row, producing `Error: ⊘ ghost-mp [project] (failed) {not added}` instead of a summary line with the row as a separate block below.

`buildSummaryLine` already exists and works for cascade kinds (counting failed/skipped plugin and marketplace operations). For the standalone kinds it explicitly returns `""` (a defensive short-circuit guarded by `isInfoKind`). The fix is to (1) make `dispatchInfoMessage` route its error/warning emissions through the same summary-prepend path the cascade arm uses, and (2) teach `buildSummaryLine` to return a non-empty failed-subject summary for the standalone error/warning kinds (`marketplace-not-added` → `N marketplace operation(s) failed.`; failed `plugin-info` → `N plugin operation(s) failed.`). The catalog (`docs/output-catalog.md`, ~9 annotated fence bodies across the matrix) and the `catalog-uat` fixtures encode the broken glued single-line form as GREEN, so they must be corrected to the new two-block byte forms **in the same atomic commit** — the byte-equality gate would go RED between a code-only change and the corrected fixtures.

**Primary recommendation:** Unify on a single summary-emission helper inside `notify()`. Extract the cascade arm's `${summary}\n\n${body}` composition into a shared path that BOTH the cascade arm and `dispatchInfoMessage` call for error/warning severity; extend `buildSummaryLine` with non-empty returns for the two standalone error/warning kinds; rewrite the ~9 catalog fence bodies + their `catalog-uat` fixture expectations to the prefixed two-block form; add the cross-cutting grammar-invariant test. Land it all atomically.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Summary-line composition + emission | `shared/notify.ts` (the sole `ctx.ui.notify` site) | — | `notify.ts` is the single source of truth for the structured-notification surface; severity, summary, reload-hint, and the one sanctioned `ctx.ui.notify` call all live here (IL-2). No orchestrator emits a summary. |
| Failed-subject attribution (marketplace vs plugin) | `shared/notify.ts` (`buildSummaryLine` reading the message `kind`/embedded status) | Orchestrators (construct the correct variant) | The orchestrators already pick `marketplace-not-added` (marketplace subject) vs `plugin-info` failed (plugin subject) per the v1.10 ATTR-08 split. `buildSummaryLine` just reads which variant arrived; no orchestrator change needed. |
| Catalog byte contract | `docs/output-catalog.md` + `tests/architecture/catalog-uat.test.ts` | — | Byte-equality between `notify()` output and the catalog is the closed-loop user-contract gate. Both sides move together. |
| Grammar invariant enforcement | `tests/shared/notify-v2.test.ts` or a new `tests/shared/*.test.ts` (or `tests/architecture/`) | catalog-uat fixtures | The new cross-cutting invariant iterates catalog fixtures / drives `notify()` and asserts the two-block shape for every error/warning emission. |

## Standard Stack

No new dependencies. This phase touches existing source + docs + tests only.

| Component | Version | Purpose | Why Standard |
|-----------|---------|---------|--------------|
| TypeScript (strict) | `^5.9.x` (in repo) | Discriminated-union narrowing + `assertNever` exhaustiveness on `StandaloneKind` | Already the project language; the fix relies on exhaustive `switch` arms over `message.kind`. [VERIFIED: package.json, repo source] |
| node:test (built-in runner) | bundled (Node >= 20.19.0) | Test framework for the new grammar-invariant test + existing notify-v2 / catalog-uat | Existing test infrastructure; `npm test` runs `node --test "tests/{...}/**/*.test.ts"`. [VERIFIED: package.json:76] |

**No installation step. No `## Package Legitimacy Audit` needed — this phase installs nothing.**

## Architecture Patterns

### Current `notify()` dispatch flow (the seam to fix)

```
notify(ctx, pi, message)
  probe = softDepStatus(pi)                          // single probe
  if isInfoKind(message):                            // 5 standalone kinds
      dispatchInfoMessage(ctx, message, probe)       // <-- DEFECT LIVES HERE
      return                                          //     body-only emission
  switch(message.kind): case undefined|cascade: break // exhaustiveness gate
  // ---- cascade arm ----
  body = blocks.join("\n\n") or "(no marketplaces)"
  withHint = body [+ "\n\n" + RELOAD_HINT_TRAILER]
  severity = computeSeverity(message)
  if severity === undefined:
      ctx.ui.notify(withHint)                        // info: body only
  else:
      summarized = `${buildSummaryLine(message, severity)}\n\n${withHint}`  // <-- CORRECT
      ctx.ui.notify(summarized, severity)
```

`dispatchInfoMessage` (notify.ts:2229-2265) today:

```typescript
// renders body per kind via a switch (marketplace-info, plugin-info, ...,
// marketplace-not-added), then:
const severity = computeSeverity(message);
if (severity === undefined) {
  ctx.ui.notify(body);
} else {
  ctx.ui.notify(body, severity);   // <-- NO summary prepend -> the glued defect
}
```

The cascade arm (notify.ts:2324-2336) is the correct shape:

```typescript
const severity = computeSeverity(message);
if (severity === undefined) {
  ctx.ui.notify(withHint);
} else {
  const summarized = `${buildSummaryLine(message, severity)}\n\n${withHint}`;
  ctx.ui.notify(summarized, severity);
}
```

### Pattern 1: Single shared summary-emission path (GRAM-04)

**What:** Both the cascade arm and `dispatchInfoMessage` must emit through ONE helper so no standalone-kind path can drift back to a summary-less emission.
**When to use:** Every error/warning emission, standalone or cascade.
**Recommended shape:** Extract a file-private helper, e.g.

```typescript
function emitWithSummary(
  ctx: ExtensionContext,
  message: NotificationMessage,
  body: string,            // already-rendered body (cascade body+hint, or standalone row(s))
): void {
  const severity = computeSeverity(message);
  if (severity === undefined) {
    ctx.ui.notify(body);
  } else {
    ctx.ui.notify(`${buildSummaryLine(message, severity)}\n\n${body}`, severity);
  }
}
```

Both `dispatchInfoMessage` (passing the rendered standalone body) and the cascade arm (passing `withHint`) call this. This is the GRAM-04 "single shared code path" requirement made structural. [CITED: success criterion 4; notify.ts:2259-2264 vs 2324-2336]

### Pattern 2: Failed-subject summary attribution (GRAM-02 / ATTR-08)

**What:** `buildSummaryLine` must return a non-empty failed-subject summary for the standalone error/warning kinds, with the subject following the FAILED ROW, not the invoking command.
**Subject derivation (no orchestrator change needed):**
- `kind === "marketplace-not-added"` → subject is the marketplace → `"1 marketplace operation failed."` (count is always 1 — the variant carries exactly one absent marketplace).
- `kind === "plugin-info"` with `message.plugin.status === "failed"` → subject is the plugin → `"1 plugin operation failed."` (the failed `plugin-info` surface: `{invalid manifest}` / `{not in manifest}` / `{unreadable}` / `{unparseable}`). Count is always 1 — one plugin row.
- `kind === "plugin-info"` with non-failed status → info severity → never reaches the summary path (returns `""` is fine; the dispatcher won't prepend at info severity).
- `marketplace-info`, `marketplace-info-cascade`, `plugin-info-cascade` → always info severity → no summary (these route through the `severity === undefined` arm).

The existing `operationPhrase(count, kind)` helper (notify.ts:1690-1692) already produces `"N marketplace operation(s)"` / `"N plugin operation(s)"` with correct pluralization; reuse it. The verb is `"failed"` for these (they are error-severity). [CITED: success criterion 3; REQUIREMENTS GRAM-02; notify.ts ATTR-08 lineage in STATE.md Phase 46-49]

### Pattern 3: Atomic catalog/fixture/code/test landing (the v1.3 supersession lesson, re-applied)

**What:** The `catalog-uat` byte-equality gate compares `notify()` output against the catalog fence bodies. If code changes to prepend a summary but the catalog fence bodies still show the glued single line, the test goes RED. Therefore the code change, the `buildSummaryLine` extension, the ~9 catalog fence-body rewrites, the `catalog-uat` fixture (no fixture-data change needed — fixtures are unchanged; only the catalog fence bodies they byte-compare against change), and the new invariant test must land in ONE commit.
**Why:** No intermediate RED. [CITED: STATE.md v1.11 roadmap rationale; success criterion 5]

### Anti-Patterns to Avoid

- **Adding summary logic in `dispatchInfoMessage` independently of the cascade arm.** That re-creates the two-path divergence GRAM-04 forbids. Use ONE shared helper.
- **Changing the orchestrators.** The subject (marketplace vs plugin) is already correct at construction time (v1.10 ATTR-01..10). The summary subject is read off the arrived `kind`/embedded status; do not re-attribute in orchestrators.
- **Introducing a new REASONS member, status token, or row byte.** Out of scope (REQUIREMENTS Out of Scope). The `{not added}` row and `(failed)` token are correct; only the absent summary line is added above them.
- **Touching `computeSeverity`.** Severity routing is correct (REQUIREMENTS Out of Scope). The standalone error/warning kinds already compute `"error"`.
- **Counting more than 1 operation for the standalone kinds.** `marketplace-not-added` carries one marketplace; the failed `plugin-info` carries one plugin. Hard-coding `1` (or deriving from the single embedded row) is correct — do not reach for a cascade-style traversal.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pluralized "N plugin/marketplace operation(s)" | A new string formatter | Existing `operationPhrase(count, kind)` (notify.ts:1690) | Already produces the exact byte form; reuse keeps the wording identical to the cascade summaries. |
| Severity computation for standalone kinds | A new severity check | Existing `computeSeverity` (notify.ts:1560) | Already returns `"error"` for `marketplace-not-added` and for failed `plugin-info`; do not duplicate. |
| Standalone-kind enumeration | A new kind list | Existing `isInfoKind` / `StandaloneKind` (notify.ts:911-935) | Single-source guard with `assertNever` in all consumers; the new summary arm must narrow through the SAME guard so a future kind is a compile error. |

**Key insight:** Everything needed already exists in `notify.ts`. The fix is plumbing (route standalone error/warning emissions through the existing summary prepend) + a small extension to `buildSummaryLine`'s standalone arm (return the failed-subject phrase instead of `""`).

## Runtime State Inventory

This is NOT a rename/refactor/migration phase — it is a pure source/doc/test correctness fix. No stored data, no live service config, no OS-registered state, no secrets, no build artifacts carry any string that this phase renames.

- **Stored data:** None — verified by reading the type model; no persisted field changes.
- **Live service config:** None — verified; no external service involved.
- **OS-registered state:** None — verified; notification grammar is pure output.
- **Secrets/env vars:** None — verified.
- **Build artifacts:** None — verified; no package rename, no `pyproject`/`package.json` name change.

## Common Pitfalls

### Pitfall 1: catalog-uat byte gate goes RED mid-change

**What goes wrong:** Editing `notify.ts` to prepend the summary while the catalog fence bodies still show the glued single line makes `tests/architecture/catalog-uat.test.ts` fail (byte-mismatch on every `marketplace-not-added` and failed `plugin-info` state).
**Why it happens:** The catalog encodes the OLD (broken) byte form. The byte-equality driver (catalog-uat.test.ts:2143-2160) compares `notify()` output to the fence body exactly.
**How to avoid:** Land code + `buildSummaryLine` + all ~9 catalog fence-body rewrites + the new test in one atomic commit. The fixtures themselves (FIXTURES map) do NOT change — only the catalog fence bodies that they byte-compare against.

### Pitfall 2: the failed `plugin-info` body is multi-line, not a single row

**What goes wrong:** Assuming every standalone error emission is a one-line row. The `manifest-invalid` state (catalog-uat.test.ts:1552; catalog line 1016-1019) is a `plugin-info` with `plugin.status: "failed"` and renders THREE lines:
```
● bad-mp [user] <no autoupdate>
  ⊘ bad-mp (failed) {invalid manifest}
    components: not resolved
```
**How to avoid:** The summary line is prepended ABOVE the whole multi-line body as its own block: `{summary}\n\n{multi-line body}`. After the fix the `manifest-invalid` fence body becomes:
```
1 plugin operation failed.

● bad-mp [user] <no autoupdate>
  ⊘ bad-mp (failed) {invalid manifest}
    components: not resolved
```
Verify the same for `missing-plugin-not-in-manifest` (catalog-uat.test.ts:1730).

### Pitfall 3: `marketplace-info-cascade` / `plugin-info-cascade` must NOT gain a summary

**What goes wrong:** Over-applying the summary to all standalone kinds. The two fan-out cascade wrappers and the success `marketplace-info` / non-failed `plugin-info` are INFO severity — they route through the `severity === undefined` arm and emit body-only. The invariant is "every ERROR/WARNING notification has a summary," not "every standalone kind."
**How to avoid:** Drive the summary off `computeSeverity(message)`; only the error/warning branch prepends. The info branch is byte-unchanged.

### Pitfall 4: the new summary verb is always "failed" for these kinds

**What goes wrong:** Reaching for the warning verb (`"skipped"`). The standalone error/warning kinds in scope all compute `"error"` (marketplace absent / manifest unreadable are failures). `buildSummaryLine`'s existing `verb = severity === "error" ? "failed" : "skipped"` already handles this; pass the computed severity through.

### Pitfall 5: the byte form must be a SEPARATE block, not glued

**What goes wrong:** Joining with `\n` instead of `\n\n`. The contract (GRAM-01) is "cascade/detail rendered as its own SEPARATE block below." The existing cascade arm uses `\n\n` (notify.ts:2334). The standalone path must use the same `\n\n` separator so the detail is a distinct block.

## Code Examples

### Current defect site (notify.ts:2259-2264) — `dispatchInfoMessage` tail

```typescript
// Source: extensions/pi-claude-marketplace/shared/notify.ts:2259-2264
const severity = computeSeverity(message);
if (severity === undefined) {
  ctx.ui.notify(body);
} else {
  ctx.ui.notify(body, severity);   // BUG: body-only, no summary prepend
}
```

### Current correct cascade emission (notify.ts:2324-2336)

```typescript
// Source: extensions/pi-claude-marketplace/shared/notify.ts:2324-2336
const severity = computeSeverity(message);
if (severity === undefined) {
  ctx.ui.notify(withHint);
} else {
  const summarized = `${buildSummaryLine(message, severity)}\n\n${withHint}`;
  ctx.ui.notify(summarized, severity);
}
```

### Current `buildSummaryLine` standalone short-circuit to extend (notify.ts:1720-1732)

```typescript
// Source: extensions/pi-claude-marketplace/shared/notify.ts:1720-1732
if (isInfoKind(message)) {
  switch (message.kind) {
    case "marketplace-info":
    case "plugin-info":
    case "marketplace-info-cascade":
    case "plugin-info-cascade":
    case "marketplace-not-added":
      return "";                       // <-- standalone kinds currently get NO summary
    default:
      assertNever(message);
      return "";
  }
}
```

This arm must change so `marketplace-not-added` returns `"1 marketplace operation failed."` and a failed `plugin-info` returns `"1 plugin operation failed."`. The read-only/info kinds (`marketplace-info`, the two `*-cascade`, non-failed `plugin-info`) keep returning `""` (they never reach the summary path because they're info severity). Reuse `operationPhrase(1, "marketplace")` / `operationPhrase(1, "plugin")`.

### Existing helper to reuse (notify.ts:1690-1692)

```typescript
// Source: extensions/pi-claude-marketplace/shared/notify.ts:1690-1692
function operationPhrase(count: number, kind: "plugin" | "marketplace"): string {
  return `${count} ${kind} ${count === 1 ? "operation" : "operations"}`;
}
```

## State of the Art

| Old Approach (v1.10, current) | Current Approach (this phase) | Impact |
|-------------------------------|-------------------------------|--------|
| `dispatchInfoMessage` emits standalone error/warning body-only | All error/warning emissions route through a shared summary-prepend | `Error: ⊘ ...` glued line eliminated everywhere |
| `buildSummaryLine` returns `""` for all standalone kinds | Returns failed-subject phrase for `marketplace-not-added` + failed `plugin-info` | Summary subject follows the failure, not the command |
| Catalog encodes "NO summary line" for ~6 op sections + the failed plugin-info states | Catalog encodes the two-block prefixed form | Byte gate verifies the corrected contract |

## Catalog & Fixture Map (the lockstep byte-rewrite)

The byte-equality driver lives at `tests/architecture/catalog-uat.test.ts`. It parses `docs/output-catalog.md` for `<!-- catalog-state: STATE -->` annotations under per-command H2 sections, pairs each with the next fenced block, then byte-compares against `notify()` output for the matching FIXTURES entry. Fixtures with `expectedSeverity: "error"|"warning"` assert the Pi-API magic-string 2nd arg.

**The ~9 catalog fence bodies that must be rewritten** (each is currently a glued single-line or multi-line cascade body with NO summary; each must gain a `{summary}\n\n` prefix). Each prose paragraph above the fence ALSO states "NO summary line" / "no summary prefix" — those sentences must be corrected too:

| Catalog line | Section | State | Current fence body | New first block (prefix) |
|--------------|---------|-------|--------------------|--------------------------|
| 381 | install | `missing-marketplace-not-added` | `⊘ ghost-mp [project] (failed) {not added}` | `1 marketplace operation failed.` |
| 437 | uninstall | `missing-marketplace-not-added` | `⊘ ghost-mp [user] (failed) {not added}` | `1 marketplace operation failed.` |
| 562 / 572 | reinstall | `missing-marketplace-not-added` / `-absent-from-both` | `⊘ ghost-mp [project]...` / `⊘ ghost-mp (failed) {not added}` | `1 marketplace operation failed.` |
| 684 / 694 | update | `missing-marketplace-not-added` / `-absent-from-both` | `⊘ ghost-mp [user]...` / bare | `1 marketplace operation failed.` |
| 1016-1019 | marketplace info | `manifest-invalid` (failed `plugin-info`, multi-line) | 3-line header+row+marker | `1 plugin operation failed.` |
| 1029 / 1039 | marketplace info | `absent-from-both` / `scope-mismatch-not-added` | `⊘ ghost-mp...` / `⊘ my-mp [user]...` | `1 marketplace operation failed.` |
| 1014/manifest, 1555 fixture | plugin info | `missing-plugin-not-in-manifest` (failed `plugin-info`) | header+`⊘ ghost-plugin (failed) {not in manifest}` | `1 plugin operation failed.` |
| 1155 / 1165 | plugin info | `missing-marketplace-not-added-absent-from-both` / `-scope-mismatch` | bare / `[user]` | `1 marketplace operation failed.` |
| 1213 / 1223 | marketplace remove | `remove-missing-not-added` / `-bare` | `⊘ ghost-mp [user]...` / bare | `1 marketplace operation failed.` |
| 1311 / 1321 | marketplace update | `update-missing-not-added` / `-absent-from-both` | `⊘ ghost-mp [project]...` / bare | `1 marketplace operation failed.` |
| 1377 / 1387 | autoupdate\|noautoupdate | `autoupdate-missing-not-added` / `-bare` | `⊘ missing-mp [user]...` / `[project]` | `1 marketplace operation failed.` |

> Note: the `plugin-info` failed states whose subject is the PLUGIN (`manifest-invalid`, `missing-plugin-not-in-manifest`) take the `1 plugin operation failed.` summary; the `marketplace-not-added` states (and the absent/scope-mismatch `marketplace info` / `plugin info` states that are now `marketplace-not-added` variants) take `1 marketplace operation failed.`. This IS the GRAM-02 subject split. The `marketplace info` `absent-from-both` (line 1029) and `scope-mismatch-not-added` (line 1039) fixtures are `marketplace-not-added` variants (catalog-uat.test.ts:1524, 1536) → marketplace subject.

The exact new fence body shape for a one-row case:
```
1 marketplace operation failed.

⊘ ghost-mp [project] (failed) {not added}
```
For the multi-line `manifest-invalid` case:
```
1 plugin operation failed.

● bad-mp [user] <no autoupdate>
  ⊘ bad-mp (failed) {invalid manifest}
    components: not resolved
```

**Catalog prose sentences to correct** (grep `NO summary line` / `no summary prefix` in `docs/output-catalog.md`): lines 376, 432, 557, 679, 1208, 1218, 1306, 1372, 1382 (and any others surfaced by the grep). These currently assert the violation as the contract.

**FIXTURES change:** None to the fixture DATA — fixtures already carry `expectedSeverity: "error"`. Only the catalog fence bodies they byte-compare against change. The catalog-uat inverse-walk (catalog-uat.test.ts:2213) confirms no orphan fixtures, so no new fixtures are needed (the states already exist).

## Test Architecture (GRAM-05)

### Existing tests touching this surface
- `tests/shared/notify-v2.test.ts` — per-variant byte-equality unit tests. The cascade summary-line forms are asserted here (e.g. line 477 `1 plugin operation and 1 marketplace operation failed.\n\n...`; line 541 `1 marketplace operation failed.\n\n⊘ demo [user] (failed)`). This is the natural home for a few new explicit byte-equality tests proving the standalone `marketplace-not-added` and failed `plugin-info` now emit `{summary}\n\n{row}`.
- `tests/architecture/catalog-uat.test.ts` — the byte-equality + severity-arg gate (forward walk catalog→fixture; inverse walk fixture→catalog). After the catalog rewrite this gate becomes the primary regression lock for the corrected byte forms.

### The new cross-cutting grammar-invariant test (success criterion 5)
**Structure:** Iterate the catalog fixtures (or all catalog examples), drive each through `notify()` against a mock ctx, and for every emission where the 2nd `ctx.ui.notify` arg is `"error"` or `"warning"`, assert:
1. The emitted message's first line is NON-EMPTY (a summary), AND
2. The first line is followed by a blank line (`\n\n`) and is DISTINCT from the cascade/detail block below it (i.e. the first line is not itself a row — it does not start with an icon `●`/`○`/`⊘` and does not contain `(failed)`/`(skipped)` tokens; it matches the summary grammar `N (plugin|marketplace) operation(s) (failed|skipped).`).

**Where:** A new `tests/shared/notify-grammar-invariant.test.ts` (or `tests/architecture/`), reusing the catalog-uat mock helpers (`makeCtx`, the `piWith*Loaded` factories). The simplest robust form imports the FIXTURES map indirectly by re-driving the catalog examples, OR asserts the invariant structurally over a hard list of every error/warning-producing message kind. Recommended: drive `notify()` over the same set the catalog-uat forward walk uses and apply the invariant to every call whose severity arg is error/warning. This makes it a true cross-cutting gate that catches any FUTURE standalone error/warning kind that forgets the summary.

**Note on test discoverability:** `npm test` globs `tests/{architecture,bridges,domain,edge,helpers,orchestrators,persistence,platform,shared,transaction}/**/*.test.ts` — both `tests/shared/` and `tests/architecture/` are covered. [VERIFIED: package.json:76]

## Open Questions

1. **Should the new invariant test live in `tests/shared/` or `tests/architecture/`?**
   - What we know: both are in the `npm test` glob; catalog-uat (the closest analog) lives in `tests/architecture/`; per-variant byte tests live in `tests/shared/notify-v2.test.ts`.
   - What's unclear: stylistic placement only.
   - Recommendation: `tests/architecture/` (it is a cross-cutting structural invariant, peer to catalog-uat). Planner's discretion.

2. **Does any non-catalog emission site need the summary?**
   - What we know: the catalog-uat inverse-walk proves every FIXTURES state is annotated; the v1.10 phases routed ALL marketplace-absent preconditions through the variant. The grep for `marketplace-not-added` construction (install/uninstall/reinstall/update/marketplace-update/remove/autoupdate/info ×2) matches the full success-criterion-2 op list.
   - What's unclear: nothing material — the fix is centralized in `notify.ts`, so every emission site benefits automatically without per-site edits.
   - Recommendation: no orchestrator changes; verify via the catalog-uat gate that all states render the two-block form.

## Environment Availability

Skipped — no external dependencies. The phase edits source, docs, and tests only; `npm run check` runs against the in-repo toolchain already present.

## Validation Architecture

> `.planning/config.json` not read for an explicit `nyquist_validation: false`; treating as enabled. The repo's STATE.md references `nyquist_compliant` flips, so validation is active.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | node:test (built-in), Node >= 20.19.0 |
| Config file | none — `package.json` `test` script |
| Quick run command | `node --test "tests/shared/notify-v2.test.ts" "tests/architecture/catalog-uat.test.ts"` |
| Full suite command | `npm run check` (typecheck + eslint + prettier + `npm test`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GRAM-01 | Every error/warning notification has a non-empty summary first line + separate detail block | unit + invariant | `node --test "tests/architecture/catalog-uat.test.ts"` + new invariant test | catalog-uat ✅; invariant ❌ Wave 0 |
| GRAM-02 | Summary subject follows failed row (marketplace vs plugin) | unit | `node --test "tests/shared/notify-v2.test.ts"` (add 2 byte tests) | ✅ (extend) |
| GRAM-03 | Two-block shape across every `marketplace-not-added` + failed `plugin-info` state | byte-equality | `node --test "tests/architecture/catalog-uat.test.ts"` (after fence rewrite) | ✅ |
| GRAM-04 | Single shared summary path; no standalone bypass | unit / structural | new invariant test + notify-v2 standalone tests | ❌ Wave 0 |
| GRAM-05 | Cross-cutting invariant over all catalog fixtures; catalog + fixtures corrected in lockstep | invariant + byte-equality | new invariant test + catalog-uat | ❌ Wave 0 (test); ✅ (catalog-uat exists) |

### Sampling Rate
- **Per task commit:** `node --test "tests/shared/notify-v2.test.ts" "tests/architecture/catalog-uat.test.ts"`
- **Per wave merge:** `npm test`
- **Phase gate:** `npm run check` exits 0 before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/architecture/notify-grammar-invariant.test.ts` (or `tests/shared/`) — covers GRAM-01/04/05 cross-cutting invariant. New file.
- [ ] 2 new byte-equality cases in `tests/shared/notify-v2.test.ts` for the standalone `marketplace-not-added` and failed `plugin-info` two-block forms (GRAM-02) — extend existing file.
- [ ] Framework install: none — node:test is built in.

## Security Domain

> `security_enforcement` not found as explicit `false`; treating as enabled.

This phase is a pure user-facing OUTPUT-grammar correction. It introduces no auth, session, access-control, crypto, or untrusted-input parsing. The only input flowing into the summary is structured `NotificationMessage` data assembled in-process by trusted orchestrators (no user-supplied free text enters the summary line — the summary is computed from a fixed count + closed-set subject literal).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no (no untrusted input reaches the summary) | The summary is `N (plugin\|marketplace) operation(s) failed.` — fully computed from a count + closed literal; marketplace/plugin NAMES render only in the existing detail rows (already in v1.10 scope), not in the new summary line. |
| V6 Cryptography | no | — |

### Known Threat Patterns for {stack}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Output channel bypass (direct stdout/stderr) | Tampering/Info-disclosure | IL-2: all output via `ctx.ui.notify`; `notify.ts` is the sole sanctioned call site (eslint `no-restricted-syntax` per-file override). The fix stays inside `notify.ts` — no new emission channel. |

## Project Constraints (from CLAUDE.md)

- **IL-2 (output channel):** All user-visible messages MUST go through `ctx.ui.notify`. `shared/notify.ts` is the SOLE sanctioned call site; the eslint per-file override disables `no-restricted-syntax` there. The fix keeps emission inside `notify.ts` and preserves the "exactly one `ctx.ui.notify` call per invocation" invariant (catalog-uat.test.ts:2143 asserts call count === 1).
- **IL-1 (English only):** Summary strings are English literals; no message catalog. The `N (plugin|marketplace) operation(s) failed.` wording is the user contract.
- **IL-4 (no telemetry):** No analytics. N/A but do not add.
- **Source comment cleanup policy (MEMORY):** Strip historical phase/plan/wave/milestone narrative from new/edited comments, but KEEP requirement IDs (GRAM-01..05) and decision IDs as traceability. Existing comments carry heavy v1.x lineage; when editing a comment block, prune the narrative and keep the IDs.
- **Notify Error/Warning label grammar (MEMORY):** `Error:`/`Warning:` MUST be followed by a summary message; the cascade is ALWAYS its own separate block. This is exactly GRAM-01 — the operator's prior captured preference. The v1.10 `marketplace-not-added` defect violated both halves.
- **Notification severity color preference (MEMORY):** The operator values label/grammar clarity over severity color; capture at the notify boundary is sufficient. Do not chase the upstream label+color coupling (UXG-03, refuted/deferred) — that is out of scope here; this phase only adds the summary line, severity arg routing is unchanged.
- **Quality bar (NFR-6):** `npm run check` (typecheck + eslint + prettier + tests) must stay green — the phase gate (success criterion 5).
- **Git:** Never commit to main; use a `features/*` branch (already on `features/v1.10-error-attribution`); Conventional Commits; run `pre-commit run` before commit; worktree commits prefix `SKIP=trufflehog`; `--squash` merges only.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The failed `plugin-info` summary subject is the PLUGIN (`N plugin operation(s) failed.`), distinct from `marketplace-not-added`'s marketplace subject. | Pattern 2 / Catalog Map | Wrong subject byte form → catalog-uat byte-mismatch; corrected during implementation against the catalog. LOW risk — directly follows GRAM-02 / ATTR-08 (manifest unreadable is a plugin-row failure). |
| A2 | Count is always exactly 1 for both standalone kinds (one absent marketplace / one failed plugin row). | Pattern 2 | If a future variant carried >1 row this would undercount; today both variants are structurally single-subject (verified in the type model). LOW. |
| A3 | No orchestrator changes are required — subject attribution is already correct at construction. | Open Q2 / Anti-Patterns | If some emission site still constructs the wrong variant, the summary subject would be wrong; the v1.10 ATTR phases + catalog-uat coverage make this LOW. |
| A4 | `.planning/config.json` has `nyquist_validation`/`security_enforcement` enabled (not read this session). | Validation / Security | If disabled, those sections are optional, not harmful. LOW. |

## Sources

### Primary (HIGH confidence — read in source this session)
- `extensions/pi-claude-marketplace/shared/notify.ts` (full, 2409 lines) — the defect site (`dispatchInfoMessage` 2229-2265), the correct cascade emission (2324-2336), `buildSummaryLine` (1712-1751), `computeSeverity` (1560-1629), `operationPhrase` (1690), `isInfoKind`/`StandaloneKind` (911-935), `renderMarketplaceNotAdded` (2124-2136), `renderPluginInfo` (2160-2202), the type model (`MarketplaceNotAddedMessage` 877-881, `PluginInfoMessage` 751-757).
- `tests/architecture/catalog-uat.test.ts` (full, 2282 lines) — parser (`loadCatalogExamples` 74-132), FIXTURES map, byte-equality + severity-arg driver (2098-2211), inverse walk (2213-2249).
- `tests/shared/notify-v2.test.ts` (lines 450-650 + structure grep) — existing summary-line byte forms (477, 541, 574, 593, 611).
- `docs/output-catalog.md` (lines 376-1387, targeted) — the ~9 fence bodies + the "NO summary line"/"no summary prefix" prose sentences.
- `extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts` (107-118) — `MarketplaceNotAddedSignal` (marketplace subject).
- `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts` (256-283) — `buildManifestFailureMessage` failed `plugin-info` construction (plugin subject).
- `.planning/REQUIREMENTS.md`, `.planning/phases/50-.../50-CONTEXT.md`, `.planning/STATE.md` — requirements, success criteria, v1.10/v1.11 roadmap rationale.
- `package.json` (71-84) — `check`/`test` scripts and the test glob.
- `CLAUDE.md` + MEMORY entries — IL-1/IL-2/IL-4, comment-cleanup policy, label-grammar preference.

### Secondary / Tertiary
- None — no web/library research applicable to this surgical, repo-internal fix.

## Metadata

**Confidence breakdown:**
- Defect localization: HIGH — the exact divergent lines (`dispatchInfoMessage` body-only vs cascade `${summary}\n\n${body}`) were read in source.
- Fix shape: HIGH — reuses existing `buildSummaryLine` / `operationPhrase` / `computeSeverity` / `isInfoKind`; no new mechanism.
- Catalog/fixture touchpoints: HIGH — all ~9 fence bodies + prose sentences + the byte-equality driver mechanics were located and quoted.
- Test architecture: HIGH — existing patterns (notify-v2 byte tests, catalog-uat byte+severity gate, inverse walk) are documented; the new invariant fits the same harness.

**Research date:** 2026-06-08
**Valid until:** Stable — this is repo-internal source; valid until `shared/notify.ts` or the catalog structure is materially refactored.
