// NFR-7 verifier.
//
// The load-bearing assertion in this file is at the // @ts-expect-error
// line below: TypeScript MUST refuse to typecheck a read of `pluginRoot`
// from a non-installable ResolvedPlugin variant. If this file compiles
// without the expected error, TypeScript reports
//   "Unused @ts-expect-error directive."
// and `npm run typecheck` fails.
//
// The runtime test at the bottom is purely a smoke check; it ensures the
// file participates in `node --test` so a missing import doesn't silently
// disappear.

import assert from "node:assert/strict";
import test from "node:test";

import type {
  ResolvedPlugin,
  ResolvedPluginInstallable,
  ResolvedPluginNotInstallable,
} from "../../extensions/pi-claude-marketplace/domain/resolver.ts";

declare const r: ResolvedPlugin;
declare const inst: ResolvedPluginInstallable;
declare const notInst: ResolvedPluginNotInstallable;

// ──────────────────────────────────────────────────────────────────────────
// Positive narrowing: pluginRoot is readable on the installable variant.
// ──────────────────────────────────────────────────────────────────────────

function consumeInstallable(): string {
  return inst.pluginRoot; // OK -- ResolvedPluginInstallable has pluginRoot (NFR-7)
}

function narrowOnDiscriminator(): string | undefined {
  if (r.installable) {
    return r.pluginRoot; // OK -- narrowed to ResolvedPluginInstallable (NFR-7)
  }

  return undefined;
}

// ──────────────────────────────────────────────────────────────────────────
// NEGATIVE narrowing -- the load-bearing assertion of this file (NFR-7).
// ──────────────────────────────────────────────────────────────────────────

function consumeNotInstallable(): void {
  // @ts-expect-error -- NFR-7: pluginRoot must NOT be accessible on the not-installable variant.
  void notInst.pluginRoot;
}

function narrowOnDiscriminatorNegative(): void {
  if (!r.installable) {
    // @ts-expect-error -- NFR-7: r is narrowed to ResolvedPluginNotInstallable here; pluginRoot must be inaccessible.
    void r.pluginRoot;
  }
}

// Reference the helpers so tsc doesn't flag them as unused (they're not
// exported -- keeping them tree-shake-safe).
void consumeInstallable;
void narrowOnDiscriminator;
void consumeNotInstallable;
void narrowOnDiscriminatorNegative;

test("NFR-7 type-level test: typecheck (npm run typecheck) is the load-bearing assertion", () => {
  // The actual NFR-7 verification happens at compile time -- if this file
  // compiles, the @ts-expect-error directives above were satisfied. This
  // runtime test only ensures the file participates in node --test so a
  // missing import doesn't silently disappear.
  assert.equal(typeof "ok", "string");
});
