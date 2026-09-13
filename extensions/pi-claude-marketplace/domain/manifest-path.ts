// domain/manifest-path.ts
//
// Where a plugin's manifest lives, as ONE ordered list. A plugin may ship its
// `plugin.json` wrapped in `.claude-plugin/` or bare at the plugin root, and
// the first candidate that EXISTS is the manifest -- so the ORDER is what
// decides which file describes a plugin shipping both (MANF-01, MANF-02).
//
// Every reader that looks for a manifest walks this list instead of joining a
// path of its own: `domain/resolver.ts::readManifest`,
// `orchestrators/plugin/shared.ts::resolvePluginVersion` tier 1, and the
// `orchestrators/plugin/info.ts` dependency read. Each keeps its own I/O and
// its own error contract; only the ordering is shared (D-01-06). Readers
// locating one file independently is how a fallback lands in one of them and
// not in the others.
//
// D-01-07: a reader falls through to the next candidate on ABSENCE ONLY. A
// candidate that exists but cannot be used -- unreadable, unparseable, or
// schema-invalid -- stops the walk and produces that reader's failure. It
// never hands off to the next candidate.
//
// D-01-06: the list lives in `domain/` because it is a pure, network-free,
// write-free constant. `domain/` depends only on `shared/`, so no consumer can
// close an import cycle by reading it.
//
// Stability contract:
//   - The ORDER is the contract, not an implementation detail. Reordering
//     these entries changes which manifest describes a plugin that ships both
//     files, which is a user-visible behavior change and needs a CHANGELOG
//     entry.
//   - Entries are RELATIVE to a plugin root, and are joined with the platform
//     separator at module load, so a reader does one
//     `path.join(pluginRoot, candidate)` and the byte form is right on Windows
//     too.

import path from "node:path";

/** The ordered manifest locations, relative to a plugin root. Wrapped first. */
export const MANIFEST_CANDIDATES = Object.freeze([
  path.join(".claude-plugin", "plugin.json"),
  "plugin.json",
] as const);
