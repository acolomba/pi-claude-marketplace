import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * IL-4: V1 MUST NOT emit telemetry (no metrics, event sink, or analytics
 * endpoint). The strict reading is "no telemetry CODE"; this test enforces
 * the stronger "no telemetry DEPENDENCIES" so the future-self of the
 * codebase can't quietly slip a tracking SDK into deps and start using it.
 *
 * The forbidden list covers the major Node telemetry/analytics SDKs as of
 * 2026-05-09. If a new vendor surfaces, add their npm scope/name here.
 */
const FORBIDDEN_DEP_PATTERNS: ReadonlyArray<string> = [
  "@sentry/",
  "@opentelemetry/",
  "applicationinsights",
  "datadog",
  "mixpanel",
  "newrelic",
  "posthog",
  "segment",
  "amplitude",
];

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

test("no telemetry / analytics dependencies in package.json (IL-4)", async () => {
  const raw = await readFile(path.join(REPO_ROOT, "package.json"), "utf8");
  const pkg = JSON.parse(raw) as PackageJson;

  const allDeps: Record<string, string> = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
    ...(pkg.peerDependencies ?? {}),
    ...(pkg.optionalDependencies ?? {}),
  };

  const offenders: string[] = [];
  for (const name of Object.keys(allDeps)) {
    for (const banned of FORBIDDEN_DEP_PATTERNS) {
      if (name.includes(banned)) {
        offenders.push(`${name} (matches forbidden pattern "${banned}")`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `IL-4 violation: telemetry/analytics dependency detected:\n  ${offenders.join("\n  ")}`,
  );
});
