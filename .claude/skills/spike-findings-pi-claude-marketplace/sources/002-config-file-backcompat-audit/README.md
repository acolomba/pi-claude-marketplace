---
spike: 002
name: config-file-backcompat-audit
type: standard
validates: "Given the desired-state config file's first-run migration and schema tolerance, when audited for what backward compat is present and what removing it would cost, then produce an exact removal inventory and flag any removal that is not safe without a replacement"
verdict: PARTIAL
related: [001, 003]
tags: [backward-compat, migration, config-file, audit]
---

# Spike 002: Desired-State Config File Backward-Compat Audit

## What This Validates

Given `claude-plugins.json`'s first-run migration path and its schema's
version handling, when catalogued and traced through the reconcile
pipeline, then we can say precisely what is removable and -- critically --
whether "the desired-state config file has backward compat we could
delete" is even the right description of what's there.

## Research

Internal-architecture audit, same method as Spike 001. Additionally
checked `git log` for when the config file itself was introduced, since
"how much backward compat exists" depends on how long the transitional
window has been open.

## How to Run

```bash
git log --diff-filter=A --format="%ad %h %s" --date=short -- \
  extensions/pi-claude-marketplace/persistence/migrate-config.ts
grep -n "loadConfig(loc.configJsonPath)\|status === \"valid\" ? .*.config : {}" \
  extensions/pi-claude-marketplace/persistence/config-merge.ts
```

## What to Expect

- `claude-plugins.json` was introduced in `5f1d0c57` (v0.5.0, 2026-06-12,
  PR #51) -- ~2 months / 9 releases before this spike (v0.14.0,
  2026-08-13).
- `loadMergedScopeConfig` treats an absent config file as an empty
  `ScopeConfig {}` (`config-merge.ts:146-147`).
- `buildUninstallBucket` (`reconcile/plan.ts:358`) puts every recorded
  plugin NOT present in the merged desired config into the uninstall
  bucket.

## Investigation Trail

**First: what actually is the "backward compat" here?** Two candidates:

1. `persistence/migrate-config.ts` -- `migrateFirstRunConfig`, called once
   per reconcile from `reconcile/apply.ts:186`, BEFORE `loadMergedScopeConfig`
   runs. On the `absent` arm of `loadConfig`, it projects the current
   `state.json` into a `ScopeConfig` and writes it as `claude-plugins.json`
   (MIG-01/MIG-02). This is a genuine one-time bootstrap: users who
   installed plugins before v0.5.0 (or any scope whose config file was
   deleted) get one auto-written on next load.
2. `config-io.ts`'s `CONFIG_SCHEMA` -- checked in Spike 001's parent
   investigation and confirmed here: `schemaVersion` is `Type.Optional(Type.Literal(1))`,
   a single literal, not a union of old/new like `STATE_SCHEMA`. Unknown
   extra keys are accepted by design (D-09), which is *forward*-compat
   (tolerating a newer file with fields this version doesn't know yet),
   not backward compat for an old shape. **There is no old-shape
   tolerance to remove here** -- config-io.ts is not what the idea is
   describing, and removing D-09's leniency would be a different, unrelated
   change (making hand-edited configs stricter) that this spike does not
   recommend bundling in.

So the real target is `migrate-config.ts`: **197 production LOC + 570 test
LOC (767 total)** -- notably, more test code than Spike 001's entire
`migrate.ts` investigation, for a single one-time bootstrap path.

**Second: is it removable the same way `migrate.ts` was?** Traced what
happens on the `absent` arm if `migrateFirstRunConfig` is simply deleted
and never called.

`config-merge.ts:146-147`:
```
const baseConfig: ScopeConfig = base.status === "valid" ? base.config : {};
```
An absent config collapses to `{}` -- indistinguishable from "the user
explicitly declared nothing." `reconcile/plan.ts`'s `buildUninstallBucket`
then walks every plugin recorded in `state.json` and puts each one that
isn't in the (now-empty) merged config into the uninstall bucket.

**This is the opposite of Spike 001's finding.** `migrate.ts` field-fills
were provably inert dead weight with zero interaction with the live write
path -- deleting them is a pure code-shrink. `migrate-config.ts` is the
ONLY thing preventing "config file doesn't exist yet" from being
interpreted as "uninstall every plugin the user has installed" on the very
next `/reload`. Deleting it outright is not a code-shrink, it's introducing
a silent mass-uninstall bug for anyone whose scope predates the config
file or whose config file was deleted/never migrated.

**Third: does "we don't have enough users to worry" actually apply here?**
Partially, and differently than for `migrate.ts`. `migrate.ts` absorbs a
new field-fill on *every* future schema change (ENBL-02, HOOK-02, D-13,
and whatever comes next) -- an open-ended, recurring tax regardless of
user count. `migrate-config.ts` absorbs exactly ONE transition (pre-v0.5.0
-> config-file-based), which is largely in the past already: any scope
that has reconciled even once since v0.5.0 already has a config file and
takes the `existing-valid` short-circuit (one `loadConfig` ENOENT-check
per reconcile, not the write path). The realistic remaining exposure is
narrow -- a scope with a stale `state.json` that hasn't reconciled since
before 2026-06-12 -- but the failure mode if that narrow case is hit with
no migration path is severe (silent full uninstall), not benign.

## Results

**Verdict: PARTIAL.** The audit found real backward-compat code (197 prod
/ 570 test LOC) that is disproportionately large for what it does, and
confirmed `config-io.ts` itself carries no removable legacy baggage
(its leniency is deliberate forward-compat, a different concern). But
unlike Spike 001, this one is NOT a clean "delete it" -- `migrate-config.ts`
is load-bearing safety, not incidental compatibility shimming. Removing it
requires deciding what should happen instead when a scope has recorded
installs but no config file, so reconcile doesn't misread "no file" as "no
desired state."

This is the open question for Spike 003: does "force reinstall on
detected previous version" have an answer for this case, or does the
config-file bootstrap need to stay (in either its current form, or as a
smaller "refuse to reconcile / notify the user" guard rather than a
silent auto-write)?
