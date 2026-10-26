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
// load and `pending` print for it (`pending.ts::notifyInvalidConfigs`), and a
// set then writes nothing.
//
// The write holds the scope's state lock, as every other config write does.
// A base write runs the MIG-01 first-run migration first: a base config written
// with only `autoapply` would otherwise stop the migration from capturing the
// scope's recorded plugins. A local write reads no state. A held lock or a
// failed write is one failed row named by the target file; a state.json that
// cannot be read is one row named `state.json`.
//
// NFR-5: offline. It names no git surface.

import { mkdir } from "node:fs/promises";

import { loadConfig } from "../../persistence/config-io.ts";
import { effectiveAutoapply, loadAutoapplyFiles } from "../../persistence/config-merge.ts";
import { writeAutoapplyConfig } from "../../persistence/config-write-back.ts";
import { locationsFor } from "../../persistence/locations.ts";
import { migrateFirstRunConfig } from "../../persistence/migrate-config.ts";
import { loadState } from "../../persistence/state-io.ts";
import { errorMessage, StateLockHeldError } from "../../shared/errors.ts";
import { notify, notifyAutoapplyStatus } from "../../shared/notification-dispatch.ts";
import { narrowProbeError } from "../../shared/probe-classifiers.ts";
import { redactAbsolutePaths } from "../../shared/redact-absolute-paths.ts";
import { withExistingScopeLock } from "../../transaction/with-state-guard.ts";

import { notifyInvalidConfigs } from "./pending.ts";

import type { AutoapplyFile } from "../../persistence/config-merge.ts";
import type { ScopedLocations } from "../../persistence/locations.ts";
import type { ExtensionState } from "../../persistence/state-io.ts";
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

/** The closed-set reason of a set that threw: a held lock, or a failed write. */
function writeFailureReason(err: unknown): "lock held" | "unreadable" {
  return err instanceof StateLockHeldError ? "lock held" : "unreadable";
}

/** A failed set as one failed row named by the file that stopped it. */
function notifySetFailure(
  opts: AutoapplySettingOptions,
  subject: { readonly scope: Scope; readonly name: string },
  reason: ReturnType<typeof writeFailureReason> | ReturnType<typeof narrowProbeError>,
  err: unknown,
): void {
  notify(opts.ctx, opts.run, {
    marketplaces: [
      {
        name: subject.name,
        scope: subject.scope,
        plugins: [
          {
            status: "failed",
            severity: "error",
            name: subject.name,
            reasons: [reason],
            cause: new Error(redactAbsolutePaths(errorMessage(err))),
          },
        ],
      },
    ],
  });
}

type WriteOutcome =
  | { readonly kind: "written" }
  | { readonly kind: "invalid"; readonly files: readonly AutoapplyFile[] }
  | { readonly kind: "state-unreadable"; readonly error: unknown };

/**
 * Writes `enabled` into `filePath` under the scope's lock. D-03: when any of
 * the four configs is invalid it writes nothing. A base write runs the MIG-01
 * migration first, which needs the scope's state; a local write reads none.
 */
async function writeUnderLock(
  cwd: string,
  loc: ScopedLocations,
  filePath: string,
  enabled: boolean,
): Promise<WriteOutcome> {
  await mkdir(loc.extensionRoot, { recursive: true });
  return withExistingScopeLock(loc, async (): Promise<WriteOutcome> => {
    const files = await loadFiles(cwd);
    if (effectiveAutoapply(files).status === "invalid") {
      return { kind: "invalid", files };
    }

    if (filePath === loc.baseConfigJsonPath) {
      let state: ExtensionState;
      try {
        state = await loadState(loc.extensionRoot);
      } catch (error) {
        return { kind: "state-unreadable", error };
      }

      // Every config is valid, so the migration writes the base config from
      // the recorded state when it is absent, or leaves it as it is.
      await migrateFirstRunConfig(loc, state);
    }

    const current = await loadConfig(filePath);
    await writeAutoapplyConfig(
      current.status === "valid" ? current.config : {},
      filePath,
      loc.scopeRoot,
      enabled,
    );
    return { kind: "written" };
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

  let outcome: WriteOutcome;
  try {
    outcome = await writeUnderLock(opts.cwd, loc, filePath, opts.enabled);
  } catch (err) {
    notifySetFailure(opts, { scope, name: target.file }, writeFailureReason(err), err);
    return;
  }

  if (outcome.kind === "state-unreadable") {
    const { error } = outcome;
    // `loadState` wraps a JSON parse failure, so its cause carries the class.
    const cause: unknown = Reflect.get(Object(error), "cause") ?? error;
    notifySetFailure(opts, { scope, name: "state.json" }, narrowProbeError(cause), error);
    return;
  }

  const files = outcome.kind === "invalid" ? outcome.files : await loadFiles(opts.cwd);
  const status = statusOrReport(opts, files, (file) => file.filePath === filePath);
  if (status !== undefined) {
    notifyAutoapplyStatus(opts.ctx, opts.run, {
      ...status,
      set: { ...target, value: opts.enabled },
    });
  }
}
