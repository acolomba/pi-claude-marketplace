---
quick_id: 260907-qsx
status: complete
date: 2026-09-07
branch: features/backlog-and-sonar
commit: fe1313c6
files_modified:
  - eslint.config.js
  - .planning/codebase/CONVENTIONS.md
---

# Summary: enforce Sonar way on extensions

## What was done

One block added to `eslint.config.js`, scoped to
`extensions/pi-claude-marketplace/**/*.ts`, spreading
`sonarjs.configs.recommended.rules`. 217 rules now run at error severity on
the extension tree. One bullet added to `CONVENTIONS.md`.

No dependency change was needed — `eslint-plugin-sonarjs@4.2.0` was already
installed and already declared.

## Findings that shaped the change

- **The plugin ships no "Sonar way" config.** The phrase appears nowhere in
  the package. It ships one config, `recommended`, documented as enabling
  "most of the rules except for a few exceptions". The reference project
  (`homebridge-basement-guardian`) does not use it either — it lists the same
  five rules by hand that this repo already did.
- **`recommended` is nonetheless a faithful stand-in.** Read against the live
  SonarCloud profile for this project (stock Sonar way for `ts`, 467 active
  rules), 200 of its 217 enabled rules are active there. The 62 it disables
  are the non-Sonar-way ones: naming conventions, `no-duplicate-string`,
  `no-commented-code`, `cyclomatic-complexity`, and the security hotspots.
- **The 1021 test-tree violations are a scoping artifact, not debt.**
  `sonar.test.exclusions=tests/**` means SonarCloud never reads them. 797 of
  the 1021 are `sonarjs/void-use` firing on the project's own
  `void (x satisfies T)` compile-time assertion idiom.

## Two mechanics worth remembering

- **Spread the rules; do not extend the config.** `recommended` re-declares
  the `sonarjs` plugin that `eslint.config.js` already declares, and the two
  plugin objects are not identical (checked), so ESLint 10 fails with
  `Cannot redefine plugin "sonarjs"`. Independently, `recommended` carries no
  `files` key, so as a config entry it would apply to every linted file —
  which is the whole test tree. The spread is what scoping requires, not a
  workaround for the error.
- **`cognitive-complexity` needs re-asserting after the spread.**
  `recommended` sets a bare `"error"`, dropping the threshold. The plugin
  default is also 15, so nothing changes today, but the number is paired with
  fallow's `health.maxCognitive` and with Sonar way's own S3776 `threshold`
  parameter (read from the live profile: 15, severity CRITICAL). Leaning on a
  default would make that three-way agreement implicit. The other four
  previously-tuned rules needed no re-assertion — `recommended` already sets
  them to `"error"`, identically.

## Deviations from plan

Subagents were not dispatched; the session forbids it without an explicit
request, so this ran inline and produced the same artifacts.
`init.quick` returned `branch_name: null`, which was correct here — the task
had to stay on the existing `features/backlog-and-sonar`.

One self-corrected error: the `CONVENTIONS.md` bullet first landed inside the
nested "Key rules" list, orphaning three sub-bullets. Moved below the nested
list before committing.

## Verification

- `npx eslint extensions` — 0 problems, matching SonarCloud's green status.
- `npx eslint tests` — 0 problems before and after. Byte-identical.
- `eslint --print-config` on an extensions file: 217 sonarjs rules at error,
  **0 at warn**, 62 off; `cognitive-complexity` resolves to `[2, 15]`.
- `npm run lint`, `typecheck`, `fallow`, `format:check` all exit 0.
- 5236 unit tests pass, 0 fail. Integration suite passes. The architecture
  tests that load the flat config programmatically were the specific
  regression risk and are green.
- `pre-commit run --files` clean on both changed files.

## Follow-on

Covering `tests/` is a real option rather than a blocked one — the test block
turns off only some rules, not a blanket exemption. Cost is measured: 1021
violations, or roughly 224 once `void-use` is excluded, most of the remainder
being fixture artifacts (`no-hardcoded-passwords`,
`publicly-writable-directories` on tmp paths). Not filed as a backlog entry.
