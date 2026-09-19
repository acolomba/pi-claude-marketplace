/**
 * TAGS-01 / D-07-05 (07-marketplace-repo-tag-resolution): a POSITIVE proof
 * that the local, network-free tag probe never reaches the network.
 *
 * `no-orchestrator-network.test.ts` proves the ABSENCE of a named forbidden
 * token; this gate instead pins the EXACT set of symbols
 * `marketplace-tag-probe.ts` imports from `platform/git.ts` to equality. That
 * is stronger than a forbidden-substring scan: a future edit that adds
 * `listRemoteTags`, `clone`, `fetch`, or `resolveRemoteRef` fails on set
 * inequality without this gate having had to enumerate what is forbidden in
 * advance.
 *
 * The companion assertion pins `domain/release-tag.ts` to zero imports from
 * `platform/` at all, which is what keeps the shared release-tag selection
 * module free of any transport concern (D-07-05) -- both the network probe
 * and the local probe route selection through it, and neither should have to
 * worry that the other's transport leaked in.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { MARKETPLACE_TAG_PROBE_OFFLINE_TARGETS } from "./gate-targets.ts";
import { REPO_ROOT } from "./source-scan.ts";

const [MARKETPLACE_TAG_PROBE_REL, RELEASE_TAG_REL] = MARKETPLACE_TAG_PROBE_OFFLINE_TARGETS;

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

test("TAGS-01: marketplace-tag-probe.ts imports exactly listTags and resolveTagOid from platform/git.ts", async () => {
  // arrange
  const src = await readFile(path.join(REPO_ROOT, MARKETPLACE_TAG_PROBE_REL), "utf8");

  // act
  const imported = importedSymbolsFrom(src, "platform/git").sort();

  // assert
  assert.deepStrictEqual(
    imported,
    ["listTags", "resolveTagOid"],
    "TAGS-01: marketplace-tag-probe.ts's entire platform/git.ts import surface must equal exactly these two local, network-free functions.",
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
