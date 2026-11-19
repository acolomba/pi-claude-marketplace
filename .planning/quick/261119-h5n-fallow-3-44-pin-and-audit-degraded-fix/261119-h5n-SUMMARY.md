---
quick_id: 261119-h5n
status: complete
commit: fa449db
---

# Quick task 261119-h5n summary

Pinned fallow to 3.44.0 and removed the `production-excluded-file-imported`
workspace diagnostic that made the `fallow-audit` job fail on a degraded
analysis.

## Changes

- `package.json`: `"fallow": "3.44.0"`. `package-lock.json` drops the optional
  `fallow-type-aware` package, which 3.44.0 no longer ships.
- `test/e2e/_rpc.ts` -> `features/lib/pi-rpc.ts`, the RPC driver the cucumber
  harness uses. Its whole-session runner (`runRpcSession` and its types), which
  only `test/e2e/adapter-detection-rpc.test.ts` uses, moved to
  `test/e2e/_rpc-session.ts`, so production dead-code mode reports no export
  that only an excluded test consumes.
- `test/pi-runtime.ts` -> `features/lib/pi-runtime.ts`, because `pi-rpc.ts`
  imports it and would raise the same diagnostic.
- `test/platform/isolated-pi-home.ts` -> `scripts/isolated-pi-home.mjs`, the
  `--import` preload of every `node --test` script, beside
  `scripts/test-reporter.mjs`.
- Importers, npm scripts, `scripts/pi.sh`, the live-UAT canaries and README,
  the cucumber and local-verification skills, and the codebase docs follow the
  new paths.
- fallow 3.44.0 re-spans the reviewed clone groups of
  `scripts/check-corresponding-tests.mjs` and
  `scripts/check-workflow-install-scripts.mjs`; their markers moved (52 -> 51
  markers repo-wide).

Rejected: `production.ignore: ["features/**", "scripts/**"]`, which would stop
the dead-code gate from checking the harness and the scripts.

## Verification

- `npx fallow audit --root . --quiet --format json --changed-since origin/main`:
  verdict `pass`, no workspace diagnostic.
- `npm run fallow`, `npm run lint`, `npm run typecheck`: pass.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
