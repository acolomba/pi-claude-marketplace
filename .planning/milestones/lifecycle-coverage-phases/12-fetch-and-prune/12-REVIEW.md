---
phase: 12-fetch-and-prune
reviewed: 2026-10-23T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - features/plugin/fetch.feature
  - features/plugin/prune.feature
findings:
  critical: 2
  warning: 10
  info: 2
  total: 14
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-10-23
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

I reviewed the scenarios that commits bfd675c6 and f6afe5c1 added. I did not review the Phase 1 seed scenarios. The rubric was the cucumber skill (`SKILL.md`, `rules/features.md`, `rules/steps.md`, `rules/layout.md`). I checked the scenarios against FET-01..03, PRN-01..03, the Phase 12 roadmap criteria, and 12-CONTEXT.md decisions. I checked the product behavior they pin against `orchestrators/plugin/fetch.ts`, `prune.ts`, and the code they call.

Gates: `npx cucumber-js features/plugin/fetch.feature features/plugin/prune.feature` passed (13 scenarios, 142 steps), and `npm run check:features` exited 0.

To confirm the findings, I ran throwaway probe scenarios from the scratchpad. They are not in the repo, and no repo file changed. The probes showed:

- After `fetch`, the unpinned `ghp` mirror's HEAD is revision 2 and its `plugin.json` says `2.0.0`. So the product does advance the mirror, but no scenario observes it.
- `prune --dry-run` leaves `resources/skills/lib-skill` staged, and a real prune removes it.
- `prune` leaves a clone that `fetch` warmed for a plugin that is not installed, and still reports `prune-empty`.
- `reinstall ghp@gits` after a fetch of revision 2 makes no request and reports `{ghp revision 1}`, but it stages from the revision-2 mirror.

Main concerns:

1. Two scenario titles claim a state that no `Then` observes: "downloads its new revision" and "removes nothing".
2. Several scenarios check the result but not the state left afterwards, or skip the request log on a git-source scenario.
3. One product concern: for an unpinned source, the installed plugin's root is the shared mirror that `fetch` refreshes in place. The scenarios pin "installs no new version" as correct.

## Critical Issues

### CR-01: The "downloads its new revision" scenario never observes the new revision

**File:** `features/plugin/fetch.feature:33-57`
**Issue:** The scenario publishes revision 2 of `ghp` (lines 43-45), but no `Then` depends on it. The row (`available`, no version) and the request log (`GET info/refs 200`, `POST git-upload-pack 200`) are the same as in the seed scenario at lines 7-31, where the host has no new revision. A plausible wrong implementation still passes. For example, a refresh that downloads objects but never moves the mirror's ref or checkout leaves HEAD at revision 1, and the scenario cannot tell. The probe shows that the product moves HEAD to revision 2 today, so only the scenario is too weak. FET-01's "refreshes the cached source" has no state-after check anywhere in the file: no fetch scenario reads the clone after the fetch.
**Fix:** Assert the revision the cache holds after the fetch. `the project scope holds these git clones:` prints an empty revision for an unpinned mirror, and `features/lib/git-clones.ts` is a foundation file. So add a fetch-verb step in `features/step_definitions/plugin/fetch.steps.ts` that reads the mirror's HEAD (fs only, like `readMirrorHeadSha`) and projects the revision token. For example:

```gherkin
    Then the git host receives these requests:
      | method | path                                            | status |
      | GET    | /acme/ghp.git/info/refs?service=git-upload-pack | 200    |
      | POST   | /acme/ghp.git/git-upload-pack                   | 200    |
    Then the fetched clone of the plugin "ghp" in the project scope holds {ghp revision 2}
```

Another way: extend `readGitClones` to report a mirror's HEAD as its revision. Do that as a separate follow-up commit, because the file belongs to the foundation. Then use `the project scope holds these git clones:` with `| plugin | https://github.com/acme/ghp.git | {ghp revision 2} |`.

### CR-02: The dry-run scenario checks only the record, not that "nothing" was removed

**File:** `features/plugin/prune.feature:58-77`
**Issue:** The title says the preview "removes nothing", but the only state-after check is the installation record (lines 75-77). A plausible wrong dry-run passes. For example, one that runs the sweep and the unstage cascade but skips `tx.save()` removes the staged skill and keeps the record. PRN-02 says "removes nothing". The probe confirms that after a dry run `resources/skills/lib-skill` is still staged, and that a real prune removes it. So the right assertion is available and passes today.
**Fix:** Add the staged-resources check after the record check:

```gherkin
    Then the project scope stages these skills and prompts:
      | kind  | name      |
      | skill | lib-skill |
```

## Warnings

### WR-01: Read-only and uninstall-like commands on git sources do not assert that no request was made

**File:** `features/plugin/fetch.feature:59-84`, `features/plugin/prune.feature:34-56`
**Issue:** `list` must stay offline (NFR-5), and `prune` is an uninstall sweep, which NFR-5 also keeps offline. Both scenarios use a git-source plugin, so both can make a request, but neither states the request log. The steps rules say a command's requests go unchecked unless a log step states them. A `list` or `prune` that refreshes the mirror would pass.
**Fix:** Add `Then the git host receives no request` to both scenarios.

### WR-02: The git-source prune scenario does not check the record, and cannot show the clone existed before the prune

**File:** `features/plugin/prune.feature:34-56`
**Issue:** Only the row and `the project scope holds no git clones` are checked. A prune that removes the clone but does not persist the record removal passes. The path-source scenario checks `the project scope has no installed plugins`, but this one does not. Also, nothing in the scenario shows a clone was in the project scope before the `When`. If the install kept the mirror elsewhere, or the earlier `uninstall app` swept it, "holds no git clones" passes and proves nothing about prune.
**Fix:** Add `Then the project scope has no installed plugins`. To ground the precondition, add a prune-verb `Given` in `features/step_definitions/plugin/prune.steps.ts` that asserts the plugin's clone is present before the prune, or add a dry-run first step in a separate scenario that states the clone.

### WR-03: The "keeps" scenarios do not show what was kept

**File:** `features/plugin/prune.feature:79-92`, `features/plugin/prune.feature:94-109`
**Issue:** Both titles say "Pruning keeps …", but they check only the `prune-empty` envelope. A wrong implementation that removes `lib` and still emits `prune-empty` (for example, by reporting from the wrong member list) passes. The skill counts a missing state-after assertion as a top finding.
**Fix:** Add the record check. For lines 79-92: `Then the installation record of the project scope holds these plugins:` with `app@tools 1.0.0 true` and `lib@tools 1.2.0 true`. For lines 94-109: the same step with only `lib@tools 1.2.0 true`.

### WR-04: The bare-fetch scenario does not prove that `--scope` limits the sweep

**File:** `features/plugin/fetch.feature:124-163`
**Issue:** The title is "every marketplace in the scope", but no marketplace exists in the other scope. A bare fetch that ignores `--scope project`, for example because the edge handler drops the flag, would sweep `["project", "user"]` and still pass.
**Fix:** Add a user-scope marketplace that offers a git-source plugin, and keep the stated request log. Its absence from the rows and the log then proves the scope filter.

### WR-05: The doubled request log of the bare fetch is not explained

**File:** `features/plugin/fetch.feature:154-163`
**Issue:** Each repository appears twice (GET plus POST, then GET plus POST again). A reader cannot tell why without reading `clone-cache.ts:300-318`: a cold unpinned mirror is cloned and then refreshed at once ("refresh-on-warm", D-79.1-02). The scenario pins a redundant round trip as the contract, and the feature file does not say so. This fails the skill's second question.
**Fix:** State the cold-mirror behavior in the title or the feature description, for example "A bare fetch clones and then refreshes the mirror of each git-source plugin in the scope". Or get a decision on whether the double fetch is intended before pinning it.

### WR-06: The refused-plugin scenario does not check the clones left afterwards

**File:** `features/plugin/fetch.feature:86-122`
**Issue:** FET-02's partial failure should leave the scope clean (NFR-3 fail-clean). It should hold the pinned `urlp` clone at revision 1 and nothing for the refused `ghp`. No state-after step checks this. A refused cold clone that leaves a half-made mirror directory passes. The next fetch or install would then treat that directory as warm.
**Fix:** Add:

```gherkin
    Then the project scope holds these git clones:
      | clone  | origin                           | revision          |
      | plugin | https://{git host}/acme/urlp.git | {urlp revision 1} |
```

### WR-07: PRN-01 "removes … unused clones" is not proven, and the product does not do it

**File:** `features/plugin/prune.feature:34-56`; product `extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts:162-164`, `:348-356`
**Issue:** PRN-01 says prune "removes orphaned dependencies and unused clones and reports each one". The scenarios cover only the clone of a pruned dependency, which D-07 reads narrowly. The probe confirms that a clone with no installed record, here one that `fetch` warmed, survives `prune`, and the result is `prune-empty`. Clone GC runs only through `finalizePrunedMembers`, once per removed member, so a scope with no orphaned dependency never sweeps clones. No row reports a clone either. The requirement as written does not hold.
**Fix:** Decide with the user. One option is to narrow PRN-01 in REQUIREMENTS.md to "the clones of the dependencies it removes" and record the decision. The other is to change prune so it always runs `garbageCollectPluginClones` and reports what it removed, then add a scenario: fetch a plugin that is not installed, prune, and see the clone removed.

### WR-08: PRN-02 says "the same rows", but the dry-run row drops the version

**File:** `features/plugin/prune.feature:72-74` against `:29-31`; product `extensions/pi-claude-marketplace/orchestrators/plugin/prune.ts:238-253`
**Issue:** The real prune row carries `version 1.2.0`. The dry-run row, which `prune.ts` builds by hand, has no `version`. The scenario pins the omission as correct, without a recorded decision, against PRN-02's "reports the same rows". A user previewing a prune cannot see which version would be removed.
**Fix:** Add the recorded version to the dry-run row in `prune.ts`, from the candidate's record, and add `| version | 1.2.0 |` to the dry-run table. Or record a decision that the preview omits it and reword PRN-02.

### WR-09: Product concern, encoded as correct: an unpinned plugin's installed root is the mirror that fetch refreshes in place

**File:** `features/plugin/fetch.feature:59-84`; product `extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts:318`, `bridges/hooks/hook-env.ts:64`, `orchestrators/plugin/reinstall-clone-probe.ts:66-75`, `orchestrators/plugin/reinstall-record.ts:205-209`
**Issue:** The scenario proves "installs no new version" only through the record version that `list` shows. For an unpinned source, install records `resolvedSource` as the URL-keyed mirror itself. The scope holds just one clone directory, `plugin-clones/<12 hex>`. `fetch` refreshes that mirror in place, and the probe shows it holds `plugin.json` `2.0.0` afterwards. Hooks get `CLAUDE_PLUGIN_ROOT = resolvedSource`, and MCP `${CLAUDE_PLUGIN_ROOT}` substitutes the same path. So after a fetch, hook scripts and MCP servers run revision-2 code, while `list` still reports `{ghp revision 1}`.

A later `reinstall` makes it worse. It reads the mirror HEAD (revision 2) and stages from it, but carries the old `version` and `resolvedSha` (revision 1). The probe showed a `reinstalled` row with `{ghp revision 1}` and no request. Install and update also refresh the shared mirror, so this design predates the phase. Even so, FET-01's "without installing a new version" does not hold for an unpinned plugin that has hooks or MCP servers.
**Fix:** Raise this with the user. It is a product decision, not a scenario edit. One option is to give unpinned installs a sha-keyed clone, so the mirror is only a fetch cache. Another is to accept and document that fetch updates the live root of unpinned plugins, and reword FET-01. If the product changes, extend this scenario to show that the plugin's root still holds revision 1.

### WR-10: The feature descriptions no longer match the scenarios

**File:** `features/plugin/fetch.feature:3-5`, `features/plugin/prune.feature:3-5`
**Issue:**

- `fetch.feature` says fetch refreshes "an installed git-source plugin". The new scenarios at lines 86-163 fetch plugins that are not installed, because the fetch set comes from the manifest (D-81).
- `prune.feature` says the scenarios "use a local marketplace in place of a published one". The git-source scenario at lines 34-56 also uses the loopback https git host as the plugin's stand-in.

`rules/features.md` says the description names what the scenarios stand in for.
**Fix:**

- In `fetch.feature`, say "refreshes the cached source of the git-source plugins a marketplace offers, installed or not".
- In `prune.feature`, add that a loopback https git host serves the git-source dependency.

## Info

### IN-01: The bare form's continue-after-failure is not exercised

**File:** `features/plugin/fetch.feature:124-163`
**Issue:** FET-02 says both `fetch @<mp>` and a bare `fetch` continue after one plugin fails. Only the `@<mp>` scenario arms a 404. The two forms share the loop in `fetch.ts:165-180`, so the risk is low.
**Fix:** Optionally arm `ghp` with 404 in the bare scenario, or accept the shared loop as enough and note it in VERIFICATION.

### IN-02: Clone GC discards caches that fetch warmed for plugins that are not installed

**File:** product `extensions/pi-claude-marketplace/orchestrators/plugin/clone-gc.ts:74-117`
**Issue:** `garbageCollectPluginClones` deletes every `plugin-clones/<key>` that no installed record references. So the next uninstall, update, or member-removing prune throws away the cache that `fetch` warmed for a plugin that is not installed. Scenarios 4 and 5 of `fetch.feature` warm exactly such caches. This is not a scenario defect. It is a design tension worth recording next to WR-07.
**Fix:** Record it in the backlog, or record a decision about the intended lifetime of a fetch-warmed cache.

---

_Reviewed: 2026-10-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
