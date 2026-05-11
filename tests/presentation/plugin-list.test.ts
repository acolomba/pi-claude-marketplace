import assert from "node:assert/strict";
import test from "node:test";

import { renderPluginList } from "../../extensions/claude-marketplace/presentation/plugin-list.ts";

import type { PluginListPayload } from "../../extensions/claude-marketplace/presentation/plugin-list.ts";

test("PL-1 empty payload returns the empty-marker sentinel", () => {
  const out = renderPluginList({ marketplaces: [] });
  assert.equal(out, "No plugins configured.");
});

test("PL-4 icon + name + (version) renders installed/available/uninstallable correctly", () => {
  const payload: PluginListPayload = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        autoupdate: false,
        plugins: [
          { name: "foo", status: "installed", version: "1.0.0" },
          { name: "bar", status: "available", version: "0.1.0" },
          {
            name: "baz",
            status: "uninstallable",
            notes: ["not installable: contains <foo>"],
          },
        ],
      },
    ],
  };
  const out = renderPluginList(payload);
  assert.match(out, /● foo \(1\.0\.0\)/);
  assert.match(out, /○ bar \(0\.1\.0\)/);
  assert.match(out, /⊘ baz -- not installable: contains <foo>/);
});

test("PL-7 [autoupdate] tag appears in header when autoupdate is true", () => {
  const payload: PluginListPayload = {
    marketplaces: [
      { name: "official", scope: "user", autoupdate: true, plugins: [] },
      { name: "internal", scope: "user", autoupdate: false, plugins: [] },
    ],
  };
  const out = renderPluginList(payload);
  assert.match(out, /official \[autoupdate\]/);
  // 'internal' must NOT be followed by the [autoupdate] tag.
  assert.match(out, /internal\b(?!\s*\[autoupdate\])/);
});

test("PL-6 manifest-load warning lines prepend before marketplace headers, with [warning] prefix", () => {
  const payload: PluginListPayload = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        autoupdate: false,
        plugins: [{ name: "foo", status: "installed", version: "1.0.0" }],
      },
    ],
  };
  const out = renderPluginList(payload, ["could not load manifest: ENOENT"]);
  const warnPos = out.indexOf("[warning]");
  const scopePos = out.indexOf("user scope");
  assert.ok(warnPos >= 0, "warning line present");
  assert.ok(scopePos > warnPos, "warning precedes scope header");
  assert.match(out, /\[warning\] could not load manifest: ENOENT/);
});

test("PL-4 description truncation at column 66: input length 65, 66, 67, 100 (parametric boundary)", () => {
  const make = (desc: string): PluginListPayload => ({
    marketplaces: [
      {
        name: "x",
        scope: "user",
        autoupdate: false,
        plugins: [{ name: "p", status: "installed", version: "1", description: desc }],
      },
    ],
  });
  // 65 chars: no truncation (below boundary)
  const d65 = "a".repeat(65);
  assert.ok(renderPluginList(make(d65)).includes(d65));
  // 66 chars: no truncation (boundary inclusive)
  const d66 = "b".repeat(66);
  assert.ok(renderPluginList(make(d66)).includes(d66));
  // 67 chars: truncated to 63 + "..."
  const d67 = "c".repeat(67);
  const out67 = renderPluginList(make(d67));
  assert.ok(!out67.includes(d67), "67-char description NOT included verbatim");
  assert.ok(
    out67.includes("c".repeat(63) + "..."),
    "67-char description truncated to 63 chars + ...",
  );
  // 100 chars: same truncation envelope (63 + "...")
  const d100 = "d".repeat(100);
  const out100 = renderPluginList(make(d100));
  assert.ok(out100.includes("d".repeat(63) + "..."));
  // And the verbatim 100-char string must NOT be present.
  assert.ok(!out100.includes(d100));
});

test("PL-5 upgradable flag renders alongside version", () => {
  const payload: PluginListPayload = {
    marketplaces: [
      {
        name: "official",
        scope: "user",
        autoupdate: false,
        plugins: [{ name: "foo", status: "installed", version: "1.0.0", upgradable: true }],
      },
    ],
  };
  const out = renderPluginList(payload);
  assert.match(out, /● foo \(1\.0\.0\).*upgradable/);
});

test("PL-2 grouped by scope: user marketplaces precede project marketplaces", () => {
  const payload: PluginListPayload = {
    marketplaces: [
      { name: "from-project", scope: "project", autoupdate: false, plugins: [] },
      { name: "from-user", scope: "user", autoupdate: false, plugins: [] },
    ],
  };
  const out = renderPluginList(payload);
  const userPos = out.indexOf("from-user");
  const projectPos = out.indexOf("from-project");
  assert.ok(userPos < projectPos, "user-scope marketplace renders before project-scope");
});
