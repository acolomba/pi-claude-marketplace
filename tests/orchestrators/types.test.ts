import type { LedgerDegradationSignals } from "../../extensions/pi-claude-marketplace/orchestrators/plugin/shared.ts";
import type {
  InstallPluginOutcome,
  PluginUpdateBase,
  PluginUpdateFailedOutcome,
  PluginUpdateFn,
  PluginUpdateOutcome,
  PluginUpdateSkippedOutcome,
  PluginUpdateUnchangedOutcome,
  PluginUpdateUpdatedOutcome,
  ReinstallFailedOutcome,
  ReinstallOutcomeBase,
  ReinstallPluginOutcome,
  ReinstallReinstalledOutcome,
  ReinstallSkippedOutcome,
  UpdatePhaseBridge,
  UpdatePhaseFailure,
} from "../../extensions/pi-claude-marketplace/orchestrators/types.ts";

const REINSTALL_BASE = {
  marketplace: "official",
  name: "alpha",
  scope: "project",
} satisfies ReinstallOutcomeBase;

const REINSTALL_REINSTALLED_CLEAN = {
  declaresAgents: false,
  declaresMcp: false,
  marketplace: "official",
  name: "alpha",
  partition: "reinstalled",
  resourcesChanged: false,
  scope: "project",
  stagedAgentNames: [],
  stagedMcpServerNames: [],
  version: "1.0.0",
} satisfies ReinstallReinstalledOutcome;

const REINSTALL_REINSTALLED_FULL = {
  declaresAgents: true,
  declaresMcp: true,
  degradedKinds: ["skill", "command"],
  discoveryWarnings: ["skill alpha could not be read", "command beta could not be read"],
  marketplace: "official",
  name: "alpha",
  notes: ["warning: skill alpha could not be read", "warning: command beta could not be read"],
  partition: "reinstalled",
  resourcesChanged: true,
  scope: "user",
  stagedAgentNames: ["alpha-agent"],
  stagedMcpServerNames: ["alpha-mcp"],
  version: "2.0.0",
} satisfies ReinstallReinstalledOutcome;

const REINSTALL_SKIPPED = {
  marketplace: "official",
  name: "alpha",
  notes: [],
  partition: "skipped",
  scope: "project",
} satisfies ReinstallSkippedOutcome;

const REINSTALL_FAILED_CLEAN = {
  marketplace: "official",
  name: "alpha",
  notes: [],
  partition: "failed",
  scope: "project",
} satisfies ReinstallFailedOutcome;

const REINSTALL_FAILED_FULL = {
  failureClass: "manual-recovery",
  marketplace: "official",
  name: "alpha",
  notes: ["rollback left alpha-agent on disk"],
  partition: "failed",
  reasons: ["rollback partial", "permission denied"],
  scope: "user",
} satisfies ReinstallFailedOutcome;

void REINSTALL_BASE;
void REINSTALL_REINSTALLED_FULL;
void REINSTALL_FAILED_CLEAN;
void (REINSTALL_REINSTALLED_CLEAN satisfies ReinstallPluginOutcome);
void (REINSTALL_SKIPPED satisfies ReinstallPluginOutcome);
void (REINSTALL_FAILED_FULL satisfies ReinstallPluginOutcome);

const UPDATE_PHASE_BRIDGES = {
  agents: true,
  commands: true,
  hooks: true,
  mcp: true,
  skills: true,
} satisfies Record<UpdatePhaseBridge, true>;

const UPDATE_PHASE_FAILURE = {
  msg: "could not roll back staged skill",
  phase: "skills",
} satisfies UpdatePhaseFailure;

const PLUGIN_UPDATE_BASE = {
  declaresAgents: false,
  declaresMcp: false,
  name: "alpha",
} satisfies PluginUpdateBase;

const PLUGIN_UPDATE_UPDATED_CLEAN = {
  declaresAgents: false,
  declaresMcp: false,
  fromVersion: "1.0.0",
  name: "alpha",
  partition: "updated",
  stagedAgentNames: [],
  stagedMcpServerNames: [],
  toVersion: "1.1.0",
} satisfies PluginUpdateUpdatedOutcome;

const PLUGIN_UPDATE_UPDATED_FULL = {
  declaresAgents: true,
  declaresMcp: true,
  degradedKinds: ["skill", "command"],
  fromVersion: "1.0.0",
  name: "alpha",
  notes: ["warning: skill alpha could not be read"],
  orphanRewake: true,
  partialDegrade: {
    kinds: ["hooks", "lsp"],
    newlyDegraded: true,
  },
  partition: "updated",
  stagedAgentNames: ["alpha-agent"],
  stagedMcpServerNames: ["alpha-mcp"],
  toVersion: "2.0.0",
} satisfies PluginUpdateUpdatedOutcome;

const PLUGIN_UPDATE_UNCHANGED = {
  declaresAgents: false,
  declaresMcp: false,
  fromVersion: "1.0.0",
  name: "alpha",
  partition: "unchanged",
  toVersion: "1.0.0",
} satisfies PluginUpdateUnchangedOutcome;

const PLUGIN_UPDATE_SKIPPED_CLEAN = {
  declaresAgents: false,
  declaresMcp: false,
  name: "alpha",
  notes: [],
  partition: "skipped",
  reasons: [],
} satisfies PluginUpdateSkippedOutcome;

const PLUGIN_UPDATE_SKIPPED_FULL = {
  declaresAgents: true,
  declaresMcp: true,
  fromVersion: "1.0.0",
  name: "alpha",
  notes: ["hooks and lsp require --partial"],
  partialUpgradable: true,
  partition: "skipped",
  reasons: ["unsupported hooks", "lsp"],
} satisfies PluginUpdateSkippedOutcome;

const PLUGIN_UPDATE_FAILED_CLEAN = {
  declaresAgents: false,
  declaresMcp: false,
  name: "alpha",
  notes: [],
  partition: "failed",
} satisfies PluginUpdateFailedOutcome;

const PLUGIN_UPDATE_FAILED_FULL = {
  cause: new Error("permission denied"),
  declaresAgents: true,
  declaresMcp: true,
  fromVersion: "1.0.0",
  name: "alpha",
  notes: ["permission denied while updating alpha"],
  partition: "failed",
  phaseFailures: [UPDATE_PHASE_FAILURE],
  reasons: ["permission denied", "rollback partial"],
  toVersion: "2.0.0",
} satisfies PluginUpdateFailedOutcome;

void UPDATE_PHASE_BRIDGES;
void PLUGIN_UPDATE_BASE;
void PLUGIN_UPDATE_UPDATED_FULL;
void PLUGIN_UPDATE_SKIPPED_FULL;
void PLUGIN_UPDATE_FAILED_CLEAN;
void (PLUGIN_UPDATE_UPDATED_CLEAN satisfies PluginUpdateOutcome);
void (PLUGIN_UPDATE_UNCHANGED satisfies PluginUpdateOutcome);
void (PLUGIN_UPDATE_SKIPPED_CLEAN satisfies PluginUpdateOutcome);
void (PLUGIN_UPDATE_FAILED_FULL satisfies PluginUpdateOutcome);

const PLUGIN_UPDATE_FN = ((plugin, marketplace, scope) => {
  void plugin;
  void marketplace;
  void scope;
  return Promise.resolve(PLUGIN_UPDATE_UNCHANGED);
}) satisfies PluginUpdateFn;

void PLUGIN_UPDATE_FN;

const LEDGER_DEGRADATION_SIGNALS = {
  degradedKinds: ["skill", "command"],
  orphanRewake: true,
  stagedAgents: true,
  stagedMcpServers: true,
  unsupported: ["hooks", "lsp"],
} satisfies LedgerDegradationSignals;

const INSTALL_INSTALLED_CLEAN = {
  declaresAgents: false,
  declaresMcp: false,
  resourcesChanged: false,
  status: "installed",
} satisfies InstallPluginOutcome;

const INSTALL_INSTALLED_FULL = {
  declaresAgents: true,
  declaresMcp: true,
  degradedKinds: ["skill", "command"],
  landedDisabled: true,
  orphanRewake: true,
  postCommitWarnings: ["alpha was installed with a degraded skill"],
  resourcesChanged: true,
  status: "installed",
  unsupported: ["hooks", "lsp"],
  version: "2.0.0",
} satisfies InstallPluginOutcome;

const INSTALL_FAILED = {
  cause: "alpha is already installed",
  error: new Error("already installed"),
  status: "failed",
} satisfies InstallPluginOutcome;

void LEDGER_DEGRADATION_SIGNALS;
void INSTALL_INSTALLED_CLEAN;
void INSTALL_INSTALLED_FULL;
void INSTALL_FAILED;

void ({
  marketplace: "official",
  name: "alpha",
  notes: [],
  scope: "project",
  // @ts-expect-error a reinstall outcome always carries its partition discriminant
} satisfies ReinstallPluginOutcome);

void ({
  marketplace: "official",
  name: "alpha",
  notes: [],
  partition: "skipped",
  scope: "project",
  // @ts-expect-error the skipped partition cannot carry a reinstalled version
  version: "1.0.0",
} satisfies ReinstallPluginOutcome);

void ({
  declaresAgents: false,
  marketplace: "official",
  name: "alpha",
  partition: "reinstalled",
  resourcesChanged: false,
  scope: "project",
  stagedAgentNames: [],
  stagedMcpServerNames: [],
  version: "1.0.0",
  // @ts-expect-error the reinstalled partition requires explicit companion predicates
} satisfies ReinstallReinstalledOutcome);

void ({
  marketplace: "official",
  name: "alpha",
  notes: [],
  partition: "failed",
  scope: "project",
  // @ts-expect-error failed reinstalls structurally exclude companion predicates
  declaresAgents: false,
} satisfies ReinstallPluginOutcome);

void ({
  marketplace: "official",
  name: "alpha",
  notes: [],
  partition: "failed",
  // @ts-expect-error failureClass is the closed manual-recovery tag
  failureClass: "ordinary-failure",
  scope: "project",
} satisfies ReinstallFailedOutcome);

void ({
  marketplace: "official",
  name: "alpha",
  notes: [],
  partition: "failed",
  // @ts-expect-error marketplace not added is structural and never a content reason
  reasons: ["marketplace not added"],
  scope: "project",
} satisfies ReinstallFailedOutcome);

void ({
  declaresAgents: false,
  declaresMcp: false,
  marketplace: "official",
  name: "alpha",
  notes: undefined,
  partition: "reinstalled",
  resourcesChanged: false,
  scope: "project",
  stagedAgentNames: [],
  stagedMcpServerNames: [],
  version: "1.0.0",
  // @ts-expect-error exact optional properties reject a present undefined warning list
} satisfies ReinstallReinstalledOutcome);

void ({
  declaresAgents: false,
  declaresMcp: false,
  // @ts-expect-error degradedKinds accepts only supported degraded component kinds
  degradedKinds: ["agent"],
  marketplace: "official",
  name: "alpha",
  partition: "reinstalled",
  resourcesChanged: false,
  scope: "project",
  stagedAgentNames: [],
  stagedMcpServerNames: [],
  version: "1.0.0",
} satisfies ReinstallReinstalledOutcome);

// @ts-expect-error an update outcome always carries its partition discriminant
void ({ declaresAgents: false, declaresMcp: false, name: "alpha" } satisfies PluginUpdateOutcome);

void ({
  declaresAgents: false,
  declaresMcp: false,
  fromVersion: "1.0.0",
  name: "alpha",
  partition: "updated",
  stagedAgentNames: [],
  stagedMcpServerNames: [],
  // @ts-expect-error the updated partition requires both transition versions
} satisfies PluginUpdateUpdatedOutcome);

void ({
  declaresAgents: false,
  declaresMcp: false,
  fromVersion: "1.0.0",
  name: "alpha",
  partition: "unchanged",
  toVersion: "1.0.0",
  // @ts-expect-error unchanged updates structurally exclude failure notes
  notes: [],
} satisfies PluginUpdateOutcome);

void ({
  declaresAgents: false,
  declaresMcp: false,
  name: "alpha",
  notes: [],
  partition: "skipped",
  // @ts-expect-error skipped updates require their closed content reasons
} satisfies PluginUpdateSkippedOutcome);

void ({
  declaresAgents: false,
  declaresMcp: false,
  name: "alpha",
  notes: [],
  partition: "skipped",
  reasons: ["not in manifest"],
  // @ts-expect-error phase failures belong only to the failed partition
  phaseFailures: [],
} satisfies PluginUpdateOutcome);

void ({
  declaresAgents: false,
  declaresMcp: false,
  fromVersion: "1.0.0",
  name: "alpha",
  // @ts-expect-error partialDegrade is atomic and requires newlyDegraded
  partialDegrade: {
    kinds: ["hooks"],
  },
  partition: "updated",
  stagedAgentNames: [],
  stagedMcpServerNames: [],
  toVersion: "2.0.0",
} satisfies PluginUpdateUpdatedOutcome);

void ({
  declaresAgents: false,
  declaresMcp: false,
  fromVersion: "1.0.0",
  name: "alpha",
  partition: "updated",
  stagedAgentNames: [],
  stagedMcpServerNames: [],
  toVersion: "2.0.0",
  // @ts-expect-error updated outcomes cannot duplicate partialDegrade through unsupported
  unsupported: ["hooks"],
} satisfies PluginUpdateUpdatedOutcome);

void ({
  declaresAgents: false,
  declaresMcp: false,
  fromVersion: "1.0.0",
  name: "alpha",
  partition: "updated",
  stagedAgentNames: [],
  stagedMcpServerNames: [],
  toVersion: "2.0.0",
  stagedAgents: undefined,
  // @ts-expect-error exact optional properties reject a present undefined pinned signal
} satisfies PluginUpdateUpdatedOutcome);

void ({
  declaresAgents: false,
  declaresMcp: false,
  name: "alpha",
  notes: [],
  partition: "skipped",
  // @ts-expect-error marketplace not added is structural and never an update content reason
  reasons: ["marketplace not added"],
} satisfies PluginUpdateSkippedOutcome);

void ({
  declaresAgents: false,
  declaresMcp: false,
  name: "alpha",
  notes: [],
  partition: "failed",
  // @ts-expect-error update phase failures use the closed bridge vocabulary
  phaseFailures: [{ msg: "rollback failed", phase: "phase3a" }],
} satisfies PluginUpdateFailedOutcome);

void ({
  declaresAgents: false,
  declaresMcp: false,
  name: "alpha",
  notes: [],
  partition: "failed",
  cause: undefined,
  // @ts-expect-error exact optional properties reject a present undefined cause
} satisfies PluginUpdateFailedOutcome);

void ({
  declaresAgents: false,
  declaresMcp: false,
  fromVersion: "1.0.0",
  name: "alpha",
  partition: "updated",
  stagedAgentNames: [],
  stagedMcpServerNames: [],
  toVersion: "2.0.0",
  // @ts-expect-error outcome types do not carry rendered-row dependencies
  dependencies: ["agents"],
} satisfies PluginUpdateOutcome);

const PLUGIN_UPDATE_FN_WITH_WRONG_PARAMETER = (
  _plugin: number,
  _marketplace: string,
  _scope: "user" | "project",
): Promise<PluginUpdateOutcome> => Promise.resolve(PLUGIN_UPDATE_UNCHANGED);

// @ts-expect-error the update function's first parameter is a plugin name string
void (PLUGIN_UPDATE_FN_WITH_WRONG_PARAMETER satisfies PluginUpdateFn);

const PLUGIN_UPDATE_FN_WITH_WRONG_RETURN = (
  _plugin: string,
  _marketplace: string,
  _scope: "user" | "project",
): Promise<string> => Promise.resolve("updated");

// @ts-expect-error the update function resolves a PluginUpdateOutcome
void (PLUGIN_UPDATE_FN_WITH_WRONG_RETURN satisfies PluginUpdateFn);

void ({
  declaresAgents: false,
  declaresMcp: false,
  resourcesChanged: false,
  // @ts-expect-error an install outcome always carries its status discriminant
} satisfies InstallPluginOutcome);

void ({
  declaresAgents: false,
  resourcesChanged: false,
  status: "installed",
  // @ts-expect-error installed outcomes require both explicit companion predicates
} satisfies InstallPluginOutcome);

void ({
  cause: "install failed",
  error: new Error("install failed"),
  status: "failed",
  // @ts-expect-error failed installs structurally exclude success fields
  version: "1.0.0",
} satisfies InstallPluginOutcome);

void ({
  declaresAgents: false,
  declaresMcp: false,
  resourcesChanged: false,
  status: "installed",
  // @ts-expect-error installed outcomes structurally exclude failure fields
  error: new Error("unexpected"),
} satisfies InstallPluginOutcome);

void ({
  declaresAgents: false,
  declaresMcp: false,
  // @ts-expect-error landedDisabled is a true-only presence marker
  landedDisabled: false,
  resourcesChanged: false,
  status: "installed",
} satisfies InstallPluginOutcome);

void ({
  declaresAgents: false,
  declaresMcp: false,
  version: undefined,
  resourcesChanged: false,
  status: "installed",
  // @ts-expect-error exact optional properties reject a present undefined version
} satisfies InstallPluginOutcome);

void ({
  declaresAgents: false,
  declaresMcp: false,
  resourcesChanged: false,
  status: "installed",
  // @ts-expect-error install outcomes exclude the ledger's staged-count duplicates
  stagedAgents: true,
} satisfies InstallPluginOutcome);

void ({
  declaresAgents: false,
  declaresMcp: false,
  resourcesChanged: false,
  status: "installed",
  // @ts-expect-error install outcomes do not carry rendered-row dependencies
  dependencies: ["agents", "mcp"],
} satisfies InstallPluginOutcome);

void ({
  cause: "install failed",
  // @ts-expect-error failed install errors are Error instances
  error: "install failed",
  status: "failed",
} satisfies InstallPluginOutcome);

// @ts-expect-error failed installs require a formatted cause
void ({ error: new Error("install failed"), status: "failed" } satisfies InstallPluginOutcome);

function proveReadonlyContracts(
  reinstall: ReinstallReinstalledOutcome,
  phaseFailure: UpdatePhaseFailure,
  update: PluginUpdateUpdatedOutcome,
  install: Extract<InstallPluginOutcome, { status: "installed" }>,
): void {
  // @ts-expect-error reinstall outcome scalar fields are readonly
  reinstall.version = "3.0.0";
  // @ts-expect-error reinstall staged-name inventories are not mutable arrays
  const mutableAgentNames: string[] = reinstall.stagedAgentNames;
  void mutableAgentNames;
  // @ts-expect-error phase-failure fields are readonly
  phaseFailure.phase = "commands";
  // @ts-expect-error update staged-name inventories are readonly properties
  update.stagedMcpServerNames = ["other-mcp"];
  // @ts-expect-error install outcome scalar fields are readonly
  install.resourcesChanged = true;
}

void proveReadonlyContracts;
