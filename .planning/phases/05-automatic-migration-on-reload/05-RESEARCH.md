# Phase 5: Automatic migration on /reload - Research

**Researched:** 2026-10-08
**Domain:** Load-time data migration of plugin MCP entries between two JSON(C) config files, under a cross-process state lock, with a closed-catalog user notice
**Confidence:** HIGH for the codebase seams and the adapter's read timing; MEDIUM for the in-session adapter behavior after the move (code reading, not run); LOW items are listed in the Assumptions Log

## Summary

Everything the migration needs already exists as a seam, except three things: an offline "is the recorded clone warm" read for git sources, a way to re-stage a plugin's servers while absorbing **legacy-keyed** input (the old `mcp.json` entry and an old-name override stub), and a per-server "drop the malformed one" mode in the resolver. The re-stage itself is `prepareStageMcpServers` + `commitPreparedMcp` unchanged in shape; the removal half is `withPluginServers(config, plugin, mp, {})` over the legacy doc read with `PI_MCP_SERVER_KEYS`, exactly what `unstageMcpServers` does today for its legacy target.

The ordering that makes the move convergent is **`mcp-adapter.json` -> `state.json` -> `mcp.json`**, not adapter -> legacy -> state. The legacy entries are the only trigger the migration has (COMPAT-01 forbids a flag), so any record change (D-05-04/06/07) must be durable **before** the last legacy entry disappears; otherwise a failed state save after the legacy removal leaves a stale record that no later reload will ever revisit. With that order every crash point re-triggers on the next `/reload` and finishes with identical bytes. The steady state is zero writes because the migration never runs for a plugin that has no marked legacy entry.

Two adapter facts change what the plan must cover. First, Pi 1.0 emits `session_start` before `resources_discover`, and pi-mcp-adapter 5.1.0 reads its config during `session_start`; in the common deferred (lazy, cached-metadata) path it then re-reads the config at the first MCP operation, so in the migration session the tool list shows old names whose server may already be gone. Second, under Pi 1.0 the adapter reads `mcp.json` in **Pi's format**: every adapter-native field in a legacy entry (`disabled`, `approveTools`, `lifecycle`, ... and our marker) is an inert "ignored setting" today, while a user's Pi-format edit (`enabled: false`) is the one that is honored. Carrying the D-02-06 set verbatim from the legacy entry (D-05-09) therefore **activates** fields that are inert today, including plugin-declared `approveTools` that the 0.19.x writer passed through. This needs an operator decision before planning (Open Question 1).

**Primary recommendation:** Add `orchestrators/reconcile/mcp-migration.ts` as a per-scope step called from `applyReconcileWithReader` between `readPassForScope` and `applyPlan`, under its own `withLockedStateTransaction`, writing adapter -> state -> legacy, with its file writes behind an injected operations object (the `ReinstallReplaceOperations` pattern) so the fault-injection test can record and break the write order. Emit its one notice through a new `notifyMcpMigration` in `shared/notification-dispatch.ts` before the reconcile cascade.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Decision IDs are milestone-scoped and collide with older IDs cited in source.
Source comments cite requirement IDs (AMIG-0N), never `D-05-NN`.

#### Entry source (settles ROADMAP open decision #5)
- **D-05-01:** A migrated entry is re-staged from the plugin's cached source,
  offline, through the same MCP stage path install uses
  (`prepareStageMcpServers` and the closed translator). It gets the final key,
  `toolPrefix`, `directTools`, `description`, the Phase 4 escapes and deny-list,
  the D-03-10 partial handling and the D-04-10 notices. The source is the one
  reinstall reads: the warm sha-pinned plugin clone for git sources, the
  marketplace clone for path sources. No network (NFR-5). The existing
  load-time resolver (`resolveRecordedPluginOffline`, backfill) passes no
  clone-cache resolver, so git sources resolve `unavailable` there; the
  migration must add a warm-cache-only read. Hand edits outside the carried
  set are dropped, as an update drops them.
- **D-05-02:** When the source cannot be read offline (git clone cache miss,
  missing marketplace clone, unreadable manifest), that plugin's entries stay
  in `mcp.json` and keep working under their old names. A warning names the
  plugin and suggests `reinstall` (which may fetch the clone). The next
  `/reload` retries. No verbatim move, no in-place translation.
- **D-05-03:** The move is MCP-only. Skills, agents, hooks and workflows are
  untouched and no `reinstalled` row is emitted. Per plugin: stage into
  `mcp-adapter.json`, then remove the plugin's marked entries from `mcp.json`.
  (Reinstall's `replacePreparedMcp` writes only `mcp-adapter.json`, so it would
  not finish the move on its own.)

#### Entries the record or the rules no longer admit
- **D-05-04:** A marked legacy entry for a plugin installed in this scope,
  whose server the re-staged source no longer declares, is deleted in the same
  `mcp.json` write and listed in the notice as removed. A kept override stub,
  if the entry holds one, is written back per D-02-21..23. Claude parity: a
  server the installed plugin does not declare does not run. (Settles the
  ROADMAP "Carried from Phase 2 review (IN-02)" note.)
- **D-05-05 (operator rule, amends D-03-10 and D-03-20):** if a server would
  not work the way it works in Claude Code, it is not installed; if it works
  and only a Claude-side restriction is lost, it is installed with a warning.
  Classification:
  - Not installed (`{unsupported mcp}`, unchanged): `ws`, `sse-ide`, `ws-ide`,
    `sdk`, `claudeai-proxy` (no adapter transport); `headersHelper`,
    `oauth.xaa` (missing auth, the server mostly fails);
    `bareElicitationCapability: true` (the adapter always advertises
    `elicitation: { form: {}, url? }` with no per-server switch, so a server
    flagged for the bare shape may not work); a leading `~` in `command` or
    `args` (D-04-06, confirmed below).
  - Installed with a warning (NEW): `tools[].permission_policy` and a
    non-empty `toolPermissions`. The server works, but the plugin's per-tool
    restrictions are not enforced. This applies to install, update, reinstall,
    enable, import, reconcile and the migration alike, so a fresh install and
    a migrated one match. The warning names the server and the field, as a
    closed-catalog amendment.
  — **Reversibility:** costly — it changes the closed `{unsupported mcp}`
  feature set and its catalog pins, and which plugins install without
  `--partial`.
- **D-05-06:** An unsupported server (D-05-05 "not installed") in an installed
  plugin: its legacy entry is deleted and not written; the plugin's other
  servers move; the record becomes `partially-installed`, the same result as
  `install --partial`; the notice names the server and the blocking feature,
  and `info` shows the `{unsupported mcp}` breakdown.
- **D-05-07:** A server that is malformed under Claude's schema (D-03-18) in
  an installed plugin: dropped like D-05-06 (legacy entry deleted, the rest
  move, record `partially-installed`), with the `{malformed mcp}` detail in
  the notice. This matches Claude, which skips only the bad server. A fresh
  install still resolves `unavailable` and refuses (D-03-18 unchanged).
  — **Reversibility:** costly — migrated records end up `partially-installed`
  where a fresh install of the same plugin is refused, and later verbs
  (update, reinstall, info) must handle that record state.
- **D-05-08:** Every install, enable and reconcile install in a scope removes
  the same plugin's marked legacy entries from that scope's `mcp.json`, after
  writing `mcp-adapter.json` (add before remove). This closes the duplicate
  when an AMIG-04 unowned entry's plugin is then installed by reconcile from
  `claude-plugins.json`, and it means the AMIG-04 warning fires only for
  plugins that are really not installed in that scope. Extends D-02-12.

#### User edits and key collisions
- **D-05-09:** Hand edits on a legacy entry carry over exactly as an update
  carries them: the closed D-02-06 set, with D-03-04's rule that a carried
  field the plugin's translated entry sets belongs to the plugin. Edits to
  `command`, `args`, `env` and other fields are dropped.
- **D-05-10:** A marker-less override stub under the OLD name in
  `mcp-adapter.json` (for example `github: { "disabled": true }`, written by
  `/mcp-adapter disable`, D-02-07), whose name matches a server being moved for
  that plugin in the same scope file, is absorbed under the new name: its
  carried fields go into `plugin_<p>_<s>_` (so the user's disable survives,
  Claude parity), the original stub is kept verbatim inside our marker, and
  the old-name key is removed. Uninstall and every unstage write the kept stub
  back under its old key (D-02-21..23, D-03-05). A marker-less stub at the NEW
  key follows D-02-21 as already decided.
  — **Reversibility:** costly — it widens the kept-stub contract (the stub's
  original key now differs from our key) that write-back and the marker read.
- **D-05-11:** A full server already defined at the new key in any of the
  adapter's nine sources is a collision, as at install (D-02-03): that plugin
  moves nothing, its legacy entries stay running under their old names, and a
  warning names the colliding key and its source. Next `/reload` retries. The
  move is all-or-nothing per plugin, so a plugin's servers never end up split
  across the two files (except the D-05-06/07 drops, which are deletions).

#### Notice
- **D-05-12:** One migration notice per `/reload`, covering both scopes, rows
  ordered project before user (MSG-GR-3), emitted separately from and before
  the reconcile cascade notice. Silent when nothing moved, was removed or was
  left behind.
- **D-05-13:** Renames show the adapter key: `github -> plugin_acme_github_`
  with the plugin and scope (for example
  `github -> plugin_acme_github_ (acme) [user]`). It is the name the
  `/mcp-adapter` panel, sign-in prompts and project approvals show.
- **D-05-14:** Severity follows the house tri-state: `info` when every owned
  entry moved; `warning` when anything was left in place (D-05-02, D-05-11,
  AMIG-04 unowned) or dropped (D-05-06, D-05-07). D-05-04 removals of
  undeclared servers do not by themselves make it a warning.
- **D-05-15:** One body in a fixed order: moved rows; removed or dropped rows
  with their reason (not declared, `{unsupported mcp}` + feature,
  `{malformed mcp}`); left-in-place rows with their remedy (reinstall, resolve
  the collision, AMIG-04 unowned); one cost line (sign in again, re-approve
  project servers); the D-04-10 variable and credential notices and the
  D-05-05 permission-policy warnings for the moved servers; the reload hint
  once at the end (the adapter picks up the move one `/reload` later).
  Wording is drafted as closed-catalog amendments in `docs/output-catalog.md`
  for operator review in the plans.

Settled going in (not re-discussed): settled decision #7 (one notice; AMIG-04 unowned entries stay with a warning); COMPAT-01 (no migration flag, the file an entry sits in tells whether it is translated); the migration is its own reconcile step with its own per-scope state lock, run before the reconcile plan is applied, and it must not depend on the backfill gate, which stamps unconditionally; D-02-12 (unstage removes marked legacy entries); D-04-10 (the migration reports both variable notices); D-02-06/D-03-04 carried fields; D-02-21..23 and D-03-05 kept stubs and write-back.

### Claude's Discretion
- Where the step sits in `resources_discover` and how it shares or takes the
  per-scope lock; batching writes per scope file versus per plugin, provided
  every `mcp-adapter.json` write precedes the matching `mcp.json` removal and
  a failure in one plugin does not block the others.
- How a re-run detects the half-done state (entry present in both files) and
  finishes it without a duplicate or a second notice row beyond what the
  user needs (AMIG-02).
- Legacy entries owned by a disabled record (none should exist, since disable
  unstages): planner's choice, defaulting to removal with no re-stage
  (ENBL-08: a disabled plugin's MCP servers are never restored at load).
- Legacy entries of a plugin installed only in the other scope: AMIG-04
  unowned in this scope (leave + warn); confirm with the D-02-13/D-02-17
  same-plugin reasoning.
- The fault-injection test design (assert the write order, not only the end
  state) and how the `partially-installed` record write is ordered relative to
  the two file writes.
- Whether repeated left-in-place warnings every `/reload` need damping
  (COMPAT-01 forbids persisted state, so damping must be derivable).

### Deferred Ideas (OUT OF SCOPE)
- `CLAUDE_CODE_SHELL_PREFIX`: check whether Claude's opt-in shell prefix
  exposes a leading `~` to expansion (D-04-06 assumes it does not).
- pi-subagents `mcp:<old-name>` overrides and agent files that name old server
  or tool names are not rewritten by the migration; consider a note in the
  Phase 7 docs.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AMIG-01 | After upgrading, `/reload` moves each installed plugin's marked entries from `<scopeRoot>/mcp.json` into `mcp-adapter.json` in their final translated shape, with no reinstall; the pass is idempotent and retries after a partial failure (NFR-2, NFR-3). | Placement and lock (Pattern 1), offline source read for both source kinds (Pattern 2), re-stage through `prepareStageMcpServers` (Pattern 3), trigger = presence of marked legacy entries so the steady state writes nothing (Pitfall 2), byte-compare skip (Pattern 4). |
| AMIG-02 | The move adds to `mcp-adapter.json` before removing from `mcp.json`, so a failure between the two writes never loses a server, proven by a fault-injection test. | Write order adapter -> state -> legacy (Pattern 4), half-done finishing rule, injected operations object, recording/failing test doubles (Validation Architecture). |
| AMIG-03 | The user sees one migration notice listing `old -> new` server names, the re-sign-in and project re-approval the rename causes, and the reload hint. | Notice route `notifyMcpMigration` (Pattern 6), adapter keys OAuth tokens and project approvals by server name (verified), reload lag (Adapter timing section), catalog lock pattern. |
| AMIG-04 | A marked legacy entry with no owning install record is left in place with a warning. | Owner grouping by marker, plan-aware suppression for plugins reconcile installs in the same reload plus the D-05-08 sweep (Pattern 5), other-scope records count as unowned. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Directives from `AGENTS.md` and `.planning/codebase/*.md` that bind this phase:

- **Upstream parity** is the default; divergence needs a recorded decision ID or a Pi capability gap. The migration itself has no upstream analogue (CONTEXT compat evidence).
- **NFR-1:** every disk mutation atomic. Use `shared/atomic-json.ts::atomicWriteJson` (the `write-file-atomic-chokepoint` rule admits no other caller except the three rollback paths). State goes through `withLockedStateTransaction`/`saveState` only.
- **NFR-2:** no fix needs a Pi restart; nothing may throw past `resources_discover`. **NFR-3:** every operation idempotent or fail-clean.
- **NFR-5:** `list`, `info`, load-time paths are network-free. ESLint BLOCK F is default-deny for every `orchestrators/**` and `domain/**` file outside `NETWORK_SEAMS`; a new migration module must not import `platform/git` or name `gitOps`/`DEFAULT_GIT_OPS`/`refreshGitHubClone`, and must not call `materializePluginClone` (which clones on a miss).
- **NFR-10:** writes only under `<scopeRoot>/pi-claude-marketplace/`, `<scopeRoot>/agents/`, `<scopeRoot>/mcp-adapter.json`, `<scopeRoot>/mcp.json`; use `ScopedLocations` paths.
- **IL-2:** all user output through `shared/notification-dispatch.ts`; a direct `ctx.ui.notify` elsewhere trips `architecture/notify-chokepoint`. No stdout/stderr. **IL-4:** no telemetry.
- **Closed catalog:** new user-visible strings are amendments in `docs/output-catalog.md`, byte-locked by a test. New `Reason`/`StatusToken` members need `tests/architecture/compat-01-no-expansion.test.ts` and `notify-closed-set-locks.test.ts` amendments.
- **Quality bar:** `npm run check` green: typecheck, ESLint (`--max-warnings 0`, `sonarjs/cognitive-complexity` 15), fallow (dead code, boundaries, `maxCognitive` 15, `maxCyclomatic` 20, dupes), Prettier, source/test pairing, 100% direct coverage per pair, integration tests.
- **Conventions:** typed `Error` subclasses with `this.name`, `instanceof` discrimination; DI over test-only seams (no `__`-prefixed members, gated); explicit return types on exports; comments cite requirement IDs (AMIG-0N), never `D-05-NN` or phase/plan numbers; `no-await-in-loop` sites carry an `eslint-disable-next-line ... -- <reason>`.
- **Testing:** `node:test` + `node:assert/strict`, real temp dirs (`mkdtemp`, `withHermeticHome`), one paired test per source file; do not commit negative-control tests for gates.
- **Git (for the executor, not this research):** never commit to `main`; `SKIP=npm-check pre-commit run --files ...` then foreground `git commit`; never `--no-verify`; never amend.

## Architectural Responsibility Map

This is a Pi extension with no browser/server tiers; the map uses the project's layers.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Trigger the migration on load, isolate failures, order the notice | orchestrators/reconcile (`apply.ts` + new `mcp-migration.ts`) | entry (`index.ts`, unchanged: already wraps `applyReconcile` in NFR-2 try/catch) | ROADMAP note: "its own reconcile step with its own state lock, run per scope before the reconcile plan is applied". |
| Offline source read (path and git) | orchestrators/plugin (`git-source-probe.ts`, fs-only) | domain (`resolveStrict`, `loadMarketplaceManifest`) | BLOCK F forbids the git surface outside `NETWORK_SEAMS`; `git-source-probe.ts` is the existing fs-only probe module. |
| Per-server classification (supported / blocked / malformed), permission-policy warning facts | domain (`mcp-server-features.ts`, `mcp-resolution.ts`) | — | The closed table lives there; D-05-05 is a table change. |
| Re-stage entries, absorb legacy carried fields and old-name stubs, write `mcp-adapter.json` | bridges/mcp (`stage.ts`, `adapter-entry.ts`, `adapter-doc.ts`, `marker.ts`) | — | Every change to entry content belongs in `adapter-entry.ts` or the table (its header says so). |
| Read/remove legacy `mcp.json` entries; D-05-08 sweep with byte rollback | bridges/mcp (new legacy helper next to `unstage.ts`) | orchestrators/plugin (`install-outcome.ts` mcp phase calls it) | `unstage.ts` already owns the marker-keyed legacy read with `PI_MCP_SERVER_KEYS`. |
| Record update (`partially-installed`) | transaction (`withLockedStateTransaction`) | persistence (`state-io.ts`) | Sole sanctioned state writer. |
| The one migration notice | shared (`notification-dispatch.ts`) | docs (`output-catalog.md`) + architecture byte lock | Sole `ctx.ui.notify` call site. |

## Standard Stack

No new dependency. Everything is in-repo.

### Core (existing, reused)
| Module | Purpose | Why |
|---------|---------|-----|
| `bridges/mcp/stage.ts` `prepareStageMcpServers` / `commitPreparedMcp` | Build and write the translated entries | D-05-01 mandates the install stage path. |
| `bridges/mcp/adapter-doc.ts` `readMcpConfigDoc`, `partitionServers`, `withPluginServers`, `PI_MCP_SERVER_KEYS` | Read both files with the adapter's grammar; remove a plugin's marked entries | `unstage.ts:197-203` already reads the legacy file this way. |
| `orchestrators/plugin/git-source-probe.ts` `makePresenceProbe`, `readMirrorHeadSha` | fs-only clone presence | Never clones, never spawns git (header lines 11-15). |
| `transaction/with-state-guard.ts` `withLockedStateTransaction` | Per-scope lock, explicit single save | `save()` may be called once (lines 96-106). |
| `shared/atomic-json.ts` `atomicWriteJson` | Atomic JSON write, returns the written bytes | Lets the migration compare bytes and skip identical writes. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Re-stage from source (locked D-05-01) | Translate the legacy entry in place | Rejected by D-05-01/D-05-02. |
| Migration inside `apply.ts` per scope | A separate step in `index.ts` before `applyReconcile` | Simpler isolation, but no access to the reconcile plan, so the AMIG-04 warning would fire for a plugin reconcile installs in the same reload (see Pattern 5). |
| Migration in the extension factory (removes the one-reload lag) | — | Factory has no event `cwd` for project scope and runs in unknown order relative to the adapter's factory; ROADMAP locks the reconcile placement. |

**Installation:** none.

## Package Legitimacy Audit

Not applicable: this phase installs no external package. `strip-json-comments@^5.0.3` (already a runtime dependency, D-02-08) and the dev-only pi-mcp-adapter scratch install are pre-existing. [VERIFIED: package.json read this session]

## Architecture Patterns

### System Architecture Diagram

```text
Pi /reload
  │
  ├─ session_start ──► pi-mcp-adapter: loadMcpConfig()  (reads PRE-migration files)
  │                     └─ deferred path: tools from snapshot; real init at first MCP call
  │                        re-reads config (POST-migration files)
  │
  └─ resources_discover ──► index.ts handler (NFR-2 try/catch)
         └─ applyReconcile ─► for scope in [project, user]:
                │
                ├─ readPassForScope (lock; migrate config; plan)  ──► plan
                │
                ├─ MCP MIGRATION STEP (new)
                │    1. read <scopeRoot>/mcp.json (no lock)
                │       no marked entry? ─► return (no lock, no bytes)
                │    2. group marked entries by (marketplace, plugin)
                │    3. withLockedStateTransaction(scope):
                │         re-read mcp.json; for each owner:
                │           ├─ no record in this scope ──► planned install? skip : AMIG-04 row
                │           ├─ planned uninstall/disable ──► skip (unstage sweeps both files)
                │           ├─ disabled record ──► removal-only (no re-stage)
                │           ├─ resolve offline (marketplace clone / warm recorded-sha clone)
                │           │     miss/unreadable ──► left-in-place row (reinstall)
                │           ├─ prepareStageMcpServers(+legacy carry, +old-name stub absorb)
                │           │     collision/unreadable adapter file ──► left-in-place row
                │           ├─ WRITE 1: mcp-adapter.json (skip if bytes equal)
                │           └─ compute record delta (D-05-04/06/07)
                │         WRITE 2: tx.save() only if any record changed
                │         WRITE 3: mcp.json minus every moved/removed owner's marked entries
                │    4. report rows ─► migration report (both scopes)
                │
                ├─ applyPlan (install/enable ledgers now sweep legacy entries: D-05-08)
                ├─ backfill, routing rebuild (unchanged)
         └─ after loop: notifyMcpMigration(report)  ──► then the reconcile cascade notify
```

### Recommended Project Structure (new and changed files)

```text
extensions/pi-claude-marketplace/
├── orchestrators/reconcile/mcp-migration.ts   # NEW: per-scope step + operations seam
├── orchestrators/reconcile/apply.ts           # MOD: call per scope; emit notice before cascade
├── orchestrators/reconcile/types.ts           # MOD: optional D-12-style seam on ApplyReconcileOptions
├── orchestrators/plugin/git-source-probe.ts   # MOD: recorded-sha fs-only probe (reinstall parity)
├── orchestrators/plugin/install-outcome.ts    # MOD: mcp phase sweeps legacy after the adapter write (D-05-08)
├── orchestrators/marketplace/shared.ts        # MOD: foldUnstageNotices drops the new per-server notice
├── bridges/mcp/legacy.ts                      # NEW: list owners in mcp.json, remove owners, sweep + rollback handle
├── bridges/mcp/stage.ts, types.ts             # MOD: legacy-carry + renamed-stub inputs; permission-policy notice
├── bridges/mcp/marker.ts                      # MOD: kept stub's original key
├── bridges/mcp/adapter-doc.ts, adapter-entry.ts # MOD: write-back under the original key
├── domain/mcp-server-features.ts              # MOD: D-05-05 (two features leave the blocked set)
├── domain/resolver-types.ts                   # MOD: schema mirror; optional malformed-server list
├── domain/mcp-resolution.ts, plugin-resolver.ts # MOD: opt-in per-server malformed drop (migration only)
└── shared/notification-dispatch.ts            # MOD: new notice kind + notifyMcpMigration
docs/output-catalog.md, docs/mcp-compatibility.md # MOD: amendments
tests/... one paired test per touched source; tests/architecture/mcp-config-notices.test.ts (+row);
tests/architecture/mcp-migration-notice.test.ts (NEW byte lock); tests/integration/mcp-migration*.test.ts
```

File names are suggestions; the planner owns them. Avoid the word "migrate" alone: `persistence/migrate.ts` and `migrateFirstRunConfig` already mean state/config schema migration.

### Pattern 1: Placement and locking (research question 1)

**What:** run the step inside `applyReconcileWithReader`'s per-scope loop, after `readPassForScope` returns and before `applyPlan`. Take a fresh `withLockedStateTransaction(locationsFor(scope, cwd), ...)` of its own. `proper-lockfile` is configured `retries: 0` and is not re-entrant, so it must not run inside the read pass's lock (the read pass releases its lock when `readPassForScope` returns).

Evidence:
- The loop and its order: read pass at `apply.ts:1330`, `applyPlan` at `apply.ts:1364`, backfill at `apply.ts:1376`, routing rebuild at `apply.ts:1384`; the empty-outcomes silent return at `apply.ts:1390-1392`; the cascade notify at `apply.ts:1403-1404`. [VERIFIED: apply.ts:1307-1425 read this session]
- `index.ts:141-168` wraps `applyReconcile` in try/catch and turns any escape into a `reconcile aborted:` error notify. [VERIFIED: index.ts read this session]
- `withLockedStateTransaction` throws on a second `save()`: `throw new Error("LockedStateTransaction.save() called more than once.");` [VERIFIED: with-state-guard.ts:96-106]
- Lock acquisition mkdirs `extensionRoot` (`await mkdir(locations.extensionRoot, { recursive: true });`), which is why the read pass and the routing rebuild skip pristine scopes. [VERIFIED: with-state-guard.ts:117-118; apply.ts:149-156, 1460-1463]

Rules the planner should encode:
1. **Read before locking.** Read `mcp.json` without the lock first. No marked entry (or no file) returns immediately: no lock, no mkdir, no bytes. This keeps pristine scopes and the steady state silent (WR-05, SC-1).
2. **No `state.json`?** Then no owner can exist; every owner is AMIG-04 unowned. Report rows and take no lock.
3. **Per-scope isolation, migration-specific.** Wrap the step so a throw becomes a migration left-in-place row for that scope, never an `invalid-block` reconcile outcome (that would put a migration failure into the cascade notice and break D-05-12's separation) and never an escape (which would abort reconcile for both scopes).
4. **Not gated on the backfill version stamp.** The trigger is the presence of marked legacy entries only (ROADMAP note; backfill stamps unconditionally, `backfill.ts:106-113`).
5. **Run even when the scope's config is invalid** (`readResult.invalidOutcomes` non-empty, plan undefined): the migration reads records, not config. Skip only when the read pass threw (state unreadable).
6. **Emit the notice after the scope loop and before the `outcomes.length === 0` return**, so a migration with no reconcile outcomes still speaks and the order "migration notice, then cascade" holds.
7. **Seam for apply tests:** add an optional D-12-style member on `ApplyReconcileOptions` (the file already has `uninstallPlugin?` and the LOAD-01 stamp seam with that rationale, `types.ts:355-375`), defaulting to the real step.

### Pattern 2: Offline source read for both source kinds (research question 3)

**What:** reproduce reinstall's source choice without its clone fallback.

Reinstall's choice [VERIFIED: reinstall-flow.ts:753-760, 926-971; reinstall-clone-probe.ts:43-75]:
- Entry: `loadCachedEntry(mp.manifestPath, ...)` reads the **current** cached marketplace manifest.
- Path source: `resolveStrict(entry, { marketplaceRoot: mp.marketplaceRoot, marketplaceName })` with no callback: the marketplace's current checkout.
- Git source (`url`, `git-subdir`, `github`) **with** `record.resolvedSha`: `probeReinstallClone`. Unpinned (`source.sha === undefined`): a warm mirror at `pluginCloneDir(pluginMirrorKey(cloneUrl))` wins, its sha read from `.git/HEAD`. Otherwise `materializePluginClone({ pin: recordedSha, ... })`, which returns the cached dir when `pathExists(cloneRoot)` and **clones on a miss** (`clone-cache.ts:204-230`).
- Git source **without** `resolvedSha`: no callback, so `unavailable`.

The migration must not call `probeReinstallClone` or `materializePluginClone` (network on a miss; and `reinstall-clone-probe.ts` imports `buildCloneAuth` from `auth-host.ts`, a `NETWORK_SEAMS` file). The existing fs-only `makePresenceProbe` is close but keys a pinned source on the **manifest's** `source.sha`, not the record's `resolvedSha`: `const key = pluginCloneKey(cloneUrl, source.sha);` [VERIFIED: git-source-probe.ts:163-167]. After a marketplace update moves the manifest pin, that probe would read a different (possibly cold) commit than reinstall.

**Recommendation:** add an fs-only recorded-sha probe to `git-source-probe.ts` (same module, same `anchorSubdir` tail, same BLOCK F standing):

```typescript
// Shape only. Mirrors probeReinstallClone's choice, with "not-cached" in place of the clone.
export function makeRecordedShaPresenceProbe(
  locations: ScopedLocations,
  recordedSha: string,
): (source: UrlSource | GitSubdirSource | GitHubSource) => Promise<GitPluginRootResult> {
  return async (source) => {
    const cloneUrl = canonicalCloneUrl(source);
    if (source.sha === undefined) {
      const mirrorDir = await locations.pluginCloneDir(pluginMirrorKey(cloneUrl));
      if (await pathExists(mirrorDir)) {
        return anchorSubdir(source, mirrorDir, await readMirrorHeadSha(mirrorDir));
      }
    }
    const cloneDir = await locations.pluginCloneDir(pluginCloneKey(cloneUrl, recordedSha));
    return (await pathExists(cloneDir))
      ? anchorSubdir(source, cloneDir, recordedSha)
      : { kind: "not-cached" };
  };
}
```

`pluginCloneKey(canonicalUrl: string, fullSha: string)`, `pluginMirrorKey(canonicalUrl: string)` and `canonicalCloneUrl(source)` are the domain exports [VERIFIED: clone-key.ts:37, 56, 81]. A `not-cached` result makes `resolveStrict` return `unavailable` (`plugin-resolver.ts:424-483`), which the migration maps to D-05-02 left-in-place. A manifest read that throws, an absent entry, or an entry that fails `PLUGIN_ENTRY_VALIDATOR.Check` also map to D-05-02 (the same three arms `backfill.ts:523-546` handles).

Note for the plan: for a **path** source, reinstall and therefore the migration read the marketplace's current checkout, which may hold a newer plugin version than the record names. The migration then stages that version's servers under the old record version. This is reinstall parity (D-68-02 keeps the recorded version string) and is acceptable, but the plan should state it.

### Pattern 3: Re-stage with legacy input (research questions 4 and 8)

**What happens today in `prepareStageMcpServers`** [VERIFIED: stage.ts:326-445]: it keys the plugin's servers with `generatedMcpServerKey`, reads `mcp-adapter.json`, partitions into `ours` (marked for this plugin, any server key), `overlays` (marker-less, no transport, selected key), `theirs`, `keptOverrides`; checks collisions against the nine sources; then `stampServers({ previous: { ...ours, ...overlays }, keptOverrides: { ...keptOverrides, ...overlays }, ... })` and `withPluginServers(config, plugin, mp, stamped)`. Both `previous` and `overlays` are keyed by the **new** key, so neither the legacy entry (keyed `github` in another file) nor an old-name stub (`github` in this file) reaches carry-forward. The migration needs two optional inputs on `StageMcpInput`:

1. **Legacy carry (D-05-09):** for each declared server, the legacy entry keyed by its new key, used as `previous` **only when `ours` has no entry under that key**. In the half-done state the adapter entry already exists and already carries the user's fields, so it is authoritative and the restage stays byte-stable.
2. **Old-name stub absorption (D-05-10):** for each declared server whose old (declared) name holds an overlay in the same file, treat that overlay as the overlay of the new key (carried fields active, stub kept in the marker) and drop the old key from the written doc. `withPluginServers` today drops an overlay only when its own name is restaged (`adapter-doc.ts:320`), so the old key needs an explicit drop list.

The adapter merges same-name entries per field (`mergeServerMaps`), so what the user saw was the legacy fields with the stub's fields on top. When both a legacy hand edit and an old-name stub exist, merge them field-wise for `previous` (`{ ...legacyCarried, ...stub }`) rather than letting the stub replace the legacy entry whole as `{ ...ours, ...overlays }` does. [ASSUMED: field-wise is the better parity choice; confirm in planning]

The carried set, verbatim [VERIFIED: adapter-entry.ts:41-51]:
```typescript
const CARRIED_FIELDS = [
  "disabled",
  "approveTools",
  "includeTools",
  "excludeTools",
  "lifecycle",
  "idleTimeout",
  "requestTimeoutMs",
  "debug",
  "searchKeywords",
] as const;
```

**Kept-stub key (D-05-10).** The marker today, verbatim [VERIFIED: marker.ts:16-36]:
```typescript
export const CLAUDE_MARKETPLACE_MARKER_KEY = "_piClaudeMarketplace";
export interface ClaudeMarketplaceMarker {
  readonly plugin: string;
  readonly marketplace: string;
  readonly pluginSetFields?: readonly string[];
  readonly keptOverride?: Readonly<Record<string, unknown>>;
}
```
Add one optional string member for the stub's original key, written only when it differs from the entry's key (so every existing marker stays byte-identical, MC-5), placed so `buildMarker` stays deterministic (it puts `keptOverride` last, `marker.ts:98-113`). `readMarker` must accept it only as an own string (same tolerance as the other members). Every consumer of `keptOverride` must then honor it:
- `adapter-doc.ts` `survivingEntry`/`keptServers` (`308-345`) write the restored override back **under the original key**, through `safeSet` (the key is file content; `__proto__` must stay an own key, WR-01).
- `restoredOverrideNames` (`282-300`) must report the original key, because the `override-restored` notice cancels the `override-kept` notice by `(scope, file, server)` (`notification-dispatch.ts:324-347`).
- `keptOverridesOf` / `stampServers` / `keptOverrideFor` (`adapter-doc.ts:229-245`, `adapter-entry.ts:195-243`) must carry the key forward on update/reinstall so a later write-back still targets it.
- Decide what write-back does when the original key is occupied at write-back time (Open Question 4).

**Rename map.** `generatedMcpServerKey(plugin, server)` is the domain builder [VERIFIED: name.ts:248-252]:
```typescript
export function generatedMcpServerKey(plugin: string, server: string): string {
  assertSafeName(plugin);
  const claudeServerName = mcpServerDisplayName(plugin, server);
  return `${claudeServerName.replaceAll(/[^A-Za-z0-9_-]/g, "_")}_`;
}
```
The legacy key is the declared name: the released writer staged `safeSet(stamped, name, { ...entryObj, [CLAUDE_MARKETPLACE_MARKER_KEY]: marker })` with `marker = buildMarker(pluginName, marketplaceName)` (plugin + marketplace only) into `locations.mcpJsonPath`. [VERIFIED: `git show main:extensions/pi-claude-marketplace/bridges/mcp/stage.ts` lines 191-224, 244-317] So `old -> new` is `declared -> generatedMcpServerKey(plugin, declared)` for every legacy key the re-resolved source still declares; every other marked legacy key of the owner is a D-05-04 removal (or a D-05-06/07 drop when the source declares it but the classifier excludes it).

### Pattern 4: Write order, half-done detection, idempotence (research question 4)

**Order per scope:** for each owner in turn, `prepare` then commit `mcp-adapter.json`; after all owners, one `tx.save()` if any record changed; then one `mcp.json` write that removes every finished owner's marked entries (chain `withPluginServers(config, plugin, mp, {})` per owner over the one doc read inside the lock).

Why state comes before the legacy removal: the migration's only trigger is a marked legacy entry. Crash points and what the next `/reload` sees:

| Crash after | Files | Next `/reload` |
|---|---|---|
| nothing written | legacy only | full migration (normal) |
| adapter write | both | re-stage (identical bytes, skipped), save record, remove legacy |
| state save | both, record updated | re-stage (skipped), record unchanged (no save), remove legacy |
| legacy write | adapter only | not triggered; steady state |

With the opposite order (legacy before state), a crash after the legacy removal leaves a stale record (`installable: true`, a dropped server still in `resources.mcpServers`) and no trigger to ever fix it. A per-plugin `withLockedStateTransaction` (one lock per owner, each adapter -> save -> legacy) is the equivalent alternative if the planner prefers per-plugin isolation of the file writes; it costs one lock per plugin.

**Byte-compare skip.** `atomicWriteJson` writes `Buffer.from(JSON.stringify(value, null, 2) + "\n", "utf8")` [VERIFIED: atomic-json.ts:27-29]. Before committing, compare that serialization with the file's current bytes and skip an identical write. This makes the half-done finishing run touch only `mcp.json`. Do not rely on `prepare` being a no-op: `withPluginServers` removes a restaged owned entry and re-appends it at the end of the server map (`adapter-doc.ts:314-321, 380-385`), so a restage can reorder entries when another plugin's entries follow ours.

**Steady state = zero writes.** After a complete move there is no marked legacy entry, so step 1 of Pattern 1 returns before any lock or write. That is what satisfies "a second `/reload` changes no bytes in either file or in `state.json`".

**Record delta (D-05-04/06/07).** Write the record only when one of these changes, and stamp `updatedAt` only then:
- `resources.mcpServers` = the staged declared names (`result.recorded[].generatedName` holds the **declared** name, `types.ts:52-63`).
- On a D-05-06/07 drop: `compatibility.installable = false` and `"mcpServers"` added to `compatibility.unsupported` (list derives `(partially-installed)` from a non-empty `unsupported`, `plugin-state-classifier.ts:66-83`, and `narrowUnsupportedKinds` renders it `{unsupported mcp}`), plus the resolver's `malformed mcp server "x": ...` note for D-05-07.
- Change nothing else on the record (D-05-03 is MCP-only). Do not copy the re-resolved `supported` list; it describes components the migration did not touch.

### Pattern 5: Owners, AMIG-04, disabled and other-scope records (research questions 6, 7)

- **Group** marked legacy entries by marker `(plugin, marketplace)`. `isOwnedBy` and the private `readMarker` live in `marker.ts`; add an exported reader (for example, the owner of an entry, or every owner in a doc) rather than re-parsing the marker in the orchestrator.
- **No record in this scope -> AMIG-04** leave in place + warn, **unless** the scope's plan installs or dependency-installs that plugin in this reload (`plan.pluginsToInstall`, `plan.pluginsToDependencyInstall`, `types.ts:283-294`). Those installs run the D-05-08 sweep, so warning would be wrong and the next reload would not repeat it. This is the reason to place the step after the read pass (Pattern 1).
- **Record in the other scope only** -> AMIG-04 unowned here (discretion default). It matches D-02-13/D-02-17 only for collisions: the other scope's own marked entries are "one effective server" for collision purposes, but an old-name legacy entry is a **different** key from the other scope's `plugin_<p>_<s>_`, so both run. Leaving it with a warning is the honest outcome.
- **Planned uninstall or disable in this reload** -> skip; `unstageMcpServers` removes the plugin's marked entries from both files (`unstage.ts:187-216`, D-02-12).
- **Disabled record** (`isRecordedButDisabled`) -> removal only, no re-stage (ENBL-08). A planned enable runs the install ledger, whose mcp phase now sweeps.
- **D-05-08 sweep:** put it in `install-outcome.ts`'s `mcpPhase.do`, after `replacePreparedMcp(prep)` (`install-outcome.ts:963-985`). That one phase serves install, enable (`runInstallLedger`), the install cascade, reconcile installs and import. Capture the legacy file's prior bytes and restore them in `undo` **before** `rollbackMcpReplacement`, so a rollback also re-adds before it removes. Route the sweep's `comments-dropped` notice for `mcp.json` through the existing `mcpConfigNotices` channel.
- Reinstall (`reinstall-replace.ts:444-498`) and update (`update-swap.ts:322, 1151`) are **not** in D-05-08 and write only `mcp-adapter.json`. See Open Question 2: D-05-02's remedy (`reinstall`) then leaves both copies for one session.

### Pattern 6: The one notice (research question 9)

- Today reconcile emits one cascade `notify()` plus two sanctioned extra notifies: post-commit warnings via `notifyDiagnostic` and MCP config notices via `notifyMcpConfigNotices` (`apply.ts:1403-1424`). `notifyMcpConfigNotices` sends **one notify per notice kind** (`notification-dispatch.ts:368-394`), so it cannot carry D-05-15's single body.
- Add `notifyMcpMigration(ctx, report)` to `shared/notification-dispatch.ts`. Reuse that module's private line builders (`mcpVariablesMissingLine`, `mcpCredentialsBlankedLine`, `mcpConfigFileLine`, `notification-dispatch.ts:284-308`) for the D-04-10 lines, so the migration and install wording cannot drift. Append `RELOAD_HINT_TRAILER` once [VERIFIED: notification-summary.ts:108 `export const RELOAD_HINT_TRAILER = "/reload to pick up changes";`].
- Severity per D-05-14. At `warning`, the first line must be a summary line followed by a blank line (the host prepends `Warning:`; `notifyDiagnostic` and `notifyMcpConfigNotices` follow that shape). At `info`, no summary is needed.
- Rows sorted project before user (D-05-12). `compareByNameThenScope` sorts by name first (`compare-name-scope.ts:11-23`); D-05-12 asks for scope first, so sort by scope, then by plugin and old name.
- Prefer prose reasons in the free-form body over new `Reason` members. The existing `{unsupported mcp}` and `{malformed mcp}` tokens can appear literally. A new token such as `{not declared}` would need the COMPAT-01 and closed-set amendments (`compat-01-no-expansion.test.ts:198-307`).
- Byte-lock the catalog blocks with a dedicated architecture test modelled on `tests/architecture/mcp-config-notices.test.ts` (it reads `<!-- catalog-state: ... -->` blocks through `catalog-block.ts`; the catalog-uat walk only drives structured `notify()`).
- **Rename row emission rule (half-done):** emit the `old -> new` row in the run that removes the old entry from `mcp.json`. A run whose adapter write succeeded but whose legacy removal failed reports a left-in-place row ("old entry not removed yet; next /reload finishes"), and the finishing run reports the rename once. This keeps one rename row per server across the two runs. [ASSUMED: wording and rule are the planner's to confirm with the operator]

### Pattern 7: D-05-05 amendment, end to end (research question 5)

Current union, verbatim [VERIFIED: mcp-server-features.ts:24-36]:
```typescript
export type McpUnsupportedFeature =
  | "ws"
  | "sse-ide"
  | "ws-ide"
  | "sdk"
  | "claudeai-proxy"
  | "headersHelper"
  | "oauth.xaa"
  | "tools[].permission_policy"
  | "toolPermissions"
  | "command ~"
  | "args ~"
  | "bareElicitationCapability";
```
Blast radius (each verified by grep plus the file read this session):
1. `domain/mcp-server-features.ts`: remove the two literals; `remoteFeature` (`291-309`) stops returning them; doc comments at `286-290` and `354-366` list the order. Keep `TOOL_POLICY`/`toolPermissions` in `REMOTE_SERVER_SCHEMA` (`228-253`): they still decide `malformed`. Add a pure helper that reports which restriction fields a supported server carries (`tools[]` with any `permission_policy`, non-empty `toolPermissions`).
2. `domain/resolver-types.ts:71-89`: `DroppedMcpServerSchema` mirrors the union; the two-way `AssertTrue` drift checks (`91-105`) make the compiler force this edit.
3. `bridges/mcp/stage.ts`: emit a new per-server `McpConfigNotice` kind (scope, `file: "mcp-adapter.json"`, plugin, server key, field names) from `prepareStageMcpServers` in declared order, next to `variableNotices` (`227-241`). Every staging path already routes `result.notices` (install, update, reinstall, enable, import, reconcile, marketplace update), so D-05-05's "every staging path" holds by construction, and the migration renders it in its own body.
4. `shared/notification-dispatch.ts:276-282, 368-394`: add the kind to the union and a summary/line pair to `notifyMcpConfigNotices`.
5. `orchestrators/marketplace/shared.ts:372-393` `foldUnstageNotices`: drop the new per-server kind for removed servers, as it drops `variables-missing`/`credentials-blanked`.
6. `docs/output-catalog.md:725` (the `{unsupported mcp}` paragraph names both features), a new `<!-- catalog-state: ... -->` block, and `docs/mcp-compatibility.md:125-126` (rows marked ✗).
7. Tests: `tests/domain/mcp-server-features.test.ts:463-499` (three cases flip from blocked to supported), `tests/architecture/mcp-config-notices.test.ts` (`CATALOG_NOTICE_ROWS`, new row), `tests/bridges/mcp/stage.test.ts`, `tests/shared/notification-dispatch.test.ts`, `tests/orchestrators/marketplace/shared.test.ts`.
8. No `Reason`/`StatusToken` change: `{unsupported mcp}` stays (`compat-01-no-expansion.test.ts:305-306`).

Released 0.19.x records never carried `{unsupported mcp}` (the classifier arrived in this milestone), so no shipped record is `partially-installed` only because of a permission policy. Branch-local test records may be.

### Pattern 8: D-05-07 per-server malformed drop

`recordMcpServers` sets `malformed = true` on any malformed server and `decideResolution` then returns `unavailable` for the whole plugin, which carries no `pluginRoot` or `mcpServers` (NFR-7). [VERIFIED: mcp-resolution.ts:32-60; plugin-resolver.ts:696-712; resolver-types.ts:151-156] The migration cannot stage "the rest" from that arm.

**Recommendation:** an opt-in field on `ResolveContext` (the precedent is `pathPluginPin`/`resolvePathPluginRoot`, `resolver-types.ts:209-225`) that makes `recordMcpServers` record a malformed **server** (a valid `mcpServers` map with one bad member) as dropped instead of structural, add `"mcpServers"` to `unsupported`, and expose the dropped server with its detail on the materializable arms (a new optional field next to `droppedMcpServers`, with its own TypeBox mirror). Only the migration passes the flag; install, update, reinstall, list and info keep D-03-18. A malformed `mcpServers` value as a whole, an unreadable `.mcp.json`, or a structural defect elsewhere in the plugin still resolves `unavailable`, which the migration treats as D-05-02 left-in-place.

### Anti-Patterns to Avoid
- **Name-keyed removal.** Old and new keys differ; always remove by marker (`ARCHITECTURE.md` research: "Name-keyed unstage").
- **Any migration flag** in the marker or `state.json` (COMPAT-01).
- **Calling `probeReinstallClone`/`materializePluginClone`** at load (clones on a miss; NFR-5).
- **Removing legacy entries before the record save** (Pattern 4 table).
- **Reusing `notifyMcpConfigNotices`** for the migration body (several notifies, breaks D-05-12/15).
- **Pushing migration rows into reconcile `outcomes`**: they would render in the cascade and be re-surfaced by `surfaceMcpConfigNotices`.
- **Letting the step throw** past `applyReconcile` (aborts reconcile for both scopes).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSONC read with the adapter's grammar | A JSON.parse with comment stripping | `readMcpConfigDoc(path, PI_MCP_SERVER_KEYS)` | Same `strip-json-comments` options and BOM rule as the adapter (AFILE-02); typed `McpConfigFileError`. |
| Removing a plugin's marked entries | Manual key deletion | `withPluginServers(config, plugin, mp, {})` | Writes back kept overrides, keeps foreign keys and top-level key order, `safeSet` against `__proto__`. |
| Entry translation and expansion | A legacy-entry translator | `prepareStageMcpServers` -> `stampServers` -> `translateMcpServer` + `substituteAndInject` | D-05-01; the closed table and the Phase 4 escapes. |
| Nine-source collision check | A new walk | `assertNoMcpCollisions` inside `prepareStageMcpServers` (throws `McpServerCollisionError`) | D-05-11 reuses D-02-03 exactly. |
| Clone presence | `existsSync` on a guessed path | `locations.pluginCloneDir(pluginCloneKey(...))` + `pathExists` | Containment (`assertSafeName` + `assertPathInside`) is inside `pluginCloneDir`. |
| Atomic writes / lock | `fs.writeFile`, ad-hoc lock | `atomicWriteJson`, `withLockedStateTransaction` | NFR-1; fallow chokepoint rules. |
| Row ordering, reload hint | String literals | `RELOAD_HINT_TRAILER`, scope-first sort | Catalog consistency. |

**Key insight:** every rule that makes the stage correct (carry-forward, kept stubs, collision exemptions, escapes) lives in the bridge; the migration should only choose inputs and order writes.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data (ours) | Marked entries in `<agentDir>/mcp.json` (user) and `<cwd>/.pi/mcp.json` (project) keyed by declared name. `state.json` records whose `resources.mcpServers` hold declared names (unchanged by the rename). Old-name marker-less stubs and panel full copies in `mcp-adapter.json`. | Data migration (this phase). Project scope migrates only for the project Pi is opened in; other projects migrate when opened. Record edits only for D-05-04/06/07. |
| Stored data (adapter-owned, keyed by server name) | OAuth tokens: directory `sha256-<sha256(serverName)>` (`mcp-auth.ts:644-656`). Project approvals: `{ projectRoot, serverName, definitionHash }` (`project-server-trust.ts:163-170`); a definition change alone also re-prompts. Metadata cache entries `cache.servers[serverName]` (`metadata-cache.ts:165, 342`). Keychain-backed credentials when that store is configured (`mcp-auth.ts:213-264`). | Not migrated (adapter-private storage, out of contract). Covered by the D-05-15 cost line: sign in again, re-approve project servers. Old-name records become orphans in the adapter's stores. |
| Live service config | None outside the repo's files. Pi's built-in MCP is turned off by the adapter at `session_start` (`index.ts:1340-1354`). | None. |
| OS-registered state | Possible OS keychain entries under the old server name (adapter keyring store). | None; orphaned, documented as part of the re-sign-in cost. |
| Secrets/env vars | `${VAR}` references in entries are re-derived from source; values never written (AVAR-02). Hand-added secrets in a legacy `env`/`headers` are outside the carried set and are dropped (D-05-09). | None in code; the notice must never print values. Consider a docs note (Phase 7) that hand-added credentials must be re-entered. |
| Build artifacts | None (no build step; no installed package renames). | None. |

## Adapter timing and copies (research question 2)

**Read timing [VERIFIED: code read this session].**
- Pi 1.0.0 emits `session_start` and awaits it, then `resources_discover`, at startup (`agent-session.js:2582-2584`) and on `/reload` (`agent-session.js:2928-2930`).
- The adapter reads its config at factory time (`index.ts:370-372`, `earlyConfig`), and in its `session_start` either takes a deferred snapshot (`getDeferredSessionSnapshot`, `index.ts:751-772`, which calls `loadMcpConfig` synchronously) or starts initialization (`initializeMcp`, `init.ts:146-150`, `loadMcpConfig` evaluated before the first `await`). Both happen before our `resources_discover` handler runs.
- **Deferred path (MEDIUM, not run):** when all enabled servers are lazy and have valid cached metadata, `session_start` registers tools from the snapshot and returns without initializing. The first MCP operation calls `ensureSessionRuntime` -> `startInitialization` -> `initializeMcp` -> `loadMcpConfig` **again** (`index.ts:1262-1271`), which now reads the post-migration files. In the migration session the tool surface therefore lists old-name tools from the snapshot while the runtime knows only the new key: a call to an old-name tool may fail, and the new key's tools are not registered until the next reload. Our entries leave `lifecycle` unset (adapter default lazy, ANAME-05), so this is the common case. This strengthens the reload hint: the notice should tell the user to `/reload` now, not only "one reload later".
- **Eager path:** the session keeps the pre-migration server set (old names, working through the Pi-format `mcp.json` translation) until the next reload.

**Duplicates.** After a clean move the adapter sees each server once on the next reload. After an AMIG-02 fault (adapter written, legacy not removed) the next reload's `session_start` loads **both** `github` (import source `pi-mcp-global`/`pi-mcp-project`, `config.ts:717-735, 799-811`) and `plugin_acme_github_`, so that one session runs two copies; our `resources_discover` then finishes the move. One-session duplicate after a fault is the accepted cost of add-before-remove.

**Pi-format reading of `mcp.json` [VERIFIED: config.ts:1160-1190 and `translatePiMcpServer`].** With Pi 1.0 (`pi.registerMcpServer` exists, `types.d.ts:1343`), the adapter sets `setPiMcpConfigEnabled(true)` (`index.ts:213`) and reads `mcp.json` with Pi's schema. Only `type, command, args, env, cwd, url, headers, oauth, exposure, toolExposure, enabled, timeout, auth, description` are understood; every other key is an ignored setting. `enabled === false` becomes `disabled: true`; `timeout` is **seconds** (`requestTimeoutMs = Math.round(timeout * 1000)`); `type: "sse"` is skipped outright ("legacy SSE transport is not supported"). Consequences:
- Today every legacy entry triggers an adapter `session_start` warning listing `_piClaudeMarketplace` (and any adapter-native field) as ignored (`getLegacyMcpMigrationNotices`, `config.ts:270-288`, shown at `index.ts:1306-1311`). The migration removes that recurring warning.
- Legacy `sse` servers do not run today; after the move they run (`httpTransport: "sse"`).
- D-05-09's carried D-02-06 fields are **inert** in a legacy entry today, while the user's Pi-format disable (`enabled: false`) is the live one. See Open Question 1.

**"Adapter panel copies of our entries" [VERIFIED: config.ts:1924-2011, 1726-1770].**
- `/mcp-adapter` panel direct-tools toggle: `writeDirectToolsConfig` writes into the server's provenance `path`. For a server from a Pi `mcp.json` (kind `import`), provenance `path` is `source.writePath` = the same scope's `mcp-adapter.json`, and the writer stores `servers[name] = { ...fullDef, directTools: value }` under the **old name**: a marker-less **full** definition (the translation dropped our marker as an ignored setting).
- `/mcp-adapter disable|enable <name>`: `writeProjectServerDisabledOverride` always writes the **project** `.pi/mcp-adapter.json`, `{ ...existing, disabled: true }` under the old name. For a user-scope plugin that stub sits in the other scope's file.
- What D-05-10 covers: a marker-less **override** (no transport) under the old name in the **same** scope file. What it does not cover: (a) a panel full copy under the old name (it would keep running beside `plugin_<p>_<s>_`: a permanent duplicate), and (b) a user-scope plugin's old-name disable stub in the project file (the user's disable does not follow the rename). See Open Question 3.

## Common Pitfalls

### Pitfall 1: Activating inert or plugin-declared fields through D-05-09
**What goes wrong:** the 0.19.x writer passed every declared field through into `mcp.json`. A plugin that declared `approveTools: true` or `lifecycle: "keep-alive"` has those in its legacy entry. `carriedFields(previous, pluginSet)` copies every D-02-06 field the previous entry holds (`adapter-entry.ts:122-138`), so the migration writes them into `mcp-adapter.json` as "user" fields, where the adapter honors them. Today they are inert (Pi-format ignored settings). ANAME-07's closed translator exists to stop a plugin from setting `approveTools`/`lifecycle`.
**How to avoid:** treat a carried field as a user edit only when the plugin's current raw declaration lacks it or holds a different value; pending operator confirmation (Open Question 1).
**Warning signs:** a migration test whose fixture plugin declares `approveTools` and whose migrated entry carries it.

### Pitfall 2: The trigger is the only memory
**What goes wrong:** removing legacy entries before durable record changes, or triggering on anything other than marked legacy entries (for example, the backfill stamp), loses retries or causes churn.
**How to avoid:** Pattern 4's order; trigger only on marked legacy entries; read without a lock first.

### Pitfall 3: Restage reorders `mcp-adapter.json`
**What goes wrong:** `withPluginServers` re-appends restaged entries, so re-running prepare on an already-moved plugin can change bytes.
**How to avoid:** byte-compare skip; never restage a plugin without legacy entries.

### Pitfall 4: Degrading a clean record on a load the user did not start
**What goes wrong:** backfill refuses exactly this (`backfill.ts:399-414`: "a clean record degraded, working artifacts removed, on a reload the user did not initiate"). D-05-06/07 decide the opposite for the migration.
**How to avoid:** implement D-05-06/07 as decided, and make the notice say what was dropped and why (D-05-15). Record the divergence from the backfill stance in the module header with AMIG-01.

### Pitfall 5: D-05-07 records that later verbs cannot resolve
**What goes wrong:** a migrated record is `partially-installed` with a malformed server, but `info`, `reinstall` and `update` re-resolve strictly and get `unavailable` (`reinstall-flow.ts:970` `requirePartialInstallable` rejects it). `list` shows `(partially-installed) {unsupported mcp}` from the record, not `{malformed mcp}`.
**How to avoid:** the plan must decide and test what each verb shows for that record (Open Question 5).

### Pitfall 6: Old-name strings in a notice are untrusted
**What goes wrong:** generated keys are sanitized to `[A-Za-z0-9_-]`, but old names come from `mcp.json` keys and manifest declarations. A key with control characters or ANSI escapes would be the first unsanitized file-derived string in an MCP notice.
**How to avoid:** escape or quote old names (for example, render through `JSON.stringify` or strip control characters) and test it.

### Pitfall 7: Cognitive-complexity ceilings
**What goes wrong:** the per-owner branch ladder (no record / planned / disabled / unreadable / collision / staged / drops) easily passes 15 in both ESLint and fallow, which score differently.
**How to avoid:** one small function per decision; a discriminated per-owner verdict type that a renderer switches on.

### Pitfall 8: Adapter module constants bind HOME at import
**What goes wrong:** an integration test that imports the adapter's `config.js` reads `GENERIC_GLOBAL_CONFIG_PATH = join(homedir(), ...)` at module load (`config.ts:16`).
**How to avoid:** set the hermetic `HOME` and `PI_CODING_AGENT_DIR` before the dynamic import.

## Code Examples

### Reading the legacy owners (existing calls)
```typescript
// Source: bridges/mcp/unstage.ts:79-100, 197-203 (pattern, existing API)
const legacy = await readMcpConfigDoc(locations.mcpJsonPath, PI_MCP_SERVER_KEYS);
const { ours } = partitionServers(legacy, pluginName, marketplaceName);
const next = withPluginServers(legacy, pluginName, marketplaceName, {}); // removes ours, writes back kept stubs
```

### Server keys and paths (verbatim values)
```typescript
// Source: bridges/mcp/adapter-doc.ts:35-46
export const ADAPTER_SERVER_KEYS = Object.freeze(["mcpServers", "mcp-servers"] as const);
export const PI_MCP_SERVER_KEYS = Object.freeze(["mcpServers"] as const);
// Source: persistence/locations.ts:211-212
const mcpJsonPath = path.join(scopeRoot, "mcp.json");
const mcpAdapterJsonPath = path.join(scopeRoot, "mcp-adapter.json");
```

### Operations seam for the write-order test (shape)
```typescript
// Pattern: orchestrators/plugin/reinstall-replace.ts:151-247 (REAL_* default object)
export interface McpMigrationOperations {
  readonly prepareStageMcpServers: typeof prepareStageMcpServers;
  readonly writeAdapterDoc: (prepared: PreparedMcpStaging) => Promise<void>;   // commit, byte-compare skip
  readonly writeLegacyDoc: (filePath: string, doc: RawMcpDoc) => Promise<void>; // atomicWriteJson
  readonly withLockedStateTransaction: typeof withLockedStateTransaction;
}
```
Names are illustrative [ASSUMED]; the real ones must match the existing exports at plan time.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 0.19.x: entries in `<scopeRoot>/mcp.json`, declared-name keys, all fields passed through, marker `{plugin, marketplace}` | This milestone: `mcp-adapter.json`, `plugin_<p>_<s>_`, closed translator, marker with `pluginSetFields`/`keptOverride` | Phases 2-4 | The migration bridges the two; Phases 2-5 ship in one release. |
| Adapter 2.x read `mcp.json` in adapter format | Adapter 5.x on Pi 1.0 reads `mcp.json` in Pi format (ignored settings) | adapter 5 + Pi 0.99+ | Legacy entries run degraded today; carried-field semantics change (Pitfall 1). |
| `tools[].permission_policy` / `toolPermissions` block install | Install with a warning (D-05-05) | This phase | More plugins install without `--partial`. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Field-wise merge of a legacy entry and an old-name stub for `previous` is the right parity choice. | Pattern 3 | A user's legacy hand edit or stub field is lost or wins wrongly. |
| A2 | Emit the rename row in the run that removes the old entry; a faulted run reports left-in-place. | Pattern 6 | Two rename rows, or none, across a fault. |
| A3 | Operations-seam member names. | Code Examples | Rename only. |
| A4 | In the deferred adapter path, an old-name tool call in the migration session fails (code reading only). | Adapter timing | Notice wording over- or under-states the lag; Phase 7 live UAT (ADOC-02) should count reloads and observe. |
| A5 | No damping of repeated left-in-place warnings is needed; every condition is user-clearable (reinstall, resolve collision, remove or install). | Open Questions | Noise on every reload for users who ignore it. |
| A6 | Skipping plugins planned for uninstall/disable in the same reload is safe because unstage sweeps both files. | Pattern 5 | A skipped plugin whose uninstall then fails keeps legacy entries (they still work; next reload migrates). |

## Open Questions

1. **D-05-09 against the Pi-format reality (needs operator decision).**
   - What we know: legacy entries' D-02-06 fields are inert today; plugin-declared values sit in them because 0.19.x passed every field through; the live user disable in Pi format is `enabled: false` (and `exposure: "hidden"`), not in the carried set.
   - What's unclear: whether "carry exactly as an update carries them" should (a) skip a carried field whose value equals the plugin's raw declaration, and (b) map Pi-format `enabled: false`/`exposure: "hidden"` to `disabled: true`.
   - Recommendation: yes to both. (a) closes a privilege escalation (`approveTools`), (b) keeps the user's disable (Claude parity). Both amend D-05-09, so ask before planning.
2. **D-05-08 does not cover reinstall and update.** D-05-02's remedy is `reinstall`, which writes only `mcp-adapter.json`; the user then runs two copies until the next reload, when the migration sees a half-done state and finishes it. Recommendation: extend the sweep to `reinstall-replace.ts` and `update-swap.ts` (with byte rollback), or accept and say so in the notice. Operator decision.
3. **Panel full copies and cross-scope disable stubs** (see Adapter timing). Recommendation: leave a full copy in place and report it as a left-behind duplicate in the notice (deleting user-authored-looking content needs a decision, PITFALLS research); state in the docs that a user-scope plugin's project-file disable stub does not follow the rename. Operator decision.
4. **Write-back target occupied.** When an unstage writes a kept stub back under its original key and that key now holds another entry, recommend: keep the occupant and drop the stub (never overwrite a live entry), with no notice. Confirm.
5. **Later verbs on a D-05-07 record.** Decide what `info`, `list`, `reinstall` and `update` show and allow for a `partially-installed` record whose source resolves `unavailable` under the strict rule. Recommendation: no behavior change in this phase beyond tests that pin today's output, and a BACKLOG item; or pass the lenient resolver flag for records already `installable: false`. Operator decision (D-05-07 reversibility note anticipates it).
6. **Unparseable `mcp.json` or `mcp-adapter.json`.** Recommendation: one left-in-place row naming the scope and file (D-02-14 precedent), no write.

### Resolutions (operator, 2026-10-08)

Recorded in `05-CONTEXT.md`; they supersede the recommendations above.

1. D-05-09 revised: nothing is carried from a legacy entry; it is deleted as
   cleanup and the plugin installs fresh. Pitfall 1 is closed by construction.
2. D-05-08 extended to reinstall and update (and import).
3. D-05-10 revised: old-name disable stubs and panel full copies are deleted
   as cleanup under a strict matching rule and listed in the notice.
4. Moot: no kept-stub absorption, so no write-back target.
5. D-05-07 revised: fresh-install rule; a malformed server makes the plugin's
   MCP unavailable, all its legacy entries are removed, none written. No
   lenient resolver flag.
6. D-05-19: unparseable file -> no write, one left-in-place row.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build, tests | ✓ | v26.11.0 (engines admits `>=26.0.0`) | — |
| npm | scripts | ✓ | 11.20.0 | — |
| `@earendil-works/pi-coding-agent` (dev) | types, ordering evidence | ✓ | 1.0.0 | — |
| pi-mcp-adapter scratch install | adapter evidence; optional conformance test | ✓ | 5.1.0 at `/var/tmp/mcp4-p4-08/adapter/node_modules/pi-mcp-adapter` | CI sets `PI_MCP_ADAPTER_ROOT` (`.github/workflows/ci.yml:125`) |

**Missing dependencies with no fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` + `node:assert/strict` (Node 26 locally, 24 in CI) |
| Config file | none (scripts in `package.json`; reporter `scripts/test-reporter.mjs`) |
| Quick run command | `node --test tests/orchestrators/reconcile/mcp-migration.test.ts` (owner test of the file being edited) |
| Direct coverage of one pair | `npm run test:coverage:direct -- tests/orchestrators/reconcile/mcp-migration.test.ts` |
| Full suite command | `npm run check` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AMIG-01 | Marked legacy entries for a path-source plugin move into `mcp-adapter.json` as `plugin_<p>_<s>_` with `toolPrefix`, `directTools`, description, carried fields; legacy keys removed | unit | `node --test tests/orchestrators/reconcile/mcp-migration.test.ts` | ❌ Wave 0 |
| AMIG-01 | Git-source plugin with a warm recorded-sha clone moves; cold cache is left in place with the reinstall remedy; no network module touched | unit | same file; plus `node --test tests/orchestrators/plugin/git-source-probe.test.ts` | ❌ / ✅ (extend) |
| AMIG-01 | Second run: zero writes, byte-identical `mcp.json`, `mcp-adapter.json`, `state.json`, no lock file created in a pristine scope | unit | mcp-migration test (bytes + recorded-ops list empty) | ❌ Wave 0 |
| AMIG-01 | `resources_discover` path: migration runs before `applyPlan`, notice before cascade, throw isolated | unit | `node --test tests/orchestrators/reconcile/apply.test.ts` | ✅ (extend) |
| AMIG-02 | Fault between adapter write and legacy removal: no server lost (both files hold it), write order recorded as adapter -> state -> legacy, next run finishes with legacy write only, third run writes nothing | unit (injected failing op) | mcp-migration test | ❌ Wave 0 |
| AMIG-02 | Same fault with a real filesystem refusal (`lockedLink`, 0o555 dir, as `tests/bridges/mcp/unstage.test.ts:30-52`) through `applyReconcile` | integration | `npm run test:integration` (new `tests/integration/mcp-migration.test.ts`) | ❌ Wave 0 |
| AMIG-02 | Install/enable D-05-08 sweep: adapter write before legacy removal; rollback restores legacy bytes before the adapter rollback | unit | `node --test tests/orchestrators/plugin/install-outcome.test.ts` | ✅ (extend) |
| AMIG-03 | Notice byte form per catalog block: info all-moved; warning with summary line; rows project before user; cost line; D-04-10 and D-05-05 lines; reload hint once | architecture lock + unit | `node --test tests/architecture/mcp-migration-notice.test.ts` and `tests/shared/notification-dispatch.test.ts` | ❌ Wave 0 |
| AMIG-03 | Silent when nothing moved, removed or left | unit | mcp-migration test + apply test | ❌ |
| AMIG-04 | Unowned entry left in place with a warning; suppressed when the plan installs that plugin, and the install sweep removes it | unit + integration | mcp-migration test; integration with `claude-plugins.json` declaring the plugin | ❌ |
| D-05-05 | `tools[].permission_policy` / `toolPermissions` servers stage with the new notice on install, update, reinstall, enable, migration | unit + architecture lock | `tests/domain/mcp-server-features.test.ts`, `tests/bridges/mcp/stage.test.ts`, `tests/architecture/mcp-config-notices.test.ts` | ✅ (update) |
| D-05-06/07 | Blocked / malformed server dropped, rest moved, record `installable: false` + `mcpServers` unsupported; fresh install of the malformed plugin still refuses | unit | mcp-migration test; `tests/domain/mcp-resolution.test.ts` | ❌ / ✅ |
| D-05-10 | Old-name stub absorbed under the new key, kept in marker with its key, old key removed; uninstall writes it back under the old key; restored notice cancels kept notice | unit | `tests/bridges/mcp/adapter-doc.test.ts`, `marker.test.ts`, `unstage.test.ts`, `stage.test.ts` | ✅ (extend) |
| D-05-11 | Full definition at the new key in another source: plugin moves nothing, warning names key and source label (no absolute path) | unit | mcp-migration test | ❌ |
| Adapter view | With the real adapter, post-migration `loadMcpConfig` has `plugin_<p>_<s>_` and not the old key; the half-done state has both | integration (optional peer) | `PI_MCP_ADAPTER_ROOT=... npm run test:integration` | ❌ (optional) |

### Fault-injection design (AMIG-02)
- The step takes an operations object (Pattern Code Examples) with a REAL default. The test wraps each real operation in a recorder that pushes `"mcp-adapter.json"`, `"state.json"`, `"mcp.json"` and then calls through; a failing variant of the legacy writer throws once.
- Assertions, in this order: recorded writes equal `["mcp-adapter.json", "state.json", "mcp.json"]` on a D-05-06 fixture (record changes) and `["mcp-adapter.json", "mcp.json"]` on a plain fixture; after the throw both files contain the server and nothing else changed; run 2 with real ops records exactly `["mcp.json"]`; run 3 records `[]` and all three files are byte-identical to after run 2.
- Integration twin through `applyReconcile` uses the house `lockedLink` helper so the refusal comes from the filesystem, not a double. A child-process kill (`tests/integration/ipc-child.ts` style) is optional; a thrown write is the in-process equivalent.
- Fixtures per CONTEXT "Specific Ideas": legacy `mcp.json` as 0.19.x wrote it (declared keys, three path variables expanded, pass-through fields, two-member marker); `github: { "disabled": true }` in `mcp-adapter.json`; one plugin with a still-declared, a dropped, a `ws` and a malformed server; git plugin warm and cold; an unowned entry declared by `claude-plugins.json`; a full user server at `plugin_acme_github_`.

### Sampling Rate
- **Per task commit:** the owner test(s) of the touched files; the hook runs `check:commit`.
- **Per wave merge:** `npm run check`.
- **Phase gate:** `npm run check` green on the combined tree before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/orchestrators/reconcile/mcp-migration.test.ts` (pairs the new module)
- [ ] `tests/bridges/mcp/legacy.test.ts` (pairs the new bridge helper, if split out)
- [ ] `tests/architecture/mcp-migration-notice.test.ts` (catalog byte lock)
- [ ] `tests/integration/mcp-migration.test.ts` (end-to-end through `applyReconcile`, `lockedLink` fault)
- [ ] Shared legacy-fixture builder (a non-`.test.ts` file under `tests/` makes the commit hook run every pair; budget for it)

## Security Domain

`security_enforcement` is absent from `.planning/config.json`, so enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (the rename forces re-sign-in; no credential handling added) | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | Closed translator; carried set is closed; do not activate plugin-declared `approveTools`/`lifecycle` (Pitfall 1). |
| V5 Input Validation | yes | `readMcpConfigDoc` grammar + typed refusals; marker read tolerant and own-property only; `safeSet` for every file-derived key (old key write-back included); escape old names in notices. |
| V6 Cryptography | no | — |
| V8 Data Protection | yes | Notices name servers, fields and variables, never values; credential-bearing stub fields stay inert inside the marker (D-02-21); `${VAR}` never expanded to a value on disk (AVAR-02). |
| V12 Files and Resources | yes | `ScopedLocations` paths only (NFR-10); `pluginCloneDir`/`pluginDataDir` containment; symlinked config files keep write-through (D-02-16, accepted). |
| V14 Configuration | yes | NFR-5 offline (BLOCK F); no new dependency. |

### Known Threat Patterns for this phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Plugin-declared adapter-only field (`approveTools`, `lifecycle`) promoted to an active "user" field by the carry | Elevation of privilege | Carry only fields that differ from the plugin's raw declaration (Open Question 1); test with a fixture that declares them. |
| `__proto__` or other hostile keys in `mcp.json`/`mcp-adapter.json`/marker `keptOverride` key | Tampering | `safeSet`, `Object.hasOwn`, `Object.fromEntries` (WR-01 precedent). |
| Terminal escape sequences in old server names printed in the notice | Tampering / spoofing of output | Escape or strip control characters before rendering. |
| Absolute paths or secret values in notices (collision source path, error messages) | Information disclosure | Scope + file basename labels only; `redactAbsolutePaths` for any error text; values never rendered. |
| Load-time network access (cache miss fetch) | Information disclosure / availability | fs-only probe; BLOCK F; no `materializePluginClone` call. |
| Forged `_piClaudeMarketplace` marker gets a user entry deleted (D-05-04) | Tampering | Accepted: the marker is the MC-5 ownership contract and the file is the user's own; limit deletion to owners with a record in this scope. |
| Lock-free adapter writes (`/mcp-adapter disable`, panel save) racing our write | Tampering (lost update) | Accepted precedent: install has the same window; atomic rename keeps each file whole. |
| Symlinked `mcp.json`/`mcp-adapter.json` redirects our write | Tampering | Accepted (D-02-16), as for every MCP write today. |

## Sources

### Primary (HIGH confidence, read this session)
- Codebase: `extensions/pi-claude-marketplace/index.ts`; `orchestrators/reconcile/{apply,backfill,types}.ts`; `orchestrators/plugin/{reinstall-flow,reinstall-clone-probe,clone-cache,git-source-probe,install-outcome,reinstall-replace,plugin-state-classifier,info}.ts`; `orchestrators/marketplace/shared.ts`; `bridges/mcp/{stage,unstage,marker,adapter-doc,adapter-entry,types,index,collision-slots}.ts`; `domain/{mcp-server-features,mcp-resolution,plugin-resolver,resolver-types,name,clone-key}.ts`; `persistence/{state-io,locations}.ts`; `transaction/with-state-guard.ts`; `shared/{notification-dispatch,atomic-json,compare-name-scope}.ts`; `eslint.config.js`; `.fallowrc.json`; tests `tests/architecture/{mcp-config-notices,compat-01-no-expansion}.test.ts`, `tests/bridges/mcp/unstage.test.ts`; `docs/output-catalog.md`.
- Released writer: `git show main:extensions/pi-claude-marketplace/bridges/mcp/stage.ts`, `marker.ts`.
- Pi 1.0.0: `node_modules/@earendil-works/pi-coding-agent/dist/core/agent-session.js:2582-2590, 2905-2931`; `dist/core/extensions/types.d.ts:1343`.
- pi-mcp-adapter 5.1.0 (`/var/tmp/mcp4-p4-08/adapter/node_modules/pi-mcp-adapter`): `index.ts:65-67, 213, 367-372, 751-772, 1072-1130, 1262-1271, 1294-1401`; `init.ts:112-160`; `config.ts:16-23, 212-305, 679-830, 1141-1240, 1726-1770, 1924-2011`; `project-server-trust.ts:155-215`; `mcp-auth.ts:640-665`; `agent-dir.ts`.

### Secondary
- `.planning/research/{FEATURES,PITFALLS,ARCHITECTURE}.md` (A10, A13, TS-5, Pitfall 3, Patterns 1-3), cross-checked against the adapter source above.
- Prior phase contexts: `02-CONTEXT.md` (D-02-03..23), `03-CONTEXT.md` (D-03-04/05/18), `04-CONTEXT.md` (D-04-10).

### Tertiary
- None. No web source was needed: the migration has no upstream analogue (CONTEXT compat evidence, fetched 2026-10-08).

## Metadata

**Confidence breakdown:**
- Standard stack / seams: HIGH (every reused function read in source).
- Architecture (placement, order, convergence): HIGH for the mechanics; the order argument is derived from the code's trigger model.
- Adapter in-session behavior after the move: MEDIUM (code reading of the deferred path; not executed).
- Pitfalls: HIGH for 2, 3, 4, 7, 8; MEDIUM for 1 (depends on what users actually have in legacy files) and 5.

**Research date:** 2026-10-08
**Valid until:** 2026-11-07 (stable in-repo code; re-check the adapter if the pinned 5.x moves)
