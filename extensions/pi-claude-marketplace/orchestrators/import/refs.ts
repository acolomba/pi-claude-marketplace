import type {
  EnabledPluginRef,
  EnabledPluginRefsResult,
  ImportDiagnostic,
  MergedClaudeSettings,
  ParseEnabledPluginRefResult,
} from "./types.ts";
import type { Scope } from "../../shared/types.ts";

export function parseEnabledPluginRef(raw: string): ParseEnabledPluginRefResult {
  const trimmed = raw.trim();
  const parts = trimmed.split("@");
  if (parts.length !== 2) {
    return { ok: false, reason: "Expected exactly one @ separator in plugin@marketplace ref." };
  }

  const [plugin, marketplace] = parts;
  if (
    plugin === undefined ||
    marketplace === undefined ||
    plugin.trim() === "" ||
    marketplace.trim() === ""
  ) {
    return {
      ok: false,
      reason: "Expected non-empty plugin and marketplace in plugin@marketplace ref.",
    };
  }

  return { ok: true, ref: { plugin: plugin.trim(), marketplace: marketplace.trim(), raw } };
}

function malformedRefDiagnostic(scope: Scope, ref: string, reason: string): ImportDiagnostic {
  return {
    severity: "warning",
    scope,
    code: "malformed-plugin-ref",
    ref,
    message: `Skipping malformed enabled plugin ref ${JSON.stringify(ref)}: ${reason} Expected plugin@marketplace.`,
  };
}

function nonBooleanDiagnostic(scope: Scope, ref: string): ImportDiagnostic {
  return {
    severity: "warning",
    scope,
    code: "non-boolean-enabled-plugin",
    ref,
    message: `Skipping enabled plugin ref ${JSON.stringify(ref)} because its value is not boolean true or false.`,
  };
}

export function extractEnabledPluginRefs(
  scope: Scope,
  settings: MergedClaudeSettings,
): EnabledPluginRefsResult {
  const refs: EnabledPluginRef[] = [];
  const diagnostics: ImportDiagnostic[] = [];

  for (const [rawRef, value] of Object.entries(settings.enabledPlugins)) {
    if (value === false) {
      continue;
    }

    if (value !== true) {
      diagnostics.push(nonBooleanDiagnostic(scope, rawRef));
      continue;
    }

    const parsed = parseEnabledPluginRef(rawRef);
    if (parsed.ok) {
      refs.push(parsed.ref);
    } else {
      diagnostics.push(malformedRefDiagnostic(scope, rawRef, parsed.reason));
    }
  }

  return { refs, diagnostics };
}
