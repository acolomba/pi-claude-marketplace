# Feature Research

**Domain:** Declarative, version-controllable config files for a plugin/marketplace package manager (Pi extension wrapping Claude plugins)
**Researched:** 2026-06-09
**Confidence:** HIGH (behaviors grounded in official docs + real issue trackers for brew bundle, home-manager, asdf, pre-commit, VS Code extensions.json, devcontainer lockfile, Claude Code settings.json)

## Orientation: two opposing models in the comparable ecosystem

Every comparable tool sits on a spectrum between two poles. Naming them up front frames every feature decision below, because v1.12's locked milestone decisions place it firmly at the **authoritative** pole.

| Pole | Tools | Config means | On checkout / load | Removal semantics |
|------|-------|-------------|--------------------|-------------------|
| **Authoritative desired-state** ("the file is the truth") | nix home-manager, `brew bundle`, asdf `.tool-versions`, devcontainer features | The set of things that MUST exist; reconcile reality to it | Materialize declared things; remove undeclared ones (home-manager always; brew only on explicit `cleanup`) | Declared-but-removed → uninstalled |
| **Recommend-only** ("the file is a suggestion") | VS Code `extensions.json` recommendations, Claude Code `extraKnownMarketplaces`/`enabledPlugins` (as actually shipped) | A suggestion list; user opts in | Prompt the user; never auto-install; never remove | Nothing removed automatically |

**v1.12 is explicitly at the authoritative pole** (locked decision: "Config = authoritative desired state; full-declarative reconciliation at load; installed-but-undeclared ones are removed/uninstalled"). The single most important lesson from the research is that **the authoritative pole is the dangerous one** — every authoritative tool studied has a real, filed incident where reconciliation removed something the user did not intend to lose (brew bundle Homebrew/brew#22450 wiping MAS apps; home-manager silently dropping packages on declaration removal; devcontainer lockfile leaking user-level defaults microsoft/vscode-remote-release#11616). The features that matter most are therefore the **safety rails around destructive reconciliation**, not the reconciliation itself.

## Feature Landscape

### Table Stakes (Users Expect These)

Features a version-controlled declarative config file is broken without. Absence is a penalty, not a credit.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Checkout → declared state materializes on next load** | The entire point of committing the file. Every authoritative tool (home-manager `switch`, `brew bundle`, asdf) does this. | MEDIUM | Already the locked core of v1.12. Reuses existing `install`/`marketplace add` orchestrators. Network attempts soft-fail (NFR-5 + locked decision) — load is never blocked. |
| **Reconciliation report: what was added / removed / skipped / failed** | Authoritative reconcile is a black box without it. `brew bundle` prints per-item; home-manager shows the generation diff. Users will not trust silent destructive sync. | MEDIUM | Maps directly onto the existing v1.4/v1.5/v1.11 structured-notification cascade. The byte-locked catalog must gain reconcile-summary rows. This is the trust surface — under-investing here is the top risk. |
| **Version pinning per plugin** | Reproducibility is the reason to commit a lockfile-like artifact (devcontainer-lock, asdf pins exact, pre-commit pins immutable `rev`). A teammate must get the same plugin version. | LOW–MEDIUM | v1.12 keeps resolved versions in the **internal** file, not the committed config (locked: "machine bookkeeping stays internal"). This is a defensible split (see Anti-Features) but means the *committed* file pins desired-state, the internal file records what actually resolved. Document which file is the reproducibility anchor. |
| **enable/disable without uninstall** | Claude Code's `enabledPlugins: {"x@mp": false}` keeps the entry but turns it off; users expect a reversible toggle that survives in the committed file. | MEDIUM | Locked v1.12 shape (autoupdate/noautoupdate twin). Disabled = entry + pin kept, artefacts not materialized; enable re-materializes from cache, **no network**. The cache-reuse-on-enable requirement is the constraint that makes this non-trivial — depends on the v1.9 manifest cache + recorded versions. |
| **gitignored local override file** | Universal convention: `.local`/`.local.json` (Claude Code `settings.local.json`, VS Code, every framework) is per-machine, gitignored, and overrides the committed base. Users expect committing the base does not leak personal toggles. | LOW–MEDIUM | Locked: `claude-plugins.local.json` gitignored, entry-level override. Mirror Claude Code's exact precedence (local overrides base per-entry). The extension should help the user gitignore it (or document it loudly) — see the devcontainer leak pitfall. |
| **First-run migration generates the file from existing state, destroys nothing** | An existing install must not be wiped the first time the feature ships. home-manager and asdf both let you `import`/generate from current reality. | MEDIUM | Locked: first load without config generates from `state.json`, uninstalls nothing. This is the single most important *safety* table-stake — a migration that reconciles-then-removes on first run would be catastrophic. Migration must be generate-only, never destructive. |
| **Write-back from mutating commands** | If `install` does not update the committed file, the file drifts and the next reconcile "removes" the just-installed plugin. Drift between imperative commands and the declarative file is the classic failure (pre-commit/pre-commit#2366 autoupdate drift). | MEDIUM | Locked: every mutating command writes back to base; `--local` targets local. The hard part is keeping write-back and reconcile semantically identical so a command + reload is a no-op, not a churn. |
| **Idempotent re-load (no-op when reality matches config)** | Re-opening a workspace must not churn. VS Code only prompts for *missing* recommendations; brew bundle is a no-op when satisfied. | MEDIUM | Reconcile must compute an empty diff when state matches and emit a benign/quiet result (v1.5 UXG-02 benign-softening already established this grammar — suppress from `Warning:`). |

### Differentiators (Competitive Advantage)

Features that set v1.12 apart from the tools studied. Align with the Core Value (atomic, recoverable, soft-degrading, never blocks load).

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Reconcile that never blocks startup (network soft-fail)** | home-manager `switch` and `brew bundle` are blocking foreground commands that fail loudly on network errors. v1.12 reconciles at *extension load inside an interactive Pi session* and must degrade, never abort. This is genuinely differentiated. | MEDIUM | Already an NFR-5 + locked constraint. The differentiator is the discipline: a declared GitHub marketplace that's unreachable leaves the entry intact and reports soft-fail, rather than treating "couldn't fetch" as "should remove." |
| **Atomic reconciliation with rollback** | Reuses v1.7 transaction-resilience saga. home-manager gets atomicity via Nix generations; brew bundle is *not* atomic (partial cleanup leaves you stranded). v1.12 can offer all-or-nothing reconcile that brew bundle cannot. | MEDIUM–HIGH | Leverage existing `withLockedStateTransaction` / reverse-walk rollback. The reconcile is a multi-item saga; partial failure should roll back or fail-clean (NFR-3), not leave half-reconciled. |
| **State split: committed desired-state vs internal machine bookkeeping** | Keeps the committed file human-readable and merge-friendly (no churning resolved-version noise, no per-machine artefact records). devcontainer *failed* at this — the lockfile leaked user-level defaults into the committed artifact (vscode-remote-release#11616). | MEDIUM | Locked decision; this is a correctness differentiator *if* the boundary is clean. The committed file holds only what a human would author (source, autoupdate, enabled, optional pin); resolved versions + materialized-artefact records stay under `pi-claude-marketplace/`. |
| **Enable-from-cache with zero network** | Disabling then re-enabling a plugin offline is something neither Claude Code nor brew offer cleanly. Pairs with the v1.9 manifest cache. | MEDIUM | Requires the disable path to retain enough cached manifest + recorded version to re-materialize. Depends on cache survival across `/reload` (v1.9 cache is process-scoped, cold after reload — re-enable must reconstruct from the *persisted* internal file, not the in-memory cache). Flag this dependency. |
| **Dry-run / preview of reconcile before it mutates** | `brew bundle --dry-run` and devcontainer `--frozen-lockfile` exist precisely because authoritative reconcile is scary. A preview of "load will remove X, install Y" before committing to it builds trust. | MEDIUM | NOT in the locked decisions. Strong candidate for the differentiator slot because reconcile runs *automatically* at load (unlike brew's explicit invocation) — users have less control, so a way to see/predict the diff matters more, not less. See MVP discussion. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Aggressive auto-cleanup of *everything* not declared, with no scoping** | "The file is authoritative, so remove anything not in it." | This is exactly Homebrew/brew#22450: `brew bundle cleanup` started uninstalling every Mac App Store app the user never installed via brew, because it couldn't tell "managed by me" from "managed by something else." Reconcile must only remove things **this extension** materialized and recorded as managed — never artefacts of unknown provenance. | Scope removal to records the internal bookkeeping file owns (provenance-tracked). Anything not in our managed-records set is left alone, even if undeclared. |
| **Network sync as part of every reconcile** | "Always get the latest, like `latest` features." | Blocks/slows load, violates NFR-5, and makes load non-deterministic. devcontainer warns: installing "latest" gives different outcomes per build. pre-commit *refuses* unpinned-latest on purpose. | Reconcile is offline by default (locked); network only on explicit `update`/`marketplace update` or autoupdate-flagged GitHub sources. Reconcile materializes from cache/recorded versions. |
| **Putting resolved versions / artefact records in the committed file** | "One file to rule them all." | Creates merge conflicts on every machine (devcontainer lockfile leak; resolved hashes churn). Makes the committed file un-reviewable. | The locked state-split: committed file = authored desired-state; internal file = resolved versions + materialized records. (This is why v1.12 explicitly avoids a single combined file.) |
| **Silent destructive reconcile (remove without reporting)** | "Just make it match, quietly." | Users will not trust a tool that silently uninstalls on load. The whole VS Code design philosophy is "never auto-change the user's setup without a prompt." v1.12 *does* auto-reconcile, so the compensating control is loud, truthful reporting (v1.11 summary-line grammar) — never silence. | Every removal is reported in the reconcile cascade with a truthful reason; benign no-ops stay quiet (v1.5), real removals are surfaced. |
| **Mutable refs / branch pins as the version anchor** | "Pin to `main` so it tracks." | pre-commit explicitly forbids this (`rev` must be immutable; branch pins silently never update and break caching). | Pin to immutable identifiers (existing PI-7 `hash-<12hex>` / resolved version). Reuse exact-equality comparison, never semver-range resolution (already a locked STACK decision: no `semver` for hash versions). |
| **Auto-prompting the user interactively at load to confirm each change** | VS Code's model — "ask before installing." | v1.12's locked decision is *automatic* reconcile (Pi load is not a good place for blocking modal prompts, and Claude Code's prompt-based model is the one that famously *fails to fire* — anthropics/claude-code#32606, where extraKnownMarketplaces "never prompts"). Prompting at load fights the declarative model. | Auto-reconcile + loud report (chosen). Offer an *optional* dry-run/preview command for users who want to look before a reload, rather than a blocking prompt. |
| **Local file that can *add* declarations the base must honor on other machines** | "Let me add a plugin locally and have it propagate." | Defeats the gitignore boundary; local is per-machine and must not leak. Claude Code's `settings.local.json` is strictly an override, not a propagation channel. | Local file is entry-level override only (locked). To propagate, the user must write to base (`--local` absent). |

## Feature Dependencies

```
[Pi-native claude-plugins.json schema]
    └──requires──> [State split: desired-state vs internal bookkeeping]
                       └──requires──> [Provenance/managed-records in internal file]
                                          └──enables──> [Scoped removal (anti-brew#22450)]

[Load-time reconciliation]
    └──requires──> [claude-plugins.json schema]
    └──requires──> [Reconcile report (cascade rows in byte-locked catalog)]
    └──requires──> [Scoped removal] ──(safety rail)
    └──requires──> [Network soft-fail at load (NFR-5)]
    └──requires──> [Atomic reconcile saga (v1.7 transaction resilience)]

[First-run migration] ──must-precede──> [Load-time reconciliation]
    (generate-only; a destructive first reconcile is catastrophic)

[Write-back from mutating commands]
    └──requires──> [claude-plugins.json schema]
    └──must-stay-consistent-with──> [Load-time reconciliation]
         (command+reload must be a no-op, not churn)

[enable/disable commands]
    └──requires──> [claude-plugins.json schema (enabled flag)]
    └──requires──> [Version pin retained on disable]
    └──requires──> [Re-materialize from PERSISTED internal records, not in-memory cache]
         (v1.9 cache is cold after /reload)

[--local flag] ──enhances──> [Write-back] and [enable/disable]
[Local override file] ──requires──> [Merged-config precedence (local over base, entry-level)]
[Dry-run/preview] ──enhances──> [Load-time reconciliation]  (optional, builds trust)
```

### Dependency Notes

- **State split must land before/with reconcile:** reconcile's scoped-removal safety depends on the internal file recording provenance ("this extension materialized this"). Without it, reconcile cannot safely tell managed from unmanaged artefacts — the brew#22450 trap.
- **Migration must precede reconcile in execution order:** on a machine with an existing install and no config file, the *first* load must generate-then-treat-as-satisfied, never generate-then-reconcile-and-remove. Ordering bug here = data loss.
- **Write-back and reconcile share one desired-state model:** if they diverge, an `install` followed by `/reload` will either re-churn or "remove" the just-installed plugin. They must compute identical desired-state.
- **enable/disable depends on persisted (not in-memory) records:** the v1.9 manifest cache is process-scoped and cold after `/reload`. Re-enable "without network" therefore must read the persisted internal bookkeeping file, not rely on the warm cache.

## MVP Definition

### Launch With (v1.12)

These are the locked decisions and the safety rails the research says are non-negotiable for an authoritative-pole tool.

- [ ] **claude-plugins.json + claude-plugins.local.json schema, per scope** — the artifact itself; nothing works without it.
- [ ] **State split (committed desired-state vs internal managed-records)** — required for safe scoped removal; required to keep the committed file reviewable.
- [ ] **First-run migration, generate-only** — prevents data loss on the upgrade; must precede reconcile.
- [ ] **Load-time reconciliation with scoped removal** — only remove what the internal file records as managed (brew#22450 guard); network soft-fail (NFR-5); atomic via v1.7 saga.
- [ ] **Reconcile report through the existing structured-notification cascade** — the trust surface; truthful per-item add/remove/skip/fail with v1.11 summary-line grammar; benign no-ops quiet (v1.5).
- [ ] **Write-back from every mutating command + `--local` flag** — keeps file and reality consistent; command+reload is a no-op.
- [ ] **enable/disable commands (autoupdate/noautoupdate twin), re-enable from persisted records, no network** — the locked reversible-toggle feature.
- [ ] **gitignore handling for the .local file** — help the user (or loudly document) so personal toggles don't leak (devcontainer-leak lesson).

### Add After Validation (v1.x)

- [ ] **Dry-run / preview of the next reconcile** — trigger: users report anxiety about automatic destructive reconcile, or a near-miss removal. Strongly consider pulling forward into MVP given reconcile is *automatic* (no `brew bundle`-style explicit gate). LOW–MEDIUM cost since the diff is already computed.
- [ ] **Reconcile-on-demand command (re-run reconcile without a full Pi reload)** — trigger: users want to apply a hand-edited config without `/reload`. Mirrors `home-manager switch`.
- [ ] **Config validation / lint command** — trigger: hand-editing the file produces confusing load-time failures; a `validate` surface that uses the existing typebox schema gives a fast, offline check.

### Future Consideration (v2+)

- [ ] **Per-entry version *ranges* / update policy in the committed file** — defer: conflicts with the exact-equality PI-7 hash model and the no-`semver` STACK decision; only revisit if non-path sources (currently out of scope) land.
- [ ] **Cross-scope merge conflict surfacing (project vs user declaring the same plugin differently)** — defer until users hit it; asdf's nearest-file-wins precedence is the proven simple model to adopt if needed.
- [ ] **Reconcile generations / rollback history (home-manager style)** — defer: v1.7 gives per-reconcile atomic rollback; a *history* of past reconciles is heavier and unproven in demand.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| claude-plugins.json schema + state split | HIGH | MEDIUM | P1 |
| First-run generate-only migration | HIGH | MEDIUM | P1 |
| Load-time reconcile w/ scoped removal + soft-fail | HIGH | HIGH | P1 |
| Reconcile report (cascade rows) | HIGH | MEDIUM | P1 |
| Write-back + `--local` | HIGH | MEDIUM | P1 |
| enable/disable, re-enable from persisted records | HIGH | MEDIUM | P1 |
| gitignore handling for .local | MEDIUM | LOW | P1 |
| Atomic reconcile saga (reuse v1.7) | HIGH | MEDIUM | P1 |
| Dry-run / preview of reconcile | MEDIUM–HIGH | LOW–MEDIUM | P2 (consider P1) |
| Reconcile-on-demand command | MEDIUM | LOW | P2 |
| Config validate/lint | MEDIUM | LOW | P2 |
| Version ranges / update policy in file | LOW | MEDIUM | P3 |
| Reconcile generation history | LOW | HIGH | P3 |

## Competitor Feature Analysis

| Feature | `brew bundle` | nix home-manager | VS Code `extensions.json` / Claude Code | Our Approach (v1.12) |
|---------|---------------|------------------|------------------------------------------|----------------------|
| Authoritative vs recommend | Authoritative, but cleanup is **opt-in** (`brew bundle cleanup`) | Authoritative, cleanup **automatic** on `switch` | Recommend-only (prompt, never auto) | Authoritative, cleanup **automatic at load** — closest to home-manager |
| Removal scoping | **Unsafe** — wipes MAS apps it didn't install (#22450) | Scoped to declared `home.packages` | N/A (never removes) | **Scoped to managed-records** (provenance-tracked internal file) — fixes the brew trap |
| Network at reconcile | Yes, blocking | Yes, blocking `switch` | On prompt only | **Offline, soft-fail, never blocks load** (NFR-5) — the key differentiator |
| Atomicity | No (partial cleanup strands you) | Yes (Nix generations) | N/A | **Yes** (v1.7 saga, all-or-nothing) |
| Dry-run / preview | `--dry-run` | build-before-activate | "Show Recommendations" prompt | P2 candidate (consider P1) |
| Version pin location | Brewfile + lock (preview) | Flake lock | devcontainer-lock.json (separate) | **Internal file** for resolved; committed file for authored desired-state |
| Local override | `--file` per invocation | `.local`-style modules | `settings.local.json` (Claude Code) | **`claude-plugins.local.json`**, gitignored, entry-level override |
| First-run from existing reality | `brew bundle dump` | n/a | n/a | **Auto generate-only migration** |
| Real-world failure to learn from | #22450 over-cleanup | silent drop on declaration removal | #32606 "never prompts" (prompt model fails) | Loud truthful report + scoped removal + auto (not prompt) reconcile |

## Sources

- Homebrew Bundle / Brewfile docs and `brew bundle cleanup` behavior — https://docs.brew.sh/Brew-Bundle-and-Brewfile (HIGH)
- `brew bundle cleanup` uninstalls un-declared Mac App Store apps — Homebrew/brew#22450 — https://github.com/homebrew/brew/issues/22450 (HIGH; key anti-feature evidence)
- nix-community/home-manager manual — declarative switch, generations, rollback, removed-package semantics — https://nix-community.github.io/home-manager/ (HIGH)
- asdf `.tool-versions` precedence (env > local > global > legacy) and exact-version pinning — https://asdf-vm.com/manage/configuration.html (HIGH)
- pre-commit: immutable `rev` requirement, refusal of unpinned-latest, `autoupdate` model and drift issues — https://pre-commit.com/ , pre-commit/pre-commit#1354, #2366 (HIGH)
- VS Code `extensions.json` recommendations — prompt-not-auto-install philosophy — https://docs.runme.dev/configuration/extensions-json/ and VS Code workspace recommendation behavior (HIGH)
- Claude Code settings: `enabledPlugins` (`"x@mp": true/false`, defaultEnabled fallback), `extraKnownMarketplaces`, scope hierarchy incl. `settings.local.json` — https://code.claude.com/docs/en/settings (HIGH)
- Claude Code project config "never prompts" failure of the recommend/prompt model — anthropics/claude-code#32606 (HIGH; supports auto-reconcile over prompt model)
- devcontainer lockfile spec — exact version/checksum pinning, trust-on-first-use, "latest is non-deterministic" — https://github.com/devcontainers/spec/blob/main/docs/specs/devcontainer-lockfile.md (HIGH)
- devcontainer lockfile leaking user-level default features into committed artifact — microsoft/vscode-remote-release#11616 (HIGH; supports state-split anti-feature)

---
*Feature research for: declarative plugin/marketplace config files (v1.12 pi-claude-marketplace)*
*Researched: 2026-06-09*
