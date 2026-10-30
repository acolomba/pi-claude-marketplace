# Phase 2 deferred items

## From 02-02

- **Installing a git-source plugin on a cold clone cache ignores the dependencies its own `plugin.json` declares.** Found while writing the D-PL2-08 enable scenario: `install app@tools`, where `app` is a pinned `url` git source whose `plugin.json` declares `lib`, installed `app` only, and a later `disable lib@tools` answered `(skipped) {not installed}`. The install cascade's closure lookup (`install-flow.ts` `lookupCascadeDependencies` -> `readDependencyDeclaration`) reads a git source from the warm clone cache only, and the root's clone does not exist yet when the walk runs, so the entry (which declares nothing) answers. Claude Code reads the installed `plugin.json`. Out of scope for 02-02 (RCN-05 names the enable closure and the update preflight only). Both 02-02 scenarios install the dependency explicitly first. Backlog candidate: GITROOTDEPS-01.
  **Status:** resolved
  The install now previews the requested plugin before the dependency walk and
  pins its ledger to that resolved commit. The owner test and the Cucumber
  scenario "Installing a cold git-source plugin reads dependencies from its
  own manifest" prove that a cold pinned git root installs a dependency that
  appears only in its own `plugin.json`.
