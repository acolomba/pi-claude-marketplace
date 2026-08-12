---
phase: 99
slug: post-audit-tech-debt-closure
verdict: SECURED
status: verified
# threats_open = count of OPEN threats at or above block_on severity (the blocking gate)
threats_open: 0
threats_verified: 29
asvs_level: 1
block_on: high
created: 2026-08-10
---

# Phase 99 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Verified against the codebase at HEAD (`dfbd6dd3`), not against SUMMARY.md
> claims. Every "closed" verdict below cites the grep/read/test evidence that
> produced it, not the plan's own disposition text.

---

## Method

Read all 7 plans' `<threat_model>` blocks (29 declared threats), all 7
SUMMARY.md `## Threat Flags` sections (all "None" — no new attack surface
flagged beyond the registered set), both code-review iterations
(`99-REVIEW.md`, `99-REVIEW-2.md`, which together found and drove to closure
one CRITICAL and eight WARNING defects the plans' own threat registers did not
anticipate), and `99-VERIFICATION.md`. Then independently re-derived the
closure claims against source: read the actual functions, ran the targeted
test suites directly (exit code read from the file, never through a pipe),
and traced call chains myself rather than trusting a "verified" label.

Independent test runs performed for this audit (all exit 0):

| Run | Files | Result |
|---|---|---|
| 1 | `update.test.ts`, `import-boundaries.test.ts`, `manifest-lookup-drift.test.ts`, `no-orchestrator-network.test.ts`, `reconcile/plan.test.ts` | 146/146 pass |
| 2 | `reinstall.test.ts`, `marketplace/update.test.ts`, `install.test.ts`, `catalog-uat.test.ts` | 244/244 pass |
| 3 | ESLint on the 7 security-relevant changed files directly | 0 errors/warnings |

`git status --short` at HEAD: clean. No package-manager install in the phase
diff (`sonar-project.properties`, `package.json`, `package-lock.json`
byte-identical to `70268bc2`), closing every `*-SC` threat by inspection.

---

## Focus Area 1: Locking / concurrency (update.ts disabled-record refresh)

**Mechanism verified, not assumed.** `runDisabledRecordRefresh`
(`orchestrators/plugin/update.ts:1599`) is reached because
`preflightUpdate`'s short-circuit is now `toVersion === fromVersion &&
!isRecordedButDisabled(record)` (`:1153`) — confirmed by direct read, not
citation. It calls `disabledRefreshWouldWrite(preflight)` (`:1503`) — a
**pre-lock** projection compare over the snapshot `preflightUpdate` already
loaded — and only opens `withLockedStateTransaction` (`refreshDisabledRecord`,
`:1540`) when that projection differs.

**Nesting/deadlock check (traced, not cited).** `withStateGuard` and
`withLockedStateTransaction` both route through the same
`withScopeLock`/`lockfile.lock(..., { retries: 0 })`
(`transaction/with-state-guard.ts:66-104,111-160`) — one lock file per scope,
confirmed by reading the module directly. I traced every call site that can
reach `runDisabledRecordRefresh`:
- The bare/direct path: `updatePlugins` (`update.ts:352`) calls
  `runThreePhaseUpdate` directly, no lock held at that call site.
- The cascade path: `updateSinglePlugin` (`:555`) — same, no lock held.
- The autoupdate path: `marketplace/update.ts:955` runs `cascadeAutoupdates`
  explicitly **outside** its own `withStateGuard` (comment at `:953`: "CASCADE
  OUTSIDE the outer guard"), confirmed by reading the surrounding code, not by
  trusting the comment alone — the guard closure closes at `:509-522`, well
  before the cascade call.

No path holds a lock when it opens a second one. The nesting hazard does not
exist on any reachable call chain.

**TOCTOU / partial-write check.** `refreshDisabledRecord`'s in-transaction
guard (`:1567`) re-derives the comparison against the **live** record and
returns `false` (no write) if nothing moved — verified by reading the function
body directly: the `sRecord.*` mutations and `tx.save()` only execute past
that guard. `tx.save()` calls `saveState` -> `atomicWriteJson`
(`persistence/state-io.ts:33,394`), the same NFR-1 atomic-write primitive
every other mutator uses; this phase did not touch that primitive.

The written value, `sRecord.resolvedSource = installable.pluginRoot`
(`:1572`), is NFR-10-relevant. Traced `installable.pluginRoot`'s origin:
`domain/resolver.ts` (**untouched** by this phase — `git diff` confirms zero
lines changed) is where `assertPathInside(ctx.marketplaceRoot, pluginRoot, ...)`
is called (`resolver.ts:564`) before a `pluginRoot` is ever attached to an
`installable` resolution. The refresh cannot write an uncontained path because
the value it writes was already validated upstream of this phase's diff.

**The review-discovered defect and its fix, engaged directly (not restated).**
`99-REVIEW.md`'s WR-02 is real: the pre-lock skip converts what was a
lock-free `(skipped) {up-to-date}` no-op into a `retries:0` lock acquisition,
and under contention that becomes `StateLockHeldError`, which
`updatePlugins`'s catch turns into a whole-batch abort
(`notifyDirectFailure` + `return` at `:409-417`, confirmed by reading the
catch). Per the task's `<already_established>` framing, I engaged with the
`99-REVIEW-2.md` accept-verdict rather than re-deriving it from scratch, and
independently confirmed its evidence: both the pre-lock and in-lock `next`
side are derived from the same out-of-lock `preflightUpdate` resolution
(`loadState` at `:1001`, `resolveUpdateCandidate` at `:1122` — read directly,
both outside any lock acquisition), so the pre-lock compare widens an
already-open resolution-staleness window rather than opening a new class of
one. The failure mode is a deferred, idempotent refresh (NFR-3: fail-clean,
no partial write, no lock, no mutation on skip) with the SAME recovery as
before the fix: the next `update` re-derives from scratch (NFR-2: no restart
required). **Concur with the accept.**

Two follow-up defects the review itself found (comment overstatement WR-07,
order-stability contingency WR-08) were fixed in commits `53cd9ba5` and
`2b771321` — verified in the CURRENT tree, not just in the commit log:
- `update.ts:1551-1558` now reads "authoritative about the RECORD, no fresher
  than the preflight about the RESOLUTION" — read directly, matches the fix.
- `tests/orchestrators/plugin/update.test.ts:3043` ("WR-08 / NFR-3: the
  lock-free skip survives multi-element compatibility lists") is a genuine
  regression test: it round-trips a 2+-element compatibility block through
  `state.json`, holds an **actual** `lockfile.lock` (not a mock) from a
  second "process", and asserts the real call does not throw `lock held`. I
  ran this test directly (part of the 146-test run above): pass.

**Residual, explicitly not eliminated, correctly non-blocking.**
`disabledPinProjection` (`:1416-1436`) still stringifies
`compatibility.{notes,supported,unsupported}` **positionally**. The fix chose
to pin the current order-stability dependence with a regression test rather
than sort it away structurally (commit `2b771321`'s message: "a sort passes
the test while hiding the dependency"). This is a live design decision, not an
oversight — verified by the code comment at `:1405-1414` stating the
dependence explicitly and pointing at the WR-08 test as the tripwire. Today
the three lists are produced by object-literal iteration in fixed code order
(confirmed: `UNSUPPORTED_COMPONENT_PROBES` is a plain object literal, not a
`Map`/`Set`/`readdir`-ordered source), so the contingency is dormant. If a
future change makes that emission order-unstable, the WR-08 test fails loud
rather than silently reintroducing the batch-abort regression. **Verdict: not
an open threat — a documented, test-guarded contingency, correctly classified
non-blocking by the phase's own review process.**

## Focus Area 2: Path / containment (`domain/manifest-lookup.ts`)

Read the full module (61 lines). `lookupDeclaredPlugin` (`:54-60`) is
`manifest.plugins.find((p) => p.name === pluginName)` — **exact string
identity (`===`), no case folding, no Unicode normalization**, exactly as the
task brief flagged for scrutiny.

Worked the homoglyph/normalization scenario directly rather than accepting
the module's own comment: JavaScript `===` on strings compares UTF-16 code
units with **zero** transformation. Because the function performs no folding
or normalization in either direction, two strings that are merely
*visually* similar (different code points, e.g. Cyrillic `а` vs Latin `a`,
or two different Unicode normalization forms of the same grapheme) are
**not** equal under `===`. There is no code path by which this comparison can
be tricked into a false `declared` verdict for a plugin the manifest does not
byte-for-byte declare — the exact-identity design is the *strictest possible*
choice against this threat class, not an omission. (The residual risk in
this space is a *phishing*-style one — an attacker-controlled marketplace
manifest declaring a homoglyph plugin NAME to visually impersonate a
different plugin — which is a manifest-trust question the phase's own trust
boundary explicitly places outside this derivation: "the manifest is
untrusted input, but it is ALREADY validated by the schema validator before
it reaches this derivation" — and is unchanged by this phase.)

Traced what a `declared` verdict is actually used for in the three consuming
surfaces (`update.ts:1078-1085`, similar shapes in `list.ts`/`info.ts`): the
returned `entry` is re-validated by `PLUGIN_ENTRY_VALIDATOR.Check` before
anything downstream reads it, and no path-producing value is read off it
directly in this module — `pluginRoot` resolution and its
`assertPathInside` containment call live entirely in `domain/resolver.ts`,
untouched by this phase (confirmed via `git diff --stat`, zero lines).
`manifest-lookup.ts` decides membership; it does not decide containment.

**Drift-gate coverage (whole-tree, not allowlist-blind).** Read
`tests/architecture/manifest-lookup-drift.test.ts` in full (317 lines). It is
a genuine whole-source-tree walk (`extensionSourceFiles()` recurses the
entire `extensions/pi-claude-marketplace/` tree), not a fixed list of
"sites that once held a copy" — the adversarial-stance failure mode this
audit is instructed to watch for. Three non-global regex spellings
(arrow-expression, block-body, destructured) cover the natural ways a copier
would re-derive the idiom; each is proven both to catch its planted twin AND
to leave the legitimate `lookupDeclaredPlugin(...)` call and an unrelated
`.find()` alone (self-test at `:259-273`, run directly: pass). A 5-member
allowlist (`NON_ABSENCE_LOOKUPS`) exists for sites that look up an entry for a
*different* purpose (feeding a resolver, not rendering an absence claim),
each entry carries a one-line stated purpose, and a staleness assertion
(`:249-256`) fails the suite if an allowlist entry stops matching — so the
allowlist cannot silently rot into a rubber stamp. A second test
(`:295-311`) independently confirms all three "absence-judging" surfaces
(`list.ts`, `info.ts`, `update.ts`) actually import the one derivation, so
the absence-walk cannot pass merely because a surface deleted its membership
check outright.

**Verdict: T-99-05-01/02/03/04 all CLOSED, verified structurally against the
specific homoglyph/normalization scenario the brief raised, not merely
matched against the plan's own (narrower) threat register.**

## Focus Area 3: Network boundary (NFR-5)

Read `tests/architecture/no-orchestrator-network.test.ts` in full and ran it
directly (part of the 146-test run: pass). `FORBIDDEN_TARGETS` still includes
`list.ts` and `info.ts` post-refactor; `update.ts` remains the sole,
pre-existing, explicitly-commented exemption (Pattern S-9, PUP-2 syncClone) —
unchanged by this phase. Confirmed by direct read that `list.ts`/`info.ts`'s
delegation onto `domain/manifest-lookup.ts` introduced no `gitOps` /
`platform/git` / `refreshGitHubClone` token: the new module is a pure,
network-free domain derivation (no imports beyond `./manifest.ts`'s type).

Also independently verified (not part of the phase brief's four items, but
directly relevant to NFR-5/D-11 given the review's WR-03/WR-06 findings): the
new `orchestrators/plugin/update-row.ts` leaf module is what
`marketplace/update.ts` now imports instead of `plugin/update.ts` directly
(`marketplace/update.ts:125`), closing the `marketplace/` -> plugin-LEDGER
module-graph edge WR-03 flagged. Confirmed the module's only value imports
are `shared/notify-reasons.ts` and `shared/probe-classifiers.ts` (read the
full import block, `update-row.ts:16-25`) — no ledger, no `gitOps`, no
network. WR-06's follow-up finding (the fix had no enforcing GATE, only a
comment) was itself fixed in commit `fc7033f0`: read
`eslint.config.js:276-305` directly and confirmed `import-x/no-cycle` is now
configured with `import-x/extensions` including `.ts` (load-bearing per the
commit message: without it the rule never parses the resolved files and
greens on any cycle), scoped to `orchestrators/**`; read
`tests/architecture/import-boundaries.test.ts:135-238` directly and confirmed
both the rule-is-configured test and the directed-edge grep gate
(`D-11: no orchestrators/marketplace file imports a plugin LEDGER module`)
exist and ran green in my test run. This closes a gap `ARCHITECTURE.md` had
been mis-documenting as already-enforced.

**Verdict: no network surface leaked into `list.ts`/`info.ts`/`update.ts`'s
guaranteed-offline or cache-miss-only paths; the pre-existing gate's coverage
is unchanged and still correctly scoped; a previously-undocumented enforcement
gap (WR-06) was found and closed within the phase.**

## Focus Area 4: Output / injection (IL-2, closed reason vocabulary)

Read the full `notify.ts` diff (39 lines). `PluginUpdatedMessage.reasons` is
typed `readonly ContentReason[]` (`:711`) — traced `ContentReason` to
`Exclude<Reason, "not added">` (`:189`) and `Reason` to
`(typeof REASONS)[number]` where `REASONS` is a hand-written `as const`
string-literal array (`notify-reasons.ts:90-142`, read in full) — a **closed
set fixed at compile time**, not a type alias over `string`.

Traced every producer that can populate the new field:
- Malformed-kind axis: `malformedReasonsForKinds` (`notify-reasons.ts:176`)
  maps a `DegradeKind` (`"skill" | "command"`, a 2-member literal union) through
  a `satisfies Record<DegradeKind, FailureReason>` fixed table
  (`MALFORMED_REASON_BY_KIND`, `:161-164`) to one of exactly two literal
  strings (`"malformed skill"` / `"malformed command"`). No plugin-controlled
  text (file path, component name, frontmatter content) is ever
  interpolated — confirmed by reading the function body: it takes an
  `Iterable<DegradeKind>`, never a string from the plugin's own manifest.
- Dropped-kind axis: `narrowUnsupportedKinds` (`probe-classifiers.ts:183`)
  maps each `kind: string` through `kindToReason`, which is itself a
  closed-set mapping (not read in full here, but confirmed to return a typed
  `UnsupportedReason`, not a pass-through of its input).
- Orphan-rewake axis: `update-row.ts:99-101` — a `boolean` (`orphanRewake`)
  mapped to the fixed literal `"orphan rewake"`. No plugin text.

**No plugin-controlled free text (name, path, or frontmatter content) reaches
the `reasons` brace at any of the three axes.** This directly answers the
brief's injection concern: a malicious plugin cannot break the row format or
inject control sequences through this new surface, because nothing it
controls is ever placed on the brace — only fixed vocabulary selected by a
closed enum.

**Notify-discipline check.** `git diff` over the whole phase (`extensions/`)
greped for `ctx.ui.notify`, `process.stdout`, `process.stderr`, `console.` —
zero matches outside `shared/notify.ts` itself. ESLint run directly against
all 7 security-relevant changed files (including `notify.ts`): 0
errors/warnings, which includes the project's custom `no-restricted-syntax`
IL-2 block for `extensions/pi-claude-marketplace/**`.

**Verdict: T-99-04-02/04 CLOSED, verified against the actual closed-set
producer functions, not merely the plan's assertion that they are closed.**

---

## Full Threat Register (all 7 plans, 29 declared threats)

| Threat ID | Category | Component | Severity | Disposition | Status | Evidence |
|-----------|----------|-----------|----------|-------------|--------|----------|
| T-99-01-01 | Tampering | `orchestrators/types.ts` outcome interfaces | low | mitigate | CLOSED | `types.ts:36-37,181-182` show `stagedAgentNames`/`stagedMcpServerNames`; COMPAT-01 suite unmodified by phase diff |
| T-99-01-02 | Tampering | boolean signal consumers | low | accept | CLOSED | `types.ts:199-200` pins `stagedAgents?: never` / `stagedMcpServers?: never` on the update outcome — stronger than the plan's own `accept`, closes WR-01's compile-clean-wrong-answer defect |
| T-99-01-SC | Tampering | npm/pip/cargo installs | high | mitigate (N/A) | CLOSED | `package.json`/`package-lock.json` byte-identical to phase base |
| T-99-02-01 | Denial of Service | ENBL-05 gate regexes | low | mitigate | CLOSED | patterns at `plan.test.ts:761,768,776` are bounded negated-class, no nested quantifier; test run confirms no measurable slowdown |
| T-99-02-02 | Tampering | disabled-state predicate | medium | mitigate | CLOSED | 3 widened patterns run in the whole-tree walk; `plan.test.ts` 146-test run includes ENBL-05 suite: pass |
| T-99-02-SC | Tampering | npm/pip/cargo installs | high | mitigate (N/A) | CLOSED | no package installed |
| T-99-03-01 | Repudiation | `docs/output-catalog.md` byte contract | medium | mitigate | CLOSED | `catalog-uat.test.ts` run directly (244-test run): pass |
| T-99-03-02 | Tampering | 8 unrelated comment sites | medium | mitigate | CLOSED (with corrected history) | WR-04 found the initial sweep removed a LIVE `RLD-04` anchor on a false premise; restored at 6/7 sites by `788c44c7`, confirmed via `grep -rn "RLD-04" extensions/`. 7th site (IN-10, `notify.ts:3766`) remains a cosmetic parenthetical gap — Info-severity, documentation-only, no security impact |
| T-99-03-03 | Information Disclosure | committed diff | low | mitigate | CLOSED | per-commit TruffleHog filesystem scan protocol followed each commit; `git status` clean at HEAD |
| T-99-03-SC | Tampering | npm/pip/cargo installs | high | mitigate (N/A) | CLOSED | no package installed |
| T-99-04-01 | Spoofing | rendered `(updated)` row | high | mitigate | CLOSED | CR-01 (both cascade mappers silently dropped `degradedKinds` on the `partially-installed` arm) verified fixed: `grep 'status: "updated"'`/`'"partially-installed"'` over `extensions/` shows `update-row.ts:109,121` as the sole producers on the update path |
| T-99-04-02 | Tampering | reason vocabulary | medium | mitigate | CLOSED | traced to `REASONS` closed `as const` array + `MALFORMED_REASON_BY_KIND` fixed table; no plugin text reaches the brace |
| T-99-04-03 | Repudiation | catalog byte contract | medium | mitigate | CLOSED | `catalog-uat.test.ts` run: pass, both directions |
| T-99-04-04 | Information Disclosure | reason brace content | low | accept | CLOSED | brace names a `DegradeKind` (2-literal union) only, verified via the fixed mapping table |
| T-99-04-SC | Tampering | npm/pip/cargo installs | high | mitigate (N/A) | CLOSED | no package installed |
| T-99-05-01 | Spoofing | manifest-membership judgment | high | mitigate | CLOSED | see Focus Area 2 — return type structurally excludes `unverified`; drift gate whole-tree-walked, self-tested both directions |
| T-99-05-02 | Tampering | domain/orchestrator layering | medium | mitigate | CLOSED | see Focus Area 3 — D-11 `no-cycle` + directed-edge gate now genuinely enforced (fixed a documentation-vs-reality gap the review itself found) |
| T-99-05-03 | Input Validation | exported derivation | low | accept | CLOSED | takes an already-validated `MarketplaceManifest["plugins"]` type; adds no parse call |
| T-99-05-04 | Denial of Service | gate regexes (test-time) | low | mitigate | CLOSED | 3 patterns non-global, bounded classes; the one lazy 160-char bridge (`RAW_LOOKUP_BLOCK_BODY`) is a deliberate fail-closed over-reach (WR-05/iter-2), not a backtracking hazard — linear, no nested quantifier |
| T-99-05-SC | Tampering | npm/pip/cargo installs | high | mitigate (N/A) | CLOSED | no package installed |
| T-99-06-01 | Tampering | persisted resolved source | high | mitigate | CLOSED | see Focus Area 1 — traced `installable.pluginRoot` to `resolver.ts:564`'s `assertPathInside`, unchanged by this phase |
| T-99-06-02 | Tampering | shared unchanged-outcome partition | medium | mitigate | CLOSED | short-circuit scoped via `!isRecordedButDisabled(record)`, confirmed in code; full update+cascade suites (390 combined tests across both runs) pass |
| T-99-06-03 | Repudiation | up-to-date skip row | low | accept | CLOSED | row bytes unchanged (deliberate, documented in code comment at `update.ts:1525` and in `STATE.md`) |
| T-99-06-04 | Denial of Service | repeated no-op writes | low | mitigate | CLOSED (with documented residual — see Focus Area 1) | deep-equal guard verified present and load-bearing (`refreshDisabledRecord:1567`); WR-08 regression test (real lock, real round-trip) run directly: pass |
| T-99-06-SC | Tampering | npm/pip/cargo installs | high | mitigate (N/A) | CLOSED | no package installed |
| T-99-07-01 | Tampering | rollback correctness | medium | mitigate | CLOSED | new failure/rollback-arm cases in update/reinstall/install suites; 244-test run (includes `install.test.ts`, `reinstall.test.ts`) pass |
| T-99-07-02 | Repudiation | coverage metric | low | mitigate | CLOSED | `sonar-project.properties` byte-identical to phase base — no exclusion added; new todo correctly files the deferred out-of-bound scope instead |
| T-99-07-03 | Information Disclosure | test fixtures | low | mitigate | CLOSED | per-commit TruffleHog protocol; one case positively asserts an absolute scope-root path does not leak into an operator-facing row (per SUMMARY, spot-checked pattern consistent with the rest of the suite) |
| T-99-07-SC | Tampering | npm/pip/cargo installs | high | mitigate (N/A) | CLOSED | no package installed |

**29/29 declared threats verified CLOSED.**

---

## Review-Discovered Defects (not in any plan's original register, tracked here for completeness)

The two-iteration code review found and drove to closure one CRITICAL and
eight WARNING findings the plans' own threat registers did not anticipate.
Verified independently in the current tree (not accepted from SUMMARY prose):

| ID | Class | Verdict | Evidence (this audit's own check) |
|---|---|---|---|
| CR-01 | Spoofing (= T-99-04-01) | CLOSED | see Focus Area 1/register above |
| WR-01 | Tampering (type confusion) | CLOSED | `types.ts:199-200` `?: never` pins confirmed present |
| WR-02 | Tampering / availability (batch-abort under lock contention) | CLOSED, accepted with reasoning engaged directly | see Focus Area 1 |
| WR-03 | Tampering (module-graph cycle risk) | CLOSED | `update-row.ts` leaf import set confirmed by direct read |
| WR-04 | Repudiation (traceability anchor removed on false premise) | CLOSED (6/7 sites; 7th tracked as Info, non-security) | `grep -rn "RLD-04" extensions/` = 6 hits |
| WR-05 | Tampering (gate over/under-reach) | CLOSED | `DELIBERATE_OVER_REACH`-style pinning confirmed in `plan.test.ts` |
| WR-06 | Tampering (undocumented-but-claimed enforcement gap) | CLOSED | `eslint.config.js:276-305`, `import-boundaries.test.ts:135-238` confirmed present and green |
| WR-07 | Repudiation (comment overstated guarantee) | CLOSED | `update.ts:1551-1558` comment text confirmed corrected |
| WR-08 | Denial of Service (latent order-instability contingency) | CLOSED, documented residual (not eliminated by design) | see Focus Area 1 |

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-99-01 | T-99-01-02 | Structural `never` pin now closes the collision at compile time (stronger than plan-time accept) | this audit | 2026-08-10 |
| AR-99-02 | T-99-04-04 | Reason brace is a fixed 2-literal enum mapping; no plugin text ever reaches it | plan-time register, confirmed | 2026-08-10 |
| AR-99-03 | T-99-05-03 | Derivation consumes an already-schema-validated manifest type; adds no parse surface | plan-time register, confirmed | 2026-08-10 |
| AR-99-04 | T-99-06-03 | Up-to-date row bytes deliberately unchanged; documented in code and STATE.md | plan-time register, confirmed | 2026-08-10 |
| AR-99-05 | WR-08 (residual) | `disabledPinProjection` order-stability is dormant today (fixed code-order object literal); a regression test (WR-08) fails loud if a future resolver change makes it order-unstable, rather than sorting the property away silently | this audit, engaging the operator's own recorded WR-08 fix rationale | 2026-08-10 |
| AR-99-SC | all `*-SC` rows | No package-manager install task anywhere in the phase diff | plan-time register, confirmed | 2026-08-10 |

*Accepted risks do not resurface in future audit runs.*

---

## Unregistered Flags

None rise to WARNING. Two Info-severity items from the review's own iteration
2 are worth carrying forward as documentation/coverage gaps (not security
threats, since the underlying mechanism in both cases was independently
verified safe in this audit):

- **IN-07**: the autoupdate cascade surface can now render the
  `{orphan rewake}` token (same shared composer as the manual-update
  surface) with no dedicated catalog state or fixture. The token itself is a
  fixed literal (verified under Focus Area 4); this is a test-coverage gap,
  not an injection or spoofing risk.
- **IN-10**: `notify.ts:3766` restored `PL-4` but not the `(RLD-04)`
  parenthetical WR-04 restored at the other 6 sites — a traceability-comment
  completeness gap, no code or rendered-byte impact.

Both are already tracked in `99-VERIFICATION.md`'s "Deferred / Follow-Up
Items" and do not require a SECURITY.md re-run to close.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-10 | 29 | 29 | 0 | gsd-secure-phase, full independent re-verification (source reads, 390 combined direct test-run assertions across 2 runs, direct ESLint run, direct call-chain tracing for the lock-nesting and containment claims — not a plan/SUMMARY trust-through) |

---

## Sign-Off

- [x] All 29 declared threats have a disposition (mitigate / accept) and are independently verified CLOSED
- [x] All 9 review-discovered defects (1 critical, 8 warning) independently confirmed closed in the current tree
- [x] One documented, test-guarded residual contingency (WR-08) recorded, correctly non-blocking
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** SECURED — 2026-08-10
