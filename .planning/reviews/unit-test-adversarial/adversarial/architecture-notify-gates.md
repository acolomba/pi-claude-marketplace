# Architecture — notify and vocabulary gates — adversarial re-review

**Scope:** the 8 gate tests named in the first-pass file (`notify-grammar-invariant`, `notify-producer-wire-coverage`, `notify-stamp-coverage`, `notify-will-reload-agreement`, `notify-closed-set-locks`, `cross-surface-reason-parity`, `partial-vocabulary-guard`, `markers-snapshot`), plus the production modules they import and the sibling gates that overlap them (`compat-01-no-expansion.test.ts`, `tests/shared/{notify-context,probe-classifiers}.test.ts`, `tests/persistence/locations.test.ts`, `tests/orchestrators/reconcile/notify.test.ts`) — read to settle whether each gate actually fires.
**First-pass file:** `unit-test-findings/architecture-notify-gates.md`
**Clean files attacked:** 15 (4 test, 11 production)
**Existing findings graded:** 11

## Verdict summary

| Metric | Count |
| --- | --- |
| New BLOCKER (missed by first pass) | 6 |
| New WARNING (missed by first pass) | 11 |
| Existing CONFIRMED | 7 |
| Existing UNDERSTATED | 1 |
| Existing OVERSTATED | 1 |
| Existing REFUTED | 1 |
| Existing DUPLICATE-OF | 1 |

The first pass's picture of this area does **not** hold up. It spent its whole budget on a real but already-known repo-wide symptom (`as never` doubles, META §1) and declared the four hardest gates clean. Three of those four do not fire on the mutation they exist to catch, and the fourth — `partial-vocabulary-guard.test.ts`, the file the first pass singled out as a model "planting" gate — is blind to 21 live violations inside the very tree it scans.

## New findings — from the clean lists

### `tests/architecture/partial-vocabulary-guard.test.ts`

- **[BLOCKER] The D-75-01 guard cannot see the camelCase/PascalCase form of the retired force vocabulary, and 21 live violations sit inside `extensions/` behind that hole** — `lines 224-230` (`ABSENT_FORCE_PROSE`), `lines 187-199` (`ABSENT_IDENTIFIERS`)
  The file header at `line 24` claims "The checks cover the retired vocabulary in ALL of its written forms." They do not. Every force-family regex requires a separator — `/force[- ]install/i`, `/force[- ]upgrad/i`, `/force[- ]degrad/i`, `/force[- ]materializ/i` — so `ForceInstall` / `forceInstall` with no separator never matches; and `ABSENT_IDENTIFIERS` is a hand-enumerated blocklist of exactly 11 names, which by construction cannot catch a twelfth. `grep -rniE 'force(install|upgrad|degrad|materializ)' extensions` returns **21 hits**, including two production **exports**: `resolvePendingForceInstalls` (`orchestrators/reconcile/notify.ts:288`) and `scanForceInstalledBackfills` (`orchestrators/reconcile/backfill.ts:207`), plus `forceInstallKey` (`reconcile/notify.ts:269`), the `forceInstallKeys` parameter (`reconcile/notify.ts:359`, `reconcile/pending.ts:252`), `hasForceInstalledPlugin` (`backfill.ts:167`), and `renderForceInstalled` (`reconcile/reconcile.messaging.ts:201`) — which maps to the *renamed* `"partially-installed"` status, so the identifier and the token it renders now disagree.
  Fix in two steps, in this order: (1) rename the 21 sites to the `partial`/`partially-` vocabulary — `resolvePendingPartialInstalls`, `partialInstallKey(s)`, `scanPartiallyInstalledBackfills`, `hasPartiallyInstalledPlugin`, `renderPartiallyInstalled`; (2) then make the separator optional in all five regexes (`/force[- ]?install/i`, etc.) so the hole cannot reopen. Doing (2) first turns the suite red.

- **[BLOCKER] The guard's scan surface excludes every unit-test file outside `tests/architecture/`, hiding 99 retired-vocabulary hits across 8 files** — `lines 83-103` (`collectGuardedSources`), `line 52` (`ARCH_DIR`)
  `collectGuardedSources()` is exactly: the recursive `extensions/` tree, `docs/output-catalog.md`, `docs/messaging-style-guide.md`, and a **non-recursive** `readdirSync(tests/architecture)`. `tests/{bridges,domain,edge,orchestrators,persistence,platform,shared,transaction}/**` are outside the net. Applying the guard's own `ABSENT_FORCE_PROSE` set to `tests/` yields 99 matches in 8 files: `orchestrators/plugin/list.test.ts` (25), `install.test.ts` (24), `update.test.ts` (24), `info.test.ts` (7), `domain/resolver.test.ts` (5), `shared/notify.test.ts` (9), `marketplace/update.test.ts` (3), `plugin/reinstall.test.ts` (2). These are not incidental: `tests/orchestrators/plugin/list.test.ts:1165` is a **test title** reading "shows under `--unsupported`" for a case whose body calls `listPlugins({… partial: true })` (`list.test.ts:1197`) — the flag was renamed to `--partial` (`edge/flag-catalog.ts:93,108,126`) and the title now names a flag that does not exist. `list.test.ts:1154-1157` is a comment block documenting the retired filter names.
  Fix: extend `collectGuardedSources()` to walk `tests/` recursively (reusing the `readdirSync(..., { recursive: true })` shape already in `collectExtensionSources`), excluding only `SELF`. Expect it red; the 99 sites must be reworded first. Keep `tests/edge/handlers/plugin/reinstall.test.ts:768-780` as an explicit allowlist — it deliberately spells `--force` to prove the flag is rejected as unknown (RINST-01 / D-67-03), which is the one legitimate occurrence.

- **[WARNING] Hand-rolls `REPO_ROOT` instead of importing the one built for this** — `line 50`
  `tests/architecture/source-scan.ts:29` exports `REPO_ROOT`, and the sibling gate `compat-01-no-expansion.test.ts:95` imports it (`import { REPO_ROOT, stripComments } from "./source-scan.ts"`). Replace the local `path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")` with that import. (This is one of the 5 files META §"Patterns to propagate" names; the propagation target is concrete here.)

### `tests/architecture/markers-snapshot.test.ts`

- **[BLOCKER] The file's header cites a companion gate that does not exist, and no gate anywhere blocks the 5 superseded ES-5 literals** — `lines 16-20`
  The header states: "Re-introductions of any of the 5 superseded ES-5 literals anywhere in the codebase are blocked by `tests/architecture/no-legacy-markers.test.ts` (D-13-12), which pins the literals in its own body and runs under `npm run check`." That file does not exist (`ls tests/architecture/no-legacy-markers.test.ts` → No such file). `grep -rn "MANUAL RECOVERY REQUIRED\|is not loaded; \|rollback partial: \[" tests extensions` returns exactly one hit, a prose comment in `tests/orchestrators/plugin/reinstall.test.ts:1602`. So all five ES-5 strings (`docs/messaging-style-guide.md:164-171`) are unguarded, and this file's header is the reason nobody noticed — it is the stated justification for `markers-snapshot.test.ts` not covering them. Two other docs repeat the false claim: `docs/messaging-style-guide.md:174` and `docs/output-catalog.md:2890`.
  Fix: add the five-literal absence scan to `partial-vocabulary-guard.test.ts` (same mechanism, same guarded surface) as five rows in `ABSENT_FLAGS`-style form, then correct the three stale citations to name the gate that actually holds them.

- **[WARNING] The `D-09` case belongs to `tests/persistence/locations.test.ts`, and its expected value is derived from the object under test** — `lines 72-76`
  `assert.equal(locations.stateLockFile, path.join(locations.extensionRoot, ".state-lock"))` computes the expectation from `locations.extensionRoot`, so mutating `locationsFor` to return a wrong `extensionRoot` moves both sides together and the case stays green. It also exercises `persistence/locations.ts`, not the marker constants this file is named for. `tests/persistence/locations.test.ts:84-90` already pins it independently (`const extensionRoot = path.join(userRoot, "pi-claude-marketplace")` → `stateLockFile: path.join(extensionRoot, ".state-lock")`). Delete the case here; the owner already covers it.

- **[WARNING] No `// arrange` / `// act` / `// assert` phase comments in any of the 6 cases** — `lines 34-76`
  Same omission in `notify-closed-set-locks.test.ts` (`lines 29-77`, 4 cases). The sibling `cross-surface-reason-parity.test.ts` and `compat-01-no-expansion.test.ts` both mark phases correctly; copy that form. For the one-expression cases use `// act & assert`.

### `tests/architecture/notify-grammar-invariant.test.ts`

- **[BLOCKER] The GRAM-01/04/05 gate disables itself on exactly the mutation it exists to catch** — `lines 628-630`
  ```ts
  if (severity !== "error" && severity !== "warning") {
    continue;
  }
  ```
  The fixture's rendered severity is read from production output and then used to decide whether to check anything. Mutate `computeSeverity` (`shared/notify.ts:2883`) to `case "marketplace-not-added": return undefined;` and three of the seven fixtures skip **every** clause — non-empty first line, `\n\n` block separation, no row icon, no status token, `SUMMARY_GRAMMAR` match, distinct detail block — and the case reports green. The file header (`lines 16-19`) says its whole purpose is to trip when "a FUTURE standalone error/warning kind … forgets the summary"; forgetting the severity stamp is the same forgetting, and it is invisible.
  Fix: add `readonly expectedSeverity: "error" | "warning"` to `GrammarFixture` (`lines 79-83`), set it on all 7 fixtures, and replace the `continue` with `assert.equal(severity, fixture.expectedSeverity, …)` before the clause block. Combined with the split into sibling `test()`s (first-pass finding, see grading below), each fixture then owns a case that cannot opt out.

- **[BLOCKER] Four cases pass when `notify()` renders an empty string** — `lines 419-425`, `lines 564-567`, `lines 593-608`, and `notify-will-reload-agreement.test.ts:269-275`, `notify-stamp-coverage.test.ts:206-209`
  A grouped instance of one mutation: **return `""` (or drop the whole marketplace block) from the composer**. In the DIFF-02 case (`line 419`), `lines` is filtered to non-empty entries, so an empty render makes the `for` body never execute and only the call-count, `args.length`, and a `!includes(...)` negative survive — all of which an empty string satisfies. The RECON-04 trailer case (`lines 564-567`) has no positive content assertion at all. The RECON-04 grammar case (`lines 593-608`) has the same empty-`lines` hole. `notify-will-reload-agreement.test.ts:271-275` is a bare `assert.ok(!emitted.includes(RELOAD_HINT_TRAILER))`. `notify-stamp-coverage.test.ts:209` is `assert.deepStrictEqual(transitionRows, [])`, which passes when `buildReconcilePendingNotification` emits **zero rows**.
  **The fix already exists inside one of these files**: `notify-grammar-invariant.test.ts:458` guards its loop with `assert.ok(lines.length > 0, …)`. Propagate that guard to `line 419` and `line 593`. For the three negative-only cases, assert the positive first: in `notify-will-reload-agreement.test.ts` assert the full expected rendered string (the fixtures are single-row and the bytes are computable); in `notify-stamp-coverage.test.ts:200-209` assert `rows(message)` in full — 5 rows for `pendingPlan()` — before filtering to the empty transition subset.

- **[WARNING] `ROW_ICONS` and `ROW_ICONS_AT_START` are byte-identical duplicates, and both omit the `◍` glyph the file elsewhere treats as a row icon** — `line 73` vs `line 578`
  `WILL_TOKEN_RE` (`line 322`) admits `[●○⊘◍]`; `DISABLED_TOKEN_RE` (`line 332`) is anchored on `◍`; but both icon arrays are `["●", "○", "⊘"]`. Consequence 1: clause 3a (`line 651`) would not catch a summary line that starts with `◍`. Consequence 2: the RECON-04 subject-first check (`line 597`) would *falsely fail* if a `disabled` row were added to `RECONCILE_APPLIED_FIXTURES` — and the comment at `lines 574-576` claims the grammar covers "added / removed / installed / uninstalled / disabled / failed" while the two fixtures (`lines 492-548`) carry only `added`, `failed`, and `installed`. Hoist one `const ROW_ICONS = ["●", "○", "⊘", "◍"] as const` to module scope, delete `ROW_ICONS_AT_START`, and either add fixtures for `removed`/`uninstalled`/`disabled` or narrow the comment to what the fixtures actually drive.

- **[WARNING] Module-scope fixture arrays shared across cases** — `lines 88-115`, `121-165`, `167-243`, `257-307`, `334-393`, `492-548`
  `CROSS_SCOPE_FIXTURES` is both spread into `FIXTURES` and iterated by its own case; `RECONCILE_APPLIED_FIXTURES` is iterated by two cases; each `pi` object is built once at module load by `piWithBothLoaded()` and reused. The rule is fresh per-case values from a factory, not shared constants. Convert each array to a function returning fresh literals (`function crossScopeFixtures(): readonly GrammarFixture[]`), called inside each case.

### `tests/architecture/notify-will-reload-agreement.test.ts`

- **[BLOCKER] The WILL-02 "agreement" gate only exercises one side of the agreement; `pendingToken` is never asserted** — `lines 75-80` (the `pendingToken` field), `lines 258-276`
  The file's promise (`lines 5-9`) is that "a pending row carries `will` exactly when its corresponding REALIZED command cascade emits the reload-hint trailer." Every fixture carries a `pendingToken` string, and `pendingToken` appears **only inside assertion failure messages** — no case ever renders a pending message. `notify()` is called exclusively with realized-cascade fixtures. Mutate the pending renderer to drop or rename a `will *` token (`shared/notify.ts:1095`, `1113`, `1127`) and this gate stays green; the header at `lines 22-25` admits as much ("it inspects realized-cascade reload behavior … it is the anchor the pending-surface retirement must converge to"), which is a comment describing an intent, not a gate.
  Fix: add a second fixture arm holding the corresponding pending `NotificationMessage` for each row (the shapes exist — `status: "will install" | "will uninstall" | "will enable" | "will disable"`), render both, and assert the pairing directly: pending row contains `(${fixture.pendingToken})` **iff** the realized render ends with `RELOAD_HINT_TRAILER`. That is the invariant the filename claims.

### `tests/architecture/notify-closed-set-locks.test.ts`

- **[WARNING] All 4 cases are strictly subsumed by `compat-01-no-expansion.test.ts`; the file can never fail alone** — `lines 29-77`
  Each case is a length pin (`assert.equal(REASONS.length, 44)` etc.). `compat-01-no-expansion.test.ts:127`, `:187`, `:224`, `:256` already assert each of the same four tuples against a hand-written **ordered member list** via `assert.deepEqual`. Any drift that changes a length also changes the enumeration, so compat-01 fails first, every time; and `tests/shared/notify.test.ts:4982` pins `STATUS_TOKENS` a third time. The "deliberate-bump tripwire" rationale in the header (`lines 13-16`) was written before the enumeration pin existed — compat-01 already forces a conscious amendment, and its own header (`lines 56-58`) records the division of labour that is now stale ("Length pins for the four closed sets. `notify-closed-set-locks.test.ts` owns those").
  Fix: delete `notify-closed-set-locks.test.ts` and fold its per-member decision-ID provenance comments (`lines 30-50`) into the `expected` arrays in `compat-01-no-expansion.test.ts`, so the ID trail survives in the file that does the checking. This also resolves the first pass's comment-style finding on the file, which becomes moot.

### `tests/architecture/cross-surface-reason-parity.test.ts`

- **[WARNING] Two members of the gate's own domain have no parity row: the `workflows` kind and the install-side errno arm** — `lines 65-84` (kind rows), `lines 10-49` (note rows)
  `narrowUnsupportedKinds` has four arms (`kindToReason`, `shared/probe-classifiers.ts:207-221`): `lspServers`, `hooks`, `workflows`, catch-all. The gate rows cover `lspServers`, `monitors`, `themes`, `hooks` — `workflows` (D-90-05 / WDET-04, a dedicated carve-out) has no row. Separately, `install.messaging.ts:493-507` (`errnoReasonFromNote`) maps notes containing `EACCES`/`EPERM`/`ENOENT`/`ENOTDIR`/`SyntaxError`/`Unexpected token` to `permission denied` / `source missing` / `unparseable`, while the probe side's `classifyResolverNote` has no such arm and returns `unsupported source` for the same input. That is a **real, live cross-surface divergence** the gate is named to prevent and does not test.
  Fix: add a `{ kind: "workflows", note: "contains workflows", reason: "workflows" }` row to the loop at `line 65`; and add either a parity row proving errno notes agree, or — if the divergence is intended — a `test("install-only errno arm has no read-only counterpart", …)` documenting it explicitly with both results asserted, so the exception is recorded rather than absent.

- **[WARNING] The third assertion in every case is a tautology** — `lines 47`, `62`, `82`, `98`, `112`, `128`
  `assert.deepStrictEqual(installReasons, readOnlyReasons)` after both have already been pinned to the same literal cannot fail independently. Harmless, but it reads as the gate's central check while carrying no information. Drop it, or invert: assert the two against each other **only**, and pin the literal in one place per row.

### `extensions/pi-claude-marketplace/shared/notify.ts`

- **[WARNING] The `STATUS_TOKENS` ordering comments describe a reload-hint mechanism the code no longer has** — `lines 309-317`, `340-346`, `349-355`, `356-363`
  Four comment blocks assert that the tuple's "four head-of-tuple state-change tokens … drive the reload-hint" and that new members must be "appended LAST (below the reload-hint trigger window)". `shouldEmitReloadHint` (`lines 3234-3290`) reads no index and no token: it is the RLD-02 OR-reduce of the caller-stamped `needsReload` over the flattened rows, with a kind-level short-circuit for info kinds. `grep -rn STATUS_TOKENS extensions` shows no positional consumer. The comments instruct future authors to preserve an invariant that does not exist while the real one (stamp `needsReload` at the producer) goes unmentioned here. Per the repo comment policy, restate as a present-tense fact: the tuple order is catalog-stable and pinned by `compat-01-no-expansion.test.ts`; the reload hint is driven by per-row `needsReload`. The same stale claim is repeated in `compat-01-no-expansion.test.ts:219` (assertion message) and should be corrected in the same change.

- **[WARNING] Doc comment cites a test module that does not exist** — `line 374` (`tests/shared/notify-v2.test.ts`)
  Three dangling test-path citations exist in production comments; the other two are `orchestrators/plugin/install.messaging.ts:476` (`tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` — the file lives at `tests/architecture/`) and `orchestrators/plugin/info.ts:1124` (`tests/orchestrators/plugin/info-manifest-absent.test.ts`). Each names a gate a reader would take as proof of coverage. Fix each to the real path, or delete the citation. `install.messaging.ts:476` is the one in this area: change to `tests/architecture/cross-surface-reason-parity.test.ts`.

### `extensions/pi-claude-marketplace/shared/notify-context.ts`

- **[WARNING] Three casts, one of which writes through a declared-`readonly` field** — `lines 317-318`, `line 327`, `line 337`
  The first pass recorded this module as "no `any`, explicit return types" and stopped there. `line 337` is `arm as unknown as RenderFn<PluginNotificationMessage>` — a double assertion, the shape META flags as a finding in `index.ts`. `line 327` is `(p as { severity?: "error" }).severity = "error"`, a cast used specifically to defeat `readonly` and mutate a row the caller owns; the `try/catch` at `326-332` exists only because that write throws on a frozen object. Both are commented, so this is not a silent defect, but the readonly-write is a design smell with a named fix: have `dispatchRow` return `{ line, severityFloor }` and let `emitContextCascade` apply the floor, instead of reaching into the caller's row. Covered by `tests/shared/notify-context.test.ts:339` and `:392`, so the behavior is pinned either way.

### `tests/architecture/notify-producer-wire-coverage.test.ts`

- **[WARNING] The partial-install status family has no wire row** — `lines 74-377`
  The six cases cover `installed` / `uninstalled` / `disabled` / `reinstalled` / `updated` / `skipped` / `failed` across the five producers, but not `partially-installed` or `partially-upgradable` — the two statuses added by the D-75-01 rename, and the ones whose severity/reload stamping is least settled. `notify-stamp-coverage.test.ts:167-172` covers `partially-installed` on the *reconcile* projection only. Add one case pairing `INSTALL_CONTEXT` (`status: "partially-installed"`, `severity: "info"`, `needsReload: true`) with `UPDATE_CONTEXT` (`status: "partially-upgradable"`), asserted with the same `wireFacts` deepStrictEqual form.

## Export ownership census

Restricted to exports reachable from this area's 8 gates. "Owner elsewhere" means a paired test module outside this area owns it — not a gap, but not this area's coverage either.

| Module | Export | Owning case in this area | Status |
| --- | --- | --- | --- |
| `shared/notify-context.ts` | `notifyWithContext` | `notify-producer-wire-coverage.test.ts:74,125,176,229,279,329` | owned |
| `shared/notify-context.ts` | `notifyUpdateWithContext` | — | owner elsewhere (`tests/shared/notify-context.test.ts:276`) |
| `shared/notify-context.ts` | `notifyUpdateNoOpWithContext` | — | owner elsewhere (`:296,311`) |
| `shared/notify-context.ts` | `notifyReconcileAppliedWithContext` | — | owner elsewhere (`:436`) |
| `shared/notify-context.ts` | `RenderFn`/`CommandContext`/`Single`/`Plural`/`WithPlugins`/`MarketplaceRows` | — | type-only |
| `shared/probe-classifiers.ts` | `narrowResolverNotes` | `cross-surface-reason-parity.test.ts:42` | owned |
| `shared/probe-classifiers.ts` | `narrowUnsupportedKinds` | `cross-surface-reason-parity.test.ts:77` | owned (no `workflows` row — see finding) |
| `shared/probe-classifiers.ts` | `narrowProbeError` | — | owner elsewhere (`tests/shared/probe-classifiers.test.ts`) |
| `orchestrators/plugin/install.messaging.ts` | `narrowResolverReasons` | `cross-surface-reason-parity.test.ts:41` | owned |
| `orchestrators/plugin/install.messaging.ts` | `INSTALL_CONTEXT` | `notify-producer-wire-coverage.test.ts:131` | owned |
| `orchestrators/plugin/install.messaging.ts` | `classifyEntityShapeError`, `classifyInstallFailure` | — | owner elsewhere |
| `orchestrators/plugin/{enable-disable,uninstall,update,reinstall}.messaging.ts` | `*_CONTEXT` | `notify-producer-wire-coverage.test.ts` | owned |
| `shared/markers.ts` | `RECOVERY_PLUGIN_REINSTALL_PREFIX`, `STATE_LOCK_HELD_PREFIX` | `markers-snapshot.test.ts:55,65` | owned |
| `bridges/agents/marker.ts` | `GENERATED_AGENT_{PREFIX,MARKER,MARKER_LEGACY}` | `markers-snapshot.test.ts:34,38,42` | owned |
| `bridges/agents/marker.ts` | `isOwnedAgentFile`, `SafetyResult` | — | owner elsewhere (`tests/bridges/agents/marker.test.ts`) |
| `persistence/locations.ts` | `locationsFor` | `markers-snapshot.test.ts:73` (misplaced) | **misplaced** — see finding |
| `orchestrators/reconcile/notify.ts` | `buildReconcileAppliedCascade` | `notify-stamp-coverage.test.ts:151,181` | owned |
| `orchestrators/reconcile/notify.ts` | `buildReconcilePendingNotification` | `notify-stamp-coverage.test.ts:205` | owned, **vacuously** — see finding |
| `orchestrators/reconcile/notify.ts` | `resolvePendingForceInstalls`, `isReconcilePlanListEmpty`, `PendingInstallCandidate(Locator)` | — | owner elsewhere (`tests/orchestrators/reconcile/{notify,pending}.test.ts`) |
| `shared/notify.ts` | `REASONS`/`STATUS_TOKENS`/`PLUGIN_STATUSES`/`MARKETPLACE_STATUSES` | `notify-closed-set-locks.test.ts` (length only) | redundant — enumeration owned by `compat-01-no-expansion.test.ts` |
| `shared/notify.ts` | `notify` | `notify-grammar-invariant.test.ts`, `notify-will-reload-agreement.test.ts` | owned, weakly |
| `shared/notify-reasons.ts` | `skipSeverity`, `companionSeverity`, `malformedReasonsForKinds`, `FailureReason`, `DegradeKind`, `_ReasonsCoverageProof` | — | **NO CASE in this area** — nothing in these 8 gates imports the module; the first pass listed it as a reviewed production "clean file" for this area on no basis |

## Branch census

Classified for branches reachable from this area's gates.

**Reachable and untested by this area (covered by the owner elsewhere — not a gap, recorded for accuracy):**
- `notify-context.ts:319-334` — the `arm === undefined` fallback row. Covered at `tests/shared/notify-context.test.ts:339`.
- `notify-context.ts:328-332` — the frozen-row `catch`. Covered at `tests/shared/notify-context.test.ts:392`.
- `reconcile/notify.ts:359,391` — the non-default `forceInstallKeys` branch. `notify-stamp-coverage.test.ts:205` calls the one-argument form only; covered at `tests/orchestrators/reconcile/notify.test.ts:1712,1750`.
- `probe-classifiers.ts:216-218` — the `workflows` kind arm. Covered at `tests/shared/probe-classifiers.test.ts:266`, but see the parity-gate finding.

**Reachable and untested anywhere on the install side:**
- `install.messaging.ts:493-507` (`errnoReasonFromNote`) as reached through `narrowResolverReasons` — the parity gate never drives it, and no counterpart exists on the read-only surface. Reachable, and the divergence is real.
- `install.messaging.ts:515-517` — the `reason === ""` early return in `classifyResolverReason`. Not driven by the parity gate.
- `install.messaging.ts:613-618` — the "both sources empty" permissive `unsupported source` fallback. Not driven by the parity gate.

**Compiler-forced, not removable (D-116-01a class):**
- `install.messaging.ts:366-408` (`classifyEntityShapeError`) and `reinstall.messaging.ts:276` (`outcomeToPluginMessage`) — the missing `default: assertNever` arms. `tsconfig.json` sets `noImplicitReturns: true`, and every arm of both switches returns, so adding a union member makes the end of the function reachable and raises TS7030 (`reinstall`'s non-nullable `ReinstallMsg` return also raises TS2366). The silent-omission risk is already closed by the compiler for these two. See the META correction below.
- `notify-context.ts:337` — the `as unknown as` bridge. The narrow `RenderFn<Extract<Msg, …>>` cannot be assigned to `RenderFn<PluginNotificationMessage>` without it; removing the cast requires re-typing `dispatchRow`, not deleting a line.

## Grading of first-pass findings

### `tests/architecture/notify-grammar-invariant.test.ts`

- **CONFIRMED** — *Hand-rolled `MockCtx`/`MockPi` forced past the compiler with `as never`* (BLOCKER) — `lines 39-61`, used at 7 call sites; the proposed `createWireHarness` mirror does type-check without casts, so the fix is executable as written. Sequence it with META §1 (narrowing the `notify()` parameters), or this patches 2 of 14+ files.
- **CONFIRMED** — *Process-wide `mock` imported from `node:test`* (WARNING) — `line 28`, `mock.fn()` at `line 44`; no case takes a `t` parameter. Moot once the BLOCKER fix lands.
- **UNDERSTATED** — *Fixture arrays looped inside a single `test()`* (WARNING) — the recorded rationale says "the loop body contains no branching so splitting is mechanical." That is factually wrong for the GRAM case: `lines 628-630` contain a `continue` that skips every assertion, and that branch is the self-disabling bug filed as a new BLOCKER above. The split is still correct, but it is a prerequisite for the severity fix, not a standalone readability change. Raise to BLOCKER and pair it with the `expectedSeverity` field.
- **CONFIRMED** — *File header describes a retired summary grammar* (WARNING) — `lines 12-14` versus `SUMMARY_GRAMMAR` at `lines 70-71` and `summaryPhrase()`; the accurate description at `lines 64-68` is the text to promote.

### `tests/architecture/notify-will-reload-agreement.test.ts`

- **CONFIRMED** — *Hand-rolled `MockCtx`/`MockPi` forced past the compiler with `as never`* (BLOCKER) — `lines 40-61`, `line 248`.
- **CONFIRMED** — *Process-wide `mock` imported from `node:test`* (WARNING) — `line 29`, `line 45`.
- **CONFIRMED** — *Fixture arrays looped inside a single `test()`* (WARNING) — `lines 258`, `268`.
- **CONFIRMED** — *Harness duplicates `notify-grammar-invariant.test.ts` near-verbatim* (WARNING) — `lines 40-61` vs `39-61`; the recorded drift detail (`MockTool.sourceInfo` present in one, absent in the other) checks out at `notify-grammar-invariant.test.ts:49`.

### `tests/architecture/notify-stamp-coverage.test.ts`

- **REFUTED** — *`assert.deepEqual` used where the house rule is `assert.deepStrictEqual`* (WARNING) — `line 11` is `import assert from "node:assert/strict"`, under which `assert.deepEqual` **is** `assert.deepStrictEqual`. The stated rationale ("would not distinguish `1` from `"1"`") is false, and the same spelling is used deliberately throughout `compat-01-no-expansion.test.ts:181,215,251,275`. What remains is a spelling-consistency nit, not a defect. The real defect in this file is the vacuous empty-list negative at `line 209`, filed above.

### `tests/architecture/notify-closed-set-locks.test.ts`

- **OVERSTATED** — *Per-test comments read as an incremental changelog* (WARNING) — the first pass already conceded this is sanctioned by the file's own tripwire design and by the comment policy's decision-ID allowance. It is a style preference, and it is moot: the file is fully subsumed by `compat-01-no-expansion.test.ts` (new WARNING above), so the correct action is to move the provenance comments into that file's `expected` arrays, not to condense them here.

### `extensions/pi-claude-marketplace/shared/notify.ts`

- **DUPLICATE-OF** — *File size stresses the module's reviewability* (WARNING) — already owned as a planning decision in `META-FINDINGS.md` §"Decisions the fixing pass cannot make" item 2 (module splits), where it is the named seam. Keep it there; a per-area restatement adds nothing. (Note the line count: this file is **4,217** lines, not the 4,039 META and `ARCHITECTURE.md` both carry.)

## Still clean after attack

- `tests/architecture/notify-producer-wire-coverage.test.ts` — genuinely strong, and the strongest file in the area. Mutations it **does** catch: (a) stamping `"info"` explicitly instead of omitting the second `ui.notify` argument — `wireFacts` pins `severity: undefined` structurally; (b) emitting the notification twice, or not at all — the expectation is a whole-array `deepStrictEqual` of length 1; (c) changing the reload trailer's bytes — `RELOAD_TRAILER` is hand-written in the test and matched with `endsWith`; (d) probing soft deps a third time or skipping a probe — `when(() => pi.getAllTools()).thenReturn([]).twice()` plus `verify()` on all three mocks in every case; (e) reading `ctx.ui` more than once. Its only gap is coverage breadth (partial-install family), not assertion strength.
- `tests/architecture/cross-surface-reason-parity.test.ts` — catches every mutation to the duplicated hooks-prefix ladder: all four prefixes from `isHooksResolverNote` (`install.messaging.ts:478-485`) and `classifyResolverNote` (`probe-classifiers.ts:132-136`) have a row, so deleting or renaming any one on either side turns a row red. It also catches the `malformed mcp reference` arm's presence on both sides, and the multi-note ordering. The WR-01 arm-order hazard (an `lspServers` substring inside a `malformed mcp reference` note) is **not** covered here, but is covered on the probe side at `tests/shared/probe-classifiers.test.ts:208` — no install-side analogue exists because the install side gates on `startsWith("contains ")` rather than a substring, so the hazard cannot arise there.
- `extensions/pi-claude-marketplace/shared/probe-classifiers.ts` — attacked the arm order, the first-wins dedup, and the `kindToReason` fallback. Each is documented at the arm and pinned by a case in `tests/shared/probe-classifiers.test.ts`. No finding.
- `extensions/pi-claude-marketplace/shared/markers.ts` — two constants, both pinned byte-for-byte. Clean.
- `extensions/pi-claude-marketplace/orchestrators/plugin/{enable-disable,uninstall,update}.messaging.ts` — the `as const satisfies CommandContext<Status, Msg>` pin makes an omitted render arm a TS2741 at the declaration site, so the mutation "delete a render arm" cannot compile. `enable-disable.messaging.ts:203-210` has a proper `default:` arm. Clean.
- `extensions/pi-claude-marketplace/orchestrators/plugin/{install,reinstall}.messaging.ts` — the missing `default: assertNever` arms flagged in META §5 are compiler-guarded here (see Branch census). No finding beyond the dangling doc citation at `install.messaging.ts:476`.

## Not covered

- `shared/notify.ts` was again not read end-to-end (4,217 lines). I read `REASONS`/`STATUS_TOKENS` (`lines 93-364`), `redactAbsolutePaths`, `notifyUsageError`, `computeSeverity` (`2858-2903`), `shouldEmitReloadHint` (`3234-3290`), and the message-variant declarations the gates instantiate. The row-render switches and glyph constants were not re-read; `shared-notify-{a,b,c}.md` own them.
- `orchestrators/reconcile/notify.ts` (978 lines) was read at its export surface and at `buildReconcilePendingNotification`'s signature, not in full. `orchestrators-reconcile-notify.md` owns it.
- I did not run any test, per the brief. Every "would still pass" claim above is derived by reading the assertion and the production path it exercises; the empty-render and severity-`continue` claims are structural (a filtered-to-empty loop and an early `continue`) and do not depend on execution.
- The 99 retired-vocabulary hits in `tests/` were counted with the guard's own regex set; I did not classify each one as legitimate-vs-stale. `tests/edge/handlers/plugin/reinstall.test.ts:768-780` is verified legitimate; `tests/orchestrators/plugin/list.test.ts:1154-1197` is verified stale. The remaining ~95 need triage by the areas that own those files.

## Meta-findings impact

### New cross-cutting evidence

**1. Production comments cite test modules that do not exist — three instances, and one of them is load-bearing.** `grep -rn "tests/" extensions/pi-claude-marketplace | grep -oP "tests/[A-Za-z0-9/._-]+"` yields 22 distinct cited paths; three do not resolve:

| Citing site | Cited path | Reality |
| --- | --- | --- |
| `tests/architecture/markers-snapshot.test.ts:18` | `tests/architecture/no-legacy-markers.test.ts` | does not exist; the 5 ES-5 literals are unguarded |
| `orchestrators/plugin/install.messaging.ts:476` | `tests/orchestrators/plugin/cross-surface-reason-parity.test.ts` | lives at `tests/architecture/` |
| `shared/notify.ts:374` | `tests/shared/notify-v2.test.ts` | does not exist |
| `orchestrators/plugin/info.ts:1124` | `tests/orchestrators/plugin/info-manifest-absent.test.ts` | does not exist |

This is a new instance of the "gates that do not gate" class, arriving from the opposite direction: not a gate that scans the wrong file, but a **citation asserting a gate that was deleted**. `docs/messaging-style-guide.md:174` and `docs/output-catalog.md:2890` repeat the `no-legacy-markers` claim, so three documents and one test header agree on a gate that is not in the tree. **Recommend adding to the "audit every architectural gate" workstream a mechanical step: assert that every `tests/…` path cited in `extensions/**` and `docs/**` resolves.** That check is ~15 lines and would have caught all four. Other areas should check their own modules' citations — `orchestrators-plugin-info.md` and `shared-notify-*.md` own two of the four above.

**2. `noImplicitReturns` already closes the silent-omission risk for return-only switches.** `tsconfig.json` sets `noImplicitReturns: true`. For a `switch` over a closed union where **every arm returns**, omitting `default: assertNever` is not a silent-omission hazard: adding a union member makes the end of the function reachable and raises TS7030 (and TS2366 when the return type is non-nullable). This is the repo's own recorded lesson (`switch-exhaustiveness-ts7030.md`). Areas that filed a missing-`default` finding should re-check whether their switch is return-only or statement-only; only the statement-only case is a real hazard.

**3. A recurring vacuity shape: the filtered-then-compared-to-empty assertion.** Three distinct files in this area assert `deepStrictEqual(filtered, [])` or `assert.ok(!x.includes(…))` as the *sole* content check, each of which passes when the producer emits nothing at all. This is a sibling of META §3's fragment-assertion cluster but is not the same defect and will not be found by grepping for `.includes(`. **Recommend a repo-wide grep for `, [])` and `assert.ok(!` in `tests/**`** — every hit needs a positive assertion of the unfiltered value beside it.

**4. Retired-vocabulary drift is not confined to `extensions/`.** The D-75-01 rename left 21 sites in `extensions/` (including 2 exports) and ~99 in `tests/`, all invisible to the guard that exists to prevent exactly this. Areas holding `tests/orchestrators/plugin/{list,install,update,info}.test.ts`, `tests/orchestrators/marketplace/update.test.ts`, `tests/domain/resolver.test.ts`, and `tests/shared/notify.test.ts` should expect a wording sweep, and `orchestrators-reconcile-*` should expect a rename of two production exports.

### Corrections to META-FINDINGS.md

- **"Restore exhaustiveness on closed-union switches" (§Ranked by leverage item 5)** lists `orchestrators/plugin/install.messaging.ts` and `orchestrators/plugin/reinstall.messaging.ts` as WARNING members of "the silent-omission class: adding a member to a closed set compiles clean at every derivation site." **For these two modules that is wrong.** `install.messaging.ts:366-408` and `reinstall.messaging.ts:276` are both return-only switches under `noImplicitReturns: true`, so a new member makes the function's end reachable and fails to compile (TS7030; `reinstall`'s non-nullable `ReinstallMsg` return also gives TS2366). Adding `default: assertNever` there improves the error message, nothing more. The claim may still hold for `orchestrators/reconcile/{plan,apply}.ts` — those were not in my scope and should be re-checked for whether their switches return from every arm. **Correction: split item 5 into "statement-only switches (real hazard)" and "return-only switches (compiler-guarded, cosmetic)" before planning.**

- **"Gates that do not gate" lists five instances.** My area adds three more, all in files the first pass declared clean: the D-75-01 vocabulary guard's camelCase blind spot and its test-tree scan hole (`partial-vocabulary-guard.test.ts`), the WILL-02 gate that only renders one side of the agreement (`notify-will-reload-agreement.test.ts`), and the GRAM-01/04/05 gate that skips its own assertions when severity is not stamped (`notify-grammar-invariant.test.ts`). **The count should read eight**, and the pattern is now strong enough to state as a rule: in this repo, a gate named for an invariant tends to test the half of the invariant that was easy to reach.

- **"`shared/notify.ts` (4,039 lines)"** (§Decisions item 2) — the file is **4,217** lines (`wc -l`). `ARCHITECTURE.md` carries the same stale figure. Minor, but the number is quoted as a sizing input for the module-split decision.

- **`_CLEAN-LIST-REPAIR.md` records `compat-01-no-expansion.test.ts` as "No findings — model for the rest of the area."** I confirm the file's assertion quality, but it now carries one stale artefact: its own "MUST NOT be added to this file" note (`lines 56-58`) reserves the length pins for `notify-closed-set-locks.test.ts`, whose four cases its own enumeration pins make unfalsifiable. Its `STATUS_TOKENS` assertion message (`line 219`) also repeats the retired "four head-of-tuple tokens drive the reload hint" claim. Both are one-line edits and belong in the same change as the deletion.

### Confirmations

- **§1 "Narrow the over-wide context parameters" — independently confirmed.** Both `as never` files in this area exist solely because `notify(ctx: ExtensionContext, pi: ExtensionAPI, …)` demands full SDK objects. `notify-producer-wire-coverage.test.ts:52-65` is the counter-proof from inside the same directory: `mock<ExtensionContext>({ exactParams: true })` satisfies the same parameter with **zero** casts. So the cluster is real, and the workaround is already demonstrated next door — but narrowing the production parameter is still the change that removes the need for a three-mock harness at every call site.

- **§"The dominant shape: sibling drift" — confirmed, and now demonstrated *within a single file*.** `notify-grammar-invariant.test.ts:458` guards its loop with `assert.ok(lines.length > 0)`; the structurally identical loops at `line 419` and `line 593` in the same file do not. The known-good form was two hundred lines away and still did not propagate.

- **§"Patterns to propagate" — `tests/architecture/source-scan.ts` under-used.** Confirmed for this area: `partial-vocabulary-guard.test.ts:50` recomputes `REPO_ROOT` locally while its neighbour `compat-01-no-expansion.test.ts:95` imports it from the shared helper. That is one of the five hand-rollers META counts.

- **§"Clean verdicts are not reliable" — confirmed emphatically.** Every one of this area's six new BLOCKERs came from a file the first pass listed under `### Clean files` or gave a single non-blocking WARNING. The findings it *did* record are all real (7 CONFIRMED, 1 understated, 1 overstated, 1 refuted on a factual error about `node:assert/strict`).
