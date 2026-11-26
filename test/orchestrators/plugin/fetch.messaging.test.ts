import assert from "node:assert/strict";
import test from "node:test";

import { createGitHubCloneNotes } from "../../../extensions/pi-claude-marketplace/orchestrators/github-transport.ts";
import {
  FETCH_CONTEXT,
  type FetchMsg,
  withFetchCloneNote,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/fetch.messaging.ts";
import { composePluginLines } from "../../../extensions/pi-claude-marketplace/shared/notification-grammar.ts";
import { resolveRows } from "../../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";

import type { ResolvedRow } from "../../../extensions/pi-claude-marketplace/shared/notification-resolve.ts";

test("exports the complete fetch command context", () => {
  // arrange
  const expectedRenderKeys = [
    "available",
    "partially-available",
    "unavailable",
    "remote",
    "skipped",
    "failed",
  ];

  // act
  const contextKeys = Object.keys(FETCH_CONTEXT);
  const renderKeys = Object.keys(FETCH_CONTEXT.rowPolicies);

  // assert
  assert.deepEqual(contextKeys, ["Messaging", "rowPolicies"]);
  assert.deepEqual(FETCH_CONTEXT.Messaging, { label: "Plugin fetch" });
  assert.deepEqual(renderKeys, expectedRenderKeys);
});

test("renders an available post-fetch row without candidate reasons or scope", () => {
  // arrange
  const row = {
    status: "available",
    name: "alpha",
    version: "1.2.3",
    reasons: ["installs disabled"],
  } as const satisfies ResolvedRow<FetchMsg>;

  // act
  const actual = composePluginLines(
    resolveRows(
      [{ name: "official", scope: "project", plugins: [row] }],
      runWithNothingLoaded().softDeps,
      FETCH_CONTEXT.rowPolicies,
    )[0]!.plugins[0]!,
    "project",
  )[0]!.slice(2);

  // assert
  assert.equal(actual, "○ alpha v1.2.3 (available)");
  assert.equal(Object.hasOwn(row, "needsReload"), false);
});

test("renders a partially-available post-fetch row with complete reasons", () => {
  // arrange
  const row = {
    status: "partially-available",
    name: "beta",
    version: "2.0.0",
    reasons: ["unsupported hooks"],
  } as const satisfies ResolvedRow<FetchMsg>;

  // act
  const actual = composePluginLines(
    resolveRows(
      [{ name: "official", scope: "user", plugins: [row] }],
      runWithNothingLoaded().softDeps,
      FETCH_CONTEXT.rowPolicies,
    )[0]!.plugins[0]!,
    "user",
  )[0]!.slice(2);

  // assert
  assert.equal(actual, "⊖ beta v2.0.0 (partially-available) {unsupported hooks}");
  assert.equal(Object.hasOwn(row, "needsReload"), false);
});

test("renders an unavailable post-fetch row without a scope bracket", () => {
  // arrange
  const row = {
    status: "unavailable",
    name: "gamma",
    reasons: ["permission denied"],
  } as const satisfies ResolvedRow<FetchMsg>;

  // act
  const actual = composePluginLines(
    resolveRows(
      [{ name: "official", scope: "project", plugins: [row] }],
      runWithNothingLoaded().softDeps,
      FETCH_CONTEXT.rowPolicies,
    )[0]!.plugins[0]!,
    "project",
  )[0]!.slice(2);

  // assert
  assert.equal(actual, "⊘ gamma (unavailable) {permission denied}");
  assert.equal(Object.hasOwn(row, "needsReload"), false);
});

test("renders a bare remote post-fetch row without candidate reasons", () => {
  // arrange
  const row = {
    status: "remote",
    name: "delta",
    reasons: ["installs disabled"],
  } as const satisfies ResolvedRow<FetchMsg>;

  // act
  const actual = composePluginLines(
    resolveRows(
      [{ name: "official", scope: "user", plugins: [row] }],
      runWithNothingLoaded().softDeps,
      FETCH_CONTEXT.rowPolicies,
    )[0]!.plugins[0]!,
    "user",
  )[0]!.slice(2);

  // assert
  assert.equal(actual, "◌ delta (remote)");
  assert.equal(Object.hasOwn(row, "needsReload"), false);
});

test("renders a skipped no-op row with scope, version, and reason", () => {
  // arrange
  const row = {
    status: "skipped",
    name: "epsilon",
    scope: "project",
    version: "3.1.4",
    reasons: ["up-to-date"],
  } as const satisfies ResolvedRow<FetchMsg>;

  // act
  const actual = composePluginLines(
    resolveRows(
      [{ name: "official", scope: "user", plugins: [row] }],
      runWithNothingLoaded().softDeps,
      FETCH_CONTEXT.rowPolicies,
    )[0]!.plugins[0]!,
    "user",
  )[0]!.slice(2);

  // assert
  assert.equal(actual, "⊘ epsilon [project] v3.1.4 (skipped) {up-to-date}");
  assert.equal(Object.hasOwn(row, "needsReload"), false);
});

test("renders a failed fetch row without leaking its failure detail into the row body", () => {
  // arrange
  const row = {
    status: "failed",
    severity: "error",
    name: "zeta",
    version: "4.0.0",
    reasons: ["network unreachable"],
    failure: {
      cause: { causeChain: ["socket closed"], truncated: false },
      leaks: [],
      rollbackPartial: [],
    },
  } as const satisfies ResolvedRow<FetchMsg>;

  // act
  const actual = composePluginLines(
    resolveRows(
      [{ name: "official", scope: "project", plugins: [row] }],
      runWithNothingLoaded().softDeps,
      FETCH_CONTEXT.rowPolicies,
    )[0]!.plugins[0]!,
    "project",
  )[0]!.slice(2);

  // assert
  assert.equal(actual, "⊘ zeta v4.0.0 (failed) {network unreachable}");
  assert.equal(Object.hasOwn(row, "needsReload"), false);
});

test("FETCH_CONTEXT declares complete row policies", () => {
  // act
  const policies = FETCH_CONTEXT.rowPolicies;

  // assert
  assert.deepStrictEqual(policies, {
    available: { markers: false, contentReasons: false },
    "partially-available": { markers: false, contentReasons: true },
    unavailable: { markers: false, contentReasons: true },
    remote: { markers: false, contentReasons: false },
    skipped: { markers: false, contentReasons: true },
    failed: { markers: false, contentReasons: true },
  });
});

test("D-SG-22: gives each row that can carry one the note of its own subject's clone", () => {
  // arrange
  const notes = createGitHubCloneNotes();
  const clone = { note: "ssh-not-configured", url: "https://github.com/acme/ghp.git" } as const;
  notes.record("ghp@gits", clone);
  notes.record("other@gits", { note: "via-ssh", url: "git@github.com:acme/other.git" });
  const rows: readonly FetchMsg[] = [
    { status: "available", name: "ghp" },
    { status: "partially-available", name: "ghp", reasons: ["lsp"] },
    { status: "unavailable", name: "ghp", reasons: ["source missing"] },
    { status: "failed", name: "ghp", reasons: ["network error"], severity: "error" },
  ];

  // act
  const noted = rows.map((row) => withFetchCloneNote(row, notes, "ghp@gits"));

  // assert
  assert.deepStrictEqual(
    noted,
    rows.map((row) => ({ ...row, clone })),
  );
});

test("D-SG-22: leaves a remote or skipped row, and a row whose subject cloned nothing, unchanged", () => {
  // arrange
  const notes = createGitHubCloneNotes();
  notes.record("ghp@gits", { note: "via-ssh", url: "git@github.com:acme/ghp.git" });
  const remote: FetchMsg = { status: "remote", name: "ghp" };
  const skipped: FetchMsg = { status: "skipped", name: "ghp", reasons: ["up-to-date"] };
  const available: FetchMsg = { status: "available", name: "quiet" };

  // act
  const noted = [
    withFetchCloneNote(remote, notes, "ghp@gits"),
    withFetchCloneNote(skipped, notes, "ghp@gits"),
    withFetchCloneNote(available, notes, "quiet@gits"),
  ];

  // assert
  assert.deepStrictEqual(
    noted.map((row, index) => row === [remote, skipped, available][index]),
    [true, true, true],
  );
});
