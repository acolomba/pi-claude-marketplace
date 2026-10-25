---
phase: 20-path-source-version-and-missing-source
reviewed: 2026-10-23T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - extensions/pi-claude-marketplace/orchestrators/plugin/info.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/install.messaging.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts
  - extensions/pi-claude-marketplace/shared/probe-classifiers.ts
  - features/plugin/info.feature
  - features/plugin/install.feature
  - features/plugin/list.feature
  - test/architecture/cross-surface-reason-parity.test.ts
  - test/orchestrators/plugin/info.test.ts
  - test/orchestrators/plugin/install.messaging.test.ts
  - test/orchestrators/plugin/list-candidate-row.test.ts
  - test/shared/probe-classifiers.test.ts
findings:
  critical: 1
  warning: 2
  info: 4
  total: 7
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-10-23
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

I reviewed the uncommitted diff for VER-02 (path-source candidate rows show the
plugin.json version before the entry version) and SRC-01 (the resolver note
`source dir does not exist: <path>` maps to `source missing`). I traced the
callers of the widened `ResolverNoteReason` union: `mcp-migration.ts` only checks
`.includes("malformed mcp")`, and `fetch.ts`, `info.ts`, and `list-candidate-row.ts`
pass the result into `ContentReason` fields, which already include
`source missing`. None of them breaks.

The version change is correct for the `installable` and `partially-available`
arms. `resolveDeclaredPluginVersion` never throws, so its call outside the
`try` in `availableRowMessage` and in `buildNotInstalledRow` is safe.

One correctness defect is proven: the read-only classifier puts the new arm
after the broad `includes("lspServers")` arm. The note embeds an absolute path
that the author or user controls, so for some paths the read-only surfaces and
install disagree. This breaks the parity this phase adds. Two warnings follow:
an unavailable path tree with a plugin.json on disk shows a different version
than an unavailable warm git tree, and no test covers the info
`partially-available` arm of VER-02.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: The `lspServers` substring arm captures a missing-directory note, so list and info read `{lsp}` while install reads `{source missing}`

**File:** `extensions/pi-claude-marketplace/shared/probe-classifiers.ts:159-166`
**Issue:** `classifyResolverNote` checks `note.includes("lspServers")` (line 159)
before the new `note.startsWith(SOURCE_DIR_MISSING_NOTE)` arm (line 164). The
resolver note is `source dir does not exist: ${pluginRoot}`
(`domain/plugin-resolver.ts:576`), and it embeds the absolute plugin root. That
path includes the marketplace root and the entry's `source` path, and the
author or user controls both. The install classifier has no substring
`lspServers` arm. It matches `contains lspServers` exactly, through
`manifestFieldTokenFromNote`. So the two surfaces split. I ran both public
entry points (`narrowResolverNotes` and `classifyEntityShapeError`) on a sample
note:

```
"source dir does not exist: /home/u/mps/lspServers-kit/plugins/ghost"
  install  = [ 'source missing' ]
  readonly = [ 'lsp' ]
```

`list` and `info` would then show `⊘ ghost (unavailable) {lsp}` for a directory
that does not exist, and `install` would show `{source missing}`. This breaks
SRC-01 and the SURF-01 install-to-read-only parity that
`cross-surface-reason-parity.test.ts` pins. The comment above the
`malformed mcp` arms (lines 146-153) describes this exact class of bug, an
author-controlled path in a note that hits the `lspServers` substring. The new
arm repeats that bug. The parity row added at
`test/architecture/cross-surface-reason-parity.test.ts:78` uses
`/mp/plugins/ghost`, so it cannot catch the bug.

**Fix:** Move the prefix arm above the substring arm, and add a parity row with
a hostile path:

```ts
  if (note.startsWith("malformed mcp reference") || note.startsWith("malformed mcp server ")) {
    return "malformed mcp";
  }

  // SRC-01: the note embeds the absolute plugin root, which the author or user
  // controls, so this prefix arm runs before the broad `lspServers` substring arm (WR-01).
  if (note.startsWith(SOURCE_DIR_MISSING_NOTE)) {
    return "source missing";
  }

  if (note.includes("lspServers")) {
    return "lsp";
  }
```

```ts
  { note: "source dir does not exist: /mp/lspServers-kit/ghost", reason: "source missing" },
```

## Warnings

### WR-01: An unavailable path tree shows the entry version, but an unavailable warm git tree shows plugin.json's version

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/list-candidate-row.ts:91-93`, `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2736-2739`
**Issue:** The phase goal (ROADMAP Phase 20) is that "a path-source plugin
reports its version ... the same way a git-source plugin does". The git
branches compute the declared version from `presence.pluginRoot` for every
resolver state, `unavailable` included: see `list-candidate-row.ts:111-121`
(`version` is set whenever `presence.kind === "materialized"`) and
`info.ts:2542` (`warmVersion` is passed to `buildWarmGitNonInstallableRow` for
the `unavailable` arm too). The new path branches skip the read on
`unavailable`. A plugin whose tree exists but resolves `unavailable` shows
different versions by source kind. Examples are a malformed `hooks.json`, a
malformed MCP reference, or a structural `contains <kind>` note. With
plugin.json at 2.0.0 and the entry at 1.0.0, the warm git row reads `v2.0.0`
and the path row reads `v1.0.0`. D-02 justifies the skip with "the unavailable
arm has no root (NFR-7)". That limit is in the type, not in the data: the git
arm reads the tree anyway, and `info` already computes the path root without
the resolver (`resolveInfoPluginRootFsOnly`, `info.ts:1327`).
**Fix:** Do one of two things. Option 1: derive the contained path root
outside the resolver and use the declared version for an unavailable path
tree whose root exists and is contained. Keep the entry version only for the
missing-directory and NFR-10 escape cases, so the read never leaves the
marketplace root. Option 2: record the divergence in CONTEXT.md as a decision
that names the git asymmetry. As written, D-02 says only that the unavailable
arm "has no root".

### WR-02: Nothing pins the `partially-available` info row of VER-02 (D-03)

**File:** `test/orchestrators/plugin/info.test.ts:745-797`, `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2745-2748`
**Issue:** D-03 and Task 1 of the plan require that `info` on a not-installed
`partially-available` path plugin shows plugin.json's version. The new info
tests cover only the `available` arm (`v0.6.0`) and the missing-directory
`unavailable` arm. On the `unavailable` arm, `treeVersion === version` by
construction. Suppose someone reverts `version: treeVersion` to `version` in
the `buildNotInstalledNonInstallableRow` call. Every unit test and every
cucumber scenario still passes, and direct coverage stays at 100%, because the
ternary's two branches are still exercised. The existing partially-available
info tests (for example `ANAME-07`, around line 7224) write a plugin.json with
no `version`, so they read the entry version either way. The list pair has
this case (`list-candidate-row.test.ts`, "a partially available path row shows
the version its plugin.json declares"). The info pair does not.
**Fix:** Add an info unit test for a path plugin that resolves
`partially-available`, for example an entry with `lspServers`, entry
`version: "1.0.0"`, and plugin.json `version: "2.0.0"`. Assert the rendered row
`⊖ <name> v2.0.0 (partially-available) {lsp}`.

## Info

### IN-01: The note prefix is still hard-coded at its producer and at a third consumer

**File:** `extensions/pi-claude-marketplace/domain/plugin-resolver.ts:576`, `extensions/pi-claude-marketplace/orchestrators/plugin/enable-disable.messaging.ts:198`
**Issue:** `SOURCE_DIR_MISSING_NOTE` was added so that the classifiers share
one prefix. But the resolver, which emits the note, still builds it from a
literal. `enable-disable.messaging.ts` also matches its own copy of
`"source dir does not exist"`. If the resolver's wording changes, the parity
test still passes, because both classifiers share the constant. Only the
resolver unit tests, which use `includes(...)`, and the cucumber scenarios
would catch it. `domain/` may import `shared/`.
**Fix:** Emit the note as `` `${SOURCE_DIR_MISSING_NOTE}: ${pluginRoot}` `` in
the resolver, and use the constant in `enable-disable.messaging.ts` too. D-07
leaves the logic there as it is, but changing that file only to use the
constant is still possible.

### IN-02: The info version read goes around the injected `PluginInfoReader`

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/info.ts:2736-2739`
**Issue:** `info` resolves through `reader.readTextFile` and reads the
plugin's own manifest for `dependencies` through `reader`
(`readOwnManifestDependencies`). The new version read uses raw `node:fs`
through `resolveDeclaredPluginVersion`. A test or caller that injects a reader
sees a manifest read that the reader does not control, and plugin.json is now
read three times per row. The git branch already does the same
(`info.ts:2543`), so this is a consistency note, not a regression.
**Fix:** No change is needed for this phase. If the reader seam is meant to be
complete, a later change can give `resolveDeclaredPluginVersion` an optional
reader parameter.

### IN-03: Test notes use wording the resolver never emits, and one pins a near-miss as `unsupported source`

**File:** `test/shared/probe-classifiers.test.ts:94,266`, `test/orchestrators/plugin/install.messaging.test.ts:1099`
**Issue:** The rewritten "unmatched note" cases use `"source kind npm is not
supported"`. The resolver's real note is `"unsupported source kind: npm"`
(`plugin-resolver.ts:228`). The existing install case "maps a source note to
unsupported source" still uses `"source directory does not exist"`. That case
now pins a near-paraphrase of the missing-directory note as
`unsupported source`, next to a new case that maps the real note to
`source missing`. A reader cannot tell which wording is the contract.
**Fix:** Use `"unsupported source kind: npm"` in the probe-classifier cases.
Change the install case to the same real note, or use a clearly unrelated
source note.

### IN-04: The arm-order and vocabulary doc comments do not mention the new arm

**File:** `extensions/pi-claude-marketplace/shared/probe-classifiers.ts:67-74,128-136`
**Issue:** The JSDoc of `classifyResolverNote` says that arm order matters
and lists only the `malformed mcp` ordering. The module comment above
`UnsupportedReason` lists the reasons that `narrowResolverNotes` maps to
(hooks, LSP, source, malformed MCP) and leaves out `source missing`. After the
CR-01 fix, the ordering of the new prefix arm also matters and needs a
mention.
**Fix:** Name the `source dir does not exist` arm and its position relative to
`lspServers` in the `classifyResolverNote` JSDoc. Add `source missing` to the
`UnsupportedReason` module comment.

### Out of scope, noted only

SRC-01 names only `info`, `install`, and `list`. These surfaces still name a
missing path directory differently: `reinstall` maps every `PluginShapeError`
to `source mismatch` (`reinstall-record.ts:93-95`), and `update` folds it to
`no longer installable` (`update-preflight.ts:447-451`). These are not
findings against this phase. A later parity phase may want them.

---

_Reviewed: 2026-10-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
