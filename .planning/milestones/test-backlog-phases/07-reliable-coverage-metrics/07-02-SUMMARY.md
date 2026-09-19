---
phase: 07-reliable-coverage-metrics
plan: "02"
subsystem: testing
tags: [coverage, istanbul, ast-v8-to-istanbul, acorn, sourcemap-codec, npm-tarball, provenance, patch]

# Dependency graph
requires:
  - phase: 07-01
    provides: "coverage-capture.mjs run bundles: raw V8 records, executed-source store and worker manifest that every conformance case captures a fixture through"
provides:
  - "scripts/coverage-producer.convert.mjs: the producer adapter -- loadProducer (delivery-qualified), producerIdentity (receipt), convertScripts (fresh AST per record, Istanbul merge); ProducerError"
  - "scripts/coverage-producer.mjs: `npm run coverage:producer --request <json> --out <json> [--receipt <json>] [--producer <entry>]`; inert on import"
  - "scripts/build-coverage-producer.mjs: `npm run coverage:producer:build -- --build|--verify [--vendor <dir>] [--upstream <tgz>]`; exports the pinned DELIVERY identity"
  - "vendor/coverage/: ast-v8-to-istanbul-1.0.6.patch, ast-v8-to-istanbul-1.0.6-project.1.tgz, LICENSE (upstream MIT, byte for byte), PROVENANCE.md"
  - "tests/scripts/coverage-producer-fixtures.ts + coverage-producer.test.ts: the independently authored conformance corpus (5 fixtures) and 18 controls, `npm run coverage:producer:check`"
  - "devDependencies pinned exactly: acorn 8.18.0, istanbul-lib-coverage 3.2.2, @jridgewell/sourcemap-codec 1.6.0, ast-v8-to-istanbul file:vendor/coverage/ast-v8-to-istanbul-1.0.6-project.1.tgz"
affects: [07-03, 07-04, 07-05, 07-07, 07-08]

# Actuals (#2632) -- chars/4 over the realized text diff (100211 chars including the lockfile; 94447 without it), never a harness token count.
actuals:
  tokens: 25100
  tasks: 3
  commits: 6
plan_head_before: d3bfa42ac671d3cd6247c3e8be020f8b4838801e

# Tech tracking
tech-stack:
  added:
    - "ast-v8-to-istanbul 1.0.6-project.1 (vendored tarball; upstream 1.0.6 + one reviewed walker patch, MIT)"
    - "acorn 8.18.0 (direct, exact; previously transitive 8.16.0 via espree)"
    - "istanbul-lib-coverage 3.2.2 (exact)"
    - "@jridgewell/sourcemap-codec 1.6.0 (exact)"
  patterns:
    - "Conformance by execution: every corpus case captures its fixture through the 07-01 CLI, so counters come from V8 and the executed text from the run's store; the identity source map (one segment per UTF-16 column plus the end-of-line column) is built by the test, not the adapter"
    - "Expectations from source text: a span is named by unique source snippets (`spanOf`, `prefixOf`, `suffixOf`), lines 1-based, columns UTF-16, end exclusive; hits from V8 block-coverage semantics; documented V8 limits recorded as limits"
    - "Delivery qualification on load: the installed producer must be the delivered payload, version, location, license and lockfile resolution or `loadProducer()` throws; an explicit entry loads as a control with its failures recorded"
    - "Maintained dependency as a reproducible artifact: verified upstream bytes + exact-context patch -> `npm pack` twice in separate temp dirs -> byte-identical archive; `--verify` reverse-applies the patch offline and requires the pinned upstream digests back"
    - "Library + CLI pairs under scripts/ (`coverage-producer.convert.mjs` + `coverage-producer.mjs`), mirroring `coverage-capture.manifest.mjs` + `coverage-capture.mjs`, so fallow sees a static consumer for every export"

key-files:
  created:
    - scripts/coverage-producer.convert.mjs
    - scripts/coverage-producer.mjs
    - scripts/build-coverage-producer.mjs
    - vendor/coverage/ast-v8-to-istanbul-1.0.6.patch
    - vendor/coverage/ast-v8-to-istanbul-1.0.6-project.1.tgz
    - vendor/coverage/LICENSE
    - vendor/coverage/PROVENANCE.md
    - tests/scripts/coverage-producer.test.ts
    - tests/scripts/coverage-producer-fixtures.ts
  modified:
    - package.json
    - package-lock.json
    - .gitignore

key-decisions:
  - "No corrected upstream release exists: the registry's latest ast-v8-to-istanbul is 1.0.6 (queried live on 2026-09-17), so the patch route was taken per D-05"
  - "The repair keeps the nested LogicalExpression's branch-deduplication skip and only stops it from becoming an ignore boundary on entry; ignore hints are matched before that check and keep their subtree semantics (checked with hint-laden snippets against the unmodified walker: identical output apart from the restored descendants)"
  - "The delivered package names the repair in its version (1.0.6-project.1) and is installed from the vendored tarball through the lockfile; `npm ci --ignore-scripts` installs the delivered payload"
  - "`--verify` is fully offline: it reverse-applies the patch to the delivered entries and requires the pinned upstream digests, so no test or gate ever fetches or edits node_modules"
  - "Function identity in this corpus is the span pair (decl, loc) plus the producer's emitted name; anonymous names are normalized only when the broken producer's shifted numbering is compared, and source-name restoration stays with 07-03 (D-04)"
  - "Istanbul's `if` branch names the whole statement as its first location; the corpus expects that convention rather than the consequent block"
  - "Commit scopes follow the repository's Conventional Commits rule (`test(coverage)`, `feat(coverage)`), not the GSD `{phase}-{plan}` scope"

patterns-established:
  - "Fixture corpus module (`coverage-producer-fixtures.ts`) owns sources, tests and expectations; the test module owns capture, conversion, projection and assertions"
  - "Delivery mutants are exercised through the shipped CLI (`--verify --vendor <copy>`), never through a bypass path; every refusal names its `{ kind }` rows"

requirements-completed: [METRIC-01, METRIC-02]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "The unmodified upstream 1.0.6 producer is rejected at exact identities: the callback nested in the left operand of a chained logical expression, its four body statements and its if branch are absent, while everything else it reports matches the hand-written expectations; the rejection is bound to the upstream payload digest"
    requirement: METRIC-01
    verification:
      - kind: unit
        ref: "tests/scripts/coverage-producer.test.ts#rejects the reconstructed upstream 1.0.6 producer: the nested logical callback, its body and its branch are absent"
        status: pass
    human_judgment: false
  - id: D2
    description: "A maintained 1.0.6-project.1 producer package reproduces from verified upstream bytes and a reviewed exact-context patch with the original license and a provenance record naming every digest; a changed archive, entry, license, patch context, provenance value or upstream integrity is refused"
    requirement: METRIC-01
    verification:
      - kind: unit
        ref: "tests/scripts/coverage-producer.test.ts#verifies the vendored delivery: archive, entries, license, patch context and provenance agree"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-producer.test.ts#refuses a patch whose context no longer matches the delivered bytes"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-producer.test.ts#refuses an archive with one extra byte"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-producer.test.ts#refuses a missing license"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-producer.test.ts#refuses a provenance record that no longer names the delivered payload digest"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-producer.test.ts#refuses to build from an upstream tarball whose integrity is not the pinned one"
        status: pass
      - kind: integration
        ref: "node scripts/build-coverage-producer.mjs --build (registry fetch, two in-process packs plus one independent sed-patched tree: archive sha256 ef911b69... three times)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The installed delivered bytes reproduce the full corpus exactly (nested logical descendants and partially executed body statements, repeated names beside a real `_2` identifier, same-line opposite coverage, constructor/accessors/async/generator/empty functions, ternary, default argument, implicit else, Unicode/CRLF endpoints, two workers merged in either order from fresh ASTs) and the identity receipt binds the installed payload to the delivery, the lockfile and the tool versions; delivery drift is refused"
    requirement: METRIC-01
    verification:
      - kind: unit
        ref: "tests/scripts/coverage-producer.test.ts#reproduces the nested-logical corpus exactly through the installed delivery"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-producer.test.ts#reproduces the names corpus exactly through the installed delivery"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-producer.test.ts#reproduces the syntax corpus exactly through the installed delivery"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-producer.test.ts#reproduces the unicode corpus exactly through the installed delivery"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-producer.test.ts#reproduces the tally corpus exactly through the installed delivery"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-producer.test.ts#sums the two workers' records under one identity, in either order, from a fresh AST each"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-producer.test.ts#records a producer identity receipt bound to the delivery, the tool versions and the runtime"
        status: pass
      - kind: unit
        ref: "tests/scripts/coverage-producer.test.ts#refuses the installed producer when the lockfile no longer resolves it to the delivery"
        status: pass
      - kind: integration
        ref: "npm ci --ignore-scripts (exit 0; node_modules/ast-v8-to-istanbul/dist/index.mjs sha256 29377dc2..., version 1.0.6-project.1)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ordinary tests and gates never mutate installed dependencies: the suite reads node_modules, writes only temporary directories (symlinking node_modules for the upstream control), and the delivery tool's tests run against copies under --vendor"
    requirement: METRIC-02
    verification:
      - kind: unit
        ref: "tests/scripts/coverage-producer.test.ts#refuses to build from an upstream tarball whose integrity is not the pinned one (asserts the vendored archive copy is unchanged after the refused build)"
        status: pass
      - kind: other
        ref: "git status after `npm run coverage:producer:check`: no tracked file changed; the CRAP setting, native thresholds and direct pins were not touched"
        status: pass
    human_judgment: false

# Metrics
duration: 1h 57m
completed: 2026-09-17
status: complete
---

# Phase 7 Plan 02: Conformance-Qualified Producer Delivery and Licensed Repair Summary

**ast-v8-to-istanbul 1.0.6 is rejected at the exact nested-callback identities it omits; a reproducible, licensed 1.0.6-project.1 tarball with a one-line walker repair is installed through the lockfile and reproduces the full independent syntax corpus, with an identity receipt that refuses any drift of payload, version, license or lock resolution**

## Performance

- **Duration:** 1h 57m (long because each commit ran the full pre-commit pipeline: lint, format, typecheck, fallow, direct coverage, type members)
- **Started:** 2026-09-17T17:15Z (approximate; first commit 17:48:27Z)
- **Completed:** 2026-09-17T19:12Z
- **Tasks:** 3 (each RED then GREEN)
- **Files modified:** 12 (9 created, 3 modified)

## Accomplishments

- **The omission is a durable failing-producer control.** `nestedLogicalFixture()` is `anyLarge(values)` = `values.some((value) => {4 statements}) && values.length > 0 && values.every((value) => value >= 0)`, run once as `anyLarge([1, 2])` through the 07-01 capture. Against the upstream 1.0.6 payload (sha256 `0ce3ec43...`) the adapter's output lacks exactly: the `some` callback (loc 2:32-9:3), its statements `value * 2`, the `if`, `return true;`, `return false;`, and the `if` branch, and nothing else differs from the hand-written expectations (anyLarge 1 hit, `every` callback 0 hits, binary-expr branch [1, 0, 0]). The control is rerun in Task 3 against the upstream payload reconstructed from the installed bytes (one line replaced; the reconstruction must hash to `0ce3ec43...`), so it stays a control after the delivery is installed.
- **The repair is bounded and reproducible.** The walker marked every nested `LogicalExpression` of a chain as skipped (branch deduplication) and then treated that skip as an ignore boundary on entry. The patch adds `&& e.type !== "LogicalExpression"` to that entry check; the `LogicalExpression` case still returns early for skipped nodes, so no branch is registered twice, and ignore hints are matched before the check. Before adopting it, hint-laden snippets (`v8 ignore if|next` around nested logicals and ternaries) were converted with both walkers: identical output apart from the restored descendants. `scripts/build-coverage-producer.mjs --build` verifies the upstream sha512, applies the patch with exact context in two separately created temporary directories, packs both with `npm pack --ignore-scripts`, refuses anything but byte-identical archives, and writes the archive plus the original LICENSE; `--verify` works offline and reverse-applies the patch. Three builds (two in-process temp dirs, one from the registry) and one independent `sed`-patched tree gave the same payload and archive digests.
- **The installed delivery passes the full corpus and is bound by a receipt.** Five fixtures (nested-logical, names, syntax, unicode, tally), all captured for real, are reproduced exactly: functions with decl/loc/hits and names, statements with hits, branches with locations and counters. `loadProducer()` throws unless the imported bytes are the delivered payload, at the delivered version, under this repository's `node_modules`, with the original license, and `package-lock.json` resolves the package to the vendored archive with its integrity. The receipt (`--receipt`) records producer, delivery qualification, acorn 8.18.0, istanbul-lib-coverage 3.2.2, @jridgewell/sourcemap-codec 1.6.0, Node/V8 and the adapter digest.

## Task Commits

1. **Task 1: Reproduce the producer omission through an independent conformance tracer** (tracer) - `8b39031c` (test, RED: `RED_EVIDENCE_OK`, target failed on `assert.strictEqual(conversion.run.status, 0)`) then `adac20ee` (feat, GREEN: 4/4)
2. **Task 2: Deliver a version-specific repair as a reproducible dependency artifact** - `5e24c4ca` (test, RED: `RED_EVIDENCE_OK`, target failed on the `--verify` verdict) then `2442b126` (feat, GREEN: 5/5, `--verify` exit 0)
3. **Task 3: Qualify the installed delivery against the full syntax corpus** - `c3109ef2` (test, RED: `RED_EVIDENCE_OK`, target `reproduces the nested-logical corpus exactly through the installed delivery` failed on the missing callback; four other corpora already matched on coverage and failed only on the not-yet-implemented receipt) then `6dfa18d5` (feat, GREEN: 18/18)

**Plan metadata:** the `docs:` commit that adds this file.

Tracer feedback gate (interactive, `human_verify_mode: end-of-phase`, automated-only verify): `node --test tests/scripts/coverage-producer.test.ts` re-run after the Task 1 GREEN commit, 4 pass 0 fail; expansion continued without a checkpoint.

## TDD Gate Compliance

- Every task has a `test(coverage)` commit preceding its `feat(coverage)` commit; RED evidence records were classified with `gsd-tools check tdd-red-evidence` (`RED_EVIDENCE_OK`, `target_test_failed`) for all three tasks before implementation.
- Commit scopes are `coverage`, per the repository's Conventional Commits rule, so the generic `test(07-02)`/`feat(07-02)` grep finds nothing by design.
- No REFACTOR commits; the one post-RED design change (splitting the adapter into a library and a CLI) happened inside the Task 1 GREEN step before its commit.

## Exact commands and results

| Command | Result |
| --- | --- |
| `npm view ast-v8-to-istanbul version versions dist.integrity` (live, 2026-09-17) | latest `1.0.6`, integrity `sha512-fvpl29he...`; no corrected release exists |
| `npm view acorn@8.18.0 / istanbul-lib-coverage@3.2.2 / @jridgewell/sourcemap-codec@1.6.0 / ast-v8-to-istanbul@1.0.6 name version license repository.url dist.integrity scripts.*install` | identities, MIT/BSD-3-Clause licenses and integrities equal to the 07-RESEARCH audit; no install scripts |
| `npm install --save-dev --save-exact --ignore-scripts acorn@8.18.0 ast-v8-to-istanbul@1.0.6 istanbul-lib-coverage@3.2.2 @jridgewell/sourcemap-codec@1.6.0` | lockfile adds exactly the four packages plus @jridgewell/resolve-uri 3.1.2, @jridgewell/trace-mapping 0.3.31, estree-walker 3.0.3, js-tokens 10.0.0 (same integrities as the research probe); acorn 8.16.0 -> 8.18.0 |
| `node --test --test-reporter=tap tests/scripts/coverage-producer.test.ts` (Task 1 RED) | exit 1; `1 !== 0` on the CLI status; `RED_EVIDENCE_OK` |
| `node --test tests/scripts/coverage-producer.test.ts` (Task 1 GREEN) | 4 pass, 0 fail |
| `node scripts/build-coverage-producer.mjs --build --upstream /tmp/packdet/upstream.tgz --vendor <scratch>` | two temp-dir packs byte-identical; archive sha256 `ef911b69...`, sha512 `6KzTeECN...`; payload `29377dc2...` |
| `node scripts/build-coverage-producer.mjs --build --vendor <scratch>` (registry fetch) | same archive sha256 `ef911b69...`; LICENSE identical |
| `node scripts/build-coverage-producer.mjs --verify` | `Producer delivery verified: ast-v8-to-istanbul@1.0.6-project.1 in .../vendor/coverage`, exit 0 |
| `--verify --vendor <copy>` with mutated patch context / archive + 1 byte / no LICENSE / provenance digest replaced | refused: `patch-digest, patch-context` / `archive-integrity, archive-digest, archive-unreadable` / `missing-license` / `provenance-missing-value` |
| `--build --upstream <bogus> --vendor <copy>` | refused `upstream-integrity`; vendored copy unchanged |
| `node --test --test-reporter=tap tests/scripts/coverage-producer.test.ts` (Task 3 RED, upstream 1.0.6 installed) | exit 1; nested-logical corpus fails on the missing callback; names/syntax/unicode/tally match on coverage and fail only on the missing receipt; `RED_EVIDENCE_OK` |
| `npm install --save-dev --ignore-scripts ./vendor/coverage/ast-v8-to-istanbul-1.0.6-project.1.tgz` | package.json `file:vendor/coverage/...`; lock `version 1.0.6-project.1`, `resolved file:vendor/coverage/...`, `integrity sha512-6KzTeECN...` |
| `npm ci --ignore-scripts` | exit 0; installed payload sha256 `29377dc2...`, LICENSE `7771f0b6...`, version `1.0.6-project.1` |
| `npm run coverage:producer:check` (final) | 18 tests, 18 pass, 0 fail, 10.7 s |
| `node --test tests/scripts/coverage-capture.test.ts` (final) | 34 pass, 0 fail (07-01 unaffected) |
| `npx tsc --noEmit`, `npx eslint scripts tests/scripts/...`, `npx prettier --check ...`, `npm run fallow` | clean, exit 0 (fallow's dupes report lists the shared entry-guard lines of the two CLIs as an informational clone; the gate exits 0) |
| `SKIP=trufflehog pre-commit run --files ...` (six runs) + trufflehog filesystem scan | every hook passed on every commit set; mdformat reflowed PROVENANCE.md once (re-staged, re-run clean); 0 verified / 0 unverified secrets |

## Assertion and coverage ledger

| Task | Independent expected result | Weakening counterexample it catches | Coverage impact |
| --- | --- | --- | --- |
| 07-02-T1 | Three functions, six statements and two branches of `anyLarge` written from the source text and V8 semantics; the omission list (1 function, 4 statements, 1 branch) written separately; the installed payload and license digests as literals | A producer that reports two functions and calls it three; a corpus generated from converter output; a Fallow match percentage; a rejection not tied to exact bytes | No production exclusion, native threshold, direct pin or assertion changed |
| 07-02-T2 | `--verify` accepts the vendored delivery; upstream integrity `sha512-fvpl29he...`, patch `a2884779...`, license `7771f0b6...`, archive `ef911b69...`/`sha512-6KzTeECN...`, payload `29377dc2...` bound in PROVENANCE.md and in `DELIVERY` | A hand-edited tarball; a patch applied with fuzz or offset; a rebuild that differs; a missing or altered license; a provenance record that stops naming a digest | Same |
| 07-02-T3 | Five corpora reproduced whole (`deepStrictEqual` on sorted functions/statements/branches); per-worker hits 1 and 2 summing to 3 in either order; receipt equal to a literal object; drift rows `producer-location`, `producer-version`, `producer-payload`, `lock-resolution` | Function-entry recovery hiding omitted body statements; a reused mutated AST losing records; a package/version change reusing qualification; a documented V8 limit asserted as exact execution (recorded as limit rows instead) | Same; the CRAP setting stays `maxCrap: 0` disabled |

Partial/zero/error paths recorded: partially executed callback body (`return true;` 0 of 4 statements), zero-hit functions (`every` callback, `skip`, `pick_2`, `count_2`), empty functions (`noop`, `empty`), same-line opposite coverage (`pick` 1 / `skip` 0), implicit else (absent location, count 2), short-circuited operands (binary-expr `[1, 0, 0]`), missing raw record (exit 1, no output), usage error (exit 2), five delivery refusals, one build refusal, one lock refusal.

## Task 1 baseline (acceptance ledger)

- Original package/version: `ast-v8-to-istanbul` 1.0.6, Ari Perkkiö, MIT, repository `git+https://github.com/AriPerkkio/ast-v8-to-istanbul.git`
- Registry archive integrity: `sha512-fvpl29helSO2w/z7utIbrkNXILdrLwDwAMH2I/zPKlGf5244+gf+B4cyS1sANcrPY2h+hWCGSgC8N61s/+AF9A==`; tarball sha256 `1be5784000618a0cf44f24d88aef3edd30ee8021414b3ed96a49c693c7aaa404`
- Producer payload (`dist/index.mjs`) sha256: `0ce3ec436049c66fff8757450230369156ee2126f52d06b41f99780e497d0a79`
- Original license sha256: `7771f0b6f55e76efe99cb8e6fdbff583193c9bdfd74d41620d330cc3db6b913a`
- Fixture source sha256 (nested-logical): `f999366d67fc0df4ef9dfa15d68ed1b0c82cd27e24531fbec11d389ba2da36eb`; expected-location corpus sha256 (JSON of functions/statements/branches): `48f7f95da9c2fc48bc362986be1966398376a32df7f68818cf96c1d89f34e7a6`
- Rejection observed at the exact expected identities listed above (missing 1 function, 4 statements, 1 branch; all present rows equal to expectations)

## Task 2 provenance (acceptance ledger)

- Patch `vendor/coverage/ast-v8-to-istanbul-1.0.6.patch` sha256 `a2884779313619c7422227896e6f9541aec8de8e525b92c679eea5acf774a068` (two hunks: `dist/index.mjs` line 20, `package.json` version)
- Archive `vendor/coverage/ast-v8-to-istanbul-1.0.6-project.1.tgz` sha256 `ef911b69325c681e15dfc141a5872a356c2333fb8153953fbfe8519265da2e49`, integrity `sha512-6KzTeECN1o+Xo9KtrN78sK5gWF37nL1vZYxrVTj/iBCE2qPGC/si5KnuDfDYV6KihNMwlMdjWciZMnsrI93fEg==`, 16313 bytes
- Delivered entries: `package/dist/index.mjs` `29377dc2bb113e40525edb050434420b0d071122c9aa382174a8d622a35c8874`, `package/package.json` `e188df9ab9e07a4cc4e6012930ae719cf4bb4344d2e8bbbcb0b6539947022685`; LICENSE, README.md and dist/index.d.mts unchanged from upstream
- License retained byte for byte (`7771f0b6...`); PROVENANCE.md names every value above and is checked by `--verify`

## Task 3 qualification receipt (acceptance ledger)

```json
{
  "producer": { "name": "ast-v8-to-istanbul", "version": "1.0.6-project.1", "entry": "<root>/node_modules/ast-v8-to-istanbul/dist/index.mjs", "payloadDigest": "29377dc2bb113e40525edb050434420b0d071122c9aa382174a8d622a35c8874", "licenseDigest": "7771f0b6f55e76efe99cb8e6fdbff583193c9bdfd74d41620d330cc3db6b913a" },
  "delivery": { "version": "1.0.6-project.1", "archive": "vendor/coverage/ast-v8-to-istanbul-1.0.6-project.1.tgz", "integrity": "sha512-6KzTeECN1o+Xo9KtrN78sK5gWF37nL1vZYxrVTj/iBCE2qPGC/si5KnuDfDYV6KihNMwlMdjWciZMnsrI93fEg==", "qualified": true, "failures": [] },
  "parser": { "name": "acorn", "version": "8.18.0" },
  "merger": { "name": "istanbul-lib-coverage", "version": "3.2.2" },
  "codec": { "name": "@jridgewell/sourcemap-codec", "version": "1.6.0" },
  "runtime": { "node": "v26.8.2", "v8": "14.6.202.34-node.28" },
  "adapter": { "coverage-producer.convert.mjs": "5477097bcd6da50a83f7ddb9d05d1297003f327b23c3ee234b1b09dd2e173a03" }
}
```

Tool and fixture identities at the final commit (sha256): `scripts/coverage-producer.mjs` `72bf2ced...`, `scripts/coverage-producer.convert.mjs` `5477097b...`, `scripts/build-coverage-producer.mjs` `99f6554a...`, `tests/scripts/coverage-producer.test.ts` `5af3c0f1...`, `tests/scripts/coverage-producer-fixtures.ts` `4a429a8c...`. Fixture source / expected-corpus digests: nested-logical `f999366d.../48f7f95d...`, names `4f67dc81.../e52cb682...`, syntax `c771f801.../d0f0c1d7...`, unicode `959eaab6.../62c0a508...`, tally `2d562d46.../1c2e68bf...`. A change to any of these, the installed payload, the lock record or the tool versions invalidates this receipt; the corpus must be rerun.

Original-defect and delivery-drift rejections: the reconstructed upstream payload loads as a control with `qualified: false` and failures `producer-location`, `producer-version` (1.0.6-project.1 vs 1.0.6), `producer-payload` (29377dc2... vs 0ce3ec43...), and its corpus output omits exactly the nested callback, four statements and one branch; a lockfile whose entry differs makes `loadProducer()` throw `ProducerError` with `producer-location` and `lock-resolution` rows.

## Files Created/Modified

- `scripts/coverage-producer.convert.mjs` - the adapter: producer loading and qualification, identity receipt, per-record conversion with a fresh Acorn AST, Istanbul merge, `ProducerError`
- `scripts/coverage-producer.mjs` - `npm run coverage:producer`: request parsing (url/code/sourceMap/coverage per script, paths relative to the request), atomic output, `--receipt`, `--producer <entry>`; inert on import
- `scripts/build-coverage-producer.mjs` - `npm run coverage:producer:build`: pinned `DELIVERY`, ustar reader, strict unified-diff applier (no offset, no fuzz, reversible), `--build` (fetch or `--upstream`, two-pack determinism) and `--verify` (offline); inert on import
- `vendor/coverage/ast-v8-to-istanbul-1.0.6.patch` - rationale header plus two hunks
- `vendor/coverage/ast-v8-to-istanbul-1.0.6-project.1.tgz` - the installed dependency
- `vendor/coverage/LICENSE` - upstream MIT license
- `vendor/coverage/PROVENANCE.md` - source, integrity, patch rationale, every digest, reproduction commands
- `tests/scripts/coverage-producer-fixtures.ts` - span helpers and the five fixtures with expectations
- `tests/scripts/coverage-producer.test.ts` - 18 controls
- `package.json` - four exact devDependencies (producer as `file:` tarball); `coverage:producer`, `coverage:producer:check`, `coverage:producer:build`
- `package-lock.json` - the corresponding records
- `.gitignore` - `!vendor/coverage/*.tgz`

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Split the adapter into a library and a CLI**

- **Found during:** Task 1 (pre-commit `npm fallow`)
- **Issue:** `fallow dead-code` reported every export of `scripts/coverage-producer.mjs` as consumer-less: the tests reach them only through a dynamic URL import, which fallow cannot follow, and the CLI part of the same file does not count as a consumer of its own exports
- **Fix:** `scripts/coverage-producer.convert.mjs` holds the adapter (exports consumed by the CLI), `scripts/coverage-producer.mjs` is the CLI with no exports, mirroring `coverage-capture.manifest.mjs` / `coverage-capture.mjs`; no suppression marker added
- **Files modified:** `scripts/coverage-producer.convert.mjs` (new), `scripts/coverage-producer.mjs`
- **Verification:** `npm run fallow` exit 0; suite green
- **Committed in:** `adac20ee`

**2. [Rule 3 - Blocking] Unignored the delivered tarball**

- **Found during:** Task 2
- **Issue:** the repository ignores `*.tgz`, so the delivery could not be tracked
- **Fix:** `!vendor/coverage/*.tgz` under the existing rule; `.gitignore` was not in the plan's file list
- **Files modified:** `.gitignore`
- **Verification:** `git add` succeeds; `check-added-large-files` passes (16 KB < 64 KB)
- **Committed in:** `2442b126`

**3. [Rule 3 - Blocking] Added the `coverage:producer:build` alias in Task 2, and exported `DELIVERY` only in Task 3**

- **Found during:** Task 2 (pre-commit `npm fallow`)
- **Issue:** an unreferenced `scripts/*.mjs` is an "unused file" for fallow, and an export without a static consumer is an "unused export"; the plan placed the alias in Task 3
- **Fix:** the package script was added with the tool; the build tool had no exports until the adapter started consuming `DELIVERY` and `VENDOR_DIRECTORY` in Task 3
- **Files modified:** `package.json`, `scripts/build-coverage-producer.mjs`
- **Verification:** `npm run fallow` exit 0 at both commits
- **Committed in:** `2442b126`, `6dfa18d5`

**4. [TDD] Task 2's RED control lives in the producer test file**

- **Found during:** Task 2
- **Issue:** the task is `tdd="true"` but its file list omits the test file; a RED needs a target test
- **Fix:** one control (`verifies the vendored delivery ...`) was added to `tests/scripts/coverage-producer.test.ts` as Task 2's RED; the mutants followed in Task 3 as planned
- **Files modified:** `tests/scripts/coverage-producer.test.ts`
- **Committed in:** `5e24c4ca`

---

**Total deviations:** 4 (3 blocking gate fixes, 1 TDD placement). All three deviations that touched files outside the plan's list are recorded in `.planning/WINDOWS.md` as `deviation` entries.
**Impact on plan:** No coverage configuration, census pin, threshold or suppression was weakened; `maxCrap: 0` stays disabled; no production export or extension code changed.

## Issues Encountered

- The first nested-logical expectation named the consequent block as the `if` branch's first location; Istanbul's convention (and the producer's `onBranch("if", ...)`) names the whole `if` statement there, with the consequent block's counter. The expectation was corrected; every other hand-written row in all five corpora matched on first run, including the V8-limit rows.
- `mdformat` reflows paragraphs in `vendor/coverage/PROVENANCE.md`; `--verify` therefore checks that the record contains every pinned value rather than comparing bytes.
- Fallow scans the whole working tree, so an untracked new script sitting next to a RED commit made the RED's hook run fail; the file was moved aside for that run and re-verified.

## Known limits

- The archive bytes depend on the `npm pack` implementation (npm 11.19.1 here). A rebuild under another npm that changes them is drift to review, not to accept silently; the payload digests are what the adapter binds to.
- `--build` needs the registry unless `--upstream <tgz>` is given; no test fetches. The registry route was exercised once by hand.
- `patch-context` is reachable through the CLI only alongside `patch-digest`, because any edit to the patch changes its digest; both rows are asserted.
- The corpus compares producer-emitted names (`current_2`, `pick_2`, `(anonymous_N)`); source-name restoration from AST identifiers is 07-03 (D-04). Anonymous numbering is normalized only when comparing the broken producer's shifted output.
- Identity source maps are built by the test; the production mapping adapter (07-03) and the independent schema/correspondence validators (07-04) must pass before any production acceptance. This plan qualifies walker and syntax behavior under valid inputs only; the CRAP gate stays disabled.
- Two V8 observation limits are recorded as limits, not as execution facts: `return 1;` after a throwing call counts 1, and a default argument that never ran reports the function's count.
- An explicit `--producer <entry>` always reports `producer-location`; that is the point of the control path.
- Verified on Node v26.8.2 (V8 14.6.202.34-node.28) and npm 11.19.1; CI's Node 24 has not been exercised by this plan.
- The two `pi-subagents` integration tests and the full `npm run check` chain were not run here; the phase-close gate (07-08) owns them.

## Threat Flags

| Flag | File | Description |
| --- | --- | --- |
| threat_flag: dependency | package.json, vendor/coverage/ | A locally built tarball is now a devDependency. Its identity is pinned four ways (lockfile integrity, `DELIVERY`, PROVENANCE.md, test literals) and reverse-verified against the registry integrity; anyone changing it must change all four and the patch. |
| threat_flag: network | scripts/build-coverage-producer.mjs | `--build` without `--upstream` fetches the registry tarball; it refuses anything whose sha512 is not the pinned value before reading it. |

## Next Phase Readiness

- 07-03 can import `loadProducer`/`convertScripts`/`producerIdentity` from `scripts/coverage-producer.convert.mjs` and supply its exact source maps; the corpus in `coverage-producer-fixtures.ts` is reusable as-is for its mapping controls.
- 07-04 owns the implicit-else convention at the consumer boundary; the producer's absent-location representation is pinned here as `{ start: {line, column: undefined}, end: {...} }`.
- 07-05 must embed the receipt from `producerIdentity()` in the accepted manifest and rerun `npm run coverage:producer:check` whenever adapter bytes change.
- Repository state: six code commits on `features/test-backlog`; `.planning/WINDOWS.md` gained three deviation rows (committed with this file); `.claude/settings.json`, `.codex/config.toml`, `.planning/state.json`, `.mcp.json` and `.planning/milestone.lock` carry uncommitted operator changes that were not touched.

---

*Phase: 07-reliable-coverage-metrics*
*Completed: 2026-09-17*

## Self-Check: PASSED

All nine created files exist on disk and all six task commits (8b39031c, adac20ee, 5e24c4ca, 2442b126, c3109ef2, 6dfa18d5) are in `git log`; `commits: 6` was measured as `git rev-list --count d3bfa42a..HEAD`.
