# Phase 20: Review Fix

| ID | Outcome | Change |
| -- | ------- | ------ |
| CR-01 | Fixed | `classifyResolverNote`'s `source dir does not exist` arm now runs before the `lspServers` substring arm, since the note embeds the plugin path. Parity row added with a path that contains `lspServers`. |
| WR-01 | Kept, by decision | A path plugin that resolves `unavailable` keeps the entry version (D-02). It cannot be installed, so there is no install version to match, and the resolver exposes no root on that arm (NFR-7). Reading plugin.json from an unvalidated root to match the warm git row is a display choice for the user. Listed under "For the user". |
| WR-02 | Fixed | New `info.test.ts` case: a partially-available path plugin shows plugin.json's version; reverting `version: treeVersion` on that call fails it. |
| IN-01 | Fixed | `domain/plugin-resolver.ts` emits the note from `SOURCE_DIR_MISSING_NOTE`, and `enable-disable.messaging.ts` matches it through the same constant. |
| IN-02 | No change | The info git branch already reads plugin.json through `node:fs`; the path branch follows it. |
| IN-03 | Fixed | The unmatched-note tests use the resolver's real `unsupported source kind: npm` note. |
| IN-04 | Fixed | The arm-order doc comment names the new arm. |
