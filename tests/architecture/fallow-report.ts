/** The real analyzer instrument shared by the production census and its controls. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** Stable finding fields; source line numbers are intentionally not identities. */
export interface FindingGroups {
  readonly unused_exports: readonly { readonly path: string; readonly export_name: string }[];
  readonly unused_types: readonly { readonly path: string; readonly export_name: string }[];
  readonly unused_files: readonly { readonly path: string }[];
  readonly unused_class_members: readonly {
    readonly path: string;
    readonly parent_name: string;
    readonly member_name: string;
    readonly kind: string;
  }[];
  readonly duplicate_exports: readonly {
    readonly export_name: string;
    readonly locations: readonly { readonly path: string }[];
  }[];
}

/** A validated report from a successfully launched analyzer. */
export interface AnalyzerReport {
  readonly findings: FindingGroups;
  readonly entryPointCount: number;
  readonly totalIssues: number;
  readonly exitStatus: number;
}

/** Narrow an untrusted JSON object before reading any report field. */
function record(document: unknown): Record<string, unknown> {
  assert.ok(typeof document === "object" && document !== null && !Array.isArray(document));
  return document as Record<string, unknown>;
}

/** Require a nonempty identity field rather than coercing a malformed report. */
function identityField(document: Record<string, unknown>, field: string): string {
  const identity = document[field];
  assert.ok(typeof identity === "string" && identity.length > 0, `Missing identity: ${field}`);
  return identity;
}

/** Require a complete finding list, including when the correct list is empty. */
function records(document: Record<string, unknown>, field: string): Record<string, unknown>[] {
  const findings = document[field];
  assert.ok(Array.isArray(findings), `Missing finding category: ${field}`);
  return findings.map((finding: unknown) => record(finding));
}

/** Validate both the report envelope and every stable finding identity. */
function parseReport(stdout: string, exitStatus: number): AnalyzerReport {
  const parsed: unknown = JSON.parse(stdout);
  const document = record(parsed);
  assert.strictEqual(document.kind, "dead-code");
  assert.strictEqual(document.schema_version, 9);
  const entryPointCount = record(document.entry_points).total;
  assert.ok(
    typeof entryPointCount === "number" && Number.isInteger(entryPointCount) && entryPointCount > 0,
  );
  const findings: FindingGroups = {
    unused_exports: records(document, "unused_exports").map((finding) => ({
      path: identityField(finding, "path"),
      export_name: identityField(finding, "export_name"),
    })),
    unused_types: records(document, "unused_types").map((finding) => ({
      path: identityField(finding, "path"),
      export_name: identityField(finding, "export_name"),
    })),
    unused_files: records(document, "unused_files").map((finding) => ({
      path: identityField(finding, "path"),
    })),
    unused_class_members: records(document, "unused_class_members").map((finding) => ({
      path: identityField(finding, "path"),
      parent_name: identityField(finding, "parent_name"),
      member_name: identityField(finding, "member_name"),
      kind: identityField(finding, "kind"),
    })),
    duplicate_exports: records(document, "duplicate_exports").map((finding) => {
      const locations = records(finding, "locations").map((location) => ({
        path: identityField(location, "path"),
      }));
      assert.ok(locations.length > 1);
      return { export_name: identityField(finding, "export_name"), locations };
    }),
  };
  const summary = record(document.summary);
  for (const [category, count] of Object.entries(summary)) {
    assert.ok(typeof count === "number" && Number.isInteger(count) && count >= 0);
    if (category !== "total_issues") {
      assert.ok(
        Object.hasOwn(findings, category) || count === 0,
        `Unnormalized finding category: ${category}`,
      );
      if (Object.hasOwn(document, category)) {
        assert.strictEqual(records(document, category).length, count);
      }
    }
  }

  for (const category of [
    "unused_exports",
    "unused_types",
    "unused_files",
    "unused_class_members",
    "duplicate_exports",
  ] as const) {
    assert.strictEqual(summary[category], findings[category].length);
  }

  const identities = findingIdentities(findings);
  assert.strictEqual(document.total_issues, identities.length);
  assert.strictEqual(summary.total_issues, identities.length);
  assert.strictEqual(new Set(identities).size, identities.length);
  assert.strictEqual(exitStatus, identities.length === 0 ? 0 : 1);
  return { findings, entryPointCount, totalIssues: identities.length, exitStatus };
}

/** Stable category/path/symbol keys, including every sorted duplicate location. */
export function findingIdentities(findings: FindingGroups): string[] {
  return [
    ...findings.unused_exports.map(
      (finding) => `unused_exports|${finding.path}|${finding.export_name}`,
    ),
    ...findings.unused_types.map(
      (finding) => `unused_types|${finding.path}|${finding.export_name}`,
    ),
    ...findings.unused_files.map((finding) => `unused_files|${finding.path}`),
    ...findings.unused_class_members.map(
      (finding) =>
        `unused_class_members|${finding.path}|${finding.parent_name}|${finding.member_name}|${finding.kind}`,
    ),
    ...findings.duplicate_exports.map(
      (finding) =>
        `duplicate_exports|${finding.export_name}|${finding.locations
          .map((location) => location.path)
          .sort()
          .join("|")}`,
    ),
  ].sort();
}

/** Compare the complete census after canonicalizing category and location order. */
export function assertFindingCensus(findings: FindingGroups, pinned: FindingGroups): void {
  assert.deepStrictEqual(findingIdentities(findings), findingIdentities(pinned));
}

/** Fixed argv, no shell, separate output files, and cleanup on every failure path. */
export function readAnalyzerReport(
  command: string,
  args: readonly string[],
  cwd: string,
): AnalyzerReport {
  const outputRoot = mkdtempSync(path.join(tmpdir(), "fallow-report-"));
  try {
    const stdoutPath = path.join(outputRoot, "stdout.json");
    const stderrPath = path.join(outputRoot, "stderr.txt");
    const stdout = openSync(stdoutPath, "w");
    try {
      const stderr = openSync(stderrPath, "w");
      try {
        const execution = spawnSync(command, args, { cwd, stdio: ["ignore", stdout, stderr] });
        if (execution.error !== undefined) {
          throw execution.error;
        }

        assert.strictEqual(
          execution.signal,
          null,
          "The analyzer was terminated before measuring the census",
        );
        assert.ok(
          execution.status === 0 || execution.status === 1,
          readFileSync(stderrPath, "utf8"),
        );
        return parseReport(readFileSync(stdoutPath, "utf8"), execution.status);
      } finally {
        closeSync(stderr);
      }
    } finally {
      closeSync(stdout);
    }
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
}
