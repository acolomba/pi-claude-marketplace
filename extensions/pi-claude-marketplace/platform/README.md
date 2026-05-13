# platform/

## Purpose

External system facades. Phase 1 lands `git.ts` (an `isomorphic-git` wrapper, replacing V1's `execFile("git")` shell-out per D-18). Phase 7 may add `pi-api.ts` to make orchestrators testable without a live Pi instance (per ROADMAP Phase 7 success criterion 1).

## Allowed Imports

`platform/` may import from: `shared/` only. Imports from `edge/`, `orchestrators/`, `bridges/`, `domain/`, `transaction/`, `persistence/`, `presentation/` are forbidden. This folder is the strict external-system boundary.

## Planned Contents

- [x] `git.ts` -- `isomorphic-git` wrapper exposing `clone`, `fetch`, `pull`, `checkout`, `resolveRef`, `listBranches`, `listRemotes` (Phase 1)
- [ ] `pi-api.ts` -- thin wrapper around `@earendil-works/pi-coding-agent` for testability (Phase 7)
