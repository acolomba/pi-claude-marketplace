---
spike: 001
name: installed-record-backcompat-audit
type: standard
validates: "Given the current state.json / agent-marker backward-compat code, when audited against 'force reinstall on detected stale record' as the replacement strategy, then produce an exact file/LOC/test inventory of what could be deleted and flag any code where deletion changes behavior rather than just shrinking it"
verdict: VALIDATED
related: [002, 003]
tags: [backward-compat, migration, state-json, audit]
---

# Spike 001: Installed-Record Backward-Compat Audit

## What This Validates

Given the current field-level migration code for `state.json` plugin/
marketplace records and generated-agent-file recognition, when catalogued
and cross-checked against the live install/add write paths, then we can
say precisely what a "force reinstall / force re-add on detected stale
record" strategy would let us delete, and where deletion is not free.

## Research

Not a library question -- this is entirely internal-architecture audit.
Method: grep for `legacy`/`migrat`/`ENBL-02`/`D-13`/schemaVersion across
`extensions/pi-claude-marketplace/`, then verify each hit by reading the
call graph rather than trusting the comment.

## How to Run

```bash
./dep-check.sh
```

## What to Expect

Three checks, each confirming a load-bearing assumption before trusting
the LOC inventory below:

1. `migrateLegacyMarketplaceRecords` has exactly one caller (`state-io.ts`)
   -- it is not reused by the install/add write paths.
2. `install.ts` / `add.ts` never import from `persistence/migrate.ts` --
   fresh records are built independently, so the migration fills are not
   shared logic.
3. Nothing still writes `STATE_SCHEMA`'s `schemaVersion: 1` -- the union
   arm is read-only back-compat, not a currently-produced shape.

## Investigation Trail

**First pass -- naive grep.** `grep -rn "legacy\|migrat"` across the
extension hit 45 files. Most were false positives: `notify.ts`'s "legacy
`notify()` path" is about a message-rendering refactor, `event-adapters.ts`'s
"legacy 4-arm silent-drop shim" is a Claude-Code hook-compat shim, and
`import/marketplaces.ts`'s "flat legacy shape" is about tolerating two
shapes of *upstream* Claude Code marketplace directory config, not our own
version history. None of these are what the idea is about (backward compat
for *our* previously-installed records) and are out of scope for this
audit.

**Narrowed to four real call sites**, all tied to genuine version-history
back-compat for on-disk records this extension itself wrote in a prior
release:

| Location | Prod LOC | Test LOC | What it catches |
|---|---|---|---|
| `persistence/migrate.ts` | 283 | 529 | `ensureMarketplacePaths` (missing `manifestPath`/`marketplaceRoot`), `ensurePluginResources` (missing `resources.agents`/`mcpServers`/`hooks` -- HOOK-02), `ensurePluginEnabled` (missing `enabled` -- ENBL-02), `ensureNoLegacyAutoupdate` (D-13 scrub) |
| `state-io.ts` schemaVersion union | ~3 (the `Type.Union` line + comment) | shared with migrate.test.ts | Accepts on-disk `schemaVersion: 1` (pre-ENBL-02) alongside the current `2` |
| `bridges/agents/marker.ts` | 87 | 168 | `GENERATED_AGENT_MARKER_LEGACY` -- recognizes pre-0.10 agent files (marker lived in a body HTML comment, not frontmatter) as "ours" |
| D-13 `autoupdate` scrub threading | ~15 scattered | included above | `marketplace/shared.ts`, `marketplace/autoupdate.ts`, `reconcile/apply.ts` each carry a cast to read the legacy field before/after the scrub gate opens |

Total: **~385 production LOC + ~700 test LOC (~1085 total)** directly
implementing "recognize an old on-disk shape and up-convert it in place."

**Second pass -- is any of this shared with the live write path?**
This is the question that actually matters for the spike, because if
`ensurePluginResources` were *also* how `install.ts` builds a fresh
record, deleting it would delete real logic, not just legacy-catchup.
Ran `dep-check.sh`:

```
=== Callers of migrateLegacyMarketplaceRecords ===
persistence/state-io.ts:374

=== Does install.ts ever call migrate.ts helpers? ===
(no imports found -- confirmed disjoint)

=== schemaVersion 1 write sites ===
(all hits are CONFIG_SCHEMA's unrelated schemaVersion:1 literal -- the
 CURRENT and only version of claude-plugins.json, not STATE_SCHEMA. No
 hit writes STATE_SCHEMA's legacy arm.)
```

Confirmed by direct read of `install.ts:1202` and `marketplace/add.ts:694`:
both build `resources: {...}` / `manifestPath`/`marketplaceRoot` fully,
independently, every time. `migrate.ts` is 100% legacy-catchup code with
zero overlap with the live write path -- a clean deletion candidate if
stale records get force-reinstalled/force-re-added instead of field-healed.

**Third pass -- the one place deletion is NOT free.** `marker.ts`'s
`GENERATED_AGENT_MARKER_LEGACY` is not a data-shape default-fill, it's a
*safety* predicate. `isOwnedAgentFile` (AG-5) decides whether the extension
is allowed to touch an on-disk agent file at all -- basename prefix AND
(current marker OR legacy marker). It gates `stage.ts` and `unstage.ts`
before any overwrite or delete.

Traced the failure mode if `GENERATED_AGENT_MARKER_LEGACY` is deleted:
a pre-0.10 agent file (marker in body HTML comment, not frontmatter) would
fail `isOwnedAgentFile` and get reclassified from "ours, safely
regenerable" to "foreign content, refuse to touch." That is a **soft-fail**
(`unstage.ts` step 7: pushed to `ag5Failures[]`/`foreignPreservedEntries[]`,
never thrown, never deleted) -- so nothing corrupts. But a force-reinstall
would not silently heal this file the way `migrate.ts`-style field-healing
implicitly does today: the plugin's reinstall would report a foreign-content
failure for that one file and leave it in place, every time, until the user
manually deletes it. This is a genuine, if narrow, regression surface:
users who installed before the 0.10 provenance-format change and haven't
touched that agent since would see a new failure notification on their
next reinstall.

## Results

**Verdict: VALIDATED.** The audit produced a clean, evidence-backed
inventory:

- **~385 production LOC / ~700 test LOC** is pure legacy-record-shape
  catchup, entirely disjoint from the live install/add write paths.
  Deleting it and replacing detection with a version-stamp check (see
  Spike 003) is architecturally safe for `migrate.ts` and the schemaVersion
  union.
- **One exception**: `GENERATED_AGENT_MARKER_LEGACY` in `marker.ts` (87 LOC
  file, but only ~4 lines are the legacy marker itself) is a safety
  predicate, not a data migration. Removing it doesn't break anything --
  the soft-fail path already exists -- but it converts a currently-silent
  upgrade path into a visible one-time failure notification for any user
  who installed a `pi-claude-marketplace`-generated agent before the 0.10
  marker-format change and hasn't reinstalled it since. Worth calling out
  explicitly to the user rather than silently dropping, and worth an
  explicit CHANGELOG line if removed (per project convention of noting
  PI-7 / user-contract changes).

Impact on Spike 003: the version-stamp replacement mechanism needs to
cover marketplace-level fields too (`manifestPath`/`marketplaceRoot`),
which are not a "plugin install" concept -- reinstall operates on plugins,
not marketplaces. This is the open question Spike 003 has to resolve.
