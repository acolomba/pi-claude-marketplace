# Prepared work saved at pause

These bundles preserve work that was prepared under /tmp but has not been applied to the checkout. They are planning inputs, not completed execution or production dependencies. Read the active phase handoff before using them.

| Bundle | Contents | SHA-256 |
| --- | --- | --- |
| wave-5-preparation.tar.gz | Ready 05-07 and 05-12 patches/manifests/ledgers and 05-24 full content/baselines; focused/direct/control evidence | 5820d6dd4e07bd51e4354bf30b397e25c3b4d735a40cbaa34e2101f1ddc31bf6 |
| plan-15-partial.tar.gz | Incomplete 05-15 fourteen-file preparation, baseline bytes, dependency manifest, scripts and PAUSE.md | 2bca4696d4e8544943311a23844dd5ee23c8bb2aa653673d6fa076ddf6fd77d5 |
| wave-4-verification.tar.gz | Final and first-attempt logs, validated census/coverage reports, reviewed commit manifest and compiler-control evidence | Recorded in MANIFEST.json |

Extract into a new directory under /tmp. Every archive member is a relative regular file, with no links or parent traversal. Verify the recorded SHA-256 before extraction. Preserve existing temporary trees if present; they include larger isolated runtime copies that are intentionally omitted from the bundles.

```sh
mkdir -p /tmp/test-backlog-resume-inputs
sha256sum .planning/inputs/test-backlog/paused-preparation/*.tar.gz
tar -xzf .planning/inputs/test-backlog/paused-preparation/wave-5-preparation.tar.gz -C /tmp/test-backlog-resume-inputs
tar -xzf .planning/inputs/test-backlog/paused-preparation/plan-15-partial.tar.gz -C /tmp/test-backlog-resume-inputs
```

Check all baseline hashes against the current branch before applying patches. For 05-12, reconstruct files from prepared.patch; the archive contains manifests and original-to-public assertion ledgers, not an entire copied checkout. For 05-07, changes.json contains prepared content. For 05-24, changes.json contains all eight complete prepared files and before hashes; the registry baseline includes final Wave 4 marker privacy.

Temporary scripts contain original absolute /tmp paths. Adjust their workspace paths deliberately if reconstructing an isolated runtime; do not copy them into production or invoke non-idempotent edit scripts blindly. Phase15's analyzer baseline contains unresolved imports and is invalid for findings comparison; its PAUSE.md explicitly identifies incomplete validation.

No new user permission is required for ordinary resume work after the user requests resumption. Parent-owned wave integration still requires stable source, assertion review, exact census reconciliation and the full prescribed gates before marking plans complete.
