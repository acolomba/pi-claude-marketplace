---
quick_id: 261030-ogp
type: quick
---

# Quick 261030-ogp: bootstrap runs only marketplace add

User decision: "bootstrap on an already added official marketplace should respect the current autoupdate setting".

## Task 1: drop the autoupdate step

- files: extensions/pi-claude-marketplace/orchestrators/plugin/bootstrap.ts, extensions/pi-claude-marketplace/edge/handlers/plugin/bootstrap.ts
- action: remove the `setMarketplaceAutoupdate` call; keep the add-failure render and the `BootstrapStepError` wrap of a post-commit missing-dependency throw; update the header and doc comments.
- verify: `npx fallow dead-code`, `npm run typecheck`
- done: bootstrap emits only the add's notification.

## Task 2: tests

- files: test/orchestrators/plugin/bootstrap.test.ts, test/edge/handlers/plugin/bootstrap.test.ts, features/plugin/bootstrap.feature
- action: drop the autoupdate rows; the off-autoupdate case asserts the config is unchanged; add a scenario where an added official marketplace with autoupdate off stays off after bootstrap.
- verify: `npm run check`
- done: the new scenario fails against the old bootstrap.

## Task 3: CHANGELOG

- files: CHANGELOG.md
- action: one line under the unreleased entry. README.md is not touched.
