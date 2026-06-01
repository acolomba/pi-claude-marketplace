# platform/

## Purpose

External system facades. Phase 1 lands `git.ts`. Phase 7 added `pi-api.ts`. Phase 31 adds `git-credential.ts` (AUTH-06/08/09), the only file in the extension tree permitted to import node:child_process under the narrowed D-21 whitelist.

## Allowed Imports

`platform/` may import from: `shared/` only. Imports from `edge/`, `orchestrators/`, `bridges/`, `domain/`, `transaction/`, `persistence/`, `presentation/` are forbidden. This folder is the strict external-system boundary.

## Planned Contents

- [x] `git.ts` -- `isomorphic-git` wrapper exposing `clone`, `fetch`, `pull`, `checkout`, `resolveRef`, `listBranches`, `listRemotes` (Phase 1)
- [x] `git-credential.ts` -- CredentialOps interface + DEFAULT_CREDENTIAL_OPS spawning `git credential fill/approve/reject` for OS-keychain access (Phase 31, AUTH-06/08/09)
- [ ] `pi-api.ts` -- thin wrapper around `@earendil-works/pi-coding-agent` for testability (Phase 7)
