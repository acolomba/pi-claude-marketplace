import assert from "node:assert/strict";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { Compile } from "typebox/compile";

import { NOTIFICATION_PAYLOAD_SCHEMA } from "../../extensions/pi-claude-marketplace/shared/notification-wire.ts";
import { resolvePiRuntime, type PiRuntime } from "../pi-runtime.ts";

import { runJsonOutputRuntime } from "./json-output-runtime.ts";

import type { JsonOutputRun } from "./json-output-runtime.ts";

const PAYLOAD_VALIDATOR = Compile(NOTIFICATION_PAYLOAD_SCHEMA);
const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const STARTUP_MARKERS = [
  { marker: "session_start", origin: "startup" },
  { marker: "resources_discover", origin: "startup" },
];

function resolvePeerFloor(): PiRuntime {
  const fixtureRoot = path.join(REPO_ROOT, "test/e2e/pi-peer-floor");
  const packageRoot = path.join(fixtureRoot, "node_modules/@earendil-works/pi-coding-agent");
  const manifestPath = path.join(packageRoot, "package.json");
  assert.ok(
    existsSync(manifestPath),
    "Missing peer floor: run npm --prefix test/e2e/pi-peer-floor ci --ignore-scripts",
  );
  const manifest: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  assert.ok(
    typeof manifest === "object" &&
      manifest !== null &&
      "version" in manifest &&
      "name" in manifest,
  );
  assert.strictEqual(manifest.name, "@earendil-works/pi-coding-agent");
  assert.strictEqual(manifest.version, "1.4.0");
  const runtime = resolvePiRuntime(fixtureRoot);
  assert.strictEqual(runtime.version, "1.4.0");
  const relativeCli = path.relative(realpathSync(packageRoot), realpathSync(runtime.cliPath));
  assert.ok(
    relativeCli.length > 0 &&
      relativeCli !== ".." &&
      !relativeCli.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relativeCli),
    "Peer-floor CLI must resolve inside its own package",
  );
  return runtime;
}

function customEntries(records: readonly Record<string, unknown>[]): Record<string, unknown>[] {
  return records.filter((record) => record.type === "custom");
}

function streamedEntries(run: JsonOutputRun): Record<string, unknown>[] {
  return customEntries(
    run.records
      .filter((record) => record.type === "entry_appended")
      .map((record) => {
        assert.ok(typeof record.entry === "object" && record.entry !== null);
        return record.entry as Record<string, unknown>;
      }),
  );
}

function assertListOutcome(run: JsonOutputRun): number {
  assert.strictEqual(run.exitCode, 0);
  assert.strictEqual(run.stderr, "");
  const payloads = streamedEntries(run)
    .filter((entry) => entry.customType === "claude-plugin")
    .map((entry) => {
      assert.ok(PAYLOAD_VALIDATOR.Check(entry.data), JSON.stringify(entry.data));
      return entry.data;
    });
  const outcomes = payloads.filter((payload) => payload.origin.kind === "command");
  assert.ok(outcomes.length > 0, "No command outcome received");
  for (const payload of outcomes) {
    assert.strictEqual(payload.kind, "cascade");
    assert.strictEqual(payload.origin.kind, "command");
    assert.deepStrictEqual(payload, {
      schemaVersion: 1,
      kind: "cascade",
      origin: {
        kind: "command",
        commandId: "plugin list",
        invocationId: payload.origin.invocationId,
      },
      severity: "info",
      needsReload: false,
      marketplaces: [],
    });
  }

  return outcomes.length;
}

function assertStartupProof(run: JsonOutputRun): void {
  const entries = streamedEntries(run);
  assert.deepStrictEqual(
    entries.filter((entry) => entry.customType === "runtime-startup"),
    [],
  );
  assert.deepStrictEqual(
    entries.filter((entry) => entry.customType === "runtime-proof").map((entry) => entry.data),
    [{ origin: "command", markers: STARTUP_MARKERS }],
  );
  assert.ok(
    entries.findIndex((entry) => entry.customType === "claude-plugin") <
      entries.findIndex((entry) => entry.customType === "runtime-proof"),
  );
}

for (const { label, resolveRuntime } of [
  { label: "installed runtime", resolveRuntime: () => resolvePiRuntime(REPO_ROOT) },
  { label: "peer floor", resolveRuntime: resolvePeerFloor },
]) {
  test(`${label} emits a schema-valid empty list with JSON stdin closed`, async (t) => {
    // arrange
    const runtime = resolveRuntime();

    // act
    const run = await runJsonOutputRuntime({
      runtime,
      mode: "json",
      startupProbe: false,
      persist: false,
    });

    // assert
    const outcomes = assertListOutcome(run);
    t.diagnostic(
      `${label}: Pi ${run.version}; exit ${run.exitCode}; ${outcomes} validated command outcomes; ${run.args.join(" ")}`,
    );
  });

  test(`${label} keeps startup markers in memory outside the JSON stream`, async (t) => {
    // arrange
    const runtime = resolveRuntime();

    // act
    const run = await runJsonOutputRuntime({
      runtime,
      mode: "json",
      startupProbe: true,
      persist: false,
    });

    // assert
    const outcomes = assertListOutcome(run);
    assertStartupProof(run);
    t.diagnostic(
      `${label}: Pi ${run.version}; json; exit ${run.exitCode}; ${outcomes} validated outcomes; both startup markers observed before streamed proof`,
    );
  });

  test(`${label} retrieves unstreamed startup markers with RPC get_entries`, async (t) => {
    // arrange
    const runtime = resolveRuntime();

    // act
    const run = await runJsonOutputRuntime({
      runtime,
      mode: "rpc",
      startupProbe: true,
      persist: false,
    });

    // assert
    const outcomes = assertListOutcome(run);
    assertStartupProof(run);
    t.diagnostic(
      `${label}: Pi ${run.version}; rpc; exit ${run.exitCode}; ${outcomes} validated outcomes; both startup markers observed before streamed proof`,
    );
    const response = run.records.find(
      (record) => record.type === "response" && record.id === "entries",
    );
    assert.ok(response);
    assert.ok(
      typeof response.data === "object" && response.data !== null && "entries" in response.data,
    );
    const entries = response.data.entries;
    assert.ok(Array.isArray(entries));
    assert.deepStrictEqual(
      customEntries(entries)
        .filter((entry) => entry.customType === "runtime-startup")
        .map((entry) => entry.data),
      STARTUP_MARKERS,
    );
  });

  test(`${label} writes no session file for a persistence-enabled slash-only run`, async (t) => {
    // arrange
    const runtime = resolveRuntime();

    // act
    const run = await runJsonOutputRuntime({
      runtime,
      mode: "json",
      startupProbe: false,
      persist: true,
    });

    // assert
    assertListOutcome(run);
    assert.deepStrictEqual(run.sessionFiles, []);
    assert.ok(!run.args.includes("--no-session"));
    t.diagnostic(
      `${label}: Pi ${run.version}; exit ${run.exitCode}; persistence enabled; zero session files`,
    );
  });
}
