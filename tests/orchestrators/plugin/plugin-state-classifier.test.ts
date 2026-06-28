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

test("A4: a degraded record is never split into `upgradable`/`force-upgradable`", () => {
  // Precedence: a record that is BOTH degraded (compatibility.unsupported
  // non-empty) AND has a newer candidate is never relabeled `upgradable` or
  // `force-upgradable` -- those clean-record states stay off-limits (FSTAT-04).
  // A meaningful candidate makes it `force-installed-upgradable` (see WR-02
  // below); a no-candidate degraded record is plain `force-installed`.
  assert.notEqual(
    classifyInstalledRecord(record(["lspServers"]), {
      upgradable: true,
      resolved: installable(),
    }),
    "upgradable",
  );
  assert.notEqual(
    classifyInstalledRecord(record(["lspServers"]), {
      upgradable: true,
      resolved: unsupportedResolved(),
    }),
    "force-upgradable",
  );
});

test("WR-02 / FSTAT-03: a degraded record WITH a newer, non-unavailable candidate is `force-installed-upgradable`", () => {
  // The force-update is meaningful: a supported candidate promotes the row back
  // to `installed` (FSTAT-03), an unsupported candidate re-applies the force.
  // Either way it must be offerable under `update --force` -- the distinct
  // `force-installed-upgradable` status carries that affordance while `list`
  // still renders it `(force-installed)`. It is NEVER `force-upgradable`.
  assert.equal(
    classifyInstalledRecord(record(["lspServers"]), {
      upgradable: true,
      resolved: installable(),
    }),
    "force-installed-upgradable",
  );
  assert.equal(
    classifyInstalledRecord(record(["lspServers"]), {
      upgradable: true,
      resolved: unsupportedResolved(),
    }),
    "force-installed-upgradable",
  );
});

test("WR-02: a degraded record with NO newer candidate -- or a structural-`unavailable` candidate -- stays plain `force-installed`", () => {
  // No newer candidate: nothing to upgrade to (a same-version force re-apply is
  // `reinstall`'s job, RINST-01), so it is NOT an `update --force` candidate.
  assert.equal(
    classifyInstalledRecord(record(["lspServers"]), { upgradable: false }),
    "force-installed",
  );
  // A candidate that resolves structural `unavailable` cannot be installed even
  // under `--force` (FORCE-05), so the degraded row stays plain `force-installed`.
  assert.equal(
    classifyInstalledRecord(record(["lspServers"]), {
      upgradable: true,
      resolved: unavailableResolved(),
    }),
    "force-installed",
  );
});

test("WR-02 / CR-01: a degraded record whose newer candidate probe FAILED is `force-installed-upgradable` (undefined is not `unavailable`)", () => {
  // `resolved: undefined` cannot assert the candidate is gone, so -- mirroring
  // the clean record's degrade-to-`upgradable` -- it is treated as a meaningful
  // (non-unavailable) candidate and remains offerable under `update --force`.
  assert.equal(
    classifyInstalledRecord(record(["lspServers"]), { upgradable: true, resolved: undefined }),
    "force-installed-upgradable",
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
