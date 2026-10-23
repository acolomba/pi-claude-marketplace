---
phase: 14-bootstrap-browse-help-and-usage-errors
reviewed: 2026-10-23T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/help.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/import.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/info.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/install.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/list.ts
  - extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts
  - extensions/pi-claude-marketplace/edge/handlers/shared.ts
  - extensions/pi-claude-marketplace/orchestrators/marketplace/add.ts
  - extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts
  - features/plugin/bootstrap.feature
  - features/plugin/browse.feature
  - features/plugin/help.feature
  - features/plugin/usage-errors.feature
  - test/edge/handlers/plugin/bootstrap.test.ts
  - test/edge/handlers/plugin/browse.test.ts
  - test/edge/handlers/plugin/help.test.ts
  - test/edge/handlers/plugin/import.test.ts
  - test/edge/handlers/plugin/info.test.ts
  - test/edge/handlers/plugin/install.test.ts
  - test/edge/handlers/plugin/list.test.ts
  - test/edge/handlers/plugin/pending.test.ts
  - test/edge/handlers/shared.test.ts
  - test/edge/register.test.ts
  - test/orchestrators/marketplace/add.test.ts
  - test/orchestrators/plugin/bootstrap.test.ts
findings:
  critical: 0
  warning: 3
  info: 7
  total: 10
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-10-23
**Depth:** standard (plus targeted cross-file tracing of router -> help handler, bootstrap -> addMarketplace -> handleAddFailure)
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Scope: `git diff 1d4695bc..HEAD -- extensions test features` (commits 7160e8f9, 967ae9ca, 26e8e699, 17499519, 98981a74), checked against 14-CONTEXT D-01..D-11, CONVENTIONS.md, and the cucumber / typescript-style / typescript-unit-tests skills.

Verification run: the owner tests of browse, help, edge/handlers/shared, edge bootstrap, and orchestrator bootstrap pass (`node --test`). `npx cucumber-js` on the four phase features passes 123 of 123 scenarios. ESLint on every changed `.ts` file exits 0. I also ran a probe script against `selectClaudePluginRoute` and `makeHelpHandler` to confirm WR-01.

The bootstrap failure path (D-01) is correct. A classified add failure emits exactly one row through `notifyAddFailure` and skips autoupdate. An unclassified error is rethrown by `handleAddFailure` before it notifies, so the handler's catch-all row is the only row. `InvalidGitHubBaseUrlError` still fails the command. In both cases the bootstrap emits one row or a thrown error, never two rows and never zero. The feature's `lastResult()` requires exactly one result, so the 404 scenario does prove that autoupdate was skipped.

The main defects:
- The help route computes its `commandId` from raw text, but the help handler now tokenizes, so the two can disagree.
- `pending` still detects an unknown flag only at the first position, so D-03 is incomplete for it.
- The usage-errors outlines do not test a flag that follows a surplus positional, so the `pending` defect gets through the suite.

## Warnings

### WR-01: Quoted `help` topic shows the marketplace usage under the `plugin help` command identity

**File:** `extensions/pi-claude-marketplace/edge/router.ts:268` (with `extensions/pi-claude-marketplace/edge/handlers/plugin/help.ts:18-35`)
**Issue:** The router picks the identity with `rest.trim() === "marketplace"`, so it compares the raw text. The help handler now runs `tokenizeArgs`, which strips quotes. Before this phase both sides read the raw text and agreed. Now they disagree on a quoted topic. Probe output:
```
"help 'marketplace'" -> plugin help | info: Usage: /claude:plugin marketplace <add|remove|...> ...
"help \"marketplace\"" -> plugin help | info: Usage: /claude:plugin marketplace <add|remove|...> ...
"help marketplace"   -> marketplace help | info: Usage: /claude:plugin marketplace ...
```
In json/rpc mode the result's `origin.commandId` says `plugin help`, but the payload is the marketplace usage. The feature steps do not state `origin`, and `register.test.ts:1413-1428` has no quoted row, so nothing catches this.
**Fix:** Derive the identity from the same tokens the handler reads:
```ts
case "help": {
  const topics = tokenizeArgs(rest).map((token) => token.value);
  return {
    commandId: topics.length === 1 && topics[0] === "marketplace" ? "marketplace help" : "plugin help",
    handler: handlers.help,
    args: rest,
  };
}
```
Then add `help 'marketplace'` → `marketplace help` to the router/register identity table.

### WR-02: `pending` reports a surplus positional instead of the unknown flag when the flag comes second (D-03 incomplete)

**File:** `extensions/pi-claude-marketplace/edge/handlers/plugin/pending.ts:38-46`
**Issue:** `pending` checks only `parsed.positional[0]`. So `pending --bogus` gives `Unknown flag: "--bogus".`, but `pending extra --bogus` gives `Too many arguments.`. The order of the tokens changes the verdict. Every other verb this phase touched scans all tokens for a flag before it counts positionals: `rejectUnknownFlag` for bootstrap/import/browse/help, the loops in list and info, and `extractLocalFlag` for install. `parseCommandArgs` documents the same precedence (`args-schema.ts:63-66`: scope errors, then unknown flag, then surplus). Commander also reports the unknown option before the excess arguments. D-03 lists `pending` as a verb to fix, and only its wording changed.
**Fix:** Reuse the new helper so that the precedence is the same everywhere:
```ts
if (rejectUnknownFlag(parsed.positional, { ctx, run, usage: USAGE })) {
  return;
}

if (parsed.positional.length > 0) {
  notifyUsageError(ctx, run, { message: "Too many arguments.", usage: USAGE });
  return;
}
```
Add a `pending extra --bogus` row to `pending.test.ts`.

### WR-03: Unknown-flag outline lets an order-dependent flag check pass for the zero-operand verbs

**File:** `features/plugin/usage-errors.feature:79-111`
**Issue:** For `bootstrap`, `import`, `browse`, and `pending`, the outline puts the unknown flag only as the first and only token (`bootstrap --bogus`, `import --bogus`, `browse --bogus`, `browse --scope user`, `pending --bogus`, `pending --local`, `import --local`). An implementation that checks only the first token passes every one of these rows. One verb has that implementation today (WR-02), and the suite stays green. Under the cucumber skill, a scenario that a plausible wrong implementation passes is the highest-value finding. Only `help`, `list`, `info`, and the one-operand verbs put the flag after a positional.
**Fix:** Add rows that put the flag after a surplus positional, one for each zero-operand verb:
```gherkin
      | bootstrap extra --bogus        | --bogus     | Usage: /claude:plugin bootstrap                       |
      | import extra --bogus           | --bogus     | Usage: /claude:plugin import [--scope user\|project]   |
      | browse extra --bogus           | --bogus     | Usage: /claude:plugin browse                          |
      | pending extra --bogus          | --bogus     | Usage: /claude:plugin pending [--scope user\|project]  |
```
The `pending` row fails until WR-02 is fixed.

## Info

### IN-01: Completions comment still says `help` does not parse flags

**File:** `extensions/pi-claude-marketplace/edge/completions/provider.ts:103-107`
**Issue:** The comment reads "`help` reads what follows as a topic name rather than parsing flags". After this phase, `help` tokenizes and rejects any long flag as `Unknown flag: "<flag>".`. The rule itself (offer no flag) is still right. Only the stated reason is out of date.
**Fix:** Change it to "`help` takes one topic and rejects every flag".

### IN-02: Bootstrap handler catch comment omits autoupdate failures

**File:** `extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts:80-85`
**Issue:** The comment says that only an add error outside the precondition set reaches the catch. A throw from `setMarketplaceAutoupdate`, such as a held state lock, also reaches it. The handler then emits a causeless `claude-plugins-official [user] (failed)` row right after the `(added)` row, which reads as though the add failed. The catch-all row also uses the subject `claude-plugins-official`, while a classified failure renders `anthropics/claude-plugins-official`. CONTEXT defers lock scenarios to Phase 15, but the comment should not claim the catch is add-only.
**Fix:** Name both sources in the comment ("an add error outside the precondition set, or any autoupdate throw"), or record the subject mismatch for Phase 15.

### IN-03: A duplicate-name error wrapped with a cleanup leak skips the idempotent path

**File:** `extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts:125-129`
**Issue:** `err instanceof MarketplaceDuplicateNameError` misses the shape that `appendLeakToError` produces: a plain `Error` whose `cause` is the duplicate. `classifyAddError` unwraps that shape (`add.ts:249-266`), so `notifyAddFailure` now renders `(failed) {duplicate name}` and skips autoupdate. The idempotent re-run should have been silent and then turned on autoupdate. Before this phase the same path gave a causeless failed row, so the user-visible outcome changed on a path that is rare but reachable.
**Fix:** Decide the swallow with the classifier: `if (classifyAddError(err) !== "duplicate name") { notifyAddFailure(addOptions, err); return; }`. `classifyAddError` is already exported.

### IN-04: The two spellings of marketplace help now reject a flag with different sentences

**File:** `extensions/pi-claude-marketplace/edge/router.ts:319-329`
**Issue:** `help marketplace --bogus` now gives `Unknown flag: "--bogus".`, but `marketplace help --bogus` still gives `marketplace help takes no arguments.` (`register.test.ts:3243` keeps that as an `unknown` override). D-05 keeps the zero-operand sentence for a surplus positional only, and D-03 asks for uniform flag rejection.
**Fix:** In the router's `marketplace help` arm, reject a long-flag token as `Unknown flag` before the "takes no arguments" sentence, and drop the `unknown` override. Alternatively, record the divergence as deliberate in CONTEXT.

### IN-05: `rejectUnknownFlag` duplicates `parseCommandArgs`'s scan and sits in the cross-cutting module

**File:** `extensions/pi-claude-marketplace/edge/handlers/shared.ts:165-181`
**Issue:** The body is the same `positional.find((token) => token.startsWith("--"))` that `parseCommandArgs` runs (`edge/args-schema.ts:93-97`). The header of `edge/handlers/shared.ts` reserves the file for helpers that both `marketplace/` and `plugin/` use, but all four callers are plugin handlers (`edge/handlers/plugin/shared.ts` exists).
**Fix:** Have `parseCommandArgs` call the helper, which makes it genuinely cross-cutting, or move the helper to `edge/handlers/plugin/shared.ts`.

### IN-06: Token-shape edge cases in the new tokenizing handlers

**File:** `extensions/pi-claude-marketplace/edge/handlers/plugin/help.ts:18-41`, `extensions/pi-claude-marketplace/edge/handlers/plugin/browse.ts:133-140`, `extensions/pi-claude-marketplace/edge/handlers/shared.ts:174`
**Issue:** Probe results:
- `help ""` gives `Unknown help topic: "".`
- `help --` gives `Unknown flag: "--".` Commander treats `--` as the end of options.
- `help -x` gives `Unknown help topic: "-x".`
- `bootstrap -x` and `browse -x` give "takes no arguments".

The consuming-mode verbs (`uninstall`, `prune`) and commander reject `-x` as an unknown option. The long-only rule matches the array-form verbs and `parseCommandArgs`, so this is a choice, but no CONTEXT decision records it.
**Fix:** Record the long-only rule in CONTEXT. Optionally, reject an empty topic as `Unknown help topic` with the typed spelling, or as a missing topic.

### IN-07: Test-data style and D-07 coverage details

**File:** `test/edge/handlers/plugin/browse.test.ts:143-149`; `features/plugin/usage-errors.feature:109-110`; `features/plugin/browse.feature:27-34`; `features/plugin/bootstrap.feature:57-75`
**Issue:**
- The browse case derives its expected flag from the input (`args.split(" ").find(...)`). The data row should state `{ args, flag }` as the bootstrap edge test does.
- D-07 says browse and help reject `--scope bad` as the unknown flag `--scope`. The outline uses `--scope user` and puts it only after the help topic. The measured bug was `help --scope bad marketplace`, with the flag before the topic, and no row tests that spelling.
- Every bootstrap rejection row and `browse extra` appear in both their own feature and `usage-errors.feature`. That is two places to update for one wording change.

**Fix:**
- Add a `flag` field to the browse rows.
- Add `help --scope bad marketplace` and `browse --scope bad` rows to the unknown-flag outline.
- Keep each rejection in one feature file and cross-reference it from the other, if the D-02 and D-07 overlap is not intentional.

---

_Reviewed: 2026-10-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
