// tests/architecture/catalog-block.ts
//
// Shared reader for the out-of-band byte locks. Those seams call
// ctx.ui.notify directly rather than through a structured NotificationMessage,
// so catalog-uat never drives them; each lock instead reads its documented
// block from docs/output-catalog.md at test time, the way catalog-uat reads
// its own blocks.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { VOCABULARY_GUARD_DOC_TARGETS } from "./gate-targets.ts";
import { REPO_ROOT } from "./source-scan.ts";

// D-07-05: the catalog is the registry's target, not a path spelled here. The
// group is a tuple, so the binding is positional and `readCatalogBlock` states
// the basename it expects.
const [OUTPUT_CATALOG_REL] = VOCABULARY_GUARD_DOC_TARGETS;

/**
 * Reads the fenced block body that follows a `<!-- catalog-state: STATE -->`
 * marker in docs/output-catalog.md. Mirrors the catalog-uat parser's
 * fence-walk (the body is the lines between the ``` fences, joined by "\n").
 */
export async function readCatalogBlock(state: string): Promise<string> {
  assert.strictEqual(
    path.posix.basename(OUTPUT_CATALOG_REL),
    "output-catalog.md",
    `D-07-05: this gate reads the output catalog, but the registry target bound to it is ${OUTPUT_CATALOG_REL}`,
  );
  const catalog = await readFile(path.join(REPO_ROOT, OUTPUT_CATALOG_REL), "utf8");
  const lines = catalog.split("\n");
  const marker = `<!-- catalog-state: ${state} -->`;

  let pending = false;
  let inFence = false;
  const body: string[] = [];
  for (const line of lines) {
    if (!pending) {
      if (line.trim() === marker) {
        pending = true;
      }

      continue;
    }

    if (!inFence) {
      if (line.startsWith("```")) {
        inFence = true;
      }

      continue;
    }

    if (line.startsWith("```")) {
      const block = body.join("\n");

      // D-07-03: an empty fence would hand the byte-equality assertion an empty
      // expectation, turning a documentation-parity pin into a comparison
      // against nothing.
      assert.ok(
        block.length > 0,
        `D-07-03: the '${state}' block in ${OUTPUT_CATALOG_REL} is empty, so this gate compares against nothing`,
      );
      return block;
    }

    body.push(line);
  }

  throw new Error(`catalog block for state '${state}' not found in ${OUTPUT_CATALOG_REL}`);
}
