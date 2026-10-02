---
quick_id: 260917-cqc
phase: quick-260917-cqc
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [PRUNE-05]
files_modified:
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
  - tests/orchestrators/plugin/dependency-declaration-read.test.ts
  - tests/orchestrators/plugin/dependency-index.test.ts
  - tests/orchestrators/plugin/uninstall.test.ts
  - docs/dependency-resolution.md
  - docs/output-catalog.md
  - .planning/phases/05-prune-on-uninstall/05-REVIEW-FIX.md

estimate:
  tokens: 90000
  raw_tokens: 90000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "`uninstall X` is refused with `{unreadable}` and a `cause:` line naming the declarer when another installed record's own `plugin.json` exists but cannot be parsed, even though that record's marketplace entry carries no `dependencies` (D-05-07, IN-05 tighten)"
    - "An ABSENT own manifest (no candidate file, cold git clone, refused root) still falls back to the marketplace entry on the dependents index, and a silent entry still reads as `declares nothing` (D-05-06)"
    - "The install cascade's read is byte-for-byte unchanged: without the option a present-but-unusable own manifest still falls back to the entry (D-01-07); `install-flow.ts` is not edited"
    - "The refusal's cause line is a fixed phrase: no absolute path, no manifest text, no `{ cause }` chained (T-05-04)"
    - "`docs/dependency-resolution.md` distinguishes an absent own manifest (entry answers) from a present-but-unreadable one (uninstall refused) and names both remedies"
    - "`05-REVIEW-FIX.md` records IN-05 as fixed with the commit SHA and IN-06 as accepted with the four-part rationale (IN-06 accept)"
  artifacts:
    - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts — `OwnManifestRead` split into `readable | absent | unusable`; `refuseUnusableOwnManifest?: true` option"
    - "extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts — passes the option; header states the tightened rule"
    - "tests/orchestrators/plugin/dependency-index.test.ts — corrupt-own-manifest-beside-silent-entry case"
    - "tests/orchestrators/plugin/dependency-declaration-read.test.ts — option-on unusable rows plus option-on absent negative controls"
    - "tests/orchestrators/plugin/uninstall.test.ts — one REFUSAL_CASES row driven through assertNoDependents"
    - ".planning/phases/05-prune-on-uninstall/05-REVIEW-FIX.md — IN-05 fixed, IN-06 accepted"
  key_links:
    - "dependency-index.ts::readRecordDeclarations -> readDependencyDeclaration({ ..., refuseUnusableOwnManifest: true }) -> `unusable` arm -> unreadableDeclarer(key, read.detail)"
    - "uninstall.ts::assertNoDependents -> buildScopeDeclarationIndex (unchanged) -> UninstallRefusedError(\"unreadable\", cause.message) -> `(failed) {unreadable}` row with `cause:` line"
    - "install-flow.ts::lookupCascadeDependencies -> readDependencyDeclaration WITHOUT the option (untouched)"
---

<objective>
Settle the two open `05-REVIEW.md` design decisions the operator has already made: IN-05 = tighten, IN-06 = accept. Neither decision is re-opened here.

IN-05: the dependents guard (`dependency-index.ts`, consumed by `uninstall.ts::assertNoDependents` and the `--prune` sweep) fails closed on a declarer whose OWN `plugin.json` is present but unusable, instead of letting a silent marketplace entry answer "declares nothing" for it. The read module already tells ABSENT from PRESENT-BUT-UNUSABLE internally but collapses both into one value; the change surfaces the distinction as a third arm and lets the index opt into refusing it. The install cascade keeps the D-01-07 entry fallback unchanged.

IN-06: no code change; `unreadable` stays the refusal token. Recorded as accepted in `05-REVIEW-FIX.md` with the rationale.

Purpose: D-05-07's bar ("deleting on incomplete information is the one outcome this phase must never produce") is stricter than the entry fallback for a corrupt `plugin.json` beside a silent entry; the guard now meets that bar.
Output: two production edits, three test additions, two docs edits, one planning record; two commits.
</objective>

<execution_context>
@/home/acolomba/src/pi-claude-marketplace-manifest/.claude/gsd-core/workflows/execute-plan.md
@/home/acolomba/src/pi-claude-marketplace-manifest/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@/home/acolomba/src/pi-claude-marketplace-manifest/CLAUDE.md
@/home/acolomba/src/pi-claude-marketplace-manifest/skills/typescript-comments/SKILL.md
@/home/acolomba/src/pi-claude-marketplace-manifest/skills/typescript-unit-testing/SKILL.md
@/home/acolomba/src/pi-claude-marketplace-manifest/.planning/phases/05-prune-on-uninstall/05-REVIEW.md
@/home/acolomba/src/pi-claude-marketplace-manifest/.planning/phases/05-prune-on-uninstall/05-REVIEW-FIX.md
@/home/acolomba/src/pi-claude-marketplace-manifest/extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts
@/home/acolomba/src/pi-claude-marketplace-manifest/extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts
@/home/acolomba/src/pi-claude-marketplace-manifest/tests/orchestrators/plugin/dependency-declaration-read.test.ts
@/home/acolomba/src/pi-claude-marketplace-manifest/tests/orchestrators/plugin/dependency-index.test.ts
@/home/acolomba/src/pi-claude-marketplace-manifest/docs/dependency-resolution.md

**Execution environment (observed at planning time):**
- Run everything in THIS checkout, `/home/acolomba/src/pi-claude-marketplace-manifest` (branch `features/manifest`, HEAD `84d36dac`). It is itself a git worktree and has `node_modules`; a nested worktree would not, and `npm run check` could not run there. Do not create a nested worktree.
- No pre-commit hook is installed: run `SKIP=trufflehog pre-commit run --all-files` by hand before each commit; it rewrites files (mdformat, prettier, whitespace fixers), so restage and re-run until it exits 0 with no modifications. Never `--no-verify`.
- The operator has UNCOMMITTED edits in `.claude/settings.json`, `.codex/config.toml`, `.planning/config.json`, `.planning/state.json` and untracked `.claude/CLAUDE.md`, `.codegraph/`, `.mcp.json`, `AGENTS.md`. Never stage those. Never `git add -A` or `git add -u`. Stage explicit paths only.
- Commit messages: Conventional Commits; title <= 72 chars with no GSD phase/milestone mention (use a code scope such as `fix(uninstall):` / `docs(review):`, not `fix(05):`); body lines <= 80 chars; end every commit with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`. Write the message to a file and use `git commit -F` (a backticked token in `-m` is executed by the shell).
- Comment policy (`skills/typescript-comments`): comments state present-tense facts; no "the former X", "no longer", "used to"; cite D-NN / T-NN / requirement IDs, never phase/plan/wave numbers.
- The retired-vocabulary doc sweep (`tests/architecture/partial-vocabulary-guard.test.ts`) scans `docs/output-catalog.md`: do not introduce the word `force`/`forced` in new prose.

**Mechanism as it stands (dependency-declaration-read.ts):** `parseOwnManifest` returns `NOT_READABLE` on a parse throw or non-object payload; `readManifestCandidate` returns `undefined` for ENOENT/ENOTDIR or a non-regular file (walk continues) and `NOT_READABLE` for any other errno; `readOwnManifest` returns `NOT_READABLE` when the walk ends with nothing; `readDependencyDeclaration` maps a `pluginRoot === undefined` (containment refusal, cold clone, npm/unknown source) to `NOT_READABLE` too, then `own.kind === "readable" ? own.dependencies : options.entry.dependencies`. So ABSENT and PRESENT-BUT-UNUSABLE are distinguishable at their origin but collapse before the fallback decision.

**Consumers of `readDependencyDeclaration`:** `dependency-index.ts::readRecordDeclarations` (the guard; gets the option), `install-flow.ts::lookupCascadeDependencies` (the cascade; NOT touched), `tests/architecture/manifest-read-agreement.test.ts` (option-off; unchanged).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED — add the three test cases and observe them fail on the current code</name>
  <files>tests/orchestrators/plugin/dependency-declaration-read.test.ts, tests/orchestrators/plugin/dependency-index.test.ts, tests/orchestrators/plugin/uninstall.test.ts</files>
  <behavior>
    - dependency-declaration-read (option on, present-but-unusable): a `{ truncated` first candidate, an `EACCES` stat on the first candidate, and a JSON-array payload each yield `{ kind: "unusable", detail: "its own manifest is present but cannot be read" }` and open only WRAPPED, with the entry declaring `["from-entry@mp"]` so a wrong fallback changes the answer
    - dependency-declaration-read (option on, absent — negative control): no candidate present (opened `[WRAPPED, BARE]`) and a containment-refused root `../outside` (opened `[]`) both still yield `dependsOn("from-entry")`
    - dependency-declaration-read (option off): every existing case stays exactly as it is
    - dependency-index: a corrupt `plugin.json` for `helper` beside a silent `helper` entry ends the walk with `ok: false`, `declarer: "helper@mp"`, message `cannot read the dependencies of helper@mp: its own manifest is present but cannot be read`, and `cause.cause === undefined`
    - uninstall (owner suite): `uninstall helper@mp` in a scope whose `other@mp` record has a corrupt on-disk `plugin.json` and a silent entry renders `⊘ helper v0.0.1 (failed) {unreadable}` with `cause: cannot read the dependencies of other@mp: its own manifest is present but cannot be read`, at error severity, no reload hint, state bytes and mtime untouched, data dir kept
  </behavior>
  <action>
Per D-05-07 (IN-05 tighten) and the project TDD convention, write all three test additions FIRST and run them against the unchanged production code. All three files use top-level `test()` (no `describe`), so the `tdd-red-evidence` checker can read the TAP names; keep the new cases top-level too.

1. `tests/orchestrators/plugin/dependency-declaration-read.test.ts`. Add a sibling of `readWithFake` (for example `readRefusingUnusable(entry, fake)`) that calls `readDependencyDeclaration` with the same four fields plus `refuseUnusableOwnManifest: true`. Do not add a boolean parameter to `readWithFake`. Then add two data-driven blocks, one top-level `test()` per row with the row label interpolated into the title, `// arrange` / `// act` / `// assert` markers, and `entryWith("./alpha", ["from-entry@mp"])` as the entry:
   - `D-05-07: with refuseUnusableOwnManifest, ${label} is the unusable arm, not the entry` — rows: `{ truncated` at WRAPPED (parse throw); `errno("EACCES")` at WRAPPED (stat failure); the JSON-array payload `["helper@mp"]` at WRAPPED. Give every row a BARE sibling declaring `from-bare@mp` so the assertion also proves the walk stopped. Assert `deepStrictEqual(result, { kind: "unusable", detail: "its own manifest is present but cannot be read" })` and `deepStrictEqual(fake.opened, [WRAPPED])`.
   - `D-05-06: with refuseUnusableOwnManifest, ${label} still falls back to the entry` — rows: no candidate present (`files: {}`; expect opened `[WRAPPED, BARE]`); a containment-refused root (`entryWith("../outside", ...)`, with the escaped root's own candidate declaring `escaped@mp` exactly as the existing NFR-10 case does; expect opened `[]`). Assert `dependsOn("from-entry")`. These rows pass before AND after the change; that is what makes them a negative control, and it is expected.
   Leave every existing option-off case untouched.

2. `tests/orchestrators/plugin/dependency-index.test.ts`. Add `D-05-07: a corrupt own manifest beside a silent entry ends the walk naming the record`: `loadManifest` answers `manifestOf("mp", { app: {}, helper: {}, paused: {} })`; `reader` is `ownManifests({ [path.join(MP.marketplaceRoot, "plugins", "helper", ".claude-plugin", "plugin.json")]: "{ truncated" })`; `exclude: "app@mp"`. Assert `result.ok === false` and then one `deepStrictEqual` over `{ declarer, message: result.cause.message, cause: result.cause.cause }` against `{ declarer: "helper@mp", message: "cannot read the dependencies of helper@mp: its own manifest is present but cannot be read", cause: undefined }` — the `cause: undefined` field is the T-05-04 no-chaining proof for the new arm, mirroring the existing T-05-04 case.

3. `tests/orchestrators/plugin/uninstall.test.ts`. Extend `DeclaringSeed` (near line 4818) with an optional `ownManifest?: string` field documented as the raw bytes written as the plugin's own manifest in place of the JSON the seed derives, so a case can plant a present-but-unusable file (D-05-07). In `seedDeclaringScope`, write `seed.ownManifest ?? JSON.stringify({ name: plugin, version: "1.0.0", ...declared })`. Add one `REFUSAL_CASES` row: title `D-05-07: a record whose own manifest is present but unreadable refuses the uninstall`; `plugins: { helper: {}, other: { ownManifest: "{ truncated" } }`; `expectedRow: "⊘ helper v0.0.1 (failed) {unreadable}"`; `expectedCause: "cannot read the dependencies of other@mp: its own manifest is present but cannot be read"`. The existing loop body already asserts the notification bytes, error severity, untouched state bytes/mtime and the kept data dir.

4. Run the three files with `node --test` (commands in verify) and save the raw TAP to the scratchpad (`/tmp/claude-1000/-home-acolomba-src-pi-claude-marketplace-manifest/7631d438-251e-42d9-be09-a9306d75fd3a/scratchpad/red-*.tap`) so the SUMMARY can quote it verbatim. `tsc` is red at this point because `refuseUnusableOwnManifest` is not on the options type yet; Node strips types at run time, so `node --test` is the red evidence and `npm run typecheck` is not run in this task.
  </action>
  <verify>
    <automated>cd /home/acolomba/src/pi-claude-marketplace-manifest && node --test tests/orchestrators/plugin/dependency-index.test.ts; node --test tests/orchestrators/plugin/dependency-declaration-read.test.ts; node --test tests/orchestrators/plugin/uninstall.test.ts</automated>
  </verify>
  <done>
Expected RED state, exactly: (a) dependency-index — the new case is `not ok` with an AssertionError at `assert.equal(result.ok, false)` (`true !== false`: the silent entry answered "declares nothing"); every other case `ok`. (b) dependency-declaration-read — the three `D-05-07: with refuseUnusableOwnManifest ...` rows are `not ok` with a deepStrictEqual diff showing the actual `{ kind: "found", dependencies: [{ name: "from-entry", marketplace: "mp" }] }`; the two `D-05-06: with refuseUnusableOwnManifest ...` negative-control rows are `ok`; every existing case `ok`. (c) uninstall — the new row is `not ok` with the notifications deepStrictEqual showing the actual success block (`○ helper v0.0.1 (uninstalled)` plus the reload hint) instead of the refusal; every other case `ok`. Five `not ok` lines in total, raw TAP saved to the scratchpad.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — split the own-manifest read, add the index-only refusal option, rewrite the headers and the docs, gate, commit</name>
  <files>extensions/pi-claude-marketplace/orchestrators/plugin/dependency-declaration-read.ts, extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts, docs/dependency-resolution.md, docs/output-catalog.md</files>
  <behavior>
    - The five Task 1 `not ok` cases are `ok`; the negative controls and every pre-existing case stay `ok`
    - `tests/architecture/manifest-read-agreement.test.ts` (option-off, cascade shape) stays green
    - `npm run test:coverage:direct:commit` reports 100% direct function/line/branch coverage on both changed production files from their own paired tests
    - `git diff --quiet HEAD -- extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts` exits 0 (cascade untouched)
  </behavior>
  <action>
Implement IN-05 (tighten) per D-05-07 with the mechanism the brief fixes; the cascade rule D-01-07 stays as it is.

1. `dependency-declaration-read.ts`:
   - Split `OwnManifestRead` into three arms: `{ kind: "readable"; dependencies: unknown }`, `{ kind: "absent" }`, `{ kind: "unusable" }`. Replace the single frozen module-scope constant with two (`ABSENT`, `UNUSABLE`), keeping the S7737 module-scope-constant pattern. `parseOwnManifest` returns `UNUSABLE` on a parse throw or a non-object payload. `readManifestCandidate` keeps `undefined` as its only continue-the-walk answer (ENOENT, ENOTDIR, not a regular file) and returns `UNUSABLE` for every other errno; it never produces the `absent` arm itself. `readOwnManifest` returns `ABSENT` when the walk ends with nothing. In `readDependencyDeclaration`, a `pluginRoot === undefined` (containment refusal, syscall refusal, cold clone, npm/unknown source) is `ABSENT`.
   - Add to `DependencyDeclarationReadOptions` the field `readonly refuseUnusableOwnManifest?: true` with a doc comment: D-05-07 — the dependents index sets it so a present-but-unusable own manifest is answered as the `unusable` arm instead of by the entry; the install cascade omits it and keeps the D-01-07 entry fallback. (`exactOptionalPropertyTypes` is on, so the type is `true | undefined`; compare explicitly, matching the file's `!== undefined` style.)
   - In `readDependencyDeclaration`, before the fallback line: when `own.kind === "unusable"` and the option is set, return `{ kind: "unusable", detail: "its own manifest is present but cannot be read" }` — a fixed phrase, no path, no manifest text, no `{ cause }` (T-05-04; `dependency-index.ts` wraps it as `cannot read the dependencies of <key>: <detail>`). Otherwise the existing `own.kind === "readable" ? own.dependencies : options.entry.dependencies` line stands, so option-off behaviour is byte-for-byte unchanged. Extend the function's doc comment with one sentence naming the option and D-05-07.
   - Amend the D-01-06 / D-01-07 header paragraph (currently the sentence beginning "A present-but-unusable manifest therefore falls back to the entry ..."): state that the entry fallback for a present-but-unusable manifest is the CASCADE's rule (D-01-07), that the dependents index opts into refusing such a manifest through `refuseUnusableOwnManifest` (D-05-07), and that under neither rule is it read as a plugin that declares nothing, because that distinction is what stops a truncated or corrupted manifest from silently suppressing a dependency the plugin really declares. Update the `OwnManifestRead` and `parseOwnManifest` doc comments to name the three arms. Present-tense facts only; no narration of the prior shape.

2. `dependency-index.ts`:
   - In `readRecordDeclarations`, pass `refuseUnusableOwnManifest: true` to `readDependencyDeclaration`. The `read.kind === "unusable"` arm already maps to `unreadableDeclarer(key, read.detail)`; no other code change.
   - Rewrite the header paragraph that currently opens "The fallback is part of that read, not an exception to it" (lines ~30-36) so it states the tightened rule: an ABSENT own manifest — no candidate file, a cold git clone, a refused root — is answered by the marketplace entry (D-05-06), and an entry with no `dependencies` key answers "declares nothing"; a PRESENT-BUT-UNUSABLE own manifest fails closed through `refuseUnusableOwnManifest` (D-05-07), because a damaged file may hide a dependency the plugin really declares; the cascade keeps its own entry fallback (D-01-07). Drop the closing sentence that records the tightening as an open option. No "the former", no "no longer".
   - In the `ScopeDeclarationIndexResult` doc comment, add the fourth reason to the "why it could not be read" list: its own manifest is present but cannot be read.

3. `docs/dependency-resolution.md`, paragraph beginning "The check reads the declarations of every other installed plugin" (~line 140). Replace the two sentences "A declaration cannot be read when ... cannot be used." and "If only the plugin's own manifest cannot be read, ... declares nothing." with prose that (a) lists four conditions — the marketplace no longer lists the plugin, the marketplace manifest itself is unreadable, the `dependencies` value cannot be used, the plugin's own manifest file exists but cannot be read; (b) says a plugin with NO manifest file of its own (for example a git plugin whose clone is not on disk) is answered by its marketplace entry, and an entry with no `dependencies` value means the plugin declares nothing; (c) says a manifest file that exists but cannot be read never counts as one that declares nothing, because a damaged file may hide a dependency the plugin really declares. Amend the remedy sentence so it reads: uninstall the plugin that cannot be read first (the check never reads the plugin being removed), or repair its manifest file if it should stay, or update the marketplace so the manifest lists it again; a stale marketplace is removed instead. Keep the doc's plain-English register (`simple-english` Plain mode: short sentences, active voice, one idea per sentence; `humanizer` rules: no inflated or stock AI phrasing). Do not touch the failure-reason table (`tests/architecture/dependency-doc-agreement.test.ts` gates it and it is unchanged).

4. `docs/output-catalog.md`, the `### Failure -- refused, a declarer could not be read (D-05-07)` prose above `<!-- catalog-state: refused-declarer-unreadable -->`. The exact fallback claim is not present there, but the trigger list and the cause-trailer list are now incomplete: add "or its own manifest is present but cannot be read" to the trigger enumeration, add the same case to the parenthetical list of cause-trailer reasons, and add "repair its own manifest" beside `marketplace update` in the remedy sentence. Do NOT change the fenced example block: `EXPECTED_UTF8_BYTES` (28_543) and `EXPECTED_STATE_COUNT` (212) in `tests/architecture/catalog-uat/catalog-contract.test.ts` are locked over the rendered examples, and no rendered byte changes.

5. Gate and commit. Run the three `node --test` files (all green), `npm run test:coverage:direct:commit` (must show 100% direct coverage for both changed production files; edit `scripts/test-coverage-direct.pin.json` ONLY if the gate reports a shortfall that cannot be reached through the public entry point — none is expected, and a pin edit must be justified in the SUMMARY), `npm run check` (exit 0), then `SKIP=trufflehog pre-commit run --all-files` (exit 0; restage and re-run if it rewrites files). Stage exactly the seven paths of Tasks 1 and 2 (two production files, three test files, two docs files) and commit with a title such as `fix(uninstall): refuse when a declarer's own manifest cannot be read`, a body (<= 80 cols) stating the absent-vs-unusable split, the index-only option, the unchanged cascade, and citing D-05-06 / D-05-07 / D-01-07 / IN-05, ending with the Co-Authored-By trailer. Record the commit SHA for Task 3.
  </action>
  <verify>
    <automated>cd /home/acolomba/src/pi-claude-marketplace-manifest && node --test tests/orchestrators/plugin/dependency-index.test.ts tests/orchestrators/plugin/dependency-declaration-read.test.ts tests/orchestrators/plugin/uninstall.test.ts tests/architecture/manifest-read-agreement.test.ts && npm run test:coverage:direct:commit && git diff --quiet HEAD -- extensions/pi-claude-marketplace/orchestrators/plugin/install-flow.ts && grep -c "refuseUnusableOwnManifest: true" extensions/pi-claude-marketplace/orchestrators/plugin/dependency-index.ts && npm run check && SKIP=trufflehog pre-commit run --all-files</automated>
  </verify>
  <done>
All five Task 1 cases are `ok` and the two negative controls and every pre-existing case stay `ok`; `manifest-read-agreement` stays green; direct coverage is 100% on both changed production files with the pin file untouched (or a justified edit); `install-flow.ts` has no diff; `npm run check` and `SKIP=trufflehog pre-commit run --all-files` both exit 0; one commit exists containing exactly the seven code/test/doc paths, with a Conventional Commits title free of GSD phase/milestone mentions and the Co-Authored-By trailer; `git status` shows the operator's unrelated edits still unstaged and untouched.
  </done>
</task>

<task type="auto">
  <name>Task 3: Record IN-05 as fixed and IN-06 as accepted in 05-REVIEW-FIX.md, commit</name>
  <files>.planning/phases/05-prune-on-uninstall/05-REVIEW-FIX.md</files>
  <action>
Append to `.planning/phases/05-prune-on-uninstall/05-REVIEW-FIX.md` (use Edit, not Write; leave the iteration-1 frontmatter and summary as they stand — they describe iteration 1 truthfully). Insert a new section after `## Skipped Issues` / `None.` and before the trailing `---` footer, titled `## Operator decisions settled (2026-09-17)`, with two entries:

- **IN-05: fixed.** Cite the Task 2 commit SHA and list the files it touched. State the applied change in two or three sentences: `OwnManifestRead` now has `readable | absent | unusable` arms; `readDependencyDeclaration` takes an index-only `refuseUnusableOwnManifest` option under which a present-but-unusable own manifest is returned as the RESV-02 `unusable` arm with the fixed detail `its own manifest is present but cannot be read`; `dependency-index.ts` passes the option, so `assertNoDependents` and the `--prune` sweep fail closed on it; the install cascade omits the option and keeps the D-01-07 entry fallback unchanged. Name the three test cases added (by title) and the two docs paragraphs amended. Record the accepted cost explicitly: a corrupt or unreadable `plugin.json` in ONE plugin now holds every other plugin's uninstall in that scope until the file is repaired or that plugin is uninstalled — the same D-05-07 cost already accepted for an unreadable marketplace manifest; the remedy is documented in `docs/dependency-resolution.md` and the catalog state `refused-declarer-unreadable`.
- **IN-06: accepted, no code change.** Rationale, all four parts: (1) `unreadable` is a truthful existing closed-set member ("we could not read on-disk state" makes no claim about the target's manifest); (2) the cause line always names the declarer on both the command surface and the reconcile surface (D-05-16); (3) a grep of `extensions/` finds no consumer branching on the bare reason value — run `grep -rn '"unreadable"' extensions/` and note the hits are the two stamp sites in `uninstall.ts` plus the closed-set catalog, none of which branches on it; (4) `05-CONTEXT.md` prefers reusing an existing member over a ten-surface closed-set amendment. Re-open trigger: a programmatic consumer of the bare reason value appears.

Then run `SKIP=trufflehog pre-commit run --all-files` (only the whitespace/EOF hooks apply to `.planning/`; the npm hooks re-run against the already-committed code and must stay green), stage ONLY `.planning/phases/05-prune-on-uninstall/05-REVIEW-FIX.md`, and commit with a title such as `docs(review): settle IN-05 as fixed and IN-06 as accepted` (no phase/milestone mention in the title; the file path may appear in the body), ending with the Co-Authored-By trailer.
  </action>
  <verify>
    <automated>cd /home/acolomba/src/pi-claude-marketplace-manifest && FIX_SHA=$(git rev-parse --short HEAD~1) && TITLE=$(git log -1 --format=%s) && grep -n "IN-05: fixed\|IN-06: accepted" .planning/phases/05-prune-on-uninstall/05-REVIEW-FIX.md && grep -c "$FIX_SHA" .planning/phases/05-prune-on-uninstall/05-REVIEW-FIX.md && printf '%s\n' "$TITLE" | grep -E '^docs\(' && ! printf '%s\n' "$TITLE" | grep -Eiq 'phase|milestone|05-' && SKIP=trufflehog pre-commit run --all-files</automated>
  </verify>
  <done>
`05-REVIEW-FIX.md` carries a dated section with `IN-05: fixed` citing the Task 2 commit SHA and the accepted-cost sentence, and `IN-06: accepted` with all four rationale parts and the re-open trigger; the iteration-1 frontmatter and summary are unchanged; pre-commit exits 0; a second commit contains only that file, its title starts with `docs(` and names no phase or milestone; the operator's unrelated edits remain unstaged.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| plugin-authored `plugin.json` bytes on disk -> the dependents guard | untrusted manifest text enters the read; a damaged or hostile file must never widen what the guard removes, and nothing from it may reach the rendered row |
| guard result -> `ctx.ui.notify` cause line | the refusal's `cause:` line is user-visible; it must carry only `name@marketplace` keys and fixed phrases |

## STRIDE Threat Register

The phase register lives in `.planning/phases/05-prune-on-uninstall/05-SECURITY.md`; the rows below reference it and add only what the tightening changes. ASVS level 1, block-on `high`; no row here reaches `high`.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-05-04 | Information disclosure | the new `unusable` detail on the refusal cause line | medium | mitigate | the detail is the fixed phrase `its own manifest is present but cannot be read`: no absolute path, no manifest text, no `{ cause }` chained; proven by the Task 1 dependency-index case asserting the exact message and `cause.cause === undefined` |
| T-05-05 | Elevation of privilege | own-manifest reads under uninstall | medium | mitigate | no new path construction: plugin roots still come from `path.resolve` + `assertPathInside` (path source) or the warm-cache presence probe (git source); a refused root stays the `absent` arm; `dependency-index.ts` still contains no `join(` |
| T-05-01 / T-05-08 | Denial of service | a crafted `dependencies` array | medium / low | accept (unchanged) | hold-only direction preserved: the option can only ADD a refusal, never a removal; AR-05-01 / AR-05-04 stand |
| T-05-15 | Denial of service | a corrupt or unreadable `plugin.json` in one installed plugin | low | accept | that plugin now holds every other plugin's uninstall in its scope until the file is repaired or the plugin is uninstalled (the uninstall target is never indexed, so `uninstall <declarer>` always passes); this is the same D-05-07 cost already accepted for an unreadable marketplace manifest, chosen by the operator over the silent-entry fallback because the alternative is a removal on incomplete information; the install cascade is not held (option omitted); remedy documented in `docs/dependency-resolution.md` and catalog state `refused-declarer-unreadable`; recorded in `05-REVIEW-FIX.md` IN-05 |
| T-05-SC | Tampering | npm/pip/cargo installs | n/a | n/a | this task installs no package; the package-legitimacy gate is not triggered |
</threat_model>

<verification>
- Red evidence: Task 1 TAP shows exactly five `not ok` lines (1 index case, 3 option-on read rows, 1 uninstall row) against HEAD `84d36dac`, with the two negative-control rows `ok`; the raw TAP is quoted in the SUMMARY (top-level names only, no `describe` nesting).
- Green: the same three files plus `tests/architecture/manifest-read-agreement.test.ts` pass; `npm run test:coverage:direct:commit` reports 100% direct coverage on `dependency-declaration-read.ts` and `dependency-index.ts`; `npm run check` exits 0; `SKIP=trufflehog pre-commit run --all-files` exits 0 before each of the two commits.
- Scope: `git diff HEAD~2 --stat` (after both commits) lists exactly the eight paths in `files_modified` (plus `scripts/test-coverage-direct.pin.json` only if a justified pin edit was needed); `install-flow.ts` is not in it; the operator's `.claude/settings.json`, `.codex/config.toml`, `.planning/config.json`, `.planning/state.json` and the untracked files are not in either commit.
- Docs: `docs/dependency-resolution.md` no longer states the own-manifest entry fallback as unconditional; the failure-reason table is byte-identical; `docs/output-catalog.md`'s `refused-declarer-unreadable` example block is byte-identical (catalog byte lock 28_543 / 212 states unchanged).
</verification>

<success_criteria>
- A corrupt `plugin.json` beside a silent marketplace entry refuses `uninstall` of any other plugin in the scope with `{unreadable}` and a `cause:` line naming the declarer and the fixed detail, on the command surface (owner-suite case) and therefore on the reconcile surface (same `assertNoDependents` path, D-05-16).
- An absent own manifest still falls back to the entry on the index; the cascade's read is unchanged in code and in every option-off test.
- Both gates green; two Conventional Commits with the required trailer; `05-REVIEW-FIX.md` records IN-05 fixed (commit cited) and IN-06 accepted (four-part rationale, re-open trigger).
</success_criteria>

<output>
Write `/home/acolomba/src/pi-claude-marketplace-manifest/.planning/quick/260917-cqc-tighten-dependents-guard-on-unusable-own/260917-cqc-SUMMARY.md` when done. It must quote the raw Task 1 TAP `not ok` lines verbatim as the red evidence (the `tdd-red-evidence` checker reads top-level TAP names only; do not restructure into `describe` blocks), name both commit SHAs, state the direct-coverage readings for the two production files, and say explicitly whether `scripts/test-coverage-direct.pin.json` was touched and why.
</output>
