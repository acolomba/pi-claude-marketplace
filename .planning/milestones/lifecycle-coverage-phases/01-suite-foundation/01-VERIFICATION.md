---
phase: 01-suite-foundation
verified: 2026-10-23T18:00:00Z
status: passed
score: 4/4 must-haves verified
covered_files:
  - ".agents/skills/cucumber/SKILL.md"
  - ".agents/skills/cucumber/rules/features.md"
  - ".agents/skills/cucumber/rules/layout.md"
  - ".agents/skills/cucumber/rules/steps.md"
  - ".agents/skills/cucumber/rules/world-and-stand-ins.md"
  - ".planning/phases/01-suite-foundation/01-01-PLAN.md"
  - ".planning/phases/01-suite-foundation/01-01-SUMMARY.md"
  - ".planning/phases/01-suite-foundation/01-02-PLAN.md"
  - ".planning/phases/01-suite-foundation/01-02-SUMMARY.md"
  - ".planning/phases/01-suite-foundation/01-03-PLAN.md"
  - ".planning/phases/01-suite-foundation/01-03-SUMMARY.md"
  - ".planning/phases/01-suite-foundation/01-04-PLAN.md"
  - ".planning/phases/01-suite-foundation/01-04-SUMMARY.md"
  - ".planning/phases/01-suite-foundation/01-05-PLAN.md"
  - ".planning/phases/01-suite-foundation/01-05-SUMMARY.md"
  - ".planning/phases/01-suite-foundation/01-06-PLAN.md"
  - ".planning/phases/01-suite-foundation/01-06-SUMMARY.md"
  - ".planning/phases/01-suite-foundation/01-07-PLAN.md"
  - ".planning/phases/01-suite-foundation/01-07-SUMMARY.md"
  - ".planning/phases/01-suite-foundation/01-08-PLAN.md"
  - ".planning/phases/01-suite-foundation/01-08-SUMMARY.md"
  - ".planning/phases/01-suite-foundation/01-09-PLAN.md"
  - ".planning/phases/01-suite-foundation/01-09-SUMMARY.md"
  - ".planning/phases/01-suite-foundation/01-10-PLAN.md"
  - ".planning/phases/01-suite-foundation/01-10-SUMMARY.md"
  - "cucumber.json"
  - "features/lib/field-rows.ts"
  - "features/lib/git-clones.ts"
  - "features/lib/git-marketplace.ts"
  - "features/lib/git-plugin.ts"
  - "features/lib/hermetic-git.ts"
  - "features/lib/https-git-host/cgi.ts"
  - "features/lib/https-git-host/server.ts"
  - "features/lib/layer-config.ts"
  - "features/lib/marketplace-info-fields.ts"
  - "features/lib/mcp-configuration.ts"
  - "features/lib/path-marketplace.ts"
  - "features/lib/pi-commands.ts"
  - "features/lib/pi-process.ts"
  - "features/lib/published-marketplace.ts"
  - "features/lib/result-rows.ts"
  - "features/lib/run-tokens.ts"
  - "features/lib/state-lock-holder.ts"
  - "features/marketplace/add.feature"
  - "features/marketplace/autoupdate.feature"
  - "features/marketplace/failed-add.feature"
  - "features/marketplace/file-source-update.feature"
  - "features/marketplace/git-source.feature"
  - "features/marketplace/github-source.feature"
  - "features/marketplace/help.feature"
  - "features/marketplace/info.feature"
  - "features/marketplace/list.feature"
  - "features/marketplace/remove.feature"
  - "features/marketplace/unsupported-source.feature"
  - "features/marketplace/update.feature"
  - "features/marketplace/url-source-update.feature"
  - "features/marketplace/url-source.feature"
  - "features/marketplace/usage-errors.feature"
  - "features/plugin/bootstrap.feature"
  - "features/plugin/configuration.feature"
  - "features/plugin/cross-scope-install.feature"
  - "features/plugin/disable.feature"
  - "features/plugin/enable.feature"
  - "features/plugin/fetch.feature"
  - "features/plugin/git-source-update.feature"
  - "features/plugin/git-source.feature"
  - "features/plugin/import.feature"
  - "features/plugin/info.feature"
  - "features/plugin/install-dependencies.feature"
  - "features/plugin/install-rollback.feature"
  - "features/plugin/install.feature"
  - "features/plugin/partial-install.feature"
  - "features/plugin/pending.feature"
  - "features/plugin/prune.feature"
  - "features/plugin/reconcile.feature"
  - "features/plugin/reinstall.feature"
  - "features/plugin/state-lock.feature"
  - "features/plugin/uninstall.feature"
  - "features/plugin/update.feature"
  - "features/plugin/usage-errors.feature"
  - "features/step_definitions/claude-code-settings.steps.ts"
  - "features/step_definitions/command.steps.ts"
  - "features/step_definitions/config.steps.ts"
  - "features/step_definitions/git-host.steps.ts"
  - "features/step_definitions/marketplace/add.steps.ts"
  - "features/step_definitions/marketplace/info.steps.ts"
  - "features/step_definitions/marketplace/publishing.steps.ts"
  - "features/step_definitions/marketplace/update.steps.ts"
  - "features/step_definitions/mcp-configuration.steps.ts"
  - "features/step_definitions/plugin/installation.steps.ts"
  - "features/step_definitions/plugin/publishing.steps.ts"
  - "features/step_definitions/scope-state.steps.ts"
  - "features/step_definitions/session.steps.ts"
  - "features/support/git-repository.ts"
  - "features/support/https-git-host.ts"
  - "features/support/pi-process.ts"
  - "features/support/source-kind.ts"
  - "features/support/world.ts"
  - "scripts/check-features.mjs"
covered_digest: "v3:sha256:01faa0be5b40eae3b29ebf86230bb09d9fdd1a9c58c0aaa81b030ec897fb5ec4"
behavior_unverified: 0
overrides_applied: 0
---

# Phase 1: Suite Foundation Verification Report

**Phase Goal:** Every later phase can write its scenarios by adding only its own feature files and phase-local steps: the drivers, fixtures, stand-ins, shared steps, and result-row support that the plugin lifecycle scenarios need all exist, and each is used by a seed scenario.
**Verified:** 2026-10-23 (re-verified on the combined 15-phase milestone tree)
**Status:** passed
**Re-verification:** Yes, after the later phases merged (previous status passed; no gaps, so a regression check plus a fresh run of the seed features)

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every Provides capability exists with a passing seed scenario in the feature file of the later phase that needs it; every setup Given asserts its effect; every armed failure, the held lock, and the unwritable target are freed by the world's release | VERIFIED | See the Provides table. Re-run on the combined tree: the orchestrator's `npm run check` was green with 702/702 scenarios; the verifier also ran the 19 seed feature files (163 scenarios, 1818 steps, exit 0) and `npm run check:features` (exit 0). Setup Givens assert: `assertDeclared` in config.steps.ts; `isStateLockHeld` in scope-state.steps.ts; `EISDIR` rejection in mcp-configuration.steps.ts; the lock holder waits for a `locked` line. Releases: `armRepository` registers `disarm` via `world.onRelease`; `holdStateLock` returns a release that ends stdin, requires exit [0, null], and asserts the lock directory is gone; the blocking directory registers an `rm` release. |
| 2 | Result steps read the rows of every payload kind a plugin lifecycle command or new session emits; a scenario that leaves rows of any of them uncompared fails | VERIFIED | `features/lib/result-rows.ts` `ROW_FIELDS` = `marketplaces`, `blocks`; `rowArrays` feeds `world.uncomparedRows`; `pluginRowRecords` reads `plugin-info-cascade` blocks and `reconcile-applied-cascade` marketplaces. `world.ts` fails the next `When` (`recordResults`) and the scenario (`After`) on uncompared rows, MCP notices, or a session result whose fields no step stated (`uncomparedSessionResults`, review fix WR-01). Seeds: `plugin-info-cascade` (plugin/info.feature), `reconcile-applied-cascade` (plugin/reconcile.feature, configuration.feature), `reconcile-pending-empty` (plugin/pending.feature), `prune-empty` (plugin/prune.feature), `usage-info` (marketplace/help.feature). `reconcile-aborted` and `prune-committed-warning` have no row arrays, no reliable trigger, and no seed by recorded decision (CONTEXT, "Decisions after research"); generic field steps compare them. |
| 3 | Plugin steps live under `features/step_definitions/plugin/` in topic modules with no verb or reserved name; git-host steps serve plugin repositories as well as marketplaces; the cucumber skill documents file ownership | VERIFIED | `plugin/installation.steps.ts` and `plugin/publishing.steps.ts` only; `plugin.steps.ts` no longer exists. `git-host.steps.ts` is top level and its `{git repository}` parameter resolves a plugin through `world.gitRepositoryServing` or a marketplace through `requirePublished`. `.agents/skills/cucumber/rules/layout.md` "Parallel work" section names the foundation-owned files, the one-owner rule, the follow-up-commit rule, and the reserved module names. |
| 4 | `npm run check:features` and `npm run check` are green and every existing scenario still passes | VERIFIED (see note) | Verifier ran `npm run check:features` (exit 0) and the 19 seed feature files (163/163). The orchestrator ran the full `npm run check` on this exact tree: green (static, unpaired, integration, 702/702 cucumber scenarios, direct coverage). The verifier did not re-run it. |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

### Provides List (each used by a seed scenario)

| Capability | Seed (file) | Status |
|------------|-------------|--------|
| Dependencies with version constraints | install-dependencies.feature (`app` depends on `lib@^1.0.0`; both rows and both skills compared) | VERIFIED |
| Partially available plugin (output style beside skills) | partial-install.feature (`partially-available`, hint `partial-install`, nothing installed) | VERIFIED |
| Publish a new version of a plugin | git-source-update.feature (`ghp` 1.0.0 to 2.0.0, `{ghp revision 2}`); dir marketplaces re-offer plugins (update.feature) | VERIFIED |
| Git-source plugins: github, url, git-subdir, pinned or not, with revision tokens | git-source.feature (Scenario Outline over the three kinds; pinned no-request scenario) | VERIFIED |
| Git host arms 401, 404, drop on a plugin repository, and disarms | fetch.feature (404 then served again; fetch fails then succeeds). 401 and drop use the same `armRepository` path; the usage gate shows their steps are used | VERIFIED |
| Request log for plugin clone or fetch | git-source.feature, git-source-update.feature, fetch.feature | VERIFIED |
| Official marketplace served by the git host | bootstrap.feature (first bootstrap clones from the loopback host; second makes no request; declaration stated) | VERIFIED |
| Hand-edit base and local configs (plugins and marketplaces) | pending.feature, reconcile.feature (base and local layers) | VERIFIED |
| Hold a scope's state lock from another process | state-lock.feature (user and project scope; `state-lock-holder.ts` uses `proper-lockfile` with the product's options) | VERIFIED |
| Plant a file in a plugin data directory | uninstall.feature (`--keep-data` keeps notes.txt) | VERIFIED |
| Delete an installed plugin's skill files | reinstall.feature (reinstall restores them; new session offers the skill) | VERIFIED |
| Write a Claude Code settings file in the sandbox | import.feature (user and project scope) | VERIFIED |
| Make an install phase's target unwritable, and writable again | install-rollback.feature (directory in place of `mcp-adapter.json`; EISDIR rejection asserted; failed install leaves nothing; retry succeeds after removal; root-proof) | VERIFIED |
| Observe: installation record of a scope | enable.feature, state-lock.feature | VERIFIED |
| Observe: plugin data directory files | uninstall.feature | VERIFIED |
| Observe: `plugin-clones/` entries and marketplace clone directories | git-source.feature, git-source-update.feature (`holds these git clones`, `holds no git clones`) | VERIFIED |
| Observe: new session in another project | install.feature (second `PiProcess`, same HOME, fresh cwd, released by the world) | VERIFIED |
| Observe: a new session's own payloads | reconcile.feature, configuration.feature, update.feature (`the session reports these results:`, via RPC `get_entries`) | VERIFIED |

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `features/lib/state-lock-holder.ts` | VERIFIED | Substantive (118 lines), imported by `scope-state.steps.ts`, runs as its own child process |
| `features/lib/git-plugin.ts`, `git-clones.ts`, `layer-config.ts`, `result-rows.ts`, `field-rows.ts`, `run-tokens.ts` | VERIFIED | Substantive and imported by steps or the world |
| `features/step_definitions/{scope-state,claude-code-settings,mcp-configuration,session,git-host}.steps.ts` | VERIFIED | Registered through `cucumber.json`; every step used (usage gate green) |
| `features/step_definitions/plugin/{installation,publishing}.steps.ts` | VERIFIED | Topic modules; no verb names |
| `features/support/world.ts` | VERIFIED | Release stack, uncompared-rows, notices, and session-result guards |
| `.agents/skills/cucumber/rules/layout.md` | VERIFIED | "Parallel work" section present |

### Key Link Verification

| From | To | Status | Details |
|------|----|--------|---------|
| `git-host.steps.ts` `armRepository` | `world.onRelease` / `HttpsGitHost.disarm` | WIRED | Every arm registers a disarm release |
| `scope-state.steps.ts` | `state-lock-holder.holdStateLock` | WIRED | Release registered before the held-check assertion |
| `world.recordResults` / `After` | `result-rows.rowArrays` | WIRED | Rows, notices, and session results all fail an uncompared scenario |
| `session.steps.ts` | `pi-commands.readSession` (`get_entries`) | WIRED | The six existing session reports compared |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Usage gate: no unused, undefined, or ambiguous step; layout and Gherkin rules | `npm run check:features` | exit 0 | PASS |
| Seed scenarios | `npx cucumber-js --parallel 2` over the 19 seed feature files | 163 scenarios, 1818 steps passed, exit 0 | PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| FND-01 | 01-01 through 01-10 (all declare it) | Shared step and driver support exists before the phases that use it | SATISFIED | Provides table above |
| FND-02 | 01-01 through 01-10 (all declare it) | The usage gate stays green | SATISFIED | `npm run check:features` exit 0; `scripts/check-features.mjs` runs a dry run over the cucumber API |

No orphaned requirements: REQUIREMENTS.md maps only FND-01 and FND-02 to Phase 1, and both appear in every plan's frontmatter.

### Anti-Patterns Found

None. `TBD`, `FIXME`, `XXX`, `TODO`, and `HACK` do not occur under `features/`, `scripts/check-features.mjs`, or `.agents/skills/cucumber`. No stub steps: each Given asserts its effect.

### Re-verification on the combined tree

Later phases extended seed feature files but did not change the foundation:

- `git diff 0fc0172c HEAD` over `features/lib`, `features/support`, `cucumber.json`, `scripts/check-features.mjs`, and `.agents/skills/cucumber` is empty. No later phase edited a Phase 1 file, so the ownership rule (criterion 3) held through all 15 phases.
- Later phases added only verb or topic step modules (`plugin/fetch`, `plugin/import`, `plugin/uninstall`, `marketplace/checkout`). `plugin.steps.ts` is still absent and `git-host.steps.ts` is still top level.
- Seed scenarios are intact: `plugin-info-cascade` (plugin/info), `reconcile-applied-cascade` (reconcile, configuration, update, uninstall, marketplace remove and update), `reconcile-pending-empty` (pending), `prune-empty` (prune), and `usage-info` (marketplace and plugin help) are all still compared by scenarios. `reconcile-aborted` and `prune-committed-warning` still have no seed, by the recorded CONTEXT decision (no row array, no reliable trigger).
- Release behavior is unchanged: `git-host.steps.ts` registers `world.onRelease` disarms; `state-lock-holder.ts` is unchanged (118 lines).

### Advisory Notes (not gaps)

- **WR-06 skipped (network guard).** Nothing in the harness fails closed if Pi reaches beyond 127.0.0.1. The skip reason is recorded in 01-REVIEW-FIX.md: a reliable guard needs a change to the shared e2e harness and a new run-level state channel. Current mitigations are `--offline`/`PI_OFFLINE=1`, the `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` override, and the NFR-5 lint rule. It is not one of the four success criteria or a Provides item, but it weakens the milestone rule "no scenario reaches the public network". Recommend a backlog item.
- **UPD-04 obstruction semantics (resolved).** Phase 5 took the choice: the `mcp-adapter.json` obstruction fails the update in its prepare phase, and a post-swap failure is by design not rolled back (`05-VERIFICATION.md`). The foundation's obstruction step serves it unchanged.
- **Reason quality.** Research recorded product bugs (lock-held reasons per verb, EISDIR reported as `unreadable manifest`, empty `list --remote`, and others). By decision they belong to the phases that own those verbs.

### For the orchestrator

- **Network guard (former WR-06) is still open.** Nothing in the harness fails closed if Pi reaches beyond 127.0.0.1 (confirmed: no loopback or network guard in `features/support`, `features/lib/pi-process.ts`, or `scripts/check-features.mjs`). `.planning/BACKLOG.md` has no entry for it (its "WR-06" lines are other reviews). Not a Phase 1 success criterion, so it does not block. Decide whether to add a backlog item before the milestone closes.
- **Reason-quality product bugs.** The lock-held reasons per verb, `list --remote`, and others were assigned to the verb phases. Phase 5 fixed the EISDIR `unreadable manifest` bug for update (`7671e03f`); `05-VERIFICATION.md` leaves the lock-held update reason to Phase 15. Check Phase 15's record that it closed it.
- **The previous report held no "For the orchestrator" section.** Its advisory notes above are the items carried forward, updated.
- **Fingerprint.** `covered_files` and `covered_digest` come from `verification.fingerprint` over the phase's implementation files; the list is the previous one, and the digest is new because the seed feature files changed in later phases.

### Human Verification Required

None.

### Gaps Summary

No gaps. The foundation exists, each capability has a passing seed in the feature file of the later phase that owns it, the result-row guards fail uncompared rows, notices, and session results, and the file ownership rule is in the cucumber skill. The foundation files are byte-identical to the Phase 1 close, later phases only added their own modules, and the seed scenarios still pass. The only item the verifier did not run itself is the full `npm run check`, which the orchestrator ran green on this tree.

---

_Verified: 2026-10-23_
_Verifier: Claude (gsd-verifier)_
