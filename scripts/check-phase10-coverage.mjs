import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// fallow-ignore-file unused-file -- Plan 10-07 invokes this standalone phase gate directly;
// no runtime or repository-wide check imports a milestone-specific planning verifier.

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const coveragePath = path.join(
  projectRoot,
  ".planning/phases/10-lifecycle-test-and-harness-gaps/10-COVERAGE.md",
);

const expectedIds = [
  "LCHARN-NETWORK",
  "LCHARN-CLONE-RESIDUE",
  "LCHARN-DATA-ENTRIES",
  "LCHARN-UNKNOWN-TOKEN",
  "LCHARN-RULES-ORDER",
  "LCHARN-INSTALL-REVISION",
  "LCHARN-CLONE-REVISION",
  "LCHARN-RETRY-GRAMMAR",
  "LCHARN-LIST-FIXTURE",
  "LCHARN-BROWSE-WAIT",
  "PHANTOM-INSTALL",
  "PHANTOM-REINSTALL",
  "LCTEST-JOINED-RANGE",
  "LCTEST-POST-SWAP",
  "LCTEST-ENABLE-MISSING",
  "LCTEST-PARTIAL-LIST",
  "LCTEST-PRUNE-DECLARATION",
  "LCTEST-APPLY-MIXED",
  "LCTEST-BARE-FETCH",
  "LCTEST-RM-LS",
  "LCTEST-FAILED-ADD",
  "LCTEST-AUTOAPPLY-CREDS",
  "LCTEST-PREBASE-MIGRATION",
  "LCTEST-TAG-CLOSURE",
  "LCTEST-NOOP-APPLY",
  "LCTEST-IMPORT-REENABLE",
  "LCTEST-SKIP-CACHE",
  "LCTEST-PROJECT-TOKENS",
  "LCTEST-RAW-CASCADE",
  "LCTEST-ROOT-COMMIT",
  "CAS08-ROOT-LEDGER",
  "CAS08-PLAN-STEP",
  "CAS08-MID-WALK",
  "MIM05-ROLLBACK-DETAIL",
  "XPH01-ADD-WARNINGS",
  "XPH01-IMPORT-ROW",
  "XPH01-IMPORT-CITATION",
  "XPH01-APPLY-REVISION",
  "XPH01-REINSTALL-FRAME",
  "XPH01-COMPLETION",
  "XPH01-SOURCE-READD",
  "XPH01-OFFICIAL-FALLBACK",
  "XPH01-LOCAL-OWNER",
  "XPH01-TUI-AUTOUPDATE",
  "XPH01-TUI-CAP",
  "XPH01-TUI-DEDUPE",
  "XPH01-PROCESS-TREE",
  "XPH02-OCCUPIED-CASCADE",
  "XPH02-NETWORK-FALLTHROUGH",
  "XPH02-MOVE-DIAGNOSTICS",
  "XPH02-FOREIGN-INDEX",
  "XPH02-ROOT-REDACTION",
  "XPH02-TYPED-OCCUPIED",
  "XPH02-PACKAGE-NOTE",
  "XPH02-INVALID-MANIFEST",
  "XPH02-YARN-PNPM",
];

const allowedDispositions = new Set([
  "scenario",
  "unit-with-reason",
  "fixed",
  "declined-with-reason",
]);

function fail(message) {
  process.stderr.write(`Phase 10 coverage error: ${message}\n`);
  process.exitCode = 1;
}

const markdown = readFileSync(coveragePath, "utf8");
const match = /```json phase10-coverage-ledger\n([\s\S]*?)\n```/u.exec(markdown);
if (match === null) {
  fail("10-COVERAGE.md has no phase10-coverage-ledger JSON block");
  process.exit();
}

let rows;
try {
  rows = JSON.parse(match[1]);
} catch (error) {
  fail(`ledger JSON is invalid: ${error.message}`);
  process.exit();
}

if (!Array.isArray(rows)) {
  fail("ledger JSON must be an array");
  process.exit();
}

for (const id of expectedIds) {
  const matching = rows.filter((row) => row.id === id);
  if (matching.length !== 1) {
    fail(`${id} has ${matching.length} ledger rows; expected exactly one`);
  }
}

const expected = new Set(expectedIds);
for (const row of rows) {
  if (!expected.has(row.id)) {
    fail(`unexpected ledger id ${String(row.id)}`);
  }

  if (!allowedDispositions.has(row.disposition)) {
    fail(`${row.id} has unsupported disposition ${String(row.disposition)}`);
  }

  if (typeof row.source !== "string" || row.source.length === 0) {
    fail(`${row.id} has no source bullet description`);
  }

  if (typeof row.commit !== "string" || !/^[0-9a-f]{8}$/u.test(row.commit)) {
    fail(`${row.id} has no exact eight-hex evidence commit`);
  } else {
    try {
      execFileSync("git", ["cat-file", "-e", `${row.commit}^{commit}`], {
        cwd: projectRoot,
        stdio: "ignore",
      });
    } catch {
      fail(`${row.id} cites missing commit ${row.commit}`);
    }
  }

  if (!Array.isArray(row.evidence) || row.evidence.length === 0) {
    fail(`${row.id} has no evidence path and title`);
    continue;
  }

  for (const evidence of row.evidence) {
    if (typeof evidence.path !== "string" || typeof evidence.title !== "string") {
      fail(`${row.id} has malformed evidence`);
      continue;
    }

    const absolute = path.resolve(projectRoot, evidence.path);
    if (!absolute.startsWith(`${projectRoot}${path.sep}`) || !existsSync(absolute)) {
      fail(`${row.id} cites missing or outside path ${evidence.path}`);
      continue;
    }

    if (!readFileSync(absolute, "utf8").includes(evidence.title)) {
      fail(`${row.id} title is absent from ${evidence.path}: ${evidence.title}`);
    }
  }

  if (
    (row.disposition === "unit-with-reason" || row.disposition === "declined-with-reason") &&
    (typeof row.reason !== "string" || row.reason.length < 20)
  ) {
    fail(`${row.id} needs a concrete reason for ${row.disposition}`);
  }
}

if (process.exitCode === undefined) {
  process.stdout.write(
    `Phase 10 coverage ledger: ${rows.length}/${expectedIds.length} rows valid\n`,
  );
}
