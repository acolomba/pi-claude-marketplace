---
phase: 98-lifecycle-regression-and-contract-documentation
fixed_at: 2026-08-10T04:20:00Z
review_path: .planning/phases/98-lifecycle-regression-and-contract-documentation/98-REVIEW.md
iteration: 2
findings_in_scope: 12
fixed: 12
skipped: 0
status: all_fixed
---

# Phase 98: Code Review Fix Report

**Fixed at:** 2026-08-10T04:20:00Z
**Source review:** `.planning/phases/98-lifecycle-regression-and-contract-documentation/98-REVIEW.md`
**Iteration:** 2 (cumulative -- covers both fix rounds)

**Summary:**

- Findings in scope: 12 across two rounds
  - Iteration 1: CR-01 + WR-01..WR-08 (9)
  - Iteration 2: WR-09, WR-10, WR-11 (3) -- all raised against iteration 1's own commits
- Fixed: 12
- Skipped: 0
- Carrier todos created: 0

**Verification (iteration 2):**
`PI_SUBAGENTS_ROOT=… npm run check` -> `CHECK_EXIT=0` (typecheck + ESLint + Prettier + 3386
passing unit/integration tests, 0 failures, 1 pre-existing skip; plus the 18-test e2e suite).

**Where it ran:** the phase worktree `.worktrees/manifest-independent-plugin-info`, on branch
`features/manifest-independent-plugin-info` -- the same tree the commits below land in, so the
numbers reproduce from a plain checkout of that branch. The agent's own throwaway worktree was
NOT used: it carries no `node_modules` and therefore cannot run this project's gates.
Log: `/tmp/claude-1000/-home-acolomba-pi-claude-marketplace/d4af6d08-e357-4f4d-bf0a-f953c0bf6cae/scratchpad/98-fix2-check.log`.

`pre-commit` was run over every changed path before each commit. All hooks pass except
`trufflehog`, which fails structurally in a linked worktree (git-mode scan cannot read
`.git/index`); a filesystem scan over the same paths was run instead for each commit and
returned `verified_secrets: 0, unverified_secrets: 0`.

## Fixed Issues -- iteration 2

### WR-09: `reinstall`'s own success row discarded the degraded-kinds signal

**Files modified:** `extensions/pi-claude-marketplace/shared/notify.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/reinstall.messaging.ts`,
`docs/output-catalog.md`, `docs/messaging-style-guide.md`,
`tests/architecture/catalog-uat.test.ts`, `tests/orchestrators/plugin/reinstall.test.ts`
**Commit:** `94f1c8a4`
**Applied fix:** `PluginReinstalledMessage` gained an optional `reasons` brace -- the same
optional discipline `PluginInstalledMessage` already carries, for the same reason -- and the row
now composes `malformedReasonsForKinds(outcome.degradedKinds)` with the WARN-01 `info -> warning`
raise. A clean reinstall composes an empty list and renders byte-identically (NREG-01).

**Three composers, not one, had to change.** The review cited the bulk cascade mapper
(`reinstall.ts:917-934`), but its own reachability argument runs through the STANDALONE verb,
which composes its row at a different site (`reinstall.ts:353`) -- and neither of those is what
actually renders: `/claude:plugin reinstall` dispatches through `REINSTALL_CONTEXT`'s command-local
render map (`reinstall.messaging.ts`), which passed `undefined` for reasons independently of the
central `renderPluginRow` arm. Fixing only the cited site would have raised the severity while
still dropping the brace. The two orchestrator composers were then folded into ONE
(`reinstalledRowFromOutcome`), so the standalone and bulk surfaces cannot report the same ledger
run differently -- which is the finding's actual claim, and which also kept
`outcomeToPluginMessage` under the cognitive-complexity ceiling that the inlined version tripped.

The tally reads `Plugin reinstall: 1 warning`, not `1 success`: the trailing tally counts by
STAMPED severity, so the raise carries into it. That is recorded in the catalog prose rather than
worked around -- inventing a second counting vocabulary to keep the word "success" would be the
worse trade.

Repinned in the same commit: the `reinstall-degraded-component` catalog state and its UAT fixture,
the style guide's optional-`reasons` bullet (which claimed only the required-carriers exist), and
byte assertions through the public verb for BOTH the degraded row and the clean one. The clean-row
assertion is the NREG-01 guard: without it a future change to the brace logic could regress every
ordinary reinstall silently.

### WR-10: the WR-02 partition flip silently changed the autoupdate no-op gate

**Files modified:** `extensions/pi-claude-marketplace/orchestrators/marketplace/update.ts`,
`docs/output-catalog.md`, `tests/architecture/catalog-uat.test.ts`,
`tests/orchestrators/marketplace/update.test.ts`
**Commit:** `f6b1a5c2`
**Applied fix:** Kept the new behavior and pinned it; did NOT widen `cascadeIsNoOp`.

The choice was between the two the review named, and the documented contract already decides it.
The gate's own comment says `updated` / `skipped` / `failed` outcomes are NOT no-ops -- only
`unchanged` is, and `unchanged` means the resolved version matched the record exactly and NOTHING
was written. A disabled-record refresh rewrites the record's version, `resolvedSource`,
`resolvedSha` and `compatibility` block; it only declines to re-materialize artifacts. So the WR-02
flip did not knock this case out of a bucket it belonged in -- it moved the case into a bucket the
contract already excluded, and it belongs there. Widening the gate would have restated at the
marketplace level (`{up-to-date}` over a moved pin) the exact falsehood WR-02 removed from the
plugin row one level down.

Added the missing coverage the review named: an end-to-end case that seeds an autoupdate-ON path
marketplace with a disabled record pinned at the plugin's current content hash, moves the plugin
CONTENT while leaving `marketplace.json` byte-identical, and asserts the whole cascade-rows byte
form. The scenario is only reachable because the hash-version ladder is content-derived, so the
fixture declares no version in either `plugin.json` or the manifest entry (tier-3 resolution). The
case was verified to be discriminating, not merely passing: widening `cascadeIsNoOp` to admit
`skipped` makes it fail with the collapsed one-line form.

Also added the `update-autoupdate-disabled-repin` catalog state with its UAT fixture, and amended
the `update-autoupdate-noop-skipped` prose to say which partitions leave the gate and why
`unchanged` is the only one that qualifies.

### WR-11: the `Omit`-based signal subset re-opened the WR-03 drift channel

**Files modified:** `tests/architecture/compat-01-no-expansion.test.ts`,
`extensions/pi-claude-marketplace/orchestrators/plugin/install.ts`
**Commit:** `9e94195a`
**Applied fix:** Added the compile-time key-set pin to the COMPAT-01 gate (the review's second
option -- it keeps the production module clean and puts the pin beside the sibling key-set clause
that already owns this idiom).

Two deviations from the suggested snippet, both deliberate:

1. **`Record<K, true>` rather than a `satisfies` array.** A `satisfies readonly K[]` array catches
   a key REMOVED but not a key ADDED -- the listed members stay a valid subset -- and adding a
   signal is precisely the drift direction the finding is about. A `Record<K, true>` object literal
   is bidirectional: a new key fails as a missing property, a removed one fails as an excess
   property. Verified by patching a sixth signal into `LedgerDegradationSignals`: `tsc` fails with
   `TS2741 Property 'sixthSignal' is missing`.
2. **The key type is DERIVED from `InstallPluginOutcome`, not from a restated `Omit` list.**
   Restating the exclusion list in the gate would have made the gate drift-prone in its own right
   (change the exclusions in `install.ts` and the gate keeps pinning the old set). Deriving it as
   `keyof InstalledOutcome & keyof LedgerDegradationSignals` makes BOTH halves live. The expected
   member list is still hand-written, so this is not the derived-expectation tautology the gate
   file's header forbids.

The member names are not restated as string literals in the runtime assertion: the D-75-01
vocabulary guard forbids the quoted dropped-component key anywhere under `tests/architecture`, and
the object literal's unquoted keys carry the pin regardless. The runtime clause reports; the type
is the gate.

The `install.ts` comment now names the gate rather than asserting the guarantee, which is what the
review asked for -- the sentence "every field it keeps is populated below" was true but unenforced.

## Fixed Issues -- iteration 1

Detail for CR-01 and WR-01..WR-08 is unchanged from the first round; the re-review verified all
nine at the source and confirmed each. Commits, in order:

| Finding | Commit | One-line |
|---------|--------|----------|
| CR-01 | `f8575e3d` | Minted `STALE_GATE_UPDATE_HINT_TRAILER`; split the renderer gate so the frozen XSURF-03 literal stays byte-frozen |
| WR-01 | `d1287a30` | `widensPartialGate` = disabled AND already degraded, so a clean disabled record keeps its decline row until `--partial` consents |
| WR-02 | `d105651f` | The disabled-record refresh returns `skipped` + `already disabled` instead of claiming `{up-to-date}` over a moved pin |
| WR-03 | `8e00b806` | The `installed` arm excludes the two staged-count verdicts and populates every field it keeps |
| WR-04 | `06773b3f` | The backfill arm inherits both ledger signals from the one shared shape |
| WR-05 | `d3f4735f` | `staleGateDropped` returns `undefined` for an empty narrowing, so `??` cannot discard the base reasons |
| WR-06 | `793449a2` | A missing scan target fails the gate instead of being silently skipped |
| WR-07 | `15aa4deb` | The glyph clause anchors on the declaration form, catching all three spellings |
| WR-08 | `7952c086` | The catalog's glyph names for `◉` / `◍` corrected and gated pairwise |
| (follow-up) | `f805bea1` | Re-expressed the WR-03 subset and two comments to stay inside the D-75-01 vocabulary |

## Notes for the verifier

- **Two rendered-byte contracts changed this round**, each repinned with its catalog block, its
  catalog prose and its byte assertions in the same commit: the `(reinstalled)` degrade brace
  (WR-09) and the autoupdate cascade over a disabled re-pin (WR-10). Both new catalog states were
  verified to be genuinely gated -- perturbing the catalog block fails the byte-equality clause.
- **No closed set gained or lost a member.** `malformed skill` / `malformed command` are inherited
  `FailureReason` members; `already disabled` is an inherited `IdempotentReason`; `skipped` and
  `reinstalled` are inherited statuses. The only structural widening is an OPTIONAL `reasons` field
  on one existing message variant, which the `installed` variant already established as a shape.
- **The WR-09 severity raise is load-bearing on the tally**, not only on the summary line. A
  degraded bulk reinstall now reads `Plugin reinstall: 1 warning`. If that reads wrong to the
  operator, the lever is the tally's severity-derived counting, not this row.
- **WR-10 kept a behavior rather than restoring bytes.** If the intent was ever that an
  autoupdate-ON marketplace stays silent while a disabled plugin's pin moves underneath it, this is
  the decision to revisit -- the gate would then need an explicit disabled-refresh disjunct, and
  the new catalog state would be replaced rather than amended.
- **No deferrals**, so no carrier todos were created in `.planning/todos/pending/`.

---

_Fixed: 2026-08-10T04:20:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
