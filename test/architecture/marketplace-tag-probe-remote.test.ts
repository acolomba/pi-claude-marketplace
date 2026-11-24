/**
 * D-SG-09 / TAGS-01: pins `marketplace-tag-probe.ts`'s DIRECT, brace-form
 * named-import surface from a `platform/git` specifier to exactly
 * `listLocalTags` and `listRemoteTags`.
 *
 * A git marketplace is a depth-1 clone that holds no tags, so the probe reads
 * its release tags from the marketplace remote with `listRemoteTags`, and a
 * directory marketplace's from its own repository with `listLocalTags`. The
 * gate pins the exact set of named imports to equality: the probe provably
 * imports the remote listing, and a future edit that adds `clone`, `fetch`,
 * `fetchCommit`, or `resolveRemoteRef` to THAT import clause fails on set
 * inequality without this gate having had to enumerate what is forbidden in
 * advance.
 *
 * What this gate does NOT see: a namespace import (`import * as git from
 * "../../platform/git.ts"`) alongside the named clause, a dynamic
 * `import("../../platform/git.ts")`, or a reach through any OTHER module this
 * file imports (e.g. `auth-host.ts`) -- it is a regex over one file's one
 * import clause, not a transitive import-graph walk.
 *
 * The companion assertion pins `domain/release-tag.ts` to zero imports from
 * `platform/` at all, which is what keeps the shared release-tag selection
 * module free of any transport concern (D-07-05) -- both the dependency probe
 * and the marketplace probe route selection through it, and neither should
 * have to worry that the other's transport leaked in.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { MARKETPLACE_TAG_PROBE_TARGETS } from "./gate-targets.ts";
import { REPO_ROOT } from "./source-scan.ts";

const [MARKETPLACE_TAG_PROBE_REL, RELEASE_TAG_REL] = MARKETPLACE_TAG_PROBE_TARGETS;

/**
 * Every named symbol a file imports (type or value) from a module whose
 * specifier contains `moduleSubstring`. Handles multiple `import { ... }`
 * clauses from matching specifiers, and strips a leading `type ` modifier so
 * `import { type Foo }` reports `Foo`, not `type Foo`.
 */
function importedSymbolsFrom(src: string, moduleSubstring: string): string[] {
  const pattern = new RegExp(
    `import\\s*\\{([^}]*)\\}\\s*from\\s*["'][^"']*${moduleSubstring}[^"']*["']`,
    "g",
  );
  const symbols: string[] = [];
  for (const match of src.matchAll(pattern)) {
    for (const raw of match[1]?.split(",") ?? []) {
      const name = raw.trim().replace(/^type\s+/, "");
      if (name !== "") {
        symbols.push(name);
      }
    }
  }

  return symbols;
}

/** Whether a file carries any `from "..."` specifier containing `moduleSubstring`, of any import shape. */
function importsFromModule(src: string, moduleSubstring: string): boolean {
  return new RegExp(`from\\s*["'][^"']*${moduleSubstring}[^"']*["']`).test(src);
}

test("D-SG-09: marketplace-tag-probe.ts imports exactly listLocalTags and listRemoteTags from platform/git.ts", async () => {
  // arrange
  const src = await readFile(path.join(REPO_ROOT, MARKETPLACE_TAG_PROBE_REL), "utf8");

  // act
  const imported = importedSymbolsFrom(src, "platform/git").sort();

  // assert
  assert.deepStrictEqual(
    imported,
    ["listLocalTags", "listRemoteTags"],
    "D-SG-09: marketplace-tag-probe.ts's entire platform/git.ts import surface must equal the remote and the local tag listing.",
  );
});

test("D-07-05: domain/release-tag.ts imports nothing from platform/", async () => {
  // arrange
  const src = await readFile(path.join(REPO_ROOT, RELEASE_TAG_REL), "utf8");

  // act & assert
  assert.strictEqual(
    importsFromModule(src, "platform/"),
    false,
    "D-07-05: the shared release-tag selection module must stay free of any transport concern.",
  );
});
