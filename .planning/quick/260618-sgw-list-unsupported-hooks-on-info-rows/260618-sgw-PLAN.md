---
phase: quick-260618-sgw
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/shared/notify-v2.test.ts
autonomous: true
requirements: []

must_haves:
  truths:
    - "A path-resolvable `(unavailable) {unsupported hooks}` row whose `hooks/hooks.json` declares a non-bucket-A event (e.g. `Stop`) lists that event under a `hooks:` block with `(unsupported)` after the event name."
    - "A path-resolvable row whose hooks file declares MIXED events (one bucket-A, one outside) lists BOTH events, ONLY the non-bucket-A one tagged `(unsupported)`."
    - "Existing `(installed)` (resolver-success) rows with a parseable `hooks.json` render IDENTICAL bytes to today: same `hooks:` header, same `<event>(<matcher>)` / `<event>` lines, NO `(unsupported)` suffix."
    - "Path-resolvable rows with NO `hooks/hooks.json` continue to emit no `hooks:` block."
    - "Path-resolvable rows with an unparseable `hooks/hooks.json` continue to emit no `hooks:` block (silent on the info surface; the row-level `{unsupported hooks}` brace carries the signal)."
    - "The resolver-side strict parser (`domain/components/hooks.ts::parseHooksConfig`) is UNCHANGED; install correctness (NFR-7 / TOOL-02) is preserved."
  artifacts:
    - path: "extensions/pi-claude-marketplace/shared/notify.ts"
      provides: "Extended `HookSummaryEntry` union with a tagged `{ kind: 'lenient'; event; groupCount; supported }` arm; renderer emits `<event> (unsupported)` when `supported === false`."
      contains: 'kind: "lenient"'
    - path: "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts"
      provides: "Private `readLenientHookSummary(pluginRoot)` + `composeResolvedComponents` branch that uses it when `resolved.hooksConfigPath === undefined`."
      contains: "readLenientHookSummary"
    - path: "tests/orchestrators/plugin/info.test.ts"
      provides: "Four new cases covering (a) `Stop`-only unavailable row, (b) mixed `PostToolUse` + `Stop` unavailable row, (c) invalid-JSON suppresses block, (d) no hooks file suppresses block on the unavailable row."
    - path: "tests/shared/notify-v2.test.ts"
      provides: "One new renderer case asserting the lenient entry's `(unsupported)` suffix byte form."
  key_links:
    - from: "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:composeResolvedComponents"
      to: "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:readLenientHookSummary"
      via: "if/else on `resolved.hooksConfigPath === undefined`"
      pattern: "resolved\\.hooksConfigPath === undefined"
    - from: "extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:readLenientHookSummary"
      to: "extensions/pi-claude-marketplace/domain/components/hook-events.ts:BUCKET_A_EVENTS"
      via: "module-scope `BUCKET_A_EVENTS_SET = new Set(BUCKET_A_EVENTS)` membership test"
      pattern: "BUCKET_A_EVENTS_SET"
    - from: "extensions/pi-claude-marketplace/shared/notify.ts:appendHooksBlock"
      to: "shared/notify.ts:HookSummaryEntry (lenient arm)"
      via: "discriminate via `\"kind\" in entry && entry.kind === \"lenient\"`"
      pattern: "kind === \"lenient\""
---

<objective>
Make `info.ts` surface every top-level hook event declared in a path-resolvable plugin's `hooks/hooks.json`, tagging events that fall outside `BUCKET_A_EVENTS` with `(unsupported)`. The resolver-side strict parser stays strict (install correctness is non-negotiable); a NEW best-effort reader lives in the info surface only and runs ONLY when the resolver bailed (`resolved.hooksConfigPath === undefined`).

Purpose: `info` is an _info_ command. Today a `(unavailable) {unsupported hooks}` row tells the user "something about hooks is wrong" but says nothing about which events are declared. With this change, a user looking at ralph-loop sees `hooks: Stop (unsupported)` and immediately knows the plugin declares `Stop`, which v1.13 doesn't support.

Output: extended `HookSummaryEntry` union + lenient reader + 5 new test cases.
</objective>

<execution_context>
@$HOME/.claude/gsd-core/workflows/execute-plan.md
@$HOME/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@.claude/rules/typescript-comments.md
@extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
@extensions/pi-claude-marketplace/domain/components/hook-events.ts
@extensions/pi-claude-marketplace/shared/notify.ts
@extensions/pi-claude-marketplace/domain/resolver.ts
@tests/orchestrators/plugin/info.test.ts
@tests/shared/notify-v2.test.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend HookSummaryEntry with a tagged lenient arm + renderer support</name>
  <files>extensions/pi-claude-marketplace/shared/notify.ts</files>
  <action>
Extend the `HookSummaryEntry` union at `notify.ts:198` with a third tagged arm so the info surface can carry events the strict resolver-side parser rejected.

NEW union shape:
  - Existing untagged tool arm: `{ readonly event: _ToolEvent; readonly matcher: string }`
  - Existing untagged non-tool arm: `{ readonly event: Exclude<ClaudeHookEvent, _ToolEvent> }`
  - NEW tagged lenient arm: `{ readonly kind: "lenient"; readonly event: string; readonly groupCount: number; readonly supported: boolean }`

Discriminator rule: the existing two arms have NO `kind` field; the new arm is the only one that carries `kind: "lenient"`. Use `"kind" in entry` as the structural discriminator.

Why `event: string` on the lenient arm (not `ClaudeHookEvent`): the whole point of this arm is that the event name was REJECTED by the resolver — it may be `Stop`, `Notification`, or any other key the plugin author wrote. The supported flag carries the bucket-A membership signal.

Update the explanatory comment block at `notify.ts:160-205` (the `SURF-02 / D-63-06 / D-63-07: hook summary type seam` block) to describe the new lenient arm: rendered only on info-surface rows where the resolver did NOT record `hooksConfigPath` (i.e. the lenient reader in `info.ts` produced these), carries `supported: false` for non-bucket-A events.

Comment policy (per `.claude/rules/typescript-comments.md`): NO phase/plan/wave/Pitfall refs. Anchor the new prose to the EXISTING `SURF-02 / D-63-06 / D-63-07` traceability IDs already in that comment block. The new arm is a forward-compatible extension of the SURF-02 type seam; reuse those IDs as the anchor.

Update `appendHooksBlock` (at `notify.ts:2689`):
  - Add a NEW first branch checking `"kind" in entry && entry.kind === "lenient"`. Render as `      ${entry.event}` followed by ` (unsupported)` IFF `entry.supported === false`. When `entry.supported === true`, render the bare `      ${entry.event}` (no suffix) — supported bucket-A events surface unchanged with the same visual weight regardless of which reader produced them.
  - Existing tool-event branch (`"matcher" in entry`) UNCHANGED.
  - Existing non-tool-event branch (the `else`) UNCHANGED.

Update the function's docstring to mention the lenient arm renders `<event>` with an optional ` (unsupported)` suffix.

No changes to `PluginInfoComponentsResolved.components.hooks?` — its type is `readonly HookSummaryEntry[]`, which now structurally accepts lenient entries.

No changes to closed-set tuples (`REASONS`, `STATUS_TOKENS`, `MARKERS`, `PATTERN_CLASSES`) — `unsupported` is NOT a `Reason` token here, it is a visual suffix on a hook-event line. The row-level `{unsupported hooks}` brace remains the only `Reason` in play.
  </action>
  <verify>
    <automated>cd /home/acolomba/pi-claude-marketplace &amp;&amp; npx tsc --noEmit -p tsconfig.json</automated>
  </verify>
  <done>
`HookSummaryEntry` union has 3 arms (existing two untagged + new `{ kind: "lenient"; event; groupCount; supported }`). `appendHooksBlock` renders the lenient arm as `      <event>` with ` (unsupported)` suffix when `supported === false`. Existing renderer tests at `tests/shared/notify-v2.test.ts:2961` (discriminator), `:2986` (multi-line block), `:3029` (empty hooks), `:3063` (undefined hooks) still pass without modification — the new arm is additive.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add lenient hooks reader in info.ts and wire it into composeResolvedComponents</name>
  <files>extensions/pi-claude-marketplace/orchestrators/plugin/info.ts</files>
  <action>
Add `BUCKET_A_EVENTS` to the existing import from `../../domain/components/hook-events.ts` at `info.ts:25` (it already imports `TOOL_EVENTS, type ToolEvent`).

Add a module-scope `BUCKET_A_EVENTS_SET: ReadonlySet&lt;string&gt; = new Set&lt;string&gt;(BUCKET_A_EVENTS);` next to the existing `TOOL_EVENT_SET` at `info.ts:52`. Comment it with the same rationale: O(1) membership check, allocated once. Anchor to `INFO-05` (the existing source-kind-gate decision ID at the file header). Do NOT use Pitfall N / Plan N references.

Add a new private async helper `readLenientHookSummary(pluginRoot: string): Promise&lt;readonly HookSummaryEntry[] | undefined&gt;` near the existing `readHookSummaryEntries` (around `info.ts:276`). Behavior:

  1. Build the path: `path.join(pluginRoot, "hooks", "hooks.json")`.
  2. Read the file with `readFile(p, "utf8")`. On `ENOENT` / `ENOTDIR` -> return `undefined` (no hooks file is a legitimate "no hooks bucket" state). On any other read error -> return `undefined` (silent — the row-level `narrowProbeError` ladder + the resolver's `unsupported hooks` REASON already carry the user-visible signal; the lenient reader is a best-effort augmentation, not a primary error channel). Use a `try`/`catch` with `(err as NodeJS.ErrnoException).code` narrowing, mirroring `readEntriesOrEmpty` at `info.ts:156`.
  3. `JSON.parse(raw)` inside a try/catch — on `SyntaxError` return `undefined`.
  4. Duck-type validate the top-level shape: the canonical Claude form is `{ "hooks": { "&lt;Event&gt;": [ ... ] } }`. Verify `typeof data === "object" &amp;&amp; data !== null &amp;&amp; "hooks" in data` and `typeof data.hooks === "object" &amp;&amp; data.hooks !== null &amp;&amp; !Array.isArray(data.hooks)`. If the duck-type fails -> return `undefined`.
  5. Iterate `Object.entries(data.hooks)` in declaration order. For each `[eventName, groups]`:
       - `groupCount = Array.isArray(groups) ? groups.length : 0`.
       - When `groupCount === 0`, SKIP the event (no handler groups to surface).
       - Push `{ kind: "lenient", event: eventName, groupCount, supported: BUCKET_A_EVENTS_SET.has(eventName) }`.
  6. If the resulting array is empty, return `undefined` (so the renderer suppresses the `hooks:` block via `appendHooksBlock`'s existing length-zero guard).

The helper MUST NOT call `parseHooksConfig` (that is the strict resolver-side parser). Direct `JSON.parse` + duck-type only. No `MATCH-03` projectRoot context, no `compileIf` — the lenient reader has no notion of `if`-fields or matchers.

Wire into `composeResolvedComponents` (at `info.ts:311`): replace the single-ternary `hooks` derivation at `info.ts:345-348` with an if/else:

  - When `resolved.hooksConfigPath !== undefined` -> call the EXISTING `readHookSummaryEntries(pluginRoot, resolved.hooksConfigPath)` UNCHANGED (preserves the rich resolver-success byte form).
  - Else -> call the NEW `readLenientHookSummary(pluginRoot)`.

The existing object-spread at `info.ts:353` (`...(hooks !== undefined &amp;&amp; hooks.length > 0 &amp;&amp; { hooks })`) is byte-stable — both readers return `readonly HookSummaryEntry[] | undefined` and the empty-array guard handles both.

Comment rules (strict):
  - No `Phase NN`, `Plan NN`, `Wave N`, `Pitfall N`, `Pitfall NN-N`, `milestone vX.Y` references.
  - Acceptable anchors: `INFO-05` (the existing source-kind-gate decision ID, file-header line 10), `HOOK-01` (used in resolver), or a fresh `INFO-08` if neither fits the rationale. The lenient reader's rationale is closest to `INFO-05` (info-surface read-only enumeration) — use it as the anchor for the new helper's docstring. Cite both `INFO-05` and `HOOK-01` in the docstring: `INFO-05` for the info-surface info-only role, `HOOK-01` for the contrast with the resolver-side strict parser.
  - The `BUCKET_A_EVENTS_SET` constant comment should mirror the `TOOL_EVENT_SET` pattern at `info.ts:49-52` minus the `SURF-01 / Pitfall 7` anchor (drop the `Pitfall 7` token per the comment policy; keep `INFO-05` as the new anchor).

NFR-5 (no network): the helper reads ONLY `&lt;pluginRoot&gt;/hooks/hooks.json` from disk. No network calls. The grep-gate at `tests/orchestrators/plugin/info.test.ts` (the same gate that enforces `info.ts` has no `platform/git` import) continues to pass because the helper adds no new imports beyond `readFile` (already imported) and `BUCKET_A_EVENTS` (a string tuple).
  </action>
  <verify>
    <automated>cd /home/acolomba/pi-claude-marketplace &amp;&amp; npx tsc --noEmit -p tsconfig.json</automated>
  </verify>
  <done>
`composeResolvedComponents` calls `readHookSummaryEntries` when `resolved.hooksConfigPath !== undefined` (unchanged path) and the new `readLenientHookSummary(pluginRoot)` otherwise. The lenient reader returns `readonly HookSummaryEntry[] | undefined`; ENOENT / ENOTDIR / unreadable / unparseable / wrong-shape all collapse to `undefined`. `BUCKET_A_EVENTS_SET` is a module-scope `ReadonlySet&lt;string&gt;`. Existing comment-policy grep gate passes (no Phase/Plan/Wave/Pitfall tokens introduced).
  </done>
</task>

<task type="auto">
  <name>Task 3: Add tests covering the lenient reader + a renderer byte-form check</name>
  <files>tests/orchestrators/plugin/info.test.ts, tests/shared/notify-v2.test.ts</files>
  <action>
**`tests/orchestrators/plugin/info.test.ts`** — append 4 new cases at the end of the file (after the existing INFO-05 cluster, around `info.test.ts:1775`). Match the existing fixture conventions (`withHermeticHome`, `seedPathMarketplace`, `makeCtx`, `mkdir` / `writeFile` for hooks files). Use a `(unavailable) {unsupported hooks}` row as the carrier: a malformed-or-unsupported hooks file flips `installable: false` and the lenient reader provides the per-event detail.

Case A (single `Stop`-only unsupported event):
  - Manifest: `plugins: [{ name: "ralph", source: "./ralph", version: "0.1.0" }]`.
  - Seed `<mpRoot>/ralph/hooks/hooks.json` with the exact ralph-loop shape: `{ "hooks": { "Stop": [{ "hooks": [{ "type": "command", "command": "echo stop" }] }] } }`.
  - Assert `notifications.length === 1`.
  - Assert the message includes `(unavailable) {unsupported hooks}`.
  - Assert the message includes the lines (in order, after the marketplace + plugin row):
        `    hooks:`
        `      Stop (unsupported)`

Case B (mixed `PostToolUse` + `Stop` on an unavailable row):
  - Same manifest pattern, plugin name `mixed`.
  - Seed `hooks/hooks.json` with `{ "hooks": { "PostToolUse": [{ "matcher": "Bash", "hooks": [{ "type": "command", "command": "echo p" }] }], "Stop": [{ "hooks": [{ "type": "command", "command": "echo s" }] }] } }`.
  - The plugin still flips `(unavailable) {unsupported hooks}` because the strict resolver-side parser trips on `Stop`.
  - Assert the `hooks:` block lists BOTH events in declaration order:
        `    hooks:`
        `      PostToolUse`
        `      Stop (unsupported)`
  - Rationale for `PostToolUse` rendering as bare `PostToolUse` (no matcher): the LENIENT reader does not extract matchers — it only enumerates event keys. That is correct behavior for the rejected-by-resolver code path: we are showing the user what is declared, not synthesizing a partial resolver projection.

Case C (invalid JSON suppresses the `hooks:` block on the unavailable row):
  - Manifest + seed pattern as Case A but write `"{ not valid json"` to `hooks/hooks.json`.
  - Assert `(unavailable) {unsupported hooks}` present (existing behavior — preserves the regression guard).
  - Assert `assert.doesNotMatch(msg, /hooks:/)`.

Case D (no `hooks/hooks.json` at all on the unavailable row):
  - This is harder to construct: an unavailable row without a hooks file must trip on something else. Use the persistence-vs-disk disagreement path: seed `installed: { foo: { version: "0.1.0" } }` so the plugin is in state, then mark the plugin manifest entry's source as path-resolvable but seed NO plugin directory (so the resolver bails on missing `plugin.json` / pluginRoot probe). Alternatively, REMOVE this case if it duplicates an existing one — the lenient reader's "no file" path is already implicitly exercised by Case C (no hooks bucket emitted), AND by the existing INFO-05 test at `info.test.ts:1639` (`(installed) {unsupported hooks}` with on-disk skills/commands but unparseable hooks). The latter ALREADY exercises the "lenient reader returns undefined" path; if its expected output still passes after Task 2, Case D is redundant. RECOMMENDED: SKIP Case D entirely.

Case E (resolver-success path with valid `hooks.json` is regression-guarded by the existing `info.test.ts:1327` test): no new test needed; the existing test must continue to pass byte-identical after Task 1's renderer change (the rich tool-event arm and non-tool-event arm are untouched).

**`tests/shared/notify-v2.test.ts`** — append ONE new renderer-level case (around `notify-v2.test.ts:3063`, after the existing SURF-02 cluster). The case fixtures a `PluginInfoMessage` with a `hooks: HookSummaryEntry[]` containing TWO lenient entries:
  - `{ kind: "lenient", event: "Stop", groupCount: 1, supported: false }`
  - `{ kind: "lenient", event: "PostToolUse", groupCount: 1, supported: true }`

Assert the rendered output includes:
        `    hooks:`
        `      Stop (unsupported)`
        `      PostToolUse`

Rationale: this byte-locks the renderer's lenient-arm behavior at the unit level, independent of the orchestrator-level cases in `info.test.ts`. It also documents that `supported: true` lenient entries render bare (no suffix), so a future change to the lenient reader that emits bucket-A events (e.g. for a partially-rejected hooks file) does not accidentally suffix them.

Comment-policy on the new test bodies (`describe` / `test` titles + body comments):
  - Use the existing `SURF-02` traceability ID as the anchor (the lenient arm extends the SURF-02 type seam).
  - NO `Phase NN`, `Plan NN`, `Wave N`, `Pitfall N`, `milestone vX.Y` references.
  - Test titles follow the existing convention: `SURF-02: lenient `HookSummaryEntry` arm renders `<event> (unsupported)` when supported=false, bare `<event>` when supported=true`.
  </action>
  <verify>
    <automated>cd /home/acolomba/pi-claude-marketplace &amp;&amp; npm run check</automated>
  </verify>
  <done>
`npm run check` passes (typecheck + ESLint + Prettier + node:test). The new info.test.ts cases (A, B, C) pass; the existing `info.test.ts:1327` (resolver-success `hooks:` block) and `info.test.ts:1639` (`(installed) {unsupported hooks}` with on-disk components) pass unchanged. The new notify-v2.test.ts case asserts the lenient arm's `(unsupported)` suffix byte form. No regressions in the existing 4 SURF-02 renderer tests.
  </done>
</task>

</tasks>

<verification>
- `npm run check` green (typecheck + ESLint + Prettier + tests).
- `git grep -nE "Phase [0-9]|Plan [0-9]|Wave [0-9]|Pitfall [0-9]|milestone v[0-9]" extensions/pi-claude-marketplace/shared/notify.ts extensions/pi-claude-marketplace/orchestrators/plugin/info.ts tests/orchestrators/plugin/info.test.ts tests/shared/notify-v2.test.ts` returns no new matches (existing matches outside the diff are allowed).
- `git status` shows ONLY the four expected files in the staging diff (`shared/notify.ts`, `orchestrators/plugin/info.ts`, `tests/orchestrators/plugin/info.test.ts`, `tests/shared/notify-v2.test.ts`). The pre-existing uncommitted edits to `README.md` and `docs/hooks.md` MUST remain unstaged.
- Manual spot-check against the ralph-loop fixture: `node --test --test-name-pattern="Stop \(unsupported\)" tests/orchestrators/plugin/info.test.ts` passes.
</verification>

<success_criteria>
- Path-resolvable `(unavailable) {unsupported hooks}` rows now carry a `hooks:` block listing every declared top-level event, with `(unsupported)` after each non-bucket-A event name.
- Resolver-success `(installed)` / `(available)` rows render byte-identical output to today (existing 4 SURF-02 tests pass unchanged).
- Resolver-side strict parser (`domain/components/hooks.ts::parseHooksConfig`) is untouched — install correctness preserved.
- No new closed-set tokens introduced in `REASONS` / `STATUS_TOKENS` / `MARKERS`. `(unsupported)` is a visual suffix on a hook-event line, not a `Reason`.
- Single atomic commit on `features/v1.13-hook-bridge`; commit message follows Conventional Commits (`fix(plugin/info): list declared hook events on path-resolvable rows` or similar; body explains the strict-vs-lenient split).
- `pre-commit run --files <changed-files>` clean before `git commit`. Sequential mode — no worktree.
</success_criteria>

<output>
Create `.planning/quick/260618-sgw-list-unsupported-hooks-on-info-rows/260618-sgw-SUMMARY.md` after the commit lands, recording:
  - The strict-vs-lenient split rationale (one paragraph).
  - The `HookSummaryEntry` union extension (the tagged `lenient` arm).
  - The 5 new test cases and the 2 pre-existing regression-guards they leave untouched.
  - The commit SHA.
</output>
