// orchestrators/reconcile/autoapply-setting.ts
//
// AAP-04 / AAP-D2: `/claude:plugin autoapply [on|off] [--scope] [--local]`.
//
// Show lists the own `autoapply` value of each config file the filter keeps
// (all four with no filter: user base, user local, project base, project
// local) and always the effective value with the file that set it
// (`config-merge.ts::effectiveAutoapply`). Set writes the value into one
// config file, user base by default, as `install` and `enable` default, then
// shows that file and the effective value. A set never runs `apply`: the next
// load reads the new value.
//
// D-03: any invalid config fails the command closed with the failed block the
// load and `pending` print for it (`pending.ts::notifyInvalidConfigs`). A set
// refuses to write an invalid target file.
//
// The write holds the scope's state lock, as every other config write does,
// and runs the MIG-01 first-run migration first: a base config written with
// only `autoapply` would otherwise stop the migration from capturing the
// scope's recorded plugins. A lock held by another process, or a failed write,
// becomes one failed row naming the file.
//
// NFR-5: offline. It names no git surface.

import { loadConfig } from "../../persistence/config-io.ts";
import { effectiveAutoapply, loadAutoapplyFiles } from "../../persistence/config-merge.ts";
import { writeAutoapplyConfig } from "../../persistence/config-write-back.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { migrateFirstRunConfig } from "../../persistence/migrate-config.ts";
import { errorMessage, StateLockHeldError } from "../../shared/errors.ts";
import { notify, notifyAutoapplyStatus } from "../../shared/notification-dispatch.ts";
import { narrowProbeError } from "../../shared/probe-classifiers.ts";
import { redactAbsolutePaths } from "../../shared/redact-absolute-paths.ts";
import { withLockedStateTransaction } from "../../transaction/with-state-guard.ts";

import { notifyInvalidConfigs } from "./pending.ts";

import type { ConfigLoadResult } from "../../persistence/config-io.ts";
import type { AutoapplyFile } from "../../persistence/config-merge.ts";
import type { NotificationContext } from "../../platform/pi-api.ts";
import type { NotificationRun } from "../../shared/notification-run.ts";
import type {
  AutoapplyConfigFile,
  AutoapplyFileValue,
  AutoapplyStatusSurface,
} from "../../shared/notification-types.ts";
import type { Scope } from "../../shared/types.ts";

export interface AutoapplySettingOptions {
  readonly ctx: NotificationContext;
  readonly run: NotificationRun;
  readonly cwd: string;
  /** Show: keep only this scope's files. Set: the scope to write (default user). */
  readonly scope?: Scope;
  /** Show: keep only the local layer's files. Set: write the local config. */
  readonly local?: boolean;
}

function configFile(file: AutoapplyFile): AutoapplyConfigFile {
  return {
    scope: file.scope,
    file: file.layer === "local" ? "claude-plugins.local.json" : "claude-plugins.json",
  };
}

function fileValue(file: AutoapplyFile): AutoapplyFileValue {
  const autoapply = file.result.status === "valid" ? file.result.config.autoapply : undefined;
  return { ...configFile(file), ...(autoapply !== undefined && { value: autoapply }) };
}

/**
 * The status of `files` (most specific first), listing those `keep` selects,
 * least specific first. D-03: when a file is invalid it sends the invalid
 * configs as the load does and returns `undefined`.
 */
function statusOrReport(
  opts: AutoapplySettingOptions,
  files: readonly AutoapplyFile[],
  keep: (file: AutoapplyFile) => boolean,
): AutoapplyStatusSurface | undefined {
  const effective = effectiveAutoapply(files);
  if (effective.status === "invalid") {
    notifyInvalidConfigs(
      opts.ctx,
      opts.run,
      files.flatMap((file) =>
        file.result.status === "invalid"
          ? [{ scope: file.scope, filePath: file.filePath, error: file.result.error }]
          : [],
      ),
    );
    return undefined;
  }

  return {
    kind: "autoapply-status",
    enabled: effective.enabled,
    ...(effective.source !== undefined && { source: configFile(effective.source) }),
    files: files
      .filter((file) => keep(file))
      .reverse()
      .map((file) => fileValue(file)),
  };
}

async function loadFiles(cwd: string): Promise<readonly AutoapplyFile[]> {
  return loadAutoapplyFiles(locationsFor("project", cwd), locationsFor("user", cwd));
}

/** AAP-04: shows the effective value and each file the filter keeps. */
export async function showAutoapply(opts: AutoapplySettingOptions): Promise<void> {
  const status = statusOrReport(
    opts,
    await loadFiles(opts.cwd),
    (file) =>
      (opts.scope === undefined || file.scope === opts.scope) &&
      (opts.local !== true || file.layer === "local"),
  );
  if (status !== undefined) {
    notifyAutoapplyStatus(opts.ctx, opts.run, status);
  }
}

/** A failed set as one failed row naming the file it could not write. */
function notifyWriteFailure(
  opts: AutoapplySettingOptions,
  target: AutoapplyConfigFile,
  err: unknown,
): void {
  const reason = err instanceof StateLockHeldError ? "lock held" : narrowProbeError(err);
  notify(opts.ctx, opts.run, {
    marketplaces: [
      {
        name: target.file,
        scope: target.scope,
        plugins: [
          {
            status: "failed",
            severity: "error",
            name: target.file,
            reasons: [reason],
            cause: new Error(redactAbsolutePaths(errorMessage(err))),
          },
        ],
      },
    ],
  });
}

/**
 * Writes `enabled` into `filePath` under the scope's lock. Returns the
 * target's load result when it is invalid and nothing was written.
 */
async function writeUnderLock(
  scope: Scope,
  cwd: string,
  filePath: string,
  enabled: boolean,
): Promise<ConfigLoadResult | undefined> {
  const loc = locationsFor(scope, cwd);
  return withLockedStateTransaction(loc, async (tx) => {
    if (filePath === loc.baseConfigJsonPath) {
      await migrateFirstRunConfig(loc, tx.state);
    }

    const current = await loadConfig(filePath);
    if (current.status === "invalid") {
      return current;
    }

    await writeAutoapplyConfig(
      current.status === "valid" ? current.config : {},
      filePath,
      loc.scopeRoot,
      enabled,
    );
    return undefined;
  });
}

/** AAP-04: writes `enabled` into one config file, then shows that file. */
export async function setAutoapply(
  opts: AutoapplySettingOptions & { readonly enabled: boolean },
): Promise<void> {
  const scope = opts.scope ?? "user";
  const loc = locationsFor(scope, opts.cwd);
  const filePath = opts.local === true ? loc.localConfigJsonPath : loc.baseConfigJsonPath;
  const target: AutoapplyConfigFile = {
    scope,
    file: opts.local === true ? "claude-plugins.local.json" : "claude-plugins.json",
  };

  let refused: ConfigLoadResult | undefined;
  try {
    refused = await writeUnderLock(scope, opts.cwd, filePath, opts.enabled);
  } catch (err) {
    notifyWriteFailure(opts, target, err);
    return;
  }

  if (refused?.status === "invalid") {
    notifyInvalidConfigs(opts.ctx, opts.run, [{ scope, filePath, error: refused.error }]);
    return;
  }

  const status = statusOrReport(
    opts,
    await loadFiles(opts.cwd),
    (file) => file.filePath === filePath,
  );
  if (status !== undefined) {
    notifyAutoapplyStatus(opts.ctx, opts.run, {
      ...status,
      set: { ...target, value: opts.enabled },
    });
  }
}
