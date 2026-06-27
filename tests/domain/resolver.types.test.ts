// NFR-7 verifier (three-way state, D-64-01).
//
// The load-bearing assertions in this file are the // @ts-expect-error
// lines below: TypeScript MUST refuse to typecheck a read of `pluginRoot`
// from the `unavailable` ResolvedPlugin variant (NFR-7, D-64-05), and MUST
// prove that `requireForceInstallable` can never leave a value as the
// `unavailable` arm (RSTATE-04). If any expected error fails to materialize,
// TypeScript reports "Unused @ts-expect-error directive." and
// `npm run typecheck` fails.
//
// The runtime test at the bottom is purely a smoke check; it ensures the
// file participates in `node --test` so a missing import doesn't silently
// disappear.

import assert from "node:assert/strict";
import test from "node:test";

import { requireForceInstallable } from "../../extensions/pi-claude-marketplace/domain/resolver.ts";

import type {
  ResolvedPlugin,
  ResolvedPluginInstallable,
  ResolvedPluginUnsupported,
  ResolvedPluginUnavailable,
} from "../../extensions/pi-claude-marketplace/domain/resolver.ts";

declare const r: ResolvedPlugin;
declare const inst: ResolvedPluginInstallable;
declare const unsup: ResolvedPluginUnsupported;
declare const unavail: ResolvedPluginUnavailable;

// ──────────────────────────────────────────────────────────────────────────
// Positive narrowing: pluginRoot is readable on installable + unsupported
// (D-64-06: `unsupported` is the force-degradable arm and keeps pluginRoot).
// ──────────────────────────────────────────────────────────────────────────

function consumeInstallable(): string {
  return inst.pluginRoot; // OK -- ResolvedPluginInstallable has pluginRoot (NFR-7)
}

function consumeUnsupported(): string {
  return unsup.pluginRoot; // OK -- D-64-06: unsupported keeps pluginRoot
}

function narrowOnDiscriminator(): string | undefined {
  if (r.state === "installable" || r.state === "unsupported") {
    return r.pluginRoot; // OK -- narrowed to installable | unsupported (NFR-7)
  }

  return undefined;
}

// ──────────────────────────────────────────────────────────────────────────
// NEGATIVE narrowing -- the load-bearing NFR-7 assertions (D-64-05).
// ──────────────────────────────────────────────────────────────────────────

function consumeUnavailable(): void {
  // @ts-expect-error -- NFR-7: pluginRoot must NOT be accessible on the unavailable variant.
  void unavail.pluginRoot;
}

function narrowOnDiscriminatorNegative(): void {
  if (r.state === "unavailable") {
    // @ts-expect-error -- NFR-7: r is narrowed to ResolvedPluginUnavailable here; pluginRoot must be inaccessible.
    void r.pluginRoot;
  }
}

// ──────────────────────────────────────────────────────────────────────────
// RSTATE-04 / D-64-04: requireForceInstallable narrows to
// installable | unsupported and can NEVER admit the unavailable arm.
// ──────────────────────────────────────────────────────────────────────────

function gateNarrowsForce(): string {
  requireForceInstallable(r);
  // r is now ResolvedPluginInstallable | ResolvedPluginUnsupported -- pluginRoot readable.
  return r.pluginRoot;
}

function gateExcludesUnavailable(): void {
  requireForceInstallable(r);
  // @ts-expect-error -- RSTATE-04: after requireForceInstallable, r can never be the unavailable arm.
  const bad: ResolvedPluginUnavailable = r;
  void bad;
}

// Reference the helpers so tsc doesn't flag them as unused (they're not
// exported -- keeping them tree-shake-safe).
void consumeInstallable;
void consumeUnsupported;
void narrowOnDiscriminator;
void consumeUnavailable;
void narrowOnDiscriminatorNegative;
void gateNarrowsForce;
void gateExcludesUnavailable;

test("NFR-7 type-level test: typecheck (npm run typecheck) is the load-bearing assertion", () => {
  // The actual NFR-7 verification happens at compile time -- if this file
  // compiles, the @ts-expect-error directives above were satisfied. This
  // runtime test only ensures the file participates in node --test so a
  // missing import doesn't silently disappear.
  assert.equal(typeof "ok", "string");
});
