import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { mock, verify, when } from "strong-mock";

import {
  surfaceDiscoveryWarnings,
  surfaceStagingDiagnostics,
} from "../../../extensions/pi-claude-marketplace/orchestrators/plugin/staging-diagnostics.ts";
import {
  discoveryWarning,
  hygieneWarning,
} from "../../../extensions/pi-claude-marketplace/shared/staging-warnings.ts";
import { createJsonCapture } from "../../edge/json-capture.ts";
import { runWithNothingLoaded } from "../../shared/notification-run-seeds.ts";

import type { ExtensionContext } from "../../../extensions/pi-claude-marketplace/platform/pi-api.ts";

describe("surfaceDiscoveryWarnings", () => {
  for (const mode of ["json", "rpc"]) {
    test(`preserves redacted discovery lines and the parent sink in ${mode}`, () => {
      // arrange
      const capture = createJsonCapture();
      const ctx = {
        mode,
        get ui() {
          return capture.ui;
        },
      };
      const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };

      // act
      surfaceDiscoveryWarnings(ctx, run, {
        plugin: "alpha",
        scope: "project",
        verb: "installed",
        warnings: [
          discoveryWarning("Could not read /private/plugin/skills/alpha-skill"),
          discoveryWarning("fetch with Bearer abc.def failed"),
          discoveryWarning("fetch with Bearer abc.def failed"),
        ],
      });

      // assert
      assert.deepStrictEqual(capture.entries, [
        {
          customType: "claude-plugin",
          payload: {
            schemaVersion: 1,
            origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
            kind: "diagnostic",
            severity: "warning",
            needsReload: false,
            header: 'Plugin "alpha" [project] installed; 3 declared components have notes.',
            lines: [
              "Could not read alpha-skill",
              "fetch with Bearer *** failed",
              "fetch with Bearer *** failed",
            ],
          },
        },
      ]);
      capture.assertValid();
    });
  }

  // eslint-disable-next-line sonarjs/assertions-in-tests -- Explicit strong-mock verify calls assert the complete notification interaction.
  test("does not notify when no discovery warning exists", () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });

    // act
    surfaceDiscoveryWarnings(ctx, runWithNothingLoaded(), {
      plugin: "alpha",
      scope: "project",
      verb: "installed",
      warnings: [],
    });

    // assert
    verify(ctx);
  });

  // eslint-disable-next-line sonarjs/assertions-in-tests -- Explicit strong-mock verify calls assert the complete notification interaction.
  test("D-PL1-05: redacts a singular discovery path under a header that names the project scope", () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
    when(() => ctx.mode)
      .thenReturn("tui")
      .once();
    when(() => ctx.ui)
      .thenReturn(ui)
      .once();
    when(() => {
      ui.notify(
        'Plugin "alpha" [project] installed; 1 declared component has a note.\n\nCould not read alpha-skill',
        "warning",
      );
    })
      .thenReturn(undefined)
      .once();

    // act
    surfaceDiscoveryWarnings(ctx, runWithNothingLoaded(), {
      plugin: "alpha",
      scope: "project",
      verb: "installed",
      warnings: [discoveryWarning("Could not read /private/plugin/skills/alpha-skill")],
    });

    // assert
    verify(ctx);
    verify(ui);
  });

  // eslint-disable-next-line sonarjs/assertions-in-tests -- Explicit strong-mock verify calls assert the complete notification interaction.
  test("D-PL1-05: emits plural updated diagnostics in caller warning order under a header that names the user scope", () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
    const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
    when(() => ctx.mode)
      .thenReturn("tui")
      .once();
    when(() => ctx.ui)
      .thenReturn(ui)
      .once();
    when(() => {
      ui.notify(
        'Plugin "alpha" [user] updated; 2 declared components have notes.\n\nfirst warning\nsecond warning',
        "warning",
      );
    })
      .thenReturn(undefined)
      .once();

    // act
    surfaceDiscoveryWarnings(ctx, runWithNothingLoaded(), {
      plugin: "alpha",
      scope: "user",
      verb: "updated",
      warnings: [discoveryWarning("first warning"), discoveryWarning("second warning")],
    });

    // assert
    verify(ctx);
    verify(ui);
  });

  for (const verb of [
    "installed",
    "updated",
    "reinstalled",
    "enabled",
    "install failed",
    "update failed",
    "reinstall failed",
  ] as const) {
    // eslint-disable-next-line sonarjs/assertions-in-tests -- Explicit strong-mock verify calls assert the complete notification interaction.
    test(`D-PL1-06: renders the ${verb} verb verbatim in the header`, () => {
      // arrange
      const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });
      const ui = mock<ExtensionContext["ui"]>({ exactParams: true, name: "extension UI" });
      when(() => ctx.mode)
        .thenReturn("tui")
        .once();
      when(() => ctx.ui)
        .thenReturn(ui)
        .once();
      when(() => {
        ui.notify(
          `Plugin "alpha" [project] ${verb}; 1 declared component has a note.\n\nfirst warning`,
          "warning",
        );
      })
        .thenReturn(undefined)
        .once();

      // act
      surfaceDiscoveryWarnings(ctx, runWithNothingLoaded(), {
        plugin: "alpha",
        scope: "project",
        verb,
        warnings: [discoveryWarning("first warning")],
      });

      // assert
      verify(ctx);
      verify(ui);
    });
  }
});

// D-PL1-04: the renderer's warnings accept discovery warnings only, so a
// hygiene warning cannot reach a standalone diagnostic. This pin fails to
// compile the day the parameter widens.
const HYGIENE_DIAGNOSTIC = {
  plugin: "alpha",
  scope: "project",
  verb: "installed",
  warnings: [hygieneWarning("agents index entry dropped")],
} as const;
// @ts-expect-error -- D-PL1-04: a hygiene warning never reaches the discovery renderer.
void (HYGIENE_DIAGNOSTIC satisfies Parameters<typeof surfaceDiscoveryWarnings>[2]);

describe("surfaceStagingDiagnostics", () => {
  test("D-PL1-07 / D-PL1-08: renders one diagnostic per entry in entry order with only the discovery lines", () => {
    // arrange
    const capture = createJsonCapture();
    const ctx = {
      mode: "json",
      get ui() {
        return capture.ui;
      },
    };
    const run = { ...runWithNothingLoaded(), entrySink: capture.entrySink };

    // act
    surfaceStagingDiagnostics(ctx, run, [
      {
        plugin: "beta",
        scope: "user",
        verb: "updated",
        warnings: [
          hygieneWarning("agents index entry dropped"),
          discoveryWarning("skill beta-one skipped"),
        ],
      },
      {
        plugin: "alpha",
        scope: "project",
        verb: "reinstalled",
        warnings: [
          discoveryWarning("command alpha-one skipped"),
          hygieneWarning("cleanup left a tree"),
          discoveryWarning("command alpha-two skipped"),
        ],
      },
    ]);

    // assert
    assert.deepStrictEqual(capture.entries, [
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
          kind: "diagnostic",
          severity: "warning",
          needsReload: false,
          header: 'Plugin "beta" [user] updated; 1 declared component has a note.',
          lines: ["skill beta-one skipped"],
        },
      },
      {
        customType: "claude-plugin",
        payload: {
          schemaVersion: 1,
          origin: { kind: "command", commandId: "plugin", invocationId: "test-run" },
          kind: "diagnostic",
          severity: "warning",
          needsReload: false,
          header: 'Plugin "alpha" [project] reinstalled; 2 declared components have notes.',
          lines: ["command alpha-one skipped", "command alpha-two skipped"],
        },
      },
    ]);
    capture.assertValid();
  });

  // eslint-disable-next-line sonarjs/assertions-in-tests -- Explicit strong-mock verify calls assert the complete notification interaction.
  test("D-PL1-08: an entry with only hygiene warnings renders nothing", () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });

    // act
    surfaceStagingDiagnostics(ctx, runWithNothingLoaded(), [HYGIENE_DIAGNOSTIC]);

    // assert
    verify(ctx);
  });

  // eslint-disable-next-line sonarjs/assertions-in-tests -- Explicit strong-mock verify calls assert the complete notification interaction.
  test("D-PL1-07: an empty list renders nothing", () => {
    // arrange
    const ctx = mock<ExtensionContext>({ exactParams: true, name: "extension context" });

    // act
    surfaceStagingDiagnostics(ctx, runWithNothingLoaded(), []);

    // assert
    verify(ctx);
  });
});
