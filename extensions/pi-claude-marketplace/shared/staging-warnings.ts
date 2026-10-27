/**
 * Tagged staging warnings (D-PL1-01).
 *
 * A discovery warning names a declared component that staging skipped or
 * degraded, and reaches standalone users through the per-plugin diagnostic
 * (D-141-03). A hygiene warning reports bookkeeping such as an index
 * corruption or a cleanup leak. Standalone verbs render the discovery half
 * only (D-19-01); the `marketplace update` and autoupdate cascades and `apply`
 * render both halves (D-PL1-25).
 * Each bridge tags its warnings where it produces them (D-PL1-02), so the
 * orchestrators classify by tag through `partitionStagingWarnings` alone.
 */

export interface DiscoveryWarning {
  readonly kind: "discovery";
  readonly message: string;
}

export interface HygieneWarning {
  readonly kind: "hygiene";
  readonly message: string;
}

export type StagingWarning = DiscoveryWarning | HygieneWarning;

export function discoveryWarning(message: string): DiscoveryWarning {
  return { kind: "discovery", message };
}

export function hygieneWarning(message: string): HygieneWarning {
  return { kind: "hygiene", message };
}

/** Splits warnings by tag, keeping the input order inside each half. */
export function partitionStagingWarnings(warnings: readonly StagingWarning[]): {
  readonly discovery: readonly DiscoveryWarning[];
  readonly hygiene: readonly HygieneWarning[];
} {
  const discovery: DiscoveryWarning[] = [];
  const hygiene: HygieneWarning[] = [];
  for (const warning of warnings) {
    switch (warning.kind) {
      case "discovery":
        discovery.push(warning);
        break;
      case "hygiene":
        hygiene.push(warning);
        break;
    }
  }

  return { discovery, hygiene };
}
