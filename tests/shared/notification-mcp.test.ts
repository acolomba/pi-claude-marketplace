import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  composeMcpConfigNoticesText,
  composeMcpMigrationText,
  mcpConfigNoticeLine,
} from "../../extensions/pi-claude-marketplace/shared/notification-mcp.ts";

import type { McpMigrationRow } from "../../extensions/pi-claude-marketplace/shared/notification-types.ts";

const MCP_MIGRATION_COST_LINE =
  "The new names reset what pi-mcp-adapter keeps for each server name: sign in again to servers that use OAuth, and approve project servers again. Until you reload, pi-mcp-adapter can still show the old names.";

describe("mcpConfigNoticeLine", () => {
  test("AFILE-04: a notice renders its one line without a summary", () => {
    // act
    const line = mcpConfigNoticeLine({
      kind: "left-unchanged",
      scope: "user",
      file: "mcp.json",
    });

    // assert
    assert.strictEqual(
      line,
      "The user-scope mcp.json is not a valid MCP config, so it was left unchanged. Fix it before you install or update a plugin that has MCP servers.",
    );
  });
});

describe("composeMcpConfigNoticesText", () => {
  test("AFILE-04: one comments-dropped notice renders its exact bytes", () => {
    // act
    const text = composeMcpConfigNoticesText("comments-dropped", [
      { kind: "comments-dropped", scope: "user", file: "mcp-adapter.json" },
    ]);

    // assert
    assert.strictEqual(
      text,
      "MCP config comments removed.\n\nThe user-scope mcp-adapter.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.",
    );
  });

  test("AFILE-04: one left-unchanged notice renders its exact bytes", () => {
    // act
    const text = composeMcpConfigNoticesText("left-unchanged", [
      { kind: "left-unchanged", scope: "project", file: "mcp-adapter.json" },
    ]);

    // assert
    assert.strictEqual(
      text,
      "MCP config left unchanged.\n\nThe project-scope mcp-adapter.json is not a valid MCP config, so it was left unchanged. Fix it before you install or update a plugin that has MCP servers.",
    );
  });

  test("AFILE-04: comments-dropped notices for two scopes share one section with a line each", () => {
    // act
    const text = composeMcpConfigNoticesText("comments-dropped", [
      { kind: "comments-dropped", scope: "project", file: "mcp-adapter.json" },
      { kind: "comments-dropped", scope: "user", file: "mcp-adapter.json" },
    ]);

    // assert
    assert.strictEqual(
      text,
      "MCP config comments removed.\n\n" +
        "The project-scope mcp-adapter.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.\n" +
        "The user-scope mcp-adapter.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.",
    );
  });

  test("AFILE-06: one override-kept notice renders its exact bytes", () => {
    // act
    const text = composeMcpConfigNoticesText("override-kept", [
      {
        kind: "override-kept",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "hello",
        server: "srv",
        fields: ["env", "headers"],
      },
    ]);

    // assert
    assert.strictEqual(
      text,
      'MCP server override kept.\n\nhello now provides "srv" in the project-scope mcp-adapter.json. Your override for "srv" is kept, but these fields of it stop applying: env, headers. It comes back when you uninstall or disable hello.',
    );
  });

  test("AFILE-06: control, line-separator and bidi characters in an override-kept field name render as \\u escapes", () => {
    // act
    const text = composeMcpConfigNoticesText("override-kept", [
      {
        kind: "override-kept",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "hello",
        server: "srv",
        fields: ["e\u001b[2Jn\nv", "he\u2028ad\u202eers"],
      },
    ]);

    // assert
    assert.strictEqual(
      text,
      'MCP server override kept.\n\nhello now provides "srv" in the project-scope mcp-adapter.json. Your override for "srv" is kept, but these fields of it stop applying: e\\u001b[2Jn\\u000av, he\\u2028ad\\u202eers. It comes back when you uninstall or disable hello.',
    );
  });

  test("AVAR-04: variables-missing notices for two servers render MCP server variables not set. with a line each", () => {
    // act
    const text = composeMcpConfigNoticesText("variables-missing", [
      {
        kind: "variables-missing",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "hello",
        server: "plugin_hello_alpha_",
        names: ["DD_API_KEY", "DD_SITE"],
      },
      {
        kind: "variables-missing",
        scope: "user",
        file: "mcp-adapter.json",
        plugin: "hello",
        server: "plugin_hello_beta_",
        names: ["BETA_TOKEN"],
      },
    ]);

    // assert
    assert.strictEqual(
      text,
      "MCP server variables not set.\n\n" +
        'Server "plugin_hello_alpha_" from hello in the project-scope mcp-adapter.json uses environment variables that were not set at install: DD_API_KEY, DD_SITE.\n' +
        'Server "plugin_hello_beta_" from hello in the user-scope mcp-adapter.json uses environment variables that were not set at install: BETA_TOKEN.',
    );
  });

  test("AVAR-05: credentials-blanked notices for two servers render MCP server credentials withheld. with a line each", () => {
    // act
    const text = composeMcpConfigNoticesText("credentials-blanked", [
      {
        kind: "credentials-blanked",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "hello",
        server: "plugin_hello_alpha_",
        names: ["ANTHROPIC_API_KEY", "AWS_SESSION_TOKEN"],
      },
      {
        kind: "credentials-blanked",
        scope: "user",
        file: "mcp-adapter.json",
        plugin: "hello",
        server: "plugin_hello_beta_",
        names: ["NPM_TOKEN"],
      },
    ]);

    // assert
    assert.strictEqual(
      text,
      "MCP server credentials withheld.\n\n" +
        'Server "plugin_hello_alpha_" from hello in the project-scope mcp-adapter.json references credential variables that Claude Code never sends to a remote server: ANTHROPIC_API_KEY, AWS_SESSION_TOKEN. They were written as empty values.\n' +
        'Server "plugin_hello_beta_" from hello in the user-scope mcp-adapter.json references credential variables that Claude Code never sends to a remote server: NPM_TOKEN. They were written as empty values.',
    );
  });

  test("AMIG-01: control characters in a leftover's old name render as \\u escapes", () => {
    // act
    const text = composeMcpConfigNoticesText("leftover-removed", [
      {
        kind: "leftover-removed",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "hello",
        server: "s\u001b[2Jr\nv",
      },
    ]);

    // assert
    assert.strictEqual(
      text,
      'Old MCP server settings removed.\n\nRemoved "s\\u001b[2Jr\\u000av" from the project-scope mcp-adapter.json: pi-mcp-adapter had written it under the old name of a server from hello, for example for /mcp-adapter disable, and it no longer applies.',
    );
  });

  test("AMIG-01: line separators and format characters in a leftover's old name render as \\u escapes", () => {
    // act
    const text = composeMcpConfigNoticesText("leftover-removed", [
      {
        kind: "leftover-removed",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "hello",
        server: "s\u2028r\u202ev",
      },
    ]);

    // assert
    assert.strictEqual(
      text,
      'Old MCP server settings removed.\n\nRemoved "s\\u2028r\\u202ev" from the project-scope mcp-adapter.json: pi-mcp-adapter had written it under the old name of a server from hello, for example for /mcp-adapter disable, and it no longer applies.',
    );
  });

  test("AMIG-03: line separators and format characters in a leftover's plugin name render as \\u escapes", () => {
    // act
    const text = composeMcpConfigNoticesText("leftover-removed", [
      {
        kind: "leftover-removed",
        scope: "project",
        file: "mcp-adapter.json",
        plugin: "he\u2028ll\u202eo",
        server: "srv",
      },
    ]);

    // assert
    assert.strictEqual(
      text,
      'Old MCP server settings removed.\n\nRemoved "srv" from the project-scope mcp-adapter.json: pi-mcp-adapter had written it under the old name of a server from he\\u2028ll\\u202eo, for example for /mcp-adapter disable, and it no longer applies.',
    );
  });

  test("AMIG-03: line separators and format characters in plugin and server names render as \\u escapes in the other MCP config notices", () => {
    // arrange
    const names = {
      scope: "project",
      file: "mcp-adapter.json",
      plugin: "he\u2028ll\u202eo",
      server: "s\u2028r\u202ev",
    } as const;

    // act
    const texts = [
      composeMcpConfigNoticesText("override-kept", [
        { kind: "override-kept", ...names, fields: ["env"] },
      ]),
      composeMcpConfigNoticesText("variables-missing", [
        { kind: "variables-missing", ...names, names: ["API_URL"] },
      ]),
      composeMcpConfigNoticesText("credentials-blanked", [
        { kind: "credentials-blanked", ...names, names: ["ANTHROPIC_API_KEY"] },
      ]),
      composeMcpConfigNoticesText("tool-rules-unenforced", [
        { kind: "tool-rules-unenforced", ...names, fields: ["toolPermissions"] },
      ]),
    ];

    // assert
    assert.deepStrictEqual(texts, [
      'MCP server override kept.\n\nhe\\u2028ll\\u202eo now provides "s\\u2028r\\u202ev" in the project-scope mcp-adapter.json. Your override for "s\\u2028r\\u202ev" is kept, but these fields of it stop applying: env. It comes back when you uninstall or disable he\\u2028ll\\u202eo.',
      'MCP server variables not set.\n\nServer "s\\u2028r\\u202ev" from he\\u2028ll\\u202eo in the project-scope mcp-adapter.json uses environment variables that were not set at install: API_URL.',
      'MCP server credentials withheld.\n\nServer "s\\u2028r\\u202ev" from he\\u2028ll\\u202eo in the project-scope mcp-adapter.json references credential variables that Claude Code never sends to a remote server: ANTHROPIC_API_KEY. They were written as empty values.',
      'MCP server tool rules not enforced.\n\nServer "s\\u2028r\\u202ev" from he\\u2028ll\\u202eo in the project-scope mcp-adapter.json declares tool permission rules that pi-mcp-adapter does not enforce: toolPermissions. Its tools run without these rules.',
    ]);
  });
});

describe("composeMcpMigrationText", () => {
  test("AMIG-03: notice lines follow the cost line, one per notice, in the given order", () => {
    // act
    const text = composeMcpMigrationText(
      [
        {
          kind: "moved",
          scope: "project",
          plugin: "acme",
          marketplace: "mp",
          from: "srv",
          to: "plugin_acme_srv_",
        },
      ],
      [
        { kind: "comments-dropped", scope: "project", file: "mcp.json" },
        {
          kind: "leftover-removed",
          scope: "project",
          file: "mcp-adapter.json",
          plugin: "acme",
          server: "srv",
        },
      ],
    );

    // assert
    assert.strictEqual(
      text,
      [
        "Plugin MCP servers moved from mcp.json to mcp-adapter.json.",
        "",
        "Moved to mcp-adapter.json:",
        "  srv -> plugin_acme_srv_ (acme) [project]",
        MCP_MIGRATION_COST_LINE,
        "The project-scope mcp.json was rewritten to update plugin MCP servers; its JSONC comments were removed and everything else in it was kept.",
        'Removed "srv" from the project-scope mcp-adapter.json: pi-mcp-adapter had written it under the old name of a server from acme, for example for /mcp-adapter disable, and it no longer applies.',
      ].join("\n"),
    );
  });

  test("AMIG-03: control characters in names and details render as \\u escapes", () => {
    // act
    const text = composeMcpMigrationText(
      [
        {
          kind: "moved",
          scope: "project",
          plugin: "ac\u0000me",
          marketplace: "mp",
          from: "s\u001b[2Jrv",
          to: "plugin_acme_srv_",
        },
        { kind: "stopped", scope: "project", detail: "line\nbreak\u007f\u009f\u00a0" },
      ],
      [],
    );

    // assert
    assert.strictEqual(
      text,
      [
        "Plugin MCP servers in mcp.json need attention.",
        "",
        "Moved to mcp-adapter.json:",
        "  s\\u001b[2Jrv -> plugin_acme_srv_ (ac\\u0000me) [project]",
        "Left in mcp.json:",
        "  The project-scope move stopped: line\\u000abreak\\u007f\\u009f\u00a0. The next /reload tries again.",
        MCP_MIGRATION_COST_LINE,
      ].join("\n"),
    );
  });

  test("AMIG-03: line separators and format characters in a file-derived name render as \\u escapes", () => {
    // act
    const text = composeMcpMigrationText(
      [
        {
          kind: "moved",
          scope: "project",
          plugin: "ac\u2029me",
          marketplace: "mp",
          from: "s\u2028r\u202ev\u200b\u{e0001}",
          to: "plugin_acme_srv_",
        },
      ],
      [],
    );

    // assert
    assert.strictEqual(
      text,
      [
        "Plugin MCP servers moved from mcp.json to mcp-adapter.json.",
        "",
        "Moved to mcp-adapter.json:",
        "  s\\u2028r\\u202ev\\u200b\\udb40\\udc01 -> plugin_acme_srv_ (ac\\u2029me) [project]",
        MCP_MIGRATION_COST_LINE,
      ].join("\n"),
    );
  });

  test("AMIG-01 / AMIG-04: each left-in-place kind renders its remedy, with no cost line", () => {
    // act
    const text = composeMcpMigrationText(
      [
        { kind: "file-unreadable", scope: "project", file: "mcp-adapter.json" },
        {
          kind: "unowned",
          scope: "project",
          plugin: "gone",
          marketplace: "mp",
          servers: ["orphan"],
        },
        {
          kind: "source-unreadable",
          scope: "user",
          plugin: "acme",
          marketplace: "official",
          servers: ["github", "slack"],
        },
        {
          kind: "collision",
          scope: "user",
          plugin: "dbtools",
          marketplace: "official",
          servers: ["db"],
          key: "plugin_dbtools_db_",
          source: "the user-scope mcp-adapter.json",
        },
      ],
      [],
    );

    // assert
    assert.strictEqual(
      text,
      [
        "Plugin MCP servers in mcp.json need attention.",
        "",
        "Left in mcp.json:",
        "  The project-scope mcp-adapter.json is not a valid MCP config, so nothing in this scope moved. Fix it, then run /reload.",
        "  orphan (gone) [project] No plugin installed in the project scope owns it. Install gone@mp or remove it from mcp.json.",
        "  github, slack (acme) [user] The plugin source is not available offline. Run /claude:plugin reinstall acme@official to move it.",
        "  db (dbtools) [user] plugin_dbtools_db_ is already defined in the user-scope mcp-adapter.json, so no server of dbtools moved. Remove or rename that server, then run /reload.",
      ].join("\n"),
    );
  });

  for (const { row, line } of [
    {
      row: { kind: "unowned", scope: "user", plugin: "p", marketplace: "m", servers: ["s"] },
      line: "  s (p) [user] No plugin installed in the user scope owns it. Install p@m or remove it from mcp.json.",
    },
    {
      row: { kind: "not-listed", scope: "user", plugin: "p", marketplace: "m", servers: ["s"] },
      line: "  s (p) [user] The m marketplace no longer lists p in a valid form. Run /claude:plugin marketplace update m, or /claude:plugin uninstall p@m to remove it.",
    },
    {
      row: {
        kind: "source-unreadable",
        scope: "user",
        plugin: "p",
        marketplace: "m",
        servers: ["s"],
      },
      line: "  s (p) [user] The plugin source is not available offline. Run /claude:plugin reinstall p@m to move it.",
    },
    {
      row: {
        kind: "marketplace-unreadable",
        scope: "user",
        plugin: "p",
        marketplace: "m",
        servers: ["s"],
      },
      line: "  s (p) [user] The m marketplace copy cannot give the source of p. Run /claude:plugin uninstall p@m to remove it, or /claude:plugin marketplace update m when the copy is out of date.",
    },
    {
      row: {
        kind: "collision",
        scope: "user",
        plugin: "p",
        marketplace: "m",
        servers: ["s"],
        key: "plugin_p_s_",
        source: "~/.config/mcp/mcp.json",
      },
      line: "  s (p) [user] plugin_p_s_ is already defined in ~/.config/mcp/mcp.json, so no server of p moved. Remove or rename that server, then run /reload.",
    },
    {
      row: { kind: "file-unreadable", scope: "user", file: "mcp.json" },
      line: "  The user-scope mcp.json is not a valid MCP config, so nothing in this scope moved. Fix it, then run /reload.",
    },
  ] satisfies ReadonlyArray<{ row: McpMigrationRow; line: string }>) {
    test(`AMIG-03: a ${row.kind} row beside a moved row renders its remedy after the moved section`, () => {
      // act
      const text = composeMcpMigrationText(
        [
          {
            kind: "moved",
            scope: "project",
            plugin: "acme",
            marketplace: "mp",
            from: "srv",
            to: "plugin_acme_srv_",
          },
          row,
        ],
        [],
      );

      // assert
      assert.strictEqual(
        text,
        [
          "Plugin MCP servers in mcp.json need attention.",
          "",
          "Moved to mcp-adapter.json:",
          "  srv -> plugin_acme_srv_ (acme) [project]",
          "Left in mcp.json:",
          line,
          MCP_MIGRATION_COST_LINE,
        ].join("\n"),
      );
    });
  }

  test("D-08-05: a source-outdated row names an update beside a marketplace-unreadable row", () => {
    // act
    const text = composeMcpMigrationText(
      [
        {
          kind: "marketplace-unreadable",
          scope: "user",
          plugin: "legacy",
          marketplace: "official",
          servers: ["tool"],
        },
        {
          kind: "source-outdated",
          scope: "user",
          plugin: "moved",
          marketplace: "official",
          servers: ["mod", "aux"],
        },
      ],
      [],
    );

    // assert
    assert.strictEqual(
      text,
      "Plugin MCP servers in mcp.json need attention.\n\n" +
        "Left in mcp.json:\n" +
        "  tool (legacy) [user] The official marketplace copy cannot give the source of legacy. Run /claude:plugin uninstall legacy@official to remove it, or /claude:plugin marketplace update official when the copy is out of date.\n" +
        "  mod, aux (moved) [user] The cached source of moved has no plugin at its declared path. Run /claude:plugin update moved@official to move it.",
    );
  });

  test("AMIG-04: control characters in a left-in-place row's file-derived strings render as \\u escapes", () => {
    // act
    const text = composeMcpMigrationText(
      [
        {
          kind: "collision",
          scope: "project",
          plugin: "p\u001b",
          marketplace: "m\u0007",
          servers: ["s\nx", "t"],
          key: "k\u009b",
          source: "the f\r.json",
        },
        {
          kind: "unowned",
          scope: "user",
          plugin: "q\u0000",
          marketplace: "m\u007f",
          servers: ["o"],
        },
        {
          kind: "source-unreadable",
          scope: "user",
          plugin: "r",
          marketplace: "m\u0085",
          servers: ["u"],
        },
      ],
      [],
    );

    // assert
    assert.strictEqual(
      text,
      [
        "Plugin MCP servers in mcp.json need attention.",
        "",
        "Left in mcp.json:",
        "  s\\u000ax, t (p\\u001b) [project] k\\u009b is already defined in the f\\u000d.json, so no server of p\\u001b moved. Remove or rename that server, then run /reload.",
        "  o (q\\u0000) [user] No plugin installed in the user scope owns it. Install q\\u0000@m\\u007f or remove it from mcp.json.",
        "  u (r) [user] The plugin source is not available offline. Run /claude:plugin reinstall r@m\\u0085 to move it.",
      ].join("\n"),
    );
  });

  test("AMIG-03: removed rows render between moved and left-in-place rows, each with its reason", () => {
    // act
    const text = composeMcpMigrationText(
      [
        {
          kind: "moved",
          scope: "project",
          plugin: "hello",
          marketplace: "mp",
          from: "srv",
          to: "plugin_hello_srv_",
        },
        {
          kind: "removed",
          scope: "project",
          plugin: "acme",
          marketplace: "mp",
          server: "srv",
          cause: "disabled",
        },
        {
          kind: "removed",
          scope: "project",
          plugin: "hello",
          marketplace: "mp",
          server: "gone",
          cause: "not-declared",
        },
        {
          kind: "removed",
          scope: "project",
          plugin: "hello",
          marketplace: "mp",
          server: "live",
          cause: "unsupported-feature",
          feature: "ws",
        },
        {
          kind: "removed",
          scope: "user",
          plugin: "broken",
          marketplace: "mp",
          server: "bad",
          cause: "malformed",
        },
        {
          kind: "unowned",
          scope: "project",
          plugin: "ghost",
          marketplace: "mp",
          servers: ["old"],
        },
      ],
      [],
    );

    // assert
    assert.strictEqual(
      text,
      [
        "Plugin MCP servers in mcp.json need attention.",
        "",
        "Moved to mcp-adapter.json:",
        "  srv -> plugin_hello_srv_ (hello) [project]",
        "Removed from mcp.json:",
        "  srv (acme) [project] acme is disabled.",
        "  gone (hello) [project] hello no longer declares it.",
        "  live (hello) [project] {unsupported mcp} ws: pi-mcp-adapter cannot run it.",
        "  bad (broken) [user] {malformed mcp}: broken's MCP config is not valid, so none of its servers are installed.",
        "Left in mcp.json:",
        "  old (ghost) [project] No plugin installed in the project scope owns it. Install ghost@mp or remove it from mcp.json.",
        MCP_MIGRATION_COST_LINE,
      ].join("\n"),
    );
  });

  test("AMIG-03: an unsupported removal with no feature names only the token", () => {
    // act
    const text = composeMcpMigrationText(
      [
        {
          kind: "removed",
          scope: "project",
          plugin: "hello",
          marketplace: "mp",
          server: "live",
          cause: "unsupported-feature",
        },
      ],
      [],
    );

    // assert
    assert.strictEqual(
      text,
      [
        "Plugin MCP servers removed from mcp.json.",
        "",
        "Removed from mcp.json:",
        "  live (hello) [project] {unsupported mcp}: pi-mcp-adapter cannot run it.",
      ].join("\n"),
    );
  });

  test("AMIG-02: an unfinished move renders under the left-in-place rows", () => {
    // act
    const text = composeMcpMigrationText(
      [
        {
          kind: "unfinished",
          scope: "project",
          plugin: "hello",
          marketplace: "mp",
          servers: ["srv", "web"],
          file: "mcp.json",
          detail: "permission denied",
        },
      ],
      [],
    );

    // assert
    assert.strictEqual(
      text,
      [
        "Plugin MCP servers in mcp.json need attention.",
        "",
        "Left in mcp.json:",
        "  srv, web (hello) [project] The new entries are written, but mcp.json could not be updated: permission denied. The next /reload finishes the move.",
      ].join("\n"),
    );
  });

  test("AMIG-02: an unfinished row names the project-scope mcp-adapter.json and adds one final period to the detail", () => {
    // act
    const text = composeMcpMigrationText(
      [
        {
          kind: "unfinished",
          scope: "user",
          plugin: "hello",
          marketplace: "mp",
          servers: ["srv"],
          file: "project-scope mcp-adapter.json",
          detail: "Retry after it completes.",
        },
      ],
      [],
    );

    // assert
    assert.strictEqual(
      text,
      [
        "Plugin MCP servers in mcp.json need attention.",
        "",
        "Left in mcp.json:",
        "  srv (hello) [user] The new entries are written, but project-scope mcp-adapter.json could not be updated: Retry after it completes. The next /reload finishes the move.",
      ].join("\n"),
    );
  });

  test("AMIG-03: control characters in removed and unfinished rows render as \\u escapes", () => {
    // act
    const text = composeMcpMigrationText(
      [
        {
          kind: "removed",
          scope: "project",
          plugin: "p\u001b",
          marketplace: "mp",
          server: "s\nv",
          cause: "unsupported-feature",
          feature: "w\u0007s",
        },
        {
          kind: "removed",
          scope: "project",
          plugin: "q\u009b",
          marketplace: "mp",
          server: "t",
          cause: "not-declared",
        },
        {
          kind: "unfinished",
          scope: "user",
          plugin: "r\r",
          marketplace: "mp",
          servers: ["u\u0000"],
          file: "mcp.json",
          detail: "d\u007f",
        },
      ],
      [],
    );

    // assert
    assert.strictEqual(
      text,
      [
        "Plugin MCP servers in mcp.json need attention.",
        "",
        "Removed from mcp.json:",
        "  s\\u000av (p\\u001b) [project] {unsupported mcp} w\\u0007s: pi-mcp-adapter cannot run it.",
        "  t (q\\u009b) [project] q\\u009b no longer declares it.",
        "Left in mcp.json:",
        "  u\\u0000 (r\\u000d) [user] The new entries are written, but mcp.json could not be updated: d\\u007f. The next /reload finishes the move.",
      ].join("\n"),
    );
  });
});
