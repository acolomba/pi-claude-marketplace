# shared/

## Purpose

Pure-leaves. The 5 ES-5 user-contract marker constants (`shared/markers.ts`), severity-named `ctx.ui.notify` wrappers (`shared/notify.ts`), atomic JSON write (`shared/atomic-json.ts`), symlink-refusing path containment (`shared/path-safety.ts`), and Error.cause-chaining helpers (`shared/errors.ts`).

`shared/notify.ts` is the SOLE sanctioned `ctx.ui.notify(` call site -- the per-file ESLint override turns `no-restricted-syntax` off here.

## Allowed Imports

`shared/` MUST NOT import from any other extension folder. Pure leaves only. External imports (`node:*`, `write-file-atomic`, `@earendil-works/pi-coding-agent`) are fine.

## Planned Contents

- [x] `markers.ts` -- PRD §6.12 ES-5 prefix constants (Phase 1)
- [x] `errors.ts` -- `errorMessage`, `appendLeakToError`, `appendLeaks` (Phase 1; verbatim V1 port)
- [x] `notify.ts` -- `notifySuccess`, `notifyWarning`, `notifyError` (Phase 1)
- [x] `atomic-json.ts` -- `atomicWriteJson` via `write-file-atomic@^8` (Phase 1)
- [x] `path-safety.ts` -- `assertPathInside`, `PathContainmentError`, `SymlinkRefusedError` (Phase 1)
- [ ] `types.ts` -- shared type bundle including `Scope` (Phase 2 -- moves `Scope` from `domain/` to keep `edge/` free of `domain/` imports)
