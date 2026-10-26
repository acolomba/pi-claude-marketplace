---
quick_id: 261026-gv1
status: complete
date: 2026-10-26
---

# Quick task 261026-gv1 summary

- Upstream (Claude Code 2.1.310 binary, 2026-10-26), the plugin version
  function: a `plugin.json` version wins, then the catalog entry's. With
  neither, a git source records `installedCommit.substring(0, 12)`; a
  `git-subdir` source adds `-` and
  `sha256(path).digest("hex").substring(0, 8)`, where `path` has `\` made
  `/`, one leading `./` dropped and trailing slashes dropped. When the
  plugin id ends in `@anthropic-plugin-directory` and its source carries a
  non-empty `sha`, a declared version (manifest or catalog) gets
  `-${sha.substring(0, 12)}` appended unless it already ends with it. The
  commit fallback gets no pin suffix.
- `domain/version.ts` and its callers (823e8da9): `shaVersion(sha, source)`,
  `declaredVersionWithPin`, and `isSameVersion` for GV-02. Install, update,
  convergence (warm and cold), list and info candidates, list upgradable,
  and the completion cache all derive the same form. The renderer shows
  `<12hex>`, `<12hex>-<8hex>` and the legacy `sha-<12hex>` as `v#<7hex>`.
- Old records: `sha-<12hex>` equals the commit version of the same 12
  characters, so nothing moves until the commit does, and the record keeps
  the old form until then. A pinned directory plugin installed before GV-01
  shows `upgradable` and updates once to the pinned form.
- Not adopted: Claude Code also appends the commit to a declared version
  installed at a tag a dependency's range selected. RESV-05 records the
  tag's semver and reads it back against the range; recorded in GV-01.
- Errno wording (cf2a1c37): the failure-setup steps record the running
  Node's message as `{mcp-adapter.json read error}` and
  `{unreadable skill file copy error}`. The five scenarios fail on Node
  24.22 at cd5c8802 and pass on Node 22.22, 24.22 and 26.12.
- SonarCloud S7778 and S7744 (7927bbd6): one merged `push()`, and a
  direct spread of the optional move.

## Threat Flags

None -- no security-relevant surface outside the plan's `<threat_model>` was introduced.
