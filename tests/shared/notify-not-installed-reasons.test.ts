/**
 * tests/shared/notify-not-installed-reasons.test.ts -- live-field guard for the
 * reasons brace on the two NOT-INSTALLED candidate rows. Each row has its own
 * anchor and they are not interchangeable: `(available)` is OUT-02's row, and
 * `(remote)` is RSTA-01's, read network-free under OUT-05.
 *
 * Both shared row shapes gained an OPTIONAL `reasons` field. An arm that passes
 * nothing in its place still type-checks, still renders identical bytes for
 * every producer that stamps nothing, and silently drops the brace for any
 * producer that does. That is the regression class, and it is the same one
 * `notify-disabled-reasons.test.ts` exists for on the sibling `(disabled)` row.
 *
 * FOUR arms render these two rows: the central `renderPluginRow` switch in
 * `shared/notify.ts` and the list-scoped render map that lifted its body
 * (`list.messaging.ts`). The list map's two arms FORWARD the field; the central
 * switch's two arms deliberately DROP it, because no producer reaching them ever
 * stamps it. This file pins both halves, so neither can change unnoticed -- and
 * the drop is asserted rather than left as a comment precisely so a later reader
 * does not read it as a defect and "fix" it.
 *
 * The info plugin row is the third shape covered here. It already carried an
 * optional `reasons` and already composed it, so its tests pin an inherited
 * behavior the not-installed claim now relies on.
 *
 * Bytes only. Severity and the reload trailer are stamped per row and are
 * asserted by `notify-inert-fields.test.ts` and
 * `notify-producer-wire-coverage.test.ts`.
 */

import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { LIST_CONTEXT } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/list.messaging.ts";
import { notifyWithContext } from "../../extensions/pi-claude-marketplace/shared/notify-context.ts";
import {
  notify,
  type NotificationMessage,
  type PluginAvailableMessage,
  type PluginInfoRow,
  type PluginRemoteMessage,
} from "../../extensions/pi-claude-marketplace/shared/notify.ts";

interface MockCtx {
  ui: { notify: ReturnType<typeof mock.fn> };
}

function makeCtx(): MockCtx {
  return { ui: { notify: mock.fn() } };
}

/** Probe reports both companion extensions loaded (no soft-dep markers fire). */
function piWithBothLoaded(): { getAllTools: () => { name?: string }[] } {
  return { getAllTools: () => [{ name: "subagent" }, { name: "mcp" }] };
}

/** The single emitted body, asserted to be the only notification. */
function soleBody(ctx: MockCtx): string {
  assert.equal(ctx.ui.notify.mock.calls.length, 1);
  return ctx.ui.notify.mock.calls[0]!.arguments[0] as string;
}

/**
 * The two NOT-INSTALLED candidate rows every arm below renders. Typed as their
 * production shapes rather than loose objects, so a status or field that has
 * drifted out of the shared union is a compile error here rather than a passing
 * test over a row no producer could build.
 */
type CandidateRow = PluginAvailableMessage | PluginRemoteMessage;

/** The stamped `(available)` candidate row. */
const AVAILABLE_ROW: PluginAvailableMessage = {
  status: "available",
  name: "foo-plugin",
  version: "1.2.3",
  reasons: ["installs disabled"],
};

/** The stamped `(remote)` candidate row -- the unfetched git-source shape. */
const REMOTE_ROW: PluginRemoteMessage = {
  status: "remote",
  name: "foo-plugin",
  version: "1.2.3",
  reasons: ["installs disabled"],
};

const EXPECTED_AVAILABLE_ROW = "  ○ foo-plugin v1.2.3 (available) {installs disabled}";
const EXPECTED_REMOTE_ROW = "  ◌ foo-plugin v1.2.3 (remote) {installs disabled}";
const BARE_AVAILABLE_ROW = "  ○ foo-plugin v1.2.3 (available)";
const BARE_REMOTE_ROW = "  ◌ foo-plugin v1.2.3 (remote)";

/** Render one candidate row through the list command's own render map. */
function listBody(row: CandidateRow): string {
  const ctx = makeCtx();
  notifyWithContext(ctx as never, piWithBothLoaded() as never, LIST_CONTEXT, [
    { name: "mp", scope: "user", plugins: [row] },
  ]);
  return soleBody(ctx);
}

/** Render one candidate row through the CENTRAL `renderPluginRow` switch. */
function centralBody(row: CandidateRow): string {
  const ctx = makeCtx();
  const msg: NotificationMessage = {
    marketplaces: [{ name: "mp", scope: "user", plugins: [row] }],
  };
  notify(ctx as never, piWithBothLoaded() as never, msg);
  return soleBody(ctx);
}

/** Render one info plugin row through the info renderer. */
function infoBody(plugin: PluginInfoRow): string {
  const ctx = makeCtx();
  const msg: NotificationMessage = {
    kind: "plugin-info",
    marketplaceName: "mp",
    marketplaceScope: "user",
    marketplaceDetails: { autoupdate: true },
    plugin,
  };
  notify(ctx as never, piWithBothLoaded() as never, msg);
  return soleBody(ctx);
}

test("OUT-02: the LIST render map renders a stamped reason on the `(available)` candidate row", () => {
  assert.equal(listBody(AVAILABLE_ROW), ["● mp [user]", EXPECTED_AVAILABLE_ROW].join("\n"));
});

test("OUT-02 / OUT-05 / RSTA-01: the LIST render map renders a stamped reason on the unfetched `(remote)` row", () => {
  assert.equal(listBody(REMOTE_ROW), ["● mp [user]", EXPECTED_REMOTE_ROW].join("\n"));
});

// The two DROP tests below assert what the central arms do by CONSTRUCTION. No
// producer on those paths stamps the field: the surfaces that build candidate
// rows through the central switch -- the fetch surface among them -- construct
// them without reasons and always have. Forwarding there would be plumbing with
// no producer behind it, so the drop is correct rather than an oversight.
//
// The row passed in carries a POPULATED reasons array, because a test that
// passed an empty one would prove nothing about dropping. If a producer for one
// of these arms is ever added, THIS test is the one that must be updated first
// -- which is the whole reason the drop is asserted instead of commented.
//
// The IDs on the two titles name the ROW each case covers, not the drop: the
// drop is a renderer-level consequence of there being no producer, and it has
// no requirement-level home. Borrowing an unrelated ID for it would read as
// traceability while supplying none.
test("OUT-02: the CENTRAL row renderer drops a stamped reason on the `(available)` row", () => {
  assert.equal(centralBody(AVAILABLE_ROW), ["● mp [user]", BARE_AVAILABLE_ROW].join("\n"));
});

test("OUT-05 / RSTA-01: the CENTRAL row renderer drops a stamped reason on the `(remote)` row", () => {
  assert.equal(centralBody(REMOTE_ROW), ["● mp [user]", BARE_REMOTE_ROW].join("\n"));
});

test("DFEN-08: on the LIST map an absent reasons field and an empty reasons array render byte-identically on BOTH candidate arms", () => {
  // The two bodies are compared against EACH OTHER rather than each against a
  // hand-written literal, so what is asserted is identity rather than two
  // guesses that happen to agree. This is why the composer may set the field
  // unconditionally and why no conditional machinery is warranted: a plugin that
  // never uses the field pays nothing, whichever shape reaches the renderer.
  const availableAbsent = listBody({ status: "available", name: "foo-plugin", version: "1.2.3" });
  const availableEmpty = listBody({
    status: "available",
    name: "foo-plugin",
    version: "1.2.3",
    reasons: [],
  });
  assert.equal(availableAbsent, availableEmpty);
  assert.equal(availableAbsent, ["● mp [user]", BARE_AVAILABLE_ROW].join("\n"));

  const remoteAbsent = listBody({ status: "remote", name: "foo-plugin", version: "1.2.3" });
  const remoteEmpty = listBody({
    status: "remote",
    name: "foo-plugin",
    version: "1.2.3",
    reasons: [],
  });
  assert.equal(remoteAbsent, remoteEmpty);
  assert.equal(remoteAbsent, ["● mp [user]", BARE_REMOTE_ROW].join("\n"));
});

test("OUT-03 / DFEN-08: the INFO plugin row renders a stamped reason, and an absent field and an empty array render byte-identically there too", () => {
  const stamped = infoBody({ ...AVAILABLE_ROW, componentsResolved: false });
  assert.equal(
    stamped,
    ["● mp [user] <autoupdate>", EXPECTED_AVAILABLE_ROW, "    components: not resolved"].join("\n"),
  );

  const absent = infoBody({
    status: "available",
    name: "foo-plugin",
    version: "1.2.3",
    componentsResolved: false,
  });
  const empty = infoBody({
    status: "available",
    name: "foo-plugin",
    version: "1.2.3",
    reasons: [],
    componentsResolved: false,
  });
  assert.equal(absent, empty);
  assert.equal(
    absent,
    ["● mp [user] <autoupdate>", BARE_AVAILABLE_ROW, "    components: not resolved"].join("\n"),
  );
});
