---
phase: quick-260618-sgw
plan: 01
type: execute
wave: 1
status: complete
commit: 70017c5
branch: features/v1.13-hook-bridge
files_modified:
  - extensions/pi-claude-marketplace/shared/notify.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - tests/orchestrators/plugin/info.test.ts
  - tests/shared/notify-v2.test.ts
---

# Quick task 260618-sgw -- list unsupported hook events on `info` rows

## Strict-vs-lenient split rationale

`info` is an info command. Previously, a path-resolvable
`(unavailable) {unsupported hooks}` row told the user "something about
hooks is wrong" but said nothing about which events were declared. With
this change a user looking at ralph-loop sees `hooks: Stop (unsupported)`
and immediately knows the plugin declares `Stop`, which v1.13 doesn't
support in `BUCKET_A_EVENTS`.

The resolver-side strict parser
(`domain/components/hooks.ts::parseHooksConfig`) is unchanged -- install
correctness (NFR-7 / TOOL-02) is non-negotiable. A NEW best-effort
`readLenientHookSummary` lives in `info.ts` and runs ONLY when the
resolver bailed (`resolved.hooksConfigPath === undefined`). It direct-
parses JSON, duck-types the `{ hooks: { ... } }` envelope, enumerates
declared event keys in declaration order, and tags each with bucket-A
membership. Failures collapse silently to `undefined` (ENOENT, ENOTDIR,
unreadable, unparseable, wrong-shape) -- the row-level
`{unsupported hooks}` brace already carries the user-visible signal on
those paths, and the lenient reader is best-effort augmentation, not a
primary error channel.

NFR-5 preserved: the helper reads only `<pluginRoot>/hooks/hooks.json`
from disk; no network.

## `HookSummaryEntry` union extension

The union gains a third tagged arm:

```ts
| {
    readonly kind: "lenient";
    readonly event: string;
    readonly groupCount: number;
    readonly supported: boolean;
  }
```

`event: string` (not `ClaudeHookEvent`) because the resolver rejected
this key -- it may be `Stop`, `Notification`, or any other token the
plugin author wrote. The `supported` flag carries bucket-A membership.

Renderer change in `appendHooksBlock`: a `"kind" in entry` branch goes
FIRST and emits `      <event>` plus a ` (unsupported)` suffix iff
`supported === false`. The two existing untagged arms (tool / non-tool)
render unchanged. Closed-set tuples (`REASONS`, `STATUS_TOKENS`,
`MARKERS`, `PATTERN_CLASSES`) untouched -- `(unsupported)` is a visual
suffix on a hook-event line, not a `Reason`.

## Tests

Four new tests landed:

1. `INFO-05: lenient reader lists \`Stop (unsupported)\` on a
   path-resolvable \`(unavailable) {unsupported hooks}\` row` --
   ralph-loop fixture shape.
2. `INFO-05: lenient reader lists BOTH events in declaration order on a
   mixed \`PostToolUse\` + \`Stop\` row; only the non-bucket-A one
   carries \`(unsupported)\`` -- proves bucket-A events render bare on
   the rejected-by-resolver path because the lenient reader does not
   extract matchers.
3. `INFO-05: invalid-JSON \`hooks/hooks.json\` suppresses the
   \`hooks:\` block on the \`(unavailable) {unsupported hooks}\` row`
   -- lenient reader returns `undefined`; `appendHooksBlock`'s
   length-zero guard suppresses the header.
4. `SURF-02: lenient \`HookSummaryEntry\` arm renders
   \`<event> (unsupported)\` when supported=false, bare \`<event>\`
   when supported=true` -- unit-level byte-lock at the renderer.

Plan Case D was intentionally skipped (would have duplicated the
implicit "no file" coverage of Case C plus the existing `INFO-05:
(installed) {unsupported hooks}` regression-guard).

Plan Case E (resolver-success path byte-identical) is regression-guarded
by the four existing SURF-02 / D-63-04 tests in `notify-v2.test.ts`
(discriminator, mixed multi-line block, empty hooks, undefined hooks)
and the existing `INFO-05: (installed) {unsupported hooks} path-source
plugin enumerates on-disk skills + commands` test in `info.test.ts`.
All five continue to pass byte-identical.

## Verification

- `npm run check`: passes (typecheck + ESLint + Prettier + node:test +
  integration). The pre-existing `tests/docs/hooks-doc.test.ts` failure
  on `docs/hooks.md ships all 6 worked-example sections` is unrelated
  (caused by user's open uncommitted `docs/hooks.md` edits, out of
  scope per the task prompt).
- `pre-commit run --files <changed files>`: all hooks pass (including
  TruffleHog, prettier, npm lint, npm typecheck).
- Comment-policy grep over the diff: no new `Phase NN`, `Plan NN`,
  `Wave N`, `Pitfall N`, or `milestone vX.Y` tokens introduced.
- Diff is exactly the four expected files; pre-existing uncommitted
  `README.md` / `docs/hooks.md` edits left in the working tree.

## Commit

`70017c5` -- `fix(plugin/info): list declared hook events on
path-resolvable rows` on `features/v1.13-hook-bridge`.

## Self-Check: PASSED

- Files exist: `extensions/pi-claude-marketplace/shared/notify.ts`,
  `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts`,
  `tests/orchestrators/plugin/info.test.ts`,
  `tests/shared/notify-v2.test.ts` (all modified in `70017c5`).
- Commit exists: `git log --oneline | grep 70017c5` confirms.
