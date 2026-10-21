---
phase: 10-github-source-kind-and-suite-close
plan: "07"
subsystem: testing
tags: [cucumber, suite-close, SC4, D-04, D-05, D-06, D-07, D-08, ADD-11, UPD-12, SRC-02, SRC-03]
status: complete

requires:
  - phase: 10-github-source-kind-and-suite-close
    provides: "10-06: the SC4 review with no open BLOCKER; 429 scenarios, 4005 steps, all passing; WINDOWS 102-109"
provides:
  - "The SC4 run records: one Node 26.11.1 and two Node 24.21.0 whole-suite runs, 429 of 429 each, with wall times"
  - "The clean usage report (exit 0, no UNUSED, undefined, or ambiguous step)"
  - "The by-hand credential-isolation control: the positive control bit on four settings, then 429 of 429 passed under the hostile config with the marker absent"
  - "The Phase 9 review ledger 09-REVIEW-DISPOSITION.md at open: 0, every IN row citing its fixing commit"
  - "The phase gate: npm run check exit 0 at a1c4bbb0, plus two more random-order cucumber runs"
affects: [milestone close, PR]

actuals:
  tokens: 3100
  tasks: 2
  commits: 1
plan_head_before: eb25610c1faf17a9135c047f2b23b5fa243a01f3
plan_head_after: a1c4bbb0dd42f9a47f54e4d3703e8b4aa215b243

tech-stack:
  added: []
  patterns:
    - "A by-hand control lives in the session scratchpad, reaches git only through the one command's environment, and is removed afterwards; it is recorded, never committed"

key-files:
  created:
    - .planning/phases/10-github-source-kind-and-suite-close/10-07-SUMMARY.md
  modified:
    - .planning/phases/09-url-source-kind-and-https-git-stand-in/09-REVIEW-DISPOSITION.md

key-decisions:
  - "The Phase 9 ledger's IN rows are set fixed by hand with the commit SHA in the Source cell (`commit <sha> (IN-NN)`), the same shape as the WR rows; the ledger footer says hand-set dispositions are kept (10-RESEARCH A3)"
  - "The phase gate ran npm run check fresh on a1c4bbb0 instead of reusing the orchestrator's result, because the plan asks for its wall time"

requirements-completed: [ADD-11, UPD-12, SRC-02, SRC-03]

coverage:
  - id: D1
    description: "The whole suite passes on Node 26 once and on Node 24.21.0 twice (D-06)"
    verification:
      - kind: other
        ref: "npm run test:cucumber (v26.11.1); npx --prefer-offline -y -p node@24.21.0 -- node node_modules/@cucumber/cucumber/bin/cucumber.js (x2)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The usage report has no unused, undefined, or ambiguous step"
    verification:
      - kind: other
        ref: "npx cucumber-js --dry-run --format usage"
        status: pass
    human_judgment: false
  - id: D3
    description: "The hostile-config control changes no result and runs no outside credential helper"
    verification:
      - kind: manual_procedural
        ref: "By-hand control in this SUMMARY (positive control, then the suite under the hostile environment)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Phase 9 review ledger ends at open: 0 (D-04)"
    verification:
      - kind: other
        ref: "grep -c '^open: 0$' 09-REVIEW-DISPOSITION.md = 1; 11 IN rows fixed with a commit SHA"
        status: pass
    human_judgment: false
  - id: D5
    description: "The phase gate is green on the final tree"
    verification:
      - kind: other
        ref: "npm run check at a1c4bbb0, exit 0; npm run test:cucumber x2, 429 passed each"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-10-21
---

# Phase 10 Plan 07: Suite Close Summary

**The whole cucumber suite passes 429 of 429 on Node 26.11.1 (15.9 s wall) and twice on Node 24.21.0 (24.8 s and 27.0 s wall). It also passes 429 of 429 under a hostile git config whose credential helper never runs. The usage report is clean, the Phase 9 review ledger is at `open: 0`, and `npm run check` exits 0 at `a1c4bbb0` in 111.9 s.**

## Performance

- **Duration:** about 13 min
- **Started:** 2026-10-21T15:32:26Z
- **Completed:** 2026-10-21T15:45Z
- **Tasks:** 2
- **Files modified:** 2 (the Phase 9 ledger, this SUMMARY)

## Task Commits

1. **Task 1: Node 24 and Node 26 runs, timing, usage report, hostile control.** No commit. The records are in this SUMMARY, and the control was never staged.
2. **Task 2: Close the Phase 9 review ledger.** `a1c4bbb0` (docs): `docs(planning): close the url source review ledger`. The commit hook passed, with no `--no-verify`.

**Plan metadata:** the `docs(planning)` commit of this SUMMARY.

Precondition: `git status --short -- features extensions tests scripts cucumber.json` printed nothing before Task 1. All runs measured the committed tree at `eb25610c`. The tree under `features`, `extensions`, `tests`, `scripts`, and `cucumber.json` did not change during the plan.

## Task 1: whole-suite runs (D-06, D-08)

Environment: Linux, `git version 2.55.0`, `OpenSSL 4.0.3 29 Sep 2026`, `cucumber.json` `parallel: 8` (unchanged). `PiProcess` spawns `process.execPath`, so the Node 24 runs also run Pi on Node 24.

| Run | Node (`--version`) | Command | Exit | Seed | Summary | Cucumber time | Wall time |
|---|---|---|---|---|---|---|---|
| Node 26 | v26.11.1 | `npm run test:cucumber` | 0 | 836661 | `429 scenarios (429 passed)`, `4005 steps (4005 passed)`, `16 hooks (16 passed)` | 13.868 s | 15.85 s (max RSS 781 MB) |
| Node 24 #1 | v24.21.0 | `npx --prefer-offline -y -p node@24.21.0 -- node node_modules/@cucumber/cucumber/bin/cucumber.js` | 0 | 134925 | `429 scenarios (429 passed)`, `4005 steps (4005 passed)` | 21.981 s | 24.84 s (max RSS 806 MB) |
| Node 24 #2 | v24.21.0 | same | 0 | 494993 | `429 scenarios (429 passed)`, `4005 steps (4005 passed)` | 24.251 s | 27.03 s (max RSS 843 MB) |

No Node 24 run failed, so nothing needed investigation. Wall times come from `/usr/bin/time -f %e`. The Node 24 wall time includes the npx start-up from the cache.

**Usage report (SC4).** `npx cucumber-js --dry-run --format usage`: exit 0. The output has 0 matches for `UNUSED`, 0 for `undefined`, and 0 for `ambiguous`, case-insensitive.

## Task 1: credential-isolation control (by hand, never committed)

All files were in `<scratchpad>/hostile/`. Nothing read or wrote the real `~/.gitconfig`, `/etc/gitconfig`, `~/.git-credentials`, a keychain, `~/.pi/agent`, or this repository's `.pi/`. Before the control, `XDG_CONFIG_HOME` and every `GIT_*` config variable except `GIT_EDITOR` were unset in the shell. So the hostile HOME was the only global config that git could find.

**Planted files:**

- `hostile/helper.sh` (mode 0755): `#!/bin/sh`, `cat >/dev/null`, `touch <scratchpad>/hostile/marker`, and for `$1 = get` it prints `username=alice` and `password=s3cret`.
- `hostile/home/.gitconfig` and its copy `hostile/system-gitconfig`: `init.defaultBranch = master`, `commit.gpgsign = true`, `user.signingkey = DEADBEEF`, `user.name = Hostile`, `user.email = hostile@example.invalid`, `credential.helper = <absolute path of helper.sh>`, and `url."https://example.invalid/".insteadOf = https://127.0.0.1`.
- `hostile/gnupg/` (mode 0700) as `GNUPGHOME`, and `hostile/probe/` as the scratch repository.

**a. Positive control.** Run in `hostile/probe` with `HOME=hostile/home`, `GIT_CONFIG_SYSTEM=hostile/system-gitconfig`, and `GNUPGHOME=hostile/gnupg`:

| Step | Command | Exit | Observed | Marker after |
|---|---|---|---|---|
| init | `git init -q .`, then `git symbolic-ref HEAD` | 0 | `refs/heads/master` | absent |
| commit | `git commit --allow-empty -m probe` | 128 | `error: gpg failed to sign the data:` ... `gpg: skipped "DEADBEEF": No secret key` | absent |
| credential | `printf 'protocol=https\nhost=127.0.0.1\n\n' \| git credential fill` | 0 | `username=alice`, `password=s3cret` | **present** |
| insteadOf | `git ls-remote https://127.0.0.1:1/x.git` | non-zero | `unable to access 'https://example.invalid/:1/x.git/'`: the URL was rewritten | present |

Each planted setting changes the result of a git that reads the config. The marker was then deleted, and `ls` confirmed it was gone.

**b. Suite under the hostile environment.** `HOME=hostile/home GIT_CONFIG_GLOBAL=hostile/home/.gitconfig GIT_CONFIG_SYSTEM=hostile/system-gitconfig GNUPGHOME=hostile/gnupg PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL=https://example.invalid/git node node_modules/@cucumber/cucumber/bin/cucumber.js` (Node 26.11.1, run directly so that npx does not use the hostile HOME for its cache):

- Exit 0, seed 562213, `16 hooks (16 passed)`, `429 scenarios (429 passed)`, `4005 steps (4005 passed)`, 13.469 s cucumber time, 15.13 s wall time.
- The marker was absent before the run and **absent after it**, so the planted helper never ran. `hostile/home` held only `.gitconfig` afterwards, so no run wrote into the hostile home.

**c. Stop and removal.** After the positive control and again after the suite run, `ps -eo pid,args` showed no `keyboxd`, `gpg-agent`, or `dirmngr`. This gpg created `pubring.kbx` in `GNUPGHOME` and started no keyboxd daemon, so Pitfall 5 did not happen here. `GNUPGHOME=hostile/gnupg gpgconf --kill all` (exit 0) ran as a precaution. Then `rm -rf hostile/` removed the tree, and `ls -d` confirmed it was gone. `git status --short` was empty afterwards.

**macOS: not verified (10-RESEARCH A2).** Apple's git may read a credential helper that `GIT_CONFIG_NOSYSTEM` does not cover, such as an Xcode-bundled `credential.helper=osxkeychain`. CI is Linux only.

## Task 2: Phase 9 review ledger (D-04)

`09-REVIEW-DISPOSITION.md`: IN-01 to IN-11 are `disposition: fixed` in the frontmatter. `open: 11` became `open: 0`, and `recorded` was refreshed. Each table row now reads `| IN-NN | info | fixed | commit <sha> (IN-NN) |`. The WR rows are unchanged.

| Finding | Commit | Fixing plan | `git cat-file -t` |
|---|---|---|---|
| IN-01 | `7129ac02` | 10-02 | commit |
| IN-02 | `a8ec3abc` | 10-02 | commit |
| IN-03 | `7129ac02` | 10-02 | commit |
| IN-04 | `72eac098` | 10-02 | commit |
| IN-05 | `7a452c20` | 10-01 | commit |
| IN-06 | `7129ac02` | 10-02 | commit |
| IN-07 | `72eac098` | 10-02 | commit |
| IN-08 | `a8ec3abc` | 10-02 | commit |
| IN-09 | `7129ac02` | 10-02 | commit |
| IN-10 | `7129ac02` | 10-02 | commit |
| IN-11 | `3323f1a8` | 10-03 | commit |

All five SHAs are ancestors of HEAD. Acceptance greps: `^open: 0$` = 1 (baseline 0), `disposition: open` = 0 (baseline 11), and the IN `fixed` rows with a SHA = 11 (baseline 0). `SKIP=npm-check pre-commit run --files <ledger>` exit 0, every hook Passed.

## Phase gate

| Command | Commit | Exit | Result | Wall time |
|---|---|---|---|---|
| `npm run check` (log in the scratchpad, exit read directly) | `a1c4bbb0` | 0 | typecheck, lint, lint:workflows, fallow, format:check, test:corresponding, check:features passed; test:unpaired and test:integration passed; cucumber `429 scenarios (429 passed)`, `4005 steps (4005 passed)` (seed 493539); `Merged LCOV: coverage/direct.lcov (280 records)` | 111.88 s |
| `npm run test:cucumber` #1 | `a1c4bbb0` | 0 | seed 410724, `429 scenarios (429 passed)`, `4005 steps (4005 passed)` | 15.82 s |
| `npm run test:cucumber` #2 | `a1c4bbb0` | 0 | seed 552644, `429 scenarios (429 passed)`, `4005 steps (4005 passed)` | 15.90 s |

Tool versions: `node --version` v26.11.1, `git version 2.55.0`, `OpenSSL 4.0.3 29 Sep 2026`. The gate ran after the ledger commit. The SUMMARY commit changes only planning Markdown, so `git diff a1c4bbb0 -- . ':(exclude,glob).planning/**/*.md'` stays empty and the gate result holds for the final tree.

## Carry-overs (D-05)

- BACKLOG `ROWID-01`: marketplace-level failure rows carry a plugin-shaped JSON id (`<mp>@<mp>`).
- WINDOWS #100 (open): the add-authentication-required catalog state shows the 401 shape that the catalog records, not the url and github shapes the suite pins.
- WINDOWS #101 (open, from plan 10-04): the github marketplace sync of `plugin update` (`orchestrators/plugin/update-flow.ts`) under `PI_CLAUDE_MARKETPLACE_GITHUB_BASE_URL` still fails a 401 without the `git credential approve` remedy line.
- WINDOWS #102 to #109 (open, from plan 10-06): the eight review WARNINGs in files that this phase does not own. #102 and #103 are the `add.feature` duplicate-name and invalid-manifest Outlines without an `@github` block. #104 is the `autoupdate.feature` already-autoupdate base config. #105 is the `list.feature` description. #106 and #107 are the `url-source-update.feature` failed updates without the declaration restated. #108 and #109 are the `disable.feature` and `enable.feature` descriptions.
- Debt: at PR time, consolidate the branch's CHANGELOG bullets into one entry.

## Open CI items (D-08)

- Nothing was pushed. Read the CI duration from the PR's `behavioral tests (Node 24)` job (`timeout-minutes: 10`) at milestone close. `parallel` stays 8. Change it only if that job nears the timeout (10-RESEARCH A4).
- 09-RESEARCH A1 and A4 stay open: OpenSSL 3.0.13 and `git http-backend` on `ubuntu-latest`. The PR's behavioral job and static job settle them. The static job now needs both too, for the live-host architecture cases in `tests/architecture/https-git-host-server.test.ts` that plan 10-02 added.
- macOS credential isolation is not verified (A2, above).

## D-07

ROADMAP SC4's source-walk item is dropped. The suite close for it was plan 10-05, which removed the `not @github` exclusion from `cucumber.json`, so every github row runs in the default profile.

## Decisions Made

- The ledger rows are set by hand to the same `commit <sha>` shape as the WR rows. The ledger footer says the tool keeps hand-set dispositions.
- `npm run check` ran fresh rather than reusing the orchestrator's earlier result, because the plan asks for its wall time.

## Deviations from Plan

None - plan executed exactly as written. Two small notes on how the steps ran:

- The plan's step 4a allowed adding `user.name` and `user.email` to the hostile config. They were added up front, because the hostile HOME hides the real identity. The commit then reached the signing step and failed there.
- The `keyboxd` stop of step 4c found no daemon to stop (see c above). `gpgconf --kill all` ran anyway.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 10 is complete: SC1 to SC5 are met, the Phase 9 ledger is closed, and the gate is green. The milestone close still has to read the PR's CI timing and settle A1 and A4, and the CHANGELOG consolidation is due at PR time.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.

T-10-16: the control lived under the scratchpad and reached git only through the environment variables of each command. It was removed afterwards, and no gpg daemon was left running. T-10-17: only `.planning/` paths were staged, by explicit pathspec. T-10-18: nothing was pushed. T-10-SC: no package was added. Node 24.21.0 came from the existing npx cache with `--prefer-offline`.

## Self-Check: PASSED

- FOUND: `.planning/phases/09-url-source-kind-and-https-git-stand-in/09-REVIEW-DISPOSITION.md` (`open: 0`)
- FOUND: `.planning/phases/10-github-source-kind-and-suite-close/10-07-SUMMARY.md`
- FOUND commits: `a1c4bbb0`, and the cited `7129ac02`, `a8ec3abc`, `72eac098`, `7a452c20`, `3323f1a8`
- `<scratchpad>/hostile/` absent, and nothing of it was staged

---
*Phase: 10-github-source-kind-and-suite-close*
*Completed: 2026-10-21*
