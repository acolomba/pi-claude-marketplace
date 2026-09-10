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
 * half pins `softDepMarkers`, the sole runtime surface the set drives: a third
 * dependency added to the union without a `softDepMarkers` branch would leave
 * the flag count and the emitted marker set unchanged, which is the drift this
 * pins.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  BUCKET_A_EVENTS,
  TOOL_EVENTS,
} from "../../extensions/pi-claude-marketplace/domain/components/hook-events.ts";
import { softDepMarkers } from "../../extensions/pi-claude-marketplace/shared/concerns/soft-dep.ts";
import { REASONS } from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

import type { SoftDepStatus } from "../../extensions/pi-claude-marketplace/platform/pi-api.ts";

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
  assert.equal(admittedEvents.length, expectedEventCount);
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
  assert.equal(toolEvents.length, expectedToolEventCount);
});

test("SCN-F025: every TOOL_EVENTS member is an admitted bucket-A event", () => {
  // arrange
  const admittedEvents: ReadonlySet<string> = new Set(BUCKET_A_EVENTS);

  // act
  const unadmittedToolEvents = TOOL_EVENTS.filter((event) => !admittedEvents.has(event));

  // assert
  assert.deepStrictEqual(unadmittedToolEvents, []);
});

test("SCN-F025: softDepMarkers emits both markers in canonical agents-before-mcp order", () => {
  // arrange
  const probe = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  } satisfies SoftDepStatus;

  // act
  const markers = softDepMarkers(true, true, probe);

  // assert
  assert.deepStrictEqual(markers, ["requires pi-subagents", "requires pi-mcp"]);
});

test("SCN-F025: softDepMarkers emits only the agents marker for an agents-only declaration", () => {
  // arrange
  const probe = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  } satisfies SoftDepStatus;

  // act
  const markers = softDepMarkers(true, false, probe);

  // assert
  assert.deepStrictEqual(markers, ["requires pi-subagents"]);
});

test("SCN-F025: softDepMarkers emits only the mcp marker for an mcp-only declaration", () => {
  // arrange
  const probe = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  } satisfies SoftDepStatus;

  // act
  const markers = softDepMarkers(false, true, probe);

  // assert
  assert.deepStrictEqual(markers, ["requires pi-mcp"]);
});

test("SCN-F025: softDepMarkers emits nothing when the row declares neither dependency", () => {
  // arrange
  const probe = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  } satisfies SoftDepStatus;

  // act
  const markers = softDepMarkers(false, false, probe);

  // assert
  assert.deepStrictEqual(markers, []);
});

test("SCN-F025: softDepMarkers emits nothing when both companions are loaded", () => {
  // arrange
  const probe = {
    piSubagentsLoaded: true,
    piMcpAdapterLoaded: true,
  } satisfies SoftDepStatus;

  // act
  const markers = softDepMarkers(true, true, probe);

  // assert
  assert.deepStrictEqual(markers, []);
});

test("SCN-F025: every marker softDepMarkers can emit is a REASONS catalog member", () => {
  // arrange
  const probe = {
    piSubagentsLoaded: false,
    piMcpAdapterLoaded: false,
  } satisfies SoftDepStatus;
  const catalogMembers: ReadonlySet<string> = new Set(REASONS);

  // act
  const uncatalogedMarkers = softDepMarkers(true, true, probe).filter(
    (marker) => !catalogMembers.has(marker),
  );

  // assert
  assert.deepStrictEqual(uncatalogedMarkers, []);
});
