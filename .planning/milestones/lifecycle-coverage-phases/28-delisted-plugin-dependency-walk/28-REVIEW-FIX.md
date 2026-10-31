---
phase: 28-delisted-plugin-dependency-walk
status: all_fixed
fixed: [CR-01, WR-01, WR-02, WR-03, IN-01, IN-02, IN-04, IN-05]
deferred: [IN-03]
---

# Phase 28 Review Fix

| ID | Disposition | What changed |
| --- | --- | --- |
| CR-01 | fixed | The delisted row's suppression set adds `plugin-disabled` and `plugin-dependency-disabled` (D-08); `reportUnreadableDeclarer` keeps its own set. Unit case in `delisted-plugins.test.ts`. |
| WR-01 | fixed | `readRecordDeclarations` marks a copy-read result `delisted: true`; the enable cascade treats a delisted root as declaring nothing whether its copy reads or not, so the ENBL-07 not-found refusal renders. Unit case with a copy declaring a missing dependency. |
| WR-02 | fixed | Unit case for a delisted git-source record whose copy sits under `plugin-clones/`. |
| WR-03 | fixed | The reinstall DLS-01 case compares the whole notification. |
| IN-01 | fixed | `enableCascadeLookup` doc comment states the delisted-root rule. |
| IN-02 | fixed | `delisted-plugins.ts` header and the output catalog drop the milestone marker and the change wording. |
| IN-03 | deferred | Containment accepts either owning root whatever the source kind, and the candidate stat follows symlinks; same as D-03 and the existing own-manifest read. Listed for the user. |
| IN-04 | fixed | The catalog says only the first unreadable copy gets the walk row; a later one gets the delisted row. |
| IN-05 | fixed | `readInstalledCopy` answers `absent` for a name with no record, without reading. |
