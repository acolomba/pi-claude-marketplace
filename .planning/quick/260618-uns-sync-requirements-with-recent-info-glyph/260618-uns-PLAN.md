---
phase: 260618-uns
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/REQUIREMENTS.md
  - docs/prd/pi-claude-marketplace-prd.md
autonomous: true
requirements:
  - SURF-01
  - SURF-02
  - PL-4
must_haves:
  truths:
    - "REQUIREMENTS.md SURF-01 describes the shipped path-resolvable hooks: line contract (installed-installable, installed-resolver-bail-fallback, available, unavailable arms all enumerate hooks) instead of the obsolete `installable plugins only / unavailable -> components: not resolved` claim"
    - "REQUIREMENTS.md SURF-02 covers the third tagged HookSummaryEntry arm `{ kind: \"lenient\"; event: string; groupCount: number; supported: boolean }` produced by the info-surface lenient reader, the resolver-side strict parser unchanged"
    - "PRD PL-4 reflects the 4-glyph catalog ●/○/⊘/◌ with role legend AND the current closed-set status markers actually emitted (drop `(installed, upgradable)`)"
    - "The phrase `previously v1.0+ contract` (or any forward-incompatible v1.0+ reference) is removed from SURF-01"
    - "No source / test files modified; pre-existing uncommitted README.md / docs/hooks.md edits are NOT staged"
    - "`npm run check` still passes (or fails only due to the unrelated pre-existing tests/docs/hooks-doc.test.ts failure called out in the task intent)"
  artifacts:
    - path: ".planning/REQUIREMENTS.md"
      provides: "SURF-01 and SURF-02 rewritten to match shipped info-surface contract"
      contains: "lenient"
    - path: "docs/prd/pi-claude-marketplace-prd.md"
      provides: "PL-4 row aligned with ●/○/⊘/◌ catalog and current status-marker closed set"
      contains: "◌"
  key_links:
    - from: ".planning/REQUIREMENTS.md::SURF-01"
      to: "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts::composeResolvedComponents"
      via: "SURF-01 spec describes the shipped buildRow arms"
      pattern: "path-resolvable"
    - from: ".planning/REQUIREMENTS.md::SURF-02"
      to: "extensions/pi-claude-marketplace/shared/notify.ts::HookSummaryEntry"
      via: "SURF-02 spec describes the 3-arm union including the lenient tagged arm"
      pattern: "kind:.*lenient"
    - from: "docs/prd/pi-claude-marketplace-prd.md::PL-4"
      to: "docs/output-catalog.md::### Glyphs"
      via: "PL-4 carries the canonical 4-glyph catalog and current status-marker closed set"
      pattern: "◌"
---

<objective>
Sync `.planning/REQUIREMENTS.md` and `docs/prd/pi-claude-marketplace-prd.md` with three already-shipped behavior changes on `features/v1.13-hook-bridge` (commits 8a7c278, 70017c5, a0011dd) so the spec accurately describes what the code does today.

Purpose: SURF-01 and SURF-02 today claim a contract the code no longer implements (installable-only hook enumeration, no lenient arm); PL-4 today claims a 3-glyph catalog and a `(installed, upgradable)` marker that the renderer no longer emits. Source artefacts must match shipped behavior — otherwise future planners read false constraints and re-derive obsolete decisions.

Output: Updated REQUIREMENTS.md (SURF-01 rewritten, SURF-02 amended) and PRD (PL-4 rewritten). One atomic commit on `features/v1.13-hook-bridge`.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@.claude/rules/typescript-comments.md
@.planning/REQUIREMENTS.md
@docs/output-catalog.md
@extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
@extensions/pi-claude-marketplace/shared/notify.ts

Read full PRD with `Read /home/acolomba/pi-claude-marketplace/docs/prd/pi-claude-marketplace-prd.md` (1093 lines — too large to `@`-include here, but planner has confirmed PL-4 at L339 is the SOLE PRD touchpoint; no `info` subcommand section exists in the PRD — it is listed as out-of-scope at L1022). Executor MUST still grep verify before editing (see task action).

Shipped contract facts the executor MUST encode (from the planner's source read):

1. `info.ts::composeResolvedComponents` (L382–435) sets `hooks` for EVERY path-resolvable arm via:
   - `resolved.hooksConfigPath === undefined` → `await readLenientHookSummary(pluginRoot)` (the lenient reader)
   - else → `await readHookSummaryEntries(pluginRoot, resolved.hooksConfigPath)` (the strict resolver-success path)

2. The four path-resolvable `buildRow` arms ALL flow through `composeResolvedComponents`:
   - `buildInstalledRow` resolver-success arm (L634–645)
   - `buildInstalledRow` resolver-bail-fallback arm via `buildNotInstallablePathRowFields` (L651–662)
   - `buildAvailableRow` (L768–800)
   - `buildNotInstalledRow` not-installable path-source arm via `buildNotInstallablePathRowFields` (L729–742)

3. Non-path-resolvable sources (`github` / `url` / `git-subdir` / `npm` / `unknown`) STILL defer per INFO-05: they emit `componentsResolved: false` (L623–631 for installed; L716–726 for unavailable). This carve-out is unchanged.

4. `notify.ts::HookSummaryEntry` (L210–218) is a 3-arm union:
   - Tool event (untagged): `{ event: _ToolEvent; matcher: string }`
   - Non-tool event (untagged): `{ event: Exclude<ClaudeHookEvent, _ToolEvent> }`
   - Lenient (tagged): `{ kind: "lenient"; event: string; groupCount: number; supported: boolean }`
   Renderer branches on `"kind" in entry` first, then on `"matcher" in entry` for the tool/non-tool split.

5. `readLenientHookSummary` (L322–365) reads `<pluginRoot>/hooks/hooks.json`, walks top-level `data.hooks` event keys, emits one lenient entry per non-empty group array with `supported = BUCKET_A_EVENTS_SET.has(eventName)`. The renderer surfaces a ` (unsupported)` suffix iff `supported === false`. The strict parser in `domain/components/hooks.ts::parseHooksConfig` is unchanged — install correctness is unaffected.

6. Glyph catalog (notify.ts L1324–1337):
   - `ICON_INSTALLED = "●"`
   - `ICON_AVAILABLE = "○"`
   - `ICON_UNINSTALLABLE = "⊘"`
   - `ICON_DISABLED = "◌"` (U+25CC DOTTED CIRCLE) — for `(disabled)` realized AND `(will disable)` pending-tense
   Role mapping (per `docs/output-catalog.md` § Glyphs):
   - `●` installed / pending-positive transition (installed, updated, reinstalled, upgradable, will install, will enable)
   - `○` not-installed / no-error / pending-removal (available, uninstalled, will uninstall)
   - `⊘` error / blocked (unavailable, skipped, failed, manual recovery)
   - `◌` deliberate disabled (disabled, will disable)

7. PluginStatus closed set (notify.ts L277–296, L506) — relevant tokens emitted today:
   `installed | upgradable | available | unavailable | uninstalled | updated | reinstalled | skipped | failed | manual recovery | disabled | present | will install | will uninstall | will enable | will disable`.
   The PRD's current `(installed, upgradable)` composite marker is NOT in the closed set — `upgradable` is its OWN top-level status token. The composite form is stale wording from V1.

Sweep results — every line that needs editing (planner has grepped both files):

**`.planning/REQUIREMENTS.md`:**
- L71 — SURF-01 entry (full rewrite per Edit 1 below)
- L72 — SURF-02 entry (addendum per Edit 2 below)

(Planner grepped for `glyph|icon|⊘|●|○|◌|info[-_ ]?row|components: not resolved|\(unavailable\)|HookSummary|hooks: line|info <plugin>|info command` across REQUIREMENTS.md. Other hits — L26 HOOK-04, L48 TOOL-02, L74 SURF-04, L76+L82 SURF-06, L121 PROM-01 — all describe the `{unsupported hooks}` reason or other unrelated facets and are FACTUALLY ACCURATE today; DO NOT edit them.)

**`docs/prd/pi-claude-marketplace-prd.md`:**
- L339 — PL-4 row (full rewrite per Edit 3 below)

(Planner grepped for the same terms across the PRD. Other hits — L92, L118, L119, L127 in §3 Glossary; L206 ML-2 marketplace-list row (3-glyph but `●/○/⊘` is correct for marketplace headers per output-catalog.md § Glyphs — marketplace headers never emit `◌`); L257 PI-7 hash version; L339 PL-4 (the target); L341 PL-6; L533–534 PR-3/PR-4 resolver notes; L1022 `info` listed as out-of-scope — NONE describe plugin-row glyph/status-marker composition with the v1.13 4-glyph catalog. Marketplace-header glyph references (ML-2) stay at 3-glyph correctly. The §3 Glossary entries and PR-3/PR-4 use `hooks` as a component-type / resolver-note token, not a glyph reference. DO NOT edit any of these.)

**Files NOT to touch** (per task intent):
- `.planning/milestones/**`
- `CHANGELOG.md`
- README.md (pre-existing uncommitted user edits in working tree)
- docs/hooks.md (pre-existing uncommitted user edits in working tree)
- Any source / test files
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite SURF-01 + SURF-02 in REQUIREMENTS.md and PL-4 in the PRD, then commit</name>
  <files>.planning/REQUIREMENTS.md, docs/prd/pi-claude-marketplace-prd.md</files>
  <action>

Before editing, RE-GREP both files exactly as the planner did, to confirm no new hits appeared and the line numbers below are still valid (sources may have shifted since planning):

```bash
grep -n -iE 'glyph|icon|⊘|●|○|◌|info[-_ ]?row|components: not resolved|\(unavailable\)|HookSummary|hooks: line|info <plugin>|info command' .planning/REQUIREMENTS.md
grep -n -iE 'glyph|icon|⊘|●|○|◌|info[-_ ]?row|components: not resolved|\(unavailable\)|HookSummary|hooks: line|info <plugin>|info command|unsupported hooks' docs/prd/pi-claude-marketplace-prd.md
```

If the line numbers below shifted, use Edit on the verbatim source string (which is unique in each file) rather than line numbers. If you find a hit the planner did not list, STOP and surface it before editing — the sweep was meant to be exhaustive.

**Edit 1 — SURF-01 (`.planning/REQUIREMENTS.md`, currently around L71)**

Replace the entire bullet (one logical line) with the new contract. Forbidden phrasing to drop: `installable plugins`, `unavailable plugins continue to render \`components: not resolved\``, `previously v1.0+ contract`, `existing v1.0+ unavailable-row contract`.

New SURF-01 (single bullet, one paragraph; preserve `- [x] **SURF-01**: ` prefix verbatim):

```
- [x] **SURF-01**: `info <plugin>` renders a `hooks:` line on EVERY path-resolvable info row — `(installed)` resolver-success, `(installed)` resolver-bail-fallback (state record says installed but the resolver flipped non-installable, e.g. now-unsupported hook event or matcher), `(available)`, AND `(unavailable)`. The `hooks:` line inserts between `commands` and `mcp` alphabetically alongside the other per-kind component lines, sourced from the resolver's variant or a best-effort on-disk walk. On the resolver-success path the rich `HookSummaryEntry` arms render `event(matcher)` for tool events (`PreToolUse` / `PostToolUse` / `PostToolUseFailure`) and `event` alone for non-tool events. On the resolver-bail path (`resolved.hooksConfigPath === undefined`) the info surface invokes the lenient hooks reader, which walks the top-level event keys in `<pluginRoot>/hooks/hooks.json` and emits one `kind: "lenient"` entry per non-empty group array carrying `event + groupCount + supported`; events outside `BUCKET_A_EVENTS` render with a trailing `(unsupported)` suffix. Non-path-resolvable sources (`github` / `url` / `git-subdir` / `npm` / `unknown`) still defer per INFO-05 — the row emits `componentsResolved: false` and the renderer surfaces `components: not resolved`; no on-disk walk runs for these sources (NFR-5). TOOL-02's strict supportability policy is unchanged — a plugin whose hooks contain an unsupported event STILL installs as `(unavailable) {unsupported hooks}`; this REQ governs only how the info surface DESCRIBES that plugin, not whether it installs.
```

**Edit 2 — SURF-02 (`.planning/REQUIREMENTS.md`, currently around L72)**

Append an addendum sentence to the existing SURF-02 bullet describing the third tagged arm. Do NOT delete the existing text — the `HookSummary` / `ClaudeHookEvent` / no-string-re-derivation claims are still accurate. Append after the trailing sentence (after `... per-entry gating language entirely`):

```
 The `HookSummaryEntry` discriminated union additionally carries a third tagged arm `{ kind: "lenient"; event: string; groupCount: number; supported: boolean }` produced ONLY by the info-surface `readLenientHookSummary` helper at `orchestrators/plugin/info.ts` when the resolver bailed (i.e. did not record `hooksConfigPath`). The renderer branches on `"kind" in entry` first, then on `"matcher" in entry` for the tool/non-tool untagged-arm split. The resolver-side strict parser (`domain/components/hooks.ts::parseHooksConfig`, HOOK-01) is unchanged and never produces lenient entries — install correctness is non-negotiable; the lenient arm is a read-only info-surface augmentation.
```

(Keep the `- [x] **SURF-02**: ` prefix; the addendum is added inline at the end of the existing bullet.)

**Edit 3 — PL-4 (`docs/prd/pi-claude-marketplace-prd.md`, currently around L339)**

Replace the PL-4 row's requirement-cell text. Keep the `| **PL-4** |` cell prefix and the trailing `|` exactly as is. New requirement cell:

```
Each plugin entry MUST show its icon (one of `●` / `○` / `⊘` / `◌`), name, optional `(<version>)`, and a status marker drawn from the closed set `(installed)` / `(upgradable)` / `(available)` / `(unavailable)` / `(uninstalled)` / `(updated)` / `(reinstalled)` / `(skipped)` / `(failed)` / `(manual recovery)` / `(disabled)` / `(present)`, optionally followed by a `{reasons}` brace on the 5 reason-bearing variants. Glyph roles: `●` installed or pending-positive transition; `○` not-installed with no error or pending-removal; `⊘` error/blocked (unavailable, failed, skipped, manual recovery); `◌` deliberate user-requested disabled state. A description (when present) appears on a second indented line, truncated at column 66.
```

This drops the stale `(installed, upgradable)` composite (which is not in the closed `PluginStatus` set), adds `(disabled)` and the `◌` glyph, lists the actual status-token closed set, and adds the role legend.

**Style guardrails (per `.claude/rules/typescript-comments.md` applied to spec prose):**
- Do NOT introduce new phase/plan/wave/pitfall/milestone references.
- Decision/REQ IDs are encouraged anchors (HOOK-01, INFO-05, TOOL-02, NFR-5, etc. used above are fine).
- The phrase `v1.0+` MUST be removed from SURF-01; the new SURF-01 prose above does that.

**Verification before committing:**

1. Grep to confirm the obsolete phrasing is gone:

```bash
grep -n 'v1\.0+' .planning/REQUIREMENTS.md | grep -v '^#' || echo "OK: no v1.0+ anchor in REQUIREMENTS"
grep -n 'components: not resolved' .planning/REQUIREMENTS.md | grep -v '^#' || echo "OK: removed unavailable→components:not resolved claim"
grep -n 'installed, upgradable' docs/prd/pi-claude-marketplace-prd.md | grep -v '^#' || echo "OK: composite marker removed"
```

The first two should print only the OK line (no `v1.0+` and no `components: not resolved` left in REQUIREMENTS.md after the SURF-01 rewrite; the `components: not resolved` phrasing IS still allowed in SURF-01 when describing the NFR-5 non-path-resolvable carve-out, so the grep is informational — check that any remaining hit is in the new non-path-resolvable clause, not the stale `unavailable plugins continue to render` clause). The third should print the OK line.

2. Grep to confirm the new content is present:

```bash
grep -n 'kind: "lenient"' .planning/REQUIREMENTS.md
grep -n '◌' docs/prd/pi-claude-marketplace-prd.md
grep -n 'readLenientHookSummary' .planning/REQUIREMENTS.md
```

All three should print at least one match.

3. Run `npm run check` as a safety net. Pure docs change; no source touched; the only test failure should be the pre-existing `tests/docs/hooks-doc.test.ts` related to uncommitted `docs/hooks.md` edits (out of scope per task intent). Any OTHER failure means an unintended side effect — investigate before committing.

**Commit (sequential, non-worktree mode):**

Stay on `features/v1.13-hook-bridge`. Stage ONLY `.planning/REQUIREMENTS.md` and `docs/prd/pi-claude-marketplace-prd.md` — do NOT stage `README.md` or `docs/hooks.md` (pre-existing user edits) or anything in `.bg-shell/`, `.gsd/`, `.playwright-mcp/`, `link-row-overview.png`.

Run pre-commit BEFORE attempting `git commit`:

```bash
pre-commit run --files .planning/REQUIREMENTS.md docs/prd/pi-claude-marketplace-prd.md
```

Fix any failures, restage, re-run until clean.

Then commit (sequential mode, NOT inside a worktree, so do NOT prefix `SKIP=trufflehog`):

```bash
git add .planning/REQUIREMENTS.md docs/prd/pi-claude-marketplace-prd.md
git commit -m "$(cat <<'EOF'
docs(spec): sync SURF-01 / SURF-02 / PL-4 with shipped info contract

SURF-01 now reflects shipped behavior: `info <plugin>` enumerates
hooks on every path-resolvable row (installed-installable,
installed-resolver-bail-fallback, available, unavailable) via the
strict reader on resolver success and the new lenient reader when
the resolver bailed. Non-path-resolvable sources still defer per
INFO-05.

SURF-02 gains an addendum covering the third `HookSummaryEntry`
arm `{ kind: "lenient"; event; groupCount; supported }` produced
only by the info-surface lenient reader; the resolver-side strict
parser is unchanged.

PRD PL-4 updates the glyph catalog to `●/○/⊘/◌` (adds `◌` for
the disabled state), drops the obsolete `(installed, upgradable)`
composite marker, and lists the actual closed-set status tokens
the renderer emits today.

No source / test files touched.
EOF
)"
```

Pre-existing uncommitted edits in `README.md` and `docs/hooks.md` MUST remain unstaged in the working tree after the commit.

  </action>
  <verify>
    <automated>git log -1 --stat | grep -E 'REQUIREMENTS\.md|prd/pi-claude-marketplace-prd\.md' | grep -v '^#' | wc -l | grep -qE '^[2-9]$|^[0-9][0-9]+$' &amp;&amp; grep -q 'kind: "lenient"' .planning/REQUIREMENTS.md &amp;&amp; grep -q '◌' docs/prd/pi-claude-marketplace-prd.md &amp;&amp; ! git diff --cached --name-only | grep -qE '^(README\.md|docs/hooks\.md)$' &amp;&amp; ! git status --porcelain | grep -E '^[AM] ' | grep -vE '^[AM] (README\.md|docs/hooks\.md)$' | grep -v '^#'</automated>
  </verify>
  <done>
    Single atomic commit on `features/v1.13-hook-bridge` modifying ONLY `.planning/REQUIREMENTS.md` and `docs/prd/pi-claude-marketplace-prd.md`. SURF-01 rewritten to describe the path-resolvable hooks: line contract (no `v1.0+`, no `unavailable plugins continue to render components: not resolved`). SURF-02 amended with the lenient-arm addendum. PL-4 glyph catalog expanded to `●/○/⊘/◌` with role legend, and the status-marker list reflects the current closed `PluginStatus` set (no `(installed, upgradable)`). `README.md` and `docs/hooks.md` working-tree edits remain unstaged. `npm run check` either passes or fails only on the pre-existing `tests/docs/hooks-doc.test.ts` failure called out in the task intent.
  </done>
</task>

</tasks>

<verification>
After the commit:

1. `git log -1` shows one new commit titled `docs(spec): sync SURF-01 / SURF-02 / PL-4 with shipped info contract` (or close — title ≤72 chars, conventional commits format).
2. `git diff HEAD~1 -- .planning/REQUIREMENTS.md` shows SURF-01 fully rewritten and SURF-02 addendum appended.
3. `git diff HEAD~1 -- docs/prd/pi-claude-marketplace-prd.md` shows ONLY the PL-4 row changed (no other touch points).
4. `git status` shows `README.md` and `docs/hooks.md` STILL in modified-unstaged state (their pre-existing edits were not swept up).
5. No source files (`extensions/**`, `tests/**`) appear in the diff.
6. `grep -c '◌' docs/prd/pi-claude-marketplace-prd.md` is ≥1.
7. `grep -c 'kind: "lenient"' .planning/REQUIREMENTS.md` is ≥1.
</verification>

<success_criteria>
- One atomic commit on `features/v1.13-hook-bridge` with conventional-commits title ≤72 chars
- Exactly two files modified: `.planning/REQUIREMENTS.md` and `docs/prd/pi-claude-marketplace-prd.md`
- SURF-01 prose matches shipped contract (no `v1.0+`, no `unavailable plugins continue to render \`components: not resolved\`` claim)
- SURF-02 carries the lenient-arm addendum
- PL-4 row carries the `◌` glyph, role legend, and current closed-set status markers (no `(installed, upgradable)`)
- README.md + docs/hooks.md working-tree edits left unstaged
- `npm run check` either green or failing only on the pre-existing `tests/docs/hooks-doc.test.ts` failure
</success_criteria>

<output>
Create `.planning/quick/260618-uns-sync-requirements-with-recent-info-glyph/260618-uns-01-SUMMARY.md` when done, listing the three edits made, the verification grep results, and the commit SHA.
</output>
