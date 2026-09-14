---
phase: 260907-uzb
plan: 01
status: complete
subsystem: bridges
tags: [frontmatter, bom, skills, commands, agents, parsing]
requires: []
provides:
  - "extensions/pi-claude-marketplace/shared/bom.ts::stripBom"
affects:
  - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
  - extensions/pi-claude-marketplace/bridges/skills/stage.ts
  - extensions/pi-claude-marketplace/bridges/commands/stage.ts
tech-stack:
  added: []
  patterns:
    - "One shared leaf helper for a cross-bridge concern, because fallow zone boundaries forbid the three bridges from importing one another."
key-files:
  created:
    - extensions/pi-claude-marketplace/shared/bom.ts
    - tests/shared/bom.test.ts
  modified:
    - extensions/pi-claude-marketplace/bridges/agents/frontmatter.ts
    - extensions/pi-claude-marketplace/bridges/skills/stage.ts
    - extensions/pi-claude-marketplace/bridges/commands/stage.ts
    - tests/bridges/agents/frontmatter.test.ts
    - tests/bridges/agents/discover.test.ts
    - tests/bridges/skills/stage.test.ts
    - tests/bridges/commands/stage.test.ts
decisions:
  - "Strip at the three bridge read sites, not in a wrapper at platform/pi-api.ts, so PARSE-01's byte-identical mirror of Pi's loaders is preserved and the staged bytes are fixed alongside the parse."
  - "Strip exactly one leading U+FEFF (startsWith + slice, no loop, no regex) so a doubled marker still fails closed to the no-frontmatter path (T-FMBOM-02)."
  - "Hashing semantics in domain/version.ts and bridges/agents/discover.ts left unchanged; the operator-facing consequence is recorded below instead."
metrics:
  duration: 45 min
  completed: 2026-09-07
actuals:
  tokens: 4576
  tasks: 3
  commits: 3
plan_head_before: 27737ca86ac83309ccff763e7555eafb32998642
---

# Quick Task 260907-uzb: FMBOM-01 strip leading UTF-8 BOM Summary

A single leading UTF-8 BOM no longer discards agent, skill, or command frontmatter: `shared/bom.ts::stripBom` runs at all three bridge read sites, so the parsed bytes and the staged bytes agree.

## What Was Built

`stripBom(text)` removes exactly one leading U+FEFF and returns the rest unchanged. It lives in `shared/` because fallow's zone boundaries forbid `bridges-agents`, `bridges-skills` and `bridges-commands` from importing one another, and all three need it.

Three call sites:

| Site | Change | Defect it closes |
| --- | --- | --- |
| `bridges/agents/frontmatter.ts::parseFrontmatter` | parameter renamed to `rawText`, `const text = stripBom(rawText)` as the first statement | The anchored `/^---\r?\n/` fence match failed, `raw` came back empty, `discover.ts` fell back to the filename stem for `sourceName`, and the source `---` block stayed in `body` — which `convert.ts` emits verbatim into the generated agent |
| `bridges/skills/stage.ts` | `let content = stripBom(await readFile(skillMdPath, "utf8"))` | `rewriteFrontmatterName` anchors on `startsWith("---")`, so a marker took the `freshBlock` path: the staged skill carried a name-only generated block while the author's block, `description` included, sat in the body as literal text |
| `bridges/commands/stage.ts` | `let content = stripBom(await readFile(command.commandFile, "utf8"))` | No gate-1 throw, so no CMD-01 degrade fired and the marker reached the staged prompt, where a peer at the `>=0.80.5` floor drops the whole block at load time |

Because the same `content` variable is what `writeFile` emits in both stagers, one strip fixes the parse, the rewrite, the augment and the staged bytes together. No peer-floor move was needed.

## Tasks Completed

| Task | Name | Commit | Files |
| --- | --- | --- | --- |
| 1 | stripBom helper wired through the agents read path | `8058d530` | `shared/bom.ts`, `bridges/agents/frontmatter.ts`, `tests/shared/bom.test.ts`, `tests/bridges/agents/{frontmatter,discover}.test.ts` |
| 2 | Strip at the skills staging read site | `b256b719` | `bridges/skills/stage.ts`, `tests/bridges/skills/stage.test.ts` |
| 3 | Strip at the commands staging read site, then the full gate | `fb54c5d7` | `bridges/commands/stage.ts`, `tests/bridges/commands/stage.test.ts` |

## Revert Check — Every New Test Fails Without Its Fix

The plan required proving each test plants the violation rather than restating the helper. Each production strip was reverted in isolation, the paired suite re-run, then the strip restored and the suite re-run green.

| Task | Strip reverted | Cases that went red | Restored |
| --- | --- | --- | --- |
| 1 | `const text = stripBom(rawText)` → `const text = rawText` | 4 of 4: `parses a source led by a byte-order mark identically to the unmarked source`, `keeps a doubled byte-order mark on the no-frontmatter path`, `resolves the frontmatter name of a source led by a byte-order mark`, and the pre-existing `discovers flat markdown agents in source order with complete records` | 58 pass, 0 fail |
| 2 | `stripBom(await readFile(...))` → `await readFile(...)` | `commits a source led by a byte-order mark as one unmarked frontmatter block` | 33 pass, 0 fail |
| 3 | `stripBom(await readFile(...))` → `await readFile(...)` | `stages a source led by a byte-order mark without the marker or a duplicated fence` | 24 pass, 0 fail |

The skills and commands cases assert on the **committed bytes read back from disk**, never on a parse result. The installed peer is 0.84.4, whose `parseFrontmatter` already tolerates a leading marker; a parse-only assertion would have passed with the fix reverted and proved nothing.

The helper's own suite pins T-FMBOM-02 directly: `removes only the first of two consecutive leading byte-order marks` asserts the second marker survives, so a doubled marker still fails closed to the no-frontmatter path rather than being cleaned into a parseable block. The agents suite pins the same property end-to-end through the real parser.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated a pre-existing agents-discovery expectation that pinned the marker into `body`**

- **Found during:** Task 1
- **Issue:** `tests/bridges/agents/discover.test.ts` already had a fixture whose bytes began with a literal U+FEFF (`Buffer.from("\uFEFFPlain body\r\n")`), and its expected record asserted `body: "\uFEFFPlain body\r\n"` — the marker retained. The strip makes that expectation wrong.
- **Fix:** Changed the expected body to `"Plain body\r\n"` and rewrote the fixture literal as a visible `\uFEFF` escape. `sourceHash` is over raw bytes and is unaffected, so it was left alone. The file's other expectations were not touched.
- **Files modified:** `tests/bridges/agents/discover.test.ts`
- **Commit:** `8058d530`

**2. [Rule 2 - Correctness] Wrote every marker as a `\uFEFF` escape, not an invisible literal**

- **Found during:** Task 1
- **Issue:** The first draft of `shared/bom.ts` carried an invisible literal U+FEFF in `startsWith("...")`.
- **Fix:** Rewrote it, and every test fixture, as `\uFEFF`. This matches the Google style rule that non-printable characters appear as escapes with a comment, keeps the fixtures reviewable, and keeps the `fix utf-8 byte order marker` pre-commit hook from touching them.
- **Files modified:** `extensions/pi-claude-marketplace/shared/bom.ts`, all five test files
- **Commit:** `8058d530`

No architectural deviations. No Rule 4 escalations.

## Operator Consequence — Existing Installs Need `reinstall`, Not `update` (F7)

Both hashes that could notice a BOM'd source already normalize the marker away:

- `bridges/agents/discover.ts` computes `sourceHash` over raw bytes, and the digest is BOM-blind by construction for the comparison that matters.
- `domain/version.ts::normalizeBytes` strips the `0xEF 0xBB 0xBF` prefix before hashing the plugin content.

Nothing in the version layer will therefore notice that an already-installed BOM'd plugin needs re-staging. `update.ts` puts it in the `unchanged` partition and renders `(skipped) {up-to-date}`.

**After this ships, an already-installed BOM'd plugin is repaired by `/claude:plugin reinstall`, not by `update`.** Hashing semantics were deliberately left unchanged — that is a separate decision with a separate blast radius, and folding it in would put a hashing path inside the blast radius of a parsing fix. The operator decided on 2026-09-07 to record this consequence here and file no backlog follow-up.

## Verification

`npm run check` exits **0**: typecheck, ESLint (including the SonarJS Sonar-way block over `extensions/`), `fallow dead-code` + `health` + `dupes`, Prettier, both pairing gates, the direct-coverage negative gate, 5254 unit tests across 298 suites, and 31 integration tests.

Specific points the plan flagged, all clean:

- `test:corresponding` — the new `shared/bom.ts` is paired by `tests/shared/bom.test.ts`.
- `fallow dead-code` — the new export is reachable from all three call sites; no new suppression was added.
- `fallow dupes` — the three one-line call sites are expressions, not clones; the gate did not fire and `.fallowrc.json` was not touched.
- `format:check` — green with no reformatting of unrelated code.

Also verified by the plan's negative criteria: no change to `domain/version.ts` or the `sourceHash` computation, no change to the declared peer range in `package.json`, and no wrapper added at `platform/pi-api.ts`.

`pre-commit run --files <changed files>` was run before each commit and passed every hook except TruffleHog, which fails structurally in a linked worktree (`.git` is a file, so its git-mode scan cannot find `.git/index`). Per project CLAUDE.md, each commit was cleared by the filesystem route first — `trufflehog filesystem <changed paths> --results=verified,unknown --fail` returned `verified_secrets: 0, unverified_secrets: 0` for all three task file sets — and then committed with `SKIP=trufflehog`. No other hook was skipped and `--no-verify` was never used.

## Known Stubs

None.

## Threat Flags

None. The change removes a prefix before an existing parse; it adds no new input channel, no new evaluation, no network, and no package installs. T-FMBOM-02 (single strip) and T-FMBOM-04 (no regex backtracking) are both mitigated in `shared/bom.ts` and pinned by tests.

## Self-Check: PASSED

- `extensions/pi-claude-marketplace/shared/bom.ts` — FOUND
- `tests/shared/bom.test.ts` — FOUND
- Commit `8058d530` — FOUND
- Commit `b256b719` — FOUND
- Commit `fb54c5d7` — FOUND
