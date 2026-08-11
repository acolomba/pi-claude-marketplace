// tests/orchestrators/plugin/info-manifest-absent.test.ts
//
// Byte-exact characterization of `getPluginInfo` blocks whose installation
// record is ABSENT from a marketplace manifest that loaded successfully. Split
// out of `info.test.ts` because this set has its own lifecycle: the state-only
// arm is new behavior, while `info.test.ts` keeps the manifest-backed arms and
// the two boundary pins (BOUND-01 / BOUND-02) it already owns.
//
// Requirement coverage:
//   - INFO-09 an enabled, fully supported manifest-absent record renders
//     `(installed) {not in manifest}` at the RECORDED version
//   - INFO-10 the same record carrying persisted `compatibility.unsupported`
//     kinds renders `(partially-installed)` with the absence token FIRST
//   - INFO-11 the four name-list component kinds render from `resources.*`,
//     sorted, with the Pi-generated installed names verbatim (D-96-01)
//   - ENBL-16 / ENBL-17 a recorded-but-disabled record travels the SAME arm,
//     reporting its retained inventory and its recorded hook entries under a
//     `(disabled)` token, with `{not in manifest}` as the only reason it may
//     carry
//   - INFO-12 / NFR-5 the state-only arm reaches no network surface, asserted
//     as call counts on the injected clone-cache and credential seams
//
// Assertions are whole-message equality against a `[...].join("\n")` literal,
// never a partial regex match: token, glyph, spacing and ordering drift is
// exactly the regression class these requirements exist to catch. A
// state-only block routes to `info` severity, so `notify` is called with no
// second argument and carries NO summary line.
//
// Fixture note: manifest ABSENCE is seeded by a manifest that PARSES with the
// installed name omitted from its `plugins` array. Omitting the manifest FILE
// instead produces a manifest read FAILURE and the bare `(failed)
// {source missing}` row (BOUND-01) -- a different state entirely, pinned in
// `info.test.ts`.

import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { pathSource } from "../../../extensions/pi-claude-marketplace/domain/source.ts";
import {
  materializeOrRefreshPluginMirror,
  materializePluginClone,
  resolvePluginPin,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/clone-cache.ts";
import {
  getPluginInfo,
  type InfoCloneCacheSeam,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/info.ts";
import { saveConfig } from "../../../extensions/pi-claude-marketplace/persistence/config-io.ts";
import { locationsFor } from "../../../extensions/pi-claude-marketplace/persistence/locations.ts";
import { saveState } from "../../../extensions/pi-claude-marketplace/persistence/state-io.ts";
import { makeMockCredentialOps } from "../../helpers/credential-mock.ts";
import { makeMockGitOps } from "../../helpers/git-mock.ts";

import type { GitOps } from "../../../extensions/pi-claude-marketplace/orchestrators/marketplace/shared.ts";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

interface NotifyRecord {
  message: string;
  severity?: string;
}

function makeCtx(): {
  ctx: ExtensionContext;
  pi: ExtensionAPI;
  notifications: NotifyRecord[];
} {
  const notifications: NotifyRecord[] = [];
  const pi = {
    getAllTools: (): unknown[] => [],
  } as unknown as ExtensionAPI;
  const ctx = {
    ui: {
      notify: (m: string, s?: string): void => {
        notifications.push(s === undefined ? { message: m } : { message: m, severity: s });
      },
    },
    pi,
  } as unknown as ExtensionContext;
  return { ctx, pi, notifications };
}

/**
 * Run a callback with HOME pointing at a tmp dir so user-scope state
 * is hermetic. Restores the original HOME afterward.
 */
async function withHermeticHome<T>(
  fn: (env: { home: string; cwd: string }) => Promise<T>,
): Promise<T> {
  const originalHome = process.env.HOME;
  const home = await mkdtemp(path.join(tmpdir(), "plug-info-abs-home-"));
  const cwd = await mkdtemp(path.join(tmpdir(), "plug-info-abs-cwd-"));
  process.env.HOME = home;
  try {
    return await fn({ home, cwd });
  } finally {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    // Retry rmdir: a recursive rm can race a lingering async write (a probe
    // or clone-cache op) and hit ENOTEMPTY on rmdir; retry until it settles.
    await rm(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    await rm(cwd, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

interface SeedPathMarketplaceOpts {
  readonly scope: "user" | "project";
  readonly scopeRoot: string;
  readonly cwd: string;
  readonly mpName: string;
  readonly manifest: { name: string; plugins: readonly Record<string, unknown>[] };
  /**
   * Installed plugin records. `disabled: true` controls the `enabled` boolean
   * and nothing else -- ENBL-05 collapsed the disabled state onto that single
   * axis, and ENBL-18 keeps the inventory intact across a disable, so a
   * disabled record carries the same populated `resources` an enabled one does.
   * Every record defaults to a populated `resources.skills`; a production
   * installed record always has >= 1 populated array.
   */
  readonly installed?: Record<
    string,
    {
      version: string;
      disabled?: boolean;
      /**
       * FSTAT-01 / D-66-01: seed the persisted `compatibility.unsupported`
       * component-kind list. A non-empty value reproduces a recorded-installed
       * plugin that resolved `unsupported` at install time -- the force-installed
       * signal the deriver reads (with `installable: false`).
       */
      unsupported?: readonly string[];
      /**
       * INFO-12: override the persisted `resolvedSource`. The default is the
       * local `./placeholder`; a `https://` value reproduces a git-source-shaped
       * record, which the state-only arm must still refuse to probe.
       */
      resolvedSource?: string;
      /**
       * INFO-11: per-kind override of the persisted `resources` arrays. Each
       * omitted kind keeps its default (`[<name>-skill]` for skills, `[]` for
       * the rest); an explicitly empty array seeds a genuinely empty kind. The
       * state-only arm reads these arrays verbatim, so this is the only way to
       * seed the four name-list kinds and the all-empty edge.
       */
      resources?: {
        skills?: readonly string[];
        prompts?: readonly string[];
        agents?: readonly string[];
        mcpServers?: readonly string[];
        hooks?: readonly string[];
      };
      /**
       * ENBL-10 / ENBL-12: seed the record's optional `hookEntries` key. Three
       * distinguishable fixtures: omitted (a legacy record predating the key,
       * which sends the read to the materialized file), an empty array (a
       * completed answer of zero entries), and a populated array.
       */
      hookEntries?: readonly { event: string; matcher?: string }[];
    }
  >;
  /** Plugin source dirs to create under <mpRoot> so resolveStrict probes succeed. */
  readonly installablePluginDirs?: readonly string[];
  /** Per-plugin component dirs to create (relative to plugin root). */
  readonly componentDirs?: Record<string, readonly string[]>;
  /**
   * SPLIT-01: the autoupdate read-path lives in `claude-plugins.json`, not in
   * state, so setting this seeds the config file the info orchestrator merges.
   * Omitted leaves no config entry, which the orchestrator reads as `false`.
   */
  readonly autoupdate?: boolean;
}

/**
 * Seed a path-source marketplace into the given scope's state.json.
 * Writes the marketplace.json + the per-plugin source dirs so
 * `resolveStrict`'s `statKind` probe finds them.
 */
async function seedPathMarketplace(opts: SeedPathMarketplaceOpts): Promise<string> {
  const { scope, scopeRoot, cwd, mpName, manifest } = opts;
  const locations = locationsFor(scope, cwd);
  await mkdir(locations.extensionRoot, { recursive: true });

  const mpRoot = path.join(scopeRoot, "marketplaces", mpName);
  await mkdir(path.join(mpRoot, ".claude-plugin"), { recursive: true });

  const manifestPath = path.join(mpRoot, ".claude-plugin", "marketplace.json");
  await writeFile(manifestPath, JSON.stringify(manifest), "utf8");

  for (const rel of opts.installablePluginDirs ?? []) {
    await mkdir(path.join(mpRoot, rel), { recursive: true });
  }

  for (const [pluginDir, components] of Object.entries(opts.componentDirs ?? {})) {
    for (const c of components) {
      await mkdir(path.join(mpRoot, pluginDir, c), { recursive: true });
    }
  }

  const plugins: Record<string, unknown> = {};
  for (const [name, info] of Object.entries(opts.installed ?? {})) {
    const unsupported = info.unsupported ?? [];
    const override = info.resources;
    plugins[name] = {
      version: info.version,
      resolvedSource: info.resolvedSource ?? "./placeholder",
      ...(info.hookEntries !== undefined && {
        hookEntries: info.hookEntries.map((e) => ({ ...e })),
      }),
      compatibility: {
        installable: unsupported.length === 0,
        notes: [],
        supported: [],
        unsupported: [...unsupported],
      },
      resources: {
        skills: [...(override?.skills ?? [`${name}-skill`])],
        prompts: [...(override?.prompts ?? [])],
        agents: [...(override?.agents ?? [])],
        mcpServers: [...(override?.mcpServers ?? [])],
        hooks: [...(override?.hooks ?? [])],
      },
      enabled: info.disabled !== true,
      installedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
  }

  const stateJsonPath = path.join(locations.extensionRoot, "state.json");
  let existing: { marketplaces: Record<string, unknown> } = { marketplaces: {} };
  try {
    const raw = await readFile(stateJsonPath, "utf8");
    existing = JSON.parse(raw) as { marketplaces: Record<string, unknown> };
  } catch {
    /* first marketplace in scope */
  }

  await saveState(locations.extensionRoot, {
    schemaVersion: 2,
    marketplaces: {
      ...existing.marketplaces,
      [mpName]: {
        name: mpName,
        scope,
        source: pathSource(`./${mpName}-src`),
        addedFromCwd: cwd,
        manifestPath,
        marketplaceRoot: mpRoot,
        plugins,
      },
    },
  } as unknown as Parameters<typeof saveState>[1]);

  // SPLIT-01: the info orchestrator reads autoupdate from the merged config, so
  // seed `claude-plugins.json` when the fixture asks for it.
  if (opts.autoupdate !== undefined) {
    await saveConfig(
      locations.configJsonPath,
      {
        schemaVersion: 1,
        marketplaces: { [mpName]: { source: `./${mpName}-src`, autoupdate: opts.autoupdate } },
      },
      locations.scopeRoot,
    );
  }

  return mpRoot;
}

/**
 * Write a materialized hooks configuration at the path the hooks bridge owns
 * (`<hooksDir>/<slug>/hooks.json`), which is the file the state-only info arm
 * reads back. `raw` is written verbatim so a malformed payload can be seeded.
 * Returns the file path so a test can mutate its mode afterwards.
 */
async function seedMaterializedHooks(
  scope: "user" | "project",
  cwd: string,
  slug: string,
  raw: string,
): Promise<string> {
  const locations = locationsFor(scope, cwd);
  const file = path.join(locations.hooksDir, slug, "hooks.json");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, raw, "utf8");
  return file;
}

// ---------------------------------------------------------------------------
// INFO-09: a fully supported record the loaded manifest no longer declares is
// INSTALLED, not failed. The version comes from the installation record
// because no manifest entry exists to supply one.
// ---------------------------------------------------------------------------

test("INFO-09: a manifest-absent enabled record renders `(installed) {not in manifest}` at the recorded version", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0" } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined, "an installed record is not a failure");
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// INFO-10: persisted unsupported kinds keep the record `(partially-installed)`
// on the state-only arm too. `narrowUnsupportedKinds` stays the sole producer
// of the kind tokens; the absence reason is PREPENDED around its output.
// ---------------------------------------------------------------------------

test("INFO-10: a manifest-absent record with persisted unsupported kinds renders `(partially-installed) {not in manifest, lsp}`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", unsupported: ["lspServers"] } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◉ alpha v1.0.0 (partially-installed) {not in manifest, lsp}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// INFO-11 / D-96-01: the four name-list kinds come from `resources.*` and
// render the Pi-GENERATED installed names verbatim -- no reverse-mapping to
// the plugin author's source names. MCP servers are the sole exception by data
// shape: the record holds their raw source keys. Kind order is the renderer's
// fixed `agents, commands, mcp, skills`; within a kind the orchestrator sorts.
// ---------------------------------------------------------------------------

test("INFO-11: the four name-list kinds render from `resources.*`, sorted, with generated names verbatim", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: {
        alpha: {
          version: "1.0.0",
          resources: {
            skills: ["alpha-skill", "Alpha-other"],
            prompts: ["alpha:build"],
            agents: ["pi-claude-marketplace-alpha-review"],
            mcpServers: ["zeta-srv", "alpha-srv"],
          },
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest}",
        "    agents: pi-claude-marketplace-alpha-review",
        "    commands: alpha:build",
        "    mcp: alpha-srv, zeta-srv",
        "    skills: Alpha-other, alpha-skill",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// INFO-11 empty edge: all five resources arrays empty on an ENABLED record.
// The components are known and known to be NONE, so the row renders alone --
// no per-kind lines and no `components: not resolved` marker (that marker
// means "we did not look", which would be a lie here).
// ---------------------------------------------------------------------------

test("INFO-11: a manifest-absent record with all-empty resources renders the bare row, no `components: not resolved`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: {
        alpha: {
          version: "1.0.0",
          resources: { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] },
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      ["● mp [user] <no autoupdate>", "  ● alpha v1.0.0 (installed) {not in manifest}"].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// INFO-11 hooks kind: the installation record holds only the hooks container
// slug, so the entries are reconstructed from the MATERIALIZED configuration
// the install ledger wrote at `<hooksDir>/<slug>/hooks.json` (D-57-03). The
// block lands between the `commands` and `mcp` lines, which is the renderer's
// fixed kind order.
// ---------------------------------------------------------------------------

test("INFO-11: a recorded hooks slug renders the materialized config's entries as a `hooks:` block", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", resources: { hooks: ["alpha"] } } },
    });
    await seedMaterializedHooks(
      "user",
      cwd,
      "alpha",
      JSON.stringify({
        Stop: [{ hooks: [{ type: "command", command: "echo hi" }] }],
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo b" }] }],
      }),
    );

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest}",
        "    hooks:",
        "      Stop",
        "      PreToolUse(Bash)",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// INFO-11 ordering: hook entries keep the materialized file's DECLARATION
// order. Seeding the same two events in the reverse order must swap the two
// rendered lines -- the four name-list kinds are sorted, the hooks kind is not.
// ---------------------------------------------------------------------------

test("INFO-11: hook entries follow the materialized file's declaration order, never a sort", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", resources: { hooks: ["alpha"] } } },
    });
    await seedMaterializedHooks(
      "user",
      cwd,
      "alpha",
      JSON.stringify({
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo b" }] }],
        Stop: [{ hooks: [{ type: "command", command: "echo hi" }] }],
      }),
    );

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    assert.equal(notifications.length, 1);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest}",
        "    hooks:",
        "      PreToolUse(Bash)",
        "      Stop",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// D-100-03 / ENBL-12 read ladder: the record wins when it carries `hookEntries`,
// the materialized file answers when it does not, and a present-but-empty key
// is a completed answer of zero entries rather than a fall-through.
//
// Every case below seeds a materialized configuration whose entries DIFFER
// from the record's, so "the record won" and "the file won" produce different
// bytes. A test that seeded the same entries on both sides would pass whichever
// source the code actually read.
// ---------------------------------------------------------------------------

test("D-100-03 / ENBL-12: a record carrying hookEntries renders them, not the materialized file's", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: {
        alpha: {
          version: "1.0.0",
          resources: { hooks: ["alpha"] },
          hookEntries: [{ event: "SessionStart" }, { event: "PostToolUse", matcher: "Read" }],
        },
      },
    });
    // Deliberately DIFFERENT from the record: these two lines are what the
    // rendered block must NOT contain.
    await seedMaterializedHooks(
      "user",
      cwd,
      "alpha",
      JSON.stringify({
        Stop: [{ hooks: [{ type: "command", command: "echo hi" }] }],
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo b" }] }],
      }),
    );

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest}",
        "    hooks:",
        "      SessionStart",
        "      PostToolUse(Read)",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

test("D-100-03 / ENBL-12: a legacy record with no hookEntries key still reports its hooks from the materialized file", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      // No `hookEntries`: the shape every record written before the key
      // existed has. The fallback is what keeps these records reporting
      // truthfully until the next install, update, reinstall or enable.
      installed: { alpha: { version: "1.0.0", resources: { hooks: ["alpha"] } } },
    });
    await seedMaterializedHooks(
      "user",
      cwd,
      "alpha",
      JSON.stringify({
        Stop: [{ hooks: [{ type: "command", command: "echo hi" }] }],
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo b" }] }],
      }),
    );

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest}",
        "    hooks:",
        "      Stop",
        "      PreToolUse(Bash)",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

test("D-100-03 / ENBL-12: a present-but-empty hookEntries renders no `hooks:` line and no reason", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: {
        alpha: { version: "1.0.0", resources: { hooks: ["alpha"] }, hookEntries: [] },
      },
    });
    // A readable file with real entries: if the empty key fell through to the
    // file, these two lines would appear.
    await seedMaterializedHooks(
      "user",
      cwd,
      "alpha",
      JSON.stringify({
        Stop: [{ hooks: [{ type: "command", command: "echo hi" }] }],
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo b" }] }],
      }),
    );

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// D-96-03 true negative: a record with NO recorded hooks omits the `hooks:`
// line and stamps NO reason. Nothing is read, so there is nothing to degrade.
// ---------------------------------------------------------------------------

test("D-96-03: a record with no recorded hooks omits the `hooks:` line with no added reason", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", resources: { hooks: [] } } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// INFO-11 empty edge / D-96-03: a materialized file that parses to an EMPTY
// event map is a successful read of nothing. Zero entries means no header line
// and, because nothing failed, no reason either -- byte-identical to the
// INFO-09 row.
// ---------------------------------------------------------------------------

test("INFO-11: a materialized hooks config that parses to an empty map renders no `hooks:` line and no reason", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", resources: { hooks: ["alpha"] } } },
    });
    await seedMaterializedHooks("user", cwd, "alpha", "{}");

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// D-96-03 degradation matrix. Every case below records hook slugs the arm
// cannot list. The contract is the same each time: the `hooks:` line is
// OMITTED and the row carries a read reason LAST in the brace, so the operator
// can tell "this plugin has no hooks" from "this plugin has hooks I could not
// read". The rest of the block always renders -- no read failure takes the
// plugin's remaining truth off the screen.
//
// The reasons are the `narrowProbeError` ladder's own output, not a
// hooks-specific vocabulary. They are attributable to hooks because the
// materialized hooks configuration is the ONLY file this arm opens.
// ---------------------------------------------------------------------------

test("D-96-03: a recorded hooks slug with no materialized file omits the block and reports `source missing`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", resources: { hooks: ["alpha"] } } },
    });
    // Deliberately no `seedMaterializedHooks` call: the record names a slug
    // whose file the install ledger wrote and something later removed.

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest, source missing}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// Both structural parse arms collapse to the same token: `parseHooksConfig`
// returns `{ok:false}` for malformed JSON and for a schema-invalid payload
// alike, and the reader maps that single verdict to `unparseable`. One case
// therefore covers the whole arm.
test("D-96-03: a malformed materialized hooks config omits the block and reports `unparseable`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", resources: { hooks: ["alpha"] } } },
    });
    await seedMaterializedHooks("user", cwd, "alpha", "{ not json");

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest, unparseable}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// NFR-10: the slug is state-supplied data used as a path component, so
// `assertPathInside` refuses a traversal slug BEFORE any `readFile`. No file
// outside `hooksDir` is opened even if one exists at the composed path. The
// containment error carries no errno, so it classifies as `unreadable`, and
// the four name-list kinds still render in full.
test("NFR-10: a traversal hooks slug is refused before any read and the block still renders", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: {
        alpha: {
          version: "1.0.0",
          resources: {
            skills: ["alpha-skill"],
            prompts: ["alpha:build"],
            agents: ["pi-claude-marketplace-alpha-review"],
            mcpServers: ["alpha-srv"],
            hooks: ["../../etc"],
          },
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest, unreadable}",
        "    agents: pi-claude-marketplace-alpha-review",
        "    commands: alpha:build",
        "    mcp: alpha-srv",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// NFR-10 observability: `{unreadable}` is a cosmetic degradation marker shared
// with transient disk failures, so a REFUSED traversal slug must also be named
// in the debug log -- otherwise a tampering attempt is indistinguishable from an
// EIO in both the UI and the log. Mirrors the hooks hydrate read site, which
// logs its containment violation before returning.
test("NFR-10: a refused traversal hooks slug is named in the debug log, not just folded to `{unreadable}`", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", resources: { hooks: ["../../etc"] } } },
    });

    const originalDebug = process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
    const originalError = console.error;
    const logged: string[] = [];
    process.env.PI_CLAUDE_MARKETPLACE_DEBUG = "1";
    console.error = (...args: unknown[]): void => {
      logged.push(args.map((a) => String(a)).join(" "));
    };

    try {
      const { ctx, pi, notifications } = makeCtx();
      await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

      // The rendered outcome is unchanged -- the token stays the closed-set
      // `{unreadable}` the catalog pins.
      assert.equal(
        notifications[0]!.message,
        [
          "● mp [user] <no autoupdate>",
          "  ● alpha v1.0.0 (installed) {not in manifest, unreadable}",
          "    skills: alpha-skill",
        ].join("\n"),
      );
    } finally {
      console.error = originalError;
      if (originalDebug === undefined) {
        delete process.env.PI_CLAUDE_MARKETPLACE_DEBUG;
      } else {
        process.env.PI_CLAUDE_MARKETPLACE_DEBUG = originalDebug;
      }
    }

    const violation = logged.find((l) => l.includes("containment violation"));
    assert.ok(
      violation !== undefined,
      `expected a containment-violation debug line, got: ${JSON.stringify(logged)}`,
    );
    assert.ok(violation.startsWith("[hooks] info: containment violation"), violation);
    assert.ok(violation.includes('"../../etc"'), violation);
  });
});

test("D-96-03: an unreadable materialized hooks config reports `permission denied` (POSIX-only)", async (t) => {
  if (process.platform === "win32") {
    t.skip("POSIX-only chmod 0 unreadable file path");
    return;
  }

  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("running as root -- chmod 0 does not block read");
    return;
  }

  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", resources: { hooks: ["alpha"] } } },
    });
    const file = await seedMaterializedHooks(
      "user",
      cwd,
      "alpha",
      JSON.stringify({ Stop: [{ hooks: [{ type: "command", command: "echo hi" }] }] }),
    );
    await chmod(file, 0o000);

    try {
      const { ctx, pi, notifications } = makeCtx();
      await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

      assert.equal(notifications.length, 1);
      assert.equal(notifications[0]!.severity, undefined);
      assert.equal(
        notifications[0]!.message,
        [
          "● mp [user] <no autoupdate>",
          "  ● alpha v1.0.0 (installed) {not in manifest, permission denied}",
          "    skills: alpha-skill",
        ].join("\n"),
      );
    } finally {
      // Restore the mode so the hermetic-HOME teardown can remove the tree.
      await chmod(file, 0o644);
    }
  });
});

// INFO-10 / D-96-03 composition: absence FIRST, the unsupported-kind tokens
// NEXT, the read marker LAST. Three reasons in one brace prove the order rule
// holds when both reason families are present.
test("INFO-10 / D-96-03: a partial record with an unreadable hooks config orders the three reasons absence, kind, read", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: {
        alpha: {
          version: "1.0.0",
          unsupported: ["lspServers"],
          resources: { hooks: ["alpha"] },
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◉ alpha v1.0.0 (partially-installed) {not in manifest, lsp, source missing}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// Control: the manifest DECLARES the plugin, so the manifest-backed arm runs
// unchanged -- no `{not in manifest}` brace, and components enumerate from
// disk as the author's SOURCE names. Proves the arm split did not leak the
// absence reason onto the declared path, and shows the D-96-01 divergence
// side by side (source `alpha-src-skill` here vs generated `alpha-skill` on
// the state-only rows above).
// ---------------------------------------------------------------------------

test("INFO-09 boundary: a DECLARED plugin keeps the manifest-backed row with no `{not in manifest}` brace", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "alpha", source: "./alpha", version: "1.0.0", skills: "skills" }],
      },
      installed: { alpha: { version: "1.0.0" } },
      installablePluginDirs: ["alpha"],
      componentDirs: { alpha: ["skills/alpha-src-skill"] },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed)",
        "    skills: alpha-src-skill",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// D-100-08 / ENBL-17: a manifest-absent DISABLED record goes through the SAME
// `buildBlock` every other installed record does, so it reports the component
// inventory the disable retained (ENBL-18) instead of a bare row. The
// `(disabled)` token survives the reroute because the disabled status is
// injected ahead of the persisted-status derivation, which knows only
// `installed` / `partially-installed`; and `{not in manifest}` stays on the
// inventory row per D-100-07 -- it names what blocks the user's next action.
// ---------------------------------------------------------------------------

test("D-100-08 / ENBL-17: a manifest-absent DISABLED record renders `(disabled) {not in manifest}` with its retained inventory", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", disabled: true } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined, "a disabled record is not a failure");
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◍ alpha v1.0.0 (disabled) {not in manifest}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// The disabled-PARTIAL half, which pins BOTH halves of the disabled row shape
// on one record. The STATUS: without the injection this record derives
// `(partially-installed)`, which would tell the user a deregistered plugin is
// running. The REASON BRACE: the record carries a persisted unsupported kind,
// and the row hides it (ENBL-16 / D-100-07). A dropped component kind describes
// runtime behavior that the disable suspended, so it waits for the plugin to be
// re-enabled; manifest absence blocks `enable` itself, so it stays. The same
// record renders the same bytes on the `list` surface.
test("D-100-08 / ENBL-16 / ENBL-17: a manifest-absent DISABLED PARTIAL keeps `(disabled)` and hides its unsupported-kind token", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      // The factory derives the reachable persisted shape from these two
      // fields alone: `enabled: false` and `installable: false` (unsupported is
      // non-empty). The inventory survives the disable (ENBL-18).
      installed: { alpha: { version: "1.0.0", disabled: true, unsupported: ["lspServers"] } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined, "a disabled record is not a failure");
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◍ alpha v1.0.0 (disabled) {not in manifest}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
    // Row-scoped: the token is absent from the ROW, not merely absent from a
    // brace an equality could also lose by moving the line.
    assert.equal(notifications[0]!.message.split("\n")[1]!.includes("lsp"), false);
  });
});

// ENBL-17 / D-100-03: the population the retained inventory exists for. A
// disabled plugin's materialized hook configuration is DELETED by the disable
// (ENBL-02), so the record is the only thing left that can answer "which hooks
// did this plugin register". The fixture writes no materialized configuration
// at all: the `hooks:` block below can only have come from `hookEntries`, and a
// reader that fell back to the file would render no block instead.
//
// Every other kind is populated too, which is what makes the two negatives
// below say something: a record with agents and mcpServers is exactly the shape
// a soft-dependency marker would attach to (ENBL-15 / D-100-06).
test("ENBL-16 / ENBL-17: a disabled, manifest-absent record lists its recorded hooks and its whole retained inventory", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: {
        alpha: {
          version: "1.0.0",
          disabled: true,
          resources: {
            skills: ["alpha-skill"],
            agents: ["pi-claude-marketplace-alpha-bot"],
            mcpServers: ["alpha-mcp"],
            hooks: ["alpha"],
          },
          hookEntries: [{ event: "SessionStart" }, { event: "PostToolUse", matcher: "Read" }],
        },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined, "a disabled record is not a failure");
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◍ alpha v1.0.0 (disabled) {not in manifest}",
        "    agents: pi-claude-marketplace-alpha-bot",
        "    hooks:",
        "      SessionStart",
        "      PostToolUse(Read)",
        "    mcp: alpha-mcp",
        "    skills: alpha-skill",
      ].join("\n"),
    );

    // Row-scoped negatives. An equality failure reports a diff; these name the
    // regression. The row is line 1 -- the component lines below it legitimately
    // contain neither token, so scoping to the row is what makes them tight.
    const row = notifications[0]!.message.split("\n")[1]!;
    assert.equal(row.includes("lsp"), false, row);
    assert.equal(row.includes("requires"), false, row);
  });
});

// ENBL-16 / D-100-07 / D-96-03: the failure class SURVIVES the disabled row's
// reason narrowing. The suppression rule is "hide the runtime the disable
// suspended", and a container the command could not read is not that: it is a
// fact about disk, and the enabled twin of this fixture
// (`state-only-installed-hooks-degraded`) reports it. The record names a hooks
// container, carries no `hookEntries`, and no materialized configuration exists
// -- so the read fails and the row must say so. Without the reason the row
// renders bare, and silence there reads as verified absence of hooks, which is
// exactly the conflation the discriminated read result exists to prevent.
test("ENBL-16 / D-96-03: a DISABLED record whose recorded hooks container cannot be listed keeps the read reason", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: {
        alpha: { version: "1.0.0", disabled: true, resources: { hooks: ["alpha"] } },
      },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined, "a disabled record is not a failure");
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◍ alpha v1.0.0 (disabled) {not in manifest, source missing}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// The still-declared control for the disabled arm, the twin of the INFO-09
// boundary above. The manifest DECLARES this disabled plugin, so the row
// resolves from the manifest and carries no absence brace. This is what proves
// `{not in manifest}` is derived from the manifest lookup rather than from
// disabled-ness -- without it, a stamp hard-coded on the disabled arm would
// pass every other test in this file.
test("ENBL-16 / ENBL-17: a DECLARED disabled record renders `(disabled)` with no reason brace", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "alpha", source: "./alpha", version: "1.0.0", skills: "skills" }],
      },
      installed: { alpha: { version: "1.0.0", disabled: true } },
      installablePluginDirs: ["alpha"],
      componentDirs: { alpha: ["skills/alpha-src-skill"] },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    assert.equal(notifications.length, 1);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◍ alpha v1.0.0 (disabled)",
        "    skills: alpha-src-skill",
      ].join("\n"),
    );
    const row = notifications[0]!.message.split("\n")[1]!;
    assert.ok(row.includes("(disabled)"), row);
    assert.equal(row.includes("not in manifest"), false, row);
  });
});

// D-96-04 / ENBL-17: the skip note survives the reroute. This scope carries
// BOTH skip causes -- disabled AND manifest-absent -- and emits exactly ONE
// skip row, because the cause is a single producer-reported field on the block
// rather than two per-cause lists that could concatenate. The reason names the
// proximate cause: a disabled record has no materialized artifacts to refresh
// (ENBL-02) whatever the manifest says, while the inventory row above it keeps
// `{not in manifest}` because that is what constrains the user next.
test("D-96-04 / ENBL-17: `info --fetch` on a disabled AND manifest-absent scope emits ONE skip row, reporting the disabled cause", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", disabled: true } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
    });

    assert.equal(notifications.length, 2);
    assert.equal(notifications[0]!.severity, undefined, "the inventory block keeps info severity");
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◍ alpha v1.0.0 (disabled) {not in manifest}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
    assert.equal(notifications[1]!.severity, "warning");
    assert.equal(
      notifications[1]!.message,
      [
        "A plugin operation needs attention.",
        "",
        "● mp [user]",
        "  ⊘ alpha v1.0.0 (skipped) {already disabled}",
      ].join("\n"),
    );
    // ONE row, not one per cause: a `(skipped)` row for the manifest-absence
    // cause beside the disabled one would be the concatenation regression the
    // single `skipReason` field exists to make unrepresentable.
    assert.equal(
      notifications[1]!.message.split("(skipped)").length - 1,
      1,
      notifications[1]!.message,
    );
  });
});

// ENBL-06 / ENBL-17: the same `--fetch` accounting for the PARTIAL disabled
// shape. Before the disabled-state axes were separated, this record missed the
// disabled classification and its skip row named the manifest-absence cause.
// The cause is the disabled record, not the missing manifest entry, and the
// reason token has to say so.
test("ENBL-06 / D-96-04: `info --fetch` on a DISABLED PARTIAL skips for the disabled cause, not the manifest-absence cause", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", disabled: true, unsupported: ["lspServers"] } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
    });

    assert.equal(notifications.length, 2);
    assert.equal(notifications[0]!.severity, undefined, "the inventory block keeps info severity");
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◍ alpha v1.0.0 (disabled) {not in manifest}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
    assert.equal(notifications[1]!.severity, "warning");
    assert.equal(
      notifications[1]!.message,
      [
        "A plugin operation needs attention.",
        "",
        "● mp [user]",
        "  ⊘ alpha v1.0.0 (skipped) {already disabled}",
      ].join("\n"),
    );
    // The specific regression: the state-only arm's reason token on a record
    // that never belongs there. The SKIP note names the disabled cause; the
    // inventory row above is where manifest absence is reported.
    assert.equal(
      notifications[1]!.message.includes("not in manifest"),
      false,
      notifications[1]!.message,
    );
  });
});

test("D-96-04: bare `info` on an all-disabled marketplace emits NO skip note", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", disabled: true } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    assert.equal(notifications.length, 1, "no flag was typed, so there is nothing to account for");
    assert.ok(!notifications[0]!.message.includes("(skipped)"), notifications[0]!.message);
  });
});

// MSG-GR-3: a mixed run skips for two different reasons in two different
// scopes. Both rows ride ONE notification, ordered project-first by SCOPE --
// not grouped by which arm produced them.
test("D-96-04: a mixed disabled + state-only `--fetch` run orders both skip rows project-first", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const projectRoot = path.join(cwd, ".pi");
    await seedPathMarketplace({
      scope: "project",
      scopeRoot: projectRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", disabled: true } },
    });
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "2.0.0" } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", cwd, fetch: true });

    // The whole sequence is pinned by index, not searched: a `find()` would
    // survive a duplicated skip notification, a lost info block, and any
    // reordering -- including the WR-10 inventory/note inversion this order
    // encodes.
    //
    // D-100-08 / ENBL-17: TWO notifications, not three. The disabled scope is no
    // longer a foreign message kind, so both scopes ride ONE info cascade
    // instead of forcing a second notify for the mixed result.
    assert.equal(notifications.length, 2, JSON.stringify(notifications));

    // 0: both scopes' info blocks in one cascade, project-first (MSG-GR-3). The
    // disabled scope reports its retained inventory beside the enabled one.
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [project] <no autoupdate>",
        "  ◍ alpha v1.0.0 (disabled) {not in manifest}",
        "    skills: alpha-skill",
        "",
        "● mp [user] <no autoupdate>",
        "  ● alpha v2.0.0 (installed) {not in manifest}",
        "    skills: alpha-skill",
      ].join("\n"),
    );

    // 1: ONE skip notification carrying both rows, project-first, each naming
    // its own cause. WR-10: the note follows the inventory it annotates.
    assert.equal(notifications[1]!.severity, "warning");
    assert.equal(
      notifications[1]!.message,
      [
        "Some plugin operations need attention.",
        "",
        "● mp [project]",
        "  ⊘ alpha v1.0.0 (skipped) {already disabled}",
        "",
        // Both headers are the list-arm form, which omits the marker when
        // autoupdate is off -- see the `state-only-fetch-skipped` catalog state.
        "● mp [user]",
        "  ⊘ alpha v2.0.0 (skipped) {not in manifest}",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// INFO-12 / NFR-5: the state-only arm reaches no network surface.
//
// Before the arm split this held for free -- a manifest-absent name returned
// its `(failed)` row before any fetch-capable builder existed. The arm now sits
// DOWNSTREAM of `buildInfoFetchContext`, so "we do not call the network here"
// is a claim that needs an assertion which can fail. The counters below are
// call counts on injected doubles, never a reading of the control flow: break
// the guard by threading a `fetchCtx` into `buildStateOnlyInstalledRow` and
// probing, and these tests go red.
//
// The clone-cache seam and the credential ops are the ONLY two routes from this
// file to a network call or a credential read, so pinning all five counters at
// zero covers the whole boundary.
// ---------------------------------------------------------------------------

/** The real clone-cache seam over a mock gitOps (copied from `info.test.ts`). */
function fetchSeamWith(gitOps: GitOps): InfoCloneCacheSeam {
  return {
    resolvePluginPin: (args) => resolvePluginPin({ ...args, gitOps }),
    materializePluginClone: (args) => materializePluginClone({ ...args, gitOps }),
    materializeOrRefreshPluginMirror: (args) =>
      materializeOrRefreshPluginMirror({ ...args, gitOps }),
  };
}

/** The byte-exact single-scope state-only block, shared by the INFO-12 cases. */
const STATE_ONLY_BLOCK = [
  "● mp [user] <no autoupdate>",
  "  ● alpha v1.0.0 (installed) {not in manifest}",
  "    skills: alpha-skill",
].join("\n");

test("INFO-12 / NFR-5: `info --fetch` on a manifest-absent record makes ZERO clone-seam and ZERO credential-seam calls", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0" } },
    });

    const { gitOps, state: gitState } = makeMockGitOps({});
    const { credOps: credentialOps, state: credState } = makeMockCredentialOps();
    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
      cloneCacheSeam: fetchSeamWith(gitOps),
      credentialOps,
    });

    assert.equal(gitState.cloneCalls.length, 0, "INFO-12: the state-only arm must not clone");
    assert.equal(gitState.fetchCalls.length, 0, "INFO-12: the state-only arm must not fetch");
    assert.equal(
      credState.fillCalls.length,
      0,
      "INFO-12: the state-only arm must not read a credential",
    );
    assert.equal(
      credState.approveCalls.length,
      0,
      "INFO-12: the state-only arm must not store a credential",
    );
    assert.equal(
      credState.rejectCalls.length,
      0,
      "INFO-12: the state-only arm must not erase a credential",
    );

    // The row itself is byte-identical to the bare INFO-09 render: `--fetch`
    // changes nothing about what the arm can say.
    assert.equal(notifications[0]!.message, STATE_ONLY_BLOCK);
  });
});

test("INFO-12 / NFR-5: bare `info` on a manifest-absent record makes the same ZERO seam calls", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0" } },
    });

    // The seams are supplied but `fetch` is omitted: nothing may run.
    const { gitOps, state: gitState } = makeMockGitOps({});
    const { credOps: credentialOps, state: credState } = makeMockCredentialOps();
    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      cloneCacheSeam: fetchSeamWith(gitOps),
      credentialOps,
    });

    assert.equal(gitState.cloneCalls.length, 0, "INFO-12: bare info must not clone");
    assert.equal(gitState.fetchCalls.length, 0, "INFO-12: bare info must not fetch");
    assert.equal(credState.fillCalls.length, 0, "INFO-12: bare info must not read a credential");
    assert.equal(
      credState.approveCalls.length,
      0,
      "INFO-12: bare info must not store a credential",
    );
    assert.equal(credState.rejectCalls.length, 0, "INFO-12: bare info must not erase a credential");
    assert.equal(notifications[0]!.message, STATE_ONLY_BLOCK);
  });
});

test("INFO-12 / NFR-5: a git-source-shaped manifest-absent record under `--fetch` still makes ZERO seam calls", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    // A remote `resolvedSource` is the shape that WOULD drive a probe on the
    // manifest-backed arm. The state-only arm never consults the source kind,
    // so the counters stay at zero for exactly the same reason as above.
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", resolvedSource: "https://example.com/repo" } },
    });

    const { gitOps, state: gitState } = makeMockGitOps({});
    const { credOps: credentialOps, state: credState } = makeMockCredentialOps();
    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
      cloneCacheSeam: fetchSeamWith(gitOps),
      credentialOps,
    });

    assert.equal(gitState.cloneCalls.length, 0, "INFO-12: a remote-shaped record must not clone");
    assert.equal(gitState.fetchCalls.length, 0, "INFO-12: a remote-shaped record must not fetch");
    assert.equal(
      credState.fillCalls.length,
      0,
      "INFO-12: a remote-shaped record must not read a credential",
    );
    assert.equal(
      credState.approveCalls.length,
      0,
      "INFO-12: a remote-shaped record must not store a credential",
    );
    assert.equal(
      credState.rejectCalls.length,
      0,
      "INFO-12: a remote-shaped record must not erase a credential",
    );
    assert.equal(notifications[0]!.message, STATE_ONLY_BLOCK);
  });
});

// ENBL-17 / NFR-5: the same zero-call boundary for the REROUTED disabled arm.
// The enabled cases above cannot cover it: a disabled record used to return
// before any fetch-capable builder ran, and it now travels the same path an
// enabled one does. So "no network here" stopped being a property of the
// control flow and became a claim needing an assertion that can fail. The
// record is remote-SHAPED and the run carries `--fetch`, which is the input
// that would drive a probe on the manifest-backed arm.
test("ENBL-17 / NFR-5: a DISABLED manifest-absent record under `--fetch` makes ZERO seam calls", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: {
        alpha: {
          version: "1.0.0",
          disabled: true,
          resolvedSource: "https://example.com/repo",
          resources: { skills: ["alpha-skill"], hooks: ["alpha"] },
          hookEntries: [{ event: "SessionStart" }],
        },
      },
    });

    const { gitOps, state: gitState } = makeMockGitOps({});
    const { credOps: credentialOps, state: credState } = makeMockCredentialOps();
    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
      cloneCacheSeam: fetchSeamWith(gitOps),
      credentialOps,
    });

    assert.equal(gitState.cloneCalls.length, 0, "ENBL-17: the disabled arm must not clone");
    assert.equal(gitState.fetchCalls.length, 0, "ENBL-17: the disabled arm must not fetch");
    assert.equal(
      credState.fillCalls.length,
      0,
      "ENBL-17: the disabled arm must not read a credential",
    );
    assert.equal(
      credState.approveCalls.length,
      0,
      "ENBL-17: the disabled arm must not store a credential",
    );
    assert.equal(
      credState.rejectCalls.length,
      0,
      "ENBL-17: the disabled arm must not erase a credential",
    );

    // Zero calls AND the full inventory: a guard that reached zero by returning
    // an empty block would satisfy the counters alone.
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◍ alpha v1.0.0 (disabled) {not in manifest}",
        "    hooks:",
        "      SessionStart",
        "    skills: alpha-skill",
      ].join("\n"),
    );
  });
});

// ENBL-17 / NFR-5: the zero-call boundary for the disabled record the manifest
// STILL DECLARES. Every other disabled `--fetch` case in this file seeds an
// EMPTY `plugins` array, which routes the block to the state-only arm -- an arm
// whose signature cannot express a fetch. A declared record travels the
// manifest-backed arm instead, where the fetch context IS threaded, so the
// decline is a branch rather than a signature and needs an assertion that can
// fail. The record is git-sourced with no clone on disk, which is the input the
// enabled twin of this fixture fetches for real.
//
// The claim under test is the one the `already disabled` skip note makes: the
// note says the fetch did nothing, so nothing may be fetched. A run that clones
// and then reports a skipped fetch contradicts the note, `InfoBlock.skipReason`
// and the `disabled-fetch-skipped` catalog state at once.
test("ENBL-17 / NFR-5: `info --fetch` on a DISABLED record the manifest still DECLARES makes ZERO seam calls", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "alpha", source: "https://example.com/alpha.git", version: "1.0.0" }],
      },
      installed: { alpha: { version: "1.0.0", disabled: true } },
    });

    const { gitOps, state: gitState } = makeMockGitOps({});
    const { credOps: credentialOps, state: credState } = makeMockCredentialOps();
    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
      cloneCacheSeam: fetchSeamWith(gitOps),
      credentialOps,
    });

    assert.equal(
      gitState.cloneCalls.length,
      0,
      "ENBL-17: a disabled declared record must not clone",
    );
    assert.equal(
      gitState.fetchCalls.length,
      0,
      "ENBL-17: a disabled declared record must not fetch",
    );
    assert.equal(
      credState.fillCalls.length,
      0,
      "ENBL-17: a disabled declared record must not read a credential",
    );
    assert.equal(
      credState.approveCalls.length,
      0,
      "ENBL-17: a disabled declared record must not store a credential",
    );
    assert.equal(
      credState.rejectCalls.length,
      0,
      "ENBL-17: a disabled declared record must not erase a credential",
    );

    // The rendered pair, so a guard that reached zero by dropping the block
    // would not pass. The row carries no absence brace (the manifest declares
    // it) and no components (the clone is cold and nothing fetched it warm).
    assert.equal(notifications.length, 2);
    assert.equal(notifications[0]!.severity, undefined, "a disabled record is not a failure");
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ◍ alpha v1.0.0 (disabled)",
        "    components: not resolved",
      ].join("\n"),
    );
    assert.equal(notifications[1]!.severity, "warning");
    assert.equal(
      notifications[1]!.message,
      [
        "A plugin operation needs attention.",
        "",
        "● mp [user]",
        "  ⊘ alpha v1.0.0 (skipped) {already disabled}",
      ].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// D-96-04: a `--fetch` the state-only arm cannot carry out is REPORTED, never
// swallowed. Rendering identical bytes with and without the flag would teach
// the user the flag worked, so the request is accounted for as a separate
// `warning` note beside an info block that keeps its own bytes.
//
// The note is a cascade row because the standalone `PluginInfoRow` status set
// admits no `skipped`; the IL-2 break mirrors the disabled-inventory path in
// the same function.
// ---------------------------------------------------------------------------

/** The byte-exact single-scope skip note, shared by the D-96-04 cases. */
const SKIP_NOTE = [
  "A plugin operation needs attention.",
  "",
  "● mp [user]",
  "  ⊘ alpha v1.0.0 (skipped) {not in manifest}",
].join("\n");

test("D-96-04: `info --fetch` on a manifest-absent record emits the skip note beside an unchanged info block", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0" } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
    });

    assert.equal(notifications.length, 2);
    assert.equal(notifications[0]!.severity, undefined, "the info block keeps info severity");
    assert.equal(notifications[0]!.message, STATE_ONLY_BLOCK);
    assert.equal(notifications[1]!.severity, "warning");
    assert.equal(notifications[1]!.message, SKIP_NOTE);
  });
});

// Header agreement across the two arms in ONE run. The skip note rides the
// LIST-arm marketplace header, which shows `<autoupdate>` only when the flag is
// on; the standalone info header always spells one of the two markers. The pair
// below pins both halves: with autoupdate ON the two headers match byte for
// byte, and with autoupdate OFF (the case every other test in this file seeds)
// the note's header is bare while the info block reads `<no autoupdate>`. The
// marker therefore AGREES with the info block -- it is present in exactly the
// runs the info block reports autoupdate as on -- and the off-case difference is
// recorded in the catalog's `state-only-fetch-skipped` prose.
test("D-96-04: with autoupdate ON the skip-note header matches the info block header", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0" } },
      autoupdate: true,
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
    });

    assert.equal(notifications.length, 2);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
    assert.equal(notifications[1]!.severity, "warning");
    assert.equal(
      notifications[1]!.message,
      [
        "A plugin operation needs attention.",
        "",
        "● mp [user] <autoupdate>",
        "  ⊘ alpha v1.0.0 (skipped) {not in manifest}",
      ].join("\n"),
    );
  });
});

test("D-96-04: with autoupdate OFF the skip-note header omits the marker the info block spells", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0" } },
      autoupdate: false,
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
    });

    assert.equal(notifications.length, 2);
    assert.ok(
      notifications[0]!.message.startsWith("● mp [user] <no autoupdate>\n"),
      notifications[0]!.message,
    );
    assert.equal(notifications[1]!.message, SKIP_NOTE);
  });
});

test("D-96-04: bare `info` on the same record emits NO skip note", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0" } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", scope: "user", cwd });

    assert.equal(notifications.length, 1, "no flag was typed, so there is nothing to account for");
    assert.equal(notifications[0]!.message, STATE_ONLY_BLOCK);
  });
});

test("D-96-04: `info --fetch` on a manifest-DECLARED plugin emits NO skip note", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    // The note is keyed on the ARM that fired, not on the flag alone. A
    // declared, enabled plugin runs the manifest-backed arm, which reports NO
    // `skipReason` on its `InfoBlock` -- the field `emitFetchSkip` reads.
    // Nothing about the rendered row is consulted, so the keying cannot drift
    // with the reason tokens the row happens to carry.
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: {
        name: "mp",
        plugins: [{ name: "alpha", source: "./alpha", version: "1.0.0", skills: "skills" }],
      },
      installed: { alpha: { version: "1.0.0" } },
      installablePluginDirs: ["alpha"],
      componentDirs: { alpha: ["skills/alpha-src-skill"] },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
    });

    for (const n of notifications) {
      assert.ok(!n.message.includes("(skipped)"), n.message);
    }
  });
});

// D-96-04 false-positive control: the BOUND-02 row carries the very same
// `not in manifest` reason, so it is the input that would wrongly acquire a skip
// note if the note were keyed on the rendered reason rather than on the arm that
// produced the block. No installation record exists, so nothing was ever
// fetchable and there is no skipped request to account for.
test("D-96-04: a `--fetch` run on a name in NEITHER manifest nor records emits NO skip note", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
    });

    assert.equal(notifications.length, 1, "the failure block only -- no skip note beside it");
    assert.equal(notifications[0]!.severity, "error");
    assert.ok(
      notifications[0]!.message.includes("(failed) {not in manifest}"),
      notifications[0]!.message,
    );
    assert.ok(!notifications[0]!.message.includes("(skipped)"), notifications[0]!.message);
  });
});

test("D-96-04: a hooks-degraded state-only record under `--fetch` still emits the skip note", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    // A recorded hooks slug with no materialized file: the info row carries the
    // read marker, the skip row does not. The note is keyed on the arm that
    // fired, not on the row being clean.
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0", resources: { hooks: ["alpha"] } } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({
      ctx,
      pi,
      marketplace: "mp",
      plugin: "alpha",
      scope: "user",
      cwd,
      fetch: true,
    });

    assert.equal(notifications.length, 2);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest, source missing}",
        "    skills: alpha-skill",
      ].join("\n"),
    );
    assert.equal(notifications[1]!.severity, "warning");
    assert.equal(notifications[1]!.message, SKIP_NOTE);
  });
});

test("D-96-04: two state-only scopes under `--fetch` produce ONE skip notification carrying both blocks", async () => {
  await withHermeticHome(async ({ home, cwd }) => {
    const userRoot = path.join(home, ".pi", "agent");
    const projectRoot = path.join(cwd, ".pi");
    await seedPathMarketplace({
      scope: "project",
      scopeRoot: projectRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0" } },
    });
    await seedPathMarketplace({
      scope: "user",
      scopeRoot: userRoot,
      cwd,
      mpName: "mp",
      manifest: { name: "mp", plugins: [] },
      installed: { alpha: { version: "1.0.0" } },
    });

    const { ctx, pi, notifications } = makeCtx();
    await getPluginInfo({ ctx, pi, marketplace: "mp", plugin: "alpha", cwd, fetch: true });

    // INFO-09 / GRAM-04 boundary: the same input used to produce TWO `error`
    // notifications, one per `(failed)` block. Both blocks are `(installed)`
    // now, so they join ONE info-severity cascade, project-scope first.
    assert.equal(notifications.length, 2);
    assert.equal(notifications[0]!.severity, undefined);
    assert.equal(
      notifications[0]!.message,
      [
        "● mp [project] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest}",
        "    skills: alpha-skill",
        "",
        "● mp [user] <no autoupdate>",
        "  ● alpha v1.0.0 (installed) {not in manifest}",
        "    skills: alpha-skill",
      ].join("\n"),
    );

    // ONE skip notification carrying one block per scope, same order. Two
    // skipped rows pluralize the summary through the central counter.
    assert.equal(notifications[1]!.severity, "warning");
    assert.equal(
      notifications[1]!.message,
      [
        "Some plugin operations need attention.",
        "",
        "● mp [project]",
        "  ⊘ alpha v1.0.0 (skipped) {not in manifest}",
        "",
        "● mp [user]",
        "  ⊘ alpha v1.0.0 (skipped) {not in manifest}",
      ].join("\n"),
    );
  });
});
