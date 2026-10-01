---
phase: 260928-tt9
plan: 01
subsystem: domain/source, platform/git
tags: [security, source-parser, git-config, marketplace-add]
status: complete
requires: []
provides:
  - "urlObjectSource admits raw only when its parse-time identity equals url's (T-2-10)"
  - "listRemotes reports origin only for exactly one remote.origin.url value (WR-11, T-3-05)"
affects:
  - orchestrators/marketplace/add.ts (recognizeLeftover, behaviour via listRemotes; file unchanged)
  - every url object source consumer (identity/wire now tied to one repository)
tech-stack:
  added: []
  patterns:
    - "reuse the existing unknownObjectSource rejection path; no new type member, helper or export"
    - "git.getConfigAll for multi-valued config keys"
key-files:
  created: []
  modified:
    - extensions/pi-claude-marketplace/domain/source.ts
    - extensions/pi-claude-marketplace/platform/git.ts
    - tests/domain/source.test.ts
    - tests/platform/git.test.ts
    - tests/orchestrators/marketplace/add.test.ts
decisions:
  - "T-2-10: a url object source's raw is compared by its gated identity (gatedRaw.url) against the identity url; the ref stays out of the comparison"
  - "WR-11: listRemotes refuses (no-origin) any origin with zero or two-plus urls instead of picking git's first"
metrics:
  duration: ~40min
  completed: 2026-09-29
actuals:
  tokens: 9000
  tasks: 3
  commits: 2
plan_head_before: 48d744716d843e4c1bdd15cae997909940a69942
plan_head_after: add75890
---

# Quick 260928-tt9: url raw identity mismatch and duplicate origin url Summary

A url object source's `raw` must now parse to the same repository as its `url` (T-2-10). `listRemotes` reports `origin` only when `.git/config` holds exactly one `remote.origin.url`, read through `git.getConfigAll` (WR-11 / T-3-05).

Start SHA: `48d74471` (`48d744716d843e4c1bdd15cae997909940a69942`).

## Commits

| Task | Commit | Subject | Files |
|------|--------|---------|-------|
| 1 | `1cc96c97` | fix(source): require a url source's raw to name its url's repository | `domain/source.ts`, `tests/domain/source.test.ts` |
| 2 | `add75890` | fix(git): refuse a leftover origin that records more than one url | `platform/git.ts`, `tests/platform/git.test.ts`, `tests/orchestrators/marketplace/add.test.ts` |
| 3 | none | gate, audit and scope fence only; no file changed | none |

Both code commits end with the two required trailer lines. Neither commit message names the milestone, phase or quick-task id.

## Task 1: T-2-10

- `urlObjectSource` keeps the scheme-gate early return. It then returns `unknownObjectSource(obj, "url source raw <raw> does not name the same repository as url <url>")` when `gatedRaw.kind !== "url" || gatedRaw.url !== identity.url`.
- `gatedRaw.url` is the D-2-05 identity composition. A trailing slash, a `#<ref>` and `.git` strip away, so a raw that differs only by decoration is still admitted. The change adds no new call edge, helper, export or type member.
- Five rows were added to `URL_OBJECT_GATE_CASES`. One sentence citing T-2-10 was added to the block comment above it.

**RED evidence.** Against the unfixed parser, `node --test tests/domain/source.test.ts` gave 145 pass and 4 fail. The failing cases were exactly:
1. rejects a raw url on another host than the identity url in the object form
2. rejects a github raw url behind a non-github identity url in the object form
3. rejects a raw url on the identity host with another path in the object form
4. rejects a raw url on another host than the identity url in a kind-tagged object

The admission row ("admits a raw url that differs from the identity url only by decoration in the object form") passed before the fix.

**GREEN.** 149/149 pass. Direct coverage for `domain/source.ts`: branches 191/191, functions 33/33, lines 744/744. ESLint (`--max-warnings=0`) and `tsc --noEmit` are clean.

## Task 2: T-3-05 / WR-11

- `listRemotes` makes one read after the probe: `git.getConfigAll({ fs, dir, path: "remote.origin.url" })`, annotated `readonly unknown[]`. It returns `{ kind: "origin", url }` only when `urls.length === 1 && typeof url === "string"`. Every other case returns `no-origin`. Both tests sit in one conditional expression. The old inline comment is gone, which resolves IN-07.
- The `ListRemotesResult` arm docs and the `listRemotes` JSDoc were rewritten as the plan specified.
- `git.test.ts`: `OriginSectionShape` gained `libraryUrls`, and the row loop asserts `git.getConfigAll`. The three existing rows gained `libraryUrls` (`[]`, `[]`, `[""]`). Four rows were added: foreign-first, foreign-second, two sections, and a capitalized `Remote` section.
- `add.test.ts`: added `ORIGIN_WITH_TWO_URLS_CONFIG`. Renamed `arrangeLeftoverWithoutOriginUrl` to `arrangeLeftoverWithOriginConfig(locations, config)`. Added the `LeftoverOriginConfig` / `LEFTOVER_ORIGIN_CONFIGS` table, which holds the unchanged ATTR-07 title and the new WR-11 case. The orchestrated RECON-03 case keeps its body and passes `ORIGIN_WITHOUT_URL_CONFIG` explicitly.

**RED evidence.** Against the unfixed wrapper, `node --test tests/platform/git.test.ts tests/orchestrators/marketplace/add.test.ts` gave 137 pass and 5 fail. The failing cases were exactly:
1. reports no-origin for an origin section whose first of two urls is foreign
2. reports no-origin for an origin section whose second of two urls is foreign
3. reports no-origin for two origin sections that each record a url
4. reports the origin url of an origin section whose section name is capitalized
5. MA-13 / WR-11: a leftover whose origin section names two urls refuses as stale clone

**GREEN.** 142/142 pass. Direct coverage for `platform/git.ts`: branches 66/66, functions 16/16, lines 509/509. For `orchestrators/marketplace/add.ts`: branches 142/142, functions 16/16, lines 996/996. ESLint and `tsc` are clean.

## Task 3: Gate

- `npm run check` ran unpiped and wrote its exit code into the log: **`CHECK_EXIT=0`**.
- Unit tests (`test:coverage:unit`): 7396 tests, 7396 pass, 0 fail. Coverage row: `all files | 100.00 | 100.00 | 100.00`.
- Integration: 36/36 pass.
- `lint:type-members`: "Unused type member gate passed with 4 recorded exception(s)". The negative controls passed 7 of 7. `scripts/check-unused-type-members.contracts.json` is unchanged (`git diff --quiet 48d74471..HEAD` exits 0) and still holds 108 entries.
- `npx fallow audit --format json --quiet --explain --gate-marker agent` gave verdict **`pass`** after each commit and at the final HEAD.
- Scope fence: `git diff --name-only 48d74471..HEAD -- extensions tests scripts` lists exactly the five `files_modified` paths. `git status --porcelain -- extensions tests scripts` is empty.
- Pre-commit (`SKIP=trufflehog pre-commit run --files ...`) was clean before both commits. No hook rewrote a file, so no follow-up commit was needed.

## Accepted consequences

- **T-260928-tt9-01:** a url object source whose `raw` identity is not a parse fixed point now parses as `unknown` on the object path. Examples are `https://host/o/r.git.git` and `https://host/o/r/.git`. Reconcile already reports this class as `different`. `persistence/state-io.ts::normalizeStoredSource` re-parses a stored marketplace from `raw` as a string, so no record is dropped at load.
- **T-260928-tt9-03:** a leftover with a capitalized `[Remote "origin"]` section is now recognized, because git reads that section as origin. The match is still whole-string equality against `canonicalCloneUrl` (D-3-01). A `git.test.ts` row pins this.

## Notes for later review

- `CHANGELOG.md` is untouched. Both defects exist only in unreleased code, and the existing [Unreleased] bullets already describe the shipped behavior ("Any other leftover directory is still refused").
- The code commits carry no quick-task id (AGENTS.md). A later code review therefore needs diff base `48d74471` and the five files passed explicitly.

## Deviations from Plan

One cosmetic change: in the `listRemotes` JSDoc probe paragraph, the plan's wording change pushed "url --" onto a line of its own. The paragraph was reflowed so the sentence reads continuously. The wording is exactly as the plan specified. There were no other deviations.

## Known Stubs

None.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

## Self-Check: PASSED

- FOUND: extensions/pi-claude-marketplace/domain/source.ts, extensions/pi-claude-marketplace/platform/git.ts, tests/domain/source.test.ts, tests/platform/git.test.ts, tests/orchestrators/marketplace/add.test.ts
- FOUND commits: 1cc96c97, add75890
