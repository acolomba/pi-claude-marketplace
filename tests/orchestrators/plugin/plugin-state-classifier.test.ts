// tests/orchestrators/plugin/plugin-state-classifier.test.ts
//
// D-67-02 / LIST-02 unit corpus for the shared per-entry plugin-state
// classifier. The classifier is the SINGLE source of plugin-state
// classification consumed by BOTH the list orchestrator
// (`installedRowMessage` / `availableRowMessage`) and the completion
// bucketizer (`orchestrators/edge-deps.ts::loadManifestForMarketplace`).
// These cases pin the pure decision table independently of either caller.
//
//   - classifyInstalledRecord: installed | upgradable | force-installed |
//     force-upgradable, including the A4 force-installed-wins-over-upgradable
//     precedence and the CR-01 candidate-probe-failure degrade-to-upgradable.
//   - classifyManifestEntry: available | unsupported | unavailable, mapping
//     1:1 onto the resolver's three-way `ResolvedPlugin.state` discriminant.

import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyInstalledRecord,
  classifyManifestEntry,
  type InstalledRecordLike,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/plugin-state-classifier.ts";

import type { ResolvedPlugin } from "../../../extensions/pi-claude-marketplace/domain/resolver.ts";

// ──────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────

function record(
  unsupported: readonly string[] = [],
  opts: { enabled?: boolean; installable?: boolean } = {},
): InstalledRecordLike {
  return {
    enabled: opts.enabled ?? true,
    compatibility: {
      installable: opts.installable ?? unsupported.length === 0,
      unsupported,
    },
  };
}

function installable(name = "p"): ResolvedPlugin {
  return {
    state: "installable",
    name,
    pluginRoot: `/tmp/${name}`,
    supported: [],
    unsupported: [],
    notes: [],
    componentPaths: { skills: [], commands: [], agents: [] },
    mcpServers: {},
  };
}

function unsupportedResolved(
  name = "p",
  unsupported: readonly string[] = ["lspServers"],
): ResolvedPlugin {
  return {
    state: "unsupported",
    name,
    pluginRoot: `/tmp/${name}`,
    supported: [],
    unsupported: [...unsupported],
    notes: [...unsupported.map((k) => `contains ${k}`)],
    componentPaths: { skills: [], commands: [], agents: [] },
    mcpServers: {},
  };
}

function unavailableResolved(name = "p"): ResolvedPlugin {
  return { state: "unavailable", name, notes: ["source dir does not exist"] };
}

// ──────────────────────────────────────────────────────────────────────────
// classifyInstalledRecord
// ──────────────────────────────────────────────────────────────────────────

test("classifyInstalledRecord: a clean record with no upgrade candidate is `installed`", () => {
  assert.equal(classifyInstalledRecord(record(), { upgradable: false }), "installed");
});

test("classifyInstalledRecord: a clean record whose candidate resolves clean is `upgradable`", () => {
  assert.equal(
    classifyInstalledRecord(record(), { upgradable: true, resolved: installable() }),
    "upgradable",
  );
});

test("classifyInstalledRecord: a clean record whose newer candidate resolves `unsupported` is `force-upgradable`", () => {
  assert.equal(
    classifyInstalledRecord(record(), { upgradable: true, resolved: unsupportedResolved() }),
    "force-upgradable",
  );
});

test("classifyInstalledRecord: a record with persisted compatibility.unsupported is `force-installed`", () => {
  assert.equal(
    classifyInstalledRecord(record(["lspServers"]), { upgradable: false }),
    "force-installed",
  );
});

test("A4: force-installed wins over upgradable when a degraded record ALSO has an upgrade candidate", () => {
  // Precedence: a record that is BOTH degraded (compatibility.unsupported
  // non-empty) AND has a newer candidate resolves `force-installed`, never
  // `upgradable`/`force-upgradable`. The candidate resolution is not even
  // consulted once the degraded-record branch wins.
  assert.equal(
    classifyInstalledRecord(record(["lspServers"]), {
      upgradable: true,
      resolved: unsupportedResolved(),
    }),
    "force-installed",
  );
  assert.equal(
    classifyInstalledRecord(record(["lspServers"]), {
      upgradable: true,
      resolved: installable(),
    }),
    "force-installed",
  );
});

test("WR-01 / ENBL-02: a recorded-but-disabled record is `installed`, never split into upgradable/force-upgradable", () => {
  // The `installable: true` + `enabled: false` marker (isRecordedButDisabled)
  // is version-frozen: even with a newer candidate that would resolve clean OR
  // unsupported, the classifier short-circuits to `installed` so the disabled
  // record never leaks into the `update --force` candidate set. `list` renders
  // the distinct `(disabled)` token via its own pre-classifier guard.
  const disabled = record([], { enabled: false, installable: true });
  assert.equal(classifyInstalledRecord(disabled, { upgradable: false }), "installed");
  assert.equal(
    classifyInstalledRecord(disabled, { upgradable: true, resolved: installable() }),
    "installed",
  );
  assert.equal(
    classifyInstalledRecord(disabled, { upgradable: true, resolved: unsupportedResolved() }),
    "installed",
  );
});

test("CR-01: an upgradable clean record whose candidate probe FAILED degrades to `upgradable` (never force-upgradable)", () => {
  // `resolved: undefined` is the probe-failure signal -- the classifier must
  // not assert a force degrade it could not probe; it falls back to the plain
  // `upgradable` row (the truthful "could not assert a degrade" default).
  assert.equal(
    classifyInstalledRecord(record(), { upgradable: true, resolved: undefined }),
    "upgradable",
  );
});

test("classifyInstalledRecord: a clean record whose candidate resolves `unavailable` stays `upgradable`", () => {
  assert.equal(
    classifyInstalledRecord(record(), { upgradable: true, resolved: unavailableResolved() }),
    "upgradable",
  );
});

// ──────────────────────────────────────────────────────────────────────────
// classifyManifestEntry
// ──────────────────────────────────────────────────────────────────────────

test("classifyManifestEntry: an `installable` resolution is `available`", () => {
  assert.equal(classifyManifestEntry(installable()), "available");
});

test("classifyManifestEntry: an `unsupported` resolution is `unsupported`", () => {
  assert.equal(classifyManifestEntry(unsupportedResolved()), "unsupported");
});

test("classifyManifestEntry: an `unavailable` resolution is `unavailable`", () => {
  assert.equal(classifyManifestEntry(unavailableResolved()), "unavailable");
});
