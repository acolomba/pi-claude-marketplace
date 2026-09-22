/**
 * tests/architecture/closed-set-enrollment.test.ts -- closed-set enrollment
 * tripwires for the hook-event admission set and the soft-dependency set
 * (SCN-F025 / GGAT-04).
 *
 * The compile-time proofs (`hook-events.ts::_BucketAEventsCoverageProof`, the
 * `satisfies` assertions on the tuples, the exhaustive dispatch records) catch a
 * member that is REMOVED or RENAMED, but an ADDITIVE drift -- a new literal
 * appended to a set and given a home everywhere the type system looks -- is
 * silently absorbed. The exact-length assertions here are the deliberate-bump
 * tripwire for that case: growing a set forces a conscious update here, which is
 * the prompt to also register its dispatch translator, matcher disposition, and
 * catalog row. Bump the expected count in the SAME change that grows the set.
 *
 * What is specific to these two sets: `as const satisfies readonly T[]`
 * constrains a tuple against a union and not the union against the tuple. The
 * reverse direction therefore lives beside the tuple it constrains, in
 * `domain/components/hook-events.ts`, where the typecheck carries it; the count
 * lives here, where a bump is a deliberate edit rather than a silent one.
 *
 * Neither `ClaudeHookEvent` nor `Dependency` has a runtime tuple of its own, so
 * neither offers members this gate could count directly. The hook half counts
 * `BUCKET_A_EVENTS`, the registration tuple the resolver reads. The `Dependency`
 * half takes the two instruments a bare literal union leaves available: a
 * compile-time `Exclude` proof that the union holds exactly the three members
 * `softDepMarkers` branches on, and a runtime pin on that function's arity. A
 * fourth dependency added to the union without a `softDepMarkers` branch leaves
 * the flag count and the emitted marker set unchanged, so neither the
 * cross-product cases below nor the catalog case would notice it; the proof
 * fails to compile instead.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  BUCKET_A_EVENTS,
  TOOL_EVENTS,
} from "../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
import { softDepMarkers } from "../../extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts";

import type { SoftDepStatus } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";
import type { Dependency } from "../../extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts";
import type { Reason } from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

/**
 * The three `Dependency` members `softDepMarkers` carries a branch for.
 *
 * `AssertNever` accepts `never` alone, so a fourth member of the union leaves
 * `UnenrolledDependency` non-`never` and the annotation below is a TS2344 build
 * failure. This is the reverse direction `hook-events.ts` states for the event
 * set, spelled here because `Dependency` has no tuple of its own to constrain.
 */
type AssertNever<T extends never> = T;
type UnenrolledDependency = Exclude<Dependency, "agents" | "mcp" | "workflows">;
const UNENROLLED_DEPENDENCIES: AssertNever<UnenrolledDependency>[] = [];

test("SCN-F025: BUCKET_A_EVENTS is the closed 10-entry admitted-event set", () => {
  // TOOL-02: the admission set opened at 8 events, the closed set
  // `checkMatcherSupportability` reads to decide whether a plugin-declared hook
  // event is admitted at all.
  // ADMIT-01: +2 for the turn-boundary `Stop` / `StopFailure` lifecycle tail,
  // dispatched off `agent_settled` rather than a per-Pi-event composite
  // (8 -> 10).

  // arrange
  const expectedEventCount = 10;

  // act
  const admittedEvents = BUCKET_A_EVENTS;

  // assert
  assert.strictEqual(admittedEvents.length, expectedEventCount);
});

test("SCN-F025: TOOL_EVENTS is the closed 3-entry tool-matcher subset", () => {
  // TOOL-01: the subset has held at 3 since the reverse tool-name map was
  // introduced -- these are the events whose matcher targets a Claude tool name
  // rather than a `source` / `reason` / `trigger` payload field.

  // arrange
  const expectedToolEventCount = 3;

  // act
  const toolEvents = TOOL_EVENTS;

  // assert
  assert.strictEqual(toolEvents.length, expectedToolEventCount);
});

test("SCN-F025: every TOOL_EVENTS member is an admitted bucket-A event", () => {
  // arrange
  const admittedEvents: ReadonlySet<string> = new Set(BUCKET_A_EVENTS);

  // act
  const unadmittedToolEvents = TOOL_EVENTS.filter((event) => !admittedEvents.has(event));

  // assert
  assert.deepStrictEqual(unadmittedToolEvents, []);
});

test("SCN-F025: Dependency is the closed 3-member set softDepMarkers branches on", () => {
  // arrange
  const expectedDeclaresFlagCount = 3;
  const probeParameterCount = 1;

  // act
  const parameterCount = softDepMarkers.length;

  // assert
  assert.deepStrictEqual(
    UNENROLLED_DEPENDENCIES,
    [],
    "SCN-F025: a Dependency member outside the enrolled triple is a compile failure at UNENROLLED_DEPENDENCIES, not a value this array could ever hold.",
  );
  assert.strictEqual(
    parameterCount,
    expectedDeclaresFlagCount + probeParameterCount,
    "SCN-F025: softDepMarkers changed arity, so the Dependency set moved without its marker branch, its catalog row, or this classification being revisited.",
  );
});

test("SCN-F025: softDepMarkers emits the agents and mcp markers in canonical agents-before-mcp order", () => {
  // arrange
  const probe = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
    workflowEngineLoaded: false,
  } satisfies SoftDepStatus;

  // act
  const markers = softDepMarkers(true, true, false, probe);

  // assert
  assert.deepStrictEqual(markers, ["requires pi-subagents", "requires pi-mcp"]);
});

test("SCN-F025: softDepMarkers emits only the agents marker for an agents-only declaration", () => {
  // arrange
  const probe = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
    workflowEngineLoaded: false,
  } satisfies SoftDepStatus;

  // act
  const markers = softDepMarkers(true, false, false, probe);

  // assert
  assert.deepStrictEqual(markers, ["requires pi-subagents"]);
});

test("SCN-F025: softDepMarkers emits only the mcp marker for an mcp-only declaration", () => {
  // arrange
  const probe = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
    workflowEngineLoaded: false,
  } satisfies SoftDepStatus;

  // act
  const markers = softDepMarkers(false, true, false, probe);

  // assert
  assert.deepStrictEqual(markers, ["requires pi-mcp"]);
});

test("SCN-F025: softDepMarkers emits nothing when the row declares neither dependency", () => {
  // arrange
  const probe = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
    workflowEngineLoaded: false,
  } satisfies SoftDepStatus;

  // act
  const markers = softDepMarkers(false, false, false, probe);

  // assert
  assert.deepStrictEqual(markers, []);
});

test("SCN-F025: softDepMarkers emits nothing when both companions are loaded", () => {
  // arrange
  const probe = {
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: true,
    workflowEngineLoaded: true,
  } satisfies SoftDepStatus;

  // act
  const markers = softDepMarkers(true, true, false, probe);

  // assert
  assert.deepStrictEqual(markers, []);
});

/**
 * The complete set of markers `softDepMarkers` can emit, written here as
 * independent literals and annotated `Reason`.
 *
 * The annotation is the catalog-enrollment half and it is total rather than
 * sampled: a marker that stopped being a catalog member would fail to compile
 * here, and `softDepMarkers`' own `readonly Reason[]` return type says the same
 * thing about every input, not just the one the case below drives.
 */
const EMITTABLE_SOFT_DEP_MARKERS: readonly Reason[] = [
  "requires pi-subagents",
  "requires pi-mcp",
  "requires pi-dynamic-workflows",
];

test("SCN-F025: every marker softDepMarkers can emit is a reason catalog member", () => {
  // arrange
  const probe = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
    workflowEngineLoaded: false,
  } satisfies SoftDepStatus;
  const expectedMarkers = EMITTABLE_SOFT_DEP_MARKERS;

  // act
  // All three dependencies declared and no companion loaded is the one input
  // that emits every marker, so this call enumerates the emittable set.
  const markers = softDepMarkers(true, true, true, probe);

  // assert
  assert.deepStrictEqual(markers, expectedMarkers);
});
