# Phase 102: Workflow naming and script admission - Context

**Gathered:** 2026-08-14
**Status:** Ready for planning

<domain>
## Phase Boundary

Every workflow script discovered by Phase 101's resolver either resolves to the
command name Claude itself would give it, or is refused with a stated reason --
decided statically from source text, before anything is written, and never by
running the script.

This phase is a **pure decision layer**. It ends where the verdict ends: given a
plugin name, a file name and the script's source, it answers "admit under this
name" or "refuse for this reason". It writes nothing, stages nothing, and reads
no directory. Materialization, the `bridges/workflows/` triplet, the JSON
envelope and the `warnings[]` plumbing are Phase 103. The `workflow_control`
probe and the degradation reason token are Phase 105.

</domain>

<decisions>
## Implementation Decisions

### Module placement and the 102-to-103 seam

- Both the `meta` extractor and the engine pre-validator live in **one new pure
  module, `domain/workflow-script.ts`**. Both are pure functions over a source
  string with no disk and no network, which is exactly what `domain/` is for.
  `bridges/workflows/` does not exist until Phase 103, so placing them there
  would mean creating a bridge directory this phase cannot use.
- This phase delivers a **pure admission decision**:
  `(pluginName, fileName, source) -> verdict`. Phase 102 owns the decision and
  its tests; Phase 103 wires it into discover/stage and routes the refusal
  reasons into the bridge's `warnings[]` channel. No skeletal bridge file is
  created now.
- The AST walk also extracts **`meta.description`** and returns it alongside
  `name`. WBRG-01's envelope needs it in Phase 103; parsing a second time there
  would be waste, and re-editing this walk would be churn. Phase 102 itself does
  not consume the description.
- The name collision (WNAM-05) renders the same message as
  `assertNoCommandCollisions` (`bridges/commands/stage.ts:77`) -- generated name
  followed by the bracketed list of offending sources.

  **Amended after code review.** This decision originally called for a plain
  `Error`, on the reasoning that nothing narrows on it via `instanceof`. That
  holds for commands, where the discover path first-wins-dedups before the assert
  runs and the collision is unreachable in practice. For workflows the collision
  IS reachable, and the install surface renders each one through `notify()` --
  which with a plain `Error` means recovering the offenders by parsing prose,
  the message-substring coupling the project's typed-error convention exists to
  forbid. `WorkflowNameCollisionError` (`shared/errors.ts`) now carries the
  collision groups as readonly fields and builds the message from those same
  fields, so the rendering and the data cannot drift. WNAM-05's "mirroring" is
  satisfied by identical behavior and identical message text.

### Extractor outcomes and collision scope

- The extractor returns a **discriminated union over a closed outcome
  discriminant**: `named` / `stem-fallback` / `skipped` / `refused`. The spike
  prototype's free-form `reason` strings do not survive into production -- the
  caller must branch exhaustively, which is the codebase's union + `assertNever`
  idiom.
- `export const meta = someFactory()` -- **`meta` declared but not an object
  literal** -- is **`skipped`**, identical to no `meta` at all. Roadmap SC 2 does
  not name this case, so it is decided here: the name is unreadable, and a stem
  fallback would install a possibly-wrong command name, which is the precise
  failure WNAM-01 exists to prevent.
- An **unparseable script (`refused`) skips the file, not the plugin**. The
  remaining workflows and the plugin still install. This mirrors WVAL-02 and the
  Core Value's "degradation never blocks the install": one broken file in a
  twenty-script plugin must not block the other nineteen.
- An **individually unsafe `meta.name`** -- one that throws out of
  `assertSafeName`, such as `"a/b"`, `"."`, a >128-character name or an untrimmed
  one -- is a **per-file refusal, not a throw**. The `assertSafeName` throw must
  not escape the verdict function. WVAL-02's principle governs: one broken file
  in a twenty-script plugin must not block the other nineteen. The collision is
  different in kind -- it is a defect of the *set*, not of one file, and refusing
  one arbitrary member would be the silent misnaming WNAM-05 exists to prevent.
- **Collision detection runs over the whole plugin's discovered set, before any
  dedup, and hard-errors.** This deliberately **diverges** from the commands
  bridge: `discoverPluginCommands` first-wins-dedups by generated name (D-07)
  before `assertNoCommandCollisions` ever sees the set, which makes that assert
  unreachable from the discover path in practice. For commands a clash can only
  arise from prefix elision, which the two filenames make legible. For workflows
  the clash comes from `meta.name`, so neither filename reveals it, and silently
  keeping the first is exactly the silent misnaming WNAM-05 forbids.

### Pre-validation fidelity and the rejection message

- The engine's determinism blocklist is **vendored as a copy**, not imported.
  `@quintinshaw/pi-dynamic-workflows` is absent from `node_modules` and is a
  runtime-probed soft dependency -- there is nothing to import from. The regex
  becomes a named constant whose comment records the measured engine version
  (3.5.1) and that it copies a private internal.
- **Only `DETERMINISM_BLOCKLIST` is replicated**, not the rest of
  `parseWorkflowScript`. It is the only text-level gate that was measured; the
  remainder of that function is acorn parsing the extractor already performs.
  Replicating unmeasured 0.x internals would invent failure modes.
- WVAL-03's "real reason" is produced from the **AST already in hand**: collect
  comment ranges via acorn's `onComment`, plus string-literal ranges from the
  tree, then test whether the blocklist match index falls inside one. A match in
  code and a match confined to a comment are reported as distinct reasons. This
  is the mechanism that stops us repeating the engine's own misattribution.
- A **comment-only match still skips the script**. The engine rejects it
  wholesale either way, so installing it would produce a command that cannot
  run. The code-versus-comment distinction changes only the message, which gains
  the actionable remedy: the host's check is raw text, so rewording the comment
  makes the script load.

### Claude's Discretion

- Exported symbol names, the exact discriminant spelling, and message wording,
  subject to `.claude/rules/typescript-comments.md` (requirement and decision IDs
  stay; planning-artifact references are forbidden).
- Whether the string-literal ranges are gathered during the same walk that finds
  `meta` or by a separate pass, provided one `parse()` call serves both.
- Test file placement and fixture naming, subject to the "extend existing files
  where one fits" habit established in Phase 101.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets

- `domain/name.ts::generatedColonName` (line 90) is the private helper behind
  `generatedCommandName`; it elides a `<plugin>-` prefix and joins with `:`,
  validating the plugin, the elided source and the joined form. WNAM-06 requires
  it reused unchanged, so the workflow generator wraps the same helper rather
  than reimplementing the elision.
- `domain/name.ts::assertSafeName` (line 23) is the RN-2 gate that
  `generatedColonName` already applies at all three points. Colons pass it by
  design, which is why no `:`-sanitizing step is added.
- `bridges/commands/stage.ts::assertNoCommandCollisions` (line 77) is the RN-6
  message template: group by generated name, emit `"gen" <- ["a", "b"]` lines
  joined on `\n  `.
- `.claude/skills/spike-findings-pi-claude-marketplace/sources/026-meta-name-extraction/extract.mjs`
  is a working extractor with a nine-case table, including the decoy-in-comment,
  decoy-in-string and double-quoted-key shapes.
- `acorn` 8.16.0 is already present in `node_modules` transitively via eslint,
  so nothing new is downloaded -- WDOC-03 is a declaration change, and the
  version to declare is the one already resolved.

### Established Patterns

- Discriminated unions carry the decision, and `assertNever` makes every switch
  exhaustive -- the resolver's `installable | partially-available | unavailable`
  is the model.
- Bridges return `{ discovered, warnings }`; soft failures ride `warnings[]` as
  strings and hard failures throw. Phase 102 produces the verdicts that Phase 103
  sorts into those two channels.
- Every exported function declares its return type
  (`@typescript-eslint/explicit-module-boundary-types`), and
  `sonarjs/cognitive-complexity` caps at 15, which matters for an AST walk with
  several early exits.

### Integration Points

- `domain/workflow-script.ts` -- new, the whole of this phase's production
  surface apart from the name generator and `package.json`.
- `domain/name.ts` -- gains a workflow name generator over the existing
  `generatedColonName`.
- `package.json` -- `acorn` moves into `dependencies` as the fourth runtime
  dependency (WDOC-03); `package-lock.json` follows.
- `domain/resolver.ts` -- unchanged. Phase 101 already exposes
  `componentPaths.workflows`; this phase consumes nothing from disk.

### Consequence to check during planning

- The generated name must pass the engine's `isSafeSavedWorkflowName`, including
  its RN-1 prefix elision. Spike 024's `name-interop.mjs` proved this, but the
  engine is not installed, so the check has to be carried as our own assertion
  over the same rule rather than by calling their validator.

</code_context>

<specifics>
## Specific Ideas

- The naming evidence is per-plugin convention, not noise: `agentops` names files
  `<meta.name>.js` (3/3 match) while `paperjury` uses `<name>.workflow.js` (3/3
  diverge). A stem-first implementation misnames every command in the second
  plugin, and a dot passes both `assertSafeName` and `isSafeSavedWorkflowName`,
  so nothing errors. The divergent plugin must be a primary test case.
- `paperjury/workflows/drafter.workflow.js` declares `meta` at line 26 behind a
  twenty-line prose header. That file is the reason the walk must be an AST walk
  and the reason the blocklist match must be classified against comment ranges --
  the same header is what tripped the engine during spike 022a.
- The engine's own rejection message names a rule the script does not violate.
  Reproducing that message would be worse than saying nothing; WVAL-03 exists
  specifically to forbid it.

</specifics>

<deferred>
## Deferred Ideas

- The `bridges/workflows/` discover/stage/unstage triplet, the JSON envelope,
  canonical paths, the NFR-10 root amendment, adjacent staging, and the sixth
  ledger phase -- Phase 103.
- Routing these verdicts into a live `warnings[]` channel and surfacing them to
  the user -- Phase 103.
- Update, uninstall, reinstall and enable/disable parity -- Phase 104.
- The `workflow_control` probe, the third `DEPENDENCIES` member, the new
  `REASONS` token and its catalog entry -- Phase 105.
- Measuring quintinshaw's `agent()` failure semantics (null versus throw), which
  spike 022a left open because driving it needs real spawn machinery -- WDOC-01
  in Phase 105 documents the uncertainty rather than resolving it.

</deferred>
