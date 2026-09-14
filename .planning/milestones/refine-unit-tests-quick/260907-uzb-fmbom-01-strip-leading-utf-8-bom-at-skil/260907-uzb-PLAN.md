---
phase: 260907-uzb
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - extensions/pi-claude-marketplace/shared/bom.ts
  - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
  - extensions/pi-claude-marketplace/bridges/skills/stage.ts
  - extensions/pi-claude-marketplace/bridges/commands/stage.ts
  - tests/shared/bom.test.ts
  - tests/bridges/agents/frontmatter.test.ts
  - tests/bridges/agents/discover.test.ts
  - tests/bridges/skills/stage.test.ts
  - tests/bridges/commands/stage.test.ts
autonomous: true
requirements: [FMBOM-01]

estimate:
  tokens: 90000
  raw_tokens: 45000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "An agent source file beginning with a UTF-8 BOM yields its name, description, tools and model from frontmatter — not a filename-stem fallback with the fence stranded in the body."
    - "A skill source beginning with a BOM stages as ONE frontmatter block carrying both the generated name and the source description; the source fence is never buried in the body."
    - "No staged skill or command artifact begins with a BOM, on any peer version allowed by the >=0.80.5 floor."
    - "Exactly one leading BOM is stripped; a doubled BOM still fails closed to the no-frontmatter path."
    - "npm run check stays green (typecheck, lint, fallow, prettier, pairing gates, unit, integration)."
  artifacts:
    - extensions/pi-claude-marketplace/shared/bom.ts
    - tests/shared/bom.test.ts
  key_links:
    - "The strip runs BEFORE the parse AND before any rewrite anchored on `^---` (rewrite-frontmatter.ts:69 `startsWith(\"---\")`)."
    - "The stripped string is the same variable later written to the staged artifact, so parsed bytes and staged bytes agree."
    - "shared/ is the only legal home for the helper: fallow boundaries forbid bridges-agents/-skills/-commands importing each other."
---

<objective>
FMBOM-01: a leading UTF-8 BOM silently discards skill and agent frontmatter. Strip
exactly one leading BOM at the read sites so the parse and the staged bytes agree.

Purpose: a BOM'd plugin installs today with its `description` gone and its original
`---` block stranded in the body as literal text the model reads. Nothing self-heals it.
Output: a `shared/stripBom` helper, three one-line read-site strips, and tests that plant
a real BOM through each real read path.

**Scope note — commands (Task 3) is an addition to the backlog entry, DECIDED IN.**
FMBOM-01 names skills and agents. Investigation found `bridges/commands/stage.ts` has the
identical read-parse-writeback shape and the identical defect, so Task 3 applies the same
one-line strip there. The planner raised this as separable; the operator decided on
2026-09-07 to INCLUDE it, and to amend the FMBOM-01 backlog entry to name the commands
bridge so the `FMBOM-01` traceability comment in `commands/stage.ts` cites an entry that
actually covers it. Task 3 is in scope — do not drop it.

The BACKLOG.md amendment is NOT the executor's job: it is a docs edit handled by the
orchestrator in the docs commit, so task commits stay code-only.

**F7 disposition — DECIDED.** The operator chose SUMMARY-only on 2026-09-07: record the
update-vs-reinstall consequence in the SUMMARY as specified in `<output>`, and file no
backlog follow-up. Hashing semantics stay untouched.
</objective>

<context>
@.planning/BACKLOG.md
@CLAUDE.md
@.claude/rules/typescript-comments.md
@extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
@extensions/pi-claude-marketplace/bridges/skills/stage.ts
@extensions/pi-claude-marketplace/bridges/skills/rewrite-frontmatter.ts
@extensions/pi-claude-marketplace/bridges/commands/stage.ts
@extensions/pi-claude-marketplace/platform/pi-api.ts
</context>

<investigation_findings>

Established by reading the code and running the installed peer at planning time
(2026-09-07). Line numbers verified against the working tree, not copied from the
backlog.

**F1 — The installed peer is 0.84.4, and upstream already fixed its own parser.**
`parseFrontmatter` from `@earendil-works/pi-coding-agent@0.84.4` now returns
`{"frontmatter":{"description":"hi"},"body":"body"}` for BOM'd and non-BOM'd input alike.
The backlog's 0.84.2 transcript no longer reproduces. This does NOT retire the item: the
declared peer floor is `>=0.80.5`, so every peer in `0.80.5..0.84.2` still has the broken
parser, and the backlog rejects a floor bump as the fix.

**F2 — The skills corruption does not depend on the peer version at all.** It is caused by
OUR OWN `startsWith("---")` check, not by Pi's parser. `rewriteFrontmatterName`
(`bridges/skills/rewrite-frontmatter.ts:69`) tests `content.startsWith("---")`; a BOM makes
that false, so it takes the `freshBlock()` path. Run against the current 0.84.4 peer:

```text
NO-BOM -> "---\nname: gen-name\ndescription: hi\n---\nbody text"
BOM    -> "---\nname: gen-name\n---\n\n<BOM>---\nname: orig\ndescription: hi\n---\nbody text"
```

The SKILL-03 backstop at `rewrite-frontmatter.ts:78` then parses the RESULT, finds the
generated `name`, and passes — so nothing throws. `description` is gone from the emitted
frontmatter and the source block is body text. This is reproducible today.

**F3 — The agents parser drops everything.** `bridges/agents/frontmatter.ts:110` matches
`/^---\r?\n/` itself. Run against the working tree:

```text
NO-BOM -> {"raw":{"name":"helper","description":"does things","model":"sonnet"},"body":"body text"}
BOM    -> {"raw":{},"body":"<BOM>---\nname: helper\n...\n---\nbody text"}
```

`normalizeBody` (`frontmatter.ts:398`) only strips leading newlines, so the BOM survives in
`body`. `discover.ts:88` then falls back to the filename stem for `sourceName`, and
`convert.ts:465,538,572` carries that polluted `body` verbatim into the emitted agent file.
So the strip belongs at the top of `parseFrontmatter`: it cleans `raw` AND `body`, which is
what the emit path consumes. No separate write-path fix is needed — `convert.ts` assembles
a fresh frontmatter block from `raw`, it never echoes the source fence.

**F4 — A third exposed bridge the backlog does not name: commands.**
`bridges/commands/stage.ts:214` reads, `:222` parses (gate-1), `:245` writes the same
`content` to the staged file. A BOM produces no throw and therefore no CMD-01 degrade, and
the BOM reaches the staged artifact. On a peer below 0.84.3 that artifact's frontmatter is
dead at load time. Same defect class, same one-line fix. See the scope note above.

**F5 — Decision: strip at the read sites, NOT a wrapper at `platform/pi-api.ts:38`.**
Three reasons, in order of weight:

1. A wrapper would break the very contract that file documents. PARSE-01 exists so our
   staging gates "accept/reject bytes with byte-identical semantics to Pi's skill and
   command loaders." A stripping wrapper makes the gate accept bytes that an in-floor Pi
   loader still rejects — the mirror would stop mirroring, which is worse than the bug.
2. A wrapper cannot fix the actual corruption anyway. Skills and commands write `content`
   back out to the staged artifact; the staged bytes are what Pi loads. Fixing only the
   parse leaves the BOM on disk.
3. Per F2 the skills break is in our own `startsWith` check, which no parser wrapper
   reaches.

Stripping at the read site fixes both halves at once — the parse sees clean bytes and the
staged artifact is emitted BOM-free, loadable by every peer in the supported range. This
is also why no peer floor move is needed.

**F6 — No `stripBom` helper exists.** `grep -rn "feff\|BOM\|stripBom" extensions/` finds
only `domain/version.ts:80` (`normalizeBytes`) and the BOM-tolerance comments in
`bridges/agents/discover.ts:52,80`. `normalizeBytes` strips `0xEF 0xBB 0xBF` from a
`Buffer` inside a hashing routine; ours strips `U+FEFF` from a decoded string.
**Do not converge them** — different types, different layer, no behavior gain, and it would
put a hashing path in the blast radius of a parsing fix. Out of scope.

`shared/` is the only legal home for the new helper: fallow's zone boundaries forbid
`bridges-agents`, `bridges-skills` and `bridges-commands` from importing one another, and
all three need it.

**F7 — Hash tolerance: out of scope for code, but state the consequence.** `sourceHash`
hashes raw bytes (`discover.ts:80-83`) and `domain/version.ts::normalizeBytes` strips the
BOM before hashing, so BOTH hashes are already BOM-blind. Nothing in the version layer will
notice that an existing install needs re-staging. `update.ts` therefore takes its
`unchanged` partition and renders `(skipped) {up-to-date}`; only `reinstall` re-stages.
**Do not change hashing semantics** — separate decision, separate blast radius. Record the
operator-facing consequence in the SUMMARY instead: after this ships, an already-installed
BOM'd plugin is repaired by `/claude:plugin reinstall`, not by `update`.

</investigation_findings>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: stripBom helper wired end-to-end through the agents read path</name>
  <files>extensions/pi-claude-marketplace/shared/bom.ts, tests/shared/bom.test.ts, extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts, tests/bridges/agents/frontmatter.test.ts, tests/bridges/agents/discover.test.ts</files>
  <behavior>
    - `stripBom` removes a single leading U+FEFF and returns the rest unchanged.
    - `stripBom` returns input identical when there is no leading U+FEFF.
    - `stripBom` removes only the FIRST of two consecutive leading U+FEFF (the second remains).
    - `stripBom` leaves a U+FEFF that is not at index 0 untouched.
    - `parseFrontmatter` on a BOM-prefixed agent source returns `raw` and `body` deep-equal to the same source without the BOM.
    - `discoverPluginAgents` over a real on-disk `.md` whose first bytes are a BOM resolves `sourceName` from the frontmatter `name`, not the filename stem, and its `body` carries no `---` fence and no U+FEFF.
  </behavior>
  <action>
Create `extensions/pi-claude-marketplace/shared/bom.ts` exporting one function
`stripBom(text: string): string` (explicit return type is required by
`@typescript-eslint/explicit-module-boundary-types`). Implement it as a
`startsWith` test on the single code unit U+FEFF returning `text.slice(1)`, else
`text` — no regex, no loop. Give the module a short header comment and a doc
comment citing FMBOM-01 that states the deliberate single-strip contract: a
doubled marker still fails closed to the no-frontmatter path rather than being
cleaned into a parseable block. Cite only durable IDs; no phase, plan or wave
references (`.claude/rules/typescript-comments.md`).

In `bridges/agents/frontmatter.ts`, rename the `parseFrontmatter` parameter to
`rawText` and add `const text = stripBom(rawText);` as the function's first
statement, so the four existing `text` references in the body need no edit.
Add `import { stripBom } from "../../shared/bom.ts";` — parent-group imports
precede the sibling `./marker.ts` import and take a blank line between groups
(`import-x/order`). Extend the existing FMBOM-01 rationale into the function's
doc comment: a leading marker would otherwise defeat the anchored fence match
and strand the whole block in `body`, which `convert.ts` emits verbatim.

Write `tests/shared/bom.test.ts` — the 1:1 pairing gate (`npm run
test:corresponding`) makes this file mandatory for the new module. Cover the
four helper behaviors above.

Extend `tests/bridges/agents/frontmatter.test.ts` with a parity case: parse a
multi-field source twice, once with a leading marker and once without, and
assert the two results are deep-equal. Extend
`tests/bridges/agents/discover.test.ts` with a case that writes a real BOM-led
`.md` into a `mkdtemp` agents dir whose frontmatter `name` differs from the
filename stem, runs `discoverPluginAgents`, and asserts the frontmatter name
wins and the body is clean. Follow the existing hermetic-tmpdir and
`t.after(...)` cleanup patterns already in those files; construct the marker as
a `\uFEFF` escape so the fixture is visible in review rather than an invisible
byte.
  </action>
  <verify>
    <automated>node --test tests/shared/bom.test.ts tests/bridges/agents/frontmatter.test.ts tests/bridges/agents/discover.test.ts</automated>
  </verify>
  <done>The three test files pass. Reverting only the `stripBom` call in `frontmatter.ts` turns the new agents cases red (the assertions plant the violation rather than restating the helper).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: strip at the skills staging read site</name>
  <files>extensions/pi-claude-marketplace/bridges/skills/stage.ts, tests/bridges/skills/stage.test.ts</files>
  <behavior>
    - A skill whose staged `SKILL.md` source begins with U+FEFF stages to a file that does not begin with U+FEFF.
    - That staged file's frontmatter carries BOTH the generated `name` and the source `description` in one block.
    - The staged body contains no second `---` fence and no residual U+FEFF.
  </behavior>
  <action>
In `bridges/skills/stage.ts`, wrap the `SKILL.md` read (currently
`let content = await readFile(skillMdPath, "utf8");`, around line 262) in
`stripBom(...)`. Add `import { stripBom } from "../../shared/bom.ts";` placed
alphabetically ahead of the existing `../../shared/errors.ts` import.

This single site is load-bearing for everything downstream, so state that in a
brief comment citing FMBOM-01: the strip must precede the PARSE-01 gate-1 parse
AND the SK-3 name rewrite, because `rewriteFrontmatterName` anchors on
`startsWith("---")` and a leading marker sends it down the `freshBlock` path
that buries the source block in the body. Because the same `content` variable is
what `writeFile` emits at the end of the loop, one strip fixes the parse, the
rewrite, the augment and the staged bytes together.

Extend `tests/bridges/skills/stage.test.ts` with a case that builds a skill dir
whose `SKILL.md` begins with `\uFEFF` followed by a frontmatter block carrying a
`name` different from the generated name plus a `description`, runs the real
prepare/commit path used by the neighboring cases, then READS THE COMMITTED FILE
BACK and asserts the three behaviors above. Assert on the staged bytes rather
than on a parse result: the installed peer tolerates a leading marker in its own
parser, so a parse-only assertion would pass without the fix and prove nothing.
Reuse `allocateCasePaths` and the existing fixture and cleanup helpers in that
file.
  </action>
  <verify>
    <automated>node --test tests/bridges/skills/stage.test.ts</automated>
  </verify>
  <done>The new skills case passes, and fails when the `stripBom` call is reverted.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: strip at the commands staging read site, then run the full gate</name>
  <files>extensions/pi-claude-marketplace/bridges/commands/stage.ts, tests/bridges/commands/stage.test.ts</files>
  <behavior>
    - A command source whose `.md` begins with U+FEFF stages to a file that does not begin with U+FEFF.
    - That staged file's frontmatter fields survive the round trip and the source fence is not duplicated into the body.
  </behavior>
  <action>
In `bridges/commands/stage.ts`, wrap the source read (currently
`let content = await readFile(command.commandFile, "utf8");`, around line 214) in
`stripBom(...)`, adding the `../../shared/bom.ts` import alphabetically within
the existing `../../shared/*` run. Add a brief FMBOM-01 comment: a leading marker
produces no gate-1 throw, so no CMD-01 degrade fires, and the marker would
otherwise reach the staged artifact where a peer at the `>=0.80.5` floor drops
the frontmatter at load time.

Extend `tests/bridges/commands/stage.test.ts` with a BOM-led source case
asserting the two behaviors above, following the fixture patterns already in
that file. Assert on the staged bytes, for the same reason as Task 2.

Then run the full gate. Expect specific attention on: `npm run
test:corresponding` (the new `shared/bom.ts` requires its paired test from Task
1), `fallow dead-code` (the new export must be reachable from all three call
sites), `fallow dupes` (three near-identical one-line call sites are expressions,
not clones, but confirm), and `format:check`.
  </action>
  <verify>
    <automated>npm run check</automated>
  </verify>
  <done>`npm run check` exits 0 with the three read sites stripped and all new cases passing.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| plugin author's file bytes -> our frontmatter parsers and stagers | Author-controlled text crosses into parsing and into artifacts the model later reads. The plugin is already trusted at install time: the user explicitly ran `install` for a named plugin from a named marketplace, so this is a robustness boundary, not an authentication one. |

The honest assessment: the surface here is small and input-driven. A BOM is
attacker-influenceable only insofar as a plugin author controls bytes in their own
plugin — bytes the user already opted into. No new input channel, no new privilege,
no network, no package installs (so the package-legitimacy gate does not apply).

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-FMBOM-01 | Tampering | `bridges/skills/stage.ts` read site, `bridges/agents/frontmatter.ts` parser | low | mitigate | A leading marker currently creates a gap between what we parse and what we stage, so an author's `---` block lands as body prose the model reads while the emitted frontmatter says something else. Stripping at the read site closes the gap: parsed bytes and staged bytes become the same bytes. |
| T-FMBOM-02 | Tampering | `shared/bom.ts` | low | mitigate | Stripping repeatedly could be abused to smuggle a second fence past a `startsWith` guard by prefixing several markers. Strip exactly ONE leading U+FEFF — never a loop, never a global regex — matching Pi's own fix and the single-marker strip in `domain/version.ts`. A doubled marker still fails closed to the no-frontmatter path. Task 1 pins this with a dedicated test case. |
| T-FMBOM-03 | Information disclosure | PARSE-01 / PARSE-02 gates | low | accept | The parse stays read-only: extract values, never evaluate. The T-03-17 injection-safety property is untouched by this change — no new parse, no new evaluation, only a prefix removed before an existing parse. |
| T-FMBOM-04 | Denial of service | `shared/bom.ts` | low | accept | `startsWith` + `slice` is O(1)/O(n) with no backtracking. Deliberately not a regex, so attacker-supplied plugin text cannot drive catastrophic backtracking. |
</threat_model>

<verification>
- `npm run check` green (typecheck, lint incl. SonarJS over `extensions/`, fallow
  dead-code/health/dupes, prettier, both pairing gates, unit, integration).
- Each new test fails when its production strip is reverted — the tests plant the
  violation through the real read path, they do not restate the helper.
- No change to hashing (`domain/version.ts`, `bridges/agents/discover.ts` sourceHash)
  and no change to the declared peer range in `package.json`.
- No wrapper added at `platform/pi-api.ts` (see F5).
</verification>

<success_criteria>
- A BOM-led agent source resolves its name from frontmatter, not the filename stem.
- A BOM-led skill stages one frontmatter block holding both the generated name and the
  source description, with no fence left in the body.
- No staged skill or command artifact begins with a BOM.
- `npm run check` exits 0.
</success_criteria>

<output>
Create `.planning/quick/260907-uzb-fmbom-01-strip-leading-utf-8-bom-at-skil/260907-uzb-SUMMARY.md` when done.

The SUMMARY must record the F7 operator consequence: because both the agent `sourceHash`
and the plugin content hash already normalize the marker away, `update` reports
`(skipped) {up-to-date}` for an already-installed BOM'd plugin. Repairing an existing
install requires `/claude:plugin reinstall`. Hashing semantics were deliberately left
unchanged.
</output>
