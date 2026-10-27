# Phase 3: Dependency Cascade Rows and Status - Context

**Gathered:** 2026-10-26
**Status:** Ready for planning
**Mode:** autonomous smart discuss (wave 1 of `plugin-lifecycle`; decisions made by parity, not by user questions)

<domain>
## Phase Boundary

Cascade rows and refusals name every member and declarer the way Claude Code does, and a plugin degraded by its dependency says so (or the decision not to is recorded).

Requirements: CAS-01..CAS-07. Backlog: CLOSUREROW-01, ROOTKEY-01, DEPS-STATUS-01, PARITYGV-01 b1 b2 b3, UPDDEP-01 b2, VERSTR-01.

Owned files (ROADMAP `Files` line): `orchestrators/plugin/{install-cascade,install-cascade.messaging,constraint-fold,dependency-move,list-installed-row,list-flow,list-candidate-version}.ts`, `orchestrators/plugin/info.ts` (row status only), `domain/{dependency-closure,dependency-range}.ts`, `domain/components/plugin.ts` (version bound), `shared/notification-types.ts`, `shared/notify-reasons.ts`, `docs/output-catalog.md`. Plus the paired tests, the catalog-UAT fixtures for changed catalog blocks, and the cucumber features/steps that pin the changed rows.

Shared files: `shared/notification-types.ts` with Phase 8 (this phase adds no new member, see D-PL3-02); `shared/notify-reasons.ts` with Phase 9; `info.ts` with Phase 7 (fetch locking only; this phase does not touch `info.ts`, see D-PL3-06).

</domain>

<evidence>
## Upstream Evidence (Claude Code 2.1.310)

Source: the installed binary `/home/linuxbrew/.linuxbrew/Caskroom/claude-code@latest/2.1.310/claude`, JS extracted and read on 2026-10-26 (install routine `lsn`, CLI install op `xat`, closure walk `o3s`, rollback `Zs`), plus https://code.claude.com/docs/en/plugins/troubleshooting.md#dependency-errors (2026-10-26). No sandbox probe was run.

**E1 -- a member of the closure fails (high).** The walk lists dependencies before dependents and installs the list backwards. A walk failure happens before any write: `Dependency "base@mp" (required by lib@mp) not found. Is the "mp" marketplace added?`. A typed refusal names only the failing member (`Dependency "base@mp" has no git tag satisfying ^2.0`); the members that resolved (lib) are never named and the rollback is not reported. The CLI prints one line, `✘ Failed to install plugin "<arg>": <message>`. On success it names every member: `Successfully installed plugin: app@mp (scope: user) (+ 2 dependencies: lib, base)`. Upstream has no per-member row grammar; this extension's row-per-plugin output (INS-01, the cascade "Failure attribution" convention in `docs/output-catalog.md`) has no upstream analogue.

**E2 -- invalid root name (high).** The argument is not checked against an alphabet before lookup. `On` splits on `@`; lookup is `.plugins.find(V => V.name === h)`. Not listed: `Plugin "_x" not found in marketplace "mp"`. Listed but outside the id alphabet (`je = "[A-Za-z0-9][-A-Za-z0-9._]*"`, `^${je}@${je}$`): `Plugin "_x@mp" cannot be installed, because its id is invalid: Each part of a plugin id (plugin@marketplace) may use only the letters a-z and A-Z, digits, ".", "_" and "-", and must start with a letter or digit. Here the plugin's name does not; the marketplace's maintainer can rename it.`

**E3 -- dependency status on the dependent (high).** Only disabled / not installed / version-unsatisfied dependencies propagate, at load time (`s3s` demotes dependents to a fixpoint): `Dependency "lib@mp" is disabled — enable it or remove the dependency`, `... is not installed — run ...`, `Requires "lib@mp" ^2.0, installed 1.0.0`, shown as `failed to load` on `claude plugin list`. There is no "partial" state: a dependency with component load errors stays enabled and its dependents are unaffected. `claude plugin details` shows only components and token cost. Install reports no dependency status.

**E4 -- truncation (high).** `function Mt(n,e=160){return J9(W0(l(n,e))…,e)}`, `function J9(n,e=2000){return n.length>e?`${re(n,e)}…`:n}`. `re` cuts at `e` UTF-16 code units and drops a dangling high surrogate; the suffix is a single `…` (U+2026). `Mt` also strips ANSI/OSC escapes, collapses whitespace, applies NFC, and turns backticks into `'`. The 120 limit is used only by the Anthropic Directory pin refusal: name 120, version 120, the joined range list 120 as one string, each requirer 120 with its `@marketplace` part dropped, requirer count uncapped. Other refusals use 64 per id part, 64 per range, 200 for a joined range list with `… (+N chars)`, 64 for versions. Requirers (`dr`) are the installed plugins outside the closure whose constraints carry a range, plus EVERY cascade member that declares a range on the member -- all of them, not the first.

**E5 -- dependency move refused (high for messages, medium for the offline path).** Offline is not detected as such (`ls-remote failed` → debug log → `has no git tag satisfying`). A dependency installed outside the new range: `Dependency "lib@mp" is installed at 1.0.0, which does not satisfy: ^2.0. To look for a version in range, run \`claude plugin update lib@mp\``. The hint appears only when the root declares the dependency directly and it is not policy-blocked or pinned by managed settings.

**E6 -- version bounds (high).** plugin.json `version: o().optional()` (no `.max`, no regex, no semver check); the marketplace entry reuses the field. Versions are bounded only when rendered (64 in refusals).

**E7 -- upgrade state on list (high; corrects 261026-dpt).** `claude plugin list` never computes an available version for ANY source. `yi` (available version: `claudeai` and relative-path sources only) is called only from the already-installed install hint (` — the marketplace now offers X (installed: Y); run \`claude plugin update …\``). The `/plugin` Installed rows show no "update available" marker.

</evidence>

<decisions>
## Implementation Decisions

### Closure failure rows (CAS-01, CLOSUREROW-01)

- **D-PL3-01:** A failed install closure gives a row to every closure member that this install would have newly materialized but did not, beside the failing member's row and the root's row. Upstream (E1) prints one line and names only the failing member, but it names every member on success; this extension's row-per-plugin grammar (INS-01, output-catalog "Failure attribution") already diverges by giving the root its own row, and the parity basis for the grammar itself is the success line naming each member. A member already installed and unchanged by the plan gets no row (nothing was attempted for it).
- **D-PL3-02:** The row is `(failed) {dependency failed}`, the token the root row already carries, so `Reason`, `StatusToken`, and `PluginStatus` stay closed and their pinned counts do not move. No cause line (the cause belongs to the failing member's row). Severity `error`, as the root row.
- **D-PL3-03:** Both failure paths are covered: the walk/constraint failure (no writes yet; members discovered by the walk before the failure) and the per-member ledger failure (members rolled back plus members never attempted). The member list must reach `composeCascadeFailureMessage` (today it gets only the failing key and root). `features/plugin/install-dependencies.feature` gains the `lib` row (`:84-88`) and the `mid` row (`:139-142`).

### Invalid root name (CAS-02, ROOTKEY-01)

- **D-PL3-04:** Match upstream order (E2): look the root up in its marketplace first. A root the marketplace does not list keeps the existing not-found verdict. A listed root whose key fails the token rule is refused `(failed) {invalid manifest}` with the cause `Plugin "<plugin>@<marketplace>" cannot be installed, because its id is invalid: each part of a plugin id (plugin@marketplace) may use only the letters a-z and A-Z, digits, ".", "_" and "-", and must start with a letter or digit. Here the plugin's name does not; the marketplace's maintainer can rename it.` (upstream text, sentence-cased after the colon). The `declares an unusable dependency (root: ...)` cause is never used for the root.
- **D-PL3-05:** The fix lands in `domain/dependency-closure.ts` (a root-specific failure arm) and the cascade messaging; `enable-disable.ts` is Phase 1's file and keeps its own call, which inherits the new arm only if the arm is rendered generically. The pinned case in `test/integration/reserved-record-keys.test.ts` (`:393-395`) changes with it, and a cucumber scenario covers `_x@mp` listed by its marketplace. `list`/`info` showing `{unsupported source}` for `__proto__` is out of scope (deferred).

### Dependency status propagation (CAS-03, DEPS-STATUS-01)

- **D-PL3-06:** Do not propagate a dependency's partial availability to its dependent on `list`, `info`, or install rows. Claude Code has no partial state and leaves dependents of a dependency with component errors unaffected (E3); the states upstream does propagate (disabled, missing, version-unsatisfied) are already reported at load by LOAD-01 (`{dependency unsatisfied}`) and its remedies. Recorded as the decision not to (CAS-03 allows it); no code change, `info.ts` untouched. **Uncertain** (the backlog entry records an operator statement asking for propagation).

### Git-source upgrade state on list (CAS-04, PARITYGV-01 b1)

- **D-PL3-07:** Keep the `upgradable` / `partially-upgradable` state for git-source rows. Upstream shows no upgrade state on `list` for any source (E7), so PL-5 is already a recorded divergence for every source, and it names git trees explicitly (GV-01 commit version of a warm git tree; the entry version for a cold one, VER-01/VER-02); the fetch-plugin milestone (RSTA-04..06, FTCH-01..06) built `fetch` precisely so `list` shows a git plugin's remote state. Removing it for git sources only would leave a divergence for path sources and drop a shipped feature. Recorded as a divergence licensed by PL-5 + RSTA/FTCH; `list-flow.ts`'s PL-5 comment cites D-PL3-07. **Uncertain.**

### Required-by lists and truncation (CAS-05, PARITYGV-01 b2 b3)

- **D-PL3-08:** A refusal for a non-root cascade member names every declarer that put a range on it: the cascade members that declare one, plus the installed plugins outside the closure that already do (the root keeps today's `rootRequiredBy`). Derived at refusal time from the walk's edges (`requestersOf`-style), so `ClosureMember.requiredBy` (first declarer, used by the walk's not-found message, which upstream also words with one declarer) keeps its shape and the exact-shape tests do not churn.
- **D-PL3-09:** The Anthropic Directory pin refusal (`DirectoryPinUnsatisfiedError`, the refusal upstream truncates) truncates as `Mt(…,120)` does: the plugin name, the listed version, and the joined range list each cut once at 120 UTF-16 code units without leaving a dangling high surrogate, suffix `…` (U+2026); each requirer name cut at 120 with its `@marketplace` part dropped (already dropped today); no cap on the requirer count. One helper in `domain/dependency-range.ts` does the cut. The ANSI/whitespace/NFC/backtick normalization is not added: names are already token-allowlisted, ranges are allowlisted by the range parser.
- **D-PL3-10:** Other refusals keep this extension's bounds (`MAX_RENDERED_RANGE_CHARS = 200` per range with `... (+N chars)`). **Uncertain** (upstream uses 64 per range and 200 for the joined list with `…`).

### Next step on a refused dependency move (CAS-06, UPDDEP-01 b2)

- **D-PL3-11:** The refusal `Dependency "<key>" is installed at version <v>, which does not satisfy <r>, and cannot move: <why>` ends with upstream's hint, `To look for a version in range, run /claude:plugin update <key>.`, under upstream's condition (E5): the root declares the dependency directly. The source kind is not needed (upstream gives the hint for every source), so `DependencyMoveRequest` does not grow a source field. The scenarios at `install-dependencies.feature:193,:226,:658` change, and a new scenario covers the offline git-dependency case. **Uncertain** (whether to restrict the hint to git dependencies, as the backlog text implied).

### Unbounded version in a hold cause (CAS-07, VERSTR-01)

- **D-PL3-12:** Bound at render, not at parse: `describeConstraint` in `constraint-fold.ts` cuts the stage-two `version` with the same helper at 64 code units (upstream's version limit, E4) before interpolating it. `domain/components/plugin.ts` keeps `version: Type.Optional(Type.String())`, because upstream accepts any version string (E6) and a parse-time bound would refuse plugins Claude Code installs. T-29-21 continues to cover the `will update` / `updated` version slots.

### Amendments after research (2026-10-26, from 03-RESEARCH.md)

- **D-PL3-13 (amends D-PL3-08):** a non-root member's refusal names every CASCADE member that declared a range on it. Installed plugins outside the closure are not named: D-03-10 keeps their ranges out of the walk and the check, so naming them would print a requirer whose range is neither shown nor checked. The root keeps `rootRequiredBy` (the MISS-01 path already passes installed declarers there). **Uncertain** (upstream folds and names them).
- **D-PL3-14 (amends D-PL3-04):** the invalid-id cause uses upstream's text verbatim after the colon (`Each part of a plugin id ...`), and covers upstream's three variants (the plugin's name, the marketplace's name, or both do not). The interpolated name is printed with control/format/line-separator characters escaped, as `shared/notification-mcp.ts::printable` does. The lookup-first order applies only to install walks (`installPolicy` passed); the enable walk keeps today's behavior.
- **D-PL3-15 (scopes D-PL3-01/03):** rows cover walk failures, constraint failures, and non-root member ledger failures. Two routes keep their current single failure row and are recorded as known gaps: the root's OWN ledger failure (single-row path in `install-flow.ts`, which Phase 11 splits) and UPD-DEP-D1 plan-step failures (Phase 4's paths). A key that already has a `moved` row is not given a second row. **Uncertain.**
- **D-PL3-16 (extends D-PL3-12):** the raw `toVersion` interpolations in `dependency-move.ts` (`refusalCause`, the ruled-out cause) take the same 64-unit bound.
- **D-PL3-17 (known limit):** `apply`, a load, and `import` classify every cascade cause as `{dependency failed}` (`apply-outcomes.ts`, Phase 1's file), so a config-declared `_x@mp` reads `{dependency failed}` with the new cause line. CAS-02 is about `install`; recorded, not changed.

### Claude's Discretion

- How the closure member list reaches the messaging (extend the `CascadeFailureSubject` arms or pass a separate list), and how the walk returns its partial members on failure.
- The helper's name and signature in `dependency-range.ts`.
- Test placement inside the existing paired test files; catalog-UAT fixture updates for every changed catalog block.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `composeCascadeFailureMessage` (`install-cascade.messaging.ts:538-573`), subject union `:146-157`; root row `{dependency failed}` at `:565-571`.
- `CascadeRun` (`install-cascade.ts:697-706`: `attempting`, `materialized`, `members`), `materializeCascade` `:1614-1651`, `failedCascade` `:1425-1440` (drops members today).
- `resolveDependencyClosure` returns only the failure (`dependency-closure.ts:511-513`); root `splitKey` check `:490-497`; `TOKEN_PATTERN` and `isRenderablePluginKey` in `domain/dependencies.ts`.
- `requestersOf` (`install-cascade.ts:1719-1732`) collects every `GraphRequester`; `rangeRequirers` `:929-938` returns first declarer only.
- `renderConstraintRange` / `renderDeclaredRanges` / `MAX_RENDERED_RANGE_CHARS` (`dependency-range.ts:50,285-300`); `DirectoryPinUnsatisfiedError` message `shared/errors.ts:1239-1245`; `assertDirectoryPinSatisfied` (`install-outcome.ts:819-836`).
- `refusalCause` (`dependency-move.ts:147-155`); installed-unsatisfied rendering (`install-cascade.messaging.ts:368-369`); `dependency-plan.ts:149-163`.
- `describeConstraint` (`constraint-fold.ts:177-190`).

### Established Patterns
- Closed-set vocabulary pinned by `notify-closed-set-locks.test.ts`, `compat-01-no-expansion.test.ts`, and `REASONS` in `notification-wire.ts`; this phase adds no member.
- Catalog blocks byte-pinned by `test/architecture/catalog-uat/catalog-contract.test.ts` (`EXPECTED_STATE_COUNT`, `EXPECTED_UTF8_BYTES`); every changed example updates its fixture and those constants.

### Integration Points
- `install-flow.ts` `unwrapCascade` (`:1088-1128`) and `handleCascadeThrow` (`:1781-1819`) route the subject; `dependency-bindings.ts:185-201` drops cause-less rows (the new member rows are cause-less, so `apply`'s refusal keeps its shape). `install-flow.ts`, `install-outcome.ts`, `dependency-bindings.ts`, `dependency-plan.ts`, and `shared/errors.ts` are outside the `Files` line; touch them only where the routing forces it, and record each in the SUMMARY.

</code_context>

<specifics>
## Specific Ideas

- Success criteria 1-5 in ROADMAP Phase 3 are the acceptance list; each user-visible change ships with a cucumber scenario that fails without it.

</specifics>

<deferred>
## Deferred Ideas

- `list` / `info` render `{unsupported source}` for a reserved `__proto__` entry because `classifyResolverNote` has no "malformed marketplace entry" arm (backlog candidate).
- Aligning the other refusals' bounds (64 per range, 200 joined, `…`) with upstream (D-PL3-10).
- Upstream's `Mt` normalization (ANSI strip, whitespace collapse, NFC, backtick) for free text in refusals.

</deferred>

## Uncertain choices (for user review)

1. **D-PL3-06** -- dependency partial availability is NOT propagated to the dependent. Alternative: propagate a `{dependency partial}`-style reason on list/info/install (the operator's backlog statement). Why: Claude Code has no partial state and leaves such dependents unaffected; upstream-propagated states are already reported at load.
2. **D-PL3-07** -- git-source `list` rows keep `upgradable`. Alternative: drop upgrade state for git sources. Why: upstream shows upgrade state for no source, PL-5 already diverges for all sources and names git trees, and `fetch` exists to feed it.
3. **D-PL3-01/02** -- resolved-but-uninstalled members get `(failed) {dependency failed}`. Alternative: a `skipped` row, or a new token, or no row (upstream names only the failing member). Why: reuses the root row's token, no closed-set change; a sibling that does not itself depend on the failing member gets the same token.
4. **D-PL3-11** -- the `update` hint on an installed-unsatisfied dependency follows upstream's condition (root declares it directly), for every source kind. Alternative: hint only for git dependencies refused offline. Why: parity; no source plumbing.
5. **D-PL3-10** -- refusals other than the directory pin keep the 200-per-range bound. Alternative: upstream's 64 per range / 200 joined.
6. **D-PL3-13** -- outside-closure installed declarers are not named on a non-root member's refusal. Alternative: scan installed declarations and name them (upstream), which also means folding their ranges into the check against D-03-10.
7. **D-PL3-15** -- the root's own ledger failure and plan-step failures keep one row; the rolled-back dependencies behind them get none. Alternative: extend `install-flow.ts`'s single-row path now.
