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
//   - D-54-01 / ENBL-04 the disabled carve-out still runs BEFORE the
//     state-only arm
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
   * Installed plugin records. `disabled: true` seeds the ENBL-02
   * empty-resources marker (recorded-but-disabled); the default seeds a
   * populated `resources.skills` -- a production installed record always has
   * >= 1 populated array (the empty-resources + installable:true
   * intersection IS the disabled marker, D-54-01 / ENBL-04).
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
    }
  >;
  /** Plugin source dirs to create under <mpRoot> so resolveStrict probes succeed. */
  readonly installablePluginDirs?: readonly string[];
  /** Per-plugin component dirs to create (relative to plugin root). */
  readonly componentDirs?: Record<string, readonly string[]>;
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
      compatibility: {
        installable: unsupported.length === 0,
        notes: [],
        supported: [],
        unsupported: [...unsupported],
      },
      resources:
        info.disabled === true
          ? { skills: [], prompts: [], agents: [], mcpServers: [], hooks: [] }
          : {
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
// D-54-01 / ENBL-04: the disabled carve-out is partitioned out of the info
// surface BEFORE `buildBlock` runs, so a manifest-absent DISABLED record still
// renders the list-arm `(disabled)` inventory cascade rather than the new
// state-only installed block.
// ---------------------------------------------------------------------------

test("D-54-01: a manifest-absent DISABLED record still renders the `(disabled)` inventory cascade", async () => {
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
    assert.equal(notifications[0]!.severity, undefined, "disabled inventory routes to info");
    assert.equal(
      notifications[0]!.message,
      ["● mp [user]", "  ◍ alpha v1.0.0 (disabled)"].join("\n"),
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
    // declared plugin runs the manifest-backed arm, whose row can never carry
    // `not in manifest` -- which is exactly what `isStateOnlyInfoBlock` reads.
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
