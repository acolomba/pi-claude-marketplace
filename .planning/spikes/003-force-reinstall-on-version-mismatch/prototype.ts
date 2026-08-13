// Spike 003 prototype -- proves the core detection mechanism against the
// REAL, currently-shipping STATE_VALIDATOR (imported unmodified from
// persistence/state-io.ts), not a hand-rolled mock.
//
// Claim under test: "does the raw parsed state.json pass STATE_VALIDATOR.Check()
// as-is, before any migrate.ts field-fill runs?" is a sufficient staleness
// signal for every REQUIRED-field addition (ENBL-02, HOOK-02), and therefore
// migrate.ts's field-by-field fill logic can be replaced by a single boolean
// gate: valid -> load normally; invalid -> treat the whole scope as stale and
// force a full resync instead of healing field-by-field.
//
// Also proves the one case this signal does NOT catch: a stray legacy field
// (`autoupdate`) left on an otherwise-current-shape record. TypeBox tolerates
// extra properties by default (no `additionalProperties: false` anywhere in
// STATE_SCHEMA), so Check() still passes.

import { STATE_VALIDATOR } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";

const CURRENT_SHAPE_RECORD = {
  schemaVersion: 2,
  marketplaces: {
    acme: {
      name: "acme",
      scope: "user",
      source: { kind: "github", raw: "acme/tools" },
      addedFromCwd: "/home/user",
      manifestPath:
        "/home/user/.pi/agent/pi-claude-marketplace/sources/acme/.claude-plugin/marketplace.json",
      marketplaceRoot: "/home/user/.pi/agent/pi-claude-marketplace/sources/acme",
      plugins: {
        widget: {
          version: "hash-abc123def456",
          resolvedSource: "acme/tools",
          compatibility: { installable: true, notes: [], supported: ["skills"], unsupported: [] },
          resources: {
            skills: ["widget-skill"],
            prompts: [],
            agents: [],
            mcpServers: [],
            hooks: [],
          },
          enabled: true,
          installedAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
        },
      },
    },
  },
};

// Pre-ENBL-02 shape (schemaVersion 1): missing `enabled` on the plugin record.
const PRE_ENBL02_RECORD = structuredClone(CURRENT_SHAPE_RECORD);
PRE_ENBL02_RECORD.schemaVersion = 1;
delete (PRE_ENBL02_RECORD.marketplaces.acme.plugins.widget as { enabled?: boolean }).enabled;

// Pre-HOOK-02 shape: missing `resources.hooks` entirely.
const PRE_HOOK02_RECORD = structuredClone(CURRENT_SHAPE_RECORD);
delete (PRE_HOOK02_RECORD.marketplaces.acme.plugins.widget.resources as { hooks?: string[] }).hooks;

// Pre-D-13 shape: current-shape record PLUS the stray legacy `autoupdate` field.
const STALE_AUTOUPDATE_RECORD = structuredClone(CURRENT_SHAPE_RECORD) as Record<string, unknown>;
(
  (STALE_AUTOUPDATE_RECORD.marketplaces as Record<string, unknown>).acme as Record<string, unknown>
).autoupdate = true;

function report(label: string, value: unknown): void {
  const ok = STATE_VALIDATOR.Check(value);
  // eslint-disable-next-line no-console -- spike scratch script, not production code
  console.log(`${ok ? "PASS (looks current)" : "FAIL (flagged stale)"}  ${label}`);
}

// Pre-ST-4 shape: missing marketplace-level `manifestPath` (not a plugin
// field at all -- proves ONE top-level Check() flags marketplace-level
// staleness too, not just plugin-level).
const PRE_ST4_RECORD = structuredClone(CURRENT_SHAPE_RECORD) as Record<string, unknown>;
delete ((PRE_ST4_RECORD.marketplaces as Record<string, unknown>).acme as Record<string, unknown>)
  .manifestPath;

report("current-shape record", CURRENT_SHAPE_RECORD);
report("pre-ENBL-02 record (missing `enabled`)", PRE_ENBL02_RECORD);
report("pre-HOOK-02 record (missing `resources.hooks`)", PRE_HOOK02_RECORD);
report("pre-ST-4 record (missing marketplace `manifestPath`)", PRE_ST4_RECORD);
report("stale-autoupdate record (extra legacy field)", STALE_AUTOUPDATE_RECORD);
