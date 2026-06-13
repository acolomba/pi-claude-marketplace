# Pitfalls Research: v1.12 Marketplace and Plugin Config Files

**Domain:** Adding a declarative desired-state config file (`claude-plugins.json` + `claude-plugins.local.json`) + a load-time full-declarative reconciler + write-back from every mutating command, on top of an existing imperative-command plugin manager with byte-locked notification output, cross-process state locking, atomic-write (NFR-1) / network-policy (NFR-5) / containment (NFR-10) contracts, and a soft-dependency degradation model.
**Researched:** 2026-06-09
**Confidence:** HIGH for system-specific integration pitfalls (anchored to locked v1.12 decisions + shipped contracts in PROJECT.md / STATE.md); MEDIUM for cross-domain prevention patterns (IaC/package/dotfile reconcilers, ecosystem-signal sourced).

---

## Summary

The danger in v1.12 is almost never the happy path (config present, declares what is already installed, no edits). It is the seam where a NEW authoritative, user-editable, version-controlled, full-declarative file meets a system whose every existing guarantee was written for imperative, one-command-at-a-time, machine-owned state. Five properties of THIS system turn ordinary declarative-config mistakes into data-loss or contract-break:

1. **Full-declarative semantics make absence destructive.** An empty/missing/parse-failed merged config logically means "uninstall everything." Migration ordering, parse-failure handling, and an ownership guard are safety-critical, not nice-to-have.
2. **Reconcile runs at load, and load can be triggered by `/reload`, which the system itself emits as a hint.** That is a latent reconcile -> mutate -> reload -> reconcile loop.
3. **Two Pi processes can load at once.** The existing cross-process state lock guards `state.json`, but a NEW user-edited config file plus a NEW internal bookkeeping file widen what must be consistent under that lock.
4. **The notification catalog is byte-locked and UAT-enforced.** Every reconcile message must join the catalog without breaking byte-equality tests, and reconcile is a brand-new emission context (no command invoked it).
5. **Write-back targets a file the user also hand-edits.** Atomic (NFR-1) is necessary but not sufficient: an atomic full-file rewrite still destroys concurrent hand edits, comments, key order, and the `--local` split if the in-memory model was not the merge-aware source of truth.

The pitfalls below are ordered by blast radius. The first four are data-loss / contract-break class (must be designed for, not patched later). The remainder are correctness and UX traps that, left unaddressed, ship as silent drift.

---

## Critical Pitfalls

### Pitfall 1: Empty / missing / unreadable config silently uninstalls everything

**What goes wrong:**
Full-declarative reconciliation treats the merged config as authoritative desired state: installed-but-undeclared marketplaces/plugins get removed. The degenerate inputs all map to "declare nothing":

- First load before migration has written the file (the migration race).
- User deletes the file, or a teammate's branch doesn't have it yet, or a merge left it empty.
- The file exists but fails to parse (truncated, invalid JSON, hand-edit typo) and the reconciler treats parse-failure as "empty desired state."
- The `--local` override file is present but the base file is missing, and the merge collapses to an empty base.

Any of these silently triggers a mass uninstall of working artefacts on a routine Pi startup.

**Why it happens:**
"Desired state = file contents" is the whole point of declarative config, so the empty case looks like a legitimate instruction rather than a missing-input error. The IaC ecosystem learned this the hard way: ArgoCD ships `prune: false` by default and Flux/kubebuilder gate pruning behind an explicit ownership label precisely so that an empty manifest set cannot delete live resources by default.

**How to avoid:**
- **Migration-first ordering, fail-closed:** on first load with no config file, GENERATE the file from `state.json` and reconcile against the generated content — never reconcile against absence. Migration must complete (and atomically land the file) before any prune decision is computed.
- **Distinguish "absent" from "empty-on-purpose" from "unparseable":** a missing file -> migrate-then-reconcile; an unparseable file -> abort reconcile, surface a loud error, change NOTHING (do not interpret a parse error as empty desired state); a genuinely empty-but-valid file -> still gate the prune (see below).
- **Ownership/cache guard on prune:** only uninstall things this extension materialized (already tracked in the internal bookkeeping file). Combined with full-declarative this still removes undeclared-but-owned items — which is correct — but it prevents nuking artefacts the extension never owned.
- **Empty-prune sanity threshold:** if reconcile would prune the entire installed set against a valid-but-empty config, treat that as suspicious and require the empty file to be unambiguous (e.g. an explicit empty `{ "marketplaces": {}, "plugins": {} }` vs a zero-byte file), refusing the mass-prune for the latter.

**Warning signs:**
A clean `/reload` removes plugins that no command touched. Test that seeds installed state, then loads with a 0-byte / missing / `{` file, and asserts NOTHING is uninstalled.

**Phase to address:**
Migration phase (define absent/empty/unparseable trichotomy) AND reconciler phase (ownership + empty-prune guard). These are the two non-negotiable safety gates of the milestone.

---

### Pitfall 2: Migration is a one-way door that can destroy or mislabel pre-existing state

**What goes wrong:**
First-load migration reads `state.json` and writes `claude-plugins.json`. Three failure modes turn the migration into an unrecoverable corruption:

- It overwrites or truncates `state.json` (or the new internal file) before the generated config has atomically landed, so a crash mid-migration leaves neither a usable config nor intact legacy state.
- It writes a config that omits some installed plugins (e.g. plugins in an `unavailable`/soft-degraded state, or non-local sources surfaced as `unavailable`) — the very next reconcile then prunes them as undeclared.
- It bakes machine bookkeeping (resolved versions, materialized artefact records) INTO the user-facing config, so the "state split" is violated from birth and every later hand-edit fights the machine fields.

Because migration runs exactly once and replaces the authority model, a wrong migration is not a transient bug — it is the new ground truth.

**Why it happens:**
Migration is treated as a mechanical dump rather than a lossless, atomic, idempotent transform. The split between "desired state + user settings" (config) and "materialized records + resolved versions" (internal) is subtle, and the easy path is to serialize the whole `state.json` shape into the new file.

**How to avoid:**
- **Atomic, write-new-before-touch-old:** generate config -> atomic write (tmp+rename, NFR-1) -> only then create/repoint the internal bookkeeping file. Never mutate `state.json` until the config exists on disk.
- **Idempotent and re-runnable:** if a config already exists, migration is a no-op (NFR-3). Detect "already migrated" by file presence, not by a flag inside `state.json` that a crash could leave half-set.
- **Lossless coverage audit:** every installed entry in `state.json` MUST appear in the generated config, INCLUDING soft-degraded / `unavailable`-source plugins, or the first reconcile prunes them. Add a test: migrate a populated `state.json`, immediately reconcile, assert zero net change.
- **Respect the state split at generation time:** generated config contains ONLY desired state (source, autoupdate, enabled) and user settings — resolved versions / artefact records go to the internal file.
- **Keep a recovery path:** do not delete `state.json` at migration; the recovery model says `/reload` must suffice (NFR-2), so leaving the legacy file intact lets a botched migration be re-derived.

**Warning signs:**
Post-migration first reconcile shows ANY prune or install. Plugins present before upgrade are `unavailable` or gone after. The config file contains `hash-<…>` resolved versions or artefact paths (state-split leak).

**Phase to address:**
Migration phase — with an explicit "migrate-then-reconcile = no-op" integration test as the phase exit gate.

---

### Pitfall 3: Atomic write-back still clobbers concurrent hand edits, comments, key order, and the local/base split

**What goes wrong:**
Every mutating command now writes back to the config. The naive implementation: load config at command start, mutate the in-memory object, serialize the whole thing, atomic-write. That is atomic (NFR-1 satisfied) and still wrong:

- A user hand-edit made AFTER the command read the file is silently lost (last-writer-wins full-file rewrite).
- JSON5/JSONC comments and the user's key ordering / whitespace are destroyed on round-trip, even though the WRITE itself was atomic — atomicity protects against torn writes, not against semantic clobber.
- Write-back aimed at the BASE file accidentally serializes the MERGED (base+local) view, promoting local-only overrides into the base, or vice-versa.
- A field the user added that the current schema doesn't model gets dropped on rewrite (forward-compat loss).

**Why it happens:**
"Atomic write" is conflated with "safe write." NFR-1 is about crash-consistency; it says nothing about preserving content the writer didn't author. And the merge layer makes "which file do I write" genuinely ambiguous — the in-memory model is the merged view, but write-back must target one physical file.

**How to avoid:**
- **Write-back is a targeted patch, not a wholesale rewrite:** read the specific target file (base, or `--local` -> local) at write time, apply the minimal entry-level change, re-serialize THAT file only. Never serialize the merged view back to disk.
- **Re-read under the lock immediately before write** (read-modify-write inside the state lock) so a hand-edit between command-start and command-commit is not lost — or detect divergence (mtime/size or content hash captured at read) and abort with a loud, recoverable error rather than overwrite.
- **Decide the comment/format contract explicitly and early:** if the file is plain JSON, document that comments are not preserved and the file is canonicalized on every write-back (and make canonical form deterministic so VCS diffs are minimal); if comment preservation is required, you need a round-trip-preserving parser, which is a much bigger commitment — choose before the first write-back lands, not after.
- **Preserve unknown keys:** on write-back, retain fields the current schema doesn't recognize (forward-compat), rather than dropping them.
- **`--local` strictly targets the local file; absence strictly targets base.** Test both: a `--local` write must never appear in the base file and must never read-promote base entries into local.

**Warning signs:**
A user reports their comments / key order vanished after running a command. A `--local` install shows up in the base file's VCS diff. Two quick commands in two terminals and the second silently reverts the first's edit.

**Phase to address:**
Write-back phase — establish the targeted-patch + re-read-under-lock + format-contract decision before wiring any single command to write.

---

### Pitfall 4: Reconcile -> mutate -> `/reload` -> reconcile reentrancy / load loop

**What goes wrong:**
Reconciliation runs at extension load. The system ALREADY emits "`/reload` to pick up changes" hints after mutations. If reconcile performs installs/uninstalls that themselves enqueue a reload hint, or if any code path responds to a config change by triggering a reload, you get an infinite or oscillating loop: load -> reconcile mutates -> reload triggered -> load -> reconcile sees the just-applied change as new -> mutates again.

A subtler variant: reconcile's write-back (e.g. it resolves a version and records it) re-touches the config or the internal file in a way that the NEXT load interprets as drift, so every startup performs a small no-op-that-isn't.

**Why it happens:**
The reload hint was designed for interactive commands where a human reads it and decides to reload. Reconcile is non-interactive and runs AT load, so emitting the same hint (or any reload trigger) closes the loop. And the reconciler naturally wants to write back resolved versions, which re-dirties state on every pass.

**How to avoid:**
- **Reconcile must converge to a fixed point and prove it:** after a reconcile pass applies changes, a second immediate reconcile against the same config MUST be a no-op. Add a "reconcile twice, second pass is empty" invariant test.
- **Reconcile NEVER emits a reload hint and NEVER triggers a reload.** The reload hint is a command-surface concept; reconcile is already running at load. Route reconcile output through a distinct path that cannot enqueue reload.
- **Reconcile writes back ONLY to the internal bookkeeping file, never to the user config**, except the one-time migration generation. Resolved versions / artefact records are internal — writing them back to the user config is what re-dirties it each pass.
- **Reentrancy guard:** an in-process flag (or the existing state lock) ensures a reconcile cannot start while one is running, so a reload fired mid-reconcile cannot stack.

**Warning signs:**
Startup is slow and CPU-bound; the same install/uninstall appears in logs every load; `/reload` never settles. Diff the config/internal file before and after a no-change `/reload` — any byte change is a convergence bug.

**Phase to address:**
Reconciler phase — convergence (fixed-point) test and the "reconcile emits no reload hint" rule are exit gates.

---

### Pitfall 5: Two Pi processes reconcile concurrently and corrupt or double-apply

**What goes wrong:**
The existing cross-process state lock guards `state.json` transactions. Reconcile is a new, long, multi-step mutation (clone, install, uninstall, write internal file) that now ALSO must be serialized — and it touches a new internal file plus reads the user config. If two Pi instances start at once (common: two terminals, or an IDE + a shell), both read the same desired state and both try to install/uninstall, racing on the same scope root and the same internal file. Worst case: one prunes what the other is mid-installing; the internal bookkeeping file gets interleaved writes; the lock that protected `state.json` doesn't cover the new file.

**Why it happens:**
The lock was scoped to the V1 transaction unit (`withLockedStateTransaction` around `state.json`). The new reconcile + new internal file are outside that original scope unless explicitly brought in. Load-time concurrency is easy to forget because commands are usually invoked one at a time by a human; reconcile fires automatically on every process start.

**How to avoid:**
- **Bring the entire reconcile pass under the existing cross-process lock**, and extend the lock's covered fileset to include the new internal bookkeeping file (and config reads that inform mutation). One reconcile holds the lock for its full duration.
- **Lock-wait, don't skip-or-double:** if a second process finds the lock held, it should wait (or cleanly defer reconcile, knowing the holder will bring reality to desired state) rather than proceed unlocked. After waiting, re-read desired state and reconcile against the now-current reality — which should be a no-op if the first process finished.
- **Idempotent, retry-safe steps (NFR-3):** every reconcile step must be safe to re-run, so a process that waited and then re-reconciles against already-applied state does nothing.
- **No process restart required to recover (NFR-2):** a lock left stale by a crashed process must be recoverable via `/reload`, consistent with the existing recovery model — verify the new lock scope honors the same stale-lock policy.

**Warning signs:**
Intermittent install/uninstall churn only when two Pi instances start near-simultaneously; the internal file is occasionally malformed; a plugin flickers installed/uninstalled across two terminals.

**Phase to address:**
Reconciler phase — concurrency model and lock-scope extension, with a two-process reconcile integration test.

---

### Pitfall 6: Partial reconcile failure reported as total success (or total failure)

**What goes wrong:**
Reconcile is a batch of independent operations (add marketplace A, install plugin B, uninstall C, …). With NFR-5 soft-fail (network attempts must never block load), some operations WILL fail at load (offline, private-repo auth absent, source `unavailable`). The traps:

- Reconcile reports "synced" while silently leaving B uninstalled because its GitHub clone soft-failed — the user believes desired state is achieved when it isn't.
- One failure aborts the whole pass, so a single offline marketplace blocks installing the other five declared plugins (violates "never block load").
- The failure of B is attributed to the wrong cause (`{network unreachable}` when it was actually `{invalid manifest}`, or vice-versa) — v1.10 already litigated truthful attribution; reconcile must inherit it, not reinvent a lossy version.

**Why it happens:**
Batch reconcilers default to all-or-nothing or to a single aggregate status. Soft-fail + partial-application is exactly the regime where a per-item truthful ledger is required, and it's tempting to collapse it to one line at load to avoid noise.

**How to avoid:**
- **Continue-on-failure with a per-item outcome ledger:** each declared/undeclared item gets its own status; one failure never aborts the others (mirrors the existing D-03 continue-on-failure and per-row cascade model).
- **Surface partial results truthfully and at the right severity:** desired-but-unachieved (e.g. soft-failed network install) must be visible — a benign no-op is `info`, but an item that the config DECLARES and reconcile could not achieve is a real warning the user must see, not a suppressed benign skip.
- **Reuse v1.10/v1.11 attribution and summary-line grammar:** truthful reasons (`{network unreachable}` only when actually network, `{invalid manifest}` for path-source manifest failures, NFR-5), and a non-empty summary first line on any error/warning cascade.
- **Idempotent retry:** a soft-failed install should be re-attempted on the next load (when network returns) and converge — not be marked permanently failed.

**Warning signs:**
"Reconcile complete" with a plugin the config declares still missing. One offline marketplace prevents all installs. A network-less reconcile reports `{network unreachable}` for a path-source manifest typo.

**Phase to address:**
Reconciler phase (per-item ledger + continue-on-failure) and Notification phase (severity + attribution reuse).

---

### Pitfall 7: Reconcile output breaks the byte-locked notification catalog

**What goes wrong:**
The notification catalog is byte-locked and enforced by a byte-equality UAT runner (`tests/architecture/catalog-uat.test.ts`). Reconcile is a brand-new emission context — no command invoked it, it runs at load — and it must produce user-visible output for installs/uninstalls/failures. Naive paths:

- Reconcile emits ad-hoc strings (`console.log`, direct `process.stdout`), violating IL-2 (all output via the typed notify seam) and bypassing the catalog entirely.
- Reconcile reuses command-row renderers but in a context that changes a byte (e.g. a leading reload-hint trailer that the catalog forms don't include for load-time), failing byte-equality.
- New status/reason members are introduced for reconcile (e.g. a `(reconciled)` token) without amending the closed sets and the catalog in lockstep, so the drift-guard / set-equality tests fail.

**Why it happens:**
Reconcile feels like infrastructure, not a "command," so the discipline that governs command output (closed-set tokens, typed `NotificationMessage`, catalog byte forms) is easy to skip. But the same UAT runner asserts byte-equality across ALL surfaces.

**How to avoid:**
- **Route 100% of reconcile output through the existing typed `notify`/`emitWithSummary` seam** (IL-2). No direct stdio. The single sanctioned `console.warn` (IL-3, legacy migration save-failure) is the ONLY exception and reconcile must not add a second.
- **Model reconcile outcomes as existing `NotificationMessage` variants** wherever the semantics match install/uninstall/skip/fail rows, so they render byte-identically to the command path; only introduce a new variant if the semantics genuinely differ, and then amend the closed sets + catalog + byte-UAT in the SAME atomic commit (the established lockstep discipline).
- **Decide the reload-hint rule for reconcile up front:** reconcile runs AT load, so a "`/reload` to pick up changes" trailer is nonsensical — reconcile rows must NOT carry it (consistent with the v1.4.1 reload-hint-discipline rule that hints are plugin-transition-driven, and reconcile already IS the load).
- **Add reconcile forms to the catalog and the byte-UAT** as part of the notification phase, not as an afterthought.

**Warning signs:**
`catalog-uat` goes red on a reconcile change. Reconcile output appears via a code path other than `notify`. A new token shows up in renders but not in the closed-set frontmatter.

**Phase to address:**
Notification phase — catalog amendment + byte-UAT coverage for reconcile, with the closed-set lockstep enforced.

---

### Pitfall 8: enable/disable confused with uninstall, and with the soft-dependency degradation model

**What goes wrong:**
`disable` keeps the config entry + version pin but removes materialized artefacts; `enable` re-materializes from cache with no network. Two confusions corrupt this:

- **Disable treated as uninstall:** the config entry or version pin is dropped, so re-enable can't reconstruct from cache and silently needs the network (violating "re-enable from cache, no network") or loses the pinned version.
- **Disabled vs soft-degraded `unavailable` conflated:** the existing model surfaces missing-companion-extension plugins as soft-degraded `unavailable`. A `disabled` plugin (deliberate) and an `unavailable` plugin (degraded because a companion extension is absent) are different states with different list/info presentation and different reconcile behavior. If reconcile or the renderer treats `disabled` as `unavailable` (or vice-versa), the user can't tell "I turned this off" from "this broke," and reconcile may try to re-materialize a deliberately-disabled plugin or fail to flag a genuinely-degraded one.
- **Reconcile re-enables disabled entries:** because the entry is still declared, a reconciler that keys only on "declared -> must be installed" will re-materialize artefacts the user explicitly disabled. The `enabled: false` bit must be part of desired state, so reconcile's desired-materialized set EXCLUDES disabled entries while KEEPING their entry + pin.

**Why it happens:**
Disable is a third state between installed and uninstalled, and the existing system only had two (present / absent) plus the orthogonal soft-degraded marker. Adding a deliberate-off state that still occupies the config and cache, distinct from degraded-off, is easy to under-model.

**How to avoid:**
- **Model three orthogonal facts:** declared (in config), enabled (desired-materialized), and available (companion extensions present / source resolvable). `disabled` = declared + not-enabled + entry/pin/cache retained. `unavailable` = declared + enabled-intent + not-available (soft-degraded). They never collapse into one flag.
- **Reconcile's desired-materialized set = declared AND enabled.** Disabled entries are retained in config and cache but NOT materialized; reconcile must not re-install them and must not prune their entry/pin/cache.
- **enable = re-materialize from cache, asserting no network is touched** (NFR-5). Test it offline.
- **Distinct list/info presentation** for `disabled` vs `unavailable`, so the user reads intent vs breakage. Reuse the typed message model; add tokens/markers in catalog lockstep if needed.

**Warning signs:**
Re-enable hits the network or loses the version pin. A `disabled` plugin renders identically to a soft-degraded one. Reconcile re-materializes something the user just disabled.

**Phase to address:**
enable/disable phase — three-state model + offline re-enable test + distinct presentation; cross-checked in the reconciler phase (desired-materialized = declared AND enabled).

---

### Pitfall 9: Scope / local-override precedence confusion

**What goes wrong:**
Two scopes (user `~/.pi/agent/`, project `<cwd>/.pi/`), each with a base + `.local` override merged at entry level. Precedence bugs:

- Merge granularity wrong: the override replaces the WHOLE marketplaces/plugins map instead of overriding per-ENTRY, so adding one local override wipes all base entries for that section.
- Cross-scope leakage: a project-scope reconcile reads/writes user-scope files, or write-back picks the wrong scope's file.
- Local override committed by accident: `.local` is meant to be machine-private (un-versioned) but write-back puts shared changes there, or the base file gets machine-private overrides — inverting the intended VCS story.
- Reconcile applies the MERGED view but then can't attribute which file an undeclared-prune came from, confusing the user about where to add the entry to keep it.

**Why it happens:**
Entry-level override + two scopes + base/local = four files and a non-trivial merge. "Which file wins, and which file do I write" is genuinely ambiguous and easy to get subtly wrong, especially for write-back target selection.

**How to avoid:**
- **Specify the merge precisely as entry-level:** `merged[entryKey] = local[entryKey] ?? base[entryKey]`, union of keys, per scope. Never whole-section replace. Unit-test the merge with overlapping/disjoint entries.
- **Scope isolation:** project reconcile touches only project files; user reconcile only user files. The default both-scopes behavior runs two independent reconciles, not one cross-scope merge (consistent with the existing per-scope fan-out + D-26 both-scope-default pattern).
- **Write-back target is explicit:** base by default, local with `--local`; never read the merged view back to either. Document and test that `--local` writes never appear in base.
- **Document the VCS intent** (base = shared/committed, `.local` = machine-private) and make tab-completion / errors reinforce it; consider surfacing in `info`/`list` which file an entry came from so undeclared-prune is attributable.

**Warning signs:**
Adding one local override loses base entries. A project command edits a user file. `.local` shows up in the shared diff. User can't tell which file declares a plugin.

**Phase to address:**
Config-model phase (merge semantics) and Write-back phase (target selection); verified by a four-file merge matrix test.

---

### Pitfall 10: Schema evolution of a now-committed, hand-edited file

**What goes wrong:**
Once `claude-plugins.json` is version-controlled and hand-edited, its shape is a public contract. Future milestones will want new fields. The traps:

- No `version`/schema marker in the file, so a newer extension can't tell an old file from a corrupt one, and an OLDER extension reading a NEWER file mis-handles unknown fields (drops them on write-back, or errors).
- Strict schema validation REJECTS forward-compat fields, so a file written by a newer Pi breaks an older Pi instead of degrading gracefully.
- Migrations rewrite the file aggressively on load, fighting the user's VCS (every `/reload` produces a churny diff).

**Why it happens:**
The file starts life as machine-generated (migration) so its committed-contract nature is underappreciated until a teammate hand-edits it and a second teammate's older extension chokes.

**How to avoid:**
- **Embed a schema/version field from day one** so readers can branch on it.
- **Validate leniently, preserve unknown keys** (parse what you know, retain the rest on write-back) — the existing project already commits to a forward-compatible parser posture (NFR-12); extend it to this file.
- **Make on-load rewrites minimal and deterministic:** never reformat or reorder on a no-op load; only write when a command actually changes an entry, and write canonical minimal diffs.
- **Choose JSON (canonicalizable) vs JSONC (comments) deliberately** and stick with it; changing later is itself a migration.

**Warning signs:**
An older Pi errors on a file a newer Pi wrote. `/reload` produces VCS churn with no command run. Unknown fields disappear after a command.

**Phase to address:**
Config-model phase — schema versioning + lenient validation + unknown-key preservation as design invariants.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Write-back serializes the merged in-memory view to the base file | Trivial to implement; one code path | Promotes local overrides into base, drops unknown keys, clobbers hand edits/comments | Never — write-back must be a targeted patch of the specific target file |
| Reconcile reuses the command-path reload-hint trailer | No new rendering code | Closes the reconcile->reload loop and/or fails byte-UAT | Never |
| Treat unparseable config as empty desired state | Fewer branches | Mass-uninstall on a single typo | Never — parse failure must abort reconcile, change nothing |
| Skip the cross-process lock for reconcile (load is "just startup") | Faster startup, less plumbing | Two-process double-apply / file corruption | Never — load-time concurrency is real |
| Plain JSON, document "comments not preserved" | No round-trip parser dependency | Users who add comments lose them; some friction | Acceptable IF documented up front and the file stays small/canonical |
| Defer schema `version` field to "when we need it" | One less field now | First forward-compat change becomes a breaking, undetectable migration | Only if a version field is added before the FIRST committed real-world file ships |
| Reconcile aborts whole pass on first failure | Simple error path | One offline marketplace blocks all other installs (violates NFR-5 never-block-load) | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GitHub clone at load (new NFR-5 exception) | Treating the load-time clone like a command-time clone that can fail loudly and block | Soft-fail per item, never block load, retry next load; truthful `{network unreachable}` only for actual network failures |
| Existing cross-process state lock | Lock still scoped to `state.json` only; new internal file + reconcile pass left outside | Extend lock scope to cover the internal bookkeeping file and the full reconcile pass; honor existing stale-lock recovery (NFR-2) |
| Byte-locked notification catalog | Reconcile emits ad-hoc strings or reuses command forms that differ by a byte | All output via typed `notify`/`emitWithSummary` (IL-2); model as existing variants; amend closed sets + catalog + byte-UAT in lockstep |
| Soft-dependency degradation model | Conflating deliberate `disabled` with degraded `unavailable` | Three orthogonal facts: declared / enabled / available — never collapse `disabled` into `unavailable` |
| Containment (NFR-10) | New config + internal file write target at scope root not added to `assertPathInside` allow-set | Add the new write targets to the containment allow-set; refuse writes outside `<scopeRoot>` |
| bootstrap / import composition | They now write the config too, but reuse a write-back that assumes a single command's single edit | Make write-back composable: batch import/bootstrap edits as one targeted multi-entry patch under the lock, not N full-file rewrites |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Reconcile re-resolves/re-clones every declared item on every load even when nothing changed | Slow `/reload`, repeated network attempts | Diff desired vs internal-recorded reality first; only act on drift; cache resolved versions in the internal file | Any setup with >a few GitHub-source marketplaces |
| Full-file rewrite of config on every command | Growing VCS churn, write amplification | Targeted entry patch; write only on actual change | Large configs / frequent commands |
| Reconcile not converging (Pitfall 4) re-applies each load | CPU-bound startup, repeated identical ops | Fixed-point invariant test; reconcile writes only to internal file | Immediately, every load |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Reconcile installs whatever the config declares, including from a malicious committed `claude-plugins.json` pulled via git | Supply-chain: a teammate's branch silently installs/auto-updates marketplaces on your next load | Keep autoupdate opt-in per entry; reuse existing GitHub source validation; never broaden source kinds via config beyond what commands allow |
| `.local` machine-private file written with shared content | Leaks machine-specific paths/overrides into shared VCS, or vice-versa | Strict base/local write-back target rules; document VCS intent |
| New write targets escape containment | Writing outside `<scopeRoot>` via a crafted/relative config path | Run every config/internal write through the existing `assertPathInside` (NFR-10) |
| Private-marketplace auth attempted non-interactively at load | Hanging or unexpected auth prompts on startup | Load-time clones soft-fail without interactive auth; defer auth to explicit command (reuse v1.6 device-flow only on command) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Reconcile silently uninstalls undeclared items with no visible report | User loses plugins and doesn't know why | Per-item reconcile report at load (visible, truthful severity); declared-but-unachieved shown as warning |
| `disabled` and soft-degraded `unavailable` render identically | User can't tell "I turned it off" from "it broke" | Distinct tokens/markers on list/info |
| Hand-edit lost or reformatted after a command | User distrusts the file / stops hand-editing | Targeted patch, re-read under lock, documented format contract |
| No way to see which scope/file an entry came from | User edits the wrong file, change has no effect | Surface source file/scope in `info`/`list` |
| `/reload` produces a churny diff with no command run | Noise in VCS, user thinks something changed | Deterministic, minimal, write-only-on-change |

## "Looks Done But Isn't" Checklist

- [ ] **Reconciler:** Often missing the empty/missing/unparseable trichotomy — verify a 0-byte, a missing, and a `{`-truncated file each leave installed state untouched.
- [ ] **Migration:** Often missing soft-degraded/`unavailable` plugins in the generated config — verify migrate-then-reconcile is a strict no-op on a populated `state.json`.
- [ ] **Write-back:** Often missing re-read-under-lock — verify two near-simultaneous commands don't lose the first's edit; verify `--local` never touches base.
- [ ] **Reconcile convergence:** Often missing the fixed-point property — verify a second immediate reconcile is empty and the config/internal file is byte-unchanged after a no-op `/reload`.
- [ ] **Concurrency:** Often missing reconcile-under-lock — verify two Pi processes starting together don't double-apply or corrupt the internal file.
- [ ] **Notification:** Often missing catalog/byte-UAT coverage for reconcile forms — verify `catalog-uat` is green AND covers reconcile output, all via the typed seam (no direct stdio).
- [ ] **enable/disable:** Often missing offline re-enable — verify enable re-materializes from cache with the network unplugged and preserves the version pin; verify reconcile does NOT re-materialize disabled entries.
- [ ] **Containment:** Often missing the new write targets in the allow-set — verify a write aimed outside `<scopeRoot>` is refused (NFR-10).
- [ ] **Schema:** Often missing the version field / unknown-key preservation — verify an older reader degrades and unknown keys survive write-back.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Empty-config mass uninstall (Pitfall 1) | HIGH | Restore config from VCS, `/reload` to re-materialize from cache (no network if cache intact); if cache gone, re-install. The legacy `state.json` left intact (Pitfall 2) is the fallback source. |
| Bad migration (Pitfall 2) | HIGH | Delete the generated config, restore from `state.json` (kept intact), re-run migration after fix; `/reload` (NFR-2, no restart). |
| Clobbered hand edit (Pitfall 3) | MEDIUM | Restore the file from VCS; the targeted-patch design limits loss to one command's window. |
| Load loop (Pitfall 4) | LOW–MEDIUM | Stop the loop by fixing convergence; meanwhile the config is intact, so a corrected build settles on next `/reload`. |
| Two-process corruption (Pitfall 5) | MEDIUM | Single-process `/reload` re-derives consistent state from config; repair/rewrite the internal file from config + cache. |
| Catalog byte break (Pitfall 7) | LOW | `catalog-uat` fails in CI before ship; fix forms + amend catalog in lockstep. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Empty-config mass uninstall | Migration + Reconciler | Missing/empty/unparseable inputs leave installed state untouched |
| 2 Migration one-way door | Migration | Migrate-then-reconcile is a no-op; `state.json` left intact; no state-split leak |
| 3 Write-back clobber | Write-back | Targeted patch; re-read under lock; `--local` never touches base; format contract documented |
| 4 Reconcile reentrancy / loop | Reconciler | Second immediate reconcile empty; no reload hint from reconcile; config byte-unchanged after no-op load |
| 5 Concurrent reconcile | Reconciler | Two-process start does not double-apply/corrupt; lock scope covers internal file |
| 6 Partial-failure reporting | Reconciler + Notification | Continue-on-failure; per-item truthful ledger; correct severity + attribution |
| 7 Catalog byte break | Notification | `catalog-uat` green incl. reconcile forms; all via typed seam (IL-2) |
| 8 enable/disable confusion | enable/disable | Three-state model; offline re-enable; reconcile excludes disabled from materialized set |
| 9 Scope/local precedence | Config-model + Write-back | Entry-level merge matrix; scope isolation; explicit write target |
| 10 Schema evolution | Config-model | Version field; lenient validation; unknown-key preservation; no no-op rewrites |

## Sources

- **Locked v1.12 decisions + shipped contracts** (HIGH): `.planning/PROJECT.md` (milestone scope, NFR-1/2/3/5/8/10/12, IL-2/3, v1.4.1 reload-hint discipline, v1.9 manifest cache, v1.10 truthful attribution, v1.11 summary-line grammar, D-03 continue-on-failure, D-26 both-scope default), `.planning/STATE.md` (v1.12 planning state), CLAUDE.md project constraints.
- **Existing system mechanisms** (HIGH): cross-process state lock / `withLockedStateTransaction`, atomic write (tmp+rename / `write-file-atomic`), `assertPathInside` containment, typed `notify`/`emitWithSummary` seam + `catalog-uat` byte-equality runner, soft-dependency degradation model — all per PROJECT.md.
- **IaC / declarative-reconciler prune safety** (MEDIUM, ecosystem signal): ArgoCD ships `prune: false` by default; Flux/kubebuilder gate pruning behind explicit ownership labels — confirming the "ownership guard + opt-in destructive prune" prevention class. [ArgoCD IaC](https://oneuptime.com/blog/post/2026-02-26-infrastructure-as-code-argocd/view), [kubebuilder declarative reconciler prune options](https://github.com/kubernetes-sigs/kubebuilder-declarative-pattern/blob/master/reconciler-options.md), [Flux prune behavior](https://github.com/fluxcd/flux2/issues/997).
- **Config-file-as-UI / round-trip clobber** (MEDIUM, ecosystem signal): configuration files are user interfaces; tools that rewrite hand-edited files lose comments/formatting on round-trip. [Configuration files are user interfaces (HN)](https://news.ycombinator.com/item?id=45291858), [Web IDE clobbers edited file](https://forum.gitlab.com/t/web-ide-clobbers-edited-file/45542).

---
*Pitfalls research for: declarative config + load-time reconciler + write-back on an existing imperative plugin manager (v1.12)*
*Researched: 2026-06-09*
