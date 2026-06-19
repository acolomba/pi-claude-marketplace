// Architecture lint for the user-facing hook-support docs (SURF-06).
//
// The hook-support doc at `docs/hooks-compatibility.md` is the first-time-reader
// authority for plugin authors evaluating "will my hook plugin work?"
// and end users reading the `(unavailable) {unsupported hooks}` token.
// The doc has two failure modes that are not visible to a human
// reviewer until much later:
//
//   - Internal planning jargon (bucket-A/D taxonomy, REQ-IDs, phase
//     numbers, decision IDs, `<lossy synthesis>` markers,
//     `Pitfall N` / `Pattern N` references) leaks into reader-facing
//     prose. The jargon is meaningful only to the GSD planning audit
//     trail and confuses every other reader.
//
//   - The bucket-A 8-event support set drifts from the runtime closed
//     set declared in `domain/components/hook-events.ts` without the
//     doc being updated -- a reader installs a plugin whose hooks the
//     doc claims are supported but the runtime rejects.
//
// This test pins the no-jargon contract and the 8-event coverage
// invariant as a single architecture-lint surface so a future doc edit
// can re-introduce one of the failure modes only by also editing the
// gate that catches it. The README link to `docs/hooks-compatibility.md` is pinned
// here too so the discoverability path from the project README to the
// hook reference cannot quietly regress.

import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");
const HOOKS_DOC_PATH = path.join(REPO_ROOT, "docs", "hooks-compatibility.md");
const README_PATH = path.join(REPO_ROOT, "README.md");

const BUCKET_A_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PreCompact",
  "PostCompact",
  "SessionEnd",
] as const;

// Tokens whose presence in `docs/hooks-compatibility.md` signals a planning-artefact
// leak. One-line edit to extend in the future. Each token is matched
// case-sensitively as a substring against the full file.
const FORBIDDEN_TOKENS = [
  "bucket-A",
  "bucket-B",
  "bucket-C",
  "bucket-D",
  "bucket-E",
  "bucket-F",
  "bucket-G",
  "bucket-H",
  "bucket A",
  "bucket B",
  "bucket C",
  "bucket D",
  "bucket E",
  "bucket F",
  "bucket G",
  "bucket H",
  "REQ-",
  "<lossy synthesis>",
  "Pitfall ",
  "Pattern 1",
  "Pattern 2",
  "Pattern 3",
  "Pattern 4",
  "Pattern 5",
  "Pattern 6",
  "Pattern 7",
  "Pattern 8",
  "Pattern 9",
] as const;

let cachedDoc: string | null = null;

async function readHooksDoc(): Promise<string> {
  cachedDoc ??= await readFile(HOOKS_DOC_PATH, "utf8");
  return cachedDoc;
}

await test("docs/hooks-compatibility.md exists", async () => {
  await access(HOOKS_DOC_PATH);
});

await test("README.md links to docs/hooks-compatibility.md", async () => {
  const readme = await readFile(README_PATH, "utf8");
  assert.ok(
    readme.includes("docs/hooks-compatibility.md"),
    "README.md must include a link to docs/hooks-compatibility.md so readers can discover the hook reference",
  );
});

await test("docs/hooks-compatibility.md lists all 8 supported event names verbatim", async () => {
  const doc = await readHooksDoc();
  for (const event of BUCKET_A_EVENTS) {
    assert.ok(
      doc.includes(event),
      `docs/hooks-compatibility.md must contain the verbatim event name "${event}" (supported-events coverage)`,
    );
  }
});

await test("docs/hooks-compatibility.md cross-references the two authority docs", async () => {
  const doc = await readHooksDoc();
  assert.ok(
    doc.includes("code.claude.com/docs/en/hooks"),
    "docs/hooks-compatibility.md must link to the upstream Claude Code hooks reference (code.claude.com/docs/en/hooks)",
  );
  assert.ok(
    doc.includes("pi-coding-agent"),
    "docs/hooks-compatibility.md must reference the @mariozechner/pi-coding-agent package as the Pi extension API authority",
  );
});

await test("docs/hooks-compatibility.md contains zero internal-jargon tokens", async () => {
  const doc = await readHooksDoc();
  for (const token of FORBIDDEN_TOKENS) {
    assert.ok(
      !doc.includes(token),
      `docs/hooks-compatibility.md must not contain the internal-jargon token "${token}" (reader-facing doc)`,
    );
  }
});

await test("docs/hooks-compatibility.md has no decision-ID pattern and no Phase-number reference", async () => {
  const doc = await readHooksDoc();
  assert.equal(
    /D-\d{2}-\d{2}/.exec(doc),
    null,
    "docs/hooks-compatibility.md must not contain GSD decision IDs (e.g. D-63-09)",
  );
  assert.ok(
    !doc.includes("Phase "),
    'docs/hooks-compatibility.md must not reference "Phase N" planning artefacts',
  );
});

await test("docs/hooks-compatibility.md does not leak internal planning paths or artefacts", async () => {
  const doc = await readHooksDoc();
  assert.equal(
    /\.planning\/|RESEARCH\.md|CONTEXT\.md/.exec(doc),
    null,
    "docs/hooks-compatibility.md must not reference .planning/ paths or *RESEARCH.md / *CONTEXT.md planning artefacts",
  );
});
