import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { errorMessage } from "../../shared/errors.ts";

import type {
  ClaudeSettingsPaths,
  ClaudeSettingsReadOptions,
  ImportDiagnostic,
  MergedClaudeSettings,
  MergedClaudeSettingsResult,
} from "./types.ts";
import type { Scope } from "../../shared/types.ts";

type SettingsFileKind = "base" | "local";

type SettingsRecord = Record<string, unknown>;

function isPlainObject(value: unknown): value is SettingsRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function knownSection(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
}

export function resolveClaudeSettingsPaths(
  scope: Scope,
  options: ClaudeSettingsReadOptions = {},
): ClaudeSettingsPaths {
  if (scope === "user") {
    const envDir = process.env.CLAUDE_CONFIG_DIR;
    // Only use CLAUDE_CONFIG_DIR if it is an absolute path; a relative path or
    // empty string would resolve against process.cwd(), which is wrong and
    // could silently read from an unintended location.
    const envDirValid = envDir !== undefined && path.isAbsolute(envDir) ? envDir : undefined;
    const claudeRoot = options.claudeConfigDir ?? envDirValid ?? path.join(os.homedir(), ".claude");
    return {
      basePath: path.join(claudeRoot, "settings.json"),
      localPath: path.join(claudeRoot, "settings.local.json"),
    };
  }

  const cwd = options.cwd ?? process.cwd();
  return {
    basePath: path.join(cwd, ".claude", "settings.json"),
    localPath: path.join(cwd, ".claude", "settings.local.json"),
  };
}

async function readClaudeSettingsFile(
  scope: Scope,
  filePath: string,
  kind: SettingsFileKind,
): Promise<{ settings: SettingsRecord; diagnostics: readonly ImportDiagnostic[] }> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { settings: {}, diagnostics: [] };
    }

    return {
      settings: {},
      diagnostics: [
        {
          severity: "warning",
          scope,
          code: "settings-read-error",
          path: filePath,
          message: `Unable to read Claude ${kind} settings file: ${errorMessage(err)}`,
        },
      ],
    };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return { settings: isPlainObject(parsed) ? parsed : {}, diagnostics: [] };
  } catch (err) {
    return {
      settings: {},
      diagnostics: [
        {
          severity: "warning",
          scope,
          code: "malformed-json",
          path: filePath,
          message: `Ignoring malformed Claude ${kind} settings JSON: ${errorMessage(err)}`,
        },
      ],
    };
  }
}

export function mergeClaudeSettings(
  base: Record<string, unknown>,
  local: Record<string, unknown>,
): MergedClaudeSettings {
  return {
    enabledPlugins: {
      ...knownSection(base.enabledPlugins),
      ...knownSection(local.enabledPlugins),
    },
    extraKnownMarketplaces: {
      ...knownSection(base.extraKnownMarketplaces),
      ...knownSection(local.extraKnownMarketplaces),
    },
  };
}

export async function loadMergedClaudeSettingsForScope(
  scope: Scope,
  options: ClaudeSettingsReadOptions = {},
): Promise<MergedClaudeSettingsResult> {
  const diagnostics: ImportDiagnostic[] = [];

  // Warn when CLAUDE_CONFIG_DIR is set but not usable as an absolute path.
  if (scope === "user" && options.claudeConfigDir === undefined) {
    const envDir = process.env.CLAUDE_CONFIG_DIR;
    if (envDir !== undefined && !path.isAbsolute(envDir)) {
      diagnostics.push({
        severity: "warning",
        scope,
        code: "invalid-claude-config-dir",
        message: `CLAUDE_CONFIG_DIR is not an absolute path ("${envDir}"); falling back to ~/.claude.`,
      });
    }
  }

  const paths = resolveClaudeSettingsPaths(scope, options);
  const base = await readClaudeSettingsFile(scope, paths.basePath, "base");
  const local = await readClaudeSettingsFile(scope, paths.localPath, "local");

  return {
    paths,
    settings: mergeClaudeSettings(base.settings, local.settings),
    diagnostics: [...diagnostics, ...base.diagnostics, ...local.diagnostics],
  };
}
