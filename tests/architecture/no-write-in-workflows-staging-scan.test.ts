import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { REPO_ROOT, stripComments } from "./source-scan.ts";

/**
 * tests/architecture/no-write-in-workflows-staging-scan.test.ts -- WR-06:
 * `scanRetainedWorkflowsStaging` names the retained staging trees without
 * touching one.
 *
 * The invariant:
 *   `scanRetainedWorkflowsStaging` answers a read-only command. Every tree it
 *   names is one the sweep keeps FOREVER because its `.previous/` holds the
 *   only surviving copy of the user's previous workflow envelopes (WR-02). A
 *   write from the surface that merely LISTS them is therefore not a stray
 *   side effect: the shortest path from "list" to "destroy" is one `rm` on the
 *   very bytes the sweep was written to spare, and the caller is a read-only
 *   command with no failure arm to route a throw into. NFR-3 / NFR-5 also
 *   require it to create nothing on the way to an empty answer, so an absent
 *   staging directory stays absent after a scan.
 *
 * Why this gate is scoped to the FUNCTION BODY and not to the file:
 *   `workflows-staging-gc.ts` also hosts `garbageCollectWorkflowsStaging`, the
 *   destructive sweep, which legitimately imports `rm` from `node:fs/promises`
 *   and calls it. A whole-file scan for write calls is not a strict gate here,
 *   it is an INCOHERENT one: refuse `rm` and the module is red on a correct
 *   tree; permit it and the gate is satisfied by the sweep's own call while the
 *   scan writes freely beside it. Neither outcome inspects the read-only
 *   function. So the body of the named function is extracted by brace depth and
 *   the patterns are matched against that slice alone.
 *
 * The gate proves its own patterns are live:
 *   The destructive sibling's body is extracted by the SAME mechanic and
 *   asserted to match at least one forbidden pattern. That is a permanent,
 *   in-tree plant: if the pattern list ever stops recognising a write call --
 *   through a regex typo, or through the extractor silently returning the wrong
 *   slice -- the sweep's own `rm` stops matching and this gate goes red instead
 *   of quietly screening nothing.
 *
 * Both sides are asserted NON-EMPTY before anything is compared. A renamed
 * function, an emptied file, or an extractor that finds no closing brace fails
 * loudly as an unbound gate rather than passing over an empty slice -- the
 * WR-06 failure mode `./source-scan.ts` names, arriving through extraction
 * instead of through a missing target.
 *
 * stripComments rationale (mandatory):
 *   The scan's own docstring says it never writes and names `rm` while saying
 *   so, and the block comments inside both bodies discuss the removal at
 *   length. Comments are stripped before the body is located and before any
 *   pattern runs, so the prose recording the rule cannot decide the verdict --
 *   in either direction.
 */
const STAGING_GC = "extensions/pi-claude-marketplace/orchestrators/plugin/workflows-staging-gc.ts";

/** The read-only function this gate exists for. */
const READ_ONLY_FN = "scanRetainedWorkflowsStaging";

/** The destructive sibling, extracted only to prove the patterns still fire. */
const DESTRUCTIVE_FN = "garbageCollectWorkflowsStaging";

/**
 * Filesystem mutations, matched as CALLS (`name(`) rather than as bare tokens.
 * A bare-token list would match the import statement that legally brings `rm`
 * in for the sweep, which is a file-level fact and not a fact about either
 * body.
 */
const FORBIDDEN_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "rm call", pattern: /\brm\s*\(/ },
  { name: "rmdir call", pattern: /\brmdir\s*\(/ },
  { name: "unlink call", pattern: /\bunlink\s*\(/ },
  { name: "writeFile call", pattern: /\b(?:appendFile|writeFile)\s*\(/ },
  { name: "atomic JSON write call", pattern: /\batomicWriteJson\s*\(/ },
  { name: "mkdir call", pattern: /\bmkdir\s*\(/ },
  { name: "rename call", pattern: /\brename\s*\(/ },
  { name: "copy call", pattern: /\b(?:copyFile|cp)\s*\(/ },
  { name: "truncate call", pattern: /\btruncate\s*\(/ },
  { name: "link creation call", pattern: /\b(?:link|symlink)\s*\(/ },
  { name: "write stream call", pattern: /\bcreateWriteStream\s*\(/ },
];

/**
 * The body of the named function declaration in `src`, brace-matched from the
 * opening brace of the declaration to its balanced close.
 *
 * `src` must already be comment-stripped: a brace inside a comment would
 * unbalance the count. Template-literal `${...}` spans are balanced by
 * construction and need no special handling; the two bodies here contain no
 * regular-expression literals, whose unmatched braces would.
 *
 * Returns `undefined` when the declaration is absent or its braces never
 * balance, which the caller turns into an unbound-gate failure rather than
 * into a vacuous pass.
 */
function functionBody(src: string, name: string): string | undefined {
  const declaration = new RegExp(String.raw`\bfunction\s+${name}\s*\(`).exec(src);
  if (declaration === null) {
    return undefined;
  }

  const open = src.indexOf("{", declaration.index);
  if (open === -1) {
    return undefined;
  }

  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") {
      depth++;
    } else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        return src.slice(open + 1, i);
      }
    }
  }

  return undefined;
}

/** `functionBody`, with the unbound-gate failure attached. */
function requireBody(src: string, name: string): string {
  const body = functionBody(src, name);
  assert.ok(
    body !== undefined && body.trim().length > 0,
    `WR-06 unbound gate: no balanced body found for ${name} in ${STAGING_GC}. A renamed or removed function leaves this gate matching against nothing, which is a pass over zero inspected bytes rather than a proof.`,
  );
  return body;
}

test("WR-06: the retained-staging scan carries no filesystem-write call", async () => {
  // arrange -- one read, comments stripped before the bodies are located so no
  // docstring brace or docstring `rm(` can decide anything.
  const src = stripComments(await readFile(path.join(REPO_ROOT, STAGING_GC), "utf8"));
  assert.ok(
    src.trim().length > 0,
    `WR-06 unbound gate: ${STAGING_GC} stripped to nothing, so every assertion below would pass over zero inspected bytes.`,
  );

  // act
  const scanBody = requireBody(src, READ_ONLY_FN);
  const sweepBody = requireBody(src, DESTRUCTIVE_FN);

  // assert -- the pattern list still recognises a write. The sweep's own `rm`
  // is the in-tree plant; if it stops matching, the screen below is inspecting
  // something other than what it claims to.
  assert.ok(
    FORBIDDEN_PATTERNS.some(({ pattern }) => pattern.test(sweepBody)),
    `WR-06 inert gate: none of the ${FORBIDDEN_PATTERNS.length} write patterns matched ${DESTRUCTIVE_FN}, which removes a directory tree with rm. Either the patterns no longer recognise a write call or the extraction returned the wrong slice, and in both cases the screen over ${READ_ONLY_FN} proves nothing.`,
  );

  // assert -- and the read-only sibling matches none of them.
  const offenders = FORBIDDEN_PATTERNS.filter(({ pattern }) => pattern.test(scanBody)).map(
    ({ name, pattern }) => `${READ_ONLY_FN} matches forbidden ${name}: ${String(pattern)}`,
  );
  assert.deepEqual(
    offenders,
    [],
    `WR-06 violation: a filesystem write reached the read-only retained-staging scan:\n  ${offenders.join("\n  ")}\n  (every tree this function names is one the sweep keeps forever because its .previous/ holds the only surviving copy of the user's previous workflow envelopes. Its caller is a read-only command with no failure arm, and NFR-3 / NFR-5 require it to create nothing on the way to an empty answer.)`,
  );
});
